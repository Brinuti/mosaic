// A jovahagyott besorolas tesztjei (docs/booking-engine/DECISIONS.md):
//   node --test tools/test-business-config.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKING_TYPES, NON_BOOKING_OUTCOMES, classifyService, effectiveType, isAcquisition } from '../assets/js/booking-engine/business-config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const mapping = JSON.parse(fs.readFileSync(path.join(here, '..', 'docs', 'booking-engine', 'SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json'), 'utf8'));
const asService = (s) => ({ specId: s.salonic_spec_id, name: s.service_name_raw, activePrice: s.active_price });
const classified = mapping.services.map((s) => ({ s, c: classifyService(s.business, asService(s)) }));
const count = (business, type) => classified.filter((x) => x.s.business === business && x.c.bookingType === type).length;

test('a readback mind a 107 szolgaltatasa besorolodik, unclassified egy sincs', () => {
  assert.equal(mapping.services.length, 107);
  assert.deepEqual(classified.filter((x) => x.c.bookingType === 'unclassified').map((x) => x.s.salonic_service_id), []);
});

test('darabszamok uzletagankent (a jovahagyott szabaly szerint)', () => {
  assert.equal(count('headspa', 'first_treatment'), 4);
  assert.equal(count('headspa', 'voucher_redemption'), 4);
  assert.equal(count('hair', 'consultation'), 1);
  assert.equal(count('hair', 'first_treatment'), 40);
  assert.equal(count('oxygen', 'first_treatment'), 2);
  assert.equal(count('oxygen', 'returning_treatment'), 1);
  assert.equal(count('laser', 'consultation'), 1);
  assert.equal(count('laser', 'first_treatment'), 23);
  assert.equal(count('laser', 'returning_treatment'), 23);
  assert.equal(count('pmu', 'consultation'), 1);
  assert.equal(count('pmu', 'first_treatment'), 6);
  assert.equal(count('pmu', 'correction'), 1);
});

test('kupon / ajandekkartya (HeadSpa 41471 kategoria) = bevaltas, nem uj vendeg', () => {
  const v = classified.filter((x) => x.s.business === 'headspa' && x.s.salonic_spec_id === '41471');
  assert.equal(v.length, 4);
  for (const { c } of v) {
    assert.equal(c.bookingType, 'voucher_redemption');
    assert.equal(isAcquisition({ bookingType: c.bookingType, splitByRuntime: c.splitByRuntime, firstBooking: true }), false);
  }
});

test('PMU: a korrekcio nem foglalhato online; az eltavolitas es a foto-elbiralas nem foglalas', () => {
  const corr = classified.find((x) => x.s.business === 'pmu' && /korrekci/i.test(x.s.service_name_raw));
  assert.equal(corr.c.bookingType, 'correction');
  assert.equal(corr.c.bookable, false);
  assert.deepEqual([...NON_BOOKING_OUTCOMES.pmu].sort(), ['photo_review_lead', 'removal']);
  assert.ok(!classified.some((x) => x.s.business === 'pmu' && /elt[aá]vol[ií]t/i.test(x.s.service_name_raw)), 'nincs Salonic-eltavolitas');
});

test('nincs VIP szolgaltatas a besorolt listaban', () => {
  assert.ok(!mapping.services.some((s) => /\bVIP\b/i.test(s.service_name_raw) && s.business === 'headspa'));
});

test('az ar nem olvashato jelzes: ures vagy 0 ar, es az egyedi csomagok sem lesznek konzultacio', () => {
  const laserCustom = classified.filter((x) => x.s.business === 'laser' && /EGYEDI CSOMAG/.test(x.s.service_name_raw));
  assert.equal(laserCustom.length, 2);
  for (const { c } of laserCustom) { assert.notEqual(c.bookingType, 'consultation'); assert.ok(c.flags.includes('price_not_readable')); }
  assert.ok(classified.filter((x) => x.c.bookingType === 'consultation').every((x) => x.c.flags.includes('price_not_readable')), 'az ingyenes konzultaciok ara 0/ures');
});

test('uj szolgaltatas: az Oxigen hajkamerás vizsgalat konzultacio lesz, ismeretlen kategoria pedig unclassified (nem talal ki tipust)', () => {
  assert.equal(classifyService('oxygen', { specId: null, name: 'Konzultáció + Hajkamerás vizsgálat', activePrice: 4990 }).bookingType, 'consultation');
  const u = classifyService('oxygen', { specId: '99999', name: 'Valami uj kezeles', activePrice: 10000 });
  assert.equal(u.bookingType, 'unclassified');
  assert.equal(u.bookable, false);
  assert.ok(u.flags.includes('unclassified'));
  assert.throws(() => classifyService('nincs', { specId: '1', name: 'x', activePrice: 1 }));
});

test('futasidoben vegso tipus: first_booking=false eseten az elso kezeles visszatero, a kategoria szerinti elso marad', () => {
  assert.equal(effectiveType({ bookingType: 'first_treatment', splitByRuntime: true, firstBooking: false }), BOOKING_TYPES.returning_treatment);
  assert.equal(effectiveType({ bookingType: 'first_treatment', splitByRuntime: true, firstBooking: true }), BOOKING_TYPES.first_treatment);
  assert.equal(effectiveType({ bookingType: 'first_treatment', splitByRuntime: false, firstBooking: false }), BOOKING_TYPES.first_treatment);
  assert.equal(effectiveType({ bookingType: 'voucher_redemption', splitByRuntime: false, firstBooking: false }), BOOKING_TYPES.voucher_redemption);
});

test('isAcquisition igazsagtabla', () => {
  const t = (bookingType, firstBooking, splitByRuntime = false) => isAcquisition({ bookingType, splitByRuntime, firstBooking });
  assert.equal(t('first_treatment', true), true);
  assert.equal(t('consultation', true), true);
  assert.equal(t('first_treatment', false, true), false); // a Salonic szerint visszatero
  assert.equal(t('first_treatment', undefined), false); // ismeretlen = nem szamitjuk
  assert.equal(t('returning_treatment', true), false);
  assert.equal(t('voucher_redemption', true), false);
  assert.equal(t('correction', true), false);
});
