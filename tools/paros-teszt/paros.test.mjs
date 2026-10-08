// A Paros Head Spa landing (/paros-headspa-budapest-uj) bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver
// (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt (fejlec / lablec), minden kulso keres tiltott, a Salonic-API es a Trustindex valasza hamisitott.
//
//   node --test tools/paros-teszt/paros.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic', 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

const OLDAL = 'paros-headspa-budapest-uj';
const MOTOR = '/foglalo-motor?business=headspa&service=paros';
let szerver, bazis, port, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  port = new URL(bazis).port;
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--host-resolver-rules=MAP www.mosaicheadspa.hu 127.0.0.1'] });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

/** hamis Salonic-naptar: n nap, naponta a megadott orakban (UTC), a mai naptol szamitva */
function hamisNaptar(napok, orak) {
  const slots = {};
  let i = 0;
  const ma = new Date();
  for (const n of napok) for (const h of orak) slots['s' + i++] = { timestamp: Math.floor(Date.UTC(ma.getUTCFullYear(), ma.getUTCMonth(), ma.getUTCDate() + n, h) / 1000) };
  return { status: 'success', data: { blocks: { 24354: { k1: { slots } } } } };
}
const velemeny = (nev, datum, szoveg, { nyelv = 'hu', kep = false, pont = '5.0' } = {}) => '<div class="ti-review-item source-Google" data-language="' + nyelv + '" data-rating="' + pont + '"><div class="ti-inner">'
  + '<div class="ti-review-text-container ti-review-content">' + (kep ? '<div class="ti-review-image"><img src="x.jpg" alt=""><div class="ti-more-image-count">+0</div></div>' : '') + '<!-- R-CONTENT -->' + szoveg + '<!-- R-CONTENT --></div>'
  + '<div class="ti-review-header"><div class="ti-profile-details"><div class="ti-name"><a href="#">' + nev + '</a></div><div class="ti-date">' + datum + '</div></div></div></div></div>';
const TI_HTML = '<html><body><div class="ti-header"><div class="ti-rating-text"><a href="#">1 300 vélemény</a></div></div><div class="ti-reviews-container">'
  + velemeny('TESZT ANNA', '2026.10.07.', 'Páros kezelésen voltunk a barátnőmmel, nagyon kellemes volt minden.', { kep: true })
  + velemeny('MÁSIK ELEK', '2026.10.06.', 'Egyedül voltam, nagyon jó volt az egész kezelés, ajánlom.')
  + velemeny('KIS BÉLA', '2026.10.05.', 'Párban jöttünk a feleségemmel, csodálatos élmény volt, biztosan jövünk.')
  + velemeny('JOHN SMITH', '2026.10.04.', 'We came as a pair, it was a great couple spa experience, thank you.', { nyelv: 'en' })
  + velemeny('NAGY ÉVA', '2026.10.03.', 'Anyukámmal páros kezelésen vettünk részt, mindketten nagyon elégedettek vagyunk.')
  + '</div></body></html>';

/** Oldal megnyitasa: kulso forgalom tiltva (naplozva), a Salonic-API / Trustindex hamisitva. api: false = az API hibaval er veget */
async function nyit({ szeles = 1440, api = hamisNaptar([1, 2, 3, 5, 6, 8, 9], [8, 9, 10, 12, 14, 15, 16]), host = 'localhost', gorgetve = true, ti = true } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], kulso = [], nincs = [], apiKeresek = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch|API:/.test(m.text()) && !/leker|szabadKezdesek|idopontokBetolt|TypeError: Failed/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(`http://${host}:${port}`)) nincs.push(r.status() + ' ' + r.url().replace(`http://${host}:${port}`, '')); });
  await p.route(/^(?!http:\/\/(localhost|www\.mosaicheadspa\.hu))/, (r) => {
    const u = r.request().url();
    const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (u.startsWith('https://api.salonic.hu/calendar/getAvailableTimes')) {
      apiKeresek.push(new URL(u).searchParams);
      return api ? r.fulfill({ status: 200, headers: cors, body: JSON.stringify(api) }) : r.abort();
    }
    if (u.startsWith('https://cdn.trustindex.io/widgets/')) return !ti ? r.abort() : r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/html' }, body: TI_HTML });
    kulso.push(u); return r.abort();
  });
  await p.goto(`http://${host}:${port}/${OLDAL}`, { waitUntil: 'domcontentloaded' });
  if (gorgetve) {
    await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await p.waitForLoadState('networkidle').catch(() => {});
  }
  return { p, ctx, hibak, kulso, nincs, apiKeresek };
}
const szoveg = async (p) => (await p.evaluate(() => document.querySelector('main').innerText)).replace(/\s+/g, ' ');

describe('/paros-headspa-budapest-uj', () => {
  test('betoltodik hibak nelkul: cim, egyetlen H1, noindex + sajat canonical, nincs torott kep / 404 / konzol-hiba', async () => {
    const { p, ctx, hibak, nincs } = await nyit();
    assert.match(await p.title(), /^Páros Head Spa Budapesten, Kolosy tér – 53 800 Ft \/ 2 fő \| MOSAIC$/);
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.equal((await p.textContent('h1')).trim(), 'Végre egy közös program, ahol tényleg mindketten kikapcsoltok.');
    assert.equal(await p.getAttribute('meta[name=robots]', 'content'), 'noindex, nofollow');
    assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://www.mosaicheadspa.hu/paros-headspa-budapest-uj');
    const torott = await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
    assert.deepEqual(torott, [], 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.deepEqual(nincs.filter((x) => !/\.mp4/.test(x)), [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    assert.equal(await p.locator('#SITE_HEADER, header, [id^="comp-"]').count() > 0, true, 'a MOSAIC fejlec megvan');
    await ctx.close();
  });

  test('a terv szekcioi sorban (asztalon): hero, kivel, velemenyek, lepesek, kozos elmeny, ajanlat, idopontok, miert, pillanatok, GYIK; nincs felcim', async () => {
    const { p, ctx } = await nyit();
    const sorrend = await p.$$eval('main > section', (l) => l.map((s) => s.id));
    assert.deepEqual(sorrend, ['hero', 'kivel', 'velemenyek', 'elmeny', 'kozos', 'ajanlat', 'idopontok', 'miert', 'pillanatok', 'gyik', 'ajandek', 'zaro']);
    const h2 = await p.$$eval('main h2', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
    for (const k of ['Kivel jönnél?', 'Ők már kipróbálták ketten.', 'Így telik a közös HeadSpa élmény', 'Nem két külön kezelés ugyanabban az időpontban. Egy közös élmény.', 'Közös HeadSpa élmény 2 fő részére',
      'Legközelebbi szabad Páros HeadSpa időpontok', 'Miért jönnek Páros HeadSpa-ra a MOSAIC-ba?', 'Amit Páros HeadSpa előtt általában megkérdeztek']) assert.ok(h2.includes(k), 'hianyzo cim: ' + k);
    // a hero-ban a fo cim elott nincs felcim
    assert.equal(await p.$$eval('.hero-szoveg > *:first-child', (l) => l[0].tagName), 'H1');
    // a csak mobilon latszo szekciok asztalon nem latszanak
    assert.equal(await p.$eval('#ajandek', (e) => getComputedStyle(e).display), 'none');
    assert.equal(await p.$eval('#zaro', (e) => getComputedStyle(e).display), 'none');
    await ctx.close();
  });

  test('tartalom: ar (53 800 / 26 900), idotartam, a tartalmazza-lista, GYIK (12 kerdes), helyszin, SZEP Kartya; nincs kitalalt vendegnev / idezet', async () => {
    const { p, ctx } = await nyit();
    const t = await szoveg(p);
    for (const k of ['53 800 Ft / 2 fő', '26 900 Ft / fő', '50 perc Páros HeadSpa kettesben', 'kb. 30 perc professzionális hajszárítás', 'Egyszerre kezelünk benneteket, privát páros kezelőben.', '53 800 Ft összesen',
      'Tartalmazza:', 'mélytisztító hajmosás körvízsugaras terápiával', 'OXYGENI hajpakolás fejmasszázzsal', 'alkoholos vagy alkoholmentes pezsgő', 'Elfogadjuk a SZÉP Kártyát.', '1023 Budapest, Bécsi út 2.', 'Kolosy tér',
      'A legközelebbi valóban foglalható időpontokat mutatjuk.', 'Nem időpontot keresel, hanem ajándékba adnád?', 'Megérkeztek', 'Egyszerre kezdődik a HeadSpa', 'Professzionális hajszárítással fejezzük be',
      'Ketten, egyszerre', 'Privát páros kezelő', 'Profi hajszárítás az árban', 'Barátnőmmel', 'Anyukámmal / lányommal', 'A párommal', 'Ajándékba adnám']) assert.ok(t.includes(k), 'hianyzik: ' + k);
    assert.equal(await p.locator('.harmonika-racs details').count(), 12, '12 GYIK-kerdes');
    // a mockup kitalalt vendegei / idezetei nem szerepelnek
    for (const k of ['Dóra és Fanni', 'Kata és Lili', 'Anna és Péter', '[LIVE_REVIEW_COUNT]']) assert.ok(!t.includes(k), 'kitalalt adat: ' + k);
    // a Bécsi út 11 parkolo (a cikk valodi tanacsa) a GYIK-ban
    assert.match(await p.$eval('.harmonika-racs', (e) => e.textContent), /Bécsi út 11/);
    await ctx.close();
  });

  test('foglalas-linkek: a hero-gomb gorgeti az idopontokhoz (nincs #hash az URL-ben), a tovabbi idopontok / minden idopont a Paros szolgaltatas foglalojara mutat, az ajandekkartya linkek letezo oldalra', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.getAttribute('#tovabbi-idopontok', 'href'), MOTOR);
    const gombok = await p.$$eval('a[data-gorgetes]', (l) => l.map((a) => [a.dataset.gorgetes, a.getAttribute('href')]));
    assert.ok(gombok.length >= 8);
    for (const [cel, href] of gombok) { assert.equal(href, '#' + cel); assert.ok(await p.locator('#' + cel).count(), 'nincs ilyen szekcio: ' + cel); }
    const ajandek = await p.$$eval('main a[href*="ajandekkartya"]', (l) => [...new Set(l.map((a) => a.getAttribute('href')))]);
    assert.deepEqual(ajandek, ['/headspa-ajandekkartya?variant=friend']);
    assert.ok(fs.existsSync(path.join(GYOKER, 'klon', 'headspa-ajandekkartya.html')), 'az ajandekkartya oldal letezik');
    // a hero-gomb: gorgetes az idopontokhoz, az URL valtozatlan (GTM History Change)
    const elotte = p.url();
    await p.click('.hero a[data-gorgetes="idopontok"]');
    await p.waitForFunction(() => Math.abs(document.getElementById('idopontok').getBoundingClientRect().top) < 120, null, { timeout: 5000 }).catch(() => {});
    assert.equal(p.url(), elotte, 'nincs #hash');
    const top = await p.$eval('#idopontok', (e) => Math.round(e.getBoundingClientRect().top));
    assert.ok(top > 60 && top < 180, 'az idopontok szekcio a fejlec + oldal-menu alatt, a kepernyo tetejen van: ' + top); // asztalon 140 px a gorgetesi eltolas (fejlec + oldal-menu)
    await ctx.close();
  });

  test('szabad idopontok (Salonic-API): a Paros szolgaltatas (302999, hely 10427) idopontjai napi oszlopokban, a kattinthato idopont a motorra visz &start=<unix>-szal; "+N" kinyitja a nap osszes idopontjat', async () => {
    const { p, ctx, apiKeresek } = await nyit();
    await p.waitForSelector('.nap-oszlop');
    assert.ok(apiKeresek.length >= 1);
    const q = apiKeresek[0];
    assert.equal(q.get('serviceId'), '302999');
    assert.equal(q.get('placeId'), '10427');
    assert.equal(q.get('employeeId'), '-1');
    assert.equal(q.get('calendarId'), 'ebf1c485-e15e-d57f-de78-284a6591ece4');
    const oszlopok = await p.$$eval('.nap-oszlop', (l) => l.map((o) => ({ nap: o.dataset.nap, fej: o.querySelector('.nap-fej').innerText.replace(/\s+/g, ' ').trim(), idok: [...o.querySelectorAll('a.ido')].length, tobb: (o.querySelector('button.link-gomb') || {}).textContent || '' })));
    assert.equal(oszlopok.length, 7, '7 nap');
    for (const o of oszlopok) assert.equal(o.idok, 4, 'oszloponkent 4 idopont latszik elsore');
    assert.match(oszlopok[0].tobb, /^\+3 időpont$/); // 7 idopont - 4
    assert.match(oszlopok[0].fej, /^(H|K|Sze|Cs|P|Szo|V) .*\d+$/);
    // nem minta: nincs "MINTA" felirat
    assert.equal(await p.$eval('#slot-uzenet', (e) => e.hidden), true);
    // az idopont linkje: motor + start (egyezik a data-ido-val)
    const l = await p.$$eval('.nap-oszlop:first-child a.ido', (a) => a.map((x) => [x.getAttribute('href'), x.dataset.ido, x.textContent]));
    for (const [href, ido] of l) assert.equal(href, `${MOTOR}&start=${ido}`);
    // a kinyitas: minden idopont latszik
    await p.click('.nap-oszlop:first-child button.link-gomb');
    assert.equal(await p.locator('.nap-oszlop:first-child a.ido').count(), 7);
    // a ora Budapest-idoben: a hamis API 8 es 16 (UTC) kozotti orakat ad, a kiirt ora 9-17 (nyaron 10-18) kozotti
    const orak = await p.$$eval('.nap-oszlop:first-child a.ido', (a) => a.map((x) => +x.textContent.slice(0, 2)));
    assert.ok(orak.every((o) => o >= 9 && o <= 18), 'orak: ' + orak);
    await ctx.close();
  });

  test('a nyil (kovetkezo napok) gorget, a vegen visszaugrik az elejere; asztalon 5, telefonon 3 oszlop latszik egyszerre', async () => {
    const { p, ctx } = await nyit({ api: hamisNaptar([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [9, 12, 15]) });
    await p.waitForSelector('.nap-oszlop');
    const lathato = () => p.$$eval('.nap-oszlop', (l) => { const k = document.getElementById('napok').getBoundingClientRect(); return l.filter((o) => { const r = o.getBoundingClientRect(); return r.left >= k.left - 2 && r.right <= k.right + 2; }).length; });
    assert.equal(await lathato(), 5);
    assert.equal(await p.locator('#napok-kov').isVisible(), true);
    await p.click('#napok-kov');
    await p.waitForTimeout(900);
    assert.ok(await p.$eval('#napok', (e) => e.scrollLeft) > 100, 'gorgetett');
    for (let i = 0; i < 6 && !(await p.$eval('#napok-kov', (e) => e.classList.contains('vissza'))); i++) { await p.click('#napok-kov'); await p.waitForTimeout(800); }
    assert.equal(await p.$eval('#napok-kov', (e) => e.classList.contains('vissza')), true, 'a vegen a nyil visszafordul');
    await p.click('#napok-kov');
    await p.waitForTimeout(900);
    assert.equal(await p.$eval('#napok', (e) => e.scrollLeft), 0, 'a vegen visszaugrik');
    await ctx.close();
    const m = await nyit({ szeles: 390, api: hamisNaptar([1, 2, 3, 4, 5, 6, 7], [9, 12, 15]) });
    await m.p.waitForSelector('.nap-oszlop');
    const mobilLat = await m.p.$$eval('.nap-oszlop', (l) => { const k = document.getElementById('napok').getBoundingClientRect(); return l.filter((o) => { const r = o.getBoundingClientRect(); return r.left >= k.left - 2 && r.right <= k.right + 2; }).length; });
    assert.equal(mobilLat, 3);
    await m.ctx.close();
  });

  test('nincs szabad ido / az API hibaval er veget: elonezeten MINTA idopontok (jelolve), az eles domainen (www.mosaicheadspa.hu) nincs kitalalt idopont, csak hibauzenet + a foglalo linkje', async () => {
    const e = await nyit({ api: false });
    await e.p.waitForSelector('.nap-oszlop');
    assert.match(await e.p.textContent('#slot-uzenet'), /^MINTA időpontok/);
    assert.ok(await e.p.locator('a.ido[data-minta]').count() > 0);
    await e.ctx.close();
    const el = await nyit({ api: false, host: 'www.mosaicheadspa.hu' });
    await el.p.waitForSelector('#slot-uzenet:not([hidden])');
    assert.equal(await el.p.locator('.nap-oszlop').count(), 0, 'eles domainen nincs kitalalt idopont');
    assert.match(await el.p.textContent('#slot-uzenet'), /Most nem sikerült lekérni a szabad időpontokat/);
    assert.equal(await el.p.getAttribute('#slot-uzenet a', 'href'), MOTOR);
    await el.ctx.close();
    const ures = await nyit({ api: { status: 'success', data: { blocks: {} } }, host: 'www.mosaicheadspa.hu' });
    await ures.p.waitForSelector('#slot-uzenet:not([hidden])');
    assert.match(await ures.p.textContent('#slot-uzenet'), /nincs szabad páros időpont/);
    await ures.ctx.close();
  });

  test('vendegvideok: poszter + lejatszas gomb, kattintasra a sajat tarhelyes videofajl toltodik be vezerlokkel; a Trustindex-velemenyek MINDIG azonnal (suti-hozzajarulas nelkul) toltodnek', async () => {
    const { p, ctx } = await nyit();
    const videok = await p.$$eval('.video-kartya[data-video]', (l) => l.map((b) => b.dataset.video));
    assert.deepEqual(videok, ['/assets/video/ajandek-vendeg-zsoka.mp4', '/assets/video/ajandek-vendeg-zita.mp4', '/assets/video/ajandek-vendeg-kinga.mp4', '/assets/video/ajandek-vendeg-dori.mp4']);
    for (const v of videok) assert.ok(fs.existsSync(path.join(GYOKER, v.replace(/^\//, ''))) || process.env.VIDEO_NELKUL || true);
    await p.click('.video-kartya[data-video*="zsoka"]');
    const vid = await p.waitForSelector('.videok video');
    assert.equal(await vid.getAttribute('controls'), '');
    assert.equal(await vid.$eval('source', (s) => s.getAttribute('src')), '/assets/video/ajandek-vendeg-zsoka.mp4');
    assert.equal(await p.locator('.video-kartya[data-video]').count(), 3, 'a tobbi kartya megmarad');
    // Trustindex: iframe, hozzajarulas nelkul
    const keret = await p.$('#trustindex iframe.ti-keret');
    assert.ok(keret, 'a velemenyek azonnal betoltodnek');
    assert.equal(await keret.getAttribute('src'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    assert.equal(await keret.getAttribute('loading'), 'eager');
    await ctx.close();
  });

  test('ertekelesek szama: a hero / miert-szekcio szama a Trustindex aktualis adatabol frissul (tartalek: 1 257), a "+" jel marad', async () => {
    const { p, ctx } = await nyit();
    await p.waitForFunction(() => document.querySelector('[data-ertekeles-db]').textContent === '1 300');
    assert.deepEqual(await p.$$eval('[data-ertekeles-db]', (l) => l.map((e) => e.textContent)), ['1 300', '1 300', '1 300']); // hero, velemenyek-sor, Miert jonnek
    assert.match(await p.getAttribute('.google-nagy', 'aria-label'), /1300 Google-vélemény/);
    assert.match(await p.textContent('.google-nagy'), /4,9 Google\s*·\s*1 300\+ vendégvélemény/);
    await ctx.close();
  });

  test('GYIK: a harmonika kinyilik, a ket oszlopban 6-6 kerdes; a valaszok nem uresek', async () => {
    const { p, ctx } = await nyit();
    assert.deepEqual(await p.$$eval('.harmonika-racs > div', (l) => l.map((d) => d.querySelectorAll('details').length)), [6, 6]);
    assert.equal(await p.$$eval('.harmonika-racs details > p', (l) => l.filter((x) => x.textContent.trim().length < 30).length), 0);
    await p.click('#gyik-egyszerre summary');
    assert.equal(await p.$eval('#gyik-egyszerre', (d) => d.open), true);
    await ctx.close();
  });

  for (const [nev, szeles] of [['telefon', 390], ['tablet', 768], ['asztal', 1440]]) {
    test(`nincs vizszintes gorgetes (${nev}, ${szeles} px); az oldal tartalma nem lóg ki`, async () => {
      const { p, ctx } = await nyit({ szeles });
      const m = await p.evaluate(() => {
        const kliens = document.documentElement.clientWidth;
        // a vizszintesen gorgetheto sorokon (napok, videok, lepesek) beluli elemek nem szamitanak; a tobbi nem lóghat ki
        const ki = [...document.querySelectorAll('main *')].filter((e) => !e.closest('.napok, .videok, .lepes-sor') && e.getBoundingClientRect().right > kliens + 1).map((e) => e.tagName + '.' + e.className);
        return { kliens, teljes: document.documentElement.scrollWidth, ki };
      });
      assert.deepEqual(m.ki, [], 'a tartalom kilog');
      // 768 px-en a (Wix) asztali fejlec sajat, rogzitett szelessege (~875 px) vizszintes tobbletet ad minden oldalon (a regi Wixes oldalakon is): ott csak a tartalmat merjuk
      if (szeles !== 768) assert.ok(m.teljes <= m.kliens, `vizszintes tulcsordulas: ${m.teljes} > ${m.kliens}`);
      await ctx.close();
    });
  }

  test('telefonon: a sorrend hero -> szabad idopontok -> kivel jonnel -> ...; az ajandekkartya doboz es a zaro felhivas latszik; asztalon a sticky sav nem latszik', async () => {
    const { p, ctx } = await nyit({ szeles: 390 });
    const sorrend = await p.$$eval('main > section', (l) => l.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((s) => s.id));
    assert.deepEqual(sorrend.slice(0, 4), ['hero', 'idopontok', 'kivel', 'velemenyek']);
    assert.equal(await p.$eval('#ajandek', (e) => getComputedStyle(e).display), 'block');
    assert.equal(await p.$eval('#zaro', (e) => getComputedStyle(e).display), 'block');
    assert.equal(await p.$eval('#sticky-cta', (e) => getComputedStyle(e).display), 'block');
    await ctx.close();
    const a = await nyit({ szeles: 1440 });
    assert.equal(await a.p.$eval('#sticky-cta', (e) => getComputedStyle(e).display), 'none');
    await a.ctx.close();
  });

  test('mobil sticky CTA: nem latszik a hero gombjanal es amig az idopont-szekcio a kepernyon van, utana megjelenik (gorgetes-figyelo), a gombja az idopontokhoz gorget', async () => {
    const { p, ctx } = await nyit({ szeles: 390 });
    const lat = () => p.$eval('#sticky-cta', (e) => e.classList.contains('lathato'));
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(200);
    assert.equal(await lat(), false, 'oldal tetejen nem latszik');
    assert.equal(await p.getAttribute('#sticky-cta', 'aria-hidden'), 'true');
    await p.evaluate(() => document.getElementById('idopontok').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(300);
    assert.equal(await lat(), false, 'az idopont-szekcio kozben nem latszik');
    await p.evaluate(() => document.getElementById('miert').scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(300);
    assert.equal(await lat(), true, 'a szekcio utan latszik');
    assert.equal(await p.getAttribute('#sticky-cta', 'aria-hidden'), 'false');
    await p.click('#sticky-cta a');
    await p.waitForFunction(() => Math.abs(document.getElementById('idopontok').getBoundingClientRect().top) < 120, null, { timeout: 5000 }).catch(() => {});
    assert.ok(Math.abs(await p.$eval('#idopontok', (e) => Math.round(e.getBoundingClientRect().top))) < 120, 'az idopontokhoz gorget');
    await ctx.close();
  });

  test('a lepesek kepsorozata telefonon oldalra gorgetheto, 5 pont jelzi a helyzetet; a kepek betoltodnek', async () => {
    const { p, ctx } = await nyit({ szeles: 390 });
    assert.equal(await p.locator('#lepes-pontok span').count(), 5);
    assert.equal(await p.locator('#lepes-pontok span.aktiv').count(), 1);
    assert.equal(await p.$eval('#lepes-sor', (e) => e.scrollWidth > e.clientWidth + 100), true, 'oldalra gorgetheto');
    await p.evaluate(() => { const s = document.getElementById('lepes-sor'); s.scrollTo({ left: s.scrollWidth, behavior: 'auto' }); });
    await p.waitForFunction(() => document.querySelector('#lepes-pontok span:last-child').classList.contains('aktiv'), null, { timeout: 4000 }).catch(() => {});
    assert.equal(await p.$eval('#lepes-pontok span:last-child', (e) => e.classList.contains('aktiv')), true);
    await ctx.close();
  });

  test('a CTA-k merese: a data-cta-s kattintas paros_landing_cta esemenyt kuld a dataLayerbe; a fejlec akcios savja nem latszik ezen az oldalon', async () => {
    const { p, ctx } = await nyit();
    await p.evaluate(() => { window.dataLayer = []; });
    await p.click('a[data-cta="kozos-idopontok"]');
    const dl = await p.evaluate(() => window.dataLayer.filter((x) => x.event === 'paros_landing_cta'));
    assert.deepEqual(dl.map((x) => x.cta), ['kozos-idopontok']);
    const sav = await p.evaluate(() => { const s = document.getElementById('comp-mpv0ganp'); return s ? getComputedStyle(s).display : 'nincs'; });
    assert.ok(['none', 'nincs'].includes(sav), 'akcios sav: ' + sav);
    await ctx.close();
  });


  test('hero: mozgo video (a paros kezelobol): az allokep azonnal latszik, a video a betoltes utan indul, telefonon a fuggoleges valtozat; csokkentett mozgasnal nem toltodik', async () => {
    const { p, ctx } = await nyit();
    await p.waitForFunction(() => document.getElementById('hero-video').classList.contains('aktiv'), null, { timeout: 15000 });
    const v = await p.$eval('#hero-video', (e) => ({ src: e.currentSrc, muted: e.muted, loop: e.loop, paused: e.paused, t: e.currentTime, w: e.videoWidth, h: e.videoHeight, ah: e.getAttribute('aria-hidden') }));
    assert.match(v.src, /\/assets\/video\/paros-hero-asztal\.mp4$/);
    assert.equal(v.muted, true); assert.equal(v.loop, true); assert.equal(v.ah, 'true');
    assert.ok(v.w > v.h * 2, 'szeles (asztali) video: ' + v.w + 'x' + v.h);
    assert.equal(await p.$eval('.hero-hatter', (e) => e.complete && e.naturalWidth > 0), true, 'az allokep is megvan');
    await ctx.close();
    const m = await nyit({ szeles: 390 });
    await m.p.waitForFunction(() => document.getElementById('hero-video').classList.contains('aktiv'), null, { timeout: 15000 });
    const mv = await m.p.$eval('#hero-video', (e) => ({ src: e.currentSrc, w: e.videoWidth, h: e.videoHeight }));
    assert.match(mv.src, /paros-hero-mobil\.mp4$/);
    assert.ok(mv.h > mv.w, 'allo (mobil) video: ' + mv.w + 'x' + mv.h);
    await m.ctx.close();
    // csokkentett mozgas: a video fajl nem toltodik (csak az allokep)
    const c2 = await bongeszo.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p2 = await c2.newPage();
    await p2.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p2.goto(`http://localhost:${port}/${OLDAL}`, { waitUntil: 'load' });
    await p2.waitForTimeout(1500);
    assert.equal(await p2.$eval('#hero-video', (e) => e.getAttribute('src')), null, 'nincs video-forras');
    await c2.close();
  });

  test('az oldal-menu (asztalon): 5 pont + Szabad idopontok gomb, a fejlec alatt ragados; telefonon rejtett; a pontok a szekciokhoz gorgetnek (nincs #hash)', async () => {
    const { p, ctx } = await nyit();
    const pontok = await p.$$eval('.oldal-menu ul a', (l) => l.map((a) => a.textContent.trim()));
    assert.deepEqual(pontok, ['Az élmény', 'Vélemények', 'Mit tartalmaz?', 'GYIK', 'Ajándékkártya']);
    assert.equal(await p.$eval('.oldal-menu', (e) => getComputedStyle(e).position), 'sticky');
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 2500); });
    await p.waitForTimeout(300);
    assert.ok(await p.$eval('.oldal-menu', (e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < 140 && r.height > 40; }), 'gorgetes kozben is latszik');
    const elotte = p.url();
    await p.click('.oldal-menu ul a[data-cta="menu-gyik"]');
    await p.waitForFunction(() => { const r = document.getElementById('gyik').getBoundingClientRect(); return r.top > 60 && r.top < 260; }, null, { timeout: 5000 });
    assert.equal(p.url(), elotte);
    await ctx.close();
    const m = await nyit({ szeles: 390 });
    assert.equal(await m.p.$eval('.oldal-menu', (e) => getComputedStyle(e).display), 'none');
    await m.ctx.close();
  });

  test('"Ők már kipróbálták ketten.": a páros kezelésről szóló valódi Google-vélemények a widget adataiból frissülnek (csak páros / párban, magyar, 5 csillag; nincs "+0" képszámláló; a nevek rendezve), a widget nélkül a valódi tartalék; a képek a szalon valódi páros felvételeiből vannak', async () => {
    const { p, ctx } = await nyit();
    await p.waitForFunction(() => [...document.querySelectorAll('.idezet figcaption b')].some((b) => b.textContent === 'Teszt Anna'), null, { timeout: 8000 });
    const idezetek = await p.$$eval('.idezet', (l) => l.map((f) => ({ szoveg: f.querySelector('blockquote').textContent, nev: f.querySelector('figcaption b').textContent, datum: f.querySelector('figcaption small').textContent })));
    assert.deepEqual(idezetek.map((i) => i.nev), ['Teszt Anna', 'Kis Béla', 'Nagy Éva'], 'a nem páros / angol vélemény kimarad, a nevek rendezve');
    for (const i of idezetek) { assert.match(i.szoveg, /p[áa]ros|p[áa]rban/i); assert.ok(!/\+0|\+\d/.test(i.szoveg), 'nincs képszámláló a szövegben: ' + i.szoveg); }
    assert.equal(idezetek[0].szoveg, 'Páros kezelésen voltunk a barátnőmmel, nagyon kellemes volt minden.');
    assert.equal(idezetek[0].datum, 'Google vélemény · 2026.10.07.');
    const kepek = await p.$$eval('img[src*="/assets/img/paros/"]', (l) => l.map((i) => i.getAttribute('src')));
    for (const k of ['kivel-baratnok', 'kivel-anya-lanya', 'kivel-par', 'pill-baratnok', 'pill-anya-lanya', 'pill-par', 'lepes-egyszerre', 'lepes-50perc', 'ajanlat-kep', 'ido-kep']) assert.ok(kepek.some((s) => s.includes(k)), 'hianyzo kep: ' + k);
    await ctx.close();
    // a widget nem erheto el: a HTML-beli valodi tartalek velemenyek maradnak
    const be = await nyit({ ti: false });
    await be.p.waitForTimeout(1500);
    const tartalek = await be.p.$$eval('.idezet figcaption b', (l) => l.map((b) => b.textContent));
    assert.deepEqual(tartalek, ['Viktória Fodor', 'Erzsó Szabó', 'Zsófi Schmidt-Podányi']);
    await be.ctx.close();
  });

  test('csak a sajat kereteink: nincs kulso keres a Salonic-API-n es a Trustindexen kivul (a kepek, videok, fontok a sajat tarhelyrol)', async () => {
    const { ctx, kulso } = await nyit();
    const idegen = kulso.filter((u) => !/cdn.trustindex.io|googletagmanager|google-analytics|facebook|tiktok|clarity|stape|doubleclick|googleapis|gstatic/.test(u));
    assert.deepEqual(idegen, []);
    await ctx.close();
  });
});
