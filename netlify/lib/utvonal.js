// Oldal-utvonalak, pontosan ugy, mint a Wixen: minden oldal kiterjesztes nelkuli
// cimen el (https://www.mosaicheadspa.hu/headspa-budapest), es ugyanazon a cimen
// kapja a telefon a mobil, minden mas az asztali valtozatot. A Wix a bongeszo
// azonositoja (user agent) alapjan dontott, nem a kepernyo szelessege alapjan.
//
// Tiszta fuggveny: a Netlify edge-fuggvenye (oldal.js) es a helyi
// teszt-kiszolgalo (tools/serve-klon.mjs) is ezt hasznalja.
//
//   utvonal('/headspa-budapest', ua) -> { atir: '/_m/headspa-budapest' }
// A lapfajlok a dist/_a/ (asztali) es dist/_m/ (mobil) mappaban vannak; ezeket
// az edge-fuggveny nem dolgozza fel ujra (kulonben az atiras onmagat hivna).
//   utvonal('/headspa-budapest/', ua) -> { atiranyit: '/headspa-budapest' }   (301, mint a Wix)

export const TELEFON = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/i;

// A megszunt (lejart kuponos) foglalo-oldalak: 301 a fooldalra (a lekerdezes - UTM, click ID - megmarad). A tulajdonos dontese, 2026-10-04.
const MEGSZUNT = new Set(['/fodraszat-foglalas', '/kupon-utan-foglalas']);

// A Wix nehany oldala tobbszintu cimen el; a klonban lapos fajlnevvel mentettuk.
const ALNEVEK = { 'pricing-plans/list': 'pricing-plans-list' };
// A lezeres landing a fejlesztes alatt a /lezeres-szortelenites-budapest-uj cimen allt (noindex); az atvaltas (2026-10-04) utan az eredeti cimen el.
// A regi Wix-cimek (/contact, /services, /en) 404-et adtak, de a hirdetesekbol meg jon rajuk forgalom (2026-10-04): 301 a nyitooldalra
// (a lekerdezes - gclid, fbclid, utm_* - megmarad: a functions/[[path]].js hozzafuzi a url.search-et).
const ATIRANYITASOK = {
  '/fooldal-uj': '/',
  '/lezeres-szortelenites-budapest-uj': '/lezeres-szortelenites-budapest',
  '/headspa-budapest-uj': '/headspa-budapest',
  '/headspa-arak-budapest-uj': '/headspa-arak-budapest',
  '/head-spa-kedvezmeny-uj': '/head-spa-kedvezmeny',
  '/egyeni-headspa-budapest-uj': '/head-spa-kedvezmeny',   // az egyeni Head Spa landing 2026-10-09 ota az akcio oldal (a tulajdonos dontese)
  '/headspa-termekek-oxygeni-uj': '/headspa-termekek-oxygeni',
  '/head-spa-velemenyek-uj': '/head-spa-velemenyek',
  '/headspa-ferfiaknak-uj': '/headspa-ferfiaknak',
  '/headspa-budapest-hungary-uj': '/headspa-budapest-hungary',
  '/contact': '/', '/services': '/', '/en': '/',
};

export function utvonal(ut, ua) {
  // fajlok (assets, sitemap, robots stb.), a Netlify sajat utvonalai es az API (/api/ajandek/*): valtozatlanul
  if (/^\/(assets|\.netlify|_a|_m|api)\//.test(ut)) return null;
  if (/\.[a-z0-9]{2,5}$/i.test(ut) && !/\.html$/i.test(ut)) return null;
  // a regi klon-cimek es a per jel a vegen: 301 a Wix-szel azonos cimre
  // A cim elejen allo tobbszoros perjel / visszaper (pl. '//evil.example/', vagy %2F%2F dekodolva) a Location fejlecben
  // protokoll-relativ cimkent ertelmezodne (nyitott atiranyitas): egyetlen '/'-ra vonjuk ossze, es helyi cimre iranyitunk.
  let tiszta = ut.replace(/^[/\\]+/, '/').replace(/^\/m\//, '/').replace(/\.html$/i, '').replace(/\/index$/, '/');
  if (tiszta.length > 1) tiszta = tiszta.replace(/\/+$/, '');
  if (!tiszta) tiszta = '/';
  if (MEGSZUNT.has(tiszta)) return { atiranyit: '/' };
  // ideiglenes / regi cimek, amelyek az eles oldalra iranyitanak (301); a tisztitott cimre nezve, igy a '/en/' is egy lepesben ('/') er celba
  if (Object.hasOwn(ATIRANYITASOK, tiszta)) return { atiranyit: ATIRANYITASOK[tiszta] };
  if (tiszta !== ut) return { atiranyit: tiszta };
  // a blogbejegyzest a Wix a /post/ elotaggal is kiszolgalja (atiranyitas nelkul)
  // a nyitooldal fajlja 'fooldal' (a Netlify az 'index' nevet mappa-kezdolapnak venne
  // es /_a/-ra iranyitana at)
  const nev = ut === '/' ? 'fooldal' : (Object.hasOwn(ALNEVEK, ut.slice(1)) ? ALNEVEK[ut.slice(1)] : ut.slice(1).replace(/^post\//, ''));
  return { atir: (TELEFON.test(ua || '') ? '/_m/' : '/_a/') + nev };
}
