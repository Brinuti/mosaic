// Uzenet-motor tesztek 2.: B06-B10 (foglalas-szintu garanciak), C07/C08 (hianyzo dokumentacio), motor-infrastruktura (retry, dead-letter, sandbox, claim).
// A kuldes SOHA nem valodi: dry adapter, konfig.kuldes soha nem 'eles'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, mind, elso, szamol, hibaKod, sessionok, jpegBajtok, kerdoivBeallit, BASE, NAP, VENDEG_A } from './fixtures.js';
import { tick, outboxFeldolgoz, karbantartas, ujrafuttat, elonezet, sandboxProba, motorKonfigEnvbol } from '../lib/motor.js';
import { dryRunAdapter, elesAdapterKeszit } from '../lib/messages/kuldo.js';
import * as cs from '../lib/consent.js';
import * as pl from '../lib/plan.js';
import * as im from '../lib/images.js';
import * as pk from '../lib/package.js';
import { ingestBookingEvent, igazolCompleted } from '../lib/booking.js';

const ORA = 3600;
const C0 = BASE + 2 * ORA;
async function tickel(t, most, { konfig = {}, ...extra } = {}) {
  const naplo = [];
  const r = await tick(t.db, { most, kuldo: dryRunAdapter({ naplo }), konfig: { kuldes: 'dry', ...konfig }, ...extra });
  return { r, naplo };
}
const jobok = (db, felt = '1=1', ...p) => mind(db, `SELECT * FROM message_job WHERE ${felt} ORDER BY run_at, rowid`, ...p);
const kulcsok = (sorok) => sorok.map((j) => j.template_key);
const mindenHozzajarulas = async (t, guestId, now = BASE) => { for (const c of ['email_marketing', 'sms_marketing']) await cs.rogzit(t.db, { guestId, csatorna: c, szovegVerzio: 'v1', now }); };
const MARKETING = ['R1', 'R2', 'A1', 'A2', 'C1', 'C2', 'N0', 'E8', 'E9', 'B30', 'B7'];
const TERV = () => ({
  fo_panasz: 'Hajhullas, ritkulo fejtetoi resz', megfigyelesek: ['ritkulo fejtetoi resz', 'enyhe zsirosodas'], cel: 'A hajhullas csokkentese',
  teljes_kura_11: true, ritmus_nap: 14, otthoni_apolas: { termek: 'Oxygeni sampon', hasznalat: 'hetente 2-3 alkalommal' },
  kezeloi_javaslat: 'A kamerakepen ritkulo fejtetoi resz latszik. Ket hetente javaslom a kezelest. Jelezz, ha barmi kellemetlen.',
  kovetkezo_idopont: { javasolt_intervallum: '2 het mulva' },
});

test('B06 dupla ingest: ugyanaz a Salonic-esemeny ketszer = 1 foglalas, 1 outbox-esemeny, 3 job; a duplikalt outbox-esemeny sem hoz masodik uzenetet', async () => {
  const t = await ujTeszt();
  const start = BASE + 7 * NAP;
  const a = await foglal(t, { start, externalId: 'dup-1' });
  const b = await foglal(t, { start, externalId: 'dup-1' });
  assert.equal(b.valtozas, 'duplikalt');
  assert.equal(await szamol(t.db, 'booking'), 1);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.confirmed'"), 1);
  const o1 = await outboxFeldolgoz(t.db, { most: BASE });
  const o2 = await outboxFeldolgoz(t.db, { most: BASE });
  assert.equal(o1.jobok.uj, 3);
  assert.equal(o2.talalt, 0);
  // kezzel beszurt "ketszer kiirt" esemeny masik dedupe_key-vel: a job-kulcs (guest|sablon|kontextus|verzio) megvedi
  const ev = await elso(t.db, 'SELECT * FROM outbox_event WHERE event_type = \'booking.confirmed\'');
  await t.db.prepare('INSERT INTO outbox_event (id, event_type, aggregate_type, aggregate_id, guest_id, payload, dedupe_key, status, attempts, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, \'pending\', 0, ?8)')
    .bind(crypto.randomUUID(), ev.event_type, ev.aggregate_type, ev.aggregate_id, ev.guest_id, ev.payload, 'masik-kulcs', BASE).run();
  const o3 = await outboxFeldolgoz(t.db, { most: BASE });
  assert.deepEqual([o3.jobok.uj, o3.jobok.mar_volt], [0, 3]);
  assert.equal(await szamol(t.db, 'message_job'), 3);
  const { naplo } = await tickel(t, BASE);
  assert.equal(naplo.length, 1);
  const { naplo: n2 } = await tickel(t, BASE + 60);
  assert.equal(n2.length, 0, 'a T0 egyszer megy');
  assert.equal(await szamol(t.db, 'message_ledger', "template_key = 'T0-F'"), 1);
  assert.ok(a.bookingId);
});

test('B07 parhuzamos tick: ugyanaz az esedekes job EGYSZER megy ki (atomikus claim), a ledgerben egy sor', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  await outboxFeldolgoz(t.db, { most: BASE });
  const eredmenyek = await Promise.all([1, 2, 3, 4].map(() => tickel(t, BASE)));
  const osszes = eredmenyek.flatMap((e) => e.naplo);
  assert.equal(osszes.length, 1, 'egyetlen kikuldes');
  assert.equal(eredmenyek.reduce((s, e) => s + e.r.claimelt, 0), 1);
  assert.equal(await szamol(t.db, 'message_ledger', "template_key = 'T0-F'"), 1);
  assert.equal(await szamol(t.db, 'message_job', "status = 'claimed'"), 0, 'nem ragad be claim');
});

test('B07 parhuzamos tick + outbox: a friss esemenyekbol sem lesz dupla job / uzenet', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  const eredmenyek = await Promise.all([1, 2, 3].map(() => tickel(t, BASE)));
  assert.equal(eredmenyek.flatMap((e) => e.naplo).length, 1);
  assert.equal(await szamol(t.db, 'message_job'), 3);
});

test('B08 confirmed gating: a T0 csak valoban aktiv (booked) foglalasra megy, a szolgaltatas-tipusnak megfelelo sablon (first -> T0-F, camera -> T0-C)', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, { start: BASE + 7 * NAP });
  const c = await foglal(t, { service: 'camera_assessment', start: BASE + 8 * NAP, vendeg: { nev: 'Teszt Bela', email: 'bela.teszt@example.com', telefon: '+36 20 333 4444' } });
  await outboxFeldolgoz(t.db, { most: BASE });
  assert.equal((await jobok(t.db, 'template_key = \'T0-F\'')).length, 1);
  assert.equal((await jobok(t.db, 'template_key = \'T0-C\'')).length, 1);
  // a first foglalas kozben lemondodott (a Salonic-ertesito tovabbi feldolgozasa elott): a T0-F SKIPPED
  await t.db.prepare('UPDATE booking SET status = \'cancelled\', cancelled_at = ?2 WHERE id = ?1').bind(f.bookingId, BASE).run();
  const { naplo } = await tickel(t, BASE);
  assert.deepEqual(naplo.map((n) => n.targy), ['Hajkamerás állapotfelmérésed – időpont és tudnivalók']);
  assert.equal((await jobok(t.db, 'template_key = \'T0-F\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:booking_not_booked');
  assert.ok(c.bookingId);
});

test('B08 completed igazolas nelkul nincs utouzenet: a naptari ido lejarta onmagaban nem indit S0 / G0 / R1', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, { start: BASE + NAP });
  await mindenHozzajarulas(t, f.guestId);
  await outboxFeldolgoz(t.db, { most: BASE });
  const { naplo } = await tickel(t, BASE + 20 * NAP);
  assert.equal(naplo.filter((n) => /Milyen volt|Elmondod|Egyeztessük/.test(n.targy)).length, 0);
  assert.equal((await jobok(t.db, 'template_key IN (\'S0\', \'G0\', \'R1\', \'R2\')')).length, 0);
  // igazolas -> S0 / G0 / R1 / R2 letrejon
  await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta, now: BASE + NAP + 2 * ORA });
  await outboxFeldolgoz(t.db, { most: BASE + NAP + 2 * ORA });
  assert.deepEqual(kulcsok(await jobok(t.db, 'template_key IN (\'S0\', \'G0\', \'R1\', \'R2\', \'E2\', \'E3\')')).sort(), ['E2', 'E3', 'G0', 'R1', 'R2', 'S0']);
});

test('B09 athelyezes: a regi idopont T-72 / T-24 jobjai torlodnek, az uj idopontra ujraütemeznek (T0 nem ismetlodik); visszaathelyezes az eredeti idopontra ujraelesziti', async () => {
  const t = await ujTeszt();
  const s1 = BASE + 7 * NAP, s2 = BASE + 9 * NAP;
  const f = await foglal(t, { start: s1 });
  await outboxFeldolgoz(t.db, { most: BASE });
  await tickel(t, BASE);   // T0
  await ingestBookingEvent(t.db, { externalId: f.externalId, service: 'first_hair', start: s2, status: 'rescheduled', guest: VENDEG_A, eventAt: BASE + ORA, now: BASE + ORA });
  const o = await outboxFeldolgoz(t.db, { most: BASE + ORA });
  assert.equal(o.jobok.torolve, 2);
  assert.equal(o.jobok.uj, 2);
  const T = await jobok(t.db, 'template_key IN (\'T-72\', \'T-24\')');
  assert.equal(T.filter((j) => j.status === 'cancelled').length, 2);
  assert.deepEqual(T.filter((j) => j.status === 'pending').map((j) => j.context_id.split(':')[1]), [String(s2), String(s2)].sort());
  assert.equal(await szamol(t.db, 'message_job', "template_key = 'T0-F'"), 1, 'T0 nem ismetlodik');
  // a regi idopont T-72 idejen 0 uzenet, az ujon megy
  let { naplo } = await tickel(t, s1 - 72 * ORA);
  assert.equal(naplo.length, 0);
  ({ naplo } = await tickel(t, s2 - 72 * ORA));
  assert.equal(naplo.length, 1);
  assert.match(naplo[0].targy, /Három nap múlva/);
});

test('B09 athelyezes A -> B -> A: az eredeti idopont cancelled jobjai ujraelesztodnek (UNIQUE kulcs nem akadalyoz), a kozbenso idopontéi megszunnek', async () => {
  const t = await ujTeszt();
  const s1 = BASE + 7 * NAP, s2 = BASE + 9 * NAP;
  const f = await foglal(t, { start: s1 });
  await outboxFeldolgoz(t.db, { most: BASE });
  await ingestBookingEvent(t.db, { externalId: f.externalId, service: 'first_hair', start: s2, status: 'rescheduled', guest: VENDEG_A, eventAt: BASE + ORA, now: BASE + ORA });
  await outboxFeldolgoz(t.db, { most: BASE + ORA });
  await ingestBookingEvent(t.db, { externalId: f.externalId, service: 'first_hair', start: s1, status: 'rescheduled', guest: VENDEG_A, eventAt: BASE + 2 * ORA, now: BASE + 2 * ORA });
  const o2 = await outboxFeldolgoz(t.db, { most: BASE + 2 * ORA });
  assert.equal(o2.jobok.ujraelesztve, 2);
  assert.equal(o2.jobok.torolve, 2);
  const T = await jobok(t.db, 'template_key IN (\'T-72\', \'T-24\')');
  assert.deepEqual(T.filter((j) => j.status === 'pending').map((j) => j.context_id.split(':')[1]), [String(s1), String(s1)]);
  assert.deepEqual(T.filter((j) => j.status === 'cancelled').map((j) => j.context_id.split(':')[1]), [String(s2), String(s2)]);
  const { naplo } = await tickel(t, s1 - 72 * ORA);
  assert.equal(naplo.filter((n) => /Három nap múlva/.test(n.targy)).length, 1);
});

test('B10 consent off = 0 marketing: hozzajarulas nelkul egyetlen marketing job sem jon letre es egy marketing uzenet sem megy ki (lemondas, no-show, felmeres, berlet, kezeles utan sem)', async () => {
  const t = await ujTeszt();
  const [k] = await kezelesek(t, { n: 1 });
  const lem = await foglal(t, { start: BASE + 30 * NAP, bookedAt: C0, now: C0 });
  await ingestBookingEvent(t.db, { externalId: lem.externalId, service: 'first_hair', start: BASE + 30 * NAP, status: 'cancelled', guest: VENDEG_A, eventAt: C0 + ORA, now: C0 + ORA });
  const cam = await foglal(t, { service: 'camera_assessment', start: BASE + 2 * NAP, bookedAt: C0, now: C0, vendeg: { nev: 'Teszt Bela', email: 'bela.teszt@example.com', telefon: '+36 20 333 4444' } });
  await igazolCompleted(t.db, { bookingId: cam.bookingId, staffId: t.staff.terapeuta, now: BASE + 2 * NAP + ORA });
  await pk.vasarol(t.db, { guestId: k.guestId, tipus: 'package_5', staffId: t.staff.recepcio, fizetesIdeje: C0, now: C0 });
  await outboxFeldolgoz(t.db, { most: BASE + 3 * NAP });
  const marketingJobok = (await jobok(t.db)).filter((j) => JSON.parse(j.payload).csoport === 'marketing');
  assert.equal(marketingJobok.length, 0, 'consent nelkul nincs marketing job');
  let osszes = [];
  for (const nap of [3, 5, 8, 15, 30, 60, 160, 200]) osszes = osszes.concat((await tickel(t, BASE + nap * NAP)).naplo);
  assert.equal(osszes.length > 0, true, 'a tranzakcios / care uzenetek mennek');
  assert.equal((await mind(t.db, 'SELECT template_key FROM message_ledger')).filter((r) => MARKETING.includes(r.template_key)).length, 0);
});

test('B10 a kuldes pillanataban visszavont consent (kozvetlen DB-ben, esemeny nelkul is) SKIPPED; a visszavonas utan beadott uj consent nem hoz vissza regi jobot', async () => {
  const t = await ujTeszt();
  const [k] = await kezelesek(t, { n: 1 });
  await mindenHozzajarulas(t, k.guestId, C0 - ORA);
  await outboxFeldolgoz(t.db, { most: C0 });
  await t.db.prepare('INSERT INTO consent_event (id, guest_id, channel, action, text_version, source, at) VALUES (?1, ?2, \'email_marketing\', \'withdrawn\', \'withdrawal\', \'unsubscribe_link\', ?3)').bind(crypto.randomUUID(), k.guestId, C0 + ORA).run();
  const { naplo } = await tickel(t, C0 + 48 * ORA, { konfig: { tickOutbox: false } });
  assert.equal(naplo.filter((n) => /Egyeztessük/.test(n.targy)).length, 0);
  assert.equal((await jobok(t.db, 'template_key = \'R1\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:email_unsubscribe');
  // jovobeli ujra-hozzajarulas: a mar lezart R1 nem indul ujra
  await cs.rogzit(t.db, { guestId: k.guestId, csatorna: 'email_marketing', szovegVerzio: 'v2', now: C0 + 3 * NAP });
  const { naplo: n2 } = await tickel(t, C0 + 4 * NAP);
  assert.equal(n2.filter((n) => /Egyeztessük/.test(n.targy)).length, 0);
});

// ---------------------------------------------------------------- C07 / C08: hianyzo dokumentacio
async function elsoKezelesKep(t) {
  const [k] = await kezelesek(t, { n: 1 });
  await mindenHozzajarulas(t, k.guestId, BASE);
  const [s] = await sessionok(t.db, k.guestId);
  await im.kepFeltolt(t.db, { sessionId: s.id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo });
  const plan = await elso(t.db, 'SELECT * FROM treatment_plan');
  return { k, s, plan };
}
const tervKesz = async (t, planId, now) => { await pl.ment(t.db, { planId, mezok: TERV(), staffId: t.staff.terapeuta, now }); await pl.veglegesit(t.db, { planId, staffId: t.staff.terapeuta, now }); };

test('C07 hianyzo kezeloi dokumentacio (motor): az ALTALANOS uzenetek (S0, G0, E3) mennek, a SZEMELYES (E2, P0) nem; a veglegesites utan a szemelyes is kimegy', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezelesKep(t);
  await outboxFeldolgoz(t.db, { most: C0 });
  let { naplo } = await tickel(t, C0 + 3 * ORA);
  assert.ok(naplo.some((n) => /Milyen volt/.test(n.targy)), 'S0 altalanos: megy');
  ({ naplo } = await tickel(t, C0 + 24 * ORA));
  assert.ok(naplo.some((n) => /Elmondod/.test(n.targy)), 'G0 altalanos: megy');
  ({ naplo } = await tickel(t, C0 + 3 * NAP));
  assert.equal(naplo.filter((n) => /Így ápold otthon/.test(n.targy)).length, 0, 'E2 szemelyes rutin nincs kesz dokumentacioval: nem megy');
  const e2 = (await jobok(t.db, 'template_key = \'E2\''))[0];
  assert.equal(e2.status, 'pending');
  assert.match(e2.stop_reason, /^BLOCKED_MISSING_DATA:content_not_ready/);
  ({ naplo } = await tickel(t, C0 + 7 * NAP));
  assert.ok(naplo.some((n) => n.csatorna === 'email'), 'E3 e-mail kiment');
  assert.equal((await jobok(t.db, 'template_key = \'E3\''))[0].status, 'dry_run', 'E3 altalanos: megy a hianyzo dokumentacio mellett is');
  // P0 nincs a dokumentacio veglegesitese elott; veglegesites -> plan.final -> P0 (a PDF-link forrasa konfig)
  assert.equal((await jobok(t.db, 'template_key = \'P0\'')).length, 0);
  await tervKesz(t, plan.id, C0 + 8 * NAP);
  await outboxFeldolgoz(t.db, { most: C0 + 8 * NAP });
  const p0 = (await jobok(t.db, 'template_key = \'P0\''))[0];
  assert.ok(p0);
  ({ naplo } = await tickel(t, C0 + 8 * NAP + 10, { konfig: { linkek: { a5Pdf: () => 'https://teszt.example/a5/x.pdf' } } }));
  const p0m = naplo.find((n) => /A te személyes terved/.test(n.targy));
  assert.ok(p0m, 'P0 a veglegesites utan kimegy');
  assert.match(p0m.szoveg, /Hajhullas, ritkulo fejtetoi resz/);
  assert.match(p0m.szoveg, /teszt\.example\/a5/);
});

test('C07 P0: ha a dokumentum a veglegesites utan ujra vazlat lesz, a szemelyes level nem megy (content_not_ready), amig nem kesz; A5 PDF-link forras nelkul BLOCKED', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezelesKep(t);
  await outboxFeldolgoz(t.db, { most: C0 });
  await tervKesz(t, plan.id, C0 + ORA);
  await outboxFeldolgoz(t.db, { most: C0 + ORA });
  await pl.ment(t.db, { planId: plan.id, mezok: { cel: 'Modositott cel' }, staffId: t.staff.terapeuta, now: C0 + 2 * ORA });   // vissza draftra
  let { naplo } = await tickel(t, C0 + 3 * ORA, { konfig: { linkek: { a5Pdf: () => 'https://teszt.example/a5/x.pdf' } } });
  assert.equal(naplo.filter((n) => /A te személyes terved/.test(n.targy)).length, 0);
  assert.match((await jobok(t.db, 'template_key = \'P0\''))[0].stop_reason, /^BLOCKED_MISSING_DATA:content_not_ready/);
  await pl.veglegesit(t.db, { planId: plan.id, staffId: t.staff.terapeuta, now: C0 + 4 * ORA });
  // link-forras nelkul: nem talalunk ki linket
  ({ naplo } = await tickel(t, C0 + 5 * ORA));
  assert.equal(naplo.filter((n) => /A te személyes terved/.test(n.targy)).length, 0);
  assert.match((await jobok(t.db, 'template_key = \'P0\''))[0].stop_reason, /^BLOCKED_MISSING_DATA:hianyzo:biztonsagos_a5_pdf_link/);
});

test('C07 a szemelyes dokumentum "sent" allapota CSAK valodi kezbesites utan all be (DRY_RUN nem jelol); a szolgaltatoi visszajelzes teszt-adapterrel', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezelesKep(t);
  await outboxFeldolgoz(t.db, { most: C0 });
  await tervKesz(t, plan.id, C0 + ORA);
  const linkek = { a5Pdf: () => 'https://teszt.example/a5/x.pdf' };
  await tickel(t, C0 + 2 * ORA, { konfig: { linkek } });   // dry
  assert.equal((await jobok(t.db, 'template_key = \'P0\''))[0].status, 'dry_run');
  assert.equal((await elso(t.db, 'SELECT status FROM treatment_plan')).status, 'therapist_final', 'DRY_RUN: a vendeg nem kapta meg');
  // ugyanez teszt-adapterrel, amely "kikuldve"-t jelez (nem valodi szolgaltato; a konfig tovabbra is dry)
  const t2 = await ujTeszt();
  const x = await elsoKezelesKep(t2);
  await outboxFeldolgoz(t2.db, { most: C0 });
  await tervKesz(t2, x.plan.id, C0 + ORA);
  const kuldott = { nev: 'teszt', async kuld() { return { allapot: 'SENT', szolgaltato_id: 'teszt-1' }; } };
  await tick(t2.db, { most: C0 + 2 * ORA, kuldo: kuldott, konfig: { kuldes: 'dry', linkek } });
  assert.equal((await jobok(t2.db, 'template_key = \'P0\''))[0].status, 'sent');
  assert.equal((await elso(t2.db, 'SELECT status FROM treatment_plan')).status, 'sent');
  assert.equal(await szamol(t2.db, 'outbox_event', "event_type = 'plan.sent'"), 1);
  assert.equal((await jobok(t2.db, 'template_key = \'E2\''))[0].status, 'pending', 'E2 nem jeloli a dokumentumot kuldottnek');
});

test('C08 hianyzo dokumentacio riasztasok: +24h a sajat kezelo (DOC24), +48h Janka (DOC48); nincs riasztas, ha a dokumentum idoben elkeszult', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezelesKep(t);
  await outboxFeldolgoz(t.db, { most: C0 });
  let { naplo } = await tickel(t, C0 + 23 * ORA);
  assert.equal(naplo.filter((n) => n.csatorna === 'internal').length, 0, '24 ora elott nincs riasztas');
  ({ naplo } = await tickel(t, C0 + 24 * ORA));
  const kezeloEmail = (await elso(t.db, 'SELECT email FROM staff_user WHERE id = ?1', t.staff.terapeuta)).email;
  const jankaEmail = (await elso(t.db, 'SELECT email FROM staff_user WHERE id = ?1', t.staff.janka)).email;
  const d24 = naplo.filter((n) => n.csatorna === 'internal');
  assert.equal(d24.length, 1);
  assert.equal(d24[0].cimzett.email, kezeloEmail);
  assert.match(d24[0].targy, /Hiányzó Oxygeni dokumentáció/);
  ({ naplo } = await tickel(t, C0 + 48 * ORA));
  const d48 = naplo.filter((n) => n.csatorna === 'internal');
  assert.equal(d48.length, 1, 'a DOC24 nem ismetlodik, a DOC48 Jankanak megy');
  assert.equal(d48[0].cimzett.email, jankaEmail);
  assert.match(d48[0].targy, /Eskaláció/);
  ({ naplo } = await tickel(t, C0 + 50 * ORA));
  assert.equal(naplo.filter((n) => n.csatorna === 'internal').length, 0, 'idempotens: nincs ujabb riasztas');
  assert.ok(plan.id);
});

test('C08 a DOC24 a kuldes pillanataban ujra ellenorzi a dokumentumot: ha idokozben elkeszult, SKIPPED', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezelesKep(t);
  await outboxFeldolgoz(t.db, { most: C0 });
  await karbantartas(t.db, { most: C0 + 24 * ORA });
  await outboxFeldolgoz(t.db, { most: C0 + 24 * ORA });
  assert.equal((await jobok(t.db, 'template_key = \'DOC24\'')).length, 1);
  await tervKesz(t, plan.id, C0 + 24 * ORA + 10);
  const { naplo } = await tickel(t, C0 + 24 * ORA + 20, { konfig: { tickOutbox: false } });
  assert.equal(naplo.filter((n) => n.csatorna === 'internal').length, 0);
  assert.equal((await jobok(t.db, 'template_key = \'DOC24\''))[0].stop_reason, 'SKIPPED_CONSENT_OR_STATE:documentation_complete');
});

test('C08 idoben elkeszult dokumentumra nincs riasztas', async () => {
  const t = await ujTeszt();
  const { plan } = await elsoKezelesKep(t);
  await outboxFeldolgoz(t.db, { most: C0 });
  await tervKesz(t, plan.id, C0 + 5 * ORA);
  await tickel(t, C0 + 49 * ORA);
  assert.equal(await szamol(t.db, 'message_job', "template_key IN ('DOC24', 'DOC48')"), 0);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type LIKE 'alert.doc%'"), 0);
});

// ---------------------------------------------------------------- E6: kontroll-kepek, 30 napos link
test('E6 (3. alkalom): csak kesz ertekeles + kepek + vegleges osszehasonlitas utan megy, a levelben 30 napos tokenes kep-link van', async () => {
  const t = await ujTeszt();
  const k = await kezelesek(t, { n: 3 });
  const guestId = k[0].guestId;
  await mindenHozzajarulas(t, guestId, BASE);
  const ss = await sessionok(t.db, guestId);
  const kep = {};
  for (const idx of [1, 3]) kep[idx] = (await im.kepFeltolt(t.db, { sessionId: ss.find((x) => x.treatment_index === idx).id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo })).imageId;
  const ido3 = BASE + 28 * NAP + 2 * ORA;
  await outboxFeldolgoz(t.db, { most: ido3 });
  let { naplo } = await tickel(t, ido3);
  assert.equal(naplo.filter((n) => /Három alkalom után/.test(n.targy)).length, 0, 'ertekeles / osszehasonlitas nelkul nem megy');
  assert.match((await jobok(t.db, 'template_key = \'E6\''))[0].stop_reason, /^BLOCKED_MISSING_DATA:content_not_ready/);
  const o = await im.osszehasonlit(t.db, { imageAId: kep[1], imageBId: kep[3], staffId: t.staff.terapeuta });
  await im.osszehasonlitVeglegesit(t.db, { comparisonId: o.comparisonId, staffId: t.staff.terapeuta, note: 'A kep jobb oldalan surubb a haj. A fejbor nyugodt.', now: ido3 + ORA });
  const plan = await elso(t.db, "SELECT id FROM treatment_plan WHERE kind = 'review' AND guest_id = ?1", guestId);
  await pl.ment(t.db, { planId: plan.id, mezok: { ertekeles: 'Javul a kep. A fejbor nyugodt.', otthoni_rutin_kontroll: 'A rutin megfelelo.' }, staffId: t.staff.terapeuta, now: ido3 + ORA });
  await pl.veglegesit(t.db, { planId: plan.id, staffId: t.staff.terapeuta, now: ido3 + 2 * ORA });
  ({ naplo } = await tickel(t, ido3 + 2 * ORA));   // plan.final -> a blokkolt E6 azonnal ujraprobal
  const e6 = naplo.find((n) => /Három alkalom után/.test(n.targy));
  assert.ok(e6, 'E6 kimegy');
  const m = /\/public\/kep\/([A-Za-z0-9_-]+)/.exec(e6.szoveg);
  assert.ok(m, 'tokenes kep-link');
  assert.match(e6.szoveg, /A kép jobb oldalán|A kep jobb oldalan sűrűbb|surubb/);
  const grant = await elso(t.db, 'SELECT * FROM share_grant');
  assert.equal(grant.expires_at - grant.issued_at, 30 * NAP);
  assert.equal(await szamol(t.db, 'share_grant'), 1);
  // E5 (2. alkalom) nincs kamera-link, jovahagyott kezeloi megjegyzes kell
  const e5 = (await jobok(t.db, 'template_key = \'E5\''))[0];
  assert.equal(e5.status, 'pending');
});

// ---------------------------------------------------------------- motor-infrastruktura
test('MOTOR szolgaltatoi hiba: backoff-pal ujraprobalja (ledger: failed), max probalkozas utan dead-letter; kezi ujrafuttatas utana sikerul', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  await outboxFeldolgoz(t.db, { most: BASE });
  const rossz = { nev: 'rossz', async kuld() { return { allapot: 'FAILED', szolgaltato_id: null, hiba: 'smtp 421', vegleges: false }; } };
  let most = BASE;
  const konfig = { kuldes: 'dry', maxProba: 3, backoffMp: [300, 900] };
  for (let i = 1; i <= 2; i++) {
    await tick(t.db, { most, kuldo: rossz, konfig });
    const j = (await jobok(t.db, 'template_key = \'T0-F\''))[0];
    assert.equal(j.status, 'pending');
    assert.equal(j.attempts, i);
    assert.equal(j.run_at, most + [300, 900][i - 1]);
    most = j.run_at;
  }
  const r = await tick(t.db, { most, kuldo: rossz, konfig });
  assert.equal(r.dead, 1);
  const j = (await jobok(t.db, 'template_key = \'T0-F\''))[0];
  assert.equal(j.status, 'dead');
  assert.equal(j.stop_reason, 'FAILED:dead_letter');
  assert.equal(await szamol(t.db, 'message_ledger', "outcome = 'failed' AND template_key = 'T0-F'"), 3);
  // dead job nem fut tovabb
  assert.equal((await tick(t.db, { most: most + NAP, kuldo: rossz, konfig })).claimelt, 0);
  // kezi ujrafuttatas
  assert.equal(await hibaKod(() => ujrafuttat(t.db, j.id, { most, staffId: t.staff.recepcio })), 'TILTOTT');
  const naplo = [];
  const u = await ujrafuttat(t.db, j.id, { most: most + NAP, staffId: t.staff.marketing, kuldo: dryRunAdapter({ naplo }), konfig });
  assert.equal(u.eredmeny, 'dry_run');
  assert.equal(naplo.length, 1);
  assert.equal(await hibaKod(() => ujrafuttat(t.db, j.id, { most })), 'NEM_UJRAFUTTATHATO');
  assert.equal(await szamol(t.db, 'security_audit', "action = 'message.rerun'"), 1);
});

test('MOTOR vegleges (nem ujraprobalhato) szolgaltatoi hiba azonnal dead-letter', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  const vegleges = { nev: 'v', async kuld() { return { allapot: 'FAILED', hiba: 'ervenytelen cim', vegleges: true }; } };
  const r = await tick(t.db, { most: BASE, kuldo: vegleges, konfig: { kuldes: 'dry' } });
  assert.equal(r.dead, 1);
});

test('MOTOR valodi kuldes SOHA nem megy dry konfiggal: az eles adapter nem hivja a szolgaltatot, a job dry_run', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  let hivasok = 0;
  const kuldokGyar = () => { hivasok += 1; return { async email() { hivasok += 100; return { id: 'x' }; }, async sms() { hivasok += 100; return { id: 'x' }; }, async lezar() {} }; };
  const naplo = [];
  const eles = elesAdapterKeszit({ env: {}, konfig: { kuldes: 'dry' }, kuldokGyar, tartalek: dryRunAdapter({ naplo }) });
  const r = await tick(t.db, { most: BASE, kuldo: eles, konfig: { kuldes: 'dry' } });
  assert.equal(r.dry_run, 1);
  assert.equal(hivasok, 0);
  assert.equal(naplo.length, 1);
  assert.equal((await jobok(t.db, 'template_key = \'T0-F\''))[0].status, 'dry_run');
});

test('MOTOR teszt-cimzett szabaly: konfig.csakTesztCimzettek eseten mas cimzett SANDBOX_ONLY, a listazott kimegy (dry); .invalid cim mindig sandbox', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  let { naplo } = await tickel(t, BASE, { konfig: { csakTesztCimzettek: ['masvalaki@example.com'] } });
  assert.equal(naplo.length, 0);
  const j = (await jobok(t.db, 'template_key = \'T0-F\''))[0];
  assert.equal(j.status, 'skipped');
  assert.equal(j.stop_reason, 'SANDBOX_ONLY:sandbox_data');
  // listazott cimzett (kis-nagybetu fuggetlen)
  const t2 = await ujTeszt();
  await foglal(t2, { start: BASE + 7 * NAP });
  ({ naplo } = await tickel(t2, BASE, { konfig: { csakTesztCimzettek: ['ANNA.TESZT@example.com'] } }));
  assert.equal(naplo.length, 1);
  // .invalid (demo) cim: konfig nelkul is sandbox
  const t3 = await ujTeszt();
  await foglal(t3, { start: BASE + 7 * NAP, vendeg: { nev: 'Demo Anna', email: 'demo.anna@example.invalid', telefon: '06 1 555 0101' } });
  ({ naplo } = await tickel(t3, BASE));
  assert.equal(naplo.length, 0);
  assert.equal((await jobok(t3.db, 'template_key = \'T0-F\''))[0].stop_reason, 'SANDBOX_ONLY:sandbox_data');
});

test('MOTOR T0 jovahagyott kerdoivvel a levélben tokenes allapotfelmero-link van (jelzes nelkul); mar kitoltott kerdoiv eseten a T-72 link nelkul megy', async () => {
  const t = await ujTeszt();
  await kerdoivBeallit(t);
  await foglal(t, { start: BASE + 7 * NAP });
  await outboxFeldolgoz(t.db, { most: BASE });
  const { naplo } = await tickel(t, BASE);
  assert.match(naplo[0].szoveg, /\/public\/felmero\/[A-Za-z0-9_-]+/);
  assert.equal(JSON.parse((await jobok(t.db, 'template_key = \'T0-F\''))[0].payload).jelzes, undefined);
  assert.equal(await szamol(t.db, 'assessment_submission', "status = 'issued'"), 1);
});

test('MOTOR elakadt (claimed) job egy ido utan visszakerul pending-be es lefut; ismeretlen sablon blocked', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  await outboxFeldolgoz(t.db, { most: BASE });
  await t.db.prepare('UPDATE message_job SET status = \'claimed\', claimed_at = ?1, claimed_by = \'halott\' WHERE template_key = \'T0-F\'').bind(BASE - 3600).run();
  const { r, naplo } = await tickel(t, BASE);
  assert.equal(r.karbantartas.visszaallitott_claim, 1);
  assert.equal(naplo.length, 1);
  await t.db.prepare('INSERT INTO message_job (id, guest_id, template_key, template_version, channel, context_id, idempotency_key, status, run_at, attempts, payload, created_at) SELECT \'x1\', guest_id, \'ZZZ\', 1, \'email\', \'c\', \'k-zzz\', \'pending\', ?1, 0, \'{}\', ?1 FROM message_job LIMIT 1').bind(BASE).run();
  await tickel(t, BASE + 10);
  assert.equal((await elso(t.db, 'SELECT * FROM message_job WHERE id = \'x1\'')).status, 'blocked');
});

test('MOTOR minden iras auditalt: az outbox-feldolgozas es a kuldes eredmenye security_audit sort kap, szemelyes adat nelkul', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  await tickel(t, BASE);
  assert.ok(await szamol(t.db, 'security_audit', "action = 'outbox.processed'") >= 1);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'message.dry_run'"), 1);
  const nyers = JSON.stringify(await mind(t.db, 'SELECT detail FROM security_audit'));
  assert.ok(!/anna\.teszt|Teszt Anna|\+36/.test(nyers), 'az audit nem tartalmaz szemelyes adatot');
});

test('MOTOR elonezet (API): a vendeg aktualis allapota szerinti kapu-dontessel, token-letrehozas NELKUL; szemelyes tartalom csak a dokumentaciot olvasni jogosultnak', async () => {
  const t = await ujTeszt();
  await kerdoivBeallit(t);
  const { plan, k } = await elsoKezelesKep(t);
  const f = await foglal(t, { service: 'followup_hair', start: C0 + 14 * NAP, bookedAt: C0, now: C0 });
  const e = await elonezet(t.db, { templateKey: 'T-72', guestId: k.guestId, bookingId: f.bookingId, most: C0 + 10 * NAP });
  assert.equal(e.allapot, 'OK');
  assert.equal(e.kapu.dontes, 'mehet');
  assert.match(e.targy, /Három nap múlva/);
  assert.match(e.html, /várunk a MOSAIC-ban/);
  assert.match(e.szoveg, /ELONEZET-TOKEN/, 'az elonezet helyorzo-tokent hasznal');
  assert.equal(await szamol(t.db, 'assessment_submission'), 0, 'az elonezet nem hoz letre kerdoiv-tokent');
  assert.equal(await szamol(t.db, 'message_job'), 0);
  // marketing sablon consent nelkul: a kapu "kihagy" + ok
  const r1 = await elonezet(t.db, { templateKey: 'R1', guestId: k.guestId, most: C0 + 10 * NAP });
  assert.equal(r1.kapu.dontes, 'mehet', 'a fixture-ben van consent');
  await t.db.prepare('INSERT INTO consent_event (id, guest_id, channel, action, text_version, source, at) VALUES (?1, ?2, \'email_marketing\', \'withdrawn\', \'withdrawal\', \'x\', ?3)').bind(crypto.randomUUID(), k.guestId, C0 + 5 * NAP).run();
  const r2 = await elonezet(t.db, { templateKey: 'R1', guestId: k.guestId, most: C0 + 10 * NAP });
  assert.deepEqual([r2.kapu.dontes, r2.kapu.eredmeny], ['kihagy', 'SKIPPED_CONSENT_OR_STATE']);
  // szemelyes (P0): staffId nelkul / recepcio: redacted; kezelo: latja
  await tervKesz(t, plan.id, C0 + ORA);
  const p0 = { templateKey: 'P0', guestId: k.guestId, most: C0 + 2 * ORA, konfig: { linkek: { a5Pdf: () => 'https://teszt.example/a5/x.pdf' } } };
  const rejtett = await elonezet(t.db, p0);
  assert.deepEqual([rejtett.redacted, rejtett.html, rejtett.szoveg, rejtett.targy], [true, null, null, null]);
  assert.equal((await elonezet(t.db, { ...p0, staffId: t.staff.recepcio })).redacted, true);
  const lathato = await elonezet(t.db, { ...p0, staffId: t.staff.terapeuta });
  assert.equal(lathato.redacted, false);
  assert.match(lathato.szoveg, /Hajhullas, ritkulo fejtetoi resz/);
  assert.equal(await hibaKod(() => elonezet(t.db, { templateKey: 'ZZZ', guestId: k.guestId })), 'ISMERETLEN_SABLON');
  assert.equal(await hibaKod(() => elonezet(t.db, { templateKey: 'T-72', guestId: crypto.randomUUID() })), 'NINCS_VENDEG');
});

test('MOTOR sandbox-proba (API): a munkatars SAJAT cimere, DRY_RUN adapterrel - konfigtol (akar eles env-tol) fuggetlenul SOHA valodi kuldes; ledger-sor job nelkul', async () => {
  const t = await ujTeszt();
  const [k] = await kezelesek(t, { n: 1 });
  const r = await sandboxProba(t.db, { templateKey: 'G0', guestId: k.guestId, staffId: t.staff.marketing, most: C0 + NAP, env: { CRM_KULDES: 'eles' } });
  assert.deepEqual([r.eredmeny, r.valos_kuldes], ['DRY_RUN', false]);
  const l = await elso(t.db, 'SELECT * FROM message_ledger');
  assert.deepEqual([l.job_id, l.outcome, l.stop_reason, l.template_key], [null, 'dry_run', 'SANDBOX_TRIAL', 'G0']);
  assert.equal(await szamol(t.db, 'message_job'), 0);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'message.sandbox_trial'"), 1);
  // szemelyes tartalmu sablon: a dokumentaciot nem olvasni jogosult munkatars nem probalhatja
  assert.equal(await hibaKod(() => sandboxProba(t.db, { templateKey: 'E2', guestId: k.guestId, staffId: t.staff.marketing, most: C0 + NAP })), 'TILTOTT');
  assert.equal(await hibaKod(() => sandboxProba(t.db, { templateKey: 'G0', guestId: k.guestId, most: C0 + NAP })), 'TILTOTT');
  // hianyzo adat: nem kuldheto, de nem is dob
  const e2 = await sandboxProba(t.db, { templateKey: 'E2', guestId: k.guestId, staffId: t.staff.terapeuta, most: C0 + NAP });
  assert.ok(['NEM_KULDHETO', 'DRY_RUN'].includes(e2.eredmeny));
});

test('MOTOR tick env-bol (API: tick(db, {now, env, tarolo})): CRM_KULDES nelkul DRY, CRM_TESZT_CIMZETTEK lista eseten mas cimzett SANDBOX_ONLY; a now a most aliasa', async () => {
  const e0 = motorKonfigEnvbol({});
  assert.equal(e0.kuldes, 'dry');
  assert.equal(e0.linkek.leiratkozas({ guest: { id: 'g1' } }), null, 'CRM_TITOK nelkul nincs leiratkozasi link');
  const e1 = motorKonfigEnvbol({ CRM_KULDES: 'bármi', CRM_TESZT_CIMZETTEK: 'a@example.com, +36301112222', CRM_TITOK: 'teszt-titok-teszt-titok-1234' });
  assert.deepEqual([e1.kuldes, e1.csakTesztCimzettek], ['dry', ['a@example.com', '+36301112222']]);
  assert.match(e1.linkek.leiratkozas({ guest: { id: 'g1' } }), /^https:\/\/www\.mosaicheadspa\.hu\/api\/crm\/public\/leiratkozas\/g1\./);
  assert.equal(motorKonfigEnvbol({ CRM_KULDES: 'eles' }).kuldes, 'eles');   // csak ertelmezes: a teszt nem inditja a valodi kuldest
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  const r = await tick(t.db, { now: BASE, env: { CRM_TESZT_CIMZETTEK: 'masvalaki@example.com' }, tarolo: t.tarolo });
  assert.equal(r.sandbox, 1);
  const t2 = await ujTeszt();
  await foglal(t2, { start: BASE + 7 * NAP });
  const r2 = await tick(t2.db, { now: BASE, env: {} });
  assert.equal(r2.dry_run, 1);
  assert.equal((await jobok(t2.db, 'template_key = \'T0-F\''))[0].status, 'dry_run');
});

test('MOTOR ujrafuttat objektum-alakban is hivhato (API: ujrafuttat(db, {jobId, staffId, now, env}))', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  const rossz = { nev: 'rossz', async kuld() { return { allapot: 'FAILED', hiba: 'x', vegleges: true }; } };
  await tick(t.db, { most: BASE, kuldo: rossz, konfig: { kuldes: 'dry' } });
  const j = (await jobok(t.db, 'template_key = \'T0-F\''))[0];
  assert.equal(j.status, 'dead');
  const u = await ujrafuttat(t.db, { jobId: j.id, staffId: t.staff.admin, now: BASE + 60, env: {} });
  assert.equal(u.eredmeny, 'dry_run');
});
