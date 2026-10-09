// Mutatok (spec 3.11) tesztek: kohorsz-ervenyesites (nem korai szamlalas), nincs becsult retencio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, mind, elso, szamol, BASE, NAP, VENDEG_A, VENDEG_B } from './fixtures.js';
import { merok, ERES } from '../lib/merok.js';
import { tick, outboxFeldolgoz } from '../lib/motor.js';
import { dryRunAdapter } from '../lib/messages/kuldo.js';
import { igazolCompleted, ingestBookingEvent } from '../lib/booking.js';
import * as cs from '../lib/consent.js';
import * as cp from '../lib/complaint.js';
import * as pk from '../lib/package.js';
import * as cr from '../lib/credit.js';
import * as pl from '../lib/plan.js';

const ORA = 3600;
const VENDEG_C = { nev: 'Teszt Cili', email: 'cili.teszt@example.com', telefon: '+36 30 555 6666' };
const VENDEG_D = { nev: 'Teszt Dora', email: 'dora.teszt@example.com', telefon: '+36 30 777 8888' };

/** vendeg n kezelese 14 naponkent: foglalas + kezelo-igazolas (start + 2 ora); a kezelo neve szerint */
async function kezeles(t, { vendeg = VENDEG_A, n = 1, kezdet = BASE, kezelo = 'Kata', staffId = t.staff.terapeuta } = {}) {
  const ki = [];
  for (let i = 1; i <= n; i++) {
    const start = kezdet + (i - 1) * 14 * NAP;
    const r = await foglal(t, { service: i === 1 ? 'first_hair' : 'followup_hair', start, vendeg, kezelo, bookedAt: start - 3 * NAP, now: start - 3 * NAP });
    const c = await igazolCompleted(t.db, { bookingId: r.bookingId, staffId, now: start + 2 * ORA });
    ki.push({ ...r, ...c });
  }
  return ki;
}
const T1 = 0, IG = BASE + 400 * NAP;

test('MEROK R2/R5/R10/R11 kohorsz-ervenyesites: csak az erett vendegek szamitanak; ha a kohorsz nem ert meg: ertek null + kohorsz_nem_ert_meg (nincs becsles)', async () => {
  const t = await ujTeszt();
  await kezeles(t, { vendeg: VENDEG_A, n: 11 });
  await kezeles(t, { vendeg: VENDEG_B, n: 3 });
  await kezeles(t, { vendeg: VENDEG_C, n: 1 });
  // korai megfigyeles (10 nap): semelyik R-mutato nem szamolhato - akkor sem, ha a DB-ben mar vannak (kesobbi) alkalmak
  let m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 10 * NAP });
  for (const r of ['R2', 'R5', 'R10', 'R11']) assert.deepEqual([m[r].ertek, m[r].ok], [null, 'kohorsz_nem_ert_meg'], r);
  assert.equal(m.SHOW1.ertek, 3);
  // 100 nap: R2 (21 nap) es R5 (84 nap) ert, R10 (189 nap) es R11 (210 nap) nem
  m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 100 * NAP });
  assert.deepEqual([m.R2.szamlalo, m.R2.nevezo, m.R2.ok], [2, 3, 'ok']);
  assert.ok(Math.abs(m.R2.ertek - 2 / 3) < 1e-9);
  assert.deepEqual([m.R5.szamlalo, m.R5.nevezo], [1, 3]);
  assert.deepEqual([m.R10.ertek, m.R10.ok, m.R10.nem_ert_meg], [null, 'kohorsz_nem_ert_meg', 3]);
  assert.equal(m.R11.ertek, null);
  // 300 nap: minden ert; csak a 11 kezelest teljesito vendeg szamit R11-nek
  m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 300 * NAP });
  assert.deepEqual([m.R10.szamlalo, m.R10.nevezo], [1, 3]);
  assert.deepEqual([m.R11.szamlalo, m.R11.nevezo, m.R11.eres_nap], [1, 3, 210]);
  assert.equal(ERES.ritmus_nap, 14);
});

test('MEROK vegyes kohorsz: a mar erett vendeg szamit, a meg nem erett nem (kulonbozo elso-kezeles idoponttal)', async () => {
  const t = await ujTeszt();
  await kezeles(t, { vendeg: VENDEG_A, n: 2, kezdet: BASE });
  await kezeles(t, { vendeg: VENDEG_B, n: 1, kezdet: BASE + 90 * NAP });
  // most = BASE + 100: A erett R2-re (21 nap mulva), B (10 napja kezdte) nem
  const m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 100 * NAP });
  assert.deepEqual([m.R2.kohorsz, m.R2.ert, m.R2.nem_ert_meg, m.R2.szamlalo, m.R2.nevezo, m.R2.ertek], [2, 1, 1, 1, 1, 1]);
});

test('MEROK szakmai okbol zart kura: a nevezoben marad, kulon jelolve', async () => {
  const t = await ujTeszt();
  const [k] = await kezeles(t, { vendeg: VENDEG_A, n: 1 });
  const { egyeniLezaras } = await import('../lib/course.js');
  await egyeniLezaras(t.db, { courseId: k.courseId, staffId: t.staff.terapeuta, ok: 'szakmai megszakitas', now: BASE + 5 * NAP });
  const m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 100 * NAP });
  assert.deepEqual([m.R2.szamlalo, m.R2.nevezo, m.R2.szakmai_zart_az_erettek_kozt], [0, 1, 1]);
});

test('MEROK BOOK_FIRST / SHOW1 / SHOW_RATE: elso foglalasok duplikacio nelkul; a nevezoben a lemondott nem szerepel, az igazolatlan elmult foglalas igen (figyelmeztetessel)', async () => {
  const t = await ujTeszt();
  await kezeles(t, { vendeg: VENDEG_A, n: 1 });                                        // megjelent
  const nos = await foglal(t, { start: BASE + 2 * NAP, vendeg: VENDEG_B, bookedAt: BASE, now: BASE });   // no-show
  await ingestBookingEvent(t.db, { externalId: nos.externalId, service: 'first_hair', start: BASE + 2 * NAP, status: 'no_show', guest: VENDEG_B, eventAt: BASE + 3 * NAP, now: BASE + 3 * NAP });
  const lem = await foglal(t, { start: BASE + 3 * NAP, vendeg: VENDEG_C, bookedAt: BASE, now: BASE });   // lemondott
  await ingestBookingEvent(t.db, { externalId: lem.externalId, service: 'first_hair', start: BASE + 3 * NAP, status: 'cancelled', guest: VENDEG_C, eventAt: BASE + NAP, now: BASE + NAP });
  await foglal(t, { start: BASE + 4 * NAP, vendeg: VENDEG_D, bookedAt: BASE, now: BASE });                // idopont elmult, nincs igazolas
  await foglal(t, { start: BASE + 60 * NAP, vendeg: { nev: 'Teszt Eva', email: 'eva.teszt@example.com', telefon: '+36 30 999 0000' }, bookedAt: BASE, now: BASE });   // jovobeli: meg nem esedekes
  const m = await merok(t.db, { tol: BASE - NAP, ig: BASE + 30 * NAP, most: BASE + 10 * NAP });
  assert.equal(m.BOOK_FIRST.ertek, 4, 'B, C, D, E: az A foglalasa az ablak elott (BASE-3 nap) tortent');
  assert.equal(m.SHOW1.ertek, 1);
  assert.deepEqual([m.SHOW_RATE.szamlalo, m.SHOW_RATE.nevezo], [1, 3]);
  assert.deepEqual(m.SHOW_RATE.nevezo_reszletek, { teljesitett: 1, no_show: 1, igazolatlan: 1, lemondott_kihagyva: 1, athelyezett_db: 0 });
  assert.match(m.SHOW_RATE.figyelmeztetes, /IGAZOLATLAN/);
});

test('MEROK NEXT_BOOKED_ON_SITE: csak a kezeles napjan, a kezeles utan rogzitett, elo (nem szintetikus) Salonic ID-s kovetkezo foglalas szamit', async () => {
  const t = await ujTeszt();
  const [a] = await kezeles(t, { vendeg: VENDEG_A, n: 1 });
  const [b] = await kezeles(t, { vendeg: VENDEG_B, n: 1 });
  const [c] = await kezeles(t, { vendeg: VENDEG_C, n: 1 });
  // A: a kezelo a helyszinen foglalt (a kezeles napjan, kezdet utan), elo azonositoval
  await foglal(t, { service: 'followup_hair', start: BASE + 14 * NAP, vendeg: VENDEG_A, externalId: 'elo-1', bookedAt: BASE + ORA, now: BASE + ORA });
  // B: korabban lefoglalt kovetkezo kezeles (nem a helyszinen) - nem szamit
  // C: szintetikus azonositoju - nem szamit
  await foglal(t, { service: 'followup_hair', start: BASE + 14 * NAP, vendeg: VENDEG_C, externalId: 'szint-abc', bookedAt: BASE + ORA, now: BASE + ORA });
  const m = await merok(t.db, { tol: T1, ig: BASE + 10 * NAP, most: BASE + 10 * NAP });
  assert.deepEqual([m.NEXT_BOOKED_ON_SITE.szamlalo, m.NEXT_BOOKED_ON_SITE.nevezo], [1, 3]);
  assert.ok(a.bookingId && b.bookingId && c.bookingId);
});

test('MEROK PACKAGE_RATE_5 / 10: az elso kezelest teljesito kohorszbol a vasarlok; az elore vasarlas kulon', async () => {
  const t = await ujTeszt();
  const [a] = await kezeles(t, { vendeg: VENDEG_A, n: 1 });
  const [b] = await kezeles(t, { vendeg: VENDEG_B, n: 1 });
  await kezeles(t, { vendeg: VENDEG_C, n: 1 });
  await pk.vasarol(t.db, { guestId: a.guestId, tipus: 'package_5', staffId: t.staff.recepcio, fizetesIdeje: BASE, now: BASE });                 // az 1. kezeles napjan = elore
  await pk.vasarol(t.db, { guestId: b.guestId, tipus: 'package_10', staffId: t.staff.recepcio, fizetesIdeje: BASE + 3 * NAP, now: BASE + 3 * NAP });   // kezeles utan
  const m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 10 * NAP });
  assert.deepEqual([m.PACKAGE_RATE_5.szamlalo, m.PACKAGE_RATE_5.nevezo, m.PACKAGE_RATE_5.elore_vasarlok, m.PACKAGE_RATE_5.kezeles_utan_vasarlok], [1, 3, 1, 0]);
  assert.deepEqual([m.PACKAGE_RATE_10.szamlalo, m.PACKAGE_RATE_10.elore_vasarlok, m.PACKAGE_RATE_10.kezeles_utan_vasarlok], [1, 0, 1]);
  assert.ok(Math.abs(m.PACKAGE_RATE_10.ertek - 1 / 3) < 1e-9);
});

test('MEROK ASSESS_TO_FIRST (csak az erett felmeresek) es CREDIT_REDEEM (kezi levonas, nem a jogosultsag)', async () => {
  const t = await ujTeszt();
  const cam = async (vendeg, start) => { const f = await foglal(t, { service: 'camera_assessment', start, vendeg, bookedAt: start - NAP, now: start - NAP }); await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta, now: start + ORA }); return f; };
  const a = await cam(VENDEG_A, BASE);
  const b = await cam(VENDEG_B, BASE + ORA);
  const fa = await foglal(t, { service: 'first_hair', start: BASE + 10 * NAP, vendeg: VENDEG_A, bookedAt: BASE + 2 * ORA, now: BASE + 2 * ORA });   // A: 30 napon belul foglalt
  await foglal(t, { service: 'first_hair', start: BASE + 12 * NAP, vendeg: VENDEG_C, bookedAt: BASE + 2 * ORA, now: BASE + 2 * ORA });             // nem felmeres-vendeg
  // nem ert meg (10 nap): az ablak (30 nap) nem zarult le
  let m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 10 * NAP });
  assert.deepEqual([m.ASSESS_TO_FIRST.ertek, m.ASSESS_TO_FIRST.ok, m.ASSESS_TO_FIRST.felmeres_db], [null, 'kohorsz_nem_ert_meg', 2]);
  m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 45 * NAP });
  assert.deepEqual([m.ASSESS_TO_FIRST.szamlalo, m.ASSESS_TO_FIRST.nevezo, m.ASSESS_TO_FIRST.ok], [1, 2, 'ok']);
  // credit: A jogosult (eligible), de a levonas meg nem tortent -> 0 / 1
  assert.deepEqual([m.CREDIT_REDEEM.szamlalo, m.CREDIT_REDEEM.nevezo], [0, 1]);
  const c = await elso(t.db, 'SELECT * FROM assessment_credit WHERE guest_id = ?1', a.guestId);
  assert.equal(c.status, 'eligible');
  await cr.jelolLevonas(t.db, { creditId: c.id, bookingId: fa.bookingId, staffId: t.staff.recepcio, now: BASE + 10 * NAP });
  m = await merok(t.db, { tol: T1, ig: IG, most: BASE + 45 * NAP });
  assert.deepEqual([m.CREDIT_REDEEM.szamlalo, m.CREDIT_REDEEM.nevezo, m.CREDIT_REDEEM.ertek], [1, 1, 1]);
  assert.ok(b.bookingId);
});

test('MEROK CONSENT_EMAIL / CONSENT_SMS: jelenlegi allapot (granted / visszavont), CONSENT nem elofeltetel', async () => {
  const t = await ujTeszt();
  const [a] = await kezeles(t, { vendeg: VENDEG_A, n: 1 });
  const [b] = await kezeles(t, { vendeg: VENDEG_B, n: 1 });
  await kezeles(t, { vendeg: VENDEG_C, n: 1 });
  await cs.rogzit(t.db, { guestId: a.guestId, csatorna: 'email_marketing', szovegVerzio: 'v1', now: BASE });
  await cs.rogzit(t.db, { guestId: b.guestId, csatorna: 'email_marketing', szovegVerzio: 'v1', now: BASE });
  await cs.visszavon(t.db, { guestId: b.guestId, csatorna: 'email_marketing', now: BASE + ORA });
  await cs.rogzit(t.db, { guestId: a.guestId, csatorna: 'sms_marketing', szovegVerzio: 'v1', now: BASE });
  const m = await merok(t.db, { tol: 0, ig: IG, most: BASE + 10 * NAP });
  assert.deepEqual([m.CONSENT_EMAIL.szamlalo, m.CONSENT_EMAIL.nevezo, m.CONSENT_EMAIL.visszavont], [1, 3, 1]);
  assert.deepEqual([m.CONSENT_SMS.szamlalo, m.CONSENT_SMS.nevezo], [1, 3]);
});

test('MEROK MESSAGE_DELIVERY: dry-run fazisban null + csak_dry_run, a valos kuldes utan kikuldve / (kikuldve + hibas)', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP });
  await tick(t.db, { most: BASE, kuldo: dryRunAdapter(), konfig: { kuldes: 'dry' } });
  let m = await merok(t.db, { tol: 0, ig: IG, most: BASE + NAP });
  assert.deepEqual([m.MESSAGE_DELIVERY.ertek, m.MESSAGE_DELIVERY.ok, m.MESSAGE_DELIVERY.dry_run], [null, 'csak_dry_run', 1]);
  // teszt-adapter: az egyik uzenet "kikuldve", a masik veglegesen hibas (a ketto kozul a szolgaltato visszajelzese)
  let sorszam = 0;
  const vegyes = { nev: 'teszt', async kuld() { sorszam += 1; return sorszam === 1 ? { allapot: 'SENT', szolgaltato_id: 'teszt-1' } : { allapot: 'FAILED', hiba: 'teszt', vegleges: true }; } };
  await tick(t.db, { most: BASE + 4 * NAP, kuldo: vegyes, konfig: { kuldes: 'dry' } });   // T-72
  await tick(t.db, { most: BASE + 6 * NAP, kuldo: vegyes, konfig: { kuldes: 'dry' } });   // T-24
  m = await merok(t.db, { tol: 0, ig: IG, most: BASE + 8 * NAP });
  assert.deepEqual([m.MESSAGE_DELIVERY.kikuldve, m.MESSAGE_DELIVERY.hibas, m.MESSAGE_DELIVERY.szamlalo, m.MESSAGE_DELIVERY.nevezo, m.MESSAGE_DELIVERY.ertek], [1, 1, 1, 2, 0.5]);
});

test('MEROK COMPLAINT_RESOLUTION_24H: csak az erett (lezart vagy lejart hataridoju) panaszok; DOC_COMPLETION_24H: idoben veglegesitett / erett dokumentumok', async () => {
  const t = await ujTeszt();
  const [a] = await kezeles(t, { vendeg: VENDEG_A, n: 1 });
  const [b] = await kezeles(t, { vendeg: VENDEG_B, n: 1 });
  const [c] = await kezeles(t, { vendeg: VENDEG_C, n: 1 });
  const nyit = async (g, now) => (await cp.panaszNyit(t.db, { guestId: g, kezeloId: t.staff.terapeuta, staffId: t.staff.terapeuta, now })).complaintId;
  const p1 = await nyit(a.guestId, BASE + 5 * NAP);   // gyorsan lezarva
  const p2 = await nyit(b.guestId, BASE + 5 * NAP);   // kesve lezarva
  await nyit(c.guestId, BASE + 20 * NAP);              // meg nem esedekes (nyitott)
  for (const [id, mikor] of [[p1, BASE + 5 * NAP + 5 * ORA], [p2, BASE + 8 * NAP]]) {
    await cp.probalkozas(t.db, { complaintId: id, staffId: t.staff.terapeuta, tipus: 'call', eredmeny: 'reached', now: mikor - ORA });
    await cp.lezar(t.db, { complaintId: id, staffId: t.staff.terapeuta, megoldas: 'Rendezve', vendegElegedett: true, now: mikor });
  }
  let m = await merok(t.db, { tol: 0, ig: IG, most: BASE + 20 * NAP + ORA });
  assert.deepEqual([m.COMPLAINT_RESOLUTION_24H.szamlalo, m.COMPLAINT_RESOLUTION_24H.nevezo, m.COMPLAINT_RESOLUTION_24H.osszes, m.COMPLAINT_RESOLUTION_24H.nyitott], [1, 2, 3, 1]);
  // dokumentacio: A idoben (24 oran belul) kesz, B kesve, C nem kesz es lejart
  const terv = (g) => elso(t.db, 'SELECT * FROM treatment_plan WHERE guest_id = ?1', g);
  const mezok = { fo_panasz: 'Hajhullas', megfigyelesek: ['ritkulo'], cel: 'Cel', teljes_kura_11: true, ritmus_nap: 14, otthoni_apolas: { termek: 'Sampon', hasznalat: 'hetente' }, kezeloi_javaslat: 'Elso mondat. Masodik mondat.', kovetkezo_idopont: { javasolt_intervallum: '2 het' } };
  const pa = await terv(a.guestId), pb = await terv(b.guestId);
  await pl.ment(t.db, { planId: pa.id, mezok, staffId: t.staff.terapeuta, now: pa.created_at + ORA });
  await pl.veglegesit(t.db, { planId: pa.id, staffId: t.staff.terapeuta, now: pa.created_at + 2 * ORA });
  await pl.ment(t.db, { planId: pb.id, mezok, staffId: t.staff.terapeuta, now: pb.created_at + 30 * ORA });
  await pl.veglegesit(t.db, { planId: pb.id, staffId: t.staff.terapeuta, now: pb.created_at + 30 * ORA });
  m = await merok(t.db, { tol: 0, ig: IG, most: BASE + 30 * NAP });
  assert.deepEqual([m.DOC_COMPLETION_24H.szamlalo, m.DOC_COMPLETION_24H.nevezo], [1, 3]);
});

test('MEROK SALONIC_SYNC_LATENCY (esemeny -> feldolgozas keses) es MERGE_REVIEW_PENDING (fuggo osszevonasi keresek)', async () => {
  const t = await ujTeszt();
  await foglal(t, { start: BASE + 7 * NAP, eventAt: BASE - 30, now: BASE });
  await foglal(t, { start: BASE + 8 * NAP, vendeg: VENDEG_B, eventAt: BASE - 90, now: BASE });
  // azonos e-mail, mas telefon: bizonytalan, kezi osszevonasi keres
  await foglal(t, { start: BASE + 9 * NAP, vendeg: { ...VENDEG_A, telefon: '+36 30 000 1111' }, externalId: 'masik-1', guestExternalId: 'ext-masik' });
  const m = await merok(t.db, { tol: 0, ig: IG, most: BASE + 2 * NAP });
  assert.deepEqual([m.SALONIC_SYNC_LATENCY.db >= 2, m.SALONIC_SYNC_LATENCY.max_mp >= 90, m.SALONIC_SYNC_LATENCY.utolso_szinkron], [true, true, null]);
  assert.equal(m.MERGE_REVIEW_PENDING.ertek, 1);
  assert.equal(m.MERGE_REVIEW_PENDING.legregebbi_nap, 2);
});

test('MEROK kezelo-szures es kezelo_bontas: kezelonkent kulon kohorsz; kampany_bontas: nincs forras-adat', async () => {
  const t = await ujTeszt();
  await kezeles(t, { vendeg: VENDEG_A, n: 2, kezelo: 'Kata', staffId: t.staff.terapeuta });
  await kezeles(t, { vendeg: VENDEG_B, n: 1, kezelo: 'Zita', staffId: t.staff.terapeuta2 });
  const o = await merok(t.db, { tol: 0, ig: IG, most: BASE + 100 * NAP });
  assert.equal(o.SHOW1.ertek, 2);
  assert.equal(o.kezelo_bontas.length, 2);
  assert.deepEqual(o.kezelo_bontas.map((k) => [k.nev, k.SHOW1]).sort(), [['Kezelo Kata', 1], ['Kezelo Zita', 1]]);
  const kata = await merok(t.db, { tol: 0, ig: IG, kezeloId: t.staff.terapeuta, most: BASE + 100 * NAP });
  assert.equal(kata.SHOW1.ertek, 1);
  assert.deepEqual([kata.R2.szamlalo, kata.R2.nevezo], [1, 1]);
  const zita = await merok(t.db, { tol: 0, ig: IG, kezeloId: t.staff.terapeuta2, most: BASE + 100 * NAP });
  assert.deepEqual([zita.R2.szamlalo, zita.R2.nevezo], [0, 1]);
  assert.equal(o.kampany_bontas.ok, 'NINCS_FORRAS_ADAT');
});

test('MEROK ures adatbazis: minden mutato definialt (nincs kivetel, nincs kitalalt szam)', async () => {
  const t = await ujTeszt();
  const m = await merok(t.db, { tol: 0, ig: IG, most: BASE });
  for (const k of ['SHOW_RATE', 'R2', 'R5', 'R10', 'R11', 'NEXT_BOOKED_ON_SITE', 'PACKAGE_RATE_5', 'PACKAGE_RATE_10', 'ASSESS_TO_FIRST', 'CREDIT_REDEEM', 'CONSENT_EMAIL', 'CONSENT_SMS', 'MESSAGE_DELIVERY', 'COMPLAINT_RESOLUTION_24H', 'DOC_COMPLETION_24H', 'SALONIC_SYNC_LATENCY']) {
    assert.equal(m[k].ertek, null, k);
    assert.equal(m[k].ok, 'nincs_adat', k);
  }
  assert.deepEqual([m.BOOK_FIRST.ertek, m.SHOW1.ertek, m.MERGE_REVIEW_PENDING.ertek], [0, 0, 0]);
  assert.equal(await szamol(t.db, 'security_audit'), 0, 'a mutatok olvasasa nem ir');
  assert.ok(typeof outboxFeldolgoz === 'function');
});
