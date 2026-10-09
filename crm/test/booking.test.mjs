import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, szamol, elso, mind, BASE, NAP, VENDEG_A, VENDEG_B } from './fixtures.js';
import { ingestBookingEvent, igazolCompleted, esemenyek, foglalas } from '../lib/booking.js';

test('B07 dupla kuldes (double submit): egy foglalas, egy confirmed outbox-esemeny', async () => {
  const t = await ujTeszt();
  const [a, b] = await Promise.all([foglal(t, { externalId: 'dup-1' }), foglal(t, { externalId: 'dup-1' })]);
  assert.equal(await szamol(t.db, 'booking', "external_id = 'dup-1'"), 1);
  assert.deepEqual([a.valtozas, b.valtozas].sort(), ['duplikalt', 'uj']);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.confirmed'"), 1);
  const c = await foglal(t, { externalId: 'dup-1' });   // harmadik, soros ismetles
  assert.equal(c.valtozas, 'duplikalt');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.confirmed'"), 1);
});

test('B09 athelyezes NEM lemondas: uj idopont, rescheduled allapot, uj outbox; lemondasnal cancelled', async () => {
  const t = await ujTeszt();
  const r = await foglal(t, { externalId: 'res-1', start: BASE + 7 * NAP });
  const m = await foglal(t, { externalId: 'res-1', start: BASE + 9 * NAP, status: 'rescheduled', now: BASE + 10 });
  assert.equal(m.valtozas, 'athelyezve');
  let b = await foglalas(t.db, r.bookingId);
  assert.equal(b.status, 'rescheduled');
  assert.equal(b.start_at, BASE + 9 * NAP);
  assert.equal(b.original_start_at, BASE + 7 * NAP);
  assert.equal(b.cancelled_at, null);
  const ox = await mind(t.db, "SELECT event_type, payload FROM outbox_event WHERE aggregate_id = ?1 ORDER BY created_at, rowid", r.bookingId);
  assert.ok(ox.some((o) => o.event_type === 'booking.rescheduled'));
  assert.ok(!ox.some((o) => o.event_type === 'booking.cancelled'));
  // ismetelt athelyezes-ertesito nem duplikal
  const m2 = await foglal(t, { externalId: 'res-1', start: BASE + 9 * NAP, status: 'rescheduled' });
  assert.equal(m2.valtozas, 'duplikalt');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.rescheduled'"), 1);
  // lemondas
  const l = await foglal(t, { externalId: 'res-1', start: BASE + 9 * NAP, status: 'cancelled', now: BASE + 20 });
  assert.equal(l.valtozas, 'lemondva');
  b = await foglalas(t.db, r.bookingId);
  assert.equal(b.status, 'cancelled');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.cancelled'"), 1);
  // lemondott foglalas nem "tamad fel"
  const x = await foglal(t, { externalId: 'res-1', start: BASE + 11 * NAP, status: 'booked', now: BASE + 30 });
  assert.equal(x.valtozas, 'kihagyva');
  assert.equal((await foglalas(t.db, r.bookingId)).status, 'cancelled');
});

test('BOOKING booking_event naplo: megorzott athelyezes / lemondas tortenet, idempotens', async () => {
  const t = await ujTeszt();
  const r = await foglal(t, { externalId: 'ev-1', now: BASE });
  await foglal(t, { externalId: 'ev-1', start: BASE + 8 * NAP, status: 'rescheduled', now: BASE + 5 });
  await foglal(t, { externalId: 'ev-1', status: 'cancelled', start: BASE + 8 * NAP, now: BASE + 9 });
  const ev = await esemenyek(t.db, r.bookingId);
  assert.deepEqual(ev.map((e) => e.type), ['booked', 'rescheduled', 'cancelled']);
  assert.equal(ev[1].old_start_at, BASE + 7 * NAP);
  assert.equal(ev[1].new_start_at, BASE + 8 * NAP);
});

test('BOOKING sorrendiseg: regebbi esemeny nem irja felul az ujabbat (stale)', async () => {
  const t = await ujTeszt();
  const r = await foglal(t, { externalId: 'so-1', eventAt: BASE });
  await foglal(t, { externalId: 'so-1', status: 'cancelled', eventAt: BASE + 100 });
  const regi = await foglal(t, { externalId: 'so-1', status: 'booked', start: BASE + 3 * NAP, eventAt: BASE + 50 });
  assert.equal(regi.valtozas, 'elavult');
  assert.equal((await foglalas(t.db, r.bookingId)).status, 'cancelled');
});

test('C03 no-show / lemondas: nem completed, nem kuraalkalom, nem berletlevonas, nem penz', async () => {
  const t = await ujTeszt();
  const k = await kezelesek(t, { n: 1 });
  const f2 = await foglal(t, { service: 'followup_hair', start: BASE + 20 * NAP, externalId: 'ns-1' });
  const f3 = await foglal(t, { service: 'followup_hair', start: BASE + 21 * NAP, externalId: 'ns-2' });
  await foglal(t, { externalId: 'ns-1', service: 'followup_hair', start: BASE + 20 * NAP, status: 'no_show', now: BASE + 21 * NAP });
  await foglal(t, { externalId: 'ns-2', service: 'followup_hair', start: BASE + 21 * NAP, status: 'cancelled', now: BASE + 5 * NAP });
  assert.equal((await foglalas(t.db, f2.bookingId)).status, 'no_show');
  assert.equal((await foglalas(t.db, f3.bookingId)).status, 'cancelled');
  assert.equal(await szamol(t.db, 'treatment_session'), 1);
  assert.equal((await elso(t.db, 'SELECT treatment_index FROM course')).treatment_index, 1);
  assert.equal(await szamol(t.db, 'package_redemption', "status = 'used'"), 0);
  // nem igazolhato completed-nek
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: f2.bookingId, staffId: t.staff.terapeuta })), 'NEM_IGAZOLHATO');
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: f3.bookingId, staffId: t.staff.terapeuta })), 'NEM_IGAZOLHATO');
  assert.ok(k.length === 1);
});

test('BOOKING a completed CSAK kezelo-igazolassal johet: Salonic "completed" jelzes, recepcio, ismeretlen munkatars elutasitva', async () => {
  const t = await ujTeszt();
  const r = await foglal(t, { externalId: 'cp-1' });
  const s = await ingestBookingEvent(t.db, { externalId: 'cp-1', service: 'first_hair', start: BASE + 7 * NAP, status: 'completed' });
  assert.equal(s.valtozas, 'kihagyva');
  assert.equal((await foglalas(t.db, r.bookingId)).status, 'booked');
  assert.equal(await szamol(t.db, 'booking_event', "type = 'salonic_attended_hint'"), 1);
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: r.bookingId, staffId: t.staff.recepcio })), 'TILTOTT');
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: r.bookingId, staffId: 'nincs-ilyen' })), 'TILTOTT');
  assert.equal(await szamol(t.db, 'security_audit', "result = 'denied' AND action = 'booking.confirm'"), 2);
  // DB-szinten sem allithato kezzel completed igazolo nelkul
  await assert.rejects(t.db.prepare("UPDATE booking SET status = 'completed' WHERE id = ?1").bind(r.bookingId).run(), /CHECK/);
});

test('BOOKING completed duplazodas ellen: parhuzamos igazolas egyszer noveli a sorszamot; a completed allapot vegleges', async () => {
  const t = await ujTeszt();
  const r = await foglal(t, { externalId: 'cd-1' });
  const ered = await Promise.all([
    igazolCompleted(t.db, { bookingId: r.bookingId, staffId: t.staff.terapeuta, now: BASE + 1 }),
    igazolCompleted(t.db, { bookingId: r.bookingId, staffId: t.staff.terapeuta2, now: BASE + 1 }),
    igazolCompleted(t.db, { bookingId: r.bookingId, staffId: t.staff.terapeuta, now: BASE + 2 }),
  ].map((p) => p.catch((e) => ({ hiba: e.kod }))));
  assert.equal(await szamol(t.db, 'treatment_session'), 1);
  assert.equal((await elso(t.db, 'SELECT treatment_index FROM course')).treatment_index, 1);
  assert.ok(ered.some((x) => x.mar === false), JSON.stringify(ered));
  const meg = await igazolCompleted(t.db, { bookingId: r.bookingId, staffId: t.staff.terapeuta });
  assert.equal(meg.mar, true);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.completed'"), 1);
  await assert.rejects(t.db.prepare("UPDATE booking SET status = 'booked' WHERE id = ?1").bind(r.bookingId).run(), /booking_terminal_state/);
});

test('BOOKING ismeretlen szolgaltatas es fiok elutasitva; masodik fiok csak felvett fiokkal mukodik', async () => {
  const t = await ujTeszt();
  assert.equal(await hibaKod(() => foglal(t, { service: 'valami' })), 'ISMERETLEN_SZOLGALTATAS');
  assert.equal(await hibaKod(() => foglal(t, { account: 'teszt-masodik-fiok' })), 'ISMERETLEN_FIOK');
});

test('BOOKING legacy_combo csak teljesitheto, nem kuraalkalom', async () => {
  const t = await ujTeszt();
  const r = await foglal(t, { service: 'legacy_combo_only' });
  const c = await igazolCompleted(t.db, { bookingId: r.bookingId, staffId: t.staff.terapeuta });
  assert.equal(c.kezelesAlkalom, false);
  assert.equal(await szamol(t.db, 'treatment_session'), 0);
});
