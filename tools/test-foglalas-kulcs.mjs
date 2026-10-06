// A foglalas-kulcs es a parositas (QA-1 folytatas) egysegtesztjei: netlify/lib/foglalas-kulcs.js + assets/js/foglalas-kulcs.js
//   node --test tools/test-foglalas-kulcs.mjs
// A tabla SQL-jet valodi SQLite-on (node:sqlite) futtatjuk, a D1 felulet (prepare / bind / run / first / all / batch) egy vekony hejon at; a Salonic-oldalak a valodi (mentett) oldalak.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  HOSTOK, MEGORZES_NAP, UJRAPROBA_MP, bookingUrlElemzes, budapestUnix, egyeztet, emailElemzes, emailKulcsNevtablabol, evKovetkeztet, idopontSzovegElemzes, isoUnix, kezelEgyeztetes, kezelKulcs,
  foglalasAllapot, kulcsJeloltek, lemondasKezel, munkatarsNevOldalbol, kulcsIras, kulcsKepez, kulcsKeres, modositasOldalElemzes, nevtablaBetolt, nevtablaMent, nevtablaSalonicbol, norm, reszletekOldalElemzes, riasztasok, salonicOldalKulcs, sema,
} from '../netlify/lib/foglalas-kulcs.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (f) => fs.readFileSync(path.join(here, 'fixtures', 'salonic', f), 'utf8');
const BID = 'mb_0muwq2ciorsos0tznsfyliq';
const UUID = '3f10fabc-4f7d-9257-2088-cfe7b5b24a2e';
const BOOKING_URL = `https://mosaic-hair.salonic.hu/guestData/?anyone=true&employeeId=25095&placeId=10823&serviceId=232804&startDate=1792512000&back=${BID}`; // a valodi atiranyitasbol (2026-10-06)
const KULCS = '10823|25095|1792512000';

function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
// a Salonic "szerver": a mentett valodi oldalak (1. ag), vagy hiba
const salonicFetch = (felulir = {}) => async (url) => {
  const u = String(url);
  const ok = (szoveg, vegso = u) => ({ ok: true, status: 200, url: vegso, text: async () => szoveg });
  if (felulir.hiba) return { ok: false, status: 500, url: u, text: async () => '' };
  if (u.includes(`/booking/bookingDetails/${UUID}`)) return ok(felulir.reszletek ?? fx('kulcs-bookingDetails-hair.html'));
  if (u.includes('/selectDate/?startDate=')) return ok(felulir.modositas ?? fx('kulcs-selectDate-modositas-hair.html'));
  return { ok: false, status: 404, url: u, text: async () => '' };
};
const MEZOK = () => ({ uuid: UUID, host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)', idopontSzoveg: 'Október 20. (kedd) 18:00 - 18:30', munkatarsak: ['Noel - 20% kedvezmény!'], ld: { startDate: '2026-10-20T18:00:00+02:00' }, leveldatum: '2026-10-06T13:36:32Z' });
const ora = (t0 = Date.UTC(2026, 9, 6, 13, 36, 40)) => { let t = t0; const f = () => t; f.tick = (mp) => { t += mp * 1000; }; return f; };

// --- kulcs ---------------------------------------------------------------------------------------------------------------------------
test('kulcsKepez: placeId|employeeId|startUnix; ervenytelen mezo (0, -1, kis unix) = null', () => {
  assert.equal(kulcsKepez(10823, 25095, 1792512000), KULCS);
  for (const rossz of [[0, 1, 1792512000], [10823, -1, 1792512000], [10823, 25095, 5], [10823, 25095, 'x'], [1.5, 1, 1792512000]]) assert.equal(kulcsKepez(...rossz), null, JSON.stringify(rossz));
});

test('bookingUrlElemzes: a valodi atiranyitas bookingUrl-je -> kulcs, serviceId, bookingId (a back-bol)', () => {
  const e = bookingUrlElemzes(BOOKING_URL);
  assert.deepEqual({ ok: e.ok, kulcs: e.kulcs, serviceId: e.serviceId, bookingId: e.bookingId, uzletag: e.uzletag, startUnix: e.startUnix }, { ok: true, kulcs: KULCS, serviceId: '232804', bookingId: BID, uzletag: 'hair', startUnix: 1792512000 });
  assert.equal(bookingUrlElemzes(BOOKING_URL.replace(/&back=.*/, '&back=')).bookingId, null, 'ures back: nincs azonosito, de a kulcs megvan');
  assert.equal(bookingUrlElemzes(BOOKING_URL.replace(BID, 'g:2038420')).bookingId, null, 'nem a sajat azonosito-alak');
});

test('bookingUrlElemzes: elutasitott esetek (idegen host, nem https, rossz placeId, barmelyik szakember, nincs serviceId, hibas startDate)', () => {
  const rossz = [
    BOOKING_URL.replace('mosaic-hair.salonic.hu', 'evil.example.com'), BOOKING_URL.replace('https:', 'http:'), BOOKING_URL.replace('placeId=10823', 'placeId=14409'),
    BOOKING_URL.replace('employeeId=25095', 'employeeId=-1'), BOOKING_URL.replace('&serviceId=232804', ''), BOOKING_URL.replace('startDate=1792512000', 'startDate=12'), BOOKING_URL.replace('/guestData/', '/masik/'), 'nem url',
  ];
  for (const x of rossz) assert.equal(bookingUrlElemzes(x).ok, false, x);
  assert.deepEqual(Object.keys(HOSTOK).sort(), ['mosaic-elysion.salonic.hu', 'mosaic-hair.salonic.hu', 'mosaic-oxigen.salonic.hu', 'mosaic-pmu.salonic.hu', 'mosaicheadspa.salonic.hu']);
});

// --- idopont ------------------------------------------------------------------------------------------------------------------------
test('budapestUnix: a Salonic sajat startDate-jevel egyezik (2026-10-20 18:00 = 1792512000); nyari es teli ido, ora-atallitas', () => {
  assert.equal(budapestUnix(2026, 10, 20, 18, 0), 1792512000);
  assert.equal(budapestUnix(2026, 12, 15, 18, 0), Date.UTC(2026, 11, 15, 17, 0) / 1000, 'teli ido: UTC+1');
  assert.equal(budapestUnix(2026, 7, 15, 18, 0), Date.UTC(2026, 6, 15, 16, 0) / 1000, 'nyari ido: UTC+2');
  assert.equal(budapestUnix(2026, 10, 24, 18, 0), Date.UTC(2026, 9, 24, 16, 0) / 1000, 'az ora-atallitas elotti nap: meg nyari');
  assert.equal(budapestUnix(2026, 10, 26, 18, 0), Date.UTC(2026, 9, 26, 17, 0) / 1000, 'az ora-atallitas (2026-10-25) utan: teli');
  assert.equal(budapestUnix(2026, 3, 30, 9, 0), Date.UTC(2026, 2, 30, 7, 0) / 1000, 'a tavaszi atallitas (2026-03-29) utan: nyari');
});

test('idopontSzovegElemzes + evKovetkeztet: az ev a level datuma alapjan, ELOREFELE; a hetnap neve validal; ev-hataron is', () => {
  const sz = idopontSzovegElemzes('Október 20. (kedd) 18:00 - 18:30');
  assert.deepEqual(sz, { ho: 10, nap: 20, hetnap: 'kedd', ora: 18, perc: 0 });
  const level = (iso) => Date.parse(iso) / 1000;
  assert.equal(evKovetkeztet(sz, level('2026-10-06T13:36:32Z')), 1792512000);
  assert.equal(evKovetkeztet(idopontSzovegElemzes('Január 5. (kedd) 10:00 - 11:00'), level('2026-12-30T10:00:00Z')), budapestUnix(2027, 1, 5, 10, 0), 'ev-hatar: a januar a kovetkezo evben van');
  assert.equal(evKovetkeztet(idopontSzovegElemzes('Január 5. (hétfő) 10:00'), level('2026-12-30T10:00:00Z')), null, 'a hetnap nem egyezik semelyik evben (3 even belul)');
  assert.equal(evKovetkeztet(idopontSzovegElemzes('Október 19. (hétfő) 18:00'), level('2026-10-20T10:00:00Z')), null, 'a level utani elso evben a hetnap mas: nem talalunk ki erteket');
  assert.equal(evKovetkeztet(idopontSzovegElemzes('Október 20. 18:00'), level('2026-10-06T13:36:32Z')), 1792512000, 'hetnap nelkul is');
  assert.equal(idopontSzovegElemzes('semmi'), null);
  assert.equal(idopontSzovegElemzes('Smarch 20. 18:00'), null);
  assert.equal(isoUnix('2026-10-20T18:00:00+02:00'), 1792512000);
  assert.equal(isoUnix('2026-10-20T18:00:00'), null, 'idozona nelkul nem ISO-unix');
});

// --- Salonic-oldalak (1. ag) ----------------------------------------------------------------------------------------------------------
test('a "Foglalas megtekintese" oldal csak a startDate-et adja (azonositokat nem), a "Foglalas modositasa" oldal a placeId / serviceId / employeeId-t', () => {
  const r = reszletekOldalElemzes(fx('kulcs-bookingDetails-hair.html'));
  assert.deepEqual({ allapot: r.allapot, startUnix: r.startUnix, uuid: r.uuid }, { allapot: 'visszaigazolt', startUnix: 1792512000, uuid: UUID });
  assert.ok(!/placeId|serviceId|employeeId/.test(fx('kulcs-bookingDetails-hair.html')), 'a megtekintes oldalon NINCS azonosito (csak a modositas-link startDate-je)');
  assert.deepEqual(modositasOldalElemzes(fx('kulcs-selectDate-modositas-hair.html')), { placeId: 10823, employeeId: 25095, serviceId: '232804' });
});

test('salonicOldalKulcs: UUID -> kulcs (startDate a megtekintesbol, azonositok a modositas oldalrol); hibak: hiba-status, nincs startDate, mas placeId, idegen host, rossz uuid', async () => {
  const jo = await salonicOldalKulcs({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: salonicFetch() });
  assert.deepEqual({ ok: jo.ok, kulcs: jo.kulcs, serviceId: jo.serviceId }, { ok: true, kulcs: KULCS, serviceId: '232804' });
  assert.equal(jo.lepesek.length, 2);
  assert.equal((await salonicOldalKulcs({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: salonicFetch({ hiba: true }) })).ok, false);
  assert.equal((await salonicOldalKulcs({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: salonicFetch({ reszletek: '<html>Időpont törölve</html>' }) })).ok, false);
  assert.equal((await salonicOldalKulcs({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: salonicFetch({ modositas: fx('kulcs-selectDate-modositas-hair.html').replace('placeId: 10823', 'placeId: 14409') }) })).ok, false);
  assert.equal((await salonicOldalKulcs({ host: 'evil.example.com', uuid: UUID, fetchImpl: salonicFetch() })).ok, false);
  assert.equal((await salonicOldalKulcs({ host: 'mosaic-hair.salonic.hu', uuid: 'nem-uuid', fetchImpl: salonicFetch() })).ok, false);
  const hivasok = []; await salonicOldalKulcs({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: async (u, o) => { hivasok.push(String(u)); return salonicFetch()(u, o); } });
  assert.ok(hivasok.every((u) => u.startsWith('https://mosaic-hair.salonic.hu/')), 'csak a Salonic-host kerdezheto');
});

// --- e-mail ----------------------------------------------------------------------------------------------------------------------------
test('emailElemzes: a valodi Salonic-level (feladonev, szolgaltatas, idopont-szoveg, munkatars, UUID, JSON-LD startDate); placeId / serviceId / employeeId nincs benne', () => {
  const html = fx('kulcs-email-hair.html');
  const e = emailElemzes(html);
  assert.deepEqual({ uuid: e.uuid, host: e.host, felado: e.felado, szolgaltatas: e.szolgaltatas, idopontSzoveg: e.idopontSzoveg, munkatarsak: e.munkatarsak },
    { uuid: UUID, host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)', idopontSzoveg: 'Október 20. (kedd) 18:00 - 18:30', munkatarsak: ['Noel - 20% kedvezmény!'] });
  assert.equal(e.ld.startDate, '2026-10-20T18:00:00+02:00');
  assert.equal(e.ld.reservationNumber, UUID);
  assert.ok(!/placeId|serviceId|employeeId/.test(html));
  assert.equal(emailElemzes('<html>semmi</html>').uuid, null);
});

// --- kulcs-tabla ------------------------------------------------------------------------------------------------------------------------
test('ANGOL HeadSpa-level: az emailElemzes a felado nevet a JSON-LD-bol, a munkatarsat az "Employees" reszbol olvassa; az angol honap / hetnap is megy; a 2. ag a paros kulcsot adja', () => {
  const html = fx('kulcs-email-headspa-en.html');
  const e = emailElemzes(html);
  const PUUID = '5a784724-399a-2c64-a88d-d189c675c88a';
  assert.deepEqual({ uuid: e.uuid, host: e.host, felado: e.felado, szolgaltatas: e.szolgaltatas, idopontSzoveg: e.idopontSzoveg, munkatarsak: e.munkatarsak },
    { uuid: PUUID, host: 'mosaicheadspa.salonic.hu', felado: 'Mosaic Headspa', szolgaltatas: '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)', idopontSzoveg: 'October 31. (Saturday) 15:30 - 16:50', munkatarsak: ['Páros kezelés'] });
  assert.equal(e.ld.startDate, '2026-10-31T15:30:00+01:00');
  assert.ok(!/placeId|serviceId|employeeId/.test(html));
  // angol szoveg: honap + hetnap; az ev a level datuma alapjan, elorefele; a hetnap validal
  const sz = idopontSzovegElemzes(e.idopontSzoveg);
  assert.deepEqual(sz, { ho: 10, nap: 31, hetnap: 'saturday', ora: 15, perc: 30 });
  assert.equal(evKovetkeztet(sz, Date.parse('2026-10-06T13:58:24Z') / 1000), 1793457000, '2026-10-31 15:30 (CET, UTC+1) = 1793457000');
  assert.equal(evKovetkeztet(idopontSzovegElemzes('October 31. (Saturday) 15:30'), Date.parse('2026-11-02T10:00:00Z') / 1000), null, 'a hetnap (angolul is) validal: a level utan 3 even belul nincs szombati okt. 31.');
  assert.equal(evKovetkeztet(idopontSzovegElemzes('October 31. (Sunday) 15:30'), Date.parse('2026-10-06T13:58:24Z') / 1000), budapestUnix(2027, 10, 31, 15, 30), 'a hetnap dont az evrol: a vasarnapi okt. 31. 2027-ben van (a mostani level evben nem szombat-egyezes)');
  assert.equal(evKovetkeztet(idopontSzovegElemzes('December 24. (Thursday) 10:00'), Date.parse('2026-10-06T13:58:24Z') / 1000), budapestUnix(2026, 12, 24, 10, 0));
  // 2. ag: nevtabla (felado -> placeId, munkatars -> employeeId, szolgaltatas -> serviceId); a paros kezeles EGY (virtualis) munkatars -> EGY kulcs
  const tabla = { frissitve: 1, helyek: [{ placeId: 10427, nev: 'Mosaic Headspa' }, { placeId: 10823, nev: 'Mosaic Hair' }], munkatarsak: [{ placeId: 10427, employeeId: 24354, nev: 'Páros kezelés' }, { placeId: 10427, employeeId: 24989, nev: 'Máté' }],
    szolgaltatasok: [{ placeId: 10427, serviceId: '302999', nev: '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)' }] };
  const r = emailKulcsNevtablabol(e, tabla, Date.parse('2026-10-06T13:58:24Z') / 1000);
  assert.deepEqual({ ok: r.ok, kulcsok: r.kulcsok, serviceId: r.serviceId, forras: r.nyom.idopontForras }, { ok: true, kulcsok: ['10427|24354|1793457000'], serviceId: '302999', forras: 'ld+json' });
  const csakSzoveg = emailKulcsNevtablabol({ ...e, ld: null }, tabla, Date.parse('2026-10-06T13:58:24Z') / 1000);
  assert.deepEqual(csakSzoveg.kulcsok, ['10427|24354|1793457000'], 'JSON-LD nelkul az angol szovegbol ugyanaz a kulcs');
});

test('kulcsIras: elso iras beker; ugyanaz ismet idempotens; MAS booking_id nem ir felul (utkozes naplozva)', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch };
  const t = ora();
  const a = await kulcsIras(adb, { bookingId: BID, bookingUrl: BOOKING_URL }, t());
  assert.deepEqual({ ok: a.ok, irva: a.irva, idempotens: a.idempotens, utkozes: a.utkozes, kulcs: a.kulcs, serviceId: a.serviceId }, { ok: true, irva: true, idempotens: false, utkozes: false, kulcs: KULCS, serviceId: '232804' });
  const b = await kulcsIras(adb, { bookingId: BID, bookingUrl: BOOKING_URL }, t());
  assert.deepEqual({ irva: b.irva, idempotens: b.idempotens, utkozes: b.utkozes }, { irva: false, idempotens: true, utkozes: false });
  const MAS = 'mb_0muwxxxxxxxxxxxxxxxxxxx';
  const c = await kulcsIras(adb, { bookingId: MAS, bookingUrl: BOOKING_URL.replace(BID, MAS) }, t());
  assert.deepEqual({ ok: c.ok, irva: c.irva, utkozes: c.utkozes, meglevo: c.meglevoBookingId }, { ok: true, irva: false, utkozes: true, meglevo: BID });
  assert.equal((await kulcsKeres(adb, KULCS, t())).booking_id, BID, 'felulirasnincs');
  assert.deepEqual(db.prepare('SELECT booking_id_elso, booking_id_uj FROM foglalas_kulcs_utkozes').all().map((r) => ({ ...r })), [{ booking_id_elso: BID, booking_id_uj: MAS }]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM foglalas_kulcs').get().n, 1);
});

test('kulcsIras: ervenytelen bemenet (azonosito, bookingUrl, a back mas azonosito) elutasitva; 180 napos megorzes, lejarat utan ujra irhato', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch };
  const t = ora(); await sema(adb);
  for (const rossz of [{ bookingId: 'g:2038420', bookingUrl: BOOKING_URL }, { bookingId: BID, bookingUrl: 'https://evil.example.com/x' }, { bookingId: 'mb_0muwxxxxxxxxxxxxxxxxxxx', bookingUrl: BOOKING_URL }]) assert.equal((await kulcsIras(adb, rossz, t())).ok, false);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM foglalas_kulcs').get().n, 0, 'elutasitott iras nem hagy nyomot');
  await kulcsIras(adb, { bookingId: BID, bookingUrl: BOOKING_URL }, t());
  const sor = db.prepare('SELECT letrehozva, lejar FROM foglalas_kulcs').get();
  assert.equal(sor.lejar - sor.letrehozva, MEGORZES_NAP * 86400); assert.equal(MEGORZES_NAP, 180);
  t.tick((MEGORZES_NAP * 86400) - 60); assert.ok(await kulcsKeres(adb, KULCS, t()), '179 nap 23 ora utan megvan');
  t.tick(120); assert.equal(await kulcsKeres(adb, KULCS, t()), null, '180 nap utan nem adjuk vissza');
  const UJ = 'mb_0muwyyyyyyyyyyyyyyyyyyy';
  const r = await kulcsIras(adb, { bookingId: UJ, bookingUrl: BOOKING_URL.replace(BID, UJ) }, t());
  assert.equal(r.irva, true, 'a lejart bejegyzes torlodik, az uj kulcs-ismetlodes beirhato');
});

// --- parositas ---------------------------------------------------------------------------------------------------------------------------
test('egyeztet (1. ag): a koszonooldal mar irt -> az e-mail megtalalja, kuldheto EGYSZER; ismetlesre es mas UUID-ra duplikalt (egy foglalasbol egy esemeny)', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora();
  await kulcsIras(adb, { bookingId: BID, bookingUrl: BOOKING_URL }, t());
  const deps = { fetchImpl: salonicFetch(), now: t };
  const r1 = await egyeztet(adb, MEZOK(), deps);
  assert.deepEqual({ allapot: r1.allapot, kuldheto: r1.kuldheto, duplikalt: r1.duplikalt, booking_id: r1.booking_id, esemeny_id: r1.esemeny_id, kulcs: r1.kulcs, forras: r1.kulcs_forras, service_egyezik: r1.service_egyezik },
    { allapot: 'parositott', kuldheto: true, duplikalt: false, booking_id: BID, esemeny_id: BID, kulcs: KULCS, forras: 'salonic-oldal', service_egyezik: true });
  for (let i = 0; i < 3; i++) { const r = await egyeztet(adb, MEZOK(), deps); assert.deepEqual({ k: r.kuldheto, d: r.duplikalt, b: r.booking_id }, { k: false, d: true, b: BID }); }
  // egy MASIK UUID (pl. ujrakuldott level) ugyanarra a kulcsra / booking_id-re: nem kuldheto
  const MASIK = '11111111-2222-3333-4444-555555555555';
  const fetch2 = async (u, o) => { // a masik UUID oldalai: ugyanaz a foglalas-oldal, a sajat UUID-javal
    const r = await salonicFetch()(String(u).split(MASIK).join(UUID), o); const txt = r.ok ? (await r.text()).split(UUID).join(MASIK) : '';
    return { ...r, text: async () => txt };
  };
  const r2 = await egyeztet(adb, { ...MEZOK(), uuid: MASIK }, { fetchImpl: fetch2, now: t });
  assert.equal(r2.allapot, 'ellentmondas', 'MAS UUID ugyanarra a kulcsra = kulcs-utkozes (pl. lemondas utan ujrafoglalt idopont): nem kuldunk, de nem is nyeljuk el csendben');
  assert.equal(r2.kuldheto, false, 'a booking_id-re mar ment esemeny'); assert.equal(r2.riasztas, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM foglalas_egyeztetes WHERE kuldve IS NOT NULL').get().n, 1, 'osszesen egy kikuldott esemeny');
  assert.deepEqual((await riasztasok(adb)).map((x) => [x.uuid, x.allapot]), [[MASIK, 'ellentmondas']], 'a riasztas listajan latszik');
  const ism = await egyeztet(adb, { ...MEZOK(), uuid: MASIK }, { fetchImpl: fetch2, now: t }); // ujrafuttatva sem kuldhet, a riasztas marad
  assert.deepEqual({ a: ism.allapot, k: ism.kuldheto }, { a: 'ellentmondas', k: false });
});

test('egyeztet: ujraprobalas 1, 3, 10, 30 perc; a korai kerest nem szamoljuk; az 5. keres utan parositatlan + riasztas; KESOBBI talalat is parosit (egyszer kuldheto)', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora();
  const deps = { fetchImpl: salonicFetch(), now: t };
  assert.deepEqual([...UJRAPROBA_MP], [60, 180, 600, 1800]);
  const lepesek = [];
  let r = await egyeztet(adb, MEZOK(), deps); lepesek.push([r.allapot, r.probalkozas, r.ujraprobal_mp]);
  r = await egyeztet(adb, MEZOK(), deps); assert.deepEqual([r.allapot, r.korai], ['fuggoben', true], 'a koran jott keres nem szamit probalkozasnak'); assert.equal(r.probalkozas, 1);
  for (const var_mp of [60, 180, 600, 1800]) { t.tick(var_mp); r = await egyeztet(adb, MEZOK(), deps); lepesek.push([r.allapot, r.probalkozas, r.ujraprobal_mp]); }
  assert.deepEqual(lepesek, [['fuggoben', 1, 60], ['fuggoben', 2, 180], ['fuggoben', 3, 600], ['fuggoben', 4, 1800], ['parositatlan', 5, undefined]]);
  assert.equal(r.riasztas, true); assert.equal(r.kuldheto, false);
  assert.equal((await riasztasok(adb)).length, 1);
  // a koszonooldal kesve ir -> a kovetkezo keres parosit (egyszer)
  await kulcsIras(adb, { bookingId: BID, bookingUrl: BOOKING_URL }, t());
  const k1 = await egyeztet(adb, MEZOK(), deps);
  assert.deepEqual({ a: k1.allapot, k: k1.kuldheto, keses: k1.keses, r: k1.riasztas }, { a: 'parositott', k: true, keses: true, r: false });
  const k2 = await egyeztet(adb, MEZOK(), deps); assert.deepEqual({ k: k2.kuldheto, d: k2.duplikalt }, { k: false, d: true });
  assert.equal((await riasztasok(adb)).length, 0, 'a riasztas megszunt');
});

test('egyeztet: ellentmondas (a serviceId nem egyezik a kulccsal) nem kuld; ervenytelen UUID elutasitva', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora();
  await kulcsIras(adb, { bookingId: BID, bookingUrl: BOOKING_URL.replace('serviceId=232804', 'serviceId=999999') }, t()); // ugyanaz a kulcs, mas szolgaltatas
  const r = await egyeztet(adb, MEZOK(), { fetchImpl: salonicFetch(), now: t });
  assert.deepEqual({ a: r.allapot, k: r.kuldheto, s: r.service_egyezik, riasztas: r.riasztas }, { a: 'ellentmondas', k: false, s: false, riasztas: true });
  assert.equal((await egyeztet(adb, { ...MEZOK(), uuid: 'x' }, { fetchImpl: salonicFetch(), now: t })).allapot, 'ervenytelen');
});

// --- nevfordito tabla (2. ag) ------------------------------------------------------------------------------------------------------------
const tablaHair = () => ({
  frissitve: 1, helyek: [{ placeId: 10823, nev: 'Mosaic Hair' }, { placeId: 14409, nev: 'Mosaic Oxigén' }],
  munkatarsak: [{ placeId: 10823, employeeId: 25095, nev: 'Noel - 20% kedvezmény!' }, { placeId: 10823, employeeId: 26064, nev: 'Evelin' }, { placeId: 10823, employeeId: 23694, nev: 'Betti' }, { placeId: 14409, employeeId: 31988, nev: 'Bozsoki - Harangozó Tündi' }],
  szolgaltatasok: [{ placeId: 10823, serviceId: '232804', nev: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)' }, { placeId: 14409, serviceId: '466147', nev: 'AKCIÓS Hajkamerás vizsgálat és konzultáció' }],
});
test('emailKulcsNevtablabol: felado -> placeId, munkatars (kedvezmeny-cimkevel is) -> employeeId, szolgaltatas -> serviceId (ellenorzo), idopont: JSON-LD, tartalekban a szoveg', () => {
  const o = emailKulcsNevtablabol(MEZOK(), tablaHair(), Date.parse('2026-10-06T13:36:32Z') / 1000);
  assert.deepEqual({ ok: o.ok, kulcsok: o.kulcsok, serviceId: o.serviceId, forras: o.nyom.idopontForras }, { ok: true, kulcsok: [KULCS], serviceId: '232804', forras: 'ld+json' });
  const szovegbol = emailKulcsNevtablabol({ ...MEZOK(), ld: null }, tablaHair(), Date.parse('2026-10-06T13:36:32Z') / 1000);
  assert.deepEqual({ ok: szovegbol.ok, kulcsok: szovegbol.kulcsok, forras: szovegbol.nyom.idopontForras }, { ok: true, kulcsok: [KULCS], forras: 'szoveg' });
  assert.equal(emailKulcsNevtablabol({ ...MEZOK(), munkatarsak: ['Noel'] }, tablaHair(), 1).kulcsok[0], KULCS, 'cimke nelkul is');
  assert.equal(emailKulcsNevtablabol({ ...MEZOK(), felado: 'Ismeretlen Szalon' }, tablaHair(), 1).ok, false);
  assert.equal(emailKulcsNevtablabol({ ...MEZOK(), munkatarsak: ['Valaki'] }, tablaHair(), 1).ok, false);
  assert.equal(emailKulcsNevtablabol({ ...MEZOK(), ld: null, idopontSzoveg: 'Október 21. (kedd) 18:00' }, tablaHair(), Date.parse('2026-10-06T00:00:00Z') / 1000).ok, false, 'a hetnap nem egyezik: nincs kitalalt ido');
  assert.equal(emailKulcsNevtablabol(MEZOK(), { helyek: [], munkatarsak: [], szolgaltatasok: [] }, 1).ok, false);
  assert.equal(norm('Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)'), norm('FODRÁSZ  konzultáció (9.900 Ft helyett most 0 Ft!)'));
});

test('egyeztet (2. ag): ha a Salonic-oldal nem erheto el, a nevtablabol parosit (forras: nevtabla); a nevtabla D1-ben el, es a frissito hivodik, ha ures', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora();
  await kulcsIras(adb, { bookingId: BID, bookingUrl: BOOKING_URL }, t());
  let frissitesek = 0;
  const deps = { fetchImpl: salonicFetch({ hiba: true }), now: t, nevtablaFrissito: async () => { frissitesek++; return tablaHair(); } };
  const r = await egyeztet(adb, MEZOK(), deps);
  assert.deepEqual({ a: r.allapot, k: r.kuldheto, f: r.kulcs_forras, kulcs: r.kulcs, s: r.service_egyezik }, { a: 'parositott', k: true, f: 'nevtabla', kulcs: KULCS, s: true });
  assert.equal(r.nyom.ag1.ok, false); assert.equal(frissitesek, 1);
  assert.equal((await nevtablaBetolt(adb)).munkatarsak.length, 4);
  // a tabla friss (24 oran belul): nem frissit ujra; 24 ora utan igen
  const MASIK = '22222222-3333-4444-5555-666666666666';
  await egyeztet(adb, { ...MEZOK(), uuid: MASIK }, deps); assert.equal(frissitesek, 1);
  t.tick(25 * 3600); await egyeztet(adb, { ...MEZOK(), uuid: '33333333-4444-5555-6666-777777777777' }, deps); assert.equal(frissitesek, 2, 'napi frissites');
});

test('nevtablaSalonicbol: a munkatars-oldalbol (azonosito + nev) es a Salonic-listabol (szolgaltatas); a fiok hibaja nem allitja meg a tobbit; nevtablaMent: ujrafuttatva nem duplaz', async () => {
  const fetchImpl = async (u) => {
    const s = String(u);
    if (s.includes('mosaic-hair.salonic.hu/employees/?placeId=10823')) return { ok: true, status: 200, url: s, text: async () => fx('kulcs-employees-hair.html') };
    if (s.includes('mosaic-oxigen.salonic.hu/employees/?placeId=14409')) return { ok: true, status: 200, url: s, text: async () => fx('kulcs-employees-oxigen.html') };
    return { ok: false, status: 404, url: s, text: async () => '' };
  };
  const adapterGyar = () => ({
    getPlace: async (uz) => ({ name: uz === 'hair' ? 'Mosaic Hair' : 'Mosaic Oxigén' }),
    getServices: async (uz) => (uz === 'hair' ? [{ serviceId: '232804', name: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)' }] : [{ serviceId: '466147', name: 'AKCIÓS Hajkamerás vizsgálat és konzultáció' }]),
    getStaff: async () => [],
  });
  const tabla = await nevtablaSalonicbol({ fetchImpl, adapterGyar, uzletagok: ['hair', 'oxygen', 'laser'] });
  assert.deepEqual(tabla.munkatarsak.filter((x) => x.placeId === 10823).map((x) => [x.employeeId, x.nev]).sort(), [[23694, 'Betti'], [25095, 'Noel - 20% kedvezmény!'], [26064, 'Evelin']]);
  assert.ok(tabla.munkatarsak.some((x) => x.placeId === 14409 && x.employeeId === 31988 && x.nev === 'Bozsoki - Harangozó Tündi'));
  assert.ok(tabla.helyek.some((x) => x.placeId === 10823 && x.nev === 'Mosaic Hair'));
  assert.deepEqual(tabla.szolgaltatasok.filter((x) => x.placeId === 10823).map((x) => x.serviceId), ['232804']);
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch };
  const n1 = await nevtablaMent(adb, tabla, 1000); const n2 = await nevtablaMent(adb, tabla, 2000);
  assert.equal(n1, n2); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM salonic_nevtabla').get().n, n1, 'ujrafuttatva nem duplaz');
  assert.equal((await nevtablaBetolt(adb)).frissitve, 2);
});

// --- HTTP ----------------------------------------------------------------------------------------------------------------------------------
const KULCS_SZOVEG = 'teszt-olvaso-kulcs';
const env = (db) => ({ KULCS_DB: { prepare: db.prepare, batch: db.batch }, EGYEZTETES_KULCS_HASH: crypto.createHash('sha256').update(KULCS_SZOVEG).digest('hex') });
const kerAzonos = (body, fej = {}) => new Request('https://x.pages.dev/api/foglalas-kulcs', { method: 'POST', headers: { origin: 'https://x.pages.dev', 'content-type': 'application/json', ...fej }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('HTTP /api/foglalas-kulcs: azonos eredetu POST ir; idegen eredet 403; ismeretlen mezo 400; tul nagy 413; ervenytelen 422; nincs adatbazis 503; GET kulcs nelkul 404, kulccsal a rekord', async () => {
  const D = d1(); const e = env(D);
  const ok = await kezelKulcs(kerAzonos({ booking_id: BID, booking_url: BOOKING_URL }), e);
  assert.equal(ok.status, 200); const j = await ok.json(); assert.deepEqual([j.irva, j.kulcs], [true, KULCS]);
  assert.equal((await (await kezelKulcs(kerAzonos({ booking_id: BID, booking_url: BOOKING_URL }), e)).json()).idempotens, true);
  assert.equal((await kezelKulcs(kerAzonos({ booking_id: BID, booking_url: BOOKING_URL }, { origin: 'https://evil.example.com' }), e)).status, 403);
  assert.equal((await kezelKulcs(new Request('https://x.pages.dev/api/foglalas-kulcs', { method: 'POST', body: '{}' }), e)).status, 403, 'nincs Origin / Sec-Fetch-Site');
  assert.equal((await kezelKulcs(kerAzonos({ booking_id: BID, booking_url: BOOKING_URL, extra: 1 }), e)).status, 400);
  assert.equal((await kezelKulcs(kerAzonos('nem json'), e)).status, 400);
  assert.equal((await kezelKulcs(kerAzonos('x'.repeat(3000)), e)).status, 413);
  assert.equal((await kezelKulcs(kerAzonos({ booking_id: 'rossz', booking_url: BOOKING_URL }), e)).status, 422);
  assert.equal((await kezelKulcs(kerAzonos({ booking_id: BID, booking_url: BOOKING_URL }), {})).status, 503);
  assert.equal((await kezelKulcs(new Request('https://x.pages.dev/api/foglalas-kulcs?k=' + KULCS), e)).status, 404);
  assert.equal((await kezelKulcs(new Request('https://x.pages.dev/api/foglalas-kulcs?kulcs=rossz&k=' + KULCS), e)).status, 404);
  const g = await (await kezelKulcs(new Request(`https://x.pages.dev/api/foglalas-kulcs?kulcs=${KULCS_SZOVEG}&k=${encodeURIComponent(KULCS)}`), e)).json();
  assert.equal(g.rekord.booking_id, BID);
});

test('HTTP /api/foglalas-egyeztetes: kulcs nelkul 404; POST parosit (e-mail HTML-bol is); GET allapot / riasztas (JSON + HTML piros szalag)', async () => {
  const D = d1(); const e = env(D); const t = ora();
  await kulcsIras(e.KULCS_DB, { bookingId: BID, bookingUrl: BOOKING_URL }, t());
  const post = (body, kulcs = KULCS_SZOVEG) => kezelEgyeztetes(new Request('https://x.pages.dev/api/foglalas-egyeztetes', { method: 'POST', headers: { 'x-egyeztetes-kulcs': kulcs }, body: JSON.stringify(body) }), e, { fetchImpl: salonicFetch(), now: t });
  assert.equal((await post({}, 'rossz')).status, 404);
  const r = await (await post({ email_html: fx('kulcs-email-hair.html'), level_datuma: '2026-10-06T13:36:32Z' })).json();
  assert.deepEqual({ ok: r.ok, a: r.allapot, k: r.kuldheto, id: r.esemeny_id }, { ok: true, a: 'parositott', k: true, id: BID });
  const g = await (await kezelEgyeztetes(new Request(`https://x.pages.dev/api/foglalas-egyeztetes?kulcs=${KULCS_SZOVEG}&uuid=${UUID}`), e)).json();
  assert.equal(g.allapot.allapot, 'parositott');
  // parositatlan -> riasztas
  const ALATT = '44444444-5555-6666-7777-888888888888';
  for (let i = 0; i < 5; i++) { t.tick(1900); await kezelEgyeztetes(new Request('https://x.pages.dev/api/foglalas-egyeztetes', { method: 'POST', headers: { 'x-egyeztetes-kulcs': KULCS_SZOVEG }, body: JSON.stringify({ ...MEZOK(), uuid: ALATT, host: 'mosaic-hair.salonic.hu', idopont_szoveg: MEZOK().idopontSzoveg, level_datuma: MEZOK().leveldatum }) }), e, { fetchImpl: salonicFetch({ hiba: true }), now: t }); }
  const lista = await (await kezelEgyeztetes(new Request(`https://x.pages.dev/api/foglalas-egyeztetes?kulcs=${KULCS_SZOVEG}&riasztas=1`), e)).json();
  assert.deepEqual([lista.riasztas, lista.db, lista.lista[0].uuid, lista.lista[0].allapot], [true, 1, ALATT, 'parositatlan']);
  const html = await (await kezelEgyeztetes(new Request(`https://x.pages.dev/api/foglalas-egyeztetes?kulcs=${KULCS_SZOVEG}&riasztas=1&formatum=html`), e)).text();
  assert.match(html, /FIGYELEM: 1 parositatlan/); assert.match(html, /#b00020/);
});

// --- a koszonooldal sajat szkriptje --------------------------------------------------------------------------------------------------------
function koszonoFuttat({ search, ctx = null, jelzett = false, valaszStatus = 200 }) {
  const hivasok = []; const tarolo = new Map(); if (ctx) tarolo.set('mhBookingCtx', JSON.stringify(ctx)); if (jelzett) tarolo.set('mhKulcsIrva:' + BID, '1');
  const sandbox = {
    URLSearchParams, URL, JSON, String, RegExp, Promise, console,
    location: { search }, sessionStorage: { getItem: (k) => (tarolo.has(k) ? tarolo.get(k) : null), setItem: (k, v) => tarolo.set(k, String(v)) },
    fetch: async (url, opt) => { hivasok.push({ url, opt }); return { ok: valaszStatus < 400, status: valaszStatus, json: async () => ({ ok: true }) }; },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(here, '..', 'assets', 'js', 'foglalas-kulcs.js'), 'utf8'), sandbox);
  return { hivasok, tarolo, sandbox };
}
const koszonoKeres = (back = BID) => '?first_booking=true&price=0&employee=Noel&g=g:3385039&bookingUrl=' + encodeURIComponent(BOOKING_URL.replace(BID, back));

test('koszonooldali szkript: a bookingUrl back-jebol ir (POST /api/foglalas-kulcs: booking_id + bookingUrl, keepalive); a valasz utan jelol; ujratoltesre nem ir ujra', async () => {
  const f = koszonoFuttat({ search: koszonoKeres() });
  assert.equal(f.hivasok.length, 1);
  assert.equal(f.hivasok[0].url, '/api/foglalas-kulcs'); assert.equal(f.hivasok[0].opt.method, 'POST'); assert.equal(f.hivasok[0].opt.keepalive, true);
  assert.deepEqual(JSON.parse(f.hivasok[0].opt.body), { booking_id: BID, booking_url: BOOKING_URL, forras: 'back' });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(f.tarolo.get('mhKulcsIrva:' + BID), '1'); assert.equal(f.sandbox.mhKulcsEredmeny.status, 200);
  assert.equal(koszonoFuttat({ search: koszonoKeres(), jelzett: true }).hivasok.length, 0, 'ujratoltes: nem ir ujra');
  const hiba = koszonoFuttat({ search: koszonoKeres(), valaszStatus: 503 }); await new Promise((r) => setTimeout(r, 10));
  assert.equal(hiba.tarolo.has('mhKulcsIrva:' + BID), false, 'a sikertelen iras nincs megjelolve (a kovetkezo betoltes ujraprobalja)');
});

test('koszonooldali szkript: nincs back -> a foglalo kontextusabol (csak ha a szolgaltatas es az idopont egyezik); egyebkent / bookingUrl nelkul / idegen host: semmi', () => {
  const ctx = { id: BID, service_id: '232804', slot_unix: 1792512000 };
  const c = koszonoFuttat({ search: koszonoKeres('').replace('&back%3D', '&back%3D'), ctx });
  assert.equal(c.hivasok.length, 1); assert.equal(JSON.parse(c.hivasok[0].opt.body).forras, 'ctx'); assert.equal(JSON.parse(c.hivasok[0].opt.body).booking_id, BID);
  assert.equal(koszonoFuttat({ search: koszonoKeres(''), ctx: { ...ctx, slot_unix: 1792512001 } }).hivasok.length, 0, 'mas idopont: nem a mi foglalasunk');
  assert.equal(koszonoFuttat({ search: koszonoKeres(''), ctx: { ...ctx, service_id: '1' } }).hivasok.length, 0, 'mas szolgaltatas');
  assert.equal(koszonoFuttat({ search: koszonoKeres('') }).hivasok.length, 0, 'nincs kontextus');
  assert.equal(koszonoFuttat({ search: '?first_booking=true&price=0' }).hivasok.length, 0, 'nincs bookingUrl');
  assert.equal(koszonoFuttat({ search: '?bookingUrl=' + encodeURIComponent('https://evil.example.com/guestData/?back=' + BID) }).hivasok.length, 0, 'idegen host');
  assert.equal(koszonoFuttat({ search: '?bookingUrl=' + encodeURIComponent('https://mosaic-hair.salonic.hu/masik/?back=' + BID) }).hivasok.length, 0, 'nem /guestData/');
});


// === kulcs-utkozes: elo ellenorzes, lemondasi ertesito, sorrend-fuggetlenseg (QA-1 ujrateszt kiegeszites) ===============================================================
const BA = BID, BB = 'mb_0muwqbbbbbbbbbbbbbbbbbb', UB = '11111111-2222-3333-4444-555555555555';
const bUrl = (id) => BOOKING_URL.replace(BID, id);
const levelIdo = (ms) => new Date(ms - 8000).toISOString(); // a Salonic a levelet masodpercekkel a foglalas utan kuldi
const UUID_MINTA_T = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
// a Salonic "szerver" UUID-nkenti ELO allapottal: 'aktiv' (a valodi megtekintes oldal) | 'torolve' ("Idopont torolve!") | 'hiba'
const eloFetch = (allapotok) => async (url) => {
  const u = String(url); const uuid = (u.match(UUID_MINTA_T) || [])[0]; const all = uuid && allapotok[uuid];
  const nem = { ok: false, status: all === 'hiba' ? 500 : 404, url: u, text: async () => '' };
  if (!all || all === 'hiba') return nem;
  const ok = (szoveg) => ({ ok: true, status: 200, url: u, text: async () => szoveg });
  if (u.includes('/booking/bookingDetails/')) return ok(all === 'torolve' ? fx('kulcs-torolve-hu.html') : fx('kulcs-bookingDetails-hair.html').split(UUID).join(uuid));
  if (u.includes('/selectDate/?startDate=')) return all === 'torolve' ? nem : ok(fx('kulcs-selectDate-modositas-hair.html'));
  return nem;
};
const NOTICE = (t) => ({ felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)', idopontSzoveg: 'Október 20. (kedd) 18:00 - 18:30', munkatarsak: ['Noel - 20% kedvezmény!'], leveldatum: new Date(t()).toISOString() });
/** A foglalas (A): a koszonooldal ir, az e-mail parositja (kuldve). */
async function lanc() {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora();
  await nevtablaMent(adb, tablaHair(), t());
  await kulcsIras(adb, { bookingId: BA, bookingUrl: bUrl(BA) }, t());
  const allapotok = { [UUID]: 'aktiv', [UB]: 'aktiv' };
  const deps = () => ({ fetchImpl: eloFetch(allapotok), now: t });
  const ra = await egyeztet(adb, MEZOK(), deps());
  return { db, adb, t, allapotok, deps, ra };
}
const bMezok = (L) => ({ ...MEZOK(), uuid: UB, leveldatum: levelIdo(L.t()) });

test('foglalasAllapot: elo / torolve (magyar es angol oldal) / ismeretlen; idegen host es rossz uuid nem kerdezheto', async () => {
  const f = (szoveg, status = 200) => async () => ({ ok: status === 200, status, url: 'x', text: async () => szoveg });
  assert.equal((await foglalasAllapot({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: f(fx('kulcs-bookingDetails-hair.html')) })).allapot, 'aktiv');
  assert.equal((await foglalasAllapot({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: f(fx('kulcs-torolve-hu.html')) })).allapot, 'torolve');
  assert.equal((await foglalasAllapot({ host: 'mosaicheadspa.salonic.hu', uuid: UUID, fetchImpl: f(fx('kulcs-torolve-en.html')) })).allapot, 'torolve', 'angol "Appointment deleted!"');
  assert.equal((await foglalasAllapot({ host: 'mosaicheadspa.salonic.hu', uuid: UUID, fetchImpl: f(fx('kulcs-aktiv-headspa-en.html')) })).allapot, 'aktiv', 'angol "Confirmed"');
  assert.equal((await foglalasAllapot({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: f('', 500) })).allapot, 'ismeretlen');
  assert.equal((await foglalasAllapot({ host: 'mosaic-hair.salonic.hu', uuid: UUID, fetchImpl: f('<html>valami mas</html>') })).allapot, 'ismeretlen');
  assert.equal((await foglalasAllapot({ host: 'evil.example.com', uuid: UUID, fetchImpl: f('') })).allapot, 'ismeretlen');
  assert.equal((await foglalasAllapot({ host: 'mosaic-hair.salonic.hu', uuid: 'nem-uuid', fetchImpl: f('') })).allapot, 'ismeretlen');
});

test('a LEMONDASI ertesito (magyar es angol): nincs UUID / link / JSON-LD; a szalon neve a zaro sorbol, a szolgaltatas / idopont / munkatars a szurke dobozbol es a munkatars-reszbol; tipus = lemondas', () => {
  const hu = emailElemzes(fx('kulcs-lemondas-hair-hu.html'));
  assert.deepEqual({ tipus: hu.tipus, uuid: hu.uuid, felado: hu.felado, szolgaltatas: hu.szolgaltatas, idopont: hu.idopontSzoveg, munk: hu.munkatarsak, ld: hu.ld }, { tipus: 'lemondas', uuid: null, felado: 'Mosaic Hair', szolgaltatas: '💇‍♂️ Férfi hajvágás', idopont: 'Október 30. (péntek) 19:30 - 20:00', munk: ['Evelin'], ld: null });
  const en = emailElemzes(fx('kulcs-lemondas-headspa-en.html'));
  assert.deepEqual({ tipus: en.tipus, uuid: en.uuid, felado: en.felado, szolgaltatas: en.szolgaltatas, idopont: en.idopontSzoveg, munk: en.munkatarsak }, { tipus: 'lemondas', uuid: null, felado: 'Mosaic Headspa', szolgaltatas: '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)', idopont: 'October 31. (Saturday) 15:30 - 16:50', munk: ['Páros kezelés'] });
  assert.equal(emailElemzes(fx('kulcs-email-hair.html')).tipus, 'letrehozva'); assert.equal(emailElemzes(fx('kulcs-email-headspa-en.html')).tipus, 'letrehozva');
});

test('SORREND 1/3: B a kulcsot foglaltnak talalja (A mar kiment) -> az A Salonic-oldala ELO ellenorizve: TOROLVE -> B kapja a kulcsot, B esemenye a sajat booking_id-ja', async () => {
  const L = await lanc(); assert.equal(L.ra.kuldheto, true); assert.equal(L.ra.esemeny_id, BA);
  L.t.tick(3600); L.allapotok[UUID] = 'torolve';
  assert.equal((await kulcsIras(L.adb, { bookingId: BB, bookingUrl: bUrl(BB) }, L.t())).utkozes, true, 'B koszonooldala: a kulcs foglalt');
  const rb = await egyeztet(L.adb, bMezok(L), L.deps());
  assert.deepEqual({ a: rb.allapot, k: rb.kuldheto, e: rb.esemeny_id, atadva: rb.kulcs_atadva }, { a: 'parositott', k: true, e: BB, atadva: true });
  assert.equal(rb.nyom.birtokos_ellenorzes.elo_allapot, 'torolve'); assert.equal(rb.nyom.birtokos_ellenorzes.birtokos_uuid, UUID);
  assert.equal(rb.nyom.jelolt_ellenorzes.elo_allapot, 'aktiv', 'a kulcs atkerulese elott a JELOLT (B) elo allapota is ellenorizve'); assert.equal(rb.jelolt_elo_allapot, 'aktiv');
  assert.equal((await kulcsKeres(L.adb, KULCS, L.t())).booking_id, BB, 'a kulcs birtoka B');
  assert.equal(L.db.prepare('SELECT COUNT(*) AS n FROM foglalas_kulcs_atadas').get().n, 1);
  assert.equal(L.db.prepare('SELECT COUNT(*) AS n FROM foglalas_egyeztetes WHERE kuldve IS NOT NULL').get().n, 2, 'ket foglalas, ket esemeny, mindegyik egyszer');
});

test('SORREND 1/3 (fordito): ha A ELO -> B ELLENTMONDAS + riasztas, nem kuld, a kulcs A-nal marad; ha A oldala nem ellenorizheto -> varakozas (ujraprobalas), nem dont', async () => {
  const L = await lanc(); L.t.tick(3600);
  await kulcsIras(L.adb, { bookingId: BB, bookingUrl: bUrl(BB) }, L.t());
  const rb = await egyeztet(L.adb, bMezok(L), L.deps()); // A aktiv
  assert.deepEqual({ a: rb.allapot, k: rb.kuldheto, r: rb.riasztas }, { a: 'ellentmondas', k: false, r: true });
  assert.match(rb.miert, /ELO Salonic-foglalas/); assert.equal((await kulcsKeres(L.adb, KULCS, L.t())).booking_id, BA);
  assert.deepEqual((await riasztasok(L.adb)).map((x) => [x.uuid, x.allapot]), [[UB, 'ellentmondas']]);
  // nem ellenorizheto (az A oldala hibat ad): nem dont, ujraprobal
  const M = await lanc(); M.t.tick(3600); M.allapotok[UUID] = 'hiba';
  await kulcsIras(M.adb, { bookingId: BB, bookingUrl: bUrl(BB) }, M.t());
  const rv = await egyeztet(M.adb, bMezok(M), M.deps());
  assert.deepEqual({ a: rv.allapot, k: rv.kuldheto, r: rv.riasztas }, { a: 'fuggoben', k: false, r: false }); assert.match(rv.miert, /nem ellenorizheto/);
});

test('SORREND 2/3: az A LEMONDASI ertesitoje B e-mailje ELOTT ert ide (B koszonooldala mar iras): a kulcs CSAK felszabadul (a jelolt elo allapota itt nem ellenorizheto), B levelenel - elo ellenorzes utan - veszi at', async () => {
  const L = await lanc(); L.t.tick(3600); L.allapotok[UUID] = 'torolve';
  assert.equal((await kulcsIras(L.adb, { bookingId: BB, bookingUrl: bUrl(BB) }, L.t())).utkozes, true);
  const n = await lemondasKezel(L.adb, NOTICE(L.t), L.deps());
  assert.deepEqual({ a: n.allapot, e: n.eredmenyek[0].elo_allapot, atadva: n.eredmenyek[0].atadva, v: n.eredmenyek[0].varakozo_jeloltek }, { a: 'lemondas', e: 'torolve', atadva: null, v: 1 }, 'nincs atadas jelolt-ellenorzes nelkul');
  assert.equal(await kulcsKeres(L.adb, KULCS, L.t()), null, 'a kulcs szabad (B meg nem veheti at: nincs UUID-ja)');
  const rb = await egyeztet(L.adb, bMezok(L), L.deps());
  assert.deepEqual({ a: rb.allapot, k: rb.kuldheto, e: rb.esemeny_id, atvett: rb.kulcs_atadva, elo: rb.jelolt_elo_allapot }, { a: 'parositott', k: true, e: BB, atvett: true, elo: 'aktiv' });
  assert.equal(rb.nyom.jelolt_ellenorzes.atvetel, 'szabad kulcs'); assert.equal((await kulcsKeres(L.adb, KULCS, L.t())).booking_id, BB);
  assert.equal(L.db.prepare('SELECT COUNT(*) AS n FROM foglalas_kulcs_atadas').get().n, 2, 'felszabadulas + atvetel, mindketto naplozva');
});

test('A KULCS BIRTOKA csak a JELOLT elo ellenorzese utan kerul at: a jelolt (B) torolt -> a regi birtokos torolve de B nem kap kulcsot (a kulcs felszabadul, a parositas megmarad); a jelolt nem ellenorizheto -> ujraprobalas, nincs atadas', async () => {
  // torolt jelolt
  const L = await lanc(); L.t.tick(3600); L.allapotok[UUID] = 'torolve'; L.allapotok[UB] = 'torolve';
  await kulcsIras(L.adb, { bookingId: BB, bookingUrl: bUrl(BB) }, L.t());
  const rb = await egyeztet(L.adb, bMezok(L), L.deps());
  assert.deepEqual({ a: rb.allapot, e: rb.esemeny_id, atvett: rb.kulcs_atadva, elo: rb.jelolt_elo_allapot, f: rb.kulcs_forras }, { a: 'parositott', e: BB, atvett: false, elo: 'torolve', f: 'nevtabla' }, 'az 1. ag nincs (torolt), a parositas igen');
  assert.equal(await kulcsKeres(L.adb, KULCS, L.t()), null, 'a torolt jelolt nem kapta meg a kulcsot; a kulcs szabad');
  assert.match(L.db.prepare('SELECT ok FROM foglalas_kulcs_atadas ORDER BY id DESC LIMIT 1').get().ok, /NEM kerult at/);
  // nem ellenorizheto jelolt: a regi birtokos torolve, de B oldala hibat ad
  const M = await lanc(); M.t.tick(3600); M.allapotok[UUID] = 'torolve'; M.allapotok[UB] = 'hiba';
  await kulcsIras(M.adb, { bookingId: BB, bookingUrl: bUrl(BB) }, M.t());
  const rv = await egyeztet(M.adb, bMezok(M), M.deps());
  assert.deepEqual({ a: rv.allapot, k: rv.kuldheto }, { a: 'fuggoben', k: false }); assert.match(rv.miert, /nem ellenorizheto/);
  assert.equal((await kulcsKeres(M.adb, KULCS, M.t())).booking_id, BA, 'a kulcs nem kerult at');
  assert.equal(M.db.prepare('SELECT COUNT(*) AS n FROM foglalas_kulcs_atadas').get().n, 0);
  // az oldal visszajon: a masodik probalkozas (a 60 mp utan) mar atvesz
  M.allapotok[UB] = 'aktiv'; M.t.tick(61);
  const rv2 = await egyeztet(M.adb, bMezok(M), M.deps());
  assert.deepEqual({ a: rv2.allapot, k: rv2.kuldheto, e: rv2.esemeny_id, atvett: rv2.kulcs_atadva }, { a: 'parositott', k: true, e: BB, atvett: true });
});

test('SORREND 2/3 (valtozat): az A lemondasi ertesitoje a B FOGLALAS ELOTT ert ide: a kulcs szabad lesz, B koszonooldala mar rendesen ir, B parosit', async () => {
  const L = await lanc(); L.t.tick(3600); L.allapotok[UUID] = 'torolve';
  const n = await lemondasKezel(L.adb, NOTICE(L.t), L.deps());
  assert.equal(n.eredmenyek[0].eredmeny, 'felszabadult'); assert.equal(await kulcsKeres(L.adb, KULCS, L.t()), null, 'a kulcs szabad');
  L.t.tick(600);
  const kb = await kulcsIras(L.adb, { bookingId: BB, bookingUrl: bUrl(BB) }, L.t()); assert.deepEqual({ i: kb.irva, u: kb.utkozes }, { i: true, u: false });
  const rb = await egyeztet(L.adb, bMezok(L), L.deps());
  assert.deepEqual({ a: rb.allapot, k: rb.kuldheto, e: rb.esemeny_id }, { a: 'parositott', k: true, e: BB });
});

test('SORREND 3/3: az A lemondasi ertesitoje B e-mailje UTAN ert ide: B mar megkapta a kulcsot (elo ellenorzes), az ertesito a B-t (ELO) nem szabadithatja fel', async () => {
  const L = await lanc(); L.t.tick(3600); L.allapotok[UUID] = 'torolve';
  await kulcsIras(L.adb, { bookingId: BB, bookingUrl: bUrl(BB) }, L.t());
  const rb = await egyeztet(L.adb, bMezok(L), L.deps()); assert.equal(rb.esemeny_id, BB); assert.equal(rb.kulcs_atadva, true);
  L.t.tick(30);
  const n = await lemondasKezel(L.adb, NOTICE(L.t), L.deps());
  assert.equal(n.eredmenyek[0].elo_allapot, 'aktiv'); assert.match(n.eredmenyek[0].eredmeny, /EL: a kulcs nem szabadul fel/);
  assert.equal((await kulcsKeres(L.adb, KULCS, L.t())).booking_id, BB, 'B kulcsa megmaradt');
  assert.equal(L.db.prepare('SELECT COUNT(*) AS n FROM foglalas_kulcs_atadas').get().n, 1, 'nem volt ujabb atadas');
});

test('az A letrehozasi levele NEM volt feldolgozva (nincs UUID-ja a tablaban): a levelek ideje dont (a koszonooldali iras ideje a level datumahoz legkozelebbi), mindket foglalas a sajat id-jat kapja, barmilyen sorrendben', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora(); await nevtablaMent(adb, tablaHair(), t());
  const aIdo = t(); await kulcsIras(adb, { bookingId: BA, bookingUrl: bUrl(BA) }, aIdo);
  t.tick(3600); const bIdo = t(); await kulcsIras(adb, { bookingId: BB, bookingUrl: bUrl(BB) }, bIdo);
  const allapotok = { [UUID]: 'torolve', [UB]: 'aktiv' }; const deps = { fetchImpl: eloFetch(allapotok), now: t };
  const rb = await egyeztet(adb, { ...MEZOK(), uuid: UB, leveldatum: levelIdo(bIdo) }, deps);   // B levele elobb
  assert.deepEqual({ a: rb.allapot, k: rb.kuldheto, e: rb.esemeny_id }, { a: 'parositott', k: true, e: BB });
  const ra = await egyeztet(adb, { ...MEZOK(), leveldatum: levelIdo(aIdo) }, deps);              // A KESEI levele (a foglalasa mar torolve: 1. ag nincs, nevtabla)
  assert.deepEqual({ a: ra.allapot, k: ra.kuldheto, e: ra.esemeny_id, f: ra.kulcs_forras }, { a: 'parositott', k: true, e: BA, f: 'nevtabla' });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM foglalas_egyeztetes WHERE kuldve IS NOT NULL').get().n, 2);
});

test('nem egyertelmu idoalapu parositas (ket szabad jelolt a levelhez 5 percen belul) -> ELLENTMONDAS + riasztas; az egyetlen, de napokkal regebbi jelolt nem parosit (ujraprobalas)', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora();
  const t0 = t(); await kulcsIras(adb, { bookingId: BA, bookingUrl: bUrl(BA) }, t0); await kulcsIras(adb, { bookingId: BB, bookingUrl: bUrl(BB) }, t0 + 60000);
  const deps = { fetchImpl: eloFetch({ [UB]: 'aktiv' }), now: t };
  const r = await egyeztet(adb, { ...MEZOK(), uuid: UB, leveldatum: levelIdo(t0 + 30000) }, deps);
  assert.deepEqual({ a: r.allapot, k: r.kuldheto, r: r.riasztas }, { a: 'ellentmondas', k: false, r: true }); assert.match(r.miert, /nem egyertelmu/);
  const M = d1(); const mdb = { prepare: M.prepare, batch: M.batch }; const t2 = ora(); const k0 = t2();
  await kulcsIras(mdb, { bookingId: BA, bookingUrl: bUrl(BA) }, k0);
  const r2 = await egyeztet(mdb, { ...MEZOK(), uuid: UB, leveldatum: levelIdo(k0 + 3 * 86400 * 1000) }, { fetchImpl: eloFetch({ [UB]: 'aktiv' }), now: t2 });
  assert.deepEqual({ a: r2.allapot, k: r2.kuldheto }, { a: 'fuggoben', k: false }); assert.match(r2.miert, /tul regi/);
});

const tablaHeadspa = () => ({ frissitve: 1, helyek: [{ placeId: 10427, nev: 'Mosaic Headspa' }],
  munkatarsak: [{ placeId: 10427, employeeId: 24354, nev: 'Páros kezelés' }, { placeId: 10427, employeeId: 27076, nev: 'Mirage Egyéni kezelő - Május' }, { placeId: 10427, employeeId: 24065, nev: 'Mirage Egyéni kezelő' }],
  szolgaltatasok: [{ placeId: 10427, serviceId: '302999', nev: '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)' }] });

test('TARTALEK AG, HeadSpa ANGOL level: a foglalas a level feldolgozasa elott torolve (1. ag nem megy) -> a nevtablabol parosit (forras: nevtabla); az angol LEMONDASI ertesito a kulcsot felszabaditja (elo ellenorzessel)', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora(Date.UTC(2026, 9, 6, 13, 58, 27)); await nevtablaMent(adb, tablaHeadspa(), t());
  const HID = 'mb_0muwquipszezqbdrx782d6m', HUUID = '5a784724-399a-2c64-a88d-d189c675c88a';
  await kulcsIras(adb, { bookingId: HID, bookingUrl: 'https://mosaicheadspa.salonic.hu/guestData/?anyone=true&employeeId=24354&placeId=10427&serviceId=302999&startDate=1793457000&back=' + HID }, t());
  const e = emailElemzes(fx('kulcs-email-headspa-en.html'));
  const levelM = { uuid: e.uuid, host: e.host, felado: e.felado, szolgaltatas: e.szolgaltatas, idopontSzoveg: e.idopontSzoveg, munkatarsak: e.munkatarsak, ld: e.ld, leveldatum: '2026-10-06T13:58:24Z' };
  const deps = { fetchImpl: eloFetch({ [HUUID]: 'torolve' }), now: t };
  const r = await egyeztet(adb, levelM, deps);
  assert.deepEqual({ a: r.allapot, k: r.kuldheto, e: r.esemeny_id, f: r.kulcs_forras, kulcs: r.kulcs, ag1: r.nyom.ag1.ok, miert: r.nyom.ag1.miert }, { a: 'parositott', k: true, e: HID, f: 'nevtabla', kulcs: '10427|24354|1793457000', ag1: false, miert: 'a foglalas torolve' });
  const n = emailElemzes(fx('kulcs-lemondas-headspa-en.html'));
  const lm = await lemondasKezel(adb, { felado: n.felado, szolgaltatas: n.szolgaltatas, idopontSzoveg: n.idopontSzoveg, munkatarsak: n.munkatarsak, leveldatum: '2026-10-06T14:02:04Z' }, deps);
  assert.deepEqual({ a: lm.allapot, kulcs: lm.eredmenyek[0].kulcs, elo: lm.eredmenyek[0].elo_allapot, e: lm.eredmenyek[0].eredmeny }, { a: 'lemondas', kulcs: '10427|24354|1793457000', elo: 'torolve', e: 'felszabadult' });
  assert.equal(await kulcsKeres(adb, '10427|24354|1793457000', t()), null);
});

test('ISMERETLEN munkatars-nev -> a fiok nevtablaja CELZOTTAN ujraepul (csak az a fiok, legfeljebb 10 percenkent), a keresest egyszer megismetli', async () => {
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora(Date.UTC(2026, 9, 6, 13, 58, 27));
  const hianyos = { ...tablaHeadspa(), munkatarsak: [{ placeId: 10427, employeeId: 24065, nev: 'Mirage Egyéni kezelő' }] }; await nevtablaMent(adb, hianyos, t());
  const HID = 'mb_0muwquipszezqbdrx782d6m', HUUID = '5a784724-399a-2c64-a88d-d189c675c88a';
  await kulcsIras(adb, { bookingId: HID, bookingUrl: 'https://mosaicheadspa.salonic.hu/guestData/?anyone=true&employeeId=24354&placeId=10427&serviceId=302999&startDate=1793457000&back=' + HID }, t());
  const e = emailElemzes(fx('kulcs-email-headspa-en.html')); const hivasok = [];
  const deps = { fetchImpl: eloFetch({ [HUUID]: 'torolve' }), now: t, nevtablaFrissito: async (uzletag) => { hivasok.push(uzletag); return tablaHeadspa(); } };
  const levelM = { uuid: e.uuid, host: e.host, felado: e.felado, szolgaltatas: e.szolgaltatas, idopontSzoveg: e.idopontSzoveg, munkatarsak: e.munkatarsak, ld: e.ld, leveldatum: '2026-10-06T13:58:24Z' };
  const r0 = await egyeztet(adb, levelM, deps);   // az epp most mentett tabla friss: a celzott ujraepites 10 percen belul nem fut
  assert.equal(r0.allapot, 'fuggoben'); assert.deepEqual(hivasok, []); t.tick(61);
  t.tick(11 * 60);
  const r = await egyeztet(adb, levelM, deps);    // 10 perc utan: celzott ujraepites, majd parosit
  assert.deepEqual(hivasok, ['headspa'], 'csak a HeadSpa fiok');
  assert.deepEqual({ a: r.allapot, k: r.kuldheto, f: r.kulcs_forras }, { a: 'parositott', k: true, f: 'nevtabla' }); assert.equal(r.nyom.ag2.nevtabla_celzott_ujraepites, 'headspa');
});

test('nevtablaSalonicbol (HeadSpa / Elysion): MINDEN munkatars-azonosito a szolgaltatas-listabol, a nev a nyilvanos /employees/<id> oldal cimebol (a szabad idopont nelkuli is); az altalanos cim nem nev; a naptar-API neve alias', async () => {
  const oldal = (cim) => `<html><head><title>${cim}</title></head><body></body></html>`;
  const fetchImpl = async (u) => {
    const s = String(u); const ok = (h, status = 200) => ({ ok: status === 200, status, url: s, text: async () => h });
    if (s.includes('/employees/?placeId=')) return ok(oldal('Mosaic Headspa appointment online booking'));
    if (s.endsWith('/employees/24065')) return ok(oldal('Mosaic Headspa - Mirage Egyéni kezelő'));
    if (s.endsWith('/employees/27076')) return ok(oldal('Mosaic Headspa - Mirage Egyéni kezelő - Május'));
    if (s.endsWith('/employees/24354')) return ok(oldal('Mosaic Headspa - Páros kezelés'));
    if (s.endsWith('/employees/99999')) return ok(oldal('Mosaic Headspa online időpontfoglalás')); // nem munkatars-oldal
    return ok('', 404);
  };
  const adapterGyar = () => ({
    getPlace: async () => ({ name: 'Mosaic Headspa' }),
    getServices: async () => [{ serviceId: '302342', name: 'Egyéni', staffIds: ['24065', '27076', '99999'] }, { serviceId: '302999', name: 'Páros', staffIds: ['24354'] }],
    getStaff: async (uz, sid) => (sid === '302342' ? [{ staff_id: '24065', staff_label: 'Mirage Egyéni kezelő (naptár)' }, { staff_id: '27076', staff_label: null }] : [{ staff_id: '24354', staff_label: 'Páros kezelés' }]),
  });
  const tabla = await nevtablaSalonicbol({ fetchImpl, adapterGyar, uzletagok: ['headspa'] });
  const nevek = {}; for (const m of tabla.munkatarsak) (nevek[m.employeeId] = nevek[m.employeeId] || []).push(m.nev);
  assert.deepEqual(nevek, { 24065: ['Mirage Egyéni kezelő', 'Mirage Egyéni kezelő (naptár)'], 27076: ['Mirage Egyéni kezelő - Május'], 24354: ['Páros kezelés'] }, 'a szabad idopont nelkuli 27076 is megvan; az alias is');
  assert.deepEqual(tabla.hianyzoNevek, [{ placeId: 10427, employeeId: 99999 }], 'a nev nelkuli azonosito jelezve');
  assert.equal(munkatarsNevOldalbol(oldal('Mosaic Hair - Noel - 20% kedvezmény!'), 'Mosaic Hair'), 'Noel - 20% kedvezmény!');
  assert.equal(munkatarsNevOldalbol(oldal('Mosaic Oxigén online időpontfoglalás'), 'Mosaic Hair'), null);
  assert.equal(munkatarsNevOldalbol(oldal('Mas Szalon - Valaki'), 'Mosaic Hair'), null, 'mas fiok neve nem fogadhato el');
  // az alias-sorok mentese / betoltese: azonos employeeId, ket nev, nem duplaz
  const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; await nevtablaMent(adb, tabla, 1000); await nevtablaMent(adb, tabla, 2000);
  const be = await nevtablaBetolt(adb); assert.equal(be.munkatarsak.filter((m) => m.employeeId === 24065).length, 2); assert.equal(be.munkatarsak.length, 4);
  const jelolt = emailKulcsNevtablabol({ felado: 'Mosaic Headspa', szolgaltatas: 'Páros', munkatarsak: ['Mirage Egyéni kezelő - Május'], idopontSzoveg: 'October 31. (Saturday) 15:30', ld: { startDate: '2026-10-31T15:30:00+01:00' } }, be, 1);
  assert.deepEqual(jelolt.kulcsok, ['10427|27076|1793457000'], 'a 27076-os (kulonbozo nevu) munkatars nem keveredik a 24065-oel');
});
test('emailElemzes: a szalonnak szolo "Uj online foglalas erkezett" level "Foglalas megtekintese" linkjebol (calendar/showBooking/?bookingId=) is kiolvassa a UUID-t es a hostot; idegen host nem fogadhato el', () => {
  const u = '2aae042b-7acf-30e2-017f-66febe61e2e3';
  const a = emailElemzes(`<a href="https://mosaicheadspa.salonic.hu/calendar/showBooking/?bookingId=${u}">Foglalás megtekintése</a>`);
  assert.deepEqual([a.uuid, a.host], [u, 'mosaicheadspa.salonic.hu']);
  assert.deepEqual([emailElemzes(`<a href="https://mosaic-pmu.salonic.hu/calendar/showBooking/?x=1&amp;bookingId=${u}">x</a>`).uuid, emailElemzes(`<a href="https://evil.example.com/calendar/showBooking/?bookingId=${u}">x</a>`).uuid], [u, null]);
});
test('/api/foglalas-egyeztetes: a torzs felso hatara 256 KB (egy teljes level-HTML elfer), efelett 413', async () => {
  const { db, ...D } = d1(); const e = { KULCS_DB: { prepare: D.prepare, batch: D.batch }, EGYEZTETES_KULCS_HASH: crypto.createHash('sha256').update('k').digest('hex') };
  const post = (body) => kezelEgyeztetes(new Request('https://x.pages.dev/api/foglalas-egyeztetes', { method: 'POST', headers: { 'x-egyeztetes-kulcs': 'k' }, body }), e, { fetchImpl: async () => ({ status: 404, text: async () => '' }) });
  assert.notEqual((await post(JSON.stringify({ email_html: 'x'.repeat(120000) }))).status, 413, '120 KB level-HTML elfogadott');
  assert.equal((await post(JSON.stringify({ email_html: 'x'.repeat(300000) }))).status, 413);
});
test('ELETUT-horog (DECISION #102): a lemondasi ertesito, ha a kulcs birtokosanak foglalasa ELO ellenorzessel torolve -> az eletutKuldo a birtokos booking_id-jara "lemondva" allapottal hivodik (csak MERES_ELOSZTO + MERES_ELETUT mellett; a hiba nem akasztja a felszabadulast)', async () => {
  const HID = 'mb_0muwquipszezqbdrx782d6m', HUUID = '5a784724-399a-2c64-a88d-d189c675c88a';
  const felallit = async () => { // minden forgatokonyv friss allapotbol indul (az elso lemondasi ertesito felszabaditja a kulcsot)
    const { db, ...D } = d1(); const adb = { prepare: D.prepare, batch: D.batch }; const t = ora(Date.UTC(2026, 9, 6, 13, 58, 27)); await nevtablaMent(adb, tablaHeadspa(), t());
    await kulcsIras(adb, { bookingId: HID, bookingUrl: 'https://mosaicheadspa.salonic.hu/guestData/?anyone=true&employeeId=24354&placeId=10427&serviceId=302999&startDate=1793457000&back=' + HID }, t());
    const e = emailElemzes(fx('kulcs-email-headspa-en.html'));
    await egyeztet(adb, { uuid: e.uuid, host: e.host, felado: e.felado, szolgaltatas: e.szolgaltatas, idopontSzoveg: e.idopontSzoveg, munkatarsak: e.munkatarsak, ld: e.ld, leveldatum: '2026-10-06T13:58:24Z' }, { fetchImpl: eloFetch({ [HUUID]: 'torolve' }), now: t });
    return { adb, t, E: { KULCS_DB: adb, EGYEZTETES_KULCS_HASH: crypto.createHash('sha256').update(KULCS_SZOVEG).digest('hex'), MERES_ELOSZTO: '1', MERES_ELETUT: '1' } };
  };
  const post = ({ E, t }, env, deps) => kezelEgyeztetes(new Request('https://x.pages.dev/api/foglalas-egyeztetes', { method: 'POST', headers: { 'x-egyeztetes-kulcs': KULCS_SZOVEG }, body: JSON.stringify({ email_html: fx('kulcs-lemondas-headspa-en.html'), level_datuma: '2026-10-06T14:02:04Z' }) }), env || E, { fetchImpl: eloFetch({ [HUUID]: 'torolve' }), now: t, ...deps });
  const hivasok = []; const kuldo = async (a) => { hivasok.push(a); return { allapot: 'kesz' }; };
  const A = await felallit(); const j = await (await post(A, null, { eletutKuldo: kuldo })).json();
  assert.equal(hivasok.length, 1); assert.deepEqual([hivasok[0].source_id, hivasok[0].allapot, hivasok[0].forras, hivasok[0].ido], [HID, 'lemondva', 'lemondasi_ertesito', Math.floor(Date.UTC(2026, 9, 6, 14, 2, 4) / 1000)]);
  assert.deepEqual([j.eredmenyek[0].eredmeny, j.eredmenyek[0].eletut], ['felszabadult', { allapot: 'kesz' }]);
  hivasok.length = 0; const B = await felallit();
  await post(B, { ...B.E, MERES_ELETUT: '0' }, { eletutKuldo: kuldo }); assert.equal(hivasok.length, 0, 'MERES_ELETUT nelkul nincs horog');
  const C = await felallit(); const hiba = await (await post(C, null, { eletutKuldo: async () => { throw new Error('boom'); } })).json();
  assert.deepEqual([hiba.ok, hiba.eredmenyek[0].eredmeny, hiba.eredmenyek[0].eletut.allapot], [true, 'felszabadult', 'hiba'], 'a hiba nem akasztja meg a felszabadulast');
});
