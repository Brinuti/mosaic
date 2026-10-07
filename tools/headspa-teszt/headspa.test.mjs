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
import { pathToFileURL } from 'node:url';
import { szerverInditas, GYOKER } from './szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

// nev: az eredeti cim (2026-10-07 ota az uj oldal el itt; a regi Wixes valtozat a -regi cimen, az -uj cim 301-gyel ide iranyit); a cim / H1 / kulcsszovegek a regi oldal tartalmabol valok
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
async function nyit(nev, { szeles = 1440, suti = false, extra = null } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], kulso = [], nincs = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis)) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^(?!http:\/\/localhost)/, (r) => { kulso.push(r.request().url()); r.abort(); });
  if (extra) await extra(p);
  await p.goto(`${bazis}/${nev}`, { waitUntil: 'domcontentloaded' });
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
  describe(`/${o.nev}`, () => {
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

    test('a kozos szerkezet: eredeti canonical, indexelhetoseg, fejlec, a fejlec akcios savja a MOSAIC szinvilagaban (nem rozsaszin), ujszeru oldalstilus, lablec', async () => {
      const { p, ctx } = await nyit(o.nev);
      // indexelheto (nincs robots meta); a kedvezmeny oldal a regi oldalhoz hasonloan noindex marad
      if (o.noindexEredeti) assert.equal(await p.getAttribute('meta[name=robots]', 'content'), 'noindex'); else assert.equal(await p.locator('meta[name=robots]').count(), 0, 'indexelheto oldal');
      assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), `https://www.mosaicheadspa.hu/${o.nev}`);
      assert.equal(await p.locator('header, #SITE_HEADER, [id^="comp-"]').count() > 0, true, 'a MOSAIC fejlec megvan');
      // az akcios sav a fejlece (a kozos fejlec-lablec.css stilusozza): latszik, halvany arany hatter, sotetzold felirat, a kedvezmeny oldalra mutat; nincs sajat masodik sav
      assert.equal(await p.locator('a.akcio-sav').count(), 0, 'nincs sajat akcio-sav (a fejlec savja veszi at a helyet)');
      const sav = await p.evaluate(() => {
        const s = document.getElementById('comp-mpv0ganp'); const a = s && s.querySelector('a');
        const r = s && s.getBoundingClientRect();
        return s ? { lat: getComputedStyle(s).display !== 'none' && r.height > 10, bg: getComputedStyle(s.querySelector('[data-testid="colorUnderlay"]')).backgroundColor, szin: a && getComputedStyle(a).color, href: a && a.getAttribute('href'), szoveg: s.textContent.replace(/\s+/g, ' ').trim() } : null;
      });
      assert.ok(sav, 'van akcios sav a fejlecben');
      assert.equal(sav.lat, true, 'az akcios sav latszik');
      assert.equal(sav.bg, 'rgb(246, 239, 220)', 'halvany arany hatter (nem rozsaszin)');
      assert.equal(sav.szin, 'rgb(15, 58, 60)', 'sotetzold felirat');
      assert.equal(sav.href, '/head-spa-kedvezmeny');
      assert.match(sav.szoveg, /Októberi akció! - 20% kedvezmény minden headspa foglalásra \+ ajándékkártyára!/);
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

    test('a Google terkep (harmadik fel) a suti-hozzajarulas elott nem toltodik; nincs tobb kulso keres, mint a lezeres landingen (a kozos fejlec / lablec es a mindig azonnali Trustindex-velemenyek)', async () => {
      const alap = await nyit('lezeres-szortelenites-budapest');
      const { ctx, kulso } = await nyit(o.nev);
      assert.deepEqual(kulso.filter((u) => !alap.kulso.includes(u)), [], 'tobbletkeresek suti nelkul');
      assert.deepEqual(kulso.filter((u) => /google\.com\/maps/.test(u)), [], 'terkep suti nelkul');
      await ctx.close(); await alap.ctx.close();
    });

    for (const [nev, szeles] of NEZETEK) {
      test(`nincs vizszintes gorgetes (${nev}, ${szeles} px), a szoveg nem logat ki`, async () => {
        const { p, ctx } = await nyit(o.nev, { szeles });
        const m = await p.evaluate(() => ({ tobblet: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          kilog: [...document.querySelectorAll('main *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 1 && !e.closest('.korhinta-sav, .video-modal'); }).slice(0, 5).map((e) => e.tagName + '.' + e.className) }));
        // 768 px-en a (Wix) asztali fejlec es akcios sav sajat, rogzitett szelessege (~980 px) vizszintes tobbletet ad minden oldalon (a regi Wixes oldalakon is):
        // ott csak a tartalom (main) nem logathat ki; telefonon (mobil fejlec) es asztalon az egesz oldal nem gorgethet vizszintesen
        if (szeles !== 768) assert.equal(m.tobblet, 0, 'vizszintes tobblet ' + m.tobblet + ' px');
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

  test('a vendegertekelesek (Trustindex) MINDIG azonnal megjelennek: suti-hozzajarulas es gomb nelkul is; a Google terkep csak hozzajarulas utan toltodik', async () => {
    const v = await nyit('head-spa-velemenyek');   // NINCS suti-hozzajarulas
    await v.p.waitForSelector('#trustindex iframe.ti-keret', { timeout: 4000 });
    assert.equal(await v.p.getAttribute('#trustindex iframe', 'src'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    assert.equal(await v.p.getAttribute('#trustindex iframe', 'loading'), 'eager');
    assert.equal(await v.p.locator('#ti-hely').count(), 0, 'a helykitolto lecserelodott');
    assert.equal(await v.p.locator('#ti-gomb').count(), 0, 'nincs hozzajarulas-gomb');
    await v.ctx.close();
    // terkep: hozzajarulas nelkul helykitolto + gomb, hozzajarulas utan betoltodik
    const n = await nyit('headspa-arak-budapest');
    assert.equal(await n.p.locator('#terkep-hely #terkep-gomb').count(), 1);
    assert.equal(await n.p.locator('#terkep iframe').count(), 0);
    await n.ctx.close();
    const t = await nyit('headspa-arak-budapest', { suti: true });
    await t.p.waitForSelector('#terkep iframe');
    assert.ok(t.kulso.some((u) => /google\.com\/maps/.test(u)), 'terkep kerese: ' + t.kulso.join(', '));
    await t.ctx.close();
  });

  test('az arak es a kedvezmeny oldalon 3 csomag van (4 Kezes, EGY 50 perces Head Spa kezeles, Paros): ar, athuzott regi ar, kep, Foglalok gomb; nincs kulon Relax / Hair', async () => {
    for (const nev of ['headspa-arak-budapest', 'head-spa-kedvezmeny']) {
      const { p, ctx } = await nyit(nev);
      assert.equal(await p.locator('.csomag').count(), 3, nev);
      assert.deepEqual(await p.$$eval('.csomag h3', (l) => l.map((e) => e.textContent.replace(/\s+/g, ' ').trim())), ['50 perces MOSAIC„4 Kezes” Head Spa kezelés', '50 perces MOSAICHead Spa kezelés', '50 perces MOSAICPáros Head Spa kezelés']);
      const szoveg = await p.evaluate(() => document.querySelector('main').innerText);
      assert.ok(!/„Relax”|„Hair”|"Relax"|"Hair"/.test(szoveg), 'nincs kulon Relax / Hair kezeles');
      assert.deepEqual(await p.$$eval('.csomag .ar-uj', (l) => l.map((e) => e.textContent.trim())), ['39.900 Ft', '26.900 Ft', '53.800 Ft']);
      assert.deepEqual(await p.$$eval('.csomag .ar-regi s', (l) => l.map((e) => e.textContent.trim())), ['49.900 Ft', '32.900 Ft', '65.900 Ft']);
      assert.deepEqual(await p.$$eval('.csomag a.gomb', (l) => l.map((a) => a.getAttribute('href'))), Array(3).fill('/foglalo-motor?business=headspa'));
      // az egyesitett kezelesben a hajkamerás diagnosztika kerdes alapjan, igeny szerint eldonthetõ
      const kozep = await p.$eval('.csomag:nth-child(2)', (e) => e.innerText.replace(/\s+/g, ' '));
      assert.match(kozep, /Hajkamerás diagnosztika és konzultáció – igény szerint, kérdés alapján eldöntheted/);
      for (const sor of ['Mélytisztító hajmosás', 'Körvízsugaras terápia', 'OXYGENI hajpakolás', 'Fejmasszázs kézzel és eszközökkel', 'Arcmasszázs kézzel és választott eszközzel', 'Fény terápia', '+ 30 perc kímélő hajszárítás', 'Időtartam: 50+30 perc']) assert.ok(kozep.includes(sor), sor);
      // az arlista kepes: minden csomag tetejen egy-egy (kulonbozo) kep, betoltve, a kartya szelessegeben
      const kepek = await p.$$eval('.csomag .csomag-kep img', (l) => l.map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, alt: i.alt, sz: Math.round(i.getBoundingClientRect().width), kartyaSz: Math.round(i.closest('.csomag').getBoundingClientRect().width) })));
      assert.equal(kepek.length, 3, nev + ': minden csomagnak van kepe');
      assert.equal(new Set(kepek.map((k) => k.src)).size, 3, 'kulonbozo kepek');
      for (const k of kepek) { assert.ok(k.ok, 'betoltodik: ' + k.src); assert.ok(k.alt.length > 10, 'alt: ' + k.src); assert.ok(Math.abs(k.sz - k.kartyaSz) <= 2, 'a kep a kartya teljes szelessegeben: ' + JSON.stringify(k)); }
      await ctx.close();
    }
  });

  test('a velemenyek oldalon nincs a negy cikk alatti nagy (gyertyas) kep: a cikkek utan rogton az 5 videos resz kovetkezik', async () => {
    const { p, ctx } = await nyit('head-spa-velemenyek');
    assert.equal(await p.locator('img[src*="8c347f764efd4b94997943270259bfce"]').count(), 0, 'a gyertyas nagy kep nincs az oldalon');
    assert.equal(await p.locator('#sajto + section#videok > .tartalom > :first-child.szekcio-fej').count(), 1, 'a videok szekcio a fejleccel kezdodik (nincs elotte kep)');
    assert.equal(await p.locator('#videok figure.kep-fig').count(), 0);
    await ctx.close();
  });
});

describe('a csere: az -uj cimek atiranyitanak, a regi (Wixes) valtozat rejtett -regi cimen megvan', () => {
  test('az -uj cimek 301-gyel az eredeti cimre iranyitanak (asztalon es telefonon is)', async () => {
    const { utvonal } = await import(pathToFileURL(path.join(GYOKER, 'netlify', 'lib', 'utvonal.js')).href);
    for (const o of OLDALAK) {
      for (const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', UA_MOBIL]) assert.deepEqual(utvonal(`/${o.nev}-uj`, ua), { atiranyit: `/${o.nev}` }, o.nev);
      // az eredeti cim tovabbra is az oldalfajlra mutat (asztali / mobil)
      assert.deepEqual(utvonal(`/${o.nev}`, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), { atir: `/_a/${o.nev}` });
      assert.deepEqual(utvonal(`/${o.nev}`, UA_MOBIL), { atir: `/_m/${o.nev}` });
      // a rejtett regi valtozat sajat cimen
      assert.deepEqual(utvonal(`/${o.nev}-regi`, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), { atir: `/_a/${o.nev}-regi` });
    }
  });

  test('a regi Wixes valtozat (-regi) megvan asztali es mobil valtozatban: noindex, sajat canonical, a regi cim; az eredeti klon-fajl valtozatlanul visszaallithato', () => {
    for (const o of OLDALAK) {
      for (const mappa of ['klon', path.join('klon', 'm')]) {
        const regi = fs.readFileSync(path.join(GYOKER, mappa, `${o.nev}-regi.html`), 'utf8');
        assert.match(regi, /<meta name="robots" content="noindex(, nofollow)?"\/>/, `${mappa}/${o.nev}-regi noindex`);
        assert.ok(regi.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu/${o.nev}-regi"/>`), 'canonical');
        assert.ok(regi.includes(`<meta property="og:url" content="https://www.mosaicheadspa.hu/${o.nev}-regi"/>`), 'og:url');
        assert.ok(regi.includes('<title>' + o.cim.replace(/&/g, '&amp;') + '</title>') || regi.includes('<title>' + o.cim + '</title>'), 'a regi oldal cime');
        assert.ok(fs.existsSync(path.join(GYOKER, mappa, `${o.nev}.html`)), 'az eredeti klon-fajl megvan (visszaallitashoz)');
      }
      assert.ok(fs.existsSync(path.join(GYOKER, 'foglalas', `${o.nev}.html`)) && !fs.existsSync(path.join(GYOKER, 'foglalas', `${o.nev}-uj.html`)), 'az uj oldal az eredeti neven van');
    }
  });

  test('az LCP-elotoltes tablaban az uj oldalak hero-kepei szerepelnek (nincs a regi Wixes kep); a kepnelkuli oldalaknak nincs bejegyzese', () => {
    const lcp = JSON.parse(fs.readFileSync(path.join(GYOKER, 'tools', 'lcp-elofeltoltes.json'), 'utf8'));
    for (const mod of ['asztali', 'mobil']) {
      assert.equal(lcp[mod]['headspa-arak-budapest'], undefined);
      assert.equal(lcp[mod]['head-spa-velemenyek'], undefined);
      for (const nev of ['headspa-budapest', 'head-spa-kedvezmeny', 'headspa-termekek-oxygeni']) {
        const kep = lcp[mod][nev];
        assert.ok(kep && fs.existsSync(path.join(GYOKER, kep)), `${mod}/${nev}: ${kep}`);
        const html = fs.readFileSync(path.join(GYOKER, 'foglalas', `${nev}.html`), 'utf8');
        assert.ok(html.includes(kep), `${mod}/${nev}: a hero-kep az uj oldalon van`);
      }
    }
  });

  test('a velemenyek oldalon sokkal tobb Trustindex-kartya latszik egyszerre (asztalon 3x3, telefonon 4), es a "Meg tobb velemeny" gomb lepesenkent tovabbiakat mutat', async () => {
    // a Trustindex loader kamu valtozata: ugyanolyan szerkezet (ti-widget > ti-reviews-container-wrapper > ti-review-item), 40 kartya
    const kamu = (p) => p.route('https://cdn.trustindex.io/loader.js**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: `
      (() => { const w = document.createElement('div'); w.className = 'ti-widget'; let h = '<div class="ti-widget-container ti-col-3"><div class="ti-widget-header">Google 4,9</div><div class="ti-reviews-container"><div class="ti-controls"></div><div class="ti-reviews-container-wrapper">';
        for (let i = 1; i <= 40; i++) h += '<div class="ti-review-item" style="position:relative"><div class="ti-inner" style="height:150px">Velemeny ' + i + '</div></div>';
        h += '</div><div class="ti-controls-line"></div></div></div>'; w.innerHTML = h; document.body.appendChild(w); })();` }));
    const allapot = (p) => p.evaluate(() => {
      const f = document.querySelector('#trustindex iframe'); const d = f.contentDocument;
      const lat = [...d.querySelectorAll('.ti-review-item')].filter((e) => getComputedStyle(e).display !== 'none');
      return { latszo: lat.length, ossz: d.querySelectorAll('.ti-review-item').length, oszlop: new Set(lat.map((e) => Math.round(e.getBoundingClientRect().left))).size, gomb: !document.getElementById('ti-tobb-sor').hidden, magas: Math.round(f.getBoundingClientRect().height) };
    });
    for (const [szeles, lepesek, oszlop] of [[1440, [9, 18, 27], 3], [390, [4, 8, 12], 1]]) {
      const { p, ctx } = await nyit('head-spa-velemenyek', { szeles, extra: kamu });
      await p.waitForFunction(() => { const f = document.querySelector('#trustindex iframe'); const d = f && f.contentDocument; return d && d.querySelectorAll('.ti-review-item').length === 40 && !document.getElementById('ti-tobb-sor').hidden; }, null, { timeout: 10000 });
      let a = await allapot(p);
      assert.equal(a.ossz, 40);
      assert.equal(a.latszo, lepesek[0], `${szeles}px: kezdetben ennyi kartya latszik`);
      assert.equal(a.oszlop, oszlop, `${szeles}px: oszlopok szama`);
      assert.equal(a.gomb, true);
      for (const cel of lepesek.slice(1)) {
        const elotte = a.magas;
        await p.click('#ti-tobb');
        await p.waitForFunction((n) => { const f = document.querySelector('#trustindex iframe'); return [...f.contentDocument.querySelectorAll('.ti-review-item')].filter((e) => getComputedStyle(e).display !== 'none').length === n; }, cel);
        await p.waitForFunction((m) => document.querySelector('#trustindex iframe').getBoundingClientRect().height > m, elotte, { timeout: 6000 });   // a keret magassaga kovet
        a = await allapot(p);
        assert.equal(a.latszo, cel, `${szeles}px: a gomb utan ennyi kartya latszik`);
      }
      assert.equal(a.gomb, false, `${szeles}px: a maximum utan nincs tobb gomb (nem rengeteg kartya)`);
      assert.ok(await p.locator('.ti-link a[href*="google.com/maps"]').count() === 1, 'osszes velemeny a Google-on link');
      await ctx.close();
    }
  });
});
