// Az API vegpontjai munkafolyamatonkent (happy path + a fo hibaaagak): vendegkereso / profil, munkalista, igazolas, berlet, credit, hozzajarulas, panasz,
// allapotfelmero, kuraterv + A5 PDF, kepek + osszehasonlitas + link, osszevonas, beallitasok / munkatarsak / audit, gepi vegpontok, opcionalis modulok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujApi, auditSor, NULLA_ID } from './api-kozos.test.mjs';
import { kezelesek, foglal, sessionok, elso, mind, szamol, jpegBajtok, pngBajtok, kerdoivBeallit, BASE, NAP, VENDEG_A, VENDEG_B } from './fixtures.js';
import { elerhetosegEllenorzott } from '../lib/guest.js';
import * as im from '../lib/images.js';
import { sha256 } from '../lib/db.js';

const JO_TERV = { fo_panasz: 'Hajhullas es viszketes.', megfigyelesek: ['Szuk hajszalak.'], cel: 'Nyugodtabb fejbor.', teljes_kura_11: true, ritmus_nap: 14, otthoni_apolas: { termek: 'Oxygeni sampon', hasznalat: 'Hetente kétszer.' }, kezeloi_javaslat: 'A fejbor jobb allapotban van. Javaslom a teljes kurat.', kovetkezo_idopont: { javasolt_intervallum: 'Két hét múlva' } };
const kep = (x, sid, m, bajtok = jpegBajtok(), tipus = 'image/jpeg', pont = '') => x.hivas('POST', `/kezelesek/${sid}/kepek${pont}`, { m, nyers: bajtok, tipus });

/** vendeg n kezelessel; az email ellenorzott */
async function vendegKezelessel(x, n = 3, vendeg = VENDEG_A) {
  const k = await kezelesek(x.t, { vendeg, n });
  await elerhetosegEllenorzott(x.db, { guestId: k[0].guestId, email: true, telefon: true });
  return { guestId: k[0].guestId, k, ss: await sessionok(x.db, k[0].guestId) };
}

test('VEGPONT vendegkereso: reszleges nev / e-mail / telefon, maszkolt kimenet; a kereses szovege nem kerul a naploba', async () => {
  const x = await ujApi();
  await vendegKezelessel(x, 1);
  await vendegKezelessel(x, 1, VENDEG_B);
  const m = x.session.recepcio;
  const nev = await x.get('/vendegek?q=anna', m);
  assert.equal(nev.status, 200);
  assert.equal(nev.json.vendegek.length, 1);
  const v = nev.json.vendegek[0];
  assert.equal(v.nev, 'Teszt Anna');
  assert.equal(v.email_maszkolt, 'an***@example.com');
  assert.match(v.telefon_maszkolt, /^\+36\*+\d\d$/);
  assert.ok(!JSON.stringify(v).includes('anna.teszt'));
  assert.equal(v.kura_allapot, 'active');
  assert.ok(v.utolso_foglalas > 0);
  assert.equal((await x.get('/vendegek?q=bela.te', m)).json.vendegek.length, 1, 'reszleges e-mail');
  assert.equal((await x.get('/vendegek?q=33344', m)).json.vendegek.length, 1, 'reszleges telefon (Bela: +36 20 333 4444)');
  assert.equal((await x.get('/vendegek?q=zzzz', m)).json.vendegek.length, 0);
  assert.equal((await x.get('/vendegek?q=a', m)).status, 422);
  assert.equal((await x.get('/vendegek', m)).status, 422);
  assert.equal((await x.get('/vendegek?q=%25%25', m)).json.vendegek.length, 0, 'a % nem joker');
  assert.ok(!JSON.stringify(await auditSor(x.db, "action = 'guest.search'")).includes('anna'));
});

test('VEGPONT vendegprofil: szerepkor szerinti szures (recepcio: nincs kep / dokumentum / kerdoiv / panasz); a kezelo mindent lat', async () => {
  const x = await ujApi();
  const v = await vendegKezelessel(x, 3);
  const rec = (await x.get(`/vendegek/${v.guestId}`, x.session.recepcio)).json;
  assert.equal(rec.vendeg.nev, 'Teszt Anna');
  assert.equal(rec.foglalasok.length, 3);
  assert.ok(rec.berletek && rec.credit && rec.hozzajarulasok && rec.kura && rec.uzenetek);
  assert.equal(rec.kepek, null); assert.equal(rec.dokumentumok, null); assert.equal(rec.panaszok, null);
  assert.equal(rec.klinikai_stop, undefined);
  assert.ok(!('questions' in rec) && !JSON.stringify(rec).includes('answers'));
  const kez = (await x.get(`/vendegek/${v.guestId}`, x.session.terapeuta2)).json;   // kezelo-valtas: minden kezelo latja
  assert.ok(Array.isArray(kez.kepek) && Array.isArray(kez.dokumentumok) && Array.isArray(kez.panaszok));
  assert.equal(kez.kura.kezelesek.length, 3);
  assert.equal(kez.dokumentumok.length, 2, '3 kezeles: 1. plan + 3. review');
  // marketing / admin: a vendegprofil nem erheto el (marketing) illetve csak alap (admin)
  assert.equal((await x.get(`/vendegek/${v.guestId}`, x.session.marketing)).status, 403);
  const adm = await x.get(`/vendegek/${v.guestId}`, x.session.admin);
  assert.equal(adm.status, 200);
  assert.equal(adm.json.dokumentumok, null); assert.equal(adm.json.berletek, null);
  assert.equal((await x.get(`/vendegek/${NULLA_ID}`, x.session.terapeuta)).status, 404);
  assert.ok((await auditSor(x.db, "action = 'guest.profile_view'")).length >= 3);
});

test('VEGPONT C01 C03 munkalista + kezeles-igazolas + no-show (csak jogosult kezelo; idempotens)', async () => {
  const x = await ujApi();
  const r1 = await foglal(x.t, { service: 'first_hair', start: x.t.ido + 1800, now: x.t.ido - 100, bookedAt: x.t.ido - 7 * NAP });
  const r2 = await foglal(x.t, { service: 'first_hair', vendeg: VENDEG_B, start: x.t.ido + 3600, now: x.t.ido - 100, bookedAt: x.t.ido - 7 * NAP });
  const nap = (await x.get('/munkalista', x.session.terapeuta)).json;
  assert.equal(nap.foglalasok.length, 2);
  assert.ok(nap.foglalasok[0].felmero.allapot === 'missing');
  assert.equal(nap.foglalasok[0].megjelent_igazolt, false);
  const recL = (await x.get(`/munkalista?nap=${nap.nap}`, x.session.recepcio)).json;
  assert.equal(recL.foglalasok[0].felmero, null, 'a recepcio nem latja a kerdoiv-allapotot');
  assert.equal((await x.get('/munkalista?nap=2026-02-30', x.session.terapeuta)).status, 422);
  // igazolas: recepcio tiltva (403 + audit), kezelo engedett; a masodik hivas idempotens
  assert.equal((await x.post(`/foglalasok/${r1.bookingId}/completed`, x.session.recepcio, {})).status, 403);
  const ok = await x.post(`/foglalasok/${r1.bookingId}/completed`, x.session.terapeuta, {});
  assert.equal(ok.status, 200);
  assert.equal(ok.json.kezeles_sorszam, 1); assert.equal(ok.json.kamera_kotelezo, true); assert.equal(ok.json.mar, false);
  const ujra = await x.post(`/foglalasok/${r1.bookingId}/completed`, x.session.terapeuta, {});
  assert.equal(ujra.json.mar, true); assert.equal(ujra.json.kezeles_sorszam, 1);
  assert.equal(await szamol(x.db, 'treatment_session'), 1);
  assert.equal((await x.post(`/foglalasok/${NULLA_ID}/completed`, x.session.terapeuta, {})).status, 404);
  // no-show: az idopont elott nem, utana igen; completed foglalas nem
  assert.equal((await x.post(`/foglalasok/${r2.bookingId}/no-show`, x.session.terapeuta, {})).status, 409);
  assert.equal((await x.post(`/foglalasok/${r1.bookingId}/no-show`, x.session.terapeuta, {})).status, 409);
  x.ido(2 * 3600);
  x.session.recepcio = await x.munkamenet(x.staff.recepcio); x.session.terapeuta = await x.munkamenet(x.staff.terapeuta);   // a 2 oras ugras utan az idle-session lejart
  assert.equal((await x.post(`/foglalasok/${r2.bookingId}/no-show`, x.session.recepcio, {})).status, 403);
  const ns = await x.post(`/foglalasok/${r2.bookingId}/no-show`, x.session.terapeuta, {});
  assert.equal(ns.status, 200); assert.equal(ns.json.allapot, 'no_show');
  assert.equal((await x.post(`/foglalasok/${r2.bookingId}/no-show`, x.session.terapeuta, {})).json.mar, true);
  assert.equal((await elso(x.db, 'SELECT status FROM booking WHERE id = ?1', r2.bookingId)).status, 'no_show');
  assert.equal(await szamol(x.db, 'treatment_session'), 1, 'a no-show nem kuraalkalom (C03)');
});

test('VEGPONT P01 P02 P05 berlet + ajandek + credit: vasarlas (recepcio), idempotencia, szalonvezeto jovahagyas (hosszabbit / korrekcio / refund tiltas)', async () => {
  const x = await ujApi();
  const v = await vendegKezelessel(x, 1);
  const rec = x.session.recepcio;
  const be = await x.hivas('POST', '/berletek', { m: rec, body: { guest_id: v.guestId, tipus: 'package_5', ajandek_atadva: true }, fejlecek: { 'idempotency-key': 'vasarlas-egyedi-001' } });
  assert.equal(be.status, 200, be.text);
  assert.equal(be.json.mar, false);
  const ismet = await x.hivas('POST', '/berletek', { m: rec, body: { guest_id: v.guestId, tipus: 'package_5' }, fejlecek: { 'idempotency-key': 'vasarlas-egyedi-001' } });
  assert.equal(ismet.json.mar, true); assert.equal(ismet.json.berlet_id, be.json.berlet_id);
  assert.equal(await szamol(x.db, 'package_purchase'), 1);
  const lista = (await x.get(`/vendegek/${v.guestId}/berletek`, rec)).json.berletek;
  assert.equal(lista[0].price_huf, 130000); assert.equal(lista[0].szabad, 5);
  // validacio
  assert.equal((await x.post('/berletek', rec, { guest_id: v.guestId, tipus: 'package_7' })).status, 422);
  assert.equal((await x.post('/berletek', rec, { guest_id: 'nem-uuid', tipus: 'package_5' })).status, 422);
  assert.equal((await x.post('/berletek', rec, { guest_id: NULLA_ID, tipus: 'package_5' })).status, 404);
  assert.equal((await x.post('/berletek', rec, { guest_id: v.guestId, tipus: 'package_5', fizetes_ideje: '2999-01-01' })).status, 422);
  assert.equal((await x.post('/berletek', x.session.terapeuta, { guest_id: v.guestId, tipus: 'package_5' })).status, 403);
  // szalonvezetoi jovahagyas
  const id = be.json.berlet_id;
  assert.equal((await x.post(`/berletek/${id}/hosszabbit`, rec, { honap: 1, ok: 'kivétel' })).status, 403);
  assert.equal((await x.post(`/berletek/${id}/hosszabbit`, x.session.vezeto, { honap: 1 })).status, 422, 'indok nelkul nincs');
  const h = await x.post(`/berletek/${id}/hosszabbit`, x.session.vezeto, { honap: 1, ok: 'betegseg miatt' });
  assert.equal(h.status, 200); assert.ok(h.json.lejarat > 0);
  assert.equal((await x.post(`/berletek/${id}/korrekcio`, x.session.vezeto, { delta: 1, ok: 'kezi javitas' })).status, 200);
  assert.equal((await x.post(`/berletek/${id}/korrekcio`, x.session.vezeto, { delta: 0, ok: 'kezi javitas' })).status, 422);
  assert.equal((await x.post(`/berletek/${id}/refund`, x.session.vezeto, { mod: 'teljes', ok: 'nincs ellenjavallat' })).status, 409, 'teljes refund csak vegleges ellenjavallattal');
  assert.ok((await auditSor(x.db, "action IN ('package.extend', 'package.correction')")).length >= 2);
  // ajandek atadas
  const aj = await mind(x.db, 'SELECT id, status FROM package_gift WHERE purchase_id = ?1', id);
  assert.ok(aj.every((a) => a.status === 'handed_over'));
  // credit: nincs; a levonas 404 / 409
  assert.deepEqual((await x.get(`/vendegek/${v.guestId}/credit`, rec)).json.creditek, []);
  assert.equal((await x.post(`/credit/${NULLA_ID}/levonas`, rec, { booking_id: v.k[0].bookingId })).status, 404);
  assert.equal((await x.post(`/credit/${NULLA_ID}/levonas`, x.session.vezeto, { booking_id: v.k[0].bookingId })).status, 403);
});

test('VEGPONT P06 P07 credit: kamera-felmeres -> first foglalas -> jogosult -> egyszeri levonas (409 masodszor)', async () => {
  const x = await ujApi();
  const kam = await foglal(x.t, { service: 'camera_assessment', start: BASE, now: BASE - NAP, bookedAt: BASE - NAP });
  assert.equal((await x.post(`/foglalasok/${kam.bookingId}/completed`, x.session.terapeuta, {})).status, 200);
  const first = await foglal(x.t, { service: 'first_hair', start: BASE + 10 * NAP, now: BASE + 2 * NAP, bookedAt: BASE + 2 * NAP });
  const cr = (await x.get(`/vendegek/${kam.guestId}/credit`, x.session.recepcio)).json.creditek;
  assert.equal(cr.length, 1);
  assert.equal(cr[0].jogosult, true); assert.equal(cr[0].fizetendoAzElsoKezelesre, 24910);
  const le = await x.post(`/credit/${cr[0].creditId}/levonas`, x.session.recepcio, { booking_id: first.bookingId });
  assert.equal(le.status, 200); assert.equal(le.json.levonas, 4990);
  const masodszor = await x.post(`/credit/${cr[0].creditId}/levonas`, x.session.terapeuta, { booking_id: first.bookingId });
  assert.equal(masodszor.status, 409);
  assert.equal(masodszor.json.hiba.kod, 'CREDIT_MAR_FELHASZNALVA');
  assert.equal((await x.get(`/vendegek/${kam.guestId}/credit`, x.session.terapeuta)).json.creditek[0].allapot, 'used');
});

test('VEGPONT S02 B10 hozzajarulas: rogzites, azonnali visszavonas a marketing-kaput bezarja, a foglalas nem fugg tole (B10)', async () => {
  const x = await ujApi();
  const v = await vendegKezelessel(x, 1);
  const rec = x.session.recepcio;
  const nincs = (await x.get(`/vendegek/${v.guestId}/hozzajarulasok`, rec)).json;
  assert.equal(nincs.marketing.email.ok, false); assert.equal(nincs.marketing.email.ok_kod, 'NINCS_HOZZAJARULAS');
  assert.equal((await x.post(`/vendegek/${v.guestId}/hozzajarulasok`, rec, { csatorna: 'email_marketing', allapot: 'granted' })).status, 422, 'szovegverzio nelkul nincs');
  const g = await x.post(`/vendegek/${v.guestId}/hozzajarulasok`, rec, { csatorna: 'email_marketing', allapot: 'granted', szoveg_verzio: 'teszt-v1' });
  assert.equal(g.status, 200);
  assert.equal(g.json.marketing.email.ok, true);
  const w = await x.post(`/vendegek/${v.guestId}/hozzajarulasok`, rec, { csatorna: 'email_marketing', allapot: 'withdrawn' });
  assert.equal(w.status, 200);
  assert.equal(w.json.marketing.email.ok, false); assert.equal(w.json.marketing.email.ok_kod, 'VISSZAVONVA');
  assert.equal((await x.get(`/vendegek/${v.guestId}/hozzajarulasok`, x.session.terapeuta)).json.tortenet.length, 2);
  assert.equal((await elso(x.db, "SELECT COUNT(*) AS n FROM outbox_event WHERE event_type = 'consent.withdrawn'")).n, 1);
  assert.equal((await x.post(`/vendegek/${v.guestId}/hozzajarulasok`, rec, { csatorna: 'fax', allapot: 'granted', szoveg_verzio: 'v' })).status, 422);
  assert.equal((await x.post(`/vendegek/${NULLA_ID}/hozzajarulasok`, rec, { csatorna: 'email_marketing', allapot: 'withdrawn' })).status, 404);
  assert.equal((await x.post(`/vendegek/${v.guestId}/hozzajarulasok`, x.session.terapeuta, { csatorna: 'email_marketing', allapot: 'withdrawn' })).status, 403, 'a kezelo csak olvassa');
  assert.equal((await x.get(`/vendegek/${v.guestId}/hozzajarulasok`, x.session.vezeto)).status, 403);
});

test('VEGPONT panasz: lista, probalkozas (csak a felelos kezelo), kompenzacio-kerelem + szalonvezetoi dontes, lezaras', async () => {
  const x = await ujApi();
  const v = await vendegKezelessel(x, 1);
  const nyit = await x.post(`/vendegek/${v.guestId}/panaszok`, x.session.terapeuta, { leiras: 'Elegedetlen volt.', booking_id: v.k[0].bookingId });
  assert.equal(nyit.status, 200);
  const pid = nyit.json.complaintId;
  const lista = (await x.get('/panaszok?allapot=open', x.session.vezeto)).json.panaszok;
  assert.equal(lista.length, 1); assert.equal(lista[0].id, pid); assert.equal(lista[0].sajat, false);
  assert.equal((await x.get('/panaszok', x.session.recepcio)).status, 403);
  assert.equal((await x.get('/panaszok?allapot=x', x.session.vezeto)).status, 422);
  // a masik kezelo / szakmai vezeto NEM intezheti
  assert.equal((await x.post(`/panaszok/${pid}/probalkozas`, x.session.terapeuta2, { tipus: 'call', eredmeny: 'reached' })).status, 403);
  assert.equal((await x.post(`/panaszok/${pid}/probalkozas`, x.session.janka, { tipus: 'call', eredmeny: 'reached' })).status, 403);
  assert.equal((await x.post(`/panaszok/${pid}/probalkozas`, x.session.terapeuta, { tipus: 'sms', eredmeny: 'reached' })).status, 422);
  assert.equal((await x.post(`/panaszok/${pid}/probalkozas`, x.session.terapeuta, { tipus: 'call', eredmeny: 'reached', megjegyzes: 'Telefonon elerheto.' })).status, 200);
  // lezaras elott kompenzacio-kerelem, dontes csak szalonvezeto
  const kom = await x.post(`/panaszok/${pid}/kompenzacio`, x.session.terapeuta, { tipus: 'discount', osszeg: 5000 });
  assert.equal(kom.status, 200);
  assert.equal((await x.post(`/kompenzaciok/${kom.json.approvalId}/dontes`, x.session.terapeuta, { dontes: 'approved' })).status, 403);
  assert.equal((await x.post(`/kompenzaciok/${kom.json.approvalId}/dontes`, x.session.vezeto, { dontes: 'approved' })).status, 200);
  assert.equal((await x.post(`/kompenzaciok/${kom.json.approvalId}/dontes`, x.session.vezeto, { dontes: 'approved' })).status, 409);
  const nemElegedett = await x.post(`/panaszok/${pid}/lezar`, x.session.terapeuta, { megoldas: 'Elnezest kertunk.', vendeg_elegedett: false });
  assert.equal(nemElegedett.json.lezarva, false);
  assert.equal((await x.post(`/panaszok/${pid}/lezar`, x.session.terapeuta, { megoldas: 'Elnezest kertunk.', vendeg_elegedett: 'igen' })).status, 422);
  const kesz = await x.post(`/panaszok/${pid}/lezar`, x.session.terapeuta, { megoldas: 'Megoldva, a vendeg elegedett.', vendeg_elegedett: true });
  assert.equal(kesz.json.lezarva, true);
  // felelos csere: csak szalonvezeto
  assert.equal((await x.post(`/panaszok/${pid}/felelos`, x.session.terapeuta, { uj_kezelo_id: x.staff.terapeuta2, ok: 'tavollet' })).status, 403);
  // elegedettseg-riport
  const rip = await x.get('/elegedettseg', x.session.vezeto);
  assert.equal(rip.status, 200); assert.ok(Array.isArray(rip.json.kezelok));
  assert.equal((await x.get('/elegedettseg?tol=nem-datum', x.session.vezeto)).status, 422);
  assert.equal((await x.get('/elegedettseg', x.session.recepcio)).status, 403);
});

test('VEGPONT C09 allapotfelmero: verzio-jovahagyas (Janka), kiadas, publikus kitoltes, kontraindikacio-jelzes, kezeloi attekintes', async () => {
  const x = await ujApi();
  const fogl = await foglal(x.t, { service: 'first_hair', start: x.t.ido + 3 * NAP, now: x.t.ido - 100, bookedAt: x.t.ido - 100 });
  // jovahagyatlan verzio: a kiadas 409, a recepcio nem adhat ki
  assert.equal((await x.post(`/foglalasok/${fogl.bookingId}/felmero-kiad`, x.session.recepcio, {})).status, 403);
  assert.equal((await x.post(`/foglalasok/${fogl.bookingId}/felmero-kiad`, x.session.terapeuta, {})).status, 409);
  // verzio: csak a szakmai vezeto hozza letre / hagyja jova
  assert.equal((await x.post('/felmero/verziok', x.session.terapeuta, { verzio: 'v1' })).status, 403);
  assert.equal((await x.post('/felmero/verziok', x.session.janka, { verzio: 'v1 rossz' })).status, 422);
  assert.equal((await x.post('/felmero/verziok', x.session.janka, { verzio: 'v1', definicio: { csoportok: [] } })).status, 422);
  const uj = await x.post('/felmero/verziok', x.session.janka, { verzio: 'v1' });
  assert.equal(uj.status, 200, uj.text);
  const lista = (await x.get('/felmero/verziok', x.session.janka)).json;
  assert.equal(lista.verziok.length, 1); assert.equal(lista.verziok[0].jovahagyva, false); assert.equal(lista.kiadhato.ok, false);
  assert.equal((await x.get('/felmero/verziok', x.session.terapeuta)).status, 403);
  assert.equal((await x.post(`/felmero/verziok/${lista.verziok[0].id}/jovahagy`, x.session.terapeuta, {})).status, 403);
  assert.equal((await x.post(`/felmero/verziok/${lista.verziok[0].id}/jovahagy`, x.session.janka, {})).status, 200);
  assert.equal((await x.post(`/felmero/verziok/${lista.verziok[0].id}/jovahagy`, x.session.janka, {})).status, 409);
  // kiadas + kitoltes (publikus, JSON): pozitiv biztonsagi valasz -> jelzes
  const kiad = await x.post(`/foglalasok/${fogl.bookingId}/felmero-kiad`, x.session.terapeuta, {});
  assert.equal(kiad.status, 200);
  assert.match(kiad.json.link, /\/api\/crm\/public\/felmero\/[A-Za-z0-9_-]{43}$/);
  assert.equal((await elso(x.db, 'SELECT COUNT(*) AS n FROM assessment_submission WHERE token_hash = ?1', kiad.json.token)).n, 0, 'a token nincs nyersen az adatbazisban');
  const beadas = await x.hivas('POST', `/public/felmero/${kiad.json.token}`, { body: { valaszok: { adatkezeles_elfogadva: true, panasz_tipus: ['hajhullas'], korabbi_reakcio: true, termek_allergia: false, aktualis_fejbor_tunet: false, hajmosasi_szunet_tudomasul: true, sulyosbodo_tunet: false } } });
  assert.equal(beadas.status, 200);
  assert.deepEqual(beadas.json, { ok: true }, 'a vendeg nem lat klinikai ertekelest');
  // munkatars-oldal: csak a kezelo / szakmai vezeto latja
  assert.equal((await x.get(`/foglalasok/${fogl.bookingId}/felmero`, x.session.recepcio)).status, 403);
  const f = (await x.get(`/foglalasok/${fogl.bookingId}/felmero`, x.session.terapeuta)).json;
  assert.equal(f.kitoltve, true); assert.equal(f.jelzes, true); assert.deepEqual(f.jelzett_kerdesek, ['korabbi_reakcio']);
  assert.equal(f.valaszok.korabbi_reakcio, true); assert.equal(f.riasztas.allapot, 'open');
  assert.equal((await x.get('/munkalista', x.session.terapeuta)).json.foglalasok[0]?.kontraindikacio_jelzes ?? true, true);
  assert.equal((await auditSor(x.db, "action = 'assessment.read' AND result = 'ok'")).length, 1);
  assert.equal((await auditSor(x.db, "action = 'assessment.read' AND result = 'denied'")).length, 1, 'a recepcio kiserlete naplozott');
  // a nyitott riasztas mellett a kezeles nem igazolhato (C09), attekintes: csak kezelo / Janka
  assert.equal((await x.post(`/foglalasok/${fogl.bookingId}/completed`, x.session.terapeuta, {})).status, 409);
  assert.equal((await x.post(`/felmero/${f.beadas_id}/attekint`, x.session.recepcio, { eredmeny: 'cleared' })).status, 403);
  assert.equal((await x.post(`/felmero/${f.beadas_id}/attekint`, x.session.terapeuta, { eredmeny: 'talan' })).status, 422);
  assert.equal((await x.post(`/felmero/${f.beadas_id}/attekint`, x.session.terapeuta, { eredmeny: 'cleared', megjegyzes: 'Rendben.' })).status, 200);
  assert.equal((await x.post(`/foglalasok/${fogl.bookingId}/completed`, x.session.terapeuta, {})).status, 200);
  assert.equal((await x.post(`/felmero/${NULLA_ID}/attekint`, x.session.terapeuta, { eredmeny: 'cleared' })).status, 404);
});

test('VEGPONT C07 C08 kuraterv + A5 PDF + kuldes: mentes, hianyzo mezok, veglegesites, PDF (vazlat / vegleges), kuldes csak kesz dokumentumnal', async () => {
  const x = await ujApi();
  const v = await vendegKezelessel(x, 1);
  const sid = v.ss[0].id;
  const m = x.session.terapeuta;
  const t0 = (await x.get(`/kezelesek/${sid}/terv`, m)).json;
  assert.equal(t0.terv.allapot, 'missing'); assert.equal(t0.terv.fajta, 'plan');
  assert.ok(t0.hianyzo_mezok.length > 3);
  assert.equal(t0.kuldheto.ok, false);
  assert.equal((await x.get(`/kezelesek/${sid}/terv`, x.session.recepcio)).status, 403);
  assert.equal((await x.hivas('PUT', `/kezelesek/${sid}/terv`, { m: x.session.recepcio, body: { mezok: JO_TERV } })).status, 403);
  assert.equal((await x.hivas('PUT', `/kezelesek/${sid}/terv`, { m, body: { mezok: 'nem-objektum' } })).status, 422);
  assert.equal((await x.hivas('PUT', `/kezelesek/${sid}/terv`, { m, body: { mezok: { 'rossz kulcs': 1 } } })).status, 422);
  assert.equal((await x.hivas('PUT', `/kezelesek/${sid}/terv`, { m, body: { mezok: { fo_panasz: 'x'.repeat(4001) } } })).status, 422);
  // vazlat-PDF (nem tarolodik)
  assert.equal((await x.hivas('PUT', `/kezelesek/${sid}/terv`, { m, body: { mezok: { fo_panasz: 'Csak ennyi.' } } })).status, 200);
  const tid = t0.terv.id;
  const vazlat = await x.get(`/tervek/${tid}/a5.pdf`, m);
  assert.equal(vazlat.status, 200);
  assert.equal(vazlat.headers.get('content-type'), 'application/pdf');
  assert.match(vazlat.headers.get('content-disposition'), /^inline; filename="a5-/);
  assert.equal(new TextDecoder().decode(vazlat.bajtok.slice(0, 5)), '%PDF-');
  assert.equal(vazlat.headers.get('cache-control'), 'no-store');
  assert.equal((await x.post(`/tervek/${tid}/veglegesit`, m, {})).status, 422, 'hianyos mezok -> HIANYOS_MEZOK (validacio)');
  assert.equal((await x.post(`/tervek/${tid}/kuld`, m, {})).status, 409);
  // teljes urlap -> veglegesites -> PDF tarolva
  await x.hivas('PUT', `/kezelesek/${sid}/terv`, { m, body: { mezok: JO_TERV } });
  assert.equal((await x.post(`/tervek/${tid}/veglegesit`, x.session.recepcio, {})).status, 403);
  assert.equal((await x.post(`/tervek/${tid}/veglegesit`, m, {})).status, 200);
  // kuldes: az 1. alkalom kepe nelkul NEM (C07), kepfeltoltes utan igen
  const nemKuld = await x.post(`/tervek/${tid}/kuld`, m, {});
  assert.equal(nemKuld.status, 409);
  assert.ok(nemKuld.json.hiba.reszletek.includes('KEP:alkalom_kepe_hianyzik'));
  assert.equal((await kep(x, sid, m)).status, 200);
  const pdf = await x.get(`/tervek/${tid}/a5.pdf`, m);
  assert.equal(pdf.status, 200);
  assert.equal((await elso(x.db, 'SELECT status FROM treatment_plan WHERE id = ?1', tid)).status, 'generated_pdf');
  const k = await x.post(`/tervek/${tid}/kuld`, m, {});
  assert.equal(k.status, 200, k.text);
  assert.equal(k.json.kuldes_mod, 'dry');
  assert.equal((await elso(x.db, 'SELECT status FROM treatment_plan WHERE id = ?1', tid)).status, 'sent');
  assert.equal((await elso(x.db, "SELECT COUNT(*) AS n FROM outbox_event WHERE event_type = 'plan.sent'")).n, 1);
  assert.equal(x.kuldott.length, 0, 'az API nem kuld levelet: csak az outboxba ir');
  assert.equal((await x.post(`/tervek/${tid}/kuld`, m, {})).json.mar, true);
  assert.equal((await x.hivas('PUT', `/kezelesek/${sid}/terv`, { m, body: { mezok: JO_TERV } })).status, 409, 'az elkuldott dokumentum nem szerkesztheto');
  assert.equal((await x.get(`/tervek/${NULLA_ID}/a5.pdf`, m)).status, 404);
  assert.equal((await x.get(`/tervek/${NULLA_ID}/a5.pdf`, x.session.recepcio)).status, 403);
  // hianyzo dokumentumok (24h / 48h): a 3. alkalom review-ja hianyzik
  const h = await x.get('/dokumentumok/hianyzo', x.session.janka);
  assert.equal(h.status, 200);
  assert.equal((await x.get('/dokumentumok/hianyzo', x.session.recepcio)).status, 403);
});

test('VEGPONT C06 kurazaro (11. alkalom): A5 + kuldes csak a vegleges, kepes dokumentummal', async () => {
  const x = await ujApi();
  const v = await vendegKezelessel(x, 11);
  const courseId = (await elso(x.db, 'SELECT id FROM course WHERE guest_id = ?1', v.guestId)).id;
  const m = x.session.terapeuta;
  assert.equal((await x.post(`/kurak/${courseId}/kurazaro`, x.session.recepcio, {})).status, 403);
  assert.equal((await x.post(`/kurak/${NULLA_ID}/kurazaro`, m, {})).status, 404);
  assert.equal((await x.post(`/kurak/${courseId}/kurazaro`, m, {})).status, 409, 'a zaro dokumentum meg hianyzik');
  const s11 = v.ss.find((s) => s.treatment_index === 11);
  const terv = (await x.get(`/kezelesek/${s11.id}/terv`, m)).json;
  assert.equal(terv.terv.fajta, 'closing');
  await x.hivas('PUT', `/kezelesek/${s11.id}/terv`, { m, body: { mezok: { kiindulo_panasz: 'Hajhullas.', cel: 'Eros haj.', zaro_ertekeles: 'Szepen javult.', fenntartasi_javaslat: 'Otthoni rutin.', otthoni_rutin: 'Hetente 2x.', hianyzo_kep_indok: 'A kepek nem keszultek.' } } });
  assert.equal((await x.post(`/tervek/${terv.terv.id}/veglegesit`, m, {})).status, 200);
  const kz = await x.post(`/kurak/${courseId}/kurazaro`, m, {});
  assert.equal(kz.status, 200, kz.text);
  assert.equal(kz.json.elkuldve, true);
  assert.equal((await elso(x.db, 'SELECT status FROM treatment_plan WHERE id = ?1', terv.terv.id)).status, 'sent');
});

test('VEGPONT C04 kepek: feltoltes (jpeg / png), megtekintes csak kezelonek, osszehasonlitas -> veglegesites (2-3 mondat) -> 30 napos link', async () => {
  const x = await ujApi();
  const v = await vendegKezelessel(x, 3);
  const m = x.session.terapeuta;
  const s1 = v.ss.find((s) => s.treatment_index === 1), s2 = v.ss.find((s) => s.treatment_index === 2), s3 = v.ss.find((s) => s.treatment_index === 3);
  // jogosultsag, alkalom, pont
  assert.equal((await kep(x, s1.id, x.session.recepcio)).status, 403);
  assert.equal((await kep(x, s2.id, m)).status, 409, 'a 2. alkalmon nincs kotelezo kep');
  assert.equal((await kep(x, s1.id, m, jpegBajtok(), 'image/jpeg', '?pont=3')).status, 422, 'a pont egyezzen az alkalommal');
  assert.equal((await kep(x, s1.id, m, jpegBajtok(), 'image/jpeg', '?pont=7')).status, 422);
  assert.equal((await kep(x, NULLA_ID, m)).status, 404);
  const a = await kep(x, s1.id, m, jpegBajtok(), 'image/jpeg', '?pont=1');
  assert.equal(a.status, 200, a.text);
  assert.match(a.json.id, /^[0-9a-f-]{36}$/); assert.equal(a.json.alkalom, 1);
  assert.equal((await kep(x, s1.id, m)).status, 409, 'ugyanahhoz az alkalomhoz es ponthoz masodik kep nem');
  const b = await kep(x, s3.id, m, pngBajtok(), 'image/png');
  assert.equal(b.status, 200, b.text);
  // a storage_key szerver-oldali UUID-s utvonal, a felhasznalo nem befolyasolja
  const sor = await elso(x.db, 'SELECT storage_key, mime FROM camera_image WHERE id = ?1', a.json.id);
  assert.match(sor.storage_key, new RegExp(`^kepek/${v.guestId}/${s1.id}/${a.json.id}\\.jpg$`));
  // megtekintes
  const le = await x.get(`/kepek/${a.json.id}`, x.session.terapeuta2);
  assert.equal(le.status, 200);
  assert.equal(le.headers.get('content-type'), 'image/jpeg');
  assert.equal(le.headers.get('x-content-type-options'), 'nosniff');
  assert.match(le.headers.get('content-disposition'), /^inline; filename="kep-[0-9a-f-]+\.jpg"$/);
  assert.deepEqual([...le.bajtok.slice(0, 3)], [0xff, 0xd8, 0xff]);
  assert.equal((await x.get(`/kepek/${a.json.id}`, x.session.recepcio)).status, 403);
  assert.equal((await x.get(`/kepek/${NULLA_ID}`, x.session.recepcio)).status, 403, 'nemletezo kep: ugyanaz a 403, nem szivarog');
  assert.equal((await x.get(`/kepek/${NULLA_ID}`, m)).status, 404);
  // osszehasonlitas
  assert.equal((await x.post('/osszehasonlitas', x.session.recepcio, { kep_a: a.json.id, kep_b: b.json.id })).status, 403);
  assert.equal((await x.post('/osszehasonlitas', m, { kep_a: a.json.id, kep_b: a.json.id })).status, 422);
  assert.equal((await x.post('/osszehasonlitas', m, { kep_a: b.json.id, kep_b: a.json.id })).status, 422, 'A = korabbi alkalom');
  assert.equal((await x.post('/osszehasonlitas', m, { kep_a: a.json.id, kep_b: 'nem-uuid' })).status, 422);
  const o = await x.post('/osszehasonlitas', m, { kep_a: a.json.id, kep_b: b.json.id, komment: 'Eros haj.' });
  assert.equal(o.status, 200);
  assert.equal((await x.post(`/osszehasonlitas/${o.json.id}/veglegesit`, m, { komment: 'Egy mondat.' })).status, 422, '2-3 mondat kell');
  assert.equal((await x.post(`/osszehasonlitas/${o.json.id}/link`, m, {})).status, 409, 'veglegesites nelkul nincs link');
  assert.equal((await x.post(`/osszehasonlitas/${o.json.id}/veglegesit`, m, { komment: 'Szurubb a haj. A fejbor nyugodt.' })).status, 200);
  assert.equal((await x.post(`/osszehasonlitas/${o.json.id}/link`, m, {})).status, 409, 'kesz kezeloi dokumentacio nelkul nincs link');
  // a 3. alkalom dokumentacioja (review) kesz -> link
  const rev = await elso(x.db, "SELECT id FROM treatment_plan WHERE kind = 'review' AND guest_id = ?1", v.guestId);
  await x.hivas('PUT', `/kezelesek/${s3.id}/terv`, { m, body: { mezok: { ertekeles: 'Javul a kep. A fejbor nyugodt.', otthoni_rutin_kontroll: 'Rendben.' } } });
  assert.equal((await x.post(`/tervek/${rev.id}/veglegesit`, m, {})).status, 200);
  assert.equal((await x.post(`/osszehasonlitas/${o.json.id}/link`, x.session.recepcio, {})).status, 403);
  const link = await x.post(`/osszehasonlitas/${o.json.id}/link`, m, {});
  assert.equal(link.status, 200, link.text);
  assert.match(link.json.link, /\/api\/crm\/public\/kep\/[A-Za-z0-9_-]{43}$/);
  assert.equal(link.json.lejar - x.t.ido, 30 * 86400);
  const token = link.json.link.split('/').pop();
  assert.equal((await elso(x.db, 'SELECT COUNT(*) AS n FROM share_grant WHERE token_hash = ?1', token)).n, 0, 'nyers token nincs az adatbazisban');
  assert.equal((await elso(x.db, 'SELECT COUNT(*) AS n FROM share_grant WHERE token_hash = ?1', await sha256(token))).n, 1);
  // a vendeg a publikus oldalon latja
  const lap = await x.get(`/public/kep/${token}`);
  assert.equal(lap.status, 200);
  assert.match(lap.text, /Szurubb a haj\. A fejbor nyugodt\./);
  assert.ok(lap.text.includes(`/api/crm/public/kep/${token}/${a.json.id}`));
  const kepBe = await x.get(`/public/kep/${token}/${a.json.id}`);
  assert.equal(kepBe.status, 200);
  assert.deepEqual([...kepBe.bajtok.slice(0, 3)], [0xff, 0xd8, 0xff]);
});

test('VEGPONT B11 B12 osszevonas: lista, jovahagyas, elutasitas, visszaforditas (csak kezelo / szalonvezeto-olvasas; indok kotelezo)', async () => {
  const x = await ujApi();
  const a = await foglal(x.t, { vendeg: { nev: 'Kovacs Eva', email: 'eva@example.com', telefon: '+36 30 555 0001' }, start: BASE + NAP, guestExternalId: 'x-1' });
  const b = await foglal(x.t, { vendeg: { nev: 'Kovacs Eva', email: 'eva@example.com', telefon: '+36 30 555 9999' }, start: BASE + 2 * NAP, guestExternalId: 'x-2' });
  const l = (await x.get('/osszevonas', x.session.terapeuta)).json;
  assert.equal(l.keresek.length, 1);
  assert.equal(l.keresek[0].email_egyezes, true); assert.equal(l.keresek[0].telefon_egyezes, false);
  assert.equal((await x.get('/osszevonas', x.session.recepcio)).status, 403);
  assert.equal((await x.get('/osszevonas', x.session.vezeto)).status, 200);
  const id = l.keresek[0].id;
  assert.equal((await x.post(`/osszevonas/${id}/jovahagy`, x.session.recepcio, {})).status, 403);
  assert.equal((await x.post(`/osszevonas/${id}/jovahagy`, x.session.vezeto, {})).status, 403, 'a szalonvezeto csak olvassa');
  const ok = await x.post(`/osszevonas/${id}/jovahagy`, x.session.terapeuta, { megjegyzes: 'Ugyanaz a vendeg.' });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await x.post(`/osszevonas/${id}/jovahagy`, x.session.terapeuta, {})).status, 409);
  assert.equal((await x.post(`/osszevonas-audit/${ok.json.merge_audit_id}/visszafordit`, x.session.terapeuta, {})).status, 422, 'indok kotelezo');
  assert.equal((await x.post(`/osszevonas-audit/${ok.json.merge_audit_id}/visszafordit`, x.session.recepcio, { ok: 'tevedes volt' })).status, 403);
  assert.equal((await x.post(`/osszevonas-audit/${ok.json.merge_audit_id}/visszafordit`, x.session.terapeuta, { ok: 'tevedes volt' })).status, 200);
  assert.equal((await x.post(`/osszevonas-audit/${ok.json.merge_audit_id}/visszafordit`, x.session.terapeuta, { ok: 'tevedes volt' })).status, 409);
  assert.equal((await x.post(`/osszevonas/${NULLA_ID}/elutasit`, x.session.terapeuta, {})).status, 404);
  // az e-mail csere: jogosultsag, validacio, link-visszavonas
  assert.equal((await x.post(`/vendegek/${a.guestId}/email`, x.session.vezeto, { email: 'uj@example.com' })).status, 403);
  assert.equal((await x.post(`/vendegek/${a.guestId}/email`, x.session.recepcio, { email: 'nem-email' })).status, 422);
  const em = await x.post(`/vendegek/${a.guestId}/email`, x.session.recepcio, { email: 'Uj.Eva@Example.com' });
  assert.equal(em.status, 200); assert.equal(em.json.valtozott, true);
  assert.equal((await elso(x.db, 'SELECT email, email_verified FROM guest WHERE id = ?1', a.guestId)).email, 'uj.eva@example.com');
  assert.equal((await x.post(`/vendegek/${NULLA_ID}/email`, x.session.recepcio, { email: 'uj@example.com' })).status, 404);
  void b;
});

test('VEGPONT beallitasok / munkatarsak / audit / Salonic-allapot / uzenetek: szerepkor, validacio, audit export (CSV-injekcio ellen)', async () => {
  const x = await ujApi();
  const adm = x.session.admin, vez = x.session.vezeto;
  // beallitasok
  assert.equal((await x.get('/beallitasok', x.session.terapeuta)).status, 403);
  assert.equal((await x.hivas('PUT', '/beallitasok/adatmegorzes_honap', { m: adm, body: { ertek: 36 } })).status, 200);
  assert.equal((await x.hivas('PUT', '/beallitasok/jogi.hirlevel', { m: vez, body: { ertek: { verzio: 'v2' } } })).status, 200);
  assert.equal((await x.hivas('PUT', '/beallitasok/Rossz Kulcs', { m: adm, body: { ertek: 1 } })).status, 422);
  assert.equal((await x.hivas('PUT', '/beallitasok/pending_consent:e:abc', { m: adm, body: { ertek: 1 } })).status, 422, 'belso kulcs nem irhato');
  assert.equal((await x.hivas('PUT', '/beallitasok/demo_betoltve', { m: adm, body: { ertek: 1 } })).status, 422);
  assert.equal((await x.hivas('PUT', '/beallitasok/x', { m: adm, body: {} })).status, 422);
  assert.equal((await x.hivas('PUT', '/beallitasok/x', { m: x.session.recepcio, body: { ertek: 1 } })).status, 403);
  await x.t.db.prepare("INSERT INTO beallitasok (kulcs, ertek, frissitve) VALUES ('pending_consent:e:titok', '{}', 1)").run();
  const be = (await x.get('/beallitasok', adm)).json.beallitasok;
  assert.deepEqual(be.map((b) => b.kulcs).sort(), ['adatmegorzes_honap', 'jogi.hirlevel']);
  assert.equal(be.find((b) => b.kulcs === 'adatmegorzes_honap').ertek, 36);
  // munkatarsak
  assert.equal((await x.get('/munkatarsak', vez)).status, 403, 'az rbac-matrixban a staff_admin csak az admine');
  const lista = (await x.get('/munkatarsak', adm)).json.munkatarsak;
  assert.equal(lista.length, 7);
  assert.equal((await x.post('/munkatarsak', adm, { email: 'nem-email', nev: 'Uj', szerepek: ['therapist'] })).status, 422);
  assert.equal((await x.post('/munkatarsak', adm, { email: 'uj@example.com', nev: 'Uj Kezelo', szerepek: ['root'] })).status, 422);
  const uj = await x.post('/munkatarsak', adm, { email: 'Uj@Example.com', nev: 'Uj Kezelo', szerepek: ['therapist'], salonic_nev: 'Uj' });
  assert.equal(uj.status, 200, uj.text);
  assert.equal((await x.post('/munkatarsak', adm, { email: 'uj@example.com', nev: 'Uj Kezelo', szerepek: ['therapist'] })).status, 409);
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${uj.json.id}`, { m: adm, body: { szerepek: ['reception', 'therapist'] } })).status, 200);
  assert.deepEqual((await mind(x.db, 'SELECT role_id FROM staff_role WHERE staff_id = ?1 ORDER BY role_id', uj.json.id)).map((r) => r.role_id), ['reception', 'therapist']);
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${uj.json.id}`, { m: adm, body: {} })).status, 422);
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${uj.json.id}`, { m: vez, body: { aktiv: false } })).status, 403);
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${x.staff.admin}`, { m: adm, body: { aktiv: false } })).status, 409, 'sajat magat nem');
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${x.staff.admin}`, { m: adm, body: { szerepek: ['therapist'] } })).status, 409);
  const ujM = await x.munkamenet(uj.json.id);
  assert.equal((await x.get('/auth/en', ujM)).status, 200);
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${uj.json.id}`, { m: adm, body: { aktiv: false } })).status, 200);
  assert.equal((await x.get('/auth/en', ujM)).status, 401, 'deaktivalas azonnal hat');
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${NULLA_ID}`, { m: adm, body: { aktiv: false } })).status, 404);
  // audit
  assert.equal((await x.get('/audit', x.session.terapeuta)).status, 403);
  const au = await x.get('/audit?muvelet=staff.create', vez);
  assert.equal(au.status, 200);
  assert.ok(au.json.audit.length >= 1 && au.json.audit.every((s) => s.muvelet === 'staff.create'));
  assert.equal((await x.get('/audit?muvelet=%27%3BDROP%20TABLE%20security_audit', vez)).status, 422);
  assert.equal((await x.get('/audit?tol=2026-13-40', vez)).status, 422);
  // export: csak admin; a keplet-injekcio ellen vedett
  await x.t.db.prepare("INSERT INTO security_audit (id, at, action, resource, result, detail) VALUES ('e1', ?1, '=HYPERLINK(\"http://evil\")', 'test', 'ok', '@cmd')").bind(x.t.ido).run();
  assert.equal((await x.get('/audit/export.csv', vez)).status, 403);
  const csv = await x.get('/audit/export.csv', adm);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /^text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /^attachment;/);
  assert.ok(csv.text.includes("\"'=HYPERLINK("), 'a = elotagolt idezojellel');
  assert.ok(csv.text.includes("\"'@cmd\""));
  assert.ok((await auditSor(x.db, "action = 'audit.export'")).length >= 1);
  // Salonic-allapot
  assert.equal((await x.get('/salonic-allapot', x.session.recepcio)).status, 403);
  const sal = (await x.get('/salonic-allapot', vez)).json;
  assert.equal(sal.fiokok[0].id, 'mosaic-oxigen');
  // uzenetek
  const sab = (await x.get('/uzenetek/sablonok', x.session.recepcio)).json.sablonok;
  assert.ok(sab.length >= 29 && sab.some((s) => s.azonosito === 'T-24'));
  assert.equal((await x.get('/uzenetek/sablonok', x.session.vezeto)).status, 403);
  assert.equal((await x.get('/uzenetek/sablonok', x.session.marketing)).status, 200);
  assert.deepEqual((await x.get('/uzenetek/uzemmod', x.session.terapeuta)).json.kuldes, 'dry');
  assert.equal((await x.get('/uzenetek/uzemmod', x.session.terapeuta, { env: { ...x.env, CRM_KULDES: 'eles' } })).json.kuldes, 'eles');
  assert.equal((await x.get('/uzenetek/jobok?allapot=nincs', x.session.terapeuta)).status, 422);
  assert.equal((await x.get('/uzenetek/jobok?guest_id=nem-uuid', x.session.terapeuta)).status, 422);
  assert.deepEqual((await x.get('/uzenetek/jobok', x.session.terapeuta)).json.jobok, []);
  assert.equal((await x.post('/uzenetek/elonezet', x.session.terapeuta, { template_key: 'NINCS', guest_id: NULLA_ID })).status, 422);
  // az utolso admin nem vehetö el (masodik admin felvetele nelkul)
  const masik = await x.post('/munkatarsak', adm, { email: 'admin2@example.com', nev: 'Masik Admin', szerepek: ['admin'] });
  const m2 = await x.munkamenet(masik.json.id);
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${x.staff.admin}`, { m: m2, body: { aktiv: false } })).status, 200);
  assert.equal((await x.hivas('PATCH', `/munkatarsak/${masik.json.id}`, { m: m2, body: { aktiv: false } })).status, 409);
});

test('VEGPONT opcionalis modulok (motor / ingest / merok / dashboard): hianyuk 501 MODUL_HIANYZIK, megleteuk eseten a vegpont dolgozik; az ingest kulcsos', async () => {
  const x = await ujApi();
  const kulcs = { 'x-crm-kulcs': 'gepi-kulcs' };
  const rossz = await x.hivas('POST', '/ingest', { body: { a: 1 }, fejlecek: { 'x-crm-kulcs': 'rossz' } });
  assert.equal(rossz.status, 401);
  assert.equal((await x.hivas('POST', '/ingest', { body: { a: 1 } })).status, 401);
  assert.equal((await x.hivas('POST', '/tick', { body: {}, fejlecek: { 'x-crm-kulcs': 'rossz' } })).status, 401);
  assert.equal((await x.hivas('POST', '/ingest', { body: { a: 1 }, env: { ...x.env, CRM_KULCS_HASH: '' }, fejlecek: kulcs })).status, 401, 'kulcs-hash nelkul semmi nem megy be');
  assert.ok((await auditSor(x.db, "action = 'machine.key_rejected'")).length >= 3);
  const ellenorzes = (v, modul) => assert.ok(v.status === 501 ? v.json.hiba.kod === 'MODUL_HIANYZIK' : v.status < 500 || v.status === 422, `${modul}: ${v.status} ${v.text.slice(0, 120)}`);
  ellenorzes(await x.hivas('POST', '/ingest', { body: { a: 1 }, fejlecek: kulcs }), 'ingest');
  ellenorzes(await x.hivas('POST', '/tick', { body: {}, fejlecek: kulcs }), 'tick');
  ellenorzes(await x.get('/merok', x.session.marketing), 'merok');
  ellenorzes(await x.get('/dashboard?nezet=menedzsment', x.session.vezeto), 'dashboard');
  ellenorzes(await x.get('/dashboard?nezet=kezelo', x.session.terapeuta), 'dashboard');
  assert.equal((await x.get('/dashboard?nezet=kezelo', x.session.marketing)).status, 403);
  assert.equal((await x.get('/dashboard?nezet=menedzsment', x.session.terapeuta)).status, 403);
  assert.equal((await x.get('/dashboard?nezet=xx', x.session.terapeuta)).status, 422);
  assert.equal((await x.get('/merok', x.session.recepcio)).status, 403);
  assert.equal((await x.get('/merok?kezelo=nem-uuid', x.session.marketing)).status, 422);
});
