// GYOGYTORNASZOM.HU foglalomotor - D1 (SQLite) tarolas. A tablakat a kod hozza letre (CREATE TABLE IF NOT EXISTS, egyszer isolate-onkent).
// Adattermekek (docs/ADATTERKEP.md): munkamenet (24 ora / hozzajarulasnal 30 nap), foglalas (13 honap, alnevesitett), egyszeri koszono-token (15 perc),
// kampanylista (Google Ads kampany-ID -> brand), riasztas (csak technikai adat, 90 nap), meta. Szemelyes adat, szolgaltatasnev, nyers click-ID a
// foglalas-rekordban SOHA nincs (a nyers click-ID csak a munkamenet-rekordban, a lejaratig).
export const SEMA = [
  `CREATE TABLE IF NOT EXISTS gy_munkamenet (
    id_hash TEXT PRIMARY KEY, fajta TEXT NOT NULL DEFAULT 'm', letrehozva INTEGER NOT NULL, utolso INTEGER NOT NULL, lejar INTEGER NOT NULL,
    hozzajarulas TEXT NOT NULL DEFAULT 'nincs_dontes', fizetett INTEGER NOT NULL DEFAULT 0, belepes TEXT)`,
  `CREATE INDEX IF NOT EXISTS gy_munkamenet_lejar ON gy_munkamenet (lejar)`,
  `CREATE TABLE IF NOT EXISTS gy_foglalas (
    uuid TEXT PRIMARY KEY, letrehozva INTEGER NOT NULL, frissitve INTEGER NOT NULL, tipus TEXT NOT NULL, uj_vendeg TEXT NOT NULL DEFAULT 'ismeretlen',
    cimke TEXT NOT NULL, bizonyitek TEXT, hozzajarulas TEXT NOT NULL, allapot TEXT NOT NULL, salonic_id TEXT, igazolt INTEGER NOT NULL DEFAULT 0,
    esemeny_kiadva INTEGER NOT NULL DEFAULT 0, teszt INTEGER NOT NULL DEFAULT 0, parosito TEXT)`,
  `CREATE INDEX IF NOT EXISTS gy_foglalas_idopont ON gy_foglalas (letrehozva)`,
  `CREATE INDEX IF NOT EXISTS gy_foglalas_parosito ON gy_foglalas (parosito)`,
  `CREATE TABLE IF NOT EXISTS gy_token (
    hash TEXT PRIMARY KEY, uuid TEXT NOT NULL, tipus TEXT NOT NULL, ertek INTEGER NOT NULL, lejar INTEGER NOT NULL, hasznalt INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS gy_token_lejar ON gy_token (lejar)`,
  `CREATE TABLE IF NOT EXISTS gy_kampany (id TEXT PRIMARY KEY, nev TEXT, allapot TEXT, brand INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS gy_meta (kulcs TEXT PRIMARY KEY, ertek TEXT)`,
  `CREATE TABLE IF NOT EXISTS gy_riasztas (id INTEGER PRIMARY KEY AUTOINCREMENT, ido INTEGER NOT NULL, tipus TEXT NOT NULL, uuid TEXT, adat TEXT)`,
  `CREATE INDEX IF NOT EXISTS gy_riasztas_ido ON gy_riasztas (ido)`,
  // visszahivas-kerelem (a vendeg kifejezett kerese; az elo "Telefonos Idopont" urlap mezoi): nev, e-mail, telefon, surgosseg, hivhato idosav, rendelo. A PANASZ szovege
  // (egeszsegugyi adat) SOHA nincs tarolva: csak az ertesitesben (e-mail) halad at. Megorzes 60 nap (IDOK.visszahivas)
  `CREATE TABLE IF NOT EXISTS gy_visszahivas (
    id INTEGER PRIMARY KEY AUTOINCREMENT, letrehozva INTEGER NOT NULL, nev TEXT NOT NULL, email TEXT, tel TEXT NOT NULL, rendelo TEXT NOT NULL DEFAULT 'Oktogon',
    surgosseg TEXT, hivhato TEXT, oldal TEXT, ertesitve INTEGER NOT NULL DEFAULT 0, allapot TEXT NOT NULL DEFAULT 'uj')`,
  `CREATE INDEX IF NOT EXISTS gy_visszahivas_ido ON gy_visszahivas (letrehozva)`,
  // GY-22: fizetett erintesek naploja (7 napos last paid click, ARNYEK: csak ide ir). Adatminimum: pszeudonim latogato-hash, idobelyeg, normalizalt cimke, kampany / hirdetescsoport / hirdetes
  // ID, a celoldal UTVONALA (query nelkul), hozzajarulas-allapot, szabalyverzio. NINCS: nyers click-ID, nev, e-mail, telefon, IP, user-agent, teljes URL. Megorzes 37 nap.
  `CREATE TABLE IF NOT EXISTS gy_erintes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, projekt TEXT NOT NULL DEFAULT 'gyogytorna', latogato TEXT NOT NULL, ido INTEGER NOT NULL, cimke TEXT NOT NULL, bizonyitek TEXT,
    kampany TEXT, hirdetescsoport TEXT, hirdetes TEXT, oldal TEXT, hozzajarulas TEXT, szabaly_verzio TEXT)`,
  `CREATE INDEX IF NOT EXISTS gy_erintes_latogato ON gy_erintes (latogato, ido)`,
  `CREATE INDEX IF NOT EXISTS gy_erintes_ido ON gy_erintes (ido)`,
];

const kesz = new WeakSet();
export async function sema(db) {
  if (kesz.has(db)) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  // migracio: a Salonic-igazolas parositasahoz (hely + idopont HMAC); a mar letezo tablara is felkerul, a duplikalt oszlop hibajat elnyeljuk
  try { await db.prepare('ALTER TABLE gy_foglalas ADD COLUMN parosito_hely TEXT').run(); } catch (e) { /* mar megvan */ }
  for (const oszlop of ['kampany', 'hirdetescsoport', 'hirdetes']) { try { await db.prepare(`ALTER TABLE gy_foglalas ADD COLUMN ${oszlop} TEXT`).run(); } catch (e) { /* mar megvan */ } }
  for (const oszlop of ['lpc_cimke', 'lpc_bizonyitek', 'lpc_kampany', 'lpc_hirdetescsoport', 'lpc_hirdetes', 'kesoi_fizetett', 'lpc_verzio']) { try { await db.prepare(`ALTER TABLE gy_foglalas ADD COLUMN ${oszlop} TEXT`).run(); } catch (e) { /* mar megvan */ } }
  try { await db.prepare('ALTER TABLE gy_foglalas ADD COLUMN lpc_kora_nap INTEGER').run(); } catch (e) { /* mar megvan */ }
  for (const oszlop of ['email', 'surgosseg', 'hivhato']) { try { await db.prepare(`ALTER TABLE gy_visszahivas ADD COLUMN ${oszlop} TEXT`).run(); } catch (e) { /* mar megvan */ } }
  try { await db.prepare('CREATE INDEX IF NOT EXISTS gy_foglalas_parosito_hely ON gy_foglalas (parosito_hely)').run(); } catch (e) { /* */ }
  try { await db.prepare('CREATE INDEX IF NOT EXISTS gy_foglalas_salonic ON gy_foglalas (salonic_id)').run(); } catch (e) { /* */ }
  kesz.add(db);
}

export const PERC = 60, NAP = 86400;
export const IDOK = Object.freeze({
  inaktivitas: 30 * PERC,        // munkamenet: 30 perc inaktivitas
  munkamenetMax: 24 * 3600,      // legfeljebb 24 ora
  hozzajarulasMax: 30 * NAP,     // hozzajarulasnal 30 nap
  token: 15 * PERC,              // koszono-token: 15 perc, egyszer hasznalhato
  foglalas: 396 * NAP,           // 13 honap
  riasztas: 90 * NAP,
  visszahivas: 60 * NAP,         // visszahivas-kerelem (nev + telefon): 60 nap
  erintes: 37 * NAP,             // GY-22: fizetett erintesek naploja (7 nap hozzarendeles + 30 nap kesoi_fizetett + tartalek)
  kampanyFriss: 36 * 3600,       // a kampanylista "friss", ha az utolso sikeres frissites ennel nem regebbi
});

// --- munkamenet ---------------------------------------------------------------------------------------------------------
/**
 * fajta: 'm' = munkamenet (30 perc inaktivitas, max 24 ora, hozzajarulas nelkul is) | 'l' = 30 napos "utolso fizetett erintes" (CSAK hozzajarulassal, inaktivitas-szabaly nincs).
 * @returns {Promise<null|{id_hash, fajta, letrehozva, utolso, lejar, hozzajarulas, fizetett, belepes}>} lejart rekordot nem ad vissza (es torli).
 */
export async function munkamenetOlvas(db, idHash, most) {
  const r = await db.prepare('SELECT id_hash, fajta, letrehozva, utolso, lejar, hozzajarulas, fizetett, belepes FROM gy_munkamenet WHERE id_hash = ?').bind(idHash).first();
  if (!r) return null;
  if (r.lejar <= most || (r.fajta === 'm' && most - r.utolso > IDOK.inaktivitas)) {
    await db.prepare('DELETE FROM gy_munkamenet WHERE id_hash = ?').bind(idHash).run();
    return null;
  }
  let belepes = null;
  try { belepes = r.belepes ? JSON.parse(r.belepes) : null; } catch (e) { belepes = null; }
  return { ...r, belepes, fizetett: !!r.fizetett };
}

export async function munkamenetIr(db, { idHash, fajta = 'm', letrehozva, utolso, lejar, hozzajarulas, fizetett, belepes }) {
  await db.prepare(
    `INSERT INTO gy_munkamenet (id_hash, fajta, letrehozva, utolso, lejar, hozzajarulas, fizetett, belepes) VALUES (?1, ?8, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(id_hash) DO UPDATE SET utolso = ?3, lejar = ?4, hozzajarulas = ?5, fizetett = ?6, belepes = ?7`,
  ).bind(idHash, letrehozva, utolso, lejar, hozzajarulas, fizetett ? 1 : 0, belepes ? JSON.stringify(belepes) : null, fajta).run();
}

export const munkamenetTorol = (db, idHash) => db.prepare('DELETE FROM gy_munkamenet WHERE id_hash = ?').bind(idHash).run();

// --- foglalas -----------------------------------------------------------------------------------------------------------
export async function foglalasOlvas(db, uuid) {
  return db.prepare('SELECT * FROM gy_foglalas WHERE uuid = ?').bind(uuid).first();
}

/** Idempotens letrehozas: ugyanarra az UUID-ra masodszor nem hoz letre ujat. @returns {Promise<boolean>} true, ha most jott letre */
export async function foglalasLetrehoz(db, f, most) {
  const r = await db.prepare(
    `INSERT OR IGNORE INTO gy_foglalas (uuid, letrehozva, frissitve, tipus, uj_vendeg, cimke, bizonyitek, hozzajarulas, allapot, salonic_id, igazolt, esemeny_kiadva, teszt, parosito, parosito_hely, kampany, hirdetescsoport, hirdetes,
       lpc_cimke, lpc_bizonyitek, lpc_kampany, lpc_hirdetescsoport, lpc_hirdetes, lpc_kora_nap, kesoi_fizetett, lpc_verzio)
     VALUES (?1, ?2, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, 0, 0, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)`,
  ).bind(f.uuid, most, f.tipus, f.uj_vendeg, f.cimke, f.bizonyitek, f.hozzajarulas, f.allapot, f.teszt ? 1 : 0, f.parosito || null, f.parosito_hely || null, f.kampany || null, f.hirdetescsoport || null, f.hirdetes || null,
    f.lpc_cimke || null, f.lpc_bizonyitek || null, f.lpc_kampany || null, f.lpc_hirdetescsoport || null, f.lpc_hirdetes || null, Number.isInteger(f.lpc_kora_nap) ? f.lpc_kora_nap : null, f.kesoi_fizetett || null, f.lpc_verzio || null).run();
  return !!(r.meta && r.meta.changes);
}

export const FOGLALAS_ALLAPOTOK = Object.freeze(['fuggo', 'aktiv', 'modositott', 'lemondott', 'bizonytalan']);
export async function foglalasAllapot(db, uuid, allapot, most, mezok = {}) {
  if (!FOGLALAS_ALLAPOTOK.includes(allapot)) throw new Error('ervenytelen_allapot');
  await db.prepare('UPDATE gy_foglalas SET allapot = ?2, frissitve = ?3, salonic_id = COALESCE(?4, salonic_id), igazolt = MAX(igazolt, ?5), parosito = COALESCE(?6, parosito) WHERE uuid = ?1')
    .bind(uuid, allapot, most, mezok.salonic_id || null, mezok.igazolt ? 1 : 0, mezok.parosito || null).run();
}

/** A Salonic-igazolas jeloltjei: meg nem igazolt, meg nem parositott foglalasok ugyanarra a hely + idopontra (HMAC). */
export async function igazolasJeloltek(db, parositoHely) {
  return (await db.prepare("SELECT uuid, allapot, teszt FROM gy_foglalas WHERE parosito_hely = ?1 AND salonic_id IS NULL AND allapot IN ('fuggo','aktiv','bizonytalan')").bind(parositoHely).all()).results || [];
}
export async function foglalasSalonicIdAlapjan(db, salonicId) {
  return db.prepare('SELECT uuid, allapot, igazolt FROM gy_foglalas WHERE salonic_id = ?').bind(salonicId).first();
}

/** Az esemeny-kiadas atomi jelolese: csak akkor sikerul (true), ha meg nem volt kiadva. */
export async function esemenyJelol(db, uuid, most) {
  const r = await db.prepare('UPDATE gy_foglalas SET esemeny_kiadva = 1, frissitve = ?2 WHERE uuid = ?1 AND esemeny_kiadva = 0').bind(uuid, most).run();
  return !!(r.meta && r.meta.changes);
}

// --- egyszeri koszono-token ---------------------------------------------------------------------------------------------
export async function tokenKiad(db, { hash, uuid, tipus, ertek, most }) {
  await db.prepare('INSERT INTO gy_token (hash, uuid, tipus, ertek, lejar, hasznalt) VALUES (?1, ?2, ?3, ?4, ?5, 0)').bind(hash, uuid, tipus, ertek, most + IDOK.token).run();
}

/** Atomi, egyszeri felhasznalas: a hasznalt / lejart / ismeretlen token null-t ad. A sor a felhasznalas utan torlodik (az ertek nem marad). */
export async function tokenFelhasznal(db, hash, most) {
  const r = await db.prepare('UPDATE gy_token SET hasznalt = 1 WHERE hash = ?1 AND hasznalt = 0 AND lejar > ?2').bind(hash, most).run();
  if (!(r.meta && r.meta.changes)) return null;
  const sor = await db.prepare('SELECT uuid, tipus, ertek FROM gy_token WHERE hash = ?').bind(hash).first();
  await db.prepare('DELETE FROM gy_token WHERE hash = ?').bind(hash).run();
  return sor || null;
}

// --- kampanylista (Google Ads) ------------------------------------------------------------------------------------------
export async function kampanyLista(db, most) {
  const sorok = (await db.prepare('SELECT id, nev, allapot, brand FROM gy_kampany').all()).results || [];
  const utolso = await db.prepare("SELECT ertek FROM gy_meta WHERE kulcs = 'kampany_frissites'").first();
  const t = utolso ? Number(utolso.ertek) : 0;
  return { lista: new Map(sorok.map((s) => [String(s.id), { brand: !!s.brand, nev: s.nev, allapot: s.allapot }])), friss: t > 0 && most - t <= IDOK.kampanyFriss, utolso: t || null };
}

/** A lista teljes cserele egy sikeres szinkronizalas utan. */
export async function kampanyFrissit(db, kampanyok, most) {
  const stmts = [db.prepare('DELETE FROM gy_kampany')];
  for (const k of kampanyok) stmts.push(db.prepare('INSERT INTO gy_kampany (id, nev, allapot, brand) VALUES (?, ?, ?, ?)').bind(String(k.id), k.nev ? String(k.nev).slice(0, 120) : null, k.allapot ? String(k.allapot).slice(0, 20) : null, k.brand ? 1 : 0));
  stmts.push(db.prepare("INSERT INTO gy_meta (kulcs, ertek) VALUES ('kampany_frissites', ?) ON CONFLICT(kulcs) DO UPDATE SET ertek = excluded.ertek").bind(String(most)));
  await db.batch(stmts);
}

// --- riasztas / takaritas ---------------------------------------------------------------------------------------------------
/** Csak technikai adat: tipus + (opcionalis) motor-UUID + rovid kod. Szemelyes / egeszsegugyi adat, URL, click-ID nem kerulhet ide. */
export async function riaszt(db, tipus, { uuid = null, adat = null, most } = {}) {
  const szoveg = adat === null ? null : String(typeof adat === 'string' ? adat : JSON.stringify(adat)).slice(0, 200);
  try { await db.prepare('INSERT INTO gy_riasztas (ido, tipus, uuid, adat) VALUES (?, ?, ?, ?)').bind(most, String(tipus).slice(0, 40), uuid, szoveg).run(); } catch (e) { /* a riasztas nem allithatja meg a kerest */ }
}

/** Automatikus torles a megorzesi idok szerint. A tulajdonos "13 honap" szabalya a foglalasra, 90 nap a riasztasra, a lejart munkamenet / token azonnal. */
export async function takarit(db, most) {
  await db.batch([
    db.prepare("DELETE FROM gy_munkamenet WHERE lejar <= ?1 OR (fajta = 'm' AND ?1 - utolso > ?2)").bind(most, IDOK.inaktivitas),
    db.prepare('DELETE FROM gy_token WHERE lejar <= ?').bind(most - 3600),
    db.prepare('DELETE FROM gy_foglalas WHERE letrehozva < ?').bind(most - IDOK.foglalas),
    db.prepare('DELETE FROM gy_riasztas WHERE ido < ?').bind(most - IDOK.riasztas),
    db.prepare('DELETE FROM gy_visszahivas WHERE letrehozva < ?').bind(most - IDOK.visszahivas),
    db.prepare('DELETE FROM gy_erintes WHERE ido < ?').bind(most - IDOK.erintes),
  ]);
}

// --- GY-22: fizetett erintesek naploja ------------------------------------------------------------------------------------------
export async function erintesUtolso(db, latogato) {
  return db.prepare('SELECT ido, kampany, hirdetescsoport, hirdetes, oldal FROM gy_erintes WHERE latogato = ? ORDER BY ido DESC, id DESC LIMIT 1').bind(latogato).first();
}
export async function erintesIr(db, e) {
  await db.prepare(
    `INSERT INTO gy_erintes (projekt, latogato, ido, cimke, bizonyitek, kampany, hirdetescsoport, hirdetes, oldal, hozzajarulas, szabaly_verzio) VALUES ('gyogytorna', ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
  ).bind(e.latogato, e.ido, e.cimke, e.bizonyitek || null, e.kampany || null, e.hirdetescsoport || null, e.hirdetes || null, e.oldal || null, e.hozzajarulas || null, e.szabaly_verzio || null).run();
}
/** A latogato fizetett erintesei az adott idopont (tol) utan, legujabb elol. */
export async function erintesek(db, latogato, tol) {
  return (await db.prepare('SELECT ido, cimke, bizonyitek, kampany, hirdetescsoport, hirdetes FROM gy_erintes WHERE latogato = ?1 AND ido >= ?2 ORDER BY ido DESC, id DESC').bind(latogato, tol).all()).results || [];
}
export const erintesTorol = (db, latogato) => db.prepare('DELETE FROM gy_erintes WHERE latogato = ?').bind(latogato).run();
/** Hibaszamlalo (fail-open): a naplo hibaja nem allithatja meg a foglalast; a szamlalo + riasztas jelzi. */
export async function lpcHiba(db, most, kod) {
  try {
    await db.prepare("INSERT INTO gy_meta (kulcs, ertek) VALUES ('lpc_hiba', '1') ON CONFLICT(kulcs) DO UPDATE SET ertek = CAST(ertek AS INTEGER) + 1").run();
    await riaszt(db, 'lpc_hiba', { adat: kod, most });
  } catch (e) { /* semmi */ }
}
