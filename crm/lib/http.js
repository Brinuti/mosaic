// HTTP-segedek a CRM API-hoz: egyseges JSON / HTML / fajl valasz, biztonsagi fejlecek, hiba-szerzodes, cookie, CSRF, korlatos torzs-olvasas,
// rate limit. Platformfuggetlen (Web Request/Response, Web Crypto); nincs env beegetve.
//
// Hiba-szerzodes (docs/oxigen-crm/API.md): { "hiba": { "kod": "TILTOTT", "uzenet": "..." } } + HTTP statusz.
// A crm/lib modulok CrmHiba-ja 400-as statuszt validacios hibakent dob; ezt itt 422-re kepezzuk (az ApiHiba ezt nem erinti).
import { CrmHiba, sha256, keszit, elso, most as maMost } from './db.js';

// ---- fejlecek -----------------------------------------------------------------------------------------------------------------------------
export const ALAP_FEJLECEK = Object.freeze({
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
});

/** a belso /crm oldal CSP-je (a _headers vagy a dev-szerver tegye ra); kulso script / tracking nincs */
export const CSP_CRM = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; "
  + "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
/** a publikus (vendeg) oldalak CSP-je: script egyaltalan nincs */
export const CSP_PUBLIKUS = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
/** JSON / fajl valaszokra: semmit nem szabad futtatni */
export const CSP_ADAT = "default-src 'none'; sandbox; frame-ancestors 'none'";

/** egy valasz biztonsagi fejlecei (mindig no-store, no-referrer, nosniff, DENY) - a mar beallitott fejlec nem irodik felul, kiveve a kotelezoeket */
export function fejlecRa(valasz, { csp = null, noindex = false } = {}) {
  let v = valasz;
  try { v.headers.set('X-Test', ''); v.headers.delete('X-Test'); } catch { v = new Response(valasz.body, valasz); }   // valtozhatatlan fejlec -> masolat
  for (const [k, ertek] of Object.entries(ALAP_FEJLECEK)) {
    v.headers.set(k, ertek);
  }
  if (csp) v.headers.set('Content-Security-Policy', csp);
  else if (!v.headers.has('Content-Security-Policy')) v.headers.set('Content-Security-Policy', CSP_ADAT);
  if (noindex) v.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return v;
}

// ---- valaszok -----------------------------------------------------------------------------------------------------------------------------
export function json(adat, status = 200, fejlecek = {}) {
  return fejlecRa(new Response(JSON.stringify(adat), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...fejlecek } }));
}
export function html(szoveg, status = 200, fejlecek = {}) {
  return fejlecRa(new Response(szoveg, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...fejlecek } }), { csp: CSP_PUBLIKUS, noindex: true });
}
export function szoveg(tartalom, tipus, status = 200, fejlecek = {}) {
  return fejlecRa(new Response(tartalom, { status, headers: { 'Content-Type': tipus, ...fejlecek } }));
}
/** tarolt fajl (kep / PDF) kiadasa: tipus a SZERVER allitja (nem a kliens), Content-Disposition + nosniff + no-store */
export function fajl(bajtok, mime, nev, { inline = true } = {}) {
  const biztonsagosNev = String(nev || 'fajl').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
  return fejlecRa(new Response(bajtok, { status: 200, headers: {
    'Content-Type': mime,
    'Content-Length': String(bajtok.length ?? bajtok.byteLength ?? 0),
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${biztonsagosNev}"`,
    'Cache-Control': 'no-store',
  } }));
}

/** API-hiba (a status VALTOZATLAN marad, a CrmHiba 400 -> 422 kepezes nem erinti) */
export class ApiHiba extends CrmHiba {
  constructor(kod, uzenet, status = 422, reszlet = null) { super(kod, uzenet, status, reszlet); this.name = 'ApiHiba'; }
}
export const nincsMeg = () => new ApiHiba('NINCS_TALALAT', 'Nincs ilyen elem.', 404);

const FELHASZNALOI_UZENET = {
  401: 'Nem vagy bejelentkezve.', 403: 'Ehhez nincs jogosultságod.', 404: 'Nincs ilyen elem.', 405: 'Ez a művelet itt nem engedélyezett.', 409: 'Az állapot ütközik a kéréssel.',
  413: 'A kérés túl nagy.', 415: 'Nem támogatott tartalomtípus.', 422: 'A megadott adatok nem megfelelők.', 429: 'Túl sok kérés, próbáld később.', 500: 'Belső hiba történt.', 501: 'Ez a funkció még nem érhető el.', 503: 'A szolgáltatás nem érhető el.',
};
/** hiba -> Response. A belso (nem CrmHiba) hiba reszletei NEM jutnak ki. */
export function hibaValasz(e, fejlecek = {}) {
  if (e instanceof CrmHiba) {
    const status = !(e instanceof ApiHiba) && e.status === 400 ? 422 : e.status || 500;
    const uzenet = e instanceof ApiHiba ? e.message : (e.status === 403 || status >= 500 ? (FELHASZNALOI_UZENET[status] || e.message) : e.message);
    const torzs = { hiba: { kod: e.kod, uzenet: uzenet || FELHASZNALOI_UZENET[status] || 'Hiba történt.' } };
    if (e.reszlet && status === 422) torzs.hiba.reszletek = e.reszlet;
    if (e.reszlet && status === 409 && Array.isArray(e.reszlet)) torzs.hiba.reszletek = e.reszlet;
    return json(torzs, status, fejlecek);
  }
  return json({ hiba: { kod: 'BELSO_HIBA', uzenet: FELHASZNALOI_UZENET[500] } }, 500, fejlecek);
}
export const hiba = (kod, uzenet, status = 422, reszlet = null) => hibaValasz(new ApiHiba(kod, uzenet, status, reszlet));

// ---- kerest-olvasas -----------------------------------------------------------------------------------------------------------------------
export const JSON_MAX = 64 * 1024;
/** korlatos torzs-olvasas (a Content-Length-re nem hagyatkozunk): tul nagy -> 413 */
export async function bajtokOlvas(request, max) {
  const hossz = Number(request.headers.get('content-length'));
  if (Number.isFinite(hossz) && hossz > max) throw new ApiHiba('TUL_NAGY', 'A kérés túl nagy.', 413);
  if (!request.body) return new Uint8Array(0);
  const olvaso = request.body.getReader();
  const darabok = [];
  let osszes = 0;
  for (;;) {
    const { done, value } = await olvaso.read();
    if (done) break;
    osszes += value.length;
    if (osszes > max) { try { await olvaso.cancel(); } catch { /* mar lezarult */ } throw new ApiHiba('TUL_NAGY', 'A kérés túl nagy.', 413); }
    darabok.push(value);
  }
  const ki = new Uint8Array(osszes);
  let poz = 0;
  for (const d of darabok) { ki.set(d, poz); poz += d.length; }
  return ki;
}
export const mediaTipus = (request) => String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

/** JSON torzs (objektum). Ures torzs = {} (ha nem kotelezo). Nem JSON content-type: 415. */
export async function jsonTorzs(request, { kotelezo = false } = {}) {
  const b = await bajtokOlvas(request, JSON_MAX);
  if (!b.length) { if (kotelezo) throw new ApiHiba('URES_TORZS', 'A kérés törzse hiányzik.', 422); return {}; }
  if (mediaTipus(request) !== 'application/json') throw new ApiHiba('NEM_JSON', 'A kérés tartalomtípusa application/json legyen.', 415);
  let o;
  try { o = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(b)); } catch { throw new ApiHiba('ROSSZ_JSON', 'A kérés törzse nem érvényes JSON.', 400); }
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new ApiHiba('ROSSZ_JSON', 'A kérés törzse JSON objektum legyen.', 422);
  return o;
}
/** HTML urlap (x-www-form-urlencoded) vagy JSON -> egyszeru objektum (tobbszoros mezo: tomb) */
export async function urlapVagyJson(request) {
  const t = mediaTipus(request);
  if (t === 'application/json') return jsonTorzs(request);
  if (t === 'application/x-www-form-urlencoded') {
    const b = await bajtokOlvas(request, JSON_MAX);
    const p = new URLSearchParams(new TextDecoder().decode(b));
    const o = {};
    for (const k of new Set(p.keys())) { const mind = p.getAll(k); o[k] = mind.length > 1 ? mind : mind[0]; }
    return o;
  }
  if (!request.body) return {};
  const b = await bajtokOlvas(request, 1024);
  if (!b.length) return {};
  throw new ApiHiba('NEM_TAMOGATOTT_TIPUS', 'Nem támogatott tartalomtípus.', 415);
}

// ---- validacio-segedek (422) -------------------------------------------------------------------------------------------------------------
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidE = (s) => typeof s === 'string' && UUID_RE.test(s);
export function szoveges(o, kulcs, { kotelezo = false, max = 500, min = 0 } = {}) {
  const v = o?.[kulcs];
  if (v === undefined || v === null || v === '') { if (kotelezo) throw new ApiHiba('HIANYZO_MEZO', `A(z) ${kulcs} mező kötelező.`, 422); return null; }
  if (typeof v !== 'string') throw new ApiHiba('ERVENYTELEN_MEZO', `A(z) ${kulcs} mező szöveg legyen.`, 422);
  if (v.length > max || v.trim().length < min) throw new ApiHiba('ERVENYTELEN_MEZO', `A(z) ${kulcs} mező hossza nem megfelelő.`, 422);
  return v;
}
export function egesz(o, kulcs, { kotelezo = false, min = -Infinity, max = Infinity } = {}) {
  const v = o?.[kulcs];
  if (v === undefined || v === null || v === '') { if (kotelezo) throw new ApiHiba('HIANYZO_MEZO', `A(z) ${kulcs} mező kötelező.`, 422); return null; }
  if (!Number.isInteger(v) || v < min || v > max) throw new ApiHiba('ERVENYTELEN_MEZO', `A(z) ${kulcs} mező egész szám legyen (${min}..${max}).`, 422);
  return v;
}
export function logikai(o, kulcs, { kotelezo = false } = {}) {
  const v = o?.[kulcs];
  if (v === undefined || v === null) { if (kotelezo) throw new ApiHiba('HIANYZO_MEZO', `A(z) ${kulcs} mező kötelező.`, 422); return null; }
  if (typeof v !== 'boolean') throw new ApiHiba('ERVENYTELEN_MEZO', `A(z) ${kulcs} mező igaz/hamis legyen.`, 422);
  return v;
}
export function valasztas(o, kulcs, lehetosegek, { kotelezo = true } = {}) {
  const v = o?.[kulcs];
  if (v === undefined || v === null || v === '') { if (kotelezo) throw new ApiHiba('HIANYZO_MEZO', `A(z) ${kulcs} mező kötelező.`, 422); return null; }
  if (!lehetosegek.includes(v)) throw new ApiHiba('ERVENYTELEN_MEZO', `A(z) ${kulcs} értéke: ${lehetosegek.join(' | ')}.`, 422);
  return v;
}
export function azonosito(o, kulcs, { kotelezo = true } = {}) {
  const v = o?.[kulcs];
  if (v === undefined || v === null || v === '') { if (kotelezo) throw new ApiHiba('HIANYZO_MEZO', `A(z) ${kulcs} mező kötelező.`, 422); return null; }
  if (!uuidE(v)) throw new ApiHiba('ERVENYTELEN_MEZO', `A(z) ${kulcs} mező azonosító legyen.`, 422);
  return v.toLowerCase();
}
/** 'YYYY-MM-DD' -> igaz, ha valos naptari nap */
export function napE(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// ---- cookie, kliens-cim, eredet --------------------------------------------------------------------------------------------------------
export const SESSION_COOKIE = 'crm_sess';
export function cookieOlvas(request, nev) {
  const fejlec = request.headers.get('cookie');
  if (!fejlec) return null;
  for (const resz of fejlec.split(';')) {
    const i = resz.indexOf('=');
    if (i < 0) continue;
    if (resz.slice(0, i).trim() === nev) { try { return decodeURIComponent(resz.slice(i + 1).trim()); } catch { return null; } }
  }
  return null;
}
/** Set-Cookie: HttpOnly, Secure, SameSite=Strict (a dev-szerver localhoston Secure nelkul: biztonságos=false) */
export function cookieIr(nev, ertek, { maxAge, biztonsagos = true, ut = '/api/crm' } = {}) {
  return `${nev}=${encodeURIComponent(ertek)}; Path=${ut}; HttpOnly; SameSite=Strict${biztonsagos ? '; Secure' : ''}; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
}
export function ujCookieFejlec(valasz, cookie) { valasz.headers.append('Set-Cookie', cookie); return valasz; }

export function kliensIp(request) {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() || null;
}
/** nyers IP helyett csak hash (naplo, rate limit) */
export const ipHashEnv = (request, env) => { const ip = kliensIp(request); return ip ? sha256(`${env?.CRM_SO || 'crm'}|ip|${ip}`) : Promise.resolve(null); };

/** a kerest hosztneve (kisbetus, port nelkul): az URL-bol ES a Host fejlecbol - mindket ertek ellenorzendo */
export function hosztok(request) {
  const ki = new Set();
  try { ki.add(new URL(request.url).hostname.toLowerCase().replace(/\.$/, '')); } catch { /* ervenytelen URL */ }
  const h = request.headers.get('host');
  if (h) ki.add(h.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, ''));
  return [...ki];
}
export const ELES_HOSZT_RE = /(^|\.)mosaicheadspa\.hu$/;
export const elesHosztE = (request) => hosztok(request).some((h) => ELES_HOSZT_RE.test(h));

/** azonos eredet: ha van Origin fejlec, annak eredete (scheme + host + port) egyezzen a kerelem eredetevel (login-CSRF / kulso oldalrol inditott POST ellen) */
export function azonosEredet(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;   // nem bongeszos kliens (vagy azonos eredetu GET); a sutis API-hoz a CSRF-token kulon kell
  if (origin === 'null') return false;
  try { return new URL(origin).origin.toLowerCase() === new URL(request.url).origin.toLowerCase(); } catch { return false; }
}
export const IRO_METODUSOK = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// ---- CSRF ---------------------------------------------------------------------------------------------------------------------------------
/** a CSRF-token a session-tokenbol szarmazik (SHA-256, kulon elotaggal): a bongeszo JS nem latja a HttpOnly sutit, a kliens a belepeskor kapja */
export const csrfTokenSessionbol = (sessionToken) => sha256(`csrf|${sessionToken}`);
/** allando idejű osszehasonlitas */
export function egyenlo(a, b) {
  const x = String(a ?? ''), y = String(b ?? '');
  let d = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) d |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return d === 0;
}

// ---- rate limit (rate_limit tabla, ablakos szamlalo) -------------------------------------------------------------------------------------
/** noveli a szamlalot; igaz, ha a hivas meg a korlaton belul van */
export async function limit(db, kulcs, { ablak, max }, now = maMost()) {
  const kezd = Math.floor(now / ablak) * ablak;
  await keszit(db, 'INSERT INTO rate_limit (key, window_start, count) VALUES (?1, ?2, 1) ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1', kulcs, kezd).run();
  const r = await elso(db, 'SELECT count FROM rate_limit WHERE key = ?1 AND window_start = ?2', kulcs, kezd);
  if (Math.random() < 0.01) await keszit(db, 'DELETE FROM rate_limit WHERE window_start < ?1', now - 2 * 86400).run();   // regi ablakok takaritasa
  return r.count <= max;
}
export async function limitVagyHiba(db, kulcs, szabaly, now) {
  if (!(await limit(db, kulcs, szabaly, now))) throw new ApiHiba('TUL_SOK_KERES', 'Túl sok kérés, próbáld meg később.', 429);
}

// ---- HTML escape (a publikus oldalak es a CSV is hasznalja) --------------------------------------------------------------------------
export const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]);
/** CSV-cella: idezojelezes + kepletinjekcio elleni elotag (=, +, -, @, tab, CR) */
export function csvCella(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
