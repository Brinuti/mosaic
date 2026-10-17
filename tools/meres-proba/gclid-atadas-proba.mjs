// A Google kattintas-azonositok (gclid / gbraid / wbraid) ATADASA a hirdetesi celoldaltol a foglaloig es a koszonooldalig - ujrafuttathato probaeszkoz
// (Google E2E-teszt elokeszitese, #167 6240109548 (b) pont). FOGLALAST NEM ADUNK LE: a Salonic adatlap (iframe) helyett a Salonic atiranyitasa fut
// (a meres-proba.mjs `--mod szim` mintajara), a kimeno meresi kerelmek (Google Ads, GA4, stape, Meta, TikTok, Zapier) es MINDEN POST tiltva es naplozva
// (tilt.mjs). A Salonic naptar-API-ra csak olvaso GET megy (az eles Salonicra); az adatlap (guestData) SOSEM toltodik be (nincs idopont-tartas).
//
//   node tools/meres-proba/gclid-atadas-proba.mjs [--forgatokonyv mind|lezer,oxigen1,...] [--oldal /utvonal] [--bazis https://www.mosaicheadspa.hu]
//        [--dist <abszolut dist-mappa>] [--mobil 1] [--lepesek a,b,c,d,e,f] [--sutik nincs-dontes|elfogad|elutasit] [--out napló.json] [--md eredmeny.md]
//
//   --forgatokonyv  lezer | oxigen1 | oxigen0 | fodrasz-konzult | fodrasz-festes | pmu-smink | pmu-szaj | intim | hajvizsgalat | evelin-uj  (vagy mind: az elso 7)
//   --oldal         a forgatokonyv landing-cimenek felulirasa (pl. egy uj oldal)
//   --dist          a helyi dist/ az ELES hostnev alatt (meg nem deployolt oldalak); dist nelkul az eles / --bazis oldal. A PR-elonezeten (*.pages.dev) a suti.js NEM tolt
//                   meroket (csak a mosaicheadspa.hu-n), ezert ott a Google-cimke / _gcl_aw lepesek "N/A"
//   --lepesek       a = landing (mh_attr, _gcl_aw), b = CTA -> foglalo-reteg, c = kozvetlen /foglalo-motor belepes, d = masik oldalrol (URL gclid nelkul),
//                   e = a teljes ut a szimulalt koszonooldalig (landing-rol), g = ugyanez a masik oldalrol, h = kozvetlen /foglalo-motor belepes a koszonooldalig, f = atiranyitasok (query megmarad-e)   (alap: mind)
//   --sutik         a latogato sutihozzajarulasa: nincs-dontes (ALAP: friss hirdetesi latogato, az alapertek: marketing = granted), elfogad, elutasit
//
// Besorolas: OK | ISMERT_RES (a mai viselkedes dokumentalt hianyossaga: a mérési oldal latja, nem bukik el) | MEGFIGYELES (informacio) | HIBA (varatlan elteres:
// a kilepesi kod 1) | N/A. A teszt-azonositok legalabb 10 karakteresek (az attribucio.js MINTA: /^[A-Za-z0-9_-]{10,200}$/ - a rovidebbet ELDOBJA).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';
import { utvonal } from '../../netlify/lib/utvonal.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), DIST = arg('dist', ''), MOBIL = arg('mobil', '0') === '1';
const SUTIK = arg('sutik', 'nincs-dontes'), OUT = arg('out', 'gclid-atadas-naplo.json'), MD = arg('md', '');
const LEPESEK = new Set(arg('lepesek', 'a,b,c,d,e,f,g,h').split(','));
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ELES_HOST = /^(www\.)?mosaicheadspa\.hu$/.test(new URL(BAZIS).hostname); // a mero-kod (suti.js) csak itt fut
const MERES_FUT = ELES_HOST || !!DIST; // dist: az eles hostnev alatt szolgaljuk ki
const ua = MOBIL ? UA_MOBIL : UA;
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

// --- forgatokonyvek: a 4 uzletag belepesi pontja a brief szerinti CTA-parameterekkel ----------------------------------------------------------------------------
// elvart: a CTA-hoz tartozo /foglalo-motor parameterek (brief: "csak vegleges, mukodo parameterekkel"); valasztas: a foglalo kerdeseire valasztando kartyak (meres-proba mintaja);
// sim: a szimulalt Salonic-atiranyitas (koszonooldal + parameterek) - csak az atiranyitas formaja szimulalt, foglalas nincs
const SIM = {
  lezer: { ut: '/elysion-ok', first: true, service: 'ARC - Teljes arc', category: 'Végleges Szőrtelenítés - 1. Alkalom', price: 27000, location: 'Mosaic Elysion', employee: 'Elysion Pro Szőrtelenítés', employeeId: 32417, placeId: 14586, serviceId: 0 },
  oxigen1: { ut: '/oxigenterapia-ok', first: true, service: 'Haj Oxigénterápia - 1. alkalom', category: 'Oxigénterápia - 1. alkalom', price: 29900, location: 'Mosaic Oxigén', employee: 'Menyhárt Móni', employeeId: 32969, placeId: 14409, serviceId: 466110 },
  hair: { ut: '/fodrasz-ok', first: true, service: 'Fodrász konzultáció', category: 'Ingyenes Fodrász konzultáció', price: 0, location: 'Mosaic Hair', employee: 'Evelin', employeeId: 25095, placeId: 10823, serviceId: 232804 },
  pmu: { ut: '/pmu-ok', first: true, service: 'Szájtetoválás', category: 'PMU', price: 99000, location: 'Mosaic PMU', employee: 'Töreki Melitta', employeeId: 0, placeId: 0, serviceId: 0 },
};
const FOGLALO = (q) => '/foglalo-motor?' + q;
const SZENARIOK = {
  lezer: { nev: 'Lézer – ingyenes konzultáció', uzletag: 'laser', landing: '/lezeres-szortelenites-budapest', elvart: 'business=laser&service=konzult', valasztas: ['Ingyenes konzultációt kérek'], sim: SIM.lezer },
  oxigen1: { nev: 'Oxigén – hajkamerás vizsgálat (466147)', uzletag: 'oxygen', landing: '/oxigenterapia-budapest', elvart: 'business=oxygen&service=466147', valasztas: ['Mindegy'], sim: { ...SIM.oxigen1, service: 'Hajkamerás vizsgálat', price: 4990, serviceId: 466147 } },
  oxigen0: { nev: 'Oxigén – első kezelés (466110)', uzletag: 'oxygen', landing: '/oxigenterapia-budapest', elvart: 'business=oxygen&service=466110', valasztas: ['Mindegy'], sim: SIM.oxigen1 },
  'fodrasz-konzult': { nev: 'Fodrász – Evelin ingyenes konzultáció', uzletag: 'hair', landing: '/noi-hajfestes-budapest', elvart: 'business=hair&staff=evelin&service=konzultacio', valasztas: ['Mindegy', 'Ingyenes konzultáció', 'Nem tudom'], sim: SIM.hair },
  'fodrasz-festes': { nev: 'Fodrász – Evelin festés (category=color)', uzletag: 'hair', landing: '/noi-hajfestes-budapest', elvart: 'business=hair&staff=evelin&category=color', valasztas: ['Mindegy', 'Közepes haj', 'Közepes', 'Hajfestés', 'Festés', 'Nem tudom'], sim: SIM.hair },
  'pmu-smink': { nev: 'PMU – /sminktetovalas-budapest (beágyazott foglaló)', uzletag: 'pmu', landing: '/sminktetovalas-budapest', pmu: true, sim: SIM.pmu },
  'pmu-szaj': { nev: 'PMU – /szajtetovalas-budapest (beágyazott foglaló)', uzletag: 'pmu', landing: '/szajtetovalas-budapest', pmu: true, sim: SIM.pmu },
};
// uj, meg nem elo oldalak (a masik forkok): ugyanaz a belepesi pont, mas landing
SZENARIOK.intim = { ...SZENARIOK.lezer, nev: 'Új: /intim-lezeres-szortelenites-budapest', landing: '/intim-lezeres-szortelenites-budapest' };
SZENARIOK.hajvizsgalat = { ...SZENARIOK.oxigen1, nev: 'Új: /hajvizsgalat-budapest', landing: '/hajvizsgalat-budapest' };
SZENARIOK['evelin-uj'] = { ...SZENARIOK['fodrasz-konzult'], nev: 'Új: /noi-hajfestes-budapest-uj', landing: '/noi-hajfestes-budapest-uj' };
const ALAP_LISTA = ['lezer', 'oxigen1', 'oxigen0', 'fodrasz-konzult', 'fodrasz-festes', 'pmu-smink', 'pmu-szaj'];
const KIVALASZTOTT = arg('forgatokonyv', 'mind') === 'mind' ? ALAP_LISTA : arg('forgatokonyv', '').split(',').filter(Boolean);
for (const k of KIVALASZTOTT) if (!SZENARIOK[k]) { console.error('ismeretlen forgatokonyv: ' + k); process.exit(2); }

// --- teszt-azonositok: legalabb 10 karakter, forgatokonyvenkent kulonbozo ----------------------------------------------------------------------------------------
const ber = Date.now().toString(36).toUpperCase();
const azon = (id) => { const s = id.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); return { gclid: `TESZTGCLID${s}${ber}`, gbraid: `TESZTGBRAID${s}${ber}`, wbraid: `TESZTWBRAID${s}${ber}` }; };
const KLIKK = (a) => `gclid=${a.gclid}&gbraid=${a.gbraid}&wbraid=${a.wbraid}&utm_source=google&utm_medium=cpc&utm_campaign=gclid-atadas-proba`;
const KULCSOK = ['gclid', 'gbraid', 'wbraid'];
// A booking_* dataLayer-esemenyek ket csatornaja: a TRACKER (tracking.js: ...ctx.attribution, a gclid / fbclid / ttclid / utm_* rajta van) es a LEPES-MERES (lepes-meres.js:
// GA4-ba megy, a kattintas-azonositot NEM hordozza: azt a GA4 az oldal URL-jebol / sutibol veszi). A kettot kulon vizsgaljuk.
const LEPES_ESEMENY = new Set(['booking_open', 'booking_business', 'booking_service', 'booking_slots_loaded', 'booking_slot', 'booking_form_start', 'booking_submit', 'booking_success', 'booking_close', 'booking_error']);

// --- kimeno meres: naplozas + tiltas (tilt.mjs), a Salonic-adatlap helyett a szimulalt atiranyitas -----------------------------------------------------------------
let fajlUtvonal = null;
if (DIST) {
  const DIST_ABS = path.resolve(DIST);
  fajlUtvonal = (ut, ua2) => { const d = utvonal(ut, ua2); if (d && d.atiranyit) return { atiranyit: d.atiranyit }; let f = d ? d.atir : ut; if (!path.extname(f)) f += '.html'; return { fajl: path.join(DIST_ABS, f) }; };
}
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const sorok = [], eredmenyek = [];
const jegyez = (sz, lepes, allapot, cimke, bizonyiték = '') => { sorok.push({ sz, lepes, allapot, cimke, bizonyiték: String(bizonyiték).slice(0, 600) }); const j = { OK: 'OK   ', ISMERT_RES: 'RES  ', MEGFIGYELES: 'INFO ', HIBA: 'HIBA ', 'N/A': 'N/A  ' }[allapot]; console.log(`${j}[${sz}/${lepes}] ${cimke}${bizonyiték ? ' | ' + String(bizonyiték).slice(0, 200) : ''}`); };

async function ujKontextus(sc, sim) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  if (SUTIK !== 'nincs-dontes') await ctx.addInitScript((elfogad) => { try { if (/(^|\.)mosaicheadspa\.hu$/.test(location.hostname) && !localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: elfogad, ana: elfogad, adv: elfogad })); } catch (e) { /* nem baj */ } }, SUTIK === 'elfogad');
  const naplo = [], idovonal = [];
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    // 1) a meg nem deployolt valtozat: az eles hostnev oldalai a helyi dist/-bol
    if (DIST && u.origin === BAZIS && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || ua);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
        let body = fs.readFileSync(e.fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    // 2) a Salonic adatlap (iframe) helyett a Salonic atiranyitasa a koszonooldalra (foglalas nem jon letre, a valodi adatlap SOSEM toltodik be)
    if (sim && u.hostname.endsWith('.salonic.hu') && u.pathname.startsWith('/guestData') && req.resourceType() === 'document' && req.frame().parentFrame()) {
      const q = u.searchParams, start = q.get('startDate') || '1', sid = q.get('serviceId') || String(sim.serviceId);
      const bookingUrl = `https://${u.hostname}/guestData/?anyone=true&employeeId=${sim.employeeId}&placeId=${sim.placeId}&serviceId=${sid}&startDate=${start}&back=${q.get('back') || ''}`;
      const p = new URLSearchParams({ first_booking: String(sim.first), service: sim.service, category: sim.category, price: String(sim.price), location: sim.location, employee: sim.employee, g: 'g:SZIM' + start, bookingUrl });
      const cel = `${BAZIS}${sim.ut}?${p.toString()}`;
      idovonal.push({ esemeny: 'szimulalt Salonic-atiranyitas', cel });
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: `<!doctype html><meta charset="utf-8"><script>location.replace(${JSON.stringify(cel)});</script>` });
    }
    // 3) a foglalasi jegyzettomb irasa tiltott (a proba ne keruljon a valodi "N perce foglaltak" sorba)
    if (esemenyIras(url, req.method())) return route.fulfill(esemenyUres());
    // 4) kimeno meres / MINDEN POST / ami nincs az engedelyezett listan: naplozzuk (torzzsel egyutt), es NEM engedjuk ki
    const plat = platformOf(url) || (engedett(url, req.method()) ? null : (u.origin === BAZIS && req.method() === 'GET' ? null : 'ismeretlen-tiltott'));
    if (plat) {
      const b = req.postData();
      naplo.push({ plat, metodus: req.method(), host: u.host, ut: u.pathname, url: url.slice(0, 5000), body: b ? b.slice(0, 8000) : null, kep: req.resourceType(), fo: (() => { try { const f = req.frame(); return f === f.page().mainFrame(); } catch (e) { return null; } })() });
      return route.fulfill(ures(req));
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) idovonal.push({ esemeny: 'navigacio', url: f.url().slice(0, 300) }); });
  page.on('pageerror', (e) => idovonal.push({ esemeny: 'oldalhiba', uzenet: String(e.message).slice(0, 200) }));
  return { ctx, page, naplo, idovonal };
}

// --- bizonyitek-gyujtes ----------------------------------------------------------------------------------------------------------------------------------------
const kiolvas = (page) => page.evaluate(() => {
  const o = { url: location.pathname + location.search, mh_attr: null, pillanatkep: null, mh_cc: null, sutik: [], dataLayer: [] };
  try { const a = JSON.parse(localStorage.getItem('mh_attr')); o.mh_attr = a && a.google ? Object.fromEntries(Object.entries(a.google).map(([k, v]) => [k, v && v.ertek])) : (a ? {} : null); } catch (e) { o.mh_attr = 'hiba'; }
  try { const g = window.mhAttribucio && window.mhAttribucio.pillanatkep().google; o.pillanatkep = g ? Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v && v.ertek])) : (window.mhAttribucio ? {} : 'nincs mhAttribucio'); } catch (e) { o.pillanatkep = 'hiba'; }
  try { o.mh_cc = localStorage.getItem('mh_cc'); } catch (e) { /* */ }
  o.sutik = document.cookie.split('; ').filter((c) => /^_gc|^_ga/.test(c)).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1)).slice(0, 120)]; });
  try { o.dataLayer = (window.dataLayer || []).filter((e) => e && typeof e.event === 'string' && /^booking_/.test(e.event)).map((e) => ({ ...e })); } catch (e) { /* */ }
  return o;
});
const egyezik = (obj, a) => !!obj && typeof obj === 'object' && KULCSOK.every((k) => obj[k] === a[k]);
const urlBan = (url, a) => { try { const q = new URL(url, BAZIS).searchParams; return KULCSOK.every((k) => q.get(k) === a[k]); } catch (e) { return false; } };
const urlSzamlal = (url, a) => { try { const q = new URL(url, BAZIS).searchParams; return KULCSOK.filter((k) => q.get(k) === a[k]); } catch (e) { return []; } };
const megjelenik = (naplo, a, plat) => naplo.filter((n) => (!plat || n.plat === plat) && KULCSOK.some((k) => (n.url + (n.body || '')).includes(a[k]))).length;
const cookieErtek = (sutik, re) => (sutik.find(([n]) => re.test(n)) || [null, ''])[1];

async function landingBetolt(page, sz, a, utv, felvezet = '') {
  await page.goto(BAZIS + utv + '?' + KLIKK(a), { waitUntil: 'domcontentloaded', ...(felvezet ? { referer: felvezet } : {}) });
  await page.waitForFunction(() => typeof window.openBooking === 'function' || document.readyState === 'complete', null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(MERES_FUT ? 7000 : 3000); // a Google-cimke / GTM betoltese
}
// a CTA: a landing foglalo-linkjei (a /foglalo-motor linkek + data-booking), kozuluk a forgatokonyv szerinti parameterekkel
async function ctaLista(page) {
  return page.evaluate(() => [...document.querySelectorAll('a[href*="foglalo-motor"], [data-booking]')].map((e, i) => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e), lathato = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    const d = e.getAttribute('data-booking'); let q = '';
    if (d) { try { q = d.trim().startsWith('{') ? new URLSearchParams(JSON.parse(d)).toString() : d; } catch (x) { q = d; } } else { try { q = new URL(e.getAttribute('href'), location.href).search.replace(/^\?/, ''); } catch (x) { q = ''; } }
    return { i, q, lathato, szoveg: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50), fej: !!e.closest('header, #SITE_HEADER'), lab: !!e.closest('footer, #SITE_FOOTER') };
  }));
}
const kozosParam = (q, elvart) => { const a = new URLSearchParams(q), b = new URLSearchParams(elvart); return [...b].every(([k, v]) => a.get(k) === v); };
async function ctaKatt(page, sc) {
  const lista = await ctaLista(page);
  const talalat = lista.filter((c) => c.lathato && !c.fej && !c.lab && kozosParam(c.q, sc.elvart));
  const tart = lista.filter((c) => c.lathato && !c.fej && !c.lab && new URLSearchParams(c.q).get('business') === new URLSearchParams(sc.elvart).get('business'));
  const valasztott = talalat[0] || tart[0] || null;
  if (valasztott) await page.locator('a[href*="foglalo-motor"], [data-booking]').nth(valasztott.i).evaluate((e) => { e.removeAttribute('target'); e.scrollIntoView({ block: 'center' }); });
  if (valasztott) await page.locator('a[href*="foglalo-motor"], [data-booking]').nth(valasztott.i).click();
  return { lista, brief: !!talalat[0], valasztott };
}

// a foglalo vegigjarasa a szimulalt Salonic-atiranyitasig (a meres-proba.mjs --popup mintaja); a koszonooldal a foablakban nyilik
async function utazas(page, sc, gy = '#mosaic-booking-layer') {
  await page.locator(gy + ' .be-title').first().waitFor({ timeout: 30000 });
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1500);
    if (await page.locator('.be-nnap.szabad, ' + gy + ' button:has-text("További időpontok")').count()) break;
    let valasztott = null;
    for (const sz of sc.valasztas || []) {
      const k = page.locator(gy + ' .be-choice, ' + gy + ' .be-list button, ' + gy + ' main button, ' + gy + ' button', { hasText: sz }).filter({ visible: true });
      if (await k.count()) { valasztott = sz; await k.first().click(); break; }
    }
    if (!valasztott && i === 7) throw new Error('nincs valaszthato kartya: ' + ((await page.locator(gy + ' .be-title').first().textContent().catch(() => '')) || '')); // addig megvarjuk (betoltes), hogy a naptar / a kartyak megjelenjenek
  }
  await page.locator('.be-nnap.szabad, ' + gy + ' button:has-text("További időpontok")').first().waitFor({ state: 'visible', timeout: 30000 });
  const szabad = page.locator('.be-nnap.szabad');
  if (await szabad.count()) { await szabad.nth((await szabad.count()) - 1).click(); await page.waitForTimeout(500); const g = page.locator('.be-idogomb'); await g.nth((await g.count()) - 1).click(); }
  else {
    await page.locator(gy + ' button', { hasText: 'További időpontok' }).first().click();
    await page.locator('.be-strip[aria-label="Nap"] .be-chip').first().waitFor({ timeout: 20000 });
    const n = page.locator('.be-strip[aria-label="Nap"] .be-chip'); await n.nth((await n.count()) - 1).click(); await page.waitForTimeout(800);
    const t = page.locator('.be-time'); await t.nth((await t.count()) - 1).click();
  }
  await page.locator(gy + ' button:has-text("Tovább az adatokhoz"), iframe').first().waitFor({ state: 'attached', timeout: 30000 });
  const tov = page.locator(gy + ' button', { hasText: 'Tovább az adatokhoz' });
  if (await tov.count()) await tov.first().click();
  await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 30000 });
  const elotte = await kiolvas(page); // a Salonic-lepes elott: a dataLayer booking_* esemenyei (a koszonooldal betoltesekor a lap ujratoltodik)
  await page.waitForURL((u) => /bookingUrl=/.test(u.toString()) && !u.toString().includes('/foglalo-motor'), { timeout: 90000 });
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForTimeout(MERES_FUT ? 12000 : 4000);
  return { elotte, vegeUrl: page.url() };
}

const koszonoElemzes = (naplo, vegeUrl, a, sz, lepes, varhatoUrl, resSzoveg = 'R1: masik oldalrol nyitott foglalonal a koszonooldal URL-jebol hianyzik a gclid / gbraid / wbraid (a withAttribution a motor win.location.search-et fuzi)') => {
  const urlAzon = urlSzamlal(vegeUrl, a);
  if (varhatoUrl === 'van') jegyez(sz, lepes, urlAzon.length === 3 ? 'OK' : 'HIBA', 'a koszonooldal URL-jeben ott van a gclid + gbraid + wbraid (withAttribution)', 'URL: ' + vegeUrl.replace(BAZIS, '').slice(0, 260) + ' | megvan: ' + urlAzon.join(','));
  else if (varhatoUrl === 'res') jegyez(sz, lepes, urlAzon.length === 3 ? 'OK' : 'ISMERT_RES', resSzoveg, 'megvan az URL-ben: ' + (urlAzon.join(',') || 'semmi'));
  else jegyez(sz, lepes, 'MEGFIGYELES', 'a koszonooldal URL-jeben levo azonositok', 'megvan: ' + (urlAzon.join(',') || 'semmi') + ' | ' + vegeUrl.replace(BAZIS, '').slice(0, 200));
  const konv = naplo.filter((n) => n.plat === 'google-ads' && /\/(pagead|ccm)\/conversion\//.test(n.ut) && n.fo);
  const cimkek = [...new Set(konv.map((n) => { try { return new URL(n.url).searchParams.get('label') || '?'; } catch (e) { return '?'; } }))];
  if (!MERES_FUT) { jegyez(sz, lepes, 'N/A', 'Google Ads konverzios kerelmek (a mero-kod csak az eles hostnev alatt fut)'); }
  else jegyez(sz, lepes, konv.length ? 'OK' : 'MEGFIGYELES', 'Google Ads konverzios kerelem (pagead|ccm /conversion) a koszonooldalon', `${konv.length} kerelem, ${cimkek.length} egyedi cimke: ${cimkek.join(',')}`);
  const hord = KULCSOK.filter((k) => konv.some((n) => (n.url + (n.body || '')).includes(a[k])));
  if (MERES_FUT && konv.length) jegyez(sz, lepes, 'MEGFIGYELES', 'a konverzios kerelmekben (url / ref / gclaw / body) megjeleno teszt-azonositok', hord.join(',') || 'egyik sem kozvetlenul (a Google-cimke a _gcl_aw sutibol / a ref-bol olvas)');
  const refAzon = konv.filter((n) => { try { const r = new URL(n.url).searchParams.get('ref') || ''; return r && KULCSOK.some((k) => r.includes(a[k])); } catch (e) { return false; } }).length;
  if (MERES_FUT && konv.length) jegyez(sz, lepes, refAzon ? 'OK' : 'MEGFIGYELES', 'a konverzios kerelem `ref` (referrer = a landing gclid-es URL-je) tartalmaz teszt-azonositot', `${refAzon}/${konv.length} kerelem`);
  const er = naplo.filter((n) => n.metodus === 'POST' && /\/api\/meres-erkezes/.test(n.url));
  if (!er.length) jegyez(sz, lepes, 'MEGFIGYELES', '/api/meres-erkezes kimeno POST (erkezesi adatok a szervernek) a szimulalt koszonooldalon', 'nem figyelheto meg: a foglalas-kulcs.js csak a motor-foglalas (mb_ azonosito + bookingUrl) vegen kuld, szimulalt modban nem biztos');
  else {
    let attr = null; try { attr = JSON.parse(er[er.length - 1].body).attr; } catch (e) { attr = null; }
    const g = attr && attr.google ? Object.fromEntries(Object.entries(attr.google).map(([k, v]) => [k, v && v.ertek])) : null;
    jegyez(sz, lepes, egyezik(g, a) ? 'OK' : 'HIBA', '/api/meres-erkezes POST torzse: attr.google.{gclid,gbraid,wbraid} egyezik a beadottal (tiltott, nem ment ki)', JSON.stringify(g));
  }
  return { konvDb: konv.length, cimkek, hord };
};

// --- 1 forgatokonyv -------------------------------------------------------------------------------------------------------------------------------------------------
async function futtat(szId) {
  const sc = SZENARIOK[szId], oldal = arg('oldal', '') || sc.landing, a = azon(szId), rec = { szenario: szId, nev: sc.nev, landing: oldal, azonositok: a, lepesek: {} };
  console.log(`\n=== ${szId}: ${sc.nev} | ${BAZIS}${oldal} ===`);
  // --- A: landing -> elmentodes -----------------------------------------------------------------------------------------------------------------------------------
  if (LEPESEK.has('a')) {
    const k = await ujKontextus(sc, null);
    try {
      await landingBetolt(k.page, szId, a, oldal);
      const e = await kiolvas(k.page); rec.lepesek.a = { ...e, dataLayer: undefined, google_kerelmek: k.naplo.filter((n) => n.plat === 'google-ads').length };
      jegyez(szId, 'a', egyezik(e.mh_attr, a) ? 'OK' : 'HIBA', 'landing: mh_attr (localStorage) tartalmazza a gclid + gbraid + wbraid erteket', JSON.stringify(e.mh_attr));
      jegyez(szId, 'a', egyezik(e.pillanatkep, a) ? 'OK' : 'HIBA', 'window.mhAttribucio.pillanatkep().google egyezik', JSON.stringify(e.pillanatkep));
      jegyez(szId, 'a', 'MEGFIGYELES', 'sutihozzajarulas allapota', `mh_cc=${e.mh_cc || 'nincs dontes (alapertek: marketing=granted)'} | mod: ${SUTIK}`);
      if (MERES_FUT) {
        const aw = cookieErtek(e.sutik, /^_gcl_aw$/);
        jegyez(szId, 'a', aw.includes(a.gclid) ? 'OK' : 'HIBA', 'a Google-cimke _gcl_aw sutije tartalmazza a gclid-et', aw.slice(0, 80) || 'nincs _gcl_aw');
        jegyez(szId, 'a', e.sutik.some(([n, v]) => /^_gcl_(gb|ag|gs)/.test(n) && (v.includes(a.gbraid) || v.includes(a.wbraid))) ? 'OK' : 'MEGFIGYELES', 'gbraid / wbraid suti (_gcl_gb / _gcl_ag / _gcl_gs) a Google-cimketol', e.sutik.filter(([n]) => /^_gcl/.test(n)).map(([n]) => n).join(','));
        jegyez(szId, 'a', rec.lepesek.a.google_kerelmek ? 'OK' : 'HIBA', 'a Google-cimke fut a landingen (kimeno kerelem naplozva, tiltva)', rec.lepesek.a.google_kerelmek + ' kerelem');
        const db = (pl) => k.naplo.filter((n) => n.plat === pl).length;
        jegyez(szId, 'a', 'MEGFIGYELES', 'mely mero-kodok futnak a landingen (kimeno kerelmek szama platformonkent; a Meta-pixel / TikTok-pixel az oldal-listakon (suti.js PIXEL_*) mulik)', `Google Ads ${db('google-ads')} | GA4/stape ${db('stape') + db('ga4')} | Meta ${db('meta')} | TikTok ${db('tiktok')}`);
      } else jegyez(szId, 'a', 'N/A', '_gcl_aw / Google-cimke: PR-elonezeten a mero-kod nem fut (csak a mosaicheadspa.hu-n) - hasznalj --dist-et');
    } catch (e) { jegyez(szId, 'a', 'HIBA', 'landing betoltese', String(e.message).slice(0, 200)); }
    await k.ctx.close();
  }
  // --- b: CTA -> foglalo-reteg (vagy PMU: a beagyazott foglalo) -----------------------------------------------------------------------------------------------------
  if (LEPESEK.has('b') && !sc.pmu) {
    const k = await ujKontextus(sc, null);
    try {
      await landingBetolt(k.page, szId, a, oldal);
      const c = await ctaKatt(k.page, sc);
      rec.lepesek.b = { cta_lista: c.lista, valasztott: c.valasztott };
      jegyez(szId, 'b', c.brief ? 'OK' : 'MEGFIGYELES', 'a landingen van olyan foglalo-CTA, amelynek parameterei a brief szerintiek (' + sc.elvart + ')', c.brief ? c.valasztott.q : 'nincs; az oldal CTA-i: ' + [...new Set(c.lista.filter((x) => x.lathato && !x.fej && !x.lab).map((x) => x.q))].join(' | '));
      if (!c.valasztott) { jegyez(szId, 'b', 'HIBA', 'nincs latható foglalo-CTA az uzletaghoz'); }
      else {
        await k.page.locator('#mosaic-booking-layer .be-title').first().waitFor({ timeout: 30000 });
        await k.page.waitForTimeout(2500);
        const e = await kiolvas(k.page); rec.lepesek.b.utan = { url: e.url, dataLayer: e.dataLayer };
        jegyez(szId, 'b', 'OK', 'a foglalo-reteg megnyilt a CTA-ra (ugyanazon az oldalon)', e.url.slice(0, 160));
        jegyez(szId, 'b', urlBan(e.url, a) ? 'OK' : 'HIBA', 'a reteg URL-jeben ott van a gclid + gbraid + wbraid (a motor ebbol kapja a kontextust)', e.url.slice(0, 200));
        const dlT = e.dataLayer.filter((x) => !LEPES_ESEMENY.has(x.event)), dlL = e.dataLayer.filter((x) => LEPES_ESEMENY.has(x.event)); const dl = dlT; const dlG = dlT.filter((x) => x.gclid === a.gclid).length;
        jegyez(szId, 'b', dlT.length && dlG === dlT.length ? 'OK' : (dlT.length ? 'HIBA' : 'MEGFIGYELES'), 'a tracker-esemenyeken (tracking.js: booking_service_selected, booking_slot_viewed ...) a gclid egyezik a beadottal', `${dlG}/${dlT.length} esemeny: ${[...new Set(dlT.map((x) => x.event))].join(',')}`);
        jegyez(szId, 'b', 'MEGFIGYELES', 'a lepes-meres esemenyei (lepes-meres.js: booking_open, booking_business, booking_service, booking_slots_loaded ...) tervbol nem hordoznak kattintas-azonositot (a GA4 az oldal URL-jebol / sutibol veszi)', `${dlL.length} esemeny, gclid-del: ${dlL.filter((x) => x.gclid).length}`);
        jegyez(szId, 'b', dl.some((x) => 'gbraid' in x || 'wbraid' in x) ? 'OK' : 'ISMERT_RES', 'R2: a gbraid / wbraid NEM kerul a booking_* dataLayer-esemenyekbe (a flow.js parseContext csak a gclid / fbclid / ttclid / utm_* mezoket veszi at); a koszonooldal URL-jebe a withAttribution fuzi', 'esemeny-kulcsok: ' + [...new Set(dl.flatMap((x) => Object.keys(x)))].filter((x) => /clid|braid|utm/.test(x)).join(','));
        jegyez(szId, 'b', MERES_FUT ? (megjelenik(k.naplo, a, 'stape') ? 'OK' : 'MEGFIGYELES') : 'N/A', 'a stape / GA4 kimeno kerelmekben megjelenik a teszt-azonosito (booking_open ...)', megjelenik(k.naplo, a, 'stape') + ' kerelem; stape osszes: ' + k.naplo.filter((n) => n.plat === 'stape').length);
      }
    } catch (e) { jegyez(szId, 'b', 'HIBA', 'CTA -> reteg', String(e.message).slice(0, 220)); }
    await k.ctx.close();
  }
  // --- c: kozvetlen belepes a /foglalo-motor oldalra (a hirdetes kozvetlenul a foglalora mutat) ----------------------------------------------------------------------
  if (LEPESEK.has('c') && !sc.pmu) {
    const k = await ujKontextus(sc, null);
    try {
      const url = BAZIS + '/foglalo-motor?' + sc.elvart + '&' + KLIKK(a);
      await k.page.goto(url, { waitUntil: 'domcontentloaded' });
      await k.page.locator('main section, #mosaic-booking-layer .be-title, .be-title').first().waitFor({ timeout: 30000 }).catch(() => {});
      await k.page.waitForTimeout(MERES_FUT ? 8000 : 3500);
      const e = await kiolvas(k.page); rec.lepesek.c = { url: e.url, mh_attr: e.mh_attr, dataLayer: e.dataLayer };
      jegyez(szId, 'c', urlBan(e.url, a) ? 'OK' : 'HIBA', 'kozvetlen /foglalo-motor belepes: az URL megtartja a gclid + gbraid + wbraid erteket', e.url.slice(0, 200));
      jegyez(szId, 'c', egyezik(e.mh_attr, a) ? 'OK' : 'MEGFIGYELES', 'kozvetlen belepes: az attribucio.js elmentette (mh_attr)', JSON.stringify(e.mh_attr));
      const dl = e.dataLayer.filter((x) => !LEPES_ESEMENY.has(x.event)), dlG = dl.filter((x) => x.gclid === a.gclid).length;
      jegyez(szId, 'c', dl.length && dlG === dl.length ? 'OK' : (dl.length ? 'HIBA' : 'MEGFIGYELES'), 'a tracker-esemenyeken a gclid egyezik', `${dlG}/${dl.length}`);
      jegyez(szId, 'c', 'MEGFIGYELES', 'R4: a /foglalo-motor oldalon csak az attribucio.js tolt (nincs suti.js / Google-cimke): nincs _gcl_aw suti, es a mh_attr-ot az attribucio.js hozzajarulas-dontes nelkul nem irja (memoriabeli pillanatkep marad); a gclid az URL-ben utazik (withAttribution a koszonooldal URL-jebe, lasd h)', '_gcl_aw: ' + (cookieErtek(e.sutik, /^_gcl_aw$/).slice(0, 60) || 'nincs') + ' | mh_attr: ' + JSON.stringify(e.mh_attr) + ' | pillanatkep: ' + JSON.stringify(e.pillanatkep));
    } catch (e) { jegyez(szId, 'c', 'HIBA', 'kozvetlen /foglalo-motor belepes', String(e.message).slice(0, 220)); }
    await k.ctx.close();
  }
  // --- d: masik oldalrol nyitva (az URL-ben nincs gclid): mi marad meg ------------------------------------------------------------------------------------------------
  if (LEPESEK.has('d') && !sc.pmu) {
    const k = await ujKontextus(sc, null);
    try {
      await landingBetolt(k.page, szId, a, oldal);
      await k.page.goto(BAZIS + oldal, { waitUntil: 'domcontentloaded', referer: BAZIS + oldal + '?' + KLIKK(a) }); // ugyanaz az oldal, de a hirdetesi paraméterek nelkul (belso navigacio)
      await k.page.waitForTimeout(MERES_FUT ? 5000 : 2500);
      const c = await ctaKatt(k.page, sc);
      if (!c.valasztott) jegyez(szId, 'd', 'HIBA', 'nincs foglalo-CTA a masodik oldalbetolteskor');
      else {
        await k.page.locator('#mosaic-booking-layer .be-title').first().waitFor({ timeout: 30000 }); await k.page.waitForTimeout(2000);
        const e = await kiolvas(k.page); rec.lepesek.d = { url: e.url, mh_attr: e.mh_attr, sutik: e.sutik, dataLayer: e.dataLayer };
        jegyez(szId, 'd', 'OK', 'a gclid-es landing utan, az azonositok nelkuli oldalbetoltesnel a mh_attr (localStorage) megvan', JSON.stringify(e.mh_attr));
        if (!egyezik(e.mh_attr, a)) jegyez(szId, 'd', 'HIBA', 'a mh_attr elveszett a masodik oldalbetoltesnel', JSON.stringify(e.mh_attr));
        if (MERES_FUT) jegyez(szId, 'd', cookieErtek(e.sutik, /^_gcl_aw$/).includes(a.gclid) ? 'OK' : 'HIBA', 'a _gcl_aw suti megvan a masodik oldalbetoltesnel (a Google-cimke ebbol olvassa a gclid-et)', cookieErtek(e.sutik, /^_gcl_aw$/).slice(0, 80));
        jegyez(szId, 'd', urlBan(e.url, a) ? 'OK' : 'ISMERT_RES', 'R1: az azonositok nelkuli oldalon nyitott foglalo-reteg URL-je / motor-kontextusa NEM hordozza a gclid-et (a motor ctx.attribution az URL-bol jon; a mh_attr-ot a motor nem olvassa)', 'URL: ' + e.url.slice(0, 120));
        const dl = e.dataLayer.filter((x) => !LEPES_ESEMENY.has(x.event)); jegyez(szId, 'd', dl.some((x) => x.gclid === a.gclid) ? 'OK' : 'ISMERT_RES', 'R1: a tracker-esemenyeken nincs gclid', `${dl.filter((x) => x.gclid).length}/${dl.length} esemeny gclid-del`);
      }
    } catch (e) { jegyez(szId, 'd', 'HIBA', 'masik oldalrol nyitas', String(e.message).slice(0, 220)); }
    await k.ctx.close();
  }
  // --- h: kozvetlen /foglalo-motor belepes a szimulalt koszonooldalig (a hirdetes kozvetlenul a foglalora mutat) -----------------------------------------------------------
  if (LEPESEK.has('h') && !sc.pmu) {
    const k = await ujKontextus(sc, sc.sim);
    try {
      await k.page.goto(BAZIS + '/foglalo-motor?' + sc.elvart + '&' + KLIKK(a), { waitUntil: 'domcontentloaded' });
      const u = await utazas(k.page, sc, 'main');
      rec.lepesek.h = { vegeUrl: u.vegeUrl };
      const dlT = u.elotte.dataLayer.filter((x) => !LEPES_ESEMENY.has(x.event)); jegyez(szId, 'h', dlT.length ? 'OK' : 'MEGFIGYELES', 'kozvetlen belepes: a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas)', [...new Set(u.elotte.dataLayer.map((x) => x.event))].join(','));
      rec.lepesek.h.koszono = koszonoElemzes(k.naplo, u.vegeUrl, a, szId, 'h', 'van');
      const el = await kiolvas(k.page).catch(() => null);
      if (el && MERES_FUT) jegyez(szId, 'h', cookieErtek(el.sutik, /^_gcl_aw$/).includes(a.gclid) ? 'OK' : 'MEGFIGYELES', 'a koszonooldalon a Google-cimke az URL-bol _gcl_aw sutit allit a gclid-del', cookieErtek(el.sutik, /^_gcl_aw$/).slice(0, 80) || 'nincs');
      if (el) jegyez(szId, 'h', egyezik(el.mh_attr, a) ? 'OK' : 'MEGFIGYELES', 'a koszonooldalon az attribucio.js a gclid-et elmentette (mh_attr: a suti.js alapertek-hozzajarulasa utan)', JSON.stringify(el.mh_attr));
    } catch (e) { jegyez(szId, 'h', 'HIBA', 'kozvetlen belepes a koszonooldalig', String(e.message).slice(0, 220)); }
    await k.ctx.close();
  }
  // --- e / g: a teljes ut a szimulalt koszonooldalig (landing-rol / masik oldalrol) -----------------------------------------------------------------------------------
  for (const [lepes, masik] of [['e', false], ['g', true]]) {
    if (!LEPESEK.has(lepes) || sc.pmu) continue;
    const k = await ujKontextus(sc, sc.sim);
    try {
      await landingBetolt(k.page, szId, a, oldal);
      if (masik) { await k.page.goto(BAZIS + oldal, { waitUntil: 'domcontentloaded', referer: BAZIS + oldal + '?' + KLIKK(a) }); await k.page.waitForTimeout(MERES_FUT ? 5000 : 2500); }
      const c = await ctaKatt(k.page, sc);
      if (!c.valasztott) { jegyez(szId, lepes, 'HIBA', 'nincs foglalo-CTA'); await k.ctx.close(); continue; }
      const u = await utazas(k.page, sc);
      rec.lepesek[lepes] = { vegeUrl: u.vegeUrl, idovonal: k.idovonal.slice(-8) };
      const el = await kiolvas(k.page).catch(() => null);
      const dl = u.elotte.dataLayer; jegyez(szId, lepes, dl.length ? 'OK' : 'MEGFIGYELES', 'a foglalo vegigjarva a Salonic-lepesig (szimulalt atiranyitas)', [...new Set(dl.map((x) => x.event))].join(','));
      const kv = koszonoElemzes(k.naplo, u.vegeUrl, a, szId, lepes, masik ? 'res' : 'van');
      rec.lepesek[lepes].koszono = kv;
      if (el) jegyez(szId, lepes, egyezik(el.mh_attr, a) ? 'OK' : 'MEGFIGYELES', 'a koszonooldalon a mh_attr (localStorage) megvan', JSON.stringify(el.mh_attr));
      if (MERES_FUT && el) jegyez(szId, lepes, cookieErtek(el.sutik, /^_gcl_aw$/).includes(a.gclid) ? 'OK' : 'HIBA', 'a koszonooldalon a _gcl_aw suti megvan a gclid-del', cookieErtek(el.sutik, /^_gcl_aw$/).slice(0, 80));
    } catch (e) { jegyez(szId, lepes, 'HIBA', 'a teljes ut a koszonooldalig', String(e.message).slice(0, 220)); }
    await k.ctx.close();
  }
  // --- PMU: a beagyazott foglalo (a launcher nem fogja); a siker utan a foglalo-pmu.js a TOP ablakot navigalja a Salonic altal adott URL-re (+mh_proba=pmu) ---------------------------------
  if (sc.pmu && (LEPESEK.has('b') || LEPESEK.has('e'))) {
    const k = await ujKontextus(sc, null);
    try {
      await landingBetolt(k.page, szId, a, oldal);
      await k.page.waitForTimeout(1500);
      const keretek = await k.page.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src') || f.src || '').filter(Boolean));
      const pmuKeret = keretek.filter((s) => /foglalo-pmu/.test(s));
      rec.lepesek.b = { keretek: pmuKeret };
      jegyez(szId, 'b', pmuKeret.length ? 'OK' : 'MEGFIGYELES', 'a beagyazott PMU-foglalo (foglalo-pmu keret) az oldalon', pmuKeret.join(' | ') || 'nincs keret a betoltes utan (lehet, hogy gorgetesre / kattintasra toltodik)');
      jegyez(szId, 'b', pmuKeret.some((s) => KULCSOK.some((q) => s.includes(a[q]))) ? 'OK' : 'ISMERT_RES', 'R3: a PMU beagyazott foglalo kereteben (iframe src) nincs gclid; a foglalo-pmu.js nem kezel kattintas-azonositot (PMU_LIVE_ADAPTER_FINDINGS.md), az attribucio.js keretben nem gyujt (w.top !== w.self)', 'a szulo oldalon a mh_attr megvan (a): a localStorage kozos a keretekkel');
      // a siker utani top-navigacio szimulacioja: a Salonic visszairanyitasa a /pmu-ok oldalra (mh_proba=pmu), azonositok nelkul (a Salonic URL-je + mh_proba)
      const bu = `https://mosaic-pmu.salonic.hu/guestData/?anyone=true&employeeId=${a.gclid.length}&placeId=0&serviceId=0&startDate=1&back=mb_gclidproba0000`;
      const p = new URLSearchParams({ first_booking: 'true', service: SIM.pmu.service, category: SIM.pmu.category, price: String(SIM.pmu.price), location: SIM.pmu.location, employee: SIM.pmu.employee, g: 'g:SZIM1', bookingUrl: bu, mh_proba: 'pmu' });
      const cel = BAZIS + SIM.pmu.ut + '?' + p.toString();
      await k.page.goto(cel, { waitUntil: 'domcontentloaded', referer: BAZIS + oldal + '?' + KLIKK(a) });
      await k.page.waitForLoadState('load').catch(() => {}); await k.page.waitForTimeout(MERES_FUT ? 12000 : 4000);
      const el = await kiolvas(k.page);
      rec.lepesek.e = { vegeUrl: k.page.url() };
      jegyez(szId, 'e', 'MEGFIGYELES', 'PMU: a koszonooldal szimulalt top-navigacioja (a foglalo-pmu.js mhKeretbenOldal ezt teszi: a Salonic URL-je + mh_proba=pmu)', cel.replace(BAZIS, '').slice(0, 160));
      const kv = koszonoElemzes(k.naplo, k.page.url(), a, szId, 'e', 'res', 'R3: PMU beagyazott ut: a koszonooldal URL-jeben nincs gclid / gbraid / wbraid (a foglalo-pmu.js a Salonic altal adott URL-re navigalja a top ablakot + mh_proba=pmu; nincs withAttribution); a mh_attr / _gcl_aw / referrer megvan');
      rec.lepesek.e.koszono = kv;
      jegyez(szId, 'e', egyezik(el.mh_attr, a) ? 'OK' : 'HIBA', 'PMU koszonooldal: a mh_attr (localStorage) megvan', JSON.stringify(el.mh_attr));
      if (MERES_FUT) jegyez(szId, 'e', cookieErtek(el.sutik, /^_gcl_aw$/).includes(a.gclid) ? 'OK' : 'HIBA', 'PMU koszonooldal: _gcl_aw suti a gclid-del', cookieErtek(el.sutik, /^_gcl_aw$/).slice(0, 80));
    } catch (e) { jegyez(szId, 'b', 'HIBA', 'PMU-ut', String(e.message).slice(0, 220)); }
    await k.ctx.close();
  }
  eredmenyek.push(rec);
}

// --- f: atiranyitasok - megmarad-e a lekerdezes (gclid) --------------------------------------------------------------------------------------------------------------------
async function atiranyitasok() {
  const a = azon('REDIR'), q = '?' + KLIKK(a), ut = [];
  const esetek = ['/idpontfoglalas', '/mosaic-hair-idopontfoglalas', '/noi-hajfestes-budapest-uj', '/lezeres-szortelenites-budapest-uj', '/contact', '/headspa-budapest/', '/lezeres-szortelenites-budapest.html', '/fodraszat-foglalas'];
  for (const p of esetek) {
    const helyi = utvonal(p.split('?')[0], ua);
    let allapot, cel = null;
    if (ELES_HOST) { // csak olvasas: GET, atiranyitas nelkul
      try { const r = await fetch(BAZIS + p + q, { redirect: 'manual', headers: { 'user-agent': ua } }); allapot = r.status; cel = r.headers.get('location'); } catch (e) { allapot = 'hiba: ' + e.message; }
    } else allapot = helyi && helyi.atiranyit ? '301 (helyi utvonal.js)' : '200 (helyi)';
    const forras = cel || (helyi && helyi.atiranyit ? helyi.atiranyit + '(+functions/[[path]].js hozzafuzi a query-t)' : null);
    const atir = typeof allapot === 'number' ? allapot >= 300 && allapot < 400 : /301/.test(String(allapot));
    ut.push({ p, allapot, cel: forras });
    if (!atir) jegyez('redirect', 'f', 'MEGFIGYELES', p + ' nem atiranyit (a sajat oldala)', 'allapot: ' + allapot);
    else if (cel) jegyez('redirect', 'f', urlSzamlal(cel, a).length === 3 ? 'OK' : 'HIBA', p + ' -> a Location megtartja a gclid + gbraid + wbraid erteket', cel.slice(0, 200));
    else jegyez('redirect', 'f', 'MEGFIGYELES', p + ' atiranyit (helyi utvonal.js; a query hozzafuzese a functions/[[path]].js-ben: eles hoston ellenorizheto)', String(forras).slice(0, 160));
  }
  eredmenyek.push({ szenario: 'redirect', nev: 'Átirányítások (query megmarad-e)', lepesek: { f: ut } });
}

let hiba = 0;
for (const id of KIVALASZTOTT) await futtat(id);
if (LEPESEK.has('f')) await atiranyitasok();
await browser.close();
hiba = sorok.filter((s) => s.allapot === 'HIBA').length;
const ossz = (st) => sorok.filter((s) => s.allapot === st).length;
console.log(`\nOSSZESEN: OK ${ossz('OK')} | ISMERT_RES ${ossz('ISMERT_RES')} | MEGFIGYELES ${ossz('MEGFIGYELES')} | N/A ${ossz('N/A')} | HIBA ${hiba}`);
fs.writeFileSync(OUT, JSON.stringify({ futtatva: new Date().toISOString(), bazis: BAZIS, dist: DIST || null, mobil: MOBIL, sutik: SUTIK, merokod_fut: MERES_FUT, sorok, forgatokonyvek: eredmenyek }, null, 1));
if (MD) {
  const sz = [...new Set(sorok.map((s) => s.sz))];
  const jel = { OK: '✔', ISMERT_RES: 'rés', MEGFIGYELES: 'ℹ', HIBA: '✘', 'N/A': 'n/a' };
  let md = `| Forgatókönyv | Lépés | Állapot | Ellenőrzés |\n|---|---|---|---|\n`;
  for (const s of sorok) md += `| ${s.sz} | ${s.lepes} | ${jel[s.allapot]} | ${s.cimke.replace(/\|/g, '/')} |\n`;
  fs.writeFileSync(MD, md);
}
console.log('naplo: ' + OUT);
process.exit(hiba ? 1 : 0);
