// DECISION #195 / 3 (a meresi oldal 6243023279 + a Drive DECISION-LOG "## #195"; #98: az ertek a valos ar): a salonic_direct PMU konverzio, amelynek TENYLEGES ara ismeretlen (`unknown_price`), NEM megy ki ertek nelkul - OFFLINE TESZTEK
//   node --test tools/test-sd-195.mjs
// Valodi SQLite (node:sqlite) D1-hej, hamis halozat, hamis ora (tools/lib-sd-teszt.mjs); SEMMI nem megy ki a halozatra, nincs titok.
//   H1  PMU Visszajaro ismeretlen ar -> HOLD: 4 cella `halasztva` (pmu_unknown_price), ertek NULL, 0 platformhivas, sor `tartva` + riasztas, napi szamlalo (lepes_szamlalo: pmu / meres_hold / unknown_price) = 1
//   H2  PMU uj vendeg (FoglalasElso + Schedule): mind a 8 cella HOLD, 0 platformhivas
//   H3  az ujrafuttatas (meg mindig ismeretlen ar) nem noveli a szamlalot; a HOLD marad
//   H4  FELOLDAS: az ar kesobb ismert (nevtabla) -> ugyanannak az sd_atvetelnek az ismetelt hivasa a halasztott cellakat az igazi arral kuldi (Meta / TikTok value), ertek_minoseg=exact, a sor `kesz`, a szamlalo valtozatlan
//   H5  az sd-riasztas tipusa `pmu_ar_ismeretlen` (nem az `elo_allapot_nem_ellenorizheto`); a feloldas utan megszunik
//   H6  valtozatlan: Korrekcio 0 Ft exact, ismert Zap-ar, lista-ar, PMU konzultacio (rogzitett tabla-ertek) - kimegy, nincs HOLD, nincs szamlalo
//   H7  HATOKOR: oxigen / fodrasz / szor uzletag ismeretlen ara VALTOZATLANUL ertek nelkul megy (D5); a PMU unknown_discount is
//   H8  a szaraz terv jelzi a HOLD-ot, de irasmentes (a szamlalo sem nő), 0 halozat
//   H9  a szamlalo hibaja / hianya nem akadalyozza a HOLD-ot; reschedule / hianyzo_mezo HOLD elsobbsege (nincs ketszeres szamlalas)
//   H10 az elosztas ujraprobalo UPDATE-je frissiti az ertek_minoseg-et (COALESCE: a null a meglevot nem irja felul)
import test from 'node:test';
import assert from 'node:assert/strict';
import { elosztas } from '../netlify/lib/meres/elosztas.js';
import { PMU_AR_HOLD_INDOK, PMU_AR_HOLD_JELLEGEK, arFrissitesNullaz, pmuArHold } from '../netlify/lib/meres/salonic-direct.js';
import { nevtablaMent } from '../netlify/lib/foglalas-kulcs.js';
import { ENV_ALAP, T0, d1, level, lezar, ujUuid, vilag } from './lib-sd-teszt.mjs';

const SD_ELOTT = T0 + 1300_000;
const PMU_HOST = 'mosaic-pmu.salonic.hu';
const PMU_PLACE = 14585;
const SZAMLALO_SEMA = "CREATE TABLE lepes_szamlalo (nap TEXT NOT NULL, uzletag TEXT NOT NULL, lepes TEXT NOT NULL, tipus TEXT NOT NULL DEFAULT '', db INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (nap, uzletag, lepes, tipus)) WITHOUT ROWID;";
const szamlaloVilag = () => { const sz = d1(); sz.db.exec(SZAMLALO_SEMA); return { sz, db: { prepare: sz.prepare, batch: sz.batch } }; };
const holdSzamlalo = (sz) => sz.db.prepare("SELECT nap, uzletag, lepes, tipus, db FROM lepes_szamlalo WHERE lepes = 'meres_hold'").all().map((r) => ({ ...r }));
const cellak = (v) => v.sql('SELECT esemeny_nev, esemeny_tipus, platform, allapot, indok, ertek, penznem, ertek_minoseg, probalkozas FROM meres_kuldes ORDER BY id');
const pmuNevtabla = (v, szolgaltatasok, arak) => nevtablaMent(v.db, { helyek: [{ placeId: PMU_PLACE, nev: 'Mosaic PMU' }], munkatarsak: [], szolgaltatasok: szolgaltatasok.map(([id, nev]) => ({ placeId: PMU_PLACE, serviceId: String(id), nev })), arak: arak.map(([id, ar]) => ({ placeId: PMU_PLACE, serviceId: String(id), ar })) }, T0);
/** Egy PMU sd-jelolt: 4 motoros proba (parositatlan), az ora a Zap 5. lepesenel; `ar` nincs (ismeretlen ar), kivetel, ha a mod megadja. */
async function pmuJelolt(opt = {}, mod = {}) {
  arFrissitesNullaz();
  const szamlalo = szamlaloVilag();
  const v = vilag({ kapcsolo: 'pmu', env: opt.szamlalo === false ? {} : { SZAMLALO_DB: opt.szamlaloDb || szamlalo.db } }); await v.kesz;
  const u = ujUuid(); const b = level(u, { host: PMU_HOST, felado: 'Mosaic PMU', szolgaltatas: 'Szemöldök tetoválás Soft powder', uj_vendeg: false, ar: undefined, ...mod });
  await lezar(v, b); v.t.set(SD_ELOTT);
  return { v, u, b, sz: szamlalo.sz };
}
const HOLD_CELLA = (c) => c.allapot === 'halasztva' && /^pmu_unknown_price: HOLD/.test(c.indok) && c.ertek === null;

test('H1 PMU Visszajaro, ismeretlen ar -> HOLD: 4 cella halasztva (ertek NULL), 0 platformhivas, sor tartva + riasztas, szamlalo pmu/meres_hold/unknown_price = 1', async () => {
  const { v, b, sz } = await pmuJelolt();
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.sd_allapot, r.jelleg, r.ertek_minoseg, r.riasztas], ['tartva', 'tartva', 'visszajaro', 'unknown_price', true], JSON.stringify(r).slice(0, 500));
  const c = cellak(v);
  assert.deepEqual(c.map((x) => `${x.esemeny_nev}/${x.platform}`), ['Visszajaro/meta', 'Visszajaro/tiktok', 'Visszajaro/google', 'Visszajaro/ga4']);
  assert.ok(c.every(HOLD_CELLA), JSON.stringify(c));
  assert.ok(c.every((x) => x.ertek_minoseg === 'unknown_price'));
  assert.equal(v.net.hivasok.length, 0, 'ertek nelkul semmi nem megy ki semmilyen platformra');
  assert.deepEqual(r.esemeny_kuldes.esemenyek[0].ertek, null);
  assert.deepEqual(r.ar_hold, { hold: true, szamlalo: 'pmu.unknown_price', szamlalo_irva: true });
  assert.deepEqual(holdSzamlalo(sz).map((x) => [x.uzletag, x.lepes, x.tipus, x.db]), [['pmu', 'meres_hold', 'unknown_price', 1]]);
  assert.equal(holdSzamlalo(sz)[0].nap, '2026-10-06', 'a nap budapesti datum');
  assert.equal(v.sql("SELECT sd_allapot, riasztas FROM foglalas_egyeztetes WHERE sd_id IS NOT NULL")[0].sd_allapot, 'tartva');
});

test('H2 PMU uj vendeg (FoglalasElso + Schedule ernyo), ismeretlen ar -> mind a 8 cella HOLD, 0 platformhivas, szamlalo 1', async () => {
  const { v, b, sz } = await pmuJelolt({}, { uj_vendeg: true });
  const r = await v.sd(b);
  assert.deepEqual([r.sd_allapot, r.jelleg], ['tartva', 'elso']);
  const c = cellak(v);
  assert.deepEqual([...new Set(c.map((x) => x.esemeny_nev))].sort(), ['FoglalasElso', 'Schedule']);
  assert.equal(c.length, 8); assert.ok(c.every(HOLD_CELLA), JSON.stringify(c));
  assert.equal(v.net.hivasok.length, 0);
  assert.deepEqual(holdSzamlalo(sz).map((x) => x.db), [1], 'foglalasonkent EGYSZER (nem esemenyenkent / cellankent)');
});

test('H3 az ujrafuttatas (meg mindig ismeretlen ar): a HOLD marad, a szamlalo NEM no, nincs kuldes', async () => {
  const { v, b, sz } = await pmuJelolt();
  await v.sd(b);
  for (let i = 0; i < 3; i++) { v.t.tick(30); const r = await v.sd(b); assert.equal(r.sd_allapot, 'tartva', `${i + 1}. ujrafuttatas`); assert.equal(r.ar_hold.szamlalo_irva, false, 'mar szamolt'); }
  assert.deepEqual(holdSzamlalo(sz).map((x) => x.db), [1]);
  assert.ok(cellak(v).every(HOLD_CELLA)); assert.equal(v.net.hivasok.length, 0);
  // egy MASIK foglalas ugyanazon a napon: a szamlalo napi osszesites (2)
  const u2 = ujUuid(); const b2 = level(u2, { host: PMU_HOST, felado: 'Mosaic PMU', szolgaltatas: 'Szemöldök tetoválás Soft powder', uj_vendeg: false, ar: undefined });
  await lezar(v, b2); v.t.set(SD_ELOTT); await v.sd(b2);
  assert.deepEqual(holdSzamlalo(sz).map((x) => x.db), [2]);
});

test('H4 FELOLDAS: az ar kesobb ismert (nevtabla) -> az ismetelt sd_atvetel a halasztott cellakat az igazi arral kuldi (exact), a sor kesz, a szamlalo valtozatlan', async () => {
  const { v, b, sz } = await pmuJelolt();
  assert.equal((await v.sd(b)).sd_allapot, 'tartva');
  assert.equal(v.net.hivasok.length, 0);
  // a nevtabla kiegeszul (a #402 celzott frissitese / a napi frissites): a PMU szolgaltatas es ara
  await pmuNevtabla(v, [[900001, 'Szemöldök tetoválás Soft powder']], [[900001, 99000]]);
  v.t.tick(60);
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.sd_allapot, r.ertek_minoseg, r.ertek_forras, r.riasztas], ['kesz', 'kesz', 'exact', 'szolgaltatas_lista', false], JSON.stringify(r).slice(0, 500));
  const c = cellak(v);
  assert.deepEqual(c.map((x) => `${x.platform}/${x.allapot}`), ['meta/elkuldve', 'tiktok/elkuldve', 'google/kihagyva', 'ga4/kihagyva']);
  assert.ok(c.every((x) => x.ertek === 99000 && x.ertek_minoseg === 'exact'), 'az ertek es a minoseg frissult: ' + JSON.stringify(c));
  assert.ok(c.every((x) => x.indok === null || !/pmu_unknown_price/.test(x.indok)), 'a HOLD-indok eltunt');
  assert.equal(v.net.hivasok.length, 2);
  const meta = v.net.hivasok.find((h) => h.kulcs === 'meta').body.data[0];
  assert.deepEqual([meta.custom_data.value, meta.custom_data.currency, meta.custom_data.ertek_minoseg], [99000, 'HUF', 'exact']);
  assert.equal(v.net.hivasok.find((h) => h.kulcs === 'tiktok').body.data[0].properties.value, 99000);
  assert.deepEqual(holdSzamlalo(sz).map((x) => x.db), [1], 'a feloldas nem szamol');
  // a feloldott sor ujabb hivasra idempotens: nincs ujrakuldes
  v.t.tick(30); const m = await v.sd(b); assert.equal(m.sd_allapot, 'kesz'); assert.equal(v.net.hivasok.length, 2);
});

test('H4b a feloldas a 48 oras kapun belul megy; 48 ora utan az ismetelt hivas lejart (nincs automatikus kuldes)', async () => {
  const { v, b } = await pmuJelolt();
  assert.equal((await v.sd(b)).sd_allapot, 'tartva');
  await pmuNevtabla(v, [[900001, 'Szemöldök tetoválás Soft powder']], [[900001, 99000]]);
  v.t.set(T0 + 49 * 3600_000);
  const r = await v.sd(b);
  assert.equal(r.sd_allapot, 'lejart'); assert.equal(v.net.hivasok.length, 0);
  assert.ok(cellak(v).every(HOLD_CELLA), 'a cellak HOLD-ban maradnak (ember dont)');
});

test('H5 az sd-riasztas tipusa pmu_ar_ismeretlen (nem elo_allapot_nem_ellenorizheto), a feloldas utan megszunik', async () => {
  const { v, u, b } = await pmuJelolt();
  await v.sd(b);
  const lista = (await v.get('sd_riasztas=1')).lista.filter((x) => x.uuid === u);
  assert.deepEqual(lista.map((x) => [x.tipus, x.sd_allapot]), [['pmu_ar_ismeretlen', 'tartva']]);
  assert.match(lista[0].ok, /DECISION #195.*ara ismeretlen/);
  await pmuNevtabla(v, [[900001, 'Szemöldök tetoválás Soft powder']], [[900001, 99000]]);
  v.t.tick(60); await v.sd(b);
  assert.deepEqual((await v.get('sd_riasztas=1')).lista.filter((x) => x.uuid === u), []);
  // kontroll: az elo allapot nem ellenorizheto -> tartva a regi tipussal (S0-06 mintaja: a foglalas-allapot lekeres hibazik)
  const k = await pmuJelolt({}, { ar: 25000 });
  k.v.net.allapot.set(k.u, 'hiba');
  const rk = await k.v.sd(k.b); assert.equal(rk.sd_allapot, 'tartva');
  assert.deepEqual((await k.v.get('sd_riasztas=1')).lista.filter((x) => x.uuid === k.u).map((x) => x.tipus), ['elo_allapot_nem_ellenorizheto']);
});

test('H6 valtozatlan: Korrekcio 0 Ft exact, ismert Zap-ar, lista-ar, PMU konzultacio (rogzitett tabla-ertek) - kimegy, nincs HOLD, nincs szamlalo', async () => {
  const esetek = [
    ['Korrekció', {}, 'korrekcio_az_arban', 0],
    ['Szemöldök tetoválás Soft powder', { ar: 88000 }, 'zap_ar', 88000],
    ['Szemöldök tetoválás Soft powder', { nevtabla: true }, 'szolgaltatas_lista', 99000],
  ];
  for (const [szolg, mod, forras, ertek] of esetek) {
    const { nevtabla, ...level_mod } = mod;
    const { v, b, sz } = await pmuJelolt({}, { szolgaltatas: szolg, ...level_mod });
    if (nevtabla) await pmuNevtabla(v, [[900001, szolg]], [[900001, 99000]]);
    const r = await v.sd(b);
    assert.deepEqual([r.sd_allapot, r.ertek_minoseg, r.ertek_forras], ['kesz', 'exact', forras], `${szolg} ${JSON.stringify(mod)}`);
    assert.equal(v.net.hivasok.length, 2, 'Meta + TikTok kimegy');
    assert.equal(v.net.hivasok.find((h) => h.kulcs === 'meta').body.data[0].custom_data.value, ertek);
    assert.ok(cellak(v).every((x) => !/pmu_unknown_price/.test(x.indok || '')));
    assert.deepEqual(holdSzamlalo(sz), [], 'nincs HOLD-szamlalo');
  }
  // PMU konzultacio: ar nelkul is a rogzitett tabla-ertek (13 800 Ft), exact
  const k = await pmuJelolt({}, { szolgaltatas: 'PMU konzultáció', uj_vendeg: true });
  const r = await k.v.sd(k.b);
  assert.deepEqual([r.sd_allapot, r.jelleg, r.ertek_minoseg], ['kesz', 'konzultacio', 'exact'], JSON.stringify(r).slice(0, 300));
  assert.ok(k.v.net.hivasok.length > 0);
  assert.equal(k.v.net.hivasok.find((h) => h.kulcs === 'meta').body.data[0].custom_data.value, 13800);
  assert.deepEqual(holdSzamlalo(k.sz), []);
});

test('H7 HATOKOR: oxigen / fodrasz / szor ismeretlen ara VALTOZATLANUL ertek nelkul megy (D5, #131); a PMU unknown_discount (kedvezmeny-gyanu) is', async () => {
  const hostok = [['mosaic-oxigen.salonic.hu', 'Mosaic Oxigen'], ['mosaic-hair.salonic.hu', 'Mosaic Hair'], ['mosaic-elysion.salonic.hu', 'Mosaic Elysion']];
  for (const [host, felado] of hostok) {
    arFrissitesNullaz();
    const sz = szamlaloVilag();
    const v = vilag({ env: { SZAMLALO_DB: sz.db } }); await v.kesz;
    const u = ujUuid(); const b = level(u, { host, felado, szolgaltatas: 'Ismeretlen ar nelkuli szolgaltatas', uj_vendeg: false, ar: undefined });
    await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    assert.deepEqual([r.sd_allapot, r.ertek_minoseg, r.ertek_forras], ['kesz', 'unknown_price', 'nincs_ar'], `${host}: ${JSON.stringify(r).slice(0, 300)}`);
    const meta = v.net.hivasok.find((h) => h.kulcs === 'meta');
    assert.ok(meta, `${host}: Meta kimegy (D5: ertek nelkul)`);
    assert.ok(!('value' in meta.body.data[0].custom_data), `${host}: ertek nelkul`);
    assert.ok(cellak(v).every((x) => !/pmu_unknown_price/.test(x.indok || '')));
    assert.deepEqual(holdSzamlalo(sz.sz), []);
  }
  // PMU kedvezmeny-gyanu (munkatars-cimke): unknown_discount -> ertek nelkul megy (a #131 szerint), NEM HOLD
  { const { v, b, sz } = await pmuJelolt({}, { munkatarsak: ['Teszt Mester (kedvezmény)'] });
    const r = await v.sd(b);
    assert.deepEqual([r.sd_allapot, r.ertek_minoseg], ['kesz', 'unknown_discount']);
    assert.ok(!('value' in v.net.hivasok.find((h) => h.kulcs === 'meta').body.data[0].custom_data));
    assert.deepEqual(holdSzamlalo(sz), []); }
  // a hatokor-fuggveny
  assert.deepEqual(PMU_AR_HOLD_JELLEGEK, ['elso', 'visszajaro']);
  for (const uzletag of ['headspa', 'fodrasz', 'oxigen', 'szor']) for (const jelleg of ['elso', 'visszajaro', 'konzultacio']) assert.equal(pmuArHold(uzletag, jelleg, 'unknown_price'), false, `${uzletag}/${jelleg}`);
  assert.equal(pmuArHold('pmu', 'konzultacio', 'unknown_price'), false);
  for (const minoseg of ['exact', 'unknown_discount']) assert.equal(pmuArHold('pmu', 'elso', minoseg), false, minoseg);
  assert.equal(pmuArHold('pmu', 'elso', 'unknown_price'), true); assert.equal(pmuArHold('pmu', 'visszajaro', 'unknown_price'), true);
});

test('H8 a szaraz terv jelzi a HOLD-ot, de irasmentes (a szamlalo sem no), 0 halozat; az eles hivas utana megy', async () => {
  const { v, b, sz } = await pmuJelolt();
  const tablak = v.sql("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((t) => t.name);
  const dump = () => JSON.stringify(tablak.map((t) => v.sql(`SELECT * FROM ${t}`)));
  const elotte = dump();
  const r = await v.sd({ ...b, szaraz: true });
  assert.equal(r.allapot, 'szaraz_terv');
  assert.deepEqual(r.terv.ar_hold, { hold: true, szamlalo: 'pmu.unknown_price', szamlalo_irva: false });
  assert.deepEqual([r.terv.fix_allapot.allapot, r.terv.fix_allapot.indok], ['halasztva', PMU_AR_HOLD_INDOK]);
  assert.ok(r.terv.terv_esemenyek.every((e) => e.ertek === null), 'a terv sem mutat erteket');
  assert.equal(dump(), elotte); assert.equal(v.net.hivasok.length, 0); assert.deepEqual(holdSzamlalo(sz), []);
  assert.equal((await v.sd(b)).sd_allapot, 'tartva', 'a szaraz hivas utan az eles atvetel szabad');
});

test('H9 a szamlalo hibaja / hianya nem akadalyozza a HOLD-ot; a reschedule / hianyzo_mezo HOLD elsobbseget elvez (nincs ketszeres szamlalas)', async () => {
  // szamlalo-kotes nelkul
  { const { v, b } = await pmuJelolt({ szamlalo: false });
    const r = await v.sd(b);
    assert.equal(r.sd_allapot, 'tartva'); assert.deepEqual(r.ar_hold, { hold: true, szamlalo: 'pmu.unknown_price', szamlalo_irva: false });
    assert.ok(cellak(v).every(HOLD_CELLA)); assert.equal(v.net.hivasok.length, 0); }
  // hibazo szamlalo
  { const hibas = { prepare: () => { throw new Error('d1 down'); }, batch: async () => { throw new Error('d1 down'); } };
    const { v, b } = await pmuJelolt({ szamlaloDb: hibas });
    const r = await v.sd(b);
    assert.equal(r.sd_allapot, 'tartva'); assert.equal(r.ar_hold.szamlalo_irva, false);
    assert.ok(cellak(v).every(HOLD_CELLA)); assert.equal(v.net.hivasok.length, 0); }
  // hianyzo `megjegyzes` kulcs (csere-felismeres vak) + ismeretlen ar: a hianyzo_mezo HOLD marad az uralkodo, a PMU-szamlalo nem no
  { const { v, b, sz } = await pmuJelolt();
    const { megjegyzes: _el, ...mjNelkul } = b;
    const r = await v.sd(mjNelkul);
    assert.equal(r.sd_allapot, 'halasztva', JSON.stringify(r).slice(0, 300));
    const c = cellak(v); assert.ok(c.length > 0 && c.every((x) => x.allapot === 'halasztva' && /^hianyzo_mezo: HOLD/.test(x.indok)), JSON.stringify(c));
    assert.equal(v.net.hivasok.length, 0); assert.deepEqual(holdSzamlalo(sz), []); assert.equal(r.ar_hold, undefined); }
});

test('H10 az elosztas ujraprobalo UPDATE-je frissiti az ertek_minoseg-et (a PMU HOLD feloldasa utan exact); a nincs-minoseg (motor) a meglevot nem irja felul (COALESCE)', async () => {
  const D = d1(); const hivasok = [];
  const deps = { env: { ...ENV_ALAP }, fetchImpl: async (u, o) => { hivasok.push(u); return { status: 200, text: async () => '{}' }; }, now: () => T0, kuldo: async () => ({ allapot: 'elkuldve', http_status: 200, valasz: '{}', kuldo: 'teszt' }) };
  const fk = { tipus: 'foglalas', uzletag: 'pmu', source_entity_id: 'sd_aaaaaaaaaaaaaaaaaaaaaaaa', jelleg: 'visszajaro', kupon: false, ertek: 0, ido: 1_790_000_000, forras: 'salonic_direct', ertek_minoseg: 'unknown_price' };
  await elosztas(D, { ...fk, fixAllapot: { allapot: 'halasztva', indok: PMU_AR_HOLD_INDOK } }, deps);
  const sorok = () => D.db.prepare('SELECT platform, allapot, ertek, ertek_minoseg FROM meres_kuldes ORDER BY id').all().map((r) => ({ ...r }));
  assert.ok(sorok().every((s) => s.allapot === 'halasztva' && s.ertek_minoseg === 'unknown_price'));
  // ujraprobalas minoseg NELKUL (motor-szeru hivas): a meglevo minoseg marad
  const { ertek_minoseg: _q, ...minosegNelkul } = fk;
  await elosztas(D, { ...minosegNelkul, ertek: 5000, fixAllapot: { allapot: 'halasztva', indok: PMU_AR_HOLD_INDOK } }, deps);
  assert.ok(sorok().every((s) => s.ertek_minoseg === 'unknown_price'), 'COALESCE: a null nem irja felul: ' + JSON.stringify(sorok()));
  // ujraprobalas exact minoseggel es igazi arral: kimegy, a minoseg es az ertek frissul
  await elosztas(D, { ...fk, ertek: 5000, ertek_minoseg: 'exact' }, deps);
  const v = sorok();
  assert.ok(v.filter((s) => s.platform === 'meta' || s.platform === 'tiktok').every((s) => s.allapot === 'elkuldve' && s.ertek === 5000 && s.ertek_minoseg === 'exact'), JSON.stringify(v));
  assert.ok(v.every((s) => s.ertek_minoseg === 'exact'));
});
