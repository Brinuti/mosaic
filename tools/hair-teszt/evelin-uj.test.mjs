// Az Evelin-oldal UJ, hirdetesi valtozata (/noi-hajfestes-evelin-uj, Google Ads FOD-3, brief 4. szakasz) tesztjei: statikus ellenorzesek + bongeszos (Playwright) vizsgalat.
// NINCS dist/ build es NINCS kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs) a build fejlec/lablec-logikajaval (mh-foglalas / mh-nyitvatartas jelolok is) allitja ossze az oldalt.
//
//   node --test tools/hair-teszt/evelin-uj.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (mint a hair.test.mjs-nel).
// 2026-10-20 (Feri visszajelzese): hero-sorrend mobilon (cim -> kep -> alcim), lapozhato tofestes-galeria, belso gorgetes (nincs kifele vivo Google-ertekeles / terkep link), megtort sorok ellenorzese.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const adat = await import(pathToFileURL(path.join(GYOKER, 'tools/hair-oldalak/adat.mjs')).href);
const gen = await import(pathToFileURL(path.join(GYOKER, 'tools/hair-oldalak.mjs')).href);
const genUj = await import(pathToFileURL(path.join(GYOKER, 'tools/hair-oldalak-evelin-uj.mjs')).href);
const { szerverInditas } = await import(pathToFileURL(path.join(GYOKER, 'tools/headspa-teszt/szerver.mjs')).href);
const { LAPOK, FODRASZOK, PILLANATKEP } = adat;
const { oldalMeres, hamisSzabadIdo, SZELESSEGEK, playwright: playwrightTorott } = await import(pathToFileURL(path.join(GYOKER, 'tools/hair-teszt/evelin-uj-torott-sor.mjs')).href);
const NEV = genUj.FAJL_NEV; // noi-hajfestes-evelin-uj
const UT = '/' + NEV;
const olvas = (...p) => fs.readFileSync(path.join(GYOKER, ...p), 'utf8').replace(/\r\n/g, '\n');
const forras = () => olvas('foglalas', NEV + '.html');
const szoveg = (html) => html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const torzs = (html) => (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];
const hrefek = (html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));

function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}

const EVELIN = FODRASZOK.evelin;
const evelinSzolg = PILLANATKEP.szolgaltatasok.filter((s) => s.fodraszok.includes(EVELIN.id));
const tol = (kat) => Math.min(...evelinSzolg.filter((s) => s.kat === kat).map((s) => s.ar));
const ftSzoveg = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft';

// ======================= statikus ellenorzesek =======================
describe('generalt fajl, a meglevo oldalak valtozatlanok', () => {
  test('a foglalas/noi-hajfestes-evelin-uj.html megegyezik a generator kimenetevel (node tools/hair-oldalak-evelin-uj.mjs)', () => {
    assert.equal(forras(), genUj.oldal());
  });
  test('a meglevo 4 fodraszat-oldal (koztuk a /noi-hajfestes-budapest) megegyezik a SAJAT generatoraval: ehhez az oldalhoz nem nyultunk', () => {
    for (const k of Object.keys(LAPOK)) assert.equal(olvas('foglalas', LAPOK[k].fajl + '.html'), gen.oldal(k), `${LAPOK[k].fajl}.html valtozott`);
  });
  test('nincs elesben: noindex, onmagara mutato canonical / og:url, nincs a sitemapben, nincs ra link sehonnan (sem a foglalas/, sem a klon/ oldalakon)', () => {
    const h = forras();
    assert.match(h, /<meta name="robots" content="noindex, nofollow">/);
    assert.ok(h.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu${UT}">`));
    assert.ok(h.includes(`<meta property="og:url" content="https://www.mosaicheadspa.hu${UT}">`));
    assert.ok(!olvas('sitemap.xml').includes(NEV), 'a sitemapben');
    for (const mappa of ['foglalas', 'klon', 'klon/m', 'assets/fejlec']) {
      for (const f of fs.readdirSync(path.join(GYOKER, mappa)).filter((x) => x.endsWith('.html') && x !== NEV + '.html')) {
        assert.ok(!olvas(mappa, f).includes(NEV), `${mappa}/${f} hivatkozik az uj oldalra`);
      }
    }
  });
  test('az "-uj" cim (noi-hajfestes-budapest-uj) 301-gyel a meglevo oldalra iranyit, ezert nem hasznalhato: az uj oldal sajat cime nincs a 301-tablaban', async () => {
    const { utvonal } = await import(pathToFileURL(path.join(GYOKER, 'netlify/lib/utvonal.js')).href);
    assert.deepEqual(utvonal('/noi-hajfestes-budapest-uj', 'Mozilla/5.0'), { atiranyit: '/noi-hajfestes-budapest' });
    const r = utvonal(UT, 'Mozilla/5.0');
    assert.ok(!r || !r.atiranyit, 'az uj cim nincs atiranyitva');
  });
  test('a meresi kodok: a suti.js pixel-listajan az uj cim NEM szerepel (a Meta-pixel csak az eles cimeken fut); a suti.js nem valtozott', () => {
    const s = olvas('assets/js/suti.js');
    const sor = s.split('\n').find((x) => x.includes('PIXEL_FODRASZ,') && x.includes('fodraszat-foglalas'));
    assert.ok(sor && !sor.includes(NEV));
  });
});

describe('fej: meta, H1, jelolok', () => {
  test('a title <= 60, a description <= 155 karakter, pontosan egy H1 (a brief szerinti)', () => {
    const h = forras();
    const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1], leiras = (h.match(/<meta name="description" content="([^"]*)">/) || [])[1];
    assert.ok(title && title.length <= 60, `title ${title.length}: ${title}`);
    assert.ok(leiras && leiras.length <= 155, `description ${leiras.length}: ${leiras}`);
    assert.equal(title, 'Hajfestés, tőfestés Budán | Evelin – MOSAIC Hair');
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1);
    assert.equal(szoveg((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]).trim(), 'Hajfestés, tőfestés és őszfedés Evelinnél – Budán');
    assert.ok(h.includes('og:title') && h.includes(title) && h.includes(leiras));
  });
  test('a fejlec / lablec / nyitvatartas jelolok megvannak: az uzletag foglaloja (business=hair), csak hetkoznapi nyitvatartas', () => {
    const h = forras();
    for (const j of ['<!--mh-fejlec-->', '<!--mh-lablec-->', '<!--mh-menu-aktiv:/noi-hajfestes-budapest-->', '<!--mh-foglalas:business=hair-->', '<!--mh-nyitvatartas:hetkoznap-->']) assert.ok(h.includes(j), j);
  });
});

describe('tartalom: nincs [MEGERŐSÍTENDŐ], lejárt, ellentmondó vagy kitalált állítás', () => {
  test('tiltott tartalom nincs: [MEGERŐSÍTENDŐ], hajhosszabbítás / póthaj, tapasztalati évek (4 / 18 év), szombat / vasárnap, lejárt akció, régi foglaló-útvonalak', () => {
    const h = forras(), t = szoveg(torzs(h));
    assert.ok(!/MEGERŐSÍTENDŐ|megerősítendő/i.test(h));
    assert.ok(!/hajhosszabb|póthaj|Póthaj|tincs/i.test(h), 'hajhosszabbítás (2. fázis, megerősítésre vár)');
    assert.ok(!/(?:\d+|több mint \d+|közel \d+|\d+ éves?)\s*év(?:e|es)?\s*(?:tapasztalat|szakmai)|tapasztalat(?:tal|ot)?[^.]{0,30}\d+\s*év|\b(?:18|4)\s*év\b/i.test(t), 'tapasztalati évek: ' + (t.match(/.{30}\b(?:18|4)\s*év.{20}/) || [''])[0]);
    assert.ok(!/szombat|vasárnap/i.test(h.replace(/<script[\s\S]*?<\/script>/g, '')), 'szombati / vasárnapi nyitvatartás');
    assert.ok(!/május|májusi|szeptember|szeptemberi|nyár|nyári|akció|kedvezmény/i.test(t), 'lejárt / szezonális akció: ' + (t.match(/.{30}(május|szeptemb|nyár|akció|kedvezmény).{20}/i) || [''])[0]);
    assert.ok(!/idpontfoglalas|mosaic-hair-idopontfoglalas/.test(h), 'régi foglaló-útvonal');
    assert.ok(!/<a\s[^>]*href="#/.test(h), '#horgony-link (GTM History Change)');
  });
  test('minden "NN NNN Ft" ar az oldalon Evelin Salonic-szolgaltatasainak aranak egyike (kitalalt szam nincs); a 3 fo "-tol" ar a Salonic legolcsobb aranak felel meg', () => {
    const t = szoveg(torzs(forras()));
    const vart = new Set(evelinSzolg.map((s) => ftSzoveg(s.ar)));
    const talalt = [...t.matchAll(/(\d{1,3}(?: \d{3})+ Ft)/g)].map((m) => m[1]);
    assert.ok(talalt.length >= 20, 'sok ar szerepel');
    for (const a of talalt) assert.ok(vart.has(a), `ismeretlen ar: ${a}`);
    assert.ok(t.includes(`${ftSzoveg(tol('Elrontott festés korrekció / Teljes festés'))}-tól`), 'hajfestes');
    assert.ok(t.includes(`${ftSzoveg(tol('Tőfestés + szárítás'))}-tól`), 'tofestes');
    assert.ok(t.includes(`${ftSzoveg(tol('Balayage'))}-tól`), 'balayage');
    assert.equal(tol('Elrontott festés korrekció / Teljes festés'), 32950); assert.equal(tol('Tőfestés + szárítás'), 23950); // a brief szerinti hero-arak
    assert.equal(tol('Balayage'), 42950); assert.equal(tol('Teljes melír / airtouch + vágás'), 39950); // a balayage "-tól" ara 42 950 (a 39 950 a melir / szokites rovid hajra)
    assert.ok(!/Balayage[^.]{0,60}39 950/.test(t.replace(/Teljes melír \/ airtouch: 39 950/g, '')), 'a balayage nem 39 950-tol');
  });
  test('az arlista csak Evelin szolgaltatasait mutatja (a Salonic-hozzarendeles szerint), hajhossz-oszlopokkal; a hajvagas / szaritas / Joico is a sajat soraival', () => {
    const lista = adat.arlista('evelin');
    const t = szoveg(torzs(forras()));
    for (const cs of lista) for (const r of cs.sorok) for (const [hk, c] of Object.entries(r.cellak)) if (c) assert.ok(t.includes(ftSzoveg(c.ar)), `${r.cim} ${hk}`);
    for (const hossz of ['Rövid haj', 'Közepes haj', 'Hosszú haj', 'Extra hosszú haj']) assert.ok(forras().includes(hossz), hossz);
  });
  test('ertekeles: "4,9 – 1 266 Google-ertekeles" a hero-ban BELSO gorgeto gomb a Google-velemenyek blokkra (nem link, nem visz ki az oldalrol); a build a google-szam.js-sel az aktualis darabszamra cseréli', () => {
    const h = forras();
    assert.match(h, /<p class="ert-sor">[\s\S]*?<button type="button" class="link-gomb" data-gorget="velemenyek"[^>]*>4,9 – 1 266 Google-értékelés<\/button><\/p>/);
    const buildSzoveg = olvas('tools/netlify-build.mjs');
    assert.match('4,9 – 1 266 Google-értékelés', new RegExp(buildSzoveg.match(/const GV_MINTA = (\/.*\/i);/)[1].slice(1, -2), 'i'), 'a build felrakja a google-szam.js-t');
  });
  test('Evelin hely + "Terkep" a hero-ban (belso gorgetes a helyszin / terkep blokkra), a hely szekcio csak a hetkoznapi nyitvatartast irja; a "Miert Evelin" kartyak a mostani oldalrol valok', () => {
    const h = forras(), hero = (h.match(/<section class="hero[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(hero.includes('1023 Budapest, Bécsi út 2. · a Kolosy tér és a Zsigmond tér között'));
    assert.match(hero, /<button type="button" class="link-gomb" data-gorget="hely"[^>]*>Térkép<\/button>/);
    const hely = (h.match(/<section[^>]*id="hely"[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(hely.includes('Hétfő–péntek: 8:00–20:00') && !/zárva|Szombat/.test(hely));
    assert.ok(szoveg(h).includes('Vendégeim 90%-a évek óta visszajár hozzám, mert tudják, mire számíthatnak.'));
    const regi = olvas('tools/content/noi-hajfestes-budapest.json');
    assert.ok(regi.includes('Vend&eacute;geim 90%-a &eacute;vek &oacute;ta visszaj&aacute;r hozz&aacute;m, mert tudj&aacute;k, mire sz&aacute;m&iacute;thatnak'), 'szo szerint a mostani (Wixes) oldalrol');
  });
});

describe('Feri visszajelzese (2026-10-20): belso horgonyok, nincs kifele vivo Google-ertekeles / terkep link', () => {
  const KIFELE = /maps\.app\.goo\.gl|google\.com\/maps|goo\.gl|g\.page|search\.google\.com|google\.com\/search|maps\.google/i;
  test('az oldalon (a torzsben, a fejlecen / lablecen kivul is) egyetlen kifele vivo Google-link van: a terkep-blokk "Utvonaltervezes" gombja (navigalas); ertekeles / terkep link a hero-ban, a velemenyeknel NINCS', () => {
    const h = forras();
    const linkek = [...h.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>/g)].filter((m) => KIFELE.test(m[1].replace(/&amp;/g, '&')));
    assert.equal(linkek.length, 1, 'kifele vivo Google-linkek: ' + linkek.map((m) => m[0]).join(' | '));
    assert.match(linkek[0][0], /data-cta="utvonal"/);
    assert.ok(/id="hely"[\s\S]*data-cta="utvonal"/.test(h), 'az "Utvonaltervezes" a helyszin / terkep blokkban van');
    const hero = (h.match(/<section class="hero[\s\S]*?<\/section>/) || [''])[0], vel = (h.match(/<section[^>]*id="velemenyek"[\s\S]*?<\/section>/) || [''])[0];
    assert.ok(!KIFELE.test(hero) && !/target="_blank"/.test(hero), 'hero');
    assert.ok(!KIFELE.test(vel) && !/target="_blank"/.test(vel) && !/<a\s/.test(vel), 'velemenyek');
    assert.ok(!/<a\s[^>]*href="#/.test(h), 'nincs #horgony-link (GTM History Change): a gorgetes gomb + JS');
  });
  test('minden [data-gorget] gomb cele letezik: a hely / terkep blokk (#hely > #terkep) es a Google-velemenyek blokk (#velemenyek > #ti-doboz, Trustindex-beagyazas); a JS-fajl be van kotve', () => {
    const h = forras();
    const celok = [...h.matchAll(/data-gorget="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(celok)].sort(), ['hely', 'velemenyek']);
    for (const c of celok) assert.ok(new RegExp(`<section[^>]*id="${c}"`).test(h), 'nincs cel: #' + c);
    assert.ok(/id="hely"[\s\S]*id="terkep"/.test(h) && /id="velemenyek"[\s\S]*id="ti-doboz"[^>]*data-forras="\/assets\/embed\//.test(h));
    assert.ok(h.includes('<script src="/assets/js/hair-evelin-uj.js" defer></script>'));
    const js = olvas('assets/js/hair-evelin-uj.js').replace(/^\s*\/\/.*$/gm, ''); // a megjegyzesek nelkul
    assert.ok(!/dataLayer|fetch\(|XMLHttpRequest|gtag|fbq/.test(js), 'a gorgeto JS nem mero-kod, nincs halozati kerese');
  });
  test('tofestes: a kartya egy lapozhato galeria (>= 3 kep, mind lusta betoltesu, meretezett, alt-tal), nyilakkal, potty-jelzovel, aria-cimkevel; a tobbi kartya egykepes; a kepek a repoban megvannak', () => {
    const h = forras();
    const gal = (h.match(/<figure class="szolg-galeria hero-galeria" data-hero-galeria="tofestes">[\s\S]*?<\/figure>/) || [''])[0];
    assert.ok(gal, 'nincs tofestes-galeria');
    const kepek = [...gal.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
    assert.ok(kepek.length >= 3, 'kepek: ' + kepek.length);
    for (const k of kepek) {
      assert.match(k, /loading="lazy"/); assert.match(k, /decoding="async"/); assert.match(k, /width="\d+" height="\d+"/); assert.match(k, /alt="[^"]{12,}"/);
      assert.ok(!/fetchpriority/.test(k), 'a hajtas alatti galeria nem kap fetchpriority=high-t');
      assert.ok(fs.existsSync(path.join(GYOKER, k.match(/src="([^"]+)"/)[1])), 'hianyzo kep: ' + k);
    }
    assert.equal(new Set(kepek.map((k) => k.match(/src="([^"]+)"/)[1])).size, kepek.length, 'minden kep kulonbozo');
    assert.equal((gal.match(/<span( class="aktiv")?><\/span>/g) || []).length, kepek.length, 'egy potty kepenkent');
    assert.match(gal, /class="hg-nyil hg-elozo" aria-label="Előző kép"/); assert.match(gal, /class="hg-nyil hg-kovetkezo" aria-label="Következő kép"/);
    assert.match(gal, /<ul class="hg-sav" tabindex="0" aria-label="[^"]*lapozható képgaléria[^"]*">/);
    const kartya = (h.match(/<article class="szolg-kartya szolg-galeria-kartya">[\s\S]*?<\/article>/) || [''])[0];
    assert.ok(kartya.includes('<h3>Tőfestés</h3>') && kartya.includes(gal), 'a galeria a Tofestes kartyaban van');
    assert.equal((h.match(/class="szolg-kartya/g) || []).length, 3); assert.equal((h.match(/data-hero-galeria="/g) || []).length, 2, 'tofestes + hely galeria');
    assert.ok(/<link rel="preload"[^>]*as="image"[^>]*fetchpriority="high"/.test(h) && !h.includes('rel="preload" href="/assets/img/c2eb0f_f138'), 'csak a hero-kep preload-os');
  });
});

describe('foglalo-linkek: csak /foglalo-motor, a brief szerinti parameterekkel', () => {
  const K = '/foglalo-motor?business=hair&staff=evelin&service=konzultacio', C = '/foglalo-motor?business=hair&staff=evelin&category=color', E = '/foglalo-motor?business=hair&staff=evelin';
  test('minden foglalo-link az uzletag / Evelin foglaloja; a 3 brief-link pontosan: konzultacio, festes-tofestes (color), Evelin osszes idopontja', () => {
    const h = torzs(forras());
    const mind = hrefek(h).filter((x) => /foglalo|foglal/i.test(x));
    for (const x of mind) assert.ok(/^\/foglalo-motor\?business=hair&staff=evelin(&(service=konzultacio|category=(color|balayage|cut|ujraepites)))?$/.test(x), 'ismeretlen foglalo-link: ' + x);
    const db = (u) => mind.filter((x) => x === u).length;
    assert.ok(db(K) >= 3 && db(C) >= 2 && db(E) >= 2, `K=${db(K)} C=${db(C)} E=${db(E)}`);
    // a fo CTA (hero) szovege + cel
    assert.match(h, new RegExp(`href="${K.replace(/[?&=.]/g, '\\$&').replace(/&/g, '&(?:amp;)?')}"[^>]*>30 perces ingyenes konzultáció Evelinnel`));
    assert.match(h, /href="\/foglalo-motor\?business=hair&staff=evelin&category=color"[^>]*>Festés és tőfestés időpontok/);
    assert.match(h, /href="\/foglalo-motor\?business=hair&staff=evelin"[^>]*>Evelin összes időpontja/);
    // a staff=evelin foglalo-parameterek ismertek: a foglalo munkatars-linkje + kategoria
    const munkatars = olvas('docs/booking-engine/MUNKATARS_LINKEK.md');
    assert.match(munkatars, /staff=evelin/);
  });
  test('a hair-landing.js "legkozelebbi szabad konzultacio" sora Evelin SAJAT konzultacios linkje (service=konzultacio + start=)', () => {
    assert.match(forras(), /<p class="kovetkezo " data-kovetkezo="evelin" hidden>[\s\S]*?href="\/foglalo-motor\?business=hair&(?:amp;)?staff=evelin&(?:amp;)?service=konzultacio" data-cta="kovetkezo-idopont" data-ido-link>/);
  });
  test('a mobil ragados CTA-sav a fo konverzioval (ingyenes konzultacio) + Evelin idopontjai', () => {
    const s = (forras().match(/<div class="sticky-cta"[\s\S]*?<\/div>/) || [''])[0];
    assert.match(s, /href="\/foglalo-motor\?business=hair&staff=evelin&service=konzultacio"[^>]*data-konzult="1"[^>]*>Ingyenes konzultáció/);
    assert.match(s, /href="\/foglalo-motor\?business=hair&staff=evelin"[^>]*>Evelin időpontjai<\/a>/); // egy soros felirat (nincs <br>)
  });
});

// ======================= bongeszos ellenorzesek =======================
let szerver, bazis, b;
const TI = '<div class="ti-header"><div class="ti-rating">Kiváló</div><div class="ti-stars"><span class="ti-star f"></span><span class="ti-star f"></span><span class="ti-star f"></span><span class="ti-star f"></span><span class="ti-star h"></span></div><div class="ti-rating-text"><a>1289</a></div></div>';

async function ujOldal({ szel = 1280, mobil = false, mozgasCsokkentve = false } = {}) {
  const ctx = await b.newContext({ viewport: { width: szel, height: mobil ? 844 : 900 }, isMobile: mobil, hasTouch: mobil, userAgent: mobil ? UA_MOBIL : undefined, reducedMotion: mozgasCsokkentve ? 'reduce' : 'no-preference' });
  const kulso = [];
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(bazis)) return route.continue();
    kulso.push(u);
    const cors = { 'access-control-allow-origin': '*' };
    if (u.includes('cdn.trustindex.io/widgets')) return route.fulfill({ contentType: 'text/html', body: TI, headers: cors });
    if (u.includes('api.salonic.hu/calendar/getAvailableTimes')) return route.fulfill({ contentType: 'application/json', headers: cors, body: hamisSzabadIdo() });
    return route.abort();
  });
  const p = await ctx.newPage();
  const hibak = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.url().startsWith(bazis) && r.status() >= 400) hibak.push(`${r.status()} ${r.url()}`); });
  await p.goto(bazis + UT, { waitUntil: 'load' });
  await p.evaluate(() => { try { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: false, ana: false, adv: false })); } catch (e) { /* nem baj */ } });
  return { p, ctx, hibak, kulso };
}

describe('bongeszoben', { concurrency: false }, () => {
  before(async () => {
    ({ szerver, bazis } = await szerverInditas());
    b = await playwright().chromium.launch({ executablePath: CHROME, headless: true });
  });
  after(async () => { await b.close(); szerver.close(); });

  for (const [nev, opt] of [['asztali 1440', { szel: 1440 }], ['tablet 768', { szel: 768, mobil: true }], ['mobil 412', { szel: 412, mobil: true }], ['mobil 390', { szel: 390, mobil: true }], ['mobil 360', { szel: 360, mobil: true }]]) {
    test(`${nev}: hibatlanul betolt (nincs konzol-hiba, 404, torott kep), nincs vizszintes gorgetes, egy H1, nem vart kulso keres nincs`, async () => {
      const { p, ctx, hibak, kulso } = await ujOldal(opt);
      await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
      await p.waitForTimeout(700);
      assert.deepEqual(hibak, []);
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h1: document.querySelectorAll('h1').length, torott: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src).map((i) => i.src) }));
      assert.ok(m.sw <= m.cw, `vizszintes gorgetes: ${m.sw} > ${m.cw}`);
      assert.equal(m.h1, 1);
      assert.deepEqual(m.torott, []);
      assert.deepEqual(kulso.filter((u) => !/trustindex\.io|api\.salonic\.hu|mosaic-hair\.salonic\.hu|google\.com\/maps/.test(u)), []);
      await ctx.close();
    });
  }

  test('mobil (390x844 es 360x740): a hos-reszben az elso kepernyon latszik: H1, 1 mondatos igeret, ar, fo CTA gomb; asztalon is', async () => {
    for (const [szel, mag] of [[390, 844], [360, 740]]) {
      const ctx = await b.newContext({ viewport: { width: szel, height: mag }, isMobile: true, hasTouch: true, userAgent: UA_MOBIL });
      await ctx.route('**/*', (r) => (r.request().url().startsWith(bazis) ? r.continue() : r.abort()));
      const p = await ctx.newPage();
      await p.goto(bazis + UT, { waitUntil: 'load' });
      const r = await p.evaluate(() => {
        const al = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, left: x.left, right: x.right }; };
        return { h1: al('main h1'), lead: al('.hero .lead'), ar: al('.hero .ar-sav'), cta: al('.hero .cta-sor .gomb-arany'), ctaSzoveg: (document.querySelector('.hero .cta-sor .gomb-arany') || {}).textContent, hely: al('.hero .hely-sor'), viewH: innerHeight };
      });
      for (const k of ['h1', 'lead', 'ar', 'cta']) { assert.ok(r[k], `${szel}: nincs ${k}`); assert.ok(r[k].top >= 0 && r[k].bottom <= r.viewH, `${szel}x${mag}: ${k} nem fér az első képernyőre (${Math.round(r[k].bottom)} > ${r.viewH})`); }
      assert.match(r.ctaSzoveg, /30 perces ingyenes konzultáció Evelinnel/);
      await ctx.close();
    }
    const { p, ctx } = await ujOldal({ szel: 1440 });
    const r = await p.evaluate(() => { const al = (s) => document.querySelector(s).getBoundingClientRect().bottom; return { cta: al('.hero .cta-sor .gomb-arany'), ar: al('.hero .ar-sav'), h1: al('main h1'), viewH: innerHeight }; });
    assert.ok(r.cta <= r.viewH && r.ar <= r.viewH && r.h1 <= r.viewH, 'asztalon is az elso kepernyon');
    await ctx.close();
  });

  test('mobilon a ragados CTA-sav a hero gombjai utan jelenik meg, a foglalas / hely szekcional eltunik, asztalon nem latszik; a gombok linkjei pontosak', async () => {
    const { p, ctx } = await ujOldal({ szel: 390, mobil: true });
    const lathato = () => p.evaluate(() => { const s = document.getElementById('sticky-cta'); const cs = getComputedStyle(s); return s.classList.contains('lathato') && cs.display !== 'none'; });
    assert.equal(await lathato(), false, 'tetejen nem latszik');
    await p.evaluate(() => window.scrollTo(0, document.querySelector('#szolgaltatasok').offsetTop + 200));
    await p.waitForTimeout(300);
    assert.equal(await lathato(), true, 'a hero gombjai utan latszik');
    const hrefek2 = await p.evaluate(() => [...document.querySelectorAll('#sticky-cta a')].map((a) => [a.getAttribute('href'), a.innerText.trim().replace(/\s+/g, ' ')]));
    assert.deepEqual(hrefek2, [['/foglalo-motor?business=hair&staff=evelin&service=konzultacio', 'Ingyenes konzultáció →'], ['/foglalo-motor?business=hair&staff=evelin', 'Evelin időpontjai']]);
    await p.evaluate(() => document.getElementById('foglalas').scrollIntoView());
    await p.waitForTimeout(300);
    assert.equal(await lathato(), false, 'a foglalas szekcional eltunik');
    await ctx.close();
    const d = await ujOldal({ szel: 1440 });
    assert.equal(await d.p.evaluate(() => getComputedStyle(document.getElementById('sticky-cta')).display), 'none', 'asztalon nincs sticky');
    await d.ctx.close();
  });

  test('fejlec (FOGLALAS gomb, asztali + mobil menu), Info-ablak es lablec: az uzletag (business=hair) foglaloja; nincs regi /idpontfoglalas link; a lablec / Info-ablak nyitvatartasa csak hetkoznap', async () => {
    for (const opt of [{ szel: 1440 }, { szel: 390, mobil: true }]) {
      const { p, ctx } = await ujOldal(opt);
      const r = await p.evaluate(() => {
        const mind = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
        const lablec = (document.getElementById('SITE_FOOTER') || {}).textContent || '';
        const popup = (document.querySelector('template#mh-popup-rk7x7') || { innerHTML: '' }).innerHTML;
        return { idp: mind.filter((x) => /idpontfoglalas/.test(x)), headspaFoglalo: mind.filter((x) => x === '/foglalo-motor?business=hair'), lablecGomb: (document.querySelector('#SITE_FOOTER .mhl-gomb') || {}).getAttribute && document.querySelector('#SITE_FOOTER .mhl-gomb').getAttribute('href'),
          lablecOra: lablec.replace(/\s+/g, ' '), popupOra: popup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '), popupGomb: (popup.match(/class="mhp-gomb mhp-arany" href="([^"]*)"/) || [])[1] };
      });
      assert.deepEqual(r.idp, [], 'regi /idpontfoglalas link');
      assert.ok(r.headspaFoglalo.length >= 2, 'a fejlec FOGLALAS gombja + a lablec gomb: ' + r.headspaFoglalo.length);
      assert.equal(r.lablecGomb, '/foglalo-motor?business=hair');
      assert.equal(r.popupGomb, '/foglalo-motor?business=hair');
      assert.ok(/Hétfő – Péntek: 8:00 – 20:00/.test(r.lablecOra) && !/Szombat|Vasárnap|ZÁRVA/i.test(r.lablecOra), 'lablec: ' + r.lablecOra.slice(0, 400));
      assert.ok(/Hétfő – Péntek:\s*8:00 – 20:00/.test(r.popupOra) && !/Szombat|Vasárnap/i.test(r.popupOra), 'Info-ablak: ' + r.popupOra.slice(0, 300));
      await ctx.close();
    }
  });

  test('mukodes: arlista-fulek (a Hajfestes ful a sajat panelt mutatja), galeria-nagyito, GYIK nyit, a konzultacios video indithato elem', async () => {
    const { p, ctx, hibak } = await ujOldal({ szel: 1440 });
    await p.click('#arful-festes');
    assert.equal(await p.getAttribute('#arcsop-festes', 'hidden'), null);
    assert.notEqual(await p.getAttribute('#arcsop-balayage', 'hidden'), null);
    await p.click('#galeria-racs li:not([hidden]) .kep-gomb');
    assert.equal(await p.evaluate(() => document.getElementById('lb').open), true);
    await p.keyboard.press('Escape');
    await p.click('#gyik details:first-child summary');
    assert.equal(await p.evaluate(() => document.querySelector('#gyik details').open), true);
    assert.equal(await p.evaluate(() => document.querySelectorAll('main video').length), 1);
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('a "legkozelebbi szabad konzultacio" sor kitoltodik a Salonic naptarbol (Evelin sajat konzultacios linkje + start=), nincs adat: rejtve', async () => {
    const { p, ctx } = await ujOldal({ szel: 1440 });
    await p.waitForSelector('.hero [data-kovetkezo="evelin"]:not([hidden])', { timeout: 5000 });
    const href = await p.getAttribute('.hero [data-kovetkezo="evelin"] a', 'href');
    assert.match(href, /^\/foglalo-motor\?business=hair&staff=evelin&service=konzultacio&start=\d{10}$/);
    await ctx.close();
  });

  test('dataLayer: landing_view az uj landing-azonositoval, a konzultacios gomb consultation_cta_click esemenyt kuld (staff=evelin)', async () => {
    const { p, ctx } = await ujOldal({ szel: 1440 });
    await p.evaluate(() => { window.__e = []; (window.dataLayer = window.dataLayer || []).push = function (...a) { window.__e.push(...a); return Array.prototype.push.apply(this, a); }; document.addEventListener('click', (e) => { if (e.target.closest('a[href*="foglalo-motor"]')) e.preventDefault(); }, true); });
    await p.click('.hero .cta-sor .gomb-arany');
    const e = await p.evaluate(() => window.__e);
    const k = e.find((x) => x.event === 'consultation_cta_click');
    assert.ok(k && k.staff === 'evelin' && k.cta_position === 'hero', JSON.stringify(e));
    assert.equal(await p.evaluate(() => (window.dataLayer.find((x) => x.event === 'landing_view') || {}).landing_id), 'hair-evelin-ads');
    await ctx.close();
  });

  test('mobil hos (360 / 390 / 412 px): a sorrend CIM -> KEP -> alcim -> ar -> gombok -> hely -> ertekeles; a kep kozvetlenul a H1 utan jon, az asztali elrendezes (szoveg bal, kep jobb) nem valtozik', async () => {
    for (const szel of [360, 390, 412]) {
      const { p, ctx } = await ujOldal({ szel, mobil: true });
      const r = await p.evaluate(() => {
        const al = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, left: x.left, right: x.right }; };
        return { h1: al('.hero h1'), kep: al('.hero .hero-kep'), lead: al('.hero .lead'), ar: al('.hero .ar-sav'), cta: al('.hero .cta-sor'), hely: al('.hero .hely-sor'), ert: al('.hero .ert-sor'), kepTag: !!document.querySelector('.hero .hero-kep img') };
      });
      assert.ok(r.kepTag, 'van hero-kep');
      const sor = ['h1', 'kep', 'lead', 'ar', 'cta', 'hely', 'ert'];
      for (let i = 1; i < sor.length; i++) assert.ok(r[sor[i - 1]].bottom <= r[sor[i]].top + 1, `${szel}: ${sor[i - 1]} -> ${sor[i]} sorrend (${Math.round(r[sor[i - 1]].bottom)} > ${Math.round(r[sor[i]].top)})`);
      assert.ok(r.kep.top - r.h1.bottom <= 24, `${szel}: a kep kozvetlenul a H1 utan jon (${Math.round(r.kep.top - r.h1.bottom)} px res)`);
      await ctx.close();
    }
    const d = await ujOldal({ szel: 1440 });
    const r = await d.p.evaluate(() => { const a = (s) => document.querySelector(s).getBoundingClientRect(); return { h1: a('.hero h1'), kep: a('.hero .hero-kep'), cta: a('.hero .cta-sor') }; });
    assert.ok(r.kep.left >= r.h1.right - 1 && r.kep.left > 640, 'asztalon a kep a szoveg mellett, jobbra');
    assert.ok(r.cta.top > r.h1.bottom && Math.abs(r.kep.top - r.h1.top) < 80, 'asztalon a kep a szoveg-oszlop tetejehez igazodik');
    await d.ctx.close();
  });

  test('tofestes-galeria (390 px, erintes): ujjal huzva lapoz (a gorgetes es az aktiv potty valtozik), a keparany fix (nincs elmozdulas), nincs vizszintes gorgetes; a tobbi kartya valtozatlan', async () => {
    const { p, ctx, hibak } = await ujOldal({ szel: 390, mobil: true });
    await p.evaluate(() => document.querySelector('.szolg-galeria').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(400);
    const allapot = () => p.evaluate(() => { const s = document.querySelector('.szolg-galeria .hg-sav'); return { left: Math.round(s.scrollLeft), w: s.clientWidth, db: s.children.length, aktiv: [...document.querySelectorAll('.szolg-galeria .hg-pontok span')].findIndex((x) => x.classList.contains('aktiv')) }; });
    const a0 = await allapot();
    assert.deepEqual([a0.left, a0.aktiv], [0, 0]); assert.ok(a0.db >= 3);
    const dobozElotte = await p.evaluate(() => { const r = document.querySelector('.szolg-galeria').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
    const box = await p.locator('.szolg-galeria .hg-sav').boundingBox();
    const cdp = await ctx.newCDPSession(p);
    const huzas = async (dx) => { // valodi erintes-esemenyek (CDP): a bongeszo sajat gorgetese + scroll-snap
      const x0 = box.x + box.width * (dx < 0 ? 0.8 : 0.2), y0 = box.y + box.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx / 10) * i, y: y0 }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await p.waitForTimeout(800);
    };
    await huzas(-200);
    const a1 = await allapot();
    assert.ok(a1.left >= a1.w - 2 && a1.aktiv === 1, 'balra huzas: a 2. kep, aktiv potty 2: ' + JSON.stringify(a1));
    await huzas(-200);
    assert.equal((await allapot()).aktiv, 2, 'a 3. kep');
    await huzas(200);
    assert.equal((await allapot()).aktiv, 1, 'jobbra huzas: vissza a 2. kepre');
    assert.deepEqual(await p.evaluate(() => { const r = document.querySelector('.szolg-galeria').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }), dobozElotte, 'a galeria merete lapozaskor nem valtozik');
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, kartyak: [...document.querySelectorAll('#szolgaltatasok .szolg-kartya')].map((k) => [k.querySelector('h3').textContent, k.querySelectorAll('.szolg-kep img').length]) }));
    assert.ok(m.sw <= m.cw, 'vizszintes gorgetes');
    assert.deepEqual(m.kartyak.map((x) => x[1] > 1), [false, true, false], 'csak a Tofestes kartyaja galeria: ' + JSON.stringify(m.kartyak));
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('tofestes-galeria (asztali): a kovetkezo / elozo nyil lapoz (korbe), a bal / jobb nyil billentyu is, a potty es a gorgetes kovetik; a nyilak a kepen belul vannak', async () => {
    const { p, ctx, hibak } = await ujOldal({ szel: 1280 });
    await p.locator('.szolg-galeria').scrollIntoViewIfNeeded();
    const allapot = () => p.evaluate(() => { const s = document.querySelector('.szolg-galeria .hg-sav'); return { left: Math.round(s.scrollLeft), w: s.clientWidth, aktiv: [...document.querySelectorAll('.szolg-galeria .hg-pontok span')].findIndex((x) => x.classList.contains('aktiv')) }; });
    const nyilak = await p.evaluate(() => { const g = document.querySelector('.szolg-galeria').getBoundingClientRect(); return [...document.querySelectorAll('.szolg-galeria .hg-nyil')].map((n) => { const r = n.getBoundingClientRect(); return n.offsetParent !== null && r.left >= g.left && r.right <= g.right && r.top >= g.top && r.bottom <= g.bottom; }); });
    assert.deepEqual(nyilak, [true, true], 'asztalon latszanak a nyilak');
    await p.click('.szolg-galeria .hg-kovetkezo'); await p.waitForTimeout(700);
    let a = await allapot(); assert.ok(a.aktiv === 1 && a.left >= a.w - 2, 'kovetkezo nyil: ' + JSON.stringify(a));
    await p.focus('.szolg-galeria .hg-sav'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(700);
    assert.equal((await allapot()).aktiv, 2, 'jobb nyil billentyu');
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(700);
    assert.equal((await allapot()).aktiv, 1, 'bal nyil billentyu');
    await p.click('.szolg-galeria .hg-elozo'); await p.waitForTimeout(700);
    await p.click('.szolg-galeria .hg-elozo'); await p.waitForTimeout(900);
    a = await allapot(); assert.equal(a.aktiv, await p.evaluate(() => document.querySelectorAll('.szolg-galeria .hg-pontok span').length - 1), 'az elso kepnel az elozo nyil korbe ugrik az utolsora');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('belso horgonyok: a hero "Terkep" gombja a helyszin / terkep blokkra, az ertekeles-sor a Google-velemenyek blokkra gorget; nincs navigacio, nincs uj lap, az URL nem valtozik (nincs #hash); a fokusz a cel fejlecere kerul', async () => {
    for (const opt of [{ szel: 390, mobil: true }, { szel: 1440 }]) {
      const { p, ctx } = await ujOldal({ ...opt, mozgasCsokkentve: true });
      const url0 = p.url(); let ujLap = 0; ctx.on('page', () => { ujLap++; });
      for (const [gomb, cel] of [['.hero .hely-sor .link-gomb', '#hely'], ['.hero .ert-sor .link-gomb', '#velemenyek']]) {
        await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(150);
        await p.click(gomb); await p.waitForTimeout(500);
        const r = await p.evaluate((c) => { const e = document.querySelector(c), x = e.getBoundingClientRect(); return { top: Math.round(x.top), scrollY: Math.round(scrollY), fokusz: document.activeElement && document.activeElement.closest(c) ? document.activeElement.tagName : null }; }, cel);
        assert.ok(r.scrollY > 300, `${cel}: leggorgetett (${r.scrollY})`);
        assert.ok(r.top >= -2 && r.top <= 90, `${cel}: a blokk teteje a fejlec alatt van (${r.top})`);
        assert.equal(r.fokusz, 'H2', `${cel}: a fokusz a blokk fejlecen`);
        assert.equal(p.url(), url0, 'az URL nem valtozik');
      }
      assert.equal(ujLap, 0, 'nem nyilt uj lap');
      await ctx.close();
    }
  });

  test('megtort sorok (a tulajdonos alapszabalya): mobilon (360 / 390 / 412 px) a cimekben, gombfeliratokban, jelvenyekben, kartyacimekben, rovid listaelemekben nincs "arva" sor (egy-ket szo az utolso sorban, keskeny sorral); a gombfeliratok egy sorba fernek', async () => {
    for (const szel of SZELESSEGEK) {
      const { p, ctx } = await ujOldal({ szel, mobil: true });
      const r = await oldalMeres(p);
      assert.ok(r.rovid.vizsgalt > 300, 'vizsgalt elemek: ' + r.rovid.vizsgalt);
      const arva = r.rovid.talalat.filter((t) => t.arva);
      assert.deepEqual(arva.map((t) => `${t.sorok} sor, utolso: "${t.utolso}" <- ${t.elem}`), [], `${szel} px: arva sorok`);
      await ctx.close();
    }
  });

  test('keskeny telefonon (360 px) a ragados CTA-sav gombjai egy sorban es a savon belul vannak (nincs tulcsordulas), a hero gombok sem logna ki', async () => {
    const { p, ctx } = await ujOldal({ szel: 360, mobil: true });
    await p.evaluate(() => window.scrollTo(0, document.querySelector('#szolgaltatasok').offsetTop + 200)); await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const s = document.getElementById('sticky-cta').getBoundingClientRect();
      return { lathato: document.getElementById('sticky-cta').classList.contains('lathato'), sav: [s.left, s.right], gombok: [...document.querySelectorAll('#sticky-cta a, .hero .cta-sor .gomb')].map((a) => { const x = a.getBoundingClientRect(); return { t: a.textContent.trim().replace(/\s+/g, ' '), be: x.left >= -0.5 && x.right <= innerWidth + 0.5, tul: a.scrollWidth > a.clientWidth + 1, sor: Math.round(x.height) }; }) };
    });
    assert.ok(r.lathato);
    for (const g of r.gombok) { assert.ok(g.be && !g.tul, 'tulcsordul: ' + JSON.stringify(g)); }
    await ctx.close();
  });
});
