// A Meta-pixel viselkedese oldalankent: melyik pixel-azonosito indul, hany PageView, letrejon-e a _fbc / _fbp suti (a kattintas-azonositobol),
// a Stripe-gombok linkjeben ott van-e az fbc. Minden kimeno meresi kereset (capig.stape.* is) naplozva TILT (lasd tilt.mjs).
//
//   node tools/meres-proba/pixel-proba.mjs --oldalak mind|/utvonal,/masik --out pixel.json [--overlay dist] [--mobil 1] [--szal 4] [--varakozas 8000]
//   node tools/meres-proba/pixel-proba.mjs --osszevet elozo.json uj.json
//
// A pixel-azonositok elvart erteke a helyi assets/js/suti.js listaibol (PIXEL_OLDALAK) jon; a listan kivuli oldalra "nincs elvart pixel".
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures, hozzajarulasScript } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const BASE = 'https://www.mosaicheadspa.hu';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FBCLID = 'TESZTPIXEL';

// --- osszevetes (elozo vs uj futas) --------------------------------------------------------------------------------------------------
if (process.argv[2] === '--osszevet') {
  const a = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).oldalak, b = JSON.parse(fs.readFileSync(process.argv[4], 'utf8')).oldalak;
  const alairas = (o) => JSON.stringify({ pixelek: o.pixelek, pageView: o.pageViewPixelenkent, capiPageView: o.capiPageView, esemenyek: o.esemenyek, google: o.google, tiktok: o.tiktok, duplikalt: o.duplikaltFigyelmeztetes });
  const eltero = Object.keys(b).filter((k) => alairas(a[k] || {}) !== alairas(b[k]));
  console.log(`oldalak: ${Object.keys(a).length} -> ${Object.keys(b).length} | eltero: ${eltero.length}`);
  for (const k of eltero) console.log(`  ${k}\n     elotte: ${alairas(a[k] || {})}\n     utana : ${alairas(b[k])}`);
  process.exit(0);
}

// --- elvart pixelek a suti.js-bol ---------------------------------------------------------------------------------------------------------
const sutiSzoveg = fs.readFileSync(path.join(ROOT, 'assets/js/suti.js'), 'utf8');
const azon = Object.fromEntries([...sutiSzoveg.matchAll(/var PIXEL_HEADSPA = '(\d+)', PIXEL_PMU = '(\d+)',\s*PIXEL_FODRASZ = '(\d+)', PIXEL_SZOR = '(\d+)'/g)].flatMap((m) => [['HEADSPA', m[1]], ['PMU', m[2]], ['FODRASZ', m[3]], ['SZOR', m[4]]]));
const elvart = {};
for (const m of sutiSzoveg.matchAll(/\[(PIXEL_[A-Z]+), '([^']+)'\]/g)) for (const o of m[2].split(' ')) elvart[o.normalize('NFC')] = azon[m[1].replace('PIXEL_', '')];

// --- oldalak -----------------------------------------------------------------------------------------------------------------------------------
const mind = fs.readdirSync(path.join(ROOT, 'klon')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, ''));
const kert = arg('oldalak', 'mind');
// A koszonooldalak a Salonic valodi atiranyitasanak paramétereivel (first_booking + bookingUrl), hogy a GTM 213-as cimkeje is lefusson (a kimeno kerelmek tiltva).
const bk = (host, emp, pl, sid) => encodeURIComponent(`https://${host}/guestData/?anyone=true&employeeId=${emp}&placeId=${pl}&serviceId=${sid}&startDate=1793377800&back=`);
const kp = (ut, first, price, service, location, employee, g, host, emp, pl, sid) => `${ut}?first_booking=${first}&service=${encodeURIComponent(service)}&category=x&price=${price}&location=${encodeURIComponent(location)}&employee=${encodeURIComponent(employee)}&g=g:${g}&bookingUrl=${bk(host, emp, pl, sid)}`;
const KOSZONOK = [
  kp('/success-foglalas-egyeni', true, 26900, 'Egyeni Relax', 'Mosaic Headspa', 'Negykezes Head spa', 9900001, 'mosaicheadspa.salonic.hu', 29415, 10427, 302342),
  kp('/fodrasz-ok', true, 0, 'Fodrasz konzultacio', 'Mosaic Hair', 'Noel', 9900002, 'mosaic-hair.salonic.hu', 25095, 10823, 232804),
  kp('/oxigenterapia-ok', true, 29900, 'Haj Oxigenterapia - 1. alkalom', 'Mosaic Oxigen', 'Menyhart Moni', 9900003, 'mosaic-oxigen.salonic.hu', 32969, 14409, 466110),
  kp('/oxigenterapia-masodik', false, 26000, 'Haj Oxigenterapia - 2. alkalomtol', 'Mosaic Oxigen', 'Menyhart Moni', 9900004, 'mosaic-oxigen.salonic.hu', 32969, 14409, 466158),
  kp('/elysion-ok', true, 24000, 'ARC - Teljes arc', 'Mosaic Elysion', 'Elysion Pro Szortelenites', 9900005, 'mosaic-elysion.salonic.hu', 32417, 14586, 476485),
  kp('/pmu-ok', true, 0, 'PMU konzultacio', 'Mosaic PMU', 'Toreki Melitta', 9900006, 'mosaic-pmu.salonic.hu', 32428, 14585, 471160),
];
const nevek = [...(kert === 'mind' ? mind : kert === 'nincs' ? [] : kert.split(',').map((u) => decodeURIComponent(u.replace(/^\//, '')) || 'index')), ...(arg('koszonok', '0') === '1' ? KOSZONOK : [])];
const HOZZAJARULAS = arg('hozzajarulas', '1') !== '0';
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', SZAL = +arg('szal', '4'), VAR = +arg('varakozas', '8000'), OUT = arg('out', 'pixel.json');
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

// A foglalas/pmu-ok.html es pmu-vh.html szimbolikus link a gitben (120000): Windowson (core.symlinks=false) 16 bajtos szovegfajl lesz, amiben a cel neve all.
// Az eles (Linux) build ezeket valodi linkkent adja ki, ezert az overlay a szovegfajl helyett a celfajlt szolgalja ki.
function szimlinkFeloldva(fajl) {
  const b = fs.readFileSync(fajl);
  if (b.length < 80 && /^[\w./-]+\.html$/.test(b.toString('utf8').trim())) { const cel = path.join(path.dirname(fajl), b.toString('utf8').trim()); if (fs.existsSync(cel)) return fs.readFileSync(cel); }
  return b;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ua = MOBIL ? UA_MOBIL : UA;

async function oldal(nevEredeti) {
  const [nev, lekerdezes] = nevEredeti.split('?');
  const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  if (HOZZAJARULAS) await ctx.addInitScript(hozzajarulasScript); // --hozzajarulas 0: friss latogato, a suti-sav megjelenik, nincs elfogadva semmi
  const metaKer = [], capi = [], konfig = [], gads = [], tikt = [], tiltott = [], gaEsem = [], zapier = [];
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (OVERLAY && u.hostname === 'www.mosaicheadspa.hu' && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || ua);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body: szimlinkFeloldva(e.fajl) });
    }
    const plat = platformOf(url) || (engedett(url, req.method()) ? null : 'ismeretlen-tiltott');
    if (/connect\.facebook\.net\/.*signals\/config\/(\d+)/.test(url)) konfig.push(url.match(/signals\/config\/(\d+)/)[1]);
    if (plat) {
      const body = req.postData() || '';
      const par = Object.fromEntries(u.searchParams);
      if (plat === 'meta') { const q = new URLSearchParams(body); metaKer.push({ id: par.id || q.get('id'), ev: par.ev || q.get('ev'), eid: par.eid || q.get('eid'), fbc: par.fbc || q.get('fbc'), fbp: par.fbp || q.get('fbp') }); }
      else if (/capig\.stape/.test(u.host)) { try { const b = JSON.parse(body); capi.push({ nev: b.event_name, pixel: b['fb.pixel_id'], eid: b.event_id }); } catch (e) { capi.push({ nev: '?' }); } }
      else if (plat === 'google-ads' && par.en === 'conversion') gads.push(`${(par.label || '').slice(0, 6)}`);
      else if (plat === 'tiktok') { try { const b = JSON.parse(body); if (b.event && !/^(Pageview|LandingPageView|EngagedSession|EnrichIpv6|InitiateCheckout|EnrichAM)$/.test(b.event)) tikt.push(b.event); } catch (e) { /* */ } }
      else if (plat === 'zapier') zapier.push(1);
      if ((plat === 'ga4' || plat === 'stape') && par.en && !/^(page_view|user_engagement|scroll|visit|session_start|first_visit|gtm\.[a-z]+|consent_update)$/i.test(par.en)) gaEsem.push(par.en);
      if (plat === 'ismeretlen-tiltott') tiltott.push(`${req.method()} ${u.host}${u.pathname.slice(0, 30)}`);
      const v = ures(req); return route.fulfill(v);
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  const konzol = [];
  page.on('console', (m) => { const t = m.text(); if (/pixel|fbq|duplicate/i.test(t)) konzol.push(t.slice(0, 160)); });
  let hiba = null, allapot = null;
  try {
    const r = await page.goto(BASE + (nev === 'index' ? '/' : (nev.startsWith('/') ? '' : '/') + encodeURI(nev)) + `?${lekerdezes ? lekerdezes + '&' : ''}fbclid=${FBCLID}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    allapot = r ? r.status() : null;
    await page.waitForTimeout(VAR);
  } catch (e) { hiba = String(e.message).slice(0, 120); }
  let fbqPixelek = null, oldalKulcs = null, stripe = [];
  try {
    fbqPixelek = await page.evaluate(() => { try { const s = window.fbq && window.fbq.getState && window.fbq.getState(); return s && s.pixels ? s.pixels.map((p) => p.id) : (window.fbq ? 'fbq van, getState nincs' : null); } catch (e) { return 'hiba'; } });
    oldalKulcs = await page.evaluate(() => decodeURIComponent(location.pathname).replace(/^\/(m\/)?/, '').replace(/\.html$/, '').replace(/\/$/, '') || 'index');
    stripe = await page.evaluate(() => { const lista = [...document.querySelectorAll('a[href*="buy.stripe.com"]')]; window.addEventListener('click', (e) => e.preventDefault()); return lista.map((a) => { a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return a.href; }); });
  } catch (e) { /* az oldal esetleg navigalt */ }
  const sutik = Object.fromEntries((await ctx.cookies()).filter((c) => /^(_fbc|_fbp)$/.test(c.name)).map((c) => [c.name, c.value]));
  await ctx.close();
  const pv = {}; for (const k of metaKer.filter((x) => x.ev === 'PageView')) pv[k.id] = (pv[k.id] || 0) + 1;
  const esem = {}; for (const k of metaKer.filter((x) => x.ev && x.ev !== 'PageView' && x.ev !== 'SubscribedButtonClick' && x.ev !== 'Microdata')) esem[k.ev] = (esem[k.ev] || 0) + 1;
  const elvartPixel = elvart[nev.replace(/^\//, '').normalize('NFC')] || null;
  return {
    nev: nevEredeti.length > 70 ? nev + '?(koszono-parameterek)' : nevEredeti, allapot, hiba, oldalKulcs, oldalKulcsAzonos: oldalKulcs === null ? null : oldalKulcs === nev.replace(/^\//, ''), elvartPixel,
    pixelek: [...new Set([...(Array.isArray(fbqPixelek) ? fbqPixelek : []), ...konfig, ...Object.keys(pv)])].sort(), fbqGetState: fbqPixelek, pixelKonfigBetoltes: konfig,
    pageViewPixelenkent: pv, capiPageView: capi.filter((c) => c.nev === 'PageView').length, capiPixel: [...new Set(capi.map((c) => c.pixel).filter(Boolean))],
    esemenyek: esem, google: [...new Set(gads)].sort(), ga4esemenyek: [...new Set(gaEsem)].sort(), tiktok: [...new Set(tikt)].sort(), zapier: zapier.length,
    duplikaltFigyelmeztetes: konzol.filter((t) => /duplicate/i.test(t)).length, konzolPixel: konzol.slice(0, 4),
    fbc: sutik._fbc || null, fbcTartalmazza: !!(sutik._fbc && sutik._fbc.includes(FBCLID)), fbp: !!sutik._fbp,
    metaKerelmekFbc: metaKer.filter((x) => x.fbc).length, stripeLinkek: stripe.length, stripeKattintasUtan: stripe.filter((h) => /client_reference_id=[^&]*TESZTPIXEL/.test(h)).length, stripePelda: ((stripe.find((h) => /client_reference_id/.test(h)) || '').match(/client_reference_id=[^&]*/) || [null])[0],
    tiltottIsmeretlen: [...new Set(tiltott)],
  };
}

const out = {}; let i = 0;
async function dolgozo() { while (i < nevek.length) { const n = nevek[i++]; try { const e = await oldal(n); out[e.nev] = e; } catch (e) { out[n] = { nev: n, hiba: String(e.message).slice(0, 160) }; } process.stdout.write('.'); } }
await Promise.all(Array.from({ length: SZAL }, dolgozo));
await browser.close();
const rendezett = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(OUT, JSON.stringify({ ido: new Date().toISOString(), overlay: !!OVERLAY, mobil: MOBIL, hozzajarulas: HOZZAJARULAS, fbclid: FBCLID, oldalak: rendezett }, null, 1));
console.log(`\nkesz: ${OUT} | ${nevek.length} oldal`);
