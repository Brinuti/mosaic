// A Salonic modositas sikeroldalanak (success-edit) DOM-ja + a modositas-megerosito ablak. node _tmp/athelyez-dom.mjs <bookingDetails-URL> <ido, pl. 11:00>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [url, ido] = [process.argv[2], process.argv[3] || '11:00'];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ENGEDETT = /^https:\/\/([a-z0-9.-]*salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha|www\.mosaicheadspa\.hu\/(salonic|assets))/;
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'hu-HU', serviceWorkers: 'block' });
await ctx.route('**/*', (route) => { const r = route.request(); if (ENGEDETT.test(r.url()) || (r.method() === 'GET' && /^https:\/\/www\.googletagmanager\.com\/(gtm|gtag)/.test(r.url()))) return route.continue(); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': r.headers().origin || '*' }, body: '{}' }); });
const p = await ctx.newPage();
const dump = async (nev) => { const html = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('script,noscript,style,svg,path').forEach((e) => e.remove()); return `<body class="${document.body.className}" id="${document.body.id}">` + c.innerHTML.replace(/\s+/g, ' '); }); fs.writeFileSync(`_tmp/dom-${nev}.html`, html); console.log(nev, p.url().slice(0, 100), html.length); };
await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);
await p.getByRole('link', { name: /Foglalás módosítása/i }).first().click(); await p.waitForTimeout(3000);
await p.getByText(ido, { exact: true }).first().click(); await p.waitForTimeout(2500);
await dump('modositas-ablak');
await p.getByRole('button', { name: /Igen, módosítom/i }).click(); await p.waitForTimeout(4500);
await dump('modositva');
await b.close();
