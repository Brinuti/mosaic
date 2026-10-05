// Nevtelen foglalo-lepes szamlalo (DECISION-LOG #88, 2. csatorna): technikai uzemi naplo, MINDEN latogatora, hozzajarulastol fuggetlenul.
//
//   POST /api/foglalo-szamlalo   {"lepes","uzletag","tipus"?,"load_ms"?}   -> 204   (a foglalo kuldi, sendBeacon)
//   GET  /api/foglalo-szamlalo?kulcs=<olvaso kulcs>[&nap=YYYY-MM-DD | &tol=..&ig=..][&formatum=json|csv|html]   -> a napi osszesitett szamok
//
// Mit tarolunk (Cloudflare D1, wrangler.toml: SZAMLALO_DB): csak OSSZESITETT darabszamokat, naponta (Europe/Budapest) es uzletagankent:
//   lepes_szamlalo(nap, uzletag, lepes, tipus, db)   lepesenkenti darabszam; hibaknal a tipus a hiba tipusa; bezarasnal a lepes, ahol bezartak
//   betoltes_szamlalo(nap, uzletag, vedro, db, ossz_ms, max_ms)   az idopontok betoltesi ideje (eloszlas-vedrok + osszeg + maximum)
// NEM tarolunk: sutit, azonositot (munkamenet / eszkoz / felhasznalo), IP-cimet, nevet, e-mailt, telefonszamot, oldal-URL-t, idobelyeget (csak a napot).
// A kerest a szerver nem naplozza el (se console, se KV): az egyetlen nyom a D1 darabszam.
//
// Vedelem: csak azonos eredetu (Origin / Sec-Fetch-Site) POST; a testtartalom <= 1 KiB; a mezok zart listabol valok (ismeretlen ertek = elutasitas);
// kulcsonkent legfeljebb DB_PLAFON darab / nap (egy kamu forgalom se tehesse tonkre a szamokat). Az olvasas kulcsos: a kulcs SHA-256-ja az
// SZAMLALO_OLVASO_HASH valtozoban van (a kulcs maga nincs a kodban), kulcs nelkul / rossz kulccsal 404.

export const LEPESEK = Object.freeze(['open', 'business', 'service', 'slots_loaded', 'slot', 'form_start', 'submit', 'success', 'close', 'error']);
export const UZLETAGAK = Object.freeze(['headspa', 'hair', 'oxygen', 'laser', 'pmu', 'gift', 'none']);
export const HIBA_TIPUSOK = Object.freeze(['salonic_api', 'no_slots', 'timeout', 'validation', 'slot_lost', 'hold_expired', 'verify_failed', 'unknown_redirect', 'callback_failed', 'client_error']);
export const VEDROK = Object.freeze([['lt500', 500], ['lt1000', 1000], ['lt2000', 2000], ['lt5000', 5000], ['ge5000', Infinity]]);
export const DB_PLAFON = 100000;
const BEZARAS_LEPES = /^[A-Za-z0-9_]{1,12}$/; // a foglalo nezet-kodja (H0, HS1, C1, C4, A1_SENT, ...)
const TIMEZONE = 'Europe/Budapest';
const MAX_NAP = 93;

/** A nap (YYYY-MM-DD) budapesti ideju szerint. */
export const napBudapest = (d = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const NAP = /^\d{4}-\d{2}-\d{2}$/;
const napEltol = (nap, db) => { const [y, m, d] = nap.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + db)); return t.toISOString().slice(0, 10); };
const vedroNev = (ms) => VEDROK.find(([, hatar]) => ms < hatar)[0];

/** A POST torzse -> { ok, adat } | { ok: false, miert }. Csak zart listabol valo ertek fogadhato el, minden mas kidobva. */
export function ervenyesit(torzs) {
  let o;
  try { o = typeof torzs === 'string' ? JSON.parse(torzs) : torzs; } catch (e) { return { ok: false, miert: 'nem JSON' }; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, miert: 'nem objektum' };
  const ismert = new Set(['lepes', 'uzletag', 'tipus', 'load_ms']);
  for (const k of Object.keys(o)) if (!ismert.has(k)) return { ok: false, miert: 'ismeretlen mezo: ' + k };
  if (!LEPESEK.includes(o.lepes)) return { ok: false, miert: 'ismeretlen lepes' };
  if (!UZLETAGAK.includes(o.uzletag)) return { ok: false, miert: 'ismeretlen uzletag' };
  let tipus = '';
  if (o.lepes === 'error') { if (!HIBA_TIPUSOK.includes(o.tipus)) return { ok: false, miert: 'ismeretlen hibatipus' }; tipus = o.tipus; }
  else if (o.lepes === 'close') { if (typeof o.tipus !== 'string' || !BEZARAS_LEPES.test(o.tipus)) return { ok: false, miert: 'hibas bezaras-lepes' }; tipus = o.tipus; }
  else if (o.tipus !== undefined) return { ok: false, miert: 'ennel a lepesnel nincs tipus' };
  let loadMs = null;
  if (o.lepes === 'slots_loaded') {
    if (typeof o.load_ms !== 'number' || !Number.isFinite(o.load_ms) || o.load_ms < 0) return { ok: false, miert: 'hibas load_ms' };
    loadMs = Math.min(Math.round(o.load_ms), 60000);
  } else if (o.load_ms !== undefined) return { ok: false, miert: 'ennel a lepesnel nincs load_ms' };
  return { ok: true, adat: { lepes: o.lepes, uzletag: o.uzletag, tipus, loadMs } };
}

const SQL_LEPES = 'INSERT INTO lepes_szamlalo (nap, uzletag, lepes, tipus, db) VALUES (?1, ?2, ?3, ?4, 1) ON CONFLICT(nap, uzletag, lepes, tipus) DO UPDATE SET db = db + 1 WHERE db < ?5';
const SQL_BETOLTES = 'INSERT INTO betoltes_szamlalo (nap, uzletag, vedro, db, ossz_ms, max_ms) VALUES (?1, ?2, ?3, 1, ?4, ?4) ON CONFLICT(nap, uzletag, vedro) DO UPDATE SET db = db + 1, ossz_ms = ossz_ms + ?4, max_ms = MAX(max_ms, ?4) WHERE db < ?5';

/** Egy esemeny beirasa (D1): atomikus novelés (nincs olvas-modosit-ir verseny). */
export async function ir(db, adat, nap) {
  const stmts = [db.prepare(SQL_LEPES).bind(nap, adat.uzletag, adat.lepes, adat.tipus, DB_PLAFON)];
  if (adat.loadMs !== null) stmts.push(db.prepare(SQL_BETOLTES).bind(nap, adat.uzletag, vedroNev(adat.loadMs), adat.loadMs, DB_PLAFON));
  await db.batch(stmts);
}

const ures = () => ({ lepesek: {}, bezaras_lepesenkent: {}, hibak: {}, betoltes: { db: 0, atlag_ms: null, max_ms: 0, eloszlas: {} } });
function hozzaad(cel, r) {
  if (r.t === 'lepes') {
    cel.lepesek[r.lepes] = (cel.lepesek[r.lepes] || 0) + r.db;
    if (r.lepes === 'close') cel.bezaras_lepesenkent[r.tipus] = (cel.bezaras_lepesenkent[r.tipus] || 0) + r.db;
    if (r.lepes === 'error') cel.hibak[r.tipus] = (cel.hibak[r.tipus] || 0) + r.db;
  } else {
    const b = cel.betoltes; b.db += r.db; b.ossz_ms = (b.ossz_ms || 0) + r.ossz_ms; b.max_ms = Math.max(b.max_ms, r.max_ms); b.eloszlas[r.vedro] = (b.eloszlas[r.vedro] || 0) + r.db;
  }
}
const lezar = (cel) => { const b = cel.betoltes; b.atlag_ms = b.db ? Math.round(b.ossz_ms / b.db) : null; delete b.ossz_ms; };

/** A D1 sorokbol a kimeneti szerkezet: napok -> uzletagak -> {lepesek, bezaras_lepesenkent, hibak, betoltes}, + osszesen. */
export function osszeallit(lepesSorok, betoltesSorok, tol, ig) {
  const napok = {}; const osszesen = {};
  const el = [...lepesSorok.map((r) => ({ t: 'lepes', ...r })), ...betoltesSorok.map((r) => ({ t: 'betoltes', ...r }))];
  for (const r of el) {
    const n = (napok[r.nap] ||= {}); const u = (n[r.uzletag] ||= ures()); const o = (osszesen[r.uzletag] ||= ures());
    hozzaad(u, r); hozzaad(o, r);
  }
  for (const n of Object.values(napok)) for (const u of Object.values(n)) lezar(u);
  for (const o of Object.values(osszesen)) lezar(o);
  return { tol, ig, idozona: TIMEZONE, napok, osszesen };
}

/** Hosszu (egy sor = egy szam) CSV: nap;uzletag;lepes;tipus;darab (+ betoltesi sorok: slots_loaded_ms / vedro, atlag, max). */
export function csvbe(kimenet) {
  const sor = [['nap', 'uzletag', 'lepes', 'tipus', 'darab'].join(';')];
  for (const [nap, n] of Object.entries(kimenet.napok)) for (const [u, v] of Object.entries(n)) {
    for (const [l, db] of Object.entries(v.lepesek)) if (l !== 'close' && l !== 'error') sor.push([nap, u, l, '', db].join(';'));
    for (const [t, db] of Object.entries(v.bezaras_lepesenkent)) sor.push([nap, u, 'close', t, db].join(';'));
    for (const [t, db] of Object.entries(v.hibak)) sor.push([nap, u, 'error', t, db].join(';'));
    for (const [vedro, db] of Object.entries(v.betoltes.eloszlas)) sor.push([nap, u, 'slots_loaded_ms', vedro, db].join(';'));
    if (v.betoltes.db) { sor.push([nap, u, 'slots_loaded_ms', 'atlag', v.betoltes.atlag_ms].join(';')); sor.push([nap, u, 'slots_loaded_ms', 'max', v.betoltes.max_ms].join(';')); }
  }
  return sor.join('\n') + '\n';
}

const MEGNEVEZES = { open: 'Megnyitás', business: 'Üzletág', service: 'Szolgáltatás', slots_loaded: 'Időpontok betöltve', slot: 'Időpont', form_start: 'Űrlap', submit: 'Elküldés', success: 'Sikeres foglalás', close: 'Bezárás', error: 'Hiba' };
const ESC = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Emberi nezet a tulajdonosnak: egy tabla naponta es uzletagankent. */
export function htmlbe(kimenet) {
  const fejlec = LEPESEK.filter((l) => l !== 'close' && l !== 'error');
  let t = '';
  for (const nap of Object.keys(kimenet.napok).sort().reverse()) {
    t += `<h2>${ESC(nap)}</h2><table><tr><th>Üzletág</th>${fejlec.map((l) => `<th>${ESC(MEGNEVEZES[l])}</th>`).join('')}<th>Bezárás (lépésenként)</th><th>Hibák (típusonként)</th><th>Betöltés ms (átlag / max)</th></tr>`;
    for (const [u, v] of Object.entries(kimenet.napok[nap])) {
      const fel = (o) => Object.entries(o).map(([k, db]) => `${ESC(k)}: ${db}`).join(', ') || '–';
      t += `<tr><td>${ESC(u)}</td>${fejlec.map((l) => `<td>${v.lepesek[l] || 0}</td>`).join('')}<td>${fel(v.bezaras_lepesenkent)}</td><td>${fel(v.hibak)}</td><td>${v.betoltes.db ? `${v.betoltes.atlag_ms} / ${v.betoltes.max_ms}` : '–'}</td></tr>`;
    }
    t += '</table>';
  }
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foglaló napi számláló</title>`
    + '<style>body{font:14px/1.4 system-ui,Arial,sans-serif;margin:16px;color:#1f2d2b}table{border-collapse:collapse;margin-bottom:16px}th,td{border:1px solid #ccc;padding:4px 8px;text-align:right}th:first-child,td:first-child,td:nth-last-child(-n+3){text-align:left}th{background:#f3f1ec}</style></head><body>'
    + `<h1>Foglaló napi számláló</h1><p>${ESC(kimenet.tol)} – ${ESC(kimenet.ig)} (budapesti idő). Névtelen, összesített darabszámok, sütik és azonosítók nélkül.</p>${t || '<p>Ebben az időszakban még nincs adat.</p>'}</body></html>`;
}

async function sha256Hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const egyenlo = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

const valasz = (status, body = null, extra = {}) => new Response(body, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra } });

export async function kezel(request, env, { most = () => new Date() } = {}) {
  const url = new URL(request.url);
  if (request.method === 'POST') {
    // csak a sajat oldalunkrol (a foglalo beaconje azonos eredetu); idegen eredet / ismert cross-site keres: elutasitva
    const origin = request.headers.get('origin'); const site = request.headers.get('sec-fetch-site');
    if ((origin && origin !== url.origin) || (site && site !== 'same-origin' && site !== 'none')) return valasz(403);
    const szoveg = await request.text();
    if (szoveg.length > 1024) return valasz(413);
    const v = ervenyesit(szoveg);
    if (!v.ok) return valasz(400, v.miert);
    if (!env || !env.SZAMLALO_DB) return valasz(204, null, { 'x-szamlalo': 'nincs-tarolo' }); // nincs D1 kotes (helyi / nem beallitott kornyezet): a foglalo ettol nem akad el
    try { await ir(env.SZAMLALO_DB, v.adat, napBudapest(most())); } catch (e) { return valasz(204, null, { 'x-szamlalo': 'iras-hiba' }); } // a vendeg elol a hiba rejtve marad
    return valasz(204);
  }
  if (request.method === 'GET') {
    const kulcs = url.searchParams.get('kulcs') || '';
    if (!env || !env.SZAMLALO_OLVASO_HASH || !kulcs || !egyenlo(await sha256Hex(kulcs), String(env.SZAMLALO_OLVASO_HASH).toLowerCase())) return valasz(404);
    if (!env.SZAMLALO_DB) return valasz(503, 'nincs tarolo');
    const ma = napBudapest(most());
    let tol = url.searchParams.get('tol'); let ig = url.searchParams.get('ig'); const nap = url.searchParams.get('nap');
    if (nap) { tol = nap; ig = nap; }
    if (!tol && !ig) { ig = ma; tol = napEltol(ma, -6); }
    ig = ig || tol; tol = tol || ig;
    if (!NAP.test(tol) || !NAP.test(ig) || tol > ig) return valasz(400, 'hibas datum (YYYY-MM-DD)');
    if (napEltol(tol, MAX_NAP) < ig) return valasz(400, 'legfeljebb ' + MAX_NAP + ' nap kerheto le');
    const [a, b] = await Promise.all([
      env.SZAMLALO_DB.prepare('SELECT nap, uzletag, lepes, tipus, db FROM lepes_szamlalo WHERE nap BETWEEN ?1 AND ?2 ORDER BY nap, uzletag, lepes, tipus').bind(tol, ig).all(),
      env.SZAMLALO_DB.prepare('SELECT nap, uzletag, vedro, db, ossz_ms, max_ms FROM betoltes_szamlalo WHERE nap BETWEEN ?1 AND ?2 ORDER BY nap, uzletag, vedro').bind(tol, ig).all(),
    ]);
    const kimenet = osszeallit(a.results || [], b.results || [], tol, ig);
    const fmt = (url.searchParams.get('formatum') || 'json').toLowerCase();
    if (fmt === 'csv') return valasz(200, csvbe(kimenet), { 'content-type': 'text/csv; charset=utf-8' });
    if (fmt === 'html') return valasz(200, htmlbe(kimenet), { 'content-type': 'text/html; charset=utf-8' });
    return valasz(200, JSON.stringify(kimenet, null, 1), { 'content-type': 'application/json; charset=utf-8' });
  }
  return valasz(405, null, { allow: 'GET, POST' });
}
