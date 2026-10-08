// Probafoglalas lemondasa a visszaigazolo e-mail "Lemondom" linkjevel (a Salonic oldal sajat nyomkovetoi tiltva: nem megy ki meresi keres).
//   node lemond.mjs <cancelBooking-URL>      (a lemondás oka: LEMONDAS_OK környezeti változó, alap: Próbafoglalás (TESZT), lemondva)
import { chromium } from 'playwright-core';
const url = process.argv[2];
if (!/^https:\/\/[a-z-]+\.salonic\.hu\/booking\/cancelBooking\/[0-9a-f-]{36}$/.test(url || '')) throw new Error('ervenytelen lemondo URL');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 1000, height: 1100 }, locale: 'hu-HU', serviceWorkers: 'block' });
const ENGEDETT = /^https:\/\/([a-z0-9.-]*salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha)\//;
await ctx.route('**/*', (route) => { const r = route.request(); if (ENGEDETT.test(r.url()) || (r.method() === 'GET' && /^https:\/\/www\.googletagmanager\.com\/(gtm|gtag)/.test(r.url()))) return route.continue(); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': r.headers().origin || '*' }, body: '{}' }); });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2500);
const szoveg0 = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
console.log('oldal:', p.url().slice(0, 100), '| allapot:', /Visszaigazolt/.test(szoveg0) ? 'Visszaigazolt' : /Lemondva|lemondt/i.test(szoveg0) ? 'mar lemondva' : '?');
if (!(await p.locator('.swal-overlay--show-modal').count())) await p.getByRole('link', { name: /^\s*Lemondom\s*$/i }).first().click(); // a cancelBooking-URL magatol is megnyithatja a lemondas-ablakot
const ok = p.locator('input[type="text"]:visible, input:not([type]):visible').last();
await ok.waitFor({ state: 'visible', timeout: 10000 });
await ok.fill(process.env.LEMONDAS_OK || 'Próbafoglalás (TESZT), lemondva'); // LEMONDAS_OK: pl. "Nem jelent meg" (a no-show jelzés próbájához)
await p.getByRole('button', { name: /Igen, lemondom/i }).click();
await p.waitForTimeout(3500);
const veg = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
console.log(/lemondása sikeres/i.test(veg) ? 'SIKERES: "Az időpont lemondása sikeres volt!"' : 'NEM IGAZOLTA VISSZA: ' + veg.slice(-300));
await b.close();

