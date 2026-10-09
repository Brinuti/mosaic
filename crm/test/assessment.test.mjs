import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, hibaKod, szamol, elso, mind, kerdoivBeallit, kerdoivKitolt, JO_VALASZ, BASE, NAP, VENDEG_A } from './fixtures.js';
import { igazolCompleted } from '../lib/booking.js';
import * as asz from '../lib/assessment.js';
import { lehetMarketing } from '../lib/consent.js';

test('ASSESSMENT a jovahagyatlan kerdoiv NEM adhato ki a vendegnek; csak a szakmai vezeto hagyhatja jova', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, {});
  assert.equal((await asz.kiadhato(t.db)).ok, false);
  assert.equal(await hibaKod(() => asz.kiad(t.db, { guestId: f.guestId, bookingId: f.bookingId })), 'NINCS_JOVAHAGYOTT_VERZIO');
  await asz.letrehozVerzio(t.db, { staffId: t.staff.janka });
  assert.equal((await asz.kiadhato(t.db)).ok, false);   // letrehozva, de nincs jovahagyva
  assert.equal(await hibaKod(() => asz.jovahagyVerzio(t.db, { version: asz.ALAP_VERZIO, staffId: t.staff.terapeuta })), 'TILTOTT');
  assert.equal(await hibaKod(() => asz.letrehozVerzio(t.db, { version: 'x', staffId: t.staff.recepcio })), 'TILTOTT');
  assert.equal((await elso(t.db, 'SELECT approved_by_clinical_lead FROM assessment')).approved_by_clinical_lead, 0);
  await asz.jovahagyVerzio(t.db, { version: asz.ALAP_VERZIO, staffId: t.staff.janka });
  assert.equal((await asz.kiadhato(t.db)).ok, true);
  assert.equal((await elso(t.db, 'SELECT approved_by FROM assessment')).approved_by, t.staff.janka);
});

test('ASSESSMENT a protokollfuggo kerdesek REQUIRES_VERIFICATION jeloltek; a csoportok a specifikacio szerintiek', () => {
  const kulcsok = asz.ALAP_KERDOIV.csoportok.map((c) => c.kulcs);
  assert.deepEqual(kulcsok, ['foglalas', 'panasz', 'elozmenyek', 'rutin', 'biztonsag']);
  const rv = asz.ALAP_KERDOIV.csoportok.flatMap((c) => c.kerdesek).filter((q) => q.requires_verification);
  assert.ok(rv.length >= 4);
  assert.ok(asz.ALAP_VERZIO.includes('REQUIRES_VERIFICATION'));
});

test('ASSESSMENT kitoltes: az adatkezelesi tajekoztato elfogadasa kotelezo es KULON van a marketing-hozzajarulastol; ketszer nem adhato be', async () => {
  const t = await ujTeszt();
  await kerdoivBeallit(t);
  const f = await foglal(t, {});
  const k = await asz.kiad(t.db, { guestId: f.guestId, bookingId: f.bookingId, now: BASE });
  assert.notEqual(k.token.length, 0);
  assert.equal((await elso(t.db, 'SELECT token_hash FROM assessment_submission')).token_hash.includes(k.token), false);   // csak a hash
  assert.equal(await hibaKod(() => asz.bead(t.db, { token: k.token, valaszok: { ...JO_VALASZ, adatkezeles_elfogadva: false } })), 'ADATKEZELES_KELL');
  assert.equal(await hibaKod(() => asz.bead(t.db, { token: k.token, valaszok: { adatkezeles_elfogadva: true } })), 'ERVENYTELEN_VALASZ');
  assert.equal(await hibaKod(() => asz.bead(t.db, { token: 'rossz', valaszok: JO_VALASZ })), 'ISMERETLEN_LINK');
  const b = await asz.bead(t.db, { token: k.token, valaszok: JO_VALASZ, adatkezelesVerzio: 'adat-v3', now: BASE + 100 });
  assert.equal(b.jelzes, false);
  assert.deepEqual(await mind(t.db, 'SELECT channel, action, text_version FROM consent_event'), [{ channel: 'privacy', action: 'granted', text_version: 'adat-v3' }]);
  assert.equal(await lehetMarketing(t.db, f.guestId, 'email_marketing'), false);   // az adatkezelesi elfogadas NEM marketing-hozzajarulas
  assert.equal(await hibaKod(() => asz.bead(t.db, { token: k.token, valaszok: JO_VALASZ })), 'ISMERETLEN_LINK');   // a token felhasznalodott
  assert.deepEqual(await asz.kerdoivAllapot(t.db, f.bookingId), { status: 'submitted', kitoltve: true, jelzes: false });
});

test('C09 kontraindikacio-jelzes: kezeloi ertesites (outbox), nyitott riasztas, a kezeles NEM igazolhato a felulvizsgalatig', async () => {
  const t = await ujTeszt();
  await kerdoivBeallit(t);
  const f = await foglal(t, { start: BASE + 7 * NAP });
  const k = await kerdoivKitolt(t, { guestId: f.guestId, bookingId: f.bookingId, valaszFelulir: { termek_allergia: true } });
  assert.equal(k.jelzes, true);
  assert.deepEqual(k.flagek, ['termek_allergia']);
  const al = await elso(t.db, 'SELECT * FROM contraindication_alert');
  assert.equal(al.status, 'open');
  assert.equal(al.therapist_id, t.staff.terapeuta);   // a foglalas kezeloje
  const ox = await elso(t.db, "SELECT payload FROM outbox_event WHERE event_type = 'alert.contraindication'");
  assert.equal(JSON.parse(ox.payload).therapist_id, t.staff.terapeuta);
  assert.equal((await asz.kuraAjanlhato(t.db, f.guestId)).ok, false);
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta })), 'KLINIKAI_FELULVIZSGALAT_KELL');
  assert.equal(await szamol(t.db, 'treatment_session'), 0);
  // tudomasulvetel, de a kezeles meg nem indulhat
  assert.equal(await asz.tudomasulVesz(t.db, { alertId: al.id, staffId: t.staff.terapeuta }), true);
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta })), 'KLINIKAI_FELULVIZSGALAT_KELL');
  assert.equal(await hibaKod(() => asz.attekint(t.db, { submissionId: k.submissionId, staffId: t.staff.recepcio, eredmeny: 'cleared' })), 'TILTOTT');
  // szakmai felulvizsgalat utan feloldva -> mehet
  await asz.attekint(t.db, { submissionId: k.submissionId, staffId: t.staff.janka, eredmeny: 'cleared', megjegyzes: 'egyeztetve, rendben', now: BASE + NAP });
  assert.equal((await elso(t.db, 'SELECT status FROM contraindication_alert')).status, 'cleared');
  assert.equal((await asz.kuraAjanlhato(t.db, f.guestId)).ok, true);
  assert.equal((await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta, now: BASE + 7 * NAP })).treatmentIndex, 1);
});

test('C09 vegleges ellenjavallat: clinical_stop, a kura szunetel, nincs kezeles / kura-ajanlas; feloldas csak a szakmai vezetonek', async () => {
  const t = await ujTeszt();
  await kerdoivBeallit(t);
  const f = await foglal(t, { start: BASE + 7 * NAP });
  const k = await kerdoivKitolt(t, { guestId: f.guestId, bookingId: f.bookingId, valaszFelulir: { sulyosbodo_tunet: true } });
  await asz.attekint(t.db, { submissionId: k.submissionId, staffId: t.staff.terapeuta, eredmeny: 'contraindicated', now: BASE + NAP });
  assert.equal((await elso(t.db, 'SELECT clinical_stop FROM guest')).clinical_stop, 'contraindication');
  assert.equal((await elso(t.db, 'SELECT status FROM contraindication_alert')).status, 'clinical_stop');
  assert.equal((await elso(t.db, 'SELECT status FROM course')).status, 'paused_clinical');
  assert.equal(await hibaKod(() => igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta })), 'KLINIKAI_STOP');
  assert.equal((await asz.kuraAjanlhato(t.db, f.guestId)).ok, false);
  assert.equal(await hibaKod(() => asz.stopFeloldas(t.db, { guestId: f.guestId, staffId: t.staff.terapeuta, ok: 'x' })), 'TILTOTT');
  await asz.stopFeloldas(t.db, { guestId: f.guestId, staffId: t.staff.janka, ok: 'orvosi igazolas' });
  assert.equal((await asz.kuraAjanlhato(t.db, f.guestId)).ok, true);
});
