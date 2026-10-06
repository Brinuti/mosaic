// SHA-256 normalizalas a platformok szabalyai szerint (Meta, TikTok, Google). A nyers e-mail / telefon SOHA nem tarolodik: csak a hash.

export async function sha256hex(szoveg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(szoveg)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const emailNormal = (e) => { const s = String(e || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null; };
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
