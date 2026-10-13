// Divat fulpiercing (tipus='ful') NEM megy egyetlen platformra sem (Feri dontese, 2026-10-13).
import test from 'node:test';
import assert from 'node:assert/strict';
import { jogosult } from '../lib/meres/tiktok.js';
import { feltoltes } from '../lib/meres/lanc.js';

const most = 1792000000;
const alap = { kornyezet: 'eles', igazolas: 'igazolt', hozzajarulas_hirdetes: 1, tiktok_ttclid: 'TESZTttclid12345', foglalas_ido: most - 60, letrehozva: most - 60 };

test('TikTok: ful nem jogosult, mas igen', () => {
  assert.equal(jogosult({ ...alap, tipus: 'ful' }, most).ok, false);
  assert.equal(jogosult({ ...alap, tipus: 'ful' }, most).miert, 'divat_fulpiercing');
  assert.equal(jogosult({ ...alap, tipus: null }, most).ok, true);
});

test('Google: ful sorra a feltoltes semmit nem csinal (fetch sem)', async () => {
  let hivas = 0;
  const r = await feltoltes(null, { ...alap, kulcs: '1|2|3', tipus: 'ful', kattintas_tipus: 'gclid', kattintas_ertek: 'TESZTgclid12345' }, {}, 'www.medicalpiercing.hu', { fetchImpl: () => { hivas++; }, most });
  assert.deepEqual(r, []);
  assert.equal(hivas, 0);
});
