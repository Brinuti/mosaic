// QA-2 hozzajarulas (SZ-38, DECISION-LOG #96 / SZ-16): Meta es TikTok felé hozzájárulás nélkül is küldünk (a hozzájárulási állapot a naplóban látszik);
// Google Ads es GA4 felé a hozzájárulásjel MINDIG a valóság (GRANTED / DENIED, döntés nélkül: UNSPECIFIED / nem küldjük), és a Google felé hozzájárulás nélkül nincs hash-elt azonosító.
// A hozzájárulás a suti.js mh_cc objektumából jön: { ana, adv, fun, dontes? } (true / false / undefined).

export function hozzajarulasTisztit(h) {
  if (!h || typeof h !== 'object') return { ana: null, adv: null, fun: null, dontes: false };
  const b = (v) => (v === true ? true : v === false ? false : null);
  const ana = b(h.ana), adv = b(h.adv), fun = b(h.fun);
  return { ana, adv, fun, dontes: ana !== null || adv !== null };
}
const jel = (v, dontes) => (v === true ? 'GRANTED' : v === false ? 'DENIED' : dontes ? 'DENIED' : 'UNSPECIFIED');

/** -> { kuldheto, felhasznaloi_adat, fogyasztoi_jel, megjegyzes } az adott platformra. */
export function platformSzabaly(platform, hozz) {
  const h = hozzajarulasTisztit(hozz);
  const adJel = jel(h.adv, h.dontes);
  switch (platform) {
    case 'meta': case 'tiktok':
      return { kuldheto: true, felhasznaloi_adat: true, jel: { ad_user_data: adJel, ad_personalization: adJel }, megjegyzes: h.adv === true ? 'hozzajarulas: igen' : 'hozzajarulas nelkul is kuldjuk (SZ-38)' };
    case 'google':
      return { kuldheto: true, felhasznaloi_adat: h.adv === true, jel: { ad_user_data: adJel, ad_personalization: adJel }, megjegyzes: h.adv === true ? 'hozzajarulas: igen' : 'valos jel (' + adJel + '), hash-elt azonosito nelkul' };
    case 'ga4':
      return { kuldheto: true, felhasznaloi_adat: false, jel: { ad_user_data: adJel, ad_personalization: adJel }, megjegyzes: 'valos jel (' + adJel + '); a GA4 felé nincs hash-elt azonosito' };
    default: return { kuldheto: false, felhasznaloi_adat: false, jel: {}, megjegyzes: 'ismeretlen platform' };
  }
}
