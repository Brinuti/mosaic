import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, szamol, elso, mind, sessionok, jpegBajtok, BASE, NAP, VENDEG_A } from './fixtures.js';
import { igazolCompleted } from '../lib/booking.js';
import { kuraAllapot, szuneteltet, folytat, kuraKorrekcio, kameraKotelezo } from '../lib/course.js';
import { kepFeltolt } from '../lib/images.js';
import { kurazaro } from '../lib/plan.js';

test('C01 elso completed: a kezelo megerositi, treatment_index = 1, a kura egyszer nyilik, plan(missing) + Google-keres sor', async () => {
  const t = await ujTeszt();
  const r = await foglal(t, { service: 'first_hair' });
  assert.equal((await elso(t.db, 'SELECT status, treatment_index FROM course')).status, 'not_started');
  const c = await igazolCompleted(t.db, { bookingId: r.bookingId, staffId: t.staff.terapeuta, now: BASE + 8 * NAP });
  assert.equal(c.treatmentIndex, 1);
  const k = await mind(t.db, 'SELECT * FROM course');
  assert.equal(k.length, 1);
  assert.equal(k[0].status, 'active');
  assert.equal(k[0].treatment_index, 1);
  assert.equal(k[0].started_at, BASE + 8 * NAP);
  const p = await elso(t.db, 'SELECT kind, status, due_at FROM treatment_plan');
  assert.deepEqual([p.kind, p.status, p.due_at], ['plan', 'missing', BASE + 9 * NAP]);   // +24h
  assert.equal(await szamol(t.db, 'review_request'), 1);
  assert.equal((await elso(t.db, 'SELECT confirmed_by, therapist_id FROM treatment_session')).confirmed_by, t.staff.terapeuta);
  // ismetelt igazolas nem noveli
  assert.equal((await igazolCompleted(t.db, { bookingId: r.bookingId, staffId: t.staff.terapeuta })).mar, true);
  assert.equal((await elso(t.db, 'SELECT treatment_index FROM course')).treatment_index, 1);
});

test('C02 kamera-felmeres completed: NEM kezeles-alkalom, a treatment_index nem no, nincs session', async () => {
  const t = await ujTeszt();
  const cam = await foglal(t, { service: 'camera_assessment', start: BASE + NAP });
  const c = await igazolCompleted(t.db, { bookingId: cam.bookingId, staffId: t.staff.terapeuta, now: BASE + NAP + 1800 });
  assert.equal(c.kezelesAlkalom, false);
  assert.equal(await szamol(t.db, 'treatment_session'), 0);
  assert.equal((await kuraAllapot(t.db, cam.guestId)).treatmentIndex, 0);
  // a kamera utan az elso kezeles tovabbra is az 1. alkalom
  const f = await kezelesek(t, { n: 1, kezdet: BASE + 5 * NAP });
  assert.equal(f[0].treatmentIndex, 1);
});

test('C04 kamera-felvetel kotelezo CSAK az 1/3/5/10. alkalomnal; first_hair = 1, followup = 2..11', async () => {
  const t = await ujTeszt();
  const k = await kezelesek(t, { n: 11 });
  assert.deepEqual(k.map((x) => x.treatmentIndex), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(k.filter((x) => x.cameraRequired).map((x) => x.treatmentIndex), [1, 3, 5, 10]);
  assert.deepEqual((await sessionok(t.db, k[0].guestId)).filter((s) => s.camera_required).map((s) => s.treatment_index), [1, 3, 5, 10]);
  assert.equal(kameraKotelezo(2), false);
  assert.equal(kameraKotelezo(11), false);
});

test('C05 2. kezeles: nincs kotelezo uj kamerakep (a kep felvetele sem engedett), nincs kamera-dokumentum', async () => {
  const t = await ujTeszt();
  const k = await kezelesek(t, { n: 2 });
  assert.equal(k[1].cameraRequired, false);
  assert.equal(k[1].dokumentum, null);
  assert.equal(await szamol(t.db, 'treatment_plan', "kind <> 'plan'"), 0);
  const s2 = await elso(t.db, 'SELECT id FROM treatment_session WHERE treatment_index = 2');
  assert.equal(await hibaKod(() => kepFeltolt(t.db, { sessionId: s2.id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo })), 'NEM_KAMERA_ALKALOM');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.completed' AND payload LIKE '%\"camera_required\":true%'"), 1);   // csak az 1. alkalom
});

test('C06 11. kezeles: a kura completed_11, zaro A5 dokumentum jon letre, a zarashoz uj kamerakep NEM kell, hivatkozas az 1/3/5/10 kepekre', async () => {
  const t = await ujTeszt();
  const k = await kezelesek(t, { n: 10 });
  const ss = await sessionok(t.db, k[0].guestId);
  for (const idx of [1, 3, 5, 10]) {
    const s = ss.find((x) => x.treatment_index === idx);
    await kepFeltolt(t.db, { sessionId: s.id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo });
  }
  const f = await foglal(t, { service: 'followup_hair', start: BASE + 140 * NAP, now: BASE + 130 * NAP, bookedAt: BASE + 130 * NAP });
  const c11 = await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta, now: BASE + 140 * NAP });
  assert.equal(c11.treatmentIndex, 11);
  assert.equal(c11.cameraRequired, false);
  assert.equal(c11.dokumentum, 'closing');
  const kura = await elso(t.db, 'SELECT * FROM course');
  assert.equal(kura.status, 'completed_11');
  assert.equal(kura.completed_at, BASE + 140 * NAP);
  const z = await kurazaro(t.db, { courseId: kura.id });
  assert.equal(z.kesz, true);
  assert.equal(z.ujKameraKotelezo, false);
  assert.deepEqual(z.hianyzoKepek, []);
  assert.deepEqual(Object.keys(z.referenciak).map(Number), [1, 3, 5, 10]);
  assert.equal(z.zaroDokumentum.status, 'missing');
  // a 12. nem igazolhato; uj elso kezeles uj kurat nyit
  const f12 = await foglal(t, { service: 'followup_hair', start: BASE + 150 * NAP, now: BASE + 141 * NAP, bookedAt: BASE + 141 * NAP });
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: f12.bookingId, staffId: t.staff.terapeuta })), 'ELSO_KEZELES_HIANYZIK');   // uj (nem kezdett) kura
});

test('C01 sorszam-szabalyok: folytato az elso nelkul nem igazolhato; masodik first_hair ugyanabban a kurában nem', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, { service: 'followup_hair' });
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta })), 'ELSO_KEZELES_HIANYZIK');
  assert.equal((await elso(t.db, 'SELECT status FROM booking WHERE id = ?1', f.bookingId)).status, 'booked');   // semmi nem valtozott
  const kk = await mind(t.db, 'SELECT id FROM course');
  await kuraKorrekcio(t.db, { courseId: kk[0].id, ujIndex: 4, staffId: t.staff.janka, ok: 'korabbi rendszerbol atvezetve' });
  const c = await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta });
  assert.equal(c.treatmentIndex, 5);
  const g = await foglal(t, { service: 'first_hair', start: BASE + 30 * NAP });
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: g.bookingId, staffId: t.staff.terapeuta })), 'ELSO_KEZELES_MAR_MEGVAN');
});

test('COURSE szakmai szuneteltetes: paused_clinical alatt nincs igazolas; folytatas; recepcio nem szuneteltethet', async () => {
  const t = await ujTeszt();
  const k = await kezelesek(t, { n: 2 });
  const kura = await elso(t.db, 'SELECT id FROM course');
  assert.equal(await hibaKod(() => szuneteltet(t.db, { courseId: kura.id, staffId: t.staff.recepcio, ok: 'x' })), 'TILTOTT');
  await szuneteltet(t.db, { courseId: kura.id, staffId: t.staff.terapeuta, ok: 'szakmai megfontolas' });
  const f = await foglal(t, { service: 'followup_hair', start: BASE + 60 * NAP });
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta })), 'KURA_SZUNETEL');
  assert.equal((await kuraAllapot(t.db, k[0].guestId)).kuraAjanlhato, false);
  await folytat(t.db, { courseId: kura.id, staffId: t.staff.terapeuta, ok: 'rendben' });
  assert.equal((await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta })).treatmentIndex, 3);
});
