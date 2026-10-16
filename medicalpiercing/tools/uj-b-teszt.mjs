// A rejtett B-valtozatok (/b/<nev>, tools/uj-b-oldalak.mjs) ellenorzese a helyi kiszolgalon (tools/serve.mjs), elonezeten vagy elesben, Playwrighttal.
//
//   node tools/uj-b-oldalak.mjs && node tools/build.mjs && node tools/serve.mjs &     majd:     node tools/uj-b-teszt.mjs [--oldal=fooldal[,kontroll]] [--gyors]
//   BASE=https://www.medicalpiercing.hu node tools/uj-b-teszt.mjs
//
// Nem helyi cimen minden merokeres blokkolva (tools/meres-tiltas.mjs), es a sajat oldalon + a Salonic olvaso hivasain kivul minden kulso keres is:
// a teszt nem szennyezi a statisztikat, foglalast nem kuld be (a foglalot csak a Piercing-lepesig nyitja), az urlapot nem kuldi el.
//
// Ellenorzi minden B-oldalra:
//  - forras: rejtett (noindex meta, nincs canonical), nincs a sitemapben, egy h1, minden kepnek alt, a lapon beluli horgonyok, a B-stilus (uj-b.css, oldal-b2)
//  - futas, asztalin es mobilon: 200-as valasz (elesben X-Robots-Tag: noindex is), nincs JS-hiba, minden kep betolt, nincs vizszintes gorgetes 360-1920 px kozott,
//    a belso linkek celjai elnek
//  - a "nem lehet ures a doboz" szabaly (a tulajdonos, 2026-10-16): asztalon egyik dobozban sincs nagy ures resz (a kep nem sokkal magasabb a mellette levo szovegnel)
//  - mobilon: a hos sorrendje (cim, kep, bevezeto, gomb), a ragados also sav felirata egy-egy sorban
//  - foglalo: a hos fo gombja (es a csomag- / tipus- / paros gombok) megnyitja a motort, a meres egyszer fut (foglalasInditas), az elovalasztas a gomb szerint
//    (data-csomag 1/2/3: a tipus-valaszto kimarad, a csomag elol; ketto: "2 személynek"; data-tipus: a tipus sajat piercingje elol); a kontroll- es a garancia-gomb az urlapot nyitja
//  - a TikTok-landolo B-valtozatan nincs panasz- vagy orvosi szo (tools/tiltott-landolo.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { meresTiltas } from './meres-tiltas.mjs';
import { TILTOTT_LANDOLO } from './tiltott-landolo.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = (process.env.BASE || 'http://localhost:4290').replace(/\/+$/, '');
const HELYI = /localhost|127\.0\.0\.1/.test(BASE);
const arg = (n) => process.argv.find((a) => a.startsWith('--' + n + '='))?.split('=')[1];
const GYORS = process.argv.includes('--gyors');
const SAJAT_HOST = new URL(BASE).host;
const ENGEDETT = new RegExp(`^(${SAJAT_HOST.replace(/\./g, '\\.')}|medicalpiercing\\.salonic\\.hu)$`);

let hiba = 0, db = 0;
const ok = (nev, felt, info = '') => { db++; if (!felt) { hiba++; console.log(`HIBA ${nev}${info ? '  ' + String(info).slice(0, 400) : ''}`); } };

const NEVEK = fs.readdirSync(path.join(ROOT, 'uj-oldalak/sajat-b')).filter((x) => x.endsWith('.html')).map((x) => x.slice(0, -5)).sort();
const KIJELOLT = arg('oldal') ? NEVEK.filter((n) => arg('oldal').split(',').includes(n)) : NEVEK;
ok('van B-oldal', KIJELOLT.length > 0);

// ---------- 1. forras (dist) ----------
const sitemap = fs.existsSync(path.join(ROOT, 'dist/sitemap.xml')) ? fs.readFileSync(path.join(ROOT, 'dist/sitemap.xml'), 'utf8') : '';
ok('a sitemapben nincs B-oldal', !/\/b\//.test(sitemap));
for (const nev of KIJELOLT) {
  for (const n of ['_a', '_m']) {
    const f = path.join(ROOT, 'dist', n, 'b', nev + '.html');
    if (!fs.existsSync(f)) { ok(`/b/${nev} (${n}): a build elkeszitette`, false); continue; }
    const h = fs.readFileSync(f, 'utf8');
    const main = h.slice(h.indexOf('<main'), h.indexOf('</main>'));
    ok(`/b/${nev} (${n}): noindex meta`, /<meta name="robots" content="[^"]*noindex/i.test(h));
    ok(`/b/${nev} (${n}): nincs canonical`, !/rel="canonical"/i.test(h));
    ok(`/b/${nev} (${n}): a B-stilus (uj-b.css, oldal-b2)`, /\/assets\/css\/uj-b\.css/.test(h) && /<body[^>]*class="[^"]*oldal-b2/.test(h));
    ok(`/b/${nev} (${n}): pontosan egy h1`, (main.match(/<h1[\s>]/g) || []).length === 1);
    ok(`/b/${nev} (${n}): minden kepnek van alt`, ![...h.matchAll(/<img\b[^>]*>/g)].some((m) => !/\salt="/.test(m[0])));
    const idk = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]));
    const horg = [...new Set([...h.matchAll(/<a\b[^>]*?\shref="#([^"]+)"/g)].map((x) => x[1]))];
    ok(`/b/${nev} (${n}): a horgonyok celja letezik`, horg.every((x) => idk.has(x)), horg.filter((x) => !idk.has(x)).join(' '));
  }
}

// ---------- 2. futas ----------
const b = await chromium.launch();
const sr = (p, kod) => p.evaluate((kod) => { const r = document.querySelector('[data-mp-motor]')?.shadowRoot; return r ? new Function('r', kod)(r) : null; }, kod);
const varj = async (p, sel, ms = 20000) => { for (let i = 0; i < ms / 250; i++) { if (await sr(p, `return !!r.querySelector(${JSON.stringify(sel)})`)) return true; await p.waitForTimeout(250); } return false; };
const kornyezet = async (nezet) => {
  const ctx = await b.newContext(nezet === 'mobil' ? { ...devices['iPhone 13'], locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' });
  await meresTiltas(ctx);
  await ctx.route((u) => /\/api\/urlap|guestData/.test(u.toString()), (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 200, body: 'ok' }) : r.continue()));
  await ctx.route((u) => { try { return !ENGEDETT.test(new URL(u.toString()).host); } catch (e) { return true; } }, (r) => r.abort());
  return ctx;
};
const linkAllapot = new Map();
const linkEl = async (href) => {
  if (!linkAllapot.has(href)) linkAllapot.set(href, fetch(BASE + href, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 uj-b-teszt' } }).then((v) => v.status).catch(() => 0));
  return linkAllapot.get(href);
};
// a meres (motor-indito.js -> mpSuti.foglalasInditas) szamlaloja; helyben nincs mpSuti, akkor a csonk szamol
// (az eredeti fuggvenyt egyszer tesszuk el: a masodik gombnal a szamlalo nem csomagolodik ujra)
const meresSzamlalo = (p) => p.evaluate(() => { window.__mn = 0; if (window.__mnKesz) return; window.__mnKesz = true; window.mpSuti = window.mpSuti || {};
  const e = typeof window.mpSuti.foglalasInditas === 'function' ? window.mpSuti.foglalasInditas : null; window.mpSuti.foglalasInditas = function () { window.__mn++; return e ? e.apply(this, arguments) : undefined; }; });
const motorZar = async (p) => { await p.keyboard.press('Escape'); await p.waitForSelector('[data-mp-motor]', { state: 'detached', timeout: 5000 }).catch(() => p.evaluate(() => document.querySelectorAll('[data-mp-motor]').forEach((e) => e.remove()))); };
const TIPUSNEV = { mi: 'Migrén', sh: 'Shenmen', kl: 'Klimax', sl: 'Slim', al: 'Allergia', mj: 'Máj', pm: 'Pajzsmirigy', lp: 'Lép', vb: 'Vastagbél' };
const tipusKodUtbol = (ut) => (/migren/.test(ut) ? 'mi' : /shenmen/.test(ut) ? 'sh' : /klimax/.test(ut) ? 'kl' : /slim/.test(ut) ? 'sl' : /allergia/.test(ut) ? 'al' : /(^|[-/])maj-/.test(ut) ? 'mj' : /pajzsmirigy/.test(ut) ? 'pm' : /(^|[-/])lep-/.test(ut) ? 'lp' : /vastagbel/.test(ut) ? 'vb' : '');

// egy foglalo-gomb: megnyitja-e a motort, a meres egyszer fut-e, es az elovalasztas a gomb szerint
async function gombProba(p, cim, sel, idx, ut) {
  const g = await p.evaluate(([sel, idx]) => { const a = [...document.querySelectorAll(sel)].filter((x) => x.getBoundingClientRect().width > 0)[idx]; if (!a) return null; a.scrollIntoView({ block: 'center' });
    a.setAttribute('data-proba', '1'); return { csomag: a.dataset.csomag || '', tipus: a.dataset.tipus || '', szoveg: a.textContent.trim().replace(/\s+/g, ' '), href: a.getAttribute('href') }; }, [sel, idx]);
  if (!g) { ok(`${cim}: a gomb (${sel} #${idx}) latszik`, false); return; }
  await meresSzamlalo(p);
  const url0 = p.url();
  await p.locator('[data-proba="1"]').click();
  await p.evaluate(() => document.querySelector('[data-proba]')?.removeAttribute('data-proba'));
  const van = await p.waitForSelector('[data-mp-motor]', { state: 'attached', timeout: 8000 }).then(() => true).catch(() => false);
  ok(`${cim}: "${g.szoveg}" megnyitja a foglalot`, van && p.url() === url0, p.url());
  if (!van) return;
  const urlapos = /kontroll|garanci/i.test(g.szoveg.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  if (urlapos) {
    // kontroll / garancia: visszahivas-kero urlap (motor.js), nem naptaras foglalas: a foglalas-inditas merese itt nem fut
    const u = await varj(p, 'form, input[type="tel"], [data-urlap]', 10000);
    ok(`${cim}: "${g.szoveg}" a visszahivas-urlapot nyitja`, u);
    const mn = await p.evaluate(() => window.__mn);
    ok(`${cim}: "${g.szoveg}": az urlap nyitasa nem foglalas-inditas (meres: 0)`, mn === 0, `${mn} db`);
  } else {
    await varj(p, '[data-hely], [data-tipus]', 10000);
    const tipusLepes = await sr(p, 'return !!r.querySelector("[data-tipus]")');
    if (g.csomag) ok(`${cim}: "${g.szoveg}" (data-csomag=${g.csomag}): a tipus-valaszto kimarad`, !tipusLepes);
    // Salonic-link (pl. a helyszin "Időpont Budapestre" gombja): a foglalo a helyszinnel nyilik, a merest a kattintaskor a suti.js kuldi (mint az A-oldalon)
    if (/^https:\/\/medicalpiercing\.salonic\.hu/.test(g.href || '')) {
      const nyilt = await varj(p, '.pk, .lista, [data-szolg], [data-hely]', 15000);
      ok(`${cim}: "${g.szoveg}" (Salonic-link): a foglalo a helyszinnel nyilik`, nyilt);
      await motorZar(p); return;
    }
    // csomag nelkul a foglalo a tipus-valasztoval nyilik: az "Uj piercing" valasztasakor fut a meres (motor.js meres())
    if (tipusLepes) await sr(p, 'r.querySelector(\'[data-tipus="uj"]\')?.click()');
    const hely = await varj(p, '[data-hely="6029"]', 15000);
    ok(`${cim}: "${g.szoveg}": a foglalo helyszin-lepese betolt (Budapest)`, hely);
    const mn = await p.evaluate(() => window.__mn);
    ok(`${cim}: "${g.szoveg}": a foglalas-inditas merese pontosan egyszer fut`, mn === 1, `${mn} db`);
    if (!GYORS && g.csomag && hely) {
      await sr(p, 'r.querySelector(\'[data-hely="6029"]\').click()');
      await varj(p, '.pk', 15000); await p.waitForTimeout(400);
      const m = await sr(p, 'return {on:[...r.querySelectorAll(".pk-szuro button.on")].map(x=>(x.getAttribute("aria-label")||x.textContent).trim()), elso:((r.querySelector(".pk .pk-cim b")||{}).textContent||"").trim(), nyitott:!!r.querySelector(".pk.nyitva")}');
      let jo = m && !m.nyitott;
      const tk = g.tipus || tipusKodUtbol(ut);
      if (g.csomag === '1') jo = jo && m.on[1] === '1 piercing' && (!tk || m.elso.toLowerCase().includes(TIPUSNEV[tk].toLowerCase()));
      else if (g.csomag === '2' || g.csomag === '3') jo = jo && m.on[1] === '2–3 piercing' && m.elso === `${g.csomag} piercing`;
      else if (g.csomag === 'ketto') jo = jo && m.on[0] === '2 személynek';
      ok(`${cim}: "${g.szoveg}" (data-csomag=${g.csomag}${g.tipus ? ', data-tipus=' + g.tipus : ''}): az elovalasztas a gomb szerint`, jo, JSON.stringify(m));
      const mn2 = await p.evaluate(() => window.__mn);
      ok(`${cim}: "${g.szoveg}": a helyszin valasztasa utan sem fut ujra a meres`, mn2 === 1, `${mn2} db`);
    }
  }
  await motorZar(p);
}

async function oldalProba(nev, nezet) {
  const ut = '/b/' + nev, cim = `${ut} [${nezet}]`;
  const ctx = await kornyezet(nezet);
  const p = await ctx.newPage();
  const jsHiba = []; p.on('pageerror', (e) => jsHiba.push(String(e)));
  const v = await p.goto(BASE + ut, { waitUntil: 'load' });
  ok(`${cim}: 200-as valasz`, v && v.status() === 200, v && v.status());
  if (!HELYI) ok(`${cim}: X-Robots-Tag: noindex`, /noindex/i.test((v && v.headers()['x-robots-tag']) || ''), v && v.headers()['x-robots-tag']);
  await p.waitForTimeout(500);
  // a lusta kepek betoltese (a lapozosavok kilogo kepei is): eager + vegiggorgetes
  await p.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }));
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
  // (halozaton a sok elore toltott kep idot ker: legfeljebb 20 mp-ig varunk, amig mind betolt vagy hibas lesz)
  await p.waitForFunction(() => [...document.images].every((i) => !i.getAttribute('src') || i.complete), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(300);
  const rosszKep = await p.evaluate(() => [...document.images].filter((i) => i.getAttribute('src') && i.getBoundingClientRect().width > 0 && (!i.complete || !i.naturalWidth)).map((i) => i.getAttribute('src').slice(-60)));
  ok(`${cim}: minden kep betolt`, rosszKep.length === 0, rosszKep.slice(0, 3).join(' '));
  // vizszintes gorgetes
  for (const w of nezet === 'mobil' ? [360, 390, 430] : [1024, 1280, 1440, 1920]) {
    await p.setViewportSize({ width: w, height: nezet === 'mobil' ? 844 : 900 }); await p.waitForTimeout(120);
    const m = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    ok(`${cim}: nincs vizszintes gorgetes ${w}px-en`, m[0] <= m[1] + 1, m.join('/'));
  }
  await p.setViewportSize(nezet === 'mobil' ? { width: 390, height: 844 } : { width: 1440, height: 900 }); await p.waitForTimeout(200);
  if (nezet === 'asztali') {
    // a "nem lehet ures a doboz" szabaly: a kethasabos dobozban a kep legfeljebb 150 px-szel magasabb a szoveg tartalmanal; mas dobozban nincs 120 px-nel nagyobb ures sav
    const ures = await p.evaluate(() => {
      const lat = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const unio = (els) => { const rs = els.filter(lat).map((e) => e.getBoundingClientRect()); return rs.length ? Math.max(...rs.map((r) => r.bottom)) - Math.min(...rs.map((r) => r.top)) : 0; };
      return [...document.querySelectorAll('main .kat-doboz')].filter(lat).map((d) => {
        const cs = getComputedStyle(d), r = d.getBoundingClientRect();
        const belso = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const szoveg = d.querySelector(':scope > .kat-doboz-szoveg'), kep = d.querySelector(':scope > .kat-par-kep, :scope > img, :scope > picture');
        const nev = (d.querySelector('h2,h3')?.textContent || d.className).trim().slice(0, 50);
        if (szoveg && kep && lat(kep)) { const sz = unio([...szoveg.children]); const k = kep.getBoundingClientRect().height; return { nev, ures: Math.round(k - sz), hatar: 150, info: `kep ${Math.round(k)} / szoveg ${Math.round(sz)} px` }; }
        return { nev, ures: Math.round(belso - unio([...d.children])), hatar: 120, info: `doboz ${Math.round(belso)} px` };
      }).filter((x) => x.ures > x.hatar);
    });
    ok(`${cim}: nincs ures doboz`, ures.length === 0, ures.map((x) => `"${x.nev}" ${x.ures} px ures (${x.info})`).join('; '));
  } else {
    const s = await p.evaluate(() => {
      const t = (sel) => { const e = document.querySelector('main .hos ' + sel); return e && e.getBoundingClientRect().height ? Math.round(e.getBoundingClientRect().top + scrollY) : null; };
      return { cim: t('.hos-cim'), kep: t('.hos-kep, .kar, .hos-media, .b-hos-kep') ?? t('img'), bevezeto: t('.hos-bevezeto'), gomb: t('.gombsor') };
    });
    const sorrend = [s.cim, s.kep, s.bevezeto, s.gomb].filter((x) => x !== null);
    ok(`${cim}: a mobil hos sorrendje: cim, kep, bevezeto, gomb`, sorrend.every((x, i) => i === 0 || x >= sorrend[i - 1]), JSON.stringify(s));
    const sav = await p.evaluate(async () => {
      const s = document.querySelector('[data-akc-sav]'); if (!s) return null;
      scrollTo(0, document.body.scrollHeight / 2); await new Promise((r) => setTimeout(r, 500));
      const egy = (e) => { if (!e) return true; const lh = parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.3; return e.getBoundingClientRect().height <= lh * 1.4; };
      const b = s.querySelector('.akc-sav-ar > b'), sp = s.querySelector('.akc-sav-ar > span');
      return { lat: s.getBoundingClientRect().height > 0, b: egy(b), span: egy(sp), h: Math.round(s.getBoundingClientRect().height), szoveg: (b?.textContent || '') + ' | ' + (sp?.textContent || '') };
    });
    if (sav) ok(`${cim}: a ragados also sav felirata egy-egy sorban`, sav.b && sav.span && sav.h <= 80, JSON.stringify(sav));
    await p.evaluate(() => scrollTo(0, 0));
  }
  // belso linkek (egyszer, asztalin)
  if (nezet === 'asztali') {
    const hrefek = await p.evaluate(() => [...new Set([...document.querySelectorAll('main a[href^="/"], .akc-sav a[href^="/"], .promo-sav a[href^="/"], .akcio-sav a[href^="/"]')].map((a) => a.getAttribute('href').replace(/#.*$/, '')).filter((h) => h && !h.startsWith('/assets/')))]);
    const rossz = [];
    for (const h of hrefek) { const st = await linkEl(h); if (st !== 200) rossz.push(`${h} (${st})`); }
    ok(`${cim}: a belso linkek celjai elnek (${hrefek.length})`, rossz.length === 0, rossz.join(' '));
  }
  // tiltott szavak a TikTok-landolo B-valtozatan
  if (nev === 'kozerzetjavito-piercing-soft-akcio') {
    const t = await p.evaluate((szavak) => {
      const komment = []; const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_COMMENT); while (w.nextNode()) komment.push(w.currentNode.nodeValue);
      const attr = [...document.querySelectorAll('[alt],[title],[aria-label],[placeholder],meta[content]')].map((e) => [e.getAttribute('alt'), e.getAttribute('title'), e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.tagName === 'META' ? e.getAttribute('content') : ''].join(' '));
      const l = (' ' + [document.title, document.body.textContent, attr.join(' '), komment.join(' ')].join(' ') + ' ').toLowerCase().replace(/\s+/g, ' ').replace(/adatkezel/g, 'adat');
      return szavak.filter((sz) => l.includes(sz));
    }, TILTOTT_LANDOLO);
    ok(`${cim}: a landolon nincs panasz- vagy orvosi szo`, t.length === 0, t.join(', '));
  }
  // foglalo-gombok: a hos fo gombja; asztalon a csomag-, tipus- es paros gombok is (oldalankent legfeljebb 6), mobilon a ragados sav gombja
  const fo = 'main .hos .gombsor a[href]';
  if (await p.locator(fo).count()) await gombProba(p, cim, fo, 0, ut);
  if (nezet === 'asztali') {
    const extra = await p.evaluate(() => { const l = [...document.querySelectorAll('main a[data-csomag], main a[data-tipus], main a.gomb[href="/kontroll"], main a.gomb[href="/idopontfoglalas"]')].filter((a) => a.getBoundingClientRect().width > 0 && !a.closest('.hos'));
      const kulcs = new Set(); return l.map((a, i) => ({ i, k: (a.dataset.csomag || '') + '|' + (a.dataset.tipus || '') + '|' + a.textContent.trim() })).filter((x) => !kulcs.has(x.k) && kulcs.add(x.k)).map((x) => x.i); });
    for (const i of extra.slice(0, GYORS ? 2 : 6)) await gombProba(p, cim, 'main a[data-csomag], main a[data-tipus], main a.gomb[href="/kontroll"], main a.gomb[href="/idopontfoglalas"]', i, ut);
  } else if (await p.locator('[data-akc-sav] .akc-sav-gomb').count()) {
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight / 2)); await p.waitForTimeout(400);
    await gombProba(p, cim, '[data-akc-sav] .akc-sav-gomb', 0, ut);
  }
  ok(`${cim}: nincs JS-hiba`, jsHiba.length === 0, jsHiba.slice(0, 2).join(' | '));
  await ctx.close();
}

const PARHUZAM = +process.env.PARHUZAM || 3;
const munkak = KIJELOLT.flatMap((n) => [[n, 'asztali'], [n, 'mobil']]);
await Promise.all(Array.from({ length: PARHUZAM }, async () => { while (munkak.length) { const [n, nz] = munkak.shift(); try { await oldalProba(n, nz); } catch (e) { ok(`/b/${n} [${nz}]: a teszt lefutott`, false, e.message); } } }));
await b.close();
console.log(`\n${KIJELOLT.length} B-oldal, ${db} ellenorzes: ${hiba ? hiba + ' HIBA' : 'minden rendben'}`);
process.exit(hiba ? 1 : 0);
