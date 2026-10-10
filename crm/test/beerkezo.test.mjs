import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, kezelesek, hibaKod, szamol, elso, sessionok, jpegBajtok, BASE, VENDEG_A } from './fixtures.js';
import * as bk from '../lib/beerkezo.js';

async function elsoKezeles(t) {
  const k = await kezelesek(t, { vendeg: VENDEG_A, n: 1, kezdet: BASE });
  const ss = await sessionok(t.db, k[0].guestId);
  return ss.find((s) => s.treatment_index === 1);
}

test('BEERKEZO feltoltes -> lista -> olvasas -> hozzarendeles: a kep a kezeleshez kerul, a beerkezobol torlodik', async () => {
  const t = await ujTeszt();
  const s1 = await elsoKezeles(t);
  const f = await bk.beerkezoFeltolt(t.db, { staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, now: BASE });
  const lista = await bk.beerkezoLista(t.db, { staffId: t.staff.terapeuta, tarolo: t.tarolo, now: BASE + 5 });
  assert.equal(lista.length, 1);
  assert.equal((await bk.beerkezoOlvas(t.db, { id: f.id, staffId: t.staff.terapeuta, tarolo: t.tarolo, now: BASE + 5 })).mime, 'image/jpeg');
  const r = await bk.beerkezoHozzarendel(t.db, { id: f.id, sessionId: s1.id, staffId: t.staff.terapeuta, tarolo: t.tarolo, now: BASE + 10 });
  assert.ok(r.imageId);
  assert.equal(await szamol(t.db, 'image_inbox'), 0);
  assert.equal(await szamol(t.db, 'camera_image', 'deleted_at IS NULL'), 1);
  assert.equal(await hibaKod(() => bk.beerkezoHozzarendel(t.db, { id: f.id, sessionId: s1.id, staffId: t.staff.terapeuta, tarolo: t.tarolo, now: BASE + 11 })), 'NINCS_KEP');
});

test('BEERKEZO csere: a meglevo kepet felulirja; csere nelkul MAR_VAN_KEP, a kep a beerkezoben marad', async () => {
  const t = await ujTeszt();
  const s1 = await elsoKezeles(t);
  const a = await bk.beerkezoFeltolt(t.db, { staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, now: BASE });
  await bk.beerkezoHozzarendel(t.db, { id: a.id, sessionId: s1.id, staffId: t.staff.terapeuta, tarolo: t.tarolo, now: BASE + 1 });
  const b = await bk.beerkezoFeltolt(t.db, { staffId: t.staff.terapeuta, bajtok: jpegBajtok(90), mime: 'image/jpeg', tarolo: t.tarolo, now: BASE + 2 });
  assert.equal(await hibaKod(() => bk.beerkezoHozzarendel(t.db, { id: b.id, sessionId: s1.id, staffId: t.staff.terapeuta, tarolo: t.tarolo, now: BASE + 3 })), 'MAR_VAN_KEP');
  assert.equal(await szamol(t.db, 'image_inbox'), 1, 'sikertelen hozzarendelesnel a kep a beerkezoben marad');
  const r = await bk.beerkezoHozzarendel(t.db, { id: b.id, sessionId: s1.id, staffId: t.staff.terapeuta, tarolo: t.tarolo, csere: true, now: BASE + 4 });
  assert.ok(r.felulirt);
  assert.equal(await szamol(t.db, 'camera_image', 'deleted_at IS NULL'), 1);
});

test('BEERKEZO lejarat: ORAK ora utan a kep es a bajtok torlodnek; elvetes is torol; recepcio nem fer hozza; hibas tartalom elutasitva', async () => {
  const t = await ujTeszt();
  const f = await bk.beerkezoFeltolt(t.db, { staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, now: BASE });
  const kulcs = (await elso(t.db, 'SELECT storage_key FROM image_inbox WHERE id = ?1', f.id)).storage_key;
  assert.equal(await hibaKod(() => bk.beerkezoLista(t.db, { staffId: t.staff.recepcio, tarolo: t.tarolo, now: BASE })), 'TILTOTT');
  assert.equal(await hibaKod(() => bk.beerkezoFeltolt(t.db, { staffId: t.staff.recepcio, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, now: BASE })), 'TILTOTT');
  assert.equal(await hibaKod(() => bk.beerkezoFeltolt(t.db, { staffId: t.staff.terapeuta, bajtok: new Uint8Array([1, 2, 3, 4, 5]), mime: 'image/jpeg', tarolo: t.tarolo, now: BASE })), 'ERVENYTELEN_TARTALOM');
  const g = await bk.beerkezoFeltolt(t.db, { staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, now: BASE + 100 });
  await bk.beerkezoElvet(t.db, { id: g.id, staffId: t.staff.terapeuta, tarolo: t.tarolo, now: BASE + 101 });
  assert.equal(await szamol(t.db, 'image_inbox'), 1);
  const lista = await bk.beerkezoLista(t.db, { staffId: t.staff.terapeuta, tarolo: t.tarolo, now: BASE + bk.BEERKEZO_ORAK * 3600 + 1 });
  assert.equal(lista.length, 0);
  assert.equal(await t.tarolo.get(kulcs), null, 'a lejart kep bajtjai torolve');
  assert.equal(await szamol(t.db, 'security_audit', "action = 'image.inbox_expired'"), 1);
});
