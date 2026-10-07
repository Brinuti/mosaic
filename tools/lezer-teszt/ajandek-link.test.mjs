// A lezeres landing ajandekkartya-linkjei (statikus, build / bongeszo nelkul):
//   node --test tools/lezer-teszt/ajandek-link.test.mjs
// A landing hero-jaban egy "Ajandekkartya" gomb, a garancia utan egy kulon szekcio visz a /lezeres-ajandekkartya oldalra (kozvetlen oldal-link, nem hash).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const h = fs.readFileSync(path.join(GYOKER, 'foglalas', 'lezeres-szortelenites-budapest.html'), 'utf8');
const css = fs.readFileSync(path.join(GYOKER, 'assets', 'css', 'lezer-landing.css'), 'utf8');
const CEL = '/lezeres-ajandekkartya';

test('a hero gombsorban van "Ajandekkartya" gomb: kozvetlen oldal-link (nem hash, nem Salonic, ugyanabban az ablakban)', () => {
  const sor = h.slice(h.indexOf('<div class="cta-sor">'), h.indexOf('</div>', h.indexOf('<div class="cta-sor">')));
  const link = [...sor.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).find((a) => a.includes(`href="${CEL}"`));
  assert.ok(link, 'nincs gomb a hero gombsorban');
  assert.match(link, /class="gomb /);
  assert.doesNotMatch(link, /target=|salonic|href="#/);
  assert.match(sor, />Ajándékkártya <span class="nyil">/);
});

test('az ajandekkartya-szekcio a garancia utan, Zsofi elott all, a CTA ugyanoda visz; a kep letezik', () => {
  const elonyok = h.indexOf('<section class="elonyok"');
  const ajk = h.indexOf('<section class="ajk" id="ajandek"');
  const zsofi = h.indexOf('<section class="zsofi"');
  assert.ok(elonyok > 0 && ajk > elonyok && zsofi > ajk, 'a szekcio sorrendje: garancia -> ajandekkartya -> Zsofi');
  const szekcio = h.slice(ajk, h.indexOf('</section>', ajk));
  assert.match(szekcio, /<h2 id="ajk-cim">Személyre szabott ajándékkártya!<\/h2>/);
  assert.match(szekcio, new RegExp(`<a class="gomb gomb-arany gomb-nagy" href="${CEL}">`));
  assert.equal((szekcio.match(/href="#/g) || []).length, 0, 'nincs hash-link (a GTM History Change ne induljon)');
  const kep = /src="(\/assets\/img\/[^"]+)"/.exec(szekcio)[1];
  assert.ok(fs.existsSync(path.join(GYOKER, kep)), kep);
});

test('a cel-oldal letezik, noindex; a szekcio stilusa a stiluslapban van, mobilra is', () => {
  const cel = fs.readFileSync(path.join(GYOKER, 'foglalas', 'lezeres-ajandekkartya.html'), 'utf8');
  assert.match(cel, /<meta name="robots" content="noindex, follow">/);
  for (const sel of ['.ajk {', '.ajk-racs {', '.ajk-lista {']) assert.ok(css.includes(sel), sel);
  assert.match(css, /@media \(max-width: 700px\) \{ \.ajk \{/);
});
