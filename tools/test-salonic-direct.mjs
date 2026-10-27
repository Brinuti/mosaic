// SALONIC-DIRECT SAFETY NET (DECISION #127 (b), #130, #131) - S0 OFFLINE TESZTEK
//   node --test tools/test-salonic-direct.mjs
// Valodi SQLite (node:sqlite) a D1 helyett, a Salonic mentett valodi oldalai (UUID-cserevel), hamis platform-halozat, hamis ora. SEMMI nem megy ki a halozatra, nincs titok.
// S0-01..S0-23 = a GPT altal jovahagyott 23 eset (terv v2); S0-24.. = kiegeszito vedelmek (hash-index, szaraz terv, alias, riasztasok, riport, admin).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import { BUSINESSES } from '../assets/js/booking-engine/salonic-adapter.js';
import { HOSTOK, kulcsIras, nevtablaMent } from '../netlify/lib/foglalas-kulcs.js';
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { cellaOsztaly } from '../netlify/lib/meres/egyeztetes-sor.js';
import { irasKapcsolo } from '../netlify/lib/meres/iras-kapcsolo.js';
import { kapcsoloBeallit } from '../netlify/lib/meres/elosztas.js';
import { kezelAdmin } from '../netlify/lib/meres/vegpontok.js';
import { CSERE_GYANU, csereGyanu, megjegyzesIdopontok, mutatEgyre, nevNorm, sdIdentitas, sdKapcsolo, szolgKanon, szolgIndexKulcs, szolgKulcsEgyezik, vendegHash, azonosVendeg, SD_MIN_KOR_MP, SD_UJRA_MP, ujraMezok } from '../netlify/lib/meres/salonic-direct.js';
import szolgAdat from '../netlify/lib/lifecycle/szolgaltatasok.js';
import { FIXTURE, motorKepek } from './meres-proba/golden-motor.mjs';
import { FIX_UUID, KULCS_SZOVEG, NEV, SD_ENV, T0, VENDEG, iso, level, lezar, ujUuid, vilag } from './lib-sd-teszt.mjs';

const BID = 'mb_0muwq2ciorsos0tznsfyliq';
const HAIR_URL = `https://mosaic-hair.salonic.hu/guestData/?anyone=true&employeeId=25095&placeId=10823&serviceId=232804&startDate=1792512000&back=${BID}`;
const SD_ELOTT = T0 + 1300_000; // a letrehozo level utan ~21,7 perccel (a Zap 5. lepese)
const hivasNev = (v) => v.net.hivasok.map((h) => `${h.kulcs}:${h.body.data ? (h.body.data[0].event_name || h.body.data[0].event) : ''}`);
const cellak = (v, ...mezok) => v.sql('SELECT esemeny_nev, esemeny_tipus, platform, allapot, indok, ertek, ertek_minoseg, forras, attr_minoseg FROM meres_kuldes ORDER BY id').map((r) => r);
const cella = (v, nev, platform) => cellak(v).find((c) => c.esemeny_nev === nev && c.platform === platform);
const szamol = (v, tabla) => v.sql(`SELECT COUNT(*) AS n FROM ${tabla}`)[0].n;
const tablaVan = (v, tabla) => v.sql("SELECT name FROM sqlite_master WHERE type='table' AND name = ?1", tabla).length > 0;
const dump = (v, tablak) => JSON.stringify(tablak.map((t) => { const r = tablaVan(v, t) ? v.sql(`SELECT * FROM ${t}`) : []; return r.length ? r : null; })); // az ures / hianyzo tabla azonos (a sema-letrehozas nem adat-iras)
/** Egy "parositatlan" (4 proba utan lezart) sd-jelolt vilag: a letrehozo level, a 4 proba, az ora a Zap 5. lepesenel. */
async function jelolt(opt = {}, mod = {}) {
  const v = vilag(opt); await v.kesz;
  const u = ujUuid(); const b = level(u, mod);
  const probak = await lezar(v, b);
  v.t.set(SD_ELOTT);
  return { v, u, b, probak };
}
const sdId = (v, u) => sdIdentitas(v.e, u);
const riasztasok = async (v, u) => (await v.get('sd_riasztas=1')).lista.filter((x) => !u || x.uuid === u);

// ---------------------------------------------------------------------------------------------------------------------------------------
test('S0-01 PMU visszatero vendeg (sd): Meta + TikTok kimegy, Google / GA4 jogos_0; a motor lezart (parositatlan) volt', async () => {
  const { v, u, b, probak } = await jelolt({}, { uj_vendeg: false });
  assert.deepEqual(probak.map((x) => x.allapot), ['fuggoben', 'fuggoben', 'fuggoben', 'parositatlan']);
  assert.equal(v.net.hivasok.length, 0, 'a motor nem kuldott');
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.sd_allapot, r.jelleg, r.uzletag, r.csere], ['kesz', 'kesz', 'visszajaro', 'pmu', null]);
  assert.equal(r.sd_id, await sdId(v, u));
  assert.deepEqual(hivasNev(v), ['meta:PMU_Visszajaro', 'tiktok:PMU_Visszajaro']);
  assert.deepEqual(cellak(v).map((c) => `${c.esemeny_nev}/${c.platform}/${c.allapot}`), ['Visszajaro/meta/elkuldve', 'Visszajaro/tiktok/elkuldve', 'Visszajaro/google/kihagyva', 'Visszajaro/ga4/kihagyva']);
  assert.ok(cellak(v).every((c) => c.forras === 'salonic_direct' && c.attr_minoseg === 'C_salonic_direct' && c.ertek_minoseg === 'unknown_price'));
  for (const p of ['google', 'ga4']) assert.equal(cellaOsztaly(v.sql('SELECT allapot, indok FROM meres_kuldes WHERE platform = ?1', p)[0]).osztaly, 'jogos_0', `${p}: jogos 0 (nem hiany)`);
  assert.match(cella(v, 'Visszajaro', 'ga4').indok, /^salonic_direct: nincs GA4 client_id/);
  const meta = v.net.hivasok[0].body.data[0];
  assert.equal(meta.action_source, 'other'); // D2
  for (const k of ['event_source_url']) assert.ok(!(k in meta), `nincs kitalalt ${k}`);
  for (const k of ['client_ip_address', 'client_user_agent', 'fbp', 'fbc']) assert.ok(!(k in meta.user_data), `nincs kitalalt ${k}`);
  assert.deepEqual([meta.custom_data.forras, meta.custom_data.attr_minoseg, meta.custom_data.ertek_minoseg], ['salonic_direct', 'C_salonic_direct', 'unknown_price']);
  assert.ok(!('value' in meta.custom_data) && !('currency' in meta.custom_data), 'ismeretlen ar: ertek nelkul (D5)');
  assert.ok(meta.user_data.em && meta.user_data.ph && meta.user_data.external_id, 'hash-elt azonositok mennek');
  assert.ok(v.net.hivasok.every((h) => !('page' in h.body.data[0]) || h.body.data[0].page.url), 'TikTok: nincs kitalalt oldal-URL');
  assert.deepEqual(v.sql("SELECT sd_id, sd_allapot, kuldve, booking_id FROM foglalas_egyeztetes WHERE uuid = ?1", u).map((x) => [x.sd_id === r.sd_id, x.sd_allapot, x.kuldve, x.booking_id]), [[true, 'kesz', null, null]]);
});

test('S0-02 uj PMU-vendeg (sd): FoglalasElso + Schedule ernyo; Google / GA4 jogos_0', async () => {
  const { v, b } = await jelolt({}, { uj_vendeg: true });
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.jelleg], ['kesz', 'elso']);
  assert.deepEqual(hivasNev(v), ['meta:PMU_FoglalasElso', 'tiktok:PMU_FoglalasElso', 'meta:Schedule', 'tiktok:Schedule']);
  assert.equal(szamol(v, 'meres_kuldes'), 8);
  assert.ok(cellak(v).filter((c) => c.platform === 'ga4' || c.platform === 'google').every((c) => c.allapot === 'kihagyva'));
});

test('S0-03 konzultacio (sd): a rogzitett tabla-ertek megy (PMU 13 800, oxigen 8 900), exact', async () => {
  for (const [host, felado, szolg, ertek, uzletag] of [['mosaic-pmu.salonic.hu', 'Mosaic PMU', 'PMU konzultáció', 13800, 'pmu'], ['mosaic-oxigen.salonic.hu', 'Mosaic Oxigen', 'Hajkamera vizsgálat + konzultáció', 8900, 'oxigen']]) {
    const { v, b } = await jelolt({}, { host, felado, szolgaltatas: szolg, uj_vendeg: true });
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.jelleg, r.ertek_minoseg, r.ertek_forras, r.uzletag], ['kesz', 'konzultacio', 'exact', 'konzultacio_tabla', uzletag]);
    const meta = v.net.hivasok.filter((h) => h.kulcs === 'meta').map((h) => h.body.data[0]);
    assert.ok(meta.length === 2 && meta.every((d) => d.custom_data.value === ertek && d.custom_data.currency === 'HUF' && d.custom_data.ertek_forras === 'konzultacio_tabla'), uzletag);
  }
});

test('S0-04 munkatarsi kedvezmeny -> unknown_discount: base esemeny ERTEK NELKUL, az ertekhordozo TikTok CompletePayment visszatartva; ismert ar mellett megy', async () => {
  const hs = { host: 'mosaicheadspa.salonic.hu', felado: 'Mosaic HeadSpa', szolgaltatas: 'HeadSpa kezelés', uj_vendeg: true };
  const nevtabla = async (v) => nevtablaMent(v.db, { helyek: [{ placeId: BUSINESSES.headspa.placeId, nev: 'Mosaic HeadSpa' }], munkatarsak: [], szolgaltatasok: [{ placeId: BUSINESSES.headspa.placeId, serviceId: '1', nev: 'HeadSpa kezelés' }], arak: [{ placeId: BUSINESSES.headspa.placeId, serviceId: '1', ar: 26900 }] }, T0);
  { // kedvezmeny-cimkes munkatars: a lista-ar ismert, de NEM tenyleges ar
    const { v, b } = await jelolt({}, { ...hs, munkatarsak: ['Noel - 20% kedvezmény!'] }); await nevtabla(v);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.ertek_minoseg], ['kesz', 'unknown_discount']);
    assert.match(r.ertek_forras, /^kedvezmeny_gyanu/);
    const meta = v.net.hivasok.filter((h) => h.kulcs === 'meta').map((h) => h.body.data[0]);
    assert.deepEqual(meta.map((d) => d.event_name), ['HeadSpa_FoglalasElso', 'Schedule']);
    assert.ok(meta.every((d) => !('value' in d.custom_data) && !('currency' in d.custom_data) && !('salonic_ar' in d.custom_data)), 'a Meta esemeny ertek nelkul megy');
    const cp = cella(v, 'Schedule', 'tiktok');
    assert.deepEqual([cp.allapot, cp.ertek], ['kihagyva', null]);
    assert.match(cp.indok, /ertek_ismeretlen \(unknown_discount\)/);
    assert.deepEqual(hivasNev(v), ['meta:HeadSpa_FoglalasElso', 'tiktok:HeadSpa_FoglalasElso', 'meta:Schedule'], 'a TikTok base esemeny ertek nelkul megy, a CompletePayment nem');
    assert.ok(!('value' in v.net.hivasok.find((h) => h.kulcs === 'tiktok').body.data[0].properties));
  }
  { // kontroll: ugyanaz kedvezmeny nelkul - a nevtabla (szolgaltatas-lista) ara, exact
    const { v, b } = await jelolt({}, { ...hs, munkatarsak: ['Noel'] }); await nevtabla(v);
    const r = await v.sd(b);
    assert.deepEqual([r.ertek_minoseg, r.ertek_forras], ['exact', 'szolgaltatas_lista']);
    const tt = v.net.hivasok.filter((h) => h.kulcs === 'tiktok').map((h) => h.body.data[0]);
    assert.deepEqual(tt.map((d) => [d.event, d.properties.value]), [['HeadSpa_FoglalasElso', 26900], ['CompletePayment', 26900]]);
    assert.ok(v.net.hivasok.filter((h) => h.kulcs === 'meta').every((h) => h.body.data[0].custom_data.value === 26900));
  }
  { // kupon a szolgaltatas nevben: szinten unknown_discount
    const { v, b } = await jelolt({}, { ...hs, szolgaltatas: 'KUPONKÓDDAL - HeadSpa kezelés', munkatarsak: ['Noel'] });
    assert.equal((await v.sd(b)).ertek_minoseg, 'unknown_discount');
  }
  { // a Zap "ar" mezoje (ha van) pontos
    const { v, b } = await jelolt({}, { ...hs, munkatarsak: ['Noel'], ar: 13950 });
    const r = await v.sd(b);
    assert.deepEqual([r.ertek_minoseg, r.ertek_forras], ['exact', 'zap_ar']);
  }
});

test('S0-05 torolt foglalas (elo ellenorzes) -> kihagyva, 0 kuldes', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true });
  v.net.allapot.set(u, 'torolve');
  const r = await v.sd(b);
  assert.equal(r.allapot, 'kesz');
  assert.equal(v.net.hivasok.length, 0);
  assert.ok(cellak(v).length === 8 && cellak(v).every((c) => c.allapot === 'kihagyva' && /lemondva/.test(c.indok)));
});

test('S0-06 az elo allapot nem ellenorizheto -> halasztva (tartva), riasztas; kesobb ujraprobalhato, es csak egyszer megy ki', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true });
  v.net.allapot.set(u, 'hiba');
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.sd_allapot, r.riasztas, r.esemeny_kuldes.allapot, r.esemeny_kuldes.ujraprobal_mp], ['tartva', 'tartva', true, 'halasztva', 180]);
  assert.equal(v.net.hivasok.length, 0);
  assert.ok(cellak(v).every((c) => c.allapot === 'halasztva'));
  assert.deepEqual((await v.get('sd_riasztas=1')).lista.map((x) => x.tipus), ['elo_allapot_nem_ellenorizheto']);
  v.net.allapot.delete(u);
  const r2 = await v.sd(b);
  assert.deepEqual([r2.allapot, r2.ujrafuttatva], ['kesz', true]);
  const n = v.net.hivasok.length; assert.equal(n, 4);
  const r3 = await v.sd(b); assert.equal(r3.allapot, 'kesz'); assert.equal(v.net.hivasok.length, n, 'a harmadik hivas 0 extra');
  assert.equal((await v.get('sd_riasztas=1')).lista.length, 0);
});

test('S0-07 5 parhuzamos atvetel -> 1 nyertes, 0 dupla (cellak, identity, kuldes)', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true });
  const mind = await Promise.all([1, 2, 3, 4, 5].map(() => v.sd(b)));
  assert.ok(mind.every((r) => r.ok && r.sd_id === mind[0].sd_id));
  assert.equal(szamol(v, 'meres_kuldes'), 8);
  assert.equal(v.net.hivasok.length, 4, 'Meta + TikTok x (alap + ernyo), pontosan egyszer');
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM foglalas_egyeztetes WHERE sd_id IS NOT NULL")[0].n, 1);
  // a terv ellenorzo SQL-jei: mind 0 sort varnak
  assert.deepEqual(v.sql('SELECT salonic_uuid, esemeny_nev, platform, count(*) AS n FROM meres_kuldes WHERE salonic_uuid IS NOT NULL GROUP BY 1,2,3 HAVING count(*) > 1'), []);
  assert.deepEqual(v.sql('SELECT esemeny_id, platform, count(*) AS n FROM meres_kuldes GROUP BY 1,2 HAVING count(*) > 1'), []);
  assert.deepEqual(v.sql('SELECT uuid FROM foglalas_egyeztetes WHERE booking_id IS NOT NULL AND sd_id IS NOT NULL'), []);
});

test('S0-08 elakadt atvetel ujra atveheto (300 s utan); friss atvetelt egy masik hivas nem szakit meg', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true });
  const id = await sdId(v, u);
  v.D.db.prepare("UPDATE foglalas_egyeztetes SET sd_id = ?2, sd_allapot = 'atveve', sd_ido = ?3 WHERE uuid = ?1").run(u, id, Math.floor(SD_ELOTT / 1000) - 60); // 60 s ota "atveve": egy masik hivas dolgozik rajta
  const friss = await v.sd(b);
  assert.deepEqual([friss.allapot, friss.idempotens], ['atveve', true]); assert.equal(v.net.hivasok.length, 0);
  v.D.db.prepare("UPDATE foglalas_egyeztetes SET sd_ido = ?2 WHERE uuid = ?1").run(u, Math.floor(SD_ELOTT / 1000) - 400); // a Worker meghalt: 400 s
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.ujrafuttatva], ['kesz', true]);
  assert.equal(v.net.hivasok.length, 4);
  assert.equal((await v.sd(b)).allapot, 'kesz'); assert.equal(v.net.hivasok.length, 4);
});

test('S0-09 a motoros kulcs az sd ELOTT megerkezik: a vegso parositas sikerul, a MOTORos identity (mb_) kuld, late_pairing; nincs sd atvetel', async () => {
  const v = vilag(); await v.kesz;
  const b = level(FIX_UUID, { host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)', uj_vendeg: true, munkatarsak: ['Teszt'], idopont_szoveg: 'Október 20. (kedd) 18:00 - 18:30' });
  const probak = await lezar(v, b);
  assert.deepEqual(probak.map((x) => x.allapot), ['fuggoben', 'fuggoben', 'fuggoben', 'parositatlan']);
  await kulcsIras(v.db, { bookingId: BID, bookingUrl: HAIR_URL }, v.t()); // a koszonooldal KESON irja a kulcsot (a motor lezarta a parositast)
  v.t.set(SD_ELOTT);
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.late_pairing, r.booking_id], ['motor_nyert', true, BID]);
  assert.deepEqual([r.esemeny_kuldes.allapot, r.esemeny_kuldes.uzletag], ['kesz', 'fodrasz']);
  const sor = v.sql('SELECT allapot, booking_id, sd_id, kuldve FROM foglalas_egyeztetes WHERE uuid = ?1', FIX_UUID)[0];
  assert.deepEqual([sor.allapot, sor.booking_id, sor.sd_id, sor.kuldve > 0], ['parositott', BID, null, true]);
  assert.ok(v.sql('SELECT esemeny_id FROM meres_kuldes').every((x) => x.esemeny_id.endsWith(':' + BID)), 'minden esemeny a motoros azonositot kapja');
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE source_id LIKE 'sd\\_%' ESCAPE '\\'")[0].n, 0);
  const n = v.net.hivasok.length; assert.ok(n >= 4);
  assert.equal((await v.sd(b)).allapot, 'motor_kuldte'); assert.equal(v.net.hivasok.length, n);
});

test('S0-10 mar parositott (kuldott) UUID-ra az sd hivas elutasitva: 0 kuldes, 0 atvetel', async () => {
  const v = vilag(); await v.kesz;
  await kulcsIras(v.db, { bookingId: BID, bookingUrl: HAIR_URL }, v.t());
  const b = level(FIX_UUID, { host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció', uj_vendeg: true, munkatarsak: ['Teszt'] });
  const p = await v.post(b);
  assert.deepEqual([p.allapot, p.kuldheto, p.booking_id], ['parositott', true, BID]);
  const n = v.net.hivasok.length; assert.ok(n >= 4);
  v.t.set(SD_ELOTT);
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.kuldes, r.booking_id], ['motor_kuldte', 0, BID]);
  assert.equal(v.net.hivasok.length, n);
  assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', FIX_UUID)[0].sd_id, null);
});

test('S0-11 kapcsolo ki -> 0 iras / 0 kuldes (kornyezeti kapu, hianyzo D1-kapcsolo = KI, uzletag-sor felulirja az osszesitot)', async () => {
  const dumpTablak = ['foglalas_egyeztetes', 'foglalas_vendeg', 'foglalas_alias', 'foglalas_reschedule', 'meres_kuldes', 'meres_jelleg'];
  { // kornyezeti kapu nincs
    const v = vilag({ sd: false }); await v.kesz;
    const u = ujUuid(); const b = level(u, { uj_vendeg: true }); await lezar(v, b); v.t.set(SD_ELOTT);
    const elotte = dump(v, dumpTablak);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, /MERES_SALONIC_DIRECT/.test(r.miert)], ['ki', true]);
    assert.equal(dump(v, dumpTablak), elotte); assert.equal(v.net.hivasok.length, 0);
  }
  { // kornyezeti kapu be, de a D1-kapcsolo hianyzik (alap: KI)
    const { v, b } = await jelolt({ kapcsolo: null }, { uj_vendeg: true });
    const elotte = dump(v, dumpTablak);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, /alap: ki/.test(r.miert)], ['ki', true]);
    assert.equal(dump(v, dumpTablak), elotte); assert.equal(v.net.hivasok.length, 0);
    // az uzletag-kapcsolo ELLENTETES iranyban is mukodik: csak a pmu be
    await v.kapcsol('fodrasz', true);
    assert.equal((await v.sd(b)).allapot, 'ki', 'mas uzletag kapcsoloja nem kapcsol be');
    await v.kapcsol('pmu', true);
    assert.equal((await v.sd(b)).allapot, 'kesz');
  }
  { // osszesito be, az uzletag-sor ki
    const { v, b } = await jelolt({}, { uj_vendeg: true });
    await v.kapcsol('pmu', false);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, /salonic_direct:pmu/.test(r.miert)], ['ki', true]); assert.equal(v.net.hivasok.length, 0);
    await v.kapcsol('pmu', true); assert.equal((await v.sd(b)).allapot, 'kesz');
  }
  { // MERES_ELOSZTO nelkul az atvetel NEM tortenik meg (a motoros parositast nem zarjuk le kuldes nelkul)
    const { v, u, b } = await jelolt({ env: { MERES_ELOSZTO: '0' } }, { uj_vendeg: true });
    const r = await v.sd(b);
    assert.equal(r.allapot, 'ki'); assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_id, null);
  }
});

test('S0-12 ket level eltero "uj vendeg" jelzessel -> egy alapesemeny-tipus (az elso kiertekeles jellege rogzul)', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true });
  v.net.allapot.set(u, 'hiba');
  assert.equal((await v.sd(b)).allapot, 'tartva'); // az elso kiertekeles: elso (FoglalasElso), a kuldes halasztva
  v.net.allapot.delete(u);
  const r = await v.sd({ ...b, uj_vendeg: false }); // a Salonic-vendegrekord miatt a kovetkezo level mar "visszatero"
  assert.equal(r.allapot, 'kesz');
  assert.deepEqual([...new Set(cellak(v).filter((c) => c.esemeny_tipus === 'alap').map((c) => c.esemeny_nev))], ['FoglalasElso']);
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE esemeny_nev = 'Visszajaro'")[0].n, 0);
});

test('S0-13 GOLDEN: a motoros kerelem-torzsek (Meta, TikTok, GA4, Google) es a naplo regi oszlopai BAJTRA azonosak a valtoztatas elotti allapottal', async () => {
  const kep = await motorKepek();
  assert.equal(Object.keys(kep.kerelmek).length, 300); // DECISION #194: 468 -> 300 (a 168 kuponos kerelem megszunt; a 300 nem kuponos kerelem BAJTRA azonos a regi fixture-rel)
  assert.equal(JSON.stringify(kep) + '\n', fs.readFileSync(FIXTURE, 'utf8'));
});

test('S0-14 0 elo azonosito az sd kerelmekben: csak az ARNYEK dataset / pixel + tesztkod; az elo cel tiltolistaja valtozatlan', async () => {
  const { v, b } = await jelolt({}, { uj_vendeg: true });
  await v.sd(b);
  assert.ok(v.net.hivasok.length >= 4);
  const mind = JSON.stringify(v.net.hivasok);
  for (const cel of [...ELO_CELOK.meta, ...ELO_CELOK.tiktok, ...ELO_CELOK.ga4, ...ELO_CELOK.google_primary]) assert.ok(!mind.includes(cel), 'elo azonosito: ' + cel);
  assert.ok(v.net.hivasok.filter((h) => h.kulcs === 'meta').every((h) => h.url.includes('/28616665324611098/events') && h.body.test_event_code === 'TEST12345'));
  assert.ok(v.net.hivasok.filter((h) => h.kulcs === 'tiktok').every((h) => h.body.test_event_code === 'TEST67890' && h.body.event_source_id));
  { // az elo celpont tovabbra is tiltott: elo Meta dataset a kornyezetben -> tiltva, 0 kuldes
    const { v: v2, b: b2 } = await jelolt({ env: { META_ARNYEK_DATASET: ELO_CELOK.meta[0] } }, { uj_vendeg: true });
    await v2.sd(b2);
    assert.equal(v2.net.hivasok.filter((h) => h.kulcs === 'meta').length, 0);
    assert.ok(cellak(v2).filter((c) => c.platform === 'meta').every((c) => c.allapot === 'tiltva'));
  }
});

test('S0-15 a D1-ben es a naplozott kerelmekben NINCS nyers e-mail / telefon / nev / megjegyzes; nyers UUID csak az azonosito-oszlopokban', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true, megjegyzes: 'Kérem a csendes sarkot, köszönöm!' });
  await v.sd(b);
  const tablak = ['foglalas_egyeztetes', 'foglalas_vendeg', 'foglalas_alias', 'foglalas_reschedule', 'meres_kuldes', 'meres_jelleg', 'meres_kapcsolo'];
  const mind = dump(v, tablak);
  for (const tiltott of ['teszt.claude', 'example.com', '000 0001', '300000001', '36300000001', 'Teszt Claude', 'teszt claude', 'csendes sarkot']) assert.ok(!mind.toLowerCase().includes(tiltott.toLowerCase()), 'nyers adat a D1-ben: ' + tiltott);
  const keresek = JSON.stringify([...v.sql('SELECT kerelem, platform_valasz, indok, attr_jelek FROM meres_kuldes'), ...v.net.hivasok]);
  for (const tiltott of ['teszt.claude', 'example.com', '000 0001', 'Teszt Claude', u, u.toUpperCase()]) assert.ok(!keresek.includes(tiltott), 'nyers adat a kerelemben: ' + tiltott);
  const attr = JSON.parse(v.sql('SELECT attr_jelek FROM meres_kuldes LIMIT 1')[0].attr_jelek);
  assert.deepEqual(attr, { forras: 'salonic_level', email_hash: true, telefon_hash: true, click_id: false, fbp: false, ttp: false, ga4_client_id: false, ip_ua: false });
});

test('S0-16 a HMAC-azonosito stabil (uuid + nevter -> ugyanaz), nem a nyers UUID; titok nelkul / ervenytelen UUID-ra nincs identity', async () => {
  const u = '3f10fabc-4f7d-9257-2088-cfe7b5b24a2e';
  const var1 = 'sd_' + crypto.createHmac('sha256', SD_ENV.SD_HMAC_KEY_V1).update(`v1|smoke|${u}`).digest('hex').slice(0, 24);
  assert.equal(await sdIdentitas({ ...SD_ENV }, u), var1);
  assert.equal(await sdIdentitas({ ...SD_ENV }, u.toUpperCase()), var1, 'kis- / nagybetu azonos');
  assert.match(var1, /^sd_[0-9a-f]{24}$/);
  assert.notEqual(await sdIdentitas({ ...SD_ENV, MERES_SD_NS: undefined }, u), var1, 'prod nevter masik azonosito');
  assert.equal(await sdIdentitas({ ...SD_ENV, MERES_SD_NS: undefined }, u), 'sd_' + crypto.createHmac('sha256', SD_ENV.SD_HMAC_KEY_V1).update(`v1|prod|${u}`).digest('hex').slice(0, 24));
  assert.notEqual(await sdIdentitas({ ...SD_ENV, SD_HMAC_KEY_V1: 'masik-kulcs-0123456789abcdef' }, u), var1);
  assert.notEqual(await sdIdentitas(SD_ENV, '3f10fabc-4f7d-9257-2088-cfe7b5b24a2f'), var1);
  assert.ok(!var1.includes('3f10fabc'));
  assert.equal(await sdIdentitas({}, u), null); assert.equal(await sdIdentitas({ ...SD_ENV, SD_HMAC_KEY_V1: 'rovid' }, u), null); assert.equal(await sdIdentitas(SD_ENV, 'nem-uuid'), null);
});

// --- csere (reschedule) esetek: DECISION #131 -------------------------------------------------------------------------------------------------
const MEGJ_99 = 'A korábbi 16 órás foglalásomat cserélném erre.'; // a 99ffaec4 valodi megjegyzesenek szovege (vendegadat nincs benne)
/** A "regi" foglalas (10-16 16:00, PMU, Soft powder) letrehozo levele 3 nappal korabban; az index (hook) hash-eli. */
async function regiFoglalas(v, o = {}) {
  const regi = o.uuid || ujUuid();
  const r = await v.post(level(regi, { ld: { startDate: o.start || '2026-10-16T16:00:00+02:00' }, level_datuma: iso(T0 - 3 * 86400_000), uj_vendeg: false, ...(o.mod || {}) }));
  assert.ok(r.ok);
  return regi;
}
async function csereVilag(o = {}) { // a regi foglalas indexelve + az uj foglalas (Oct 20 16:00) lezart motorral
  const v = vilag(o.vilag || {}); await v.kesz;
  const regi = o.nincsRegi ? null : await regiFoglalas(v, o.regi || {});
  const regi2 = o.masodikRegi ? await regiFoglalas(v, { start: '2026-10-14T16:00:00+02:00' }) : null;
  const u = ujUuid(); const b = level(u, { megjegyzes: MEGJ_99, ...(o.uj || {}) });
  await lezar(v, b); v.t.set(SD_ELOTT);
  return { v, regi, regi2, u, b };
}

test('S0-17 99ffaec4-negativ (reschedule_confirmed): azonos vendeg-hash + PMU + "16 oras" -> pontosan 1 jelolt -> 0 uj esemeny, reschedule_from/to, old_booking_still_active + riasztas', async () => {
  const { v, regi, u, b } = await csereVilag();
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.sd_allapot, r.csere.allapot, r.csere.old_booking_still_active, r.riasztas], ['reschedule_confirmed', 'reschedule_confirmed', 'confirmed', true, true]);
  assert.deepEqual([r.csere.reschedule_from, r.csere.reschedule_to, r.csere.regi_uuid_elo8], ['2026-10-16T14:00:00.000Z', '2026-10-20T14:00:00.000Z', regi.slice(0, 8)]);
  assert.equal(v.net.hivasok.length, 0, 'NINCS uj konverzio egyetlen platformon sem');
  assert.equal(cellak(v).length, 4);
  assert.ok(cellak(v).every((c) => c.allapot === 'kihagyva' && /^reschedule_confirmed: nincs uj konverzio \(korabbi foglalas: /.test(c.indok)));
  assert.ok(v.sql('SELECT allapot, indok FROM meres_kuldes').every((c) => cellaOsztaly(c).osztaly === 'jogos_0'), 'a QA nevezojen kivul (jogos_0)');
  assert.deepEqual(v.sql('SELECT allapot, reschedule_from, reschedule_to, regi_uuid, regi_aktiv FROM foglalas_reschedule WHERE uuid = ?1', u), [{ allapot: 'confirmed', reschedule_from: '2026-10-16T14:00:00.000Z', reschedule_to: '2026-10-20T14:00:00.000Z', regi_uuid: regi, regi_aktiv: 1 }]);
  const alert = await riasztasok(v, u);
  assert.deepEqual(alert.map((x) => [x.tipus, x.regi_uuid_elo8, x.reschedule_from]), [['old_booking_still_active', regi.slice(0, 8), '2026-10-16T14:00:00.000Z']]);
  assert.deepEqual((await riasztasok(v)).map((x) => x.tipus).sort(), ['old_booking_still_active', 'sd_hianyzik'], 'a regi foglalas sajat (nem sd-kezelt) lezart parositatlan sora helyesen sd_hianyzik');
  assert.equal((await v.sd(b)).idempotens, true); assert.equal(v.net.hivasok.length, 0);
});

test('S0-18 vendeg-hash elter -> reschedule_suspected: HOLD (cellak halasztva) + riasztas, 0 automatikus kuldes', async () => {
  const { v, u, b } = await csereVilag({ regi: { mod: { vendeg: { email: VENDEG.email, telefon: '+36 30 111 2222' }, nev: 'Masik Valaki' } } });
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.csere.allapot, r.riasztas], ['halasztva', 'suspected', true]);
  assert.match(r.csere.ok, /nincs azonos vendeg \/ szolgaltatas jelolt/);
  assert.equal(v.net.hivasok.length, 0);
  assert.ok(cellak(v).length === 4 && cellak(v).every((c) => c.allapot === 'halasztva' && /^reschedule_suspected: HOLD/.test(c.indok)));
  assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['reschedule_suspected']);
  assert.equal((await v.sd(b)).allapot, 'halasztva'); assert.equal(v.net.hivasok.length, 0, 'ismetlesre sem kuld');
  assert.equal(v.sql('SELECT allapot FROM foglalas_reschedule WHERE uuid = ?1', u)[0].allapot, 'suspected');
});

test('S0-19 a megjegyzes idopontja KET jeloltre mutat -> reschedule_suspected (HOLD), 0 kuldes', async () => {
  const { v, b } = await csereVilag({ masodikRegi: true }); // 10-16 16:00 es 10-14 16:00; a megjegyzes csak "16 oras"
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.csere.allapot, r.csere.jeloltek.mutatott], ['halasztva', 'suspected', 2]);
  assert.match(r.csere.ok, /tobb jeloltre is mutat/);
  assert.equal(v.net.hivasok.length, 0);
  { // a megjegyzes datumot is megad (okt. 16.) -> pontosan 1 jelolt
    const w = await csereVilag({ masodikRegi: true, uj: { megjegyzes: 'A korábbi október 16-i 16 órás foglalásomat cserélném erre.' } });
    const r2 = await w.v.sd(w.b);
    assert.deepEqual([r2.allapot, r2.csere.allapot, r2.csere.regi_uuid_elo8], ['reschedule_confirmed', 'confirmed', w.regi.slice(0, 8)]);
  }
});

test('S0-20 a megjegyzesben emlitett korabbi foglalas NINCS az indexben -> reschedule_suspected (HOLD), 0 kuldes', async () => {
  const { v, b } = await csereVilag({ nincsRegi: true });
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.csere.allapot, r.csere.jeloltek.indexben], ['halasztva', 'suspected', 0]);
  assert.equal(v.net.hivasok.length, 0);
  { // az index mas idopontot ismer (nem 16 ora): nem mutat egyre sem
    const w = await csereVilag({ regi: { start: '2026-10-16T11:00:00+02:00' } });
    const r2 = await w.v.sd(w.b);
    assert.deepEqual([r2.allapot, r2.csere.allapot, r2.csere.jeloltek.azonos_vendeg_szolgaltatas, r2.csere.jeloltek.mutatott], ['halasztva', 'suspected', 1, 0]);
  }
  { // masik szolgaltatas: nem jelolt
    const w = await csereVilag({ regi: { mod: { szolgaltatas: 'Lip blush' } } });
    assert.equal((await w.v.sd(w.b)).csere.allapot, 'suspected');
  }
});

test('S0-21 a regi foglalas mar LEMONDVA (elo ellenorzes) -> reschedule_confirmed riasztas NELKUL (old_booking_still_active=false), 0 uj esemeny', async () => {
  const { v, regi, u, b } = await csereVilag();
  v.net.allapot.set(regi, 'torolve');
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.csere.allapot, r.csere.old_booking_still_active, r.riasztas], ['reschedule_confirmed', 'confirmed', false, false]);
  assert.equal(v.net.hivasok.length, 0);
  assert.deepEqual(await riasztasok(v, u), []);
});

test('S0-22 megjegyzes csere-gyanu NELKUL -> normal sd ut (az esemenyek kimennek), meg akkor is, ha a vendegnek van korabbi foglalasa', async () => {
  const { v, u, b } = await csereVilag({ uj: { megjegyzes: 'Allergiás vagyok a latexre, köszönöm!', uj_vendeg: false } });
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.csere], ['kesz', null]);
  assert.deepEqual(hivasNev(v), ['meta:PMU_Visszajaro', 'tiktok:PMU_Visszajaro']);
  assert.deepEqual(await riasztasok(v, u), []);
  assert.equal(v.sql('SELECT COUNT(*) AS n FROM foglalas_reschedule')[0].n, 0);
});

test('S0-23 sd_feloldas: suspected -> confirmed (0 kuldes) | uj_konverzio (egyszer kimegy); ervenytelen feloldasok elutasitva', async () => {
  { // confirmed
    const { v, b } = await csereVilag({ nincsRegi: true });
    assert.equal((await v.sd(b)).allapot, 'halasztva');
    assert.equal((await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed' })).allapot, 'ervenytelen_feloldas', 'ok nelkul nincs feloldas');
    const szaraz = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'emberi ellenorzes: ugyanaz a vendeg', szaraz: true });
    assert.deepEqual([szaraz.allapot, szaraz.terv.feloldas], ['szaraz_terv', 'confirmed']);
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'emberi ellenorzes: ugyanaz a vendeg' });
    assert.deepEqual([r.allapot, r.feloldas, r.riasztas], ['feloldva_confirmed', 'confirmed', false]);
    assert.equal(v.net.hivasok.length, 0);
    assert.ok(cellak(v).every((c) => c.allapot === 'kihagyva' && /feloldva/.test(c.indok)));
    assert.deepEqual(await riasztasok(v, b.uuid), []);
    assert.equal((await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'x' })).allapot, 'feloldas_nem_lehetseges', 'mar feloldott');
    assert.equal((await v.sd(b)).allapot, 'feloldva_confirmed'); assert.equal(v.net.hivasok.length, 0);
  }
  { // uj_konverzio
    const { v, b } = await csereVilag({ nincsRegi: true });
    await v.sd(b); assert.equal(v.net.hivasok.length, 0);
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi ellenorzes: uj vendeg, nem csere' });
    assert.deepEqual([r.allapot, r.feloldas], ['feloldva_uj', 'uj_konverzio']);
    assert.deepEqual(hivasNev(v), ['meta:PMU_Visszajaro', 'tiktok:PMU_Visszajaro']);
    assert.ok(cellak(v).filter((c) => c.platform === 'meta' || c.platform === 'tiktok').every((c) => c.allapot === 'elkuldve'));
    assert.equal(v.sql('SELECT allapot FROM foglalas_reschedule WHERE uuid = ?1', b.uuid)[0].allapot, 'feloldva_uj');
    const n = v.net.hivasok.length;
    assert.equal((await v.sd(b)).allapot, 'feloldva_uj'); assert.equal(v.net.hivasok.length, n, 'ujrahivasra 0 extra');
    assert.deepEqual(await riasztasok(v, b.uuid), []);
  }
  { // feloldas olyan UUID-ra, ahol nincs sd atvetel / nem halasztva
    const { v, b } = await jelolt({}, { uj_vendeg: true });
    assert.equal((await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'x' })).allapot, 'feloldas_nem_lehetseges');
    await v.sd(b);
    assert.equal((await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'x' })).allapot, 'feloldas_nem_lehetseges', 'kesz (nem halasztva) sorra nincs feloldas');
  }
});

// --- kiegeszito vedelmek -----------------------------------------------------------------------------------------------------------------------
test('S0-24 megjegyzes- es idopont-ertelmezes: csere-gyanu (ekezet-fuggetlen), emlitett idopontok, egyezes; szolgaltatas-kanon; vendeg-azonossag', async () => {
  for (const igen of [MEGJ_99, 'Szeretném áthelyezni a foglalásomat', 'Időpontcsere miatt', 'a korábbi időpont helyett', 'Módosítottam az időpontot', 'lemondtam a másikat', 'Elhalasztom egy héttel',
    // a kodattekintes (2026-10-11) altal jelzett megfogalmazasok: ezek is csere-gyanuk (HOLD vagy igazolt csere), nem csendes uj konverzio
    'Áttettem a 16:00-s időpontomat', 'Áttenném a 16 órásat erre', 'Eltolnám egy nappal', 'Megváltoztatnám a korábbi időpontot', 'Átírnám a foglalásomat', 'Új időpontot kérek', 'Másik időpontra szeretném',
    'rescheduled from 16:00', 'instead of the 16:00 slot', 'moved from yesterday', 'my original booking was at 16:00', 'previous appointment 16:00', 'Please change my time', 'swap with the earlier one']) assert.ok(csereGyanu(igen), igen);
  for (const nem of ['', null, undefined, 'Allergiás vagyok a latexre', 'Kérem a csendes sarkot', 'Először jövök, kicsit izgulok', 'Szeretnék kávét kérni', 'Áttekintettem az árlistát', 'Allergiás vagyok, kérem a hipoallergén festéket', 'First time here, thank you']) assert.ok(!csereGyanu(nem), String(nem));
  assert.ok(CSERE_GYANU instanceof RegExp && CSERE_GYANU.test('cserelnem') && !CSERE_GYANU.test('kave'));
  assert.deepEqual(megjegyzesIdopontok(MEGJ_99), { idok: [{ ora: 16, perc: null }], datumok: [] });
  assert.deepEqual(megjegyzesIdopontok('október 16-án 16:30-ról cserélem'), { idok: [{ ora: 16, perc: 30 }], datumok: [{ ev: null, ho: 10, nap: 16 }] });
  assert.deepEqual(megjegyzesIdopontok('a 2026.10.14. 11 órás').datumok, [{ ev: 2026, ho: 10, nap: 14 }]);
  assert.deepEqual(megjegyzesIdopontok('a 10.16. 9:00-s foglalás'), { idok: [{ ora: 9, perc: 0 }], datumok: [{ ev: null, ho: 10, nap: 16 }] });
  assert.deepEqual(megjegyzesIdopontok('már 16 órás'), { idok: [{ ora: 16, perc: null }], datumok: [] }, 'a "már" nem marcius');
  assert.deepEqual(megjegyzesIdopontok('nincs ido'), { idok: [], datumok: [] });
  const k = Date.parse('2026-10-16T14:00:00Z') / 1000; // 16:00 Budapest
  assert.ok(mutatEgyre(megjegyzesIdopontok('16 órás'), k) && mutatEgyre(megjegyzesIdopontok('16:00'), k) && mutatEgyre(megjegyzesIdopontok('okt. 16. 16:00'), k));
  assert.ok(!mutatEgyre(megjegyzesIdopontok('17 órás'), k) && !mutatEgyre(megjegyzesIdopontok('16:30'), k) && !mutatEgyre(megjegyzesIdopontok('október 17. 16:00'), k) && !mutatEgyre(megjegyzesIdopontok('2025.10.16. 16:00'), k) && !mutatEgyre({ idok: [], datumok: [] }, k));
  assert.equal(szolgKanon('KUPONKÓDDAL - Soft powder (12 000 Ft helyett most 9 900 Ft)'), szolgKanon('soft  powder'));
  assert.equal(szolgKanon('🌸 Soft powder'), 'soft powder'); assert.notEqual(szolgKanon('Lip blush'), szolgKanon('Soft powder')); assert.equal(szolgKanon(''), null);
  assert.equal(nevNorm('Kovács  Anna'), nevNorm('anna kovacs')); assert.equal(nevNorm('Al'), null);
  const h1 = await vendegHash(SD_ENV, VENDEG, NEV), h2 = await vendegHash(SD_ENV, { email: ' TESZT.Claude@Example.com ', telefon: '06 30 000 0001' }, 'claude teszt');
  assert.deepEqual(h1, h2); assert.match(h1.email_h, /^[0-9a-f]{32}$/);
  assert.ok(azonosVendeg(h1, h2) && azonosVendeg(h1, { ...h2, tel_h: null }) && azonosVendeg(h1, { ...h2, nev_h: null }));
  assert.ok(!azonosVendeg(h1, { ...h2, tel_h: 'x', nev_h: 'y' }) && !azonosVendeg(h1, { ...h2, email_h: 'z' }) && !azonosVendeg(h1, { email_h: h1.email_h, tel_h: null, nev_h: null }) && !azonosVendeg(null, h2));
  assert.equal(await vendegHash({}, VENDEG, NEV), null);
});

test('S0-25 vendeg-hash index: CSAK hash (nincs nyers adat), idempotens, 180 nap, a hook kapuhoz kotott; a backfill kuldes NELKUL, idempotens, szaraz modban nem ir', async () => {
  { // kapu zarva: a hook nem ir (sem env-flag, sem index-flag)
    const v = vilag({ sd: false }); await v.kesz;
    await v.post(level(ujUuid(), {}));
    assert.ok(!tablaVan(v, 'foglalas_vendeg') || szamol(v, 'foglalas_vendeg') === 0);
  }
  const v = vilag(); await v.kesz;
  const u = ujUuid();
  await v.post(level(u, {}));
  await v.post(level(u, {})); // a 2. proba: ON CONFLICT DO NOTHING
  const sorok = v.sql('SELECT * FROM foglalas_vendeg');
  assert.equal(sorok.length, 1);
  assert.deepEqual([sorok[0].uuid, sorok[0].uzletag, sorok[0].allapot, sorok[0].forras, sorok[0].szolg_kulcs, sorok[0].kezdet], [u, 'pmu', 'aktiv', 'level', 'soft powder', Date.parse('2026-10-20T14:00:00Z') / 1000]);
  assert.equal(sorok[0].lejar - sorok[0].ido, 180 * 86400);
  assert.ok([sorok[0].email_h, sorok[0].tel_h, sorok[0].nev_h].every((x) => /^[0-9a-f]{32}$/.test(x)));
  assert.equal(JSON.stringify(sorok).includes('example.com'), false);
  assert.equal(v.net.hivasok.length, 0, 'az index kuldes nelkuli');
  { // csak az INDEX-kapu (MERES_SD_INDEX): a hook ir, az sd_atvetel viszont ki
    const w = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await w.kesz;
    const b = level(ujUuid(), { uj_vendeg: true });
    await lezar(w, b); w.t.set(SD_ELOTT);
    assert.equal(szamol(w, 'foglalas_vendeg'), 1);
    assert.equal((await w.sd(b)).allapot, 'ki'); assert.equal(w.net.hivasok.length, 0);
  }
  { // backfill
    const elem = (i, o = {}) => ({ uuid: ujUuid(), host: 'mosaic-pmu.salonic.hu', szolgaltatas: 'Soft powder', idopont_szoveg: 'Október 16. (péntek) 16:00 - 17:00', level_datuma: iso(T0 - i * 86400_000), vendeg: { ...VENDEG }, nev: NEV, ...o });
    const elemek = [elem(1), elem(2), elem(3, { allapot: 'torolve' }), elem(4, { vendeg: { email: 'nem-email' } }), elem(5, { host: 'evil.example.com' })];
    const n0 = szamol(v, 'foglalas_vendeg');
    const szaraz = await v.post({ muvelet: 'index_backfill', elemek, szaraz: true });
    assert.deepEqual([szaraz.allapot, szaraz.szaraz, szaraz.uj, szaraz.hibas.length, szaraz.kuldes], ['kesz', true, 3, 2, 0]);
    assert.equal(szamol(v, 'foglalas_vendeg'), n0, 'szaraz: nem ir');
    const be = await v.post({ muvelet: 'index_backfill', elemek });
    assert.deepEqual([be.uj, be.meglevo, be.hibas.map((h) => h.i)], [3, 0, [3, 4]]);
    assert.equal(szamol(v, 'foglalas_vendeg'), n0 + 3);
    assert.equal(v.sql("SELECT allapot FROM foglalas_vendeg WHERE uuid = ?1", elemek[2].uuid)[0].allapot, 'torolve');
    const ujra = await v.post({ muvelet: 'index_backfill', elemek });
    assert.deepEqual([ujra.uj, ujra.meglevo], [0, 3], 'idempotens');
    assert.equal(szamol(v, 'foglalas_vendeg'), n0 + 3);
    assert.equal(v.net.hivasok.length, 0); assert.equal(szamol(v, 'meres_kuldes'), 0, 'a backfill SEND-FREE');
    assert.equal((await v.post({ muvelet: 'index_backfill', elemek: [] })).allapot, 'ures');
    assert.equal((await vilag({ sd: false }).post({ muvelet: 'index_backfill', elemek })).allapot, 'ki');
  }
});

test('S0-26 szaraz (irasmentes) terv: a D1 nem valtozik, nem kuld, a terv megmutatja a donteseket', async () => {
  const tablak = ['foglalas_egyeztetes', 'foglalas_vendeg', 'foglalas_alias', 'foglalas_reschedule', 'meres_kuldes', 'meres_jelleg'];
  { const { v, b } = await jelolt({}, { uj_vendeg: true });
    const elotte = dump(v, tablak);
    const r = await v.sd({ ...b, szaraz: true });
    assert.equal(r.allapot, 'szaraz_terv'); assert.equal(r.terv.mod, 'normal'); assert.equal(r.terv.motor_allapot, 'parositatlan'); assert.equal(r.terv.ertek_minoseg, 'unknown_price');
    assert.deepEqual(r.terv.terv_esemenyek.map((e) => e.nev), ['FoglalasElso', 'Schedule']);
    assert.equal(dump(v, tablak), elotte); assert.equal(v.net.hivasok.length, 0);
    assert.equal((await v.sd(b)).allapot, 'kesz', 'a szaraz hivas utan az eles atvetel meg szabad'); }
  { const { v, b } = await csereVilag();
    const elotte = dump(v, tablak);
    const r = await v.sd({ ...b, szaraz: true });
    assert.deepEqual([r.allapot, r.terv.mod, r.terv.csere.allapot], ['szaraz_terv', 'confirmed', 'confirmed']);
    assert.equal(dump(v, tablak), elotte); assert.equal(v.net.hivasok.length, 0); }
});

test('S0-27 a kesei mb_ kulcs az sd UTAN csak ALIAS (late_motor_key=1): nincs uj esemeny, nincs identity-csere / ujrakuldes', async () => {
  const v = vilag(); await v.kesz;
  const b = level(FIX_UUID, { host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció', uj_vendeg: true, munkatarsak: ['Teszt'] });
  await lezar(v, b); v.t.set(SD_ELOTT);
  const r = await v.sd(b);
  assert.equal(r.allapot, 'kesz');
  const n = v.net.hivasok.length, sorok = szamol(v, 'meres_kuldes'); assert.equal(n, 4);
  const iras = await kulcsIras(v.db, { bookingId: BID, bookingUrl: HAIR_URL }, v.t()); // a koszonooldal MOST irja a kulcsot (az sd mar kuldott)
  assert.ok(iras.ok);
  assert.deepEqual(v.sql('SELECT sd_id, booking_id, uuid, late_motor_key FROM foglalas_alias'), [{ sd_id: r.sd_id, booking_id: BID, uuid: FIX_UUID, late_motor_key: 1 }]);
  await kulcsIras(v.db, { bookingId: BID, bookingUrl: HAIR_URL }, v.t()); // ismetles: idempotens
  assert.equal(szamol(v, 'foglalas_alias'), 1);
  const p = await v.post(b); // a motoros parositas tovabbi probaja: az sd mar atvette
  assert.deepEqual([p.allapot, p.kuldheto, p.sd_atveve], ['parositatlan', false, true]);
  assert.equal(v.net.hivasok.length, n); assert.equal(szamol(v, 'meres_kuldes'), sorok);
  assert.deepEqual(v.sql('SELECT booking_id, kuldve, sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', FIX_UUID).map((x) => [x.booking_id, x.kuldve, x.sd_id === r.sd_id]), [[null, null, true]]);
  { // mas kulcsra irt foglalas nem alias
    const w = vilag(); await w.kesz; await lezar(w, b); w.t.set(SD_ELOTT); await w.sd(b);
    await kulcsIras(w.db, { bookingId: 'mb_0aaaaaaaaaaaaaaaaaaaaaaa', bookingUrl: HAIR_URL.replace('startDate=1792512000', 'startDate=1792598400').replace(BID, 'mb_0aaaaaaaaaaaaaaaaaaaaaaa') }, w.t());
    assert.equal(szamol(w, 'foglalas_alias'), 0);
  }
});

test('S0-28 korai (< 20 perc), lejart (> 48 ora), fuggoben (varakozas) es motor-ellentmondas: nincs automatikus atvetel / kuldes', async () => {
  { // < 20 perc: nincs teendo, nincs iras
    const v = vilag(); await v.kesz; const b = level(ujUuid(), { uj_vendeg: true }); await lezar(v, b);
    v.t.set(T0 + (SD_MIN_KOR_MP - 30) * 1000);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.ujra_mp], ['koran', 30]);
    assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes')[0].sd_id, null); assert.equal(v.net.hivasok.length, 0);
  }
  { // > 48 ora: naplo + riasztas, 0 automatikus kuldes
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    v.t.set(T0 + 49 * 3600_000);
    const szaraz = await v.sd({ ...b, szaraz: true }); assert.equal(szaraz.terv.lenne, 'lejart');
    assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_id, null);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.riasztas, r.kuldes], ['lejart', true, 0]);
    assert.equal(v.net.hivasok.length, 0); assert.equal(szamol(v, 'meres_kuldes'), 0);
    assert.deepEqual(v.sql('SELECT sd_allapot, riasztas FROM foglalas_egyeztetes WHERE uuid = ?1', u), [{ sd_allapot: 'lejart', riasztas: 1 }]);
    assert.deepEqual((await v.get('sd_riasztas=1')).lista.map((x) => x.tipus), ['lejart_48_ora']);
    assert.equal((await v.sd(b)).idempotens, true);
  }
  { // 48 ora pontosan: meg bent van
    const { v, b } = await jelolt({}, { uj_vendeg: true });
    v.t.set(T0 + 48 * 3600_000);
    assert.equal((await v.sd(b)).allapot, 'kesz');
  }
  { // a motoros parositas meg nincs lezarva (fuggoben, kovetkezo a jovoben): varakozas
    const v = vilag(); await v.kesz; const b = level(ujUuid(), { uj_vendeg: true });
    await v.post(b); // 1. proba: fuggoben (kovetkezo +60 s)
    v.t.set(T0 + SD_MIN_KOR_MP * 1000 + 1000);
    v.D.db.prepare("UPDATE foglalas_egyeztetes SET kovetkezo = ?1").run(Math.floor(v.t() / 1000) + 600);
    const r = await v.sd(b);
    assert.equal(r.allapot, 'varakozas'); assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes')[0].sd_id, null);
    assert.equal(r.ok_kod, 'varakozas_fuggoben'); assert.ok(r.ujra_mp >= 60 && r.ujra_mp <= SD_UJRA_MP, 'FO-3: ujra_mp a sorra varo idohoz igazodik, plafon 15 perc'); assert.ok(r.ujra_ig_mp > 0 && r.ujra_ig_mp <= 48 * 3600, 'FO-3: ujra_ig_mp a 48 oras korig');
  }
  { // motor-ellentmondas: ember dont
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    v.D.db.prepare("UPDATE foglalas_egyeztetes SET allapot = 'ellentmondas', riasztas = 1 WHERE uuid = ?1").run(u);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.riasztas], ['motor_ellentmondas', true]); assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_id, null);
  }
  { // nincs level-datum / ervenytelen UUID / ismeretlen host
    const { v, b } = await jelolt({}, { uj_vendeg: true });
    assert.equal((await v.sd({ ...b, level_datuma: undefined })).allapot, 'nincs_level_datuma');
    assert.equal((await v.sd({ ...b, host: 'evil.example.com' })).allapot, 'nincs_uzletag');
    assert.equal((await v.sd({ ...b, uuid: 'nem-uuid' })).allapot, 'ervenytelen');
  }
});

test('S0-29 az sd nem elozi meg a motort ugyanarra az UUID-ra egy masik identitassal: a (salonic_uuid, esemeny_nev, platform) egyedi index vedi a dedupot', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: false });
  // egy "motoros" Visszajaro-sor ugyanarra a Salonic-UUID-ra mar kikerult a Metara (mb_ identitas)
  await v.D.db.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, probalkozas, letrehozva, frissitve, forras, salonic_uuid) VALUES ('Visszajaro:mb_0aaaaaaaaaaaaaaaaaaaaaaa', 'Visszajaro', 'alap', 'meta', 'pmu', 'mb_0aaaaaaaaaaaaaaaaaaaaaaa', 'elkuldve', 1, 1, 1, 'motor', ?1)").run(u);
  const r = await v.sd(b);
  assert.equal(r.allapot, 'kesz');
  assert.deepEqual(hivasNev(v), ['tiktok:PMU_Visszajaro'], 'a Metara az sd NEM kuld ujra (az mb_ identitas mar kuldott)');
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE salonic_uuid = ?1 AND esemeny_nev = 'Visszajaro' AND platform = 'meta'", u)[0].n, 1);
  assert.deepEqual(v.sql('SELECT salonic_uuid, esemeny_nev, platform, count(*) AS n FROM meres_kuldes WHERE salonic_uuid IS NOT NULL GROUP BY 1,2,3 HAVING count(*) > 1'), []);
});

test('S0-30 veszkapcsolok: a globalis "mind" kikapcsolt -> a cellak veszkapcsolo-miatt kihagyva (ujraprobalhato); az iras-kapcsolo az sd_atvetelt is leallitja', async () => {
  { const { v, b } = await jelolt({}, { uj_vendeg: false });
    await kapcsoloBeallit(v.db, { be: false, ok: 'teszt' }, v.t());
    const r = await v.sd(b);
    assert.equal(r.allapot, 'kesz'); assert.equal(v.net.hivasok.length, 0);
    assert.ok(cellak(v).every((c) => c.allapot === 'kihagyva' && /^veszkapcsolo/.test(c.indok)));
    assert.ok(v.sql('SELECT allapot, indok FROM meres_kuldes').every((c) => cellaOsztaly(c).osztaly === 'hiany'), 'a veszkapcsolo miatti 0 NEM jogos 0: hiany marad a riportban');
    // MEGJEGYZES: a visszakapcsolas utani potlas (kihagyva/veszkapcsolo cella ujrakuldese) a MEGLEVO, kozos elosztas.js naploz() viselkedese - ez a valtoztatas nem modositja (lasd a jelentes "megfigyeles" pontjat)
  }
  { const { v, b } = await jelolt({}, { uj_vendeg: false });
    await irasKapcsolo(v.db, { be: false, ok: 'teszt' }, v.t());
    const r = await v.post({ ...b, muvelet: 'sd_atvetel' });
    assert.equal(r.ok, false); assert.equal(v.net.hivasok.length, 0); assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes')[0].sd_id, null); }
});

test('S0-31 sd-riasztasok: sd_hianyzik (a motor lezart, az 5. lepes nem jott), majd az atvetel utan megszunik; admin sd_kapcsolo (alapbol KI, uzletagonkent)', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true });
  assert.deepEqual((await v.get('sd_riasztas=1')).lista.map((x) => [x.tipus, x.uuid]), [['sd_hianyzik', u]]);
  await v.sd(b);
  assert.deepEqual((await v.get('sd_riasztas=1')).lista, []);
  { // a riasztas-lista kulcsos (404 kulcs nelkul); kapcsolo nelkuli kornyezetben nincs sd_hianyzik
    const w = vilag({ sd: false }); await w.kesz;
    assert.deepEqual((await w.get('sd_riasztas=1')).lista, []);
  }
  { // admin kapcsolo
    const w = vilag({ sd: true, kapcsolo: null }); await w.kesz;
    assert.equal((await sdKapcsolo(w.db, w.e, 'pmu')).be, false);
    const adm = (body) => kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?kulcs=${KULCS_SZOVEG}`, { method: 'POST', body: JSON.stringify(body) }), w.e, { now: w.t }).then((r) => r.json());
    assert.deepEqual(await adm({ muvelet: 'sd_kapcsolo', uzletag: 'pmu', be: true, ok: 'smoke' }), { ok: true, kulcs: 'salonic_direct:pmu', be: true });
    assert.equal((await sdKapcsolo(w.db, w.e, 'pmu')).be, true); assert.equal((await sdKapcsolo(w.db, w.e, 'fodrasz')).be, false);
    assert.deepEqual(await adm({ muvelet: 'sd_kapcsolo', be: true }), { ok: true, kulcs: 'salonic_direct', be: true });
    assert.equal((await sdKapcsolo(w.db, w.e, 'fodrasz')).be, true);
    assert.equal((await adm({ muvelet: 'sd_kapcsolo', uzletag: 'nincs', be: true })).ok, false);
    assert.equal((await adm({ muvelet: 'sd_kapcsolo', be: 'igen' })).be, false, 'csak a szigoruan true kapcsol be');
    assert.equal((await kezelAdmin(new Request('https://x.pages.dev/api/meres-admin', { method: 'POST', body: JSON.stringify({ muvelet: 'sd_kapcsolo', be: true }) }), w.e)).status, 404, 'kulcs nelkul 404');
  }
});

test('S0-32 QA-5 retegezett riport (D6): motor / salonic_direct / osszes + attr_minoseg; az sd benne marad az osszes nevezoben; reschedule_confirmed sajat sor, jogos 0; hold = hiany; pre-T2 eredeti konverzio', async () => {
  const { egyeztetoSorok, egyeztetoCsv } = await import('../netlify/lib/meres/egyeztetes-sor.js');
  const { erkezesMent } = await import('../netlify/lib/meres/elosztas.js');
  const v = vilag(); await v.kesz;
  // (1) motoros, sajat booking_id-s foglalas (hair) teljes erkezesi pillanatkeppel -> A_teljes
  await kulcsIras(v.db, { bookingId: BID, bookingUrl: HAIR_URL }, v.t());
  await erkezesMent(v.db, { source_id: BID, uzletag: 'fodrasz', attr: { ga4: { client_id: '1234567890.1759759200', session_id: '1759759200', measurement_id: 'G-H4206SQ0Q7' }, fbp: `fb.1.${(T0 / 1000 - 9000) * 1000}.1234567890`, meta: { fbclid: 'IwAR_fbclid_TESZT_01', ts: T0 / 1000 - 90 } }, hozz: { ana: true, adv: true, fun: true }, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://x.pages.dev/foglalas-koszono' }, T0);
  await v.post(level(FIX_UUID, { host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció', uj_vendeg: true, munkatarsak: ['Teszt'] }));
  // (2) normal sd foglalas, (3) reschedule_confirmed (a regi foglalas motoros/sd esemeny nelkul: not_observed), (4) hold
  const n1 = ujUuid(); const b1 = level(n1, { uj_vendeg: true, ld: { startDate: '2026-10-22T11:00:00+02:00' } }); await lezar(v, b1);
  const regi = await regiFoglalas(v);
  const n2 = ujUuid(); const b2 = level(n2, { megjegyzes: MEGJ_99 }); await lezar(v, b2);
  const n3 = ujUuid(); const b3 = level(n3, { megjegyzes: 'Szeretném áthelyezni, a korábbi foglalásom 9 órás volt.', ld: { startDate: '2026-10-21T09:00:00+02:00' } }); await lezar(v, b3);
  v.t.set(SD_ELOTT);
  for (const b of [b1, b2, b3]) await v.sd(b);
  const tol = Math.floor(T0 / 1000) - 4 * 86400, ig = Math.floor(T0 / 1000) + 2 * 86400;
  const r = await egyeztetoSorok(v.db, { tol, ig });
  assert.equal(r.ok, true);
  const sor = (id) => r.sorok.find((s) => s.booking_id === id);
  const m = sor(BID), s1 = sor(await sdId(v, n1)), s2 = sor(await sdId(v, n2)), s3 = sor(await sdId(v, n3));
  assert.ok(m && s1 && s2 && s3);
  assert.deepEqual([m.forras, m.attr_minoseg, m.qa_kategoria, m.no_new_conversion_expected], ['motor', 'A_teljes', 'motor', false]);
  assert.deepEqual([s1.forras, s1.attr_minoseg, s1.qa_kategoria, s1.sd_allapot, s1.ertek_minoseg, s1.csere, s1.salonic_uuid], ['salonic_direct', 'C_salonic_direct', 'post_t2_booking_object', 'kesz', 'unknown_price', null, n1]);
  assert.deepEqual([s2.qa_kategoria, s2.no_new_conversion_expected, s2.csere.allapot, s2.csere.old_booking_still_active, s2.csere.pre_t2_original_conversion, s2.csere.regi_uuid_elo8], ['reschedule_confirmed', true, 'confirmed', true, 'not_observed', regi.slice(0, 8)]);
  assert.deepEqual([s3.qa_kategoria, s3.sd_allapot, s3.no_new_conversion_expected], ['reschedule_suspected_hold', 'halasztva', false]);
  assert.ok(s2.jelzesek.includes('old_booking_still_active') && s3.jelzesek.includes('reschedule_suspected_hold'));
  assert.ok(!s1.jelzesek.some((x) => /parositatlan|egyeztetes_/.test(x)) && s1.rendben, 'a sikeres sd sor rendben (a motoros "parositatlan" nem jelzes)');
  // cella-osztalyok: reschedule_confirmed = jogos 0 (nevezon kivul), hold = hiany
  assert.ok(s2.esemenyek.every((e) => Object.values(e.platformok).every((c) => c.osztaly === 'jogos_0')));
  assert.ok(s3.esemenyek.every((e) => Object.values(e.platformok).every((c) => c.osztaly === 'hiany')));
  assert.deepEqual(['meta', 'tiktok'].map((p) => s1.esemenyek[0].platformok[p].osztaly), ['ok', 'ok']);
  // retegek: az osszes nevezoben az sd is benne van; a reschedule_confirmed cellai nem
  const L = r.osszegzes;
  assert.deepEqual([L.retegek.motor.foglalas, L.retegek.salonic_direct.foglalas, L.retegek.osszes.foglalas, r.osszegzes.foglalas], [1, 3, 4, 4]);
  assert.deepEqual(L.lefedettseg, L.retegek.osszes.lefedettseg);
  const meta = (x) => x.lefedettseg.platformonkent.meta;
  assert.deepEqual([meta(L.retegek.salonic_direct).foglalas_osszes, meta(L.retegek.salonic_direct).jogosult, meta(L.retegek.salonic_direct).kezbesitve, meta(L.retegek.salonic_direct).hiany, meta(L.retegek.salonic_direct).jogos_0], [3, 2, 1, 1, 1]);
  assert.deepEqual([meta(L.retegek.osszes).foglalas_osszes, meta(L.retegek.osszes).jogosult], [4, 3], 'az sd benne van az osszes nevezoben, a reschedule_confirmed (jogos 0) nincs az eligible-ben');
  assert.deepEqual(Object.fromEntries(Object.entries(L.attr_minoseg_szerint).map(([k, x]) => [k, x.foglalas])), { A_teljes: 1, B_motor_reszleges: 0, C_salonic_direct: 3 });
  assert.deepEqual(L.salonic_direct.allapotok, { halasztva: 1, kesz: 1, reschedule_confirmed: 1 });
  assert.deepEqual([L.salonic_direct.arany, L.salonic_direct.reschedule.confirmed, L.salonic_direct.reschedule.suspected_hold, L.salonic_direct.reschedule.old_booking_still_active, L.salonic_direct.reschedule.no_new_conversion_expected], [0.75, 1, 1, 1, 1]);
  assert.deepEqual(L.salonic_direct.qa_kategoriak, { motor: 1, post_t2_booking_object: 1, reschedule_confirmed: 1, reschedule_suspected_hold: 1 });
  // forras-szuro + CSV + admin vegpont
  const csakSd = await egyeztetoSorok(v.db, { tol, ig, forras: 'salonic_direct' });
  assert.deepEqual(csakSd.sorok.map((x) => x.forras), ['salonic_direct', 'salonic_direct', 'salonic_direct']);
  const csv = egyeztetoCsv(r.sorok).trim().split('\n');
  assert.match(csv[0], /;forras;attr_minoseg;ertek_minoseg;qa_kategoria;no_new_conversion_expected$/);
  assert.ok(csv.some((l) => l.includes(';salonic_direct;C_salonic_direct;unknown_price;post_t2_booking_object;false')) && csv.some((l) => /;reschedule_confirmed;true$/.test(l)));
  const adm = await (await kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?kulcs=${KULCS_SZOVEG}&egyeztetes=1&tol=${tol}&ig=${ig}&forras=motor`), v.e, { now: v.t })).json();
  assert.deepEqual(adm.sorok.map((x) => x.forras), ['motor']);
  // a riport szemelyes adatot nem tartalmaz
  const mind = JSON.stringify(r) + csv.join('\n');
  for (const tiltott of ['teszt.claude', 'example.com', '000 0001', 'Teszt Claude', 'korábbi foglalásom', 'csendes']) assert.ok(!mind.includes(tiltott), tiltott);
  assert.ok(!/"ip"|203\.0\.113/.test(mind), 'az IP nem kerul a riportba');
});

test('S0-33 wrangler.toml: a MERES_SALONIC_DIRECT kapu az eles [vars]-ban a tulajdonosi jovahagyas (2026-10-13) utan van; MERES_SD_INDEX / MERES_SD_NS (smoke nevter) CSAK az elonezetben lehet; a titkok nincsenek a kodban', () => {
  const toml = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const elo = toml.slice(0, toml.indexOf('[env.preview.vars]')), elonezet = toml.slice(toml.indexOf('[env.preview.vars]'), toml.indexOf('[[kv_namespaces]]', toml.indexOf('[env.preview.vars]')));
  assert.match(elo, /^MERES_SALONIC_DIRECT = "1"/m); // a kornyezeti kapu onmagaban inert: D1-kapcsolo (alapbol KI) + ket titok nelkul nem kuld
  for (const kulcs of ['MERES_SD_INDEX', 'MERES_SD_NS']) assert.ok(!new RegExp(`^${kulcs}\\s*=`, 'm').test(elo), `${kulcs} nem lehet az eles [vars]-ban (az eles nevter az alapertelmezett prod)`);
  assert.match(elonezet, /^MERES_SALONIC_DIRECT = "1"/m); assert.match(elonezet, /^MERES_SD_NS = "smoke"/m);
  assert.ok(!/^(SD_HMAC_KEY_V1|GUEST_HMAC_KEY_V1)\s*=/m.test(toml), 'a titkok nem kerulhetnek a wrangler.toml-ba');
  assert.ok(!/(SD_HMAC_KEY_V1|GUEST_HMAC_KEY_V1)\s*[:=]\s*['"][^'"]{8,}['"]/.test(fs.readFileSync(new URL('../netlify/lib/meres/salonic-direct.js', import.meta.url), 'utf8')), 'a modulban nincs titok'); // a tesztek csak hamis, ket tesztkulcsot hasznalnak
});

test('S0-34 Megjegyzes (DECISION #132): letezo, de ures = normalis; HIANYZO payload-kulcs = hianyzo_mezo HOLD + riasztas; a kulcs megerkezese automatikusan potol; a csere-gyanu CSAK a Megjegyzes mezon fut', async () => {
  { // letezo, de ures megjegyzes: normal ut
    const { v, b } = await jelolt({}, { uj_vendeg: true, megjegyzes: '' });
    const r = await v.sd(b); assert.deepEqual([r.allapot, r.csere], ['kesz', null]); assert.equal(v.net.hivasok.length, 4);
  }
  { // hianyzo kulcs: HOLD (cellak halasztva) + riasztas, 0 kuldes; ismetlesre is; a kulcs megerkezese (akar uresen) potol
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    const { megjegyzes, ...nelkule } = b;
    const szaraz = await v.sd({ ...nelkule, szaraz: true });
    assert.deepEqual([szaraz.allapot, szaraz.terv.mod, szaraz.terv.csere.allapot], ['szaraz_terv', 'suspected', 'hianyzo_mezo']); assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_id, null);
    const r = await v.sd(nelkule);
    assert.deepEqual([r.allapot, r.csere.allapot, r.riasztas], ['halasztva', 'hianyzo_mezo', true]);
    assert.equal(v.net.hivasok.length, 0); assert.ok(cellak(v).length === 8 && cellak(v).every((c) => c.allapot === 'halasztva' && /^hianyzo_mezo: HOLD/.test(c.indok)));
    assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['hianyzo_mezo']);
    assert.equal((await v.sd(nelkule)).idempotens, true); assert.equal(v.net.hivasok.length, 0, 'tovabbra is hianyzo: marad a HOLD');
    const potol = await v.sd({ ...b, megjegyzes: '' }); // a Zap javitva: a kulcs megjott (uresen)
    assert.deepEqual([potol.allapot, potol.ujrafuttatva], ['kesz', true]); assert.equal(v.net.hivasok.length, 4);
    assert.equal(v.sql('SELECT allapot FROM foglalas_reschedule WHERE uuid = ?1', u)[0].allapot, 'hianyzo_mezo_potolva'); assert.deepEqual(await riasztasok(v, u), []);
  }
  { // potlas csere-gyanus megjegyzessel: az utolagos ertekeles confirmed -> 0 kuldes
    const { v, b } = await csereVilag();
    const { megjegyzes, ...nelkule } = b;
    assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); assert.equal(v.net.hivasok.length, 0);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.csere.allapot], ['reschedule_confirmed', 'confirmed']); assert.equal(v.net.hivasok.length, 0);
  }
  { // ember is feloldhatja
    const { v, b } = await jelolt({}, { uj_vendeg: false });
    const { megjegyzes, ...nelkule } = b;
    await v.sd(nelkule);
    assert.equal((await v.post({ ...nelkule, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi: nincs megjegyzes' })).allapot, 'feloldva_uj'); assert.equal(v.net.hivasok.length, 2);
  }
  { // a csere-gyanu regex CSAK a Megjegyzes mezon fut: a szolgaltatasnev "helyett"-je (ar-akcio) nem csere-gyanu
    const szolg = 'Soft powder (12 000 Ft helyett most 9 900 Ft)';
    assert.ok(csereGyanu(szolg), 'a regex onmagaban illeszkedne a "helyett"-re - ezert nem a szolgaltatasneven fut');
    const { v, b } = await jelolt({}, { uj_vendeg: false, szolgaltatas: szolg, megjegyzes: '' });
    const r = await v.sd(b); assert.deepEqual([r.allapot, r.csere], ['kesz', null]); assert.deepEqual(hivasNev(v), ['meta:PMU_Visszajaro', 'tiktok:PMU_Visszajaro']);
  }
});

test('S0-35 index_backfill (kuldesmentes HMAC-index) es event_backfill (TILOS) kulon: az event_backfill 403, kapuk nelkul is, nem ir, nem kuld; az sd regi (> 48 ora) foglalasra sem kuld', async () => {
  const { kezelEgyeztetes } = await import('../netlify/lib/foglalas-kulcs.js');
  for (const sd of [true, false]) {
    const v = vilag({ sd }); await v.kesz;
    const res = await kezelEgyeztetes(v.ker({ muvelet: 'event_backfill', elemek: [level(ujUuid(), {})] }), v.e, v.deps());
    const j = await res.json();
    assert.deepEqual([res.status, j.ok, j.allapot], [403, false, 'tilos']); assert.match(j.miert, /event_backfill tilos/);
    assert.ok(!tablaVan(v, 'meres_kuldes') || szamol(v, 'meres_kuldes') === 0); assert.equal(v.net.hivasok.length, 0);
  }
  { // az index_backfill nem kuld, es a regi neve (vendeg_index) mar nem muvelet
    const v = vilag(); await v.kesz;
    const r = await v.post({ muvelet: 'index_backfill', elemek: [{ uuid: ujUuid(), host: 'mosaic-pmu.salonic.hu', szolgaltatas: 'Soft powder', idopont_szoveg: 'Október 16. (péntek) 16:00 - 17:00', level_datuma: iso(T0 - 86400_000), vendeg: { ...VENDEG }, nev: NEV }] });
    assert.deepEqual([r.allapot, r.uj, r.kuldes], ['kesz', 1, 0]); assert.equal(v.net.hivasok.length, 0);
    const regi = await v.post({ muvelet: 'vendeg_index', elemek: [] }); assert.notEqual(regi.allapot, 'kesz');
  }
  { // 48 oranal regebbi foglalasra az sd nem kuld (nincs esemeny-utolag-kuldes)
    const { v, b } = await jelolt({}, { uj_vendeg: true });
    v.t.set(T0 + 72 * 3600_000);
    assert.equal((await v.sd(b)).allapot, 'lejart'); assert.equal(v.net.hivasok.length, 0);
  }
});

test('S0-36 hair / oxygen / laser (fodrasz / oxigen / szor) uzletag: a lista-ar a HOST placeId-jabol talalhato (nem a mas nevsemaju BUSINESSES-kulcsbol), es a regi foglalas elo ujraellenorzese is mukodik', async () => {
  const esetek = [['mosaic-hair.salonic.hu', 'fodrasz', 'Mosaic Hair', 'Tőfestés + Szárítás - Hosszú haj', 'Teszt Mester'], ['mosaic-oxigen.salonic.hu', 'oxigen', 'Mosaic Oxigén', 'Haj Oxigénterápia - 1. alkalom', 'Teszt Mester'], ['mosaic-elysion.salonic.hu', 'szor', 'Mosaic Elysion', 'Lézeres szőrtelenítés - Hónalj', 'Teszt Mester']];
  for (const [host, uzletag, felado, szolg, munka] of esetek) {
    const hely = HOSTOK[host];
    { // lista-ar -> exact; Meta ertek
      const { v, b } = await jelolt({}, { host, felado, szolgaltatas: szolg, munkatarsak: [munka], uj_vendeg: false });
      await nevtablaMent(v.db, { helyek: [{ placeId: hely.placeId, nev: felado }], munkatarsak: [], szolgaltatasok: [{ placeId: hely.placeId, serviceId: '77', nev: szolg }], arak: [{ placeId: hely.placeId, serviceId: '77', ar: 18900 }] }, T0);
      const r = await v.sd(b);
      assert.deepEqual([r.uzletag, r.ertek_minoseg, r.ertek_forras], [uzletag, 'exact', 'szolgaltatas_lista'], host);
      assert.ok(v.net.hivasok.filter((h) => h.kulcs === 'meta').every((h) => h.body.data[0].custom_data.value === 18900), host);
    }
    { // csere: a regi foglalas elo allapota (host-alapu ujraellenorzes) - az old_booking_still_active megszunik, ha a regi torolve lett
      const v = vilag(); await v.kesz;
      const regi = await regiFoglalas(v, { mod: { host, felado, szolgaltatas: szolg } });
      const u = ujUuid(); const b = level(u, { host, felado, szolgaltatas: szolg, megjegyzes: MEGJ_99 }); await lezar(v, b); v.t.set(SD_ELOTT);
      const r = await v.sd(b);
      assert.deepEqual([r.allapot, r.csere.old_booking_still_active], ['reschedule_confirmed', true], host);
      assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['old_booking_still_active'], host);
      v.net.allapot.set(regi, 'torolve');
      assert.deepEqual(await riasztasok(v, u), [], host + ': a regi torlese utan az elo ujraellenorzes megszunteti a riasztast');
      assert.equal(v.sql('SELECT regi_aktiv FROM foglalas_reschedule WHERE uuid = ?1', u)[0].regi_aktiv, 0);
    }
  }
});

test('S0-37 sd_feloldas uj_konverzio, de az elo allapot nem ellenorizheto: "tartva" + riasztas (nem veglegesitett, nem marad csendben), kesobb ujrafuttathato', async () => {
  const { v, u, b } = await csereVilag({ nincsRegi: true });
  assert.equal((await v.sd(b)).allapot, 'halasztva');
  v.net.allapot.set(u, 'hiba');
  const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi: uj vendeg' });
  assert.deepEqual([r.allapot, r.sd_allapot, r.riasztas, r.esemeny_kuldes.allapot], ['tartva', 'tartva', true, 'halasztva']); assert.equal(v.net.hivasok.length, 0);
  assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['elo_allapot_nem_ellenorizheto']);
  v.net.allapot.delete(u);
  const r2 = await v.sd(b);
  assert.deepEqual([r2.allapot, r2.ujrafuttatva], ['kesz', true]); assert.deepEqual(hivasNev(v), ['meta:PMU_Visszajaro', 'tiktok:PMU_Visszajaro']); assert.deepEqual(await riasztasok(v, u), []);
});

test('S0-38 a vegso parositas atmeneti hibaja (a motor TALALT jeloltet, de a kulcs birtokosanak elo allapota nem ellenorizheto): a motoros identity nyer, az sd NEM vesz at (varakozas); kesobb a motor kuld', async () => {
  const v = vilag(); await v.kesz;
  const UJ = '3f10fabc-4f7d-9257-2088-cfe7b5b24a2f', BID2 = 'mb_0aaaaaaaaaaaaaaaaaaaaaab';
  const level2 = (uuid, o = {}) => level(uuid, { host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció', uj_vendeg: true, munkatarsak: ['Teszt'], ...o });
  // A foglalas (FIX_UUID, BID) parosul es kimegy; majd lemondjak, a slotot ujra kiadjak: B foglalas (UJ, BID2) UGYANAZZAL a kulccsal
  await kulcsIras(v.db, { bookingId: BID, bookingUrl: HAIR_URL }, v.t());
  const a = await v.post(level2(FIX_UUID)); assert.deepEqual([a.allapot, a.kuldheto], ['parositott', true]);
  await kulcsIras(v.db, { bookingId: BID2, bookingUrl: HAIR_URL.replace(BID, BID2) }, v.t()); // utkozes: a birtokos tovabbra is A
  const b = level2(UJ);
  v.net.allapot.set(FIX_UUID, 'hiba'); // A elo allapota nem ellenorizheto -> a B parositasa "varakozas", 4 proba utan parositatlan
  const probak = await lezar(v, b);
  assert.equal(probak[3].allapot, 'parositatlan'); v.t.set(SD_ELOTT);
  const n = v.net.hivasok.length;
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.kuldes], ['varakozas', 0]); assert.match(r.miert, /motoros identity nyer/);
  assert.deepEqual([r.ok_kod, r.ujra_mp], ['varakozas_nem_ellenorizheto', SD_UJRA_MP], 'FO-3: a masik varakozas-ag is ujra_mp-t ad');
  assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', UJ)[0].sd_id, null, 'az sd nem vette at'); assert.equal(v.net.hivasok.length, n);
  assert.deepEqual((await riasztasok(v, UJ)).map((x) => x.tipus), ['sd_hianyzik'], 'a parositatlan sor lathato riasztas marad');
  v.net.allapot.set(FIX_UUID, 'torolve'); v.t.tick(700); // A lemondva: a kulcs felszabadul, B megkapja
  const r2 = await v.sd(b);
  assert.deepEqual([r2.allapot, r2.booking_id], ['motor_nyert', BID2]); assert.ok(v.net.hivasok.length > n);
  assert.ok(v.sql("SELECT esemeny_id FROM meres_kuldes WHERE source_id = ?1", BID2).every((x) => x.esemeny_id.endsWith(':' + BID2)));
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE source_id LIKE 'sd\\_%' ESCAPE '\\'")[0].n, 0, 'nem keletkezett sd identitas');
});

test('S0-39 a motor mar kuldott, de egy cella halasztva maradt (elo allapot nem ellenorizheto): az sd_atvetel idempotensen potolja a MOTOROS identitassal, es riasztja, ha meg mindig nem megy', async () => {
  const v = vilag(); await v.kesz;
  await kulcsIras(v.db, { bookingId: BID, bookingUrl: HAIR_URL }, v.t());
  const b = level(FIX_UUID, { host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció', uj_vendeg: true, munkatarsak: ['Teszt'] });
  v.net.allapot.set(FIX_UUID, ['aktiv', 'hiba']); // a parositas 1. lekeresere aktiv, a kuldes elotti elo ellenorzesre hiba -> a cellak halasztva
  const p = await v.post(b);
  assert.deepEqual([p.allapot, p.esemeny_kuldes.allapot], ['parositott', 'halasztva']); assert.equal(v.net.hivasok.length, 0);
  v.t.set(SD_ELOTT);
  v.net.allapot.set(FIX_UUID, 'hiba');
  const r1 = await v.sd(b);
  assert.deepEqual([r1.allapot, r1.riasztas, r1.esemeny_kuldes.allapot], ['motor_kuldte', true, 'halasztva']); assert.equal(v.net.hivasok.length, 0);
  assert.deepEqual([r1.ok_kod, r1.ujra_mp], ['halasztva_elo_allapot', 180], 'FO-3: a halasztott cella ujra_mp-t kap (az elosztas ujraprobal_mp-je)'); assert.ok(r1.ujra_ig_mp > 0);
  v.net.allapot.delete(FIX_UUID);
  const r2 = await v.sd(b);
  assert.deepEqual([r2.allapot, r2.esemeny_kuldes.allapot], ['motor_kuldte', 'kesz']); assert.ok(v.net.hivasok.length >= 4);
  assert.ok(v.sql('SELECT esemeny_id FROM meres_kuldes').every((x) => x.esemeny_id.endsWith(':' + BID)));
  const n = v.net.hivasok.length; assert.equal((await v.sd(b)).allapot, 'motor_kuldte'); assert.equal(v.net.hivasok.length, n, 'ujabb hivas: 0 extra kuldes');
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// 2. FUGGETLEN KODATTEKINTES (FAIL) javitasai - mindegyik az ellenpeldabol keszult regresszios teszt
const T60 = T0 + 60 * 3600 * 1000; // a letrehozo level utan 60 orara (> 48 ora)
/** D1-kesleltetes emulacio: minden lekerdezes a makro-feladat sorba lep (valodi D1-ben az egyideju hivasok igy fonodnak ossze). */
function kesleltet(v, maxMs = 3) {
  const orig = v.e.KULCS_DB;
  const wrap = (st) => { const w = (fn) => async (...a) => { await new Promise((r) => setTimeout(r, Math.random() * maxMs)); return fn(...a); }; return { run: w(st.run), first: w(st.first), all: w(st.all) }; };
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); return { ...wrap(p), bind: (...args) => wrap(p.bind(...args)) }; }, batch: orig.batch };
}

test('S0-40 a 48 oras kapu az UJRAFUTTATASI agakon is zar: tartva / hianyzo_mezo-potlas / elakadt atveve 48 ora utan nem kuld; a kesz sor sem kuld ujra', async () => {
  { // tartva (az elo allapot nem ellenorizheto) ~22 percnel, ujrajatszas 60 oras korban
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    v.net.allapot.set(u, 'hiba');
    assert.equal((await v.sd(b)).allapot, 'tartva'); assert.equal(v.net.hivasok.length, 0);
    v.net.allapot.delete(u); v.t.set(T60);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.riasztas], ['lejart', true]); assert.equal(v.net.hivasok.length, 0, 'tartva 48 ora utan: 0 kuldes');
    assert.equal(v.sql('SELECT sd_allapot FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_allapot, 'lejart');
    assert.ok((await riasztasok(v, u)).some((x) => x.tipus === 'lejart_48_ora'));
  }
  { // hianyzo_mezo HOLD, a Zap-leképezést később javítják, a hívást 60 óra múlva játsszák vissza
    const { v, b } = await jelolt({}, { uj_vendeg: true });
    const hianyos = { ...b }; delete hianyos.megjegyzes;
    assert.equal((await v.sd(hianyos)).sd_allapot, 'halasztva');
    v.t.set(T60);
    const r = await v.sd(b);
    assert.equal(r.allapot, 'lejart'); assert.equal(v.net.hivasok.length, 0, 'hianyzo_mezo-potlas 48 ora utan: 0 kuldes');
  }
  { // elakadt atveve (nincs cella) - ujrapróbalas 60 oras korban
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    await v.sd(b); v.D.db.prepare('DELETE FROM meres_kuldes').run(); v.net.hivasok.length = 0;
    v.D.db.prepare("UPDATE foglalas_egyeztetes SET sd_allapot = 'atveve', sd_ido = ?2 WHERE uuid = ?1").run(u, Math.floor(SD_ELOTT / 1000));
    v.t.set(T60);
    const r = await v.sd(b);
    assert.equal(r.allapot, 'lejart'); assert.equal(v.net.hivasok.length, 0, 'elakadt atveve 48 ora utan: 0 kuldes');
  }
  { // a kesz sor 48 ora utan sem kuld ujra, es nem valtozik 'lejart'-ra; egy hibas cellat sem probal ujra
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    assert.equal((await v.sd(b)).allapot, 'kesz'); const n = v.net.hivasok.length; assert.ok(n >= 4);
    v.D.db.prepare("UPDATE meres_kuldes SET allapot = 'hiba' WHERE platform = 'meta'").run();
    v.t.set(T60);
    const r = await v.sd(b);
    assert.equal(r.allapot, 'kesz'); assert.equal(v.net.hivasok.length, n, 'kesz sor 48 ora utan: 0 extra kuldes');
    assert.equal(v.sql('SELECT sd_allapot FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_allapot, 'kesz');
  }
  { // kontroll: a friss hivas 60 oras korban lejart (a regi viselkedes valtozatlan); az ember dontese (sd_feloldas) nem a 48 oras kapu tarya
    const { v, b } = await jelolt({}, { uj_vendeg: true });
    v.t.set(T60); assert.equal((await v.sd(b)).allapot, 'lejart'); assert.equal(v.net.hivasok.length, 0);
  }
});

test('S0-41 parhuzamos ujrafuttatas: a cellakuldes es az elakadt atveve ujravetele atomi (CAS) - 0 dupla kuldes D1-kesleltetessel', async () => {
  const PROBA = 8;
  for (let i = 0; i < PROBA; i++) { // tartva sor, ket egyideju ujrafuttatas
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    v.net.allapot.set(u, 'hiba'); assert.equal((await v.sd(b)).allapot, 'tartva'); v.net.allapot.delete(u);
    kesleltet(v);
    await Promise.all([v.sd(b), v.sd(b)]);
    assert.equal(v.net.hivasok.length, 4, 'tartva, 2 egyideju ujrafuttatas: pontosan 4 platformhivas (' + i + '. proba)');
  }
  for (let i = 0; i < PROBA; i++) { // elakadt atveve felig kesz cellakkal (folyamatban, 120 s-nal regebbi), ket egyideju ujrapróbalas
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    await v.sd(b); v.net.hivasok.length = 0;
    v.D.db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', frissitve = ?1").run(Math.floor(SD_ELOTT / 1000) - 3600);
    v.D.db.prepare("UPDATE foglalas_egyeztetes SET sd_allapot = 'atveve', sd_ido = ?2 WHERE uuid = ?1").run(u, Math.floor(SD_ELOTT / 1000) - 3600);
    kesleltet(v);
    await Promise.all([v.sd(b), v.sd(b)]);
    assert.equal(v.net.hivasok.length, 4, 'elakadt atveve, 2 egyideju ujrapróbalas: pontosan 4 platformhivas (' + i + '. proba)');
  }
  for (let i = 0; i < PROBA; i++) { // ket egyideju sd_feloldas uj_konverzio
    const { v, b } = await jelolt({}, { megjegyzes: 'A korabbi 16 oras foglalas helyett', uj_vendeg: false });
    assert.equal((await v.sd(b)).sd_allapot, 'halasztva');
    kesleltet(v);
    const f = { ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'ember' };
    await Promise.all([v.post(f), v.post(f)]);
    assert.equal(v.net.hivasok.length, 2, 'sd_feloldas, 2 egyideju hivas: az esemenyek pontosan egyszer mennek ki (' + i + '. proba)');
  }
  { // az elakadt atveve atomi ujravetele: a masodik hivas az elsot latja (sd_ido frissult), nem dolgozik parhuzamosan
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    await v.sd(b); v.D.db.prepare('DELETE FROM meres_kuldes').run(); v.net.hivasok.length = 0;
    v.D.db.prepare("UPDATE foglalas_egyeztetes SET sd_allapot = 'atveve', sd_ido = ?2 WHERE uuid = ?1").run(u, Math.floor(SD_ELOTT / 1000) - 3600);
    const el = v.sql('SELECT sd_ido FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_ido;
    const r = await v.sd(b);
    assert.equal(r.allapot, 'kesz'); assert.ok(v.sql('SELECT sd_ido FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_ido > el, 'az ujravetel frissiti az sd_ido-t');
  }
});

test('S0-42 a ket titok EGYUTT kell: GUEST_HMAC_KEY_V1 (vagy SD_HMAC_KEY_V1) nelkul az sd inert - 0 atvetel, 0 kuldes, nincs sd sor', async () => {
  for (const [hianyzo, miert] of [['GUEST_HMAC_KEY_V1', /GUEST_HMAC_KEY_V1/], ['SD_HMAC_KEY_V1', /SD_HMAC_KEY_V1/]]) {
    const { v, u, b } = await jelolt({ env: { [hianyzo]: undefined } }, { uj_vendeg: true });
    const r = await v.sd(b);
    assert.equal(r.allapot, 'ki'); assert.match(r.miert, miert);
    assert.equal(v.net.hivasok.length, 0); assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_id, null, 'nincs atvetel');
    assert.equal(szamol(v, 'meres_kuldes'), 0);
  }
  { // kontroll: mindket titokkal kuld
    const { v, b } = await jelolt({}, { uj_vendeg: true });
    assert.equal((await v.sd(b)).allapot, 'kesz'); assert.equal(v.net.hivasok.length, 4);
  }
});

test('S0-43 hosszu megjegyzes: a csere-gyanu a TELJES szovegen fut (a 500. karakter utan sem vesz el); a tulhosszu megjegyzes HOLD; tagabb csere-kifejezesek', async () => {
  const hosszu = 'Kedves Mosaic! '.repeat(40) + 'A korabbi 16 oras foglalas helyett kerek ujat.'; // ~650 karakter, a gyanu a vegen
  assert.ok(hosszu.length > 500 && hosszu.length < 4000);
  { const { v, b } = await jelolt({}, { megjegyzes: hosszu, uj_vendeg: true }); const r = await v.sd(b); assert.equal(r.sd_allapot, 'halasztva'); assert.equal(v.net.hivasok.length, 0, 'a 500. karakter utani "helyett" is HOLD'); }
  { const tul = 'x'.repeat(4001); const { v, b } = await jelolt({}, { megjegyzes: tul, uj_vendeg: true }); const r = await v.sd(b); assert.equal(r.sd_allapot, 'halasztva'); assert.match(r.csere.ok, /tul hosszu/); assert.equal(v.net.hivasok.length, 0); }
  { const { v, b } = await jelolt({}, { megjegyzes: 'Kerem a csendes sarkot, koszonom ' + 'a'.repeat(900), uj_vendeg: true }); assert.equal((await v.sd(b)).allapot, 'kesz', 'hosszu, de csere-gyanu nelkuli megjegyzes: normal sd ut'); }
  for (const m of ['korabban volt 15:00, de 17:00 jobb', 'Korábban foglaltam, de változott', 'Áthelyeztem az időpontomat', 'Az előző foglalásom helyett', 'Rescheduled from earlier', 'Tegnapi foglalásomat töröljék', 'Mégsem a szerdai, hanem a keddi']) assert.ok(csereGyanu(m), m);
  for (const m of ['Kerem a csendes sarkot', 'Szeretnék egy későbbi időpontot', 'Már foglaltam 16 órára', 'Kérek törölközőt', 'Saját törölközőt hozok', 'Megsemmisült a kuponom?']) assert.ok(!csereGyanu(m), m);
});

test('S0-44 a csere-feloldas KIZAROLAG az sd_feloldas muveletbol johet: egy sd_atvetel torzsebe csempeszett `feloldas` objektum eldobodik', async () => {
  const { v, b } = await jelolt({}, { megjegyzes: 'A korabbi 16 oras foglalas helyett', uj_vendeg: false });
  assert.equal((await v.sd(b)).sd_allapot, 'halasztva');
  const r = await v.sd({ ...b, feloldas: { dontes: 'uj_konverzio', ok: 'csempeszett' } });
  assert.equal(r.sd_allapot, 'halasztva'); assert.equal(v.net.hivasok.length, 0, 'a torzsbe csempeszett feloldas nem hajtodik vegre');
  const f = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'ember dontott' });
  assert.equal(f.sd_allapot, 'feloldva_uj'); assert.equal(v.net.hivasok.length, 2, 'az igazi sd_feloldas (ember) tovabbra is mukodik');
});

// 3. kodattekintes (PASS, nem blokkolo megallapitasok keményitese)
test('S0-45 a motor mar kuldott, de 48 ora utan a halasztott cellara az sd SEM kuld utolag; a szaraz terv az ujrafuttatasi agon is a 48 oras kapu szerint mond lejartat', async () => {
  { // motor_kuldte + halasztva cella; az sd_atvetel 60 oras korban: 0 kuldes (48 oran belul potolna - S0-39)
    const v = vilag(); await v.kesz;
    await kulcsIras(v.db, { bookingId: BID, bookingUrl: HAIR_URL }, v.t());
    const b = level(FIX_UUID, { host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció', uj_vendeg: true, munkatarsak: ['Teszt'] });
    v.net.allapot.set(FIX_UUID, ['aktiv', 'hiba']);
    const p = await v.post(b); assert.deepEqual([p.allapot, p.esemeny_kuldes.allapot], ['parositott', 'halasztva']); assert.equal(v.net.hivasok.length, 0);
    v.t.set(T60); v.net.allapot.delete(FIX_UUID);
    const r = await v.sd(b);
    assert.equal(r.allapot, 'motor_kuldte'); assert.match(r.miert, /48 oranal regebbi/); assert.equal(v.net.hivasok.length, 0, '48 ora utan nincs utolagos kuldes a motoros identitassal sem');
  }
  { // szaraz terv: tartva sor 60 oras korban -> a terv lejart (ugyanaz, mint a valodi hivas), es nem ir
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    v.net.allapot.set(u, 'hiba'); assert.equal((await v.sd(b)).allapot, 'tartva'); v.net.allapot.delete(u);
    v.t.set(T60);
    const elotte = dump(v, ['foglalas_egyeztetes', 'meres_kuldes']);
    const terv = await v.sd({ ...b, szaraz: true });
    assert.equal(terv.allapot, 'szaraz_terv'); assert.equal(terv.terv.lenne, 'lejart'); assert.equal(dump(v, ['foglalas_egyeztetes', 'meres_kuldes']), elotte, 'a szaraz terv nem ir');
    assert.equal((await v.sd(b)).allapot, 'lejart');
  }
});

test('S0-46 ha egy parhuzamos hivas mar dolgozik a cellakon (cella-CAS vesztes), a vesztes NEM ir hamis "kesz" sor-allapotot', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true });
  v.net.allapot.set(u, 'hiba'); assert.equal((await v.sd(b)).allapot, 'tartva'); v.net.allapot.delete(u);
  // a nyertes hivas lefoglalta a cellakat (friss "folyamatban"), de meg nem fejezte be
  v.D.db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', frissitve = ?1").run(Math.floor(v.t() / 1000));
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.idempotens], ['tartva', true]); assert.equal(v.net.hivasok.length, 0);
  assert.equal(v.sql('SELECT sd_allapot FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_allapot, 'tartva', 'a sor allapota valtozatlan (a nyertes dolga)');
  // ha a nyertes meghal (a cellak 120 s utan elakadtnak szamitanak), az ujrafuttatas rendben lezarja
  v.t.tick(200);
  const r2 = await v.sd(b); assert.equal(r2.allapot, 'kesz'); assert.equal(v.net.hivasok.length, 4);
});

// 4. kodattekintes (PASS, nem blokkolo megallapitasok): a vegallapot a DB cellaallapotaibol, atomi feltetellel
test('S0-47 egyideju ujrafuttatas vegyes elo-ellenorzessel (egyik hiba, masik aktiv): a sor SOHA nem "kesz", amig van halasztva / folyamatban cella; vegul pontosan 4 kuldes', async () => {
  for (let i = 0; i < 10; i++) {
    const { v, u, b } = await jelolt({}, { uj_vendeg: true });
    v.net.allapot.set(u, 'hiba'); assert.equal((await v.sd(b)).allapot, 'tartva');
    v.net.allapot.set(u, ['hiba', 'aktiv']); // az 1. elo-ellenorzes hiba (a cellak halasztva), a tobbi aktiv
    kesleltet(v);
    await Promise.all([v.sd(b), v.sd(b)]);
    const allapot = () => v.sql('SELECT sd_allapot FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_allapot;
    const fuggo = () => v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot IN ('halasztva', 'folyamatban')")[0].n;
    if (allapot() === 'kesz') assert.equal(fuggo(), 0, 'kesz sor mellett nincs fuggo cella (' + i + '. proba)');
    assert.ok(v.net.hivasok.length <= 4, 'nincs dupla kuldes');
    v.net.allapot.delete(u); v.t.tick(200); // a nyertes meghalt / befejezte: az ujrafuttatas lezar
    await v.sd(b);
    assert.equal(allapot(), 'kesz'); assert.equal(fuggo(), 0); assert.equal(v.net.hivasok.length, 4, 'vegul pontosan 4 platformhivas (' + i + '. proba)');
  }
});

test('S0-48 hianyzo_mezo potlas + egy masik hivas friss "folyamatban" cellai: a sor nem ragad be (halasztva + potolva = ujrafuttathato), 200 s mulva lezar', async () => {
  const { v, u, b } = await jelolt({}, { uj_vendeg: true });
  const hianyos = { ...b }; delete hianyos.megjegyzes;
  assert.equal((await v.sd(hianyos)).sd_allapot, 'halasztva');
  v.D.db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', frissitve = ?1").run(Math.floor(v.t() / 1000)); // egy masik hivas lefoglalta a cellakat (majd meghal)
  const r1 = await v.sd(b); // a Zap mostantol kuldi a megjegyzes kulcsot
  assert.equal(r1.sd_allapot, 'halasztva'); assert.equal(v.net.hivasok.length, 0);
  assert.equal(v.sql('SELECT allapot FROM foglalas_reschedule WHERE uuid = ?1', u)[0].allapot, 'hianyzo_mezo_potolva');
  v.t.tick(200); // a cellak elakadtnak szamitanak
  const r2 = await v.sd(b);
  assert.equal(r2.allapot, 'kesz'); assert.equal(v.net.hivasok.length, 4);
  assert.ok(!(await riasztasok(v, u)).some((x) => x.tipus === 'hianyzo_mezo'));
});

test('S0-49 a szaraz terv az ujrafuttatasi agon a valodi sorrendet koveti: kesz > 48 ora = idempotens, friss atveve = idempotens, egyebkent lejart / ujrafuttatas', async () => {
  { const { v, b } = await jelolt({}, { uj_vendeg: true }); assert.equal((await v.sd(b)).allapot, 'kesz'); const n = v.net.hivasok.length; v.t.set(T60);
    const terv = await v.sd({ ...b, szaraz: true }); assert.ok(terv.terv.kesz, 'kesz sor 48 ora utan: idempotens terv'); assert.ok(!terv.terv.lenne);
    assert.equal((await v.sd(b)).allapot, 'kesz'); assert.equal(v.net.hivasok.length, n); }
  { const { v, u, b } = await jelolt({}, { uj_vendeg: true }); await v.sd(b);
    v.D.db.prepare("UPDATE foglalas_egyeztetes SET sd_allapot = 'atveve', sd_ido = ?2 WHERE uuid = ?1").run(u, Math.floor(v.t() / 1000) - 10);
    const terv = await v.sd({ ...b, szaraz: true }); assert.ok(terv.terv.atveve, 'friss atveve: idempotens terv');
    const val = await v.sd(b); assert.equal(val.allapot, 'atveve'); assert.equal(val.idempotens, true); }
});

test('S0-50 sd_feloldas, de egy masik hivas friss "folyamatban" cellai: a sor halasztva marad (nincs hamis feloldva_uj), 200 s mulva a feloldas lefut', async () => {
  const { v, u, b } = await jelolt({}, { megjegyzes: 'A korabbi 16 oras foglalas helyett', uj_vendeg: false });
  assert.equal((await v.sd(b)).sd_allapot, 'halasztva');
  v.D.db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', frissitve = ?1").run(Math.floor(v.t() / 1000));
  const f = { ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'ember' };
  const r = await v.post(f);
  assert.equal(r.sd_allapot, 'halasztva'); assert.equal(v.net.hivasok.length, 0);
  assert.equal(v.sql('SELECT sd_allapot FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_allapot, 'halasztva');
  v.t.tick(200);
  const r2 = await v.post(f);
  assert.equal(r2.sd_allapot, 'feloldva_uj'); assert.equal(v.net.hivasok.length, 2);
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// 5. kodattekintes (PASS) KISEBB megallapitasainak pre-T2 keményitese (DECISION #142/2): 1 tartva-iras atomi, 3 QA-cimke, 4 feloldas-irasi sorrend, 5 csere-regex alakok
/** A "cella-allapot osszeg" SELECT UTAN lefuttat egy mutaciot: egy parhuzamos hivas kozben atallitotta a cellakat (az elso ilyen SELECT utan egyszer). */
function versenyUtanSelect(v, mutacio) {
  const orig = v.e.KULCS_DB; let n = 0;
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); if (!sql.includes("SUM(allapot = 'folyamatban')")) return p; return { ...p, bind: (...a) => { const b = p.bind(...a); return { ...b, first: async () => { const r = await b.first(); if (!n++) mutacio(); return r; } }; } }; }, batch: orig.batch };
  return () => n;
}
/** Worker-halal szimulacio: a minta szerinti SQL `run()`-ja kivetelt dob, amig a kapcsolo be van kapcsolva. */
function halalSql(v, minta) {
  const orig = v.e.KULCS_DB; const allapot = { be: true, talalt: 0 };
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); if (!minta.test(sql)) return p; return { ...p, bind: (...a) => { const b = p.bind(...a); return { ...b, run: async () => { if (allapot.be) { allapot.talalt++; throw new Error('Worker halal (szimulalt)'); } return b.run(); } }; } }; }, batch: orig.batch };
  return allapot;
}
const sdSor = (v, u) => v.sql('SELECT sd_allapot, riasztas FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0];
const csereSor = (v, u) => v.sql('SELECT allapot FROM foglalas_reschedule WHERE uuid = ?1', u)[0];
const auditTeljes = (v, u) => v.sql('SELECT * FROM foglalas_reschedule WHERE uuid = ?1', u)[0];

test('S0-51 csere-regex: "torlest kerem" / "torlom az elozot" / "megse jo" alakok is HOLD (a tobbi hamis pozitiv nem); a regex nyitott veguek - a korlat dokumentalt', async () => {
  for (const m of ['Törlést kérem', 'Kérem a törlést', 'Törlöm az előzőt', 'Törlök egyet', 'Mégse jó', 'mégse jó az idő', 'Mégsem jó']) assert.ok(csereGyanu(m), m);
  for (const m of ['Törlőkendőt kérek', 'A törlőkendő legyen puha', 'Kérek törölközőt', 'Saját törölközőt hozok', 'Megsemmisült a kuponom?']) assert.ok(!csereGyanu(m), m);
  for (const megj of ['Törlést kérem', 'Törlöm az előzőt', 'Mégse jó']) {
    const { v, b } = await jelolt({}, { megjegyzes: megj, uj_vendeg: true });
    const r = await v.sd(b); assert.equal(r.sd_allapot, 'halasztva', megj); assert.equal(v.net.hivasok.length, 0, 'HOLD: ' + megj);
  }
  { const { v, b } = await jelolt({}, { megjegyzes: 'Törlőkendőt kérek', uj_vendeg: true }); assert.equal((await v.sd(b)).allapot, 'kesz'); assert.equal(v.net.hivasok.length, 4); }
});

test('S0-52 a "tartva" iras is atomi: ha a SELECT utan egy parhuzamos hivas lezarta a cellakat, a lezart allapotot nem irja felul hamis tartva + riasztas; ha egy masik hivas dolgozni kezd, a sor nem irodik', async () => {
  { // a cellak a SELECT es az iras kozott lezarulnak -> a vegso allapot feloldva_uj (nem tartva), riasztas nelkul
    const { v, u, b } = await csereVilag({ nincsRegi: true });
    assert.equal((await v.sd(b)).allapot, 'halasztva'); v.net.allapot.set(u, 'hiba');
    const n = versenyUtanSelect(v, () => v.D.db.prepare("UPDATE meres_kuldes SET allapot = 'kesz' WHERE allapot = 'halasztva'").run());
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi: uj vendeg' });
    assert.ok(n() >= 1, 'a verseny-injektalas lefutott');
    assert.deepEqual([r.sd_allapot, r.riasztas], ['feloldva_uj', false]);
    assert.deepEqual([sdSor(v, u).sd_allapot, sdSor(v, u).riasztas], ['feloldva_uj', 0]);
    assert.deepEqual(await riasztasok(v, u), [], 'nincs hamis riasztas');
  }
  { // egy masik hivas a SELECT utan "folyamatban"-ra allitja a cellak egy reszet (a tobbi halasztva marad) -> nem irunk tartva-t, a valasz idempotens, a riasztas-jelzo valtozatlan
    const { v, u, b } = await csereVilag({ nincsRegi: true });
    assert.equal((await v.sd(b)).allapot, 'halasztva'); v.net.allapot.set(u, 'hiba');
    versenyUtanSelect(v, () => v.D.db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', frissitve = ?1 WHERE allapot = 'halasztva' AND platform = 'meta'").run(Math.floor(v.t() / 1000))); // vegyes: a tobbi platform cellaja halasztva marad
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi: uj vendeg' });
    assert.equal(r.idempotens, true); assert.equal(r.riasztas, true, 'a skip-valasz a sor valos riasztas-jelzojet adja'); assert.equal(r.sd_allapot, 'halasztva');
    assert.deepEqual([sdSor(v, u).sd_allapot, sdSor(v, u).riasztas], ['halasztva', 1], 'a sort nem irtuk');
  }
});

test('S0-53 QA-riport es riasztas-tipus: hianyzo_mezo_potolva + halasztva = atvetel_megszakadt (nem reschedule_suspected_hold); hianyzo_mezo es valodi csere-gyanu cimkeje valtozatlan', async () => {
  const { egyeztetoSorok } = await import('../netlify/lib/meres/egyeztetes-sor.js');
  const riport = async (v, u) => { const tol = Math.floor(T0 / 1000) - 4 * 86400, ig = Math.floor(T0 / 1000) + 2 * 86400; const r = await egyeztetoSorok(v.db, { tol, ig }); assert.equal(r.ok, true); return r.sorok.find((s) => s.salonic_uuid === u); };
  { // (a) hianyzo_mezo (a kulcs nem jott): hianyzo_mezo_hold + hianyzo_mezo riasztas
    const { v, u, b } = await jelolt({}, { uj_vendeg: true }); const { megjegyzes, ...nelkule } = b; await v.sd(nelkule);
    const s = await riport(v, u); assert.deepEqual([s.qa_kategoria, s.jelzesek.includes('hianyzo_mezo_hold'), s.jelzesek.includes('reschedule_suspected_hold')], ['hianyzo_mezo_hold', true, false]);
    assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['hianyzo_mezo']);
  }
  { // (b) a kulcs megjott, de a lezaras kihagyva maradt (masik hivas cellai): hianyzo_mezo_potolva + halasztva -> atvetel_megszakadt
    const { v, u, b } = await jelolt({}, { uj_vendeg: true }); const { megjegyzes, ...nelkule } = b; await v.sd(nelkule);
    v.D.db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', frissitve = ?1").run(Math.floor(v.t() / 1000));
    assert.equal((await v.sd(b)).sd_allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'hianyzo_mezo_potolva');
    const s = await riport(v, u);
    assert.deepEqual([s.sd_allapot, s.qa_kategoria, s.jelzesek.includes('atvetel_megszakadt'), s.jelzesek.includes('reschedule_suspected_hold'), s.jelzesek.includes('hianyzo_mezo_hold')], ['halasztva', 'atvetel_megszakadt', true, false, false]);
    assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['atvetel_megszakadt']);
  }
  { // (c) valodi csere-gyanu: reschedule_suspected_hold + reschedule_suspected
    const { v, u, b } = await jelolt({}, { megjegyzes: 'A korabbi 16 oras foglalas helyett', uj_vendeg: false }); await v.sd(b);
    const s = await riport(v, u); assert.deepEqual([s.qa_kategoria, s.jelzesek.includes('reschedule_suspected_hold')], ['reschedule_suspected_hold', true]);
    assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['reschedule_suspected']);
  }
});

test('S0-54 a feloldas irasi sorrendje: audit-sor ELOBB, allapot UTANA - Worker-halalnal a sor halasztva marad (nem lesz vegleges allapot elavult audit-sorral), a feloldas ujrafuttathato', async () => {
  for (const dontes of ['confirmed', 'uj_konverzio']) {
    const { v, u, b } = await jelolt({}, { megjegyzes: 'A korabbi 16 oras foglalas helyett', uj_vendeg: false });
    assert.equal((await v.sd(b)).sd_allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'suspected');
    const halal = halalSql(v, /^UPDATE foglalas_egyeztetes SET sd_allapot/); // a sor-allapot iras meghal
    const f = { ...b, muvelet: 'sd_feloldas', dontes, ok: 'emberi dontes' };
    await v.post(f).catch(() => null); // a vegpont a kivetelt hibavalaszba csomagolhatja: a mellekhatas szamit
    assert.ok(halal.talalt >= 1);
    const jel = dontes === 'confirmed' ? 'feloldva_confirmed' : 'feloldva_uj';
    assert.equal(csereSor(v, u).allapot, jel, 'az audit-sor mar a dontest tartalmazza');
    assert.equal(sdSor(v, u).sd_allapot, 'halasztva', 'a sor nem lett vegleges: a feloldas ujrafuttathato');
    assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['atvetel_megszakadt'], 'a felbemaradt feloldas nem uj csere-gyanukent latszik');
    halal.be = false;
    const r2 = await v.post(f);
    assert.equal(r2.sd_allapot, jel); assert.deepEqual([sdSor(v, u).sd_allapot, sdSor(v, u).riasztas], [jel, 0]); assert.equal(csereSor(v, u).allapot, jel);
    assert.deepEqual(await riasztasok(v, u), []);
    assert.equal(v.net.hivasok.length, dontes === 'confirmed' ? 0 : 2, 'a cellak egyszer mennek ki (idempotens ujrafuttatas)');
  }
  { // az audit-sor irasa hal meg: a sor es az audit valtozatlan, az ujrafuttatas lefut
    const { v, u, b } = await jelolt({}, { megjegyzes: 'A korabbi 16 oras foglalas helyett', uj_vendeg: false }); await v.sd(b);
    const halal = halalSql(v, /^INSERT INTO foglalas_reschedule/); const f = { ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'emberi dontes' };
    await v.post(f).catch(() => null); assert.ok(halal.talalt >= 1, 'a szimulalt halal lefutott');
    assert.deepEqual([sdSor(v, u).sd_allapot, csereSor(v, u).allapot], ['halasztva', 'suspected']);
    halal.be = false; assert.equal((await v.post(f)).sd_allapot, 'feloldva_confirmed'); assert.equal(csereSor(v, u).allapot, 'feloldva_confirmed');
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// DECISION #144 mini pre-T2 kor: a `confirmed` audit-sor + felbemaradt lezaras (4.), valamint a korabbi KICSI tesztlyukak potlasa (1-3.)
/** Az sd sor QA-riport sora (egyeztetes-sor.js) az UUID alapjan. */
async function sdRiportSor(v, u) {
  const { egyeztetoSorok } = await import('../netlify/lib/meres/egyeztetes-sor.js');
  const tol = Math.floor(T0 / 1000) - 4 * 86400, ig = Math.floor(T0 / 1000) + 2 * 86400;
  const r = await egyeztetoSorok(v.db, { tol, ig }); assert.equal(r.ok, true);
  return r.sorok.find((s) => s.salonic_uuid === u);
}

test('S0-55 tesztlyukak potlasa: feloldva_* + felbemaradt lezaras QA-cimkeje, a tartva sor riasztas DB-jelzoje (?riasztas=1), a "Torles..." regex-alakok', async () => {
  for (const dontes of ['confirmed', 'uj_konverzio']) { // a felbemaradt feloldas (audit-sor megvan, a sor-allapot nem) a QA-riportban atvetel_megszakadt
    const { v, u, b } = await jelolt({}, { megjegyzes: 'A korabbi 16 oras foglalas helyett', uj_vendeg: false });
    await v.sd(b); const halal = halalSql(v, /^UPDATE foglalas_egyeztetes SET sd_allapot/);
    await v.post({ ...b, muvelet: 'sd_feloldas', dontes, ok: 'emberi dontes' }).catch(() => null); assert.ok(halal.talalt >= 1);
    const jel = dontes === 'confirmed' ? 'feloldva_confirmed' : 'feloldva_uj'; assert.equal(csereSor(v, u).allapot, jel);
    const s = await sdRiportSor(v, u);
    assert.deepEqual([s.sd_allapot, s.qa_kategoria, s.jelzesek.includes('atvetel_megszakadt'), s.jelzesek.includes('reschedule_suspected_hold')], ['halasztva', 'atvetel_megszakadt', true, false], dontes);
  }
  { // a sikeres feltetelezett tartva-iras a riasztas DB-oszlopot is 1-re allitja: a meglevo ?riasztas=1 oldal listazza a sort
    const { v, u, b } = await csereVilag({ nincsRegi: true });
    assert.equal((await v.sd(b)).allapot, 'halasztva'); v.net.allapot.set(u, 'hiba');
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi: uj vendeg' });
    assert.deepEqual([r.sd_allapot, r.riasztas], ['tartva', true]);
    assert.deepEqual([sdSor(v, u).sd_allapot, sdSor(v, u).riasztas], ['tartva', 1], 'a tartva sor riasztas-jelzoje a DB-ben 1');
    assert.ok(((await v.get('riasztas=1')).lista || []).some((x) => x.uuid === u), 'a ?riasztas=1 oldal listazza a tartva sort');
  }
  for (const m of ['Törlés', 'Törlést kérek', 'A törlése miatt írok', 'Törlések', 'törlöm', 'törlök']) assert.ok(csereGyanu(m), m);
});

test('S0-56 `confirmed` audit-sor + felbemaradt lezaras (hianyzo_mezo potlas, Worker-halal az allapot-irasnal): atvetel_megszakadt cimke es riasztas (nem reschedule_suspected), 0 kuldes, a feloldas lezarja', async () => {
  const { v, u, b } = await csereVilag(); // a regi foglalas indexelve, MEGJ_99 -> confirmed
  const { megjegyzes, ...nelkule } = b;
  assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'hianyzo_mezo');
  const halal = halalSql(v, /^UPDATE foglalas_egyeztetes SET sd_allapot/); // a pot-futas a sor-allapot irasnal meghal
  await v.sd(b).catch(() => null); assert.ok(halal.talalt >= 1, 'a szimulalt halal lefutott');
  assert.equal(csereSor(v, u).allapot, 'confirmed', 'a dontes (confirmed) mar rogzitett'); assert.equal(sdSor(v, u).sd_allapot, 'halasztva'); assert.equal(v.net.hivasok.length, 0, '0 kuldes');
  const s = await sdRiportSor(v, u);
  assert.deepEqual([s.qa_kategoria, s.jelzesek.includes('atvetel_megszakadt'), s.jelzesek.includes('reschedule_suspected_hold')], ['atvetel_megszakadt', true, false]);
  assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['atvetel_megszakadt']);
  halal.be = false;
  const f = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'emberi dontes' }); // az emberi feloldas lezarja
  assert.equal(f.sd_allapot, 'feloldva_confirmed'); assert.equal(v.net.hivasok.length, 0); assert.deepEqual(await riasztasok(v, u), []);
  { // kontroll: a valodi csere-gyanu (suspected audit-sor) marad reschedule_suspected_hold / reschedule_suspected
    const w = await csereVilag({ nincsRegi: true }); await w.v.sd(w.b);
    const t = await sdRiportSor(w.v, w.u); assert.deepEqual([t.qa_kategoria, csereSor(w.v, w.u).allapot], ['reschedule_suspected_hold', 'suspected']);
    assert.deepEqual((await riasztasok(w.v, w.u)).map((x) => x.tipus), ['reschedule_suspected']);
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// DECISION #145/3 mini-2 kor: sd_feloldas fail-closed, a csere-regex minden alternativajanak tablazatos tesztje, QA-5 riport jelzesek
test('S0-57 `uj_konverzio` fail-closed: a felbemaradt `confirmed` sor (cellak `kihagyva`, egy sem kiment) 0 kuldessel NEM allithato feloldva_uj-ra; a sor es az audit valtozatlan; a `confirmed` feloldas lezar; mar kiment cellaval a felbemaradt uj_konverzio lezarhato', async () => {
  const { v, u, b } = await csereVilag(); // a regi foglalas indexelve, MEGJ_99 -> confirmed
  const { megjegyzes, ...nelkule } = b;
  assert.equal((await v.sd(nelkule)).allapot, 'halasztva');
  const halal = halalSql(v, /^UPDATE foglalas_egyeztetes SET sd_allapot/); // a hianyzo_mezo-potlas a sor-allapot irasnal meghal (S0-56 helyzet)
  await v.sd(b).catch(() => null); assert.ok(halal.talalt >= 1); halal.be = false;
  assert.deepEqual([sdSor(v, u).sd_allapot, csereSor(v, u).allapot, v.net.hivasok.length], ['halasztva', 'confirmed', 0]);
  assert.ok(v.sql("SELECT allapot FROM meres_kuldes").every((c) => c.allapot === 'kihagyva'), 'a cellak mar `kihagyva (reschedule_confirmed)`');
  const rossz = { ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz emberi dontes' };
  for (let i = 0; i < 2; i++) { // ismetelve is: ugyanaz, semmi nem valtozik
    const r = await v.post(rossz);
    assert.deepEqual([r.allapot, r.sd_allapot, r.kuldes, r.riasztas], ['feloldas_nem_lehetseges', 'halasztva', 0, true]); assert.match(r.miert, /a helyes feloldas a `confirmed`$/);
    assert.deepEqual([sdSor(v, u).sd_allapot, sdSor(v, u).riasztas, csereSor(v, u).allapot, v.net.hivasok.length], ['halasztva', 1, 'confirmed', 0], 'a sor (riasztas-jelzovel) es az audit valtozatlan, 0 platformhivas');
  }
  assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['atvetel_megszakadt'], 'a riasztas megmarad');
  const jo = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'helyes dontes' });
  assert.equal(jo.sd_allapot, 'feloldva_confirmed'); assert.equal(v.net.hivasok.length, 0); assert.deepEqual(await riasztasok(v, u), []);
  { // kontroll: valodi HOLD-nal (cellak halasztva) az uj_konverzio tovabbra is kuld
    const w = await csereVilag({ nincsRegi: true }); assert.equal((await w.v.sd(w.b)).allapot, 'halasztva');
    const f = await w.v.post({ ...w.b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi: uj vendeg' });
    assert.equal(f.sd_allapot, 'feloldva_uj'); assert.ok(w.v.net.hivasok.length > 0, 'a halasztott cellak kimennek');
  }
});

test('S0-58 a csere-regex MINDEN alternativaja tablazatosan tesztelt: a pelda a teljes regexre illeszkedik, az adott alternativa nelkuli regexre NEM (igy egy alternativa torlese bukik)', () => {
  const ALT = [
    ['\\w*cser\\w*', 'cserelni szeretnem'], ['athelyez\\w*', 'athelyeznem kell'], ['atfoglal\\w*', 'atfoglalnam'], ['atutemez\\w*', 'atutemezne valaki'], ['atrak\\w*', 'atrakhatnank'],
    ['atir\\w*', 'atirnam'], ['atvinn\\w*', 'atvinnem a foglalast'], ['atte(?:sz|tt|nn|hete|het|ni)\\w*', 'atteszem'], ['modosit\\w*', 'modositanam'], ['(?:meg)?valtoztat\\w*', 'valtoztatnek'],
    ['elhalaszt\\w*', 'elhalasztanam'], ['eltol\\w*', 'eltolnam'], ['elorebb\\w*', 'elorebb hoznam'], ['hatrebb\\w*', 'hatrebb szeretnem'],
    ['(?:korabbi|regi|elozo|eredeti)\\s+(?:foglalas|idopont|ido)\\w*', 'az eredeti idopontom'], ['(?:uj|masik)\\s+idopont\\w*', 'masik idopontot kernek'], ['korabban', 'korabban foglaltam'],
    ['volt\\s+\\d', 'volt 15 orara foglalasom'], ['torol(?!k)\\w*', 'torolje a foglalast'], ['torl(?:om|ok)\\b', 'torlom'], ['torles\\w*', 'torlesi kerelem'], ['megsem?\\b', 'megse lesz jo'],
    ['helyett', 'szerda helyett csutortok'], ['lemond\\w*', 'lemondanam'], ['reschedul\\w*', 'i need to reschedule'], ['instead', 'thursday instead'], ['moved?', 'i moved it'],
    ['swap\\w*', 'can we swap'], ['chang\\w*', 'i changed my mind'], ['(?:earlier|previous|original|old)\\s+(?:booking|appointment|time)', 'my previous appointment'],
  ];
  const forras = CSERE_GYANU.source;
  assert.equal(ALT.length, 30, 'a regex 30 alternativaja');
  for (const [alt, pelda] of ALT) {
    assert.ok(forras.includes(alt), 'az alternativa a regexben van: ' + alt);
    const tag = forras.includes('|' + alt) ? '|' + alt : alt + '|';
    const kevesebb = new RegExp(forras.replace(tag, ''));
    const folded = pelda.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    assert.ok(csereGyanu(pelda), 'illeszkedik: ' + pelda);
    assert.ok(!kevesebb.test(folded), 'az alternativa nelkul NEM illeszkedik (egyedi pelda): ' + alt + ' <- ' + pelda);
  }
  // az alternativak teljes listaja = a regex (nincs dokumentalatlan / tesztetlen alternativa)
  assert.equal(forras, '\\b(' + ALT.map(([a]) => a).join('|') + ')');
});

test('S0-59 QA-5 riport: a Google jogos_0 figyelmeztetes es az attribucios rezsimvaltas (2026-10-10 09:07:52 UTC) kulon jelolve az osszegzesben', async () => {
  const { egyeztetoSorok, ATTR_REZSIMVALTAS_UTC } = await import('../netlify/lib/meres/egyeztetes-sor.js');
  const v = vilag(); await v.kesz;
  const tol = Math.floor(T0 / 1000) - 4 * 86400, ig = Math.floor(T0 / 1000) + 2 * 86400;
  const r = await egyeztetoSorok(v.db, { tol, ig }); assert.equal(r.ok, true);
  assert.equal(ATTR_REZSIMVALTAS_UTC, '2026-10-10T09:07:52Z');
  assert.deepEqual([r.osszegzes.attribucios_rezsimvaltas.utc, r.osszegzes.attribucios_rezsimvaltas.unix], ['2026-10-10T09:07:52Z', Math.floor(Date.UTC(2026, 9, 10, 9, 7, 52) / 1000)]);
  assert.ok(r.osszegzes.figyelmeztetesek.some((x) => /^google_jogos_0_tartalmazhat_hozzajarulas_vagy_click_id_hiany/.test(x)));
  assert.ok(r.osszegzes.figyelmeztetesek.includes('attribucios_rezsimvaltas_2026-10-10T09:07:52Z'));
  assert.match(r.osszegzes.attribucios_rezsimvaltas.ok, /977e1232.*PR #226.*hozzajarulas nelkul/);
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// DECISION #147/2 mini-3 kor: az `uj_konverzio` guard a DONTESI BIZONYITEKHOZ kotott (confirmed / feloldva_confirmed audit VAGY reschedule_confirmed cella), a kuldes ELOTT fut, es nem utasit el helyes feloldast
/** Worker-halal szimulacio: a minta szerinti SQL `run()`-janak CSAK az n-edik (1-tol) hivasa dob kivetelt, utana minden normalisan fut. */
function halalNedik(v, minta, n) {
  const orig = v.e.KULCS_DB; const allapot = { talalt: 0, meghalt: false };
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); if (!minta.test(sql)) return p; return { ...p, bind: (...a) => { const b = p.bind(...a); return { ...b, run: async () => { if (++allapot.talalt === n) { allapot.meghalt = true; throw new Error('Worker halal (szimulalt)'); } return b.run(); } }; } }; }, batch: orig.batch };
  return allapot;
}
/** Az adatbazis MINDEN tablajanak teljes tartalma (sqlite_master) - az elutasitas mellekhatas-mentessegenek bizonyitasara. */
const dumpMind = (v) => Object.fromEntries(v.sql("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((x) => [x.name, JSON.stringify(v.sql(`SELECT * FROM ${x.name}`).map((r) => JSON.stringify(r)).sort())]));
const cellakSor = (v) => v.sql('SELECT platform, allapot, indok FROM meres_kuldes ORDER BY platform, esemeny_nev');
const CELLA_IRAS = /^UPDATE meres_kuldes SET allapot = \?2, indok = \?3, platform_nev/;

test('S0-60 a `confirmed` cella-ciklus KOZBEN megszakadt Worker (Meta + TikTok `kihagyva (reschedule_confirmed)`, a tobbi cella nem vegleges) + rossz `uj_konverzio`: elutasitva a kuldes ELOTT (0 platformhivas, sor / audit / cellak valtozatlanok, a riasztas marad), a `confirmed` feloldas lezar', async () => {
  const { v, u, b } = await csereVilag(); // a regi foglalas indexelve, MEGJ_99 -> confirmed
  const { megjegyzes, ...nelkule } = b;
  assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'hianyzo_mezo');
  const halal = halalNedik(v, CELLA_IRAS, 3); // a potlo (confirmed) futas a 3. cellairasnal meghal
  await v.sd(b).catch(() => null); assert.ok(halal.meghalt, 'a szimulalt halal lefutott');
  assert.deepEqual([sdSor(v, u).sd_allapot, csereSor(v, u).allapot, v.net.hivasok.length], ['halasztva', 'confirmed', 0]);
  const elotte = cellakSor(v); const dumpElotte = dumpMind(v);
  assert.ok(elotte.some((c) => c.allapot === 'kihagyva' && /^reschedule_confirmed/.test(c.indok)), 'van reschedule_confirmed cella');
  assert.ok(elotte.some((c) => c.allapot !== 'kihagyva'), 'a ciklus kozben megszakadt: nem minden cella vegleges (ezert az elosztas NEM `mar_kuldve`)');
  const rossz = { ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz emberi dontes' };
  for (let i = 0; i < 2; i++) {
    const r = await v.post(rossz);
    assert.deepEqual([r.allapot, r.sd_allapot, r.kuldes, r.riasztas], ['feloldas_nem_lehetseges', 'halasztva', 0, true]); assert.match(r.miert, /a helyes feloldas a `confirmed`$/);
    assert.deepEqual([sdSor(v, u).sd_allapot, sdSor(v, u).riasztas, csereSor(v, u).allapot, v.net.hivasok.length], ['halasztva', 1, 'confirmed', 0]);
    assert.deepEqual(cellakSor(v), elotte, 'a cellak valtozatlanok (a guard a kuldes ELOTT fut: nincs mellekhatas)');
    assert.deepEqual(dumpMind(v), dumpElotte, 'az ELUTASITAS utan MINDEN tabla bajtra valtozatlan (nem csak a sor / audit / cellak)');
  }
  assert.deepEqual((await riasztasok(v, u)).map((x) => x.tipus), ['atvetel_megszakadt']);
  const jo = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'helyes dontes' });
  assert.equal(jo.sd_allapot, 'feloldva_confirmed'); assert.equal(v.net.hivasok.length, 0); assert.deepEqual(await riasztasok(v, u), []);
  { // a bizonyitek KET agat kulon-kulon: (i) csak az audit-sor (a cellak nem `reschedule_confirmed`), (ii) csak a reschedule_confirmed cella (az audit `suspected`), (iii) `feloldva_confirmed` audit-sor (felbemaradt confirmed FELOLDAS)
    const probal = async (nev, elokesz, vart) => {
      const w = await csereVilag(); const { megjegyzes: _m, ...nl } = w.b; await w.v.sd(nl);
      const h = halalNedik(w.v, CELLA_IRAS, 3); await w.v.sd(w.b).catch(() => null); assert.ok(h.meghalt, nev);
      await elokesz(w);
      const r = await w.v.post({ ...w.b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz emberi dontes' });
      assert.deepEqual([r.allapot, sdSor(w.v, w.u).sd_allapot, w.v.net.hivasok.length], [vart, vart === 'feloldas_nem_lehetseges' ? 'halasztva' : 'feloldva_uj', vart === 'feloldas_nem_lehetseges' ? 0 : w.v.net.hivasok.length], nev);
    };
    await probal('(i) csak az audit-sor', async (w) => { w.v.sql("UPDATE meres_kuldes SET allapot = 'halasztva', indok = 'x'"); }, 'feloldas_nem_lehetseges');
    await probal('(ii) csak a cella', async (w) => { w.v.sql("UPDATE foglalas_reschedule SET allapot = 'suspected' WHERE uuid = ?1", w.u); }, 'feloldas_nem_lehetseges');
    await probal('(iii) feloldva_confirmed audit', async (w) => { w.v.sql("UPDATE meres_kuldes SET allapot = 'halasztva', indok = 'x'"); w.v.sql("UPDATE foglalas_reschedule SET allapot = 'feloldva_confirmed' WHERE uuid = ?1", w.u); }, 'feloldas_nem_lehetseges');
    await probal('kontroll: sem audit-bizonyitek, sem reschedule_confirmed cella -> nem utasit el (valodi HOLD-nak latszik)', async (w) => { w.v.sql("UPDATE meres_kuldes SET allapot = 'halasztva', indok = 'x'"); w.v.sql("UPDATE foglalas_reschedule SET allapot = 'suspected' WHERE uuid = ?1", w.u); }, 'feloldva_uj');
  }
});

test('S0-60b az `uj_konverzio` guard NEM utasit el helyes feloldast: valodi HOLD sor (suspected audit) cellaallapottol fuggetlenul (nincs token, lemondva, nyitott ertek, vesz-kapcsolo) lezarhato; `confirmed` sor mar kiment / kimeno cellaval szinten', async () => {
  for (const [nev, cellaAllapot, indok] of [['nincs_hitelesites', 'nincs_hitelesites', 'nincs token'], ['lemondva', 'kihagyva', 'lemondva: a foglalas kozben lemondtak'], ['nyitott', 'nyitott', 'konzultacio ertek nyitott'], ['vesz-kapcsolo', 'kihagyva', 'vesz-kapcsolo']]) {
    const { v, u, b } = await csereVilag({ nincsRegi: true }); assert.equal((await v.sd(b)).allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'suspected');
    v.sql("UPDATE meres_kuldes SET allapot = ?1, indok = ?2", cellaAllapot, indok); // minden cella veglegesnek latszik, egy sem `elkuldve` (a HOLD-ot megszakitott feloldas utani helyzet)
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi: uj vendeg' });
    assert.notEqual(r.allapot, 'feloldas_nem_lehetseges', nev); assert.equal(r.sd_allapot, 'feloldva_uj', nev); assert.equal(csereSor(v, u).allapot, 'feloldva_uj', nev);
  }
  { // `confirmed` audit + EGYETLEN kiment cella (Meta elkuldve): a felbemaradt uj_konverzio lezarhato (nincs csendes vesztes: van kiment konverzio)
    const { v, u, b } = await csereVilag(); const { megjegyzes, ...nelkule } = b; await v.sd(nelkule);
    const halal = halalNedik(v, CELLA_IRAS, 3); await v.sd(b).catch(() => null); assert.ok(halal.meghalt);
    v.sql("UPDATE meres_kuldes SET allapot = 'elkuldve' WHERE platform = 'meta'");
    assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = 'elkuldve'")[0].n, 1, 'pontosan 1 kiment cella');
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi dontes' });
    assert.notEqual(r.allapot, 'feloldas_nem_lehetseges'); assert.equal(r.sd_allapot, 'feloldva_uj');
  }
  { // a cella-bizonyitek EGYETLEN `reschedule_confirmed` cellaval is elutasit (az audit `suspected`, a tobbi cella `halasztva`): a `biz.rc > 0` hatar (nem `> 1`)
    const { v, u, b } = await csereVilag(); const { megjegyzes, ...nelkule } = b; await v.sd(nelkule);
    const halal = halalNedik(v, CELLA_IRAS, 3); await v.sd(b).catch(() => null); assert.ok(halal.meghalt);
    v.sql("UPDATE meres_kuldes SET allapot = 'halasztva', indok = 'x' WHERE platform != 'meta'"); v.sql("UPDATE foglalas_reschedule SET allapot = 'suspected' WHERE uuid = ?1", u);
    assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = 'kihagyva' AND indok LIKE 'reschedule_confirmed%'")[0].n, 1, 'pontosan 1 reschedule_confirmed cella');
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz emberi dontes' });
    assert.deepEqual([r.allapot, sdSor(v, u).sd_allapot, v.net.hivasok.length], ['feloldas_nem_lehetseges', 'halasztva', 0]);
  }
  { // `confirmed` audit + `nincs_hitelesites` cella (a kerelem kesz, kulso szallitora var): szinten lezarhato
    const { v, u, b } = await csereVilag(); const { megjegyzes, ...nelkule } = b; await v.sd(nelkule);
    const halal = halalNedik(v, CELLA_IRAS, 3); await v.sd(b).catch(() => null); assert.ok(halal.meghalt);
    v.sql("UPDATE meres_kuldes SET allapot = 'nincs_hitelesites' WHERE platform = 'meta'");
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi dontes' });
    assert.notEqual(r.allapot, 'feloldas_nem_lehetseges'); assert.equal(r.sd_allapot, 'feloldva_uj');
  }
});

// ---------------------------------------------------------------------------------------------------------------------------------------
// DECISION #148/2 mini-4 kor: az `uj_konverzio` guard TOCTOU-ablaka zart - a feltetel KOZVETLENUL az audit-/allapot-iras elott FRISS allapotbol ujra ellenorzodik
/** Az `uj_konverzio` guard ELSO bizonyitek-SELECT-je UTAN (a guard mar atengedett) lefuttat egy parhuzamos, ellentetes hivast (`elteres`) - determinisztikus TOCTOU-beszuras. */
function guardUtanBeszur(v, elteres, utana) {
  const orig = v.e.KULCS_DB; let hivas = 0, beszurva = 0;
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); if (!sql.includes("SUM(allapot IN ('elkuldve', 'nincs_hitelesites'))")) return p; return { ...p, bind: (...a) => { const b = p.bind(...a); return { ...b, first: async () => { const r = await b.first(); if (!hivas++) { beszurva++; await elteres(); if (utana) utana(); } return r; } }; } }; }, batch: orig.batch };
  return () => beszurva;
}
/** Veletlen 0..maxMs ms kesleltetes minden kotott utasitasra (valodi D1-szeru interleaving). */
function veletlenKesleltet(v, maxMs) {
  const orig = v.e.KULCS_DB; const al = () => new Promise((r) => setTimeout(r, Math.random() * maxMs));
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); return { ...p, bind: (...a) => { const b = p.bind(...a); return { ...b, run: async () => { await al(); return b.run(); }, first: async () => { await al(); return b.first(); }, all: async () => { await al(); return b.all(); } }; } }; }, batch: orig.batch };
}
/** Csendes konverzio-vesztes: a sor `feloldva_uj`, de egyetlen cella sem `elkuldve` / `nincs_hitelesites`. */
const csendesVesztes = (v, u) => sdSor(v, u).sd_allapot === 'feloldva_uj' && v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot IN ('elkuldve', 'nincs_hitelesites')")[0].n === 0;

test('S0-61 TOCTOU: a guard es a kuldes kozott egy parhuzamos `confirmed` dontes (feloldas VAGY a Zap hianyzo_mezo-potlasa) lezarja a cellakat -> a rossz `uj_konverzio` az iras ELOTT elutasitva (nincs csendes 0-kuldeses feloldva_uj), a nyertes `confirmed` marad', async () => {
  for (const nev of ['sd_feloldas confirmed', 'Zap hianyzo_mezo-potlas']) {
    const { v, u, b } = await csereVilag(); const { megjegyzes, ...nelkule } = b;
    assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'hianyzo_mezo');
    let dumpNyertesUtan = null;
    const futott = guardUtanBeszur(v, async () => {
      if (nev === 'sd_feloldas confirmed') await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'parhuzamos helyes dontes' });
      else await v.sd(b); // a Zap mostantol kuldi a megjegyzes kulcsot -> automatikus confirmed
    }, () => { dumpNyertesUtan = dumpMind(v); });
    const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz, egyideju emberi dontes' });
    assert.equal(futott(), 1, nev + ': a beszuras lefutott');
    assert.deepEqual([r.allapot, r.kuldes], ['feloldas_nem_lehetseges', 0], nev); assert.match(r.miert, /a helyes feloldas a `confirmed`$/);
    assert.equal(r.sd_allapot, sdSor(v, u).sd_allapot, nev + ': a valasz a FRISS (nyertes) allapotot mutatja');
    assert.equal(r.riasztas, sdSor(v, u).riasztas === 1, nev + ': a valasz riasztas-mezoje a FRISS sorbol jon (nem a pillanatkepbol)');
    assert.deepEqual(dumpMind(v), dumpNyertesUtan, nev + ': a 2. elutasitas utan MINDEN tabla bajtra azonos a nyertes hivas vegen merttel (a kuldesi lepes sem irt semmit)');
    assert.ok(['feloldva_confirmed', 'reschedule_confirmed'].includes(sdSor(v, u).sd_allapot), nev + ': a nyertes confirmed marad: ' + sdSor(v, u).sd_allapot);
    assert.ok(['confirmed', 'feloldva_confirmed'].includes(csereSor(v, u).allapot), nev + ': az audit nem lett feloldva_uj: ' + csereSor(v, u).allapot);
    assert.equal(v.net.hivasok.length, 0, nev + ': 0 platformhivas'); assert.equal(csendesVesztes(v, u), false, nev);
  }
});

test('S0-61b konkurencia-stressz: ellentetes egyideju dontesek (confirmed || uj_konverzio, Zap-potlas || uj_konverzio, Zap || confirmed || uj_konverzio) veletlen D1-kesleltetessel - 0 csendes 0-kuldeses feloldva_uj, 0 dupla kuldes', async () => {
  const forgatokonyvek = {
    'confirmed || uj': (v, b) => [v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'a' }), v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'b' })],
    'Zap || uj': (v, b) => [v.sd(b), v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'b' })],
    'Zap || confirmed || uj': (v, b) => [v.sd(b), v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'a' }), v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'b' })],
  };
  for (const [nev, indit] of Object.entries(forgatokonyvek)) {
    let csendes = 0, dupla = 0;
    for (let i = 0; i < 12; i++) {
      const { v, u, b } = await csereVilag(); const { megjegyzes, ...nelkule } = b; await v.sd(nelkule);
      veletlenKesleltet(v, 2); await Promise.all(indit(v, b).map((p) => p.catch(() => null)));
      if (csendesVesztes(v, u)) csendes++;
      if (v.net.hivasok.length > 2) dupla++;
    }
    assert.deepEqual([csendes, dupla], [0, 0], nev + ': csendes vesztes / dupla kuldes');
  }
});

/** Az elso, mintara illeszkedo iras (`run`) ELOTT lefuttat egy parhuzamos, ellentetes hivast (`elteres`) - determinisztikus beszuras egy konkret ir\u00e1si pontra. */
function iraselottBeszur(v, minta, elteres) {
  const orig = v.e.KULCS_DB; let n = 0, beszurva = 0;
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); if (!minta.test(sql)) return p; return { ...p, bind: (...a) => { const b = p.bind(...a); return { ...b, run: async () => { if (!n++) { beszurva++; await elteres(); } return b.run(); } }; } }; }, batch: orig.batch };
  return () => beszurva;
}

test('S0-61c a 2. bizonyitek-ellenorzes UTANI ablak is zart: ha a kuldesi lepes utan a cellak meg nem vegleges allapotuak (az elo allapot nem ellenorizheto -> `halasztva`), es EKKOR (az audit-iras elott / az allapot-iras elott) erkezik a parhuzamos `confirmed`, a vegallapot-iras atomi feltetele megfogja: nincs csendes 0-kuldeses feloldva_uj', async () => {
  const pontok = { 'az audit-iras ELOTT': /^INSERT INTO foglalas_reschedule/, 'az allapot-iras (veglegesIr) ELOTT': /^UPDATE foglalas_egyeztetes SET sd_allapot = \?2, riasztas = 0/ };
  for (const [pont, minta] of Object.entries(pontok)) {
    for (const nev of ['sd_feloldas confirmed', 'Zap hianyzo_mezo-potlas']) {
      const { v, u, b } = await csereVilag(); const { megjegyzes, ...nelkule } = b;
      assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'hianyzo_mezo');
      v.net.allapot.set(u, 'hiba'); // az elo allapot NEM ellenorizheto: az uj_konverzio cellai a kuldesi lepes utan `halasztva` (nem vegleges) -> az 1. es a 2. ellenorzes nem lat bizonyitekot
      let nyertesAudit = null, nyertesDump = null;
      const futott = iraselottBeszur(v, minta, async () => {
        if (nev === 'sd_feloldas confirmed') await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'parhuzamos helyes dontes' });
        else await v.sd(b);
        nyertesAudit = auditTeljes(v, u); nyertesDump = dumpMind(v);
      });
      const r = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz, egyideju emberi dontes' });
      const cim = pont + ' / ' + nev;
      assert.equal(futott(), 1, cim + ': a beszuras lefutott');
      if (pont === 'az audit-iras ELOTT') { // (#14c K1) a vesztes audit-irasa atomi feltetelhez kotott: a nyertes audit-sor (a bizonyitek-mezokkel egyutt) bajtra erintetlen, a valasz explicit elutasitas, a vesztes semmit nem ir
        assert.ok(['confirmed', 'feloldva_confirmed'].includes(nyertesAudit.allapot), cim + ': a nyertes audit: ' + nyertesAudit.allapot);
        if (nev === 'Zap hianyzo_mezo-potlas') assert.ok(nyertesAudit.regi_uuid && nyertesAudit.reschedule_from && nyertesAudit.reschedule_to && nyertesAudit.regi_aktiv === 1, cim + ': a Zap-potlas bizonyitek-mezoi megvannak (a teszt nem ures)');
        assert.deepEqual(auditTeljes(v, u), nyertesAudit, cim + ': a vesztes nem irta felul az audit-sort');
        assert.deepEqual([r.allapot, r.kuldes], ['feloldas_nem_lehetseges', 0], cim + ': explicit elutasitas');
        assert.deepEqual(dumpMind(v), nyertesDump, cim + ': a nyertes utan MINDEN tabla bajtra azonos');
      }
      assert.notEqual(r.sd_allapot, 'feloldva_uj', cim + ': a valasz nem feloldva_uj');
      // a nyertes `confirmed` marad; kivetel: ha az audit mar `feloldva_uj` volt, a Zap-potlas no-op (nincs `hianyzo_mezo` audit), es az uj_konverzio cellai `halasztva` -> `tartva` + riasztas (ujraprobalhato, NEM csendes veszteseg)
      assert.ok(['feloldva_confirmed', 'reschedule_confirmed', 'tartva'].includes(sdSor(v, u).sd_allapot), cim + ': ' + sdSor(v, u).sd_allapot);
      if (sdSor(v, u).sd_allapot === 'tartva') assert.equal(sdSor(v, u).riasztas, 1, cim + ': a tartva sor riasztassal jelzett');
      assert.equal(csendesVesztes(v, u), false, cim); assert.equal(v.net.hivasok.length, 0, cim + ': 0 platformhivas');
    }
  }
});

test('S0-61d (#14d K1) a Zap-potlas "folyamatban" ablaka is zart: a nyertes az audit-sort ELOBB irja (`confirmed`), a cellakat UTANA zarja `reschedule_confirmed`-re; ha EKKOR erkezik a vesztes `uj_konverzio` audit-irasa, a bizonyitek az audit-agbol is jon -> a nyertes audit-sor (a bizonyitek-mezokkel) bajtra erintetlen, explicit elutasitas, 0 platformhivas', async () => {
  const kapu = () => { let f; const p = new Promise((r) => { f = r; }); return { p, nyit: () => f() };};
  const varj = async (felt) => { for (let i = 0; i < 4000 && !felt(); i++) await new Promise((r) => setTimeout(r, 1)); assert.ok(felt(), 'idozites: a kapu nem erte el a varakozasi pontot'); };
  const vilagok = [['az elo allapot nem ellenorizheto', {}, true], ['Meta/TikTok teszt-kod nelkul (tiltva)', { env: { META_TESZT_KOD: '', TIKTOK_TESZT_KOD: '' } }, false]];
  for (const [nev, vilagO, hiba] of vilagok) {
    const { v, u, b } = await csereVilag({ vilag: vilagO }); const { megjegyzes, ...nelkule } = b;
    assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'hianyzo_mezo');
    if (hiba) v.net.allapot.set(u, 'hiba');
    const als = new AsyncLocalStorage(); const gL = kapu(), gW = kapu(); const st = { L: false, W: false };
    const orig = v.e.KULCS_DB;
    const kapus = async (sql) => { // L = a vesztes uj_konverzio: a sajat audit-INSERT-je elott all meg; W = a nyertes Zap-potlas: az audit-iras UTAN, az elso cella-zaras ELOTT all meg
      const ki = als.getStore();
      if (ki === 'L' && !st.L && /^INSERT INTO foglalas_reschedule/.test(sql)) { st.L = true; await gL.p; }
      if (ki === 'W' && !st.W && /^UPDATE meres_kuldes SET allapot = \?2, indok = \?3, platform_nev/.test(sql)) { st.W = true; await gW.p; }
    };
    const burk = (sql, p) => ({ run: async () => { await kapus(sql); return p.run(); }, first: async () => { await kapus(sql); return p.first(); }, all: async () => { await kapus(sql); return p.all(); } });
    v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); return { ...p, ...burk(sql, p), bind: (...a) => burk(sql, p.bind(...a)) }; }, batch: orig.batch };
    const pL = als.run('L', () => v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz, egyideju emberi dontes' }));
    await varj(() => st.L);
    const pW = als.run('W', () => v.sd(b)); // a Zap mostantol kuldi a megjegyzes kulcsot -> automatikus confirmed
    await varj(() => st.W);
    const nyertesAudit = auditTeljes(v, u);
    assert.equal(nyertesAudit.allapot, 'confirmed', nev + ': a nyertes audit-sor megirva');
    assert.ok(nyertesAudit.regi_uuid && nyertesAudit.reschedule_from && nyertesAudit.reschedule_to && nyertesAudit.regi_aktiv === 1, nev + ': a nyertes bizonyitek-mezoi megvannak (a teszt nem ures)');
    assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = 'kihagyva' AND indok LIKE 'reschedule_confirmed%'")[0].n, 0, nev + ': a cellak MEG nem rc (ez az ablak)');
    gL.nyit(); const rL = await pL;
    assert.deepEqual([rL.allapot, rL.kuldes], ['feloldas_nem_lehetseges', 0], nev + ': explicit elutasitas');
    assert.deepEqual(auditTeljes(v, u), nyertesAudit, nev + ': a vesztes nem irta felul a nyertes audit-sort');
    gW.nyit(); const rW = await pW;
    assert.ok(['reschedule_confirmed', 'feloldva_confirmed'].includes(sdSor(v, u).sd_allapot), nev + ': a nyertes confirmed marad: ' + sdSor(v, u).sd_allapot + ' / ' + rW.allapot);
    assert.deepEqual(auditTeljes(v, u), nyertesAudit, nev + ': a vegen is bajtra a nyertes audit-sor');
    assert.equal(v.net.hivasok.length, 0, nev + ': 0 platformhivas'); assert.equal(csendesVesztes(v, u), false, nev);
  }
});

test('S0-61e a bizonyitek audit-aga SZIMMETRIKUS: `feloldva_confirmed` audit-sor is megfogja a vesztes uj_konverzio audit-irasat (cella-bizonyitek nelkul is), nem csak a `confirmed`', async () => {
  const { v, u, b } = await csereVilag(); const { megjegyzes, ...nelkule } = b;
  assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); v.net.allapot.set(u, 'hiba'); // a vesztes semmit nem kuld
  const orig = v.e.KULCS_DB; let all = null; const belep = new Promise((r) => { all = r; }); let elenged; const kapu = new Promise((r) => { elenged = r; }); let vart = false;
  const burk = (sql, p) => ({ run: async () => { if (!vart && /^INSERT INTO foglalas_reschedule/.test(sql)) { vart = true; all(); await kapu; } return p.run(); }, first: () => p.first(), all: () => p.all() });
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); return { ...p, bind: (...a) => burk(sql, p.bind(...a)) }; }, batch: orig.batch };
  const pL = v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz, egyideju emberi dontes' });
  await belep; // a vesztes b1/b2 utan, a sajat audit-INSERT elott all; kozben egy `feloldva_confirmed` audit-sor jelenik meg (cella-bizonyitek nelkul)
  v.sql("UPDATE foglalas_reschedule SET allapot = 'feloldva_confirmed', reschedule_from = '2026-10-16T14:00:00.000Z', reschedule_to = '2026-10-20T14:00:00.000Z', regi_uuid = 'bizonyitek-mezo', regi_aktiv = 1 WHERE uuid = ?1", u);
  const elotte = auditTeljes(v, u); assert.equal(elotte.allapot, 'feloldva_confirmed');
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE (allapot = 'kihagyva' AND indok LIKE 'reschedule_confirmed%') OR allapot IN ('elkuldve', 'nincs_hitelesites')")[0].n, 0, 'cella-bizonyitek nincs: csak az audit-ag dontheti el');
  elenged(); const r = await pL;
  assert.deepEqual([r.allapot, r.kuldes], ['feloldas_nem_lehetseges', 0]); assert.deepEqual(auditTeljes(v, u), elotte, 'az audit-sor bajtra erintetlen');
});

// --- (#14e) a bizonyitek harom helye (ujKonverzioBizonyitek / rescheduleIr / veglegesIr) EGYSEGES: determinisztikus kapus tesztek -----------------------------------------------
const kapuPar = () => { let f; const p = new Promise((r) => { f = r; }); return { p, nyit: () => f() }; };
const varjFelt = async (felt, cim) => { for (let i = 0; i < 4000 && !felt(); i++) await new Promise((r) => setTimeout(r, 1)); assert.ok(felt(), 'idozites: ' + cim); };
/** AsyncLocalStorage-cimkezett hivasok kapuzasa: a `ki` cimku hivas az elso, `minta`-ra illeszkedo D1-muvelet ELOTT megall, amig a `kapu` meg nem nyilik. */
function kapusDb(v, als, szabalyok) {
  const orig = v.e.KULCS_DB;
  const kapus = async (sql) => { const ki = als.getStore(); for (const sz of szabalyok) if (ki === sz.ki && !sz.allt && sz.minta.test(sql)) { sz.allt = true; await sz.kapu.p; } };
  const burk = (sql, p) => ({ run: async () => { await kapus(sql); return p.run(); }, first: async () => { await kapus(sql); return p.first(); }, all: async () => { await kapus(sql); return p.all(); } });
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); return { ...p, ...burk(sql, p), bind: (...a) => burk(sql, p.bind(...a)) }; }, batch: orig.batch };
}
const TILTVA = { env: { META_TESZT_KOD: '', TIKTOK_TESZT_KOD: '' } };

test('S0-61f (#14e K1) a `veglegesIr` atomi feltetele az AUDIT-AGAT is tartalmazza: ha a nyertes Zap-potlas az audit-sort mar megirta (`confirmed`), de a cellakat meg nem zarta, a vesztes uj_konverzio vegallapot-irasa nem allithatja a sort 0 kuldessel `feloldva_uj`-ra (Meta/TikTok `tiltva`)', async () => {
  const { v, u, b } = await csereVilag({ vilag: TILTVA }); const { megjegyzes, ...nelkule } = b;
  assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); assert.equal(csereSor(v, u).allapot, 'hianyzo_mezo');
  const als = new AsyncLocalStorage(); const w1 = { ki: 'W', minta: /^INSERT INTO foglalas_reschedule/, kapu: kapuPar() }, wc = { ki: 'W', minta: /^UPDATE meres_kuldes SET allapot = \?2, indok = \?3, platform_nev/, kapu: kapuPar() }, lv = { ki: 'L', minta: /^UPDATE foglalas_egyeztetes SET sd_allapot = \?2, riasztas = 0/, kapu: kapuPar() };
  kapusDb(v, als, [w1, wc, lv]);
  const pW = als.run('W', () => v.sd(b)); // a Zap-potlas: a csere-dontest meghozta (confirmed), az audit-INSERT elott all
  await varjFelt(() => w1.allt, 'W az audit-INSERT elott');
  const pL = als.run('L', () => v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz, egyideju emberi dontes' })); // a vesztes: audit `feloldva_uj`, majd a veglegesIr elott all
  await varjFelt(() => lv.allt, 'L a veglegesIr elott');
  assert.equal(csereSor(v, u).allapot, 'feloldva_uj', 'a vesztes audit-irasa megtortent (a nyertes meg nem irt)');
  w1.kapu.nyit(); await varjFelt(() => wc.allt, 'W az elso cella-zaras elott'); // a nyertes audit-sora (confirmed, a bizonyitek-mezokkel) felulirta a vesztesét, a cellak meg NEM rc
  const nyertesAudit = auditTeljes(v, u); assert.equal(nyertesAudit.allapot, 'confirmed'); assert.ok(nyertesAudit.regi_uuid && nyertesAudit.reschedule_from && nyertesAudit.reschedule_to);
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = 'kihagyva' AND indok LIKE 'reschedule_confirmed%'")[0].n, 0, 'a cellak MEG nem rc (ez az ablak)');
  lv.kapu.nyit(); const rL = await pL; // a vesztes veglegesIr-je EKKOR fut
  assert.notEqual(sdSor(v, u).sd_allapot, 'feloldva_uj', 'a sor nem allt 0 kuldessel feloldva_uj-ra: ' + sdSor(v, u).sd_allapot + ' / ' + rL.allapot);
  assert.deepEqual(auditTeljes(v, u), nyertesAudit, 'a nyertes audit-sor erintetlen');
  wc.kapu.nyit(); await pW;
  assert.ok(['reschedule_confirmed', 'feloldva_confirmed'].includes(sdSor(v, u).sd_allapot), 'a nyertes confirmed marad: ' + sdSor(v, u).sd_allapot);
  assert.equal(auditTeljes(v, u).allapot, 'confirmed'); assert.equal(v.net.hivasok.length, 0, '0 platformhivas'); assert.equal(csendesVesztes(v, u), false);
});

test('S0-61g (#14e T2) a `rescheduleIr` CELLA-aga onalloan vedi az audit-sort: az emberi `confirmed` nyertes a cellakat ELOBB zarja (rc), az audit-sort UTANA irja; ha a vesztes uj_konverzio audit-INSERT-je EKKOR fut (az audit meg `hianyzo_mezo`), a cella-bizonyitek megfogja', async () => {
  for (const [nev, vilagO, hiba] of [['elo allapot nem ellenorizheto', {}, true], ['tiltva', TILTVA, false]]) {
    const { v, u, b } = await csereVilag({ vilag: vilagO }); const { megjegyzes, ...nelkule } = b;
    assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); if (hiba) v.net.allapot.set(u, 'hiba');
    const als = new AsyncLocalStorage(); const lI = { ki: 'L', minta: /^INSERT INTO foglalas_reschedule/, kapu: kapuPar() }, wI = { ki: 'W', minta: /^INSERT INTO foglalas_reschedule/, kapu: kapuPar() };
    kapusDb(v, als, [lI, wI]);
    const pL = als.run('L', () => v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz, egyideju emberi dontes' }));
    await varjFelt(() => lI.allt, nev + ': L az audit-INSERT elott (b1/b2 kesz, meg nincs bizonyitek)');
    const pW = als.run('W', () => v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'confirmed', ok: 'helyes emberi dontes' }));
    await varjFelt(() => wI.allt, nev + ': W az audit-INSERT elott (a cellak mar rc)');
    assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = 'kihagyva' AND indok LIKE 'reschedule_confirmed%'")[0].n > 0, true, nev + ': a cellak rc-re zartak');
    const elotte = auditTeljes(v, u); assert.equal(elotte.allapot, 'hianyzo_mezo', nev + ': az audit meg a regi (nincs audit-ag bizonyitek)');
    lI.kapu.nyit(); const rL = await pL;
    assert.deepEqual([rL.allapot, rL.kuldes], ['feloldas_nem_lehetseges', 0], nev + ': explicit elutasitas'); assert.deepEqual(auditTeljes(v, u), elotte, nev + ': az audit-sor erintetlen (a cella-ag fogta meg)');
    wI.kapu.nyit(); await pW;
    assert.equal(auditTeljes(v, u).allapot, 'feloldva_confirmed', nev); assert.equal(sdSor(v, u).sd_allapot, 'feloldva_confirmed', nev); assert.equal(v.net.hivasok.length, 0, nev);
  }
});

test('S0-61h (#14e T2) a `feloldva_uj` audit-sor NEM bizonyitek: az `uj_konverzio` sajat Worker-halala az audit-iras UTAN, a veglegesIr ELOTT -> ugyanaz a feloldas ujrafuttathato (nem akad be `halasztva`-ban)', async () => {
  const { v, u, b } = await csereVilag({ vilag: TILTVA }); const { megjegyzes, ...nelkule } = b;
  assert.equal((await v.sd(nelkule)).allapot, 'halasztva');
  const orig = v.e.KULCS_DB; let halt = false;
  v.e.KULCS_DB = { prepare: (sql) => { const p = orig.prepare(sql); if (!/^UPDATE foglalas_egyeztetes SET sd_allapot = \?2, riasztas = 0/.test(sql)) return p; return { ...p, bind: (...a) => { const bb = p.bind(...a); return { ...bb, run: async () => { if (!halt) { halt = true; throw new Error('Worker halal (szimulalt) a veglegesIr-nel'); } return bb.run(); } }; } }; }, batch: orig.batch };
  const FEL = { ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'emberi dontes' };
  await v.post(FEL).catch(() => null); assert.equal(halt, true, 'a szimulalt halal a veglegesIr-nel bekovetkezett');
  assert.deepEqual([csereSor(v, u).allapot, sdSor(v, u).sd_allapot], ['feloldva_uj', 'halasztva'], 'a halal utan: az audit mar feloldva_uj, a sor meg halasztva');
  const r2 = await v.post(FEL);
  assert.deepEqual([r2.sd_allapot, sdSor(v, u).sd_allapot, csereSor(v, u).allapot], ['feloldva_uj', 'feloldva_uj', 'feloldva_uj'], 'az ujrafuttatas lezarja: ' + JSON.stringify(r2));
  assert.equal(v.net.hivasok.length, 0, 'tiltva: nincs mit kuldeni');
});

test('S0-61i (#14e T2) a `veglegesIr` audit-aga SZIMMETRIKUS: `feloldva_confirmed` audit-sor is megfogja a vegallapot-irast (cella-bizonyitek nelkul is), nem csak a `confirmed`', async () => {
  const { v, u, b } = await csereVilag({ vilag: TILTVA }); const { megjegyzes, ...nelkule } = b;
  assert.equal((await v.sd(nelkule)).allapot, 'halasztva');
  const als = new AsyncLocalStorage(); const lv = { ki: 'L', minta: /^UPDATE foglalas_egyeztetes SET sd_allapot = \?2, riasztas = 0/, kapu: kapuPar() };
  kapusDb(v, als, [lv]);
  const pL = als.run('L', () => v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz, egyideju emberi dontes' }));
  await varjFelt(() => lv.allt, 'L a veglegesIr elott (az audit mar feloldva_uj)');
  v.sql("UPDATE foglalas_reschedule SET allapot = 'feloldva_confirmed' WHERE uuid = ?1", u); // egy parhuzamos `confirmed` lezarta az audit-sort (cella-bizonyitek nelkul)
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE (allapot = 'kihagyva' AND indok LIKE 'reschedule_confirmed%') OR allapot IN ('elkuldve', 'nincs_hitelesites')")[0].n, 0, 'cella-bizonyitek nincs: csak az audit-ag dontheti el');
  lv.kapu.nyit(); await pL;
  assert.notEqual(sdSor(v, u).sd_allapot, 'feloldva_uj', 'a sor nem allt 0 kuldessel feloldva_uj-ra: ' + sdSor(v, u).sd_allapot); assert.equal(auditTeljes(v, u).allapot, 'feloldva_confirmed');
});

test('S0-61j (#14f T1) a `veglegesIr` CELLA-aga onalloan: a cellak mar rc (a nyertes emberi `confirmed` ELOBB zart), az audit-sor meg a vesztes sajat `feloldva_uj`-a -> a sor nem allhat 0 kuldessel `feloldva_uj`-ra', async () => {
  const { v, u, b } = await csereVilag({}); const { megjegyzes, ...nelkule } = b;
  assert.equal((await v.sd(nelkule)).allapot, 'halasztva'); v.net.allapot.set(u, 'hiba'); // az elo allapot nem ellenorizheto: a cellak a kuldes utan `halasztva`
  const als = new AsyncLocalStorage(); const lv = { ki: 'L', minta: /^UPDATE foglalas_egyeztetes SET sd_allapot = \?2, riasztas = 0/, kapu: kapuPar() };
  kapusDb(v, als, [lv]);
  const pL = als.run('L', () => v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'rossz, egyideju emberi dontes' }));
  await varjFelt(() => lv.allt, 'L a veglegesIr elott (az audit mar feloldva_uj)');
  assert.equal(csereSor(v, u).allapot, 'feloldva_uj');
  v.sql("UPDATE meres_kuldes SET allapot = 'kihagyva', indok = 'reschedule_confirmed (feloldva): nincs uj konverzio (korabbi foglalas: ?)' WHERE allapot = 'halasztva'"); // a nyertes emberi `confirmed` cella-zarasa (az audit-irasa meg nem futott)
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = 'kihagyva' AND indok LIKE 'reschedule_confirmed%'")[0].n > 0, true, 'a cellak rc');
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot IN ('elkuldve', 'nincs_hitelesites')")[0].n, 0, 'nincs kiment cella');
  lv.kapu.nyit(); await pL;
  assert.notEqual(sdSor(v, u).sd_allapot, 'feloldva_uj', 'a sor nem allt 0 kuldessel feloldva_uj-ra: ' + sdSor(v, u).sd_allapot);
});

// --- HeadSpa salonic_direct elokeszites (DECISION #191 A): valodi szolgaltatasnevek, kanonikus egyezes, csere, szaraz terv -------------------------
const HS_HOST = 'mosaicheadspa.salonic.hu';
const HS_NEVEK = szolgAdat.szolgaltatasok.filter((x) => x.uzletag === 'headspa').map((x) => x.nev); // a Salonic HeadSpa-fiokjanak 8 valodi szolgaltatasa (2026-10-03-i pillanatkep = az eles nevtabla, 2026-10-17)
const HS_PAROS = HS_NEVEK.find((n) => /^💆‍♀️💆‍♀️ PÁROS/.test(n)), HS_KUPON_PAROS = HS_NEVEK.find((n) => /^KUPONKÓDDAL - 💆‍♀️💆‍♀️ PÁROS/.test(n));
const HS_ELO_KUPON = (n) => n + ' (kupon)'; // az eles kuponos foglalasok szovege: "KUPONKÓDDAL - <nev> (kupon)" (11 eles foglalas, mind)
const hsLevel = (u, o = {}) => level(u, { host: HS_HOST, felado: 'Mosaic Headspa', szolgaltatas: HS_PAROS, munkatarsak: ['Páros kezelés'], idopont_szoveg: 'October 20. (Tuesday) 16:00 - 17:20', ld: { startDate: '2026-10-20T16:00:00+02:00' }, uj_vendeg: false, megjegyzes: '', ...o });

test('S0-62 HeadSpa: a 8 valodi szolgaltatasnev 4 kanonikus kulcsra kepzodik (a "KUPONKÓDDAL -" par egyezik, a "(kupon)" jelzes a KANONIKUS kulcsban nem szamit, a masik szolgaltatas nem egyezik); DECISION #194 / N1: az INDEX-kulcs hordozza a kupon-jelzest, kuponos <-> normal nem egyezik', () => {
  assert.equal(HS_NEVEK.length, 8);
  const kulcsok = HS_NEVEK.map(szolgKanon);
  assert.equal(new Set(kulcsok).size, 4, 'EGYENI Relax, EGYENI Hair, PAROS, NEGYKEZES');
  for (const n of HS_NEVEK.filter((x) => !/^KUPON/.test(x))) {
    const kup = HS_NEVEK.find((x) => x === 'KUPONKÓDDAL - ' + n);
    assert.ok(kup, 'van kuponos par: ' + n);
    assert.equal(szolgKanon(kup), szolgKanon(n), n);
    assert.equal(szolgKanon(HS_ELO_KUPON(kup)), szolgKanon(n), 'az eles kuponos szoveg "(kupon)" jelzessel is ugyanaz: ' + n);
    assert.equal(szolgKanon(HS_ELO_KUPON(n)), szolgKanon(n), 'a jelzes onmagaban sem kulonbseg: ' + n);
  }
  const egyedi = (re) => HS_NEVEK.filter((n) => re.test(n) && !/^KUPON/.test(n)).map(szolgKanon);
  assert.deepEqual([egyedi(/"Relax"/).length, egyedi(/"Hair"/).length, egyedi(/PÁROS/).length, egyedi(/NÉGYKEZES/).length], [1, 1, 1, 1]);
  assert.equal(szolgKanon('💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás (kupon)'), szolgKanon(HS_NEVEK[0]));
  assert.notEqual(szolgKanon(HS_PAROS), szolgKanon(HS_NEVEK[0]), 'PAROS != EGYENI');
  assert.notEqual(szolgKanon(HS_NEVEK[0]), szolgKanon(HS_NEVEK[1]), 'Relax != Hair');
  assert.equal(szolgKanon('Valami (kupon) kezelés'), 'valami kupon kezeles', 'csak a VEGI (kupon) jelzes esik le');
  const base = szolgKanon(HS_PAROS);
  // DECISION #194 / N1: az index-kulcs a KUPON-JELZEST is hordozza (` kupon` vegzodes), igy a kuponos <-> normal par SOHA nem csere-jelolt; a regi (F2 elotti) `<kulcs> kupon` index-kulcs mar ilyen alaku
  const kup = szolgIndexKulcs(HS_ELO_KUPON(HS_KUPON_PAROS));
  assert.equal(szolgIndexKulcs(HS_PAROS), base, 'normal: a kanonikus kulcs');
  assert.equal(kup, `${base} kupon`, 'a kuponos foglalas kulcsa `<kulcs> kupon` (megegyezik az F2 elotti index-kulccsal)');
  assert.equal(szolgIndexKulcs(HS_KUPON_PAROS), `${base} kupon`, 'a "KUPONKODDAL -" elotag is kupon-jelzes');
  assert.equal(szolgIndexKulcs(HS_PAROS + ' (kupon)'), `${base} kupon`, 'a "(kupon)" utotag is');
  assert.ok(szolgKulcsEgyezik(base, base) && szolgKulcsEgyezik(kup, kup) && szolgKulcsEgyezik(`${base} kupon`, kup), 'azonos kupon-jelzes + szolgaltatas egyezik (normal-normal, kuponos-kuponos, regi `<kulcs> kupon` - mai kuponos)');
  assert.ok(!szolgKulcsEgyezik(`${base} kupon`, base) && !szolgKulcsEgyezik(base, `${base} kupon`), 'kuponos <-> normal NEM egyezik (egyik iranyban sem, minden uzletagra)');
  assert.ok(!szolgKulcsEgyezik(kup, szolgIndexKulcs(HS_ELO_KUPON(HS_NEVEK[0]))) && !szolgKulcsEgyezik(null, base) && !szolgKulcsEgyezik(base, null) && !szolgKulcsEgyezik(null, null), 'masik szolgaltatas / ures / null-null');
  assert.ok(!szolgKulcsEgyezik(`${base} kupon extra`, base) && !szolgKulcsEgyezik(`${base} extra`, base), 'nincs tetszoleges elotag-par');
  assert.equal(szolgIndexKulcs(null), null, 'ures nev: nincs kulcs');
  assert.equal(szolgKanon(HS_ELO_KUPON(HS_KUPON_PAROS) + ' (26.900 Ft helyett most 19.900 Ft)'), base, 'a Ft-megjegyzes UTAN is levagjuk a (kupon)-t (sorrend)');
  assert.equal(szolgKanon('KUPONKÓDDAL - Valami (kupon) (9 900 Ft)'), 'valami', 'Ft-zarojel + (kupon) egyutt');
  assert.equal(szolgKanon(HS_PAROS + ' (KUPON)'), base, 'nagybetus (KUPON)');
  assert.equal(szolgKanon(HS_PAROS + '(kupon)'), base, 'szokoz nelkul is');
});

test('S0-63 HeadSpa csere (reschedule): DECISION #194 / N1: a NORMAL uj foglalas kuponos parja NEM csere-jelolt (HOLD, 0 kuldes); a KUPONOS uj foglalasnal a csere-felismeres nem fut (F-4: nincs HOLD, nincs riasztas, nincs reschedule audit-sor) - igy a normal foglalas konverzioja kuponos miatt sosem veszhet el; normal <-> normal es kuponos <-> kuponos (angol idopont-szoveg, "(kupon)" jelzes, regi index-kulcs) igen; masik szolgaltatas (EGYENI) -> HOLD', async () => {
  const MEGJ = 'A korábbi 16 órás foglalásomat cserélném erre.';
  const regiKupon = (v, regi) => v.sql("UPDATE foglalas_vendeg SET szolg_kulcs = szolg_kulcs || ' kupon' WHERE uuid = ?1", regi); // az F2 elotti index-sor: a kuponos foglalas kulcsa `<kulcs> kupon` volt
  const esetek = [
    // [nev, regi foglalas, uj foglalas, elokeszites, varhato csere-allapot]
    ['normal -> normal, angol idopont-szoveg ld nelkul a regi foglalason', { szolgaltatas: HS_PAROS, ld: null, idopont_szoveg: 'October 16. (Friday) 16:00 - 17:20' }, { szolgaltatas: HS_PAROS }, null, 'confirmed'],
    ['kuponos "(kupon)" jelzessel -> kuponos "(kupon)" jelzessel: kuponos uj foglalas, a csere-felismeres nem fut', { szolgaltatas: HS_ELO_KUPON(HS_KUPON_PAROS) }, { szolgaltatas: HS_ELO_KUPON(HS_KUPON_PAROS) }, null, 'kuponos'],
    ['a regi kuponos index-sor az F2 elotti `<kulcs> kupon` kulccsal -> kuponos: kuponos uj foglalas', { szolgaltatas: HS_PAROS }, { szolgaltatas: HS_ELO_KUPON(HS_KUPON_PAROS) }, regiKupon, 'kuponos'],
    ['normal -> kuponos "(kupon)" jelzessel: a kuponos uj foglalas nem konverzio, nincs mit visszatartani (nincs HOLD)', { szolgaltatas: HS_PAROS }, { szolgaltatas: HS_ELO_KUPON(HS_KUPON_PAROS) }, null, 'kuponos'],
    ['kuponos "(kupon)" jelzessel -> NORMAL uj foglalas: NEM par (HOLD)', { szolgaltatas: HS_ELO_KUPON(HS_KUPON_PAROS) }, { szolgaltatas: HS_PAROS }, null, 'suspected'],
    ['normal -> "KUPONKODDAL -" elotagos kuponos: kuponos uj foglalas (nincs HOLD)', { szolgaltatas: HS_PAROS }, { szolgaltatas: HS_KUPON_PAROS }, null, 'kuponos'],
    ['a regi kuponos index-sor `<kulcs> kupon` kulccsal -> normal: NEM par (az F2 tolerancia megszunt)', { szolgaltatas: HS_ELO_KUPON(HS_KUPON_PAROS) }, { szolgaltatas: HS_PAROS }, (v, regi) => { regiKupon(v, regi); v.sql("UPDATE foglalas_vendeg SET szolg_kulcs = ?2 WHERE uuid = ?1", regi, `${szolgKanon(HS_PAROS)} kupon`); }, 'suspected'],
  ];
  for (const [nev, regiMod, ujMod, elokeszit, varhato] of esetek) {
    const v = vilag(); await v.kesz;
    const regi = ujUuid();
    assert.ok((await v.post(hsLevel(regi, { ld: { startDate: '2026-10-16T16:00:00+02:00' }, idopont_szoveg: 'October 16. (Friday) 16:00 - 17:20', level_datuma: iso(T0 - 3 * 86400_000), ...regiMod }))).ok, nev);
    if (elokeszit) elokeszit(v, regi);
    if (nev.startsWith('a regi kuponos index-sor')) assert.equal(v.sql('SELECT szolg_kulcs FROM foglalas_vendeg WHERE uuid = ?1', regi)[0].szolg_kulcs, `${szolgKanon(HS_PAROS)} kupon`, 'a tarolt kulcs a kupon-jelzeses alak');
    const u = ujUuid(); const b = hsLevel(u, { megjegyzes: MEGJ, ...ujMod });
    await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    assert.equal(r.uzletag, 'headspa', nev);
    if (varhato !== 'kuponos') assert.equal(r.csere && r.csere.allapot, varhato, nev);
    if (varhato === 'kuponos') { // F-4: kuponos uj foglalas -> a csere-felismeres nem fut: nincs csere-allapot, nincs HOLD / riasztas / reschedule audit-sor, az sd 'kesz'
      assert.equal(r.csere, null, nev); assert.equal(r.allapot, 'kesz', nev); assert.ok(!r.riasztas, nev + ': nincs riasztas');
      assert.equal(r.esemeny_kuldes.kupon_nem_konverzio, true, nev);
      assert.equal(v.sql('SELECT COUNT(*) AS n FROM foglalas_reschedule WHERE uuid = ?1', u)[0].n, 0, nev + ': nincs reschedule audit-sor');
    } else if (varhato === 'confirmed') {
      assert.equal(r.allapot, 'reschedule_confirmed', nev);
      assert.deepEqual([r.csere.reschedule_from, r.csere.reschedule_to, r.csere.regi_uuid_elo8], ['2026-10-16T14:00:00.000Z', '2026-10-20T14:00:00.000Z', regi.slice(0, 8)], nev);
    } else { // N1: nem par -> HOLD (halasztva, riasztas), a jelolt nincs: a normal foglalas konverzioja nem veszhet el csendben
      assert.equal(r.allapot, 'halasztva', nev); assert.equal(r.csere.jeloltek.azonos_vendeg_szolgaltatas, 0, nev + ': nincs azonos szolgaltatas / kupon-jelzes jelolt');
    }
    assert.equal(v.net.hivasok.length, 0, nev + ': nincs uj konverzio / kuldes (a kuponos foglalas nem konverzio, a HOLD nem kuld)');
  }
  { // a kupon-jelzes kulonbsege MINDEN uzletagra kizar: PMU-nal a tarolt `<kulcs> kupon` kulcs a normal foglalassal HOLD
    const v = vilag(); await v.kesz;
    const regi = ujUuid(); assert.ok((await v.post(level(regi, { ld: { startDate: '2026-10-16T16:00:00+02:00' }, level_datuma: iso(T0 - 3 * 86400_000), uj_vendeg: false }))).ok);
    v.sql("UPDATE foglalas_vendeg SET szolg_kulcs = szolg_kulcs || ' kupon' WHERE uuid = ?1", regi);
    const u = ujUuid(); const b = level(u, { megjegyzes: MEGJ }); await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    assert.deepEqual([r.uzletag, r.allapot, r.csere.allapot, r.csere.jeloltek.azonos_vendeg_szolgaltatas], ['pmu', 'halasztva', 'suspected', 0]);
    assert.equal(v.net.hivasok.length, 0);
  }
  { // masik szolgaltatas (EGYENI Relax) a regi PAROS helyett: a jelolt nem azonos szolgaltatas -> HOLD, 0 kuldes
    const v = vilag(); await v.kesz;
    const regi = ujUuid();
    await v.post(hsLevel(regi, { ld: { startDate: '2026-10-16T16:00:00+02:00' }, idopont_szoveg: 'October 16. (Friday) 16:00 - 17:20', level_datuma: iso(T0 - 3 * 86400_000) }));
    const u = ujUuid(); const b = hsLevel(u, { megjegyzes: MEGJ, szolgaltatas: HS_NEVEK[0], munkatarsak: ['Mirage Egyéni kezelő'] });
    await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.csere.allapot, r.csere.jeloltek.azonos_vendeg_szolgaltatas], ['halasztva', 'suspected', 0]);
    assert.equal(v.net.hivasok.length, 0, 'HOLD: 0 automatikus kuldes');
  }
});

test('S0-64 HeadSpa SZARAZ terv (irasmentes): a valodi PAROS / kuponos nevekkel a terv ures D1-valtozas nelkul adja a HeadSpa esemenyeket (DECISION #194: a kuponos foglalas NEM konverzio: a terv esemenyei uresek), 0 platformhivas', async () => {
  const hely = HOSTOK[HS_HOST];
  const osszesTabla = (v) => v.sql("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((r) => r.name); // MINDEN tabla (a meres_kapcsolo, a salonic_nevtabla is)
  const nevtabla = (v) => nevtablaMent(v.db, { helyek: [{ placeId: hely.placeId, nev: 'Mosaic Headspa' }], munkatarsak: [], szolgaltatasok: [{ placeId: hely.placeId, serviceId: '302999', nev: HS_PAROS }, { placeId: hely.placeId, serviceId: '303891', nev: HS_KUPON_PAROS }], arak: [{ placeId: hely.placeId, serviceId: '302999', ar: 53800 }, { placeId: hely.placeId, serviceId: '303891', ar: 53800 }] }, T0);
  const terv = async (mod) => {
    const v = vilag(); await v.kesz; await nevtabla(v);
    const u = ujUuid(); const b = hsLevel(u, mod); await lezar(v, b); v.t.set(SD_ELOTT);
    const tablak = osszesTabla(v); assert.ok(tablak.includes('meres_kapcsolo') && tablak.includes('salonic_nevtabla') && tablak.length >= 8, 'minden tabla benne van: ' + tablak.join(','));
    const elotte = dump(v, tablak);
    const r = await v.sd({ ...b, szaraz: true });
    assert.equal(dump(v, tablak), elotte, 'a szaraz terv MINDEN tablara irasmentes');
    assert.deepEqual(osszesTabla(v), tablak, 'a szaraz terv uj tablat sem hoz letre'); assert.equal(v.net.hivasok.length, 0, 'a szaraz terv nem hiv platformot');
    assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_id, null, 'nincs atvetel');
    return r;
  };
  { // uj vendeg, normal PAROS: FoglalasElso + Schedule ernyo, a nevtabla ara (exact)
    const r = await terv({ uj_vendeg: true });
    assert.deepEqual([r.allapot, r.terv.mod, r.terv.jelleg, r.terv.kupon, r.terv.ertek_minoseg, r.terv.ertek_forras], ['szaraz_terv', 'normal', 'elso', false, 'exact', 'szolgaltatas_lista']);
    assert.deepEqual(r.terv.terv_esemenyek.map((e) => [e.nev, e.tipus, e.ertek]), [['FoglalasElso', 'alap', 53800], ['Schedule', 'ernyo', 53800]]);
  }
  { // uj vendeg, kuponos PAROS ("(kupon)" jelzessel, mint az elo mail): DECISION #194: a kuponos foglalas nem konverzio -> a terv esemenyei uresek (nincs FoglalasElso, nincs ernyo)
    const r = await terv({ uj_vendeg: true, szolgaltatas: HS_ELO_KUPON(HS_KUPON_PAROS) });
    assert.deepEqual([r.terv.jelleg, r.terv.kupon, r.terv.ertek_minoseg], ['elso', true, 'unknown_discount']);
    assert.deepEqual(r.terv.terv_esemenyek, [], 'kuponos foglalas: nincs terv-esemeny');
  }
  { // visszatero vendeg: Visszajaro, ernyo nelkul
    const r = await terv({ uj_vendeg: false });
    assert.deepEqual([r.terv.jelleg, r.terv.terv_esemenyek.map((e) => e.nev)], ['visszajaro', ['Visszajaro']]);
  }
});

test('S0-65 HeadSpa sd kuldes valodi kuponos PAROS-szoveggel: csak ARNYEK-cel (0 elo azonosito), DECISION #194: a kuponos foglalas NEM konverzio: semmilyen platformra nem megy ki semmi (nincs meres_kuldes-sor, a jelentesek szabalyos nullanak veszik); a normal PAROS a nevtabla arat kuldi', async () => {
  const hely = HOSTOK[HS_HOST];
  const nevtabla = (v) => nevtablaMent(v.db, { helyek: [{ placeId: hely.placeId, nev: 'Mosaic Headspa' }], munkatarsak: [], szolgaltatasok: [{ placeId: hely.placeId, serviceId: '302999', nev: HS_PAROS }], arak: [{ placeId: hely.placeId, serviceId: '302999', ar: 53800 }] }, T0);
  const mind = (v) => JSON.stringify(v.net.hivasok);
  const eloAzonositok = [...ELO_CELOK.meta, ...ELO_CELOK.tiktok, ...ELO_CELOK.ga4, ...ELO_CELOK.google_primary];
  { // kuponos, uj vendeg (az eles mail szovegevel): DECISION #194: nem konverzio -> 0 platformhivas, 0 meres_kuldes-sor, az sd sor lezart ('kesz'), a kupon-jelzes a meres_jelleg-ben
    const { v, b } = await (async () => { const v = vilag(); await v.kesz; await nevtabla(v); const b = hsLevel(ujUuid(), { uj_vendeg: true, szolgaltatas: HS_ELO_KUPON(HS_KUPON_PAROS), munkatarsak: ['Páros kezelés'] }); await lezar(v, b); v.t.set(SD_ELOTT); return { v, b }; })();
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag, r.jelleg, r.kupon, r.ertek_minoseg], ['kesz', 'headspa', 'elso', true, 'unknown_discount']);
    assert.equal(r.esemeny_kuldes.allapot, 'nincs_esemeny'); assert.equal(r.esemeny_kuldes.kupon_nem_konverzio, true);
    assert.equal(v.net.hivasok.length, 0, 'kuponos foglalas: egyetlen platformra sem megy ki semmi');
    assert.deepEqual(hivasNev(v), []);
    assert.equal(szamol(v, 'meres_kuldes'), 0, 'nincs meres_kuldes-sor (sem alap, sem ernyo, sem kihagyva)');
    assert.deepEqual(v.sql('SELECT jelleg, kupon FROM meres_jelleg'), [{ jelleg: 'elso', kupon: 1 }], 'a kupon-jelzes a meres_jelleg-ben marad');
    assert.equal(v.sql('SELECT sd_allapot FROM foglalas_egyeztetes WHERE sd_id IS NOT NULL')[0].sd_allapot, 'kesz', 'az sd sor lezart (nincs elakadt / riasztott allapot)');
    assert.equal((await riasztasok(v)).length, 0, 'nincs riasztas');
  }
  { // normal PAROS, uj vendeg: a nevtabla ara, FoglalasElso + Schedule
    const v = vilag(); await v.kesz; await nevtabla(v);
    const b = hsLevel(ujUuid(), { uj_vendeg: true }); await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.ertek_minoseg, r.ertek_forras], ['kesz', 'exact', 'szolgaltatas_lista']);
    assert.deepEqual(hivasNev(v), ['meta:HeadSpa_FoglalasElso', 'tiktok:HeadSpa_FoglalasElso', 'meta:Schedule', 'tiktok:CompletePayment']);
    assert.ok(v.net.hivasok.filter((h) => h.kulcs === 'meta').every((h) => h.body.data[0].custom_data.value === 53800));
    for (const id of eloAzonositok) assert.ok(!mind(v).includes(id), 'nincs elo azonosito: ' + id);
  }
});


test('FO-3 ujraMezok: 48 oras kor alatt ujra_mp (60..900 mp) + ujra_ig_mp + ok_kod; 48 ora felett csak ok_kod (nincs mit ismetelni)', () => {
  assert.deepEqual(ujraMezok(1300, 400, 'x'), { ujra_mp: 400, ujra_ig_mp: 48 * 3600 - 1300, ok_kod: 'x' });
  assert.equal(ujraMezok(1300, 5, 'x').ujra_mp, 60, 'also hatar');
  assert.equal(ujraMezok(1300, 5000, 'x').ujra_mp, SD_UJRA_MP, 'plafon 15 perc');
  assert.deepEqual(ujraMezok(48 * 3600 + 1, 400, 'x'), { ok_kod: 'x' });
});
