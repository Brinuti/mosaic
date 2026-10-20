// QA-2 hozzajarulas (SZ-38, DECISION-LOG #96 / SZ-16): a hozzájárulási állapot (suti.js mh_cc: { ana, adv, fun, dontes? }) a naplóban mindig látszik.
// DECISION #202 javitas (Feri, 2026-10-18: NINCS sutisav, minden platform ELFOGADOTT hozzajarulassal kapja az adatot; a #167 6273378563 szerint, 2026-10-19):
//   MINDEN platformra (Meta, TikTok, Google, GA4) felhasznaloi_adat = true es ad_user_data = ad_personalization = GRANTED, ha NINCS rogzitett dontes ("akkor is, ha nincs rogzitett dontes" - Feri).
//   KIVETEL (a DECISION a "valos hozzajarulas szerint" szoveget es a "tarolt sutielutasitasok maradnak" szabalyt nem irja felul, a dontes tartalmara szol, nem tobbre):
//   ha a vendeg bongeszojeben ROGZITETT dontes van, amely a hirdetesi hozzajarulast nem adja meg (adv !== true: elutasitas / visszavonas / reszleges), MINDEN platformra a regi, valos-jel szabaly marad
//   (Google / GA4: DENIED, hash nelkul; Meta / TikTok: valtozatlanul kap azonositot - SZ-38: hozzajarulas nelkul is -, a torzs nem valtozik, a naploban a valos szabaly latszik).
//   A korabbi szabaly (Google: dontes nelkul fix DENIED, hash nelkul; GA4: dontes nelkul nincs consent) a HeadSpa Google-feltoltesek 0 konverzios eredmenyet okozta (fix DENIED).
//   Visszagorgetes env-bol, kodvaltoztatas nelkul: MERES_HOZZAJARULAS_VALOS=1 -> a regi, valos-jel szerinti szabaly minden esetre (valosSzabaly); GA4: a regi szabaly dontes nelkul NEM kuldott consent-et (UNSPECIFIED).

export function hozzajarulasTisztit(h) {
  if (!h || typeof h !== 'object') return { ana: null, adv: null, fun: null, dontes: false };
  const b = (v) => (v === true ? true : v === false ? false : null);
  const ana = b(h.ana), adv = b(h.adv), fun = b(h.fun);
  return { ana, adv, fun, dontes: ana !== null || adv !== null };
}
const jel = (v, dontes) => (v === true ? 'GRANTED' : v === false ? 'DENIED' : dontes ? 'DENIED' : 'UNSPECIFIED');

/** A REGI szabaly (SZ-38 / SZ-16): Meta / TikTok mindig kap azonositot, Google / GA4 a valos jelet (dontes nelkul UNSPECIFIED / DENIED), Google hash-t csak adv-hozzajarulassal, GA4 sosem. */
export function valosSzabaly(platform, hozz) {
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

/** -> { kuldheto, felhasznaloi_adat, jel: { ad_user_data, ad_personalization }, megjegyzes } az adott platformra (DECISION #202: elfogadott hozzajarulas, ha nincs rogzitett elutasito dontes; env.MERES_HOZZAJARULAS_VALOS=1 = regi szabaly). */
export function platformSzabaly(platform, hozz, env = {}) {
  const valos = valosSzabaly(platform, hozz);
  if (!valos.kuldheto || String((env || {}).MERES_HOZZAJARULAS_VALOS) === '1') return valos;
  const h = hozzajarulasTisztit(hozz);
  // rogzitett dontes, amely a hirdetesi hozzajarulast nem adja meg: minden platformra a valos szabaly (Meta / TikTok: valtozatlanul kap azonositot SZ-38 szerint - a torzs nem valtozik, de a naploban a valos jel latszik; Google / GA4: DENIED, hash nelkul)
  if (h.dontes && h.adv !== true) return { ...valos, megjegyzes: 'rogzitett dontes (adv != igen): ' + valos.megjegyzes };
  return { kuldheto: true, felhasznaloi_adat: true, jel: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' }, megjegyzes: 'DECISION #202: nincs sutisav, elfogadott hozzajarulas (ad_user_data / ad_personalization = GRANTED)' };
}
