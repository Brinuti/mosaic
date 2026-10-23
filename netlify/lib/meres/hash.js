// SHA-256 normalizalas a platformok szabalyai szerint (Meta, TikTok, Google). A nyers e-mail / telefon SOHA nem tarolodik: csak a hash.

export async function sha256hex(szoveg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(szoveg)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const EMAIL_TOKEN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_HOSSZ = 320; // az RFC szerinti cim <= 254 karakter; a hosszabb mezo nem e-mail (az EMAIL_TOKEN-nek van masodfoku visszalepese hosszu, @-os, sok pontos bemenetre)
// A kuponos Salonic-levelben az "E-mail cim:" mezo az e-mail cim utan a "Kupon kod: <KOD>" sort is tartalmazza (elvalaszto nelkul is osszeerhet: "...@pelda.huKupon kod: ABC123"). DECISION #192 / F1. Felismert cimkek: "Kupon kod:", "Kuponkod:", "Kupon:", "Coupon code:", "Coupon:" (kis/nagybetu, ekezet nelkul is; a kettospont kotelezo).
export const KUPON_CIMKE = /(?:kupon(?:\s*k[oó]d)?|coupon(?:\s*code)?)\s*:/i;
const CSAK_EMAIL_CIMKE = /^e-?mail(?:\s*c[ií]m)?\s*:?$/i;
/**
 * E-mail normalizalas (kisbetus, trim-elt cim). Ha a mezo pontosan egy e-mail token: valtozatlan (a regi viselkedes). DECISION #192 / F1: ha a mezoben FELISMERT kuponkod-cimke is van, a cimke ELOTTI reszbol az elso e-mail-szeru token
 * (a cimke osszeerve is vag); a cimke utani szoveg (a kuponkod) sosem kerul a kimenetbe. Cimke nelkul tovabbra is szigoru (fail-closed): tobbtokenes szoveg -> null. A cimkevel kezdodo mezo -> null.
 * Hosszkorlat: a vizsgalt resz (a cimke elotti resz, illetve cimke nelkul a teljes mezo) legfeljebb 320 karakter; a cimke UTANI szoveg hossza nem szamit.
 */
export const emailNormal = (e) => {
  const teljes = String(e || '').trim().toLowerCase();
  const vag = teljes.search(KUPON_CIMKE);
  const s = vag > 0 ? teljes.slice(0, vag).trim() : teljes;
  if (s.length > EMAIL_MAX_HOSSZ) return null;
  if (EMAIL_TOKEN.test(s)) return s;
  if (vag > 0) { const t = s.split(/\s+/).find((x) => EMAIL_TOKEN.test(x)); if (t) return t; }
  return teljes.length <= EMAIL_MAX_HOSSZ && EMAIL_TOKEN.test(teljes) ? teljes : null; // visszafele kompatibilis: a regi szigoru ellenorzes (pl. "x.kuponkod:y@b.hu" egyetlen token)
};
/**
 * Az external_id tartalek-agahoz (amikor nincs ervenyes e-mail es nincs `g`): a mezo kuponkod-cimketol kezdve semmi; ha a kupon / coupon szo cimke nelkul szerepel a szovegben, az egesz ures
 * (a kuponkod szovege semmilyen hash-be nem kerulhet); a "csak az E-mail cim: cimke" maradek is ures (kulonben minden ilyen vendeg ugyanazt a konstans azonositot kapna). Cimke es kupon-szo nelkuli szoveg valtozatlan.
 */
export const kuponNelkul = (e) => {
  const t = String(e || '');
  const vag = t.search(KUPON_CIMKE);
  if (vag < 0) return /kupon|coupon/i.test(t) ? '' : t;
  const elotte = t.slice(0, vag).trim();
  return CSAK_EMAIL_CIMKE.test(elotte) || /kupon|coupon/i.test(elotte) ? '' : elotte;
};
/** Magyar telefonszam -> orszagkoddal egyutt, csak szamjegyek (pl. "709420090", "06 70 942 0090", "+36 70 942 0090" -> "36709420090"); null, ha nem ertelmezheto. */
export function telefonSzamjegy(nyers, orszag = '36') {
  let s = String(nyers || '').replace(/[^\d+]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) s = s.slice(1); else if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('06')) s = orszag + s.slice(2);
  else if (!s.startsWith(orszag) && s.length >= 8 && s.length <= 9) s = orszag + s;
  return /^\d{9,15}$/.test(s) ? s : null;
}
export const hashEmail = async (e) => { const n = emailNormal(e); return n ? sha256hex(n) : null; };
/** plusz=false: Meta (csak szamjegyek orszagkoddal); plusz=true: TikTok / Google (E.164, "+" jellel). */
export const hashTelefon = async (t, { plusz = false } = {}) => { const n = telefonSzamjegy(t); return n ? sha256hex(plusz ? '+' + n : n) : null; };
export const hashAzonosito = async (a) => (a ? sha256hex(String(a).trim().toLowerCase()) : null);

// --- DECISION #202 (maximalis adatatadas): nev, Google-normalizalas, HMAC felhasznaloi azonosito ---------------------------------------------------
// A nyers nev SOHA nem kerul kimeno kerelembe / naplora / D1-be: csak a normalizalt resz SHA-256-ja. Nev nelkul (hianyzo / null / ures / ertelmezhetetlen) NINCS nev-hash, a tobbi mezo megy.
const TITULUSOK = new Set(['dr', 'prof', 'id', 'ifj', 'ozv', 'özv', 'mr', 'mrs', 'ms', 'mgr']);
const betukSzo = (t) => String(t || '').normalize('NFC').toLowerCase().replace(/[^\p{L}]+/gu, ''); // Meta / GA4: kisbetu, irasjel es szamjegy nelkul; az ekezetes betuk UTF-8-ban maradnak
/**
 * Teljes nev -> { fn, ln } (normalizalt, a hash ELOTT) | null. Magyar sorrend alapbol (vezeteknev keresztnev: "Kovacs Anna" -> ln kovacs, fn anna); a keresztnev-elol sorrend: sorrend = 'keresztnev_elol'
 * (env: MERES_NEV_SORREND). Titulus (dr, prof, id, ifj, ozv) es irasjel-tokenek (pl. "TESZT – Claude" kozti gondolatjel) kimaradnak; egyetlen token = csak fn; 6-nal tobb token / 40 karakternel hosszabb token = nem nev.
 */
export function nevReszek(nyers, sorrend = 'vezeteknev_elol') {
  if (typeof nyers !== 'string') return null;
  const t = nyers.slice(0, 200).split(/[\s,;]+/).map(betukSzo).filter((x) => x && !TITULUSOK.has(x));
  if (!t.length || t.length > 6 || t.some((x) => x.length > 40)) return null;
  if (t.length === 1) return { fn: t[0], ln: null };
  return sorrend === 'keresztnev_elol' ? { fn: t[0], ln: t[t.length - 1] } : { fn: t[1], ln: t[0] };
}
/**
 * Google Ads address_info nev-normalizalas (hashed_first_name / hashed_last_name): a Google szabalya szerint kisbetu + a kezdo / vegzo szokoz / irasjel nelkul; a szon BELUL a kotojel / aposztrof marad
 * ("Kovacs-Nagy" -> "kovacs-nagy"; a Meta-fele nevReszek az irasjelet is kiveszi). Ugyanaz a tokenizalas, titulus-szuro es sorrend, mint a nevReszek-nel. null, ha nincs hasznalhato nev.
 */
export function nevReszekGoogle(nyers, sorrend = 'vezeteknev_elol') {
  if (typeof nyers !== 'string') return null;
  const szel = (t) => String(t || '').normalize('NFC').toLowerCase().replace(/[\u2018\u2019\u02bc`\u00b4]/g, "'").replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-').replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');   // tipografiai aposztrof / kotojel -> ASCII (O\u2019Brien == O'Brien)
  const t = nyers.slice(0, 200).split(/[\s,;]+/).map((x) => ({ g: szel(x), m: betukSzo(x) })).filter((x) => x.g && x.m && !TITULUSOK.has(x.m)).map((x) => x.g);
  if (!t.length || t.length > 6 || t.some((x) => x.length > 40)) return null;
  if (t.length === 1) return { fn: t[0], ln: null };
  return sorrend === 'keresztnev_elol' ? { fn: t[0], ln: t[t.length - 1] } : { fn: t[1], ln: t[0] };
}
/** Google Ads / GA4 e-mail-normalizalas: a gmail.com / googlemail.com helyi reszebol a pontok kimaradnak; plusz = true (Ads): az elso "+" es a utana levo resz is. Mas domain: csak kisbetu + trim. */
export function emailGoogleNormal(e, { plusz = true } = {}) {
  const n = emailNormal(e);
  if (!n) return null;
  const [helyi, domain] = n.split('@');
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return n;
  let h = helyi.replace(/\./g, '');
  if (plusz) h = h.split('+')[0];
  return h ? `${h}@${domain}` : n;
}
export const hashEmailGoogle = async (e, opciok) => { const n = emailGoogleNormal(e, opciok); return n ? sha256hex(n) : null; };
/** Meta ct / zp: varos kisbetus, irasjel / szokoz / szamjegy nelkul (az ekezetes betuk maradnak); iranyitoszam kisbetus, szokoz / kotojel nelkul (3-10 karakter). null, ha nem hasznalhato. */
export const varosNormal = (v) => { const s = betukSzo(v); return s && s.length <= 60 ? s : null; };
export const iranyitoszamNormal = (v) => { const s = String(v || '').normalize('NFC').toLowerCase().replace(/[\s-]+/g, ''); return /^[0-9a-z]{3,10}$/.test(s) ? s : null; };
/** HMAC-SHA-256 hex (a GUEST_HMAC_KEY_V1-hez: a GA4 user_id alvezetett, nem visszafejtheto azonositoja). */
export async function hmacSha256Hex(titok, szoveg) {
  const kulcs = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(titok)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const alairas = await crypto.subtle.sign('HMAC', kulcs, new TextEncoder().encode(String(szoveg)));
  return [...new Uint8Array(alairas)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
