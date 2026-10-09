// A szajtetovalas landing (/szajtetovalas-budapest) bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver
// (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt (fejlec / lablec), minden kulso keres tiltott, a Salonic (kezeleslista + naptar-API) es a Trustindex valasza hamisitott.
//
//   PLAYWRIGHT_UTVONAL=/opt/node22/lib/node_modules/playwright/node_modules CHROME_UTVONAL=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node --test tools/szaj-teszt/szaj.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja), FFMPEG (nem kotelezo: a video pixelformatumanak kozvetlen ellenorzesehez).
// Fo szempontok: minden a szajrol szol (nincs szemoldok / szemhej / szempilla a lathato szovegben, a kepek alt-jaiban, a foglalo kezeleslistajan), az arak a Salonic-pillanatkep szerintiek,
// a kepek / a video valodi MOSAIC-anyag es letezik, rejtett (noindex, nincs ra link), a foglalo a szajra elo-szukitett, a kozos kod (/sminktetovalas-budapest) valtozatlanul mukodik.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic', 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();
const olvas = (...r) => fs.readFileSync(path.join(GYOKER, ...r), 'utf8');

const OLDAL = 'szajtetovalas-budapest';
const FORRAS = olvas('foglalas', OLDAL + '.html');
// "szemoldok / szemhej / szempilla" - ezek egyike sem szerepelhet az oldal lathato szovegeben (a szajtetovalas-landing csak a szajrol szol)
const MAS_TERULET = /szemöld|szemold|szemhéj|szemhej|szempill|eyebrow/i;
const SALONIC = JSON.parse(olvas('docs', 'booking-engine', 'SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json'));
const salonic = (id) => SALONIC.services.find((s) => s.salonic_service_id === String(id));
const AQUARELL = salonic(471034), RUZS = salonic(471152);

let szerver, bazis, port, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  port = new URL(bazis).port;
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

// ---- hamis Salonic: a PMU-kezelo kezeleslistaja (a pillanatkep szerint) es a naptar ----
const PMU_KEZELESEK = SALONIC.services.filter((s) => s.business === 'pmu');
const kezelesekHtml = (felulir = {}) => '<html><body>' + PMU_KEZELESEK.map((s) => `<input data-id="${s.salonic_service_id}" data-name="${s.service_name_raw}" data-duration="${s.duration_min}" data-price="${felulir[s.salonic_service_id] ?? s.active_price ?? 0}">`).join('') + '</body></html>';
function hamisNaptar(napok, orak) {
  const slots = {}; let i = 0; const ma = new Date();
  for (const n of napok) for (const h of orak) slots['s' + i++] = { timestamp: Math.floor(Date.UTC(ma.getUTCFullYear(), ma.getUTCMonth(), ma.getUTCDate() + n, h) / 1000) };
  return { status: 'success', data: { blocks: { 24354: { k1: { slots } } } } };
}
const TI_HTML = '<html><body><div class="ti-header"><div class="ti-rating-text"><a href="#">1 300 vélemény</a></div></div></body></html>';
// a MOSAIC-nak a video lejatszasa itt nem tesztelheto (a Chromium nem tud H.264-et): a lejatszast ket oldalrol is felulirjuk
const LEJATSZAS_HAMIS = () => {
  window.__lejatszasok = [];
  HTMLMediaElement.prototype.play = function () { window.__lejatszasok.push({ id: this.id || 'dialog', muted: this.muted }); Object.defineProperty(this, 'paused', { value: false, configurable: true }); return Promise.resolve(); };
  HTMLMediaElement.prototype.pause = function () { Object.defineProperty(this, 'paused', { value: true, configurable: true }); };
};

/** Oldal megnyitasa: kulso forgalom tiltva (naplozva), a Salonic / Trustindex hamisitva. */
async function nyit({ szeles = 1440, oldal = OLDAL, ar = {}, naptar = hamisNaptar([1, 2, 4, 5, 8], [8, 9, 11, 13]), gorgetve = true, mozgas = 'no-preference', lejatszas = false, uaMobil } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, reducedMotion: mozgas, ...(mobil || uaMobil ? { userAgent: UA_MOBIL, isMobile: mobil, hasTouch: mobil } : {}) });
  const p = await ctx.newPage();
  if (lejatszas) await p.addInitScript(LEJATSZAS_HAMIS);
  const hibak = [], kulso = [], nincs = [], naptarKeresek = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(`http://localhost:${port}`)) nincs.push(r.status() + ' ' + r.url().replace(`http://localhost:${port}`, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => {
    const u = r.request().url();
    const cors = { 'access-control-allow-origin': '*' };
    if (u.startsWith('https://mosaic-pmu.salonic.hu/employees/')) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/html' }, body: kezelesekHtml(ar) });
    if (u.startsWith('https://api.salonic.hu/calendar/getAvailableTimes')) { naptarKeresek.push(new URL(u).searchParams); return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(naptar) }); }
    if (u.startsWith('https://cdn.trustindex.io/widgets/')) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/html' }, body: TI_HTML });
    kulso.push(u); return r.abort();
  });
  await p.goto(`http://localhost:${port}/${oldal}`, { waitUntil: 'domcontentloaded' });
  if (gorgetve) {
    await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } window.scrollTo(0, 0); });
    await p.waitForLoadState('networkidle').catch(() => {});
  }
  return { p, ctx, hibak, kulso, nincs, naptarKeresek };
}
const szoveg = async (p) => (await p.evaluate(() => document.querySelector('main').innerText)).replace(/\s+/g, ' ');
const ftSzamok = (t) => [...t.matchAll(/(\d{1,3}(?:[ .\u00a0]\d{3})*)\s*Ft/g)].map((m) => +m[1].replace(/\D/g, ''));

describe('/szajtetovalas-budapest: rejtett alternativ landing', () => {
  test('rejtett: noindex + nofollow, sajat canonical / og:url, nincs sitemap-bejegyzes, sehonnan nincs ra link', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.getAttribute('meta[name=robots]', 'content'), 'noindex, nofollow');
    assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://www.mosaicheadspa.hu/szajtetovalas-budapest');
    assert.equal(await p.getAttribute('meta[property="og:url"]', 'content'), 'https://www.mosaicheadspa.hu/szajtetovalas-budapest');
    // a fejlecbol / lableebol (a build-del osszeallitott oldal) sem mutat ra link
    assert.equal(await p.$$eval('a[href*="szajtetovalas"]', (l) => l.length), 0, 'az oldalon sincs link a szajtetovalas oldalra');
    await ctx.close();
    // forrasfajlok: menu (fejlec / lablec kivonat), sitemapek, robots, mas oldalak, a klon
    const ellenorzendo = [];
    const bejar = (m) => { for (const e of fs.readdirSync(path.join(GYOKER, m), { withFileTypes: true })) { const r = path.join(m, e.name); if (e.isDirectory()) bejar(r); else if (/\.(html|xml|txt)$/.test(e.name)) ellenorzendo.push(r); } };
    for (const m of ['foglalas', 'klon', 'assets/fejlec', 'src', 'tools/wix-sitemap']) if (fs.existsSync(path.join(GYOKER, m))) bejar(m);
    ellenorzendo.push('sitemap.xml', 'robots.txt');
    const talalat = ellenorzendo.filter((f) => f !== path.join('foglalas', OLDAL + '.html') && olvas(f).includes('szajtetovalas'));
    assert.deepEqual(talalat, [], 'ezekben szerepel a szajtetovalas oldal');
  });

  test('utvonal: a /szajtetovalas-budapest az asztali / mobil lapot adja (mint a tobbi oldal), a per jeles cim 301; a build a sajat foglalo-oldalak koze veszi', async () => {
    const { utvonal } = await import(pathToFileURL(path.join(GYOKER, 'netlify/lib/utvonal.js')).href);
    assert.deepEqual(utvonal('/szajtetovalas-budapest', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131'), { atir: '/_a/szajtetovalas-budapest' });
    assert.deepEqual(utvonal('/szajtetovalas-budapest', UA_MOBIL), { atir: '/_m/szajtetovalas-budapest' });
    assert.deepEqual(utvonal('/szajtetovalas-budapest/', 'x'), { atiranyit: '/szajtetovalas-budapest' });
    assert.match(olvas('tools', 'netlify-build.mjs'), /FOGLALO_OLDALAK = new Set\([^)]*'szajtetovalas-budapest\.html'/, 'a build nem rak foglalo-reteget az oldalra (mint a /sminktetovalas-budapest)');
    // a PMU-pixel a sminktetovalas-oldal mintajara erre a cimre is fut (nincs uj pixel); a hirdetesbol erkezo forgalom igy kapja a _fbc / _fbp suti-t
    assert.match(olvas('assets', 'js', 'suti.js'), /\[PIXEL_PMU, '[^']*\bszajtetovalas-budapest\b/);
  });

  test('betoltodik hibak nelkul 1440 / 768 / 390 px-en: egyetlen H1, nincs torott kep / 404 / konzolhiba, nincs vizszintes tulcsordulas', async () => {
    for (const szeles of [1440, 768, 390]) {
      const { p, ctx, hibak, nincs } = await nyit({ szeles });
      assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
      assert.equal((await p.textContent('h1')).trim(), 'Természetes szájtetoválás, ami illik az arcodhoz.');
      // (a nagyito-ablak ures <img>-je kattintasig nem kep: src nelkul kihagyva)
      const torott = await p.$$eval('img[src]', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
      assert.deepEqual(torott, [], `torott kepek (${szeles}px)`);
      assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
      assert.deepEqual(nincs, [], `404-es helyi kereseik (${szeles}px)`);
      assert.deepEqual(hibak, [], `konzolhiba (${szeles}px)`);
      // (a .hv-hatter a hero-kartya elmosott, levagott hattere; a .vel-racs a lapozhato velemeny-sav: szandekosan kilog) telefonon (390): az egesz oldal; 700 px folott a kozos (Wixes) asztali fejlec 980 px szeles minimumu minden oldalon, ezert ott a fejlec nelkuli tartalmat (main + lablec) merjuk
      const tul = await p.evaluate((mobil) => {
        const W = document.documentElement.clientWidth;
        const tartalom = [...document.querySelectorAll('main *, footer *, #comp-m40zyigs *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && !e.closest('#SITE_HEADER, .vel-racs, .hv-hatter'); }).map((e) => e.tagName + '.' + e.className);
        return { doc: document.documentElement.scrollWidth - W, tartalom: tartalom.slice(0, 5), mobil };
      }, szeles < 700);
      assert.deepEqual(tul.tartalom, [], `a tartalom kilog a kepernyorol ${szeles}px-en`);
      if (szeles < 700) assert.ok(tul.doc <= 0, `vizszintes tulcsordulas ${szeles}px-en: ` + tul.doc);
      assert.equal(await p.locator('#SITE_HEADER, header, [id^="comp-"]').count() > 0, true, 'a MOSAIC fejlec megvan');
      assert.ok(await p.locator('footer, [id^="comp-m40"]').count() > 0, 'a MOSAIC lablec megvan');
      await ctx.close();
    }
  });
});

describe('/szajtetovalas-budapest: minden a szajrol szol', () => {
  test('cim, meta leiras, og: es a szekciok cimei a szajtetovalasra szolnak; a szekciok sorrendje a sminktetovalas-oldalé', async () => {
    const { p, ctx } = await nyit();
    const cim = await p.title();
    assert.equal(cim, 'Szájtetoválás Budapest – természetes ajaktetoválás | Töreki Melitta, MOSAIC');
    const leiras = await p.getAttribute('meta[name=description]', 'content');
    assert.match(leiras, /szájtetoválás \(aquarell és rúzs hatású\)/);
    assert.match(leiras, /4–7 hét utáni korrekció az árban, nincs előleg/);
    for (const sz of [cim, leiras, await p.getAttribute('meta[property="og:title"]', 'content'), await p.getAttribute('meta[property="og:description"]', 'content')]) assert.doesNotMatch(sz, MAS_TERULET);
    assert.match(await p.getAttribute('meta[property="og:image"]', 'content'), /c2eb0f_14edf618439f44d88072604878d0cbd6\.jpg$/, 'az og:image szajas kep');
    const h2 = await p.$$eval('main h2', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
    assert.deepEqual(h2, ['Legközelebbi szabad időpontok', 'Melyik helyzet igaz rád?', 'Hármas garancia, hogy nyugodtan dönthess', 'Az eredményt nézd, ne az ígéretet.', 'Mielőtt foglalsz',
      'Időpontfoglalás után 24 órán belül felhívlak', 'Árak', 'Mitől nem lesz mű hatású?', 'Így zajlik — és ennyi idővel számolj', 'Hogyan változik a száj gyógyulás közben?', 'Töreki Melitta',
      'Vendégeim tapasztalatai', 'Gyakori kérdések', 'Foglalj időpontot', 'Hol találsz meg?']);
    // a "Melyik helyzet igaz rad?" harom kartyaja szajra ertelmezve
    const kartyak = await p.$$eval('.helyzet h3', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ').replace(/\u00ad/g, '').trim()));
    assert.deepEqual(kartyak, ['Ez lenne az első szájtetoválásom', 'Van már szájtetoválásom, de fakult vagy elcsúszott', 'Nem tudom, melyik hatás illik hozzám']);
    assert.match(await p.$eval('.helyzetek', (e) => e.innerText), /Aquarell: áttetsző/);
    await ctx.close();
  });

  test('a lathato szovegben (main), az alt / aria-label / title attributumokban es a HTML-forrasban (kommenteken kivul) nincs szemoldok / szemhej / szempilla', async () => {
    const { p, ctx } = await nyit();
    const t = await szoveg(p);
    assert.doesNotMatch(t, MAS_TERULET);
    // az osszes kinyithato GYIK-valasz is (a details zarva van: innerText nem tartalmazza)
    const gyik = await p.$$eval('main details', (l) => l.map((d) => d.textContent).join(' '));
    assert.doesNotMatch(gyik, MAS_TERULET);
    const attr = await p.$$eval('main [alt], main [aria-label], main [title]', (l) => l.map((e) => [e.getAttribute('alt'), e.getAttribute('aria-label'), e.getAttribute('title')].filter(Boolean).join(' ')).join(' | '));
    assert.doesNotMatch(attr, MAS_TERULET);
    const forras = FORRAS.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    assert.doesNotMatch(forras, MAS_TERULET, 'a HTML-forrasban (kommenteken kivul)');
    // a /sminktetovalas-budapest szovegei kozul csak a szajra valo maradt: a "sminktetovalas" szo a velemenyeken (szo szerinti idezet) kivul nem szerepel
    const velemenyenKivul = await p.evaluate(() => { const m = document.querySelector('main').cloneNode(true); for (const e of m.querySelectorAll('.velemenyek')) e.remove(); return m.innerText; });
    assert.doesNotMatch(velemenyenKivul, /sminktetoválás/i);
    for (const k of ['szájtetoválás', 'ajak', 'rúzs', 'aquarell', 'szájforma', 'száj formáj', 'szájtetoválás']) assert.ok(t.toLowerCase().includes(k.toLowerCase()) || k === 'szájforma' || k === 'száj formáj', 'hianyzik: ' + k);
    await ctx.close();
  });

  test('tartalom a szajra: garancia (3 pont), mielott foglalsz, 24 oras hivas, folyamat (konzultacio, szinterv, elorajzolas, jovahagyas, erzestelenites, pigmentalas, gyogyulas, korrekcio 4-7 het), gyogyulas, GYIK', async () => {
    const { p, ctx } = await nyit();
    const t = await szoveg(p);
    for (const k of ['Pontosan olyan lesz, ahogy berajzolom', 'A konzultáción előrajzolom az ajkad formáját és kontúrját', 'Nem a friss színre, hanem a gyógyult eredményre tervezek', 'A korrekció az árban van',
      'Ha régebbi szájtetoválásod van, kérlek, ne foglalj időpontot azonnal', 'A szád formáját pedig berajzolom neked', 'Időpontfoglalás után 24 órán belül felhívlak',
      'Konzultáció és színtervezés', 'Előrajzolom', 'Te hagyod jóvá', 'Érzéstelenítés és pigmentálás', 'Gyógyult eredményre tervezek', 'A korrekció 4–7 hét múlva következik.',
      'Kezelés 2–2,5 óra', 'Gyógyulás 7–10 nap', 'Korrekció 4–7 hét múlva', 'Átmeneti duzzanat is előfordulhat', 'a kezelt terület hámlik', 'Frissen', '4–6 hét']) assert.ok(t.toLowerCase().includes(k.toLowerCase()), 'hianyzik: ' + k);
    const gyik = await p.$$eval('.gyik summary', (l) => l.map((x) => x.textContent.trim()));
    assert.equal(gyik.length, 14);
    for (const k of ['Mennyire fáj a szájtetoválás?', 'Hogyan gyógyul a száj?', 'Mi a különbség az aquarell és a rúzs hatású között?', 'Mi van, ha már van szájtetoválásom?', 'Mire kell figyelnem előtte?']) assert.ok(gyik.includes(k), 'GYIK: ' + k);
    // a szajra vonatkozo szakmai allitasok (herpesz) ovatosak: a kezelo elott atbeszelik, nem igerunk megelozest
    const mire = await p.$$eval('.gyik details', (l) => l.find((d) => /Mire kell figyelnem/.test(d.textContent)).textContent);
    assert.match(mire, /herpesz/i);
    assert.doesNotMatch(mire, /megel[őo]z|gyógyszer(t|ek)? (szed|vegy)/i, 'nincs kitalalt herpesz-megelozesi utasitas');
    // a gyogyulas-szemleltetes: 4 szakasz szaj-rajzzal (nem szemoldok-rajzzal), a videobol idezet Rita szavaival
    assert.equal(await p.locator('.gyogy-sor li .ajak-rajz').count(), 4);
    assert.equal(await p.locator('.szemoldok-rajz').count(), 0);
    assert.match(await p.$eval('.rita-idezet', (e) => e.innerText), /szépen kivilágosodott, végül pontosan azt a természetes árnyalatot kaptam, amit szerettem volna/);
    // nincs kitalalt vendegvelemeny: a velemenyek a Google-velemenyek (szo szerint), Rita videojanak felirata
    const vel = await p.$$eval('.vel .vel-nev', (l) => l.map((x) => x.firstChild.textContent.trim()));
    assert.deepEqual(vel, ['Melitta Farkas', 'Rita', 'Mirtill Bassa', 'Alexandra Fejérpataky']);
    const eredeti = olvas('foglalas', 'sminktetovalas-budapest.html');
    for (const mondat of ['Imádom a számat, amit varázsolt nekem.', 'Fontos szempont volt, hogy természetes legyen – és nagyon elégedett vagyok a végeredménnyel!', 'Melitta nagyon kedves és türelmes, igazi profi! A szalon is gyönyörű!']) {
      assert.ok(eredeti.includes(mondat), 'a velemeny szo szerint a sminktetovalas-oldalrol valo: ' + mondat);
      assert.ok(t.includes(mondat), 'szerepel: ' + mondat);
    }
    await ctx.close();
  });
});

describe('/szajtetovalas-budapest: arak (Salonic)', () => {
  test('csak a ket szajas kezeles szerepel, az arak PONTOSAN a Salonic-pillanatkep szerintiek (99 000 / 110 000 Ft, 120 perc = kb. 2-2,5 ora)', async () => {
    assert.equal(AQUARELL.active_price, 99000);
    assert.equal(RUZS.active_price, 110000);
    assert.equal(AQUARELL.duration_min, 120);
    assert.equal(RUZS.duration_min, 120);
    const { p, ctx } = await nyit({ ar: { 471034: 99000, 471152: 110000 } });
    const kartyak = await p.$$eval('.ar-kartya', (l) => l.map((k) => ({ salonic: k.dataset.salonic, cim: k.querySelector('h3').textContent.trim(), ar: k.querySelector('.ar-most').textContent.replace(/\u00a0/g, ' ').trim(), ido: k.querySelector('.ar-ido').textContent.trim(), gomb: k.querySelector('a').dataset.foglalo })));
    assert.deepEqual(kartyak, [
      { salonic: 'ajak-aquarell', cim: 'Ajak – aquarell', ar: '99 000 Ft', ido: 'kb. 2–2,5 óra', gomb: 'kezeles=ajak-aquarell' },
      { salonic: 'ajak-ruzs', cim: 'Ajak – rúzs hatású', ar: '110 000 Ft', ido: 'kb. 2–2,5 óra', gomb: 'kezeles=ajak-ruzs' }]);
    // a Salonic-szolgaltatas neve tartalmazza a kartya kulcsszavait (a pmu-landing.js igy talalja meg)
    const norm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const [kulcs, s] of [['ajak-aquarell', AQUARELL], ['ajak-ruzs', RUZS]]) assert.ok(kulcs.split('-').every((w) => norm(s.service_name_raw).includes(w)), kulcs);
    // az oldalon (hero, kartyak, GYIK, minden) csak ez a ket ar szerepel; nincs szemoldok- / szemhej-ar, nincs athuzott regi ar
    const t = (await szoveg(p)) + ' ' + (await p.$$eval('main details', (l) => l.map((d) => d.textContent).join(' ')));
    assert.deepEqual([...new Set(ftSzamok(t))].sort((a, b) => a - b), [99000, 110000]);
    assert.ok(t.includes('Szájtetoválás 99 000 Ft-tól') && t.includes('Rúzs hatású: 110 000 Ft'));
    assert.equal(await p.locator('.ar-regi, s, del, .athuzott').count(), 0, 'nincs athuzott ar');
    assert.equal(await p.locator('.ar-kartya').count(), 2);
    // a tartalmazza-lista: konzultacio, szaj formajanak elorajzolasa, kezeles, korrekcio 4-7 het, utoapolasi utmutato; nincs elolegi
    const tartalmaz = await p.$eval('.tartalmaz', (e) => e.innerText.replace(/\s+/g, ' '));
    for (const k of ['Személyes konzultáció', 'Száj formájának előrajzolása', 'A teljes kezelés', 'Korrekció 4–7 hét múlva', 'Utóápolási útmutató']) assert.ok(tartalmaz.includes(k), k);
    assert.ok((await szoveg(p)).includes('Nincs előleg.'));
    await ctx.close();
  });

  test('a kartyak arai a Salonic ELO adatabol frissulnek (ha a Salonic mast ad, az oldal azt mutatja), a HTML-ben levo ertek a tartalek', async () => {
    const { p, ctx } = await nyit({ ar: { 471034: 105000, 471152: 118000 } });
    await p.waitForFunction(() => document.querySelector('.ar-kartya[data-salonic="ajak-ruzs"] .ar-most').textContent.includes('118'));
    assert.equal(await p.$eval('.ar-kartya[data-salonic="ajak-aquarell"] .ar-most', (e) => e.textContent.replace(/\u00a0/g, ' ').trim()), '105 000 Ft');
    assert.equal(await p.$eval('.ar-kartya[data-salonic="ajak-ruzs"] .ar-most', (e) => e.textContent.replace(/\u00a0/g, ' ').trim()), '118 000 Ft');
    await ctx.close();
  });
});

describe('/szajtetovalas-budapest: kepek es video (valodi MOSAIC-anyag, csak a szajrol)', () => {
  const SZAJAS_KEPEK = new Set([
    // a /sminktetovalas-budapest "Szajtetovalas munkaim" galeriaja (Melitta munkai, ajak)
    'c2eb0f_25713721006844f58218e4ffef886773.jpg', 'c2eb0f_d42275837f7b49019058be5fc6649c23.jpg', 'c2eb0f_b6af66c9c7dc4fd3a3b69507ab640a10.jpg', 'c2eb0f_683fa11adf134a6697c321f1d47ba45c.jpg',
    'c2eb0f_014b63526bc644c7a234475fb367a963.jpg', 'c2eb0f_14edf618439f44d88072604878d0cbd6.jpg', 'c2eb0f_3fe0ac48ceea4cb69935ef6bf8a7021b.jpg', 'c2eb0f_fe660eb6a05a46ec9e0ce0eb2850cd5b.jpg',
    // ajak-kozeliek (ugyanezek a kepek kisebb meretben) a "Melyik helyzet igaz rad?" kartyain
    'pmu/ajak-02.jpg', 'pmu/ajak-03.jpg', 'pmu/ajak-06.jpg',
    // Rita vendegvideojanak kepkockai (tools/szaj-teszt/rita-kepek.py)
    'szaj/rita-poszter.jpg', 'szaj/rita-konzultacio.jpg', 'szaj/rita-elorajzolas.jpg', 'szaj/rita-jovahagyas.jpg', 'szaj/rita-pigmentalas.jpg', 'szaj/rita-gyogyult.jpg',
    // Melitta (portre, ismerkedes), a szalon (helyszin) - nem szemoldok-kepek
    'pmu/melitta-portre.jpg', 'pmu/melitta-hivas-2.jpg', 'c2eb0f_00a2f4bd0e9b4325b2d02e77edb874e9.jpg', 'c2eb0f_ac85eea74409484091e12f8d72fbee98.jpg']);

  test('minden lathato kep (img, poszter, galeria, CSS-hatterkep) a szajas / Melitta / szalon kepek koze tartozik, es letezik a repoban; a szemoldok-kepek egyike sem', async () => {
    const { p, ctx } = await nyit();
    const forrasok = await p.$$eval('main img', (l) => l.map((i) => new URL(i.currentSrc || i.src).pathname));
    forrasok.push(...(await p.$$eval('main video', (l) => l.map((v) => new URL(v.poster, location.href).pathname))));
    assert.ok(forrasok.length >= 25, 'sok kep van: ' + forrasok.length);
    for (const f of forrasok) {
      const rel = f.replace(/^\/assets\/img\/(m\/)?/, '');
      assert.ok(SZAJAS_KEPEK.has(rel), 'nem engedelyezett kep: ' + f);
      assert.ok(fs.existsSync(path.join(GYOKER, 'assets', 'img', rel)), 'nincs a repoban: ' + f);
    }
    // a 8 referencia-kep: pontosan a sminktetovalas-oldal szajas galeriajanak 8 kepe, ugyanabban a sorrendben
    const ref = await p.$$eval('#esetek .ref img', (l) => l.map((i) => new URL(i.src).pathname.split('/').pop()));
    const eredeti = [...olvas('foglalas', 'sminktetovalas-budapest.html').matchAll(/<figure class="ref" data-kategoria="ajak"><img src="\/assets\/img\/([^"]+)"/g)].map((m) => m[1]);
    assert.equal(eredeti.length, 8);
    assert.deepEqual(ref, eredeti);
    assert.equal(await p.$$eval('#esetek .ref', (l) => l.filter((f) => f.dataset.kategoria !== 'ajak').length), 0);
    assert.equal(await p.locator('.szuro').count(), 0, 'nincs Szemoldok / Ajak szuro');
    // a CSS-bol betoltott hatterkepek (a Melitta-szekcio, a videokartya) a repoban vannak, es nem a szemoldokos hatterkep
    const css = olvas('assets', 'css', 'szajtetovalas-landing.css').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/url\((\/assets\/[^)]+)\)/g)) assert.ok(fs.existsSync(path.join(GYOKER, m[1])), m[1]);
    assert.doesNotMatch(css, /melitta-munka|szemoldok/);
    // a nagyito (kattintasra nagyban) a szajas kepeket lapozza
    await p.click('#esetek .ref:nth-child(1)');
    assert.equal(await p.$eval('dialog.nagyito', (d) => d.open), true);
    await ctx.close();
  });

  test('a video: assets/video/szajtetovalas-rita.mp4 letezik, kicsi, H.264 (avc1) yuv420p, moov elol (azonnal indul), hanggal; a hero-elem poszterrel, preload=none, nema ismetlodo alapbeallitassal', async () => {
    const f = path.join(GYOKER, 'assets', 'video', 'szajtetovalas-rita.mp4');
    const b = fs.readFileSync(f);
    assert.ok(b.length > 100000 && b.length < 3 * 1024 * 1024, 'meret: ' + b.length);
    // MP4-dobozok: ftyp ... moov ... mdat (a moov az elejen = faststart)
    assert.equal(b.toString('latin1', 4, 8), 'ftyp');
    const moov = b.indexOf('moov'), mdat = b.indexOf('mdat');
    assert.ok(moov > 0 && mdat > moov, 'a moov az mdat elott van');
    assert.ok(b.includes('avc1') && b.includes('avcC'), 'H.264');
    assert.ok(!b.includes('hvc1') && !b.includes('hev1'), 'nem HEVC');
    assert.ok(b.includes('mp4a'), 'van hangsav');
    // az avcC profil: Main (77) / Baseline (66) / Extended (88) csak 4:2:0 lehet; High (100) eseten ffmpeg-gel ellenorizzuk
    const avcC = b.indexOf('avcC');
    const profil = b[avcC + 4 + 1];
    assert.ok([66, 77, 88, 100].includes(profil), 'H.264 profil: ' + profil);
    if (process.env.FFMPEG) {
      let ki = '';
      try { execFileSync(process.env.FFMPEG, ['-hide_banner', '-i', f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { ki = String(e.stderr || ''); }
      assert.match(ki, /Video: h264[^\n]*yuv420p/, 'yuv420p');
    } else assert.ok(profil !== 100, 'High profil eseten add meg a FFMPEG-et (pixelformatum-ellenorzes)');
    const { p, ctx } = await nyit();
    const v = await p.$eval('#hero-video', (e) => ({ poszter: new URL(e.poster).pathname, preload: e.preload, muted: e.muted, loop: e.loop, inline: e.playsInline, src: e.querySelector('source').getAttribute('src'), tipus: e.querySelector('source').type, w: e.getAttribute('width'), h: e.getAttribute('height') }));
    assert.deepEqual(v, { poszter: '/assets/img/szaj/rita-poszter.jpg', preload: 'none', muted: true, loop: true, inline: true, src: '/assets/video/szajtetovalas-rita.mp4', tipus: 'video/mp4', w: '360', h: '640' });
    assert.equal((await p.request.get(`http://localhost:${port}/assets/video/szajtetovalas-rita.mp4`)).status(), 200);
    // a video a hero-ban van (a H1 mellett), allo (9:16) keretben
    const doboz = await p.$eval('#hero-video', (e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    assert.ok(Math.abs(doboz.w / doboz.h - 9 / 16) < 0.02, 'allo keret: ' + JSON.stringify(doboz));
    await ctx.close();
  });
});

describe('/szajtetovalas-budapest: a hero-video mukodese (a lejatszast a teszt hamisitja: a Chromium nem tud H.264-et)', () => {
  test('nyugodt kapcsolaton nema, ismetlodo lejatszas indul; a gomb hanggal, elolrol inditja es a letezo pmu_landing_video esemenyt kuldi', async () => {
    const { p, ctx } = await nyit({ lejatszas: true });
    await p.waitForFunction(() => document.getElementById('hero-videokep').dataset.allapot === 'nema', null, { timeout: 5000 });
    assert.deepEqual(await p.evaluate(() => window.__lejatszasok[0]), { id: 'hero-video', muted: true });
    assert.equal(await p.$eval('#hero-video-gomb .hv-szoveg', (e) => e.textContent), 'Hanggal nézem');
    await p.evaluate(() => { window.dataLayer = window.dataLayer || []; });
    await p.click('#hero-video-gomb');
    const allapot = await p.evaluate(() => ({ a: document.getElementById('hero-videokep').dataset.allapot, muted: document.getElementById('hero-video').muted, loop: document.getElementById('hero-video').loop, controls: document.getElementById('hero-video').controls }));
    assert.deepEqual(allapot, { a: 'hangos', muted: false, loop: false, controls: true });
    assert.ok(await p.evaluate(() => window.dataLayer.some((e) => e.event === 'pmu_landing_video')), 'pmu_landing_video esemeny');
    assert.equal(await p.$eval('#hero-video-gomb', (e) => getComputedStyle(e).display), 'none', 'hangos allapotban a gomb eltunik');
    await ctx.close();
  });

  test('csokkentett mozgasnal nincs automatikus lejatszas: a poszter + "Videó lejátszása" gomb latszik, a gomb hanggal inditja', async () => {
    const { p, ctx } = await nyit({ lejatszas: true, mozgas: 'reduce' });
    await p.waitForTimeout(500);
    assert.equal(await p.$eval('#hero-videokep', (e) => e.dataset.allapot), 'lejatszas');
    assert.deepEqual(await p.evaluate(() => window.__lejatszasok), [], 'nem indult el a lejatszas');
    assert.equal(await p.$eval('#hero-video-gomb .hv-szoveg', (e) => e.textContent), 'Videó lejátszása');
    await p.click('#hero-video-gomb');
    assert.deepEqual(await p.evaluate(() => window.__lejatszasok.map((x) => x.muted)), [false]);
    await ctx.close();
  });

  test('a Melitta-szekcio kartyaja ugyanazt a videot felugro ablakban nyitja (kattintasra toltodik), bezarasra kiurul', async () => {
    const { p, ctx } = await nyit({ lejatszas: true, mozgas: 'reduce' });
    assert.equal(await p.locator('#szaj-video-ablak video').count(), 0, 'kattintas elott nincs video az ablakban');
    await p.click('#szaj-video-gomb');
    assert.equal(await p.$eval('#szaj-video-ablak', (d) => d.open), true);
    assert.equal(await p.$eval('#szaj-video-keret video', (v) => new URL(v.src).pathname), '/assets/video/szajtetovalas-rita.mp4');
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('#szaj-video-ablak video').count(), 0);
    await ctx.close();
  });
});

describe('/szajtetovalas-budapest: foglalas (PMU-foglalo, szajra elo-szukitve) es meres', () => {
  test('a foglalo-gombok es az iframe a szajra szukulnek; a hero / 24 oras szekcio / foglalo kezdokepernyoje nem kinal telefonos visszahivast (mint a sminktetovalas-oldal)', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.getAttribute('#foglalo', 'src'), '/foglalo-pmu?beagyazva=1&terulet=ajak&forras=szajtetovalas-budapest');
    assert.equal(await p.getAttribute('#foglalo', 'data-alap'), '/foglalo-pmu?beagyazva=1&terulet=ajak&forras=szajtetovalas-budapest');
    const gombok = await p.$$eval('[data-foglalo]', (l) => l.map((e) => e.dataset.foglalo));
    for (const g of gombok) assert.match(g, /^(lepes=(szolg|foto|visszahivas)|kezeles=(konzultacio|ajak-aquarell|ajak-ruzs)|lepes=szolg&nap=\d{4}-\d{2}-\d{2}&terulet=ajak)$/, 'foglalo-jelzes: ' + g);
    assert.ok(gombok.includes('kezeles=ajak-aquarell') && gombok.includes('kezeles=ajak-ruzs') && gombok.includes('lepes=foto') && gombok.includes('kezeles=konzultacio'));
    assert.equal(gombok.filter((g) => /szemoldok|szemhej|szempilla/.test(g)).length, 0);
    // visszahivas: csak a "Mielott foglalsz" 3 uton belul (mint a sminktetovalas-oldalon); a hero-ban, a 24 oras szekcioban nincs
    assert.equal(await p.locator('.hero [data-foglalo*="visszahivas"], #hivas [data-foglalo*="visszahivas"], #idopontok-cim [data-foglalo*="visszahivas"]').count(), 0);
    assert.equal(await p.locator('[data-foglalo*="visszahivas"]').count(), 1);
    assert.equal(await p.getAttribute('[data-foglalo*="visszahivas"]', 'data-cta'), 'mielott-telefon');
    // a data-cta nevek: a sminktetovalas-oldal nevei (meres: pmu_landing_cta), uj esemeny-nev nincs
    const cta = await p.$$eval('[data-cta]', (l) => [...new Set(l.map((e) => e.dataset.cta))]);
    const eredetiCta = new Set([...olvas('foglalas', 'sminktetovalas-budapest.html').matchAll(/data-cta="([^"]+)"/g)].map((m) => m[1]).concat(['idopontok-nap']));
    assert.deepEqual(cta.filter((c) => !eredetiCta.has(c)), [], 'ismeretlen data-cta');
    await ctx.close();
  });

  test('a hero "legkozelebbi szabad idopontok" a Salonic AJAK-kezelesenek naptarabol jonnek (471034), a napkartyak a szajra szukitett foglalot nyitjak', async () => {
    const { p, ctx, naptarKeresek } = await nyit();
    await p.waitForSelector('#hero-napok a.nap-kartya');
    assert.equal(await p.locator('#hero-napok a.nap-kartya').count(), 3);
    assert.ok(naptarKeresek.length >= 1 && naptarKeresek.every((q) => q.get('serviceId') === '471034' && q.get('placeId') === '14585'), 'serviceId: ' + naptarKeresek.map((q) => q.get('serviceId')));
    assert.match(await p.getAttribute('#hero-napok a.nap-kartya', 'data-foglalo'), /^lepes=szolg&nap=\d{4}-\d{2}-\d{2}&terulet=ajak$/);
    await ctx.close();
  });

  test('a foglalo az iframe-ben csak a ket ajak-kezelest + a konzultaciot kinalja (szajra szolo feliratokkal); az ar-kartya gombja a kezelest elo-valasztja', async () => {
    const { p, ctx } = await nyit();
    await p.click('.hero a[data-cta="hero-foglalas"]');
    await p.waitForFunction(() => document.getElementById('foglalo').src.includes('lepes=szolg'));
    assert.equal(new URL(await p.getAttribute('#foglalo', 'src'), 'http://x').search, '?beagyazva=1&terulet=ajak&forras=szajtetovalas-budapest&lepes=szolg');
    const keret = p.frames().find((f) => f.url().includes('/foglalo-pmu'));
    await keret.waitForSelector('#kezelesek .kezeles');
    const lista = await keret.$$eval('#kezelesek .kezeles', (l) => l.map((k) => k.innerText.replace(/\s+/g, ' ').trim()));
    assert.equal(lista.length, 3, lista.join(' | '));
    assert.match(lista[0], /^Ajaktetoválás Aquarell · 2–2,5 óra 99 000 Ft$/);
    assert.match(lista[1], /^Ajaktetoválás Rúzs hatású · 2–2,5 óra 110 000 Ft$/);
    assert.match(lista[2], /^Személyes konzultáció/);
    assert.doesNotMatch(lista.join(' '), MAS_TERULET);
    assert.equal(await keret.$eval('#logo', (e) => e.textContent), 'Szájtetoválás időpontfoglalás');
    // az ar-kartya gombja: a kezeles elo-valasztva, rogton az idopont-nezet
    await p.click('.ar-kartya[data-salonic="ajak-ruzs"] a');
    await p.waitForFunction(() => document.getElementById('foglalo').src.includes('kezeles=ajak-ruzs'));
    const keret2 = p.frames().find((f) => f.url().includes('kezeles=ajak-ruzs'));
    await keret2.waitForSelector('#ido-kezeles', { state: 'visible' });
    assert.match(await keret2.$eval('#ido-kezeles', (e) => e.innerText.replace(/\s+/g, ' ')), /Ajaktetoválás – Rúzs hatású/);
    await ctx.close();
  });

  test('a "Fotot kuldok" a szajra szolo fotokuldesre visz: a foglalo "kerdes" / "foto" feliratai szajra szolnak, a regi tetovalas kezelese "Ajaktetovalas"', async () => {
    const { p, ctx } = await nyit();
    await p.click('.helyzet a[data-cta="helyzet-regi"]');
    await p.waitForFunction(() => document.getElementById('foglalo').src.includes('lepes=foto'));
    const keret = p.frames().find((f) => f.url().includes('lepes=foto'));
    await keret.waitForSelector('[data-nezet="foto"]:not([hidden])');
    assert.equal(await keret.$eval('#foto-cim', (e) => e.textContent), 'Tölts fel fotót a jelenlegi szájtetoválásodról');
    assert.equal(await keret.$eval('input[name=elozmeny][value=van] + span', (e) => e.textContent), 'Igen, már van szájtetoválásom – ezt szeretném javíttatni');
    assert.equal(await keret.$eval('.belepo b', (e) => e.textContent), 'Van szájtetoválásod, és javíttatnád?');
    await ctx.close();
  });
});

describe('a kozos kod valtozatlanul mukodik a /sminktetovalas-budapest oldalon (a ?terulet / data-terulet / data-alap jelzesek nelkul minden a regi)', () => {
  test('/sminktetovalas-budapest: szemoldok-naptar (471153 / 471154), iframe-cim valtozatlan, a Drive-videoablak megvan, az arkartyak 5 kezelest mutatnak', async () => {
    const { p, ctx, naptarKeresek, hibak } = await nyit({ oldal: 'sminktetovalas-budapest' });
    await p.waitForSelector('#hero-napok a.nap-kartya');
    assert.ok(naptarKeresek.every((q) => ['471153', '471154'].includes(q.get('serviceId'))), 'szemoldok-kezeles: ' + naptarKeresek.map((q) => q.get('serviceId')));
    assert.match(await p.getAttribute('#hero-napok a.nap-kartya', 'data-foglalo'), /^lepes=szolg&nap=\d{4}-\d{2}-\d{2}$/, 'a regi oldalon nincs terulet-jelzes');
    assert.equal(await p.getAttribute('#foglalo', 'src'), '/foglalo-pmu?beagyazva=1');
    assert.equal(await p.locator('.ar-kartya').count(), 5);
    assert.equal(await p.locator('#video-gomb').count(), 1);
    await p.click('#video-gomb');
    assert.match(await p.$eval('#video-keret iframe', (f) => f.src), /^https:\/\/drive\.google\.com\/file\/d\/1HaOg3JRFZmDfUAJ0rgHAtzW2UndqO09i\/preview$/);
    assert.deepEqual(hibak.filter((h) => !/Failed to fetch|ERR_FAILED/.test(h)), []);
    await ctx.close();
  });

  test('/foglalo-pmu (terulet-jelzes nelkul): minden kezeles (7) latszik, a feliratok sminktetovalasra szolnak; ?terulet=ajak: csak 3, szajra szolo feliratok', async () => {
    const { p, ctx } = await nyit({ oldal: 'foglalo-pmu?beagyazva=1&lepes=szolg', gorgetve: false });
    await p.waitForSelector('#kezelesek .kezeles');
    assert.equal(await p.locator('#kezelesek .kezeles').count(), 7);
    assert.equal(await p.$eval('#logo', (e) => e.textContent), 'Sminktetoválás időpontfoglalás');
    await ctx.close();
    const m = await nyit({ oldal: 'foglalo-pmu?beagyazva=1&terulet=ajak&lepes=szolg', gorgetve: false });
    await m.p.waitForSelector('#kezelesek .kezeles');
    assert.equal(await m.p.locator('#kezelesek .kezeles').count(), 3);
    assert.equal(await m.p.$eval('#logo', (e) => e.textContent), 'Szájtetoválás időpontfoglalás');
    await m.ctx.close();
    // ismeretlen terulet-ertek: figyelmen kivul marad (minden kezeles)
    const x = await nyit({ oldal: 'foglalo-pmu?beagyazva=1&terulet=valami&lepes=szolg', gorgetve: false });
    await x.p.waitForSelector('#kezelesek .kezeles');
    assert.equal(await x.p.locator('#kezelesek .kezeles').count(), 7);
    await x.ctx.close();
  });
});
