// Uzenet-motor tesztek (M01-M10): a kuldes SOHA nem valodi (dry adapter). A QA-azonosito a teszt nevebe van irva.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, mind, elso, szamol, hibaKod, BASE, NAP, VENDEG_A } from './fixtures.js';
import { tick, outboxFeldolgoz, jobLista } from '../lib/motor.js';
import { dryRunAdapter } from '../lib/messages/kuldo.js';
import * as cs from '../lib/consent.js';
import * as cp from '../lib/complaint.js';
import * as pk from '../lib/package.js';
import { ingestBookingEvent, igazolCompleted } from '../lib/booking.js';
import { helyiEpoch } from '../../netlify/lib/lifecycle/ido.js';

const ORA = 3600;
const C0 = BASE + 2 * ORA;   // az 1. kezeles igazolasa (fixtures.kezelesek: start + 2 ora)

/** egy tick dry adapterrel; visszaadja az eredmenyt es a "kikuldott" (naplozott) uzeneteket */
async function tickel(t, most, { konfig = {}, ...extra } = {}) {
  const naplo = [];
  const r = await tick(t.db, { most, kuldo: dryRunAdapter({ naplo }), konfig: { kuldes: 'dry', ...konfig }, ...extra });
  return { r, naplo };
}
const jobok = (db, felt = '1=1', ...p) => mind(db, `SELECT * FROM message_job WHERE ${felt} ORDER BY run_at, rowid`, ...p);
const kulcsok = (sorok) => sorok.map((j) => j.template_key);
const allapotok = async (db, kulcs) => Object.fromEntries((await jobok(db, 'template_key = ?1', kulcs)).map((j) => [j.status, j.stop_reason]));
const mindenHozzajarulas = async (t, guestId, now = BASE) => { for (const c of ['email_marketing', 'sms_marketing']) await cs.rogzit(t.db, { guestId, csatorna: c, szovegVerzio: 'v1', now }); };
/** vendeg 1 igazolt kezelessel + (opcionalisan) marketing hozzajarulassal; az outbox mar feldolgozva */
async function elsoKezeles(t, { hozzajarul = true } = {}) {
  const [k] = await kezelesek(t, { n: 1 });
  if (hozzajarul) await mindenHozzajarulas(t, k.guestId);
  await outboxFeldolgoz(t.db, { most: C0 });
  return k;
}

test('M01 T-72 / T-24 csak aktiv (booked) foglalasra: athelyezes / lemondas / allapotvaltas utan a regi idopontra 0 uzenet', async () => {
  const t = await ujTeszt();
  const start = BASE + 7 * NAP;
  const f = await foglal(t, { start });
  await outboxFeldolgoz(t.db, { most: BASE });
  assert.deepEqual(kulcsok(await jobok(t.db)).sort(), ['T-24', 'T-72', 'T0-F']);
  // T0-F azonnal megy (felmero-link nelkul is, es a job jelzi), T-72 a start-72h-kor
  let { naplo } = await tickel(t, BASE);
  assert.equal(naplo.length, 1);
  assert.match(naplo[0].targy, /Megvan az Oxygeni időpontod/);
  assert.ok(!/allapotfelmero|töltsd ki a biztonságos/.test(naplo[0].szoveg || ''), 'link nelkul a link-mondat is kimarad');
  const t0 = (await jobok(t.db, 'template_key = \'T0-F\''))[0];
  assert.equal(t0.status, 'dry_run');
  assert.ok(JSON.parse(t0.payload).jelzes.some((x) => x.startsWith('felmero_link_nelkul')));
  ({ naplo } = await tickel(t, start - 72 * ORA));
  assert.equal(naplo.length, 1);
  assert.match(naplo[0].targy, /Három nap múlva/);
  // a foglalas kozben (outbox nelkul, kozvetlen DB-valtas) mar nem 'booked': a T-24 SKIPPED, nem megy ki
  await t.db.prepare('UPDATE booking SET status = \'cancelled\', cancelled_at = ?2 WHERE id = ?1').bind(f.bookingId, BASE).run();
  ({ naplo } = await tickel(t, start - 24 * ORA));
  assert.equal(naplo.length, 0);
  const t24 = (await jobok(t.db, 'template_key = \'T-24\''))[0];
  assert.equal(t24.status, 'skipped');
  assert.equal(t24.stop_reason, 'SKIPPED_CONSENT_OR_STATE:booking_not_booked');
  assert.equal(await szamol(t.db, 'message_ledger', 'outcome = \'skipped\''), 1);
});

test('M01 lemondas: a fuggo T-72 / T-24 megszunik, C0 azonnal megy (marketingtol fuggetlen tranzakcios)', async () => {
  const t = await ujTeszt();
  const start = BASE + 7 * NAP;
  const f = await foglal(t, { start });
  await outboxFeldolgoz(t.db, { most: BASE });
  await ingestBookingEvent(t.db, { externalId: f.externalId, service: 'first_hair', start, status: 'cancelled', guest: VENDEG_A, eventAt: BASE + ORA, now: BASE + ORA });
  const o = await outboxFeldolgoz(t.db, { most: BASE + ORA });
  assert.equal(o.jobok.torolve, 2);
  assert.equal((await jobok(t.db, 'template_key IN (\'T-72\', \'T-24\') AND status = \'cancelled\'')).length, 2);
  const { naplo } = await tickel(t, BASE + ORA);
  assert.ok(naplo.some((n) => /Lemondásodat rögzítettük/.test(n.targy)));
  const { naplo: k } = await tickel(t, start - 72 * ORA);
  assert.equal(k.length, 0, 'a lemondott foglalasra nincs emlekezteto');
});

test('M02 R1 (+48h e-mail) / R2 (+5 nap SMS): csak consenttel, es csak ha nincs masik foglalas', async () => {
  const t = await ujTeszt();
  await elsoKezeles(t);
  const r = await jobok(t.db, 'template_key IN (\'R1\', \'R2\')');
  assert.deepEqual(kulcsok(r), ['R1', 'R2']);
  assert.equal(r[0].run_at, C0 + 48 * ORA);
  let { naplo } = await tickel(t, C0 + 48 * ORA);
  assert.ok(naplo.some((n) => /Egyeztessük a következő alkalmat/.test(n.targy)));
  ({ naplo } = await tickel(t, C0 + 5 * NAP));
  const sms = naplo.find((n) => n.csatorna === 'sms');
  assert.ok(sms && /foglalas|időpont/i.test(sms.szoveg));
  assert.equal(sms.cimzett.telefon, '+36301112222');
});

test('M02 R1 / R2: az utana lefoglalt kovetkezo kezeles (new booking) azonnal STOP; leiratkozas utan is STOP', async () => {
  const t = await ujTeszt();
  const k = await elsoKezeles(t);
  await foglal(t, { service: 'followup_hair', start: BASE + 14 * NAP, bookedAt: C0 + ORA, now: C0 + ORA });
  const { naplo, r } = await tickel(t, C0 + 48 * ORA);
  assert.equal(naplo.filter((n) => /Egyeztessük/.test(n.targy)).length, 0);
  assert.equal((await jobok(t.db, 'template_key = \'R1\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:next_active_booking');
  assert.ok(r.kihagyva >= 1);
  await cs.leiratkozas(t.db, { guestId: k.guestId, csatorna: 'sms_marketing', now: C0 + 3 * NAP });
  const { naplo: n2 } = await tickel(t, C0 + 5 * NAP);
  assert.equal(n2.filter((n) => n.csatorna === 'sms').length, 0);
  // a leiratkozas esemeny a fuggo SMS-marketing jobokat azonnal torli; a kuldeskori kapu ugyis megvedene (lasd M02 kapu-teszt)
  assert.equal((await jobok(t.db, 'template_key = \'R2\''))[0].status, 'cancelled');
});

test('M03 A1 / A2: onallo kamera-felmeres utan +48h e-mail / +5 nap SMS, ha nincs elso kezeles foglalas; a kozvetlen szemelyes-ertekeles link forras nelkul BLOCKED', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, { service: 'camera_assessment', start: BASE + NAP, bookedAt: BASE, now: BASE });
  await mindenHozzajarulas(t, f.guestId);
  const kesz = BASE + NAP + ORA;
  await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta, now: kesz });
  await outboxFeldolgoz(t.db, { most: kesz });
  assert.deepEqual(kulcsok(await jobok(t.db, 'template_key IN (\'A1\', \'A2\')')), ['A1', 'A2']);
  // A1: a "biztonsagos ertekeles link" forrasa nincs a CRM-ben -> BLOCKED_MISSING_DATA (ujraprobalhato), nem megy ki hamis levél
  let { naplo } = await tickel(t, kesz + 48 * ORA);
  assert.equal(naplo.length, 0);
  const a1 = (await jobok(t.db, 'template_key = \'A1\''))[0];
  assert.equal(a1.status, 'pending');
  assert.match(a1.stop_reason, /^BLOCKED_MISSING_DATA:hianyzo:biztonsagos_ertekeles_link/);
  // a link forrasa megadva -> kimegy
  ({ naplo } = await tickel(t, kesz + 49 * ORA + 10, { konfig: { linkek: { ertekeles: () => 'https://teszt.example/ertekeles/x' } } }));
  assert.equal(naplo.length, 1);
  assert.match(naplo[0].szoveg, /teszt\.example\/ertekeles/);
  // A2 SMS +5 nap
  ({ naplo } = await tickel(t, kesz + 5 * NAP));
  assert.equal(naplo.filter((n) => n.csatorna === 'sms').length, 1);
});

test('M03 A1 / A2: ha a felmeres utan mar van elso kezeles foglalas, STOP', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, { service: 'camera_assessment', start: BASE + NAP, bookedAt: BASE, now: BASE });
  await mindenHozzajarulas(t, f.guestId);
  const kesz = BASE + NAP + ORA;
  await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta, now: kesz });
  await outboxFeldolgoz(t.db, { most: kesz });
  await foglal(t, { service: 'first_hair', start: BASE + 10 * NAP, bookedAt: kesz + ORA, now: kesz + ORA });
  await tickel(t, kesz + 48 * ORA, { konfig: { linkek: { ertekeles: () => 'https://teszt.example/e' } } });
  assert.equal((await jobok(t.db, 'template_key = \'A1\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:first_booking_exists');
  const { naplo } = await tickel(t, kesz + 5 * NAP);
  assert.equal(naplo.filter((n) => n.csatorna === 'sms').length, 0);
});

test('M04 C1 (+24h e-mail) / C2 (+3 nap SMS) lemondas utan, csak consenttel es ha nincs uj foglalas; C0 consent nelkul is megy', async () => {
  const t = await ujTeszt();
  const start = BASE + 7 * NAP;
  const f = await foglal(t, { start });
  await mindenHozzajarulas(t, f.guestId);
  await ingestBookingEvent(t.db, { externalId: f.externalId, service: 'first_hair', start, status: 'cancelled', guest: VENDEG_A, eventAt: BASE + ORA, now: BASE + ORA });
  await outboxFeldolgoz(t.db, { most: BASE + ORA });
  let { naplo } = await tickel(t, BASE + ORA);
  assert.ok(naplo.some((n) => /Lemondásodat/.test(n.targy)));
  ({ naplo } = await tickel(t, BASE + ORA + 24 * ORA));
  assert.equal(naplo.filter((n) => n.csatorna === 'email').length, 1);   // C1
  // uj foglalas a C2 elott -> C2 STOP
  await foglal(t, { start: start + NAP, bookedAt: BASE + 2 * NAP, now: BASE + 2 * NAP });
  ({ naplo } = await tickel(t, BASE + ORA + 3 * NAP));
  assert.equal(naplo.filter((n) => n.csatorna === 'sms').length, 0);
  assert.equal((await jobok(t.db, 'template_key = \'C2\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:next_active_booking');
});

test('M05 N0: hiteles no_show utan masnap SMS (consenttel, uj foglalas nelkul); nincs buntetes', async () => {
  const t = await ujTeszt();
  const start = BASE + 2 * NAP;
  const f = await foglal(t, { start });
  await mindenHozzajarulas(t, f.guestId);
  await ingestBookingEvent(t.db, { externalId: f.externalId, service: 'first_hair', start, status: 'no_show', guest: VENDEG_A, eventAt: start + ORA, now: start + ORA });
  await outboxFeldolgoz(t.db, { most: start + ORA });
  const n0 = (await jobok(t.db, 'template_key = \'N0\''))[0];
  assert.equal(n0.run_at, start + ORA + NAP);
  const { naplo } = await tickel(t, start + ORA + NAP);
  const sms = naplo.find((n) => n.csatorna === 'sms');
  assert.ok(sms && /nem találkoztunk/.test(sms.szoveg));
  assert.equal(await szamol(t.db, 'package_adjustment'), 0);
});

test('M05 N0: consent nelkul nem is jon letre; a sima naptari ido lejarta nem no_show', async () => {
  const t = await ujTeszt();
  const start = BASE + 2 * NAP;
  const f = await foglal(t, { start });
  await outboxFeldolgoz(t.db, { most: BASE });
  // az idopont elmult, de nincs kezeloi igazolas / hiteles no_show -> semmilyen utouzenet
  const { naplo } = await tickel(t, start + 3 * NAP);
  assert.deepEqual(naplo.map((n) => n.targy).filter((x) => /Milyen volt|Elmondod|Egyeztess/.test(x)), []);
  assert.equal((await jobok(t.db, 'template_key IN (\'S0\', \'G0\', \'R1\', \'R2\', \'N0\')')).length, 0);
  assert.ok(f.bookingId);
});

test('M06 survey (+3h) es Google-keres (+24h) MINDEN vendegnek, consent es pontszam nelkul is; 1-3 pont utan is megy a G0', async () => {
  const t = await ujTeszt();
  const k = await elsoKezeles(t, { hozzajarul: false });
  assert.deepEqual(kulcsok(await jobok(t.db, 'template_key IN (\'S0\', \'G0\')')), ['S0', 'G0']);
  assert.equal((await jobok(t.db, 'template_key IN (\'R1\', \'R2\')')).length, 0, 'consent nelkul marketing nem jon letre');
  let { naplo } = await tickel(t, C0 + 3 * ORA);
  assert.equal(naplo.length, 1);
  assert.match(naplo[0].targy, /Milyen volt az első találkozásunk/);
  const m = /\/public\/elegedettseg\/([A-Za-z0-9_-]+)/.exec(naplo[0].szoveg);
  assert.ok(m, 'a kerdoiv-link tokent tartalmaz');
  assert.equal(await szamol(t.db, 'survey_response'), 1);
  // a vendeg 2 pontot ad -> panasz + Janka-riasztas, de a Google-keres MEGY
  await cp.surveyBead(t.db, { token: m[1], pont: 2, komment: 'Nem voltam elegedett', now: C0 + 4 * ORA });
  ({ naplo } = await tickel(t, C0 + 24 * ORA));
  const g0 = naplo.find((n) => /Elmondod, milyen volt/.test(n.targy));
  assert.ok(g0, 'G0 pontszamtol fuggetlenul megy');
  assert.match(g0.szoveg, /maps\.app\.goo\.gl/);
  assert.equal((await elso(t.db, 'SELECT status FROM review_request')).status, 'sent');
  assert.equal(k.treatmentIndex, 1);
});

test('M07 nyitott panasz: a marketing (R1/E8) STOP, a tranzakcios megy; lezaras utan NEM potlodik a kimaradt, az uj kezelesre ujra indul', async () => {
  const t = await ujTeszt();
  const k = await elsoKezeles(t);
  const sv = await cp.surveyKiad(t.db, { bookingId: k.bookingId, now: C0 + 3 * ORA });
  await cp.surveyBead(t.db, { token: sv.token, pont: 1, now: C0 + 4 * ORA });   // panasz nyilik (a sajat kezelonek)
  const panasz = await elso(t.db, 'SELECT * FROM complaint');
  await outboxFeldolgoz(t.db, { most: C0 + 4 * ORA });
  // tranzakcios: egy MASIK jovobeli foglalas T-72 emlekeztetoje megy a panasz alatt is
  const f2 = await foglal(t, { service: 'followup_hair', start: C0 + 20 * NAP, bookedAt: C0 + 5 * ORA, now: C0 + 5 * ORA });
  await outboxFeldolgoz(t.db, { most: C0 + 5 * ORA });
  let { naplo } = await tickel(t, C0 + 48 * ORA);
  assert.equal(naplo.filter((n) => /Egyeztessük/.test(n.targy)).length, 0, 'R1 STOP nyitott panasz alatt');
  assert.equal((await jobok(t.db, 'template_key = \'R1\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:complaint_open');
  ({ naplo } = await tickel(t, C0 + 20 * NAP - 72 * ORA));
  assert.ok(naplo.some((n) => /Három nap múlva/.test(n.targy)), 'a tranzakcios emlekeztetes panasz alatt is megy');
  // a sajat kezelo lezarja a panaszt; a kimaradt R1 nem potlodik
  await cp.probalkozas(t.db, { complaintId: panasz.id, staffId: t.staff.terapeuta, tipus: 'call', eredmeny: 'reached', now: C0 + 6 * ORA });
  await cp.lezar(t.db, { complaintId: panasz.id, staffId: t.staff.terapeuta, megoldas: 'Telefonon egyeztettunk', vendegElegedett: true, now: C0 + 8 * ORA });
  await outboxFeldolgoz(t.db, { most: C0 + 8 * ORA });
  assert.equal((await jobok(t.db, 'template_key = \'R1\''))[0].status, 'skipped');   // vegleges: nincs visszamenoleges potlas
  assert.equal(await szamol(t.db, 'message_job', 'template_key = \'R1\''), 1);
  assert.ok(f2.bookingId);
});

test('M07 panasz STOP a marketing-sorozat CSAK az esedekesseg pillanataban dol el: lezaras utan a friss allapot szerint indul', async () => {
  const t = await ujTeszt();
  const k = await elsoKezeles(t);
  const sv = await cp.surveyKiad(t.db, { bookingId: k.bookingId, now: C0 + 3 * ORA });
  await cp.surveyBead(t.db, { token: sv.token, pont: 2, now: C0 + 4 * ORA });
  const panasz = await elso(t.db, 'SELECT * FROM complaint');
  await cp.probalkozas(t.db, { complaintId: panasz.id, staffId: t.staff.terapeuta, tipus: 'call', eredmeny: 'reached', now: C0 + 5 * ORA });
  await cp.lezar(t.db, { complaintId: panasz.id, staffId: t.staff.terapeuta, megoldas: 'Rendezve', vendegElegedett: true, now: C0 + 6 * ORA });
  // lezaras a R1 esedekessege ELOTT: az R1 mar nincs panasz alatt -> megy
  const { naplo } = await tickel(t, C0 + 48 * ORA);
  assert.ok(naplo.some((n) => /Egyeztessük/.test(n.targy)));
});

test('M08 negativ (1-3 pont) elegedettseg: Janka (clinical_lead) belso ertesitest kap, a COMPLAINT feladat a SAJAT kezelore megy; szoveg nelkul REQUIRES_VERIFICATION', async () => {
  const t = await ujTeszt();
  const k = await elsoKezeles(t, { hozzajarul: false });
  const sv = await cp.surveyKiad(t.db, { bookingId: k.bookingId, now: C0 + 3 * ORA });
  await cp.surveyBead(t.db, { token: sv.token, pont: 2, komment: 'Nem voltam elegedett', now: C0 + 4 * ORA });
  const o = await outboxFeldolgoz(t.db, { most: C0 + 4 * ORA });
  const neg = await jobok(t.db, 'template_key = \'NEG\'');
  const comp = await jobok(t.db, 'template_key = \'COMPLAINT\'');
  assert.equal(neg.length, 1);
  assert.equal(JSON.parse(neg[0].payload).staff_id, t.staff.janka);
  assert.equal(comp.length, 1);
  assert.equal(JSON.parse(comp[0].payload).staff_id, t.staff.terapeuta, 'a panaszt a vendeg sajat kezeloje intezi, nem Janka');
  assert.ok(o.jobok.uj >= 2);
  // a mesteranyag nem ad belso szoveget: a motor nem talal ki -> blocked REQUIRES_VERIFICATION, semmi nem megy ki
  let { naplo } = await tickel(t, C0 + 4 * ORA);
  assert.equal(naplo.filter((n) => n.csatorna === 'internal').length, 0);
  assert.match((await jobok(t.db, 'template_key = \'NEG\''))[0].stop_reason, /^REQUIRES_VERIFICATION/);
  // a tulajdonos altal megadott belso szoveggel (konfig) megy: NEG -> Janka e-mailje
  const t2 = await ujTeszt();
  const k2 = await elsoKezeles(t2, { hozzajarul: false });
  const sv2 = await cp.surveyKiad(t2.db, { bookingId: k2.bookingId, now: C0 + 3 * ORA });
  await cp.surveyBead(t2.db, { token: sv2.token, pont: 1, now: C0 + 4 * ORA });
  const belso = { NEG: { targy: 'Negativ visszajelzes', torzs: ['Janka, uj negativ visszajelzes erkezett, a sajat kezelo intezi.'] }, COMPLAINT: { targy: 'Panasz', torzs: ['Uj panasz: 24 oran belul keresd meg a vendeget.'] } };
  ({ naplo } = await tickel(t2, C0 + 4 * ORA, { konfig: { belsoSzovegek: belso } }));
  const jankaEmail = (await elso(t2.db, 'SELECT email FROM staff_user WHERE id = ?1', t2.staff.janka)).email;
  const kezeloEmail = (await elso(t2.db, 'SELECT email FROM staff_user WHERE id = ?1', t2.staff.terapeuta)).email;
  const belsok = naplo.filter((n) => n.csatorna === 'internal');
  assert.deepEqual(belsok.map((n) => n.cimzett.email).sort(), [jankaEmail, kezeloEmail].sort());
  assert.equal(belsok.find((n) => n.cimzett.email === jankaEmail).targy, 'Negativ visszajelzes');
});

test('M09 berlet-lejarat: B30 (-30 nap e-mail) / B7 (-7 nap SMS) csak ha marad szabadon foglalhato alkalom; hosszabbitasnal az uj lejarathoz igazodik', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, { start: BASE + 3 * NAP });
  await mindenHozzajarulas(t, f.guestId);
  const v = await pk.vasarol(t.db, { guestId: f.guestId, tipus: 'package_5', staffId: t.staff.recepcio, fizetesIdeje: BASE, now: BASE });
  await outboxFeldolgoz(t.db, { most: BASE });
  const lejarat = v.purchase.expires_at;
  const b = await jobok(t.db, 'template_key IN (\'B30\', \'B7\')');
  assert.deepEqual(kulcsok(b), ['B30', 'B7']);
  assert.ok(Math.abs(b[0].run_at - (lejarat - 30 * NAP)) < NAP && Math.abs(b[1].run_at - (lejarat - 7 * NAP)) < NAP, 'B30 -30 nap, B7 -7 nap (ablakhoz igazitva)');
  let { naplo } = await tickel(t, b[0].run_at);
  const mail = naplo.find((n) => /Még van felhasználható/.test(n.targy));
  assert.ok(mail, 'B30 e-mail');
  assert.match(mail.szoveg, /5 alkalmas/);
  assert.match(mail.szoveg, /5 felhasználható alkalom/);
  // B7: kozben a szalonvezeto levonja az osszes alkalmat (korrekcio) -> nincs szabad alkalom -> STOP
  await pk.korrekcio(t.db, { purchaseId: v.purchaseId, deltaUnits: -5, staffId: t.staff.vezeto, ok: 'teszt', now: lejarat - 10 * NAP });
  ({ naplo } = await tickel(t, lejarat - 7 * NAP));
  assert.equal(naplo.filter((n) => n.csatorna === 'sms').length, 0);
  assert.equal((await jobok(t.db, 'template_key = \'B7\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:no_unused_appointments');
});

test('M09 hosszabbitas: a regi lejarathoz tartozo fuggo B30 / B7 megszunik, az uj lejarathoz uj jon letre (karbantartas, outbox-esemeny nelkul)', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, { start: BASE + 3 * NAP });
  await mindenHozzajarulas(t, f.guestId);
  const v = await pk.vasarol(t.db, { guestId: f.guestId, tipus: 'package_5', staffId: t.staff.recepcio, fizetesIdeje: BASE, now: BASE });
  await outboxFeldolgoz(t.db, { most: BASE });
  const regi = v.purchase.expires_at;
  assert.equal((await jobok(t.db, 'template_key IN (\'B30\', \'B7\') AND status = \'pending\'')).length, 2);
  const uj = (await pk.hosszabbit(t.db, { purchaseId: v.purchaseId, staffId: t.staff.vezeto, honap: 1, ok: 'teszt', now: BASE + 20 * NAP })).lejarat;
  assert.ok(uj > regi);
  const { r } = await tickel(t, regi - 40 * NAP);
  assert.equal(r.karbantartas.berlet.torolve, 2);
  assert.equal((await jobok(t.db, 'template_key IN (\'B30\', \'B7\') AND status = \'pending\'')).length, 0, 'a regi lejarathoz mar nincs fuggo job');
  const { r: r2 } = await tickel(t, uj - 44 * NAP);
  assert.equal(r2.karbantartas.berlet.uj, 2);
  const fuggo = await jobok(t.db, 'template_key IN (\'B30\', \'B7\') AND status = \'pending\'');
  assert.ok(fuggo.every((j) => j.context_id.endsWith(`:${uj}`)));
  assert.ok(Math.abs(fuggo.find((j) => j.template_key === 'B30').run_at - (uj - 30 * NAP)) < NAP);
  const { r: r3 } = await tickel(t, uj - 43 * NAP);
  assert.equal(r3.karbantartas.berlet.uj, 0, 'ismetelt karbantartas nem duplikal');
});

test('M10 kuldesi ablak: ablakon kivul (22:00) a job a kovetkezo nyitasra csuszik (WINDOW_DEFERRED), reggel kimegy; a tranzakcios T0 nem var', async () => {
  const t = await ujTeszt();
  const k = await elsoKezeles(t);
  const r1 = (await jobok(t.db, 'template_key = \'R1\''))[0];
  const este = helyiEpoch(2026, 10, 14, 22, 0);   // szerda 22:00
  assert.ok(este > r1.run_at);
  let { naplo, r } = await tickel(t, este);
  assert.equal(naplo.filter((n) => /Egyeztessük/.test(n.targy)).length, 0);
  assert.equal(r.halasztva >= 1, true);
  const kesleltetett = (await jobok(t.db, 'template_key = \'R1\''))[0];
  assert.equal(kesleltetett.status, 'pending');
  assert.equal(kesleltetett.run_at, helyiEpoch(2026, 10, 15, 7, 0));
  assert.match(kesleltetett.stop_reason, /^WINDOW_DEFERRED:outside_send_window/);
  ({ naplo } = await tickel(t, helyiEpoch(2026, 10, 15, 7, 0)));
  assert.ok(naplo.some((n) => /Egyeztessük/.test(n.targy)));
  assert.ok(k.bookingId);
});

test('M10 jobLista: job + ledger egyutt, szuro allapot szerint', async () => {
  const t = await ujTeszt();
  await elsoKezeles(t);
  await tickel(t, C0 + 3 * ORA);
  const lista = await jobLista(t.db, { allapot: 'dry_run' });
  assert.ok(lista.length >= 1);
  assert.equal(lista[0].ledger[0].outcome, 'dry_run');
  assert.equal(await hibaKod(async () => {}), null);
});

test('M10 regi uzenetet nem potlunk: leallas utan a lejart emlekezteto (az idopont elmult) es a tul keson esedekes marketing SKIPPED', async () => {
  const t = await ujTeszt();
  const start = BASE + 7 * NAP;
  await foglal(t, { start });
  await outboxFeldolgoz(t.db, { most: BASE });
  // a tick 8 napig nem futott: a T0 / T-72 / T-24 mar az idopont utan jonne ki
  const { naplo } = await tickel(t, start + 3600);
  assert.equal(naplo.length, 0);
  const sorok = await jobok(t.db, 'template_key IN (\'T0-F\', \'T-72\', \'T-24\')');
  assert.equal(sorok.length, 3);
  for (const j of sorok) assert.match(j.stop_reason, /^SKIPPED_CONSENT_OR_STATE:(appointment_passed|overdue)$/, j.template_key);
  assert.equal(sorok.find((j) => j.template_key === 'T0-F').stop_reason, 'SKIPPED_CONSENT_OR_STATE:appointment_passed');
  const t2 = await ujTeszt();
  await elsoKezeles(t2);
  const { naplo: n2 } = await tickel(t2, C0 + 10 * NAP);   // R1 (+48h) / R2 (+5 nap) 8 / 5 napja esedekes
  assert.equal(n2.filter((n) => /Egyeztessük/.test(n.targy)).length, 0);
  assert.equal((await jobok(t2.db, 'template_key = \'R1\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:overdue');
  assert.equal((await jobok(t2.db, 'template_key = \'R2\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:overdue');
  // a konfig felulirhatja a hatart
  const t3 = await ujTeszt();
  await elsoKezeles(t3);
  const { naplo: n3 } = await tickel(t3, C0 + 10 * NAP, { konfig: { maxKesesMp: { R1: 30 * NAP } } });
  assert.equal(n3.filter((n) => /Egyeztessük/.test(n.targy)).length, 1);
});

test('M10 E8 (esedekes kontroll, nincs foglalas) -> E9 (+7 nap, egyszeri); az R1 / R2 napjan az E8 a kovetkezo napra csuszik; foglalas eseten nincs E8', async () => {
  const t = await ujTeszt();
  await elsoKezeles(t);
  await tickel(t, C0 + 48 * ORA);   // R1
  await tickel(t, C0 + 5 * NAP);    // R2
  const kontroll = BASE + 14 * NAP;
  let { naplo } = await tickel(t, kontroll + ORA);
  assert.ok(naplo.some((n) => /Hogy vagy a legutóbbi kezelés óta/.test(n.targy)), 'E8 megy az esedekes kontroll utan');
  assert.equal((await jobok(t.db, 'template_key = \'E8\'')).length, 1);
  const e9 = (await jobok(t.db, 'template_key = \'E9\''))[0];
  assert.ok(e9);
  assert.equal(e9.run_at >= kontroll + ORA + 7 * NAP, true);
  ({ naplo } = await tickel(t, kontroll + 8 * NAP));
  assert.ok(naplo.length >= 1, 'az E9 e-mail kiment');
  assert.equal((await jobok(t.db, 'template_key = \'E9\''))[0].status, 'dry_run', 'az E9 egyszer megy, utana a visszahozo ag lezarul');
  await tickel(t, kontroll + 9 * NAP);
  assert.equal((await jobok(t.db, 'template_key = \'E8\'')).length, 1, 'ismetelt tick nem hoz uj E8-at');
  assert.equal((await jobok(t.db, 'template_key = \'E9\'')).length, 1);
  // foglalas eseten nincs E8
  const t2 = await ujTeszt();
  await elsoKezeles(t2);
  await foglal(t2, { service: 'followup_hair', start: kontroll + 2 * NAP, bookedAt: C0 + ORA, now: C0 + ORA });
  await tickel(t2, kontroll + ORA);
  assert.equal((await jobok(t2.db, 'template_key = \'E8\'')).length, 0);
});

test('M08 a kontraindikacio-riasztas (alert.contraindication) nincs katalogus-sablonja: az esemeny feldolgozott, a kezelo a felulet riasztas-listajan latja (nincs kitalalt uzenet)', async () => {
  const t = await ujTeszt();
  const { kerdoivBeallit, kerdoivKitolt } = await import('./fixtures.js');
  await kerdoivBeallit(t);
  const f = await foglal(t, { start: BASE + 3 * NAP });
  await kerdoivKitolt(t, { guestId: f.guestId, bookingId: f.bookingId, valaszFelulir: { korabbi_reakcio: true }, now: BASE + ORA });
  const o = await outboxFeldolgoz(t.db, { most: BASE + ORA });
  const ev = await elso(t.db, 'SELECT status FROM outbox_event WHERE event_type = \'alert.contraindication\'');
  assert.equal(ev.status, 'processed');
  assert.ok(o.reszletek.some((r) => r.tipus === 'alert.contraindication' && r.nincs_sablon === 1));
  assert.equal((await jobok(t.db, 'template_key IN (\'NEG\', \'COMPLAINT\', \'DOC24\')')).length, 0);
});

test('M02 marketing e-mail: a leiratkozasi link (konfig.linkek.leiratkozas) a levél lablecebe kerul, tranzakcios levélbe nem', async () => {
  const t = await ujTeszt();
  await elsoKezeles(t);
  const linkek = { leiratkozas: ({ guest }) => `https://teszt.example/leiratkozas/${guest.id}` };
  const { naplo } = await tickel(t, C0 + 48 * ORA, { konfig: { linkek } });
  const r1 = naplo.find((n) => /Egyeztessük/.test(n.targy));
  assert.match(r1.szoveg, /Leiratkozás: https:\/\/teszt\.example\/leiratkozas\//);
  const t2 = await ujTeszt();
  await foglal(t2, { start: BASE + 7 * NAP });
  const { naplo: n2 } = await tickel(t2, BASE, { konfig: { linkek } });
  assert.ok(!/Leiratkozás/.test(n2[0].szoveg), 'a tranzakcios T0 nem kap leiratkozasi linket');
});
