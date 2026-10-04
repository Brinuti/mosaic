// Pillanatképek a foglaló-réteg kulcs-nézeteiről (a design ellenőrzéséhez): szolgáltatás-választó, HeadSpa (ajándékkártya-kérdés, élmények, kuponkódos kártyák,
// naptár, adatlap), oxigén (kártyák, szakember), fodrászat (fodrász-választó, szándékok, kezelések, hajhosszok), lézer (területek, csomagok), naptárak.
//
//   node tools/meres-proba/design-kepek.mjs --overlay dist --ki mappa [--mobil 1] [--stilus 1] [--bazis https://...]
// --stilus 1: az adatlapot a MOSAIC közös Salonic-CSS-ével (salonic/mosaic.css) is megmutatja: ilyen lesz, ha a Salonic-fiókban az Egyedi CSS URL be van állítva.
// A kimenő mérés tiltva (tilt.mjs); az adatlap betöltése után nem küldünk el semmit (nincs foglalás).
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
const cimre = async () => { await reteg.locator('.be-title').first().waitFor({ timeout: 25000 }); await page.waitForTimeout(900); };
const zar = async () => { await reteg.locator('#be-close').click().catch(() => {}); await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {}); };
const kattint = async (szoveg) => { await reteg.locator('.be-choice', { hasText: szoveg }).first().click(); await cimre(); };

await page.goto(BAZIS + '/booking-test', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
const nyit = async (o) => { await page.evaluate((x) => window.openBooking(x), o); await cimre(); };

await nyit({}); await kep('01-h0-szolgaltatasok'); await zar();

// HeadSpa: ajándékkártya-kérdés -> élmények -> naptár -> adatlap; kuponkódos kártyák
await nyit({ business: 'headspa' }); await kep('02-headspa-ajandekkartya-kerdes');
await kattint('Normál foglalás'); await kep('03-headspa-elmenyek');
await kattint('Páros HeadSpa');
await reteg.locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 }); await kep('04-headspa-naptar');
await reteg.locator('.be-idogomb').first().click();
await reteg.locator('iframe.be-iframe').waitFor({ timeout: 25000 }); await page.waitForTimeout(6000); await kep('05-headspa-adatlap');
if (STILUS) {
  const fr = page.frames().find((f) => /salonic\.hu\/guestData/.test(f.url()));
  await fr.addStyleTag({ content: fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'salonic', 'mosaic.css'), 'utf8') });
  await reteg.locator('.be-frame').evaluate((e) => { e.style.setProperty('--visible', '735px'); e.style.setProperty('--crop', '78px'); e.dataset.styled = 'true'; });
  await page.waitForTimeout(1500); await kep('05b-headspa-adatlap-stilusos');
}
await zar();
await nyit({ business: 'headspa', voucher: '1' }); await kep('06-headspa-kuponkodos-kartyak');
// a kuponkodos Egyeni: a Relax es a Hair valtozat idopontjainak uniója egy naptarban
await kattint('Egyéni HeadSpa'); await reteg.locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
console.log('kuponkodos Egyeni: elso nap =', (await reteg.locator('.be-nap-cim').textContent()).trim(), '| szabad napok (honap):', await reteg.locator('.be-nnap.szabad').count());
await kep('06b-headspa-kuponkodos-egyeni-naptar');
// az elso idopontra kattintva az adatlap abba a Salonic-szolgaltatasba (Relax / Hair) foglal, amelyiknek az idopontja ez
await reteg.locator('.be-idogomb').first().click(); await reteg.locator('iframe.be-iframe').waitFor({ timeout: 25000 });
console.log('kuponkodos Egyeni: az adatlap szolgaltatas-azonositoja =', new URL(await reteg.locator('iframe.be-iframe').getAttribute('src')).searchParams.get('serviceId'));
await zar();

// Oxigén: kártyák -> (változat) -> szakember -> naptár
await nyit({ business: 'oxygen' }); await kep('07-oxigen-kartyak');
await kattint('Első oxigénterápiás');
if (/Melyiket választod/.test(await reteg.locator('.be-title').first().textContent())) await reteg.locator('.be-choice').first().click();
await reteg.locator('.be-title', { hasText: 'szakembert' }).waitFor({ timeout: 25000 }); await page.waitForTimeout(1200); await kep('08-oxigen-szakember'); await zar();

// Fodrászat: fodrász-választó (belépő) -> szándékok -> kezelések -> hajhosszok
await nyit({ business: 'hair' }); await page.waitForTimeout(1500); await kep('09-fodraszat-fodrasz-valaszto');
await kattint('Mindegy'); await kep('10-fodraszat-szandekek');
await kattint('Balayage'); await kep('11-fodraszat-kezelesek');
await reteg.locator('.be-choice').nth(1).click(); await cimre(); await kep('12-fodraszat-hajhosszok'); await zar();

// Lézer: területek, csomagok, kar
await nyit({ business: 'laser', intent: 'first' }); await kep('13-lezer-teruletek');
await kattint('Csomagok'); await kep('14-lezer-csomagok');
await reteg.locator('#be-back').click(); await cimre(); await kattint('Kar'); await kep('15-lezer-kar-kezelesek'); await zar();

// naptárak minden üzletágnál
for (const [nev, o] of [['16-oxigen-naptar', { business: 'oxygen', service: '466110' }], ['17-fodraszat-naptar', { business: 'hair', service: 'konzult' }], ['18-lezer-naptar', { business: 'laser', service: 'konzult' }]]) {
  await nyit(o);
  if (/szakembert/.test(await reteg.locator('.be-title').first().textContent())) await reteg.locator('.be-choice').last().click();
  await reteg.locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 }); await kep(nev); await zar();
}
await browser.close();
