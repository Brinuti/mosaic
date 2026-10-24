// A regi Salonic foglalooldalak atiranyitasa a fooldalra (salonic/atiranyitas.js, docs/booking-engine/SALONIC_ATIRANYITAS.md). Valodi Salonic-kapcsolat NELKUL:
// a Salonic-oldalakat (mosaicheadspa / mosaic-hair / mosaic-oxigen / mosaic-elysion / mosaic-pmu .salonic.hu) a bongeszo helyben szolgalja ki
// (Playwright route), a GTM-cimke kodja (docs/booking-engine/gtm-salonic-atiranyitas.html) minden Salonic-dokumentumban lefut, mint a GTM-ben;
// a www.mosaicheadspa.hu-t egy minimalis proba-oldal helyettesiti, a repo-beli salonic/atiranyitas.js-szel. Semmi nem megy ki a halozatra.
//
//   node --test tools/test-salonic-atiranyitas.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Playwright sajat Chromiuma), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORRAS = fs.readFileSync(path.join(GYOKER, 'salonic/atiranyitas.js'), 'utf8');
const GTM_JS = /<script>([\s\S]*?)<\/script>/.exec(fs.readFileSync(path.join(GYOKER, 'docs/booking-engine/gtm-salonic-atiranyitas.html'), 'utf8'))[1];
const SAL = 'https://mosaicheadspa.salonic.hu';
const FOOLDAL = 'https://www.mosaicheadspa.hu/';
const FIOKOK = ['mosaicheadspa', 'mosaic-hair', 'mosaic-oxigen', 'mosaic-elysion', 'mosaic-pmu'];

// ---------- 1. celCim(): a szabalyok (Node, a repo-beli fajlbol) ----------
function celFv() {
  const window = { top: {}, self: null }; window.self = window; // keret: a fajl csak a fuggvenyt adja, nem iranyit
  vm.runInNewContext(FORRAS, { window, URL, location: { href: SAL + '/' }, Date, document: {}, sessionStorage: {} });
  return window.mhSalonicAtiranyitas.celCim;
}

describe('celCim: melyik Salonic-cim hova iranyit', () => {
  const cel = celFv();
  const parok = (h) => { const c = cel(h); return c ? Object.fromEntries(new URL(c).searchParams) : null; };
  const fooldalra = (h) => { const c = cel(h); const u = c && new URL(c); return !!u && u.origin + u.pathname === FOOLDAL; };
  const J = { mh_honnan: 'salonic' };

  test('a user linkje: /selectSpecialization/?placeId=10427 -> a fooldal, csak a jelolo megy tovabb (a placeId nem)', () => {
    assert.equal(fooldalra(SAL + '/selectSpecialization/?placeId=10427'), true);
    assert.deepEqual(parok(SAL + '/selectSpecialization/?placeId=10427'), J);
  });
  test('mind az 5 Mosaic Salonic-fiok foglalooldalai atiranyitanak', () => {
    for (const f of FIOKOK) for (const ut of ['/', '/selectLocation', '/selectSpecialization/?placeId=1', '/showServices/?placeId=1&specId=39592', '/selectEmployee/?placeId=1&serviceId=2&employeeId=-1', '/selectDate/?employeeId=-1&placeId=1&serviceId=2', '/employees/321/?placeId=1']) {
      assert.deepEqual(parok(`https://${f}.salonic.hu${ut}`), J, `${f}${ut}`);
    }
  });
  test('a kattintas-azonositok es az utm_* megmaradnak, a helyszin / kezeles / szakember nem megy at', () => {
    assert.deepEqual(parok(SAL + '/showServices/?placeId=10427&employeeId=123&serviceId=5&fbclid=FB.1&utm_source=facebook&utm_campaign=x'), { ...J, fbclid: 'FB.1', utm_source: 'facebook', utm_campaign: 'x' });
    assert.deepEqual(parok(SAL + '/selectLocation?gclid=G1&gbraid=B1&wbraid=W1&ttclid=T1&msclkid=M1&_gl=abc'), { ...J, gclid: 'G1', gbraid: 'B1', wbraid: 'W1', ttclid: 'T1', msclkid: 'M1' });
    assert.deepEqual(parok(SAL + '/selectDate/?employeeId=-1&placeId=1&serviceId=44&startDate=1792200000&back=%2FselectEmployee%2F'), J);
  });
  test('nagybetus utvonal is atiranyit', () => assert.deepEqual(parok(SAL + '/SelectLocation'), J));
  for (const [nev, h] of [
    ['/guestData/ (adatlap)', '/guestData/?placeId=10427&serviceId=1&employeeId=-1&startDate=1&lang=hu'],
    ['/booking/bookingDetails/<uuid> (A foglalasod)', '/booking/bookingDetails/0a1b2c3d-1111-2222-3333-444455556666'],
    ['/booking/cancelBooking/', '/booking/cancelBooking/?id=1'], ['/booking/deleteSuccess/', '/booking/deleteSuccess/'],
    ['/success/bookingDetails/ (koszonooldal)', '/success/bookingDetails/0a1b2c3d-1111-2222-3333-444455556666'],
    ['/user/login/', '/user/login/?back=%2FselectLocation'], ['/giftcards', '/giftcards'], ['/privacy', '/privacy'], ['/language/set/hu', '/language/set/hu'],
    ['ismeretlen parameter (token)', '/selectLocation?token=abc'], ['ismeretlen parameter (bookingId)', '/?bookingId=99'],
    ['kikerulo parameter', '/selectLocation?mh_nincs_atiranyitas=1'], ['ismeretlen oldal', '/foglalasaim'],
  ]) test(`${nev}: marad`, () => assert.equal(cel(SAL + h), null));
  test('mas Salonic-fiok / tartomany: marad (Medical Piercing, Gyogytorna, admin, a sajat oldal)', () => {
    for (const h of ['https://medicalpiercing.salonic.hu/selectLocation', 'https://a76.salonic.hu/selectLocation', 'https://app.salonic.hu/selectLocation', 'https://www.mosaicheadspa.hu/selectLocation', 'https://mosaicheadspa.salonic.hu.evil.example/selectLocation', 'nem url']) assert.equal(cel(h), null, h);
  });
});

// ---------- 2. bongeszo: a GTM-cimke bejuttatasaval ----------
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), '/opt/node22/lib/node_modules/playwright/node_modules'].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();
let bongeszo;
before(async () => { bongeszo = await chromium.launch({ ...(process.env.CHROME_UTVONAL ? { executablePath: process.env.CHROME_UTVONAL } : {}) }); });
after(async () => { await bongeszo?.close(); });

const SALONIC_OLDAL = '<!doctype html><html><head><meta charset="utf-8"><title>Salonic (proba)</title></head><body><p>Salonic proba-oldal</p></body></html>';
const FOOLDAL_OLDAL = '<!doctype html><html><head><meta charset="utf-8"><title>Mosaic fooldal (proba)</title></head><body><h1>Fooldal</h1>'
  + `<a id="salonic-link" href="${SAL}/selectSpecialization/?placeId=10427">Foglalok a Salonicon</a>`
  + `<iframe id="keret" src="${SAL}/selectSpecialization/?placeId=10427" width="300" height="200"></iframe></body></html>`;

/** Uj kornyezet: a Salonic- es a fooldal-keresek helyben, minden mas eldobva; a GTM-cimke minden Salonic-dokumentumban lefut. */
async function kornyezet({ be = 1, fooldalKerettel = false } = {}) {
  const ctx = await bongeszo.newContext({ viewport: { width: 1280, height: 800 }, locale: 'hu-HU' });
  const nyom = { fajl: [], kulso: [], salonicNemGet: [] };
  await ctx.addInitScript({ content: `if (/\\.salonic\\.hu$/i.test(location.hostname)) document.addEventListener('DOMContentLoaded', function () { ${GTM_JS} });` });
  await ctx.route(/^https?:\/\//, async (r) => {
    const k = r.request(), u = new URL(k.url());
    if (/\.salonic\.hu$/i.test(u.hostname)) {
      if (k.method() !== 'GET') { nyom.salonicNemGet.push(k.method() + ' ' + k.url()); return r.abort(); }
      return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: SALONIC_OLDAL });
    }
    if (u.hostname === 'www.mosaicheadspa.hu') {
      if (u.pathname === '/salonic/atiranyitas.js') {
        let kezdo = '?'; try { const f = k.frame(); kezdo = f === f.page().mainFrame() ? 'fo' : 'keret'; } catch { /* nem megallapithato */ }
        nyom.fajl.push(kezdo);
        return r.fulfill({ status: 200, contentType: 'text/javascript', body: FORRAS.replace(/var BE = \d;/, `var BE = ${be};`) });
      }
      return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fooldalKerettel ? FOOLDAL_OLDAL : FOOLDAL_OLDAL.replace(/<iframe[\s\S]*?<\/iframe>/, '') });
    }
    nyom.kulso.push(k.url()); return r.abort();
  });
  return { ctx, nyom };
}
const fooldalon = (p, ms = 8000) => p.waitForURL(/^https:\/\/www\.mosaicheadspa\.hu\//, { timeout: ms }).then(() => true, () => false);
const marad = async (p, url, ms = 2500) => { await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(ms); return new URL(p.url()).hostname.endsWith('.salonic.hu'); };

describe('bongeszo: a GTM-cimke + salonic/atiranyitas.js', () => {
  test('a user linkje (/selectSpecialization/?placeId=10427) a legfelso ablakban a fooldalra visz, az azonositok megmaradnak, a Vissza gomb nem a Salonicra', async () => {
    const { ctx, nyom } = await kornyezet();
    const p = await ctx.newPage();
    await p.goto(`${SAL}/selectSpecialization/?placeId=10427&fbclid=TESZTFBCLID&gclid=TESZTGCLID&utm_source=facebook&utm_campaign=regi`, { waitUntil: 'commit' });
    assert.equal(await fooldalon(p), true, p.url());
    const u = new URL(p.url());
    assert.equal(u.origin + u.pathname, FOOLDAL);
    assert.equal(u.searchParams.get('mh_honnan'), 'salonic');
    assert.equal(u.searchParams.get('fbclid'), 'TESZTFBCLID'); assert.equal(u.searchParams.get('gclid'), 'TESZTGCLID'); assert.equal(u.searchParams.get('utm_campaign'), 'regi');
    assert.equal(u.searchParams.has('placeId'), false, 'a helyszin nem megy at');
    assert.ok((await p.evaluate(() => history.length)) <= 2, 'location.replace: a Salonic-oldal nincs az elozmenyek kozott');
    assert.deepEqual(nyom.salonicNemGet, [], 'a Salonic fele csak GET mehet');
    assert.deepEqual(nyom.kulso, [], 'mas kulso keres nem ment');
    await ctx.close();
  });

  for (const f of FIOKOK) test(`${f}.salonic.hu: a foglalo-oldal (showServices) a fooldalra visz`, async () => {
    const { ctx } = await kornyezet();
    const p = await ctx.newPage();
    await p.goto(`https://${f}.salonic.hu/showServices/?placeId=1&specId=39592`, { waitUntil: 'commit' });
    assert.equal(await fooldalon(p), true, p.url());
    await ctx.close();
  });

  for (const [nev, ut] of [['/guestData/ (adatlap)', '/guestData/?placeId=10427&serviceId=1&employeeId=-1&startDate=1&lang=hu'], ['/booking/bookingDetails/<uuid>', '/booking/bookingDetails/0a1b2c3d-1111-2222-3333-444455556666'],
    ['/success/bookingDetails/<uuid>', '/success/bookingDetails/0a1b2c3d-1111-2222-3333-444455556666'], ['ismeretlen parameter (token)', '/selectLocation?token=abc'], ['kikerulo parameter', '/selectLocation?mh_nincs_atiranyitas=1']])
    test(`legfelso ablakban NEM iranyit at: ${nev}`, async () => {
      const { ctx } = await kornyezet();
      const p = await ctx.newPage();
      assert.equal(await marad(p, SAL + ut), true, p.url());
      await ctx.close();
    });

  test('mas Salonic-fiok (Medical Piercing) NEM iranyit at, bar a cimke betolti a fajlt (a hostname-szabaly ved)', async () => {
    const { ctx, nyom } = await kornyezet();
    const p = await ctx.newPage();
    assert.equal(await marad(p, 'https://medicalpiercing.salonic.hu/selectLocation'), true);
    assert.ok(nyom.fajl.includes('fo'), 'a cimke a .salonic.hu-n betolti a fajlt');
    await ctx.close();
  });

  test('keretben (a sajat foglalonk iframe-je) a Salonic-oldal NEM iranyit at, es a fajl le sem toltodik a keretben', async () => {
    const { ctx, nyom } = await kornyezet({ fooldalKerettel: true });
    const p = await ctx.newPage();
    await p.goto(FOOLDAL, { waitUntil: 'load' });
    await p.waitForTimeout(3000);
    const keret = p.frames().find((f) => f !== p.mainFrame() && /\.salonic\.hu$/.test(new URL(f.url()).hostname));
    assert.ok(keret, 'a keretben a Salonic-oldal betoltodott: ' + p.frames().map((f) => f.url()).join(' | '));
    assert.match(keret.url(), /\/selectSpecialization\//, 'a keret nem lett atiranyitva');
    assert.equal(new URL(p.url()).hostname, 'www.mosaicheadspa.hu', 'a fo ablak a fooldalon marad');
    assert.ok(!nyom.fajl.includes('keret'), 'a keretben nem toltodik le: ' + nyom.fajl.join(','));
    await ctx.close();
  });

  test('a sajat oldalrol jovo vendeg (a hivatkozo *.mosaicheadspa.hu) szandekosan a Salonicon marad, ebben a lapban tovabbi oldalon is', async () => {
    const { ctx } = await kornyezet({ fooldalKerettel: false });
    const p = await ctx.newPage();
    await p.goto(FOOLDAL, { waitUntil: 'load' });
    await p.click('#salonic-link');
    await p.waitForURL(/\.salonic\.hu\//, { timeout: 8000 });
    await p.waitForTimeout(2500);
    assert.equal(new URL(p.url()).hostname, 'mosaicheadspa.salonic.hu', 'marad a Salonicon: ' + p.url());
    // a lapban a kikerulo megmarad: a Salonic maga is dobja el a hivatkozot a sajat atiranyitasain, a kovetkezo oldal sem iranyit at
    assert.equal(await marad(p, SAL + '/showServices/?placeId=10427'), true);
    await ctx.close();
  });

  test('hurok-vedelem: ugyanaz a cim 30 mp-en belul masodszor nem iranyit at', async () => {
    const { ctx } = await kornyezet();
    const p = await ctx.newPage();
    const cim = `${SAL}/selectLocation?utm_source=hurok`;
    await p.goto(cim, { waitUntil: 'commit' });
    assert.equal(await fooldalon(p), true);
    assert.equal(await marad(p, cim), true, 'a masodik erkezes ugyanarra a cimre: marad');
    await ctx.close();
  });

  test('BE = 0 (kikapcsolt allapot): semmi nem iranyit at', async () => {
    const { ctx } = await kornyezet({ be: 0 });
    const p = await ctx.newPage();
    assert.equal(await marad(p, `${SAL}/selectSpecialization/?placeId=10427`), true, p.url());
    await ctx.close();
  });
});

describe('a fajl es a cimke', () => {
  test('a repoban a kapcsolo be van kapcsolva (BE = 1), es a cimke a www.mosaicheadspa.hu-rol tolt, hostname-vedelemmel, keretben kilep', () => {
    assert.match(FORRAS, /var BE = 1;/);
    assert.match(GTM_JS, /https:\/\/www\.mosaicheadspa\.hu\/salonic\/atiranyitas\.js/);
    assert.match(GTM_JS, /window\.top !== window\.self/);
    assert.match(GTM_JS, /\\\.salonic\\\.hu\$/);
  });
  test('a fajl nem kuld semmit: nincs fetch / XHR / sendBeacon / dataLayer / localStorage', () => {
    for (const tiltott of [/\bfetch\(/, /XMLHttpRequest/, /sendBeacon/, /dataLayer/, /localStorage/, /\bgtag\(/, /\bfbq\(/, /\bttq\./]) assert.ok(!tiltott.test(FORRAS), String(tiltott));
  });
});
