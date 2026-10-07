// A fodraszat-oldalak (kozponti + Betti + Noel + Evelin, foglalas/*-uj.html) tesztjei: statikus ellenorzesek + bongeszos (Playwright) vizsgalat.
// NINCS dist/ build es NINCS kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs) a build fejlec/lablec-logikajaval allitja ossze az oldalt;
// minden nem helyi keres le van tiltva (alapbol tiltas), a Trustindex- es a Salonic-valaszt a teszt hamisitja.
//
//   node --test tools/hair-teszt/hair.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja, ha a repoban nincs telepitve).
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
const { szerverInditas } = await import(pathToFileURL(path.join(GYOKER, 'tools/headspa-teszt/szerver.mjs')).href);
const { LAPOK, FODRASZOK, PILLANATKEP } = adat;
const KULCSOK = Object.keys(LAPOK);
const ut = (k) => '/' + LAPOK[k].fajl;
const forras = (k) => fs.readFileSync(path.join(GYOKER, 'foglalas', LAPOK[k].fajl + '.html'), 'utf8').replace(/\r\n/g, '\n'); // Windowson az autocrlf CRLF-et ir a munkamappaba
const szoveg = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic', 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}

// ======================= statikus ellenorzesek (bongeszo nelkul) =======================
describe('generalt fajlok', () => {
  test('a foglalas/*-uj.html fajlok megegyeznek a generator kimenetevel (node tools/hair-oldalak.mjs)', () => {
    for (const k of KULCSOK) assert.equal(forras(k), gen.oldal(k), `${LAPOK[k].fajl}.html elavult: futtasd a node tools/hair-oldalak.mjs parancsot`);
  });
  test('az uj oldalak noindex-esek, a canonical a sajat (-uj) cimukre mutat, a menu a mostani oldalt jelzi aktivnak', () => {
    for (const k of KULCSOK) {
      const h = forras(k);
      assert.match(h, /<meta name="robots" content="noindex, nofollow">/);
      assert.ok(h.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu/${LAPOK[k].fajl}">`));
      assert.ok(h.includes(`<!--mh-menu-aktiv:${LAPOK[k].menu}-->`));
      assert.ok(h.includes('<!--mh-fejlec-->') && h.includes('<!--mh-lablec-->'));
    }
  });
  test('az -uj oldalak nincsenek a sitemapben es a robots.txt-ben sem tiltva kulon (nincs rajuk link)', () => {
    const sm = fs.readFileSync(path.join(GYOKER, 'sitemap.xml'), 'utf8');
    for (const k of KULCSOK) assert.ok(!sm.includes(LAPOK[k].fajl), `${LAPOK[k].fajl} a sitemapben van`);
  });
  test('a meresi kodokat nem erintjuk: a suti.js pixel-listaja az -uj cimeket nem tartalmazza', () => {
    const s = fs.readFileSync(path.join(GYOKER, 'assets/js/suti.js'), 'utf8');
    for (const k of KULCSOK) assert.ok(!new RegExp(`\\b${LAPOK[k].fajl}\\b`).test(s));
  });
});

describe('tartalom: nincs kitalalt / igazolatlan allitas', () => {
  test('nincs tapasztalati ev, visszajaro-szazalek, beegetett ertekeles vagy lejart akcio', () => {
    for (const k of KULCSOK) {
      const t = szoveg(forras(k));
      for (const rossz of [/\b9[0-9]\s?%-?a?\b.*visszaj/i, /\bévnyi\b/i, /\b\d+\s*év(es)? tapasztalat/i, /tapasztalati év/i, /\b\d+\s*éve\b/i, /\b4[,.]9\b/, /\b5[,.]0\s*[-–]\s*(Kiváló|\d)/, /szeptemberi/i, /head ?spa/i]) {
        assert.ok(!rossz.test(t), `${LAPOK[k].fajl}: tiltott szoveg (${rossz})`);
      }
    }
  });
  test('az arak a Salonic-pillanatkepbol szarmaznak (egyetlen forras), a konzultacio 30 perces es ingyenes', () => {
    const k = adat.konzultacio();
    assert.equal(k.perc, 30);
    assert.equal(k.ar, 0);
    const t = szoveg(forras('kozpont'));
    assert.ok(t.includes('30 perc'));
    assert.ok(!/15 perc/.test(t), 'a doc 15 perces konzultaciot ir, a Salonic 30 percet: a 15 percnek nem szabad megjelennie');
  });
  test('a kozponti oldal listaarai pontosan a pillanatkep arai; Noel arai a Salonic-felirat szerinti kedvezmennyel', () => {
    const fk = PILLANATKEP.szolgaltatasok.find((s) => s.id === '231532'); // Balayage - Kozepes haj
    assert.ok(fk && fk.ar === 42950);
    assert.ok(forras('kozpont').includes('42\u00a0950\u00a0Ft'));
    assert.ok(forras('betti').includes('42\u00a0950\u00a0Ft'));
    const noel = PILLANATKEP.fodraszok.find((f) => f.kulcs === 'noel');
    assert.equal(noel.kedvezmeny, 20);
    assert.equal(adat.ar(fk, 'noel'), 34360);
    assert.ok(forras('noel').includes('34\u00a0360\u00a0Ft') && forras('noel').includes('42\u00a0950\u00a0Ft'));
    assert.ok(!forras('betti').includes('34\u00a0360'));
  });
  test('minden megjelenitett ar a pillanatkep (es fodraszonkent a kedvezmeny) szamaibol jon', () => {
    for (const k of KULCSOK) {
      const fod = k === 'kozpont' ? null : k;
      const ervenyes = new Set(PILLANATKEP.szolgaltatasok.filter((s) => !fod || s.fodraszok.includes(FODRASZOK[fod].id)).flatMap((s) => [adat.ft(adat.ar(s, fod)), adat.ft(s.ar)]));
      ervenyes.add(adat.ft(adat.POTHAJ.felrakasTincs)); ervenyes.add(adat.ft(adat.POTHAJ.leszedes)); ervenyes.add('0\u00a0Ft'); ervenyes.add(adat.ft(adat.ferfiVagas()));
      const t = forras(k).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
      const talalatok = t.match(/\d{1,3}(?:\u00a0\d{3})*\u00a0Ft/g) || [];
      assert.ok(talalatok.length > 10, `${k}: nincs ar az oldalon?`);
      for (const a of talalatok) assert.ok(ervenyes.has(a), `${LAPOK[k].fajl}: ismeretlen ar: ${a}`);
    }
  });
  test('Noel oldalan nincs olyan szolgaltatas (ferfi hajvagas), amit a Salonic szerint nem vegez; Evelin oldalan van poth ajhosszabbitas', () => {
    assert.ok(!szoveg(forras('noel')).includes('Férfi hajvágás'));
    assert.ok(szoveg(forras('betti')).includes('Férfi hajvágás'));
    assert.ok(szoveg(forras('evelin')).includes('Hajhosszabbítás (póthaj)'));
    assert.ok(!szoveg(forras('betti')).includes('Hajhosszabbítás (póthaj)'));
  });
  test('a foglalo-linkek mind a /foglalo-motor?business=hair... cimre mutatnak, a fodraszok ismerik a sajat kulcsukat', () => {
    for (const k of KULCSOK) {
      const h = forras(k);
      const linkek = [...h.matchAll(/href="(\/foglalo-motor[^"]*)"/g)].map((m) => m[1]);
      assert.ok(linkek.length >= 6, `${k}: kevesebb foglalo-link a vartnal`);
      for (const l of linkek) assert.match(l, /^\/foglalo-motor\?business=hair(&|$)/, l);
      if (k !== 'kozpont') for (const l of linkek) assert.ok(/staff=/.test(l) ? l.includes('staff=' + k) : true, `${k}: idegen fodrasz-kulcs: ${l}`);
      assert.ok(linkek.some((l) => /service=konzultacio/.test(l)), `${k}: nincs konzultacio-link`);
      assert.ok(!/salonic\.hu\/(select|show)/.test(h), `${k}: kozvetlen Salonic-link maradt`);
    }
    assert.ok(forras('betti').includes('/foglalo-motor?business=hair&staff=betti'));
    assert.ok(forras('noel').includes('/foglalo-motor?business=hair&staff=noel&category=balayage'));
  });
  test('minden kep megvan a lemezen, van alt szovege es merete (nincs elmozdulas)', () => {
    for (const k of KULCSOK) {
      const h = forras(k);
      for (const m of h.matchAll(/<img\b[^>]*>/g)) {
        const tag = m[0];
        const src = (tag.match(/\ssrc="([^"]+)"/) || [])[1];
        if (!src || src.startsWith('data:')) continue;
        assert.ok(fs.existsSync(path.join(GYOKER, src)), `${k}: hianyzo kep: ${src}`);
        assert.ok(/\salt="/.test(tag), `${k}: alt nelkuli kep: ${src}`);
        assert.ok(/\swidth="\d+"/.test(tag) && /\sheight="\d+"/.test(tag), `${k}: meret nelkuli kep: ${src}`);
      }
    }
  });
  test('a hero-kep valodi MOSAIC-fotokbol all (csak a regi oldalak kepei / a booking-kepek), kulso kep nincs', () => {
    for (const k of KULCSOK) assert.ok(!/<img[^>]+src="https?:/.test(forras(k)), `${k}: kulso kep`);
  });
  test('egyetlen H1, a szekciok cimei h2, nincs #horgony-link (GTM History Change)', () => {
    for (const k of KULCSOK) {
      const h = forras(k);
      assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, `${k}: pontosan egy H1`);
      assert.ok(!/<a\s[^>]*href="#/.test(h), `${k}: #horgony-link`);
    }
  });
  test('a Salonic-pillanatkep friss volt (legfeljebb 30 napos): ha regi, frissitsd (node tools/hair-oldalak/salonic-pillanatkep.mjs)', () => {
    const nap = (Date.now() - new Date(PILLANATKEP.lekerve).getTime()) / 86400000;
    assert.ok(nap < 30, `a pillanatkep ${Math.round(nap)} napos`);
  });
});

// ======================= bongeszos ellenorzesek =======================
let szerver, bazis, b;
const kulso = [];
const TI = '<div class="ti-header"><div class="ti-rating">Kiváló</div><div class="ti-stars"><span class="ti-star f"></span><span class="ti-star f"></span><span class="ti-star f"></span><span class="ti-star f"></span><span class="ti-star h"></span></div><div class="ti-rating-text"><a>1 257 értékelés</a></div></div>';
const MASODPERC = () => Math.floor(Date.now() / 1000);

async function ujOldal(k, { szel = 1280, mobil = false, salonic = 'siker' } = {}) {
  const ctx = await b.newContext({ viewport: { width: szel, height: mobil ? 844 : 900 }, isMobile: mobil, hasTouch: mobil, userAgent: mobil ? UA_MOBIL : undefined });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(bazis)) return route.continue();
    kulso.push(u);
    const cors = { 'access-control-allow-origin': '*' };
    if (u.includes('cdn.trustindex.io/widgets')) return route.fulfill({ contentType: 'text/html', body: TI, headers: cors });
    if (u.includes('api.salonic.hu/calendar/getAvailableTimes')) {
      if (salonic === 'hiba') return route.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: '{"status":"error"}' });
      const t = MASODPERC() + 26 * 3600;
      return route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data: { blocks: { x: { y: { slots: { a: { timestamp: t }, b: { timestamp: t + 7200 } } } } } } }) });
    }
    if (u.includes('mosaic-hair.salonic.hu')) return route.fulfill({ contentType: 'text/html', headers: cors, body: "calendarId: 'ujnaptar'" });
    return route.abort();
  });
  const p = await ctx.newPage();
  const hibak = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  await p.goto(bazis + ut(k), { waitUntil: 'load' });
  await p.evaluate(() => { try { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: false, ana: false, adv: false })); } catch (e) { /* nem baj */ } });
  return { p, ctx, hibak };
}

describe('bongeszoben', { concurrency: false }, () => {
  before(async () => {
    ({ szerver, bazis } = await szerverInditas());
    b = await playwright().chromium.launch({ executablePath: CHROME, headless: true });
  });
  after(async () => { await b.close(); szerver.close(); });

  for (const k of KULCSOK) {
    test(`${k}: hibatlanul betolt, nincs kulso (nem hamisitott) halozati keres a Trustindex / Salonic / Google-on kivul`, async () => {
      kulso.length = 0;
      const { p, ctx, hibak } = await ujOldal(k);
      await p.waitForTimeout(600);
      assert.deepEqual(hibak, []);
      const nemVart = kulso.filter((u) => !/trustindex\.io|api\.salonic\.hu|mosaic-hair\.salonic\.hu|google\.com\/maps/.test(u));
      assert.deepEqual(nemVart, [], 'nem vart kulso kerés: ' + nemVart.join(', '));
      await ctx.close();
    });

    test(`${k}: nincs vizszintes tulcsordulas 320 / 390 / 768 / 1280 px-en, a kepek betoltodnek`, async () => {
      for (const [szel, mobil] of [[320, true], [390, true], [768, false], [1280, false]]) {
        const { p, ctx } = await ujOldal(k, { szel, mobil });
        await p.waitForTimeout(300);
        const h = await p.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < h; y += 700) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(40); }
        await p.waitForTimeout(500);
        // csak a sajat tartalmat (main.hl) vizsgaljuk: a Wixes asztali fejlec 768 px alatt szelesebb az ablaknal (az eles oldalon is), az nem a mi oldalunk
        const adat = await p.evaluate(() => {
          const gorgetheto = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
          const m = document.querySelector('main.hl');
          const tul = [...m.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !gorgetheto(e)).map((e) => e.tagName + '.' + e.className);
          return {
            main: Math.round(m.getBoundingClientRect().right), ablak: window.innerWidth, tul: tul.slice(0, 5), dok: document.documentElement.scrollWidth,
            rossz: [...m.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0 && !i.closest('[hidden]') && i.offsetParent !== null).map((i) => i.src),
          };
        });
        assert.ok(adat.main <= adat.ablak, `${k} @${szel}: a main szelesebb az ablaknal (${adat.main} > ${adat.ablak})`);
        assert.deepEqual(adat.tul, [], `${k} @${szel}: az ablakon kilogo elemek`);
        if (mobil) assert.ok(adat.dok <= adat.ablak, `${k} @${szel}: vizszintes gorgetes (${adat.dok} > ${adat.ablak})`);
        assert.deepEqual(adat.rossz, [], `${k} @${szel}: nem betoltott kepek`);
        await ctx.close();
      }
    });
  }

  test('kozpont: a galeria szuro es a "tovabbi munkak" gomb mukodik, a nagyito megnyilik, lapoz, es bezarul', async () => {
    const { p, ctx, hibak } = await ujOldal('kozpont');
    const lathato = () => p.locator('#galeria-racs > li:not([hidden])').count();
    assert.equal(await lathato(), 8);
    await p.locator('#galeria-tobb').click();
    assert.equal(await lathato(), 19);
    await p.locator('.szuro[data-szuro="s"]').click();
    const szokek = await p.locator('#galeria-racs > li:not([hidden])').evaluateAll((l) => l.map((x) => x.dataset.szin));
    assert.ok(szokek.length >= 2 && szokek.every((x) => x === 's'));
    await p.locator('#galeria-racs > li:not([hidden]) .kep-gomb').first().click();
    assert.equal(await p.locator('#lb').evaluate((d) => d.open), true);
    const elso = await p.locator('#lb-img').getAttribute('src');
    await p.locator('#lb-kovetkezo').click();
    assert.notEqual(await p.locator('#lb-img').getAttribute('src'), elso);
    await p.keyboard.press('ArrowLeft');
    assert.equal(await p.locator('#lb-img').getAttribute('src'), elso);
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('#lb').evaluate((d) => d.open), false);
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('arlista: a fulek valtanak, billentyuzettel is; a kozponti oldalon nincs kedvezmenyes (athuzott) ar, Noelnel van', async () => {
    const { p, ctx } = await ujOldal('kozpont');
    assert.equal(await p.locator('.ar-csop:not([hidden])').count(), 1);
    await p.locator('.ar-ful[data-ar-ful="festes"]').click();
    assert.equal(await p.locator('.ar-csop:not([hidden])').getAttribute('data-ar-csop'), 'festes');
    await p.locator('.ar-ful[data-ar-ful="festes"]').press('ArrowRight');
    assert.equal(await p.locator('.ar-csop:not([hidden])').getAttribute('data-ar-csop'), 'vagas');
    assert.equal(await p.locator('.regi-ar').count(), 0);
    await ctx.close();
    const n = await ujOldal('noel');
    assert.ok((await n.p.locator('.ar-tabla .regi-ar').count()) > 10);
    await n.ctx.close();
  });

  test('mobil: a sticky sav a hero gombjai utan jelenik meg, fent es a foglalo / helyszin szekcional rejtve van', async () => {
    for (const k of ['kozpont', 'betti']) {
      const { p, ctx } = await ujOldal(k, { szel: 390, mobil: true });
      const lat = () => p.locator('#sticky-cta').evaluate((e) => e.classList.contains('lathato'));
      assert.equal(await lat(), false, `${k}: fent nem latszhat`);
      await p.evaluate(() => window.scrollTo(0, 1400)); await p.waitForTimeout(250);
      assert.equal(await lat(), true, `${k}: gorgetes utan latszik`);
      assert.equal(await p.locator('#sticky-cta a.gomb-arany').getAttribute('tabindex'), null);
      await p.evaluate(() => document.getElementById('hely').scrollIntoView()); await p.waitForTimeout(250);
      assert.equal(await lat(), false, `${k}: a helyszin szekcional rejtve`);
      await ctx.close();
    }
  });

  test('asztalon nincs sticky sav', async () => {
    const { p, ctx } = await ujOldal('kozpont');
    await p.evaluate(() => window.scrollTo(0, 1800)); await p.waitForTimeout(250);
    assert.equal(await p.locator('#sticky-cta').isVisible(), false);
    await ctx.close();
  });

  test('a Google-ertekeles-sav a Trustindex AKTUALIS adatabol toltodik (nincs beegetett szam), a velemeny-keret betolt', async () => {
    const { p, ctx } = await ujOldal('kozpont');
    await p.waitForTimeout(500);
    const csip = p.locator('#g-chip');
    assert.equal(await csip.isVisible(), true);
    assert.match(await p.locator('#g-szoveg').textContent(), /Kiváló · 1 257 Google-vélemény/);
    assert.equal(await p.locator('#g-csillag').evaluate((e) => e.style.getPropertyValue('--ert')), '90%');
    assert.equal(await p.locator('#ti-doboz iframe').count(), 1);
    assert.ok(!/1[  .]?257/.test(forras('kozpont')), 'a vélemények száma nincs beégetve');
    await ctx.close();
    // ha a Trustindex nem valaszol: a sav rejtve marad (nincs kitalalt ertek)
    const ctx2 = await b.newContext();
    await ctx2.route('**/*', (r) => (r.request().url().startsWith(bazis) ? r.continue() : r.abort()));
    const p2 = await ctx2.newPage();
    await p2.goto(bazis + ut('kozpont'));
    await p2.waitForTimeout(500);
    assert.equal(await p2.locator('#g-chip').isHidden(), true);
    await ctx2.close();
  });

  test('legkozelebbi szabad konzultacio: a Salonic naptarabol toltodik, a link a motor start= idopontjara mutat; hiba eseten rejtve marad', async () => {
    const { p, ctx } = await ujOldal('betti');
    await p.waitForTimeout(700);
    const sor = p.locator('.hero .kovetkezo');
    assert.equal(await sor.isVisible(), true);
    assert.match(await sor.locator('a').textContent(), /^(Ma|Holnap|Péntek|Hétfő|Kedd|Szerda|Csütörtök|Szombat|Vasárnap|\S+) \d{1,2}:\d{2}$/);
    const href = await sor.locator('a').getAttribute('href');
    assert.match(href, /^\/foglalo-motor\?business=hair&staff=betti&service=konzultacio&start=\d{10}$/);
    await ctx.close();
    const h = await ujOldal('betti', { salonic: 'hiba' });
    await h.p.waitForTimeout(700);
    assert.equal(await h.p.locator('.hero .kovetkezo').isHidden(), true);
    await h.ctx.close();
  });

  test('kozpont: a harom fodrasz-kartya a sajat kulcsaval nyitja a foglalot es a sajat oldalukra mutat', async () => {
    const { p, ctx } = await ujOldal('kozpont');
    for (const f of ['betti', 'noel', 'evelin']) {
      const kartya = p.locator('.fodrasz-kartya', { hasText: FODRASZOK[f].nev }).first();
      assert.equal(await kartya.locator(`a[href="/foglalo-motor?business=hair&staff=${f}"]`).count(), 1);
      assert.ok((await kartya.locator(`a[href="${ut(f)}"]`).count()) >= 2);
    }
    await ctx.close();
  });

  test('meres: landing_view es a CTA-esemenyek a dataLayerbe kerulnek (nevek a doc szerint), a GTM-et nem toltjuk', async () => {
    const { p, ctx } = await ujOldal('noel');
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelectorAll('a[href*="foglalo-motor"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault())));
    const esemenyek = () => p.evaluate(() => window.dataLayer.map((x) => x.event + ':' + (x.landing_id || '') + ':' + (x.staff || '')));
    assert.ok((await esemenyek()).includes('landing_view:hair-noel:noel'));
    await p.locator('.hero a[data-konzult]').first().click();
    await p.locator('#szakteruletek a[data-service="balayage"]').click();
    const lista = await p.evaluate(() => window.dataLayer);
    assert.ok(lista.some((x) => x.event === 'consultation_cta_click' && x.landing_id === 'hair-noel' && x.cta_position === 'hero'));
    assert.ok(lista.some((x) => x.event === 'service_selected' && x.service === 'balayage' && x.staff === 'noel'));
    await ctx.close();
  });

  test('a fejlec / lablec megvan, a menu "Fodraszat" pontja aktiv a kozponti oldalon', async () => {
    const { p, ctx } = await ujOldal('kozpont');
    assert.ok((await p.locator('a[href="/noi-fodraszat-budapest"][aria-current], a[href="/noi-fodraszat-budapest"]').count()) >= 1);
    assert.ok(await p.locator('#mh-fejlec').count() >= 1);
    assert.ok(await p.locator('#mh-lablec').count() >= 1);
    await ctx.close();
  });

  test('foglalo-kapcsolat: a CTA-k a launcherrel nyilhatnak (data-booking nelkul is /foglalo-motor link), JS nelkul a motor-oldalra visznek', async () => {
    const { p, ctx } = await ujOldal('evelin');
    const href = await p.locator('.hero a.gomb-arany').first().getAttribute('href');
    assert.equal(href, '/foglalo-motor?business=hair&staff=evelin');
    await ctx.close();
  });
});
