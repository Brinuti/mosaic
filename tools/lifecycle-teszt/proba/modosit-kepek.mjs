// Kepernyokepek (mobil) a vendeg-oldalakrol: 1) az SMS-linkre megnyilo "Idopont reszletek", 2) a "Foglalas modositasa" gomb utan megnyilo oldal. Kimeno meresi kerelmek tiltva.
import { chromium } from 'playwright-core';
const SHORT = process.argv[2]; // pl. https://claude-lifecycle-motor.mosaic-d77.pages.dev/f/1b5e1107fe
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ENGEDETT = /^https:\/\/([a-z0-9.-]*salonic\.hu|[a-z0-9-]+\.mosaic-d77\.pages\.dev|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha)\//;
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true, locale: 'hu-HU', serviceWorkers: 'block' });
await ctx.route('**/*', (route) => { const r = route.request(); if (ENGEDETT.test(r.url()) || (r.method() === 'GET' && /^https:\/\/www\.googletagmanager\.com\/(gtm|gtag)/.test(r.url()))) return route.continue(); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': r.headers().origin || '*' }, body: '{}' }); });
const p = await ctx.newPage();
try {
  await p.goto(SHORT, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3000);
  const elrejt = async () => p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { const st = getComputedStyle(e); if (st.position === 'fixed' && /cookie/i.test(e.textContent || '')) e.style.display = 'none'; } }); // csak a kepernyokephez: a Salonic sajat suti-savja ne takarjon
  await elrejt();
  console.log('1.', p.url());
  await p.screenshot({ path: '_tmp/kep-reszletek.jpg', type: 'jpeg', quality: 72, fullPage: true, clip: { x: 0, y: 0, width: 390, height: 1020 } });
  await p.getByRole('link', { name: /Foglalás módosítása/i }).first().click(); await p.waitForTimeout(3500);
  await elrejt(); console.log('2.', p.url().slice(0, 120));
  await p.screenshot({ path: '_tmp/kep-modositas.jpg', type: 'jpeg', quality: 72 });
} catch (e) { console.log('HIBA', String(e.message).slice(0, 300)); }
await b.close();
