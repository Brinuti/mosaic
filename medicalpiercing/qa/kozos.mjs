// MP foglalomotor QA - kozos resz (bongeszo, halozati elkapas, elemzok). Leiras: README.md.
//
// A bongeszo alapbol az ELES cimen (https://www.medicalpiercing.hu) nyitja meg az oldalt, de minden erre a
// hostra meno kerest a megadott ELONEZETI cimrol szolgalunk ki (route.fetch). Igy a suti.js betolti a
// merokodokat (csak az eles domainen futnak), mikozben az eles oldalt nem terheljuk.
// Kifele (Google Ads, GA4, Meta, TikTok, Convertize, CookieYes-naplo, Salonic) SEMMI nem megy ki:
// csak a szkriptek GET-letoltese engedett, minden mas keres naplozva es eldobva (mint a fejleszto
// tools/meres-teszt.mjs-eben). A Salonic-oldal helyett egy helyi csonk-oldal nyilik meg.
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function playwright() {
  for (const alap of [import.meta.url, path.join(process.cwd(), 'x.js'), '/opt/node22/lib/node_modules/']) {
    try { return createRequire(alap)('playwright'); } catch { /* kovetkezo */ }
  }
  throw new Error('A playwright nem talalhato: npm i playwright && npx playwright install chromium');
}

export function argumentumok(argv = process.argv.slice(2)) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m) continue;
    if (m[2] !== undefined) a[m[1]] = m[2];
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) a[m[1]] = argv[++i];
    else a[m[1]] = '1';
  }
  return a;
}

export const ELES = 'https://www.medicalpiercing.hu';
export const SALONIC = 'https://medicalpiercing.salonic.hu';
const QA_DIR = path.dirname(new URL(import.meta.url).pathname);

/** Beallitasok a parancssorbol (minden kulcs: README.md). */
export function beallitas(a) {
  const url = String(a.url || process.env.MP_QA_URL || '').replace(/\/$/, '');
  if (!/^https:\/\/([a-z0-9-]+\.)*medicalpiercing\.pages\.dev$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) {
    throw new Error('--url: csak elonezeti cim (https://<ag>.medicalpiercing.pages.dev) vagy helyi cim adhato meg, az eles oldal nem');
  }
  const ref = (() => { try { return JSON.parse(fs.readFileSync(a.referencia || path.join(QA_DIR, 'salonic-referencia-2026-10-11.json'), 'utf8')); } catch { return null; } })();
  return {
    url,
    alias: a.alias !== '0', // 1: eles cimkent nyitjuk (merokodok futnak); 0: az elonezeti cimen (merokod nem fut)
    nezetek: a.nezet === 'mobil' ? ['mobil'] : a.nezet === 'asztali' ? ['asztali'] : ['asztali', 'mobil'],
    kapcsolo: { mod: a['kapcsolo-mod'] || 'query', nev: a['kapcsolo-nev'] || 'mp_motor', ertek: a['kapcsolo-ertek'] ?? '0' },
    kiosztas: {
      kulcs: a['kiosztas-kulcs'] || 'mp_motor_csoport',
      motor: String(a['kiosztas-motor'] || 'motor,uj,B,1').split(','),
      regi: a['kiosztas-regi'] || 'regi',
      tarolo: a['kiosztas-tarolo'] || 'mindketto', // localstorage | cookie | mindketto
    },
    motorJel: a['motor-jel'] || '[data-mp-motor], #mp-motor, #mp-foglalo, .mp-motor, .mp-foglalo, iframe[src*="motor"], iframe[src*="foglalo"]',
    motorApi: new RegExp(a['motor-api'] || '/api/mp-(?!foglalas(\\?|$))[a-z0-9-]+'),
    awId: '11097894040',
    awCimke: a['aw-cimke'] || null, // az "All - Idopontfoglalas" cimkeje, ha ismert
    ga4Esemeny: new RegExp(a['ga4-esemeny'] || '^begin_checkout$'),
    oldalak: String(a.oldalak || '/migren-piercing-uj,/idopontfoglalas,/').split(','),
    ctaOldal: a['cta-oldal'] || '/migren-piercing-uj',
    api: a.api === 'elonezet' ? 'elonezet' : 'mock', // /api/mp-foglalas: mock (alap) vagy az elonezet valodi fuggvenye (D1, kornyezet=elonezet)
    szigoru: a.szigoru === '1', // QA-4: ujratolteskor 0 cimke-hivas (ne csak azonos oid)
    varas: +(a.varas || 8000),
    piiUrl: a['pii-url'] === '1',
    ref,
  };
}

export const NEZETEK = {
  asztali: { viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' },
  mobil: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
};

// kivulrol csak ezek a szkriptek tolthetok le (GET); minden mas keres eldobva
const SZABAD = /^https:\/\/(www\.googletagmanager\.com\/(gtm|gtag\/js)|connect\.facebook\.net\/(en_US\/fbevents\.js|signals\/config\/)|analytics\.tiktok\.com\/i18n\/pixel\/|cdn-cookieyes\.com\/(client_data|script)|cdn\.jsdelivr\.net\/|fonts\.(googleapis|gstatic)\.com\/)/;

export const PLATFORM = (u) =>
  /\/g\/collect|google-analytics\.com|analytics\.google\.com/.test(u) ? 'ga4'
    : /googleadservices\.com|googleads\.g\.doubleclick\.net|google\.[a-z.]+\/(pagead|ccm|rmkt)|doubleclick\.net/.test(u) ? 'google-ads'
      : /facebook\.com|facebook\.net/.test(u) ? 'meta'
        : /tiktok/.test(u) ? 'tiktok'
          : /cookieyes/.test(u) ? 'cookieyes'
            : /convertize/.test(u) ? 'convertize' : 'egyeb';

export const consentSuti = (igen, url) => ({
  name: 'cookieyes-consent',
  value: encodeURIComponent(`consentid:qa${Date.now()},consent:${igen ? 'yes' : 'no'},action:yes,necessary:yes,functional:${igen ? 'yes' : 'no'},analytics:${igen ? 'yes' : 'no'},performance:${igen ? 'yes' : 'no'},advertisement:${igen ? 'yes' : 'no'},other:${igen ? 'yes' : 'no'}`),
  url,
});

/**
 * Uj bongeszo-kontextus elkapott halozattal.
 * opt: { hozzajarulas: true|false|null, kiosztas: null|ertek, kapcsolo: true|false }
 * -> { ctx, naplo, host, nyit(ut) }
 *   naplo: [{ t, tipus: 'kifele'|'salonic'|'sajat-api'|'sajat', plat, url, method, post, navig }]
 */
export async function kontextus(b, cfg, nezet, opt = {}) {
  const host = cfg.alias ? ELES : cfg.url;
  const ctx = await b.newContext({ ...NEZETEK[nezet], serviceWorkers: 'block', locale: 'hu-HU', timezoneId: 'Europe/Budapest' });
  const naplo = [];
  const api = [];
  if (opt.hozzajarulas != null) await ctx.addCookies([consentSuti(opt.hozzajarulas, host)]);
  const { kapcsolo, kiosztas } = cfg;
  if (opt.kapcsolo !== false && kapcsolo.mod === 'cookie') await ctx.addCookies([{ name: kapcsolo.nev, value: kapcsolo.ertek, url: host }]);
  if (opt.kiosztas != null && kiosztas.tarolo !== 'localstorage') await ctx.addCookies([{ name: kiosztas.kulcs, value: opt.kiosztas, url: host }]);
  // a lapon: kioszto-irasok, dataLayer- es ttq-esemenyek idobelyeggel; elore beallitott kapcsolo / kiosztas
  await ctx.addInitScript(({ ls, kulcs, kioszt, kiosztLs }) => {
    window.__qa = { irasok: [], esemenyek: [] };
    try {
      if (ls) localStorage.setItem(ls[0], ls[1]);
      if (kioszt != null && kiosztLs) localStorage.setItem(kulcs, kioszt);
      const eredeti = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (String(k) === kulcs) window.__qa.irasok.push({ t: Date.now(), hol: 'localStorage', v: String(v) }); return eredeti.apply(this, arguments); };
      const leiro = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get() { return leiro.get.call(document); },
        set(v) { if (String(v).startsWith(kulcs + '=')) window.__qa.irasok.push({ t: Date.now(), hol: 'cookie', v: String(v).split(';')[0] }); leiro.set.call(document, v); },
      });
    } catch (e) { /* tiltott tarolo */ }
    const dl = (window.dataLayer = window.dataLayer || []);
    const push = dl.push;
    dl.push = function (o) { try { const e = o && (o.event || (o[0] === 'event' && o[1])); if (e && !/^gtm\./.test(e)) window.__qa.esemenyek.push({ t: Date.now(), forras: 'dataLayer', nev: String(e) }); } catch (e) { /* */ } return push.apply(this, arguments); };
    const iv = setInterval(() => {
      const tt = window.ttq;
      if (tt && typeof tt.track === 'function' && !tt.__qa) {
        const tr = tt.track; tt.__qa = 1;
        tt.track = function (nev, p) { window.__qa.esemenyek.push({ t: Date.now(), forras: 'ttq', nev: String(nev), p: JSON.stringify(p || {}) }); return tr.apply(this, arguments); };
      }
    }, 50);
    setTimeout(() => clearInterval(iv), 60000);
  }, {
    ls: opt.kapcsolo !== false && kapcsolo.mod === 'localstorage' ? [kapcsolo.nev, kapcsolo.ertek] : null,
    kulcs: kiosztas.kulcs, kioszt: opt.kiosztas ?? null, kiosztLs: kiosztas.tarolo !== 'cookie',
  });

  await ctx.route('**/*', async (route) => {
    const r = route.request();
    const u = r.url();
    const t = Date.now();
    if (u.startsWith(host + '/') || u === host) {
      const ut = u.slice(host.length) || '/';
      if (/^\/api\//.test(ut)) {
        const sor = { t, tipus: 'sajat-api', url: ut, method: r.method(), post: r.postData() || '' };
        naplo.push(sor); api.push(sor);
        if (/^\/api\/mp-foglalas(\?|$)/.test(ut) && cfg.api === 'mock') {
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"uj":true,"qa":"mock"}' });
        }
      } else naplo.push({ t, tipus: 'sajat', url: ut, method: r.method() });
      if (!cfg.alias) return route.continue();
      try {
        const suti = (await ctx.cookies(host)).map((c) => `${c.name}=${c.value}`).join('; ');
        const fej = { ...r.headers() };
        delete fej.host;
        if (suti) fej.cookie = suti;
        const v = await route.fetch({ url: cfg.url + ut, headers: fej, maxRedirects: 0 });
        const vf = v.headers();
        // atiranyitas az elonezeten belul: az eles host ala visszairva
        if (vf.location) vf.location = vf.location.replace(cfg.url, host);
        return route.fulfill({ response: v, headers: vf });
      } catch (e) { return route.abort(); }
    }
    if (u.startsWith(SALONIC)) {
      naplo.push({ t, tipus: 'salonic', url: u, method: r.method(), navig: r.isNavigationRequest() });
      return r.isNavigationRequest()
        ? route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>salonic-csonk</title><p>QA: a Salonic-oldal helyett csonk (nem ment ki keres)</p>' })
        : route.abort();
    }
    if (SZABAD.test(u) && r.method() === 'GET') return route.continue();
    naplo.push({ t, tipus: 'kifele', plat: PLATFORM(u), url: u, method: r.method(), post: r.postData() || '' });
    return route.abort();
  });

  const kapcsoloQ = opt.kapcsolo !== false && kapcsolo.mod === 'query' ? `${kapcsolo.nev}=${encodeURIComponent(kapcsolo.ertek)}` : '';
  const cim = (ut) => {
    const u = new URL(host + ut);
    if (kapcsoloQ) u.search += (u.search ? '&' : '') + kapcsoloQ;
    return u.toString();
  };
  return { ctx, naplo, api, host, cim };
}

export const varj = (ms) => new Promise((r) => setTimeout(r, ms));

/** Kattintasra varo TikTok / GA4 betoltes (legfeljebb ms). */
export async function merokodraVar(p, ms = 10000) {
  const veg = Date.now() + ms;
  while (Date.now() < veg) {
    if (await p.evaluate(() => !!(window.ttq && window.ttq._i) || !!(window.google_tag_manager))) break;
    await varj(250);
  }
  await varj(1500);
}

// ---------- elemzok ----------
const dek = (s) => { let x = String(s || ''); for (let i = 0; i < 3; i++) { try { const y = decodeURIComponent(x.replace(/\+/g, ' ')); if (y === x) break; x = y; } catch { break; } } return x; };
const qp = (u) => { try { return new URL(u).searchParams; } catch { return new URLSearchParams(); } };

/** Google Ads konverzio-hivasok (AW-<id>): cimkenkent a "kisulesek" szama (csatornankent szamolva, a max). */
export function googleAdsKonverziok(sorok, awId) {
  const re = new RegExp(`/(pagead/conversion|pagead/1p-conversion|ccm/conversion|pagead/viewthroughconversion)/${awId}/`);
  const cimkek = {};
  for (const s of sorok) {
    if (s.tipus !== 'kifele') continue;
    const m = re.exec(s.url);
    if (!m) continue;
    const p = qp(s.url);
    const post = new URLSearchParams(s.post || '');
    const label = p.get('label') || post.get('label');
    if (!label) continue; // remarketing (page_view), nem konverzio
    const c = (cimkek[label] ||= { csatorna: {}, oid: new Set(), gcs: new Set(), value: new Set() });
    c.csatorna[m[1]] = (c.csatorna[m[1]] || 0) + 1;
    c.oid.add(p.get('oid') || post.get('oid') || p.get('transaction_id') || '');
    if (p.get('gcs')) c.gcs.add(p.get('gcs'));
    if (p.get('value')) c.value.add(p.get('value'));
  }
  const ki = {};
  for (const [l, c] of Object.entries(cimkek)) ki[l] = { db: Math.max(...Object.values(c.csatorna)), oid: [...c.oid], gcs: [...c.gcs], value: [...c.value] };
  return ki;
}

/** GA4 esemenyek (/g/collect: URL + soronkent a POST-torzs). */
export function ga4Esemenyek(sorok) {
  const ki = [];
  for (const s of sorok) {
    if (s.tipus !== 'kifele' || !/\/g\/collect/.test(s.url)) continue;
    const alap = qp(s.url);
    const sorokP = (s.post || '').split(/\r?\n/).filter(Boolean);
    for (const l of sorokP.length ? sorokP : ['']) {
      const p = new URLSearchParams(l);
      const en = p.get('en') || alap.get('en');
      if (en) ki.push({ t: s.t, en, tid: alap.get('tid'), gcs: alap.get('gcs'), dl: alap.get('dl') });
    }
  }
  return ki;
}

/** TikTok esemenyek (analytics.tiktok.com/api/v2/pixel[/batch]). */
export function tiktokEsemenyek(sorok) {
  const ki = [];
  for (const s of sorok) {
    if (s.tipus !== 'kifele' || !/analytics\.tiktok\.com\/api\/v2\/pixel/.test(s.url)) continue;
    let j; try { j = JSON.parse(s.post); } catch { continue; }
    for (const e of Array.isArray(j.batch) ? j.batch : [j]) ki.push({ t: s.t, event: e.event, properties: e.properties || {} });
  }
  return ki;
}

const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
export const TESZT_SZEMELY = { nev: 'Qa Tesztelek', email: 'qa.teszt.mp@example.com', telefon: '+36301234567' };

/** Tiltott tartalmak: vendegnev, e-mail, telefon (nyersen es SHA-256-tal), egeszsegugyi szoveg. */
export function tiltottLista(cfg) {
  const t = TESZT_SZEMELY;
  const tiltott = [
    ['nev', t.nev], ['nev', 'Tesztelek'], ['email', t.email], ['email', 'qa.teszt.mp'],
    ['telefon', '301234567'], ['telefon-hash', sha('36301234567')], ['telefon-hash', sha('+36301234567')],
    ['email-hash', sha(t.email)], ['nev-hash', sha('qa')], ['nev-hash', sha('tesztelek')],
  ];
  // egeszsegugyi szoveg: a Salonic-kinalat (QA-3 referencia) szolgaltatasneveibol + rogzitett szavak
  const szavak = new Set(['migrén', 'migren', 'fejfájás', 'fejfajas', 'stressz', 'klimax', 'változókor', 'valtozokor', 'étvágy', 'etvagy',
    'allergia', 'pajzsmirigy', 'vastagbél', 'vastagbel', 'máj piercing', 'maj piercing', 'lép piercing', 'lep piercing', 'shenmen']);
  for (const h of cfg.ref?.helyszinek || []) for (const s of h.szolgaltatasok) if (/1 db .*(Migrén|Shenmen|Klimax|Slim|Máj|Vastagbél|Lép|Allergia|Pajzsmirigy)/i.test(s.nev)) szavak.add(s.nev.toLowerCase().replace(/\s+/g, ' ').trim());
  for (const sz of szavak) tiltott.push(['egeszseg', sz]);
  return tiltott;
}

/** A naplo kifele (Meta, TikTok, Google, GA4) keresei kozt a tiltott tartalmak. */
export function tiltottKeres(sorok, tiltott) {
  const talalat = [];
  for (const s of sorok) {
    if (s.tipus !== 'kifele' || !['ga4', 'google-ads', 'meta', 'tiktok'].includes(s.plat)) continue;
    const szena = (dek(s.url) + ' ' + dek(s.post)).toLowerCase().replace(/\s+/g, ' ');
    for (const [fajta, ertek] of tiltott) {
      const e = ertek.toLowerCase();
      if (szena.includes(e)) {
        const i = szena.indexOf(e);
        talalat.push({ plat: s.plat, fajta, ertek, reszlet: szena.slice(Math.max(0, i - 50), i + e.length + 20) });
      }
    }
  }
  return talalat;
}

/** Koszonooldal-cim a Salonic atiranyitasanak formajaban (+ booking_id, ha megadjuk). */
export function koszonoUt(cfg, { start, bookingId, utotag = '-mi', extra = {} } = {}) {
  const bp = cfg.ref?.helyszinek?.find((h) => h.placeId === 6029);
  const svc = bp?.szolgaltatasok.find((s) => /Migrén/i.test(s.nev)) || { serviceId: 115575, ar_ft: 24900 };
  const emp = bp?.munkatarsak?.[0] || { employeeId: 13509, nev: 'Kovács Gabriella' };
  const burl = `${SALONIC}/booking/selectDate/?placeId=6029&serviceId=${svc.serviceId}&employeeId=${emp.employeeId}&startDate=${start}`;
  const q = new URLSearchParams({
    first_booking: '1', location: 'Budapest', employee: emp.nev, bookingUrl: burl, price: String(svc.ar_ft),
    service: 'Migrén piercing', g: '2038420', category: 'Migrén', ...extra,
  });
  if (bookingId) q.set('booking_id', bookingId);
  return `/foglalas-ok${utotag}?${q}`;
}

export const egyediStart = () => 1900000000 + Math.floor(Math.random() * 5e6) * 60;

/** Lathato foglalasi gombok (Salonic-linkek). */
export const salonicLinkek = (p) => p.locator(`a[href^="${SALONIC}"]:visible, a[href^="${SALONIC.replace('https', 'http')}"]:visible`);

export async function motorLathato(p, cfg) {
  try { return await p.locator(cfg.motorJel).filter({ visible: true }).count(); } catch { return 0; }
}

export const sor = (teszt, nezet, eset, eredmeny, info = '') => ({ teszt, nezet, eset, eredmeny, info: String(info).slice(0, 400) });
