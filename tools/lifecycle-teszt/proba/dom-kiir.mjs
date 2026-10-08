// A Salonic vendeg-oldalak DOM-ja (script nelkul) a CSS-tervezeshez. node _tmp/dom-kiir.mjs <url> <ki.html>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [url, ki] = [process.argv[2], process.argv[3]];
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ENGEDETT = /^https:\/\/([a-z0-9.-]*salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha|www\.mosaicheadspa\.hu\/(salonic|assets))/;
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'hu-HU', serviceWorkers: 'block' });
await ctx.route('**/*', (route) => { const r = route.request(); if (ENGEDETT.test(r.url()) || (r.method() === 'GET' && /^https:\/\/www\.googletagmanager\.com\/(gtm|gtag)/.test(r.url()))) return route.continue(); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': r.headers().origin || '*' }, body: '{}' }); });
const p = await ctx.newPage();
await p.goto(url, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500);
if (process.argv[4] === 'modosit') { await p.getByRole('link', { name: /Foglalás módosítása/i }).first().click(); await p.waitForTimeout(3500); }
const html = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('script,noscript,style,svg,path').forEach((e) => e.remove()); return `<body class="${document.body.className}" id="${document.body.id}">` + c.innerHTML.replace(/\s+/g, ' '); });
fs.writeFileSync(ki, html);
console.log(p.url(), html.length);
await b.close();
