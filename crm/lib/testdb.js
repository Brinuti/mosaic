// D1-szeru adapter a node:sqlite fole (CSAK teszthez / helyi demohoz): ugyanazt a felületet adja, mint a Cloudflare D1:
//   db.prepare(sql).bind(...).run() / .all() / .first()    db.batch([stmt, ...])    db.exec(sql)
// A Cloudflare-en a valodi env.CRM_DB kerul a helyere; a crm/lib kod csak ezt a felületet hasznalja.
import { DatabaseSync } from 'node:sqlite';

class Allitas {
  constructor(adatbazis, sql, params = []) { this.adatbazis = adatbazis; this.sql = sql; this.params = params; }
  bind(...p) { return new Allitas(this.adatbazis, this.sql, p); }
  _fut() { return this.adatbazis.prepare(this.sql); }
  async run() {
    const r = this._fut().run(...this.params);
    return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  async all() {
    const sorok = this._fut().all(...this.params).map((s) => ({ ...s }));
    return { results: sorok, success: true, meta: {} };
  }
  async first(oszlop) {
    const s = this._fut().get(...this.params);
    if (!s) return null;
    return oszlop ? s[oszlop] : { ...s };
  }
  async raw() { return this._fut().all(...this.params).map((s) => Object.values(s)); }
}

export class TestDb {
  constructor(fajl = ':memory:') { this.d = new DatabaseSync(fajl); this.d.exec('PRAGMA foreign_keys = ON'); }
  prepare(sql) { return new Allitas(this.d, sql); }
  async exec(sql) { this.d.exec(sql); return { count: 1 }; }
  async batch(allitasok) {
    const ki = [];
    this.d.exec('BEGIN');
    try {
      for (const a of allitasok) ki.push(await a.run());
      this.d.exec('COMMIT');
    } catch (e) { this.d.exec('ROLLBACK'); throw e; }
    return ki;
  }
  close() { this.d.close(); }
}

/** uj, memoriaban futo adatbazis a crm/migrations/*.sql osszes fajljaval (sorrendben) */
export async function ujAdatbazis(migraciok = true) {
  const db = new TestDb();
  if (migraciok) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const mappa = path.resolve(import.meta.dirname, '../migrations');
    if (fs.existsSync(mappa)) {
      for (const f of fs.readdirSync(mappa).filter((x) => x.endsWith('.sql')).sort()) db.d.exec(fs.readFileSync(path.join(mappa, f), 'utf8'));
    }
  }
  return db;
}
