// X1 (QA-3, 2026-10-07): a foglalas ALAPESEMENYENEK tipusa (FoglalasElso / Konzultacio / Visszajaro) es a kupon-jelzes FOGLALASONKENT az ELSO levelnel rogzul.
// Miert: a deduplikacio az esemeny_id-ra (<esemeny-nev>:<booking_id>) kulcsol. Ha ugyanarra a foglalasra ket level erkezik, es a "Salonic uj vendeg" jelzesuk elter
// (pl. az elo level uj_vendeg=igen, a Zap koveto levele a Salonic-vendegrekord miatt nem), a 2. level MASIK nevu alapesemenyt (Visszajaro) is kikuldene: egy foglalashoz ket alapesemeny-tipus.
// Szabaly: az elso level jellege marad; a kesobbi levelek jellege csak naplozodik (jelleg_rogzites.eltero), esemenyt nem kepez.
// Atomi: a rogzites egy INSERT OR IGNORE a source_id elsodleges kulcsan, ezert ket egyidejuleg beerkezo level kozul pontosan egy nyer.
// Visszamenoleges: ha a tablaban meg nincs sor, de a meres_kuldes-ben mar van alapesemeny a foglalashoz (a javitas elotti sorok), az elso ilyen alapesemeny jellege rogzul (forras: meglevo_sorok).
import { meresSema } from './elosztas.js';

const SEMA = 'CREATE TABLE IF NOT EXISTS meres_jelleg (source_id TEXT PRIMARY KEY, jelleg TEXT NOT NULL, kupon INTEGER NOT NULL, forras TEXT NOT NULL, ido INTEGER NOT NULL) WITHOUT ROWID';
const kesz = new WeakSet();
const ALAP_JELLEG = Object.freeze({ FoglalasElso: 'elso', Konzultacio: 'konzultacio', Visszajaro: 'visszajaro' });

/**
 * kapott: { jelleg, kupon } - ebbol a levelbol szamolt jelleg (foglalasJelleg). -> { jelleg, kupon, forras: 'elso_level' | 'meglevo_sorok', ujonnan: bool }
 * A visszaadott jelleg / kupon az, amibol az esemenyeket kepezni kell (az elso level, nem feltetlenul a mostani).
 */
export async function jellegRogzit(db, sourceId, kapott, now = Date.now()) {
  if (!kesz.has(db)) { await db.prepare(SEMA).run(); kesz.add(db); }
  const olvas = async () => db.prepare('SELECT jelleg, kupon, forras FROM meres_jelleg WHERE source_id = ?1').bind(sourceId).first();
  const meglevo = await olvas();
  if (meglevo) return { jelleg: meglevo.jelleg, kupon: !!meglevo.kupon, forras: meglevo.forras, ujonnan: false };

  let jelleg = kapott.jelleg, kupon = !!kapott.kupon, forras = 'elso_level';
  await meresSema(db); // a meres_kuldes tabla legyen meg (a foglalas-esemeny.js ugyis az elosztas-t hivja)
  const { results } = await db.prepare("SELECT esemeny_nev, esemeny_tipus FROM meres_kuldes WHERE source_id = ?1 AND esemeny_tipus IN ('alap', 'ernyo') ORDER BY id").bind(sourceId).all();
  const sorok = results || [];
  const alap = sorok.find((s) => s.esemeny_tipus === 'alap' && ALAP_JELLEG[s.esemeny_nev]);
  if (alap) { // a javitas elotti sorok: az elso alapesemeny jellege; kupon: elso / konzultacio jellegnel az ernyo hianya (a kupon nem kap ernyot), visszajaronal a kupon a kimenetet nem befolyasolja
    jelleg = ALAP_JELLEG[alap.esemeny_nev];
    kupon = jelleg === 'visszajaro' ? !!kapott.kupon : !sorok.some((s) => s.esemeny_tipus === 'ernyo');
    forras = 'meglevo_sorok';
  }
  const r = await db.prepare('INSERT OR IGNORE INTO meres_jelleg (source_id, jelleg, kupon, forras, ido) VALUES (?1, ?2, ?3, ?4, ?5)').bind(sourceId, jelleg, kupon ? 1 : 0, forras, Math.floor(now / 1000)).run();
  if (r.meta && r.meta.changes > 0) return { jelleg, kupon, forras, ujonnan: true };
  const nyertes = await olvas(); // egy masik, egyidejuleg erkezo level megelozott: az o jellege marad
  return nyertes ? { jelleg: nyertes.jelleg, kupon: !!nyertes.kupon, forras: nyertes.forras, ujonnan: false } : { jelleg, kupon, forras, ujonnan: false };
}
