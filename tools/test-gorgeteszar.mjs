// A "fehér képernyő" hiba osztalya (2026-10-05): az oldal gorgetes-zara NEM tolhatja el az oldalt (body position:fixed + top:-scrollY).
// Hosszu oldalon (20 000+ px) ez egy hatalmas, felfele eltolt rogzitett elem, amit a telefonok (iOS Safari, Chrome Android) mar nem rajzolnak ki:
// a foglalo reteg letrejon, de FEHER kepernyo marad. Gepen (headless) nem jon elo, csak valodi telefonon -> ezert tiltjuk a mintat a forrasban.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const JS = path.resolve(import.meta.dirname, '..', 'assets', 'js');
const fajlok = [];
(function bejar(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) bejar(p); else if (/\.js$/.test(f.name)) fajlok.push(p); } })(JS);

test('a gorgetes-zar sehol nem rogziti (fixed) es tolja el a body-t', () => {
  const tiltott = [/body(El)?\.style\.position\s*=\s*['"]fixed['"]/, /document\.body\.style\.position\s*=\s*['"]fixed['"]/, /body(El)?\.style\.top\s*=\s*['"]-['"]\s*\+/, /style\.top\s*=\s*['"]-['"]\s*\+\s*scroll/];
  for (const f of fajlok) {
    const t = fs.readFileSync(f, 'utf8');
    for (const re of tiltott) assert.ok(!re.test(t), `${path.relative(JS, f)}: tiltott gorgetes-zar minta (${re}) - lasd docs/booking-engine/KIADAS_ELLENORZO.md`);
  }
});

test('a foglalo reteg csak a gorgetest zarja (overflow), az oldal poziciojat nem mozgatja', () => {
  const t = fs.readFileSync(path.join(JS, 'booking-engine', 'layer.js'), 'utf8');
  assert.match(t, /lockEl\.style\.overflow = 'hidden'/);
  assert.match(t, /getComputedStyle\(html\)\.overflowY === 'visible' \? bodyEl : html/); // ahol a body a viewport-gorgeto, a body-t zarjuk (a html overflow:hidden-je Chrome-ban az oldal tetejere ugratna)
  assert.doesNotMatch(t, /html\.style\.overflow = 'hidden'/);
});

test('a Wix-klon popup-ja ugyanezt a zarat hasznalja (nem ugrik az oldal tetejere)', () => {
  const t = fs.readFileSync(path.join(JS, 'klon.js'), 'utf8');
  assert.match(t, /popupZarElem = getComputedStyle\(document\.documentElement\)\.overflowY === 'visible' \? document\.body : document\.documentElement/);
  assert.doesNotMatch(t, /document\.documentElement\.style\.overflow = 'hidden'/);
});
