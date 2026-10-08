// A Head Spa velemenyek oldal sajto-resze (#sajto): a regi negy kepes doboz + a "Tovabbi cikkek es megjelenesek" szoveges dobozok.
// Bongeszos teszt (Playwright), nincs dist/ es nincs kulso halozat (minden kulso keres tiltott).
//
//   node --test tools/headspa-teszt/sajto.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from './szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
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

async function nyit(szeles = 1440) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], kulso = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${bazis}/head-spa-velemenyek`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, kulso };
}

/** Az osszes sajto-doboz (regi + uj) adata. */
async function dobozok(p) {
  return p.$$eval('#sajto article.sajto-kartya', (l) => l.map((a) => {
    const link = a.querySelector('a.link-gomb');
    const t = a.querySelector('time');
    return {
      uj: !!a.closest('.sajto-racs.tobb'),
      portal: (a.querySelector('.sajto-portal')?.childNodes[0]?.textContent || a.querySelector('img.logo')?.getAttribute('alt') || '').trim(),
      jelzes: (a.querySelector('.sajto-jelzes')?.textContent || '').trim(),
      cim: (a.querySelector('q')?.textContent || '').trim(),
      datum: t ? t.getAttribute('datetime') : null,
      datumSzoveg: t ? t.textContent.trim() : null,
      href: link ? link.getAttribute('href') : null,
      target: link ? link.getAttribute('target') : null,
      rel: link ? link.getAttribute('rel') : null,
      gomb: link ? link.textContent.replace(/\s+/g, ' ').trim() : null,
    };
  }));
}

describe('/head-spa-velemenyek: sajto-resz', () => {
  test('a regi negy kepes doboz valtozatlanul megvan, mellette a tovabbi cikkek kulon, sajat fejleccel; a szekcio fejlece / leadje nem valtozott', async () => {
    const { p, ctx } = await nyit();
    assert.equal((await p.textContent('#sajto-cim')).trim(), 'Női lapok akik írtak rólunk');
    const lead = (await p.textContent('#sajto .szekcio-fej .lead')).replace(/\s+/g, ' ').trim();
    assert.match(lead, /^4 híres és látogatott hazai női portál is járt nálunk\./);
    assert.match(lead, /NEM fizetett cikkekről van szó\.$/);
    const regi = await p.$$eval('#sajto > .tartalom > .sajto-racs:not(.tobb) > article', (l) => l.map((a) => a.querySelector('img.logo').alt));
    assert.deepEqual(regi, ['Femina', 'We Love Budapest', 'Longevity Magazin', 'Fodrászinfo']);
    assert.equal(await p.locator('#sajto-tobb-cim').count(), 1, 'van fejlec a tovabbi cikkeknek');
    assert.equal(await p.locator('#sajto + section#videok').count(), 1, 'a videok szekcio kozvetlenul a sajto utan van');
    await ctx.close();
  });

  test('a tovabbi cikkek: legalabb 6 doboz, mindegyiken portal + cim + datum + "Tovabb a cikkhez" https-link, target=_blank, rel=noopener', async () => {
    const { p, ctx } = await nyit();
    const d = (await dobozok(p)).filter((x) => x.uj);
    assert.ok(d.length >= 6, `legalabb 6 uj doboz (van: ${d.length})`);
    assert.equal(await p.locator('#sajto .sajto-racs.tobb > article').count(), d.length);
    for (const x of d) {
      assert.ok(x.portal.length >= 3, 'portal neve: ' + JSON.stringify(x));
      assert.ok(x.cim.length >= 8, 'cikk cime: ' + JSON.stringify(x));
      assert.match(x.datum || '', /^\d{4}-\d{2}-\d{2}$/, 'datum (time datetime): ' + x.portal);
      assert.ok(x.datumSzoveg && /^\d{4}\. [a-zéáíóöőúüű]+ \d{1,2}\.$/.test(x.datumSzoveg), 'olvashato datum: ' + x.datumSzoveg);
      assert.match(x.href || '', /^https:\/\//, 'https link: ' + x.portal);
      assert.equal(x.target, '_blank', 'target: ' + x.portal);
      assert.match(x.rel || '', /\bnoopener\b/, 'rel: ' + x.portal);
      assert.match(x.gomb || '', /^Tovább a cikkhez/, 'gombfelirat: ' + x.portal);
    }
    await ctx.close();
  });

  test('nincs ketszer ugyanaz a link (a regi + uj dobozok kozott sem), es egyik sem mutat a szalon sajat oldalara, foglalora vagy kozossegi oldalra', async () => {
    const { p, ctx } = await nyit();
    const d = await dobozok(p);
    assert.equal(d.length >= 10, true, 'a regi 4 + az uj dobozok');
    const hrefek = d.map((x) => x.href.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase());
    assert.equal(new Set(hrefek).size, hrefek.length, 'duplikalt link: ' + hrefek.filter((h, i) => hrefek.indexOf(h) !== i));
    const portalok = d.map((x) => new URL(x.href).hostname.replace(/^www\./, ''));
    assert.equal(new Set(portalok).size, portalok.length, 'egy portalrol egy doboz: ' + portalok.filter((h, i) => portalok.indexOf(h) !== i));
    for (const x of d) {
      const host = new URL(x.href).hostname;
      assert.ok(!/(^|\.)(mosaicheadspa\.hu|salonic\.hu|facebook\.com|instagram\.com|tiktok\.com|trustindex\.io|google\.com|bonuszbrigad\.hu|oxygeni)/i.test(host), 'nem sajtocikk-domain: ' + host);
    }
    await ctx.close();
  });

  test('az uj dobozok a legfrissebbtol a legregebbiig vannak rendezve; a portal sajat "Tamogatott tartalom" / "Promocio" jelolese kint van', async () => {
    const { p, ctx } = await nyit();
    const d = (await dobozok(p)).filter((x) => x.uj);
    const datumok = d.map((x) => x.datum);
    assert.deepEqual(datumok, [...datumok].sort().reverse(), 'legfrissebb elol: ' + datumok.join(', '));
    const jelolt = Object.fromEntries(d.filter((x) => x.jelzes).map((x) => [new URL(x.href).hostname.replace(/^www\./, ''), x.jelzes]));
    assert.equal(jelolt['glamour.hu'], 'Támogatott tartalom');
    assert.equal(jelolt['papageno.hu'], 'Promóció');
    assert.match(await p.textContent('.sajto-megjegyzes'), /jelölést az adott portál maga teszi ki/);
    await ctx.close();
  });

  for (const [nev, szeles, oszlop, regiOszlop] of [['telefon', 390, 1, 1], ['tablet', 768, 2, 2], ['asztal', 1440, 4, 2]]) {
    test(`megjelenes ${nev} (${szeles}px): ${oszlop} oszlop az uj dobozoknak, nincs vizszintes gorgetes, nincs kilogo szoveg, az egy sorban levo dobozok egyforma magasak, nincs konzolhiba / kulso keres`, async () => {
      const { p, ctx, hibak, kulso } = await nyit(szeles);
      const meres = await p.evaluate(() => {
        const racs = document.querySelector('#sajto .sajto-racs.tobb');
        const oszl = getComputedStyle(racs).gridTemplateColumns.split(' ').length;
        const regiRacs = document.querySelector('#sajto > .tartalom > .sajto-racs:not(.tobb)');
        const regiOszl = getComputedStyle(regiRacs).gridTemplateColumns.split(' ').length;
        const kartyak = [...racs.querySelectorAll(':scope > article')];
        const sorok = new Map();
        for (const k of kartyak) { const r = k.getBoundingClientRect(); const kulcs = Math.round(r.top); sorok.set(kulcs, [...(sorok.get(kulcs) || []), Math.round(r.height)]); }
        const kilog = [...racs.querySelectorAll('q, .sajto-portal, .sajto-datum, a.link-gomb')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 40));
        return { oszl, regiOszl, sorok: [...sorok.values()], kilog, doc: document.documentElement.scrollWidth, ablak: document.documentElement.clientWidth };
      });
      assert.equal(meres.oszl, oszlop, 'uj dobozok oszlopszama');
      assert.equal(meres.regiOszl, regiOszlop, 'a regi negy doboz oszlopszama valtozatlan');
      // telefonon es asztalon az egesz oldal nem gorgethet vizszintesen; tableten a (nem ehhez a reszhez tartozo) Wixes fejlec szelesebb, ott csak a sajto-resz elemei nem logathatnak ki
      if (szeles !== 768) assert.ok(meres.doc <= meres.ablak, `nincs vizszintes gorgetes (${meres.doc} > ${meres.ablak})`);
      const ki = await p.$$eval('#sajto *', (l) => l.filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((e) => e.className || e.tagName));
      assert.deepEqual(ki, [], 'a sajto-resz elemei nem lognak ki az ablakbol');
      assert.deepEqual(meres.kilog, [], 'kilogo szoveg');
      for (const sor of meres.sorok) assert.ok(Math.max(...sor) - Math.min(...sor) <= 1, 'egy sor dobozai egyforma magasak: ' + sor.join(','));
      // a cikk-linkeket az oldal nem tolti be (nincs elotoltes / beagyazas): egyik cikk-domainre sem indul keres
      const cikkHostok = (await dobozok(p)).map((x) => new URL(x.href).hostname);
      assert.deepEqual(kulso.filter((u) => cikkHostok.includes(new URL(u).hostname)), [], 'a cikkek oldalait nem toltjuk be');
      assert.deepEqual(hibak, []);
      await ctx.close();
    });
  }
});
