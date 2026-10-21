// A bongeszos Meta-esemeny (GTM web 213 tag, trigger 212; elo v54, 2026-10-21 kiolvasva) eseménynevenek PONTOS mása a meres_erkezes.bongeszo mezoibol, es a szerveres
// ARNYEK-nevvel valo osszevetes (napi QA-sor, UJ-12; #167 6321101806). Tiszta fuggveny, nincs I/O, nincs szemelyes adat (csak az utvonal, first_booking, ar, munkatars).
// Ha a GTM 213-as tag szabalya valtozik, ezt a fajlt kell kovetni (a teszt a 10-21-i szabalytablat rogziti).
import { metaNev } from './esemeny-modell.js';

// A 212-es trigger Page Path regexe (horgony nelkul): ezeken kivul (pl. /ajikartya-ok) a bongeszo NEM kuld Meta-esemenyt.
const TRIGGER_UT = /\/(fodrasz-ok|oxigenterapia-ok|oxigenterapia-masodik|elysion-ok|szortelenites-ok|pmu-ok|success-ajandekkartya|success-foglalas)/;

/**
 * -> a bongeszo Meta-esemenyneve (pl. 'Oxigen_Konzultacio'), vagy null, ha a 213-as tag nem kuld esemenyt.
 * @param {{ oldal?: string, first_booking?: boolean|null, ar?: number|null, munkatars?: string, bookingUrl?: string }} b a meres_erkezes.bongeszo JSON
 */
export function bongeszoMetaEsemeny(b) {
  if (!b || typeof b !== 'object') return null;
  let ut; try { ut = new URL(String(b.oldal || '')).pathname; } catch (e) { return null; }
  if (!TRIGGER_UT.test(ut)) return null;
  if (/\/success-ajandekkartya/.test(ut)) return null; // ajandekkartya: nem foglalas (mas, nem ebbe a szamlaloba tartozik)
  if (b.first_booking === null || b.first_booking === undefined || !b.bookingUrl) return null; // kapu: first_booking ES bookingUrl jelenlete
  const first = b.first_booking === true || b.first_booking === 1;
  const hasPrice = typeof b.ar === 'number' && Number.isFinite(b.ar);
  const price = hasPrice ? b.ar : null;
  const emp = String(b.munkatars || '');
  if (/\/success-foglalas/.test(ut)) return first ? 'HeadSpa_FoglalasElso' : 'HeadSpa_Visszajaro';
  if (/\/fodrasz-ok/.test(ut) && /Elysion/i.test(emp)) return !first ? 'Szor_Visszajaro' : hasPrice && price === 0 ? 'Szor_Konzultacio' : 'Szor_FoglalasElso';
  if (/\/fodrasz-ok/.test(ut)) return !first ? 'Fodrasz_Visszajaro' : hasPrice && price === 0 ? 'Fodrasz_Konzultacio' : 'Fodrasz_FoglalasElso';
  if (/\/oxigenterapia-masodik/.test(ut)) return 'Oxigen_Visszajaro';
  if (/\/oxigenterapia-ok/.test(ut)) return hasPrice && (price === 4990 || price === 0) ? 'Oxigen_Konzultacio' : !first ? 'Oxigen_Visszajaro' : 'Oxigen_FoglalasElso';
  if (/\/elysion-ok/.test(ut)) return !first ? 'Szor_Visszajaro' : hasPrice && price === 0 ? 'Szor_Konzultacio' : 'Szor_FoglalasElso';
  if (/\/szortelenites-ok/.test(ut)) return 'Szor_Visszajaro';
  if (/\/pmu-ok/.test(ut)) return !first ? 'PMU_Visszajaro' : 'PMU_Foglalas';
  return null;
}

export const NEV_OSZTALYOK = Object.freeze(['egyezik', 'pmu_lekepezes', 'besorolasi_elteres', 'kupon_utvonal', 'nincs_bongeszos_esemeny', 'nincs_erkezes']);

/**
 * Egy szerveres Meta ARNYEK alapesemeny osztalya a bongeszoi esemenyhez kepest (a MEGLEVO szerveres nev; a META_PMU_BONGESZOS_NEV kapcsolotol fuggetlenul a PMU alapneveivel szamol).
 * egyezik | pmu_lekepezes (a szerver PMU_FoglalasElso / PMU_Konzultacio, a bongeszo PMU_Foglalas) | besorolasi_elteres (mas nev: Salonic "uj vendeg" vs URL) |
 * kupon_utvonal (/ajikartya-ok: a bongeszo nem kuld) | nincs_bongeszos_esemeny (mas utvonal / kapu) | nincs_erkezes (nincs erkezesi sor).
 */
export function metaNevOsztaly({ uzletag, esemenyNev, bongeszo }) {
  if (!bongeszo || typeof bongeszo !== 'object' || !Object.keys(bongeszo).length) return 'nincs_erkezes';
  const bn = bongeszoMetaEsemeny(bongeszo);
  if (bn === null) return /\/ajikartya-ok/.test(String(bongeszo.oldal || '')) ? 'kupon_utvonal' : 'nincs_bongeszos_esemeny';
  const szerver = metaNev({ tipus: 'alap', nev: esemenyNev }, uzletag);
  if (bn === szerver) return 'egyezik';
  if (uzletag === 'pmu' && bn === 'PMU_Foglalas' && (szerver === 'PMU_FoglalasElso' || szerver === 'PMU_Konzultacio')) return 'pmu_lekepezes';
  return 'besorolasi_elteres';
}
