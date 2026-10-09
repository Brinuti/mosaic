// Az "Oktoberi akcio" (pink) felso sav CSAK a Head Spa oldalakon latszik (a tulajdonos kerese, 2026-10-09): minden mas oldalon rejtett, es a fejlec nem hagy ures helyet.
// Bongeszos teszt (Playwright), helyi szerver, nincs kulso halozat. A "Head Spa oldalak" listaja: tools/fejlec-menu.mjs HEADSPA_OLDALAK.
//
//   node --test tools/headspa-teszt/akciossav.test.mjs
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { szerverInditas, GYOKER } from './szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();
const { headspaOldal, HEADSPA_OLDALAK } = await import(pathToFileURL(path.join(GYOKER, 'tools/fejlec-menu.mjs')).href);

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

// a fejleces sajat oldalak (a fejlec-darabot a <!--mh-fejlec--> jelolo hozza)
const OLDALAK = fs.readdirSync(path.join(GYOKER, 'foglalas')).filter((f) => f.endsWith('.html'))
  .filter((f) => fs.readFileSync(path.join(GYOKER, 'foglalas', f), 'utf8').includes('<!--mh-fejlec-->')).map((f) => f.replace(/\.html$/, ''));
// ezek a Head Spa oldalak a sajat CSS-ukkel is rejtik (vagy nem a fejleccel indulnak): a kedvezmeny oldal a sajat felsovel indul
const SAJAT_REJTETT = new Set(['head-spa-kedvezmeny']);

async function mer(nev, szeles) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(`${bazis}/${nev}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(250);
  const m = await p.evaluate(() => {
    const s = document.getElementById('comp-mpv0ganp');
    const f = document.getElementById('SITE_HEADER');
    return { van: !!s, lat: !!s && getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().height > 10, jelolo: document.documentElement.hasAttribute('data-mh-headspa'), fejlecAlja: f ? Math.round(f.getBoundingClientRect().bottom) : null,
      tartalomTeteje: Math.round(((document.querySelector('main') || document.body.firstElementChild).getBoundingClientRect().top)), szoveg: s ? s.textContent.replace(/\s+/g, ' ').trim().slice(0, 40) : '' };
  });
  await ctx.close();
  return m;
}

describe('az "Oktoberi akcio" sav csak a Head Spa oldalakon', () => {
  test('a lista: a Head Spa oldalak jeloltek (data-mh-headspa), a tobbi nem; a -regi masolatok az eredetit koveti', () => {
    for (const n of ['index', 'headspa-budapest', 'headspa-arak-budapest', 'headspa-termekek-oxygeni', 'headspa-ferfiaknak', 'head-spa-velemenyek', 'paros-headspa-budapest', 'headspa-budapest-hungary']) assert.equal(headspaOldal(n), true, n);
    for (const n of ['kapcsolat', 'gyik', 'arlista', 'ajandek', 'headspa-ajandekkartya', 'headspa-self-care', 'ajandekkartya-szulinapra', 'lezeres-szortelenites-budapest', 'noi-fodraszat-budapest', 'oxigenterapia-budapest', 'sminktetovalas-budapest', 'foglalo-motor', 'aszf', 'szortelenites-5-dolog', 'headspa-ajandakkartya-fiataloknak', 'head-spa-kedvezmeny']) assert.equal(headspaOldal(n), false, n);
    assert.equal(headspaOldal('headspa-ferfiaknak-regi'), true);
    assert.equal(headspaOldal('headspa-self-care-regi'), false);
    assert.ok(HEADSPA_OLDALAK.size >= 8);
  });

  for (const szeles of [1440, 390]) {
    test(`${szeles}px: a sav pontosan a Head Spa oldalakon latszik (${OLDALAK.length} sajat oldal), a tobbin nincs, es a fejlec utan azonnal a tartalom kovetkezik`, async () => {
      const latszik = [], rejtett = [], hibak = [];
      for (const nev of OLDALAK) {
        const m = await mer(nev, szeles);
        const vart = headspaOldal(nev) && !SAJAT_REJTETT.has(nev);
        if (headspaOldal(nev) !== m.jelolo) hibak.push(`${nev}: jelolo ${m.jelolo}`);
        if (m.lat !== vart) hibak.push(`${nev}: sav ${m.lat ? 'LATSZIK' : 'rejtett'} (varhato: ${vart ? 'latszik' : 'rejtett'})`);
        (m.lat ? latszik : rejtett).push(nev);
      }
      assert.deepEqual(hibak, [], 'hibas oldalak');
      assert.ok(latszik.length >= 7, 'a Head Spa oldalakon latszik: ' + latszik.join(', '));
    });
  }

  test('a Head Spa oldalon a pink sav az eredeti szinekkel latszik (asztalon es telefonon), a "Kapcsolat" oldalon nincs, a fejlec ott alacsonyabb', async () => {
    for (const szeles of [1440, 390]) {
      const hs = await mer('head-spa-velemenyek', szeles);
      const ko = await mer('kapcsolat', szeles);
      assert.equal(hs.lat, true);
      assert.match(hs.szoveg, /któberi akció/);
      assert.equal(ko.lat, false);
      assert.ok(ko.fejlecAlja < hs.fejlecAlja - 10, `${szeles}px: a Kapcsolat fejlece alacsonyabb (${ko.fejlecAlja} < ${hs.fejlecAlja})`);
    }
  });
});
