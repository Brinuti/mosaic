// Pillanatkepek a foglalo-reteg kulcs-nezeteirol (a design ellenorzesehez): szolgaltatas-valaszto, HeadSpa, oxigen, fodraszat (fodraszok), lezer, havi naptar, adatlap.
//
//   node tools/meres-proba/design-kepek.mjs --overlay dist --ki mappa [--mobil 1] [--stilus 1] [--bazis https://...]
// --stilus 1: az adatlapot a MOSAIC kozos Salonic-CSS-ével (salonic/mosaic.css) is megmutatja: ilyen lesz, ha a Salonic-fiokban az Egyedi CSS URL be van allitva.
// A kimeno meres tiltva (tilt.mjs); az adatlap betoltese utan nem kuldunk el semmit (nincs foglalas).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', KI = arg('ki', 'design-kepek'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), STILUS = arg('stilus', '0') === '1';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;
fs.mkdirSync(KI, { recursive: true });

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
const reteg = page.locator('#mosaic-booking-layer');
const elotag = MOBIL ? 'mobil' : 'asztali';
const kep = async (nev) => { await page.waitForTimeout(900); await page.screenshot({ path: path.join(KI, `${elotag}-${nev}.png`) }); console.log('kep:', nev); };
const cimre = async () => { await reteg.locator('.be-title').first().waitFor({ timeout: 25000 }); await page.waitForTimeout(700); };
const zar = async () => { await reteg.locator('#be-close').click().catch(() => {}); await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {}); };

await page.goto(BAZIS + '/booking-test', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
const nyit = async (o) => { await page.evaluate((x) => window.openBooking(x), o); await cimre(); };

await nyit({}); await kep('1-h0-szolgaltatasok'); await zar();
await nyit({ business: 'headspa' }); await kep('2-headspa-elmenyek');
await reteg.locator('.be-choice', { hasText: 'Páros HeadSpa' }).click();
await reteg.locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 }); await kep('3-headspa-naptar');
await reteg.locator('.be-idogomb').first().click();
await reteg.locator('iframe.be-iframe').waitFor({ timeout: 25000 }); await page.waitForTimeout(6000); await kep('4-headspa-adatlap');
if (STILUS) {
  // A Salonic-fiok "Egyedi CSS URL" beallitasa utani kinezet: a MOSAIC kozos CSS-t a keretbe injektaljuk, a keret meretet a stilusos meretre allitjuk (ugyanez tortenik, ha a fiokban be van allitva)
  const fr = page.frames().find((f) => /salonic\.hu\/guestData/.test(f.url()));
  await fr.addStyleTag({ content: fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'salonic', 'mosaic.css'), 'utf8') });
  await reteg.locator('.be-frame').evaluate((e) => { e.style.setProperty('--visible', '735px'); e.style.setProperty('--crop', '78px'); e.dataset.styled = 'true'; });
  await page.waitForTimeout(1500); await kep('4b-headspa-adatlap-stilusos');
  await reteg.locator('.be-scroll').evaluate((e) => { e.scrollTop = e.scrollHeight; }); await kep('4c-headspa-adatlap-stilusos-alul');
}
await zar();
await nyit({ business: 'oxygen' }); await kep('5-oxigen'); await zar();
await nyit({ business: 'hair' }); await kep('6-fodraszat-szandekek');
await reteg.locator('.be-choice', { hasText: 'Balayage' }).first().click(); await cimre();
for (let i = 0; i < 3 && !/Van választott fodrászod/i.test(await reteg.locator('.be-title').first().textContent()); i++) { await reteg.locator('.be-choice').first().click(); await cimre(); }
if (/Van választott fodrászod/i.test(await reteg.locator('.be-title').first().textContent())) {
  await reteg.locator('.be-choice').nth(1).click(); await page.waitForTimeout(2000); await cimre(); await kep('7-fodraszat-fodraszok');
}
await zar();
await nyit({ business: 'laser', intent: 'first' }); await kep('8-lezer-teruletek'); await zar();
// az idopont-valaszto minden uzletagnal a havi naptar
for (const [nev, o] of [['9-oxigen-naptar', { business: 'oxygen', service: '466110' }], ['10-fodraszat-naptar', { business: 'hair', service: 'konzult' }], ['11-lezer-naptar', { business: 'laser', service: 'konzult' }]]) {
  await nyit(o); await reteg.locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 }); await kep(nev); await zar();
}
await browser.close();
