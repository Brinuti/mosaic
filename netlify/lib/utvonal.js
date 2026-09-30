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

// A Wix nehany oldala tobbszintu cimen el; a klonban lapos fajlnevvel mentettuk.
const ALNEVEK = { 'pricing-plans/list': 'pricing-plans-list' };

export function utvonal(ut, ua) {
  // fajlok (assets, sitemap, robots stb.) es a Netlify sajat utvonalai: valtozatlanul
  if (/^\/(assets|\.netlify|_a|_m)\//.test(ut)) return null;
  if (/\.[a-z0-9]{2,5}$/i.test(ut) && !/\.html$/i.test(ut)) return null;
  // a regi klon-cimek es a per jel a vegen: 301 a Wix-szel azonos cimre
  let tiszta = ut.replace(/^\/m\//, '/').replace(/\.html$/i, '').replace(/\/index$/, '/');
  if (tiszta.length > 1) tiszta = tiszta.replace(/\/+$/, '');
  if (!tiszta) tiszta = '/';
  if (tiszta !== ut) return { atiranyit: tiszta };
  // a blogbejegyzest a Wix a /post/ elotaggal is kiszolgalja (atiranyitas nelkul)
  // a nyitooldal fajlja 'fooldal' (a Netlify az 'index' nevet mappa-kezdolapnak venne
  // es /_a/-ra iranyitana at)
  const nev = ut === '/' ? 'fooldal' : (ALNEVEK[ut.slice(1)] || ut.slice(1).replace(/^post\//, ''));
  return { atir: (TELEFON.test(ua || '') ? '/_m/' : '/_a/') + nev };
}
