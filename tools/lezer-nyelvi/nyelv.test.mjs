// A vegleges szortelenites landing angol / ukran valtozatanak statikus tesztjei (build / bongeszo nelkul):
//   node --test tools/lezer-nyelvi/nyelv.test.mjs
// - a generalt oldalak naprakeszek (a magyar forras es a fordito-tabla szerint), nincs forditatlan szoveg
// - noindex, onmagara mutato canonical, helyes lang; az angolon a kozos angol fejlec-jelolo
// - az uj oldalak a sajat szoveg-fajljukat toltik a lezer-landing.js ELOTT; nincs magyar-specifikus betu (o / u dupla ekezet) a szovegben
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const olvas = (...p) => fs.readFileSync(path.join(GYOKER, ...p), 'utf8');
const OLDALAK = { en: 'permanent-hair-removal-budapest', uk: 'ostatochne-vydalennya-volossya-budapesht' };

test('a generalt oldalak naprakeszek, es nincs forditatlan szoveg (node tools/lezer-nyelvi/gen.mjs --ellenoriz)', () => {
  const r = spawnSync(process.execPath, [path.join(GYOKER, 'tools', 'lezer-nyelvi', 'gen.mjs'), '--ellenoriz'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
});

for (const [kod, fajl] of Object.entries(OLDALAK)) {
  test(`${kod}: noindex, onmagara mutato canonical, lang="${kod}", sajat szoveg-fajl a lezer-landing.js elott`, () => {
    const h = olvas('foglalas', fajl + '.html');
    assert.match(h, new RegExp(`<html lang="${kod}">`));
    assert.match(h, /<meta name="robots" content="noindex, nofollow">/);
    assert.ok(h.includes(`<link rel="canonical" href="https://www.mosaicheadspa.hu/${fajl}">`));
    assert.ok(h.includes(`<meta property="og:url" content="https://www.mosaicheadspa.hu/${fajl}">`));
    const i = h.indexOf(`/assets/js/lezer-szoveg-${kod}.js`), j = h.indexOf('/assets/js/lezer-landing.js');
    assert.ok(i > 0 && j > i, 'a szoveg-fajl a lezer-landing.js elott toltodik');
    assert.ok(fs.existsSync(path.join(GYOKER, 'assets', 'js', `lezer-szoveg-${kod}.js`)));
  });

  test(`${kod}: a latszo szovegben nincs magyar-specifikus betu (ő / ű), es az arak nem "Ft"-ban vannak`, () => {
    const h = olvas('foglalas', fajl + '.html');
    const latszik = h.slice(h.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<!--[\s\S]*?-->/g, '');
    assert.ok(!/[őűŐŰ]/.test(latszik), 'maradt magyar szoveg');
    assert.ok(!/\d(?:&nbsp;| )Ft\b/.test(latszik), 'maradt Ft-os ar');
    assert.match(latszik, /\d(?:&nbsp;)HUF/);
  });
}

for (const [kod, fajl] of Object.entries(OLDALAK)) {
  test(`${kod}: zart landing: nincs menus fejlec / kozos lablec, minimalis lablec suti-beallitassal; csak foglalo / terkep / telefon / e-mail / horgony link`, () => {
    const h = olvas('foglalas', fajl + '.html');
    for (const j of ['<!--mh-fejlec-->', '<!--mh-lablec-->', '<!--mh-nyelv:en-->', 'SITE_HEADER']) assert.ok(!h.includes(j), 'nem maradhat: ' + j);
    assert.match(h, /<header class="zart-fej"><img [^>]*><\/header>/);
    assert.ok(!/<header class="zart-fej"><a /.test(h), 'a logo nem link');
    assert.match(h, /<footer class="zart-lab">[\s\S]*id="mh-cc-lablec"[\s\S]*<\/footer>/);
    assert.ok(h.includes('/assets/css/lezer-zart.css'));
    const torzs = h.slice(h.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>|<!--[\s\S]*?-->/g, '');
    const hrefek = [...torzs.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
    assert.ok(hrefek.length > 10);
    for (const l of hrefek) {
      assert.ok(/^(#|tel:|mailto:|\/foglalo-motor\?|https:\/\/www\.google\.com\/maps\/)/.test(l), 'nem engedett (elnavigalo) link: ' + l);
    }
  });
}

test('az ukran oldalon van cirill szoveg, az angolon nincs', () => {
  assert.match(olvas('foglalas', OLDALAK.uk + '.html'), /[а-яіїєґ]{4}/i);
  assert.ok(!/[а-яіїєґ]/i.test(olvas('foglalas', OLDALAK.en + '.html').replace(/<!--[\s\S]*?-->/g, '')));
});

test('a magyar oldal alapertelmezett szovegei valtozatlanok (lezer-landing.js szotar) es a kulcsok mindharom nyelven megvannak', () => {
  const js = olvas('assets', 'js', 'lezer-landing.js');
  const kulcsok = [...js.slice(js.indexOf('const SZ = Object.assign({'), js.indexOf('}, window.LEZER_SZOVEG')).matchAll(/(?:^|,)\s*([a-zA-Z0-9]+):\s*['\[]/gm)].map((m) => m[1]);
  assert.ok(kulcsok.length >= 38, "a szotar kulcsai: " + kulcsok.length);
  for (const kod of Object.keys(OLDALAK)) {
    const sz = olvas('assets', 'js', `lezer-szoveg-${kod}.js`);
    for (const k of kulcsok) assert.ok(new RegExp(`\\b${k}:`).test(sz), `${kod}: hianyzo kulcs a lezer-szoveg-${kod}.js-ben: ${k}`);
  }
});
