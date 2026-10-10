// Probafoglalas allapotanak ellenorzese a Salonic "Foglalas reszletek" oldalon (csak olvas; a Salonic oldal sajat nyomkovetoi tiltva: nem megy ki meresi keres).
//   node foglalas-allapot.mjs <bookingDetails-URL> [...]
import { chromium } from 'playwright-core';
const urlek = process.argv.slice(2);
if (!urlek.length || urlek.some((u) => !/^https:\/\/[a-z-]+\.salonic\.hu\/booking\/bookingDetails\/[0-9a-f-]{36}$/.test(u))) throw new Error('ervenytelen bookingDetails URL');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 1000, height: 1100 }, locale: 'hu-HU', serviceWorkers: 'block' });
const ENGEDETT = /^https:\/\/([a-z0-9.-]*salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com)\//;
await ctx.route('**/*', (route) => { const r = route.request(); if (ENGEDETT.test(r.url())) return route.continue(); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': r.headers().origin || '*' }, body: '{}' }); });
let hiba = 0;
for (const u of urlek) {
  const p = await ctx.newPage();
  await p.goto(u, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  const szoveg = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  const allapot = /Id[őo]pont t[öo]r[öo]lve|Appointment deleted|Lemondva|lemondott/i.test(szoveg) ? 'LEMONDVA' : /Visszaigazolt|Foglal[áa]s r[ée]szletei/i.test(szoveg) ? 'VISSZAIGAZOLT (nincs lemondva!)' : '?';
  if (allapot !== 'LEMONDVA') hiba++;
  console.log(u.replace('https://', '').slice(0, 60) + ' -> ' + allapot + (allapot === '?' ? ' | ' + szoveg.slice(0, 200) : ''));
  await p.close();
}
await b.close();
process.exit(hiba ? 1 : 0);
