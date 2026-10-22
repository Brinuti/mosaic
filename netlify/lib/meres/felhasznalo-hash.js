// DECISION #202 (maximalis adatatadas, Feri 2026-10-19): a vendeg azonosito-adatai KIZAROLAG hash-elve (SHA-256, normalizalva) hagyjak el a rendszert; nyers e-mail / telefon / nev SOHA nem kerul kimeno kerelembe, naploba, D1-be.
// Egy helyen allitja elo a platformok kerelem-epitoinek (platformok.js) hash-bemenetet; az elosztas() es a tesztek / a golden-kep is ezt hasznalja.
//   em / ph_meta / ph_e164 / ext : a korabbi (Meta, TikTok) azonositok, valtozatlan szamitas
//   em_ads / em_ga4              : Google Ads / GA4 e-mail-normalizalas (gmail pontok; Ads: a "+" utani resz is)
//   fn / ln / country            : Meta: keresztnev / vezeteknev (csak ha van hasznalhato nev: hianyzo / null / ures nev = NINCS nev-hash, a tobbi mezo megy), orszag "hu" (csak ha van mas azonosito)
//   uid                          : GA4 user_id = HMAC (GUEST_HMAC_KEY_V1) alapu alvezetett azonosito (nem visszafejtheto e-mail-hash); kulcs nelkul NINCS user_id
import { emailNormal, hashAzonosito, hashEmail, hashEmailGoogle, hashTelefon, hmacSha256Hex, iranyitoszamNormal, kuponNelkul, nevReszek, sha256hex, telefonSzamjegy, varosNormal } from './hash.js';

const titokOk = (v) => typeof v === 'string' && v.length >= 16;

/** v: { email, telefon, g, nev, varos, iranyitoszam } (nyers; csak itt, a hash-eleshez). -> a platform-epitok hash-objektuma (minden mezo hex-string vagy null). */
export async function felhasznaloHash(env, v = {}) {
  const e = env || {};
  const nevek = nevReszek(v.nev, e.MERES_NEV_SORREND);
  const em = await hashEmail(v.email);
  const ph_meta = await hashTelefon(v.telefon);
  const ph_e164 = await hashTelefon(v.telefon, { plusz: true });
  const fn = nevek && nevek.fn ? await sha256hex(nevek.fn) : null;
  const ln = nevek && nevek.ln ? await sha256hex(nevek.ln) : null;
  const ct = varosNormal(v.varos), zp = iranyitoszamNormal(v.iranyitoszam); // csak az ajandekkartya-vasarlasnal van forras (Stripe PI metadata); a motornal / sd-nel nincs: kimarad
  const azon = emailNormal(v.email) || v.g; // GA4 user_id: az e-mail az elsodleges (motoros es sd ag ugyanazt a user_id-t adja ugyanarra a vendegre); a Salonic-vendegazonosito (g) csak tartalek
  const tel = telefonSzamjegy(v.telefon); // orszag: csak magyar (36-os) telefonszamnal / telefon nelkul "hu"; kulfoldi szamnal nem talaljuk ki
  const magyar = !tel || tel.startsWith('36');
  return {
    em, ph_meta, ph_e164,
    ext: await hashAzonosito(v.g || emailNormal(v.email) || kuponNelkul(v.email)),
    em_ads: await hashEmailGoogle(v.email, { plusz: true }),
    em_ga4: await hashEmailGoogle(v.email, { plusz: false }),
    fn, ln, ct: ct ? await sha256hex(ct) : null, zp: zp ? await sha256hex(zp) : null,
    country: magyar && (em || ph_meta || fn || ln) ? await sha256hex('hu') : null,
    uid: titokOk(e.GUEST_HMAC_KEY_V1) && azon ? (await hmacSha256Hex(e.GUEST_HMAC_KEY_V1, `v1|ga4uid|${azon}`)).slice(0, 32) : null,
  };
}
