// Mi tortenik, ha a vendeg a "Foglalas modositasa" gombra kattint, de nem valaszt uj idopontot? (kimeno meresi kerelmek tiltva)
//   node _tmp/modosit-kattint.mjs <bookingDetails-URL> [mobil]
import { chromium } from 'playwright-core';
const url = process.argv[2];
const MOBIL = process.argv[3] === 'mobil';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ENGEDETT = /^https:\/\/([a-z0-9.-]*salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha)\//;
const uj = async () => {
  const ctx = await b.newContext(MOBIL ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'hu-HU', serviceWorkers: 'block' } : { viewport: { width: 1000, height: 1200 }, locale: 'hu-HU', serviceWorkers: 'block' });
  await ctx.route('**/*', (route) => { const r = route.request(); if (ENGEDETT.test(r.url()) || (r.method() === 'GET' && /^https:\/\/www\.googletagmanager\.com\/(gtm|gtag)/.test(r.url()))) return route.continue(); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': r.headers().origin || '*' }, body: '{}' }); });
  return ctx;
};
const allapot = async (p) => { const t = (await p.locator('body').innerText()).replace(/\s+/g, ' '); return `${p.url().slice(0, 110)} | ${/Visszaigazolt/.test(t) ? 'VISSZAIGAZOLT' : /Lemondva|lemondt/i.test(t) ? 'LEMONDVA' : 'ismeretlen'} | ${t.slice(150, 330)}`; };
try {
  const c1 = await uj(); const p1 = await c1.newPage();
  await p1.goto(url, { waitUntil: 'domcontentloaded' }); await p1.waitForTimeout(2500);
  console.log('1. kattintas elott:', await allapot(p1));
  const gomb = p1.getByRole('link', { name: /Foglalás módosítása/i }).first();
  console.log('gomb href:', await gomb.getAttribute('href'));
  const kattintasUtani = []; p1.on('request', (r) => { if (/salonic\.hu/.test(r.url()) && r.method() !== 'GET') kattintasUtani.push(r.method() + ' ' + r.url().slice(0, 100)); });
  await gomb.click(); await p1.waitForTimeout(4000);
  console.log('2. kattintas utan (ugyanaz a bongeszo):', await allapot(p1));
  console.log('   nem-GET salonic keresek a kattintas utan:', JSON.stringify(kattintasUtani));
  await p1.screenshot({ path: '_tmp/modosit-2.png', fullPage: true });
  await c1.close();
  const c2 = await uj(); const p2 = await c2.newPage();
  await p2.goto(url, { waitUntil: 'domcontentloaded' }); await p2.waitForTimeout(2500);
  console.log('3. uj bongeszoben, ugyanaz a link:', await allapot(p2));
  await p2.screenshot({ path: '_tmp/modosit-3.png', fullPage: true });
} catch (e) { console.log('HIBA', String(e.message).slice(0, 300)); }
await b.close();
