// UJ-74: Oxigen / Fodrasz szerveres PageView a Hair-pixelre (1361403694872594), kozos event_id a bongeszovel; alapbol KI; uj esemenynev nincs.
//   node --test tools/test-meta-pageview.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PV_DATASET, PV_ESEMENY, PV_FETCH_TIMEOUT_MS, PV_UZLETAGOK, pvBe, pvKerelem, pvKuld, pvUzletagok } from '../netlify/lib/meres/meta-pageview.js';
import { erkezesMent, meresSema } from '../netlify/lib/meres/elosztas.js';
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { d1 } from './lib-sd-teszt.mjs';

const HOST = 'https://www.mosaicheadspa.hu';
const TOKEN = 'teszt-pv-token-0123456789abcdef';
const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const ID = (x) => ('mb_0muwq2ciorsos0tznsfyli' + x).toLowerCase();
const BU = 'https://mosaic-hair.salonic.hu/guestData/?placeId=16&serviceId=77&startDate=1790000000';
const KULCS_ID = 'fodraszok-555-77-1790000000';
const ERK = (o = {}) => ({ source_id: ID('q'), uzletag: 'fodrasz', tipus: 'foglalas', szolgaltatas: 'Hajfestes', ar: 15000, first_booking: true, g: 'g:555', bookingUrl: BU, attr: { fbp: 'fb.1.1790000000.1234567890', meta: { fbclid: 'AbCdEf1234567890xyz', ts: 1790000000 } }, hozz: { ana: true, adv: true, fun: true }, oldal: HOST + '/fodrasz-ok', ua: 'UA/1.0', ip: '203.0.113.9', ...o });
const ENV = (extra = {}) => ({ META_PV_BE: 'fodrasz,oxigen', META_PV_TOKEN: TOKEN, ...extra });
const FK = (o = {}) => ({ tipus: 'foglalas', uzletag: 'fodrasz', source_entity_id: ID('q'), jelleg: 'elso', kupon: false, ertek: 15000, ido: Math.floor(NOW / 1000), oldal: HOST + '/fodrasz-ok', vendeg: { email: 'proba.vendeg@example.com', telefon: '+36301234567', g: '555', nev: 'Proba Vendeg' }, ...o });
const hamisFetch = (valasz = { events_received: 1 }, status = 200) => { const h = []; const f = async (u, o) => { h.push({ u, body: JSON.parse(o.body) }); return { status, json: async () => valasz }; }; f.hivasok = h; return f; };
const beallit = async (d, o = {}) => { await meresSema(d); await erkezesMent(d, ERK(o), NOW); };
const tablaVan = (d, t) => d.db.prepare('SELECT count(*) AS n FROM sqlite_master WHERE name = ?').get(t).n > 0;

test('A) kapcsolo: alapbol KI; csak oxigen / fodrasz, META_PV_BE ES >= 16 karakteres META_PV_TOKEN egyutt; a Hair-pixel; az esemeny PageView', () => {
  assert.deepEqual(pvUzletagok({}), []); assert.deepEqual(pvUzletagok({ META_PV_BE: 'fodrasz' }), []); assert.deepEqual(pvUzletagok({ META_PV_BE: 'fodrasz', META_PV_TOKEN: 'rovid' }), []);
  assert.deepEqual(pvUzletagok(ENV({ META_PV_BE: 'headspa, oxigen,szor' })), ['oxigen'], 'csak Oxigen / Fodrasz');
  assert.equal(pvBe(ENV(), 'fodrasz'), true); assert.equal(pvBe(ENV(), 'headspa'), false); assert.deepEqual([...PV_UZLETAGOK], ['oxigen', 'fodrasz']);
  assert.equal(PV_DATASET, '1361403694872594'); assert.ok(ELO_CELOK.meta.includes(PV_DATASET)); assert.equal(PV_ESEMENY, 'PageView');
});
test('A) pvKerelem: a Hair-datasetre, PageView, event_id, event_source_url, hash-elt user_data; nincs nyers adat / ertek / szolgaltatasnev', () => {
  const k = pvKerelem({ event_id: KULCS_ID, ido: 1790000000, hash: { em: 'a'.repeat(64), ph_meta: 'b'.repeat(64), fn: 'c'.repeat(64), ln: 'd'.repeat(64), country: 'e'.repeat(64), ext: 'f'.repeat(64) }, erk: ERK().attr, ip: '203.0.113.9', ua: 'UA', oldal: HOST + '/fodrasz-ok' });
  assert.match(k.url, /\/1361403694872594\/events$/);
  const d = k.body.data[0]; assert.deepEqual([d.event_name, d.event_id, d.action_source, d.event_source_url], ['PageView', KULCS_ID, 'website', HOST + '/fodrasz-ok']);
  assert.deepEqual(Object.keys(d.user_data).sort(), ['client_ip_address', 'client_user_agent', 'country', 'em', 'external_id', 'fbc', 'fbp', 'fn', 'ln', 'ph']); assert.equal(d.custom_data, undefined);
  assert.equal(JSON.stringify(k.body).includes('@'), false); assert.equal('test_event_code' in k.body, false); assert.equal(pvKerelem({ event_id: 'x', ido: 1, teszt: 'T1' }).body.test_event_code, 'T1');
});
test('B) alapbol KI: nincs hivas, nincs tabla; HeadSpa / szor / pmu / ajandekkartya / sd (nincs bongeszo) nem kuld', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  for (const env of [{}, { META_PV_BE: 'fodrasz' }, ENV({ META_PV_BE: 'oxigen' })]) assert.deepEqual(await pvKuld(d, FK(), { env, fetchImpl: f, now: () => NOW }), { allapot: 'ki' });
  for (const uz of ['headspa', 'szor', 'pmu']) assert.deepEqual(await pvKuld(d, FK({ uzletag: uz }), { env: ENV(), fetchImpl: f, now: () => NOW }), { allapot: 'ki' });
  assert.deepEqual(await pvKuld(d, FK({ tipus: 'ajandekkartya' }), { env: ENV(), fetchImpl: f, now: () => NOW }), { allapot: 'ki' });
  assert.equal(f.hivasok.length, 0); assert.equal(tablaVan(d, 'meres_meta_pv'), false);
  const r = await pvKuld(d, FK({ source_entity_id: 'sd_' + 'a'.repeat(24) }), { env: ENV(), fetchImpl: f, now: () => NOW }); assert.equal(r.allapot, 'kihagyva'); assert.equal(f.hivasok.length, 0);
});
test('B) fodrasz / oxigen uj vendeg + konzultacio -> PageView a bongeszovel kozos event_id-val a Hair-pixelre; naplo; token nincs a naploban; masodik hivas nem kuld ujra', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  const r = await pvKuld(d, FK(), { env: ENV(), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  assert.deepEqual([r.allapot, r.esemeny, r.http_status], ['elkuldve', 'PageView', 200]);
  const h = f.hivasok[0]; assert.match(h.u, /\/1361403694872594\/events\?access_token=/); assert.equal(h.body.data[0].event_id, KULCS_ID.replace('fodraszok', 'fodraszok')); assert.equal(h.body.data[0].event_name, 'PageView'); assert.equal(h.body.data[0].user_data.em[0].length, 64);
  const sor = d.db.prepare('SELECT * FROM meres_meta_pv').all(); assert.equal(sor.length, 1); assert.equal(sor[0].allapot, 'elkuldve'); assert.equal(JSON.stringify(sor).includes(TOKEN), false);
  assert.equal((await pvKuld(d, FK(), { env: ENV(), fetchImpl: f, now: () => NOW })).allapot, 'mar_kuldve'); assert.equal(f.hivasok.length, 1);
  const d2 = d1(); await beallit(d2, { uzletag: 'oxigen', oldal: HOST + '/oxigenterapia-ok', szolgaltatas: 'Hajkamera konzultacio' }); const f2 = hamisFetch();
  assert.equal((await pvKuld(d2, FK({ uzletag: 'oxigen', jelleg: 'konzultacio' }), { env: ENV(), fetchImpl: f2, now: () => NOW })).allapot, 'elkuldve');
});
test('B) nincs kuldes: visszajaro (a fodrasz visszajaro is) / kupon / reschedule / elutasitas / kozos kulcs nelkul / lemondott; nem ellenorizheto -> halasztva', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d);
  await erkezesMent(d, ERK(), NOW); await erkezesMent(d, ERK({ source_id: ID('e'), hozz: { adv: false } }), NOW); await erkezesMent(d, ERK({ source_id: ID('n'), g: '' }), NOW);
  const dep = { env: ENV(), fetchImpl: f, now: () => NOW };
  assert.equal((await pvKuld(d, FK({ jelleg: 'visszajaro', source_entity_id: ID('v') }), dep)).allapot, 'nincs_ernyo');
  assert.equal((await pvKuld(d, FK({ kupon: true, source_entity_id: ID('k') }), dep)).allapot, 'nincs_ernyo');
  assert.equal((await pvKuld(d, FK({ fixAllapot: { allapot: 'kihagyva' } }), dep)).allapot, 'kihagyva');
  assert.match((await pvKuld(d, FK({ source_entity_id: ID('e') }), dep)).indok, /elutasitas/); assert.match((await pvKuld(d, FK({ source_entity_id: ID('n') }), dep)).indok, /kozos/);
  assert.equal((await pvKuld(d, FK(), { ...dep, eloEllenorzes: async () => 'torolve' })).allapot, 'kihagyva');
  assert.equal((await pvKuld(d, FK(), { ...dep, eloEllenorzes: async () => { throw new Error('x'); } })).allapot, 'halasztva');
  assert.equal(f.hivasok.length, 0);
});
test('B) Meta-hiba -> hiba, ujraprobalas utan elkuldve, legfeljebb 3 probalkozas; halozati kivetel nem dob', async () => {
  const dep = (f) => ({ env: ENV(), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  const d = d1(); await beallit(d); assert.equal((await pvKuld(d, FK(), dep(hamisFetch({ error: { code: 190, type: 'OAuthException' } }, 400)))).allapot, 'hiba');
  const jo = hamisFetch(); assert.equal((await pvKuld(d, FK(), dep(jo))).allapot, 'elkuldve'); assert.equal(d.db.prepare('SELECT probalkozas FROM meres_meta_pv').get().probalkozas, 2);
  const d2 = d1(); await beallit(d2); const rossz = hamisFetch({ events_received: 0 }, 500); for (let i = 0; i < 5; i++) await pvKuld(d2, FK(), dep(rossz)); assert.equal(rossz.hivasok.length, 3);
  const d3 = d1(); await beallit(d3); assert.equal((await pvKuld(d3, FK(), dep(async () => { throw new Error('halozat'); }))).allapot, 'hiba');
});
test('B) fetch-timeout: a kuldes AbortSignal.timeout-ot kap (4 s); a megszakitott / lassu Meta -> hiba, a sor ujraprobalhato, a foglalasi valaszt nem akasztja', async () => {
  assert.equal(PV_FETCH_TIMEOUT_MS, 4000);
  const d = d1(); await beallit(d); let jel = null;
  const lassu = async (u, o) => { jel = o.signal; assert.ok(o.signal instanceof AbortSignal, 'a kerelem signal-t kap'); throw new DOMException('timeout', 'TimeoutError'); };
  const dep = (f) => ({ env: ENV(), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  const r = await pvKuld(d, FK(), dep(lassu)); assert.equal(r.allapot, 'hiba'); assert.ok(jel);
  const sor = d.db.prepare('SELECT allapot, probalkozas FROM meres_meta_pv').get(); assert.deepEqual([sor.allapot, sor.probalkozas], ['hiba', 1]);
  assert.equal((await pvKuld(d, FK(), dep(hamisFetch()))).allapot, 'elkuldve', 'az ujraprobalas sikerul');
});
test('B) DECISION #250: a folyamatban sor ujraprobaja plafonos (3), utana megszakadt (nem kuld); friss folyamatban sornal ujraprobal_mp a hivonak', async () => {
  const d = d1(); await beallit(d);
  const dep = (ms, fi) => ({ env: ENV(), fetchImpl: fi, now: () => NOW + ms, eloEllenorzes: async () => 'aktiv' });
  assert.equal((await pvKuld(d, FK(), dep(0, hamisFetch()))).allapot, 'elkuldve');
  const allit = (probalkozas, ms) => d.db.prepare("UPDATE meres_meta_pv SET allapot = 'folyamatban', probalkozas = ?, frissitve = ?").run(probalkozas, Math.floor((NOW + ms) / 1000));
  allit(1, 0);
  const friss = await pvKuld(d, FK(), dep(30000, hamisFetch())); assert.equal(friss.allapot, 'mar_kuldve'); assert.ok(friss.ujraprobal_mp >= 90 && friss.ujraprobal_mp <= 100, `ujraprobal_mp = ${friss.ujraprobal_mp}`);
  assert.equal((await pvKuld(d, FK(), dep(130000, hamisFetch()))).allapot, 'elkuldve', 'probalkozas 1 < 3: ujraprobalhato');
  allit(3, 0); const f = hamisFetch();
  const meg = await pvKuld(d, FK(), dep(130000, f)); assert.equal(meg.allapot, 'megszakadt'); assert.equal(f.hivasok.length, 0);
  const sor = d.db.prepare('SELECT allapot, indok FROM meres_meta_pv').get(); assert.equal(sor.allapot, 'megszakadt'); assert.match(sor.indok, /^megszakadt: a kuldes 3 probalkozas/);
  assert.equal((await pvKuld(d, FK(), dep(900000, f))).allapot, 'mar_kuldve'); assert.equal(f.hivasok.length, 0);
});
