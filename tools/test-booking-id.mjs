// A sajat foglalas-azonosito (booking_id) es a bongeszo meresi kontextusa (QA-1) egysegtesztjei:
//   node --test tools/test-booking-id.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CTX_KEY, CTX_MS, ID_RE, createBookingContext, isBookingId, newBookingId } from '../assets/js/booking-engine/booking-id.js';
import { BOOKING_ID_PATTERN } from '../assets/js/booking-engine/salonic-adapter.js';
import { createTracker } from '../assets/js/booking-engine/tracking.js';

// sessionStorage-utanzat
const tarolo = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const ora = (t0 = 1791300000000) => { let t = t0; const f = () => t; f.tick = (ms) => { t += ms; }; return f; };

test('newBookingId: alak (mb_ + [a-z0-9]), URL-biztos, az adapter mintajanak is megfelel, ezer db kozott nincs utkozes', () => {
  const ids = new Set();
  for (let i = 0; i < 1000; i++) { const id = newBookingId(); assert.match(id, ID_RE); assert.ok(BOOKING_ID_PATTERN.test(id)); assert.ok(id.length >= 15 && id.length <= 32); ids.add(id); }
  assert.equal(ids.size, 1000);
  const id = newBookingId(); assert.equal(encodeURIComponent(id), id, 'nincs kodolando karakter');
});

test('newBookingId: veletlen-forras nelkul (nincs crypto) is mukodik; a kezdo idobelyeg miatt az azonosito rendezheto', () => {
  const a = newBookingId({ now: () => 1791300000000, getRandomValues: null });
  const b = newBookingId({ now: () => 1791300060000, getRandomValues: null });
  assert.match(a, ID_RE); assert.match(b, ID_RE);
  assert.ok(a < b, 'a kesobbi azonosito nagyobb');
});

test('isBookingId: csak a sajat alak; Salonic-azonosito, szintetikus ref, URL, ures nem az', () => {
  assert.equal(isBookingId(newBookingId()), true);
  for (const x of ['', null, undefined, 'g:2038420', '85ebd7de-61c6-79fa-d1c5-c9303082fb23', '2038420-302342-1793377800', 'mb_', 'mb_ABCDEFGHIJKLMNOP', 'https://x.hu/?back=mb_abcdefghijklmn']) assert.equal(isBookingId(x), false, String(x));
});

test('begin: a folyamat elejen uj azonosito, es elmenti a sessionStorage-ba (nincs szemelyes adat)', () => {
  const s = tarolo(); const t = ora();
  const c = createBookingContext({ storage: s, now: t });
  const k = c.begin({ business: 'hair', source_page: '/noi-fodraszat-budapest' });
  assert.match(k.id, ID_RE);
  assert.equal(c.id, k.id);
  const tarolt = JSON.parse(s.getItem(CTX_KEY));
  assert.equal(tarolt.id, k.id);
  assert.equal(tarolt.business, 'hair');
  assert.equal(tarolt.source_page, '/noi-fodraszat-budapest');
  assert.equal(tarolt.completed_at, null);
  assert.deepEqual(Object.keys(tarolt).sort(), ['business', 'carrier', 'completed_at', 'created', 'id', 'returned', 'seen', 'sent_at', 'service_id', 'slot_unix', 'source_page', 'staff_id']);
});

test('begin: a megnyitas-bezaras-ujranyitas (uj motor ugyanabban a munkamenetben) ugyanazt a lezaratlan, friss foglalast folytatja', () => {
  const s = tarolo(); const t = ora();
  const elso = createBookingContext({ storage: s, now: t }).begin({ business: 'oxygen' });
  t.tick(10 * 60 * 1000);
  const masodik = createBookingContext({ storage: s, now: t }).begin({ business: 'oxygen' });
  assert.equal(masodik.id, elso.id);
});

test('begin: 30 perc utan, vagy lezaras utan uj azonositot kap; a regi kontextus nem folytathato', () => {
  const s = tarolo(); const t = ora();
  const c = createBookingContext({ storage: s, now: t });
  const elso = c.begin({ business: 'headspa' }).id;
  t.tick(CTX_MS + 1000);
  const lejart = createBookingContext({ storage: s, now: t }).begin({}).id;
  assert.notEqual(lejart, elso);
  const c2 = createBookingContext({ storage: s, now: t });
  const id2 = c2.begin({}).id; c2.complete({ returned: true, where: 'bookingUrl:back' });
  const kovetkezo = createBookingContext({ storage: s, now: t }).begin({}).id;
  assert.notEqual(kovetkezo, id2, 'lezart foglalas utan a kovetkezo uj azonositot kap');
  assert.notEqual(c2.begin({}).id, id2, 'ugyanezen a motoron is');
});

test('a foglalas ketszer nem hasznalja ugyanazt az azonositot: a begin a lezaras utan ujat ad (C4 ujrahivasa)', () => {
  const t = ora(); const c = createBookingContext({ storage: tarolo(), now: t });
  const a = c.begin({}).id; assert.equal(c.begin({}).id, a, 'lezaratlanul ugyanaz');
  c.complete({ returned: false });
  assert.notEqual(c.begin({}).id, a);
});

test('update: csak ismert kulcsok, szamok szamok; szemelyes adat nem kerulhet a kontextusba', () => {
  const s = tarolo(); const c = createBookingContext({ storage: s, now: ora() });
  c.begin({ business: 'laser' });
  c.update({ service_id: 476477, slot_unix: '1792566900', staff_id: -1, carrier: 'back', sent_at: 1791300000000, name: 'Teszt Elek', email: 'a@b.hu', phone: '+36', g: 'g:2038420' });
  const k = JSON.parse(s.getItem(CTX_KEY));
  assert.equal(k.service_id, '476477'); assert.equal(k.slot_unix, 1792566900); assert.equal(k.staff_id, '-1'); assert.equal(k.carrier, 'back');
  assert.ok(!/Teszt|a@b\.hu|\+36|g:2038420/.test(JSON.stringify(k)), 'nincs szemelyes adat / vendegazonosito');
});

test('complete: a visszhang (hol jott vissza) rogzul; a koszonooldal (get) a lezart kontextust is megkapja, de ujat nem general', () => {
  const s = tarolo(); const t = ora();
  const c = createBookingContext({ storage: s, now: t });
  const id = c.begin({ business: 'hair' }).id;
  c.complete({ returned: true, where: 'bookingUrl:back' });
  t.tick(60 * 1000);
  const koszono = createBookingContext({ storage: s, now: t }); // masik oldal, ugyanaz a munkamenet
  const k = koszono.get();
  assert.equal(k.id, id);
  assert.deepEqual(k.returned, { returned: true, where: 'bookingUrl:back' });
  assert.ok(k.completed_at);
  assert.equal(JSON.parse(s.getItem(CTX_KEY)).id, id, 'a get() nem irta felul');
  t.tick(CTX_MS + 1000);
  assert.equal(createBookingContext({ storage: s, now: t }).get(), null, 'a regi lezart kontextus lejar');
  const mas = createBookingContext({ storage: tarolo(), now: t }); assert.equal(mas.get(), null, 'nincs kontextus: null, uj nem szuletik');
});

test('hibas / hamisitott tarolt adat nem folytathato; a tarolo nelkuli (privat mod) motor is mukodik', () => {
  for (const rossz of ['{nem json', 'null', '{"id":"g:2038420","created":1}', JSON.stringify({ id: 'mb_abcdefghijklm', created: 'x' }), '[]']) {
    const c = createBookingContext({ storage: tarolo({ [CTX_KEY]: rossz }), now: ora() });
    const k = c.begin({}); assert.match(k.id, ID_RE);
  }
  const eldob = { getItem() { throw new Error('tiltott'); }, setItem() { throw new Error('tiltott'); } };
  const c = createBookingContext({ storage: eldob, now: ora() });
  assert.match(c.begin({ business: 'hair' }).id, ID_RE); c.update({ service_id: 1 }); c.complete({ returned: false });
  const nincs = createBookingContext({ storage: null, now: ora() }); assert.match(nincs.begin({}).id, ID_RE); assert.equal(nincs.get().id, nincs.id);
});

test('a tracker minden esemenyre rarakja a sajat booking_id-t; setBookingId (uj foglalas) a kovetkezo esemenytol ervenyes', () => {
  const dl = []; const t = createTracker({ ctx: { business: 'hair', sourcePage: '/x', attribution: {} }, dataLayer: dl, bookingId: 'mb_aaaaaaaaaaaaaaaa' });
  t.track('booking_service_selected', { service_id: '232804' });
  t.setBookingId('mb_bbbbbbbbbbbbbbbb');
  t.track('booking_slot_selected', {});
  t.track('booking_completed', { booking_ref: 'g:1-232804-1793120400', booking_id_echo: 'bookingUrl:back', final_price: 0 });
  assert.deepEqual(dl.map((e) => e.booking_id), ['mb_aaaaaaaaaaaaaaaa', 'mb_bbbbbbbbbbbbbbbb', 'mb_bbbbbbbbbbbbbbbb']);
  assert.equal(dl[2].booking_ref, 'g:1-232804-1793120400');
  assert.equal(dl[2].booking_id_echo, 'bookingUrl:back');
  const nincs = []; const t2 = createTracker({ ctx: { business: 'hair', attribution: {} }, dataLayer: nincs });
  t2.track('booking_slot_selected', {}); assert.ok(!('booking_id' in nincs[0]), 'azonosito nelkul nincs booking_id kulcs');
});
