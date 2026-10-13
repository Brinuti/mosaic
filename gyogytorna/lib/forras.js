// GYOGYTORNASZOM.HU foglalomotor - forras-cimkezes (tiszta fuggvenyek, nincs I/O). Szabaly: GY-FOGLALOMOTOR-FELADAT.md (GY-15) 1-3. pont.
//
// Cimkek: google_brand | google_nem_brand | google_bizonytalan | organikus | direkt | ismeretlen.
//   - google_brand / google_nem_brand CSAK ha (a) az utm_campaign (a Google Ads kampany-ID) szerepel a naponta szinkronizalt kampanylistaban
//     ES (b) van gclid / gbraid / wbraid. A BRAND kampany-ID -> google_brand, minden mas listas kampany -> google_nem_brand.
//   - Csak az egyik feltetel, ismeretlen ID, ellentmondas -> google_bizonytalan (SOHA nem automatikus nem_brand).
//   - Prioritas: (kampany-ID + click-ID) > referrer. Az UTM onmagaban nem bizonyitek.
//   - organikus: kereso / kozossegi referrer-domain, fizetett jel nelkul. direkt: nincs referrer es nincs jel. ismeretlen: hianyzo / ellentmondo adat.
//   - A foglalasra a foglalas pillanataig az utolso FIZETETT forras kerul; direkt / organikus nem irja felul a fizetettet.
// Meta es TikTok nincs (egeszsegugyi kategoria): fbclid / ttclid / utm_source=facebook stb. sehova nem megy, csak "nem Google fizetett jel"-kent
// tekintjuk (ellentmondas-vizsgalathoz), az erteke sehol nem tarolodik.

export const CIMKEK = Object.freeze(['google_brand', 'google_nem_brand', 'google_bizonytalan', 'organikus', 'direkt', 'ismeretlen']);
export const GOOGLE_KATT = Object.freeze(['gclid', 'gbraid', 'wbraid']);
const MAS_KATT = Object.freeze(['fbclid', 'ttclid', 'msclkid']);
const MAS_PLATFORM = Object.freeze(['facebook', 'fb', 'meta', 'instagram', 'ig', 'tiktok', 'bing', 'microsoft']);
export const UTM_MEZOK = Object.freeze(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']);
export const FIZETETT_MEDIUM = Object.freeze(['cpc', 'ppc', 'paid', 'paid_search', 'paidsearch']);
const UTM_MINTA = /^[A-Za-z0-9._~:+-]{1,100}$/;
const KATT_ERTEK = /^[A-Za-z0-9_-]{8,512}$/;
const KAMPANY_ID = /^\d{6,15}$/;

const SEARCH = ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'yandex', 'startpage', 'brave', 'qwant', 'seznam', 'baidu', 'naver', 'ask'];
const SOCIAL = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'twitter', 'x', 'pinterest', 'reddit', 't', 'lnkd', 'fb', 'l.facebook', 'm.facebook', 'l.instagram', 'out.reddit'];
const kis = (v) => (v == null ? '' : String(v).toLowerCase());

/** Egy utm-ertek tisztitasa: legfeljebb 100 karakter, csak [A-Za-z0-9._~:+-]; kulonben null (eldobjuk, nem javitjuk). */
export function utmTisztit(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return UTM_MINTA.test(s) ? s : null;
}

/** A referrer DOMAINJE (kisbetus, "www." nelkul), URL / utvonal / parameter nelkul; ervenytelen -> null. */
export function referrerDomain(ref) {
  if (typeof ref !== 'string' || !ref) return null;
  try {
    const u = new URL(ref);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.hostname.toLowerCase().replace(/^www\./, '') || null;
  } catch (e) { return null; }
}

/** A domain kategoriaja: 'sajat' (a webhely maga) | 'search' | 'social' | 'egyeb' | 'nincs'. */
export function referrerKategoria(domain, sajatHostok = ['gyogytornaszom.hu']) {
  if (!domain) return 'nincs';
  if (sajatHostok.some((h) => domain === h || domain.endsWith('.' + h))) return 'sajat';
  const cimke = domain.split('.');
  const nev = cimke.length >= 2 ? cimke[cimke.length - 2] : cimke[0];
  // a "google.hu" / "www.google.com" / "l.facebook.com" stb.: a regisztralt nev (utolso elotti cimke) dont
  if (SEARCH.includes(nev)) return 'search';
  if (SOCIAL.includes(nev) || SOCIAL.includes(domain)) return 'social';
  return 'egyeb';
}

/**
 * Egy belepes (landing) bizonyitekai a lap cimebol + referrerbol. A nyers kattintas-azonosito CSAK a munkamenet-rekordba kerul (max 24 ora,
 * hozzajarulasnal 30 nap), naploba soha. Visszaad: { utm_source, utm_medium, utm_campaign, utm_content, kattintas_param, kattintas_ertek, landing, ref_domain, ref_kat }.
 */
export function belepes({ search = '', referrer = '', path = '/', sajatHostok } = {}) {
  const p = new URLSearchParams(String(search).replace(/^\?/, ''));
  const o = { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, kattintas_param: null, kattintas_ertek: null, landing: null, ref_domain: null, ref_kat: 'nincs' };
  for (const k of UTM_MEZOK) o[k] = utmTisztit(p.get(k));
  for (const k of GOOGLE_KATT) {
    const v = p.get(k);
    if (v && KATT_ERTEK.test(v)) { o.kattintas_param = k; o.kattintas_ertek = v; break; }
  }
  if (!o.kattintas_param) for (const k of MAS_KATT) if (p.get(k)) { o.kattintas_param = k; break; } // csak a TIPUS (ellentmondas-vizsgalathoz), az ertek nem
  o.landing = typeof path === 'string' && /^\/[A-Za-z0-9/_\-.%]{0,200}$/.test(path) ? path.slice(0, 200) : '/';
  o.ref_domain = referrerDomain(referrer);
  o.ref_kat = referrerKategoria(o.ref_domain, sajatHostok);
  return o;
}

/** Fizetett-e a belepes: Google kattintas-azonosito VAGY fizetett utm_medium. (A nem Google kattintas-azonosito is "fizetett jel", de nem Google.) */
export function fizetett(b) {
  return !!b && (GOOGLE_KATT.includes(b.kattintas_param) || MAS_KATT.includes(b.kattintas_param) || FIZETETT_MEDIUM.includes(kis(b.utm_medium)));
}

/** Van-e Google kattintas-azonosito. */
export const googleKattintas = (b) => !!b && GOOGLE_KATT.includes(b.kattintas_param);

/** A kampany-ID az utm_campaign-bol (csak szamjegyek, 6-15 hosszan), kulonben null. */
export function kampanyId(b) {
  const v = b && b.utm_campaign;
  return typeof v === 'string' && KAMPANY_ID.test(v) ? v : null;
}

/**
 * A munkamenet-rekord frissitese egy uj belepessel ("utolso fizetett forras nyer"): a fizetett belepes mindig felulir; a nem fizetett csak akkor,
 * ha a rekordban meg nincs fizetett es a belepes nem "direkt" (direkt soha nem ir felul semmit). Visszaad: { belepes, fizetett } az uj allapot.
 */
export function osszevon(regi, uj) {
  const ujFiz = fizetett(uj);
  const direkt = !ujFiz && uj.ref_kat !== 'search' && uj.ref_kat !== 'social' && uj.ref_kat !== 'egyeb' && !uj.utm_source;
  if (!regi || !regi.belepes) return { belepes: uj, fizetett: ujFiz };
  if (ujFiz) return { belepes: uj, fizetett: true };
  if (regi.fizetett) return regi; // a fizetettet nem irja felul organikus / direkt
  if (direkt) return regi;
  return { belepes: uj, fizetett: false };
}

/**
 * A vegso forras-cimke a foglalas pillanatara.
 * @param b  a munkamenet bizonyitek-rekordja (belepes() kimenete) vagy null
 * @param t  a kampanylista: { lista: Map<id,{brand:boolean}>|Object, friss: boolean } (friss=false: az utolso sikeres frissites elavult)
 * @returns { cimke, bizonyitek, elavult }
 */
export function cimkez(b, t = {}) {
  const lista = t.lista instanceof Map ? t.lista : new Map(Object.entries(t.lista || {}));
  const elavult = t.friss === false;
  if (!b) return { cimke: 'ismeretlen', bizonyitek: 'nincs_adat', elavult };
  const kid = kampanyId(b);
  const katt = googleKattintas(b);
  const listas = kid !== null && lista.has(kid);
  const src = kis(b.utm_source), med = kis(b.utm_medium);
  const googleUtm = ['google', 'adwords', 'googleads'].includes(src) || FIZETETT_MEDIUM.includes(med);
  // ellentmondas: Google kattintas-azonosito, de egy masik platform jelzi magat az utm_source-ban (facebook / tiktok / bing ...)
  if (katt && MAS_PLATFORM.includes(src)) return { cimke: 'ismeretlen', bizonyitek: 'ellentmondas', elavult };
  if (katt && listas) {
    return { cimke: lista.get(kid).brand ? 'google_brand' : 'google_nem_brand', bizonyitek: 'kampany_es_katt', elavult };
  }
  if (katt || listas || (googleUtm && kid)) {
    // csak az egyik feltetel / ismeretlen kampany-ID / csak UTM: bizonytalan Google
    return { cimke: 'google_bizonytalan', bizonyitek: katt ? (kid ? 'ismeretlen_kampany' : 'katt_kampany_nelkul') : listas ? 'kampany_katt_nelkul' : 'utm_onmagaban', elavult };
  }
  if (googleUtm && fizetett(b)) return { cimke: 'google_bizonytalan', bizonyitek: 'utm_onmagaban', elavult };
  if (fizetett(b)) return { cimke: 'ismeretlen', bizonyitek: 'nem_google_fizetett', elavult };
  if (b.ref_kat === 'search' || b.ref_kat === 'social') return { cimke: 'organikus', bizonyitek: 'referrer', elavult };
  if (b.ref_kat === 'egyeb') return { cimke: 'organikus', bizonyitek: 'referrer_egyeb', elavult };
  if (b.ref_kat === 'sajat') return { cimke: 'ismeretlen', bizonyitek: 'sajat_referrer_jel_nelkul', elavult };
  if (b.ref_kat === 'nincs' && !b.utm_source && !b.utm_medium && !b.utm_campaign) return { cimke: 'direkt', bizonyitek: 'nincs_jel', elavult };
  return { cimke: 'ismeretlen', bizonyitek: 'hianyzo_vagy_ellentmondo', elavult };
}

/** A nyers kattintas-azonosito torlese a rekordbol (hozzajarulas nelkuli, 24 oran tuli vagy visszavont allapot). */
export function kattTorol(b) {
  return b ? { ...b, kattintas_ertek: null } : b;
}
