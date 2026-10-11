// Az uj, rejtett fooldal (/uj-fooldal) probaja a helyi kiszolgalon (tools/serve.mjs), Playwrighttal.
//
//   node tools/build.mjs && node tools/serve.mjs &     majd:     node tools/uj-fooldal-teszt.mjs
//   BASE=https://<ag>.medicalpiercing.pages.dev node tools/uj-fooldal-teszt.mjs     (elonezeten / eles cimen is fut)
//
// Ellenorzi: rejtett (noindex, nincs canonical, nincs a sitemapben), minden belso link es horgony celja, nincs JS-hiba, nincs
// Wix-keres, minden kep betolt, nincs vizszintes gorgetes 360-1920 px kozott, fejlec-menu, "osszes piercing", videoablak, a
// Google-velemenyek elo frissitese (mockolt Trustindex) es a hiba eseti tartalek, a foglalomotor megnyilik a foglalasi gombra
// (a Salonic-kereseket eldobjuk: valodi foglalas nem indul), a Google-kattintasazonosito tovabbadasa a belso linkekre.
// Minden lepes OK/HIBA sort ir; hiba eseten 1-es kilepesi koddal all le.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { kulcsbol } from '../lib/utvonal.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = (process.env.BASE || 'http://localhost:4290').replace(/\/$/, '');
const HELYI = /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE);
const LAP = BASE + '/uj-fooldal';
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; };

// ---------- 1. forras: rejtett, linkek, horgonyok (halozat nelkul) ----------
const forras = fs.readFileSync(path.join(ROOT, 'uj-fooldal/index.html'), 'utf8');
ok('forras: noindex,nofollow meta', /<meta name="robots" content="noindex,nofollow">/.test(forras));
ok('forras: nincs canonical', !/rel="canonical"/.test(forras));
ok('forras: pontosan egy h1', (forras.match(/<h1[\s>]/g) || []).length === 1);
ok('forras: minden kepnek van alt attributuma', ![...forras.matchAll(/<img\b[^>]*>/g)].some((m) => !/\salt="/.test(m[0])));
ok('forras: a sitemapben nincs', !fs.readFileSync(path.join(ROOT, 'tools/sitemap-oldalak.txt'), 'utf8').includes('uj-fooldal') && !fs.readFileSync(path.join(ROOT, 'tools/oldalak.txt'), 'utf8').includes('uj-fooldal'));
const hrefek = [...new Set([...forras.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))];
const belso = hrefek.filter((h) => h.startsWith('/') && !h.startsWith('/assets/'));
const rossz = [];
for (const h of belso) {
  let ut;
  try { ut = decodeURIComponent(h.replace(/[?#].*$/, '')); } catch { rossz.push(h); continue; }
  const k = ut === '/' ? 'index' : kulcsbol(ut);
  if (!fs.existsSync(path.join(ROOT, 'klon', k + '.html'))) rossz.push(h);
}
ok(`forras: ${belso.length} belso link mind letezo oldalra mutat`, rossz.length === 0, rossz.join(' '));
const idk = new Set([...forras.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const horgonyok = hrefek.filter((h) => /^#./.test(h)).map((h) => h.slice(1));
ok(`forras: ${horgonyok.length} horgony mind letezo azonositora mutat`, horgonyok.every((h) => idk.has(h)), horgonyok.filter((h) => !idk.has(h)).join(' '));
const kulso = hrefek.filter((h) => /^https?:/.test(h));
ok('forras: kulso linkek (target=_blank + noopener)', [...forras.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)].every((m) => /target="_blank"/.test(m[0]) && /rel="noopener"/.test(m[0])), kulso.length + ' db');

const b = await chromium.launch();
const ENGEDELYEZETT = /^(https?:\/\/(localhost|127\.0\.0\.1)|data:|blob:|https:\/\/(cdn\.trustindex\.io|maps\.google\.com|www\.google\.com|maps\.gstatic\.com|maps\.googleapis\.com|www\.youtube-nocookie\.com|embed\.rtl\.hu)\b)/;
const SAJAT_HOST = new URL(BASE).host;

async function ujLap(ctx, mod = {}) {
  const p = await ctx.newPage();
  p.hibak = []; p.kulso = []; p.rossz = []; p.wix = [];
  p.on('pageerror', (e) => p.hibak.push(e.message));
  p.on('requestfailed', (r) => { if (!/ERR_ABORTED|ERR_BLOCKED/.test((r.failure() || {}).errorText || '') || r.url().startsWith(BASE)) { if (r.url().startsWith(BASE)) p.rossz.push('FAIL ' + r.url()); } });
  p.on('response', (r) => { const u = r.url(); if (u.startsWith(BASE) && r.status() >= 400) p.rossz.push(r.status() + ' ' + u); });
  p.on('request', (r) => { const u = r.url(); if (/wixstatic|wix\.com|parastorage|wixapps/.test(u)) p.wix.push(u); if (!ENGEDELYEZETT.test(u) && !u.startsWith(BASE)) p.kulso.push(u); });
  // a Salonic-hivasok es a meres soha ne menjenek el (valodi foglalas / szennyezett statisztika)
  await p.route(/medicalpiercing\.salonic\.hu|api\.salonic\.hu/, (r) => r.abort());
  if (mod.trustindex) await p.route(/cdn\.trustindex\.io\/widgets\//, mod.trustindex);
  return p;
}

for (const [nezet, opt] of [['asztali', { viewport: { width: 1440, height: 900 } }], ['mobil', { ...devices['Pixel 5'] }]]) {
  const ctx = await b.newContext(opt);
  const mobil = nezet === 'mobil';

  // ---------- 2. betoltes, hibak, keresek ----------
  const mockolt = (r) => r.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body:
    '<div class="ti-widget"><span class="ti-header-rating">4.7</span><span class="ti-header-rating-reviews">5001 vélemény</span>' +
    '<div class="ti-review-item" data-rating="5.0"><div class="ti-name"> Próba Elek </div><div class="ti-review-content">Ez egy próba vélemény, amely elég hosszú a szűrőhöz.</div></div>' +
    '<div class="ti-review-item" data-rating="4.0"><div class="ti-name">Teszt Anna</div><div class="ti-review-content">Második próba vélemény, szintén elég hosszú szöveggel.</div></div>' +
    '<div class="ti-review-item" data-rating="2.0"><div class="ti-name">Rossz Béla</div><div class="ti-review-content">Ez a rossz értékelés nem kerülhet ki a kártyák közé.</div></div></div>' });
  const p = await ujLap(ctx, { trustindex: mockolt });
  const v = await p.goto(LAP, { waitUntil: 'load' });
  ok(`${nezet}: 200-as valasz`, v.status() === 200, String(v.status()));
  ok(`${nezet}: noindex (meta)`, await p.$eval('meta[name="robots"]', (m) => /noindex/.test(m.content)));
  if (!HELYI) ok(`${nezet}: noindex (X-Robots-Tag fejlec)`, /noindex/.test(v.headers()['x-robots-tag'] || ''), v.headers()['x-robots-tag'] || '');
  await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
  await p.waitForTimeout(2500);
  ok(`${nezet}: nincs JS-hiba`, p.hibak.length === 0, p.hibak.join(' | '));
  ok(`${nezet}: nincs 4xx/5xx es sikertelen sajat keres`, p.rossz.length === 0, p.rossz.slice(0, 4).join(' | '));
  ok(`${nezet}: nincs Wix-keres`, p.wix.length === 0, p.wix.slice(0, 3).join(' '));
  ok(`${nezet}: nincs nem engedelyezett kulso keres`, p.kulso.length === 0, [...new Set(p.kulso.map((u) => new URL(u).host))].slice(0, 6).join(' '));
  const kepek = await p.$$eval('img', (is) => is.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
  ok(`${nezet}: minden kep betoltott`, kepek.length === 0, kepek.slice(0, 3).join(' '));
  const betu = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.family.includes('Plus Jakarta')).map((f) => f.status).join(','); });
  ok(`${nezet}: betu betoltott (latin + latin-ext: o/u dupla ekezet)`, /loaded.*loaded|loaded,loaded/.test(betu) || (betu.split(',').filter((x) => x === 'loaded').length >= 2), betu);
  ok(`${nezet}: a mero- es motorkod nincs rejtve: motor-indito + mp-meres a lapon`, (await p.$$eval('script[src]', (s) => s.map((x) => x.getAttribute('src')))).filter((s) => /motor-indito|mp-meres|suti/.test(s)).length === 3);

  // ---------- 3. elrendezes: nincs vizszintes gorgetes ----------
  for (const w of mobil ? [360, 390, 430, 768] : [1024, 1180, 1280, 1440, 1920]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(150);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    ok(`${nezet}: ${w}px: nincs vizszintes gorgetes`, m.sw <= m.iw, `${m.sw}/${m.iw}`);
  }
  await p.setViewportSize(opt.viewport);

  // ---------- 4. velemenyek: elo frissites (mockolt Trustindex) ----------
  const vel = await p.evaluate(() => ({ pont: document.querySelector('[data-ertekeles]').textContent, darab: document.querySelector('[data-darab]').textContent, nevek: [...document.querySelectorAll('article.velemeny header b')].map((x) => x.textContent), jo: !document.body.textContent.includes('Rossz Béla') }));
  ok(`${nezet}: velemenyek elo frissitese`, vel.pont === '4.7' && /5.001/.test(vel.darab) && vel.nevek.join() === 'Próba Elek,Teszt Anna' && vel.jo, JSON.stringify(vel));
  const p2 = await ujLap(ctx, { trustindex: (r) => r.abort() });
  await p2.goto(LAP, { waitUntil: 'load' }); await p2.waitForTimeout(2200);
  const tart = await p2.evaluate(() => ({ pont: document.querySelector('[data-ertekeles]').textContent, nevek: [...document.querySelectorAll('article.velemeny header b')].map((x) => x.textContent) }));
  ok(`${nezet}: Trustindex hiba eseten marad a mentett adat`, tart.pont === '4.8' && tart.nevek.join() === 'Angéla Szemző,Zseszti' && p2.hibak.length === 0, JSON.stringify(tart) + p2.hibak.join());
  await p2.close();

  // ---------- 5. fejlec / menu ----------
  if (mobil) {
    await p.click('#menu-nyito');
    ok(`${nezet}: hamburger megnyitja a menut`, await p.$eval('#menu', (m) => getComputedStyle(m).display !== 'none') && (await p.getAttribute('#menu-nyito', 'aria-expanded')) === 'true');
    await p.click('#menu .menu-gomb[aria-controls="alm-piercingek"]');
    ok(`${nezet}: almenu nyilik`, await p.isVisible('#alm-piercingek a[href="/migren-piercing"]'));
    await p.keyboard.press('Escape');
    ok(`${nezet}: Esc zarja a menut`, await p.$eval('#menu', (m) => getComputedStyle(m).display === 'none'));
  } else {
    ok(`${nezet}: almenu zarva alapbol`, !(await p.isVisible('#alm-piercingek')));
    await p.click('.menu-gomb[aria-controls="alm-piercingek"]');
    ok(`${nezet}: almenu nyilik kattintasra`, (await p.isVisible('#alm-piercingek a[href="/migren-piercing"]')) && (await p.getAttribute('.menu-gomb[aria-controls="alm-piercingek"]', 'aria-expanded')) === 'true');
    await p.mouse.click(700, 500);
    ok(`${nezet}: kivul kattintva zarul`, !(await p.isVisible('#alm-piercingek')));
    await p.evaluate(() => scrollTo(0, 600)); await p.waitForTimeout(250);
    ok(`${nezet}: fejlec ragad es arnyekot kap gorgetve`, await p.$eval('#fejlec', (f) => f.classList.contains('gorgetve') && f.getBoundingClientRect().top === 0));
    await p.evaluate(() => scrollTo(0, 0));
  }
  await p.keyboard.press('Escape');

  // ---------- 6. osszes piercing ----------
  const elotte = await p.$$eval('.kartya', (k) => k.filter((x) => x.offsetParent !== null).length);
  await p.click('#tobb-piercing');
  const utana = await p.$$eval('.kartya', (k) => k.filter((x) => x.offsetParent !== null).length);
  ok(`${nezet}: "osszes piercing tipus" 6 -> 10 kartya`, elotte === 6 && utana === 10, `${elotte} -> ${utana}`);
  await p.click('#tobb-piercing');
  ok(`${nezet}: ... es vissza 6-ra`, (await p.$$eval('.kartya', (k) => k.filter((x) => x.offsetParent !== null).length)) === 6);

  // ---------- 7. videoablak ----------
  const vid = p.locator('a.video').nth(1);
  await vid.scrollIntoViewIfNeeded();
  await vid.click();
  await p.waitForTimeout(300);
  const ifr = await p.$eval('#videoablak', (d) => ({ nyitva: d.open, src: (d.querySelector('iframe') || {}).src || '' }));
  ok(`${nezet}: video kattintasra ablakban nyilik (youtube-nocookie, enablejsapi)`, ifr.nyitva && /youtube-nocookie\.com\/embed\/JX4nNVb-jB8.*enablejsapi=1/.test(ifr.src), ifr.src);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  ok(`${nezet}: Esc bezarja, az iframe megszunik (a hang leall)`, await p.$eval('#videoablak', (d) => !d.open && !d.querySelector('iframe')));

  // ---------- 8. foglalomotor: a foglalasi gomb megnyitja, a lap cime nem valtozik ----------
  await p.evaluate(() => scrollTo(0, 0));
  const urlElotte = p.url();
  await p.click('.hos .gomb-tomor');
  await p.waitForSelector('[data-mp-motor]', { timeout: 15000 }).catch(() => {});
  const motor = await p.evaluate(() => { const h = document.querySelector('[data-mp-motor]'); return h ? { van: true, szoveg: (h.shadowRoot.querySelector('h2') || {}).textContent || '', lepesek: (h.shadowRoot.querySelector('.lepesek') || {}).textContent || '', tartalom: ((h.shadowRoot.querySelector('.tartalom') || {}).textContent || '').slice(0, 200) } : { van: false }; });
  ok(`${nezet}: az Idopontfoglalas gomb megnyitja a foglalomotort`, motor.van && /Időpontfoglalás/.test(motor.szoveg), JSON.stringify(motor).slice(0, 220));
  ok(`${nezet}: a lap cime nem valtozik`, p.url().split('#')[0].replace(/\?.*$/, '') === urlElotte.replace(/\?.*$/, ''), p.url());
  await p.evaluate(() => document.querySelector('[data-mp-motor]')?.remove());
  await ctx.close();
}

// ---------- 9. Google-kattintasazonosito a belso linkeken ----------
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ujLap(ctx, { trustindex: (r) => r.abort() });
  await p.goto(LAP + '?gclid=Cj0KCQtest12345&utm_source=proba&fbclid=IwARtest', { waitUntil: 'load' });
  const l = await p.$eval('a[href*="/arlista-garancia"]', (a) => a.getAttribute('href'));
  ok('belso link viszi a gclid-et, az fbclid-et nem', /gclid=Cj0KCQtest12345/.test(l) && !/fbclid/.test(l), l);
  const ss = await p.evaluate(() => sessionStorage.getItem('savedQueryParams'));
  ok('munkamenetbe csak a nem-Google parameterek kerulnek (gclid nem)', !!ss && /utm_source/.test(ss) && !/gclid/.test(ss), ss);
  await ctx.close();
}

await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nminden rendben');
process.exit(hiba ? 1 : 0);
