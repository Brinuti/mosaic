// QA-2 eseménymodell (DECISION-LOG #97): ALAPESEMENYEK (FoglalasElso, Konzultacio, Visszajaro, Ajandekkartya) kulon maradnak; mellettuk SAJAT azonositoju ERNYOESEMENY sul el
// (erre optimalizal a Meta): HeadSpa / szor / PMU: Schedule; fodrasz: Fodrasz_AkviziciosFoglalas; oxigen: Oxigen_AkviziciosFoglalas.
// Az ernyobe NEM kerul: visszajaro, kupon. (DECISION #194 ota a kuponos foglalas semmilyen esemenyt nem kap: esemenyek() ures listat ad.) Azonosito: <esemeny>:<source_entity_id> (foglalasnal a booking_id, Stripe-kartyanal a pi_, utalasos kartyanal a sajat order_id).
// A dontes tiszta fuggveny (nincs I/O): tesztelheto, es a bongeszo / szerver ugyanazt a szabalyt latja.

export const UZLETAGAK = Object.freeze(['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']);
export const ALAPESEMENYEK = Object.freeze(['FoglalasElso', 'Konzultacio', 'Visszajaro', 'Ajandekkartya']);
export const ERNYOESEMENYEK = Object.freeze({ headspa: 'Schedule', szor: 'Schedule', pmu: 'Schedule', fodrasz: 'Fodrasz_AkviziciosFoglalas', oxigen: 'Oxigen_AkviziciosFoglalas' });
export const UZLETAG_NEV = Object.freeze({ headspa: 'HeadSpa', fodrasz: 'Fodrasz', oxigen: 'Oxigen', szor: 'Szor', pmu: 'PMU' }); // a meglevo Meta-esemenynevek elotagja (HeadSpa_FoglalasElso ...)
export const SALONIC_UZLETAG = Object.freeze({ 'mosaicheadspa.salonic.hu': 'headspa', 'mosaic-hair.salonic.hu': 'fodrasz', 'mosaic-oxigen.salonic.hu': 'oxigen', 'mosaic-elysion.salonic.hu': 'szor', 'mosaic-pmu.salonic.hu': 'pmu' });
export const SOURCE_ID_MINTA = /^(mb_[a-z0-9]{12,40}|pi_[A-Za-z0-9]{8,80}|ATU-[A-Z0-9]{4,12})$/;
// Salonic-direct safety net (DECISION #127 (b)): a SZERVER kepezi a Salonic-UUID-bol (HMAC), a bongeszo ilyet NEM irhat (az erkezesMent tovabbra is a SOURCE_ID_MINTA-t hasznalja).
export const SD_ID_MINTA = /^sd_[0-9a-f]{24}$/;

/**
 * UJ-62 (#167 6387024988): a HeadSpa ajandekkartya-vasarlas SZABVANYOS Meta Purchase esemenye (event_id = st-<PaymentIntent>, utalasnal st-<ATU-...>), a bongeszos Purchase-szal (GTM tag 213 mintaja) kozos azonositoval.
 * META_PURCHASE_MOD = ki (alap) | arnyek. 'arnyek': a Purchase CSAK a Meta ARNYEK datasetbe megy (teszt-kodos, platformok.js vedelmei), masik platformra soha. Minden mas ertek (az 'eles' is) = ki:
 * az eles pixelre kuldes KULON, Feri kulon mondatahoz kotott valtoztatas (nincs eles token / eles cel ebben a kodban).
 */
export const metaPurchaseMod = (env) => (String((env || {}).META_PURCHASE_MOD || '').trim().toLowerCase() === 'arnyek' ? 'arnyek' : 'ki');

const KONZULTACIO = /konzult|hajkamer/i; // ugyanaz a szabaly, mint a foglalo-motorban (business-config.js CONSULT)

/**
 * A KONZULTACIO esemeny erteke (DECISION-LOG #98 / #100 / #101: "a konzultacio a valos ertekevel megy"; nem a Salonic ara, ami ingyenes konzultacional 0 Ft, az oxigen akcios vizsgalatnal 4 990 Ft).
 * A rogzitett ertek (konfiguralhato tabla; a Salonic ara csak a naplo "salonic_ar" mezojeben latszik):
 *   szor 27 000 Ft (meres: 71% x 59% x 64 100 Ft), fodrasz 13 000 Ft (71% x 70% x 26 190 Ft, hipotezis, de rogzitett), PMU 13 800 Ft (#100 / #101),
 *   oxigen AKCIOS hajkamera-vizsgalat + konzultacio 8 900 Ft (#100 / #101; a vizsgalat dijat IS tartalmazza: nem adodik hozza a Salonic-ar).
 * HeadSpa: NINCS konzultacio-ag (#101): a HeadSpa "konzultacio" nevu foglalasbol nem kepzunk esemenyt (esemenyek() ures listat ad).
 * Ha egy uzletag erteke nincs (null), az esemeny NYITOTT: nem megy ki (sem 0-val, sem a Salonic araval), a naploban "nyitott".
 * Felulirhato / kiegeszitheto a MERES_KONZULTACIO_ERTEK kornyezeti valtozoval (JSON: {"oxigen": 8900}); egy helyen, kodvaltoztatas nelkul.
 */
export const KONZULTACIO_ERTEK = Object.freeze({ szor: 27000, fodrasz: 13000, oxigen: 8900, pmu: 13800 });
export function konzultacioTabla(env = {}) {
  let ext = {}; try { ext = env && env.MERES_KONZULTACIO_ERTEK ? JSON.parse(env.MERES_KONZULTACIO_ERTEK) : {}; } catch (e) { ext = {}; }
  const t = { ...KONZULTACIO_ERTEK };
  for (const u of UZLETAGAK) if (u !== 'headspa' && u in ext && (ext[u] === null || (Number.isFinite(Number(ext[u])) && Number(ext[u]) >= 0))) t[u] = ext[u] === null ? null : Math.round(Number(ext[u]));
  return t;
}
const KUPON = /kupon|coupon|^[^a-z0-9]*ajandekkartyaval\b/; // pl. "KUPONKODDAL - ... HeadSpa kezeles", "AJANDEKKARTYAVAL - ... HeadSpa kezeles" (DECISION #195: csak a szolgaltatasnev ELEJEN allo "ajandekkartyaval" szo); a bemenet a kuponJelzes()-ben normalizalt (ekezetmentes, kisbetus, lathatatlan karakterek nelkuli)
const LATHATATLAN = /[\u00AD\u180E\u200B-\u200F\u2060-\u2064\uFEFF]/g; // soft hyphen, zero-width space / joiner / non-joiner, bal-jobb jelek, word joiner, BOM
/**
 * A kupon-jelzes EGYETLEN felismeroje (DECISION #194 / #195; a motor, az sd, az ar-feloldas es az index-kulcs is ezt hasznalja): "kupon" vagy "coupon" a szovegben, illetve a szoveg ELEJEN allo "ajandekkartyaval" szo (nem vezeto betu/szam elottuk, pl. emoji vagy szokoz igen),
 * ekezet-fuggetlenul (NFD, a "KUPONKODDAL" es a "KUPONKÓDDAL" / "KÚPONKÓDDAL" egyarant), kis-nagybetu-fuggetlenul, a lathatatlan (zero-width) karakterek nelkul ("ku\u200Bpon").
 * Az "AJANDEKKARTYAVAL - ..." szolgaltatasnev-ELOTAG kuponosnak szamit (DECISION #195: a #194 elve szerint nem konverzio); a mondat kozepi "... (ajandekkartyaval is fizetheto)", az "ajandekkartyavalo" es az "Ajandekkartya bevaltas" (-val/-vel nelkul) NEM jelzes.
 */
export const kuponJelzes = (s) => KUPON.test(String(s ?? '').replace(LATHATATLAN, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());

/**
 * A foglalas jellege a Salonic-adatokbol. ujVendeg: a Salonic "Uj vendeg" jelzese (SZ-szabaly: a Salonic-level az igazsag; a bongeszos first_booking jelzes tartalek).
 * -> { jelleg: 'elso' | 'konzultacio' | 'visszajaro', kupon: bool }. A konzultacio csak uj vendegnel konzultacio (egyebkent visszajaro: nem szerzes).
 */
export function foglalasJelleg({ szolgaltatasNev = '', ujVendeg = null, kategoria = '' }) {
  const kupon = kuponJelzes(szolgaltatasNev) || kuponJelzes(kategoria);
  const konzultacio = KONZULTACIO.test(String(szolgaltatasNev));
  if (ujVendeg === false) return { jelleg: 'visszajaro', kupon };
  if (konzultacio) return { jelleg: 'konzultacio', kupon };
  return { jelleg: ujVendeg === true ? 'elso' : 'visszajaro', kupon }; // ismeretlen (null) = nem allitjuk, hogy uj vendeg
}

/**
 * Forras-entitas: { tipus: 'foglalas' | 'ajandekkartya', uzletag, source_entity_id, jelleg?, kupon?, ertek, penznem }.
 * -> az elkuldendo esemenyek: [{ nev, tipus: 'alap' | 'ernyo', esemeny_id, ertek, penznem }]
 */
export function esemenyek(fk, tabla = KONZULTACIO_ERTEK, opciok = {}) {
  if (!fk || !UZLETAGAK.includes(fk.uzletag)) return [];
  if (!SOURCE_ID_MINTA.test(String(fk.source_entity_id || '')) && !SD_ID_MINTA.test(String(fk.source_entity_id || ''))) return [];
  // DECISION #194 (Feri, 2026-10-17): a KUPONOS (ajandekkartyas) FOGLALAS NEM KONVERZIO, semmilyen csatornan: sem alapesemeny (FoglalasElso / Konzultacio / Visszajaro), sem ernyo (Schedule ...), sem Google-feltoltes.
  // A kupon-jelzest a foglalasJelleg adja (a szolgaltatas neveben / kategoriajaban "kupon"); a ketto kozul a motor (foglalas-esemeny.js) es a Salonic-direct (salonic-direct.js) is ezen a fuggvenyen at kepezi az esemenyeket.
  // Az ajandekkartya VASARLASA (tipus 'ajandekkartya') valtozatlan konverzio. A kuponos foglalas durva nyoma a meres_jelleg tablaban marad (kupon = 1).
  if (fk.tipus === 'foglalas' && fk.kupon) return [];
  const salonicAr = Number.isFinite(Number(fk.ertek)) ? Math.max(0, Math.round(Number(fk.ertek))) : 0; // a tenyleges ar (Salonic-level / Stripe)
  const penznem = 'HUF';
  const alap = fk.tipus === 'ajandekkartya' ? 'Ajandekkartya'
    : fk.jelleg === 'elso' ? 'FoglalasElso' : fk.jelleg === 'konzultacio' ? 'Konzultacio' : fk.jelleg === 'visszajaro' ? 'Visszajaro' : null;
  if (!alap) return [];
  if (fk.uzletag === 'headspa' && alap === 'Konzultacio') return []; // HeadSpa: nincs konzultacio-ag (#101)
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
  const ki = lista.map((e) => ({ ...e, esemeny_id: esemenyId(e.nev, fk.source_entity_id), ertek, penznem, salonic_ar: salonicAr, ertek_forras: ertekForras, nyitott, ...(nyitott ? { nyitott_ok: `a konzultacio erteke nincs rogzitve (${fk.uzletag}): nem kuldjuk sem 0-val, sem a Salonic araval` } : {}) }));
  // UJ-62: HeadSpa ajandekkartya-vasarlas -> szabvanyos Meta Purchase (csak ha az opciok kerik: META_PURCHASE_MOD=arnyek); csak a Meta platformra, sajat (st-) azonositoval
  if (opciok.metaPurchase && fk.tipus === 'ajandekkartya' && fk.uzletag === 'headspa') ki.push({ nev: 'Purchase', tipus: 'purchase', esemeny_id: `st-${fk.source_entity_id}`, ertek: salonicAr, penznem, salonic_ar: salonicAr, ertek_forras: 'tenyleges_ar', nyitott: false, csak_platform: Object.freeze(['meta']) });
  return ki;
}
export const esemenyId = (nev, sourceId) => `${nev}:${sourceId}`;

/** A meglevo Meta egyedi esemenynevek (HeadSpa_FoglalasElso, Fodrasz_Konzultacio ...) az alapesemenyhez; az ernyo neve valtozatlan. */
export const metaNev = (e, uzletag) => (e.tipus === 'ernyo' || e.tipus === 'purchase' ? e.nev : `${UZLETAG_NEV[uzletag]}_${e.nev}`); // az ernyo es a szabvanyos Purchase neve valtozatlan (nincs uzletag-elotag)
