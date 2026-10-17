// Oldalankenti foglalasi cel (Google Ads indulas, brief 1. + 3. pont): a <!--mh-foglalas:business=...--> jelolo a fejlec FOGLALAS gombjat (asztali + mobil), az Info-ablak
// es a lablec "Idopontfoglalas" gombjat az adott uzletag foglalojara iranyitja; a regi /idpontfoglalas link az ilyen oldalon nem marad.
//   node --test tools/test-foglalas-cel.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fejlecAtalakit, foglalasCel, FOGLALAS_JELOLO, nyitvatartasHetkoznap, NYITVATARTAS_JELOLO } from './fejlec-menu.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const darab = (n) => fs.readFileSync(path.join(ROOT, 'assets/fejlec', n + '.html'), 'utf8');
// ugyanaz a lanc, mint a buildben (tools/netlify-build.mjs): fejlecAtalakit, majd foglalasCel
const epit = (jelolo) => {
  const ki = {};
  for (const [nev, fajl, mobil] of [['fa', 'asztali', false], ['fm', 'mobil', true], ['la', 'lablec-asztali', false], ['lm', 'lablec-mobil', true]]) {
    let h = fejlecAtalakit(darab(fajl), mobil, false);
    if (jelolo) h = foglalasCel(h, jelolo);
    ki[nev] = h;
  }
  return ki;
};
const hrefek = (h) => [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
const CEL = (q) => '/foglalo-motor?' + q.replace(/&/g, '&amp;');

test('jelolo nelkul semmi nem valtozik (a kozos darabok a regi celokra mutatnak)', () => {
  const alap = epit(null);
  assert.equal(foglalasCel(alap.fa, undefined), alap.fa);
  assert.ok(hrefek(alap.fa).includes('/idpontfoglalas'), 'a menugomb a kozos darabban a regi /idpontfoglalas');
  assert.ok(hrefek(alap.fm).includes('/idpontfoglalas'));
  assert.ok(hrefek(alap.fa).includes('/foglalo-motor?business=headspa'), 'az Info-ablak gombja alapbol business=headspa');
  assert.ok(hrefek(alap.la).includes('/foglalo-motor?business=headspa'), 'a lablec gombja alapbol business=headspa');
});

for (const jelolo of ['business=laser', 'business=laser&service=konzult', 'business=oxygen&service=466147', 'business=pmu', 'business=hair&staff=evelin&service=konzultacio', 'business=hair&staff=evelin&category=color']) {
  test('jelolo: ' + jelolo + ' -> fejlec (asztali + mobil), Info-ablak, lablec az adott foglalora mutat, /idpontfoglalas nincs', () => {
    const alap = epit(null), uj = epit(jelolo), cel = CEL(jelolo);
    for (const nev of ['fa', 'fm', 'la', 'lm']) {
      assert.ok(!hrefek(uj[nev]).includes('/idpontfoglalas'), nev + ': nincs regi /idpontfoglalas link');
      assert.ok(!/href="\/foglalo-motor\?business=headspa"/.test(uj[nev]), nev + ': nincs business=headspa foglalo-link');
    }
    assert.ok(hrefek(uj.fa).includes(cel), 'asztali menugomb');
    assert.ok(hrefek(uj.fm).includes(cel), 'mobil menugomb');
    assert.ok(/class="mhp-gomb mhp-arany" href="/.test(uj.fa) && uj.fa.includes('class="mhp-gomb mhp-arany" href="' + cel + '"'), 'az Info-ablak gombja');
    assert.ok(uj.la.includes('class="mhl-gomb" href="' + cel + '"'), 'asztali lablec gomb');
    assert.ok(uj.lm.includes('class="mhl-gomb" href="' + cel + '"'), 'mobil lablec gomb');
    // csak ezek a linkek cserelodtek: a tobbi href valtozatlan (menupontok, telefon, terkep ...)
    for (const nev of ['fa', 'fm', 'la', 'lm']) {
      const a = hrefek(alap[nev]), b = hrefek(uj[nev]);
      assert.equal(a.length, b.length, nev + ': ugyanannyi link');
      a.forEach((h, i) => { if (h !== '/idpontfoglalas' && h !== '/foglalo-motor?business=headspa') assert.equal(b[i], h, nev + ': ' + h); });
    }
    assert.ok(hrefek(uj.fa).includes('/arlista'), 'az Arlista menupont megmarad');
  });
}

test('a jelolo szigoruan ellenorzott: ismeretlen uzletag, idegen parameter, injektalas -> hiba (a build leall, rossz link nem kerul ki)', () => {
  const alap = epit(null);
  for (const rossz of ['business=headspaa', 'business=laser&foo=1', 'service=konzult', 'business=laser&service=a b', 'business=laser"><script>', 'business=laser&service=', 'https://pelda.hu/?business=laser', 'business=laser&service=a&service=b&service=c&service=d']) {
    assert.throws(() => foglalasCel(alap.fa, rossz), /mh-foglalas jelolo ervenytelen/, rossz);
  }
});

test('a jelolo felismerese az oldal forrasabol (a build ugyanezt a mintat hasznalja)', () => {
  const forras = '<!--mh-fejlec-->\n<!--mh-menu-aktiv:/x-->\n<!--mh-foglalas:business=laser&service=konzult-->\n<main></main>';
  assert.equal((forras.match(FOGLALAS_JELOLO) || [])[1], 'business=laser&service=konzult');
  assert.equal((('<main></main>').match(FOGLALAS_JELOLO) || [])[1], undefined);
});

test('ismetelhetetlen-biztos: ketszer alkalmazva ugyanaz', () => {
  const x = epit('business=oxygen&service=466147');
  assert.equal(foglalasCel(x.fa, 'business=oxygen&service=466147'), x.fa);
  assert.equal(foglalasCel(x.la, 'business=oxygen&service=466147'), x.la);
});

test('nyitvatartas-jelolo: a lablec es az Info-ablak csak a hetkoznapokat irja (szombat / vasarnap nincs), jelolo nelkul a kozos szoveg marad', () => {
  const alap = epit(null);
  assert.ok(/Hétfő – Szombat/.test(alap.la) && /Vasárnap/.test(alap.la), 'alapbol Hetfo - Szombat + Vasarnap');
  assert.ok(/Hétfő – Szombat/.test(alap.fa), 'az Info-ablakban is');
  assert.ok(NYITVATARTAS_JELOLO.test('<!--mh-nyitvatartas:hetkoznap-->') && !NYITVATARTAS_JELOLO.test('<main></main>'));
  for (const nev of ['fa', 'fm', 'la', 'lm']) {
    const uj = nyitvatartasHetkoznap(alap[nev]);
    assert.ok(!/Szombat|Vasárnap|ZÁRVA/.test(uj.replace(/Ajándékkártya/g, '')), nev + ': nincs szombat / vasarnap / zarva');
    assert.equal(nyitvatartasHetkoznap(uj), uj, nev + ': idempotens');
  }
  assert.ok(nyitvatartasHetkoznap(alap.la).includes('Hétfő – Péntek: 8:00 – 20:00'));
  assert.ok(nyitvatartasHetkoznap(alap.fa).includes('<b>Hétfő – Péntek:</b> 8:00 – 20:00'));
  assert.ok(!nyitvatartasHetkoznap(alap.fa).includes('mhp-sor-masodik'));
  // a masik atalakitassal egyutt is jo (a build ebben a sorrendben hivja)
  const egyutt = nyitvatartasHetkoznap(foglalasCel(alap.la, 'business=laser'));
  assert.ok(egyutt.includes('business=laser') && egyutt.includes('Hétfő – Péntek'));
});
