// Kedvezmenykod (10%) a vasarlasi folyamatban - BONGESZOS tesztek (Playwright) a helyi fejleszto kiszolgaloval (tools/ajandek-teszt/szerver.mjs: a valodi
// kezelo + mock Stripe + bongeszos Stripe.js-mock). Nincs kulso halozat, nincs valodi level / fizetes.
//
//   node --test tools/ajandek-teszt/kedvezmeny-bongeszo.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

let kiszolgalo, bazis, bongeszo;
before(async () => {
  const port = 4300 + Math.floor(Math.random() * 600);
  kiszolgalo = spawn(process.execPath, [path.join(GYOKER, 'tools/ajandek-teszt/szerver.mjs'), String(port)], { cwd: GYOKER, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((ok, nem) => {
    const ido = setTimeout(() => nem(new Error('a fejleszto kiszolgalo nem indult el')), 20000);
    kiszolgalo.stdout.on('data', (d) => { if (String(d).includes('Gift Engine fejleszto kiszolgalo')) { clearTimeout(ido); ok(); } });
    kiszolgalo.on('exit', () => nem(new Error('a fejleszto kiszolgalo leallt')));
  });
  bazis = `http://localhost:${port}`;
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); kiszolgalo?.kill(); });

async function nyit(oldal, { szeles = 1280 } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 } });
  const p = await ctx.newPage();
  const hibak = [], posztok = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/api/ajandek')) posztok.push({ ut: r.url().split('/api/')[1], torzs: r.postData() }); });
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.goto(`${bazis}/${oldal}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ajandek);
  await p.addStyleTag({ content: '[class*="mh-cc"],[id*="mh-cc"]{display:none!important}' });
  return { p, ctx, hibak, posztok };
}
// az elso termek valasztasa, atvetel a szalonban / a szemelyre szabas kihagyasa, tovabb -> fizetes
async function fizetesig(p, termek) {
  const id = termek || await p.$eval('.ah-termek', (e) => e.getAttribute('data-termek'));
  await p.check(`input[name=termek][value="${id}"]`, { force: true });
  // telefonon a termek kijelolese a reszletes ablakot nyitja ("Ezt valasztom")
  const valaszt = p.locator('#ah-kez-valaszt');
  if (await valaszt.isVisible()) await valaszt.click();
  const szem = p.locator('input[name=atvetel][value=szemelyesen]');
  if (await szem.count() && await szem.isEnabled()) await szem.check({ force: true });
  await p.locator('#ah-tovabb-gomb').dispatchEvent('click');
  await p.waitForFunction(() => ['fizetes', 'tervezo'].includes(window.__ajandek.allapot()));
  if (await p.evaluate(() => window.__ajandek.allapot()) === 'tervezo') await p.click('#ah-tervezo-kihagy');
  await p.waitForFunction(() => window.__ajandek.allapot() === 'fizetes');
  return id;
}
const kod = async (p, ertek) => {
  if (!(await p.isVisible('#ah-kedv-urlap'))) await p.click('#ah-kedv-nyito');
  await p.fill('#ah-kedv-kod', ertek);
  await p.click('#ah-kedv-gomb');
};
async function urlapKitolt(p) {
  await p.fill('#ah-ajandekozott', 'Kiss Anna'); await p.fill('#ah-nev', 'Teszt Elek'); await p.fill('#ah-email', 'vevo@example.com');
  await p.fill('#ah-iranyitoszam', '1023'); await p.fill('#ah-varos', 'Budapest'); await p.fill('#ah-cim', 'Bécsi út 2.');
}
const levelek = async () => (await fetch(`${bazis}/__teszt/levelek`)).json();
const gombSzoveg = async (p) => (await p.textContent('#ah-fizet-gomb')).replace(/\s+/g, ' ').trim();

describe('HeadSpa (/ajandek): kedvezmenykod a vasarlasi folyamatban', () => {
  test('a doboz a Fizetes kartyan; hibas kod -> uzenet; ervenyes kod -> fizetendo 24 210 Ft (osszesito, gomb, Stripe-elem osszege); eltavolitas -> teljes ar', async () => {
    const { p, ctx, hibak } = await nyit('ajandek');
    await fizetesig(p, 'egyeni');
    assert.ok(await p.isVisible('#ah-kedv'), 'a doboz latszik');
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 26.900 Ft');
    await kod(p, 'nincs10');
    await p.waitForSelector('#ah-kedvezmeny-hiba:not([hidden])');
    assert.match(await p.textContent('#ah-kedvezmeny-hiba'), /nem érvényes/);
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 26.900 Ft');
    await kod(p, ' betti10 ');
    await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
    assert.match(await p.textContent('#ah-kedv-kesz'), /BETTI10/);
    assert.match(await p.textContent('#ah-kedv-kesz'), /−10%/);
    assert.match(await p.textContent('#ah-kedv-kesz'), /26\.900 Ft/);
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 24.210 Ft');
    assert.equal((await p.textContent('#ah-osszesito-fej-ar')).trim(), '24.210 Ft');
    assert.equal((await p.textContent('#ah-osszesito-ar')).trim(), '24.210 Ft');
    assert.equal(await p.evaluate(() => window.__mockElementsFrissites && window.__mockElementsFrissites.amount), 2421000, 'a Stripe-elem osszege a fizetendo');
    assert.equal(await p.textContent('#ah-hibasav-resz'), '', 'nincs hiba-sav');
    await p.click('.ah-kedv-le');
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 26.900 Ft');
    assert.equal((await p.textContent('#ah-osszesito-fej-ar')).trim(), '26.900 Ft');
    assert.equal(await p.evaluate(() => window.__mockElementsFrissites.amount), 2690000);
    assert.ok(await p.isVisible('#ah-kedv-nyito'));
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('termekvaltas kodda ervenyes marad: a masik termek is 10%-kal; az Enter a kodmezoben a kodot valtja be (nem kuldi el az urlapot)', async () => {
    const { p, ctx, posztok } = await nyit('ajandek');
    await fizetesig(p, 'paros');
    await p.click('#ah-kedv-nyito');
    await p.fill('#ah-kedv-kod', 'noel10');
    await p.press('#ah-kedv-kod', 'Enter');
    await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 48.420 Ft');
    assert.ok(!posztok.some((x) => x.ut === 'ajandek/fizetes'), 'az Enter nem inditott fizetest');
    await ctx.close();
  });

  test('a kod ujratoltes utan megmarad (a szerver ujra ellenorzi)', async () => {
    const { p, ctx } = await nyit('ajandek');
    await fizetesig(p, 'egyeni');
    await kod(p, 'viki10');
    await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => window.__ajandek);
    await fizetesig(p, 'egyeni');
    await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
    assert.match(await p.textContent('#ah-kedv-kesz'), /VIKI10/);
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 24.210 Ft');
    await ctx.close();
  });

  test('kartyas fizetes kedvezmenykoddal: a /fizetes a kodot kapja (az osszeget NEM), a rendeles 24 210 Ft, a PI metadataban a kod; siker-nezet', async () => {
    const { p, ctx, posztok, hibak } = await nyit('ajandek');
    await fizetesig(p, 'egyeni');
    await kod(p, 'betti10');
    await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
    await urlapKitolt(p);
    await p.fill('#mock-kartya', '4242 4242 4242 4242');
    await p.click('#ah-fizet-gomb');
    await p.waitForFunction(() => ['siker', 'szemelyre', 'osszegzo'].includes(window.__ajandek.allapot()), null, { timeout: 30000 });
    const kerelem = JSON.parse(posztok.find((x) => x.ut === 'ajandek/fizetes').torzs);
    assert.equal(kerelem.kedvezmeny, 'BETTI10');
    assert.equal(kerelem.osszeg, undefined, 'a kliens nem kuld osszeget');
    const st = await p.evaluate(() => JSON.parse(sessionStorage.getItem('ah_v1') || '{}'));
    const rend = await p.evaluate(async ({ pi, cs }) => (await fetch(`/api/ajandek/rendeles?pi=${pi}&cs=${cs}`)).json(), { pi: st.pi, cs: st.cs });
    assert.equal(rend.osszeg, 24210);
    assert.deepEqual(rend.kedvezmeny, { kod: 'BETTI10', szazalek: 10, ertek: 26900 });
    const info = await (await fetch(`${bazis}/__teszt/mock/pi-info?pi=${st.pi}`)).json();
    assert.equal(info.metadata.kedv_kod, 'BETTI10');
    assert.equal(info.metadata.kedv_ertek, '26900');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('atutalas kedvezmenykoddal: az utalando osszeg 24 210 Ft, a szalon-level a kodot es a kartya erteket mutatja', async () => {
    await fetch(`${bazis}/__teszt/levelek`, { method: 'DELETE' });
    const { p, ctx, posztok } = await nyit('ajandek');
    await fizetesig(p, 'egyeni');
    await kod(p, 'judit10');
    await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
    await urlapKitolt(p);
    await p.check('input[name=fizmod][value=atutalas]', { force: true });
    await p.fill('#ah-telefon', '+36 20 123 4567');
    assert.equal(await gombSzoveg(p), 'Rendelés elküldése — 24.210 Ft');
    await p.click('#ah-fizet-gomb');
    await p.waitForSelector('#ah-atutalas:not([hidden])');
    assert.match((await p.textContent('#ah-atutalas')).replace(/\s+/g, ' '), /Összeg\s*24\.210 Ft/);
    assert.equal(JSON.parse(posztok.find((x) => x.ut === 'ajandek/atutalas').torzs).kedvezmeny, 'JUDIT10');
    const l = await levelek();
    const szalon = l.find((x) => x.cimzett === 'szalon');
    assert.match(szalon.html, /JUDIT10/);
    assert.match(szalon.html, /A kártya értéke/);
    await ctx.close();
  });

  test('ha a szerver elutasitja a kodot a fizeteskor (pl. kikapcsoltak): hibauzenet, a kedvezmeny elvesz, a gomb a teljes arat mutatja, fizetes NEM indul', async () => {
    const { p, ctx, posztok } = await nyit('ajandek');
    // a kliens szerint "hamis10" ervenyes (az ellenorzo vegpontot felulirjuk), a /fizetes viszont elutasitja
    await p.route('**/api/ajandek/kedvezmeny', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, kod: 'HAMIS10', szazalek: 10, ertek_ft: 26900, fizetendo_ft: 24210 }) }));
    await fizetesig(p, 'egyeni');
    await kod(p, 'hamis10');
    await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 24.210 Ft');
    await urlapKitolt(p);
    await p.fill('#mock-kartya', '4242 4242 4242 4242');
    await p.click('#ah-fizet-gomb');
    await p.waitForSelector('#ah-kedvezmeny-hiba:not([hidden])');
    assert.match(await p.textContent('#ah-kedvezmeny-hiba'), /nem érvényes/);
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 26.900 Ft');
    assert.equal(await p.evaluate(() => window.__ajandek.allapot()), 'fizetes');
    assert.ok(await p.isVisible('#ah-kedv-nyito'));
    assert.equal(posztok.filter((x) => x.ut === 'ajandek/fizetes').length, 1);
    await ctx.close();
  });

  test('telefonon (390 px): a doboz latszik, a kepernyon belul marad; az ervenyes kod utan is', async () => {
    const { p, ctx, hibak } = await nyit('ajandek', { szeles: 390 });
    await fizetesig(p, 'egyeni');
    assert.ok(await p.isVisible('#ah-kedv'));
    await kod(p, 'meli10');
    await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
    // (a helyi kiszolgalo asztali fejlece 980 px szeles, ezert a teljes oldal szelesseget nem mérjuk: a doboz es a gombok a 390 px-es kepernyon belul maradnak)
    const m = await p.evaluate(() => ['ah-kedv', 'ah-kedv-kesz', 'ah-fizet-gomb', 'ah-kedv-kod'].map((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return [id, Math.round(r.left), Math.round(r.right)]; }));
    for (const [id, bal, jobb] of m) assert.ok(jobb - bal <= 390 - 20, `${id}: ${bal}..${jobb}`);
    assert.equal(await gombSzoveg(p), 'Biztonságos fizetés — 24.210 Ft');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });
});

for (const [oldal, nev] of [['lezeres-ajandekkartya', 'lezer'], ['oxigen-ajandekkartya', 'oxigen']]) {
  describe(`${nev} (/${oldal}): kedvezmenykod`, () => {
    test('a doboz latszik, a kod ervenyes: a fizetendo osszeg a termek arabol 10%-kal kevesebb, a gomb es az osszesito is azt mutatja', async () => {
      const { p, ctx, hibak } = await nyit(oldal);
      const id = await fizetesig(p);
      const eredeti = (await gombSzoveg(p)).replace(/\D/g, '');
      await kod(p, 'zsofi10');
      await p.waitForSelector('#ah-kedv-kesz:not([hidden])');
      const uj = (await gombSzoveg(p)).replace(/\D/g, '');
      assert.equal(Number(uj), Math.round(Number(eredeti) * 0.9));
      assert.equal((await p.textContent('#ah-osszesito-fej-ar')).replace(/\D/g, ''), uj);
      assert.ok(Number(eredeti) > 0 && id);
      assert.deepEqual(hibak, []);
      await ctx.close();
    });
  });
}
