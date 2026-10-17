// A regi (Wixes) "Ferfi oxigenterapia" oldal (oxigenterapia-ferfiaknak) ujrastilusa (az /oxigenterapia-budapest landing komponenseivel) bongeszos tesztjei (Playwright).
// Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt.
//
//   node --test tools/ujrastilus-teszt/oxigen-ferfi.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
// A tartalom-hűseg (a regi oldal szovege, kepei, linkjei) a forras/oxigen-ferfi.folyam.txt-bol (a regi oldal kinyert tartalma), a regi oldal HTML-jebol (klon/<nev>.html)
// es a GYIK-valaszokbol (assets/js/gyik.js) ellenorzodik. A tartalom SZO SZERINT a regi oldalbol van (az elavult / hibas elemek is): a teszt ezt vedi.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

const NEV = 'oxigenterapia-ferfiaknak';
const CIM = 'Férfi Oxigénterápia kopaszodás és foltos szakáll ellen';
const GYIK_AZON = 'c2eb0f_193bec926d66321bf99ada19cf4105a5';
const FOGLALO = '/foglalo-motor?business=oxygen';
let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
// a regi oldal kinyert sorai: { t: tipus, raw }
function folyam() {
  return olvas('tools/ujrastilus-teszt/forras/oxigen-ferfi.folyam.txt').split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^\s*\d+\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x-?\d+\s+w\d+\s*(?:h\d+)?\s*(.*)$/.exec(l);
    return { t: m[1], raw: m[2] };
  });
}
const galeriak = () => JSON.parse(/window\.MH_GALERIAK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/galeriak.js'))[1]);
// a regi oldal 5 galeriaja (komponens-azonosito -> kepek): hajhullas, korpas, pikkelysomor, seborrea, szalon; a Wix HTML-je csak az elso 2 kepet tartalmazza, a teljes lista a galeriak.js-ben van
const GALERIAK = ['comp-mnn4k93g2', 'comp-mnn4k93q', 'comp-mnn4k93w5', 'comp-mnn4k9432', 'comp-mnn4k98w5'];
const gyikAdat = () => JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])[GYIK_AZON];
const szovegbol = (html) => html.replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '').replace(/\s+->\s+\S+\s*$/, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
// betuk es szamok kisbetuvel: a tagolas / irasjelek / emojik / athuzas-jelek kulonbsegei nem szamitanak
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[\u0336\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200d\u200b\u00a0]/gu, '').replace(/[^\p{L}\p{N}]+/gu, '')
  // a Google-ertekelesek szama elo adat (assets/js/google-szam.js, a build teszi fel): a regi oldal beegetett szama (891) nem kell hogy egyezzen
  .replace(/google49\d{3,4}(?=ertekeles|értékelés|velemeny|vélemény)/g, 'google49N');

async function nyit(nev, { szeles = 1440 } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], nincs = [], kulso = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${bazis}/${encodeURI(nev)}`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
  });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, nincs, kulso };
}

describe(`/${NEV}`, () => {
  const nev = NEV;
  test('betoltodik hibak nelkul: egyetlen H1, nincs torott kep / 404 / konzol-hiba; a regi oldal cime, leirasa, canonical-ja valtozatlan; INDEXELHETO (a regi sem volt noindex)', async () => {
    const regi = olvas(`klon/${nev}.html`);
    const g = (re) => { const m = re.exec(regi); assert.ok(m, 'meta a regi oldalon: ' + re); return m[1]; };
    const { p, ctx, hibak, nincs } = await nyit(nev);
    assert.equal(await p.title(), g(/<title>([^<]*)<\/title>/).replace(/&amp;/g, '&'));
    assert.equal(await p.getAttribute('meta[name="description"]', 'content'), g(/<meta name="description" content="([^"]*)"/).replace(/&amp;/g, '&'));
    assert.equal(await p.getAttribute('link[rel="canonical"]', 'href'), g(/<link rel="canonical" href="([^"]*)"/));
    assert.equal(await p.getAttribute('meta[property="og:url"]', 'content'), g(/<meta property="og:url" content="([^"]*)"/));
    assert.equal(await p.locator('meta[name="robots"]').count(), 0, 'nincs robots meta (a regi oldal indexelheto volt)');
    assert.doesNotMatch(regi, /<meta name="robots"/, 'a regi oldal sem volt noindex');
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.equal(norm(await p.textContent('h1')), norm(CIM), 'a H1 az oldal hero-cime');
    assert.equal(await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc)).then((l) => l.length), 0, 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.equal(await p.$$eval('img:not([width]), img:not([height])', (l) => l.length), 0, 'minden kepnek van width / height');
    assert.equal(await p.locator('main [id^="comp-"]:not(a)').count(), 0, 'nincs Wix-maradvany');
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('a hero kep elotoltve (fetchpriority=high), a tobbi kep lazy; NINCS meres: data-cta / dataLayer-esemeny / sticky-cta; az oxigen-landing.css / .js valtozatlanul van betoltve', async () => {
    const forras = olvas(`foglalas/${nev}.html`);
    const hero = '/assets/img/c2eb0f_6e4e940124d942d4aea355ecc21729fe.jpg';
    assert.ok(forras.includes(`<link rel="preload" href="${hero}" as="image" fetchpriority="high">`), 'hero preload');
    assert.doesNotMatch(forras, /data-cta|dataLayer|gtag\(|fbq\(|ttq\./, 'nincs merokod / esemeny');
    assert.doesNotMatch(forras, /id="sticky-cta"/, 'nincs sticky CTA (a landing JS-e a "jelek" szekciot kovetelne meg, a regi oldalon nincs ilyen)');
    assert.ok(forras.includes('/assets/css/oxigen-landing.css') && forras.includes('/assets/css/oxigen-ferfi.css') && forras.includes('/assets/js/oxigen-landing.js'));
    // a loading / fetchpriority attributumokat a forras-HTML-bol nezzuk (a teszt-betolto minden lazy kepet eager-re allit)
    const kepek = [...forras.matchAll(/<img\b[^>]*>/g)].map((m) => ({ s: /src="([^"]+)"/.exec(m[0])[1], lazy: (/loading="([^"]+)"/.exec(m[0]) || [])[1], fp: (/fetchpriority="([^"]+)"/.exec(m[0]) || [])[1] }));
    const heroKep = kepek.find((k) => k.s === hero);
    assert.ok(heroKep, 'a hero kep az oldalon');
    assert.equal(heroKep.fp, 'high');
    assert.notEqual(heroKep.lazy, 'lazy');
    assert.deepEqual(kepek.filter((k) => k !== heroKep && k.lazy !== 'lazy').map((k) => k.s), [], 'a hero kepen kivul minden kep lazy');
    assert.equal(kepek.filter((k) => k.fp).length, 1, 'csak a hero kep fetchpriority=high');
    const { p, ctx } = await nyit(nev);
    assert.equal(await p.locator('[data-cta]').count(), 0);
    await ctx.close();
  });

  test('a regi oldal MINDEN szovege, kepe, linkje megvan (tartalom-hűseg): sorok, gombok, arkartyak, GYIK, kepek', async () => {
    const sorok = folyam();
    const { p, ctx } = await nyit(nev);
    const uj = norm(await p.evaluate(() => document.querySelector('main').innerText + ' ' + [...document.querySelectorAll('main .gyik details')].map((d) => d.textContent).join(' ')));
    const hianyzo = [];
    for (const s of sorok) {
      if (!['SZ', 'H1', 'H2', 'H3', 'H4', 'GOMB'].includes(s.t)) continue;
      const nyers = szovegbol(s.raw).replace(/(\d) \.(\d{3})/g, '$1.$2');
      if (s.t === 'GOMB' && /^\d+\. .*\?$/.test(nyers.trim())) continue;   // GYIK-kerdes: lent kulon, a gyik.js valaszaival egyutt
      const sz = norm(nyers);
      if (!sz) continue;
      // a lepeslista sorszamai (1. ... 9.) az <ol> szamozasa az ujban: a sor eleji "N. " nelkul is elfogadott
      const szamNelkul = norm(nyers.replace(/^\s*\d+\.\s*/, ''));
      if (!uj.includes(sz) && !(/^\s*\d+\./.test(nyers) && uj.includes(szamNelkul))) hianyzo.push(nyers.slice(0, 90));
    }
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg');
    // kepek: a regi HTML MINDEN tartalmi kepe (fejlec / ikonok nelkul) az uj oldalon
    const regiHtml = olvas(`klon/${nev}.html`);
    const eleje = regiHtml.indexOf('81f16bfc67fb');
    // a ket dekoracios hatterkep (a GYIK-szekcio "nsplsh_38734f5a4a38..." es a terkep-szekcio "11062b_c676302884b3...") a Wix szekcio-hattere: nem kerul az uj oldalra
    const DEKORACIO = ['38734f5a4a38', 'c676302884b3'];
    const azonosito = [...new Set([...regiHtml.slice(eleje).matchAll(/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})[0-9a-f]{8,}\.(?:jpe?g|png|webp)/g)].map((m) => m[1]))].filter((k) => !DEKORACIO.includes(k));
    assert.ok(azonosito.length >= 33, 'a regi oldal kepeinek listaja: ' + azonosito.length);
    const html = await p.content();
    assert.deepEqual(azonosito.filter((k) => !html.includes(k)), [], 'hianyzo kepek (a regi oldal HTML-je szerint)');
    // linkek: minden gomb / szovegbeli link a regi oldalrol, valtozatlanul
    const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    const regiLinkek = [...sorok.filter((s) => s.t === 'GOMB').map((s) => /\s->\s+(\S+)\s*$/.exec(s.raw)?.[1]), ...sorok.flatMap((s) => [...s.raw.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))].filter(Boolean);
    assert.ok(regiLinkek.length >= 10, 'a regi oldal linkjei: ' + regiLinkek.length);
    assert.deepEqual([...new Set(regiLinkek)].filter((h) => !hrefek.includes(h)), [], 'hianyzo linkek');
    await ctx.close();
  });

  test('FUGGETLEN tartalom-hűseg: a regi oldal HTML-jenek MINDEN szovegcsomopontja megvan az uj oldalon (a fejlec / menu / info-panel szovegei nelkul)', async () => {
    const t = olvas(`klon/${nev}.html`).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>/g, '');
    const nyers = [...t.matchAll(/>([^<>]{12,})</g)].map((m) => m[1]);
    const { p, ctx } = await nyit(nev);
    const csomok = (await p.evaluate((l) => l.map((x) => { const e = document.createElement('textarea'); e.innerHTML = x; return e.value.trim(); }), nyers)).filter(Boolean);
    // a tartalom a hero-cimmel kezdodik es a lablec ("Big in Japan Kft.") elott er veget; elotte a fejlec / menu, utana az info-panel szovegei vannak
    const elso = csomok.findIndex((c) => c.startsWith('Férfi Oxigénterápia kopaszodás'));
    const utolso = csomok.findIndex((c) => c.startsWith('Big in Japan'));
    assert.ok(elso > 0 && utolso > elso, `hatarok: ${elso} / ${utolso}`);
    const tartalom = csomok.slice(elso, utolso);
    const uj = norm(await p.evaluate(() => document.querySelector('main').textContent) + ' ' + gyikAdat().map(([k, v]) => k + ' ' + v.replace(/<[^>]*>/g, ' ')).join(' '));
    const hianyzo = tartalom.filter((c) => norm(c).length >= 8 && !uj.includes(norm(c)) && !uj.includes(norm(c.replace(/^\s*\d+\.\s*/, ''))));
    assert.ok(tartalom.length > 150, 'a regi oldal szovegcsomopontjai: ' + tartalom.length);
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg az ujban');
    // az elavult / hibas elemek is valtozatlanul: nem javitottuk ki oket (a PR "Eszrevetelek" resze)
    const mind = await p.evaluate(() => document.querySelector('main').innerText);
    assert.equal(mind.split('Májusban 10% kedvezménnyel!').length - 1, 6, '"Májusban 10% kedvezménnyel!" a regi oldal mind a 6 helyen');
    for (const mondat of ['29.900 Ft', '891 értékelésből', 'közel 1.000 véleményből', 'hajhagymákat.Kopaszodás', 'sűrűsödő ő haj', 'megszáírtjuk', 'termékekeit', 'mi dolgozunk. A']) {
      assert.ok(mind.includes(mondat), 'valtozatlan a regi oldalon: ' + mondat);
    }
    await ctx.close();
  });

  test('szerkezet: 5 galeria (6 / 3 / 3 / 3 es a szalon 19 kepe), 3 "miert" kartya, 2 arkartya, 9 lepes, 3 pipa-lista; Trustindex a regi widgettel; GYIK: a 10 kerdes + valasz szo szerint', async () => {
    const { p, ctx } = await nyit(nev);
    // a 5 galeria (4 eredmeny + a szalon) kepei a regi oldal galeriak.js-beli listaja szerint, ugyanabban a sorrendben
    const gal = galeriak();
    assert.deepEqual(await p.$$eval('.ba-csoport .ba-sav, .szalon-sor .ba-sav', (l) => l.map((sav) => [...sav.querySelectorAll('img')].map((i) => i.getAttribute('src').split('/').pop()))), GALERIAK.map((k) => gal[k].map(([kep]) => kep)));
    assert.deepEqual(GALERIAK.map((k) => gal[k].length), [6, 3, 3, 3, 19]);
    assert.deepEqual(await p.$$eval('.ba-csoport', (l) => l.map((c) => c.querySelectorAll('.ba').length)), [6, 3, 3, 3]);
    assert.equal(await p.locator('.szalon-sor .ba').count(), 19, 'a szalon-galeria mind a 19 kepe');
    assert.deepEqual(await p.$$eval('.ba-csoport h2', (l) => l.map((h) => h.textContent)), ['Látható Eredmények hajhullás esetén', 'Valós Eredmények korpás haj esetén', 'Átütő Eredmények pikkelysömör esetén', 'Szembetűnő Eredmények seborrea esetén']);
    assert.equal(await p.locator('.miert-kartya').count(), 3);
    assert.equal(await p.locator('.ar-kartya').count(), 2);
    assert.equal(await p.locator('.lepes-lista li').count(), 9);
    assert.deepEqual(await p.$$eval('.pipa-lista', (l) => l.map((u) => u.children.length)), [5, 5, 8]);
    assert.deepEqual(await p.$$eval('.ar-kartya', (l) => l.map((k) => [k.querySelector('h3').textContent, k.querySelector('.ferfi-ar b').textContent, k.querySelector('.masodik').textContent, k.querySelectorAll('.pipak li').length])),
      [['Haj csomag', '29.900 Ft', '2. alkalomtól: 26.000 Ft', 10], ['Arc + Haj csomag', '39.900 Ft', '2. alkalomtól: 34.900 Ft', 12]]);
    // Trustindex: a regi oldal widgetje (assets/embed/c2eb0f_614b...), a landing JS-e tolti be keretben
    assert.equal(await p.getAttribute('#ti-doboz', 'data-forras'), '/assets/embed/c2eb0f_614b09d160b9382c4cffcde6d7828dcb.html');
    await p.waitForSelector('#ti-doboz iframe', { timeout: 3000 });
    assert.equal(await p.getAttribute('#ti-doboz iframe', 'src'), '/assets/embed/c2eb0f_614b09d160b9382c4cffcde6d7828dcb.html');
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets/embed/c2eb0f_614b09d160b9382c4cffcde6d7828dcb.html')));
    // GYIK
    const gy = gyikAdat();
    const kerdesek = await p.$$eval('main .gyik details', (l) => l.map((d) => ({ k: d.querySelector('summary').textContent.trim(), v: [...d.querySelectorAll(':scope > p')].map((x) => x.textContent).join(' ') })));
    assert.equal(kerdesek.length, 10);
    assert.equal(kerdesek.length, gy.length);
    gy.forEach(([k, v], i) => { assert.equal(kerdesek[i].k, k); assert.equal(norm(kerdesek[i].v), norm(v.replace(/<[^>]*>/g, ' '))); });
    await ctx.close();
  });

  test('foglalo-gombok: mind a 8 gomb a regi oldal celjara (/foglalo-motor?business=oxygen) mutat, a gombok szovege valtozatlan; fejlec / lablec megvan', async () => {
    const { p, ctx } = await nyit(nev);
    const gombok = await p.$$eval('main a[href^="/foglalo-motor"]', (l) => l.map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').replace(/→/, '').trim()]));
    assert.deepEqual(gombok.map((g) => g[0]), Array(8).fill(FOGLALO));
    assert.deepEqual(gombok.map((g) => g[1]), ['IDŐPONTFOGLALÁS', 'IDŐPONTFOGLALÁS', 'IDŐPONTFOGLALÁS', 'FOGLALOK!', 'FOGLALOK!', 'BEJELENTKEZEK!', 'IDŐPONT FOGLALÁS', 'IDŐPONTFOGLALÁS']);
    const oldal = await p.textContent('body');
    assert.ok(oldal.includes('Szőrtelenítés') && oldal.includes('Ajándékkártya'), 'fejlec (fomenu)');
    assert.ok(oldal.includes('Big in Japan Kft.'), 'lablec');
    await ctx.close();
  });

  test('rejtett regi (Wixes) valtozat: -regi (asztali + mobil) noindex, sajat canonical; az eredeti klon-fajl megvan; az LCP-tablaban nincs sora', () => {
    for (const mappa of ['klon', path.join('klon', 'm')]) {
      const regi = olvas(path.join(mappa, nev + '-regi.html'));
      assert.match(regi, /<meta name="robots" content="noindex(, nofollow)?"\/>/, mappa + ' regi: noindex');
      assert.ok(regi.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu/${nev}-regi"/>`), mappa + ' regi: canonical');
      assert.ok(fs.existsSync(path.join(GYOKER, mappa, nev + '.html')), mappa + ': az eredeti klon-fajl megvan (visszaallitashoz)');
    }
    assert.ok(!olvas('tools/lcp-elofeltoltes.json').includes(`"${nev}"`), 'LCP-tabla');
  });

  test('mukodes: a hajhullas-galeria lapozoja mozgatja a savot; a GYIK harmonika nyilik; a terkep helykitolto -> gomb -> iframe; a Google-link valtozatlan', async () => {
    const { p, ctx } = await nyit(nev);
    const sav = p.locator('.ba-csoport').first().locator('.ba-sav');
    await sav.scrollIntoViewIfNeeded();
    const kovetkezo = p.locator('.ba-csoport').first().locator('.lapozo.kovetkezo');
    assert.equal(await kovetkezo.isVisible(), true, 'a 6 kepes galerian van lapozo');
    const elotte = await sav.evaluate((e) => e.scrollLeft);
    await kovetkezo.click();
    await p.waitForTimeout(700);
    assert.ok(await sav.evaluate((e) => e.scrollLeft) > elotte, 'a lapozo mozgatja a savot');
    const elso = p.locator('.gyik details').first();
    await elso.locator('summary').click();
    assert.equal(await elso.evaluate((d) => d.open), true);
    assert.match(await elso.innerText(), /Fogyassz több zöldséget/);
    const doboz = p.locator('#terkep-doboz');
    await doboz.scrollIntoViewIfNeeded();
    assert.match(await doboz.innerText(), /Térkép: a tartalom külső szolgáltatótól \(Google\) töltődik be\./);
    assert.equal(await doboz.locator('a').getAttribute('href'), 'https://www.google.com/maps/search/?api=1&query=MOSAIC%20Head%20Spa%2C%201023%20Budapest%2C%20B%C3%A9csi%20%C3%BAt%202.');
    await doboz.locator('button', { hasText: 'Térkép megjelenítése' }).click();
    await p.waitForSelector('#terkep-doboz iframe', { timeout: 3000 });
    await ctx.close();
  });

  for (const szeles of [390, 360]) {
    test(`telefon (${szeles} px): nincs vizszintes gorgetes, a kepek nem lognak ki, a kartyak olvashatok`, async () => {
      const { p, ctx } = await nyit(nev, { szeles });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'vizszintes tobblet');
      const kilog = await p.$$eval('main img', (l) => l.filter((i) => !i.closest('.ba-sav') && i.getBoundingClientRect().right > innerWidth + 1).map((i) => i.currentSrc.split('/').pop()));
      assert.deepEqual(kilog, [], 'kikilogo kepek');
      assert.ok(await p.locator('.ar-kartya').first().isVisible());
      const keskeny = await p.$$eval('main h1, main h2, main h3, main p, main li', (l) => l.filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.textContent.slice(0, 40)));
      assert.deepEqual(keskeny, [], 'kikilogo szovegek');
      await ctx.close();
    });
  }
});
