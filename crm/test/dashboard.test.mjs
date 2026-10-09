// Dashboard tesztek: a kezelo CSAK a sajat vendegeit latja, a menedzsment nezet csak aggregalt, nyers egeszsegi / szemelyes adat nelkul.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, mind, elso, szamol, kerdoivBeallit, kerdoivKitolt, BASE, NAP, VENDEG_A, VENDEG_B } from './fixtures.js';
import { dashboard } from '../lib/dashboard.js';
import * as pk from '../lib/package.js';
import * as cp from '../lib/complaint.js';

const ORA = 3600;
const VENDEG_C = { nev: 'Teszt Cili', email: 'cili.teszt@example.com', telefon: '+36 30 555 6666' };
const VENDEG_D = { nev: 'Teszt Dora', email: 'dora.teszt@example.com', telefon: '+36 30 777 8888' };
const MOST = BASE;   // hetfo 10:00

async function felallit() {
  const t = await ujTeszt();
  await kerdoivBeallit(t);
  // Bela: 20 napja volt az 1. kezelese Katanal (a dokumentacio hianyzik), 5-os berlet hamarosan lejar, nyitott panasz, hibas uzenet
  const [b1] = await kezelesek(t, { vendeg: VENDEG_B, n: 1, kezdet: MOST - 20 * NAP });
  const berlet = await pk.vasarol(t.db, { guestId: b1.guestId, tipus: 'package_5', staffId: t.staff.recepcio, fizetesIdeje: MOST - 160 * NAP, now: MOST - 160 * NAP });
  const panasz = await cp.panaszNyit(t.db, { guestId: b1.guestId, kezeloId: t.staff.terapeuta, staffId: t.staff.terapeuta, now: MOST - 2 * NAP });
  await t.db.prepare('INSERT INTO message_job (id, guest_id, template_key, template_version, channel, context_id, idempotency_key, status, stop_reason, run_at, attempts, created_at) VALUES (\'hiba-1\', ?1, \'R1\', 1, \'email\', \'x\', \'hiba-kulcs\', \'dead\', \'FAILED:dead_letter\', ?2, 5, ?2)').bind(b1.guestId, MOST - NAP).run();
  // Anna: ma 14:00 elso kezeles Katanal, a kerdoiv ellenjavallati jelzest ad
  const a = await foglal(t, { service: 'first_hair', start: MOST + 4 * ORA, vendeg: VENDEG_A, kezelo: 'Kata', bookedAt: MOST - NAP, now: MOST - NAP });
  await kerdoivKitolt(t, { guestId: a.guestId, bookingId: a.bookingId, valaszFelulir: { korabbi_reakcio: true }, now: MOST - ORA });
  // Cili: holnap kamera-felmeres Zitanal; Dora: ma 11:00 elso kezeles Zitanal
  const c = await foglal(t, { service: 'camera_assessment', start: MOST + NAP + ORA, vendeg: VENDEG_C, kezelo: 'Zita', bookedAt: MOST - NAP, now: MOST - NAP });
  const d = await foglal(t, { service: 'first_hair', start: MOST + ORA, vendeg: VENDEG_D, kezelo: 'Zita', bookedAt: MOST - NAP, now: MOST - NAP });
  return { t, a, b1, c, d, berlet, panasz };
}

test('DASHBOARD kezelo-nezet: CSAK a sajat vendegek / foglalasok (Kata nem latja Zita vendegeit), jelzesekkel', async () => {
  const { t, a, b1, c, d, berlet, panasz } = await felallit();
  const kata = await dashboard(t.db, { nezet: 'kezelo', staffId: t.staff.terapeuta, most: MOST });
  assert.equal(kata.hatokor, 'sajat');
  assert.deepEqual(kata.ma.foglalasok.map((b) => b.vendeg.id), [a.guestId]);
  assert.equal(kata.ma.foglalasok[0].kontraindikacio_jelzes, true, 'a kerdoiv jelzese a kezelonek latszik');
  assert.equal(kata.ma.foglalasok[0].kerdoiv, 'submitted');
  assert.equal(kata.ma.foglalasok[0].kezeles_sorszam, 1);
  assert.equal(kata.ma.foglalasok[0].kamera_kotelezo, true);
  assert.deepEqual(kata.uj_elso_kezelesek.ma.map((x) => x.bookingId), [a.bookingId]);
  assert.deepEqual(kata.holnap.foglalasok, []);
  assert.deepEqual(kata.felmeresek.holnap, []);
  // keszulo A5: Bela dokumentuma 20 napja hianyzik -> DOC48 szint
  assert.equal(kata.keszulo_a5.length, 1);
  assert.deepEqual([kata.keszulo_a5[0].vendeg.id, kata.keszulo_a5[0].szint, kata.keszulo_a5[0].kesett], [b1.guestId, 'DOC48', true]);
  // lejaro berlet (sajat vendeg), STOP-ok, hibak
  assert.deepEqual(kata.lejaro_berletek.map((l) => [l.purchaseId, l.szabad_alkalom]), [[berlet.purchaseId, 5]]);
  assert.deepEqual(kata.stopok.nyitott_panaszok.map((x) => x.complaintId), [panasz.complaintId]);
  assert.equal(kata.stopok.ellenjavallati_riasztasok.length, 1);
  assert.equal(kata.stopok.ellenjavallati_riasztasok[0].vendeg.id, a.guestId);
  assert.deepEqual(kata.kuldesi_hibak.map((h) => [h.jobId, h.allapot]), [['hiba-1', 'dead']]);
  assert.equal(kata.teljesitett_alkalmak.honap, 1);

  const zita = await dashboard(t.db, { nezet: 'kezelo', staffId: t.staff.terapeuta2, most: MOST });
  assert.deepEqual(zita.ma.foglalasok.map((x) => x.vendeg.id), [d.guestId]);
  assert.deepEqual(zita.holnap.foglalasok.map((x) => x.vendeg.id), [c.guestId]);
  assert.equal(zita.felmeresek.holnap.length, 1);
  assert.deepEqual(zita.keszulo_a5, [], 'Zitanak nincs hianyzo dokumentuma');
  assert.deepEqual(zita.stopok.nyitott_panaszok, []);
  assert.deepEqual(zita.lejaro_berletek, []);
  const nyers = JSON.stringify(zita);
  assert.ok(!nyers.includes(a.guestId) && !nyers.includes(b1.guestId), 'Zita nem latja Kata vendegeit');
});

test('DASHBOARD kezelo-nezet: a szakmai vezeto (clinical_lead) az osszes kezelo vendegeit latja; recepcio / marketing / admin TILTOTT (auditalt)', async () => {
  const { t, a, d } = await felallit();
  const janka = await dashboard(t.db, { nezet: 'kezelo', staffId: t.staff.janka, most: MOST });
  assert.equal(janka.hatokor, 'osszes');
  assert.deepEqual(janka.ma.foglalasok.map((x) => x.vendeg.id).sort(), [a.guestId, d.guestId].sort());
  for (const szerep of ['recepcio', 'marketing', 'admin', 'vezeto']) {
    assert.equal(await hibaKod(() => dashboard(t.db, { nezet: 'kezelo', staffId: t.staff[szerep], most: MOST })), 'TILTOTT', szerep);
  }
  assert.equal(await szamol(t.db, 'security_audit', "action = 'assessment.read' AND result = 'denied'"), 4);
  assert.equal(await hibaKod(() => dashboard(t.db, { nezet: 'valami', staffId: t.staff.terapeuta })), 'ISMERETLEN_NEZET');
});

test('DASHBOARD menedzsment-nezet: CSAK aggregalt szamok, vendeg-azonosito / nev / e-mail / telefon / egeszsegi adat nelkul', async () => {
  const { t, a, b1, c, d } = await felallit();
  const m = await dashboard(t.db, { nezet: 'menedzsment', staffId: t.staff.vezeto, most: MOST });
  assert.equal(m.adat, 'aggregalt');
  assert.deepEqual([m.foglalasok.ma.osszes, m.foglalasok.ma.first_hair, m.foglalasok.holnap.camera_assessment], [2, 2, 1]);
  assert.deepEqual([m.uj_elso_kezelesek.ma, m.felmeresek.holnap], [2, 1]);
  assert.equal(m.teljesitett_alkalmak.honap, 1);
  assert.deepEqual(m.teljesitett_alkalmak.kezelonkent_30_nap, [{ kezelo: 'Kezelo Kata', db: 1 }]);
  assert.deepEqual(m.dokumentacio, { hianyzo: 1, kesett_24h: 1, kesett_48h: 1 });
  assert.deepEqual([m.lejaro_berletek.harminc_napon_belul, m.lejaro_berletek.szabad_alkalom_osszes], [1, 5]);
  assert.deepEqual([m.stopok.nyitott_panasz_db, m.stopok.nyitott_ellenjavallati_riasztas_db, m.stopok.kesett_panasz_db], [1, 1, 1]);
  assert.deepEqual([m.kuldesi_hibak.dead, m.kuldesi_hibak.failed], [1, 0]);
  const nyers = JSON.stringify(m);
  for (const tiltott of [a.guestId, b1.guestId, c.guestId, d.guestId, 'Teszt Anna', 'Teszt Bela', 'example.com', '+36', 'korabbi_reakcio', 'flagged', 'kontraindikacio_jelzes', 'vendeg']) {
    assert.ok(!nyers.includes(tiltott), `a menedzsment nezet nem tartalmazhat: ${tiltott}`);
  }
  // marketing / admin is lathatja az aggregaltat; kezelo / recepcio nem
  assert.equal((await dashboard(t.db, { nezet: 'menedzsment', staffId: t.staff.marketing, most: MOST })).adat, 'aggregalt');
  assert.equal((await dashboard(t.db, { nezet: 'menedzsment', staffId: t.staff.admin, most: MOST })).adat, 'aggregalt');
  assert.equal(await hibaKod(() => dashboard(t.db, { nezet: 'menedzsment', staffId: t.staff.terapeuta, most: MOST })), 'TILTOTT');
  assert.equal(await hibaKod(() => dashboard(t.db, { nezet: 'menedzsment', staffId: t.staff.recepcio, most: MOST })), 'TILTOTT');
});

test('DASHBOARD ures adatbazis: minden szam 0 / ures lista, kivetel nelkul', async () => {
  const t = await ujTeszt();
  const k = await dashboard(t.db, { nezet: 'kezelo', staffId: t.staff.terapeuta, most: MOST });
  assert.deepEqual([k.ma.foglalasok.length, k.keszulo_a5.length, k.lejaro_berletek.length, k.kuldesi_hibak.length, k.teljesitett_alkalmak.ma], [0, 0, 0, 0, 0]);
  const m = await dashboard(t.db, { nezet: 'menedzsment', staffId: t.staff.vezeto, most: MOST });
  assert.deepEqual([m.foglalasok.ma.osszes, m.dokumentacio.hianyzo, m.stopok.nyitott_panasz_db, m.kuldesi_hibak.dead], [0, 0, 0, 0]);
  assert.ok(VENDEG_A && mind && elso);
});
