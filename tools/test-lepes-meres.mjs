// A foglalo lepes-merese (DECISION-LOG #88): a kliens-modul (assets/js/booking-engine/lepes-meres.js) es a nevtelen szamlalo (netlify/lib/foglalo-szamlalo.js).
//   node --test tools/test-lepes-meres.mjs
// A szamlalo SQL-jet valodi SQLite-on (node:sqlite) futtatjuk, a D1 felulet (prepare / bind / run / all / batch) egy vekony hejon at.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createStepMeter, ESEMENYEK, HIBA_TIPUSOK as KLIENS_HIBAK, RESERVED_BY_STEPS, tisztaOldal, hibaReszlet, HIBA_KODOK as KLIENS_KODOK, RESZLET_LEPES as KLIENS_RESZLET } from '../assets/js/booking-engine/lepes-meres.js';
import * as K from '../assets/js/booking-engine/lepes-meres.js'; // DECISION #205: az uj zart listak es tiszta fuggvenyek (K.*)
import { createTracker, EVENTS } from '../assets/js/booking-engine/tracking.js';
import { kezel, ervenyesit, napBudapest, osszeallit, csvbe, htmlbe, LEPESEK, UZLETAGAK, HIBA_TIPUSOK as SZERVER_HIBAK, DB_PLAFON, HIBA_KODOK as SZERVER_KODOK, RESZLET_LEPES as SZERVER_RESZLET, RESZLET_KULCS_PLAFON } from '../netlify/lib/foglalo-szamlalo.js';
import * as SZ from '../netlify/lib/foglalo-szamlalo.js'; // DECISION #205: a szerver oldali zart listak (SZ.*)
import { meterNelkul } from './meres-proba/engine-meter-diff.mjs';

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
// DECISION #205: a belso szamlalo uj (csak-meres) lepesei (lepes_bontas, lepes_ido, ...) tobb beaconnak szamitanak; a REGI assertionok a #205 elotti lepesekre szurt nezetet hasonlitjak ossze
// (a vart ertekek valtozatlanok; az uj lepeseket lent a #205 tesztek fedik). A dataLayer (GA4) assertionjai nem szurtek: a GA4 semmit nem kap az uj lepesekbol.
const REGI_LEPESEK = new Set([...LEPESEK, 'error_reszlet']);
const regi = (w) => w.kuldve.filter((k) => REGI_LEPESEK.has(k.lepes));

test('az esemenynevek pontosan a #88 szerintiek', () => {
  assert.deepEqual(Object.values(ESEMENYEK), ['booking_open', 'booking_business', 'booking_service', 'booking_slots_loaded', 'booking_slot', 'booking_form_start', 'booking_submit', 'booking_success', 'booking_close', 'booking_error']);
  assert.deepEqual(KLIENS_HIBAK, SZERVER_HIBAK, 'a kliens es a szerver ugyanazt a hibatipus-listat ismeri');
  assert.deepEqual(Object.keys(ESEMENYEK), LEPESEK, 'a kliens es a szerver ugyanazt a lepes-listat ismeri');
});

test('teljes sikeres ut: minden lepes pontosan egyszer, a parameterek jok, a dataLayer (hozzajarulassal) es a szamlalo is megkapja', () => {
  const w = ablak({ ana: true, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.open(); m.business('laser'); m.service(444584); m.slotsLoaded(742); m.slot(); m.formStart('s1'); m.submit('s1'); m.success('REF-1'); m.close('C6');
  assert.deepEqual(lepesek(w), Object.values(ESEMENYEK).filter((n) => n !== 'booking_error'));
  assert.deepEqual(regi(w).map((k) => k.lepes), ['open', 'business', 'service', 'slots_loaded', 'slot', 'form_start', 'submit', 'success', 'close']);
  for (const e of w.dataLayer) { assert.equal(e.business, 'laser'); assert.equal(e.source_page, '/lezeres-szortelenites-budapest'); assert.ok('service_id' in e); }
  assert.equal(w.dataLayer[0].service_id, 'none', 'megnyitaskor meg nincs szolgaltatas');
  assert.equal(w.dataLayer[3].service_id, '444584');
  assert.equal(w.dataLayer[3].load_ms, 742);
  assert.equal(w.dataLayer.at(-1).step, 'C6');
  assert.deepEqual(regi(w).at(-1), { url: '/api/foglalo-szamlalo', lepes: 'close', uzletag: 'laser', tipus: 'C6', tipus_hdr: 'text/plain' });
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
  assert.deepEqual(regi(w).map((k) => k.lepes), ['open', 'service', 'slots_loaded', 'error', 'close']);
  assert.equal(regi(w)[3].tipus, 'timeout');
});

test('a hozzajarulas menet kozben is szamit: az elfogadas elotti lepes nem kerul a dataLayer-be, az utana levo igen', () => {
  const w = ablak({ ana: false, proba: true }); const m = createStepMeter({ win: w, ctx: ctx() });
  m.open(); w.ana = true; m.service(7);
  assert.deepEqual(lepesek(w), ['booking_service']);
  assert.equal(regi(w).length, 2);
});

test('robot (webdriver) nem szamolodik a belso szamlaloba, kiveve a probafuttatas jelzesevel; a dataLayer ettol fuggetlen', () => {
  const r = ablak({ ana: true, webdriver: true }); createStepMeter({ win: r, ctx: ctx() }).open();
  assert.equal(r.kuldve.length, 0, 'webdriver: nincs szamlalo-kuldes (egy eles bejaras ne torzitsa a szamokat)'); assert.equal(r.dataLayer.length, 1);
  const p = ablak({ ana: true, webdriver: true, proba: true }); createStepMeter({ win: p, ctx: ctx() }).open();
  assert.equal(regi(p).length, 1);
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
  for (const rossz of ['{"lepes":["verify_check"],"uzletag":"hair","tipus":"price"}', '{"lepes":["success_unverified"],"uzletag":"hair"}', '{"lepes":[["lepes_bontas"]],"uzletag":"hair","tipus":"open.google.mobil"}', '{"lepes":5,"uzletag":"hair"}', '{"lepes":{"toString":"open"},"uzletag":"hair"}', '{"lepes":null,"uzletag":"hair"}', '{"uzletag":"hair"}'])
    assert.equal(ervenyesit(rossz).ok, false, 'nem szoveg lepes: ' + rossz);
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
  assert.equal(tar.has('mhProba'), false); assert.equal(regi(w).length, 1);
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


// =====================================================================================================================================================================
// DECISION #205 (2026-10-19, CSAK-MERES): buko ellenorzes kodjai, success_unverified, form_start -> kimenet idovodrok, recovered / A2 minden elofordulas,
// forras / eszkoz / idotartam bontas, C1 szabad idopontok. Minden uj lepes CSAK a belso szamlalonak megy; a GA4 (dataLayer) semmit nem kap belole.
// =====================================================================================================================================================================
const ora = (kezdet = 1_000_000) => { let t = kezdet; const f = () => t; f.mulik = (ms) => { t += ms; }; return f; }; // a meter belso orajanak hamisitasa
const ablak205 = ({ szelesseg = 1280, referrer = '', ...opt } = {}) => Object.assign(ablak({ proba: true, ...opt }), { innerWidth: szelesseg, document: { referrer } });
const UJ_LEPESEK = new Set(K.BELSO_LEPESEK);
const ujak = (w) => w.kuldve.filter((k) => UJ_LEPESEK.has(k.lepes)).map((k) => k.lepes + (k.tipus !== undefined ? ':' + k.tipus : ''));
const ujElemek = (w) => w.kuldve.filter((k) => UJ_LEPESEK.has(k.lepes));
const MA = Date.UTC(2026, 9, 19, 10, 0, 0) / 1000; // 2026-10-19 12:00 Budapest (CEST)
const idopontok = (...ofszetek) => ofszetek.map((o, i) => ({ start_unix: MA + o, staff_id: 111, slot_id: 's' + i }));

test('#205 zart listak: a kliens es a szerver ugyanazt ismeri; a tolcser (LEPESEK) es a GA4-esemenyek listaja valtozatlan; az uj lepesek nem GA4-esemenyek', () => {
  assert.deepEqual(K.VERIFY_KODOK, SZ.VERIFY_KODOK); assert.deepEqual(K.IDO_VODROK, SZ.IDO_VODROK); assert.deepEqual(K.KIMENETEK, SZ.KIMENETEK); assert.deepEqual(K.A2_OKOK, SZ.A2_OKOK);
  assert.deepEqual(K.A2_SORSZAMOK, SZ.A2_SORSZAMOK); assert.deepEqual(K.RECOVERED_KIMENETEK, SZ.RECOVERED_KIMENETEK); assert.deepEqual(K.FORRASOK, SZ.FORRASOK); assert.deepEqual(K.ESZKOZOK, SZ.ESZKOZOK);
  assert.deepEqual(K.BONTAS_LEPESEK, SZ.BONTAS_LEPESEK); assert.deepEqual(K.SZABAD_VODROK, SZ.SZABAD_VODROK); assert.deepEqual(K.ELSO_NAP_VODROK, SZ.ELSO_NAP_VODROK);
  assert.deepEqual(K.IRANYOK, SZ.IRANYOK); assert.deepEqual(K.IRANYOK, ['lt', 'gt', 'eq', 'unknown']); // HS-2
  assert.deepEqual([...K.BELSO_LEPESEK].sort(), Object.keys(SZ.BELSO_205).sort(), 'a kliens es a szerver ugyanazokat a belso lepeseket ismeri');
  assert.equal(LEPESEK.length, 10); for (const l of K.BELSO_LEPESEK) { assert.ok(!LEPESEK.includes(l), l + ' nem tolcser-lepes'); assert.ok(!Object.values(ESEMENYEK).some((n) => n.includes(l)), l + ' nem GA4-esemeny'); }
  assert.deepEqual(K.FORRASOK, ['google', 'meta', 'tiktok', 'egyeb']); assert.deepEqual(K.ESZKOZOK, ['mobil', 'asztali', 'tablet']);
  assert.deepEqual(K.IDO_VODROK.map(([n]) => n), ['lt5s', 'lt30s', 'lt60s', 'lt120s', 'lt300s', 'ge300s']);
  assert.deepEqual(K.VERIFY_KODOK, ['params', 'place', 'service', 'slot', 'staff', 'price', 'no_expectation']);
});

test('#205 idoVodor: a hatarok pontosan (lt5s ... ge300s), negativ / nem szam biztonsagosan', () => {
  const v = K.idoVodor;
  for (const [ms, nev] of [[0, 'lt5s'], [4999, 'lt5s'], [5000, 'lt30s'], [29999, 'lt30s'], [30000, 'lt60s'], [59999, 'lt60s'], [60000, 'lt120s'], [119999, 'lt120s'], [120000, 'lt300s'], [299999, 'lt300s'], [300000, 'ge300s'], [9e9, 'ge300s'], [-50, 'lt5s'], ['4000', 'lt5s']]) assert.equal(v(ms), nev, String(ms));
  for (const rossz of [NaN, undefined, 'x', {}, Infinity * 0]) assert.equal(v(rossz), null, String(rossz));
});

test('#205 eszkozOsztaly: csak szelesseg-kuszob (700 / 1100); ismeretlen = asztali', () => {
  for (const [w, e] of [[320, 'mobil'], [390, 'mobil'], [699, 'mobil'], [700, 'tablet'], [768, 'tablet'], [1099, 'tablet'], [1100, 'asztali'], [1920, 'asztali'], [undefined, 'asztali'], [NaN, 'asztali'], [0, 'asztali'], [-5, 'asztali'], ['500', 'mobil']]) assert.equal(K.eszkozOsztaly(w), e, String(w));
});

test('#205 forrasOsztaly: kattintas-azonosito KULCSA (az erteke sehova), utm_source zart lista, referrer gazdagep; minden mas egyeb', () => {
  const f = (attribution, referrer) => K.forrasOsztaly({ attribution, referrer });
  assert.equal(f({ gclid: 'Cj0KCQ_x' }), 'google'); assert.equal(f({ gbraid: 'abc' }), 'google'); assert.equal(f({ wbraid: 'abc' }), 'google');
  assert.equal(f({ fbclid: 'IwAR_x' }), 'meta'); assert.equal(f({ ttclid: 'E.C.P_x' }), 'tiktok');
  assert.equal(f({ gclid: 'a', fbclid: 'b', ttclid: 'c' }), 'meta', 'tobb azonosito: meta > tiktok > utm_source > google (a Google-azonosito lehet a mentett, 90 napos is: a friss URL-jelek elobbre valok)'); assert.equal(f({ fbclid: 'b', ttclid: 'c' }), 'meta'); assert.equal(f({ gclid: 'a', ttclid: 'c' }), 'tiktok');
  assert.equal(f({ gclid: 'a', utm_source: 'facebook' }), 'meta', 'a mentett Google-azonosito nem veri le a Meta utm_source-t'); assert.equal(f({ gclid: 'a', utm_source: 'newsletter' }), 'google', 'ismeretlen utm_source: marad a Google-azonosito');
  assert.equal(f({ gclid: '', fbclid: '' }), 'egyeb', 'ures ertek nem azonosito'); assert.equal(f({ gclid: 5 }), 'egyeb', 'nem szoveg');
  for (const [u, e] of [['google', 'google'], ['Google', 'google'], ['googleads', 'google'], ['facebook', 'meta'], ['FB', 'meta'], ['ig', 'meta'], ['instagram', 'meta'], ['meta', 'meta'], ['tiktok', 'tiktok'], ['newsletter', 'egyeb'], ['', 'egyeb'], ['constructor', 'egyeb'], ['__proto__', 'egyeb'], ['toString', 'egyeb']]) assert.equal(f({ utm_source: u }), e, 'utm_source=' + u);
  for (const [r, e] of [['https://www.google.com/', 'google'], ['https://google.hu/search?q=head+spa', 'google'], ['https://www.google.co.uk/', 'google'], ['https://l.facebook.com/l.php?u=x', 'meta'], ['https://m.facebook.com/', 'meta'], ['https://l.instagram.com/?u=x', 'meta'],
    ['https://www.tiktok.com/@x', 'tiktok'], ['https://vm.tiktok.com/abc', 'tiktok'], ['https://evilgoogle.com/', 'egyeb'], ['https://google.com.evil.hu/', 'egyeb'], ['https://www.bing.com/', 'egyeb'], ['https://mosaicheadspa.hu/x', 'egyeb'], ['nem url', 'egyeb'], ['', 'egyeb'], [undefined, 'egyeb']]) assert.equal(f({}, r), e, String(r));
  assert.equal(f({ utm_source: 'tiktok' }, 'https://www.google.com/'), 'tiktok', 'az utm_source elobbre valo a referrernel'); assert.equal(f({ fbclid: 'x', utm_source: 'google' }), 'meta', 'a kattintas-azonosito az utm_source elott');
  for (const rossz of [null, undefined, 'x', 5, []]) assert.equal(K.forrasOsztaly({ attribution: rossz }), 'egyeb'); assert.equal(K.forrasOsztaly(), 'egyeb'); assert.equal(K.forrasOsztaly(null), 'egyeb');
});

test('#205 szabadVodor / elsoNapVodor: a zart vodrok hatarai', () => {
  for (const [n, e] of [[0, '0'], [1, '1-3'], [3, '1-3'], [4, '4-10'], [10, '4-10'], [11, '11-30'], [30, '11-30'], [31, '31+'], [999, '31+'], [-1, '0'], [NaN, '0'], [undefined, '0']]) assert.equal(K.szabadVodor(n), e, String(n));
  for (const [n, e] of [[null, 'nincs'], [undefined, 'nincs'], [NaN, 'nincs'], [0, 'ma'], [-1, 'ma'], [1, '1-2'], [2, '1-2'], [3, '3-7'], [7, '3-7'], [8, '8-14'], [14, '8-14'], [15, '15+'], [92, '15+']]) assert.equal(K.elsoNapVodor(n), e, String(n));
});

test('#205 c1Meres: a kovetkezo 7 nap KULONBOZO idopontjai + a legkorabbi szabad nap (budapesti naptari nap), szakember-szuressel; a lista nem modosul', () => {
  const H = 3600; const D = 86400;
  const lista = idopontok(3 * H, 3 * H, D + H, 2 * D, 6 * D, 7 * D, 7 * D + H, 9 * D, -H, 0); // 2 szakember ugyanarra az idopontra (3h) = 1; a mult / a most (0) nem; 7 napon tul (7D+H, 9D) nem
  lista[1].staff_id = 222;
  const eredeti = JSON.stringify(lista);
  assert.deepEqual(K.c1Meres(lista, { nowUnix: MA }), { szabad: '4-10', elso: 'ma' }, 'a 7 nap: 3h, D+H, 2D, 6D, 7D = 5 kulonbozo');
  assert.equal(JSON.stringify(lista), eredeti, 'nem modosul');
  assert.deepEqual(K.c1Meres(lista, { staffId: 222, nowUnix: MA }), { szabad: '1-3', elso: 'ma' }, 'csak a 222-es szakember: 1 idopont');
  assert.deepEqual(K.c1Meres(lista, { staffId: '111', nowUnix: MA }), { szabad: '4-10', elso: 'ma' }, 'a szakember-azonosito szoveg / szam egyertekuek');
  assert.deepEqual(K.c1Meres([], { nowUnix: MA }), { szabad: '0', elso: 'nincs' });
  assert.deepEqual(K.c1Meres(idopontok(8 * D), { nowUnix: MA }), { szabad: '0', elso: '8-14' }, 'a 7 napon tuli elso idopont: 0 a 7 napban, a legkorabbi 8 nap mulva');
  assert.deepEqual(K.c1Meres(idopontok(20 * D), { nowUnix: MA }), { szabad: '0', elso: '15+' });
  assert.deepEqual(K.c1Meres(idopontok(2 * D + H), { nowUnix: MA }), { szabad: '1-3', elso: '1-2' });
  assert.deepEqual(K.c1Meres(idopontok(5 * D), { nowUnix: MA }), { szabad: '1-3', elso: '3-7' });
  // 31+ vodor, a 7. napon (hatar) beleszamit
  assert.equal(K.c1Meres(Array.from({ length: 31 }, (_, i) => ({ start_unix: MA + 60 + i * 60, staff_id: 1 })), { nowUnix: MA }).szabad, '31+');
  // napfordulo: 23:30 Budapest-ido, a kovetkezo idopont 00:30 (1 ora mulva) mar a KOVETKEZO naptari nap
  const este = Date.UTC(2026, 9, 19, 21, 30, 0) / 1000;
  assert.deepEqual(K.c1Meres([{ start_unix: este + 3600, staff_id: 1 }], { nowUnix: este }), { szabad: '1-3', elso: '1-2' });
  assert.deepEqual(K.c1Meres([{ start_unix: este + 1200, staff_id: 1 }], { nowUnix: este }), { szabad: '1-3', elso: 'ma' }, '23:50: meg ugyanaz a (budapesti) nap');
  for (const rossz of [null, undefined, 'x', {}, 5]) assert.equal(K.c1Meres(rossz, { nowUnix: MA }), null);
  assert.equal(K.c1Meres([], { nowUnix: undefined }), null); assert.equal(K.c1Meres([], {}), null);
  assert.deepEqual(K.c1Meres([null, undefined, 5, {}, { start_unix: 'x' }, { start_unix: NaN }, ...idopontok(D)], { nowUnix: MA }), { szabad: '1-3', elso: '1-2' }, 'szemet elemek kihagyva');
});

test('#205 a teljes sikeres ut uj belso lepesei: bontas (lepes.forras.eszkoz), lepes_ido (a megnyitastol), c1, kimenet_ido (form_start -> success); minden uj lepes csak a belso szamlalonak; a GA4 valtozatlan', () => {
  const t = ora(); const w = ablak205({ ana: true, szelesseg: 390 }); const m = createStepMeter({ win: w, ctx: ctx({ attribution: { gclid: 'Cj0KCQ_TITKOS_gclid_0123456789' } }), ido: t });
  m.open(); t.mulik(1000); m.business('laser'); t.mulik(1000); m.service(444584); t.mulik(1000); m.slotsLoaded(742); m.c1(idopontok(3600, 86400 + 3600), null, MA);
  t.mulik(4000); m.slot(); t.mulik(1000); m.formStart('s1'); t.mulik(2000); m.submit('s1'); t.mulik(30000); m.success('REF-1'); m.close('C6');
  assert.deepEqual(ujak(w), [
    'lepes_bontas:open.google.mobil',
    'lepes_bontas:business.google.mobil', 'lepes_ido:business.lt5s',
    'lepes_bontas:service.google.mobil', 'lepes_ido:service.lt5s',
    'lepes_bontas:slots_loaded.google.mobil', 'lepes_ido:slots_loaded.lt5s',
    'c1_szabad:1-3', 'c1_elso_nap:ma',
    'lepes_bontas:slot.google.mobil', 'lepes_ido:slot.lt30s',
    'lepes_bontas:form_start.google.mobil', 'lepes_ido:form_start.lt30s',
    'lepes_bontas:submit.google.mobil', 'lepes_ido:submit.lt30s',
    'lepes_bontas:success.google.mobil', 'lepes_ido:success.lt60s', 'kimenet_ido:success.lt60s', // 40 mp a megnyitastol; 32 mp az adatlaptol
  ]);
  // a regi (#205 elotti) belso lepesek es a GA4 valtozatlanok: ugyanaz, mint a 'teljes sikeres ut' regi tesztjeben
  assert.deepEqual(regi(w).map((k) => k.lepes), ['open', 'business', 'service', 'slots_loaded', 'slot', 'form_start', 'submit', 'success', 'close']);
  assert.deepEqual(lepesek(w), Object.values(ESEMENYEK).filter((n) => n !== 'booking_error'));
  for (const e of w.dataLayer) for (const k of Object.keys(e)) assert.ok(new Set(['event', 'business', 'service_id', 'source_page', 'load_ms', 'step', 'error_type']).has(k), 'nem engedelyezett GA4 mezo: ' + k);
  assert.ok(!JSON.stringify(w.dataLayer).match(/lepes_bontas|lepes_ido|kimenet_ido|google|mobil|c1_|recovered|verify_check|success_unverified|a2_/), 'a GA4 az uj lepesekbol semmit nem kap');
  // minden uj beacon kulcsa zart, az uzletag a meter uzletaga
  for (const k of ujElemek(w)) { assert.deepEqual(Object.keys(k).filter((x) => !['url', 'tipus_hdr', 'via', 'keepalive', 'credentials'].includes(x)).sort(), k.tipus === undefined ? ['lepes', 'uzletag'] : ['lepes', 'tipus', 'uzletag']); assert.equal(k.uzletag, 'laser'); }
  assert.ok(!JSON.stringify(w.kuldve).includes('TITKOS') && !JSON.stringify(w.kuldve).includes('Cj0KCQ'), 'az azonosito erteke sehova nem megy');
});

test('#205 kimenet_ido: csak ha volt form_start; minden adatlap-megjelenes ujrainditja; az idovodor a hatarokon; a kimenet utan a kiindulas torlodik', () => {
  const t = ora(); const w = ablak205(); const m = createStepMeter({ win: w, ctx: ctx(), ido: t });
  m.success('NINCS-FORM-START'); // form_start nelkul: nincs kimenet_ido
  assert.deepEqual(ujak(w).filter((x) => x.startsWith('kimenet_ido')), []);
  m.formStart('a'); t.mulik(299999); m.success('R1');
  m.formStart('b'); t.mulik(300000); m.success('R2');
  m.formStart('c'); t.mulik(4999); m.success('R3');
  m.success('R4'); // masodik kimenet ugyanarra a form_startra: nincs (a kiindulas torlodott)
  m.formStart('d'); t.mulik(60000); m.formStart('d'); t.mulik(1000); m.success('R5'); // ujra megjelent az adatlap (ugyanaz a slot): az utolso megjelenestol szamol
  assert.deepEqual(ujak(w).filter((x) => x.startsWith('kimenet_ido')), ['kimenet_ido:success.lt300s', 'kimenet_ido:success.ge300s', 'kimenet_ido:success.lt5s', 'kimenet_ido:success.lt5s']);
  // c4_close: csak a C4-ben, csak ha volt form_start
  const w2 = ablak205(); const t2 = ora(); const m2 = createStepMeter({ win: w2, ctx: ctx(), ido: t2 });
  m2.formStart('a'); t2.mulik(45000); m2.close('C4');
  assert.deepEqual(ujak(w2).filter((x) => x.startsWith('kimenet_ido')), ['kimenet_ido:c4_close.lt60s']);
  const w3 = ablak205(); const m3 = createStepMeter({ win: w3, ctx: ctx(), ido: ora() }); m3.formStart('a'); m3.close('C1');
  assert.deepEqual(ujak(w3).filter((x) => x.startsWith('kimenet_ido')), [], 'nem C4: nincs c4_close');
  const w4 = ablak205(); createStepMeter({ win: w4, ctx: ctx(), ido: ora() }).close('C4');
  assert.deepEqual(ujak(w4).filter((x) => x.startsWith('kimenet_ido')), [], 'form_start nelkul: nincs c4_close');
  assert.equal(w2.kuldve.filter((k) => k.lepes === 'close').length, 1, 'a regi close beacon valtozatlan');
});

test('#205 unverified (a verify-bukas ellenere letrejott foglalas): success_unverified + egy verify_check minden buko ellenorzesre; a verify_failed hiba MARAD; a GA4 nem kap uj esemenyt; egyszer foglalasonkent', () => {
  const t = ora(); const w = ablak205({ ana: true }); const m = createStepMeter({ win: w, ctx: ctx(), ido: t });
  m.service(7); m.formStart('s1'); t.mulik(12000);
  const v = { ok: false, checks: { params: { status: 'fail', expected: null, actual: 'hianyzik: price' }, place: { status: 'pass' }, service: { status: 'fail', expected: '7', actual: 'Kovacs Anna 0630123456' }, slot: { status: 'pass' },
    staff: { status: 'skipped', expected: 'barki', actual: 'anna@pelda.hu' }, price: { status: 'fail', expected: '9900', actual: 5000 }, kamu: { status: 'fail' } }, bookingRef: 'REF-SECRET-1' };
  m.error('verify_failed', 'C5'); m.unverified(v, 's1'); m.unverified(v, 's1'); m.error('verify_failed', 'C5');
  assert.deepEqual(ujak(w).filter((x) => /^(success_unverified|verify_check|kimenet_ido)/.test(x)),
    ['success_unverified', 'verify_check:params', 'verify_check:service', 'verify_check:price', 'kimenet_ido:success_unverified.lt30s', 'kimenet_ido:verify_failed.lt30s'], 'egyszer; az ismeretlen ellenorzes (kamu) es a nem bukott (pass / skipped) kimarad');
  assert.ok(ujak(w).includes('lepes_bontas:success_unverified.egyeb.asztali') && ujak(w).includes('lepes_ido:success_unverified.lt30s'));
  assert.equal(w.kuldve.filter((k) => k.lepes === 'error' && k.tipus === 'verify_failed').length, 1, 'a verify_failed hiba-szamlalas valtozatlan (egyszer-kapu)');
  assert.deepEqual(lepesek(w).filter((n) => n !== 'booking_service' && n !== 'booking_form_start'), ['booking_error'], 'GA4: csak a mar meglevo booking_error (verify_failed); semmi uj');
  assert.equal(w.dataLayer.find((e) => e.event === 'booking_error').error_type, 'verify_failed');
  const szoveg = JSON.stringify(w.kuldve); for (const tilos of ['Kovacs', 'Anna', '0630', 'pelda', 'REF-SECRET', '9900', 'hianyzik']) assert.ok(!szoveg.includes(tilos), tilos);
  // nem volt mit ellenorizni (S.expected hianya): no_expectation; igazolt (ok): semmi; masik idopont: uj foglalas
  const w2 = ablak205(); const m2 = createStepMeter({ win: w2, ctx: ctx(), ido: ora() });
  m2.unverified(null, 'x'); m2.unverified({ ok: true, checks: {} }, 'y'); m2.unverified(undefined, 'x');
  assert.deepEqual(ujak(w2).filter((x) => /^(success_unverified|verify_check)/.test(x)), ['success_unverified', 'verify_check:no_expectation']);
  m2.unverified({ ok: false, checks: { slot: { status: 'fail' }, staff: { status: 'fail' }, place: { status: 'fail' } } }, 'z');
  assert.deepEqual(ujak(w2).filter((x) => /^verify_check/.test(x)), ['verify_check:no_expectation', 'verify_check:slot', 'verify_check:staff', 'verify_check:place']);
  // hibas bemenet nem dob
  for (const rossz of [{}, { ok: false }, { ok: false, checks: null }, { ok: false, checks: 'x' }, { ok: false, checks: { params: null } }, 5, 'x', []]) assert.doesNotThrow(() => createStepMeter({ win: ablak205(), ctx: ctx(), ido: ora() }).unverified(rossz, 'k'));
  // success_unverified a foglalas-osszeghez: a sikeres (igazolt) foglalas nem unverified
  const w3 = ablak205(); const m3 = createStepMeter({ win: w3, ctx: ctx(), ido: ora() }); m3.success('R'); m3.unverified({ ok: true }, 's');
  assert.ok(!ujak(w3).some((x) => x.startsWith('success_unverified') || x.startsWith('verify_check')));
});

test('#205 A2: a belso szamlalo MINDEN elofordulast szamol sorszammal (a GA4 / a regi error egyszer-kapuja valtozatlan); jelzes nelkuli ujrarajzolas nem szamit; az ok nem orokodik (a motor S.a2Reason-jabol sem)', () => {
  const t = ora(); const w = ablak205({ ana: true }); const m = createStepMeter({ win: w, ctx: ctx(), ido: t }); m.service(7);
  const a2 = (ok, hibaTipus, ms = 800) => { m.formStart('s' + Math.random()); t.mulik(ms); m.a2Ok(ok); m.error(hibaTipus, 'C4'); };
  a2('taken', 'slot_lost'); a2('taken', 'slot_lost'); a2('expired', 'hold_expired', 290000); a2('taken', 'slot_lost'); a2('taken', 'slot_lost'); a2('taken', 'slot_lost');
  assert.deepEqual(ujak(w).filter((x) => x.startsWith('a2_elofordulas')), ['a2_elofordulas:slot_lost.1', 'a2_elofordulas:slot_lost.2', 'a2_elofordulas:hold_expired.3', 'a2_elofordulas:slot_lost.4', 'a2_elofordulas:slot_lost.ge5', 'a2_elofordulas:slot_lost.ge5']);
  assert.deepEqual(ujak(w).filter((x) => x.startsWith('kimenet_ido')), ['kimenet_ido:slot_lost.lt5s', 'kimenet_ido:slot_lost.lt5s', 'kimenet_ido:hold_expired.lt300s', 'kimenet_ido:slot_lost.lt5s', 'kimenet_ido:slot_lost.lt5s', 'kimenet_ido:slot_lost.lt5s']);
  assert.equal(w.kuldve.filter((k) => k.lepes === 'error').length, 2, 'a regi belso error-beacon egyszer-kapuja valtozatlan: slot_lost 1x + hold_expired 1x');
  assert.deepEqual(w.dataLayer.filter((e) => e.event === 'booking_error').map((e) => e.error_type), ['slot_lost', 'hold_expired'], 'a GA4 egyszer-kapuja valtozatlan');
  // ujrarajzolas (pl. bongeszo vissza gomb): a motor ujra hivja a meter.error-t, de a2Ok NINCS: nem uj elofordulas
  const elotte = ujak(w).length; m.error('slot_lost', 'C4'); m.error('hold_expired', 'C4'); assert.equal(ujak(w).length, elotte);
  // a2Ok hasznalat utan nullazodik: a kovetkezo jelzes nelkuli error nem hasznalja fel ujra
  m.a2Ok('taken'); m.error('slot_lost', 'C4'); const uj1 = ujak(w).length; m.error('slot_lost', 'C4'); assert.equal(ujak(w).length, uj1);
  // az A2-t a Salonic elkelt-jelzese nyitotta ('redirect'), de a motor S.a2Reason-je egy korabbi lejaratbol 'expired' maradt (hibas hold_expired a motorban): a belso szamlalo slot_lost-ot szamol
  const w2 = ablak205({ ana: true }); const m2 = createStepMeter({ win: w2, ctx: ctx(), ido: ora() }); m2.service(7);
  m2.a2Ok('expired'); m2.error('hold_expired', 'C4'); m2.a2Ok('redirect'); m2.error('hold_expired' /* a motor korabbi, hibas hozzarendelese */, 'C4');
  assert.deepEqual(ujak(w2).filter((x) => x.startsWith('a2_elofordulas')), ['a2_elofordulas:hold_expired.1', 'a2_elofordulas:slot_lost.2']);
  // dupla ertesites (pl. ketszer megerkezo atiranyitas-jelzes): ugyanaz az ok, 2 mp-en belul, uj adatlap-megjelenes nelkul = NEM uj elofordulas; 2 mp utan / uj form_start utan igen
  const t4 = ora(); const w4 = ablak205({ ana: true }); const m4 = createStepMeter({ win: w4, ctx: ctx(), ido: t4 }); m4.service(7);
  m4.formStart('d1'); t4.mulik(800); m4.a2Ok('redirect'); m4.error('slot_lost', 'C4'); t4.mulik(300); m4.a2Ok('redirect'); m4.error('slot_lost', 'C4'); t4.mulik(300); m4.a2Ok('redirect'); m4.error('slot_lost', 'C4');
  assert.deepEqual(ujak(w4).filter((x) => x.startsWith('a2_elofordulas')), ['a2_elofordulas:slot_lost.1'], 'a gyors dupla / tripla ertesites egy elofordulas');
  t4.mulik(2500); m4.a2Ok('redirect'); m4.error('slot_lost', 'C4');
  assert.deepEqual(ujak(w4).filter((x) => x.startsWith('a2_elofordulas')), ['a2_elofordulas:slot_lost.1', 'a2_elofordulas:slot_lost.2'], '2 mp utan ugyanaz az ok mar uj elofordulas');
  m4.formStart('d2'); t4.mulik(100); m4.a2Ok('redirect'); m4.error('slot_lost', 'C4');
  assert.equal(ujak(w4).filter((x) => x.startsWith('a2_elofordulas')).length, 3, 'uj adatlap-megjelenes utan azonnal is uj elofordulas');
  // ismeretlen jelzes (null / szemet): semmi
  for (const jel of [null, undefined, 'x', 5, {}]) { const w3 = ablak205(); const m3 = createStepMeter({ win: w3, ctx: ctx(), ido: ora() }); m3.a2Ok(jel); m3.error('slot_lost', 'C4'); assert.deepEqual(ujak(w3).filter((x) => x.startsWith('a2_')), [], String(jel)); }
});

test('HS-2 price_irany: a bukott price-ellenorzes iranya (lt / gt / eq / unknown) zart nevkent; csak price-bukasnal; osszeg / szolgaltatas nem megy ki; hibaturo', () => {
  const pi = K.priceIrany;
  // a jelentett ar a vart (+ elfogadott) arakhoz kepest
  assert.equal(pi({ expected: '26900', actual: 24900 }), 'lt'); assert.equal(pi({ expected: '26900', actual: 29900 }), 'gt');
  assert.equal(pi({ expected: '26900 / 39900', actual: 19900 }), 'lt'); assert.equal(pi({ expected: '26900 / 39900', actual: 49900 }), 'gt');
  assert.equal(pi({ expected: '26900 / 39900', actual: 30000 }), 'unknown', 'ket elfogadott ar KOZOTT: nem allapithato meg');
  assert.equal(pi({ expected: '26900', actual: 26900 }), 'eq'); assert.equal(pi({ expected: '26900 / 39900', actual: 39900 }), 'eq');
  assert.equal(pi({ expected: '26900', actual: '29900' }), 'gt', 'szam-szoveg is ertelmezheto');
  for (const rossz of [undefined, null, {}, { expected: null, actual: 5 }, { expected: '26900', actual: null }, { expected: '26900' }, { expected: 'abc', actual: 5 }, { expected: '', actual: 5 }, { expected: '26900', actual: 'x' },
    { expected: '26900', actual: NaN }, { expected: '26900', actual: Infinity }, { expected: '26900', actual: '1e9' }, { expected: '26900', actual: '12345678901' }, 5, 'x', []]) assert.equal(pi(rossz), 'unknown', JSON.stringify(rossz));
  assert.doesNotThrow(() => pi({ get expected() { throw new Error('x'); }, actual: 1 })); assert.equal(pi({ get expected() { throw new Error('x'); }, actual: 1 }), 'unknown');
  // a meter: csak a price-bukasnal kuld price_irany-t; a tobbi bukasnal / igazolt / null v nem; egyszer foglalasonkent; az osszeg SOHA nem kerul a kuldott torzsbe
  const w = ablak205(); const m = createStepMeter({ win: w, ctx: ctx(), ido: ora() });
  m.unverified({ ok: false, checks: { price: { status: 'fail', expected: '26900', actual: 39900 }, slot: { status: 'fail' } } }, 's1'); m.unverified({ ok: false, checks: { price: { status: 'fail', expected: '26900', actual: 39900 } } }, 's1');
  assert.deepEqual(ujak(w).filter((x) => /^(verify_check|price_irany)/.test(x)), ['verify_check:price', 'verify_check:slot', 'price_irany:gt']);
  assert.equal(ujak(w).filter((x) => x === 'price_irany:gt').length, 1, 'egyszer foglalasonkent');
  const w2 = ablak205(); const m2 = createStepMeter({ win: w2, ctx: ctx(), ido: ora() });
  m2.unverified({ ok: false, checks: { slot: { status: 'fail' }, price: { status: 'pass', expected: '1', actual: 2 } } }, 'a'); m2.unverified(null, 'b'); m2.unverified({ ok: true, checks: { price: { status: 'fail' } } }, 'c');
  m2.unverified({ ok: false, checks: { price: { status: 'skipped', expected: null, actual: 5 } } }, 'd');
  assert.ok(!ujak(w2).some((x) => x.startsWith('price_irany')), 'nem price-bukas: nincs irany');
  const w3 = ablak205(); const m3 = createStepMeter({ win: w3, ctx: ctx(), ido: ora() });
  m3.unverified({ ok: false, checks: { price: { status: 'fail', expected: '26900', actual: null } } }, 'e'); m3.unverified({ ok: false, checks: { price: { status: 'fail', expected: '26900', actual: 24900 } } }, 'f');
  assert.deepEqual(ujak(w3).filter((x) => x.startsWith('price_irany')), ['price_irany:unknown', 'price_irany:lt']);
  assert.ok(!JSON.stringify(w3.dataLayer).match(/price_irany|verify_check/), 'a GA4 nem kap uj esemenyt');
  assert.ok(!/\d{4,}/.test(JSON.stringify(w3.kuldve)), 'osszeg (4+ szamjegy) nem kerul a kuldott torzsbe');
  // a meter hibaja sosem akadalyozza a foglalast
  for (const v of [{ ok: false, get checks() { throw new Error('c'); } }, { ok: false, checks: { price: { status: 'fail', get expected() { throw new Error('e'); }, actual: 1 } } }]) assert.doesNotThrow(() => createStepMeter({ win: ablak205(), ctx: ctx(), ido: ora() }).unverified(v, 'z'));
});

test('#205 recovered: A2 utan sikeres foglalas (success / success_unverified), ulesenkent egyszer; A2 nelkul vagy A2 ELOTT nincs; az A2 oka a tipusban', () => {
  const w = ablak205(); const m = createStepMeter({ win: w, ctx: ctx(), ido: ora() });
  m.success('ELSO'); // A2 elott: nem helyreallt
  m.a2Ok('taken'); m.error('slot_lost', 'C4'); m.a2Ok('expired'); m.error('hold_expired', 'C4');
  m.success('MASODIK'); m.success('HARMADIK'); m.unverified({ ok: false, checks: { slot: { status: 'fail' } } }, 'u');
  assert.deepEqual(ujak(w).filter((x) => x.startsWith('recovered')), ['recovered:hold_expired.success'], 'egyszer, az utolso A2 okaval');
  const w2 = ablak205(); const m2 = createStepMeter({ win: w2, ctx: ctx(), ido: ora() });
  m2.a2Ok('redirect'); m2.error('slot_lost', 'C4'); m2.unverified({ ok: false, checks: { price: { status: 'fail' } } }, 'u'); m2.success('X');
  assert.deepEqual(ujak(w2).filter((x) => x.startsWith('recovered')), ['recovered:slot_lost.success_unverified']);
  const w3 = ablak205(); const m3 = createStepMeter({ win: w3, ctx: ctx(), ido: ora() }); m3.success('A'); m3.success('B'); m3.a2Ok('taken'); m3.error('slot_lost', 'C4');
  assert.deepEqual(ujak(w3).filter((x) => x.startsWith('recovered')), [], 'A2 csak a siker UTAN: nincs');
  const w4 = ablak205(); const m4 = createStepMeter({ win: w4, ctx: ctx(), ido: ora() }); m4.error('slot_lost', 'C4'); m4.success('A'); // jelzes nelkuli error: nem A2-nyitas
  assert.deepEqual(ujak(w4).filter((x) => x.startsWith('recovered')), []);
});

test('#205 c1: csak a belso szamlalonak, egyszer (szolgaltatas, szakember) szerint; szemet bemenet nem dob', () => {
  const w = ablak205({ ana: true }); const m = createStepMeter({ win: w, ctx: ctx(), ido: ora() }); m.service(1);
  const sl = idopontok(7200, 90000, 90000 + 3600);
  m.c1(sl, null, MA); m.c1(sl, null, MA); m.c1(sl, '111', MA); m.service(2); m.c1(sl, null, MA);
  assert.deepEqual(ujak(w).filter((x) => x.startsWith('c1_')), ['c1_szabad:1-3', 'c1_elso_nap:ma', 'c1_szabad:1-3', 'c1_elso_nap:ma', 'c1_szabad:1-3', 'c1_elso_nap:ma']);
  assert.equal(w.dataLayer.filter((e) => /c1/.test(e.event)).length, 0);
  const w2 = ablak205(); const m2 = createStepMeter({ win: w2, ctx: ctx(), ido: ora(MA * 1000) });
  m2.c1(idopontok(100), null, undefined); // nowUnix nelkul: a meter belso orajabol
  assert.deepEqual(ujak(w2).filter((x) => x.startsWith('c1_')), ['c1_szabad:1-3', 'c1_elso_nap:ma']);
  for (const rossz of [null, undefined, 'x', {}, [null], [{ start_unix: 'x' }]]) assert.doesNotThrow(() => createStepMeter({ win: ablak205(), ctx: ctx(), ido: ora() }).c1(rossz, null, MA));
  m2.c1(idopontok(100), null, MA); // ugyanaz a (szolgaltatas, szakember): nem szamol ujra
});

test('#205 forras / eszkoz a beaconokban: a kontextus (attribution) es a referrer alapjan, csak a kategorianev; az azonosito, a referrer-URL, az utm sehova nem megy', () => {
  const futtat = ({ attribution, referrer, szelesseg }) => { const w = ablak205({ szelesseg, referrer }); const m = createStepMeter({ win: w, ctx: ctx({ attribution }), ido: ora() }); m.open(); return { w, bontas: ujak(w).find((x) => x.startsWith('lepes_bontas:')) }; };
  assert.equal(futtat({ attribution: { fbclid: 'IwAR_TITKOS_0123' }, szelesseg: 800 }).bontas, 'lepes_bontas:open.meta.tablet');
  assert.equal(futtat({ attribution: { ttclid: 'E.C.P_TITKOS' }, szelesseg: 400 }).bontas, 'lepes_bontas:open.tiktok.mobil');
  assert.equal(futtat({ attribution: { gbraid: '0AAAAA_TITKOS' }, szelesseg: 1440 }).bontas, 'lepes_bontas:open.google.asztali');
  const r = futtat({ attribution: { utm_source: 'newsletter-anna@pelda.hu', utm_campaign: 'TITKOS-kampany' }, referrer: 'https://www.google.com/search?q=Kovacs+Anna+0630123456', szelesseg: 1440 });
  assert.equal(r.bontas, 'lepes_bontas:open.google.asztali', 'referrer: google'); const szoveg = JSON.stringify(r.w.kuldve);
  for (const tilos of ['Kovacs', 'Anna', '0630', 'pelda', 'newsletter', 'search', 'TITKOS', 'kampany', 'www.google.com']) assert.ok(!szoveg.includes(tilos), tilos);
  assert.equal(futtat({ attribution: {}, szelesseg: undefined }).bontas, 'lepes_bontas:open.egyeb.asztali', 'ismeretlen szelesseg: asztali; nincs forras: egyeb');
  // a regi tesztek ablak-mockja (nincs document / innerWidth): egyeb / asztali, nem dob
  const w = ablak({ proba: true }); createStepMeter({ win: w, ctx: ctx(), ido: ora() }).open(); assert.ok(ujak(w).includes('lepes_bontas:open.egyeb.asztali'));
});

test('#205 proba (?proba=1 / mhProba), robot (webdriver) es hozzajarulas-mentes ag: a proba / robot egy uj beacont sem kuld; hozzajarulas nelkul a belso szamlalo az ujakat is megkapja, a dataLayer ures', () => {
  const forgatokonyv = (w) => {
    const t = ora(); const m = createStepMeter({ win: w, ctx: ctx(), ido: t });
    m.open(); m.business('laser'); m.service(5); m.slotsLoaded(100); m.c1(idopontok(3600), null, MA); m.slot(); m.formStart('a'); t.mulik(9000); m.submit('a');
    m.unverified({ ok: false, checks: { price: { status: 'fail' } } }, 'a'); m.a2Ok('taken'); m.error('slot_lost', 'C4'); m.success('R'); m.close('C4');
  };
  const robot = ablak205({ ana: true, webdriver: true }); robot.proba = undefined; delete robot.__MH_SZAMLALO_PROBA; forgatokonyv(robot);
  assert.equal(robot.kuldve.length, 0, 'robot: semmi nem megy a belso szamlaloba'); assert.ok(robot.dataLayer.length > 0, 'a dataLayer ettol fuggetlen');
  const tar = new Map(); const ls = { getItem: (k) => (tar.has(k) ? tar.get(k) : null), setItem: (k, v) => tar.set(k, String(v)), removeItem: (k) => tar.delete(k) };
  const pr = ablak205({ ana: true }); Object.assign(pr, { URLSearchParams, localStorage: ls, location: { pathname: '/x', search: '?proba=1' } }); forgatokonyv(pr);
  assert.equal(pr.kuldve.length, 0, 'probabongeszo: semmi'); assert.equal(pr.dataLayer.length, 0);
  const hj = ablak205({ ana: false }); forgatokonyv(hj);
  assert.deepEqual(hj.dataLayer, [], 'hozzajarulas nelkul a dataLayer ures'); assert.ok(ujElemek(hj).length > 10, 'a belso szamlalo hozzajarulas nelkul is megkapja az ujakat: ' + ujElemek(hj).length);
});

test('#205 hibatures: a meres hibaja (beacon dob, ora dob, ablak-mezok dobnak, szemet bemenet) SOHA nem dob ki a hivonak', () => {
  const hibas = ablak205({ ana: true });
  hibas.navigator = { sendBeacon() { throw new Error('beacon'); } }; hibas.fetch = () => { throw new Error('fetch'); };
  Object.defineProperty(hibas, 'innerWidth', { get() { throw new Error('szelesseg'); } }); Object.defineProperty(hibas, 'document', { get() { throw new Error('document'); } });
  const dobo = () => { throw new Error('ora'); };
  for (const [win, ido] of [[hibas, ora()], [ablak205({ ana: true }), dobo], [ablak205({ ana: true }), () => 'nem szam'], [null, ora()], [{}, ora()]]) {
    assert.doesNotThrow(() => {
      const m = createStepMeter({ win, ctx: ctx({ attribution: { get gclid() { throw new Error('attr'); } } }), ido });
      m.open(); m.business('laser'); m.service(1); m.slotsLoaded(1); m.c1([{ get start_unix() { throw new Error('slot'); } }], null, MA); m.slot(); m.formStart('a'); m.submit('a'); m.unverified({ get ok() { throw new Error('v'); } }, 'a');
      m.unverified({ ok: false, get checks() { throw new Error('checks'); } }, 'b'); m.a2Ok('taken'); m.error('slot_lost', 'C4'); m.success('R'); m.close('C4'); m.a2Ok(); m.c1(); m.unverified();
    });
  }
  // a dobo ora mellett is megy a GA4 (a hozzajarulasos dataLayer a regi uton)
  const w = ablak205({ ana: true }); const m = createStepMeter({ win: w, ctx: ctx(), ido: dobo }); m.open(); m.service(3);
  assert.deepEqual(lepesek(w), ['booking_open', 'booking_service']);
});

test('#205 kliens reszhalmaza a szervernek: veletlen (de determinisztikus) hivassorozatokbol minden beacon, a regi es az uj is, elfogadhato a szervernek (ervenyesit)', () => {
  let mag = 12345; const vel = (n) => { mag = (mag * 1103515245 + 12345) & 0x7fffffff; return mag % n; }; const valaszt = (l) => l[vel(l.length)];
  const attrib = [{}, { gclid: 'g1' }, { gbraid: 'g' }, { fbclid: 'f' }, { ttclid: 't' }, { utm_source: 'facebook' }, { utm_source: 'zzz' }, { utm_source: 'toString' }];
  const referrerek = ['', 'https://google.com/', 'https://l.instagram.com/x', 'https://www.tiktok.com/', 'https://x.hu/?a=anna@pelda.hu', 'rossz'];
  const szelessegek = [undefined, 320, 699, 700, 1099, 1100, 3000]; const hibak = [...K_HIBAK_TIPUSOK(), 'kamu']; const lepesek205 = ['C1', 'C4', 'C5', 'A2', 'x', 'C 4', undefined];
  const vs = [null, undefined, { ok: true }, { ok: false, checks: { params: { status: 'fail' }, place: { status: 'fail' }, service: { status: 'fail' }, slot: { status: 'fail' }, staff: { status: 'fail' }, price: { status: 'fail' }, zzz: { status: 'fail' } } }];
  let db = 0;
  for (let futas = 0; futas < 400; futas++) {
    const t = ora(); const w = ablak205({ ana: vel(2) === 0, szelesseg: valaszt(szelessegek), referrer: valaszt(referrerek) });
    const m = createStepMeter({ win: w, ctx: ctx({ business: valaszt(['laser', 'hair', 'oxygen', 'headspa', 'pmu', 'kamu']), attribution: valaszt(attrib) }), ido: t });
    for (let i = 0; i < 30; i++) {
      t.mulik(valaszt([0, 1, 4999, 5000, 29999, 60000, 119999, 300000, 99999999]));
      valaszt([() => m.open(), () => m.business(valaszt(['laser', 'hair', 'x'])), () => m.service(valaszt([1, 'a b', null])), () => m.slotsLoaded(valaszt([5, 99999, -1, 'x'])), () => m.slot(), () => m.formStart('s' + vel(3)),
        () => m.submit('s' + vel(3)), () => m.success('R' + vel(3)), () => m.error(valaszt(hibak), valaszt(lepesek205), valaszt([undefined, { code: 'HTTP', status: 503 }, { code: 'X' }])), () => m.close(valaszt(lepesek205)),
        () => m.unverified(valaszt(vs), 's' + vel(3)), () => m.a2Ok(valaszt(['taken', 'expired', 'redirect', null, 'x'])), () => m.c1(Array.from({ length: vel(40) }, (_, k) => ({ start_unix: MA + vel(10 * 86400) - 3600 * k, staff_id: vel(3) })), valaszt([null, '0', '1']), MA)])();
    }
    for (const k of w.kuldve) { const { url, tipus_hdr, via, keepalive, credentials, ...torzs } = k; const v = ervenyesit(JSON.stringify(torzs)); assert.equal(v.ok, true, JSON.stringify(torzs) + ' -> ' + v.miert); db++; }
  }
  assert.ok(db > 3000, 'tobb mint 3000 beacon ellenorizve: ' + db);
});
function K_HIBAK_TIPUSOK() { return [...KLIENS_HIBAK]; }

// --- szerver: ervenyesites, tarolas, plafon, riport -----------------------------------------------------------------------------------------------------------------
const szorzat = (...listak) => listak.reduce((a, l) => a.flatMap((x) => l.map((y) => [...x, y])), [[]]);
test('#205 ervenyesit: PONTOSAN a zart tipusok fogadhatok el (kimerito: minden lepesre a teljes ter), minden mas elutasitva', () => {
  const ok = (lepes, tipus, extra = {}) => ervenyesit(JSON.stringify({ lepes, uzletag: 'hair', ...(tipus === undefined ? {} : { tipus }), ...extra })).ok;
  const ido = SZ.IDO_VODROK.map(([n]) => n);
  const ter = {
    verify_check: SZ.VERIFY_KODOK.map((x) => x), kimenet_ido: szorzat(SZ.KIMENETEK, ido).map((x) => x.join('.')), recovered: szorzat(SZ.A2_OKOK, SZ.RECOVERED_KIMENETEK).map((x) => x.join('.')),
    a2_elofordulas: szorzat(SZ.A2_OKOK, SZ.A2_SORSZAMOK).map((x) => x.join('.')), lepes_bontas: szorzat(SZ.BONTAS_LEPESEK, SZ.FORRASOK, SZ.ESZKOZOK).map((x) => x.join('.')),
    lepes_ido: szorzat(SZ.BONTAS_LEPESEK.filter((l) => l !== 'open'), ido).map((x) => x.join('.')), c1_szabad: [...SZ.SZABAD_VODROK], c1_elso_nap: [...SZ.ELSO_NAP_VODROK], price_irany: [...SZ.IRANYOK],
  };
  assert.deepEqual(Object.fromEntries(Object.entries(ter).map(([k, v]) => [k, v.length])), { verify_check: 7, kimenet_ido: 36, recovered: 4, a2_elofordulas: 10, lepes_bontas: 108, lepes_ido: 48, c1_szabad: 5, c1_elso_nap: 6, price_irany: 4 });
  for (const [lepes, lista] of Object.entries(ter)) for (const t of lista) assert.equal(ok(lepes, t), true, lepes + ' ' + t);
  assert.equal(ok('success_unverified'), true);
  // minden (lepes, tipus) kombinacio, ami NEM a sajat zart teret adja: elutasitva
  for (const [lepes, lista] of Object.entries(ter)) for (const [masik, mLista] of Object.entries(ter)) if (masik !== lepes) for (const t of mLista) if (!lista.includes(t)) assert.equal(ok(lepes, t), false, `${lepes} nem fogadhat el: ${t}`);
  const rosszak = ['', ' ', 'x', 'params ', ' params', 'PARAMS', 'params\n', 'a.b', '1', '0', 'lt5s', 'success', '..', '.', 'success.', '.lt5s', 'success..lt5s', 'success.lt5s.', 'success.lt5s.x', 'Success.lt5s', 'success.LT5S', 'success.lt5s\n',
    'slot_lost.0', 'slot_lost.6', 'slot_lost.01', 'slot_lost.1.1', 'slot_lost.ge4', 'slot_lost.GE5', 'open.google', 'open.google.mobil.x', 'open.Google.mobil', 'open.google.Mobil', 'open.facebook.mobil', 'open.google.phone', 'close.google.mobil', 'error.google.mobil',
    '1-3 ', '01-3', '1–3', '31', '31+ ', '+31', '3-7 ', '15', 'ma ', 'Ma', 'holnap', '0 ', '00', 'anna@pelda.hu', 'https://x.hu', "1'; DROP TABLE lepes_szamlalo;--", '__proto__', 'constructor', 'toString'];
  for (const lepes of Object.keys(ter)) for (const t of rosszak) if (!ter[lepes].includes(t)) assert.equal(ok(lepes, t), false, `${lepes} ${JSON.stringify(t)}`);
  for (const nem of [5, null, [], {}, true, 1.5]) for (const lepes of Object.keys(ter)) assert.equal(ok(lepes, nem), false, lepes + ' ' + JSON.stringify(nem));
  assert.equal(ok('lepes_bontas', 'x'.repeat(5000)), false);
  // a success_unverified-nek nincs tipusa / load_ms-e; a tobbinek nincs load_ms-e; hianyzo tipus nem fogadhato
  assert.equal(ok('success_unverified', 'x'), false); assert.equal(ok('success_unverified', ''), false); assert.equal(ok('success_unverified', undefined, { load_ms: 5 }), false);
  for (const lepes of Object.keys(ter)) { assert.equal(ok(lepes, undefined), false, lepes + ' tipus nelkul'); assert.equal(ok(lepes, ter[lepes][0], { load_ms: 5 }), false, lepes + ' load_ms-sel'); assert.equal(ok(lepes, ter[lepes][0], { nev: 'Anna' }), false); }
  // prototipus-nevek mint lepes; ismeretlen uzletag
  for (const lepes of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'success_unverified ', 'SUCCESS_UNVERIFIED', 'recovered2', 'lepes_bontas.x']) assert.equal(ervenyesit(JSON.stringify({ lepes, uzletag: 'hair' })).ok, false, lepes);
  assert.equal(ervenyesit(JSON.stringify({ lepes: 'lepes_bontas', uzletag: 'kamu', tipus: 'open.google.mobil' })).ok, false);
  assert.deepEqual(ervenyesit(JSON.stringify({ lepes: 'kimenet_ido', uzletag: 'hair', tipus: 'success.lt5s' })), { ok: true, adat: { lepes: 'kimenet_ido', uzletag: 'hair', tipus: 'success.lt5s', loadMs: null } });
  assert.deepEqual(ervenyesit(JSON.stringify({ lepes: 'success_unverified', uzletag: 'laser' })), { ok: true, adat: { lepes: 'success_unverified', uzletag: 'laser', tipus: '', loadMs: null } });
  // a regi ervenyesites valtozatlan (a regi kliens tovabbra is elfogadott): ugyanazok az elfogadott / elutasitott alakok
  assert.equal(ervenyesit('{"lepes":"open","uzletag":"hair"}').ok, true); assert.equal(ervenyesit('{"lepes":"error","uzletag":"hair","tipus":"timeout"}').ok, true); assert.equal(ervenyesit('{"lepes":"close","uzletag":"hair","tipus":"C1"}').ok, true);
  assert.equal(ervenyesit('{"lepes":"open","uzletag":"hair","tipus":"x"}').ok, false); assert.equal(ervenyesit('{"lepes":"error_reszlet","uzletag":"oxygen","tipus":"salonic_api.C1.HTTP.503"}').ok, true);
});

test('#205 POST + D1: az uj lepesek a lepes_szamlalo tablaba kerulnek (seema-valtozas nelkul), atomikus novekedessel; kulcsszam-plafon lepesenkent; a tobbi lepest / uzletagat / napot nem erinti', async () => {
  assert.equal(SZ.BELSO_KULCS_PLAFON, 150); assert.ok(SZ.BELSO_KULCS_PLAFON >= 108, 'a plafon nem szuk a legnagyobb zart ternel (108): torvenyes forgalmat sosem vagna');
  const D = d1(); const env = { SZAMLALO_DB: D }; const t = ido('2026-10-19T10:00:00Z');
  const kuld = (lepes, tipus, uzletag = 'hair', tt = t) => kezel(post({ lepes, uzletag, ...(tipus === undefined ? {} : { tipus }) }), env, tt);
  for (let i = 0; i < 3; i++) assert.equal((await kuld('success_unverified')).status, 204);
  await kuld('verify_check', 'price'); await kuld('verify_check', 'price'); await kuld('lepes_bontas', 'open.google.mobil'); await kuld('lepes_ido', 'slot.lt30s');
  assert.equal((await kuld('verify_check', 'kamu')).status, 400); assert.equal((await kuld('success_unverified', 'x')).status, 400);
  const sorok = D.db.prepare("SELECT lepes, tipus, db FROM lepes_szamlalo WHERE uzletag='hair' ORDER BY lepes, tipus").all().map((r) => ({ ...r }));
  assert.deepEqual(sorok, [{ lepes: 'lepes_bontas', tipus: 'open.google.mobil', db: 1 }, { lepes: 'lepes_ido', tipus: 'slot.lt30s', db: 1 }, { lepes: 'success_unverified', tipus: '', db: 3 }, { lepes: 'verify_check', tipus: 'price', db: 2 }]);
  // plafon: (nap, uzletag, lepes) szerint legfeljebb BELSO_KULCS_PLAFON kulonbozo kulcs (kozvetlen beszurassal feltoltve: a zart ter ennel kisebb, igy a vedelem csak tartalek)
  const ins = D.db.prepare('INSERT INTO lepes_szamlalo VALUES (?,?,?,?,?)');
  for (let i = 0; i < SZ.BELSO_KULCS_PLAFON - 1; i++) ins.run('2026-10-19', 'oxygen', 'lepes_bontas', 'kamu' + i, 1);
  const db = (l, u = 'oxygen', n = '2026-10-19') => D.db.prepare('SELECT COUNT(*) n FROM lepes_szamlalo WHERE lepes=? AND uzletag=? AND nap=?').get(l, u, n).n;
  assert.equal((await kuld('lepes_bontas', 'form_start.google.mobil', 'oxygen')).status, 204); assert.equal(db('lepes_bontas'), SZ.BELSO_KULCS_PLAFON, 'a plafonig (150.) az uj kulcs bekerul');
  assert.equal((await kuld('lepes_bontas', 'business.meta.tablet', 'oxygen')).status, 204, 'a plafon felett is 204 (a foglalo nem akad el)'); assert.equal(db('lepes_bontas'), SZ.BELSO_KULCS_PLAFON, 'a plafon feletti uj kulcs nem kerult be');
  ins.run('2026-10-19', 'oxygen', 'lepes_bontas', 'open.egyeb.asztali', 1); // (kozvetlen beszuras: a meglevo kulcs a plafon felett is novekedjen)
  await kuld('lepes_bontas', 'open.egyeb.asztali', 'oxygen'); await kuld('lepes_bontas', 'open.egyeb.asztali', 'oxygen');
  assert.equal(D.db.prepare("SELECT db FROM lepes_szamlalo WHERE tipus='open.egyeb.asztali' AND uzletag='oxygen'").get().db, 3, 'a meglevo kulcs a plafon felett is novekszik');
  assert.equal((await kuld('lepes_ido', 'slot.lt5s', 'oxygen')).status, 204); assert.equal(db('lepes_ido'), 1, 'masik lepes fuggetlen');
  assert.equal((await kuld('lepes_bontas', 'business.meta.tablet', 'laser')).status, 204); assert.equal(db('lepes_bontas', 'laser'), 1, 'masik uzletag fuggetlen');
  await kuld('lepes_bontas', 'business.meta.tablet', 'oxygen', ido('2026-10-20T10:00:00Z')); assert.equal(db('lepes_bontas', 'oxygen', '2026-10-20'), 1, 'masik nap fuggetlen');
  assert.equal((await kuld('success_unverified', undefined, 'oxygen')).status, 204); assert.equal(D.db.prepare("SELECT db FROM lepes_szamlalo WHERE lepes='success_unverified' AND uzletag='oxygen'").get().db, 1, 'a tipus nelkuli lepes nem kulcsszam-plafonos');
  // DB_PLAFON a darabszamra tovabbra is ervenyes
  D.db.prepare('INSERT INTO lepes_szamlalo VALUES (?,?,?,?,?)').run('2026-10-19', 'pmu', 'kimenet_ido', 'success.lt5s', DB_PLAFON); await kuld('kimenet_ido', 'success.lt5s', 'pmu');
  assert.equal(D.db.prepare("SELECT db FROM lepes_szamlalo WHERE uzletag='pmu' AND lepes='kimenet_ido'").get().db, DB_PLAFON);
  // a regi lepesek (error_reszlet, open, ...) ugyanugy mukodnek
  assert.equal((await kuld('open')).status, 204); assert.equal((await kuld('error_reszlet', 'salonic_api.C1.HTTP.503')).status, 204);
});

test('#205 GET riport: additiv kulcsok (a meglevo kimenet valtozatlan), foglalas_osszes = success + success_unverified; CSV / HTML', async () => {
  const D = d1(); const env = { SZAMLALO_DB: D, SZAMLALO_OLVASO_HASH: HASH }; const t = ido('2026-10-19T10:00:00Z');
  const kuld = (lepes, tipus, uzletag = 'hair') => kezel(post({ lepes, uzletag, ...(tipus === undefined ? {} : { tipus }) }), env, t);
  // csak a regi lepesek: a kimenet kulcsai valtozatlanok (nincs foglalas_osszes, nincs uj kulcs)
  await kuld('open', undefined, 'laser'); await kuld('service', undefined, 'laser'); await kuld('error', 'no_slots', 'laser');
  const regiJ = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-19'), env, t)).json();
  assert.deepEqual(Object.keys(regiJ.napok['2026-10-19'].laser).sort(), ['betoltes', 'bezaras_lepesenkent', 'hibak', 'lepesek']);
  assert.ok(!('foglalas_osszes' in regiJ.napok['2026-10-19'].laser));
  // sikerek + nem igazolt + az uj lepesek
  for (let i = 0; i < 5; i++) await kuld('success'); for (let i = 0; i < 2; i++) await kuld('success_unverified');
  for (const [l, tp, n] of [['verify_check', 'price', 2], ['verify_check', 'params', 1], ['kimenet_ido', 'success.lt30s', 3], ['kimenet_ido', 'slot_lost.lt5s', 1], ['recovered', 'slot_lost.success', 1], ['a2_elofordulas', 'slot_lost.1', 2], ['a2_elofordulas', 'slot_lost.2', 1],
    ['lepes_bontas', 'open.google.mobil', 4], ['lepes_bontas', 'open.egyeb.asztali', 6], ['lepes_ido', 'slot.lt60s', 2], ['c1_szabad', '4-10', 3], ['c1_elso_nap', 'ma', 2]]) for (let i = 0; i < n; i++) await kuld(l, tp);
  await kuld('success_unverified', undefined, 'oxygen'); // masik uzletag: csak nem igazolt
  const j = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-19'), env, t)).json(); const h = j.napok['2026-10-19'].hair;
  assert.equal(h.lepesek.success, 5); assert.ok(!('success_unverified' in h.lepesek) && !('verify_check' in h.lepesek) && !('lepes_bontas' in h.lepesek), 'az uj lepesek NEM kerulnek a tolcser (lepesek) objektumba');
  assert.equal(h.foglalas_osszes, 7); assert.equal(h.success_unverified, 2);
  assert.deepEqual(h.verify_check, { params: 1, price: 2 }); assert.deepEqual(h.kimenet_ido, { 'slot_lost.lt5s': 1, 'success.lt30s': 3 }); assert.deepEqual(h.recovered, { 'slot_lost.success': 1 }); assert.deepEqual(h.a2_elofordulas, { 'slot_lost.1': 2, 'slot_lost.2': 1 });
  assert.deepEqual(h.lepes_bontas, { 'open.egyeb.asztali': 6, 'open.google.mobil': 4 }); assert.deepEqual(h.lepes_ido, { 'slot.lt60s': 2 }); assert.deepEqual(h.c1_szabad, { '4-10': 3 }); assert.deepEqual(h.c1_elso_nap, { ma: 2 });
  assert.equal(j.napok['2026-10-19'].oxygen.foglalas_osszes, 1); assert.equal(j.osszesen.hair.foglalas_osszes, 7); assert.deepEqual(j.napok['2026-10-19'].laser, regiJ.napok['2026-10-19'].laser, 'az uj adat nelkuli uzletag kimenete valtozatlan');
  const csv = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-19&formatum=csv'), env, t)).text();
  assert.match(csv, /2026-10-19;hair;success;;5\n/); assert.match(csv, /2026-10-19;hair;success_unverified;;2\n/); assert.match(csv, /2026-10-19;hair;verify_check;price;2\n/); assert.match(csv, /2026-10-19;hair;lepes_bontas;open\.google\.mobil;4\n/);
  assert.match(csv, /2026-10-19;hair;kimenet_ido;success\.lt30s;3\n/); assert.match(csv, /2026-10-19;hair;foglalas_osszes;;7\n/); assert.match(csv, /2026-10-19;laser;open;;1\n/); assert.doesNotMatch(csv, /laser;foglalas_osszes/);
  assert.ok(csv.startsWith('nap;uzletag;lepes;tipus;darab\n'));
  const html = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-19&formatum=html'), env, t)).text();
  assert.match(html, /Bővített mérés \(DECISION #205\)/); assert.match(html, /<td>hair<\/td>/); assert.match(html, /open\.google\.mobil: 4/); assert.match(html, /<td><small>7<\/small><\/td>/); assert.doesNotMatch(html, /kulcs=/);
  // regi adat: a HTML-ben nincs bovitett tabla
  const regiH = htmlbe(osszeallit([{ nap: '2026-10-05', uzletag: 'hair', lepes: 'open', tipus: '', db: 2 }], [], '2026-10-05', '2026-10-05')); assert.doesNotMatch(regiH, /Bővített/);
  // osszeallit: tobb nap, osszesen; szemet lepes-nev (nem #205, nem regi) tovabbra is a regi uton (lepesek) kerul be
  const k = osszeallit([{ nap: '2026-10-18', uzletag: 'hair', lepes: 'success', tipus: '', db: 3 }, { nap: '2026-10-19', uzletag: 'hair', lepes: 'success_unverified', tipus: '', db: 1 }, { nap: '2026-10-19', uzletag: 'hair', lepes: 'lepes_ido', tipus: 'slot.lt5s', db: 4 }], [], '2026-10-18', '2026-10-19');
  assert.equal(k.osszesen.hair.foglalas_osszes, 4); assert.equal(k.napok['2026-10-18'].hair.foglalas_osszes, 3); assert.equal(k.napok['2026-10-19'].hair.foglalas_osszes, 1);
});

test('#205 a regi kliens (csak #205 elotti lepesek) a bovitett szerveren valtozatlanul mukodik: ugyanazok a tarolt sorok es a riport', async () => {
  const D = d1(); const env = { SZAMLALO_DB: D, SZAMLALO_OLVASO_HASH: HASH }; const t = ido('2026-10-19T10:00:00Z');
  for (const [l, u, tp, ms] of [['open', 'hair'], ['open', 'hair'], ['service', 'hair'], ['slots_loaded', 'hair', '', 500], ['close', 'hair', 'C1'], ['error', 'hair', 'no_slots'], ['error_reszlet', 'hair', 'salonic_api.C1.HTTP.503']]) await kezel(post({ lepes: l, uzletag: u, ...(tp ? { tipus: tp } : {}), ...(ms ? { load_ms: ms } : {}) }), env, t);
  const j = await (await kezel(get('kulcs=' + TOKEN + '&nap=2026-10-19'), env, t)).json();
  assert.deepEqual(j.napok['2026-10-19'].hair, { lepesek: { close: 1, error: 1, open: 2, service: 1, slots_loaded: 1 }, bezaras_lepesenkent: { C1: 1 }, hibak: { no_slots: 1 }, betoltes: { db: 1, atlag_ms: 500, max_ms: 500, eloszlas: { lt1000: 1 } }, hiba_reszlet: { 'salonic_api.C1.HTTP.503': 1 } });
});

test('#205 meterNelkul (a statikus motor-ellenorzes eszkoze): a meter.* hivasokat es a megjegyzeseket kitorli, mast nem; sztringek / sablonok / regexek erintetlenek', () => {
  const eredmeny = (s) => meterNelkul(s);
  assert.equal(eredmeny("a(); meter.open(); b(); // megj"), 'a(); b();');
  assert.equal(eredmeny("if (x) { y = 1; meter.error(t(e), s, { code: e && e.code }); go('A2'); }"), "if (x) { y = 1; go('A2'); }");
  assert.equal(eredmeny("x = 'meter.open()'; y = \"meter.close(')')\"; z = `meter.x(${a})`;"), "x = 'meter.open()'; y = \"meter.close(')')\"; z = `meter.x(${a})`;", 'sztringben nem nyul');
  assert.equal(eredmeny("const re = /meter\\.x\\(/; q = 1 / 2; r = 'https://a.hu';"), "const re = /meter\\.x\\(/; q = 1 / 2; r = 'https://a.hu';");
  assert.equal(eredmeny("parameter.foo(1); xmeter.a(); this.meter.b(); meter.c(\n  1,\n  ')'\n);\nend();"), 'parameter.foo(1); xmeter.a(); this.meter.b(); end();', 'csak a onallo meter.nev( hivas');
  assert.equal(eredmeny("a; /* blokk meter.x() */ b; meter.f(g(1), h(`)${')'}`)); c;"), 'a; b; c;');
  assert.equal(eredmeny("else meter.error('v', 'C5'); // k\n meter.unverified(v, S.slot && S.slot.slot_id); // k2\nif (!ok) track();"), 'else if (!ok) track();');
  // negativ kontroll: egy uj nem-meter utasitas / ag / idozito a kimenetben marad (a kulonbseg kimutathato)
  const alap = "if (a) { go('A2'); } meter.x();"; assert.notEqual(meterNelkul(alap), meterNelkul("if (a) { go('A2'); win.setTimeout(f, 1); } meter.x();")); assert.notEqual(meterNelkul(alap), meterNelkul("if (a) { go('A3'); } meter.x();"));
  assert.equal(meterNelkul(alap), meterNelkul("if (a) { meter.y(1); go('A2'); }\n// uj megjegyzes\n meter.x(); meter.z();"));
  assert.throws(() => meterNelkul("meter.x(1, 2"), /lezaratlan/);
});
