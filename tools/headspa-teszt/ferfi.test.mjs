// A Head Spa Ferfiaknak oldal (uj szerkezet; 2026-10-07 ota az eredeti cimen el: /headspa-ferfiaknak) bongeszos tesztjei (Playwright).
// Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (szerver.mjs) allitja ossze az oldalt, minden kulso keres tiltott.
//
//   node --test tools/headspa-teszt/ferfi.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
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
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

const NEV = 'headspa-ferfiaknak';
const CIM = 'Head Spa Férfiaknak? Főleg ha kopasz vagy!';
const H1 = 'Head Spa Férfiaknak. Ennél jobban semmi nem nyugtat meg.';
const FOGLALO = '/foglalo-motor?business=headspa';

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

/** Oldal megnyitasa: kulso forgalom tiltva (naplozva), a helyi keresek naplozva, hibak gyujtve. */
async function nyit(nev = NEV, { szeles = 1440, suti = false } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], kulso = [], nincs = [], helyi = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('request', (r) => { if (r.url().startsWith(bazis)) helyi.push(r.url().replace(bazis, '')); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${bazis}/${nev}`, { waitUntil: 'domcontentloaded' });
  if (suti) await p.getByRole('button', { name: 'Elfogadom' }).click();
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, kulso, nincs, helyi };
}
const fajlLetezik = (href) => {
  const ut = href.split(/[?#]/)[0].replace(/^\//, '').replace(/\/$/, '');
  if (!ut) return true;
  if (ut.startsWith('assets/')) return fs.existsSync(path.join(GYOKER, ut));
  return ['klon', 'foglalas'].some((m) => fs.existsSync(path.join(GYOKER, m, ut + '.html'))) || ut === 'foglalo-motor';
};
// szoveg-egyeztetes: kisbetu, emojik / irasjelek / szokozok nelkul (a regi oldal 👇 🌿 💆 ✔ jelei es a gombfeliratok nagybetui miatt)
const norm = (s) => s.toLowerCase().replace(/[\u200b\u00a0]/g, ' ').replace(/[✔️👇💓🌿👆🙂😊]|💆‍♀️/gu, '').replace(/["„”“”'’‘–—-]/g, '').replace(/[.,:;!?()*+>»«/]/g, '').replace(/\s+/g, ' ').trim();

describe(`/${NEV}`, () => {
  test('betoltodik hibak nelkul: nincs konzol-hiba, 404, torott kep; egyetlen H1; az eredeti oldal cime / hero-cime', async () => {
    const { p, ctx, hibak, nincs } = await nyit();
    assert.equal(await p.title(), CIM);
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.equal((await p.textContent('h1')).replace(/\s+/g, ' ').trim(), H1);
    const torott = await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
    assert.deepEqual(torott, [], 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('eredeti cim: indexelheto (nincs robots meta), canonical / og:url az eredeti cim; az -uj cim 301, a regi Wixes valtozat rejtett -regi cimen', async () => {
    const forras = fs.readFileSync(path.join(GYOKER, 'foglalas', NEV + '.html'), 'utf8');
    assert.ok(!/<meta name="robots"/.test(forras), 'indexelheto');
    assert.ok(forras.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu/${NEV}">`), 'canonical');
    assert.ok(forras.includes(`<meta property="og:url" content="https://www.mosaicheadspa.hu/${NEV}">`), 'og:url');
    // a csere utan: az -uj cim 301, a regi (Wixes) valtozat rejtett -regi cimen (noindex, sajat canonical), az uj oldal az eredeti neven
    const { utvonal } = await import(pathToFileURL(path.join(GYOKER, 'netlify', 'lib', 'utvonal.js')).href);
    assert.deepEqual(utvonal(`/${NEV}-uj`, 'Mozilla/5.0 (Windows NT 10.0)'), { atiranyit: `/${NEV}` }, 'az -uj cim 301');
    assert.ok(!fs.existsSync(path.join(GYOKER, 'foglalas', NEV + '-uj.html')), 'nincs tobbe -uj fajl');
    for (const mappa of ['klon', path.join('klon', 'm')]) {
      const regi = fs.readFileSync(path.join(GYOKER, mappa, NEV + '-regi.html'), 'utf8');
      assert.match(regi, /<meta name="robots" content="noindex(, nofollow)?"\/>/, mappa + ' regi: noindex');
      assert.ok(regi.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu/${NEV}-regi"/>`), mappa + ' regi: canonical');
      assert.ok(fs.existsSync(path.join(GYOKER, mappa, NEV + '.html')), mappa + ': az eredeti klon-fajl megvan (visszaallitashoz)');
    }
  });

  test('a kozos szerkezet: fejlec (aktiv menu), a fejlec akcios savja a MOSAIC szinvilagaban, Playfair / Jost betuk, lablec, mobil sticky CTA elem; nincs Wix-maradvany', async () => {
    const { p, ctx } = await nyit();
    const sav = await p.evaluate(() => {
      const s = document.getElementById('comp-mpv0ganp'); const a = s && s.querySelector('a');
      return s ? { lat: getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().height > 10, bg: getComputedStyle(s.querySelector('[data-testid="colorUnderlay"]')).backgroundColor, szin: a && getComputedStyle(a).color, href: a && a.getAttribute('href') } : null;
    });
    assert.ok(sav && sav.lat, 'az akcios sav latszik');
    assert.equal(sav.bg, 'rgb(230, 235, 231)');
    assert.equal(sav.szin, 'rgb(15, 58, 60)');
    assert.equal(sav.href, '/head-spa-kedvezmeny');
    assert.equal(await p.locator('a.akcio-sav').count(), 0);
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.match(await p.evaluate(() => getComputedStyle(document.body).fontFamily), /Jost/);
    assert.equal(await p.locator('.sticky-cta').count(), 1);
    assert.ok((await p.textContent('body')).includes('Big in Japan Kft.'), 'lablec');
    assert.equal(await p.locator('main [id^="comp-"], main wow-image, main [data-mesh-id]').count(), 0, 'nincs Wix-maradvany');
    assert.equal((await p.textContent('main')).includes('✔'), false, 'a regi pipa-emojik ikon-listara cserelve');
    // a Head Spa Ferfiaknak menupont az aktiv (a fejlec kijeloli)
    assert.equal(await p.locator('a[href="/headspa-ferfiaknak"][aria-current="true"], [data-is-current="true"] a[href="/headspa-ferfiaknak"]').count() > 0, true, 'aktiv menupont');
    await ctx.close();
  });

  test('a regi oldal MINDEN szovege megvan (a klon/ regi valtozat szoveg-soraihoz kepest); egyetlen szandekos kulonbseg: az arlista (a tulajdonos dontese) es a videok hosszanak irasa', async () => {
    const regiFajl = ['headspa-ferfiaknak-regi', 'headspa-ferfiaknak'].map((n) => path.join(GYOKER, 'klon', n + '.html')).find((f) => fs.existsSync(f));
    assert.ok(regiFajl, 'megvan a regi (Wixes) oldal a klon/ mappaban');
    const { p, ctx } = await nyit();
    const uj = norm(await p.evaluate(() => document.querySelector('main').innerText));
    // a regi oldal statikus (JS nelkuli) valtozata: a main-beli szovegek sorai
    const regiCtx = await bongeszo.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const rp = await regiCtx.newPage();
    await rp.route(/^(?!data:)/, (r) => r.abort());
    await rp.setContent(fs.readFileSync(regiFajl, 'utf8'), { waitUntil: 'domcontentloaded' });
    const sorok = await rp.evaluate(() => {
      const out = [];
      for (const e of (document.querySelector('#PAGES_CONTAINER') || document.body).querySelectorAll('[class*="wixui-rich-text"], h1, h2, h3, h4, p, li, [data-testid="linkElement"]')) {
        if (e.parentElement && e.parentElement.closest('[class*="wixui-rich-text"], h1, h2, h3, h4')) continue;
        for (const s of e.textContent.split(/\n+/)) { const t = s.replace(/[\u200b\u00a0]/g, ' ').replace(/\s+/g, ' ').trim(); if (t.length > 2) out.push(t); }
      }
      return out;
    });
    await regiCtx.close();
    assert.ok(sorok.length > 150, 'a regi oldal soraibol sok megvan: ' + sorok.length);
    // az arlista (Head Spa Csomagok es Arak ... Itt talalsz meg minket) kicserelve: az arak oldal 3 csomagos blokkja (lasd lent); a videok hossza 00:36 helyett 0:36
    const arStart = sorok.findIndex((s) => s === 'Head Spa Csomagok és Árak');
    const arVeg = sorok.findIndex((s) => s === 'Itt találsz meg minket');
    assert.ok(arStart > 0 && arVeg > arStart, 'az arlista a regi oldalon megvan');
    const hianyzik = [];
    sorok.forEach((s, i) => {
      if (i > arStart && i < arVeg) return;
      if (/^\d\d:\d\d$/.test(s)) return;
      if (s === '9:00 - 18:00') return;   // a szombati nyitvatartas 8:00 - 20:00-ra valtozott (a tulajdonos dontese: szombaton is nyitva; lasd a nyitvatartas tesztet)
      if (/^Ár: 50 perc \+ 30 perc szárítás - 32\.900 Ft helyett 29\.900 Ft$/.test(s)) return;   // a hero ar-sora a mai (oktoberi) arra frissitve: 26.900 Ft (lasd a hero-ar tesztet)
      const n = norm(s);
      if (n.length < 3 || uj.includes(n)) return;
      hianyzik.push(s);
    });
    assert.deepEqual(hianyzik, [], 'hianyzo sorok az uj oldalon');
    // a videok hossza megvan (0:36 irassal)
    for (const s of sorok.filter((x) => /^\d\d:\d\d$/.test(x))) assert.ok(uj.includes(norm(s.replace(/^0/, ''))), 'video-hossz: ' + s);
    await ctx.close();
  });

  test('a fo szovegek, cimek es a hero: ar-sav, Google-ertekeles, cimek sorrendje', async () => {
    const { p, ctx } = await nyit();
    const szoveg = (await p.evaluate(() => document.querySelector('main').innerText)).replace(/\s+/g, ' ');
    for (const s of ['Ha szereted a masszázst, és igényes vagy a hajadra, akkor a Head Spa kezelésünket imádni fogod.', '1023 Bécsi út 2 (A Kolosy térnél)', 'Ár: 50 perc + 30 perc szárítás - 32.900 Ft helyett 26.900 Ft', 'Google 4,9/5 - Kiváló',
      'Több szalont leteszteltem, hogy, megalkossam számodra a tökéletes Férfi Head Spa kezelést.', 'Az okosgyűrűm azt hitte, hogy alszom!', 'Mitől más a MOSAIC Férfi Head Spa kezelés?', 'A rendszeres Head Spa hatásai',
      'Zsíros fejbőr esetén', 'Száraz fejbőr esetén', 'Hajhullás esetén', 'Tapasztalt gyógymasszőrök kényeztetnek.', '100%-ban organikus, vegán OXYGENI termékeket használunk',
      'Mint a Mozaik darabkáit, úgy rakhatod össze a saját Férfi Head Spa kezelésed!', 'Egy MOSAIC Headspa szeánsz elemei', 'Csak tökéletes frizurával engedünk el!', 'Már a megérkezés is ellazít majd',
      'A legjobb önmagad adjuk neked ajándékba.', 'SZÉP Kártyát is elfogadunk', 'Gyakori Head Spa Kérdések', 'Head Spa Csomagok és Árak', 'Itt találsz meg minket', '1023 Budapest Bécsi út 2.', '06 20 247 4444', 'mosaicheadspa@gmail.com',
      'Hétfő - Péntek', 'Durva: Alvásnak ismerte fel a Head Spa kezelés 16 percét az okosgyűrűm.']) assert.ok(szoveg.includes(s), 'hianyzik: ' + s);
    // a cimek az oldal sorrendjeben (H2-k)
    const h2 = await p.$$eval('main h2', (l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    const sorrend = ['Több szalont leteszteltem', 'Az okosgyűrűm', 'Mitől más', 'A rendszeres Head Spa hatásai', 'Tapasztalt gyógymasszőrök', '100%-ban organikus', 'Mint a Mozaik', 'Nézd meg a videókat', 'Férfiaknk készült', 'Csak tökéletes frizurával', 'Már a megérkezés', 'A legjobb önmagad', 'SZÉP Kártyát', 'Gyakori Head Spa Kérdések', 'Head Spa Csomagok és Árak', 'Itt találsz meg minket'];
    let i = 0;
    for (const s of sorrend) { const k = h2.findIndex((x, j) => j >= i && x.startsWith(s)); assert.ok(k >= 0, 'H2 hianyzik / rossz sorrend: ' + s); i = k + 1; }
    // a hero-gombok
    assert.deepEqual(await p.$$eval('.hero a.gomb', (l) => l.map((a) => [a.textContent.replace(/\s+/g, ' ').trim(), a.getAttribute('href')])), [['Időpontfoglalás →', FOGLALO], ['Ajándékkártya →', '/headspa-ajandekkartya']]);
    await ctx.close();
  });

  test('a hero ar-sora egyezik az arlistaval: "32.900 Ft helyett 26.900 Ft" (a 2. csomag ara), nincs 29.900 Ft az oldalon', async () => {
    const { p, ctx } = await nyit();
    const hero = await p.$eval('.hero-ar', (e) => e.innerText.replace(/\s+/g, ' ').trim());
    assert.equal(hero, 'Ár: 50 perc + 30 perc szárítás - 32.900 Ft helyett 26.900 Ft');
    const csomagAr = await p.$eval('.csomag:nth-child(2) .ar-uj', (e) => e.textContent.trim());
    const csomagRegi = await p.$eval('.csomag:nth-child(2) .ar-regi s', (e) => e.textContent.trim());
    assert.ok(hero.includes(`${csomagRegi} helyett ${csomagAr}`), 'a hero ar-sora = a Head Spa kezeles csomag ara: ' + csomagRegi + ' / ' + csomagAr);
    assert.equal(csomagAr, '26.900 Ft');
    assert.equal((await p.evaluate(() => document.querySelector('main').innerText)).includes('29.900'), false, 'nincs 29.900 az oldalon');
    assert.equal(fs.readFileSync(path.join(GYOKER, 'foglalas', NEV + '.html'), 'utf8').includes('29.900'), false, 'nincs 29.900 a forrasban');
    await ctx.close();
  });

  test('nyitvatartas: hetfo - pentek es szombat 8:00 - 20:00, vasarnap zarva; nincs regi szombati (9:00 - 18:00) nyitvatartas', async () => {
    const { p, ctx } = await nyit();
    const sor = await p.$eval('#helyszin .hely-sor:nth-child(4) p', (e) => e.innerText.replace(/\s+/g, ' ').trim());
    assert.equal(sor, 'Nyitvatartásunk Hétfő - Péntek: 8:00 – 20:00 Szombat: 8:00 – 20:00 Vasárnap: ZÁRVA');
    const forras = fs.readFileSync(path.join(GYOKER, 'foglalas', NEV + '.html'), 'utf8');
    assert.equal(/9:00\s*[-–]\s*18:00/.test(forras), false, 'nincs 9:00 - 18:00 a forrasban');
    assert.equal((await p.evaluate(() => document.querySelector('main').innerText)).includes('18:00'), false, 'nincs 18:00 az oldal szovegeben');
    await ctx.close();
  });

  test('foglalo- es belso linkek: a foglalas a kozos foglalo-motorra (reteg) mutat (a paros-gomb a paros szolgaltatasra), a belso linkek / kepek letezo fajlokra, nincs kozvetlen Salonic-link', async () => {
    const { p, ctx } = await nyit();
    const linkek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    assert.equal(linkek.filter((h) => h === FOGLALO).length, 7, 'foglalas-gombok: hero, "Ilyet szeretnek!", SZEP-sav, 3 csomag, helyszin');
    assert.ok(linkek.includes(FOGLALO + '&service=paros'), 'Paros Head Spa idopontok gomb');
    assert.ok(linkek.includes('/headspa-ajandekkartya'), 'ajandekkartya');
    for (const h of linkek) {
      if (h.startsWith('/')) assert.ok(fajlLetezik(h), 'nem letezo belso cel: ' + h);
      else assert.match(h, /^(https:\/\/|tel:|mailto:|#)/, 'ismeretlen link: ' + h);
    }
    assert.equal(linkek.filter((h) => /salonic/i.test(h)).length, 0, 'nincs kozvetlen Salonic-link');
    assert.deepEqual(linkek.filter((h) => /foglalo-motor/.test(h) && !h.startsWith(FOGLALO)), []);
    await ctx.close();
  });

  test('a harom hatas-kartya (zsiros / szaraz / hajhullas): 5-5-5 pont, a regi szoveggel; a kepek letezo ikonok', async () => {
    const { p, ctx } = await nyit();
    const kartyak = await p.$$eval('.hatas-kartya', (l) => l.map((k) => ({ cim: k.querySelector('h3').textContent.trim(), pontok: [...k.querySelectorAll('li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()) })));
    assert.deepEqual(kartyak.map((k) => [k.cim, k.pontok.length]), [['Zsíros fejbőr esetén', 5], ['Száraz fejbőr esetén', 5], ['Hajhullás esetén', 5]]);
    assert.equal(kartyak[0].pontok[0], 'Mélyen tisztítja a fejbőrt, eltávolítja a felesleges faggyút és lerakódásokat.');
    assert.equal(kartyak[1].pontok[4], 'A haj puhább, rugalmasabb és egészségesebb kinézetű lesz.');
    assert.equal(kartyak[2].pontok[3], 'Segít aktiválni az új hajszálak. növekedését, dúsabbá és élettel telivé varázsolja a frizurát.');
    await ctx.close();
  });

  test('GYIK: 18 kerdes (zarva, nativ <details>), a valasz kattintasra nyilik, a regi oldal valaszaival', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('.gyik details').count(), 18);
    assert.equal(await p.locator('.gyik details[open]').count(), 0, 'kezdetben mind zarva');
    const kerdesek = await p.$$eval('.gyik summary', (l) => l.map((e) => e.textContent.trim()));
    assert.equal(kerdesek[0], 'Mi az a head spa kezelés és miben különbözik a hagyományos hajmosástól?');
    assert.equal(kerdesek[14], 'Kopasz férfiak is jöhetnek? :)');
    assert.equal(kerdesek[17], 'Lehet Head Spa-ra jönni póthajjal?');
    const kopasz = p.locator('.gyik details').nth(14);
    await kopasz.scrollIntoViewIfNeeded();
    assert.equal(await kopasz.locator('.gy-valasz').isVisible(), false, 'zarva nem latszik a valasz');
    await kopasz.locator('summary').click();
    assert.equal(await kopasz.locator('.gy-valasz').isVisible(), true);
    assert.match(await kopasz.locator('.gy-valasz').innerText(), /Természetesen, a nem hajas fejbőr talán ugyanúgy érzékeny és jól reagál a masszázsra és a fejbőr kezelésre\./);
    // az ellenjavallatok valasza felsorolas
    const ellen = p.locator('.gyik details').nth(10);
    await ellen.locator('summary').click();
    assert.equal(await ellen.locator('li').count(), 11, 'az ellenjavallatok 11 pontja listaban');
    assert.match(await ellen.locator('li').last().innerText(), /És nem vagy veszélyeztetett terhes\./);
    await ctx.close();
  });

  test('az arlista: 3 csomag szo szerint az arak oldal blokkja (4 Kezes, EGY 50 perces Head Spa kezeles, Paros), a regi Relax / Hair / aprilisi kedvezmeny nelkul', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('.csomag').count(), 3);
    assert.deepEqual(await p.$$eval('.csomag h3', (l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), ['50 perces MOSAIC„4 Kezes” Head Spa kezelés', '50 perces MOSAICHead Spa kezelés', '50 perces MOSAICPáros Head Spa kezelés']);
    assert.deepEqual(await p.$$eval('.csomag .ar-uj', (l) => l.map((e) => e.textContent.trim())), ['39.900 Ft', '26.900 Ft', '53.800 Ft']);
    assert.deepEqual(await p.$$eval('.csomag .ar-regi s', (l) => l.map((e) => e.textContent.trim())), ['49.900 Ft', '32.900 Ft', '65.900 Ft']);
    assert.deepEqual(await p.$$eval('.csomag a.gomb', (l) => l.map((a) => a.getAttribute('href'))), Array(3).fill(FOGLALO));
    const szoveg = await p.$eval('#arak', (e) => e.innerText);
    assert.ok(!/„Relax”|„Hair”|"Relax"|"Hair"|Áprilisban|májusi/.test(szoveg), 'nincs kulon Relax / Hair / regi kedvezmeny');
    assert.match(szoveg, /Hajkamerás diagnosztika és konzultáció – igény szerint, kérdés alapján eldöntheted/);
    assert.match(szoveg, /Októberben 20% kedvezménnyel!/);
    // a csomag-blokk egyezik az arak oldaleval (a kep, a szoveg, az ar)
    const arak = fs.readFileSync(path.join(GYOKER, 'foglalas', 'headspa-arak-budapest.html'), 'utf8').replace(/\r\n/g, '\n');
    const uj = fs.readFileSync(path.join(GYOKER, 'foglalas', NEV + '.html'), 'utf8').replace(/\r\n/g, '\n');
    const blokk = (h) => h.match(/    <div class="csomag-racs harom">[\s\S]*?\n    <\/div>\n/)[0];
    assert.equal(blokk(uj), blokk(arak), 'az ar-blokk szo szerint az arak oldal blokkja');
    // minden csomagnak van betoltott kepe (kesleltetett kepek: a szekciot a kepernyore gorgetjuk, es megvarjuk a betoltest)
    await p.locator('#arak').scrollIntoViewIfNeeded();
    await p.waitForFunction(() => [...document.querySelectorAll('.csomag .csomag-kep img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
    const kepek = await p.$$eval('.csomag .csomag-kep img', (l) => l.map((i) => ({ ok: i.complete && i.naturalWidth > 0, alt: i.alt })));
    assert.equal(kepek.length, 3);
    for (const k of kepek) { assert.ok(k.ok); assert.ok(k.alt.length > 10); }
    await ctx.close();
  });

  test('kepek: minden kepnek merete van (nincs elmozdulas), csak a hero kep tolt azonnal (elotoltve, fetchpriority=high), a tobbi kesleltetett; a hero kep es a galeria letezo fajlok', async () => {
    const { p, ctx } = await nyit();
    const kepek = await p.$$eval('main img', (l) => l.map((i) => ({ src: i.getAttribute('src'), w: i.getAttribute('width'), h: i.getAttribute('height'), lazy: i.getAttribute('loading'), fp: i.getAttribute('fetchpriority'), alt: i.getAttribute('alt') })));
    assert.ok(kepek.length > 40, 'sok kep: ' + kepek.length);
    for (const k of kepek) { assert.ok(k.w && k.h, 'width / height hianyzik: ' + k.src); assert.ok(fs.existsSync(path.join(GYOKER, k.src)), 'nincs meg: ' + k.src); }
    const nemLazy = kepek.filter((k) => k.lazy !== 'lazy');
    assert.deepEqual(nemLazy.map((k) => k.src), ['/assets/img/c2eb0f_81f16bfc67fb4ad6a78e8eda371a0139.png', '/assets/img/c2eb0f_f2bd30e6071d4c0aa35a449683260ff6.jpg'], 'csak a hero-teruleten levo kepek nem kesleltetettek (az ertekeles-csillag + a hero kep)');
    assert.deepEqual(kepek.filter((k) => k.fp).map((k) => [k.src, k.fp]), [['/assets/img/c2eb0f_f2bd30e6071d4c0aa35a449683260ff6.jpg', 'high']]);
    assert.equal(await p.getAttribute('link[rel=preload][as=image]', 'href'), '/assets/img/c2eb0f_f2bd30e6071d4c0aa35a449683260ff6.jpg');
    assert.equal(await p.getAttribute('link[rel=preload][as=image]', 'fetchpriority'), 'high');
    // a regi oldal minden tartalmi kepe megvan: a hero, az alapito, az okosgyuru, a 78b6..., a hatterkepek, a galeria 10 kepe, az ikonok, a SZEP kartya
    const forras = fs.readFileSync(path.join(GYOKER, 'foglalas', NEV + '.html'), 'utf8');
    for (const id of ['f2bd30e6071d4c0aa35a449683260ff6', '4187762c072845dfacf62d2850553ad5', '0d9b21c91b9846e2a1293c28471eedc2', '78b6267587934b5a87815b03ab3deaaa', '35fb28ead0794f0f868c6795bc1a7dea', '101df2c65b5340da8dbacef936b0c362', '8043bfeb052b4321958da732d7d897b4',
      'e98171ec07984e359a41f0aab69fa799', '28b6a0e799ce4ec88381b6b40e406fd6', 'f9a4ce4bf90b48ceb1aaed9da17a25f8', '8e2372842a084a6fbd5474e13de20ec4', 'eeddb15ff8b340c7b1bfd439a91285ac', 'e89ab18fc1664672910d174db54980c2', 'ac85eea74409484091e12f8d72fbee98', 'aa3b2f8ec7564c87bf16836d7d3b29d6',
      '00a2f4bd0e9b4325b2d02e77edb874e9', 'de82baa4848741a2810d03774b0487db', '0afd6583c98246a88f14e7f429e5284b', '7b41e9e53cc240dcbdd1191999af285b', '2117f850ffa24247b22add5a020f0c50', '954c13b62f8c4051bb798f40230901f1', 'df20aa423fff4a62bd74083e3e25f347', 'e9339a3f8c784c08839518f96a6cf19d',
      'e94503e03bba4e0993878b9e280c38c8', '3603018cb350411cbd011ea589e25639', '81f16bfc67fb4ad6a78e8eda371a0139']) assert.ok(forras.includes(id), 'a regi oldal kepe hianyzik: ' + id);
    assert.ok(forras.includes('11062b_ef638a1bfa2f4cfe912e440c74a0d75c') && forras.includes('nsplsh_38734f5a4a384a46305338') && forras.includes('11062b_c676302884b34e2eacc489eede7cbc47'), 'hatterkepek');
    await ctx.close();
  });

  test('a Google terkep (harmadik fel) a suti-hozzajarulas elott nem toltodik; nincs tobb kulso keres, mint a lezeres landingen; a videok csak kattintasra toltodnek', async () => {
    const alap = await nyit('lezeres-szortelenites-budapest');
    const { ctx, kulso, helyi } = await nyit();
    assert.deepEqual(kulso.filter((u) => !alap.kulso.includes(u)), [], 'tobbletkeresek suti nelkul');
    assert.deepEqual(kulso.filter((u) => /google\.com\/maps/.test(u)), [], 'terkep suti nelkul');
    assert.deepEqual(helyi.filter((u) => /\.mp4/.test(u)), [], 'a videok (mp4) csak kattintasra toltodnek');
    await ctx.close(); await alap.ctx.close();
    const t = await nyit(NEV, { suti: true });
    await t.p.waitForSelector('#terkep iframe');
    assert.ok(t.kulso.some((u) => /google\.com\/maps/.test(u)));
    await t.ctx.close();
  });

  for (const [nev, szeles] of [['telefon', 390], ['tablet', 800], ['asztal', 1440]]) {
    test(`nincs vizszintes gorgetes (${nev}, ${szeles} px), a tartalom nem logat ki`, async () => {
      const { p, ctx } = await nyit(NEV, { szeles });
      const m = await p.evaluate(() => ({ tobblet: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        kilog: [...document.querySelectorAll('main *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 && !e.closest('.korhinta-sav, .video-modal, .hatterkep'); }).slice(0, 5).map((e) => e.tagName + '.' + e.className) }));
      // 800 px-en a (Wix) asztali fejlec rogzitett szelessege (~980 px) vizszintes tobbletet ad minden oldalon: ott csak a tartalom (main) nem logathat ki
      if (szeles !== 800) assert.equal(m.tobblet, 0, 'vizszintes tobblet ' + m.tobblet + ' px');
      assert.deepEqual(m.kilog, []);
      await ctx.close();
    });
  }

  test('15 videokartya: kattintasra felugro lejatszo nyilik, a sajat tarhelyrol toltodik, Escape bezarja', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('.video-kartya').count(), 15);
    const adatok = await p.$$eval('.video-kartya', (l) => l.map((b) => [b.dataset.video, b.dataset.poster, b.querySelector('.video-cim')?.textContent, b.querySelector('.video-ido')?.textContent]));
    for (const [v, poszter] of adatok) {
      assert.match(v, /^\/assets\/video\/c2eb0f_[0-9a-f]{32}\.mp4$/);
      assert.ok(fs.existsSync(path.join(GYOKER, v)), 'nincs meg a videofajl: ' + v);
      assert.ok(fs.existsSync(path.join(GYOKER, poszter)), 'nincs meg a poszter: ' + poszter);
    }
    assert.deepEqual(adatok.map((a) => a[2]).slice(0, 3), ['Fejmasszázs eszközökkel', 'Kézmasszázs', 'Arcmasszázs']);
    assert.deepEqual(adatok.map((a) => a[3]).slice(0, 3), ['0:36', '0:38', '0:36']);
    const kartya = p.locator('.video-kartya').nth(1);
    await kartya.scrollIntoViewIfNeeded();
    await kartya.click();
    await p.waitForSelector('dialog.video-modal[open] video', { timeout: 5000 });
    await p.waitForFunction(() => document.querySelector('dialog.video-modal video').readyState >= 1, null, { timeout: 8000 });
    assert.equal(await p.evaluate(() => document.querySelector('dialog.video-modal video').getAttribute('src')), adatok[1][0]);
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('dialog.video-modal[open]'));
    await p.waitForFunction(() => !document.querySelector('dialog.video-modal video'), null, { timeout: 3000 });
    await ctx.close();
  });

  test('megerkezes-galeria (korhinta): 10 kep, a kovetkezo / elozo gomb gorget', async () => {
    const { p, ctx } = await nyit();
    const k = p.locator('.korhinta').first();
    assert.equal(await k.locator('.korhinta-sav img').count(), 10);
    await k.scrollIntoViewIfNeeded();
    assert.equal(await k.locator('.elozo').isDisabled(), true, 'elol az elozo gomb nem kattinthato');
    await k.locator('.kovetkezo').click();
    await p.waitForFunction(() => document.querySelector('.korhinta-sav').scrollLeft > 100);
    assert.equal(await k.locator('.elozo').isDisabled(), false);
    await ctx.close();
  });

  test('"Kattints a kepre!": az okosgyuru kepe a teljes meretu kepre mutat (uj lapon)', async () => {
    const { p, ctx } = await nyit();
    const a = p.locator('a.nagyit').first();
    assert.equal(await a.getAttribute('href'), '/assets/img/c2eb0f_0d9b21c91b9846e2a1293c28471eedc2.jpg');
    assert.equal(await a.getAttribute('target'), '_blank');
    assert.match(await a.getAttribute('rel'), /noopener/);
    assert.match(await p.locator('figcaption').first().innerText(), /\(Kattints a képre!\)/);
    await ctx.close();
  });

  test('mobil sticky CTA: a hero elgorgetese utan latszik, a helyszin szekcional eltunik; asztalon nincs', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    assert.equal(await p.evaluate(() => document.getElementById('sticky-cta').classList.contains('lathato')), false, 'a tetejen nincs');
    await p.evaluate(() => window.scrollTo(0, 3000));
    await p.waitForFunction(() => document.getElementById('sticky-cta').classList.contains('lathato'));
    assert.equal(await p.getAttribute('#sticky-cta a.gomb', 'href'), FOGLALO);
    await p.evaluate(() => document.getElementById('helyszin').scrollIntoView());
    await p.waitForFunction(() => !document.getElementById('sticky-cta').classList.contains('lathato'), null, { timeout: 4000 });
    await ctx.close();
    const asztal = await nyit(NEV, { szeles: 1440 });
    assert.equal(await asztal.p.evaluate(() => getComputedStyle(document.getElementById('sticky-cta')).display), 'none');
    await asztal.ctx.close();
  });

  test('telefonon a hero sorrendje: cim, kep, bevezeto, cim-sor, gombok (a hero kep a cim alatt)', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    const y = await p.evaluate(() => ['.hero h1', '.hero-kep', '.hero-al', '.hero .cta-sor'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().top)));
    assert.deepEqual([...y].sort((a, b) => a - b), y, 'a hero elemei fentrol lefele: ' + y);
    await ctx.close();
  });
});
