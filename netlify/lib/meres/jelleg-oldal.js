// UJ-68 (Feri 2026-10-25 / 10-26, #167): a foglalas JELLEGE (elso / konzultacio / visszajaro) a KOSZONOOLDALBOL es a szolgaltatas NEVEBOL, nem csak a Salonic "uj vendeg" jelzesebol.
// Miert: a Salonic-level "uj vendeg" jelzese egy mar korabban foglalt vendegnel false, igy a szor / oxigen / fodrasz uj szolgaltatasra szolo elso foglalasa vagy konzultacioja
// Visszajaro-kent ment ki (10-12..25: szor 2/4, oxigen 4/18, fodrasz 4/13). A szabaly (a meresi oldal, Feri):
//   szor    /elysion-ok, oxigen /oxigenterapia-ok  = MINDIG uj (elso alkalom): konzultacio, ha a szolgaltatas konzultacio, egyebkent FoglalasElso;
//   szor    /szortelenites-ok, oxigen /oxigenterapia-masodik = MINDIG visszajaro;
//   fodrasz es PMU: a "konzultacio" nevu szolgaltatas MINDIG Konzultacio (akkor is, ha a Salonic a vendeget mar ismeri);
//   HeadSpa: valtozatlan (nincs konzultacio-ag, #101); minden mas eset: valtozatlan (foglalasJelleg).
// A kupon-jelzes (DECISION #194 / #195) a foglalasJelleg-bol marad: ez a fuggveny csak a jelleget irja felul. A fuggveny tiszta (nincs I/O). Az esemeny-modell.js (vedett) NEM valtozik.
import { foglalasJelleg } from './esemeny-modell.js';

/** uzletag -> koszonooldal-utvonal -> 'uj' | 'visszajaro'. Csak ezek a parok szamitanak; mas oldal / uzletag: nincs oldal-szabaly. */
export const OLDAL_SZABALY = Object.freeze({
  szor: Object.freeze({ '/elysion-ok': 'uj', '/szortelenites-ok': 'visszajaro' }),
  oxigen: Object.freeze({ '/oxigenterapia-ok': 'uj', '/oxigenterapia-masodik': 'visszajaro' }),
});
/** Azok az uzletagak, ahol a "konzultacio" nevu szolgaltatas mindig Konzultacio. */
export const KONZULTACIO_NEV_UZLETAGOK = Object.freeze(['fodrasz', 'pmu']);

/** Az oldal URL-jebol (vagy utvonalabol) a kisbetus utvonal, hatso perjel nelkul; ures / ertelmezhetetlen: ''. */
export function oldalUtvonal(oldal) {
  const s = String(oldal ?? '').trim();
  if (!s) return '';
  let p = s;
  try { p = new URL(s, 'https://www.mosaicheadspa.hu').pathname; } catch (e) { return ''; }
  p = p.toLowerCase().replace(/\/+$/, '');
  return p || '/';
}

/** Vesz-kapcsolo (rollback kodvaltoztatas nelkul): MERES_JELLEG_OLDAL=0 -> a szabaly nem fut, a jelleg a regi (foglalasJelleg). Alapbol BE. */
export const jellegSzabalyKi = (env) => !!env && String(env.MERES_JELLEG_OLDAL) === '0';

const konzultacioNev = (szolgaltatasNev) => foglalasJelleg({ szolgaltatasNev, ujVendeg: true }).jelleg === 'konzultacio';

/**
 * kapott: a foglalasJelleg eredmenye { jelleg, kupon }; env: a MERES_JELLEG_OLDAL=0 vesz-kapcsolohoz (nincs env: a szabaly fut). -> { jelleg, kupon, szabaly, felulirva }
 * szabaly: 'oldal_uj' | 'oldal_visszajaro' | 'konzultacio_nev' | null; felulirva: a jelleg megvaltozott-e.
 */
export function jellegSzabaly({ uzletag, oldal = '', szolgaltatasNev = '', kapott, env = null }) {
  const kupon = !!(kapott && kapott.kupon);
  const marad = { jelleg: kapott ? kapott.jelleg : null, kupon, szabaly: null, felulirva: false };
  if (!kapott || jellegSzabalyKi(env)) return marad;
  const valt = (jelleg, szabaly) => ({ jelleg, kupon, szabaly, felulirva: jelleg !== kapott.jelleg });
  const tabla = OLDAL_SZABALY[uzletag];
  const szabalyOldal = tabla ? tabla[oldalUtvonal(oldal)] : undefined;
  if (szabalyOldal === 'visszajaro') return valt('visszajaro', 'oldal_visszajaro');
  if (szabalyOldal === 'uj') return valt(konzultacioNev(szolgaltatasNev) ? 'konzultacio' : 'elso', 'oldal_uj');
  if (KONZULTACIO_NEV_UZLETAGOK.includes(uzletag) && konzultacioNev(szolgaltatasNev)) return valt('konzultacio', 'konzultacio_nev');
  return marad;
}
