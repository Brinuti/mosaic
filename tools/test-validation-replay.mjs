// GA4 validation_replay LEZARVA (GPT-dontes #231): a kuldesi felulet nincs meg; csak az olvaso lista maradt. node --test tools/test-validation-replay.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import * as replay from '../netlify/lib/meres/validation-replay.js';
import { replayLista, REPLAY_JEL } from '../netlify/lib/meres/validation-replay.js';
import { egyeztetoSorok } from '../netlify/lib/meres/egyeztetes-sor.js';
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

test('a kuldesi felulet eltavolitva: a modul nem exportal kuldo fuggvenyt, a forrasban nincs kuldo hivas, az admin-op ismeretlen (400), kimeno hivas nincs', async () => {
  assert.deepEqual(Object.keys(replay).sort(), ['REPLAY_JEL', 'replayLista'], 'csak az olvaso lista maradt');
  const forras = fs.readFileSync(new URL('../netlify/lib/meres/validation-replay.js', import.meta.url), 'utf8');
  assert.ok(!/\bkuldes\(|\bga4Kerelem\b|\bfetch\(/.test(forras), 'nincs kuldo kod');
  const vegpontok = fs.readFileSync(new URL('../netlify/lib/meres/vegpontok.js', import.meta.url), 'utf8');
  assert.ok(!/ga4_validation_replay|ga4ValidationReplay/.test(vegpontok), 'az admin-op kikerult');
  const D1 = d1(); const KULCS = 'lezart-proba-kulcs-0123456789'; const hivasok = [];
  const env = { MERES_ELOSZTO: '1', GA4_TESZT_API_SECRET: 'x', KULCS_DB: D1, EGYEZTETES_KULCS_HASH: await sha256hex(KULCS) };
  const res = await kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?kulcs=${KULCS}`, { method: 'POST', body: JSON.stringify({ muvelet: 'ga4_validation_replay', source_id: 'mb_0mv24h6pc956l82du9ejweq', jovahagyas: 'GPT-123' }) }), env, { fetchImpl: async (u) => { hivasok.push(String(u)); return { status: 204, text: async () => '' }; } });
  assert.equal(res.status, 400); assert.match((await res.json()).miert, /ismeretlen muvelet/); assert.equal(hivasok.length, 0);
});

test('az olvaso lista es az egyezteto osszegzese: a (korabbi) replay-tetel kizart tetelkent latszik, a lefedettseg nem valtozik', async () => {
  const D1 = d1(); await egyeztetoSorok(D1, { tol: T0, ig: T0 + 1000 });
  assert.deepEqual(await replayLista(D1), []);
  D1.db.exec('CREATE TABLE IF NOT EXISTS meres_validation_replay (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL, esemeny_id TEXT NOT NULL, platform TEXT NOT NULL, jel TEXT NOT NULL, allapot TEXT NOT NULL, http_status INTEGER, valasz TEXT, kerelem TEXT, kuldve INTEGER NOT NULL)');
  const elotte = await egyeztetoSorok(D1, { tol: T0, ig: T0 + 1000 });
  D1.db.prepare('INSERT INTO meres_validation_replay (source_id, esemeny_id, platform, jel, allapot, http_status, kuldve) VALUES (?,?,?,?,?,?,?)').run('mb_0mv24h6pc956l82du9ejweq', 'Visszajaro:mb_0mv24h6pc956l82du9ejweq', 'ga4', REPLAY_JEL, 'elkuldve', 204, T0 + 5);
  const utana = await egyeztetoSorok(D1, { tol: T0, ig: T0 + 1000 });
  assert.equal(utana.osszegzes.validation_replay.length, 1); assert.equal(utana.osszegzes.validation_replay[0].kizarva_a_mintabol, true);
  assert.deepEqual(utana.osszegzes.lefedettseg.platformonkent, elotte.osszegzes.lefedettseg.platformonkent);
});
