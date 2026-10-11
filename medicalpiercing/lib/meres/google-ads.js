// MEDICAL PIERCING - Google Ads ARNYEK foglalas-feltoltes (kattintas-alapu offline konverzio).
// Kulon a Mosaictol (MP-2b, MP-16): sajat fiok, sajat akciok, sajat titkok, a Mosaic-kodbol semmit nem importal.
//
// Celpont KODBAN rogzitve: csak az MP fiok (2626380837) harom "ARNYEK - MP - ..." masodlagos UPLOAD_CLICKS akcioja.
// Mas fiokra / akciora a keres nem allithato ossze (vedohalo, mint a Mosaic platformok.js-ben).
//
// Ket szallito (a kornyezettol fugg, lasd szallitoValaszt):
//   1) kozvetlen Google Ads API (uploadClickConversions), OAuth refresh tokennel: hivaskor kerunk friss access tokent,
//      igy a Mosaicnal leirt "1 ora utan lejar" gond nem all fenn;
//   2) Zapier-webhook (a Mosaic #89-es mintaja), ha a kozvetlen API titkai nincsenek meg.
// Alapbol MINDKETTO probauzemben megy: API -> validateOnly: true, Zapier -> dryrun: true. Eles feltoltes csak
// MP_GADS_MOD="eles" ES az eles hoston (www.medicalpiercing.hu) tortenik.

export const MP_GADS = Object.freeze({
  customerId: '2626380837',
  akciok: Object.freeze({ foglalas: '7834926162', uj: '7834926165', visszatero: '7834926168' }),
  apiVerzio: 'v23', // felulirhato: MP_GADS_API_VERZIO
});
const ENGEDETT_AKCIOK = Object.freeze(Object.values(MP_GADS.akciok));
// a Mosaic Google Ads fiokja: ide MP-adat SOHA nem mehet (vedohalo)
const TILTOTT_UGYFELEK = Object.freeze(['6088874770']);

/** A foglalashoz tartozo ARNYEK akciok: mindig "Foglalas", plusz "uj vendeg" vagy "visszatero" (ha ismert). */
export function akciokFoglalashoz(ujVendeg) {
  const a = [MP_GADS.akciok.foglalas];
  if (ujVendeg === true) a.push(MP_GADS.akciok.uj);
  if (ujVendeg === false) a.push(MP_GADS.akciok.visszatero);
  return a;
}

/** "yyyy-mm-dd hh:mm:ss+02:00" (Europe/Budapest), ahogy a Google Ads keri. */
export function googleIdo(unix) {
  const d = new Date(unix * 1000);
  const r = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(d).map((p) => [p.type, p.value]));
  const helyi = Date.UTC(+r.year, +r.month - 1, +r.day, +r.hour, +r.minute, +r.second);
  const perc = Math.round((helyi - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const e = Math.abs(perc);
  return `${r.year}-${r.month}-${r.day} ${r.hour}:${r.minute}:${r.second}${perc < 0 ? '-' : '+'}${String(Math.floor(e / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`;
}

// ---------- hozzajarulas (CookieYes) es kattintasazonosito ----------

/** Cookie-fejlec -> { nev: ertek } */
export function sutik(fejlec = '') {
  const o = {};
  for (const d of String(fejlec || '').split(';')) {
    const i = d.indexOf('=');
    if (i < 0) continue;
    const k = d.slice(0, i).trim();
    if (!k) continue;
    let v = d.slice(i + 1).trim();
    try { v = decodeURIComponent(v); } catch (e) { /* nyers marad */ }
    o[k] = v;
  }
  return o;
}

/**
 * A CookieYes "cookieyes-consent" sutije: "consentid:..,consent:yes,action:yes,necessary:yes,...,analytics:yes,advertisement:yes,other:no".
 * -> { dontott: bool, hirdetes: bool, analitika: bool }. Dontes nelkul / ismeretlen formaban: nincs hozzajarulas.
 */
export function hozzajarulas(cookieFejlec) {
  const s = sutik(cookieFejlec)['cookieyes-consent'];
  if (!s) return { dontott: false, hirdetes: false, analitika: false };
  const m = {};
  for (const d of s.split(',')) { const [k, v] = d.split(':'); if (k) m[k.trim()] = String(v || '').trim(); }
  const dontott = m.action === 'yes';
  return { dontott, hirdetes: dontott && m.advertisement === 'yes', analitika: dontott && m.analytics === 'yes' };
}

const ID_MINTA = /^[A-Za-z0-9_-]{8,512}$/;
const NAP90 = 90 * 86400;

/**
 * A legfrissebb ervenyes Google-kattintasazonosito: elobb a bongeszo altal (hozzajarulassal) tarolt ertek,
 * tartalekkent a Google-cimke sajat sutije (_gcl_aw: gclid, _gcl_gb: gbraid), amely szinten csak hozzajarulassal letezik.
 * -> { tipus: 'gclid'|'gbraid'|'wbraid', ertek, ido } | null
 */
export function kattintasValaszt(bongeszo, cookieFejlec, most) {
  const jeloltek = [];
  if (bongeszo && typeof bongeszo === 'object') {
    for (const tipus of ['gclid', 'gbraid', 'wbraid']) {
      const b = bongeszo[tipus];
      if (b && ID_MINTA.test(String(b.ertek || '')) && Number.isFinite(+b.ido)) jeloltek.push({ tipus, ertek: String(b.ertek), ido: Math.floor(+b.ido) });
    }
  }
  const s = sutik(cookieFejlec);
  for (const [nev, tipus] of [['_gcl_aw', 'gclid'], ['_gcl_gb', 'gbraid']]) {
    const m = /^GCL\.(\d{9,11})\.(.+)$/.exec(String(s[nev] || ''));
    if (m && ID_MINTA.test(m[2])) jeloltek.push({ tipus, ertek: m[2], ido: +m[1] });
  }
  const jo = jeloltek.filter((j) => j.ido <= most + 300 && most - j.ido <= NAP90);
  jo.sort((a, b) => b.ido - a.ido);
  return jo[0] || null;
}

/** Nyers kattintasazonosito helyett naplozhato jel (nem visszafejtheto, csak egyezes-ellenorzesre). */
export async function maszk(ertek) {
  if (!ertek) return null;
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(ertek)));
  return 'h:' + [...new Uint8Array(h)].slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** Szovegbol (pl. Google-valasz) minden ismert nyers azonosito kitakarasa. */
export function kitakar(szoveg, azonositok = []) {
  let s = String(szoveg ?? '');
  for (const a of azonositok) if (a) s = s.split(String(a)).join('[kattintas-id]');
  return s;
}

// ---------- keres-epites (tiszta, titok nelkul) ----------

/**
 * f: { kulcs, letrehozva (unix), ertek|null, kattintas: {tipus, ertek} }
 * -> { akcioId, konverzio } | { tiltva } | { kihagyva }
 */
export function konverzio(f, akcioId, { hozzajarulasHirdetes } = {}) {
  if (!ENGEDETT_AKCIOK.includes(String(akcioId))) return { tiltva: 'nem MP ARNYEK akcio: nem kuldheto' };
  if (!hozzajarulasHirdetes) return { kihagyva: 'nincs hirdetesi hozzajarulas' };
  if (!f.kattintas || !f.kattintas.ertek) return { kihagyva: 'nincs Google-kattintasazonosito' };
  const k = {
    conversionAction: `customers/${MP_GADS.customerId}/conversionActions/${akcioId}`,
    [f.kattintas.tipus]: f.kattintas.ertek,
    conversionDateTime: googleIdo(f.letrehozva),
    orderId: f.kulcs,
    consent: { adUserData: 'GRANTED' },
  };
  if (Number.isFinite(f.ertek) && f.ertek > 0) { k.conversionValue = f.ertek; k.currencyCode = 'HUF'; }
  return { akcioId: String(akcioId), konverzio: k };
}

/** A kozvetlen API torzse. validateOnly alapbol IGAZ; csak elesKuldes=true kapcsolja ki. */
export function apiTorzs(konverziok, { elesKuldes = false } = {}) {
  for (const k of konverziok) {
    const m = /^customers\/(\d+)\/conversionActions\/(\d+)$/.exec(k.conversionAction || '');
    if (!m || m[1] !== MP_GADS.customerId || TILTOTT_UGYFELEK.includes(m[1]) || !ENGEDETT_AKCIOK.includes(m[2])) throw new Error('mp_gads_tiltott_celpont');
  }
  return { conversions: konverziok, partialFailure: true, validateOnly: !elesKuldes };
}

/** A Zapier-webhook torzse (a Mosaic Zap mezoinek MP-s megfeleloje); dryrun alapbol IGAZ. */
export function zapierTorzs(k, { elesKuldes = false } = {}) {
  const akcio = /(\d+)$/.exec(k.conversionAction)[1];
  if (!ENGEDETT_AKCIOK.includes(akcio)) throw new Error('mp_gads_tiltott_celpont');
  const t = { customer_id: MP_GADS.customerId, conversion_action_id: akcio, conversion_date_time: k.conversionDateTime, order_id: k.orderId, ad_user_data: 'GRANTED' };
  for (const x of ['gclid', 'gbraid', 'wbraid']) if (k[x]) t[x] = k[x];
  if (k.conversionValue) { t.value = k.conversionValue; t.currency = 'HUF'; }
  if (!elesKuldes) t.dryrun = true;
  return t;
}

// ---------- szallitas ----------

export const ELES_HOST = 'www.medicalpiercing.hu';
/** Eles feltoltes CSAK: MP_GADS_MOD="eles" es az eles host. Minden mas eset probauzem. */
export const elesKuldesE = (env = {}, host = '') => String(env.MP_GADS_MOD || '') === 'eles' && host === ELES_HOST;

export function szallitoValaszt(env = {}) {
  if (env.GOOGLE_ADS_DEVELOPER_TOKEN && env.GOOGLE_ADS_CLIENT_ID && env.GOOGLE_ADS_CLIENT_SECRET && env.GOOGLE_ADS_REFRESH_TOKEN) return 'api';
  if (env.MP_GOOGLE_ARNYEK_WEBHOOK_URL) return 'zapier';
  return null;
}

let tokenGyorsitotar = null; // { token, lejar } izolatumonkent
export function _tokenTorles() { tokenGyorsitotar = null; }

async function accessToken(env, fetchImpl, most) {
  if (tokenGyorsitotar && tokenGyorsitotar.lejar > most + 60) return tokenGyorsitotar.token;
  const r = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN }).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('oauth: HTTP ' + r.status + ' ' + String(j.error || '').slice(0, 60));
  tokenGyorsitotar = { token: j.access_token, lejar: most + (Number(j.expires_in) || 3600) };
  return j.access_token;
}

const ZAPIER_MINTA = /^(https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[A-Za-z0-9_-]+\/?|http:\/\/127\.0\.0\.1:\d+\/.*)$/;

/**
 * Egy foglalas konverzioinak kuldese. A titkok csak itt kerulnek a keresbe, a visszaadott eredmenybe nem.
 * -> [{ akcioId, allapot: 'elfogadva'|'elkuldve'|'hiba'|'nincs_hitelesites', mod: 'validate'|'eles'|'dryrun', kuldo, http_status, valasz }]
 */
export async function kuldes(konverziok, env = {}, { elesKuldes = false, fetchImpl = fetch, most = Math.floor(Date.now() / 1000), ms = 8000 } = {}) {
  const sz = szallitoValaszt(env);
  const nyersek = konverziok.map((k) => k.gclid || k.gbraid || k.wbraid);
  const ered = (k, x) => ({ akcioId: /(\d+)$/.exec(k.conversionAction)[1], ...x, valasz: x.valasz == null ? null : kitakar(x.valasz, nyersek).slice(0, 1500) });
  if (!sz) return konverziok.map((k) => ered(k, { allapot: 'nincs_hitelesites', mod: elesKuldes ? 'eles' : 'validate', kuldo: null, http_status: null, valasz: null }));
  const ab = new AbortController(); const t = setTimeout(() => ab.abort(), ms);
  try {
    if (sz === 'api') {
      const mod = elesKuldes ? 'eles' : 'validate';
      const torzs = apiTorzs(konverziok, { elesKuldes });
      let r, szoveg;
      try {
        const token = await accessToken(env, fetchImpl, most);
        const fejlec = { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN };
        if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) fejlec['login-customer-id'] = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g, '');
        const v = env.MP_GADS_API_VERZIO || MP_GADS.apiVerzio;
        r = await fetchImpl(`https://googleads.googleapis.com/${v}/customers/${MP_GADS.customerId}:uploadClickConversions`, { method: 'POST', headers: fejlec, body: JSON.stringify(torzs), signal: ab.signal });
        szoveg = await r.text();
      } catch (e) {
        return konverziok.map((k) => ered(k, { allapot: 'hiba', mod, kuldo: 'api', http_status: null, valasz: 'halozati / oauth hiba: ' + String(e && e.message || e).slice(0, 200) }));
      }
      let j = null; try { j = JSON.parse(szoveg); } catch (e) { /* nem JSON */ }
      // partialFailure: a hibas sorok indexe a partialFailureError.details[].errors[].location.fieldPathElements[0].index-ben
      const hibasIndexek = new Set();
      const pf = j && j.partialFailureError;
      if (pf) for (const d of pf.details || []) for (const er of d.errors || []) {
        const fp = (er.location && er.location.fieldPathElements) || [];
        const ix = fp.find((x) => x.fieldName === 'conversions');
        if (ix && Number.isFinite(ix.index)) hibasIndexek.add(ix.index);
      }
      return konverziok.map((k, i) => {
        const ok = r.ok && !(pf && (hibasIndexek.has(i) || !hibasIndexek.size));
        return ered(k, { allapot: ok ? (elesKuldes ? 'elkuldve' : 'elfogadva') : 'hiba', mod, kuldo: 'api', http_status: r.status, valasz: szoveg });
      });
    }
    // zapier
    const mod = elesKuldes ? 'eles' : 'dryrun';
    const url = String(env.MP_GOOGLE_ARNYEK_WEBHOOK_URL).trim();
    if (!ZAPIER_MINTA.test(url)) return konverziok.map((k) => ered(k, { allapot: 'hiba', mod, kuldo: 'zapier', http_status: null, valasz: 'ervenytelen MP_GOOGLE_ARNYEK_WEBHOOK_URL formatum' }));
    const ki = [];
    for (const k of konverziok) {
      try {
        const r = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(zapierTorzs(k, { elesKuldes })), signal: ab.signal });
        const sz2 = await r.text();
        ki.push(ered(k, { allapot: r.ok ? (elesKuldes ? 'elkuldve' : 'elfogadva') : 'hiba', mod, kuldo: 'zapier', http_status: r.status, valasz: sz2 }));
      } catch (e) {
        ki.push(ered(k, { allapot: 'hiba', mod, kuldo: 'zapier', http_status: null, valasz: 'halozati hiba: ' + String(e && e.message || e).slice(0, 200) }));
      }
    }
    return ki;
  } finally { clearTimeout(t); }
}
