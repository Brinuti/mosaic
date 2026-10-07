// "A foglalasod" oldal proba: a mi oldalunk + a beagyazott VALODI Salonic-oldal + a HELYI (meg nem eles) salonic/mosaic.css.
//   node _tmp/foglalasom-proba.mjs <oldal.html> <elonev> [mobil|asztal] [pmu]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [HTML, NEV, NEZET = 'mobil', PMU] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ENGEDETT = /^https:\/\/([a-z0-9.-]*salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha|www\.mosaicheadspa\.hu\/assets\/fonts|[a-z0-9-]+\.mosaic-d77\.pages\.dev|maps\.google\.com|www\.google\.com\/maps)/;
const ctx = await b.newContext(NEZET === 'mobil' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'hu-HU', serviceWorkers: 'block' } : { viewport: { width: 1100, height: 900 }, locale: 'hu-HU', serviceWorkers: 'block' });
const cssUt = PMU ? 'salonic/pmu.css' : 'salonic/mosaic.css';
await ctx.route('**/*', (route) => {
  const r = route.request(); const u = r.url();
  if (u.startsWith('https://proba.test/f/')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(HTML) });
  if (u.startsWith('https://proba.test/assets/fonts/')) { const f = 'assets/fonts/' + u.split('/assets/fonts/')[1]; return fs.existsSync(f) ? route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: '' }); }
  if (/^https:\/\/www\.mosaicheadspa\.hu\/salonic\/(mosaic|pmu)\.css/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(cssUt) }); // a HELYI css
  if (u.startsWith('https://proba.test/')) return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  if (ENGEDETT.test(u) || (r.method() === 'GET' && /^https:\/\/www\.googletagmanager\.com\/(gtm|gtag)/.test(u))) return route.continue();
  return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': r.headers().origin || '*' }, body: '{}' });
});
const p = await ctx.newPage();
await p.goto(process.env.ELO_URL || 'https://proba.test/f/abc', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(6000);
const fr = p.frameLocator('#foglalas');
const lathato = async (sel) => (await fr.locator(sel).evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; }).length));
console.log('--- 1. reszletek');
console.log('menu / fejlec lathato:', await lathato('.navbar'), await lathato('.page-header'), '| lablec:', await lathato('footer'));
console.log('Salonic fiok-reklam:', await lathato('.btn-salonic'), '| terkep-kartya:', await lathato('.card-header-info'), '| fooldal-link:', await lathato('a[href="/"]'));
console.log('Foglalas modositasa gomb:', await lathato('a.btn-primary'), '| Lemondom:', await lathato('.btn-cancel-booking'));
const gorgetes = await p.frames().find((x) => x !== p.mainFrame())?.evaluate(() => ({ scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
console.log('iframe belso meret:', JSON.stringify(gorgetes));
await p.screenshot({ path: `_tmp/${NEV}-1-reszletek.png` });
await p.screenshot({ path: `_tmp/${NEV}-1-reszletek-teljes.png`, fullPage: true });
console.log('--- 2. Foglalas modositasa');
await fr.getByRole('link', { name: /Foglalás módosítása/i }).first().click(); await p.waitForTimeout(4000);
console.log('menu / fejlec lathato:', await lathato('.navbar'), await lathato('.page-header'), '| fooldal-link:', await lathato('a[href="/"]'));
await p.screenshot({ path: `_tmp/${NEV}-2-modositas.png` });
if (process.env.VEGREHAJT) {
  console.log('--- 2b. uj idopont kivalasztasa + megerosites (VALODI modositas a probafoglalason)');
  const idok = await fr.locator('a[href*="/guestData"], a.btn, .time-slot, a').filter({ hasText: /^s*d{1,2}:d{2}s*$/ }).allInnerTexts();
  console.log('idopontok:', idok.join(' | '));
  await fr.getByText(process.env.VEGREHAJT, { exact: true }).first().click(); await p.waitForTimeout(2500);
  await p.screenshot({ path: `_tmp/${NEV}-2b-megerosito-ablak.png` });
  await fr.getByRole('button', { name: /Igen, módosítom/i }).click(); await p.waitForTimeout(5000);
  await p.screenshot({ path: `_tmp/${NEV}-2c-modositva.png` });
  await b.close(); process.exit(0);
}
console.log('--- 3. vissza + Lemondom (ablak, nem erositem meg)');
await fr.locator('a[href*="/booking/bookingDetails"], a[href*="bookingDetails"]').first().click({ timeout: 3000 }).catch(() => {});
await p.goBack().catch(() => {}); await p.waitForTimeout(3000);
await fr.getByRole('link', { name: /Lemondom/i }).first().click({ timeout: 5000 }).catch((e) => console.log('Lemondom kattintas:', String(e.message).slice(0, 80))); await p.waitForTimeout(2500);
await p.screenshot({ path: `_tmp/${NEV}-3-lemondas-ablak.png` });
await b.close();
