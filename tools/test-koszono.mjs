// A koszono kepernyok szovegei (koszono.js) es az "Ott leszek" levele (levelek.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { koszonoLepesek, VISSZAHIVAS_LEPESEK, LEZER_KEZELO } from '../assets/js/booking-engine/koszono.js';
import { levelek, URLAPOK } from '../netlify/lib/levelek.js';

test('koszono: minden uzletag 3 pontos "Mi tortenik most?" listat kap', () => {
  for (const b of ['headspa', 'hair', 'oxygen', 'laser', 'ismeretlen']) assert.equal(koszonoLepesek(b, 'first_treatment').length, 3, b);
  assert.equal(VISSZAHIVAS_LEPESEK.length, 3);
});

test('koszono: a lezer kezelesenel a kezeles elotti tudnivalok, a konzultacional nem (nincs borotvalas)', () => {
  const kezeles = koszonoLepesek('laser', 'first_treatment').join(' ');
  assert.match(kezeles, /borotváld le/); assert.match(kezeles, /napozást/);
  const konzi = koszonoLepesek('laser', 'consultation').join(' ');
  assert.doesNotMatch(konzi, /borotváld/);
});

test('koszono: oxigen: hajmosas / hajfestes tudnivalo; headspa es fodraszat: erkezes + nem tudunk csuszni', () => {
  assert.match(koszonoLepesek('oxygen', 'first_treatment').join(' '), /48 órával ne moss hajat/);
  for (const b of ['headspa', 'hair']) { const s = koszonoLepesek(b, 'first_treatment').join(' '); assert.match(s, /15–20 perccel/); assert.match(s, /nem tudunk csúszni/); }
});

test('koszono: a lezer kezeloje Zsofi (foto nincs: monogram)', () => {
  assert.equal(LEZER_KEZELO.name, 'Zsófi'); assert.equal(LEZER_KEZELO.foto, null);
});

test('levelek: az "Ott leszek" (motor-megerosites) levele a szalonnak megy, az idoponttal', () => {
  assert.ok(URLAPOK['motor-megerosites']);
  const l = levelek('motor-megerosites', { idopont: 'Kedd, okt. 6. · 10:00', szolgaltatas: 'Női hajvágás', uzletag: 'hair', szakember: 'Betti', oldal: '/fodraszat' });
  assert.equal(l.length, 1); assert.equal(l[0].cimzett, 'szalon');
  assert.match(l[0].html, /Kedd, okt\. 6\. · 10:00/); assert.match(l[0].html, /Női hajvágás/); assert.match(l[0].html, /Betti/);
});
