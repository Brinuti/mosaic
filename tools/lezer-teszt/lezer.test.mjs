// A /lezeres-szortelenites-budapest landing tesztjei bongeszoben (Playwright), a helyi dist/ ellen. Kulso halozati forgalom nincs:
// minden nem helyi keres le van tiltva, a Salonic naptar-API-t a teszt hamisitja.
//
//   node tools/netlify-build.mjs && node --test tools/lezer-teszt/lezer.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja,
// ha a repoban nincs telepitve).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const OLDAL = '/lezeres-szortelenites-budapest';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) {
    try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ }
  }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

let szerver, bazis, bongeszo;

before(async () => {
  assert.ok(fs.existsSync(path.join(GYOKER, 'dist', '_a', 'lezeres-szortelenites-budapest.html')), 'Eloszor: node tools/netlify-build.mjs');
  const { fajlUtvonal } = await import(pathToFileURL(path.join(GYOKER, 'tools/serve-dist.mjs')).href);
  szerver = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers['user-agent']);
    if (e.atiranyit) { res.writeHead(301, { location: e.atiranyit }); return res.end(); }
    fs.readFile(e.fajl, (hiba, adat) => {
      if (hiba) { res.writeHead(404); return res.end('nincs'); }
      res.writeHead(200, { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream' });
      res.end(adat);
    });
  }).listen(0);
  await new Promise((ok) => szerver.once('listening', ok));
  bazis = 'http://localhost:' + szerver.address().port;
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

/** Uj oldal: kulso forgalom tiltva, a Salonic-API hamisitva. `api` = (url) => JSON-objektum. */
async function nyit({ mobil = false, api, meres } = {}) {
  const ctx = await bongeszo.newContext({
    viewport: { width: mobil ? 390 : 1440, height: mobil ? 844 : 900 },
    ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}),
  });
  const p = await ctx.newPage();
  const hibak = [];
  const kulso = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.route('https://api.salonic.hu/**', (r) => {
    const o = api ? api(r.request().url()) : { status: 'success', data: { blocks: {} } };
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  });
  await p.goto(bazis + OLDAL, { waitUntil: 'domcontentloaded' });
  return { p, ctx, hibak, kulso };
}
/** Az API-valasz: a megadott idobelyegek egy kezelonel. */
const idok = (...ts) => ({ status: 'success', data: { blocks: { 32417: { k1: { slots: Object.fromEntries(ts.map((t, i) => ['s' + i, { timestamp: t }])) } } } } });
const holnap = Math.floor(Date.now() / 1000) + 2 * 86400;
const SLOTOK = [holnap, holnap + 3600, holnap + 7200, holnap + 10800, holnap + 14400, holnap + 18000, holnap + 21600];
const szamjegy = (s) => +String(s).replace(/\D/g, '');

describe('oldal', () => {
  test('betoltodik, hibak nelkul, kulso kereseket nem kuld (suti-hozzajarulas nelkul)', async () => {
    const { p, ctx, hibak, kulso } = await nyit();
    assert.match(await p.title(), /Lézeres szőrtelenítés Budapesten/);
    assert.equal(await p.locator('h1').count(), 1);
    assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'), 'https://www.mosaicheadspa.hu/lezeres-szortelenites-budapest');
    await p.waitForLoadState('networkidle');
    assert.deepEqual(hibak, []);
    // a Google-terkep csak a "funkcionalis" suti elfogadasa utan toltodik
    assert.ok(!kulso.some((u) => /google\.com\/maps/.test(u)), 'terkep suti nelkul: ' + kulso.join(', '));
    await ctx.close();
  });

  test('a fejlecben a Szortelenites a kijelolt menupont (asztali es mobil)', async () => {
    for (const mobil of [false, true]) {
      const { p, ctx } = await nyit({ mobil });
      const html = await p.content();
      const aktiv = mobil
        ? [...html.matchAll(/<li[^>]*aria-current="page"[^>]*>.*?href="([^"]+)"/g)].map((m) => m[1])
        : [...html.matchAll(/data-is-current="true"[^>]*><div[^>]*><a[^>]*href="([^"]+)"/g)].map((m) => m[1]);
      assert.deepEqual(aktiv, ['/lezeres-szortelenites-budapest'], mobil ? 'mobil' : 'asztali');
      await ctx.close();
    }
  });

  test('minden kep betoltodik (nincs torott kep)', async () => {
    const { p, ctx } = await nyit();
    await p.evaluate(() => document.querySelectorAll('main img[loading=lazy]').forEach((i) => { i.loading = 'eager'; })); // a lusta kepek is toltodjenek be
    await p.waitForFunction(() => [...document.querySelectorAll('main img')].every((i) => i.complete), null, { timeout: 20000 });
    const torott = await p.$$eval('main img', (l) => l.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')));
    assert.deepEqual(torott, []);
    await ctx.close();
  });

  test('nincs vizszintes gorgetes telefonon (390 px)', async () => {
    const { p, ctx } = await nyit({ mobil: true });
    await p.waitForLoadState('networkidle');
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    assert.ok(m.sw <= m.iw, `scrollWidth ${m.sw} > ${m.iw}`);
    await ctx.close();
  });

  test('a regi, fotokat tartalmazo Egyedi csomag grafika nem szerepel az oldalon (intim terulet: nincs meztelen kep)', async () => {
    const html = fs.readFileSync(path.join(GYOKER, 'foglalas', 'lezeres-szortelenites-budapest.html'), 'utf8');
    assert.ok(!html.includes('8af672635311499ba75b593e0fb7af4f') && !html.includes('9c43d7be8ec84a5785a00f11315d03d1') && !html.includes('b3a5aa5289a9494b9eabbe574cf7a4d6'));
  });
});

describe('arforras (az #arlista tablazat)', () => {
  test('a 8 alkalmas program = 6 x alkalmankenti ar minden sorban; az azonositok szamok', async () => {
    const { p, ctx } = await nyit();
    const sorok = await p.$$eval('#arlista tr[data-kulcs]', (l) => l.map((tr) => ({ k: tr.dataset.kulcs, ar: +tr.dataset.ar, elso: tr.dataset.elso, egy: tr.querySelector('.ar-egy').textContent, prog: tr.querySelector('.ar-prog').textContent })));
    assert.ok(sorok.length >= 20);
    for (const s of sorok) {
      assert.equal(szamjegy(s.egy), s.ar, s.k + ' alkalmankent');
      assert.equal(szamjegy(s.prog), s.ar * 6, s.k + ' 8 alkalmas program');
      assert.match(s.elso, /^\d{6}$/, s.k + ' Salonic-azonosito');
    }
    assert.equal(new Set(sorok.map((s) => s.k)).size, sorok.length, 'egyedi kulcsok');
    await ctx.close();
  });

  test('a "Mennyibe kerul?" kartyak arai egyeznek az arlistaval', async () => {
    const { p, ctx } = await nyit();
    const ar = await p.$$eval('#arlista tr[data-kulcs]', (l) => Object.fromEntries(l.map((tr) => [tr.dataset.kulcs, +tr.dataset.ar])));
    const kartyak = await p.$$eval('.gyors-kartya', (l) => l.map((a) => ({ k: a.dataset.terulet, ar: a.querySelector('.ar').textContent })));
    assert.equal(kartyak.length, 4);
    for (const k of kartyak) assert.equal(szamjegy(k.ar), ar[k.k], k.k);
    await ctx.close();
  });
});

describe('kalkulator: a legdragabb teruletet teljes aron, a tobbit 50%-on', () => {
  const kivalaszt = async (p, ...kulcsok) => { for (const k of kulcsok) await p.click(`.sz-chip[data-kulcs="${k}"]`); };
  const alkalom = async (p) => szamjegy(await p.textContent('.sz-ossz b'));

  // az eredeti (elo) oldal "peldak az egyedi csomagra" szamai
  for (const [nev, kulcsok, vart] of [
    ['lab + kar + honalj + arc: 150 000 helyett 104 500', ['lab', 'kar', 'honalj', 'arc'], 104500],
    ['lab + intim: 95 000 helyett 77 000', ['lab', 'intim'], 77000],
    ['kar + honalj: 61 000 helyett 51 500', ['kar', 'honalj'], 51500],
    ['arc + kar: 72 000 helyett 57 000', ['arc', 'kar'], 57000],
    ['honalj + intim = a Basic csomag (45 500)', ['honalj', 'intim'], 45500],
    ['egy terulet teljes aron', ['honalj'], 19000],
  ]) {
    test(nev, async () => {
      const { p, ctx } = await nyit();
      await kivalaszt(p, ...kulcsok);
      assert.equal(await alkalom(p), vart);
      await ctx.close();
    });
  }

  test('a program: 6 fizetos alkalom, 2 ajandek; a sorrend nem szamit; a kijelolt legdragabb a teljes ar', async () => {
    const { p, ctx } = await nyit();
    await kivalaszt(p, 'honalj', 'lab'); // az olcsobb elobb
    assert.equal(await alkalom(p), 68500);
    assert.equal(szamjegy(await p.textContent('.sz-program b')), 68500 * 6);
    assert.match(await p.textContent('.sz-program'), /137\s*000/); // 2 x 68 500 ajandek
    const sorok = await p.$$eval('.sz-sorok li', (l) => l.map((li) => li.textContent));
    assert.match(sorok[0], /Teljes láb.*59\s*000/);
    assert.match(sorok[1], /Hónalj.*9\s*500/);
    assert.match(await p.textContent('.sz-kedv'), /9\s*500/); // csomagkedvezmeny
    await ctx.close();
  });

  test('a szulo kijelolese kikapcsolja a tartalmazott teruleteket (nincs dupla szamolas)', async () => {
    const { p, ctx } = await nyit();
    await kivalaszt(p, 'szar', 'comb');
    assert.equal(await alkalom(p), 35000 + 17500);
    await kivalaszt(p, 'lab');
    assert.equal(await alkalom(p), 59000);
    assert.equal(await p.locator('.sz-chip[data-kulcs="szar"]').isDisabled(), true);
    assert.equal(await p.locator('.sz-chip[data-kulcs="comb"]').getAttribute('aria-pressed'), 'false');
    await kivalaszt(p, 'lab'); // levesszuk
    assert.equal(await p.locator('.sz-chip[data-kulcs="szar"]').isDisabled(), false);
    await ctx.close();
  });

  test('a gomb: egy teruletnel arra foglal, tobbnel az egyedi csomagra', async () => {
    const { p, ctx } = await nyit();
    await kivalaszt(p, 'honalj');
    assert.equal(await p.getAttribute('#szamolo-tartalom a[data-terulet]', 'data-terulet'), 'honalj');
    await kivalaszt(p, 'intim');
    assert.equal(await p.getAttribute('#szamolo-tartalom a[data-terulet]', 'data-terulet'), 'egyedi');
    await ctx.close();
  });

  test('ures allapot: nincs eredmeny, az osszegsav rejtett', async () => {
    const { p, ctx } = await nyit({ mobil: true });
    assert.match(await p.textContent('#szamolo-tartalom'), /Válassz legalább egy területet/);
    assert.equal(await p.locator('.sz-sav').isHidden(), true);
    await p.click('.sz-chip[data-kulcs="honalj"]');
    assert.equal(await p.locator('.sz-sav').isVisible(), true);
    assert.match(await p.textContent('.sz-sav'), /19\s*000/);
    await ctx.close();
  });
});

describe('idopont-valaszto (hamisitott Salonic-API)', () => {
  const kell = (p) => p.waitForSelector('#slotok a.slot');
  // az azonos napi idopontok linkje azonos (a startDate a nap kezdete): a cimkeket hasonlitjuk
  const hrefek = (p) => p.$$eval('#slotok a.slot', (l) => l.map((a) => a.href));
  const cimkek = (p) => p.$$eval('#slotok a.slot', (l) => l.map((a) => a.textContent));

  test('az alapertelmezett Honalj elso szabad idopontjait mutatja, a foglalo-linkkel (serviceId = Honalj elso alkalom)', async () => {
    const hivasok = [];
    const { p, ctx } = await nyit({ api: (u) => { hivasok.push(new URL(u).searchParams); return idok(...SLOTOK); } });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    const h = await hrefek(p);
    assert.equal(h.length, 3);
    for (const x of h) assert.match(x, /^https:\/\/mosaic-elysion\.salonic\.hu\/selectDate\/\?employeeId=32417&placeId=14586&serviceId=476488&startDate=\d+$/);
    assert.equal(hivasok[0].get('serviceId'), '476488');
    assert.equal(hivasok[0].get('placeId'), '14586');
    assert.equal(await p.getAttribute('#tovabbi-idopontok', 'href'), 'https://mosaic-elysion.salonic.hu/selectDate/?employeeId=32417&placeId=14586&serviceId=476488');
    // a cimke: datum + ido, a legkorabbi elso
    const elso = await p.textContent('#slotok a.slot:first-child');
    assert.match(elso, /\d{2}:\d{2}/);
    await ctx.close();
  });

  test('terulet-csere: uj lekeres az uj kezeleshez; a "Hónalj + intim" a Basic csomag; a legordulo a tobbi teruletet is tudja', async () => {
    const hivott = [];
    const { p, ctx } = await nyit({ api: (u) => { hivott.push(new URL(u).searchParams.get('serviceId')); return idok(...SLOTOK); } });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    await p.click('#terulet-chipek .chip[data-terulet="intim"]');
    await p.waitForFunction(() => /serviceId=476493/.test(document.querySelector('#slotok a.slot')?.href || ''));
    await p.click('#terulet-chipek .chip[data-terulet="basic"]');
    await p.waitForFunction(() => /serviceId=476479/.test(document.querySelector('#slotok a.slot')?.href || ''));
    await p.selectOption('#terulet-select', 'kar');
    await p.waitForFunction(() => /serviceId=476491/.test(document.querySelector('#slotok a.slot')?.href || ''));
    assert.equal(await p.locator('#terulet-chipek .chip[aria-pressed="true"]').count(), 0, 'a legordulo valasztasakor a chipek kikapcsolnak');
    await p.click('#terulet-chipek .chip[data-terulet="egyedi"]');
    await p.waitForFunction(() => /serviceId=476478/.test(document.querySelector('#slotok a.slot')?.href || ''));
    assert.ok(hivott.includes('476493') && hivott.includes('476479') && hivott.includes('476491') && hivott.includes('476478'), hivott.join());
    await ctx.close();
  });

  test('ingyenes konzultacio: a teruletvalaszto elrejtozik, a konzultacios szolgaltatas idopontjai latszanak', async () => {
    const { p, ctx } = await nyit({ api: () => idok(...SLOTOK) });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    await p.check('input[name="mod"][value="konzult"]');
    await p.waitForFunction(() => /serviceId=476477/.test(document.querySelector('#slotok a.slot')?.href || ''));
    assert.equal(await p.locator('#lepes-terulet').isHidden(), true);
    assert.equal(await p.textContent('#lepes-idopont .szam'), '2');
    await p.check('input[name="mod"][value="kezeles"]');
    assert.equal(await p.locator('#lepes-terulet').isVisible(), true);
    assert.equal(await p.textContent('#lepes-idopont .szam'), '3');
    await ctx.close();
  });

  test('a nyil lapoz a tovabbi idopontokra, korbefordul', async () => {
    const { p, ctx } = await nyit({ api: () => idok(...SLOTOK) });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    const elso = await cimkek(p);
    await p.click('#slot-tovabb');
    const masodik = await cimkek(p);
    assert.notDeepEqual(masodik, elso);
    assert.equal(masodik.length, 3);
    await p.click('#slot-tovabb'); // 7 idopont: a 3. oldalon csak 1 marad
    assert.equal((await cimkek(p)).length, 1);
    await p.click('#slot-tovabb');
    assert.deepEqual(await cimkek(p), elso);
    await ctx.close();
  });

  test('ha nincs szabad idopont, uzenet + a foglalorendszer linkje; nem talal ki idopontot', async () => {
    const { p, ctx } = await nyit({ api: () => idok() });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await p.waitForSelector('#slot-uzenet:not([hidden])');
    assert.match(await p.textContent('#slot-uzenet'), /nincs szabad időpont/);
    assert.equal(await p.locator('#slotok a.slot').count(), 0);
    await ctx.close();
  });

  test('API-hiba: nyugodt uzenet, link a foglalorendszerhez; a naptar-azonosito valtozasat is kezeli', async () => {
    // 1) vegleges hiba
    let { p, ctx } = await nyit({ api: () => ({ status: 'error' }) });
    await p.route('https://mosaic-elysion.salonic.hu/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<html>nincs naptar</html>' }));
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await p.waitForSelector('#slot-uzenet:not([hidden])');
    assert.match(await p.textContent('#slot-uzenet'), /Most nem sikerült lekérni/);
    await ctx.close();
    // 2) a regi naptar-azonosito mar nem jo: a Salonic oldalarol kiolvasott ujjal sikerul
    const hasznalt = [];
    ({ p, ctx } = await nyit({ api: (u) => { const id = new URL(u).searchParams.get('calendarId'); hasznalt.push(id); return id === 'uj-naptar-id' ? idok(...SLOTOK) : { status: 'error' }; } }));
    await p.route('https://mosaic-elysion.salonic.hu/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: "<script>var x = { calendarId: 'uj-naptar-id' }</script>" }));
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await p.waitForSelector('#slotok a.slot');
    assert.deepEqual(hasznalt.slice(0, 2), ['02742cf7-07cb-a3ef-fc7c-b871c86ce163', 'uj-naptar-id']);
    await ctx.close();
  });
});

describe('osszekottetesek', () => {
  test('a data-terulet gombok (arlista, kartyak, kalkulator) a valasztot az adott teruletre allitjak es oda gorgetnek', async () => {
    const { p, ctx } = await nyit({ api: () => idok(...SLOTOK) });
    await p.click('.ar-csoport tr[data-kulcs="lab"] a[data-terulet]');
    await p.waitForFunction(() => document.querySelector('#terulet-chipek .chip[data-terulet="lab"]').getAttribute('aria-pressed') === 'true');
    await p.waitForFunction(() => /serviceId=476496/.test(document.querySelector('#slotok a.slot')?.href || ''));
    // sima gorgetes: megvarjuk, mig a foglalo a kepernyo tetejere er
    await p.waitForFunction(() => { const t = document.getElementById('foglalo').getBoundingClientRect().top; return t < 200 && t > -100; }, null, { timeout: 8000 });
    await ctx.close();
  });

  test('a "Tudj meg tobbet" / "Kinek nem javasolt" gombok kinyitjak a megfelelo GYIK-elemet', async () => {
    const { p, ctx } = await nyit();
    for (const [gomb, id] of [['garancia', 'gyik-garancia'], ['fenntarto', 'gyik-fenntarto'], ['kinek-nem', 'gyik-kinek-nem']]) {
      await p.click(`a[data-gyik="${gomb}"]`);
      assert.equal(await p.evaluate((i) => document.getElementById(i).open, id), true, id);
    }
    await ctx.close();
  });

  test('a konzultacios gombok a Salonic ingyenes konzultacio szolgaltatasara mutatnak (elonezeten a foglalo-retegre kotve)', async () => {
    const { p, ctx } = await nyit();
    const h = await p.$$eval('a[href*="serviceId=476477"], a[href*="service=konzult"]', (l) => l.map((a) => a.getAttribute('href')));
    assert.ok(h.length >= 4, 'konzultacios gombok: ' + h.length);
    for (const x of h) assert.match(x, /serviceId=476477|business=laser/);
    await ctx.close();
  });
});
