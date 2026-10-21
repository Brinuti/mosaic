// A Meta ARNYEK eseménynév a PMU-n = a bongeszos tag 213 neve (#167 6319738112, UJ-2 elofeltetel).
// Futtatas: node tools/test-meta-pmu-nev.mjs
import assert from 'node:assert/strict';
import { metaKerelem, tiktokKerelem } from '../netlify/lib/meres/platformok.js';
import { esemenyek } from '../netlify/lib/meres/esemeny-modell.js';

const ALAP_ENV = { META_TESZT_KOD: 'TEST00000', TIKTOK_TESZT_KOD: 'TTTEST' };
const ENV = { ...ALAP_ENV, META_PMU_BONGESZOS_NEV: '1' };
const H = 'https://www.mosaicheadspa.hu';
const MB = 'mb_0mv9704obpendm5eqdxhx0t';
const BONGESZO = { oldal: `${H}/pmu-ok?first_booking=true`, g: 'g:123456789', bookingUrl: 'https://mosaic-pmu.salonic.hu/guestData/?serviceId=302342&startDate=1794069000' };
const ctx = (uzletag, fk) => ({ fk: { tipus: 'foglalas', uzletag, ido: 1792600000, source_entity_id: MB, ...fk }, erk: {}, hash: {}, hozz: { meta: { felhasznaloi_adat: false }, tiktok: { felhasznaloi_adat: false } }, ua: null, ip: null, oldal: `${H}/pmu-ok`, bongeszo: BONGESZO });
let n = 0;
const ok = (nev, fn) => { fn(); n++; console.log('ok -', nev); };
const nevek = (uzletag, fk) => esemenyek({ ...fk, uzletag, source_entity_id: MB }).map((e) => ({ e, meta: metaKerelem(e, ctx(uzletag, fk), ENV).body.data[0].event_name }));

ok('PMU elso foglalas: PMU_Foglalas (a bongeszoe), az ernyo Schedule marad', () => {
  const r = nevek('pmu', { jelleg: 'elso', ertek: 25000 });
  assert.equal(r.find((x) => x.e.tipus === 'alap').meta, 'PMU_Foglalas');
  assert.equal(r.find((x) => x.e.tipus === 'ernyo').meta, 'Schedule');
});
ok('PMU konzultacio: PMU_Foglalas (a bongeszoe)', () => assert.equal(nevek('pmu', { jelleg: 'konzultacio', ertek: 0 }).find((x) => x.e.tipus === 'alap').meta, 'PMU_Foglalas'));
ok('PMU visszajaro: PMU_Visszajaro (valtozatlan, a bongeszoe is)', () => assert.equal(nevek('pmu', { jelleg: 'visszajaro', ertek: 25000 })[0].meta, 'PMU_Visszajaro'));
ok('mas uzletag valtozatlan', () => {
  assert.equal(nevek('fodrasz', { jelleg: 'elso', ertek: 15000 })[0].meta, 'Fodrasz_FoglalasElso');
  assert.equal(nevek('oxigen', { jelleg: 'konzultacio', ertek: 4990 })[0].meta, 'Oxigen_Konzultacio');
  assert.equal(nevek('szor', { jelleg: 'elso', ertek: 30000 })[0].meta, 'Szor_FoglalasElso');
  assert.equal(nevek('headspa', { jelleg: 'elso', ertek: 25000 })[0].meta, 'HeadSpa_FoglalasElso');
});
ok('a TikTok ARNYEK PMU-neve nem valtozik (csak a Meta)', () => {
  const [e] = esemenyek({ jelleg: 'elso', ertek: 25000, uzletag: 'pmu', source_entity_id: MB, tipus: 'foglalas' });
  const t = tiktokKerelem(e, ctx('pmu', { jelleg: 'elso', ertek: 25000 }), ENV);
  assert.equal(t.platform_nev, 'PMU_FoglalasElso');
});
ok('KAPCSOLO nelkul (alapbol) a PMU-nev VALTOZATLAN: PMU_FoglalasElso / PMU_Konzultacio', () => {
  const nevAlap = (fk) => { const [e] = esemenyek({ ...fk, uzletag: 'pmu', source_entity_id: MB, tipus: 'foglalas' }); return metaKerelem(e, ctx('pmu', fk), ALAP_ENV).body.data[0].event_name; };
  assert.equal(nevAlap({ jelleg: 'elso', ertek: 25000 }), 'PMU_FoglalasElso');
  assert.equal(nevAlap({ jelleg: 'konzultacio', ertek: 0 }), 'PMU_Konzultacio');
  for (const v of ['0', '', undefined, 'igen']) assert.notEqual(metaKerelem(esemenyek({ jelleg: 'elso', ertek: 1, uzletag: 'pmu', source_entity_id: MB, tipus: 'foglalas' })[0], ctx('pmu', { jelleg: 'elso', ertek: 1 }), { ...ALAP_ENV, META_PMU_BONGESZOS_NEV: v }).body.data[0].event_name, 'PMU_Foglalas', 'csak az "1" kapcsol be: ' + v);
});
ok('az esemeny_id / dedup-kulcs (e.esemeny_id) nem valtozik', () => {
  const [e] = esemenyek({ jelleg: 'elso', ertek: 25000, uzletag: 'pmu', source_entity_id: MB, tipus: 'foglalas' });
  assert.equal(e.esemeny_id, `FoglalasElso:${MB}`); assert.equal(e.nev, 'FoglalasElso');
});
console.log(`\n${n} teszt, 0 hiba`);
