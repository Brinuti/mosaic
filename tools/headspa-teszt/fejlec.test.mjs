// A kozos fejlec / lablec megujitasa (2026-10-07): onallo "Paros Head Spa" fomenupont, "EN" jelveny a zaszlo helyett, uj lablec, angol valtozat.
//
//   node --test tools/headspa-teszt/fejlec.test.mjs
//
// 1) a fejlec-darabokon es a Wixes (klon) oldalakon: az atalakitas ismetelhetetlen-biztos, pontosan egyszer hoz letre mindent, a kijelolt menupont megmarad
// 2) az angol valtozat (<!--mh-nyelv:en-->): angol cimkek, GYIK nelkul, HU jelveny, angol lablec; az oldal torzset nem erinti
// 3) bongeszoben (a konnyu helyi szerver a foglalas/*.html oldalakon): a menu egy sorban elfer 1440 / 1280 / 1100 px-en, a lenyilo kinyilik, a lablec nem lóg ki
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (lasd headspa.test.mjs).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { szerverInditas, GYOKER } from './szerver.mjs';

const { fejlecAtalakit, ANGOL_JELOLO } = await import(pathToFileURL(path.join(GYOKER, 'tools', 'fejlec-menu.mjs')).href);
const olvas = (...r) => fs.readFileSync(path.join(GYOKER, ...r), 'utf8');
const db = (s, resz) => s.split(resz).length - 1;
const FEJLEC = { asztali: olvas('assets', 'fejlec', 'asztali.html'), mobil: olvas('assets', 'fejlec', 'mobil.html') };
const LABLEC = { asztali: olvas('assets', 'fejlec', 'lablec-asztali.html'), mobil: olvas('assets', 'fejlec', 'lablec-mobil.html') };
const fejlecResz = (h) => h.match(/<header id="SITE_HEADER"[\s\S]*?<\/header>/)[0];
const PAROS = 'href="/paros-headspa-budapest"';

describe('a fejlec-darabok (sajat oldalak)', () => {
  for (const [nev, mobil] of [['asztali', false], ['mobil', true]]) {
    test(`${nev}: a Paros Head Spa onallo fomenupont (a Head Spa utan, a lenyilobol kikerul), az EN jelveny a zaszlo helyett; ismetelt atalakitas nem valtoztat`, () => {
      const uj = fejlecAtalakit(FEJLEC[nev], mobil);
      const h = fejlecResz(uj);
      assert.equal(fejlecAtalakit(uj, mobil), uj, 'ismetelhetetlen-biztos');
      assert.equal(db(h, PAROS), 1, 'pontosan egy Paros link a fejlecben');
      assert.equal(db(h, 'href="/arlista"'), 1, 'pontosan egy Árlista link a fejlecben (a FOGLALÁS előtt)');
      assert.ok(h.indexOf('href="/arlista"') < h.indexOf('href="/gyik"'), 'az Árlista a GYIK előtt');
      if (mobil) {
        const sor = h.match(/<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-paros"[^>]*>[\s\S]*?<\/li>/)[0];
        assert.ok(sor.includes(PAROS), 'onallo (fo)sor');
        assert.ok(h.indexOf('MENU_AS_CONTAINER_EXPANDABLE_MENU-paros') < h.indexOf('href="/lezeres-szortelenites-budapest"'), 'a Szortelenites elott');
      } else {
        const i = h.indexOf(PAROS);
        const eleje = h.lastIndexOf('<li ', i);
        assert.match(h.slice(eleje, eleje + 140), /class="itemDepth02233374943__itemWrapper wixui-horizontal-menu__item"/, 'fomenupont (itemDepth0), nem lenyilo-elem');
        assert.ok(i < h.indexOf('href="/lezeres-szortelenites-budapest"') && i > h.indexOf('href="/headspa-ferfiaknak"') - 4000, 'a Head Spa es a Szortelenites kozott');
      }
      assert.ok(!/english-flag|c2eb0f_ec266ac7692e4ac78b760a89cd93adb8/.test(h), 'nincs zaszlo-kep');
      if (mobil) {
        // a tulajdonos kerese: a mobil fejlecben nincs nyelvi gomb (a magyar / angol valtas a lablecben van)
        assert.equal(db(h, 'mh-nyelv'), 0, 'mobilon nincs EN jelveny');
        assert.ok(!h.includes('comp-m7jcfhgp'));
      } else {
        assert.match(h, /<a [^>]*href="\/headspa-budapest-hungary"[^>]*hreflang="en"[^>]*>[\s\S]*?<span>EN<\/span><\/a>/);
        assert.equal(db(h, 'mh-nyelv'), 1);
      }
    });
  }

  test('a kijelolt (aktiv) lenyilo-elem jelolese atkerul az uj fomenupontra', () => {
    const aktiv = FEJLEC.asztali.replace(/(<li class="itemDepth12472627565__itemWrapper"[^>]*data-is-current=)"false"( aria-current=)"false"((?:(?!<\/li>)[\s\S])*?href="\/paros-headspa-budapest")/, '$1"true"$2"true"$3');
    assert.notEqual(aktiv, FEJLEC.asztali, 'az elokeszites megtalalta a lenyilo-elemet');
    const h = fejlecResz(fejlecAtalakit(aktiv, false));
    assert.match(h, /data-is-current="true" aria-current="true"><div class="itemShared2352141355__rootContainer"><a [^>]*href="\/paros-headspa-budapest"[^>]*itemDepth02233374943--isCurrentPage/);
    const m = FEJLEC.mobil.replace(/(<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\d+-\d+") (class="[^"]*")((?:(?!<\/li>)[\s\S])*?href="\/paros-headspa-budapest")/, '$1 aria-current="page" $2$3');
    assert.notEqual(m, FEJLEC.mobil);
    assert.match(fejlecResz(fejlecAtalakit(m, true)), /<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-paros" aria-current="page" class="[^"]*jqR3kU"/);
  });

  for (const [nev, mobil] of [['asztali', false], ['mobil', true]]) {
    test(`${nev}: az "i" ablak (Info) az oldal stilusaban: elerhetoseg, nyitvatartas (H-Szo 8-20), arlista-link, gombok; a regi Wixes ablak helyett`, () => {
      const uj = fejlecAtalakit(FEJLEC[nev], mobil);
      assert.equal(db(uj, '<template id="mh-popup-rk7x7">'), 1);
      const t = uj.slice(uj.indexOf('<template id="mh-popup-rk7x7">'), uj.indexOf('</template>', uj.indexOf('<template id="mh-popup-rk7x7">')));
      for (const resz of ['class="mh-popup-gyoker mhp"', 'data-mh-popup="rk7x7"', 'class="mh-popup-doboz mhp-panel"', 'data-mh-popup-zar', 'A legfontosabb infók', 'Ahol elérsz minket', '1023 Budapest, Bécsi út 2.', 'href="tel:+36202474444"',
        'href="mailto:mosaicheadspa@gmail.com"', '<b>Hétfő – Szombat:</b> 8:00 – 20:00', '<b>Vasárnap:</b> zárva', 'href="/arlista"', 'Árlista és időpontok', 'href="/foglalo-motor?business=headspa"', 'href="/ajandekkartya"']) assert.ok(t.includes(resz), resz);
      assert.ok(!/9[:.]00|9-18|9–18|Szo:/.test(t.replace(/<[^>]+>/g, ' ')), 'nincs regi szombati nyitvatartas');
      assert.ok(!t.includes('wixui') && !t.includes('POPUPS_ROOT'), 'a Wixes ablak helyett');
      assert.equal(fejlecAtalakit(uj, mobil), uj);
    });
  }

  test('mobil menu: az Ajandekkartya lenyilo alapbol nyitva (3 kartya), az aria-expanded igaz; asztalon nem nyitott', () => {
    const m = fejlecResz(fejlecAtalakit(FEJLEC.mobil, true));
    const li = m.match(/<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\d+"[^>]*class="[^"]*rErQ82[^"]*"[^>]*>(?:(?!<\/li><li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\d+")[\s\S])*?href="\/ajandekkartya"[\s\S]*?<\/ul><\/li>/);
    assert.ok(li, 'az Ajandekkartya sor nyitott (rErQ82)');
    assert.ok(/aria-expanded="true"[^>]*aria-label="Ajándékkártya"/.test(li[0]) || /aria-expanded="true"[^>]*aria-label="Aj&aacute;ndékkártya"/.test(li[0]) || li[0].includes('aria-expanded="true"'));
    assert.equal(db(li[0], '/headspa-ajandekkartya') + db(li[0], '/lezeres-ajandekkartya') + db(li[0], '/oxigen-ajandekkartya'), 3, 'harom kartya');
    assert.equal(db(m, 'rErQ82'), 1, 'csak az Ajandekkartya nyitott');
    assert.ok(!fejlecResz(fejlecAtalakit(FEJLEC.asztali, false)).includes('rErQ82'));
  });

  for (const nev of ['asztali', 'mobil']) {
    test(`${nev}: az uj lablec (4 oszlop-tartalom, jogi sor, suti-beallitasok, nyelvvalto), ismetelve nem valtozik`, () => {
      const uj = fejlecAtalakit(LABLEC[nev], nev === 'mobil');
      assert.equal(fejlecAtalakit(uj, nev === 'mobil'), uj);
      assert.equal(db(uj, '<footer id="SITE_FOOTER"'), 1);
      for (const resz of ['class="mh-lablec-uj"', 'Head Spa kezelések', 'Páros Head Spa', 'Head Spa Férfiaknak', 'Csomagok és árak', 'Szőrtelenítés', 'Fodrászat', 'Oxigénterápia', 'Sminktetoválás', 'Ajándékkártya',
        '1023 Budapest, Bécsi út 2.', 'href="tel:+36202474444"', 'href="mailto:mosaicheadspa@gmail.com"', 'Hétfő – Szombat: 8:00 – 20:00', 'Vasárnap: ZÁRVA',
        '© Big in Japan Kft.', 'href="/aszf"', 'href="/impresszum"', 'id="mh-cc-lablec"', 'href="/headspa-budapest-hungary"', 'href="/foglalo-motor?business=headspa"', 'id="comp-m40zyigs"']) assert.ok(uj.includes(resz), resz);
      assert.equal(db(uj, 'id="mh-cc-lablec"'), 1, 'a suti-beallitasok link pontosan egyszer');
    });
  }
});

describe('a Wixes (klon) oldalak beegetett fejlece / lablece', () => {
  const OLDALAK = ['index', 'headspa-ferfiaknak', 'paros-headspa-budapest', 'noi-fodraszat-budapest', 'oxigenterapia-budapest', 'sminktetovalas-budapest', 'headspa-budapest-hungary', 'impresszum'];
  for (const [nev, mobil, mappa] of [['asztali', false, 'klon'], ['mobil', true, 'klon/m']]) {
    for (const o of OLDALAK) {
      test(`${nev} /${o}: onallo Paros pont egyszer, uj lablec egyszer, EN jelveny, ismetelhetetlen-biztos`, () => {
        const eredeti = olvas(...mappa.split('/'), o + '.html');
        const uj = fejlecAtalakit(eredeti, mobil);
        assert.equal(fejlecAtalakit(uj, mobil), uj);
        const h = fejlecResz(uj);
        assert.equal(db(h, PAROS), 1, 'a fejlecben pontosan egy Paros link');
        assert.equal(db(uj, 'class="mh-lablec-uj"'), 1);
        assert.equal(db(uj, '<footer id="SITE_FOOTER"'), 1);
        assert.equal(db(h, 'mh-nyelv'), mobil ? 0 : 1, mobil ? 'mobilon nincs EN jelveny' : 'asztalon EN jelveny');
        if (mobil) assert.equal(db(h, 'rErQ82'), 1, 'mobilon csak az Ajandekkartya lenyilo nyitva');
        assert.ok(!uj.includes('Big in Japan Kft. - '), 'a regi lablec-szoveg nincs meg');
        // az oldal torzse valtozatlan: a fejlec es a lablec kozotti resz azonos
        const torzs = (t) => t.slice(t.indexOf('</header>'), t.indexOf('<footer id="SITE_FOOTER"'));
        assert.equal(torzs(uj), torzs(eredeti), 'a torzs nem valtozott');
      });
    }
  }
  test('a /paros-headspa-budapest oldalon a Paros Head Spa fomenupont kijelolt (asztali + mobil)', () => {
    const a = fejlecResz(fejlecAtalakit(olvas('klon', 'paros-headspa-budapest.html'), false));
    assert.match(a, /data-is-current="true" aria-current="true"><div class="itemShared2352141355__rootContainer"><a [^>]*href="\/paros-headspa-budapest"/);
    const m = fejlecResz(fejlecAtalakit(olvas('klon', 'm', 'paros-headspa-budapest.html'), true));
    assert.match(m, /<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-paros" aria-current="page"/);
  });
});

describe('az angol valtozat (<!--mh-nyelv:en-->)', () => {
  for (const [nev, mobil] of [['asztali', false], ['mobil', true]]) {
    test(`${nev}: angol menucimkek, GYIK nelkul, HU jelveny, angol akciosav + lablec; az oldal torzse valtozatlan`, () => {
      const torzs = '<main><a href="/headspa-ajandekkartya">Ajándékkártya</a> <a href="/idpontfoglalas">FOGLALÁS</a> Októberi akció! - 20% kedvezmény minden headspa foglalásra + ajándékkártyára!</main>';
      const lap = FEJLEC[nev] + torzs + LABLEC[nev] + ANGOL_JELOLO;
      const uj = fejlecAtalakit(lap, mobil);
      assert.equal(fejlecAtalakit(uj, mobil), uj);
      const h = fejlecResz(uj);
      for (const cim of ['Couples Head Spa', 'Laser hair removal', 'Hairdressing', 'Oxygen therapy', 'Permanent makeup', 'Gift card', 'Contact', 'What is Head Spa?', 'Head Spa for men', 'Oxygen therapy gift card'])
        assert.ok(h.includes('>' + cim + '<'), cim);
      assert.ok(h.includes(mobil ? 'Book' : 'BOOKING'), 'foglalas gomb / menupont angolul');
      assert.ok(!h.includes('#comp-m4l2o45p'), 'a GYIK pont (magyar oldalra visz) elmarad');
      assert.ok(h.includes('href="#helyszin"'), 'a Contact az oldal sajat elerhetoseg-szekciojara ugrik');
      if (!mobil) assert.match(h, /<a [^>]*href="\/"[^>]*hreflang="hu"[^>]*>[\s\S]*?<span>HU<\/span><\/a>/);
      assert.ok(h.includes('October offer!'), 'angol akciosav');
      assert.ok(!/Szőrtelenítés|Fodrászat|Sminktetoválás|Oxigénterápia/.test(h.replace(/href="[^"]*"/g, '')), 'nincs magyar menucimke');
      assert.ok(uj.includes('<main><a href="/headspa-ajandekkartya">Ajándékkártya</a> <a href="/idpontfoglalas">FOGLALÁS</a> Októberi akció!'), 'az oldal torzse valtozatlan (a fejlecen kivuli hasonlo linkek nem erintettek)');
      const lablec = uj.slice(uj.indexOf('<footer id="SITE_FOOTER"'));
      for (const resz of ['Book now', 'Contact &amp; opening hours', 'Monday – Saturday: 8:00 – 20:00', 'Sunday: CLOSED', 'Cookie settings', 'Terms (HU)', 'hreflang="hu"', 'Magyar', 'id="mh-cc-lablec"']) assert.ok(lablec.includes(resz), resz);
    });
  }
});

describe('bongeszoben (konnyu helyi szerver)', () => {
  let bongeszo, szerver, bazis;
  const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  before(async () => {
    const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
    let pw; for (const k of keres) { try { pw = createRequire(path.join(k, 'x.js'))('playwright-core'); break; } catch { /* kovetkezo */ } }
    if (!pw) throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
    ({ szerver, bazis } = await szerverInditas());
    bongeszo = await pw.chromium.launch({ executablePath: process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  });
  after(async () => { await bongeszo.close(); szerver.close(); });
  const nyit = async (szeles, ut = '/headspa-arak-budapest') => {
    const mobil = szeles < 700;
    const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
    const p = await ctx.newPage();
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(bazis + ut, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(700);
    return { p, ctx };
  };

  for (const szeles of [1920, 1440, 1280, 1100]) {
    test(`asztali ${szeles} px: mind a 11 fomenupont egy sorban, a menu nem lóg a logo / "i" / EN ele, vizszintes gorgetes nincs`, async () => {
      const { p, ctx } = await nyit(szeles);
      const r = await p.evaluate(() => {
        const lis = [...document.querySelectorAll('#comp-m4lbfl1t nav > ul > li')];
        const b = (e) => e.getBoundingClientRect();
        const cimek = lis.map((l) => l.querySelector('[class*="__label"]').textContent.trim());
        return { n: lis.length, cimek, sorok: new Set(lis.map((l) => Math.round(b(l).top))).size, utolso: Math.max(...lis.map((l) => b(l).right)), elso: Math.min(...lis.map((l) => b(l).left)),
          logo: b(document.querySelector('#comp-m3znboq3')).right, ikon: b(document.querySelector('#comp-m7q6eklh')), nyelv: b(document.querySelector('#comp-m7jcfhgp')), vizsz: document.documentElement.scrollWidth - innerWidth };
      });
      assert.equal(r.n, 11, r.cimek.join(','));
      assert.deepEqual(r.cimek.slice(-4), ['Árlista', 'FOGLALÁS', 'GYIK', 'Kapcsolat'], 'az Árlista a FOGLALÁS előtt');
      assert.deepEqual(r.cimek.slice(0, 3), ['Head Spa', 'Páros Head Spa', 'Szőrtelenítés']);
      assert.equal(r.sorok, 1);
      assert.ok(r.utolso <= r.ikon.left - 4, `a menu vege (${Math.round(r.utolso)}) az "i" elott van (${Math.round(r.ikon.left)})`);
      assert.ok(r.elso >= r.logo + 8, 'a menu a logo utan kezdodik');
      assert.ok(r.nyelv.right <= szeles - 8 && r.nyelv.width >= 40, 'az EN jelveny latszik, benne van az ablakban');
      assert.equal(r.vizsz, 0);
      await ctx.close();
    });
  }

  test('asztali: a Head Spa lenyilo kinyilik (7 elem, a Paros nincs benne), a Fodraszat lenyilo is; a kijelolt oldal arany', async () => {
    const { p, ctx } = await nyit(1440, '/headspa-arak-budapest');
    const kozep = (szoveg) => p.evaluate((t) => { const l = [...document.querySelectorAll('li[data-testid="menuItemDepth0"]')].find((e) => e.textContent.trim().startsWith(t)); const b = l.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, szoveg);
    const lenyilo = async (szoveg) => {
      const k = await kozep(szoveg);
      await p.mouse.move(5, 400); await p.mouse.move(k.x, k.y, { steps: 4 }); await p.waitForTimeout(500);
      return p.evaluate((t) => { const l = [...document.querySelectorAll('li[data-testid="menuItemDepth0"]')].find((e) => e.textContent.trim().startsWith(t));
        const doboz = l.querySelector('[data-testid="positionBox"]'); const b = doboz.getBoundingClientRect();
        const elemek = [...doboz.querySelectorAll('li a')].map((a) => ({ cim: a.textContent.trim(), b: a.getBoundingClientRect() }));
        return { lathato: getComputedStyle(doboz).display !== 'none' && b.width > 100 && b.height > 40, bal: b.left, jobb: b.right, alul: b.bottom, cimek: elemek.map((e) => e.cim), egymasAlatt: elemek.every((e, i) => i === 0 || e.b.top > elemek[i - 1].b.top), ablakban: elemek.every((e) => e.b.left >= 0 && e.b.right <= innerWidth) }; }, szoveg);
    };
    const hs = await lenyilo('Head Spa');
    assert.ok(hs.lathato && hs.egymasAlatt && hs.ablakban);
    assert.equal(hs.cimek.length, 7, hs.cimek.join(' | '));
    assert.ok(!hs.cimek.includes('Páros Head Spa') && hs.cimek.includes('Head Spa Férfiaknak') && hs.cimek.includes('Head Spa Csomagok és Árak'));
    const fod = await lenyilo('Fodrászat');
    assert.deepEqual(fod.cimek, ['Betti', 'Noel', 'Evelin', 'Fodrászat Árak']);
    const aj = await lenyilo('Ajándékkártya');
    assert.equal(aj.cimek.length, 3);
    assert.ok(aj.egymasAlatt && aj.ablakban);
    await ctx.close();
  });

  test('asztali: a FOGLALAS arany gomb a menusorban, az "i" es az EN korvonalas jelveny (nincs zaszlo-kep)', async () => {
    const { p, ctx } = await nyit(1440);
    const r = await p.evaluate(() => {
      const fogl = [...document.querySelectorAll('#comp-m4lbfl1t nav > ul > li')].find((l) => /FOGLAL/.test(l.textContent)).querySelector('[class*="__label"]');
      const cs = getComputedStyle(fogl); const nyelv = getComputedStyle(document.querySelector('.mh-nyelv'));
      return { hatter: cs.backgroundImage, radius: cs.borderTopLeftRadius, nyelvKeret: nyelv.borderTopWidth, nyelvRadius: nyelv.borderTopLeftRadius, jelkep: document.querySelectorAll('#comp-m7jcfhgp img').length, iKep: getComputedStyle(document.querySelector('#comp-m7q6eklh img')).opacity };
    });
    assert.match(r.hatter, /gradient/);
    assert.ok(parseFloat(r.radius) > 10);
    assert.ok(parseFloat(r.nyelvKeret) >= 1 && parseFloat(r.nyelvRadius) > 10);
    assert.equal(r.jelkep, 0);
    assert.equal(r.iKep, '0');
    await ctx.close();
  });

  // (a Wixes asztali oldalak 980 px-nel keskenyebben vizszintesen gorgetnek - ez a regi oldalak tulajdonsaga -, ezert a lablec-tesztben csak a normal asztali es a telefonos szelesseg szerepel)
  for (const szeles of [1440, 390]) {
    test(`${szeles} px: a lablec megvan (cim, telefon, e-mail, nyitvatartas, jogi sor, suti-beallitasok), nem lóg ki, az oszlopok a szelessegnek megfelelnek`, async () => {
      const { p, ctx } = await nyit(szeles);
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const f = document.getElementById('SITE_FOOTER'); const b = f.getBoundingClientRect();
        const oszlopok = getComputedStyle(f.querySelector('.mhl-belso')).gridTemplateColumns.split(' ').length;
        const kilog = [...f.querySelectorAll('a, p, h3, img')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map((e) => e.textContent.trim().slice(0, 30));
        return { szoveg: f.innerText, oszlopok, kilog, bal: b.left, jobb: b.right, szeles: b.width, vizsz: document.documentElement.scrollWidth - innerWidth, hatter: getComputedStyle(f).backgroundImage, cookie: !!document.getElementById('mh-cc-lablec') };
      });
      for (const resz of ['Head Spa kezelések', '1023 Budapest, Bécsi út 2.', '+36 20 247 4444', 'mosaicheadspa@gmail.com', 'Hétfő – Szombat: 8:00 – 20:00', 'Big in Japan Kft.', 'ÁSZF', 'Impresszum', 'Süti beállítások']) assert.ok(r.szoveg.includes(resz), resz);
      assert.ok(/english/i.test(r.szoveg), 'nyelvvalto');
      assert.deepEqual(r.kilog, []);
      assert.equal(r.vizsz, 0);
      assert.ok(r.cookie);
      assert.match(r.hatter, /gradient/);
      assert.equal(r.oszlopok, szeles >= 1000 ? 4 : 2, 'oszlopok szama');
      assert.ok(Math.abs(r.szeles - szeles) <= 1, 'a lablec a teljes szelessegben');
      await ctx.close();
    });
  }

  test('a lablec "Suti beallitasok" linkje megnyitja a suti-beallitasokat (a korabbi, beegetett link halott volt)', async () => {
    for (const szeles of [1440, 390]) {
      const { p, ctx } = await nyit(szeles);
      await p.evaluate(() => { try { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: false, ana: false, adv: false })); } catch (e) { /* nincs */ } });
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(500);
      await p.evaluate(() => document.getElementById('mh-cc-lablec').click());
      await p.waitForFunction(() => { const s = document.getElementById('mh-cc-settings'); return s && s.style.display !== 'none' && getComputedStyle(document.getElementById('mh-cc')).display !== 'none'; }, null, { timeout: 10000 });
      assert.match(await p.locator('#mh-cc-settings').innerText(), /Funkcionális/);
      assert.equal(await p.evaluate(() => location.hash), '', 'a link nem ugrik a #-re');
      await ctx.close();
    }
  });

  test('az "i" ablak: kinyilik, a nyitvatartas H-Szo 8-20, mobilon a nyitvatartas es az arlista-link egy-egy sorban van; X / Esc / hatterre kattintas bezar', async () => {
    for (const szeles of [1440, 390]) {
      const { p, ctx } = await nyit(szeles);
      await p.click('#comp-m7q6eklh a');
      await p.waitForFunction(() => { const g = document.querySelector('[data-mh-popup="rk7x7"]'); return g && !g.hidden && getComputedStyle(g.querySelector('.mh-popup-doboz')).display !== 'none'; }, null, { timeout: 10000 });
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const dob = document.querySelector('.mhp-panel'); const db = dob.getBoundingClientRect();
        const egySor = (e) => { const cs = getComputedStyle(e); return e.getBoundingClientRect().height <= parseFloat(cs.lineHeight) * 1.25 + 2; };
        const sorok = [...document.querySelectorAll('.mhp-szoveg')].map((e) => ({ szoveg: e.textContent.trim().replace(/\s+/g, ' '), egySor: egySor(e), tulcsordul: e.scrollWidth > e.clientWidth + 1 }));
        return { szoveg: dob.innerText, jobb: db.right, szeles: db.width, bal: db.left, ablak: innerWidth, sorok, vizsz: document.documentElement.scrollWidth - innerWidth };
      });
      assert.match(r.szoveg, /Hétfő – Szombat:\s*8:00 – 20:00/);
      assert.match(r.szoveg, /Vasárnap:\s*zárva/);
      assert.ok(!/9:00|9-18/.test(r.szoveg), 'nincs regi nyitvatartas');
      assert.ok(Math.abs(r.jobb - r.ablak) <= 1 && r.bal >= -1, 'a panel jobbrol, az ablakon belul');
      const nyitv = r.sorok.find((x) => /Hétfő – Szombat/.test(x.szoveg)); const ar = r.sorok.find((x) => /Árlista és időpontok/.test(x.szoveg));
      for (const [nev, x] of [['nyitvatartas', nyitv], ['arlista-link', ar]]) { assert.ok(x, nev); assert.ok(x.egySor, `${szeles}px: a ${nev} egy sorban van: ${x.szoveg}`); assert.ok(!x.tulcsordul, `${szeles}px: a ${nev} nem lóg ki`); }
      for (const x of r.sorok.filter((y) => /^(06 20|mosaicheadspa)/.test(y.szoveg))) assert.ok(x.egySor && !x.tulcsordul, x.szoveg);
      // bezaras: Esc, X, hatterre kattintas
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => document.querySelector('[data-mh-popup="rk7x7"]').hidden, null, { timeout: 9000 });
      for (const mod of ['x', 'hatter']) {
        await p.click('#comp-m7q6eklh a');
        await p.waitForFunction(() => !document.querySelector('[data-mh-popup="rk7x7"]').hidden);
        if (mod === 'x') await p.click('.mhp-zar'); else await p.mouse.click(6, 300);
        await p.waitForFunction(() => document.querySelector('[data-mh-popup="rk7x7"]').hidden, null, { timeout: 9000 });
      }
      await ctx.close();
    }
  });

  test('mobil menu: megnyitva az Ajandekkartya lenyilo nyitva van (3 kartya), es az egesz menu elfer a kepernyon (nincs belso gorgetes)', async () => {
    for (const magas of [844, 700]) {
      const ctx = await bongeszo.newContext({ viewport: { width: 390, height: magas }, userAgent: UA_MOBIL, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
      await p.goto(bazis + '/headspa-arak-budapest', { waitUntil: 'domcontentloaded' });
      await p.waitForTimeout(600);
      await p.click('#MENU_AS_CONTAINER_TOGGLE');
      await p.waitForTimeout(700);
      const r = await p.evaluate(() => {
        const menu = document.querySelector('#MENU_AS_CONTAINER_EXPANDABLE_MENU'); const ul = menu.querySelector(':scope > ul');
        const sorok = [...menu.querySelectorAll('a')].filter((a) => a.getBoundingClientRect().height > 0);
        const aj = [...menu.querySelectorAll(':scope > ul > li')].find((l) => /Ajándékkártya/.test(l.querySelector('a').textContent));
        const alElemek = [...aj.querySelectorAll('.wixui-vertical-menu__submenu a')].filter((a) => a.getBoundingClientRect().height > 0).map((a) => a.textContent.trim());
        const utolso = Math.max(...sorok.map((a) => a.getBoundingClientRect().bottom));
        const kapcsolat = [...menu.querySelectorAll('a')].find((a) => /Kapcsolat/.test(a.textContent)).getBoundingClientRect();
        return { alElemek, utolso, kapcsolatAlja: kapcsolat.bottom, ablak: innerHeight, kapcsolatLatszik: kapcsolat.height > 0 };
      });
      assert.deepEqual(r.alElemek, ['Head Spa ajándékkártya', 'Szőrtelenítés ajándékkártya', 'Oxigénterápia ajándékkártya'], 'harom kartya latszik');
      assert.ok(r.kapcsolatLatszik && r.kapcsolatAlja <= r.ablak, `${magas}px magas ablak: a Kapcsolat sor (${Math.round(r.kapcsolatAlja)}) elfer (${r.ablak})`);
      await ctx.close();
    }
  });

  test('mobil: a fejlecben nincs EN jelveny, az "i" es a Foglalas gomb latszik, a menu megnyilik: Paros Head Spa onallo sor, a Head Spa lenyilojaban nincs Paros; a FOGLALAS arany', async () => {
    const { p, ctx } = await nyit(390);
    assert.equal(await p.locator('#SITE_HEADER .mh-nyelv').count(), 0, 'mobilon nincs EN jelveny a fejlecben');
    assert.ok(await p.locator('#comp-m7q6eklh').isVisible(), 'az i ikon latszik');
    await p.click('#MENU_AS_CONTAINER_TOGGLE');
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const fo = [...document.querySelectorAll('#MENU_AS_CONTAINER_EXPANDABLE_MENU > ul > li')];
      const cimek = fo.map((l) => l.querySelector('a').textContent.trim());
      const hsAlmenu = [...fo[0].querySelectorAll('.wixui-vertical-menu__submenu a')].map((a) => a.textContent.trim());
      const lathato = fo.every((l) => l.getBoundingClientRect().width > 100);
      return { cimek, hsAlmenu, lathato };
    });
    assert.deepEqual(r.cimek.slice(0, 3), ['Head Spa', 'Páros Head Spa', 'Szőrtelenítés']);
    assert.ok(!r.hsAlmenu.some((c) => /Páros/.test(c)));
    assert.equal(r.hsAlmenu.length, 7);
    assert.ok(r.lathato);
    // a lablec nyelvvaltoja marad (mobilon az angol oldalra innen lehet menni)
    assert.ok((await p.locator('#SITE_FOOTER a.mhl-nyelv[hreflang="en"]').count()) === 1);
    await ctx.close();
  });
});

describe('a build bekotese', () => {
  test('a build es a helyi szerver ugyanazt a modult hasznalja; a lablec regi CSS-e (Wix-csik) nincs meg', () => {
    const build = olvas('tools', 'netlify-build.mjs');
    assert.match(build, /fejlecAtalakit\(resz\('<!--mh-lablec-->'/);
    assert.match(olvas('tools', 'headspa-teszt', 'szerver.mjs'), /fejlecAtalakit\(resz\('<!--mh-fejlec-->'/);
    const css = olvas('assets', 'css', 'fejlec-lablec.css');
    assert.ok(!css.includes('#comp-m40zyigs p { letter-spacing'), 'a regi lablec-szabalyok kikerultek');
    assert.match(css, /#SITE_FOOTER\.mh-lablec-uj/);
  });
});
