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
