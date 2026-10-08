// A harom regi (Wixes) hirdetesi ajandekkartya-oldal ujrastilusa (headspa-ajandakkartya-fiataloknak, headspa-ajándékkártya-ezo, headspa-self-care)
// bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt.
//
//   node --test tools/ujrastilus-teszt/ajandek-variansok.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
// A tartalom-hűseg (a regi oldal szovege, kepei, linkjei) a forras/<kulcs>.folyam.txt-bol (a regi oldal kinyert tartalma) ellenorzodik.
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

const OLDALAK = [
  { kulcs: 'fiataloknak', nev: 'headspa-ajandakkartya-fiataloknak' },
  { kulcs: 'ezo', nev: 'headspa-ajándékkártya-ezo' },
  { kulcs: 'self-care', nev: 'headspa-self-care' },
];
const STRIPE = ['https://buy.stripe.com/5kQcN56RK6Mb7VC3pf7g40j', 'https://buy.stripe.com/cNi8wP6RK8Ujfo41h77g40k', 'https://buy.stripe.com/3cIeVd7VOc6va3K7Fv7g40i'];
const LEAD_FORM_ID = '7715ab48-7c85-4c1c-8fbc-a38c1cb1a23c';
const KARTYA = 'Egyéni 50 perces Headspa kezelés - 26.900 Ft (20% kedvezmény)';

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
// a regi oldal kinyert sorai: { t: tipus, raw }
function folyam(kulcs) {
  return olvas(`tools/ajandek-variansok/forras/${kulcs}.folyam.txt`).split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^\s*\d+\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x-?\d+\s+w\d+\s*(?:h\d+)?\s*(.*)$/.exec(l);
    return { t: m[1], raw: m[2] };
  });
}
const szovegbol = (html) => html.replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '').replace(/\s+->\s+\S+\s*$/, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
// betuk es szamok kisbetuvel: a tagolas / irasjelek / emojik kulonbsegei nem szamitanak
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200d\u200b\u00a0]/gu, '').replace(/[^\p{L}\p{N}]+/gu, '');

async function nyit(nev, { szeles = 1440 } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], nincs = [], kulso = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  // a dataLayer-esemenyek a sessionStorage-ba is kerulnek (a bekuldes utan atiranyit az oldal)
  await p.addInitScript(() => {
    const naplo = (x) => { try { const l = JSON.parse(sessionStorage.getItem('__dl') || '[]'); l.push(x); sessionStorage.setItem('__dl', JSON.stringify(l)); } catch (e) { /* nem baj */ } };
    const dl = (window.dataLayer = window.dataLayer || []);
    const eredeti = dl.push.bind(dl);
    dl.push = (...a) => { a.forEach(naplo); return eredeti(...a); };
  });
  await p.goto(`${bazis}/${encodeURI(nev)}`, { waitUntil: 'domcontentloaded' });
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, nincs, kulso };
}

for (const { kulcs, nev } of OLDALAK) {
  describe(`/${nev}`, () => {
    test('betoltodik hibak nelkul: egyetlen H1, nincs torott kep / 404 / konzol-hiba; a regi oldal cime, leirasa, canonical-ja valtozatlan; noindex (mint a regi)', async () => {
      const regi = olvas(`klon/${nev}.html`);
      const g = (re) => { const m = re.exec(regi); assert.ok(m, 'meta a regi oldalon: ' + re); return m[1]; };
      const { p, ctx, hibak, nincs } = await nyit(nev);
      assert.equal(await p.title(), g(/<title>([^<]*)<\/title>/).replace(/&amp;/g, '&'));
      assert.equal(await p.getAttribute('meta[name="description"]', 'content'), g(/<meta name="description" content="([^"]*)"/).replace(/&amp;/g, '&'));
      assert.equal(await p.getAttribute('link[rel="canonical"]', 'href'), g(/<link rel="canonical" href="([^"]*)"/));
      assert.match(await p.getAttribute('meta[name="robots"]', 'content'), /noindex/);
      assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
      assert.equal(await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc)).then((l) => l.length), 0, 'torott kepek');
      assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
      assert.equal(await p.locator('main [id^="comp-"], main wow-image, main [data-mesh-id]').count(), 0, 'nincs Wix-maradvany');
      assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
      assert.deepEqual(nincs, [], '404-es helyi kereseik');
      assert.deepEqual(hibak, []);
      await ctx.close();
    });

    test('a regi oldal MINDEN szovege, kepe, linkje megvan (tartalom-hűseg): sorok, gombok, kepek, videok, Stripe-linkek, GYIK', async () => {
      const sorok = folyam(kulcs);
      const { p, ctx } = await nyit(nev);
      const uj = norm(await p.evaluate(() => document.querySelector('main').innerText + ' ' + [...document.querySelectorAll('main .gyik details')].map((d) => d.textContent).join(' ')));
      const hianyzo = [];
      for (const s of sorok) {
        if (!['SZ', 'H1', 'H2', 'H3', 'GOMB'].includes(s.t)) continue;
        const sz = norm(szovegbol(s.raw));
        if (!sz) continue;
        if (/^ajándékozottteljesneve/.test(sz)) continue;   // az urlap-sor: lent kulon (mezonkent) ellenorizve
        if (!uj.includes(sz)) hianyzo.push(szovegbol(s.raw).slice(0, 90));
      }
      assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg');
      // az urlap mezoi es a kartya-valasztek szo szerint
      const urlapSor = sorok.find((s) => /^ajándékozottteljesneve/.test(norm(szovegbol(s.raw))));
      const urlapNorm = norm(szovegbol(urlapSor.raw));
      const ujUrlap = norm(await p.textContent('form.ajv-urlap') + ' ' + (await p.$$eval('form.ajv-urlap input', (l) => l.map((i) => i.getAttribute('aria-label') || '').join(' '))));
      for (const resz of ['Ajándékozott Teljes Neve', 'Fizető fél Vezetékneve', 'Fizető fél Keresztneve', 'E-mail cím (Ahova a pdf-et kéred)', 'Telefonszámod amin elérünk', 'Számlázási cím (magán vagy céges)',
        'Cégnév (Ha céges számlát kérsz)', 'Cég adószám (Ha céges számlát kérsz)', 'Milyen kártyát kérsz?', 'LIMITÁLT - 50 perces 4 Kezes Headspa ajándékkártya - 39.900 Ft (20% kedvezmény)', KARTYA,
        'Páros 50 perces Headspa kezelés - 53.800 Ft (20% kedvezmény)', 'A Mosaic Headspa ÁSZF-jét elolvastam és elfogadom.', 'Megveszem! Átutalási kötelezettség mellett.']) {
        assert.ok(urlapNorm.includes(norm(resz)), 'a regi urlapban: ' + resz);
        assert.ok(ujUrlap.includes(norm(resz)), 'az uj urlapban: ' + resz);
      }
      // kepek: a regi oldal minden kepe (fajlnev szerint) az uj oldalon
      const html = await p.content();
      const kepek = sorok.filter((s) => s.t === 'KEP').map((s) => /^(\S+)/.exec(s.raw)[1].split('/').pop());
      assert.deepEqual(kepek.filter((k) => !html.includes(k)), [], 'hianyzo kepek');
      // linkek: minden regi gomb-link (kulso es belso) szo szerint
      const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
      const regiLinkek = sorok.filter((s) => s.t === 'GOMB').map((s) => /\s->\s+(\S+)\s*$/.exec(s.raw)?.[1]).filter(Boolean);
      assert.deepEqual([...new Set(regiLinkek)].filter((h) => !hrefek.includes(h)), [], 'hianyzo linkek');
      for (const s of STRIPE) assert.ok(hrefek.includes(s), 'Stripe-link: ' + s);
      // videok: a [data-video] fajlok megvannak
      const videok = await p.$$eval('[data-video]', (l) => l.map((b) => b.dataset.video));
      assert.ok(videok.length >= 5, 'a bemutatkozo, a bemutato es a 3 vendegvideo');
      for (const v of videok) assert.ok(fs.existsSync(path.join(GYOKER, v.slice(1))), 'videofajl: ' + v);
      // GYIK: a regi harmonika valaszai (assets/js/gyik.js)
      const gy = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])['c2eb0f_97df67cb524ad4ad76e22fddea2496e5'];
      const kerdesek = await p.$$eval('main .gyik details', (l) => l.map((d) => ({ k: d.querySelector('summary').textContent.trim(), v: d.querySelector('.gy-valasz').textContent })));
      assert.equal(kerdesek.length, gy.length);
      gy.forEach(([k, v], i) => { assert.equal(kerdesek[i].k, k); assert.equal(norm(kerdesek[i].v), norm(v.replace(/<[^>]*>/g, ''))); });
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

    test('az urlap a MEGLEVO klon.js-en fut: hibas / ures kitoltesre uzenet es nincs kuldes; helyes kitoltesre POST form-name=ajandekkartya, a regi lead-meres (lead -> ecommerce:null -> generate_lead, a regi form_id-val), atiranyitas', async () => {
      const { p, ctx } = await nyit(nev);
      const kuldesek = [];
      await p.route(/\/$/, (r) => { if (r.request().method() === 'POST') { kuldesek.push(r.request().postData()); return r.fulfill({ status: 200, body: 'ok' }); } return r.fallback(); });
      await p.route(/\/success-ajandekkartya$/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>kosz</title><p>kosz</p>' }));
      const gomb = p.locator('#ajandek-kuldes');
      await gomb.scrollIntoViewIfNeeded();
      await gomb.click();
      await p.waitForTimeout(200);
      assert.match(await p.textContent('.mh-urlap-uzenet'), /töltsd ki a csillaggal/);
      assert.equal(kuldesek.length, 0, 'ures urlap nem kuldheto');
      assert.ok(await p.locator('.ajv-mezo:has(.mh-hibas) .hiba').first().isVisible(), 'a hibas mezo uzenete latszik');
      // szamjegy a nev mezoben
      await p.fill('[name=ajandekozott]', 'Teszt Elek');
      await p.fill('[name=vezeteknev]', 'Teszt 06');
      await p.fill('[name=keresztnev]', 'Elek');
      await p.fill('[name=email]', 'teszt@example.com');
      await p.fill('[name=telefon]', '06 20 123 4567');
      await p.fill('[name=szamlazasi_cim]', '1023 Budapest, Teszt utca 1.');
      await p.check(`input[type=radio][aria-label="${KARTYA}"]`);
      await p.check('[name=aszf]');
      await gomb.click();
      await p.waitForTimeout(200);
      assert.match(await p.textContent('.mh-urlap-uzenet'), /nem tartalmazhat számot/);
      assert.equal(kuldesek.length, 0);
      await p.fill('[name=vezeteknev]', 'Teszt');
      await Promise.all([p.waitForURL(/success-ajandekkartya/), gomb.click()]);
      assert.equal(kuldesek.length, 1, 'egy POST');
      const adat = new URLSearchParams(kuldesek[0]);
      assert.equal(adat.get('form-name'), 'ajandekkartya');
      assert.equal(adat.get('oldal'), encodeURIComponent(nev).replace(/%2F/g, '/'));
      assert.equal(adat.get('ajandekozott'), 'Teszt Elek');
      assert.equal(adat.get('vezeteknev'), 'Teszt');
      assert.equal(adat.get('keresztnev'), 'Elek');
      assert.equal(adat.get('email'), 'teszt@example.com');
      assert.equal(adat.get('telefon'), '+36201234567');
      assert.equal(adat.get('szamlazasi_cim'), '1023 Budapest, Teszt utca 1.');
      assert.equal(adat.get('cegnev'), '');
      assert.equal(adat.get('kartya'), KARTYA);
      assert.equal(adat.get('aszf'), 'elfogadva');
      const dl = JSON.parse(await p.evaluate(() => sessionStorage.getItem('__dl') || '[]'));
      const lead = dl.filter((e) => e && (e.event === 'lead' || e.event === 'generate_lead' || e.ecommerce === null));
      assert.deepEqual(lead.map((e) => e.event || 'ecommerce:null'), ['lead', 'ecommerce:null', 'generate_lead'], 'a regi Wix-urlap meresi sorrendje');
      assert.equal(lead[0].event_label, 'Form name: Ajándékkártya ');
      assert.equal(lead[2].form_id, LEAD_FORM_ID);
      assert.equal(lead[2].label, 'Form name: Ajándékkártya ');
      assert.equal(lead[2].user_data.email, 'teszt@example.com');
      assert.equal(lead[2].user_data.phone_number, '+36201234567');
      await ctx.close();
    });

    test('video: kattintasra felugro lejatszo; galeria: a lapozo gomb mozgatja a savot; GYIK: a harmonika nyilik', async () => {
      const { p, ctx } = await nyit(nev);
      await p.locator('#vendegvideok .video-kartya, #bemutatkozas .video-kartya').first().click();
      await p.waitForSelector('dialog.video-modal[open] video');
      assert.match(await p.getAttribute('dialog.video-modal video', 'src'), /^\/assets\/video\//);
      await p.click('.video-modal-bezar');
      const sav = p.locator('#galeria .korhinta-sav');
      await sav.scrollIntoViewIfNeeded();
      const elotte = await sav.evaluate((e) => e.scrollLeft);
      await p.click('#galeria .korhinta-gomb.kovetkezo');
      await p.waitForFunction((x) => document.querySelector('#galeria .korhinta-sav').scrollLeft > x + 50, elotte);
      const elso = p.locator('#gyik details').first();
      await elso.locator('summary').click();
      assert.equal(await elso.evaluate((d) => d.open), true);
      assert.ok(await elso.locator('.gy-valasz').isVisible());
      await ctx.close();
    });

    for (const szeles of [390, 360]) {
      test(`telefonon (${szeles} px) nincs vizszintes gorgetes; a hero cime a kep elott; a termek-kartyak egymas alatt; az urlap egy oszlopban`, async () => {
        const { p, ctx, hibak } = await nyit(nev, { szeles });
        const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        assert.equal(m.sw, m.cw, 'vizszintes tobblet');
        const y = await p.evaluate(() => ({ h1: document.querySelector('.ajv-hero h1').getBoundingClientRect().top, kep: document.querySelector('.ajv-hero .hero-kep').getBoundingClientRect().top,
          t1: document.querySelectorAll('.ajv-termek')[0].getBoundingClientRect().left, t2: document.querySelectorAll('.ajv-termek')[1].getBoundingClientRect().left,
          m1: document.querySelectorAll('.ajv-mezo')[0].getBoundingClientRect().left, m2: document.querySelectorAll('.ajv-mezo')[1].getBoundingClientRect().left }));
        assert.ok(y.h1 < y.kep, 'a cim a kep elott');
        assert.equal(y.t1, y.t2, 'a termek-kartyak egymas alatt');
        assert.equal(y.m1, y.m2, 'az urlap mezoi egy oszlopban');
        assert.deepEqual(hibak, []);
        await ctx.close();
      });
    }
  });
}
