// A SalonicAdapter egysegtesztjei (Node beepitett tesztfuttato, nincs uj fuggoseg):
//   node --test tools/test-salonic-adapter.mjs
// Elo, csak olvaso kiserlet (a Salonic nyilvanos oldalait kerdezi, foglalast nem hoz letre):
//   $env:LIVE='1'; node --test tools/test-salonic-adapter.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUSINESSES, SalonicError, createSalonicAdapter, decodeEntities, parseCalendarId, parseServices, parseSpecs, slotsFromApi, verifyConfirmation,
} from '../assets/js/booking-engine/salonic-adapter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (f) => fs.readFileSync(path.join(here, 'fixtures', 'salonic', f), 'utf8');
const apiFixture = () => JSON.parse(fx('hair-availability.json'));

// --- tiszta fuggvenyek -----------------------------------------------------------------------------------------------
test('decodeEntities: a Salonic attributumaiban szereplo entitasok', () => {
  assert.equal(decodeEntities('Tom &amp; Jerry &quot;x&quot; &#039;y&#39;'), `Tom & Jerry "x" 'y'`);
});

test('parseServices (PMU): ar, listaar, idotartam; ures ar = null, nem 0', () => {
  const s = parseServices(fx('pmu-employees.html'));
  assert.equal(s.length, 4);
  assert.deepEqual(s[0], { serviceId: '471160', name: 'Ingyenes konzultáció', durationMin: 30, activePrice: null, listPrice: null, staffIds: [] });
  assert.equal(s[1].serviceId, '471034');
  assert.equal(s[1].activePrice, 99000);
  assert.equal(s[1].listPrice, 124900);
  assert.equal(s[1].durationMin, 120);
});

test('parseServices (Hair): munkatars-azonositok, emoji a nevben, ismetlodo azonosito kimarad', () => {
  const html = fx('hair-showServices.html');
  const s = parseServices(html + html);
  assert.equal(s.length, 3);
  assert.deepEqual(s[0].staffIds, ['23694', '25095', '26064']);
  assert.match(s[0].name, /^☀ Balayage/);
  assert.equal(s[0].activePrice, 42950);
  assert.equal(s[0].listPrice, null);
});

test('parseServices (HeadSpa): a Salonic idezojel-kezeles nelkuli data-name erteke nem csonkul', () => {
  const s = parseServices(fx('headspa-showServices.html'));
  assert.equal(s.length, 4);
  assert.match(s[0].name, /MOSAIC "Relax" Head Spa kezelés \+ 30 perc hajszárítás$/);
  assert.match(s[1].name, /MOSAIC "Hair" Head Spa/);
  assert.notEqual(s[0].name, s[1].name, 'a ket Egyeni valtozat megkulonboztetheto');
  assert.equal(s[0].activePrice, 26900);
  assert.equal(s[0].durationMin, 80);
  assert.deepEqual(s[0].staffIds, ['24065', '24989', '27076', '29415']);
});

test('parseSpecs: kategoriak a showServices linkekbol, duplikatum nelkul', () => {
  assert.deepEqual(parseSpecs(fx('headspa-selectSpecialization.html')).map((x) => x.specId), ['39592', '41471']);
});

test('parseCalendarId', () => {
  assert.equal(parseCalendarId(fx('selectDate-snippet.html')), 'f2bf7672-fa03-f092-e14b-fc23577e5ab2');
  assert.equal(parseCalendarId('<html></html>'), null);
});

const hairService = { serviceId: '231532', durationMin: 180, listPrice: null, activePrice: 42950 };

test('slotsFromApi: slot-szerzodes, "-1" helykitolto kimarad, rendezett', () => {
  const slots = slotsFromApi(apiFixture(), { business: 'hair', service: hairService });
  assert.ok(slots.length >= 3, 'legalabb nehany szabad idopont');
  assert.ok(slots.every((s) => s.staff_id !== '-1'));
  for (let i = 1; i < slots.length; i++) assert.ok(slots[i - 1].start_unix <= slots[i].start_unix);
  const s = slots[0];
  assert.deepEqual(Object.keys(s).sort(), ['available', 'end_at', 'final_price', 'formatted', 'list_price', 'pricing_rule', 'service_id', 'slot_id', 'staff_id', 'staff_label', 'start_at', 'start_unix'].sort());
  assert.equal(s.slot_id, `hair:231532:${s.staff_id}:${s.start_unix}`);
  assert.equal(new Date(s.end_at) - new Date(s.start_at), 180 * 60 * 1000);
  assert.equal(s.final_price, 42950);
  assert.equal(s.pricing_rule, null);
  assert.equal(s.available, true);
  assert.ok(s.staff_label && s.staff_label.length > 0);
});

test('slotsFromApi: a minUnix elotti idopontok kimaradnak', () => {
  const all = slotsFromApi(apiFixture(), { business: 'hair', service: hairService });
  const later = slotsFromApi(apiFixture(), { business: 'hair', service: hairService, minUnix: all[0].start_unix });
  assert.equal(later.length, all.filter((s) => s.start_unix > all[0].start_unix).length);
});

test('slotsFromApi: nem sikeres API-valaszra API_STATUS hiba', () => {
  assert.throws(() => slotsFromApi({ status: 'error' }, { business: 'hair', service: hairService }), (e) => e instanceof SalonicError && e.code === 'API_STATUS');
});

// --- verifyConfirmation -----------------------------------------------------------------------------------------------
const START = 1791360000;
const bookingUrl = (host, place, svc, start) => `${host}/guestData/?placeId=${place}&serviceId=${svc}&startDate=${start}`;
const redirect = (over = {}) => {
  const q = new URLSearchParams({
    first_booking: 'true', price: '79000', employee: 'Melitta', location: 'Mosaic PMU', service: 'Szemöldök tetoválás - Hibrid', g: 'abc123',
    bookingUrl: bookingUrl('https://mosaic-pmu.salonic.hu', 14585, '471153', START), ...over,
  });
  for (const [k, v] of Object.entries(over)) if (v === null) q.delete(k);
  return '/pmu-ok?' + q;
};
const pmuExpected = { business: 'pmu', serviceId: '471153', startUnix: START, staffId: -1, activePrice: 79000 };

test('verifyConfirmation: minden egyezik', () => {
  const r = verifyConfirmation(redirect(), pmuExpected);
  assert.equal(r.ok, true);
  assert.equal(r.checks.staff.status, 'skipped');
  assert.equal(r.bookingRef, `abc123-471153-${START}`);
  assert.equal(r.bookingRefKind, 'synthetic');
  assert.equal(r.firstBooking, true);
  assert.equal(r.reported.employee, 'Melitta');
  assert.match(r.attestation, /kliensoldali/);
});

test('verifyConfirmation: first_booking=false = visszatero', () => {
  assert.equal(verifyConfirmation(redirect({ first_booking: 'false' }), pmuExpected).firstBooking, false);
});

test('verifyConfirmation: eltero ar elbukik; formazott ar ("79 000 Ft") egyezik', () => {
  assert.equal(verifyConfirmation(redirect({ price: '59000' }), pmuExpected).checks.price.status, 'fail');
  assert.equal(verifyConfirmation(redirect({ price: '59000' }), pmuExpected).ok, false);
  assert.equal(verifyConfirmation(redirect({ price: '79 000 Ft' }), pmuExpected).checks.price.status, 'pass');
});

test('verifyConfirmation: eltero idopont / szolgaltatas / hely elbukik', () => {
  assert.equal(verifyConfirmation(redirect({ bookingUrl: bookingUrl('https://mosaic-pmu.salonic.hu', 14585, '471153', START + 900) }), pmuExpected).checks.slot.status, 'fail');
  assert.equal(verifyConfirmation(redirect({ bookingUrl: bookingUrl('https://mosaic-pmu.salonic.hu', 14585, '471154', START) }), pmuExpected).checks.service.status, 'fail');
  assert.equal(verifyConfirmation(redirect({ bookingUrl: bookingUrl('https://mosaic-hair.salonic.hu', 10823, '471153', START) }), pmuExpected).checks.place.status, 'fail');
});

test('verifyConfirmation: hianyzo parameterek (nincs bookingUrl / price) elbukik, nem dob', () => {
  const a = verifyConfirmation(redirect({ bookingUrl: null }), pmuExpected);
  assert.equal(a.ok, false);
  assert.equal(a.checks.params.status, 'fail');
  assert.equal(a.bookingRef, null);
  assert.equal(verifyConfirmation(redirect({ price: null }), pmuExpected).ok, false);
  assert.equal(verifyConfirmation('/pmu-ok', pmuExpected).ok, false);
});

test('verifyConfirmation: kivalasztott munkatars neve (promos cimkevel is) egyezik, mas nem', () => {
  const hairUrl = (employee) => '/fodrasz-ok?' + new URLSearchParams({ first_booking: 'true', price: '34360', employee, location: 'Mosaic Hair', service: 'Balayage', g: 'zz9', bookingUrl: bookingUrl('https://mosaic-hair.salonic.hu', 10823, '231532', START) });
  const exp = { business: 'hair', serviceId: '231532', startUnix: START, staffId: '25095', staffName: 'Noel - 20% kedvezmény!', activePrice: 34360 };
  assert.equal(verifyConfirmation(hairUrl('Noel'), exp).checks.staff.status, 'pass');
  assert.equal(verifyConfirmation(hairUrl('Noel - 20% kedvezmény!'), exp).checks.staff.status, 'pass');
  assert.equal(verifyConfirmation(hairUrl('Betti'), exp).checks.staff.status, 'fail');
});

test('verifyConfirmation: ismeretlen ar (null) = kihagyott ellenorzes; ismeretlen uzletag = hiba', () => {
  assert.equal(verifyConfirmation(redirect(), { ...pmuExpected, activePrice: null }).checks.price.status, 'skipped');
  assert.throws(() => verifyConfirmation(redirect(), { ...pmuExpected, business: 'nincs' }), (e) => e.code === 'UNKNOWN_BUSINESS');
});

// --- az adapter ----------------------------------------------------------------------------------------------------------
function fakeFetch(routes) {
  const calls = [];
  const f = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET' });
    for (const [re, resp] of routes) {
      if (re.test(String(url))) {
        const r = typeof resp === 'function' ? resp(calls.length) : resp;
        if (r instanceof Error) throw r;
        return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.body };
      }
    }
    return { ok: false, status: 404, text: async () => 'nincs' };
  };
  f.calls = calls;
  return f;
}
const ok = (body) => ({ status: 200, body });
const nowFixed = () => Date.UTC(2026, 9, 3, 10, 0, 0); // 2026-10-03, a fixture idopontjai elotti (a fixture a valodi, mai idopontokat tartalmazza)

test('adapter (PMU): getServices a munkatarsoldalbol, gyorsitotar, getAvailability, getStaff, beginBooking', async () => {
  const f = fakeFetch([
    [/\/employees\/32428\//, ok(fx('pmu-employees.html'))],
    [/\/selectDate\//, ok(fx('selectDate-snippet.html'))],
    [/getAvailableTimes/, ok(JSON.stringify(apiFixture()))],
  ]);
  const a = createSalonicAdapter({ fetchImpl: f, now: () => 0 });
  const services = await a.getServices('pmu');
  assert.equal(services.length, 4);
  await a.getServices('pmu');
  assert.equal(f.calls.filter((c) => /\/employees\//.test(c.url)).length, 1, 'masodik hivas a gyorsitotarbol');

  const svc = services[1]; // 471034, 120 perc
  const slots = await a.getAvailability('pmu', svc.serviceId, { days: 30 });
  assert.ok(slots.length > 0);
  assert.equal(slots[0].service_id, '471034');
  assert.equal(slots[0].final_price, 99000);
  assert.equal(slots[0].list_price, 124900);
  const api = f.calls.find((c) => /getAvailableTimes/.test(c.url)).url;
  assert.match(api, /placeId=14585/);
  assert.match(api, /serviceId=471034/);
  assert.match(api, /employeeId=-1/);
  assert.match(api, /days=30/);

  const staff = await a.getStaff('pmu', svc.serviceId);
  assert.deepEqual(staff.map((x) => x.staff_id), ['32428']); // a PMU-nal a konfiguraciobol (egyetlen munkatars)

  const b = await a.beginBooking({ business: 'pmu', serviceId: svc.serviceId, startUnix: 1791360000 });
  assert.match(b.guestDataUrl, /^https:\/\/mosaic-pmu\.salonic\.hu\/guestData\/\?/);
  assert.match(b.guestDataUrl, /placeId=14585/);
  assert.match(b.guestDataUrl, /serviceId=471034/);
  assert.match(b.guestDataUrl, /employeeId=-1/);
  assert.match(b.guestDataUrl, /startDate=1791360000/);
  assert.deepEqual(b.expected, { business: 'pmu', serviceId: '471034', startUnix: 1791360000, staffId: -1, activePrice: 99000 });
  assert.ok(f.calls.every((c) => c.method === 'GET'), 'az adapter sosem kuld nem-GET kerest');
});

test('adapter: getPlace a naptar-API valaszabol (nev, cim), gyorsitotarbol', async () => {
  const f = fakeFetch([
    [/\/employees\/32428\//, ok(fx('pmu-employees.html'))],
    [/\/selectDate\//, ok(fx('selectDate-snippet.html'))],
    [/getAvailableTimes/, ok(JSON.stringify(apiFixture()))],
  ]);
  const a = createSalonicAdapter({ fetchImpl: f, now: () => 0 });
  const p = await a.getPlace('pmu');
  assert.match(p.address, /Budapest/);
  assert.ok(p.name && p.name.length > 0);
  const calls = f.calls.length;
  assert.deepEqual(await a.getPlace('pmu'), p);
  assert.equal(f.calls.length, calls, 'masodik hivas a gyorsitotarbol');
});

test('adapter (kategoriak): specIds konfiguraciobol, es selectSpecialization-bol felfedezve', async () => {
  const f = fakeFetch([
    [/selectSpecialization/, ok(fx('headspa-selectSpecialization.html'))],
    [/showServices\/\?placeId=10427&specId=39592/, ok(fx('hair-showServices.html'))],
    [/showServices\/\?placeId=10427&specId=41471/, ok(fx('hair-showServices.html'))], // ugyanazok az ID-k: duplikatum nelkul
  ]);
  const a = createSalonicAdapter({ fetchImpl: f, now: () => 0 });
  const s = await a.getServices('headspa');
  assert.equal(s.length, 3);
  assert.equal(s[0].specId, '39592');

  const f2 = fakeFetch([[/showServices\/\?placeId=14586&specId=66404/, ok(fx('hair-showServices.html'))], [/showServices\/\?placeId=14586&specId=66405/, ok(fx('hair-showServices.html'))]]);
  const l = await createSalonicAdapter({ fetchImpl: f2, now: () => 0 }).getServices('laser');
  assert.equal(l.length, 3);
  assert.ok(f2.calls.every((c) => !/selectSpecialization/.test(c.url)), 'a lezernel nem a kategoriaoldalt hasznaljuk');
});

test('adapter: ismeretlen szolgaltatas / uzletag, nem tamogatott muveletek', async () => {
  const f = fakeFetch([[/\/employees\/32428\//, ok(fx('pmu-employees.html'))]]);
  const a = createSalonicAdapter({ fetchImpl: f, now: () => 0 });
  await assert.rejects(() => a.beginBooking({ business: 'pmu', serviceId: '999', startUnix: 1 }), (e) => e.code === 'SERVICE_NOT_FOUND');
  await assert.rejects(() => a.getServices('nincs'), (e) => e.code === 'UNKNOWN_BUSINESS');
  for (const m of ['createBooking', 'getBooking', 'updateBooking']) await assert.rejects(() => a[m]({}), (e) => e.code === 'NOT_SUPPORTED');
  assert.deepEqual({ ...a.capabilities }, { createBooking: false, getBooking: false, updateBooking: false, bookingId: 'synthetic', priceReadback: 'redirect-attested' });
});

test('adapter: 5xx-re egyszer ujraprobal, 404-re nem, halozati hibara hibat dob', async () => {
  let n = 0;
  const f1 = fakeFetch([[/employees/, () => (++n === 1 ? { status: 503, body: '' } : ok(fx('pmu-employees.html')))]]);
  assert.equal((await createSalonicAdapter({ fetchImpl: f1, now: () => 0 }).getServices('pmu')).length, 4);
  assert.equal(f1.calls.length, 2);

  const f2 = fakeFetch([]); // minden 404
  await assert.rejects(() => createSalonicAdapter({ fetchImpl: f2, now: () => 0 }).getServices('pmu'), (e) => e.code === 'HTTP' && e.status === 404);
  assert.equal(f2.calls.length, 1, '404-re nincs ujraprobalas');

  const f3 = fakeFetch([[/employees/, new Error('ECONNRESET')]]);
  await assert.rejects(() => createSalonicAdapter({ fetchImpl: f3, now: () => 0 }).getServices('pmu'), (e) => e instanceof SalonicError);
  assert.equal(f3.calls.length, 2);
});

// --- elo, csak olvaso (LIVE=1) -----------------------------------------------------------------------------------------------
test('ELO smoke: mind az 5 uzletag szolgaltatasai es szabad idopontjai olvashatok (csak GET)', { skip: process.env.LIVE !== '1' }, async () => {
  const calls = [];
  const a = createSalonicAdapter({ fetchImpl: (u, o) => { calls.push(o && o.method); return fetch(u, o); } });
  for (const b of Object.keys(BUSINESSES)) {
    const services = await a.getServices(b);
    assert.ok(services.length > 0, b + ': nincs szolgaltatas');
    assert.ok(services.every((s) => /^\d+$/.test(s.serviceId) && s.name), b + ': hibas szolgaltatas');
    const withTime = services.find((s) => s.durationMin);
    const slots = await a.getAvailability(b, withTime.serviceId, { days: 30 });
    const staff = await a.getStaff(b, withTime.serviceId);
    console.log(`  ${b}: ${services.length} szolgaltatas, ${slots.length} szabad idopont (30 nap), munkatars: ${staff.map((x) => x.staff_id + '=' + x.staff_label).join(', ')}`);
    for (const s of slots) assert.ok(s.start_unix > 0 && s.service_id === withTime.serviceId);
  }
  assert.ok(calls.every((m) => !m || m === 'GET'), 'csak GET keres mehet');
});
