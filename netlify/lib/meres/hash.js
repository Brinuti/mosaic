// SHA-256 normalizalas a platformok szabalyai szerint (Meta, TikTok, Google). A nyers e-mail / telefon SOHA nem tarolodik: csak a hash.

export async function sha256hex(szoveg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(szoveg)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const EMAIL_TOKEN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_HOSSZ = 320; // az RFC szerinti cim <= 254 karakter; a hosszabb mezo nem e-mail (az EMAIL_TOKEN-nek van masodfoku visszalepese hosszu, @-os, sok pontos bemenetre)
// A kuponos Salonic-levelben az "E-mail cim:" mezo az e-mail cim utan a "Kupon kod: <KOD>" sort is tartalmazza (elvalaszto nelkul is osszeerhet: "...@pelda.huKupon kod: ABC123"). DECISION #192 / F1. Felismert cimkek: "Kupon kod:", "Kuponkod:", "Kupon:", "Coupon code:", "Coupon:" (kis/nagybetu, ekezet nelkul is; a kettospont kotelezo).
const KUPON_CIMKE = /(?:kupon(?:\s*k[oó]d)?|coupon(?:\s*code)?)\s*:/i;
const CSAK_EMAIL_CIMKE = /^e-?mail(?:\s*c[ií]m)?\s*:?$/i;
/**
 * E-mail normalizalas (kisbetus, trim-elt cim). Ha a mezo pontosan egy e-mail token: valtozatlan (a regi viselkedes). DECISION #192 / F1: ha a mezoben FELISMERT kuponkod-cimke is van, a cimke ELOTTI reszbol az elso e-mail-szeru token
 * (a cimke osszeerve is vag); a cimke utani szoveg (a kuponkod) sosem kerul a kimenetbe. Cimke nelkul tovabbra is szigoru (fail-closed): tobbtokenes szoveg -> null. A cimkevel kezdodo mezo -> null. 320 karakternel hosszabb mezo -> null.
 */
export const emailNormal = (e) => {
  const teljes = String(e || '').trim().toLowerCase();
  if (teljes.length > EMAIL_MAX_HOSSZ) return null;
  const vag = teljes.search(KUPON_CIMKE);
  const s = vag > 0 ? teljes.slice(0, vag).trim() : teljes;
  if (EMAIL_TOKEN.test(s)) return s;
  if (vag > 0) { const t = s.split(/\s+/).find((x) => EMAIL_TOKEN.test(x)); if (t) return t; }
  return EMAIL_TOKEN.test(teljes) ? teljes : null; // visszafele kompatibilis: a regi szigoru ellenorzes (pl. "x.kuponkod:y@b.hu" egyetlen token)
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
