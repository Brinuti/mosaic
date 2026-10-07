// A Head Spa oldalak (ujra-szerkesztett: headspa-budapest, headspa-arak-budapest, head-spa-kedvezmeny, headspa-termekek-oxygeni, head-spa-velemenyek)
// bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (szerver.mjs) allitja ossze az oldalakat, minden kulso keres tiltott.
//
//   node --test tools/headspa-teszt/headspa.test.mjs
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

// nev: a vegleges (eredeti) cim; az uj oldal addig a -uj cimen el (noindex); a cim / H1 / kulcsszovegek a regi oldal tartalmabol valok
const OLDALAK = [
  { nev: 'headspa-budapest', cim: 'A legjobb Head Spa Budapesten? Ilyen a MOSAIC', h1: 'Head Spa Budapest: A MOSAIC Head Spa a legjobb?', videok: 17,
    szoveg: ['Mi az a Head Spa és honnan származik?', 'Mitől más a MOSAIC Head Spa Budapest?', 'Mennyibe kerül és hogy néz ki egy Head Spa kezelés a MOSAIC-ban?', 'Milyen pozitív hatásai vannak a Head Spa-nak?',
      'Kinek ajánlott a Head Spa?', 'Hol van a MOSAIC Head Spa Budapesten és hogy lehet bejutni?', 'Milyen rendszerességgel érdemes headspa-ba járni?', '29.900 Ft', '39.900 Ft', '53.800 Ft',
      'Olvasási idő: 11 perc', 'Zsíros fejbőr esetén', 'Száraz fejbőr esetén', 'Hajhullás esetén', 'Deák Ferenc István', 'A MOSAIC Headspa alapítója', 'Fejmasszázs eszközökkel', 'Személyre kikevert arcpakolás',
      'minden 5. headspa alkalom féláron van', 'a Bécsi út 11-et'] },
  { nev: 'headspa-arak-budapest', cim: 'Head Spa Kezelések árai a MOSAIC-ban', h1: 'Head Spa Csomagok és Árak', videok: 0,
    szoveg: ['Októberben 20% kedvezménnyel!', '39.900 Ft', '26.900 Ft', '53.800 Ft', '49.900 Ft', '65.900 Ft', 'Időtartam: 50+30 perc', 'Hajkamerás diagnosztika és konzultáció', 'Méregtelenítő arcpakolás',
      'Pezsgő alkoholos/alkohol mentes', 'SZÉP Kártyát is elfogadunk', 'Itt találsz meg minket', '1023 Budapest Bécsi út 2.', '06 20 247 4444', 'mosaicheadspa@gmail.com', 'Hétfő - Péntek'] },
  { nev: 'head-spa-kedvezmeny', cim: 'Head Spa Kezelések árai a MOSAIC-ban', h1: '20% OKTÓBERI AKCIÓ minden headspa szeánszra!', videok: 0, noindexEredeti: true,
    szoveg: ['Jelentkezz be headspa kezelésre vagy vásárolj ajándékkártyát 20% kedvezménnyel!', 'AZ AKCIÓ RÉSZLETEI', 'Az Akció visszavonásig tart.', 'ÚJ, limitált szolgáltatás - 4 Kezes Head Spa Ajándékkártya!',
      'Head Spa Csomagok és Árak', 'Októberben MOST 20% kedvezménnyel!', '39.900 Ft', '53.800 Ft', 'SZÉP Kártyát is elfogadunk', 'Google 4,9/5 - Kiváló'] },
  { nev: 'headspa-termekek-oxygeni', cim: 'Head Spa kezelések OXYGENI Termékekkel', h1: 'Organikus, vegán és kemikáliamentes.', videok: 0,
    szoveg: ['A MOSAIC Head Spa az Oxygeni legnagyobb hazai partnerszalonja.', 'Amire a hajadnak a természetből szüksége van.', 'Az OXYGENI Head Spa hatásai', 'Prémium minőségűek', 'Színezék mentesek',
      'Zsíros fejbőr esetén', 'Száraz fejbőr esetén', 'Hajhullás esetén', 'Mélyen tisztítja a fejbőrt, eltávolítja a felesleges faggyút és lerakódásokat.'] },
  { nev: 'head-spa-velemenyek', cim: 'Head Spa vélemények - Milyen ez kezelés?', h1: 'Head Spa vélemények', videok: 15,
    szoveg: ['Ezt mondják visszajáró vendégeink', 'Női lapok akik írtak rólunk', 'NEM fizetett cikkekről van szó.', '5 db videó a teljes 60 perces Head Spa élményről', 'Kipróbáltuk a Mosaic Head Spa kezelését.',
      'Végre egy hely, ahol jólesik, ha birizgálják a hajunkat', 'A Head Spa lehet az önszeretet új szokása', 'Mosaic Head Spa and Hair - élménybeszámoló és interjú!'] },
];
const NEZETEK = [['telefon', 390], ['tablet', 768], ['asztal', 1440]];

let szerver, bazis, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

/** Uj oldal: kulso forgalom tiltva (naplozva), hibak gyujtve. */
async function nyit(nev, { szeles = 1440, suti = false, uj = true } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], kulso = [], nincs = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  await p.goto(`${bazis}/${nev}${uj ? '-uj' : ''}`, { waitUntil: 'domcontentloaded' });
  if (suti) await p.getByRole('button', { name: 'Elfogadom' }).click();
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await p.waitForLoadState('networkidle').catch(() => {});
  return { p, ctx, hibak, kulso, nincs };
}
const fajlLetezik = (href) => {
  const ut = href.split(/[?#]/)[0].replace(/^\//, '').replace(/\/$/, '');
  if (!ut) return true;
  return ['klon', 'foglalas'].some((m) => fs.existsSync(path.join(GYOKER, m, ut + '.html'))) || ['foglalo-motor'].includes(ut);
};

for (const o of OLDALAK) {
  describe(`/${o.nev}-uj`, () => {
    test('betoltodik hibak nelkul: nincs konzol-hiba, 404, torott kep; egyetlen H1; az eredeti oldal cime / H1-je', async () => {
      const { p, ctx, hibak, nincs } = await nyit(o.nev);
      assert.equal(await p.title(), o.cim);
      assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
      assert.equal((await p.textContent('h1')).replace(/\s+/g, ' ').trim(), o.h1);
      const torott = await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
      assert.deepEqual(torott, [], 'torott kepek');
      assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
      assert.deepEqual(nincs, [], '404-es helyi kereseik');
      assert.deepEqual(hibak, []);
      await ctx.close();
    });

    test('a kozos szerkezet: noindex + sajat canonical (a csere elott), fejlec, akcio-sav (a rozsaszin sav helyett), ujszeru oldalstilus, lablec', async () => {
      const { p, ctx } = await nyit(o.nev);
      assert.equal(await p.getAttribute('meta[name=robots]', 'content'), 'noindex, nofollow');
      assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), `https://www.mosaicheadspa.hu/${o.nev}-uj`);
      assert.equal(await p.locator('header, #SITE_HEADER, [id^="comp-"]').count() > 0, true, 'a MOSAIC fejlec megvan');
      assert.equal(await p.locator('a.akcio-sav[href="/head-spa-kedvezmeny"]').count(), 1);
      assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('comp-mpv0ganp') || document.body).display === 'none' || !document.getElementById('comp-mpv0ganp')), true, 'a rozsaszin akcios sav rejtett');
      assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('main h1')).fontFamily), /Playfair Display/);
      assert.match(await p.evaluate(() => getComputedStyle(document.body).fontFamily), /Jost/);
      assert.ok(await p.locator('.sticky-cta').count() === 1);
      assert.ok((await p.textContent('body')).includes('Big in Japan Kft.'), 'lablec');
      // a regi Wixes elemek nincsenek a tartalomban
      assert.equal(await p.locator('main [id^="comp-"], main wow-image, main [data-mesh-id]').count(), 0, 'nincs Wix-maradvany');
      assert.equal((await p.textContent('main')).includes('✔'), false, 'a regi pipa-emojik a modern listaikonokra cserelve');
      await ctx.close();
    });

    test('a regi oldal tartalma megvan (cimek, arak, szovegek)', async () => {
      const { p, ctx } = await nyit(o.nev);
      const szoveg = (await p.evaluate(() => document.querySelector('main').innerText)).replace(/\s+/g, ' ');
      for (const s of o.szoveg) assert.ok(szoveg.includes(s), 'hianyzik: ' + s);
      await ctx.close();
    });

    test('foglalo- es belso linkek: a foglalas a kozos foglalo-motorra (reteg) mutat, a belso linkek letezo oldalakra', async () => {
      const { p, ctx } = await nyit(o.nev);
      const linkek = await p.$$eval('main a[href]', (l) => l.map((a) => a.getAttribute('href')));
      assert.ok(linkek.some((h) => h === '/foglalo-motor?business=headspa'), 'van foglalas-gomb');
      for (const h of linkek) {
        if (h.startsWith('/')) assert.ok(fajlLetezik(h), 'nem letezo belso oldal: ' + h);
        else assert.match(h, /^(https:\/\/|tel:|mailto:|#)/, 'ismeretlen link: ' + h);
      }
      assert.equal(linkek.filter((h) => /salonic/i.test(h)).length, 0, 'nincs kozvetlen Salonic-link');
      await ctx.close();
    });

    test('harmadik fel (Trustindex-ertekelesek, Google terkep) a suti-hozzajarulas elott nem toltodik; nincs tobb kulso keres, mint a lezeres landingen (a kozos fejlec / lablec sajatja)', async () => {
      const alap = await nyit('lezeres-szortelenites-budapest', { uj: false });
      const { ctx, kulso } = await nyit(o.nev);
      assert.deepEqual(kulso.filter((u) => !alap.kulso.includes(u)), [], 'tobbletkeresek suti nelkul');
      assert.deepEqual(kulso.filter((u) => /google\.com\/maps|content\.html|\/widgets\//.test(u)), [], 'terkep / ertekeles-widget suti nelkul');
      await ctx.close(); await alap.ctx.close();
    });

    for (const [nev, szeles] of NEZETEK) {
      test(`nincs vizszintes gorgetes (${nev}, ${szeles} px), a szoveg nem logat ki`, async () => {
        const { p, ctx } = await nyit(o.nev, { szeles });
        const m = await p.evaluate(() => ({ tobblet: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          kilog: [...document.querySelectorAll('main *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 && !e.closest('.korhinta-sav, .video-modal'); }).slice(0, 5).map((e) => e.tagName + '.' + e.className) }));
        // a tablet-szeles asztali fejlec (Wix) sajat vizszintes tobbletet a lezeres landing adja alapnak; a tartalom (main) semmikepp nem logathat ki
        if (szeles === 768) {
          const alap = await nyit('lezeres-szortelenites-budapest', { szeles, uj: false });
          const a = await alap.p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          await alap.ctx.close();
          assert.ok(m.tobblet <= a, `vizszintes tobblet ${m.tobblet} px (a kozos fejlec miatt a lezeres landing alapja: ${a} px)`);
        } else assert.equal(m.tobblet, 0, 'vizszintes tobblet ' + m.tobblet + ' px');
        assert.deepEqual(m.kilog, []);
        await ctx.close();
      });
    }

    if (o.videok) {
      test(`${o.videok} videokartya: kattintasra felugro lejatszo nyilik, a sajat tarhelyrol toltodik, Escape bezarja`, async () => {
        const { p, ctx } = await nyit(o.nev);
        assert.equal(await p.locator('.video-kartya').count(), o.videok);
        const adatok = await p.$$eval('.video-kartya', (l) => l.map((b) => [b.dataset.video, b.dataset.poster]));
        for (const [v, poszter] of adatok) {
          assert.match(v, /^\/assets\/video\/c2eb0f_[0-9a-f]{32}\.mp4$/);
          assert.ok(fs.existsSync(path.join(GYOKER, v)), 'nincs meg a videofajl: ' + v);
          assert.ok(fs.existsSync(path.join(GYOKER, poszter)), 'nincs meg a poszter: ' + poszter);
        }
        const kartya = p.locator('.video-kartya').nth(1);
        await kartya.scrollIntoViewIfNeeded();
        await kartya.click();
        await p.waitForSelector('dialog.video-modal[open] video', { timeout: 5000 });
        await p.waitForFunction(() => document.querySelector('dialog.video-modal video').readyState >= 1, null, { timeout: 8000 });
        assert.equal(await p.evaluate(() => document.querySelector('dialog.video-modal video').getAttribute('src')), adatok[1][0]);
        await p.keyboard.press('Escape');
        await p.waitForFunction(() => !document.querySelector('dialog.video-modal[open]'));
        await p.waitForFunction(() => !document.querySelector('dialog.video-modal video'), null, { timeout: 3000 }); // bezaras utan nem marad video
        await ctx.close();
      });
    }
  });
}

describe('a komponensek mukodese', () => {
  test('korhinta (a cikk kep-sorozata, a velemenyek elotte / utana sora): a kovetkezo / elozo gomb gorget', async () => {
    for (const nev of ['headspa-budapest', 'head-spa-velemenyek']) {
      const { p, ctx } = await nyit(nev);
      const k = p.locator('.korhinta').first();
      await k.scrollIntoViewIfNeeded();
      assert.equal(await k.locator('.elozo').isDisabled(), true, 'elol az elozo gomb nem kattinthato');
      await k.locator('.kovetkezo').click();
      await p.waitForFunction(() => document.querySelector('.korhinta-sav').scrollLeft > 100);
      assert.equal(await k.locator('.elozo').isDisabled(), false);
      await ctx.close();
    }
  });

  test('mobil sticky CTA: a hero elgorgetese utan latszik, a helyszin szekcional eltunik; asztalon nincs', async () => {
    const { p, ctx } = await nyit('headspa-budapest', { szeles: 390 });
    assert.equal(await p.evaluate(() => document.getElementById('sticky-cta').classList.contains('lathato')), false, 'a tetejen nincs');
    await p.evaluate(() => window.scrollTo(0, 3000));
    await p.waitForFunction(() => document.getElementById('sticky-cta').classList.contains('lathato'));
    assert.equal(await p.getAttribute('#sticky-cta a.gomb', 'href'), '/foglalo-motor?business=headspa');
    await p.evaluate(() => document.getElementById('helyszin').scrollIntoView());
    await p.waitForFunction(() => !document.getElementById('sticky-cta').classList.contains('lathato'), null, { timeout: 4000 });
    await ctx.close();
    const asztal = await nyit('headspa-budapest', { szeles: 1440 });
    assert.equal(await asztal.p.evaluate(() => getComputedStyle(document.getElementById('sticky-cta')).display), 'none');
    await asztal.ctx.close();
  });

  test('suti-hozzajarulas utan a Google terkep es a Trustindex a helykitolto helyett betoltodik (kerjuk a kulso tartalmat)', async () => {
    const t = await nyit('headspa-arak-budapest', { suti: true });
    await t.p.waitForSelector('#terkep iframe');
    assert.ok(t.kulso.some((u) => /google\.com\/maps/.test(u)), 'terkep kerese: ' + t.kulso.join(', '));
    await t.ctx.close();
    const v = await nyit('head-spa-velemenyek', { suti: true });
    await v.p.waitForSelector('#trustindex iframe');
    assert.equal(await v.p.getAttribute('#trustindex iframe', 'src'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    await v.ctx.close();
    // hozzajarulas nelkul: helykitolto + gomb
    const n = await nyit('head-spa-velemenyek');
    assert.equal(await n.p.locator('#ti-hely #ti-gomb').count(), 1);
    await n.ctx.close();
  });

  test('az arak oldalon a 4 csomag ara, a regi ar athuzva, es mind a 4 Foglalok gomb a foglalo-motorra mutat', async () => {
    const { p, ctx } = await nyit('headspa-arak-budapest');
    assert.equal(await p.locator('.csomag').count(), 4);
    assert.deepEqual(await p.$$eval('.csomag .ar-uj', (l) => l.map((e) => e.textContent.trim())), ['39.900 Ft', '26.900 Ft', '26.900 Ft', '53.800 Ft']);
    assert.deepEqual(await p.$$eval('.csomag .ar-regi s', (l) => l.map((e) => e.textContent.trim())), ['49.900 Ft', '32.900 Ft', '32.900 Ft', '65.900 Ft']);
    assert.deepEqual(await p.$$eval('.csomag a.gomb', (l) => l.map((a) => a.getAttribute('href'))), Array(4).fill('/foglalo-motor?business=headspa'));
    await ctx.close();
  });
});
