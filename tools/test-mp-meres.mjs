// MP meresi reteg (netlify/lib/mp/meres.js) - adatminimalizalas, kulcs, ertek, tipus, 5 mutato.
import test from 'node:test';
import assert from 'node:assert/strict';
import { koszonoOldal, tipusNormal, foglalasKulcs, esemenyId, ertekFeloldas, kifeleEsemeny, vanErzekeny, otMutato, HELYSZINEK, SEMLEGES_URL } from '../netlify/lib/mp/meres.js';

const burl = (place = 12169, emp = 555, start = 1791700000, svc = 9001) =>
  encodeURIComponent(`https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=${place}&serviceId=${svc}&employeeId=${emp}&startDate=${start}`);
const ko = (ut = 'foglalas-ok-mi', extra = '') => `https://www.medicalpiercing.hu/${ut}?first_booking=true&location=Szeged&employee=X&bookingUrl=${burl()}&price=24900&service=Migr%C3%A9n%20piercing&g=2038420&category=Gy%C3%B3gy${extra}`;

test('koszonooldal: kulcs, ar, uj vendeg, tipus a parameterekbol', () => {
  const r = koszonoOldal(ko());
  assert.equal(r.ok, true);
  assert.deepEqual({ ...r.adat }, { placeId: 12169, employeeId: 555, startUnix: 1791700000, serviceId: 9001, ar: 24900, ujVendeg: true, tipus: 'migren', kategoria: 'Gyógy', szolgaltatas: 'Migrén piercing', vendeg: '2038420' });
  assert.equal(foglalasKulcs(r.adat), '12169|555|1791700000');
  assert.equal(esemenyId(r.adat), 'Foglalas:12169|555|1791700000');
});

test('koszonooldal: ismeretlen helyszin es hianyos kulcs elutasitva', () => {
  assert.equal(koszonoOldal(ko().replace('placeId%3D12169', 'placeId%3D1')).hiba, 'ismeretlen_helyszin');
  assert.equal(koszonoOldal('https://www.medicalpiercing.hu/foglalas-ok?bookingUrl=' + encodeURIComponent('https://medicalpiercing.salonic.hu/?placeId=6029')).hiba, 'hianyos_kulcs');
  assert.equal(koszonoOldal('nem url').hiba, 'rossz_url');
});

test('15 helyszin, mind semleges varoskod', () => {
  assert.equal(Object.keys(HELYSZINEK).length, 15);
  for (const v of Object.values(HELYSZINEK)) assert.match(v, /^[a-z]+$/);
});

test('tipus: utvonalbol, csomagbol, nevbol, kulonben egyeb', () => {
  assert.equal(tipusNormal('/foglalas-ok-2piercing'), '2piercing');
  assert.equal(tipusNormal('/foglalas-ok', '3 db piercing akcio'), '3piercing');
  assert.equal(tipusNormal('/foglalas-ok', 'Páros piercing'), 'paros');
  assert.equal(tipusNormal('/foglalas-ok', 'Valami más'), 'egyeb');
});

test('ertek: koszonooldal > arlista > hianyzik (soha 0 Ft)', () => {
  assert.deepEqual(ertekFeloldas({ ar: 24900 }), { ertek: 24900, ertek_forras: 'koszonooldal', ertek_hianyzik: false });
  assert.deepEqual(ertekFeloldas({ ar: null, serviceId: 7 }, { 7: 41900 }), { ertek: 41900, ertek_forras: 'arlista', ertek_hianyzik: false });
  assert.deepEqual(ertekFeloldas({ ar: 0, serviceId: 8 }, { 7: 41900 }), { ertek: null, ertek_forras: null, ertek_hianyzik: true });
});

test('kifele: CSAK minimalis mezok, semleges URL, 0 egeszsegugyi adat, 0 vendegazonosito', () => {
  const f = { ...koszonoOldal(ko()).adat, ertek: 24900, ido: 1791600000 };
  const ki = kifeleEsemeny(f, { hozzajarulas: true, hash: { em: 'a'.repeat(64), ph: 'b'.repeat(64) }, kattintas: { fbc: 'fb.1.1.migrenSlimXYZ', gclid: 'Cj0K' } });
  assert.deepEqual(Object.keys(ki).sort(), ['em', 'ertek', 'esemeny', 'esemeny_id', 'fbc', 'forras_url', 'gclid', 'helyszin', 'ido', 'penznem', 'ph', 'uj_vendeg'].sort());
  assert.equal(ki.forras_url, SEMLEGES_URL);
  assert.equal(ki.helyszin, 'szeged');
  const s = JSON.stringify({ ...ki, fbc: '', em: '', ph: '', gclid: '' });
  for (const tiltott of ['migr', 'Migr', '2038420', 'bookingUrl', 'Gyógy', 'service', 'category', 'foglalas-ok-']) assert.equal(s.includes(tiltott), false, tiltott);
});

test('kifele: hozzajarulas nelkul nincs hash es kattintasazonosito', () => {
  const ki = kifeleEsemeny({ placeId: 6029, employeeId: 1, startUnix: 2, ujVendeg: false, ertek: null }, { hozzajarulas: false, hash: { em: 'x' }, kattintas: { fbc: 'y' } });
  assert.equal('em' in ki || 'fbc' in ki || 'ertek' in ki, false);
  assert.equal(ki.uj_vendeg, 'nem');
});

test('vedohalo: erzekeny tartalom felismerese', () => {
  assert.equal(vanErzekeny({ a: 'https://www.medicalpiercing.hu/foglalas-ok-klimax' }), true);
  assert.equal(vanErzekeny({ a: '?g=123' }), true);
  assert.equal(vanErzekeny({ helyszin: 'bp', forras_url: SEMLEGES_URL }), false);
});

test('5 mutato + duplikacio + forras szerinti bontas', () => {
  const sorok = [
    { salonic_id: 'a', d1: true, forras: 'oldal', hozzajarulas: true, fbclid: true, fbc: true, fbp: true },
    { salonic_id: 'b', d1: true, forras: 'oldal', hozzajarulas: false, fbclid: true, fbc: true, fbp: false },
    { salonic_id: 'c', d1: true, forras: 'salonic', hozzajarulas: true, fbclid: false, fbc: false, fbp: true },
    { salonic_id: 'c', d1: true, forras: 'salonic', hozzajarulas: true, fbclid: false, fbc: false, fbp: true },
    { salonic_id: 'd', d1: false },
  ];
  const m = otMutato(sorok, 4);
  assert.deepEqual(m.lefedettseg, { db: 3, osszes: 4, szazalek: 75 });
  assert.equal(m.duplikacio, 1);
  assert.equal(m.osszes.fbc.db, 1);           // hozzajarulas nelkuli fbc nem szamit
  assert.equal(m.osszes.plusz_azonosito.db, 3);
  assert.equal(m.oldalrol.meta_kattintas.db, 2);
  assert.equal(m.salonicbol.meta_kattintas.db, 0);
});
