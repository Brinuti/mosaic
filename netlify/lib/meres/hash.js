// SHA-256 normalizalas a platformok szabalyai szerint (Meta, TikTok, Google). A nyers e-mail / telefon SOHA nem tarolodik: csak a hash.

export async function sha256hex(szoveg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(szoveg)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const EMAIL_TOKEN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A kuponos Salonic-levelben az "E-mail cim:" mezo az e-mail cim utan a "Kupon kod: <KOD>" sort is tartalmazza (elvalaszto nelkul is osszeerhet: "...@pelda.huKupon kod: ABC123"). DECISION #192 / F1.
const KUPON_CIMKE = /(?:kupon\s*k[oó]d|coupon\s*code)\s*:/i;
/** A mezo a kuponkod-cimkeig (a cimkevel kezdodo szoveg: ures). Az external_id tartalek-agahoz: a kuponkod szovege semmilyen hash-be nem kerulhet. */
export const kuponNelkul = (e) => { const t = String(e || ''); const vag = t.search(KUPON_CIMKE); return vag >= 0 ? t.slice(0, vag) : t; };
/** E-mail normalizalas (kisbetus, trim-elt cim). Ha a mezo pontosan egy e-mail token: valtozatlan (a regi viselkedes). Egyebkent (DECISION #192, F1) az ELSO e-mail-szeru token; ha a kuponkod-cimke is a mezoben van, a cimke ELOTTI reszbol (a kuponkod sosem kerul a hash-be); ha nincs ilyen token: null. */
export const emailNormal = (e) => {
  const teljes = String(e || '').trim().toLowerCase();
  const vag = teljes.search(KUPON_CIMKE);
  const s = vag > 0 ? teljes.slice(0, vag).trim() : teljes; // a cimke ELOTTI resz (osszeerve is: "...@pelda.huKupon kod:")
  if (EMAIL_TOKEN.test(s)) return s;
  const elso = (t) => t.split(/\s+/).find((x) => EMAIL_TOKEN.test(x));
  return elso(s) || (vag >= 0 ? elso(teljes) : null) || null; // a masodik: ha a cimke az e-mail elott all
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
