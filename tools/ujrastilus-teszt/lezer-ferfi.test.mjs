// A regi (Wixes) "Vegleges lezeres szortelenites ferfiaknak" oldal (vegleges-szortelenites-ferfiaknak) ujrastilusa (a /lezeres-szortelenites-budapest landing stilusaban + komponenseivel:
// assets/css/lezer-landing.css + assets/css/lezer-ferfi-landing.css) bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver
// (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt.
//
//   node --test tools/ujrastilus-teszt/lezer-ferfi.test.mjs
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

const NEV = 'vegleges-szortelenites-ferfiaknak';
const EGYEDI = 'Végleges Lézeres szőrtelenítés férfiaknak';
let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
// a regi oldal kinyert sorai: { t: tipus, raw }
function folyam() {
  return olvas('tools/lezer-variansok/forras/ferfi.folyam.txt').split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^\s*\d+\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x-?\d+\s+w\d+\s*(?:h\d+)?\s*(.*)$/.exec(l);
    return { t: m[1], raw: m[2] };
  });
}
const szovegbol = (html) => html.replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '').replace(/\s+->\s+\S+\s*$/, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
// betuk es szamok kisbetuvel: a tagolas / irasjelek / emojik / athuzas-jelek kulonbsegei nem szamitanak
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[\u0336\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200d\u200b\u00a0]/gu, '').replace(/[^\p{L}\p{N}]+/gu, '')
  // a Google-ertekelesek szama elo adat (assets/js/google-szam.js): a regi oldal beegetett szama (831 / 971 ...) nem kell hogy egyezzen
  .replace(/google49(?:5)?\d{3,4}(?=ertekeles|értékelés|velemeny|vélemény)/g, 'google49N');

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
    assert.equal(await p.locator('meta[name="robots"]').count(), 0, 'nincs robots meta (a regi oldal indexelheto volt)');
    assert.doesNotMatch(regi, /<meta name="robots"/, 'a regi oldal sem volt noindex');
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.ok(norm(await p.textContent('h1')).includes(norm(EGYEDI)), 'a H1 az oldal hero-cime');
    assert.equal(await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc)).then((l) => l.length), 0, 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.equal(await p.locator('main [id^="comp-"]:not(a)').count(), 0, 'nincs Wix-maradvany');
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    // a hero kep elotoltve (fetchpriority=high), a tobbi kep lusta (a hero-kepen es az ertekeles-csillagon kivul); minden kepnek szeles / magas
    const html = await p.content();
    assert.match(olvas(`foglalas/${nev}.html`), /<link rel="preload" href="\/assets\/img\/c2eb0f_ed3e3ce785064556bc644c86c7777436\.jpg" as="image" fetchpriority="high">/);
    assert.equal(await p.locator('.hero-kep img[fetchpriority="high"]').count(), 1);
    assert.deepEqual(await p.$$eval('main img', (l) => l.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.getAttribute('src'))), [], 'width / height nelkuli kepek');
    // (a forras-HTML-bol: a nyit() a gorgetes elott a lusta kepeket kenyszeritve betolti)
    const forrasKepek = [...olvas(`foglalas/${nev}.html`).matchAll(/<img\s[^>]*>/g)].map((m) => m[0]);
    assert.deepEqual(forrasKepek.filter((t) => !/loading="lazy"/.test(t)).map((t) => /src="([^"]*)"/.exec(t)[1]), ['/assets/img/c2eb0f_81f16bfc67fb4ad6a78e8eda371a0139.png', '/assets/img/c2eb0f_ed3e3ce785064556bc644c86c7777436.jpg'], 'nem lusta kepek: csak a hero-ertekeles csillagai es a hero-kep');
    // nincs meroKod / nyomkovetes az oldalon (a suti.js utvonal-alapu; az oldal neve ugyanaz)
    assert.doesNotMatch(olvas(`foglalas/${nev}.html`), /data-cta|dataLayer|gtag\(|fbq\(|ttq\.|googletagmanager|connect\.facebook/);
    assert.ok(html.length > 10000);
    await ctx.close();
  });

  test('STILUS: a /lezeres-szortelenites-budapest landing komponensei (lezer-landing.css) + a sajat kiegeszito CSS; NEM a regi rendszer (headspa-oldal.css / lezer-variansok.css); a szinek / betuk / gombok azonosak a mintaoldaleval', async () => {
    const src = olvas(`foglalas/${nev}.html`);
    assert.ok(src.includes('<link rel="stylesheet" href="/assets/css/lezer-landing.css">'), 'lezer-landing.css');
    assert.ok(src.includes('<link rel="stylesheet" href="/assets/css/lezer-ferfi-landing.css">'), 'lezer-ferfi-landing.css');
    assert.ok(src.indexOf('lezer-landing.css') < src.indexOf('lezer-ferfi-landing.css'), 'a kiegeszito CSS a minta CSS UTAN toltodik');
    assert.doesNotMatch(src, /headspa-oldal\.css|lezer-variansok\.css/, 'a regi rendszer stilusai nincsenek hasznalatban');
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets/css/lezer-ferfi-landing.css')));
    const jellemzok = () => ({
      body: getComputedStyle(document.body).backgroundColor + '|' + getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector('main h1')).fontFamily + '|' + getComputedStyle(document.querySelector('main h1')).color,
      arany: getComputedStyle(document.querySelector('main .gomb-arany')).backgroundImage + '|' + getComputedStyle(document.querySelector('main .gomb-arany')).borderRadius,
      hero: getComputedStyle(document.querySelector('main .hero')).backgroundImage,
      kartya: getComputedStyle(document.querySelector('main .alkalmas-kartya, main .elony-kartya')).borderRadius,
      helyszin: getComputedStyle(document.querySelector('main .helyszin')).backgroundColor,
      gyik: getComputedStyle(document.querySelector('main .harmonika-racs summary')).backgroundColor + '|' + getComputedStyle(document.querySelector('main .harmonika-racs details')).backgroundColor,
    });
    const a = await nyit(nev), b = await nyit('lezeres-szortelenites-budapest');
    const ja = await a.p.evaluate(jellemzok), jb = await b.p.evaluate(jellemzok);
    // a hero hatterkep (gradiens), a testszin, a cim-betu, az arany gomb, a kartyak, a helyszin, a GYIK: ugyanaz, mint a mintaoldalon
    assert.deepEqual(ja, jb);
    // a komponensek ott vannak: hero, arany gombok, harmonika-GYIK, helyszin, Trustindex-doboz
    for (const sel of ['.hero .hero-kep img', '.gomb.gomb-arany', '.harmonika-racs details', '.helyszin .hely-sor', '#trustindex', '.kedv-sor', '.rombusz']) assert.ok(await a.p.locator(sel).count() > 0, sel);
    await a.ctx.close(); await b.ctx.close();
  });

  test('a regi oldal MINDEN szovege, kepe, linkje megvan (tartalom-hűseg): sorok, gombok, arkartyak, GYIK, kepek', async () => {
    const sorok = folyam();
    const { p, ctx } = await nyit(nev);
    const uj = norm(await p.evaluate(() => document.querySelector('main').innerText + ' ' + [...document.querySelectorAll('main .gyik details')].map((d) => d.textContent).join(' ')));
    const hianyzo = [];
    for (const s of sorok) {
      if (!['SZ', 'H1', 'H2', 'H3', 'H4', 'GOMB'].includes(s.t)) continue;
      const sz = norm(szovegbol(s.raw).replace(/(\d) \.(\d{3})/g, '$1.$2'));   // a kinyero "68 .000"-et ad "68.000" helyett
      if (!sz) continue;
      if (s.t === 'GOMB' && /^\d+\. .*\?$/.test(szovegbol(s.raw).trim())) continue;   // GYIK-kerdes: lent kulon, a gyik.js valaszaival egyutt
      if (!uj.includes(sz)) hianyzo.push(szovegbol(s.raw).slice(0, 90));
    }
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg');
    // kepek: a regi HTML MINDEN tartalmi kepe (fejlec / ikonok nelkul) az uj oldalon
    const regiHtml = olvas(`klon/${nev}.html`);
    const eleje = regiHtml.indexOf('81f16bfc67fb');
    // a "brutalis-simasag" (d25d1e56510f) a regi oldalon a konzultacio- es a "felejtsd el a pengét" doboz TAKART hatterkepe (a latszo kep a doboz bal oldali csempeje): nem kerul az uj oldalra
    const azonosito = [...new Set([...regiHtml.slice(eleje).matchAll(/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})[0-9a-f]{8,}\.(?:jpe?g|png|webp)/g)].map((m) => m[1]))].filter((k) => k !== 'd25d1e56510f');
    assert.ok(azonosito.length >= 33, 'a regi oldal kepeinek listaja: ' + azonosito.length);
    const html = await p.content();
    assert.deepEqual(azonosito.filter((k) => !html.includes(k)), [], 'hianyzo kepek (a regi oldal HTML-je szerint)');
    // linkek
    const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    const regiLinkek = sorok.filter((s) => s.t === 'GOMB').map((s) => /\s->\s+(\S+)\s*$/.exec(s.raw)?.[1]).filter(Boolean);
    assert.deepEqual([...new Set(regiLinkek)].filter((h) => !hrefek.includes(h)), [], 'hianyzo linkek');
    // arkartyak: 2 csomag + 4 testresz-csoport (3 + 3 + 4 + 3 sor)
    assert.equal(await p.locator('.fl-csomag').count(), 2);
    assert.equal(await p.locator('.fl-tr-csoport').count(), 4);
    assert.equal(await p.locator('.fl-tr-tetel').count(), 13, 'HAT / MELL / HAS 3 + ARC 3 + TEST 4 + 2 LAB 3 sor');
    assert.equal(await p.locator('.kedv-sor, .fl-promo').count() >= 12, true, 'a "20% majusi kedvezmennyel!" sorok');
    assert.equal(await p.locator('[data-video]').count(), 0, 'a ferfi oldalon nincs video');
    // Trustindex: a minta-oldal (/lezeres-szortelenites-budapest) csuszkas widgetje (a regi oldal 8a7562c4... widgetje lebego tipusu, nagy ures teruletet hagyna; ugyanazok a Google-velemenyek)
    assert.equal(await p.getAttribute('#trustindex', 'data-embed'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    const gy = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])['c2eb0f_7101a51e50aef2435d5ed679e90074d4'];
    const kerdesek = await p.$$eval('main .gyik details', (l) => l.map((d) => ({ k: d.querySelector('summary').textContent.trim(), v: d.querySelector('.gy-valasz').textContent })));
    assert.equal(kerdesek.length, gy.length);
    gy.forEach(([k, v], i) => { assert.equal(kerdesek[i].k, k); assert.equal(norm(kerdesek[i].v), norm(v.replace(/<[^>]*>/g, ''))); });
    await ctx.close();
  });

  test('FUGGETLEN tartalom-hűseg: a regi oldal HTML-jenek MINDEN szovegcsomopontja megvan az uj oldalon - csak a fejlec / menu / info-panel szovegei hianyozhatnak', async () => {
    const t = olvas(`klon/${nev}.html`).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>/g, '');
    const nyers = [...t.matchAll(/>([^<>]{12,})</g)].map((m) => m[1]);
    const { p, ctx } = await nyit(nev);
    const csomok = (await p.evaluate((l) => l.map((x) => { const e = document.createElement('textarea'); e.innerHTML = x; return e.value.trim(); }), nyers)).filter(Boolean);
    const gyik = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])['c2eb0f_7101a51e50aef2435d5ed679e90074d4'].map(([k, v]) => k + ' ' + v.replace(/<[^>]*>/g, ' ')).join(' ');
    const uj = norm(await p.evaluate(() => document.body.textContent) + ' ' + (await p.title()) + ' ' + gyik);
    const FEJLEC = /^(ÚJ! - 4 kezes Headspa!|Páros Head Spa|Head Spa Férfiaknak|Head Spa Csomagok és Árak|Head Spa - 20% OKTÓBERI kedvezmény!|Head Spa Vélemények|Fodrászat Árak|Októberi akció!.*|<script defer async src=.*|bottom of page|A LEGFONTOSABB INFÓK|📌 1023 Budapest.*|🕛 Hétfő - Péntek.*|Árlista, csomagok, foglalás|📅 Head Spa kezelések árai.*)$/;
    const hianyzo = csomok.filter((c) => !FEJLEC.test(c) && norm(c).length >= 8 && !uj.includes(norm(c)));
    assert.ok(csomok.length > 200, 'a regi oldal szovegcsomopontjai: ' + csomok.length);
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg az ujban');
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

  test('mukodes: a szalon-kepek racsa (9 kep); a GYIK harmonika nyilik (10 kerdes, a regi valaszokkal); a terkep-gomb betolti a terkepet; a Trustindex-keret betoltodik; a foglalo-gombok linkje valtozatlan', async () => {
    const { p, ctx } = await nyit(nev);
    assert.equal(await p.locator('.fl-szalon-racs figure img').count(), 9, 'szalon-galeria: 9 kep');
    assert.equal(await p.locator('.korhinta').count(), 0, 'nincs regi korhinta');
    const elso = p.locator('.gyik details').first();
    await elso.locator('summary').scrollIntoViewIfNeeded();
    await elso.locator('summary').click();
    assert.equal(await elso.evaluate((d) => d.open), true);
    assert.match(await elso.locator('.gy-valasz').innerText(), /Crystal Freeze/);
    const utolso = p.locator('.gyik details').last();
    await utolso.locator('summary').click();
    assert.match(await utolso.locator('.gy-valasz').innerText(), /SZIGORÚAN TILOS/);
    assert.match(await p.locator('#terkep-hely').innerText(), /Térkép: a tartalom külső szolgáltatótól \(Google\) töltődik be\./);
    await p.locator('#terkep-gomb').scrollIntoViewIfNeeded();
    await p.locator('#terkep-gomb').click();
    await p.waitForSelector('#terkep iframe', { timeout: 3000 });
    // a Trustindex az azonos eredetu embed-fajlt iframe-ben tolti (a kulso loader a tesztben le van tiltva)
    assert.equal(await p.locator('#trustindex iframe.ti-keret').count(), 1);
    assert.match(await p.getAttribute('#trustindex iframe.ti-keret', 'src'), /\/assets\/embed\/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6\.html$/);
    const foglal = await p.$$eval('main a[href^="/foglalo-motor"]', (l) => l.map((a) => a.getAttribute('href')));
    assert.ok(foglal.includes('/foglalo-motor?business=laser'), 'foglalo-link');
    assert.ok(foglal.length >= 14, 'a regi oldal foglalo-gombjai: ' + foglal.length);
    assert.deepEqual([...new Set(foglal)], ['/foglalo-motor?business=laser'], 'minden foglalo-gomb a regi oldal linkjere mutat (nincs naptar / Salonic-link: a foglalasi folyamat valtozatlan)');
    assert.equal(await p.locator('#foglalas, #foglalo, #arlista, #szamolo, a[data-terulet]').count(), 0, 'a noi landing arlistaja / kalkulatora / idopont-valasztoja nincs az oldalon');
    await ctx.close();
  });

  for (const szeles of [390, 360]) {
    test(`telefon (${szeles} px): nincs vizszintes gorgetes, a kepek nem lognak ki, a kartyak olvashatok`, async () => {
      const { p, ctx } = await nyit(nev, { szeles });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'vizszintes tobblet');
      const kilog = await p.$$eval('main img', (l) => l.filter((i) => !i.closest('.korhinta') && i.getBoundingClientRect().right > innerWidth + 1).map((i) => i.currentSrc.split('/').pop()));
      assert.deepEqual(kilog, [], 'kikilogo kepek');
      assert.ok(await p.locator('.fl-csomag').first().isVisible());
      assert.ok(await p.locator('.fl-tr-csoport').first().isVisible());
      await ctx.close();
    });
  }
});
