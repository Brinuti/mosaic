// A Head Spa velemenyek oldal sajto-resze (#sajto): egyseges, nagykepes cikk-kartyak (a tulajdonos tablazata, "MOSAIC HeadSpa" oszlop, szerint).
// Bongeszos teszt (Playwright), nincs dist/ es nincs kulso halozat (minden kulso keres tiltott).
//
//   node --test tools/headspa-teszt/sajto.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
const ADAT = JSON.parse(fs.readFileSync(path.join(GYOKER, 'tools', 'sajto-kartyak', 'adat.json'), 'utf8')).kartyak;

// A tablazat "MOSAIC HeadSpa" oszlopanak MINDEN hivatkozasa (nyomtatott megjelenes / "keszul" / "javitas alatt" sor nincs benne: azokhoz nincs link).
const TABLAZAT = [
  'https://longevitymagazin.hu/a-headspa-lehet-az-onszeretet-uj-szokasa-interju-deak-ferenc-istvannal-a-mosaic-headspa-and-hair-alapito-tulajdonosaval/',
  'https://femina.hu/szepseg/szepsegujdonsagok-tel-2025/',
  'https://welovebudapest.com/cikk/2025/02/24/mosaic-headspa-masszazs-szepsegszalon-egeszsegmegorzes/',
  'https://www.fodraszinfo.com/mosaic-headspa-and-hair-elmenybeszamolo-es-interju',
  'https://www.frizuraszepseg.hu/az-onszeretet-uj-szokasa-headspa-kenyeztetes/',
  'https://igenyesno.hu/noiseg-noiesseg/szepseg/enido-maskent-avagy-kenyeztesd-a-fejedet',
  'https://www.tiktok.com/@life.hu_official/video/7486442575151238423',
  'https://marieclaire.hu/szepseg/2025/06/08/mosaic-headspa-haj-masszazs/',
  'https://www.kiskegyed.hu/video/fejbor-haj-kezeles-viszketes-megszunik-head-spa/zf6wfjm',
  'https://zoldsalata.hu/2025/06/head-spa-a-relaxacio-amire-mindenkinek-szuksege-lenne/',
  'https://www.evamagazin.hu/egeszsegem/faj-a-hajad-vagy-tul-gyorsan-zsirosodik-fejbor',
  'https://marieclaire.hu/szepseg/2026/04/27/premium-szepseg-kezelesek-headspa-retinol/',
  'https://www.evamagazin.hu/szepsegem/kiprobaltuk-a-fovaros-ket-legujabb-beauty-ritualejat',
  'https://www.evamagazin.hu/parkapcsolatom/romantikus-paros-programok-oszre-2026',
];

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

/** Az osszes sajto-kartya adata. */
async function kartyak(p) {
  return p.$$eval('#sajto article.sajto-kartya', (l) => l.map((a) => {
    const link = a.querySelector('a.link-gomb');
    const kepLink = a.querySelector('a.sajto-kep');
    const t = a.querySelector('time');
    const img = a.querySelector('a.sajto-kep img');
    return {
      szerkezet: [...a.children].map((c) => c.className).join('|') + '/' + [...(a.querySelector('.sajto-test')?.children || [])].map((c) => c.tagName + '.' + c.className).join(','),
      portal: (a.querySelector('.sajto-portal')?.childNodes[0]?.textContent || '').trim(),
      cim: (a.querySelector('.sajto-cim')?.textContent || '').trim(),
      idezet: (a.querySelector('q')?.textContent || '').trim(),
      datum: t ? t.getAttribute('datetime') : null,
      datumSzoveg: t ? t.textContent.trim() : null,
      href: link ? link.getAttribute('href') : null,
      kepHref: kepLink ? kepLink.getAttribute('href') : null,
      target: link ? link.getAttribute('target') : null,
      rel: link ? link.getAttribute('rel') : null,
      gomb: link ? link.textContent.replace(/\s+/g, ' ').trim() : null,
      kep: img ? { src: img.getAttribute('src'), betoltve: img.complete && img.naturalWidth > 0, arany: Math.round((img.getBoundingClientRect().width / img.getBoundingClientRect().height) * 100) / 100 } : null,
      jatszik: !!a.querySelector('.video-play'),
      jelzes: !!a.querySelector('.sajto-jelzes'),
    };
  }));
}

describe('/head-spa-velemenyek: sajto-resz', () => {
  test('a fejlec megvan, a "NEM fizetett" allitas es minden reklam-jeloles kint van, a szekcio utan rogton a videok kovetkeznek', async () => {
    const { p, ctx } = await nyit();
    assert.equal((await p.textContent('#sajto-cim')).trim(), 'Női lapok akik írtak rólunk');
    const szoveg = (await p.textContent('#sajto')).replace(/\s+/g, ' ');
    assert.ok(!/NEM fizetett|Támogatott tartalom|Promóció|Szponzorált|jelölést az adott portál/i.test(szoveg), 'nincs fizetett / reklam-jeloles');
    assert.equal(await p.locator('#sajto .sajto-jelzes').count(), 0);
    assert.equal(await p.locator('#sajto + section#videok').count(), 1, 'a videok szekcio kozvetlenul a sajto utan van');
    await ctx.close();
  });

  test('pontosan a tablazat "MOSAIC HeadSpa" oszlopanak hivatkozasai vannak ott (14 db), egyik sem ketszer; a tablazatban nem szereplo cikkek kint vannak', async () => {
    const { p, ctx } = await nyit();
    const d = await kartyak(p);
    const hrefek = d.map((x) => x.href);
    assert.equal(d.length, TABLAZAT.length);
    assert.deepEqual([...hrefek].sort(), [...TABLAZAT].sort());
    assert.equal(new Set(hrefek).size, hrefek.length, 'duplikalt link');
    for (const x of d) assert.equal(x.kepHref, x.href, 'a kep ugyanarra a cikkre mutat: ' + x.portal);
    const osszes = (await p.content()).toLowerCase();
    for (const kint of ['technokrata', 'gyulaihirlap', 'szmsz.press', 'papageno', 'elle.hu', 'glamour.hu']) assert.ok(!osszes.includes(kint), 'kikerulo cikk maradt: ' + kint);
    await ctx.close();
  });

  test('minden kartya ugyanolyan: kep, portal + datum, cim, szo szerinti idezet, "Tovabb a cikkhez" (a ket videon "Tovabb a videohoz" + lejatszas-jel)', async () => {
    const { p, ctx } = await nyit();
    const d = await kartyak(p);
    assert.equal(new Set(d.map((x) => x.szerkezet)).size, 1, 'azonos szerkezet: ' + [...new Set(d.map((x) => x.szerkezet))].join(' || '));
    for (const x of d) {
      assert.ok(x.portal.length >= 3, 'portal: ' + JSON.stringify(x));
      assert.ok(x.cim.length >= 8, 'cim: ' + x.portal);
      assert.ok(x.idezet.length >= 30, 'idezet: ' + x.portal);
      assert.match(x.datum || '', /^\d{4}-\d{2}-\d{2}$/, 'datum: ' + x.portal);
      assert.match(x.datumSzoveg || '', /^\d{4}\. [a-zéáíóöőúüű]+ \d{1,2}\.$/, 'olvashato datum: ' + x.datumSzoveg);
      assert.match(x.href || '', /^https:\/\//, 'https link: ' + x.portal);
      assert.equal(x.target, '_blank'); assert.match(x.rel || '', /\bnoopener\b/);
      assert.ok(x.kep && x.kep.betoltve, 'a kep betoltodik: ' + x.portal);
      assert.ok(x.kep.src.startsWith('/assets/img/sajto/') && fs.existsSync(path.join(GYOKER, x.kep.src)), 'sajat tarhelyen levo kep: ' + x.kep.src);
      assert.ok(Math.abs(x.kep.arany - 1.5) < 0.02, 'a kep 3:2 (' + x.portal + '): ' + x.kep.arany);
      assert.ok(!x.jelzes);
      const video = /tiktok\.com|kiskegyed\.hu\/video/.test(x.href);
      assert.equal(x.jatszik, video, 'lejatszas-jel csak a videokon: ' + x.portal);
      assert.match(x.gomb || '', video ? /^Tovább a videóhoz/ : /^Tovább a cikkhez/, 'gombfelirat: ' + x.portal);
    }
    assert.equal(d.filter((x) => x.jatszik).length, 2, 'a ket video (TikTok Life.hu, Kiskegyed)');
    await ctx.close();
  });

  test('az adat (tools/sajto-kartyak/adat.json) es az oldal egyezik: cim, szo szerinti idezet, datum, link; legfrissebb elol', async () => {
    const { p, ctx } = await nyit();
    const d = await kartyak(p);
    assert.equal(d.length, ADAT.length);
    ADAT.forEach((a, i) => {
      assert.equal(d[i].href, a.url); assert.equal(d[i].cim, a.cim); assert.equal(d[i].idezet, a.idezet); assert.equal(d[i].datum, a.datum); assert.equal(d[i].portal, a.portal);
    });
    const datumok = d.map((x) => x.datum);
    assert.deepEqual(datumok, [...datumok].sort().reverse(), 'legfrissebb elol: ' + datumok.join(', '));
    await ctx.close();
  });

  for (const [nev, szeles, oszlop] of [['telefon', 390, 1], ['tablet', 768, 2], ['asztal', 1440, 3]]) {
    test(`megjelenes ${nev} (${szeles}px): ${oszlop} oszlop, nincs vizszintes gorgetes, nincs kilogo szoveg, az egy sorban levo kartyak egyforma magasak, nincs konzolhiba / cikk-oldal betoltes`, async () => {
      const { p, ctx, hibak, kulso } = await nyit(szeles);
      const meres = await p.evaluate(() => {
        const racs = document.querySelector('#sajto .sajto-racs');
        const oszl = getComputedStyle(racs).gridTemplateColumns.split(' ').length;
        const kartyak = [...racs.querySelectorAll(':scope > article')];
        const sorok = new Map();
        for (const k of kartyak) { const r = k.getBoundingClientRect(); const kulcs = Math.round(r.top + scrollY); sorok.set(kulcs, [...(sorok.get(kulcs) || []), Math.round(r.height)]); }
        const kilog = [...racs.querySelectorAll('h3, q, .sajto-portal, a.link-gomb')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 40));
        return { oszl, sorok: [...sorok.values()], kilog, doc: document.documentElement.scrollWidth, ablak: document.documentElement.clientWidth };
      });
      assert.equal(meres.oszl, oszlop, 'oszlopszam');
      // tableten a (nem ehhez a reszhez tartozo) Wixes fejlec szelesebb, ott csak a sajto-resz elemei nem logathatnak ki
      if (szeles !== 768) assert.ok(meres.doc <= meres.ablak, `nincs vizszintes gorgetes (${meres.doc} > ${meres.ablak})`);
      const ki = await p.$$eval('#sajto *', (l) => l.filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map((e) => e.className || e.tagName));
      assert.deepEqual(ki, [], 'a sajto-resz elemei nem lognak ki az ablakbol');
      assert.deepEqual(meres.kilog, [], 'kilogo szoveg');
      for (const sor of meres.sorok) assert.ok(Math.max(...sor) - Math.min(...sor) <= 1, 'egy sor kartyai egyforma magasak: ' + sor.join(','));
      const cikkHostok = (await kartyak(p)).map((x) => new URL(x.href).hostname);
      assert.deepEqual(kulso.filter((u) => cikkHostok.includes(new URL(u).hostname)), [], 'a cikkek oldalait nem toltjuk be (nincs elotoltes / beagyazas)');
      assert.deepEqual(hibak, []);
      await ctx.close();
    });
  }
});

describe('/head-spa-velemenyek: "Milyen lesz a hajad a kezelés után?" galéria', () => {
  test('2026-10-09: az eredeti Wixes galéria MINDEN (egyedi) képe benne van (21 db a 22-ből: az egyik azonos fájl kétszer volt), mind betöltődik, a lapozó gombok görgetik a sávot', async () => {
    const { p, ctx, hibak } = await nyit();
    const eredeti = JSON.parse(/window\.MH_GALERIAK\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(fs.readFileSync(path.join(GYOKER, 'assets/js/galeriak.js'), 'utf8'))[1])['comp-m7qaedn3'].map((x) => x[0]);
    assert.equal(eredeti.length, 22);
    const hash = (f) => crypto.createHash('md5').update(fs.readFileSync(path.join(GYOKER, 'assets/img', f))).digest('hex');
    const latott = new Set();
    const egyedi = eredeti.filter((f) => { const h = hash(f); if (latott.has(h)) return false; latott.add(h); return true; });   // az azonos fajl elso elofordulasa marad
    assert.equal(egyedi.length, 21);
    const kepek = await p.$$eval('#hajad .korhinta-sav figure img', (l) => l.map((i) => i.getAttribute('src').split('/').pop()));
    assert.equal(kepek.length, 21, 'a galeria 21 kepe');
    assert.deepEqual([...kepek].sort(), [...egyedi].sort(), 'pontosan az eredeti galeria kepei');
    const sav = p.locator('#hajad .korhinta-sav');
    await sav.scrollIntoViewIfNeeded();
    // gorgetes vegigtekerve: mindegyik kep betoltodik
    await p.evaluate(async () => { const s = document.querySelector('#hajad .korhinta-sav'); for (let x = 0; x <= s.scrollWidth; x += 300) { s.scrollLeft = x; await new Promise((r) => setTimeout(r, 40)); } s.scrollLeft = 0; });
    await p.waitForFunction(() => [...document.querySelectorAll('#hajad .korhinta-sav img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    assert.equal(await p.locator('#hajad .korhinta-gomb.elozo').isDisabled(), true);
    await p.locator('#hajad .korhinta-gomb.kovetkezo').click();
    await p.waitForFunction(() => document.querySelector('#hajad .korhinta-sav').scrollLeft > 100);
    assert.equal(await p.locator('#hajad .korhinta-gomb.elozo').isDisabled(), false);
    assert.deepEqual(hibak, []);
    await ctx.close();
  });
});
