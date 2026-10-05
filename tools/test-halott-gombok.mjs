// Halott gombok (2026-10-05): olyan gomb, ami az oldalon semmit sem csinal. Ket forrasuk volt a Wix-bol atvett oldalakon:
//  1. data-popupid gomb, amihez nincs felugro sablon (a Wix-urlap nem kerult at): /30szazalek "KEREM A 30%-OS KUPONT!", /pmu-melitta "TELEFONOS KONZULTACIO!"
//  2. data-anchor gomb (Wix-horgony: "TOBB INFOT KEREK!", "AZ 5 OK, ROVIDEN", "JELENTKEZEM!"), amelynek a szekciojat a klon.js tablazata nem ismerte
// Futtatas: node --test tools/test-halott-gombok.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { popupAtkot, POPUP_CELOK } from './halott-popup.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const oldalak = [];
for (const mappa of ['klon', 'klon/m']) for (const f of fs.readdirSync(path.join(ROOT, mappa)).filter((x) => x.endsWith('.html'))) oldalak.push({ mappa, f, html: fs.readFileSync(path.join(ROOT, mappa, f), 'utf8') });
const klon = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'klon.js'), 'utf8');
const SABLONOS = new Set(['rk7x7']); // az "Info" felugro (tools/popup-info.mjs) a build-ben minden oldalra sablont kap

test('a sablon nelkuli felugro-gombok a foglalora mutatnak (nem marad halott gomb)', () => {
  let db = 0;
  for (const { mappa, f, html } of oldalak) {
    const r = popupAtkot(html, f);
    db += r.db;
    for (const m of r.html.matchAll(/data-popupid="([^"]+)"/g)) assert.ok(SABLONOS.has(m[1]) || r.html.includes('id="mh-popup-' + m[1] + '"'), `${mappa}/${f}: ${m[1]} felugro-gombhoz nincs sablon`);
  }
  assert.ok(db >= 8, `a /30szazalek (3 + 3 mobil) es a /pmu-melitta (1 + 1 mobil) gombjait atirta (${db})`);
  assert.deepEqual(Object.keys(POPUP_CELOK).sort(), ['30szazalek', 'pmu-melitta']);
});

test('popupAtkot: href kerul a gombra, a felugro-attributumok kikerulnek, mas oldal / mas gomb valtozatlan', () => {
  const g = '<a data-testid="linkElement" data-popupid="tn2x8" target="_self" role="button" class="x" aria-label="KEREM" aria-haspopup="dialog" tabindex="0">';
  const r = popupAtkot(g + 'KEREM</a>', '30szazalek.html');
  assert.equal(r.db, 1);
  assert.match(r.html, /^<a data-testid="linkElement" target="_self" class="x" aria-label="KEREM" tabindex="0" href="\/foglalo-motor\?business=hair">KEREM<\/a>$/);
  assert.equal(popupAtkot(g, 'headspa-budapest.html').html, g);
  const sablonos = g + '<template id="mh-popup-tn2x8"></template>';
  assert.equal(popupAtkot(sablonos, '30szazalek.html').html, sablonos, 'ahol van sablon, a gomb marad');
  const pmu = popupAtkot('<a data-popupid="s2q06" role="button" aria-haspopup="dialog">T</a>', 'pmu-melitta');
  assert.match(pmu.html, /href="\/foglalo-motor\?business=pmu"/);
});

// A klon.js horgony-szabalya (horgonySzekcio): a tablazat, ennek hianyaban a legnagyobb comp-azonositoju <section>, ami nem nagyobb az anchor azonositojanal.
const norm = (id) => String(id).replace(/^(anchors|comp)-/, '').padEnd(10, '0');
const tabla = {}; for (const m of klon.matchAll(/'(anchors-[^']+)':\s*'(comp-[^']+)'/g)) tabla[m[1]] = m[2];
const szekcioKeres = (azon, szekciok) => { if (tabla[azon]) return tabla[azon]; let jo = null; for (const s of szekciok) if (norm(s) <= norm(azon) && (!jo || norm(s) > norm(jo))) jo = s; return jo; };

test('a klon.js horgony-fallbackje benne van, es a szabaly a tablazat mind az ismert parjat visszaadja', () => {
  assert.match(klon, /const horgonyNorm = \(id\) => String\(id\)\.replace\(\/\^\(anchors\|comp\)-\/, ''\)\.padEnd\(10, '0'\);/);
  assert.match(klon, /const szekcio = horgonySzekcio\(a\.getAttribute\('data-anchor'\)\);/);
  let ellenorzott = 0;
  for (const { f, mappa, html } of oldalak) {
    const szekciok = [...html.matchAll(/<section\b[^>]*\bid="(comp-[^"]+)"/g)].map((m) => m[1]);
    for (const [azon, comp] of Object.entries(tabla)) if (html.includes('data-anchor="' + azon + '"') && szekciok.includes(comp)) {
      const szabaly = (() => { let jo = null; for (const s of szekciok) if (norm(s) <= norm(azon) && (!jo || norm(s) > norm(jo))) jo = s; return jo; })();
      assert.equal(szabaly, comp, `${mappa}/${f}: ${azon} -> a szabaly ${szabaly}, a Wix-adat ${comp}`);
      ellenorzott++;
    }
  }
  assert.ok(ellenorzott >= 19, `a szabaly legalabb 19 ismert horgonyra ellenorizve (${ellenorzott})`);
});

test('minden oldalon minden sajat-oldali Wix-horgony gombnak van cel-szekcioja (nincs semmit nem csinalo horgony)', () => {
  const rossz = [];
  for (const { mappa, f, html } of oldalak) {
    const nev = f.replace(/\.html$/, ''); const szekciok = [...html.matchAll(/<section\b[^>]*\bid="(comp-[^"]+)"/g)].map((m) => m[1]);
    for (const m of html.matchAll(/<a\b([^>]*\bdata-anchor="([^"]+)"[^>]*)>/g)) {
      const href = (m[1].match(/\bhref="([^"]*)"/) || [])[1] || '';
      if (decodeURIComponent(href.split('#')[0]).replace(/^\//, '') !== nev) continue; // masik oldalra vivo menupont: navigal
      if (/^dataItem-/.test(m[2])) continue; // a regi foglalo-oldal (idpontfoglalas) fulei: ures oldal + foglalo
      if (!szekcioKeres(m[2], szekciok)) rossz.push(`${mappa}/${f}: ${m[2]}`);
    }
  }
  assert.deepEqual(rossz, []);
});
