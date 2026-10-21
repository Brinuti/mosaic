// A Meta ARNYEK event_id = a bongeszos tag 213 kulcsa a motoros (mb_) agon (#167 6315883179, UJ-2).
// Futtatas: node tools/test-meta-bongeszo-kulcs.mjs
import assert from 'node:assert/strict';
import { bongeszoMetaKulcs } from '../netlify/lib/meres/meta-bongeszo-kulcs.js';
import { metaKerelem } from '../netlify/lib/meres/platformok.js';
import { esemenyek } from '../netlify/lib/meres/esemeny-modell.js';

const H = 'https://www.mosaicheadspa.hu';
const BU = (svc = '302342', start = '1794069000') => `https://mosaicheadspa.salonic.hu/guestData/?anyone=true&employeeId=24989&placeId=10427&serviceId=${svc}&startDate=${start}&back=mb_0mv9704obpendm5eqdxhx0t`;
let n = 0;
const ok = (nev, fn) => { fn(); n++; console.log('ok -', nev); };

// 1) kulcsképzés a D1-ben talalt 8 koszonooldal-utvonalra (a 182-es valtozo szabalya: nem alfanumerikus torlese, elso 12 karakter)
const UTAK = [
  ['/fodrasz-ok', 'fodraszok'], ['/ajikartya-ok', 'ajikartyaok'], ['/success-foglalas-egyeni', 'successfogla'], ['/success-foglalas-paros', 'successfogla'],
  ['/oxigenterapia-ok', 'oxigenterapi'], ['/pmu-ok', 'pmuok'], ['/oxigenterapia-masodik', 'oxigenterapi'], ['/szortelenites-ok', 'szortelenite'],
  ['/success-foglalas', 'successfogla'], ['/success-foglalas-vip', 'successfogla'], ['/success-foglalas-4kezes', 'successfogla'], ['/elysion-ok', 'elysionok'],
];
for (const [ut, elotag] of UTAK) {
  ok(`kulcs ${ut}`, () => assert.equal(bongeszoMetaKulcs({ oldal: `${H}${ut}?first_booking=true&price=1`, g: 'g:123456789', bookingUrl: BU() }), `${elotag}-123456789-302342-1794069000`));
}
ok('a g: elotag nelkuli g is jo', () => assert.equal(bongeszoMetaKulcs({ oldal: `${H}/pmu-ok`, g: '987654321', bookingUrl: BU('5', '1790000000') }), 'pmuok-987654321-5-1790000000'));
ok('hianyzo g / bookingUrl / serviceId / startDate / ervenytelen oldal = null', () => {
  const alap = { oldal: `${H}/pmu-ok`, g: 'g:1', bookingUrl: BU() };
  assert.equal(bongeszoMetaKulcs({ ...alap, g: '' }), null);
  assert.equal(bongeszoMetaKulcs({ ...alap, g: 'g:' }), null);
  assert.equal(bongeszoMetaKulcs({ ...alap, bookingUrl: '' }), null);
  assert.equal(bongeszoMetaKulcs({ ...alap, bookingUrl: 'https://mosaicheadspa.salonic.hu/guestData/?startDate=1' }), null);
  assert.equal(bongeszoMetaKulcs({ ...alap, bookingUrl: 'https://mosaicheadspa.salonic.hu/guestData/?serviceId=1' }), null);
  assert.equal(bongeszoMetaKulcs({ ...alap, bookingUrl: 'nem url' }), null);
  assert.equal(bongeszoMetaKulcs({ ...alap, oldal: 'nem url' }), null);
  assert.equal(bongeszoMetaKulcs(null), null);
  assert.equal(bongeszoMetaKulcs({}), null);
});
ok('ures utvonal = "x" (mint a 182-es valtozoban)', () => assert.equal(bongeszoMetaKulcs({ oldal: `${H}/`, g: 'g:1', bookingUrl: BU('2', '3') }), 'x-1-2-3'));

// 2) a Meta ARNYEK-kerelem event_id-ja
const ENV = { META_TESZT_KOD: 'TEST00000' };
const ctxEpit = (fk, bongeszo) => ({ fk: { tipus: 'foglalas', uzletag: 'headspa', ido: 1792600000, ...fk }, erk: {}, hash: {}, hozz: { meta: { felhasznaloi_adat: false } }, ua: null, ip: null, oldal: `${H}/success-foglalas-egyeni`, bongeszo });
const eid = (e, ctx) => metaKerelem(e, ctx, ENV).body.data[0].event_id;
const BONGESZO = { oldal: `${H}/success-foglalas-egyeni?first_booking=true`, g: 'g:123456789', bookingUrl: BU() };
const MB = 'mb_0mv9704obpendm5eqdxhx0t';
ok('mb_ alapesemeny: a bongeszos kulcs megy', () => {
  const fk = { source_entity_id: MB, jelleg: 'elso', ertek: 25000 };
  const [alap, ernyo] = esemenyek({ ...fk, uzletag: 'headspa' });
  assert.equal(alap.tipus, 'alap'); assert.equal(ernyo.tipus, 'ernyo');
  assert.equal(eid(alap, ctxEpit(fk, BONGESZO)), 'successfogla-123456789-302342-1794069000');
});
ok('az ernyo esemeny (Schedule) valtozatlan: esemeny_id', () => {
  const fk = { source_entity_id: MB, jelleg: 'elso', ertek: 25000 };
  const [, ernyo] = esemenyek({ ...fk, uzletag: 'headspa' });
  assert.equal(eid(ernyo, ctxEpit(fk, BONGESZO)), ernyo.esemeny_id);
});
ok('hianyzo bongeszo-adat: marad az esemeny_id (nem talalunk ki kulcsot)', () => {
  const fk = { source_entity_id: MB, jelleg: 'elso', ertek: 25000 };
  const [alap] = esemenyek({ ...fk, uzletag: 'headspa' });
  for (const b of [null, undefined, {}, { oldal: BONGESZO.oldal }]) assert.equal(eid(alap, ctxEpit(fk, b)), alap.esemeny_id);
});
ok('Salonic-direct (sd_) agon valtozatlan', () => {
  const fk = { source_entity_id: 'sd_0123456789abcdef01234567', forras: 'salonic_direct', jelleg: 'elso', ertek: 25000 };
  const [alap] = esemenyek({ ...fk, uzletag: 'headspa' });
  assert.equal(eid(alap, ctxEpit(fk, BONGESZO)), alap.esemeny_id);
});
ok('ajandekkartya (pi_) agon valtozatlan', () => {
  const fk = { tipus: 'ajandekkartya', source_entity_id: 'pi_3QabcdEFgh12345678', ertek: 20000 };
  const [alap] = esemenyek({ ...fk, uzletag: 'headspa' });
  assert.equal(eid(alap, ctxEpit(fk, BONGESZO)), alap.esemeny_id);
});
ok('mas uzletag, mas oldal: a sajat utvonal-elotag', () => {
  const fk = { uzletag: 'fodrasz', source_entity_id: MB, jelleg: 'elso', ertek: 15000 };
  const [alap] = esemenyek(fk);
  assert.equal(eid(alap, ctxEpit(fk, { ...BONGESZO, oldal: `${H}/fodrasz-ok` })), 'fodraszok-123456789-302342-1794069000');
});
ok('a tobbi mezo (event_name, order_id) nem valtozik', () => {
  const fk = { source_entity_id: MB, jelleg: 'elso', ertek: 25000 };
  const [alap] = esemenyek({ ...fk, uzletag: 'headspa' });
  const d = metaKerelem(alap, ctxEpit(fk, BONGESZO), ENV).body.data[0];
  assert.equal(d.event_name, 'HeadSpa_FoglalasElso'); assert.equal(d.custom_data.order_id, MB);
});
console.log(`\n${n} teszt, 0 hiba`);
