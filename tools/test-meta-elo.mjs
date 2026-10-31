// DECISION #240: a HeadSpa Meta szerveres Schedule az ELO pixelre (alapbol KI, kozos event_id a bongeszovel, uj esemenynev TILOS).
//   node --test tools/test-meta-elo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELO_DATASET, ELO_DATASETEK, ELO_META_ESEMENY, metaEloBe, metaEloKerelem, metaEloKuld, metaEloUzletagok } from '../netlify/lib/meres/meta-elo.js';
import { erkezesMent, meresSema } from '../netlify/lib/meres/elosztas.js';
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { d1 } from './lib-sd-teszt.mjs';

const HOST = 'https://www.mosaicheadspa.hu';
const TOKEN = 'teszt-meta-elo-token-0123456789';
const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const ID = (x) => ('mb_0muwq2ciorsos0tznsfyli' + x).toLowerCase();
const BU = 'https://mosaicheadspa.salonic.hu/guestData/?placeId=16&serviceId=77&startDate=1790000000';
const KULCS_ID = 'success-555-77-1790000000';
const ERK = (o = {}) => ({ source_id: ID('q'), uzletag: 'headspa', tipus: 'foglalas', szolgaltatas: 'Headspa kezeles', ar: 15000, first_booking: true, g: 'g:555', bookingUrl: BU, attr: { fbp: 'fb.1.1790000000.1234567890', meta: { fbclid: 'AbCdEf1234567890xyz', ts: 1790000000 } }, hozz: { ana: true, adv: true, fun: true }, oldal: HOST + '/success', ua: 'UA/1.0', ip: '203.0.113.9', ...o });
const ENV = (extra = {}) => ({ META_ELO_BE: 'headspa', META_ELO_TOKEN: TOKEN, ...extra });
const FK = (o = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: ID('q'), jelleg: 'elso', kupon: false, ertek: 15000, ido: Math.floor(NOW / 1000), vendeg: { email: 'proba.vendeg@example.com', telefon: '+36301234567', g: '555', nev: 'Proba Vendeg' }, ...o });
const hamisFetch = (valasz = { events_received: 1 }, status = 200) => { const h = []; const f = async (u, o) => { h.push({ u, o, body: JSON.parse(o.body) }); return { status, json: async () => valasz }; }; f.hivasok = h; return f; };
const beallit = async (d, o = {}) => { await meresSema(d); await erkezesMent(d, ERK(o), NOW); };
const tablaVan = (d, t) => d.db.prepare('SELECT count(*) AS n FROM sqlite_master WHERE name = ?').get(t).n > 0;

test('A) kapcsolo: alapbol KI; csak META_ELO_BE=headspa ES >= 16 karakteres META_ELO_TOKEN; mas uzletag nem kapcsolhato; az elo dataset a HeadSpa pixel; az esemeny Schedule', () => {
  assert.deepEqual(metaEloUzletagok({}), []); assert.deepEqual(metaEloUzletagok({ META_ELO_BE: 'headspa' }), []); assert.deepEqual(metaEloUzletagok({ META_ELO_BE: 'headspa', META_ELO_TOKEN: 'rovid' }), []);
  assert.deepEqual(metaEloUzletagok(ENV({ META_ELO_BE: 'headspa, szor,pmu,fodrasz' })), ['headspa', 'szor', 'pmu'], 'HeadSpa (DECISION #240) + PMU (DECISION #244) + Szor (Feri 10-31); a fodrasz nem kapcsolhato');
  assert.equal(ELO_DATASETEK.szor, '643342342027957'); assert.ok(ELO_CELOK.meta.includes(ELO_DATASETEK.szor));
  assert.deepEqual(metaEloUzletagok(ENV({ META_ELO_BE: 'pmu' })), ['pmu']); assert.equal(ELO_DATASETEK.pmu, '1019878750660854'); assert.equal(ELO_DATASETEK.headspa, ELO_DATASET); assert.ok(ELO_CELOK.meta.includes(ELO_DATASETEK.pmu));
  assert.equal(metaEloBe(ENV(), 'headspa'), true); assert.equal(metaEloBe(ENV(), 'szor'), false, 'a szor csak a META_ELO_BE-ben kapcsolhato'); assert.equal(metaEloBe(ENV({ META_ELO_BE: 'szor' }), 'szor'), true);
  assert.equal(ELO_DATASET, '3473839859576758'); assert.ok(ELO_CELOK.meta.includes(ELO_DATASET)); assert.equal(ELO_META_ESEMENY, 'Schedule');
});
test('A) metaEloKerelem: az ELO datasetre, Schedule, event_id, hash-elt user_data; nyers e-mail / telefon / ar / szolgaltatasnev nincs; teszt kod csak ha van', () => {
  const k = metaEloKerelem({ event_id: KULCS_ID, ido: 1790000000, hash: { em: 'a'.repeat(64), ph_meta: 'b'.repeat(64), fn: 'c'.repeat(64), ln: 'd'.repeat(64), country: 'e'.repeat(64), ext: 'f'.repeat(64) }, erk: ERK().attr, ip: '203.0.113.9', ua: 'UA', oldal: HOST + '/success' });
  assert.match(k.url, /^https:\/\/graph\.facebook\.com\/v[\d.]+\/3473839859576758\/events$/);
  const d = k.body.data[0]; assert.deepEqual([d.event_name, d.event_id, d.action_source, d.event_source_url, d.event_time], ['Schedule', KULCS_ID, 'website', HOST + '/success', 1790000000]);
  assert.deepEqual(Object.keys(d.user_data).sort(), ['client_ip_address', 'client_user_agent', 'country', 'em', 'external_id', 'fbc', 'fbp', 'fn', 'ln', 'ph']); assert.equal(d.custom_data, undefined);
  assert.equal(JSON.stringify(k.body).includes('@'), false); assert.equal('test_event_code' in k.body, false);
  assert.equal(metaEloKerelem({ event_id: 'x', ido: 1, teszt: 'TEST1' }).body.test_event_code, 'TEST1');
});
test('B) alapbol KI: nincs hivas, nincs tabla; nem HeadSpa / ajandekkartya / sd (nincs bongeszo) sem kuld', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  for (const env of [{}, { META_ELO_BE: 'headspa' }, ENV({ META_ELO_BE: 'szor' })]) assert.deepEqual(await metaEloKuld(d, FK(), { env, fetchImpl: f, now: () => NOW }), { allapot: 'ki' });
  assert.deepEqual(await metaEloKuld(d, FK({ tipus: 'ajandekkartya' }), { env: ENV(), fetchImpl: f, now: () => NOW }), { allapot: 'ki' });
  assert.equal(f.hivasok.length, 0); assert.equal(tablaVan(d, 'meres_meta_elo'), false);
  const r = await metaEloKuld(d, FK({ source_entity_id: 'sd_' + 'a'.repeat(24) }), { env: ENV(), fetchImpl: f, now: () => NOW });
  assert.equal(r.allapot, 'kihagyva'); assert.match(r.indok, /kozos/); assert.equal(f.hivasok.length, 0);
});
test('B) HeadSpa uj vendeg foglalas -> Schedule a bongeszovel kozos event_id-val az ELO datasetre; naplo a sajat tablaban; token a naploban nincs; masodik hivas nem kuld ujra', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  const r = await metaEloKuld(d, FK(), { env: ENV(), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  assert.deepEqual([r.allapot, r.esemeny, r.http_status, r.teszt], ['elkuldve', 'Schedule', 200, false]);
  const h = f.hivasok[0]; assert.match(h.u, /\/3473839859576758\/events\?access_token=/); assert.equal(h.body.data[0].event_name, 'Schedule'); assert.equal(h.body.data[0].event_id, KULCS_ID);
  assert.equal(h.body.data[0].user_data.em[0].length, 64); assert.equal(JSON.stringify(h.body).includes('proba.vendeg'), false);
  const sor = d.db.prepare('SELECT * FROM meres_meta_elo').all(); assert.equal(sor.length, 1); assert.deepEqual([sor[0].esemeny_id, sor[0].allapot, sor[0].event_id], ['Schedule:' + ID('q'), 'elkuldve', KULCS_ID]); assert.equal(JSON.stringify(sor).includes(TOKEN), false);
  assert.equal((await metaEloKuld(d, FK(), { env: ENV(), fetchImpl: f, now: () => NOW })).allapot, 'mar_kuldve'); assert.equal(f.hivasok.length, 1);
  const t = d1(); await beallit(t); const ft = hamisFetch(); const rt = await metaEloKuld(t, FK(), { env: ENV({ META_ELO_TESZT_KOD: 'TEST777' }), fetchImpl: ft, now: () => NOW }); assert.deepEqual([rt.teszt, ft.hivasok[0].body.test_event_code], [true, 'TEST777']);
});
test('B) nincs kuldes: visszajaro / kupon / reschedule / explicit elutasitas / kozos kulcs nelkul / lemondott; nem ellenorizheto -> halasztva', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d);
  await erkezesMent(d, ERK(), NOW); await erkezesMent(d, ERK({ source_id: ID('e'), hozz: { adv: false } }), NOW); await erkezesMent(d, ERK({ source_id: ID('n'), g: '' }), NOW);
  const dep = { env: ENV(), fetchImpl: f, now: () => NOW };
  assert.equal((await metaEloKuld(d, FK({ jelleg: 'visszajaro', source_entity_id: ID('v') }), dep)).allapot, 'nincs_ernyo');
  assert.equal((await metaEloKuld(d, FK({ kupon: true, source_entity_id: ID('k') }), dep)).allapot, 'nincs_ernyo');
  assert.equal((await metaEloKuld(d, FK({ fixAllapot: { allapot: 'kihagyva' } }), dep)).allapot, 'kihagyva');
  assert.match((await metaEloKuld(d, FK({ source_entity_id: ID('e') }), dep)).indok, /elutasitas/);
  assert.match((await metaEloKuld(d, FK({ source_entity_id: ID('n') }), dep)).indok, /kozos/);
  assert.equal((await metaEloKuld(d, FK(), { ...dep, eloEllenorzes: async () => 'torolve' })).allapot, 'kihagyva');
  assert.equal((await metaEloKuld(d, FK(), { ...dep, eloEllenorzes: async () => { throw new Error('x'); } })).allapot, 'halasztva');
  assert.equal(f.hivasok.length, 0);
});
test('B) Meta-hiba -> hiba, ujraprobalas utan elkuldve; legfeljebb 3 probalkozas; a halozati kivetel sem dobodik; azonos uuid egyszer', async () => {
  const d = d1(); await beallit(d); const dep = (f) => ({ env: ENV(), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  assert.equal((await metaEloKuld(d, FK(), dep(hamisFetch({ error: { code: 190, type: 'OAuthException' } }, 400)))).allapot, 'hiba');
  const jo = hamisFetch(); assert.equal((await metaEloKuld(d, FK(), dep(jo))).allapot, 'elkuldve'); assert.equal(d.db.prepare('SELECT probalkozas FROM meres_meta_elo').get().probalkozas, 2);
  const d2 = d1(); await beallit(d2); const rossz = hamisFetch({ events_received: 0 }, 500); for (let i = 0; i < 5; i++) await metaEloKuld(d2, FK(), dep(rossz)); assert.equal(rossz.hivasok.length, 3);
  const d3 = d1(); await beallit(d3); assert.equal((await metaEloKuld(d3, FK(), dep(async () => { throw new Error('halozat'); }))).allapot, 'hiba');
  const d4 = d1(); await beallit(d4); await erkezesMent(d4, ERK({ source_id: ID('b') }), NOW); const uuid = '11111111-2222-3333-4444-555555555555'; const f4 = hamisFetch();
  await metaEloKuld(d4, FK({ uuid }), { env: ENV(), fetchImpl: f4, now: () => NOW }); await metaEloKuld(d4, FK({ uuid, source_entity_id: ID('b') }), { env: ENV(), fetchImpl: f4, now: () => NOW }); assert.equal(f4.hivasok.length, 1, 'egy Salonic-foglalas egy esemeny');
});

// DECISION #244 (UJ-79): Mosaic PMU - ugyanaz a Schedule a PMU SAJAT elo pixelere (1019878750660854), 1 hetig parhuzamosan az `pmu-ok` URL-szaballyal.
const PMU_BU = 'https://pmu.salonic.hu/guestData/?placeId=3&serviceId=471034&startDate=1793458800';
const PMU_KULCS = 'pmuok-555-471034-1793458800';
const PMU_ERK = (o = {}) => ERK({ uzletag: 'pmu', szolgaltatas: 'PMU kezeles', bookingUrl: PMU_BU, oldal: HOST + '/pmu-ok', ...o });
const PMU_FK = (o = {}) => FK({ uzletag: 'pmu', jelleg: 'elso', ...o });
test('B) PMU: a META_ELO_BE=pmu mellett Schedule a PMU pixelre a bongeszos kulccsal; HeadSpa kapcsolo nelkul a HeadSpa nem megy; PMU kapcsolo nelkul a PMU nem megy', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d); await erkezesMent(d, PMU_ERK(), NOW);
  assert.equal((await metaEloKuld(d, PMU_FK(), { env: ENV({ META_ELO_BE: 'headspa' }), fetchImpl: f, now: () => NOW })).allapot, 'ki', 'PMU kapcsolo nelkul nincs kuldes');
  const r = await metaEloKuld(d, PMU_FK(), { env: ENV({ META_ELO_BE: 'pmu' }), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  assert.deepEqual([r.allapot, r.esemeny], ['elkuldve', 'Schedule']);
  const h = f.hivasok[0]; assert.match(h.u, /\/1019878750660854\/events\?access_token=/); assert.equal(h.body.data[0].event_name, 'Schedule'); assert.equal(h.body.data[0].event_id, PMU_KULCS);
  assert.equal(h.body.data[0].event_source_url, HOST + '/pmu-ok'); assert.equal(h.body.data[0].custom_data, undefined, 'nincs ertek / szolgaltatasnev'); assert.equal(JSON.stringify(h.body).includes('PMU kezeles'), false);
  assert.deepEqual(d.db.prepare('SELECT uzletag, allapot, event_id FROM meres_meta_elo').all().map((x) => [x.uzletag, x.allapot, x.event_id]), [['pmu', 'elkuldve', PMU_KULCS]]);
  assert.equal((await metaEloKuld(d, PMU_FK(), { env: ENV({ META_ELO_BE: 'pmu' }), fetchImpl: f, now: () => NOW })).allapot, 'mar_kuldve'); assert.equal(f.hivasok.length, 1, 'duplazas nincs');
  const d2 = d1(); const f2 = hamisFetch(); await beallit(d2);
  assert.equal((await metaEloKuld(d2, FK(), { env: ENV({ META_ELO_BE: 'pmu' }), fetchImpl: f2, now: () => NOW })).allapot, 'ki', 'a HeadSpa a pmu kapcsolotol nem indul'); assert.equal(f2.hivasok.length, 0);
});
test('B) PMU (Feri 10-31 14:25): a bongeszos kulcs hianya NEM blokkol - sd-atvetel / hianyzo g / serviceId / startDate is kuld uuid-alapu event_id-vel; lead-esemeny (nem foglalas), kupon, reschedule: nincs kuldes', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d);
  await erkezesMent(d, PMU_ERK({ source_id: ID('n'), g: '' }), NOW); await erkezesMent(d, PMU_ERK({ source_id: ID('m'), bookingUrl: 'https://pmu.salonic.hu/guestData/?placeId=3' }), NOW);
  const dep = { env: ENV({ META_ELO_BE: 'pmu' }), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' };
  const U = (n) => '00000000-0000-4000-8000-00000000000' + n;
  const r1 = await metaEloKuld(d, PMU_FK({ source_entity_id: 'sd_' + 'b'.repeat(24), uuid: U(1) }), dep); assert.equal(r1.allapot, 'elkuldve');
  assert.equal((await metaEloKuld(d, PMU_FK({ source_entity_id: ID('n'), uuid: U(2) }), dep)).allapot, 'elkuldve');
  assert.equal((await metaEloKuld(d, PMU_FK({ source_entity_id: ID('m'), uuid: U(3) }), dep)).allapot, 'elkuldve');
  assert.deepEqual(f.hivasok.map((h) => h.body.data[0].event_id), ['pmu-' + U(1), 'pmu-' + U(2), 'pmu-' + U(3)]);
  assert.ok(f.hivasok.every((h) => h.body.data[0].event_source_url === HOST + '/pmu-ok'), 'sd_ agon is van event_source_url');
  const sd = f.hivasok[0].body.data[0].user_data; assert.equal(sd.fbc, undefined); assert.equal(sd.fbp, undefined); assert.ok(sd.em && sd.ph, 'csak hash-elt azonositok');
  const n0 = f.hivasok.length;
  for (const tipus of ['pmu_foto_lead', 'pmu_visszahivas_lead', 'ajandekkartya']) assert.equal((await metaEloKuld(d, PMU_FK({ tipus, source_entity_id: ID('l') }), dep)).allapot, 'ki', tipus);
  assert.equal((await metaEloKuld(d, PMU_FK({ kupon: true, source_entity_id: ID('k') }), dep)).allapot, 'nincs_ernyo');
  assert.equal((await metaEloKuld(d, PMU_FK({ fixAllapot: { allapot: 'kihagyva' } }), dep)).allapot, 'kihagyva');
  assert.equal(f.hivasok.length, n0);
});
test('B) PMU szabaly (Feri 10-31 14:25): CSAK uj vendeg ingyenes konzultacioja es uj vendeg elso fizetos szolgaltatasa szamit; korrekcio / konzultacio utani fizetos (visszajaro) / fizetos utani fizetos / visszajaro konzultacio / kupon nem', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d);
  const dep = { env: ENV({ META_ELO_BE: 'pmu' }), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' };
  const SD = (c) => 'sd_' + c.repeat(24); const U = (n) => '00000000-0000-4000-8000-00000000001' + n;
  assert.equal((await metaEloKuld(d, PMU_FK({ source_entity_id: SD('a'), uuid: U(1), jelleg: 'konzultacio', ertek: 0, szolgaltatas: 'Ingyenes konzultacio' }), dep)).allapot, 'elkuldve', 'uj konzultacio: van');
  assert.equal((await metaEloKuld(d, PMU_FK({ source_entity_id: SD('b'), uuid: U(2), jelleg: 'elso', ertek: 79000, szolgaltatas: 'Tetovalas' }), dep)).allapot, 'elkuldve', 'uj elso fizetos: van');
  const nincs = [
    ['korrekcio (akkor is, ha uj vendegnek jelolt)', { jelleg: 'elso', ertek: 0, szolgaltatas: 'Korrekció' }],
    ['korrekcio visszajaronak jelolve', { jelleg: 'visszajaro', ertek: 0, szolgaltatas: 'Korrekció' }],
    ['konzultacio utani fizetos (a Salonic visszajaronak jeloli)', { jelleg: 'visszajaro', ertek: 79000, szolgaltatas: 'Tetovalas' }],
    ['fizetos utani fizetos (visszajaro)', { jelleg: 'visszajaro', ertek: 47000, szolgaltatas: 'Szempilla' }],
    ['visszajaro ingyenes konzultacio', { jelleg: 'visszajaro', ertek: 0, szolgaltatas: 'Ingyenes konzultacio' }],
    ['kupon', { jelleg: 'elso', kupon: true, ertek: 0, szolgaltatas: 'Tetovalas' }],
  ];
  let i = 0; for (const [nev, o] of nincs) { i++; const r = await metaEloKuld(d, PMU_FK({ source_entity_id: SD(String.fromCharCode(99 + i)), uuid: U(2 + i), ...o }), dep); assert.equal(r.allapot, 'nincs_ernyo', nev); }
  assert.equal(f.hivasok.length, 2, 'csak a ket szabaly szerinti eset ment ki');
  assert.deepEqual(f.hivasok.map((h) => h.body.data[0].event_name), ['Schedule', 'Schedule']);
});
test('B) PMU: egy Salonic-foglalas legfeljebb 1 Schedule - az mb_ es az sd_ ut ugyanazzal az uuid-dal ugyanazt az event_id-t kepezi, a masodik mar_kuldve; HeadSpa / szor viselkedes valtozatlan (sd_ -> kihagyva)', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d); await erkezesMent(d, PMU_ERK(), NOW);
  const dep = { env: ENV({ META_ELO_BE: 'pmu,headspa' }), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' };
  const uuid = '11111111-2222-3333-4444-555555555555';
  assert.equal((await metaEloKuld(d, PMU_FK({ uuid }), dep)).allapot, 'elkuldve');
  assert.equal((await metaEloKuld(d, PMU_FK({ source_entity_id: 'sd_' + 'e'.repeat(24), uuid }), dep)).allapot, 'mar_kuldve');
  assert.equal((await metaEloKuld(d, PMU_FK({ uuid }), dep)).allapot, 'mar_kuldve');
  assert.equal(f.hivasok.length, 1); assert.equal(f.hivasok[0].body.data[0].event_id, 'pmu-' + uuid);
  const rh = await metaEloKuld(d, FK({ source_entity_id: 'sd_' + 'f'.repeat(24) }), dep); assert.equal(rh.allapot, 'kihagyva'); assert.match(rh.indok, /kozos/); assert.equal(f.hivasok.length, 1, 'HeadSpa sd_: valtozatlanul nem kuld');
});

const SZ_FK = (o = {}) => FK({ uzletag: 'szor', jelleg: 'elso', ...o });
test('B) Szor (Feri 10-31 16:51, ugyanugy mint a PMU): sd_ ut is kuld uuid-alapu szor-<uuid> event_id-val az Elysion pixelre; csak uj vendeg; korrekcio soha; kapcsolo nelkul nem megy; HeadSpa/PMU valtozatlan', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d);
  const U = (n) => '00000000-0000-4000-8000-00000000002' + n; const SD = (c) => 'sd_' + c.repeat(24);
  const dep = (be) => ({ env: ENV({ META_ELO_BE: be }), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  assert.equal((await metaEloKuld(d, SZ_FK({ source_entity_id: SD('a'), uuid: U(1) }), dep('headspa,pmu'))).allapot, 'ki', 'kapcsolo nelkul nincs kuldes');
  const r = await metaEloKuld(d, SZ_FK({ source_entity_id: SD('a'), uuid: U(1) }), dep('szor')); assert.deepEqual([r.allapot, r.esemeny], ['elkuldve', 'Schedule']);
  const h = f.hivasok[0]; assert.match(h.u, /\/643342342027957\/events\?access_token=/); assert.equal(h.body.data[0].event_id, 'szor-' + U(1)); assert.equal(h.body.data[0].event_source_url, HOST + '/elysion-ok');
  assert.equal(h.body.data[0].user_data.fbc, undefined); assert.ok(h.body.data[0].user_data.em && h.body.data[0].user_data.ph); assert.equal(h.body.data[0].custom_data, undefined);
  assert.equal((await metaEloKuld(d, SZ_FK({ source_entity_id: SD('b'), uuid: U(1) }), dep('szor'))).allapot, 'mar_kuldve', 'ugyanaz az uuid: legfeljebb 1');
  assert.equal((await metaEloKuld(d, SZ_FK({ source_entity_id: SD('c'), uuid: U(2), jelleg: 'konzultacio', ertek: 0 }), dep('szor'))).allapot, 'elkuldve', 'uj konzultacio / allapotfelmeres: van');
  for (const [nev, o] of [['korrekcio', { szolgaltatas: 'Korrekció' }], ['visszajaro', { jelleg: 'visszajaro' }], ['kupon', { kupon: true }]]) assert.equal((await metaEloKuld(d, SZ_FK({ source_entity_id: SD('d'), uuid: U(3), ...o }), dep('szor'))).allapot, 'nincs_ernyo', nev);
  assert.equal(f.hivasok.length, 2);
  assert.equal((await metaEloKuld(d, FK({ source_entity_id: SD('e') }), dep('szor'))).allapot, 'ki', 'HeadSpa a szor kapcsolotol nem indul');
  assert.equal((await metaEloKuld(d, PMU_FK({ source_entity_id: SD('f'), uuid: U(4) }), dep('szor'))).allapot, 'ki', 'PMU a szor kapcsolotol nem indul');
  // elonezeti vedohalo: ELO_CSAK_TESZT=1 mellett a szor a SAJAT teszt-kodjat varja
  const dp = d1(); const fp = hamisFetch(); await meresSema(dp);
  const pd = (extra) => ({ env: ENV({ META_ELO_BE: 'szor', ELO_CSAK_TESZT: '1', ...extra }), fetchImpl: fp, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  const rk = await metaEloKuld(dp, SZ_FK({ source_entity_id: SD('9'), uuid: U(5) }), pd({ META_ELO_TESZT_KOD: 'TEST47348', META_ELO_TESZT_KOD_PMU: 'TEST43023' })); assert.equal(rk.allapot, 'kihagyva'); assert.match(rk.indok, /META_ELO_TESZT_KOD_SZOR/); assert.equal(fp.hivasok.length, 0);
  const rt = await metaEloKuld(dp, SZ_FK({ source_entity_id: SD('9'), uuid: U(5) }), pd({ META_ELO_TESZT_KOD_SZOR: 'TESTSZOR1' })); assert.equal(rt.allapot, 'elkuldve'); assert.equal(fp.hivasok[0].body.test_event_code, 'TESTSZOR1');
});

test('B) elonezeti vedohalo: ELO_CSAK_TESZT=1 mellett teszt-kod nelkul NINCS kuldes (HeadSpa es PMU sem); teszt-koddal megy', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d); await erkezesMent(d, ERK(), NOW); await erkezesMent(d, PMU_ERK(), NOW);
  for (const fk of [FK(), PMU_FK()]) {
    const r = await metaEloKuld(d, fk, { env: ENV({ META_ELO_BE: 'headspa,pmu', ELO_CSAK_TESZT: '1' }), fetchImpl: f, now: () => NOW });
    assert.equal(r.allapot, 'kihagyva'); assert.match(r.indok, /META_ELO_TESZT_KOD/);
  }
  assert.equal(f.hivasok.length, 0);
  // datasetenkenti Test Events kod: a PMU a META_ELO_TESZT_KOD_PMU-t kapja, a HeadSpa a META_ELO_TESZT_KOD-ot; a masik dataset kodja nem jo
  const K = { META_ELO_BE: 'headspa,pmu', ELO_CSAK_TESZT: '1' };
  assert.match((await metaEloKuld(d, PMU_FK(), { env: ENV({ ...K, META_ELO_TESZT_KOD: 'TEST47348' }), fetchImpl: f, now: () => NOW })).indok, /META_ELO_TESZT_KOD_PMU/, 'a HeadSpa kod a PMU-ra nem jo');
  assert.match((await metaEloKuld(d, FK(), { env: ENV({ ...K, META_ELO_TESZT_KOD_PMU: 'TEST43023' }), fetchImpl: f, now: () => NOW })).indok, /META_ELO_TESZT_KOD\)/, 'a PMU kod a HeadSpa-ra nem jo');
  assert.equal(f.hivasok.length, 0);
  const r2 = await metaEloKuld(d, PMU_FK(), { env: ENV({ ...K, META_ELO_TESZT_KOD: 'TEST47348', META_ELO_TESZT_KOD_PMU: 'TEST43023' }), fetchImpl: f, now: () => NOW });
  assert.deepEqual([r2.allapot, r2.teszt, f.hivasok[0].body.test_event_code], ['elkuldve', true, 'TEST43023']);
  assert.match(f.hivasok[0].u, /\/1019878750660854\/events/);
  const dh = d1(); await beallit(dh); const fh = hamisFetch();
  const r3 = await metaEloKuld(dh, FK(), { env: ENV({ ...K, META_ELO_TESZT_KOD: 'TEST47348', META_ELO_TESZT_KOD_PMU: 'TEST43023' }), fetchImpl: fh, now: () => NOW });
  assert.deepEqual([r3.allapot, fh.hivasok[0].body.test_event_code], ['elkuldve', 'TEST47348']); assert.match(fh.hivasok[0].u, /\/3473839859576758\/events/);
});

// 01-MERES #167 6541884407 4.(iii): a nem kuldo eredmenyek (nincs_ernyo / kihagyva / halasztva) is nyomot hagynak a meres_meta_elo-ban; a 'ki' allapot nem; a visszateres valtozatlan; ketszer ugyanarra egy sor
test('B) naplozas: nincs_ernyo / kihagyva / halasztva 1-1 naplosor (naplo: elotag), ismetlesre nem szaporodik; a ki-allapot es a kuldo ag nem naplozik; a naplo-hiba nem dobodik', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d);
  await erkezesMent(d, ERK({ source_id: ID('n') , g: '' }), NOW); await erkezesMent(d, ERK(), NOW);
  const dep = { env: ENV(), fetchImpl: f, now: () => NOW };
  const sorok = () => d.db.prepare("SELECT esemeny_id, uzletag, source_id, allapot, indok, probalkozas FROM meres_meta_elo ORDER BY esemeny_id").all();
  assert.deepEqual(await metaEloKuld(d, FK(), { env: {}, fetchImpl: f, now: () => NOW }), { allapot: 'ki' }); assert.equal(tablaVan(d, 'meres_meta_elo'), false);
  assert.equal((await metaEloKuld(d, FK({ jelleg: 'visszajaro', source_entity_id: ID('v') }), dep)).allapot, 'nincs_ernyo');
  assert.equal((await metaEloKuld(d, FK({ jelleg: 'visszajaro', source_entity_id: ID('v') }), dep)).allapot, 'nincs_ernyo');
  assert.equal((await metaEloKuld(d, FK({ source_entity_id: ID('n') }), dep)).allapot, 'kihagyva');
  assert.equal((await metaEloKuld(d, FK(), { ...dep, eloEllenorzes: async () => 'ismeretlen' })).allapot, 'halasztva');
  const s = sorok(); assert.deepEqual(s.map((x) => x.allapot).sort(), ['halasztva', 'kihagyva', 'nincs_ernyo']);
  assert.ok(s.every((x) => x.esemeny_id.startsWith('naplo:') && x.probalkozas === 0 && x.uzletag === 'headspa')); assert.equal(f.hivasok.length, 0);
  // a kuldo ag: a sor a sajat esemeny_id-jan, naplo-sor nem keletkezik hozza
  const dk = d1(); await beallit(dk); const rk = await metaEloKuld(dk, FK(), { env: ENV(), fetchImpl: hamisFetch(), now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  assert.equal(rk.allapot, 'elkuldve'); assert.deepEqual(dk.db.prepare("SELECT allapot FROM meres_meta_elo").all().map((x) => x.allapot), ['elkuldve']);
  // a naplo-hiba nem dobodik (db.prepare dob): a valasz ugyanaz
  const rossz = { prepare() { throw new Error('db'); }, batch() { throw new Error('db'); } };
  const rr = await metaEloKuld(rossz, FK(), { env: ENV(), fetchImpl: f, now: () => NOW }); assert.equal(rr.allapot, 'hiba');
});
