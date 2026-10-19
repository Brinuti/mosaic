// MEDICAL PIERCING - TikTok Events API (szerveroldali) foglalas-esemeny a Salonic altal IGAZOLT foglalasokbol.
// Esemenynev (2026-10-13 16:48-tol): "SubmitForm" (korabban "IgazoltFoglalas"), NEM "Schedule" (GPT-dontes 2026-10-13): a kampany a bongeszos, URL-szabalyos
// (event_id nelkuli) SCHEDULE-ra optimalizal; azonos nevvel a TikTok nem deduplikalna -> dupla szamolas az optimalizacios
// esemenyen. Igy masodlagos meres, a kampany tanulasat nem erinti.
//
// ALLAPOT: CSAK NAPLO. Alapertelmezes (mp_beallitas.tiktok_mod hianyzik) = 'naplo': a kuldendo torzset maszkolt
// azonositokkal az mp_tiktok_feltoltes tablaba irjuk, halozati hivas NINCS. Elesre kapcsolas csak a tulajdonos dontesevel:
// mp_beallitas.tiktok_mod = 'eles' ES a TIKTOK_EVENTS_TOKEN Cloudflare-titok megadasa (mindketto kell). Leiras: docs/MERES_TIKTOK.md.
//
// Adatvedelem (MP-16 + adatminimalizalas): kifele CSAK esemeny, ido, esemeny_id, ttclid / ttp (hirdetesi hozzajarulassal
// gyujtve), semleges URL, penznem + ertek. IP + user agent (Feri 2026-10-19, max. adat egeszsegugyi adat nelkul). NINCS e-mail, telefon, external_id, szolgaltatasnev, kategoria,
// piercing-tipus, helyszin, uj/visszatero jeloles. A nem-azonosito mezokon a meres.js vedohaloja (vanErzekeny) fut: talalat -> semmi.
import { esemenyId, vanErzekeny, SEMLEGES_URL } from './meres.js';
import { ipJo } from './meta.js';
import { maszk, kitakar, ELES_HOST } from './google-ads.js';
export const TIKTOK_ESEMENY = 'SubmitForm'; // Feri dontese (2026-10-13 16:48): a split teszthez Leads -> Submit form; a Salonic-oldali GTM-cimke (68) ki, mi kuldjuk

export const TIKTOK_VEGPONT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
export const TIKTOK_PIXEL = 'CU2CR03C77UAQJITQK80';
/** A TikTok alapertelmezett kattintasos attribucios ablaka; ennel regebbi foglalast / kattintast nem kuldunk. */
export const TIKTOK_ABLAK = 7 * 86400;
export const MODOK = Object.freeze(['ki', 'naplo', 'eles']);

export const TIKTOK_SEMA = `CREATE TABLE IF NOT EXISTS mp_tiktok_feltoltes (
  kulcs TEXT PRIMARY KEY, mod TEXT NOT NULL, allapot TEXT NOT NULL, payload_maszkolt TEXT, ido INTEGER NOT NULL)`;

const beallitas = async (db, kulcs) => { try { const r = await db.prepare('SELECT ertek FROM mp_beallitas WHERE kulcs = ?').bind(kulcs).first(); return r ? r.ertek : null; } catch (e) { return null; } };

/**
 * A beallitott mod (mp_beallitas.tiktok_mod): 'ki' | 'naplo' | 'eles'. Hianyzo / ismeretlen ertek -> 'naplo'.
 * Ez a KERT mod; a tenyleges kuldeshez lasd hatalyosMod (token + eles hoszt is kell).
 */
export async function tiktokMod(db) {
  const m = String((await beallitas(db, 'tiktok_mod')) || '').trim().toLowerCase();
  if (m === 'ki' || m === 'off') return 'ki';
  if (m === 'eles') return 'eles';
  return 'naplo';
}

/** Tenyleges mod: 'eles' CSAK kifejezett 'eles' beallitas + TIKTOK_EVENTS_TOKEN + eles hoszt eseten; kulonben naplo (vagy ki). */
export function hatalyosMod(mod, env = {}, host = '') {
  if (mod === 'ki') return 'ki';
  if (mod === 'eles' && env.TIKTOK_EVENTS_TOKEN && host === ELES_HOST) return 'eles';
  return 'naplo';
}

/**
 * Jogosultsag (tiszta): eles, Salonic-igazolt, hirdetesi hozzajarulassal, van ttclid, az esemeny 7 napon belul (es ha ismert
 * a kattintas ideje, a foglalas a kattintas utan 7 napon belul tortent). -> { ok: true } | { ok: false, miert: '<ok>' }
 */
export function jogosult(sor, most) {
  if (!sor) return { ok: false, miert: 'nincs_sor' };
  if (sor.kornyezet !== 'eles') return { ok: false, miert: 'nem_eles' };
  if (sor.tipus === 'ful') return { ok: false, miert: 'divat_fulpiercing' }; // Feri dontese (2026-10-13): nem optimalizalunk ra
  if (sor.igazolas !== 'igazolt') return { ok: false, miert: 'nem_igazolt' };
  if (Number(sor.hozzajarulas_hirdetes) !== 1) return { ok: false, miert: 'nincs_hozzajarulas' };
  if (!sor.tiktok_ttclid && !sor.tiktok_ttp) return { ok: false, miert: 'nincs_tiktok_azonosito' }; // ttclid VAGY _ttp (hozzajarulassal)
  const ido = esemenyIdo(sor);
  if (!Number.isFinite(ido) || most - ido > TIKTOK_ABLAK || ido > most + 300) return { ok: false, miert: 'ablakon_kivul' };
  const k = Number(sor.tiktok_kattintas_ido);
  if (sor.tiktok_kattintas_ido != null && Number.isFinite(k) && ido - k > TIKTOK_ABLAK) return { ok: false, miert: 'kattintas_ablakon_kivul' };
  return { ok: true };
}

/** Konverzios ido: a foglalas letrejotte (Salonic-level ideje), tartalekkent a koszonooldali rogzites. */
export const esemenyIdo = (sor) => Number(sor.foglalas_ido || sor.letrehozva);

/**
 * TikTok Events API 2.0 torzs (tiszta). A user objektumban CSAK ttclid (+ ttp, ha van). Ertek csak ismert osszegnel.
 * Dob, ha a nem-azonosito mezok barmelyike erzekeny adatot tartalmazna (vedohalo: inkabb semmi ne epuljon).
 */
export function tiktokTorzs(sor, ktx = null) {
  const user = {};
  // IP + user agent a foglalas pillanatabol (mp_kontextus, legfeljebb 48 ora): Feri dontese 2026-10-19 (max. adat, egeszsegugyi adat nelkul)
  if (ktx && ipJo(ktx.ip)) user.ip = ipJo(ktx.ip);
  if (ktx && ktx.ua) user.user_agent = String(ktx.ua).slice(0, 400);
  if (sor.tiktok_ttclid) user.ttclid = String(sor.tiktok_ttclid);
  if (sor.tiktok_ttp) user.ttp = String(sor.tiktok_ttp);
  const ertek = Number(sor.ertek);
  const esemeny = { event: TIKTOK_ESEMENY, event_time: esemenyIdo(sor), event_id: esemenyId(sor.kulcs), page: { url: SEMLEGES_URL } };
  if (sor.ertek != null && Number.isFinite(ertek) && ertek > 0) esemeny.properties = { currency: 'HUF', value: Math.round(ertek) };
  const torzs = { event_source: 'web', event_source_id: TIKTOK_PIXEL, data: [{ ...esemeny, user }] };
  // a ttclid / ttp veletlen karaktersor: a tartalmi ellenorzes minden masra vonatkozik
  if (vanErzekeny({ ...torzs, data: [esemeny] })) throw new Error('mp_tiktok_erzekeny_adat');
  return torzs;
}

/** A naplozhato valtozat: ttclid / ttp maszkolva (h:xxxxxxxx). */
export async function maszkoltTorzs(torzs) {
  const m = JSON.parse(JSON.stringify(torzs));
  const u = m.data[0].user;
  for (const k of Object.keys(u)) u[k] = await maszk(u[k]);
  return m;
}

async function elesKuldes(torzs, env, { fetchImpl, ms = 8000 }) {
  const nyersek = Object.values(torzs.data[0].user);
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ac ? setTimeout(() => ac.abort(), ms) : null;
  try {
    const r = await fetchImpl(TIKTOK_VEGPONT, { method: 'POST', headers: { 'content-type': 'application/json', 'Access-Token': env.TIKTOK_EVENTS_TOKEN }, body: JSON.stringify(torzs), signal: ac ? ac.signal : undefined });
    const szoveg = await r.text();
    let j = null; try { j = JSON.parse(szoveg); } catch (e) { /* nem JSON */ }
    const jo = r.ok && j && Number(j.code) === 0;
    return { allapot: jo ? 'elkuldve' : 'hiba', valasz: kitakar(szoveg, nyersek).slice(0, 500) };
  } catch (e) {
    return { allapot: 'hiba', valasz: kitakar(String(e && e.message || e), nyersek).slice(0, 200) };
  } finally { if (t) clearTimeout(t); }
}

/**
 * Egy igazolt foglalas TikTok-lepese. Soha nem dob (a Google-lancot nem zavarhatja). Idempotens: kulcsonkent egy sor;
 * a mar naplozott / elkuldott kulcs nem kerul ujra (eles modban csak a 'hiba' allapot probalhato ujra).
 * -> { allapot, mod } | { kihagyva: '<ok>' }
 */
export async function tiktokLepes(db, sor, env = {}, host = '', { fetchImpl = fetch, most = Math.floor(Date.now() / 1000) } = {}) {
  try {
    const j = jogosult(sor, most);
    if (!j.ok) return { kihagyva: j.miert };
    await db.prepare(TIKTOK_SEMA).run();
    const mod = hatalyosMod(await tiktokMod(db), env, host);
    if (mod === 'ki') return { kihagyva: 'ki' };
    const van = await db.prepare('SELECT mod, allapot FROM mp_tiktok_feltoltes WHERE kulcs = ?').bind(sor.kulcs).first();
    if (van && !(mod === 'eles' && van.allapot === 'hiba')) return { kihagyva: 'mar_rogzitve' };
    let torzs;
    let ktx = null;
    try { ktx = await db.prepare('SELECT ip, ua FROM mp_kontextus WHERE kulcs = ?').bind(sor.kulcs).first(); } catch (e) { /* nincs tabla */ }
    try { torzs = tiktokTorzs(sor, ktx); } catch (e) { return { kihagyva: 'erzekeny_adat' }; }
    const mtorzs = JSON.stringify(await maszkoltTorzs(torzs));
    let allapot = 'naplozva';
    if (mod === 'eles') {
      // halozati hivas CSAK itt: kifejezett 'eles' mod + token + eles hoszt (hatalyosMod)
      const k = await elesKuldes(torzs, env, { fetchImpl });
      allapot = k.allapot;
      if (allapot === 'elkuldve') { try { await db.prepare('DELETE FROM mp_kontextus WHERE kulcs = ?').bind(sor.kulcs).run(); } catch (e) { /* */ } }
    }
    await db.prepare(`INSERT INTO mp_tiktok_feltoltes (kulcs, mod, allapot, payload_maszkolt, ido) VALUES (?,?,?,?,?)
      ON CONFLICT (kulcs) DO UPDATE SET mod = excluded.mod, allapot = excluded.allapot, payload_maszkolt = excluded.payload_maszkolt, ido = excluded.ido
      WHERE mp_tiktok_feltoltes.allapot = 'hiba'`).bind(sor.kulcs, mod, allapot, mtorzs, most).run();
    return { allapot, mod };
  } catch (e) {
    console.error('mp-meres: tiktok lepes hiba', String(e && e.message || e).slice(0, 200));
    return { kihagyva: 'hiba' };
  }
}
