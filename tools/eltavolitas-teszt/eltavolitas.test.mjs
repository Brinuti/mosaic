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
  test('az urlap method="post" (JS nelkul sem kerul szemelyes adat az URL-be / a GA4 page_location-be)', () => {
    assert.match(HTML, /<form id="el-urlap" method="post" novalidate>/);
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
          if (e.closest('[hidden]') || !e.offsetParent || e.closest('.el-ar')) continue; // az ar-sor ket oszlopos (nev | ar): a baseline-igazitas miatt nem sortoresi arva
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

  test('urlap: ures bekuldes hibakat mutat es nem kuld; ervenyes bekuldes a jelolt mezokkel megy', async () => {
    const { ctx, lap, hibak, posztok } = await nezet(true);
    await lap.evaluate(() => document.getElementById('foto-urlap').scrollIntoView());
    await lap.click('#el-kuld');
    for (const m of ['foto', 'terulet', 'nev', 'telefon', 'email', 'hozzajarul']) {
      assert.ok((await lap.textContent('#el-h-' + m)).trim().length > 5, m + ': nincs hibauzenet');
    }
    assert.equal(posztok.length, 0);
    // fotok: 2 db a repo kepeibol
    await lap.setInputFiles('#el-foto-input', [path.join(GYOKER, 'assets/img/eltavolitas/kozben-a.jpg'), path.join(GYOKER, 'assets/img/eltavolitas/kozben-b.jpg')]);
    await lap.waitForSelector('.el-mini');
    assert.equal(await lap.locator('.el-mini').count(), 2);
    await lap.selectOption('#el-terulet', 'szemöldök');
    await lap.fill('#el-nev', 'Teszt Elek');
    await lap.fill('#el-telefon', '06 30 111 2222');
    await lap.fill('#el-email', 'teszt@example.com');
    // hozzajarulas nelkul nem megy
    await lap.click('#el-kuld');
    assert.equal(posztok.length, 0);
    assert.ok((await lap.textContent('#el-h-hozzajarul')).length > 5);
    await lap.check('#el-hozzajarul');
    // dataLayer: hozzajarulas nelkul nincs esemeny; majd 'ana' hozzajarulassal egy esemeny, PII nelkul
    await lap.evaluate(() => { window.dataLayer = []; window.mhSuti = { engedely: (k) => k === 'ana' }; });
    await lap.click('#el-kuld');
    await lap.waitForSelector('#el-kesz:not([hidden])');
    assert.equal(posztok.length, 1);
    const adat = posztok[0].postData() || '';
    const buf = posztok[0].postDataBuffer() ? posztok[0].postDataBuffer().toString('latin1') : adat;
    for (const mezo of ['name="form-name"', 'pmu-proba-foto', 'Eltávolítás'.normalize('NFC'), 'name="oldal"', NEV, 'name="foto1"', 'name="foto2"', 'name="bot-field"']) {
      assert.ok(buf.includes(mezo) || Buffer.from(buf, 'latin1').toString('utf8').includes(mezo), 'hianyzik a bekuldesbol: ' + mezo);
    }
    const utf = Buffer.from(buf, 'latin1').toString('utf8');
    assert.match(utf, /name="kezeles"\r\n\r\nSminktetoválás eltávolítás – szemöldök \(fotó alapján\)/);
    assert.match(utf, /name="ag"\r\n\r\nEltávolítás/);
    assert.ok(!utf.includes('name="foto3"'));
    const esemenyek = (await lap.evaluate(() => window.dataLayer)).filter((e) => e.event === 'eltavolitas_foto_lead');
    assert.equal(esemenyek.length, 1);
    assert.deepEqual(Object.keys(esemenyek[0]).sort(), ['business', 'event', 'event_id', 'foto_db', 'lead_type', 'source_page', 'terulet']);
    assert.equal(esemenyek[0].foto_db, 2);
    assert.equal(esemenyek[0].terulet, 'szemoldok');
    assert.ok(!JSON.stringify(esemenyek).match(/Teszt|example|111/), 'PII az esemenyben');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('urlap: hozzajarulas (ana) nelkul nincs dataLayer-esemeny, a kuldes ettol megy', async () => {
    const { ctx, lap, posztok } = await nezet(true);
    await lap.evaluate(() => { window.dataLayer = []; window.mhSuti = { engedely: () => false }; });
    await lap.setInputFiles('#el-foto-input', [path.join(GYOKER, 'assets/img/eltavolitas/kozben-a.jpg')]);
    await lap.waitForSelector('.el-mini');
    await lap.selectOption('#el-terulet', 'ajak, szájkontúr');
    await lap.fill('#el-nev', 'Teszt Elek'); await lap.fill('#el-telefon', '+36 30 111 2222'); await lap.fill('#el-email', 'teszt@example.com');
    await lap.check('#el-hozzajarul');
    await lap.click('#el-kuld');
    await lap.waitForSelector('#el-kesz:not([hidden])');
    assert.equal(posztok.length, 1);
    assert.equal((await lap.evaluate(() => window.dataLayer)).filter((e) => e.event === 'eltavolitas_foto_lead').length, 0);
    await ctx.close();
  });

  test('urlap: a szerverhiba (HTTP 500) hibauzenetet ad, az urlap marad, a masodik probalkozas sikerul', async () => {
    const { ctx, lap, posztok } = await nezet(true);
    let valasz = 500;
    await lap.unroute('**/*');
    await lap.route('**/*', (r) => { const k = r.request(); if (new URL(k.url()).origin !== bazis) return r.abort(); if (k.method() === 'POST') { posztok.push(k); return r.fulfill({ status: valasz, body: valasz === 200 ? 'ok' : 'hiba' }); } return r.continue(); });
    await lap.setInputFiles('#el-foto-input', [path.join(GYOKER, 'assets/img/eltavolitas/kozben-a.jpg')]);
    await lap.waitForSelector('.el-mini');
    await lap.selectOption('#el-terulet', 'szemöldök');
    await lap.fill('#el-nev', 'Teszt Elek'); await lap.fill('#el-telefon', '06 30 111 2222'); await lap.fill('#el-email', 'teszt@example.com');
    await lap.check('#el-hozzajarul');
    await lap.click('#el-kuld');
    await lap.waitForFunction(() => document.getElementById('el-h-kuld').textContent.length > 10);
    assert.equal(await lap.isHidden('#el-kesz'), true);
    assert.equal(await lap.isVisible('#el-urlap'), true);
    assert.equal(await lap.getAttribute('#el-kuld', 'aria-disabled'), null);
    assert.equal(await lap.locator('.el-mini').count(), 1, 'a fotok megmaradnak az ujraprobalkozashoz');
    valasz = 200;
    await lap.click('#el-kuld');
    await lap.waitForSelector('#el-kesz:not([hidden])');
    assert.equal(posztok.length, 2);
    await ctx.close();
  });

  test('urlap: legfeljebb 5 foto (a 6. nem kerul be, a figyelmeztetes marad), a torles mukodik, es kozben a hibak aria-invalid-ot kapnak', async () => {
    const { ctx, lap } = await nezet(true);
    const kepek = ['kozben-a.jpg', 'kozben-b.jpg', 'elotte-c.jpg', 'utana-c.jpg', 'video-poszter.jpg', 'kozben-a.jpg'].map((f) => path.join(GYOKER, 'assets/img/eltavolitas', f));
    await lap.setInputFiles('#el-foto-input', kepek);
    await lap.waitForFunction(() => document.querySelectorAll('.el-mini').length === 5);
    assert.match(await lap.textContent('#el-h-foto'), /Legfeljebb 5/);
    await lap.click('.el-mini button');
    assert.equal(await lap.locator('.el-mini').count(), 4);
    await lap.click('#el-kuld');
    assert.equal(await lap.getAttribute('#el-nev', 'aria-invalid'), 'true');
    assert.equal(await lap.getAttribute('#el-terulet', 'aria-invalid'), 'true');
    assert.equal(await lap.evaluate(() => document.activeElement.id), 'el-terulet', 'az elso hibas mezo (foto megvan) a terulet');
    await lap.fill('#el-nev', 'Teszt Elek');
    assert.equal(await lap.getAttribute('#el-nev', 'aria-invalid'), null);
    await ctx.close();
  });

  test('JS nelkul az urlap POST-ot kuld a sajat cimre, az adat nem kerul az URL-be', async () => {
    const ctx = await bongeszo.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const lap = await ctx.newPage();
    const kerelmek = [];
    await lap.route('**/*', (r) => { const k = r.request(); if (new URL(k.url()).origin !== bazis) return r.abort(); if (k.method() === 'POST') { kerelmek.push({ m: k.method(), u: k.url() }); return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' }); } return r.continue(); });
    await lap.goto(bazis + '/' + NEV, { waitUntil: 'load' });
    await lap.fill('#el-nev', 'Teszt Elek'); await lap.fill('#el-telefon', '06 30 111 2222'); await lap.fill('#el-email', 'teszt@example.com');
    // Enter a mezoben = az urlap bekuldese JS nelkul (a gombkattintas-varakozas ritkan 30 mp-et allt, ez nem fugg tole)
    await Promise.all([lap.waitForRequest((k) => k.method() === 'POST', { timeout: 15000 }), lap.press('#el-email', 'Enter')]);
    assert.equal(kerelmek.length, 1);
    assert.equal(kerelmek[0].m, 'POST');
    assert.ok(!new URL(kerelmek[0].u).search, 'az URL-ben nem lehet lekerdezes-resz: ' + kerelmek[0].u);
    assert.ok(!/Teszt|example|111/.test(lap.url()), 'szemelyes adat az URL-ben');
    await ctx.close();
  });

  test('mobil: a ragados sav a hero utan latszik, az urlapnal elrejtozik; asztalon nincs', async () => {
    const { ctx, lap } = await nezet(true);
    assert.equal(await lap.getAttribute('#el-sav', 'data-lathato'), '0');
    assert.equal(await lap.evaluate(() => getComputedStyle(document.getElementById('el-sav')).visibility), 'hidden', 'rejtett allapotban nem fokuszalhato');
    await lap.evaluate(() => window.scrollTo(0, 1400));
    await lap.waitForFunction(() => document.getElementById('el-sav').dataset.lathato === '1');
    await lap.evaluate(() => document.getElementById('foto-urlap').scrollIntoView());
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
    await lap.waitForFunction(() => document.getElementById('foto-urlap').getBoundingClientRect().top < 300);
    assert.equal(lap.url(), url0);
    await ctx.close();
  });
});
