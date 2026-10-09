// A harom korabbi hirdetesi ajandekkartya-oldal (headspa-ajandakkartya-fiataloknak, headspa-ajándékkártya-ezo, headspa-self-care) ATALLASA az uj formatumra
// (2026-10-09, a tulajdonos kerese): ezeken a cimeken mostantol az uj master landing (foglalas/ajandek.html + assets/js/ajandek-adat.js persona-variansai) fut -
// a hero-video, a persona-szovegek, a magyarazo-szekcio es az ajandekvalaszto -, a regi (Wixes) oldal a rejtett "-regi" cimen marad meg.
// A bongeszos tesztek (mind a 8 persona-cim: hero, magyarazo, elrendezes, meres, tulcsordulas): tools/ajandek-teszt/persona-oldalak.test.mjs.
// Itt a kapcsolodo szerkezeti szabalyok (nincs a regi oldal az elo utvonalon, a rejtett peldany, noindex / sitemap / meres / LCP) allnak - dist es bongeszo nelkul.
//
//   node --test tools/ujrastilus-teszt/ajandek-variansok.test.mjs
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const olvas = (rel) => fs.readFileSync(path.join(GYOKER, rel), 'utf8');
const letezik = (rel) => fs.existsSync(path.join(GYOKER, rel));
await import('../../assets/js/ajandek-adat.js');
const A = globalThis.AJANDEK_ADAT;

const OLDALAK = [
  { nev: 'headspa-ajandakkartya-fiataloknak', variant: 'young' },
  { nev: 'headspa-ajándékkártya-ezo', variant: 'esoteric' },
  { nev: 'headspa-self-care', variant: 'self_care' },
].map((o) => ({ ...o, nev: o.nev.normalize('NFC') }));

describe('a harom korabbi hirdetesi oldal -> uj formatum', () => {
  for (const { nev, variant } of OLDALAK) {
    describe('/' + nev, () => {
      test('a regi (ujrastilusozott) oldal nincs az elo utvonalon: a foglalas/ mappaban nincs fajlja, az archivum (tools/ajandek-variansok/archiv) megvan', () => {
        assert.equal(letezik(`foglalas/${nev}.html`), false, 'a foglalas/ mappa fajljai elo cimek: ez nem maradhat');
        assert.equal(letezik(`tools/ajandek-variansok/archiv/${nev}.html`), true);
        // az archivum a regi (Stripe nelkuli, klon.js-es urlapos) oldal: a motor szkriptjei nincsenek benne
        const regi = olvas(`tools/ajandek-variansok/archiv/${nev}.html`);
        assert.ok(!regi.includes('/assets/js/ajandek.js'), 'az archivum a regi folyamat');
      });

      test('a cim az uj master landing varianssal: OLDAL_ALAPERTEK -> ' + variant + '; a variansnak sajat hero-videoja, magyarazoja van', () => {
        assert.equal(A.oldalAlapertek('/' + nev).variant, variant);
        const v = A.VARIANTOK[variant];
        assert.ok(v.hero_media.video.src && v.magyarazo && v.magyarazo.cim, 'video + magyarazo');
      });

      test('a rejtett regi peldany megmarad: klon/<nev>.html a Wixes eredeti, klon/<nev>-regi.html a noindex-es masolata (asztali + mobil), -regi canonical-lal', () => {
        for (const mappa of ['klon', 'klon/m']) {
          assert.equal(letezik(`${mappa}/${nev}.html`), true, mappa + ': a Wixes eredeti');
          const regi = olvas(`${mappa}/${nev}-regi.html`);
          assert.match(regi, /<meta name="robots" content="noindex/, mappa + ': a rejtett peldany noindex');
          assert.ok(regi.includes('mosaicheadspa.hu/' + encodeURI(nev) + '-regi') || regi.includes('mosaicheadspa.hu/' + nev + '-regi'), mappa + ': canonical -regi');
          assert.ok(!regi.includes('/assets/js/ajandek.js'), mappa + ': a Wixes tartalom, nem az uj motor');
        }
      });

      test('a Meta-pixel / meres ugyanugy fut, mint eddig: a cim rajta van a suti.js pixel-listajan; a rejtett -regi peldany nincs; mero-kod csak az eles domainen', () => {
        const suti = olvas('assets/js/suti.js').normalize('NFC');
        const lista = /\[PIXEL_HEADSPA, '([^']*)'\]/.exec(suti);
        assert.ok(lista, 'a PIXEL_HEADSPA lista megvan');
        const nevek = lista[1].split(' ');
        assert.ok(nevek.includes(nev), nev + ' pixelt kap (mint a regi oldalon)');
        assert.ok(!nevek.includes(nev + '-regi'), 'a rejtett peldany pixel nelkul');
        assert.ok(suti.includes("var ELES_DOMAINEK = ['mosaicheadspa.hu', 'www.mosaicheadspa.hu'];"), 'a merokodok csak az eles domainen futnak');
        // a master landing a suti.js-t betolti (a dataLayer-esemenyek ugyanazok, mint a tobbi variansnal)
        assert.ok(olvas('foglalas/ajandek.html').includes('<script src="/assets/js/suti.js"></script>'));
      });

      test('noindex marad (mint a regi oldal), canonical onmaga; nincs a sitemapben (a Wix sitemap nem tartalmazza)', () => {
        const build = olvas('tools/netlify-build.mjs');
        const i = build.indexOf('const NOINDEX_AJANDEK_CIMEK');
        const lista = [...build.slice(i, build.indexOf("normalize('NFC')", i)).matchAll(/'([\p{L}0-9-]+)'/gu)].map((m) => m[1].normalize('NFC'));
        assert.ok(lista.includes(nev), 'a build noindex-szel adja');
        const j = build.indexOf('const REGI_AJANDEK_CIMEK');
        const cimek = [...build.slice(j, build.indexOf("normalize('NFC')", j)).matchAll(/'([\p{L}0-9-]+)'/gu)].map((m) => m[1].normalize('NFC'));
        assert.ok(cimek.includes(nev), 'a build az uj oldalt irja a cimre (es a -regi masolatot a klon-bol)');
        const sitemap = fs.readdirSync(path.join(GYOKER, 'tools/wix-sitemap')).filter((f) => f.endsWith('.xml')).map((f) => olvas('tools/wix-sitemap/' + f)).join('\n');
        assert.ok(!sitemap.includes(nev) && !sitemap.includes(encodeURI(nev)), 'a sitemapben nincs');
      });

      test('LCP: a build a varians sajat hero-kepet tolti elore; a helyi teszt-szerver is ismeri a cimet', () => {
        const lcp = JSON.parse(olvas('tools/lcp-elofeltoltes.json'));
        for (const sz of ['asztali', 'mobil']) assert.equal(lcp[sz][nev], A.VARIANTOK[variant].hero_media.src, sz);
        assert.ok(olvas('tools/ajandek-teszt/szerver.mjs').normalize('NFC').includes("'/" + nev + "'"));
      });
    });
  }

  test('az archivum generatora (gen.mjs) az archivumba ir, nem az elo foglalas/ mappaba; a README es a doksi leirja az atallast', () => {
    const gen = olvas('tools/ajandek-variansok/gen.mjs');
    assert.ok(gen.includes("path.join(import.meta.dirname, 'archiv', o.nev + '.html')"), 'kimenet: archiv/');
    assert.ok(!gen.includes("path.join(GYOKER, 'foglalas', o.nev"), 'nem a foglalas/ mappa');
    const readme = olvas('tools/ajandek-variansok/README.md');
    assert.match(readme, /archiv/);
    assert.ok(letezik('docs/AJANDEK_PERSONA_OLDALAK.md'), 'a doksi megvan');
  });

  test('a rejtett peldany eszkoze (tools/ujrastilus/regi-peldany.mjs) valtozatlan: a -regi masolat visszaallitasra / osszehasonlitasra tovabbra is keszitheto', () => {
    const e = olvas('tools/ujrastilus/regi-peldany.mjs');
    assert.match(e, /klon\/<nev>-regi\.html/);
    assert.ok(e.includes('noindex, nofollow'));
  });
});
