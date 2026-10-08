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

test('normalizeOptions / layerUrl: a munkatars (staff) a CTA-bol atmegy a kontextusba es az URL-allapotba; alias, tiszta ertek', () => {
  assert.equal(normalizeOptions({ business: 'hair', staff: 'betti' }).staff, 'betti');
  assert.equal(normalizeOptions(new URLSearchParams('business=hair&staff=betti')).staff, 'betti');
  assert.equal(normalizeOptions({ business: 'hair', munkatars: 'Noel' }).staff, 'Noel');
  assert.equal(normalizeOptions({ business: 'hair', szakember: 'evelin' }).staff, 'evelin');
  assert.equal('staff' in normalizeOptions({ business: 'hair' }), false);
  assert.equal('staff' in normalizeOptions({ business: 'hair', staff: '<x>' }), false, 'ervenytelen ertek kidobva');
  assert.match(layerUrl('https://www.mosaicheadspa.hu/noi-fodraszat-budapest', normalizeOptions({ business: 'hair', staff: 'betti' })), /^\/noi-fodraszat-budapest\?booking=1&business=hair&staff=betti$/);
  assert.equal(cleanUrl('https://www.mosaicheadspa.hu/x?booking=1&business=hair&staff=betti&utm_source=a'), '/x?utm_source=a', 'bezaraskor a staff is kikerul a cimsorbol');
});

test('normalizeOptions / layerUrl: a kuponkod (kupon) a CTA-bol atmegy a kontextusba, de NEM kerul az URL-allapotba; alias, tiszta ertek', () => {
  assert.equal(normalizeOptions({ business: 'headspa', kupon: 'NYAR20' }).kupon, 'NYAR20');
  assert.equal(normalizeOptions(new URLSearchParams('business=headspa&kupon=NYAR20')).kupon, 'NYAR20');
  assert.equal(normalizeOptions({ business: 'headspa', coupon: 'NYAR20' }).kupon, 'NYAR20');
  assert.equal(normalizeOptions({ business: 'headspa', kuponkod: 'NYAR20' }).kupon, 'NYAR20');
  assert.equal('kupon' in normalizeOptions({ business: 'headspa' }), false);
  assert.equal('kupon' in normalizeOptions({ business: 'headspa', kupon: 'rossz kod!' }), false, 'ervenytelen ertek kidobva');
  assert.equal(layerUrl('https://www.mosaicheadspa.hu/headspa-budapest', normalizeOptions({ business: 'headspa', kupon: 'NYAR20' })), '/headspa-budapest?booking=1&business=headspa', 'a kod nem kerul az elozmeny-URL-be');
});

test('normalizeOptions / layerUrl: az elovalasztott idopont (start) a kontextusba megy (a motor onnan veszi), de NEM kerul az URL-allapotba; rossz ertek eldobodik', () => {
  assert.deepEqual(normalizeOptions({ business: 'laser', service: '476488', start: '1791000000' }), { business: 'laser', service: '476488', start: '1791000000' });
  assert.deepEqual(normalizeOptions({ business: 'laser', service: '476488', start: 1791000000 }), { business: 'laser', service: '476488', start: '1791000000' });
  assert.deepEqual(normalizeOptions(new URLSearchParams('booking=1&business=laser&service=konzult&start=1791000000')), { business: 'laser', service: 'konzult', start: '1791000000' });
  assert.deepEqual(normalizeOptions({ business: 'laser', start: 'holnap' }), { business: 'laser' });
  assert.deepEqual(normalizeOptions({ business: 'laser', start: '12' }), { business: 'laser' });
  assert.equal(layerUrl('https://x.hu/p', { business: 'laser', service: '476488', start: '1791000000' }), '/p?booking=1&business=laser&service=476488');
  assert.equal(cleanUrl('https://x.hu/p?booking=1&business=laser&start=1791000000'), '/p');
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
