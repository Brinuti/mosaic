// UJ-82: elonezeti ujrajatszo ut a Meta ELO-modul 3/3 mintajahoz (CSAK olvas, CSAK Test Events kodos kuldes, CSAK ELO_CSAK_TESZT="1" mellett).
//   node --test tools/test-elo-ujrajatszas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { eloUjrajatszas } from '../netlify/lib/meres/elo-ujrajatszas.js';
import { ELO_DATASETEK } from '../netlify/lib/meres/meta-elo.js';
import { d1 } from './lib-sd-teszt.mjs';
import { meresSema } from '../netlify/lib/meres/elosztas.js';
import { onRequest } from '../functions/api/meres-elo-ujrajatszas.js';

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0); const T = Math.floor(NOW / 1000);
const TOKEN = 'teszt-meta-elo-token-0123456789';
const ENV = (db, extra = {}) => ({ ELO_CSAK_TESZT: '1', META_ELO_BE: 'headspa,pmu', META_ELO_TOKEN: TOKEN, META_ELO_TESZT_KOD: 'TEST47348', META_ELO_TESZT_KOD_PMU: 'TEST43023', KULCS_DB_OLV: db, ...extra });
const BU = 'https://mosaicheadspa.salonic.hu/guestData/?placeId=16&serviceId=77&startDate=1790000000';
const sor = async (d, i, { uzletag = 'headspa', ido = T - 3600 * i, bongeszo = null, hozz = {}, forras = 'motor', uuid = true } = {}) => {
  const sid = `mb_0muwq2ciorsos0tznsfyl${i}`;
  const b = bongeszo === null ? { g: `g:55${i}`, bookingUrl: BU, oldal: 'https://www.mosaicheadspa.hu/foglalas-ok/' } : bongeszo;
  await d.prepare('INSERT INTO meres_erkezes (source_id, uzletag, tipus, attr, hozz, ua, ip, oldal, bongeszo, ido, frissitve) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)').bind(sid, uzletag, 'foglalas', JSON.stringify({ fbp: 'fb.1.1790000000.1234567890' }), JSON.stringify(hozz), 'UA-TESZT-VENDEG', '203.0.113.7', 'https://www.mosaicheadspa.hu/foglalas-ok/', b ? JSON.stringify(b) : '', ido).run();
  await d.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, forras, salonic_uuid, letrehozva, frissitve) VALUES (?1,'Schedule','ernyo','meta',?2,?3,'elkuldve',?4,?5,?6,?6)").bind('e' + sid, uzletag, sid, forras, uuid ? `uuid-${i}` : null, ido).run();
};
const baz = async (extra = {}) => { const d = d1(); await meresSema(d); for (const i of [1, 2, 3, 4]) await sor(d, i); await sor(d, 5, { uzletag: 'pmu' }); await sor(d, 6, { uzletag: 'pmu' }); await sor(d, 7, { uzletag: 'pmu' }); return d; };
const hamisFetch = (valasz = { events_received: 1 }, status = 200) => { const h = []; const f = async (u, o) => { h.push({ u, body: JSON.parse(o.body) }); return { status, json: async () => valasz }; }; f.hivasok = h; return f; };
const irasSzamlalo = (d) => { const n = { iras: 0 }; const eredeti = d.prepare; return { db: { ...d, prepare: (sql) => { if (!/^\s*SELECT/i.test(sql)) n.iras++; return eredeti(sql); }, batch: async (s) => { n.iras++; return d.batch(s); } }, n }; };

test('1) kapuk: ELO_CSAK_TESZT != 1 (eles) -> nem elerheto, nincs kuldes; hianyzo kod / kapcsolo / forras-DB / ismeretlen uzletag -> hiba, nincs kuldes', async () => {
  const d = await baz(); const f = hamisFetch();
  assert.equal((await eloUjrajatszas(ENV(d, { ELO_CSAK_TESZT: undefined }), { uzletag: 'headspa' }, { fetchImpl: f, now: () => NOW })).hiba, 'nem_elerheto');
  assert.equal((await eloUjrajatszas(ENV(d, { ELO_CSAK_TESZT: '0' }), { uzletag: 'headspa' }, { fetchImpl: f })).hiba, 'nem_elerheto');
  assert.equal((await eloUjrajatszas(ENV(d, { META_ELO_TESZT_KOD: undefined }), { uzletag: 'headspa' }, { fetchImpl: f })).hiba, 'nincs_teszt_kod');
  assert.equal((await eloUjrajatszas(ENV(d, { META_ELO_TESZT_KOD_PMU: undefined }), { uzletag: 'pmu' }, { fetchImpl: f })).hiba, 'nincs_teszt_kod', 'a HeadSpa kod a PMU-ra nem jo');
  assert.equal((await eloUjrajatszas(ENV(d, { META_ELO_BE: 'headspa' }), { uzletag: 'pmu' }, { fetchImpl: f })).hiba, 'kapcsolo_ki');
  assert.equal((await eloUjrajatszas(ENV(d, { META_ELO_TOKEN: 'rovid' }), { uzletag: 'headspa' }, { fetchImpl: f })).hiba, 'kapcsolo_ki');
  assert.equal((await eloUjrajatszas(ENV(undefined), { uzletag: 'headspa' }, { fetchImpl: f })).hiba, 'nincs_forras_adatbazis');
  assert.equal((await eloUjrajatszas(ENV(d), { uzletag: 'szor' }, { fetchImpl: f })).hiba, 'ismeretlen_uzletag');
  assert.equal(f.hivasok.length, 0);
});
test('2) HeadSpa: 3 legutobbi Salonic-igazolt tetel, datasetenkent a sajat Test Events kodjaval; a valasz nem tartalmaz IP-t / UA-t / foglalas-azonositot', async () => {
  const d = await baz(); const f = hamisFetch();
  const r = await eloUjrajatszas(ENV(d), { uzletag: 'headspa', db: 3 }, { fetchImpl: f, now: () => NOW });
  assert.equal(r.ok, true); assert.equal(r.kuldve, 3); assert.equal(f.hivasok.length, 3);
  for (const h of f.hivasok) { assert.ok(h.u.includes(`/${ELO_DATASETEK.headspa}/events`)); assert.equal(h.body.data[0].event_name, 'Schedule'); assert.equal(h.body.test_event_code, 'TEST47348'); assert.ok(h.body.data[0].event_id); assert.ok(!('em' in (h.body.data[0].user_data || {})), 'nyers / hash-elt e-mail nem megy'); }
  assert.deepEqual(r.mintak.map((m) => m.sorszam), [1, 2, 3]); assert.ok(r.mintak.every((m) => m.allapot === 'elkuldve' && m.events_received === 1 && m.http_status === 200 && m.teszt_kod === true));
  const szoveg = JSON.stringify(r); assert.ok(!szoveg.includes('203.0.113') && !szoveg.includes('UA-TESZT') && !szoveg.includes('mb_0muwq') && !szoveg.includes(TOKEN));
});
test('3) PMU: a PMU datasetre, a PMU Test Events kodjaval; mas uzletag tetele nem kerul bele', async () => {
  const d = await baz(); const f = hamisFetch();
  const r = await eloUjrajatszas(ENV(d), { uzletag: 'pmu', db: 3 }, { fetchImpl: f, now: () => NOW });
  assert.equal(r.kuldve, 3); for (const h of f.hivasok) { assert.ok(h.u.includes(`/${ELO_DATASETEK.pmu}/events`)); assert.equal(h.body.test_event_code, 'TEST43023'); }
});
test('4) kihagyott tetelek: nincs bongeszo-kulcs / marketing-elutasitas / nem Salonic-igazolt (nincs uuid) -> nem megy; ha kevesebb van mint kert, a kihagyva_ok jelzi', async () => {
  const d = d1(); await meresSema(d);
  await sor(d, 1); await sor(d, 2, { bongeszo: {} }); await sor(d, 3, { hozz: { adv: false } }); await sor(d, 4, { uuid: false }); await sor(d, 5, { forras: 'kartya' });
  const f = hamisFetch(); const r = await eloUjrajatszas(ENV(d), { uzletag: 'headspa', db: 3 }, { fetchImpl: f, now: () => NOW });
  assert.equal(r.kuldve, 1); assert.equal(f.hivasok.length, 1); assert.match(r.kihagyva_ok, /nincs elegendo/);
});
test('5) fogadas-hiba: events_received 0 / HTTP 400 -> allapot hiba + hiba_kod (token / teljes valasz nem); halozati hiba sem dob; max 3 minta', async () => {
  const d = await baz();
  const r1 = await eloUjrajatszas(ENV(d), { uzletag: 'headspa', db: 99 }, { fetchImpl: hamisFetch({ error: { code: 190, message: 'access_token=SECRET' } }, 400), now: () => NOW });
  assert.equal(r1.kert, 3); assert.ok(r1.mintak.every((m) => m.allapot === 'hiba' && m.hiba_kod === 190 && m.events_received === 0)); assert.ok(!JSON.stringify(r1).includes('SECRET'));
  const r2 = await eloUjrajatszas(ENV(d), { uzletag: 'headspa', db: 1 }, { fetchImpl: async () => { throw new Error('halozat'); }, now: () => NOW });
  assert.equal(r2.mintak[0].allapot, 'hiba');
});
test('6) a 7 napnal regebbi tetel ideje a kuldes pillanata (Meta elutasitana); a frissebbe az eredeti', async () => {
  const d = d1(); await meresSema(d); await sor(d, 1, { ido: T - 8 * 86400 }); await sor(d, 2, { ido: T - 3600 });
  const f = hamisFetch(); const r = await eloUjrajatszas(ENV(d), { uzletag: 'headspa', db: 3 }, { fetchImpl: f, now: () => NOW });
  assert.deepEqual(r.mintak.map((m) => m.ido), ['eredeti', 'most']); assert.equal(f.hivasok[1].body.data[0].event_time, T);
});
test('7) CSAK OLVAS: a forras-DB-n nincs iras (CREATE / INSERT / UPDATE), nincs claim', async () => {
  const d = await baz(); const { db, n } = irasSzamlalo(d); const f = hamisFetch();
  await eloUjrajatszas(ENV(db), { uzletag: 'headspa', db: 3 }, { fetchImpl: f, now: () => NOW });
  assert.equal(n.iras, 0); assert.equal(f.hivasok.length, 3);
});
test('8) vegpont: nem POST / ELO_CSAK_TESZT hianya / kulcs hianya (fejlecben kell) -> 404; helyes kulccsal 200', async () => {
  const d = await baz(); const KULCS = 'proba-kulcs-0123456789'; const { createHash } = await import('node:crypto'); const hash = createHash('sha256').update(KULCS).digest('hex');
  const env = ENV(d, { EGYEZTETES_KULCS_HASH: hash });
  const hiv = (e, { m = 'POST', fej = { 'x-egyeztetes-kulcs': KULCS }, url = 'https://x.pages.dev/api/meres-elo-ujrajatszas', torzs = { uzletag: 'headspa', db: 1 } } = {}) => onRequest({ request: new Request(url, { method: m, headers: fej, body: m === 'POST' ? JSON.stringify(torzs) : undefined }), env: e });
  assert.equal((await hiv({ ...env, ELO_CSAK_TESZT: undefined })).status, 404, 'eles: nincs ELO_CSAK_TESZT -> 404');
  assert.equal((await hiv(env, { m: 'GET' })).status, 404);
  assert.equal((await hiv(env, { fej: {} })).status, 404);
  assert.equal((await hiv(env, { fej: {}, url: `https://x.pages.dev/api/meres-elo-ujrajatszas?kulcs=${KULCS}` })).status, 404, 'a ?kulcs= query nem fogadhato el');
  assert.equal((await hiv(env, { fej: { 'x-egyeztetes-kulcs': 'rossz' } })).status, 404);
  const orig = globalThis.fetch; globalThis.fetch = hamisFetch();
  try { const v = await hiv(env); assert.equal(v.status, 200); const j = await v.json(); assert.equal(j.kuldve, 1); } finally { globalThis.fetch = orig; }
});
