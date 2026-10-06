// ELETUT-esemenyek (DECISION-LOG #97 / #102): a foglalas letrehozasa UTAN bekovetkezo allapotok es a belolok kepzett korrekcio / diagnosztikai esemenyek. Tiszta fuggvenyek (nincs I/O).
//   letrehozva -> lemondva | nem_jelent_meg | megjelent        (a foglalasoknal; a letrehozas az alap- / ernyoesemeny, lasd esemeny-modell.js)
//   ajandekkartya: Stripe visszaterites (teljes / reszleges)    (korrekcio az eredeti vasarlasra)
// Mit kuld ki egy allapot:
//   lemondva        -> Google RETRACTION (a letrehozaskor kikuldott Google-konverzio visszavonasa)           ; Meta / TikTok: semmi (a lemondast a letrehozas elotti elo ellenorzes + ez a visszavonas kezeli)
//   nem_jelent_meg  -> Google RETRACTION + Meta / TikTok "<Uzletag>_NemJelentMeg" DIAGNOSZTIKAI esemeny (nem konverzio: nincs erteke)
//   megjelent       -> Meta / TikTok "<Uzletag>_Megjelent" DIAGNOSZTIKAI esemeny (nem konverzio)             ; Google: semmi (a konverzio mar kiment)
//   visszaterites   -> Google RETRACTION (teljes) / RESTATEMENT (reszleges: az uj ertek) + GA4 "refund"
// A Meta / TikTok a konverziot NEM tudja visszavonni, ezert ott a lemondas / visszaterites nem kap esemenyt; a pozitiv downstream (megjelent) a cel, a nem_jelent_meg csak diagnosztika.
import { UZLETAG_NEV } from './esemeny-modell.js';

export const ELETUT_ALLAPOTOK = Object.freeze(['lemondva', 'nem_jelent_meg', 'megjelent']);
const NEV = Object.freeze({ lemondva: 'Lemondva', nem_jelent_meg: 'NemJelentMeg', megjelent: 'Megjelent' });
/** Mit kuld az allapot: google = a Google-korrekcio tipusa (vagy null), diag = Meta / TikTok diagnosztikai esemeny. */
export const ELETUT_AKCIOK = Object.freeze({ lemondva: { google: 'RETRACTION', diag: false }, nem_jelent_meg: { google: 'RETRACTION', diag: true }, megjelent: { google: null, diag: true } });

/** Az eletut-esemeny azonositoja (Meta / TikTok event_id): <Allapot>:<source_entity_id> (kulon az alap- / ernyoesemeny azonositojatol). */
export const eletutEsemenyId = (allapot, sourceId) => `${NEV[allapot]}:${sourceId}`;
/** A diagnosztikai esemeny platform-neve: HeadSpa_Megjelent, PMU_NemJelentMeg ... (a meglevo <Uzletag>_<Esemeny> mintaval egyezoen). */
export const diagNev = (allapot, uzletag) => `${UZLETAG_NEV[uzletag]}_${NEV[allapot]}`;
/** A Google-korrekcio sorazonositoja a meres_kuldes tablaban: az eredeti (alap)esemeny azonositojabol. */
export const visszavonasId = (eredetiEsemenyId) => `Visszavonas:${eredetiEsemenyId}`;
export const korrekcioId = (eredetiEsemenyId, osszegFiller) => `Korrekcio:${eredetiEsemenyId}:${osszegFiller}`;
export const visszateritesId = (piId, osszegFiller) => `Visszaterites:${piId}:${osszegFiller}`;

/**
 * Allapotgep: egy foglalasnak EGY lezaro eletut-allapota lehet. Azonos allapot ismet = idempotens (az esetleg halasztott cellak ujraprobalhatok); barmilyen MAS allapot ELLENTMONDAS:
 * a mar kikuldott visszavonas / diagnosztika nem vonhato vissza csendben, ezert nem kuldunk ellentmondo esemenyt, hanem riasztas + kezi dontes.
 * -> { ok, idempotens?, miert? }
 */
export function atmenet(elozo, uj) {
  if (!ELETUT_ALLAPOTOK.includes(uj)) return { ok: false, miert: 'ismeretlen eletut-allapot' };
  if (!elozo) return { ok: true };
  if (elozo === uj) return { ok: true, idempotens: true };
  return { ok: false, miert: `ellentmondas: a foglalas allapota mar "${elozo}", az uj "${uj}"` };
}

/** Idoszeruseg: megjelent / nem_jelent_meg csak az idopont KEZDETE utan lehet (startUnix a kulcsbol: placeId|employeeId|startUnix). Ismeretlen kezdes = nincs korlat. */
export function idoRendben(allapot, startUnix, nowSec) {
  if (allapot === 'lemondva') return { ok: true };
  if (Number.isFinite(startUnix) && startUnix > 0 && nowSec < startUnix) return { ok: false, miert: 'korai: az idopont meg nem kezdodott el' };
  return { ok: true };
}

/** A kulcsbol (placeId|employeeId|startUnix) a kezdes unix ideje, vagy null. */
export const kezdesAKulcsbol = (kulcs) => { const m = /^\d+\|\d+\|(\d{9,11})$/.exec(String(kulcs || '')); return m ? Number(m[1]) : null; };
