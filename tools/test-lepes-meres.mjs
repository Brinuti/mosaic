// A foglalo lepes-merese (DECISION-LOG #88): a kliens-modul (assets/js/booking-engine/lepes-meres.js) es a nevtelen szamlalo (netlify/lib/foglalo-szamlalo.js).
//   node --test tools/test-lepes-meres.mjs
// A szamlalo SQL-jet valodi SQLite-on (node:sqlite) futtatjuk, a D1 felulet (prepare / bind / run / all / batch) egy vekony hejon at.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createStepMeter, ESEMENYEK, HIBA_TIPUSOK as KLIENS_HIBAK, RESERVED_BY_STEPS, tisztaOldal } from '../assets/js/booking-engine/lepes-meres.js';
import { createTracker, EVENTS } from '../assets/js/booking-engine/tracking.js';
import { kezel, ervenyesit, napBudapest, osszeallit, csvbe, htmlbe, LEPESEK, UZLETAGAK, HIBA_TIPUSOK as SZERVER_HIBAK, DB_PLAFON } from '../netlify/lib/foglalo-szamlalo.js';

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
