// A regi (Wixes) "Paros Head Spa" oldal (paros-headspa-budapest) ujrastilusa bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs)
// allitja ossze az oldalt.
//
//   node --test tools/ujrastilus-teszt/paros-regi.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
// A tartalom-hűseg (a regi oldal szovege, kepei, linkjei) a forras/<kulcs>.folyam.txt-bol (a regi oldal kinyert tartalma) es a regi oldal HTML-jebol (klon/<nev>.html) ellenorzodik.
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

const NEV = 'paros-headspa-budapest';
const EGYEDI = 'Páros Head Spa. Éljétek át együtt az igazi relaxációt!';
let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
// a regi oldal kinyert sorai: { t: tipus, raw }
function folyam() {
  return olvas('tools/paros-regi/forras/paros.folyam.txt').split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^\s*\d+\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x-?\d+\s+w\d+\s*(?:h\d+)?\s*(.*)$/.exec(l);
    return { t: m[1], raw: m[2] };
  });
}
const szovegbol = (html) => html.replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '').replace(/\s+->\s+\S+\s*$/, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
// betuk es szamok kisbetuvel: a tagolas / irasjelek / emojik / athuzas-jelek kulonbsegei nem szamitanak
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[\u0336\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200d\u200b\u00a0]/gu, '').replace(/[^\p{L}\p{N}]+/gu, '');

async function nyit(nev, { szeles = 1440 } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], nincs = [], kulso = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  // a Salonic nyilvanos naptar-API-ja hamisitva: ket nap, napi harom idopont (budapesti ido szerint 10 / 12 / 15 ora koruli)
  await p.route('https://api.salonic.hu/**', (r) => {
    const mai = Math.floor(Date.now() / 1000), nap0 = mai - (mai % 86400) + 2 * 86400;
    const slots = {}; let i = 0;
    for (const d of [0, 1]) for (const h of [8, 10, 13]) slots['s' + i++] = { timestamp: nap0 + d * 86400 + h * 3600 };
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'success', data: { blocks: { 1: { k1: { slots } } } } }) });
  });
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
  test('2026-10-09: hero = mozgo paros video (a regi hero-kep helyen); legkozelebbi szabad idopontok (Salonic-API, a foglalo-motorra mutatnak); "Kivel jonnel?" 4 kartya; a hero utan vannak, a regi tartalom valtozatlan', async () => {
    const { p, ctx, hibak } = await nyit(nev);
    const v = p.locator('#hero-video');
    assert.equal(await v.count(), 1);
    assert.equal(await v.getAttribute('src'), '/assets/video/paros-hero-barat.mp4');
    assert.equal(await v.getAttribute('poster'), '/assets/img/paros/hero-barat.jpg');
    for (const a of ['autoplay', 'muted', 'loop', 'playsinline']) assert.notEqual(await v.getAttribute(a), null, a);
    assert.equal(await p.locator('.hero .hero-kep img').count(), 0, 'a hero kep helyen video van');
    for (const f of ['assets/video/paros-hero-barat.mp4', 'assets/img/paros/hero-barat.jpg']) assert.ok(fs.existsSync(path.join(GYOKER, f)), f);
    // sorrend: hero -> szabad idopontok -> Kivel jonnel? -> a regi oldal bemutatkozasa
    const sorrend = await p.$$eval('main > section', (l) => l.map((e) => e.id || e.className.split(' ')[0]));
    assert.ok(sorrend.indexOf('idopontok') === 1 && sorrend.indexOf('kivel') === 2 && sorrend.indexOf('bemutatkozas') === 3, 'sorrend: ' + sorrend.join(','));
    // szabad idopontok: naposzlopok, az idopont a helyben nyilo foglalo-motorra (Paros szolgaltatas + idobelyeg) mutat
    await p.locator('#idopontok').scrollIntoViewIfNeeded();
    await p.waitForSelector('#napok .nap-oszlop', { timeout: 10000 });
    assert.ok((await p.locator('#napok .nap-oszlop').count()) >= 2, 'legalabb ket nap');
    const hrefek = await p.$$eval('#napok a.ido', (l) => l.map((a) => a.getAttribute('href')));
    assert.ok(hrefek.length >= 3);
    for (const h of hrefek) assert.match(h, /^\/foglalo-motor\?business=headspa&service=paros&start=\d+$/);
    assert.equal(await p.getAttribute('#tovabbi-idopontok', 'href'), '/foglalo-motor?business=headspa&service=paros');
    assert.equal(await p.locator('#slot-uzenet').isVisible(), false, 'nincs MINTA / hiba uzenet, ha az API valaszol');
    // Kivel jonnel?
    assert.equal(await p.locator('#kivel .kivel-kartya').count(), 4);
    assert.deepEqual(await p.$$eval('#kivel h3', (l) => l.map((e) => e.textContent.trim())), ['Barátnőmmel', 'Anyukámmal / lányommal', 'A párommal', 'Ajándékba adnám']);
    assert.equal(await p.getAttribute('#kivel a.kivel-kartya', 'href'), '/headspa-ajandekkartya?variant=friend');
    assert.deepEqual(hibak, []);
    await ctx.close();
    // telefonon: nincs vizszintes gorgetes, a video a cim folott van
    const m = await nyit(nev, { szeles: 390 });
    const adat = await m.p.evaluate(() => ({ szeles: document.documentElement.scrollWidth, ablak: innerWidth, videoAlja: document.querySelector('#hero-video').getBoundingClientRect().bottom, cimTeteje: document.querySelector('main h1').getBoundingClientRect().top }));
    assert.ok(adat.szeles <= adat.ablak, 'nincs vizszintes gorgetes: ' + JSON.stringify(adat));
    assert.ok(adat.cimTeteje >= adat.videoAlja - 4, 'a cim a video alatt van: ' + JSON.stringify(adat));
    await m.ctx.close();
  });

  test('betoltodik hibak nelkul: egyetlen H1, nincs torott kep / 404 / konzol-hiba; a regi oldal cime, leirasa, canonical-ja valtozatlan; INDEXELHETO (a regi sem volt noindex); az -uj cim valtozatlan', async () => {
    const regi = olvas(`klon/${nev}.html`);
    const g = (re) => { const m = re.exec(regi); assert.ok(m, 'meta a regi oldalon: ' + re); return m[1]; };
    const { p, ctx, hibak, nincs } = await nyit(nev);
    assert.equal(await p.title(), g(/<title>([^<]*)<\/title>/).replace(/&amp;/g, '&'));
    assert.equal(await p.getAttribute('meta[name="description"]', 'content'), g(/<meta name="description" content="([^"]*)"/).replace(/&amp;/g, '&'));
    assert.equal(await p.getAttribute('link[rel="canonical"]', 'href'), g(/<link rel="canonical" href="([^"]*)"/));
    assert.doesNotMatch(regi, /<meta name="robots"/, 'a regi oldal sem volt noindex');
    assert.equal(await p.locator('meta[name="robots"]').count(), 0);
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.ok(norm(await p.textContent('h1')).includes(norm(EGYEDI)), 'a H1 az oldal hero-cime');
    assert.equal(await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc)).then((l) => l.length), 0, 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.equal(await p.locator('main [id^="comp-"]:not(a)').count(), 0, 'nincs Wix-maradvany');
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('a regi oldal MINDEN szovege, kepe, linkje megvan (tartalom-hűseg): sorok, gombok, csomagkartyak, videok, GYIK, kepek', async () => {
    const sorok = folyam();
    const { p, ctx } = await nyit(nev);
    const uj = norm(await p.evaluate(() => document.querySelector('main').innerText + ' ' + [...document.querySelectorAll('main .gyik details')].map((d) => d.textContent).join(' ')));
    const hianyzo = [];
    for (const s of sorok) {
      if (!['SZ', 'H1', 'H2', 'H3', 'H4', 'GOMB'].includes(s.t)) continue;
      const sz = norm(szovegbol(s.raw).replace(/(\d) \.(\d{3})/g, '$1.$2'));
      if (!sz) continue;
      if (!uj.includes(sz)) hianyzo.push(szovegbol(s.raw).slice(0, 90));
    }
    // az arlista-blokk ket kartyaja a regi HTML-bol (a kinyero a felsorolas elemeit egy sorba olvasztja): minden kartya minden sora
    assert.deepEqual(hianyzo.filter((x) => !/^50 perces MOSAIC|^Exkluzív|^Masszázs fókuszú|^Hajápolás fókuszú/.test(x)), [], 'a regi oldal szovegei, amik nincsenek meg');
    // kepek: a regi HTML MINDEN tartalmi kepe (fejlec / ikonok nelkul) + a regi oldal kinyert kepei az uj oldalon
    const regiHtml = olvas(`klon/${nev}.html`);
    const eleje = regiHtml.indexOf('81f16bfc67fb');
    const azonosito = [...new Set([...regiHtml.slice(eleje).matchAll(/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})[0-9a-f]{8,}\.(?:jpe?g|png|webp)/g)].map((m) => m[1]))];
    const folyamKepek = sorok.filter((s) => s.t === 'KEP').map((s) => /\/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})/.exec(s.raw)?.[1]).filter(Boolean);
    const html = await p.content();
    assert.ok(azonosito.length >= 30, 'a regi oldal kepeinek listaja: ' + azonosito.length);
    // a regi hero-kep (2c17645e97d9) helyett 2026-10-09 ota a mozgo paros video all (a tulajdonos kerese)
    assert.deepEqual([...new Set([...azonosito, ...folyamKepek])].filter((k) => k !== '2c17645e97d9' && !html.includes(k)), [], 'hianyzo kepek (a regi oldal HTML-je / kinyert tartalma szerint)');
    // linkek
    const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    const regiLinkek = sorok.filter((s) => s.t === 'GOMB').map((s) => /\s->\s+(\S+)\s*$/.exec(s.raw)?.[1]).filter(Boolean);
    assert.deepEqual([...new Set(regiLinkek)].filter((h) => !hrefek.includes(h)), [], 'hianyzo linkek');
    // csomagkartyak: 4 db, mindegyik 'FOGLALOK!' + kedvezmeny-sor + athuzott regi ar
    assert.equal(await p.locator('.lv-paros-csomag').count(), 4);
    assert.equal(await p.locator('.lv-paros-csomag .lv-csomag-ar s').count(), 4, 'a regi (athuzott) arak');
    assert.deepEqual(await p.$$eval('.lv-paros-csomag .lv-csomag-ar', (l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), ['Ár: 49.900 Ft helyett 39.900 Ft', 'Ár: 32.900 Ft helyett 26.900 Ft', 'Ár: 32.900 Ft helyett 26.900 Ft', 'Ár: 65.900 Ft helyett 53.800 Ft']);
    assert.equal(await p.locator('.lv-paros-csomag .lv-promo').count(), 4);
    // videok: 15 db, a fajlok megvannak, a poszter / ido / cim a regi oldalrol
    const videok = await p.$$eval('[data-video]', (l) => l.map((b) => b.dataset.video));
    assert.equal(videok.length, 15);
    for (const v of videok) assert.ok(fs.existsSync(path.join(GYOKER, v.slice(1))), 'videofajl: ' + v);
    // GYIK: a regi oldalon a ket Common Ninja GYIK egy listaban (klon.js)
    const gy = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1]);
    const v = [...gy['c2eb0f_e2a637ece2437154df156d36cae403f4'], ...gy['c2eb0f_dab261d3e84629df7798238e716f0266']];
    const kerdesek = await p.$$eval('main .gyik details', (l) => l.map((d) => ({ k: d.querySelector('summary').textContent.trim(), v: d.querySelector('.gy-valasz').textContent })));
    assert.equal(kerdesek.length, 18);
    assert.equal(kerdesek.length, v.length, 'a ket regi GYIK-lista egyutt');
    v.forEach(([k, a], i) => { assert.equal(kerdesek[i].k, k); assert.equal(norm(kerdesek[i].v), norm(a.replace(/<[^>]*>/g, ''))); });
    await ctx.close();
  });

  test('FUGGETLEN tartalom-hűseg: a regi oldal HTML-jenek MINDEN szovegcsomopontja megvan az uj oldalon - csak a fejlec / menu / info-panel szovegei hianyozhatnak', async () => {
    const t = olvas(`klon/${nev}.html`).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>/g, '');
    const nyers = [...t.matchAll(/>([^<>]{12,})</g)].map((m) => m[1]);
    const { p, ctx } = await nyit(nev);
    const csomok = (await p.evaluate((l) => l.map((x) => { const e = document.createElement('textarea'); e.innerHTML = x; return e.value.trim(); }), nyers)).filter(Boolean);
    const gyik = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1]);
    const gyikSzoveg = ['c2eb0f_e2a637ece2437154df156d36cae403f4', 'c2eb0f_dab261d3e84629df7798238e716f0266'].flatMap((k) => gyik[k]).map(([k, v]) => k + ' ' + v.replace(/<[^>]*>/g, ' ')).join(' ');
    const uj = norm(await p.evaluate(() => document.body.textContent) + ' ' + (await p.title()) + ' ' + gyikSzoveg);
    const FEJLEC = /^(ÚJ! - 4 kezes Headspa!|Páros Head Spa|Head Spa Férfiaknak|Head Spa Csomagok és Árak|Head Spa - 20% OKTÓBERI kedvezmény!|Head Spa Vélemények|Fodrászat Árak|Októberi akció!.*|<script defer async src=.*|bottom of page|A LEGFONTOSABB INFÓK|📌 1023 Budapest.*|🕛 Hétfő - Péntek.*|Árlista, csomagok, foglalás|📅 Head Spa kezelések árai.*|Videó lejátszása|Ahol elérsz minket)$/;
    const hianyzo = csomok.filter((c) => !FEJLEC.test(c) && norm(c).length >= 8 && !uj.includes(norm(c)));
    assert.ok(csomok.length > 200, 'a regi oldal szovegcsomopontjai: ' + csomok.length);
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg az ujban');
    await ctx.close();
  });

  test('rejtett regi (Wixes) valtozat: -regi (asztali + mobil) noindex, sajat canonical; az eredeti klon-fajl es az -uj oldal megvan; az LCP-tablaban nincs sora', () => {
    for (const mappa of ['klon', path.join('klon', 'm')]) {
      const regi = olvas(path.join(mappa, nev + '-regi.html'));
      assert.match(regi, /<meta name="robots" content="noindex(, nofollow)?"\/>/, mappa + ' regi: noindex');
      assert.ok(regi.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu/${nev}-regi"/>`), mappa + ' regi: canonical');
      assert.ok(fs.existsSync(path.join(GYOKER, mappa, nev + '.html')), mappa + ': az eredeti klon-fajl megvan (visszaallitashoz)');
    }
    assert.ok(fs.existsSync(path.join(GYOKER, 'foglalas', nev + '-uj.html')), 'az ujratervezett -uj oldal valtozatlanul megvan');
    assert.ok(!olvas('tools/lcp-elofeltoltes.json').includes(`"${nev}"`), 'LCP-tabla');
  });

  test('mukodes: a folyamat-diavetites es a szalon-galeria lapozoja mozgat; a videora kattintva felugro lejatszo; a GYIK harmonika nyilik; a terkep-gomb betolti a terkepet', async () => {
    const { p, ctx } = await nyit(nev);
    const sav = p.locator('.lv-folyamat .korhinta-sav');
    await sav.scrollIntoViewIfNeeded();
    assert.equal(await sav.locator('figure').count(), 9, 'folyamat-diavetites: 9 kep (az elo oldal galeriaja)');
    let elotte = await sav.evaluate((e) => e.scrollLeft);
    await p.locator('.lv-folyamat .korhinta-gomb.kovetkezo').click();
    await p.waitForTimeout(700);
    assert.ok(await sav.evaluate((e) => e.scrollLeft) > elotte, 'a lapozo mozgatja a savot');
    const galeria = p.locator('#szalon .korhinta-sav');
    assert.equal(await galeria.locator('figure').count(), 19, 'szalon-galeria: 19 kep (az elo oldal galeriaja)');
    await p.locator('.lv-videok').scrollIntoViewIfNeeded();
    await p.locator('[data-video]').first().click();
    await p.waitForSelector('dialog.video-modal[open] video', { timeout: 5000 });
    assert.equal(await p.locator('dialog.video-modal.fekvo').count(), 1, 'fekvo videok: szeles lejatszo');
    await p.keyboard.press('Escape');
    const elso = p.locator('.gyik details').first();
    await elso.locator('summary').click();
    assert.equal(await elso.evaluate((d) => d.open), true);
    await p.locator('#terkep-gomb').scrollIntoViewIfNeeded();
    await p.locator('#terkep-gomb').click();
    await p.waitForSelector('#terkep iframe', { timeout: 3000 });
    await ctx.close();
  });

  for (const szeles of [390, 360]) {
    test(`telefon (${szeles} px): nincs vizszintes gorgetes, a kepek nem lognak ki, a kartyak olvashatok`, async () => {
      const { p, ctx } = await nyit(nev, { szeles });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'vizszintes tobblet');
      const kilog = await p.$$eval('main img', (l) => l.filter((i) => !i.closest('.korhinta') && i.getBoundingClientRect().right > innerWidth + 1).map((i) => i.currentSrc.split('/').pop()));
      assert.deepEqual(kilog, [], 'kikilogo kepek');
      assert.ok(await p.locator('.lv-paros-csomag').first().isVisible());
      await ctx.close();
    });
  }
});
