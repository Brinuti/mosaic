// DECISION #194 (Feri, 2026-10-17; meresi oldal #167): a KUPONOS (ajandekkartyas) foglalas NEM konverzio + N1 szukites + a PMU sd `Visszajaro` ertek - OFFLINE TESZTEK
//   node --test tools/test-sd-194.mjs
// Valodi SQLite (node:sqlite) D1-hej, hamis halozat, hamis ora (tools/lib-sd-teszt.mjs); SEMMI nem megy ki a halozatra, nincs titok.
//   K*  : kupon -> nincs esemeny (modell, elosztas, jelentesek); az ajandekkartya VASARLASA es a normal foglalas valtozatlan
//   P*  : PMU "Korrekcio" (ar nelkuli lista-tetel) = 0 Ft exact; PMU nevtabla celzott frissitese (hamis frissito), throttle, fail-closed
//   (N1: a kuponos <-> normal par nem csere-jelolt - az S0-63 / HS-02 teszt fedi, lasd lent)
import test from 'node:test';
import assert from 'node:assert/strict';
import { esemenyek, foglalasJelleg } from '../netlify/lib/meres/esemeny-modell.js';
import { elosztas } from '../netlify/lib/meres/elosztas.js';
import { sorEpit } from '../netlify/lib/meres/egyeztetes-sor.js';
import { NEVTABLA_AR_FRISSIT_MP, arFeloldas, arFrissitesNullaz } from '../netlify/lib/meres/salonic-direct.js';
import { HOSTOK, nevtablaBetolt, nevtablaMent } from '../netlify/lib/foglalas-kulcs.js';
import { ENV_ALAP, T0, d1, level, lezar, ujUuid, vilag } from './lib-sd-teszt.mjs';

const UZLETAGOK = ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu'];
const BID = 'mb_aaaaaaaaaaaaaaaaaa';
const fk = (mod = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: BID, jelleg: 'elso', kupon: false, ertek: 26900, ido: 1_790_000_000, ...mod });
const SD_ELOTT = T0 + 1300_000;
const PMU_HOST = 'mosaic-pmu.salonic.hu';
const PMU_PLACE = 14585;

// ---------- K: kupon -> nincs esemeny ----------
test('K1 az esemenyek(): a KUPONOS foglalas MINDEN uzletagon es jelleggel ures lista (alapesemeny, ernyo, Google egyarant); a normal foglalas valtozatlan', () => {
  for (const uzletag of UZLETAGOK) for (const jelleg of ['elso', 'konzultacio', 'visszajaro']) {
    assert.deepEqual(esemenyek(fk({ uzletag, jelleg, kupon: true })), [], `${uzletag}/${jelleg}: kupon -> nincs esemeny`);
    if (jelleg !== 'konzultacio') assert.ok(esemenyek(fk({ uzletag, jelleg, kupon: false })).length > 0, `${uzletag}/${jelleg}: kupon nelkul van esemeny (ellenpelda)`);
  }
  // a normal foglalas alap + ernyo valtozatlan (HeadSpa elso: FoglalasElso + Schedule)
  assert.deepEqual(esemenyek(fk()).map((e) => e.nev), ['FoglalasElso', 'Schedule']);
  // az ajandekkartya VASARLASA (nem foglalas) a kupon-jelzessel is konverzio marad
  const ak = esemenyek({ tipus: 'ajandekkartya', uzletag: 'headspa', source_entity_id: 'pi_3abcdefghijklmnop', ertek: 20000, kupon: true, ido: 1_790_000_000 });
  assert.ok(ak.some((e) => e.nev === 'Ajandekkartya'), 'az Ajandekkartya vasarlas nem erintett');
});

test('K2 a foglalasJelleg kupon-jelzese a kuponos szolgaltatasnevbol (KUPONKODDAL elotag / (kupon) utotag / kategoria) -> esemenyek ures; a "kupon" szo nelkuli nev nem kuponos', () => {
  for (const nev of ['KUPONKÓDDAL - 💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés', 'Head Spa kezelés (kupon)']) {
    const j = foglalasJelleg({ szolgaltatasNev: nev, ujVendeg: true, kategoria: '' });
    assert.equal(j.kupon, true, nev);
    assert.deepEqual(esemenyek(fk({ jelleg: j.jelleg, kupon: j.kupon })), [], nev);
  }
  assert.equal(foglalasJelleg({ szolgaltatasNev: '💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés', ujVendeg: true, kategoria: '' }).kupon, false);
});

test('K3 az elosztas(): kuponos foglalas -> nincs_esemeny + kupon_nem_konverzio, 0 meres_kuldes sor, 0 halozati hivas; normal foglalas -> sorok (ellenpelda)', async () => {
  const D = d1(); const hivasok = [];
  const deps = { env: { ...ENV_ALAP }, fetchImpl: async (u) => { hivasok.push(u); return { status: 200, text: async () => '{}' }; }, now: () => T0 };
  const r = await elosztas(D, fk({ kupon: true }), deps);
  assert.deepEqual([r.allapot, r.kupon_nem_konverzio], ['nincs_esemeny', true]);
  assert.match(r.miert, /DECISION #194/);
  assert.equal(D.db.prepare('SELECT COUNT(*) AS n FROM meres_kuldes').get().n, 0); assert.equal(hivasok.length, 0);
  // az ismeretlen forras-entitas (nem kupon) tovabbra is "nem kepezheto esemeny", kupon_nem_konverzio jel nelkul
  const x = await elosztas(D, fk({ source_entity_id: 'nem-azonosito' }), deps);
  assert.equal(x.allapot, 'nincs_esemeny'); assert.equal(x.kupon_nem_konverzio, undefined); assert.match(x.miert, /nem kepezheto/);
  // normal foglalas: sorok keletkeznek
  const n = await elosztas(D, fk(), deps);
  assert.notEqual(n.allapot, 'nincs_esemeny'); assert.ok(D.db.prepare('SELECT COUNT(*) AS n FROM meres_kuldes').get().n > 0);
});

test('K4 az egyeztetosor (sorEpit): a kuponos, esemeny nelkuli foglalas NEM kap nincs_esemeny / parositatlan jelzest (kupon_nem_konverzio = true); a nem kuponos, esemeny nelkuli sor igen; ha a kuponos foglalasnak (regi sor) van esemenye, a jel false', () => {
  const egy = { allapot: 'kesz', kuldve: 1700000000, probalkozas: 1, kulcs_forras: 'level' };
  const kupon = sorEpit({ booking_id: BID, egyeztetes: egy, jelleg: { jelleg: 'elso', kupon: 1, forras: 'elso_level' }, kuldesek: [] });
  assert.equal(kupon.kupon_nem_konverzio, true); assert.ok(!kupon.jelzesek.includes('nincs_esemeny'), JSON.stringify(kupon.jelzesek));
  const normal = sorEpit({ booking_id: BID, egyeztetes: egy, jelleg: { jelleg: 'elso', kupon: 0, forras: 'elso_level' }, kuldesek: [] });
  assert.equal(normal.kupon_nem_konverzio, false); assert.ok(normal.jelzesek.includes('nincs_esemeny'));
  const jellegNelkul = sorEpit({ booking_id: BID, egyeztetes: egy, jelleg: null, kuldesek: [] });
  assert.equal(jellegNelkul.kupon_nem_konverzio, false); assert.ok(jellegNelkul.jelzesek.includes('nincs_esemeny'));
  const regiKuponosVanEsemeny = sorEpit({ booking_id: BID, egyeztetes: egy, jelleg: { jelleg: 'elso', kupon: 1, forras: 'meglevo_sorok' },
    kuldesek: [{ esemeny_id: 'FoglalasElso:' + BID, esemeny_nev: 'FoglalasElso', esemeny_tipus: 'alap', platform: 'meta', allapot: 'elkuldve', ertek: 0, penznem: 'HUF', http_status: 200, indok: null }] });
  assert.equal(regiKuponosVanEsemeny.kupon_nem_konverzio, false, 'ha van esemeny, nem "esemeny nelkuli"');
});

// ---------- P: PMU sd Visszajaro ertek ----------
const pmuMezok = (szolgaltatas, host = PMU_HOST) => ({ host, szolgaltatas, munkatarsak: ['Teszt Mester'] });
const nevtablaPmu = (db, szolgaltatasok = [], arak = [], now = T0, munkatarsak = []) => nevtablaMent(db, { helyek: [{ placeId: PMU_PLACE, nev: 'Mosaic PMU' }], munkatarsak: munkatarsak.map(([employeeId, nev]) => ({ placeId: PMU_PLACE, employeeId, nev })), szolgaltatasok: szolgaltatasok.map(([serviceId, nev]) => ({ placeId: PMU_PLACE, serviceId, nev })), arak: arak.map(([serviceId, ar]) => ({ placeId: PMU_PLACE, serviceId, ar })) }, now);

test('P1 PMU "Korrekcio" (ar nelkuli lista-tetel, az eredeti kezeles arban benne van): 0 Ft EXACT (forras korrekcio_az_arban), nevtabla nelkul is; MAS ar nelkuli szolgaltatas / MAS uzletag fail-closed (unknown_price)', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: null }); await v.kesz;
  for (const nev of ['Korrekció', 'korrekció', '  KORREKCIÓ ', 'Korrekcio']) {
    assert.deepEqual(await arFeloldas(v.db, { jelleg: 'visszajaro', mezok: pmuMezok(nev), bejovo: {} }), { ertek: 0, minoseg: 'exact', forras: 'korrekcio_az_arban' }, nev);
  }
  // fail-closed ellenpeldak: nem pontos nev, mas uzletag, ismeretlen PMU-tetel -> nincs kitalalt ar
  for (const [nev, host] of [['Korrekció és szemöldök', PMU_HOST], ['Korrekció', 'mosaic-oxigen.salonic.hu'], ['Korrekció', 'mosaicheadspa.salonic.hu'], ['Ismeretlen PMU tetel', PMU_HOST]]) {
    const r = await arFeloldas(v.db, { jelleg: 'visszajaro', mezok: pmuMezok(nev, host), bejovo: {} });
    assert.equal(r.minoseg, 'unknown_price', `${nev} @ ${host}`); assert.equal(r.ertek, 0);
  }
  // a Zap ar mezoje (ha van) elsobbseget elvez: a Korrekcio-szabaly csak ar nelkul lep be
  assert.deepEqual(await arFeloldas(v.db, { jelleg: 'visszajaro', mezok: pmuMezok('Korrekció'), bejovo: { ar: 5000 } }), { ertek: 5000, minoseg: 'exact', forras: 'zap_ar' });
});

test('P2 PMU sd veg-vegig: a "Korrekcio" Visszajaro Meta / TikTok esemenye value=0 HUF, ertek_minoseg=exact (korabban unknown_price, ertek nelkul)', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: 'pmu' }); await v.kesz;
  const u = ujUuid(); const b = level(u, { host: PMU_HOST, felado: 'Mosaic PMU', szolgaltatas: 'Korrekció', uj_vendeg: false });
  await lezar(v, b); v.t.set(SD_ELOTT);
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.uzletag, r.jelleg, r.ertek_minoseg, r.ertek_forras], ['kesz', 'pmu', 'visszajaro', 'exact', 'korrekcio_az_arban']);
  const sorok = v.sql("SELECT platform, esemeny_nev, allapot, ertek, ertek_minoseg FROM meres_kuldes WHERE esemeny_nev = 'Visszajaro' AND platform IN ('meta', 'tiktok') ORDER BY platform");
  assert.deepEqual(sorok.map((s) => [s.platform, s.allapot, s.ertek, s.ertek_minoseg]), [['meta', 'elkuldve', 0, 'exact'], ['tiktok', 'elkuldve', 0, 'exact']]);
  const meta = v.net.hivasok.find((h) => h.kulcs === 'meta').body.data[0];
  assert.equal(meta.custom_data.value, 0); assert.equal(meta.custom_data.currency, 'HUF');
});

test('P3 a PMU nevtabla CELZOTT frissitese: ha a fiokhoz nincs szolgaltatas a nevtablaban, az ar-feloldas egyszer lefuttatja a frissitot (uzletag = "pmu"), elmenti, es a lista-arat adja (exact, szolgaltatas_lista); utana nincs ujabb frissites', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: null }); await v.kesz;
  await nevtablaPmu(v.db); // a D1 valos allapota: csak a 'hely' sor
  const hivasok = [];
  const frissito = async (uzletag) => { hivasok.push(uzletag); return { helyek: [{ placeId: PMU_PLACE, nev: 'Mosaic PMU' }], munkatarsak: [], szolgaltatasok: [{ placeId: PMU_PLACE, serviceId: '900001', nev: 'Szemöldök tetoválás Soft powder' }, { placeId: PMU_PLACE, serviceId: '900002', nev: 'Korrekció' }], arak: [{ placeId: PMU_PLACE, serviceId: '900001', ar: 99000 }] }; };
  let most = T0;
  const fuggosegek = { nevtablaFrissito: frissito, now: () => most };
  const r = await arFeloldas(v.db, { jelleg: 'visszajaro', mezok: pmuMezok('Szemöldök tetoválás Soft powder'), bejovo: {}, fuggosegek });
  assert.deepEqual(r, { ertek: 99000, minoseg: 'exact', forras: 'szolgaltatas_lista' });
  assert.deepEqual(hivasok, [HOSTOK[PMU_HOST].uzletag], 'a frissito a fiok (BUSINESSES) uzletagara fut');
  const tabla = await nevtablaBetolt(v.db);
  assert.equal(tabla.szolgaltatasok.filter((x) => x.placeId === PMU_PLACE).length, 2, 'a frissitett tabla a D1-be kerult');
  // masodik feloldas: a tablaban mar benne van -> nincs ujabb frissites
  most += 5_000;
  assert.equal((await arFeloldas(v.db, { jelleg: 'visszajaro', mezok: pmuMezok('Szemöldök tetoválás Soft powder'), bejovo: {}, fuggosegek })).ertek, 99000);
  assert.equal(hivasok.length, 1, 'tobbet nem frissit');
  // az ar nelkuli tetel (Korrekcio) a tablaban sincs arral, de a PMU-szabaly 0-t ad (frissites nelkul)
  assert.equal((await arFeloldas(v.db, { jelleg: 'visszajaro', mezok: pmuMezok('Korrekció'), bejovo: {}, fuggosegek })).forras, 'korrekcio_az_arban');
  assert.equal(hivasok.length, 1);
});

test('P4 throttle: ismeretlen nev -> a frissito fiokonkent legfeljebb NEVTABLA_AR_FRISSIT_MP-enkent fut (a szabaly workerenkenti); lejarta utan ujra', async () => {
  arFrissitesNullaz();
  assert.equal(NEVTABLA_AR_FRISSIT_MP, 600);
  const v = vilag({ kapcsolo: null }); await v.kesz;
  await nevtablaPmu(v.db);
  let hivasok = 0; const frissito = async () => { hivasok++; return { helyek: [], munkatarsak: [], szolgaltatasok: [{ placeId: PMU_PLACE, serviceId: '900009', nev: 'Egyeb tetel' }], arak: [] }; };
  let most = T0;
  const fuggosegek = { nevtablaFrissito: frissito, now: () => most };
  const futtat = () => arFeloldas(v.db, { jelleg: 'elso', mezok: pmuMezok('Nincs ilyen tetel'), bejovo: {}, fuggosegek });
  assert.equal((await futtat()).minoseg, 'unknown_price'); assert.equal(hivasok, 1);
  most += 599_000; await futtat(); assert.equal(hivasok, 1, '599 mp: meg throttle');
  most += 2_000; await futtat(); assert.equal(hivasok, 2, '601 mp: ujra fut');
  // egy MASIK fiok (oxigen) throttle-je fuggetlen
  const oxi = { host: 'mosaic-oxigen.salonic.hu', szolgaltatas: 'Nincs ilyen tetel', munkatarsak: [] };
  await arFeloldas(v.db, { jelleg: 'elso', mezok: oxi, bejovo: {}, fuggosegek }); assert.equal(hivasok, 3, 'masik fiok: sajat ido');
});

test('P5 fail-closed: a frissito hibaja / ures valasza / hianya NEM akadalyoz (unknown_price, nincs kivetel); kedvezmeny-gyanus (kuponos) foglalasnal nincs frissites', async () => {
  const v = vilag({ kapcsolo: null }); await v.kesz;
  await nevtablaPmu(v.db);
  const mezok = pmuMezok('Nincs ilyen tetel');
  for (const [nev, frissito] of [['dob', async () => { throw new Error('halozati hiba'); }], ['null', async () => null], ['nincs frissito', undefined]]) {
    arFrissitesNullaz();
    const r = await arFeloldas(v.db, { jelleg: 'elso', mezok, bejovo: {}, fuggosegek: { nevtablaFrissito: frissito, now: () => T0 } });
    assert.deepEqual([r.ertek, r.minoseg], [0, 'unknown_price'], nev);
  }
  assert.equal((await arFeloldas(v.db, { jelleg: 'elso', mezok, bejovo: {} })).minoseg, 'unknown_price', 'fuggosegek nelkul (regi hivasi alak) is');
  arFrissitesNullaz(); let hivasok = 0;
  const kupon = await arFeloldas(v.db, { jelleg: 'elso', mezok: { host: PMU_HOST, szolgaltatas: 'KUPONKÓDDAL - Valami (kupon)', munkatarsak: [] }, bejovo: {}, fuggosegek: { nevtablaFrissito: async () => { hivasok++; return null; }, now: () => T0 } });
  assert.equal(kupon.minoseg, 'unknown_discount'); assert.equal(hivasok, 0, 'kuponos: a lista-ar amugy sem lenne tenyleges ar -> nincs felesleges halozati hivas');
});

test('P6 a PMU-nevtabla frissites a teljes sd-uton: a worker `fuggosegek.nevtablaFrissito`-ja eljut az ar-feloldasig (PMU szolgaltatas ar nelkul a D1-ben -> a Meta esemeny value = a lista-ar, exact)', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: 'pmu' }); await v.kesz;
  await nevtablaPmu(v.db, [], [], T0, [[777, 'Teszt Mester']]); // a D1 valos allapota: hely + munkatars sor, SZOLGALTATAS nincs (a parositas ezert nem kerul a celzott frissites ele: a hiba oka)
  const hivasok = [];
  const frissito = async (uzletag) => { hivasok.push(uzletag); return { helyek: [{ placeId: PMU_PLACE, nev: 'Mosaic PMU' }], munkatarsak: [], szolgaltatasok: [{ placeId: PMU_PLACE, serviceId: '900001', nev: 'Szemöldök tetoválás Soft powder' }], arak: [{ placeId: PMU_PLACE, serviceId: '900001', ar: 99000 }] }; };
  const u = ujUuid(); const b = level(u, { host: PMU_HOST, felado: 'Mosaic PMU', szolgaltatas: 'Szemöldök tetoválás Soft powder', uj_vendeg: false });
  await lezar(v, b); // a motoros 4 proba frissito NELKUL (a valodi PMU-nal a parositas 1. aga sikeres, a PMU-tabla ezert sosem frissul: ez a hiba oka)
  assert.equal(hivasok.length, 0); const elotte = hivasok.length;
  v.t.set(SD_ELOTT);
  const r = await v.post({ ...b, muvelet: 'sd_atvetel' }, { nevtablaFrissito: frissito });
  assert.deepEqual([r.allapot, r.jelleg, r.ertek_minoseg, r.ertek_forras], ['kesz', 'visszajaro', 'exact', 'szolgaltatas_lista'], JSON.stringify(r).slice(0, 400));
  assert.deepEqual(hivasok, [HOSTOK[PMU_HOST].uzletag], `a frissito az sd ar-feloldasbol, egyszer, PMU-ra fut (${elotte} -> ${hivasok.length})`);
  assert.equal(v.net.hivasok.find((h) => h.kulcs === 'meta').body.data[0].custom_data.value, 99000);
});

// ---------- N: N1 szukites (kuponos <-> normal par nem csere-jelolt) ----------
// A teljes sd-uton az S0-63 (tools/test-salonic-direct.mjs: 7 eset + PMU + masik szolgaltatas) es a HS-02 (tools/test-sd-headspa.mjs: index-kulcs, szigoru egyezes) fedi.
