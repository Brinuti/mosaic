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

describe('a build bekotese', () => {
  test('a sajat oldalak fejlecere es a Wixes oldalakra is rakerul az atalakitas', () => {
    assert.match(build, /import \{ ajandekMenu \} from '\.\/ajandek-menu\.mjs';/);
    assert.match(build, /let fejlec = ajandekMenu\(resz\('<!--mh-fejlec-->', FEJLEC\[m\]\), m === LAP_M\)/);
    assert.match(build, /function fejlecSzoveg\(h, mobil\) \{[^]*?h = ajandekMenu\(h, mobil\);/);
  });

  test('a mobil menu tomoritese a kozos CSS-ben van (minden oldalra)', () => {
    const css = olvas('assets', 'css', 'fejlec-lablec.css');
    assert.match(css, /#MENU_AS_CONTAINER_EXPANDABLE_MENU \{ --item-height: 40px !important; margin-top: 58px !important; \}/);
  });

  test('a menu sajat gorgetosava a kepernyon belul marad (a fejlec zoomja miatt a klon.js adja a --mh-menu-max erteket)', () => {
    const css = olvas('assets', 'css', 'fejlec-lablec.css');
    assert.match(css, /#inlineContentParent-MENU_AS_CONTAINER \{ max-height: var\(--mh-menu-max, 100vh\) !important; \}/);
    const js = olvas('assets', 'js', 'klon.js');
    assert.match(js, /menu\.style\.setProperty\('--mh-menu-max', Math\.floor\(window\.innerHeight \/ nagyitas\) \+ 'px'\)/);
  });
});
