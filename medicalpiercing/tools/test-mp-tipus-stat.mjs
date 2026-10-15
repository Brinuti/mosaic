// node --test tools/test-mp-tipus-stat.mjs  -  belso tipusstatisztika: kulcs nelkuli szamlalo, kuszob, semmi nem megy ki
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tipusSzamlal, tipusRiport, tipusKod, budapestiNap, TIPUS_KOD } from '../lib/meres/tipus-stat.js';
import { TIPUSOK } from '../lib/meres/meres.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const prep = (sql) => { let args = []; const o = { bind: (...a) => { args = a; return o; }, run: async () => db.prepare(sql).run(...args) }; return o; };
  return { prepare: prep, raw: db };
}

test('minden ismert tipusnak van kodja, ismeretlen -> egyeb', () => {
  for (const t of TIPUSOK) assert.ok(Number.isInteger(TIPUS_KOD[t]), t);
  assert.equal(tipusKod('valami'), TIPUS_KOD.egyeb);
});

test('szamlalo: ugyanaz a cella novekszik, a tablaban nincs azonosito', async () => {
  const db = d1();
  const sor = { kulcs: '6029|1|1792000000', meta_fbp: 'fb.1.x', kornyezet: 'eles', forras_cimke: 'meta', helyszin: 'bp', letrehozva: 1792000000 };
  await tipusSzamlal(db, sor, 'migren');
  await tipusSzamlal(db, sor, 'migren');
  await tipusSzamlal(db, { ...sor, helyszin: 'szeged' }, 'shenmen');
  const sorok = db.raw.prepare('SELECT * FROM mp_tipus_stat ORDER BY helyszin').all();
  assert.equal(sorok.length, 2);
  assert.equal(sorok[0].db, 2);
  assert.equal(sorok[0].tipus_kod, 1);
  assert.equal(sorok[0].nap, budapestiNap(1792000000));
  const oszlopok = db.raw.prepare('PRAGMA table_info(mp_tipus_stat)').all().map((c) => c.name).sort();
  assert.deepEqual(oszlopok, ['db', 'forras_cimke', 'helyszin', 'kornyezet', 'nap', 'tipus_kod']);
  assert.ok(!JSON.stringify(sorok).includes('migren') && !JSON.stringify(sorok).includes('fb.1'));
});

test('hiba eseten nem dob', async () => {
  assert.equal(await tipusSzamlal({ prepare: () => { throw new Error('x'); } }, {}, 'migren'), false);
});

test('riport: 5 alatti cellak forrasonkent egyeb sorba vonva', () => {
  const r = tipusRiport([
    { forras_cimke: 'meta', helyszin: 'bp', tipus_kod: 1, db: 6 },
    { forras_cimke: 'meta', helyszin: 'bp', tipus_kod: 2, db: 2 },
    { forras_cimke: 'meta', helyszin: 'pecs', tipus_kod: 1, db: 1 },
  ]);
  assert.deepEqual(r, [{ forras_cimke: 'meta', helyszin: 'bp', tipus_kod: 1, db: 6 }, { forras_cimke: 'meta', helyszin: 'egyeb', tipus_kod: 0, db: 3 }]);
});

test('kifele nem olvassa: a platform-modulok nem hivatkoznak tipus-statra / tipus_kod-ra', () => {
  for (const f of ['meta.js', 'tiktok.js', 'google-ads.js', 'kiigazitas.js']) {
    const k = readFileSync(new URL(`../lib/meres/${f}`, import.meta.url), 'utf8');
    assert.ok(!/tipus-stat|tipus_kod|mp_tipus_stat/.test(k), f);
  }
});

test('a tipus a Salonic szolgaltatas-azonositobol jon (semleges koszonooldalon is)', async () => {
  const { tipusNormal, tarolhatoTipus } = await import('../lib/meres/meres.js');
  assert.equal(tipusNormal('/foglalas-ok', '', 189184), '2piercing');
  assert.equal(tipusNormal('/foglalas-ok', '', 220503), '3piercing');
  assert.equal(tipusNormal('/foglalas-ok', '', 395895), 'ful');
  assert.equal(tipusNormal('/foglalas-ok', '', 999999), 'egyeb');
  assert.equal(tarolhatoTipus(tipusNormal('/foglalas-ok', '', 189184)), null); // a sorba tovabbra sem kerul
});
