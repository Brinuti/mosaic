// A 4 regi (Wixes) info-oldal ujrastilusa (aszf, impresszum, suti-tajekoztato, blog) bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver
// (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt.
//
//   node --test tools/ujrastilus-teszt/info-oldalak.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
// A tartalom-hűseg a regi oldal HTML-jebol (klon/<nev>.html) ellenorzodik: a regi oldal MINDEN szovegcsomopontja megvan az uj oldalon (a fejlec / lablec / menu szovegei nelkul).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

const OLDALAK = [
  { nev: 'aszf', h1: 'Általános Szerződési Feltételek', noindex: true, linkek: ['http://www.mosaicheadspa.hu', 'mailto:medicalpiercing.hu@gmail.com'] },
  { nev: 'impresszum', h1: 'Impresszum', noindex: true, linkek: ['http://www.mosaicheadspa.hu', 'mailto:mosaicheadspa@gmail.com'] },
  { nev: 'suti-tajekoztato', h1: 'Süti (cookie) tájékoztató', noindex: false, linkek: ['/aszf'] },
  { nev: 'blog', h1: 'Head Spa', noindex: false, linkek: ['/suti-tajekoztato', '/blog', 'https://www.mosaicheadspa.hu/profile/mosaicheadspa/profile'] },
];

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200d\u200b\u00a0]/gu, '').replace(/[^\p{L}\p{N}]+/gu, '');

async function nyit(nev, { szeles = 1440 } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], nincs = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
  await p.goto(`${bazis}/${encodeURI(nev)}`, { waitUntil: 'domcontentloaded' });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, nincs };
}

for (const { nev, h1, noindex, linkek } of OLDALAK) {
  describe(`/${nev}`, () => {
    test('betoltodik hibak nelkul: egyetlen H1 (a regi cim), a regi oldal cime / canonical-ja / robots-a valtozatlan', async () => {
      const regi = olvas(`klon/${nev}.html`);
      const g = (re) => { const m = re.exec(regi); assert.ok(m, 'meta a regi oldalon: ' + re); return m[1]; };
      const { p, ctx, hibak, nincs } = await nyit(nev);
      assert.equal(await p.title(), g(/<title>([^<]*)<\/title>/).replace(/&amp;/g, '&'));
      assert.equal(await p.getAttribute('link[rel="canonical"]', 'href'), g(/<link rel="canonical" href="([^"]*)"/));
      if (noindex) { assert.match(regi, /<meta name="robots" content="noindex/); assert.match(await p.getAttribute('meta[name="robots"]', 'content'), /noindex/); }
      else { assert.doesNotMatch(regi, /<meta name="robots"/); assert.equal(await p.locator('meta[name="robots"]').count(), 0, 'a regi oldal indexelheto volt'); }
      assert.equal(await p.locator('h1').count(), 1);
      assert.equal(norm(await p.textContent('h1')), norm(h1));
      assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
      assert.equal(await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).length), 0, 'torott kepek');
      assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
      assert.deepEqual(nincs, []);
      assert.deepEqual(hibak, []);
      await ctx.close();
    });

    test('FUGGETLEN tartalom-hűseg: a regi oldal HTML-jenek MINDEN szovegcsomopontja es a tartalmi linkjei megvannak az uj oldalon (csak a fejlec / lablec / menu / blog-felulet szovegei hianyozhatnak)', async () => {
      const t = olvas(`klon/${nev}.html`).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>/g, '');
      const nyers = [...t.matchAll(/>([^<>]{6,})</g)].map((m) => m[1]);
      const { p, ctx } = await nyit(nev);
      const csomok = (await p.evaluate((l) => l.map((x) => { const e = document.createElement('textarea'); e.innerHTML = x; return e.value.trim(); }), nyers)).filter(Boolean);
      const uj = norm(await p.evaluate(() => document.body.textContent) + ' ' + (await p.title()));
      const FEJLEC = /^(ÚJ! - 4 kezes Headspa!|Páros Head Spa|Head Spa Férfiaknak|Head Spa Csomagok és Árak|Head Spa - 20% OKTÓBERI kedvezmény!|Head Spa Vélemények|Fodrászat Árak|Októberi akció!.*|<script defer async src=.*|bottom of page|A LEGFONTOSABB INFÓK|📌 1023 Budapest.*|🕛 Hétfő - Péntek.*|Árlista, csomagok, foglalás|📅 Head Spa kezelések árai.*|Keresés|Bejelentkezés|Összes bejegyzés|Kategóriák|top of page|Ahol elérsz minket|Nyitvatartásunk|06 20 247 4444)$/;   // a fejlec info-panelje ("A LEGFONTOSABB INFÓK") es a menu
      const hianyzo = csomok.filter((c) => !FEJLEC.test(c) && norm(c).length >= 6 && !uj.includes(norm(c)));
      assert.ok(csomok.length > 10, 'a regi oldal szovegcsomopontjai: ' + csomok.length);
      assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg az ujban');
      const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
      assert.deepEqual(linkek.filter((h) => !hrefek.includes(h)), [], 'hianyzo tartalmi linkek');
      await ctx.close();
    });

    test('rejtett regi (Wixes) valtozat: -regi (asztali + mobil) noindex, sajat canonical; az eredeti klon-fajl megvan', () => {
      for (const mappa of ['klon', path.join('klon', 'm')]) {
        const regi = olvas(path.join(mappa, nev + '-regi.html'));
        assert.match(regi, /<meta name="robots" content="noindex(, nofollow)?"\/>/, mappa + ' regi: noindex');
        assert.ok(regi.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu/${nev}-regi"/>`), mappa + ' regi: canonical');
        assert.ok(fs.existsSync(path.join(GYOKER, mappa, nev + '.html')), mappa + ': az eredeti klon-fajl megvan (visszaallitashoz)');
      }
    });

    for (const szeles of [390, 360]) {
      test(`telefon (${szeles} px): nincs vizszintes gorgetes`, async () => {
        const { p, ctx } = await nyit(nev, { szeles });
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
        await ctx.close();
      });
    }
  });
}
