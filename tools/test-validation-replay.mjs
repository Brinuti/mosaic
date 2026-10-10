// GA4 validation_replay (DECISION #123): egyetlen GA4-alapesemeny ujrajatszasa KIZAROLAG a GA4 agon, jelolve, a QA-5 mintabol kizarva. node --test tools/test-validation-replay.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ga4ValidationReplay, replayLista, REPLAY_JEL } from '../netlify/lib/meres/validation-replay.js';
import { egyeztetoSorok, GA4_MIN_JOGOSULT } from '../netlify/lib/meres/egyeztetes-sor.js';
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
const T0 = 1_791_620_000;
const BID = 'mb_0mv24h6pc956l82du9ejweq';
const ENV = { MERES_ELOSZTO: '1', GA4_TESZT_MEASUREMENT_ID: 'G-M5MLRLNQBP', GA4_TESZT_API_SECRET: 'TITOK-SECRET-0123', META_CAPI_TOKEN: 'META-TITOK', TIKTOK_EVENTS_TOKEN: 'TIKTOK-TITOK', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/abc/' };

async function feltolt({ ana = true, clientId = true, allapot = 'kihagyva', nev = 'Visszajaro' } = {}) {
  const D1 = d1();
  await egyeztetoSorok(D1, { tol: T0, ig: T0 + 1000 }); // sema (meres_* + foglalas_*)
  const { db } = D1;
  db.prepare('INSERT INTO meres_erkezes (source_id, uzletag, tipus, attr, hozz, bongeszo, ido, frissitve) VALUES (?,?,?,?,?,?,?,?)')
    .run(BID, 'fodrasz', 'foglalas', JSON.stringify({ ga4: clientId ? { client_id: '608293403.1791620313', session_id: '1791620312', measurement_id: 'G-H4206SQ0Q7' } : {}, utm_utolso: { source: 'google', medium: 'cpc', campaign: 'x' } }), JSON.stringify({ ana, adv: true, fun: true, dontes: true }), JSON.stringify({ szolgaltatas: 'Vagas' }), T0, T0);
  for (const p of ['meta', 'tiktok', 'google', 'ga4']) {
    db.prepare('INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, indok, ertek, penznem, letrehozva, frissitve) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(`${nev}:${BID}`, nev, 'alap', p, 'fodrasz', BID, p === 'ga4' ? allapot : 'kihagyva', 'veszkapcsolo: mind', 24950, 'HUF', T0 + 31, T0 + 31);
  }
  return D1;
}
// hamis fetch: a GA4 /debug/mp/collect tiszta validaciot ad, a /mp/collect 204-et; minden mas hivas HIBA (a replay nem nyulhat mas platformhoz)
function hamisFetch() {
  const hivasok = [];
  const f = async (url, o) => {
    hivasok.push({ url: String(url), body: o && o.body ? JSON.parse(o.body) : null });
    if (!/^https:\/\/www\.google-analytics\.com\/(debug\/)?mp\/collect\?/.test(String(url))) throw new Error('nem GA4 hivas: ' + url);
    if (String(url).includes('/debug/mp/collect')) return { status: 200, text: async () => JSON.stringify({ validationMessages: [] }) };
    return { status: 204, text: async () => '' };
  };
  return { f, hivasok };
}
const meresKuldesAllapot = (db) => db.prepare('SELECT platform, allapot, indok, frissitve FROM meres_kuldes ORDER BY platform').all();

test('validation_replay: CSAK a GA4 agon (debug-validacio + collect), jelolve, a titok nem kerul a naploba, a meres_kuldes erintetlen', async () => {
  const D1 = await feltolt(); const elotte = meresKuldesAllapot(D1.db);
  const { f, hivasok } = hamisFetch();
  const r = await ga4ValidationReplay(D1, ENV, { source_id: BID }, (T0 + 90000) * 1000, f);
  assert.deepEqual([r.ok, r.allapot, r.http_status, r.jel, r.platform, r.kizarva_a_mintabol], [true, 'elkuldve', 204, REPLAY_JEL, 'ga4', true]);
  assert.equal(hivasok.length, 2); assert.ok(hivasok[0].url.includes('/debug/mp/collect') && hivasok[1].url.includes('/mp/collect?') && !hivasok[1].url.includes('/debug/'));
  for (const h of hivasok) { assert.ok(h.url.includes('measurement_id=G-M5MLRLNQBP')); assert.ok(h.url.includes('api_secret=TITOK-SECRET-0123')); } // a teszt-property, a titok csak a kimeno kereshez
  const b = hivasok[1].body, ev = b.events[0];
  assert.equal(b.client_id, '608293403.1791620313'); assert.equal(b.timestamp_micros, String((T0 + 31) * 1_000_000), 'az eredeti esemeny ideje');
  assert.equal(ev.name.length > 0, true); assert.equal(ev.params.validation_replay, 'true'); assert.equal(ev.params.value, 24950); assert.equal(ev.params.currency, 'HUF'); assert.equal(ev.params.esemeny_id, `Visszajaro:${BID}`);
  assert.equal(b.consent.ad_user_data, 'GRANTED');
  // a tobbi platform es a meres_kuldes erintetlen (nincs Meta / TikTok / Google hivas; a GA4 cella is valtozatlan)
  assert.deepEqual(meresKuldesAllapot(D1.db), elotte);
  // naplo: kulon tablaban, titok nelkul
  const sorok = D1.db.prepare('SELECT * FROM meres_validation_replay').all(); assert.equal(sorok.length, 1);
  assert.deepEqual([sorok[0].jel, sorok[0].platform, sorok[0].allapot, sorok[0].http_status], [REPLAY_JEL, 'ga4', 'elkuldve', 204]);
  assert.ok(!JSON.stringify(sorok).includes('TITOK-SECRET'), 'a titok nincs a naploban');
});

test('validation_replay: elutasitasok (nincs analytics-hozzajarulas / client_id, mar elkuldve, nem mb_, ELOSZTO ki, tobbszori)', async () => {
  const { f, hivasok } = hamisFetch();
  assert.match((await ga4ValidationReplay(await feltolt({ ana: false }), ENV, { source_id: BID }, T0 * 1000, f)).miert, /analytics-hozzajarulas/);
  assert.match((await ga4ValidationReplay(await feltolt({ clientId: false }), ENV, { source_id: BID }, T0 * 1000, f)).miert, /client_id/);
  assert.match((await ga4ValidationReplay(await feltolt({ allapot: 'elkuldve' }), ENV, { source_id: BID }, T0 * 1000, f)).miert, /mar elkuldve/);
  assert.match((await ga4ValidationReplay(await feltolt({ nev: 'Konzultacio' }), ENV, { source_id: BID }, T0 * 1000, f)).miert, /konzultacio/);
  assert.match((await ga4ValidationReplay(await feltolt(), ENV, { source_id: 'pi_3Uvalami12345678' }, T0 * 1000, f)).miert, /mb_/);
  assert.match((await ga4ValidationReplay(await feltolt(), { ...ENV, MERES_ELOSZTO: '0' }, { source_id: BID }, T0 * 1000, f)).miert, /MERES_ELOSZTO/);
  assert.match((await ga4ValidationReplay(await feltolt(), ENV, { source_id: 'mb_nincsilyenfoglalas1234' }, T0 * 1000, f)).miert, /pontosan egy GA4/);
  assert.equal(hivasok.length, 0, 'elutasitasnal nincs kimeno hivas');
  // egy foglalasra egy sikeres replay; ujra:true-val ismetelheto
  const D1 = await feltolt(); const h2 = hamisFetch();
  assert.equal((await ga4ValidationReplay(D1, ENV, { source_id: BID }, T0 * 1000, h2.f)).ok, true);
  assert.match((await ga4ValidationReplay(D1, ENV, { source_id: BID }, T0 * 1000, h2.f)).miert, /mar volt sikeres/);
  assert.equal((await ga4ValidationReplay(D1, ENV, { source_id: BID, ujra: true }, T0 * 1000, h2.f)).ok, true);
  // GA4 titok nelkul a kuldes nincs_hitelesites (nem megy ki semmi), de a naplo rogziti
  const D2 = await feltolt(); const h3 = hamisFetch();
  const r = await ga4ValidationReplay(D2, { ...ENV, GA4_TESZT_API_SECRET: '' }, { source_id: BID }, T0 * 1000, h3.f);
  assert.deepEqual([r.ok, r.allapot], [true, 'nincs_hitelesites']); assert.equal(h3.hivasok.length, 0);
});

test('validation_replay: az egyezteto osszegzesben KIZART tetelkent latszik, a lefedettseg nem valtozik; GA4 ertekelhetoseg (>= 20 jogosult foglalas, alatta NOT_EVALUABLE)', async () => {
  const D1 = await feltolt(); const { f } = hamisFetch();
  const elotte = await egyeztetoSorok(D1, { tol: T0, ig: T0 + 1000 });
  assert.deepEqual(elotte.osszegzes.validation_replay, []);
  await ga4ValidationReplay(D1, ENV, { source_id: BID }, (T0 + 500) * 1000, f);
  const utana = await egyeztetoSorok(D1, { tol: T0, ig: T0 + 1000 });
  assert.equal(utana.osszegzes.validation_replay.length, 1); assert.deepEqual([utana.osszegzes.validation_replay[0].kizarva_a_mintabol, utana.osszegzes.validation_replay[0].allapot, utana.osszegzes.validation_replay[0].source_id], [true, 'elkuldve', BID]);
  assert.deepEqual(utana.osszegzes.lefedettseg.platformonkent, elotte.osszegzes.lefedettseg.platformonkent, 'a lefedettseg a replay-tol nem valtozik');
  // ertekelhetoseg: itt 1 foglalas, a GA4 cella 'kihagyva veszkapcsolo' -> hiany -> jogosult 1 < 20
  assert.equal(GA4_MIN_JOGOSULT, 20); assert.deepEqual(utana.osszegzes.lefedettseg.ga4_ertekelhetoseg, { jogosult_foglalas: 1, kuszob: 20, allapot: 'NOT_EVALUABLE' });
});

test('/api/meres-admin ga4_validation_replay: kulcsos, kifejezett jovahagyas-jelolo kell (GPT-123), a hiba 409; a hivas csak GA4-et er el', async () => {
  const D1 = await feltolt(); const KULCS = 'replay-proba-kulcs-0123456789'; const { f, hivasok } = hamisFetch();
  const env = { ...ENV, KULCS_DB: D1, EGYEZTETES_KULCS_HASH: await sha256hex(KULCS) };
  const kerj = (body, kulcs = KULCS) => kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?kulcs=${kulcs}`, { method: 'POST', body: JSON.stringify(body) }), env, { fetchImpl: f, now: () => (T0 + 600) * 1000 });
  assert.equal((await kerj({ muvelet: 'ga4_validation_replay', source_id: BID, jovahagyas: 'GPT-123' }, 'rossz')).status, 404);
  assert.equal((await kerj({ muvelet: 'ga4_validation_replay', source_id: BID })).status, 400, 'jovahagyas-jelolo nelkul nem fut');
  assert.equal(hivasok.length, 0);
  const ok = await kerj({ muvelet: 'ga4_validation_replay', source_id: BID, jovahagyas: 'GPT-123' }); assert.equal(ok.status, 200);
  const j = await ok.json(); assert.deepEqual([j.ok, j.allapot, j.jel], [true, 'elkuldve', REPLAY_JEL]);
  assert.ok(hivasok.every((h) => h.url.startsWith('https://www.google-analytics.com/')), 'csak GA4');
  assert.equal((await kerj({ muvelet: 'ga4_validation_replay', source_id: BID, jovahagyas: 'GPT-123' })).status, 409, 'masodszor ujra:true nelkul elutasitva');
  assert.equal((await replayLista(D1)).length, 1);
});
