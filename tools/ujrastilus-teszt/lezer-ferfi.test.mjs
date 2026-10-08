// A regi (Wixes) "Vegleges lezeres szortelenites ferfiaknak" oldal (vegleges-szortelenites-ferfiaknak) ujrastilusa bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs)
// allitja ossze az oldalt.
//
//   node --test tools/ujrastilus-teszt/lezer-ferfi.test.mjs
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

const NEV = 'vegleges-szortelenites-ferfiaknak';
const EGYEDI = 'Végleges Lézeres szőrtelenítés férfiaknak';
let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
// a regi oldal kinyert sorai: { t: tipus, raw }
function folyam() {
  return olvas('tools/lezer-variansok/forras/ferfi.folyam.txt').split('\n').filter((l) => l.trim()).map((l) => {
    const m = /^\s*\d+\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x-?\d+\s+w\d+\s*(?:h\d+)?\s*(.*)$/.exec(l);
    return { t: m[1], raw: m[2] };
  });
}
const szovegbol = (html) => html.replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '').replace(/\s+->\s+\S+\s*$/, '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
// betuk es szamok kisbetuvel: a tagolas / irasjelek / emojik / athuzas-jelek kulonbsegei nem szamitanak
const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[\u0336\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200d\u200b\u00a0]/gu, '').replace(/[^\p{L}\p{N}]+/gu, '');

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

describe(`/${NEV}`, () => {
  const nev = NEV;
  test('betoltodik hibak nelkul: egyetlen H1, nincs torott kep / 404 / konzol-hiba; a regi oldal cime, leirasa, canonical-ja valtozatlan; INDEXELHETO (a regi sem volt noindex)', async () => {
    const regi = olvas(`klon/${nev}.html`);
    const g = (re) => { const m = re.exec(regi); assert.ok(m, 'meta a regi oldalon: ' + re); return m[1]; };
    const { p, ctx, hibak, nincs } = await nyit(nev);
    assert.equal(await p.title(), g(/<title>([^<]*)<\/title>/).replace(/&amp;/g, '&'));
    assert.equal(await p.getAttribute('meta[name="description"]', 'content'), g(/<meta name="description" content="([^"]*)"/).replace(/&amp;/g, '&'));
    assert.equal(await p.getAttribute('link[rel="canonical"]', 'href'), g(/<link rel="canonical" href="([^"]*)"/));
    assert.equal(await p.locator('meta[name="robots"]').count(), 0, 'nincs robots meta (a regi oldal indexelheto volt)');
    assert.doesNotMatch(regi, /<meta name="robots"/, 'a regi oldal sem volt noindex');
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

  test('a regi oldal MINDEN szovege, kepe, linkje megvan (tartalom-hűseg): sorok, gombok, arkartyak, GYIK, kepek', async () => {
    const sorok = folyam();
    const { p, ctx } = await nyit(nev);
    const uj = norm(await p.evaluate(() => document.querySelector('main').innerText + ' ' + [...document.querySelectorAll('main .gyik details')].map((d) => d.textContent).join(' ')));
    const hianyzo = [];
    for (const s of sorok) {
      if (!['SZ', 'H1', 'H2', 'H3', 'H4', 'GOMB'].includes(s.t)) continue;
      const sz = norm(szovegbol(s.raw).replace(/(\d) \.(\d{3})/g, '$1.$2'));   // a kinyero "68 .000"-et ad "68.000" helyett
      if (!sz) continue;
      if (s.t === 'GOMB' && /^\d+\. .*\?$/.test(szovegbol(s.raw).trim())) continue;   // GYIK-kerdes: lent kulon, a gyik.js valaszaival egyutt
      if (!uj.includes(sz)) hianyzo.push(szovegbol(s.raw).slice(0, 90));
    }
    assert.deepEqual(hianyzo, [], 'a regi oldal szovegei, amik nincsenek meg');
    // kepek: a regi HTML MINDEN tartalmi kepe (fejlec / ikonok nelkul) az uj oldalon
    const regiHtml = olvas(`klon/${nev}.html`);
    const eleje = regiHtml.indexOf('81f16bfc67fb');
    // a "brutalis-simasag" (d25d1e56510f) a regi oldalon a konzultacio- es a "felejtsd el a pengét" doboz TAKART hatterkepe (a latszo kep a doboz bal oldali csempeje): nem kerul az uj oldalra
    const azonosito = [...new Set([...regiHtml.slice(eleje).matchAll(/(?:(?:c2eb0f|11062b|nsplsh)_)?([0-9a-f]{12})[0-9a-f]{8,}\.(?:jpe?g|png|webp)/g)].map((m) => m[1]))].filter((k) => k !== 'd25d1e56510f');
    assert.ok(azonosito.length >= 33, 'a regi oldal kepeinek listaja: ' + azonosito.length);
    const html = await p.content();
    assert.deepEqual(azonosito.filter((k) => !html.includes(k)), [], 'hianyzo kepek (a regi oldal HTML-je szerint)');
    // linkek
    const hrefek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    const regiLinkek = sorok.filter((s) => s.t === 'GOMB').map((s) => /\s->\s+(\S+)\s*$/.exec(s.raw)?.[1]).filter(Boolean);
    assert.deepEqual([...new Set(regiLinkek)].filter((h) => !hrefek.includes(h)), [], 'hianyzo linkek');
    // arkartyak: 2 csomag + 4 testresz-csoport (3 + 3 + 4 + 3 sor)
    assert.equal(await p.locator('.lv-csomag').count(), 2);
    assert.equal(await p.locator('.lv-tr-csoport').count(), 4);
    assert.equal(await p.locator('.lv-tr-tetel').count(), 13, 'HAT / MELL / HAS 3 + ARC 3 + TEST 4 + 2 LAB 3 sor');
    assert.equal(await p.locator('.lv-promo').count() >= 6, true, 'a "20% majusi kedvezmennyel!" sorok');
    assert.equal(await p.locator('[data-video]').count(), 0, 'a ferfi oldalon nincs video');
    // Trustindex + GYIK
    assert.equal(await p.getAttribute('#trustindex', 'data-embed'), '/assets/embed/c2eb0f_614b09d160b9382c4cffcde6d7828dcb.html');
    const gy = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])['c2eb0f_7101a51e50aef2435d5ed679e90074d4'];
    const kerdesek = await p.$$eval('main .gyik details', (l) => l.map((d) => ({ k: d.querySelector('summary').textContent.trim(), v: d.querySelector('.gy-valasz').textContent })));
    assert.equal(kerdesek.length, gy.length);
    gy.forEach(([k, v], i) => { assert.equal(kerdesek[i].k, k); assert.equal(norm(kerdesek[i].v), norm(v.replace(/<[^>]*>/g, ''))); });
    await ctx.close();
  });

  test('FUGGETLEN tartalom-hűseg: a regi oldal HTML-jenek MINDEN szovegcsomopontja megvan az uj oldalon - csak a fejlec / menu / info-panel szovegei hianyozhatnak', async () => {
    const t = olvas(`klon/${nev}.html`).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<noscript[\s\S]*?<\/noscript>/g, '');
    const nyers = [...t.matchAll(/>([^<>]{12,})</g)].map((m) => m[1]);
    const { p, ctx } = await nyit(nev);
    const csomok = (await p.evaluate((l) => l.map((x) => { const e = document.createElement('textarea'); e.innerHTML = x; return e.value.trim(); }), nyers)).filter(Boolean);
    const gyik = JSON.parse(/window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(olvas('assets/js/gyik.js'))[1])['c2eb0f_7101a51e50aef2435d5ed679e90074d4'].map(([k, v]) => k + ' ' + v.replace(/<[^>]*>/g, ' ')).join(' ');
    const uj = norm(await p.evaluate(() => document.body.textContent) + ' ' + (await p.title()) + ' ' + gyik);
    const FEJLEC = /^(ÚJ! - 4 kezes Headspa!|Páros Head Spa|Head Spa Férfiaknak|Head Spa Csomagok és Árak|Head Spa - 20% OKTÓBERI kedvezmény!|Head Spa Vélemények|Fodrászat Árak|Októberi akció!.*|<script defer async src=.*|bottom of page|A LEGFONTOSABB INFÓK|📌 1023 Budapest.*|🕛 Hétfő - Péntek.*|Árlista, csomagok, foglalás|📅 Head Spa kezelések árai.*)$/;
    const hianyzo = csomok.filter((c) => !FEJLEC.test(c) && norm(c).length >= 8 && !uj.includes(norm(c)));
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

  test('mukodes: a galeria lapozo gombja mozgatja a savot (9 kep); a GYIK harmonika nyilik; a terkep-gomb betolti a terkepet; a foglalo-gombok linkje valtozatlan', async () => {
    const { p, ctx } = await nyit(nev);
    const sav = p.locator('.korhinta-sav');
    await sav.scrollIntoViewIfNeeded();
    assert.equal(await sav.locator('figure').count(), 9, 'szalon-galeria: 9 kep');
    const elotte = await sav.evaluate((e) => e.scrollLeft);
    await p.locator('.korhinta-gomb.kovetkezo').click();
    await p.waitForTimeout(700);
    assert.ok(await sav.evaluate((e) => e.scrollLeft) > elotte, 'a lapozo mozgatja a savot');
    const elso = p.locator('.gyik details').first();
    await elso.locator('summary').click();
    assert.equal(await elso.evaluate((d) => d.open), true);
    assert.match(await elso.locator('.gy-valasz').innerText(), /Crystal Freeze/);
    assert.match(await p.locator('#terkep-hely').innerText(), /Térkép: a tartalom külső szolgáltatótól \(Google\) töltődik be\./);
    await p.locator('#terkep-gomb').scrollIntoViewIfNeeded();
    await p.locator('#terkep-gomb').click();
    await p.waitForSelector('#terkep iframe', { timeout: 3000 });
    const foglal = await p.$$eval('main a[href^="/foglalo-motor"]', (l) => l.map((a) => a.getAttribute('href')));
    assert.ok(foglal.includes('/foglalo-motor?business=laser'), 'foglalo-link');
    await ctx.close();
  });

  for (const szeles of [390, 360]) {
    test(`telefon (${szeles} px): nincs vizszintes gorgetes, a kepek nem lognak ki, a kartyak olvashatok`, async () => {
      const { p, ctx } = await nyit(nev, { szeles });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'vizszintes tobblet');
      const kilog = await p.$$eval('main img', (l) => l.filter((i) => !i.closest('.korhinta') && i.getBoundingClientRect().right > innerWidth + 1).map((i) => i.currentSrc.split('/').pop()));
      assert.deepEqual(kilog, [], 'kikilogo kepek');
      assert.ok(await p.locator('.lv-csomag').first().isVisible());
      await ctx.close();
    });
  }
});
