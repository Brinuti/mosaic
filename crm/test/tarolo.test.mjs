import test from 'node:test';
import assert from 'node:assert/strict';
import { ujAdatbazis } from '../lib/testdb.js';
import { d1Tarolo } from '../lib/tarolo.js';

test('T01 a D1 tarolo tobb darabos fajlt is pontosan visszaad, torles utan nincs', async () => {
  const db = await ujAdatbazis();
  const t = d1Tarolo(db);
  const b = new Uint8Array(1_500_000).map((_, i) => (i * 31) % 251);
  await t.put('kep/1', b, { mime: 'image/jpeg' });
  const r = await t.get('kep/1');
  assert.equal(r.mime, 'image/jpeg');
  assert.equal(r.bajtok.length, b.length);
  assert.ok(r.bajtok.every((v, i) => v === b[i]));
  await t.put('kep/1', new Uint8Array([1, 2, 3]));   // felulirja
  assert.deepEqual([...(await t.get('kep/1')).bajtok], [1, 2, 3]);
  await t.del('kep/1');
  assert.equal(await t.get('kep/1'), null);
});
