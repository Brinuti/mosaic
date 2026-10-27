// UJ-63 (MP, #167 6394447316): CSERE NELKULI Google-javitas az ELO "All - Idopontfoglalas" akcion (7468541217).
//   A bongeszos cimke (web-GTM) a foglalasi kulcsot (placeId|employeeId|startUnix) orderId-kent viszi (a 7839410357 mar igy); itt a SZERVER a hianyzo (adblock / suti-elutasitas / kesei cimke) IGAZOLT foglalasokat
//   UGYANERRE az akciora, AZONOS orderId-vel tolti vissza -> a Google azonos akcio + azonos orderId parra egy konverziot szamol (dedup). Lemondas miatt NEM vonunk le (nincs RETRACT, Feri szabalya).
// KULON MODUL, a vedett lanc.js / google-ads.js valtozatlan (csak importaljuk a konstansokat / az idoformatumot); a meglevo ARNYEK-feltoltes (ENGEDETT_AKCIOK vedohalo) erintetlen.
// ALAPBOL KI: MP_GADS_ELO = ki (alap) | dry (validateOnly: a Google csak ellenorzi, nem rogzit) | eles (valodi feltoltes: csak MP_GADS_MOD=eles ES eles host ES kulon DECISION / Feri mondata).
// Jogosult sor: igazolt (Salonic), nem divat-ful, van Google-kattintasazonosito, hirdetesi hozzajarulas, foglalas_ido >= MP_GADS_ELO_TOL (a bongeszos orderId-s cimke elesitese utan; ennel korabbihoz nincs orderId-s tag-konverzio),
// es legalabb VARAKOZAS_MP-vel regebbi (a cimke elobb rogzitse a sajat konverziojat). A sweep idempotens (mp_feltoltes_elo), legfeljebb 3 probalkozas soronkent.
import { MP_GADS, googleIdo, kitakar, maszk, elesKuldesE, kikapcsolvaE } from './google-ads.js';

export const ELO_AKCIO = '7468541217'; // MP "All - Idopontfoglalas" (elo, elsodleges)
export const VARAKOZAS_MP = 1800;
export const ABLAK_NAP_ALAP = 30; // a kattintas ennyi napnal regebbi foglalasnal a Google EXPIRED_EVENT hibat ad (MP ARNYEK Foglalas 7834926162: a 10-26-i 36 napos kattintas; 10-27-i 29 napos meg ment): ide nem kuldunk, kihagyva_ablakon_kivul. MP_GADS_ELO_ABLAK_NAP felulirja (max 90).
const MAX_PROBA = 3;
const MAR_BENT = new Set(['CLICK_CONVERSION_ALREADY_EXISTS', 'ORDER_ID_ALREADY_IN_USE', 'DUPLICATE_ORDER_ID']); // ugyanaz a konverzio mar bent van: sikernek vesszuk (nincs dupla)

export const eloMod = (env = {}) => { const m = String(env.MP_GADS_ELO || '').trim().toLowerCase(); return m === 'dry' || m === 'eles' ? m : 'ki'; };
export const eloAblakNap = (env = {}) => { const n = Number(env.MP_GADS_ELO_ABLAK_NAP); return Number.isFinite(n) && n >= 1 && n <= 90 ? Math.floor(n) : ABLAK_NAP_ALAP; };
export const eloTol = (env = {}) => { const t = Number(env.MP_GADS_ELO_TOL); return Number.isFinite(t) && t > 1700000000 ? Math.floor(t) : null; };

const SEMA = [
  `CREATE TABLE IF NOT EXISTS mp_feltoltes_elo (
    kulcs TEXT PRIMARY KEY, mod TEXT NOT NULL, allapot TEXT NOT NULL, http_status INTEGER, kod TEXT, kattintas_maszk TEXT, probalkozas INTEGER NOT NULL DEFAULT 0, ido INTEGER NOT NULL)`,
];
const kesz = new WeakSet();
async function sema(db) { if (kesz.has(db)) return; await db.batch(SEMA.map((s) => db.prepare(s))); kesz.add(db); }

/** Az API-konverzio (tiszta fuggveny). f: { kulcs, letrehozva, ertek, kattintas: { tipus, ertek } } */
export function eloKonverzio(f) {
  if (!f.kattintas || !f.kattintas.ertek || !['gclid', 'gbraid', 'wbraid'].includes(f.kattintas.tipus)) return null;
  const k = { conversionAction: `customers/${MP_GADS.customerId}/conversionActions/${ELO_AKCIO}`, [f.kattintas.tipus]: f.kattintas.ertek, conversionDateTime: googleIdo(f.letrehozva), orderId: f.kulcs, consent: { adUserData: 'GRANTED' } };
  if (Number.isFinite(f.ertek) && f.ertek > 0) { k.conversionValue = f.ertek; k.currencyCode = 'HUF'; }
  return k;
}

async function accessToken(env, fetchImpl) {
  const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN }).toString() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('oauth: HTTP ' + r.status);
  return j.access_token;
}
const apiVan = (env) => !!(env.GOOGLE_ADS_DEVELOPER_TOKEN && env.GOOGLE_ADS_CLIENT_ID && env.GOOGLE_ADS_CLIENT_SECRET && env.GOOGLE_ADS_REFRESH_TOKEN);

/** Az API valasza -> { allapot: 'elfogadva'|'elkuldve'|'mar_bent'|'hiba', kod }. A partialFailure hibakodjai kozul az "mar bent van" sikernek szamit. */
export function valaszErtekel(status, szoveg, { validate }) {
  let j = null; try { j = JSON.parse(szoveg); } catch (e) { /* nem JSON */ }
  const kodok = []; const pf = j && j.partialFailureError;
  if (pf) for (const d of pf.details || []) for (const er of d.errors || []) { const c = er.errorCode || {}; kodok.push(String(c.conversionUploadError || Object.values(c)[0] || 'ISMERETLEN')); }
  if (status >= 200 && status < 300 && !pf) return { allapot: validate ? 'elfogadva' : 'elkuldve', kod: null };
  if (kodok.length && kodok.every((c) => MAR_BENT.has(c))) return { allapot: 'mar_bent', kod: kodok[0] };
  return { allapot: 'hiba', kod: (kodok[0] || (j && j.error && j.error.status) || 'HTTP_' + status).slice(0, 80) };
}

/**
 * A sweep: a jogosult, meg fel nem toltott sorok pótlása. Hivasi pont: a Pages Function (mp-foglalas.js / mp-salonic-igazolas.js) waitUntil-lel; a hiba elnyelt.
 * -> { allapot: 'ki' | 'nincs_tol' | 'nincs_szallito' | 'kesz', feldolgozva, eredmenyek: { allapot: db } }
 */
// limit 3: a foglalasErkezes ~36 D1-hivasa mellett a Pages Function 50 subrequest / hivas kerete miatt (a waitUntil sweep csak par sort visz; a tobbit a kovetkezo hivas viszi)
export async function eloPotlas({ db, env = {}, host = '', most = Math.floor(Date.now() / 1000), fetchImpl = fetch, limit = 3 }) {
  try {
    const mod = eloMod(env);
    if (mod === 'ki' || kikapcsolvaE(env)) return { allapot: 'ki' };
    const tol = eloTol(env);
    if (!tol) return { allapot: 'nincs_tol', megjegyzes: 'MP_GADS_ELO_TOL (a bongeszos orderId-s cimke elesitesenek ideje) nincs beallitva' };
    if (!apiVan(env)) return { allapot: 'nincs_szallito' }; // csak a kozvetlen API (OAuth); a Zap nem engedi az elo akciot
    const eles = mod === 'eles' && elesKuldesE(env, host);
    await sema(db);
    const { results } = await db.prepare(`SELECT f.* FROM mp_foglalas f
      WHERE f.igazolas = 'igazolt' AND COALESCE(f.tipus, '') <> 'ful' AND f.kattintas_ertek IS NOT NULL AND f.hozzajarulas_hirdetes = 1
        AND ${eles ? "f.kornyezet = 'eles'" : '1 = 1'} AND COALESCE(f.foglalas_ido, f.letrehozva) >= ?1 AND COALESCE(f.foglalas_ido, f.letrehozva) <= ?2
        AND NOT EXISTS (SELECT 1 FROM mp_feltoltes_elo e WHERE e.kulcs = f.kulcs AND (e.allapot IN ('elkuldve', 'mar_bent') OR e.probalkozas >= ?3 OR (e.mod = ?4 AND e.allapot = 'elfogadva')))
      ORDER BY f.letrehozva LIMIT ?5`).bind(tol, most - VARAKOZAS_MP, MAX_PROBA, eles ? 'eles' : 'dry', limit).all();
    const sorok = results || [];
    const eredmenyek = {};
    if (!sorok.length) return { allapot: 'kesz', feldolgozva: 0, eredmenyek };
    let token = null;
    for (const sor of sorok) {
      const f = { kulcs: sor.kulcs, letrehozva: sor.foglalas_ido || sor.letrehozva, ertek: sor.ertek, kattintas: { tipus: sor.kattintas_tipus, ertek: sor.kattintas_ertek } };
      const k = eloKonverzio(f); if (!k) continue;
      const kattIdo = Number(sor.kattintas_ido);
      if (Number.isFinite(kattIdo) && kattIdo > 0 && f.letrehozva - kattIdo > eloAblakNap(env) * 86400) { // a kattintas a Google konverzios ablakan kivul van: a feltoltes EXPIRED_EVENT lenne, nem probaljuk
        await db.prepare(`INSERT INTO mp_feltoltes_elo (kulcs, mod, allapot, http_status, kod, kattintas_maszk, probalkozas, ido) VALUES (?1, ?2, 'kihagyva_ablakon_kivul', NULL, NULL, ?3, ?4, ?5)
          ON CONFLICT (kulcs) DO UPDATE SET allapot = 'kihagyva_ablakon_kivul', ido = excluded.ido`).bind(sor.kulcs, eles ? 'eles' : 'dry', await maszk(sor.kattintas_ertek), MAX_PROBA, most).run();
        eredmenyek.kihagyva_ablakon_kivul = (eredmenyek.kihagyva_ablakon_kivul || 0) + 1; continue;
      }
      let allapot = 'hiba', http = null, kod = null;
      try {
        token = token || await accessToken(env, fetchImpl);
        const fejlec = { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN };
        if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) fejlec['login-customer-id'] = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g, '');
        const r = await fetchImpl(`https://googleads.googleapis.com/${env.MP_GADS_API_VERZIO || MP_GADS.apiVerzio}/customers/${MP_GADS.customerId}:uploadClickConversions`, { method: 'POST', headers: fejlec, body: JSON.stringify({ conversions: [k], partialFailure: true, validateOnly: !eles }) });
        http = r.status; const e = valaszErtekel(r.status, kitakar(await r.text(), [sor.kattintas_ertek]), { validate: !eles }); allapot = e.allapot; kod = e.kod;
      } catch (err) { kod = String(err && err.message || err).slice(0, 80); }
      await db.prepare(`INSERT INTO mp_feltoltes_elo (kulcs, mod, allapot, http_status, kod, kattintas_maszk, probalkozas, ido) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)
        ON CONFLICT (kulcs) DO UPDATE SET mod = excluded.mod, allapot = excluded.allapot, http_status = excluded.http_status, kod = excluded.kod, kattintas_maszk = excluded.kattintas_maszk, probalkozas = mp_feltoltes_elo.probalkozas + 1, ido = excluded.ido`)
        .bind(sor.kulcs, eles ? 'eles' : 'dry', allapot, http, kod, await maszk(sor.kattintas_ertek), most).run();
      eredmenyek[allapot] = (eredmenyek[allapot] || 0) + 1;
    }
    return { allapot: 'kesz', feldolgozva: Object.values(eredmenyek).reduce((a, b) => a + b, 0), eredmenyek };
  } catch (err) {
    console.error('mp google-elo: hiba', String(err && err.message || err).slice(0, 200));
    return { allapot: 'hiba' };
  }
}
