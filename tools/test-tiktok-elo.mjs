// UJ-67/69/71/73: a kodos ELO TikTok-esemeny (alapbol KI, uzletagonkent kapcsolhato, kozos event_id a bongeszovel).
//   node --test tools/test-tiktok-elo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ELO_ESEMENY, ELO_PIXEL, bongeszoEloEventId, eloBongeszoJelzes, tiktokEloBe, tiktokEloKerelem, tiktokEloKuld, tiktokEloUzletagok } from '../netlify/lib/meres/tiktok-elo.js';
import { erkezesMent, meresSema } from '../netlify/lib/meres/elosztas.js';
import { erkezesForrassal } from '../netlify/lib/meres/forras-lpt.js';
import { kezelErkezes } from '../netlify/lib/meres/vegpontok.js';
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { d1 } from './lib-sd-teszt.mjs';

const GYOKER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATTR = fs.readFileSync(path.join(GYOKER, 'assets/js/attribucio.js'), 'utf8');
const HOST = 'https://www.mosaicheadspa.hu';
const TOKEN = 'teszt-elo-token-0123456789abcdef';
const NOW = Date.UTC(2026, 9, 27, 12, 0, 0);
const ID = (x) => ('mb_0muwq2ciorsos0tznsfyli' + x).toLowerCase();
const HOZZ = { ana: true, adv: true, fun: true };
const BU = 'https://mosaicheadspa.salonic.hu/guestData/?placeId=16&serviceId=77&startDate=1790000000';
const ERK = (o = {}) => ({ source_id: ID('q'), uzletag: 'headspa', tipus: 'foglalas', szolgaltatas: 'Headspa kezeles', ar: 15000, first_booking: true, g: 'g:555', bookingUrl: BU, attr: {}, hozz: HOZZ, oldal: HOST + '/success', ...o });
const ENV = (extra = {}) => ({ TIKTOK_ELO_BE: 'headspa', TIKTOK_ELO_TOKEN: TOKEN, MERES_ELOSZTO: '1', ...extra });
const tablaVan = (d, t) => d.db.prepare('SELECT count(*) AS n FROM sqlite_master WHERE name = ?').get(t).n > 0;
const FK = (o = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: ID('q'), jelleg: 'elso', kupon: false, ertek: 15000, ido: Math.floor(NOW / 1000), vendeg: { email: 'proba.vendeg@example.com', telefon: '+36301234567', g: '555' }, ...o });
const hamisFetch = (valasz = { code: 0, message: 'OK' }, status = 200) => { const h = []; const f = async (u, o) => { h.push({ u, o, body: JSON.parse(o.body) }); return { status, json: async () => (typeof valasz === 'function' ? valasz(h.length) : valasz) }; }; f.hivasok = h; return f; };
const KULCS_ID = 'success-555-77-1790000000';

test('A) kapcsolo: alapbol KI; csak TIKTOK_ELO_BE (ervenyes uzletag) ES legalabb 16 karakteres TIKTOK_ELO_TOKEN egyutt kapcsol; kulonben semmi (fail-closed)', () => {
  assert.deepEqual(tiktokEloUzletagok({}), []); assert.deepEqual(tiktokEloUzletagok(null), []);
  assert.deepEqual(tiktokEloUzletagok({ TIKTOK_ELO_BE: 'headspa' }), [], 'token nelkul nincs');
  assert.deepEqual(tiktokEloUzletagok({ TIKTOK_ELO_BE: 'headspa', TIKTOK_ELO_TOKEN: 'rovid' }), []);
  assert.deepEqual(tiktokEloUzletagok({ TIKTOK_ELO_BE: ' headspa , szor,xx,,pmu ', TIKTOK_ELO_TOKEN: TOKEN }), ['headspa', 'szor', 'pmu']);
  assert.equal(tiktokEloBe(ENV(), 'headspa'), true); assert.equal(tiktokEloBe(ENV(), 'szor'), false); assert.equal(tiktokEloBe({ TIKTOK_ELO_TOKEN: TOKEN }, 'headspa'), false);
  assert.deepEqual(ELO_ESEMENY, { headspa: 'Schedule', szor: 'CompleteRegistration', oxigen: 'SubmitForm', fodrasz: 'Contact', pmu: 'Consult' });
  assert.equal(ELO_PIXEL, ELO_CELOK.tiktok[0]);
});
test('A) a bongeszos event_id a Meta bongeszos kulcs (utvonal + g + serviceId + startDate); hianyzo reszeknel null', () => {
  assert.equal(bongeszoEloEventId({ oldal: HOST + '/success', g: 'g:555', bookingUrl: BU }), KULCS_ID);
  assert.equal(bongeszoEloEventId({ oldal: HOST + '/success', g: '', bookingUrl: BU }), null); assert.equal(bongeszoEloEventId({ oldal: HOST + '/success', g: 'g:5' }), null);
});
test('A) eloBongeszoJelzes: uzletagonkent a megfelelo esemeny; csak elso foglalas / konzultacio; visszajaro, kupon, ajandekkartya, elutasitas, kikapcsolt uzletag, kozos kulcs nelkul: null', () => {
  const env = ENV({ TIKTOK_ELO_BE: 'headspa,szor,oxigen,fodrasz,pmu' });
  assert.deepEqual(eloBongeszoJelzes(env, ERK()), { esemeny: 'Schedule', event_id: KULCS_ID, pixel: ELO_PIXEL });
  const p = (uzletag, ut, extra = {}) => eloBongeszoJelzes(env, ERK({ uzletag, oldal: HOST + ut, ...extra }));
  assert.equal(p('szor', '/elysion-ok', { szolgaltatas: 'Lezeres kezeles' }).esemeny, 'CompleteRegistration');
  assert.equal(p('oxigen', '/oxigenterapia-ok', { szolgaltatas: 'Hajkamera konzultacio', first_booking: false }).esemeny, 'SubmitForm', 'az oxigen konzultacio mindig uj (UJ-68)');
  assert.equal(p('fodrasz', '/fodrasz-ok', { szolgaltatas: 'Konzultacio', first_booking: true }).esemeny, 'Contact');
  assert.equal(p('pmu', '/pmu-ok', { szolgaltatas: 'Szemoldok tetovalas' }).esemeny, 'Consult');
  assert.equal(p('szor', '/szortelenites-ok'), null, 'visszajaro oldal'); assert.equal(p('oxigen', '/oxigenterapia-masodik'), null);
  assert.equal(eloBongeszoJelzes(env, ERK({ first_booking: false })), null, 'visszajaro HeadSpa'); assert.equal(eloBongeszoJelzes(env, ERK({ first_booking: null })), null, 'ismeretlen: nem allitjuk, hogy uj');
  assert.equal(eloBongeszoJelzes(env, ERK({ szolgaltatas: 'KUPONKODDAL - HeadSpa kezeles' })), null, 'kupon nem konverzio');
  assert.equal(eloBongeszoJelzes(env, ERK({ tipus: 'ajandekkartya' })), null, 'ajandekkartya: az ajandek.js kuldi');
  assert.equal(eloBongeszoJelzes(env, ERK({ hozz: { adv: false } })), null, 'explicit elutasitas');
  assert.equal(eloBongeszoJelzes(env, ERK({ g: '' })), null, 'kozos kulcs nelkul nincs bongeszos esemeny');
  assert.equal(eloBongeszoJelzes(ENV({ TIKTOK_ELO_BE: 'szor' }), ERK()), null, 'kikapcsolt uzletag'); assert.equal(eloBongeszoJelzes({}, ERK()), null);
  assert.equal(eloBongeszoJelzes(env, null), null); assert.equal(eloBongeszoJelzes(env, { uzletag: 'xx' }), null);
});
test('A) tiktokEloKerelem: az ELO pixelre, a megfelelo esemennyel, event_id-val; user: csak hash + ttclid / ttp / ip / ua; nyers e-mail / telefon / szolgaltatasnev / ar nincs', () => {
  const k = tiktokEloKerelem({ esemeny_id: 'Schedule:' + ID('q'), event_id: KULCS_ID, uzletag: 'headspa', ido: 1790000000, hash: { em: 'h1'.repeat(32), ph_e164: 'h2'.repeat(32), ext: 'h3'.repeat(32) }, erk: { ttclid: 'E.C.P.abc123', ttp: 'ttp-1' }, ip: '203.0.113.9', ua: 'UA', oldal: HOST + '/success' });
  assert.deepEqual([k.nev, k.url, k.method, k.body.event_source, k.body.event_source_id], ['Schedule', 'https://business-api.tiktok.com/open_api/v1.3/event/track/', 'POST', 'web', ELO_PIXEL]);
  const d = k.body.data[0]; assert.deepEqual([d.event, d.event_id, d.event_time, d.page], ['Schedule', KULCS_ID, 1790000000, { url: HOST + '/success' }]);
  assert.deepEqual(Object.keys(d.user).sort(), ['email', 'external_id', 'ip', 'phone', 'ttclid', 'ttp', 'user_agent']);
  assert.equal(tiktokEloKerelem({ esemeny_id: 'Schedule:x', event_id: KULCS_ID, uzletag: 'headspa', ido: 1790000000, hash: {}, erk: {}, oldal: HOST + '/success?price=15000&x=1#a' }).body.data[0].page.url, HOST + '/success', 'a page.url query / fragment nelkul megy (price= stb. nem)');
  assert.equal(d.properties, undefined, 'nincs ertek / szolgaltatasnev / ar');
  assert.equal(JSON.stringify(k.body).includes('@'), false);
  assert.equal(tiktokEloKerelem({ uzletag: 'xx' }).tiltva, 'ismeretlen uzletag');
});

const beallit = async (d, o = {}) => { await meresSema(d); await erkezesMent(d, ERK(o), NOW); };
test('B) tiktokEloKuld: alapbol KI (nincs kapcsolo / token / masik uzletag): nincs hivas, nincs tabla', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  for (const env of [{}, { TIKTOK_ELO_BE: 'headspa' }, ENV({ TIKTOK_ELO_BE: 'szor' })]) assert.deepEqual(await tiktokEloKuld(d, FK(), { env, fetchImpl: f, now: () => NOW }), { allapot: 'ki' });
  assert.equal(f.hivasok.length, 0); assert.equal(tablaVan(d, 'meres_tiktok_elo'), false);
});
test('B) tiktokEloKuld: HeadSpa uj vendeg -> Schedule az ELO pixelre, a bongeszovel kozos event_id-val, titkos fejlecben a token; naplo a sajat tablaban; masodik hivas nem kuld ujra', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  const r = await tiktokEloKuld(d, FK(), { env: ENV(), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  assert.deepEqual([r.allapot, r.esemeny, r.event_id_forras, r.http_status], ['elkuldve', 'Schedule', 'bongeszo_kulcs', 200]);
  assert.equal(f.hivasok.length, 1); const h = f.hivasok[0];
  assert.equal(h.o.headers['access-token'], TOKEN); assert.equal(h.body.event_source_id, ELO_PIXEL); assert.equal(h.body.data[0].event, 'Schedule'); assert.equal(h.body.data[0].event_id, KULCS_ID);
  assert.equal(h.body.data[0].user.email.length, 64, 'hash'); assert.equal(JSON.stringify(h.body).includes('proba.vendeg'), false);
  const sor = d.db.prepare('SELECT * FROM meres_tiktok_elo').all(); assert.equal(sor.length, 1);
  assert.deepEqual([sor[0].esemeny_id, sor[0].allapot, sor[0].event_id, sor[0].tiktok_nev, sor[0].uzletag], ['Schedule:' + ID('q'), 'elkuldve', KULCS_ID, 'Schedule', 'headspa']);
  assert.equal(JSON.stringify(sor).includes(TOKEN), false, 'a token nem kerul a naplora');
  const r2 = await tiktokEloKuld(d, FK(), { env: ENV(), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'aktiv' });
  assert.deepEqual([r2.allapot, f.hivasok.length], ['mar_kuldve', 1]);
  assert.equal(tablaVan(d, 'meres_kuldes') ? d.db.prepare("SELECT count(*) AS n FROM meres_kuldes WHERE kerelem LIKE ?").get('%' + ELO_PIXEL + '%').n : 0, 0, 'az ARNYEK-lanc naploja (meres_kuldes) nem tartalmaz elo celt');
});
test('B) TIKTOK_ELO_TESZT_KOD: a kerelem a Test Events fulre megy (test_event_code), kod nelkul nincs ilyen mezo', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  await tiktokEloKuld(d, FK(), { env: ENV({ TIKTOK_ELO_TESZT_KOD: 'TEST12345' }), fetchImpl: f, now: () => NOW });
  assert.equal(f.hivasok[0].body.test_event_code, 'TEST12345');
  const d2 = d1(); const f2 = hamisFetch(); await beallit(d2); await tiktokEloKuld(d2, FK(), { env: ENV(), fetchImpl: f2, now: () => NOW });
  assert.equal('test_event_code' in f2.hivasok[0].body, false);
});
test('B) tiktokEloKuld: bongeszo nelkuli (sd) foglalas: KOZOS KULCS NELKUL nincs szerveres kuldes (a bongeszo mas event_id-vel szamolna duplan); nem uj vendeg / kupon / fixAllapot / explicit elutasitas: nincs kuldes', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d);
  const sd = 'sd_' + 'a'.repeat(24);
  const r = await tiktokEloKuld(d, FK({ source_entity_id: sd }), { env: ENV(), fetchImpl: f, now: () => NOW });
  assert.equal(r.allapot, 'kihagyva'); assert.match(r.indok, /kozos/); assert.equal(f.hivasok.length, 0, 'sd-agon nincs TikTok-esemeny');
  assert.equal((await d.prepare('SELECT COUNT(*) AS n FROM meres_tiktok_elo').first()).n, 0, 'sor sem keletkezik');
  const n = f.hivasok.length;
  assert.equal((await tiktokEloKuld(d, FK({ jelleg: 'visszajaro', source_entity_id: ID('v') }), { env: ENV(), fetchImpl: f, now: () => NOW })).allapot, 'nincs_ernyo');
  assert.equal((await tiktokEloKuld(d, FK({ kupon: true, source_entity_id: ID('k') }), { env: ENV(), fetchImpl: f, now: () => NOW })).allapot, 'nincs_ernyo');
  assert.equal((await tiktokEloKuld(d, FK({ source_entity_id: ID('f'), fixAllapot: { allapot: 'kihagyva', indok: 'reschedule_confirmed' } }), { env: ENV(), fetchImpl: f, now: () => NOW })).allapot, 'kihagyva');
  await erkezesMent(d, ERK({ source_id: ID('e'), hozz: { adv: false } }), NOW);
  assert.equal((await tiktokEloKuld(d, FK({ source_entity_id: ID('e') }), { env: ENV(), fetchImpl: f, now: () => NOW })).allapot, 'kihagyva');
  assert.equal(f.hivasok.length, n, 'egyik sem kuldott');
});
test('B) tiktokEloKuld: lemondott -> nincs kuldes; nem ellenorizheto -> halasztva, majd ujraprobalhato; TikTok-hiba -> hiba, ujraprobalas utan elkuldve; legfeljebb 3 probalkozas', async () => {
  const d = d1(); await beallit(d); const deps = (f, elo) => ({ env: ENV(), fetchImpl: f, now: () => NOW, eloEllenorzes: async () => elo });
  const f0 = hamisFetch();
  assert.equal((await tiktokEloKuld(d, FK(), deps(f0, 'torolve'))).allapot, 'kihagyva');
  const h = await tiktokEloKuld(d, FK(), { ...deps(f0, 'x'), eloEllenorzes: async () => { throw new Error('salonic nem elerheto'); } });
  assert.deepEqual([h.allapot, f0.hivasok.length], ['halasztva', 0]);
  const hibas = hamisFetch({ code: 40001, message: 'hiba' }); const r1 = await tiktokEloKuld(d, FK(), deps(hibas, 'aktiv')); assert.equal(r1.allapot, 'hiba');
  assert.equal(d.db.prepare('SELECT probalkozas FROM meres_tiktok_elo').get().probalkozas, 1);
  const jo = hamisFetch(); const r2 = await tiktokEloKuld(d, FK(), deps(jo, 'aktiv')); assert.deepEqual([r2.allapot, jo.hivasok.length], ['elkuldve', 1]);
  assert.equal(d.db.prepare('SELECT probalkozas FROM meres_tiktok_elo').get().probalkozas, 2);
  const d2 = d1(); await beallit(d2); const rossz = hamisFetch({ code: 1 }, 500);
  for (let i = 0; i < 5; i++) await tiktokEloKuld(d2, FK(), deps(rossz, 'aktiv'));
  assert.equal(rossz.hivasok.length, 3, 'legfeljebb 3 probalkozas'); assert.equal(d2.db.prepare('SELECT allapot FROM meres_tiktok_elo').get().allapot, 'hiba');
  const e = hamisFetch(); e.hiba = true; const d3 = d1(); await beallit(d3);
  const dob = async () => { throw new Error('halozati hiba'); };
  assert.equal((await tiktokEloKuld(d3, FK(), { env: ENV(), fetchImpl: dob, now: () => NOW, eloEllenorzes: async () => 'aktiv' })).allapot, 'hiba', 'a fetch kivetele sem dobodik tovabb');
});
test('B) tiktokEloKuld: HeadSpa ajandekkartya: nincs bongeszos peldany, ezert kozos kulcs nelkul is megy (esemeny_id), egyszer', async () => {
  const d = d1(); const f = hamisFetch(); await meresSema(d);
  const fk = FK({ tipus: 'ajandekkartya', source_entity_id: ID('g'), jelleg: undefined, vendeg: {} });
  const r = await tiktokEloKuld(d, fk, { env: ENV(), fetchImpl: f, now: () => NOW });
  assert.deepEqual([r.allapot, r.event_id_forras, f.hivasok.length], ['elkuldve', 'esemeny_id', 1]);
  assert.equal((await tiktokEloKuld(d, fk, { env: ENV(), fetchImpl: f, now: () => NOW })).allapot, 'mar_kuldve'); assert.equal(f.hivasok.length, 1);
});
test('B) tiktokEloKuld: egy Salonic-foglalas (azonos uuid) a motoron es az sd-n at is csak egyszer megy ki', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  const uuid = '11111111-2222-3333-4444-555555555555'; const sd = 'sd_' + 'b'.repeat(24);
  assert.equal((await tiktokEloKuld(d, FK({ uuid }), { env: ENV(), fetchImpl: f, now: () => NOW })).allapot, 'elkuldve');
  const r = await tiktokEloKuld(d, FK({ uuid, source_entity_id: sd }), { env: ENV(), fetchImpl: f, now: () => NOW });
  assert.equal(f.hivasok.length, 1, 'a masodik identitas nem kuld'); assert.notEqual(r.allapot, 'elkuldve');
});

const kerelemObj = (be, cookie) => new Request(HOST + '/api/meres-erkezes', { method: 'POST', headers: { 'content-type': 'application/json', origin: HOST, ...(cookie ? { cookie } : {}) }, body: JSON.stringify(be) });
test('C) az erkezes valasza: bekapcsolt uzletagnal additiv "tiktok_elo"; kikapcsolva / nem jogosult / kozos kulcs nelkul a valasz VALTOZATLAN (nincs ilyen mezo)', async () => {
  const d = d1();
  const hiv = async (env, be) => { const r = await erkezesForrassal(kerelemObj(be), { KULCS_DB: d, ...env }, kezelErkezes, { now: () => NOW }); return { status: r.status, j: await r.json() }; };
  const be = await hiv(ENV(), ERK());
  assert.equal(be.status, 200); assert.deepEqual(be.j.tiktok_elo, { esemeny: 'Schedule', event_id: KULCS_ID, pixel: ELO_PIXEL }); assert.equal(be.j.ok, true);
  const ki = await hiv({ MERES_ELOSZTO: '1' }, ERK({ source_id: ID('r') })); assert.equal('tiktok_elo' in ki.j, false);
  const vissza = await hiv(ENV(), ERK({ source_id: ID('s'), first_booking: false })); assert.equal('tiktok_elo' in vissza.j, false);
  const nincsKulcs = await hiv(ENV(), ERK({ source_id: ID('t'), g: '' })); assert.equal('tiktok_elo' in nincsKulcs.j, false);
  const lptKi = await hiv(ENV({ MOSAIC_LPT_KI: '1' }), ERK({ source_id: ID('u') })); assert.equal('tiktok_elo' in lptKi.j, false, 'a MOSAIC_LPT_KI a burkot kikapcsolja');
});

function tarolo() { const m = new Map(); return { _m: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function kliens({ adv = true, valasz, ttq } = {}) {
  const hivasok = []; const timers = [];
  const win = {};
  const ctx = {
    document: { get cookie() { return ''; }, referrer: '' }, localStorage: tarolo(), sessionStorage: tarolo(), location: { hostname: 'www.mosaicheadspa.hu', search: '', origin: HOST, pathname: '/success' },
    performance: { getEntriesByType: () => [{ type: 'navigate' }] }, URL, URLSearchParams, Date, JSON, Math, Promise, String, Object, Array, encodeURIComponent, decodeURIComponent, RegExp,
    setTimeout: (f, ms) => { timers.push(f); return timers.length; }, clearTimeout() {},
    fetch: async (u, o = {}) => { hivasok.push({ u, body: o.body ? JSON.parse(o.body) : null }); return { ok: true, status: 200, json: async () => valasz }; },
  };
  Object.assign(win, ctx); win.window = win; win.self = win; win.top = win; win.mhSuti = { engedely: (n) => (n === 'adv' ? adv : true), hozzajarulas: () => ({ ana: true, adv, fun: true }) };
  if (ttq) win.ttq = ttq;
  vm.createContext(win); vm.runInContext(ATTR, win);
  return { win, hivasok, timers };
}
const mikro = () => new Promise((ok) => setImmediate(ok));
test('D) kliens: a valasz "tiktok_elo"-jara ttq.track(esemeny, {}, {event_id}); egyszer; hozzajarulas nelkul / hibas jelzesre / nem inicializalt pixelre nem (csak varakozik)', async () => {
  const hivasok = []; const ttq = { track: (...a) => hivasok.push(a), _i: {} };
  const t = { esemeny: 'Schedule', event_id: KULCS_ID, pixel: ELO_PIXEL };
  const k = kliens({ ttq, valasz: { ok: true, tiktok_elo: t } });
  await k.win.mhAttribucio.kuld({ source_id: ID('q'), uzletag: 'headspa', tipus: 'foglalas' }); await mikro();
  assert.equal(JSON.stringify(hivasok), JSON.stringify([['Schedule', {}, { event_id: KULCS_ID }]]));
  await k.win.mhAttribucio.kuld({ source_id: ID('q2'), uzletag: 'headspa', tipus: 'foglalas' }); await mikro(); assert.equal(hivasok.length, 1, 'ugyanaz az event_id egyszer');
  const nincs = []; const k2 = kliens({ adv: false, ttq: { track: (...a) => nincs.push(a), _i: {} }, valasz: { ok: true, tiktok_elo: t } });
  await k2.win.mhAttribucio.kuld({ source_id: ID('w'), uzletag: 'headspa', tipus: 'foglalas' }); await mikro(); assert.equal(nincs.length, 0, 'marketing-hozzajarulas nelkul nincs');
  const rossz = []; const k3 = kliens({ ttq: { track: (...a) => rossz.push(a), _i: {} }, valasz: { ok: true, tiktok_elo: { esemeny: 'x y', event_id: '../', pixel: 'p' } } });
  await k3.win.mhAttribucio.kuld({ source_id: ID('x'), uzletag: 'headspa', tipus: 'foglalas' }); await mikro(); assert.equal(rossz.length, 0, 'ervenytelen jelzes');
  const kesz = []; const ttq4 = { track: (...a) => kesz.push(a) }; const k4 = kliens({ ttq: ttq4, valasz: { ok: true, tiktok_elo: t } });
  await k4.win.mhAttribucio.kuld({ source_id: ID('y'), uzletag: 'headspa', tipus: 'foglalas' }); await mikro(); assert.equal(kesz.length, 0); assert.ok(k4.timers.length >= 1, 'a nem inicializalt pixelre varakozik');
  ttq4._i = {}; k4.timers.shift()(); assert.equal(JSON.stringify(kesz), JSON.stringify([['Schedule', {}, { event_id: KULCS_ID }]]), 'a pixel betoltodese utan elkuldi');
  const nelkul = []; const k5 = kliens({ ttq: { track: (...a) => nelkul.push(a), _i: {} }, valasz: { ok: true } });
  await k5.win.mhAttribucio.kuld({ source_id: ID('z'), uzletag: 'headspa', tipus: 'foglalas' }); await mikro(); assert.equal(nelkul.length, 0, 'jelzes nelkul (kikapcsolt) semmi');
});
test('E) vedett fajlok valtozatlanok: a modul csak importalja ( nem modositja ) a platformok.js / elosztas.js / esemeny-modell.js fajlokat; az ARNYEK-lanc tiltolistaja ures-allapotban is tartalmazza az elo pixelt', () => {
  assert.deepEqual(ELO_CELOK.tiktok, [ELO_PIXEL]);
  const src = fs.readFileSync(path.join(GYOKER, 'netlify/lib/meres/tiktok-elo.js'), 'utf8');
  assert.equal(/eval\(|new Function/.test(src), false);
});

test('B) elonezeti vedohalo: ELO_CSAK_TESZT=1 mellett teszt-kod nelkul NINCS kuldes (az elonezet nem kuldhet az ELO pixelre); teszt-koddal megy; a wrangler.toml-ban az eles TIKTOK_ELO_BE pontosan headspa (UJ-94 2), teszt-kod / vedohalo az elesben nincs', async () => {
  const d = d1(); const f = hamisFetch(); await beallit(d);
  const r = await tiktokEloKuld(d, FK(), { env: ENV({ ELO_CSAK_TESZT: '1' }), fetchImpl: f, now: () => NOW });
  assert.equal(r.allapot, 'kihagyva'); assert.match(r.indok, /TIKTOK_ELO_TESZT_KOD/); assert.equal(f.hivasok.length, 0);
  const r2 = await tiktokEloKuld(d, FK(), { env: ENV({ ELO_CSAK_TESZT: '1', TIKTOK_ELO_TESZT_KOD: 'TEST12345' }), fetchImpl: f, now: () => NOW });
  assert.equal(r2.allapot, 'elkuldve'); assert.equal(f.hivasok[0].body.test_event_code, 'TEST12345');
  const w = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  const hatar = w.search(/^\[env\.preview\.vars\]/m);
  const [eles, elonezet] = [w.slice(0, hatar), w.slice(hatar)];
  // UJ-94 (2) / feri_dontes 21 + 19: a HeadSpa kodos TikTok Schedule az eles [vars]-ban BE van (egyablakos atallas); mas uzletag nincs, es teszt-kod / vedohalo-kapcsolo SOHA nincs az elesben
  assert.ok(/^TIKTOK_ELO_BE\s*=\s*"headspa"\s*(#.*)?$/m.test(eles), 'az eles [vars]-ban TIKTOK_ELO_BE pontosan "headspa"');
  assert.equal(/^TIKTOK_ELO_TESZT_KOD\s*=/m.test(eles), false, 'az eles [vars]-ban nincs TikTok teszt-kod');
  assert.ok(/^META_ELO_BE\s*=\s*"(pmu|headspa,pmu)"/m.test(eles), 'az eles META_ELO_BE: pmu (UJ-79) vagy headspa,pmu (UJ-98)');
  assert.equal(/^META_ELO_TESZT_KOD\w*\s*=/m.test(eles), false, 'az eles [vars]-ban nincs Meta teszt-kod');
  assert.ok(/^ELO_CSAK_TESZT\s*=\s*"1"/m.test(elonezet)); assert.ok(/^TIKTOK_ELO_BE\s*=\s*"headspa"/m.test(elonezet)); assert.ok(/^META_ELO_BE\s*=\s*"headspa,pmu"/m.test(elonezet));
  assert.equal(/^ELO_CSAK_TESZT\s*=/m.test(eles), false, 'az eles kornyezetben nincs vedohalo-kapcsolo (ott a BE + token a valodi bekapcsolas)');
});
