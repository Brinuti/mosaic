// A modellkereso napok foglalasainak tarolasa (Cloudflare D1: MP_MERES_DB, "mp-meres"; a fiok D1-kerete betelt, ezert a mar meglevo, MP sajat adatbazis; a tablak
// "modell_" eloteggel kulonulnek, a sorok "kornyezet" oszlopa (eles / elonezet) valasztja szet az eles es az elonezeti foglalasokat). A tablakat az elso hasznalatkor
// hozza letre (CREATE TABLE IF NOT EXISTS, mint a lib/meres/lanc.js). Nincs benne HTTP / level: csak adat es szabalyok (tesztelheto; tools/modell-teszt.mjs).
import { NAPOK, TIPUSOK, ERKEZES_ELOTT_PERC, nap as napKeres, tipus as tipusKeres, sav as savKeres, elsodlegesPar, elerhetoseg, kezdesEpoch, savKulcs } from './beosztas.js';

export const AKTIV = ['aktiv', 'tartva'];                 // ezek foglalnak helyet
export const TARTAS_PERC = 30;                             // a varolistas ajanlat ennyi ideig tartott
export const MAX_AKTIV_IP_NAPONTA = 5;                     // egy IP-rol naponta legfeljebb ennyi foglalas
export const MAX_PROBA = 5;                                // egy level kuldesenek probalkozasai
export const ADAT_MEGORZES_NAP = 30;                       // a szemelyes adatokat az utolso nap (nov. 30.) utan ennyi napig orizzuk, utana toroljuk (az urlapon is igy irjuk)

export const SEMA = [
  `CREATE TABLE IF NOT EXISTS modell_foglalas (
    id TEXT PRIMARY KEY, kornyezet TEXT NOT NULL, nap TEXT NOT NULL, tipus TEXT NOT NULL, ido TEXT NOT NULL, szerep TEXT NOT NULL,
    nev TEXT NOT NULL, kereszt TEXT, email TEXT NOT NULL, telefon TEXT NOT NULL, allapot TEXT NOT NULL DEFAULT 'aktiv',
    megerositve INTEGER, lemondva INTEGER, letrehozva INTEGER NOT NULL, tartva_eddig INTEGER, ip_hash TEXT, forras TEXT)`,
  // egy sav egyszerre csak egy aktiv / tartott foglalast tarthat (a kapacitas-ellenorzes az adatbazisban, versenyhelyzet nelkul)
  `CREATE UNIQUE INDEX IF NOT EXISTS modell_hely ON modell_foglalas (kornyezet, nap, tipus, ido) WHERE allapot IN ('aktiv', 'tartva')`,
  'CREATE INDEX IF NOT EXISTS modell_email ON modell_foglalas (kornyezet, email)',
  'CREATE INDEX IF NOT EXISTS modell_telefon ON modell_foglalas (kornyezet, telefon)',
  `CREATE TABLE IF NOT EXISTS modell_uzenet (
    id TEXT PRIMARY KEY, kornyezet TEXT NOT NULL, foglalas_id TEXT NOT NULL, tipus TEXT NOT NULL, kuldes_ido INTEGER NOT NULL,
    allapot TEXT NOT NULL DEFAULT 'varakozik', elkuldve INTEGER, probak INTEGER NOT NULL DEFAULT 0, hiba TEXT)`,
  'CREATE INDEX IF NOT EXISTS modell_uzenet_esedekes ON modell_uzenet (kornyezet, allapot, kuldes_ido)',
  `CREATE TABLE IF NOT EXISTS modell_varolista (
    id TEXT PRIMARY KEY, kornyezet TEXT NOT NULL, tipus TEXT NOT NULL, nap TEXT, nev TEXT NOT NULL, kereszt TEXT, email TEXT NOT NULL, telefon TEXT NOT NULL,
    letrehozva INTEGER NOT NULL, allapot TEXT NOT NULL DEFAULT 'var', ajanlat_id TEXT)`,
  'CREATE TABLE IF NOT EXISTS modell_beallitas (kulcs TEXT PRIMARY KEY, ertek TEXT)',
];
const kesz = new WeakSet();
export async function sema(db) {
  if (kesz.has(db)) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  kesz.add(db);
}

// ---- bemenet tisztitasa -------------------------------------------------------------------------------------------------------------------------------
export const azonosito = (hossz = 20) => {
  const b = new Uint8Array(hossz);
  crypto.getRandomValues(b);
  return [...b].map((x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
};
const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[A-Za-z]{2,}$/;
export const emailTisztit = (s) => { const e = String(s || '').trim().toLowerCase(); return e.length <= 120 && EMAIL_RE.test(e) ? e : null; };
/** Magyar mobil / vezetekes szam -> +36XXXXXXXXX (csak szamjegyek; 06 / 36 / +36 elotag), kulonben null. */
export function telefonTisztit(s) {
  let d = String(s || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('06')) d = '36' + d.slice(2); else if (d.startsWith('00')) d = d.slice(2);
  if (!/^36\d{8,9}$/.test(d)) return null;
  return '+' + d;
}
export const nevTisztit = (s) => { const n = String(s || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim(); return n.length >= 2 && n.length <= 80 ? n : null; };
/** A megszolitas: a keresztnev (az urlap kulon mezoje); ha nincs, a teljes nev (a magyar nevsorrendbol nem talalgatjuk ki). */
export const szolitas = (f) => (f && (f.kereszt || f.nev)) || '';

const hibasKiv = (e) => /UNIQUE|constraint/i.test(String((e && e.message) || e));

// ---- elerhetoseg ----------------------------------------------------------------------------------------------------------------------------------------
export async function foglaltSavok(db, korny) {
  const { results } = await db.prepare(`SELECT nap, tipus, ido FROM modell_foglalas WHERE kornyezet = ?1 AND allapot IN ('aktiv', 'tartva')`).bind(korny).all();
  return results || [];
}
export async function szabad(db, korny) {
  await sema(db);
  const nappok = elerhetoseg(await foglaltSavok(db, korny));
  const varolistan = Number((await db.prepare(`SELECT COUNT(*) AS db FROM modell_varolista WHERE kornyezet = ?1 AND allapot = 'var'`).bind(korny).first())?.db || 0);
  return { napok: nappok, fo: nappok.reduce((a, n) => a + n.fo, 0), szabadFo: nappok.reduce((a, n) => a + n.szabadFo, 0), szabadTartalek: nappok.reduce((a, n) => a + n.szabadTartalek, 0), varolistan };
}

// ---- foglalas ---------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Foglalas. Visszaad: { ok: true, id, foglalas } vagy { ok: false, hiba } (ervenytelen_sav | foglalt | nincs_elsodleges | mar_van | tul_sok | hibas_adat).
 * A kapacitast a modell_hely egyedi index vedi: ket egyideju foglalas kozul csak az egyik sikerul.
 */
export async function foglal(db, { korny, nap, tipus, ido, nev, kereszt = null, email, telefon, ipHash = null, forras = null, most = Math.floor(Date.now() / 1000), tartva = false, id = null }) {
  await sema(db);
  const s = savKeres(nap, tipus, ido);
  if (!s) return { ok: false, hiba: 'ervenytelen_sav' };
  const n = nevTisztit(nev), e = emailTisztit(email), t = telefonTisztit(telefon), k = kereszt ? nevTisztit(kereszt) : null;
  if (!n || !e || !t || (kereszt && !k)) return { ok: false, hiba: 'hibas_adat' };
  if (s.szerep === 'tartalek') {
    const par = elsodlegesPar(s);
    const parSor = await db.prepare(`SELECT 1 AS x FROM modell_foglalas WHERE kornyezet = ?1 AND nap = ?2 AND tipus = ?3 AND ido = ?4 AND allapot IN ('aktiv', 'tartva')`).bind(korny, par.datum, par.tipus, par.ido).first();
    if (!parSor) return { ok: false, hiba: 'nincs_elsodleges' };
  }
  if (!tartva) {
    const van = await db.prepare(`SELECT 1 AS x FROM modell_foglalas WHERE kornyezet = ?1 AND allapot IN ('aktiv', 'tartva') AND (email = ?2 OR telefon = ?3) LIMIT 1`).bind(korny, e, t).first();
    if (van) return { ok: false, hiba: 'mar_van' };
    if (ipHash) {
      const db24 = Number((await db.prepare('SELECT COUNT(*) AS db FROM modell_foglalas WHERE kornyezet = ?1 AND ip_hash = ?2 AND letrehozva >= ?3').bind(korny, ipHash, most - 86400).first())?.db || 0);
      if (db24 >= MAX_AKTIV_IP_NAPONTA) return { ok: false, hiba: 'tul_sok' };
    }
  }
  const fid = id || azonosito();
  const sorok = [db.prepare(`INSERT INTO modell_foglalas (id, kornyezet, nap, tipus, ido, szerep, nev, kereszt, email, telefon, allapot, letrehozva, tartva_eddig, ip_hash, forras) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`)
    .bind(fid, korny, nap, tipus, ido, s.szerep, n, k, e, t, tartva ? 'tartva' : 'aktiv', most, tartva ? most + TARTAS_PERC * 60 : null, ipHash, forras)];
  if (!tartva) sorok.push(...uzenetTerv({ id: fid, korny, nap, ido, most }).map((u) => db.prepare('INSERT OR IGNORE INTO modell_uzenet (id, kornyezet, foglalas_id, tipus, kuldes_ido) VALUES (?1, ?2, ?3, ?4, ?5)').bind(u.id, korny, fid, u.tipus, u.kuldes)));
  else sorok.push(db.prepare('INSERT OR IGNORE INTO modell_uzenet (id, kornyezet, foglalas_id, tipus, kuldes_ido) VALUES (?1, ?2, ?3, ?4, ?5)').bind(`${fid}:felajanlas`, korny, fid, 'felajanlas', most));
  try { await db.batch(sorok); } catch (err) {
    if (hibasKiv(err)) return { ok: false, hiba: 'foglalt' };
    throw err;
  }
  return { ok: true, id: fid, foglalas: await foglalasLekerdez(db, fid) };
}

/** A foglalashoz tartozo levelek terve: visszaigazolas azonnal; megerosito kerelem 48 oraval, emlekezteto 24 oraval a szuras elott (ha a foglalas elegge elore van). */
export function uzenetTerv({ id, korny, nap, ido, most }) {
  const kezdes = kezdesEpoch(nap, ido);
  const terv = [{ id: `${id}:t0`, tipus: 't0', kuldes: most }];
  if (kezdes - 48 * 3600 > most + 3600) terv.push({ id: `${id}:m48`, tipus: 'm48', kuldes: kezdes - 48 * 3600 });
  if (kezdes - 24 * 3600 > most + 3600) terv.push({ id: `${id}:m24`, tipus: 'm24', kuldes: kezdes - 24 * 3600 });
  return terv;
}

export async function foglalasLekerdez(db, id) {
  await sema(db);
  if (!/^[a-z0-9]{12,40}$/.test(String(id || ''))) return null;
  return (await db.prepare('SELECT * FROM modell_foglalas WHERE id = ?1').bind(id).first()) || null;
}

/** A foglalas megerositese ("Ott leszek"). Csak aktiv foglalasra. */
export async function megerosit(db, id, most = Math.floor(Date.now() / 1000)) {
  await sema(db);
  const f = await foglalasLekerdez(db, id);
  if (!f) return { ok: false, hiba: 'nincs' };
  if (f.allapot === 'tartva') return { ok: false, hiba: 'ajanlat', foglalas: f };
  if (f.allapot !== 'aktiv') return { ok: false, hiba: 'lemondva', foglalas: f };
  await db.prepare('UPDATE modell_foglalas SET megerositve = COALESCE(megerositve, ?2) WHERE id = ?1 AND allapot = ?3').bind(id, most, 'aktiv').run();
  return { ok: true, foglalas: await foglalasLekerdez(db, id) };
}

/** Lemondas: a sav felszabadul, lemondo level megy, a felszabadult helyre a varolistabol ajanlat. */
export async function lemond(db, id, most = Math.floor(Date.now() / 1000)) {
  await sema(db);
  const f = await foglalasLekerdez(db, id);
  if (!f) return { ok: false, hiba: 'nincs' };
  if (!AKTIV.includes(f.allapot)) return { ok: true, mar: true, foglalas: f };
  const r = await db.prepare(`UPDATE modell_foglalas SET allapot = 'lemondva', lemondva = ?2 WHERE id = ?1 AND allapot IN ('aktiv', 'tartva')`).bind(id, most).run();
  if (!Number(r?.meta?.changes || 0)) return { ok: true, mar: true, foglalas: await foglalasLekerdez(db, id) };
  if (f.allapot === 'tartva') await db.prepare(`UPDATE modell_varolista SET allapot = 'lemondta' WHERE ajanlat_id = ?1`).bind(id).run();
  else await db.prepare('INSERT OR IGNORE INTO modell_uzenet (id, kornyezet, foglalas_id, tipus, kuldes_ido) VALUES (?1, ?2, ?3, ?4, ?5)').bind(`${id}:lemondas`, f.kornyezet, id, 'lemondas', most).run();
  await felajanlKovetkezo(db, f.kornyezet, { nap: f.nap, tipus: f.tipus, ido: f.ido }, most);
  return { ok: true, foglalas: await foglalasLekerdez(db, id) };
}

/** Az aktiv helyet felszabaditjuk (pl. nem megerositett foglalas): mint a lemondas, de masik level. */
export async function felszabadit(db, id, most = Math.floor(Date.now() / 1000)) {
  const f = await foglalasLekerdez(db, id);
  if (!f || f.allapot !== 'aktiv') return false;
  const r = await db.prepare(`UPDATE modell_foglalas SET allapot = 'felszabadult', lemondva = ?2 WHERE id = ?1 AND allapot = 'aktiv'`).bind(id, most).run();
  if (!Number(r?.meta?.changes || 0)) return false;
  await db.prepare('INSERT OR IGNORE INTO modell_uzenet (id, kornyezet, foglalas_id, tipus, kuldes_ido) VALUES (?1, ?2, ?3, ?4, ?5)').bind(`${id}:felszabadult`, f.kornyezet, id, 'felszabadult', most).run();
  await felajanlKovetkezo(db, f.kornyezet, { nap: f.nap, tipus: f.tipus, ido: f.ido }, most);
  return true;
}

// ---- varolista --------------------------------------------------------------------------------------------------------------------------------------------
export async function varolistaFelvesz(db, { korny, tipus, nap = null, nev, kereszt = null, email, telefon, most = Math.floor(Date.now() / 1000) }) {
  await sema(db);
  if (!tipusKeres(tipus) || (nap && !napKeres(nap))) return { ok: false, hiba: 'hibas_adat' };
  const n = nevTisztit(nev), e = emailTisztit(email), t = telefonTisztit(telefon), k = kereszt ? nevTisztit(kereszt) : null;
  if (!n || !e || !t || (kereszt && !k)) return { ok: false, hiba: 'hibas_adat' };
  const van = await db.prepare(`SELECT id FROM modell_varolista WHERE kornyezet = ?1 AND email = ?2 AND tipus = ?3 AND allapot IN ('var', 'felajanlva')`).bind(korny, e, tipus).first();
  if (van) return { ok: true, mar: true, id: van.id };
  const id = azonosito();
  await db.prepare('INSERT INTO modell_varolista (id, kornyezet, tipus, nap, nev, kereszt, email, telefon, letrehozva) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)').bind(id, korny, tipus, nap || null, n, k, e, t, most).run();
  // ha a tipusbol epp van szabad (es a varolistas nem foglalhatott) hely, azonnal ajanlunk
  const sz = await szabad(db, korny);
  for (const d of sz.napok) {
    if (nap && d.datum !== nap) continue;
    const szabadSav = (d.tipusok[tipus] || []).find((x) => x.szabad);
    if (szabadSav) { await felajanlKovetkezo(db, korny, { nap: d.datum, tipus, ido: szabadSav.ido }, most); break; }
  }
  return { ok: true, id };
}

/** A felszabadult savra (nap, tipus, ido) a varolista elso, megfelelo tagjanak ajanlat (a hely TARTAS_PERC percig a sajatja). */
export async function felajanlKovetkezo(db, korny, { nap, tipus, ido }, most = Math.floor(Date.now() / 1000)) {
  const s = savKeres(nap, tipus, ido);
  if (!s) return null;
  if (s.szerep === 'tartalek') {   // a tartalek csak mellette allo elsodleges foglalassal ertelmes
    const par = elsodlegesPar(s);
    const p = await db.prepare(`SELECT 1 AS x FROM modell_foglalas WHERE kornyezet = ?1 AND nap = ?2 AND tipus = ?3 AND ido = ?4 AND allapot IN ('aktiv', 'tartva')`).bind(korny, par.datum, par.tipus, par.ido).first();
    if (!p) return null;
  }
  const foglalt = await db.prepare(`SELECT 1 AS x FROM modell_foglalas WHERE kornyezet = ?1 AND nap = ?2 AND tipus = ?3 AND ido = ?4 AND allapot IN ('aktiv', 'tartva')`).bind(korny, nap, tipus, ido).first();
  if (foglalt) return null;
  const jelolt = await db.prepare(`SELECT * FROM modell_varolista WHERE kornyezet = ?1 AND tipus = ?2 AND allapot = 'var' AND (nap IS NULL OR nap = ?3) ORDER BY letrehozva LIMIT 1`).bind(korny, tipus, nap).first();
  if (!jelolt) return null;
  const aktivVan = await db.prepare(`SELECT 1 AS x FROM modell_foglalas WHERE kornyezet = ?1 AND allapot IN ('aktiv', 'tartva') AND (email = ?2 OR telefon = ?3) LIMIT 1`).bind(korny, jelolt.email, jelolt.telefon).first();
  if (aktivVan) { await db.prepare(`UPDATE modell_varolista SET allapot = 'lemondta' WHERE id = ?1`).bind(jelolt.id).run(); return felajanlKovetkezo(db, korny, { nap, tipus, ido }, most); }
  const r = await foglal(db, { korny, nap, tipus, ido, nev: jelolt.nev, kereszt: jelolt.kereszt, email: jelolt.email, telefon: jelolt.telefon, forras: 'varolista', tartva: true, most });
  if (!r.ok) return null;
  await db.prepare(`UPDATE modell_varolista SET allapot = 'felajanlva', ajanlat_id = ?2 WHERE id = ?1`).bind(jelolt.id, r.id).run();
  return r.id;
}

/** A varolistas ajanlat elfogadasa: a tartott hely aktiv foglalas lesz, megkapja a visszaigazolo / emlekezteto leveleket. */
export async function ajanlatElfogad(db, id, most = Math.floor(Date.now() / 1000)) {
  await sema(db);
  const f = await foglalasLekerdez(db, id);
  if (!f) return { ok: false, hiba: 'nincs' };
  if (f.allapot === 'aktiv') return { ok: true, mar: true, foglalas: f };
  if (f.allapot !== 'tartva' || f.tartva_eddig < most) return { ok: false, hiba: 'lejart', foglalas: f };
  const sorok = [db.prepare(`UPDATE modell_foglalas SET allapot = 'aktiv', tartva_eddig = NULL, megerositve = ?2 WHERE id = ?1 AND allapot = 'tartva'`).bind(id, most),
    db.prepare(`UPDATE modell_varolista SET allapot = 'lefoglalta' WHERE ajanlat_id = ?1`).bind(id)];
  for (const u of uzenetTerv({ id, korny: f.kornyezet, nap: f.nap, ido: f.ido, most }).filter((x) => x.tipus !== 'm48')) {
    sorok.push(db.prepare('INSERT OR IGNORE INTO modell_uzenet (id, kornyezet, foglalas_id, tipus, kuldes_ido) VALUES (?1, ?2, ?3, ?4, ?5)').bind(u.id, f.kornyezet, id, u.tipus, u.kuldes));
  }
  await db.batch(sorok);
  return { ok: true, foglalas: await foglalasLekerdez(db, id) };
}

// ---- idozitett teendok (tick) -------------------------------------------------------------------------------------------------------------------------
/** Lejart ajanlatok (tartva_eddig <= most): a hely szabad, a varolistas lemarad, a kovetkezo kap ajanlatot. */
export async function lejartAjanlatok(db, korny, most = Math.floor(Date.now() / 1000)) {
  const { results } = await db.prepare(`SELECT * FROM modell_foglalas WHERE kornyezet = ?1 AND allapot = 'tartva' AND tartva_eddig <= ?2`).bind(korny, most).all();
  let db_ = 0;
  for (const f of results || []) {
    const r = await db.prepare(`UPDATE modell_foglalas SET allapot = 'lejart' WHERE id = ?1 AND allapot = 'tartva'`).bind(f.id).run();
    if (!Number(r?.meta?.changes || 0)) continue;
    await db.prepare(`UPDATE modell_varolista SET allapot = 'lejart' WHERE ajanlat_id = ?1`).bind(f.id).run();
    await felajanlKovetkezo(db, korny, { nap: f.nap, tipus: f.tipus, ido: f.ido }, most);
    db_ += 1;
  }
  return db_;
}

/** Nem megerositett foglalasok felszabaditasa a szuras elott `oraval` (kapcsolhato: MODELL_FELSZABADITAS). */
export async function megerositetlenek(db, korny, most, oraval) {
  const { results } = await db.prepare(`SELECT * FROM modell_foglalas WHERE kornyezet = ?1 AND allapot = 'aktiv' AND megerositve IS NULL AND letrehozva <= ?2`).bind(korny, most - 24 * 3600).all();
  let db_ = 0;
  for (const f of results || []) if (kezdesEpoch(f.nap, f.ido) - oraval * 3600 <= most && (await felszabadit(db, f.id, most))) db_ += 1;
  return db_;
}

/** Az utolso nap utan ADAT_MEGORZES_NAP nappal torli az osszes foglalast, uzenetet es varolista-sort (szemelyes adat: nev, e-mail, telefon). Visszaad: torolt sorok szama, vagy 0, ha meg nem jart le. */
export async function adatTorles(db, most = Math.floor(Date.now() / 1000)) {
  await sema(db);
  const utolso = NAPOK[NAPOK.length - 1].datum;
  if (most < kezdesEpoch(utolso, '23:59') + ADAT_MEGORZES_NAP * 86400) return 0;
  let db_ = 0;
  for (const t of ['modell_uzenet', 'modell_foglalas', 'modell_varolista']) db_ += Number((await db.prepare(`DELETE FROM ${t}`).run())?.meta?.changes || 0);
  return db_;
}

export async function beallitas(db, kulcs) { return (await db.prepare('SELECT ertek FROM modell_beallitas WHERE kulcs = ?1').bind(kulcs).first())?.ertek ?? null; }
export async function beallitasIr(db, kulcs, ertek) { await db.prepare('INSERT INTO modell_beallitas (kulcs, ertek) VALUES (?1, ?2) ON CONFLICT(kulcs) DO UPDATE SET ertek = excluded.ertek').bind(kulcs, String(ertek)).run(); }

/** Atlag a vezetonek (admin): darabszamok allapot szerint, nap / tipus szerint. Nyers szemelyes adat nelkul. */
export async function osszesites(db, korny) {
  await sema(db);
  const allapot = (await db.prepare('SELECT allapot, COUNT(*) AS db FROM modell_foglalas WHERE kornyezet = ?1 GROUP BY allapot').bind(korny).all()).results || [];
  const savonkent = (await db.prepare(`SELECT nap, tipus, COUNT(*) AS db, SUM(megerositve IS NOT NULL) AS megerositett FROM modell_foglalas WHERE kornyezet = ?1 AND allapot IN ('aktiv', 'tartva') GROUP BY nap, tipus ORDER BY nap, tipus`).bind(korny).all()).results || [];
  const varolista = (await db.prepare('SELECT allapot, COUNT(*) AS db FROM modell_varolista WHERE kornyezet = ?1 GROUP BY allapot').bind(korny).all()).results || [];
  const uzenetek = (await db.prepare('SELECT tipus, allapot, COUNT(*) AS db FROM modell_uzenet WHERE kornyezet = ?1 GROUP BY tipus, allapot').bind(korny).all()).results || [];
  return { allapot, savonkent, varolista, uzenetek };
}

export { NAPOK, TIPUSOK, ERKEZES_ELOTT_PERC, savKulcs };
