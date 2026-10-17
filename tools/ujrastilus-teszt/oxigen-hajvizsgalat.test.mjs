// /hajvizsgalat-budapest (Google Ads OX-2: hajkamerás hajvizsgálat 4 990 Ft) tesztjei.
//
//   node --test tools/ujrastilus-teszt/oxigen-hajvizsgalat.test.mjs
//
// Környezeti változók: CHROME_UTVONAL (alapból a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappája).
// 1) statikus tesztek (nincs böngésző): meta-adatok, tiltott / megerősítésre váró tartalom, ár-egyezés a Salonic-pillanatképpel, foglaló-linkek, a fejléc / lábléc a build láncával;
// 2) böngészős tesztek a könnyű helyi szerverrel (tools/headspa-teszt/szerver.mjs, nincs dist / külső hálózat): hibamentes betöltés, vízszintes görgetés, első képernyő, sticky CTA;
// 3) dist-tesztek (csak ha a `CF_PAGES=1 CF_PAGES_BRANCH=main node tools/netlify-build.mjs` már lefutott): a build valódi fejléce / lábléca, a foglaló-réteg megnyílik a fő gombra.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* következő */ } }
  throw new Error('playwright-core nem található (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

const NEV = 'hajvizsgalat-budapest';
const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
const FORRAS = olvas(`foglalas/${NEV}.html`);
const SZ = (s) => s.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();   // szóköz-normalizálás (nbsp is)

// a brief 2. szakasza (szó szerint)
const BRIEF = {
  title: 'Hajkamerás hajvizsgálat 4 990 Ft – Budapest | MOSAIC',
  description: 'Hullik vagy ritkul a hajad? Hajkamerás haj- és fejbőr-állapotfelmérés 4 990 Ft-ért, kezelés nélkül is. Kolosy tér, online foglalás.',
  h1: 'Hajkamerás haj- és fejbőrvizsgálat 4 990 Ft-ért',
  alcim: 'Nézd meg kamerán, mi történik a fejbőrödön – kezelés nélkül is foglalható állapotfelmérés a Kolosy térnél.',
  fo: 'Hajvizsgálatot foglalok – 4 990 Ft',
  masodlagos: 'Első kezelés hajkamerás vizsgálattal – 29 900 Ft',
  doboz: 'Ez állapotfelmérés, nem orvosi diagnózis. Hirtelen, foltos vagy nagy mértékű hajhullásnál, illetve diagnosztizált vagy gyulladt bőrbetegségnél először fordulj orvoshoz.',
};
const FO_HREF = '/foglalo-motor?business=oxygen&service=466147';
const MASODLAGOS_HREF = '/foglalo-motor?business=oxygen&service=466110';

// a látható szöveg (megjegyzések, szkriptek, stílusok, szimbólum-sprite nélkül)
const lathato = (html) => SZ(html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|svg|template)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
const fej = (html) => html.slice(0, html.indexOf('</head>'));
const torzs = (html) => html.slice(html.indexOf('<body'));
const szekcio = (html, osztaly) => {
  const m = new RegExp(`<(section|aside)[^>]*class="[^"]*\\b${osztaly}\\b[^"]*"[\\s\\S]*?</\\1>`).exec(html);
  assert.ok(m, 'szekció: ' + osztaly);
  return m[0];
};
const hrefek = (html) => [...html.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

describe('statikus: meta-adatok, tartalom, foglaló-linkek', () => {
  const h = fej(FORRAS), b = torzs(FORRAS);

  test('title ≤ 60, description ≤ 155 karakter, a brief szövegével; pontosan 1 H1 (a brief szerint); canonical a végleges éles cím; az oldal egyelőre NEM indexelhető (Feri: holnap átbeszéljük)', () => {
    const title = /<title>([^<]*)<\/title>/.exec(h)[1];
    const desc = /<meta name="description" content="([^"]*)"/.exec(h)[1];
    assert.equal(title, BRIEF.title);
    assert.ok([...title].length <= 60, 'title hossza: ' + [...title].length);
    assert.equal(desc, BRIEF.description);
    assert.ok([...desc].length <= 155, 'description hossza: ' + [...desc].length);
    assert.equal((b.match(/<h1[\s>]/g) || []).length, 1, 'pontosan 1 H1');
    assert.equal(lathato(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(b)[1]), BRIEF.h1);
    assert.match(h, /<link rel="canonical" href="https:\/\/www\.mosaicheadspa\.hu\/hajvizsgalat-budapest">/);
    assert.match(h, /<meta property="og:url" content="https:\/\/www\.mosaicheadspa\.hu\/hajvizsgalat-budapest">/);
    assert.match(h, /<meta name="robots" content="noindex, nofollow">/, 'noindex, amíg Feri nem hagyja jóvá (élesítéskor ezt a sort ki kell venni)');
    assert.ok(!fs.readFileSync(path.join(GYOKER, 'tools/wix-sitemap/pages-sitemap.xml'), 'utf8').includes('hajvizsgalat-budapest'), 'nincs a sitemapben');
  });

  test('a hős-részben: H1, a brief szerinti alcím, ár, EGY fő gomb, hely + Google Térkép-link, kattintható Google-értékelés (4,9 – 1 266)', () => {
    const hero = szekcio(b, 'hero');
    const sz = lathato(hero);
    assert.ok(sz.includes(BRIEF.alcim), 'alcím');
    assert.ok(/4 990 Ft/.test(sz), 'ár a hős-részben');
    const gombok = [...hero.matchAll(/<a class="gomb[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
    assert.equal(gombok.length, 1, 'egyetlen fő gomb a hős-részben');
    assert.equal(gombok[0][1].replace(/&amp;/g, '&'), FO_HREF);
    assert.equal(lathato(gombok[0][2]).replace(/\s*→$/, ''), BRIEF.fo);
    assert.ok(sz.includes('1023 Budapest, Bécsi út 2., Kolosy tér és Zsigmond tér között'), 'pontos hely');
    assert.ok(/<a[^>]*href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=MOSAIC[^"]*"[^>]*>Megnyitás a Google Térképen<\/a>/.test(hero), 'Google Térkép-link');
    assert.ok(/<a class="hero-ertekeles" href="https:\/\/www\.google\.com\/maps[^"]*"[^>]*>[\s\S]*?4,9 – 1 266 Google-értékelés/.test(hero), 'kattintható értékelés: 4,9 – 1 266 Google-értékelés (a google-szam.js élő számra cseréli)');
    assert.ok(!/Előtte|Utána|eredmeny-\d|vendeg-0/.test(hero), 'nincs előtte/utána kép a hős-részben');
  });

  test('a kötelező figyelmeztető doboz szó szerint, jól látható, pontosan egyszer; a "Mikor érdemes?" figyelmeztetés a bőrbetegségekről (seborrhea / pikkelysömör csak ott)', () => {
    const l = lathato(b);
    assert.equal(l.split(BRIEF.doboz).length - 1, 1, 'a kötelező doboz szó szerint, egyszer');
    const dobozSzekcio = lathato(szekcio(b, 'figyelmeztetes'));
    assert.equal(dobozSzekcio, BRIEF.doboz);
    const mikor = szekcio(b, 'mikor');
    const lista = lathato(mikor.replace(/<p class="mikor-figyelmeztet"[\s\S]*?<\/p>/, ''));
    assert.ok(!/seborrh|pikkelysömör/i.test(lista), 'a "mikor érdemes" listában nincs seborrhea / pikkelysömör');
    assert.ok(/bőrgyógyász/.test(lathato(/<p class="mikor-figyelmeztet"[\s\S]*?<\/p>/.exec(mikor)[0])));
    for (const kulcs of ['Hajhullás', 'Ritkuló haj', 'Korpásodás', 'Zsíros vagy viszkető fejbőr']) assert.ok(lista.includes(kulcs), kulcs);
    const kiHat = l.replace(lathato(mikor), '');
    assert.ok(!/seborrh|pikkelysömör/i.test(kiHat), 'seborrhea / pikkelysömör az oldalon máshol sem szerepel');
  });

  test('nincs megerősítésre váró / helyőrző tartalom, nincs lejárt akció, nincs szombati nyitvatartás, nincs a vizsgálat időtartama ([MEGERŐSÍTENDŐ])', () => {
    assert.ok(!/MEGERŐSÍTENDŐ|MEGEROSITENDO/i.test(FORRAS), 'nincs [MEGERŐSÍTENDŐ] (még megjegyzésben sem)');
    assert.ok(!/\[[^\]]*\]/.test(lathato(b)), 'nincs szögletes zárójeles helyőrző');
    const l = lathato(b);
    assert.ok(!/május|június|szeptember|nyár|nyári|akció|kedvezmény|húsvét/i.test(l), 'nincs lejárt / szezonális akció');
    assert.ok(!/szombat|vasárnap/i.test(l), 'szombati / vasárnapi nyitvatartás nem szerepel (megerősítésre vár)');
    assert.ok(/hétfőtől péntekig 8:00–20:00/.test(l), 'csak a hétköznapi nyitvatartás');
    // időtartam: csak az első KEZELÉS 80 perce (Salonic 466110); a vizsgálat időtartama nem szerepel
    const percek = [...l.matchAll(/[^.]{0,40}\bperc\b[^.]{0,20}/g)].map((m) => m[0]);
    assert.ok(percek.every((p) => /80 perc|1 óra 20 perc/.test(p)), 'időtartam csak az első kezelésnél (80 perc): ' + JSON.stringify(percek));
    assert.ok(!/\b30 perc/.test(l), 'a vizsgálat 30 perce nem szerepel');
  });

  test('tiltott állítások nincsenek: gyógyulás- / eredményígéret, „trichológus", orvos-szerep, „95%" – a hős-részben és az egész oldalon sem; „orvos" csak a figyelmeztetésekben és a GYIK-ban', () => {
    const l = lathato(b);
    assert.ok(!/trichol/i.test(l));
    assert.ok(!/megállít|meggyógy|gyógyul|gyógyít|garant|megszünt|visszaad|újranöv|látvány|drasztikus|biztos eredmény/i.test(l), 'nincs gyógyulás- / eredményígéret');
    assert.ok(!/95\s*%/.test(l) && !/hatékonys/i.test(l), 'nincs hatékonysági százalék');
    const hero = lathato(szekcio(b, 'hero'));
    assert.ok(!/orvos|trichol|95|megállít/i.test(hero), 'a hős-részben nincs orvos / trichológus / 95 / megállít');
    // "orvos": csak a kötelező dobozban, a "Mikor érdemes?" figyelmeztetésben (bőrgyógyász) és a GYIK-ban
    const maradek = lathato(b.replace(szekcio(b, 'gyik-szekcio'), '').replace(szekcio(b, 'figyelmeztetes'), ''));
    assert.equal([...maradek.matchAll(/orvos\w*/gi)].length, 0, 'az "orvos" szó csak a kötelező dobozban és a GYIK-ban szerepel');
    assert.ok(!/class="cimke (elotte|utana)"/.test(FORRAS), 'nincs előtte/utána felirat (cimke)');
    assert.ok(!/rúzs|lip blush|microblading/i.test(l));
  });

  test('a fő gomb szövege mindenhol azonos (hős, "Mit kapsz", záró sáv, mobil sticky), mind a 466147-re; a másodlagos (466110) csak lent és kisebb; nincs más foglaló-cél', () => {
    const osszes = [...b.matchAll(/<a\b([^>]*)\shref="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attr: m[1] + m[3], href: m[2].replace(/&amp;/g, '&'), szoveg: lathato(m[4]).replace(/\s*→$/, '') }));
    const fo = osszes.filter((x) => x.href === FO_HREF);
    assert.ok(fo.length >= 4, 'a fő gomb legalább 4 helyen: ' + fo.length);
    for (const x of fo) assert.equal(x.szoveg, BRIEF.fo, 'a fő gomb szövege mindenhol azonos');
    const mas = osszes.filter((x) => x.href === MASODLAGOS_HREF);
    assert.ok(mas.length >= 1);
    for (const x of mas) { assert.equal(x.szoveg, BRIEF.masodlagos); assert.ok(!/\bgomb\b/.test(x.attr.replace(/class="([^"]*)"/, '$1')) || /masodlagos/.test(x.attr), 'a másodlagos nem fő gomb'); }
    // a másodlagos link a hős-rész UTÁN áll
    assert.ok(b.indexOf('service=466110') > b.indexOf('</section>', b.indexOf('class="hero')), 'a másodlagos csak lent');
    // minden /foglalo-motor link a két engedélyezett cél egyike; nincs Salonic-link, nincs régi foglaló-útvonal
    for (const x of osszes.filter((y) => /foglalo-motor/.test(y.href))) assert.ok(x.href === FO_HREF || x.href === MASODLAGOS_HREF, x.href);
    for (const x of osszes) assert.ok(!/salonic\.hu|idpontfoglalas|mosaic-hair-idopontfoglalas/.test(x.href), 'tiltott foglaló-cél: ' + x.href);
    assert.ok(!/data-cta=/.test(FORRAS), 'nincs mérés (data-cta)');
    assert.ok(!/dataLayer|fbq\(|gtag\(|ttq\./.test(FORRAS), 'nincs mérőkód az oldalban');
  });

  test('az árak egyeznek a Salonic-pillanatképpel és az /oxigenterapia-budapest oldallal (466147 = 4 990 Ft, 466110 = 29 900 Ft / 80 perc, 466158 = 26 000 Ft, 5 × 26 000 = 130 000 Ft)', () => {
    const map = JSON.parse(olvas('docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json'));
    const ar = (id) => map.services.find((s) => s.salonic_service_id === id);
    assert.equal(ar('466147').active_price, 4990);
    assert.equal(ar('466110').active_price, 29900); assert.equal(ar('466110').duration_min, 80);
    assert.equal(ar('466158').active_price, 26000);
    const l = lathato(b), fo = lathato(olvas('foglalas/oxigenterapia-budapest.html'));
    for (const s of ['4 990 Ft', '29 900 Ft', '26 000 Ft', '130 000 Ft', '80 perc']) { assert.ok(l.includes(s), 'az új oldalon: ' + s); assert.ok(fo.includes(s) || s === '80 perc', 'a fő oldalon: ' + s); }
    assert.ok(/5 × 26 000 Ft/.test(l) && /1 literes Oxygeni sampon/.test(l) && /Nincs kötelező bérlet/.test(l) && /SZÉP Kártyát/.test(l));
    assert.equal(ar('466158').active_price * 5, 130000);
    // ellentmondó ár nincs: minden "NN NNN Ft" az engedélyezett halmazból való
    const engedett = new Set(['4 990 Ft', '29 900 Ft', '26 000 Ft', '130 000 Ft']);
    for (const m of l.matchAll(/\d{1,3}(?: \d{3})* Ft/g)) assert.ok(engedett.has(m[0]), 'váratlan ár: ' + m[0]);
  });

  test('képek: mind létezik, csak valódi / szemléltető (felirattal) szolgáltatás-kép; nincs eredmény-, előtte/utána- vagy vendég-fotó', () => {
    const kepek = [...b.matchAll(/<img\b[^>]*\ssrc="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    assert.ok(kepek.length >= 8);
    for (const k of kepek) {
      assert.ok(fs.existsSync(path.join(GYOKER, k)), 'hiányzó kép: ' + k);
      assert.ok(!/eredmeny-|vendeg-|elotte|utana|jel-/.test(k), 'eredmény-ígéretre utaló kép: ' + k);
    }
    assert.ok(kepek.includes('/assets/img/oxigen/oxigen-kezeles.jpg'), 'hős-kép: a hajkamerás vizsgálat fotója');
    assert.ok(/Szemléltető kép<\/figcaption>/.test(b), 'a szemléltető kép felirattal');
  });

  test('GYIK: a brief kérdései, a válaszok az /oxigenterapia-budapest GYIK-jából (eredményígéret nélkül)', () => {
    const gy = szekcio(b, 'gyik-szekcio');
    const kerdesek = [...gy.matchAll(/<summary>([^<]*)<\/summary>/g)].map((m) => m[1]);
    for (const k of ['Kell-e kezelést vennem?', 'Az állapotfelmérés orvosi diagnózis?', 'Hány alkalom kell a kezelésből?', 'Mennyi ideig tart az első kezelés?', 'Mi történik, ha le kell mondanom az időpontot?']) assert.ok(kerdesek.includes(k), k);
    const fo = lathato(olvas('foglalas/oxigenterapia-budapest.html'));
    // a szó szerint átvett válaszok a fő oldalon is megvannak
    for (const mondat of ['Nem helyettesíti az orvosi vizsgálatot, és nem állít fel orvosi diagnózist.', 'Az időpont módosítását vagy lemondását legkésőbb az időpont előtt 24 órával kérjük jelezni, hogy más vendég is lefoglalhassa.', 'Igen, a SZÉP Kártyát is elfogadjuk.']) {
      assert.ok(lathato(gy).includes(mondat) && fo.includes(mondat), mondat);
    }
    assert.ok(/24 órával/.test(lathato(gy)));
  });

  test('a fejléc / Infó-ablak / lábléc a build láncával: a FOGLALÁS gombok az oxigén hajvizsgálat foglalójára mutatnak, nincs /idpontfoglalas, a nyitvatartás csak hétköznap', async () => {
    const { fejlecAtalakit, foglalasCel, nyitvatartasHetkoznap, FOGLALAS_JELOLO, NYITVATARTAS_JELOLO } = await import(pathToFileURL(path.join(GYOKER, 'tools/fejlec-menu.mjs')).href);
    const jel = (FORRAS.match(FOGLALAS_JELOLO) || [])[1];
    assert.equal(jel, 'business=oxygen&service=466147');
    assert.ok(NYITVATARTAS_JELOLO.test(FORRAS));
    const cel = '/foglalo-motor?' + jel;
    for (const [fajl, mobil] of [['asztali', false], ['mobil', true], ['lablec-asztali', false], ['lablec-mobil', true]]) {
      let x = fejlecAtalakit(olvas(`assets/fejlec/${fajl}.html`), mobil, false);
      x = nyitvatartasHetkoznap(foglalasCel(x, jel));
      assert.ok(!hrefek(x).includes('/idpontfoglalas'), fajl + ': nincs /idpontfoglalas');
      assert.ok(!hrefek(x).some((u) => /mosaic-hair-idopontfoglalas/.test(u)));
      assert.ok(!hrefek(x).includes('/foglalo-motor?business=headspa'), fajl + ': nincs business=headspa foglaló-link');
      if (/lablec/.test(fajl)) { assert.ok(hrefek(x).includes(cel), fajl + ': a lábléc gombja'); assert.ok(/Hétfő – Péntek: 8:00 – 20:00/.test(x) && !/Szombat|Vasárnap/.test(x), fajl + ': csak hétköznap'); }
      else { assert.ok(hrefek(x).includes(cel), fajl + ': a FOGLALÁS gomb'); assert.ok(!/Szombat|Vasárnap/.test(x.replace(/Ajándékkártya/g, '')), fajl + ': nincs szombat / vasárnap'); }
    }
    // az oldal törzsében sincs régi útvonal (a CSS-szelektorok a közös fejléc-CSS-ben nem linkek)
    assert.ok(!hrefek(b).some((u) => /idpontfoglalas/.test(u)));
  });
});

// --- böngészős tesztek (könnyű helyi szerver) -------------------------------------------------------------------------------------------------
let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

async function nyit(nev, { szeles = 1440, alap = null } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], nincs = [], kulso = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  const b = alap || bazis;
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(b)) nincs.push(r.status() + ' ' + r.url().replace(b, '')); });
  await p.route((u) => !u.href.startsWith(b), (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${b}/${encodeURI(nev)}`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
  });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, nincs, kulso };
}

describe(`böngészős: /${NEV}`, () => {
  test('betöltődik hibák nélkül (asztali + mobil): egyetlen H1, nincs törött kép / 404 / konzol-hiba, nincs vízszintes görgetés 1440 / 390 / 360 px-en', async () => {
    for (const szeles of [1440, 390, 360]) {
      const { p, ctx, hibak, nincs } = await nyit(NEV, { szeles });
      assert.equal(await p.locator('h1').count(), 1, szeles + ': 1 H1');
      assert.deepEqual(hibak, [], szeles + ': konzol-hibák');
      assert.deepEqual(nincs, [], szeles + ': 404-ek');
      const torott = await p.$$eval('img', (l) => l.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
      assert.deepEqual(torott, [], szeles + ': törött képek');
      const tulcsordul = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(tulcsordul <= 1, szeles + ' px: vízszintes görgetés (' + tulcsordul + ' px)');
      await ctx.close();
    }
  });

  test('mobil első képernyő (390×844): látszik a H1, az ár, az egyetlen fő gomb és a hely; a fő gomb a 466147 foglalóra mutat', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    const dobozok = await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, text: e.textContent.replace(/\s+/g, ' ').trim() }; };
      return { h1: r('.hero h1'), ar: r('.hero-ar'), gomb: r('.hero-cta .gomb'), hely: r('.hero-hely'), lead: r('.hero-lead'), ertekeles: r('.hero-ertekeles'), href: document.querySelector('.hero-cta .gomb').getAttribute('href') };
    });
    for (const k of ['h1', 'lead', 'ar', 'gomb']) assert.ok(dobozok[k] && dobozok[k].bottom <= 844 && dobozok[k].top >= 0, k + ' az első képernyőn: ' + JSON.stringify(dobozok[k]));
    assert.ok(dobozok.hely.top < 844 && dobozok.ertekeles.top < 844, 'a hely és az értékelés is látszik / közvetlenül a hős-rész alján van');
    assert.ok(/4\s?990/.test(dobozok.ar.text));
    assert.equal(dobozok.href, FO_HREF);
    assert.ok(dobozok.gomb.right <= 390 && dobozok.gomb.left >= 0);
    await ctx.close();
  });

  test('mobil sticky CTA: eleinte rejtett, a "Mikor érdemes?" elgörgetése után megjelenik (az egyetlen fő gombbal), a záró sávnál eltűnik; asztalon nincs', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    const allapot = () => p.evaluate(() => { const s = document.getElementById('sticky-cta'); const b = s.getBoundingClientRect(); return { lathato: s.classList.contains('lathato'), aria: s.getAttribute('aria-hidden'), bottom: b.bottom, top: b.top, szoveg: s.textContent.replace(/\s+/g, ' ').replace('→', '').trim(), href: s.querySelector('a').getAttribute('href') }; });
    assert.equal((await allapot()).lathato, false, 'a tetején rejtett');
    await p.evaluate(() => document.querySelector('.figyelmeztetes').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(500);
    const kozben = await allapot();
    assert.equal(kozben.lathato, true, 'a "Mikor érdemes?" után látszik');
    assert.ok(kozben.top < 844 && kozben.bottom <= 844 + 1, 'az ablak alján áll: ' + JSON.stringify(kozben));
    assert.equal(kozben.szoveg, BRIEF.fo); assert.equal(kozben.href, FO_HREF);
    await p.evaluate(() => document.querySelector('.zaro').scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(500);
    assert.equal((await allapot()).lathato, false, 'a záró sávnál eltűnik');
    await ctx.close();
    const d = await nyit(NEV, { szeles: 1440 });
    assert.equal(await d.p.evaluate(() => getComputedStyle(document.getElementById('sticky-cta')).display), 'none', 'asztalon nincs sticky sáv');
    await d.ctx.close();
  });

  test('működés: a GYIK nyílik / zárul, a kezelő-sor 3 kezelővel, az értékelés és a Térkép-linkek új lapon nyílnak, a külső erőforrások (hálózat tiltva) nem törik az oldalt', async () => {
    const { p, ctx, hibak } = await nyit(NEV, { szeles: 1440 });
    const elso = p.locator('.gyik-lista details').first();
    await elso.locator('summary').click();
    assert.equal(await elso.evaluate((e) => e.open), true);
    await elso.locator('summary').click();
    assert.equal(await elso.evaluate((e) => e.open), false);
    assert.equal(await p.locator('.kezelo').count(), 3);
    const linkek = await p.$$eval('a[href^="https://www.google.com/maps"], a[href^="https://www.glamour.hu"]', (l) => l.map((a) => [a.target, a.rel]));
    assert.ok(linkek.length >= 4);
    for (const [t, r] of linkek) { assert.equal(t, '_blank'); assert.match(r, /noopener/); }
    assert.deepEqual(hibak, []);
    await ctx.close();
  });
});

// --- dist-tesztek: a build valódi kimenete (csak ha a build már lefutott) ---------------------------------------------------------------------
const DIST = path.join(GYOKER, 'dist');
const VAN_DIST = fs.existsSync(path.join(DIST, '_a', NEV + '.html')) && fs.existsSync(path.join(DIST, '_m', NEV + '.html'));
describe('dist (a build kimenete)', { skip: !VAN_DIST && 'nincs dist/: előbb CF_PAGES=1 CF_PAGES_BRANCH=main node tools/netlify-build.mjs' }, () => {
  let distSzerver, distBazis;
  before(async () => {
    const { fajlUtvonal } = await import(pathToFileURL(path.join(GYOKER, 'tools/serve-dist.mjs')).href);
    distSzerver = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers['user-agent']);
      if (e.atiranyit) { res.writeHead(301, { location: e.atiranyit }); return res.end(); }
      fs.readFile(e.fajl, (hiba, adat) => {
        if (hiba) { res.writeHead(404); return res.end('nincs'); }
        const t = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json' }[path.extname(e.fajl)] || 'application/octet-stream';
        res.writeHead(200, { 'content-type': t }); res.end(adat);
      });
    }).listen(0);
    await new Promise((ok) => distSzerver.once('listening', ok));
    distBazis = 'http://localhost:' + distSzerver.address().port;
  });
  after(() => distSzerver?.close());

  test('a build fejléce / Infó-ablaka / lábléce: a FOGLALÁS gombok a 466147 foglalóra mutatnak, nincs /idpontfoglalas vagy business=headspa link, a nyitvatartás csak H–P (asztali + mobil)', () => {
    for (const mappa of ['_a', '_m']) {
      const x = fs.readFileSync(path.join(DIST, mappa, NEV + '.html'), 'utf8');
      const mind = hrefek(x);
      assert.ok(!mind.some((u) => /idpontfoglalas/.test(u)), mappa + ': nincs /idpontfoglalas link');
      assert.ok(!mind.includes('/foglalo-motor?business=headspa'), mappa + ': nincs business=headspa link');
      const motor = mind.filter((u) => /foglalo-motor/.test(u));
      assert.ok(motor.length >= 7, mappa + ': a fő gomb a törzsön kívül is (fejléc, Infó-ablak, lábléc): ' + motor.length);
      for (const u of motor) assert.ok(u === FO_HREF || u === MASODLAGOS_HREF, mappa + ': ' + u);
      assert.ok(/Hétfő – Péntek: 8:00 – 20:00/.test(x) && !/Hétfő – Szombat/.test(x), mappa + ': nyitvatartás');
      assert.match(x, /booking-launcher\.js/);
      assert.match(x, /<meta name="robots" content="noindex, nofollow">/);
    }
  });

  test('a fő gomb a foglaló-réteget nyitja (a launcher), a rétegben a megfelelő szolgáltatás-kontextus (business=oxygen, service=466147); nincs konzol-hiba', async () => {
    const { p, ctx, hibak } = await nyit(NEV, { szeles: 1440, alap: distBazis });
    await p.locator('.hero-cta .gomb').click();
    await p.waitForSelector('#mosaic-booking-layer', { timeout: 20000 });
    const url = await p.evaluate(() => location.search + '|' + location.pathname);
    assert.ok(await p.locator('#mosaic-booking-layer').count() === 1, 'a réteg megnyílt');
    assert.ok(!/business=headspa/.test(url));
    assert.deepEqual(hibak.filter((h) => !/Salonic|salonic|fetch|CORS|net::|Failed/i.test(h)), [], 'konzol-hibák (a tiltott külső hálózat hibái nélkül)');
    await ctx.close();
  });
});
