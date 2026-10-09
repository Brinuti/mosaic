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
// 2026-10-09 (a tulajdonos kerese) kivett blokkok a regi oldal folyamaban (y-tartomanyok): "Az orom megduplazodik" (tulajdonosi tortenet), "A fejborotok azt kapja...",
// "Head Spa Csomagok es Arak" (arlista, a 4 csomagkartyaval), az also ajandekkartya-doboz
// + a "Tapasztalt gyogymasszorok kenyeztetnek." blokk regi, hosszu bekezdesei (5455-6097): 2026-10-08 ota rovid valtozat all az oldalon (a tulajdonos kerese, 4052bfb) - a teszt ezt eddig nem kovette
const KIVETT_Y = [[810, 1611], [2537, 3359], [5455, 6097], [9359, 9786]];
function folyam({ kivettekkel = false } = {}) {
  return olvas('tools/paros-regi/forras/paros.folyam.txt').split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^\s*(\d+)\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x-?\d+\s+w\d+\s*(?:h\d+)?\s*(.*)$/.exec(l);
    return { t: m[2], raw: m[3], y: +m[1], kivett: KIVETT_Y.some(([a, b]) => +m[1] >= a && +m[1] <= b) };
  }).filter((x) => kivettekkel || !x.kivett);
}
// a kivett blokkok szovege (norm): a regi HTML ezekbol szarmazo szovegcsomopontjai nem hianyzasok
const kivettSzoveg = () => norm(folyam({ kivettekkel: true }).filter((x) => x.kivett).map((x) => szovegbol(x.raw)).join(' '));
// a kivett blokkok kepei (a regi HTML kep-azonositoi): az oldalon mar nincsenek
const KIVETT_KEPEK = ['68d6961f322c', 'aab3792d7e02', 'b4524614b454', '457a5f5c69ce', '9ea9d95c658e', '40d2a033721a', '5fad37708d0d', 'c676302884b3'];
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
  test('2026-10-09: hero = a KOZOS videos hero (hang nelkuli paros hatter-klip + nyitokep, play gomb a hangos paros videohoz); legkozelebbi szabad idopontok (Salonic-API, a foglalo-motorra mutatnak); "Kivel jonnel?" 4 kartya; a hero utan vannak', async () => {
    const { p, ctx, hibak } = await nyit(nev);
    assert.equal(await p.locator('#hero.vh-hero').count(), 1);
    const v = p.locator('#hero video.vh-video');
    assert.equal(await v.count(), 1);
    assert.equal(await v.getAttribute('data-klip'), '/assets/video/paros-hero-barat.mp4');
    assert.equal(await p.getAttribute('#hero img.vh-hatter', 'src'), '/assets/img/paros/hero-barat.jpg');
    for (const a of ['muted', 'loop', 'playsinline']) assert.notEqual(await v.getAttribute(a), null, a);
    assert.equal(await p.locator('#hero-video, .hero .hero-kep').count(), 0, 'a regi hero-kep / sajat video helyett a kozos hero van');
    assert.equal(await p.getAttribute('#hero button.vh-lejatszas', 'data-nagyvideo'), '/assets/video/ajandek-kezeles-paros.mp4');
    for (const f of ['assets/video/paros-hero-barat.mp4', 'assets/img/paros/hero-barat.jpg', 'assets/video/ajandek-kezeles-paros.mp4']) assert.ok(fs.existsSync(path.join(GYOKER, f)), f);
    const hero = (await p.evaluate(() => document.querySelector('#hero').innerText)).replace(/\s+/g, ' ');
    assert.match(hero, /Google 4,9\/5 - [\d .,]+ vélemény/, 'hero: Google-ertekeles sor');
    for (const k of ['Páros Head Spa.', 'Éljétek át együtt az igazi relaxációt!', '50 + 30 perc exkluzív spa élmény közösen', '65.900 Ft', '53.800 Ft', 'Októberben 20% kedvezménnyel!', '50+30 perc', 'Profi hajszárítás', 'Privát páros',
      'Időpontfoglalás', 'Ajándékkártya', '1023 Bécsi út 2 (A Kolosy térnél)', 'Nézd meg a páros kezelést']) assert.ok(hero.includes(k), 'hero: ' + k);
    assert.equal(await p.getAttribute('#hero a[data-cta="hero-idopontfoglalas"]', 'href'), '/foglalo-motor?business=headspa');
    assert.equal(await p.getAttribute('#hero a[data-cta="hero-ajandekkartya"]', 'href'), '/headspa-ajandekkartya');
    assert.equal(await p.getAttribute('#hero a.vh-google', 'href'), '#velemenyek');
    // sorrend: hero -> szabad idopontok -> Kivel jonnel? -> folyamat
    const sorrend = await p.$$eval('main > section', (l) => l.map((e) => e.id || e.className.split(' ')[0]));
    assert.ok(sorrend.indexOf('hero') === 0 && sorrend.indexOf('idopontok') === 1 && sorrend.indexOf('kivel') === 2 && sorrend.indexOf('folyamat') === 3, 'sorrend: ' + sorrend.join(','));
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
    // telefonon: nincs vizszintes gorgetes, felul a video (300 px), alatta a cim
    const m = await nyit(nev, { szeles: 390 });
    const adat = await m.p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { szeles: document.documentElement.scrollWidth, ablak: innerWidth, kepMag: Math.round(r('.vh-hatter').height), kepTop: Math.round(r('.vh-hatter').top - r('#hero').top), cimTeteje: Math.round(r('main h1').top - r('#hero').top) }; });
    assert.ok(adat.szeles <= adat.ablak, 'nincs vizszintes gorgetes: ' + JSON.stringify(adat));
    assert.deepEqual([adat.kepMag, adat.kepTop], [300, 0], 'felul a video: ' + JSON.stringify(adat));
    assert.ok(adat.cimTeteje >= 200 && adat.cimTeteje < 300, 'a cim a video aljan kezdodik: ' + JSON.stringify(adat));
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
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg (a 2026-10-09-en kivett blokkokon kivul)');
    // kepek: a regi HTML MINDEN tartalmi kepe (fejlec / ikonok nelkul) + a regi oldal kinyert kepei az uj oldalon
    const regiHtml = olvas(`klon/${nev}.html`);
    const eleje = regiHtml.indexOf('81f16bfc67fb');
    const azonosito = [...new Set([...regiHtml.slice(eleje).matchAll(/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})[0-9a-f]{8,}\.(?:jpe?g|png|webp)/g)].map((m) => m[1]))];
    const folyamKepek = sorok.filter((s) => s.t === 'KEP').map((s) => /\/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})/.exec(s.raw)?.[1]).filter(Boolean);
    const html = await p.content();
    assert.ok(azonosito.length >= 30, 'a regi oldal kepeinek listaja: ' + azonosito.length);
    // a regi hero-kep (2c17645e97d9) helyett 2026-10-09 ota a mozgo paros video all (a tulajdonos kerese)
    // + a 2026-10-09-en kivett blokkok kepei (tulajdonosi fotó, fejbor-kamera, csomagok, ajandekkartya-mockup) es a "kanalas" sablonkep
    assert.deepEqual([...new Set([...azonosito, ...folyamKepek])].filter((k) => k !== '2c17645e97d9' && !KIVETT_KEPEK.includes(k) && !html.includes(k)), [], 'hianyzo kepek (a regi oldal HTML-je / kinyert tartalma szerint)');
    for (const k of KIVETT_KEPEK) assert.ok(!html.includes(k), 'a kivett blokk / sablonkep nincs az oldalon: ' + k);
    // linkek
    const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    const regiLinkek = sorok.filter((s) => s.t === 'GOMB').map((s) => /\s->\s+(\S+)\s*$/.exec(s.raw)?.[1]).filter(Boolean);
    assert.deepEqual([...new Set(regiLinkek)].filter((h) => !hrefek.includes(h)), [], 'hianyzo linkek');
    // a "Head Spa Csomagok es Arak" blokk (4 csomagkartya) kikerult
    assert.equal(await p.locator('.lv-paros-csomag, .lv-csomagok, #csomagok').count(), 0);
    // videok: 15 db, a fajlok megvannak, a poszter / ido / cim a regi oldalrol
    const videok = await p.$$eval('[data-video]', (l) => l.map((b) => b.dataset.video));
    assert.equal(videok.length, 15);
    for (const v of videok) assert.ok(fs.existsSync(path.join(GYOKER, v.slice(1))), 'videofajl: ' + v);
    // GYIK: a regi oldalon a ket Common Ninja GYIK egy listaban (klon.js)
    const gy = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1]);
    const v = [...gy['c2eb0f_e2a637ece2437154df156d36cae403f4'], ...gy['c2eb0f_dab261d3e84629df7798238e716f0266']];
    // 2026-10-09: kompakt GYIK - 8 kerdes latszik, a tobbi 10 a "Tovabbi kerdesek" lenyiloban; mind a 18 megvan (a sorrend a paros-latogatot erdeklo kerdeseket elore hozza)
    const kerdesek = await p.$$eval('main .gyik details:not(.gy-tobb)', (l) => l.map((d) => ({ k: d.querySelector('summary').textContent.trim(), v: d.querySelector('.gy-valasz').textContent })));
    assert.equal(kerdesek.length, 18);
    assert.equal(kerdesek.length, v.length, 'a ket regi GYIK-lista egyutt');
    for (const [k, a] of v) { const t = kerdesek.find((x) => x.k === k); assert.ok(t, 'hianyzo kerdes: ' + k); assert.equal(norm(t.v), norm(a.replace(/<[^>]*>/g, ''))); }
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
    const kivett = kivettSzoveg();
    const hianyzo = csomok.filter((c) => !FEJLEC.test(c) && norm(c).length >= 8 && !uj.includes(norm(c)) && !kivett.includes(norm(c)));
    assert.ok(csomok.length > 200, 'a regi oldal szovegcsomopontjai: ' + csomok.length);
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg az ujban (a kivett blokkokon kivul)');
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
    const elso = p.locator('.gyik details:not(.gy-tobb)').first();
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
      assert.ok(await p.locator('.lv-kivel .kivel-kartya').first().isVisible());
      await ctx.close();
    });
  }

  test('2026-10-09 (a tulajdonos kerese): kikerult a tulajdonosi tortenet, a fejbor-blokk, az arlista (csomagok) es az also ajandekkartya-doboz; az alul levo "kanalas" sablonkep helyett szalon-foto; a hivatkozasok nem torottek', async () => {
    const { p, ctx } = await nyit(nev);
    assert.equal(await p.locator('#bemutatkozas, #fejbor, #csomagok, #ajandekkartya').count(), 0, 'a kivett szekciok');
    const t = (await p.evaluate(() => document.querySelector('main').innerText)).replace(/\s+/g, ' ');
    for (const k of ['Az öröm megduplázódik', 'Deák Ferenc István', 'A fejbőrötök azt kapja', 'Head Spa Csomagok és Árak', '"4 Kezes" Head Spa kezelés', 'FOGLALOK!', 'Ajándékkártya 1 perc alatt', 'ELŐRE UTALÁSSAL']) assert.ok(!t.includes(k), 'nem kell: ' + k);
    // a megmarado blokkok
    for (const k of ['Így néz ki egy 50 + 30 perces Páros Head Spa', '100%-ban organikus, vegán OXYGENI termékeket használunk', 'Tapasztalt gyógymasszőrök kényeztetnek.', 'Csak tökéletes szárítással engedünk el!', 'SZÉP Kártyát is elfogadunk', 'Itt találtok meg minket', 'Kivel jönnél?']) assert.ok(t.includes(k), 'megmarad: ' + k);
    // az ajandekkartya felul meg megvan: a hero gombja + a "Kivel jonnel?" kartya; nincs masik alul
    assert.ok((await p.locator('main a[href="/headspa-ajandekkartya"]').count()) >= 2);
    // sablonkep csere
    const html = await p.content();
    assert.ok(!html.includes('c676302884b3'), 'a "kanalas" sablonkep nincs az oldalon');
    const kep = p.locator('#helyszin .lv-hely-kep img');
    assert.equal(await kep.getAttribute('src'), '/assets/img/fooldal/szalon-szoba-2.jpg');
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets/img/fooldal/szalon-szoba-2.jpg')));
    assert.ok(await kep.evaluate((i) => i.complete && i.naturalWidth > 0), 'a kep betoltodik');
    assert.match(await kep.getAttribute('alt'), /kezelőszoba/);
    // belso horgonyok: mindegyik cel letezik; a kivett szekciokra nem mutat semmi (a fejlec / lablec sem)
    const horgonyok = await p.$$eval('a[href*="#"]', (l) => l.map((a) => a.getAttribute('href')));
    for (const h of horgonyok) {
      const [ut, id] = h.split('#');
      if (!id || (ut && ut !== '/paros-headspa-budapest')) continue;
      assert.ok(await p.locator('[id="' + id + '"]').count() > 0, 'torott horgony: ' + h);
    }
    assert.ok(!horgonyok.some((h) => /#(bemutatkozas|fejbor|csomagok|ajandekkartya)$/.test(h) && (h.startsWith('#') || h.startsWith('/paros-headspa-budapest'))), 'kivett szekcio horgonya: ' + horgonyok.join(' '));
    await ctx.close();
  });

  test('kompakt GYIK: 8 kerdes latszik (osszecsukva), a tovabbi 10 a "Tovabbi kerdesek" lenyiloban; szoros sorkoz; az oldal merhetoen rovidebb (regi: ~13 800 px asztalon, ~18 600 px telefonon)', async () => {
    const { p, ctx } = await nyit(nev);
    assert.equal(await p.locator('.gyik > details:not(.gy-tobb)').count(), 8);
    assert.equal(await p.locator('.gyik > details.gy-tobb .gy-tobb-lista > details').count(), 10);
    assert.equal(await p.$$eval('.gyik details', (l) => l.filter((d) => d.open).length), 0, 'minden osszecsukva');
    assert.equal(await p.locator('.gy-tobb-lista').isVisible(), false, 'a tovabbi kerdesek csukva');
    // az ellenjavallat (fontos) a latszo 8 kozott van
    assert.ok((await p.$$eval('.gyik > details:not(.gy-tobb) > summary', (l) => l.map((s) => s.textContent))).some((x) => /ellenjavallat/.test(x)));
    const sor = await p.$$eval('.gyik > details:not(.gy-tobb)', (l) => l.slice(0, 3).map((d) => Math.round(d.getBoundingClientRect().height)));
    for (const h of sor) assert.ok(h <= 56, 'szoros GYIK-sor: ' + h + ' px');
    await p.click('.gy-tobb > summary');
    assert.equal(await p.locator('.gy-tobb-lista').isVisible(), true);
    await p.click('.gy-tobb-lista details:first-child summary');
    assert.equal(await p.$eval('.gy-tobb-lista details:first-child', (d) => d.open), true);
    const mag = await p.evaluate(() => document.documentElement.scrollHeight);
    await ctx.close();
    const m = await nyit(nev, { szeles: 390 });
    const magM = await m.p.evaluate(() => document.documentElement.scrollHeight);
    const gyikM = await m.p.$eval('#gyik', (e) => Math.round(e.getBoundingClientRect().height));
    await m.ctx.close();
    assert.ok(mag < 12000, 'asztali oldalmagassag (a GYIK nyitva is): ' + mag);
    assert.ok(magM < 12500, 'mobil oldalmagassag: ' + magM);
    assert.ok(gyikM < 800, 'a GYIK-szekcio telefonon kompakt: ' + gyikM);
  });

  test('a kozos videos hero a paros oldalon: asztalon a kep a hero jobb oldalan, balrol sotetzoldbe olvadva (.vh-eltolt); play gomb 62 / 52 px; ar kicsi; a jelvenyek telefonon egy sorban; a play gomb a hangos paros videot NAGY ablakban nyitja', async () => {
    const { p, ctx } = await nyit(nev);
    const d = await p.evaluate(() => ({ play: Math.round(document.querySelector('.vh-play').getBoundingClientRect().width), ar: getComputedStyle(document.querySelector('.vh-ar b')).fontSize, h1: getComputedStyle(document.querySelector('#hero h1')).fontFamily }));
    assert.equal(d.play, 62);
    assert.equal(d.ar, '28px');
    assert.match(d.h1, /Playfair Display/);
    await p.evaluate(() => { window.dataLayer = []; });
    await p.click('#hero .vh-lejatszas');
    await p.waitForSelector('dialog.vh-lb[open] video');
    assert.equal(await p.getAttribute('.vh-lb source', 'src'), '/assets/video/ajandek-kezeles-paros.mp4');
    assert.equal(await p.locator('dialog.video-modal[open]').count(), 0, 'nem a kartya-lejatszo nyilt');
    const dl = await p.evaluate(() => window.dataLayer.filter((x) => /^paros_landing_(video|cta)$/.test(x.event)));
    assert.deepEqual(dl.map((x) => x.event + ':' + (x.cta || x.video)).sort(), ['paros_landing_cta:hero-video', 'paros_landing_video:/assets/video/ajandek-kezeles-paros.mp4']);
    await p.keyboard.press('Escape');
    await ctx.close();
    for (const szeles of [390, 360]) {
      const m = await nyit(nev, { szeles });
      const t = await m.p.evaluate(() => ({ li: [...document.querySelectorAll('.vh-jelvenyek li')].map((e) => Math.round(e.getBoundingClientRect().top)), play: Math.round(document.querySelector('.vh-play').getBoundingClientRect().width), google: Math.round(document.querySelector('.vh-google').getBoundingClientRect().height), vizsz: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
      assert.equal(new Set(t.li).size, 1, szeles + ' px: a harom jelveny egy sorban: ' + t.li);
      assert.equal(t.play, 52);
      assert.ok(t.google < 40, szeles + ' px: a Google-sor egy sorban: ' + t.google);
      assert.equal(t.vizsz, true);
      await m.ctx.close();
    }
  });

  test('szabad idopontok: nincs "valos idoben" lab-szoveg; elore / vissza nyil asztalon es telefonon is (a visszanyil az elejen letiltva / halvany); telefonon 3 idopont naponta; a szekcio kompakt', async () => {
    for (const szeles of [1440, 390]) {
      const { p, ctx } = await nyit(nev, { szeles });
      await p.locator('#idopontok').scrollIntoViewIfNeeded();
      await p.waitForSelector('#napok .nap-oszlop');
      assert.equal(await p.locator('.ido-lab').count(), 0);
      assert.ok(!(await p.textContent('#idopontok')).includes('valós időben'), 'a lab-szoveg ki');
      assert.equal(await p.locator('#napok-elozo').count(), 1);
      // a hamis API 2 napot ad: telefonon (3 oszlop latszik) nincs mit lapozni -> a nyilak rejtettek; asztalon (5 oszlop) ugyanigy. Tobb nappal tesztelunk: lasd alabb
      assert.deepEqual(await p.$$eval('.nap-oszlop', (l) => [...new Set(l.map((o) => o.querySelectorAll('a.ido').length))]), [3], 'a hamis API napi 3 idopontot ad (nincs "+N")');
      await ctx.close();
    }
    // sok nap: a nyilak megjelennek, a visszanyil az elejen letiltva, lapozas utan aktiv
    for (const szeles of [1440, 390]) {
      const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: szeles < 700 ? 844 : 900 }, ...(szeles < 700 ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
      const p = await ctx.newPage();
      await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
      await p.route('https://api.salonic.hu/**', (r) => {
        const mai = Math.floor(Date.now() / 1000), nap0 = mai - (mai % 86400) + 2 * 86400;
        const slots = {}; let i = 0;
        for (let d = 0; d < 14; d++) for (const h of [8, 10, 13, 15, 16]) slots['s' + i++] = { timestamp: nap0 + d * 86400 + h * 3600 };
        r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ status: 'success', data: { blocks: { 1: { k1: { slots } } } } }) });
      });
      await p.goto(`${bazis}/${nev}`, { waitUntil: 'domcontentloaded' });
      await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('idopontok').scrollIntoView(); });
      await p.waitForSelector('#napok .nap-oszlop');
      assert.equal(await p.locator('#napok-kov').isVisible(), true);
      assert.equal(await p.locator('#napok-elozo').isVisible(), true, szeles + ' px: a visszafele nyil is latszik');
      assert.equal(await p.locator('#napok-elozo').isDisabled(), true, 'az elejen letiltva');
      assert.ok(Number(await p.$eval('#napok-elozo', (e) => getComputedStyle(e).opacity)) < 0.6, 'halvany');
      if (szeles < 700) assert.deepEqual(await p.$$eval('.nap-oszlop', (l) => [...new Set(l.map((o) => o.querySelectorAll('a.ido').length))]), [3], 'telefonon naponta 3 idopont (+N)');
      await p.click('#napok-kov');
      await p.waitForFunction(() => document.getElementById('napok').scrollLeft > 100);
      assert.equal(await p.locator('#napok-elozo').isDisabled(), false, 'lapozas utan aktiv');
      await p.click('#napok-elozo');
      await p.waitForFunction(() => document.getElementById('napok').scrollLeft < 4, null, { timeout: 5000 });
      assert.equal(await p.locator('#napok-elozo').isDisabled(), true);
      await p.evaluate(() => { const n = document.getElementById('napok'); n.scrollTo({ left: n.scrollWidth, behavior: 'auto' }); });
      await p.waitForFunction(() => document.getElementById('napok-kov').disabled, null, { timeout: 5000 });
      await ctx.close();
    }
  });
});
