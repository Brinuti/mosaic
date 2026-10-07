// Az ANGOL Head Spa oldal (/headspa-budapest-hungary-uj: a founder-voice oldal uj szerkezetben, frissitett adatokkal) bongeszos tesztjei (Playwright).
// Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (szerver.mjs) allitja ossze az oldalt, minden kulso keres tiltott. A tesztek a regi (29,900 HUF, 4,8/5, Betti,
// Salonic-ajandekkartya link, magyar maradvanyok) adatok hianyat es az uj adatok (26,900 / 39,900 / 53,800 HUF, 4.9 / 1,262, +36 20 247 4444, Evelin) meglet vizsgaljak.
//
//   node --test tools/headspa-teszt/angol.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from './szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

const NEV = 'headspa-budapest-hungary-uj';
const FORRAS = fs.readFileSync(path.join(GYOKER, 'foglalas', NEV + '.html'), 'utf8');
const NEZETEK = [['telefon', 390], ['tablet', 768], ['asztal', 1440]];

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

/** Uj oldal: kulso forgalom tiltva (naplozva), hibak gyujtve, a videofajl-kerelmek naplozva. */
async function nyit(nev, { szeles = 1440, suti = false } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], kulso = [], nincs = [], videok = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  p.on('request', (r) => { if (/\.mp4(\?|$)/.test(r.url())) videok.push(r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${bazis}/${nev}`, { waitUntil: 'domcontentloaded' });
  if (suti) await p.getByRole('button', { name: 'Elfogadom' }).click();
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, kulso, nincs, videok };
}
const fajlLetezik = (href) => {
  const ut = href.split(/[?#]/)[0].replace(/^\//, '').replace(/\/$/, '');
  if (!ut) return true;
  return ['klon', 'foglalas'].some((m) => fs.existsSync(path.join(GYOKER, m, ut + '.html'))) || ['foglalo-motor'].includes(ut);
};
const lathatoSzoveg = (p) => p.evaluate(() => document.querySelector('main').innerText.replace(/\s+/g, ' '));
// a lathato szoveg + az alt / aria-label / title attributumok (a kepek es gombok feliratai is angolok legyenek)
const mindenSzoveg = (p) => p.evaluate(() => document.querySelector('main').innerText + '\n' + [...document.querySelectorAll('main [alt], main [aria-label], main [title]')].map((e) => [e.getAttribute('alt'), e.getAttribute('aria-label'), e.getAttribute('title')].filter(Boolean).join('\n')).join('\n') + '\n' + document.title);

describe('/headspa-budapest-hungary-uj (angol oldal)', () => {
  test('betoltodik hibak nelkul: angol cim, <html lang="en">, egyetlen H1, nincs konzol-hiba, 404, torott kep; minden kepnek van alt-ja, szelessege / magassaga', async () => {
    const { p, ctx, hibak, nincs } = await nyit(NEV);
    assert.equal(await p.title(), 'Head Spa Budapest - Hungary - 3rd district.');
    assert.equal(await p.getAttribute('html', 'lang'), 'en');
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.equal((await p.textContent('h1')).replace(/\s+/g, ' ').trim(), "Premium Head Spa experience that you’ll love this much!");
    const torott = await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
    assert.deepEqual(torott, [], 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.equal(await p.$$eval('main img[alt=""]:not(.hatas-kartya img)', (l) => l.filter((i) => !i.closest('.video-kartya')).length), 0, 'a tartalmi kepeknek leiro alt-ja van (csak a diszito ikonoknak / videoposztereknek ures)');
    // (a videoposzterek a rogzitett arányu .video-kartya dobozban allnak, kitoltik azt: ott nem kell width / height)
    assert.deepEqual(await p.$$eval('main img', (l) => l.filter((i) => !i.closest('.video-kartya') && (!i.getAttribute('width') || !i.getAttribute('height'))).map((i) => i.getAttribute('src'))), [], 'minden kepnek van width / height (nincs elrendezes-ugras)');
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    await ctx.close();
  });

  test('uj oldal-szabalyok: noindex + nofollow, sajat (-uj) canonical es og:url, angol meta / og; fejlec / nyelv-jelolo / menu-jelolo / lablec a forrasban; nincs hreflang, nincs a sitemapben, nincs ravezeto link', async () => {
    const { p, ctx } = await nyit(NEV);
    assert.equal(await p.getAttribute('meta[name=robots]', 'content'), 'noindex, nofollow');
    const cim = `https://www.mosaicheadspa.hu/${NEV}`;
    assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), cim);
    assert.equal(await p.getAttribute('meta[property="og:url"]', 'content'), cim);
    assert.equal(await p.getAttribute('meta[property="og:title"]', 'content'), 'Head Spa Budapest - Hungary - 3rd district.');
    const leiras = await p.getAttribute('meta[name=description]', 'content');
    assert.match(leiras, /Budapest’s largest Head Spa salon/);
    assert.match(leiras, /26,900 HUF/);
    assert.equal(await p.getAttribute('meta[property="og:description"]', 'content'), leiras);
    assert.equal(await p.locator('link[rel=alternate][hreflang]').count(), 0, 'hreflang nem kell');
    // a forras: jelolok sorrendben (fejlec, a kovetkezo sorban a nyelv-jelolo, majd az aktiv menu), a vegen a lablec + a szkriptek
    assert.match(FORRAS, /<!--mh-fejlec-->\r?\n<!--mh-nyelv:en-->\r?\n<!--mh-menu-aktiv:\/headspa-budapest-hungary-->/);
    assert.ok(FORRAS.indexOf('<!--mh-lablec-->') > FORRAS.indexOf('</main>'), 'lablec a main utan');
    for (const s of ['/assets/js/klon.js', '/assets/js/headspa-oldal.js', '/assets/js/headspa-en.js', '/assets/css/headspa-oldal.css', '/assets/css/headspa-en.css']) assert.ok(FORRAS.includes(s), s);
    // nincs a sitemapben, es egyetlen oldal sem linkel ra
    assert.ok(!fs.readFileSync(path.join(GYOKER, 'sitemap.xml'), 'utf8').includes(NEV), 'nincs a sitemapben');
    for (const mappa of ['foglalas', 'klon', path.join('klon', 'm')]) {
      for (const f of fs.readdirSync(path.join(GYOKER, mappa)).filter((x) => x.endsWith('.html') && x !== NEV + '.html')) {
        assert.ok(!fs.readFileSync(path.join(GYOKER, mappa, f), 'utf8').includes(NEV), `${mappa}/${f} linkel az -uj oldalra`);
      }
    }
    // betutipusok: Playfair Display + Jost, mint a tobbi uj Head Spa oldalon
    assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
    assert.match(await p.evaluate(() => getComputedStyle(document.body).fontFamily), /Jost/);
    assert.equal(await p.locator('main [id^="comp-"], main wow-image, main [data-mesh-id]').count(), 0, 'nincs Wix-maradvany');
    await ctx.close();
  });

  test('teljesitmeny: a hero (LCP) kep elotoltve es fetchpriority=high, a tobbi kep lazy; a videok csak kattintasra toltodnek (nincs <video> es nincs mp4-keres betoltaskor)', async () => {
    const { p, ctx, videok } = await nyit(NEV);
    const hero = '/assets/img/c2eb0f_ddd52b37c5c54677b2731918f23c3b95.jpg';
    assert.equal(await p.getAttribute('link[rel=preload][as=image]', 'href'), hero);
    assert.equal(await p.getAttribute('link[rel=preload][as=image]', 'fetchpriority'), 'high');
    assert.equal(await p.getAttribute('.hero-kep img', 'src'), hero);
    assert.equal(await p.getAttribute('.hero-kep img', 'fetchpriority'), 'high');
    assert.equal(await p.getAttribute('.hero-kep img', 'loading'), null, 'a hero-kep nem lazy');
    assert.deepEqual(await p.$$eval('main img:not(.hero-kep img)', (l) => l.filter((i) => i.getAttribute('loading') !== 'lazy').map((i) => i.getAttribute('src'))), [], 'minden mas kep lazy');
    assert.equal(await p.locator('video').count(), 0, 'nincs <video> az oldalon betoltaskor');
    assert.deepEqual(videok, [], 'betoltaskor nincs videofajl-keres');
    await ctx.close();
  });

  test('angol szoveg: a regi oldal kulcsmondatai megvannak (alapito, scalp, OXYGENI, therapists, blow-dry, SZEP), a javitott elgepelesek (Hungarian brand)', async () => {
    const { p, ctx } = await nyit(NEV);
    const szoveg = await lathatoSzoveg(p);
    for (const s of [
      'I’m Ferenc István Deák, the founder of MOSAIC Head Spa.', 'Stressed out and never have time for yourself? I know the feeling...',
      'As a business owner for 20 years, specializing in hair care and therapeutic massage', 'Head Spa relaxed me like nothing else ever has!', 'my Oura smart ring detected 16 minutes of "sleep"',
      'Couples Head Spa at MOSAIC', 'Experience this one-of-a-kind, transformative relaxation together at MOSAIC Head Spa Budapest, Hungary!', 'Your scalp gets exactly what it needs!',
      'The 4 most common scalp problems are:', 'Inflamed (seborrhea, psoriasis, eczema) scalp', 'The result is radiantly beautiful hair', 'The effects of regular Head Spa treatments', 'For oily scalp', 'For dry scalp', 'For hair loss',
      'Check out our guests\' videos!', 'We use 100% organic, vegan OXYGENI products', 'OXYGENI, a Hungarian brand, is a pioneer in hair care and trichology.', 'Experienced therapeutic massage therapists pamper you',
      'We welcome you in 270 square meters of space', 'Just like putting together pieces of a MOSAIC you can customize your own Head Spa treatment!', 'Wish Treatment', 'Original Head Spa beds for your ultimate comfort!',
      'We only let you go with a perfect blow-dry!', 'We’re waiting for you in this beautifully renovated salon in Budapest, Hungary', 'We gift you the most beautiful version of yourself.', 'In the photo, our guest Réka Szalai.',
      'We accept SZÉP Cards.', 'Our Head Spa Prices', 'Gift Card in 1 minute!', 'We also offer women\'s haircuts and coloring!',
    ]) assert.ok(szoveg.includes(s), 'hianyzik: ' + s);
    for (const s of ['a hungarian brand', 'headspa bed', 'headspa rooms', '(Of course in MOSAIC)']) assert.ok(!szoveg.includes(s), 'javitatlan elgepeles: ' + s);
    await ctx.close();
  });

  test('az UJ adatok: arak (26,900 / 39,900 / 53,800 HUF, a regi arak athuzva, kb. EUR), ertekeles 4.9 / 1,262 / 1,200+, elerhetoseg +36 20 247 4444, cim, nyitvatartas, e-mail', async () => {
    const { p, ctx } = await nyit(NEV);
    const szoveg = await lathatoSzoveg(p);
    for (const s of ['26,900 HUF', '39,900 HUF', '53,800 HUF', '32,900 HUF', '49,900 HUF', '65,900 HUF', 'approx. €67', 'approx. €100', 'approx. €135', '20% October discount', 'valid until revoked', 'payment is in HUF',
      '4.9/5', '1,262 Google reviews', '1,200+', '+36 20 247 4444', 'mosaicheadspa@gmail.com', '1023 Budapest, Bécsi út 2.', 'Between Kolosy square and Zsigmond square.', 'Monday - Friday: 8:00 – 20:00', 'Saturday: 9:00 - 18:00', 'Sunday: CLOSED',
      'Price: 50 min + 30 min drying', 'Hair-camera scalp diagnostics and consultation – optional, you decide by answering a question']) assert.ok(szoveg.includes(s), 'hianyzik: ' + s);
    // arkartyak: 3 csomag, a regi (athuzott) ar mellett az uj; EGY 50 perces egyeni kezeles (nincs kulon Relax / Hair csomag)
    assert.equal(await p.locator('.csomag').count(), 3);
    assert.deepEqual(await p.$$eval('.csomag h3', (l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), ['50-minute MOSAIC“4 Hands” Head Spa treatment', '50-minute MOSAICHead Spa treatment', '50-minute MOSAICCouples Head Spa treatment']);
    assert.deepEqual(await p.$$eval('.csomag .ar-uj', (l) => l.map((e) => e.textContent.trim())), ['39,900 HUF', '26,900 HUF', '53,800 HUF']);
    assert.deepEqual(await p.$$eval('.csomag .ar-regi s', (l) => l.map((e) => e.textContent.trim())), ['49,900 HUF', '32,900 HUF', '65,900 HUF']);
    assert.deepEqual(await p.$$eval('.csomag .ar-euro', (l) => l.map((e) => e.textContent.trim())), ['approx. €100', 'approx. €67', 'for two · approx. €135']);
    assert.deepEqual(await p.$$eval('.csomag .ar-ido', (l) => l.map((e) => e.textContent.trim())), Array(3).fill('Duration: 50+30 minutes'));
    assert.deepEqual(await p.$$eval('.csomag a.gomb', (l) => l.map((a) => a.getAttribute('href'))), ['/foglalo-motor?business=headspa', '/foglalo-motor?business=headspa', '/foglalo-motor?business=headspa&service=paros']);
    // a hero-ban a mai ar
    assert.equal((await p.innerText('.ar-sav')).replace(/\s+/g, ' ').trim(), 'Price: 50 min + 30 min drying 26,900 HUF approx. €67 regular price 32,900 HUF 20% October discount');
    // telefon / e-mail linkek
    assert.deepEqual(await p.$$eval('main a[href^="tel:"]', (l) => l.map((a) => a.getAttribute('href'))), ['tel:+36202474444']);
    assert.deepEqual(await p.$$eval('main a[href^="mailto:"]', (l) => l.map((a) => a.getAttribute('href'))), ['mailto:mosaicheadspa@gmail.com']);
    // Google-ertekeles jelveny: statikus, a Google Terkepre mutat (a Trustindex-widget magyar velemenyeket mutatna)
    const g = await p.$$eval('a[href*="google.com/maps/search"]', (l) => l.map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })));
    assert.ok(g.length >= 2);
    for (const x of g) { assert.equal(x.href, 'https://www.google.com/maps/search/?api=1&query=MOSAIC%20Head%20Spa%2C%201023%20Budapest%2C%20B%C3%A9csi%20%C3%BAt%202.'); assert.equal(x.target, '_blank'); assert.match(x.rel, /noopener/); }
    assert.equal(await p.locator('#trustindex, iframe.ti-keret').count(), 0, 'nincs (magyar) Trustindex-widget');
    // fodrasz: Evelin, 4 ev, a jelenlegi fodrasz-oldal
    assert.ok(szoveg.includes('MOSAIC Hungary\'s hairstylist Evelin is ready to welcome you with 4 years of experience.'));
    assert.ok(szoveg.includes('Schwarzkopf Igora Royal'));
    await ctx.close();
  });

  test('a REGI adatok es magyar maradvanyok nincsenek: 29,900 / 59,800 HUF, 75 EUR, 4,8/5, Betti, 18 years, Salonic-link, szeansz / Terkep / Egy MOSAIC, magyar betuk, "Click the picture"', async () => {
    const { p, ctx } = await nyit(NEV);
    const szoveg = await mindenSzoveg(p);
    for (const s of ['29,900', '29.900', '59,800', '59.800', '75 EUR', '4,8/5', '4,9/5', 'Betti', '18 years', 'szeánsz', 'szeansz', 'Térkép', 'Egy MOSAIC', 'Időpont', 'Ajándékkártya', 'Foglal', 'Fejmasszázs', 'Hangot rá', 'Click the picture', ' Ft']) {
      assert.ok(!szoveg.includes(s), 'regi / magyar maradvany: ' + s);
    }
    assert.ok(!/[őűŐŰ]/.test(szoveg), 'magyar-specifikus betuk (ő, ű) a lathato szovegben / alt / aria-label / title attributumokban');
    assert.ok(!/[\u{1F449}\u{1F447}\u{1F4CD}\u{1F4B0}\u{1F50E}\u{1F493}\u{1F33F}]/u.test(szoveg), 'dekoracios mutato emojik');
    // a linkek kozott sincs Salonic / magyar-ajandek cim
    const linkek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
    assert.deepEqual(linkek.filter((h) => /salonic/i.test(h)), [], 'nincs Salonic-link');
    assert.ok(!FORRAS.toLowerCase().includes('salonic'), 'a forrasban sincs Salonic');
    assert.ok(!FORRAS.includes('1-oras-mosaic-headspa-kezeles-2544'), 'regi ajandekkartya-link');
    // a forrasban (nem csak a lathato reszben) sincs a regi ar
    for (const s of ['29,900', '29.900', '59,800', '59.800', '4,8/5']) assert.ok(!FORRAS.includes(s), 'a forrasban regi adat: ' + s);
    await ctx.close();
  });

  test('linkek: a foglalas a kozos foglalo-motorra (reteg), a paros gomb a paros-szolgaltatasra, az ajandekkartya a /headspa-ajandekkartya-ra, a fodrasz a /noi-hajfestes-budapest-re; a belso linkek letezo oldalakra', async () => {
    const { p, ctx } = await nyit(NEV);
    const linkek = await p.$$eval('main a[href], .sticky-cta a[href]', (l) => l.map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()]));
    const hrefek = linkek.map((x) => x[0]);
    assert.ok(hrefek.includes('/foglalo-motor?business=headspa'), 'van foglalas-gomb');
    assert.ok(linkek.some(([h, sz]) => h === '/foglalo-motor?business=headspa&service=paros' && /Double Head Spa appointments/.test(sz)), 'paros foglalas-gomb');
    assert.ok(linkek.some(([h, sz]) => h === '/headspa-ajandekkartya' && /Gift card/.test(sz)), 'Gift card gomb');
    assert.ok(linkek.some(([h, sz]) => h === '/headspa-ajandekkartya' && /Buy a gift card/.test(sz)), 'ajandekkartya-vasarlas gomb');
    assert.ok(linkek.some(([h, sz]) => h === '/noi-hajfestes-budapest' && /Book a hair appointment/.test(sz)), 'Evelin / fodrasz gomb');
    for (const h of hrefek) {
      if (h.startsWith('/')) assert.ok(fajlLetezik(h), 'nem letezo belso oldal: ' + h);
      else assert.match(h, /^(https:\/\/www\.google\.com\/maps\/|tel:|mailto:|#)/, 'ismeretlen link: ' + h);
    }
    // a foglalo-gombok magyar feliratai nincsenek: minden foglalas / ajandekkartya gomb angol
    for (const [h, sz] of linkek) if (/^\/(foglalo-motor|headspa-ajandekkartya|noi-hajfestes)/.test(h)) assert.match(sz, /^(Book|Gift|Buy|Double|I want)/, 'angol gombfelirat: ' + sz);
    await ctx.close();
  });

  test('a Google terkep (harmadik fel) a suti-hozzajarulas elott nem toltodik (helykitolto + angol gomb); hozzajarulas utan betoltodik, angol cimmel; nincs tobb kulso keres, mint a lezeres landingen', async () => {
    const alap = await nyit('lezeres-szortelenites-budapest');
    const { p, ctx, kulso } = await nyit(NEV);
    assert.deepEqual(kulso.filter((u) => !alap.kulso.includes(u)), [], 'tobbletkeresek suti nelkul');
    assert.deepEqual(kulso.filter((u) => /google\.com\/maps/.test(u)), [], 'terkep suti nelkul');
    assert.equal(await p.locator('#terkep-hely #terkep-gomb').count(), 1);
    assert.equal((await p.textContent('#terkep-gomb')).trim(), 'Show Google map');
    assert.equal(await p.locator('#terkep iframe').count(), 0);
    await ctx.close(); await alap.ctx.close();
    const t = await nyit(NEV, { suti: true });
    await t.p.waitForSelector('#terkep iframe');
    assert.ok(t.kulso.some((u) => /google\.com\/maps/.test(u)), 'terkep kerese: ' + t.kulso.join(', '));
    assert.match(await t.p.getAttribute('#terkep iframe', 'title'), /^Map: MOSAIC, 1023 Budapest/);
    await t.ctx.close();
  });

  for (const [nev, szeles] of NEZETEK) {
    test(`nincs vizszintes gorgetes (${nev}, ${szeles} px), a szoveg nem logat ki`, async () => {
      const { p, ctx } = await nyit(NEV, { szeles });
      const m = await p.evaluate(() => ({ tobblet: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        kilog: [...document.querySelectorAll('main *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 && !e.closest('.korhinta-sav, .video-modal'); }).slice(0, 5).map((e) => e.tagName + '.' + e.className) }));
      // 768 px-en a (Wix) asztali fejlec es akcios sav sajat, rogzitett szelessege vizszintes tobbletet ad minden oldalon (a regi Wixes oldalakon is): ott csak a tartalom (main) nem logathat ki
      if (szeles !== 768) assert.equal(m.tobblet, 0, 'vizszintes tobblet ' + m.tobblet + ' px');
      assert.deepEqual(m.kilog, []);
      await ctx.close();
    });
  }

  test('a hero: ertekajanlat + ar + ertekeles + a ket gomb + az alapito kepe, mind a fold felett (asztalon es telefonon is latszik a foglalas-gomb)', async () => {
    for (const szeles of [1440, 390]) {
      const { p, ctx } = await nyit(NEV, { szeles });
      const lat = await p.evaluate(() => {
        const f = innerHeight; const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
        return { h1: r('.hero h1'), kep: r('.hero-kep img'), arsav: r('.hero .ar-sav'), g: r('.hero .hero-google'), gomb: r('.hero .gomb-arany'), f };
      });
      assert.ok(lat.h1 && lat.h1.bottom < lat.f, `${szeles}: a H1 latszik`);
      assert.ok(lat.kep && lat.kep.top < lat.f, `${szeles}: a hero-kep latszik`);
      if (szeles >= 1440) assert.ok(lat.gomb.bottom < lat.f, `${szeles}: a foglalas-gomb a fold felett`);
      await ctx.close();
    }
  });

  test('videok: 20 kartya (hero-video, 3 vendeg, bemutato, 15 szeansz-elem), angol cimek; kattintasra felugro lejatszo nyilik angol feliratokkal, a sajat tarhelyrol toltodik, a gombok / Escape bezarnak', async () => {
    const { p, ctx, videok } = await nyit(NEV);
    assert.equal(await p.locator('.video-kartya').count(), 20);
    const adatok = await p.$$eval('.video-kartya', (l) => l.map((b) => [b.dataset.video, b.dataset.poster, b.getAttribute('aria-label')]));
    for (const [v, poszter, al] of adatok) {
      assert.match(v, /^\/assets\/video\/c2eb0f_[0-9a-f]{32}\.mp4$/);
      assert.ok(fs.existsSync(path.join(GYOKER, v)), 'nincs meg a videofajl: ' + v);
      assert.ok(fs.existsSync(path.join(GYOKER, poszter)), 'nincs meg a poszter: ' + poszter);
      assert.match(al, /^Play (guest )?video/, 'angol aria-label: ' + al);
    }
    assert.deepEqual(await p.$$eval('.video-racs:not(.allo) .video-cim', (l) => l.map((e) => e.textContent.trim())), ['Head massage with tools', 'Hand massage', 'Face massage', 'Deep-cleansing hair wash', 'Scalp massage comb', '20-finger head massager', 'Face roller', 'Hair massage round brush', 'Neck massage', 'Custom-mixed hair mask', 'Décolleté massage', 'Rose-quartz scalp comb', 'Circular water-jet therapy', 'Rose-quartz face massage', 'Custom-mixed face mask']);
    assert.deepEqual(videok, [], 'a kattintas elott nincs videofajl-keres');
    for (const nth of [0, 8]) {
      const kartya = p.locator('.video-kartya').nth(nth);
      await kartya.scrollIntoViewIfNeeded();
      await kartya.click();
      await p.waitForSelector('dialog.video-modal[open] video', { timeout: 5000 });
      await p.waitForFunction(() => document.querySelector('dialog.video-modal video').readyState >= 1, null, { timeout: 8000 });
      assert.equal(await p.evaluate(() => document.querySelector('dialog.video-modal video').getAttribute('src')), adatok[nth][0]);
      assert.equal(await p.getAttribute('dialog.video-modal', 'aria-label'), 'Video', 'a lejatszo angol cimkeje');
      assert.equal(await p.getAttribute('dialog.video-modal .video-modal-bezar', 'aria-label'), 'Close', 'a bezaro gomb angol cimkeje');
      assert.ok(videok.includes(adatok[nth][0]), 'a videofajl a kattintasra toltodott');
      if (nth === 0) await p.click('dialog.video-modal .video-modal-bezar'); else await p.keyboard.press('Escape');
      await p.waitForFunction(() => !document.querySelector('dialog.video-modal[open]'));
      await p.waitForFunction(() => !document.querySelector('dialog.video-modal video'), null, { timeout: 3000 }); // bezaras utan nem marad video
    }
    await ctx.close();
  });

  test('korhinta (eredmeny-kepek, a szalon kepei): a kovetkezo / elozo gomb gorget', async () => {
    const { p, ctx } = await nyit(NEV);
    assert.equal(await p.locator('.korhinta').count(), 2);
    for (const k of await p.locator('.korhinta').all()) {
      await k.scrollIntoViewIfNeeded();
      assert.equal(await k.locator('.elozo').isDisabled(), true, 'elol az elozo gomb nem kattinthato');
      await k.locator('.kovetkezo').click();
      await p.waitForFunction((el) => el.querySelector('.korhinta-sav').scrollLeft > 100, await k.elementHandle());
      assert.equal(await k.locator('.elozo').isDisabled(), false);
    }
    await ctx.close();
  });

  test('mobil sticky CTA: a hero elgorgetese utan latszik, angol feliratokkal (Book now / Gift card), a helyszin szekcional eltunik; asztalon nincs', async () => {
    const { p, ctx } = await nyit(NEV, { szeles: 390 });
    assert.equal(await p.evaluate(() => document.getElementById('sticky-cta').classList.contains('lathato')), false, 'a tetejen nincs');
    await p.evaluate(() => window.scrollTo(0, 3000));
    await p.waitForFunction(() => document.getElementById('sticky-cta').classList.contains('lathato'));
    assert.equal(await p.getAttribute('#sticky-cta a.gomb', 'href'), '/foglalo-motor?business=headspa');
    assert.equal((await p.innerText('#sticky-cta a.gomb')).replace(/\s+/g, ' ').trim(), 'Book now →');
    assert.equal((await p.innerText('#sticky-cta .sticky-masodlagos')).replace(/\s+/g, ' ').trim(), 'Gift card');
    assert.equal(await p.getAttribute('#sticky-cta .sticky-masodlagos', 'href'), '/headspa-ajandekkartya');
    await p.waitForFunction(() => Math.round(document.querySelector('#sticky-cta').getBoundingClientRect().bottom) === innerHeight, null, { timeout: 3000 }); // a becsuszas (.25 s) utan a kepernyo aljan ul
    await p.evaluate(() => document.getElementById('helyszin').scrollIntoView());
    await p.waitForFunction(() => !document.getElementById('sticky-cta').classList.contains('lathato'), null, { timeout: 4000 });
    await ctx.close();
    const asztal = await nyit(NEV, { szeles: 1440 });
    assert.equal(await asztal.p.evaluate(() => getComputedStyle(document.getElementById('sticky-cta')).display), 'none');
    await asztal.ctx.close();
  });
});
