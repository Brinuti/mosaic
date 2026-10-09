import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { TestDb } from '../lib/testdb.js';
import { alkalmaz, allitasokra } from '../lib/migracio.js';
import migraciok from '../lib/migraciok.generalt.js';

test('MG01 a generalt migracio-modul naprakesz', () => {
  execFileSync(process.execPath, ['tools/crm-migraciok.mjs', '--ellenoriz'], { cwd: new URL('../..', import.meta.url).pathname });
});

test('MG02 a migraciok allitasonkent (trigger-torzzsel) lefutnak, ujrafuttatva nem tortenik semmi, a sema hibatlan', async () => {
  const db = new TestDb();
  const elso = await alkalmaz(db, migraciok);
  assert.deepEqual(elso.alkalmazva, migraciok.map((m) => m.nev));
  const masodik = await alkalmaz(db, migraciok);
  assert.deepEqual(masodik.alkalmazva, []);
  const { results } = await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger'").all();
  assert.ok(results[0].n > 0, 'a triggerek letrejottek');
  assert.ok((await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'guest'").first()).n === 1);
});

test('MG03 az allitas-bonto a trigger BEGIN..END blokkot egyben tartja', () => {
  const sql = 'CREATE TABLE a (x);\nCREATE TRIGGER t BEFORE UPDATE ON a BEGIN\n  SELECT RAISE(ABORT, \'x\');\nEND;\nCREATE INDEX i ON a (x);';
  const r = allitasokra(sql);
  assert.equal(r.length, 3);
  assert.match(r[1], /^CREATE TRIGGER t[\s\S]*END;$/);
});
