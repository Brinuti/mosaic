// MOSAIC Booking Engine - a "jegyzettomb" bongeszo-oldala: a foglalasi esemeny kuldese es az utolso foglalas idejenek olvasasa.
// A szerver-oldali resz: functions/api/foglalas-esemeny.js (netlify/lib/foglalas-esemeny.js). Tiszta fuggvenyek (egyseg-tesztelhetok).
//
// Az iras CSAK akkor megy, ha a foglalas valodi (a Salonic atiranyitasa a motor vart foglalasat igazolta); a szerver az elesen alapbol
// kikapcsolt (ESEMENY_IRAS), ezert az iras hivasa elesben addig semmit nem tarol.

export const VEGPONT = '/api/foglalas-esemeny';

/** A beirando jelzes: a motor vart valasztasa + a Salonic atiranyitasanak vendeg-azonositoja. null, ha valami hianyzik (akkor nem irunk). */
export function irasAdat(business, expected, ellenorzes) {
  // a Salonic atiranyitasa a vendeg-azonositot "g:2038420" alakban adja: az elotag nelkuli szam az azonosito
  const vendeg = String((ellenorzes && ellenorzes.reported && ellenorzes.reported.guestId) ?? '').replace(/^g:/, '');
  if (!business || !expected || !/^\d{1,12}$/.test(vendeg) || expected.serviceId === undefined || expected.serviceId === null || !Number.isFinite(expected.startUnix)) return null;
  return { uzletag: business, szolgaltatas: String(expected.serviceId), kezdes: expected.startUnix, vendeg };
}

/** Az olvaso cim: a kezeles osszes valtozata (pl. normal / egyeni) egyben, a legujabb foglalas szamit. */
export const olvasUrl = (business, serviceIds) => `${VEGPONT}?uzletag=${encodeURIComponent(business)}&szolgaltatas=${[...new Set(serviceIds.map(String))].map(encodeURIComponent).join(',')}`;

/**
 * Az utolso foglalas kora PERCBEN a megjeleniteskor: a szerver altal megadott kor (a megerkezeskor) + azota eltelt ido a bongeszo oraja szerint
 * (csak az eltelt idot merjuk a sajat orankkal; maga az idopont a szerver ideje). null, ha nincs ervenyes adat.
 */
export function utolsoFoglalasPerc(valasz, megerkezettMs, nowMs) {
  if (!valasz || !Number.isFinite(valasz.kor_ms) || valasz.kor_ms < 0) return null;
  return (valasz.kor_ms + Math.max(0, nowMs - megerkezettMs)) / 60000;
}
