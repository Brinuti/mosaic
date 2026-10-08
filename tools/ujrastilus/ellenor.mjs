// Az ujrastilusozott oldal ellenorzese a regi (Wixes) oldalhoz kepest: a tartalom NEM valtozhat.
//
//   PLAYWRIGHT_UTVONAL=<node_modules> node tools/ujrastilus/ellenor.mjs <regi.json> <uj-url> [--kezd "<regex>"] [--kihagy "<regex>"]
//   pl.: node tools/ujrastilus/ellenor.mjs ./ki/paros.json http://localhost:4173/paros-headspa-budapest
//        (a <regi.json> a folyam.mjs kimenete; az <uj-url> lehet helyi szerver, PR-elonezet vagy az eles oldal)
//
// Ellenorzi, asztalon es telefonon (390 px):
//   1. szoveg-hűseg: a regi oldal minden sora (fejlec / lablec / suti-sav nelkul) megvan-e az ujban; a kulonbseget kiirja
//   2. kepek: a regi oldal kepeibol melyik nincs meg az ujban (fajlnev szerint)
//   3. linkek: a regi oldal kulso / foglalo linkjei megvannak-e az ujban
//   4. hibak: torott kep, 404, konzol-hiba, vizszintes gorgetes, H1-ek szama
// Kilepesi kod: 0 = nincs hiba; 1 = hianyzo szoveg / torott kep / 404 / hiba / vizszintes tobblet.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(import.meta.dirname, '..', '..', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL=<a playwright-core node_modules mappaja>)');
}
const args = process.argv.slice(2);
const opc = (nev) => { const i = args.indexOf(nev); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const KEZD = opc('--kezd'); const KIHAGY = opc('--kihagy');
const [REGI, UJ] = args;
if (!REGI || !UJ) { console.error('hasznalat: node tools/ujrastilus/ellenor.mjs <regi.json> <uj-url> [--kezd regex] [--kihagy regex]'); process.exit(2); }
const regi = JSON.parse(fs.readFileSync(REGI, 'utf8'));
const bazis = new URL(UJ).origin;
const norm = (s) => s.toLowerCase().replace(/\u0336/g, '').replace(/[\u200b\u00a0]/g, ' ').replace(/[✔️👇💓🌿👆🙂😊]|💆‍♀️/gu, '').replace(/["„”“”'’‘–—-]/g, '').replace(/[.,:;!?()*+>»«\/]/g, '').replace(/\s+/g, ' ').trim();
const FEJLEC = new Set(['head spa', 'páros head spa', 'szőrtelenítés', 'fodrászat', 'oxigénterápia', 'sminktetoválás', 'ajándékkártya', 'árlista', 'foglalás', 'foglalás ›', 'gyik', 'kapcsolat', 'időpontfoglalás', 'menü', 'en', 'hu', 'i']);
const kepNev = (u) => decodeURIComponent((u || '').split('?')[0].split('/').pop() || '').replace(/\.(jpe?g|png|webp|gif|avif)$/i, '').replace(/~mv2$/, '').replace(/^.*?_([0-9a-f]{20,})/, '$1').toLowerCase();

const b = await chromium_launch();
async function chromium_launch() { const { chromium } = playwright(); return chromium.launch({ executablePath: CHROME, headless: true }); }
let hiba = 0;
for (const mobil of [false, true]) {
  const ctx = await b.newContext({ ignoreHTTPSErrors: !!process.env.HTTPS_HIBA_NEM_BAJ, viewport: { width: mobil ? 390 : 1440, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], http404 = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message.slice(0, 120)));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text().slice(0, 120)); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) http404.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost|https:\/\/www\.mosaicheadspa\.hu|https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev)/, (r) => r.abort());
  await p.goto(UJ, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 70)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(600);
  const adat = await p.evaluate(() => ({
    szoveg: (document.querySelector('main') || document.body).innerText + '\n' + [...document.querySelectorAll('main [aria-label], main img[alt], main [title]')].map((e) => e.getAttribute('aria-label') || e.getAttribute('alt') || e.getAttribute('title')).join('\n') + '\n' + document.title
      + '\n' + [...document.querySelectorAll('main details')].map((d) => d.textContent).join('\n'),
    torott: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc.replace(location.origin, '')),
    szeles: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1: document.querySelectorAll('h1').length,
    linkek: [...document.querySelectorAll('main a[href]')].map((a) => a.getAttribute('href')),
    kepek: [...document.querySelectorAll('main img, main video[poster], main source, main [style*="background-image"]')].map((e) => (e.currentSrc || e.src || e.getAttribute('poster') || e.getAttribute('style') || '')),
  }));
  const rossz = adat.szeles > 0 || adat.torott.length || http404.length || hibak.length || adat.h1 !== 1;
  console.log(`[${mobil ? 'mobil ' : 'asztal'}] vizszintes tobblet: ${adat.szeles}px | H1: ${adat.h1} | torott kep: ${adat.torott.length ? adat.torott.join(', ') : '-'} | 404: ${http404.length ? http404.join(', ') : '-'} | hibak: ${hibak.length ? hibak.join(' ; ') : '-'}`);
  if (rossz) hiba++;
  if (!mobil) {
    const ujNorm = norm(adat.szoveg);
    let sorok = regi.szoveg.split('\n').map((s) => s.trim()).filter((s) => s.length > 2);
    const kezd = KEZD ? sorok.findIndex((s) => new RegExp(KEZD, 'i').test(s)) : sorok.findIndex((s, i) => i > 3 && /októberi akció/i.test(s));
    const veg = sorok.findIndex((s) => /^Big in Japan Kft/.test(s));
    sorok = sorok.slice(kezd >= 0 ? kezd : 0, veg >= 0 ? veg : undefined).filter((s) => !FEJLEC.has(s.toLowerCase()) && !(KIHAGY && new RegExp(KIHAGY, 'i').test(s)));
    const hianyzik = [];
    for (const s of sorok) {
      const n = norm(s);
      if (n.length < 3 || ujNorm.includes(n)) continue;
      const szavak = n.split(' ').filter(Boolean);
      const talalt = szavak.filter((w) => ujNorm.includes(w)).length;
      if (szavak.length > 3 && talalt / szavak.length >= 0.94 && n.length > 25) continue;   // tordeles-kulonbseg
      hianyzik.push(s);
    }
    console.log(`szoveg-hűseg: a regi oldal ${sorok.length} sorabol ${hianyzik.length} nem talalhato az ujban${hianyzik.length ? ':' : ''}`);
    for (const s of hianyzik.slice(0, 40)) console.log('   - ' + s.slice(0, 180));
    if (hianyzik.length) hiba++;
    // kepek (fajlnev szerint)
    const ujKepek = new Set(adat.kepek.flatMap((s) => [kepNev(s), ...[...s.matchAll(/url\(["']?([^"')]+)/g)].map((m) => kepNev(m[1]))]));
    const hianyKep = regi.kep.map((k) => kepNev(k.src)).filter((n, i, t) => n && t.indexOf(n) === i && !ujKepek.has(n));
    console.log(`kepek: a regi oldal ${new Set(regi.kep.map((k) => kepNev(k.src))).size} kepebol ${hianyKep.length} nincs meg az ujban (fajlnev szerint; a regi fejleces / lableces kepek, ikonok szandekosan elmaradhatnak)${hianyKep.length ? ':' : ''}`);
    for (const n of hianyKep.slice(0, 30)) console.log('   - ' + n);
    // linkek
    const ujLinkek = new Set(adat.linkek.map((h) => h.replace(/^https?:\/\/(www\.)?mosaicheadspa\.hu/, '').replace(/\/$/, '')));
    const hianyLink = regi.linkek.map(([, h]) => h).filter((h) => h && !/^(#|tel:|mailto:|javascript:)/.test(h) && !/mosaicheadspa\.hu\/?$/.test(h)).map((h) => h.replace(/^https?:\/\/(www\.)?mosaicheadspa\.hu/, '').replace(/\/$/, ''))
      .filter((h, i, t) => t.indexOf(h) === i && !ujLinkek.has(h));
    console.log(`linkek: a regi oldal linkjei kozul ${hianyLink.length} nincs a tartalomban (a fejlec / lablec linkjei itt nem szamitanak; foglalo-gomboknal a /foglalo-motor?... atkotes normalis)${hianyLink.length ? ':' : ''}`);
    for (const h of hianyLink.slice(0, 30)) console.log('   - ' + h.slice(0, 140));
  }
  await ctx.close();
}
await b.close();
console.log(hiba ? '\nVAN TEENDO (lasd fent)' : '\nrendben');
process.exit(hiba ? 1 : 0);
