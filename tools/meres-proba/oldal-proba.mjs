// A foglalo SAJAT OLDALAS (page) modjanak ellenorzese bongeszoben (Playwright), foglalas nelkul: /foglalas (szolgaltatas-elso) es /foglalo-motor.
//
//   node tools/meres-proba/oldal-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1]
// Ugyanaz a motor, mint a retegben (mode 'page'): a lepesek az URL-be kerulnek (#HS2, #CN, ...), a vissza gomb lepesenkent visszalep.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
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
  if (plat) return route.fulfill(ures(req));
  return route.continue();
});
const page = await ctx.newPage();
const hibak = [];
page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) hibak.push(m.text().slice(0, 160)); });
const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push(rendben); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };
const cim = async () => { const c = page.locator('.be-title').first(); await c.waitFor({ timeout: 25000 }); return (await c.textContent()).trim(); };

// /foglalas: szolgaltatas-elso kezdooldal -> Head Spa -> elmeny -> havi naptar -> adatlap
await page.goto(BAZIS + '/foglalas', { waitUntil: 'domcontentloaded' });
ok('/foglalas: szolgaltatas-valaszto kepekkel', (await cim()).includes('Mit szeretnél foglalni?') && (await page.locator('.be-choice-img').count()) === 5);
await page.locator('.be-choice', { hasText: 'Head Spa' }).click();
ok('/foglalas: Head Spa -> elmeny-valasztas (nincs HS1), URL #HS2', (await cim()).includes('Melyik HeadSpa élményt') && page.url().endsWith('#HS2'), page.url());
await page.locator('.be-choice', { hasText: 'Egyéni HeadSpa' }).click();
await page.locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
ok('/foglalas: havi naptar (CN), URL #CN', page.url().endsWith('#CN') && (await page.locator('.be-idogomb').count()) > 0, page.url());
await page.locator('.be-idogomb').first().click();
await page.locator('iframe.be-iframe').waitFor({ timeout: 25000 });
ok('/foglalas: idopont utan rogton az adatlap (#C4), nincs osszegzo', page.url().endsWith('#C4') && (await cim()).includes('Add meg az adataidat'), page.url());
await page.goBack(); await page.waitForTimeout(800);
ok('/foglalas: vissza gomb -> havi naptar, a kivalasztott nappal', page.url().endsWith('#CN') && (await page.locator('.be-nnap[aria-pressed="true"]').count()) === 1, page.url());
await page.goBack(); await page.waitForTimeout(500);
ok('/foglalas: vissza gomb -> elmeny-valasztas', (await cim()).includes('Melyik HeadSpa élményt'));

// /foglalo-motor: alap uzletag a HeadSpa -> az elmeny-valasztas az elso allapot
await page.goto(BAZIS + '/foglalo-motor?business=headspa', { waitUntil: 'domcontentloaded' });
ok('/foglalo-motor?business=headspa: elmeny-valasztas elso allapotkent', (await cim()).includes('Melyik HeadSpa élményt'));
await page.goto(BAZIS + '/foglalo-motor?business=headspa&voucher=1', { waitUntil: 'domcontentloaded' });
ok('/foglalo-motor?...&voucher=1: ajandekkartya-bevaltas', (await cim()).includes('Milyen ajándékkártyád van?'));
await page.goto(BAZIS + '/foglalo-motor?business=headspa&service=paros', { waitUntil: 'domcontentloaded' });
await page.locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
ok('/foglalo-motor?...&service=paros: rogton a havi naptar, a kezeles neve a savban', /Páros/i.test(await page.locator('.be-svc').first().textContent()) && (await page.locator('.be-svc .be-link').count()) === 0);
await page.goto(BAZIS + '/foglalo-motor?business=oxygen', { waitUntil: 'domcontentloaded' });
ok('/foglalo-motor?business=oxygen: Oxigen elso kepernyo kepekkel es arakkal', (await cim()).includes('Mit szeretnél foglalni?') && (await page.locator('.be-choice-ar').count()) === 3);
ok('nincs JS-hiba a konzolon', hibak.length === 0, hibak.slice(0, 3).join(' | '));
await browser.close();
const rossz = eredmeny.filter((x) => !x).length;
console.log(`\n${eredmeny.length} ellenorzes, ${rossz} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}`);
process.exit(rossz ? 1 : 0);
