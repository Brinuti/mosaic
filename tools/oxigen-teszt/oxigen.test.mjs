// Az /oxigenterapia-budapest landing eredmeny-szekcioinak tesztjei (2026-10-09): az Oxygeni-blokk atirt cime, es az uj "Legfrissebb eredmenyeink" blokk
// (a szalon sajat elotte-utana kartyai, ugyanaz a .ba komponens + lapozo). Bongeszoben a konnyu helyi szerver ellen (nincs dist/ build).
//
//   node --test tools/oxigen-teszt/oxigen.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja,
// ha a repoban nincs telepitve). Kulso halozati forgalom nincs: minden nem helyi keres le van tiltva.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const OLDAL = '/oxigenterapia-budapest';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) {
    try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ }
  }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

const html = fs.readFileSync(path.join(GYOKER, 'foglalas', 'oxigenterapia-budapest.html'), 'utf8');
/** A JPEG meretei (SOF jelolo), hogy ne kelljen kepkezelo csomag. */
function jpegMeret(fajl) {
  const b = fs.readFileSync(fajl);
  assert.equal(b[0], 0xff, `${fajl}: nem JPEG`);
  assert.equal(b[1], 0xd8, `${fajl}: nem JPEG`);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xc2) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), bajt: b.length };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${fajl}: nincs SOF jelolo`);
}

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

/** Uj oldal: csak helyi forgalom; csokkentett mozgas (a lapozo azonnal gorget); a lusta kepek is betoltodnek. */
async function nyit({ mobil = false } = {}) {
  const ctx = await bongeszo.newContext({
    viewport: { width: mobil ? 390 : 1440, height: mobil ? 844 : 900 },
    reducedMotion: 'reduce',
    ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}),
  });
  const p = await ctx.newPage();
  const hibak = [];
  p.on('pageerror', (e) => hibak.push(String(e)));
  await p.route((u) => !/^http:\/\/localhost/.test(u.href), (r) => r.abort());
  await p.goto(bazis + OLDAL, { waitUntil: 'load' });
  await p.evaluate(async () => {
    for (const i of document.images) i.loading = 'eager';
    await Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((ok) => { i.onload = i.onerror = ok; }))));
  });
  return { ctx, p, hibak };
}

describe('az oldal forrasa (fajl)', () => {
  test('az Oxygeni-blokk uj cime es a lead; a regi cim nincs sehol', () => {
    assert.match(html, /<h2 id="eredmenyek-cim" class="kozepre">Az oxigénterápia ilyen hatást ér el<\/h2>/);
    assert.ok(!html.includes('Az Oxygeni vendégeinek valós javulásai'), 'a regi cim eltunt');
    assert.match(html, /Oxygeni Hair vendégeinek valós előtte–utána fotói/, 'a lead megtartja a tenyt: ezek az Oxygeni vendegei');
    const oxygeni = html.slice(html.indexOf('id="eredmenyek"'), html.indexOf('id="glamour"'));
    assert.equal((oxygeni.match(/Forrás: Oxygeni Hair/g) || []).length, 4, 'a negy panasz-csoport tovabbra is jeloli a forrast');
    assert.equal((oxygeni.match(/<figure class="ba">/g) || []).length, 21, 'a regi 21 kartya valtozatlan');
    assert.ok(!oxygeni.includes('<figcaption>'), 'a regi kartyakon nincs felirat');
  });

  test('Glamour-ajanlo (2026-10-09): a ket eredmeny-szekcio kozott; a cikkbol SZO SZERINT a teljes mondat; "Glamour cikk" felirat + logo; link a cikkre (uj lapon, noopener); a logo-fajl megvan', () => {
    const e = html.indexOf('id="eredmenyek"'), g = html.indexOf('id="glamour"'), s2 = html.indexOf('id="sajat-eredmenyek"');
    assert.ok(e > -1 && g > e && s2 > g, 'sorrend: eredmenyek -> glamour -> sajat-eredmenyek');
    const doboz = html.slice(g, s2);
    assert.match(doboz, /<blockquote><p>A változás a hidratáló kezelésnek köszönhetően szinte azonnal érezhető, a látványos eredményhez azonban 3-4 hónapos, folyamatos terápiára van szükség\.<\/p><\/blockquote>/);
    assert.match(doboz, /<span class="glamour-cimke">Glamour cikk<\/span>/);
    assert.match(doboz, /<span class="glamour-logo" role="img" aria-label="Glamour"><\/span>/);
    assert.match(doboz, /<a class="glamour-link" href="https:\/\/www\.glamour\.hu\/szepseg\/oxigenterapia-modszer-hajhullas\/wjcmlmd" target="_blank" rel="noopener" data-cta="glamour-cikk">/);
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets', 'img', 'sajto', 'logok', 'glamour.png')), 'a Glamour-logo fajl megvan');
    const css = fs.readFileSync(path.join(GYOKER, 'assets', 'css', 'oxigen-landing.css'), 'utf8');
    assert.match(css, /\.glamour-logo\s*\{[^}]*\/assets\/img\/sajto\/logok\/glamour\.png/);
  });

  test('az uj blokk: kulon szekcio, cim "Legfrissebb eredmenyeink", alcim "Valos eredmenyek vendegeinktol harom-ot alkalom utan", 6 kartya FELIRAT NELKUL, a hero-galeria valtozatlan', () => {
    assert.match(html, /<section class="eredmenyek eredmenyek-sajat" id="sajat-eredmenyek" aria-labelledby="sajat-eredmenyek-cim">/);
    assert.match(html, /<h2 id="sajat-eredmenyek-cim" class="kozepre">Legfrissebb eredményeink<\/h2>/);
    assert.ok(!html.includes('A mi vendégeink eredményei'), 'a regi cim eltunt');
    const resz = html.slice(html.indexOf('id="sajat-eredmenyek"'), html.indexOf('<!-- ============ 4. KEZELOK'));
    assert.match(resz, /<p class="lead kozepre">Valós eredmények vendégeinktől három-öt alkalom után\.<\/p>/);
    assert.equal((resz.match(/<figure class="ba">/g) || []).length, 6, '6 kartya (mindenki egyszer, egy kep mindenkirol)');
    assert.ok(!resz.includes('<figcaption>'), 'a kartyakon nincs felirat');
    assert.ok(!/\d+ alkalom után|Hajhullás esetén|Forrás:|Valós előtte\/utána fotók|ba-megj|ba-fej|garant|gyógyul|garanci/i.test(resz), 'nincs alkalom-felirat, forras-felirat, labjegyzet, eredmeny-igeret');
    assert.ok(!/data-cta/.test(resz), 'az uj blokkban nincs uj merendo CTA');
    // a hero-galeria: 5 dia, a felirata ugyanaz
    const hero = html.slice(html.indexOf('id="hero-galeria"'), html.indexOf('id="hg-pontok"'));
    assert.equal((hero.match(/<figure class="hg-dia">/g) || []).length, 5);
    assert.match(hero, /aria-label="Valós előtte és utána fotók: hajhullás"/);
  });

  test('a kartya-kepek letezo, 760x507-es, kicsi JPEG-ek a sajat tarhelyen; mindenki csak egyszer szerepel (nincs ketszer ugyanaz az "elotte" kep, nincs ketszer ugyanaz a fajl)', () => {
    const forrasok = [...html.slice(html.indexOf('id="sajat-eredmenyek"')).matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]).slice(0, 6);
    assert.equal(forrasok.length, 6);
    assert.equal(new Set(forrasok).size, 6, 'mind kulonbozo');
    const dir = path.join(GYOKER, 'assets', 'img', 'oxigen');
    assert.deepEqual(fs.readdirSync(dir).filter((f) => /^vendeg-\d\d\.jpg$/.test(f)).sort(), forrasok.map((x) => path.basename(x)).sort(), 'nincs felesleges vendeg-kep a repoban');
    for (const s of forrasok) {
      assert.match(s, /^\/assets\/img\/oxigen\/vendeg-\d\d\.jpg$/, s);
      const f = path.join(GYOKER, s.replace(/^\//, ''));
      assert.ok(fs.existsSync(f), s + ' letezik');
      const { w, h, bajt } = jpegMeret(f);
      assert.deepEqual([w, h], [760, 507], s + ' merete');
      assert.ok(bajt <= 120 * 1024, `${s}: ${bajt} bajt > 120 KB`);
    }
    assert.ok(!fs.existsSync(path.join(GYOKER, 'assets', 'img', 'oxigen', 'vendeg')), 'a Zapier-atvitel nyers kepei (assets/img/oxigen/vendeg/) nincsenek a repoban');
  });
});

for (const [nev, mobil] of [['asztali (1440 px)', false], ['mobil (390 px)', true]]) {
  describe(`bongeszoben: ${nev}`, () => {
    test('a ket blokk sorrendje; minden kep betoltodik; nincs vizszintes oldal-gorges; nincs JS-hiba', async () => {
      const { ctx, p, hibak } = await nyit({ mobil });
      try {
        const adat = await p.evaluate(() => {
          const sorrend = [...document.querySelectorAll('section[id]')].map((s) => s.id);
          const torott = [...document.querySelectorAll('#eredmenyek img, #sajat-eredmenyek img, #hero-galeria img')].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
          const de = document.documentElement;
          return { sorrend, torott, szeles: de.scrollWidth, ablak: innerWidth, cimek: [document.getElementById('eredmenyek-cim').textContent, document.getElementById('sajat-eredmenyek-cim').textContent] };
        });
        assert.ok(adat.sorrend.indexOf('eredmenyek') > -1 && adat.sorrend.indexOf('sajat-eredmenyek') === adat.sorrend.indexOf('eredmenyek') + 1, 'az uj blokk kozvetlenul az Oxygeni-blokk utan van: ' + adat.sorrend.join(','));
        assert.deepEqual(adat.cimek, ['Az oxigénterápia ilyen hatást ér el', 'Legfrissebb eredményeink']);
        assert.deepEqual(adat.torott, [], 'nincs torott kep');
        assert.ok(adat.szeles <= adat.ablak, `vizszintes gorges: scrollWidth ${adat.szeles} > ${adat.ablak}`);
        assert.deepEqual(hibak, []);
      } finally { await ctx.close(); }
    });

    test('Glamour-ajanlo: az eredmenyek koze ekelve, kicsi (nem foglal sok helyet), a logo betoltodik, nincs kilogas, a link a cikkre mutat', async () => {
      const { ctx, p } = await nyit({ mobil });
      try {
        const adat = await p.evaluate(() => {
          const r = (sel) => { const e = document.querySelector(sel); const b = e.getBoundingClientRect(); return { t: b.top + scrollY, b: b.bottom + scrollY, l: b.left, r: b.right, w: b.width, h: b.height }; };
          const logo = document.querySelector('.glamour-logo');
          return { e: r('#eredmenyek'), g: r('#glamour'), d: r('.glamour-doboz'), s: r('#sajat-eredmenyek'), logo: r('.glamour-logo'), mask: getComputedStyle(logo).maskImage || getComputedStyle(logo).webkitMaskImage, ablak: innerWidth,
            szoveg: document.querySelector('.glamour-doboz blockquote').innerText.trim(), cimke: document.querySelector('.glamour-cimke').textContent.trim(), cimkeLathato: getComputedStyle(document.querySelector('.glamour-cimke')).display !== 'none' };
        });
        assert.ok(adat.g.t >= adat.e.b - 1 && adat.s.t >= adat.g.b - 1, 'az eredmeny-szekciok kozott van');
        assert.ok(adat.d.l >= 0 && adat.d.r <= adat.ablak, 'nem log ki: ' + adat.d.l + '..' + adat.d.r);
        assert.ok(adat.d.h < (mobil ? 340 : 230), 'kicsi doboz: ' + Math.round(adat.d.h) + ' px');
        assert.ok(adat.logo.w >= 90 && adat.logo.h >= 20, 'a logo latszik: ' + Math.round(adat.logo.w) + 'x' + Math.round(adat.logo.h));
        assert.match(adat.mask, /glamour\.png/);
        assert.equal(adat.szoveg.replace(/[„”"]/g, '').trim(), 'A változás a hidratáló kezelésnek köszönhetően szinte azonnal érezhető, a látványos eredményhez azonban 3-4 hónapos, folyamatos terápiára van szükség.');
        assert.equal(adat.cimke, 'Glamour cikk');
        const kep = await p.request.get(bazis + '/assets/img/sajto/logok/glamour.png');
        assert.equal(kep.status(), 200, 'a logo-fajl kiszolgalhato');
        assert.equal(await p.getAttribute('.glamour-link', 'href'), 'https://www.glamour.hu/szepseg/oxigenterapia-modszer-hajhullas/wjcmlmd');
      } finally { await ctx.close(); }
    });

    test('az uj blokk lapozoja mukodik (elore / vissza), es az Oxygeni-blokk lapozoi is; a kartyakon nincs felirat', async () => {
      const { ctx, p } = await nyit({ mobil });
      try {
        for (const szelektor of ['#sajat-eredmenyek .ba-keret', '#eredmenyek .ba-keret']) {
          const keret = p.locator(szelektor).first();
          await keret.scrollIntoViewIfNeeded();
          const sav = keret.locator('.ba-sav');
          const elozo = keret.locator('.elozo');
          const kovetkezo = keret.locator('.kovetkezo');
          assert.ok(await kovetkezo.isVisible(), szelektor + ': a nyilak latszanak (nem fer el minden kartya)');
          assert.ok(await elozo.isDisabled(), szelektor + ': az elejen az "elozo" tiltott');
          assert.ok(await sav.evaluate((e) => e.scrollLeft) < 4, 'az elejen all');
          await kovetkezo.click();
          await p.waitForFunction((s) => document.querySelector(s + ' .ba-sav').scrollLeft > 20, szelektor);
          await p.waitForFunction((s) => !document.querySelector(s + ' .elozo').disabled, szelektor);
          assert.ok(await elozo.isEnabled(), szelektor + ': elorelapozas utan az "elozo" engedelyezett');
          await elozo.click();
          await p.waitForFunction((s) => document.querySelector(s + ' .ba-sav').scrollLeft < 4, szelektor);
          // a vegere: a "kovetkezo" a vegen tiltott
          for (let i = 0; i < 14 && (await kovetkezo.isEnabled()); i++) {
            await kovetkezo.click();
            await p.waitForTimeout(60);
          }
          assert.ok(await kovetkezo.isDisabled(), szelektor + ': a vegen a "kovetkezo" tiltott');
        }
        // az uj blokk kartyai: csak a kep, a cimkek (Elotte / Utana) a kepen; nincs felirat, nincs "Forras" / labjegyzet
        const k = await p.evaluate(() => [...document.querySelectorAll('#sajat-eredmenyek .ba')].map((b) => ({
          felirat: !!b.querySelector('figcaption'),
          cimkek: [...b.querySelectorAll('.cimke')].map((c) => c.textContent),
        })));
        assert.equal(k.length, 6);
        for (const x of k) { assert.deepEqual(x.cimkek, ['Előtte', 'Utána']); assert.equal(x.felirat, false); }
        assert.ok(!/Forrás|alkalom után|Valós előtte\/utána fotók a MOSAIC/.test(await p.locator('#sajat-eredmenyek .ba-csoport').innerText()), 'nincs felirat / forras / labjegyzet a kartyak kozott');
      } finally { await ctx.close(); }
    });

    test('a hero-galeria (5 dia, pontok, nyilak) valtozatlanul mukodik', async () => {
      const { ctx, p } = await nyit({ mobil });
      try {
        assert.equal(await p.locator('#hero-galeria .hg-dia').count(), 5);
        assert.equal(await p.locator('#hg-pontok button').count(), 5);
        await p.locator('#hg-kovetkezo').click();
        await p.waitForFunction(() => document.querySelectorAll('#hg-pontok button')[1].getAttribute('aria-current') === 'true');
      } finally { await ctx.close(); }
    });
  });
}
