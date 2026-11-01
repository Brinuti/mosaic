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
  test('a "Hogyan zajlik?" szakasz 3 lepes, hasonlo szovegmennyiseggel; nincs benne a foglalo-magyarazat es a nov. 9., az elso talalkozon mar az eltavolitast kezdhetjuk', () => {
    const r = HTML.slice(HTML.indexOf('id="el-lepes-cim"'), HTML.indexOf('<!-- ============ 5. HANY ALKALOM'));
    const bekezdesek = [...r.matchAll(/<li><h3>[^<]+<\/h3><p>([^<]+)<\/p><\/li>/g)].map((m) => m[1]);
    assert.equal(bekezdesek.length, 3);
    const hosszak = bekezdesek.map((b) => b.length);
    assert.ok(Math.max(...hosszak) <= Math.min(...hosszak) * 1.25, 'a 3 blokk szovegmennyisege hasonlo: ' + hosszak.join(', '));
    assert.match(r, /feltöltesz egy fotót/);
    assert.ok(!/november 9/.test(r), 'a lepesekben nincs nov. 9.');
    assert.ok(!/A foglaló megkérdezi|kérek egy fotót róla/.test(r + HTML.slice(HTML.indexOf('id="el-fogl-cim"'), HTML.indexOf('id="el-fogl-cim"') + 400)), 'nincs foglalo-magyarazat');
    assert.match(r, /el is kezdhetjük az eltávolítást/);
    assert.match(r, /a kezelés a konzultációt is magában foglalja/);
    assert.match(r, /Külön konzultációra csak akkor jöjj, ha még nem biztos/);
    assert.ok(!/(elvégezni az eltávolítást|egy alkalommal eltávolít)/i.test(r + HTML.replace(/<[^>]+>/g, ' ')), 'nem sugallunk egy alkalmas teljes eltavolitast (1–3 alkalom)');
  });
  test('az oldal latszo szovegeben nincs "november 9" (Feri, 2026-11-01: a naptar magatol mutatja, mikortol lehet idopontot valasztani)', () => {
    const szoveg = HTML.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
    assert.ok(!/november\s*9|nov\.\s*9/i.test(szoveg), 'nov. 9. kiiras az oldalon');
    assert.match(szoveg, /A szabad napokat a naptárban látod\./, 'a kezeles-kartya mondata megmaradt (nov. 9. nelkul)');
  });
  test('az "Amit vallalok" blokk (Feri, 2026-11-01) torolve; a "Mikor nem vallalom" marad; a nem-igeret megjegyzes a "Hany alkalom kell?" reszben van; a GYIK nem hivatkozik a torolt blokkra', () => {
    const tiszta = HTML.replace(/<!--[\s\S]*?-->/g, '');
    assert.ok(!/Amit vállalok|id="vallalasok"|class="garancia|garancia-kartya|\d\. vállalás/.test(tiszta), 'az "Amit vallalok" blokk nem lehet az oldalon');
    assert.match(tiszta, /Mikor nem vállalom a kezelést\?/);
    const varni = tiszta.slice(tiszta.indexOf('id="el-varni-cim"'), tiszta.indexOf('id="el-ar-cim"'));
    assert.match(varni, /class="el-varni-megj"[^>]*>[^<]*Teljes eltűnést, hegmentességet vagy pontos alkalomszámot nem ígérek/);
    assert.ok(!/Az oldalon leírt vállalásaim/.test(tiszta), 'a GYIK nem hivatkozhat a torolt vallalasokra');
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

  // ---------- kepek nagyban, nagyithatoan (Feri, 2026-11-01) ----------
  const nagyNyit = async (lap, n = 0) => {
    await lap.locator('.el-galeria .el-kep').nth(n).scrollIntoViewIfNeeded();
    await lap.locator('.el-galeria .el-kep').nth(n).click();
    await lap.waitForSelector('dialog.el-nagy[open]');
  };
  const nagyitas = (lap) => lap.evaluate(() => parseFloat(document.querySelector('.el-nagy-kep').dataset.nagyitas));
  const felirat = (lap) => lap.evaluate(() => document.querySelector('.el-nagy-felirat').textContent);
  const kepCel = (lap) => lap.evaluate(() => { const r = document.querySelector('.el-nagy-kep').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });

  test('asztal: a 6 kep kattintasra nagyban nyilik (nyitas, lapozas, Esc, fokusz-visszaadas, billentyuzet); a bongeszo hatterben nem gorget; nincs POST, nincs dataLayer-esemeny', async () => {
    const { ctx, lap, hibak, posztok } = await nezet(false);
    assert.equal(await lap.locator('.el-galeria .el-kep[role=button][tabindex="0"]').count(), 6);
    const dl0 = await lap.evaluate(() => (window.dataLayer || []).length);
    await nagyNyit(lap, 0);
    assert.match(await lap.getAttribute('.el-nagy-kep', 'src'), /elotte-c-v2\.jpg$/);
    assert.equal(await felirat(lap), 'Előtte · 1 / 6');
    // a nagy nezet tenyleg nagyobb, mint a kis kep (asztalon legalabb 450 px magas)
    const meret = await kepCel(lap);
    assert.ok(meret.h >= 450, 'a nagy kep legalabb 450 px magas asztalon: ' + meret.h);
    assert.equal(await lap.evaluate(() => document.documentElement.style.overflow), 'hidden', 'a hatter nem gorget');
    // lapozas nyillal
    await lap.keyboard.press('ArrowRight');
    assert.equal(await felirat(lap), 'Közvetlenül utána · 2 / 6');
    assert.match(await lap.getAttribute('.el-nagy-kep', 'src'), /utana-c-v2\.jpg$/);
    await lap.keyboard.press('ArrowLeft');
    assert.equal(await felirat(lap), 'Előtte · 1 / 6');
    await lap.keyboard.press('ArrowLeft'); // korbe: az utolso
    assert.equal(await felirat(lap), 'Közvetlenül utána · 6 / 6');
    // Esc zar, a fokusz a megnyitott kepre kerul vissza
    await lap.keyboard.press('Escape');
    await lap.waitForFunction(() => !document.querySelector('dialog.el-nagy[open]'));
    await lap.waitForFunction(() => document.documentElement.style.overflow === '', null, { timeout: 2000 }); // a 'close' esemeny aszinkron erkezik
    assert.equal(await lap.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-nagyit')), '0', 'a fokusz a megnyitott kepre kerul vissza');
    // billentyuzet: Enter nyit, szokoz a felengedesre nyit (es nem zarja be azonnal)
    await lap.keyboard.press('Enter');
    await lap.waitForSelector('dialog.el-nagy[open]');
    await lap.keyboard.press('Escape');
    await lap.waitForFunction(() => !document.querySelector('dialog.el-nagy[open]'));
    await lap.keyboard.press('Space');
    await lap.waitForSelector('dialog.el-nagy[open]');
    await lap.waitForTimeout(150);
    assert.equal(await lap.isVisible('dialog.el-nagy[open]'), true, 'a szokoz felengedese nem zarhatja be');
    // a nagyitas gomb zar-gombjara kattintas is zar
    await lap.click('dialog.el-nagy .el-nagy-fej button');
    await lap.waitForFunction(() => !document.querySelector('dialog.el-nagy[open]'));
    assert.equal(await lap.evaluate(() => (window.dataLayer || []).length), dl0, 'a nagyito nem hoz letre dataLayer-esemenyt');
    assert.equal(posztok.length, 0);
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('asztal: gorgetessel, + / - / 100% gombokkal, kattintassal nagyit; huzassal mozgathato, a kep nem hagyja el a kepernyot; hatterre kattintas zar', async () => {
    const { ctx, lap } = await nezet(false);
    await nagyNyit(lap, 2);
    assert.equal(await nagyitas(lap), 1);
    assert.equal(await lap.isDisabled('[aria-label="Kicsinyítés"]'), true, '1x-en a kicsinyites tiltott');
    let c = await kepCel(lap);
    await lap.mouse.move(c.x, c.y);
    await lap.mouse.wheel(0, -500);
    await lap.waitForFunction(() => parseFloat(document.querySelector('.el-nagy-kep').dataset.nagyitas) > 1.5);
    const g = await nagyitas(lap);
    assert.ok(g > 1.5 && g <= 4, 'gorgetes: ' + g);
    // + gomb, majd maximum
    for (let i = 0; i < 6; i++) await lap.click('[aria-label="Nagyítás"]', { force: true }).catch(() => {});
    assert.ok(Math.abs((await nagyitas(lap)) - 4) < 0.01, 'a nagyitas plafonja 4x');
    assert.equal(await lap.isDisabled('[aria-label="Nagyítás"]'), true);
    // huzas: a kep jobbra huzva sem hagyhatja el a keretet (a bal szele nem johet a stage bal szele moge)
    c = await kepCel(lap);
    const stage = await lap.evaluate(() => { const r = document.querySelector('.el-nagy-szint').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
    await lap.mouse.move(c.x, c.y); await lap.mouse.down(); await lap.mouse.move(c.x + 900, c.y + 900, { steps: 8 }); await lap.mouse.up();
    let r = await lap.evaluate(() => { const k = document.querySelector('.el-nagy-kep').getBoundingClientRect(); return { l: k.left, r: k.right, t: k.top, b: k.bottom }; });
    assert.ok(r.l <= stage.l + 1 && r.t <= stage.t + 1, 'a kep bal / felso szele nem johet beljebb a keretnel: ' + JSON.stringify({ r, stage }));
    assert.equal(await lap.isVisible('dialog.el-nagy[open]'), true, 'a huzas nem zar');
    // 100% gomb
    await lap.click('.el-nagy-egy');
    assert.equal(await nagyitas(lap), 1);
    await lap.waitForTimeout(260); // a 0.12 s-os atmenet utan olvassuk a kep helyet
    // kattintas a kepre: nagyit; ujabb kattintas: visszaall
    c = await kepCel(lap);
    await lap.mouse.click(c.x, c.y);
    assert.ok(Math.abs((await nagyitas(lap)) - 2.5) < 0.01, 'kattintas = 2.5x');
    await lap.waitForTimeout(260);
    c = await kepCel(lap);
    await lap.mouse.click(Math.min(c.x, stage.r - 40), Math.min(c.y, stage.b - 40));
    assert.equal(await nagyitas(lap), 1, 'masodik kattintas visszaall');
    // billentyuzet: + / - / 0
    await lap.keyboard.press('+');
    assert.ok((await nagyitas(lap)) > 1.4);
    await lap.keyboard.press('0');
    assert.equal(await nagyitas(lap), 1);
    // a kepen kivuli hatterre kattintas zar
    await lap.mouse.click(60, 400);
    await lap.waitForFunction(() => !document.querySelector('dialog.el-nagy[open]'));
    await ctx.close();
  });

  test('mobil: koppintasra nagyban nyilik (teljes szelesseg); csipes, dupla koppintas, huzas, vizszintes huzas = lapozas; a kep nem hagyja el a kepernyot', async () => {
    const { ctx, lap, hibak } = await nezet(true);
    await lap.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    const koppint = async (sel) => { const r = await lap.evaluate((s) => { const e = document.querySelector(s).getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; }, sel); await lap.touchscreen.tap(r.x, r.y); };
    const cdp = await ctx.newCDPSession(lap);
    const erint = (tipus, pontok) => cdp.send('Input.dispatchTouchEvent', { type: tipus, touchPoints: pontok });
    await lap.locator('.el-galeria .el-kep').first().scrollIntoViewIfNeeded();
    await lap.locator('.el-galeria .el-kep').first().tap();
    await lap.waitForSelector('dialog.el-nagy[open]');
    let c = await kepCel(lap);
    assert.ok(c.w >= 380, 'mobilon a nagy kep a teljes szelesseget kitolti: ' + c.w);
    assert.ok(c.w > 2 * 150, 'a nagy kep jelentosen nagyobb, mint a kis csempe');
    // csipes: ket ujj eltavolodik
    await erint('touchStart', [{ x: c.x - 40, y: c.y, id: 1 }, { x: c.x + 40, y: c.y, id: 2 }]);
    for (let i = 1; i <= 8; i++) await erint('touchMove', [{ x: c.x - 40 - i * 15, y: c.y, id: 1 }, { x: c.x + 40 + i * 15, y: c.y, id: 2 }]);
    await erint('touchEnd', []);
    const cs = await nagyitas(lap);
    assert.ok(cs > 2, 'a csipes nagyit: ' + cs);
    // huzas nagyitott kepen: mozgatja, de a kep a kereten belul marad (a stage-et mindig kitolti)
    c = await kepCel(lap);
    await erint('touchStart', [{ x: 200, y: 400, id: 1 }]);
    for (let i = 1; i <= 8; i++) await erint('touchMove', [{ x: 200 + i * 40, y: 400 + i * 30, id: 1 }]);
    await erint('touchEnd', []);
    const kereten = await lap.evaluate(() => { const k = document.querySelector('.el-nagy-kep').getBoundingClientRect(); const s = document.querySelector('.el-nagy-szint').getBoundingClientRect(); return k.left <= s.left + 1 && k.right >= s.right - 1 && k.top <= s.top + 1 && k.bottom >= s.bottom - 1; });
    assert.equal(kereten, true, 'nagyitva a kep kitolti a keretet');
    assert.equal(await lap.isVisible('dialog.el-nagy[open]'), true, 'a huzas nem zar');
    assert.equal(await felirat(lap), 'Előtte · 1 / 6', 'nagyitva a vizszintes huzas nem lapoz');
    await lap.waitForTimeout(600); // a gyors, szintetikus huzas "fling"-je lecsengjen (a Chrome az elso koppintast egy futo fling leallitasara hasznalja)
    // 100% gomb, majd dupla koppintas a kepen: 2.5x, ujabb dupla koppintas: vissza
    await koppint('.el-nagy-egy');
    assert.equal(await nagyitas(lap), 1);
    await lap.waitForTimeout(260);
    c = await kepCel(lap);
    await lap.touchscreen.tap(c.x, c.y); await lap.touchscreen.tap(c.x, c.y);
    assert.ok(Math.abs((await nagyitas(lap)) - 2.5) < 0.01, 'dupla koppintas = 2.5x');
    await lap.waitForTimeout(400);
    await lap.touchscreen.tap(c.x, c.y); await lap.touchscreen.tap(c.x, c.y);
    assert.equal(await nagyitas(lap), 1, 'masodik dupla koppintas visszaall');
    // vizszintes huzas (nem nagyitott): lapoz, balra = kovetkezo
    await lap.waitForTimeout(500);
    c = await kepCel(lap);
    await erint('touchStart', [{ x: c.x + 100, y: c.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) await erint('touchMove', [{ x: c.x + 100 - i * 35, y: c.y + 4, id: 1 }]);
    await erint('touchEnd', []);
    assert.equal(await felirat(lap), 'Közvetlenül utána · 2 / 6');
    await lap.waitForTimeout(600); // a szintetikus huzas lecsengese utan koppintunk
    // lapozo gombok, zar gomb
    await koppint('[aria-label="Előző kép"]');
    assert.equal(await felirat(lap), 'Előtte · 1 / 6');
    await koppint('dialog.el-nagy .el-nagy-fej button');
    await lap.waitForFunction(() => !document.querySelector('dialog.el-nagy[open]'));
    const vizsz = await lap.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(vizsz <= 1, 'nincs vizszintes kilogas a nagyito utan: ' + vizsz);
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('mobil: a kartya-valasztas (ingyenes konzultacio / eltavolito kezeles) utan az oldal a naptarhoz ugrik; a hero gomb is oda visz, ha a szekcio tetejerol nem latszana', async () => {
    const { ctx, lap } = await nezet(true);
    await lap.route('**/foglalo-pmu**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>foglalo</p>' }));
    await lap.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    const vh = 844;
    const dobozTop = () => lap.evaluate(() => document.getElementById('el-foglalo-doboz').getBoundingClientRect().top);
    const megall = async () => { let elozo = -1; for (let i = 0; i < 40; i++) { const y = await lap.evaluate(() => Math.round(scrollY)); if (y === elozo) return; elozo = y; await lap.waitForTimeout(80); } };
    // a) a szekcio tetejen allunk, a ket kartya latszik: kartya-koppintas -> a naptar a kepernyo felso 60%-aban
    await lap.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('foglalas').scrollIntoView(); });
    await lap.tap('.el-valaszt[data-valaszt=konzultacio]');
    await lap.waitForFunction(() => !document.getElementById('el-foglalo-doboz').hidden);
    await megall();
    let top = await dobozTop();
    assert.ok(top >= 0 && top < vh * 0.6, 'konzultacio-kartya utan a naptar teteje latszik: ' + top);
    // b) az eltavolito kezelest valasztva ugyanez (a kartyak fole gorgetve, majd valasztas)
    await lap.evaluate(() => document.getElementById('foglalas').scrollIntoView());
    await lap.tap('.el-valaszt[data-valaszt=kezeles]');
    await lap.waitForFunction(() => document.getElementById('el-foglalo').getAttribute('src').endsWith('kezeles=491949'));
    await megall();
    top = await dobozTop();
    assert.ok(top >= 0 && top < vh * 0.6, 'kezeles-kartya utan a naptar teteje latszik: ' + top);
    // c) ha a naptar mar latszik, nem ugrik (nincs felesleges mozgas)
    const y0 = await lap.evaluate(() => scrollY);
    await lap.evaluate(() => document.querySelector('.el-valaszt[data-valaszt=kezeles]').click());
    await lap.waitForTimeout(400);
    assert.equal(await lap.evaluate(() => scrollY), y0, 'latszo naptarnal nincs gorgetes');
    // d) a hero gombja: a naptar mobilon a kepernyo also 40%-aba esne a szekcio-tetoről -> kozvetlenul a naptarra visz
    await lap.evaluate(() => scrollTo(0, 0));
    await lap.waitForTimeout(100);
    await lap.tap('#el-fo-gomb');
    await megall();
    top = await dobozTop();
    assert.ok(top >= 0 && top < vh * 0.6, 'hero gomb utan a naptar teteje latszik: ' + top);
    await ctx.close();
  });
});
