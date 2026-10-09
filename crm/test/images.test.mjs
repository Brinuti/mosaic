import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, foglal, kezelesek, hibaKod, szamol, elso, mind, sessionok, jpegBajtok, pngBajtok, BASE, NAP, VENDEG_A, VENDEG_B, FIOK_2 } from './fixtures.js';
import * as im from '../lib/images.js';
import * as pl from '../lib/plan.js';
import { emailValtoztat } from '../lib/guest.js';
import { jovahagy } from '../lib/merge.js';
import { LINK_ERVENYESSEG, ELLENORZO_TOKEN_ERVENYESSEG } from '../lib/constants.js';

/** vendeg 3 kezelessel, az 1. es 3. alkalom kepevel, vegleges osszehasonlitassal es kesz 3. alkalmi dokumentummal */
async function kepesVendeg(t, vendeg = VENDEG_A, { kesz = true, account = null, kezdet = BASE } = {}) {
  const k = await kezelesek(t, { vendeg, n: 3, account, kezdet, guestExternalId: account ? `x-${vendeg.nev}` : null });
  const ss = await sessionok(t.db, k[0].guestId);
  const kep = {};
  for (const idx of [1, 3]) {
    const s = ss.find((x) => x.treatment_index === idx);
    kep[idx] = (await im.kepFeltolt(t.db, { sessionId: s.id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo })).imageId;
  }
  const o = await im.osszehasonlit(t.db, { imageAId: kep[1], imageBId: kep[3], staffId: t.staff.terapeuta });
  await im.osszehasonlitVeglegesit(t.db, { comparisonId: o.comparisonId, staffId: t.staff.terapeuta, note: 'A kep jobb oldalan sürübb a haj. A fejbor nyugodt.' });
  if (kesz) {
    const plan = await elso(t.db, "SELECT id FROM treatment_plan WHERE kind = 'review' AND guest_id = ?1", k[0].guestId);
    await pl.ment(t.db, { planId: plan.id, mezok: { ertekeles: 'Javul a kep. A fejbor nyugodt.', otthoni_rutin_kontroll: 'A rutin megfelelo.' }, staffId: t.staff.terapeuta });
    await pl.veglegesit(t.db, { planId: plan.id, staffId: t.staff.terapeuta });
  }
  return { guestId: k[0].guestId, kep, comparisonId: o.comparisonId, ss };
}

test('S01 a recepcio az erzekeny kepet NEM toltheti le (tiltva + audit); a kezelo igen, naplozva', async () => {
  const t = await ujTeszt();
  const v = await kepesVendeg(t);
  assert.equal(await hibaKod(() => im.kepOlvas(t.db, { imageId: v.kep[1], staffId: t.staff.recepcio, tarolo: t.tarolo })), 'TILTOTT');
  assert.equal(await hibaKod(() => im.kepOlvas(t.db, { imageId: v.kep[1], staffId: t.staff.marketing, tarolo: t.tarolo })), 'TILTOTT');
  assert.equal(await hibaKod(() => im.kepOlvas(t.db, { imageId: v.kep[1], staffId: t.staff.admin, tarolo: t.tarolo })), 'TILTOTT');   // az admin sem klinikai adat
  assert.equal(await szamol(t.db, 'security_audit', "action = 'camera_image.read' AND result = 'denied'"), 3);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'camera_image.read' AND staff_id = ?1", t.staff.recepcio), 1);
  const ok = await im.kepOlvas(t.db, { imageId: v.kep[1], staffId: t.staff.terapeuta2, tarolo: t.tarolo });   // kezelo-valtas: minden Oxygeni-kezelo lathatja
  assert.equal(ok.mime, 'image/jpeg');
  assert.equal(ok.fejlecek['Cache-Control'], 'no-store');
  assert.equal(await szamol(t.db, 'security_audit', "action = 'image.read' AND result = 'ok' AND staff_id = ?1", t.staff.terapeuta2), 1);
});

test('C04 kep csak az 1/3/5/10. alkalomra; MIME + tartalom + meret ellenorzes; a kulcs szerver-oldali; a tarolo takaritodik hibanal', async () => {
  const t = await ujTeszt();
  const k = await kezelesek(t, { n: 3 });
  const ss = await sessionok(t.db, k[0].guestId);
  const s1 = ss[0], s2 = ss[1];
  const fel = (o) => im.kepFeltolt(t.db, { sessionId: s1.id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, ...o });
  assert.equal(await hibaKod(() => fel({ sessionId: s2.id })), 'NEM_KAMERA_ALKALOM');
  assert.equal(await hibaKod(() => fel({ mime: 'image/gif' })), 'ERVENYTELEN_MIME');
  assert.equal(await hibaKod(() => fel({ bajtok: pngBajtok() })), 'ERVENYTELEN_TARTALOM');   // png tartalom jpeg cimkevel
  assert.equal(await hibaKod(() => fel({ bajtok: new Uint8Array(0) })), 'ERVENYTELEN_MERET');
  assert.equal(await hibaKod(() => fel({ capturePoint: '../../etc' })), 'ERVENYTELEN_PONT');
  assert.equal(await hibaKod(() => fel({ staffId: t.staff.recepcio })), 'TILTOTT');
  assert.equal(t.tarolo.m.size, 0);
  const r = await fel({});
  assert.match(r.storageKey, /^kepek\/[0-9a-f-]+\/[0-9a-f-]+\/[0-9a-f-]+\.jpg$/);
  assert.ok(!r.storageKey.includes('..'));
  assert.equal(t.tarolo.m.size, 1);
  assert.equal(await hibaKod(() => fel({})), 'MAR_VAN_KEP');   // ugyanaz az alkalom + pont
  assert.equal(t.tarolo.m.size, 1);                            // a sikertelen feltoltes nem hagy arva fajlt
  assert.equal((await elso(t.db, 'SELECT size_bytes FROM camera_image')).size_bytes, jpegBajtok().length);
});

test('IMAGES osszehasonlitas: azonos rogzitesi pont, korabbi->kesobbi alkalom, 2-3 mondatos ertekeles a veglegesiteshez', async () => {
  const t = await ujTeszt();
  const k = await kezelesek(t, { n: 3 });
  const ss = await sessionok(t.db, k[0].guestId);
  const a = await im.kepFeltolt(t.db, { sessionId: ss[0].id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, capturePoint: 'fej-teteje' });
  const b = await im.kepFeltolt(t.db, { sessionId: ss[2].id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, capturePoint: 'homlok' });
  assert.equal(await hibaKod(() => im.osszehasonlit(t.db, { imageAId: a.imageId, imageBId: b.imageId, staffId: t.staff.terapeuta })), 'ELTERO_ROGZITESI_PONT');
  const b2 = await im.kepFeltolt(t.db, { sessionId: ss[2].id, staffId: t.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: t.tarolo, capturePoint: 'fej-teteje' });
  assert.equal(await hibaKod(() => im.osszehasonlit(t.db, { imageAId: b2.imageId, imageBId: a.imageId, staffId: t.staff.terapeuta })), 'SORREND');
  assert.equal(await hibaKod(() => im.osszehasonlit(t.db, { imageAId: a.imageId, imageBId: b2.imageId, staffId: t.staff.recepcio })), 'TILTOTT');
  const o = await im.osszehasonlit(t.db, { imageAId: a.imageId, imageBId: b2.imageId, staffId: t.staff.terapeuta });
  assert.equal(await hibaKod(() => im.osszehasonlitVeglegesit(t.db, { comparisonId: o.comparisonId, staffId: t.staff.terapeuta, note: 'Csak egy mondat.' })), 'MONDATSZAM');
  await im.osszehasonlitVeglegesit(t.db, { comparisonId: o.comparisonId, staffId: t.staff.terapeuta, note: 'Elso mondat. Masodik mondat. Harmadik mondat.' });
  assert.equal((await elso(t.db, 'SELECT status FROM image_comparison')).status, 'final');
});

test('C07 a szemelyes kep-link csak KESZ kezeloi dokumentacioval adhato ki; a token hash-elve, 30 napos', async () => {
  const t = await ujTeszt();
  const hianyos = await kepesVendeg(t, VENDEG_A, { kesz: false });
  assert.equal(await hibaKod(() => im.linkKiad(t.db, { comparisonId: hianyos.comparisonId })), 'DOKUMENTACIO_HIANYOS');
  assert.equal(await szamol(t.db, 'share_grant'), 0);
  const t2 = await ujTeszt();
  const v = await kepesVendeg(t2);
  const l = await im.linkKiad(t2.db, { comparisonId: v.comparisonId, now: BASE + 20 * NAP });
  assert.equal(l.expiresAt, BASE + 20 * NAP + LINK_ERVENYESSEG);
  assert.equal(l.to, VENDEG_A.email);
  assert.ok(l.token.length >= 43);
  const sor = await elso(t2.db, 'SELECT * FROM share_grant');
  assert.equal(JSON.stringify(sor).includes(l.token), false);       // a plaintext token SEHOL nincs az adatbazisban
  assert.equal(sor.token_hash.length, 64);
  assert.equal(JSON.stringify(await mind(t2.db, 'SELECT payload FROM outbox_event')).includes(l.token), false);
  assert.equal(JSON.stringify(await mind(t2.db, 'SELECT detail FROM security_audit')).includes(l.token), false);
});

test('C10 vendegszintu ACL: A vendeg tokenjevel B vendeg kepere / osszehasonlitasara 404 + audit, tartalom nem szivarog', async () => {
  const t = await ujTeszt();
  const A = await kepesVendeg(t, VENDEG_A);
  const B = await kepesVendeg(t, VENDEG_B, { kezdet: BASE + 5 * NAP });
  assert.notEqual(A.guestId, B.guestId);
  const la = await im.linkKiad(t.db, { comparisonId: A.comparisonId, now: BASE + 30 * NAP });
  const lb = await im.linkKiad(t.db, { comparisonId: B.comparisonId, now: BASE + 30 * NAP });
  const sajat = await im.hozzaferes(t.db, { token: la.token, imageId: A.kep[1], tarolo: t.tarolo, now: BASE + 31 * NAP });
  assert.equal(sajat.status, 200);
  assert.equal(sajat.kep.mime, 'image/jpeg');
  assert.equal(sajat.fejlecek['Referrer-Policy'], 'no-referrer');
  assert.equal(sajat.fejlecek['Cache-Control'], 'no-store');
  assert.equal(sajat.osszehasonlitas.kepek.length, 2);
  // keresztezett kerelmek
  const mas = await im.hozzaferes(t.db, { token: la.token, imageId: B.kep[1], tarolo: t.tarolo, now: BASE + 31 * NAP });
  assert.deepEqual([mas.ok, mas.status, mas.kep], [false, 404, undefined]);
  const masOsszeh = await im.hozzaferes(t.db, { token: la.token, comparisonId: B.comparisonId, now: BASE + 31 * NAP });
  assert.equal(masOsszeh.status, 404);
  const ismeretlen = await im.hozzaferes(t.db, { token: 'nincs-ilyen-token', imageId: A.kep[1], tarolo: t.tarolo });
  assert.equal(ismeretlen.status, 404);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'share.cross_guest_denied' AND result = 'denied' AND guest_id = ?1", A.guestId), 2);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'share.ismeretlen_token'"), 1);
  assert.equal(lb.token === la.token, false);
});

test('C11 30 nap utan nincs hozzaferes (410); uj link CSAK a regisztralt e-mail ellenorzesevel, egyszer hasznalhato tokennel; a valasz nem arulja el, hogy az e-mail letezik-e', async () => {
  const t = await ujTeszt();
  const v = await kepesVendeg(t);
  const t0 = BASE + 30 * NAP;
  const l = await im.linkKiad(t.db, { comparisonId: v.comparisonId, now: t0 });
  assert.equal((await im.hozzaferes(t.db, { token: l.token, now: t0 + LINK_ERVENYESSEG - 1 })).status, 200);
  const lejart = await im.hozzaferes(t.db, { token: l.token, imageId: v.kep[1], tarolo: t.tarolo, now: t0 + LINK_ERVENYESSEG });
  assert.deepEqual([lejart.ok, lejart.status, lejart.ujLinkKerheto, lejart.kep], [false, 410, true, undefined]);
  // uj link kerese: rossz e-mail / ismeretlen token / helyes e-mail -> UGYANAZ a publikus valasz
  const ido = t0 + LINK_ERVENYESSEG + 10;
  const rossz = await im.ujLinkKeres(t.db, { token: l.token, email: 'masvalaki@example.com', ipHash: 'ip1', now: ido });
  const nincs = await im.ujLinkKeres(t.db, { token: 'ismeretlen', email: VENDEG_A.email, ipHash: 'ip1', now: ido });
  const jo = await im.ujLinkKeres(t.db, { token: l.token, email: VENDEG_A.email.toUpperCase(), ipHash: 'ip1', now: ido });
  assert.deepEqual(rossz.valasz, jo.valasz);
  assert.deepEqual(nincs.valasz, jo.valasz);
  assert.equal(rossz.belso, null);
  assert.equal(nincs.belso, null);
  assert.equal(jo.belso.to, VENDEG_A.email);
  assert.equal(await szamol(t.db, 'share_grant'), 1);                  // az ellenorzesig NINCS uj hozzaferes
  assert.equal(await szamol(t.db, 'share_verification'), 1);
  assert.equal(JSON.stringify(await mind(t.db, 'SELECT * FROM share_verification')).includes(jo.belso.verificationToken), false);   // csak hash
  // ellenorzes: egyszer hasznalhato
  const uj = await im.ujLinkEllenoriz(t.db, { verifikaciosToken: jo.belso.verificationToken, now: ido + 60 });
  assert.equal(uj.status, 200);
  assert.equal(uj.expiresAt, ido + 60 + LINK_ERVENYESSEG);
  assert.equal((await im.hozzaferes(t.db, { token: uj.token, imageId: v.kep[3], tarolo: t.tarolo, now: ido + 120 })).status, 200);
  assert.equal((await im.ujLinkEllenoriz(t.db, { verifikaciosToken: jo.belso.verificationToken, now: ido + 61 })).status, 404);
  assert.equal((await elso(t.db, 'SELECT renewed_from FROM share_grant WHERE id = ?1', uj.grantId)).renewed_from, (await elso(t.db, 'SELECT id FROM share_grant ORDER BY issued_at LIMIT 1')).id);
  // a verifikacios token rovid eletu
  const jo2 = await im.ujLinkKeres(t.db, { token: l.token, email: VENDEG_A.email, ipHash: 'ip2', now: ido + 1000 });
  assert.equal((await im.ujLinkEllenoriz(t.db, { verifikaciosToken: jo2.belso.verificationToken, now: ido + 1000 + ELLENORZO_TOKEN_ERVENYESSEG })).status, 404);
});

test('C11 rate limit: sok kerelem utan sem derul ki semmi (azonos valasz, belso=null); munkatars altal visszavont link nem ujithato', async () => {
  const t = await ujTeszt();
  const v = await kepesVendeg(t);
  const l = await im.linkKiad(t.db, { comparisonId: v.comparisonId, now: BASE + 30 * NAP });
  const ido = BASE + 30 * NAP + LINK_ERVENYESSEG + 5;
  const ered = [];
  for (let i = 0; i < 7; i++) ered.push(await im.ujLinkKeres(t.db, { token: l.token, email: VENDEG_A.email, ipHash: 'ipx', now: ido + i }));
  assert.equal(ered.filter((x) => x.belso).length, 5);
  assert.ok(ered.every((x) => x.valasz.ok === true && x.valasz.uzenet === ered[0].valasz.uzenet));
  assert.ok(await szamol(t.db, 'security_audit', "action = 'share.renew_rate_limited'") >= 2);
  // staff-revoke
  const t2 = await ujTeszt();
  const w = await kepesVendeg(t2);
  const l2 = await im.linkKiad(t2.db, { comparisonId: w.comparisonId, now: BASE + 30 * NAP });
  assert.equal(await hibaKod(() => im.visszavon(t2.db, { grantId: l2.grantId, staffId: t2.staff.recepcio })), 'TILTOTT');
  assert.equal(await im.visszavon(t2.db, { grantId: l2.grantId, staffId: t2.staff.terapeuta, now: BASE + 31 * NAP }), 1);
  assert.equal((await im.hozzaferes(t2.db, { token: l2.token, now: BASE + 32 * NAP })).status, 404);
  assert.equal((await im.ujLinkKeres(t2.db, { token: l2.token, email: VENDEG_A.email, now: BASE + 33 * NAP })).belso, null);
});

test('C10 jogosultsag-ujraellenorzes: e-mailvaltozas es vendeg-osszevonas utan a link visszavonodik; az uj, regisztralt e-mailre ujra kerheto', async () => {
  const t = await ujTeszt({ masodikFiok: true });
  const v = await kepesVendeg(t);
  const l = await im.linkKiad(t.db, { comparisonId: v.comparisonId, now: BASE + 30 * NAP });
  assert.equal((await im.hozzaferes(t.db, { token: l.token, now: BASE + 31 * NAP })).status, 200);
  await emailValtoztat(t.db, { guestId: v.guestId, ujEmail: 'uj.cim@example.com', staffId: t.staff.recepcio, now: BASE + 32 * NAP });
  assert.equal((await im.hozzaferes(t.db, { token: l.token, now: BASE + 33 * NAP })).status, 404);
  assert.equal((await elso(t.db, 'SELECT revoke_reason FROM share_grant')).revoke_reason, 'email_changed');
  const ujra = await im.ujLinkKeres(t.db, { token: l.token, email: VENDEG_A.email, now: BASE + 34 * NAP });   // a regi cimre nem megy
  assert.equal(ujra.belso, null);
  const ujCim = await im.ujLinkKeres(t.db, { token: l.token, email: 'uj.cim@example.com', now: BASE + 34 * NAP });
  assert.equal(ujCim.belso.to, 'uj.cim@example.com');
  // merge: egy masik fiokbol erkezo, csak e-mail alapon egyezo vendeg a kezelo jovahagyasaval beolvad -> a forras linkjei visszavonodnak
  const t3 = await ujTeszt({ masodikFiok: true });
  const w = await kepesVendeg(t3);
  const m = await foglal(t3, { account: FIOK_2, vendeg: { nev: 'Anna T.', email: VENDEG_A.email, telefon: '+36 20 555 6666' }, guestExternalId: 'm-1', start: BASE + 300 * NAP });
  const lw = await im.linkKiad(t3.db, { comparisonId: w.comparisonId, now: BASE + 30 * NAP });
  await jovahagy(t3.db, { requestId: m.mergeRequestIds[0], staffId: t3.staff.terapeuta, now: BASE + 31 * NAP });   // cel = w.guestId
  assert.equal((await im.hozzaferes(t3.db, { token: lw.token, now: BASE + 32 * NAP })).status, 200);   // a cel vendeg linkje ervenyes marad
  // fordított irany: a kepes vendeg (forras) olvad be egy masikba
  const t4 = await ujTeszt({ masodikFiok: true });
  const x = await kepesVendeg(t4);
  const lx = await im.linkKiad(t4.db, { comparisonId: x.comparisonId, now: BASE + 30 * NAP });
  await t4.db.prepare("INSERT INTO guest (id, name, email, email_verified, phone, phone_verified, status, created_at, updated_at) VALUES ('cel', 'Cel', 'cel@example.com', 1, '+36709990000', 1, 'active', 1, 1)").run();
  const { automatikusOsszevon } = await import('../lib/merge.js');
  await automatikusOsszevon(t4.db, { forrasId: x.guestId, celId: 'cel', now: BASE + 31 * NAP });
  const merged = await im.hozzaferes(t4.db, { token: lx.token, now: BASE + 32 * NAP });
  assert.equal(merged.status, 404);
  assert.equal((await elso(t4.db, 'SELECT revoke_reason FROM share_grant')).revoke_reason, 'merge');
  assert.equal(await im.jogosultsagUjraellenorzes(t4.db, { guestId: x.guestId }), 0);
});

test('C12 nincs vendegportal: nincs vendeg-fiok / jelszo / regisztracio; a belepes (login_otp, session) csak munkatarsakra szol', async () => {
  const t = await ujTeszt();
  const oszlopok = (await mind(t.db, "SELECT m.name AS tabla, p.name AS oszlop FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table'"));
  assert.equal(oszlopok.filter((o) => /passw|jelszo|password_hash/i.test(o.oszlop)).length, 0);
  const sessFk = await mind(t.db, "SELECT \"table\" AS cel FROM pragma_foreign_key_list('session')");
  assert.deepEqual(sessFk.map((x) => x.cel), ['staff_user']);
  const modul = await import('../lib/images.js');
  assert.ok(!Object.keys(modul).some((k) => /regisztr|register|login|signup|fiok/i.test(k)));
  // a link tokenes: nincs "vendeg belepett" allapot, minden hozzaferes tokenre es resourcera szol
  assert.equal(typeof modul.hozzaferes, 'function');
});
