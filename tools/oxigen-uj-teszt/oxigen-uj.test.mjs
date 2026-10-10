// Az UJ oxigenterapia landing (/oxigenterapia-budapest-uj, noindex proba) tesztjei bongeszoben (Playwright), a helyi dist/ ellen.
// Kulso halozati forgalom nincs: minden nem helyi keres le van tiltva, a Salonic oldalait / naptar-API-jat a teszt hamisitja.
//
//   node tools/netlify-build.mjs && node --test tools/oxigen-uj-teszt/oxigen-uj.test.mjs
//
// Kornyezeti valtozok: PLAYWRIGHT_UTVONAL (a playwright csomag helye; alap: /opt/node22/lib/node_modules/playwright vagy a repo node_modules),
// CHROME_UTVONAL (opcionalis bongeszo-futtathato).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const OLDAL = '/oxigenterapia-budapest-uj';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };

function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, '/opt/node22/lib/node_modules/playwright', path.join(GYOKER, 'node_modules', 'playwright'), path.join(GYOKER, 'node_modules', 'playwright-core')].filter(Boolean);
  for (const k of keres) {
    try { return createRequire(import.meta.url)(k); } catch { /* kovetkezo */ }
    try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ }
  }
  throw new Error('playwright nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

const forras = fs.readFileSync(path.join(GYOKER, 'foglalas', 'oxigenterapia-budapest-uj.html'), 'utf8');
const norm = (s) => String(s).replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();
const szoveg = (html) => norm(html.replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?(?:span|b|i|em|strong|u|a)\b[^>]*>/g, '').replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' '));
const ujTartalom = forras.slice(forras.indexOf('<main'), forras.indexOf('</main>'));

let szerver, bazis, bongeszo;
before(async () => {
  assert.ok(fs.existsSync(path.join(GYOKER, 'dist', '_a', 'oxigenterapia-budapest-uj.html')), 'Eloszor: node tools/netlify-build.mjs');
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
  bongeszo = await chromium.launch(process.env.CHROME_UTVONAL ? { executablePath: process.env.CHROME_UTVONAL } : {});
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

const ora = Math.floor(Date.now() / 1000) + 2 * 86400;
const T0 = ora - (ora % 86400) + 9 * 3600;
/** Uj oldal. salonic: 'ok' | 'hiba' (a Salonic oldalai 500-at adnak). Visszaadja a kert Salonic-URL-eket is. */
async function nyit({ szel = 1440, mag = 900, mobil = false, query = '', salonic = 'ok', reduced = false } = {}) {
  const ctx = await bongeszo.newContext({ viewport: { width: szel, height: mag }, ...(reduced ? { reducedMotion: 'reduce' } : {}), ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = []; const kulso = []; const salonicKeres = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => {
    const u = r.request().url();
    kulso.push(u);
    const cors = { 'access-control-allow-origin': '*' };
    if (/salonic\.hu|api\.salonic/.test(u)) salonicKeres.push(u);
    if (salonic === 'hiba' && /salonic\.hu/.test(u)) return r.fulfill({ status: 500, contentType: 'text/plain', headers: cors, body: 'hiba' });
    if (u.includes('api.salonic.hu')) return r.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data: { blocks: { a: { 111: { employeeName: 'Bozsoki - Harangozó Tündi', slots: { s0: { timestamp: T0 }, s1: { timestamp: T0 + 3600 } } }, 222: { employeeName: 'Szűcs Vivien', slots: { s2: { timestamp: T0 + 7200 } } } } } } }) });
    if (u.includes('mosaic-oxigen.salonic.hu/selectSpecialization')) return r.fulfill({ contentType: 'text/html', headers: cors, body: '<a href="/showServices/?placeId=14409&specId=64122" data-name="Első alkalom">x</a><a href="/showServices/?placeId=14409&specId=64128" data-name="Második alkalomtól">y</a>' });
    if (u.includes('specId=64122')) return r.fulfill({ contentType: 'text/html', headers: cors, body: '<input data-id="466110" data-name="Első oxigénterápiás hajkezelés + állapotfelmérés" data-price="29900" data-duration="80" data-employees="111,222"><input data-id="466147" data-name="Hajkamerás állapotfelmérés" data-price="4990" data-duration="30" data-employees="111,222">' });
    if (u.includes('specId=64128')) return r.fulfill({ contentType: 'text/html', headers: cors, body: '<input data-id="466158" data-name="Második alkalomtól oxigénterápia" data-price="26000" data-duration="80" data-employees="111,222">' });
    if (u.includes('mosaic-oxigen.salonic.hu')) return r.fulfill({ contentType: 'text/html', headers: cors, body: '<html></html>' });
    return r.abort();
  });
  await p.goto(bazis + OLDAL + query, { waitUntil: 'load' });
  return { p, ctx, hibak, kulso, salonicKeres };
}
const dl = (p) => p.evaluate(() => window.dataLayer || []);

describe('tartalom (statikus HTML)', () => {
  test('noindex, sajat canonical, magyar nyelv, nincs suti.js / meres-kod', () => {
    assert.match(forras, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(forras, /<link rel="canonical" href="https:\/\/www\.mosaicheadspa\.hu\/oxigenterapia-budapest-uj">/);
    assert.match(forras, /<html lang="hu">/);
    assert.ok(!/suti\.js|googletagmanager|fbq\(|gtag\(/.test(forras.replace(/<!--[\s\S]*?-->/g, '')), 'nincs meres-kod az uj oldalon');
    assert.match(forras, /<!--mh-fejlec-->/);
    assert.match(forras, /<!--mh-lablec-->/);
  });

  test('H1 szo szerint, egyetlen H1', () => {
    assert.equal([...forras.matchAll(/<h1[ >]/g)].length, 1);
    assert.match(forras, /<h1[^>]*>Hullik, ritkul vagy gyorsan zsírosodik a hajad\?<\/h1>/);
  });

  test('a ket CTA szovege (hero es zaro blokk)', () => {
    const gombok = [...forras.matchAll(/<button[^>]*data-foglal="(first_hair|camera_assessment)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => [m[1], szoveg(m[2]).replace(/\s*→$/, '')]);
    const elso = 'Első kezelést foglalok – 29 900 Ft';
    const kamera = 'Hajkamerás állapotfelmérést foglalok – 4 990 Ft';
    assert.ok(gombok.filter(([k, t]) => k === 'first_hair' && t === elso).length >= 2, 'hero + zaro: ' + elso);
    assert.ok(gombok.filter(([k, t]) => k === 'camera_assessment' && t === kamera).length >= 2, 'hero + zaro: ' + kamera);
  });

  test('arak: mind a hat ar es a bérlet-szabalyok; nincs szazalekos kedvezmeny / athuzott ar', () => {
    const t = szoveg(ujTartalom);
    for (const ar of ['29 900 Ft', '4 990 Ft', '26 000 Ft', '130 000 Ft', '260 000 Ft', '289 900 Ft']) assert.ok(t.includes(ar), 'hianyzik: ' + ar);
    assert.match(t, /Bérletet csak személyesen, a szalonban lehet vásárolni/);
    assert.match(t, /1 liter sampon és 1 liter balzsam/);
    assert.ok(!/-\s?\d+\s?%|\d+\s?%-os kedvezmény|\d+\s?% kedvezmény/i.test(t), 'nincs szazalekos kedvezmeny');
    assert.ok(!/<(s|del|strike)[ >]/.test(ujTartalom), 'nincs athuzott ar');
    assert.ok(!/spórolsz/i.test(t));
  });

  test('nincs kombinalt arc+haj kezeles, nincs 95% / 2 millio, nincs online fizetes / checkout / vendegportal', () => {
    const t = szoveg(ujTartalom);
    assert.ok(!/\barc\b|arc\s*\+|\+\s*arc|kombinált|arc és haj|arc \+ haj/i.test(t), 'arc+haj kombinacio');
    assert.ok(!/95\s?%/.test(forras.replace(/<!--[\s\S]*?-->/g, '')), '95% nem lathato (csak komment)');
    assert.ok(!/2 millió|kétmillió/i.test(t));
    assert.match(forras, /REQUIRES_VERIFICATION[^>]*2 millió/);
    assert.ok(!/checkout|bankkártyás fizetés|portál/i.test(t));
    assert.ok(!/vendégportál/i.test(t));
  });

  test('GYIK: 16 kerdes, a jovahagyott szovegek szo szerint', () => {
    const db = [...forras.matchAll(/<details><summary>/g)].length;
    assert.equal(db, 16);
    const t = szoveg(forras);
    for (const m of ['Legkésőbb 48 órával előtte módosíthatod vagy lemondhatod.', 'A kezelés előtti 24 órában kérjük, ne moss hajat.', 'Nincs általános, kezelés utáni hajmosási korlátozás.',
      'Igen, a teljes 4 990 Ft, ha a felméréstől számított 30 napon belül lefoglalod az első kezelést.', 'Az 5 alkalmas bérlet 6 hónapig, a 10 alkalmas 12 hónapig érvényes.']) assert.ok(t.includes(m), m);
  });

  test('nincs kitalalt velemeny-szam, nincs MI-generalt elotte/utana kep; az illusztracio jelolve', () => {
    assert.ok(!/alkalom-kompozicio|miert-foto/.test(forras), 'MI-generalt kompozicio / foto nincs');
    assert.match(forras, /<figcaption class="monitor-felirat">Szemléltető kép<\/figcaption>/);
    assert.ok(!/\d[\d.\s]*\s?Google-vélemény|1\s?266|1\s?255/.test(szoveg(ujTartalom)), 'nincs beegetett velemeny-szam');
  });
});

describe('ar-forras: a HTML [data-ar] / [data-perc] ertekei = a JS konstansai', () => {
  test('JS-sel es JS nelkul is ugyanaz', async () => {
    const { p, ctx } = await nyit();
    const k = await p.evaluate(() => window.MOSAIC_OXYG_AJANLAT);
    const vart = { first_hair: k.AJANLAT.first_hair.ar, camera_assessment: k.AJANLAT.camera_assessment.ar, further_treatment: k.AJANLAT.further_treatment.ar, berlet5: k.CSOMAG.berlet5.ar, berlet10: k.CSOMAG.berlet10.ar, kura: k.CSOMAG.kura.ar };
    assert.deepEqual(vart, { first_hair: 29900, camera_assessment: 4990, further_treatment: 26000, berlet5: 130000, berlet10: 260000, kura: 289900 });
    assert.equal(k.CSOMAG.kura.ar, k.AJANLAT.first_hair.ar + k.CSOMAG.berlet10.ar, '289 900 = 29 900 + 260 000');
    assert.equal(k.CSOMAG.berlet5.ar, 5 * k.AJANLAT.further_treatment.ar);
    assert.equal(k.CSOMAG.berlet10.ar, 10 * k.AJANLAT.further_treatment.ar);
    const ft = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft';
    const jsSzoveg = await p.$$eval('[data-ar]', (l) => l.map((e) => [e.dataset.ar, e.textContent]));
    for (const [kulcs, t] of jsSzoveg) assert.equal(norm(t), ft(vart[kulcs]), 'JS: ' + kulcs);
    await ctx.close();
    const ctx2 = await bongeszo.newContext({ javaScriptEnabled: false });
    const p2 = await ctx2.newPage();
    await p2.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p2.goto(bazis + OLDAL);
    const statikus = await p2.$$eval('[data-ar]', (l) => l.map((e) => [e.dataset.ar, e.textContent]));
    assert.ok(statikus.length > 10);
    for (const [kulcs, t] of statikus) assert.equal(norm(t), ft(vart[kulcs]), 'HTML: ' + kulcs);
    const perc = await p2.$$eval('[data-perc]', (l) => l.map((e) => [e.dataset.perc, e.textContent]));
    for (const [kulcs, t] of perc) assert.equal(norm(t), (kulcs === 'first_hair' ? 80 : 30) + ' perc');
    await ctx2.close();
  });
});

describe('reszponziv', () => {
  for (const [szel, mag, mobil] of [[390, 844, true], [375, 812, true], [820, 1180, false], [1440, 900, false]]) {
    test(`nincs vizszintes gorgetes ${szel} px-en, hibak nelkul, nincs torott kep`, async () => {
      const { p, ctx, hibak, kulso } = await nyit({ szel, mag, mobil });
      await p.waitForTimeout(500);
      await p.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; }));
      await p.waitForFunction(() => [...document.querySelectorAll('main img')].every((i) => i.complete), null, { timeout: 20000 });
      const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth, torott: [...document.querySelectorAll('main img')].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')) }));
      // a kozos (Wix-eredetu) asztali fejlec 820 px-en az eles oldalon is 980 px szeles: ott csak a sajat <main> tartalmat merjuk
      const kilog = await p.evaluate(() => [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest('.ba-sav, .kezelo-sav')).map((e) => e.tagName + '.' + e.className).slice(0, 5));
      assert.deepEqual(kilog, [], 'a main tartalma kilog');
      if (szel !== 820) assert.ok(m.sw <= m.iw, `scrollWidth ${m.sw} > ${m.iw}`);
      assert.deepEqual(m.torott, []);
      assert.deepEqual(hibak, []);
      assert.ok(!kulso.some((u) => /googletagmanager|facebook|google-analytics|tiktok/.test(u)), 'nincs meres-keres');
      await ctx.close();
    });
  }

  test('390 px-en az elso kepernyon (844 px) mindket hero-CTA latszik', async () => {
    const { p, ctx } = await nyit({ szel: 390, mag: 844, mobil: true });
    const r = await p.$$eval('.hero-cta .gomb', (l) => l.map((e) => e.getBoundingClientRect().bottom));
    assert.equal(r.length, 2);
    assert.ok(r.every((b) => b <= 844), 'CTA-k a kepernyon belul: ' + r);
    await ctx.close();
  });

  test('a fokuszalhato elemeknek latszik a fokusz-jelzese (outline), a gombok >= 44 px magasak telefonon', async () => {
    const { p, ctx } = await nyit({ szel: 390, mag: 844, mobil: true });
    const mag = await p.$$eval('.hero-cta .gomb, .panasz', (l) => l.map((e) => e.getBoundingClientRect().height));
    assert.ok(mag.every((h) => h >= 44), 'tap-meret: ' + mag);
    await p.keyboard.press('Tab');
    const css = await p.evaluate(() => { const a = document.activeElement; return a ? getComputedStyle(a).outlineStyle : 'none'; });
    assert.notEqual(css, undefined);
    await ctx.close();
  });
});

describe('foglalo: a CTA-k a lapon belul, a beagyazott foglalohoz gorgetnek', () => {
  for (const [kulcs, gomb, serviceId] of [['first_hair', '.hero-cta [data-foglal="first_hair"]', '466110'], ['camera_assessment', '.hero-cta [data-foglal="camera_assessment"]', '466147']]) {
    test(`${kulcs}: gorget + fokusz, nincs hash / URL-valtozas, a szolgaltatas elore kivalasztva (${serviceId})`, async () => {
      const { p, ctx, hibak, salonicKeres } = await nyit();
      const url0 = p.url();
      const hist0 = await p.evaluate(() => history.length);
      await p.click(gomb);
      await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'foglalo');
      await p.waitForTimeout(1200);
      const top = await p.evaluate(() => document.getElementById('foglalo').getBoundingClientRect().top);
      assert.ok(top >= -5 && top < 200, 'a foglalo a kepernyo tetejen: ' + top);
      assert.equal(p.url(), url0);
      assert.ok(!p.url().includes('#'));
      assert.equal(await p.evaluate(() => history.length), hist0);
      assert.equal(await p.getAttribute('#foglalas', 'data-selected-service'), kulcs);
      assert.match(await p.textContent('#fo-szolg'), kulcs === 'first_hair' ? /80\s+perc.*29\s900/ : /30\s+perc.*4\s990/);
      // a beagyazott motor betoltott (Shadow DOM): szakember-valaszto, majd a naptar a KIVALASZTOTT szolgaltatasra kerdez
      await p.waitForFunction(() => { const h = document.getElementById('foglalo-host'); return h && h.shadowRoot && h.shadowRoot.querySelector('.be-choice, .be-time, .be-nnap, .be-idogomb'); }, null, { timeout: 15000 });
      await p.evaluate(() => { const c = document.getElementById('foglalo-host').shadowRoot.querySelector('.be-choice'); if (c) c.click(); }); // szakember-valaszto (ha van)
      await p.waitForFunction(() => document.getElementById('foglalo-host').shadowRoot.querySelector('.be-time, .be-nnap, .be-idogomb'), null, { timeout: 15000 });
      assert.ok(salonicKeres.some((u) => u.includes('api.salonic.hu') && u.includes('serviceId=' + serviceId)), 'naptar-keres a ' + serviceId + ' szolgaltatasra');
      assert.equal(await p.locator('#fo-mod').isHidden(), true, 'nem tartalek mod');
      const ev = (await dl(p)).map((e) => e.event);
      assert.ok(ev.includes(kulcs === 'first_hair' ? 'click_hero_first' : 'click_hero_camera'));
      assert.ok(ev.includes('booking_start'));
      assert.deepEqual(hibak, []);
      await ctx.close();
    });
  }

  test('billentyuzettel is: Enter a hero CTA-n, csokkentett mozgas mellett is a foglalohoz visz', async () => {
    const { p, ctx } = await nyit({ reduced: true });
    await p.focus('.hero-cta [data-foglal="first_hair"]');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'foglalo');
    const top = await p.evaluate(() => document.getElementById('foglalo').getBoundingClientRect().top);
    assert.ok(top >= -5 && top < 200, 'top=' + top);
    await ctx.close();
  });

  test('a zaro blokk gombja szolgaltatast valt (pressed), telefonon is', async () => {
    const { p, ctx } = await nyit({ szel: 390, mag: 844, mobil: true });
    await p.click('#foglalas [data-foglal="camera_assessment"]');
    await p.waitForTimeout(300);
    assert.equal(await p.getAttribute('#foglalas [data-foglal="camera_assessment"]', 'aria-pressed'), 'true');
    assert.equal(await p.getAttribute('#foglalas [data-foglal="first_hair"]', 'aria-pressed'), 'false');
    assert.equal(await p.getAttribute('#foglalas', 'data-selected-service'), 'camera_assessment');
    await ctx.close();
  });

  test('tartalek (Salonic) mod: kenyszeritve es ha a Salonic nem valaszol; kis felirat + Salonic-link a kivalasztott szolgaltatasra', async () => {
    const { p, ctx } = await nyit({ query: '?foglalo=tartalek' });
    await p.click('.hero-cta [data-foglal="camera_assessment"]');
    await p.waitForSelector('#fo-mod:not([hidden])');
    assert.match(await p.textContent('#fo-mod'), /Tartalék mód/);
    const href = await p.getAttribute('#fo-tartalek-link', 'href');
    assert.match(href, /^https:\/\/mosaic-oxigen\.salonic\.hu\/selectEmployee\/\?placeId=14409&serviceId=466147$/);
    assert.equal(await p.getAttribute('#foglalas', 'data-booking-mode'), 'fallback_salonic');
    await ctx.close();
    const m = await nyit({ salonic: 'hiba' });
    await m.p.click('.hero-cta [data-foglal="first_hair"]');
    await m.p.waitForSelector('#fo-mod:not([hidden])', { timeout: 25000 });
    assert.match(await m.p.getAttribute('#fo-tartalek-link', 'href'), /serviceId=466110/);
    await m.ctx.close();
  });
});

describe('problemakartyak, hozzajarulas, meres', () => {
  test('tobb panasz valaszthato; select_problem esemeny; a data- hook frissul; nincs PII', async () => {
    const { p, ctx } = await nyit();
    await p.click('.panasz[data-panasz="hajhullas_ritkulas"]');
    await p.click('.panasz[data-panasz="korpas_erzekeny"]');
    assert.equal(await p.getAttribute('.panasz[data-panasz="hajhullas_ritkulas"]', 'aria-pressed'), 'true');
    assert.equal(await p.getAttribute('#foglalas', 'data-complaints'), 'hajhullas_ritkulas,korpas_erzekeny');
    assert.match(await p.textContent('#fo-panasz'), /Hajhullás és ritkulás, Korpás vagy érzékeny fejbőr/);
    await p.click('.panasz[data-panasz="hajhullas_ritkulas"]');
    assert.equal(await p.getAttribute('#foglalas', 'data-complaints'), 'korpas_erzekeny');
    const e = await dl(p);
    const sp = e.filter((x) => x.event === 'select_problem');
    assert.equal(sp.length, 3);
    assert.deepEqual(sp.map((x) => x.selected), [true, true, false]);
    assert.ok(e.some((x) => x.event === 'view_oxyg_landing'));
    const azon = e.map((x) => x.event_id);
    assert.equal(new Set(azon).size, azon.length, 'event_id egyedi');
    assert.ok(!/@|\+36|06 20/.test(JSON.stringify(e)), 'nincs PII');
    await ctx.close();
  });

  test('marketing-hozzajarulas: e-mail es SMS kulon, ELORE NEM KIPIPALT, a valtozas dataLayer-be + data- hookba megy', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('#hozzajarulas').isHidden(), true, 'a marketing-hozzajarulas egyelore elrejtve (nincs marketing)');
    await p.evaluate(() => { document.getElementById('hozzajarulas').hidden = false; });
    const allapot = await p.$$eval('input[data-consent]', (l) => l.map((i) => [i.dataset.consent, i.checked]));
    assert.deepEqual(allapot, [['marketing_email', false], ['marketing_sms', false]]);
    await p.check('input[data-consent="marketing_sms"]');
    assert.equal(await p.getAttribute('#foglalas', 'data-consent-sms'), 'true');
    assert.equal(await p.getAttribute('#foglalas', 'data-consent-email'), 'false');
    const k = await p.evaluate(() => window.MOSAIC_OXYG.kontextus());
    assert.deepEqual([k.consent_marketing_email, k.consent_marketing_sms, k.selected_service], [false, true, 'first_hair']);
    const ev = (await dl(p)).filter((x) => x.event === 'consent_marketing_changed');
    assert.equal(ev.length, 1);
    assert.deepEqual([ev[0].channel, ev[0].granted], ['sms', true]);
    await ctx.close();
  });

  test('hozzajarulas rogzitese: a pipa utan e-mail / telefon mezo, a /api/crm/public/hozzajarulas-ra megy; a meresbe nem kerul szemelyes adat; visszavonas is elmegy', async () => {
    const { p, ctx } = await nyit();
    await p.evaluate(() => { document.getElementById('hozzajarulas').hidden = false; });
    const kuldott = [];
    await p.route('**/api/crm/public/hozzajarulas', async (route) => { kuldott.push(JSON.parse(route.request().postData())); await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
    assert.equal(await p.locator('#hozzajarulas-kapcsolat').isHidden(), true, 'pipa nelkul nincs mezo');
    await p.check('input[data-consent="marketing_email"]');
    assert.equal(await p.locator('#hozzajarulas-kapcsolat').isVisible(), true);
    assert.equal(kuldott.length, 0, 'adat nelkul nem megy el');
    await p.fill('#hj-email', 'Vendeg.Teszt@example.com');
    await p.locator('#hj-email').blur();
    await p.waitForFunction(() => /Rögzítettük/.test(document.getElementById('hj-allapot').textContent));
    assert.equal(kuldott.length, 1);
    assert.deepEqual([kuldott[0].email_marketing, kuldott[0].sms_marketing, kuldott[0].kapcsolat.email, kuldott[0].selected_service], [true, false, 'Vendeg.Teszt@example.com', 'first_hair']);
    assert.match(kuldott[0].szoveg_verzio, /^tervezet-/);
    assert.ok(!/@|\+36/.test(JSON.stringify(await dl(p))), 'a dataLayerben nincs szemelyes adat');
    await p.uncheck('input[data-consent="marketing_email"]');
    await p.waitForFunction(() => /visszavontad/.test(document.getElementById('hj-allapot').textContent));
    assert.equal(kuldott.at(-1).email_marketing, false);
    await ctx.close();
  });

  test('a spec esemenyei: click_hero_first / click_hero_camera / booking_start, service_type, stabil event_id', async () => {
    const { p, ctx } = await nyit();
    await p.click('.hero-cta [data-foglal="first_hair"]');
    await p.click('.hero-cta [data-foglal="camera_assessment"]');
    const e = await dl(p);
    const elso = e.find((x) => x.event === 'click_hero_first');
    const kamera = e.find((x) => x.event === 'click_hero_camera');
    assert.equal(elso.service_type, 'first_hair');
    assert.equal(kamera.service_type, 'camera_assessment');
    assert.match(elso.event_id, /^click_hero_first-[0-9a-f]+-\d+$/);
    assert.equal(e.filter((x) => x.event === 'booking_start').length, 2);
    await ctx.close();
  });
});
