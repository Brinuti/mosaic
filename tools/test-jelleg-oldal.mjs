// UJ-68: a foglalas jellege a koszonooldalbol / a szolgaltatas nevebol (netlify/lib/meres/jelleg-oldal.js + a motor-ut foglalas-esemeny.js + az sd-ut).
import test from 'node:test';
import assert from 'node:assert/strict';
import { jellegSzabaly, jellegSzabalyKi, oldalUtvonal } from '../netlify/lib/meres/jelleg-oldal.js';
import { foglalasJelleg } from '../netlify/lib/meres/esemeny-modell.js';
import { erkezesMent } from '../netlify/lib/meres/elosztas.js';
import { foglalasEsemenyKuldes } from '../netlify/lib/meres/foglalas-esemeny.js';
import { d1, halozat, ENV_ALAP } from './lib-sd-teszt.mjs';

const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);
const HOST = { szor: 'mosaic-elysion.salonic.hu', oxigen: 'mosaic-oxigen.salonic.hu', fodrasz: 'mosaic-hair.salonic.hu', pmu: 'mosaic-pmu.salonic.hu', headspa: 'mosaicheadspa.salonic.hu' };
const U = 'https://www.mosaicheadspa.hu';
const modell = (uzletag, oldal, szolg, ujVendeg) => jellegSzabaly({ uzletag, oldal, szolgaltatasNev: szolg, kapott: foglalasJelleg({ szolgaltatasNev: szolg, ujVendeg, kategoria: '' }) });

test('oldalUtvonal: URL / utvonal -> kisbetus, hatso perjel nelkul; ures es hibas bemenet: ures', () => {
  assert.equal(oldalUtvonal(`${U}/Elysion-OK/?first_booking=true`), '/elysion-ok');
  assert.equal(oldalUtvonal('/pmu-ok/'), '/pmu-ok');
  assert.equal(oldalUtvonal(''), ''); assert.equal(oldalUtvonal(null), ''); assert.equal(oldalUtvonal(undefined), '');
  assert.equal(oldalUtvonal('http://['), '');
});

// [uzletag, oldal, szolgaltatas, ujVendeg (Salonic), varhato jelleg, szabaly]
const ESETEK = [
  // szor: az elysion-ok mindig uj (a Salonic "nem uj vendeg" jelzese ellenere is)
  ['szor', `${U}/elysion-ok`, 'Lézeres szőrtelenítés konzultáció', false, 'konzultacio', 'oldal_uj'],
  ['szor', `${U}/elysion-ok`, 'Lézeres szőrtelenítés konzultáció', true, 'konzultacio', 'oldal_uj'],
  ['szor', `${U}/elysion-ok`, 'Hónalj lézeres szőrtelenítés', false, 'elso', 'oldal_uj'],
  ['szor', `${U}/elysion-ok`, 'Hónalj lézeres szőrtelenítés', null, 'elso', 'oldal_uj'],
  ['szor', `${U}/elysion-ok`, 'Hónalj lézeres szőrtelenítés', true, 'elso', 'oldal_uj'],
  // szor: a szortelenites-ok mindig visszajaro (a Salonic "uj vendeg" jelzese ellenere is)
  ['szor', `${U}/szortelenites-ok`, 'Hónalj lézeres szőrtelenítés', true, 'visszajaro', 'oldal_visszajaro'],
  ['szor', `${U}/szortelenites-ok`, 'Konzultáció', true, 'visszajaro', 'oldal_visszajaro'],
  ['szor', `${U}/szortelenites-ok`, 'Hónalj lézeres szőrtelenítés', false, 'visszajaro', 'oldal_visszajaro'],
  // oxigen
  ['oxigen', `${U}/oxigenterapia-ok`, 'Akciós hajkamera vizsgálat + konzultáció', false, 'konzultacio', 'oldal_uj'],
  ['oxigen', `${U}/oxigenterapia-ok`, 'Oxigénterápia', false, 'elso', 'oldal_uj'],
  ['oxigen', `${U}/oxigenterapia-ok`, 'Oxigénterápia', true, 'elso', 'oldal_uj'],
  ['oxigen', `${U}/oxigenterapia-masodik`, 'Oxigénterápia', true, 'visszajaro', 'oldal_visszajaro'],
  // fodrasz / PMU: a konzultacio nevu szolgaltatas mindig Konzultacio, a Salonic ismert-vendeg jelzesetol fuggetlenul
  ['fodrasz', `${U}/fodrasz-ok`, 'Fodrász konzultáció', false, 'konzultacio', 'konzultacio_nev'],
  ['fodrasz', `${U}/fodrasz-ok`, 'Fodrász konzultáció', true, 'konzultacio', 'konzultacio_nev'],
  ['fodrasz', `${U}/fodrasz-ok`, 'Női hajvágás', false, 'visszajaro', null],
  ['fodrasz', `${U}/fodrasz-ok`, 'Női hajvágás', true, 'elso', null],
  ['pmu', `${U}/pmu-ok`, 'Ingyenes konzultáció', false, 'konzultacio', 'konzultacio_nev'],
  ['pmu', `${U}/pmu-ok`, 'Szemöldök tetoválás hibrid', false, 'visszajaro', null],
  ['pmu', `${U}/pmu-ok`, 'Szemöldök tetoválás hibrid', true, 'elso', null],
  // HeadSpa valtozatlan (nincs konzultacio-ag, nincs oldal-szabaly)
  ['headspa', `${U}/success-foglalas-egyeni`, 'HeadSpa kezelés', false, 'visszajaro', null],
  ['headspa', `${U}/success-foglalas-egyeni`, 'HeadSpa kezelés', true, 'elso', null],
  // nem illo ora-par: nincs oldal-szabaly (a szor oldal nem hat az oxigen uzletagra es forditva)
  ['oxigen', `${U}/elysion-ok`, 'Oxigénterápia', false, 'visszajaro', null],
  ['szor', `${U}/oxigenterapia-ok`, 'Hónalj lézeres szőrtelenítés', false, 'visszajaro', null],
  // ismeretlen / ures oldal: a szolgaltatasnev-szabaly meg igen (fodrasz), az oldal-szabaly nem (szor)
  ['szor', '', 'Hónalj lézeres szőrtelenítés', false, 'visszajaro', null],
  ['fodrasz', '', 'Fodrász konzultáció', false, 'konzultacio', 'konzultacio_nev'],
];
for (const [uzletag, oldal, szolg, ujVendeg, varhato, szabaly] of ESETEK) {
  test(`jellegSzabaly: ${uzletag} ${oldalUtvonal(oldal) || '(nincs oldal)'} "${szolg}" uj_vendeg=${ujVendeg} -> ${varhato}`, () => {
    const r = modell(uzletag, oldal, szolg, ujVendeg);
    assert.deepEqual([r.jelleg, r.szabaly], [varhato, szabaly]);
    assert.equal(r.felulirva, r.jelleg !== foglalasJelleg({ szolgaltatasNev: szolg, ujVendeg, kategoria: '' }).jelleg, 'felulirva = a jelleg a modellhez kepest valtozott');
  });
}

test('jellegSzabaly: a kupon-jelzes valtozatlan marad (DECISION #194 / #195), a jelleg viszont az oldal szerint igazodik', () => {
  const r = modell('szor', `${U}/elysion-ok`, 'KUPONKODDAL - Hónalj lézeres szőrtelenítés', false);
  assert.deepEqual([r.jelleg, r.kupon], ['elso', true]);
});

// --- motor-ut: meres_erkezes (oldal) + foglalasEsemenyKuldes -> a meres_jelleg-ben rogzitett jelleg ---
let szam = 0;
const bid = () => `mb_${'ujjelleg'.padEnd(12, '0')}${String(++szam).padStart(8, '0')}`;
async function motor({ uzletag, oldal, szolgaltatas, ujVendeg, env = {} }) {
  const D = d1(); const h = halozat(); const id = bid();
  if (oldal) await erkezesMent(D, { source_id: id, uzletag, tipus: 'foglalas', attr: {}, hozz: { ad: true }, oldal, first_booking: null, szolgaltatas, kategoria: '' }, NOW);
  const r = await foglalasEsemenyKuldes({ db: D, env: { ...ENV_ALAP, ...env }, mezok: { host: HOST[uzletag], uuid: '3f10fabc-4f7d-9257-2088-cfe7b5b24a2e', szolgaltatas, leveldatum: '2026-10-26T11:00:00Z' }, bejovo: { uj_vendeg: ujVendeg }, eredmeny: { booking_id: id }, fetchImpl: h.f, now: () => NOW });
  const sor = D.db.prepare('SELECT jelleg, kupon FROM meres_jelleg WHERE source_id = ?').get(id);
  const nevek = D.db.prepare("SELECT esemeny_nev FROM meres_kuldes WHERE source_id = ? AND esemeny_tipus = 'alap' GROUP BY esemeny_nev").all(id).map((x) => x.esemeny_nev);
  return { r, jelleg: sor && sor.jelleg, nevek };
}
test('motor-ut: a szor /elysion-ok nem-uj-vendeg jelzessel is FoglalasElso; a rogzitett jelleg es a kimeno alapesemeny megegyezik, a valasz jelzi a szabalyt', async () => {
  const m = await motor({ uzletag: 'szor', oldal: `${U}/elysion-ok?first_booking=false`, szolgaltatas: 'Hónalj lézeres szőrtelenítés', ujVendeg: false });
  assert.equal(m.jelleg, 'elso'); assert.deepEqual(m.nevek, ['FoglalasElso']);
  assert.deepEqual([m.r.jelleg_rogzites.oldal_szabaly, m.r.jelleg_rogzites.modell_jelleg], ['oldal_uj', 'visszajaro']);
});
test('motor-ut: az oxigen /oxigenterapia-ok konzultacioja nem-uj-vendeg jelzessel is Konzultacio (ertek: a rogzitett tabla)', async () => {
  const m = await motor({ uzletag: 'oxigen', oldal: `${U}/oxigenterapia-ok`, szolgaltatas: 'Akciós hajkamera vizsgálat + konzultáció', ujVendeg: false });
  assert.equal(m.jelleg, 'konzultacio'); assert.deepEqual(m.nevek, ['Konzultacio']);
});
test('motor-ut: a szor /szortelenites-ok uj-vendeg jelzessel is Visszajaro (nincs ernyo, nincs szerzes)', async () => {
  const m = await motor({ uzletag: 'szor', oldal: `${U}/szortelenites-ok`, szolgaltatas: 'Hónalj lézeres szőrtelenítés', ujVendeg: true });
  assert.equal(m.jelleg, 'visszajaro'); assert.deepEqual(m.nevek, ['Visszajaro']);
});
test('motor-ut: a fodrasz konzultacio nem-uj-vendeg jelzessel is Konzultacio; a PMU "Ingyenes konzultacio" is', async () => {
  assert.equal((await motor({ uzletag: 'fodrasz', oldal: `${U}/fodrasz-ok`, szolgaltatas: 'Fodrász konzultáció', ujVendeg: false })).jelleg, 'konzultacio');
  assert.equal((await motor({ uzletag: 'pmu', oldal: `${U}/pmu-ok`, szolgaltatas: 'Ingyenes konzultáció', ujVendeg: false })).jelleg, 'konzultacio');
});
test('motor-ut: erkezes (oldal) nelkul a szolgaltatasnev-szabaly tovabbra is ervenyes, az oldal-szabaly nem (a szor marad a regi logikan)', async () => {
  assert.equal((await motor({ uzletag: 'fodrasz', oldal: '', szolgaltatas: 'Fodrász konzultáció', ujVendeg: false })).jelleg, 'konzultacio');
  assert.equal((await motor({ uzletag: 'szor', oldal: '', szolgaltatas: 'Hónalj lézeres szőrtelenítés', ujVendeg: false })).jelleg, 'visszajaro');
});
test('motor-ut: HeadSpa valtozatlan (az oldal-szabaly nem hat ra)', async () => {
  assert.equal((await motor({ uzletag: 'headspa', oldal: `${U}/success-foglalas-egyeni`, szolgaltatas: 'HeadSpa kezelés', ujVendeg: false })).jelleg, 'visszajaro');
  assert.equal((await motor({ uzletag: 'headspa', oldal: `${U}/success-foglalas-egyeni`, szolgaltatas: 'HeadSpa kezelés', ujVendeg: true })).jelleg, 'elso');
});

// --- a jelleg-rogzites (X1) elso-level-szabalya az UJ-68 utan is: az elso kiertekeles jellege marad, a kesobbi elteres csak naplozodik ---
test('rogzites (X1): az elso level jellege marad, a kesobbi, elteros jellegu level nem kepez masik alapesemenyt (az UJ-68 szabaly utan is)', async () => {
  const { jellegRogzit } = await import('../netlify/lib/meres/jelleg-rogzites.js');
  const D = d1(); const id = 'mb_ujjelleg00000099999999';
  const el = await jellegRogzit(D, id, { jelleg: 'elso', kupon: false }, NOW);
  assert.deepEqual([el.jelleg, el.forras, el.ujonnan], ['elso', 'elso_level', true]);
  const masodik = await jellegRogzit(D, id, { jelleg: 'visszajaro', kupon: false }, NOW + 1000);
  assert.deepEqual([masodik.jelleg, masodik.ujonnan], ['elso', false]);
});

test('vesz-kapcsolo: MERES_JELLEG_OLDAL=0 -> a regi jelleg (rollback kodvaltoztatas nelkul); alapbol (nincs env / mas ertek) a szabaly fut', async () => {
  assert.equal(jellegSzabalyKi(null), false); assert.equal(jellegSzabalyKi({}), false); assert.equal(jellegSzabalyKi({ MERES_JELLEG_OLDAL: '1' }), false); assert.equal(jellegSzabalyKi({ MERES_JELLEG_OLDAL: '0' }), true);
  const ki = await motor({ uzletag: 'szor', oldal: `${U}/elysion-ok`, szolgaltatas: 'Hónalj lézeres szőrtelenítés', ujVendeg: false, env: { MERES_JELLEG_OLDAL: '0' } });
  assert.equal(ki.jelleg, 'visszajaro'); assert.equal(ki.r.jelleg_rogzites.oldal_szabaly, null);
  const be = await motor({ uzletag: 'szor', oldal: `${U}/elysion-ok`, szolgaltatas: 'Hónalj lézeres szőrtelenítés', ujVendeg: false });
  assert.equal(be.jelleg, 'elso');
});
