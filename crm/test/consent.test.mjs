import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, szamol, elso, mind, BASE, NAP, VENDEG_A } from './fixtures.js';
import * as cs from '../lib/consent.js';

test('B10 hozzajarulas nelkul a foglalas mukodik (tranzakcios esemeny megvan), de marketing e-mail / SMS: 0', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, {});
  assert.equal(f.valtozas, 'uj');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.confirmed'"), 1);   // tranzakcios visszaigazolas jon
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'email_marketing'), false);
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'sms_marketing'), false);
  assert.equal((await cs.marketingAllapot(t.db, f.guestId, 'email_marketing')).ok_kod, 'NINCS_HOZZAJARULAS');
  assert.equal(await cs.lehetKepMarketing(t.db, f.guestId), false);
  assert.equal(await szamol(t.db, 'consent_event'), 0);   // az elore nem kipipalt jelolonegyzet nem hoz letre esemenyt
});

test('CONSENT e-mail es SMS marketing KULON csatorna, kulon kepmarketing; szovegverzio + idobelyeg kotelezo', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, {});
  assert.equal(await hibaKod(() => cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'email_marketing' })), 'SZOVEGVERZIO_KELL');
  assert.equal(await hibaKod(() => cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'push', szovegVerzio: 'v1' })), 'ISMERETLEN_CSATORNA');
  await cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'email_marketing', szovegVerzio: 'mkt-email-v1', szoveg: 'Hozzajarulok az e-mailes ajanlatokhoz.', now: BASE });
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'email_marketing'), true);
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'sms_marketing'), false);   // az SMS-hez kulon hozzajarulas kell
  assert.equal(await cs.lehetKepMarketing(t.db, f.guestId), false);                 // a kep-marketinghez is
  await cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'image_marketing', szovegVerzio: 'kep-v1', now: BASE + 1 });
  assert.equal(await cs.lehetKepMarketing(t.db, f.guestId), true);
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'sms_marketing'), false);
  const e = await elso(t.db, "SELECT text_version, at, source FROM consent_event WHERE channel = 'email_marketing'");
  assert.deepEqual([e.text_version, e.at, e.source], ['mkt-email-v1', BASE, 'booking_form']);
  assert.equal((await cs.marketingAllapot(t.db, f.guestId, 'email_marketing')).szovegVerzio, 'mkt-email-v1');
  assert.equal(await hibaKod(() => cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'sms_marketing', szovegVerzio: 'v1', staffId: t.staff.marketing })), 'TILTOTT');
  assert.equal(await hibaKod(() => cs.lehetMarketing(t.db, f.guestId, 'image_marketing')), 'ISMERETLEN_CSATORNA');
});

test('S02 visszavont hozzajarulas: AZONNAL nincs uj marketing, opt-out naplo, csak az adott csatorna erintett, ujra-hozzajarulas lehetseges', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, {});
  await cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'email_marketing', szovegVerzio: 'v1', now: BASE });
  await cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'sms_marketing', szovegVerzio: 'v1', now: BASE });
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'email_marketing'), true);
  await cs.leiratkozas(t.db, { guestId: f.guestId, csatorna: 'email_marketing', forras: 'unsubscribe_link', now: BASE + 10 });
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'email_marketing'), false);
  assert.equal((await cs.marketingAllapot(t.db, f.guestId, 'email_marketing')).ok_kod, 'VISSZAVONVA');
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'sms_marketing'), true);   // az SMS-csatorna erintetlen
  assert.equal(await szamol(t.db, 'unsubscribe', "channel = 'email_marketing' AND source = 'unsubscribe_link'"), 1);
  assert.equal(await szamol(t.db, 'consent_event', "action = 'withdrawn'"), 1);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'consent.withdrawn'"), 1);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'consent.withdrawn'"), 1);
  await cs.visszavon(t.db, { guestId: f.guestId, csatorna: 'sms_marketing', forras: 'sms_stop', now: BASE + 20 });
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'sms_marketing'), false);
  // uj, onkentes hozzajarulas ujra engedi
  await cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'email_marketing', szovegVerzio: 'v2', now: BASE + 30 });
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'email_marketing'), true);
  const tortenet = (await cs.allapot(t.db, f.guestId)).tortenet.filter((x) => x.channel === 'email_marketing');
  assert.deepEqual(tortenet.map((x) => x.action), ['granted', 'withdrawn', 'granted']);
  // a naplo nem irhato at / nem torolheto
  await assert.rejects(t.db.prepare("UPDATE consent_event SET action = 'granted' WHERE action = 'withdrawn'").run(), /audit_append_only/);
  await assert.rejects(t.db.prepare('DELETE FROM consent_event').run(), /audit_append_only/);
});

test('CONSENT a marketing-kapu a panasz / szakmai stop / nem aktiv vendeg eseten is zar', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, {});
  await cs.rogzit(t.db, { guestId: f.guestId, csatorna: 'email_marketing', szovegVerzio: 'v1', now: BASE });
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'email_marketing'), true);
  await t.db.prepare("UPDATE guest SET clinical_stop = 'adverse_reaction' WHERE id = ?1").bind(f.guestId).run();
  assert.equal((await cs.marketingAllapot(t.db, f.guestId, 'email_marketing')).ok_kod, 'KLINIKAI_STOP');
  await t.db.prepare('UPDATE guest SET clinical_stop = NULL WHERE id = ?1').bind(f.guestId).run();
  await t.db.prepare("UPDATE guest SET status = 'merged' WHERE id = ?1").bind(f.guestId).run();
  assert.equal(await cs.lehetMarketing(t.db, f.guestId, 'email_marketing'), false);
  assert.equal(await cs.lehetMarketing(t.db, 'nincs-ilyen', 'email_marketing'), false);
});
