// A persona-oldalak (ajandekkartya-variansok) BONGESZOS tesztjei (Playwright) a helyi fejleszto kiszolgaloval (tools/ajandek-teszt/szerver.mjs: a valodi
// kezelo + mock Stripe + bongeszos Stripe.js-mock). Nincs kulso halozat, nincs valodi level / fizetes.
//
//   node --test tools/ajandek-teszt/persona-oldalak.test.mjs
//
// Mind a 8 persona-cimre (szulinapra, japan, anyukaknak, ezo (ekezetes cim), noknek, self-care, csajos, fiataloknak) ellenorzi:
//   - a hero: persona-H1 / alcim / felcim / gomb, a poszterkep, a videos hero (video-elem a persona videojaval, a fajl letezik)
//   - a magyarazo-szekcio: a hero UTAN, az ajandekvalaszto ELOTT; asztalon BAL oldalt a kep, jobb oldalt a szoveg (a hero videoja jobbra van); mobilon egymas alatt (szoveg, majd kep)
//   - a Gift Finder elovalasztasa, a merese (variant_id / gift_context a dataLayerben, a ?fbclid / ?utm_* parameterek megmaradnak)
//   - nincs vizszintes tulcsordulas 390 / 768 / 1440 px-en, nincs konzolhiba / 404
// A H.264-es videot VALOBAN lejatszo teszt csak ott fut, ahol a bongeszo tud H.264-et (a Playwright-Chromium nem tud: ott "skip", nem hiba).
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
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
await import('../../assets/js/ajandek-adat.js');
const A = globalThis.AJANDEK_ADAT;

const PERSONAK = [
  { nev: 'ajandekkartya-szulinapra', variant: 'birthday' },
  { nev: 'japan-headspa-ajandekkartya', variant: 'japan' },
  { nev: 'headspa-ajandekkartya-anyukaknak', variant: 'mother' },
  { nev: 'headspa-ajándékkártya-ezo', variant: 'esoteric' },
  { nev: 'headspa-ajandekkartya-noknek', variant: 'for_her' },
  { nev: 'headspa-self-care', variant: 'self_care' },
  { nev: 'headspa-paros-csajos-ajandekkartya', variant: 'friend' },
  { nev: 'headspa-ajandakkartya-fiataloknak', variant: 'young' },
];

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

// A mobil user agent (a Cloudflare-fuggveny a telefonoknak a mobil oldalt adja: mobil fejlec / lablec, kisebb kepek): 390 px-en mindig ez; a 768 px-es
// merest ketfelekeppen vegezzuk (telefon-UA-val a teljes oldalra, asztali UA-val - pl. almodott tablet - a SAJAT tartalomra: az asztali Wix-fejlec min. 980 px szeles).
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
async function nyit(nev, { szeles = 1440, mobil = szeles < 700, lekerdezes = '?fbclid=TESZTFB123&utm_source=teszt&utm_campaign=persona' } = {}) {
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: szeles < 700 ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [], nincs = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(bazis) && !/favicon/.test(r.url())) nincs.push(r.status() + ' ' + r.url().replace(bazis, '')); });
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.goto(`${bazis}/${encodeURI(nev)}${lekerdezes}`, { waitUntil: 'load' });
  await p.waitForFunction(() => window.__ajandek);
  await p.addStyleTag({ content: '[class*="mh-cc"],[id*="mh-cc"]{display:none!important}' });
  return { p, ctx, hibak, nincs };
}
// a lusta betoltesu kepek es a hero-video betoltese utan merunk: gorgetes vegig, majd vissza
async function atgorget(p) {
  await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  await p.waitForFunction(() => { const k = document.getElementById('ah-magyarazo-kep'); return !k || k.complete; });
}
const dobozok = (p) => p.evaluate(() => {
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top + scrollY, b: b.bottom + scrollY, w: b.width, h: b.height }; };
  return { hero: r('#ah-hero'), szekcio: r('#ah-magyarazo'), szoveg: r('.ah-magyarazo-szoveg'), cim: r('#ah-magyarazo-cim'), torzs: r('#ah-magyarazo-torzs'), media: r('#ah-magyarazo-media'), valaszto: r('#ah-finder') };
});
const elvartTermek = (v, nev) => {
  const f = v.gift_finder_preselect ? A.FINDER.find((x) => x.id === v.gift_finder_preselect) : null;
  const alap = A.oldalAlapertek('/' + nev);
  return (f && f.termek) || (alap.termek && A.TERMEKEK[alap.termek] ? alap.termek : null) || v.product_order[0];
};

for (const { nev, variant } of PERSONAK) {
  const v = A.VARIANTOK[variant];
  describe(`/${nev} -> ${variant}`, () => {
    test('az oldal betoltodik hibak nelkul (nincs pageerror / konzolhiba / 404); a ?fbclid / ?utm_* megmarad; a variant a cimbol jon', async () => {
      const { p, ctx, hibak, nincs } = await nyit(nev);
      const r = await p.evaluate(() => ({ url: location.search, snap: window.__ajandek.snapshot() }));
      assert.equal(r.snap.variant_id, variant);
      assert.match(r.url, /fbclid=TESZTFB123/);
      assert.match(r.url, /utm_source=teszt/);
      assert.equal(r.snap.attr.fbclid, 'TESZTFB123', 'a kattintas-azonosito az attributumok kozt');
      assert.equal(r.snap.attr.oldal, '/' + nev.normalize('NFC'), 'a rendeles "oldal" mezoje az olvashato (dekodolt) cim');
      assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
      assert.deepEqual(hibak, [], hibak.join('\n'));
      assert.deepEqual(nincs, [], nincs.join('\n'));
      await ctx.close();
    });

    test('hero: persona-H1 / alcim / felcim / gomb; a poszterkep a varians kepe; videos hero: video-elem a persona videojaval, a fajl es a poszter letezik', async () => {
      const { p, ctx } = await nyit(nev);
      assert.equal((await p.textContent('h1')).trim(), v.hero_title);
      assert.equal((await p.textContent('#ah-hero-alcim')).trim(), v.hero_subtitle);
      assert.equal((await p.textContent('#ah-hero-eyebrow')).trim(), v.hero_eyebrow);
      assert.equal((await p.textContent('#ah-hero-cta-szoveg')).trim(), v.hero_cta);
      assert.equal(await p.getAttribute('#ah-hero-kep', 'src'), v.hero_media.src, 'a poszter a varians hero-kepe');
      assert.notEqual(v.hero_media.src, A.VARIANTOK.general.hero_media.src, 'nem az altalanos kep');
      // a hero-video a betoltes utan kapja a forrasat (a foto az LCP-elem / poszter)
      await p.waitForFunction(() => document.getElementById('ah-hero-video').getAttribute('src'), null, { timeout: 8000 });
      assert.equal(await p.getAttribute('#ah-hero-video', 'src'), v.hero_media.video.src, 'a hero-video a persona videoja');
      assert.equal(await p.evaluate(() => document.getElementById('ah-hero-kep').naturalWidth > 0), true, 'a poszter betoltodott');
      for (const ut of [v.hero_media.video.src, v.hero_media.src]) {
        const res = await fetch(bazis + ut, { headers: { range: 'bytes=0-1023' } });
        assert.ok([200, 206].includes(res.status), ut + ' letezik: ' + res.status);
        if (/\.mp4$/.test(ut)) assert.match(res.headers.get('content-type'), /video\/mp4/);
      }
      // a hero-media a hero jobb oldalan (asztalon), mobilon felul: a video-elem a hero resze
      const d = await dobozok(p);
      assert.ok(d.hero && d.hero.h > 300, 'a hero lathato');
      await ctx.close();
    });

    test('magyarazo-szekcio: a hero UTAN, az ajandekvalaszto ELOTT; a regi oldal bekezdesei (pipas pont es sarga felcim nelkul) a szovegoszlopban; kep a media-oszlopban', async () => {
      const { p, ctx } = await nyit(nev);
      await atgorget(p);
      assert.equal(await p.isVisible('#ah-magyarazo'), true, 'a szekcio lathato');
      const m = v.magyarazo;
      assert.equal((await p.textContent('#ah-magyarazo-cim')).trim(), m.cim);
      assert.equal(await p.isVisible('#ah-magyarazo-felcim'), false, 'a sarga felcim nincs kint az elso szekcioban');
      const bek = await p.$$eval('#ah-magyarazo-torzs p', (e) => e.map((x) => x.textContent.trim()));
      assert.deepEqual(bek, m.szovegek);
      assert.ok(bek.length >= 4 && bek.length <= 8, 'a regi oldal bekezdesei: ' + bek.length);
      const pontok = await p.$$eval('#ah-magyarazo-pontok li', (e) => e.map((x) => x.textContent.trim()));
      assert.deepEqual(pontok, (m.pontok || []).slice(0, 3));
      assert.equal(pontok.length, 0, 'nincs pipas pont (a regi oldalon nem volt)');
      assert.equal(await p.isVisible('#ah-magyarazo-pontok'), false, 'az ures pontlista rejtett');
      // a szoveg- es a kep-oszlop szerkezete (a DOM-ban elobb a szoveg: mobilon igy kerul a kep a szoveg ala; asztalon a CSS teszi balra a kepet)
      assert.equal(await p.evaluate(() => !!document.querySelector('.ah-magyarazo-szoveg #ah-magyarazo-cim') && !!document.querySelector('.ah-magyarazo-media #ah-magyarazo-kep')), true);
      const kep = await p.evaluate(() => { const k = document.getElementById('ah-magyarazo-kep'); return { src: k.getAttribute('src'), alt: k.getAttribute('alt'), ok: k.complete && k.naturalWidth > 0, w: k.naturalWidth }; });
      assert.equal(kep.src, m.media.src);
      assert.equal(kep.alt, m.media.alt);
      assert.equal(kep.ok, true, 'a magyarazo-kep betoltodott');
      // 2026-10-09 (2. kor): a magyarazo-kep a hero-poszterbol NEM ugyanaz (se fajl, se tartalom): a vendeg ne lassa ketszer ugyanazt a kepet
      assert.notEqual(m.media.src, v.hero_media.src, 'a magyarazo-kep fajlja nem a hero-poszter');
      const mfajl = fs.readFileSync(path.join(GYOKER, m.media.src.replace(/^\//, '')));
      const pfajl = fs.readFileSync(path.join(GYOKER, v.hero_media.src.replace(/^\//, '')));
      assert.ok(!mfajl.equals(pfajl), 'a magyarazo-kep tartalma nem azonos a hero-poszterrel');
      // sorrend: hero < magyarazo < valaszto (a Gift Finder csak a magyarazo UTAN jon, nem rogton a hero utan)
      const d = await dobozok(p);
      assert.ok(d.hero.b <= d.szekcio.t + 1, 'a hero a magyarazo elott van');
      assert.ok(d.szekcio.b <= d.valaszto.t + 1, 'a magyarazo az ajandekvalaszto elott van');
      // a hero gombja a valasztora gorget (nem a magyarazora)
      assert.equal(await p.getAttribute('#ah-hero-cta', 'href'), '#ah-finder');
      await ctx.close();
    });

    test('elrendezes: asztalon (1440) ket oszlop - a KEP BALRA, a szoveg jobbra, egymas mellett; mobilon (390) egymas alatt - cim, kep, majd a szoveg', async () => {
      const a = await nyit(nev, { szeles: 1440 });
      await atgorget(a.p);
      const d = await dobozok(a.p);
      assert.ok(d.media.r <= d.szoveg.l + 2, `a kep a szoveg BAL oldalan van (kep.r ${d.media.r} <= szoveg.l ${d.szoveg.l})`);
      assert.ok(d.media.l < d.szoveg.l, `a kep bal széle a szoveg bal széle elott van (kep.l ${d.media.l} < szoveg.l ${d.szoveg.l})`);
      assert.ok(d.media.t < d.szoveg.b && d.media.b > d.szoveg.t, 'a ket oszlop vertikalisan atfed');
      assert.ok(d.media.w > 350 && d.media.h > 300, 'a kep elegendo meretu: ' + d.media.w + 'x' + d.media.h);
      assert.ok(d.szoveg.w > 350, 'a szovegoszlop elegendo szeles');
      assert.ok(Math.abs(d.media.h - d.szoveg.h) < d.szoveg.h * 0.6 + 80, 'a kep magassaga a szovegoszlophoz igazodik');
      await a.ctx.close();
      const b = await nyit(nev, { szeles: 390, mobil: true });
      await atgorget(b.p);
      const m = await dobozok(b.p);
      // 2026-10-09 (a tulajdonos kerese): mobilon a sorrend CIM -> KEP -> szoveg (a kep ne legyen alul)
      assert.ok(m.media.t >= m.cim.b - 2, `mobilon a kep a CIM alatt van (kep.t ${m.media.t} >= cim.b ${m.cim.b})`);
      assert.ok(m.torzs.t >= m.media.b - 2, `mobilon a szoveg a KEP alatt van (torzs.t ${m.torzs.t} >= kep.b ${m.media.b})`);
      assert.ok(m.cim.t < m.media.t && m.media.t < m.torzs.t, 'cim < kep < szoveg');
      assert.ok(m.media.w <= 390 && m.media.w > 300 && m.cim.w <= 390 && m.torzs.w <= 390, 'mobilon teljes szelesseg, nincs kilogas');
      assert.ok(m.media.h > 150, 'a kep latszik');
      await b.ctx.close();
    });

    test('a Gift Finder elovalasztasa a varians szerint, a meres: view_item a variant_id / gift_context / item_list_id mezokkel + az attributumok (fbclid, utm_*)', async () => {
      const { p, ctx } = await nyit(nev);
      const r = await p.evaluate(() => ({
        kijelolt: (document.querySelector('input[name=termek]:checked') || {}).value,
        sorrend: Array.from(document.querySelectorAll('.ah-termek')).map((e) => e.getAttribute('data-termek')),
        dl: (window.dataLayer || []).filter((x) => x && x.event === 'view_item'),
      }));
      assert.equal(r.kijelolt, elvartTermek(v, nev), 'elovalasztott elmeny');
      assert.deepEqual(r.sorrend, v.product_order, 'termeksorrend');
      assert.equal(r.dl.length, 1, 'egy view_item');
      const e = r.dl[0];
      assert.equal(e.variant_id, variant);
      assert.equal(e.gift_context, v.gift_context);
      assert.equal(e.ecommerce.item_list_id, 'ajandek_' + variant);
      assert.equal(e.fbclid, 'TESZTFB123');
      assert.equal(e.utm_source, 'teszt');
      assert.equal(e.utm_campaign, 'persona');
      if (v.relationship) assert.equal(e.relationship, v.relationship);
      if (v.occasion) assert.equal(e.occasion, v.occasion, 'az alkalom (szuletesnap) a meresben');
      await ctx.close();
    });

    for (const [szeles, mobil, mit] of [[390, true, 'a teljes oldalon'], [768, true, 'a teljes oldalon (telefon-UA)'], [768, false, 'a sajat tartalmon (asztali UA)'], [1440, false, 'a teljes oldalon']]) {
      test(`nincs vizszintes tulcsordulas ${szeles} px-en ${mit}, sem a hero-ban, sem a magyarazo-szekcioban, sem a valasztoban`, async () => {
        const { p, ctx, hibak } = await nyit(nev, { szeles, mobil });
        await atgorget(p);
        const r = await p.evaluate(() => ({
          doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, tartalom: (document.getElementById('ah-landing') || {}).scrollWidth, ablak: innerWidth,
          tulog: Array.from(document.querySelectorAll('#ah-hero, #ah-hero *, #ah-magyarazo, #ah-magyarazo *, #ah-finder, #ah-finder *')).filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1) && !e.closest('.ah-hero-media, .ah-sticky, [hidden]'); }).map((e) => e.tagName + '#' + e.id + '.' + e.className).slice(0, 5),
        }));
        if (mit.startsWith('a teljes')) {
          assert.ok(r.doc <= r.ablak, `documentElement.scrollWidth ${r.doc} <= ${r.ablak}`);
          assert.ok(r.body <= r.ablak, `body.scrollWidth ${r.body} <= ${r.ablak}`);
        }
        assert.ok(r.tartalom <= r.ablak, `az oldal tartalma (#ah-landing) ${r.tartalom} <= ${r.ablak}`);
        assert.deepEqual(r.tulog, [], 'nem logo elemek');
        assert.deepEqual(hibak, [], hibak.join('\n'));
        await ctx.close();
      });
    }

    test('a mobil sticky sav (ah-sticky) 320 / 360 / 390 / 430 px-en sehol nem log ki: a sav es minden gyereke a kepernyon belul van, a gomb szovege nem vagodik le (2026-10-09)', async () => {
      for (const szeles of [320, 360, 390, 430]) {
        const { p, ctx } = await nyit(nev, { szeles, mobil: true });
        await p.evaluate(async () => { for (let y = 0; y < 3000; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
        await p.waitForSelector('#ah-sticky.ah-lathato', { timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(450);
        const m = await p.evaluate(() => {
          const e = document.getElementById('ah-sticky'); if (!e || getComputedStyle(e).display === 'none') return null;
          const ki = [e, ...e.querySelectorAll('*')].filter((c) => { const q = c.getBoundingClientRect(); return q.width > 0 && (q.right > innerWidth + 0.5 || q.left < -0.5); }).map((c) => c.id || c.className || c.tagName);
          const g = document.getElementById('ah-sticky-gomb');
          return { ki, doc: document.documentElement.scrollWidth <= document.documentElement.clientWidth, gombVagva: g ? g.scrollWidth > g.clientWidth + 1 : false, ar: (document.getElementById('ah-sticky-ar') || {}).textContent };
        });
        assert.ok(m, szeles + ' px: van sticky sav');
        assert.deepEqual(m.ki, [], szeles + ' px: kilogo elemek');
        assert.equal(m.doc, true, szeles + ' px: nincs vizszintes gorgetes');
        assert.equal(m.gombVagva, false, szeles + ' px: a gomb szovege nem vagodik le');
        await ctx.close();
      }
    });

    test('a hero-video VALOBAN lejatszodik (csak H.264-tudo bongeszoben; a Playwright-Chromium nem tud: ott kihagyjuk, nem hiba)', async (t) => {
      const { p, ctx } = await nyit(nev);
      const tud = await p.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.64001E"'));
      if (!tud) { await ctx.close(); return t.skip('ez a bongeszo nem tud H.264-et (a lejatszas itt nem tesztelheto; a fajl / elem / poszter teszt fent)'); }
      await p.waitForFunction(() => { const x = document.getElementById('ah-hero-video'); return x && !x.paused && x.currentTime > 0.2; }, null, { timeout: 15000 });
      assert.equal(await p.evaluate(() => document.getElementById('ah-hero-video').classList.contains('ah-megy')), true);
      await ctx.close();
    });
  });
}

describe('felulirasok es a fo oldal', () => {
  test('?variant=general a persona-cimen az altalanos oldalt adja (a magyarazo rejtett); a fo /headspa-ajandekkartya oldalon NINCS uj szekcio', async () => {
    const g = A.VARIANTOK.general;
    for (const [nev, lek] of [['headspa-self-care', '?variant=general'], ['headspa-ajandekkartya', ''], ['ajandek', '']]) {
      const { p, ctx, hibak } = await nyit(nev, { lekerdezes: lek });
      assert.equal((await p.textContent('h1')).trim(), g.hero_title, nev);
      assert.equal(await p.isVisible('#ah-magyarazo'), false, nev + ': a magyarazo rejtett');
      assert.equal(await p.getAttribute('#ah-hero-kep', 'src'), g.hero_media.src);
      assert.deepEqual(hibak, []);
      await ctx.close();
    }
  });

  test('a ?variant= parameter a persona-cimen is felulirja a cim szerinti variantot (pl. self-care oldal ?variant=friend)', async () => {
    const { p, ctx } = await nyit('headspa-self-care', { lekerdezes: '?variant=friend' });
    assert.equal((await p.textContent('h1')).trim(), A.VARIANTOK.friend.hero_title);
    assert.equal((await p.textContent('#ah-magyarazo-cim')).trim(), A.VARIANTOK.friend.magyarazo.cim);
    await ctx.close();
  });

  test('a partner es az utolso pillanat variansnak (nincs sajat cime) is van magyarazoja, a hero-szovege marad; a last_minute a kezbesitesi idore nem tesz allitast', async () => {
    for (const k of ['partner', 'last_minute']) {
      const { p, ctx } = await nyit('ajandek', { lekerdezes: '?variant=' + k });
      assert.equal((await p.textContent('h1')).trim(), A.VARIANTOK[k].hero_title);
      assert.equal((await p.textContent('#ah-magyarazo-cim')).trim(), A.VARIANTOK[k].magyarazo.cim);
      assert.equal(await p.isVisible('#ah-magyarazo'), true);
      const szoveg = await p.textContent('#ah-magyarazo');
      assert.doesNotMatch(szoveg, /azonnal|perceken belül|perc alatt|még ma/i);
      await ctx.close();
    }
  });

  test('a harom korabbi hirdetesi cim (ezo, self-care, fiataloknak) nem a regi (Wixes / ujrastilusozott) oldalt adja: a foglalas/ mappaban nincs fajluk, az archivum nincs az elo utvonalon', () => {
    for (const nev of ['headspa-ajandakkartya-fiataloknak', 'headspa-ajándékkártya-ezo', 'headspa-self-care']) {
      assert.equal(fs.existsSync(path.join(GYOKER, 'foglalas', nev.normalize('NFC') + '.html')), false, nev + ': nincs a foglalas/ mappaban');
      assert.equal(fs.existsSync(path.join(GYOKER, 'tools/ajandek-variansok/archiv', nev.normalize('NFC') + '.html')), true, nev + ': az archivum megvan');
    }
  });
});
