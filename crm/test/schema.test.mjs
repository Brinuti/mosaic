import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ujAdatbazis } from '../lib/testdb.js';
import { BERLET, CREDIT, SZOLGALTATAS_ADAT } from '../lib/constants.js';
import { uuid } from '../lib/db.js';

const SPEC_TABLAK = ['staff_user', 'role', 'staff_role', 'guest', 'salonic_account', 'salonic_guest_identity', 'identity_merge_request', 'merge_audit', 'service_catalog', 'booking', 'booking_event',
  'treatment_session', 'course', 'package_purchase', 'package_redemption', 'package_adjustment', 'package_gift', 'assessment', 'assessment_submission', 'contraindication_alert', 'assessment_credit',
  'treatment_plan', 'treatment_note', 'camera_image', 'image_comparison', 'share_grant', 'consent_event', 'unsubscribe', 'survey_response', 'review_request', 'complaint', 'complaint_contact_attempt',
  'compensation_approval', 'message_template', 'message_job', 'message_ledger', 'outbox_event', 'retention_purge_job', 'security_audit', 'login_otp', 'session', 'beallitasok'];

test('SCHEMA a spec 3.3 teljes tablakeszlete megvan, a migracio ujrafuttathato', async () => {
  const db = await ujAdatbazis();
  const tablak = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).results.map((r) => r.name);
  for (const t of SPEC_TABLAK) assert.ok(tablak.includes(t), `hianyzik: ${t}`);
  const sql = fs.readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
  await db.exec(sql);   // masodszor is lefut
  await db.exec(sql);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM role').first()).n, 6);
});

test('SCHEMA a magadatok megegyeznek a constants.js-sel; egyetlen Salonic-fiok: mosaic-oxigen', async () => {
  const db = await ujAdatbazis();
  const fiokok = (await db.prepare('SELECT id FROM salonic_account').all()).results.map((r) => r.id);
  assert.deepEqual(fiokok, ['mosaic-oxigen']);
  for (const [kod, adat] of Object.entries(SZOLGALTATAS_ADAT)) {
    const r = await db.prepare('SELECT * FROM service_catalog WHERE code = ?1').bind(kod).first();
    assert.equal(r.price_huf, adat.ar, kod);
    assert.equal(r.duration_min, adat.perc, kod);
    assert.equal(r.counts_as_treatment, adat.kezeles ? 1 : 0, kod);
    assert.equal(r.sellable, adat.ertekesitheto ? 1 : 0, kod);
  }
  assert.equal(CREDIT.osszeg, 4990);
  assert.equal(BERLET.package_5.ar + BERLET.package_5.ar, BERLET.package_10.ar);   // 2x5 ara = 1x10 ara (nincs upgrade-kedvezmeny)
});

test('SCHEMA UNIQUE kulcsok: booking(account, external_id), message_job idempotency_key, share_grant token_hash', async () => {
  const db = await ujAdatbazis();
  const g = uuid();
  await db.prepare("INSERT INTO guest (id, created_at, updated_at) VALUES (?1, 1, 1)").bind(g).run();
  const ujFogl = (ext) => db.prepare("INSERT INTO booking (id, account, external_id, guest_id, service_code, start_at, booked_at, original_start_at, last_event_at, created_at, updated_at) VALUES (?1, 'mosaic-oxigen', ?2, ?3, 'first_hair', 100, 1, 100, 1, 1, 1)").bind(uuid(), ext, g).run();
  await ujFogl('x1');
  await assert.rejects(ujFogl('x1'), /UNIQUE/);
  const job = () => db.prepare("INSERT INTO message_job (id, template_key, channel, idempotency_key, run_at, created_at) VALUES (?1, 'T0-F', 'email', 'k1', 1, 1)").bind(uuid()).run();
  await job();
  await assert.rejects(job(), /UNIQUE/);
  const grant = () => db.prepare("INSERT INTO share_grant (id, guest_id, token_hash, email_at_issue, issued_at, expires_at) VALUES (?1, ?2, 'h', 'a@b.hu', 1, 2)").bind(uuid(), g).run();
  await grant();
  await assert.rejects(grant(), /UNIQUE/);
});

test('SCHEMA az audit-naplok csak hozzafuzhetok; a foglalas completed csak igazolassal johet letre (CHECK)', async () => {
  const db = await ujAdatbazis();
  await db.prepare("INSERT INTO security_audit (id, at, action, resource, result) VALUES ('a', 1, 'x', 'y', 'ok')").run();
  await assert.rejects(db.prepare("UPDATE security_audit SET result = 'denied' WHERE id = 'a'").run(), /audit_append_only/);
  await assert.rejects(db.prepare("DELETE FROM security_audit WHERE id = 'a'").run(), /audit_append_only/);
  const g = uuid();
  await db.prepare("INSERT INTO guest (id, created_at, updated_at) VALUES (?1, 1, 1)").bind(g).run();
  await assert.rejects(db.prepare("INSERT INTO booking (id, account, external_id, guest_id, service_code, start_at, status, booked_at, original_start_at, last_event_at, created_at, updated_at) VALUES (?1, 'mosaic-oxigen', 'c1', ?2, 'first_hair', 100, 'completed', 1, 100, 1, 1, 1)").bind(uuid(), g).run(), /CHECK/);
});
