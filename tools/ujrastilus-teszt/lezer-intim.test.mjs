// UJ oldal: /intim-lezeres-szortelenites-budapest (Google Ads indulas, SZ-2; a brief 1. szakasza) bongeszos tesztjei (Playwright).
//   node --test tools/ujrastilus-teszt/lezer-intim.test.mjs
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
// Ket resz: (1) a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs; nincs dist/, nincs kulso halozat): tartalom, stilus, linkek, mobil; (2) a helyi dist/ (build utan:
//   CF_PAGES=1 CF_PAGES_BRANCH=<ag> node tools/netlify-build.mjs): fejlec / Info-ablak / lablec gombjai (mh-foglalas / mh-nyitvatartas jelolo) + a foglalo-reteg megnyilik.
//   A dist-es resz kimarad (skip), ha a dist/_a/intim-lezeres-szortelenites-budapest.html nincs meg.
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

const NEV = 'intim-lezeres-szortelenites-budapest';
const BRIEF = {
  title: 'Intim lézeres szőrtelenítés Budapest | MOSAIC',
  description: 'Bikini vonal 19 000 Ft, teljes intim 36 000 Ft alkalmanként. Elysion Pro diódalézer, első kezelés 20% kedvezménnyel, ingyenes konzultáció.',
  h1: 'Intim lézeres szőrtelenítés Budán – diszkréten, hűtött diódalézerrel',
  alcim: 'Bikini vonal vagy teljes intim terület professzionális Elysion Pro diódalézerrel, Crystal Freeze bőrhűtéssel. Első kezelés 20% kedvezménnyel.',
};
const FOCTA = '/foglalo-motor?business=laser&service=konzult';
const MASODLAGOS = '/foglalo-motor?business=laser';
// a repoban mar meglevo, NEM intim teruletet mutato kepek (gep / kezeloszoba / Zsofi / lab- es arc-eredmeny / orvos / varo)
const KEPEK_ENGEDETT = new Set([
  '/assets/img/c2eb0f_095b37f37006437d8942bb760bc4740b.jpg', '/assets/img/lezer-kezelo/kezelo-nagy.jpg', '/assets/img/lezer-kezelo/kezelo-agy.jpg',
  '/assets/img/c2eb0f_1aa35b8ff0f4417abff9e955399b5dc2.jpg', '/assets/img/lezer-eredmeny/labszar.jpg', '/assets/img/lezer-eredmeny/arc.jpg', '/assets/img/lezer-orvos.jpg',
  '/assets/img/c2eb0f_ac85eea74409484091e12f8d72fbee98.jpg',
]);
let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
const forras = () => olvas(`foglalas/${NEV}.html`);
const szovegbol = (html) => html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// betuk es szamok kisbetuvel: a tagolas / irasjelek kulonbsegei nem szamitanak
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '');
const mondatok = (s) => s.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ„"(0-9])/).map((x) => x.trim()).filter(Boolean);

async function nyit(nev, { szeles = 1440, magas, bazisUrl = bazis } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: magas || (mobil ? 844 : 900) }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], nincs = [], kulso = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazisUrl)) nincs.push(r.status() + ' ' + r.url().replace(bazisUrl, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${bazisUrl}/${encodeURI(nev)}`, { waitUntil: 'domcontentloaded' });
  await p.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  return { p, ctx, hibak, nincs, kulso };
}
async function betoltMind(p) {
  await p.evaluate(async () => {
    document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
  });
  await p.waitForLoadState('networkidle').catch(() => {});
}

describe(`/${NEV} (tartalom, stilus, linkek)`, () => {
  test('betoltodik hibak nelkul: egyetlen H1 (a brief szovege), title / description a brief szerint es a hatarokon belul, canonical, NOINDEX (draft), nincs torott kep / 404 / konzol-hiba', async () => {
    const { p, ctx, hibak, nincs } = await nyit(NEV);
    const title = await p.title(), desc = await p.getAttribute('meta[name="description"]', 'content');
    assert.equal(title, BRIEF.title);
    assert.ok(title.length <= 60, 'title <= 60: ' + title.length);
    assert.equal(desc, BRIEF.description);
    assert.ok(desc.length <= 155, 'description <= 155: ' + desc.length);
    assert.equal(await p.getAttribute('link[rel="canonical"]', 'href'), 'https://www.mosaicheadspa.hu/intim-lezeres-szortelenites-budapest');
    assert.equal(await p.getAttribute('meta[property="og:url"]', 'content'), 'https://www.mosaicheadspa.hu/intim-lezeres-szortelenites-budapest');
    assert.equal(await p.locator('meta[name="robots"]').count(), 0, 'ELES: nincs robots meta (indexelheto)');
    assert.ok(olvas('tools/wix-sitemap/pages-sitemap.xml').includes('<loc>https://www.mosaicheadspa.hu/intim-lezeres-szortelenites-budapest</loc>'), 'a sitemapben szerepel');
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.equal((await p.textContent('h1')).replace(/\s+/g, ' ').trim(), BRIEF.h1);
    assert.equal((await p.textContent('.hero-al')).replace(/\s+/g, ' ').trim(), BRIEF.alcim);
    await betoltMind(p);
    assert.equal(await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc)).then((l) => l.length), 0, 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.deepEqual(await p.$$eval('main img', (l) => l.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).map((i) => i.getAttribute('src'))), [], 'width / height nelkuli kepek');
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    // a hero kep elotoltve, a tobbi kep lusta (a hero-kepen kivul)
    const src = forras();
    assert.match(src, /<link rel="preload" href="\/assets\/img\/c2eb0f_095b37f37006437d8942bb760bc4740b\.jpg" as="image" fetchpriority="high">/);
    const nemLusta = [...src.matchAll(/<img\s[^>]*>/g)].map((m) => m[0]).filter((t) => !/loading="lazy"/.test(t)).map((t) => /src="([^"]*)"/.exec(t)[1]);
    assert.deepEqual(nemLusta, ['/assets/img/c2eb0f_095b37f37006437d8942bb760bc4740b.jpg'], 'csak a hero-kep nem lusta');
    // nincs meroKod / nyomkovetes az oldalon (a suti.js utvonal-alapu)
    assert.doesNotMatch(src.replace(/<!--[\s\S]*?-->/g, ''), /data-cta|dataLayer|gtag\(|fbq\(|ttq\.|googletagmanager|connect\.facebook|connect\.tiktok/);
    await ctx.close();
  });

  test('TILTOTT / NEM kerulhet ki tartalom: nincs [MEGERŐSÍTENDŐ], helyorzo, lejart akcio (majus / szeptember), szombat / vasarnap, a megerositesre varo allitasok (noi kezelo, zart / kulon kezeloszoba, idotartam), /idpontfoglalas link', async () => {
    const src = forras();
    const szoveg = szovegbol(src);
    for (const [re, mi] of [[/megerősítendő/i, '[MEGERŐSÍTENDŐ]'], [/máj(?:us|i)/i, 'majus'], [/szeptember/i, 'szeptember'], [/szombat/i, 'szombat'], [/vasárnap/i, 'vasarnap'],
      [/női kezelő|női szakember|csak nők/i, 'noi kezelo'], [/zárt|külön kezelőszoba|külön helyiség/i, 'zart / kulon kezeloszoba'], [/\b\d+\s*perc/i, 'idotartam (perc)'],
      [/lorem|TODO|FIXME|XXX|helyőrző|Kitöltendő/i, 'helyorzo'], [/microblading|lip blush/i, 'masik szolgaltatas']]) {
      assert.doesNotMatch(szoveg, re, 'nem szerepelhet: ' + mi);
    }
    assert.doesNotMatch(src.replace(/<!--[\s\S]*?-->/g, ''), /\/idpontfoglalas|mosaic-hair-idopontfoglalas/, 'a regi foglalo-utvonalra nincs link');
    assert.doesNotMatch(src, /megerősítendő/i, 'a forras kommentjeiben sem');
    assert.match(src, /<!--mh-foglalas:business=laser-->/, 'fejlec / Info-ablak / lablec az adott uzletag foglalojara');
    assert.match(src, /<!--mh-nyitvatartas:hetkoznap-->/, 'a nyitvatartas csak H-P (a szombat megerositesre var)');
    assert.match(szoveg, /Hétfő–péntek 8:00–20:00/);
  });

  test('FOGLALAS: minden foglalo-gomb csak /foglalo-motor?business=laser (fo CTA: &service=konzult), a gombok szovege a brief szerint; helyi kereszt-hivatkozasok (ferfi oldal)', async () => {
    const { p, ctx } = await nyit(NEV);
    const gombok = await p.$$eval('main a[href^="/foglalo-motor"]', (l) => l.map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').replace(/→/, '').trim()]));
    assert.ok(gombok.length >= 8, 'foglalo-gombok szama: ' + gombok.length);
    for (const [h, t] of gombok) {
      assert.ok([FOCTA, MASODLAGOS].includes(h), 'engedett foglalo-cel: ' + h);
      if (h === FOCTA) assert.match(t, /^Ingyenes konzultációt foglalok$/, 'fo CTA szoveg: ' + t);
      else assert.match(t, /^Szabad kezelési időpontok$/, 'masodlagos CTA szoveg: ' + t);
    }
    assert.equal(await p.locator('main .hero a.gomb-arany').getAttribute('href'), FOCTA, 'a hero fo gombja a konzultacio');
    assert.equal(await p.locator('main .hero a.gomb-korvonal').getAttribute('href'), MASODLAGOS);
    // minden helyi, nem foglalo link: csak a ferfi oldal / tel / terkep / google
    const masok = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')).filter((h) => !h.startsWith('/foglalo-motor')));
    for (const h of masok) assert.ok(/^(https:\/\/www\.google\.com\/maps\/|tel:\+36202474444$|\/vegleges-szortelenites-ferfiaknak$)/.test(h), 'engedett link: ' + h);
    // Feri kerese (2026-10-20): az ertekeles / a terkep NEM visz ki az oldalrol: belso horgony a velemenyek / a terkepes blokkra (kulso Google-link csak az Utvonaltervezes gomb es a Trustindex betolto-tartaleka)
    assert.ok(!masok.some((h) => h.includes('maps.app.goo.gl') || h.startsWith('#')), 'nincs kulso Google-profil / ertekeles link, es nincs #horgony-link (GTM History Change)');
    assert.ok(masok.filter((h) => h.startsWith('https://')).length <= 2 && masok.includes('https://www.google.com/maps/search/?api=1&query=MOSAIC%2C%201023%20Budapest%2C%20B%C3%A9csi%20%C3%BAt%202.'), 'kulso Google Maps link: csak az Utvonaltervezes (es a Trustindex betolto-tartaleka)');
    assert.ok(masok.includes('/vegleges-szortelenites-ferfiaknak'), 'G) Ferfi intim kezeles? -> /vegleges-szortelenites-ferfiaknak');
    assert.equal(await p.locator('a', { hasText: 'Férfi intim kezelés?' }).getAttribute('href'), '/vegleges-szortelenites-ferfiaknak');
    await ctx.close();
  });

  test('ARAK: a hos-ar-sav es az ar-tablazat a brief szamai, es EGYEZNEK a /lezeres-szortelenites-budapest arlistajaval (alkalmankent + 8 alkalmas program = 6x)', async () => {
    const { p, ctx } = await nyit(NEV);
    const sav = (await p.$$eval('.in-arsav li', (l) => l.map((x) => x.textContent.replace(/\s+/g, ' ').trim())));
    assert.deepEqual(sav, ['Bikini vonal 19 000 Ft / alkalom', 'Teljes intim 36 000 Ft / alkalom', 'Hónalj + intim csomag 45 500 Ft / alkalom'].map((x) => x.replace(/\u00a0/g, ' ')));
    const sorok = await p.$$eval('.in-tabla tbody tr', (l) => l.map((tr) => [...tr.querySelectorAll('th,td')].map((c, i) => (i === 0 ? c.querySelector('.in-ar-nev').childNodes[0].textContent : c.textContent).replace(/\s+/g, ' ').trim())));
    assert.deepEqual(sorok, [['Bikini vonal', '19 000 Ft', '114 000 Ft'], ['Teljes intim', '36 000 Ft', '216 000 Ft'], ['Hónalj + intim csomag', '45 500 Ft', '273 000 Ft']].map((r) => r.map((x) => x.replace(/\u00a0/g, ' '))));
    const fo = olvas('foglalas/lezeres-szortelenites-budapest.html');
    for (const [k, egy] of [['bikini', 19000], ['intim', 36000], ['basic', 45500]]) {
      assert.match(fo, new RegExp(`data-kulcs="${k}"[^>]*data-ar="${egy}"`), 'a fo oldal ara: ' + k);
      const prog = (egy * 6).toLocaleString('hu-HU').replace(/\s/g, '&nbsp;');
      assert.ok(fo.includes(prog.replace(/\u00a0/g, '&nbsp;') + '&nbsp;Ft') || fo.includes((egy * 6).toLocaleString('hu-HU').replace(/\u00a0| /g, '&nbsp;') + '&nbsp;Ft'), 'a fo oldal 8 alkalmas ara: ' + egy * 6);
    }
    // a feltetel-lista: hat sor, mindegyiknel 1 sor feltetel
    assert.equal(await p.locator('.in-feltetelek li').count(), 6);
    assert.deepEqual(await p.$$eval('.in-feltetelek li b', (l) => l.map((x) => x.textContent.trim())), ['Első kezelés 20% kedvezménnyel', '8 alkalmas program: a 4. és 8. alkalom ajándék', 'További terület 50% kedvezménnyel', 'Fenntartó kezelések örökre féláron', 'Nincs bérlet, alkalmanként fizetsz', '12 hónap garancia']);
    await ctx.close();
  });

  test('SZO SZERINT a fo oldalbol: a 3 pont, a felkeszules, a GYIK-valaszok, az arak feltetelei minden mondata megvan a /lezeres-szortelenites-budapest (vagy a ferfi) oldalon; csak a brief sajat mondatai ternek el', async () => {
    const korpusz = norm(szovegbol(olvas('foglalas/lezeres-szortelenites-budapest.html')) + ' ' + szovegbol(olvas('foglalas/vegleges-szortelenites-ferfiaknak.html')));
    const { p, ctx } = await nyit(NEV);
    const szelektorok = ['.in-bevezeto', '.in-kartyak article:not(:first-child) p', '.in-felk p', '.gyik details p', '.in-feltetelek span', '.in-lepesek li:nth-child(2) p', '.in-lepesek li:nth-child(3) p', '.szorbenoves-szoveg p'];
    const hianyzo = [];
    for (const sel of szelektorok) {
      for (const t of await p.$$eval(sel, (l) => l.map((x) => x.textContent))) for (const m of mondatok(t)) if (!korpusz.includes(norm(m))) hianyzo.push(sel + ' :: ' + m.slice(0, 100));
    }
    // a brief sajat atfogalmazasa / osszefuzese (a forrasmondatok a korpuszban megvannak): az 1. es a 4. lepes, a feltetel-lista nehany sora
    assert.deepEqual(hianyzo, [], 'a korpuszban nem talalhato mondatok');
    // Feri kerese (2026-10-20): az Elysion Pro kartya cime a vevonek szol ("Világelső Elysion Pro orvosi diódalézer"), a 3500 W nem a cimben; a hatas-mondatok a fo oldal allitasai
    assert.equal((await p.textContent('.in-kartyak article:first-child h3')).trim(), 'Világelső Elysion Pro orvosi diódalézer');
    const elysion = (await p.textContent('.in-kartyak article:first-child p')).replace(/\s+/g, ' ');
    assert.match(elysion, /\(3500 W\)\. Neked ez azt jelenti/);
    for (const resz of ['hatékonyabban éri el a szőrtüszőket, mint a gyengébb gépek', 'a hűtőfej védi a bőrt, így a kezelés kényelmes, és a legtöbb bőrtípuson biztonságosan alkalmazható', 'az egyik legnagyobb teljesítményű a piacon (3500 W)']) assert.ok(norm(korpusz).includes(norm(resz)) || korpusz.includes(norm(resz)), 'a fo oldal allitasa: ' + resz);
    const k = (s) => korpusz.includes(norm(s));
    assert.ok(k('a Fitzpatrick-skála alapján meghatározzuk a bőrtípusodat és a szőrszálaid vastagságát'), '1. lepes: forras');
    assert.ok(k('átbeszéljük a kizáró okokat (pl. fényérzékenyítő gyógyszerek, hormonális betegségek)'), '1. lepes: forras 2');
    assert.ok(k('ingyenes kontroll időponton, amit ugyanolyan könnyen bármikor online le tudsz foglalni mint a normál kezelést'), '4. lepes: forras (ferfi oldal)');
    // az uj kerdes ("Mennyire fáj intim területen?") a fo oldal "Fáj a kezelés?" valasza + az intim-mondat
    assert.equal(await p.locator('.gyik details summary', { hasText: 'Mennyire fáj intim területen?' }).count(), 1);
    // a GYIK harmonika: 6 kerdes (a brief E) szerint: intim, fajdalom, alkalmak szama, borotvalas, ki nem kezelheto, garancia
    assert.deepEqual(await p.$$eval('.gyik details summary', (l) => l.map((x) => x.textContent.trim())),
      ['Intim területen is biztonságos?', 'Mennyire fáj intim területen?', 'Biztos, hogy elég a 8 alkalom?', 'Mit kezdjek a szőrrel két kezelés között?', 'Kinek nem javasolt a kezelés?', 'Mit jelent a 12 hónapos garancia?']);
    await ctx.close();
  });

  test('KEPEK: csak az engedett, NEM intim teruletet mutato, a repoban mar meglevo kepek (gep / kezeloszoba / Zsofi / lab- es arc-eredmeny / orvos / varo); a body-illusztraciok (lezer-ikon/*) es a hónalj / mell / has kepek nincsenek', async () => {
    const src = forras();
    const kepek = [...src.matchAll(/(?:src|poster|data-nagy)="(\/assets\/(?:img|video)[^"]*)"/g)].map((m) => m[1]).filter((u) => !u.endsWith('.mp4'));
    assert.ok(kepek.length >= 8);
    for (const u of kepek) { assert.ok(KEPEK_ENGEDETT.has(u), 'nem engedett kep: ' + u); assert.ok(fs.existsSync(path.join(GYOKER, u)), 'letezik: ' + u); }
    assert.doesNotMatch(src, /lezer-ikon\/|d25d1e56|4655346725314c0d|c3f7766324e44b97|c44d6debeaae4fe0|ed3e3ce785064556|fc90fb2827e544f9/, 'nincs body-illusztracio / honalj / ferfi mell kep');
    for (const a of [...src.matchAll(/<img\s[^>]*alt="([^"]*)"/g)].map((m) => m[1])) assert.doesNotMatch(a, /intim|bikini|hónalj|mell|has\b/i, 'alt: ' + a);
  });

  test('STILUS: a /lezeres-szortelenites-budapest landing komponensei (lezer-landing.css) + a sajat kiegeszito CSS; a szinek / betuk / gombok azonosak a mintaoldaleval; NEM a regi rendszer', async () => {
    const src = forras();
    assert.ok(src.includes('<link rel="stylesheet" href="/assets/css/lezer-landing.css">'));
    assert.ok(src.includes('<link rel="stylesheet" href="/assets/css/lezer-intim.css">'));
    assert.ok(src.indexOf('lezer-landing.css') < src.indexOf('lezer-intim.css'), 'a kiegeszito CSS a minta CSS UTAN toltodik');
    assert.doesNotMatch(src, /headspa-oldal\.css|lezer-variansok\.css|lezer-ferfi-landing\.css/);
    const jellemzok = () => ({
      body: getComputedStyle(document.body).backgroundColor + '|' + getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector('main h1')).fontFamily + '|' + getComputedStyle(document.querySelector('main h1')).color,
      arany: getComputedStyle(document.querySelector('main .gomb-arany')).backgroundImage + '|' + getComputedStyle(document.querySelector('main .gomb-arany')).borderRadius,
      hero: getComputedStyle(document.querySelector('main .hero')).backgroundImage,
      kartya: getComputedStyle(document.querySelector('main .alkalmas-kartya')).borderRadius,
      helyszin: getComputedStyle(document.querySelector('main .helyszin')).backgroundColor,
      gyik: getComputedStyle(document.querySelector('main .harmonika-racs summary')).backgroundColor + '|' + getComputedStyle(document.querySelector('main .harmonika-racs details')).backgroundColor,
    });
    const a = await nyit(NEV), b = await nyit('lezeres-szortelenites-budapest');
    assert.deepEqual(await a.p.evaluate(jellemzok), await b.p.evaluate(jellemzok));
    for (const sel of ['.hero .hero-kep img', '.gomb.gomb-arany', '.harmonika-racs details', '.helyszin .hely-sor', '#trustindex', '.rombusz', '.szorbenoves .video-kartya', '.eredmeny-kartya .eloutana']) assert.ok(await a.p.locator(sel).count() > 0, sel);
    await a.ctx.close(); await b.ctx.close();
  });

  test('ERTEKELES / TERKEP (Feri kerese 2026-10-20): "4,9 – 1 266 Google-ertekeles" (a HTML-ben a tartalek; a google-szam.js elo szamra cserli); NEM visz ki az oldalrol: a hero jelvenye (gomb) a velemenyek blokkra gorget, a "Lasd a terkepen" gomb a terkepes blokkra (URL-valtozas nelkul); a velemenyek-blokkban nem kattinthato jelveny', async () => {
    const { p, ctx } = await nyit(NEV);
    const e = p.locator('.in-hero-sor button.in-ertekeles');
    assert.equal((await e.textContent()).replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').replace('★★★★★', '').trim(), '4,9 – 1 266 Google-értékelés');
    assert.equal(await e.getAttribute('data-gorget'), 'velemenyek');
    assert.equal(await p.locator('a.in-ertekeles').count(), 0, 'nincs link (a hash-valtozas a GTM History Change-et inditana): gomb + JS-gorgetes');
    assert.equal(await p.locator('#velemenyek .in-ertekeles').evaluate((el) => el.tagName), 'SPAN', 'a velemenyek blokkban a jelveny nem kattinthato (mar ott vagyunk)');
    const hely = (await p.textContent('.in-hely')).replace(/\s+/g, ' ');
    assert.match(hely, /1023 Budapest, Bécsi út 2\., Kolosy tér és Zsigmond tér között/);
    assert.equal(await p.locator('.in-hely button').getAttribute('data-gorget'), 'terkep');
    assert.equal(await p.locator('.in-hely a').count(), 0);
    for (const id of ['velemenyek', 'terkep', 'eredmenyek', 'foglalas']) assert.equal(await p.locator('#' + id).count(), 1, 'gorgetes-cel: #' + id);
    // a gombra kattintva az oldal a cel-blokkhoz gorget; az URL NEM valtozik (nincs hash, nincs navigacio, nincs uj lap)
    const url0 = p.url();
    for (const [sel, cel] of [['.in-hero-sor button.in-ertekeles', '#velemenyek'], ['.in-hely button', '#terkep']]) {
      await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(100);
      await p.locator(sel).click();
      await p.waitForFunction((c) => { const t = document.querySelector(c).getBoundingClientRect().top; return t < 300 && t > -100; }, cel, { timeout: 5000 });
      assert.equal(p.url(), url0, 'az URL nem valtozik');
      assert.equal(ctx.pages().length, 1, 'nem nyilt uj lap');
      const y = await p.locator(cel).evaluate((el) => el.getBoundingClientRect().top);
      assert.ok(y < 400 && y > -200, cel + ' a kepernyon (top ' + Math.round(y) + ')');
    }
    // a build a google-szam.js-t a "<szam> Google-ertekeles" mintara teszi az oldalra (lasd tools/netlify-build.mjs GV_MINTA)
    assert.match(szovegbol(forras()), /1\s?266\s+Google-értékelés/);
    await ctx.close();
  });

  test('MOBIL (390 es 360 px): nincs vizszintes gorgetes; a hero sorrendje CIM, KEP, alcim, ar-sav, fo CTA, ertekeles, hely (Feri kerese 2026-10-20); az elso kepernyon (390x844) latszik a H1, a kep es az alcim', async () => {
    for (const szeles of [390, 360]) {
      const { p, ctx, hibak } = await nyit(NEV, { szeles });
      await betoltMind(p);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'vizszintes gorgetes ' + szeles);
      if (szeles === 390) {
        await p.evaluate(() => window.scrollTo(0, 0));
        const lent = async (sel) => (await p.locator(sel).first().boundingBox()).y + (await p.locator(sel).first().boundingBox()).height;
        for (const sel of ['main h1', '.in-hero .hero-kep', '.in-hero .hero-al']) assert.ok(await lent(sel) <= 844, 'az elso kepernyon belul: ' + sel + ' (' + await lent(sel) + ')');
        // a sorrend: cim < kep < alcim < ar-sav < CTA < ertekeles < hely
        const y = async (sel) => (await p.locator(sel).first().boundingBox()).y;
        const sor = [await y('main h1'), await y('.in-hero .hero-kep'), await y('.in-hero .hero-al'), await y('.in-arsav'), await y('.in-hero-cta'), await y('.in-hero-sor'), await y('.in-hely')];
        assert.deepEqual([...sor].sort((m, n) => m - n), sor, 'a hero mobil sorrendje: ' + sor.join(' < '));
        assert.ok(sor[1] - sor[0] < 140, 'a kep kozvetlenul a cim alatt kezdodik');
      }
      assert.deepEqual(hibak, []);
      await ctx.close();
    }
    // asztalon a kep a szoveg mellett (jobb oldalon) marad
    const asztal = await nyit(NEV, { szeles: 1440 });
    const kep = await asztal.p.locator('.in-hero .hero-kep').boundingBox(), cim = await asztal.p.locator('main h1').boundingBox();
    assert.ok(kep.x > cim.x + cim.width - 40, 'asztalon a kep a szoveg jobb oldalan');
    await asztal.ctx.close();
  });

  test('ARAK FORMAZAS (Feri kerese 2026-10-20): ikonok az ar-sorokon es a 6 feltetel-dobozon; mobilon az ar-tablazat kartya-nezet (nincs 3 soros csomag-nev); az EREDMENYEK az arak ELOTT, a "Miert kerdeznek" szekcio utan', async () => {
    const a = await nyit(NEV, { szeles: 1440 });
    assert.equal(await a.p.locator('.in-ar-ikon svg').count(), 3);
    assert.equal(await a.p.locator('.in-fel-ikon svg').count(), 6);
    const y = async (sel) => (await a.p.locator(sel).first().boundingBox()).y;
    assert.ok(await y('#miert') < await y('#eredmenyek') && await y('#eredmenyek') < await y('#arak') && await y('#arak') < await y('#elso-alkalom'), 'sorrend: miert, eredmenyek, arak, elso alkalom');
    assert.equal(await a.p.locator('#eredmenyek .eredmeny-kartya').count(), 2);
    assert.equal(await a.p.locator('#velemenyek .eredmeny-kartya').count(), 0, 'az eredmenyek mar nincsenek a velemenyek blokkban');
    assert.equal(await a.p.locator('#eredmenyek h2').count(), 1);
    await a.ctx.close();
    const m = await nyit(NEV, { szeles: 390 });
    await betoltMind(m.p);
    const nev = await m.p.locator('.in-tabla tbody tr:nth-child(3) th .in-ar-nev').boundingBox();
    assert.ok(nev.height < 50, 'a "Hónalj + intim csomag" nev nem tor 3 sorba mobilon (' + Math.round(nev.height) + ' px)');
    assert.deepEqual(await m.p.$$eval('.in-tabla tbody tr:first-child td', (l) => l.map((td) => getComputedStyle(td, '::before').content)), ['"1 alkalom"', '"8 alkalmas program"']);
    await m.ctx.close();
  });

  test('SORTORES (Feri alapszabaly: ahol 1-2 szo csuszik at uj sorba, az legyen egy sor, mobilon): a cimekben, jelvenyekben, gombokban, ar-cellakban, kartya-cimekben es a rovid szovegekben nincs arva-sor 360 / 390 / 412 px-en (az utolso sor <= 2 szo ES a leghosszabb sor felenel rovidebb)', async () => {
    for (const szeles of [360, 390, 412]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      await betoltMind(p);
      const arva = await p.evaluate(() => {
        const SEL = 'main h1, main h2, main h3, main summary, main .gomb, main .cimke, main .in-arsav li b, main .in-arsav li span, main .in-tabla th, main .in-tabla td, main .in-feltetelek li > div > b, main .in-feltetelek li > div > span, main .in-lepesek h3, main .in-ertekeles-szoveg, main .in-hely, main .hero-al, main .in-bevezeto, main figcaption, main dt, main dd, main .hely-sor p, .sticky-cta a';
        const ki = [];
        for (const el of document.querySelectorAll(SEL)) {
          if (getComputedStyle(el).display === 'none' || !el.getClientRects().length) continue;
          if ([...el.children].some((k) => !/^(inline|inline-block|inline-flex)$/.test(getComputedStyle(k).display) || k.tagName === 'BR')) continue;
          const szavak = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
          while ((n = w.nextNode())) { if (n.parentElement.closest('svg, [aria-hidden="true"]') && !n.parentElement.closest('.in-ertekeles-szoveg')) continue; const re = /[^ \t\n\r]+/g; let m; while ((m = re.exec(n.nodeValue))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const rr = [...r.getClientRects()].pop(); if (rr) szavak.push({ top: Math.round(rr.top), bal: rr.left, jobb: rr.right }); } }
          if (szavak.length < 3) continue;
          const sorok = []; for (const sz of szavak) { const s = sorok.find((x) => Math.abs(x.top - sz.top) < 6); if (s) { s.n++; s.bal = Math.min(s.bal, sz.bal); s.jobb = Math.max(s.jobb, sz.jobb); } else sorok.push({ top: sz.top, n: 1, bal: sz.bal, jobb: sz.jobb }); }
          if (sorok.length < 2) continue;
          const u = sorok[sorok.length - 1]; const szeles2 = Math.max(...sorok.map((x) => x.jobb - x.bal));
          if (u.n <= 2 && u.jobb - u.bal < szeles2 * 0.55) ki.push(el.textContent.replace(/\s+/g, ' ').trim().slice(0, 70));
        }
        return ki;
      });
      // a hosszu torzs-bekezdesek (4+ sor) termeszetes tordelese kivetel: itt csak a rovid elemeket szamoljuk
      const rovid = arva.filter((t) => t.length < 70);
      assert.deepEqual(rovid, [], `arva-sor ${szeles} px-en`);
      await ctx.close();
    }
  });

  test('MOBIL STICKY CTA: telefonon a hero-gombok elgorgetese utan jon be ("Ingyenes konzultaciot foglalok" + kis "Szabad idopontok" link), a zaro szekciotol eltunik; asztalon nem latszik', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    await betoltMind(p);
    const lathato = () => p.evaluate(() => { const s = document.getElementById('sticky-cta'); const r = s.getBoundingClientRect(); return { osztaly: s.classList.contains('lathato'), aria: s.getAttribute('aria-hidden'), kepernyon: r.top < innerHeight && r.bottom > 0 && getComputedStyle(s).display !== 'none' }; });
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150);
    assert.equal((await lathato()).osztaly, false, 'felul nem latszik');
    await p.evaluate(() => window.scrollTo(0, 1400)); await p.waitForTimeout(300);
    const kozben = await lathato();
    assert.equal(kozben.osztaly, true); assert.equal(kozben.aria, 'false');
    assert.deepEqual(await p.$$eval('#sticky-cta a', (l) => l.map((a) => [a.getAttribute('href'), a.innerHTML.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').replace(/→/, '').trim()])), [[FOCTA, 'Ingyenes konzultációt foglalok'], [MASODLAGOS, 'Szabad időpontok']]);
    // a sticky sav gombja egy sorban, a kepernyon belul
    const b = await p.locator('#sticky-cta .gomb').boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= 390, 'a sticky gomb belefer');
    assert.ok(b.height < 60, 'a sticky gomb egy soros');
    await p.evaluate(() => document.getElementById('foglalas').scrollIntoView({ block: 'start' })); await p.waitForTimeout(300);
    assert.equal((await lathato()).osztaly, false, 'a zaro szekcional eltunik');
    await ctx.close();
    const asztal = await nyit(NEV, { szeles: 1440 });
    await asztal.p.evaluate(() => window.scrollTo(0, 1400)); await asztal.p.waitForTimeout(200);
    assert.equal(await asztal.p.evaluate(() => getComputedStyle(document.getElementById('sticky-cta')).display), 'none', 'asztalon nincs sticky sav');
    await asztal.ctx.close();
  });

  test('MUKODES: a GYIK harmonika nyit / zar, az orvosi video kattintasra <video>-ra cserelodik, a Google-terkep gomb megvan', async () => {
    const { p, ctx, hibak } = await nyit(NEV);
    await betoltMind(p);
    const d = p.locator('.gyik details').nth(1);
    assert.equal(await d.evaluate((x) => x.open), false);
    await d.locator('summary').click();
    assert.equal(await d.evaluate((x) => x.open), true);
    assert.ok(await d.locator('p').isVisible());
    await p.locator('#orvos-video').scrollIntoViewIfNeeded();
    await p.locator('#orvos-video').click();
    assert.equal(await p.locator('.szorbenoves video').count(), 1, 'a video-elem megjelent');
    assert.equal(await p.locator('.szorbenoves video source').getAttribute('src'), '/assets/video/lezer-orvos.mp4');
    assert.equal(await p.locator('#terkep-gomb').count(), 1);
    assert.equal(await p.locator('#trustindex[data-embed]').count(), 1);
    assert.deepEqual(hibak.filter((h) => !/play\(\)|NotAllowed|AbortError|media/i.test(h)), []);
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
      assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->|<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, ''), /href="\/idpontfoglalas"|mosaic-hair-idopontfoglalas/, 'a regi foglalo-utvonalra nincs link (a kozos CSS selectoranak megemlitese nem link)');
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

  test('a hero fo gombjara kattintva a foglalo-reteg (booking-launcher) helyben megnyilik (nem navigal el); a build a launcher-t es a google-szam.js-t felteszi', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 1440, bazisUrl: dbazis });
    const html = await p.content();
    assert.match(html, /\/assets\/js\/booking-launcher\.js/);
    assert.match(html, /\/assets\/js\/google-szam\.js/);
    await p.locator('.in-hero-cta a.gomb-arany').click();
    await p.waitForSelector('#mosaic-booking-layer', { timeout: 10000 });
    assert.ok(new URL(p.url()).pathname.endsWith(NEV), 'az oldal nem navigalt el');
    await ctx.close();
  });
});
