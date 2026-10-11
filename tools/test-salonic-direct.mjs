// SALONIC-DIRECT SAFETY NET (DECISION #127 (b), #130, #131) - S0 OFFLINE TESZTEK
//   node --test tools/test-salonic-direct.mjs
// Valodi SQLite (node:sqlite) a D1 helyett, a Salonic mentett valodi oldalai (UUID-cserevel), hamis platform-halozat, hamis ora. SEMMI nem megy ki a halozatra, nincs titok.
// S0-01..S0-23 = a GPT altal jovahagyott 23 eset (terv v2); S0-24.. = kiegeszito vedelmek (hash-index, szaraz terv, alias, riasztasok, riport, admin).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { BUSINESSES } from '../assets/js/booking-engine/salonic-adapter.js';
import { HOSTOK, kulcsIras, nevtablaMent } from '../netlify/lib/foglalas-kulcs.js';
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { cellaOsztaly } from '../netlify/lib/meres/egyeztetes-sor.js';
import { irasKapcsolo } from '../netlify/lib/meres/iras-kapcsolo.js';
import { kapcsoloBeallit } from '../netlify/lib/meres/elosztas.js';
import { kezelAdmin } from '../netlify/lib/meres/vegpontok.js';
import { CSERE_GYANU, csereGyanu, megjegyzesIdopontok, mutatEgyre, nevNorm, sdIdentitas, sdKapcsolo, szolgKanon, vendegHash, azonosVendeg, SD_MIN_KOR_MP } from '../netlify/lib/meres/salonic-direct.js';
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
  assert.equal(Object.keys(kep.kerelmek).length, 468);
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
  for (const tiltott of ['teszt.claude', 'example.com', '942 0090', '709420090', '36709420090', 'Teszt Claude', 'teszt claude', 'csendes sarkot']) assert.ok(!mind.toLowerCase().includes(tiltott.toLowerCase()), 'nyers adat a D1-ben: ' + tiltott);
  const keresek = JSON.stringify([...v.sql('SELECT kerelem, platform_valasz, indok, attr_jelek FROM meres_kuldes'), ...v.net.hivasok]);
  for (const tiltott of ['teszt.claude', 'example.com', '942 0090', 'Teszt Claude', u, u.toUpperCase()]) assert.ok(!keresek.includes(tiltott), 'nyers adat a kerelemben: ' + tiltott);
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
  const v = vilag(); await v.kesz;
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
  const h1 = await vendegHash(SD_ENV, VENDEG, NEV), h2 = await vendegHash(SD_ENV, { email: ' TESZT.Claude@Example.com ', telefon: '06 70 942 0090' }, 'claude teszt');
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
  for (const tiltott of ['teszt.claude', 'example.com', '942 0090', 'Teszt Claude', 'korábbi foglalásom', 'csendes']) assert.ok(!mind.includes(tiltott), tiltott);
  assert.ok(!/"ip"|203\.0\.113/.test(mind), 'az IP nem kerul a riportba');
});

test('S0-33 wrangler.toml: a MERES_SALONIC_DIRECT kapu CSAK az elonezeti valtozok kozott van (az eles [vars] nem kapja meg a go-live-ig); a titkok nincsenek a kodban', () => {
  const toml = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const elo = toml.slice(0, toml.indexOf('[env.preview.vars]')), elonezet = toml.slice(toml.indexOf('[env.preview.vars]'), toml.indexOf('[[kv_namespaces]]', toml.indexOf('[env.preview.vars]')));
  for (const kulcs of ['MERES_SALONIC_DIRECT', 'MERES_SD_INDEX', 'MERES_SD_NS']) assert.ok(!new RegExp(`^${kulcs}\\s*=`, 'm').test(elo), `${kulcs} nem lehet az eles [vars]-ban`);
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
  for (const m of ['korabban volt 15:00, de 17:00 jobb', 'Korábban foglaltam, de változott', 'Áthelyeztem az időpontomat', 'Az előző foglalásom helyett', 'Rescheduled from earlier']) assert.ok(csereGyanu(m), m);
  for (const m of ['Kerem a csendes sarkot', 'Szeretnék egy későbbi időpontot', 'Már foglaltam 16 órára']) assert.ok(!csereGyanu(m), m);
});

test('S0-44 a csere-feloldas KIZAROLAG az sd_feloldas muveletbol johet: egy sd_atvetel torzsebe csempeszett `feloldas` objektum eldobodik', async () => {
  const { v, b } = await jelolt({}, { megjegyzes: 'A korabbi 16 oras foglalas helyett', uj_vendeg: false });
  assert.equal((await v.sd(b)).sd_allapot, 'halasztva');
  const r = await v.sd({ ...b, feloldas: { dontes: 'uj_konverzio', ok: 'csempeszett' } });
  assert.equal(r.sd_allapot, 'halasztva'); assert.equal(v.net.hivasok.length, 0, 'a torzsbe csempeszett feloldas nem hajtodik vegre');
  const f = await v.post({ ...b, muvelet: 'sd_feloldas', dontes: 'uj_konverzio', ok: 'ember dontott' });
  assert.equal(f.sd_allapot, 'feloldva_uj'); assert.equal(v.net.hivasok.length, 2, 'az igazi sd_feloldas (ember) tovabbra is mukodik');
});
