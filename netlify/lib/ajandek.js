// MOSAIC Gift Commerce Engine - szerveroldali kezelo (az /api/ajandek/* vegpontok).
//
// Kozos a Netlify- (netlify/functions/ajandek.mjs) es a Cloudflare Pages-fuggvenynek
// (functions/api/ajandek/[[kind]].js): tiszta, platformfuggetlen kod, csak Web-szabvanyos
// API-kkal (fetch, crypto.subtle, TextEncoder, URL) - Node 20 alatt es Workersben is fut.
//
//   ajandekKezel({ method, url, headers, text, env, kuld, most, ip }) -> { status, headers, body }
//   (ip: a platform altal megbizhatoan megadott kliens-IP; ha nincs, a fejlecekbol olvassuk)
//
// Vegpontok (a frontenddel egyeztetett szerzodes):
//   GET  beallitas   Stripe-mod, publikus kulcs, azonnali kartya
//   POST fizetes     PaymentIntent letrehozasa / frissitese (termekvaltas); az ar MINDIG a
//                    szerveren, az assets/js/ajandek-adat.js-bol (a kliens osszege nem szamit)
//   GET  rendeles    a rendeles allapota (Stripe-tol visszakerdezve); hitelesites: pi + cs
//                    (client_secret) vagy pi + rt (rendelesToken, CSAK olvasas - ez megy levelben)
//   POST szemelyre   megajandekozott neve, uzenet, alkalom, atadas (csak fizetes utan; csak cs-sel)
//   GET  kartya      a nyomtathato ajandekkartya (ha fizetve es a szalon kiallitotta); hitelesites:
//                    pi + t (kartyaToken, tovabbithato link) vagy - visszafele kompatibilisen - pi + cs
//   GET  kiallit     a szalon "kiallitottam" linkje (HMAC-token): CSAK megerosito oldal
//   POST kiallit     a megerosito oldal urlapja (pi, t): kartya_kesz=1 + vevo-level a kartyaval
//   POST webhook     Stripe-esemenyek (alairas-ellenorzott, idempotens):
//                      payment_intent.succeeded   -> szalon- es vevo-level
//                      charge.refunded            -> szalon-level: toroljek a kuponkodot
//                      charge.dispute.created     -> ugyanaz (vita / chargeback)
//                    A Stripe-ban a webhook-vegpontot MINDHAROM esemenyre elo kell fizetni.
//   POST atutalas    atutalasos igeny (NEM vasarlas): utalasi adatok levelben
//   POST foto        a szemelyre szabott (otthon nyomtatott) kartya fotoja: JPEG (data URL), <= 700 KB -> { id };
//                    a kepet a Cloudflare KV (AJANDEK_FOTOK) tarolja; a /fizetes es az /atutalas csak az id-t kapja
//   GET  foto        a kartyan megjeleno fotó (id + HMAC-token; a kartya-oldal es az elonezet hasznalja)
//   GET  elonezet    a szalon-linkes (kiallit-token) elonezet a szemelyre szabott kartyarol
//
// Visszaeles elleni vedelem a /fizetes, /szemelyre, /atutalas vegponton: csak application/json
// (415), kulso oldalrol inditott keres tiltva (Origin / Sec-Fetch-Site -> 403), es memoriaban
// tartott, best-effort kereskorlat kliens-IP-nkent (429 + retry-after). A szamlalo fuggvenypeldanyonkent
// el (nem globalis): tobb peldany / ujraindulas eseten lazabb, de a tomeges visszaelest fekezi.
//
// Kornyezeti valtozok:
//   STRIPE_SECRET_KEY        sk_live_... / sk_test_... (vagy korlatozott rk_...)
//   STRIPE_PUBLISHABLE_KEY   pk_live_... / pk_test_...
//   STRIPE_WEBHOOK_SECRET    whsec_... (tobb is lehet vesszovel elvalasztva, kulcscserekor)
//   AJANDEK_TITOK            KOTELEZO, legalabb 32 karakter: a kuponkod es a linkek (kiallit, kartya,
//                            rendeles) HMAC-kulcsa. Ha hianyzik / rovid, a motor ki van kapcsolva
//                            (beallitas: mod 'nincs'; webhook, kiallit, kartya, rendeles: 503).
//                            Csere utan a regi linkek ervenytelenek; a mar ertesitett rendelesek
//                            kodja a PI metadataban (kod) megmarad.
//   AJANDEK_BAZIS_URL        a levelekben es a kartyan levo linkek eleje (alapbol a keres origin-je)
//   AJANDEK_AZONNALI         '1' = a webhook rogton kiallitja a kartyat (kulonben a szalon linkje)
//   AJANDEK_FOTOK            (Cloudflare KV-kotes) a szemelyre szabott kartya fotoi; nelkule a fotofeltoltes ki van
//                            kapcsolva (beallitas: foto false), a design es az idezet igy is mukodik
//   STRIPE_API_BASE          csak tesztekhez (mock Stripe), alapbol https://api.stripe.com
//   STRIPE_API_VERSION       alapbol STRIPE_VERZIO
import '../../assets/js/ajandek-adat.js';
import '../../assets/js/ajandek-kartya.js';
import * as L from './ajandek-levelek.js';

const ADAT = globalThis.AJANDEK_ADAT;
const KARTYA = globalThis.AJANDEK_KARTYA;

const ELOTAG = '/api/ajandek/';
const FORRAS = 'ajandek-motor';
const STRIPE_ALAP = 'https://api.stripe.com';
// rogzitett API-verzio: a latest_charge mezo es a valaszok formaja ne a fiok alapbeallitasan muljon
const STRIPE_VERZIO = '2024-06-20';
const STRIPE_IDOKORLAT_MS = 15000;
export const MAX_TORZS = 32 * 1024;
export const MAX_WEBHOOK = 512 * 1024;
// a foto-feltoltes torzse: 700 KB-os JPEG base64-ben ~ 934 KB + a JSON-burkolat
export const MAX_FOTO_TORZS = 1024 * 1024;
const FOTO_MAX_BAJT = 700 * 1024;
const FOTO_ID_RE = /^[A-Z0-9]{24}$/;
const FOTO_TTL_FELTOLTES = 3 * 24 * 3600;   // csatolatlan (meg nem rendeleshez kotott) feltoltes
const FOTO_TTL_VEGLEGES = 400 * 24 * 3600;  // rendeleshez kotott: a kartya 6 honapig ervenyes
const TOLERANCIA_MP = 300;
const MIN_TITOK = 32;
// ennyi ideig tekintjuk elo kiallitasnak a 'kiallitas_folyamatban' jelzot (utana ujra lehet probalni)
const FOLYAMATBAN_MS = 15 * 60 * 1000;
const PI_RE = /^pi_[A-Za-z0-9]{8,80}$/;
const CH_RE = /^ch_[A-Za-z0-9]{8,80}$/;
const TOKEN_RE = /^[0-9a-f]{64}$/;
const KULCS_RE = /^[A-Za-z0-9_-]{8,100}$/;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"'.]+(\.[^\s@<>()[\]\\,;:"'.]+)*\.[^\s@<>()[\]\\,;:"'.]{2,}$/;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const ATTR_KULCSOK = ['variant_id', 'gift_context', 'relationship', 'occasion', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ttclid'];
// a /fizetes altal irt metadata-kulcsok (termekvaltaskor ezeket mind ujrairjuk / toroljuk)
const FIZETES_META = ['forras', 'termek', 'product_type', ...ATTR_KULCSOK, 'oldal', 'nev', 'iranyitoszam',
  'varos', 'cim', 'ceges_nev', 'ceges_adoszam', 'kartya_cim', 'atvetel', 'kartya_tema', 'kartya_idezet', 'szemelyre_nev', 'foto_id', 'foto_poz',
  'szamla_id', 'szamla_mod', 'szamla_hiba', 'szamla_figy'];

const sajat = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const enc = new TextEncoder();

// --- valaszok ------------------------------------------------------------------------------------------
const ALAP_FEJLEC = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
};

function json(status, adat, fejlec = {}) {
  return { status, headers: { ...ALAP_FEJLEC, 'content-type': 'application/json; charset=utf-8', ...fejlec }, body: JSON.stringify(adat) };
}

let szkriptHash = null;
// urlapKuldes: csak a kiallitas megerosito oldala kuldhet urlapot (form-action 'self'), minden mas 'none'
async function html(k, status, tartalom, { urlapKuldes = false } = {}) {
  if (!szkriptHash) {
    const hash = async (js) => "'sha256-" + base64(await sha256(enc.encode(js))) + "'";
    szkriptHash = (await hash(L.NYOMTAT_JS)) + ' ' + (await hash(L.MASOL_JS));
  }
  let kepForras = "'self'";
  try { kepForras += ' ' + new URL(k.bazis).origin; } catch { /* marad a 'self' */ }
  return {
    status,
    headers: {
      ...ALAP_FEJLEC,
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': `default-src 'none'; img-src ${kepForras}; font-src ${kepForras}; style-src 'unsafe-inline'; script-src ${szkriptHash}; base-uri 'none'; form-action ${urlapKuldes ? "'self'" : "'none'"}; frame-ancestors 'none'`,
    },
    body: tartalom,
  };
}

const oldal = (k, status, cim, bekezdesek, extra = {}) => html(k, status, L.egyszeruOldal({ cim, bekezdesek, bazis: k.bazis, ...extra }), { urlapKuldes: Boolean(extra.urlap) });
const nincsBeallitvaOldal = (k) => oldal(k, 503, 'A rendszer nincs beállítva', ['Az ajándékkártya-rendszer most nem érhető el. Kérlek, írj nekünk: ' + ADAT.SZALON.email]);
const visszavonvaOldal = (k, reszletek) => oldal(k, 409, 'Ez az ajándékkártya nem használható', [
  'Ehhez a rendeléshez visszatérítés/vita tartozik, a kártya nem használható.',
  'Ha kérdésed van, írj nekünk: ' + ADAT.SZALON.email,
], reszletek ? { reszletek } : {});

// A platform-adapterek kozos segedje: a keres torzse meretkorlattal. A tul nagy torzset NEM olvassa
// be (content-length alapjan azonnal, kulonben olvasas kozben all meg). -> { text } | { valasz: 413 }
export async function keresTorzs(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return { text: '' };
  let max = MAX_TORZS;
  try {
    const ut = new URL(request.url).pathname;
    if (/\/webhook\/?$/.test(ut)) max = MAX_WEBHOOK;
    else if (/\/foto\/?$/.test(ut)) max = MAX_FOTO_TORZS;
  } catch { /* alap korlat */ }
  const tulNagy = { valasz: json(413, { hiba: 'tul_nagy' }) };
  const hossz = request.headers.get('content-length');
  if (hossz !== null && hossz !== '' && !(Number(hossz) <= max)) return tulNagy;
  if (!request.body) return { text: '' };
  const olvaso = request.body.getReader();
  const darabok = [];
  let meret = 0;
  for (;;) {
    const { done, value } = await olvaso.read();
    if (done) break;
    meret += value.byteLength;
    if (meret > max) {
      try { await olvaso.cancel(); } catch { /* mindegy */ }
      return tulNagy;
    }
    darabok.push(value);
  }
  const egyben = new Uint8Array(meret);
  let p = 0;
  for (const d of darabok) { egyben.set(d, p); p += d.byteLength; }
  return { text: new TextDecoder().decode(egyben) };
}

// --- kriptografia (Web Crypto) ----------------------------------------------------------------------------
async function sha256(bajtok) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bajtok));
}
async function hmac(kulcsBajtok, uzenet) {
  const kulcs = await crypto.subtle.importKey('raw', kulcsBajtok, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', kulcs, enc.encode(uzenet)));
}
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
function base64(b) {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
// konstans ideju osszehasonlitas (a hossz kiszivároghat, a tartalom nem)
function egyenlo(a, b) {
  a = String(a ?? '');
  b = String(b ?? '');
  let elteres = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) elteres |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return elteres === 0;
}
function veletlenKod(n, abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  const korlat = 256 - (256 % abc.length); // egyenletes eloszlas: a maradek feletti bajtokat eldobjuk
  let s = '';
  while (s.length < n) {
    for (const x of crypto.getRandomValues(new Uint8Array(n * 2))) {
      if (x < korlat && s.length < n) s += abc[x % abc.length];
    }
  }
  return s;
}

const titkosKulcs = (env) => String(env.STRIPE_SECRET_KEY || '').trim();
const publikusKulcs = (env) => String(env.STRIPE_PUBLISHABLE_KEY || '').trim();
const titokSzoveg = (env) => String(env.AJANDEK_TITOK || '').trim();
const titokJo = (env) => titokSzoveg(env).length >= MIN_TITOK;
// a Stripe-ot es a titkot is igenylo vegpontokhoz (fail closed)
const beallitva = (env) => Boolean(titkosKulcs(env)) && titokJo(env);

async function titok(env) {
  if (!titokJo(env)) throw new Error(`AJANDEK_TITOK hianyzik vagy rovidebb ${MIN_TITOK} karakternel`);
  return enc.encode(titokSzoveg(env));
}

// KOD: 'AK-XXXX-XXXX' (a rendelesszam MH-, igy a ketto nem osszetevesztheto) - az HMAC-SHA256(titok, 'kod:' + piId) elso 5 bajtja (40 bit) Crockford base32-ben
export async function kuponKod(env, piId) {
  const b = await hmac(await titok(env), 'kod:' + piId);
  let n = 0;
  for (let i = 0; i < 5; i++) n = n * 256 + b[i];
  let s = '';
  for (let i = 7; i >= 0; i--) s += CROCKFORD[Math.floor(n / 2 ** (5 * i)) % 32];
  return `AK-${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function kiallitToken(env, piId) {
  return hex(await hmac(await titok(env), 'kiallit:' + piId));
}

// A nyomtathato kartya tovabbithato linkjenek tokenje: CSAK a kartya-oldalt nyitja meg (a vevo
// e-mailjet mutato /rendeles-hez es a modosito /szemelyre-hez nem ad hozzaferest, mint a client_secret).
export async function kartyaToken(env, piId) {
  return hex(await hmac(await titok(env), 'kartya:' + piId));
}

// A rendeles-oldal levelben kuldott linkjenek tokenje: CSAK olvasas (/rendeles); a /szemelyre-hez,
// a /fizetes-hez nem jo. Igy a client_secret nem kerul e-mailbe / URL-be.
export async function rendelesToken(env, piId) {
  return hex(await hmac(await titok(env), 'rendeles:' + piId));
}

// --- Stripe REST (fetch) -------------------------------------------------------------------------------
class StripeHiba extends Error {
  constructor(status, tipus, kod) {
    super(`stripe ${status} ${tipus || ''} ${kod || ''}`.trim());
    this.status = status;
    this.tipus = tipus || '';
    this.kod = kod || '';
  }
}

// { a: 1, metadata: { b: 'x' }, expand: ['c'] } -> a=1&metadata[b]=x&expand[]=c
function formKodol(obj, elotag = '', ki = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const nev = elotag ? `${elotag}[${k}]` : k;
    if (Array.isArray(v)) for (const x of v) ki.append(`${nev}[]`, String(x));
    else if (typeof v === 'object') formKodol(v, nev, ki);
    else ki.append(nev, String(v));
  }
  return ki;
}

async function stripe(env, method, ut, params, idemKulcs) {
  const kulcs = titkosKulcs(env);
  if (!kulcs) throw new StripeHiba(0, 'nincs_kulcs');
  const alap = String(env.STRIPE_API_BASE || STRIPE_ALAP).trim().replace(/\/+$/, '');
  const q = formKodol(params).toString();
  const fejlec = { authorization: `Bearer ${kulcs}`, 'stripe-version': String(env.STRIPE_API_VERSION || STRIPE_VERZIO) };
  let cel = alap + ut;
  let torzs;
  if (method === 'GET') {
    if (q) cel += '?' + q;
  } else {
    fejlec['content-type'] = 'application/x-www-form-urlencoded';
    torzs = q;
  }
  if (idemKulcs) fejlec['idempotency-key'] = idemKulcs;
  let v;
  try {
    const jel = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(STRIPE_IDOKORLAT_MS) : undefined;
    v = await fetch(cel, { method, headers: fejlec, body: torzs, signal: jel });
  } catch (e) {
    throw new StripeHiba(0, 'halozat', e && e.name);
  }
  let adat = null;
  try { adat = await v.json(); } catch { /* nem JSON valasz */ }
  if (!v.ok || !adat || typeof adat !== 'object') {
    const h = (adat && adat.error) || {};
    throw new StripeHiba(v.status, h.type, h.code);
  }
  return adat;
}

const piLeker = (env, id) => stripe(env, 'GET', `/v1/payment_intents/${id}`, { expand: ['latest_charge'] });
const piFrissit = (env, id, params) => stripe(env, 'POST', `/v1/payment_intents/${id}`, { ...params, expand: ['latest_charge'] });

function stripeMod(env) {
  const sk = titkosKulcs(env);
  const pk = publikusKulcs(env);
  // titok nelkul a kodok es linkek nem kepezhetok: inkabb ki van kapcsolva (fail closed)
  if (!sk || !pk || !titokJo(env)) return 'nincs';
  const teszt = /^(sk|rk)_test_/.test(sk);
  // teszt titkos kulcs eles publikus kulccsal (vagy forditva): a fizetes ugysem mukodne
  if (teszt ? /^pk_live_/.test(pk) : /^pk_test_/.test(pk)) return 'nincs';
  return teszt ? 'teszt' : 'elo';
}

// --- visszaeles elleni vedelem ------------------------------------------------------------------------------
const PERC = 60 * 1000;
const KORLATOK = {
  fizetes: [{ nev: 'ip', max: 20, ablak: 10 * PERC }],
  szemelyre: [{ nev: 'ip', max: 30, ablak: 10 * PERC }],
  // a tarolot (KV) tolti: IP-nkent es a peldanyon osszesen is korlatos
  foto: [{ nev: 'ip', max: 12, ablak: 10 * PERC }, { nev: 'osszes', max: 300, ablak: 60 * PERC }],
  // levelet kuld tetszoleges cimre: IP-nkent szigoru, es a peldanyon osszesen is korlatos
  atutalas: [{ nev: 'ip', max: 3, ablak: 10 * PERC }, { nev: 'osszes', max: 30, ablak: 60 * PERC }],
};
const MAX_SZAMLALO = 5000;
const szamlalok = new Map(); // kulcs -> { kezdet, db, ablak }

// csak tesztekhez / a helyi fejlesztoi kiszolgalohoz
export function _korlatAlaphelyzet() {
  szamlalok.clear();
}
export const _korlatMeret = () => szamlalok.size;

function szamlaloTakarit(t) {
  for (const [kulcs, s] of szamlalok) if (t - s.kezdet >= s.ablak) szamlalok.delete(kulcs);
  // ha meg mindig tul sok: a legregebbiek ki (a Map beszurasi sorrendben iteral)
  while (szamlalok.size >= MAX_SZAMLALO) szamlalok.delete(szamlalok.keys().next().value);
}

// -> null (mehet) | hany masodperc mulva probalkozhat ujra
function korlatTullepes(ut, ip, most) {
  const szabalyok = KORLATOK[ut];
  if (!szabalyok) return null;
  const t = most.getTime();
  const elemek = szabalyok.map((s) => {
    const kulcs = `${ut}|${s.nev === 'ip' ? 'ip:' + ip : '*'}`;
    let e = szamlalok.get(kulcs);
    if (e && t - e.kezdet >= s.ablak) { szamlalok.delete(kulcs); e = null; }
    return { s, kulcs, e };
  });
  for (const { s, e } of elemek) if (e && e.db >= s.max) return Math.max(1, Math.ceil((e.kezdet + s.ablak - t) / 1000));
  for (const x of elemek) {
    if (x.e) { x.e.db += 1; continue; }
    if (szamlalok.size >= MAX_SZAMLALO) szamlaloTakarit(t);
    szamlalok.set(x.kulcs, { kezdet: t, db: 1, ablak: x.s.ablak });
  }
  return null;
}

function kliensIp(h, adott) {
  for (const x of [adott, h['cf-connecting-ip'], h['x-nf-client-connection-ip'], String(h['x-forwarded-for'] || '').split(',')[0]]) {
    const s = String(x || '').trim();
    if (s) return s.slice(0, 64);
  }
  return 'ismeretlen';
}

// mas oldalrol inditott keres (CSRF / beagyazott urlap)?
function kulsoKeres(k) {
  if (String(k.h['sec-fetch-site'] || '').trim().toLowerCase() === 'cross-site') return true;
  const origin = k.h.origin;
  if (origin === undefined || origin === '') return false;
  try { return new URL(origin).host !== k.u.host; } catch { return true; } // pl. 'null'
}

// A szoveget fogado POST-vegpontok kapuja (a torzs feldolgozasa elott). -> null | kesz valasz
function postKapu(k, ut) {
  if (kulsoKeres(k)) return json(403, { hiba: 'tiltott' });
  const tipus = String(k.h['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (tipus !== 'application/json') return json(415, { hiba: 'tipus' });
  const varj = korlatTullepes(ut, k.ip, k.most);
  if (varj) return json(429, { hiba: 'tul_sok_keres' }, { 'retry-after': String(varj) });
  return null;
}

// --- bemenet ---------------------------------------------------------------------------------------------
// (a regexek szamkodbol epulnek: a forrasfajlban ne legyen nyers U+2028 / U+2029 sorelvalaszto)
const kar = (n) => String.fromCharCode(n);
const SORELVALASZTOK = kar(0x2028) + kar(0x2029);
const VEZERLO = new RegExp('[' + kar(0) + '-' + kar(0x1f) + kar(0x7f) + '-' + kar(0x9f) + SORELVALASZTOK + ']', 'g');
const VEZERLO_SORTORES_NELKUL = new RegExp('[' + kar(0) + '-' + kar(9) + kar(0x0b) + '-' + kar(0x1f) + kar(0x7f) + '-' + kar(0x9f) + SORELVALASZTOK + ']', 'g');
// egysoros szoveg: vezerlokarakterek ki, szokozok osszevonva, trimmelve
function egysor(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v).normalize('NFC').replace(VEZERLO, ' ').replace(/\s+/g, ' ').trim();
}
// tobbsoros szoveg (uzenet): a sortores marad, minden mas vezerlokarakter ki
function tobbsor(v) {
  if (typeof v !== 'string') return '';
  return v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ')
    .replace(VEZERLO_SORTORES_NELKUL, '')
    .replace(/[ ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function jsonTorzs(k, max = MAX_TORZS) {
  if (k.text.length > max) return { valasz: json(413, { hiba: 'tul_nagy' }) };
  let d;
  try { d = JSON.parse(k.text || ''); } catch { d = null; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { valasz: json(400, { hiba: 'ervenytelen', mezok: {} }) };
  return { d };
}

function attrAdat(a) {
  a = a && typeof a === 'object' && !Array.isArray(a) ? a : {};
  const v = ADAT.variantFeloldas(a.variant_id);
  const azon = (x) => { const t = egysor(x).toLowerCase(); return /^[a-z0-9_-]{1,60}$/.test(t) ? t : ''; };
  const sz = (x, max = 200) => egysor(x).slice(0, max);
  return {
    variant_id: v.variant_id,
    gift_context: azon(a.gift_context) || v.gift_context || '',
    relationship: azon(a.relationship) || v.relationship || '',
    occasion: azon(a.occasion) || (v.occasion === 'dynamic' ? '' : v.occasion) || '',
    utm_source: sz(a.utm_source), utm_medium: sz(a.utm_medium), utm_campaign: sz(a.utm_campaign),
    utm_content: sz(a.utm_content), utm_term: sz(a.utm_term),
    gclid: sz(a.gclid, 500), fbclid: sz(a.fbclid, 500), ttclid: sz(a.ttclid, 500),
    oldal: sz(a.oldal, 500),
  };
}

// A /fizetes es az /atutalas kozos mezoi. -> { mezok: {mezo: uzenet}, r: tiszta adat }
function rendelesAdat(d) {
  const m = {};
  const termekId = egysor(d.termek);
  const termek = sajat(ADAT.TERMEKEK, termekId) ? ADAT.TERMEKEK[termekId] : null;
  if (!termek) m.termek = 'Válassz ajándékkártyát.';
  const email = egysor(d.email);
  if (!email) m.email = 'Add meg az e-mail-címed.';
  else if (email.length > 254 || !EMAIL_RE.test(email)) m.email = 'Ez nem tűnik érvényes e-mail-címnek.';
  // az ajandekozott (aki a kartyat kapja) neve: a kartyara kerul, ezert kotelezo
  const ajandekozott = egysor(d.ajandekozott);
  if (!ajandekozott) m.ajandekozott = 'Add meg az ajándékozott nevét.';
  else if (Array.from(ajandekozott).length > KARTYA.NEV_MAX) m.ajandekozott = `Az ajándékozott neve legfeljebb ${KARTYA.NEV_MAX} karakter lehet.`;
  const nev = egysor(d.nev);
  if (!nev) m.nev = 'Add meg a neved.';
  else if (nev.length > 120) m.nev = 'A név legfeljebb 120 karakter lehet.';
  const iranyitoszam = egysor(d.iranyitoszam);
  if (!iranyitoszam) m.iranyitoszam = 'Add meg az irányítószámot.';
  else if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/.test(iranyitoszam)) m.iranyitoszam = 'Ellenőrizd az irányítószámot.';
  const varos = egysor(d.varos);
  if (!varos) m.varos = 'Add meg a települést.';
  else if (varos.length > 100) m.varos = 'A település neve legfeljebb 100 karakter lehet.';
  const cim = egysor(d.cim);
  if (!cim) m.cim = 'Add meg a címet (utca, házszám).';
  else if (cim.length > 200) m.cim = 'A cím legfeljebb 200 karakter lehet.';
  let cegesNev = '';
  let cegesAdoszam = '';
  if (d.ceges && typeof d.ceges === 'object' && !Array.isArray(d.ceges)) {
    cegesNev = egysor(d.ceges.nev);
    cegesAdoszam = egysor(d.ceges.adoszam);
    if (cegesNev || cegesAdoszam) {
      if (!cegesNev) m['ceges.nev'] = 'Add meg a cég nevét.';
      else if (cegesNev.length > 120) m['ceges.nev'] = 'A cégnév legfeljebb 120 karakter lehet.';
      if (!cegesAdoszam) m['ceges.adoszam'] = 'Add meg a cég adószámát.';
      else if (!/^[A-Za-z0-9][A-Za-z0-9 .\/-]{5,22}$/.test(cegesAdoszam) || cegesAdoszam.replace(/\D/g, '').length < 8) {
        m['ceges.adoszam'] = 'Ellenőrizd az adószámot.';
      }
    }
  }
  // hogyan veszi at a kartyat; az otthon nyomtatott kartya szemelyre szabhato (dizajn + foto + idezet + nev)
  const atvetel = egysor(d.atvetel);
  if (atvetel && atvetel !== 'otthon' && atvetel !== 'szemelyesen') m.atvetel = 'Válaszd ki, hogyan veszed át az ajándékkártyát.';
  let szemelyre = null;
  const sz = d.szemelyre;
  if (sz && typeof sz === 'object' && !Array.isArray(sz)) {
    if (atvetel !== 'otthon') {
      m.szemelyre = 'A személyre szabás csak az otthon kinyomtatott kártyához tartozik.';
    } else {
      const tema = egysor(sz.tema);
      if (!KARTYA.tema(tema)) m['szemelyre.tema'] = 'Válassz a felsorolt designok közül.';
      const idezet = tobbsor(sz.idezet);
      if (idezet.length > KARTYA.IDEZET_MAX) m['szemelyre.idezet'] = `Az idézet legfeljebb ${KARTYA.IDEZET_MAX} karakter lehet.`;
      const szNev = egysor(sz.nev);
      if (szNev.length > KARTYA.NEV_MAX) m['szemelyre.nev'] = `A név legfeljebb ${KARTYA.NEV_MAX} karakter lehet.`;
      const fotoId = egysor(sz.foto_id);
      if (fotoId && !FOTO_ID_RE.test(fotoId)) m['szemelyre.foto'] = 'Érvénytelen fotó-azonosító: töltsd fel újra a fotót.';
      szemelyre = { tema, idezet, nev: szNev, foto_id: fotoId, foto_poz: fotoId ? KARTYA.pozIr(KARTYA.pozOlvas(egysor(sz.foto_poz))) : '' };
    }
  }
  return {
    mezok: m,
    r: {
      termek, email, ajandekozott, nev, iranyitoszam, varos, cim, ceges_nev: cegesNev, ceges_adoszam: cegesAdoszam, attr: attrAdat(d.attr),
      atvetel, szemelyre,
    },
  };
}

function arFt(termek) {
  const ar = Number(termek.ar_ft);
  if (!Number.isSafeInteger(ar) || ar <= 0) throw new Error('hibas ar az ajandek-adatban: ' + termek.id);
  return ar;
}

// ures ertek kihagyva, minden ertek legfeljebb 500 karakter (a Stripe korlatja)
function metaTisztit(md) {
  const ki = {};
  for (const [k, v] of Object.entries(md)) {
    const s = String(v ?? '');
    if (s) ki[k] = s.slice(0, 500);
  }
  return ki;
}

function fizetesMeta(r) {
  return metaTisztit({
    forras: FORRAS, termek: r.termek.id, product_type: r.termek.product_type, ...r.attr,
    nev: r.nev, iranyitoszam: r.iranyitoszam, varos: r.varos, cim: r.cim,
    ceges_nev: r.ceges_nev, ceges_adoszam: r.ceges_adoszam, kartya_cim: r.termek.kartya_cim,
    atvetel: r.atvetel,
    ...(r.szemelyre ? {
      kartya_tema: r.szemelyre.tema, kartya_idezet: r.szemelyre.idezet, szemelyre_nev: r.szemelyre.nev,
      foto_id: r.szemelyre.foto_id, foto_poz: r.szemelyre.foto_poz,
    } : {}),
    // a megajandekozott neve: a szemelyre szabott kartyan a tervezo neve, egyebkent az ajandekozott mezo (a ket mezo a weboldalon egy)
    szemelyre_nev: (r.szemelyre && r.szemelyre.nev) || r.ajandekozott,
  });
}

// --- a rendeles allapota -----------------------------------------------------------------------------------
// Atutalasos igeny: a PaymentIntent csak NYILVANTARTASI rekord (soha nem fizetheto ki kartyaval, a client_secretjet
// senki nem kapja meg). "Fizetve" = a szalon az "utalas beerkezett" gombbal jovahagyta (metadata).
const atutalasos = (md) => Boolean(md) && md.fizetesi_mod === 'atutalas';

function piAllapot(pi) {
  if (atutalasos(pi.metadata)) return pi.metadata.atutalas_beerkezett === '1' ? 'fizetve' : 'nyitott';
  if (pi.status === 'succeeded') return 'fizetve';
  if (pi.status === 'processing') return 'feldolgozas';
  if (pi.status === 'requires_payment_method' && pi.last_payment_error) return 'sikertelen';
  return 'nyitott';
}

function fizetesiMod(ch) {
  const pmd = ch && ch.payment_method_details;
  if (!pmd) return null;
  return (pmd.card && pmd.card.wallet && pmd.card.wallet.type) || pmd.type || null;
}

// ISO -> 'YYYY-MM-DD' budapesti ido szerint (az ervenyesseg a vasarlas helyi napjatol szamit)
function budapestiNap(iso) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
    if (p.year && p.month && p.day) return `${p.year}-${p.month}-${p.day}`;
  } catch { /* nincs Intl-idozona: UTC */ }
  return String(iso).slice(0, 10);
}

const alkalomCim = (id) => (ADAT.ALKALMAK.find((a) => a.id === id) || {}).cim || '';
const atadasCim = (id) => (ADAT.ATADASOK.find((a) => a.id === id) || {}).cim || '';

function folyamatbanFriss(md, most) {
  const t = Date.parse(md.kiallitas_folyamatban || '');
  return Number.isFinite(t) && Math.abs(most.getTime() - t) < FOLYAMATBAN_MS;
}

// Minden, ami a PI-bol kovetkezik (valasz, levelek, kartya)
async function rendelesInfo(k, pi) {
  const md = pi.metadata || {};
  const atu = atutalasos(md);
  const termek = sajat(ADAT.TERMEKEK, md.termek) ? ADAT.TERMEKEK[md.termek] : null;
  const ch = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const allapot = piAllapot(pi);
  const fizetve = allapot === 'fizetve';
  // utalasnal a jovahagyas ideje szamit (a Salonic-utalvany ervenyessege is az ertekesites napjatol indul)
  const fizetveMp = fizetve ? (atu ? Math.floor(Date.parse(md.atutalas_ekkor || '') / 1000) : Number((ch && ch.created) || pi.created)) || null : null;
  const fizetveEkkor = fizetveMp ? new Date(fizetveMp * 1000).toISOString() : null;
  // visszaterites (reszleges is) vagy vita: a PI 'succeeded' marad, de a kartya nem hasznalhato
  const visszaterites = Boolean(ch && (ch.refunded === true || Number(ch.amount_refunded) > 0));
  const vita = Boolean(ch && ch.disputed === true);
  const visszavonva = fizetve && (visszaterites || vita || Boolean(md.visszavonva));
  return {
    pi, md, termek, allapot, fizetve, visszavonva,
    visszavonas_oka: vita || md.visszavonva === 'vita' ? 'vita' : visszaterites || md.visszavonva ? 'visszaterites' : null,
    visszaterites_szoveg: ch && Number(ch.amount_refunded) > 0 ? ADAT.arSzoveg(Number(ch.amount_refunded) / 100) : '',
    kesz: fizetve && !visszavonva && md.kartya_kesz === '1',
    fizetve_ekkor: fizetveEkkor,
    ervenyes_ig: fizetveEkkor ? ADAT.ervenyesIg(budapestiNap(fizetveEkkor)) : null,
    // utalasnal a vevo altal ismert ATU-azonosito (a kozlemenyben van), kulonben a PI-bol szamolt MH-azonosito
    rendeles_id: atu && md.atu_ref ? md.atu_ref : ADAT.rendelesAzonosito(pi.id),
    atutalas: atu,
    // az otthon nyomtatott (szemelyre szabhato) kartya adatai
    atvetel: md.atvetel || '',
    tema: md.kartya_tema && KARTYA.tema(md.kartya_tema) ? md.kartya_tema : '',
    idezet: md.kartya_idezet || '',
    foto_id: FOTO_ID_RE.test(md.foto_id || '') ? md.foto_id : '',
    termek_nev: termek ? termek.nev : (md.termek || ''),
    kartya_cim: md.kartya_cim || (termek ? termek.kartya_cim : ''),
    osszeg: Math.round(Number(pi.amount) / 100),
    osszeg_szoveg: ADAT.arSzoveg(Number(pi.amount) / 100),
    penznem: String(pi.currency || 'huf').toUpperCase(),
    email: pi.receipt_email || '',
    fizetesi_mod: atu ? 'atutalas' : fizetesiMod(ch),
    // kartyas fizetesnel a webhook a metadataba is beirja (titokcsere utan is ugyanaz maradjon); a szalon a
    // kiallitaskor felulirhatja (a Salonicban letrehozott kupon / utalvany kodja). Utalasnal CSAK a szalon adja meg.
    kod: fizetve ? (md.kod || (atu ? null : await kuponKod(k.env, pi.id))) : null,
    javasolt_kod: atu ? '' : await kuponKod(k.env, pi.id),
    // tovabbithato link (az ajandekozottnak is): kulon token, client_secret NELKUL
    kartya_url: fizetve ? `${k.bazis}/api/ajandek/kartya?pi=${encodeURIComponent(pi.id)}&t=${await kartyaToken(k.env, pi.id)}` : null,
    // a levelben kuldott rendeles-link: csak olvaso token, client_secret NELKUL
    rendeles_url: `${k.bazis}/ajandek?rendeles=${encodeURIComponent(pi.id)}&rt=${await rendelesToken(k.env, pi.id)}`,
  };
}

function rendelesValasz(i) {
  const attr = {};
  for (const kulcs of ATTR_KULCSOK) attr[kulcs] = i.md[kulcs] || null;
  const kartya = { allapot: i.visszavonva ? 'visszavonva' : i.kesz ? 'kesz' : 'keszul', ervenyes_ig: i.ervenyes_ig };
  if (i.kesz) {
    kartya.url = i.kartya_url;
    kartya.kod = i.kod;
  }
  const sz = {
    nev: i.md.szemelyre_nev || null, uzenet: i.md.szemelyre_uzenet || null,
    alkalom: i.md.szemelyre_alkalom || null, atadas: i.md.szemelyre_atadas || null,
    tema: i.tema || null, idezet: i.idezet || null, foto: Boolean(i.foto_id),
  };
  return {
    allapot: i.allapot,
    visszavonva: i.visszavonva,
    rendeles_id: i.rendeles_id,
    atvetel: i.atvetel || null,
    termek: i.md.termek || null,
    termek_nev: i.termek_nev || null,
    kartya_cim: i.kartya_cim || null,
    osszeg: i.osszeg,
    penznem: i.penznem,
    email: i.email || null,
    fizetesi_mod: i.fizetve || i.allapot === 'feldolgozas' ? i.fizetesi_mod : null,
    fizetve_ekkor: i.fizetve_ekkor,
    attr,
    kartya,
    szemelyre: Object.values(sz).some(Boolean) ? sz : null,
  };
}

const TILTOTT = { status: 403, hiba: 'tiltott' };

// pi + client_secret (a vevo bongeszojeben van; olvasas ES modositas). -> { pi } | { status, hiba }
async function hitelesPi(k, piId, cs) {
  piId = String(piId ?? '').trim();
  cs = String(cs ?? '').trim();
  if (!PI_RE.test(piId) || !cs || cs.length > 200 || !cs.startsWith(piId + '_secret_')) return TILTOTT;
  if (!beallitva(k.env)) return { status: 503, hiba: 'nincs_beallitva' };
  let pi;
  try {
    pi = await piLeker(k.env, piId);
  } catch (e) {
    if (e instanceof StripeHiba && e.status === 404) return TILTOTT;
    throw e;
  }
  if (!egyenlo(cs, pi.client_secret)) return TILTOTT;
  if (!pi.metadata || pi.metadata.forras !== FORRAS) return { status: 404, hiba: 'nincs' };
  return { pi };
}

// pi + celhoz kotott HMAC-token (kartyaToken / rendelesToken). -> { pi } | { status, hiba }
async function tokenesPi(k, piNyers, tNyers, tokenFv) {
  const piId = String(piNyers ?? '').trim();
  const t = String(tNyers ?? '').trim().toLowerCase();
  if (!beallitva(k.env)) return { status: 503, hiba: 'nincs_beallitva' };
  if (!PI_RE.test(piId) || !TOKEN_RE.test(t) || !egyenlo(t, await tokenFv(k.env, piId))) return TILTOTT;
  let pi;
  try {
    pi = await piLeker(k.env, piId);
  } catch (e) {
    if (e instanceof StripeHiba && e.status === 404) return { status: 404, hiba: 'nincs' };
    throw e;
  }
  if (!pi.metadata || pi.metadata.forras !== FORRAS) return { status: 404, hiba: 'nincs' };
  return { pi };
}

async function levelKuld(k, level) {
  if (typeof k.kuld !== 'function') throw new Error('nincs levelkuldo');
  await k.kuld(level);
}

// metadata-iras, ami NEM dob: egy mar kiment level utan a hiba ne okozzon ujrakuldest
async function metaIrasCsendes(k, piId, metadata, mi) {
  try {
    return await piFrissit(k.env, piId, { metadata });
  } catch (e) {
    console.error(`ajandek: metadata-iras hiba (${mi})`, piId, e && e.message);
    return null;
  }
}

// --- vegpontok ---------------------------------------------------------------------------------------------
async function beallitas(k) {
  const mod = stripeMod(k.env);
  return json(200, { mod, publikus_kulcs: mod === 'nincs' ? null : publikusKulcs(k.env), azonnali_kartya: k.env.AJANDEK_AZONNALI === '1', foto: Boolean(fotoTar(k.env)) && mod !== 'nincs' });
}

// --- Stripe-szamla (tetelek + Stripe Tax): a szamlabridge a Stripe Invoice tetelei ELSOKENT olvassa, igy keszul a szamlazz.hu-s szamla ---
// Ugyanaz az elv, mint a regi fizetolinkeknel: tetelenkent nev + osszeg + Stripe-adokod (txcd_...), brutto arba szamitva, a Stripe Tax szamolja az
// AFA-t; a nem adozo tetelt (txcd_00000000) a szamlabridge TAM-ra forditja. Kapcsolo: AJANDEK_STRIPE_SZAMLA="1". Barmilyen hiba (jogosultsag, adoszam,
// eltero osszeg / ado) eseten a fizetes NEM akad el: sima PaymentIntent keszul, a szalon-level jelzi, hogy a szamlat kezzel kell kiallitani.
// AJANDEK_STRIPE_SZAMLA: "1" = minden fizetes; "teszt" = csak a probavasarlasok (a vevo e-mail cime tartalmazza a "+szamlateszt" cimkezest, pl.
// valaki+szamlateszt@gmail.com): igy a szamla igazolhato az eles fiokban, mielott a valodi vevok megkapnak; ures = ki.
const szamlaBe = (env, email) => {
  const m = String(env.AJANDEK_STRIPE_SZAMLA || '');
  return m === '1' || (m === 'teszt' && /\+szamlateszt@/i.test(String(email || '')));
};
const SZAMLA_ID_RE = /^in_[A-Za-z0-9]{8,80}$/;
const szamlaInfo = (md) => ({
  mod: md.szamla_mod === 'invoice' ? 'invoice' : 'nincs', hiba: md.szamla_hiba || '', figy: md.szamla_figy || '',
  tetelek: (ADAT.szamlaTetelek(md.termek) || []).map((t) => ({ nev: t.nev, ft: t.ft, afa: t.afa })),
});

async function szamlaVoid(k, id) {
  try {
    await stripe(k.env, 'POST', `/v1/invoices/${id}/void`, {});
  } catch (e) {
    console.error('ajandek: a Stripe-szamla visszavonasa nem sikerult', id, e && e.message);
  }
}

// ujraprobalas (pl. elutasitott kartya utan): az elozo probalkozas nyitott, ki nem fizetett szamlajat visszavonjuk
async function szamlaRegiVisszavon(k, piId, cs) {
  if (!(piId && cs && PI_RE.test(piId) && cs.startsWith(piId + '_secret_'))) return;
  try {
    const regi = await stripe(k.env, 'GET', `/v1/payment_intents/${piId}`);
    const md = regi.metadata || {};
    if (egyenlo(cs, regi.client_secret) && md.forras === FORRAS && regi.status === 'requires_payment_method' && SZAMLA_ID_RE.test(md.szamla_id || '')) await szamlaVoid(k, md.szamla_id);
  } catch (e) {
    console.error('ajandek: az elozo Stripe-szamla ellenorzese nem sikerult', piId, e && e.message);
  }
}

// Ugyfel + szamlatetelek + Stripe-szamla (veglegesitve) -> a szamla PaymentIntentje (a Payment Element ezt fizeti). Hiba eseten dob.
async function szamlaPi(k, r, ar, leiras, meta, kulcs) {
  const tetelek = ADAT.szamlaTetelek(r.termek.id);
  if (!tetelek || !tetelek.length || tetelek.reduce((o, t) => o + t.ft, 0) !== ar) throw new Error('szamla_tetel');
  const id = (nev) => `ah-sz-${kulcs}-${nev}`;
  const ugyfelParam = {
    name: r.ceges_nev || r.nev, email: r.email, metadata: { forras: FORRAS },
    address: { line1: r.cim, city: r.varos, postal_code: r.iranyitoszam, country: 'HU' },
  };
  let figy = '';
  let ugyfel = null;
  if (r.ceges_adoszam) {
    // a Stripe hu_tin formatuma: 12345678-1-23 (a vevo szokozzel / kotojel nelkul is megadhatja)
    const szj = String(r.ceges_adoszam).replace(/[\s.\-/]/g, '');
    const adoszam = /^\d{11}$/.test(szj) ? `${szj.slice(0, 8)}-${szj.slice(8, 9)}-${szj.slice(9)}` : '';
    if (!adoszam) figy = 'adoszam';
    else try {
      ugyfel = await stripe(k.env, 'POST', '/v1/customers', { ...ugyfelParam, tax_id_data: { 0: { type: 'hu_tin', value: adoszam } } }, id('u'));
    } catch (e) {
      if (!(e instanceof StripeHiba && e.status === 400)) throw e;
      figy = 'adoszam'; // a Stripe nem fogadta el az adoszamot: ugyfel adoszam nelkul, a szalon-level figyelmeztet
    }
  }
  if (!ugyfel) ugyfel = await stripe(k.env, 'POST', '/v1/customers', ugyfelParam, id('u2'));
  for (const [i, t] of tetelek.entries()) {
    await stripe(k.env, 'POST', '/v1/invoiceitems', {
      customer: ugyfel.id, currency: 'huf', amount: t.ft * 100, description: t.nev, tax_behavior: 'inclusive', tax_code: t.adokod,
      metadata: { forras: FORRAS },
    }, id('t' + i));
  }
  const szamlaParam = {
    customer: ugyfel.id, collection_method: 'charge_automatically', auto_advance: false, currency: 'huf',
    automatic_tax: { enabled: true }, pending_invoice_items_behavior: 'include', metadata: { forras: FORRAS },
  };
  // A fizetesi modok: a szamla PI-je ugyanazt az EXPLICIT listat kapja, mint a Payment Element (ajandek-adat.js FIZETESI_MODOK); a dinamikus Element
  // explicit listas PI-t nem fogad el, ezert a kliens Element-je is ezt a listat kapja.
  const szamla = await stripe(k.env, 'POST', '/v1/invoices', { ...szamlaParam, payment_settings: { payment_method_types: ADAT.FIZETESI_MODOK } }, id('s'));
  const biztos = async (hiba) => { await szamlaVoid(k, szamla.id); throw new Error(hiba); };
  const kesz = await stripe(k.env, 'POST', `/v1/invoices/${szamla.id}/finalize`, { auto_advance: false, expand: ['payment_intent'] }, id('f'));
  const pi = kesz.payment_intent;
  if (!SZAMLA_ID_RE.test(String(kesz.id || ''))) return biztos('szamla_id');
  if (kesz.status !== 'open') return biztos('szamla_allapot');
  if (!kesz.automatic_tax || kesz.automatic_tax.status !== 'complete') return biztos('szamla_ado_nem_kesz:' + String(kesz.automatic_tax && (kesz.automatic_tax.status || kesz.automatic_tax.disabled_reason)));
  if (Number(kesz.amount_due) !== ar * 100 || Number(kesz.total) !== ar * 100) return biztos(`szamla_osszeg:${kesz.amount_due}/${kesz.total}/${ar * 100}`);
  if (!kesz.lines || !Array.isArray(kesz.lines.data) || kesz.lines.data.length !== tetelek.length) return biztos(`szamla_sorok:${kesz.lines && kesz.lines.data && kesz.lines.data.length}/${tetelek.length}`);
  // az ado: a 27%-os sorok brutto aranak 27/127-e (Stripe-kerekites: legfeljebb 1 forint = 100 egyseg elteres), a nem adozo sorokon 0
  const vartAdo = tetelek.reduce((o, t) => o + (t.adokod === 'txcd_00000000' ? 0 : Math.round(t.ft * 100 * 27 / 127)), 0);
  // a kapott ado: az ado-sorok osszege (a Stripe ezt mindig kitolti), ennek hianyaban a `tax` mezo
  const kapottAdo = Array.isArray(kesz.total_tax_amounts) && kesz.total_tax_amounts.length ? kesz.total_tax_amounts.reduce((o, t) => o + Number(t.amount || 0), 0) : Number(kesz.tax || 0);
  // AJANDEK_SZAMLA_ADO_ELLENORZES="0" csak az elonezeti (Stripe teszt-mod) kornyezetben: a teszt-modnak nincs sajat adoregisztracioja (0 ado), az eles mindig ellenoriz
  if (String(k.env.AJANDEK_SZAMLA_ADO_ELLENORZES || '') !== '0' && (!Number.isFinite(kapottAdo) || Math.abs(kapottAdo - vartAdo) > 100)) return biztos(`szamla_ado:${kapottAdo}/${vartAdo}`);
  if (!pi || typeof pi !== 'object' || !PI_RE.test(String(pi.id || '')) || !pi.client_secret) return biztos('szamla_pi');
  // a PaymentIntent metadata-ja nelkul a webhook nem ismerne fel a rendelest: ha ez nem sikerul, a szamlat visszavonjuk (sima PI-ra esunk vissza)
  let frissitve;
  try {
    frissitve = await stripe(k.env, 'POST', `/v1/payment_intents/${pi.id}`, {
      description: leiras, receipt_email: r.email,
      metadata: { ...meta, szamla_id: kesz.id, szamla_mod: 'invoice', ...(figy ? { szamla_figy: figy } : {}) },
    });
  } catch (e) {
    await szamlaVoid(k, kesz.id);
    throw e;
  }
  if (!frissitve.client_secret) frissitve.client_secret = pi.client_secret;
  return frissitve;
}

async function fizetes(k) {
  const kapu = postKapu(k, 'fizetes');
  if (kapu) return kapu;
  const { d, valasz } = jsonTorzs(k);
  if (valasz) return valasz;
  // robotcsapda: sikeresnek latszo valasz, de semmi nem tortenik
  if (egysor(d['bot-field'])) return json(200, { ok: true });
  const { mezok, r } = rendelesAdat(d);
  let kulcs = egysor(d.kulcs);
  if (kulcs && !KULCS_RE.test(kulcs)) mezok.kulcs = 'Érvénytelen kérésazonosító – frissítsd az oldalt.';
  if (Object.keys(mezok).length) return json(400, { hiba: 'ervenytelen', mezok });
  if (stripeMod(k.env) === 'nincs') return json(503, { hiba: 'nincs_beallitva' });
  if (!kulcs) kulcs = veletlenKod(24);
  const fotoHiba = await fotoCsatolasEllenorzes(k, r);
  if (fotoHiba) return fotoHiba;

  const ar = arFt(r.termek);
  const meta = fizetesMeta(r);
  const leiras = `MOSAIC Head Spa ajándékkártya - ${r.termek.nev}`;
  const piId = egysor(d.pi);
  const cs = egysor(d.cs);
  let pi = null;

  // Stripe-szamla mod: minden probalkozas uj szamla (a regit visszavonjuk); hiba eseten sima PaymentIntent, a szalon-level jelzi
  const szamlaMod = szamlaBe(k.env, r.email);
  if (szamlaMod) {
    await szamlaRegiVisszavon(k, piId, cs);
    try {
      const sz = await szamlaPi(k, r, ar, leiras, meta, kulcs);
      return json(200, {
        pi: sz.id, client_secret: sz.client_secret, osszeg: Math.round(Number(sz.amount) / 100), penznem: 'HUF', rendeles_id: ADAT.rendelesAzonosito(sz.id), szamla: 'stripe',
        // teszt-modban (elonezet) a diagnosztikahoz: a szamla PI-jenek fizetesi modjai (a Payment Element-tel egyezniuk kell)
        ...(stripeMod(k.env) === 'teszt' ? { szamla_pi: { tipusok: sz.payment_method_types || null, auto: sz.automatic_payment_methods || null } } : {}),
      });
    } catch (e) {
      console.error('ajandek: a Stripe-szamla letrehozasa nem sikerult, sima PaymentIntent (a szamlat kezzel kell kiallitani):', e && e.message, e && e.status, e && e.kod);
      meta.szamla_mod = 'nincs';
      meta.szamla_hiba = String((e && e.message) || 'ismeretlen').slice(0, 80);
    }
  }

  // termekvaltas / adatjavitas: ugyanaz a PI, ha meg fizetes elott all
  if (!szamlaMod && piId && cs && PI_RE.test(piId) && cs.startsWith(piId + '_secret_')) {
    let regi = null;
    try {
      regi = await stripe(k.env, 'GET', `/v1/payment_intents/${piId}`);
    } catch (e) {
      if (!(e instanceof StripeHiba && e.status === 404)) throw e;
    }
    if (regi && egyenlo(cs, regi.client_secret) && regi.metadata && regi.metadata.forras === FORRAS && regi.status === 'requires_payment_method') {
      const torol = Object.fromEntries(FIZETES_META.map((m) => [m, '']));
      pi = await stripe(k.env, 'POST', `/v1/payment_intents/${piId}`, {
        amount: ar * 100, receipt_email: r.email, description: leiras, metadata: { ...torol, ...meta },
      });
    }
  }

  if (!pi) {
    const params = {
      amount: ar * 100, currency: 'huf', payment_method_types: ADAT.FIZETESI_MODOK,
      receipt_email: r.email, description: leiras, metadata: meta,
    };
    // ha a kliens egy mar nem modosithato PI-t kuldott vissza, ugyanazzal a kulccsal a regit kapnank vissza
    const idem = 'ah-' + kulcs + (piId ? '-' + hex(await sha256(enc.encode(piId))).slice(0, 12) : '');
    try {
      pi = await stripe(k.env, 'POST', '/v1/payment_intents', params, idem);
    } catch (e) {
      // ugyanaz a kulcs mas adatokkal (pl. termekvaltas pi/cs nelkul): uj PI, sajat kulccsal
      if (!(e instanceof StripeHiba && e.tipus === 'idempotency_error')) throw e;
      const ujabb = idem + '-' + hex(await sha256(enc.encode(formKodol(params).toString()))).slice(0, 16);
      pi = await stripe(k.env, 'POST', '/v1/payment_intents', params, ujabb);
    }
  }

  return json(200, {
    pi: pi.id,
    client_secret: pi.client_secret,
    osszeg: Math.round(Number(pi.amount) / 100),
    penznem: 'HUF',
    rendeles_id: ADAT.rendelesAzonosito(pi.id),
    // Stripe-szamla mod: ha a szamla nem jott letre, itt latszik (a fizetes ettol meg megy; a szalon-level kezi szamlat kér)
    ...(szamlaMod ? { szamla: 'nincs', szamla_hiba: meta.szamla_hiba || '' } : {}),
  });
}

async function rendeles(k) {
  const rt = k.u.searchParams.get('rt');
  const h = rt
    ? await tokenesPi(k, k.u.searchParams.get('pi'), rt, rendelesToken)
    : await hitelesPi(k, k.u.searchParams.get('pi'), k.u.searchParams.get('cs'));
  if (h.hiba) return json(h.status, { hiba: h.hiba });
  return json(200, rendelesValasz(await rendelesInfo(k, h.pi)));
}

async function szemelyre(k) {
  const kapu = postKapu(k, 'szemelyre');
  if (kapu) return kapu;
  const { d, valasz } = jsonTorzs(k);
  if (valasz) return valasz;
  // csak a client_secret jo (az olvaso rt / kartya t token NEM)
  const h = await hitelesPi(k, d.pi, d.cs);
  if (h.hiba) return json(h.status, { hiba: h.hiba });
  const elozo = h.pi.metadata;
  if (piAllapot(h.pi) !== 'fizetve') return json(409, { hiba: 'nincs_fizetve' });
  if ((await rendelesInfo(k, h.pi)).visszavonva) return json(409, { hiba: 'visszavonva' });

  const m = {};
  const nev = egysor(d.nev);
  if (nev.length > 80) m.nev = 'A név legfeljebb 80 karakter lehet.';
  const uzenet = tobbsor(d.uzenet);
  if (uzenet.length > 300) m.uzenet = 'Az üzenet legfeljebb 300 karakter lehet.';
  const alkalom = egysor(d.alkalom);
  if (alkalom && !ADAT.ALKALMAK.some((a) => a.id === alkalom)) m.alkalom = 'Válassz a felsorolt alkalmak közül.';
  const atadas = egysor(d.atadas);
  if (atadas && !ADAT.ATADASOK.some((a) => a.id === atadas)) m.atadas = 'Válassz a felsorolt átadási módok közül.';
  if (Object.keys(m).length) return json(400, { hiba: 'ervenytelen', mezok: m });

  const fizikai = atadas === 'fizikai';
  let pi = await piFrissit(k.env, h.pi.id, {
    metadata: {
      szemelyre_nev: nev, szemelyre_uzenet: uzenet, szemelyre_alkalom: alkalom, szemelyre_atadas: atadas,
      // ha mar nem fizikai, a kovetkezo fizikai valasztas ujra ertesitsen
      ...(fizikai ? {} : { fizikai_ertesitve: '' }),
    },
  });

  // fizikai kartya / szalonban atvetel: a szalon ertesitest kap (es minden kesobbi modositasrol)
  const valtozott = (elozo.szemelyre_nev || '') !== nev || (elozo.szemelyre_uzenet || '') !== uzenet || (elozo.szemelyre_alkalom || '') !== alkalom;
  if (fizikai && (elozo.fizikai_ertesitve !== '1' || valtozott)) {
    const i = await rendelesInfo(k, pi);
    let kiment = false;
    try {
      await levelKuld(k, {
        cimzett: 'szalon',
        valasz: i.email || undefined,
        ...L.szalonFizikaiLevel({
          rendeles_id: i.rendeles_id, pi: pi.id, termek_nev: i.termek_nev, kod: i.kod, ervenyes_ig: i.ervenyes_ig,
          email: i.email, vevo_nev: i.md.nev, nev, uzenet, alkalom_cim: alkalomCim(alkalom), atadas_cim: atadasCim(atadas),
          modositas: elozo.fizikai_ertesitve === '1',
        }),
      });
      kiment = true;
    } catch (e) {
      // a szemelyre szabas mentve; a jelzo nem allt be, a kovetkezo mentes ujra probalja
      console.error('ajandek: szemelyre - kuldesi hiba', pi.id, e && e.message);
    }
    if (kiment && elozo.fizikai_ertesitve !== '1') pi = (await metaIrasCsendes(k, pi.id, { fizikai_ertesitve: '1' }, 'fizikai_ertesitve')) || pi;
  }
  return json(200, rendelesValasz(await rendelesInfo(k, pi)));
}

async function kartya(k) {
  k.htmlValasz = true;
  const t = k.u.searchParams.get('t');
  const h = t
    ? await tokenesPi(k, k.u.searchParams.get('pi'), t, kartyaToken)
    : await hitelesPi(k, k.u.searchParams.get('pi'), k.u.searchParams.get('cs'));
  if (h.hiba === 'nincs_beallitva') return nincsBeallitvaOldal(k);
  if (h.hiba === 'tiltott') return oldal(k, 403, 'A link nem érvényes', ['Ellenőrizd, hogy a teljes linket nyitottad-e meg a levélből. Ha nem sikerül, írj nekünk: ' + ADAT.SZALON.email]);
  if (h.hiba) return oldal(k, h.status, 'Ez az ajándékkártya nem található', ['Ha kérdésed van, írj nekünk: ' + ADAT.SZALON.email]);
  const i = await rendelesInfo(k, h.pi);
  if (i.visszavonva) return visszavonvaOldal(k);
  if (i.allapot === 'feldolgozas') {
    return oldal(k, 409, 'A fizetésed feldolgozás alatt áll', ['Amint a fizetés beérkezik, elkészítjük az ajándékkártyádat, és e-mailben is elküldjük. Ez az oldal 20 másodpercenként magától frissül.'], { frissit: 20 });
  }
  if (!i.fizetve) {
    return oldal(k, 409, 'Ehhez a rendeléshez még nem érkezett fizetés', ['Ha már fizettél, kérlek, írj nekünk: ' + ADAT.SZALON.email]);
  }
  if (!i.kesz) {
    return oldal(k, 409, 'Készítjük az ajándékkártyádat…', [
      'Amint elkészül, e-mailben is elküldjük. Ez az oldal 20 másodpercenként magától frissül, nem kell itt várnod.',
    ], { frissit: 20, reszletek: [['Rendelés', i.rendeles_id], ['Termék', i.termek_nev]] });
  }
  if (i.atvetel === 'otthon' && i.tema) return szemelyreSzabottOldal(k, i);
  return html(k, 200, L.kartyaOldal({
    bazis: k.bazis, kod: i.kod, kartya_felirat: i.termek ? i.termek.kartya_felirat : null, ar_szoveg: i.osszeg_szoveg,
    nev: i.md.szemelyre_nev || '', uzenet: i.md.szemelyre_uzenet || '',
    ervenyes_ig: i.ervenyes_ig, szalon: ADAT.SZALON,
  }));
}

// A szalon kiallito linkje ket lepesben mukodik: a GET (a levelben levo link) csak ellenoriz es
// megerosito oldalt ad - igy egy levelszkenner / linkelonezet automatikus GET-je nem allit ki
// semmit -, a kiallitast az oldal urlapjanak POST-ja vegzi. Mindket lepes HMAC-tokenhez kotott.
// -> { valasz } (kesz HTML-valasz) | { pi, i, reszletek, piId, t }
async function kiallitElokeszit(k, piNyers, tNyers) {
  k.htmlValasz = true;
  const piId = String(piNyers ?? '').trim();
  const t = String(tNyers ?? '').trim().toLowerCase();
  if (!beallitva(k.env)) return { valasz: await nincsBeallitvaOldal(k) };
  if (!PI_RE.test(piId) || !TOKEN_RE.test(t) || !egyenlo(t, await kiallitToken(k.env, piId))) {
    return { valasz: await oldal(k, 403, 'Érvénytelen link', ['Ez a kiállító link nem érvényes. A rendelésről szóló levélben lévő gombot használd.']) };
  }
  let pi;
  try {
    pi = await piLeker(k.env, piId);
  } catch (e) {
    if (e instanceof StripeHiba && e.status === 404) return { valasz: await oldal(k, 404, 'A rendelés nem található', []) };
    throw e;
  }
  if (!pi.metadata || pi.metadata.forras !== FORRAS) return { valasz: await oldal(k, 404, 'A rendelés nem található', []) };
  const i = await rendelesInfo(k, pi);
  const md = i.md;
  const szl = await szemelyreLeiras(k, i);
  const szemelyreSorok = [
    ['Átvétel', szl.atvetel_szoveg], ['Kártya-design', szl.design_szoveg], ['Idézet', szl.idezet_szoveg], ['Saját fotó', szl.design_szoveg ? (szl.foto_van ? 'van' : 'nincs') : ''],
  ];
  const reszletek = (i.atutalas
    ? [['Azonosító (közlemény)', i.rendeles_id], ['Termék', i.termek_nev], ['Összeg', i.osszeg_szoveg], ['Vevő neve', md.nev], ['Vevő e-mail', i.email],
      ['Vevő telefon', md.telefon], ['Megajándékozott', md.szemelyre_nev]]
    : [['Rendelés', i.rendeles_id], ['Termék', i.termek_nev], ['Összeg', i.osszeg_szoveg], ['Érvényes', i.ervenyes_ig ? L.datumIg(i.ervenyes_ig) : ''], ['Vevő', i.email], ['Megajándékozott', md.szemelyre_nev]]
  ).concat(szemelyreSorok);
  if (!i.fizetve && !i.atutalas) {
    return { valasz: await oldal(k, 409, 'A rendelés még nincs kifizetve', ['A kártyát csak sikeres fizetés után lehet kiállítani.'], { reszletek }) };
  }
  if (i.visszavonva) return { valasz: await visszavonvaOldal(k, reszletek) };
  if (i.md.kartya_kesz === '1') {
    return { valasz: await oldal(k, 200, 'Ez az ajándékkártya már ki van állítva', ['A vevő korábban megkapta a levelet a kártyával; újat nem küldtünk.'], { reszletek }) };
  }
  if (folyamatbanFriss(i.md, k.most)) {
    return {
      valasz: await oldal(k, 409, 'A kiállítás folyamatban van', [
        'Ennek az ajándékkártyának a kiállítása pár perce elindult; újabb levelet nem küldtünk.',
        'Ha 15 perc múlva sem látod kiállítottnak, nyisd meg újra a levélben lévő gombot.',
      ], { reszletek }),
    };
  }
  return { pi, i, reszletek, piId, t, elonezetUrl: szl.elonezet_url };
}

// A kartyara kerulo kod: a Salonicban letrehozott 100%-os kupon (kartyas fizetes) vagy az utalvany-ertekesites
// kodja (utalas) - a szalon irja be. Nincs formatum-kenyszer, csak biztonsagos karakterek.
const KOD_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/;
const kodTisztit = (v) => egysor(v).replace(/\s+/g, '');

// A Salonic utalvany-ertekesitesi urlapjanak linkje, az adatokkal a #mosaic= reszben (a hash a szerverre nem megy el). Az urlapot
// a "MOSAIC kitolto" konyvjelzo (L.SALONIC_KITOLTO_JS) tolti ki egy kattintassal. Az "Ajandekozo" = a vevo; az e-mail helyere a
// SZALON cime kerul: a Salonic az utalvanyt erre a cimre kuldi, igy a vevo csak a MOSAIC-kartyat kapja, a Salonic sajat levelet nem
// (a Salonic nem ad ezt kikapcsolni). A masolat-jelolo (sendCC) ures, az "Ajandekozott e-mail" nincs kitoltve; az uzenet nem kerul
// a Salonicba (a kartyara a MOSAIC irja). A nameTo a Salonicban max. 40 karakter.
const SALONIC_FIZETESI_MOD_ATUTALAS = '14';
function salonicKitoltoUrl(termek, md) {
  if (!termek || !termek.salonic) return '';
  const adat = {
    nameFrom: md.nev || '',
    emailFrom: ADAT.SZALON.email,
    phoneFrom: md.telefon || '',
    nameTo: Array.from(String(md.szemelyre_nev || '')).slice(0, 40).join('').trim(),
    paymentType: SALONIC_FIZETESI_MOD_ATUTALAS,
    sendCC: 0,
  };
  for (const kulcs of Object.keys(adat)) if (adat[kulcs] === '') delete adat[kulcs];
  return `${ADAT.SALONIC_BAZIS}/promotion/giftCard/sale/${termek.salonic.id}#mosaic=${encodeURIComponent(JSON.stringify(adat))}`;
}

// A kiallito oldal (GET, es hibas POST utan ujra): reszletek + kod mezo + gomb
async function kiallitUrlap(k, e, hiba) {
  const atu = e.i.atutalas;
  const termek = e.i.termek;
  const md = e.i.md;
  const salonicUrl = atu ? salonicKitoltoUrl(termek, md) : '';
  return oldal(k, hiba ? 400 : 200, atu ? 'Az utalás beérkezett – kiállítod a kártyát?' : 'Kiállítod az ajándékkártyát?', atu
    ? [
      'Előbb a Salonicban végezd el az utalvány-értékesítést, utána a kapott utalványkódot írd be lent.',
      'A gomb megnyomása után a vevő e-mailben megkapja a nyomtatható ajándékkártyát a kóddal.',
    ]
    : [
      'Előbb a Salonicban hozd létre a 100%-os kupont (a számla már kiment, ezért nem utalvány-értékesítés), utána írd be ide a kupon kódját.',
      'A gomb megnyomása után a vevő e-mailben megkapja a nyomtatható ajándékkártyát a kóddal.',
    ], {
    reszletek: e.reszletek,
    linkek: [
      ...(salonicUrl ? [{ url: salonicUrl, szoveg: `Salonic megnyitása az adatokkal (${termek.salonic.nev})` }] : []),
      ...(e.elonezetUrl ? [{ url: e.elonezetUrl, szoveg: 'A vevő személyre szabott kártyájának előnézete (design, fotó, idézet)' }] : []),
    ],
    kitolto: salonicUrl ? {
      cim: 'A Salonic-űrlap kitöltése egy kattintással',
      szoveg: 'A fenti linkkel megnyíló Salonic-oldalon kattints a böngésző könyvjelzősávjában a MOSAIC kitöltő gombra: beírja az Ajándékozó nevét és telefonszámát, a szalon e-mail címét (hogy a Salonic ne írjon a vevőnek), az Ajándékozott nevét, és a fizetési módot Átutalásra állítja. Semmit nem küld el: az Előnézetet és az értékesítést te indítod.',
      beallitas: 'Egyszeri beállítás: húzd ezt a gombot a könyvjelzősávba (ha nem látszik: Ctrl+Shift+B). Itt kattintani nem kell, csak húzni:',
      href: 'javascript:' + L.SALONIC_KITOLTO_JS,
      nev: 'MOSAIC kitöltő',
    } : null,
    masol: atu ? null : {
      cim: 'A Salonic-kuponhoz',
      sorok: [{ cimke: 'Javasolt kuponkód', ertek: e.i.javasolt_kod || '' }].filter((m) => m.ertek),
    },
    urlap: {
      action: k.u.pathname,
      rejtett: { pi: e.piId, t: e.t },
      mezok: [{
        nev: 'kod', max: 40, kotelezo: true, ertek: atu ? '' : (e.i.md.kod || e.i.javasolt_kod || ''),
        cimke: atu ? 'Utalványkód (a Salonic utalvány-értékesítésből)' : 'Kupon kódja (a Salonicban létrehozott 100%-os kupon)',
        megjegyzes: atu ? 'Például: GYOR1865. Ez a kód kerül a kártyára, és ezzel foglal majd a vendég.'
          : 'Alapból a javasolt kód áll itt; ha a Salonicban mást adtál meg, írd át arra.',
      }],
      hiba: hiba || '',
      gomb: atu ? 'Az utalás beérkezett – kiküldjük a kártyát' : 'A kupon kész – kiküldjük a kártyát',
    },
  });
}

// GET: csak megerosito oldal (allapotot nem modosit, levelet nem kuld)
async function kiallitMegerosites(k) {
  const e = await kiallitElokeszit(k, k.u.searchParams.get('pi'), k.u.searchParams.get('t'));
  if (e.valasz) return e.valasz;
  return kiallitUrlap(k, e, '');
}

// POST (urlap vagy JSON: pi, t, kod): a kiallitas
async function kiallit(k) {
  let d = null;
  if (k.text.length <= MAX_TORZS) {
    const tipus = String(k.h['content-type'] || '').toLowerCase();
    if (tipus.includes('application/json') || (!tipus && k.text.trim().startsWith('{'))) {
      try { d = JSON.parse(k.text); } catch { d = null; }
      if (!d || typeof d !== 'object' || Array.isArray(d)) d = null;
    } else {
      const p = new URLSearchParams(k.text);
      d = { pi: p.get('pi'), t: p.get('t'), kod: p.get('kod') };
    }
  }
  const e = await kiallitElokeszit(k, d && d.pi, d && d.t);
  if (e.valasz) return e.valasz;
  const { pi, reszletek } = e;
  const kod = kodTisztit(d && d.kod);
  if (!KOD_RE.test(kod)) {
    return kiallitUrlap(k, e, 'Add meg a kódot (3-40 karakter: betű, szám, kötőjel, pont vagy aláhúzás).');
  }
  const atu = e.i.atutalas;
  // 1) jelzo a level ELOTT: egy dupla kattintas / parhuzamos keres ne kuldjon masodik levelet
  //    (ha ez nem sikerul, Stripe-hiba -> 502, es level sem ment ki). Utalasnal ekkor all "fizetve" allapotba a rendeles.
  const elo = { kiallitas_folyamatban: k.most.toISOString(), kod };
  if (atu && !pi.metadata.atutalas_ekkor) {
    elo.atutalas_beerkezett = '1';
    elo.atutalas_ekkor = k.most.toISOString();
  } else if (atu) elo.atutalas_beerkezett = '1';
  const frissitett = await piFrissit(k.env, pi.id, { metadata: elo });
  const i = await rendelesInfo(k, frissitett);
  // 2) a vevo levele
  if (i.email) {
    try {
      await levelKuld(k, {
        cimzett: i.email,
        valasz: 'szalon',
        ...L.vevoKartyaKeszLevel({
          rendeles_id: i.rendeles_id, kartya_cim: i.kartya_cim, nev: i.md.nev, kartya_url: i.kartya_url,
          kod: i.kod, ervenyes_ig: i.ervenyes_ig, szalon: ADAT.SZALON,
        }),
      });
    } catch (hiba) {
      console.error('ajandek: kiallit - kuldesi hiba', pi.id, hiba && hiba.message);
      // nem ment ki level: a jelzo le, igy azonnal ujra lehet probalni
      await metaIrasCsendes(k, pi.id, { kiallitas_folyamatban: '' }, 'kiallitas_folyamatban torles');
      return oldal(k, 502, 'Nem sikerült elküldeni a levelet', ['A kártya még nincs kiállítva. Próbáld újra kicsit később: nyisd meg újra a levélben lévő gombot.'], { reszletek });
    }
  }
  // 3) rogzites (egy ujraprobalassal); ha nem sikerul, a level mar kiment: NEM kuldjuk ujra azonnal
  const vegso = { kartya_kesz: '1', kartya_kiallitva_ekkor: k.most.toISOString(), kiallitas_folyamatban: '' };
  const rogzitve = (await metaIrasCsendes(k, pi.id, vegso, 'kartya_kesz')) || (await metaIrasCsendes(k, pi.id, vegso, 'kartya_kesz, ujra'));
  if (!rogzitve) {
    return oldal(k, 502, 'A levél kiment, de a kiállítást nem sikerült rögzíteni', [
      'A vevő megkapta a levelet a kártyával, de a rendszer nem tudta elmenteni, hogy kiállítottad.',
      '15 perc múlva nyisd meg újra a levélben lévő gombot, és erősítsd meg újra (a vevő ekkor még egy levelet kap).',
    ], { reszletek });
  }
  return oldal(k, 200, 'Kiállítva, a vevő megkapta a levelet', [
    i.email ? `A nyomtatható ajándékkártya linkjét elküldtük ide: ${i.email}. A kártyán szereplő kód: ${i.kod}.` : 'A vevőnek nincs e-mail-címe – a kártyát a rendelés oldalán éri el.',
  ], { reszletek });
}

async function alairasJo(fejlec, torzs, titkok, most) {
  if (!fejlec || fejlec.length > 4000) return false;
  let t = null;
  const v1 = [];
  for (const resz of fejlec.split(',')) {
    const i = resz.indexOf('=');
    if (i < 0) continue;
    const kulcs = resz.slice(0, i).trim();
    const ertek = resz.slice(i + 1).trim();
    if (kulcs === 't') t = ertek;
    else if (kulcs === 'v1') v1.push(ertek.toLowerCase());
  }
  if (!t || !/^\d{1,12}$/.test(t) || !v1.length) return false;
  if (Math.abs(most.getTime() / 1000 - Number(t)) > TOLERANCIA_MP) return false;
  for (const titokResz of titkok) {
    const vart = hex(await hmac(enc.encode(titokResz), `${t}.${torzs}`));
    if (v1.some((s) => egyenlo(s, vart))) return true;
  }
  return false;
}

// payment_intent.succeeded: szalon- es vevo-level. Minden level UTAN azonnal rogzitjuk a
// reszallapotot (ertesites: 'szalon' / 'vevo' / '1'), hogy egy kesobbi hiba / idotullepes miatti
// Stripe-ujrakuldes ne kuldjon dupla levelet.
async function fizetesEsemeny(k, obj, ok) {
  if (!PI_RE.test(String(obj.id || '')) || !obj.metadata || obj.metadata.forras !== FORRAS) return ok;
  // a PI-t a Stripe-tol kerdezzuk vissza (nem az esemeny tartalmanak hiszunk)
  let pi;
  try {
    pi = await piLeker(k.env, obj.id);
  } catch (e) {
    if (e instanceof StripeHiba && e.status === 404) return ok;
    throw e;
  }
  const md = pi.metadata || {};
  if (md.forras !== FORRAS || pi.status !== 'succeeded' || md.ertesites === '1') return ok;

  const azonnali = k.env.AJANDEK_AZONNALI === '1';
  const i = await rendelesInfo(k, pi);
  // mar visszaterítettek / vitatjak: sikerlevel nem megy (a visszavonasrol kulon level szol)
  if (i.visszavonva) return ok;

  // elotte: a kod (es azonnali modban a kiallitas) rogzitese - ha ez nem sikerul, meg nem ment ki
  // semmi, a Stripe ujraprobalhatja (Stripe-hiba -> 502)
  const elo = {};
  if (md.kod !== i.kod) elo.kod = i.kod;
  if (azonnali && md.kartya_kesz !== '1') {
    elo.kartya_kesz = '1';
    elo.kartya_kiallitva_ekkor = k.most.toISOString();
  }
  if (Object.keys(elo).length) await piFrissit(k.env, pi.id, { metadata: elo });

  const kiallitUrl = `${k.bazis}/api/ajandek/kiallit?pi=${encodeURIComponent(pi.id)}&t=${await kiallitToken(k.env, pi.id)}`;
  const levelek = [
    ['szalon', {
      cimzett: 'szalon',
      valasz: i.email || undefined,
      ...L.szalonFizetveLevel({
        rendeles_id: i.rendeles_id, pi: pi.id, termek_nev: i.termek_nev, osszeg_szoveg: i.osszeg_szoveg,
        fizetesi_mod: i.fizetesi_mod, fizetve_ekkor: i.fizetve_ekkor, email: i.email, nev: md.nev,
        iranyitoszam: md.iranyitoszam, varos: md.varos, cim: md.cim, ceges_nev: md.ceges_nev, ceges_adoszam: md.ceges_adoszam,
        kod: i.kod, ervenyes_ig: i.ervenyes_ig, kiallit_url: kiallitUrl, azonnali, attr: md,
        megajandekozott: md.szemelyre_nev, szamla: szamlaInfo(md),
        ...(await szemelyreLeiras(k, i)),
      }),
    }],
    ['vevo', i.email ? {
      cimzett: i.email,
      valasz: 'szalon',
      ...L.vevoFizetveLevel({
        rendeles_id: i.rendeles_id, termek_nev: i.termek_nev, kartya_cim: i.kartya_cim, osszeg_szoveg: i.osszeg_szoveg,
        nev: md.nev, rendeles_url: i.rendeles_url, kartya_url: azonnali ? i.kartya_url : null,
        kod: azonnali ? i.kod : null, ervenyes_ig: i.ervenyes_ig, szalon: ADAT.SZALON,
      }),
    } : null],
  ];

  // ertesites: '' -> egyik sem ment ki, 'szalon' / 'vevo' -> csak az az egy, '1' -> mindketto
  const kesz = new Set(md.ertesites === 'szalon' || md.ertesites === 'vevo' ? [md.ertesites] : []);
  let hibas = false;
  for (const [nev, level] of levelek) {
    if (kesz.has(nev)) continue;
    if (level) {
      try {
        await levelKuld(k, level);
      } catch (e) {
        hibas = true;
        console.error(`ajandek: webhook - kuldesi hiba (${nev})`, pi.id, e && e.message);
        continue;
      }
    }
    kesz.add(nev);
    // azonnal rogzitjuk; ha nem sikerul, csak naplozunk (a level mar kiment, ne kuldjuk ujra)
    await metaIrasCsendes(k, pi.id, { ertesites: kesz.size === 2 ? '1' : nev }, 'ertesites');
  }
  // nem 2xx: a Stripe kesobb ujrakuldi, es csak a hianyzo level megy ki
  if (hibas) return json(500, { hiba: 'level' });
  return ok;
}

// charge.refunded / charge.dispute.created: a szalon torolje a kuponkodot (egyszer, idempotensen)
async function visszavonasEsemeny(k, tipus, obj, ok) {
  let piId = typeof obj.payment_intent === 'string' ? obj.payment_intent : (obj.payment_intent && obj.payment_intent.id) || '';
  if (!piId && typeof obj.charge === 'string' && CH_RE.test(obj.charge)) {
    // regebbi vita-objektum PI nelkul: a terhelesbol
    try {
      piId = (await stripe(k.env, 'GET', `/v1/charges/${obj.charge}`)).payment_intent || '';
    } catch (e) {
      if (e instanceof StripeHiba && e.status === 404) return ok;
      throw e;
    }
  }
  if (!PI_RE.test(String(piId))) return ok;
  let pi;
  try {
    pi = await piLeker(k.env, piId);
  } catch (e) {
    if (e instanceof StripeHiba && e.status === 404) return ok;
    throw e;
  }
  const md = pi.metadata || {};
  if (md.forras !== FORRAS || md.visszavonas_ertesites === '1') return ok;
  const i = await rendelesInfo(k, pi);
  // csak ha a Stripe-tol visszakerdezett terheles is visszaterítettnek / vitatottnak latszik
  if (!i.visszavonva) return ok;
  const oka = tipus === 'charge.dispute.created' ? 'vita' : i.visszavonas_oka || 'visszaterites';
  try {
    await levelKuld(k, {
      cimzett: 'szalon',
      valasz: i.email || undefined,
      ...L.szalonVisszavonasLevel({
        oka, rendeles_id: i.rendeles_id, pi: pi.id, termek_nev: i.termek_nev, osszeg_szoveg: i.osszeg_szoveg,
        visszaterites_szoveg: i.visszaterites_szoveg, email: i.email, nev: md.nev, kod: i.kod,
        kiallitva: md.kartya_kesz === '1', fizikai: md.szemelyre_atadas === 'fizikai',
      }),
    });
  } catch (e) {
    console.error('ajandek: webhook - kuldesi hiba (visszavonas)', pi.id, e && e.message);
    return json(500, { hiba: 'level' });
  }
  await metaIrasCsendes(k, pi.id, { visszavonas_ertesites: '1', visszavonva: oka }, 'visszavonas_ertesites');
  return ok;
}

async function webhook(k) {
  if (k.text.length > MAX_WEBHOOK) return json(413, { hiba: 'tul_nagy' });
  const titkok = String(k.env.STRIPE_WEBHOOK_SECRET || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!titkok.length || !beallitva(k.env)) return json(503, { hiba: 'nincs_beallitva' });
  if (!(await alairasJo(k.h['stripe-signature'], k.text, titkok, k.most))) return json(400, { hiba: 'alairas' });
  let esemeny;
  try { esemeny = JSON.parse(k.text); } catch { return json(400, { hiba: 'ervenytelen' }); }
  const ok = json(200, { ok: true });
  const obj = esemeny && esemeny.data && esemeny.data.object;
  if (!obj || typeof obj !== 'object') return ok;
  if (esemeny.type === 'payment_intent.succeeded') return fizetesEsemeny(k, obj, ok);
  if (esemeny.type === 'charge.refunded' || esemeny.type === 'charge.dispute.created') return visszavonasEsemeny(k, esemeny.type, obj, ok);
  return ok;
}

// Telefonszam: a Salonic utalvany-ertekesitesehez kell (kotelezo mezo ott). Csak szamok, +, szokoz, kotojel, zarojel, perjel.
function telefonTisztit(v) {
  const t = egysor(v);
  if (!/^\+?[0-9][0-9 ()\/.-]{5,24}$/.test(t)) return '';
  const szamjegy = t.replace(/\D/g, '').length;
  return szamjegy >= 8 && szamjegy <= 15 ? t : '';
}

async function atutalas(k) {
  const kapu = postKapu(k, 'atutalas');
  if (kapu) return kapu;
  const { d, valasz } = jsonTorzs(k);
  if (valasz) return valasz;
  if (egysor(d['bot-field'])) return json(200, { ok: true });
  const { mezok, r } = rendelesAdat(d);
  // a megajandekozott neve: a (regi, kifejezett) 'megajandekozott' mezo, majd a tervezo neve, majd az ajandekozott mezo
  const megajandekozott = egysor(d.megajandekozott) || (r.szemelyre && r.szemelyre.nev) || r.ajandekozott;
  if (megajandekozott.length > 80) mezok.megajandekozott = 'A név legfeljebb 80 karakter lehet.';
  const uzenet = tobbsor(d.uzenet);
  if (uzenet.length > 300) mezok.uzenet = 'Az üzenet legfeljebb 300 karakter lehet.';
  const telefon = telefonTisztit(d.telefon);
  if (!telefon) mezok.telefon = 'Add meg a telefonszámod (a Salonic-utalványhoz kell).';
  if (Object.keys(mezok).length) return json(400, { hiba: 'ervenytelen', mezok });
  // az igeny a Stripe-ban nyilvantartasi rekord (nem fizetheto); nelkule nincs mire hivatkozni a kiallitasnal
  if (stripeMod(k.env) === 'nincs') return json(503, { hiba: 'nincs_beallitva' });
  const fotoHiba = await fotoCsatolasEllenorzes(k, r);
  if (fotoHiba) return fotoHiba;

  const ar = arFt(r.termek);
  const ref = 'ATU-' + veletlenKod(6);
  // a kozlemeny CSAK a sajat azonositonk: a vevonek kuldott levelbe semmilyen, a kitolto altal
  // megadott szabad szoveg nem kerul (igy a vegpont nem hasznalhato mas cimre kuldott uzenetekre)
  const kozlemeny = ref;
  const osszegSzoveg = ADAT.arSzoveg(ar);
  const kozos = {
    rendeles_ref: ref, termek_nev: r.termek.nev, kartya_cim: r.termek.kartya_cim, osszeg_szoveg: osszegSzoveg, kozlemeny,
  };
  let pi;
  try {
    pi = await stripe(k.env, 'POST', '/v1/payment_intents', {
      amount: ar * 100, currency: 'huf', payment_method_types: ['card'], receipt_email: r.email,
      description: `MOSAIC ajándékkártya - ÁTUTALÁSOS IGÉNY (nincs kifizetve) - ${ref}`,
      metadata: metaTisztit({
        ...fizetesMeta(r), fizetesi_mod: 'atutalas', atu_ref: ref, telefon,
        szemelyre_nev: megajandekozott, szemelyre_uzenet: uzenet,
      }),
    }, 'ah-atu-' + ref);
  } catch (e) {
    console.error('ajandek: atutalas - Stripe-hiba', ref, e && e.message);
    return json(502, { hiba: 'stripe' });
  }
  const kiallitUrl = `${k.bazis}/api/ajandek/kiallit?pi=${encodeURIComponent(pi.id)}&t=${await kiallitToken(k.env, pi.id)}`;
  const salonic = r.termek.salonic || null;
  // a szalon levele nelkul az igeny elveszne: ha az nem megy ki, hibat adunk
  try {
    await levelKuld(k, {
      cimzett: 'szalon',
      valasz: r.email,
      ...L.szalonAtutalasLevel({
        ...kozos, email: r.email, nev: r.nev, telefon, iranyitoszam: r.iranyitoszam, varos: r.varos, cim: r.cim,
        ceges_nev: r.ceges_nev, ceges_adoszam: r.ceges_adoszam, megajandekozott, uzenet, oldal: r.attr.oldal,
        kiallit_url: kiallitUrl, salonic_url: salonicKitoltoUrl(r.termek, { nev: r.nev, telefon, szemelyre_nev: megajandekozott }), salonic_nev: salonic ? salonic.nev : '', szalon_email: ADAT.SZALON.email,
        atvetel_szoveg: r.atvetel === 'szemelyesen' ? 'Személyesen, a szalonban (papír kártya, díszborítékban)' : r.atvetel === 'otthon' ? 'E-mailben, otthon kinyomtatja' : '',
        design_szoveg: r.szemelyre ? (KARTYA.tema(r.szemelyre.tema) || {}).nev || '' : '', idezet_szoveg: r.szemelyre ? r.szemelyre.idezet : '',
        foto_van: Boolean(r.szemelyre && r.szemelyre.foto_id),
        foto_url: r.szemelyre && r.szemelyre.foto_id ? `${k.bazis}/api/ajandek/foto?id=${r.szemelyre.foto_id}&t=${await fotoToken(k.env, r.szemelyre.foto_id)}` : '',
        elonezet_url: r.szemelyre ? `${k.bazis}/api/ajandek/elonezet?pi=${encodeURIComponent(pi.id)}&t=${await kiallitToken(k.env, pi.id)}` : '',
      }),
    });
  } catch (e) {
    console.error('ajandek: atutalas - kuldesi hiba (szalon)', ref, e && e.message);
    return json(502, { hiba: 'level' });
  }
  try {
    await levelKuld(k, {
      cimzett: r.email,
      valasz: 'szalon',
      ...L.vevoAtutalasLevel({ ...kozos, kedvezmenyezett: ADAT.BANK.kedvezmenyezett, szamlaszam: ADAT.BANK.szamlaszam, szalon: ADAT.SZALON }),
    });
  } catch (e) {
    // az utalasi adatokat a valasz is tartalmazza (a kepernyon latszik)
    console.error('ajandek: atutalas - kuldesi hiba (vevo)', ref, e && e.message);
  }
  return json(200, {
    ok: true,
    osszeg: ar,
    rendeles_ref: ref,
    utalas: { kedvezmenyezett: ADAT.BANK.kedvezmenyezett, szamlaszam: ADAT.BANK.szamlaszam, osszeg_ft: ar, kozlemeny },
  });
}

// --- a szemelyre szabott kartya fotoja (Cloudflare KV) -----------------------------------------------------
// A kepet a bongeszo mar <= 1600 px-es JPEG-re kicsinyiti; itt csak ellenorizzuk (JPEG, <= 700 KB) es taroljuk
// a KV-ban ('foto:<id>', 3 napig). A rendeleshez kotes (a /fizetes vagy az /atutalas, amely az id-t megkapja) ujra
// beirja hosszu (400 napos) ervenyessegre. A kepet az id + HMAC-token mutatja meg (a kartya-oldal / elonezet linkjeben).
const fotoTar = (env) => (env && env.AJANDEK_FOTOK && typeof env.AJANDEK_FOTOK.get === 'function' && typeof env.AJANDEK_FOTOK.put === 'function' ? env.AJANDEK_FOTOK : null);

export async function fotoToken(env, id) {
  return hex(await hmac(await titok(env), 'foto:' + id));
}

async function fotoFeltoltes(k) {
  const kapu = postKapu(k, 'foto');
  if (kapu) return kapu;
  if (!beallitva(k.env)) return json(503, { hiba: 'nincs_beallitva' });
  const tar = fotoTar(k.env);
  if (!tar) return json(503, { hiba: 'foto_nincs_beallitva' });
  const { d, valasz } = jsonTorzs(k, MAX_FOTO_TORZS);
  if (valasz) return valasz;
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(d.kep || ''));
  if (!m) return json(400, { hiba: 'ervenytelen', mezok: { kep: 'A fotó JPEG formátumú legyen.' } });
  let bajtok;
  try {
    const bin = atob(m[1]);
    bajtok = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bajtok[i] = bin.charCodeAt(i);
  } catch {
    return json(400, { hiba: 'ervenytelen', mezok: { kep: 'A fotó nem olvasható.' } });
  }
  if (bajtok.length > FOTO_MAX_BAJT) return json(413, { hiba: 'tul_nagy' });
  // JPEG: FF D8 FF eleje, FF D9 vege
  if (bajtok.length < 1024 || bajtok[0] !== 0xff || bajtok[1] !== 0xd8 || bajtok[2] !== 0xff) {
    return json(400, { hiba: 'ervenytelen', mezok: { kep: 'A fotó nem érvényes JPEG.' } });
  }
  const id = veletlenKod(24);
  await tar.put('foto:' + id, bajtok, { expirationTtl: FOTO_TTL_FELTOLTES });
  return json(200, { ok: true, id });
}

async function fotoLetoltes(k) {
  if (!beallitva(k.env)) return json(503, { hiba: 'nincs_beallitva' });
  const id = String(k.u.searchParams.get('id') || '');
  const t = String(k.u.searchParams.get('t') || '').trim().toLowerCase();
  if (!FOTO_ID_RE.test(id) || !TOKEN_RE.test(t) || !egyenlo(t, await fotoToken(k.env, id))) return json(403, { hiba: 'tiltott' });
  const tar = fotoTar(k.env);
  if (!tar) return json(404, { hiba: 'nincs' });
  const ertek = await tar.get('foto:' + id, { type: 'arrayBuffer' });
  if (!ertek) return json(404, { hiba: 'nincs' });
  return {
    status: 200,
    headers: { ...ALAP_FEJLEC, 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000, immutable', 'content-disposition': 'inline' },
    body: new Uint8Array(ertek),
  };
}

// A /fizetes es az /atutalas: ha a kerelem foto-azonositot hoz, a kep legyen meg a tarolban; ervenyes azonositonal
// a rendeleshez kotjuk (hosszu ervenyesseg). -> null (rendben) | kesz hibavalasz
async function fotoCsatolasEllenorzes(k, r) {
  const id = r.szemelyre && r.szemelyre.foto_id;
  if (!id) return null;
  const tar = fotoTar(k.env);
  if (!tar) return json(503, { hiba: 'foto_nincs_beallitva' });
  const ertek = await tar.get('foto:' + id, { type: 'arrayBuffer' });
  if (!ertek) return json(400, { hiba: 'ervenytelen', mezok: { foto: 'A fotó feltöltése lejárt vagy hiányzik: töltsd fel újra a személyre szabásnál.' } });
  await tar.put('foto:' + id, ertek, { expirationTtl: FOTO_TTL_VEGLEGES });
  return null;
}

// A szemelyre szabott kartya oldala (a vevo kartyaja es a szalon elonezete). elonezet: a kod / ervenyesseg meg nem vegleges.
async function szemelyreSzabottOldal(k, i, opciok = {}) {
  const fotoSrc = i.foto_id ? `${k.bazis}/api/ajandek/foto?id=${i.foto_id}&t=${await fotoToken(k.env, i.foto_id)}` : null;
  return html(k, 200, L.szemelyreSzabottKartyaOldal({
    bazis: k.bazis, tema: i.tema, idezet: i.idezet, nev: i.md.szemelyre_nev || '', foto_src: fotoSrc, foto_poz: i.md.foto_poz || '',
    kartya_felirat: i.termek ? i.termek.kartya_felirat : null, ar_szoveg: i.osszeg_szoveg,
    kod: opciok.kod || i.kod || '', ervenyes_ig: i.ervenyes_ig, ervenyes_szoveg: opciok.ervenyes_szoveg || '', elonezet: Boolean(opciok.elonezet),
  }));
}

// A szalon levelei / kiallito oldala: hogyan veszi at, mit valasztott (a design, az idezet es a foto megtekintheto)
async function szemelyreLeiras(k, i) {
  const atvetel = i.atvetel === 'szemelyesen' ? 'Személyesen, a szalonban (papír kártya, díszborítékban)' : i.atvetel === 'otthon' ? 'E-mailben, otthon kinyomtatja' : '';
  const szemelyre = i.atvetel === 'otthon' && i.tema;
  return {
    atvetel_szoveg: atvetel,
    design_szoveg: szemelyre ? (KARTYA.tema(i.tema) || {}).nev || i.tema : '',
    idezet_szoveg: szemelyre ? i.idezet : '',
    foto_van: Boolean(szemelyre && i.foto_id),
    foto_url: szemelyre && i.foto_id ? `${k.bazis}/api/ajandek/foto?id=${i.foto_id}&t=${await fotoToken(k.env, i.foto_id)}` : '',
    elonezet_url: szemelyre ? `${k.bazis}/api/ajandek/elonezet?pi=${encodeURIComponent(i.pi.id)}&t=${await kiallitToken(k.env, i.pi.id)}` : '',
  };
}

// GET elonezet: a szalon (kiallit-tokennel) megnezi a vevo szemelyre szabott kartyajat, a kiallitas elott is
async function kartyaElonezet(k) {
  k.htmlValasz = true;
  const h = await tokenesPi(k, k.u.searchParams.get('pi'), k.u.searchParams.get('t'), kiallitToken);
  if (h.hiba === 'nincs_beallitva') return nincsBeallitvaOldal(k);
  if (h.hiba === 'tiltott') return oldal(k, 403, 'Érvénytelen link', ['Ez az előnézeti link nem érvényes. A rendelésről szóló levélben lévő linket használd.']);
  if (h.hiba) return oldal(k, h.status, 'A rendelés nem található', []);
  const i = await rendelesInfo(k, h.pi);
  if (i.atvetel !== 'otthon' || !i.tema) return oldal(k, 404, 'Ehhez a rendeléshez nincs személyre szabott kártya', ['A vevő a MOSAIC alap kártyáját kapja.']);
  const kod = i.kod || (i.atutalas ? 'A KÓD KIÁLLÍTÁSKOR KERÜL RÁ' : i.javasolt_kod);
  return szemelyreSzabottOldal(k, i, { kod, elonezet: true, ervenyes_szoveg: i.ervenyes_ig ? '' : 'a kiállítástól számított 6 hónapig' });
}

const UTAK = new Map([
  ['beallitas', { GET: beallitas }],
  ['fizetes', { POST: fizetes }],
  ['rendeles', { GET: rendeles }],
  ['szemelyre', { POST: szemelyre }],
  ['kartya', { GET: kartya }],
  ['kiallit', { GET: kiallitMegerosites, POST: kiallit }],
  ['webhook', { POST: webhook }],
  ['atutalas', { POST: atutalas }],
  ['foto', { POST: fotoFeltoltes, GET: fotoLetoltes }],
  ['elonezet', { GET: kartyaElonezet }],
]);

function fejlecek(h) {
  const ki = {};
  if (!h) return ki;
  if (typeof h.forEach === 'function' && typeof h.get === 'function') {
    h.forEach((v, kulcs) => { ki[String(kulcs).toLowerCase()] = String(v); });
    return ki;
  }
  for (const [kulcs, v] of Object.entries(h)) ki[kulcs.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
  return ki;
}

function bazisUrl(env, u) {
  const b = String(env.AJANDEK_BAZIS_URL || '').trim().replace(/\/+$/, '');
  try {
    if (b && /^https?:$/.test(new URL(b).protocol)) return b;
  } catch { /* ervenytelen: a keres origin-je */ }
  return u.origin;
}

export async function ajandekKezel({ method, url, headers, text, env, kuld, most, ip } = {}) {
  let u;
  try { u = new URL(url); } catch { return json(400, { hiba: 'ervenytelen' }); }
  const h = fejlecek(headers);
  const k = {
    method: String(method || 'GET').toUpperCase(),
    u,
    h,
    ip: kliensIp(h, ip),
    text: typeof text === 'string' ? text : '',
    env: env || {},
    kuld,
    most: most instanceof Date && !Number.isNaN(most.getTime()) ? most : new Date(),
    htmlValasz: false,
  };
  k.bazis = bazisUrl(k.env, u);
  if (!u.pathname.startsWith(ELOTAG)) return json(404, { hiba: 'nincs' });
  const ut = u.pathname.slice(ELOTAG.length).replace(/\/+$/, '');
  const vegpont = UTAK.get(ut);
  if (!vegpont) return json(404, { hiba: 'nincs' });
  const fv = sajat(vegpont, k.method) ? vegpont[k.method] : null;
  if (!fv) return json(405, { hiba: 'metodus' }, { allow: Object.keys(vegpont).join(', ') });
  try {
    return await fv(k);
  } catch (e) {
    // a reszletek csak a naplóba kerulnek (titok es stack trace nelkul), a valaszba nem
    const stripeHiba = e instanceof StripeHiba;
    console.error(`ajandek: ${ut} - ${stripeHiba ? 'Stripe-hiba' : 'belso hiba'}:`, e && e.message);
    if (k.htmlValasz) {
      try {
        return await oldal(k, 502, 'Átmeneti hiba', ['Most nem sikerült betölteni. Kérlek, próbáld újra pár perc múlva.']);
      } catch { /* lent: JSON */ }
    }
    return stripeHiba ? json(502, { hiba: 'stripe' }) : json(500, { hiba: 'belso' });
  }
}
