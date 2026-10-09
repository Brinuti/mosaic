// A kozos videos hero (foldal, paros, kedvezmeny) telefonos sorai + a foldali logosav (2026-10-09, a tulajdonos kerese):
//  - az alcim ("50 perc kezeles + 30 perc hajszaritas") EGY SORBAN, az ar + az akcio ("26 900 Ft-tol" + "Most 20% kedvezmennyel") EGY SORBAN, 320-430 px kozott is, nem log ki
//  - a logosav kulon szekciokent latszik (nagyobb cim, vilagos sav), mobilon a logok lejjebb vannak a cimtol
//  - a logok barmelyikere kattintva a velemenyek oldal "Noi lapok" resze nyilik, a fejlec alatt
// Bongeszos teszt (Playwright), nincs dist/ es nincs kulso halozat.
//
//   node --test tools/hero-teszt/hero-sorok.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
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

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

async function nyit(ut, szeles, magas) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: magas || (mobil ? 844 : 900) }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(bazis + ut, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  return { p, ctx };
}

describe('telefonos hero: alcim es ar-sor egy sorban', () => {
  for (const [ut, nev] of [['/index', 'fooldal'], ['/head-spa-kedvezmeny', 'kedvezmeny'], ['/paros-headspa-budapest', 'paros']]) {
    for (const szeles of [320, 360, 390, 430]) {
      test(`${nev} ${szeles}px: az ar + az akcio egy sorban, nem log ki; a betu olvashato (>= 11 px, 320 px-en >= 10)`, async () => {
        const { p, ctx } = await nyit(ut, szeles);
        const m = await p.evaluate(() => {
          const sor = document.querySelector('.vh-arsor');
          const ps = [...sor.querySelectorAll(':scope > p')];
          const tetejek = ps.map((q) => Math.round(q.getBoundingClientRect().top));
          const lent = ps.map((q) => Math.round(q.getBoundingClientRect().bottom));
          const jobb = Math.max(...ps.map((q) => q.getBoundingClientRect().right));
          const dobozJobb = sor.getBoundingClientRect().right;
          const akcio = parseFloat(getComputedStyle(sor.querySelector('.vh-akcio')).fontSize);
          return { n: ps.length, tetejek, lent, jobb, dobozJobb, akcio, magas: Math.round(sor.getBoundingClientRect().height), ablak: document.documentElement.clientWidth, doc: document.documentElement.scrollWidth, szoveg: sor.innerText.replace(/\s+/g, ' ') };
        });
        assert.equal(m.n, 2);
        // egy sor: a ket bekezdes egymas mellett van (a teteje kozel azonos, a sor alacsony)
        assert.ok(Math.abs(m.tetejek[0] - m.tetejek[1]) <= 14, 'egymas mellett: ' + m.tetejek.join(' / ') + ' | ' + m.szoveg);
        assert.ok(m.magas <= 48, 'a sor egy sor magas: ' + m.magas + ' px | ' + m.szoveg);
        assert.ok(m.jobb <= m.dobozJobb + 1, `nem log ki a dobozbol (${m.jobb} > ${m.dobozJobb})`);
        assert.ok(m.doc <= m.ablak, 'nincs vizszintes gorgetes');
        assert.ok(m.akcio >= (szeles <= 320 ? 10 : 11), 'olvashato betumeret: ' + m.akcio);
        await ctx.close();
      });
    }
  }

  for (const szeles of [320, 360, 390, 430]) {
    test(`fooldal ${szeles}px: az alcim ("50 perc kezeles + 30 perc hajszaritas") egy sorban, a "profi" nincs benne`, async () => {
      const { p, ctx } = await nyit('/index', szeles);
      const m = await p.evaluate(() => {
        const e = document.querySelector('.h1-al');
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        const h1 = document.querySelector('#hero h1').getBoundingClientRect();
        return { szoveg: e.textContent.replace(/\s+/g, ' ').trim(), magas: r.height, sorMagas: parseFloat(cs.lineHeight), jobb: r.right, h1Jobb: h1.right, meret: parseFloat(cs.fontSize) };
      });
      assert.equal(m.szoveg, '50 perc kezelés + 30 perc hajszárítás');
      assert.ok(m.magas < m.sorMagas * 1.5, `egy sor (${m.magas} px, sormagassag ${m.sorMagas})`);
      assert.ok(m.jobb <= m.h1Jobb + 1, 'nem log ki');
      assert.ok(m.meret >= 14, 'olvashato: ' + m.meret);
      await ctx.close();
    });
  }

  test('asztalon a hero ar / akcio sora valtozatlan: ket kulon sor (az ar, alatta az akcio), a paros oldalon a "50 perces - ... helyett" szoveg megvan', async () => {
    for (const ut of ['/index', '/head-spa-kedvezmeny', '/paros-headspa-budapest']) {
      const { p, ctx } = await nyit(ut, 1440);
      const m = await p.evaluate(() => { const ps = [...document.querySelectorAll('.vh-arsor > p')].map((q) => q.getBoundingClientRect()); return { fenn: ps[0].top, lent: ps[1].top, szoveg: document.querySelector('.vh-arsor').innerText.replace(/\s+/g, ' ') }; });
      assert.ok(m.lent > m.fenn + 10, ut + ': az akcio az ar alatt van');
      if (ut.startsWith('/paros')) assert.match(m.szoveg, /50 perces - 65\.900 Ft helyett 53\.800 Ft/);
      await ctx.close();
    }
  });
});

describe('foldali logosav: kulon szekcio, kattintas a "Noi lapok" reszre', () => {
  test('asztal: nagyobb cim, vilagos sav vonalakkal; telefon: nagyobb cim, a logok lejjebb a cimtol', async () => {
    const a = await nyit('/index', 1440);
    const ad = await a.p.evaluate(() => { const s = document.querySelector('.sajto-logok-sav'); const c = s.querySelector('.sajto-logok-cim'); const l = s.querySelector('.sl-rad'); const cs = getComputedStyle(s); return { cim: parseFloat(getComputedStyle(c).fontSize), vonal: cs.borderTopWidth, bg: cs.backgroundColor, rés: l.getBoundingClientRect().top - c.getBoundingClientRect().bottom, magas: s.getBoundingClientRect().height }; });
    assert.ok(ad.cim >= 22, 'asztali cim: ' + ad.cim);
    assert.equal(ad.vonal, '1px');
    assert.notEqual(ad.bg, 'rgba(0, 0, 0, 0)');
    assert.ok(ad.rés >= 16, 'rés a cim es a logok kozott: ' + ad.rés);
    await a.ctx.close();
    const m = await nyit('/index', 390);
    const md = await m.p.evaluate(() => { const s = document.querySelector('.sajto-logok-sav'); const c = s.querySelector('.sajto-logok-cim'); const l = s.querySelector('.sl-rad'); return { cim: parseFloat(getComputedStyle(c).fontSize), res: l.getBoundingClientRect().top - c.getBoundingClientRect().bottom, magas: s.getBoundingClientRect().height, balra: c.getBoundingClientRect().left, jobbra: innerWidth - c.getBoundingClientRect().right }; });
    assert.ok(md.cim >= 19, 'mobil cim: ' + md.cim);
    assert.ok(md.res >= 14, 'a logok lejjebb vannak a cimtol: ' + md.res);
    assert.ok(md.magas <= 230, 'a sav mobilon sem tul magas: ' + md.magas);
    assert.ok(md.balra >= 8 && md.jobbra >= 8, 'a cim nem log ki');
    await m.ctx.close();
  });

  for (const szeles of [1440, 390]) {
    test(`${szeles}px: mind a 8 logo a /head-spa-velemenyek#sajto oldalra visz, ott a "Noi lapok" szekcio a fejlec alatt van`, async () => {
      const { p, ctx } = await nyit('/index', szeles);
      const db = await p.locator('.sajto-logok-sav .sl-rad a').count();
      assert.equal(db, 8);
      for (let i = 0; i < db; i++) {
        await p.goto(bazis + '/index', { waitUntil: 'load' });
        const a = p.locator('.sajto-logok-sav .sl-rad a').nth(i);
        assert.equal(await a.getAttribute('href'), '/head-spa-velemenyek#sajto');
        await a.scrollIntoViewIfNeeded();
        await Promise.all([p.waitForURL(/\/head-spa-velemenyek#sajto$/), a.click()]);
        await p.waitForLoadState('load');
        await p.waitForTimeout(1600);
        const m = await p.evaluate(() => { const f = document.getElementById('SITE_HEADER'); const fejlec = f && /fixed|sticky/.test(getComputedStyle(f).position) ? f.getBoundingClientRect().height : 0; return { top: document.getElementById('sajto').getBoundingClientRect().top, fejlec }; });
        assert.ok(Math.abs(m.top - m.fejlec) <= 8, `${i + 1}. logo: a Noi lapok a fejlec alatt (${Math.round(m.top)} / ${Math.round(m.fejlec)})`);
      }
      await ctx.close();
    });
  }
});
