// QA-2 eseménymodell (DECISION-LOG #97): ALAPESEMENYEK (FoglalasElso, Konzultacio, Visszajaro, Ajandekkartya) kulon maradnak; mellettuk SAJAT azonositoju ERNYOESEMENY sul el
// (erre optimalizal a Meta): HeadSpa / szor / PMU: Schedule; fodrasz: Fodrasz_AkviziciosFoglalas; oxigen: Oxigen_AkviziciosFoglalas.
// Az ernyobe NEM kerul: visszajaro, kupon. Azonosito: <esemeny>:<source_entity_id> (foglalasnal a booking_id, Stripe-kartyanal a pi_, utalasos kartyanal a sajat order_id).
// A dontes tiszta fuggveny (nincs I/O): tesztelheto, es a bongeszo / szerver ugyanazt a szabalyt latja.

export const UZLETAGAK = Object.freeze(['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']);
export const ALAPESEMENYEK = Object.freeze(['FoglalasElso', 'Konzultacio', 'Visszajaro', 'Ajandekkartya']);
export const ERNYOESEMENYEK = Object.freeze({ headspa: 'Schedule', szor: 'Schedule', pmu: 'Schedule', fodrasz: 'Fodrasz_AkviziciosFoglalas', oxigen: 'Oxigen_AkviziciosFoglalas' });
export const UZLETAG_NEV = Object.freeze({ headspa: 'HeadSpa', fodrasz: 'Fodrasz', oxigen: 'Oxigen', szor: 'Szor', pmu: 'PMU' }); // a meglevo Meta-esemenynevek elotagja (HeadSpa_FoglalasElso ...)
export const SALONIC_UZLETAG = Object.freeze({ 'mosaicheadspa.salonic.hu': 'headspa', 'mosaic-hair.salonic.hu': 'fodrasz', 'mosaic-oxigen.salonic.hu': 'oxigen', 'mosaic-elysion.salonic.hu': 'szor', 'mosaic-pmu.salonic.hu': 'pmu' });
export const SOURCE_ID_MINTA = /^(mb_[a-z0-9]{12,40}|pi_[A-Za-z0-9]{8,80}|ATU-[A-Z0-9]{4,12})$/;

const KONZULTACIO = /konzult|hajkamer/i; // ugyanaz a szabaly, mint a foglalo-motorban (business-config.js CONSULT)

/**
 * A KONZULTACIO esemeny erteke (DECISION-LOG #98: "a konzultacio a valos ertekevel megy", KONVERZIO-TERV 2.1 / 2.2; nem a Salonic ara, ami ingyenes konzultacional 0 Ft).
 * Kepelet: konzultacio erteke = (megjelent / BRUTTO foglalas) x (vendegge valas) x (atlagos elso foglalas) - Drive: KONVERZIO-KONZULTACIO-2026-09-28.md 3. pont.
 *   szor: 71% x 59% x 64 100 Ft = 27 000 Ft (merve);  fodrasz: 71% x 70% x 26 190 Ft = 13 000 Ft (a 70% / 71% HIPOTEZIS, de a rogzitett ertek);
 *   oxigen, pmu, headspa: NINCS rogzitett ertek (a terv szerint "nem elesitheto") -> null = NYITOTT: az esemeny NEM megy ki (sem 0-val, sem a Salonic araval), a naploban "nyitott".
 * Felulirhato / kiegeszitheto a MERES_KONZULTACIO_ERTEK kornyezeti valtozoval (JSON: {"oxigen": 4600}); egy helyen, kodvaltoztatas nelkul.
 */
export const KONZULTACIO_ERTEK = Object.freeze({ szor: 27000, fodrasz: 13000, oxigen: null, pmu: null, headspa: null });
export function konzultacioTabla(env = {}) {
  let ext = {}; try { ext = env && env.MERES_KONZULTACIO_ERTEK ? JSON.parse(env.MERES_KONZULTACIO_ERTEK) : {}; } catch (e) { ext = {}; }
  const t = { ...KONZULTACIO_ERTEK };
  for (const u of UZLETAGAK) if (u in ext && (ext[u] === null || (Number.isFinite(Number(ext[u])) && Number(ext[u]) >= 0))) t[u] = ext[u] === null ? null : Math.round(Number(ext[u]));
  return t;
}
const KUPON = /kupon/i;                    // pl. "KUPONKODDAL - ... HeadSpa kezeles"

/**
 * A foglalas jellege a Salonic-adatokbol. ujVendeg: a Salonic "Uj vendeg" jelzese (SZ-szabaly: a Salonic-level az igazsag; a bongeszos first_booking jelzes tartalek).
 * -> { jelleg: 'elso' | 'konzultacio' | 'visszajaro', kupon: bool }. A konzultacio csak uj vendegnel konzultacio (egyebkent visszajaro: nem szerzes).
 */
export function foglalasJelleg({ szolgaltatasNev = '', ujVendeg = null, kategoria = '' }) {
  const kupon = KUPON.test(String(szolgaltatasNev)) || KUPON.test(String(kategoria));
  const konzultacio = KONZULTACIO.test(String(szolgaltatasNev));
  if (ujVendeg === false) return { jelleg: 'visszajaro', kupon };
  if (konzultacio) return { jelleg: 'konzultacio', kupon };
  return { jelleg: ujVendeg === true ? 'elso' : 'visszajaro', kupon }; // ismeretlen (null) = nem allitjuk, hogy uj vendeg
}

/**
 * Forras-entitas: { tipus: 'foglalas' | 'ajandekkartya', uzletag, source_entity_id, jelleg?, kupon?, ertek, penznem }.
 * -> az elkuldendo esemenyek: [{ nev, tipus: 'alap' | 'ernyo', esemeny_id, ertek, penznem }]
 */
export function esemenyek(fk, tabla = KONZULTACIO_ERTEK) {
  if (!fk || !UZLETAGAK.includes(fk.uzletag)) return [];
  if (!SOURCE_ID_MINTA.test(String(fk.source_entity_id || ''))) return [];
  const salonicAr = Number.isFinite(Number(fk.ertek)) ? Math.max(0, Math.round(Number(fk.ertek))) : 0; // a tenyleges ar (Salonic-level / Stripe)
  const penznem = 'HUF';
  const alap = fk.tipus === 'ajandekkartya' ? 'Ajandekkartya'
    : fk.jelleg === 'elso' ? 'FoglalasElso' : fk.jelleg === 'konzultacio' ? 'Konzultacio' : fk.jelleg === 'visszajaro' ? 'Visszajaro' : null;
  if (!alap) return [];
  const lista = [{ nev: alap, tipus: 'alap' }];
  // ernyo: visszajaro es kupon soha; HeadSpa: uj vendeg foglalasa + ajandekkartya; szor / PMU / fodrasz / oxigen: elso foglalas + konzultacio
  const ernyoJogosult = !fk.kupon && alap !== 'Visszajaro' && (fk.uzletag === 'headspa' ? (alap === 'FoglalasElso' || alap === 'Ajandekkartya') : (alap === 'FoglalasElso' || alap === 'Konzultacio'));
  if (ernyoJogosult) lista.push({ nev: ERNYOESEMENYEK[fk.uzletag], tipus: 'ernyo' });
  // ertek: a tenyleges ar; KONZULTACIO (es a belole kepzett ernyo) a rogzitett konzultacio-ertek; ha az nincs rogzitve: NYITOTT (nem megy ki)
  const konz = alap === 'Konzultacio';
  const konzErtek = konz ? tabla[fk.uzletag] : undefined;
  const nyitott = konz && !(Number.isFinite(Number(konzErtek)) && konzErtek !== null);
  const ertek = konz ? (nyitott ? null : Math.round(Number(konzErtek))) : salonicAr;
  const ertekForras = konz ? 'konzultacio_tabla' : 'tenyleges_ar';
  return lista.map((e) => ({ ...e, esemeny_id: esemenyId(e.nev, fk.source_entity_id), ertek, penznem, salonic_ar: salonicAr, ertek_forras: ertekForras, nyitott, ...(nyitott ? { nyitott_ok: `a konzultacio erteke nincs rogzitve (${fk.uzletag}): nem kuldjuk sem 0-val, sem a Salonic araval` } : {}) }));
}
export const esemenyId = (nev, sourceId) => `${nev}:${sourceId}`;

/** A meglevo Meta egyedi esemenynevek (HeadSpa_FoglalasElso, Fodrasz_Konzultacio ...) az alapesemenyhez; az ernyo neve valtozatlan. */
export const metaNev = (e, uzletag) => (e.tipus === 'ernyo' ? e.nev : `${UZLETAG_NEV[uzletag]}_${e.nev}`);
