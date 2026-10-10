// QA-5 foglalasonkenti egyeztetosor (netlify/lib/meres/egyeztetes-sor.js): osztalyozas, jelzesek, CSV, admin vegpont. node --test tools/test-egyeztetes-sor.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cellaOsztaly, sorEpit, egyeztetoSorok, egyeztetoCsv, ga4Csere, csereIdo, lefedettseg } from '../netlify/lib/meres/egyeztetes-sor.js';
import { kezelAdmin } from '../netlify/lib/meres/vegpontok.js';
import { sha256hex } from '../netlify/lib/meres/hash.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
const T0 = 1_790_000_000, T1 = T0 + 86400;
const A = 'mb_aaaaaaaaaaaaaaaaaa', B = 'mb_bbbbbbbbbbbbbbbbbb', C = 'mb_cccccccccccccccccc', D = 'mb_dddddddddddddddddd', E = 'mb_eeeeeeeeeeeeeeeeee';
const PL = ['meta', 'tiktok', 'google', 'ga4'];

async function feltolt() {
  const D1 = d1();
  await egyeztetoSorok(D1, { tol: T0, ig: T1 }); // sema letrehozasa
  const { db } = D1;
  const irat = (id, kulcs, ido) => db.prepare('INSERT INTO foglalas_kulcs_irasok (booking_id, kulcs, service_id, ido, lejar) VALUES (?,?,?,?,?)').run(id, kulcs, '1', ido, ido + 99999);
  const egy = (uuid, id, allapot, kuldve) => db.prepare('INSERT INTO foglalas_egyeztetes (uuid, allapot, probalkozas, kulcs, kulcs_forras, booking_id, kuldve, letrehozva, frissitve) VALUES (?,?,1,?,?,?,?,?,?)').run(uuid, allapot, '10823|25095|1', 'back', id, kuldve, T0 + 10, T0 + 10);
  const kuld = (id, nev, tipus, platform, allapot, indok, ertek) => db.prepare('INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, indok, ertek, penznem, http_status, letrehozva, frissitve) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(`${nev}:${id}`, nev, tipus, platform, 'headspa', id, allapot, indok, ertek, 'HUF', allapot === 'elkuldve' ? 200 : null, T0 + 20, T0 + 20);
  // A: uj vendeg, minden rendben (FoglalasElso + Schedule, 4 platform)
  irat(A, '10823|25095|1', T0 + 5); egy('u1', A, 'kesz', T0 + 15);
  for (const p of PL) { kuld(A, 'FoglalasElso', 'alap', p, 'elkuldve', null, 26900); kuld(A, 'Schedule', 'ernyo', p, 'elkuldve', null, 26900); }
  // B: visszatero: nincs ernyo; Meta hozzajarulas nelkul jogosan kihagyva
  irat(B, '10823|25095|2', T0 + 6); egy('u2', B, 'kesz', T0 + 16);
  for (const p of PL) kuld(B, 'Visszajaro', 'alap', p, p === 'meta' ? 'kihagyva' : 'elkuldve', p === 'meta' ? 'hozzajarulas nelkul a modell szerint nem megy' : null, 19900);
  // C: ket alap esemeny (rossz tipus / duplikacio gyanu) + TikTok veszkapcsolo miatt kihagyva (hiany)
  irat(C, '10823|25095|3', T0 + 7); egy('u3', C, 'kesz', T0 + 17);
  for (const p of PL) { kuld(C, 'FoglalasElso', 'alap', p, p === 'tiktok' ? 'kihagyva' : 'elkuldve', p === 'tiktok' ? 'veszkapcsolo: mind' : null, 26900); kuld(C, 'Visszajaro', 'alap', p, 'elkuldve', null, 26900); }
  // D: koszonooldali iras van, a levelparositas nincs (parositatlan)
  irat(D, '10823|25095|4', T0 + 8);
  // E: fuggoben levo parositas (friss, a Zap ujraprobal)
  irat(E, '10823|25095|5', T0 + 9); db.prepare("INSERT INTO foglalas_egyeztetes (uuid, allapot, probalkozas, kulcs, booking_id, letrehozva, frissitve) VALUES ('u5','fuggoben',1,'10823|25095|5',?,?,?)").run(E, T0 + 9, T0 + 9);
  return D1;
}

test('cellaOsztaly: elkuldve = ok; modell / hozzajarulas szerinti kihagyas = jogos_0; veszkapcsolo / hiba / nincs_hitelesites / nincs sor = hiany', () => {
  assert.equal(cellaOsztaly({ allapot: 'elkuldve' }).osztaly, 'ok');
  assert.equal(cellaOsztaly({ allapot: 'kihagyva', indok: 'hozzajarulas nelkul' }).osztaly, 'jogos_0');
  for (const s of [{ allapot: 'kihagyva', indok: 'veszkapcsolo: mind' }, { allapot: 'hiba' }, { allapot: 'nincs_hitelesites' }, { allapot: 'tiltva' }, { allapot: 'halasztva' }, { allapot: 'nyitott' }, { allapot: 'folyamatban' }, null]) assert.equal(cellaOsztaly(s).osztaly, 'hiany', JSON.stringify(s));
  assert.equal(cellaOsztaly({ allapot: 'elkuldve' }).kezbesites, 1); assert.equal(cellaOsztaly(null).kezbesites, 0);
  // GA4 client_id nelkul (DECISION #122): a FOGLALASKORI analytics-hozzajarulas dont; a tobbi 'tiltva' (vedelem) HIANY
  const KL = { allapot: 'tiltva', indok: 'nincs GA4 client_id (nincs _ga suti): a Measurement Protocol client_id nelkul nem kuldheto' };
  const elutasitva = cellaOsztaly(KL, { hozz: { ana: false, adv: true, fun: true, dontes: true } });
  assert.deepEqual([elutasitva.osztaly, elutasitva.kezbesites, elutasitva.kod], ['jogos_0', 0, 'ga4_nincs_ana_hozzajarulas']);
  assert.equal(cellaOsztaly(KL, { hozz: { ana: null, adv: null, fun: null, dontes: false } }).osztaly, 'jogos_0', 'nincs dontes -> jogos 0');
  const hiba = cellaOsztaly(KL, { hozz: { ana: true, adv: true, fun: true, dontes: true } });
  assert.deepEqual([hiba.osztaly, hiba.kod], ['hiany', 'ga4_ana_van_client_id_nincs']);
  assert.equal(cellaOsztaly(KL, { hozz: null }).kod, 'ga4_nincs_pillanatkep'); assert.equal(cellaOsztaly(KL).osztaly, 'hiany', 'pillanatkep nelkul hiany');
  for (const indok of ['az elo GA4 property tiltott', 'nincs GA4_TESZT_MEASUREMENT_ID (teszt-property)', 'a celpont nem az ARNYEK dataset (elo pixelre nem kuldunk)']) assert.equal(cellaOsztaly({ allapot: 'tiltva', indok }, { hozz: { ana: false } }).osztaly, 'hiany', indok);
});

test('egyeztetoSorok: foglalasonkent egy sor; esemenytipus, ertek, uj / visszatero, platformonkent 1 vagy jogos 0; jelzesek a hibas esetekre', async () => {
  const r = await egyeztetoSorok(await feltolt(), { tol: T0, ig: T1 });
  assert.equal(r.ok, true); assert.equal(r.sorok.length, 5); assert.equal(r.kovetkezo, null);
  const by = Object.fromEntries(r.sorok.map((s) => [s.booking_id, s]));
  // A
  assert.deepEqual([by[A].esemenytipus, by[A].uj_visszatero, by[A].ertek, by[A].penznem, by[A].rendben, by[A].kulcs], ['FoglalasElso', 'uj', 26900, 'HUF', true, '10823|25095|1']);
  assert.deepEqual(by[A].esemenyek.map((e) => e.nev), ['FoglalasElso', 'Schedule']);
  for (const e of by[A].esemenyek) for (const p of PL) assert.deepEqual([e.platformok[p].kezbesites, e.platformok[p].osztaly], [1, 'ok']);
  // B
  assert.deepEqual([by[B].esemenytipus, by[B].uj_visszatero, by[B].rendben], ['Visszajaro', 'visszatero', true]);
  assert.deepEqual([by[B].esemenyek[0].platformok.meta.kezbesites, by[B].esemenyek[0].platformok.meta.osztaly], [0, 'jogos_0']);
  // C: tobb alap esemeny + TikTok hiany
  assert.equal(by[C].rendben, false);
  assert.ok(by[C].jelzesek.includes('tobb_alap_esemeny:FoglalasElso+Visszajaro'));
  assert.ok(by[C].jelzesek.some((j) => j.startsWith('platform_hiany:tiktok:FoglalasElso:')));
  // D / E
  assert.deepEqual(by[D].jelzesek, ['parositatlan']);
  assert.deepEqual(by[E].jelzesek, ['egyeztetes_fuggoben']);
  // osszegzes
  assert.deepEqual(r.osszegzes.platformonkent.tiktok, { ok: 4, jogos_0: 0, hiany: 1 });
  assert.deepEqual(r.osszegzes.platformonkent.meta, { ok: 4, jogos_0: 1, hiany: 0 });
  assert.equal(r.osszegzes.rendben, 2); assert.equal(r.osszegzes.jelzett, 3);
  assert.deepEqual(r.osszegzes.jogos_0_okok.meta, { 'hozzajarulas nelkul a modell szerint nem megy': 1 }); assert.deepEqual(r.osszegzes.jogos_0_okok.tiktok, {});
});

test('egyeztetoSorok: oldalazas (limit + utan), idoszak-szures, ervenytelen tol / ig', async () => {
  const D1 = await feltolt();
  const e1 = await egyeztetoSorok(D1, { tol: T0, ig: T1, limit: 2 });
  assert.deepEqual(e1.sorok.map((s) => s.booking_id), [A, B]); assert.equal(e1.kovetkezo, B);
  const e2 = await egyeztetoSorok(D1, { tol: T0, ig: T1, limit: 2, utan: e1.kovetkezo });
  assert.deepEqual(e2.sorok.map((s) => s.booking_id), [C, D]);
  assert.equal((await egyeztetoSorok(D1, { tol: T1 + 10, ig: T1 + 20 })).sorok.length, 0, 'idoszakon kivul nincs sor');
  assert.equal((await egyeztetoSorok(D1, { tol: 5, ig: 5 })).ok, false);
  assert.equal((await egyeztetoSorok(D1, { tol: 'x', ig: 5 })).ok, false);
});

test('egyeztetoCsv: egy sor foglalas x esemeny; platformonkent kezbesites + osztaly; idezojel / pontosvesszo kezelve', async () => {
  const r = await egyeztetoSorok(await feltolt(), { tol: T0, ig: T1 });
  const sorok = egyeztetoCsv(r.sorok).trim().split('\n');
  assert.ok(sorok[0].startsWith('booking_id;kulcs;uzletag;esemenytipus;uj_visszatero;ertek;penznem'));
  assert.equal(sorok.length, 1 + 2 + 1 + 2 + 1 + 1); // fejlec + A 2 esemeny + B 1 + C 2 (ket alap) + D, E: esemeny nelkul 1-1 sor
  const a = sorok.filter((s) => s.startsWith(A)); assert.equal(a.length, 2);
  assert.match(a[0], /;FoglalasElso;uj;26900;HUF;.*;1;1;1;1;ok;ok;ok;ok;/);
});

test('POST nelkuli GET /api/meres-admin?egyeztetes=1: kulcsos; JSON es CSV; hibas tol 400; nem ir semmit', async () => {
  const D1 = await feltolt(); const KULCS = 'qa5-proba-kulcs-0123456789';
  const env = { KULCS_DB: D1, EGYEZTETES_KULCS_HASH: await sha256hex(KULCS) };
  const kerj = (q, kulcs = KULCS) => kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?kulcs=${kulcs}&${q}`), env);
  assert.equal((await kerj(`egyeztetes=1&tol=${T0}&ig=${T1}`, 'rossz')).status, 404);
  const elotte = D1.db.prepare('SELECT (SELECT COUNT(*) FROM meres_kuldes) k, (SELECT COUNT(*) FROM foglalas_egyeztetes) e, (SELECT COUNT(*) FROM meres_kapcsolo) c').get();
  const j = await kerj(`egyeztetes=1&tol=${T0}&ig=${T1}`); assert.equal(j.status, 200);
  const jb = await j.json(); assert.equal(jb.ok, true); assert.equal(jb.sorok.length, 5);
  const c = await kerj(`egyeztetes=1&tol=${T0}&ig=${T1}&formatum=csv`); assert.equal(c.status, 200); assert.match(c.headers.get('content-type'), /text\/csv/);
  assert.equal((await kerj('egyeztetes=1&tol=9&ig=3')).status, 400);
  assert.deepEqual(D1.db.prepare('SELECT (SELECT COUNT(*) FROM meres_kuldes) k, (SELECT COUNT(*) FROM foglalas_egyeztetes) e, (SELECT COUNT(*) FROM meres_kapcsolo) c').get(), elotte, 'csak olvas');
});

test('GA4 titokcsere (GPT-dontes): a csere elotti utolso es az utani elso SIKERES GA4 arnyek-esemeny + a kozbeni sikertelenek szama; foglalas-szuro; a cella jelolve; CSV-oszlop; ISO-datum', async () => {
  const D1 = await feltolt(); const { db } = D1;
  const G = 'mb_gggggggggggggggggg', H = 'mb_hhhhhhhhhhhhhhhhhh', I = 'mb_iiiiiiiiiiiiiiiiii', PI1 = 'pi_3Uelotte000000001', PI2 = 'pi_3Uutana0000000002';
  const ga4 = (src, nev, allapot, frissitve) => db.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, ertek, penznem, http_status, letrehozva, frissitve) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(`${nev}:${src}`, nev, 'alap', 'ga4', 'headspa', src, allapot, 1000, 'HUF', allapot === 'elkuldve' ? 204 : null, frissitve, frissitve);
  const CSERE = T0 + 100;
  ga4(G, 'Visszajaro', 'elkuldve', T0 + 90);   // foglalas, a csere elott (az utolso a foglalasok kozt)
  ga4(PI1, 'Ajandekkartya', 'elkuldve', T0 + 95); // ajandekkartya, a csere elott (az utolso barmelyik kozt)
  ga4(H, 'Visszajaro', 'hiba', T0 + 110);      // sikertelen a csere utan, az elso sikeres elott
  ga4(PI2, 'Ajandekkartya', 'elkuldve', T0 + 120); // az elso sikeres a csere utan (barmelyik)
  ga4(I, 'Visszajaro', 'elkuldve', T0 + 130);  // az elso sikeres FOGLALAS a csere utan
  const c = await ga4Csere(D1, CSERE);
  assert.deepEqual([c.utolso_sikeres_elotte.source_id, c.utolso_sikeres_elotte.tipus, c.utolso_sikeres_elotte.http_status], [PI1, 'ajandekkartya', 204]);
  assert.equal(c.foglalas_utolso_sikeres_elotte.source_id, G); assert.equal(c.elso_sikeres_utana.source_id, PI2); assert.equal(c.foglalas_elso_sikeres_utana.source_id, I);
  assert.equal(c.sikertelen_ga4_cella_a_csere_utan_az_elso_sikeresig, 1); assert.equal(c.ido, CSERE); assert.equal(c.foglalas_elso_sikeres_utana.kuldve_utc, new Date((T0 + 130) * 1000).toISOString());
  // a vegponton at: a jelolt foglalasok soraiban a GA4 cella jelolt, az osszegzesben ott a teljes jelentes
  const r = await egyeztetoSorok(D1, { tol: T0, ig: T1, ga4_csere: CSERE });
  const by = Object.fromEntries(r.sorok.map((x) => [x.booking_id, x]));
  assert.deepEqual(by[G].esemenyek[0].platformok.ga4.csere_jelolo, ['foglalas_csere_elotti_utolso']); assert.deepEqual(by[I].esemenyek[0].platformok.ga4.csere_jelolo, ['foglalas_csere_utani_elso']);
  assert.equal(by[A].ga4_csere_jelolo, undefined); assert.equal(r.osszegzes.ga4_csere.foglalas_elso_sikeres_utana.source_id, I);
  const csv = egyeztetoCsv(r.sorok).trim().split('\n'); assert.match(csv[0], /;ga4_csere_jelolo;jelzesek$/); assert.ok(csv.some((l) => l.startsWith(G) && l.includes('foglalas_csere_elotti_utolso')));
  // csere nelkul nincs jeloles; ervenytelen ido 400-as hiba; ISO-datum es unix is jo
  assert.equal((await egyeztetoSorok(D1, { tol: T0, ig: T1 })).osszegzes.ga4_csere, undefined);
  assert.equal((await egyeztetoSorok(D1, { tol: T0, ig: T1, ga4_csere: 'holnap' })).ok, false);
  assert.equal(csereIdo(String(CSERE)), CSERE); assert.equal(csereIdo(new Date(CSERE * 1000).toISOString()), CSERE); assert.equal(csereIdo(''), null); assert.equal(csereIdo('x'), null);
  // csere elott meg nincs sikeres GA4 / utana nincs: null, a szamlalo a vegeig szamol
  const korai = await ga4Csere(D1, T0 + 5); assert.equal(korai.utolso_sikeres_elotte, null);
  const kesoi = await ga4Csere(D1, T0 + 500); assert.equal(kesoi.elso_sikeres_utana, null); assert.equal(kesoi.sikertelen_ga4_cella_a_csere_utan_az_elso_sikeresig, 0);
});

test('DECISION #122: GA4 client_id nelkul a FOGLALASKORI analytics-hozzajarulas dont; lefedettseg: platformonkent jogosult (nevezo), jogosult_arany, kezbesites_arany, GA4 client_id elerheto arany; uzletagonkent', async () => {
  const D1 = await feltolt(); const { db } = D1;
  const [H1, H2, H3, H4, H5, H6] = ['mb_h1h1h1h1h1h1h1h1h1', 'mb_h2h2h2h2h2h2h2h2h2', 'mb_h3h3h3h3h3h3h3h3h3', 'mb_h4h4h4h4h4h4h4h4h4', 'mb_h5h5h5h5h5h5h5h5h5', 'mb_h6h6h6h6h6h6h6h6h6'];
  const erk = (id, uzletag, hozz, clientId) => db.prepare('INSERT INTO meres_erkezes (source_id, uzletag, tipus, attr, hozz, ido, frissitve) VALUES (?,?,?,?,?,?,?)').run(id, uzletag, 'foglalas', JSON.stringify(clientId ? { ga4: { client_id: '123.456' } } : {}), JSON.stringify(hozz), T0 + 30, T0 + 30);
  const GA = 'nincs GA4 client_id (nincs _ga suti): a Measurement Protocol client_id nelkul nem kuldheto';
  const sor = (id, nev, platform, allapot, indok, uzl) => db.prepare('INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, indok, ertek, penznem, http_status, letrehozva, frissitve) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(`${nev}:${id}`, nev, 'alap', platform, uzl, id, allapot, indok, 20000, 'HUF', allapot === 'elkuldve' ? 200 : null, T0 + 40, T0 + 40);
  const cell = (id, nev, uzl, ga4, google = 'elkuldve', gIndok = null) => { for (const p of ['meta', 'tiktok']) sor(id, nev, p, 'elkuldve', null, uzl); sor(id, nev, 'google', google, gIndok, uzl); sor(id, nev, 'ga4', ga4, ga4 === 'tiltva' ? GA : null, uzl); };
  const NEM = { ana: false, adv: false, fun: false, dontes: true }, IGEN = { ana: true, adv: true, fun: true, dontes: true }, NINCS_DONTES = { ana: null, adv: null, fun: null, dontes: false };
  erk(H1, 'headspa', NEM, false); cell(H1, 'FoglalasElso', 'headspa', 'tiltva');           // elutasitott analytics + nincs client_id -> GA4 jogos 0
  erk(H2, 'headspa', IGEN, false); cell(H2, 'FoglalasElso', 'headspa', 'tiltva');          // analytics-hozzajarulas VAN, nincs client_id -> GA4 HIANY (hiba)
  erk(H3, 'fodrasz', NINCS_DONTES, false); cell(H3, 'FoglalasElso', 'fodrasz', 'tiltva');  // nincs dontes -> GA4 jogos 0
  erk(H4, 'fodrasz', IGEN, true); cell(H4, 'FoglalasElso', 'fodrasz', 'elkuldve');          // minden rendben
  erk(H5, 'fodrasz', IGEN, true); cell(H5, 'Visszajaro', 'fodrasz', 'elkuldve', 'kihagyva', 'a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)'); // Google: visszajaro = jogos 0
  cell(H6, 'FoglalasElso', 'headspa', 'tiltva');                                             // NINCS erkezesi pillanatkep: a hozzajarulas ismeretlen -> GA4 hiany (a meresi adat hianya)
  const r = await egyeztetoSorok(D1, { tol: T0, ig: T1 });
  const by = Object.fromEntries(r.sorok.map((x) => [x.booking_id, x]));
  const ga = (id) => by[id].esemenyek[0].platformok.ga4;
  assert.deepEqual([ga(H1).osztaly, ga(H1).kod], ['jogos_0', 'ga4_nincs_ana_hozzajarulas']); assert.deepEqual([ga(H2).osztaly, ga(H2).kod], ['hiany', 'ga4_ana_van_client_id_nincs']);
  assert.equal(ga(H3).osztaly, 'jogos_0'); assert.equal(ga(H4).osztaly, 'ok'); assert.equal(ga(H5).osztaly, 'ok'); assert.deepEqual([ga(H6).osztaly, ga(H6).kod], ['hiany', 'ga4_nincs_pillanatkep']);
  assert.deepEqual([by[H2].hozzajarulas.ana, by[H2].ga4_client_id, by[H1].hozzajarulas.ana, by[H6].hozzajarulas, by[H6].ga4_client_id], [true, false, false, null, null]);
  assert.ok(by[H2].jelzesek.some((j) => j.startsWith('platform_hiany:ga4:FoglalasElso:analytics-hozzajarulas VAN'))); assert.equal(by[H1].jelzesek.some((j) => j.includes(':ga4:')), false, 'a jogos 0 nem jelzes');
  // lefedettseg: a bazis a 6 uj foglalas + az A / B / C (feltolt) - csak az uj hatot nezzuk szuro nelkul a tiszta szamokhoz
  const L = lefedettseg([H1, H2, H3, H4, H5, H6].map((id) => by[id]));
  assert.deepEqual(L.platformonkent.ga4, { foglalas_osszes: 6, jogosult: 4, jogosult_arany: 0.6667, kezbesitve: 2, hiany: 2, jogos_0: 2, kezbesites_arany: 0.5 });
  assert.deepEqual(L.platformonkent.google, { foglalas_osszes: 6, jogosult: 5, jogosult_arany: 0.8333, kezbesitve: 5, hiany: 0, jogos_0: 1, kezbesites_arany: 1 });
  assert.deepEqual(L.platformonkent.meta, { foglalas_osszes: 6, jogosult: 6, jogosult_arany: 1, kezbesitve: 6, hiany: 0, jogos_0: 0, kezbesites_arany: 1 });
  // GA4 client_id: pillanatkep 5 (H6 nincs); client_id van 2 (H4, H5) -> 0.4; analytics-hozzajarulassal 3 (H2, H4, H5), ebbol client_id 2 -> 0.6667
  assert.deepEqual(L.ga4_client_id, { pillanatkep_van: 5, pillanatkep_nincs: 1, client_id_elerheto: 2, client_id_elerheto_arany: 0.4, analytics_hozzajarulassal: 3, analytics_hozzajarulassal_client_id_elerheto: 2, client_id_elerheto_arany_analytics_hozzajarulassal: 0.6667, hiba_analytics_hozzajarulassal_client_id_nelkul: 1, jogos_0_nincs_analytics_hozzajarulas: 2 });
  assert.equal(L.uzletagonkent.fodrasz.platformonkent.ga4.jogosult, 2); assert.equal(L.uzletagonkent.headspa.platformonkent.ga4.hiany, 2);
  // az osszegzesben (a teljes oldal): a lefedettseg blokk ott van; a paratlan (esemeny nelkuli) foglalasok kulon szamolva
  assert.ok(r.osszegzes.lefedettseg.platformonkent.ga4.foglalas_osszes >= 6); assert.equal(r.osszegzes.lefedettseg.alapesemeny_nelkuli_foglalas, 2, 'D es E: nincs esemeny');
  assert.deepEqual(r.osszegzes.jogos_0_okok.ga4['nincs analytics-hozzajarulas (elutasitva), nincs GA4 client_id'], 1);
  // CSV: az uj oszlopok
  const csv = egyeztetoCsv(r.sorok).split('\n'); assert.match(csv[0], /;hozz_ana;ga4_client_id;ga4_csere_jelolo;jelzesek$/);
});

test('GA4 csere utani BUKASOK szama a #122 szerint: a jogos 0 (analytics-hozzajarulas nelkuli client_id-hiany, ernyo) NEM bukas; hiba / vedelmi tiltva / analytics-hozzajarulas melletti client_id-hiany / pillanatkep nelkuli client_id-hiany BUKAS', async () => {
  const D1 = d1(); await egyeztetoSorok(D1, { tol: T0, ig: T1 }); const { db } = D1;
  const GA = 'nincs GA4 client_id (nincs _ga suti): a Measurement Protocol client_id nelkul nem kuldheto';
  const erk = (id, hozz) => db.prepare('INSERT INTO meres_erkezes (source_id, uzletag, tipus, attr, hozz, ido, frissitve) VALUES (?,?,?,?,?,?,?)').run(id, 'headspa', 'foglalas', '{}', JSON.stringify(hozz), T0, T0);
  const sor = (id, nev, tipus, allapot, indok, frissitve) => db.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, indok, ertek, penznem, letrehozva, frissitve) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(`${nev}:${id}`, nev, tipus, 'ga4', 'headspa', id, allapot, indok, 1000, 'HUF', frissitve, frissitve);
  const CSERE = T0 + 100;
  // a prodban latott eset: ajandekkartya, nincs analytics-dontes, nincs client_id -> JOGOS 0 (nem bukas)
  erk('pi_3Unincsdontes0001', { ana: null, adv: null, fun: null, dontes: false }); sor('pi_3Unincsdontes0001', 'Ajandekkartya', 'alap', 'tiltva', GA, CSERE + 10);
  sor('pi_3Unincsdontes0001', 'Schedule', 'ernyo', 'kihagyva', 'a GA4-be csak alapesemeny megy (az ernyo nem)', CSERE + 10);
  // BUKASOK: hiba; analytics-hozzajarulas mellett client_id nelkul; vedelmi tiltva; pillanatkep nelkuli client_id-hiany
  sor('mb_bukas1bukas1bukas1', 'Visszajaro', 'alap', 'hiba', null, CSERE + 20);
  erk('mb_bukas2bukas2bukas2', { ana: true, adv: true, fun: true, dontes: true }); sor('mb_bukas2bukas2bukas2', 'FoglalasElso', 'alap', 'tiltva', GA, CSERE + 30);
  sor('mb_bukas3bukas3bukas3', 'FoglalasElso', 'alap', 'tiltva', 'az elo GA4 property tiltott', CSERE + 35);
  sor('mb_bukas4bukas4bukas4', 'FoglalasElso', 'alap', 'tiltva', GA, CSERE + 38);
  // az elso sikeres, ezutan keletkezettek nem szamitanak
  erk('mb_sikeres1sikeres1ok', { ana: true, adv: true, fun: true, dontes: true }); sor('mb_sikeres1sikeres1ok', 'Konzultacio', 'alap', 'elkuldve', null, CSERE + 50);
  sor('mb_kesobbi1kesobbi1kes', 'Visszajaro', 'alap', 'hiba', null, CSERE + 60);
  const c = await ga4Csere(D1, CSERE);
  assert.equal(c.elso_sikeres_utana.source_id, 'mb_sikeres1sikeres1ok');
  assert.equal(c.sikertelen_ga4_cella_a_csere_utan_az_elso_sikeresig, 4, '4 valodi bukas (hiba, ana+client_id-hiany, vedelmi tiltva, pillanatkep nelkuli client_id-hiany)');
  assert.equal(c.jogos_0_ga4_cella_a_csere_utan_az_elso_sikeresig, 2, 'jogos 0: a dontes nelkuli client_id-hiany es az ernyo');
  // a prod-eset: csak jogos 0 az elso sikeresig -> 0 bukas
  const D2 = d1(); await egyeztetoSorok(D2, { tol: T0, ig: T1 });
  D2.db.prepare('INSERT INTO meres_erkezes (source_id, uzletag, tipus, attr, hozz, ido, frissitve) VALUES (?,?,?,?,?,?,?)').run('pi_3Uprod00000000001', 'headspa', 'ajandekkartya', '{}', JSON.stringify({ ana: null, adv: null, fun: null, dontes: false }), T0, T0);
  const ins = (id, nev, tipus, allapot, indok, fr) => D2.db.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, indok, ertek, penznem, letrehozva, frissitve) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(`${nev}:${id}`, nev, tipus, 'ga4', 'headspa', id, allapot, indok, 1000, 'HUF', fr, fr);
  ins('pi_3Uprod00000000001', 'Ajandekkartya', 'alap', 'tiltva', GA, CSERE + 10);
  ins('mb_prodsikeres1prodsik', 'Konzultacio', 'alap', 'elkuldve', null, CSERE + 40);
  const p = await ga4Csere(D2, CSERE);
  assert.deepEqual([p.sikertelen_ga4_cella_a_csere_utan_az_elso_sikeresig, p.jogos_0_ga4_cella_a_csere_utan_az_elso_sikeresig], [0, 1]);
});
