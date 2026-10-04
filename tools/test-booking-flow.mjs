// A foglalo logikai magjanak tesztjei (flow.js, flows/headspa.js):
//   node --test tools/test-booking-flow.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXIT_GIFTCARD, ROUTES, withAttribution, cardsFor, classifyRedirect, dayKey, dayLabel, displayName, durationLabel, entryState,
  filterSlots, findByKey, formatPrice, groupFacts, groupServices, icsFor, intentCandidates, intentServices, longDate, monthGrid, monthList, dayTimes, next, parseContext, parseLength,
  priceFor, priceLabel, shouldHandoff, staffDiscountPercent, timeLabel, uniqueTimes,
} from '../assets/js/booking-engine/flow.js';
import { CHOOSER } from '../assets/js/booking-engine/families.js';
import { HEADSPA } from '../assets/js/booking-engine/flows/headspa.js';
import { OXYGEN } from '../assets/js/booking-engine/flows/oxygen.js';
import { HAIR } from '../assets/js/booking-engine/flows/hair.js';
import { LASER, AREAS, areaOf, labelOf } from '../assets/js/booking-engine/flows/laser.js';
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
    // HeadSpa: az elmeny-valasztas (HS2) az elso allapot; alatta az ajandekkartya-bevaltas (HS3) es -vasarlas linkje
    ['HS2', 'service', 'C1'], ['HS2', 'voucher', 'HS3'], ['HS2', 'giftcard', EXIT_GIFTCARD], ['HS3', 'service', 'C1'],
    // nincs osszegzo kepernyo: az idopont (C1, a PMU-foglalo havi naptara) utan rogton az adatlap (C4)
    ['C1', 'slot', 'C4'], ['C1', 'none', 'A1'],
    ['C4', 'submit', 'C5'], ['C5', 'success', 'C6'], ['C5', 'slot_lost', 'A2'], ['C5', 'error', 'A3'],
  ];
  for (const [from, ev, to] of rows) assert.equal(next(from, ev), to, `${from} --${ev}--> ${to}`);
  assert.throws(() => next('C3', 'next'), /Ervenytelen/, 'az osszegzo kepernyo (C3) megszunt');
  assert.throws(() => next('C1', 'more'), /Ervenytelen/, 'a gyors idopontok / naptar-sav (C2) megszunt: minden uzletagnal a havi naptar az idopont-valaszto');
  assert.throws(() => next('HS1', 'book'), /Ervenytelen/, 'a HS1 megszunt: a HeadSpa az elmeny-valasztassal indul');
  assert.throws(() => next('NINCS', 'x'));
  assert.ok(Object.isFrozen(ROUTES));
});

test('belepesi pont: generic = HS2 (HeadSpa), konkret szolgaltatas = C1, ajandekkartya-szandek = HS3', () => {
  assert.equal(entryState({ hasService: false, voucher: false }), 'HS2');
  assert.equal(entryState({ hasService: false, voucher: false, first: HEADSPA.firstState }), 'HS2');
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

// --- Fodraszat ------------------------------------------------------------------------------------------------------------------
const hairServices = mapping.services.filter((s) => s.business === 'hair').map((s) => {
  const svc = { serviceId: s.salonic_service_id, name: s.service_name_raw, specId: s.salonic_spec_id, category: s.service_category, activePrice: s.active_price, listPrice: s.list_price, durationMin: s.duration_min, staffIds: s.eligible_staff.map((e) => e.staff_id) };
  return { ...svc, bookingType: classifyService('hair', svc).bookingType };
});

test('Fodraszat: a wireframe routing tablaja (HA1-HA3), belepes HA1; konkret szolgaltatas a HA3-ra', () => {
  assert.equal(next('HA1', 'intent'), 'HA2');
  assert.equal(next('HA1', 'consult'), 'C1', 'az ingyenes konzultacio egyenesen C1-re megy');
  assert.equal(next('HA2', 'group'), 'HA2B');
  assert.equal(next('HA2', 'service'), 'HA3');
  assert.equal(next('HA2B', 'service'), 'HA3');
  assert.equal(next('HA3', 'any'), 'C1');
  assert.equal(next('HA3', 'choose'), 'HA3B');
  assert.equal(next('HA3B', 'staff'), 'C1');
  const e = { first: HAIR.firstState, voucherState: HAIR.voucherState, exact: HAIR.exactState };
  assert.equal(entryState({ hasService: false, voucher: false, ...e }), 'HA1');
  assert.equal(entryState({ hasService: true, voucher: false, ...e }), 'HA3', 'a konkret szolgaltatas landing a szakember-kerdesre erkezik');
});

test('Fodraszat: a 41 szolgaltatas mind besorolodik a jovahagyott szandekekbe, egy sem vész el', () => {
  assert.equal(hairServices.length, 41);
  const perIntent = Object.fromEntries(HAIR.intents.filter((i) => !i.consult).map((i) => [i.key, intentServices(hairServices, HAIR.intents, i)]));
  assert.deepEqual(Object.fromEntries(Object.entries(perIntent).map(([k, v]) => [k, v.length])), { balayage: 14, color: 12, cut: 5, other: 9 });
  const all = Object.values(perIntent).flat().map((s) => s.serviceId);
  assert.equal(new Set(all).size, 40, 'egy szolgaltatas csak egy szandekben');
  const consult = hairServices.filter((s) => s.bookingType === 'consultation');
  assert.deepEqual(consult.map((s) => s.serviceId), ['232804']);
  assert.equal(all.length + consult.length, 41);
});

test('Fodraszat: uj, ismeretlen Salonic-kategoria az "Egyeb"-be kerul (nem vesz el)', () => {
  const novel = { serviceId: '777', name: 'Uj kezeles', category: 'Valami teljesen uj', bookingType: 'first_treatment', activePrice: 1000, durationMin: 30, staffIds: ['1'] };
  const other = HAIR.intents.find((i) => i.key === 'other');
  assert.ok(intentServices([...hairServices, novel], HAIR.intents, other).some((s) => s.serviceId === '777'));
  assert.ok(!intentServices([...hairServices, novel], HAIR.intents, HAIR.intents.find((i) => i.key === 'color')).some((s) => s.serviceId === '777'));
});

test('parseLength: hajhossz felismerese a Salonic eltero irasmodjaibol', () => {
  assert.deepEqual(parseLength('☀ Balayage / ombre / babylight + vágás + szárítás - Közepes haj'), { stem: 'Balayage / ombre / babylight + vágás + szárítás', length: 'Közepes haj' });
  assert.deepEqual(parseLength('Teljes festés/ Supernatural Color- Rövid haj'), { stem: 'Teljes festés / Supernatural Color', length: 'Rövid haj' });
  assert.deepEqual(parseLength('JOICO 4 lépéses hajújraépítő kezelés - félhosszú haj'), { stem: 'JOICO 4 lépéses hajújraépítő kezelés', length: 'Félhosszú haj' });
  assert.equal(parseLength('🌊 Női szárítás - Extra Hosszú haj').length, 'Extra hosszú haj');
  assert.deepEqual(parseLength('💇‍♂️ Férfi hajvágás'), { stem: 'Férfi hajvágás', length: null });
  assert.equal(parseLength('Póthaj felrakás (350 Ft / Tincs)').length, null);
});

test('groupServices: a hajhossz-valtozatok egy kezelesben; a szokimeres 4 eltero irasmodja egy csoport; hosszak idotartam szerint', () => {
  const byIntent = (key) => groupServices(intentServices(hairServices, HAIR.intents, HAIR.intents.find((i) => i.key === key)));
  const balayage = byIntent('balayage');
  assert.equal(balayage.length, 4, 'Balayage (2 kezeles), Teljes szokites, Teljes melir');
  assert.deepEqual(balayage.map((g) => g.items.length), [3, 3, 4, 4]);
  const szokites = balayage.find((g) => /szőkítés/i.test(g.title));
  assert.equal(szokites.items.length, 4, 'a "korrekció- vágással" kulonbozo szokozes-irasmodjai egy csoportba kerulnek');
  assert.deepEqual(szokites.items.map((i) => i.length), ['Rövid haj', 'Közepes haj', 'Hosszú haj', 'Extra hosszú haj']);
  assert.equal(byIntent('color').length, 3);
  assert.equal(byIntent('cut').length, 2);
  assert.deepEqual(byIntent('cut').map((g) => g.items.length).sort(), [1, 4]);
  const other = byIntent('other');
  assert.equal(other.length, 4, 'Noi szaritas, JOICO, Pothaj leszedes, Pothaj felrakas');
  for (const g of [...balayage, ...other]) for (let i = 1; i < g.items.length; i++) assert.ok(g.items[i - 1].service.durationMin <= g.items[i].service.durationMin);
});

test('groupFacts: tartomany idotartamra es arra', () => {
  const g = groupServices(intentServices(hairServices, HAIR.intents, HAIR.intents.find((i) => i.key === 'cut'))).find((x) => /Női hajvágás/.test(x.title));
  assert.equal(groupFacts(g).replace(/\s/g, ' '), '1 óra – 2 óra · 11 950 – 16 950 Ft');
  const single = groupServices(hairServices.filter((s) => s.serviceId === '231549'))[0];
  assert.equal(groupFacts(single).replace(/\s/g, ' '), '30 perc · 7 450 Ft');
});

test('szakemberi kedvezmeny: a Salonic cimkejebol, az ar a kedvezmennyel; nincs kedvezmeny = a Salonic ara', () => {
  assert.equal(staffDiscountPercent('Noel - 20% kedvezmény!'), 20);
  assert.equal(staffDiscountPercent('Betti'), 0);
  assert.equal(staffDiscountPercent(null), 0);
  const balayage = hairServices.find((s) => s.serviceId === '231532'); // 42 950 Ft
  assert.equal(priceFor(balayage, 'Noel - 20% kedvezmény!'), 34360, 'pontosan a Salonic nyilvanos arsavjanak also vege');
  assert.equal(priceFor(balayage, 'Betti'), 42950);
  assert.equal(priceFor(balayage, null), 42950);
  assert.equal(priceFor({ activePrice: null }, 'Noel - 20% kedvezmény!'), null);
});

// --- Lezer ------------------------------------------------------------------------------------------------------------------------
const laserServices = mapping.services.filter((s) => s.business === 'laser').map((s) => {
  const svc = { serviceId: s.salonic_service_id, name: s.service_name_raw, specId: s.salonic_spec_id, category: s.service_category, activePrice: s.active_price, durationMin: s.duration_min, staffIds: s.eligible_staff.map((e) => e.staff_id) };
  return { ...svc, bookingType: classifyService('laser', svc).bookingType };
});

test('Lezer: a wireframe routing tablaja (LA1-LA3), belepes LA1, nincs szakember-valaszto', () => {
  assert.equal(next('LA1', 'consult'), 'C1', 'az ingyenes konzultacio egyenesen C1-re megy');
  assert.equal(next('LA1', 'known'), 'LA2');
  assert.equal(next('LA1', 'returning'), 'LA3');
  assert.equal(next('LA2', 'area'), 'LA2B');
  assert.equal(next('LA2', 'service'), 'C1');
  assert.equal(next('LA3', 'area'), 'LA2B');
  assert.equal(next('LA3', 'service'), 'C1');
  assert.equal(next('LA2B', 'service'), 'C1');
  assert.equal(entryState({ hasService: false, voucher: false, first: LASER.firstState, voucherState: LASER.voucherState, exact: LASER.exactState }), 'LA1');
  assert.equal(entryState({ hasService: true, voucher: false, first: LASER.firstState, voucherState: LASER.voucherState, exact: LASER.exactState }), 'C1', 'konkret kezeles landing: kozvetlenul az idopontok');
  assert.equal(LASER.showStaffFilter, false);
});

test('Lezer: mind a 46 kezeles pontosan egy teruletre kerul, mindket uton (elso es 2. alkalomtol)', () => {
  assert.equal(laserServices.length, 47);
  for (const type of ['first_treatment', 'returning_treatment']) {
    const pool = laserServices.filter((s) => s.bookingType === type);
    assert.equal(pool.length, 23);
    const counts = Object.fromEntries(AREAS.map((a) => [a.key, pool.filter((s) => areaOf(s).key === a.key).length]));
    assert.deepEqual(counts, { arc: 3, honalj: 1, kar: 3, intim: 2, lab: 3, torzs: 3, tobb: 8 }, type);
  }
  assert.deepEqual(laserServices.filter((s) => s.bookingType === 'consultation').map((s) => s.serviceId), ['476477']);
});

test('Lezer: a "Tobb terulet" az akcios csomagokat es az egyeb testreszeket tartalmazza; a konkret teruletek a nevukbol', () => {
  const area = (id) => areaOf(laserServices.find((s) => s.serviceId === id)).key;
  assert.equal(area('476485'), 'arc'); // ARC - Teljes arc
  assert.equal(area('476488'), 'honalj'); // TEST - Teljes honalj
  assert.equal(area('476489'), 'kar'); // TEST - Alkar
  assert.equal(area('476492'), 'intim');
  assert.equal(area('476494'), 'lab');
  assert.equal(area('476498'), 'torzs'); // FERFI - Hat
  assert.equal(area('476479'), 'tobb'); // BASIC csomag
  assert.equal(area('476501'), 'tobb'); // EGYEB - Kis testresz
  assert.equal(area('476503'), 'tobb'); // Egyedi csomag
});

test('Lezer: a Salonic neveibol tiszta cim es cimkek (elotag, allapotfelmeres, kedvezmeny)', () => {
  const l = (id) => labelOf(laserServices.find((s) => s.serviceId === id));
  assert.deepEqual(l('476485'), { title: 'Teljes arc', tags: ['állapotfelméréssel', '20% kedvezménnyel'] });
  assert.deepEqual(l('476511'), { title: 'Bajuszvonal', tags: [] });
  assert.deepEqual(l('476494'), { title: '2 Lábszár', tags: ['állapotfelméréssel', '20% kedvezménnyel'] });
  assert.deepEqual(l('476500'), { title: 'Has', tags: ['állapotfelméréssel'] }, 'a Has soron nincs kedvezmeny');
  assert.deepEqual(l('476479'), { title: 'BASIC CSOMAG', tags: ['állapotfelméréssel', '20% kedvezménnyel'] });
  assert.deepEqual(l('476480'), { title: 'MEDIUM CSOMAG', tags: ['állapotfelméréssel', '20% kedvezménnyel'] });
  assert.equal(l('476506').title, 'BASIC CSOMAG');
  assert.deepEqual(l('476506').tags.map((t) => t.replace(/\s/g, ' ')), ['9 500 Ft kedvezménnyel']);
  assert.deepEqual(l('476478'), { title: 'EGYEDI CSOMAG (TE RAKOD ÖSSZE!)', tags: ['állapotfelméréssel', '50% kedvezménnyel'] });
  for (const s of laserServices) assert.ok(labelOf(s).title && !/^(ARC|TEST|INTIM|LÁBAK|FÉRFI|EGYÉB|AKCIÓ)\b/i.test(labelOf(s).title), `tiszta cim: ${s.serviceId}`);
});

test('Lezer: az egyedi csomag 0 Ft-ja "Egyedi ar", a konzultacio "Ingyenes"', () => {
  assert.equal(priceLabel(0, LASER.zeroPriceLabel), 'Egyedi ár');
  assert.equal(priceLabel(0), 'Ingyenes');
  const custom = laserServices.filter((s) => /EGYEDI CSOMAG/.test(s.name));
  assert.equal(custom.length, 2);
  assert.ok(custom.every((s) => s.activePrice === 0 && s.bookingType !== 'consultation'));
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
  assert.deepEqual(pick('first').map((s) => s.serviceId), ['466110'], 'egy jelolt: a foglalo egyenesen a C1-re megy (OX2 csak tobb valtozatnal jelenik meg)');
  // ha a Salonic ujra felvenne egy masodik valtozatot, a motor nem valaszt helyetted, hanem rovid valasztast kinal
  const extra = { ...services.find((s) => s.serviceId === '466110'), serviceId: '999999', durationMin: 120 };
  assert.deepEqual(intentCandidates([...services, extra], OXYGEN.intents.find((i) => i.key === 'first')).map((s) => s.serviceId).sort(), ['466110', '999999']);
  assert.deepEqual(pick('returning').map((s) => s.serviceId), ['466158']);
  assert.ok(OXYGEN.showStaffFilter, 'az Oxigennel a szakember valaszthato');
});

test('ido: budapesti cimkek es napnevek', () => {
  assert.equal(timeLabel(T(3, 10)), '10:00');
  assert.equal(timeLabel(T(3, 13, 30)), '13:30');
  assert.equal(dayKey(T(3, 23, 30)), '2026-10-03');
  assert.equal(dayKey(T(4, 0, 30)), '2026-10-04');
  assert.equal(dayLabel(T(3, 15), T(3, 9)), 'Ma');
  assert.equal(dayLabel(T(4, 15), T(3, 9)), 'Holnap');
  assert.equal(dayLabel(T(5, 15), T(3, 9)), 'Hétfő');
  assert.equal(longDate(T(3, 10)), 'Szombat, okt. 3.');
});

test('uniqueTimes: ugyanarra az idopontra egy bejegyzes, rendezve', () => {
  const u = uniqueTimes([slot(T(3, 12), 'b'), slot(T(3, 10), 'a'), slot(T(3, 10), 'b'), slot(T(3, 12), 'a')]);
  assert.deepEqual(u.map((s) => s.start_unix), [T(3, 10), T(3, 12)]);
  assert.equal(u[0].staff_id, 'a');
});

test('filterSlots: munkatars, nap', () => {
  const s = [slot(T(3, 10), 'a'), slot(T(3, 14), 'b'), slot(T(3, 19), 'a'), slot(T(4, 10), 'a')];
  assert.equal(filterSlots(s, { staffId: 'a' }).length, 3);
  assert.equal(filterSlots(s, { day: '2026-10-03' }).length, 3);
  assert.equal(filterSlots(s, { day: '2026-10-03', staffId: 'b' }).length, 1);
  assert.equal(filterSlots(s).length, 4);
});

test('megjelenites: nev, ar, idotartam', () => {
  assert.equal(displayName('💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás'), 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás');
  assert.equal(displayName('KUPONKÓDDAL - 💆‍♀️ EGYÉNI 50 perces MOSAIC'), 'EGYÉNI 50 perces MOSAIC');
  assert.equal(formatPrice(26900).replace(/\s/g, ' '), '26 900 Ft');
  assert.equal(formatPrice(4990).replace(/\s/g, ' '), '4 990 Ft', 'negyjegyu ar is tagolt');
  assert.equal(formatPrice(990), '990 Ft');
  assert.equal(priceLabel(0), 'Ingyenes', 'a 0 Ft-os (konzultacio) "Ingyenes"');
  assert.equal(priceLabel(null), '');
  assert.equal(priceLabel(4990).replace(/\s/g, ' '), '4 990 Ft');
  assert.equal(displayName('Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)'), 'Fodrász konzultáció', 'a zarojeles akcios szoveg nem resze a nevnek');
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
  assert.deepEqual(c, { business: 'headspa', serviceKey: 'paros', category: null, voucher: true, intent: null, sourcePage: '/headspa-budapest', attribution: { utm_source: 'google', gclid: 'abc', fbclid: 'f1', ttclid: 't1' }, sample: 'siker' });
  assert.equal(parseContext('?business=hair&category=balayage').category, 'balayage');
  // lezer: ?intent=first | returning (a regi "Elso idopontok" / "Kezeles idopontok" gombok); az ajandekkartya-szandek (intent=voucher) valtozatlan
  assert.equal(parseContext('?business=laser&intent=first').intent, 'first');
  assert.equal(parseContext('?business=laser&intent=returning').intent, 'returning');
  assert.equal(parseContext('?business=laser').intent, null);
  assert.deepEqual([parseContext('?intent=voucher').voucher, parseContext('?intent=voucher').intent], [true, 'voucher']);
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

test('shouldHandoff: eles tartomanyon atadas a meglevo koszonooldalnak, elonezeten/helyben nem; ?atadas= felulirja', () => {
  assert.equal(shouldHandoff('www.mosaicheadspa.hu'), true);
  assert.equal(shouldHandoff('mosaicheadspa.hu', '?business=oxygen'), true);
  assert.equal(shouldHandoff('claude-booking-engine-ui.mosaic-d77.pages.dev'), false);
  assert.equal(shouldHandoff('localhost'), false);
  assert.equal(shouldHandoff('www.mosaicheadspa.hu', '?atadas=0'), false);
  assert.equal(shouldHandoff('localhost', '?atadas=1'), true);
});

test('withAttribution: a hirdetesi azonositok a koszonooldal-URL VEGERE kerulnek, a Salonic parameterei bajtra valtozatlanok', () => {
  const salonic = 'https://www.mosaicheadspa.hu/fodrasz-ok?first_booking=true&service=Fodr%C3%A1sz+konzult%C3%A1ci%C3%B3+%289.900+Ft+helyett+most+0+Ft%21%29&price=0&g=g:3385039&bookingUrl=https%3A%2F%2Fmosaic-hair.salonic.hu%2FguestData%2F%3Fanyone%3Dtrue%26startDate%3D1792674000%26back%3D';
  const klikk = '?business=hair&service=konzult&gclid=TESZT123&fbclid=TESZT456&ttclid=TESZT789&utm_source=teszt&utm_medium=cpc';
  const ki = withAttribution(salonic, klikk);
  assert.ok(ki.startsWith(salonic), 'a Salonic URL elotagja bajtra valtozatlan');
  assert.equal(ki.slice(salonic.length), '&gclid=TESZT123&fbclid=TESZT456&ttclid=TESZT789&utm_source=teszt&utm_medium=cpc');
  // ami nem hirdetesi azonosito (business, service, minta, atadas ...), az nem kerul at
  assert.ok(!/business=|service=konzult/.test(ki.slice(salonic.length)));
  // nincs mit hozzaadni: valtozatlan
  assert.equal(withAttribution(salonic, '?business=hair'), salonic);
  assert.equal(withAttribution(salonic, ''), salonic);
  // ha a Salonic URL-je mar tartalmazza, nem irjuk felul es nem duplazzuk
  assert.equal(withAttribution(salonic + '&utm_source=salonic', '?utm_source=teszt&utm_medium=cpc'), salonic + '&utm_source=salonic&utm_medium=cpc');
  // query nelkuli URL, fragment, ertek-kodolas
  assert.equal(withAttribution('https://x.hu/ok', '?gclid=a b&utm_term=ő'), 'https://x.hu/ok?gclid=a%20b&utm_term=%C5%91');
  assert.equal(withAttribution('https://x.hu/ok?a=1#h', '?gclid=Z'), 'https://x.hu/ok?a=1&gclid=Z#h');
  assert.equal(withAttribution('https://x.hu/ok?', '?gclid=Z'), 'https://x.hu/ok?gclid=Z');
  assert.equal(withAttribution('nem url', '?gclid=Z'), 'nem url');
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

// A build (tools/netlify-build.mjs) a modulok egymasra hivatkozasaiba tartalom-hash verziojelet ir (a /assets/js/* egy evig tarolhato,
// verziojel nelkul egy motor-javitas nem jutna el a mar betoltott bongeszokhoz). Ehhez minden import relativ, .js-re vegzodo, statikus.
test('motor-modulok: minden import relativ .js hivatkozas (a build verziojelet ir beleje), nincs dinamikus import', () => {
  const dir = path.join(here, '..', 'assets', 'js', 'booking-engine');
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p); } })(dir);
  assert.ok(files.length >= 9, 'a motor modulokat megtalalja');
  const re = /(from\s+['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g;
  let n = 0;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/\bimport\s*\(/.test(src), `${path.basename(f)}: nincs dinamikus import`);
    const specs = [...src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const s of specs) assert.match(s, /^\.{1,2}\/[^'"?]+\.js$/, `${path.basename(f)}: ${s}`);
    n += [...src.matchAll(re)].length;
    assert.equal([...src.matchAll(re)].length, specs.length, `${path.basename(f)}: minden import verziozhato`);
  }
  assert.ok(n >= 9, `a ${n} import mind verziozhato`);
  const html = fs.readFileSync(path.join(here, '..', 'foglalas', 'foglalo-motor.html'), 'utf8');
  assert.ok(html.includes("/assets/js/booking-engine/engine.js'"), 'a foglalo-oldal importja a build altal verziozott alak');
});

// --- design (2026-10-04): kepek a valasztokon, havi naptar (PMU-foglalo), nincs osszegzo -------------------------------------------------------
const ROOT = path.join(here, '..');
const kepFajl = (k) => path.join(ROOT, 'assets', 'img', 'booking', k + '.jpg');

test('minden valasztokartya kepe (kulcs) letezo fajl: szolgaltatas-valaszto, HeadSpa, oxigen, fodraszat, lezer', () => {
  const kulcsok = [
    ...CHOOSER.families.map((f) => f.kep),
    ...HEADSPA.cards.map((c) => c.kep),
    ...OXYGEN.intents.map((i) => i.kep),
    ...HAIR.intents.map((i) => i.kep),
    ...HAIR.staffPhotos.map(([, k]) => k),
    ...LASER.copy.intro.map((o) => o.kep),
    ...LASER.areas.map((a) => a.kep),
  ];
  assert.ok(kulcsok.length >= 28, `${kulcsok.length} kep`);
  for (const k of kulcsok) { assert.ok(k, 'minden kartyanak van kepe'); assert.ok(fs.existsSync(kepFajl(k)), `hianyzik: assets/img/booking/${k}.jpg`); assert.ok(fs.statSync(kepFajl(k)).size < 30000, `${k}: kis kep (< 30 kB)`); }
  assert.equal(new Set(kulcsok).size, kulcsok.length, 'nincs ketszer hasznalt kulcs');
});

test('az oxigen hajkamera-szoveg egy rovid mondat; a HeadSpa ajandekkartya-linkjei megvannak', () => {
  const kamera = OXYGEN.intents.find((i) => i.key === 'camera');
  assert.match(kamera.sub, /bizonytalan/i);
  assert.ok(kamera.sub.length <= 52 && !kamera.sub.includes('\n'));
  assert.ok(HEADSPA.copy.voucherLink && HEADSPA.copy.giftCardLink && HEADSPA.giftCardUrl);
  assert.equal(HEADSPA.firstState, 'HS2');
  // az idopont-valaszto mindenhol a havi naptar; a szakember-valaszto csak az Oxigennel van a naptar folott (a fodraszoknal a szakember-kerdes elobb jon)
  assert.equal(HAIR.staffUpfront, true);
  for (const f of [HEADSPA, OXYGEN, LASER]) assert.ok(!f.staffUpfront, f.business);
});

test('havi naptar: honapok a mai honaptol a keresesi hatarig, a racs hetfovel kezdodik, csak a szabad napok aktivak', () => {
  assert.deepEqual(monthList(T(3, 10), 92), ['2026-10', '2026-11', '2026-12', '2027-01']);
  assert.deepEqual(monthList(T(3, 10), 10), ['2026-10']);
  // 2026. oktober 1. = csutortok -> 3 ures cella (H, K, Sze) elol; 31 nap
  const g = monthGrid('2026-10', new Set(['2026-10-03', '2026-10-30']));
  assert.equal(g.title, '2026. október');
  assert.equal(g.cells.filter((c) => c.blank).length, 3);
  assert.equal(g.cells.filter((c) => !c.blank).length, 31);
  assert.deepEqual(g.cells.filter((c) => c.free).map((c) => c.key), ['2026-10-03', '2026-10-30']);
  assert.equal(g.cells[3].n, 1);
  // 2026. november 1. = vasarnap -> 6 ures cella; 30 nap; februar nem szokoev
  assert.equal(monthGrid('2026-11', new Set()).cells.filter((c) => c.blank).length, 6);
  assert.equal(monthGrid('2027-02', new Set()).cells.filter((c) => !c.blank).length, 28);
  assert.equal(monthGrid('2027-02', new Set()).title, '2027. február');
});

test('havi naptar: a nap idopontjai a PMU-foglalo szabalya szerint (egesz es fel orak; a negyed csak ha mellette nincs ilyen), egy idopont egy bejegyzes', () => {
  const s = (unix, staff = '1') => ({ start_unix: unix, staff_id: staff, staff_label: 'x' });
  const nap = [s(T(5, 10)), s(T(5, 10, 15)), s(T(5, 10, 30)), s(T(5, 10, 45)), s(T(5, 11)), s(T(5, 12, 15)), s(T(5, 14), '2'), s(T(5, 14), '3'), s(T(6, 9))];
  const idok = dayTimes(nap, '2026-10-05').map((x) => timeLabel(x.start_unix));
  assert.deepEqual(idok, ['10:00', '10:30', '11:00', '12:15', '14:00'], 'a 10:15 / 10:45 elmarad, a magaban allo 12:15 marad, a ketszer szabad 14:00 egyszer szerepel');
  assert.deepEqual(dayTimes(nap, '2026-10-06').map((x) => timeLabel(x.start_unix)), ['09:00']);
  assert.deepEqual(dayTimes(nap, '2026-10-07'), []);
});
