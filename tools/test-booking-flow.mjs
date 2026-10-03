// A foglalo logikai magjanak tesztjei (flow.js, flows/headspa.js):
//   node --test tools/test-booking-flow.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXIT_GIFTCARD, ROUTES, availableDays, cardsFor, classifyRedirect, dayKey, dayLabel, daypartOf, displayName, durationLabel, entryState,
  filterSlots, findByKey, formatPrice, icsFor, intentCandidates, longDate, next, parseContext, quickSlots, stripLabel, timeLabel, uniqueTimes,
} from '../assets/js/booking-engine/flow.js';
import { HEADSPA } from '../assets/js/booking-engine/flows/headspa.js';
import { OXYGEN } from '../assets/js/booking-engine/flows/oxygen.js';
import { classifyService } from '../assets/js/booking-engine/business-config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const mapping = JSON.parse(fs.readFileSync(path.join(here, '..', 'docs', 'booking-engine', 'SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json'), 'utf8'));
const headspaServices = mapping.services.filter((s) => s.business === 'headspa').map((s) => {
  const svc = { serviceId: s.salonic_service_id, name: s.service_name_raw, specId: s.salonic_spec_id, activePrice: s.active_price, durationMin: s.duration_min };
  return { ...svc, bookingType: classifyService('headspa', svc).bookingType };
});

// 2026-10-03 10:00 Budapest (CEST, UTC+2)
const T = (d, h, m = 0) => Date.UTC(2026, 9, d, h - 2, m) / 1000;
const slot = (unix, staff = '1') => ({ start_unix: unix, staff_id: staff, staff_label: 'x' });

test('a wireframe routing tablaja (HeadSpa) pontosan egyezik az utvonalakkal', () => {
  const rows = [
    ['HS1', 'book', 'HS2'], ['HS1', 'voucher', 'HS3'], ['HS1', 'giftcard', EXIT_GIFTCARD],
    ['HS2', 'service', 'C1'], ['HS3', 'service', 'C1'],
    ['C1', 'slot', 'C3'], ['C1', 'more', 'C2'], ['C1', 'none', 'A1'], ['C2', 'slot', 'C3'], ['C2', 'none', 'A1'],
    ['C3', 'next', 'C4'], ['C4', 'submit', 'C5'], ['C5', 'success', 'C6'], ['C5', 'slot_lost', 'A2'], ['C5', 'error', 'A3'],
  ];
  for (const [from, ev, to] of rows) assert.equal(next(from, ev), to, `${from} --${ev}--> ${to}`);
  assert.throws(() => next('C3', 'slot'), /Ervenytelen/);
  assert.throws(() => next('NINCS', 'x'));
  assert.ok(Object.isFrozen(ROUTES));
});

test('belepesi pont: generic = HS1, konkret szolgaltatas = C1, ajandekkartya-szandek = HS3', () => {
  assert.equal(entryState({ hasService: false, voucher: false }), 'HS1');
  assert.equal(entryState({ hasService: true, voucher: false }), 'C1');
  assert.equal(entryState({ hasService: true, voucher: true }), 'C1');
  assert.equal(entryState({ hasService: false, voucher: true }), 'HS3');
});

test('Oxigen: a wireframe routing tablaja (OX1 -> C1; tobb valtozatnal OX2 -> C1), belepes OX1; nincs ajandekkartya-ag', () => {
  assert.equal(next('OX1', 'service'), 'C1');
  assert.equal(next('OX1', 'variant'), 'OX2');
  assert.equal(next('OX2', 'service'), 'C1');
  assert.equal(entryState({ hasService: false, voucher: false, first: OXYGEN.firstState, voucherState: OXYGEN.voucherState }), 'OX1');
  assert.equal(entryState({ hasService: false, voucher: true, first: OXYGEN.firstState, voucherState: OXYGEN.voucherState }), 'OX1', 'az Oxigennek nincs ajandekkartya-ag');
  assert.equal(entryState({ hasService: true, voucher: false, first: OXYGEN.firstState, voucherState: OXYGEN.voucherState }), 'C1');
});

test('Oxigen szandekek a Salonic aktualis szolgaltatasaibol: hajkamera, elso (ket valtozat -> OX2), visszajaro', () => {
  const services = mapping.services.filter((s) => s.business === 'oxygen').map((s) => {
    const svc = { serviceId: s.salonic_service_id, name: s.service_name_raw, specId: s.salonic_spec_id, activePrice: s.active_price, durationMin: s.duration_min };
    return { ...svc, bookingType: classifyService('oxygen', svc).bookingType };
  });
  const pick = (key) => intentCandidates(services, OXYGEN.intents.find((i) => i.key === key));
  assert.deepEqual(pick('camera').map((s) => s.serviceId), ['466147']);
  assert.equal(pick('camera')[0].activePrice, 4990);
  assert.equal(pick('camera')[0].durationMin, 30);
  assert.deepEqual(pick('first').map((s) => s.serviceId).sort(), ['466110', '468638'], 'ket valtozat: a foglalo rovid valasztast kinal, nem valaszt helyetted');
  assert.deepEqual(pick('returning').map((s) => s.serviceId), ['466158']);
  assert.ok(OXYGEN.showStaffFilter, 'az Oxigennel a szakember valaszthato');
});

test('ido: budapesti cimkek, napszakok es napnevek', () => {
  assert.equal(timeLabel(T(3, 10)), '10:00');
  assert.equal(timeLabel(T(3, 13, 30)), '13:30');
  assert.equal(dayKey(T(3, 23, 30)), '2026-10-03');
  assert.equal(dayKey(T(4, 0, 30)), '2026-10-04');
  assert.equal(daypartOf(T(3, 11, 59)), 'morning');
  assert.equal(daypartOf(T(3, 12)), 'afternoon');
  assert.equal(daypartOf(T(3, 17, 59)), 'afternoon');
  assert.equal(daypartOf(T(3, 18)), 'evening');
  assert.equal(dayLabel(T(3, 15), T(3, 9)), 'Ma');
  assert.equal(dayLabel(T(4, 15), T(3, 9)), 'Holnap');
  assert.equal(dayLabel(T(5, 15), T(3, 9)), 'Hétfő');
  assert.equal(longDate(T(3, 10)), 'Szombat, okt. 3.');
  assert.equal(stripLabel(T(3, 10)), 'Szo 3.');
});

test('uniqueTimes: ugyanarra az idopontra egy bejegyzes, rendezve', () => {
  const u = uniqueTimes([slot(T(3, 12), 'b'), slot(T(3, 10), 'a'), slot(T(3, 10), 'b'), slot(T(3, 12), 'a')]);
  assert.deepEqual(u.map((s) => s.start_unix), [T(3, 10), T(3, 12)]);
  assert.equal(u[0].staff_id, 'a');
});

test('quickSlots: legfeljebb 5 legkozelebbi idopont, napok szerint csoportositva', () => {
  const slots = [T(3, 10), T(3, 11, 30), T(4, 14, 30), T(4, 16, 30), T(5, 9, 30), T(6, 9), T(7, 9)].map((t) => slot(t));
  const g = quickSlots(slots, { max: 5, nowUnix: T(3, 9) });
  assert.deepEqual(g.map((x) => [x.label, x.items.map((i) => i.time)]), [['Ma', ['10:00', '11:30']], ['Holnap', ['14:30', '16:30']], ['Hétfő', ['09:30']]]);
  assert.equal(g.reduce((n, x) => n + x.items.length, 0), 5);
  assert.deepEqual(quickSlots([], { nowUnix: T(3, 9) }), []);
});

test('filterSlots: napszak, munkatars, nap', () => {
  const s = [slot(T(3, 10), 'a'), slot(T(3, 14), 'b'), slot(T(3, 19), 'a'), slot(T(4, 10), 'a')];
  assert.equal(filterSlots(s, { daypart: 'morning' }).length, 2);
  assert.equal(filterSlots(s, { daypart: 'evening' }).length, 1);
  assert.equal(filterSlots(s, { staffId: 'a' }).length, 3);
  assert.equal(filterSlots(s, { day: '2026-10-03', daypart: 'afternoon' }).length, 1);
  assert.equal(filterSlots(s).length, 4);
});

test('availableDays: a napok, amelyekre van szabad idopont', () => {
  const d = availableDays([slot(T(3, 10)), slot(T(3, 14)), slot(T(5, 9))]);
  assert.deepEqual(d.map((x) => [x.key, x.label]), [['2026-10-03', 'Szo 3.'], ['2026-10-05', 'H 5.']]);
});

test('megjelenites: nev, ar, idotartam', () => {
  assert.equal(displayName('💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás'), 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás');
  assert.equal(displayName('KUPONKÓDDAL - 💆‍♀️ EGYÉNI 50 perces MOSAIC'), 'EGYÉNI 50 perces MOSAIC');
  assert.equal(formatPrice(26900).replace(/\s/g, ' '), '26 900 Ft');
  assert.equal(formatPrice(4990).replace(/\s/g, ' '), '4 990 Ft', 'negyjegyu ar is tagolt');
  assert.equal(formatPrice(990), '990 Ft');
  assert.equal(formatPrice(1250000).replace(/\s/g, ' '), '1 250 000 Ft');
  assert.equal(formatPrice(null), '');
  assert.equal(durationLabel(80), '1 óra 20 perc');
  assert.equal(durationLabel(60), '1 óra');
  assert.equal(durationLabel(30), '30 perc');
});

test('HeadSpa kartyak a Salonic aktualis szolgaltatasaibol: 3 kartya, Egyeni = csak Relax, ajandekkartyahoz is', () => {
  const normal = cardsFor(headspaServices, HEADSPA.cards, { voucher: false });
  assert.deepEqual(normal.map((c) => c.card.key), ['egyeni', 'paros', 'negykezes']);
  assert.match(normal[0].service.name, /Relax/);
  assert.ok(!normal.some((c) => /"Hair"/.test(c.service.name)), 'a Hair valtozat nem kerul be');
  assert.ok(normal.every((c) => c.service.bookingType !== 'voucher_redemption'));
  const voucher = cardsFor(headspaServices, HEADSPA.cards, { voucher: true });
  assert.deepEqual(voucher.map((c) => c.card.key), ['egyeni', 'paros', 'negykezes']);
  assert.ok(voucher.every((c) => c.service.bookingType === 'voucher_redemption'));
  assert.deepEqual(cardsFor([], HEADSPA.cards), [], 'ami nincs a Salonicban, nem jelenik meg');
  assert.ok(!HEADSPA.showStaffFilter);
});

test('findByKey: azonosito vagy kulcsszavak; az ajandekkartyas es a normal kulon', () => {
  const normal = findByKey(headspaServices, 'paros');
  assert.match(normal.name, /PÁROS/);
  assert.notEqual(normal.bookingType, 'voucher_redemption');
  assert.equal(findByKey(headspaServices, 'paros', { voucher: true }).bookingType, 'voucher_redemption');
  assert.equal(findByKey(headspaServices, normal.serviceId).serviceId, normal.serviceId);
  assert.equal(findByKey(headspaServices, 'nincs-ilyen'), null);
  assert.equal(findByKey(headspaServices, null), null);
});

test('parseContext: input szerzodes, mérési parameterek, source_page', () => {
  const c = parseContext('?business=headspa&service=paros&voucher=1&utm_source=google&gclid=abc&fbclid=f1&ttclid=t1&minta=siker', 'https://www.mosaicheadspa.hu/headspa-budapest', 'https://www.mosaicheadspa.hu');
  assert.deepEqual(c, { business: 'headspa', serviceKey: 'paros', voucher: true, sourcePage: '/headspa-budapest', attribution: { utm_source: 'google', gclid: 'abc', fbclid: 'f1', ttclid: 't1' }, sample: 'siker' });
  assert.equal(parseContext('', 'https://masik.hu/x', 'https://www.mosaicheadspa.hu').sourcePage, '', 'idegen referrer nem source_page');
  assert.equal(parseContext('?source_page=/x').sourcePage, '/x');
  assert.equal(parseContext('').business, 'headspa');
});

test('classifyRedirect: elkelt idopont (fooldal / foglalo), visszaigazolas, ismeretlen', () => {
  assert.equal(classifyRedirect('https://www.mosaicheadspa.hu/'), 'slot_lost');
  assert.equal(classifyRedirect('https://www.mosaicheadspa.hu'), 'slot_lost');
  assert.equal(classifyRedirect('https://www.mosaicheadspa.hu/foglalo-motor?beagyazva=1'), 'slot_lost');
  assert.equal(classifyRedirect('https://www.mosaicheadspa.hu/success-foglalas?first_booking=true&bookingUrl=https%3A%2F%2Fx'), 'confirmation');
  assert.equal(classifyRedirect('https://www.mosaicheadspa.hu/valami-mas'), 'unknown');
  assert.equal(classifyRedirect('nem url'), 'unknown');
});

test('icsFor: naptar-fajl: kezdes, veg, helyszin, emlekezteto', () => {
  const ics = icsFor({ startUnix: T(3, 10), durationMin: 80, title: 'HeadSpa, Egyéni', location: '1023 Budapest, Bécsi út 4.', description: 'MOSAIC' });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261003T080000Z/);
  assert.match(ics, /DTEND:20261003T092000Z/);
  assert.match(ics, /SUMMARY:HeadSpa\\, Egyéni/);
  assert.match(ics, /LOCATION:1023 Budapest\\, Bécsi út 4\./);
  assert.match(ics, /TRIGGER:-PT24H/);
  assert.match(ics, /END:VCALENDAR$/);
});
