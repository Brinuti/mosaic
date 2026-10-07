// A /kapcsolat es a /gyik oldal tesztjei (2026-10-07). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalakat.
//
//   node --test tools/kapcsolat-teszt/kapcsolat.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (lasd tools/headspa-teszt/headspa.test.mjs).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const olvas = (...r) => fs.readFileSync(path.join(GYOKER, ...r), 'utf8').replace(/\r\n/g, '\n');
const { levelek } = await import(pathToFileURL(path.join(GYOKER, 'netlify', 'lib', 'levelek.js')).href);
const { osszegyujt, oldal: gyikOldal } = await import(pathToFileURL(path.join(GYOKER, 'tools', 'gyik-oldal.mjs')).href);
const { fejlecAtalakit } = await import(pathToFileURL(path.join(GYOKER, 'tools', 'fejlec-menu.mjs')).href);
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

describe('forras / levelek / menu (bongeszo nelkul)', () => {
  test('a /gyik oldal szinkronban van a forras-oldalak GYIK-szekcioival (ha ez elbukik: node tools/gyik-oldal.mjs)', () => {
    assert.equal(olvas('foglalas', 'gyik.html'), gyikOldal(osszegyujt()));
  });

  test('a "kapcsolat" urlap levele: a szalonhoz megy, a valasz-cim a latogato e-mailje, a bevitt szoveg escape-elve', () => {
    const l = levelek('kapcsolat', { nev: 'Teszt Elek <b>', email: 'teszt@example.com', telefon: '0630 123 4567', tema: 'Head Spa', uzenet: 'Szia <script>x</script>\nkérdésem van', hozzajarulas: 'igen', oldal: 'kapcsolat' });
    assert.equal(l.length, 1);
    assert.equal(l[0].cimzett, 'szalon');
    assert.equal(l[0].valasz, 'teszt@example.com');
    assert.match(l[0].targy, /Kapcsolat/);
    assert.ok(!l[0].html.includes('<script>') && l[0].html.includes('&lt;script&gt;') && l[0].html.includes('Teszt Elek &lt;b&gt;'), 'escape-elve');
    for (const resz of ['Teszt Elek', 'teszt@example.com', '0630 123 4567', 'Head Spa', 'kérdésem van']) assert.ok(l[0].html.includes(resz), resz);
    assert.equal(levelek('kapcsolat', { nev: 'A', email: 'rossz', uzenet: 'x' })[0].valasz, undefined, 'ervenytelen e-mail: nincs valasz-cim');
  });

  for (const [nev, mobil] of [['asztali', false], ['mobil', true]]) {
    test(`${nev}: a fejlec "Kapcsolat" es "GYIK" pontja az uj oldalakra visz (nem a nyitooldal szekcioira); az angol valtozatban a GYIK elmarad, a Kapcsolat a #helyszin`, () => {
      const f = olvas('assets', 'fejlec', nev + '.html');
      const h = fejlecAtalakit(f, mobil).match(/<header id="SITE_HEADER"[\s\S]*?<\/header>/)[0];
      assert.ok(h.includes('href="/kapcsolat"') && h.includes('href="/gyik"'));
      assert.ok(!/#comp-m3znoarb|#comp-m4l2o45p/.test(h), 'nincs regi horgony');
      const en = fejlecAtalakit(f + '<!--mh-nyelv:en-->', mobil, true).match(/<header id="SITE_HEADER"[\s\S]*?<\/header>/)[0];
      assert.ok(!en.includes('href="/gyik"') && !en.includes('href="/kapcsolat"') && en.includes('href="#helyszin"'));
    });
  }
  test('a lablec az elerhetoseg-oszlopban a Kapcsolat es a GYIK oldalra mutat', () => {
    const l = fejlecAtalakit(olvas('assets', 'fejlec', 'lablec-asztali.html'), false);
    assert.ok(l.includes('<a href="/kapcsolat">Kapcsolat és üzenetküldés →</a>') && l.includes('<a href="/gyik">Gyakori kérdések</a>'));
  });
});

describe('bongeszoben (konnyu helyi szerver)', () => {
  let bongeszo, szerver, bazis;
  before(async () => {
    const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
    let pw; for (const k of keres) { try { pw = createRequire(path.join(k, 'x.js'))('playwright-core'); break; } catch { /* kovetkezo */ } }
    if (!pw) throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
    ({ szerver, bazis } = await szerverInditas());
    bongeszo = await pw.chromium.launch({ executablePath: process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  });
  after(async () => { await bongeszo.close(); szerver.close(); });

  async function nyit(ut, szeles = 1440, { post = null } = {}) {
    const mobil = szeles < 700;
    const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
    const p = await ctx.newPage();
    const hibak = [], kulso = [], posztok = [];
    const KULSO_OK = /^https:\/\/cdn\.trustindex\.io\/assets\/js\/richsnippet\.js/;   // a Trustindex rich-snippet minden oldalon betoltodik (suti.js)
    p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
    await p.route(/^(?!http:\/\/localhost)/, (r) => { if (!KULSO_OK.test(r.request().url())) kulso.push(r.request().url()); r.abort(); });
    await p.route((u) => u.pathname === '/' && true, (r) => {
      if (r.request().method() === 'POST') { posztok.push(r.request().postData()); return post ? post(r) : r.fulfill({ status: 200, body: 'ok' }); }
      return r.fallback();
    });
    await p.goto(bazis + ut, { waitUntil: 'domcontentloaded' });
    await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
    await p.waitForLoadState('networkidle').catch(() => {});
    return { p, ctx, hibak, kulso, posztok };
  }

  describe('/gyik', () => {
    const VART = { headspa: 26, paros: 12, szortelenites: 12, fodraszat: 8, oxigenterapia: 13, sminktetovalas: 13, ajandekkartya: 10 };
    test('betoltodik hiba nelkul; 1 H1; 7 uzletag, a varhato kerdesszammal (94); a chipek horgonyai; foglalas es reszlet-link szekciónkent', async () => {
      const { p, ctx, hibak, kulso } = await nyit('/gyik');
      assert.deepEqual(hibak, []);
      assert.deepEqual(kulso, []);
      assert.equal(await p.locator('h1').count(), 1);
      assert.match(await p.title(), /^Gyakori kérdések/);
      assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://www.mosaicheadspa.hu/gyik');
      assert.equal(await p.locator('meta[name=robots]').count(), 0, 'indexelheto');
      for (const [id, n] of Object.entries(VART)) {
        assert.equal(await p.locator(`#${id} details`).count(), n, id);
        assert.equal(await p.locator(`.gy-chips a[href="#${id}"]`).count(), 1, 'chip: ' + id);
        assert.ok((await p.locator(`#${id} .gy-fej a.gomb`).getAttribute('href')).startsWith('/'), 'foglalas-link: ' + id);
        assert.equal(await p.locator(`#${id} .gy-tovabb a`).count(), 1, 'reszlet-link: ' + id);
      }
      assert.equal(await p.locator('details').count(), 94);
      assert.equal(await p.locator('#gyik-nincs, #gy-nincs.latszik').count(), 0);
      await ctx.close();
    });

    test('a harmonika nyit / zar (nativ), a kereso szur: ekezet nelkul is, kevés talalatnal kinyit, ures talalatnal uzenet, torles utan minden vissza', async () => {
      const { p, ctx } = await nyit('/gyik');
      await p.locator('#szortelenites summary').first().click();
      assert.equal(await p.locator('#szortelenites details[open]').count(), 1);
      await p.locator('#gy-q').fill('fajdalmas');
      await p.waitForTimeout(300);
      const talalat = await p.evaluate(() => ({ latszo: [...document.querySelectorAll('details')].filter((d) => !d.hidden).length, szoveg: document.getElementById('gy-talalat').textContent,
        rejtettSzekcio: [...document.querySelectorAll('[data-gy-szekcio]')].filter((s) => s.hidden).length, nyitott: document.querySelectorAll('details[open]:not([hidden])').length }));
      assert.ok(talalat.latszo > 0 && talalat.latszo < 40, 'szur: ' + talalat.latszo);
      assert.match(talalat.szoveg, /találat/);
      assert.ok(talalat.rejtettSzekcio >= 1, 'az ures szekciok elrejtve');
      await p.locator('#gy-q').fill('ajandekkartya');
      await p.waitForTimeout(300);
      assert.ok((await p.locator('#ajandekkartya').isVisible()), 'az ajandekkartya szekcio megmarad');
      await p.locator('#gy-q').fill('xqzvwy');
      await p.waitForTimeout(300);
      assert.equal(await p.locator('#gy-nincs.latszik').count(), 1, 'nincs talalat uzenet');
      assert.equal(await p.locator('details:not([hidden])').count(), 0);
      await p.locator('#gy-q').fill('');
      await p.waitForTimeout(300);
      assert.equal(await p.locator('details:not([hidden])').count(), 94);
      assert.equal(await p.locator('[data-gy-szekcio][hidden]').count(), 0);
      await ctx.close();
    });

    for (const szeles of [1440, 390]) {
      test(`${szeles} px: nincs vizszintes gorgetes, a fejlec Kapcsolat/GYIK menupontja az uj oldalakra mutat, a GYIK kijelolt`, async () => {
        const { p, ctx } = await nyit('/gyik', szeles);
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
        if (szeles >= 700) {
          const r = await p.evaluate(() => { const li = [...document.querySelectorAll('li[data-testid="menuItemDepth0"]')]; const t = (h) => li.find((l) => l.querySelector('a') && l.querySelector('a').getAttribute('href') === h);
            return { gyik: !!t('/gyik'), kapcsolat: !!t('/kapcsolat'), aktiv: t('/gyik') && t('/gyik').getAttribute('data-is-current') }; });
          assert.deepEqual(r, { gyik: true, kapcsolat: true, aktiv: 'true' });
        }
        await ctx.close();
      });
    }
  });

  describe('/kapcsolat', () => {
    test('betoltodik hiba nelkul, kulso keres nelkul (a terkep a hozzajarulas / gomb utan); 1 H1; elerhetoseg, nyitvatartas (H-Szo 8-20), foglalas, ajandekkartya, social', async () => {
      const { p, ctx, hibak, kulso } = await nyit('/kapcsolat');
      assert.deepEqual(hibak, []);
      assert.deepEqual(kulso, []);
      assert.equal(await p.locator('h1').innerText(), 'Kapcsolat');
      assert.equal(await p.locator('iframe').count(), 0, 'a terkep nem toltodott be magatol');
      assert.match(await p.title(), /^Kapcsolat/);
      assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://www.mosaicheadspa.hu/kapcsolat');
      const hrefek = await p.$$eval('#elerhetoseg a', (l) => l.map((a) => a.getAttribute('href')));
      assert.ok(hrefek.includes('tel:+36202474444') && hrefek.includes('mailto:mosaicheadspa@gmail.com') && hrefek.some((h) => h.includes('google.com/maps/dir')));
      const szoveg = await p.locator('#elerhetoseg').innerText();
      for (const resz of ['1023 Budapest, Bécsi út 2.', '06 20 247 4444', 'mosaicheadspa@gmail.com', 'Hétfő – Szombat', '8:00 – 20:00', 'Vasárnap: zárva']) assert.ok(szoveg.includes(resz), resz);
      assert.ok(!/9:00|18:00/.test(await p.locator('main').innerText()), 'nincs regi szombati nyitvatartas');
      const foglal = await p.$$eval('#foglalas .foglal-kartya', (l) => l.map((k) => ({ cim: k.querySelector('h3').textContent, gomb: k.querySelector('a.gomb').getAttribute('href'), reszlet: k.querySelector('a.reszlet').getAttribute('href') })));
      assert.deepEqual(foglal.map((x) => x.cim), ['Head Spa', 'Páros Head Spa', 'Szőrtelenítés', 'Fodrászat', 'Oxigénterápia', 'Sminktetoválás']);
      assert.deepEqual(foglal.map((x) => x.gomb), ['/foglalo-motor?business=headspa', '/foglalo-motor?business=headspa&service=paros', '/foglalo-motor?business=laser', '/foglalo-motor?business=hair', '/foglalo-motor?business=oxygen', '/sminktetovalas-budapest#foglalas']);
      assert.ok(await p.locator('a[href="/ajandekkartya"]').count() >= 2, 'ajandekkartya gombok');
      const social = await p.$$eval('.social-gomb', (l) => l.map((a) => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]));
      assert.deepEqual(social, [['https://www.instagram.com/mosaicheadspa/', '_blank', 'noopener'], ['https://www.facebook.com/mosaicheadspa/', '_blank', 'noopener']]);
      assert.ok(await p.locator('a[href="/gyik"]').count() >= 1);
      assert.equal(await p.evaluate(() => { const l = [...document.querySelectorAll('li[data-testid="menuItemDepth0"]')].find((x) => x.querySelector('a') && x.querySelector('a').getAttribute('href') === '/kapcsolat'); return l && l.getAttribute('data-is-current'); }), 'true', 'a Kapcsolat menupont kijelolt');
      // a lablec elerhetosegei egyeznek
      assert.ok((await p.locator('#SITE_FOOTER').innerText()).includes('Hétfő – Szombat: 8:00 – 20:00'));
      await ctx.close();
    });

    for (const szeles of [1440, 390]) {
      test(`${szeles} px: nincs vizszintes gorgetes, a kartyak es az urlap a szelessegen belul`, async () => {
        const { p, ctx } = await nyit('/kapcsolat', szeles);
        const r = await p.evaluate(() => ({ vizsz: document.documentElement.scrollWidth - innerWidth, ki: [...document.querySelectorAll('main a, main p, main h2, main h3, main input, main select, main textarea, main button')].filter((e) => !e.closest('.csapda')).filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); }).map((e) => e.tagName + ':' + (e.textContent || e.name || '').trim().slice(0, 30)) }));
        assert.equal(r.vizsz, 0);
        assert.deepEqual(r.ki, []);
        await ctx.close();
      });
    }

    test('az urlap: ures kuldesnel hibak jelennek meg es nem megy ki keres; rossz e-mail hiba; a csapda-mezo rejtett', async () => {
      const { p, ctx, posztok } = await nyit('/kapcsolat');
      const cs = await p.locator('.csapda input').boundingBox();
      assert.ok(!cs || cs.x < -1000 || cs.width <= 1, 'a csapda-mezo a kepernyon kivul van (a latogato nem latja)');
      await p.locator('#kapcsolat-kuldes').click();
      await p.waitForTimeout(200);
      assert.equal(await p.locator('#kapcsolat-urlap .hibas').count(), 4, 'nev, e-mail, uzenet, hozzajarulas');
      assert.deepEqual(posztok, []);
      await p.fill('[name=nev]', 'Teszt Elek'); await p.fill('[name=email]', 'nem-email'); await p.fill('[name=uzenet]', 'Szia');
      await p.check('[name=hozzajarulas]');
      await p.locator('#kapcsolat-kuldes').click();
      await p.waitForTimeout(200);
      assert.equal(await p.locator('#kapcsolat-urlap .hibas').count(), 1, 'csak az e-mail hibas');
      assert.deepEqual(posztok, []);
      await ctx.close();
    });

    test('az urlap: ervenyes kuldes a POST "/" utvonalra megy form-name=kapcsolat mezovel, utana a koszono doboz latszik; szerverhiba eseten hibauzenet es ujra kuldheto', async () => {
      const { p, ctx, posztok } = await nyit('/kapcsolat');
      await p.fill('[name=nev]', 'Teszt Elek'); await p.fill('[name=email]', 'teszt@example.com'); await p.fill('[name=telefon]', '06301234567');
      await p.selectOption('[name=tema]', 'Fodrászat'); await p.fill('[name=uzenet]', 'Szia, érdeklődni szeretnék.\nKöszönöm!'); await p.check('[name=hozzajarulas]');
      await p.locator('#kapcsolat-kuldes').click();
      await p.waitForSelector('#kapcsolat-kesz.latszik', { timeout: 8000 });
      assert.equal(posztok.length, 1);
      const adat = new URLSearchParams(posztok[0]);
      assert.equal(adat.get('form-name'), 'kapcsolat');
      assert.equal(adat.get('nev'), 'Teszt Elek'); assert.equal(adat.get('email'), 'teszt@example.com'); assert.equal(adat.get('telefon'), '06301234567');
      assert.equal(adat.get('tema'), 'Fodrászat'); assert.equal(adat.get('uzenet'), 'Szia, érdeklődni szeretnék.\nKöszönöm!'); assert.equal(adat.get('hozzajarulas'), 'igen'); assert.equal(adat.get('bot-field'), '');
      assert.equal(await p.locator('#kapcsolat-urlap').isVisible(), false);
      assert.match(await p.locator('#kapcsolat-kesz').innerText(), /Köszönjük/);
      await ctx.close();
      // szerverhiba
      const h = await nyit('/kapcsolat', 1440, { post: (r) => r.fulfill({ status: 500, body: 'hiba' }) });
      await h.p.fill('[name=nev]', 'A'); await h.p.fill('[name=email]', 'a@b.hu'); await h.p.fill('[name=uzenet]', 'Szia'); await h.p.check('[name=hozzajarulas]');
      await h.p.locator('#kapcsolat-kuldes').click();
      await h.p.waitForSelector('#kapcsolat-hiba.hiba', { timeout: 8000 });
      assert.match(await h.p.locator('#kapcsolat-hiba').innerText(), /nem sikerült/);
      assert.equal(await h.p.locator('#kapcsolat-kuldes').isDisabled(), false, 'ujra kuldheto');
      assert.equal(await h.p.locator('#kapcsolat-kesz.latszik').count(), 0);
      await h.ctx.close();
    });

    test('a terkep gombra kattintva betoltodik (a Google keret kerese ekkor mar mehet), addig nem', async () => {
      const { p, ctx } = await nyit('/kapcsolat');
      assert.equal(await p.locator('#terkep iframe').count(), 0);
      await p.locator('#terkep-gomb').click();
      await p.waitForSelector('#terkep iframe', { timeout: 5000 });
      assert.match(await p.locator('#terkep iframe').getAttribute('src'), /google\.com\/maps/);
      await ctx.close();
    });
  });
});
