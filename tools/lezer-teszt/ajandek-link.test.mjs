// A lezeres landing ajandekkartya-linkjei (statikus, build / bongeszo nelkul):
//   node --test tools/lezer-teszt/ajandek-link.test.mjs
// A landing hero-jaban egy "Ajandekkartya" gomb (az "Ingyenes konzultacio" elott, az pedig csak szoveges link) visz a /lezeres-ajandekkartya oldalra (kozvetlen oldal-link, nem hash).
// A kulon ajandekkartya-szekcio (garancia utan, Zsofi elott) 2026-10-25-en kikerult az oldalrol (a tulajdonos kerese: senki nem vesz ajandekkartyat); a szekcio stilusa a stiluslapban marad (a ferfi oldal hasznalja).
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

test('a hero gombsorban a sorrend: idopontok gomb, Ajandekkartya gomb, utana az "Ingyenes konzultacio" mar csak szoveges link (nem gomb)', () => {
  const sor = h.slice(h.indexOf('<div class="cta-sor">'), h.indexOf('</div>', h.indexOf('<div class="cta-sor">')));
  const linkek = [...sor.matchAll(/<a\b[^>]*>[^<]*(?:<span[^>]*>[^<]*<\/span>)?[^<]*<\/a>/g)].map((m) => m[0]);
  assert.equal(linkek.length, 3, 'harom elem a hero gombsorban');
  assert.match(linkek[0], /class="gomb gomb-arany gomb-nagy" href="#foglalas"/);
  assert.match(linkek[1], new RegExp('class="gomb gomb-korvonal" href="' + CEL + '"'));
  assert.match(linkek[2], /^<a class="cta-link" href="https:\/\/mosaic-elysion\.salonic\.hu\/selectDate\/\?employeeId=32417&amp;placeId=14586&amp;serviceId=476477" target="_blank" rel="noopener">Ingyenes konzultáció <span class="nyil">/);
  assert.doesNotMatch(linkek[2], /class="[^"]*\bgomb\b/);
  assert.match(css, /\.cta-link \{[^}]*text-decoration: underline/);
  assert.match(css, /\.cta-sor \.cta-link \{ text-align: center; \}/, 'mobilon a szoveges link kozepre kerul');
});

test('az ajandekkartya-szekcio es a "Mar tudod" blokk nincs az oldalon (2026-10-25); a garancia utan kozvetlenul Zsofi jon', () => {
  assert.ok(!h.includes('<section class="ajk"'), 'az ajandekkartya-szekcio kikerult');
  assert.ok(!h.includes('id="ajk-cim"') && !h.includes('Személyre szabott ajándékkártya!'), 'nincs maradek');
  assert.ok(!h.includes('<section class="tudod"') && !h.includes('Már tudod, mit szeretnél?'), 'a "Mar tudod" blokk kikerult');
  const elonyok = h.indexOf('<section class="elonyok"');
  const vege = h.indexOf('</section>', elonyok) + '</section>'.length;
  const zsofi = h.indexOf('<section class="zsofi"');
  assert.ok(elonyok > 0 && zsofi > vege, 'Zsofi a garancia utan van');
  assert.equal((h.slice(vege, zsofi).match(/<section\b/g) || []).length, 0, 'a garancia es Zsofi kozott nincs szekcio');
});

test('a cel-oldal (/lezeres-ajandekkartya) letezik, noindex; a hero gomb oda mutat', () => {
  const cel = fs.readFileSync(path.join(GYOKER, 'foglalas', 'lezeres-ajandekkartya.html'), 'utf8');
  assert.match(cel, /<meta name="robots" content="noindex, follow">/);
  assert.ok(h.includes(`href="${CEL}"`), 'a hero gomb megvan');
});
