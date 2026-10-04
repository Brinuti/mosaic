// Az "Elo foglaltsag" sav logikaja (elo-foglaltsag.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { ablakIdopontok, frissites, eloAllapot, ELO_NAP, KEVES } from '../assets/js/booking-engine/elo-foglaltsag.js';

const NOW = 1_800_000_000; const NAP = 86400;
const slot = (t, staff = '1') => ({ start_unix: t, staff_id: staff });

test('ablak: csak a kovetkezo 7 nap, kulonbozo kezdesi idopontok, novekvo sorrendben', () => {
  const slots = [slot(NOW + 3 * NAP), slot(NOW + 3 * NAP, '2'), slot(NOW + NAP), slot(NOW + 7 * NAP), slot(NOW + 7 * NAP + 1), slot(NOW - 10), slot(NOW + 20 * NAP)];
  assert.deepEqual(ablakIdopontok(slots, NOW), [NOW + NAP, NOW + 3 * NAP, NOW + 7 * NAP]); // ket szakember ugyanarra az idopontra = 1; a mult es a 7 napon tuli kimarad
  assert.equal(ELO_NAP, 7);
  assert.deepEqual(ablakIdopontok([], NOW), []);
});

test('elsodleges allapot: "mar csak N szabad idopont maradt a kovetkezo 7 napra" (kevesnel), semleges (sok szabadnal), nincs (nullanal)', () => {
  assert.equal(eloAllapot({ szabad: 3 }).uzenet, 'A következő 7 napra már csak 3 szabad időpont maradt.');
  assert.equal(eloAllapot({ szabad: 1 }).uzenet, 'A következő 7 napra már csak 1 szabad időpont maradt.');
  assert.equal(eloAllapot({ szabad: KEVES }).uzenet, `A következő 7 napra már csak ${KEVES} szabad időpont maradt.`);
  assert.equal(eloAllapot({ szabad: KEVES + 1 }).uzenet, `A következő 7 napra ${KEVES + 1} szabad időpont van.`, 'sok szabad idopontnal nem allitunk szukoseget');
  const nulla = eloAllapot({ szabad: 0, kovetkezo: 'Csütörtök, okt. 15.' });
  assert.equal(nulla.hangulat, 'nincs'); assert.match(nulla.uzenet, /nincs szabad időpont.*Csütörtök, okt\. 15\./);
  assert.equal(nulla.uzenet, 'A következő 7 napra nincs szabad időpont. A legközelebbi: Csütörtök, okt. 15.', 'nincs dupla pont');
});

test('hangulat: surgos (narancs) 3 vagy kevesebb szabad idopontnal, egyebkent zold', () => {
  assert.equal(eloAllapot({ szabad: 2 }).hangulat, 'keves'); assert.equal(eloAllapot({ szabad: 3 }).hangulat, 'keves');
  assert.equal(eloAllapot({ szabad: 4 }).hangulat, 'jo'); assert.equal(eloAllapot({ szabad: 40 }).hangulat, 'jo');
});

test('masodik allapot (heti foglaltsag %) CSAK kiszamithato kapacitasbol; kapacitas nelkul nincs', () => {
  assert.deepEqual(eloAllapot({ szabad: 3 }).extra, []);
  assert.deepEqual(eloAllapot({ szabad: 3, het: null }).extra, []);
  assert.deepEqual(eloAllapot({ szabad: 3, het: { szabad: 5, kapacitas: 0 } }).extra, [], 'nulla kapacitasbol nem szamolunk');
  assert.deepEqual(eloAllapot({ szabad: 3, het: { szabad: 9, kapacitas: 5 } }).extra, [], 'lehetetlen adatbol (tobb szabad, mint kapacitas) nem szamolunk');
  assert.deepEqual(eloAllapot({ szabad: 3, het: { szabad: 9, kapacitas: 50 } }).extra, ['Ezen a héten az időpontok 82%-a már foglalt.']);
  assert.deepEqual(eloAllapot({ szabad: 30, het: { szabad: 40, kapacitas: 50 } }).extra, [], 'kis foglaltsagot (20%) nem mutatunk');
});

test('harmadik allapot (utolso foglalas) CSAK valodi esemenybol; forras nelkul nincs', () => {
  assert.deepEqual(eloAllapot({ szabad: 3 }).extra, []);
  assert.deepEqual(eloAllapot({ szabad: 3, utolsoFoglalasPerc: null }).extra, []);
  assert.deepEqual(eloAllapot({ szabad: 3, utolsoFoglalasPerc: 36 }).extra, ['36 perce foglaltak utoljára erre a kezelésre.']);
  assert.deepEqual(eloAllapot({ szabad: 3, utolsoFoglalasPerc: 0 }).extra, ['Az imént foglaltak erre a kezelésre.']);
  assert.deepEqual(eloAllapot({ szabad: 3, utolsoFoglalasPerc: 125 }).extra, ['2 órája foglaltak utoljára erre a kezelésre.']);
  assert.deepEqual(eloAllapot({ szabad: 3, utolsoFoglalasPerc: 30 * 60 }).extra, [], 'napokkal ezelotti foglalast nem emlegetunk');
});

test('frissites: csak valodi valtozas jelez (az ido mulasa nem: ugyanarra az ablakra szamolunk)', () => {
  const regi = [NOW + NAP, NOW + 2 * NAP, NOW + 3 * NAP];
  assert.deepEqual(frissites(regi, regi), { valtozas: null, eltunt: 0, uj: 0 });
  assert.deepEqual(frissites(regi, [NOW + NAP, NOW + 3 * NAP]), { valtozas: 'csokkent', eltunt: 1, uj: 0 });
  assert.deepEqual(frissites(regi, [...regi, NOW + 4 * NAP]), { valtozas: 'nott', eltunt: 0, uj: 1 });
  assert.equal(frissites(regi, [NOW + NAP, NOW + 2 * NAP, NOW + 5 * NAP]).valtozas, 'csere');
});

test('cim: alapbol "Elo foglaltsag", valodi valtozas utan "Most frissult"; a segedsor allando', () => {
  assert.equal(eloAllapot({ szabad: 3 }).cim, 'Élő foglaltság');
  assert.equal(eloAllapot({ szabad: 2, frissult: 'csokkent' }).cim, 'Most frissült');
  assert.equal(eloAllapot({ szabad: 2 }).also, 'Az elérhetőség automatikusan frissül.');
});
