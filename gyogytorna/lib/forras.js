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
// A Google Ads UTM-sablon (Feri dontese, 2026-10-13): ?utm_source=google&utm_medium=cpc&utm_campaign={kampany-ID}&utm_content={hirdetes-ID}&gyt_ag={hirdetescsoport-ID}. Ezek szamok, nem szemelyes adatok.
export const FIZETETT_MEDIUM = Object.freeze(['cpc', 'ppc', 'paid', 'paid_search', 'paidsearch']);
const UTM_MINTA = /^[A-Za-z0-9._~:+-]{1,100}$/;
const KATT_ERTEK = /^[A-Za-z0-9_-]{8,512}$/;
const KAMPANY_ID = /^\d{6,15}$/;
// Ellenorzott, egyertelmu szoveges alias -> kampany-ID (a BRAND hirdetesek regi, hirdetesszintu tracking template-je: utm_campaign=gyogytornaszomhu-brand). Mas szoveg NEM kap ID-t.
export const KAMPANY_ALIAS = Object.freeze({ 'gyogytornaszomhu-brand': '1655523772' });

const SEARCH = ['google', 'bing', 'duckduckgo', 'yahoo', 'ecosia', 'yandex', 'startpage', 'brave', 'qwant', 'seznam', 'baidu', 'naver', 'ask'];
const SOCIAL = ['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'twitter', 'x', 'pinterest', 'reddit', 't', 'lnkd', 'fb', 'l.facebook', 'm.facebook', 'l.instagram', 'out.reddit'];
const kis = (v) => (v == null ? '' : String(v).toLowerCase());

/** Google Ads azonosito (kampany / hirdetescsoport / hirdetes): csak 6-15 szamjegy, kulonben null. */
export const ads_id = (v) => (typeof v === 'string' && KAMPANY_ID.test(v.trim()) ? v.trim() : null);

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
  const o = { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, gyt_ag: null, kattintas_param: null, kattintas_ertek: null, landing: null, ref_domain: null, ref_kat: 'nincs' };
  for (const k of UTM_MEZOK) o[k] = utmTisztit(p.get(k));
  o.gyt_ag = ads_id(p.get('gyt_ag'));
  o.param_nevek = [...new Set([...p.keys()].map((k) => k.toLowerCase()).filter((k) => /^[a-z0-9_]{1,30}$/.test(k)))].sort().slice(0, 15); // CSAK a parameterek NEVEI (ertek nelkul): diagnosztika, ha fizetett erkezesnel hianyzik a kampany
  o.utm_term = ads_id(p.get('utm_term')); // a fiokszintu suffix a hirdetescsoportot utm_term={adgroupid}-kent adja (csak szamjegy)
  o.kampany_jel = null;
  // TOBB utm_campaign (regi hirdetesszintu template + fiokszintu suffix): a szamszeru (ID) nyer; ket KULONBOZO ID = konfliktus (nem valasztunk); csak szoveges: ellenorzott alias, kulonben szoveges
  const kamp = p.getAll('utm_campaign').map(utmTisztit).filter(Boolean);
  if (kamp.length > 1 || (kamp.length === 1 && !ads_id(kamp[0]))) {
    const idk = [...new Set(kamp.filter((v) => ads_id(v)))];
    if (idk.length > 1) { o.utm_campaign = null; o.kampany_jel = 'konfliktus'; }
    else if (idk.length === 1) o.utm_campaign = idk[0];
    else {
      const alias = kamp.map((v) => KAMPANY_ALIAS[v.toLowerCase()]).find(Boolean);
      if (alias) { o.utm_campaign = alias; o.kampany_jel = 'alias'; } else { o.utm_campaign = kamp[0]; o.kampany_jel = 'szoveges'; }
    }
  }
  // tartalek kampany-azonosito (Google auto-tagging): ha az utm_campaign EGYALTALAN nincs, a csak-szamjegyes gad_campaignid a kampany-ID (bizonyitek: gad_campaignid)
  o.gad_campaignid = ads_id(p.get('gad_campaignid'));
  if (!o.utm_campaign && o.gad_campaignid) { o.utm_campaign = o.gad_campaignid; o.kampany_jel = 'gad_campaignid'; }
  const tart = p.getAll('utm_content').map(utmTisztit).filter(Boolean);
  if (tart.length > 1) o.utm_content = tart.find((v) => ads_id(v)) || tart[0];
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

/** A foglalashoz mentheto, nem szemelyes hirdetesi azonositok: { kampany, hirdetescsoport, hirdetes } (mind szam vagy null). */
export function hirdetesAzonositok(b) {
  return { kampany: ads_id(b && b.utm_campaign), hirdetescsoport: ads_id(b && b.gyt_ag) || ads_id(b && b.utm_term), hirdetes: ads_id(b && b.utm_content) };
}

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
  // UGYANAZ a kattintas (azonos click-ID), pl. a webhelyen belul tovabbvitt gclid UTM nelkul: nem uj erintes, az eredeti landing / UTM / kampany megmarad (nem irjuk felul hianyosabb adattal)
  if (regi && regi.belepes && uj && uj.kattintas_ertek && regi.belepes.kattintas_ertek === uj.kattintas_ertek) return { belepes: regi.belepes, fizetett: true };
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
    return { cimke: lista.get(kid).brand ? 'google_brand' : 'google_nem_brand', bizonyitek: b.kampany_jel === 'alias' ? 'kampany_alias_es_katt' : b.kampany_jel === 'gad_campaignid' ? 'gad_campaignid' : 'kampany_es_katt', elavult };
  }
  if (katt || listas || (googleUtm && kid)) {
    // csak az egyik feltetel / ismeretlen kampany-ID / csak UTM: bizonytalan Google
    return { cimke: 'google_bizonytalan', bizonyitek: katt ? (kid ? 'ismeretlen_kampany' : b.kampany_jel === 'konfliktus' ? 'kampany_konfliktus' : b.kampany_jel === 'szoveges' ? 'utm_campaign_szoveges' : b.utm_campaign ? 'katt_kampany_nelkul' : 'utm_campaign_hianyzik') : listas ? 'kampany_katt_nelkul' : 'utm_onmagaban', elavult };
  }
  if (googleUtm && fizetett(b)) return { cimke: 'google_bizonytalan', bizonyitek: 'utm_onmagaban', elavult };
  if (b.kattintas_param === 'fbclid' && !googleUtm) return { cimke: 'social_meta', bizonyitek: 'fbclid_fizetett_ismeretlen', elavult }; // a Meta-hirdetes KI: az fbclid onmagaban nem dont a fizetett statuszrol; NEM organikus, NEM Google
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

// --- GY-22: 7 napos last paid click (ARNYEK) -----------------------------------------------------------------------------------
export const LPC_VERZIO = 'lpc1';
export const LPC_NAP = 7, KESOI_NAP = 30;
/** Fizetett erintes-e (naplozando): Google kattintas-azonosito (gclid / gbraid / wbraid) VAGY utm_medium=cpc (fizetett medium). Mas platform click-ID-ja nem. */
export const lpcFizetett = (b) => !!b && (googleKattintas(b) || FIZETETT_MEDIUM.includes(kis(b.utm_medium)));
/** A cimkez() kimenetenek normalizalasa a GY-22 cimkekre. */
export const lpcCimke = (c) => ({ google_brand: 'google_markas', google_nem_brand: 'google_nem_markas', google_bizonytalan: 'google_bizonytalan' }[c] || 'ismeretlen');
/**
 * A foglalas pillanataban a latogato erintesei alapjan (legujabb elol): a legutolso, LPC_NAP napon beluli fizetett nyer; organikus / direkt visszateres NEM ir felul (nem is naplozzuk);
 * nincs fizetett -> organikus_direkt (ha van azonosito), kulonben ismeretlen. kesoi_fizetett: a 8-30 napos legutolso fizetett erintes cimkeje (kulon mezo).
 * Ismeretlen kampany-ID-val naplozott erintest a kampanylista kesobbi frissitese utolag feloldja.
 */
export function lpcHozzarendel({ erintesek = [], most, lista, azonositoVan = false }) {
  const l = lista instanceof Map ? lista : new Map(Object.entries(lista || {}));
  const kor = (e) => most - e.ido;
  const felold = (e) => {
    if (e.cimke === 'google_bizonytalan' && e.bizonyitek === 'ismeretlen_kampany' && e.kampany && l.has(String(e.kampany))) {
      return { cimke: l.get(String(e.kampany)).brand ? 'google_markas' : 'google_nem_markas', bizonyitek: 'kampany_es_katt_utolag' };
    }
    return { cimke: e.cimke, bizonyitek: e.bizonyitek };
  };
  const rendezett = [...erintesek].sort((a, b) => b.ido - a.ido);
  const nyertes = rendezett.find((e) => kor(e) >= 0 && kor(e) <= LPC_NAP * 86400);
  const kesoi = rendezett.find((e) => kor(e) > LPC_NAP * 86400 && kor(e) <= KESOI_NAP * 86400);
  const kesoiCimke = kesoi ? felold(kesoi).cimke : null;
  if (nyertes) {
    const f = felold(nyertes);
    return { cimke: f.cimke, bizonyitek: f.bizonyitek, kampany: nyertes.kampany || null, hirdetescsoport: nyertes.hirdetescsoport || null, hirdetes: nyertes.hirdetes || null, kora_nap: Math.floor(kor(nyertes) / 86400), kesoi_fizetett: kesoiCimke, verzio: LPC_VERZIO };
  }
  return { cimke: azonositoVan ? 'organikus_direkt' : 'ismeretlen', bizonyitek: azonositoVan ? 'nincs_fizetett_7_napon_belul' : 'nincs_azonosito', kampany: null, hirdetescsoport: null, hirdetes: null, kora_nap: null, kesoi_fizetett: kesoiCimke, verzio: LPC_VERZIO };
}
