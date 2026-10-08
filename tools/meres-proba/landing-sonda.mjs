// Mely landing-oldalakon fut a Google-cimke / Meta-pixel / TikTok-pixel, es kapjak-e el a kattintas-azonositot (suti + kerelem)? Minden kimeno keres tiltva.
import { chromium } from 'playwright-core';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const QS = 'gclid=TESZT123&fbclid=TESZT456&ttclid=TESZT789&utm_source=teszt&utm_medium=cpc';
const OLDALAK = process.argv.slice(2);
const MERES = /^https:\/\/(www\.googleadservices\.com|googleads\.g\.doubleclick\.net|www\.google\.(com|hu)\/(pagead|rmkt|ccm)|pagead2\.googlesyndication\.com|ad\.doubleclick\.net|region\d\.analytics\.google\.com|stats\.g\.doubleclick\.net|www\.google-analytics\.com|stape\.mosaicheadspa\.hu\/(g\/|data|_\/)|capig\.stape\.[a-z]+|www\.facebook\.com\/tr|analytics\.tiktok\.com\/api|analytics-ipv6\.tiktokw\.us|hooks\.zapier\.com)/;
const ENGEDETT = /^https:\/\/(([a-z0-9-]+\.)?mosaicheadspa\.hu|[a-z0-9.-]*salonic\.hu|www\.googletagmanager\.com\/(gtm\.js|gtag\/js)|connect\.facebook\.net|analytics\.tiktok\.com\/i18n\/pixel|cdn\.trustindex\.io|fonts\.(googleapis|gstatic)\.com)/;
const b = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--host-resolver-rules=MAP capig.stape.do ~NOTFOUND, MAP capig.stape.de ~NOTFOUND, MAP analytics-ipv6.tiktokw.us ~NOTFOUND, MAP hooks.zapier.com ~NOTFOUND, MAP region1.analytics.google.com ~NOTFOUND, MAP www.googleadservices.com ~NOTFOUND, MAP googleads.g.doubleclick.net ~NOTFOUND'] });
for (const ut of OLDALAK) {
  const ctx = await b.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'hu-HU', serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { if (/mosaicheadspa\.hu$/.test(location.hostname) && !localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: true })); } catch (e) { /* */ } });
  const log = [];
  await ctx.route('**/*', (route) => {
    const r = route.request(), u = r.url();
    if (MERES.test(u) || (!ENGEDETT.test(u) && r.method() !== 'GET')) { log.push(u); return route.fulfill({ status: 200, headers: { 'content-type': r.resourceType() === 'image' ? 'image/gif' : 'application/json', 'access-control-allow-origin': r.headers().origin || '*', 'access-control-allow-credentials': 'true' }, body: r.resourceType() === 'image' ? Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') : '{}' }); }
    return route.continue();
  });
  const p = await ctx.newPage();
  await p.goto('https://www.mosaicheadspa.hu' + ut + '?' + QS, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(9000);
  const sutik = Object.fromEntries((await ctx.cookies()).filter((c) => /^(_fbc|_fbp|_gcl_aw|ttclid|_ga_)/.test(c.name)).map((c) => [c.name.slice(0, 6), String(c.value).slice(0, 30)]));
  const kinek = { google: log.filter((u) => /google|doubleclick|googlesyndication/.test(u)).length, meta: log.filter((u) => /facebook\.com\/tr|capig/.test(u)).length, tiktok: log.filter((u) => /tiktok/.test(u)).length };
  console.log(ut.padEnd(62), JSON.stringify(kinek), JSON.stringify(sutik));
  await ctx.close();
}
await b.close();
