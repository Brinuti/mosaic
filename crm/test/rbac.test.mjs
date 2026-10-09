import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, hibaKod, szamol } from './fixtures.js';
import { lehet, megkoveteli, szerepek, MATRIX } from '../lib/rbac.js';
import { SZEREPKOROK } from '../lib/constants.js';

test('RBAC a hat szerepkor megvan; ismeretlen szerepkor semmit nem tehet', () => {
  assert.deepEqual(Object.keys(MATRIX).sort(), [...SZEREPKOROK].sort());
  assert.equal(lehet('hacker', 'read', 'guest_basic'), false);
  assert.equal(lehet([], 'read', 'guest_basic'), false);
  assert.equal(lehet(undefined, 'read', 'guest_basic'), false);
});

test('S01 RBAC-matrix (3.10): a recepcio csak minimalis kereskedelmi adatot lat - nincs kep, kerdoiv, terv, jegyzet, panasz', () => {
  for (const er of ['camera_image', 'image_comparison', 'assessment', 'plan', 'treatment_note', 'complaint', 'contraindication_alert']) {
    for (const m of ['read', 'write']) assert.equal(lehet('reception', m, er), false, `${er}.${m}`);
  }
  for (const [m, er] of [['write', 'package'], ['write', 'gift'], ['mark', 'credit'], ['read', 'booking'], ['write', 'consent']]) assert.equal(lehet('reception', m, er), true, `${er}.${m}`);
  assert.equal(lehet('reception', 'confirm', 'booking'), false);   // completed-et nem igazolhat
});

test('RBAC kezelo + szakmai vezeto: klinikai dokumentacio igen; a szakmai vezeto a panaszt nem intezi; kerdoiv-jovahagyas csak Janka', () => {
  for (const er of ['camera_image', 'assessment', 'plan', 'treatment_note']) assert.equal(lehet('therapist', 'read', er), true);
  assert.equal(lehet('therapist', 'confirm', 'booking'), true);
  assert.equal(lehet('clinical_lead', 'confirm', 'booking'), true);
  assert.equal(lehet('clinical_lead', 'write', 'complaint'), false);
  assert.equal(lehet('therapist', 'write', 'complaint'), true);
  assert.equal(lehet('therapist', 'approve', 'assessment_version'), false);
  assert.equal(lehet('clinical_lead', 'approve', 'assessment_version'), true);
  assert.equal(lehet('therapist', 'approve', 'compensation'), false);
  assert.equal(lehet('therapist', 'approve', 'package'), false);
});

test('RBAC szalonvezeto: penzugyi jovahagyas; marketing: csak aggregalt; admin: audit/hozzaferes, de klinikai adat nem', () => {
  for (const er of ['package', 'compensation']) assert.equal(lehet('salon_manager', 'approve', er), true);
  assert.equal(lehet('salon_manager', 'read', 'camera_image'), false);
  assert.equal(lehet('marketing', 'read', 'stats_aggregate'), true);
  for (const er of ['guest_basic', 'camera_image', 'assessment', 'plan', 'complaint', 'consent', 'booking']) assert.equal(lehet('marketing', 'read', er), false, er);
  assert.equal(lehet('admin', 'export', 'audit'), true);
  assert.equal(lehet('admin', 'write', 'staff_admin'), true);
  for (const er of ['camera_image', 'assessment', 'plan', 'treatment_note']) assert.equal(lehet('admin', 'read', er), false, er);
});

test('RBAC backend-ellenorzes: megkoveteli() tiltaskor audit sort ir; inaktiv munkatars / ismeretlen azonosito semmit nem tehet; tobb szerep osszeadodik', async () => {
  const t = await ujTeszt();
  assert.deepEqual(await szerepek(t.db, t.staff.terapeuta), ['therapist']);
  assert.equal(await hibaKod(() => megkoveteli(t.db, t.staff.recepcio, 'read', 'camera_image', { guestId: 'g1', resourceId: 'k1' })), 'TILTOTT');
  assert.equal(await szamol(t.db, 'security_audit', "result = 'denied' AND resource = 'camera_image' AND staff_id = ?1 AND guest_id = 'g1'", t.staff.recepcio), 1);
  await t.db.prepare('UPDATE staff_user SET active = 0 WHERE id = ?1').bind(t.staff.terapeuta).run();
  assert.deepEqual(await szerepek(t.db, t.staff.terapeuta), []);
  assert.equal(await hibaKod(() => megkoveteli(t.db, t.staff.terapeuta, 'read', 'plan')), 'TILTOTT');
  assert.equal(await hibaKod(() => megkoveteli(t.db, null, 'read', 'plan')), 'TILTOTT');
  await t.db.prepare("INSERT INTO staff_role (staff_id, role_id, granted_at) VALUES (?1, 'therapist', 1)").bind(t.staff.recepcio).run();
  assert.deepEqual((await szerepek(t.db, t.staff.recepcio)).sort(), ['reception', 'therapist']);
  await megkoveteli(t.db, t.staff.recepcio, 'read', 'camera_image');   // a kezelo-szerepkor is megvan -> mehet
});
