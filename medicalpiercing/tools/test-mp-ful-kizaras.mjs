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

import { cimkez, kattintasAzonositoPlatform } from '../lib/meres/cimke.js';
test('cimke: hozzajarulassal tarolt friss kattintasazonosito nyer, ha a munkamenetben nincs fizetett jel', () => {
  const t = 1792000000;
  const s = { forras_verzio: 'mp_v2', referrer_kat: 'nincs', hozzajarulas_hirdetes: 1, letrehozva: t, kattintas_tipus: 'gclid', kattintas_ido: t - 86400 };
  assert.equal(kattintasAzonositoPlatform(s), 'google');
  assert.deepEqual(cimkez(s, []), { forras_cimke: 'google_nem_markas', ismeretlen_ok: null, cimke_megjegyzes: 'kattintas_azonosito' });
  assert.equal(cimkez({ ...s, forras_verzio: null, referrer_kat: null }, []).forras_cimke, 'google_nem_markas');
  assert.equal(cimkez({ ...s, hozzajarulas_hirdetes: 0 }, []).forras_cimke, 'organikus_direkt');
  assert.equal(cimkez({ ...s, kattintas_ido: t - 31 * 86400 }, []).forras_cimke, 'organikus_direkt');
  // ujabb Meta kattintas nyer
  assert.equal(kattintasAzonositoPlatform({ ...s, meta_fbc: 'fb.1.1.x', meta_kattintas_ido: t - 3600 }), 'meta');
  // munkamenetbeli fizetett jel elsobbseget elvez
  assert.equal(cimkez({ ...s, utm_source: 'tiktok', utm_medium: 'paid_social', kattintas_param: 'ttclid' }, []).forras_cimke, 'tiktok');
});
