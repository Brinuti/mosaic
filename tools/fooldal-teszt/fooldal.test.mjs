// Az új főoldal (/) böngészős tesztjei (Playwright). Nincs dist/ és nincs külső hálózat: a könnyű helyi szerver
// (tools/headspa-teszt/szerver.mjs) állítja össze az oldalt a build logikájával (fejléc / lábléc / közös CSS), minden külső kérés tiltott.
//
//   node --test tools/fooldal-teszt/fooldal.test.mjs
//
// Környezeti változók: CHROME_UTVONAL (alapból a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappája).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic', 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* következő */ } }
  throw new Error('playwright-core nem található (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();
const OLDAL = '';

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

/** Új oldal: külső forgalom tiltva (naplózva), hibák gyűjtve; a lusta képek betöltéséhez végiggörgeti az oldalt. */
async function nyit({ szeles = 1440 } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], kulso = [], nincs = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis) && !/\/assets\/video\//.test(r.url())) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${bazis}/${OLDAL}`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, kulso, nincs };
}
const gitben = (rel) => { try { return execFileSync('git', ['ls-files', '--', rel], { cwd: GYOKER, encoding: 'utf8' }).trim() !== ''; } catch { return false; } };
const fajlVan = (rel) => fs.existsSync(path.join(GYOKER, rel)) || gitben(rel);
const belsoOldalVan = (href) => {
  const ut = href.split(/[?#]/)[0].replace(/^\//, '').replace(/\/$/, '');
  if (!ut) return true;
  return ['klon', 'foglalas'].some((m) => fs.existsSync(path.join(GYOKER, m, ut + '.html'))) || ['foglalo-motor'].includes(ut);
};

describe('/ (főoldal)', () => {
  test('betöltődik hibák nélkül: nincs konzol-hiba, 404, törött kép; egyetlen H1; cím, indexelhető, canonical', async () => {
    const { p, ctx, hibak, nincs } = await nyit();
    assert.equal(await p.title(), 'Japán Head Spa Budapesten – 50 perc kezelés + 30 perc hajszárítás | MOSAIC');
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.match((await p.textContent('h1')).replace(/\s+/g, ' ').trim(), /^Budapest kedvenc Head Spa-ja 50 perc kezelés \+ 30 perc profi hajszárítás$/);
    assert.equal(await p.locator('meta[name=robots]').count(), 0, 'indexelhető (nincs robots meta)');
    assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://www.mosaicheadspa.hu/');
    const torott = await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
    assert.deepEqual(torott, [], 'törött képek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden képnek van alt attribútuma');
    assert.deepEqual(nincs, [], '404-es helyi kéréseik');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('a közös szerkezet: MOSAIC-fejléc és lábléc, Playfair címek, Jost szöveg, a "Head Spa" menüpont kijelölve', async () => {
    const { p, ctx } = await nyit();
    assert.ok((await p.textContent('body')).includes('Big in Japan Kft.'), 'lábléc');
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.match(await p.evaluate(() => getComputedStyle(document.body).fontFamily), /Jost/);
    assert.equal(await p.locator('main [id^="comp-"], main wow-image, main [data-mesh-id]').count(), 0, 'nincs Wix-maradvány');
    assert.equal(await p.evaluate(() => { const a = document.querySelector('a[data-item-label][href="/"]'); const w = a && a.closest('[data-is-current]'); return w && w.getAttribute('data-is-current'); }), 'true', 'a Head Spa főmenüpont kijelölve');
    await ctx.close();
  });

  test('a szekciók sorrendje a látványterv szerint: hero, bizalmi sáv, szolgáltatások, élmények, ajándékkártya – utána a mostani főoldal tartalma', async () => {
    const { p, ctx } = await nyit();
    const idk = await p.$$eval('main > section', (l) => l.map((s) => s.id));
    assert.deepEqual(idk.slice(0, 5), ['hero', '', 'szolgaltatasok', 'elmenyek', 'ajandek']);
    for (const id of ['vendegek', 'velemenyek', 'mit-kapsz', 'elemek', 'fejbor', 'oxygeni', 'kezek', 'szalon', 'gyik', 'helyszin']) assert.ok(idk.includes(id), 'hiányzik a szekció: ' + id);
    assert.ok(!idk.includes('paros'), 'a főoldali páros blokk kikerült (2026-10-09, a tulajdonos kérésére)');
    // egy H2 szekciónként; a látványterv címei szó szerint
    const h2 = await p.$$eval('main h2', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim()));
    for (const c of ['Mire van szükséged?', 'Melyik HeadSpa élmény illik hozzád?', 'Inkább élményt ajándékoznál?', 'Ők már kipróbálták.', 'Gyakori Head Spa kérdések', 'Itt találsz meg minket']) assert.ok(h2.includes(c), 'hiányzik a cím: ' + c);
    await ctx.close();
  });

  test('hero (közös videós hero): hang nélküli háttér-klip + nyitókép, play gomb (nagy ablakban nyitja a hangos videót), ár, kedvezmény, ikonos jelvények, két CTA, Google-sor; nincs Kolosy-felirat, beváltás-link, "Hangot rá!" kapcsoló', async () => {
    const { p, ctx } = await nyit();
    const hero = (await p.evaluate(() => document.querySelector('#hero').innerText)).replace(/\s+/g, ' ');
    assert.equal(await p.locator('#hero.vh-hero').count(), 1);
    const v = p.locator('#hero video.vh-video');
    assert.equal(await v.getAttribute('data-klip'), '/assets/video/c2eb0f_909ce4959fe24f4f984d8953fd315d67.mp4');
    for (const a of ['muted', 'loop', 'playsinline']) assert.notEqual(await v.getAttribute(a), null, a);
    assert.equal(await v.getAttribute('autoplay'), null, 'nem magától indul (a közös JS indítja, ha a mozgás engedélyezett)');
    assert.equal(await p.locator('#hero .hero-hang, #hero #hero-video').count(), 0, 'a régi "Hangot rá!" kapcsoló helyett a play gomb nyitja a hangos videót');
    assert.equal(await p.getAttribute('#hero button.vh-lejatszas', 'data-nagyvideo'), '/assets/video/c2eb0f_909ce4959fe24f4f984d8953fd315d67.mp4');
    assert.ok(fajlVan('assets/video/c2eb0f_909ce4959fe24f4f984d8953fd315d67.mp4') && fajlVan('assets/img/c2eb0f_909ce4959fe24f4f984d8953fd315d67f001.jpg'));
    for (const s of ['Most 20% kedvezménnyel', '32 900 Ft', '26 900 Ft-tól', 'Szabad időpontok', 'Ajándékkártyát veszek', '50+30 perc', 'Profi hajszárítás', 'Személyre szabott', '4,9 / 5 Google', 'vendégvélemény']) assert.ok(hero.includes(s), 'hiányzik: ' + s);
    for (const s of ['Kolosy', 'Beváltom', '50 perc HeadSpa + 30 perc hajszárítás', 'Hangot rá']) assert.ok(!hero.includes(s), 'nem kell: ' + s);
    assert.equal(await p.locator('#hero .vh-akcio svg, #hero .vh-akcio img').count(), 0, 'a 20%-os sorban nincs csillag / ikon');
    assert.equal(await p.locator('#hero .vh-jelvenyek li').count(), 3, 'három ikonos jelvény');
    const bizalom = (await p.evaluate(() => document.querySelector('.bizalom-lista').innerText)).replace(/\s+/g, ' ');
    assert.ok(bizalom.includes('270 négyzetméteren várunk rád') && !bizalom.includes('perc teljes élmény'), 'a bizalmi sáv: 270 négyzetméteren várunk rád');
    assert.equal(await p.getAttribute('#hero a[data-cta="hero-idopontok"]', 'href'), '/foglalo-motor?business=headspa');
    assert.equal(await p.getAttribute('#hero a[data-cta="hero-ajandekkartya"]', 'href'), '/headspa-ajandekkartya');
    assert.equal(await p.getAttribute('#hero a.vh-google', 'href'), '#velemenyek');
    assert.equal(await p.locator('#velemenyek').count(), 1, 'a Google-sor célja létezik');
    // az "Írtak rólunk" sáv helye: a hero és a bizalmi sáv között semmi nincs (a tulajdonos illeszti be)
    assert.equal(await p.$$eval('main > *', (l) => l[1].className), 'bizalom', 'a hero után közvetlenül a bizalmi sáv jön (a logó-sáv helye)');
    await ctx.close();
  });

  test('a hero stílusa a közös video-hero.css-ből jön: asztalon a nyitókép / videó a hero háttere (teljes magasság, jobbra tolva, balról sötétzöldbe olvadva); a fooldal.css-ben nincs hero-szabály; a play gomb 62 px (asztal) / 52 px (telefon)', async () => {
    const css = fs.readFileSync(path.join(GYOKER, 'assets/css/fooldal.css'), 'utf8');
    assert.ok(!/(^|[\s,}])\.hero(?![\w-])|\.hero-(hatter|tart|szoveg|hang|ar|jelveny)\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'a fooldal.css-ben nincs hero-szabály (a közös video-hero.css-é)');
    const { p, ctx } = await nyit();
    const d = await p.evaluate(() => { const h = document.querySelector('#hero').getBoundingClientRect(), k = document.querySelector('.vh-hatter').getBoundingClientRect(); return { hh: Math.round(h.height), kh: Math.round(k.height), hw: Math.round(h.width), kw: Math.round(k.width), jobb: Math.round(k.right - h.right), play: Math.round(document.querySelector('.vh-play').getBoundingClientRect().width), h1: getComputedStyle(document.querySelector('#hero h1')).fontFamily }; });
    assert.equal(d.kh, d.hh, 'a hatter a teljes hero magassaga');
    // a kis felbontasu negyzetes forras miatt .vh-eltolt: a kep a hero jobb ~72%-an, a bal szele puhan sotetzoldbe olvad (a szoveg alatt tiszta zold)
    assert.equal(await p.locator('#hero.vh-eltolt').count(), 1);
    assert.ok(Math.abs(d.jobb) <= 1, 'jobbra illesztve: ' + d.jobb);
    assert.ok(d.kw >= d.hw * 0.7 && d.kw <= d.hw * 0.75, 'a hatter a hero ~72%-a: ' + d.kw + ' / ' + d.hw);
    assert.equal(d.play, 62);
    assert.match(d.h1, /Playfair Display/);
    await ctx.close();
  });

  test('szolgáltatás-kártyák: az 5 szolgáltatás a saját oldalára mutat, és minden cél létezik', async () => {
    const { p, ctx } = await nyit();
    const kartyak = await p.$$eval('.szol-kartya', (l) => l.map((a) => ({ href: a.getAttribute('href'), h3: a.querySelector('h3').textContent.trim() })));
    assert.deepEqual(kartyak, [
      { href: '/headspa-arak-budapest', h3: 'Head Spa' }, { href: '/noi-fodraszat-budapest', h3: 'Fodrászat' }, { href: '/oxigenterapia-budapest', h3: 'Oxigénterápia' },
      { href: '/lezeres-szortelenites-budapest', h3: 'Lézeres szőrtelenítés' }, { href: '/sminktetovalas-budapest', h3: 'Sminktetoválás' }]);
    for (const k of kartyak) assert.ok(belsoOldalVan(k.href), 'nem létező oldal: ' + k.href);
    await ctx.close();
  });

  test('élmény-kártyák: egyéni / páros / 4 kezes, árak az árlistáról, időpont-gombok a foglaló-motorra a megfelelő szolgáltatással', async () => {
    const { p, ctx } = await nyit();
    const k = await p.$$eval('.elm-kartya', (l) => l.map((a) => ({ h3: a.querySelector('h3').textContent.trim(), ar: a.querySelector('.elm-ar').textContent.replace(/\s+/g, ' ').trim(), gomb: a.querySelector('a.gomb').getAttribute('href') })));
    assert.deepEqual(k.map((x) => x.h3), ['Egyéni HeadSpa', 'Páros HeadSpa', '4 kezes HeadSpa']);
    assert.match(k[0].ar, /32 900 Ft 26 900 Ft/);
    assert.match(k[1].ar, /65 900 Ft 53 800 Ft \/ 2 fő/);
    assert.match(k[2].ar, /49 900 Ft 39 900 Ft/);
    assert.deepEqual(k.map((x) => x.gomb), ['/foglalo-motor?business=headspa&service=egyeni', '/foglalo-motor?business=headspa&service=paros', '/foglalo-motor?business=headspa&service=4kezes']);
    await ctx.close();
  });

  test('linkek: minden belső link létező oldalra mutat, a foglalás a közös foglaló-motorra, nincs közvetlen Salonic-link', async () => {
    const { p, ctx } = await nyit();
    const linkek = await p.$$eval('main a[href], .sticky-cta a[href]', (l) => l.map((a) => a.getAttribute('href')));
    assert.ok(linkek.length >= 25, "sok link: " + linkek.length);
    for (const h of linkek) {
      if (h.startsWith('/')) assert.ok(belsoOldalVan(h), 'nem létező belső oldal: ' + h);
      else assert.match(h, /^(https:\/\/|tel:|mailto:|#)/, 'ismeretlen link: ' + h);
    }
    assert.equal(linkek.filter((h) => /salonic/i.test(h)).length, 0, 'nincs közvetlen Salonic-link');
    assert.ok(linkek.filter((h) => h.startsWith('/foglalo-motor')).every((h) => /^\/foglalo-motor\?business=headspa(&|$)/.test(h)), 'minden foglaló-link a Head Spa üzletágra');
    await ctx.close();
  });

  test('videók: minden videó-kártya fájlja és posztere létezik; kattintásra felugró lejátszó nyílik, bezárás után a videó leáll', async () => {
    const { p, ctx } = await nyit();
    const kartyak = await p.$$eval('[data-video]', (l) => l.map((b) => ({ v: b.dataset.video, poszter: b.dataset.poster, kep: b.querySelector('img').getAttribute('src') })));
    assert.ok(kartyak.length >= 30, 'sok videó: ' + kartyak.length);
    assert.equal(new Set(kartyak.map((k) => k.v)).size, kartyak.length, 'nincs ismétlődő videó');
    for (const k of kartyak) {
      assert.ok(fajlVan(k.v.replace(/^\//, '')), 'hiányzó videó: ' + k.v);
      assert.ok(fajlVan(k.poszter.replace(/^\//, '')), 'hiányzó poszter: ' + k.poszter);
      assert.equal(k.poszter, k.kep, 'a kártya képe a poszter');
    }
    assert.equal(await p.locator('video:not(.vh-video)').count(), 0, 'a videók csak kattintásra töltődnek (a hero hátterén kívül nincs <video> az oldalon)');
    await p.locator('.japan-video [data-video]').click();
    const modal = p.locator('dialog.video-modal[open]');
    assert.equal(await modal.count(), 1);
    assert.equal(await modal.locator('video').getAttribute('src'), '/assets/video/fooldal-japan.mp4');
    await modal.locator('.video-modal-bezar').click();
    assert.equal(await p.locator('dialog.video-modal[open]').count(), 0);
    assert.equal(await p.locator('video:not(.vh-video)').count(), 0, 'bezárás után a videó eltávolítva');
    // fekvő kártya: szélesebb ablak
    await p.locator('#elemek [data-fekvo]').first().click();
    assert.equal(await p.locator('dialog.video-modal.fekvo[open]').count(), 1);
    await ctx.close();
  });

  test('körhinta: a következő gomb elgörget, az előző csak ezután aktív', async () => {
    const { p, ctx } = await nyit();
    const k = p.locator('#vendegek [data-korhinta]');
    await k.scrollIntoViewIfNeeded();
    assert.equal(await k.locator('.korhinta-gomb.elozo').isDisabled(), true);
    await k.locator('.korhinta-gomb.kovetkezo').click();
    await p.waitForFunction(() => document.querySelector('#vendegek .korhinta-sav').scrollLeft > 100);
    assert.equal(await k.locator('.korhinta-gomb.elozo').isDisabled(), false);
    await ctx.close();
  });

  test('hatások-fülek: a fül kattintásra váltja a tartalmat (zsíros / száraz / hajhullás), billentyűzettel is', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('.hatas-panel:not([hidden])').count(), 1);
    await p.getByRole('tab', { name: 'Száraz fejbőr esetén' }).click();
    assert.match(await p.locator('.hatas-panel:not([hidden])').textContent(), /Intenzíven hidratálja/);
    await p.getByRole('tab', { name: 'Száraz fejbőr esetén' }).press('ArrowRight');
    assert.match(await p.locator('.hatas-panel:not([hidden])').textContent(), /Serkenti a fejbőr vérkeringését/);
    assert.equal(await p.getByRole('tab', { name: 'Hajhullás esetén' }).getAttribute('aria-selected'), 'true');
    await ctx.close();
  });

  test('GYIK: a mostani főoldal mind a 18 kérdése megvan, a válaszok kinyílnak', async () => {
    const { p, ctx } = await nyit();
    const q = await p.$$eval('#gyik summary', (l) => l.map((s) => s.textContent.trim()));
    assert.equal(q.length, 18);
    const faq = JSON.parse(fs.readFileSync(path.join(GYOKER, 'tools/content/faq.json'), 'utf8'));
    assert.deepEqual(q, [...faq.fooldal, ...faq.masodik].map((x) => x.q));
    await p.locator('#gyik summary').first().click();
    assert.equal(await p.locator('#gyik details[open]').count(), 1);
    await ctx.close();
  });

  test('vélemények: a Trustindex-keret azonnal betöltődik (nincs hozzájárulás-kapu); a Google térkép a gombra / hozzájárulásra vár', async () => {
    const { p, ctx, kulso } = await nyit();
    assert.equal(await p.locator('#trustindex iframe.ti-keret').count(), 1, 'a vélemények azonnal megjelennek');
    assert.equal(await p.locator('#terkep iframe').count(), 0, 'a térkép nem töltődött be hozzájárulás nélkül');
    assert.equal(kulso.filter((u) => /google\.com\/maps/.test(u)).length, 0, 'nincs térkép-kérés hozzájárulás előtt');
    await p.locator('#terkep-gomb').click();
    assert.equal(await p.locator('#terkep iframe').count(), 1, 'a gombra betöltődik');
    await ctx.close();
  });

  test('mérés: a CTA-k dataLayer-eseményt küldenek (fooldal_cta) – a GTM-ben nincs hozzá trigger, csak előkészítés', async () => {
    const { p, ctx } = await nyit();
    await p.evaluate(() => { window.dataLayer = []; document.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); }, true); });
    await p.locator('#hero a[data-cta="hero-idopontok"]').click();
    const dl = await p.evaluate(() => window.dataLayer.filter((x) => x.event === 'fooldal_cta'));
    assert.deepEqual(dl, [{ event: 'fooldal_cta', cta: 'hero-idopontok' }]);
    await ctx.close();
  });

  for (const [nev, szeles] of [['telefon', 390], ['tablet', 820], ['kisebb laptop', 1100], ['asztal', 1440]]) {
    test(`${nev} (${szeles}px): nincs vízszintes görgetés, a hero szövege és képe nem lóg át, a fő szekciók látszanak`, async () => {
      const { p, ctx } = await nyit({ szeles });
      // a közös Wix-fejléc keskeny kijelzőn szélesebb lehet (ismert, nem az oldal hibája): csak a main tartalmát mérjük; a körhinták belső görgetősávja szándékosan szélesebb
      const tul = await p.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => !e.closest('.korhinta-sav') && !e.closest('.szol-racs, .elm-racs, .szalon-galeria') && !e.closest('.vh-hero') && e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.className || e.tagName).slice(0, 5));
      assert.deepEqual(tul, [], 'a main tartalma kilóg a képernyőből');
      const h1 = await p.evaluate(() => { const r = document.querySelector('#hero h1').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
      assert.ok(h1.l >= 0 && h1.r <= h1.w, 'a H1 belefér a képernyőre');
      for (const id of ['szolgaltatasok', 'elmenyek', 'ajandek', 'velemenyek', 'gyik', 'helyszin']) {
        const r = await p.evaluate((i) => { const b = document.getElementById(i).getBoundingClientRect(); return b.height; }, id);
        assert.ok(r > 100, id + ' látszik');
      }
      if (szeles < 700) {
        // telefonon a hero képe felül van (a szöveg alatta), a bizalmi sáv 2x2
        const poz = await p.evaluate(() => ({ kep: document.querySelector('.vh-hatter').getBoundingClientRect().top, szoveg: document.querySelector('#hero h1').getBoundingClientRect().top }));
        assert.ok(poz.kep < poz.szoveg, 'a kép a szöveg felett');
        assert.equal(await p.$$eval('.bizalom-lista li', (l) => new Set(l.map((x) => Math.round(x.getBoundingClientRect().top))).size), 2, 'a bizalmi sáv 2 sorban');
      }
      await ctx.close();
    });
  }

  test('telefon: a sticky CTA a hero gombjainak elgörgetése után jön be, a helyszín szekciónál eltűnik', async () => {
    const { p, ctx } = await nyit({ szeles: 390 });
    const lathato = () => p.evaluate(() => document.getElementById('sticky-cta').classList.contains('lathato'));
    assert.equal(await lathato(), false, 'a tetején nem látszik');
    await p.evaluate(() => window.scrollTo(0, document.getElementById('szolgaltatasok').offsetTop));
    await p.waitForFunction(() => document.getElementById('sticky-cta').classList.contains('lathato'));
    await p.evaluate(() => window.scrollTo(0, document.getElementById('helyszin').offsetTop - 300));
    await p.waitForFunction(() => !document.getElementById('sticky-cta').classList.contains('lathato'));
    await ctx.close();
  });

  test('a mostani főoldal tartalma megvan: a szövegek, árak, címek, nyitvatartás', async () => {
    const { p, ctx } = await nyit();
    const szoveg = (await p.evaluate(() => document.querySelector('main').innerText)).replace(/\s+/g, ' ').replace(/ /g, ' ');
    for (const s of ['Mit kapsz egy 50 + 30 perces MOSAIC Head Spa szeánszon?', 'Milyen részekből áll egy HeadSpa kezelés?', 'Fejmasszázs eszközökkel', 'Kézmasszázs',
      'Arcmasszázs', 'Mélytisztító hajmosás', 'Fejbőr masszírozó fésű', '20 ujjas fejmasszírozó', 'Arcroller', 'Hajmasszírozó körkefe', 'Nézd, mekkora élmény!',
      'A fejbőröd azt kapja, amire szüksége van!', 'A rendszeres Head Spa hatásai', 'Tapasztalt gyógymasszőrök kényeztetnek.', 'Csak tökéletes szárítással engedünk el!', '100%-ban organikus, vegán OXYGENI termékeket használunk',
      'Ilyen gyönyörűen felújított szalonban várunk', '1023 Budapest, Bécsi út 2.', '06 20 247 4444', 'mosaicheadspa@gmail.com',
      'Hétfő – Péntek: 8:00 – 20:00', 'Szombat: 8:00 – 20:00', 'Vasárnap: zárva', 'SZÉP Kártyát is elfogadunk']) assert.ok(szoveg.includes(s), 'hiányzik: ' + s);
    assert.ok(!szoveg.includes('Páros Head Spa a MOSAIC-ban!'), 'a főoldali páros blokk kikerült');
    await ctx.close();
  });

  test('a play gomb a hangos videót NAGY ablakban (dialog) nyitja, bezárás után a videó leáll; mérés: fooldal_video', async () => {
    const { p, ctx } = await nyit();
    await p.evaluate(() => { window.dataLayer = []; });
    assert.equal(await p.locator('dialog.vh-lb').count(), 0, 'az ablak csak az első kattintáskor jön létre');
    await p.click('#hero .vh-lejatszas');
    await p.waitForSelector('dialog.vh-lb[open] video');
    assert.equal(await p.getAttribute('.vh-lb source', 'src'), '/assets/video/c2eb0f_909ce4959fe24f4f984d8953fd315d67.mp4');
    assert.equal(await p.getAttribute('.vh-lb video', 'controls'), '');
    assert.equal(await p.locator('dialog.video-modal[open]').count(), 0, 'nem a keskeny kártya-lejátszó nyílt');
    // a "nagy ablak" a teljes kepernyot betolto <dialog> (a video benne a kepernyohoz igazodik: max. 94vw x 100vh-96px); a tenyleges video-meret H.264 nelkuli Chromiumban nem merheto
    const ablak = await p.$eval('dialog.vh-lb', (d) => { const r = d.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight }; });
    assert.deepEqual([ablak.w, ablak.h], [ablak.vw, ablak.vh], 'teljes kepernyos felugro ablak: ' + JSON.stringify(ablak));
    const dl = await p.evaluate(() => window.dataLayer.filter((x) => x.event === 'fooldal_video'));
    assert.deepEqual(dl, [{ event: 'fooldal_video', video: '/assets/video/c2eb0f_909ce4959fe24f4f984d8953fd315d67.mp4' }]);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('.vh-lb').open);
    assert.equal(await p.locator('.vh-lb video').count(), 0, 'bezárás után a videó eltávolítva');
    await ctx.close();
  });

  test('csökkentett mozgás: a hero-klip nem töltődik be, csak a nyitókép látszik; a play gomb ilyenkor is működik', async () => {
    const ctx = await bongeszo.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(`${bazis}/${OLDAL}`, { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    assert.equal(await p.getAttribute('#hero video.vh-video', 'src'), null, 'a klip nem töltődik be');
    assert.ok(await p.$eval('.vh-hatter', (i) => i.complete && i.naturalWidth > 0), 'a nyitókép látszik');
    await p.click('#hero .vh-lejatszas');
    await p.waitForSelector('dialog.vh-lb[open] video');
    await ctx.close();
  });

  test('a főoldali páros blokk kikerült; a főmenü "Páros Head Spa" pontja és a páros oldalra mutató linkek (élmény-kártya) megmaradtak, minden horgony létezik', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('#paros, .paros-sav, [data-cta="paros-idopontok"], [data-cta="paros-tobb"]').count(), 0, 'nincs páros blokk');
    assert.equal(await p.locator('a[data-item-label][href="/paros-headspa-budapest"]').count() > 0, true, 'a főmenü "Páros Head Spa" pontja megvan');
    assert.equal(await p.getAttribute('a[data-cta="elmeny-paros-tartalom"]', 'href'), '/paros-headspa-budapest');
    const horgonyok = await p.$$eval('a[href^="#"]', (l) => [...new Set(l.map((a) => a.getAttribute('href').slice(1)).filter(Boolean))]);
    for (const h of horgonyok) assert.ok(await p.locator('[id="' + h + '"]').count() > 0, 'nincs ilyen horgony: #' + h);
    const css = fs.readFileSync(path.join(GYOKER, 'assets/css/fooldal.css'), 'utf8');
    assert.ok(!/paros-(sav|hatter|tart|szoveg|uj)/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'nincs árva páros CSS');
    await ctx.close();
  });

  test('telefon: a főoldal tömör - a görgetés kb. a fele a régi mobilos nézetnek (régi: ~18 300 px, cél: 9-10 ezer px); a csukott blokkok, a GYIK első 6 kérdése, a rejtett részek asztalon megmaradnak', async () => {
    const m = await nyit({ szeles: 390 });
    const mag = await m.p.evaluate(() => document.documentElement.scrollHeight);
    assert.ok(mag < 10300, 'a mobil oldal magassága: ' + mag + ' px');
    // csukott blokkok telefonon
    assert.deepEqual(await m.p.$$eval('details.mobil-csukott', (l) => l.map((d) => d.open)), [false, false, false, false]);
    assert.equal(await m.p.$$eval('.csak-nagy', (l) => l.filter((e) => getComputedStyle(e).display !== 'none').length), 0, 'a telefonon rejtett blokkok nem látszanak');
    // GYIK: az első 6 kérdés látszik, a gomb nyitja a többit; mind a 18 megvan a DOM-ban
    assert.equal(await m.p.locator('#gyik details').count(), 18);
    assert.equal(await m.p.$$eval('#gyik details', (l) => l.filter((d) => getComputedStyle(d).display !== 'none').length), 6);
    await m.p.click('.gyik-tobb');
    assert.equal(await m.p.$$eval('#gyik details', (l) => l.filter((d) => getComputedStyle(d).display !== 'none').length), 18);
    // a csukott blokk kattintásra nyílik
    await m.p.locator('#hatasok > summary').click();
    assert.equal(await m.p.$eval('#hatasok', (d) => d.open), true);
    // oldalra görgethető sorok (szolgáltatások, élmények, szalon)
    for (const sel of ['.szol-racs', '.elm-racs', '.szalon-galeria']) assert.equal(await m.p.$eval(sel, (e) => e.scrollWidth > e.clientWidth + 50), true, sel + ' oldalra görgethető');
    assert.equal(await m.p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'nincs vízszintes görgetés');
    // a rejtett tartalom megvan a DOM-ban (asztalon látszik)
    assert.ok((await m.p.textContent('main')).includes('Nézd, mekkora élmény!'), 'a telefonon rejtett blokk a HTML-ben megvan');
    await m.ctx.close();
    const a = await nyit({ szeles: 1440 });
    assert.deepEqual(await a.p.$$eval('details.mobil-csukott', (l) => l.map((d) => d.open)), [true, true, true, true], 'asztalon a csukható blokkok nyitva');
    assert.equal(await a.p.$$eval('details.mobil-csukott > summary', (l) => l.filter((e) => getComputedStyle(e).display !== 'none').length), 0, 'asztalon a feliratok rejtettek');
    assert.equal(await a.p.$$eval('#gyik details', (l) => l.filter((d) => getComputedStyle(d).display !== 'none').length), 18, 'asztalon mind a 18 kérdés látszik');
    assert.equal(await a.p.locator('.gyik-tobb').isVisible(), false);
    assert.equal(await a.p.locator('.al-fejlec.csak-nagy').isVisible(), true, 'asztalon a "Nézd, mekkora élmény!" blokk látszik');
    await a.ctx.close();
  });
});
