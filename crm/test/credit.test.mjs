import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, hibaKod, szamol, elso, mind, BASE, NAP, VENDEG_A } from './fixtures.js';
import { igazolCompleted } from '../lib/booking.js';
import * as cr from '../lib/credit.js';
import { naptariNapVege } from '../lib/db.js';

async function felmeres(t, { vendeg = VENDEG_A, start = BASE } = {}) {
  const cam = await foglal(t, { service: 'camera_assessment', vendeg, start, bookedAt: start - NAP, now: start - NAP });
  const c = await igazolCompleted(t.db, { bookingId: cam.bookingId, staffId: t.staff.terapeuta, now: start + 1800 });
  return { cam, creditId: c.creditId, guestId: cam.guestId };
}
const elsoFogl = (t, { vendeg = VENDEG_A, start, bookedAt, externalId } = {}) => foglal(t, { service: 'first_hair', vendeg, start, bookedAt, now: bookedAt, externalId });

test('P06 a 4 990 Ft levonast EGY munkatars jeloli kezzel (used_at, booking UUID, staff), audit; ketszer SOHA (DB-szinten sem)', async () => {
  const t = await ujTeszt();
  const { creditId, guestId } = await felmeres(t);
  assert.equal((await elso(t.db, 'SELECT amount_huf, status FROM assessment_credit')).amount_huf, 4990);
  const f = await elsoFogl(t, { start: BASE + 20 * NAP, bookedAt: BASE + 3 * NAP });
  const [info] = await cr.ellenoriz(t.db, guestId, { now: BASE + 4 * NAP });
  assert.equal(info.jogosult, true);
  assert.equal(info.fizetendoAzElsoKezelesre, 24910);   // 29 900 - 4 990, csak a jogosult vendegre
  assert.equal(await hibaKod(() => cr.jelolLevonas(t.db, { creditId, bookingId: f.bookingId, staffId: t.staff.marketing })), 'TILTOTT');
  const r = await cr.jelolLevonas(t.db, { creditId, bookingId: f.bookingId, staffId: t.staff.recepcio, now: BASE + 20 * NAP });
  assert.deepEqual([r.levonas, r.fizetendo], [4990, 24910]);
  const c = await elso(t.db, 'SELECT * FROM assessment_credit');
  assert.deepEqual([c.status, c.used_at, c.used_booking_uuid, c.used_by_staff_id], ['used', BASE + 20 * NAP, f.bookingId, t.staff.recepcio]);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'credit.use' AND staff_id = ?1", t.staff.recepcio), 1);
  // alkalmazas-szinten ketszer: nem
  assert.equal(await hibaKod(() => cr.jelolLevonas(t.db, { creditId, bookingId: f.bookingId, staffId: t.staff.terapeuta })), 'CREDIT_MAR_FELHASZNALVA');
  // DB-szinten: a felhasznalt sor nem modosithato, nem torolheto, masik foglalasra nem atirhato
  await assert.rejects(t.db.prepare('UPDATE assessment_credit SET used_at = NULL, status = \'eligible\' WHERE id = ?1').bind(creditId).run(), /credit_immutable|CHECK/);
  await assert.rejects(t.db.prepare('UPDATE assessment_credit SET used_by_staff_id = ?2 WHERE id = ?1').bind(creditId, t.staff.janka).run(), /credit_immutable/);
  await assert.rejects(t.db.prepare('DELETE FROM assessment_credit WHERE id = ?1').bind(creditId).run(), /credit_immutable/);
  assert.equal((await cr.ellenoriz(t.db, guestId))[0].allapot, 'used');
});

test('P06 DB-szintu single-use: nem jogosult (open) creditre nem johet used_at; egy foglalas csak egy creditet vonhat le', async () => {
  const t = await ujTeszt();
  const { creditId } = await felmeres(t);
  const f = await elsoFogl(t, { start: BASE + 20 * NAP, bookedAt: BASE + 100 * NAP });   // az ablakon kivul -> a credit open marad
  await assert.rejects(t.db.prepare('UPDATE assessment_credit SET status = \'used\', used_at = 1, used_booking_uuid = ?2, used_by_staff_id = ?3 WHERE id = ?1').bind(creditId, f.bookingId, t.staff.recepcio).run(), /credit_not_eligible/);
  assert.equal(await hibaKod(() => cr.jelolLevonas(t.db, { creditId, bookingId: f.bookingId, staffId: t.staff.recepcio })), 'NEM_JOGOSULT');
});

test('P07 elegendo a 30 naptari napon belul FOGLALNI az elso kezelest; a kezeles ideje lehet jovoben; az ablak utan nem jogosit', async () => {
  const t = await ujTeszt();
  const { guestId } = await felmeres(t);
  const veg = naptariNapVege(BASE, 30);
  // az ablak utolso masodpercben letrejott foglalas, a kezeles 3 honap mulva
  const f = await elsoFogl(t, { start: BASE + 90 * NAP, bookedAt: veg - 5 });
  assert.equal((await cr.ellenoriz(t.db, guestId, { now: veg }))[0].allapot, 'eligible');
  assert.equal((await elso(t.db, 'SELECT first_booking_id FROM assessment_credit')).first_booking_id, f.bookingId);
  // masik vendeg: az ablak utan
  const t2 = await ujTeszt();
  const x = await felmeres(t2);
  await elsoFogl(t2, { start: BASE + 90 * NAP, bookedAt: veg + 5 });
  const [i2] = await cr.ellenoriz(t2.db, x.guestId, { now: veg + 10 });
  assert.equal(i2.allapot, 'expired');
  assert.equal(i2.jogosult, false);
  assert.equal(i2.fizetendoAzElsoKezelesre, 29900);   // az altalanos ar nem valtozik
});

test('P07 a kamera-felmeres idopontjaban / a kezeloi igazolas elott keszult first foglalas is jogosit (ugyanazon a napon)', async () => {
  const t = await ujTeszt();
  const cam = await foglal(t, { service: 'camera_assessment', start: BASE, bookedAt: BASE - NAP, now: BASE - NAP });
  const f = await elsoFogl(t, { start: BASE + 14 * NAP, bookedAt: BASE + 600 });   // a felmeres alatt, meg az igazolas elott
  const c = await igazolCompleted(t.db, { bookingId: cam.bookingId, staffId: t.staff.terapeuta, now: BASE + 1800 });
  assert.equal((await elso(t.db, 'SELECT status, first_booking_id FROM assessment_credit WHERE id = ?1', c.creditId)).first_booking_id, f.bookingId);
});

test('P08 athelyezes megtartja a jogosultsagot, a teljes lemondas megszunteti', async () => {
  const t = await ujTeszt();
  const { guestId, creditId } = await felmeres(t);
  const f = await elsoFogl(t, { start: BASE + 20 * NAP, bookedAt: BASE + 2 * NAP, externalId: 'cr-1' });
  assert.equal((await cr.ellenoriz(t.db, guestId))[0].jogosult, true);
  await foglal(t, { externalId: 'cr-1', service: 'first_hair', start: BASE + 25 * NAP, status: 'rescheduled', now: BASE + 3 * NAP });
  assert.equal((await cr.ellenoriz(t.db, guestId, { now: BASE + 4 * NAP }))[0].jogosult, true);
  assert.equal((await elso(t.db, 'SELECT first_booking_id FROM assessment_credit')).first_booking_id, f.bookingId);
  await foglal(t, { externalId: 'cr-1', service: 'first_hair', start: BASE + 25 * NAP, status: 'cancelled', now: BASE + 5 * NAP });
  const [lemondas] = await cr.ellenoriz(t.db, guestId, { now: BASE + 6 * NAP });
  assert.equal(lemondas.jogosult, false);
  assert.equal(lemondas.firstBookingId, null);
  assert.equal(await hibaKod(() => cr.jelolLevonas(t.db, { creditId, bookingId: f.bookingId, staffId: t.staff.recepcio })), 'NEM_JOGOSULT');
  // uj foglalas az ablakban ujra jogosit (constants.CREDIT.UJRA_JOGOSULT_LEMONDAS_UTAN)
  const g = await elsoFogl(t, { start: BASE + 30 * NAP, bookedAt: BASE + 7 * NAP });
  assert.equal((await cr.ellenoriz(t.db, guestId, { now: BASE + 8 * NAP }))[0].firstBookingId, g.bookingId);
});

test('P08 a mar levont credit foglalasanak lemondasa: kezi felulvizsgalati riasztas, a levonas sora nem valtozik', async () => {
  const t = await ujTeszt();
  const { creditId } = await felmeres(t);
  const f = await elsoFogl(t, { start: BASE + 20 * NAP, bookedAt: BASE + 2 * NAP, externalId: 'cr-2' });
  await cr.jelolLevonas(t.db, { creditId, bookingId: f.bookingId, staffId: t.staff.recepcio, now: BASE + 3 * NAP });
  await foglal(t, { externalId: 'cr-2', service: 'first_hair', start: BASE + 20 * NAP, status: 'cancelled', now: BASE + 4 * NAP });
  assert.equal((await elso(t.db, 'SELECT status FROM assessment_credit')).status, 'used');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'credit.used_booking_cancelled'"), 1);
});
