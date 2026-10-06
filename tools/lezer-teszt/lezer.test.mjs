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
    assert.equal(await p.locator('meta[name=robots]').count(), 0, 'eles oldal: indexelheto (nincs noindex)');
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
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth }));
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
    const sorok = await p.$$eval('#arlista tr[data-kulcs]', (l) => l.map((tr) => ({ k: tr.dataset.kulcs, ar: +tr.dataset.ar, elso: tr.dataset.elso, egy: (() => { const c = tr.querySelector('.ar-egy').cloneNode(true); c.querySelectorAll('s').forEach((x) => x.remove()); return c.textContent; })(), prog: tr.querySelector('.ar-prog').textContent })));
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
    assert.equal(await p.locator('#slot-uzenet a').getAttribute('href'), '/foglalo-motor?business=laser&intent=first', 'a link a foglalo-motorra mutat (nem kozvetlen Salonic-link)');
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
    assert.equal(await p.locator('#slot-uzenet a').getAttribute('href'), '/foglalo-motor?business=laser&intent=first', 'a link a foglalo-motorra mutat (nem kozvetlen Salonic-link)');
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
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth, nap: document.querySelector('#naptar .naptar-nap').getBoundingClientRect().width }));
    assert.ok(m.sw <= m.iw, `scrollWidth ${m.sw} > ${m.iw}`);
    assert.ok(m.nap >= 30, 'a napok erintheto meretuek: ' + m.nap);
    await ctx.close();
  });
});

describe('osszekottetesek', () => {
  test('a data-terulet gombok (kartyak, kalkulator) a valasztot az adott teruletre allitjak es oda gorgetnek', async () => {
    const { p, ctx } = await nyit({ api: () => idok(...SLOTOK) });
    await p.click('.gyors-kartya[data-terulet="lab"]');
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
    assert.equal((await p.textContent('h1')).trim(), 'Lézeres szőrtelenítés 12 hónap garanciával');
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

  test('a testtaji kartyak a latvanyterv illusztralt kepeit hasznaljak (nem sajat rajz, nem foto)', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('.gyors-kartya svg').count(), 0, 'nincs sajat rajzolt SVG');
    const kepek = await p.$$eval('.gyors-kartya', (l) => l.map((a) => [...a.querySelectorAll('.abra-kep img')].map((i) => i.getAttribute('src').split('/').pop()).join('+')));
    assert.deepEqual(kepek, ['kartya-honalj.jpg', 'kartya-intim.jpg', 'kartya-honalj_intim.jpg', 'kartya-lab.jpg']);
    await ctx.close();
  });

  test('az elso kezeles 20% kedvezmenyerol tobb helyen szol az oldal', async () => {
    const { p, ctx } = await nyit();
    const szoveg = await p.textContent('main');
    assert.ok((szoveg.match(/20% kedvezmén/g) || []).length >= 3, 'a 20% kedvezmeny tobb helyen szerepel (de nem ismetlodik folosleg)');
    assert.match(await p.textContent('.hero-bizalom'), /20% kedvezmény/);
    assert.ok(!/20% kedvezmény/.test(await p.textContent('#arlista .arlista-bevezeto')), 'az arlista bevezetojeben nincs 20%-os mondat');
    assert.ok(!/20% kedvezmény/.test(await p.textContent('.program')), 'a 8 kezeles szekcioban nincs 20%-os mondat');
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
    const sz = await p.$eval('#foglalo', (e) => e.getBoundingClientRect().width);
    assert.ok(sz <= 880, 'a foglalo kartya szelessege (kisebb doboz): ' + sz);
    // a naptar nem szetnyomott: negyzet alapu napok, szuk naptar
    const nap = await p.$$eval('#naptar .naptar-nap', (l) => l.slice(0, 12).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    for (const [w, hh] of nap) assert.ok(Math.abs(w - hh) <= 1 && w >= 32, 'negyzet alapu nap: ' + w + 'x' + hh);
    const nw = await p.$eval('#naptar', (e) => e.getBoundingClientRect().width);
    assert.ok(nw <= 300, 'a naptar szelessege: ' + nw);
    await ctx.close();
  });

  test('a kalkulator bal es jobb doboza egyforma magas; ikonok a gombokon es az arlistaban', async () => {
    const { p, ctx } = await nyit();
    const m = await p.$$eval('.szamolo-valaszto, .szamolo-eredmeny', (l) => l.map((e) => Math.round(e.getBoundingClientRect().height)));
    assert.equal(m[0], m[1], 'a ket doboz magassaga: ' + m);
    assert.equal(await p.locator('#szamolo-valaszto .sz-chip img').count(), 0, 'a gomboknak nincs ikonjuk (csak a fo testtajaknak)');
    assert.equal(await p.locator('#szamolo-valaszto .sz-csoport-nev img.ti-kep').count(), 6, 'a 6 fo testtajnak (csoportnak) van ikonja');
    assert.equal(await p.locator('#szamolo-tartalom .sz-sorok img').count(), 0, 'az eredmeny soraiban nincs ikon');
    assert.equal(await p.locator('#arlista .csoport-ikon img.ti-kep').count(), 7, 'az arlista minden csoportjanal ikon');
    const forrasok = await p.$$eval('img.ti-kep', (l) => [...new Set(l.map((i) => i.getAttribute('src').split('/').pop().split('?')[0].split('-')[0]))].sort());
    assert.deepEqual(forrasok, ['cs'], 'csak a fo testtajak ikonjai (cs-)');
    assert.equal(await p.locator('svg.ti').count(), 0, 'nincs sajat rajzolt ikon');
    await ctx.close();
  });

  test('a kalkulator arai egy oszlopban (jobbra igazitva) allnak, a 8 alkalmas programe is', async () => {
    const { p, ctx } = await nyit();
    const jobb = await p.$$eval('#szamolo-tartalom .osszeg, #szamolo-tartalom .sz-ossz b, #szamolo-tartalom .sz-kedv span:last-child, #szamolo-tartalom .sz-elso b, #szamolo-tartalom .sz-program b', (l) => l.map((e) => Math.round(e.getBoundingClientRect().right)));
    assert.ok(jobb.length >= 7, 'arak: ' + jobb.length);
    assert.equal(new Set(jobb).size, 1, 'az arak jobb szele azonos: ' + [...new Set(jobb)]);
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

  test('az arlistaban a "8 alkalmas program" oszlop kozepre rendezett, nincsenek Idopont gombok', async () => {
    const { p, ctx } = await nyit();
    const fej = await p.$eval('.ar-fejlec span:nth-child(4)', (e) => { const r = e.getBoundingClientRect(); return { kozep: Math.round(r.left + r.width / 2), align: getComputedStyle(e).textAlign }; });
    assert.equal(fej.align, 'center');
    const ertekek = await p.$$eval('#arlista tbody td.ar-prog', (l) => l.map((e) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return Math.round(b.left + b.width / 2); }));
    for (const k of ertekek) assert.ok(Math.abs(k - fej.kozep) <= 3, `a program-ertek kozepe ${k} vs fejlec ${fej.kozep}`);
    assert.equal(await p.locator('#arlista a.gomb').count(), 0, 'nincs Idopont-gomb az arlistaban');
    assert.equal(await p.locator('#arlista .ar-fejlec span').count(), 4, 'a fejlecben nincs gomb-oszlop');
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
    assert.equal(await p.locator('.galeria-kep').count(), 4, 'az elso ket (majdnem azonos) kep kozul az egyik kikerult');
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
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth }));
    assert.ok(m.sw <= m.iw, `scrollWidth ${m.sw} > ${m.iw}`);
    await ctx.close();
  });
});

describe('mobil sticky CTA (mint az oxigen oldalon)', () => {
  const lathato = (p) => p.$eval('#sticky-cta', (e) => e.classList.contains('lathato'));
  const gorget = async (p, sel) => { await p.evaluate((s) => { document.documentElement.style.scrollBehavior = 'auto'; const e = document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top + scrollY - 80); }, sel); await p.waitForTimeout(500); };

  test('telefonon: az elso, 4 kepes szekcio (Mennyibe kerul?) elgorgetese elott nincs, utana latszik, a foglalonal es utana eltunik; a gomb a foglalora ugrik', async () => {
    const { p, ctx } = await nyit({ mobil: true, api: () => idok(...SLOTOK) });
    assert.equal(await lathato(p), false, 'az oldal tetejen nincs');
    assert.equal(await p.getAttribute('#sticky-cta', 'aria-hidden'), 'true');
    await gorget(p, '#mennyibe');
    assert.equal(await lathato(p), false, 'a 4 kepes szekcio elejen meg nincs');
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; const e = document.querySelector('.eredmenyek'); scrollTo(0, e.getBoundingClientRect().top + scrollY + 100); });
    await p.waitForTimeout(500);
    assert.equal(await lathato(p), true, 'a 4 kepes szekcio elgorgetese utan latszik');
    await gorget(p, '.tudod');
    assert.equal(await lathato(p), true, 'tovabb gorgetve is latszik');
    assert.equal(await p.getAttribute('#sticky-cta', 'aria-hidden'), 'false');
    const m = await p.$eval('#sticky-cta', (e) => { const r = e.getBoundingClientRect(); return { alja: Math.round(r.bottom), ablak: innerHeight, pozicio: getComputedStyle(e).position, ujra: [...e.querySelectorAll('a')].map((a) => a.getAttribute('href')) }; });
    assert.equal(m.pozicio, 'fixed');
    assert.equal(m.alja, m.ablak, 'az ablak aljan ul');
    assert.equal(m.ujra[0], '#foglalas');
    assert.match(m.ujra[1], /serviceId=476477|business=laser/);
    assert.equal(await p.evaluate(() => document.body.classList.contains('sticky-be')), true);
    await gorget(p, '#foglalas');
    assert.equal(await lathato(p), false, 'a foglalo szekcional eltunik');
    await gorget(p, '.helyszin');
    assert.equal(await lathato(p), false, 'a foglalo utan sem jon vissza');
    await gorget(p, '.zsofi');
    assert.equal(await lathato(p), true, 'a foglalo felett (messze) ujra latszik');
    await ctx.close();
  });

  test('a gomb a foglalora gorget', async () => {
    const { p, ctx } = await nyit({ mobil: true, api: () => idok(...SLOTOK) });
    // az elso latogatasnal a suti-sav fedi az also savot (mint az oxigen oldalon): elfogadas utan kattinthato
    await p.getByRole('button', { name: 'Elfogadom' }).click();
    await gorget(p, '.zsofi');
    await p.click('#sticky-cta a.gomb');
    await p.waitForFunction(() => { const t = document.getElementById('foglalas').getBoundingClientRect().top; return t < 200 && t > -400; }, null, { timeout: 8000 });
    await ctx.close();
  });

  test('asztalon nincs sticky sav', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.$eval('#sticky-cta', (e) => getComputedStyle(e).display), 'none');
    await ctx.close();
  });
});

describe('a latvanyterv szerinti ikonok es a tomorebb arlista', () => {
  test('az arlistaban csak a fo testtajak (csoportok) kapnak kepet, a soroknak nincs ikonjuk', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('#arlista tr[data-kulcs] img').count(), 0, 'a soroknak nincs kep');
    assert.equal(await p.locator('#arlista .sor-ikon').count(), 0);
    const cs = await p.$$eval('#arlista .csoport-ikon img', (l) => l.map((i) => i.getAttribute('src').split('/').pop()));
    assert.deepEqual(cs, ['cs-arc.jpg', 'cs-kar.jpg', 'cs-intim.jpg', 'cs-lab.jpg', 'cs-ferfi.jpg', 'cs-egyeb.jpg', 'cs-csomag.jpg']);
    await ctx.close();
  });

  test('asztalon az arlista keskeny (<= 980 px), a sorok felekkora magassagúak (<= 64 px), a ket szamoszlop kozel van egymashoz', async () => {
    const { p, ctx } = await nyit();
    const dob = await p.$eval('.arlista-doboz', (e) => Math.round(e.getBoundingClientRect().width));
    assert.ok(dob <= 980, 'a doboz szelessege: ' + dob);
    const magas = await p.$$eval('#arlista tbody tr:not(:has(small))', (l) => l.map((tr) => Math.round(tr.getBoundingClientRect().height)));
    assert.ok(magas.length >= 15);
    for (const m of magas) assert.ok(m <= 64, 'sormagassag: ' + m);
    // terulet-nev (sor-ikon + nev) es az alkalmankenti ar kozotti hely: a leghosszabb nev nelkuli soroknal is legfeljebb ~340 px
    const rest = await p.$eval('#arlista tr[data-kulcs="bajusz"]', (tr) => { const n = tr.querySelector('.sor-nev').getBoundingClientRect(); const a = tr.querySelector('.ar-egy').getBoundingClientRect(); return Math.round(a.left - n.right); });
    assert.ok(rest <= 340, 'a nev vege es az ar kozotti hely: ' + rest);
    await ctx.close();
  });

  test('a Mennyibe kerul? szekcio: rombusz-elvalasztok, ajandek-ikonos 20%-os pill', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('#mennyibe .rombusz').count(), 5, 'cim alatt 1 + kartyankent 1');
    assert.equal(await p.locator('#mennyibe p.kedv-sor svg.aj-ikon').count(), 1);
    await ctx.close();
  });
});

describe('eredmenyek: tobb valodi elotte/utana kartya', () => {
  test('harom kartya (honalj, labszar, arc), mindegyik kepe betoltodik, a rács nem "egy" kartyas', async () => {
    const { p, ctx } = await nyit();
    await p.evaluate(() => document.querySelectorAll('#eredmenyek img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
    await p.locator('#eredmenyek').scrollIntoViewIfNeeded();
    await p.waitForFunction(() => [...document.querySelectorAll('#eredmenyek img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });
    assert.equal(await p.locator('#eredmenyek .eredmeny-racs.egy').count(), 0);
    const terulet = await p.$$eval('#eredmenyek .eredmeny-kartya dd', (l) => l.map((e) => e.textContent.trim()));
    assert.deepEqual(terulet, ['Hónalj', 'Lábszár', 'Arc']);
    assert.equal(await p.locator('#eredmenyek .cimke').count(), 6, 'kartyankent Elotte + Utana');
    const m = await p.$$eval('#eredmenyek .eloutana', (l) => l.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    assert.equal(new Set(m.map((x) => x.join('x'))).size, 1, 'egyforma meretu kepkeretek: ' + JSON.stringify(m));
    assert.ok(m[0][0] >= 300, 'harom oszlop: ' + m[0][0]);
    await ctx.close();
  });
});

describe('a hatodik kor visszajelzesei', () => {
  test('GYIK: a "Mit jelent az, hogy vegleges?" es a "Biztos, hogy eleg a 8 alkalom?" kerdes megvalaszolva', async () => {
    const { p, ctx } = await nyit();
    const kerdesek = await p.$$eval('#info summary', (l) => l.map((e) => e.textContent.trim()));
    assert.ok(kerdesek.includes('Mit jelent az, hogy végleges?'), kerdesek.join(' | '));
    assert.ok(kerdesek.includes('Biztos, hogy elég a 8 alkalom?'));
    assert.equal(kerdesek.length, 6);
    for (const v of await p.$$eval('#info details p', (l) => l.map((e) => e.textContent.trim().length))) assert.ok(v > 60, 'a valasz nem ures');
    await ctx.close();
  });

  test('csomagok: az eredeti (kulon-kulon vett) ar athuzva, pirossal; megegyezik a testreszek arainak osszegevel', async () => {
    const { p, ctx } = await nyit();
    const sorok = await p.$$eval('#arlista tr[data-csomag]', (l) => l.map((tr) => ({ k: tr.dataset.kulcs, reszek: (tr.dataset.reszek || '').split(','), regi: tr.querySelector('.regi-ar')?.textContent, szin: tr.querySelector('.regi-ar') && getComputedStyle(tr.querySelector('.regi-ar')).color, vonal: tr.querySelector('.regi-ar') && getComputedStyle(tr.querySelector('.regi-ar')).textDecorationLine, ar: +tr.dataset.ar })));
    const ar = await p.$$eval('#arlista tr[data-kulcs]', (l) => Object.fromEntries(l.map((tr) => [tr.dataset.kulcs, +tr.dataset.ar])));
    assert.equal(sorok.length, 5);
    for (const s of sorok) {
      assert.ok(s.regi, s.k + ' eredeti ar');
      assert.equal(szamjegy(s.regi.replace('Külön-külön:', '')), s.reszek.reduce((o, r) => o + ar[r], 0), s.k + ': a testreszek ara osszesen');
      assert.ok(szamjegy(s.regi.replace('Külön-külön:', '')) > s.ar, s.k + ': az eredeti ar nagyobb a csomagarnal');
      assert.match(s.szin, /^rgb\(19\d, 57, 43\)$/, 'piros: ' + s.szin);
      assert.equal(s.vonal, 'line-through');
    }
    await ctx.close();
  });

  test('kalkulator: egy teruletnel nincs "null" es nincs athuzott ar; tobb teruletnel az eredeti ar athuzva, pirossal', async () => {
    const { p, ctx } = await nyit();
    // alapbol 3 terulet: athuzott eredeti ar (59 000 + 19 000 + 36 000 = 114 000)
    assert.equal(szamjegy(await p.textContent('#szamolo-tartalom .sz-ossz .regi-ar')), 114000);
    for (const k of ['lab', 'intim']) await p.click(`.sz-chip[data-kulcs="${k}"]`);
    assert.equal(await p.locator('#szamolo-tartalom .sz-ossz .regi-ar').count(), 0, 'egy teruletnel nincs athuzott ar');
    assert.equal(await p.locator('#szamolo-tartalom .sz-kedv').count(), 0);
    assert.ok(!/null/.test(await p.textContent('#szamolo-tartalom')), 'nincs "null" felirat');
    assert.ok(!/Kattints a területekre/.test(await p.textContent('#szamolo')), 'nincs alcim');
    await ctx.close();
  });

  test('foglalo: nincs "Mar jartal nalunk?" sor; a szabad napok kor alakuak', async () => {
    const { p, ctx } = await nyit({ api: () => idok(...SLOTOK) });
    assert.ok(!/Már jártál nálunk/.test(await p.textContent('#foglalas')));
    await p.locator('#foglalo').scrollIntoViewIfNeeded();
    await p.waitForSelector('#naptar button.naptar-nap');
    const sugar = await p.$eval('#naptar button.naptar-nap', (e) => getComputedStyle(e).borderTopLeftRadius);
    assert.equal(sugar, '50%');
    await ctx.close();
  });

  test('telefon: a fo cim 2 sorban, utana a kep, utana a tobbi szoveg; a hero es a Zsofi ikonjai 3 oszlopban, kozepre igazitva', async () => {
    for (const w of [360, 390]) {
      const ctx = await bongeszo.newContext({ viewport: { width: w, height: 800 }, userAgent: UA_MOBIL, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
      await p.goto(bazis + OLDAL, { waitUntil: 'domcontentloaded' });
      const h1 = await p.$eval('.hero h1', (e) => { const r = e.getBoundingClientRect(); return { sor: Math.round(r.height / parseFloat(getComputedStyle(e).lineHeight)), alja: r.bottom }; });
      assert.equal(h1.sor, 2, w + ' px: a fo cim 2 sor');
      const kep = await p.$eval('.hero-kep', (e) => e.getBoundingClientRect().top);
      const ajanlat = await p.$eval('.hero-ajanlat', (e) => e.getBoundingClientRect().top);
      assert.ok(h1.alja <= kep + 1 && kep < ajanlat, w + ' px: cim -> kep -> tobbi szoveg: ' + [h1.alja, kep, ajanlat]);
      for (const sel of ['.hero-bizalom', '.zsofi-tenyek']) {
        const m = await p.$$eval(sel + ' li', (l) => l.map((li) => { const r = li.getBoundingClientRect(); const i = li.querySelector('.ikon-kor').getBoundingClientRect(); return { top: Math.round(r.top), ikonKozep: Math.round(i.left + i.width / 2), liKozep: Math.round(r.left + r.width / 2), align: getComputedStyle(li).textAlign }; }));
        assert.equal(new Set(m.map((x) => x.top)).size, 1, sel + ': egymas mellett');
        for (const x of m) { assert.ok(Math.abs(x.ikonKozep - x.liKozep) <= 1, sel + ': az ikon kozepen'); assert.equal(x.align, 'center'); }
      }
      await ctx.close();
    }
  });

  test('telefon: a kalkulator alatti sor egy sorban; a nyil lefele mutat (elforgatva); a csomag-csoportcim alatt hely van', async () => {
    const ctx = await bongeszo.newContext({ viewport: { width: 360, height: 800 }, userAgent: UA_MOBIL, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(bazis + OLDAL, { waitUntil: 'domcontentloaded' });
    const lab = await p.$eval('.sz-lab .rovid', (e) => { const r = e.getBoundingClientRect(); return { ma: Math.round(r.height), sor: parseFloat(getComputedStyle(e).lineHeight), szoveg: e.textContent }; });
    assert.ok(lab.ma <= lab.sor * 1.2, 'egy sor: ' + lab.ma + ' / ' + lab.sor);
    assert.match(lab.szoveg, /^Az ár fix, 8 alkalomból csak 6-ot fizetsz, 2 ajándék\.$/);
    assert.equal(await p.$eval('.sz-lab .hosszu', (e) => getComputedStyle(e).display), 'none');
    assert.notEqual(await p.$eval('.kezirat svg', (e) => getComputedStyle(e).transform), 'none');
    const hely = await p.$eval('.ar-csomagok h3', (h) => { const kov = h.nextElementSibling.getBoundingClientRect().top - h.getBoundingClientRect().bottom; return Math.round(kov); });
    assert.ok(hely >= 0, 'a csoportcim es a tablazat kozott: ' + hely);
    assert.ok(await p.$eval('.ar-csomagok h3', (e) => parseFloat(getComputedStyle(e).paddingBottom)) >= 8, 'a csoportcim alatt hely');
    const sw = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert.ok(sw[0] <= sw[1], 'nincs vizszintes gorgetes: ' + sw);
    await ctx.close();
  });
});

describe('a hetedik kor visszajelzesei', () => {
  test('telefonon az elso kepernyon (kis kijelzon is) nincs sticky sav; csak a 4 kepes szekcio elgorgetese utan jon be', async () => {
    const ctx = await bongeszo.newContext({ viewport: { width: 390, height: 600 }, userAgent: UA_MOBIL, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(bazis + OLDAL, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(600);
    const gomb = await p.$eval('.hero .cta-sor', (e) => e.getBoundingClientRect().top);
    assert.ok(gomb > 600, 'a hero gombjai az elso kepernyo alatt vannak: ' + gomb);
    assert.equal(await p.$eval('#sticky-cta', (e) => e.classList.contains('lathato')), false, 'betoltes utan nincs sav');
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 300); });
    await p.waitForTimeout(400);
    assert.equal(await p.$eval('#sticky-cta', (e) => e.classList.contains('lathato')), false, 'a 4 kepes szekcio meg nincs elgorgetve');
    await p.evaluate(() => { const e = document.querySelector('.tudod'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 80); });
    await p.waitForTimeout(500);
    assert.equal(await p.$eval('#sticky-cta', (e) => e.classList.contains('lathato')), true, 'a 4 kepes szekcio elgorgetese utan latszik');
    await ctx.close();
  });

  test('"/ alkalom" a kartyakon (nem "fizetos alkalom"); az Allnak nincs alcime az arlistaban', async () => {
    const { p, ctx } = await nyit();
    const kartya = await p.$$eval('.gyors-kartya small', (l) => l.map((e) => e.textContent.trim()));
    assert.deepEqual(kartya, ['/ alkalom', '/ alkalom', '/ alkalom', '/ alkalom']);
    assert.equal(await p.locator('#arlista tr[data-kulcs="all"] small').count(), 0);
    assert.ok(!/állcsúcs/.test(await p.textContent('#arlista')), 'nincs "allcsucs + allkapocsvonal" szoveg');
    await ctx.close();
  });

  test('asztalon a Zsofi-szekcioban a cim a video tetejevel, a galeria a video aljaval egy vonalban van; a gomb korul hely', async () => {
    const { p, ctx } = await nyit();
    await p.evaluate(() => document.querySelectorAll('#zsofi img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
    await p.locator('#zsofi').scrollIntoViewIfNeeded();
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => {
      const v = document.querySelector('#zsofi-video').getBoundingClientRect(); const h = document.querySelector('#zsofi-cim').getBoundingClientRect();
      const g = document.querySelector('#zsofi .galeria').getBoundingClientRect(); const b = document.querySelector('#zsofi-cim').parentElement.querySelector('.gomb').getBoundingClientRect();
      const u = document.querySelector('#zsofi .zsofi-tenyek').getBoundingClientRect();
      return { videoTop: v.top, cimTop: h.top, videoAlja: v.bottom, galeriaAlja: g.bottom, gombElott: b.top - u.bottom, gombUtan: g.top - b.bottom };
    });
    assert.ok(Math.abs(m.cimTop - m.videoTop) <= 8, 'a cim teteje a video tetejen: ' + [m.cimTop, m.videoTop]);
    assert.ok(Math.abs(m.galeriaAlja - m.videoAlja) <= 2, 'a galeria alja a video alja: ' + [m.galeriaAlja, m.videoAlja]);
    assert.ok(m.gombElott >= 16 && m.gombUtan >= 24, 'a gomb korul hely: ' + [m.gombElott, m.gombUtan]);
    await ctx.close();
  });

  test('"Valoszinuleg igen" kartya: az uj szoveg (borotva, begyulladt szortuszok)', async () => {
    const { p, ctx } = await nyit();
    const szoveg = await p.textContent('.alkalmas-kartya.igen p');
    assert.match(szoveg, /^Ha egy életre elfelejtenéd a borotvát és a begyulladt szőrtüszőket, akkor igen\./);
    assert.equal(szoveg.trim(), 'Ha egy életre elfelejtenéd a borotvát és a begyulladt szőrtüszőket, akkor igen.');
    assert.ok(!/Pigmentáltabb/.test(szoveg), 'a pigmentaltabb szoros mondat kikerult');
    await ctx.close();
  });

  test('szorbenoves-video: poszter + kattintasra betolto video; a fajl elerheto', async () => {
    const { p, ctx } = await nyit();
    await p.locator('.szorbenoves').scrollIntoViewIfNeeded();
    assert.equal(await p.locator('.szorbenoves video').count(), 0, 'a video csak kattintasra toltodik be');
    const forras = await p.getAttribute('#szorbenoves-video', 'data-video');
    assert.equal(forras, '/assets/video/lezer-orvos.mp4');
    assert.equal(await p.evaluate(async (u) => (await fetch(u, { method: 'HEAD' })).status, forras), 200, 'a video fajl elerheto');
    await p.click('#szorbenoves-video');
    await p.waitForSelector('.szorbenoves video[controls]');
    assert.equal(await p.getAttribute('.szorbenoves video source', 'src'), forras);
    assert.match(await p.getAttribute('.szorbenoves video', 'aria-label'), /Dr\. Máté Kinga orvos/);
    assert.match(await p.textContent('.szorbenoves-szoveg p'), /^Dr\. Máté Kinga orvos, sebész szakorvosjelölt is a lézeres szőrtelenítést és Zsófit ajánlja\./);
    const badge = await p.$eval('.orvosi-badge', (e) => { const b = e.getBoundingClientRect(); const d = e.parentElement.getBoundingClientRect(); const g = document.querySelector('.szorbenoves-szoveg a.gomb').getBoundingClientRect(); const sz = document.querySelector('.szorbenoves-szoveg').getBoundingClientRect(); return { szoveg: e.textContent.trim(), kozep: Math.round((b.left + b.width / 2) - (sz.left + sz.width / 2)), fent: Math.round(b.top - d.top), gombKozep: Math.round((g.left + g.width / 2) - (sz.left + sz.width / 2)), pipa: !!e.querySelector('svg path') }; });
    assert.equal(badge.szoveg, 'Orvosi ajánlással');
    assert.ok(badge.pipa, 'pipa ikon');
    assert.ok(Math.abs(badge.kozep) <= 1 && badge.fent >= 0 && badge.fent <= 24, 'a jelveny a doboz tetejen, vizszintesen kozepen: ' + JSON.stringify(badge));
    assert.ok(Math.abs(badge.gombKozep) <= 1, 'az Idopontot valasztok gomb a szovegoszlopban kozepen: ' + JSON.stringify(badge));
    assert.ok(!/Zsófi rövid videóját/.test(await p.textContent('.szorbenoves')), 'nem a Zsofi videojarol szol a szoveg');
    const gomb = await p.$eval('.szorbenoves-szoveg a.gomb', (e) => ({ osztaly: e.className, hatter: getComputedStyle(e).backgroundImage }));
    assert.match(gomb.osztaly, /gomb-arany/, 'arany gomb');
    assert.match(gomb.hatter, /linear-gradient/);
    const doboz = await p.$eval('.szorbenoves', (e) => getComputedStyle(e).backgroundImage);
    assert.match(doboz, /linear-gradient/, 'kremszinu (nem feher) doboz');
    await ctx.close();
  });
});

describe('a kilencedik kor: szekciosorrend, kalkulator-jelzesek, egységes gombok', () => {
  test('szekciosorrend: mennyibe kerul -> eredmenyek -> 8 kezeles -> mar tudod -> garancia -> Zsofi -> neked is jo -> velemenyek', async () => {
    const { p, ctx } = await nyit();
    const sor = await p.$$eval('main > section', (l) => l.map((s) => s.className.split(' ')[0]));
    assert.deepEqual(sor.slice(0, 9), ['hero', 'gyors-arak', 'eredmenyek', 'program', 'tudod', 'elonyok', 'zsofi', 'alkalmas', 'velemenyek']);
    assert.deepEqual(sor.slice(-5), ['arlista', 'szamolo', 'gyik', 'foglalas', 'helyszin']);
    await ctx.close();
  });

  test('a kalkulatorra mutato linkek (hero, 8 kezeles): JS-gorgetessel ugranak, a #hash nem valtozik', async () => {
    const { p, ctx } = await nyit();
    const helyek = await p.$$eval('[data-szamolo]', (l) => l.map((a) => a.closest('section').className.split(' ')[0]));
    assert.deepEqual(helyek, ['hero', 'program']);
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    await p.getByRole('button', { name: 'Elfogadom' }).click().catch(() => {});
    await p.locator('.program [data-szamolo]').scrollIntoViewIfNeeded();
    await p.locator('.program [data-szamolo]').click();
    await p.waitForFunction(() => { const t = document.getElementById('szamolo').getBoundingClientRect().top; return t < 200 && t > -300; }, null, { timeout: 8000 });
    assert.equal(await p.evaluate(() => location.hash), '', 'nincs hash-valtozas (GTM History Change)');
    await ctx.close();
  });

  test('minden gomb betutipusa, merete es irasmodja azonos; nincs csupa nagybetus gomb', async () => {
    const { p, ctx } = await nyit();
    const m = await p.$$eval('a.gomb, button.gomb', (l) => l.map((e) => { const s = getComputedStyle(e); return [s.fontFamily.split(',')[0], s.fontSize, s.fontWeight, s.textTransform, s.letterSpacing].join('|'); }));
    assert.ok(m.length >= 8, 'gombok szama: ' + m.length);
    const kulonbozo = [...new Set(m)];
    assert.equal(kulonbozo.length, 1, 'eltero gomb-tipografia: ' + JSON.stringify(kulonbozo));
    assert.match(kulonbozo[0], /\|15px\|400\|none\|(normal|0px)$/);
    await ctx.close();
  });
});

describe('a rozsaszin akcios sav nem latszik', () => {
  test('asztalon es telefonon sincs rozsaszin akcios sav a fejlecben; a fejlec alacsonyabb', async () => {
    for (const mobil of [false, true]) {
      const { p, ctx } = await nyit({ mobil });
      const m = await p.evaluate(() => { const s = document.getElementById('comp-mpv0ganp'); const f = document.getElementById('SITE_HEADER'); return { sav: s ? getComputedStyle(s).display : 'nincs', magas: Math.round(f.getBoundingClientRect().height), szoveg: /Októberi akció/.test(f.innerText) }; });
      assert.equal(m.sav, 'none', (mobil ? 'mobil' : 'asztal') + ': a sav el van rejtve');
      assert.equal(m.szoveg, false, 'a sav szovege nem latszik');
      assert.ok(m.magas <= 80, (mobil ? 'mobil' : 'asztal') + ': a fejlec magassaga: ' + m.magas);
      await ctx.close();
    }
  });
});

describe('a Google-ertekeles jelveny a hero-ban', () => {
  for (const [nev, mobil, szeles] of [['asztal', false, 1440], ['telefon', true, 360]]) {
    test(`${nev}: a 3 jelveny alatt van, nincs lefele nyil, a 4,9 / csillag / velemenyszam egyforma meretu, szebb (kerek) jelveny`, async () => {
      const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: 800 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
      const p = await ctx.newPage();
      await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
      await p.goto(bazis + OLDAL, { waitUntil: 'domcontentloaded' });
      assert.equal(await p.locator('.google-nagy .g-le').count(), 0, 'nincs lefele nyil');
      assert.ok(!/↓/.test(await p.textContent('.google-nagy')));
      const m = await p.evaluate(() => {
        const g = document.querySelector('.google-nagy'); const b = document.querySelector('.hero-bizalom').getBoundingClientRect(); const gr = g.getBoundingClientRect(); const cta = document.querySelector('.hero .cta-sor').getBoundingClientRect();
        const fs = (e) => parseFloat(getComputedStyle(e).fontSize);
        return { alatta: gr.top >= b.bottom - 1, ctaElott: gr.bottom <= cta.top + 1, pont: fs(g.querySelector('.g-pont')), nagyPont: fs(g.querySelector('.g-pont b')), db: fs(g.querySelector('.g-db')), csillag: fs(g.querySelector('.csillagok')), fonszin: getComputedStyle(g).backgroundColor, keret: getComputedStyle(g).borderTopWidth, arnyek: getComputedStyle(g).boxShadow, magas: Math.round(gr.height), sz: Math.round(gr.width), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      });
      assert.ok(m.alatta, 'a harom jelveny alatt: ' + JSON.stringify(m));
      assert.ok(m.ctaElott, 'a gombok folott');
      assert.equal(m.nagyPont, m.pont, 'a 4,9 ugyanakkora, mint a /5: ' + JSON.stringify(m));
      assert.ok(m.pont <= 16 && Math.abs(m.pont - m.db) <= 1.5, 'az ertek es a velemenyszam egyforma kicsi: ' + JSON.stringify(m));
      assert.equal(m.fonszin, 'rgba(0, 0, 0, 0)', 'nincs hatter (nem kartya, nem gomb)');
      assert.equal(m.keret, '0px');
      assert.equal(m.arnyek, 'none');
      assert.ok(m.magas <= 52 || mobil, 'asztalon egy sor: ' + m.magas);
      assert.ok(m.sw <= m.cw, 'nincs vizszintes gorgetes');
      await ctx.close();
    });
  }
});

describe('a tizenharmadik kor: mobil finomitasok', () => {
  for (const w of [360, 390]) {
    test(`telefon ${w}px: a harom jelveny a margoig er; a Google-sor nem kartya; az arlista ugyanolyan szeles, mint a kalkulator es az akkordionok; az orvosi jelveny kozepen, a video folott`, async () => {
      const ctx = await bongeszo.newContext({ viewport: { width: w, height: 800 }, userAgent: UA_MOBIL, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
      await p.goto(bazis + OLDAL, { waitUntil: 'domcontentloaded' });
      const m = await p.evaluate(() => {
        const r = (e) => e.getBoundingClientRect();
        const t = r(document.querySelector('.hero .tartalom')); const li = [...document.querySelectorAll('.hero-bizalom li')].map(r);
        const ar = r(document.querySelector('.arlista-doboz')); const sz = r(document.querySelector('.szamolo-valaszto')); const ak = r(document.querySelector('.harmonika-racs details'));
        const bd = r(document.querySelector('.orvosi-badge')); const vd = r(document.querySelector('#szorbenoves-video')); const dx = r(document.querySelector('.szorbenoves'));
        const sor = document.querySelector('.hero-szoveg > .kalk-jelzes'); const kedv = document.querySelector('.gyors-arak p.kedv-sor');
        const lh = (e) => parseFloat(getComputedStyle(e).lineHeight);
        return { balMarg: Math.round(li[0].left - t.left), jobbMarg: Math.round(t.right - li[li.length - 1].right), arSz: Math.round(ar.width), kalkSz: Math.round(sz.width), akkSz: Math.round(ak.width),
          badgeKozep: Math.round((bd.left + bd.width / 2) - (dx.left + dx.width / 2)), badgeVideoFolott: bd.bottom <= vd.top + 1, kalkSor: Math.round(r(sor).height / lh(sor)), kedvSor: (() => { const s = getComputedStyle(kedv); return Math.round((r(kedv).height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom) - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth)) / lh(kedv)); })() };
      });
      assert.ok(Math.abs(m.balMarg) <= 1 && Math.abs(m.jobbMarg) <= 1, 'a jelvenyek a margoig: ' + JSON.stringify(m));
      assert.ok(Math.abs(m.arSz - m.kalkSz) <= 1 && Math.abs(m.arSz - m.akkSz) <= 1, 'azonos szelesseg: ' + JSON.stringify(m));
      assert.ok(Math.abs(m.badgeKozep) <= 1 && m.badgeVideoFolott, 'orvosi jelveny: ' + JSON.stringify(m));
      assert.equal(m.kalkSor, 1, 'a kalkulator-sor egy sor');
      assert.equal(m.kedvSor, 1, 'a 20%-os sav egy sor');
      await ctx.close();
    });
  }

  test('szovegek: Mennyibe kerul alcim, rovid 20%-os sav, nincs kalkulatoros sor ott; az arlista bevezetoje rovid', async () => {
    const { p, ctx } = await nyit();
    assert.equal((await p.textContent('#mennyibe .halk')).trim(), 'Bérlet helyett alkalmanként fizetsz.');
    assert.equal((await p.textContent('#mennyibe p.kedv-sor')).trim(), 'Az első kezelés 20% kedvezménnyel');
    assert.equal(await p.locator('#mennyibe [data-szamolo]').count(), 0);
    assert.equal((await p.textContent('#arlista .arlista-bevezeto')).trim(), 'Az árak egy kezelésre (alkalomra) vonatkoznak. A 8 alkalmas programban a 4. és a 8. alkalom ajándék, ezért csak 6 alkalmat fizetsz.');
    assert.equal((await p.textContent('.hero-szoveg > .kalk-jelzes')).replace(/\s+/g, ' ').trim(), 'Több területet szeretnél? Számold ki az árát →');
    await ctx.close();
  });
});

describe('az atvaltas: eredeti cim, rejtett regi valtozat, atiranyitas', () => {
  test('az -uj cim 301-gyel az eredeti cimre iranyit; a rejtett -regi valtozat noindex, sajat canonical-lal, es a fejlecben a regi (Wixes) oldal van', async () => {
    const lekeres = (ut) => new Promise((ok, hiba) => http.get(bazis + ut, { headers: { 'user-agent': 'Mozilla/5.0' } }, (r) => { let s = ''; r.on('data', (c) => { s += c; }); r.on('end', () => ok({ status: r.statusCode, loc: r.headers.location, szoveg: s })); }).on('error', hiba));
    const uj = await lekeres('/lezeres-szortelenites-budapest-uj');
    assert.equal(uj.status, 301);
    assert.equal(uj.loc, '/lezeres-szortelenites-budapest');
    const regi = await lekeres('/lezeres-szortelenites-budapest-regi');
    assert.equal(regi.status, 200);
    assert.match(regi.szoveg, /<meta name="robots" content="noindex, nofollow"\/>/);
    assert.match(regi.szoveg, /<link rel="canonical" href="https:\/\/www\.mosaicheadspa\.hu\/lezeres-szortelenites-budapest-regi"\/>/);
    assert.ok(!regi.szoveg.includes('lezer-landing.css'), 'a regi valtozat a Wixes klon, nem az uj landing');
    const eles = await lekeres('/lezeres-szortelenites-budapest');
    assert.equal(eles.status, 200);
    assert.ok(eles.szoveg.includes('lezer-landing.css'), 'az eredeti cimen az uj landing van');
    assert.ok(!/<meta name="robots"/i.test(eles.szoveg), 'az eles oldal indexelheto (nincs robots meta)');
  });
});

describe('a tizennegyedik kor: tisztabb arlista, azonnali velemenyek, helyszin-kep, 8000+ ora', () => {
  test('"8000+ ora tapasztalat" a Zsofi-szekcio jelvenyeben (nem "4 ev")', async () => {
    const { p, ctx } = await nyit();
    const szoveg = await p.$$eval('.zsofi-tenyek li', (l) => l.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
    assert.equal(szoveg[0], '8000+ óra tapasztalat');
    assert.ok(!szoveg.join(' ').includes('4 év'));
    await ctx.close();
  });

  test('a Trustindex-keret nem lazy (hozzajarulas utan azonnal toltodik); a helyszin kepe fix magassagu (nem logat a lablecbe)', async () => {
    const forras = fs.readFileSync(path.join(GYOKER, 'assets', 'js', 'lezer-landing.js'), 'utf8');
    assert.match(forras, /title: 'Google-vélemények \(Trustindex\)', loading: 'eager'/);
    for (const mobil of [false, true]) {
      const { p, ctx } = await nyit({ mobil });
      await p.locator('.helyszin').scrollIntoViewIfNeeded();
      await p.evaluate(() => document.querySelectorAll('.helyszin img').forEach((i) => { i.loading = 'eager'; }));
      await p.waitForTimeout(600);
      const m = await p.evaluate(() => { const i = document.querySelector('.hely-kepek > img'); const s = document.querySelector('.helyszin').getBoundingClientRect(); const r = i.getBoundingClientRect(); return { magas: Math.round(r.height), alja: Math.round(r.bottom), szekcioAlja: Math.round(s.bottom), stilus: getComputedStyle(i).height }; });
      assert.equal(m.stilus, '190px', 'fix magassag');
      assert.ok(m.alja <= m.szekcioAlja, (mobil ? 'mobil' : 'asztal') + ': a kep a szekcion belul van: ' + JSON.stringify(m));
      await ctx.close();
    }
  });
});

describe('a "Mutasd az eredmenyeket" link a hero-ban', () => {
  for (const mobil of [false, true]) {
    test(`${mobil ? 'telefon' : 'asztal'}: az ertekeles-sorban a Google-ertekeles mellett latszik; JS-gorgetessel az Eredmenyekhez ugrik, #hash-valtozas nelkul`, async () => {
      const { p, ctx } = await nyit({ mobil });
      const m = await p.evaluate(() => { const l = document.querySelector('.hero .eredmeny-link'); const g = document.querySelector('.hero .google-nagy'); const r = l.getBoundingClientRect(); const gr = g.getBoundingClientRect(); return { szoveg: l.textContent.replace(/\s+/g, ' ').trim(), ugyanabbaSorba: l.parentElement === g.parentElement, lathato: r.width > 0 && r.height > 0, jobbra: r.left >= gr.left, attr: l.getAttribute('data-gorgetes') }; });
      assert.equal(m.szoveg, 'Mutasd az eredményeket →');
      assert.ok(m.ugyanabbaSorba && m.lathato, 'a Google-ertekeles sorban: ' + JSON.stringify(m));
      assert.equal(m.attr, 'eredmenyek');
      await p.getByRole('button', { name: 'Elfogadom' }).click().catch(() => {});
      await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
      await p.locator('.hero .eredmeny-link').scrollIntoViewIfNeeded();
      await p.locator('.hero .eredmeny-link').click();
      await p.waitForFunction(() => { const t = document.getElementById('eredmenyek').getBoundingClientRect().top; return t < 220 && t > -250; }, null, { timeout: 8000 });
      assert.equal(await p.evaluate(() => location.hash), '', 'nincs hash-valtozas (GTM History Change)');
      await ctx.close();
    });
  }
});

