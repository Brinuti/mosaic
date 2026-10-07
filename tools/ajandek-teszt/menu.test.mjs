// Az "Ajandekkartya" fomenupont lenyiloja + a /ajandekkartya valaszto oldal (statikus, build / bongeszo nelkul):
//   node --test tools/ajandek-teszt/menu.test.mjs
// A lenyilot a build (tools/netlify-build.mjs) teszi a fejlecbe a tools/ajandek-menu.mjs-bol: itt azt nezzuk, hogy MINDEN fejlec-valtozaton
// (asztali / mobil, a ~180 Wixes oldal es a sajat oldalak darabjai) pontosan egyszer, ervenyes jelolessel jon letre, es a kijelolt menupont is jo.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ajandekMenu, AJANDEK_MENU } from '../ajandek-menu.mjs';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const olvas = (...r) => fs.readFileSync(path.join(GYOKER, ...r), 'utf8');
const oldalak = (mappa) => fs.readdirSync(path.join(GYOKER, mappa)).filter((f) => f.endsWith('.html')).map((f) => [mappa + '/' + f, olvas(mappa, f)]);
const db = (szoveg, resz) => szoveg.split(resz).length - 1;

// a build aktivMenu fuggvenye, szo szerint (a build futtatasa nelkul)
const build = olvas('tools', 'netlify-build.mjs');
const kezd = build.indexOf('const aktivMenu = ');
const veg = build.indexOf("for (const f of fs.readdirSync(path.join(ROOT, 'foglalas'))", kezd);
const aktivMenu = new Function('return ' + build.slice(kezd + 'const aktivMenu = '.length, veg).trim().replace(/;$/, ''))();

describe('a fejlec-darabok (sajat oldalak)', () => {
  for (const [nev, mobil] of [['asztali', false], ['mobil', true]]) {
    test(`${nev}: az Ajandekkartya menupont lenyilo, benne a ket kartya; ismetelt atalakitas nem valtoztat`, () => {
      const eredeti = olvas('assets', 'fejlec', nev + '.html');
      const uj = ajandekMenu(eredeti, mobil);
      assert.notEqual(uj, eredeti);
      assert.equal(ajandekMenu(uj, mobil), uj, 'az atalakitas ismetelve nem valtoztat');
      assert.equal(db(uj, `href="${AJANDEK_MENU.utvonal}"`), 1, 'a fo menupont a valaszto oldalra mutat');
      for (const e of AJANDEK_MENU.elemek) {
        assert.equal(db(uj, `href="${e.utvonal}"`), 1, e.utvonal);
        assert.ok(uj.includes('>' + e.cim + '<'), e.cim);
      }
      // kiegyensulyozott <li> / <ul>
      const nav = uj.slice(uj.indexOf('<nav'), uj.indexOf('</nav>'));
      assert.equal(db(nav, '<li'), db(nav, '</li>'));
      assert.equal(db(nav, '<ul'), db(nav, '</ul>'));
      // a lenyilo ugyanazt a jelolest hasznalja, mint a Fodraszat (igy a meglevo CSS + a klon.js kezeli)
      if (mobil) assert.equal(db(uj, 'data-testid="expandablemenu-toggle"'), db(eredeti, 'data-testid="expandablemenu-toggle"') + 1);
      else assert.equal(db(uj, 'data-testid="positionBox"'), db(eredeti, 'data-testid="positionBox"') + 1);
    });
  }

  test('a mobil lenyilo almenu-azonositoi egyediek', () => {
    const uj = ajandekMenu(olvas('assets', 'fejlec', 'mobil.html'), true);
    const azonok = [...uj.matchAll(/data-testid="(MENU_AS_CONTAINER_EXPANDABLE_MENU-[\d-]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(azonok).size, azonok.length);
  });
});

describe('a Wixes (klon) oldalak beegetett fomenuje', () => {
  for (const [mappa, mobil] of [['klon', false], ['klon/m', true]]) {
    test(`${mappa}: minden oldalon pontosan egyszer alakul at`, () => {
      const lista = oldalak(mappa);
      assert.ok(lista.length > 80, 'a Wixes oldalak megvannak: ' + lista.length);
      for (const [nev, h] of lista) {
        const uj = ajandekMenu(h, mobil);
        assert.notEqual(uj, h, nev + ': nem talalta meg az Ajandekkartya menupontot');
        assert.equal(db(uj, `href="${AJANDEK_MENU.utvonal}"`), 1, nev);
        assert.equal(ajandekMenu(uj, mobil), uj, nev + ': nem ismetelhetetlen-biztos');
      }
    });
  }

  test('a regi Head Spa ajandekkartya oldalon (a kijelolt menupont) a fo menupont kijelolve marad', () => {
    const a = ajandekMenu(olvas('klon', 'headspa-ajandekkartya.html'), false);
    assert.match(a, /data-is-current="true" aria-current="true"><div class="itemShared2352141355__rootContainer itemShared2352141355--isRow"><a [^>]*href="\/ajandekkartya"/);
    const m = ajandekMenu(olvas('klon', 'm', 'headspa-ajandekkartya.html'), true);
    assert.match(m, /<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-5" aria-current="page" class="[^"]* jqR3kU">/);
  });
});

describe('a valaszto oldal (/ajandekkartya)', () => {
  const lap = olvas('foglalas', 'ajandekkartya.html');

  test('noindex, a ket kartya-oldalra visz, a fejlec/lablec jelolok es a kijelolt menupont megvan', () => {
    assert.match(lap, /<meta name="robots" content="noindex, follow">/);
    assert.match(lap, /<link rel="canonical" href="https:\/\/www\.mosaicheadspa\.hu\/ajandekkartya">/);
    for (const e of AJANDEK_MENU.elemek) assert.equal(db(lap, `<a class="av-kartya" href="${e.utvonal}">`), 1, e.utvonal);
    for (const jel of ['<!--mh-fejlec-->', '<!--mh-lablec-->', `<!--mh-menu-aktiv:${AJANDEK_MENU.utvonal}-->`]) assert.equal(db(lap, jel), 1, jel);
    assert.match(lap, /<script src="\/assets\/js\/klon\.js" defer><\/script>/, 'a fejlec menuje (mobil hamburger, lenyilok) a klon.js-tol mukodik');
  });

  test('a kepek leteznek, nincs kulso hivatkozas', () => {
    for (const m of lap.matchAll(/src="(\/assets\/[^"]+)"/g)) assert.ok(fs.existsSync(path.join(GYOKER, m[1])), m[1]);
    assert.doesNotMatch(lap.replace(/https:\/\/www\.mosaicheadspa\.hu\//g, ''), /(?:src|href)="https?:\/\//);
  });

  for (const [nev, mobil] of [['asztali', false], ['mobil', true]]) {
    test(`${nev}: a /ajandekkartya oldalon a fo "Ajandekkartya" menupont kijelolt`, () => {
      const fejlec = aktivMenu(ajandekMenu(olvas('assets', 'fejlec', nev + '.html'), mobil), AJANDEK_MENU.utvonal, mobil);
      if (mobil) assert.match(fejlec, /<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-5" aria-current="page" class="[^"]* jqR3kU"><div data-testid="itemWrapper" class="keDKhi"><span data-testid="linkWrapper" class="j945c8"><a data-testid="linkElement" href="\/ajandekkartya"/);
      else assert.match(fejlec, /data-is-current="true" aria-current="true"><div class="itemShared2352141355__rootContainer itemShared2352141355--isRow"><a [^>]*href="\/ajandekkartya" [^>]*itemDepth02233374943--isCurrentPage/);
      assert.equal(db(fejlec, mobil ? 'aria-current="page"' : 'data-is-current="true"'), 1, 'pontosan egy kijelolt menupont');
    });
  }
});

describe('az oxigénes ajándékkártya a menüben, a választón és az oxigén landingen', () => {
  test('a lenyílóban három kártya van (Head Spa, Szőrtelenítés, Oxigénterápia), a választó oldalon is három, mindegyik a saját oldalra visz', () => {
    assert.deepEqual(AJANDEK_MENU.elemek.map((e) => e.utvonal), ['/headspa-ajandekkartya', '/lezeres-ajandekkartya', '/oxigen-ajandekkartya']);
    const lap = olvas('foglalas', 'ajandekkartya.html');
    assert.equal(db(lap, 'class="av-kartya"'), 3);
    assert.match(lap, /<a class="av-kartya" href="\/oxigen-ajandekkartya">/);
    assert.match(lap, /Oxigénterápia ajándékkártya<\/h2>/);
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets', 'img', 'ajandek', 'valaszto-oxigen.jpg')));
    for (const nev of ['asztali', 'mobil']) {
      const fejlec = ajandekMenu(olvas('assets', 'fejlec', nev + '.html'), nev === 'mobil');
      assert.ok(fejlec.includes('>Oxigénterápia ajándékkártya<'), nev);
      assert.equal(db(fejlec, 'href="/oxigen-ajandekkartya"'), 1, nev);
    }
  });

  test('a választó rácsa: három oszlop 800 px-ig, tableten kettő (a harmadik kártya teljes sort kap), telefonon egy oszlop', () => {
    const css = olvas('foglalas', 'ajandekkartya.html').split('\r\n').join('\n');
    const tartalmaz = (reszlet) => assert.ok(css.includes(reszlet), reszlet);
    tartalmaz('.av-racs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px;');
    assert.ok(!css.includes('auto-fit'), 'nem auto-fit: az 906 px körüli váltás miatt lett túl gyorsan két oszlop');
    // három oszlop végig 1020 px-től egészen 800 px-ig (szűkebb közzel, tömörebb kártyával)
    tartalmaz('@media (max-width: 1020px) {\n  .av-racs { gap: 18px; }');
    // tablet állóban kettő, a harmadik kártya egész sor
    tartalmaz('@media (min-width: 600px) and (max-width: 799px) {\n  .av-racs { grid-template-columns: repeat(2, minmax(0, 1fr));');
    tartalmaz('.av-kartya:last-child:nth-child(odd) { grid-column: 1 / -1; flex-direction: row; }');
    // telefonon egy oszlop
    tartalmaz('@media (max-width: 599px) {\n  .av-racs { grid-template-columns: minmax(0, 1fr); }');
    // telefonon mind a HÁROM kártya látszik egy képernyőn (tömör, vízszintes kártyák: kép balra, szöveg jobbra)
    tartalmaz('MIND A HAROM kartya latszik egy kepernyon');
    tartalmaz('.av-kartya { flex-direction: row; border-radius: 14px; }');
    tartalmaz('.av-kep { flex: none; width: 36%; height: auto; aspect-ratio: auto; align-self: stretch; object-position: 80% 50%; }');
    tartalmaz('-webkit-line-clamp: 2;');
  });

  test('a választón mindhárom kártya fotóján „Személyre szabható" jelvény van (saját fotóval, saját szöveggel), és a fotókon ott a mintakártya', () => {
    const lap = olvas('foglalas', 'ajandekkartya.html').split('\r\n').join('\n');
    assert.equal(db(lap, '<span class="av-jelveny">'), 3);
    assert.equal(db(lap, '<b>Személyre szabható</b><small>saját fotóval, saját szöveggel</small>'), 3);
    // mindhárom fotó alt szövege jelzi a rajta lévő személyre szabott kártyát
    const kepek = [...lap.matchAll(/<img class="av-kep"[^>]*alt="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(kepek.length, 3);
    for (const alt of kepek) assert.ok(/személyre szabott ajándékkártya/.test(alt), alt);
    // a jelvény a fotó jobb felső sarkában (asztalon / tableten), telefonon és a tablet vízszintes kártyáján a fotó jobb felső sarkában
    assert.ok(lap.includes('.av-jelveny { position: absolute; top: 12px; right: 12px;'));
    assert.ok(lap.includes('.av-kartya:last-child:nth-child(odd) .av-jelveny { right: auto; left: calc(46% - 12px); transform: translateX(-100%); }'));
    assert.ok(lap.includes('.av-jelveny { top: 7px; right: auto; left: calc(36% - 7px); transform: translateX(-100%);'));
    // a mobilon levágott fotón is látszik a kártya (jobbra igazítva)
    assert.ok(lap.includes('align-self: stretch; object-position: 80% 50%; }'));
    for (const f of ['valaszto-headspa.jpg', 'valaszto-lezer.jpg', 'valaszto-oxigen.jpg']) assert.ok(fs.existsSync(path.join(GYOKER, 'assets', 'img', 'ajandek', f)), f);
  });

  test('a kártyák alcíme előtt sehol nincs kis csillag-ikon (a Head Spa, lézeres és oxigénes adatban sem)', () => {
    for (const f of ['ajandek-adat.js', 'ajandek-adat-lezer.js', 'ajandek-adat-oxigen.js']) {
      const adat = olvas('assets', 'js', f);
      assert.ok(!/osszefoglalo_ikon:\s*'sparkle'/.test(adat), f + ': az alcím előtt nincs sparkle');
    }
    assert.ok(/osszefoglalo_ikon: 'nincs'/.test(olvas('assets', 'js', 'ajandek-adat-lezer.js')), 'lézeres kártyák: ikon nélkül');
    assert.ok(/osszefoglalo_ikon: 'nincs'/.test(olvas('assets', 'js', 'ajandek-adat-oxigen.js')), 'oxigénes kártyák: ikon nélkül');
  });

  test('az oxigénes ajándékkártya hero-ja előtte-utána videó (a Meta-fiók "Oxigénhajterápia" videója), nem a kezelésről készült fotó', () => {
    const adat = olvas('assets', 'js', 'ajandek-adat-oxigen.js');
    const html = olvas('foglalas', 'oxigen-ajandekkartya.html');
    const poster = '/assets/img/ajandek/hero-oxigen-elotte-utana.jpg';
    const klip = '/assets/video/ajandek-hero-oxigen-elotte-utana.mp4';
    for (const f of [poster, klip]) assert.ok(fs.existsSync(path.join(GYOKER, f.slice(1))), f);
    assert.equal(db(adat, "hero_media: { src: '" + poster + "'"), 1);
    assert.equal(db(adat, "video: { src: '" + klip + "' }"), 1);
    assert.ok(adat.includes('video_id 1413460453443369'), 'a forrás a Meta-videó azonosítójával együtt dokumentált');
    assert.equal(db(html, 'src="' + poster + '"'), 1);
    assert.ok(!html.includes('hero-oxigen-ajandek.jpg" width'), 'a régi, kezelést mutató hero-kép nincs a hero-ban');
    // a videó nincs "hidden"-re téve (különben nem látszik és nem játszódik le), némított + ismétlődő
    const tag = /<video class="ah-hero-video" id="ah-hero-video"[^>]*>/.exec(html)[0];
    assert.ok(!/\shidden[\s>]/.test(tag) && /\bmuted\b/.test(tag) && /\bloop\b/.test(tag) && /\bplaysinline\b/.test(tag), tag);
    // a videó mérete mobilra is elfogadható (egy fájl, 720x720)
    assert.ok(fs.statSync(path.join(GYOKER, klip.slice(1))).size < 2 * 1024 * 1024);
  });

  test('az oxigénes oldalak a saját, "MOSAIC OXIGÉNTERÁPIA" feliratú személyre szabott kártyaképet használják (nem a HeadSpa-felirato vagy lézeres változatot)', () => {
    const kep = '/assets/img/ajandek/atadas-szemelyre-oxigen.jpg';
    assert.ok(fs.existsSync(path.join(GYOKER, kep.slice(1))), kep);
    for (const f of ['oxigen-ajandekkartya.html', 'oxigenterapia-budapest.html']) {
      const h = olvas('foglalas', f);
      assert.equal(db(h, kep), 1, f);
      assert.ok(!h.includes('/ajandek/atadas-szemelyre.jpg'), f + ': nincs HeadSpa-feliratú kép');
      assert.ok(!h.includes('/ajandek/atadas-szemelyre-lezer.jpg'), f + ': nincs lézeres kép');
    }
  });

  test('az oxigén landingen a "Személyre szabott ajándékkártya" sáv az árak után, a "Miért más nálunk" előtt áll, és a /oxigen-ajandekkartya oldalra visz (közvetlen link, nem hash)', () => {
    const h = olvas('foglalas', 'oxigenterapia-budapest.html');
    const arak = h.indexOf('<section class="arak"');
    const sav = h.indexOf('<section class="ajk" id="ajandek"');
    const miert = h.indexOf('<section class="miert"');
    assert.ok(arak > 0 && sav > arak && miert > sav, 'sorrend: árak -> ajándékkártya sáv -> miért más nálunk');
    const szekcio = h.slice(sav, h.indexOf('</section>', sav));
    assert.match(szekcio, /<h2 id="ajk-cim">Személyre szabott ajándékkártya!<\/h2>/);
    assert.match(szekcio, /<a class="gomb gomb-arany" href="\/oxigen-ajandekkartya">Ajándékkártyát választok <span class="nyil">/);
    assert.equal(db(szekcio, 'href="#'), 0, 'nincs hash-link (a GTM History Change ne induljon)');
    assert.doesNotMatch(szekcio, /target=|salonic/);
    const kep = /src="(\/assets\/img\/[^"]+)"/.exec(szekcio)[1];
    assert.ok(fs.existsSync(path.join(GYOKER, kep)), kep);
    // a hero gombjai (a bevezetesi hierarchia) valtozatlanok
    assert.match(h, /data-cta="hero-elso-kezeles"/);
    const css = olvas('assets', 'css', 'oxigen-landing.css');
    for (const sel of ['.ajk {', '.ajk-racs {', '.ajk-lista {']) assert.ok(css.includes(sel), sel);
    assert.match(css, /@media \(max-width: 700px\) \{ \.ajk \{/);
  });
});

describe('a build bekotese', () => {
  test('a sajat oldalak fejlecere es a Wixes oldalakra is rakerul az atalakitas', () => {
    // a build a tools/fejlec-menu.mjs-t hivja (az az Ajandekkartya lenyilot is elvegzi, lasd ajandekMenu), igy minden oldalra ugyanaz kerul
    assert.match(build, /import \{ fejlecAtalakit, ANGOL_JELOLO \} from '\.\/fejlec-menu\.mjs';/);
    assert.match(build, /let fejlec = fejlecAtalakit\(resz\('<!--mh-fejlec-->', FEJLEC\[m\]\), m === LAP_M, angol\)/);
    assert.match(build, /function fejlecSzoveg\(h, mobil\) \{[^]*?h = fejlecAtalakit\(h, mobil\);/);
    assert.match(olvas('tools', 'fejlec-menu.mjs'), /import \{ ajandekMenu \} from '\.\/ajandek-menu\.mjs';/);
  });

  test('a mobil menu tomoritese a kozos CSS-ben van (minden oldalra)', () => {
    const css = olvas('assets', 'css', 'fejlec-lablec.css');
    assert.match(css, /#MENU_AS_CONTAINER_EXPANDABLE_MENU \{ --item-height: 35px !important; margin-top: 56px !important; \}/);
  });

  test('a menu sajat gorgetosava a kepernyon belul marad (a fejlec zoomja miatt a klon.js adja a --mh-menu-max erteket)', () => {
    const css = olvas('assets', 'css', 'fejlec-lablec.css');
    assert.match(css, /#inlineContentParent-MENU_AS_CONTAINER \{ max-height: var\(--mh-menu-max, 100vh\) !important; \}/);
    const js = olvas('assets', 'js', 'klon.js');
    assert.match(js, /menu\.style\.setProperty\('--mh-menu-max', Math\.floor\(window\.innerHeight \/ nagyitas\) \+ 'px'\)/);
  });
});
