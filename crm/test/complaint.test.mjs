import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, szamol, elso, mind, BASE, NAP, VENDEG_A } from './fixtures.js';
import * as cp from '../lib/complaint.js';
import * as cs from '../lib/consent.js';
import { PANASZ_HATARIDO } from '../lib/constants.js';

/** elso kezeles igazolva, e-mail marketing hozzajarulassal, kerdoiv kiadva */
async function alap(t, { hozzajarul = true } = {}) {
  const [k] = await kezelesek(t, { n: 1 });
  if (hozzajarul) { await cs.rogzit(t.db, { guestId: k.guestId, csatorna: 'email_marketing', szovegVerzio: 'v1', now: BASE }); await cs.rogzit(t.db, { guestId: k.guestId, csatorna: 'sms_marketing', szovegVerzio: 'v1', now: BASE }); }
  const sv = await cp.surveyKiad(t.db, { bookingId: k.bookingId, now: k.confirmed_at ?? BASE + 3 * 3600 });
  return { k, sv, guestId: k.guestId };
}
const IDO = BASE + 100 * NAP;

test('M06 survey: csak az ELSO igazolt kezeleshez; 1-5 pont; a Google-keres (review_request) minden vendegnek van, ponttol fuggetlenul', async () => {
  const t = await ujTeszt();
  const [k1, k2] = await kezelesek(t, { n: 2 });
  assert.equal(await hibaKod(() => cp.surveyKiad(t.db, { bookingId: k2.bookingId })), 'NEM_ELSO_KEZELES');
  const f = await foglal(t, { start: BASE + 90 * NAP });
  assert.equal(await hibaKod(() => cp.surveyKiad(t.db, { bookingId: f.bookingId })), 'NEM_IGAZOLT');
  const sv = await cp.surveyKiad(t.db, { bookingId: k1.bookingId });
  assert.equal(await hibaKod(() => cp.surveyBead(t.db, { token: sv.token, pont: 6 })), 'ERVENYTELEN_PONT');
  assert.equal(await hibaKod(() => cp.surveyBead(t.db, { token: sv.token, pont: 0 })), 'ERVENYTELEN_PONT');
  assert.equal(await hibaKod(() => cp.surveyBead(t.db, { token: 'x', pont: 5 })), 'ISMERETLEN_LINK');
  const r = await cp.surveyBead(t.db, { token: sv.token, pont: 5, komment: 'Nagyon jo volt', now: IDO });
  assert.equal(r.riasztas, false);
  assert.equal(await szamol(t.db, 'complaint'), 0);
  assert.equal(await hibaKod(() => cp.surveyBead(t.db, { token: sv.token, pont: 4 })), 'MAR_BEADVA');   // nincs ketszeri beadas
  assert.equal(await szamol(t.db, 'review_request'), 1);   // pontszamtol fuggetlen
  assert.equal((await elso(t.db, 'SELECT therapist_id FROM survey_response')).therapist_id, t.staff.terapeuta);   // kezelo-attribucio
});

test('M09 1-3 pont (vagy negativ szoveg): Janka-riasztas, de a panaszt a SAJAT kezelo intezi, 24 oran belul; a Google-keres marad', async () => {
  const t = await ujTeszt();
  const { sv, guestId } = await alap(t);
  const r = await cp.surveyBead(t.db, { token: sv.token, pont: 2, komment: 'Nem voltam elegedett', now: IDO });
  assert.equal(r.riasztas, true);
  const c = await elso(t.db, 'SELECT * FROM complaint');
  assert.deepEqual([c.status, c.therapist_id, c.source, c.due_at], ['open', t.staff.terapeuta, 'survey', IDO + PANASZ_HATARIDO]);
  const jank = await elso(t.db, "SELECT payload FROM outbox_event WHERE event_type = 'alert.negative_survey'");
  assert.equal(JSON.parse(jank.payload).score, 2);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'complaint.opened'"), 1);
  assert.equal(await szamol(t.db, 'review_request'), 1);   // nincs review-gating
  // a szakmai vezeto (Janka) NEM intezi: nem rogzithet erintkezest, nem zarhatja le
  assert.equal(await hibaKod(() => cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.janka, tipus: 'call', eredmeny: 'no_answer' })), 'TILTOTT');
  assert.equal(await hibaKod(() => cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta2, tipus: 'call', eredmeny: 'no_answer' })), 'NEM_A_FELELOS');
  assert.equal(await hibaKod(() => cp.lezar(t.db, { complaintId: c.id, staffId: t.staff.janka, megoldas: 'x', vendegElegedett: true })), 'TILTOTT');
  assert.ok(await szamol(t.db, 'security_audit', "action LIKE 'complaint.%' AND result = 'denied'") >= 3);
  // 24 oras hatarido figyeles
  assert.equal((await cp.keso(t.db, IDO + PANASZ_HATARIDO - 1)).length, 0);
  assert.equal((await cp.keso(t.db, IDO + PANASZ_HATARIDO + 1)).length, 1);
  // 2 hivas, utana szemelyes e-mail; minden naplozva
  assert.equal(await hibaKod(() => cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, tipus: 'email', eredmeny: 'sent' })), 'ELOBB_KET_HIVAS');
  await cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, tipus: 'call', eredmeny: 'no_answer', now: IDO + 3600 });
  await cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, tipus: 'call', eredmeny: 'no_answer', now: IDO + 7200 });
  assert.equal(await hibaKod(() => cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, tipus: 'call', eredmeny: 'no_answer' })), 'MAX_HIVAS');
  const e = await cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, tipus: 'email', eredmeny: 'sent', megjegyzes: 'szemelyes e-mail', now: IDO + 8000 });
  assert.equal(e.hatarido_belul, true);
  assert.equal(await szamol(t.db, 'complaint_contact_attempt'), 3);
  assert.equal((await elso(t.db, 'SELECT first_contact_at FROM complaint')).first_contact_at, IDO + 3600);
  await assert.rejects(t.db.prepare('DELETE FROM complaint_contact_attempt').run(), /audit_append_only/);
  assert.ok(guestId);
});

test('M09 telefonon elert vendeg: az e-mail nem kell; negativ szoveg 5 ponttal is panasz', async () => {
  const t = await ujTeszt();
  const { sv } = await alap(t);
  const r = await cp.surveyBead(t.db, { token: sv.token, pont: 5, komment: 'A kezeles utan viszketett a fejbor, kellemetlen volt', now: IDO });
  assert.equal(r.riasztas, true);
  assert.equal(cp.negativSzoveg('Minden szuper'), false);
  assert.equal(cp.negativSzoveg('Nagyon CSALODTAM'), true);
  const c = await elso(t.db, 'SELECT id FROM complaint');
  await cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, tipus: 'call', eredmeny: 'reached', now: IDO + 60 });
  await cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, tipus: 'email', eredmeny: 'sent', now: IDO + 120 });
  assert.equal(await szamol(t.db, 'complaint_contact_attempt'), 2);
});

test('M07 nyitott panasz: a marketing / visszafoglalas STOP (hozzajarulas ellenere), a tranzakcios esemenyek mennek tovabb', async () => {
  const t = await ujTeszt();
  const { sv, guestId } = await alap(t);
  assert.equal(await cs.lehetMarketing(t.db, guestId, 'email_marketing'), true);
  await cp.surveyBead(t.db, { token: sv.token, pont: 1, now: IDO });
  assert.equal(await cs.lehetMarketing(t.db, guestId, 'email_marketing'), false);
  assert.equal(await cs.lehetMarketing(t.db, guestId, 'sms_marketing'), false);
  assert.equal((await cs.marketingAllapot(t.db, guestId, 'email_marketing')).ok_kod, 'NYITOTT_PANASZ');
  assert.equal(await cp.nyitottPanasz(t.db, guestId), true);
  // a hozzajarulas megmaradt (nem torlodott), a tranzakcios idopont-esemeny tovabbra is kepzodik
  assert.equal(await cs.hozzajarulas(t.db, guestId, 'email_marketing'), true);
  const uj = await foglal(t, { service: 'followup_hair', start: BASE + 120 * NAP, externalId: 'tr-1' });
  assert.equal(uj.valtozas, 'uj');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.confirmed' AND aggregate_id = ?1", uj.bookingId), 1);
});

test('M08 resolved szabaly + ujrainditas: dokumentalt megoldas, erintkezes, elegedett vendeg kell; lezaras utan a friss allapot szerint indul, nincs visszamenoleges potlas', async () => {
  const t = await ujTeszt();
  const { sv, guestId } = await alap(t);
  await cp.surveyBead(t.db, { token: sv.token, pont: 2, now: IDO });
  const c = await elso(t.db, 'SELECT id FROM complaint');
  const jobDb = () => szamol(t.db, 'message_job');
  assert.equal(await hibaKod(() => cp.lezar(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, megoldas: 'x', vendegElegedett: true })), 'NINCS_ERINTKEZES');
  await cp.probalkozas(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, tipus: 'call', eredmeny: 'reached', now: IDO + 60 });
  assert.equal(await hibaKod(() => cp.lezar(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, megoldas: '  ', vendegElegedett: true })), 'MEGOLDAS_KELL');
  // tovabbra is elegedetlen -> NYITVA marad
  const nyitva = await cp.lezar(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, megoldas: 'Ujra kezelest ajanlottam', vendegElegedett: false, now: IDO + 120 });
  assert.deepEqual([nyitva.lezarva, nyitva.ok_kod], [false, 'MEG_ELEGEDETLEN']);
  assert.equal((await elso(t.db, 'SELECT status FROM complaint')).status, 'open');
  assert.equal(await cs.lehetMarketing(t.db, guestId, 'email_marketing'), false);
  // kompenzacio: kezelo kerheti, csak a szalonvezeto hagyhatja jova; fuggo kerelem mellett nem zarhato
  assert.equal(await hibaKod(() => cp.kompenzacioKeres(t.db, { complaintId: c.id, tipus: 'refund', osszeg: 0, staffId: t.staff.terapeuta })), 'ERVENYTELEN_OSSZEG');
  assert.equal(await hibaKod(() => cp.kompenzacioKeres(t.db, { complaintId: c.id, tipus: 'refund', osszeg: 10000, staffId: t.staff.recepcio })), 'TILTOTT');
  const kk = await cp.kompenzacioKeres(t.db, { complaintId: c.id, tipus: 'refund', osszeg: 10000, staffId: t.staff.terapeuta, now: IDO + 130 });
  assert.equal(await cp.kompenzacioKiadhato(t.db, kk.approvalId), false);
  assert.equal(await hibaKod(() => cp.lezar(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, megoldas: 'rendezve', vendegElegedett: true })), 'FUGGO_KOMPENZACIO');
  for (const staffId of [t.staff.terapeuta, t.staff.janka, t.staff.recepcio, t.staff.marketing, t.staff.admin]) {
    assert.equal(await hibaKod(() => cp.kompenzacioDont(t.db, { approvalId: kk.approvalId, staffId, dontes: 'approved' })), 'TILTOTT');
  }
  assert.equal(await cp.kompenzacioKiadhato(t.db, kk.approvalId), false);
  await cp.kompenzacioDont(t.db, { approvalId: kk.approvalId, staffId: t.staff.vezeto, dontes: 'approved', megjegyzes: 'rendben', now: IDO + 200 });
  assert.equal(await cp.kompenzacioKiadhato(t.db, kk.approvalId), true);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'compensation.approved' AND staff_id = ?1", t.staff.vezeto), 1);
  assert.equal(await hibaKod(() => cp.kompenzacioDont(t.db, { approvalId: kk.approvalId, staffId: t.staff.vezeto, dontes: 'rejected' })), 'NEM_FUGGO');
  // lezaras
  const ok = await cp.lezar(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, megoldas: 'A vendeg elfogadta a megoldast', vendegElegedett: true, now: IDO + 300 });
  assert.equal(ok.lezarva, true);
  const lezart = await elso(t.db, 'SELECT * FROM complaint');
  assert.deepEqual([lezart.status, lezart.resolved_by, lezart.guest_satisfied], ['resolved', t.staff.terapeuta, 1]);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'complaint.resolved'"), 1);
  // ujrainditas: a FRISS allapot szerint ujra engedett; nem keletkezik visszamenoleges potlas
  const elotte = await jobDb();
  assert.equal(await cs.lehetMarketing(t.db, guestId, 'email_marketing'), true);
  assert.equal(await jobDb(), elotte);
  assert.equal((await cp.lezar(t.db, { complaintId: c.id, staffId: t.staff.terapeuta, megoldas: 'x', vendegElegedett: true })).mar, true);
  // DB-szinten sem allithato resolved megoldas / elegedett vendeg nelkul
  const c2 = await cp.panaszNyit(t.db, { guestId, kezeloId: t.staff.terapeuta, staffId: t.staff.terapeuta, leiras: 'telefonon jelezte', now: IDO + 400 });
  await assert.rejects(t.db.prepare("UPDATE complaint SET status = 'resolved' WHERE id = ?1").bind(c2.complaintId).run(), /CHECK/);
});

test('COMPLAINT kezeloi riport, felelos-csere (szalonvezeto), kezi panasz-megnyitas', async () => {
  const t = await ujTeszt();
  const { sv, guestId } = await alap(t);
  await cp.surveyBead(t.db, { token: sv.token, pont: 3, now: IDO });
  const riport = await cp.kezeloRiport(t.db);
  assert.deepEqual(riport.map((r) => [r.therapist_id, r.db, r.atlag, r.negativ]), [[t.staff.terapeuta, 1, 3, 1]]);
  const c = await elso(t.db, 'SELECT id FROM complaint');
  assert.equal(await hibaKod(() => cp.felelosCsere(t.db, { complaintId: c.id, ujKezeloId: t.staff.terapeuta2, staffId: t.staff.terapeuta, ok: 'x' })), 'TILTOTT');
  assert.equal(await hibaKod(() => cp.felelosCsere(t.db, { complaintId: c.id, ujKezeloId: t.staff.recepcio, staffId: t.staff.vezeto, ok: 'x' })), 'NEM_KEZELO');
  await cp.felelosCsere(t.db, { complaintId: c.id, ujKezeloId: t.staff.terapeuta2, staffId: t.staff.vezeto, ok: 'tavollet' });
  assert.equal((await elso(t.db, 'SELECT therapist_id FROM complaint')).therapist_id, t.staff.terapeuta2);
  const m = await cp.panaszNyit(t.db, { guestId, staffId: t.staff.terapeuta, forras: 'phone', now: IDO });
  assert.equal(m.felelos, t.staff.terapeuta);   // a vendeg kezeloje
  assert.equal(await hibaKod(() => cp.panaszNyit(t.db, { guestId, staffId: t.staff.recepcio })), 'TILTOTT');
});
