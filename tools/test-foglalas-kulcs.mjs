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
  kulcsIras, kulcsKepez, kulcsKeres, modositasOldalElemzes, nevtablaBetolt, nevtablaMent, nevtablaSalonicbol, norm, reszletekOldalElemzes, riasztasok, salonicOldalKulcs, sema,
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
  assert.equal(r2.allapot, 'parositott'); assert.equal(r2.kuldheto, false, 'a booking_id-re mar ment esemeny');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM foglalas_egyeztetes WHERE kuldve IS NOT NULL').get().n, 1, 'osszesen egy kikuldott esemeny');
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
