// A /sminktetovalas-eltavolitas-budapest landing (2026-11-01) tesztje.
//   PLAYWRIGHT_UTVONAL=/opt/node-tools/node_modules CHROME_UTVONAL=/opt/pw-browsers/chromium node --test tools/eltavolitas-teszt/eltavolitas.test.mjs
// Statikus resz: noindex, nincs sitemap, nincs #-link, tiltott allitasok nincsenek, a hivatkozott fajlok leteznek, uzletag = pmu.
// Bongeszos resz (helyi konnyu szerver, dist/ nelkul; a /-ra erkezo POST-ot a teszt fogja el, semmi nem megy ki): 390 px es 1366 px:
//   nincs JS-hiba, nincs vizszintes kilogas, H1 <= 2 sor mobilon, a fo gomb az elso kepernyon, nincs arva szo, az urlap ellenorzese,
//   a bekuldott mezok (eltavolitas-jeloles, foto), a dataLayer-esemeny (csak hozzajarulassal, PII nelkul), ragados sav.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const NEV = 'sminktetovalas-eltavolitas-budapest';
const HTML = fs.readFileSync(path.join(GYOKER, 'foglalas', NEV + '.html'), 'utf8');
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium';
const KEPMAPPA = process.env.KEPERNYOKEP_MAPPA || '';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

describe('statikus', () => {
  test('noindex, canonical, egyetlen H1, nincs sitemap-bejegyzes', () => {
    assert.match(HTML, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(HTML, new RegExp('<link rel="canonical" href="https://www.mosaicheadspa.hu/' + NEV + '">'));
    assert.equal((HTML.match(/<h1[ >]/g) || []).length, 1);
    for (const f of fs.readdirSync(path.join(GYOKER, 'tools/wix-sitemap')).filter((x) => x.endsWith('.xml'))) {
      assert.ok(!fs.readFileSync(path.join(GYOKER, 'tools/wix-sitemap', f), 'utf8').includes(NEV), f + ': a noindex oldal nem lehet a sitemapban');
    }
  });
  test('nincs href="#..." link, nincs data-cta, nincs merokod', () => {
    assert.ok(!/href="#/.test(HTML), 'href="#..." talalat');
    assert.ok(!/data-cta=/.test(HTML), 'data-cta talalat');
    assert.ok(!/fbq\(|gtag\(|googletagmanager|connect\.facebook/.test(HTML + fs.readFileSync(path.join(GYOKER, 'assets/js/eltavolitas-landing.js'), 'utf8')));
  });
  test('tiltott allitasok nincsenek (eredmenyigeret, orvosi / garancia-tulzas)', () => {
    const szoveg = HTML.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    for (const m of [/nyom nélkül/i, /100\s?%/, /garantált eltávolítás/i, /garantálom/i, /fájdalommentes/i, /végleges megoldás/i, /a legjobb/i, /orvosi biztonság/i, /hegmentes(?!ség)/i, /garantáltan/i, /nincs heg/i]) {
      assert.ok(!m.test(szoveg), 'tiltott kifejezes: ' + m);
    }
    assert.match(szoveg, /Teljes eltűnést, hegmentességet vagy pontos alkalomszámot nem ígérek/);
  });
  test('a nem vallalt elemek nincsenek az oldalon (haladas-kontroll, beriet, 90 nap)', () => {
    const szoveg = HTML.replace(/<!--[\s\S]*?-->/g, '');
    for (const m of [/haladás-kontroll/i, /bérletvédelem/i, /90 napos/i, /ártartás/i, /ajándék kontroll/i]) assert.ok(!m.test(szoveg), 'nem vallalt elem: ' + m);
  });
  test('minden helyi hivatkozas (src / href / poster) letezik', () => {
    const fajlok = new Set();
    for (const m of HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/(?:src|href|poster)="(\/[^"#?]+)"/g)) fajlok.add(m[1]);
    for (const f of fs.readFileSync(path.join(GYOKER, 'assets/css/eltavolitas-landing.css'), 'utf8').matchAll(/url\((\/[^)]+)\)/g)) fajlok.add(f[1]);
    const oldalak = new Set(['/aszf', '/sminktetovalas-budapest']);
    for (const f of fajlok) {
      if (oldalak.has(f)) { assert.ok(fs.existsSync(path.join(GYOKER, 'foglalas', f.slice(1) + '.html')), f + ' oldal hianyzik'); continue; }
      assert.ok(fs.existsSync(path.join(GYOKER, f)), 'hianyzo fajl: ' + f);
    }
  });
  test('az uzletag pmu (a fejlec / lablec foglalasa a PMU-ra mutat)', async () => {
    const { oldalUzletag } = await import(pathToFileURL(path.join(GYOKER, 'tools/foglalo-atkotes.mjs')).href);
    assert.equal(oldalUzletag(NEV), 'pmu');
  });
  test('az eltavolitas-oldal nem hasznal kerdes-kihagyast (a foglalo mindenkitol megkerdezi, volt-e sminktetovalasa); a 491949 legkorabbi idopontja marad (2026-11-09)', () => {
    const motor = fs.readFileSync(path.join(GYOKER, 'assets/js/foglalo-pmu.js'), 'utf8');
    const landing = fs.readFileSync(path.join(GYOKER, 'assets/js/eltavolitas-landing.js'), 'utf8');
    assert.ok(!/kerdesKihagy|KERDES_KIHAGY/.test(motor), 'a kerdes-kihagyas megszunt');
    assert.ok(!/kerdes=kihagy['&]/.test(landing + HTML), 'a landing nem kuldi a kerdes=kihagy jelzest');
    assert.match(motor, /const LEGKORABBI = \{ '491949': Date\.UTC\(2026, 10, 8, 23, 0, 0\) \/ 1000 \};/);
    assert.equal(Date.UTC(2026, 10, 8, 23, 0, 0), Date.parse('2026-11-09T00:00:00+01:00'), '2026-11-09 00:00 Europe/Budapest');
    assert.equal(new Date('2026-11-09T12:00:00Z').getUTCDay(), 1, 'november 9. hetfo');
  });
  test('a galeria kepei verziozott fajlnevuek (-v2): a Cloudflare 1 evre gyorsitotarazza a kepeket, azonos nevvel a csere nem latszana', () => {
    for (const n of ['elotte-a', 'elotte-b', 'elotte-c', 'utana-a', 'utana-b', 'utana-c']) {
      assert.ok(HTML.includes('/assets/img/eltavolitas/' + n + '-v2.jpg'), n + '-v2.jpg hivatkozas hianyzik');
      assert.ok(!HTML.includes('/assets/img/eltavolitas/' + n + '.jpg'), 'a regi nev (' + n + '.jpg) nem maradhat');
    }
  });
  test('a "Hogyan zajlik?" szakasz 3 lepes, az elso talalkozon mar az eltavolitast emliti, a fotot es a nov. 9-et', () => {
    const r = HTML.slice(HTML.indexOf('id="el-lepes-cim"'), HTML.indexOf('<!-- ============ 5. HANY ALKALOM'));
    assert.equal((r.match(/<li>/g) || []).length, 3);
    assert.match(r, /feltöltöd a fotód/);
    assert.match(r, /november 9/);
    assert.match(r, /az első találkozón/i);
    assert.match(r, /a kezelés a konzultációt is magában foglalja/);
    assert.match(r, /Külön konzultációra csak akkor jöjj, ha még nem biztos/);
  });
  test('a kepek EXIF-mentesek (nincs helyadat / eszkozadat)', () => {
    for (const f of fs.readdirSync(path.join(GYOKER, 'assets/img/eltavolitas')).filter((x) => x.endsWith('.jpg'))) {
      const b = fs.readFileSync(path.join(GYOKER, 'assets/img/eltavolitas', f));
      assert.ok(!b.includes(Buffer.from('Exif\0\0')), f + ': EXIF talalat');
    }
  });
});

describe('bongeszos', () => {
  let chromium, szerver, bazis, bongeszo;
  before(async () => {
    const require = createRequire((process.env.PLAYWRIGHT_UTVONAL || '/opt/node-tools/node_modules') + '/');
    ({ chromium } = require('playwright'));
    const { szerverInditas } = await import(pathToFileURL(path.join(GYOKER, 'tools/headspa-teszt/szerver.mjs')).href);
    ({ szerver, bazis } = await szerverInditas());
    bongeszo = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  });
  after(async () => { await bongeszo?.close(); szerver?.close(); });

  const nezet = async (mobil) => {
    const ctx = await bongeszo.newContext(mobil
      ? { viewport: { width: 390, height: 844 }, userAgent: UA_MOBIL, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
      : { viewport: { width: 1366, height: 800 } });
    const lap = await ctx.newPage();
    const hibak = [];
    lap.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
    lap.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
    const posztok = [];
    await lap.route('**/*', (r) => {
      const k = r.request();
      const u = new URL(k.url());
      if (u.origin !== bazis) return r.abort(); // semmi nem megy ki a helyi szerveren kivul
      if (k.method() === 'POST') { posztok.push(k); return r.fulfill({ status: 200, body: 'ok' }); }
      return r.continue();
    });
    const v = await lap.goto(bazis + '/' + NEV, { waitUntil: 'load' });
    return { ctx, lap, hibak, posztok, v };
  };

  for (const mobil of [true, false]) {
    const cim = mobil ? 'mobil 390 px' : 'asztali 1366 px';
    test(cim + ': 200, nincs JS-hiba, nincs vizszintes kilogas', async () => {
      const { ctx, lap, hibak, v } = await nezet(mobil);
      assert.equal(v.status(), 200);
      const [sw, iw] = await lap.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      assert.ok(sw <= iw + 1, `vizszintes kilogas: scrollWidth ${sw} > ${iw}`);
      if (KEPMAPPA) { fs.mkdirSync(KEPMAPPA, { recursive: true }); await lap.screenshot({ path: path.join(KEPMAPPA, 'eltavolitas-' + (mobil ? 'mobil' : 'asztali') + '-teljes.png'), fullPage: true }); }
      assert.deepEqual(hibak, []);
      await ctx.close();
    });

    test(cim + ': a H1 lathato, mobilon legfeljebb 2 sor; a fo gomb az elso kepernyon', async () => {
      const { ctx, lap } = await nezet(mobil);
      const h1 = await lap.evaluate(() => { const e = document.querySelector('h1'); const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { h: r.height, lh: parseFloat(cs.lineHeight), szoveg: e.textContent }; });
      const sorok = Math.round(h1.h / h1.lh);
      assert.ok(sorok <= (mobil ? 2 : 3), `H1: ${sorok} sor (${h1.szoveg})`);
      const gomb = await lap.evaluate(() => { const r = document.getElementById('el-fo-gomb').getBoundingClientRect(); return { also: r.bottom, felso: r.top, h: innerHeight }; });
      assert.ok(gomb.also <= gomb.h, `a fo gomb alja ${gomb.also} > a kepernyo ${gomb.h}`);
      await ctx.close();
    });

    test(cim + ': nincs arva szo (az utolso sorban legalabb 2 szokozzel elvalasztott szo)', async () => {
      const { ctx, lap } = await nezet(mobil);
      await lap.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      const arvak = await lap.evaluate(() => {
        const talalat = [];
        const elemek = document.querySelectorAll('main p, main li, main h1, main h2, main h3, main figcaption, main summary, main small');
        for (const e of elemek) {
          if (e.closest('[hidden]') || !e.offsetParent || e.closest('.el-ar-racs')) continue; // az ar-sor ket oszlopos (nev | ar): a baseline-igazitas miatt nem sortoresi arva
          // csak a sajat szoveg-csomopontok (nem a beagyazott elemek, pl. gombok)
          const csomopontok = [];
          const bejar = (n) => { for (const g of n.childNodes) { if (g.nodeType === 3) csomopontok.push(g); else if (g.nodeType === 1 && !/^(BUTTON|A|SVG|SELECT|INPUT|SMALL|LABEL)$/i.test(g.tagName)) bejar(g); } };
          bejar(e);
          const szavak = [];
          for (const cs of csomopontok) {
            const re = /[^ \t\n\r]+/g; let m;
            while ((m = re.exec(cs.data))) { const r = document.createRange(); r.setStart(cs, m.index); r.setEnd(cs, m.index + m[0].length); const rr = r.getClientRects(); if (rr.length) szavak.push({ top: Math.round(rr[rr.length - 1].top), szo: m[0] }); }
          }
          if (szavak.length < 4) continue;
          const utolso = szavak[szavak.length - 1].top;
          const utolsoSor = szavak.filter((s) => Math.abs(s.top - utolso) < 4);
          if (utolsoSor.length === 1 && szavak.some((s) => Math.abs(s.top - utolso) >= 4)) talalat.push(e.tagName + ': …' + szavak.slice(-4).map((s) => s.szo).join(' '));
        }
        return talalat;
      });
      assert.deepEqual(arvak, [], 'arva szavak');
      await ctx.close();
    });
  }

  test('foglalas: mindket kartya (konzultacio, eltavolito kezeles) a beagyazott foglalot nyitja; a hero gombja a konzultaciot valasztja', async () => {
    const { ctx, lap } = await nezet(false);
    await lap.route('**/foglalo-pmu**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>foglalo</p>' }));
    assert.equal(await lap.isHidden('#el-foglalo-doboz'), true);
    await lap.click('#el-fo-gomb');
    await lap.waitForFunction(() => !document.getElementById('el-foglalo-doboz').hidden);
    assert.equal(await lap.getAttribute('#el-foglalo', 'src'), '/foglalo-pmu?beagyazva=1&kezeles=konzultacio');
    await lap.click('.el-valaszt[data-valaszt=kezeles]');
    await lap.waitForFunction(() => document.getElementById('el-foglalo').getAttribute('src').endsWith('kezeles=491949'));
    assert.equal(await lap.getAttribute('#el-foglalo', 'src'), '/foglalo-pmu?beagyazva=1&kezeles=491949');
    assert.equal(await lap.getAttribute('.el-valaszt[data-valaszt=kezeles]', 'aria-pressed'), 'true');
    assert.equal(await lap.isVisible('#el-foglalo-doboz'), true);
    await ctx.close();
  });

  test('mobil: a ragados sav a hero utan latszik, az urlapnal elrejtozik; asztalon nincs', async () => {
    const { ctx, lap } = await nezet(true);
    assert.equal(await lap.getAttribute('#el-sav', 'data-lathato'), '0');
    assert.equal(await lap.evaluate(() => getComputedStyle(document.getElementById('el-sav')).visibility), 'hidden', 'rejtett allapotban nem fokuszalhato');
    await lap.evaluate(() => window.scrollTo(0, 1400));
    await lap.waitForFunction(() => document.getElementById('el-sav').dataset.lathato === '1');
    await lap.evaluate(() => document.getElementById('foglalas').scrollIntoView());
    await lap.waitForFunction(() => document.getElementById('el-sav').dataset.lathato === '0');
    await ctx.close();
    const a = await nezet(false);
    assert.equal(await a.lap.evaluate(() => getComputedStyle(document.getElementById('el-sav')).display), 'none');
    await a.ctx.close();
  });

  test('a gorgetes-gomb az urlapra visz, az URL nem valtozik (nincs hash / history)', async () => {
    const { ctx, lap } = await nezet(true);
    const url0 = lap.url();
    await lap.click('#el-fo-gomb');
    await lap.waitForFunction(() => document.getElementById('foglalas').getBoundingClientRect().top < 300);
    assert.equal(lap.url(), url0);
    await ctx.close();
  });
});
