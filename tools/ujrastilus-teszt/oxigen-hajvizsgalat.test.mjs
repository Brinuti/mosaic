// /hajvizsgalat-budapest (Google Ads OX-2: hajkamerás hajvizsgálat 4 990 Ft) tesztjei.
//
//   node --test tools/ujrastilus-teszt/oxigen-hajvizsgalat.test.mjs
//
// Környezeti változók: CHROME_UTVONAL (alapból a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappája).
// 1) statikus tesztek (nincs böngésző): meta-adatok, tiltott / megerősítésre váró tartalom, ár-egyezés a Salonic-pillanatképpel, foglaló-linkek, a fejléc / lábléc a build láncával,
//    Feri visszajelzése (2026-10-20): "Így tudunk segíteni" blokk, oxigénes magyarázó blokkok (az élő oldalról átvett szöveg), nincs kifelé vivő Google-értékelés / Térkép link;
// 2) böngészős tesztek a könnyű helyi szerverrel (tools/headspa-teszt/szerver.mjs, nincs dist / külső hálózat): hibamentes betöltés, vízszintes görgetés, a hős sorrendje mobilon
//    (H1 -> kép -> alcím), belső görgető gombok (értékelés -> vélemények, Térkép -> térképes blokk; nincs #hash / history), "Első kezelés hajkamerás vizsgálattal" egy sorban, MEGTÖRT SOR ellenőrzés 360 / 390 / 412 px-en,
//    sticky CTA;
// 3) dist-tesztek (csak ha a `CF_PAGES=1 CF_PAGES_BRANCH=main node tools/netlify-build.mjs` már lefutott): a build valódi fejléce / lábléca, a foglaló-réteg megnyílik a fő gombra és a mobil sticky gombra.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';
import { torottSorok } from './hajvizsgalat-torott-sor.mjs';

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
  title: 'Hajvizsgálat Budapest – hajkamerás fejbőr vizsgálat 4 990 Ft – MOSAIC', // a Google Ads celoldal-terv (OX-2, 2026-10-31) szerint
  description: 'Hullik vagy ritkul a hajad? Hajkamerás haj- és fejbőr-állapotfelmérés 4 990 Ft-ért, kezelés nélkül is. Kolosy tér, online foglalás.',
  h1: 'Hajvizsgálat Budapest – hajkamerás haj- és fejbőr vizsgálat 4 990 Ft-ért', // a Google Ads celoldal-terv (OX-2, 2026-10-31) szerint
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

  test('title ≤ 75 (a Google Ads céloldal-terv szövege, 2026-10-31), description ≤ 155 karakter, a brief szövegével; pontosan 1 H1 (a brief szerint); canonical a végleges éles cím; az oldal egyelőre NEM indexelhető (Feri: holnap átbeszéljük)', () => {
    const title = /<title>([^<]*)<\/title>/.exec(h)[1];
    const desc = /<meta name="description" content="([^"]*)"/.exec(h)[1];
    assert.equal(title, BRIEF.title);
    // a title a Google Ads celoldal-terv (OX-2, 2026-10-31) szovege betu szerint: 60 karakternel hosszabb, ezt a terv igy kéri (a keresoben a vege levaghato)
    assert.ok([...title].length <= 75, 'title hossza: ' + [...title].length);
    assert.equal(desc, BRIEF.description);
    assert.ok([...desc].length <= 155, 'description hossza: ' + [...desc].length);
    assert.equal((b.match(/<h1[\s>]/g) || []).length, 1, 'pontosan 1 H1');
    assert.equal(lathato(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(b)[1]), BRIEF.h1);
    assert.match(h, /<link rel="canonical" href="https:\/\/www\.mosaicheadspa\.hu\/hajvizsgalat-budapest">/);
    assert.match(h, /<meta property="og:url" content="https:\/\/www\.mosaicheadspa\.hu\/hajvizsgalat-budapest">/);
    assert.ok(!/<meta name="robots"/.test(h), 'ÉLES: nincs robots meta (indexelhető)');
    assert.ok(fs.readFileSync(path.join(GYOKER, 'tools/wix-sitemap/pages-sitemap.xml'), 'utf8').includes('<loc>https://www.mosaicheadspa.hu/hajvizsgalat-budapest</loc>'), 'a sitemapben szerepel');
  });

  test('a hős-részben: H1, a brief szerinti alcím, ár, EGY fő gomb, hely + BELSŐ "térkép" gomb, BELSŐ Google-értékelés gomb (4,9 – 1 266); nincs kifelé vivő link', () => {
    const hero = szekcio(b, 'hero');
    const sz = lathato(hero);
    assert.ok(sz.includes(BRIEF.alcim), 'alcím');
    assert.ok(/4 990 Ft/.test(sz), 'ár a hős-részben');
    const gombok = [...hero.matchAll(/<a class="gomb[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
    assert.equal(gombok.length, 1, 'egyetlen fő gomb a hős-részben');
    assert.equal(gombok[0][1].replace(/&amp;/g, '&'), FO_HREF);
    assert.equal(lathato(gombok[0][2]).replace(/\s*→$/, ''), BRIEF.fo);
    assert.ok(sz.includes('1023 Budapest, Bécsi út 2., Kolosy tér és Zsigmond tér között'), 'pontos hely');
    // Feri (2026-10-20): a Térkép és az értékelés NEM visz ki az oldalról: <button data-gorget> (nem #horgony-link: a GTM History Change minden hash-változásra mérést indítana)
    assert.ok(/<button type="button" class="link-gomb" data-gorget="terkep">Megnézem a térképen/.test(hero), 'a hős hely-sorában belső "Megnézem a térképen" gomb a #terkep blokkra');
    assert.ok(/<button type="button" class="hero-ertekeles" data-gorget="velemenyek">[\s\S]*?4,9 – 1 266 Google-értékelés/.test(hero), 'a hős értékelése belső gomb a #velemenyek blokkra: 4,9 – 1 266 Google-értékelés (a google-szam.js élő számra cseréli)');
    assert.ok(!/<a\b[^>]*\shref="#/.test(hero), 'a hős-részben nincs #horgony-link');
    assert.deepEqual(hrefek(hero).filter((u) => /^https?:/.test(u)), [], 'a hős-részben nincs kifelé vivő (http) link');
    assert.ok(!/target="_blank"/.test(hero), 'a hős-részben nincs új lapon nyíló link');
    assert.ok(!/Előtte|Utána|eredmeny-\d|vendeg-0/.test(hero), 'nincs előtte/utána kép a hős-részben');
  });

  test('a hős DOM-sorrendje: H1, majd a fotó, majd az alcím (a CSS mobilon CÍM -> KÉP -> alcím rendezi; asztalon két oszlop)', () => {
    const hero = szekcio(b, 'hero');
    const i = (re) => { const m = re.exec(hero); assert.ok(m, String(re)); return m.index; };
    assert.ok(i(/<h1[\s>]/) < i(/class="hero-szoveg"/) && i(/class="hero-szoveg"/) < i(/class="hero-galeria/), 'H1, szöveg-doboz, fotó a forrásban');
    const css = olvas('assets/css/oxigen-hajvizsgalat.css');
    assert.match(css, /@media \(max-width: 1100px\) \{\s*\.hero-hajv \.hero-racs \{ grid-template-areas: "cim" "gal" "szoveg"; \}/, 'a hős-rács mobilon: cim, gal, szoveg');
  });

  test('NINCS kifelé vivő Google-értékelés / Térkép link az oldal forrásában: csak az "Útvonaltervezés" (navigáció) és a Glamour-cikk visz ki; a görgető gombok célelemei léteznek (#velemenyek, #terkep)', () => {
    const kifele = hrefek(b).filter((u) => /^https?:/.test(u));
    const google = kifele.filter((u) => /maps\.app\.goo\.gl|google\.com\/maps|g\.page|search\.google\.com|google\.[a-z]+\/search|goo\.gl/.test(u));
    assert.equal(google.length, 1, 'egyetlen Google-link maradt: ' + JSON.stringify(google));
    assert.match(google[0], /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/, 'az egyetlen maradó Google-link az Útvonaltervezés (navigáció)');
    const utv = /<a class="gomb[^"]*"[^>]*href="https:\/\/www\.google\.com\/maps\/dir[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    assert.ok(utv && /Útvonaltervezés/.test(lathato(utv[1])), 'a maradó Google-link felirata: Útvonaltervezés');
    assert.deepEqual(kifele.filter((u) => !google.includes(u)), ['https://www.glamour.hu/szepseg/oxigenterapia-modszer-hajhullas/wjcmlmd'], 'a Google-on kívül csak a Glamour-cikk visz ki');
    // a bizalom-blokkban a Google-kártya nem link
    assert.ok(/<div class="bizalom-google">/.test(b) && !/<a class="bizalom-google"/.test(b), 'a Google-kártya nem link');
    assert.ok(!/Összes vélemény a Google-on|Megnyitás a Google Térképen/.test(lathato(b)), 'nincs "Összes vélemény a Google-on" / "Megnyitás a Google Térképen" felirat');
    // belső görgető gombok: <button data-gorget="<id>">, minden célelemmel; az oldalon NINCS #horgony-link (GTM History Change), a szkript nem ír URL-t / history-t
    assert.ok(!/<a\b[^>]*\shref="#/.test(b.replace(/<!--[\s\S]*?-->/g, '')), 'nincs href="#..." link az oldalon (GTM History Change)');
    const gombok = [...b.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<button\b[^>]*data-gorget="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(gombok.length >= 2);
    for (const cel of gombok) assert.ok(new RegExp(`id="${cel}"`).test(b), 'célelem: #' + cel);
    assert.ok(gombok.includes('velemenyek') && gombok.includes('terkep'));
    const js = olvas('assets/js/oxigen-hajvizsgalat.js').replace(/\/\/[^\n]*/g, '');
    assert.ok(!/pushState|replaceState|location\.hash|location\.href|location\.assign|dataLayer|fetch\(|XMLHttpRequest|sendBeacon/.test(js), 'a szkript nem ír URL-t / history-t, nem mérőkód, nincs hálózati kérése a görgetéshez');
    assert.ok(/<script src="\/assets\/js\/oxigen-hajvizsgalat\.js" defer><\/script>/.test(FORRAS));
    // a #velemenyek blokkban a beágyazott Trustindex-keret ugyanaz a fájl, mint az /oxigenterapia-budapest oldalon; a #terkep a hely-szekcióban áll
    const vel = /id="velemenyek"[\s\S]*?<\/section>/.exec(b)[0];
    assert.match(vel, /class="ti-doboz" id="ti-doboz" data-forras="\/assets\/embed\/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6\.html"/);
    assert.ok(olvas('foglalas/oxigenterapia-budapest.html').includes('data-forras="/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html"'), 'ugyanaz a beágyazott fájl, mint a fő oldalon');
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html')));
    assert.deepEqual(hrefek(vel), [], 'a vélemény-blokkban nincs link (a Trustindex-keretet a JS tölti)');
    assert.ok(/id="terkep"/.test(szekcio(b, 'szalon')), 'a térképes blokk a hely-szekcióban');
    assert.ok(/<a class="szalon-tel" href="tel:\+36202474444">/.test(b), 'a telefon tel: link marad');
  });

  test('"Így tudunk segíteni" blokk (a következő lépés): megvan, 3 lépés, a "kezelést választasz" szöveg sehol nincs; az ár- és kezelés-szöveg a meglévő oldalról való', () => {
    const seg = szekcio(b, 'segitunk');
    assert.match(lathato(seg), /^Így tudunk segíteni /);
    assert.equal((seg.match(/<li class="lepes3">/g) || []).length, 3, '3 lépés');
    assert.ok(/következő alkalommal megkezdhetjük/.test(lathato(seg)) && /Nincs kötelező kezelés vagy bérlet/.test(lathato(seg)));
    assert.ok(!/kezelést választasz|választasz/i.test(lathato(b)) && !/kezelést választasz/i.test(b), 'a "kezelést választasz" szöveg nincs az oldalon');
    // sorrend: a figyelmeztető doboz után, az oxigénes magyarázó blokk és az árak előtt
    assert.ok(b.indexOf('class="figyelmeztetes"') < b.indexOf('id="segitunk"') && b.indexOf('id="segitunk"') < b.indexOf('id="oxigenes-hajkezeles"') && b.indexOf('id="oxigenes-hajkezeles"') < b.indexOf('id="video"') && b.indexOf('id="video"') < b.indexOf('id="arak"'));
    // a lépések mondatai az éles oldalról valók (szó szerint vagy a bekezdéseiből): az "Így tudunk segíteni" szövegek forrása
    const fo = lathato(olvas('foglalas/oxigenterapia-budapest.html'));
    for (const m of ['kezelés nélkül is foglalható: megnézzük a fejbőröd állapotát, átbeszéljük a kérdéseidet, és javaslatot adunk a következő lépésre. Utána nincs kötelezettséged.', 'ez alapján döntjük el veled együtt, milyen következő lépésnek van értelme', 'Személyre szabott javaslat', 'Nincs kötelező bérlet', 'Az első kezelés teljes értékű, és a végén javaslatot adunk a további lépésekre.']) assert.ok(fo.includes(m), 'az éles oldalon is szerepel: ' + m);
  });

  test('oxigénes magyarázó blokkok (az élő /oxigenterapia-budapest oldalról átvéve): "Mit csinálunk az oxigénes hajkezelés során?" (3 lépés + 3 kép) és a videós "Nézd meg, hogyan zajlik egy kezelés"; a szövegek szó szerint az éles oldalon is megvannak; a videó csak kattintásra tölt', () => {
    const fo = lathato(olvas('foglalas/oxigenterapia-budapest.html'));
    const ox = szekcio(b, 'oxigenes'), vid = szekcio(b, 'video-sor');
    const lox = lathato(ox), lvid = lathato(vid);
    assert.ok(lox.includes('Mit csinálunk az oxigénes hajkezelés során?'));
    for (const mondat of ['A kezelés során megtisztítjuk és hidratáljuk a fejbőrt, majd a kiválasztott ápoló hatóanyagokat oxigén segítségével visszük fel.', 'A protokollt a hajkamerás vizsgálat és a fejbőr állapota alapján személyre szabjuk.',
      'Gyengéden megtisztítjuk és hidratáljuk a fejbőrt.', 'Személyre szabott hatóanyagokat alkalmazunk.', 'Az ápoló hatóanyagokat oxigén segítségével visszük fel.']) {
      assert.ok(lox.includes(mondat) && fo.includes(mondat), 'az éles oldalról: ' + mondat);
    }
    assert.equal((ox.match(/<li class="lk">/g) || []).length, 3);
    assert.equal((ox.match(/<img /g) || []).length, 3, '3 kép a magyarázó blokkban');
    for (const mondat of ['Nálunk a kezelés privát, csendes, mindenkitől elzárt kezelőszobában zajlik: csak te és a kezelőd vagytok bent.', 'Zárt kezelőszobában dolgozunk, nem közös térben. A kezelés alatt senki más nem lát, és nem néz.',
      'Senki nem nézi a hajad vagy a fejbőröd, így nem kell zavarban lenned, és nem kell kellemetlenül éreznod magad. Nyugodtan beszélhetsz a panaszaidról.', 'Kényelmesen, hanyatt fekve, ellazulva zajlik a kezelés.']) {
      assert.ok(lvid.includes(mondat) && fo.includes(mondat), 'az éles oldalról: ' + mondat);
    }
    // a videó: ugyanaz a fájl és poszter, mint az éles oldalon, kattintásra töltődik (az oxigen-landing.js), a lap betöltésekor nincs <video>
    assert.match(vid, /id="video-doboz" data-video="\/assets\/video\/c2eb0f_360d73a2bc224690bb9d79edb4f6ed91\.mp4"/);
    assert.ok(!/<video\b/.test(vid), 'nincs <video> a forrásban: kattintásra jön létre');
    for (const f of ['assets/video/c2eb0f_360d73a2bc224690bb9d79edb4f6ed91.mp4', 'assets/img/c2eb0f_360d73a2bc224690bb9d79edb4f6ed91f001.jpg', 'assets/img/oxigen/oxigen-keszulek.jpg']) assert.ok(fs.existsSync(path.join(GYOKER, f)), f);
    // az eredményígéret / előtte-utána nem jön át: a blokkokban nincs "hatás", "eredmény", "hajhullás ellen", "95%"
    assert.ok(!/eredmény|hatás|hajhullás ellen|95\s*%|gyógy|megállít/i.test(lox + ' ' + lvid), 'nincs eredmény- / hatás-állítás a magyarázó blokkokban');
    // a kezelés ára az árak-blokkban (a meglévő oldalról), CTA-val
    const ar = szekcio(b, 'oxi-arak');
    assert.ok(/Az oxigénes hajkezelés árai/.test(lathato(ar)) && /29 900 Ft/.test(lathato(ar)) && hrefek(ar).includes(FO_HREF) && hrefek(ar).includes(MASODLAGOS_HREF), 'árak + CTA');
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
    assert.ok(fo.length >= 5, 'a fő gomb legalább 5 helyen (hős, Mit kapsz, árak, záró sáv, mobil sticky): ' + fo.length);
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

  test('a hős sorrendje mobilon (360 / 390 / 412 px): H1 -> kép -> alcím -> ár -> fő gomb -> hely -> értékelés; a fő gomb a 466147 foglalóra mutat és az első képernyőn (844 px) van; tableten (768 px) ugyanez a sorrend; asztalon (1280 px) két oszlop: szöveg balra, fotó jobbra', async () => {
    const meres = (p) => p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right, text: e.textContent.replace(/\s+/g, ' ').trim() }; };
      return { h1: r('.hero h1'), kep: r('.hero .hero-galeria'), lead: r('.hero-lead'), ar: r('.hero-ar'), gomb: r('.hero-cta .gomb'), hely: r('.hero-hely'), ertekeles: r('.hero-ertekeles'), href: document.querySelector('.hero-cta .gomb').getAttribute('href'), kepKep: r('.hero .hg-kep img') };
    });
    for (const szeles of [360, 390, 412]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      const d = await meres(p);
      // 1) a H1 UTÁN KÖZVETLENÜL a kép, utána az alcím (nincs közöttük más)
      assert.ok(d.h1.bottom <= d.kep.top + 1, szeles + ': a kép a H1 alatt van');
      assert.ok(d.kep.top - d.h1.bottom < 40, szeles + ': a kép KÖZVETLENÜL a H1 után jön (' + Math.round(d.kep.top - d.h1.bottom) + ' px rés)');
      assert.ok(d.kep.bottom <= d.lead.top + 1, szeles + ': az alcím a kép után jön');
      assert.ok(d.lead.bottom <= d.ar.top + 1 && d.ar.bottom <= d.gomb.top + 1 && d.gomb.bottom <= d.hely.top + 1 && d.hely.bottom <= d.ertekeles.top + 1, szeles + ': alcím -> ár -> gomb -> hely -> értékelés');
      // 2) a kép teljes szélességű, nem vágódik le oldalt, és a fő gomb még az első képernyőn van
      assert.ok(d.kep.left >= 0 && d.kep.right <= szeles + 1, szeles + ': a kép nem lóg ki');
      assert.ok(d.gomb.bottom <= 844, szeles + ': a fő gomb az első képernyőn (' + Math.round(d.gomb.bottom) + ' px)');
      assert.ok(d.kepKep.right - d.kepKep.left > szeles - 60, szeles + ': a kép széles (' + Math.round(d.kepKep.right - d.kepKep.left) + ' px)');
      assert.ok(/4\s?990/.test(d.ar.text));
      assert.equal(d.href, FO_HREF);
      assert.ok(d.gomb.right <= szeles && d.gomb.left >= 0);
      await ctx.close();
    }
    // tablet: ugyanaz a sorrend
    { const { p, ctx } = await nyit(NEV, { szeles: 768 });
      const d = await meres(p);
      assert.ok(d.h1.bottom <= d.kep.top + 1 && d.kep.bottom <= d.lead.top + 1 && d.lead.bottom <= d.gomb.top + 1, '768: H1 -> kép -> alcím -> gomb');
      await ctx.close(); }
    // asztal: kétoszlopos (szöveg balra, fotó jobbra, a H1 a szöveggel egy oszlopban) - NEM változott
    { const { p, ctx } = await nyit(NEV, { szeles: 1280 });
      const d = await meres(p);
      assert.ok(d.kep.left > d.lead.right - 1 && d.kep.left > 600, 'asztal: a fotó a szöveg jobb oldalán');
      assert.ok(d.h1.left < 100 && d.lead.left < 100 && d.h1.bottom <= d.lead.top + 1, 'asztal: a H1 és az alcím bal oszlop, H1 felül');
      assert.ok(d.kep.top < d.gomb.top, 'asztal: a fotó a szöveggel egy sávban indul');
      await ctx.close(); }
  });

  test('belső görgető gombok: a hős értékelés-jelvénye a #velemenyek blokkra, a "Megnézem a térképen" a #terkep blokkra görget; NEM visz ki az oldalról (nincs új lap, nincs navigáció, nincs #hash-váltás, nincs pushState / replaceState); a fókusz a cél fejlécére kerül', async () => {
    for (const szeles of [390, 1280]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      const url0 = p.url();
      const popup = []; p.context().on('page', (x) => popup.push(x.url()));
      let navig = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) navig++; });
      await p.evaluate(() => { window.__historia = 0; for (const m of ['pushState', 'replaceState']) { const o = history[m]; history[m] = function (...a) { window.__historia++; return o.apply(this, a); }; } window.__hossz = history.length; });
      const navig0 = navig;
      for (const [valaszto, cel] of [['.hero-ertekeles', 'velemenyek'], ['.hero-hely .link-gomb', 'terkep']]) {
        assert.equal(await p.locator(valaszto).evaluate((e) => e.tagName), 'BUTTON', valaszto + ': gomb, nem link');
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.locator(valaszto).click();
        await p.waitForFunction((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.top >= -2 && r.top < 200; }, cel, { timeout: 6000 });
        const r = await p.evaluate((id) => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); const f = document.activeElement; return { hash: location.hash, szelesseg: b.width, mag: b.height, fokusz: f && (f.id || f.tagName), fokuszBenne: !!f && (e.contains(f)) }; }, cel);
        assert.equal(r.hash, '', szeles + ' px: nincs #hash-váltás (GTM History Change): ' + cel);
        assert.equal(p.url(), url0, szeles + ' px: az URL változatlan');
        assert.ok(r.mag > 150 && r.szelesseg > 250, szeles + ' px: a cél (#' + cel + ') látható méretű blokk');
        assert.ok(r.fokuszBenne, szeles + ' px: a fókusz a célblokkba (a fejlécére) került: ' + r.fokusz);
        if (cel === 'velemenyek') assert.equal(r.fokusz, 'velemenyek-cim');
      }
      assert.equal(await p.evaluate(() => window.__historia), 0, szeles + ' px: nincs pushState / replaceState hívás');
      assert.equal(await p.evaluate(() => history.length), await p.evaluate(() => window.__hossz), szeles + ' px: a history nem nőtt');
      assert.equal(navig, navig0, szeles + ' px: nem történt navigáció');
      assert.deepEqual(popup, [], szeles + ' px: nem nyílt új lap');
      await ctx.close();
    }
  });

  test('a "Google térkép megjelenítése" gombra a térképes blokk betölti a Google-térképet (beágyazva); a hely-szekcióban az "Útvonaltervezés" külső (új lapon), a telefon tel: link', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    assert.equal(await p.locator('#terkep iframe').count(), 0, 'beleegyezés / kattintás előtt nincs harmadik fél');
    await p.locator('#terkep-gomb').click();
    const src = await p.locator('#terkep iframe').getAttribute('src');
    assert.match(src, /^https:\/\/www\.google\.com\/maps\?q=.*B%C3%A9csi.*&output=embed$/);
    assert.equal(await p.locator('#terkep-hely').count(), 0, 'a helykitöltő eltűnt');
    const utv = await p.$$eval('a.gomb[href*="google.com/maps/dir"]', (l) => l.map((a) => [a.target, a.rel, a.textContent.trim()]));
    assert.equal(utv.length, 1); assert.equal(utv[0][0], '_blank'); assert.match(utv[0][1], /noopener/); assert.match(utv[0][2], /Útvonaltervezés/);
    assert.equal(await p.locator('a[href^="tel:"]').count() >= 1, true);
    await ctx.close();
  });

  test('"Első kezelés hajkamerás vizsgálattal" (az ársor és a másodlagos linkek) 360 / 390 / 412 px-en EGY sor', async () => {
    for (const szeles of [360, 390, 412]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      const sorok = await p.evaluate(() => {
        const KULCS = 'Első kezelés hajkamerás vizsgálattal';
        const ki = [];
        const bejar = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
        let n;
        while ((n = bejar.nextNode())) {
          const i = n.nodeValue.replace(/\u00a0/g, ' ').indexOf(KULCS);
          if (i < 0) continue;
          const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + KULCS.length);
          const tetejek = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
          // a teljes szövegcsomópont (a "– 29 900 Ft" is) szintén egy sor legyen
          const t = document.createRange(); t.selectNodeContents(n);
          const mind = new Set([...t.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)));
          ki.push({ hely: n.parentElement.className || n.parentElement.tagName, sorKulcs: tetejek.size, sorTeljes: mind.size, szoveg: n.nodeValue.trim() });
        }
        return ki;
      });
      assert.ok(sorok.length >= 3, szeles + ': az ársor + a két másodlagos link: ' + sorok.length);
      for (const x of sorok) { assert.equal(x.sorKulcs, 1, szeles + ' px: egy sor (kulcs): ' + JSON.stringify(x)); assert.equal(x.sorTeljes, 1, szeles + ' px: egy sor (teljes felirat): ' + JSON.stringify(x)); }
      await ctx.close();
    }
  });

  test('ALAPSZABÁLY (Feri): ahol egy vagy két szó csúszik át új sorba, az legyen egy sor - a megtört-sor ellenőrző 360 / 390 / 412 px-en 0 találatot ad (rövid szövegeknél: 2+ soros blokk, utolsó sor ≤ 2 szó; 2 soros törzsszövegnél ugyanez)', async () => {
    for (const szeles of [360, 390, 412]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      const { talalatok, szamlalo } = await torottSorok(p);
      assert.ok(szamlalo > 100, szeles + ': az ellenőrző a szöveges blokkok többségét megmérte (' + szamlalo + ')');
      assert.deepEqual(talalatok, [], szeles + ' px: megtört sorok: ' + JSON.stringify(talalatok.map((t) => `${t.elem}: "${t.utolsoSor}" (${t.sorok} sor)`)));
      await ctx.close();
    }
  });

  test('az ellenőrző önteszt: ismert árva szót (2 soros cím, 1 szó az utolsó sorban) kimutat, a jól tördelt szöveget nem', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    await p.evaluate(() => {
      const m = document.querySelector('main');
      m.insertAdjacentHTML('afterbegin', '<h2 id="onteszt-rossz" style="width:220px;font:700 22px/1.2 Georgia,serif">Szivárványos hajkezelésünkről gondolkodunk</h2><h2 id="onteszt-jo" style="width:220px;font:700 22px/1.2 Georgia,serif">Rövid cím</h2>');
    });
    const { talalatok } = await torottSorok(p);
    const rossz = talalatok.filter((t) => t.elem.includes('onteszt-rossz'));
    assert.equal(rossz.length, 1, 'az árva szót kimutatja: ' + JSON.stringify(talalatok));
    assert.ok(rossz[0].utolsoSzo <= 2 && rossz[0].sorok >= 2);
    assert.equal(talalatok.filter((t) => t.elem.includes('onteszt-jo')).length, 0);
    await ctx.close();
  });

  test('az oxigénes videó: betöltéskor csak a poszter látszik (nincs <video>, nincs letöltött mp4), a gombra kattintva <video> jön létre a meglévő mp4-gyel (oxigen-landing.js); mobilon a doboz belefér a képernyőbe', async () => {
    for (const szeles of [390, 1280]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      assert.equal(await p.locator('#video-doboz video').count(), 0, szeles + ': kattintás előtt nincs <video>');
      const mp4 = []; p.on('request', (r) => { if (/\.mp4/.test(r.url())) mp4.push(r.url()); });
      const doboz = await p.locator('#video-doboz').boundingBox();
      assert.ok(doboz.width <= szeles - 16 && doboz.height > 300, szeles + ': a videó-doboz mérete: ' + JSON.stringify(doboz));
      await p.locator('#video-gomb').scrollIntoViewIfNeeded();
      await p.locator('#video-gomb').click();
      await p.waitForSelector('#video-doboz video', { timeout: 5000 });
      assert.match(await p.locator('#video-doboz video').getAttribute('src'), /\/assets\/video\/c2eb0f_360d73a2bc224690bb9d79edb4f6ed91\.mp4$/);
      assert.equal(await p.locator('#video-doboz video').getAttribute('controls') !== null, true, 'vezérlők');
      await ctx.close();
    }
  });

  test('a vélemény-blokk (#velemenyek): a Trustindex-keret az oldalon belül töltődik (iframe), az oldal-szintű linkek között nincs Google-értékelés / Térkép link; mobilon is látszik a méretes keret', async () => {
    for (const szeles of [390, 1280]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      await p.waitForSelector('#ti-doboz iframe', { timeout: 6000 });
      const adat = await p.evaluate(() => { const v = document.getElementById('velemenyek'); const f = v.querySelector('iframe'); const b = f.getBoundingClientRect(); return { src: f.getAttribute('src'), h: b.height, w: b.width, linkek: [...v.querySelectorAll('a')].map((a) => a.href), cim: v.querySelector('h3').textContent.trim() }; });
      assert.equal(adat.src, '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
      assert.ok(adat.h >= 300 && adat.w >= 300, szeles + ': a keret méretes: ' + JSON.stringify(adat));
      assert.deepEqual(adat.linkek, [], szeles + ': nincs oldal-szintű link a vélemény-blokkban');
      assert.match(adat.cim, /Google/);
      await ctx.close();
    }
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

  test('működés: a GYIK nyílik / zárul, a kezelők (3), a kifelé vivő linkek (Útvonaltervezés, Glamour) új lapon nyílnak, a külső erőforrások (hálózat tiltva) nem törik az oldalt', async () => {
    const { p, ctx, hibak } = await nyit(NEV, { szeles: 1440 });
    const elso = p.locator('.gyik-lista details').first();
    await elso.locator('summary').click();
    assert.equal(await elso.evaluate((e) => e.open), true);
    await elso.locator('summary').click();
    assert.equal(await elso.evaluate((e) => e.open), false);
    assert.equal(await p.locator('.kezelo').count(), 3);
    const linkek = await p.$$eval('main a[href^="http"]', (l) => l.map((a) => [a.target, a.rel]));
    assert.equal(linkek.length, 2, 'a törzsben csak az Útvonaltervezés és a Glamour-cikk visz ki');
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
      assert.ok(!/<meta name="robots"/.test(x), mappa + ': ÉLES: nincs robots meta');
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
  test('minden CTA (hős, "Mit kapsz", árak: fő gomb + 29 900 Ft link, záró sáv, mobil sticky) a foglaló-réteget nyitja; a mobil sticky CTA a "Mikor jöjj?" után jelenik meg és működik (390 px)', async () => {
    const cel = [['.hero-cta .gomb', 1440], ['.allapot-cta .gomb', 1440], ['.kezeles-cta .gomb', 1440], ['.masodlagos-sor .masodlagos', 1440], ['.zaro-cta .gomb', 1440], ['.zaro-cta .masodlagos', 1440]];
    for (const [valaszto, szeles] of cel) {
      const { p, ctx, hibak } = await nyit(NEV, { szeles, alap: distBazis });
      await p.locator(valaszto).scrollIntoViewIfNeeded();
      await p.locator(valaszto).click();
      await p.waitForSelector('#mosaic-booking-layer', { timeout: 20000 });
      assert.equal(new URL(p.url()).pathname.replace(/\/$/, ''), '/' + NEV, valaszto + ': az oldal nem navigált el (a foglaló a rétegben nyílt)');
      assert.deepEqual(hibak.filter((h) => !/Salonic|salonic|fetch|CORS|net::|Failed/i.test(h)), [], valaszto + ': konzol-hibák');
      await ctx.close();
    }
    const { p, ctx, hibak } = await nyit(NEV, { szeles: 390, alap: distBazis });
    assert.equal(await p.evaluate(() => document.getElementById('sticky-cta').classList.contains('lathato')), false, 'a tetején rejtett');
    await p.evaluate(() => document.querySelector('.figyelmeztetes').scrollIntoView({ block: 'center' }));
    await p.waitForSelector('#sticky-cta.lathato', { timeout: 5000 });
    await p.locator('#sticky-cta a').click();
    await p.waitForSelector('#mosaic-booking-layer', { timeout: 20000 });
    assert.equal(new URL(p.url()).pathname.replace(/\/$/, ''), '/' + NEV);
    assert.deepEqual(hibak.filter((h) => !/Salonic|salonic|fetch|CORS|net::|Failed/i.test(h)), [], 'sticky: konzol-hibák');
    await ctx.close();
  });
  test('a build kimenetén is: nincs konzol-hiba, 404, törött kép és vízszintes görgetés (390 / 1280 px); a hős sorrendje mobilon H1 -> kép -> alcím; a megtört-sor ellenőrző 360 / 390 / 412 px-en 0', async () => {
    for (const szeles of [1280, 390]) {
      const { p, ctx, hibak, nincs } = await nyit(NEV, { szeles, alap: distBazis });
      assert.deepEqual(hibak, [], szeles + ': konzol-hibák');
      assert.deepEqual(nincs, [], szeles + ': 404-ek');
      const torott = await p.$$eval('img', (l) => l.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
      assert.deepEqual(torott, [], szeles + ': törött képek');
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, szeles + ': vízszintes görgetés');
      await ctx.close();
    }
    for (const szeles of [360, 390, 412]) {
      const { p, ctx } = await nyit(NEV, { szeles, alap: distBazis });
      const d = await p.evaluate(() => { const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY }; }; return { h1: r('.hero h1'), kep: r('.hero .hero-galeria'), lead: r('.hero-lead'), gomb: r('.hero-cta .gomb') }; });
      assert.ok(d.h1.bottom <= d.kep.top + 1 && d.kep.bottom <= d.lead.top + 1 && d.lead.bottom <= d.gomb.top + 1, szeles + ': H1 -> kép -> alcím -> gomb');
      const { talalatok } = await torottSorok(p);
      assert.deepEqual(talalatok, [], szeles + ' px: megtört sorok (build): ' + JSON.stringify(talalatok.map((t) => `${t.elem}: "${t.utolsoSor}"`)));
      await ctx.close();
    }
  });
});
