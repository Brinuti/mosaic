// Az uj, rejtett fooldal (/uj-fooldal) probaja a helyi kiszolgalon (tools/serve.mjs), Playwrighttal.
//
//   node tools/build.mjs && node tools/serve.mjs &     majd:     node tools/uj-fooldal-teszt.mjs
//   BASE=https://<ag>.medicalpiercing.pages.dev node tools/uj-fooldal-teszt.mjs     (elonezeten / eles cimen is fut)
//
// Nem helyi cimen (elonezet, eles) minden merokeres blokkolva van (tools/meres-tiltas.mjs: GTM, GA4, Ads, Meta, TikTok, stape), es a
// Salonic-hivasok is: a teszt nem szennyezi a statisztikat, es nem indit foglalast.
//
// Ellenorzi: rejtett (noindex, nincs canonical, nincs a sitemapben), minden belso link es horgony celja, nincs JS-hiba, nincs
// Wix-keres, minden kep betolt, nincs vizszintes gorgetes 360-1920 px kozott, fejlec-menu, "osszes piercing", videoablak, a
// Google-velemenyek: a valodi Trustindex-widget (lapozhato, sok velemeny) es a hiba eseti tartalek, a foglalomotor megnyilik a foglalasi gombra
// (a Salonic-kereseket eldobjuk: valodi foglalas nem indul), a Google-kattintasazonosito tovabbadasa a belso linkekre.
// Minden lepes OK/HIBA sort ir; hiba eseten 1-es kilepesi koddal all le.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { kulcsbol } from '../lib/utvonal.js';
import { meresTiltas, MERES } from './meres-tiltas.mjs';

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
const szoveg = forras.replace(/<[^>]+>/g, ' ');
ok('forras: sehol nincs "6 honap" (a tulajdonos kerese: csak "garancia")', !/6\s*hónap/i.test(szoveg));
ok('forras: nincs "orvosi ekszer" (G23 titanium ekszer)', !/orvosi\s+ékszer/i.test(szoveg));
const helyek = [...forras.matchAll(/<ul class="helyek">([\s\S]*?)<\/ul>/g)].flatMap((m) => [...m[1].matchAll(/<b>([^<]+)<\/b>/g)].map((x) => x[1]));
const motorVarosok = [...fs.readFileSync(path.join(ROOT, 'assets/js/motor/salonic-adapter.js'), 'utf8').matchAll(/varos: '([^']+)'/g)].map((m) => m[1]);
ok(`forras: mind a ${motorVarosok.length} foglalasi helyszin kint van a helyszin-blokkban`, helyek.length === motorVarosok.length && motorVarosok.every((v) => helyek.includes(v)), helyek.length + ' db');
ok('forras: az ekszer-galeria 20 diaja', (forras.match(/class="dia"/g) || []).length === 20);
const css = fs.readFileSync(path.join(ROOT, 'assets/css/uj-fooldal.css'), 'utf8');
ok('stilus: az eredeti paletta (#d7aba8 gomb, #454659 szoveg), nincs burgundi', /--rose:#d7aba8/.test(css) && /--slate:#454659/.test(css) && !/#b0525f|#a94f5c|#b95a68|#9a4553|#7c3d49|#93505d|#a85b68|#9f4a57/i.test(css));
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
ok('forras: kulso linkek (target=_blank + noopener; a Salonic-foglalo linkek helyben, a motorral nyilnak)', [...forras.matchAll(/<a\b[^>]*href="https?:[^"]*"[^>]*>/g)].filter((m) => !/medicalpiercing\.salonic\.hu/.test(m[0])).every((m) => /target="_blank"/.test(m[0]) && /rel="noopener"/.test(m[0])), kulso.length + ' db');
ok('forras: nincs "Szeptember 1-től", nincs levelike az akcion', !/Szeptember 1/i.test(szoveg) && !/akcio-level/.test(forras));
const tileLinkek = [...forras.matchAll(/<ul class="helyek">([\s\S]*?)<\/ul>/g)].flatMap((m) => [...m[1].matchAll(/<a href="([^"]+)"/g)].map((x) => x[1]));
ok('forras: mind a 15 helyszin-csempe a foglalot nyitja az adott helyszinnel (placeId)', tileLinkek.length === 15 && tileLinkek.every((h) => /^https:\/\/medicalpiercing\.salonic\.hu\/selectEmployee\/\?placeId=\d+$/.test(h)), tileLinkek.length + ' db');

const b = await chromium.launch();
const ENGEDELYEZETT = /^(https?:\/\/(localhost|127\.0\.0\.1)|data:|blob:|https:\/\/([a-z0-9.-]*trustindex\.io|lh3\.googleusercontent\.com|maps\.google\.com|www\.google\.com|maps\.gstatic\.com|maps\.googleapis\.com|www\.youtube-nocookie\.com|embed\.rtl\.hu)\b)/;
const SAJAT_HOST = new URL(BASE).host;
// nem helyi cimen a merokodok (suti.js: csak az eles domainen futnak) kerest inditanak: ezeket blokkoljuk, es nem szamit "kulso kerésnek"
const MERO = (u) => !HELYI && (MERES.test(u) || /cloudflareinsights\.com|googlesyndication\.com/.test(u));
const ujKornyezet = async (opt) => {
  const c = await b.newContext(opt);
  if (!HELYI) { await meresTiltas(c); await c.route(/cloudflareinsights\.com|googlesyndication\.com/, (r) => r.abort()); }
  return c;
};

async function ujLap(ctx, mod = {}) {
  const p = await ctx.newPage();
  p.hibak = []; p.kulso = []; p.rossz = []; p.wix = [];
  p.on('pageerror', (e) => p.hibak.push(e.message));
  p.on('requestfailed', (r) => { if (!/ERR_ABORTED|ERR_BLOCKED/.test((r.failure() || {}).errorText || '') || r.url().startsWith(BASE)) { if (r.url().startsWith(BASE)) p.rossz.push('FAIL ' + r.url()); } });
  p.on('response', (r) => { const u = r.url(); if (u.startsWith(BASE) && r.status() >= 400) p.rossz.push(r.status() + ' ' + u); });
  p.on('request', (r) => { const u = r.url(); if (/wixstatic|wix\.com|parastorage|wixapps/.test(u)) p.wix.push(u); if (!ENGEDELYEZETT.test(u) && !u.startsWith(BASE) && !MERO(u)) p.kulso.push(u); });
  // a Salonic-hivasok es a meres soha ne menjenek el (valodi foglalas / szennyezett statisztika)
  await p.route(/medicalpiercing\.salonic\.hu|api\.salonic\.hu/, (r) => r.abort());
  if (mod.trustindex) await p.route(/trustindex\.io/, mod.trustindex);
  return p;
}

for (const [nezet, opt] of [['asztali', { viewport: { width: 1440, height: 900 } }], ['mobil', { ...devices['Pixel 5'] }]]) {
  const ctx = await ujKornyezet(opt);
  const mobil = nezet === 'mobil';

  // ---------- 2. betoltes, hibak, keresek ----------
  const p = await ujLap(ctx);
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
  const kepek = await p.$$eval('img', (is) => is.filter((i) => !i.closest('.ti-widget') && !i.closest('dialog') && (!i.complete || i.naturalWidth === 0)).map((i) => i.currentSrc || i.src));
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

  // ---------- 4. velemenyek: a valodi Trustindex-widget, lapozhato, sok velemennyel ----------
  await p.locator('.velemeny-doboz').scrollIntoViewIfNeeded();
  await p.mouse.move(200, 300); await p.mouse.wheel(0, 30);   // a Trustindex a felhasznaloi gorgetesre / erintesre tolt (programozott gorgetesre nem)
  const widget = await p.waitForSelector('.ti-widget .ti-review-item', { timeout: 15000 }).then(() => true).catch(() => false);
  const tiAdat = widget ? await p.evaluate(() => ({ db: document.querySelectorAll('.ti-review-item').length, lathato: [...document.querySelectorAll('.ti-review-item')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 50 && r.right > 0 && r.left < innerWidth; }).length, kov: !!document.querySelector('.ti-next') && getComputedStyle(document.querySelector('.ti-next')).display !== 'none', tartalekRejtett: document.querySelector('[data-tartalek]').hidden })) : null;
  ok(`${nezet}: Trustindex-widget: sok velemeny (>= 10), lapozo nyil, a tartalek rejtve`, !!tiAdat && tiAdat.db >= 10 && tiAdat.kov && tiAdat.tartalekRejtett, JSON.stringify(tiAdat));
  if (widget) {
    const elso = await p.evaluate(() => document.querySelector('.ti-review-item .ti-name').textContent.trim());
    await p.click('.ti-next'); await p.waitForTimeout(900);
    const kov = await p.evaluate(() => { const sav = document.querySelector('.ti-reviews-container-wrapper'); return { x: sav ? sav.scrollLeft : 0, tr: sav ? getComputedStyle(sav).transform : '', prev: document.querySelector('.ti-prev') ? getComputedStyle(document.querySelector('.ti-prev')).display : '' }; });
    ok(`${nezet}: Trustindex-widget: a nyil lapoz (az elozo nyil megjelenik)`, kov.prev !== 'none' && kov.prev !== '', JSON.stringify(kov) + ' ' + elso);
  }
  if (!mobil) {
    // a hiba eseti tartalek: ha a widget nem toltodik be, 9 mp mulva a mentett velemenyek latszanak
    const p2 = await ujLap(ctx, { trustindex: (r) => r.abort() });
    await p2.goto(LAP, { waitUntil: 'load' }); await p2.waitForTimeout(10000);
    const tart = await p2.evaluate(() => ({ lathato: !document.querySelector('[data-tartalek]').hidden, nevek: [...document.querySelectorAll('[data-tartalek] article.velemeny header b')].map((x) => x.textContent) }));
    ok('asztali: Trustindex hiba eseten a mentett velemenyek latszanak', tart.lathato && tart.nevek.join() === 'Angéla Szemző,Zseszti' && p2.hibak.length === 0, JSON.stringify(tart) + p2.hibak.join());
    await p2.close();
  }

  // ---------- 5. fejlec / menu ----------
  if (mobil) {
    await p.evaluate(() => scrollTo(0, 0));
    await p.click('#menu-nyito');
    await p.waitForTimeout(400);
    const mm = await p.evaluate(() => {
      const m = document.querySelector('#menu'), r = m.getBoundingClientRect(), cs = getComputedStyle(m);
      const link = (t) => { const a = [...m.querySelectorAll('a,button')].find((x) => x.textContent.trim().startsWith(t)); const q = a.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight && q.height > 20; };
      return { h: Math.round(r.height), vis: cs.visibility, ar: link('Árak'), garancia: link('Garancia'), blog: link('Blog'), expanded: document.querySelector('#menu-nyito').getAttribute('aria-expanded') };
    });
    ok(`${nezet}: a mobilmenu teljes magassagu es lathato (nem nulla magas), a linkek a kepernyon`, mm.h > 300 && mm.vis === 'visible' && mm.ar && mm.garancia && mm.blog && mm.expanded === 'true', JSON.stringify(mm));
    await p.click('#menu .menu-gomb[aria-controls="alm-piercingek"]');
    ok(`${nezet}: almenu nyilik`, await p.isVisible('#alm-piercingek a[href$="/migren-piercing"]'));
    await p.click('#menu .menu-gomb[aria-controls="alm-piercingek"]');
    ok(`${nezet}: a menu alja: foglalas gomb, telefon, e-mail`, (await p.locator('#menu .menu-lab .menu-cta').count()) === 1 && (await p.locator('#menu .menu-kapcsolat a[href^="tel:"]').count()) === 1);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(350);
    ok(`${nezet}: Esc zarja a menut`, await p.$eval('#menu', (m) => getComputedStyle(m).visibility === 'hidden'));
  } else {
    ok(`${nezet}: almenu zarva alapbol`, !(await p.isVisible('#alm-piercingek')));
    await p.click('.menu-gomb[aria-controls="alm-piercingek"]');
    ok(`${nezet}: almenu nyilik kattintasra`, (await p.isVisible('#alm-piercingek a[href$="/migren-piercing"]')) && (await p.getAttribute('.menu-gomb[aria-controls="alm-piercingek"]', 'aria-expanded')) === 'true');
    await p.mouse.click(700, 500);
    ok(`${nezet}: kivul kattintva zarul`, !(await p.isVisible('#alm-piercingek')));
    await p.evaluate(() => scrollTo(0, 600)); await p.waitForTimeout(250);
    ok(`${nezet}: fejlec ragad es arnyekot kap gorgetve`, await p.$eval('#fejlec', (f) => f.classList.contains('gorgetve') && f.getBoundingClientRect().top === 0));
    await p.evaluate(() => scrollTo(0, 0));
  }
  await p.keyboard.press('Escape');

  // ---------- 5b. hos sorrend, gomb-szin, galeria ----------
  const hos = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const h = r('.hos-cim'), k = r('.hos-kep'), t = r('.hos-bevezeto'); return { h: [h.left, h.top], k: [k.left, k.top], t: [t.left, t.top] }; });
  ok(`${nezet}: hos sorrend (${mobil ? 'cim, kep, szoveg egymas alatt' : 'cim+szoveg balra, kep jobbra'})`, mobil ? hos.h[1] < hos.k[1] && hos.k[1] < hos.t[1] : hos.k[0] > hos.h[0] + 300 && hos.t[1] > hos.h[1], JSON.stringify(hos));
  const gomb = await p.$eval('.hos .gomb-tomor', (g) => ({ bg: getComputedStyle(g).backgroundColor, szin: getComputedStyle(g).color, kerek: getComputedStyle(g).borderTopLeftRadius }));
  ok(`${nezet}: gomb = az eredeti oldal gombja (#d7aba8, feher, pill)`, gomb.bg === 'rgb(215, 171, 168)' && gomb.szin === 'rgb(255, 255, 255)' && parseFloat(gomb.kerek) >= 20, JSON.stringify(gomb));
  await p.locator('#galeria-sav').scrollIntoViewIfNeeded();
  const gal0 = await p.evaluate(() => ({ db: document.querySelectorAll('.dia').length, szam: document.querySelector('[data-aktualis]').textContent, elozoTiltva: document.querySelector('.galeria-elozo').disabled, w: document.querySelector('#galeria-sav').clientWidth, magassag: document.querySelector('.galeria').getBoundingClientRect().height }));
  ok(`${nezet}: galeria: 20 dia, 1. dian all, az elozo tiltva, nagy (${Math.round(gal0.w)} px)`, gal0.db === 20 && gal0.szam === '1' && gal0.elozoTiltva && gal0.w >= (mobil ? 300 : 500), JSON.stringify(gal0));
  await p.click('.galeria-kov');
  await p.waitForFunction(() => document.querySelector('[data-aktualis]').textContent === '2', null, { timeout: 4000 }).catch(() => {});
  const gal1 = await p.evaluate(() => ({ szam: document.querySelector('[data-aktualis]').textContent, elozoTiltva: document.querySelector('.galeria-elozo').disabled }));
  ok(`${nezet}: galeria: a nyil helyben lapoz (2 / 20), az elozo feloldva`, gal1.szam === '2' && !gal1.elozoTiltva, JSON.stringify(gal1));
  await p.focus('#galeria-sav'); await p.keyboard.press('ArrowRight');
  await p.waitForFunction(() => document.querySelector('[data-aktualis]').textContent === '3', null, { timeout: 4000 }).catch(() => {});
  ok(`${nezet}: galeria: a jobbra nyil billentyu lapoz (3 / 20)`, (await p.textContent('[data-aktualis]')) === '3');
  await p.evaluate(() => { const g = document.querySelector('#galeria-sav'); g.style.scrollBehavior = 'auto'; g.scrollLeft = g.scrollWidth; });
  await p.waitForFunction(() => document.querySelector('[data-aktualis]').textContent === '20', null, { timeout: 4000 }).catch(() => {});
  const gal2 = await p.evaluate(() => ({ szam: document.querySelector('[data-aktualis]').textContent, kovTiltva: document.querySelector('.galeria-kov').disabled }));
  ok(`${nezet}: galeria: a vegen 20 / 20, a kovetkezo tiltva`, gal2.szam === '20' && gal2.kovTiltva, JSON.stringify(gal2));
  await p.evaluate(() => { const g = document.querySelector('#galeria-sav'); g.style.scrollBehavior = 'auto'; g.scrollLeft = 0; });
  await p.waitForFunction(() => document.querySelector('[data-aktualis]').textContent === '1', null, { timeout: 4000 }).catch(() => {});

  // ---------- 5c. nagyito: kattintasra nagyban nyilik ----------
  await p.locator('.dia-nagyit').first().click();
  await p.waitForFunction(() => { const k = document.querySelector('.nagyito-kep'); return document.querySelector('#nagyito').open && k.naturalWidth === 1400; }, null, { timeout: 8000 }).catch(() => {});
  const n1 = await p.evaluate(() => ({ nyitva: document.querySelector('#nagyito').open, src: document.querySelector('.nagyito-kep').getAttribute('src') || '', nat: document.querySelector('.nagyito-kep').naturalWidth, szam: document.querySelector('[data-n]').textContent, w: Math.round(document.querySelector('.nagyito-kep').getBoundingClientRect().width), galW: Math.round(document.querySelector('.galeria').getBoundingClientRect().width) }));
  ok(`${nezet}: a galeria kepe kattintasra nagyban nyilik (1400 px-es kep, nagyobb a galeriaknal)`, n1.nyitva && /uj-ekszer-01-nagy\.webp/.test(n1.src) && n1.nat === 1400 && n1.szam === '1' && n1.w >= n1.galW, JSON.stringify(n1));
  await p.click('.nagyito-kov'); await p.waitForTimeout(250);
  const n2 = await p.textContent('[data-n]');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250);
  const n3 = await p.textContent('[data-n]');
  ok(`${nezet}: nagyito: a nyil es a billentyu lapoz (2 majd vissza 1)`, n2 === '2' && n3 === '1', n2 + ' ' + n3);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(`${nezet}: nagyito: Esc zarja`, await p.$eval('#nagyito', (d) => !d.open));

  // ---------- 5d. akcio, doktor-badge, helyszin-csempek, lablec, mobil hos ----------
  const bn = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const gomb = r('.akcio-jobb .gomb'), ar = r('.akcio-arak'); return { gomb: gomb.left + gomb.width / 2, arak: ar.left + ar.width / 2, gombTop: gomb.top, arakAlja: ar.bottom }; });
  ok(`${nezet}: az akcio gombja a harom arbox alatt, kozepen`, Math.abs(bn.gomb - bn.arak) < 3 && bn.gombTop >= bn.arakAlja - 1, JSON.stringify(bn));
  if (!mobil) {
    const al = await p.evaluate(() => ({ gomb: document.querySelector('.orvos .panel-szoveg .gomb').getBoundingClientRect().bottom, badge: document.querySelector('.orvos-kep figcaption').getBoundingClientRect().bottom }));
    ok('asztali: a doktor badge alja pontosan a mellette levo gomb aljan van', Math.abs(al.gomb - al.badge) <= 2, JSON.stringify(al));
  }
  await p.locator('.helyek').scrollIntoViewIfNeeded(); await p.waitForTimeout(1200);
  const datumDb = await p.$$eval('.helyek .datum', (els) => els.filter((e) => /\d/.test(e.textContent)).length);
  ok(`${nezet}: a kitelepulesi idopontok kint vannak a csempeken (>= 10 helyszin)`, datumDb >= 10, datumDb + ' db');
  await p.locator('.helyek a').nth(4).click();   // Kecskemet
  await p.waitForSelector('[data-mp-motor]', { timeout: 15000 }).catch(() => {});
  const hm = await p.evaluate(() => { const h = document.querySelector('[data-mp-motor]'); return { van: !!h, urlMarad: location.pathname }; });
  ok(`${nezet}: egy helyszin-csempe a foglalomotort nyitja (nem erre az oldalra visz)`, hm.van && hm.urlMarad === '/uj-fooldal', JSON.stringify(hm));
  await p.evaluate(() => document.querySelector('[data-mp-motor]')?.remove());
  const lab = await p.evaluate(() => { const bg = getComputedStyle(document.querySelector('.lablec')).backgroundColor; const j = document.querySelector('.jogi p').getBoundingClientRect(), t = document.querySelector('.lablec .tarto').getBoundingClientRect(); return { bg, jogi: Math.round(j.width), tarto: Math.round(t.width), magassag: Math.round(document.querySelector('.lablec').getBoundingClientRect().height) }; });
  ok(`${nezet}: a lablec sotetebb a tobbi resznel, a jogi szoveg teljes szelessegu`, lab.bg !== 'rgb(255, 255, 255)' && lab.jogi >= lab.tarto - 2, JSON.stringify(lab));
  if (mobil) {
    await p.setViewportSize({ width: 390, height: 700 }); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(250);
    const hb = await p.$eval('.hos .gomb-tomor', (e) => Math.round(e.getBoundingClientRect().bottom));
    ok('mobil: a hos elso gombja teljesen latszik 390x700-on (cim, kep, kisebb alcim, gomb)', hb <= 700, hb + ' px');
    await p.setViewportSize(opt.viewport);
  }


  if (mobil) {
    const m = await p.evaluate(() => {
      const kozep = (e) => { const r = e.getBoundingClientRect(); return r.left + r.width / 2; };
      const panel = document.querySelector('.garancia'), gombEl = panel.querySelector('.gomb'), cimEl = panel.querySelector('h2');
      const orvos = document.querySelector('.orvos-kep'), kep = orvos.querySelector('img');
      const lablec = document.querySelector('.lablec').getBoundingClientRect();
      return { panelKozep: kozep(panel), gombKozep: kozep(gombEl), cimKozep: kozep(cimEl), orvosSzeles: orvos.getBoundingClientRect().width, kepSzeles: kep.getBoundingClientRect().width, helyekMagassag: document.querySelector('.helyek').getBoundingClientRect().height, lablecMagassag: lablec.height, arGomb: kozep(document.querySelector('.arak-szoveg .gomb')), arPanel: kozep(document.querySelector('.arak')) };
    });
    ok('mobil: a garancia doboz gombja es cime kozepen', Math.abs(m.gombKozep - m.panelKozep) < 4 && Math.abs(m.cimKozep - m.panelKozep) < 4, JSON.stringify(m));
    ok('mobil: az arak gombja kozepen', Math.abs(m.arGomb - m.arPanel) < 4);
    ok('mobil: az orvosi foto teljes szelessegu', m.kepSzeles >= m.orvosSzeles - 1, `${m.kepSzeles}/${m.orvosSzeles}`);
    ok('mobil: mind a 15 helyszin idopontokkal egyutt is kompakt (< 1350 px)', m.helyekMagassag < 1350, Math.round(m.helyekMagassag) + ' px');
    ok('mobil: a lablec kompakt (< 650 px)', m.lablecMagassag < 650, Math.round(m.lablecMagassag) + ' px');
  }

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
  const ctx = await ujKornyezet({ viewport: { width: 1280, height: 800 } });
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
