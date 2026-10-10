// QA-4 VESZKAPCSOLO AZ UJ IRASOKRA (DECISION #120 / 2. pont: "a kill switch tenylegesen leallitja az uj parosito irast").
// A meres_kapcsolo tabla "iras" kulcsa (be = 0) VAGY a MERES_IRAS_KI=1 kornyezeti valtozo leallitja a meresi reteg MINDEN uj irasat:
//   - POST /api/foglalas-kulcs   (koszonooldali kulcs-iras)
//   - POST /api/meres-erkezes    (erkezesi adatok: kattintasazonositok, UTM, hozzajarulas)
//   - POST /api/foglalas-egyeztetes (levelek-oldali parositas, lemondas-kezeles, esemeny-elosztas)
// Az olvasasok (GET) es a kulcsos admin tovabbra is mennek. A platformokra kuldest a "mind" / "uzletag:*" / "platform:*" / "cella:*:*" kapcsolok allitjak le (elosztas.js).
// FAIL-OPEN: ha a kapcsolo nem olvashato (pl. a tabla meg nincs, D1-hiba), az irast NEM allitjuk le; a hiba pedig sosem terjed a vendeg felé (a kliens nem var valaszt).
export const IRAS_KULCS = 'iras';
const DDL = 'CREATE TABLE IF NOT EXISTS meres_kapcsolo (kulcs TEXT PRIMARY KEY, be INTEGER NOT NULL, ok TEXT, ido INTEGER NOT NULL) WITHOUT ROWID';

/** -> 'env' | 'kapcsolo' (ki van kapcsolva) | null (be van kapcsolva). Sosem dob hibat. */
export async function irasKi(db, env) {
  if (env && String(env.MERES_IRAS_KI) === '1') return 'env';
  if (!db) return null;
  try {
    const sor = await db.prepare('SELECT be FROM meres_kapcsolo WHERE kulcs = ?1').bind(IRAS_KULCS).first();
    return sor && Number(sor.be) === 0 ? 'kapcsolo' : null;
  } catch (e) { return null; }
}

/** Az "iras" kapcsolo allitasa (kulcsos /api/meres-admin {muvelet:'iras', be:false, ok:'...'}). */
export async function irasKapcsolo(db, { be, ok = null }, now = Date.now()) {
  await db.prepare(DDL).run();
  await db.prepare('INSERT INTO meres_kapcsolo (kulcs, be, ok, ido) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(kulcs) DO UPDATE SET be = excluded.be, ok = excluded.ok, ido = excluded.ido')
    .bind(IRAS_KULCS, be ? 1 : 0, ok, Math.floor(now / 1000)).run();
  return { ok: true, kulcs: IRAS_KULCS, be: !!be };
}

/** A 503-as valasz torzse, ha az irast a veszkapcsolo leallitotta (a hivo valasz() burkolja). */
export const IRAS_KI_VALASZ = Object.freeze({ ok: false, ki: true, miert: 'veszkapcsolo: az uj irasok ki vannak kapcsolva' });
