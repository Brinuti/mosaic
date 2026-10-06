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
const TURES_TOBB_MP = 300;   // tobb jelolt kozott a level datuma es a koszonooldali iras ideje legfeljebb ennyi masodpercre lehet (a Salonic a levelet masodpercekkel a foglalas utan kuldi)
const TURES_EGY_MP = 7200;  // egyetlen jelolt eseten a nagyon regi (napokkal korabbi) foglalast nem parositjuk (kesobbi iras 30 percen belul meg jo)
const NEVTABLA_CELZOTT_MP = 600; // egy fiok nevtablajat ismeretlen nev miatt legfeljebb 10 percenkent epitjuk ujra

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
// A Salonic a levelet a fiok nyelven kuldi: a Mosaic Hair magyarul, a HeadSpa fiok ANGOLUL ("October 31. (Saturday) 15:30 - 16:50") - mindketto ugyanabban a "Honap nap. (hetnap) ora:perc" alakban.
const HONAPOK = {
  'január': 1, 'február': 2, 'március': 3, 'április': 4, 'május': 5, 'június': 6, 'július': 7, 'augusztus': 8, 'szeptember': 9, 'október': 10, 'november': 11, 'december': 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, // (a november / december magyarul es angolul azonos)
};
const NAPNEVEK = [['vasárnap', 'sunday'], ['hétfő', 'monday'], ['kedd', 'tuesday'], ['szerda', 'wednesday'], ['csütörtök', 'thursday'], ['péntek', 'friday'], ['szombat', 'saturday']];

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
    if (szovegAdat.hetnap && !NAPNEVEK[d.getUTCDay()].includes(szovegAdat.hetnap)) continue;
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
  // a Salonic oldala a fiok nyelven jon: "Visszaigazolt" / "Idopont torolve!" (magyar), "Confirmed" / "Appointment deleted!" (angol)
  const allapot = /Visszaigazolt|\bConfirmed\b/.test(h) ? 'visszaigazolt' : /Id[oő]pont t[oö]r[oö]lve|t[oö]r[oö]lve|Appointment deleted|booking has been deleted/i.test(h) ? 'torolve' : null;
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

/**
 * Egy Salonic-foglalas ELO allapota (csak olvasas: GET /booking/bookingDetails/<uuid>): 'aktiv' (a "Foglalas modositasa" link / "Visszaigazolt" / "Confirmed" megvan),
 * 'torolve' ("Idopont torolve!" / "Appointment deleted!"), egyebkent 'ismeretlen' (hiba, mas oldal). A levelek sorrendjetol fuggetlen: mindig az aktualis allapotot kerdezi.
 */
export async function foglalasAllapot({ host, uuid, fetchImpl }) {
  if (!HOSTOK[host]) return { allapot: 'ismeretlen', miert: 'ismeretlen host' };
  if (!UUID_MINTA.test(String(uuid))) return { allapot: 'ismeretlen', miert: 'ervenytelen uuid' };
  try {
    const r = await lekerSzoveg(fetchImpl, `https://${host}/booking/bookingDetails/${uuid}`);
    const d = reszletekOldalElemzes(r.szoveg);
    if (d.uuid === uuid && d.startUnix) return { allapot: 'aktiv', status: r.status, uuid };
    if (d.allapot === 'torolve') return { allapot: 'torolve', status: r.status, uuid };
    if (d.allapot === 'visszaigazolt') return { allapot: 'aktiv', status: r.status, uuid };
    return { allapot: 'ismeretlen', status: r.status, miert: 'a megtekintes oldal sem aktiv, sem torolt' };
  } catch (e) { return { allapot: 'ismeretlen', miert: 'lekeres-hiba: ' + String(e && e.message || e).slice(0, 80) }; }
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
  const feladoH2 = (h.match(/<h2>([^<]+)<\/h2>\s*<\/div>/) || [])[1]; // magyar sablon: a fejlecben a szalon neve; az angol (HeadSpa) sablonban logo van, szoveg nincs
  const doboz = h.match(/padding: 20px; width: 90%;border-radius: 5px">\s*<h2>([^<]+)<\/h2>\s*([^<]*?)\s*<br/);
  const reszek = h.split(/(?:Munkatársak|Employees)<\/h3>/)[1]; // az angol sablonban "Employees"
  const munkatarsak = [];
  if (reszek) {
    const terulet = reszek.split(/class="btn btn-primary"/)[0];
    for (const m of terulet.matchAll(/<img[^>]*>\s*<\/div>\s*<div[^>]*>([^<]+)<\/div>/g)) munkatarsak.push(entitas(m[1]));
  }
  let ld = null;
  const j = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (j) { try { const o = JSON.parse(j[1]); ld = { startDate: o.reservationFor && o.reservationFor.startDate || null, reservationNumber: o.reservationNumber || null, szolgaltatas: o.reservationFor && o.reservationFor.name || null, hely: o.reservationFor && o.reservationFor.location && o.reservationFor.location.name || null }; } catch (e) { ld = null; } }
  // a szalon neve: magyar sablon: fejlec-h2; angol sablon: JSON-LD helynev; LEMONDASI ertesito (nincs fejlec, nincs JSON-LD): a zaro sor ("Udvozlettel: X" / "Regards, X")
  const zaro = (h.match(/(?:Üdvözlettel|Regards)\s*[:,]\s*([^<\n]+)/) || [])[1]; // a sor vegen <br> (magyar) vagy </div> (angol) all
  const felado = feladoH2 || (ld && ld.hely) || zaro || null;
  const tipus = /sikeresen lemondtad|has been cancel+ed/i.test(h) ? 'lemondas' : (link && ld ? 'letrehozva' : null); // a lemondasi ertesitoben nincs UUID-link
  return { tipus, uuid: link ? link[2] : null, host: link ? link[1] : null, felado: felado ? entitas(felado) : null, szolgaltatas: doboz ? entitas(doboz[1]) : null, idopontSzoveg: doboz ? entitas(doboz[2]) : null, munkatarsak, ld };
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
  // MINDEN koszonooldali iras (booking_id-nkent egy): egy kulcsra tobb foglalas is jelentkezhet (lemondas utan ujrafoglalt idopont); a parositas ebbol valaszt, a foglalas_kulcs a "birtokos"
  'CREATE TABLE IF NOT EXISTS foglalas_kulcs_irasok (booking_id TEXT PRIMARY KEY, kulcs TEXT NOT NULL, service_id TEXT, ido INTEGER NOT NULL, lejar INTEGER NOT NULL) WITHOUT ROWID',
  'CREATE INDEX IF NOT EXISTS foglalas_kulcs_irasok_kulcs ON foglalas_kulcs_irasok (kulcs)',
  'CREATE TABLE IF NOT EXISTS foglalas_kulcs_atadas (id INTEGER PRIMARY KEY AUTOINCREMENT, kulcs TEXT NOT NULL, booking_id_regi TEXT, booking_id_uj TEXT, ok TEXT NOT NULL, ido INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS foglalas_lemondas (id INTEGER PRIMARY KEY AUTOINCREMENT, kulcs TEXT, tulajdonos_booking_id TEXT, tulajdonos_uuid TEXT, elo_allapot TEXT, eredmeny TEXT NOT NULL, ido INTEGER NOT NULL)',
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
  await db.prepare('DELETE FROM foglalas_kulcs_irasok WHERE lejar < ?1').bind(t).run();
  await db.prepare('INSERT INTO foglalas_kulcs_irasok (booking_id, kulcs, service_id, ido, lejar) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(booking_id) DO NOTHING').bind(bookingId, e.kulcs, e.serviceId, t, t + MEGORZES_NAP * 86400).run(); // minden jelentkezo foglalas (a parositas jeloltjei)
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

/**
 * Egy kulcs JELOLTJEI: minden foglalas, ami erre a kulcsra jelentkezett a koszonooldalon (foglalas_kulcs_irasok + a birtokos sora), idorendben.
 * Mindegyiknel: kuldve_uuid = az a Salonic-UUID, amelyikre mar kiment az esemeny (ha van).
 */
export async function kulcsJeloltek(db, kulcs, now = Date.now()) {
  await sema(db);
  const t = sec(now);
  const { results } = await db.prepare('SELECT booking_id, service_id, ido FROM foglalas_kulcs_irasok WHERE kulcs = ?1 AND lejar >= ?2 ORDER BY ido, booking_id').bind(kulcs, t).all();
  const lista = (results || []).map((r) => ({ booking_id: r.booking_id, service_id: r.service_id, ido: r.ido }));
  const birtokos = await kulcsKeres(db, kulcs, now);
  if (birtokos && !lista.some((r) => r.booking_id === birtokos.booking_id)) lista.push({ booking_id: birtokos.booking_id, service_id: birtokos.service_id, ido: birtokos.letrehozva }); // a tabla bevezetese elotti sor
  for (const c of lista) { const k = await db.prepare('SELECT uuid FROM foglalas_egyeztetes WHERE booking_id = ?1 AND kuldve IS NOT NULL').bind(c.booking_id).first(); c.kuldve_uuid = k ? k.uuid : null; }
  return lista.sort((a, b) => a.ido - b.ido);
}
/**
 * A kulcs BIRTOKA atkerul egy masik jeloltre - csak ELLENORZOTT felszabadulas utan (a regi birtokos Salonic-oldala elo ellenorzessel "torolve"), nem felulirassal.
 * uj = null: a kulcs szabad lesz (nincs tobb jelolt). Naplozva (foglalas_kulcs_atadas).
 */
export async function kulcsAtadas(db, { kulcs, regi, uj, ok }, now = Date.now()) {
  await sema(db);
  const t = sec(now);
  if (uj) await db.prepare("UPDATE foglalas_kulcs SET booking_id = ?3, service_id = ?4, forras = 'atadas', letrehozva = ?5, lejar = ?6 WHERE kulcs = ?1 AND booking_id = ?2").bind(kulcs, regi, uj.booking_id, uj.service_id || null, uj.ido || t, t + MEGORZES_NAP * 86400).run();
  else await db.prepare('DELETE FROM foglalas_kulcs WHERE kulcs = ?1 AND booking_id = ?2').bind(kulcs, regi).run();
  await db.prepare('INSERT INTO foglalas_kulcs_atadas (kulcs, booking_id_regi, booking_id_uj, ok, ido) VALUES (?1, ?2, ?3, ?4, ?5)').bind(kulcs, regi, uj ? uj.booking_id : null, ok, t).run();
}

/** A nevtabla betoltese a D1-bol (2. ag). */
export async function nevtablaBetolt(db) {
  await sema(db);
  const { results } = await db.prepare('SELECT tipus, place_id, id, nev, frissitve FROM salonic_nevtabla').all();
  const t = { frissitve: 0, helyFrissitve: {}, helyek: [], munkatarsak: [], szolgaltatasok: [] };
  for (const r of results || []) {
    t.frissitve = Math.max(t.frissitve, r.frissitve);
    t.helyFrissitve[r.place_id] = Math.max(t.helyFrissitve[r.place_id] || 0, r.frissitve);
    if (r.tipus === 'hely') t.helyek.push({ placeId: r.place_id, nev: r.nev });
    else if (r.tipus === 'munkatars') t.munkatarsak.push({ placeId: r.place_id, employeeId: parseInt(r.id, 10), nev: r.nev }); // az id "24065" vagy "24065~alias" (ugyanannak a munkatarsnak tobb neve)
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
  const lattott = new Set();
  for (const x of tabla.munkatarsak) { // ugyanannak a munkatarsnak tobb neve (pl. oldal-nev es naptar-nev) kulon sorba kerul: "id" es "id~nev"
    const elso = !lattott.has(x.placeId + ':' + x.employeeId); lattott.add(x.placeId + ':' + x.employeeId);
    sorok.push(['munkatars', x.placeId, elso ? String(x.employeeId) : `${x.employeeId}~${norm(x.nev).slice(0, 40)}`, x.nev]);
  }
  for (const x of tabla.szolgaltatasok) sorok.push(['szolgaltatas', x.placeId, String(x.serviceId), x.nev]);
  const stmts = sorok.map(([tipus, p, id, nev]) => db.prepare('INSERT INTO salonic_nevtabla (tipus, place_id, id, nev, frissitve) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(tipus, place_id, id) DO UPDATE SET nev = excluded.nev, frissitve = excluded.frissitve').bind(tipus, p, id, nev, t));
  for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
  return sorok.length;
}
const NEVTABLA_MAX_KOR = 24 * 3600;

/** A munkatars neve a nyilvanos /employees/<id> oldal cimebol ("<fiok neve> - <munkatars neve>"); az altalanos cim ("... online idopontfoglalas") nem munkatars-oldal. */
export function munkatarsNevOldalbol(html, helyNev) {
  const cim = ((String(html || '').match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
  const c = entitas(cim);
  const k = c.indexOf(' - ');
  if (k < 1) return null;
  const elotag = c.slice(0, k), nev = c.slice(k + 3).trim();
  if (!nev || (helyNev && norm(elotag) !== norm(helyNev))) return null;
  return nev;
}

/**
 * A nevtabla a Salonic-fiokokbol: hely-nev (a fiok neve = a level felado-neve), munkatars (azonosito: a Salonic szolgaltatas-listajanak MINDEN munkatars-azonositoja;
 * nev: a /employees/ oldal linkjei, a neveletlen azonositokra a nyilvanos /employees/<id> oldal cime - ez a HeadSpa / Elysion fioknal is megvan -, vegul a naptar-API neve),
 * szolgaltatas (a Salonic-lista). uzletagok: csak ezek (celzott ujraepites).
 */
export async function nevtablaSalonicbol({ fetchImpl, adapterGyar, uzletagok = Object.keys(BUSINESSES) }) {
  const tabla = { helyek: [], munkatarsak: [], szolgaltatasok: [] };
  const adapter = adapterGyar({ fetchImpl });
  for (const uzletag of uzletagok) {
    const c = BUSINESSES[uzletag];
    if (!c) continue;
    try {
      const o = await lekerSzoveg(fetchImpl, `${c.host}/employees/?placeId=${c.placeId}`);
      const cim = (o.szoveg.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
      // a fiok neve: a naptar-API helyneve (a levelben a felado ez), tartalekban az oldal cime
      let helyNev = null;
      try { const p = await adapter.getPlace(uzletag); helyNev = p && p.name; } catch (e) { /* tartalek */ }
      for (const n of new Set([helyNev, cim && entitas(cim)].filter(Boolean))) tabla.helyek.push({ placeId: c.placeId, nev: n });
      const szolgak = await adapter.getServices(uzletag);
      const nevek = new Map(); // employeeId -> nevek (halmaz)
      const add = (id, nev) => { const n = entitas(nev || ''); if (!n || !Number.isInteger(Number(id))) return; const k = Number(id); if (!nevek.has(k)) nevek.set(k, new Set()); nevek.get(k).add(n); };
      for (const m of o.szoveg.matchAll(/<a[^>]*href="\/employees\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) add(m[1], m[2].replace(/<[^>]+>/g, ' '));
      const idk = new Set(); // a szolgaltatas-lista teljes munkatars-azonosito-halmaza
      for (const sz of szolgak) for (const id of sz.staffIds || []) idk.add(Number(id));
      if (c.employeeId) idk.add(c.employeeId);
      let lekeres = 0;
      for (const id of idk) { // neveletlen azonosito: a nyilvanos munkatars-oldal
        if (nevek.has(id) || lekeres >= 12) continue;
        lekeres++;
        try { const r = await lekerSzoveg(fetchImpl, `${c.host}/employees/${id}`); const nev = r.status === 200 ? munkatarsNevOldalbol(r.szoveg, helyNev) : null; if (nev) add(id, nev); } catch (e) { /* a tobbit nem allitja meg */ }
      }
      try { // naptar-API nevek (csak ha van szabad idopont): kiegeszito nev (alias) / tartalek a neveletlen azonositokra; szolgaltatasonkent egyszer, legfeljebb 6 hivas
        const hasznalt = new Set(); let hivas = 0;
        for (const sz of szolgak) {
          const uj = (sz.staffIds || []).map(Number).filter((id) => !hasznalt.has(id));
          if (!uj.length || hivas >= 6) continue;
          hivas++; uj.forEach((id) => hasznalt.add(id));
          for (const x of await adapter.getStaff(uzletag, sz.serviceId, { days: 60 })) if (x.staff_label) add(x.staff_id, x.staff_label);
        }
      } catch (e) { /* a naptar-API nevei nem kellenek a teljessegehez */ }
      for (const [employeeId, ns] of nevek) for (const nev of ns) tabla.munkatarsak.push({ placeId: c.placeId, employeeId, nev });
      for (const sz of szolgak) tabla.szolgaltatasok.push({ placeId: c.placeId, serviceId: String(sz.serviceId), nev: sz.name });
      tabla.hianyzoNevek = (tabla.hianyzoNevek || []).concat([...idk].filter((id) => !nevek.has(id)).map((id) => ({ placeId: c.placeId, employeeId: id }))); // diagnosztika: azonosito nev nelkul
    } catch (e) { /* egy fiok hibaja nem allitja meg a tobbit */ }
  }
  return tabla;
}

/**
 * A levelbol a kulcs-jeloltek a nevtablabol (2. ag). Ha a nev ismeretlen (uj munkatars / ujonnan felvett szolgaltatas), a fiok nevtablajat CELZOTTAN
 * ujraepiti (legfeljebb NEVTABLA_CELZOTT_MP-enkent), es egyszer ujraprobalja. -> { o2, nyom2 }
 */
async function nevtablabolKulcs(db, mezok, deps, now, t) {
  let tabla = await nevtablaBetolt(db);
  const leveluUnix = mezok.leveldatum ? Math.round(Date.parse(mezok.leveldatum) / 1000) || t : t;
  const frissit = async (uzletag) => {
    if (!deps.nevtablaFrissito) return false;
    try { const uj = await deps.nevtablaFrissito(uzletag); if (uj) { await nevtablaMent(db, uj, now); tabla = await nevtablaBetolt(db); return true; } } catch (e) { /* a regi tabla marad */ }
    return false;
  };
  // a levelhez tartozo fiok (a felado neve alapjan): a napi frissites FIOKONKENT tortenik (egy hivasban kevesebb Salonic-lekeres: a Pages-fuggveny alkalekeres-korlatja miatt), ures tablanal az osszes fiok
  const helyek0 = tabla.helyek.filter((x) => norm(x.nev) === norm(mezok.felado));
  const place0 = helyek0.length && new Set(helyek0.map((x) => x.placeId)).size === 1 ? helyek0[0].placeId : null;
  const uzletag0 = place0 ? Object.keys(BUSINESSES).find((k) => BUSINESSES[k].placeId === place0) : null;
  const kor = place0 ? t - (tabla.helyFrissitve[place0] || 0) : t - tabla.frissitve;
  if (deps.nevtablaFrissito && (!tabla.frissitve || kor > NEVTABLA_MAX_KOR)) await frissit(uzletag0 || undefined);
  let o2 = emailKulcsNevtablabol(mezok, tabla, leveluUnix);
  let celzott = null;
  if (!o2.ok && /^ismeretlen (munkatars|felado)/.test(o2.miert || '') && deps.nevtablaFrissito) {
    const hely = tabla.helyek.filter((x) => norm(x.nev) === norm(mezok.felado));
    const placeId = hely.length ? hely[0].placeId : null;
    const uzletag = placeId ? Object.keys(BUSINESSES).find((k) => BUSINESSES[k].placeId === placeId) : null;
    const utolso = placeId ? (tabla.helyFrissitve[placeId] || 0) : tabla.frissitve;
    if (t - utolso > NEVTABLA_CELZOTT_MP && (await frissit(uzletag || undefined))) { o2 = emailKulcsNevtablabol(mezok, tabla, leveluUnix); celzott = uzletag || 'mind'; }
  }
  return { o2, nyom2: { ok: o2.ok, miert: o2.miert || null, ...o2.nyom, kulcsok: o2.kulcsok || [], serviceId: o2.serviceId || null, ...(celzott ? { nevtabla_celzott_ujraepites: celzott } : {}) } };
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
  const leveldatum = mezok.leveldatum ? Math.round(Date.parse(mezok.leveldatum) / 1000) || null : null;

  // kulcs-jeloltek: 1. ag (Salonic-oldalak), ha nem megy: 2. ag (nevtabla)
  let jeloltek = [], kulcsForras = null, serviceId = null, ellenorzoServiceIds = null;
  const o1 = await salonicOldalKulcs({ host: mezok.host, uuid: mezok.uuid, fetchImpl: deps.fetchImpl });
  nyom.ag1 = { ok: o1.ok, miert: o1.miert || null, lepesek: o1.lepesek || [], kulcs: o1.kulcs || null, serviceId: o1.serviceId || null };
  const ag2Szamol = async () => { const { o2, nyom2 } = await nevtablabolKulcs(db, mezok, deps, now, t); nyom.ag2 = nyom2; return o2; };
  if (o1.ok) {
    jeloltek = [o1.kulcs]; kulcsForras = 'salonic-oldal'; serviceId = o1.serviceId;
    if (mezok.diagnosztika) { const o2 = await ag2Szamol(); nyom.ag2.egyezik_az_ag1_el = !!(o2.ok && o2.kulcsok.includes(o1.kulcs)); } // csak a nyomhoz: a dontes az 1. agon marad
  } else {
    const o2 = await ag2Szamol();
    if (o2.ok) { jeloltek = o2.kulcsok; kulcsForras = 'nevtabla'; serviceId = o2.serviceId; ellenorzoServiceIds = o2.serviceIds; }
  }
  nyom.jeloltKulcsok = jeloltek; nyom.kulcsForras = kulcsForras;

  // a kulcs JELOLTJEIBOL (minden foglalas, ami erre a kulcsra jelentkezett) a levelhez tartozo kivalasztasa - a levelek sorrendjetol fuggetlenul:
  //  - ha a kulcs BIRTOKOSA mar mas Salonic-UUID-ra kikuldott esemeny: elo ellenorzes a birtokos foglalas Salonic-oldalan ("Idopont torolve!"):
  //      torolve -> a kulcs birtoka atkerul erre a foglalasra; el -> ELLENTMONDAS + riasztas; nem ellenorizheto -> varakozas (ujraprobalas)
  //  - tobb szabad jelolt kozott a level datuma es a koszonooldali iras ideje (legfeljebb TURES_TOBB_MP) dont; ha nem egyertelmu: ELLENTMONDAS + riasztas
  async function valaszt(k) {
    const lista = await kulcsJeloltek(db, k, now);
    (nyom.jeloltek = nyom.jeloltek || []).push({ kulcs: k, jeloltek: lista.map((c) => ({ booking_id: c.booking_id, service_id: c.service_id, ido: c.ido, kuldve_uuid: c.kuldve_uuid })) });
    if (!lista.length) return { allapot: 'nincs', kulcs: k };
    const birtokos = await kulcsKeres(db, k, now);
    const birtokosJelolt = birtokos && lista.find((c) => c.booking_id === birtokos.booking_id);
    let atadas = null;
    if (birtokosJelolt && birtokosJelolt.kuldve_uuid && birtokosJelolt.kuldve_uuid !== mezok.uuid) {
      const elo = await foglalasAllapot({ host: mezok.host, uuid: birtokosJelolt.kuldve_uuid, fetchImpl: deps.fetchImpl });
      nyom.birtokos_ellenorzes = { kulcs: k, birtokos_booking_id: birtokos.booking_id, birtokos_uuid: birtokosJelolt.kuldve_uuid, elo_allapot: elo.allapot, miert: elo.miert || null };
      if (elo.allapot === 'aktiv') return { allapot: 'ellentmondas', kulcs: k, miert: 'a kulcsot mar mas, ELO Salonic-foglalas birtokolja (' + birtokosJelolt.kuldve_uuid.slice(0, 8) + '): ket elo foglalas azonos kulccsal' };
      if (elo.allapot !== 'torolve') return { allapot: 'varakozas', kulcs: k, miert: 'a kulcs birtokosa nem ellenorizheto: ' + (elo.miert || elo.allapot) };
      atadas = { regi: birtokos.booking_id, ok: 'a birtokos Salonic-foglalas (' + birtokosJelolt.kuldve_uuid.slice(0, 8) + ') torolve - elo ellenorzes' };
    }
    const szabad = lista.filter((c) => !c.kuldve_uuid);
    if (!szabad.length) return { allapot: 'nincs', kulcs: k, miert: 'minden jelolt mar mas foglalasra kiment' };
    if (szabad.length === 1) {
      if (leveldatum != null && Math.abs(szabad[0].ido - leveldatum) > TURES_EGY_MP) return { allapot: 'nincs', kulcs: k, miert: 'az egyetlen jelolt tul regi ehhez a levelhez (' + Math.round((leveldatum - szabad[0].ido) / 60) + ' perc)' };
      return { allapot: 'valasztott', kulcs: k, jelolt: szabad[0], atadas };
    }
    if (leveldatum == null) return { allapot: 'ellentmondas', kulcs: k, miert: 'tobb szabad jelolt, a level datuma nelkul nem egyertelmu' };
    const rend = szabad.map((c) => ({ c, d: Math.abs(c.ido - leveldatum) })).sort((x, y) => x.d - y.d);
    if (rend[0].d <= TURES_TOBB_MP && rend[1].d > TURES_TOBB_MP) return { allapot: 'valasztott', kulcs: k, jelolt: rend[0].c, atadas, idoalapu: true };
    return { allapot: 'ellentmondas', kulcs: k, miert: 'tobb szabad jelolt, az idoalapu parositas nem egyertelmu' };
  }
  const eredmenyek = [];
  for (const k of jeloltek) eredmenyek.push(await valaszt(k));
  const talalatok = eredmenyek.filter((e) => e.allapot === 'valasztott');
  nyom.talalatok = talalatok.map((e) => ({ kulcs: e.kulcs, booking_id: e.jelolt.booking_id, service_id: e.jelolt.service_id, forras: e.atadas ? 'atadas' : e.idoalapu ? 'idoalapu' : 'koszonooldal' }));
  nyom.valasztas = eredmenyek.map((e) => ({ kulcs: e.kulcs, allapot: e.allapot, miert: e.miert || null }));

  const ellentm = eredmenyek.find((e) => e.allapot === 'ellentmondas');
  if (ellentm || (talalatok.length > 1 && new Set(talalatok.map((e) => e.jelolt.booking_id)).size > 1)) {
    const miert = ellentm ? ellentm.miert : 'tobb kulcs-jelolt, kulonbozo booking_id';
    await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs = ?4, kulcs_forras = ?5, kovetkezo = NULL, riasztas = 1, frissitve = ?6 WHERE uuid = ?1').bind(mezok.uuid, 'ellentmondas', probalkozas, (ellentm && ellentm.kulcs) || jeloltek[0] || null, kulcsForras, t).run();
    return { allapot: 'ellentmondas', kuldheto: false, duplikalt: false, riasztas: true, probalkozas, miert, kulcs: (ellentm && ellentm.kulcs) || jeloltek[0] || null, kulcs_forras: kulcsForras, nyom };
  }
  if (talalatok.length) {
    const e0 = talalatok[0], r = { kulcs: e0.kulcs, booking_id: e0.jelolt.booking_id, service_id: e0.jelolt.service_id };
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
    } catch (e) { // a booking_id-ra mar ment esemeny MAS Salonic-foglalasrol: nem kuldunk, LATHATO riasztassal (nem nyelheti el csendben)
      nyom.egyediIndex = 'a booking_id-ra mar ment esemeny (mas UUID-rol)';
      await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs = ?4, kulcs_forras = ?5, service_id = ?6, riasztas = 1, kovetkezo = NULL, frissitve = ?7 WHERE uuid = ?1').bind(mezok.uuid, 'ellentmondas', probalkozas, r.kulcs, kulcsForras, r.service_id, t).run();
      return { allapot: 'ellentmondas', kuldheto: false, duplikalt: false, riasztas: true, probalkozas, miert: 'a kulcshoz tartozo booking_id mar mas Salonic-foglalasra kiment', kulcs: r.kulcs, kulcs_forras: kulcsForras, nyom };
    }
    if (kuldheto && e0.atadas) { await kulcsAtadas(db, { kulcs: r.kulcs, regi: e0.atadas.regi, uj: e0.jelolt, ok: e0.atadas.ok }, now); nyom.kulcs_atadas = { kulcs: r.kulcs, regi: e0.atadas.regi, uj: r.booking_id, ok: e0.atadas.ok }; }
    return { allapot: 'parositott', kuldheto, duplikalt: !kuldheto, booking_id: r.booking_id, esemeny_id: r.booking_id, kulcs: r.kulcs, kulcs_forras: kulcsForras, service_egyezik: serviceEgyezik, probalkozas, riasztas: false, keses: sor.allapot === 'parositatlan', kulcs_atadva: !!(kuldheto && e0.atadas), nyom };
  }
  // nincs talalat: ujraprobalas 1, 3, 10, 30 perc; az 5. keres (1 azonnali + 4 ujra) utan parositatlan + riasztas
  const miertNincs = (eredmenyek.find((e) => e.allapot === 'varakozas') || eredmenyek.find((e) => e.miert) || {}).miert || null;
  const ujra = UJRAPROBA_MP[probalkozas - 1];
  if (ujra === undefined) {
    await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs = ?4, kulcs_forras = ?5, kovetkezo = NULL, riasztas = 1, frissitve = ?6 WHERE uuid = ?1').bind(mezok.uuid, 'parositatlan', probalkozas, jeloltek[0] || null, kulcsForras, t).run();
    return { allapot: 'parositatlan', kuldheto: false, riasztas: true, probalkozas, kulcs: jeloltek[0] || null, kulcs_forras: kulcsForras, miert: miertNincs, nyom };
  }
  await db.prepare('UPDATE foglalas_egyeztetes SET allapot = ?2, probalkozas = ?3, kulcs = ?4, kulcs_forras = ?5, kovetkezo = ?6, frissitve = ?7 WHERE uuid = ?1').bind(mezok.uuid, 'fuggoben', probalkozas, jeloltek[0] || null, kulcsForras, t + ujra, t).run();
  return { allapot: 'fuggoben', kuldheto: false, riasztas: false, probalkozas, ujraprobal_mp: ujra, kulcs: jeloltek[0] || null, kulcs_forras: kulcsForras, miert: miertNincs, nyom };
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

/**
 * A Salonic LEMONDASI ertesitoje ("Foglalas lemondas: ..." / "Your booking has been cancelled: ..."): NINCS benne UUID, link vagy JSON-LD, csak a szalon neve, a szolgaltatas,
 * a munkatars es az idopont szovege (ev nelkul). A kulcsot ezert a NEVTABLABOL kepezzuk (2. ag); a kulcs birtokosat (az a foglalas, amelyikre a kulcsbol mar esemeny ment) a
 * Salonic-oldalan ELO ellenorizzuk: ha torolve, a kulcs felszabadul (a kovetkezo egyetlen szabad jelolt kapja, ha van; tobb jeloltnel a levelek idoalapu parositasa dont);
 * ha el (pl. az ertesito egy korabbi foglalasra vonatkozik, a kulcsot mar az uj foglalas birtokolja), semmi nem valtozik. A levelek sorrendje igy nem szamit.
 * mezok: { felado, szolgaltatas, idopontSzoveg, munkatarsak[], leveldatum } -> { allapot: 'lemondas' | 'ismeretlen', eredmenyek[], nyom }
 */
export async function lemondasKezel(db, mezok, deps) {
  const now = deps.now ? deps.now() : Date.now();
  const t = sec(now);
  await sema(db);
  const { o2, nyom2 } = await nevtablabolKulcs(db, mezok, deps, now, t);
  const nyom = { ag2: nyom2 };
  if (!o2.ok) return { allapot: 'ismeretlen', miert: o2.miert, eredmenyek: [], nyom };
  const hostnev = Object.values(BUSINESSES).filter((c) => c.placeId === o2.placeId).map((c) => new URL(c.host).hostname)[0];
  const eredmenyek = [];
  const naplo = (k, b, u, elo, em) => db.prepare('INSERT INTO foglalas_lemondas (kulcs, tulajdonos_booking_id, tulajdonos_uuid, elo_allapot, eredmeny, ido) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(k, b || null, u || null, elo || null, em, t).run();
  for (const k of o2.kulcsok) {
    const birtokos = await kulcsKeres(db, k, now);
    if (!birtokos) { eredmenyek.push({ kulcs: k, eredmeny: 'nincs bejegyzes ehhez a kulcshoz (mar szabad / a koszonooldal nem irt)' }); await naplo(k, null, null, null, 'nincs bejegyzes'); continue; }
    const kuldve = await db.prepare('SELECT uuid FROM foglalas_egyeztetes WHERE booking_id = ?1 AND kuldve IS NOT NULL').bind(birtokos.booking_id).first();
    if (!kuldve) { eredmenyek.push({ kulcs: k, tulajdonos: birtokos.booking_id, eredmeny: 'nem ellenorizheto: a birtokos foglalas Salonic-UUID-ja ismeretlen (a letrehozasi level meg nem parositott)' }); await naplo(k, birtokos.booking_id, null, null, 'nem ellenorizheto: nincs UUID'); continue; }
    const elo = await foglalasAllapot({ host: hostnev, uuid: kuldve.uuid, fetchImpl: deps.fetchImpl });
    if (elo.allapot === 'torolve') {
      const lista = await kulcsJeloltek(db, k, now);
      const szabad = lista.filter((c) => !c.kuldve_uuid && c.booking_id !== birtokos.booking_id);
      const kovetkezo = szabad.length === 1 ? szabad[0] : null;
      await kulcsAtadas(db, { kulcs: k, regi: birtokos.booking_id, uj: kovetkezo, ok: 'lemondasi ertesito + elo ellenorzes: a birtokos (' + kuldve.uuid.slice(0, 8) + ') torolve' }, now);
      const em = kovetkezo ? 'felszabadult es atkerult: ' + kovetkezo.booking_id : 'felszabadult';
      eredmenyek.push({ kulcs: k, tulajdonos: birtokos.booking_id, tulajdonos_uuid: kuldve.uuid, elo_allapot: 'torolve', eredmeny: em, atadva: kovetkezo ? kovetkezo.booking_id : null });
      await naplo(k, birtokos.booking_id, kuldve.uuid, 'torolve', em);
    } else {
      const em = elo.allapot === 'aktiv' ? 'a birtokos foglalas EL: a kulcs nem szabadul fel (az ertesito mas, korabbi foglalasra vonatkozik)' : 'nem ellenorizheto: ' + (elo.miert || elo.allapot);
      eredmenyek.push({ kulcs: k, tulajdonos: birtokos.booking_id, tulajdonos_uuid: kuldve.uuid, elo_allapot: elo.allapot, eredmeny: em });
      await naplo(k, birtokos.booking_id, kuldve.uuid, elo.allapot, em);
    }
  }
  return { allapot: 'lemondas', eredmenyek, nyom };
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
    return valasz(200, { ok: true, kulcs: k, rekord: r, jeloltek: await kulcsJeloltek(env.KULCS_DB, k) }); // jeloltek: a kulcsra jelentkezett foglalasok (booking_id, serviceId, ido, kuldve_uuid) - szemelyes adat nelkul
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
      const uj = await deps.nevtablaFrissito(typeof o.uzletag === 'string' ? o.uzletag : undefined); const db = await nevtablaMent(env.KULCS_DB, uj, deps.now ? deps.now() : Date.now());
      return valasz(200, { ok: true, sorok: db, helyek: uj.helyek.length, munkatarsak: uj.munkatarsak.length, szolgaltatasok: uj.szolgaltatasok.length });
    }
    let mezok = { uuid: o.uuid, host: o.host, felado: o.felado, szolgaltatas: o.szolgaltatas, idopontSzoveg: o.idopont_szoveg, munkatarsak: Array.isArray(o.munkatarsak) ? o.munkatarsak.map(String).slice(0, 10) : [], ld: o.ld || null, leveldatum: o.level_datuma, diagnosztika: o.diagnosztika === true };
    if (typeof o.email_html === 'string') { const e = emailElemzes(o.email_html); mezok = { ...mezok, uuid: mezok.uuid || e.uuid, host: mezok.host || e.host, felado: mezok.felado || e.felado, szolgaltatas: mezok.szolgaltatas || e.szolgaltatas, idopontSzoveg: mezok.idopontSzoveg || e.idopontSzoveg, munkatarsak: mezok.munkatarsak.length ? mezok.munkatarsak : e.munkatarsak, ld: mezok.ld || e.ld }; }
    const fuggosegek = { fetchImpl: deps.fetchImpl || fetch, now: deps.now, nevtablaFrissito: deps.nevtablaFrissito };
    if (o.tipus === 'lemondas' || (typeof o.email_html === 'string' && emailElemzes(o.email_html).tipus === 'lemondas')) { // lemondasi ertesito: nincs UUID, kulcsot a nevtablabol kepez
      const r = await lemondasKezel(env.KULCS_DB, mezok, fuggosegek);
      return valasz(200, { ok: true, tipus: 'lemondas', ...r });
    }
    const r = await egyeztet(env.KULCS_DB, mezok, fuggosegek);
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
    if (url.searchParams.get('nevtabla') === '1') { const t = await nevtablaBetolt(env.KULCS_DB); const munk = {}; for (const m of t.munkatarsak) (munk[m.placeId] = munk[m.placeId] || {})[m.employeeId] = ((munk[m.placeId] || {})[m.employeeId] || []).concat([m.nev]); return valasz(200, { ok: true, frissitve: t.frissitve, helyFrissitve: t.helyFrissitve, helyek: t.helyek, munkatarsak: t.munkatarsak.length, szolgaltatasok: t.szolgaltatasok.length, munkatarsak_helyenkent: url.searchParams.get('reszletes') === '1' ? munk : undefined }); }
    const uuid = url.searchParams.get('uuid') || '';
    if (!UUID_MINTA.test(uuid)) return valasz(400, { ok: false, miert: 'ervenytelen uuid' });
    return valasz(200, { ok: true, allapot: await egyeztetesAllapot(env.KULCS_DB, uuid) });
  }
  return valasz(405, { ok: false });
}
