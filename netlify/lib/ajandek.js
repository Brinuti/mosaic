// MOSAIC Gift Commerce Engine - szerveroldali kezelo (az /api/ajandek/* vegpontok).
//
// Kozos a Netlify- (netlify/functions/ajandek.mjs) es a Cloudflare Pages-fuggvenynek
// (functions/api/ajandek/[[kind]].js): tiszta, platformfuggetlen kod, csak Web-szabvanyos
// API-kkal (fetch, crypto.subtle, TextEncoder, URL) - Node 20 alatt es Workersben is fut.
//
//   ajandekKezel({ method, url, headers, text, env, kuld, most }) -> { status, headers, body }
//
// Vegpontok (a frontenddel egyeztetett szerzodes):
//   GET  beallitas   Stripe-mod, publikus kulcs, azonnali kartya
//   POST fizetes     PaymentIntent letrehozasa / frissitese (termekvaltas); az ar MINDIG a
//                    szerveren, az assets/js/ajandek-adat.js-bol (a kliens osszege nem szamit)
//   GET  rendeles    a rendeles allapota (Stripe-tol visszakerdezve; hitelesites: client_secret)
//   POST szemelyre   megajandekozott neve, uzenet, alkalom, atadas (csak fizetes utan)
//   GET  kartya      a nyomtathato ajandekkartya (ha fizetve es a szalon kiallitotta); hitelesites:
//                    pi + t (kartyaToken, tovabbithato link) vagy - visszafele kompatibilisen - pi + cs
//   GET  kiallit     a szalon "kiallitottam" linkje (HMAC-token): CSAK megerosito oldal
//   POST kiallit     a megerosito oldal urlapja (pi, t): kartya_kesz=1 + vevo-level a kartyaval
//   POST webhook     Stripe payment_intent.succeeded -> szalon- es vevo-level (idempotens)
//   POST atutalas    atutalasos igeny (NEM vasarlas): utalasi adatok levelben
//
// Kornyezeti valtozok:
//   STRIPE_SECRET_KEY        sk_live_... / sk_test_... (vagy korlatozott rk_...)
//   STRIPE_PUBLISHABLE_KEY   pk_live_... / pk_test_...
//   STRIPE_WEBHOOK_SECRET    whsec_... (tobb is lehet vesszovel elvalasztva, kulcscserekor)
//   AJANDEK_TITOK            a kuponkod es a kiallito link HMAC-kulcsa. ERDEMES BEALLITANI: ha
//                            nincs, a STRIPE_SECRET_KEY SHA-256-jabol szamoljuk, es kulcscsere
//                            utan a meg ki nem allitott rendelesek kiallito linkje ervenytelen lesz
//                            (a mar ertesitett rendelesek kodja a PI metadataban is megvan: kod).
//   AJANDEK_BAZIS_URL        a levelekben es a kartyan levo linkek eleje (alapbol a keres origin-je)
//   AJANDEK_AZONNALI         '1' = a webhook rogton kiallitja a kartyat (kulonben a szalon linkje)
//   STRIPE_API_BASE          csak tesztekhez (mock Stripe), alapbol https://api.stripe.com
//   STRIPE_API_VERSION       alapbol STRIPE_VERZIO
import '../../assets/js/ajandek-adat.js';
import * as L from './ajandek-levelek.js';

const ADAT = globalThis.AJANDEK_ADAT;

const ELOTAG = '/api/ajandek/';
const FORRAS = 'ajandek-motor';
const STRIPE_ALAP = 'https://api.stripe.com';
// rogzitett API-verzio: a latest_charge mezo es a valaszok formaja ne a fiok alapbeallitasan muljon
const STRIPE_VERZIO = '2024-06-20';
const STRIPE_IDOKORLAT_MS = 15000;
const MAX_TORZS = 32 * 1024;
const MAX_WEBHOOK = 512 * 1024;
const TOLERANCIA_MP = 300;
const PI_RE = /^pi_[A-Za-z0-9]{8,80}$/;
const KULCS_RE = /^[A-Za-z0-9_-]{8,100}$/;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"'.]+(\.[^\s@<>()[\]\\,;:"'.]+)*\.[^\s@<>()[\]\\,;:"'.]{2,}$/;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const ATTR_KULCSOK = ['variant_id', 'gift_context', 'relationship', 'occasion', 'utm_source', 'utm_medium',
  'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ttclid'];
// a /fizetes altal irt metadata-kulcsok (termekvaltaskor ezeket mind ujrairjuk / toroljuk)
const FIZETES_META = ['forras', 'termek', 'product_type', ...ATTR_KULCSOK, 'oldal', 'nev', 'iranyitoszam',
  'varos', 'cim', 'ceges_nev', 'ceges_adoszam', 'kartya_cim'];

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

let nyomtatHash = null;
// urlapKuldes: csak a kiallitas megerosito oldala kuldhet urlapot (form-action 'self'), minden mas 'none'
async function html(k, status, tartalom, { urlapKuldes = false } = {}) {
  if (!nyomtatHash) nyomtatHash = 'sha256-' + base64(await sha256(enc.encode(L.NYOMTAT_JS)));
  let kepForras = "'self'";
  try { kepForras += ' ' + new URL(k.bazis).origin; } catch { /* marad a 'self' */ }
  return {
    status,
    headers: {
      ...ALAP_FEJLEC,
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': `default-src 'none'; img-src ${kepForras}; style-src 'unsafe-inline'; script-src '${nyomtatHash}'; base-uri 'none'; form-action ${urlapKuldes ? "'self'" : "'none'"}; frame-ancestors 'none'`,
    },
    body: tartalom,
  };
}

const oldal = (k, status, cim, bekezdesek, extra = {}) => html(k, status, L.egyszeruOldal({ cim, bekezdesek, bazis: k.bazis, ...extra }), { urlapKuldes: Boolean(extra.urlap) });

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

async function titok(env) {
  const t = String(env.AJANDEK_TITOK || '').trim();
  if (t) return enc.encode(t);
  const sk = titkosKulcs(env);
  if (!sk) throw new Error('nincs titok (AJANDEK_TITOK / STRIPE_SECRET_KEY)');
  return sha256(enc.encode(sk));
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
  if (!sk || !pk) return 'nincs';
  const teszt = /^(sk|rk)_test_/.test(sk);
  // teszt titkos kulcs eles publikus kulccsal (vagy forditva): a fizetes ugysem mukodne
  if (teszt ? /^pk_live_/.test(pk) : /^pk_test_/.test(pk)) return 'nincs';
  return teszt ? 'teszt' : 'elo';
}

// --- bemenet ---------------------------------------------------------------------------------------------
const VEZERLO = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
// egysoros szoveg: vezerlokarakterek ki, szokozok osszevonva, trimmelve
function egysor(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  return String(v).normalize('NFC').replace(VEZERLO, ' ').replace(/\s+/g, ' ').trim();
}
// tobbsoros szoveg (uzenet): a sortores marad, minden mas vezerlokarakter ki
function tobbsor(v) {
  if (typeof v !== 'string') return '';
  return v.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u2028\u2029]/g, '')
    .replace(/[ ]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function jsonTorzs(k) {
  if (k.text.length > MAX_TORZS) return { valasz: json(413, { hiba: 'tul_nagy' }) };
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
    occasion: azon(a.occasion) || v.occasion || '',
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
  return {
    mezok: m,
    r: { termek, email, nev, iranyitoszam, varos, cim, ceges_nev: cegesNev, ceges_adoszam: cegesAdoszam, attr: attrAdat(d.attr) },
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
  });
}

// --- a rendeles allapota -----------------------------------------------------------------------------------
function piAllapot(pi) {
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

// Minden, ami a PI-bol kovetkezik (valasz, levelek, kartya)
async function rendelesInfo(k, pi) {
  const md = pi.metadata || {};
  const termek = sajat(ADAT.TERMEKEK, md.termek) ? ADAT.TERMEKEK[md.termek] : null;
  const ch = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  const allapot = piAllapot(pi);
  const fizetve = allapot === 'fizetve';
  const fizetveMp = fizetve ? Number((ch && ch.created) || pi.created) || null : null;
  const fizetveEkkor = fizetveMp ? new Date(fizetveMp * 1000).toISOString() : null;
  const cs = String(pi.client_secret || '');
  return {
    pi, md, termek, allapot, fizetve,
    kesz: fizetve && md.kartya_kesz === '1',
    fizetve_ekkor: fizetveEkkor,
    ervenyes_ig: fizetveEkkor ? ADAT.ervenyesIg(budapestiNap(fizetveEkkor)) : null,
    rendeles_id: ADAT.rendelesAzonosito(pi.id),
    termek_nev: termek ? termek.nev : (md.termek || ''),
    kartya_cim: md.kartya_cim || (termek ? termek.kartya_cim : ''),
    osszeg: Math.round(Number(pi.amount) / 100),
    osszeg_szoveg: ADAT.arSzoveg(Number(pi.amount) / 100),
    penznem: String(pi.currency || 'huf').toUpperCase(),
    email: pi.receipt_email || '',
    fizetesi_mod: fizetesiMod(ch),
    // a webhook a metadataba is beirja (kulcscsere utan is ugyanaz maradjon)
    kod: fizetve ? (md.kod || await kuponKod(k.env, pi.id)) : null,
    // tovabbithato link (az ajandekozottnak is): kulon token, client_secret NELKUL
    kartya_url: fizetve ? `${k.bazis}/api/ajandek/kartya?pi=${encodeURIComponent(pi.id)}&t=${await kartyaToken(k.env, pi.id)}` : null,
    rendeles_url: `${k.bazis}/ajandek?payment_intent=${encodeURIComponent(pi.id)}&payment_intent_client_secret=${encodeURIComponent(cs)}&redirect_status=succeeded`,
  };
}

function rendelesValasz(i) {
  const attr = {};
  for (const kulcs of ATTR_KULCSOK) attr[kulcs] = i.md[kulcs] || null;
  const kartya = { allapot: i.kesz ? 'kesz' : 'keszul', ervenyes_ig: i.ervenyes_ig };
  if (i.kesz) {
    kartya.url = i.kartya_url;
    kartya.kod = i.kod;
  }
  const sz = {
    nev: i.md.szemelyre_nev || null, uzenet: i.md.szemelyre_uzenet || null,
    alkalom: i.md.szemelyre_alkalom || null, atadas: i.md.szemelyre_atadas || null,
  };
  return {
    allapot: i.allapot,
    rendeles_id: i.rendeles_id,
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

// A client_secret az egyetlen hitelesito. -> { pi } | { status, hiba }
async function hitelesPi(k, piId, cs) {
  piId = String(piId ?? '').trim();
  cs = String(cs ?? '').trim();
  if (!PI_RE.test(piId) || !cs || cs.length > 200 || !cs.startsWith(piId + '_secret_')) return { status: 403, hiba: 'tiltott' };
  if (!titkosKulcs(k.env)) return { status: 503, hiba: 'nincs_beallitva' };
  let pi;
  try {
    pi = await piLeker(k.env, piId);
  } catch (e) {
    if (e instanceof StripeHiba && e.status === 404) return { status: 403, hiba: 'tiltott' };
    throw e;
  }
  if (!egyenlo(cs, pi.client_secret)) return { status: 403, hiba: 'tiltott' };
  if (!pi.metadata || pi.metadata.forras !== FORRAS) return { status: 404, hiba: 'nincs' };
  return { pi };
}

async function levelKuld(k, level) {
  if (typeof k.kuld !== 'function') throw new Error('nincs levelkuldo');
  await k.kuld(level);
}

// --- vegpontok ---------------------------------------------------------------------------------------------
async function beallitas(k) {
  const mod = stripeMod(k.env);
  return json(200, { mod, publikus_kulcs: mod === 'nincs' ? null : publikusKulcs(k.env), azonnali_kartya: k.env.AJANDEK_AZONNALI === '1' });
}

async function fizetes(k) {
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

  const ar = arFt(r.termek);
  const meta = fizetesMeta(r);
  const leiras = `MOSAIC Head Spa ajándékkártya - ${r.termek.nev}`;
  const piId = egysor(d.pi);
  const cs = egysor(d.cs);
  let pi = null;

  // termekvaltas / adatjavitas: ugyanaz a PI, ha meg fizetes elott all
  if (piId && cs && PI_RE.test(piId) && cs.startsWith(piId + '_secret_')) {
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
      amount: ar * 100, currency: 'huf', automatic_payment_methods: { enabled: true },
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
  });
}

async function rendeles(k) {
  const h = await hitelesPi(k, k.u.searchParams.get('pi'), k.u.searchParams.get('cs'));
  if (h.hiba) return json(h.status, { hiba: h.hiba });
  return json(200, rendelesValasz(await rendelesInfo(k, h.pi)));
}

async function szemelyre(k) {
  const { d, valasz } = jsonTorzs(k);
  if (valasz) return valasz;
  const h = await hitelesPi(k, d.pi, d.cs);
  if (h.hiba) return json(h.status, { hiba: h.hiba });
  const elozo = h.pi.metadata;
  if (piAllapot(h.pi) !== 'fizetve') return json(409, { hiba: 'nincs_fizetve' });

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
      if (elozo.fizikai_ertesitve !== '1') pi = await piFrissit(k.env, pi.id, { metadata: { fizikai_ertesitve: '1' } });
    } catch (e) {
      if (e instanceof StripeHiba) throw e;
      // a szemelyre szabas mentve; a jelzo nem allt be, a kovetkezo mentes ujra probalja
      console.error('ajandek: szemelyre - kuldesi hiba', pi.id, e && e.message);
    }
  }
  return json(200, rendelesValasz(await rendelesInfo(k, pi)));
}

// A kartya-oldal ket hitelesitese: pi + t (kartyaToken; ezt adjuk ki linkkent) vagy - visszafele
// kompatibilisen - pi + cs (client_secret). -> { pi } | { status, hiba }
async function kartyaHitelesites(k) {
  const t = String(k.u.searchParams.get('t') || '').trim().toLowerCase();
  if (!t) return hitelesPi(k, k.u.searchParams.get('pi'), k.u.searchParams.get('cs'));
  const piId = String(k.u.searchParams.get('pi') || '').trim();
  if (!titkosKulcs(k.env)) return { status: 503, hiba: 'nincs_beallitva' };
  if (!PI_RE.test(piId) || !/^[0-9a-f]{64}$/.test(t) || !egyenlo(t, await kartyaToken(k.env, piId))) return { status: 403, hiba: 'tiltott' };
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

async function kartya(k) {
  k.htmlValasz = true;
  const h = await kartyaHitelesites(k);
  if (h.hiba === 'tiltott') return oldal(k, 403, 'A link nem érvényes', ['Ellenőrizd, hogy a teljes linket nyitottad-e meg a levélből. Ha nem sikerül, írj nekünk: ' + ADAT.SZALON.email]);
  if (h.hiba) return oldal(k, h.status, 'Ez az ajándékkártya nem található', ['Ha kérdésed van, írj nekünk: ' + ADAT.SZALON.email]);
  const i = await rendelesInfo(k, h.pi);
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
  return html(k, 200, L.kartyaOldal({
    bazis: k.bazis, kod: i.kod, kartya_cim: i.kartya_cim, tartalom: i.termek ? i.termek.tartalom : [],
    nev: i.md.szemelyre_nev || '', uzenet: i.md.szemelyre_uzenet || '', alkalom_cim: alkalomCim(i.md.szemelyre_alkalom),
    ervenyes_ig: i.ervenyes_ig, szalon: ADAT.SZALON,
  }));
}

// A szalon kiallito linkje ket lepesben mukodik: a GET (a levelben levo link) csak ellenoriz es
// megerosito oldalt ad - igy egy levelszkenner / linkelonezet automatikus GET-je nem allit ki
// semmit -, a kiallitast az oldal urlapjanak POST-ja vegzi. Mindket lepes HMAC-tokenhez kotott.
// -> { valasz } (kesz HTML-valasz) | { pi, i, reszletek }
async function kiallitElokeszit(k, piNyers, tNyers) {
  k.htmlValasz = true;
  const piId = String(piNyers ?? '').trim();
  const t = String(tNyers ?? '').trim().toLowerCase();
  if (!titkosKulcs(k.env)) return { valasz: await oldal(k, 503, 'A rendszer nincs beállítva', ['A Stripe-kulcs hiányzik.']) };
  if (!PI_RE.test(piId) || !/^[0-9a-f]{64}$/.test(t) || !egyenlo(t, await kiallitToken(k.env, piId))) {
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
  const reszletek = [['Rendelés', i.rendeles_id], ['Termék', i.termek_nev], ['Kuponkód', i.kod],
    ['Érvényes', i.ervenyes_ig ? L.datumIg(i.ervenyes_ig) : ''], ['Vevő', i.email]];
  if (!i.fizetve) {
    return { valasz: await oldal(k, 409, 'A rendelés még nincs kifizetve', ['A kártyát csak sikeres fizetés után lehet kiállítani.'], { reszletek }) };
  }
  if (i.md.kartya_kesz === '1') {
    return { valasz: await oldal(k, 200, 'Ez az ajándékkártya már ki van állítva', ['A vevő korábban megkapta a levelet a kártyával; újat nem küldtünk.'], { reszletek }) };
  }
  return { pi, i, reszletek, piId, t };
}

// GET: csak megerosito oldal (allapotot nem modosit, levelet nem kuld)
async function kiallitMegerosites(k) {
  const e = await kiallitElokeszit(k, k.u.searchParams.get('pi'), k.u.searchParams.get('t'));
  if (e.valasz) return e.valasz;
  return oldal(k, 200, 'Kiállítod az ajándékkártyát?', [
    'Csak akkor küldd ki, ha a kuponkódot már létrehoztad a Salonicban (100% kedvezmény, egyszer felhasználható, 6 hónapig érvényes).',
    'A gomb megnyomása után a vevő e-mailben megkapja a nyomtatható ajándékkártyát a kóddal.',
  ], {
    reszletek: e.reszletek,
    urlap: { action: k.u.pathname, rejtett: { pi: e.piId, t: e.t }, gomb: 'Igen, a kuponkódot létrehoztam a Salonicban – kiküldjük a kártyát' },
  });
}

// POST (urlap vagy JSON: pi, t): a kiallitas
async function kiallit(k) {
  let d = null;
  if (k.text.length <= MAX_TORZS) {
    const tipus = String(k.h['content-type'] || '').toLowerCase();
    if (tipus.includes('application/json') || (!tipus && k.text.trim().startsWith('{'))) {
      try { d = JSON.parse(k.text); } catch { d = null; }
      if (!d || typeof d !== 'object' || Array.isArray(d)) d = null;
    } else {
      const p = new URLSearchParams(k.text);
      d = { pi: p.get('pi'), t: p.get('t') };
    }
  }
  const e = await kiallitElokeszit(k, d && d.pi, d && d.t);
  if (e.valasz) return e.valasz;
  const { pi, i, reszletek } = e;
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
    } catch (e) {
      console.error('ajandek: kiallit - kuldesi hiba', pi.id, e && e.message);
      return oldal(k, 502, 'Nem sikerült elküldeni a levelet', ['A kártya még nincs kiállítva. Próbáld újra kicsit később: nyisd meg újra a levélben lévő gombot.'], { reszletek });
    }
  }
  await piFrissit(k.env, pi.id, { metadata: { kartya_kesz: '1', kartya_kiallitva_ekkor: k.most.toISOString(), kod: i.kod } });
  return oldal(k, 200, 'Kiállítva, a vevő megkapta a levelet', [
    i.email ? `A nyomtatható ajándékkártya linkjét elküldtük ide: ${i.email}.` : 'A vevőnek nincs e-mail-címe – a kártyát a rendelés oldalán éri el.',
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
  for (const titokSzoveg of titkok) {
    const vart = hex(await hmac(enc.encode(titokSzoveg), `${t}.${torzs}`));
    if (v1.some((s) => egyenlo(s, vart))) return true;
  }
  return false;
}

async function webhook(k) {
  if (k.text.length > MAX_WEBHOOK) return json(413, { hiba: 'tul_nagy' });
  const titkok = String(k.env.STRIPE_WEBHOOK_SECRET || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!titkok.length || !titkosKulcs(k.env)) return json(503, { hiba: 'nincs_beallitva' });
  if (!(await alairasJo(k.h['stripe-signature'], k.text, titkok, k.most))) return json(400, { hiba: 'alairas' });
  let esemeny;
  try { esemeny = JSON.parse(k.text); } catch { return json(400, { hiba: 'ervenytelen' }); }
  const ok = json(200, { ok: true });
  if (!esemeny || esemeny.type !== 'payment_intent.succeeded') return ok;
  const obj = esemeny.data && esemeny.data.object;
  // a fiok minden mas fizetese (fizetolinkek stb.) nem a miénk
  if (!obj || !PI_RE.test(String(obj.id || '')) || !obj.metadata || obj.metadata.forras !== FORRAS) return ok;

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
    if (!level) { kesz.add(nev); continue; }
    try {
      await levelKuld(k, level);
      kesz.add(nev);
    } catch (e) {
      hibas = true;
      console.error(`ajandek: webhook - kuldesi hiba (${nev})`, pi.id, e && e.message);
    }
  }
  const ertesites = kesz.size === 2 ? '1' : kesz.size === 1 ? [...kesz][0] : '';
  const uj = {};
  if (ertesites !== (md.ertesites || '')) uj.ertesites = ertesites;
  if (md.kod !== i.kod) uj.kod = i.kod;
  if (azonnali && md.kartya_kesz !== '1') {
    uj.kartya_kesz = '1';
    uj.kartya_kiallitva_ekkor = k.most.toISOString();
  }
  if (Object.keys(uj).length) await piFrissit(k.env, pi.id, { metadata: uj });
  // nem 2xx: a Stripe kesobb ujrakuldi, es csak a hianyzo level megy ki
  if (hibas) return json(500, { hiba: 'level' });
  return ok;
}

async function atutalas(k) {
  const { d, valasz } = jsonTorzs(k);
  if (valasz) return valasz;
  if (egysor(d['bot-field'])) return json(200, { ok: true });
  const { mezok, r } = rendelesAdat(d);
  const megajandekozott = egysor(d.megajandekozott);
  if (megajandekozott.length > 80) mezok.megajandekozott = 'A név legfeljebb 80 karakter lehet.';
  if (Object.keys(mezok).length) return json(400, { hiba: 'ervenytelen', mezok });

  const ar = arFt(r.termek);
  const ref = 'ATU-' + veletlenKod(6);
  const kozlemeny = (ref + (megajandekozott ? ' ' + megajandekozott : '')).slice(0, 140);
  const osszegSzoveg = ADAT.arSzoveg(ar);
  const kozos = {
    rendeles_ref: ref, termek_nev: r.termek.nev, kartya_cim: r.termek.kartya_cim, osszeg_szoveg: osszegSzoveg, kozlemeny,
  };
  // a szalon levele nelkul az igeny elveszne: ha az nem megy ki, hibat adunk
  try {
    await levelKuld(k, {
      cimzett: 'szalon',
      valasz: r.email,
      ...L.szalonAtutalasLevel({
        ...kozos, email: r.email, nev: r.nev, iranyitoszam: r.iranyitoszam, varos: r.varos, cim: r.cim,
        ceges_nev: r.ceges_nev, ceges_adoszam: r.ceges_adoszam, megajandekozott, oldal: r.attr.oldal,
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
      ...L.vevoAtutalasLevel({ ...kozos, kedvezmenyezett: ADAT.BANK.kedvezmenyezett, szamlaszam: ADAT.BANK.szamlaszam, nev: r.nev, szalon: ADAT.SZALON }),
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

const UTAK = new Map([
  ['beallitas', { GET: beallitas }],
  ['fizetes', { POST: fizetes }],
  ['rendeles', { GET: rendeles }],
  ['szemelyre', { POST: szemelyre }],
  ['kartya', { GET: kartya }],
  ['kiallit', { GET: kiallitMegerosites, POST: kiallit }],
  ['webhook', { POST: webhook }],
  ['atutalas', { POST: atutalas }],
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

export async function ajandekKezel({ method, url, headers, text, env, kuld, most } = {}) {
  let u;
  try { u = new URL(url); } catch { return json(400, { hiba: 'ervenytelen' }); }
  const k = {
    method: String(method || 'GET').toUpperCase(),
    u,
    h: fejlecek(headers),
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
