// A foglalo logikai magjanak tesztjei (flow.js, flows/headspa.js):
//   node --test tools/test-booking-flow.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROUTES, withAttribution, cardsFor, classifyRedirect, dayKey, dayLabel, displayName, durationLabel, entryState,
  filterSlots, findByKey, formatPrice, groupFacts, groupServices, icsFor, intentCandidates, intentServices, longDate, mergeVariantSlots, monthGrid, monthList, dayTimes, next, parseContext, parseLength,
  priceFor, priceLabel, shouldHandoff, staffDiscountPercent, timeLabel, uniqueTimes,
} from '../assets/js/booking-engine/flow.js';
import { CHOOSER } from '../assets/js/booking-engine/families.js';
import { HEADSPA } from '../assets/js/booking-engine/flows/headspa.js';
import { OXYGEN } from '../assets/js/booking-engine/flows/oxygen.js';
import { HAIR, kezelesKep, hajhosszKep } from '../assets/js/booking-engine/flows/hair.js';
import { LASER, AREAS, areaOf, labelOf, packageOf, areaIkon } from '../assets/js/booking-engine/flows/laser.js';
import { IKONOK, hajhosszIkon, kezelesIkon } from '../assets/js/booking-engine/ikonok.js';
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
    // HeadSpa: az elso kerdes az ajandekkartya (HS1: kuponkoddal -> HS3, anelkul -> HS2), utana az elmeny-valasztas
    ['HS1', 'voucher', 'HS3'], ['HS1', 'normal', 'HS2'], ['HS2', 'service', 'C1'], ['HS3', 'service', 'C1'],
    // nincs osszegzo kepernyo: az idopont (C1, a PMU-foglalo havi naptara) utan rogton az adatlap (C4)
    ['C1', 'slot', 'C4'], ['C1', 'none', 'A1'],
    ['C4', 'submit', 'C5'], ['C5', 'success', 'C6'], ['C5', 'slot_lost', 'A2'], ['C5', 'error', 'A3'],
  ];
  for (const [from, ev, to] of rows) assert.equal(next(from, ev), to, `${from} --${ev}--> ${to}`);
  assert.throws(() => next('C3', 'next'), /Ervenytelen/, 'az osszegzo kepernyo (C3) megszunt');
  assert.throws(() => next('C1', 'more'), /Ervenytelen/, 'a gyors idopontok / naptar-sav (C2) megszunt: minden uzletagnal a havi naptar az idopont-valaszto');
  assert.throws(() => next('HS2', 'giftcard'), /Ervenytelen/, 'az ajandekkartya-vasarlas nem a foglalo resze (kulon oldal)');
  assert.throws(() => next('NINCS', 'x'));
  assert.ok(Object.isFrozen(ROUTES));
});

test('belepesi pont: generic = HS1 (HeadSpa: ajandekkartya-e), konkret szolgaltatas = C1, ajandekkartya-szandek = HS3', () => {
  assert.equal(entryState({ hasService: false, voucher: false }), 'HS1');
  assert.equal(entryState({ hasService: false, voucher: false, first: HEADSPA.firstState }), 'HS1');
  assert.equal(entryState({ hasService: true, voucher: false }), 'C1');
  assert.equal(entryState({ hasService: true, voucher: true }), 'C1');
  assert.equal(entryState({ hasService: false, voucher: true }), 'HS3');
});

test('Oxigen: OX1 -> OXS (szakember, kepes kartyak) -> C1; tobb valtozatnal OX1 -> OX2 -> OXS; belepes OX1; nincs ajandekkartya-ag', () => {
  assert.equal(next('OX1', 'service'), 'OXS');
  assert.equal(next('OX1', 'variant'), 'OX2');
  assert.equal(next('OX2', 'service'), 'OXS');
  assert.equal(next('OXS', 'next'), 'C1');
  assert.equal(entryState({ hasService: false, voucher: false, first: OXYGEN.firstState, voucherState: OXYGEN.voucherState }), 'OX1');
  assert.equal(entryState({ hasService: false, voucher: true, first: OXYGEN.firstState, voucherState: OXYGEN.voucherState }), 'OX1', 'az Oxigennek nincs ajandekkartya-ag');
  assert.equal(entryState({ hasService: true, voucher: false, first: OXYGEN.firstState, voucherState: OXYGEN.voucherState, exact: OXYGEN.exactState }), 'OXS', 'a konkret szolgaltatas landing a szakember-valasztora erkezik');
  assert.equal(OXYGEN.afterService, 'OXS');
});

// --- Fodraszat ------------------------------------------------------------------------------------------------------------------
const hairServices = mapping.services.filter((s) => s.business === 'hair').map((s) => {
  const svc = { serviceId: s.salonic_service_id, name: s.service_name_raw, specId: s.salonic_spec_id, category: s.service_category, activePrice: s.active_price, listPrice: s.list_price, durationMin: s.duration_min, staffIds: s.eligible_staff.map((e) => e.staff_id) };
  return { ...svc, bookingType: classifyService('hair', svc).bookingType };
});

test('Fodraszat: a belepo a fodrasz-valaszto (HA0), utana HA1 -> HA2 -> HA2B -> C1; landingek is a HA0-val kezdodnek', () => {
  assert.equal(next('HA0', 'all'), 'HA1');
  assert.equal(next('HA0', 'intent'), 'HA2', 'kategoria-landing: fodrasz, aztan a kezeles-pontositas');
  assert.equal(next('HA0', 'service'), 'C1', 'konkret szolgaltatas landing: fodrasz, aztan az idopontok');
  assert.equal(next('HA1', 'intent'), 'HA2');
  assert.equal(next('HA1', 'consult'), 'C1', 'az ingyenes konzultacio egyenesen C1-re megy');
  assert.equal(next('HA2', 'group'), 'HA2B');
  assert.equal(next('HA2', 'service'), 'C1');
  assert.equal(next('HA2B', 'service'), 'C1');
  assert.throws(() => next('HA3', 'any'), /Ervenytelen/, 'a HA3 / HA3B megszunt: a fodrasz-valasztas a legelejen van');
  const e = { first: HAIR.firstState, voucherState: HAIR.voucherState, exact: HAIR.exactState };
  assert.equal(entryState({ hasService: false, voucher: false, ...e }), 'HA0');
  assert.equal(entryState({ hasService: true, voucher: false, ...e }), 'HA0', 'a konkret szolgaltatas landing a fodrasz-valasztora erkezik');
  assert.equal(HAIR.staffFirst, true);
});

test('Fodraszat: a 41 szolgaltatas mind besorolodik a jovahagyott szandekekbe, egy sem vész el', () => {
  assert.equal(hairServices.length, 41);
  const perIntent = Object.fromEntries(HAIR.intents.filter((i) => !i.consult).map((i) => [i.key, intentServices(hairServices, HAIR.intents, i)]));
  assert.deepEqual(Object.fromEntries(Object.entries(perIntent).map(([k, v]) => [k, v.length])), { balayage: 14, color: 12, cut: 5, szaritas: 4, ujraepites: 3, pothaj: 2, other: 0 }, 'az "Egyeb" elemei kulon szandekok: Noi szaritas 4, Hajszerkezet ujraepites 3, Pothaj 2; az egyeb ures (ismeretlen kategoriara var)');
  const all = Object.values(perIntent).flat().map((s) => s.serviceId);
  assert.equal(new Set(all).size, 40, 'egy szolgaltatas csak egy szandekben');
  const consult = hairServices.filter((s) => s.bookingType === 'consultation');
  assert.deepEqual(consult.map((s) => s.serviceId), ['232804']);
  assert.equal(all.length + consult.length, 41);
});

test('Fodraszat: uj, ismeretlen Salonic-kategoria az (alapbol rejtett) "Egyeb"-be kerul (nem vesz el)', () => {
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
  const other = [...byIntent('szaritas'), ...byIntent('ujraepites'), ...byIntent('pothaj')];
  assert.equal(other.length, 4, 'Noi szaritas, JOICO, Pothaj leszedes, Pothaj felrakas');
  assert.equal(byIntent('other').length, 0, 'az Egyeb ures, amig nincs ismeretlen kategoria');
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

test('HeadSpa kartyak a Salonic aktualis szolgaltatasaibol: 3 kartya, az Egyeni Relax + Hair egy kartyan, ajandekkartyahoz is', () => {
  const normal = cardsFor(headspaServices, HEADSPA.cards, { voucher: false });
  assert.deepEqual(normal.map((c) => c.card.key), ['egyeni', 'paros', 'negykezes']);
  assert.match(normal[0].service.name, /Relax/, 'az elsodleges valtozat a Relax');
  assert.equal(normal[0].services.length, 2, 'az Egyeni kartyahoz a Relax es a Hair valtozat is tartozik (ugyanaz a szolgaltatas)');
  assert.ok(normal[0].services.some((s) => /"Hair"/.test(s.name)) && normal[0].services.every((s) => /EGYÉNI/.test(s.name) && !/NÉGYKEZES/.test(s.name)));
  assert.deepEqual(normal.slice(1).map((c) => c.services.length), [1, 1], 'a Paros es a Negykezes egy-egy szolgaltatas');
  assert.ok(normal.every((c) => c.services.every((s) => s.bookingType !== 'voucher_redemption')));
  const voucher = cardsFor(headspaServices, HEADSPA.cards, { voucher: true });
  assert.deepEqual(voucher.map((c) => c.card.key), ['egyeni', 'paros', 'negykezes']);
  assert.equal(voucher[0].services.length, 2, 'a kuponos Egyeni Relax + Hair is egy kartya');
  assert.ok(voucher.every((c) => c.services.every((s) => s.bookingType === 'voucher_redemption')));
  // a valtozat-jeloles nelkuli, egyseges nev (nem latszik, melyik valtozatra megy a foglalas)
  const nevek = normal[0].services.map((s) => HEADSPA.egyesit(displayName(s.name)));
  assert.equal(nevek[0], nevek[1]);
  assert.ok(!/Relax|Hair/i.test(nevek[0]) && /EGYÉNI 50 perces MOSAIC Head Spa/.test(nevek[0]), nevek[0]);
  assert.equal(HEADSPA.egyesit(displayName(normal[1].service.name)), displayName(normal[1].service.name), 'a Paros neve valtozatlan');
  assert.deepEqual(cardsFor([], HEADSPA.cards), [], 'ami nincs a Salonicban, nem jelenik meg');
  assert.ok(!HEADSPA.showStaffFilter);
});

test('mergeVariantSlots: a valtozatok idopontjainak uniója idorend szerint, azonos idopontnal az elso valtozat elol, a service_id megmarad', () => {
  const relax = [{ start_unix: T(5, 12), service_id: 'R', staff_id: '1' }, { start_unix: T(6, 9), service_id: 'R', staff_id: '1' }];
  const hair = [{ start_unix: T(5, 10), service_id: 'H', staff_id: '1' }, { start_unix: T(5, 12), service_id: 'H', staff_id: '2' }, { start_unix: T(7, 9), service_id: 'H', staff_id: '1' }];
  const m = mergeVariantSlots([relax, hair]);
  assert.deepEqual(m.map((s) => s.service_id), ['H', 'R', 'H', 'R', 'H']);
  assert.deepEqual(m.map((s) => s.start_unix), [T(5, 10), T(5, 12), T(5, 12), T(6, 9), T(7, 9)]);
  assert.equal(uniqueTimes(m).find((s) => s.start_unix === T(5, 12)).service_id, 'R', 'az azonos idopontot a Relax viszi (elso valtozat)');
  assert.deepEqual(mergeVariantSlots([hair]).length, 3);
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
  assert.deepEqual(c, { business: 'headspa', serviceKey: 'paros', category: null, voucher: true, intent: null, staffKey: null, coupon: null, sourcePage: '/headspa-budapest', attribution: { utm_source: 'google', gclid: 'abc', fbclid: 'f1', ttclid: 't1' }, sample: 'siker' });
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

test('kuponkod a linkbol (?kupon=): cleanCoupon szabaly, parseContext, a launcher ugyanazt a szabalyt hasznalja', async () => {
  const { cleanCoupon, COUPON_RE } = await import('../assets/js/booking-engine/flow.js');
  for (const jo of ['NYAR20', 'nyar-20', 'AJ_2026', 'abc', 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0']) assert.equal(cleanCoupon(jo), jo, jo);
  assert.equal(cleanCoupon('  NYAR20 '), 'NYAR20', 'a szokozt levagja');
  for (const rossz of ['', null, undefined, 'ab', 'NYAR 20', 'NYAR20!', '<script>', 'a'.repeat(41), 'ÁRNYÉK', "x'y", 'a=b&c=d', '../etc']) assert.equal(cleanCoupon(rossz), null, String(rossz));
  assert.equal(parseContext('?business=hair&kupon=NYAR20').coupon, 'NYAR20');
  assert.equal(parseContext('?kuponkod=NYAR20').coupon, 'NYAR20');
  assert.equal(parseContext('?coupon=NYAR20').coupon, 'NYAR20');
  assert.equal(parseContext('?kupon=NYAR%2020').coupon, null, 'szokoz a kodban: ervenytelen');
  assert.equal(parseContext('?business=hair').coupon, null);
  // a launcher (minden oldalon fut, ezert onallo, bemasolt szabaly) ugyanazt a regexet hasznalja, mint a flow.js
  const fs = await import('node:fs');
  const launcher = fs.readFileSync(new URL('../assets/js/booking-launcher.js', import.meta.url), 'utf8');
  assert.ok(launcher.includes('/^[A-Za-z0-9_-]{3,40}$/'), 'a launcher kupon-szabalya egyezik a flow.COUPON_RE-vel');
  assert.equal(COUPON_RE.source, '^[A-Za-z0-9_-]{3,40}$');
});

test('munkatars-link (?staff=): findStaff - azonosito vagy a nev szavai, ekezet- es kisbetu-fuggetlen, a kedvezmeny-cimke nelkul; csak egyertelmu talalat', async () => {
  const { findStaff, staffLinkKey, staffDisplayName, staffShortName, cleanStaffKey, staffCoverServices } = await import('../assets/js/booking-engine/flow.js');
  const hair = [{ id: '30114', label: 'Betti' }, { id: '23694', label: 'Noel - 20% kedvezmény!' }, { id: '41001', label: 'Evelin' }];
  const oxi = [{ id: '5001', label: 'Bozsoki - Harangozó Tündi' }, { id: '5002', label: 'Vivien' }, { id: '5003', label: 'Móni' }, { id: '5004', label: 'Nagy Móni' }];
  assert.equal(findStaff(hair, 'betti').id, '30114');
  assert.equal(findStaff(hair, 'BETTI').id, '30114');
  assert.equal(findStaff(hair, 'noel').id, '23694', 'a kedvezmeny-cimke nem resze a nevnek');
  assert.equal(findStaff(hair, '41001').id, '41001', 'Salonic azonosito');
  assert.equal(findStaff(oxi, 'tundi').id, '5001', 'ekezet nelkul: Tündi');
  assert.equal(findStaff(oxi, 'Tündi').id, '5001');
  assert.equal(findStaff(oxi, 'bozsoki-harangozo-tundi').id, '5001', 'a teljes nev kotojellel');
  assert.equal(findStaff(oxi, 'vivien').id, '5002');
  assert.equal(findStaff(oxi, 'moni'), null, 'ket szakemberre is illik (Moni, Nagy Moni): nem talalgatunk');
  assert.equal(findStaff(oxi, 'nagy-moni').id, '5004');
  for (const rossz of ['', null, undefined, 'senki', 'betti; drop', '<script>', 'a'.repeat(61)]) assert.equal(findStaff(hair, rossz), null, String(rossz));
  assert.equal(findStaff([], 'betti'), null);
  assert.equal(staffDisplayName('Noel - 20% kedvezmény!'), 'Noel');
  // a fejlec rovid neve: a keresztnev (a magyar nevsorrendben az utolso szo), a kedvezmeny-felirat nelkul
  assert.equal(staffShortName('Bozsoki - Harangozó Tündi'), 'Tündi');
  assert.equal(staffShortName('Szűcs Vivien'), 'Vivien');
  assert.equal(staffShortName('Noel - 20% kedvezmény!'), 'Noel');
  assert.equal(staffShortName('Betti'), 'Betti');
  assert.equal(staffShortName(''), '');
  assert.equal(staffShortName(null), '');
  assert.equal(cleanStaffKey(' betti '), 'betti'); assert.equal(cleanStaffKey('x@y'), null);
  // az ajanlott kulcs: az utolso szo (keresztnev), ha egyedi; kulonben a teljes nev; kulonben az azonosito; es MINDIG visszakeresheto
  assert.deepEqual(hair.map((x) => staffLinkKey(x.label, hair)), ['betti', 'noel', 'evelin']);
  assert.deepEqual(oxi.map((x) => staffLinkKey(x.label, oxi)), ['tundi', 'vivien', 'moni', 'nagy-moni'].map((k, i) => (i === 2 ? '5003' : k)), 'a "Moni" nem egyedi (Nagy Moni is): azonosito');
  for (const lista of [hair, oxi]) for (const x of lista) assert.equal(findStaff(lista, staffLinkKey(x.label, lista)).id, x.id, x.label);
  // a lefedo szolgaltatas-valasztas (a nevekhez annyi naptar-lekeres kell, ahany szolgaltatas a lefedeshez kell)
  const svc = [{ serviceId: 'a', staffIds: ['1', '2'] }, { serviceId: 'b', staffIds: ['2', '3'] }, { serviceId: 'c', staffIds: ['3'] }, { serviceId: 'd', staffIds: [] }];
  assert.deepEqual(staffCoverServices(svc).map((s) => s.serviceId).sort(), ['a', 'b']);
  assert.deepEqual(staffCoverServices([{ serviceId: 'x', staffIds: [] }]), []);
});

test('parseContext: ?staff= (alias: munkatars, szakember), csak ervenyes ertek', () => {
  assert.equal(parseContext('?business=hair&staff=betti').staffKey, 'betti');
  assert.equal(parseContext('?business=hair&munkatars=Tündi').staffKey, 'Tündi');
  assert.equal(parseContext('?business=hair&szakember=noel').staffKey, 'noel');
  assert.equal(parseContext('?business=hair').staffKey, null);
  assert.equal(parseContext('?business=hair&staff=%3Cscript%3E').staffKey, null);
  assert.equal(parseContext('?business=hair&staff=').staffKey, null);
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
    ...HAIR.intents.filter((i) => i.kep).map((i) => i.kep),
    ...HAIR.staffPhotos.map(([, k]) => k),
    ...OXYGEN.staffPhotos.map(([, k]) => k),
    ...LASER.copy.intro.map((o) => o.kep),
    ...LASER.areas.map((a) => a.kep),
  ];
  assert.ok(kulcsok.length >= 31, `${kulcsok.length} kep`);
  for (const k of kulcsok) { assert.ok(k, 'minden kartyanak van kepe'); assert.ok(fs.existsSync(kepFajl(k)), `hianyzik: assets/img/booking/${k}.jpg`); assert.ok(fs.statSync(kepFajl(k)).size < 30000, `${k}: kis kep (< 30 kB)`); }
  assert.equal(new Set(kulcsok).size, kulcsok.length, 'nincs ketszer hasznalt kulcs');
});

test('fodraszat: minden szandek / kezelescsoport / hajhossz illusztracioja letezo fajl (a tulajdonos mintakepei)', () => {
  const kulcsok = new Set();
  for (const intent of HAIR.intents.filter((i) => !i.consult)) {
    for (const g of groupServices(intentServices(hairServices, HAIR.intents, intent))) {
      const k = kezelesKep(g.title);
      assert.ok(k, `${g.title}: van kezeles-kep`); kulcsok.add(k);
      for (const it of g.items) if (it.length) { const h = hajhosszKep(intent.key, it.length); assert.ok(h, `${g.title} / ${it.length}: van hajhossz-kep`); kulcsok.add(h); }
    }
  }
  for (const k of kulcsok) assert.ok(fs.existsSync(kepFajl(k)), `hianyzik: ${k}`);
  assert.equal(hajhosszKep('ujraepites', 'Hosszú haj'), 'hh-joico-hosszu');
  assert.equal(hajhosszKep('szaritas', 'Hosszú haj'), 'hh-hosszu');
  assert.equal(hajhosszKep('szaritas', 'Félhosszú haj'), 'hh-kozepes');
  assert.equal(kezelesKep('Balayage / ombre / babylight + tőfestés + vágás + szárítás'), 'hk-balayage-tofestes');
  assert.equal(kezelesKep('Tőfestés + Vágás + Szárítás'), 'hk-tofestes-vagas-szaritas');
  assert.equal(kezelesKep('Női hajvágás + Szárítás'), 'hk-noi-vagas');
  assert.equal(kezelesKep('Ismeretlen valami'), null);
});

test('szovegek (tulajdonos, 2026-10-04): oxigen hajkamera, HeadSpa ajandekkartya-kerdes, kuponkodos kartyak', () => {
  const kamera = OXYGEN.intents.find((i) => i.key === 'camera');
  assert.equal(kamera.sub, 'Megnézzük a fejbőröd állapotát + átbeszéljük milyen eredményt várhatsz');
  assert.equal(HEADSPA.firstState, 'HS1');
  assert.equal(HEADSPA.copy.hs1Title, 'Ajándékkártyával vagy anélkül foglalsz?');
  assert.deepEqual(HEADSPA.copy.hs1.map((o) => [o.key, o.title]), [['voucher', 'Ajándékkártyával (kuponkóddal) foglalok'], ['normal', 'Normál foglalás kuponkód nélkül']]);
  assert.equal(HEADSPA.copy.voucherSettled, 'Kuponkóddal');
  for (const f of [HEADSPA, OXYGEN, HAIR, LASER]) assert.ok(!f.durationOverride, f.business + ': az idotartam a Salonic ideje (a HeadSpa-nal 1:20, a tulajdonos megerositette)');
  assert.equal(HAIR.copy.staffListTitle, 'Melyik fodrászt választod?');
  assert.ok(OXYGEN.copy.staffListTitle && OXYGEN.copy.staffAny);
});

test('ikonok: a hajhossz- es kezeles-ikonok, a lezer-testreszek es a HeadSpa-kartyak ikonjai mind leteznek', () => {
  for (const l of ['Rövid haj', 'Félhosszú haj', 'Közepes haj', 'Hosszú haj', 'Extra hosszú haj']) assert.ok(IKONOK[hajhosszIkon(l)], l);
  assert.equal(hajhosszIkon('Rövid haj'), 'haj-rovid');
  assert.equal(hajhosszIkon('Extra hosszú haj'), 'haj-extra');
  assert.equal(hajhosszIkon(null), 'haj', 'hajhossz nelkul az altalanos haj-ikon');
  assert.equal(kezelesIkon('Balayage / ombre / babylight + vágás + szárítás'), 'balayage');
  assert.equal(kezelesIkon('Teljes szőkítés / korrekció – vágással'), 'szokites');
  assert.equal(kezelesIkon('Teljes melír / airtouch + vágás + szárítás'), 'melir');
  assert.equal(kezelesIkon('Női hajvágás + szárítás'), 'vagas');
  for (const o of HEADSPA.copy.hs1) assert.ok(IKONOK[o.ikon], o.ikon);
  for (const a of AREAS) assert.ok(IKONOK[areaIkon(a.key)], a.key);
  for (const g of hairServices) assert.ok(IKONOK[kezelesIkon(g.name)], g.name);
});

test('lezer-csomagok: a testreszek a site csomag-leirasa szerint (nem az "allapotfelmeres + kedvezmeny"), ikonokkal', () => {
  const laser = mapping.services.filter((s) => s.business === 'laser').map((s) => ({ serviceId: s.salonic_service_id, name: s.service_name_raw, activePrice: s.active_price }));
  const csomagok = laser.map((s) => [labelOf(s).title, packageOf(s)]).filter(([, p]) => p);
  const nevek = new Set(csomagok.map(([n]) => n.split(' ')[0]));
  for (const n of ['BASIC', 'MEDIUM', 'SUMMER', 'TOTAL', 'MAN', 'EGYEDI']) assert.ok(nevek.has(n), n + ' csomag');
  for (const [n, p] of csomagok) {
    if (/^EGYEDI/.test(n)) { assert.ok(p.leiras && !p.reszek.length); continue; }
    assert.ok(p.reszek.length >= 2, n);
    for (const r of p.reszek) { assert.ok(r.label && IKONOK[r.ikon], n + ': ' + r.label); }
  }
  const labels = (re) => packageOf(laser.find((s) => re.test(labelOf(s).title))).reszek.map((r) => r.label);
  assert.deepEqual(labels(/^BASIC/), ['Hónalj', 'Teljes intim']);
  assert.deepEqual(labels(/^MAN TOTAL/), ['Hát', 'Váll', 'Mellkas', 'Has', 'Hónalj']);
  assert.deepEqual(labels(/^TOTAL/), ['Teljes láb', 'Teljes kar', 'Hónalj', 'Intim']);
  assert.equal(packageOf(laser.find((s) => /Kis testrész/.test(s.name))), null, 'a sima testresz nem csomag');
  assert.equal(packageOf(laser.find((s) => /Alkar/.test(s.name))), null);
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
