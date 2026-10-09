// Az /oxigenterapia-budapest landing eredmeny-szekcioinak tesztjei (2026-10-09): az Oxygeni-blokk atirt cime, es az uj "A mi vendegeink eredmenyei" blokk
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
    const oxygeni = html.slice(html.indexOf('id="eredmenyek"'), html.indexOf('id="sajat-eredmenyek"'));
    assert.equal((oxygeni.match(/Forrás: Oxygeni Hair/g) || []).length, 4, 'a negy panasz-csoport tovabbra is jeloli a forrast');
    assert.equal((oxygeni.match(/<figure class="ba">/g) || []).length, 21, 'a regi 21 kartya valtozatlan');
    assert.ok(!oxygeni.includes('<figcaption>'), 'a regi kartyakon nincs felirat');
  });

  test('az uj blokk: kulon szekcio, kulon azonositok, 10 kartya felirattal, a hero-galeria valtozatlan', () => {
    assert.match(html, /<section class="eredmenyek eredmenyek-sajat" id="sajat-eredmenyek" aria-labelledby="sajat-eredmenyek-cim">/);
    assert.match(html, /<h2 id="sajat-eredmenyek-cim" class="kozepre">A mi vendégeink eredményei<\/h2>/);
    const resz = html.slice(html.indexOf('id="sajat-eredmenyek"'), html.indexOf('<!-- ============ 4. KEZELOK'));
    assert.equal((resz.match(/<figure class="ba">/g) || []).length, 10, '10 kartya');
    assert.equal((resz.match(/<figcaption>/g) || []).length, 10, 'mindegyiknek van felirata');
    assert.match(resz, /<b>5 alkalom után<\/b>/);
    assert.match(resz, /<b>10 alkalom után<\/b>/);
    assert.match(resz, /<b>15 alkalom után<\/b>/);
    assert.match(resz, /<span>Zsíros fejbőr, hajhullás<\/span>/);
    assert.match(resz, /<span>Hajhullás, száraz fejbőr<\/span>/);
    assert.ok(!/garant|gyógyul|garanci/i.test(resz), 'nincs eredmeny-igeret');
    assert.ok(!/data-cta/.test(resz), 'az uj blokkban nincs uj merendo CTA');
    // a hero-galeria: 5 dia, a felirata ugyanaz
    const hero = html.slice(html.indexOf('id="hero-galeria"'), html.indexOf('id="hg-pontok"'));
    assert.equal((hero.match(/<figure class="hg-dia">/g) || []).length, 5);
    assert.match(hero, /aria-label="Valós előtte és utána fotók: hajhullás"/);
  });

  test('a kartya-kepek letezo, 760x507-es, kicsi JPEG-ek a sajat tarhelyen (nincs kulso kep, nincs nyers forras a repoban)', () => {
    const forrasok = [...html.slice(html.indexOf('id="sajat-eredmenyek"')).matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]).slice(0, 10);
    assert.equal(forrasok.length, 10);
    assert.equal(new Set(forrasok).size, 10, 'mind kulonbozo');
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
        assert.deepEqual(adat.cimek, ['Az oxigénterápia ilyen hatást ér el', 'A mi vendégeink eredményei']);
        assert.deepEqual(adat.torott, [], 'nincs torott kep');
        assert.ok(adat.szeles <= adat.ablak, `vizszintes gorges: scrollWidth ${adat.szeles} > ${adat.ablak}`);
        assert.deepEqual(hibak, []);
      } finally { await ctx.close(); }
    });

    test('az uj blokk lapozoja mukodik (elore / vissza), es az Oxygeni-blokk lapozoi is; a felirat latszik', async () => {
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
        // az uj blokk kartyai: felirat a kep alatt, a cimkek a kepen
        const k = await p.evaluate(() => [...document.querySelectorAll('#sajat-eredmenyek .ba')].map((b) => ({
          felirat: (b.querySelector('figcaption') || {}).textContent || '',
          cimkek: [...b.querySelectorAll('.cimke')].map((c) => c.textContent),
          kepAlatt: !!b.querySelector('figcaption') && b.querySelector('figcaption').getBoundingClientRect().top >= b.querySelector('.ba-kep').getBoundingClientRect().bottom - 1,
        })));
        assert.equal(k.length, 10);
        for (const x of k) {
          assert.deepEqual(x.cimkek, ['Előtte', 'Utána']);
          assert.ok(x.kepAlatt, 'a felirat a kep alatt van: ' + x.felirat);
          assert.ok(x.felirat.trim().length > 0);
        }
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
