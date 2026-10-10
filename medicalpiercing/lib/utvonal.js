// Oldal-utvonalak, pontosan ugy, mint a Wixen: minden oldal a Wix-szel azonos
// cimen el (pl. /varosok/bekescsaba vagy /fejfájás-elleni-piercing-...), es
// ugyanazon a cimen kapja a telefon a mobil, minden mas az asztali valtozatot
// (a Wix a bongeszo azonositoja alapjan dontott, nem a kepernyo szelessege alapjan).
//
// Tiszta fuggveny: a Cloudflare-fuggveny (functions/[[path]].js), a build es a
// helyi kiszolgalo (tools/serve.mjs) is ezt hasznalja.
//
//   utvonal('/rolunk', ua)  -> { atir: '/_a/rolunk' }   (telefonon '/_m/rolunk')
//   utvonal('/rolunk/', ua) -> { atiranyit: '/rolunk' }  (301, mint a Wix)

export const TELEFON = /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/i;

// A Wix-cimbol (dekodolt utvonal) a fajl neve: ekezet es irasjel nelkul.
// A dinamikus (CMS) oldalak <gyujtemeny>/<elem> alakuak; az elem neveben levo / is a nev resze.
export function kulcsbol(ut) {
  const t = ut.replace(/^\/+|\/+$/g, '');
  if (!t) return 'index';
  const [elso, ...tobbi] = t.split('/');
  const tisztit = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'oldal';
  return tobbi.length ? `${tisztit(elso)}/${tisztit(tobbi.join('/'))}` : tisztit(elso);
}

// a kezdolap fajlja nem lehet 'index' (a Cloudflare a mappa kezdolapjanak venne es atiranyitana)
export const fajlnev = (kulcs) => (kulcs === 'index' ? 'fooldal' : kulcs);

export function utvonal(ut, ua) {
  // fajlok (assets, sitemap, robots stb.), az API es a lapfajlok mappai: valtozatlanul
  if (/^\/(assets|_a|_m|api)\//.test(ut)) return null;
  if (/\.[a-z0-9]{2,5}$/i.test(ut)) return null;
  // a cim elejen allo tobb perjel nyitott atiranyitas lenne: egyre vonjuk ossze
  let tiszta = ut.replace(/^[/\\]+/, '/');
  if (tiszta.length > 1) tiszta = tiszta.replace(/\/+$/, '');
  if (tiszta !== ut) return { atiranyit: tiszta || '/' };
  // a blogbejegyzest a Wix a /post/ elotaggal is kiszolgalja
  const k = kulcsbol(tiszta.replace(/^\/post\//, '/'));
  return { atir: (TELEFON.test(ua || '') ? '/_m/' : '/_a/') + fajlnev(k) };
}
