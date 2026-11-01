// D1-szimulacio (node:sqlite) a modellnap tesztjeihez es a helyi kiszolgalohoz (tools/serve.mjs, tools/modell-teszt.mjs). Csak teszt / fejlesztes: elesben a Cloudflare D1 fut.
import { DatabaseSync } from 'node:sqlite';

export function d1() {
  const sq = new DatabaseSync(':memory:');
  const elokeszit = (sql) => {
    const o = { args: [], bind(...a) { o.args = a; return o; },
      async run() { const r = sq.prepare(sql).run(...o.args); return { success: true, meta: { changes: Number(r.changes) } }; },
      async all() { return { results: sq.prepare(sql).all(...o.args).map((x) => ({ ...x })) }; },
      async first() { const r = sq.prepare(sql).get(...o.args); return r ? { ...r } : null; },
      _sync() { const r = sq.prepare(sql).run(...o.args); return { success: true, meta: { changes: Number(r.changes) } }; } };
    return o;
  };
  return { prepare: elokeszit, sq,
    async batch(lista) { sq.exec('BEGIN'); try { const r = lista.map((x) => x._sync()); sq.exec('COMMIT'); return r; } catch (e) { sq.exec('ROLLBACK'); throw e; } } };
}
