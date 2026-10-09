// Migraciok alkalmazasa D1-en (a Worker futasa kozben, elso kereskor): a crm/migrations/*.sql tartalma a generalt crm/lib/migraciok.generalt.js-ben van
// (tools/crm-migraciok.mjs allitja elo, a teszt ellenorzi, hogy naprakesz). A D1 exec() soronkent bont, ezert allitasonkent futtatunk (trigger-torzs egyben).
const TABLA = 'CREATE TABLE IF NOT EXISTS schema_migrations (nev TEXT PRIMARY KEY, alkalmazva INTEGER NOT NULL)';

/** SQL szoveg -> allitasok listaja; a CREATE TRIGGER ... BEGIN ... END; egy allitas. */
export function allitasokra(sql) {
  const sorok = String(sql).replace(/\r\n/g, '\n').split('\n');
  const ki = [];
  let aktualis = [];
  let triggerben = false;
  for (const sor of sorok) {
    const tiszta = sor.replace(/--.*$/, '').trim();
    if (!tiszta && !aktualis.length) continue;
    aktualis.push(sor);
    if (!triggerben && /^CREATE\s+(TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i.test(aktualis.map((s) => s.replace(/--.*$/, '').trim()).filter(Boolean)[0] || '')) triggerben = true;
    if (triggerben) { if (/^END\s*;$/i.test(tiszta)) { ki.push(aktualis.join('\n')); aktualis = []; triggerben = false; } continue; }
    if (tiszta.endsWith(';')) { ki.push(aktualis.join('\n')); aktualis = []; }
  }
  const maradek = aktualis.join('\n').replace(/--.*$/gm, '').trim();
  if (maradek) ki.push(aktualis.join('\n'));
  return ki.filter((s) => s.replace(/--.*$/gm, '').trim());
}

/** a meg nem alkalmazott migraciok sorrendben; migraciok = [{nev, sql}] */
export async function alkalmaz(db, migraciok, { most = () => Math.floor(Date.now() / 1000) } = {}) {
  await db.prepare(TABLA).run();
  const { results } = await db.prepare('SELECT nev FROM schema_migrations').all();
  const kesz = new Set(results.map((r) => r.nev));
  const uj = [];
  for (const m of migraciok) {
    if (kesz.has(m.nev)) continue;
    for (const a of allitasokra(m.sql)) await db.prepare(a).run();
    await db.prepare('INSERT OR IGNORE INTO schema_migrations (nev, alkalmazva) VALUES (?, ?)').bind(m.nev, most()).run();
    uj.push(m.nev);
  }
  return { alkalmazva: uj };
}

const memo = new WeakMap();
/** egy isolate-on egyszer: a hivo (Pages Function) ezt hivja minden kerés elott; a hiba nem kerul memoba (ujraprobalkozas) */
export function biztosit(db, migraciok) {
  if (!memo.has(db)) {
    const p = alkalmaz(db, migraciok).catch((e) => { memo.delete(db); throw e; });
    memo.set(db, p);
  }
  return memo.get(db);
}
