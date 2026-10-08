// VALODI probafoglalas kozvetlenul a Salonic PMU-fiokban (a legkesobbi szabad napra, utolso idopontra), "TESZT – Claude" vendeggel.
//   node _tmp/pmu-foglalas.mjs            -> az adatlapig megy, nem kuldi be
//   node _tmp/pmu-foglalas.mjs --elkuld   -> be is kuldi
import { chromium } from 'playwright-core';
const KULDES = process.argv.includes('--elkuld');
const TELEFON = process.env.MERES_TELEFON || '709420090';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 1100, height: 1600 }, locale: 'hu-HU', serviceWorkers: 'block' });
const ENGEDETT = /^https:\/\/([a-z0-9.-]*salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha)\//;
await ctx.route('**/*', (route) => { const r = route.request(); if (ENGEDETT.test(r.url()) || (r.method() === 'GET' && /^https:\/\/www\.googletagmanager\.com\/(gtm|gtag)/.test(r.url()))) return route.continue(); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': r.headers().origin || '*' }, body: '{}' }); });
const p = await ctx.newPage();
p.setDefaultTimeout(20000);
const txt = async () => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
try {
  await p.goto('https://mosaic-pmu.salonic.hu/selectDate/?employeeId=32428&placeId=14585&serviceId=471160&startDate=1791532800', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const szabadNapok = p.locator('.mbsc-calendar-day-text:not([aria-disabled="true"])');
  const db = await szabadNapok.count();
  console.log('szabad napok szama a lathato honapokban:', db);
  const utolso = szabadNapok.nth(db - 1);
  console.log('utolso szabad nap:', await utolso.getAttribute('aria-label'));
  await utolso.click();
  await p.waitForTimeout(2500);
  const idoLinkek = await p.locator('a[href*="/guestData/"]').evaluateAll((els) => els.map((e) => ({ t: (e.textContent || '').trim(), h: e.getAttribute('href') })));
  console.log('idopontok:', idoLinkek.map((x) => x.t).join(' | '));
  if (!idoLinkek.length) throw new Error('nincs idopont');
  const cel = idoLinkek[idoLinkek.length - 1];
  console.log('valasztott:', cel.t);
  await p.goto(new URL(cel.h, 'https://mosaic-pmu.salonic.hu').href, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  const tolt = async (sel, ertek) => { const l = p.locator(sel).first(); await l.click(); await l.pressSequentially(ertek, { delay: 40 }); };
  await tolt('#GuestDataForm_guestPhoneTemp', TELEFON);
  await tolt('#GuestDataForm_guestLastName', 'TESZT –');
  await tolt('#GuestDataForm_guestFirstName', 'Claude');
  await tolt('#GuestDataForm_guestEmail', 'deakfi@grantis.hu');
  await p.locator('#GuestDataForm_acceptTerms').check();
  console.log('adatlap kitoltve; url:', p.url());
  if (await p.locator('iframe[src*="recaptcha"][src*="bframe"]').count()) throw new Error('RECAPTCHA-KIHIVAS: megallok');
  if (KULDES) {
    await p.locator('#button-submit-booking').click();
    await p.waitForTimeout(6000);
    console.log('beküldve; url:', p.url());
    console.log((await txt()).slice(0, 500));
  }
  await p.screenshot({ path: '_tmp/pmu-vege.png', fullPage: true });
} catch (e) { console.log('HIBA', String(e.message).slice(0, 300)); await p.screenshot({ path: '_tmp/pmu-hiba.png', fullPage: true }).catch(() => {}); }
await b.close();
