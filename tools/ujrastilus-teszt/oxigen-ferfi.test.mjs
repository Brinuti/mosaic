// A "Ferfi oxigenterapia" oldal (/oxigenterapia-ferfiaknak) bongeszos tesztjei (Playwright): az /oxigenterapia-budapest landing komponenseivel ujrastilusozott oldal + a tulajdonos
// 2026-10-20-i visszajelzese (uj H1, nincs "majusi" kedvezmeny, a fo oxigen-oldal arai, uj fo gombok, az ertekeles / terkep nem visz ki az oldalrol, lapozhato szalon-galeria,
// asztalon egyforma magas kep + szoveg hasabok, tomorebb mobil oldal, arva-sor szabaly).
// Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt.
//
//   node --test tools/ujrastilus-teszt/oxigen-ferfi.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
// A tartalom-hűseg a regi (Wixes) oldalhoz (klon/oxigenterapia-ferfiaknak.html, forras/oxigen-ferfi.folyam.txt, assets/js/gyik.js) kepest: a regi oldal MINDEN szovege, kepe, linkje megvan,
// KIVEVE a tulajdonos kerte / a fo oldal szerint javitott helyeket: ezek a VALTOZTATOTT listaban vannak (indoklassal); ha valami ezen kivul hianyzik VAGY a lista egy tetele mar nem ervenyes, a teszt elbukik.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
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
const H1_FO = 'Oxigénes fejbőrápolás férfiaknak Budán';
const H1_TELJES = H1_FO;   // 2026-10-20 10:30: egyetlen, rövid H1 (a "hajgyógyászati" orvosi állítás és a 95% / 2 millió kezelés ki: Google Ads brief 9.B 2/1)
const GYIK_AZON = 'c2eb0f_193bec926d66321bf99ada19cf4105a5';
const FOGLALO = '/foglalo-motor?business=oxygen';
const HAJVIZSGALAT = '/foglalo-motor?business=oxygen&service=466147';
const ELSO_KEZELES = '/foglalo-motor?business=oxygen&service=466110';
let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
const FORRAS = olvas(`foglalas/${NEV}.html`);
// a regi oldal kinyert sorai: { t: tipus, raw }
function folyam() {
  return olvas('tools/ujrastilus-teszt/forras/oxigen-ferfi.folyam.txt').split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^\s*\d+\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x-?\d+\s+w\d+\s*(?:h\d+)?\s*(.*)$/.exec(l);
    return { t: m[1], raw: m[2] };
  });
}
const galeriak = () => JSON.parse(/window\.MH_GALERIAK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/galeriak.js'))[1]);
// a regi oldal 5 galeriaja (komponens-azonosito -> kepek): hajhullas, korpas, pikkelysomor, seborrea, szalon
const GALERIAK = ['comp-mnn4k93g2', 'comp-mnn4k93q', 'comp-mnn4k93w5', 'comp-mnn4k9432', 'comp-mnn4k98w5'];
const gyikAdat = () => JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])[GYIK_AZON];
const szovegbol = (html) => html.replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '').replace(/\s+->\s+\S+\s*$/, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
// betuk es szamok kisbetuvel: a tagolas / irasjelek / emojik / athuzas-jelek kulonbsegei nem szamitanak
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[\u0336\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200d\u200b\u00a0]/gu, '').replace(/[^\p{L}\p{N}]+/gu, '')
  // a Google-ertekelesek szama elo adat (assets/js/google-szam.js, a build teszi fel): a beegetett szam nem kell hogy egyezzen
  .replace(/google49\d{3,4}(?=ertekeles|értékelés|velemeny|vélemény)/g, 'google49N');

// --- a tulajdonos kerte / a fo oldal szerint javitott helyek (a regi oldal szovegei, amik mar NEM vagy MASKENT szerepelnek) ---
const VALTOZTATOTT = [
  [/^Férfi Oxigénterápia kopaszodás/, 'uj H1 (2026-10-20 10:30, Google Ads brief 9.B 2/1): "Oxigénes fejbőrápolás férfiaknak Budán"'],
  [/^(Csak Arc|Arc \+ Haj): .*(helyett|\/ 2 óra)|helyett 29\.900 Ft|helyett 39\.900 Ft|^(29\.900|39\.900) Ft \/ 2 óra|^(Csak Arc|Arc \+ Haj): [\d.]+ Ft helyett/, 'a hero ar-sorai: nincs kedvezmeny / athuzott ar; helyette a Salonic szerinti arak (hajvizsgalat 4 990, elso kezeles 29 900, 2. alkalomtol 26 000); az Arc-arak nem ellenorizhetok'],
  [/Májusban 10% kedvezménnyel/, 'a "Májusban 10% kedvezménnyel!" felirat mind a 6 helyen torolve (nincs kedvezmeny)'],
  [/891 értékelésből/, 'az ertekeles az elo Google-szam mintaja (4,9 – <szam> értékelés)'],
  [/tiszító|tisztító és anti aging|termékekeit|Ez segíti a hajhagymák/, 'elirasok javitva (tiszító -> tisztító, termékekeit -> termékeit)'],
  [/sűrűsödő ő haj|Megállított hajhullás/, 'elírás javítva (sűrűsödő ő haj -> sűrűsödő haj)'],
  [/30\.000 Ft-os|Privát, csendes headspa szobában/, 'elavult Head Spa ar ("30.000 Ft-os") kivéve (a Head Spa ma 26 900 / 32 900 Ft)'],
  [/11\.000 Ft - 21\.000 Ft|Nálunk nincs bérlet/, 'a "11.000-21.000 Ft-os kedvezmény" + "nincs bérlet" mondat: a fo oldal szerint nincs KOTELEZO berlet, kedvezmeny nincs'],
  [/közel 1\.000 véleményből|értékelés közel/, 'ertekeles-cim: az elo Google-szam mintaja'],
  [/120 perces oxigénterápiás kezelés/, 'a 120 perces valtozat kikerult a Salonicbol, az elso kezeles 80 perc (fo oxigen-oldal)'],
  [/megszáírtjuk/, 'elírás javítva (megszáírtjuk -> megszárítjuk)'],
  [/az határozza meg, hogy hanyadik/, 'elírás / nyelvtan javítva'],
  [/^Haj csomag Az első alkalommal|^Ár:|az első alkalommal a kezelés előtt hajkamerás/i, 'a Haj csomag ar-reszei: nincs athuzott ar, 80 perc, uj gombok (Salonic szerinti arak)'],
  [/Sok helyen székbe ültetve/, 'nyelvtan javitva ("Mi a kezelőágy, valamint egy privát és csendes kezelőszoba mellett")'],
  [/^Szombat$|^Vasárnap$|^ZÁRVA$/, 'nyitvatartas: a szombat megerositesre var (<!--mh-nyitvatartas:hetkoznap--> + csak Hétfő–Péntek)'],
  [/Megnyitás a Google Térképen|^Térkép: a tartalom/, 'a terkep helykitolto uj (headspa-oldal.js, #terkep): kulso Google-link csak az "Utvonaltervezes" gomb'],
];
const regiLinkValtozott = [
  [/google\.com\/maps\/search/, 'a terkep helykitolto kulso linkje helyett az "Útvonaltervezés" gomb (maps/search, mas lekerdezessel)'],
  [/^\/oxigenterapia-budapest#comp-mciu8zae4$/, 'halott Wix-horgony ("Mutasd az eredményeket!") -> az oldal sajat #eredmenyek szekciojara gorgetes ([data-gorget])'],
  [/^\/oxigenterapia-budapest#comp-mnmzyliv$/, 'halott Wix-horgony (Google-ertekeles) -> az oldal sajat #velemenyek szekciojara gorgetes ([data-gorget])'],
];
function valtoztatottSzurt(lista) {
  const tartalmaz = new Set();
  const maradt = lista.filter((x) => {
    const t = VALTOZTATOTT.findIndex(([re]) => re.test(x));
    if (t >= 0) { tartalmaz.add(t); return false; }
    return true;
  });
  return { maradt, tartalmaz };
}

// a vizsgalt oldal (asztali / mobil) betoltese: lusta kepek betoltese, kulso halozat tiltva (a kerelmeket gyujtjuk)
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
// egy elem szovegenek sorai (a <sup aria-hidden> csillagot es a lathatatlan vesszot nem szamoljuk): a szovegcsomopontok tetejenek kulonbozo ertekei
const sorSzam = (p, valaszto) => p.evaluate((v) => {
  const el = document.querySelector(v);
  const bejaro = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const tetok = [];
  let n;
  while ((n = bejaro.nextNode())) {
    if (!n.nodeValue.trim() || n.parentElement.closest('.h1-vessz, [aria-hidden="true"]')) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const k of r.getClientRects()) if (k.width > 0 && !tetok.some((t) => Math.abs(t - k.top) < 5)) tetok.push(k.top);
  }
  return tetok.length;
}, valaszto);

describe(`/${NEV}`, () => {
  const nev = NEV;
  test('betoltodik hibak nelkul: egyetlen H1, nincs torott kep / 404 / konzol-hiba; cim + leiras az uj H1-hez igazodik (title <= 60, description <= 155), canonical valtozatlan; INDEXELHETO', async () => {
    const regi = olvas(`klon/${nev}.html`);
    const g = (re) => { const m = re.exec(regi); assert.ok(m, 'meta a regi oldalon: ' + re); return m[1]; };
    const { p, ctx, hibak, nincs } = await nyit(nev);
    const cim = await p.title();
    assert.ok(cim.length <= 60, `title hossza ${cim.length}`);
    assert.match(cim, /^Oxigénes fejbőrápolás férfiaknak Budán/);
    const leiras = await p.getAttribute('meta[name="description"]', 'content');
    assert.ok(leiras.length <= 155 && leiras.length >= 80, `description hossza ${leiras.length}`);
    assert.ok(leiras.startsWith('Oxigénes fejbőrápolás férfiaknak'), 'a description az uj H1-gyel kezdődik');
    assert.doesNotMatch(cim + ' ' + leiras, /hajgyógyász|95\s*%|2 millió/i, 'a title / description nem tartalmaz orvosi állítást / 95% / 2 millió kezelés');
    assert.doesNotMatch(leiras + cim, /seborrea|ekcéma|pikkelysömör|[Mm]ájus|10%/, 'nincs betegseg-felsorolas / majus / 10% a meta-adatokban');
    assert.equal(await p.getAttribute('meta[property="og:title"]', 'content'), cim);
    assert.equal(await p.getAttribute('meta[name="twitter:title"]', 'content'), cim);
    assert.equal(await p.getAttribute('meta[property="og:description"]', 'content'), leiras);
    assert.equal(await p.getAttribute('meta[name="twitter:description"]', 'content'), leiras);
    assert.equal(await p.getAttribute('link[rel="canonical"]', 'href'), g(/<link rel="canonical" href="([^"]*)"/));
    assert.equal(await p.getAttribute('meta[property="og:url"]', 'content'), g(/<meta property="og:url" content="([^"]*)"/));
    assert.equal(await p.locator('meta[name="robots"]').count(), 0, 'nincs robots meta (a regi oldal indexelheto volt)');
    assert.doesNotMatch(regi, /<meta name="robots"/, 'a regi oldal sem volt noindex');
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.equal(norm(await p.textContent('h1')), norm(H1_TELJES), 'a H1 a Google Ads brief szerinti');
    assert.equal((await p.textContent('h1 .h1-fo')).replace(',', '').trim(), H1_FO);
    assert.equal(await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc)).then((l) => l.length), 0, 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.equal(await p.$$eval('img:not([width]), img:not([height])', (l) => l.length), 0, 'minden kepnek van width / height');
    assert.equal(await p.locator('main [id^="comp-"]:not(a)').count(), 0, 'nincs Wix-maradvany');
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('a hero kep elotoltve (fetchpriority=high), a tobbi kep lazy; NINCS meres: data-cta / dataLayer / gtag; a koz-CSS / -JS betoltve (oxigen-landing, headspa-oldal) + az oldal sajat oxigen-ferfi.css / .js', async () => {
    const hero = '/assets/img/c2eb0f_6e4e940124d942d4aea355ecc21729fe.jpg';
    assert.ok(FORRAS.includes(`<link rel="preload" href="${hero}" as="image" fetchpriority="high">`), 'hero preload');
    assert.doesNotMatch(FORRAS, /data-cta|dataLayer|gtag\(|fbq\(|ttq\./, 'nincs merokod / esemeny');
    for (const f of ['/assets/css/oxigen-landing.css', '/assets/css/oxigen-ferfi.css', '/assets/js/oxigen-landing.js', '/assets/js/headspa-oldal.js', '/assets/js/oxigen-ferfi.js', '/assets/js/klon.js']) assert.ok(FORRAS.includes(f), f);
    assert.doesNotMatch(FORRAS, /lezer-landing|headspa-oldal\.css|<script[^>]*src="https?:/, 'nincs idegen CSS / kulso szkript');
    const sajatJs = olvas('assets/js/oxigen-ferfi.js').replace(/\/\/[^\n]*/g, '');   // a megjegyzesek nelkul
    assert.doesNotMatch(sajatJs, /dataLayer|gtag|fbq|ttq|fetch\(|XMLHttpRequest|pushState|replaceState|location\.hash|location\.href/, 'az oldal sajat JS-e nem mero-kod, nem hiv halozatot, nem ir URL-t');
    const kepek = [...FORRAS.matchAll(/<img\b[^>]*>/g)].map((m) => ({ s: /src="([^"]+)"/.exec(m[0])[1], lazy: (/loading="([^"]+)"/.exec(m[0]) || [])[1], fp: (/fetchpriority="([^"]+)"/.exec(m[0]) || [])[1] }));
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

  test('H1: egyetlen, rovid cim; mobilon legfeljebb 2 sor (412 / 390 / 360 px), az utolso sor legalabb 2 szo (nincs arva-szo); nincs lablec-csillag / "hajgyogyaszati" / 95% a hero-ban; a hero-sorrend: CIM, KEP, alcim, arak, gombok, ertekeles, hely', async () => {
    for (const [szeles, max] of [[412, 2], [390, 2], [360, 2]]) {
      const { p, ctx } = await nyit(nev, { szeles });
      const ossz = await sorSzam(p, 'h1');
      assert.ok(ossz <= max, `${szeles}px: a H1 ${ossz} soros; max ${max}`);
      assert.equal(await p.locator('h1 .h1-al, h1 .h1-csillag, .hero .hero-lab').count(), 0, 'nincs alcim-span / csillag / lablejegyzet a H1-ben');
      assert.doesNotMatch(await p.evaluate(() => document.querySelector('.hero').innerText), /95\s*%|2\s*millió\s*kezelés/i, 'a hero nem hivatkozik a 95% / 2 millió kezelés állításra');
      // a H1 utolso sora legalabb 2 szo (nincs arva-szo): a sorok szavai
      const utolso = await p.evaluate(() => {
        const el = document.querySelector('h1'); const bejaro = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const szavak = []; let n;
        while ((n = bejaro.nextNode())) { const re = /\S+/g; let m; while ((m = re.exec(n.nodeValue))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const k = r.getClientRects(); if (k.length) szavak.push(Math.round(k[k.length - 1].top)); } }
        const veg = szavak[szavak.length - 1]; return szavak.filter((t) => Math.abs(t - veg) < 5).length;
      });
      assert.ok(utolso >= 2 || ossz === 1, `${szeles}px: a H1 utolso sora ${utolso} szo`);
      // hero-sorrend (fentrol lefele): H1 -> kep -> alcim (lead) -> arak -> gombok -> ertekeles -> hely
      const y = await p.evaluate(() => {
        const t = (s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
        return { h1: t('.hero h1'), kep: t('.hero .hero-galeria'), lead: t('.hero .hero-lead'), arak: t('.hero .hero-arak'), cta: t('.hero .hero-cta'), ert: t('.hero .hero-ertekeles'), hely: t('.hero .hero-hely') };
      });
      assert.ok(y.h1.bottom <= y.kep.top + 1, `${szeles}px: a cim a kep felett`);
      assert.ok(y.kep.bottom <= y.lead.top + 1, `${szeles}px: az alcim a kep alatt`);
      assert.ok(y.lead.bottom <= y.arak.top + 1 && y.arak.bottom <= y.cta.top + 1 && y.cta.bottom <= y.ert.top + 1 && y.ert.bottom <= y.hely.top + 1, `${szeles}px: alcim, arak, gombok, ertekeles, hely sorrend`);
      await ctx.close();
    }
    // asztalon a kep a szoveg mellett van (a cim + szoveg oszlop es a kep egyforma magas)
    const { p, ctx } = await nyit(nev, { szeles: 1280 });
    const r = await p.evaluate(() => { const a = (s) => document.querySelector(s).getBoundingClientRect(); return { h1: a('.hero h1'), sz: a('.hero .hero-szoveg'), kep: a('.hero .hero-galeria') }; });
    assert.ok(r.kep.left >= r.sz.right - 1, 'asztalon a kep a szoveg mellett (jobb oldalt)');
    assert.ok(Math.abs(r.sz.bottom - r.kep.bottom) <= 8 && Math.abs(r.h1.top - r.kep.top) <= 12, `a cim + szoveg es a kep egyforma magas (${Math.round(r.sz.bottom - r.h1.top)} / ${Math.round(r.kep.height)})`);
    await ctx.close();
  });

  test('NINCS "majus" / "majusi" / "10%" / kedvezmeny-felirat / athuzott ar az oldalon (a forrasban sem), nincs ures promo-cimke; a fejlec-lablec valtozatlan', async () => {
    assert.doesNotMatch(FORRAS.replace(/<!--[\s\S]*?-->/g, ''), /m[aá]jus|10\s*%|kedvezm[eé]ny|class="promo|promo-sor|<s>/i, 'a forrasban nincs majus / 10% / kedvezmeny / promo / athuzott ar');
    const { p, ctx } = await nyit(nev);
    const szoveg = await p.evaluate(() => document.querySelector('main').innerText + ' ' + [...document.querySelectorAll('main .gyik details')].map((d) => d.textContent).join(' '));
    assert.doesNotMatch(szoveg, /m[aá]jus|10\s*%|kedvezm[eé]ny|nyár|tavasz/i, 'nincs majusi / nyari / tavaszi / kedvezmenyre utalo szoveg');
    assert.equal(await p.locator('main .promo, main .promo-sor, main s, main del, main strike').count(), 0, 'nincs promo-cimke / athuzott ar');
    assert.equal(await p.$$eval('main p, main span, main div', (l) => l.filter((e) => !e.children.length && !e.textContent.trim() && !e.matches('.h1-vessz')).length), 0, 'nincs ures szoveg-elem');
    await ctx.close();
  });

  test('ARAK: a fo /oxigenterapia-budapest (Salonic) szerint: hajkamera 4 990, elso kezeles 29 900 (80 perc), 2. alkalomtol 26 000; nincs 120 perc / 33 900 / 43 900; az arak minden helyen egyeznek; az Arc + Haj ar a regi oldalon valtozatlan', async () => {
    const fo = olvas('foglalas/oxigenterapia-budapest.html');
    const foAr = (osztaly) => (new RegExp(`<p class="${osztaly}">([\\d  ]+) Ft</p>`).exec(fo) || [])[1].replace(/\D/g, '');
    // a fo oldal arai (Salonic 466147 / 466110 / 466158): ezek az igazsag
    const ARAK = { vizsgalat: '4990', elso: foAr('osszeg'), masodik: '26000' };
    assert.deepEqual(ARAK, { vizsgalat: '4990', elso: '29900', masodik: '26000' }, 'a fo oldal arai');
    assert.match(fo, /80 perces/, 'a fo oldal szerint az elso kezeles 80 perces');
    const { p, ctx } = await nyit(nev);
    const szam = (s) => s.replace(/\D/g, '');
    // hero ar-sav
    assert.deepEqual(await p.$$eval('.hero-arak li', (l) => l.map((x) => x.querySelector('b').textContent)).then((l) => l.map(szam)), [ARAK.vizsgalat, ARAK.elso, ARAK.masodik]);
    assert.match(await p.textContent('.hero-arak li:nth-child(2)'), /80/);
    // arkartyak
    const kartyak = await p.$$eval('.ar-kartya', (l) => l.map((k) => ({ cim: k.querySelector('h3').textContent, ar: k.querySelector('.ferfi-ar b').textContent, masodik: k.querySelector('.masodik').textContent, ido: k.querySelector('.idotartam').textContent, pipa: k.querySelectorAll('.pipak li').length })));
    assert.equal(kartyak.length, 2);
    assert.equal(kartyak[0].cim, 'Haj csomag');
    assert.equal(szam(kartyak[0].ar), ARAK.elso);
    assert.equal(szam(kartyak[0].masodik.split(':')[1]), ARAK.masodik);
    assert.match(kartyak[0].ido, /80 perc/);
    // az Arc + Haj csomag arai (39 900 / 34 900 / 120 perc) a regi oldalrol valtozatlanok - a Salonic nem tartalmazza (megerositesre var, lasd OXIGEN-LANDING.md "Ferfi oxigen oldal")
    assert.deepEqual([kartyak[1].cim, szam(kartyak[1].ar), szam(kartyak[1].masodik.split(':')[1]), kartyak[1].pipa], ['Arc + Haj csomag', '39900', '34900', 12]);
    const mind = await p.evaluate(() => document.querySelector('main').innerText);
    assert.doesNotMatch(mind, /120 perces|33\.900|43\.900|33 900|43 900|2 óra/, 'nincs elavult 120 perces / athuzott ar');
    assert.ok(!/\b(891)\b/.test(mind) && !/közel 1\.000/.test(mind), 'nincs 891 / "kozel 1.000"');
    // GYIK 4: a fo oldal arai + a regi Haj + Arc ar
    const gy4 = await p.evaluate(() => document.querySelectorAll('main .gyik details')[3].textContent);
    for (const a of ['29.900', '26.000', '4.990', '39.900', '34.900']) assert.ok(gy4.includes(a), 'GYIK 4: ' + a);
    assert.doesNotMatch(gy4, /etesén/, 'elírás javítva');
    // a "Hany alkalom" blokk
    assert.match(mind, /Haj esetén az első alkalom \(állapotfelméréssel együtt\) 29\s900\sFt, a 2\.\salkalomtól 26\s000\sFt/);
    // az oldal MINDEN szamszeru ara visszavezetheto a fo oldalra / a regi Arc-arakra
    const engedett = new Set(['4990', '29900', '26000', '39900', '34900']);
    const arak = [...mind.matchAll(/(\d{1,3}(?:[.\s ]\d{3}))\s*Ft/g)].map((m) => szam(m[1]));
    assert.deepEqual([...new Set(arak)].filter((a) => !engedett.has(a)), [], 'ismeretlen ar az oldalon');
    await ctx.close();
  });

  test('ERTEKELES + TERKEP + EREDMENYEK: nem visznek ki az oldalrol: belso gorgetes [data-gorget] gombokkal (nincs #hash, nincs navigacio, nincs uj lap), a cel H2-re kerul a fokusz; nincs kulso Google-link a heroban / velemenyek blokkban', async () => {
    assert.doesNotMatch(FORRAS.replace(/<!--[\s\S]*?-->/g, ''), /href="#(?!i-)|maps\.app\.goo\.gl|g\.page|search\.google\.com|oxigenterapia-budapest#comp-/, 'nincs #horgony-link / rovid Google-link / halott Wix-horgony');
    const { p, ctx } = await nyit(nev, { szeles: 390 });
    const gombok = await p.$$eval('[data-gorget]', (l) => l.map((g) => [g.tagName, g.getAttribute('type'), g.getAttribute('data-gorget'), g.hasAttribute('href')]));
    assert.deepEqual(gombok.map((g) => g[2]).sort(), ['eredmenyek', 'helyszin', 'velemenyek']);
    assert.ok(gombok.every((g) => g[0] === 'BUTTON' && g[1] === 'button' && !g[3]), 'a gombok <button type=button>, nincs href');
    // a heroban nincs kulso (http) link; a velemenyek-blokkban csak a Trustindex betolto tartaleka
    assert.equal(await p.locator('.hero a[href^="http"]').count(), 0, 'a heroban nincs kulso link');
    assert.equal(await p.locator('.hero a[href*="google"]').count(), 0);
    assert.deepEqual(await p.$$eval('#velemenyek a[href^="http"]', (l) => l.map((a) => !!a.closest('.ti-hely'))).then((l) => l.every(Boolean)), true, 'a velemenyek-blokkban csak a Trustindex-tartalek link');
    // a kulso (maps) link: a betoltes utan csak a terkep-blokk "Utvonaltervezes" gombja; a Trustindex-betolto tartaleka (kulso Google-link) a forrasban a helykitoltoben van, a keret megjelenesekor eltunik
    const kulso = await p.$$eval('main a[href^="http"]', (l) => l.map((a) => [a.textContent.replace(/\s+/g, ' ').trim(), !!a.closest('#helyszin')]));
    assert.deepEqual(kulso, [['Útvonaltervezés →', true]]);
    assert.match(FORRAS, /<div class="ti-hely" id="ti-hely">\s*<p>Vélemények betöltése…<\/p>\s*<a class="link-gomb" href="https:\/\/www\.google\.com\/maps\/search\/[^"]*"[^>]*>Megnyitás a Google Térképen<\/a>/);
    assert.equal((FORRAS.match(/<a [^>]*href="https?:\/\/[^"]*"/g) || []).length, 2, 'a forrasban pontosan 2 kulso link van: a Trustindex-tartalek + az Utvonaltervezes');
    const url0 = p.url();
    for (const cel of ['velemenyek', 'helyszin', 'eredmenyek']) {
      await p.evaluate(() => { window.scrollTo(0, 0); });
      await p.waitForTimeout(80);
      const y0 = await p.evaluate(() => window.scrollY);
      const lapok = ctx.pages().length;
      await p.click(`[data-gorget="${cel}"]`);
      await p.waitForFunction((c) => { const r = document.getElementById(c).getBoundingClientRect(); return Math.abs(r.top - 70) < 90 || (r.top < 200 && r.top > -50); }, cel, { timeout: 4000 });
      assert.equal(p.url(), url0, `${cel}: az URL nem valtozott (nincs #hash / navigacio)`);
      assert.equal(new URL(p.url()).hash, '');
      assert.equal(ctx.pages().length, lapok, `${cel}: nem nyilt uj lap`);
      assert.ok(await p.evaluate(() => window.scrollY) > y0 + 200, `${cel}: az oldal legordult`);
      const fokusz = await p.evaluate((c) => { const h = document.getElementById(c).querySelector('h2'); return [document.activeElement === h, h.getAttribute('tabindex')]; }, cel);
      assert.deepEqual(fokusz, [true, '-1'], `${cel}: a cel H2-re kerul a fokusz`);
    }
    assert.equal(p.url(), url0);
    await ctx.close();
  });

  test('Trustindex-velemenyek (#trustindex, data-embed) es terkep (#terkep): a helykitolto -> keret / gomb -> iframe; a Google-ertekeles szama az elo minta (data-ertekeles-db)', async () => {
    const { p, ctx } = await nyit(nev);
    assert.equal(await p.getAttribute('#trustindex', 'data-embed'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    await p.waitForSelector('#trustindex iframe', { timeout: 4000 });
    assert.equal(await p.getAttribute('#trustindex iframe', 'src'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    assert.equal(await p.locator('#ti-hely').count(), 0, 'a helykitolto lecserelodott a kerettel');
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html')));
    // az ertekeles egyseges mintaja (a build GV_MINTA-ja cseréli az elo szamra): "4,9 – <szam> ... ertekeles / velemeny"
    assert.equal(await p.locator('[data-ertekeles-db]').count(), 2, 'hero + velemenyek-cim');
    const GV_MINTA = /(?:\d{1,2}[.,\u00a0 \u202f]\d{3}|\d{3,5})\+?\s*(?:db\s+)?(?:Google[- ](?:v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)|Google reviews|vend[eé]gv[eé]lem[eé]ny|val[oó]di [eé]rt[eé]kel[eé]s|v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)/i;
    assert.ok(GV_MINTA.test(await p.textContent('.hero-ertekeles')) && GV_MINTA.test(await p.textContent('#velemenyek-cim')), 'a build google-szam.js mintaja illeszkedik');
    assert.ok(GV_MINTA.test(await p.getAttribute('.hero-ertekeles', 'aria-label')));
    assert.equal(await p.locator('[data-gv-ki]').count(), 0, 'nincs kihagyott (beegetett) ertekeles-szam');
    // terkep
    const doboz = p.locator('#terkep');
    await doboz.scrollIntoViewIfNeeded();
    assert.match(await doboz.innerText(), /Térkép: a tartalom külső szolgáltatótól \(Google\) töltődik be\./);
    assert.equal(await doboz.locator('a').count(), 0, 'a terkep-helykitoltoben nincs kulso link');
    await doboz.locator('button', { hasText: 'Térkép megjelenítése' }).click();
    await p.waitForSelector('#terkep iframe', { timeout: 3000 });
    assert.equal(await p.locator('#terkep-hely').count(), 0);
    await ctx.close();
  });

  test('a regi oldal MINDEN szovege, kepe, linkje megvan (tartalom-hűseg) - a tulajdonos kerte / a fo oldal szerint javitott helyek (VALTOZTATOTT) kivetelevel', async () => {
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
      if (!uj.includes(sz) && !(/^\s*\d+\./.test(nyers) && uj.includes(szamNelkul))) hianyzo.push(nyers.slice(0, 110));
    }
    const { maradt } = valtoztatottSzurt(hianyzo);
    assert.deepEqual(maradt, [], 'a regi oldal szovegei, amik nincsenek meg es nincsenek a VALTOZTATOTT listaban');
    assert.ok(hianyzo.length >= 15, 'a valtoztatott helyek szama: ' + hianyzo.length);
    // kepek: a regi HTML MINDEN tartalmi kepe (fejlec / ikonok nelkul) az uj oldalon
    const regiHtml = olvas(`klon/${nev}.html`);
    const eleje = regiHtml.indexOf('81f16bfc67fb');
    // a ket dekoracios hatterkep (a GYIK-szekcio "nsplsh_38734f5a4a38..." es a terkep-szekcio "11062b_c676302884b3...") a Wix szekcio-hattere: nem kerul az uj oldalra
    const DEKORACIO = ['38734f5a4a38', 'c676302884b3'];
    const azonosito = [...new Set([...regiHtml.slice(eleje).matchAll(/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})[0-9a-f]{8,}\.(?:jpe?g|png|webp)/g)].map((m) => m[1]))].filter((k) => !DEKORACIO.includes(k));
    assert.ok(azonosito.length >= 33, 'a regi oldal kepeinek listaja: ' + azonosito.length);
    const html = await p.content();
    assert.deepEqual(azonosito.filter((k) => !html.includes(k)), [], 'hianyzo kepek (a regi oldal HTML-je szerint)');
    // linkek: minden gomb / szovegbeli link a regi oldalrol, kiveve a valtoztatott / halott linkek
    const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    const regiLinkek = [...sorok.filter((s) => s.t === 'GOMB').map((s) => /\s->\s+(\S+)\s*$/.exec(s.raw)?.[1]), ...sorok.flatMap((s) => [...s.raw.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))].filter(Boolean);
    assert.ok(regiLinkek.length >= 10, 'a regi oldal linkjei: ' + regiLinkek.length);
    const hianyzoLink = [...new Set(regiLinkek)].filter((h) => !hrefek.includes(h));
    assert.deepEqual(hianyzoLink.filter((h) => !regiLinkValtozott.some(([re]) => re.test(h))), [], 'hianyzo linkek');
    assert.deepEqual(regiLinkValtozott.filter(([re]) => !hianyzoLink.some((h) => re.test(h))).map((x) => String(x[0])), [], 'a regiLinkValtozott lista minden tetele ervenyes');
    await ctx.close();
  });

  test('FUGGETLEN tartalom-hűseg: a regi oldal HTML-jenek MINDEN szovegcsomopontja megvan az uj oldalon (a fejlec / menu / info-panel szovegei nelkul), a VALTOZTATOTT helyek kivetelevel; a kijavitott elirasok MAR nincsenek', async () => {
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
    const hianyzo = tartalom.filter((c) => norm(c).length >= 8 && !uj.includes(norm(c)) && !uj.includes(norm(c.replace(/^\s*\d+\.\s*/, '')))).map((c) => c.replace(/\s+/g, ' ').trim());
    assert.ok(tartalom.length > 150, 'a regi oldal szovegcsomopontjai: ' + tartalom.length);
    // a tordelt csomopontok ("Férfi Oxigénterápia kopaszodás" / "és foltos szakáll ellen", "Csak Arc: ... helyett" / "29.900 Ft / 2 óra"): a VALTOZTATOTT mintak + a reszletek
    const EXTRA = [/^és foltos szakáll ellen$/, /^[\d.]+ Ft \/ 2 óra$/, /^Ár: .*helyett [\d.]+ Ft$/, /^Csak Arc: .*helyett$/, /^Arc \+ Haj: .*helyett$/, /^Haj csomag|^Arc \+ Haj csomag/, /^(értékelés közel|1\.000 véleményből)$/,
      /^Nálunk nincs bérlet, de a csomagokban így is megkapod a$|^11\.000 Ft - 21\.000 Ft-os kedvezményt, alkalmanként fizetve$/, /^olyan érzés mintha egy 30\.000 Ft-os/, /^az arc esetén pedig tiszító/, /^Az OXYGENI organikus, kemikáliamentes termékekeit/,
      /^megszáírtjuk a hajat$/, /^Vasárnap$/, /^Google 4,9 - 891/, /^Az alkalmak számát a hajhossz és az határozza meg/, /^Sok helyen székbe/, /^✅ Megállított/];
    const maradt = valtoztatottSzurt(hianyzo).maradt.filter((x) => !EXTRA.some((re) => re.test(x)));
    assert.deepEqual(maradt, [], 'a regi oldal szovegei, amik nincsenek meg az ujban es nincsenek a VALTOZTATOTT listaban');
    // a kijavitott elirasok mar nincsenek az oldalon
    const mind = await p.evaluate(() => document.querySelector('main').innerText + ' ' + [...document.querySelectorAll('main .gyik details')].map((d) => d.textContent).join(' '));
    for (const hiba of ['hajhagymákat.Kopaszodás', 'sűrűsödő ő haj', 'Akorpától', 'termékekeit', 'megszáírtjuk', 'tiszító', 'etesén', 'peacmaker', 'asthma,COPD', 'mi dolgozunk. A', 'kezelőágy egy privát']) assert.ok(!mind.includes(hiba), 'elírás maradt: ' + hiba);
    for (const jo of ['hajhagymákat. Kopaszodás', 'sűrűsödő haj', 'A korpától', 'termékeit', 'megszárítjuk', 'tisztító', 'pacemaker', 'asthma, COPD']) assert.ok(mind.includes(jo.replace(/ /g, ' ')) || mind.replace(/\u00a0/g, ' ').includes(jo), 'javitott szoveg hianyzik: ' + jo);
    await ctx.close();
  });

  test('szerkezet: 4 eredmeny-galeria (6 / 3 / 3 / 3) + a szalon 19 kepe (ugyanabban a sorrendben), 3 "miert" kartya, 2 arkartya, 9 lepes, 3 pipa-lista; GYIK: 10 kerdes + valasz szo szerint (a 4. az uj arakkal)', async () => {
    const { p, ctx } = await nyit(nev);
    const gal = galeriak();
    const nevek = (sel) => p.$$eval(sel, (l) => l.map((sav) => [...sav.querySelectorAll('img')].map((i) => i.getAttribute('src').split('/').pop())));
    assert.deepEqual(await nevek('.ba-csoport .ba-sav'), GALERIAK.slice(0, 4).map((k) => gal[k].map(([kep]) => kep)));
    assert.deepEqual(await nevek('.fgal .fgal-sav'), [gal[GALERIAK[4]].map(([kep]) => kep)], 'a szalon-galeria kepei a regi oldal szerint');
    assert.deepEqual(GALERIAK.map((k) => gal[k].length), [6, 3, 3, 3, 19]);
    assert.deepEqual(await p.$$eval('.ba-csoport', (l) => l.map((c) => c.querySelectorAll('.ba').length)), [6, 3, 3, 3]);
    assert.deepEqual(await p.$$eval('.ba-csoport h2', (l) => l.map((h) => h.textContent)), ['Látható Eredmények hajhullás esetén', 'Valós Eredmények korpás haj esetén', 'Átütő Eredmények pikkelysömör esetén', 'Szembetűnő Eredmények seborrea esetén']);
    assert.equal(await p.locator('.miert-kartya').count(), 3);
    assert.equal(await p.locator('.lepes-lista li').count(), 9);
    assert.deepEqual(await p.$$eval('.pipa-lista', (l) => l.map((u) => u.children.length)), [5, 5, 8]);
    // GYIK
    const gy = gyikAdat();
    const kerdesek = await p.$$eval('main .gyik details', (l) => l.map((d) => ({ k: d.querySelector('summary').textContent.trim(), v: [...d.querySelectorAll(':scope > p')].map((x) => x.textContent).join(' ') })));
    assert.equal(kerdesek.length, 10);
    assert.equal(kerdesek.length, gy.length);
    const JAVITOTT = new Set([3, 9]);   // 4. (arak: a fo oldal szerint) es 10. (elirasok: asthma, COPD / pacemaker)
    gy.forEach(([k, v], i) => {
      assert.equal(kerdesek[i].k, k);
      if (!JAVITOTT.has(i)) assert.equal(norm(kerdesek[i].v), norm(v.replace(/<[^>]*>/g, ' ')), 'GYIK ' + (i + 1));
    });
    assert.match(kerdesek[9].v, /asthma, COPD.*pacemaker/);
    await ctx.close();
  });

  test('foglalo-gombok: a hero ket fo gombja ("Hajkamerás felmérés – 4 990 Ft" -> service=466147, fo / arany; Elso kezeles 29 900 Ft -> 466110), a Haj csomag gombjai, a tobbi a /foglalo-motor?business=oxygen; mobil sticky CTA; fejlec-lablec jelolok', async () => {
    const { p, ctx } = await nyit(nev);
    const gombok = await p.$$eval('main a[href^="/foglalo-motor"]', (l) => l.map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').replace(/→/, '').trim()]));
    assert.deepEqual(gombok.map((g) => g[0]), [HAJVIZSGALAT, ELSO_KEZELES, FOGLALO, FOGLALO, ELSO_KEZELES, HAJVIZSGALAT, FOGLALO, FOGLALO, FOGLALO, FOGLALO]);
    assert.deepEqual(gombok.map((g) => g[1]), ['Hajkamerás felmérés – 4 990 Ft', 'Első kezelés 29 900 Ft', 'IDŐPONTFOGLALÁS', 'IDŐPONTFOGLALÁS', 'Első kezelés – 29 900 Ft', 'Csak hajkamerás felmérés – 4 990 Ft', 'FOGLALOK!', 'BEJELENTKEZEK!', 'IDŐPONT FOGLALÁS', 'IDŐPONTFOGLALÁS']);
    assert.match(await p.getAttribute('.hero-cta a:first-child', 'class'), /gomb-arany/, 'a Hajkamerás felmérés a fo (arany) gomb');
    assert.match(await p.getAttribute('.hero-cta a:last-child', 'class'), /gomb-korvonal/);
    const oldal = await p.textContent('body');
    assert.ok(oldal.includes('Szőrtelenítés') && oldal.includes('Ajándékkártya'), 'fejlec (fomenu)');
    assert.ok(oldal.includes('Big in Japan Kft.'), 'lablec');
    // a jelolok (a build teszi a fejlec / lablec gombjait a hajvizsgalat foglalojara es a nyitvatartast H-P-re)
    const { foglalasCel, nyitvatartasHetkoznap, FOGLALAS_JELOLO, NYITVATARTAS_JELOLO } = await import(pathToFileURL(path.join(GYOKER, 'tools/fejlec-menu.mjs')).href);
    assert.equal((FORRAS.match(FOGLALAS_JELOLO) || [])[1], 'business=oxygen&service=466147');
    assert.ok(NYITVATARTAS_JELOLO.test(FORRAS));
    for (const f of ['fejlec-asztali', 'lablec-asztali', 'lablec-mobil', 'fejlec-mobil']) {
      const fajl = path.join(GYOKER, 'assets/fejlec', f + '.html');
      if (!fs.existsSync(fajl)) continue;
      const atalakitott = nyitvatartasHetkoznap(foglalasCel(fs.readFileSync(fajl, 'utf8'), 'business=oxygen&service=466147'));
      assert.doesNotMatch(atalakitott, /Hétfő – Szombat/, f + ': nincs szombat');
      assert.doesNotMatch(atalakitott, /href="\/idpontfoglalas"/, f + ': a foglalas gomb nem a regi /idpontfoglalas');
    }
    await ctx.close();
    // mobil sticky CTA: a hero elgorgetese utan jelenik meg, a helyszin-blokknal eltunik; a Hajvizsgalat a fo gombja
    const m = await nyit(nev, { szeles: 390 });
    const sticky = m.p.locator('#sticky-cta');
    assert.equal(await sticky.evaluate((e) => e.classList.contains('lathato')), false, 'a lap tetejen nem latszik');
    assert.deepEqual(await sticky.locator('a').evaluateAll((l) => l.map((a) => a.getAttribute('href'))), [HAJVIZSGALAT, ELSO_KEZELES]);
    await m.p.evaluate(() => { window.scrollTo(0, document.querySelector('.hero').getBoundingClientRect().bottom + window.scrollY + 400); });
    await m.p.waitForFunction(() => document.getElementById('sticky-cta').classList.contains('lathato'), null, { timeout: 3000 });
    await m.p.waitForTimeout(500);
    const dobozSticky = await sticky.boundingBox();
    assert.ok(dobozSticky.y + dobozSticky.height <= 845 && dobozSticky.y > 700, 'a sticky sav a kepernyo aljan latszik');
    await m.p.evaluate(() => { window.scrollTo(0, document.getElementById('helyszin').getBoundingClientRect().top + window.scrollY - 100); });
    await m.p.waitForFunction(() => !document.getElementById('sticky-cta').classList.contains('lathato'), null, { timeout: 3000 });
    await m.ctx.close();
  });

  test('szalon-galeria: lapozhato (>= 3 kep, 19), fix keparany, lusta toltes, nyilak, pottyos jelzo, szamlalo, bal / jobb billentyu, aria-cimkek; telefonon egy kep + a kovetkezo kikukucskal (scroll-snap)', async () => {
    const { p, ctx } = await nyit(nev, { szeles: 1280 });
    const gal = p.locator('.fgal');
    await gal.scrollIntoViewIfNeeded();
    assert.equal(await p.locator('.fgal-dia').count(), 19);
    assert.ok((await p.locator('.fgal-dia').count()) >= 3);
    assert.deepEqual(await gal.evaluate((e) => [e.getAttribute('role'), e.getAttribute('aria-roledescription'), e.getAttribute('aria-label'), e.getAttribute('tabindex')]), ['region', 'carousel', 'A felújított szalon fotói', '0']);
    assert.equal(await p.locator('.fgal-dia[role="group"][aria-roledescription="slide"]').count(), 19);
    assert.equal(await p.getAttribute('.fgal-dia:nth-child(3)', 'aria-label'), '3 / 19');
    // fix keparany + lusta toltes (a forrasban minden kep lazy), a doboz meretei egyformak
    assert.equal((FORRAS.match(/<figure class="fgal-dia"[^>]*><img [^>]*loading="lazy"/g) || []).length, 19, 'a szalon-galeria mind a 19 kepe lusta toltesu (a forrasban)');
    const arany = await p.$$eval('.fgal-dia', (l) => [...new Set(l.map((d) => (d.getBoundingClientRect().width / d.getBoundingClientRect().height).toFixed(2)))]);
    assert.deepEqual(arany, ['1.50'], 'minden dia 3:2 (nincs ugralo magassag)');
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('.fgal-sav')).scrollSnapType), /x mandatory/);
    assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.fgal-sav')).overflowX), 'auto');
    // JS utan: nyilak + pottyok + szamlalo
    assert.equal(await p.locator('.fgal .lapozo.elozo').isVisible(), true);
    assert.equal(await p.locator('.fgal .lapozo.kovetkezo').isVisible(), true);
    assert.equal(await p.locator('.fgal-pontok button').count(), 19);
    assert.equal(await p.locator('.fgal-pontok button[aria-current="true"]').count(), 1);
    assert.equal(await p.getAttribute('.fgal-pontok button:nth-child(5)', 'aria-label'), '5. kép');
    assert.equal(await p.locator('.fgal .lapozo.elozo').isDisabled(), true, 'az elejen az elozo nyil letiltva');
    assert.match(await p.textContent('.fgal-szamlalo'), /^1–3 \/ 19$/);
    const sav = p.locator('.fgal-sav');
    const x0 = await sav.evaluate((e) => e.scrollLeft);
    await p.click('.fgal .lapozo.kovetkezo');
    await p.waitForFunction(() => document.querySelector('.fgal-sav').scrollLeft > 100, null, { timeout: 3000 });
    assert.ok(await sav.evaluate((e) => e.scrollLeft) > x0, 'a kovetkezo nyil lapoz');
    await p.waitForTimeout(500);
    assert.equal(await p.locator('.fgal-pontok button').nth(1).getAttribute('aria-current'), 'true', 'a jelzo a 2. kepre ugrott');
    assert.match(await p.textContent('.fgal-szamlalo'), /^2–4 \/ 19$/);
    // billentyuk
    await gal.focus();
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(600);
    assert.match(await p.textContent('.fgal-szamlalo'), /^3–5 \/ 19$/);
    await p.keyboard.press('ArrowLeft');
    await p.waitForTimeout(600);
    assert.match(await p.textContent('.fgal-szamlalo'), /^2–4 \/ 19$/);
    await p.keyboard.press('End');
    await p.waitForTimeout(900);
    assert.equal(await p.locator('.fgal .lapozo.kovetkezo').isDisabled(), true, 'a vegen a kovetkezo nyil letiltva');
    assert.equal(await p.locator('.fgal-pontok button[aria-current="true"]').getAttribute('aria-label'), '19. kép');
    await p.keyboard.press('Home');
    await p.waitForTimeout(900);
    assert.equal(await p.locator('.fgal .lapozo.elozo').isDisabled(), true);
    // pont-kattintas
    await p.click('.fgal-pontok button:nth-child(10)');
    await p.waitForTimeout(900);
    assert.equal(await p.locator('.fgal-pontok button[aria-current="true"]').getAttribute('aria-label'), '10. kép');
    await ctx.close();
    // telefon: egy kep egyszerre (+ a kovetkezo kikukucskal), huzas = gorgetes + scroll-snap
    const m = await nyit(nev, { szeles: 390 });
    const r = await m.p.evaluate(() => { const sav = document.querySelector('.fgal-sav').getBoundingClientRect(); const d = document.querySelectorAll('.fgal-dia'); const a = d[0].getBoundingClientRect(), b = d[1].getBoundingClientRect(); return { sav: sav.width, elso: a.width, masodik: b.left, jobb: sav.right }; });
    assert.ok(r.elso / r.sav > 0.8 && r.elso / r.sav < 0.95, `telefonon egy kep egyszerre (${Math.round(r.elso)} / ${Math.round(r.sav)})`);
    assert.ok(r.masodik < r.jobb - 10, 'a kovetkezo kep kikukucskal (huzhato)');
    await m.p.evaluate(() => { const s = document.querySelector('.fgal-sav'); s.scrollTo({ left: s.clientWidth * 0.9, behavior: 'auto' }); });
    await m.p.waitForTimeout(500);
    assert.match(await m.p.textContent('.fgal-szamlalo'), /^2 \/ 19$/);
    assert.ok(await m.p.locator('.fgal-pontok').isVisible());
    await m.ctx.close();
  });

  test('ASZTALON az egymas melletti kep + szoveg hasabok egyforma magasak (1280 / 1440 px): hero, "igy mukodik", haj / arc, alkalom, lepesek, termekek, palack, ferfi vendegek, kezeloagy, arkartyak, 3 ok, hely + terkep', async () => {
    for (const szeles of [1440, 1280, 1920]) {
      const { p, ctx } = await nyit(nev, { szeles });
      const r = await p.evaluate(() => {
        const ki = [];
        for (const g of document.querySelectorAll('.allapot-racs, .fblokk-racs, .hely-racs, .arak-ketto, .miert-racs')) {
          const gy = [...g.children].filter((c) => c.getBoundingClientRect().width > 0);
          const rs = gy.map((c) => c.getBoundingClientRect());
          const egymasMellett = rs.some((a, i) => rs.some((b, j) => i !== j && a.right <= b.left + 1 && a.top < b.bottom && b.top < a.bottom));
          ki.push({ cim: ((g.querySelector('h2, h3') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 30), egymasMellett, mag: gy.map((c) => c.offsetHeight) });
        }
        return ki;
      });
      assert.ok(r.length >= 12, `${szeles}px: a vizsgalt hasab-parok szama ${r.length}`);
      for (const x of r) {
        assert.ok(x.egymasMellett, `${szeles}px: ${x.cim}: a hasabok egymas mellett vannak`);
        assert.ok(Math.max(...x.mag) - Math.min(...x.mag) <= 2, `${szeles}px: ${x.cim}: egyforma magassag (${x.mag.join(' / ')})`);
      }
      // a kepek kitoltik a dobozukat (nem lognak ki, nem maradnak ures savok): a kep-doboz es a szoveg-doboz alja egy vonalban
      const alj = await p.evaluate(() => [...document.querySelectorAll('.fblokk-racs')].map((g) => { const k = g.querySelector('.fkep').getBoundingClientRect(), s = g.querySelector('.fszoveg').getBoundingClientRect(); return [Math.abs(k.top - s.top), Math.abs(k.bottom - s.bottom)]; }));
      assert.ok(alj.every(([a, b]) => a <= 1.5 && b <= 1.5), `${szeles}px: a kep es a szoveg teteje / alja egy vonalban`);
      // hero: a cim + szoveg oszlop es a kep egyforma magas
      const h = await p.evaluate(() => { const a = (s) => document.querySelector(s).getBoundingClientRect(); return { h1: a('.hero h1'), sz: a('.hero .hero-szoveg'), kep: a('.hero .hero-galeria') }; });
      assert.ok(Math.abs(h.sz.bottom - h.kep.bottom) <= 8, `${szeles}px: hero egyforma magas`);
      // a feliratos kep (haj / arc abra, kezeloagy infografika) nincs levagva: contain
      assert.deepEqual(await p.$$eval('.fkep.diagram img, .fkep.info img', (l) => l.map((i) => getComputedStyle(i).objectFit)), ['contain', 'contain', 'contain']);
      await ctx.close();
    }
  });

  test('MOBILON tomorebb oldal (teljes magassag <= 17 000 px 390-en; a regi 20 412 px volt), a "3 ok" vizszintes kompakt kartyak, az arkartyak fejlece kepes-cimes', async () => {
    const { p, ctx } = await nyit(nev, { szeles: 390 });
    const mag = await p.evaluate(() => document.documentElement.scrollHeight);
    assert.ok(mag <= 17000, `oldalmagassag 390 px-en: ${mag}`);
    const k = await p.$$eval('.miert-kartya', (l) => l.map((c) => { const i = c.querySelector('img').getBoundingClientRect(), d = c.querySelector('div').getBoundingClientRect(); return [c.getBoundingClientRect().height, i.right <= d.left + 1]; }));
    assert.ok(k.every(([h, mellett]) => h < 240 && mellett), `a 3 ok kartyai vizszintesek es kompaktak (${k.map((x) => Math.round(x[0])).join(' / ')})`);
    const ar = await p.$$eval('.ar-kartya', (l) => l.map((c) => { const i = c.querySelector('.ar-kep').getBoundingClientRect(), h = c.querySelector('h3').getBoundingClientRect(); return i.right <= h.left + 1 && i.width < 120; }));
    assert.deepEqual(ar, [true, true]);
    // a kepek mobilon is teljesek: a diagram / infografika nincs levagva (contain), a tobbi kep kisebb
    const kepmag = await p.$$eval('.fkep', (l) => l.map((f) => Math.round(f.getBoundingClientRect().height)));
    assert.ok(kepmag.every((h) => h <= 300), 'a kep + szoveg blokkok kepei kompaktak: ' + kepmag.join(','));
    await ctx.close();
  });

  for (const szeles of [412, 390, 360]) {
    test(`telefon (${szeles} px): nincs vizszintes gorgetes, a kepek / szovegek nem lognak ki; ARVA-SOR ellenorzes: nincs 1-2 szavas utolso sor a cimekben, gombokban, jelvenyekben, lista-sorokban, rovid szovegekben`, async () => {
      const { p, ctx } = await nyit(nev, { szeles });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'vizszintes tobblet');
      const kilog = await p.$$eval('main img', (l) => l.filter((i) => !i.closest('.ba-sav, .fgal-sav') && i.getBoundingClientRect().right > innerWidth + 1).map((i) => i.currentSrc.split('/').pop()));
      assert.deepEqual(kilog, [], 'kikilogo kepek');
      assert.ok(await p.locator('.ar-kartya').first().isVisible());
      const keskeny = await p.$$eval('main h1, main h2, main h3, main p, main li', (l) => l.filter((e) => !e.closest('.ba-sav, .fgal-sav') && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.textContent.slice(0, 40)));
      assert.deepEqual(keskeny, [], 'kikilogo szovegek');
      // arva-sor: az utolso sorban <= 2 szo es az a leghosszabb sor felenel rovidebb
      const arva = await p.evaluate(() => {
        const SEL = 'main h1 > span, main h2, main h3, main .gomb, main .c, main .ar, main summary, main li, main figcaption, main dd, main .hero-arak span, main .hero-lab, main .ert-szoveg, main .hero-hely, main p, .sticky-cta a';
        const talalat = [];
        for (const el of document.querySelectorAll(SEL)) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length || el.closest('.ba-sav, .fgal-sav, .ti-doboz, .h1-vessz')) continue;
          const szoveg = el.textContent.replace(/\s+/g, ' ').trim();
          if (el.tagName === 'B' && el.parentElement && /^(P|LI)$/.test(el.parentElement.tagName)) continue;
          if (!szoveg || szoveg.length > 240) continue;   // a hosszu torzs-bekezdesek termeszetesen tordelnek
          if ([...el.children].some((k) => !/^(inline|inline-block|inline-flex)$/.test(getComputedStyle(k).display) || k.tagName === 'BR')) continue;
          const szavak = [];
          const bejaro = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = bejaro.nextNode())) {
            const par = n.parentElement; if (par && par.closest('svg, [aria-hidden="true"]')) continue;
            const re = /[^ \t\n\r]+/g; let m;
            while ((m = re.exec(n.nodeValue))) {
              const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
              const rects = [...r.getClientRects()]; if (!rects.length) continue;
              const rr = rects[rects.length - 1]; szavak.push({ szo: m[0], top: Math.round(rr.top), bal: rr.left, jobb: rr.right });
            }
          }
          if (szavak.length < 3) continue;
          const sorok = [];
          for (const sz of szavak) { const s = sorok.find((x) => Math.abs(x.top - sz.top) < 6); if (s) { s.n++; s.bal = Math.min(s.bal, sz.bal); s.jobb = Math.max(s.jobb, sz.jobb); } else sorok.push({ top: sz.top, n: 1, bal: sz.bal, jobb: sz.jobb }); }
          if (sorok.length < 2) continue;
          const ut = sorok[sorok.length - 1];
          if (ut.n <= 2 && ut.jobb - ut.bal < Math.max(...sorok.map((x) => x.jobb - x.bal)) * 0.55) talalat.push(`${el.tagName.toLowerCase()}: "${szoveg.slice(0, 70)}" (${sorok.length} sor, utolso ${ut.n} szo)`);
        }
        return [...new Set(talalat)];
      });
      assert.deepEqual(arva, [], `${szeles}px: arva-sorok`);
      await ctx.close();
    });
  }

  test('asztali szelessegeken (1920 / 1280 / 1024 / 768) nincs vizszintes gorgetes es nincs konzolhiba', async () => {
    for (const szeles of [1920, 1280, 1024, 768]) {
      const { p, ctx, hibak } = await nyit(nev, { szeles });
      // a kozos (Wixes) fejlec 768 px-en minden oldalon 980 px szeles (nem ennek az oldalnak a hibaja): ott a main-t nezzuk
      assert.equal(await p.evaluate(() => document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth), 0, `${szeles}px: a main vizszintes tobblete`);
      if (szeles !== 768) assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, `${szeles}px: vizszintes tobblet`);
      assert.deepEqual(hibak, [], `${szeles}px: konzolhiba`);
      await ctx.close();
    }
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

  test('mukodes: a hajhullas-galeria lapozoja mozgatja a savot; a GYIK harmonika nyilik; Trustindex / terkep betolt', async () => {
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
    await ctx.close();
  });
});
