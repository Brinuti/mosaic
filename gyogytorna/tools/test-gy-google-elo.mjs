// UJ-72 (GYT): csere nelkuli potlas az ELO „Allapot-ok” (7362127659) akcion, azonos (HMAC) order_id-vel; alapbol KI.
//   node --test tools/test-gy-google-elo.mjs   (a gyogytorna/ mappabol)
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELO_AKCIO, ELO_KESLELTETES, eloKonverzio, eloKuldesE, eloMod, eloPotlas, eloTol, eloValasz } from '../lib/google-elo.js';
import { eloUtan } from '../lib/elo-burok.js';
import { sema, foglalasLetrehoz } from '../lib/db.js';
import { budapestIdo } from '../lib/motor-szerver.js';
import { tranzakcioId } from '../lib/titkos.js';
import { ujD1 } from './d1-szim.mjs';

const MOST = 1791900000, TOL = 1791800000;
const KULCS = 'proba-titkos-kulcs-0123456789abcdef';
const GCLID = 'Cj0KCQjwTESZ0_gclid_0123456789abcdef0123456789'.replace('TESZ0', 'XYZAB'); // >= 30 karakter, nincs TEST / TESZT
const ENV = (extra = {}) => ({ GY_GADS_ELO: 'validate', GY_GADS_ELO_TOL: String(TOL), GY_HMAC_KULCS: KULCS, GOOGLE_ADS_DEVELOPER_TOKEN: 'd', GOOGLE_ADS_CLIENT_ID: 'c', GOOGLE_ADS_CLIENT_SECRET: 's', GOOGLE_ADS_REFRESH_TOKEN: 'r', ...extra });
const F = (n, o = {}) => ({ uuid: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, tipus: 'allapotfelmeres', uj_vendeg: 'ismeretlen', cimke: 'google_brand', bizonyitek: null, hozzajarulas: 'igen', allapot: 'aktiv', teszt: false, gads_katt_tipus: 'gclid', gads_katt_ertek: GCLID + n, gads_katt_ido: MOST - 20000, ...o });
async function ujDb(fs) {
  const db = ujD1(); await sema(db);
  for (const [i, f] of fs.entries()) { await foglalasLetrehoz(db, f, f.__ido || MOST - 7200 - i); if (f.igazolt !== false) await db.prepare('UPDATE gy_foglalas SET igazolt = 1 WHERE uuid = ?').bind(f.uuid).run(); if (f.allapot !== 'aktiv') await db.prepare('UPDATE gy_foglalas SET allapot = ? WHERE uuid = ?').bind(f.allapot, f.uuid).run(); }
  return db;
}
const kuldoGyar = (valasz = {}, http = 200) => { const h = []; const k = async (kerelem) => { h.push(kerelem); return { http, json: typeof valasz === 'function' ? valasz(h) : valasz, requestId: 'rq' }; }; k.h = h; return k; };
const naplo = (db) => db._db.prepare('SELECT * FROM gy_feltoltes_elo ORDER BY uuid').all();

test('A) kapcsolo: alapbol KI; ki|dry|validate|eles; a tol ervenyes unix; az elo akcio 7362127659', () => {
  assert.equal(eloMod({}), 'ki'); assert.equal(eloMod({ GY_GADS_ELO: 'x' }), 'ki'); for (const m of ['dry', 'validate', 'eles']) assert.equal(eloMod({ GY_GADS_ELO: m.toUpperCase() }), m);
  assert.equal(eloTol({}), null); assert.equal(eloTol({ GY_GADS_ELO_TOL: '5' }), null); assert.equal(eloTol({ GY_GADS_ELO_TOL: String(TOL) }), TOL); assert.equal(ELO_AKCIO, '7362127659');
});
test('A) eloKonverzio: az ELO akciora, azonos order_id-vel; consent csak kerve; hianyzo bemenetre null', () => {
  const k = eloKonverzio({ kattTipus: 'gclid', kattErtek: GCLID, konverzioIdo: '2026-10-27 10:00:00+01:00', orderId: 'abc', consent: true });
  assert.deepEqual([k.conversionAction, k.orderId, k.gclid, k.conversionValue, k.currencyCode, k.consent], ['customers/2596120588/conversionActions/7362127659', 'abc', GCLID, 19000, 'HUF', { adUserData: 'GRANTED', adPersonalization: 'GRANTED' }]);
  assert.equal('consent' in eloKonverzio({ kattTipus: 'gclid', kattErtek: GCLID, konverzioIdo: 'x', orderId: 'abc' }), false);
  for (const hi of [{ kattTipus: 'fbclid' }, { kattErtek: '' }, { orderId: '' }, { konverzioIdo: '' }]) assert.equal(eloKonverzio({ kattTipus: 'gclid', kattErtek: GCLID, konverzioIdo: 'x', orderId: 'abc', ...hi }), null);
});
test('A) eloValasz: siker, "mar bent van" = siker, egyeb hiba', () => {
  assert.deepEqual(eloValasz(200, {}, { validate: true }), { allapot: 'elfogadva', hiba: null }); assert.equal(eloValasz(200, {}, { validate: false }).allapot, 'elkuldve');
  const pf = (c) => ({ partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: c } }] }] } });
  assert.equal(eloValasz(200, pf('ORDER_ID_ALREADY_IN_USE'), { validate: false }).allapot, 'mar_bent'); assert.deepEqual(eloValasz(200, pf('EXPIRED_EVENT'), { validate: false }), { allapot: 'hiba', hiba: 'EXPIRED_EVENT' });
  assert.equal(eloValasz(401, { error: { status: 'UNAUTHENTICATED' } }, { validate: false }).hiba, 'UNAUTHENTICATED');
});
test('B) alapbol KI / hianyzo tol / hianyzo kulcs / hianyzo kuldo: nincs kuldes, nincs tabla', async () => {
  const db = await ujDb([F(1)]); const k = kuldoGyar();
  assert.deepEqual(await eloPotlas({ host: 'gyogytornaszom.hu', db, env: { GY_HMAC_KULCS: KULCS }, most: MOST, budapestIdo, kuldo: k }), { allapot: 'ki' });
  assert.equal((await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV({ GY_GADS_ELO_TOL: undefined }), most: MOST, budapestIdo, kuldo: k })).allapot, 'nincs_tol');
  assert.equal((await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV({ GY_HMAC_KULCS: undefined }), most: MOST, budapestIdo, kuldo: k })).allapot, 'nincs_titkos_kulcs');
  assert.equal((await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV({ GOOGLE_ADS_DEVELOPER_TOKEN: undefined }), most: MOST, budapestIdo })).allapot, 'nincs_kuldo');
  assert.equal(k.h.length, 0); assert.equal(db._db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'gy_feltoltes_elo'").get().n, 0);
});
test('B) validate: validateOnly=true, az ELO akcio, a bongeszoknek kiadott HMAC order_id; nyers click-ID nincs a naploban; masodik futas nem ismetli', async () => {
  const f = F(1); const db = await ujDb([f]); const k = kuldoGyar();
  const r = await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV(), most: MOST, budapestIdo, kuldo: k });
  assert.deepEqual([r.allapot, r.feldolgozva, r.eredmenyek], ['kesz', 1, { elfogadva: 1 }]);
  const kerelem = k.h[0]; assert.equal(kerelem.validateOnly, true); assert.equal(kerelem.partialFailure, true);
  assert.equal(kerelem.conversions[0].conversionAction, 'customers/2596120588/conversionActions/7362127659'); assert.equal(kerelem.conversions[0].orderId, await tranzakcioId(f.uuid, KULCS), 'azonos a bongeszonek kiadott tranzakcio_id-val');
  assert.equal(kerelem.conversions[0].gclid, GCLID + '1'); assert.equal(JSON.stringify(naplo(db)).includes(GCLID), false); assert.equal(naplo(db)[0].mod, 'validate');
  assert.equal((await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV(), most: MOST + 60, budapestIdo, kuldo: k })).feldolgozva, 0); assert.equal(k.h.length, 1);
});
test('B) dry: halozati hivas nincs (kuldo sem kell), csak naplo; eles: validateOnly=false', async () => {
  const db = await ujDb([F(1)]); const k = kuldoGyar();
  const r = await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV({ GY_GADS_ELO: 'dry', GOOGLE_ADS_DEVELOPER_TOKEN: undefined }), most: MOST, budapestIdo, kuldo: k }); assert.deepEqual(r.eredmenyek, { dry: 1 }); assert.equal(k.h.length, 0);
  const db2 = await ujDb([F(1)]); const k2 = kuldoGyar(); const r2 = await eloPotlas({ host: 'gyogytornaszom.hu', db: db2, env: ENV({ GY_GADS_ELO: 'eles' }), most: MOST, budapestIdo, kuldo: k2 });
  assert.equal(k2.h[0].validateOnly, false); assert.deepEqual(r2.eredmenyek, { elkuldve: 1 });
});
test('B) jogosultsag: igazolt, nem teszt, allapotfelmeres, click-ID (jo formaju, a foglalas elotti), nincs elutasitas, tol utani es legalabb 1 oras; a LEMONDOTT is megy (nincs levonas)', async () => {
  const fs = [F(1), F(2, { allapot: 'lemondott' }), F(3, { igazolt: false }), F(4, { teszt: true }), F(5, { tipus: 'egyeb' }), F(6, { gads_katt_ertek: 'rovid' }), F(7, { hozzajarulas: 'nem' }), F(8, { gads_katt_ido: MOST }), F(9, { __ido: TOL - 10 }), F(10, { __ido: MOST - 100 }), F(11, { gads_katt_ertek: null })];
  const db = await ujDb(fs); const k = kuldoGyar();
  const r = await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV(), most: MOST, budapestIdo, kuldo: k, limit: 50 });
  const orderIdk = k.h.map((x) => x.conversions[0].orderId);
  assert.deepEqual(orderIdk.sort(), [await tranzakcioId(fs[0].uuid, KULCS), await tranzakcioId(fs[1].uuid, KULCS)].sort(), 'csak az 1. es a (lemondott) 2.');
  const n = Object.fromEntries(naplo(db).map((x) => [x.uuid, x.allapot])); assert.equal(n[fs[1].uuid], 'elfogadva'); assert.equal(n[fs[5].uuid], 'kihagyva_click_id'); assert.equal(n[fs[7].uuid], 'kihagyva_ido_sorrend'); assert.ok(ELO_KESLELTETES >= 3600); assert.equal(r.feldolgozva, 4);
});
test('B) "mar bent van" = vegleges; hiba: legfeljebb 3 probalkozas; a kuldo kivetele nem dob; a consent csak GY_GADS_CONSENT=granted mellett', async () => {
  const bent = () => ({ partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: 'ORDER_ID_ALREADY_IN_USE' } }] }] } });
  const db = await ujDb([F(1)]); const k = kuldoGyar(bent); await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV({ GY_GADS_ELO: 'eles' }), most: MOST, budapestIdo, kuldo: k }); assert.equal(naplo(db)[0].allapot, 'mar_bent');
  await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV({ GY_GADS_ELO: 'eles' }), most: MOST + 60, budapestIdo, kuldo: k }); assert.equal(k.h.length, 1);
  const db2 = await ujDb([F(1)]); const rossz = kuldoGyar({ partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: 'EXPIRED_EVENT' } }] }] } });
  for (let i = 0; i < 5; i++) await eloPotlas({ host: 'gyogytornaszom.hu', db: db2, env: ENV({ GY_GADS_ELO: 'eles' }), most: MOST + i * 60, budapestIdo, kuldo: rossz });
  assert.equal(rossz.h.length, 3); assert.deepEqual([naplo(db2)[0].allapot, naplo(db2)[0].probalkozas, naplo(db2)[0].hiba], ['hiba', 3, 'EXPIRED_EVENT']);
  const db3 = await ujDb([F(1)]); const dob = async () => { throw new Error('halozat'); }; assert.equal((await eloPotlas({ host: 'gyogytornaszom.hu', db: db3, env: ENV(), most: MOST, budapestIdo, kuldo: dob })).allapot, 'kesz'); assert.equal(naplo(db3)[0].allapot, 'hiba');
  const db4 = await ujDb([F(1)]); const k4 = kuldoGyar(); await eloPotlas({ host: 'gyogytornaszom.hu', db: db4, env: ENV({ GY_GADS_CONSENT: 'granted' }), most: MOST, budapestIdo, kuldo: k4 }); assert.deepEqual(k4.h[0].conversions[0].consent, { adUserData: 'GRANTED', adPersonalization: 'GRANTED' });
  const db5 = await ujDb([F(1)]); const k5 = kuldoGyar(); await eloPotlas({ host: 'gyogytornaszom.hu', db: db5, env: ENV(), most: MOST, budapestIdo, kuldo: k5 }); assert.equal('consent' in k5.h[0].conversions[0], false);
});
test('C) eloUtan: a valasz valtozatlan, a sweep waitUntil-lel fut csak ha a kapcsolo nem ki; a hiba nem erinti a valaszt', async () => {
  const futott = []; const resp = new Response('ok', { status: 200 });
  const alap = async () => resp;
  const be = await eloUtan(alap)({ request: { url: 'https://gyogytornaszom.hu/api/x' }, waitUntil: (p) => futott.push(p), env: { GY_DB: await ujDb([]), GY_GADS_ELO: 'dry' } }); assert.equal(be, resp); assert.equal(futott.length, 1); await futott[0];
  await eloUtan(alap)({ request: { url: 'https://gyogytornaszom.hu/api/x' }, waitUntil: (p) => futott.push(p), env: { GY_DB: {}, GY_GADS_ELO: 'ki' } }); assert.equal(futott.length, 1, 'ki: nem fut');
  assert.equal(await eloUtan(alap)({ env: { GY_DB: {}, GY_GADS_ELO: 'dry' } }), resp, 'waitUntil nelkul sem dob');
});

test('D) braid-kapu (a 7362127659 ONE_PER_CLICK): gbraid / wbraid csak GY_GADS_BRAID=be ES GY_GADS_ELO_BRAID=be mellett megy; kulonben kihagyva_braid (nincs Google-hivas), a kapu nyitasa utan ujra felveszi', async () => {
  const fs = [F(1, { gads_katt_tipus: 'gbraid', gads_katt_ertek: 'GBRAID_ertek_0123456789abcdef0123456789' }), F(2, { gads_katt_tipus: 'wbraid', gads_katt_ertek: 'WBRAID_ertek_0123456789abcdef0123456789' }), F(3)];
  const db = await ujDb(fs); const k = kuldoGyar();
  for (const extra of [{}, { GY_GADS_BRAID: 'be' }, { GY_GADS_ELO_BRAID: 'be' }]) {
    const r = await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV(extra), most: MOST, budapestIdo, kuldo: k, limit: 50 }); assert.ok(r.allapot === 'kesz');
  }
  const n = Object.fromEntries(naplo(db).map((x) => [x.uuid, x.allapot]));
  assert.deepEqual([n[fs[0].uuid], n[fs[1].uuid], n[fs[2].uuid]], ['kihagyva_braid', 'kihagyva_braid', 'elfogadva']);
  assert.equal(k.h.length, 1, 'csak a gclid-os ment, a braid egyszer sem'); assert.equal(k.h[0].conversions[0].gclid.length > 0, true);
  const r2 = await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV({ GY_GADS_BRAID: 'be', GY_GADS_ELO_BRAID: 'be' }), most: MOST + 60, budapestIdo, kuldo: k, limit: 50 });
  assert.equal(r2.feldolgozva, 2, 'mindket kapu nyitva: a korabbi kihagyva_braid sorok ujra felveve');
  assert.deepEqual(k.h.slice(1).map((h) => Object.keys(h.conversions[0]).find((x) => ['gclid', 'gbraid', 'wbraid'].includes(x))).sort(), ['gbraid', 'wbraid']);
});
test('D) a probalkozas-plafon MODONKENT szamol: dry + validate utan az elso eles hiba nem veglegesites; az eles mod 3 hiba utan all', async () => {
  const rossz = kuldoGyar({ partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: 'EXPIRED_EVENT' } }] }] } });
  const db = await ujDb([F(1)]); const H = 'gyogytornaszom.hu';
  await eloPotlas({ host: H, db, env: ENV({ GY_GADS_ELO: 'dry' }), most: MOST, budapestIdo, kuldo: rossz });
  for (let i = 0; i < 3; i++) await eloPotlas({ host: H, db, env: ENV({ GY_GADS_ELO: 'validate' }), most: MOST + 60 * (i + 1), budapestIdo, kuldo: rossz }); // validate: 3 hiba
  assert.equal(rossz.h.length, 3);
  for (let i = 0; i < 5; i++) await eloPotlas({ host: H, db, env: ENV({ GY_GADS_ELO: 'eles' }), most: MOST + 600 + 60 * i, budapestIdo, kuldo: rossz });
  assert.equal(rossz.h.length, 6, 'az eles modnak sajat 3 proba jutott (korabbi modok nem szamitanak)');
  assert.deepEqual([naplo(db)[0].mod, naplo(db)[0].allapot, naplo(db)[0].probalkozas], ['eles', 'hiba', 3]);
});
test('D) host-vedelem: validate / eles csak az eles hoston (gyogytornaszom.hu, www-val is); elonezet / ismeretlen host: probauzem (dry), Google-hivas nincs', async () => {
  for (const host of ['mosaic.pages.dev', 'claude-x.gyogytorna.pages.dev', '', 'gyogytornaszom.hu.evil.example']) {
    const db = await ujDb([F(1)]); const k = kuldoGyar();
    const r = await eloPotlas({ host, db, env: ENV({ GY_GADS_ELO: 'eles' }), most: MOST, budapestIdo, kuldo: k });
    assert.deepEqual([r.eredmenyek, k.h.length, naplo(db)[0].mod], [{ dry: 1 }, 0, 'dry'], host);
  }
  const db = await ujDb([F(1)]); const k = kuldoGyar();
  await eloPotlas({ host: 'www.gyogytornaszom.hu', db, env: ENV(), most: MOST, budapestIdo, kuldo: k }); assert.equal(k.h.length, 1);
  assert.equal(eloKuldesE(ENV(), 'gyogytornaszom.hu'), true); assert.equal(eloKuldesE(ENV({ GY_GADS_ELO: 'dry' }), 'gyogytornaszom.hu'), false);
});

test('D) a determinisztikusan kihagyott sorok (kihagyva_click_id / kihagyva_ido_sorrend) nem kerulnek ujra felvetelre (nincs felesleges D1-iras)', async () => {
  const db = await ujDb([F(1, { gads_katt_ertek: 'rovid' }), F(2, { gads_katt_ido: MOST })]); const k = kuldoGyar();
  for (let i = 0; i < 4; i++) await eloPotlas({ host: 'gyogytornaszom.hu', db, env: ENV(), most: MOST + i * 60, budapestIdo, kuldo: k, limit: 50 });
  assert.deepEqual(naplo(db).map((x) => [x.allapot, x.probalkozas]), [['kihagyva_click_id', 1], ['kihagyva_ido_sorrend', 1]]); assert.equal(k.h.length, 0);
});

test('E) UJ-94 / DECISION #264 (a): gy_elo_naplo - a korai kilepesek es a kesz sweep napi darabszama allapot x host_kat szerint; host-ertek / vendegadat nincs; ki modban nem ir', async () => {
  const db = ujD1(); await sema(db);
  const naploSorok = () => db._db.prepare('SELECT nap, allapot, host_kat, db FROM gy_elo_naplo ORDER BY allapot, host_kat').all().map((r) => ({ ...r }));
  const nap = new Date(MOST * 1000).toISOString().slice(0, 10);
  // ki mod: semmi nem ir (a tabla meg nem is letezik)
  assert.deepEqual(await eloPotlas({ db, env: {}, most: MOST, host: 'gyogytornaszom.hu' }), { allapot: 'ki' });
  assert.equal(db._db.prepare("SELECT name FROM sqlite_master WHERE name = 'gy_elo_naplo'").all().length, 0);
  // nincs_tol / nincs_titkos_kulcs / nincs_kuldo (validate az eles hoston, GOOGLE_ADS_* titok nelkul)
  await eloPotlas({ db, env: { GY_GADS_ELO: 'validate' }, most: MOST, host: 'www.gyogytornaszom.hu' });
  await eloPotlas({ db, env: { GY_GADS_ELO: 'validate', GY_GADS_ELO_TOL: String(TOL) }, most: MOST, host: 'gyogytornaszom.hu' });
  const envKuldoNelkul = { GY_GADS_ELO: 'validate', GY_GADS_ELO_TOL: String(TOL), GY_HMAC_KULCS: KULCS };
  await eloPotlas({ db, env: envKuldoNelkul, most: MOST, host: 'gyogytornaszom.hu' });
  await eloPotlas({ db, env: envKuldoNelkul, most: MOST, host: 'gyogytornaszom.hu' });
  // validate, de pages.dev host: probauzem (dry) -> 'kesz', host_kat pages_dev; ismeretlen / ures host: egyeb
  await eloPotlas({ db, env: envKuldoNelkul, most: MOST, host: 'gyogytorna.pages.dev' });
  await eloPotlas({ db, env: envKuldoNelkul, most: MOST, host: '' });
  assert.deepEqual(naploSorok(), [
    { nap, allapot: 'kesz', host_kat: 'egyeb', db: 1 },
    { nap, allapot: 'kesz', host_kat: 'pages_dev', db: 1 },
    { nap, allapot: 'nincs_kuldo', host_kat: 'eles', db: 2 },
    { nap, allapot: 'nincs_titkos_kulcs', host_kat: 'eles', db: 1 },
    { nap, allapot: 'nincs_tol', host_kat: 'eles', db: 1 },
  ]);
  // sem host-ertek, sem uuid / click-ID nincs a tablaban
  const szoveg = JSON.stringify(db._db.prepare('SELECT * FROM gy_elo_naplo').all());
  assert.ok(!/pages\.dev|gyogytornaszom|gclid|uuid/i.test(szoveg), `a naplo nem tartalmazhat host-erteket: ${szoveg}`);
  // a naplo hibaja nem valtoztatja az eredmenyt
  const hibasDb = { prepare: (q) => { if (/gy_elo_naplo/.test(q)) throw new Error('naplo-hiba'); return db.prepare(q); }, batch: (...a) => db.batch(...a) };
  assert.equal((await eloPotlas({ db: hibasDb, env: envKuldoNelkul, most: MOST, host: 'gyogytornaszom.hu' })).allapot, 'nincs_kuldo');
});
