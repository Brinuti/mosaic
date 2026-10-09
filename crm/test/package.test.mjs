import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, szamol, elso, mind, kerdoivBeallit, kerdoivKitolt, BASE, NAP, VENDEG_A, VENDEG_B } from './fixtures.js';
import * as pk from '../lib/package.js';
import { igazolCompleted } from '../lib/booking.js';
import { attekint } from '../lib/assessment.js';
import { honapHozzaad, naptariNapHozzaad } from '../lib/db.js';

const vasarol = (t, guestId, tipus, extra = {}) => pk.vasarol(t.db, { guestId, tipus, staffId: t.staff.recepcio, ...extra });
const gift = async (t, id) => (await mind(t.db, 'SELECT kind FROM package_gift WHERE purchase_id = ?1 ORDER BY kind', id)).map((r) => r.kind);

/** vendeg, akinek az 1. kezelese mar megvolt (BASE), igy a BASE+NAP utani vasarlas nem "korai" */
async function utanVendeg(t, vendeg = VENDEG_A) {
  const k = await kezelesek(t, { n: 1, vendeg });
  return k[0].guestId;
}
async function folytatoFoglalas(t, vendeg, nap, { bookedAt = BASE + 2 * NAP, status = 'booked' } = {}) {
  return foglal(t, { service: 'followup_hair', vendeg, start: BASE + nap * NAP, bookedAt, now: bookedAt, status });
}

test('P01 package_5: 130 000 Ft, pontosan 5 folytato alkalom, 1 l sampon, 6 ho erveny', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  assert.equal(v.purchase.price_huf, 130000);
  assert.equal(v.purchase.units_total, 5);
  assert.equal(v.purchase.expires_at, honapHozzaad(BASE + NAP, 6));
  assert.deepEqual(await gift(t, v.purchaseId), ['shampoo_1l']);
  assert.equal(v.korai, false);
  for (let i = 0; i < 6; i++) await folytatoFoglalas(t, VENDEG_A, 20 + i * 14);
  assert.equal(await szamol(t.db, 'package_redemption', "status = 'reserved'"), 5);   // a 6. nem fer bele
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: BASE + 3 * NAP }), 0);
});

test('P02 package_10: 260 000 Ft, pontosan 10 alkalom, 1 l sampon + 1 l balzsam, 12 ho', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_10', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  assert.equal(v.purchase.price_huf, 260000);
  assert.equal(v.purchase.units_total, 10);
  assert.equal(v.purchase.expires_at, honapHozzaad(BASE + NAP, 12));
  assert.deepEqual(await gift(t, v.purchaseId), ['conditioner_1l', 'shampoo_1l']);
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: BASE + 3 * NAP }), 10);
});

test('P03 az 1. kezeles NEM fogyaszt alkalmat; first_hair nem rendelheto berlethez', async () => {
  const t = await ujTeszt();
  const f = await foglal(t, { service: 'first_hair' });
  const v = await vasarol(t, f.guestId, 'package_5', { fizetesIdeje: BASE, now: BASE });   // az elso kezeles elott
  assert.equal(await hibaKod(() => pk.foglal(t.db, { purchaseId: v.purchaseId, bookingId: f.bookingId, staffId: t.staff.recepcio })), 'NEM_FOLYTATO');
  await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta, now: BASE + 7 * NAP });
  assert.equal(await szamol(t.db, 'package_redemption'), 0);
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: BASE + 8 * NAP }), 5);
  // a 2. kezeles mar fogyaszt
  const f2 = await folytatoFoglalas(t, VENDEG_A, 21, { bookedAt: BASE + 8 * NAP });
  await igazolCompleted(t.db, { bookingId: f2.bookingId, staffId: t.staff.terapeuta, now: BASE + 21 * NAP });
  assert.equal(await szamol(t.db, 'package_redemption', "status = 'used'"), 1);
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: BASE + 22 * NAP }), 4);
});

test('P04 ket 5-os: ket vasarlas, 2x130 000 = 260 000, ket sampon, 10 alkalom, nincs upgrade / kedvezmeny', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const a = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  const b = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + 2 * NAP, now: BASE + 2 * NAP });
  const ossz = (await elso(t.db, 'SELECT SUM(price_huf) AS s, SUM(units_total) AS u FROM package_purchase'));
  assert.deepEqual([ossz.s, ossz.u], [260000, 10]);
  assert.equal(await szamol(t.db, 'package_gift', "kind = 'shampoo_1l'"), 2);
  assert.equal(await szamol(t.db, 'package_gift', "kind = 'conditioner_1l'"), 0);
  assert.equal(await hibaKod(() => vasarol(t, g, 'package_5', { ar: 120000 })), 'AR_NEM_MODOSITHATO');
  assert.ok(!Object.keys(pk).some((k) => /upgrade|atvalt|kedvezmeny/i.test(k)), 'nincs upgrade-konstrukcio');
  assert.equal(await szamol(t.db, 'package_adjustment'), 0);
  assert.notEqual(a.purchaseId, b.purchaseId);
  // a foglalasok az elobb lejaro berletre mennek, a 6. a masodikra
  for (let i = 0; i < 7; i++) await folytatoFoglalas(t, VENDEG_A, 20 + i * 14);
  assert.equal(await szamol(t.db, 'package_redemption', 'purchase_id = ?1', a.purchaseId), 5);
  assert.equal(await szamol(t.db, 'package_redemption', 'purchase_id = ?1', b.purchaseId), 2);
});

test('P05 az elso kezeles ELOTT vagy NAPJAN vasarolt berlethez extra kis ajandek; utana nem', async () => {
  const t = await ujTeszt();
  // elotte
  const f = await foglal(t, { service: 'first_hair', vendeg: VENDEG_A, start: BASE + 7 * NAP });
  const elotte = await vasarol(t, f.guestId, 'package_10', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  assert.equal(elotte.korai, true);
  assert.deepEqual(await gift(t, elotte.purchaseId), ['conditioner_1l', 'extra_small', 'shampoo_1l']);
  assert.equal((await elso(t.db, "SELECT stock_dependent FROM package_gift WHERE kind = 'extra_small'")).stock_dependent, 1);
  await igazolCompleted(t.db, { bookingId: f.bookingId, staffId: t.staff.terapeuta, now: BASE + 7 * NAP + 3600 });
  // aznap (az elso kezeles napjan)
  const aznap = await vasarol(t, f.guestId, 'package_5', { fizetesIdeje: BASE + 7 * NAP + 4 * 3600, now: BASE + 7 * NAP + 4 * 3600 });
  assert.equal(aznap.korai, true);
  assert.ok((await gift(t, aznap.purchaseId)).includes('extra_small'));
  // masnap
  const masnap = await vasarol(t, f.guestId, 'package_5', { fizetesIdeje: BASE + 8 * NAP, now: BASE + 8 * NAP });
  assert.equal(masnap.korai, false);
  assert.deepEqual(await gift(t, masnap.purchaseId), ['shampoo_1l']);
});

test('P09 a lejarat ELOTT lefoglalt alkalom a lejarat UTAN is teljesitheto; a lejarat utan keletkezett foglalas nem szamit berletbe', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  const E = v.purchase.expires_at;
  const lefoglalt = await foglal(t, { service: 'followup_hair', start: E + 10 * NAP, bookedAt: E - 5 * NAP, now: E - 5 * NAP });
  const keso = await foglal(t, { service: 'followup_hair', start: E + 12 * NAP, bookedAt: E + 1 * NAP, now: E + 1 * NAP });
  assert.equal((await elso(t.db, 'SELECT status FROM package_redemption WHERE booking_id = ?1', lefoglalt.bookingId)).status, 'reserved');
  assert.equal(await szamol(t.db, 'package_redemption', 'booking_id = ?1', keso.bookingId), 0);
  const c = await igazolCompleted(t.db, { bookingId: lefoglalt.bookingId, staffId: t.staff.terapeuta, now: E + 10 * NAP });
  assert.equal(c.treatmentIndex, 2);
  assert.equal((await elso(t.db, 'SELECT status FROM package_redemption WHERE booking_id = ?1', lefoglalt.bookingId)).status, 'used');
  const c2 = await igazolCompleted(t.db, { bookingId: keso.bookingId, staffId: t.staff.terapeuta, now: E + 12 * NAP });
  assert.equal(c2.treatmentIndex, 3);   // a kezeles megtortenik, de nem berletalkalom
  assert.equal(await szamol(t.db, 'package_redemption', "status = 'used'"), 1);
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: E + 13 * NAP }), 0);   // lejart: uj alkalom nem foglalhato
});

test('P10 lejarat utan EGYSZER athelyezheto, max az eredeti slot + 30 nap; a masodik / tul kesei szabalysertes jelolve', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  const E = v.purchase.expires_at;
  const start = E + 5 * NAP;
  const f = await foglal(t, { service: 'followup_hair', start, bookedAt: E - 5 * NAP, now: E - 5 * NAP });
  // lejarat elott: korlatlan
  const elotte = await foglal(t, { externalId: f.externalId, service: 'followup_hair', start: start + NAP, status: 'rescheduled', now: E - NAP });
  assert.equal(elotte.berlet.lejarat_utan, false);
  assert.equal((await elso(t.db, 'SELECT expiry_reschedules FROM package_redemption')).expiry_reschedules, 0);
  // lejarat utan, a hatarra (eredeti + 30 nap)
  const hatar = naptariNapHozzaad(start + NAP, 30);
  assert.equal((await pk.athelyezesEngedett(t.db, { bookingId: f.bookingId, ujStart: hatar, mikor: E + NAP })).engedett, true);
  assert.equal((await pk.athelyezesEngedett(t.db, { bookingId: f.bookingId, ujStart: hatar + 3600, mikor: E + NAP })).kod, 'tul_keso_athelyezes');
  const egyszer = await foglal(t, { externalId: f.externalId, service: 'followup_hair', start: hatar, status: 'rescheduled', now: E + NAP });
  assert.equal(egyszer.berlet.szabalysertes, null);
  assert.equal((await elso(t.db, 'SELECT expiry_reschedules, policy_violation FROM package_redemption')).expiry_reschedules, 1);
  // masodik athelyezes lejarat utan: szabalysertes + riasztas
  assert.equal((await pk.athelyezesEngedett(t.db, { bookingId: f.bookingId, ujStart: hatar + NAP, mikor: E + 2 * NAP })).kod, 'masodik_athelyezes');
  const masodik = await foglal(t, { externalId: f.externalId, service: 'followup_hair', start: hatar + NAP, status: 'rescheduled', now: E + 2 * NAP });
  assert.equal(masodik.berlet.szabalysertes, 'masodik_athelyezes');
  assert.equal((await elso(t.db, 'SELECT policy_violation FROM package_redemption')).policy_violation, 'masodik_athelyezes');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'package.policy_violation'"), 1);
});

test('P10 tul kesei (eredeti + 30 napnal kesobbi) athelyezes szabalysertes', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  const E = v.purchase.expires_at;
  const f = await foglal(t, { service: 'followup_hair', start: E + 5 * NAP, bookedAt: E - 5 * NAP, now: E - 5 * NAP });
  const r = await foglal(t, { externalId: f.externalId, service: 'followup_hair', start: E + 5 * NAP + 31 * NAP, status: 'rescheduled', now: E + NAP });
  assert.equal(r.berlet.szabalysertes, 'tul_keso_athelyezes');
});

test('P11 lejarat utani TELJES lemondas: az alkalom jogosultsaga megszunik (forfeited); lejarat elotti lemondas felszabadit', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  const E = v.purchase.expires_at;
  const a = await foglal(t, { service: 'followup_hair', start: E + 5 * NAP, bookedAt: E - 6 * NAP, now: E - 6 * NAP });
  const b = await foglal(t, { service: 'followup_hair', start: E + 8 * NAP, bookedAt: E - 5 * NAP, now: E - 5 * NAP });
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: E - 4 * NAP }), 3);
  await foglal(t, { externalId: a.externalId, service: 'followup_hair', start: E + 5 * NAP, status: 'cancelled', now: E - 2 * NAP });   // elotte
  assert.equal((await elso(t.db, 'SELECT status FROM package_redemption WHERE booking_id = ?1', a.bookingId)).status, 'released');
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: E - NAP }), 4);
  await foglal(t, { externalId: b.externalId, service: 'followup_hair', start: E + 8 * NAP, status: 'cancelled', now: E + NAP });   // lejarat utan
  assert.equal((await elso(t.db, 'SELECT status FROM package_redemption WHERE booking_id = ?1', b.bookingId)).status, 'forfeited');
  const p = await pk.csomag(t.db, v.purchaseId);
  assert.equal(pk.allapotSzamol ? await pk.allapotSzamol(t.db, p, E + 2 * NAP) : '', 'expired');
});

test('P12 keses / no-show onmagaban NEM penz, NEM levonas: az alkalom megmarad, nincs korrekcio / adjustment', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  const f = await folytatoFoglalas(t, VENDEG_A, 20);
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: BASE + 10 * NAP }), 4);
  await foglal(t, { externalId: f.externalId, service: 'followup_hair', start: BASE + 20 * NAP, status: 'no_show', now: BASE + 21 * NAP });
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: BASE + 22 * NAP }), 5);   // minden alkalom megvan
  assert.equal((await elso(t.db, 'SELECT status FROM package_redemption')).status, 'released');
  assert.equal(await szamol(t.db, 'package_adjustment'), 0);
  assert.equal((await pk.csomag(t.db, v.purchaseId)).status, 'paid_active');
  assert.equal(await szamol(t.db, 'package_redemption', "status IN ('used', 'forfeited')"), 0);
});

test('P13 orvosi ellenjavallat: 0 felhasznalt alkalom + vegleges tiltas = teljes refund, a bontatlan ajandek visszakerul, a felbontott nem csokkenti', async () => {
  const t = await ujTeszt();
  await kerdoivBeallit(t);
  const f = await foglal(t, { service: 'first_hair', start: BASE + 7 * NAP });
  const v = await vasarol(t, f.guestId, 'package_10', { fizetesIdeje: BASE + NAP, now: BASE + NAP, ajandekAtadva: true });
  const gifts = await mind(t.db, 'SELECT id, kind FROM package_gift WHERE purchase_id = ?1', v.purchaseId);
  assert.equal(gifts.length, 3);   // sampon, balzsam, extra kis (korai)
  // meg nincs ellenjavallat -> nincs refund
  assert.equal(await hibaKod(() => pk.refund(t.db, { purchaseId: v.purchaseId, staffId: t.staff.vezeto, ok: 'x', ajandekAllapot: {} })), 'REFUND_FELTETEL');
  // ellenjavallat a kerdoivben, a kezelo vegleges tiltast rogzit
  const k = await kerdoivKitolt(t, { guestId: f.guestId, bookingId: f.bookingId, valaszFelulir: { korabbi_reakcio: true }, now: BASE + 2 * NAP });
  assert.equal(k.jelzes, true);
  await attekint(t.db, { submissionId: k.submissionId, staffId: t.staff.terapeuta, eredmeny: 'contraindicated', now: BASE + 3 * NAP });
  // vasarlas stop alatt mar nem lehetseges
  assert.equal(await hibaKod(() => vasarol(t, f.guestId, 'package_5', { now: BASE + 4 * NAP })), 'KLINIKAI_STOP');
  // jogosultsag: a recepcio nem, a szalonvezeto igen; az atadott ajandekok allapota kotelezo
  assert.equal(await hibaKod(() => pk.refund(t.db, { purchaseId: v.purchaseId, staffId: t.staff.recepcio, ok: 'x' })), 'TILTOTT');
  assert.equal(await hibaKod(() => pk.refund(t.db, { purchaseId: v.purchaseId, staffId: t.staff.vezeto, ok: 'ellenjavallat', ajandekAllapot: {} })), 'AJANDEK_ALLAPOT_KELL');
  const allapot = { [gifts[0].id]: 'bontatlan', [gifts[1].id]: 'felbontott', [gifts[2].id]: 'bontatlan' };
  const r = await pk.refund(t.db, { purchaseId: v.purchaseId, staffId: t.staff.vezeto, ok: 'vegleges ellenjavallat', ajandekAllapot: allapot, now: BASE + 5 * NAP });
  assert.equal(r.osszeg, 260000);   // a felbontott ajandek ertekevel NEM csokken
  assert.equal((await pk.csomag(t.db, v.purchaseId)).status, 'refunded');
  const st = Object.fromEntries((await mind(t.db, 'SELECT id, status FROM package_gift')).map((x) => [x.id, x.status]));
  assert.equal(st[gifts[0].id], 'return_due');
  assert.equal(st[gifts[1].id], 'kept_opened');
  await pk.ajandekVisszavesz(t.db, { giftId: gifts[0].id, staffId: t.staff.recepcio, now: BASE + 6 * NAP });
  assert.equal((await elso(t.db, 'SELECT status FROM package_gift WHERE id = ?1', gifts[0].id)).status, 'returned');
  assert.equal((await elso(t.db, "SELECT kind, amount_huf FROM package_adjustment WHERE kind = 'refund_full'")).amount_huf, 260000);
  assert.equal(await pk.szabadAlkalmak(t.db, v.purchaseId, { now: BASE + 7 * NAP }), 0);
  assert.equal(await hibaKod(() => pk.refund(t.db, { purchaseId: v.purchaseId, staffId: t.staff.vezeto, ok: 'x' })), 'MAR_VISSZATERITVE');
});

test('P13 teljes refund NEM jar, ha mar volt kezeles (csak egyedi, szalonvezetoi elbiralassal)', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  await t.db.prepare("UPDATE guest SET clinical_stop = 'contraindication' WHERE id = ?1").bind(g).run();
  assert.equal(await hibaKod(() => pk.refund(t.db, { purchaseId: v.purchaseId, staffId: t.staff.vezeto, ok: 'x', ajandekAllapot: {} })), 'REFUND_FELTETEL');
  assert.equal(await hibaKod(() => pk.refund(t.db, { purchaseId: v.purchaseId, staffId: t.staff.vezeto, mod: 'egyedi', ok: 'x', osszeg: 999999 })), 'ERVENYTELEN_OSSZEG');
  const r = await pk.refund(t.db, { purchaseId: v.purchaseId, staffId: t.staff.vezeto, mod: 'egyedi', osszeg: 100000, ok: 'szakmai megszakitas', ajandekAllapot: {} });
  assert.equal(r.osszeg, 100000);
});

test('PACKAGE csak szemelyes vasarlas, recepcio rogzit; idempotens; szalonvezetoi hosszabbitas indokkal', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  assert.equal(await hibaKod(() => vasarol(t, g, 'package_5', { csatorna: 'online' })), 'ONLINE_VASARLAS_TILOS');
  assert.equal(await hibaKod(() => pk.vasarol(t.db, { guestId: g, tipus: 'package_5', staffId: t.staff.marketing })), 'TILTOTT');
  assert.equal(await hibaKod(() => vasarol(t, g, 'package_7')), 'ISMERETLEN_BERLET');
  const a = await vasarol(t, g, 'package_5', { idempotencyKey: 'k-1', fizetesIdeje: BASE + NAP, now: BASE + NAP });
  const b = await vasarol(t, g, 'package_5', { idempotencyKey: 'k-1', fizetesIdeje: BASE + NAP, now: BASE + NAP });
  assert.equal(b.mar, true);
  assert.equal(a.purchaseId, b.purchaseId);
  assert.equal(await szamol(t.db, 'package_purchase'), 1);
  assert.equal(await hibaKod(() => pk.hosszabbit(t.db, { purchaseId: a.purchaseId, staffId: t.staff.recepcio, honap: 1, ok: 'x' })), 'TILTOTT');
  assert.equal(await hibaKod(() => pk.hosszabbit(t.db, { purchaseId: a.purchaseId, staffId: t.staff.vezeto, honap: 1 })), 'INDOK_KELL');
  const h = await pk.hosszabbit(t.db, { purchaseId: a.purchaseId, staffId: t.staff.vezeto, honap: 1, ok: 'betegseg miatt', now: BASE + 5 * NAP });
  assert.equal(h.lejarat, honapHozzaad(a.purchase.expires_at, 1));
  assert.equal((await pk.csomag(t.db, a.purchaseId)).status, 'extended_by_manager');
  assert.equal(await szamol(t.db, 'package_adjustment', "kind = 'extension' AND approved_by = ?1", t.staff.vezeto), 1);
  assert.ok(await szamol(t.db, 'security_audit', "action LIKE 'package.%'") >= 3);
});

test('M10 lejarat-figyelo: csak TENYLEGESEN szabadon foglalhato alkalommal rendelkezo berletet jelzi', async () => {
  const t = await ujTeszt();
  const g = await utanVendeg(t);
  const v = await vasarol(t, g, 'package_5', { fizetesIdeje: BASE + NAP, now: BASE + NAP });
  const E = v.purchase.expires_at;
  assert.equal((await pk.lejaratFigyelo(t.db, { napElore: 30, now: E - 20 * NAP })).length, 1);
  assert.equal((await pk.lejaratFigyelo(t.db, { napElore: 30, now: E - 40 * NAP })).length, 0);   // meg nem jart le a 30 napos ablak
  for (let i = 0; i < 5; i++) await foglal(t, { service: 'followup_hair', start: E + (3 + i) * NAP, bookedAt: E - 25 * NAP, now: E - 25 * NAP });
  assert.equal((await pk.lejaratFigyelo(t.db, { napElore: 30, now: E - 20 * NAP })).length, 0);   // mind lefoglalva -> nincs miert ertesiteni
  assert.equal((await pk.lejaratFigyelo(t.db, { napElore: 7, now: E - 5 * NAP })).length, 0);
});
