// ADDITIV (visszafele kompatibilis) sema-bovites a D1-hez: hianyzo oszlopok felvetele (ALTER TABLE ... ADD COLUMN), idempotensen.
// A "CREATE TABLE IF NOT EXISTS" a mar meglevo tablat nem bovitheti; a safety net (DECISION #127 (b)) uj oszlopait ezert innen vesszuk fel, lustan, az elso kereskor.
// Egyidejuleg indulo ket kereses ugyanazt az oszlopot probalhatja felvenni: a "duplicate column" hiba itt NEM hiba.

/** oszlopok: [[nev, "TIPUS [NOT NULL] [DEFAULT ...]"], ...]. Visszaadja a tenylegesen felvett oszlopok neveit. */
export async function oszlopokBiztosit(db, tabla, oszlopok) {
  if (!/^[a-z_]+$/.test(tabla)) throw new Error('ervenytelen tablanev');
  const { results } = await db.prepare(`SELECT name FROM pragma_table_info('${tabla}')`).all();
  const van = new Set((results || []).map((r) => r.name));
  const felvett = [];
  for (const [nev, def] of oszlopok) {
    if (van.has(nev)) continue;
    if (!/^[a-z_]+$/.test(nev)) throw new Error('ervenytelen oszlopnev');
    try { await db.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${nev} ${def}`).run(); felvett.push(nev); }
    catch (e) { if (!/duplicate column/i.test(String(e && e.message || e))) throw e; }
  }
  return felvett;
}
