// QA-5 foglalasonkenti egyeztetosor (netlify/lib/meres/egyeztetes-sor.js): osztalyozas, jelzesek, CSV, admin vegpont. node --test tools/test-egyeztetes-sor.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { cellaOsztaly, sorEpit, egyeztetoSorok, egyeztetoCsv } from '../netlify/lib/meres/egyeztetes-sor.js';
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
