import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, szamol, elso, mind, BASE, NAP, FIOK_2, VENDEG_A, VENDEG_B } from './fixtures.js';
import { jovahagy, elutasit, visszafordit, fuggoDarab, fuggoKeresek } from '../lib/merge.js';
import { vendegAzonosit, emailValtoztat, vegleges } from '../lib/guest.js';
import { rogzit } from '../lib/consent.js';

test('B11 ket fiok: ugyanaz az ELLENORZOTT e-mail ES telefon -> automatikus, naplozott osszefuzes (egy vendeg, ket identity)', async () => {
  const t = await ujTeszt({ masodikFiok: true });
  const a = await foglal(t, { vendeg: VENDEG_A, guestExternalId: 'sal-1' });
  // masik fiok, mas formatumu telefon + nagybetus e-mail ugyanarra a szemelyre
  const b = await foglal(t, { account: FIOK_2, start: BASE + 8 * NAP, vendeg: { nev: 'Teszt Anna', email: 'ANNA.TESZT@example.com', telefon: '06301112222' }, guestExternalId: 'sal-77' });
  assert.equal(a.guestId, b.guestId);
  assert.equal(b.identity, 'auto_osszefuzes');
  assert.equal(await szamol(t.db, 'guest'), 1);
  assert.equal(await szamol(t.db, 'salonic_guest_identity', 'guest_id = ?1', a.guestId), 2);
  assert.equal(await szamol(t.db, 'identity_merge_request'), 0);
  assert.equal(await szamol(t.db, 'merge_audit', "kind = 'auto_link'"), 1);
  // egy vendeg, ket foglalas ket fiokbol; nincs keveredes masik vendeggel
  const c = await foglal(t, { account: FIOK_2, vendeg: VENDEG_B, guestExternalId: 'sal-90' });
  assert.notEqual(c.guestId, a.guestId);
  assert.equal(await szamol(t.db, 'booking', 'guest_id = ?1', a.guestId), 2);
  // ismert (fiok, kulso azonosito) ujra -> ugyanaz
  const d = await foglal(t, { account: FIOK_2, vendeg: VENDEG_B, guestExternalId: 'sal-90' });
  assert.equal(d.guestId, c.guestId);
});

test('B11 ugyanaz a foglalas 2 fiokbol sem duplikalodik (ugyanaz a vendeg + szolgaltatas + idopont)', async () => {
  const t = await ujTeszt({ masodikFiok: true });
  const a = await foglal(t, { vendeg: VENDEG_A, externalId: 'p-1' });
  const b = await foglal(t, { account: FIOK_2, vendeg: VENDEG_A, externalId: 'q-9' });
  assert.equal(b.valtozas, 'duplikalt');
  assert.equal(b.bookingId, a.bookingId);
  assert.equal(await szamol(t.db, 'booking'), 1);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.confirmed'"), 1);
});

test('B11 a nev szerinti egyezes SOHA nem von ossze: ugyanaz a nev, mas e-mail / telefon -> kulon vendeg, nincs keres', async () => {
  const t = await ujTeszt();
  const a = await foglal(t, { vendeg: VENDEG_A });
  const b = await foglal(t, { vendeg: { nev: VENDEG_A.nev, email: 'masik@example.com', telefon: '+36 70 999 8888' } });
  assert.notEqual(a.guestId, b.guestId);
  assert.equal(await szamol(t.db, 'identity_merge_request'), 0);
});

test('B12 bizonytalan egyezes (csak e-mail VAGY csak telefon): kezi jovahagyas kell, naplozva; recepcio nem hagyhatja jova', async () => {
  const t = await ujTeszt({ masodikFiok: true });
  const a = await foglal(t, { vendeg: VENDEG_A });
  const b = await foglal(t, { account: FIOK_2, vendeg: { nev: 'Anna T.', email: VENDEG_A.email, telefon: '+36 20 555 6666' } });   // csak az e-mail egyezik
  assert.notEqual(a.guestId, b.guestId);
  assert.equal(b.mergeRequestIds.length, 1);
  assert.equal(await fuggoDarab(t.db), 1);
  const [kereses] = await fuggoKeresek(t.db);
  assert.equal(kereses.email_match, 1);
  assert.equal(kereses.phone_match, 0);
  // jovahagyas nelkul nincs osszevonas
  assert.equal((await elso(t.db, 'SELECT status FROM guest WHERE id = ?1', b.guestId)).status, 'active');
  assert.equal(await hibaKod(() => jovahagy(t.db, { requestId: b.mergeRequestIds[0], staffId: t.staff.recepcio })), 'TILTOTT');
  assert.equal(await hibaKod(() => jovahagy(t.db, { requestId: b.mergeRequestIds[0], staffId: t.staff.marketing })), 'TILTOTT');
  const e = await jovahagy(t.db, { requestId: b.mergeRequestIds[0], staffId: t.staff.terapeuta, megjegyzes: 'ugyanaz a vendeg' });
  assert.equal(await vegleges(t.db, b.guestId), a.guestId);
  assert.equal((await elso(t.db, 'SELECT status, merged_into FROM guest WHERE id = ?1', b.guestId)).merged_into, a.guestId);
  assert.equal(await szamol(t.db, 'booking', 'guest_id = ?1', a.guestId), 2);
  assert.equal(await szamol(t.db, 'salonic_guest_identity', 'guest_id = ?1', a.guestId), 2);   // az eredeti azonositok megmaradtak
  assert.equal(await szamol(t.db, 'merge_audit', "kind = 'manual_merge' AND staff_id = ?1", t.staff.terapeuta), 1);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'guest.merge'"), 1);
  assert.ok(e.athelyezett.booking.length === 1);
  assert.equal(await fuggoDarab(t.db), 0);
  // a merged vendeg uj foglalasa mar a vegleges vendeghez kerul
  const c = await foglal(t, { account: FIOK_2, start: BASE + 9 * NAP, vendeg: { nev: 'Anna T.', email: VENDEG_A.email, telefon: '+36 20 555 6666' }, guestExternalId: 'ujabb-azonosito' });
  assert.equal(c.guestId, a.guestId);
});

test('B12 elutasitas es visszaforditas: az osszevonas visszaallithato, egyszer; a sorok visszakerulnek', async () => {
  const t = await ujTeszt({ masodikFiok: true });
  const a = await foglal(t, { vendeg: VENDEG_A });
  const b = await foglal(t, { account: FIOK_2, vendeg: { nev: 'Anna T.', email: VENDEG_A.email, telefon: '+36 20 555 6666' } });
  await rogzit(t.db, { guestId: b.guestId, csatorna: 'email_marketing', szovegVerzio: 'v1' });
  const e = await jovahagy(t.db, { requestId: b.mergeRequestIds[0], staffId: t.staff.terapeuta });
  assert.equal(await szamol(t.db, 'consent_event', 'guest_id = ?1', a.guestId), 1);
  assert.equal(await hibaKod(() => visszafordit(t.db, { mergeAuditId: e.mergeAuditId, staffId: t.staff.recepcio })), 'TILTOTT');
  await visszafordit(t.db, { mergeAuditId: e.mergeAuditId, staffId: t.staff.janka, ok: 'tevedes' });
  assert.equal((await elso(t.db, 'SELECT status FROM guest WHERE id = ?1', b.guestId)).status, 'active');
  assert.equal(await szamol(t.db, 'booking', 'guest_id = ?1', b.guestId), 1);
  assert.equal(await szamol(t.db, 'consent_event', 'guest_id = ?1', b.guestId), 1);
  assert.equal(await szamol(t.db, 'merge_audit', "kind = 'revert'"), 1);
  assert.equal(await hibaKod(() => visszafordit(t.db, { mergeAuditId: e.mergeAuditId, staffId: t.staff.janka })), 'MAR_VISSZAFORDITVA');
  // elutasitas
  const c = await foglal(t, { guestExternalId: 'z-3', vendeg: { nev: 'Harmadik', email: VENDEG_A.email, telefon: '+36 50 123 0000' } });
  assert.equal(c.mergeRequestIds.length, 2);   // mindket meglevo vendeg (A es a visszaallitott B) e-mail-egyezo jelolt
  await elutasit(t.db, { requestId: c.mergeRequestIds[0], staffId: t.staff.terapeuta, megjegyzes: 'nem ugyanaz' });
  assert.equal((await elso(t.db, 'SELECT status FROM identity_merge_request WHERE id = ?1', c.mergeRequestIds[0])).status, 'rejected');
});

test('B12 ket kezdett kura nem vonhato ossze (kezi rendezes kell)', async () => {
  const t = await ujTeszt({ masodikFiok: true });
  const k1 = await kezelesek(t, { vendeg: VENDEG_A, n: 1 });
  const k2 = await kezelesek(t, { account: FIOK_2, vendeg: { nev: 'Anna T.', email: VENDEG_A.email, telefon: '+36 20 555 6666' }, n: 1, kezdet: BASE + 60 * NAP });
  const [kereses] = await fuggoKeresek(t.db);
  assert.equal(await hibaKod(() => jovahagy(t.db, { requestId: kereses.id, staffId: t.staff.terapeuta })), 'MERGE_KURA_KONFLIKTUS');
  assert.notEqual(k1[0].guestId, k2[0].guestId);
});

test('B11 telefon-formatum egyezes: 06.., +36.., szokozos -> ugyanaz; e-mail-valtoztatas ellenorizetlenne teszi az uj cimet', async () => {
  const t = await ujTeszt();
  const a = await vendegAzonosit(t.db, { externalGuestId: 'x1', nev: 'A', email: 'a@b.hu', telefon: '06 30 111 2222', now: BASE });
  const b = await vendegAzonosit(t.db, { externalGuestId: 'x2', nev: 'A', email: 'A@B.hu', telefon: '+36301112222', now: BASE });
  assert.equal(a.guestId, b.guestId);
  await emailValtoztat(t.db, { guestId: a.guestId, ujEmail: 'uj@b.hu', staffId: t.staff.recepcio });
  const g = await elso(t.db, 'SELECT email, email_verified FROM guest WHERE id = ?1', a.guestId);
  assert.deepEqual([g.email, g.email_verified], ['uj@b.hu', 0]);
  assert.equal(await hibaKod(() => emailValtoztat(t.db, { guestId: a.guestId, ujEmail: 'x@y.hu', staffId: t.staff.marketing })), 'TILTOTT');
});
