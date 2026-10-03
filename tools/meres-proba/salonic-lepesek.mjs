// A Salonic NATIV foglalasi utjan (fooldal -> szolgaltatas -> munkatars -> idopont -> adatlap) vegigkattintva kiirja a view_item / select_employee (GA4) es a
// ViewContent / InitiateCheckout (TikTok) esemenyek tartalmat. Foglalas NEM jon letre (az adatlapot nem toltjuk ki), a kimeno meres alapbol tiltva (tilt.mjs).
// Fodrasz-fiok, konzultacio (specId 48291). Az eredmeny: docs/booking-engine/MERES_FOGLALASI_LEPESEK.md
import { chromium } from 'playwright-core';
import { UA, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: [dnsArg()] });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'hu-HU', serviceWorkers: 'block' });
const v = (x) => (Array.isArray(x) ? x[0] : x);
await ctx.route('**/*', (route) => {
  const req = route.request(), url = req.url(); const plat = platformOf(url) || (engedett(url, req.method()) ? null : 'tiltott');
  if (plat) {
    const u = new URL(url), b = req.postData() || '';
    if (plat === 'stape' && /g\/collect/.test(u.pathname)) { const p = Object.fromEntries(u.searchParams); if (/^(view_item|select_employee)$/.test(p.en)) { console.log('\nGA4', p.en, '| dl =', (p.dl || '').slice(0, 110)); console.log('   params:', JSON.stringify(Object.fromEntries(Object.entries(p).filter(([k]) => /^(ep|epn|pr\d|cu|_et|_c|en)/.test(k) || /^(cu)$/.test(k)))).slice(0, 700)); } }
    if (plat === 'tiktok') { try { const j = JSON.parse(b); if (/^(ViewContent|InitiateCheckout)$/.test(j.event)) console.log('\nTIKTOK', j.event, '| properties:', JSON.stringify(j.properties || j.context && j.context.page && {} || {}).slice(0, 500), '| kulcsok:', Object.keys(j).join(',')); } catch {} }
    return route.fulfill(ures(req));
  }
  return route.continue();
});
const page = await ctx.newPage();
await page.goto('https://mosaic-hair.salonic.hu/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
await page.locator('text=Foglalás megkezdése').first().click(); await page.waitForTimeout(3000);
await page.locator('a[href*="specId=48291"]').first().click(); await page.waitForTimeout(3000);
await page.locator('.inputGroupSingle').first().click(); await page.waitForTimeout(5000);
await page.locator('a:has-text("Noel - 20%")').first().click(); await page.waitForTimeout(4000);
await page.locator('a[href*="/guestData/"]').first().click(); await page.waitForTimeout(6000);
await browser.close();
