// Cloudflare D1 helyettesito a helyi tesztekhez: node:sqlite (memoria) a D1 prepare / bind / run / first / all / batch feluleten at.
import { DatabaseSync } from 'node:sqlite';

class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.params = []; }
  bind(...p) { const s = new Stmt(this.db, this.sql); s.params = p.map((v) => (v === undefined ? null : v)); return s; }
  _run() { return this.db.prepare(this.sql); }
  async run() { const r = this._run().run(...this.params); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; }
  async first() { const r = this._run().get(...this.params); return r === undefined ? null : { ...r }; }
  async all() { return { success: true, results: this._run().all(...this.params).map((x) => ({ ...x })) }; }
}

export function ujD1() {
  const db = new DatabaseSync(':memory:');
  return {
    _db: db,
    prepare: (sql) => new Stmt(db, sql),
    async batch(stmts) { const out = []; db.exec('BEGIN'); try { for (const s of stmts) out.push(await s.run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return out; },
  };
}
