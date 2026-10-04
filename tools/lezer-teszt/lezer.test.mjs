// A /lezeres-szortelenites-budapest-uj landing tesztjei bongeszoben (Playwright), a helyi dist/ ellen. Kulso halozati forgalom nincs:
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
const OLDAL = '/lezeres-szortelenites-budapest-uj';
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
  assert.ok(fs.existsSync(path.join(GYOKER, 'dist', '_a', 'lezeres-szortelenites-budapest-uj.html')), 'Eloszor: node tools/netlify-build.mjs');
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
    assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'), 'https://www.mosaicheadspa.hu/lezeres-szortelenites-budapest-uj');
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
    const html = fs.readFileSync(path.join(GYOKER, 'foglalas', 'lezeres-szortelenites-budapest-uj.html'), 'utf8');
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
  const kapcsol = async (p, ...kulcsok) => { for (const k of kulcsok) await p.click(`.sz-chip[data-kulcs="${k}"]`); };
  const uresit = async (p) => kapcsol(p, ...ALAP); // az alapbol kijelolt teruletek levetele
  const alkalom = async (p) => szamjegy(await p.textContent('.sz-ossz b'));
  const ALAP = ['lab', 'honalj', 'intim'];

  test('alapbol nehany terulet ki van jelolve (hogy lassa, hogy kalkulator): lab + honalj + intim = 86 500; az elso kezeles 20% kedvezmennyel: 69 200', async () => {
    const { p, ctx } = await nyit();
    for (const k of ALAP) assert.equal(await p.getAttribute(`.sz-chip[data-kulcs="${k}"]`, 'aria-pressed'), 'true', k);
    assert.equal(await alkalom(p), 59000 + 9500 + 18000);
    assert.equal(szamjegy(await p.textContent('.sz-elso b')), 69200);
    assert.match(await p.textContent('.sz-elso'), /20% kedvezménnyel/);
    assert.ok(await p.locator('.kezirat').isVisible(), 'nyilas / kezirasos felhivas a kalkulator felett');
    assert.ok(await p.locator('.szamolo-ikon').isVisible(), 'kalkulator-ikon');
    await ctx.close();
  });

  test('nincs "tajekoztato szamitas" felirat (ez vegleges ar)', async () => {
    const { p, ctx } = await nyit();
    const szoveg = await p.textContent('#szamolo');
    assert.ok(!/tájékoztató/i.test(szoveg), 'tajekoztato');
    await ctx.close();
  });

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
      await uresit(p);
      await kapcsol(p, ...kulcsok);
      assert.equal(await alkalom(p), vart);
      await ctx.close();
    });
  }

  test('a program: 6 fizetos alkalom, 2 ajandek; a sorrend nem szamit; a legdragabb a teljes ar', async () => {
    const { p, ctx } = await nyit();
    await uresit(p);
    await kapcsol(p, 'honalj', 'lab'); // az olcsobb elobb
    assert.equal(await alkalom(p), 68500);
    assert.equal(szamjegy(await p.textContent('.sz-program b')), 68500 * 6);
    assert.match(await p.textContent('.sz-program'), /137\s*000/); // 2 x 68 500 ajandek
    const sorok = await p.$$eval('.sz-sorok li', (l) => l.map((li) => li.textContent));
    assert.match(sorok[0], /Teljes láb.*59\s*000/);
    assert.match(sorok[1], /Hónalj.*9\s*500/);
    assert.match(await p.textContent('.sz-kedv'), /9\s*500/); // csomagkedvezmeny
    assert.equal(szamjegy(await p.textContent('.sz-elso b')), 68500 * 0.8);
    await ctx.close();
  });

  test('a szulo kijelolese kikapcsolja a tartalmazott teruleteket (nincs dupla szamolas)', async () => {
    const { p, ctx } = await nyit();
    await uresit(p);
    await kapcsol(p, 'szar', 'comb');
    assert.equal(await alkalom(p), 35000 + 17500);
    await kapcsol(p, 'lab');
    assert.equal(await alkalom(p), 59000);
    assert.equal(await p.locator('.sz-chip[data-kulcs="szar"]').isDisabled(), true);
    assert.equal(await p.locator('.sz-chip[data-kulcs="comb"]').getAttribute('aria-pressed'), 'false');
    await kapcsol(p, 'lab'); // levesszuk
    assert.equal(await p.locator('.sz-chip[data-kulcs="szar"]').isDisabled(), false);
    await ctx.close();
  });

  test('a gomb: egy teruletnel arra foglal, tobbnel az egyedi csomagra', async () => {
    const { p, ctx } = await nyit();
    await uresit(p);
    await kapcsol(p, 'honalj');
    assert.equal(await p.getAttribute('#szamolo-tartalom a[data-terulet]', 'data-terulet'), 'honalj');
    await kapcsol(p, 'intim');
    assert.equal(await p.getAttribute('#szamolo-tartalom a[data-terulet]', 'data-terulet'), 'egyedi');
    await ctx.close();
  });

  test('ha mindent levesz: nincs eredmeny, az osszegsav rejtett; telefonon az osszegsav latszik a kijeloleseknel', async () => {
    const { p, ctx } = await nyit({ mobil: true });
    assert.equal(await p.locator('.sz-sav').isVisible(), true);
    assert.match(await p.textContent('.sz-sav'), /86\s*500/);
    await uresit(p);
    assert.match(await p.textContent('#szamolo-tartalom'), /Válassz legalább egy területet/);
    assert.equal(await p.locator('.sz-sav').isHidden(), true);
    await ctx.close();
  });
});

describe('idopont-valaszto: naptar (hamisitott Salonic-API)', () => {
  const kell = (p) => p.waitForSelector('#naptar button.naptar-nap');
  const idoLinkek = (p) => p.$$eval('#idok a.ido', (l) => l.map((a) => a.href));
  const idoCimkek = (p) => p.$$eval('#idok a.ido', (l) => l.map((a) => a.textContent));

  test('naptart mutat (nem "tovabbi idopontok" gombot): az elso szabad nap alapbol kijelolve, a napok idopontjai latszanak, a hónap neve + lapozo', async () => {
    const hivasok = [];
    const { p, ctx } = await nyit({ api: (u) => { hivasok.push(new URL(u).searchParams); return idok(...SLOTOK); } });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    assert.equal(await p.locator('#tovabbi-idopontok').count(), 0, 'nincs "További időpontok" gomb');
    assert.equal(await p.locator('#naptar .naptar-racs').count(), 1);
    assert.match(await p.textContent('#naptar .naptar-fej b'), /\d{4}\. \p{L}+/u);
    assert.equal(await p.locator('#naptar button.naptar-nap[aria-pressed="true"]').count(), 1, 'az elso szabad nap kijelolve');
    assert.equal(await p.locator('#naptar .naptar-hetnap').count(), 7);
    // az idopontok a kivalasztott nap idopontjai, kozvetlenul a foglalasi adatlapra mutatnak (az idopont benne van)
    const linkek = await idoLinkek(p);
    assert.ok(linkek.length >= 1);
    assert.equal(await p.locator('#idok a.ido[target]').count(), 0, 'az idopont nem nyilik uj lapon / felugroban (a helyben nyilo uj motor lesz itt)');
    for (const x of linkek) assert.match(x, /^https:\/\/mosaic-elysion\.salonic\.hu\/guestData\/\?anyone=true&employeeId=32417&placeId=14586&serviceId=476488&startDate=\d+&back=$/);
    assert.equal(hivasok[0].get('serviceId'), '476488');
    assert.equal(hivasok[0].get('placeId'), '14586');
    await ctx.close();
  });

  test('csak a szabad napok kattinthatok; masik napra kattintva annak az idopontjai latszanak, a link pontosan az idopont idobelyege', async () => {
    const nap2 = holnap + 3 * 86400; // egy masik nap
    const { p, ctx } = await nyit({ api: () => idok(holnap, holnap + 3600, nap2, nap2 + 1800) });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    const szabad = await p.$$eval('#naptar button.naptar-nap', (l) => l.length);
    assert.equal(szabad, 2, 'ket szabad nap');
    assert.ok((await p.locator('#naptar span.naptar-nap').count()) >= 20, 'a tobbi nap nem kattinthato');
    const elsoLinkek = await idoLinkek(p);
    assert.equal(elsoLinkek.length, 2);
    assert.ok(elsoLinkek[0].includes(`startDate=${holnap}&`) && elsoLinkek[1].includes(`startDate=${holnap + 3600}&`));
    await p.click('#naptar button.naptar-nap[aria-pressed="false"]');
    await p.waitForFunction((t) => document.querySelector('#idok a.ido')?.href.includes('startDate=' + t), nap2);
    const masodik = await idoLinkek(p);
    assert.equal(masodik.length, 2);
    assert.ok(masodik[1].includes(`startDate=${nap2 + 1800}&`));
    assert.equal(await p.locator('#naptar button.naptar-nap[aria-pressed="true"]').count(), 1);
    await ctx.close();
  });

  test('a honap-lapozo: tobb honapnyi szabad nap eseten lapoz; az elso / utolso honapnal tiltott', async () => {
    const harom = holnap + 40 * 86400; // ~ 1-2 honappal kesobb
    const { p, ctx } = await nyit({ api: () => idok(holnap, harom) });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    const elsoHo = await p.textContent('#naptar .naptar-fej b');
    assert.equal(await p.locator('.naptar-lapoz').first().isDisabled(), true, 'az elso honap elott nincs mit');
    await p.locator('.naptar-lapoz').last().click();
    const masodikHo = await p.textContent('#naptar .naptar-fej b');
    assert.notEqual(masodikHo, elsoHo);
    await p.locator('.naptar-lapoz').first().click();
    assert.equal(await p.textContent('#naptar .naptar-fej b'), elsoHo);
    await ctx.close();
  });

  test('terulet-csere: uj lekeres az uj kezeleshez; a "Honalj + intim" a Basic csomag; a legordulo a tobbi teruletet is tudja', async () => {
    const hivott = [];
    const { p, ctx } = await nyit({ api: (u) => { hivott.push(new URL(u).searchParams.get('serviceId')); return idok(...SLOTOK); } });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    const vart = (id) => p.waitForFunction((x) => document.querySelector('#idok a.ido')?.href.includes('serviceId=' + x), id);
    assert.equal(await p.locator('#terulet-chipek, .chip').count(), 0, 'nincsenek csempek / gombok a teruletvalasztonal, csak a legordulo');
    await p.selectOption('#terulet-select', 'intim');
    await vart('476493');
    await p.selectOption('#terulet-select', 'basic');
    await vart('476479');
    await p.selectOption('#terulet-select', 'kar');
    await vart('476491');
    await p.selectOption('#terulet-select', 'egyedi');
    await vart('476478');
    assert.ok(hivott.includes('476493') && hivott.includes('476479') && hivott.includes('476491') && hivott.includes('476478'), hivott.join());
    await ctx.close();
  });

  test('ingyenes konzultacio: a teruletvalaszto elrejtozik, a konzultacios szolgaltatas idopontjai latszanak', async () => {
    const { p, ctx } = await nyit({ api: () => idok(...SLOTOK) });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    await p.check('input[name="mod"][value="konzult"]');
    await p.waitForFunction(() => /serviceId=476477/.test(document.querySelector('#idok a.ido')?.href || ''));
    assert.equal(await p.locator('#lepes-terulet').isHidden(), true);
    assert.equal(await p.textContent('#lepes-idopont .szam'), '2');
    await p.check('input[name="mod"][value="kezeles"]');
    assert.equal(await p.locator('#lepes-terulet').isVisible(), true);
    assert.equal(await p.textContent('#lepes-idopont .szam'), '3');
    await ctx.close();
  });

  test('ha nincs szabad idopont, uzenet + a foglalorendszer linkje; nem talal ki idopontot', async () => {
    const { p, ctx } = await nyit({ api: () => idok() });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await p.waitForSelector('#slot-uzenet:not([hidden])');
    assert.match(await p.textContent('#slot-uzenet'), /nincs szabad időpont/);
    assert.equal(await p.locator('#naptar button.naptar-nap').count(), 0);
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
    await p.waitForSelector('#naptar button.naptar-nap');
    assert.deepEqual(hasznalt.slice(0, 2), ['02742cf7-07cb-a3ef-fc7c-b871c86ce163', 'uj-naptar-id']);
    await ctx.close();
  });

  test('a naptar telefonon (390 px) is elfer, nincs vizszintes gorgetes', async () => {
    const { p, ctx } = await nyit({ mobil: true, api: () => idok(...SLOTOK) });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await kell(p);
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, nap: document.querySelector('#naptar .naptar-nap').getBoundingClientRect().width }));
    assert.ok(m.sw <= m.iw, `scrollWidth ${m.sw} > ${m.iw}`);
    assert.ok(m.nap >= 30, 'a napok erintheto meretuek: ' + m.nap);
    await ctx.close();
  });
});

describe('osszekottetesek', () => {
  test('a data-terulet gombok (arlista, kartyak, kalkulator) a valasztot az adott teruletre allitjak es oda gorgetnek', async () => {
    const { p, ctx } = await nyit({ api: () => idok(...SLOTOK) });
    await p.click('.ar-csoport tr[data-kulcs="lab"] a[data-terulet]');
    await p.waitForFunction(() => document.getElementById('terulet-select').value === 'lab');
    await p.waitForFunction(() => /serviceId=476496/.test(document.querySelector('#idok a.ido')?.href || ''));
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

describe('az uj tartalom (visszajelzesek alapjan)', () => {
  test('nincs felcim: nincs arany cim a fo cim felett sehol', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('.felcim').count(), 0);
    await ctx.close();
  });

  test('a cim "garanciaval", az alcim a vilag egyik legerosebb lezerrel, alkalmankent fizetes, 4. es 8. ajandek, fenntarto kezelesek orokre felaron', async () => {
    const { p, ctx } = await nyit();
    assert.equal((await p.textContent('h1')).trim(), 'Lézeres szőrtelenítés Budapesten garanciával');
    const al = await p.textContent('.hero-al');
    assert.match(al, /világ egyik legerősebb/);
    assert.match(al, /Elysion Pro/);
    assert.match(al, /többszázezres előrefizetés/);
    assert.match(al, /alkalmanként fizetsz/);
    assert.match(al, /4\. és a 8\. alkalom ajándék/);
    assert.match(al, /fenntartó kezelések pedig örökre féláron/);
    await ctx.close();
  });

  test('a 4,9/5 komoly: a pontos ertekelesszammal, kattinthato, a velemenyekhez gorget', async () => {
    const { p, ctx } = await nyit();
    const g = p.locator('.hero .google-nagy');
    assert.match(await g.textContent(), /4,9/);
    assert.match(await g.textContent(), /\/5/);
    assert.match(await g.textContent(), /1\s257\s+Google-vélemény/);
    assert.equal(await g.getAttribute('href'), '#velemenyek');
    await g.click();
    await p.waitForFunction(() => { const t = document.getElementById('velemenyek').getBoundingClientRect().top; return t < 200 && t > -150; }, null, { timeout: 8000 });
    await ctx.close();
  });

  test('a testtaji kartyak abrak (nem fotok): 4 abra, mindegyiken kiemelt terulettel', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('.gyors-kartya svg.abra').count(), 4);
    assert.equal(await p.locator('.gyors-kartya img').count(), 0);
    const kiemelesek = await p.$$eval('.gyors-kartya', (l) => l.map((a) => [...a.querySelectorAll('svg.abra use')].map((u) => u.getAttribute('href')).join('+')));
    assert.deepEqual(kiemelesek, ['#abra-alak+#abra-honalj', '#abra-alak+#abra-intim', '#abra-alak+#abra-honalj+#abra-intim', '#abra-alak+#abra-lab']);
    await ctx.close();
  });

  test('az elso kezeles 20% kedvezmenyerol tobb helyen szol az oldal', async () => {
    const { p, ctx } = await nyit();
    const szoveg = await p.textContent('main');
    assert.ok((szoveg.match(/20% kedvezmén/g) || []).length >= 5, 'a 20% kedvezmeny tobb helyen szerepel');
    assert.match(await p.textContent('.hero-bizalom'), /20% kedvezmény/);
    assert.match(await p.textContent('#arlista .arlista-bevezeto'), /első kezelés 20% kedvezménnyel/);
    await ctx.close();
  });

  test('az arlista olvashato: egy dobozban, fix oszlopokkal; minden sor egy vonalba esik', async () => {
    const { p, ctx } = await nyit();
    const oszlopok = await p.$$eval('#arlista .ar-csoport tbody tr', (l) => [...new Set(l.map((tr) => Math.round(tr.querySelector('.ar-egy').getBoundingClientRect().right)))]);
    assert.equal(oszlopok.length, 1, 'az alkalmankenti ar oszlopa mindenhol ugyanott vegzodik: ' + oszlopok);
    const prog = await p.$$eval('#arlista .ar-csoport tbody tr', (l) => [...new Set(l.map((tr) => Math.round(tr.querySelector('.ar-prog').getBoundingClientRect().right)))]);
    assert.equal(prog.length, 1);
    assert.ok(await p.locator('#arlista .ar-fejlec').isVisible());
    const meret = await p.$eval('#arlista tbody th', (e) => parseFloat(getComputedStyle(e).fontSize));
    assert.ok(meret >= 16, 'a terulet neve legalabb 16 px: ' + meret);
    await ctx.close();
  });

  test('Google terkep: nincs nagy statikus terkepkep; sutik nelkul a gombra toltodik be a Google terkep', async () => {
    const { p, ctx, kulso } = await nyit();
    const html = await p.content();
    assert.ok(!html.includes('3d447a4483a54782920eee5bd468b1b5'), 'a regi statikus terkepkep kikerult');
    assert.equal(await p.locator('#terkep iframe').count(), 0, 'sutik nelkul nincs iframe');
    await p.click('#terkep-gomb');
    await p.waitForSelector('#terkep iframe');
    assert.match(await p.getAttribute('#terkep iframe', 'src'), /^https:\/\/www\.google\.com\/maps\?q=.*output=embed$/);
    assert.equal(await p.locator('#terkep-hely').count(), 0);
    assert.ok(kulso.some((u) => /google\.com\/maps/.test(u)), 'a Google terkep kerese elindult');
    await ctx.close();
  });
});

describe('a harmadik kor visszajelzesei', () => {
  test('a hero Google-gombja kicsi (nem nagy doboz)', async () => {
    const { p, ctx } = await nyit();
    const m = await p.$eval('.hero .google-nagy', (e) => { const r = e.getBoundingClientRect(); return { sz: r.width, m: r.height }; });
    assert.ok(m.m <= 52, 'a gomb magassaga legfeljebb 52 px: ' + m.m);
    assert.ok(m.sz <= 360, 'a gomb szelessege legfeljebb 360 px: ' + m.sz);
    await ctx.close();
  });

  test('a velemenyek az eredeti Trustindex-embed: sutik nelkul helykitolto + gomb, a gomb betolti az embedet (a fooldal / ajandekkartya oldal beagyazasa)', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('#velemenyek .vel').count(), 0, 'nincsenek sajat (kezzel irt) kartyak');
    assert.equal(await p.locator('#ti-hely').isVisible(), true);
    assert.equal(await p.locator('#trustindex iframe').count(), 0, 'sutik nelkul nincs kulso tartalom');
    await p.click('#ti-gomb');
    await p.waitForSelector('#trustindex iframe.ti-keret');
    assert.equal(await p.getAttribute('#trustindex iframe', 'src'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    assert.equal(await p.locator('#ti-hely').count(), 0);
    await ctx.close();
  });

  test('foglalo: nincs teruletcsempe, csak a legordulo; a kartya kompakt (a regi ~600 px helyett legfeljebb ~380 px)', async () => {
    const { p, ctx } = await nyit({ api: () => idok(...SLOTOK) });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await p.waitForSelector('#naptar button.naptar-nap');
    assert.equal(await p.locator('#terulet-select').isVisible(), true);
    assert.equal(await p.locator('#foglalo .chip').count(), 0);
    const h = await p.$eval('#foglalo', (e) => e.getBoundingClientRect().height);
    assert.ok(h <= 400, 'a foglalo kartya magassaga: ' + h);
    await ctx.close();
  });

  test('a kalkulator bal es jobb doboza egyforma magas; ikonok a gombokon es az arlistaban', async () => {
    const { p, ctx } = await nyit();
    const m = await p.$$eval('.szamolo-valaszto, .szamolo-eredmeny', (l) => l.map((e) => Math.round(e.getBoundingClientRect().height)));
    assert.equal(m[0], m[1], 'a ket doboz magassaga: ' + m);
    assert.equal(await p.locator('#szamolo-valaszto .sz-chip svg.ti').count(), 17, 'minden gombon ikon');
    assert.ok((await p.locator('#szamolo-tartalom .sz-sorok svg.ti').count()) >= 3, 'az eredmeny soraiban is ikon');
    assert.equal(await p.locator('#arlista tbody tr .sor-ikon svg.ti').count(), 22, 'az arlista minden soraban ikon');
    assert.equal(await p.locator('#arlista .csoport-ikon svg.ti').count(), 7, 'az arlista minden csoportjanal ikon');
    await ctx.close();
  });

  test('a kalkulator alatti megjegyzes: fix ar + 8-bol 6 fizetos, 2 ajandek; a nyil a felirat UTAN van', async () => {
    const { p, ctx } = await nyit();
    const lab = await p.textContent('.sz-lab');
    assert.match(lab, /program végéig fix/);
    assert.match(lab, /8 alkalomból csak 6-ot fizetsz, 2 alkalom ajándék/);
    const sorrend = await p.$eval('.kezirat', (e) => [...e.children].map((c) => c.tagName.toLowerCase()));
    assert.deepEqual(sorrend, ['span', 'svg'], 'elobb a felirat (Probald ki...), utana a nyil');
    assert.match(await p.textContent('.kezirat span'), /^Próbáld ki az árkalkulátort/);
    await ctx.close();
  });

  test('az arlistaban a "8 alkalmas program" oszlop kozepre rendezett, az Idopont gombok aranyszinuek', async () => {
    const { p, ctx } = await nyit();
    const fej = await p.$eval('.ar-fejlec span:nth-child(4)', (e) => { const r = e.getBoundingClientRect(); return { kozep: Math.round(r.left + r.width / 2), align: getComputedStyle(e).textAlign }; });
    assert.equal(fej.align, 'center');
    const ertekek = await p.$$eval('#arlista tbody td.ar-prog', (l) => l.map((e) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return Math.round(b.left + b.width / 2); }));
    for (const k of ertekek) assert.ok(Math.abs(k - fej.kozep) <= 3, `a program-ertek kozepe ${k} vs fejlec ${fej.kozep}`);
    const hatterek = await p.$$eval('#arlista a.gomb-bezs', (l) => [...new Set(l.map((e) => getComputedStyle(e).backgroundImage))]);
    assert.equal(hatterek.length, 1);
    assert.match(hatterek[0], /linear-gradient/);
    assert.ok(/rgb\(19\d, 16\d, 70\)|rgb\(198, 163, 70\)/.test(hatterek[0]), 'arany: ' + hatterek[0]);
    await ctx.close();
  });

  test('helyszin: a terkep + a szalon kepe egyutt pontosan olyan magas, mint a bal oldali doboz', async () => {
    const { p, ctx } = await nyit();
    const m = await p.$eval('.helyszin-racs', (r) => { const b = r.querySelector('.hely-szoveg').getBoundingClientRect(); const j = r.querySelector('.hely-kepek').getBoundingClientRect(); return [Math.round(b.height), Math.round(j.height), Math.round(b.top), Math.round(j.top)]; });
    assert.ok(Math.abs(m[0] - m[1]) <= 2, 'bal ' + m[0] + ' vs jobb ' + m[1]);
    assert.equal(m[2], m[3], 'a ket oszlop teteje azonos');
    await ctx.close();
  });

  test('Zsofi: lejatszhato konzultacios video (kattintasra tolt be), nincs vegleges kep helyette; galeria nagyitassal', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('#zsofi-video').isVisible(), true);
    assert.equal(await p.locator('#zsofi video').count(), 0, 'a video csak kattintasra toltodik be');
    const forras = await p.getAttribute('#zsofi-video', 'data-video');
    assert.equal(forras, '/assets/video/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0.mp4');
    const hanyas = await p.evaluate(async (u) => (await fetch(u, { method: 'HEAD' })).status, forras);
    assert.equal(hanyas, 200, 'a video fajl elerheto');
    await p.click('#zsofi-video');
    await p.waitForSelector('#zsofi video[controls]');
    assert.equal(await p.getAttribute('#zsofi video source', 'src'), forras);
    // galeria
    assert.ok((await p.locator('.galeria-kep').count()) >= 4);
    await p.locator('.galeria-kep').first().scrollIntoViewIfNeeded();
    await p.click('.galeria-kep >> nth=1');
    await p.waitForSelector('dialog.nagyito[open] img');
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('dialog.nagyito[open]').count(), 0);
    await ctx.close();
  });

  test('telefonon (390 px) nincs vizszintes gorgetes az uj elemekkel sem', async () => {
    const { p, ctx } = await nyit({ mobil: true, api: () => idok(...SLOTOK) });
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await p.waitForSelector('#naptar button.naptar-nap');
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    assert.ok(m.sw <= m.iw, `scrollWidth ${m.sw} > ${m.iw}`);
    await ctx.close();
  });
});
