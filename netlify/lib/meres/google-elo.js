// UJ-63 / #502 (Mosaic HeadSpa, VAZLAT): CSERE NELKULI Google-javitas az ELO HeadSpa akcion (7030256606, WEBPAGE_CODELESS, ONE_PER_CLICK).
//   A bongeszos cimke (kod nelkuli) nem visz orderId-t; ezert a szerveres potlas CSAK AKKOR biztonsagos, ha a Google ugyanarra a kattintasra a cimke- es a feltoltott konverziot egynek szamolja
//   (ONE_PER_CLICK) - ez HIPOTEZIS, a meresi oldal GAQL-olvasasa dont (#167). Addig a modul csak dry (validateOnly) modban futhat, az `eles` mod ketszeresen zarva marad.
// KULON MODUL: a vedett platformok.js / elosztas.js valtozatlan (csak importaljuk az idoformatumot es a kattintas-valasztot); a meglevo ARNYEK-lanc (Zapier-webhook) erintetlen.
// ALAPBOL KI: MOSAIC_GADS_ELO = ki (alap) | dry (validateOnly: a Google csak ellenorzi, nem rogzit) | eles (valodi feltoltes: MOSAIC_GADS_ELO_ENGEDELY = 'DECISION-ELES' ES eles host ES kulon DECISION / Feri mondata).
// Jogosult sor: meres_kuldes google / headspa / FoglalasElso, van Google-kattintas a meres_erkezes-ben, a hozzajarulas-szabaly engedi, letrehozva >= MOSAIC_GADS_ELO_TOL, legalabb VARAKOZAS_MOSAIC-kal regebbi.
// Nincs RETRACT, vendegadat nem megy ki (csak a kattintasazonosito + idopont + ertek + hozzajarulasi jel); a kattintas ertek a naploban/valaszban SOHA (maszk: sha256 8 hex).
import { googleIdo } from './platformok.js';
import { googleKattintas } from './erkezes.js';
import { platformSzabaly } from './hozzajarulas.js';
import { meresSema } from './elosztas.js';

export const ELO_AKCIO = '7030256606'; // Mosaic HeadSpa (elo, elsodleges, WEBPAGE_CODELESS)
export const ELO_FIOK = '6088874770';
export const ELO_NEV = 'FoglalasElso';
export const ELO_UZLETAG = 'headspa';
export const VARAKOZAS_MOSAIC = 1800; // a cimke elobb rogzitse a sajat konverziojat
export const ABLAK_NAP_ALAP = 30; // regebbi kattintasra a Google EXPIRED_EVENT-et ad (MP tapasztalat); MOSAIC_GADS_ELO_ABLAK_NAP felulirja (1-90)
const MAX_PROBA = 3;
const API_VERZIO_ALAP = 'v23';
const MAR_BENT = new Set(['CLICK_CONVERSION_ALREADY_EXISTS', 'ORDER_ID_ALREADY_IN_USE', 'DUPLICATE_ORDER_ID']);

export const eloMod = (env = {}) => { const m = String(env.MOSAIC_GADS_ELO || '').trim().toLowerCase(); return m === 'dry' || m === 'eles' ? m : 'ki'; };
export const eloTol = (env = {}) => { const t = Number(env.MOSAIC_GADS_ELO_TOL); return Number.isFinite(t) && t > 1700000000 ? Math.floor(t) : null; };
export const eloAblakNap = (env = {}) => { const n = Number(env.MOSAIC_GADS_ELO_ABLAK_NAP); return Number.isFinite(n) && n >= 1 && n <= 90 ? Math.floor(n) : ABLAK_NAP_ALAP; };
/** Az `eles` kuldes kapui (mind kell): MOSAIC_GADS_ELO=eles, kulon engedely-jelzo, az eles host. Barmelyik hianyzik -> dry marad. */
export const elesKuldesE = (env = {}, host = '') => eloMod(env) === 'eles' && String(env.MOSAIC_GADS_ELO_ENGEDELY || '') === 'DECISION-ELES' && /^(www\.)?mosaicheadspa\.hu$/i.test(String(host || ''));

const SEMA = ['CREATE TABLE IF NOT EXISTS meres_google_elo (esemeny_id TEXT PRIMARY KEY, mod TEXT NOT NULL, allapot TEXT NOT NULL, http_status INTEGER, kod TEXT, kattintas_maszk TEXT, probalkozas INTEGER NOT NULL DEFAULT 0, ido INTEGER NOT NULL)'];
const kesz = new WeakSet();
async function sema(db) { if (kesz.has(db)) return; await meresSema(db); await db.batch(SEMA.map((s) => db.prepare(s))); kesz.add(db); }

const maszk = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
const kitakar = (szoveg, titkok) => titkok.filter(Boolean).reduce((a, t) => a.split(String(t)).join('[kattintas]'), String(szoveg));

/** Az API-konverzio (tiszta fuggveny). f: { esemeny_id, ido (unix mp), ertek, kattintas: { tipus, ertek }, jel: { ad_user_data } } -> null, ha nem epitheto. */
export function eloKonverzio(f) {
  if (!f || !f.kattintas || !f.kattintas.ertek || !['gclid', 'gbraid', 'wbraid'].includes(f.kattintas.tipus)) return null;
  const k = { conversionAction: `customers/${ELO_FIOK}/conversionActions/${ELO_AKCIO}`, [f.kattintas.tipus]: f.kattintas.ertek, conversionDateTime: googleIdo(f.ido), consent: { adUserData: (f.jel && f.jel.ad_user_data) === 'GRANTED' ? 'GRANTED' : 'DENIED' } };
  if (Number.isFinite(f.ertek) && f.ertek > 0) { k.conversionValue = f.ertek; k.currencyCode = 'HUF'; }
  return k;
}

/** Az API valasza -> { allapot: 'elfogadva'|'elkuldve'|'mar_bent'|'hiba', kod }. A partialFailure "mar bent van" kodjai sikernek szamitanak. */
export function valaszErtekel(status, szoveg, { validate }) {
  let j = null; try { j = JSON.parse(szoveg); } catch (e) { /* nem JSON */ }
  const kodok = []; const pf = j && j.partialFailureError;
  if (pf) for (const d of pf.details || []) for (const er of d.errors || []) { const c = er.errorCode || {}; kodok.push(String(c.conversionUploadError || Object.values(c)[0] || 'ISMERETLEN')); }
  if (status >= 200 && status < 300 && !pf) return { allapot: validate ? 'elfogadva' : 'elkuldve', kod: null };
  if (kodok.length && kodok.every((c) => MAR_BENT.has(c))) return { allapot: 'mar_bent', kod: kodok[0] };
  return { allapot: 'hiba', kod: (kodok[0] || (j && j.error && j.error.status) || 'HTTP_' + status).slice(0, 80) };
}

async function accessToken(env, fetchImpl) {
  const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN }).toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('oauth: HTTP ' + r.status);
  return j.access_token;
}
const apiVan = (env) => !!(env.GOOGLE_ADS_DEVELOPER_TOKEN && env.GOOGLE_ADS_CLIENT_ID && env.GOOGLE_ADS_CLIENT_SECRET && env.GOOGLE_ADS_REFRESH_TOKEN);

/**
 * A sweep: a jogosult, meg fel nem toltott HeadSpa-sorok potlasa. Hivasi pont (KESOBB, kulon DECISION utan): a Pages Function waitUntil-lel; a hiba elnyelt.
 * -> { allapot: 'ki' | 'nincs_tol' | 'nincs_szallito' | 'kesz' | 'hiba', feldolgozva, eredmenyek: { allapot: db } }
 */
export async function eloPotlas({ db, env = {}, host = '', most = Math.floor(Date.now() / 1000), fetchImpl = fetch, limit = 3, esemenyIdk = null }) {
  try {
    const mod = eloMod(env);
    if (mod === 'ki') return { allapot: 'ki' };
    const tol = eloTol(env);
    if (!tol) return { allapot: 'nincs_tol', megjegyzes: 'MOSAIC_GADS_ELO_TOL (az elso potlando foglalas ideje; ennel korabbit nem toltunk) nincs beallitva' };
    if (!apiVan(env)) return { allapot: 'nincs_szallito' };
    const eles = elesKuldesE(env, host);
    await sema(db);
    const idk = Array.isArray(esemenyIdk) ? esemenyIdk.map(String).slice(0, 10) : null; // kezi potlas: csak a megadott esemeny-azonositok
    if (idk && !idk.length) return { allapot: 'kesz', feldolgozva: 0, eredmenyek: {} };
    const { results } = await db.prepare(`SELECT k.esemeny_id, k.source_id, k.ertek, k.letrehozva, e.attr, e.hozz FROM meres_kuldes k JOIN meres_erkezes e ON e.source_id = k.source_id
      WHERE k.platform = 'google' AND k.uzletag = ?1 AND k.esemeny_nev = ?2 AND k.letrehozva >= ?3 AND k.letrehozva <= ?4${idk ? ` AND k.esemeny_id IN (${idk.map((_, i) => '?' + (8 + i)).join(', ')})` : ''}
        AND NOT EXISTS (SELECT 1 FROM meres_google_elo g WHERE g.esemeny_id = k.esemeny_id AND (g.allapot IN ('elkuldve', 'mar_bent', 'kihagyva_ablakon_kivul') OR g.probalkozas >= ?5 OR (g.mod = ?6 AND g.allapot = 'elfogadva')))
      ORDER BY k.letrehozva LIMIT ?7`).bind(ELO_UZLETAG, ELO_NEV, tol, most - VARAKOZAS_MOSAIC, MAX_PROBA, eles ? 'eles' : 'dry', limit, ...(idk || [])).all();
    const sorok = results || [];
    const eredmenyek = {};
    const szamol = (a) => { eredmenyek[a] = (eredmenyek[a] || 0) + 1; };
    if (!sorok.length) return { allapot: 'kesz', feldolgozva: 0, eredmenyek };
    let token = null;
    for (const sor of sorok) {
      let attr = null; let hozz = null;
      try { attr = JSON.parse(sor.attr); hozz = JSON.parse(sor.hozz); } catch (e) { szamol('kihagyva_hibas_adat'); continue; }
      const kattintas = googleKattintas(attr);
      const szab = platformSzabaly('google', hozz, env);
      if (!kattintas || !szab.kuldheto) { szamol(kattintas ? 'kihagyva_hozzajarulas' : 'kihagyva_nincs_kattintas'); continue; }
      const k = eloKonverzio({ esemeny_id: sor.esemeny_id, ido: sor.letrehozva, ertek: Number(sor.ertek), kattintas, jel: szab.jel });
      if (!k) { szamol('kihagyva_nincs_kattintas'); continue; }
      const kodMod = eles ? 'eles' : 'dry';
      if (kattintas.ts > 0 && sor.letrehozva - kattintas.ts > eloAblakNap(env) * 86400) { // a Google konverzios ablakan kivul: EXPIRED_EVENT lenne
        await db.prepare(`INSERT INTO meres_google_elo (esemeny_id, mod, allapot, http_status, kod, kattintas_maszk, probalkozas, ido) VALUES (?1, ?2, 'kihagyva_ablakon_kivul', NULL, NULL, ?3, ?4, ?5)
          ON CONFLICT (esemeny_id) DO UPDATE SET allapot = 'kihagyva_ablakon_kivul', ido = excluded.ido`).bind(sor.esemeny_id, kodMod, await maszk(kattintas.ertek), MAX_PROBA, most).run();
        szamol('kihagyva_ablakon_kivul'); continue;
      }
      let allapot = 'hiba'; let http = null; let kod = null;
      try {
        token = token || await accessToken(env, fetchImpl);
        const fejlec = { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN };
        if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) fejlec['login-customer-id'] = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g, '');
        const r = await fetchImpl(`https://googleads.googleapis.com/${env.MOSAIC_GADS_API_VERZIO || API_VERZIO_ALAP}/customers/${ELO_FIOK}:uploadClickConversions`, { method: 'POST', headers: fejlec, body: JSON.stringify({ conversions: [k], partialFailure: true, validateOnly: !eles }) });
        http = r.status; const e = valaszErtekel(r.status, kitakar(await r.text(), [kattintas.ertek]), { validate: !eles }); allapot = e.allapot; kod = e.kod;
      } catch (err) { kod = String(err && err.message || err).slice(0, 80); }
      await db.prepare(`INSERT INTO meres_google_elo (esemeny_id, mod, allapot, http_status, kod, kattintas_maszk, probalkozas, ido) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)
        ON CONFLICT (esemeny_id) DO UPDATE SET mod = excluded.mod, allapot = excluded.allapot, http_status = excluded.http_status, kod = excluded.kod, kattintas_maszk = excluded.kattintas_maszk, probalkozas = meres_google_elo.probalkozas + 1, ido = excluded.ido`)
        .bind(sor.esemeny_id, kodMod, allapot, http, kod, await maszk(kattintas.ertek), most).run();
      szamol(allapot);
    }
    return { allapot: 'kesz', feldolgozva: Object.values(eredmenyek).reduce((a, b) => a + b, 0), eredmenyek };
  } catch (err) {
    console.error('mosaic google-elo: hiba', String(err && err.message || err).slice(0, 200));
    return { allapot: 'hiba' };
  }
}
