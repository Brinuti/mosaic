// A "Vegleges lezeres szortelenites ferfiaknak" oldal (vegleges-szortelenites-ferfiaknak) bongeszos tesztjei (Playwright): a /lezeres-szortelenites-budapest landing stilusaban + komponenseivel
// (assets/css/lezer-landing.css + assets/css/lezer-ferfi-landing.css + assets/js/lezer-ferfi.js), 2026-10-20 (Feri visszajelzese) utan atalakitva.
// Ket resz: (1) a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs; nincs dist/, nincs kulso halozat): tartalom, stilus, szerkezet, mobil, galeria, belso gorgetes;
// (2) a helyi dist/ (build utan: CF_PAGES=1 CF_PAGES_BRANCH=<ag> node tools/netlify-build.mjs): fejlec / Info-ablak / lablec gombjai (mh-foglalas / mh-nyitvatartas jelolo) + a foglalo-reteg megnyilik.
//   A dist-es resz kimarad (skip), ha a dist/_a/vegleges-szortelenites-ferfiaknak.html nincs meg.
//
//   node --test tools/ujrastilus-teszt/lezer-ferfi.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
// A tartalom-hűseg (a regi oldal szovege, kepei, linkjei) a forras/<kulcs>.folyam.txt-bol (a regi oldal kinyert tartalma) es a regi oldal HTML-jebol (klon/<nev>.html) ellenorzodik; az egyetlen
// megengedett elterest a CSERE / ELTAVOLITVA tablak sorolja fel (Feri kerese: majusi -> oktoberi, nyari -> karacsonyi, 1 ev -> 12 honap, evek -> 8000+ ora, arak, elirasok).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';
import { fajlUtvonal } from '../serve-dist.mjs';

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
const FOCTA = '/foglalo-motor?business=laser&service=konzult';
const MASODLAGOS = '/foglalo-motor?business=laser';
const MAPS_KULSO = 'https://www.google.com/maps/search/?api=1&query=MOSAIC%20Head%20Spa%2C%201023%20Budapest%2C%20B%C3%A9csi%20%C3%BAt%202.';
let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
const forras = () => olvas(`foglalas/${NEV}.html`);
const szovegbol = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
// betuk es szamok kisbetuvel: a tagolas / irasjelek / emojik / athuzas-jelek kulonbsegei nem szamitanak
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[\u0336\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200d\u200b\u00a0]/gu, '').replace(/[^\p{L}\p{N}]+/gu, '')
  // a Google-ertekelesek szama elo adat (assets/js/google-szam.js): a regi oldal beegetett szama (831 / 971 ...) nem kell hogy egyezzen
  .replace(/google49(?:5)?\d{3,4}(?=ertekeles|értékelés|velemeny|vélemény)/g, 'google49N');

async function nyit(nev, { szeles = 1440, magas, bazisUrl = bazis } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: magas || (mobil ? 844 : 900) }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], nincs = [], kulso = [], keresek = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazisUrl)) nincs.push(r.status() + ' ' + r.url().replace(bazisUrl, '')); });
  p.on('request', (r) => keresek.push(r.url()));
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${bazisUrl}/${encodeURI(nev)}`, { waitUntil: 'domcontentloaded' });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  return { p, ctx, hibak, nincs, kulso, keresek };
}
async function betoltMind(p) {
  await p.evaluate(async () => {
    document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
  });
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.evaluate(() => document.fonts && document.fonts.ready);
}

// ---- a regi oldal tartalma: a Feri-kerte valtoztatasok (egyetlen engedett elteres) ----
// CSERE: [regi szoveg (regex), uj szoveg]: a regi oldal szovegere alkalmazva, utana az UJ oldalnak tartalmaznia kell
const CSERE = [
  [/20% májusi kedvezménnyel/g, '20% októberi kedvezménnyel'],
  [/Több mint 3 év és 8\.000\+ óra tapasztalattal/g, '8.000+ óra tapasztalattal'],
  [/4 év és 8000\+ óra tapasztalat után/g, '8000+ óra tapasztalat után'],
  [/4 év tapasztalattal és 1 év garanciával/g, '8000+ óra tapasztalattal és 12 hónap garanciával'],
  [/több mint 3 év tapasztalattal/g, '8000+ óra tapasztalat'],
  [/kattinta foglalhatsz/g, 'kattintva foglalhatsz'],
  [/Nem kelll megvenned/g, 'Nem kell megvenned'],
  [/Hónalj 8 alkalom: 96\.000 Ft/g, 'Hónalj 8 alkalom: 114.000 Ft'],
  [/Ha külön vennéd: 99\.000 Ft \/ alk\./g, 'Ha külön vennéd (a váll nélkül): 119.000 Ft / alk.'],
  [/Csomagkedvezmény: 32\.000 Ft/g, 'Csomagkedvezmény: 51.000 Ft'],
  [/8 alkalmas bérletben csak 6 alkalmat fizetsz/g, '8 alkalmas programban csak 6 alkalmat fizetsz'],
  [/szakember végzik/g, 'szakember végzi'],
  // a sorszam (1. / 2. / 3.) a kedvezmeny-kartyakon kulon jelveny (20% / 50% / 4. + 8.)
  [/^\d\.\s*(?=Az első alkalommal|A Csomagok érik|A 8-ból 2 alkalom)/g, ''],
  [/valósítják meg/g, 'valósítja meg'],
  // a nyari ajanlat karacsonyi lett
  [/Ha most belevágsz nyárra elfelejtheted a gyantát!/g, 'Ha most belevágsz, karácsonyra elfelejtheted a gyantát és a borotvát!'],
  [/A gondtalan nyár nem júniusban kezdődik, hanem most\./g, 'A gondtalan karácsony nem decemberben kezdődik, hanem most.'],
  [/Legyél nyárra a legjobb formádban/g, 'Legyél karácsonyra a legjobb formádban'],
  [/hogy nyáron már ne legyen vele gondod/g, 'hogy az ünnepek alatt már ne legyen vele gondod'],
  [/Kezdd el most, hogy nyáron már csak a lazítással foglalkozhass!/g, 'Kezdd el most, hogy karácsonykor már csak a lazítással foglalkozhass!'],
];
// ELTAVOLITVA: a regi oldal szovegei, amelyek szandekosan mashogy vannak (kulon tesztelve): a hero Google-ertekeles sora (a jelenlegi, belso gorgetos jelveny), a szombati nyitvatartas
const ELTAVOLITVA = [/^Google 4,9 - \d+ értékelés$/, /Szombat: 8:00 – 20:00/, /Vasárnap: ZÁRVA/, /^(Szombat|Vasárnap|ZÁRVA)$/,
  /^Megnyitás a Google Térképen$/];   // a terkep-blokk gombja "Utvonaltervezes" lett (a Trustindex betolto-tartaleka a HTML-ben megmarad, de a betoltes utan a keret helyettesiti)
const regiCsere = (s) => CSERE.reduce((acc, [re, uj]) => acc.replace(re, uj), s);
// a regi oldal kinyert sorai: { t: tipus, raw }
function folyam() {
  return olvas('tools/lezer-variansok/forras/ferfi.folyam.txt').split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^\s*\d+\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x-?\d+\s+w\d+\s*(?:h\d+)?\s*(.*)$/.exec(l);
    return { t: m[1], raw: m[2] };
  });
}
const folyamSzoveg = (html) => html.replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '').replace(/\s+->\s+\S+\s*$/, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');

describe(`/${NEV} (tartalom, stilus, linkek)`, () => {
  const nev = NEV;
  test('betoltodik hibak nelkul: egyetlen H1, title / description / canonical, INDEXELHETO (a regi sem volt noindex), nincs torott kep / 404 / konzol-hiba; a hero kep elotoltve, a tobbi kep lusta; nincs meroKod', async () => {
    const { p, ctx, hibak, nincs } = await nyit(nev);
    const title = await p.title(), desc = await p.getAttribute('meta[name="description"]', 'content');
    assert.equal(title, 'Lézeres szőrtelenítés Budapesten - Férfiaknak');
    assert.ok(title.length <= 60, 'title <= 60: ' + title.length);
    assert.equal(desc, 'Elysion Pro lézeres szőrtelenítés férfiaknak: 8 alkalomból 6-ot fizetsz, 12 hónap garancia, 8000+ óra tapasztalat.');
    assert.ok(desc.length <= 155, 'description <= 155: ' + desc.length);
    assert.equal(await p.getAttribute('meta[property="og:description"]', 'content'), desc);
    assert.doesNotMatch(desc + title, /\b[34] év|több mint 3/i, 'nincs evekben megadott tapasztalat (megerosites nelkul)');
    assert.equal(await p.getAttribute('link[rel="canonical"]', 'href'), 'https://www.mosaicheadspa.hu/vegleges-szortelenites-ferfiaknak');
    assert.equal(await p.locator('meta[name="robots"]').count(), 0, 'nincs robots meta (a regi oldal indexelheto volt)');
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.ok(norm(await p.textContent('h1')).includes(norm(EGYEDI)), 'a H1 az oldal hero-cime');
    await betoltMind(p);
    assert.equal(await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc)).then((l) => l.length), 0, 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.equal(await p.locator('main [id^="comp-"]:not(a)').count(), 0, 'nincs Wix-maradvany');
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    const src = forras();
    assert.match(src, /<link rel="preload" href="\/assets\/img\/c2eb0f_ed3e3ce785064556bc644c86c7777436\.jpg" as="image" fetchpriority="high">/);
    assert.equal(await p.locator('.hero-kep img[fetchpriority="high"]').count(), 1);
    assert.deepEqual(await p.$$eval('main img', (l) => l.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.getAttribute('src'))), [], 'width / height nelkuli kepek');
    const nemLusta = [...src.matchAll(/<img\s[^>]*>/g)].map((m) => m[0]).filter((t) => !/loading="lazy"/.test(t)).map((t) => /src="([^"]*)"/.exec(t)[1]);
    assert.deepEqual(nemLusta, ['/assets/img/c2eb0f_ed3e3ce785064556bc644c86c7777436.jpg'], 'nem lusta kepek: csak a hero-kep');
    // nincs meroKod / nyomkovetes az oldalon (a suti.js utvonal-alapu; az oldal neve ugyanaz)
    assert.doesNotMatch(src.replace(/<!--[\s\S]*?-->/g, ''), /data-cta|dataLayer|gtag\(|fbq\(|ttq\.|googletagmanager|connect\.facebook|connect\.tiktok/);
    const js = olvas('assets/js/lezer-ferfi.js').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(js, /dataLayer|gtag|fbq|ttq|fetch\(|XMLHttpRequest|sendBeacon|pushState|replaceState|location\.hash|location\.href\s*=/, 'a sajat szkript nem mero-kod, nem ir URL-t');
    await ctx.close();
  });

  test('STILUS: a /lezeres-szortelenites-budapest landing komponensei (lezer-landing.css) + a sajat kiegeszito CSS / JS; NEM a regi rendszer (headspa-oldal.css / lezer-variansok.css); a szinek / betuk / gombok azonosak a mintaoldaleval', async () => {
    const src = forras();
    assert.ok(src.includes('<link rel="stylesheet" href="/assets/css/lezer-landing.css">'), 'lezer-landing.css');
    assert.ok(src.includes('<link rel="stylesheet" href="/assets/css/lezer-ferfi-landing.css">'), 'lezer-ferfi-landing.css');
    assert.ok(src.indexOf('lezer-landing.css') < src.indexOf('lezer-ferfi-landing.css'), 'a kiegeszito CSS a minta CSS UTAN toltodik be');
    assert.doesNotMatch(src, /headspa-oldal\.css|lezer-variansok\.css/, 'a regi rendszer stilusai nincsenek hasznalatban');
    assert.ok(src.includes('<script src="/assets/js/lezer-ferfi.js" defer></script>'), 'a sajat szkript');
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets/css/lezer-ferfi-landing.css')) && fs.existsSync(path.join(GYOKER, 'assets/js/lezer-ferfi.js')));
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
    assert.deepEqual(ja, jb);
    for (const sel of ['.hero .hero-kep img', '.gomb.gomb-arany', '.harmonika-racs details', '.helyszin .hely-sor', '#trustindex', '.kedv-sor', '.rombusz', '.alkalmak li.ajandek']) assert.ok(await a.p.locator(sel).count() > 0, sel);
    await a.ctx.close(); await b.ctx.close();
  });

  test('FERI KERESE: nincs "majus / majusi" (13 helyen "20% oktoberi kedvezmennyel"), nincs "1 ev garancia" (12 honap garancia), nincs evekben megadott tapasztalat (8000+ ora), a nyari ajanlat KARACSONYI, a regi nyari szoveg nincs, nincs [MEGERŐSÍTENDŐ] / helyorzo / /idpontfoglalas link', async () => {
    const src = forras();
    const szoveg = szovegbol(src);
    assert.doesNotMatch(szoveg, /máj(?:us|i)/i, 'nincs majusi kedvezmeny');
    assert.equal((szoveg.match(/20% októberi kedvezménnyel!/g) || []).length, 13, 'a 13 korabbi "majusi" hely mind "oktoberi" (hero, garancia, Zsofi, alkalmankent, 2 csomag, 4 testresz, karacsonyi, SZEP, helyszin)');
    assert.doesNotMatch(szoveg, /\b1 év garancia|1 évig/i);
    assert.doesNotMatch(szoveg, /\b[34] év|több mint 3|3 év/i, 'nincs evekben megadott tapasztalat (megerosites nelkul): helyette 8000+ ora');
    assert.match(szoveg, /12 hónap garanciával/);
    assert.match(szoveg, /8000\+ óra tapasztalattal és 12 hónap garanciával/);
    // a nyari ajanlat karacsonyi
    const karacsony = /<section[^>]*id="ajanlat"[\s\S]*?<\/section>/.exec(src)[0];
    const kSzoveg = szovegbol(karacsony);
    assert.match(kSzoveg, /Ha most belevágsz, karácsonyra elfelejtheted a gyantát és a borotvát!/);
    assert.match(kSzoveg, /A gondtalan karácsony nem decemberben kezdődik, hanem most\./);
    assert.match(kSzoveg, /Legyél karácsonyra a legjobb formádban/);
    assert.match(kSzoveg, /hogy az ünnepek alatt már ne legyen vele gondod/);
    assert.match(kSzoveg, /Kezdd el most, hogy karácsonykor már csak a lazítással foglalkozhass!/);
    assert.doesNotMatch(kSzoveg, /nyár|nyáro|június|napoz/i, 'a karacsonyi blokkban nincs nyari szoveg');
    assert.doesNotMatch(src.replace(/<!--[\s\S]*?-->/g, ''), /Nyár, napfény/, 'a kep alt-ja sem nyari');
    assert.match(kSzoveg, /20% októberi kedvezménnyel! - A csomagokra is!/);
    for (const [re, mi] of [[/megerősítendő/i, '[MEGERŐSÍTENDŐ]'], [/lorem|TODO|FIXME|XXX|helyőrző|Kitöltendő/i, 'helyorzo']]) assert.doesNotMatch(szoveg, re, 'nem szerepelhet: ' + mi);
    assert.doesNotMatch(src.replace(/<!--[\s\S]*?-->/g, ''), /\/idpontfoglalas|mosaic-hair-idopontfoglalas/, 'a regi foglalo-utvonalra nincs link');
    assert.doesNotMatch(src, /megerősítendő/i, 'a forras kommentjeiben sem');
    // elirasok javitva
    for (const re of [/kattinta\b/, /kelll/, /4\.és/, /8\.alkalmat/, /bérletet ,mert/, /szakember végzik/, /valósítják/, /8 alkalmas bérletben/, /\.Amennyiben/, /<b>Nincs kapkodás:<\/b> Figyelek rád így/]) assert.doesNotMatch(src, re, 'javitott elires: ' + re);
    // a fejlec / lablec foglalasi cel, nyitvatartas
    assert.match(src, /<!--mh-foglalas:business=laser-->/, 'fejlec / Info-ablak / lablec az adott uzletag foglalojara');
    assert.match(src, /<!--mh-nyitvatartas:hetkoznap-->/, 'a nyitvatartas csak H-P (a szombat megerositesre var)');
    assert.doesNotMatch(szoveg, /szombat|vasárnap/i, 'az oldal torzsebenek nyitvatartasaban nincs szombat (megerosites nelkul)');
    assert.match(szoveg, /Hétfő - Péntek: 8:00 – 20:00/);
    // arak: a fo oldal (/lezeres-szortelenites-budapest) arlistajahoz igazitva
    assert.match(szoveg, /Hónalj 8 alkalom: 114\.000 Ft/);
    assert.match(szoveg, /Ha külön vennéd \(a váll nélkül\): 119\.000 Ft \/ alk\./);
    assert.match(szoveg, /Csomagkedvezmény: 51\.000 Ft/);
    const fo = olvas('foglalas/lezeres-szortelenites-budapest.html');
    for (const [kulcs, db] of [['honalj', '19000'], ['hat', '36000'], ['mellkas', '32000'], ['has', '32000'], ['bajusz', '12000'], ['all', '12000'], ['arc', '30000'], ['alkar', '24000'], ['felkar', '24000'], ['kar', '42000'], ['szar', '35000'], ['comb', '35000'], ['lab', '59000'], ['mantotal', '68000']]) {
      assert.match(fo, new RegExp(`data-kulcs="${kulcs}"[^>]*data-ar="${db}"`), 'a fo oldal arlistaja: ' + kulcs);
    }
    const ft = (n) => n.toLocaleString('hu-HU').replace(/\s/g, '.').replace(/\u00a0/g, '.');
    for (const [nevS, alk] of [['Férfi hát', 36000], ['Férfi mellkas', 32000], ['Férfi has', 32000], ['Bajusz', 12000], ['Áll', 12000], ['Teljes arc', 30000], ['Hónalj', 19000], ['Alkar', 24000], ['Felkar', 24000], ['Teljes kar', 42000], ['Lábszár', 35000], ['Comb', 35000], ['Teljes láb', 59000]]) {
      assert.ok(szoveg.includes(`${nevS} alkalmi: ${ft(alk)} Ft`), nevS + ' alkalmi');
      assert.ok(szoveg.includes(`${nevS} 8 alkalom: ${ft(alk * 6)} Ft`), nevS + ' 8 alkalom = 6 x alkalmi');
    }
    assert.match(szoveg, /Ár: 68\.000 Ft \/ alkalom/);
  });

  test('a regi oldal MINDEN szovege, kepe, linkje megvan (tartalom-hűseg) - az egyetlen megengedett elteres a CSERE / ELTAVOLITVA tabla (Feri kerese)', async () => {
    const sorok = folyam();
    const { p, ctx } = await nyit(nev);
    const uj = norm(await p.evaluate(() => document.querySelector('main').innerText + ' ' + [...document.querySelectorAll('main .gyik details')].map((d) => d.textContent).join(' ')));
    const hianyzo = [];
    for (const s of sorok) {
      if (!['SZ', 'H1', 'H2', 'H3', 'H4', 'GOMB'].includes(s.t)) continue;
      const nyers = folyamSzoveg(s.raw).replace(/(\d) \.(\d{3})/g, '$1.$2');   // a kinyero "68 .000"-et ad "68.000" helyett
      if (ELTAVOLITVA.some((re) => re.test(nyers.trim()))) continue;
      const sz = norm(regiCsere(nyers));
      if (!sz) continue;
      if (s.t === 'GOMB' && /^\d+\. .*\?$/.test(nyers.trim())) continue;   // GYIK-kerdes: lent kulon, a GYIK-valaszokkal egyutt
      if (!uj.includes(sz)) hianyzo.push(nyers.slice(0, 90));
    }
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg (a CSERE tablaval egyutt is)');
    // kepek: a regi HTML MINDEN tartalmi kepe az uj oldalon, kiveve a szandekosan lecserelteket
    const regiHtml = olvas(`klon/${nev}.html`);
    const eleje = regiHtml.indexOf('81f16bfc67fb');
    // "brutalis-simasag" (d25d1e56510f): a regi oldal konzultacio- es "felejtsd el a penget" dobozanak TAKART hatterkepe. Lecserelt: a Wixes ertekeles-csillag (81f16bfc67fb: szoveges csillagok),
    // a konzultacio Zsofi-fotoja (1aa35b8ff0f4: helyette a Zsofi-video), a nagy ARGARANCIA pecset (bfd0d4397 9b2) es a ket infografika (4afa5a45a0b5, 77ff06afd6e2): helyettuk a fo oldal egyszeru abraja
    // + 0afd6583c982 / 7b41e9e53cc2: a HeadSpa kezelohelyiseg kepei (Feri 2026-10-20: a szortelenites nem ott van) - helyettuk assets/img/lezer-kezelo/* (a lezeres kezelo)
    const LECSERELT = new Set(['d25d1e56510f', '81f16bfc67fb', '1aa35b8ff0f4', 'bfd0d43979b2', '4afa5a45a0b5', '77ff06afd6e2', '0afd6583c982', '7b41e9e53cc2']);
    const azonosito = [...new Set([...regiHtml.slice(eleje).matchAll(/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})[0-9a-f]{8,}\.(?:jpe?g|png|webp)/g)].map((m) => m[1]))].filter((k) => !LECSERELT.has(k));
    assert.ok(azonosito.length >= 28, 'a regi oldal kepeinek listaja: ' + azonosito.length);
    const html = await p.content();
    assert.deepEqual(azonosito.filter((k) => !html.includes(k)), [], 'hianyzo kepek (a regi oldal HTML-je szerint)');
    for (const k of ['bfd0d43979b2', '4afa5a45a0b5', '77ff06afd6e2', '1aa35b8ff0f4']) assert.ok(!html.includes(k), 'a lecserelt kep nincs az oldalon: ' + k);
    // linkek
    const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    const regiLinkek = sorok.filter((s) => s.t === 'GOMB').map((s) => /\s->\s+(\S+)\s*$/.exec(s.raw)?.[1]).filter(Boolean).filter((h) => !/#comp-mlgjpxi2$/.test(h));   // a halott "Mutasd az arakat" link (a noi oldal Wix-horgonya) helyett: gorgetes az arszakaszra
    assert.deepEqual([...new Set(regiLinkek)].filter((h) => !hrefek.includes(h)), [], 'hianyzo linkek');
    // arkartyak: 2 csomag + 4 testresz-csoport (3 + 3 + 4 + 3 sor)
    assert.equal(await p.locator('.fl-csomag').count(), 2);
    assert.equal(await p.locator('.fl-tr-csoport').count(), 4);
    assert.equal(await p.locator('.fl-tr-tetel').count(), 13, 'HAT / MELL / HAS 3 + ARC 3 + TEST 4 + 2 LAB 3 sor');
    assert.equal(await p.locator('.kedv-sor, .fl-promo').count() >= 12, true, 'a "20% oktoberi kedvezmennyel!" sorok');
    // Trustindex: a minta-oldal (/lezeres-szortelenites-budapest) csuszkas widgetje
    assert.equal(await p.getAttribute('#trustindex', 'data-embed'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    // GYIK: a regi 10 kerdes-valasz (assets/js/gyik.js), a Feri-kerte elirasjavitassal ("szakember vegzik" -> "vegzi")
    const gy = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])['c2eb0f_7101a51e50aef2435d5ed679e90074d4'];
    const kerdesek = await p.$$eval('main .gyik details', (l) => l.map((d) => ({ k: d.querySelector('summary').textContent.trim(), v: d.querySelector('.gy-valasz').textContent })));
    assert.equal(kerdesek.length, gy.length);
    gy.forEach(([k, v], i) => { assert.equal(norm(kerdesek[i].k), norm(k)); assert.equal(norm(kerdesek[i].v), norm(regiCsere(v.replace(/<[^>]*>/g, '')))); });
    await ctx.close();
  });

  test('FUGGETLEN tartalom-hűseg: a regi oldal HTML-jenek MINDEN szovegcsomopontja megvan az uj oldalon (CSERE tablaval) - csak a fejlec / menu / info-panel szovegei hianyozhatnak', async () => {
    const t = olvas(`klon/${nev}.html`).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>/g, '');
    const nyers = [...t.matchAll(/>([^<>]{12,})</g)].map((m) => m[1]);
    const { p, ctx } = await nyit(nev);
    const csomok = (await p.evaluate((l) => l.map((x) => { const e = document.createElement('textarea'); e.innerHTML = x; return e.value.trim(); }), nyers)).filter(Boolean);
    const gyik = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])['c2eb0f_7101a51e50aef2435d5ed679e90074d4'].map(([k, v]) => k + ' ' + v.replace(/<[^>]*>/g, ' ')).join(' ');
    const uj = norm(await p.evaluate(() => document.body.textContent) + ' ' + (await p.title()) + ' ' + regiCsere(gyik));
    const FEJLEC = /^(ÚJ! - 4 kezes Headspa!|Páros Head Spa|Head Spa Férfiaknak|Head Spa Csomagok és Árak|Head Spa - 20% OKTÓBERI kedvezmény!|Head Spa Vélemények|Fodrászat Árak|Októberi akció!.*|<script defer async src=.*|bottom of page|A LEGFONTOSABB INFÓK|📌 1023 Budapest.*|🕛 Hétfő - Péntek.*|Árlista, csomagok, foglalás|📅 Head Spa kezelések árai.*)$/;
    const hianyzo = csomok.filter((c) => !FEJLEC.test(c) && !ELTAVOLITVA.some((re) => re.test(c.trim())) && norm(c).length >= 8 && !uj.includes(norm(regiCsere(c))) && !/^Elysion Pro lézeres szőrtelenítés árplafonnal/.test(c));
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

  test('FOGLALAS: a hero fo gombja "Ingyenes konzultacio" (&service=konzult), mellette az "Idopontfoglalas"; minden foglalo-gomb csak /foglalo-motor?business=laser (nincs naptar / Salonic-link: a foglalasi folyamat valtozatlan); nincs a noi arlista / kalkulator', async () => {
    const { p, ctx } = await nyit(nev);
    const hero = await p.$$eval('.fl-hero-cta a', (l) => l.map((a) => [a.textContent.replace(/\s+/g, ' ').trim(), a.getAttribute('href'), a.className]));
    assert.deepEqual(hero.map((x) => x.slice(0, 2)), [['Ingyenes konzultáció →', FOCTA], ['Időpontfoglalás →', MASODLAGOS]]);
    assert.match(hero[0][2], /gomb-arany/, 'a fo gomb arany'); assert.match(hero[1][2], /gomb-korvonal/, 'a masodik kontur-gomb');
    const foglal = await p.$$eval('main a[href^="/foglalo-motor"], .sticky-cta a[href^="/foglalo-motor"]', (l) => l.map((a) => a.getAttribute('href')));
    assert.ok(foglal.length >= 14, 'foglalo-gombok: ' + foglal.length);
    assert.deepEqual([...new Set(foglal)].sort(), [MASODLAGOS, FOCTA].sort(), 'csak a ket megengedett foglalo-link');
    assert.equal(await p.locator('#foglalas, #foglalo, #arlista, #szamolo, a[data-terulet]').count(), 0, 'a noi landing arlistaja / kalkulatora / idopont-valasztoja nincs az oldalon');
    // a kulso Salonic-link nincs
    assert.equal(await p.locator('a[href*="salonic"]').count(), 0);
    await ctx.close();
  });

  test('NINCS kivezeto Google-ertekeles / Terkep link: a hero / velemeny-blokk NEM visz ki; csak a terkep-blokk "Utvonaltervezes" gombja (es a Trustindex betolto-tartaleka) mutat a Google Terkepre; NINCS #horgony-link (GTM History Change)', async () => {
    const src = forras();
    const html = src.replace(/<!--[\s\S]*?-->/g, '');
    assert.doesNotMatch(html, /maps\.app\.goo\.gl|g\.page|search\.google\.com|google\.com\/search|share\.google/, 'nincs Google-profil / ertekeles link');
    const maps = [...html.matchAll(/<a\b[^>]*href="([^"]*google\.com\/maps[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1].replace(/&amp;/g, '&'), m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()]);
    assert.deepEqual(maps, [[MAPS_KULSO, 'Megnyitás a Google Térképen'], [MAPS_KULSO, 'Útvonaltervezés →']], 'csak a Trustindex betolto-tartaleka es a terkep-blokk Utvonaltervezes gombja');
    assert.equal(maps.length, 2);
    assert.match(html, /<div class="ti-hely" id="ti-hely">[\s\S]*?Megnyitás a Google Térképen[\s\S]*?<\/div>/, 'az egyik a Trustindex tartaleka');
    assert.match(html, /<div class="hely-gombok">[\s\S]*?Útvonaltervezés[\s\S]*?<\/div>/, 'a masik a terkep-blokk gombja');
    assert.equal((html.match(/href="#/g) || []).length, 0, 'nincs #horgony-link: a belso gorgetes [data-gorget] gomb (a GTM History Change minden hash-valtozasra merest inditana)');
    // a hero ertekeles-sor / "Mutasd az arakat" / hely-sor gomb
    const { p, ctx } = await nyit(NEV);
    assert.equal(await p.locator('.hero a[href]').count(), 2, 'a hero-ban csak a ket foglalo-gomb link');
    const g = await p.$$eval('.hero button[data-gorget]', (l) => l.map((b) => [b.dataset.gorget, b.type]));
    assert.deepEqual(g, [['velemenyek', 'button'], ['csomagarak', 'button'], ['terkep', 'button']]);
    for (const id of ['velemenyek', 'csomagarak', 'terkep']) assert.equal(await p.locator('#' + id).count(), 1, 'a gorgetes celja letezik: #' + id);
    assert.match(await p.getAttribute('.hero .google-nagy', 'aria-label'), /Google-értékelés/);
    assert.match(await p.textContent('.hero .google-nagy'), /4,9\/5\s*★★★★★\s*\d[\d\s\u00a0]*Google-értékelés/);
    assert.match(await p.textContent('.fl-hely'), /1023 Bécsi út 2 \(A Kolosy térnél\)/);
    assert.ok(await p.locator('.velemenyek a[href]').count() <= 1, 'a velemeny-blokkban legfeljebb a Trustindex tartalek-link van (betoltes utan a keret helyettesiti)');
    assert.equal((/<section class="velemenyek"[\s\S]*?<\/section>/.exec(forras())[0].match(/<a\b/g) || []).length, 1, 'a forrasban csak a Trustindex tartalek-link');
    await ctx.close();
  });

  for (const [id, hol] of [['velemenyek', 'a Google-velemenyek (Trustindex) blokkja'], ['csomagarak', 'az ar-szakasz'], ['terkep', 'a terkep-blokk']]) {
    test(`BELSO GORGETES: a hero [data-gorget="${id}"] gombja ${hol}ra gorget; az URL / hash / history NEM valtozik, nincs navigacio / uj lap, a cel fejlecere kerul a fokusz`, async () => {
      for (const szeles of [1440, 390]) {
        const { p, ctx } = await nyit(NEV, { szeles });
        await p.waitForLoadState('networkidle').catch(() => {});
        const elotte = await p.evaluate(() => ({ url: location.href, hist: history.length, y: scrollY }));
        const lapok = []; ctx.on('page', (x) => lapok.push(x));
        const gomb = p.locator(`.hero button[data-gorget="${id}"]`);
        await gomb.scrollIntoViewIfNeeded();
        await gomb.click();
        await p.waitForTimeout(1400);
        const utana = await p.evaluate((i) => {
          const c = document.getElementById(i), f = document.activeElement;
          return { url: location.href, hash: location.hash, hist: history.length, y: scrollY, top: Math.round(c.getBoundingClientRect().top), foksz: f && f.tagName, fokuszSzekcio: !!(f && c.closest('section') && c.closest('section').contains(f)) };
        }, id);
        assert.equal(utana.url, elotte.url, szeles + ' px: az URL nem valtozik');
        assert.equal(utana.hash, '', 'nincs hash');
        assert.equal(utana.hist, elotte.hist, 'a history nem valtozik (nincs pushState / hash-navigacio)');
        assert.equal(lapok.length, 0, 'nincs uj lap');
        assert.ok(utana.y > 100, 'lejjebb gorgetett (' + utana.y + ')');
        assert.ok(utana.top >= -2 && utana.top <= 260, szeles + ' px: a cel a kepernyo tetejen latszik: ' + utana.top);
        assert.equal(utana.foksz, 'H2', 'a cel fejlecere (h2) kerul a fokusz');
        assert.ok(utana.fokuszSzekcio, 'a fokuszalt h2 a cel szekciojaban van');
        await ctx.close();
      }
    });
  }

  test('BELSO GORGETES: a "Gorgess lejjebb az arlistankhoz!" is gomb (nem hash-link) az ar-szakaszra gorget; minden [data-gorget] cel letezik', async () => {
    const { p, ctx } = await nyit(NEV);
    const celok = await p.$$eval('[data-gorget]', (l) => l.map((b) => [b.tagName, b.dataset.gorget]));
    assert.ok(celok.length >= 4 && celok.every(([t]) => t === 'BUTTON'), 'mind gomb: ' + JSON.stringify(celok));
    for (const [, c] of celok) assert.equal(await p.locator('#' + c).count(), 1, '#' + c);
    const b = p.locator('.fl-gorget-sor [data-gorget="csomagarak"]');
    await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(1400);
    assert.equal(await p.evaluate(() => location.hash), '');
    assert.ok(await p.evaluate(() => Math.abs(document.getElementById('csomagarak').getBoundingClientRect().top) < 260));
    await ctx.close();
  });

  test('HERO (asztali): a harom jelveny ("8 alkalom elég", "2 ajandek", "berlet helyett alkalmankent fizetsz") EGYMAS MELLETT, egy sorban (1440 / 1280 / 1100 / 1024 px)', async () => {
    for (const szeles of [1440, 1280, 1100, 1024]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      await betoltMind(p);
      const r = await p.$$eval('.fl-jelvenyek-sor li', (l) => l.map((x) => { const b = x.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), t: x.textContent.replace(/\s+/g, ' ').trim() }; }));
      assert.deepEqual(r.map((x) => x.t), ['8 alkalom elég', '2 ajándék', 'bérlet helyett alkalmanként fizetsz']);
      assert.ok(r.every((x) => Math.abs(x.top - r[0].top) <= 2), szeles + ' px: egy sorban: ' + JSON.stringify(r.map((x) => x.top)));
      assert.ok(r[0].right <= r[1].left && r[1].right <= r[2].left, 'egymas mellett, nem fedik egymast');
      assert.ok(r[2].right <= szeles, 'nem log ki');
      await ctx.close();
    }
  });

  for (const szeles of [412, 390, 360]) {
    test(`HERO (mobil ${szeles} px): sorrend CIM -> KEP -> alcim -> jelvenyek -> gombok -> kedvezmeny -> ertekeles -> hely; a harom jelveny egymas mellett, KOZEPEN, a feliratok nem torik arva-sorra; nincs vizszintes gorgetes`, async () => {
      const { p, ctx } = await nyit(NEV, { szeles });
      await betoltMind(p);
      const top = async (sel) => p.$eval(sel, (e) => Math.round(e.getBoundingClientRect().top));
      const t = { h1: await top('.hero h1'), kep: await top('.hero-kep'), alcim: await top('.hero-al'), jel: await top('.fl-jelvenyek-sor'), gomb: await top('.fl-hero-cta'), kedv: await top('.fl-hero .kedv-sor'), ert: await top('.hero-ertekeles'), hely: await top('.fl-hely') };
      assert.ok(t.h1 < t.kep && t.kep < t.alcim && t.alcim < t.jel && t.jel < t.gomb && t.gomb < t.kedv && t.kedv < t.ert && t.ert < t.hely, 'sorrend: ' + JSON.stringify(t));
      const r = await p.$$eval('.fl-jelvenyek-sor li', (l) => l.map((x) => { const b = x.getBoundingClientRect(); const s = x.querySelector('b'); const sorok = new Set([...s.getClientRects()].map((q) => Math.round(q.top))).size; return { top: Math.round(b.top), left: b.left, right: b.right, sorok, w: Math.round(b.width) }; }));
      assert.equal(r.length, 3);
      assert.ok(r.every((x) => Math.abs(x.top - r[0].top) <= 2), 'egymas mellett, egy sorban');
      assert.ok(Math.abs(r[0].left - (szeles - r[2].right)) <= 2, 'kozepre igazitva (bal / jobb margo azonos): ' + r[0].left + ' / ' + (szeles - r[2].right));
      assert.ok(r[0].right <= r[1].left && r[1].right <= r[2].left, 'nem fedik egymast');
      assert.ok(r.every((x) => x.sorok <= 2), 'a feliratok legfeljebb 2 sorosak: ' + JSON.stringify(r.map((x) => x.sorok)));
      // a jelveny-szovegek alatt nincs arva (a sor-tores ellenorzes az osszes rovid szovegre lent)
      const gombok = await p.$$eval('.fl-hero-cta .gomb, .sticky-cta .gomb', (l) => l.map((a) => Math.round(a.getBoundingClientRect().width)));
      assert.ok(gombok[0] > szeles * 0.8 && gombok[1] > szeles * 0.8, 'a hero gombjai teljes szelessegben');
      const kozepe = await p.$$eval('.hero-ertekeles, .fl-hely, .fl-hero .kedv-sor', (l) => l.map((e) => { const q = [...e.children].map((c) => c.getBoundingClientRect()).filter((x) => x.width); const a = Math.min(...q.map((x) => x.left)), b = Math.max(...q.map((x) => x.right)); return Math.abs((a + b) / 2 - innerWidth / 2); }));
      assert.ok(kozepe.every((d) => d <= 6), 'az ertekeles / kedvezmeny / hely sor kozepen: ' + JSON.stringify(kozepe));
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'vizszintes tobblet');
      await ctx.close();
    });
  }

  test('az elso kepernyon (390x844): latszik a H1, a hero-kep es az alcim; a jelvenyek es a fo gomb az 1. kepernyo vegen / alatta (a hero-sorrend CIM, KEP, alcim)', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390, magas: 844 });
    await betoltMind(p);
    const r = await p.evaluate(() => ({ h1: document.querySelector('.hero h1').getBoundingClientRect().bottom, kep: document.querySelector('.hero-kep').getBoundingClientRect().bottom, al: document.querySelector('.hero-al').getBoundingClientRect().bottom, gomb: document.querySelector('.fl-hero-cta .gomb-arany').getBoundingClientRect().bottom }));
    assert.ok(r.h1 < 844 && r.kep < 844 && r.al < 844, JSON.stringify(r));
    assert.ok(r.gomb < 844 + 200, 'a fo gomb kozel az elso kepernyohoz: ' + r.gomb);
    await ctx.close();
  });

  test('EGYMAS MELLETTI kep + szoveg HASABOK ASZTALON (1440 / 1280 / 1100 px) UGYANAKKORA magassagu: konzultacio (video), felejtsd el, Zsofi, elso alkalom, 3 kerdes, kontroll, elott / utan, karacsonyi ajanlat (kep-kartya = szoveg-kartya), SZEP, csomag-kartyak, testresz-kartya parok', async () => {
    const parok = [
      ['konzultacio video / szoveg', '#konzultacio .zsofi-media', '#konzultacio .zsofi-szoveg'],
      ['felejtsd el kep / szoveg', '#szempontok .fl-portre', '#szempontok .fl-szoveg'],
      ['Zsofi kep / szoveg', '#zsofi .zsofi-media', '#zsofi .zsofi-szoveg'],
      ['elso alkalom kep / kartyak', '#elso-alkalom .fl-portre', '#elso-alkalom .fl-kartyak'],
      ['elso alkalom 2 kartya', '#elso-alkalom .alkalmas-kartya.igen', '#elso-alkalom .alkalmas-kartya.kerdezz'],
      ['3 kerdes kep / kartyak', '#harom-kerdes .fl-portre', '#harom-kerdes .fl-kartyak'],
      ['kontroll kep / szoveg', '#kontroll .fl-kontroll > img', '#kontroll .fl-kontroll > div'],
      ['elott / utan kep / kartyak', '#kezeles-elott-utan .fl-portre', '#kezeles-elott-utan .fl-kartyak'],
      ['KARACSONYI kep-kartya / szoveg-kartya', '#ajanlat .fl-portre', '#ajanlat .fl-nagy-kartya'],
      ['SZEP kep / szoveg-kartya', '#szep-kartya .fl-portre', '#szep-kartya .fl-szoveg'],
      ['EGYEDI csomag kep / szoveg', '.fl-csomag:nth-child(1) > img', '.fl-csomag:nth-child(1) > div'],
      ['MAN TOTAL csomag kep / szoveg', '.fl-csomag:nth-child(2) > img', '.fl-csomag:nth-child(2) > div'],
      ['testresz 1. sor', '.fl-tr-csoport:nth-child(1)', '.fl-tr-csoport:nth-child(2)'],
      ['testresz 2. sor', '.fl-tr-csoport:nth-child(3)', '.fl-tr-csoport:nth-child(4)'],
      ['garancia 3 kartya', '.fl-elonyok .elony-kartya:nth-child(1)', '.fl-elonyok .elony-kartya:nth-child(3)'],
      ['kedvezmeny 3 kartya', '.fl-kedv:nth-child(1)', '.fl-kedv:nth-child(3)'],
    ];
    for (const szeles of [1440, 1280, 1100]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      await betoltMind(p);
      const rossz = [];
      for (const [mi, a, b] of parok) {
        const m = await p.evaluate(([x, y]) => { const A = document.querySelector(x), B = document.querySelector(y); if (!A || !B) return null; return [Math.round(A.getBoundingClientRect().height), Math.round(B.getBoundingClientRect().height), Math.round(Math.abs(A.getBoundingClientRect().top - B.getBoundingClientRect().top))]; }, [a, b]);
        assert.ok(m, 'nincs: ' + mi);
        if (Math.abs(m[0] - m[1]) > 1 || m[2] > 1) rossz.push(`${mi}: ${m[0]} vs ${m[1]} (felso el elteres ${m[2]})`);
      }
      assert.deepEqual(rossz, [], szeles + ' px: nem azonos magassagu hasabok');
      // a kep kitolti a kartyat (object-fit: cover, nincs ures sav)
      const kitolt = await p.$$eval('#ajanlat .fl-portre img, #konzultacio .video-kartya img, #szep-kartya .fl-portre img', (l) => l.map((i) => [getComputedStyle(i).objectFit, Math.round(i.getBoundingClientRect().height) === Math.round(i.parentElement.getBoundingClientRect().height)]));
      assert.ok(kitolt.every(([f, ok]) => f === 'cover' && ok), 'a kepek kitoltik a kartyat: ' + JSON.stringify(kitolt));
      await ctx.close();
    }
  });

  test('KONZULTACIO (Feri kerese): a Zsofi FENYKEPE helyett a VIDEO (a fo oldal Zsofi konzultacios videoja); a 9 MB-os videó nem toltodik be magatol, kattintasra felugro lejatszoban inditja; mobilon kisebb blokk; a "Zsofi vagyok" blokkban a Zsofi-kep mobilon kicsi', async () => {
    const src = forras();
    const konzi = /<section[^>]*id="konzultacio"[\s\S]*?<\/section>/.exec(src)[0];
    assert.doesNotMatch(konzi, /1aa35b8ff0f4/, 'a Zsofi-fenykep nincs a konzultacio-blokkban');
    assert.match(konzi, /<button type="button" class="video-kartya" id="zsofi-video" data-video="\/assets\/video\/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0\.mp4"/);
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets/video/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0.mp4')), 'a video a repoban mar megvan (assets/video/)');
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets/img/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0f000.jpg')), 'a poszter megvan');
    assert.match(olvas('foglalas/lezeres-szortelenites-budapest.html'), /data-video="\/assets\/video\/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0\.mp4" data-cim="Zsófi konzultációs videója"/, 'ugyanaz a video, mint a fo lezer-oldal Zsofi-blokkjaban');
    // asztal: nincs <video> es nincs mp4-keres betoltes utan; kattintasra felugro lejatszo (a video-ablak stilusa betoltve)
    const a = await nyit(NEV, { szeles: 1440 });
    await betoltMind(a.p);
    assert.equal(await a.p.locator('video').count(), 0, 'nincs <video> betoltes utan');
    assert.deepEqual(a.keresek.filter((u) => /\.mp4/.test(u)), [], 'a 9 MB-os videó nem toltodik be magatol');
    await a.p.locator('#zsofi-video').scrollIntoViewIfNeeded();
    await a.p.locator('#zsofi-video').click();
    await a.p.waitForSelector('dialog.video-modal[open] video', { timeout: 5000 });
    assert.match(await a.p.getAttribute('dialog.video-modal video', 'src'), /c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0\.mp4$/);
    const w = await a.p.$eval('dialog.video-modal', (d) => Math.round(d.getBoundingClientRect().width));
    assert.ok(w > 200 && w <= 400, 'a video-ablak stilusa betoltve (nem az alap dialog): ' + w);
    assert.equal(await a.p.locator('.video-modal-bezar').isVisible(), true);
    await a.p.keyboard.press('Escape');
    assert.equal(await a.p.locator('dialog.video-modal[open]').count(), 0, 'Escape bezarja');
    assert.deepEqual(a.hibak.filter((h) => !/play\(\)|NotAllowed|AbortError|media/i.test(h)), []);
    await a.ctx.close();
    // mobil: kicsi video-kartya a 3 jelveny mellett (nem a Zsofi-kep), a blokk kompaktabb
    const m = await nyit(NEV, { szeles: 390 });
    await betoltMind(m.p);
    const r = await m.p.evaluate(() => {
      const v = document.querySelector('#zsofi-video').getBoundingClientRect(), t = document.querySelector('#konzultacio .zsofi-tenyek').getBoundingClientRect(), s = document.querySelector('#konzultacio').getBoundingClientRect();
      const z = document.querySelector('#zsofi .fl-portre').getBoundingClientRect();
      return { vw: Math.round(v.width), vh: Math.round(v.height), tenyekBal: Math.round(t.left), videoJobb: Math.round(v.right), tenyekFelso: Math.round(t.top), videoFelso: Math.round(v.top), blokk: Math.round(s.height), zsofiW: Math.round(z.width) };
    });
    assert.ok(r.vw <= 150 && r.vw >= 100, 'kicsi video-kartya mobilon: ' + r.vw);
    assert.ok(r.tenyekBal >= r.videoJobb, 'a jelvenyek a video mellett (jobb oldalt)');
    assert.ok(r.tenyekFelso >= r.videoFelso - 2 && r.tenyekFelso < r.videoFelso + r.vh, 'a jelvenyek a video magassagaban');
    assert.ok(r.blokk <= 1050, 'a konzultacio-blokk mobilon kompakt: ' + r.blokk + ' px (korabban ~1500)');
    assert.ok(r.zsofiW <= 130, 'a "Zsofi vagyok" blokkban a Zsofi-kep mobilon kicsi: ' + r.zsofiW);
    await m.ctx.close();
  });

  test('"Rogzitett ar es garancia" + "BERLET ARAINK": a nagy pecset-kep es a ket infografika helyett a fo oldal egyszeru, ikonos abraja (3 garancia-kartya, 3 kedvezmeny-kartya, 8 alkalmas idovonal: a 4. es a 8. ajandek); a kis pecsetek mobilon kozepen egymas mellett', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    await betoltMind(p);
    const html = await p.content();
    for (const k of ['bfd0d43979b2', '4afa5a45a0b5', '77ff06afd6e2']) assert.ok(!html.includes(k), 'nincs a regi kep: ' + k);
    assert.equal(await p.locator('#garancia .elony-kartya').count(), 3);
    assert.deepEqual(await p.$$eval('#garancia .fl-cimke', (l) => l.map((x) => x.textContent.trim())), ['ÁRGARANCIA:', '12 HÓNAP GARANCIA:', 'VÉGLEGESSÉG GARANCIA:']);
    assert.equal(await p.locator('#garancia img').count(), 0, 'a garancia-szekcioban nincs kep (nagy pecset)');
    assert.equal(await p.locator('#alkalmankent .fl-kedv').count(), 3);
    assert.deepEqual(await p.$$eval('#alkalmankent .fl-kedv-jel', (l) => l.map((x) => x.textContent.trim())), ['20%', '50%', '4. + 8.']);
    assert.equal(await p.locator('#alkalmankent .alkalmak li').count(), 8);
    assert.deepEqual(await p.$$eval('#alkalmankent .alkalmak li.ajandek .kor', (l) => l.map((x) => x.textContent.trim())), ['4', '8']);
    assert.deepEqual(await p.$$eval('#alkalmankent .alkalmak small', (l) => l.map((x) => x.textContent.trim())), ['Fizetős', 'Fizetős', 'Fizetős', 'Ajándék', 'Fizetős', 'Fizetős', 'Fizetős', 'Ajándék']);
    assert.equal(await p.locator('#alkalmankent img:not(.fl-hatterkep)').count(), 0, 'a BERLET ARAINK szekcioban nincs infografika-kep');
    // a kis pecset-sor (FAJDALOM MENTES / BIZTONSAGOS / GYORS ES TARTOS) mobilon kozepen, egymas mellett
    const r = await p.$$eval('#szempontok .fl-jelvenyek img', (l) => l.map((i) => { const b = i.getBoundingClientRect(); return { top: Math.round(b.top), left: b.left, right: b.right }; }));
    assert.equal(r.length, 3);
    assert.ok(r.every((x) => Math.abs(x.top - r[0].top) <= 3), 'egymas mellett egy sorban');
    assert.ok(Math.abs((r[0].left + r[2].right) / 2 - 195) <= 4, 'kozepen: ' + (r[0].left + r[2].right) / 2);
    await ctx.close();
  });

  test('SZALON-GALERIA (Feri kerese): lapozhato kep-karusszel (10 kep, lusta betoltes, fix keparany), asztalon nyilak, pottyos jelzo, billentyuzet (balra / jobbra), aria-cimkek; mobilon erintesre huzhato (scroll-snap), nyilak nelkul', async () => {
    const src = forras();
    const gal = /<div class="fl-galeria"[\s\S]*?<p class="sr fl-gal-allapot"[^>]*><\/p>\s*<\/div>/.exec(src)[0];
    assert.equal((gal.match(/<figure class="fl-gal-kep"/g) || []).length, 10, '10 szalon-kep a galeriaban');
    assert.equal((gal.match(/loading="lazy"/g) || []).length, 10, 'mind lusta');
    assert.match(gal, /role="region" aria-roledescription="képlapozó" aria-label="A felújított szalon képei"/);
    assert.match(gal, /aria-label="Előző kép"[^>]*>[\s\S]*aria-label="Következő kép"/);
    // asztal
    const a = await nyit(NEV, { szeles: 1440 });
    await betoltMind(a.p);
    const mag0 = await a.p.evaluate(() => document.documentElement.scrollHeight);
    const sav = a.p.locator('.fl-gal-sav');
    await sav.scrollIntoViewIfNeeded();
    assert.equal(await a.p.locator('.fl-gal-kep').count(), 10);
    assert.equal(await a.p.locator('.fl-gal-pont').count(), 8, 'asztalon 3 kep latszik egyszerre: 10 - 3 + 1 = 8 megallo');
    assert.equal(await a.p.locator('.fl-gal-pont[aria-current="true"]').count(), 1);
    assert.equal(await a.p.evaluate(() => getComputedStyle(document.querySelector('.fl-gal-sav')).scrollSnapType), 'x mandatory');
    const meretek = await a.p.$$eval('.fl-gal-kep', (l) => l.map((f) => { const b = f.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height), getComputedStyle(f).aspectRatio]; }));
    assert.ok(meretek.every((m) => Math.abs(m[0] - meretek[0][0]) <= 1 && Math.abs(m[1] - meretek[0][1]) <= 1), 'minden dia azonos meretu (fix keparany): ' + JSON.stringify(meretek[0]));
    assert.match(meretek[0][2], /3 \/ 2/);
    assert.equal(await a.p.locator('.fl-gal-nyil.elozo').isDisabled(), true, 'az elso kepnel az Elozo tiltott');
    assert.equal(await a.p.locator('.fl-gal-nyil.kovetkezo').isVisible(), true, 'asztalon latszik a nyil');
    const x0 = await sav.evaluate((e) => e.scrollLeft);
    await a.p.locator('.fl-gal-nyil.kovetkezo').click();
    await a.p.waitForTimeout(900);
    const x1 = await sav.evaluate((e) => e.scrollLeft);
    assert.ok(x1 > x0 + 100, 'a Kovetkezo lapoz: ' + x0 + ' -> ' + x1);
    assert.equal(await a.p.locator('.fl-gal-nyil.elozo').isDisabled(), false);
    assert.equal(await a.p.locator('.fl-gal-pont').nth(1).getAttribute('aria-current'), 'true', 'a potty is kovet');
    await sav.focus();
    await a.p.keyboard.press('ArrowRight'); await a.p.waitForTimeout(900);
    const x2 = await sav.evaluate((e) => e.scrollLeft);
    assert.ok(x2 > x1 + 100, 'jobbra nyil lapoz: ' + x2);
    await a.p.keyboard.press('ArrowLeft'); await a.p.waitForTimeout(900);
    assert.ok(await sav.evaluate((e) => e.scrollLeft) < x2 - 100, 'balra nyil visszalapoz');
    await a.p.keyboard.press('End'); await a.p.waitForTimeout(1200);
    assert.equal(await a.p.locator('.fl-gal-nyil.kovetkezo').isDisabled(), true, 'az utolso kepnel a Kovetkezo tiltott');
    assert.equal(await a.p.locator('.fl-gal-pont').nth(7).getAttribute('aria-current'), 'true');
    await a.p.locator('.fl-gal-pont').nth(2).click(); await a.p.waitForTimeout(1000);
    assert.equal(await a.p.locator('.fl-gal-pont').nth(2).getAttribute('aria-current'), 'true', 'a potty-ra kattintva odaugrik');
    assert.match(await a.p.textContent('.fl-gal-allapot'), /3\. kép a\(z\) 10 közül/);
    assert.equal(await a.p.evaluate(() => document.documentElement.scrollHeight), mag0, 'lapozas kozben az oldal magassaga nem valtozik (nincs ugralas)');
    assert.deepEqual(a.hibak, []);
    await a.ctx.close();
    // mobil: egy kep + a kovetkezo kukucskal, nyilak nelkul, huzhato
    const m = await nyit(NEV, { szeles: 390 });
    await betoltMind(m.p);
    const r = await m.p.evaluate(() => { const s = document.querySelector('.fl-gal-sav'), k = document.querySelector('.fl-gal-kep').getBoundingClientRect(); return { scrollW: s.scrollWidth, clientW: s.clientWidth, kepW: Math.round(k.width), kepH: Math.round(k.height), nyil: getComputedStyle(document.querySelector('.fl-gal-nyil')).display, snap: getComputedStyle(s).scrollSnapType, tap: getComputedStyle(s).overflowX }; });
    assert.ok(r.scrollW > r.clientW * 3, 'huzhato sav');
    assert.equal(r.nyil, 'none', 'mobilon nincs nyil');
    assert.equal(r.snap, 'x mandatory'); assert.equal(r.tap, 'auto');
    assert.ok(r.kepW < 390 - 32 && r.kepW > 250, 'egy kep + a kovetkezo kukucskal: ' + r.kepW);
    assert.ok(Math.abs(r.kepW / r.kepH - 1.5) < 0.02, 'fix 3:2 keparany');
    assert.equal(await m.p.locator('.fl-gal-pont').count(), 10, 'mobilon egy kep latszik: 10 megallo');
    await m.p.locator('.fl-gal-pont').nth(4).tap(); await m.p.waitForTimeout(900);
    assert.ok(await m.p.evaluate(() => document.querySelector('.fl-gal-sav').scrollLeft) > 500, 'a potty-re erintve odalapoz');
    assert.equal(await m.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    await m.ctx.close();
  });

  test('KEZELO-KEPEK (Feri 2026-10-20): a lezeres oldalon NINCS a HeadSpa kezelohelyiseg (0afd6583 / 7b41e9e5), helyette a lezeres kezelo 3 kepe (assets/img/lezer-kezelo/*), mind letezik 3:2 meretben', async () => {
    const h = fs.readFileSync(path.join(GYOKER, 'foglalas', NEV + '.html'), 'utf8');
    assert.ok(!/0afd6583c98246a88f14e7f429e5284b|7b41e9e53cc240dcbdd1191999af285b/.test(h), 'nincs HeadSpa kezelo-kep');
    for (const f of ['kezelo-nagy', 'kezelo-agy', 'kezelo-sarok']) {
      assert.ok(h.includes('/assets/img/lezer-kezelo/' + f + '.jpg'), f + ' szerepel');
      const b = fs.readFileSync(path.join(GYOKER, 'assets/img/lezer-kezelo', f + '.jpg'));
      assert.ok(b.length > 50000 && b.length < 400000, f + ' merete: ' + b.length);
    }
  });

  test('MOBIL STICKY CTA: telefonon a hero elgorgetese utan jon be ("Ingyenes konzultacio" + kis "Idopont-foglalas" link), a helyszin szekciotol eltunik; asztalon nem latszik; a gombok a foglalora mutatnak', async () => {
    const m = await nyit(NEV, { szeles: 390 });
    await betoltMind(m.p);
    const lat = () => m.p.evaluate(() => { const s = document.getElementById('sticky-cta'); const b = s.getBoundingClientRect(); return { cls: s.classList.contains('lathato'), aria: s.getAttribute('aria-hidden'), belul: b.top < innerHeight - 10 && b.bottom <= innerHeight + 1 }; });
    assert.equal((await lat()).cls, false, 'betoltes utan nem latszik');
    await m.p.evaluate(() => scrollTo(0, 2200)); await m.p.waitForTimeout(500);
    const k = await lat();
    assert.equal(k.cls, true); assert.equal(k.aria, 'false'); assert.equal(k.belul, true, 'a kepernyo aljan latszik');
    assert.deepEqual(await m.p.$$eval('#sticky-cta a', (l) => l.map((a) => [a.textContent.replace(/\s+/g, ' ').trim(), a.getAttribute('href')])), [['Ingyenes konzultáció →', FOCTA], ['Időpont-foglalás', MASODLAGOS]]);
    await m.p.evaluate(() => document.getElementById('helyszin').scrollIntoView()); await m.p.waitForTimeout(500);
    assert.equal((await lat()).cls, false, 'a helyszin szekcional eltunik');
    await m.ctx.close();
    const a = await nyit(NEV, { szeles: 1440 });
    await a.p.evaluate(() => scrollTo(0, 2200)); await a.p.waitForTimeout(400);
    assert.equal(await a.p.$eval('#sticky-cta', (s) => getComputedStyle(s).display), 'none', 'asztalon nincs sticky sav');
    await a.ctx.close();
  });

  for (const szeles of [412, 390, 360]) {
    test(`SORTORES (Feri alapszabaly, ${szeles} px): ahol 1-2 szo csuszik at uj sorba, az legyen egy sor: a cimekben, jelvenyekben, gombokban, kartya-cimekben, ar-sorokban, lista-sorokban, rovid szovegekben nincs arva-sor (0 db)`, async () => {
      const { p, ctx } = await nyit(NEV, { szeles });
      await betoltMind(p);
      await p.waitForTimeout(300);
      const lista = await p.evaluate(() => {
        const SEL = 'main h1, main h2, main h3, main h4, main .gomb, main .cimke, main b, main summary, main th, main td, main li, main figcaption, main dt, main dd, main .nyil, main .hero-al, main .halk, main .fl-bevezeto, .sticky-cta a, main p';
        const talalat = [];
        for (const el of document.querySelectorAll(SEL)) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) continue;
          const szoveg = el.textContent.replace(/\s+/g, ' ').trim();
          if (el.tagName === 'B' && el.parentElement && el.parentElement.tagName === 'P') continue;
          if (!szoveg || szoveg.length > 240) continue;
          if ([...el.children].some((k) => !/^(inline|inline-block|inline-flex)$/.test(getComputedStyle(k).display) || k.tagName === 'BR')) continue;
          const szavak = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            const par = n.parentElement; if (par && par.closest('script, style, svg, [aria-hidden="true"]')) continue;
            const re = /[^ \t\n\r]+/g; let m;
            while ((m = re.exec(n.nodeValue))) {
              const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
              const rects = [...r.getClientRects()]; if (!rects.length) continue;
              const rr = rects[rects.length - 1]; szavak.push({ szo: m[0], top: Math.round(rr.top), bal: rr.left, jobb: rr.right });
            }
          }
          if (szavak.length < 3) continue;
          const sorok = [];
          for (const sz of szavak) { const s = sorok.find((x) => Math.abs(x.top - sz.top) < 6); if (s) { s.szavak.push(sz.szo); s.bal = Math.min(s.bal, sz.bal); s.jobb = Math.max(s.jobb, sz.jobb); } else sorok.push({ top: sz.top, szavak: [sz.szo], bal: sz.bal, jobb: sz.jobb }); }
          if (sorok.length < 2) continue;
          const szeles = Math.max(...sorok.map((x) => x.jobb - x.bal)); const ut = sorok[sorok.length - 1];
          if (ut.szavak.length <= 2 && ut.jobb - ut.bal < szeles * 0.55) talalat.push(el.tagName.toLowerCase() + ' (' + sorok.length + ' sor): ' + szoveg.slice(0, 80));
        }
        return [...new Set(talalat)];
      });
      assert.deepEqual(lista, [], szeles + ' px: arva-sorok');
      // a cimek kulon: legfeljebb 4 soros H1 / H2 es egyik sem er jobbra a kepernyon tul
      const cimek = await p.$$eval('main h1, main h2', (l) => l.map((h) => ({ t: h.textContent.trim().slice(0, 40), sorok: new Set([...h.getClientRects()].map((q) => Math.round(q.top))).size, jobb: Math.round(h.getBoundingClientRect().right) })));
      assert.ok(cimek.every((c) => c.jobb <= szeles), 'a cimek nem lognak ki: ' + JSON.stringify(cimek.filter((c) => c.jobb > szeles)));
      await ctx.close();
    });
  }

  for (const szeles of [390, 360, 320]) {
    test(`telefon (${szeles} px): nincs vizszintes gorgetes, a kepek nem lognak ki (a galeria kivetelevel: az huzhato), a kartyak olvashatok; a teljes oldal jelentosen rovidebb a korabbinal`, async () => {
      const { p, ctx } = await nyit(NEV, { szeles });
      await betoltMind(p);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'vizszintes tobblet');
      const kilog = await p.$$eval('main img', (l) => l.filter((i) => !i.closest('.fl-gal-sav') && i.getBoundingClientRect().right > innerWidth + 1).map((i) => i.currentSrc.split('/').pop()));
      assert.deepEqual(kilog, [], 'kikilogo kepek');
      assert.ok(await p.locator('.fl-csomag').first().isVisible());
      assert.ok(await p.locator('.fl-tr-csoport').first().isVisible());
      const mag = await p.evaluate(() => document.documentElement.scrollHeight);
      // korabban (2026-10-20 elott) 390 px-en ~23 670 px; a formazassal ~28%-kal rovidebb (a teljes oldal: fejlec + lablec is)
      assert.ok(mag <= ({ 390: 17300, 360: 17800, 320: 19000 })[szeles], szeles + ' px: a teljes oldal magassaga ' + mag + ' px');
      assert.deepEqual(await p.$$eval('.fl-tr-tetel p', (l) => l.filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent.trim())), [], 'az ar-sorok nem log ki');
      await ctx.close();
    });
  }

  test('asztal / tablet: nincs vizszintes gorgetes 1440 / 1280 es a kepek nem lognak ki; a kozbulso 800 px-en a hasabok egymas ala kerulnek (olvashato)', async () => {
    for (const szeles of [1440, 1280]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      await betoltMind(p);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, szeles + ' px: vizszintes tobblet');
      await ctx.close();
    }
    const t = await nyit(NEV, { szeles: 800 });
    await betoltMind(t.p);
    const r = await t.p.evaluate(() => ({ kep: document.querySelector('#szempontok .fl-portre').getBoundingClientRect(), szoveg: document.querySelector('#szempontok .fl-szoveg').getBoundingClientRect(), main: document.querySelector('main').scrollWidth }));
    assert.ok(r.kep.bottom <= r.szoveg.top + 2, '800 px-en a kep a szoveg folott');
    assert.ok(r.main <= 800, 'a main nem log ki');
    await t.ctx.close();
  });

  test('mukodes: a GYIK harmonika nyilik (10 kerdes, a regi valaszokkal); a terkep-gomb betolti a terkepet; a Trustindex-keret betoltodik; a foglalo-gombok linkje valtozatlan', async () => {
    const { p, ctx } = await nyit(NEV);
    await betoltMind(p);
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
    assert.equal(await p.locator('#trustindex iframe.ti-keret').count(), 1);
    assert.match(await p.getAttribute('#trustindex iframe.ti-keret', 'src'), /\/assets\/embed\/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6\.html$/);
    assert.equal(await p.locator('.gyik details').count(), 10);
    await ctx.close();
  });
});

// ---- (2) a dist/ alapu resz: fejlec / Info-ablak / lablec + foglalo-reteg ----
const DIST_FAJL = path.join(GYOKER, 'dist/_a', NEV + '.html');
describe(`/${NEV} (dist: fejlec / lablec / foglalo-reteg)`, { skip: !fs.existsSync(DIST_FAJL) && 'nincs dist/ (CF_PAGES=1 CF_PAGES_BRANCH=<ag> node tools/netlify-build.mjs)' }, () => {
  let dsz, dbazis;
  before(async () => {
    dsz = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      if (req.method === 'POST') { res.writeHead(200); return res.end('ok'); }
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers['user-agent']);
      if (e.atiranyit) { res.writeHead(301, { location: encodeURI(e.atiranyit) + u.search }); return res.end(); }
      fs.readFile(e.fajl, (hiba, adat) => {
        if (hiba) { res.writeHead(404); return res.end('nincs'); }
        const t = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.json': 'application/json' }[path.extname(e.fajl)];
        res.writeHead(200, { 'content-type': t || 'application/octet-stream' }); res.end(adat);
      });
    }).listen(0);
    await new Promise((ok) => dsz.once('listening', ok));
    dbazis = 'http://localhost:' + dsz.address().port;
  });
  after(() => dsz?.close());

  for (const szeles of [1440, 390]) {
    test(`${szeles >= 700 ? 'ASZTALI' : 'MOBIL'}: a fejlec FOGLALAS gombja, az Info-ablak es a lablec "Idopontfoglalas" gombja a lezer foglalora mutat (nem /idpontfoglalas, nem business=headspa); a lablec / Info-ablak nyitvatartasa csak H-P; nincs /idpontfoglalas link`, async () => {
      const { p, ctx, hibak } = await nyit(NEV, { szeles, bazisUrl: dbazis });
      const html = await p.content();
      assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->|<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ''), /href="\/idpontfoglalas"|mosaic-hair-idopontfoglalas/, 'a regi foglalo-utvonalra nincs link');
      const hrefek = await p.$$eval('a[href*="foglalo-motor"]', (l) => l.map((a) => a.getAttribute('href')));
      assert.ok(hrefek.length > 8);
      for (const h of hrefek) assert.ok([FOCTA, MASODLAGOS].includes(h), 'a teljes oldalon (fejlec / lablec is) csak lezer-foglalo: ' + h);
      assert.ok(await p.locator('#SITE_FOOTER a.mhl-gomb[href="' + MASODLAGOS + '"]').count() === 1, 'lablec gomb');
      assert.equal(await p.locator('header a[href="' + MASODLAGOS + '"]').count() >= 1, true, 'fejlec FOGLALAS gomb');
      assert.ok(await p.locator('template#mh-popup-rk7x7').count() === 1 || await p.locator('.mhp').count() >= 1, 'az Info-ablak megvan');
      const popupHtml = await p.evaluate(() => (document.getElementById('mh-popup-rk7x7') || {}).innerHTML || document.querySelector('.mhp')?.outerHTML || '');
      assert.match(popupHtml, /class="mhp-gomb mhp-arany" href="\/foglalo-motor\?business=laser"/);
      const lablec = (await p.textContent('#SITE_FOOTER')).replace(/\s+/g, ' ');
      assert.match(lablec, /Hétfő – Péntek: 8:00 – 20:00/); assert.doesNotMatch(lablec, /Szombat|Vasárnap/);
      assert.match(popupHtml, /Hétfő – Péntek:/); assert.doesNotMatch(popupHtml, /Szombat|Vasárnap/);
      assert.deepEqual(hibak, []);
      await ctx.close();
    });
  }

  test('a hero fo gombjara ("Ingyenes konzultacio") kattintva a foglalo-reteg (booking-launcher) helyben megnyilik (nem navigal el); a sticky CTA es a "Foglalok!" gombok is; a build a launcher-t es a google-szam.js-t felteszi', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 1440, bazisUrl: dbazis });
    const html = await p.content();
    assert.match(html, /\/assets\/js\/booking-launcher\.js/);
    assert.match(html, /\/assets\/js\/google-szam\.js/);
    await p.locator('.fl-hero-cta a.gomb-arany').click();
    await p.waitForSelector('#mosaic-booking-layer', { timeout: 10000 });
    assert.ok(new URL(p.url()).pathname.endsWith(NEV), 'az oldal nem navigalt el');
    await ctx.close();
    // mobil: a sticky CTA is a retegben nyit
    const m = await nyit(NEV, { szeles: 390, bazisUrl: dbazis });
    await m.p.evaluate(() => scrollTo(0, 2200)); await m.p.waitForTimeout(600);
    await m.p.locator('#sticky-cta a.gomb-arany').click();
    await m.p.waitForSelector('#mosaic-booking-layer', { timeout: 10000 });
    assert.ok(new URL(m.p.url()).pathname.endsWith(NEV), 'az oldal nem navigalt el (sticky)');
    await m.ctx.close();
    // egy "Foglalok!" gomb is
    const c = await nyit(NEV, { szeles: 1440, bazisUrl: dbazis });
    await c.p.locator('.fl-csomag a.gomb-arany').first().scrollIntoViewIfNeeded();
    await c.p.locator('.fl-csomag a.gomb-arany').first().click();
    await c.p.waitForSelector('#mosaic-booking-layer', { timeout: 10000 });
    await c.ctx.close();
  });

  test('a dist-ben is: az ertekeles-szam elo (google-szam.js) csereje a hero-jelvenyen / aria-cimkeben, a belso gorgetes gombok mukodnek, nincs konzolhiba', async () => {
    const { p, ctx, hibak } = await nyit(NEV, { szeles: 390, bazisUrl: dbazis });
    await betoltMind(p);
    await p.locator('.hero button[data-gorget="velemenyek"]').click();
    await p.waitForTimeout(1400);
    assert.equal(await p.evaluate(() => location.hash), '');
    assert.ok(await p.evaluate(() => Math.abs(document.getElementById('velemenyek').getBoundingClientRect().top) < 260));
    assert.deepEqual(hibak, []);
    await ctx.close();
  });
});
