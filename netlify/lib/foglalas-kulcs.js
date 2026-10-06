// Foglalas-kulcs es parositas (QA-1 folytatas, DECISION-LOG #97): a foglalo SAJAT booking_id-jenek (assets/js/booking-engine/booking-id.js) es a Salonic-foglalasnak
// (az ertesito e-mail / a Salonic UUID-ja) a PAROSITASA, hogy az e-mail-oldali (szerveroldali) esemeny ugyanazt az azonositot kapja, mint a bongeszos.
//
// KANONIKUS KULCS: `placeId|employeeId|startUnix` (startUnix = UTC unix masodperc; a Salonic Europe/Budapest idejebol). A serviceId csak ELLENORZO mezo.
//
// Ket oldal:
//   KOZONOOLDAL (sajat kod, nem GTM; assets/js/foglalas-kulcs.js) -> POST /api/foglalas-kulcs {booking_id, booking_url}: a bookingUrl-bol a szerver kepezi a kulcsot,
//       foglalas_kulcs(kulcs -> booking_id): egy kulcshoz EGY booking_id, FELULIRAS NELKUL, idempotens (ugyanaz ismet = nincs hatas, mas = utkozes, naplozva), 180 nap.
//   E-MAIL-OLDAL (a Salonic ertesito e-mailje) -> POST /api/foglalas-egyeztetes {uuid, host, ...}: a kulcsot a Salonic oldalairol kepezi (1. ag: a UUID-bol a
//       "Foglalas megtekintese" oldal startDate-je + a "Foglalas modositasa" oldal placeId / employeeId / serviceId-je), ha az nem megy: 2. ag: nevfordito tabla
//       (felado -> placeId, munkatars -> employeeId, szolgaltatas -> serviceId) + a levelbol az idopont (JSON-LD startDate, vagy a szoveg: az ev a level datuma alapjan, elorefele).
//       Ujraprobalas: 1, 3, 10, 30 perc; ezutan "parositatlan" + riaszas. Egy foglalasbol csak EGY esemeny: a kuldheto=true csak egyszer (UUID-nkent es booking_id-nkent is).
//
// A tarolt adat: kulcs (szamok), booking_id (veletlen), serviceId, a Salonic UUID. Szemelyes adat (nev, e-mail, telefon) NINCS.

import { BUSINESSES } from '../../assets/js/booking-engine/salonic-adapter.js';

export const MEGORZES_NAP = 180;
export const UJRAPROBA_MP = Object.freeze([60, 180, 600, 1800]); // az 1., 3., 10., 30. perc
export const ID_MINTA = /^mb_[a-z0-9]{12,40}$/;
export const UUID_MINTA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMEZONE = 'Europe/Budapest';
const KEZDES_MIN = 1_000_000_000, KEZDES_MAX = 4_000_000_000;
const NAPI_IRAS_PLAFON = 5000; // egy kamu forgalom se tehesse tonkre a tablat

/** A Salonic-hostok (a BUSINESSES-bol): host -> placeId. Mas hostra a szerver nem kerdez (SSRF), mas hostrol jovo bookingUrl-t nem fogad el. */
export const HOSTOK = Object.freeze(Object.fromEntries(Object.entries(BUSINESSES).map(([uzletag, c]) => [new URL(c.host).hostname, { placeId: c.placeId, uzletag }])));

// --- kulcs ---------------------------------------------------------------------------------------------------------------------------
const pozitiv = (v) => Number.isInteger(v) && v > 0;
/** `placeId|employeeId|startUnix`; null, ha valamelyik nem ervenyes (a -1 = "barmelyik szakember" nem konkret szakember: nem kulcs). */
export function kulcsKepez(placeId, employeeId, startUnix) {
  if (!pozitiv(placeId) || !pozitiv(employeeId) || !Number.isInteger(startUnix) || startUnix < KEZDES_MIN || startUnix > KEZDES_MAX) return null;
  return `${placeId}|${employeeId}|${startUnix}`;
}

/**
 * A Salonic atiranyitasanak bookingUrl-je (a kanonikus /guestData/ cim) -> { ok, host, uzletag, placeId, employeeId, serviceId, startUnix, kulcs, bookingId }.
 * A bookingId a "back" parameterbol (a foglalo sajat azonositoja; csak ervenyes alakban). A host a Salonic-hostok listajabol, a placeId a hosthoz tartozo kell legyen.
 */
export function bookingUrlElemzes(bookingUrl) {
  let u;
  try { u = new URL(String(bookingUrl)); } catch (e) { return { ok: false, miert: 'nem URL' }; }
  const hely = HOSTOK[u.hostname];
  if (u.protocol !== 'https:' || !hely) return { ok: false, miert: 'ismeretlen host' };
  if (!/^\/guestData\/?$/.test(u.pathname)) return { ok: false, miert: 'nem /guestData/ cim' };
  const q = u.searchParams;
  const szam = (k) => (/^\d{1,12}$/.test(q.get(k) || '') ? Number(q.get(k)) : null);
  const placeId = szam('placeId'), employeeId = szam('employeeId'), startUnix = szam('startDate'), serviceId = /^\d{1,12}$/.test(q.get('serviceId') || '') ? q.get('serviceId') : null;
  if (placeId !== hely.placeId) return { ok: false, miert: 'a placeId nem a hosthoz tartozik' };
  if (!employeeId) return { ok: false, miert: 'nincs konkret employeeId' };
  if (!serviceId) return { ok: false, miert: 'nincs serviceId' };
  const kulcs = kulcsKepez(placeId, employeeId, startUnix);
  if (!kulcs) return { ok: false, miert: 'ervenytelen kulcs-mezo (startDate)' };
  const back = q.get('back');
  return { ok: true, host: u.hostname, uzletag: hely.uzletag, placeId, employeeId, serviceId, startUnix, kulcs, bookingId: ID_MINTA.test(back || '') ? back : null };
}

// --- idopont (magyar szoveg / ISO) -> unix ---------------------------------------------------------------------------------------------
const HONAPOK = { 'január': 1, 'február': 2, 'március': 3, 'április': 4, 'május': 5, 'június': 6, 'július': 7, 'augusztus': 8, 'szeptember': 9, 'október': 10, 'november': 11, 'december': 12 };
const NAPNEVEK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

/** A budapesti helyi ido (ev, ho, nap, ora, perc) -> UTC unix masodperc (a nyari / teli idoszamitas az Intl-bol). */
export function budapestUnix(ev, ho, nap, ora, perc) {
  const ugy = Date.UTC(ev, ho - 1, nap, ora, perc); // "mintha UTC lenne"
  const eltolas = (ms) => { // a Budapest-UTC kulonbseg az adott pillanatban, ms-ben
    const r = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    return Date.UTC(+r.year, +r.month - 1, +r.day, +r.hour, +r.minute, +r.second) - ms;
  };
  const elso = ugy - eltolas(ugy);
  return Math.round((ugy - eltolas(elso)) / 1000);
}
/** Az "Október 20. (kedd) 18:00 - 18:30" szoveg -> { ho, nap, hetnap, ora, perc } | null. */
export function idopontSzovegElemzes(szoveg) {
  const m = String(szoveg || '').replace(/\s+/g, ' ').match(/([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]+)\s+(\d{1,2})\.\s*(?:\(([^)]+)\))?\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const ho = HONAPOK[m[1].toLowerCase()];
  if (!ho) return null;
  return { ho, nap: +m[2], hetnap: m[3] ? m[3].toLowerCase() : null, ora: +m[4], perc: +m[5] };
}
/**
 * Az idopont-szovegbol unix: az EV a level datuma alapjan, ELOREFELE (a foglalas idopontja nem lehet a level elotti): a level evetol kezdve az elso ev, ahol az idopont nem
 * a level elotti (1 oras tureshataral) ES a hetnap neve egyezik (ha van). null, ha nincs ilyen az elkovetkezo 3 evben.
 */
export function evKovetkeztet(szovegAdat, leveluUnix) {
  if (!szovegAdat) return null;
  const kezdoEv = new Date(leveluUnix * 1000).getUTCFullYear();
  for (let ev = kezdoEv; ev <= kezdoEv + 3; ev++) {
    const d = new Date(Date.UTC(ev, szovegAdat.ho - 1, szovegAdat.nap));
    if (d.getUTCMonth() !== szovegAdat.ho - 1) continue; // pl. feb. 30.
    if (szovegAdat.hetnap && NAPNEVEK[d.getUTCDay()] !== szovegAdat.hetnap) continue;
    const unix = budapestUnix(ev, szovegAdat.ho, szovegAdat.nap, szovegAdat.ora, szovegAdat.perc);
    if (unix >= leveluUnix - 3600) return unix;
  }
  return null;
}
/** ISO idopont (idozona-eltolassal, pl. 2026-10-20T18:00:00+02:00) -> unix | null. */
export const isoUnix = (s) => { const t = Date.parse(String(s || '')); return /[+-]\d{2}:?\d{2}$|Z$/.test(String(s || '')) && Number.isFinite(t) ? Math.round(t / 1000) : null; };

// --- Salonic-oldalak (1. ag) ----------------------------------------------------------------------------------------------------------------
/** A "Foglalas megtekintese" oldal (/booking/bookingDetails/<uuid>) -> { allapot, startUnix, modositasUrl }. Csak a startDate (a "Foglalas modositasa" link) van meg rajta, az azonositok nem. */
export function reszletekOldalElemzes(html) {
  const h = String(html || '');
  const m = h.match(/href="(\/selectDate\/\?startDate=(\d{9,11})&(?:amp;)?bookingId=([0-9a-f-]{36}))"/);
  const allapot = /Visszaigazolt/.test(h) ? 'visszaigazolt' : /Id[oő]pont t[oö]r[oö]lve|t[oö]r[oö]lve/i.test(h) ? 'torolve' : null;
  return { allapot, startUnix: m ? Number(m[2]) : null, uuid: m ? m[3] : null, modositasUrl: m ? m[1].replace(/&amp;/g, '&') : null };
}
/** A "Foglalas modositasa" oldal (/selectDate/?startDate=..&bookingId=..) naptar-beallitasa -> { placeId, serviceId, employeeId }: a Salonic itt adja a foglalas azonositoit. */
export function modositasOldalElemzes(html) {
  const h = String(html || '');
  const fogd = (re) => { const m = h.match(re); return m ? m[1] : null; };
  const placeId = fogd(/\bplaceId:\s*(\d+)/), employeeId = fogd(/\bemployeeId:\s*(\d+)/), serviceId = fogd(/\bserviceId:\s*'(\d+)'/);
  return { placeId: placeId ? Number(placeId) : null, employeeId: employeeId ? Number(employeeId) : null, serviceId };
}

async function lekerSzoveg(fetchImpl, url, ms = 8000) {
  const ab = new AbortController(); const t = setTimeout(() => ab.abort(), ms);
  try {
    const r = await fetchImpl(url, { redirect: 'follow', signal: ab.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; MosaicFoglalasKulcs/1.0)', accept: 'text/html' } });
    return { status: r.status, url: r.url || url, szoveg: r.ok ? await r.text() : '' };
  } finally { clearTimeout(t); }
}
/**
 * 1. AG: a Salonic UUID-bol a kulcs: GET /booking/bookingDetails/<uuid> (startDate) + GET /selectDate/?startDate=..&bookingId=<uuid> (placeId, employeeId, serviceId).
 * Csak olvasas (GET), a foglalason semmi nem valtozik. Csak a Salonic-hostok (HOSTOK) kerdezhetok.
 */
export async function salonicOldalKulcs({ host, uuid, fetchImpl }) {
  const hely = HOSTOK[host];
  if (!hely) return { ok: false, miert: 'ismeretlen host' };
  if (!UUID_MINTA.test(String(uuid))) return { ok: false, miert: 'ervenytelen uuid' };
  const lepesek = [];
  try {
    const r1 = await lekerSzoveg(fetchImpl, `https://${host}/booking/bookingDetails/${uuid}`);
    lepesek.push({ url: `/booking/bookingDetails/${uuid}`, status: r1.status, vegso: String(r1.url).replace(/^https:\/\/[^/]+/, '').slice(0, 80) });
    const reszletek = reszletekOldalElemzes(r1.szoveg);
    if (!reszletek.startUnix || reszletek.uuid !== uuid) return { ok: false, miert: reszletek.allapot === 'torolve' ? 'a foglalas torolve' : 'a megtekintes oldalon nincs startDate', lepesek };
    const r2 = await lekerSzoveg(fetchImpl, `https://${host}${reszletek.modositasUrl}`);
    lepesek.push({ url: reszletek.modositasUrl, status: r2.status, vegso: String(r2.url).replace(/^https:\/\/[^/]+/, '').slice(0, 80) });
    const m = modositasOldalElemzes(r2.szoveg);
    if (m.placeId !== hely.placeId) return { ok: false, miert: 'a modositas oldalon nincs (vagy mas) placeId', lepesek };
    const kulcs = kulcsKepez(m.placeId, m.employeeId, reszletek.startUnix);
    if (!kulcs || !m.serviceId) return { ok: false, miert: 'a modositas oldalon nincs employeeId / serviceId', lepesek };
    return { ok: true, kulcs, placeId: m.placeId, employeeId: m.employeeId, serviceId: m.serviceId, startUnix: reszletek.startUnix, lepesek };
  } catch (e) { return { ok: false, miert: 'lekeres-hiba: ' + String(e && e.message || e).slice(0, 80), lepesek }; }
}

// --- e-mail (a Salonic ertesito levele) ----------------------------------------------------------------------------------------------------
const entitas = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
/**
 * A Salonic "Uj idopont letrehozva" e-mail releváns mezoi (a HTML-bol; csak a sablon fix elemeit olvassa):
 *   uuid + host (a "Foglalas reszletek" / "Lemondom" linkbol), felado (az elso <h2>), szolgaltatas + idopontSzoveg (a szurke doboz), munkatarsak (a "Munkatarsak" resz),
 *   ld (a schema.org JSON-LD: startDate idozona-eltolassal, reservationNumber, szolgaltatas-nev, helynev).
 * A levelben NINCS placeId / serviceId / employeeId.
 */
export function emailElemzes(html) {
  const h = String(html || '');
  const link = h.match(/https:\/\/([a-z0-9-]+\.salonic\.hu)\/booking\/(?:bookingDetails|cancelBooking)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
  const felado = (h.match(/<h2>([^<]+)<\/h2>\s*<\/div>/) || [])[1];
  const doboz = h.match(/padding: 20px; width: 90%;border-radius: 5px">\s*<h2>([^<]+)<\/h2>\s*([^<]*?)\s*<br/);
  const reszek = h.split(/Munkatársak<\/h3>/)[1];
  const munkatarsak = [];
  if (reszek) {
    const terulet = reszek.split(/class="btn btn-primary"/)[0];
    for (const m of terulet.matchAll(/<img[^>]*>\s*<\/div>\s*<div[^>]*>([^<]+)<\/div>/g)) munkatarsak.push(entitas(m[1]));
  }
  let ld = null;
  const j = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (j) { try { const o = JSON.parse(j[1]); ld = { startDate: o.reservationFor && o.reservationFor.startDate || null, reservationNumber: o.reservationNumber || null, szolgaltatas: o.reservationFor && o.reservationFor.name || null, hely: o.reservationFor && o.reservationFor.location && o.reservationFor.location.name || null }; } catch (e) { ld = null; } }
  return { uuid: link ? link[2] : null, host: link ? link[1] : null, felado: felado ? entitas(felado) : null, szolgaltatas: doboz ? entitas(doboz[1]) : null, idopontSzoveg: doboz ? entitas(doboz[2]) : null, munkatarsak, ld };
}

// --- nevfordito tabla (2. ag) --------------------------------------------------------------------------------------------------------------
/** Nevegyeztetesre: kisbetu, ekezet / emoji / irasjel nelkul, egy szokozzel. */
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
/** A munkatars neve a kedvezmeny-cimke nelkul ("Noel - 20% kedvezmeny!" -> "Noel"). */
export const munkatarsAlap = (s) => String(s || '').replace(/\s*-\s*\d{1,2}\s*%\s*kedvezm.*$/i, '').trim();

/**
 * Nevtabla: { frissitve (unix), helyek: [{placeId, nev}], munkatarsak: [{placeId, employeeId, nev}], szolgaltatasok: [{placeId, serviceId, nev}] }.
 * Az e-mail adataibol a kulcs-jeloltek: felado -> placeId, munkatars -> employeeId, szolgaltatas -> serviceId (csak ellenorzo), idopont -> unix.
 */
export function emailKulcsNevtablabol(mezok, tabla, leveluUnix) {
  const nyom = { felado: mezok.felado || null, szolgaltatas: mezok.szolgaltatas || null, munkatarsak: mezok.munkatarsak || [], idopontSzoveg: mezok.idopontSzoveg || null };
  if (!tabla || !tabla.helyek || !tabla.helyek.length) return { ok: false, miert: 'nincs nevtabla', nyom };
  const hely = tabla.helyek.filter((x) => norm(x.nev) === norm(mezok.felado));
  if (hely.length !== 1) return { ok: false, miert: hely.length ? 'a felado tobb helyre illik' : 'ismeretlen felado: ' + mezok.felado, nyom };
  const placeId = hely[0].placeId;
  // idopont: a JSON-LD (idozonaval) az elsodleges, a szoveg a tartalek (ev a level datuma alapjan, elorefele)
  const ldUnix = isoUnix(mezok.ld && mezok.ld.startDate);
  const szovegUnix = evKovetkeztet(idopontSzovegElemzes(mezok.idopontSzoveg), leveluUnix);
  const startUnix = ldUnix || szovegUnix;
  if (!startUnix) return { ok: false, miert: 'az idopont nem allapithato meg', nyom };
  nyom.idopontForras = ldUnix ? 'ld+json' : 'szoveg'; nyom.startUnix = startUnix; nyom.ldUnix = ldUnix; nyom.szovegUnix = szovegUnix;
  if (ldUnix && szovegUnix && ldUnix !== szovegUnix) nyom.idopontElteres = true;
  const jeloltek = [];
  for (const nev of mezok.munkatarsak || []) {
    const alap = norm(munkatarsAlap(nev));
    for (const t of tabla.munkatarsak.filter((x) => x.placeId === placeId && (norm(x.nev) === norm(nev) || norm(munkatarsAlap(x.nev)) === alap))) if (!jeloltek.includes(t.employeeId)) jeloltek.push(t.employeeId);
  }
  if (!jeloltek.length) return { ok: false, miert: 'ismeretlen munkatars: ' + (mezok.munkatarsak || []).join(', '), nyom };
  const szolg = tabla.szolgaltatasok.filter((x) => x.placeId === placeId && norm(x.nev) === norm(mezok.szolgaltatas));
  const serviceIds = [...new Set(szolg.map((x) => x.serviceId))];
  nyom.jeloltEmployeeIds = jeloltek; nyom.serviceIds = serviceIds;
  return { ok: true, kulcsok: jeloltek.map((e) => kulcsKepez(placeId, e, startUnix)).filter(Boolean), placeId, serviceId: serviceIds.length === 1 ? serviceIds[0] : null, serviceIds, startUnix, nyom };
}

// --- tarolas (Cloudflare D1) -----------------------------------------------------------------------------------------------------------------
const SEMA = [
  'CREATE TABLE IF NOT EXISTS foglalas_kulcs (kulcs TEXT PRIMARY KEY, booking_id TEXT NOT NULL, service_id TEXT NOT NULL, forras TEXT NOT NULL, letrehozva INTEGER NOT NULL, lejar INTEGER NOT NULL) WITHOUT ROWID',
  'CREATE INDEX IF NOT EXISTS foglalas_kulcs_lejar ON foglalas_kulcs (lejar)',
  'CREATE TABLE IF NOT EXISTS foglalas_kulcs_utkozes (id INTEGER PRIMARY KEY AUTOINCREMENT, kulcs TEXT NOT NULL, booking_id_elso TEXT NOT NULL, booking_id_uj TEXT NOT NULL, ido INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS foglalas_egyeztetes (uuid TEXT PRIMARY KEY, allapot TEXT NOT NULL, probalkozas INTEGER NOT NULL DEFAULT 0, kovetkezo INTEGER, kulcs TEXT, kulcs_forras TEXT, service_id TEXT, booking_id TEXT, kuldve INTEGER, riasztas INTEGER NOT NULL DEFAULT 0, letrehozva INTEGER NOT NULL, frissitve INTEGER NOT NULL) WITHOUT ROWID',
  'CREATE UNIQUE INDEX IF NOT EXISTS foglalas_egyeztetes_booking ON foglalas_egyeztetes (booking_id) WHERE kuldve IS NOT NULL',
  'CREATE TABLE IF NOT EXISTS salonic_nevtabla (tipus TEXT NOT NULL, place_id INTEGER NOT NULL, id TEXT NOT NULL, nev TEXT NOT NULL, frissitve INTEGER NOT NULL, PRIMARY KEY (tipus, place_id, id)) WITHOUT ROWID',
];
const kesz = new WeakSet();
/** A tablak letrehozasa (IF NOT EXISTS), adatbazisonkent egyszer. */
export async function sema(db) {
  if (kesz.has(db)) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  kesz.add(db);
}
const sec = (now) => Math.floor(now / 1000);

/**
 * KOZONOOLDAL: a kulcs -> booking_id iras. Egy kulcshoz egy booking_id, FELULIRAS NELKUL; ugyanaz ismet = idempotens; mas = utkozes (naplozva, nem ir felul).
 * -> { ok, irva, idempotens, utkozes, kulcs, serviceId, miert? }
 */
export async function kulcsIras(db, { bookingId, bookingUrl, forras = 'back' }, now = Date.now()) {
  if (!ID_MINTA.test(String(bookingId))) return { ok: false, miert: 'ervenytelen booking_id' };
  const e = bookingUrlElemzes(bookingUrl);
  if (!e.ok) return { ok: false, miert: e.miert };
  if (e.bookingId && e.bookingId !== bookingId) return { ok: false, miert: 'a bookingUrl back-je mas azonosito' };
  await sema(db);
  const t = sec(now);
  const mai = await db.prepare('SELECT COUNT(*) AS n FROM foglalas_kulcs WHERE letrehozva > ?1').bind(t - 86400).first();
  if (mai && mai.n >= NAPI_IRAS_PLAFON) return { ok: false, miert: 'napi plafon' };
  await db.prepare('DELETE FROM foglalas_kulcs WHERE lejar < ?1').bind(t).run(); // lejart (180 napnal regebbi) bejegyzesek
  const r = await db.prepare('INSERT INTO foglalas_kulcs (kulcs, booking_id, service_id, forras, letrehozva, lejar) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(kulcs) DO NOTHING')
    .bind(e.kulcs, bookingId, e.serviceId, forras, t, t + MEGORZES_NAP * 86400).run();
  if (r.meta && r.meta.changes > 0) return { ok: true, irva: true, idempotens: false, utkozes: false, kulcs: e.kulcs, serviceId: e.serviceId };
  const sor = await db.prepare('SELECT booking_id FROM foglalas_kulcs WHERE kulcs = ?1').bind(e.kulcs).first();
  if (sor && sor.booking_id === bookingId) return { ok: true, irva: false, idempotens: true, utkozes: false, kulcs: e.kulcs, serviceId: e.serviceId };
  await db.prepare('INSERT INTO foglalas_kulcs_utkozes (kulcs, booking_id_elso, booking_id_uj, ido) VALUES (?1, ?2, ?3, ?4)').bind(e.kulcs, sor ? sor.booking_id : '?', bookingId, t).run();
  return { ok: true, irva: false, idempotens: false, utkozes: true, kulcs: e.kulcs, serviceId: e.serviceId, meglevoBookingId: sor ? sor.booking_id : null };
}
/** Egy kulcs rekordja (a lejartat nem adja vissza). */
export async function kulcsKeres(db, kulcs, now = Date.now()) {
  await sema(db);
  return (await db.prepare('SELECT kulcs, booking_id, service_id, forras, letrehozva, lejar FROM foglalas_kulcs WHERE kulcs = ?1 AND lejar >= ?2').bind(kulcs, sec(now)).first()) || null;
}

/** A nevtabla betoltese a D1-bol (2. ag). */
export async function nevtablaBetolt(db) {
  await sema(db);
  const { results } = await db.prepare('SELECT tipus, place_id, id, nev, frissitve FROM salonic_nevtabla').all();
  const t = { frissitve: 0, helyek: [], munkatarsak: [], szolgaltatasok: [] };
  for (const r of results || []) {
    t.frissitve = Math.max(t.frissitve, r.frissitve);
    if (r.tipus === 'hely') t.helyek.push({ placeId: r.place_id, nev: r.nev });
    else if (r.tipus === 'munkatars') t.munkatarsak.push({ placeId: r.place_id, employeeId: Number(r.id), nev: r.nev });
    else if (r.tipus === 'szolgaltatas') t.szolgaltatasok.push({ placeId: r.place_id, serviceId: r.id, nev: r.nev });
  }
  return t;
}
/** A nevtabla teljes cseréje (napi frissites): a tabla = a Salonic mostani allapota + a korabbi nevek (a mar nem listazott munkatars neve nem tunik el egyik naprol a masikra). */
export async function nevtablaMent(db, tabla, now = Date.now()) {
  await sema(db);
  const t = sec(now);
  const sorok = [];
  for (const x of tabla.helyek) sorok.push(['hely', x.placeId, String(x.placeId) + ':' + norm(x.nev), x.nev]);
  for (const x of tabla.munkatarsak) sorok.push(['munkatars', x.placeId, String(x.employeeId), x.nev]);
  for (const x of tabla.szolgaltatasok) sorok.push(['szolgaltatas', x.placeId, String(x.serviceId), x.nev]);
  const stmts = sorok.map(([tipus, p, id, nev]) => db.prepare('INSERT INTO salonic_nevtabla (tipus, place_id, id, nev, frissitve) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(tipus, place_id, id) DO UPDATE SET nev = excluded.nev, frissitve = excluded.frissitve').bind(tipus, p, id, nev, t));
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return sorok.length;
}
const NEVTABLA_MAX_KOR = 24 * 3600;

/** A nevtabla a Salonic-fiokokbol: hely-nev (a fiok neve), munkatars (a /employees/ oldal; ahol nincs: a naptar-API nevei), szolgaltatas (a Salonic-lista). */
export async function nevtablaSalonicbol({ fetchImpl, adapterGyar, uzletagok = Object.keys(BUSINESSES) }) {
  const tabla = { helyek: [], munkatarsak: [], szolgaltatasok: [] };
  const adapter = adapterGyar({ fetchImpl });
  for (const uzletag of uzletagok) {
    const c = BUSINESSES[uzletag];
    try {
      const o = await lekerSzoveg(fetchImpl, `${c.host}/employees/?placeId=${c.placeId}`);
      const cim = (o.szoveg.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
      const nevek = new Set();
      for (const m of o.szoveg.matchAll(/<a[^>]*href="\/employees\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) { const nev = entitas(m[2].replace(/<[^>]+>/g, ' ')); if (nev) { tabla.munkatarsak.push({ placeId: c.placeId, employeeId: Number(m[1]), nev }); nevek.add(m[1]); } }
      // a fiok neve: a naptar-API helyneve (a levelben a felado ez), tartalekban az oldal cime
      let helyNev = null;
      try { const p = await adapter.getPlace(uzletag); helyNev = p && p.name; } catch (e) { /* tartalek */ }
      for (const n of new Set([helyNev, cim && entitas(cim)].filter(Boolean))) tabla.helyek.push({ placeId: c.placeId, nev: n });
      if (!nevek.size) { // nincs munkatars-oldal (pl. HeadSpa, Elysion): a naptar-API nevei
        try {
          const szolgak = await adapter.getServices(uzletag);
          const nevek2 = new Map();
          for (const s of szolgak.slice(0, 3)) for (const x of await adapter.getStaff(uzletag, s.serviceId, { days: 30 })) if (x.staff_label) nevek2.set(Number(x.staff_id), x.staff_label);
          for (const [employeeId, nev] of nevek2) tabla.munkatarsak.push({ placeId: c.placeId, employeeId, nev });
        } catch (e) { /* ennek a fioknak nincs munkatars-neve */ }
      }
      for (const s of await adapter.getServices(uzletag)) tabla.szolgaltatasok.push({ placeId: c.placeId, serviceId: String(s.serviceId), nev: s.name });
    } catch (e) { /* egy fiok hibaja nem allitja meg a tobbit */ }
  }
  return tabla;
}

// --- parositas (e-mail-oldal) ------------------------------------------------------------------------------------------------------------------
/**
 * Az e-mail-oldal egy keresese. mezok: { uuid, host, felado, szolgaltatas, idopontSzoveg, munkatarsak[], ld, leveldatum (ISO) }.
 * deps: { fetchImpl, nevtablaFrissito? (async () => tabla), now }.
 * -> { allapot: 'parositott' | 'fuggoben' | 'parositatlan' | 'ellentmondas', kuldheto, duplikalt, booking_id, esemeny_id, kulcs, kulcs_forras, service_egyezik, probalkozas,
 *      ujraprobal_mp, riasztas, nyom }
 * Egy foglalasbol EGY esemeny: kuldheto csak az ELSO sikeres parositasnal igaz (a Salonic UUID-ra es a booking_id-ra is egyszer); minden tovabbi keres kuldheto=false, duplikalt=true.
 */
export async function egyeztet(db, mezok, deps) {
  const now = deps.now ? deps.now() : Date.now();
  const t = sec(now);
  if (!UUID_MINTA.test(String(mezok.uuid))) return { allapot: 'ervenytelen', miert: 'ervenytelen uuid' };
  await sema(db);
  let sor = await db.prepare('SELECT * FROM foglalas_egyeztetes WHERE uuid = ?1').bind(mezok.uuid).first();
  const nyom = { uuid: mezok.uuid, host: mezok.host || null };
  if (sor && sor.kuldve) return { allapot: 'parositott', kuldheto: false, duplikalt: true, booking_id: sor.booking_id, esemeny_id: sor.booking_id, kulcs: sor.kulcs, kulcs_forras: sor.kulcs_forras, probalkozas: sor.probalkozas, riasztas: false, nyom };
  if (sor && sor.allapot === 'fuggoben' && sor.kovetkezo && t < sor.kovetkezo) return { allapot: 'fuggoben', kuldheto: false, probalkozas: sor.probalkozas, ujraprobal_mp: sor.kovetkezo - t, riasztas: false, korai: true, nyom };
  if (!sor) {
    await db.prepare('INSERT INTO foglalas_egyeztetes (uuid, allapot, probalkozas, letrehozva, frissitve) VALUES (?1, ?2, 0, ?3, ?3) ON CONFLICT(uuid) DO NOTHING').bind(mezok.uuid, 'fuggoben', t).run();
    sor = await db.prepare('SELECT * FROM foglalas_egyeztetes WHERE uuid = ?1').bind(mezok.uuid).first();
  }
  const probalkozas = (sor.probalkozas || 0) + 1;

  // kulcs-jeloltek: 1. ag (Salonic-oldalak), ha nem megy: 2. ag (nevtabla)
  let jeloltek = [], kulcsForras = null, serviceId = null, ellenorzoServiceIds = null;
  const o1 = await salonicOldalKulcs({ host: mezok.host, uuid: mezok.uuid, fetchImpl: deps.fetchImpl });
  nyom.ag1 = { ok: o1.ok, miert: o1.miert || null, lepesek: o1.lepesek || [], kulcs: o1.kulcs || null, serviceId: o1.serviceId || null };
  const ag2Szamol = async () => {
    let tabla = await nevtablaBetolt(db);
    if (deps.nevtablaFrissito && (!tabla.frissitve || t - tabla.frissitve > NEVTABLA_MAX_KOR)) { try { const uj = await deps.nevtablaFrissito(); if (uj) { await nevtablaMent(db, uj, now); tabla = await nevtablaBetolt(db); } } catch (e) { /* a regi tabla marad */ } }
    const leveluUnix = mezok.leveldatum ? Math.round(Date.parse(mezok.leveldatum) / 1000) || t : t;
    const o2 = emailKulcsNevtablabol(mezok, tabla, leveluUnix);
    nyom.ag2 = { ok: o2.ok, miert: o2.miert || null, ...o2.nyom, kulcsok: o2.kulcsok || [], serviceId: o2.serviceId || null };
    return o2;
  };
  if (o1.ok) {
    jeloltek = [o1.kulcs]; kulcsForras = 'salonic-oldal'; serviceId = o1.serviceId;
    if (mezok.diagnosztika) { const o2 = await ag2Szamol(); nyom.ag2.egyezik_az_ag1_el = !!(o2.ok && o2.kulcsok.includes(o1.kulcs)); } // csak a nyomhoz: a dontes az 1. agon marad
  } else {
    const o2 = await ag2Szamol();
    if (o2.ok) { jeloltek = o2.kulcsok; kulcsForras = 'nevtabla'; serviceId = o2.serviceId; ellenorzoServiceIds = o2.serviceIds; }
  }
  nyom.jeloltKulcsok = jeloltek; nyom.kulcsForras = kulcsForras;

  const talalatok = [];
  for (const k of jeloltek) { const r = await kulcsKeres(db, k, now); if (r) talalatok.push(r); }
  nyom.talalatok = talalatok.map((r) => ({ kulcs: r.kulcs, booking_id: r.booking_id, service_id: r.service_id, forras: r.forras }));

  if (talalatok.length > 1 && new Set(talalatok.map((r) => r.booking_id)).size > 1) {
    await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs_forras = ?4, riasztas = 1, frissitve = ?5 WHERE uuid = ?1').bind(mezok.uuid, 'ellentmondas', probalkozas, kulcsForras, t).run();
    return { allapot: 'ellentmondas', kuldheto: false, riasztas: true, probalkozas, miert: 'tobb kulcs-jelolt, kulonbozo booking_id', nyom };
  }
  if (talalatok.length) {
    const r = talalatok[0];
    const serviceEgyezik = serviceId ? r.service_id === serviceId : (ellenorzoServiceIds && ellenorzoServiceIds.length ? ellenorzoServiceIds.includes(r.service_id) : null);
    if (serviceEgyezik === false) { // a kulcs egyezik, a szolgaltatas nem: ellentmondas (kulcs-utkozes gyanu), nem kuldunk
      await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs = ?4, kulcs_forras = ?5, service_id = ?6, riasztas = 1, frissitve = ?7 WHERE uuid = ?1').bind(mezok.uuid, 'ellentmondas', probalkozas, r.kulcs, kulcsForras, serviceId, t).run();
      return { allapot: 'ellentmondas', kuldheto: false, riasztas: true, probalkozas, miert: 'a serviceId nem egyezik', service_egyezik: false, kulcs: r.kulcs, nyom };
    }
    // egy foglalasbol egy esemeny: a kuldve-t csak az elso keres allitja be (a booking_id-ra egyedi index: mas UUID sem kuldhet ugyanarra)
    let kuldheto = false;
    try {
      const u = await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs = ?4, kulcs_forras = ?5, service_id = ?6, booking_id = ?7, kuldve = ?8, riasztas = 0, kovetkezo = NULL, frissitve = ?8 WHERE uuid = ?1 AND kuldve IS NULL')
        .bind(mezok.uuid, 'parositott', probalkozas, r.kulcs, kulcsForras, r.service_id, r.booking_id, t).run();
      kuldheto = !!(u.meta && u.meta.changes > 0);
    } catch (e) { kuldheto = false; nyom.egyediIndex = 'a booking_id-ra mar ment esemeny (mas UUID-rol)'; }
    return { allapot: 'parositott', kuldheto, duplikalt: !kuldheto, booking_id: r.booking_id, esemeny_id: r.booking_id, kulcs: r.kulcs, kulcs_forras: kulcsForras, service_egyezik: serviceEgyezik, probalkozas, riasztas: false, keses: sor.allapot === 'parositatlan', nyom };
  }
  // nincs talalat: ujraprobalas 1, 3, 10, 30 perc; az 5. keres (1 azonnali + 4 ujra) utan parositatlan + riasztas
  const ujra = UJRAPROBA_MP[probalkozas - 1];
  if (ujra === undefined) {
    await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs = ?4, kulcs_forras = ?5, kovetkezo = NULL, riasztas = 1, frissitve = ?6 WHERE uuid = ?1').bind(mezok.uuid, 'parositatlan', probalkozas, jeloltek[0] || null, kulcsForras, t).run();
    return { allapot: 'parositatlan', kuldheto: false, riasztas: true, probalkozas, kulcs: jeloltek[0] || null, kulcs_forras: kulcsForras, nyom };
  }
  await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs = ?4, kulcs_forras = ?5, kovetkezo = ?6, frissitve = ?7 WHERE uuid = ?1').bind(mezok.uuid, 'fuggoben', probalkozas, jeloltek[0] || null, kulcsForras, t + ujra, t).run();
  return { allapot: 'fuggoben', kuldheto: false, riasztas: false, probalkozas, ujraprobal_mp: ujra, kulcs: jeloltek[0] || null, kulcs_forras: kulcsForras, nyom };
}

/** A parositatlan / ellentmondo foglalasok (a riasztas listaja). */
export async function riasztasok(db) {
  await sema(db);
  const { results } = await db.prepare("SELECT uuid, allapot, probalkozas, kulcs, kulcs_forras, letrehozva, frissitve FROM foglalas_egyeztetes WHERE riasztas = 1 ORDER BY frissitve DESC LIMIT 200").all();
  return results || [];
}
export async function egyeztetesAllapot(db, uuid) {
  await sema(db);
  return (await db.prepare('SELECT * FROM foglalas_egyeztetes WHERE uuid = ?1').bind(uuid).first()) || null;
}

// --- HTTP ----------------------------------------------------------------------------------------------------------------------------------
const JSON_FEJ = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const valasz = (status, o) => new Response(JSON.stringify(o), { status, headers: JSON_FEJ });
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
/** Az olvaso / e-mail-oldali kulcs ellenorzese: a kulcs SHA-256-ja az EGYEZTETES_KULCS_HASH valtozoban van (a kulcs maga nincs a kodban); kulcs nelkul / rossz kulccsal 404. */
export async function kulcsEllenorzes(request, env) {
  const hash = env && env.EGYEZTETES_KULCS_HASH;
  const adott = request.headers.get('x-egyeztetes-kulcs') || new URL(request.url).searchParams.get('kulcs') || '';
  if (!hash || !adott) return false;
  const a = await sha256hex(adott); let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return d === 0 && a.length === hash.length;
}
const azonosEredet = (request) => {
  const o = request.headers.get('origin');
  if (o) { try { return new URL(o).host === new URL(request.url).host; } catch (e) { return false; } }
  return request.headers.get('sec-fetch-site') === 'same-origin';
};

/** /api/foglalas-kulcs: POST (a koszonooldal irja; azonos eredet) | GET ?kulcs=<olvaso kulcs>&k=<placeId|employeeId|startUnix> (a rekord) */
export async function kezelKulcs(request, env) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (request.method === 'POST') {
    if (!azonosEredet(request)) return valasz(403, { ok: false, miert: 'csak azonos eredetrol' });
    const szoveg = await request.text();
    if (szoveg.length > 2048) return valasz(413, { ok: false, miert: 'tul nagy' });
    let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
    if (!o || typeof o !== 'object' || Object.keys(o).some((k) => !['booking_id', 'booking_url', 'forras'].includes(k))) return valasz(400, { ok: false, miert: 'ismeretlen mezo' });
    const forras = o.forras === 'ctx' ? 'ctx' : 'back';
    try { const r = await kulcsIras(env.KULCS_DB, { bookingId: o.booking_id, bookingUrl: o.booking_url, forras }); return valasz(r.ok ? 200 : 422, r); }
    catch (e) { return valasz(500, { ok: false, miert: 'adatbazis-hiba' }); }
  }
  if (request.method === 'GET') {
    if (!(await kulcsEllenorzes(request, env))) return valasz(404, { ok: false });
    const k = new URL(request.url).searchParams.get('k') || '';
    const r = await kulcsKeres(env.KULCS_DB, k);
    return valasz(200, { ok: true, kulcs: k, rekord: r });
  }
  return valasz(405, { ok: false });
}

/** /api/foglalas-egyeztetes: POST (az e-mail-oldal kerdez; kulcsos) | GET ?kulcs=..&uuid=.. (allapot) | GET ?kulcs=..&riasztas=1[&formatum=html] (parositatlan lista) */
export async function kezelEgyeztetes(request, env, deps = {}) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (!(await kulcsEllenorzes(request, env))) return valasz(404, { ok: false });
  const url = new URL(request.url);
  if (request.method === 'POST') {
    const szoveg = await request.text();
    if (szoveg.length > 20000) return valasz(413, { ok: false, miert: 'tul nagy' });
    let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
    if (!o || typeof o !== 'object') return valasz(400, { ok: false, miert: 'nem objektum' });
    if (o.nevtabla === 'frissit') { // a nevtabla kenyszeritett frissitese (napi frissites: a tabla maximum 24 oras)
      if (!deps.nevtablaFrissito) return valasz(501, { ok: false, miert: 'nincs frissito' });
      const uj = await deps.nevtablaFrissito(); const db = await nevtablaMent(env.KULCS_DB, uj, deps.now ? deps.now() : Date.now());
      return valasz(200, { ok: true, sorok: db, helyek: uj.helyek.length, munkatarsak: uj.munkatarsak.length, szolgaltatasok: uj.szolgaltatasok.length });
    }
    let mezok = { uuid: o.uuid, host: o.host, felado: o.felado, szolgaltatas: o.szolgaltatas, idopontSzoveg: o.idopont_szoveg, munkatarsak: Array.isArray(o.munkatarsak) ? o.munkatarsak.map(String).slice(0, 10) : [], ld: o.ld || null, leveldatum: o.level_datuma, diagnosztika: o.diagnosztika === true };
    if (typeof o.email_html === 'string') { const e = emailElemzes(o.email_html); mezok = { ...mezok, uuid: mezok.uuid || e.uuid, host: mezok.host || e.host, felado: mezok.felado || e.felado, szolgaltatas: mezok.szolgaltatas || e.szolgaltatas, idopontSzoveg: mezok.idopontSzoveg || e.idopontSzoveg, munkatarsak: mezok.munkatarsak.length ? mezok.munkatarsak : e.munkatarsak, ld: mezok.ld || e.ld }; }
    const r = await egyeztet(env.KULCS_DB, mezok, { fetchImpl: deps.fetchImpl || fetch, now: deps.now, nevtablaFrissito: deps.nevtablaFrissito });
    return valasz(200, { ok: true, ...r });
  }
  if (request.method === 'GET') {
    if (url.searchParams.get('riasztas') === '1') {
      const lista = await riasztasok(env.KULCS_DB);
      if (url.searchParams.get('formatum') === 'html') {
        const sorok = lista.map((r) => `<tr><td>${r.uuid}</td><td>${r.allapot}</td><td>${r.probalkozas}</td><td>${r.kulcs || ''}</td><td>${new Date(r.frissitve * 1000).toISOString()}</td></tr>`).join('');
        const fej = lista.length ? `<div style="background:#b00020;color:#fff;padding:12px;font:bold 16px sans-serif">FIGYELEM: ${lista.length} parositatlan / ellentmondo foglalas</div>` : '<div style="background:#1b5e20;color:#fff;padding:12px;font:bold 16px sans-serif">Nincs parositatlan foglalas</div>';
        return new Response(`<!doctype html><meta charset="utf-8"><title>Parositatlan foglalasok</title>${fej}<table border="1" cellpadding="6" style="font:14px sans-serif;margin-top:12px"><tr><th>Salonic UUID</th><th>allapot</th><th>probalkozas</th><th>kulcs</th><th>frissitve (UTC)</th></tr>${sorok}</table>`, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      return valasz(200, { ok: true, db: lista.length, riasztas: lista.length > 0, lista });
    }
    if (url.searchParams.get('nevtabla') === '1') { const t = await nevtablaBetolt(env.KULCS_DB); return valasz(200, { ok: true, frissitve: t.frissitve, helyek: t.helyek, munkatarsak: t.munkatarsak.length, szolgaltatasok: t.szolgaltatasok.length }); }
    const uuid = url.searchParams.get('uuid') || '';
    if (!UUID_MINTA.test(uuid)) return valasz(400, { ok: false, miert: 'ervenytelen uuid' });
    return valasz(200, { ok: true, allapot: await egyeztetesAllapot(env.KULCS_DB, uuid) });
  }
  return valasz(405, { ok: false });
}
