// /sminktetovalas-budapest (Google Ads indulas, 9.B terv 3. pont; Feri 2026-10-20): a GYIK-ban nincs "[...]" helyorzo (sem a /gyik oldalon), a fejlec FOGLALAS gombja (asztali + mobil),
// az Info-ablak es a lablec "Idopontfoglalas" gombja business=pmu (nem a regi /idpontfoglalas, nem business=headspa).
//   node --test tools/test-sminktetovalas-oldal.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fejlecAtalakit, foglalasCel, FOGLALAS_JELOLO } from './fejlec-menu.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const oldal = fs.readFileSync(path.join(ROOT, 'foglalas/sminktetovalas-budapest.html'), 'utf8');
const gyik = fs.readFileSync(path.join(ROOT, 'foglalas/gyik.html'), 'utf8');
const darab = (n) => fs.readFileSync(path.join(ROOT, 'assets/fejlec', n + '.html'), 'utf8');
const hrefek = (h) => [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

test('nincs szogletes zarojeles helyorzo (a GYIK-ban sem, a /gyik oldalon sem)', () => {
  for (const [nev, h] of [['oldal', oldal], ['gyik', gyik]]) {
    assert.ok(!/Melitta jóváhagyása után/.test(h), nev + ': a "Melitta jovahagyasa utan" helyorzo');
    assert.ok(!/class="helyorzo"|data-helyorzo/.test(h), nev + ': helyorzo-elem');
    assert.ok(!/>\s*\[[^\]<]{10,}\]\s*</.test(h.replace(/<script[\s\S]*?<\/script>/g, '')), nev + ': "[...]" szoveg');
  }
  assert.match(oldal, /A korábbi tetoválást, a gyógyszereket, az ellenjavallatokat és ajaktetoválásnál a herpeszhajlamot is előre átbeszéljük\./, 'a GYIK valasza megmaradt');
});

test('a jelolo business=pmu, es a fejlec / Info-ablak / lablec ezzel a foglalora mutat (nincs /idpontfoglalas, nincs business=headspa)', () => {
  const jelolo = (oldal.match(FOGLALAS_JELOLO) || [])[1];
  assert.equal(jelolo, 'business=pmu');
  for (const [fajl, mobil] of [['asztali', false], ['mobil', true], ['lablec-asztali', false], ['lablec-mobil', true]]) {
    const h = foglalasCel(fejlecAtalakit(darab(fajl), mobil, false), jelolo);
    assert.ok(!hrefek(h).includes('/idpontfoglalas'), fajl + ': nincs regi /idpontfoglalas');
    assert.ok(!hrefek(h).includes('/foglalo-motor?business=headspa'), fajl + ': nincs business=headspa');
    assert.ok(hrefek(h).includes('/foglalo-motor?business=pmu'), fajl + ': a foglalo-gomb business=pmu');
  }
});

// 2026-11-01 (Feri): a /sminktetovalas-budapest oldalon tobb helyen jelezzuk, hogy a regi sminktetovalas eltavolitasa is foglalhato - "plusz", nem ujdonsagkent
test('a sminktetoválás-eltávolítás több helyen szerepel (hero, "van már" kártya, árak, GYIK, foglalás), sima mondatokban, mérés (data-cta) és "ÚJ" jelzés nélkül', () => {
  const blokkok = [...oldal.matchAll(/<!--eltav-->\n([\s\S]*?)<!--\/eltav-->\n/g)].map((m) => m[1]);
  assert.equal(blokkok.length, 5, 'hero, helyzet-kartya, arak, GYIK, foglalas');
  for (const b of blokkok) {
    assert.match(b, /href="\/sminktetovalas-eltavolitas-budapest"/);
    assert.ok(!/data-cta=/.test(b), 'az uj linkeken nincs data-cta (nem keletkezik uj meresi esemeny)');
    assert.ok(!/\bÚJ\b|újdonság|újonnan|most már/i.test(b.replace(/<[^>]+>/g, ' ')), 'nem ujdonsagkent kezeljuk');
    assert.ok(!/garant|nyom nélkül|100\s?%|véglegesen/i.test(b.replace(/<[^>]+>/g, ' ')), 'nincs eredmenyigeret');
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'foglalas/sminktetovalas-eltavolitas-budapest.html')), 'a celoldal letezik');
  assert.match(blokkok.join('\n'), /20&nbsp;000&nbsp;Ft/);
});

test('a Google Ads szemöldök-céloldal (a fő oldal generált másolata) változatlan: nincs rajta eltávolítás-jelölés', () => {
  const masolat = fs.readFileSync(path.join(ROOT, 'foglalas/szemoldok-tetovalas-budapest.html'), 'utf8');
  assert.ok(!/<!--eltav-->|eltavolitas-budapest|eltavolit/i.test(masolat));
});

test('a "Van már sminktetoválásom" kártyáról a piros figyelmeztető sor lekerült (Feri, 2026-11-01: kisebb a három doboz); a fotós gomb marad; a Google Ads másolat és a szájtetoválás-oldal változatlan', () => {
  const kartya = oldal.slice(oldal.indexOf('<h3>Van már smink&shy;tetoválásom</h3>'), oldal.indexOf('data-cta="helyzet-regi"') + 120);
  assert.ok(kartya.length > 100 && /data-foglalo="lepes=foto"/.test(kartya), 'a "Fotót küldök" gomb megmaradt');
  assert.ok(!/ne foglalj időpontot azonnal|class="figyelmeztet"/.test(oldal), 'a fo oldalon nincs figyelmezteto sor');
  assert.match(oldal, /<p class="eltav-megjegyzes">/, 'a kartyan az eltavolitas-megjegyzes marad');
  const masolat = fs.readFileSync(path.join(ROOT, 'foglalas/szemoldok-tetovalas-budapest.html'), 'utf8');
  assert.match(masolat, /<p class="figyelmeztet">.*Ha régebbi sminktetoválásod van, kérlek, ne foglalj időpontot azonnal/, 'a Google Ads-oldal valtozatlan (a generator visszateszi)');
  const szaj = fs.readFileSync(path.join(ROOT, 'foglalas/szajtetovalas-budapest.html'), 'utf8');
  assert.match(szaj, /ne foglalj időpontot azonnal/, 'a szajtetovalas-oldalhoz nem nyultunk');
});
