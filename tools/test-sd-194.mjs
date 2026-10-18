// DECISION #194 (Feri, 2026-10-17; meresi oldal #167): a KUPONOS (ajandekkartyas) foglalas NEM konverzio + N1 szukites + a PMU sd `Visszajaro` ertek - OFFLINE TESZTEK
//   node --test tools/test-sd-194.mjs
// Valodi SQLite (node:sqlite) D1-hej, hamis halozat, hamis ora (tools/lib-sd-teszt.mjs); SEMMI nem megy ki a halozatra, nincs titok.
//   K*  : kupon -> nincs esemeny (modell, elosztas, jelentesek); az ajandekkartya VASARLASA es a normal foglalas valtozatlan
//   F6  : a kupon-felismero egyetlen helyen (kuponJelzes): ekezet-, kisbetu-, zero-width-fuggetlen, "coupon" is
//   P*  : PMU "Korrekcio" (ar nelkuli lista-tetel) = 0 Ft exact; PMU nevtabla celzott frissitese (hamis frissito), throttle, fail-closed
//   F*  : a review javitasai: F-1 (szaraz terv irasmentes), F-4 (kuponos uj foglalasnal nincs csere-felismeres), F-5 (Korrekcio csak a pontos nev), F-6 (kuponJelzes)
//   (N1: a kuponos <-> normal par nem csere-jelolt - az S0-63 / HS-02 teszt fedi, lasd lent)
import test from 'node:test';
import assert from 'node:assert/strict';
import { esemenyek, foglalasJelleg, kuponJelzes } from '../netlify/lib/meres/esemeny-modell.js';
import { elosztas } from '../netlify/lib/meres/elosztas.js';
import { sorEpit } from '../netlify/lib/meres/egyeztetes-sor.js';
import { NEVTABLA_AR_FRISSIT_MP, arFeloldas, arFrissitesNullaz, szolgIndexKulcs } from '../netlify/lib/meres/salonic-direct.js';
import { ertekel, smokeSql } from './sd-smoke-ellenorzes.mjs';
import { HOSTOK, nevtablaBetolt, nevtablaMent } from '../netlify/lib/foglalas-kulcs.js';
import { ENV_ALAP, T0, d1, iso, level, lezar, ujUuid, vilag } from './lib-sd-teszt.mjs';

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

test('F6 a kupon-felismero EGYETLEN helyen (kuponJelzes): "kupon" / "coupon", ekezet-, kisbetu- es zero-width-fuggetlen (NFD is); az "AJANDEKKARTYAVAL - ..." ELOTAG is jelzes (DECISION #195), a mondat kozepi nem; minden fogyasztoja ezt hasznalja', async () => {
  const KUPONOS = ['KUPONKÓDDAL - 💆‍♀️ EGYÉNI 50 perces Head Spa', 'Head Spa kezelés (kupon)', 'COUPON - Head Spa kezelés', 'Coupon code - Head Spa', 'AJÁNDÉKKÁRTYÁVAL - 💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés', 'Ajándékkártyával - Head Spa', '  Ajándékkártyával – Head Spa', '💆‍♀️ AJÁNDÉKKÁRTYÁVAL – Head Spa', 'AJANDEKKARTYAVAL', 'AJÁNDÉKKÁRTYÁ\u200BVAL - Head Spa', 'KÚPONKÓDDAL - Head Spa', 'KU\u0301PONKÓDDAL - Head Spa' /* NFD: U + kombinalo ekezet */,
    'ku\u200Bpon - Head Spa', 'KU\u200DPON Head Spa', 'ku\u2060pon', 'ku\u00ADpon', '\uFEFFkupon', 'cou\u200Bpon', 'Kupon'];
  for (const nev of KUPONOS) {
    assert.equal(kuponJelzes(nev), true, JSON.stringify(nev));
    assert.equal(foglalasJelleg({ szolgaltatasNev: nev, ujVendeg: true, kategoria: '' }).kupon, true, `foglalasJelleg: ${JSON.stringify(nev)}`);
    assert.deepEqual(esemenyek(fk({ kupon: foglalasJelleg({ szolgaltatasNev: nev, ujVendeg: true }).kupon })), [], `esemenyek: ${JSON.stringify(nev)}`);
    assert.ok(/ kupon$/.test(szolgIndexKulcs(nev)), `index-kulcs: ${JSON.stringify(nev)}`);
  }
  // kategoria is jelzes
  assert.equal(foglalasJelleg({ szolgaltatasNev: 'Head Spa', ujVendeg: true, kategoria: 'KUPONOS' }).kupon, true);
  // nem kuponos: valos nevek, az "Ajandekkartya bevaltas" (-val nelkul), ures / hianyzo bemenet
  for (const nev of ['💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés', 'Ajándékkártya beváltás', 'Ajándékkártyát vásárolok', 'PÁROS MOSAIC Head Spa kezelés (ajándékkártyával is fizethető)', 'Head Spa kezelés, ajándékkártyával is fizethető', 'AJÁNDÉKKÁRTYÁVALÓ Head Spa', 'x ajandekkartyaval', '2 db ajándékkártyával', 'Korrekció', 'Soft powder', '', null, undefined]) {
    assert.equal(kuponJelzes(nev), false, JSON.stringify(nev));
  }
  // az ar-feloldas kedvezmeny-gyanuja is ugyanezt a felismerot hasznalja: ismert lista-ar mellett is unknown_discount (a lista-ar nem tenyleges ar)
  { const w = vilag({ kapcsolo: null }); await w.kesz;
    await nevtablaMent(w.db, { helyek: [{ placeId: 10427, nev: 'Mosaic Headspa' }], munkatarsak: [], szolgaltatasok: [{ placeId: 10427, serviceId: '900100', nev: 'COUPON - Head Spa kezelés' }, { placeId: 10427, serviceId: '900101', nev: 'Head Spa kezelés' }], arak: [{ placeId: 10427, serviceId: '900100', ar: 26900 }, { placeId: 10427, serviceId: '900101', ar: 26900 }] }, T0);
    const ar = (nev) => arFeloldas(w.db, { jelleg: 'elso', mezok: { host: 'mosaicheadspa.salonic.hu', szolgaltatas: nev, munkatarsak: [] }, bejovo: {} });
    assert.deepEqual([(await ar('COUPON - Head Spa kezelés')).minoseg, (await ar('Head Spa kezelés')).minoseg], ['unknown_discount', 'exact']); }
  // veg-vegig: a "COUPON - ..." HeadSpa foglalas az sd-uton sem kuld esemenyt
  const v = vilag({ kapcsolo: 'headspa' }); await v.kesz;
  const u = ujUuid(); const b = level(u, { host: 'mosaicheadspa.salonic.hu', felado: 'Mosaic Headspa', szolgaltatas: 'COUPON - 💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés', munkatarsak: ['Teszt Terapeuta'], uj_vendeg: true });
  await lezar(v, b); v.t.set(SD_ELOTT);
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.kupon, r.esemeny_kuldes.kupon_nem_konverzio], ['kesz', true, true]);
  assert.equal(v.sql('SELECT COUNT(*) AS n FROM meres_kuldes')[0].n, 0); assert.equal(v.net.hivasok.length, 0);
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

test('P1b (review F-5) a "Korrekcio" szabaly CSAK a PONTOS nevre: a dekoralt valtozatok (ar, akcio-elotag, emoji, "helyett" szoveg) NEM kapnak 0 Ft exact erteket (unknown_price)', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: null }); await v.kesz;
  for (const nev of ['Korrekció (15 000 Ft)', 'AKCIÓ - Korrekció', '💉 Korrekció', 'Korrekció - 5.000 Ft helyett most 0 Ft', 'Korrekció és szemöldök', 'Korrekcio 2', 'KORREKCIÓ!', 'Kor rekció', 'Korrekció\u200B', 'korrekció (kupon)']) {
    const r = await arFeloldas(v.db, { jelleg: 'visszajaro', mezok: pmuMezok(nev), bejovo: {} });
    assert.notEqual(r.forras, 'korrekcio_az_arban', JSON.stringify(nev));
    assert.deepEqual([r.ertek, r.minoseg === 'exact'], [0, false], JSON.stringify(nev));
  }
  // a pontos nev (ekezet-, kisbetu-, szelso szokoz-fuggetlen) tovabbra is 0 Ft exact
  for (const nev of ['Korrekció', 'korrekcio', ' KORREKCIÓ ', 'Korrekció\t']) assert.equal((await arFeloldas(v.db, { jelleg: 'visszajaro', mezok: pmuMezok(nev), bejovo: {} })).forras, 'korrekcio_az_arban', JSON.stringify(nev));
});

test('P2 PMU sd veg-vegig: a "Korrekcio" Visszajaro Meta / TikTok esemenye value=0 HUF, ertek_minoseg=exact (korabban unknown_price, ertek nelkul)', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: 'pmu' }); await v.kesz;
  const u = ujUuid(); const b = level(u, { host: PMU_HOST, felado: 'Mosaic PMU', szolgaltatas: 'Korrekció', uj_vendeg: false, ar: undefined });
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
  const u = ujUuid(); const b = level(u, { host: PMU_HOST, felado: 'Mosaic PMU', szolgaltatas: 'Szemöldök tetoválás Soft powder', uj_vendeg: false, ar: undefined });
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

// ---------- F-1: a SZARAZ terv irasmentes es halozatmentes ----------
const dumpMind = (v) => Object.fromEntries(v.sql("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((t) => [t.name, JSON.stringify(v.sql(`SELECT * FROM ${t.name}`))]));
test('F1 (review F-1) a `szaraz:true` sd_atvetel PMU-ra: 0 nevtabla-frissito hivas, 0 halozati hivas, a salonic_nevtabla* tablak (es minden mas tabla) azonosak elotte / utana; az eles ut ugyanerre frissit (kontroll)', async () => {
  const frissitoGyar = (hivasok) => async (uzletag) => { hivasok.push(uzletag); return { helyek: [{ placeId: PMU_PLACE, nev: 'Mosaic PMU' }], munkatarsak: [{ placeId: PMU_PLACE, employeeId: 777, nev: 'Teszt Mester' }], szolgaltatasok: [{ placeId: PMU_PLACE, serviceId: '900001', nev: 'Szemöldök tetoválás Soft powder' }], arak: [{ placeId: PMU_PLACE, serviceId: '900001', ar: 99000 }] }; };
  const vilagPmu = async () => {
    arFrissitesNullaz();
    const v = vilag({ kapcsolo: 'pmu' }); await v.kesz;
    await nevtablaPmu(v.db, [], [], T0, [[777, 'Teszt Mester']]); // hely + munkatars, szolgaltatas nincs: a frissites ar-feloldasbol kerulne sorra
    const b = level(ujUuid(), { host: PMU_HOST, felado: 'Mosaic PMU', szolgaltatas: 'Szemöldök tetoválás Soft powder', uj_vendeg: false, ar: undefined });
    await lezar(v, b); v.t.set(SD_ELOTT);
    return { v, b };
  };
  // szaraz
  { const { v, b } = await vilagPmu(); const hivasok = []; const elotte = dumpMind(v); const netElotte = v.net.hivasok.length, salonicElotte = v.net.salonic.length;
    const r = await v.post({ ...b, muvelet: 'sd_atvetel', szaraz: true }, { nevtablaFrissito: frissitoGyar(hivasok) });
    assert.equal(r.allapot, 'szaraz_terv', JSON.stringify(r).slice(0, 300));
    assert.equal(hivasok.length, 0, 'a szaraz terv nem hivja a nevtabla-frissitot');
    assert.deepEqual([v.net.hivasok.length, v.net.salonic.length], [netElotte, salonicElotte], 'nincs uj halozati hivas');
    assert.deepEqual(dumpMind(v), elotte, 'minden tabla (koztuk a salonic_nevtabla*) azonos');
    assert.equal((await nevtablaBetolt(v.db)).szolgaltatasok.filter((x) => x.placeId === PMU_PLACE).length, 0, 'a nevtabla nem kapott szolgaltatas-sort');
    assert.equal(r.terv.ertek_minoseg, 'unknown_price', 'a szaraz terv ar nelkul fail-closed'); }
  // kontroll: ugyanez szaraz nelkul frissit (a teszt erzekeny a szaraz-kapura)
  { const { v, b } = await vilagPmu(); const hivasok = [];
    const r = await v.post({ ...b, muvelet: 'sd_atvetel' }, { nevtablaFrissito: frissitoGyar(hivasok) });
    assert.equal(r.allapot, 'kesz'); assert.equal(hivasok.length, 1, 'az eles ut egyszer frissit'); assert.equal(r.ertek_minoseg, 'exact'); }
});

// ---------- F-4: kuponos uj foglalasnal nincs csere-felismeres ----------
const HS_HOST = 'mosaicheadspa.salonic.hu';
const HS_PAROS = '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)';
const HS_KUPON_PAROS = `KUPONKÓDDAL - ${HS_PAROS}`;
const hsLevel = (uuid, o = {}) => level(uuid, { host: HS_HOST, felado: 'Mosaic Headspa', szolgaltatas: HS_PAROS, munkatarsak: ['Páros kezelés'], idopont_szoveg: 'October 20. (Tuesday) 16:00 - 17:20', ld: { startDate: '2026-10-20T16:00:00+02:00' }, uj_vendeg: false, megjegyzes: '', ...o });
let szam194 = 0; const u8uuid = (u8) => `${u8}-0000-4000-8000-${String(++szam194).padStart(12, '0')}`;
const smoke = (v, uuid) => { const u8 = uuid.slice(0, 8); const eredmenyek = Object.fromEntries(smokeSql(u8).map((q) => [q.nev, v.sql(q.sql, ...q.params)])); return ertekel(u8, eredmenyek, { mostSec: Math.floor(v.t() / 1000) + 5, env: { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' } }); };
const MEGJ = 'A korábbi 16 órás foglalásomat cserélném erre.';
test('F4 (review F-4) KUPONOS uj foglalas csere-szoval: nincs csere-felismeres (nincs halasztva / HOLD, nincs riasztas, nincs reschedule audit-sor), az sd smoke PASS; a NORMAL uj foglalas vizsgalata valtozatlan (kuponos par -> HOLD, normal par -> confirmed)', async () => {
  const esetek = [
    // [nev, regi foglalas modositasa (null = nincs regi), uj foglalas szolgaltatasa, varhato]
    ['kuponos -> kuponos', { szolgaltatas: `${HS_KUPON_PAROS} (kupon)` }, `${HS_KUPON_PAROS} (kupon)`, 'kuponos'],
    ['normal -> kuponos', { szolgaltatas: HS_PAROS }, `${HS_KUPON_PAROS} (kupon)`, 'kuponos'],
    ['kuponos uj foglalas csere-szoval, nincs regi foglalas', null, `${HS_KUPON_PAROS} (kupon)`, 'kuponos'],
    ['kuponos uj foglalas, "COUPON -" elotaggal', { szolgaltatas: HS_PAROS }, `COUPON - ${HS_PAROS}`, 'kuponos'],
    ['kontroll: kuponos regi -> NORMAL uj foglalas (a par-vedelem marad: HOLD, 0 kuldes)', { szolgaltatas: `${HS_KUPON_PAROS} (kupon)` }, HS_PAROS, 'suspected'],
    ['kontroll: normal -> normal (a csere-felismeres valtozatlan)', { szolgaltatas: HS_PAROS, ld: null, idopont_szoveg: 'October 16. (Friday) 16:00 - 17:20' }, HS_PAROS, 'confirmed'],
  ];
  for (const [nev, regiMod, ujSzolg, varhato] of esetek) {
    const v = vilag({ kapcsolo: 'headspa' }); await v.kesz;
    if (regiMod) assert.ok((await v.post(hsLevel(u8uuid('c0ffee0a'), { ld: { startDate: '2026-10-16T16:00:00+02:00' }, idopont_szoveg: 'October 16. (Friday) 16:00 - 17:20', level_datuma: iso(T0 - 3 * 86400_000), ...regiMod }))).ok, nev);
    const u = u8uuid('c0ffee0b'); const b = hsLevel(u, { megjegyzes: MEGJ, szolgaltatas: ujSzolg });
    await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    const resch = v.sql('SELECT allapot FROM foglalas_reschedule WHERE uuid = ?1', u);
    if (varhato === 'kuponos') {
      assert.equal(r.allapot, 'kesz', nev); assert.equal(r.csere, null, nev); assert.ok(!r.riasztas, nev + ': nincs riasztas');
      assert.equal(resch.length, 0, nev + ': nincs reschedule audit-sor');
      assert.equal(r.esemeny_kuldes.kupon_nem_konverzio, true, nev); assert.equal(v.net.hivasok.length, 0, nev + ': 0 kuldes');
      const e = smoke(v, u);
      assert.equal(e.verdikt, 'PASS', `${nev}: ${JSON.stringify(e.kriteriumok.filter((x) => x.allapot !== 'PASS'))}`);
      assert.equal(e.kriteriumok.find((x) => x.id === 'C3').allapot, 'PASS', nev + ': smoke C3');
      assert.equal(e.kriteriumok.find((x) => x.id === 'C11').allapot, 'PASS', nev + ': smoke C11 (nincs reschedule)');
      assert.deepEqual(v.sql("SELECT COUNT(*) AS n FROM foglalas_egyeztetes WHERE sd_allapot IN ('halasztva', 'reschedule_confirmed')")[0], { n: 0 }, nev);
    } else {
      assert.equal(r.csere && r.csere.allapot, varhato, nev);
      if (varhato === 'suspected') { assert.equal(r.allapot, 'halasztva', nev); assert.equal(r.riasztas, true, nev); assert.equal(v.net.hivasok.length, 0, nev); }
      else assert.equal(r.allapot, 'reschedule_confirmed', nev);
    }
  }
});

test('F4b a megjegyzes-kulcs HIANYA (elfelejtett Zap-lekepezes): kuponos foglalasnal nem HOLD (nincs mit visszatartani), NORMAL foglalasnal tovabbra is hianyzo_mezo HOLD', async () => {
  for (const [szolg, varhato] of [[`${HS_KUPON_PAROS} (kupon)`, 'kesz'], [HS_PAROS, 'halasztva']]) {
    const v = vilag({ kapcsolo: 'headspa' }); await v.kesz;
    const b = hsLevel(u8uuid('c0ffee0c'), { szolgaltatas: szolg }); delete b.megjegyzes;
    await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    assert.equal(r.allapot, varhato, szolg);
  }
});

// ---------- delta-review: a kuponos kapu a SZARAZ es az UJRAFUTTATASI agon, a kupon-felismero lathatatlan karakterei ----------
test('F4c (delta-review 1) kuponos foglalas SZARAZ terve csere-szoval: terv.mod === "normal", csere null, 0 terv-esemeny, irasmentes (minden tabla azonos), 0 halozati hivas; a NORMAL foglalas szaraz terve ugyanazzal a megjegyzessel csere-gyanus', async () => {
  for (const [szolg, kuponos] of [[`${HS_KUPON_PAROS} (kupon)`, true], [`COUPON - ${HS_PAROS}`, true], [HS_PAROS, false]]) {
    const v = vilag({ kapcsolo: 'headspa' }); await v.kesz;
    const u = u8uuid('c0ffee0d'); const b = hsLevel(u, { megjegyzes: MEGJ, szolgaltatas: szolg });
    await lezar(v, b); v.t.set(SD_ELOTT);
    const elotte = dumpMind(v); const net0 = v.net.hivasok.length, sal0 = v.net.salonic.length;
    const r = await v.post({ ...b, muvelet: 'sd_atvetel', szaraz: true });
    assert.equal(r.allapot, 'szaraz_terv', szolg);
    if (kuponos) { assert.equal(r.terv.mod, 'normal', szolg); assert.equal(r.terv.csere, null, szolg); assert.deepEqual(r.terv.terv_esemenyek, [], szolg + ': a kuponos foglalasnak nincs terv-esemenye'); }
    else { assert.equal(r.terv.mod, 'suspected', szolg); assert.equal(r.terv.csere.allapot, 'suspected', szolg); }
    assert.deepEqual(dumpMind(v), elotte, szolg + ': a szaraz terv minden tablat valtozatlanul hagy (0 sor)');
    assert.deepEqual([v.net.hivasok.length, v.net.salonic.length], [net0, sal0], szolg + ': 0 halozati hivas');
  }
});

test('F4d (delta-review 2) kuponos UJRAFUTTATAS: a megszakadt `atveve` sor es a hianyzo_mezo-potlas (regi HOLD) csere-szoval is `kesz`, csere null, nincs HOLD / riasztas / reschedule audit-sor; a NORMAL foglalas ugyanitt csere-gyanus (HOLD)', async () => {
  const CSERE_MEGJ = MEGJ;
  for (const [szolg, kuponos] of [[`${HS_KUPON_PAROS} (kupon)`, true], [HS_PAROS, false]]) {
    for (const ag of ['atveve', 'hianyzo_potlas']) {
      const nev = `${kuponos ? 'kuponos' : 'normal'} / ${ag}`;
      const v = vilag({ kapcsolo: 'headspa' }); await v.kesz;
      const u = u8uuid('c0ffee0e'); const b = hsLevel(u, { megjegyzes: '', szolgaltatas: szolg }); // az elso futas csere-szo nelkul: kesz
      await lezar(v, b); v.t.set(SD_ELOTT);
      assert.equal((await v.sd(b)).allapot, 'kesz', nev + ': elso futas');
      if (ag === 'atveve') { // megszakadt Worker: az atvetel `atveve`-ben maradt, 300 s utan ujra atveheto
        v.D.db.prepare("UPDATE foglalas_egyeztetes SET sd_allapot = 'atveve' WHERE uuid = ?1").run(u);
        v.t.set(SD_ELOTT + 400_000);
      } else { // a regi (#194 elotti) kod HOLD-ja: a megjegyzes-kulcs hianyzott, a sor halasztva + hianyzo_mezo audit-sor; most megerkezik a megjegyzes
        v.D.db.prepare("UPDATE foglalas_egyeztetes SET sd_allapot = 'halasztva', riasztas = 1 WHERE uuid = ?1").run(u);
        v.D.db.prepare("INSERT INTO foglalas_reschedule (uuid, sd_id, allapot, ok, ido, frissitve) SELECT uuid, sd_id, 'hianyzo_mezo', 'regi HOLD', ?2, ?2 FROM foglalas_egyeztetes WHERE uuid = ?1").run(u, Math.floor(SD_ELOTT / 1000));
        v.t.set(SD_ELOTT + 60_000);
      }
      const r = await v.sd({ ...b, megjegyzes: CSERE_MEGJ }); // az ujrafuttatas mar csere-szoval erkezik
      if (kuponos) {
        assert.equal(r.allapot, 'kesz', `${nev}: ${JSON.stringify(r).slice(0, 300)}`); assert.equal(r.csere, null, nev); assert.ok(!r.riasztas, nev + ': nincs riasztas');
        assert.equal(v.net.hivasok.length, 0, nev);
        assert.deepEqual(v.sql("SELECT sd_allapot, riasztas FROM foglalas_egyeztetes WHERE uuid = ?1", u).map((x) => [x.sd_allapot, x.riasztas]), [['kesz', 0]], nev);
        assert.deepEqual(v.sql('SELECT allapot FROM foglalas_reschedule WHERE uuid = ?1', u).filter((x) => x.allapot !== 'hianyzo_mezo_potolva' && x.allapot !== 'hianyzo_mezo').length, 0, nev + ': nincs suspected / confirmed audit-sor');
      } else {
        assert.equal(r.csere && r.csere.allapot, 'suspected', nev); assert.equal(r.allapot, 'halasztva', nev); assert.equal(r.riasztas, true, nev);
      }
    }
  }
});

test('F6b (delta-review 4) a kupon-felismero lathatatlan karakterei a SZO KOZEPEN is: zero-width space / non-joiner / joiner, bal-jobb jelek, word joiner es invisible operatorok, soft hyphen, mongol vowel separator, BOM; tobb karakter egyutt; "coupon" is', () => {
  const LATHATATLAN = ['​', '‌', '‍', '‎', '‏', '⁠', '⁡', '⁢', '⁣', '⁤', '­', '᠎', '﻿'];
  for (const lk of LATHATATLAN) {
    const kod = 'U+' + lk.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    for (const alap of ['ku{}pon', 'k{}upon', 'kupo{}n', 'cou{}pon', 'KUPON{}KÓDDAL']) {
      const szo = alap.replace('{}', lk);
      assert.equal(kuponJelzes(`${szo} - Head Spa`), true, `${kod}: ${JSON.stringify(szo)}`);
      assert.equal(foglalasJelleg({ szolgaltatasNev: szo, ujVendeg: true }).kupon, true, `foglalasJelleg ${kod}`);
    }
  }
  assert.equal(kuponJelzes('ku​﻿­po‍n'), true, 'tobb lathatatlan karakter egyutt');
  assert.equal(kuponJelzes('ku﻿pon'), true, 'BOM a szo kozepen');
  // a lathatatlan karakter nem hoz letre kupont ott, ahol nincs: valos nevek
  for (const nev of ['Head​ Spa kezelés', 'Ko﻿rrekció', 'Relax­kezelés']) assert.equal(kuponJelzes(nev), false, JSON.stringify(nev));
});
