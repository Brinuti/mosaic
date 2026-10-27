// DECISION #240: a HeadSpa Meta szerveres Schedule az ELO pixelre (alapbol KI, kozos event_id a bongeszovel, uj esemenynev TILOS).
//   node --test tools/test-meta-elo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELO_DATASET, ELO_META_ESEMENY, metaEloBe, metaEloKerelem, metaEloKuld, metaEloUzletagok } from '../netlify/lib/meres/meta-elo.js';
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
  assert.deepEqual(metaEloUzletagok(ENV({ META_ELO_BE: 'headspa, szor,pmu' })), ['headspa'], 'csak a HeadSpa (DECISION #240)');
  assert.equal(metaEloBe(ENV(), 'headspa'), true); assert.equal(metaEloBe(ENV(), 'szor'), false);
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
