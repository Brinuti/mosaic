// Leiratkozas az automatikus e-mailekrol (Feri kerese, 2026-10-20): minden vendegnek kimeno level lablecen "Leiratkozas" link van.
//   /u/<kod>  (<kod> = a foglalas tokenje, mint az /f/ es /m/ linkeknel)
//     GET  -> megerosito oldal (gombbal); NEM valtoztat semmit (a levelezo-botok linkellenorzese nem iratkoztat le)
//     POST -> a leiratkozas (ez az RFC 8058 egykattintasos "List-Unsubscribe-Post" cime is)
// A leiratkozott cim a `leiratkozasok` tablaban van, CSAK SHA-256 hash-kent (e-mail nelkul); a foglalas szemelyes adatainak 60 napos torlese ezt nem erinti.
// A motor kuldes elott ellenorzi (engine.js tick): leiratkozott cimre semmilyen vendeg-e-mail nem megy ki (SMS nem erintett).
export const LEIRATKOZAS_SEMA = 'CREATE TABLE IF NOT EXISTS leiratkozasok (email_h TEXT PRIMARY KEY, ido INTEGER NOT NULL, forras TEXT)';

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const emailNorm = (e) => String(e || '').trim().toLowerCase();
/** A cim SHA-256 hash-e (kisbetusitve, szokoz nelkul). */
export async function emailHash(email) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(emailNorm(email))));
}

export const LEIRATKOZAS_KOD = /^[0-9a-f]{10}$/;
export const leiratkozasUrl = (base, token) => `${base}/u/${token}`;

let kesz = new WeakSet();
/** A tabla letrehozasa, ha meg nincs (idempotens; DB-nkent egyszer). */
export async function biztosit(db) {
  if (!db || kesz.has(db)) return;
  await db.prepare(LEIRATKOZAS_SEMA).run();
  kesz.add(db);
}

/** Leiratkozott-e ez a cim? (nincs cim / hiba: nem) */
export async function leiratkozott(db, email) {
  if (!db || !emailNorm(email)) return false;
  try {
    await biztosit(db);
    const r = await db.prepare('SELECT 1 AS x FROM leiratkozasok WHERE email_h = ?1').bind(await emailHash(email)).first();
    return !!r;
  } catch { return false; }
}

/** A megerosito oldalhoz: melyik uzletag + leiratkozott-e mar. null: ismeretlen kod. */
export async function leiratkozasNezet(db, token) {
  if (!LEIRATKOZAS_KOD.test(String(token || ''))) return null;
  const f = await db.prepare('SELECT email, uzletag FROM foglalasok WHERE token = ?1').bind(String(token)).first();
  if (!f) return null;
  return { uzletag: f.uzletag, mar: f.email ? await leiratkozott(db, f.email) : false, vanEmail: !!f.email };
}

/** A leiratkozas vegrehajtasa: a cim a listara kerul, a fuggo e-mail uzenetei (minden foglalasarol, ugyanarra a cimre) torlodnek. */
export async function leiratkoztat(db, token, most, forras = 'link') {
  if (!LEIRATKOZAS_KOD.test(String(token || ''))) return { ok: false };
  const f = await db.prepare('SELECT id, email, uzletag FROM foglalasok WHERE token = ?1').bind(String(token)).first();
  if (!f || !emailNorm(f.email)) return { ok: false };
  await biztosit(db);
  await db.prepare('INSERT OR IGNORE INTO leiratkozasok (email_h, ido, forras) VALUES (?1, ?2, ?3)').bind(await emailHash(f.email), most, forras).run();
  const t = await db.prepare("UPDATE kuldesek SET allapot = 'torolve', ok = 'leiratkozott' WHERE allapot = 'fuggoben' AND csatorna = 'email' AND foglalas_id IN (SELECT id FROM foglalasok WHERE lower(trim(email)) = ?1)").bind(emailNorm(f.email)).run();
  const torolt = Number(t && t.meta && t.meta.changes) || 0;
  await db.prepare("INSERT INTO esemenyek (ido, tipus, foglalas_id, forras_id, reszlet) VALUES (?1, 'leiratkozas', ?2, NULL, ?3)").bind(most, f.id, JSON.stringify({ uzletag: f.uzletag, torolt_uzenet: torolt, forras })).run();
  return { ok: true, uzletag: f.uzletag, torolt };
}
