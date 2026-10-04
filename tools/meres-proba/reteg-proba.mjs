// A helyben nyilo foglalo-reteg ellenorzese bongeszoben (Playwright), foglalas nelkul.
//
//   node tools/meres-proba/reteg-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--kepek mappa] [--oldal /booking-test]
//
// Minden belepesi pontnal: a CTA a retegben nyitja a foglalot (nem navigal), a jo kezdo allapotba er, az URL frissul (booking=1), a bezaras / Esc / vissza
// gomb visszaviszi az eredeti cimre, az ujratoltes visszaallitja. A kimeno meres (capig.stape.do is) alapbol tiltva (tilt.mjs).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', KEPEK = arg('kepek', ''), OLDAL = arg('oldal', '/booking-test');
const BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;

// [cimke, a CTA nyitasa (opts), a vart kezdo cim (reszlet), tovabbi ellenorzes]
const BELEPOK = [
  ['altalanos (nincs kontextus)', {}, 'Mit szeretnél foglalni?'],
  ['HeadSpa altalanos', { business: 'headspa' }, 'Hogyan folytatnád?'],
  ['HeadSpa paros', { business: 'headspa', service: 'paros' }, 'Legközelebbi szabad időpontok', 'Páros'],
  ['HeadSpa ajandekkartya-bevaltas', { business: 'headspa', voucher: '1' }, 'Milyen ajándékkártyád van?'],
  ['Fodraszat altalanos', { business: 'hair' }, 'Mit szeretnél?'],
  ['Fodraszat balayage-kategoria', { business: 'hair', service_category: 'balayage' }, 'Melyik kezelés?'],
  ['Fodraszat hajfestes-kategoria', { business: 'hair', service_category: 'color' }, 'Melyik kezelés?'],
  ['Fodraszat konzultacio', { business: 'hair', service: 'konzult' }, 'Legközelebbi szabad időpontok'],
  ['Oxigen altalanos', { business: 'oxygen' }, 'Mit szeretnél foglalni?'],
  ['Oxigen 1. alkalom', { business: 'oxygen', service: '466110' }, 'Legközelebbi szabad időpontok'],
  ['Oxigen 2. alkalomtol', { business: 'oxygen', service: '466158' }, 'Legközelebbi szabad időpontok'],
  ['Lezer altalanos', { business: 'laser' }, null],
  ['Lezer konzultacio', { business: 'laser', service: 'konzult' }, 'Legközelebbi szabad időpontok'],
  ['Lezer elso idopontok', { business: 'laser', intent: 'first' }, 'Melyik területet szeretnéd?'],
  ['Lezer kezeles idopontok', { business: 'laser', intent: 'returning' }, 'Következő kezelés'],
  ['PMU', { business: 'pmu' }, 'PMU-keret'],
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const eredmeny = [];
const merEsem = []; // a FO ablak kimeno meresi kereseit gyujtjuk (a Salonic-keretet nem): a reteg hasznalata nem indithat meresi esemenyt
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben, reszlet }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };

async function ujLap() {
  const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || ua);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
        let body = fs.readFileSync(e.fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS ? null : 'tiltott');
    if (plat) {
      if (req.frame() && req.frame().parentFrame() === null) { const q = Object.fromEntries(u.searchParams); let ev = ''; if (plat === 'meta') ev = new URLSearchParams(req.postData() || '').get('ev') || q.ev || ''; else if (plat === 'tiktok') { try { ev = JSON.parse(req.postData() || '{}').event || ''; } catch (e) { ev = ''; } } else ev = q.en || ''; merEsem.push({ plat, ev: ev || u.pathname.slice(0, 40), ut: u.pathname.slice(0, 40) }); }
      return route.fulfill(ures(req));
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  const hibak = [];
  page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) hibak.push(m.text().slice(0, 160)); });
  return { ctx, page, hibak };
}

const reteg = (page) => page.locator('#mosaic-booking-layer');
// a reteg Shadow DOM-jaban keres (a Playwright locator atlatja a nyitott shadow root-ot)
const cim = (page) => reteg(page).locator('.be-title').first();
async function varCim(page, ido = 25000) { try { await cim(page).waitFor({ timeout: ido }); return (await cim(page).textContent()).trim(); } catch (e) { return null; } }
const url = (page) => new URL(page.url());

async function nyit(page, opts) {
  await page.evaluate((o) => { window.__marker = 'maradt'; window.openBooking(o); }, opts);
}

const { ctx, page, hibak } = await ujLap();
await page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
const eredetiUrl = url(page).pathname + url(page).search;

for (const [cimke, opts, vart, extra] of BELEPOK) {
  await nyit(page, opts);
  let c;
  if (opts.business === 'pmu') {
    const keret = reteg(page).locator('iframe.be-pmu');
    c = (await keret.count()) || (await keret.waitFor({ timeout: 15000 }).then(() => 1).catch(() => 0)) ? 'PMU-keret' : null;
    if (c) ok(cimke + ' | PMU-keret src', /foglalo-pmu\?beagyazva=1/.test(await keret.getAttribute('src')), await keret.getAttribute('src'));
  } else c = await varCim(page);
  const u = url(page);
  const pont = (vart === null && c) || (c && (c.includes(vart)));
  ok(`${cimke} | kezdo allapot`, !!pont, `cim="${c}"`);
  if (extra && opts.business !== 'pmu') { const sav = await reteg(page).locator('.be-svc').first().textContent().catch(() => ''); ok(`${cimke} | szolgaltatas-sav tartalmazza: ${extra}`, new RegExp(extra, 'i').test(sav), sav.trim().slice(0, 60)); }
  ok(`${cimke} | az URL NEM valtozik (a GTM History Change triggerei miatt)`, u.pathname + u.search === eredetiUrl && !u.hash, u.pathname + u.search + u.hash);
  ok(`${cimke} | nincs oldalvaltas`, (await page.evaluate(() => window.__marker)) === 'maradt');
  if (KEPEK && BELEPOK.indexOf(BELEPOK.find((b) => b[0] === cimke)) % 3 === 0) { fs.mkdirSync(KEPEK, { recursive: true }); await page.screenshot({ path: path.join(KEPEK, `${MOBIL ? 'mobil' : 'asztali'}-${cimke.replace(/\W+/g, '-')}.png`) }); }
  // bezaras a X-szel
  await reteg(page).locator('#be-close').click();
  await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  ok(`${cimke} | bezaras (X) -> eredeti cim`, !(await reteg(page).count()) && url(page).pathname + url(page).search === eredetiUrl, url(page).pathname + url(page).search);
}

// --- viselkedes: Esc, vissza gomb, ujratoltes, H0 -> agon -> vissza, fokusz-csapda -------------------------------------------------------
await nyit(page, { business: 'hair' }); await varCim(page);
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
ok('Esc bezarja a retegat', !(await reteg(page).count()) && url(page).search === new URL(BAZIS + eredetiUrl).search);

await nyit(page, { business: 'hair' }); await varCim(page);
await page.goBack();
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
ok('bongeszo vissza gomb bezarja a retegat', !(await reteg(page).count()) && url(page).search === new URL(BAZIS + eredetiUrl).search);

await nyit(page, {}); await varCim(page);
await reteg(page).locator('.be-choice', { hasText: 'Fodrászat' }).click();
ok('H0: Fodraszat -> Mit szeretnel?', (await varCim(page)) === 'Mit szeretnél?' || (await cim(page).textContent()).includes('Mit szeretnél'));
const depth1 = url(page).hash;
await reteg(page).locator('#be-back').click();
ok('H0: fejlec vissza -> szolgaltatas-valaszto', (await varCim(page)) && (await cim(page).textContent()).includes('Mit szeretnél foglalni?'));
await reteg(page).locator('.be-choice', { hasText: 'Lézeres' }).click();
await varCim(page);
await page.goBack();
ok('H0: bongeszo vissza -> szolgaltatas-valaszto', (await cim(page).textContent()).includes('Mit szeretnél foglalni?'));
// fokusz-csapda: Tab sokszor, a fokusz nem hagyja el a retegat
for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
ok('fokusz a retegben marad (Tab)', await page.evaluate(() => document.activeElement && document.activeElement.id === 'mosaic-booking-layer'), await page.evaluate(() => (document.activeElement && document.activeElement.tagName + '#' + document.activeElement.id)));
ok('a hatter inert', await page.evaluate(() => [...document.body.children].filter((e) => e.id !== 'mosaic-booking-layer').every((e) => e.inert)));
await reteg(page).locator('#be-close').click();
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
ok('bezaras utan a hatter nem inert, a gorgetes visszaall', await page.evaluate(() => [...document.body.children].every((e) => !e.inert) && getComputedStyle(document.documentElement).overflow !== 'hidden'));
ok('H0 utan bezaras: eredeti cim', url(page).pathname + url(page).search === eredetiUrl, url(page).pathname + url(page).search);

// ujratoltes ?booking=1-gyel: a reteg ujra megnyilik; bezaras utan tiszta cim
await page.goto(BAZIS + OLDAL + '?utm_source=teszt&utm_medium=cpc&gclid=TESZT123&booking=1&business=oxygen&service=466110', { waitUntil: 'domcontentloaded' });
const c2 = await varCim(page);
ok('ujratoltes (?booking=1): a reteg megnyilik a jo allapotban', !!c2 && c2.includes('Legközelebbi szabad időpontok'), `cim="${c2}"`);
await reteg(page).locator('#be-close').click();
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
const veg = url(page);
ok('?booking=1 beerkezo link: a bezaras nem nyul az URL-hez (nincs extra oldalmegtekintes), a UTM / click ID megmarad', veg.searchParams.get('booking') === '1' && veg.searchParams.get('gclid') === 'TESZT123' && veg.searchParams.get('utm_source') === 'teszt' && !veg.hash, veg.search);

// --- valodi landing-oldalak: a (linktermekbol kapott) foglalo-gombok a retegat nyitjak, nem navigalnak --------------------------------------------
const LANDINGEK = ['/idpontfoglalas', '/lezeres-szortelenites-budapest', '/headspa-budapest-hungary', '/noi-fodrasz-budapesten-30-szazalek-kedvezmennyel', '/szortelenites-foglalas', '/headspa-ajandekkartya'];
for (const lap of LANDINGEK) {
  await page.goto(BAZIS + lap, { waitUntil: 'domcontentloaded' });
  const van = await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 }).then(() => true).catch(() => false);
  if (!van) { ok(lap + ' | launcher betoltodott', false); continue; }
  const hrefek = await page.$$eval('a[href*="foglalo-motor"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  ok(lap + ' | van motor-link (' + hrefek.length + ')', hrefek.length > 0);
  for (const h of hrefek.slice(0, 7)) {
    await page.evaluate((x) => { window.__marker = 'maradt'; [...document.querySelectorAll('a[href]')].find((a) => a.getAttribute('href') === x).click(); }, h);
    const c = await varCim(page);
    const u = url(page);
    const q = new URL(h, BAZIS).searchParams;
    ok(lap + ' | CTA ' + h.replace('/foglalo-motor?', '') + ' -> reteg (az URL valtozatlan)', !!c && u.pathname === lap && !u.searchParams.has('booking') && !u.hash && (await page.evaluate(() => window.__marker)) === 'maradt', 'cim="' + c + '"');
    await reteg(page).locator('#be-close').click().catch(() => {});
    await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  }
}
// --- meres-vedelem: a GTM-es landing-oldalon a reteg teljes hasznalata (nyitas, lepesek, adatlap, bezaras) nem indit meresi esemenyt a fo ablakbol ----
{
  await page.goto(BAZIS + '/lezeres-szortelenites-budapest?gclid=TESZT123&utm_source=teszt&utm_medium=cpc', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  await page.waitForTimeout(9000); // a betoltes-kori meresi esemenyek lecsengenek
  const n0 = merEsem.length;
  await page.evaluate(() => document.querySelector('a[href*="foglalo-motor"]').click());
  await varCim(page); await page.waitForTimeout(2500);
  await reteg(page).locator('.be-time').first().click(); await page.waitForTimeout(2500);
  await reteg(page).locator('button', { hasText: 'Tovább az adatokhoz' }).click(); await page.waitForTimeout(8000);
  await reteg(page).locator('#be-back').click(); await page.waitForTimeout(2500);
  await reteg(page).locator('#be-close').click();
  await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const uj = merEsem.slice(n0).filter((e) => !(e.plat === 'tiktok' && /^(EngagedSession|\/api\/v2\/(monitor|pixel\/(act|inter)))/.test(e.ev)));
  ok('meres-vedelem: a reteg hasznalata (GTM-es oldalon) nem indit meresi kerest a fo ablakbol', uj.length === 0, uj.slice(0, 6).map((e) => e.plat + ':' + e.ev).join(', '));
}

// a PMU-landing es a koszonooldalak nem kapnak launchert
for (const lap of ['/sminktetovalas-budapest', '/fodrasz-ok']) {
  await page.goto(BAZIS + lap, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  ok(lap + ' | nincs launcher', await page.evaluate(() => typeof window.openBooking === 'undefined'));
}

ok('nincs JS-hiba a konzolon', hibak.length === 0, hibak.slice(0, 3).join(' | '));
await ctx.close();
await browser.close();
const rossz = eredmeny.filter((e) => !e.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${rossz.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}`);
process.exit(rossz.length ? 1 : 0);
