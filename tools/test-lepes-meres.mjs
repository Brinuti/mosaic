// A foglalo lepes-merese (DECISION-LOG #88): a kliens-modul (assets/js/booking-engine/lepes-meres.js) es a nevtelen szamlalo (netlify/lib/foglalo-szamlalo.js).
//   node --test tools/test-lepes-meres.mjs
// A szamlalo SQL-jet valodi SQLite-on (node:sqlite) futtatjuk, a D1 felulet (prepare / bind / run / all / batch) egy vekony hejon at.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createStepMeter, ESEMENYEK, HIBA_TIPUSOK as KLIENS_HIBAK, RESERVED_BY_STEPS, tisztaOldal, hibaReszlet, HIBA_KODOK as KLIENS_KODOK, RESZLET_LEPES as KLIENS_RESZLET } from '../assets/js/booking-engine/lepes-meres.js';
import { createTracker, EVENTS } from '../assets/js/booking-engine/tracking.js';
import { kezel, ervenyesit, napBudapest, osszeallit, csvbe, htmlbe, LEPESEK, UZLETAGAK, HIBA_TIPUSOK as SZERVER_HIBAK, DB_PLAFON, HIBA_KODOK as SZERVER_KODOK, RESZLET_LEPES as SZERVER_RESZLET, RESZLET_KULCS_PLAFON } from '../netlify/lib/foglalo-szamlalo.js';

// --- kliens ------------------------------------------------------------------------------------------------------------------------
function ablak({ ana = false, webdriver = false, proba = false, beacon = true } = {}) {
  const w = { dataLayer: [], kuldve: [], location: { pathname: '/lezeres-szortelenites-budapest' }, Blob: class { constructor(p, o) { this.szoveg = p.join(''); this.type = o.type; } },
    navigator: { webdriver, sendBeacon: beacon ? (url, blob) => { w.kuldve.push({ url, ...JSON.parse(blob.szoveg), tipus_hdr: blob.type }); return true; } : undefined },
    mhSuti: { engedely: (k) => k === 'ana' && w.ana }, ana,
    fetch: (url, o) => { w.kuldve.push({ url, ...JSON.parse(o.body), via: 'fetch', keepalive: o.keepalive, credentials: o.credentials }); return Promise.resolve({ ok: true }); } };
  if (proba) w.__MH_SZAMLALO_PROBA = true;
  return w;
}
const ctx = (extra = {}) => ({ business: 'laser', sourcePage: '/lezeres-szortelenites-budapest', ...extra });
const lepesek = (w) => w.dataLayer.map((e) => e.event);

test('az esemenynevek pontosan a #88 szerintiek', () => {
  assert.deepEqual(Object.values(ESEMENYEK), ['booking_open', 'booking_business', 'booking_service', 'booking_slots_loaded', 'booking_slot', 'booking_form_start', 'booking_submit', 'booking_success', 'booking_close', 'booking_error']);
  assert.deepEqual(KLIENS_HIBAK, SZERVER_HIBAK, 'a kliens es a szerver ugyanazt a hibatipus-listat ismeri');
  assert.deepEqual(Object.keys(ESEMENYEK), LEPESEK, 'a kliens es a szerver ugyanazt a lepes-listat ismeri');
});

test('teljes sikeres ut: minden lepes pontosan egyszer, a parameterek jok, a dataLayer (hozzajarulassal) es a szamlalo is megkapja', () => {
  const w = ablak({ ana: true, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.open(); m.business('laser'); m.service(444584); m.slotsLoaded(742); m.slot(); m.formStart('s1'); m.submit('s1'); m.success('REF-1'); m.close('C6');
  assert.deepEqual(lepesek(w), Object.values(ESEMENYEK).filter((n) => n !== 'booking_error'));
  assert.deepEqual(w.kuldve.map((k) => k.lepes), ['open', 'business', 'service', 'slots_loaded', 'slot', 'form_start', 'submit', 'success', 'close']);
  for (const e of w.dataLayer) { assert.equal(e.business, 'laser'); assert.equal(e.source_page, '/lezeres-szortelenites-budapest'); assert.ok('service_id' in e); }
  assert.equal(w.dataLayer[0].service_id, 'none', 'megnyitaskor meg nincs szolgaltatas');
  assert.equal(w.dataLayer[3].service_id, '444584');
  assert.equal(w.dataLayer[3].load_ms, 742);
  assert.equal(w.dataLayer.at(-1).step, 'C6');
  assert.deepEqual(w.kuldve.at(-1), { url: '/api/foglalo-szamlalo', lepes: 'close', uzletag: 'laser', tipus: 'C6', tipus_hdr: 'text/plain' });
  assert.equal(w.kuldve.find((k) => k.lepes === 'slots_loaded').load_ms, 742);
});

test('minden esemeny mindharom valtozo kulcsot felulirja (load_ms, step, error_type: ertelmezetlen = undefined, a GTM ezt torli): a GTM adatreteg-modellje nem oroktet le ertekeket egyik esemenyrol a masikra', () => {
  const w = ablak({ ana: true, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.open(); m.service(1); m.slotsLoaded(33); m.slot(); m.error('timeout', 'C1'); m.close('C4');
  for (const e of w.dataLayer) for (const k of ['load_ms', 'step', 'error_type']) assert.ok(k in e, `${e.event}: hianyzik a ${k} kulcs`);
  const kulcs = (n) => w.dataLayer.find((e) => e.event === n);
  assert.equal(kulcs('booking_slots_loaded').load_ms, 33); assert.equal(kulcs('booking_slots_loaded').step, undefined);
  assert.deepEqual([kulcs('booking_slot').load_ms, kulcs('booking_slot').step, kulcs('booking_slot').error_type], [undefined, undefined, undefined], 'a booking_slot nem oroklik a korabbi load_ms-t');
  assert.deepEqual([kulcs('booking_error').error_type, kulcs('booking_error').step, kulcs('booking_error').load_ms], ['timeout', undefined, undefined]);
  assert.deepEqual([kulcs('booking_close').step, kulcs('booking_close').error_type, kulcs('booking_close').load_ms], ['C4', undefined, undefined], 'a booking_close nem oroklik a korabbi error_type-ot');
  assert.deepEqual(w.dataLayer.filter((e) => e.event === 'booking_open' || e.event === 'booking_service').map((e) => [e.load_ms, e.step, e.error_type]), [[undefined, undefined, undefined], [undefined, undefined, undefined]]);
});

test('ismetlodo hivasok (ujrarajzolas) nem szamolnak ketszer: open, business, slots_loaded, form_start, submit, success, close, error', () => {
  const w = ablak({ ana: true, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.open(); m.open(); m.business('laser'); m.business('laser'); m.service(1); m.slotsLoaded(10); m.slotsLoaded(20); m.slot();
  m.formStart('a'); m.formStart('a'); m.submit('a'); m.submit('a'); m.success('R'); m.success('R'); m.error('no_slots', 'C1'); m.error('no_slots', 'C1'); m.close('C4'); m.close('C1');
  const db = (n) => lepesek(w).filter((x) => x === n).length;
  for (const n of ['booking_open', 'booking_business', 'booking_slots_loaded', 'booking_form_start', 'booking_submit', 'booking_success', 'booking_error', 'booking_close']) assert.equal(db(n), 1, n);
  assert.equal(w.dataLayer.find((e) => e.event === 'booking_close').step, 'C4', 'az elso bezaras szamit');
  assert.equal(db('booking_service'), 1); assert.equal(db('booking_slot'), 1);
});

test('uj valasztas (masik szolgaltatas / idopont) uj esemeny: a lepes a vendeg valasztasa, nem az ujrarajzolas', () => {
  const w = ablak({ ana: true, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.service(1); m.slotsLoaded(5); m.slot(); m.service(2); m.slotsLoaded(6); m.slot();
  assert.deepEqual(lepesek(w), ['booking_service', 'booking_slots_loaded', 'booking_slot', 'booking_service', 'booking_slots_loaded', 'booking_slot']);
  assert.equal(w.dataLayer[3].service_id, '2');
});

test('hozzajarulas nelkul a dataLayer ures, de a nevtelen szamlalo MINDEN esemenyt megkap', () => {
  const w = ablak({ ana: false, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.open(); m.service(5); m.slotsLoaded(300); m.error('timeout', 'C1'); m.close('C1');
  assert.deepEqual(w.dataLayer, []);
  assert.deepEqual(w.kuldve.map((k) => k.lepes), ['open', 'service', 'slots_loaded', 'error', 'close']);
  assert.equal(w.kuldve[3].tipus, 'timeout');
});

test('a hozzajarulas menet kozben is szamit: az elfogadas elotti lepes nem kerul a dataLayer-be, az utana levo igen', () => {
  const w = ablak({ ana: false, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.open(); w.ana = true; m.service(7);
  assert.deepEqual(lepesek(w), ['booking_service']);
  assert.equal(w.kuldve.length, 2);
});

test('robot (webdriver) nem szamolodik a belso szamlaloba, kiveve a probafuttatas jelzesevel; a dataLayer ettol fuggetlen', () => {
  const r = ablak({ ana: true, webdriver: true }); createStepMeter({ win: r, ctx: ctx() }).open();
  assert.equal(r.kuldve.length, 0, 'webdriver: nincs szamlalo-kuldes (egy eles bejaras ne torzitsa a szamokat)'); assert.equal(r.dataLayer.length, 1);
  const p = ablak({ ana: true, webdriver: true, proba: true }); createStepMeter({ win: p, ctx: ctx() }).open();
  assert.equal(p.kuldve.length, 1);
});

test('sendBeacon hianyaban fetch (keepalive, suti nelkul)', () => {
  const w = ablak({ beacon: false, proba: true }); createStepMeter({ win: w, ctx: ctx() }).open();
  assert.equal(w.kuldve[0].via, 'fetch'); assert.equal(w.kuldve[0].keepalive, true); assert.equal(w.kuldve[0].credentials, 'omit');
});

test('nincs szemelyes adat: a payload kulcsai zartak, a source_page megszurt, ismeretlen uzletag / szolgaltatas-azonosito "none"', () => {
  const w = ablak({ ana: true, proba: true });
  const m = createStepMeter({ win: w, ctx: ctx({ business: 'ismeretlen', sourcePage: '/oldal?email=anna@pelda.hu#x' }) });
  m.open(); m.service('Kovacs Anna 0630123456'); m.slot(); m.success('REF-SECRET'); m.close('C6');
  const engedett = new Set(['event', 'business', 'service_id', 'source_page', 'load_ms', 'step', 'error_type']);
  for (const e of w.dataLayer) for (const k of Object.keys(e)) assert.ok(engedett.has(k), 'nem engedelyezett mezo: ' + k);
  const szoveg = JSON.stringify([w.dataLayer, w.kuldve]);
  for (const tilos of ['anna', 'pelda', 'Kovacs', '0630', 'REF-SECRET', 'email']) assert.ok(!szoveg.includes(tilos), tilos);
  assert.equal(w.dataLayer[0].business, 'none'); assert.equal(w.dataLayer[0].source_page, '/oldal');
  assert.equal(w.dataLayer[1].service_id, 'none');
  const k = Object.keys(w.kuldve[0]).sort(); assert.deepEqual(k, ['lepes', 'tipus_hdr', 'url', 'uzletag']);
});

test('tisztaOldal: csak utvonal; lekerdezes, horgony, @ es furcsa karakter kiszurve', () => {
  assert.equal(tisztaOldal('/paros-headspa-budapest'), '/paros-headspa-budapest');
  assert.equal(tisztaOldal('/szőrtelenítés-zsófi-3'), '/szőrtelenítés-zsófi-3');
  assert.equal(tisztaOldal('/x?a=1'), '/x'); assert.equal(tisztaOldal('/x#y'), '/x');
  for (const rossz of ['http://evil.hu/', 'anna@pelda.hu', '/a b', '/a@b', '', null, undefined, '<script>']) assert.equal(tisztaOldal(rossz), '(direct)', String(rossz));
});

test('a hibatipus a zart listabol valo; ismeretlen = client_error', () => {
  const w = ablak({ ana: true, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.error('valami_mas', 'C1'); m.error('validation', 'A1');
  assert.deepEqual(w.dataLayer.map((e) => e.error_type), ['client_error', 'validation']);
});

test('a regi tracking.js a booking_open / booking_error neveket nem irja a dataLayer-be (egy lepesrol egy esemeny)', () => {
  assert.deepEqual([...RESERVED_BY_STEPS], ['booking_open', 'booking_error']);
  for (const n of RESERVED_BY_STEPS) assert.ok(EVENTS.includes(n));
  const dl = []; const t = createTracker({ ctx: { business: 'laser', sourcePage: '/x', attribution: {} }, dataLayer: dl });
  assert.equal(t.track('booking_open', { entry: 'generic' }), null); assert.equal(t.track('booking_error', { step: 'C1' }), null);
  assert.ok(t.track('booking_service_selected', { service_id: '1' })); assert.deepEqual(dl.map((e) => e.event), ['booking_service_selected']);
});

// --- szerver (nevtelen szamlalo) ------------------------------------------------------------------------------------------------------
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE lepes_szamlalo (nap TEXT NOT NULL, uzletag TEXT NOT NULL, lepes TEXT NOT NULL, tipus TEXT NOT NULL DEFAULT '', db INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (nap, uzletag, lepes, tipus)) WITHOUT ROWID;"
    + 'CREATE TABLE betoltes_szamlalo (nap TEXT NOT NULL, uzletag TEXT NOT NULL, vedro TEXT NOT NULL, db INTEGER NOT NULL DEFAULT 0, ossz_ms INTEGER NOT NULL DEFAULT 0, max_ms INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (nap, uzletag, vedro)) WITHOUT ROWID;');
  const kot = (sql, args = []) => ({ sql, args, run: async () => ({ meta: db.prepare(sql).run(...args) }), all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }) });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
const TOKEN = 'proba-olvaso-kulcs'; const HASH = crypto.createHash('sha256').update(TOKEN).digest('hex');
const ORIGIN = 'https://www.mosaicheadspa.hu';
const post = (body, hdr = {}) => new Request(ORIGIN + '/api/foglalo-szamlalo', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin', ...hdr } });
const get = (q) => new Request(ORIGIN + '/api/foglalo-szamlalo?' + q);
const ido = (iso) => ({ most: () => new Date(iso) });

test('ervenyesit: zart lista; minden mas elutasitva', () => {
  assert.deepEqual(ervenyesit('{"lepes":"open","uzletag":"hair"}'), { ok: true, adat: { lepes: 'open', uzletag: 'hair', tipus: '', loadMs: null } });
  assert.equal(ervenyesit('{"lepes":"slots_loaded","uzletag":"hair","load_ms":99999999}').adat.loadMs, 60000);
  assert.equal(ervenyesit('{"lepes":"error","uzletag":"hair","tipus":"timeout"}').adat.tipus, 'timeout');
  assert.equal(ervenyesit('{"lepes":"close","uzletag":"hair","tipus":"C1"}').adat.tipus, 'C1');
  for (const rossz of ['nem json', '[]', 'null', '{"lepes":"x","uzletag":"hair"}', '{"lepes":"open","uzletag":"kamu"}', '{"lepes":"open","uzletag":"hair","nev":"Anna"}', '{"lepes":"open","uzletag":"hair","tipus":"x"}',
    '{"lepes":"error","uzletag":"hair","tipus":"anna@pelda.hu"}', '{"lepes":"error","uzletag":"hair"}', '{"lepes":"close","uzletag":"hair","tipus":"C1; DROP"}', '{"lepes":"slots_loaded","uzletag":"hair"}',
    '{"lepes":"slots_loaded","uzletag":"hair","load_ms":-1}', '{"lepes":"slots_loaded","uzletag":"hair","load_ms":"12"}', '{"lepes":"open","uzletag":"hair","load_ms":5}']) assert.equal(ervenyesit(rossz).ok, false, rossz);
});

test('POST: a darabszam atomikusan novekszik; a betoltesi ido vedorbe, osszegbe, maximumba kerul; a nap budapesti ido szerint', async () => {
  const D = d1(); const env = { SZAMLALO_DB: D }; const t = ido('2026-10-05T22:30:00Z'); // UTC este = Budapesten mar a kovetkezo nap (10-06, 00:30)
  for (let i = 0; i < 3; i++) assert.equal((await kezel(post({ lepes: 'open', uzletag: 'laser' }), env, t)).status, 204);
  await kezel(post({ lepes: 'slots_loaded', uzletag: 'laser', load_ms: 400 }), env, t);
  await kezel(post({ lepes: 'slots_loaded', uzletag: 'laser', load_ms: 2600 }), env, t);
  await kezel(post({ lepes: 'error', uzletag: 'laser', tipus: 'no_slots' }), env, t);
  await kezel(post({ lepes: 'close', uzletag: 'laser', tipus: 'C1' }), env, t);
  const sorok = D.db.prepare('SELECT * FROM lepes_szamlalo ORDER BY lepes, tipus').all().map((r) => ({ ...r }));
  assert.deepEqual(sorok, [
    { nap: '2026-10-06', uzletag: 'laser', lepes: 'close', tipus: 'C1', db: 1 }, { nap: '2026-10-06', uzletag: 'laser', lepes: 'error', tipus: 'no_slots', db: 1 },
    { nap: '2026-10-06', uzletag: 'laser', lepes: 'open', tipus: '', db: 3 }, { nap: '2026-10-06', uzletag: 'laser', lepes: 'slots_loaded', tipus: '', db: 2 }]);
  const b = D.db.prepare('SELECT * FROM betoltes_szamlalo ORDER BY vedro').all().map((r) => ({ ...r }));
  assert.deepEqual(b, [{ nap: '2026-10-06', uzletag: 'laser', vedro: 'lt500', db: 1, ossz_ms: 400, max_ms: 400 }, { nap: '2026-10-06', uzletag: 'laser', vedro: 'lt5000', db: 1, ossz_ms: 2600, max_ms: 2600 }]);
  assert.equal(napBudapest(new Date('2026-10-05T21:59:00Z')), '2026-10-05'); assert.equal(napBudapest(new Date('2026-10-05T22:00:00Z')), '2026-10-06');
});

test('POST vedelem: idegen eredet 403, rossz tartalom 400, tul nagy 413, nincs D1 kotes: 204 (a foglalo nem akad el), D1 hiba: 204', async () => {
  const D = d1(); const env = { SZAMLALO_DB: D };
  assert.equal((await kezel(post({ lepes: 'open', uzletag: 'hair' }, { origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await kezel(post({ lepes: 'open', uzletag: 'hair' }, { 'sec-fetch-site': 'cross-site' }), env)).status, 403);
  assert.equal((await kezel(post({ lepes: 'open', uzletag: 'kamu' }), env)).status, 400);
  assert.equal((await kezel(post('x'.repeat(2000)), env)).status, 413);
  assert.equal((await kezel(post({ lepes: 'open', uzletag: 'hair' }), {})).status, 204);
  assert.equal((await kezel(post({ lepes: 'open', uzletag: 'hair' }), { SZAMLALO_DB: { prepare() { throw new Error('d1 le'); } } })).status, 204);
  assert.equal(D.db.prepare('SELECT COUNT(*) n FROM lepes_szamlalo').get().n, 0, 'a elutasitott kerelmek nem irnak');
  assert.equal((await kezel(new Request(ORIGIN + '/api/foglalo-szamlalo', { method: 'PUT' }), env)).status, 405);
});

test('POST plafon: egy kulcs napi darabszama nem megy a DB_PLAFON fole', async () => {
  const D = d1(); const env = { SZAMLALO_DB: D };
  D.db.prepare('INSERT INTO lepes_szamlalo VALUES (?,?,?,?,?)').run(napBudapest(), 'hair', 'open', '', DB_PLAFON);
  await kezel(post({ lepes: 'open', uzletag: 'hair' }), env);
  assert.equal(D.db.prepare("SELECT db FROM lepes_szamlalo WHERE lepes='open'").get().db, DB_PLAFON);
});

test('GET: kulcs nelkul / rossz kulccsal 404; jo kulccsal JSON / CSV / HTML osszesites, csak aggregalt szamokkal', async () => {
  const D = d1(); const env = { SZAMLALO_DB: D, SZAMLALO_OLVASO_HASH: HASH }; const t = ido('2026-10-05T10:00:00Z');
  for (const [l, u, tp, ms] of [['open', 'hair'], ['open', 'hair'], ['service', 'hair'], ['slots_loaded', 'hair', '', 500], ['slots_loaded', 'hair', '', 1500], ['close', 'hair', 'C1'], ['error', 'hair', 'no_slots'], ['open', 'laser']]) {
    await kezel(post({ lepes: l, uzletag: u, ...(tp ? { tipus: tp } : {}), ...(ms ? { load_ms: ms } : {}) }), env, t);
  }
  for (const q of ['', 'kulcs=', 'kulcs=rossz', 'nap=2026-10-05']) assert.equal((await kezel(get(q), env, t)).status, 404, q);
  assert.equal((await kezel(get('kulcs=' + TOKEN), { SZAMLALO_DB: D }, t)).status, 404, 'hash nelkul sosem olvashato');
  const r = await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-05'), env, t); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  const j = await r.json();
  assert.deepEqual(j.napok['2026-10-05'].hair, { lepesek: { close: 1, error: 1, open: 2, service: 1, slots_loaded: 2 }, bezaras_lepesenkent: { C1: 1 }, hibak: { no_slots: 1 }, betoltes: { db: 2, atlag_ms: 1000, max_ms: 1500, eloszlas: { lt1000: 1, lt2000: 1 } } });
  assert.equal(j.napok['2026-10-05'].laser.lepesek.open, 1); assert.equal(j.osszesen.hair.lepesek.open, 2);
  const csv = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-05&formatum=csv'), env, t)).text();
  assert.match(csv, /^nap;uzletag;lepes;tipus;darab\n/); assert.match(csv, /2026-10-05;hair;open;;2\n/); assert.match(csv, /2026-10-05;hair;close;C1;1\n/); assert.match(csv, /2026-10-05;hair;error;no_slots;1\n/); assert.match(csv, /2026-10-05;hair;slots_loaded_ms;atlag;1000\n/);
  const html = await (await kezel(get('kulcs=' + TOKEN + '&formatum=html'), env, t)).text();
  assert.match(html, /<h1>Foglaló napi számláló<\/h1>/); assert.match(html, /<td>hair<\/td>/); assert.doesNotMatch(html, /kulcs=/);
  // alapertelmezett idoszak: az utolso 7 nap; hibas / tul hosszu idoszak 400
  assert.equal((await (await kezel(get('kulcs=' + TOKEN), env, t)).json()).tol, '2026-09-29');
  assert.equal((await kezel(get('kulcs=' + TOKEN + '&nap=2026-13-45x'), env, t)).status, 400);
  assert.equal((await kezel(get('kulcs=' + TOKEN + '&tol=2026-01-01&ig=2026-10-05'), env, t)).status, 400);
  assert.equal((await kezel(get('kulcs=' + TOKEN + '&tol=2026-10-05&ig=2026-10-01'), env, t)).status, 400);
});

test('osszeallit / csvbe / htmlbe: ures idoszak is ertelmes', () => {
  const k = osszeallit([], [], '2026-10-01', '2026-10-05');
  assert.deepEqual(k.napok, {}); assert.match(csvbe(k), /^nap;uzletag;lepes;tipus;darab\n$/); assert.match(htmlbe(k), /még nincs adat/);
  assert.ok(LEPESEK.length === 10 && UZLETAGAK.includes('gift') && UZLETAGAK.includes('none'));
});

test('probajeles bongeszo (?proba=1 -> localStorage mhProba): sem GA4, sem szamlalo; ?proba=0 torli a jelet', () => {
  const tar = new Map();
  const ls = { getItem: (k) => (tar.has(k) ? tar.get(k) : null), setItem: (k, v) => tar.set(k, String(v)), removeItem: (k) => tar.delete(k) };
  const w = ablak({ ana: true, proba: true });
  Object.assign(w, { URLSearchParams, localStorage: ls, location: { pathname: '/noi-fodraszat-budapest', search: '?proba=1' } });
  const m = createStepMeter({ win: w, ctx: ctx() }); m.open(); m.business('hair'); m.success('x');
  assert.equal(w.dataLayer.length, 0); assert.equal(w.kuldve.length, 0); assert.equal(tar.get('mhProba'), '1');
  // kesobbi oldalbetoltes parameter nelkul: a jel megmarad
  w.location.search = ''; createStepMeter({ win: w, ctx: ctx() }).open(); assert.equal(w.kuldve.length, 0);
  // ?proba=0: torli, onnantol szamol
  w.location.search = '?proba=0'; createStepMeter({ win: w, ctx: ctx() }).open();
  assert.equal(tar.has('mhProba'), false); assert.equal(w.kuldve.length, 1);
});


// --- hiba-reszlet (DECISION #188, 2026-10-15): a hibatipus mellett nezet-kod + adapter hibakod + HTTP-statusz, csak darabszamkent a belso szamlalonak ---------------------
test('hiba-reszlet: a kliens es a szerver ugyanazt a hibakod-listat es lepes-nevet ismeri; a LEPESEK / ESEMENYEK szerzodes valtozatlan', () => {
  assert.deepEqual(KLIENS_KODOK, SZERVER_KODOK, 'a hibakod-lista egyezik');
  assert.equal(KLIENS_RESZLET, SZERVER_RESZLET); assert.equal(KLIENS_RESZLET, 'error_reszlet');
  assert.equal(LEPESEK.length, 10); assert.ok(!LEPESEK.includes('error_reszlet'), 'a reszlet NEM a lepes-lista tagja (a tolcser-szerkezet valtozatlan)');
  assert.ok(!('error_reszlet' in ESEMENYEK), 'a GA4 esemeny-lista valtozatlan: a reszlet nem megy GA4-be');
});

test('hibaReszlet: zart listak, hianyzo / ismeretlen / hibas ertek biztonsagosan', () => {
  assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'HTTP', status: 503 }), 'salonic_api.C1.HTTP.503');
  assert.equal(hibaReszlet('salonic_api', 'A3', { code: 'SERVICE_NOT_FOUND' }), 'salonic_api.A3.SERVICE_NOT_FOUND.0');
  assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'API_STATUS', status: 'error' }), 'salonic_api.C1.API_STATUS.0', 'szoveges API-statusz nem HTTP-statusz');
  assert.equal(hibaReszlet('timeout', 'C1', { code: 'TIMEOUT' }), 'timeout.C1.TIMEOUT.0');
  assert.equal(hibaReszlet('client_error', 'C1', { code: undefined, status: undefined }), 'client_error.C1.NONE.0');
  assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'MAS_KOD', status: 99 }), 'salonic_api.C1.OTHER.0');
  assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'HTTP', status: 600 }), 'salonic_api.C1.HTTP.0');
  assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'HTTP', status: 404.5 }), 'salonic_api.C1.HTTP.0');
  for (const rossz of [undefined, null, '', 'C1/../x', 'C 1', 'tul_hosszu_nezet_kod', 12]) assert.match(hibaReszlet('salonic_api', rossz, { code: 'HTTP', status: 500 }), /^salonic_api\.ismeretlen\.HTTP\.500$/);
  assert.equal(hibaReszlet('salonic_api', 'C1'), 'salonic_api.C1.OTHER.0', 'kod nelkul a salonic_api OTHER (a NONE csak a client_error-e)');
  assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'NONE', status: 503 }), 'salonic_api.C1.OTHER.0'); assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'TIMEOUT' }), 'salonic_api.C1.OTHER.0');
  assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'PARSE', status: 503 }), 'salonic_api.C1.PARSE.0', 'HTTP-statusz csak HTTP / API_STATUS mellett');
  assert.equal(hibaReszlet('timeout', 'C1', { code: 'HTTP', status: 500 }), 'timeout.C1.TIMEOUT.0'); assert.equal(hibaReszlet('client_error', 'C1', { code: 'HTTP', status: 500 }), 'client_error.C1.NONE.0');
  for (const nincs of ['no_slots', 'validation', 'slot_lost', 'hold_expired', 'verify_failed', 'unknown_redirect', 'callback_failed', 'kamu', undefined]) assert.equal(hibaReszlet(nincs, 'C1', { code: 'HTTP', status: 500 }), null, String(nincs));
  assert.equal(hibaReszlet('salonic_api', 'c1', { code: 'HTTP', status: 500 }), 'salonic_api.ismeretlen.HTTP.500', 'kisbetus nezet-kod nem fogadhato');
});

test('meter.error reszlettel: egy plusz beacon a belso szamlalonak (GA4-be nem), hibankent egyszer; reszlet nelkul / probabol / robotbol nincs', () => {
  const w = ablak({ ana: true }); const m = createStepMeter({ win: w, ctx: ctx({ business: 'oxygen' }) });
  m.service(466147); m.error('salonic_api', 'C1', { code: 'HTTP', status: 503 }); m.error('salonic_api', 'C1', { code: 'HTTP', status: 503 });
  const reszlet = w.kuldve.filter((k) => k.lepes === 'error_reszlet');
  assert.deepEqual(reszlet.map(({ url, lepes, uzletag, tipus }) => ({ url, lepes, uzletag, tipus })), [{ url: '/api/foglalo-szamlalo', lepes: 'error_reszlet', uzletag: 'oxygen', tipus: 'salonic_api.C1.HTTP.503' }], 'hibankent egyszer');
  assert.equal(w.kuldve.filter((k) => k.lepes === 'error').length, 1, 'a regi hiba-beacon valtozatlan, egyszer');
  assert.equal(w.dataLayer.filter((e) => e.event === 'booking_error').length, 1, 'a GA4 hiba-esemeny valtozatlan: egyetlen booking_error');
  assert.ok(!w.dataLayer.some((e) => JSON.stringify(e).includes('HTTP') || JSON.stringify(e).includes('503')), 'a reszlet nem kerul a dataLayer-be');
  // reszlet nelkul (a tobbi hibatipus hivasai) nincs extra beacon
  const w2 = ablak({ ana: true }); const m2 = createStepMeter({ win: w2, ctx: ctx() }); m2.error('no_slots', 'C1'); m2.error('slot_lost', 'C4');
  assert.equal(w2.kuldve.filter((k) => k.lepes === 'error_reszlet').length, 0);
  // robot: semmi nem megy
  const w3 = ablak({ ana: true, webdriver: true }); createStepMeter({ win: w3, ctx: ctx() }).error('salonic_api', 'C1', { code: 'HTTP', status: 500 });
  assert.equal(w3.kuldve.length, 0);
  // probabongeszo (?proba=1): semmi nem megy, a reszlet sem
  const tar = new Map(); const ls = { getItem: (k) => (tar.has(k) ? tar.get(k) : null), setItem: (k, v) => tar.set(k, String(v)), removeItem: (k) => tar.delete(k) };
  const w4 = ablak({ ana: true }); Object.assign(w4, { URLSearchParams, localStorage: ls, location: { pathname: '/x', search: '?proba=1' } });
  createStepMeter({ win: w4, ctx: ctx() }).error('salonic_api', 'C1', { code: 'HTTP', status: 500 });
  assert.equal(w4.kuldve.length, 0); assert.equal(w4.dataLayer.length, 0);
});

test('ervenyesit: hiba-reszlet csak zart alakban fogadhato el; minden mas (URL, szoveg, ismeretlen kod, hibas HTTP, mas lepes mellett) elutasitva', () => {
  const ok = (tipus) => ervenyesit(JSON.stringify({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus }));
  assert.deepEqual(ok('salonic_api.C1.HTTP.503'), { ok: true, adat: { lepes: 'error_reszlet', uzletag: 'oxygen', tipus: 'salonic_api.C1.HTTP.503', loadMs: null } });
  assert.equal(ok('timeout.A3.TIMEOUT.0').ok, true); assert.equal(ok('client_error.ismeretlen.NONE.0').ok, true); assert.equal(ok('salonic_api.C1.API_STATUS.200').ok, true);
  for (const rossz of ['salonic_api.C1.HTTP.99', 'salonic_api.C1.HTTP.600', 'salonic_api.C1.HTTP.5031', 'salonic_api.C1.MAS.503', 'kamu.C1.HTTP.503', 'salonic_api.C1.http.503', 'salonic_api.C1.HTTP',
    'salonic_api.C1.HTTP.503.9', 'salonic_api..HTTP.503', 'salonic_api.tul_hosszu_nezet_kod.HTTP.503', 'salonic_api.C 1.HTTP.503', 'https://api.salonic.hu/x', 'salonic_api', '', 'Salonic_api.C1.HTTP.503',
    'salonic_api.C1.HTTP.503\n', 'salonic_api.C1.HTTP.5e2']) assert.equal(ok(rossz).ok, false, rossz);
  assert.equal(ervenyesit('{"lepes":"error_reszlet","uzletag":"oxygen"}').ok, false, 'tipus nelkul nem');
  assert.equal(ervenyesit('{"lepes":"error_reszlet","uzletag":"oxygen","tipus":"salonic_api.C1.HTTP.503","load_ms":5}').ok, false, 'load_ms nem engedett');
  assert.equal(ervenyesit('{"lepes":"error_reszlet","uzletag":"kamu","tipus":"salonic_api.C1.HTTP.503"}').ok, false);
  assert.equal(ervenyesit('{"lepes":"error","uzletag":"oxygen","tipus":"salonic_api.C1.HTTP.503"}').ok, false, 'a regi error lepes tipusa tovabbra is csak a sima hibatipus');
  assert.equal(ervenyesit('{"lepes":"open","uzletag":"oxygen","tipus":"salonic_api.C1.HTTP.503"}').ok, false);
});

test('POST + GET: a hiba-reszlet D1-be kerul (atomikus novekedes), a kimenetben additiv `hiba_reszlet` kulcs; reszlet nelkuli uzletagnak a kimenete valtozatlan; CSV / HTML', async () => {
  const D = d1(); const env = { SZAMLALO_DB: D, SZAMLALO_OLVASO_HASH: HASH }; const t = ido('2026-10-13T10:00:00Z');
  for (const tipus of ['salonic_api.C1.HTTP.503', 'salonic_api.C1.HTTP.503', 'salonic_api.A3.PARSE.0']) {
    assert.equal((await kezel(post({ lepes: 'error', uzletag: 'oxygen', tipus: 'salonic_api' }), env, t)).status, 204);
    assert.equal((await kezel(post({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus }), env, t)).status, 204);
  }
  await kezel(post({ lepes: 'open', uzletag: 'hair' }), env, t);
  assert.equal((await kezel(post({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus: 'https://x' }), env, t)).status, 400);
  const sorok = D.db.prepare("SELECT lepes, tipus, db FROM lepes_szamlalo WHERE uzletag='oxygen' ORDER BY lepes, tipus").all().map((r) => ({ ...r }));
  assert.deepEqual(sorok, [{ lepes: 'error', tipus: 'salonic_api', db: 3 }, { lepes: 'error_reszlet', tipus: 'salonic_api.A3.PARSE.0', db: 1 }, { lepes: 'error_reszlet', tipus: 'salonic_api.C1.HTTP.503', db: 2 }]);
  const j = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-13'), env, t)).json();
  const ox = j.napok['2026-10-13'].oxygen;
  assert.deepEqual(ox.hibak, { salonic_api: 3 }); assert.deepEqual(ox.hiba_reszlet, { 'salonic_api.A3.PARSE.0': 1, 'salonic_api.C1.HTTP.503': 2 });
  assert.deepEqual(ox.lepesek, { error: 3 }, 'a reszlet nem szamit lepesnek / nem torzitja a tolcsert');
  assert.ok(!('hiba_reszlet' in j.napok['2026-10-13'].hair), 'reszlet nelkuli uzletag kimenete valtozatlan (additiv kulcs)'); assert.ok(!('hiba_reszlet' in j.osszesen.hair));
  assert.deepEqual(j.osszesen.oxygen.hiba_reszlet, ox.hiba_reszlet);
  const csv = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-13&formatum=csv'), env, t)).text();
  assert.match(csv, /2026-10-13;oxygen;error;salonic_api;3\n/); assert.match(csv, /2026-10-13;oxygen;error_reszlet;salonic_api\.C1\.HTTP\.503;2\n/);
  const html = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-13&formatum=html'), env, t)).text();
  assert.match(html, /salonic_api\.C1\.HTTP\.503: 2/); assert.doesNotMatch(html, /error_reszlet/);
});


// --- hiba-reszlet: a fuggetlen review (PASS with notes) utani szigoritasok -------------------------------------------------------------------------------------------
test('hiba-reszlet szigoritasok: kanonikus HTTP (0 vagy 100-599), zart nezet-kod, hibatipus-hibakod parok, HTTP-statusz csak HTTP / API_STATUS mellett', () => {
  const ok = (tipus) => ervenyesit(JSON.stringify({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus })).ok;
  for (const jo of ['salonic_api.C1.HTTP.503', 'salonic_api.A3_SENT.HTTP.0', 'salonic_api.HS1.API_STATUS.200', 'salonic_api.C1.PARSE.0', 'salonic_api.PMU.SERVICE_NOT_FOUND.0', 'salonic_api.LA2B.OTHER.0',
    'salonic_api.ismeretlen.HTTP.404', 'timeout.C1.TIMEOUT.0', 'client_error.A3.NONE.0']) assert.equal(ok(jo), true, jo);
  for (const rossz of [
    'salonic_api.C1.HTTP.000', 'salonic_api.C1.HTTP.00', 'salonic_api.C1.HTTP.050', 'salonic_api.C1.HTTP.099', 'salonic_api.C1.HTTP.600', // nem kanonikus / tartomanyon kivuli http
    'salonic_api.KovacsAnna12.HTTP.503', 'salonic_api.c1.HTTP.503', 'salonic_api.1C.HTTP.503', 'salonic_api._C.HTTP.503', 'salonic_api.Ismeretlen.HTTP.503', 'salonic_api.IsmeretlenX.HTTP.503', // nem a foglalo nezet-kodjanak alakja
    'client_error.C1.HTTP.503', 'timeout.C1.HTTP.503', 'salonic_api.C1.NONE.503', 'salonic_api.C1.NONE.0', 'salonic_api.C1.TIMEOUT.0', 'timeout.C1.NONE.0', 'client_error.C1.TIMEOUT.0', // lehetetlen parok
    'no_slots.C1.PARSE.404', 'no_slots.C1.NONE.0', 'validation.C1.NONE.0', 'slot_lost.C1.NONE.0', // mas hibatipus nem hordoz reszletet
    'salonic_api.C1.PARSE.503', 'salonic_api.C1.SERVICE_NOT_FOUND.404', 'salonic_api.C1.OTHER.500', // HTTP-statusz csak HTTP / API_STATUS kod mellett
  ]) assert.equal(ok(rossz), false, rossz);
});

test('hiba-reszlet: minden, amit a kliens elo tud allitani, a szerver elfogadja (kliens reszhalmaza a szervernek)', () => {
  const hibaTipusMint = (e) => (e && e.code === 'TIMEOUT' ? 'timeout' : e && e.code ? 'salonic_api' : 'client_error'); // engine.js hibaTipus() masolata
  const kodok = [...KLIENS_KODOK, 'valami_mas', 20, undefined, null, '', 0, Symbol('x')];
  const statuszok = [undefined, null, 0, 99, 100, 200, 404, 503, 599, 600, 'error', '503', 503.5, NaN, -1, {}];
  const lepesek = ['A1', 'A1_SENT', 'A2', 'A3', 'A3U', 'A3_CB', 'A3_SENT', 'C1', 'C4', 'C5', 'C6', 'H0', 'HA0', 'HA1', 'HA2', 'HA2B', 'HS1', 'HS2', 'HS3', 'LA1', 'LA2', 'LA2B', 'LA3', 'PMU',
    undefined, null, '', 'c1', 'x y', 'tul_hosszu_nezet_kod_xx', 12, 'KovacsAnna12'];
  let db = 0;
  for (const code of kodok) for (const status of statuszok) for (const step of lepesek) {
    const t = hibaTipusMint({ code }); const tipus = hibaReszlet(t, step, { code, status });
    const v = ervenyesit(JSON.stringify({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus }));
    assert.equal(v.ok, true, `${String(code)} / ${String(status)} / ${String(step)} -> ${tipus}`); db++;
  }
  assert.ok(db > 3000);
});

test('hiba-reszlet: napi plafon a KULONBOZO kulcsok szamara (nap, uzletag) szerint; a meglevo kulcs tovabb novekszik; mas uzletag / nap fuggetlen', async () => {
  assert.equal(RESZLET_KULCS_PLAFON, 100);
  const D = d1(); const env = { SZAMLALO_DB: D }; const t = ido('2026-10-13T10:00:00Z'); const ujIdo = ido('2026-10-14T10:00:00Z');
  const kuld = (tipus, uzletag = 'oxygen', tt = t) => kezel(post({ lepes: 'error_reszlet', uzletag, tipus }), env, tt);
  for (let i = 0; i < RESZLET_KULCS_PLAFON; i++) assert.equal((await kuld(`salonic_api.C${i}.HTTP.503`)).status, 204);
  const db = () => D.db.prepare("SELECT COUNT(*) n FROM lepes_szamlalo WHERE lepes='error_reszlet' AND uzletag='oxygen' AND nap='2026-10-13'").get().n;
  assert.equal(db(), RESZLET_KULCS_PLAFON);
  assert.equal((await kuld('salonic_api.A3.PARSE.0')).status, 204, 'a plafon felett is 204 (a foglalo nem akad el)');
  assert.equal(db(), RESZLET_KULCS_PLAFON, 'az uj kulcs nem kerult be');
  assert.equal(D.db.prepare("SELECT COUNT(*) n FROM lepes_szamlalo WHERE tipus='salonic_api.A3.PARSE.0'").get().n, 0);
  await kuld('salonic_api.C0.HTTP.503'); await kuld('salonic_api.C0.HTTP.503');
  assert.equal(D.db.prepare("SELECT db FROM lepes_szamlalo WHERE tipus='salonic_api.C0.HTTP.503'").get().db, 3, 'a meglevo kulcs a plafon felett is novekszik');
  assert.equal((await kuld('salonic_api.A3.PARSE.0', 'laser')).status, 204); assert.equal(D.db.prepare("SELECT COUNT(*) n FROM lepes_szamlalo WHERE uzletag='laser' AND lepes='error_reszlet'").get().n, 1, 'mas uzletag fuggetlen');
  await kuld('salonic_api.A3.PARSE.0', 'oxygen', ujIdo); assert.equal(D.db.prepare("SELECT COUNT(*) n FROM lepes_szamlalo WHERE uzletag='oxygen' AND nap='2026-10-14' AND lepes='error_reszlet'").get().n, 1, 'masik nap fuggetlen');
  // a plafon a TOBBI lepest nem erinti
  await kezel(post({ lepes: 'error', uzletag: 'oxygen', tipus: 'salonic_api' }), env, t); assert.equal(D.db.prepare("SELECT db FROM lepes_szamlalo WHERE lepes='error' AND uzletag='oxygen'").get().db, 1);
});

test('meter.error furcsa reszlet-ertekkel sem dob, es a kimenet mindig zart alak; nem sztring tipus az error_reszlet lepesnel elutasitva', () => {
  for (const r of ['sz', 5, true, {}, [], { code: Symbol('x') }, { code: 'HTTP', status: '503' }, { code: 20, status: 500 }, { status: 500 }, { code: { toString() { throw new Error('x'); } } }]) {
    const w = ablak({ ana: true }); const m = createStepMeter({ win: w, ctx: ctx({ business: 'oxygen' }) });
    assert.doesNotThrow(() => m.error('salonic_api', 'C1', r), JSON.stringify(r) || String(r));
    for (const k of w.kuldve.filter((x) => x.lepes === 'error_reszlet')) assert.match(k.tipus, /^salonic_api\.C1\.[A-Z_]+\.(0|[1-5][0-9]{2})$/);
  }
  for (const rossz of [5, [], {}, null, true]) assert.equal(ervenyesit(JSON.stringify({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus: rossz })).ok, false, JSON.stringify(rossz));
});

// --- #178: PARSE-bontas (PARSE_EMPTY / NOTHTML / SHORT / NOLIST / JSON) -------------------------------------------------------------------------------------------------
test('hibaReszlet: PARSE-bontas - PARSE + kind -> PARSE_<KIND> (zart lista); ismeretlen / hianyzo kind marad PARSE; mas kodnal a kind figyelmen kivul; HTTP-statusz tovabbra sem', () => {
  for (const k of ['EMPTY', 'NOTHTML', 'SHORT', 'NOLIST', 'JSON']) assert.equal(hibaReszlet('salonic_api', 'OX1', { code: 'PARSE', status: 200, kind: k }), `salonic_api.OX1.PARSE_${k}.0`, k);
  for (const k of [undefined, null, '', 'MAS', 'empty', 12, {}, 'PARSE_SHORT', 'SHORT\n']) assert.equal(hibaReszlet('salonic_api', 'OX1', { code: 'PARSE', kind: k }), 'salonic_api.OX1.PARSE.0', String(k));
  assert.equal(hibaReszlet('salonic_api', 'C1', { code: 'HTTP', status: 503, kind: 'SHORT' }), 'salonic_api.C1.HTTP.503', 'a kind csak PARSE mellett szamit');
  assert.equal(hibaReszlet('salonic_api', 'LA1', { code: 'API_STATUS', status: 200, kind: 'JSON' }), 'salonic_api.LA1.API_STATUS.200');
  assert.equal(hibaReszlet('timeout', 'C1', { code: 'PARSE', kind: 'SHORT' }), 'timeout.C1.TIMEOUT.0');
  assert.equal(hibaReszlet('client_error', 'C1', { code: 'PARSE', kind: 'SHORT' }), 'client_error.C1.NONE.0');
  assert.equal(hibaReszlet('no_slots', 'C1', { code: 'PARSE', kind: 'SHORT' }), null);
});

test('ervenyesit: a PARSE_* kodok csak salonic_api mellett es HTTP-statusz nelkul fogadhatok el; ismeretlen PARSE_* / kisbetus / lezaratlan elutasitva; a kliens es a szerver lista tovabbra is azonos', () => {
  const ok = (tipus) => ervenyesit(JSON.stringify({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus })).ok;
  for (const k of ['EMPTY', 'NOTHTML', 'SHORT', 'NOLIST', 'JSON']) assert.equal(ok(`salonic_api.OX1.PARSE_${k}.0`), true, k);
  for (const rossz of ['salonic_api.OX1.PARSE_SHORT.200', 'salonic_api.OX1.PARSE_SHORT.503', 'timeout.OX1.PARSE_SHORT.0', 'client_error.OX1.PARSE_EMPTY.0', 'salonic_api.OX1.PARSE_MAS.0', 'salonic_api.OX1.PARSE_.0',
    'salonic_api.OX1.PARSE_short.0', 'no_slots.OX1.PARSE_SHORT.0', 'salonic_api.OX1.PARSE_SHORT', 'salonic_api.OX1.PARSE_SHORT.0.0']) assert.equal(ok(rossz), false, rossz);
  assert.deepEqual(KLIENS_KODOK, SZERVER_KODOK);
});

test('hiba-reszlet (PARSE-bontas): minden kind x hibakod x HTTP-statusz x nezet kombinaciot, amit a kliens elo tud allitani, a szerver elfogad', () => {
  const kindok = [undefined, null, 'EMPTY', 'NOTHTML', 'SHORT', 'NOLIST', 'JSON', 'MAS', 12, '', 'SHORT\n'];
  const kodok = ['PARSE', 'HTTP', 'API_STATUS', 'SERVICE_NOT_FOUND', 'OTHER', 'TIMEOUT', undefined, 'valami_mas'];
  const statuszok = [undefined, 0, 200, 404, 503, 600, 'x'];
  const lepesek = ['C1', 'OX1', 'LA1', 'HS1', 'A3', undefined, 'c1', 'x y'];
  let db = 0;
  for (const kind of kindok) for (const code of kodok) for (const status of statuszok) for (const step of lepesek) {
    const t = code === 'TIMEOUT' ? 'timeout' : code ? 'salonic_api' : 'client_error';
    const tipus = hibaReszlet(t, step, { code, status, kind });
    assert.equal(ervenyesit(JSON.stringify({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus })).ok, true, `${String(kind)} / ${String(code)} / ${String(status)} / ${String(step)} -> ${tipus}`); db++;
  }
  assert.ok(db > 3000);
});

test('POST + GET: a PARSE-bontas D1-be kerul, a hiba_reszlet kimenetben es a CSV-ben latszik; a regi PARSE kulcs mellette valtozatlan', async () => {
  const D = d1(); const env = { SZAMLALO_DB: D, SZAMLALO_OLVASO_HASH: HASH }; const t = ido('2026-10-17T10:00:00Z');
  for (const tipus of ['salonic_api.OX1.PARSE_SHORT.0', 'salonic_api.OX1.PARSE_SHORT.0', 'salonic_api.OX1.PARSE_NOLIST.0', 'salonic_api.OX1.PARSE.0']) {
    assert.equal((await kezel(post({ lepes: 'error', uzletag: 'oxygen', tipus: 'salonic_api' }), env, t)).status, 204);
    assert.equal((await kezel(post({ lepes: 'error_reszlet', uzletag: 'oxygen', tipus }), env, t)).status, 204);
  }
  const j = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-17'), env, t)).json();
  const ox = j.napok['2026-10-17'].oxygen;
  assert.deepEqual(ox.hibak, { salonic_api: 4 }); assert.deepEqual(ox.hiba_reszlet, { 'salonic_api.OX1.PARSE.0': 1, 'salonic_api.OX1.PARSE_NOLIST.0': 1, 'salonic_api.OX1.PARSE_SHORT.0': 2 });
  assert.deepEqual(ox.lepesek, { error: 4 }, 'a reszlet nem lepes: a tolcser nem valtozik');
  const csv = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-17&formatum=csv'), env, t)).text();
  assert.match(csv, /2026-10-17;oxygen;error_reszlet;salonic_api\.OX1\.PARSE_SHORT\.0;2\n/);
});

