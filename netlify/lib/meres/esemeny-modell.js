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
export function esemenyek(fk) {
  if (!fk || !UZLETAGAK.includes(fk.uzletag)) return [];
  if (!SOURCE_ID_MINTA.test(String(fk.source_entity_id || ''))) return [];
  const ertek = Number.isFinite(Number(fk.ertek)) ? Math.max(0, Math.round(Number(fk.ertek))) : 0;
  const penznem = 'HUF';
  const alap = fk.tipus === 'ajandekkartya' ? 'Ajandekkartya'
    : fk.jelleg === 'elso' ? 'FoglalasElso' : fk.jelleg === 'konzultacio' ? 'Konzultacio' : fk.jelleg === 'visszajaro' ? 'Visszajaro' : null;
  if (!alap) return [];
  const lista = [{ nev: alap, tipus: 'alap' }];
  // ernyo: visszajaro es kupon soha; HeadSpa: uj vendeg foglalasa + ajandekkartya; szor / PMU / fodrasz / oxigen: elso foglalas + konzultacio
  const ernyoJogosult = !fk.kupon && alap !== 'Visszajaro' && (fk.uzletag === 'headspa' ? (alap === 'FoglalasElso' || alap === 'Ajandekkartya') : (alap === 'FoglalasElso' || alap === 'Konzultacio'));
  if (ernyoJogosult) lista.push({ nev: ERNYOESEMENYEK[fk.uzletag], tipus: 'ernyo' });
  return lista.map((e) => ({ ...e, esemeny_id: esemenyId(e.nev, fk.source_entity_id), ertek, penznem }));
}
export const esemenyId = (nev, sourceId) => `${nev}:${sourceId}`;

/** A meglevo Meta egyedi esemenynevek (HeadSpa_FoglalasElso, Fodrasz_Konzultacio ...) az alapesemenyhez; az ernyo neve valtozatlan. */
export const metaNev = (e, uzletag) => (e.tipus === 'ernyo' ? e.nev : `${UZLETAG_NEV[uzletag]}_${e.nev}`);
