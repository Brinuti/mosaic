// Demo-adat tesztek: eletszeru, ellenorizhetoen kitalalt adat; idempotens; soha nem kuld valodi uzenetet; valodi adat mellett nem tolt be.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujAdatbazis } from '../lib/testdb.js';
import { ujTeszt, foglal, hibaKod, mind, elso, szamol, kerdoivBeallit, BASE, NAP } from './fixtures.js';
import { demoAdatBetolt, DEMO_MUNKATARSAK, DEMO_KERDOIV_VERZIO, DEMO_MARKER } from '../lib/demo.js';
import { tick } from '../lib/motor.js';
import { dashboard } from '../lib/dashboard.js';
import { merok } from '../lib/merok.js';
import { dryRunAdapter } from '../lib/messages/kuldo.js';
import { aktivVerzio } from '../lib/assessment.js';

const MOST = BASE;
const szamok = async (db) => Object.fromEntries(await Promise.all(['guest', 'staff_user', 'staff_role', 'booking', 'treatment_session', 'package_purchase', 'complaint', 'consent_event', 'message_job', 'outbox_event', 'camera_image', 'assessment', 'identity_merge_request', 'security_audit', 'salonic_guest_identity'].map(async (t) => [t, await szamol(db, t)])));

test('DEMO betoltes: ~15 vendeg a megkivant allapotokban, 3-4 munkatars szerepkoronkent, jovahagyott DEMO-kerdoiv MARKER-rel', async () => {
  const db = await ujAdatbazis();
  const r = await demoAdatBetolt(db, { most: MOST });
  assert.equal(r.mar, false);
  assert.equal(r.vendegek, 15);
  // munkatarsak
  for (const [szerep, nevek] of Object.entries(DEMO_MUNKATARSAK)) {
    const n = (await elso(db, 'SELECT COUNT(*) AS n FROM staff_role r JOIN staff_user u ON u.id = r.staff_id WHERE r.role_id = ?1 AND u.id LIKE \'demo-staff-%\'', szerep)).n;
    assert.ok(n >= 3 && n <= 4, `${szerep}: ${n}`);
    assert.equal(n, nevek.length);
  }
  // allapotok
  const q = (sql) => elso(db, sql).then((x) => x.n);
  assert.equal(await q('SELECT COUNT(*) AS n FROM booking WHERE status = \'booked\' AND service_code = \'first_hair\' AND start_at > ' + MOST), 4, 'uj foglalasok (Anna, Jolan, Kinga, Livia)');
  assert.equal(await q('SELECT COUNT(*) AS n FROM assessment_credit WHERE status = \'open\''), 1, 'Bea: felmeres kesz, nincs elso kezeles foglalas');
  assert.equal(await q('SELECT COUNT(*) AS n FROM assessment_credit WHERE status = \'eligible\' AND amount_huf = 4990'), 1, '4 990 Ft credit jogosultsag');
  assert.equal(await q('SELECT COUNT(*) AS n FROM treatment_session WHERE treatment_index = 3'), 4, '3. kezeles (Dora, Greta, Hanna + Emma)');
  assert.equal(await q('SELECT COUNT(*) AS n FROM camera_image'), 2, 'Dora 1. es 3. alkalom kepe (tarolo nelkul)');
  assert.equal(await q('SELECT COUNT(*) AS n FROM image_comparison WHERE status = \'final\''), 1, 'kamera-osszehasonlitas');
  assert.equal(await q('SELECT COUNT(*) AS n FROM course WHERE status = \'completed_11\''), 1, '11. lezart kura');
  assert.equal(await q('SELECT COUNT(*) AS n FROM package_purchase WHERE package_type = \'package_5\''), 2);
  assert.equal(await q('SELECT COUNT(*) AS n FROM package_purchase WHERE package_type = \'package_10\''), 1);
  assert.equal(await q(`SELECT COUNT(*) AS n FROM package_purchase WHERE expires_at > ${MOST} AND expires_at < ${MOST + 30 * NAP}`), 1, 'lejaro berlet');
  assert.equal(await q('SELECT COUNT(*) AS n FROM complaint WHERE status = \'open\''), 1, 'nyitott panasz');
  assert.equal(await q('SELECT COUNT(*) AS n FROM contraindication_alert WHERE status = \'open\''), 1, 'kontraindikacio-riasztas');
  assert.equal(await q('SELECT COUNT(*) AS n FROM identity_merge_request WHERE status = \'pending\''), 1, 'fuggo osszevonasi keres');
  assert.equal(await q('SELECT COUNT(*) AS n FROM booking WHERE status = \'no_show\''), 1);
  assert.equal(await q('SELECT COUNT(*) AS n FROM booking WHERE status = \'cancelled\''), 1);
  assert.equal(await q('SELECT COUNT(*) AS n FROM treatment_plan WHERE status IN (\'missing\', \'draft\')'), 1, 'egyetlen hianyzo dokumentum (Cili)');
  // jovahagyott kerdoiv MARKER-rel
  const v = await aktivVerzio(db);
  assert.equal(v.question_version, DEMO_KERDOIV_VERZIO);
  assert.equal(JSON.parse(v.questions).marker, DEMO_MARKER);
  assert.match(v.question_version, /DEMO - nem szakmai/);
});

test('DEMO kitalalt adat: minden vendeg "Demo ..." nevu, @example.invalid e-mail, 06 1 555 xxxx (+36 1 555) telefon; nincs valodi cim; kepek tarolo-bejegyzes nelkul', async () => {
  const db = await ujAdatbazis();
  await demoAdatBetolt(db, { most: MOST });
  const vendegek = await mind(db, 'SELECT name, email, phone FROM guest');
  assert.equal(vendegek.length, 15);
  for (const g of vendegek) {
    assert.match(g.name, /^Demo /);
    assert.match(g.email, /^demo\.[a-z.]+@example\.invalid$/);
    assert.match(g.phone, /^\+361555\d{4}$/);
  }
  for (const u of await mind(db, 'SELECT name, email FROM staff_user')) {
    assert.match(u.name, /^Demo /);
    assert.match(u.email, /@(example|demo)\.invalid$/);
  }
  // szerepkoronkent az elso munkatars a demo-belepes (auth.demoBelep) munkatarsa
  assert.equal((await elso(db, 'SELECT id FROM staff_user WHERE email = \'demo-therapist@demo.invalid\'')).id, 'demo-staff-therapist-1');
  assert.equal((await elso(db, 'SELECT id FROM staff_user WHERE email = \'demo-salon-manager@demo.invalid\'')).id, 'demo-staff-salon_manager-1');
  assert.ok((await szamol(db, 'camera_image')) >= 2);
  assert.equal(await szamol(db, 'crm_fajl'), 0, 'nincs kep / PDF bajt a tarolo-tablaban');
  assert.ok((await mind(db, 'SELECT storage_key FROM camera_image')).every((k) => k.storage_key.startsWith('demo/nincs-kep/')));
  assert.ok((await mind(db, 'SELECT external_id FROM salonic_guest_identity')).every((i) => i.external_id.startsWith('demo-')));
});

test('DEMO idempotens: ketszer (es harmadszor) futtatva egyetlen tabla sem no', async () => {
  const db = await ujAdatbazis();
  const a = await demoAdatBetolt(db, { most: MOST });
  const elotte = await szamok(db);
  const b = await demoAdatBetolt(db, { most: MOST + 7 * NAP });
  const c = await demoAdatBetolt(db, { most: MOST });
  assert.equal(a.mar, false);
  assert.equal(b.mar, true);
  assert.equal(c.mar, true);
  assert.deepEqual(await szamok(db), elotte);
});

test('DEMO megszakadt betoltes folytathato: a determinisztikus azonositok miatt a ketszeri lefutas nem duplikal', async () => {
  const db = await ujAdatbazis();
  await demoAdatBetolt(db, { most: MOST });
  const elotte = await szamok(db);
  await db.prepare('DELETE FROM beallitasok WHERE kulcs = \'demo.betoltve\'').run();   // a marker elveszett (megszakadt futas)
  await demoAdatBetolt(db, { most: MOST });
  const utana = await szamok(db);
  for (const t of ['guest', 'staff_user', 'booking', 'treatment_session', 'package_purchase', 'complaint', 'consent_event', 'identity_merge_request', 'salonic_guest_identity', 'assessment']) assert.equal(utana[t], elotte[t], t);
});

test('DEMO soha nem kuld valodi uzenetet: minden esedekes job sandbox / dry, a kuldo adapter nem kap semmit', async () => {
  const db = await ujAdatbazis();
  await demoAdatBetolt(db, { most: MOST });
  const naplo = [];
  let hivas = 0;
  const kuldo = dryRunAdapter({ naplo });
  const orig = kuldo.kuld.bind(kuldo);
  kuldo.kuld = async (u) => { hivas += 1; return orig(u); };
  for (const nap of [0, 1, 2, 5, 10, 40]) await tick(db, { most: MOST + nap * NAP + 3600, kuldo, konfig: { kuldes: 'dry' } });
  assert.equal(hivas, 0, 'a demo-vendegek (.invalid / demo- azonosito) SANDBOX_ONLY: a kuldo adapter meg dry modban sem kap semmit');
  assert.equal(naplo.length, 0);
  assert.ok((await szamol(db, 'message_job', "stop_reason LIKE 'SANDBOX_ONLY%'")) > 0);
});

test('DEMO + dashboard + merok: a demo-adat a nezetekben megjelenik (kezelo-nezet, menedzsment aggregalt, mutatok)', async () => {
  const db = await ujAdatbazis();
  await demoAdatBetolt(db, { most: MOST });
  const kata = 'demo-staff-therapist-1';
  const k = await dashboard(db, { nezet: 'kezelo', staffId: kata, most: MOST });
  assert.ok(k.ma.foglalasok.length + k.holnap.foglalasok.length >= 0);
  assert.ok(k.keszulo_a5.length >= 1, 'Cili vazlat-dokumentuma');
  assert.ok(k.stopok.ellenjavallati_riasztasok.some((a) => a.vendeg.nev === 'Demo Jolán') || (await dashboard(db, { nezet: 'kezelo', staffId: 'demo-staff-clinical_lead-1', most: MOST })).stopok.ellenjavallati_riasztasok.some((a) => a.vendeg.nev === 'Demo Jolán'));
  const m = await dashboard(db, { nezet: 'menedzsment', staffId: 'demo-staff-salon_manager-1', most: MOST });
  assert.equal(m.stopok.nyitott_panasz_db, 1);
  assert.equal(m.stopok.fuggo_osszevonas_db, 1);
  assert.equal(m.lejaro_berletek.harminc_napon_belul, 1);
  assert.ok(!/Demo (Anna|Bea|Cili|Dóra|Emma|Fanni|Gréta|Hanna|Ilka|Jolán|Kinga|Lívia|Mónika|Nelli)/.test(JSON.stringify(m)), 'a menedzsment nezet nem tartalmaz vendegnevet');
  const mk = await merok(db, { tol: 0, ig: MOST, most: MOST });
  assert.ok(mk.SHOW1.ertek >= 7);
  assert.equal(mk.MERGE_REVIEW_PENDING.ertek, 1);
  assert.equal(mk.R11.ok === 'kohorsz_nem_ert_meg' || mk.R11.ok === 'ok', true);
});

test('DEMO valodi adat mellett NEM tolt be (NEM_URES_ADATBAZIS): valodi vendeg vagy valodi jovahagyott kerdoiv eseten', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  assert.equal(await hibaKod(() => demoAdatBetolt(t.db, { most: MOST })), 'NEM_URES_ADATBAZIS');
  assert.equal(await szamol(t.db, 'staff_user', "id LIKE 'demo-%'"), 0, 'a visszautasitott betoltes nem hagy maga utan demo-adatot');
  const t2 = await ujTeszt();
  await kerdoivBeallit(t2);
  assert.equal(await hibaKod(() => demoAdatBetolt(t2.db, { most: MOST })), 'NEM_URES_ADATBAZIS');
  // kifejezett engedellyel (fejlesztoi kornyezet) betoltheto
  const t3 = await ujTeszt();
  await foglal(t3, { start: BASE + 7 * NAP });
  const r = await demoAdatBetolt(t3.db, { most: MOST, engedelyezNemUres: true });
  assert.equal(r.vendegek, 15);
});
