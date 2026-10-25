// A lezeres szortelenites landing tartalmi valtozasai (2026-10-25, a tulajdonos kerese), statikus (build / bongeszo nelkul):
//   node --test tools/lezer-teszt/tartalom.test.mjs
// - a hero kepen Zsofi arca latszik, mosolyog (a regi kep: kezeles kozben, lehajtott fej, kezirasos felirattal); az LCP-elofeltoltes (head preload + tools/lcp-elofeltoltes.json) ugyanezt a kepet toltene
// - a "8 alkalom, csak 6-ot fizetsz." szekcio szovege (nem "kezelesi program"), a "nem kell nagy osszeget elore kifizetned" mondat
// - a "Mar tudod, mit szeretnel?" es az ajandekkartya blokk nincs az oldalon; Zsofi a garancia utan kozvetlenul jon
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const h = fs.readFileSync(path.join(GYOKER, 'foglalas', 'lezeres-szortelenites-budapest.html'), 'utf8');
const lcp = fs.readFileSync(path.join(GYOKER, 'tools', 'lcp-elofeltoltes.json'), 'utf8');
const HERO_KEP = '/assets/img/c2eb0f_b93a709a951c401b9e44d4083dc5172d.jpg';
const szoveg = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('a hero kepe Zsofi mosolygo, arcos kepe; a head preload es az LCP-elofeltoltes ugyanezt a kepet adja', () => {
  const hero = h.slice(h.indexOf('<figure class="hero-kep">'), h.indexOf('</figure>', h.indexOf('<figure class="hero-kep">')));
  assert.ok(hero.includes(`src="${HERO_KEP}"`), 'hero-kep: ' + hero.slice(0, 200));
  assert.match(hero, /alt="Zsófi mosolyogva/);
  assert.match(hero, /fetchpriority="high"/);
  assert.ok(fs.existsSync(path.join(GYOKER, HERO_KEP)), 'a kep letezik');
  assert.ok(h.includes(`<link rel="preload" href="${HERO_KEP}" as="image" fetchpriority="high">`), 'head preload');
  assert.ok(!h.includes('c2eb0f_095b37f37006437d8942bb760bc4740b.jpg" as="image"'), 'a regi hero-kep nincs elofeltoltve');
  const kulcs = 'lezeres-szortelenites-budapest';
  const talalat = lcp.split(`"${kulcs}": "${HERO_KEP}"`).length - 1;
  const osszes = lcp.split(`"${kulcs}":`).length - 1;
  assert.ok(osszes >= 1 && talalat === osszes, `lcp-elofeltoltes.json: ${talalat}/${osszes} bejegyzes mutat az uj kepre`);
});

test('a fo cim es az ajanlat valtozatlan: Lezeres szortelenites 12 honap garanciaval, 8 alkalomból csak 6-ot fizetsz', () => {
  assert.match(h, /<h1>Lézeres szőrtelenítés 12 hónap garanciával<\/h1>/);
  assert.match(h, /<p class="hero-ajanlat">8 alkalomból csak 6-ot fizetsz\.<\/p>/);
});

test('a 8 alkalmas szekcio: "8 alkalom, csak 6-ot fizetsz."; a szoveg a 2 alkalom utani szortelenseget, a tartossagot, az ajandek 2 alkalmat; nincs "kezelesi program", nincs "elore nem kell semmit"', () => {
  const a = h.indexOf('<section class="program"');
  const sz = szoveg(h.slice(a, h.indexOf('</section>', a)));
  assert.match(h, /<h2 id="program-cim">8 alkalom, csak 6-ot fizetsz\.<\/h2>/);
  assert.ok(!h.includes('8 kezelés, csak 6-ot fizetsz'), 'a regi cim nincs meg');
  assert.match(sz, /Már 2 alkalom után szőrtelen leszel, a maradék 6 alkalom csak a tartósság miatt kell – de 2 alkalmat ajándékba kapsz tőlünk\. Ez több százezer forintos spórolást jelent\./);
  assert.match(sz, /Bérlet helyett alkalmanként fizetsz, nem kell nagy összeget előre kifizetned\./);
  assert.ok(!/kezelési program/.test(sz), 'nincs "kezelesi program"');
  assert.ok(!/előre nem kell semmit/.test(sz), 'nem igerjuk, hogy elore semmit sem kell fizetni');
  assert.equal((sz.match(/Ajándék/g) || []).length, 2, 'a 4. es a 8. alkalom tovabbra is ajandek-jelolesu');
});

test('a "Mar tudod, mit szeretnel?" blokk es az ajandekkartya blokk nincs az oldalon; a szekciosorrend: hero, mennyibe, eredmenyek, 8 alkalom, garancia, Zsofi', () => {
  assert.ok(!h.includes('Már tudod, mit szeretnél?') && !h.includes('<section class="tudod"'), 'nincs "Mar tudod"');
  assert.ok(!h.includes('<section class="ajk"') && !h.includes('Személyre szabott ajándékkártya!'), 'nincs ajandekkartya-blokk');
  const sorrend = [...h.matchAll(/<section class="([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sorrend.slice(0, 7), ['hero', 'gyors-arak', 'eredmenyek', 'program', 'elonyok', 'zsofi', 'orvosi']);
});

test('a "Neked is jo valasztas a lezeres szortelenites?" blokk (cim + harom kartya) nincs az oldalon; az orvosi ajanlas (szorbenoves-video) onallo szekcioban marad', () => {
  assert.ok(!h.includes('Neked is jó választás') && !h.includes('id="alkalmas-cim"') && !h.includes('<section class="alkalmas"'), 'a blokk kikerult');
  for (const maradek of ['alkalmas-kartya', 'Valószínűleg igen', 'Nézzük meg együtt', 'Inkább kérdezz rá előtte', 'data-gyik="kinek-nem"']) assert.ok(!h.includes(maradek), 'maradek: ' + maradek);
  const a = h.indexOf('<section class="orvosi"');
  assert.ok(a > h.indexOf('<section class="zsofi"') && a < h.indexOf('<section class="velemenyek"'), 'a Zsofi es a velemenyek kozott all');
  const sz = h.slice(a, h.indexOf('</section>', a));
  assert.match(sz, /aria-label="Orvosi ajánlás/);
  assert.match(sz, /id="szorbenoves-video"/);
  assert.match(sz, /Szőrbenövés és begyulladt szőrtüszők/);
  assert.ok(h.includes('id="gyik-kinek-nem"'), 'a "Kinek nem javasolt a kezeles?" valasz tovabbra is a GYIK-ban van');
});

test('minden foglalas-gomb a foglalo-reteget nyitja (/foglalo-motor), egyik sem gorget a #foglalas szekciohoz (a tulajdonos kerese, 2026-10-25)', () => {
  assert.equal((h.match(/href="#foglalas"/g) || []).length, 0, 'nincs #foglalas-ra mutato gomb / link');
  const cta = [...h.matchAll(/<a [^>]*href="(\/foglalo-motor\?[^"]+)"[^>]*>([^<]*)/g)].map((m) => [m[1], m[2].trim()]);
  const elsoIdopont = cta.filter(([u]) => u === '/foglalo-motor?business=laser&amp;intent=first').map(([, t]) => t);
  assert.deepEqual(elsoIdopont, ['Szabad kezelési időpontok', 'Időpontot választok', 'Időpontot választok', 'Szabad kezelési időpontok', 'Szabad időpontok'], 'hero, Zsofi, orvosi, helyszin, mobil sticky sav');
  assert.equal(cta.filter(([u]) => /service=\d+/.test(u)).length, 4, 'a negy teruletkartya');
  assert.ok(!/<a [^>]*href="\/foglalo-motor[^"]*"[^>]*target=/.test(h), 'a foglalo-reteg linkjei nem nyitnak uj lapot (a launcher a retegben nyitja)');
});
