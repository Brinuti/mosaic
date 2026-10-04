// A foglalo-reteg tiszta logikajanak tesztje (DOM nelkul): belepesi opciok egysegesitese, URL-allapot, kontextus-ertelmezes, H0.
//   node --test tools/test-booking-layer.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOptions, layerUrl, cleanUrl } from '../assets/js/booking-engine/layer.js';
import { parseContext } from '../assets/js/booking-engine/flow.js';
import { CHOOSER } from '../assets/js/booking-engine/families.js';

test('normalizeOptions: aliasok es ures ertekek', () => {
  assert.deepEqual(normalizeOptions({ business: 'hair', service_category: 'balayage' }), { business: 'hair', category: 'balayage' });
  assert.deepEqual(normalizeOptions({ business: 'headspa', service_id: 'paros', voucher: true }), { business: 'headspa', service: 'paros', voucher: '1' });
  assert.deepEqual(normalizeOptions({ business: 'laser', intent: 'first', voucher: '0' }), { business: 'laser', intent: 'first' });
  assert.deepEqual(normalizeOptions({}), {});
  assert.deepEqual(normalizeOptions(new URLSearchParams('booking=1&business=oxygen&service=466110&utm_source=x')), { business: 'oxygen', service: '466110' });
});

test('layerUrl: booking=1 + kontextus, a sajat parameterek (UTM, click ID) megmaradnak, a regi booking-parameterek helyere kerulnek', () => {
  assert.equal(layerUrl('https://x.hu/mosaic-hair-balayage', { business: 'hair', category: 'balayage' }), '/mosaic-hair-balayage?booking=1&business=hair&category=balayage');
  assert.equal(layerUrl('https://x.hu/p?utm_source=a&gclid=G1&booking=1&business=laser#C1', { business: 'hair' }), '/p?utm_source=a&gclid=G1&booking=1&business=hair');
  assert.equal(layerUrl('https://x.hu/p', {}), '/p?booking=1');
});

test('cleanUrl: a booking-parameterek es a hash nelkul, a tobbi megmarad', () => {
  assert.equal(cleanUrl('https://x.hu/p?utm_source=a&booking=1&business=hair&service_category=balayage&source_page=%2Fp#HA2'), '/p?utm_source=a');
  assert.equal(cleanUrl('https://x.hu/p?booking=1'), '/p');
});

test('parseContext: uzletag nelkul a defaultBusiness (HeadSpa a /foglalo-motor alapja, null a /foglalas-nal es a retegnel)', () => {
  assert.equal(parseContext('').business, 'headspa');
  assert.equal(parseContext('', '', '', { defaultBusiness: null }).business, null);
  assert.equal(parseContext('?business=hair', '', '', { defaultBusiness: null }).business, 'hair');
});

test('parseContext: service_id / service_category aliasok, a regi nevek elsobbseget elveznek', () => {
  const c = parseContext('?business=hair&service_category=balayage&service_id=232804');
  assert.equal(c.category, 'balayage'); assert.equal(c.serviceKey, '232804');
  const d = parseContext('?business=hair&category=color&service_category=balayage&service=konzult&service_id=1');
  assert.equal(d.category, 'color'); assert.equal(d.serviceKey, 'konzult');
});

test('parseContext: hirdetesi azonositok es forras-oldal', () => {
  const c = parseContext('?gclid=G1&utm_source=teszt&fbclid=F1&ttclid=T1&source_page=%2Fbalayage', '', '', { defaultBusiness: null });
  assert.deepEqual(c.attribution, { utm_source: 'teszt', gclid: 'G1', fbclid: 'F1', ttclid: 'T1' });
  assert.equal(c.sourcePage, '/balayage');
});

test('H0: ot szolgaltatas-csalad, a PMU kulso, a tobbi uzletag ismert flow-ra mutat', () => {
  assert.deepEqual(CHOOSER.families.map((f) => f.key), ['headspa', 'hair', 'oxygen', 'laser', 'pmu']);
  assert.equal(CHOOSER.families.filter((f) => f.external).length, 1);
  assert.equal(CHOOSER.families.find((f) => f.external).key, 'pmu');
  for (const f of CHOOSER.families) assert.ok(f.title && f.sub && f.business, f.key);
});
