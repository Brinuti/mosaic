// GYOGYTORNASZOM.HU foglalomotor - kriptografiai segedek (WebCrypto: Cloudflare Workers es Node 20+). Titkos kulcs CSAK a szerveren (env), a bongeszo nem kapja meg.

const enc = new TextEncoder();
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function sha256Hex(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
}

/** HMAC-SHA256 (kisbetus hex, 64 karakter). A kulcs hianya hiba (nincs alapertek: titkos kulcs nelkul nincs tranzakcio-azonosito). */
export async function hmacHex(kulcs, uzenet) {
  if (!kulcs || String(kulcs).length < 16) throw new Error('hianyzo_vagy_rovid_hmac_kulcs');
  const k = await crypto.subtle.importKey('raw', enc.encode(String(kulcs)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(String(uzenet))));
}

/** Veletlen, atlatszatlan token (32 bajt, base64url, 43 karakter). */
export function ujToken(bajt = 32) {
  const b = new Uint8Array(bajt);
  crypto.getRandomValues(b);
  return b64url(b);
}

/** Allando idoben vegzett osszehasonlitas (kulcs-ellenorzeshez). */
export function egyenlo(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/** A tranzakcio-azonosito: HMAC(motor-UUID, titkos kulcs), kisbetus hex (64 karakter: 8-128 hosszu [A-Za-z0-9_-] mintanak megfelel). */
export const tranzakcioId = (uuid, kulcs) => hmacHex(kulcs, 'gy-tranzakcio|' + uuid);
