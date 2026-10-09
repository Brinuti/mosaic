import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, szamol, elso, mind, sessionok, jpegBajtok, BASE, NAP, VENDEG_A } from './fixtures.js';
import * as pl from '../lib/plan.js';
import { kepFeltolt } from '../lib/images.js';

const TERV = () => ({
  fo_panasz: 'Hajhullas, ritkulo fejtetoi resz', megfigyelesek: ['ritkulo fejtetoi resz', 'enyhe zsirosodas'], cel: 'A hajhullas csokkentese, a fejbor egyensulya',
  teljes_kura_11: true, ritmus_nap: 14, otthoni_apolas: { termek: 'Oxygeni sampon', hasznalat: 'hetente 2-3 alkalommal', opcionalis: true },
  kezeloi_javaslat: 'A kamerakepen ritkulo fejtetoi resz latszik. Ket hetente javaslom a kezelest. Jelezz, ha barmi kellemetlen.',
  kovetkezo_idopont: { javasolt_intervallum: '2 het mulva' },
});
async function elsoKezeles(t, { kep = true } = {}) {
  const [k] = await kezelesek(t, { n: 1 });
  const s = await elso(t.db, 'SELECT * FROM treatment_session');
  if (kep) await kepFeltolt(t.db, { sessionId: s.id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo });
  const plan = await elso(t.db, 'SELECT * FROM treatment_plan');
  return { k, s, plan };
}

test('PLAN mondatszam: 2-3 mondat felismerese', () => {
  assert.equal(pl.mondatSzam('Egy mondat.'), 1);
  assert.equal(pl.mondatSzam('Elso mondat. Masodik mondat!'), 2);
  assert.equal(pl.mondatSzam('Elso. Masodik? Harmadik. Negyedik.'), 4);
  assert.equal(pl.mondatSzam(''), 0);
});

test('C07 hianyzo / hianyos kezeloi jegyzet: a SZEMELYES A5 es a kep NEM kuldheto (csak draft / missing)', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezeles(t);
  assert.equal(plan.status, 'missing');
  let k = await pl.kuldhetoE(t.db, plan.id);
  assert.equal(k.ok, false);
  assert.ok(k.hianyok.includes('ALLAPOT:missing'));
  // hianyos vazlat
  await pl.ment(t.db, { planId: plan.id, mezok: { fo_panasz: 'Hajhullas' }, staffId: t.staff.terapeuta });
  k = await pl.kuldhetoE(t.db, plan.id);
  assert.equal(k.ok, false);
  assert.ok(k.hianyok.some((h) => h.startsWith('MEZO:')));
  assert.equal(await hibaKod(() => pl.veglegesit(t.db, { planId: plan.id, staffId: t.staff.terapeuta })), 'HIANYOS_MEZOK');
  assert.equal(await hibaKod(() => pl.elkuldve(t.db, { planId: plan.id })), 'NEM_KULDHETO');
  assert.equal((await elso(t.db, 'SELECT status FROM treatment_plan')).status, 'draft');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'plan.sent'"), 0);
});

test('PLAN allapotgep: missing -> draft -> therapist_final -> generated_pdf -> sent; a szerkesztes final utan visszavisz draftra', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezeles(t);
  assert.equal(await hibaKod(() => pl.ment(t.db, { planId: plan.id, mezok: TERV(), staffId: t.staff.recepcio })), 'TILTOTT');   // a recepcio nem szerkeszt
  await pl.ment(t.db, { planId: plan.id, mezok: TERV(), staffId: t.staff.terapeuta });
  assert.equal((await pl.terv(t.db, plan.id)).status, 'draft');
  assert.equal(await hibaKod(() => pl.pdfRogzit(t.db, { planId: plan.id, bajtok: new Uint8Array([1]), tarolo: t.tarolo })), 'NEM_VEGLEGES');
  await pl.veglegesit(t.db, { planId: plan.id, staffId: t.staff.terapeuta, now: BASE + 8 * NAP });
  let p = await pl.terv(t.db, plan.id);
  assert.deepEqual([p.status, p.approved_by, p.final_at], ['therapist_final', t.staff.terapeuta, BASE + 8 * NAP]);
  assert.equal((await pl.kuldhetoE(t.db, plan.id)).ok, true);
  // szerkesztes final utan -> draft, version++
  await pl.ment(t.db, { planId: plan.id, mezok: { cel: 'Modositott cel' }, staffId: t.staff.terapeuta });
  p = await pl.terv(t.db, plan.id);
  assert.deepEqual([p.status, p.version, p.approved_by], ['draft', 2, null]);
  await pl.veglegesit(t.db, { planId: plan.id, staffId: t.staff.terapeuta });
  // PDF
  const pdf = new TextEncoder().encode('%PDF-1.4 teszt');
  const r = await pl.pdfRogzit(t.db, { planId: plan.id, bajtok: pdf, tarolo: t.tarolo, staffId: t.staff.terapeuta });
  assert.equal((await pl.terv(t.db, plan.id)).status, 'generated_pdf');
  assert.equal((await t.tarolo.get(r.pdfFileId)).mime, 'application/pdf');
  assert.equal(await hibaKod(() => pl.pdfOlvas(t.db, { planId: plan.id, staffId: t.staff.recepcio, tarolo: t.tarolo })), 'TILTOTT');
  assert.equal((await pl.pdfOlvas(t.db, { planId: plan.id, staffId: t.staff.terapeuta, tarolo: t.tarolo })).mime, 'application/pdf');
  // kuldes: cimzett-ellenorzes
  assert.equal((await pl.kuldhetoE(t.db, plan.id, { cimzett: 'masvalaki@example.com' })).hianyok.includes('CIMZETT:nem_egyezik_a_nyilvantartottal'), true);
  await t.db.prepare('UPDATE guest SET email_verified = 0').run();
  assert.equal((await pl.kuldhetoE(t.db, plan.id)).hianyok.includes('CIMZETT:email_nem_ellenorzott'), true);
  await t.db.prepare('UPDATE guest SET email_verified = 1').run();
  const sent = await pl.elkuldve(t.db, { planId: plan.id, cimzett: VENDEG_A.email.toUpperCase(), now: BASE + 9 * NAP });
  assert.equal(sent.mar, false);
  p = await pl.terv(t.db, plan.id);
  assert.deepEqual([p.status, p.recipient_email, p.sent_at], ['sent', VENDEG_A.email, BASE + 9 * NAP]);
  assert.equal(await hibaKod(() => pl.ment(t.db, { planId: plan.id, mezok: { cel: 'x' }, staffId: t.staff.terapeuta })), 'MAR_ELKULDVE');
  assert.equal((await pl.elkuldve(t.db, { planId: plan.id })).mar, true);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'plan.sent'"), 1);
});

test('PLAN az 1. alkalom A5-hez a kezdo kep (fotokontroll) is kell; a kuldeshez nem eleg a veglegesites', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezeles(t, { kep: false });
  await pl.ment(t.db, { planId: plan.id, mezok: TERV(), staffId: t.staff.terapeuta });
  await pl.veglegesit(t.db, { planId: plan.id, staffId: t.staff.terapeuta });
  const k = await pl.kuldhetoE(t.db, plan.id);
  assert.equal(k.ok, false);
  assert.deepEqual(k.hianyok, ['KEP:alkalom_kepe_hianyzik']);
});

test('PLAN kotelezo mezok (1151-1165): a 2-3 mondatos javaslat, termek+hasznalat, ajanlott terv, kovetkezo idopont', () => {
  assert.deepEqual(pl.mezoHibak('plan', TERV()), []);
  assert.ok(pl.mezoHibak('plan', { ...TERV(), kezeloi_javaslat: 'Csak egy mondat.' }).includes('kezeloi_javaslat_2_3_mondat'));
  assert.ok(pl.mezoHibak('plan', { ...TERV(), kezeloi_javaslat: 'Egy. Ketto. Harom. Negy.' }).includes('kezeloi_javaslat_2_3_mondat'));
  assert.ok(pl.mezoHibak('plan', { ...TERV(), otthoni_apolas: { termek: 'x' } }).includes('otthoni_apolas'));
  assert.ok(pl.mezoHibak('plan', { ...TERV(), teljes_kura_11: false }).includes('ajanlott_terv'));
  assert.deepEqual(pl.mezoHibak('plan', { ...TERV(), teljes_kura_11: false, egyeni_terv_indok: 'szakmai eltérés: 6 alkalom' }), []);
  assert.ok(pl.mezoHibak('plan', { ...TERV(), kovetkezo_idopont: {} }).includes('kovetkezo_idopont'));
  assert.ok(pl.mezoHibak('review', { ertekeles: 'Egy. Ketto.' }).includes('otthoni_rutin_kontroll'));
  assert.ok(pl.mezoHibak('closing', {}).includes('fenntartasi_javaslat'));
});

test('C08 hianyzo dokumentacio: +24h kezeloi riasztas, +48h Janka eszkalacio (idempotens); veglegesites utan megszunik; hianyosan nem megy ki', async () => {
  const t = await ujTeszt();
  const { plan, s } = await elsoKezeles(t);
  const T = s.confirmed_at;
  assert.equal((await pl.hianyzoDokumentumok(t.db, { now: T + 24 * 3600 - 1 })).length, 0);
  assert.equal((await pl.dokumentumRiasztasok(t.db, { now: T + 24 * 3600 - 1 })).length, 0);
  const h24 = await pl.hianyzoDokumentumok(t.db, { now: T + 24 * 3600 });
  assert.deepEqual(h24.map((x) => x.level), ['DOC24']);
  await pl.dokumentumRiasztasok(t.db, { now: T + 24 * 3600 });
  await pl.dokumentumRiasztasok(t.db, { now: T + 25 * 3600 });   // ismetles: nincs duplikalt riasztas
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'alert.doc24'"), 1);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'alert.doc48'"), 0);
  assert.equal(JSON.parse((await elso(t.db, "SELECT payload FROM outbox_event WHERE event_type = 'alert.doc24'")).payload).therapist_id, t.staff.terapeuta);
  const h48 = await pl.dokumentumRiasztasok(t.db, { now: T + 48 * 3600 });
  assert.equal(h48[0].level, 'DOC48');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'alert.doc48'"), 1);
  await pl.dokumentumRiasztasok(t.db, { now: T + 60 * 3600 });
  assert.equal(await szamol(t.db, 'outbox_event', "event_type IN ('alert.doc24', 'alert.doc48')"), 2);
  // a hiany alatt a szemelyes dokumentum nem kuldheto
  assert.equal((await pl.kuldhetoE(t.db, plan.id)).ok, false);
  // veglegesites utan nincs tobb hiany
  await pl.ment(t.db, { planId: plan.id, mezok: TERV(), staffId: t.staff.terapeuta });
  await pl.veglegesit(t.db, { planId: plan.id, staffId: t.staff.terapeuta });
  assert.equal((await pl.hianyzoDokumentumok(t.db, { now: T + 72 * 3600 })).length, 0);
});

test('PLAN kezeloi jegyzet: a kameras ertekeles 2-3 mondat; szokatlan reakcio szakmai stopot ker; recepcio nem irhat', async () => {
  const t = await ujTeszt();
  const { s } = await elsoKezeles(t);
  assert.equal(await hibaKod(() => pl.jegyzet(t.db, { sessionId: s.id, staffId: t.staff.recepcio, szoveg: 'x. y.' })), 'TILTOTT');
  assert.equal(await hibaKod(() => pl.jegyzet(t.db, { sessionId: s.id, staffId: t.staff.terapeuta, tipus: 'camera_review', szoveg: 'Csak egy.', veglegesit: true })), 'MONDATSZAM');
  await pl.jegyzet(t.db, { sessionId: s.id, staffId: t.staff.terapeuta, tipus: 'camera_review', szoveg: 'Latszik a ritkulas. A fejbor nyugodt.', veglegesit: true });
  await pl.jegyzet(t.db, { sessionId: s.id, staffId: t.staff.terapeuta, tipus: 'adverse_reaction', szoveg: 'Piros folt a kezeles utan.' });
  assert.equal((await elso(t.db, 'SELECT clinical_stop FROM guest')).clinical_stop, 'adverse_reaction');
  assert.equal((await elso(t.db, 'SELECT status FROM course')).status, 'paused_clinical');
  assert.equal((await pl.jegyzetek(t.db, s.id)).length, 2);
});
