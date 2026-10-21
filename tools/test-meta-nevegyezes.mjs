// UJ-12 (#167 6321101806): napi QA-sor "Meta nevegyezes" (egyezik / pmu_lekepezes / besorolasi_elteres / kupon_utvonal) + a bongeszos 213-as tag nev-szabalyanak masa.
//   node --test tools/test-meta-nevegyezes.mjs
// Valodi SQLite (node:sqlite) a D1 helyett (lib-sd-teszt.mjs), semmi nem megy ki a halozatra, nincs titok, nincs szemelyes adat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sema } from '../netlify/lib/foglalas-kulcs.js';
import { meresSema } from '../netlify/lib/meres/elosztas.js';
import { bongeszoMetaEsemeny, metaNevOsztaly } from '../netlify/lib/meres/meta-bongeszo-nev.js';
import { napIntervallum, qaNap, t2Start } from '../netlify/lib/meres/qa-nap.js';
import { d1 } from './lib-sd-teszt.mjs';

const H = 'https://www.mosaicheadspa.hu';
const BU = 'https://mosaicheadspa.salonic.hu/guestData/?serviceId=1&startDate=1794069000';
const b = (ut, fb, ar, mk = '') => ({ oldal: `${H}${ut}?first_booking=${fb}`, first_booking: fb, ar, munkatars: mk, g: 'g:123456789', bookingUrl: BU });

test('a 213-as tag nev-szabalya (GTM v54, 2026-10-21): uzletag x first_booking x price', () => {
  const T = [
    ['/success-foglalas-egyeni', true, 25000, '', 'HeadSpa_FoglalasElso'], ['/success-foglalas-paros', false, 25000, '', 'HeadSpa_Visszajaro'],
    ['/fodrasz-ok', true, 15000, 'Anna', 'Fodrasz_FoglalasElso'], ['/fodrasz-ok', true, 0, 'Anna', 'Fodrasz_Konzultacio'], ['/fodrasz-ok', false, 9000, 'Anna', 'Fodrasz_Visszajaro'],
    ['/fodrasz-ok', true, 30000, 'Kiss Elysion', 'Szor_FoglalasElso'], ['/fodrasz-ok', true, 0, 'Kiss Elysion', 'Szor_Konzultacio'], ['/fodrasz-ok', false, 5000, 'kiss elysion', 'Szor_Visszajaro'],
    ['/oxigenterapia-ok', true, 29900, '', 'Oxigen_FoglalasElso'], ['/oxigenterapia-ok', true, 4990, '', 'Oxigen_Konzultacio'], ['/oxigenterapia-ok', false, 4990, '', 'Oxigen_Konzultacio'], ['/oxigenterapia-ok', false, 19900, '', 'Oxigen_Visszajaro'],
    ['/oxigenterapia-masodik', false, 29900, '', 'Oxigen_Visszajaro'], ['/oxigenterapia-masodik', true, 0, '', 'Oxigen_Visszajaro'],
    ['/elysion-ok', true, 0, '', 'Szor_Konzultacio'], ['/elysion-ok', true, 30000, '', 'Szor_FoglalasElso'], ['/elysion-ok', false, 30000, '', 'Szor_Visszajaro'],
    ['/szortelenites-ok', true, 30000, '', 'Szor_Visszajaro'], ['/szortelenites-ok', false, 30000, '', 'Szor_Visszajaro'],
    ['/pmu-ok', true, 0, '', 'PMU_Foglalas'], ['/pmu-ok', true, 90000, '', 'PMU_Foglalas'], ['/pmu-ok', false, 90000, '', 'PMU_Visszajaro'],
  ];
  for (const [ut, fb, ar, mk, vart] of T) assert.equal(bongeszoMetaEsemeny(b(ut, fb, ar, mk)), vart, `${ut} first=${fb} ar=${ar} ${mk}`);
});
test('kapuk: nincs esemeny, ha nincs first_booking / bookingUrl / illeszkedo utvonal (pl. /ajikartya-ok)', () => {
  assert.equal(bongeszoMetaEsemeny({ ...b('/pmu-ok', true, 1), first_booking: null }), null);
  assert.equal(bongeszoMetaEsemeny({ ...b('/pmu-ok', true, 1), bookingUrl: '' }), null);
  assert.equal(bongeszoMetaEsemeny(b('/ajikartya-ok', true, 0)), null);
  assert.equal(bongeszoMetaEsemeny(b('/valami-mas', true, 0)), null);
  assert.equal(bongeszoMetaEsemeny(null), null); assert.equal(bongeszoMetaEsemeny({}), null); assert.equal(bongeszoMetaEsemeny({ oldal: 'nem url', first_booking: true, bookingUrl: BU }), null);
  assert.equal(bongeszoMetaEsemeny({ ...b('/pmu-ok', true, 1), ar: null }), 'PMU_Foglalas', 'hianyzo ar nem 0 -> nem konzultacio, PMU-n ugyanaz a nev');
  assert.equal(bongeszoMetaEsemeny({ ...b('/oxigenterapia-ok', true, 0), ar: null }), 'Oxigen_FoglalasElso', 'hianyzo ar nem 0 / 4990');
});
test('osztalyozas: egyezik / pmu_lekepezes / besorolasi_elteres / kupon_utvonal / nincs_bongeszos_esemeny / nincs_erkezes', () => {
  const o = (uzletag, esemenyNev, bongeszo) => metaNevOsztaly({ uzletag, esemenyNev, bongeszo });
  assert.equal(o('headspa', 'FoglalasElso', b('/success-foglalas-egyeni', true, 25000)), 'egyezik');
  assert.equal(o('pmu', 'FoglalasElso', b('/pmu-ok', true, 90000)), 'pmu_lekepezes');
  assert.equal(o('pmu', 'Konzultacio', b('/pmu-ok', true, 0)), 'pmu_lekepezes');
  assert.equal(o('pmu', 'Visszajaro', b('/pmu-ok', true, 90000)), 'besorolasi_elteres', 'Salonic: visszatero, URL: first_booking=true');
  assert.equal(o('pmu', 'Visszajaro', b('/pmu-ok', false, 90000)), 'egyezik');
  assert.equal(o('fodrasz', 'Visszajaro', b('/fodrasz-ok', true, 0)), 'besorolasi_elteres');
  assert.equal(o('oxigen', 'Visszajaro', b('/oxigenterapia-ok', true, 4990)), 'besorolasi_elteres');
  assert.equal(o('headspa', 'FoglalasElso', b('/ajikartya-ok', true, 0)), 'kupon_utvonal');
  assert.equal(o('headspa', 'FoglalasElso', b('/valami-mas', true, 0)), 'nincs_bongeszos_esemeny');
  assert.equal(o('headspa', 'FoglalasElso', null), 'nincs_erkezes');
  assert.equal(o('headspa', 'FoglalasElso', {}), 'nincs_erkezes');
});

// ---- qaNap integracio: valodi SQLite ----
const NAP = '2026-10-12';
const FROM = Date.UTC(2026, 9, 11, 22, 0, 0) / 1000;
const MOST = Date.UTC(2026, 9, 13, 12, 0, 0);
async function vilag() {
  const D = d1(); const db = { prepare: D.prepare, batch: D.batch };
  await sema(db); await meresSema(db);
  const futtat = (q, ...a) => D.db.prepare(q).run(...a);
  let n = 0;
  const kuldes = (uzletag, nev, bongeszo, { allapot = 'elkuldve', tipus = 'alap', platform = 'meta', sid, ido = FROM + 600 } = {}) => {
    const source = sid || `mb_teszt${String(++n).padStart(14, '0')}`;
    futtat('INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, letrehozva, frissitve, forras) VALUES (?,?,?,?,?,?,?,?,?,?,?)', `${nev}:${source}`, nev, tipus, platform, null, uzletag, source, allapot, ido, ido, 'motor');
    if (bongeszo) futtat('INSERT INTO meres_erkezes (source_id, uzletag, tipus, attr, hozz, bongeszo, ido, frissitve) VALUES (?,?,?,?,?,?,?,?)', source, uzletag, 'foglalas', '{}', '{}', JSON.stringify(bongeszo), ido, ido);
  };
  return { db, kuldes, futtat };
}
test('qaNap.meta_nevegyezes: darabszamok, csak az elkuldott mb_ alapesemenyek, a nap ablakaban; a lampat nem erinti', async () => {
  const w = await vilag();
  w.kuldes('headspa', 'FoglalasElso', b('/success-foglalas-egyeni', true, 25000));
  w.kuldes('headspa', 'FoglalasElso', b('/success-foglalas-paros', true, 25000));
  w.kuldes('pmu', 'FoglalasElso', b('/pmu-ok', true, 90000));
  w.kuldes('pmu', 'Konzultacio', b('/pmu-ok', true, 0));
  w.kuldes('fodrasz', 'Visszajaro', b('/fodrasz-ok', true, 0));
  w.kuldes('headspa', 'FoglalasElso', b('/ajikartya-ok', true, 0));
  w.kuldes('oxigen', 'FoglalasElso', null); // nincs erkezesi sor
  w.kuldes('szor', 'Visszajaro', b('/valami-mas', false, 1)); // nincs bongeszos esemeny
  // nem szamit: erny, mas platform, nem elkuldott, pi_ forras, a nap ablakan kivul
  w.kuldes('headspa', 'Schedule', b('/success-foglalas-egyeni', true, 25000), { tipus: 'ernyo' });
  w.kuldes('headspa', 'FoglalasElso', b('/success-foglalas-egyeni', true, 25000), { platform: 'tiktok' });
  w.kuldes('headspa', 'FoglalasElso', b('/success-foglalas-egyeni', true, 25000), { allapot: 'tiltva' });
  w.kuldes('headspa', 'Ajandekkartya', b('/success-ajandekkartya-stripe', true, 25000), { sid: 'pi_3QabcdEFgh12345678' });
  w.kuldes('headspa', 'FoglalasElso', b('/success-foglalas-egyeni', true, 25000), { ido: FROM - 100 });
  const r = await qaNap(w.db, napIntervallum(NAP, MOST), { mostMs: MOST });
  assert.deepEqual(r.meta_nevegyezes, { osszes: 8, egyezik: 2, pmu_lekepezes: 2, besorolasi_elteres: 1, kupon_utvonal: 1, nincs_bongeszos_esemeny: 1, nincs_erkezes: 1 });
  assert.ok(!JSON.stringify(r.meta_nevegyezes).includes('g:'), 'csak darabszam, PII nelkul');
  const ures = await qaNap((await vilag()).db, napIntervallum(NAP, MOST), { mostMs: MOST });
  assert.equal(ures.meta_nevegyezes.osszes, 0);
});
test('qaNap.meta_nevegyezes: hianyzo meres_erkezes.bongeszo oszlop / tabla -> null (nem dob, a lampa legfeljebb sarga a szekcio-hiba miatt)', async () => {
  const D = d1(); const db = { prepare: D.prepare, batch: D.batch };
  await sema(db); await meresSema(db);
  D.db.prepare('DROP TABLE meres_erkezes').run();
  const r = await qaNap(db, napIntervallum(NAP, MOST), { mostMs: MOST });
  assert.equal(r.meta_nevegyezes, null);
});
test('t2Start.arnyekcelok.tiktok.arnyek_eles = TIKTOK_ARNYEK_ELES==="1" (a #453 jelzo a rogzitoben)', async () => {
  const D = d1(); const db = { prepare: D.prepare, batch: D.batch };
  await sema(db); await meresSema(db);
  assert.equal((await t2Start(db, { TIKTOK_ARNYEK_ELES: '1' }, MOST)).arnyekcelok.tiktok.arnyek_eles, true);
  for (const v of [undefined, '', '0', 'igen']) assert.equal((await t2Start(db, { TIKTOK_ARNYEK_ELES: v }, MOST)).arnyekcelok.tiktok.arnyek_eles, false);
});
