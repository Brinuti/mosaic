// Teljes bejaras: minden oldal asztali es mobil nezetben, a helyi kiszolgalon
// (tools/serve.mjs) vagy egy elonezeti cimen. Oldalankent:
//   - betoltodik-e (200), van-e sajat JS-hiba, hianyzik-e sajat fajl (kep, betu, CSS, JS);
//   - a fejlec menugombja a kepernyon nyitja-e a menut;
//   - minden lathato gomb (button, role=button) kattinthato-e JS-hiba nelkul;
//   - minden link: a belso cimek (asztali es mobil bongeszovel) elnek-e, a foglalasi
//     linkek a medicalpiercing.salonic.hu-ra mutatnak-e, maradt-e Wix-cim.
// Kulso keresek (merokodok, beagyazasok) a bejaras alatt nem mennek ki.
//
//   node tools/bejaras-teszt.mjs                     (http://localhost:4290)
//   CIM=https://<ag>.medicalpiercing.pages.dev node tools/bejaras-teszt.mjs
//   node tools/bejaras-teszt.mjs rolunk elerhetosegek   (csak ezek az oldalak)
//
// A vegen osszesit; hiba eseten 1-es kilepesi koddal all le. A reszletes eredmeny:
// tools/bejaras-eredmeny.json (nincs a repoban).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { mindenOldal } from './oldalak.mjs';

const CIM = (process.env.CIM || 'http://localhost:4290').replace(/\/+$/, '');
const PARHUZAMOS = +process.env.PARHUZAMOS || 4;
const szuro = process.argv.slice(2);
const oldalak = mindenOldal().filter((o) => !szuro.length || szuro.includes(o.kulcs));
const NEZETEK = [['asztali', { viewport: { width: 1440, height: 900 } }], ['mobil', devices['Pixel 5']]];
const sajat = (u) => u.startsWith(CIM + '/');
// a beagyazott kulso tartalmak sajat hibai nem a mieink
const KULSO_HIBA = /tcfapi|embed\.rtl|cross-origin frame|trustindex|commoninja|youtube|facebook/i;

const b = await chromium.launch();
const hibak = [];
const hiba = (hol, mi) => hibak.push(`${hol}: ${mi}`);
const linkek = new Map(); // href -> Set(hol)
const foglalasi = new Map();
const latottGomb = new Set();
// a Wixen is igy van (2026-10-10, az eles oldalon ellenorizve):
const MENU_NELKUL = new Set(['/igy-szabadultam-meg-a-migrentol']); // menu nelkuli kampanyoldal
const WIX_LINK_RENDBEN = new Set(['/adatkezeles']); // az adatkezelesi tajekoztato a Wixet adatfeldolgozokent nevezi meg

async function bejar(o, nezet, opt) {
  const ctx = await b.newContext(opt);
  await ctx.route((u) => !sajat(u.toString()), (r) => r.abort());
  const p = await ctx.newPage();
  const hol = `${nezet} ${o.ut}`;
  const konzol = [];
  p.on('pageerror', (e) => { if (!KULSO_HIBA.test(e.message + (e.stack || ''))) konzol.push(e.message); });
  p.on('response', (r) => { if (sajat(r.url()) && r.status() >= 400 && !(r.request().isNavigationRequest() && r.frame() === p.mainFrame())) hiba(hol, `hianyzo fajl ${r.status()} ${r.url().slice(CIM.length)}`); });
  p.on('dialog', (d) => d.dismiss());
  // a gombnyomasra indulo navigacio (pl. a varosoldal-lapozo location.href-je) jelzese
  let navigal = false;
  p.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === p.mainFrame()) navigal = true; });
  try {
    const v = await p.goto(CIM + encodeURI(o.ut), { waitUntil: 'load', timeout: 60000 });
    const vart = o.kulcs === '404' ? 404 : 200;
    if (!v || v.status() !== vart) hiba(hol, `statusz ${v && v.status()} (vart ${vart})`);
    // vegiggorgetes (a lustan tolto elemek miatt), majd vissza a tetejere
    await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
    await p.waitForTimeout(300);
    const kepek = await p.evaluate((cim) => [...document.images].filter((i) => i.currentSrc.startsWith(cim) && i.complete && i.naturalWidth === 0).map((i) => i.currentSrc.slice(cim.length)), CIM);
    for (const k of kepek) hiba(hol, `kep nem toltodik: ${k}`);
    // linkek
    const ak = await p.$$eval('a[href]', (l) => l.map((a) => ({ href: a.getAttribute('href'), szoveg: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 40) })));
    for (const a of ak) {
      const h = a.href.trim();
      if (/^(mailto:|tel:|#|javascript:void)/i.test(h) || !h) continue;
      if (/wixsite\.com|wix\.com|editorx|filesusr\.com|wixstatic\.com/i.test(h) && !/salonic/.test(h) && !WIX_LINK_RENDBEN.has(o.ut)) hiba(hol, `Wix-cimre mutato link: ${h} (${a.szoveg})`);
      if (/salonic\.hu/i.test(h)) { if (!/^https:\/\/medicalpiercing\.salonic\.hu\//i.test(h) && !/^https?:\/\/www\.salonic\.hu\/?$/.test(h)) hiba(hol, `foglalasi link mas cimre: ${h}`); (foglalasi.get(h) || foglalasi.set(h, new Set()).get(h)).add(hol); continue; }
      (linkek.get(h) || linkek.set(h, new Set()).get(h)).add(hol);
    }
    // menu
    const gomb = await p.$$eval('[data-popupid]', (l) => l.map((x) => { const r = x.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }).find((r) => r.w > 0 && r.y > 0 && r.y < innerHeight));
    if (o.kulcs !== '404' && !MENU_NELKUL.has(o.ut)) {
      if (!gomb) hiba(hol, 'nincs lathato menugomb');
      else {
        await p.mouse.click(gomb.x, gomb.y);
        await p.waitForTimeout(800);
        const m = await p.evaluate(() => { const lb = document.querySelector('#POPUPS_ROOT .wixui-lightbox'); if (!lb) return null; const r = lb.getBoundingClientRect(); return { y: Math.round(r.y), x: Math.round(r.x), w: Math.round(r.width), kepernyo: innerWidth }; });
        if (!m || m.y < 0 || m.y > 100 || m.x + m.w > m.kepernyo + 1) hiba(hol, `a menu nem a kepernyon nyilik: ${JSON.stringify(m)}`);
        await p.keyboard.press('Escape');
        await p.waitForTimeout(500);
      }
    }
    // gombok: mindegyiket megnyomjuk (ami elnavigalna, azt visszahozzuk)
    const gombDb = await p.$$eval('button, [role="button"]', (l) => l.length);
    for (let i = 0; i < gombDb; i++) {
      const g = (await p.$$('button, [role="button"]'))[i];
      if (!g) break;
      const latszik = await g.evaluate((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && !e.closest('[hidden], #POPUPS_ROOT, template'); }).catch(() => false);
      if (!latszik) continue;
      const nev = await g.evaluate((e) => (e.getAttribute('aria-label') || e.textContent || e.getAttribute('data-testid') || e.tagName).trim().slice(0, 40));
      // az oldalak kozt ismetlodo, azonos gombot (pl. a blogbejegyzesek megosztas-gombjai) nezetenkent egyszer nyomjuk meg
      const fajta = nezet + '|' + nev + '|' + await g.evaluate((e) => (e.getAttribute('data-testid') || '') + '|' + e.className + '|' + (e.closest('[id^="comp-"]') || {}).id);
      if (latottGomb.has(fajta)) continue;
      latottGomb.add(fajta);
      const elotte = konzol.length;
      await g.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      navigal = false;
      await g.click({ timeout: 3000, noWaitAfter: true }).catch((e) => { if (!/intercept|not visible|outside of the viewport|detached/.test(e.message)) hiba(hol, `gomb nem kattinthato: "${nev}" ${e.message.split('\n')[0]}`); });
      await p.waitForTimeout(150);
      // ha a gomb navigaciot inditott, megvarjuk az uj lapot (kulonben a kovetkezo lekerdezes a
      // lebontott lapon futna)
      if (navigal) await p.waitForEvent('load', { timeout: 10000 }).catch(() => {});
      if (konzol.length > elotte) hiba(hol, `JS-hiba a "${nev}" gombra: ${konzol.slice(elotte).join(' | ')}`);
      if (!p.url().startsWith(CIM + encodeURI(o.ut)) && !p.url().startsWith(CIM + o.ut)) {
        const u = p.url();
        if (sajat(u)) { const r = await p.request.get(u).catch(() => null); if (!r || r.status() >= 400) hiba(hol, `a "${nev}" gomb hibas oldalra visz: ${u}`); }
        await p.goto(CIM + encodeURI(o.ut), { waitUntil: 'load' });
      }
      await p.keyboard.press('Escape');
    }
    if (konzol.length) hiba(hol, `JS-hiba: ${[...new Set(konzol)].join(' | ')}`);
  } catch (e) {
    hiba(hol, `bejaras megszakadt: ${e.message.split('\n')[0]}`);
  }
  await ctx.close();
}

const feladatok = oldalak.flatMap((o) => NEZETEK.map(([n, opt]) => () => bejar(o, n, opt)));
let kesz = 0;
await Promise.all(Array.from({ length: PARHUZAMOS }, async () => {
  while (feladatok.length) { await feladatok.shift()(); if (++kesz % 20 === 0) console.log(`  ${kesz}/${oldalak.length * 2} lap`); }
}));

// a belso linkek celjai: asztali es mobil bongeszovel is elnek-e
const req = await (await b.newContext()).request;
const UA = { asztali: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140 Safari/537.36', mobil: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148' };
const kulso = new Set();
for (const [h, hol] of linkek) {
  let u;
  try { u = new URL(h, CIM + '/'); } catch { hiba([...hol][0], `ervenytelen link: ${h}`); continue; }
  const belso = u.origin === CIM || /^(www\.)?medicalpiercing\.hu$/i.test(u.hostname);
  if (!belso) { kulso.add(u.hostname); continue; }
  if (u.origin !== CIM && !/^\/\//.test(h)) hiba([...hol][0], `abszolut belso link (a domainre visz, nem a klonon marad): ${h}`);
  for (const [n, ua] of Object.entries(UA)) {
    const r = await req.get(CIM + u.pathname + u.search, { headers: { 'user-agent': ua }, maxRedirects: 5 }).catch((e) => ({ status: () => 'hiba ' + e.message }));
    if (r.status() !== 200) hiba(`${[...hol].slice(0, 3).join(', ')}${hol.size > 3 ? ` (+${hol.size - 3})` : ''}`, `${n} bongeszovel a link celja ${r.status()}: ${decodeURI(u.pathname)}`);
  }
}
await b.close();

const egyedi = [...new Set(hibak)];
fs.writeFileSync(path.join(import.meta.dirname, 'bejaras-eredmeny.json'), JSON.stringify({ cim: CIM, hibak: egyedi, foglalasi: Object.fromEntries([...foglalasi].map(([k, v]) => [k, v.size])), kulso: [...kulso].sort() }, null, 1));
console.log(`\n${oldalak.length} oldal x 2 nezet, ${linkek.size} kulonbozo link, ${foglalasi.size} kulonbozo foglalasi link, kulso domainek: ${[...kulso].sort().join(', ')}`);
for (const h of egyedi) console.log('HIBA ' + h);
console.log(egyedi.length ? `\n${egyedi.length} HIBA` : '\nMinden rendben');
process.exit(egyedi.length ? 1 : 0);
