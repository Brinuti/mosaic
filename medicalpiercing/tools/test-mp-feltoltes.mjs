// MP Google Ads ARNYEK foglalas-feltoltes (lib/meres/google-ads.js, lib/meres/lanc.js, functions/api/mp-foglalas.js).
// Google-hivas NINCS: minden kimeno keres egy mock fetch-be fut. A D1-et a node:sqlite utanozza.
//   node --test tools/test-mp-feltoltes.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MP_GADS, akciokFoglalashoz, hozzajarulas, kattintasValaszt, konverzio, apiTorzs, zapierTorzs, kuldes, elesKuldesE, szallitoValaszt, googleIdo, _tokenTorles } from '../lib/meres/google-ads.js';
import { foglalasErkezes, admin, bemenet, _semaTorles } from '../lib/meres/lanc.js';
import { onRequest } from '../functions/api/mp-foglalas.js';

// --- D1-utanzat ---
function d1() {
  const s = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => { const r = s.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
    first: async () => s.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: s.prepare(sql).all(...args).map((o) => ({ ...o })) }),
  });
  return { _s: s, prepare: (sql) => stmt(sql), batch: async (l) => { const o = []; for (const x of l) o.push(await x.run()); return o; } };
}

const GCLID = 'Cj0KCQjwTESZTgclid_0123456789abcdef';
const MOST = 1791700000;
const BURL = (place = 12169, emp = 555, start = 1791800000, svc = 9001) => `https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=${place}&serviceId=${svc}&employeeId=${emp}&startDate=${start}`;
const SUTI_IGEN = 'cookieyes-consent=' + encodeURIComponent('consentid:abc,consent:yes,action:yes,necessary:yes,functional:yes,analytics:yes,performance:yes,advertisement:yes,other:yes');
const SUTI_NEM = 'cookieyes-consent=' + encodeURIComponent('consentid:abc,consent:no,action:yes,necessary:yes,functional:no,analytics:no,performance:no,advertisement:no,other:no');
const API_ENV = { GOOGLE_ADS_DEVELOPER_TOKEN: 'dev-TITOK', GOOGLE_ADS_CLIENT_ID: 'cid', GOOGLE_ADS_CLIENT_SECRET: 'csec-TITOK', GOOGLE_ADS_REFRESH_TOKEN: 'rt-TITOK' };

function mockFetch(valasz = {}) {
  const hivasok = [];
  const f = async (url, o = {}) => {
    hivasok.push({ url: String(url), o });
    if (String(url).startsWith('https://oauth2.googleapis.com/')) return new Response(JSON.stringify({ access_token: 'at-TITOK', expires_in: 3600 }), { status: 200 });
    return new Response(JSON.stringify(valasz.torzs ?? { results: [{}] }), { status: valasz.status ?? 200 });
  };
  f.hivasok = hivasok;
  return f;
}
const keres = (torzs, { cookie = SUTI_IGEN, host = 'www.medicalpiercing.hu' } = {}) => new Request(`https://${host}/api/mp-foglalas`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(torzs) });
const alapTorzs = (extra = {}) => ({ ut: '/foglalas-ok-mi', p: { bookingUrl: BURL(), price: '24900', first_booking: 'true', ...extra }, kattintas: { gclid: { ertek: GCLID, ido: MOST - 3600 } } });

test('akciok: mindig Foglalas + uj VAGY visszatero; csak az MP ARNYEK akciok', () => {
  assert.deepEqual(akciokFoglalashoz(true), ['7834926162', '7834926165']);
  assert.deepEqual(akciokFoglalashoz(false), ['7834926162', '7834926168']);
  assert.deepEqual(akciokFoglalashoz(null), ['7834926162']);
  assert.equal(MP_GADS.customerId, '2626380837');
  assert.match(konverzio({ kulcs: 'k', letrehozva: MOST, kattintas: { tipus: 'gclid', ertek: GCLID } }, '7825199989', { hozzajarulasHirdetes: true }).tiltva, /nem MP/, 'Mosaic ARNYEK akcio tiltva');
  assert.throws(() => apiTorzs([{ conversionAction: 'customers/6088874770/conversionActions/7834926162' }]), /tiltott/, 'Mosaic fiok tiltva');
  assert.throws(() => apiTorzs([{ conversionAction: 'customers/2626380837/conversionActions/111' }]), /tiltott/);
});

test('hozzajarulas: CookieYes suti; dontes nelkul / elutasitva nincs', () => {
  assert.deepEqual(hozzajarulas(SUTI_IGEN), { dontott: true, hirdetes: true, analitika: true });
  assert.deepEqual(hozzajarulas(SUTI_NEM), { dontott: true, hirdetes: false, analitika: false });
  assert.deepEqual(hozzajarulas(''), { dontott: false, hirdetes: false, analitika: false });
  assert.equal(hozzajarulas('cookieyes-consent=' + encodeURIComponent('consent:yes,action:no,advertisement:yes')).hirdetes, false);
});

test('kattintasazonosito: legfrissebb, 90 napon belul, tartalek a _gcl_aw suti; rossz formatum eldobva', () => {
  assert.deepEqual(kattintasValaszt({ gclid: { ertek: GCLID, ido: MOST - 10 } }, '', MOST), { tipus: 'gclid', ertek: GCLID, ido: MOST - 10 });
  assert.equal(kattintasValaszt({ gclid: { ertek: GCLID, ido: MOST - 91 * 86400 } }, '', MOST), null);
  assert.equal(kattintasValaszt({ gclid: { ertek: 'rossz id<script>', ido: MOST } }, '', MOST), null);
  assert.deepEqual(kattintasValaszt(null, `_gcl_aw=GCL.${MOST - 50}.${GCLID}`, MOST), { tipus: 'gclid', ertek: GCLID, ido: MOST - 50 });
  assert.equal(kattintasValaszt({ gbraid: { ertek: 'gbraidTESZT0123', ido: MOST - 5 } }, `_gcl_aw=GCL.${MOST - 50}.${GCLID}`, MOST).tipus, 'gbraid');
});

test('konverzio + API-torzs: order_id = foglalasi kulcs, validateOnly alapbol, ertek HUF, consent GRANTED', () => {
  const kv = konverzio({ kulcs: '12169|555|1791800000', letrehozva: MOST, ertek: 24900, kattintas: { tipus: 'gclid', ertek: GCLID } }, '7834926162', { hozzajarulasHirdetes: true });
  assert.deepEqual(kv.konverzio, { conversionAction: 'customers/2626380837/conversionActions/7834926162', gclid: GCLID, conversionDateTime: googleIdo(MOST), orderId: '12169|555|1791800000', consent: { adUserData: 'GRANTED' }, conversionValue: 24900, currencyCode: 'HUF' });
  assert.match(googleIdo(MOST), /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\+0[12]:00$/);
  const t = apiTorzs([kv.konverzio]);
  assert.equal(t.validateOnly, true); assert.equal(t.partialFailure, true);
  assert.equal(apiTorzs([kv.konverzio], { elesKuldes: true }).validateOnly, false);
  assert.equal(zapierTorzs(kv.konverzio).dryrun, true);
  assert.equal(konverzio({ kulcs: 'k', letrehozva: MOST, kattintas: { tipus: 'gclid', ertek: GCLID } }, '7834926162', { hozzajarulasHirdetes: false }).kihagyva, 'nincs hirdetesi hozzajarulas');
  assert.equal(konverzio({ kulcs: 'k', letrehozva: MOST, kattintas: null }, '7834926162', { hozzajarulasHirdetes: true }).kihagyva, 'nincs Google-kattintasazonosito');
  assert.ok(!('conversionValue' in konverzio({ kulcs: 'k', letrehozva: MOST, ertek: null, kattintas: { tipus: 'gclid', ertek: GCLID } }, '7834926162', { hozzajarulasHirdetes: true }).konverzio), 'ertek nelkul nincs 0 Ft');
});

test('eles mod csak MP_GADS_MOD=eles ES eles host; szallito-valasztas', () => {
  assert.equal(elesKuldesE({}, 'www.medicalpiercing.hu'), false);
  assert.equal(elesKuldesE({ MP_GADS_MOD: 'eles' }, 'x.medicalpiercing.pages.dev'), false);
  assert.equal(elesKuldesE({ MP_GADS_MOD: 'eles' }, 'www.medicalpiercing.hu'), true);
  assert.equal(szallitoValaszt({}), null);
  assert.equal(szallitoValaszt(API_ENV), 'api');
  assert.equal(szallitoValaszt({ MP_GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/abc/' }), 'zapier');
});

test('kuldes (API, mock): OAuth + uploadClickConversions validateOnly; titok es nyers gclid nincs az eredmenyben', async () => {
  _tokenTorles();
  const f = mockFetch({ torzs: { results: [{}], echo: GCLID } });
  const kv = konverzio({ kulcs: 'k1', letrehozva: MOST, ertek: 24900, kattintas: { tipus: 'gclid', ertek: GCLID } }, '7834926162', { hozzajarulasHirdetes: true }).konverzio;
  const r = await kuldes([kv], API_ENV, { fetchImpl: f, most: MOST });
  assert.equal(f.hivasok.length, 2);
  assert.match(f.hivasok[1].url, /^https:\/\/googleads\.googleapis\.com\/v\d+\/customers\/2626380837:uploadClickConversions$/);
  const torzs = JSON.parse(f.hivasok[1].o.body);
  assert.equal(torzs.validateOnly, true);
  assert.equal(f.hivasok[1].o.headers['developer-token'], 'dev-TITOK');
  assert.deepEqual(r.map((x) => [x.akcioId, x.allapot, x.mod, x.kuldo]), [['7834926162', 'elfogadva', 'validate', 'api']]);
  const s = JSON.stringify(r);
  assert.ok(!s.includes(GCLID) && !s.includes('TITOK'), 'nyers gclid / titok nincs az eredmenyben');
  // partialFailure -> hiba
  const f2 = mockFetch({ torzs: { partialFailureError: { code: 3, details: [{ errors: [{ location: { fieldPathElements: [{ fieldName: 'conversions', index: 0 }] } }] }] } } });
  assert.equal((await kuldes([kv], API_ENV, { fetchImpl: f2, most: MOST }))[0].allapot, 'hiba');
  // titok nelkul nincs kimeno hivas
  const f3 = mockFetch();
  assert.equal((await kuldes([kv], {}, { fetchImpl: f3, most: MOST }))[0].allapot, 'nincs_hitelesites');
  assert.equal(f3.hivasok.length, 0);
});

test('lanc: koszonooldal -> D1 -> feltoltes (validate), deduplikacio a kulcson', async () => {
  _semaTorles(); _tokenTorles();
  const db = d1(); const f = mockFetch();
  const env = { MP_MERES_DB: db, ...API_ENV };
  const r1 = await (await foglalasErkezes({ request: keres(alapTorzs()), env }, { fetchImpl: f, most: MOST })).json();
  assert.deepEqual(r1, { ok: true, uj: true });
  const sor = db._s.prepare('SELECT * FROM mp_foglalas').get();
  assert.equal(sor.kulcs, '12169|555|1791800000'); assert.equal(sor.ertek, 24900); assert.equal(sor.uj_vendeg, 1);
  assert.equal(sor.kattintas_tipus, 'gclid'); assert.equal(sor.kattintas_ertek, GCLID); assert.equal(sor.hozzajarulas_hirdetes, 1);
  assert.equal(sor.kornyezet, 'eles'); assert.equal(sor.forras, 'salonic'); assert.equal(sor.helyszin, 'szeged');
  const ft = db._s.prepare('SELECT akcio_id, mod, allapot, valasz, kattintas_maszk FROM mp_feltoltes ORDER BY akcio_id').all();
  assert.deepEqual(ft.map((x) => [x.akcio_id, x.mod, x.allapot]), [['7834926162', 'validate', 'elfogadva'], ['7834926165', 'validate', 'elfogadva']]);
  assert.match(ft[0].kattintas_maszk, /^h:[0-9a-f]{8}$/);
  const upl = f.hivasok.filter((h) => h.url.includes('uploadClickConversions'));
  assert.equal(upl.length, 1); assert.equal(JSON.parse(upl[0].o.body).conversions.length, 2);
  assert.ok(JSON.parse(upl[0].o.body).conversions.every((c) => c.orderId === '12169|555|1791800000'));
  // ugyanaz a foglalas ujra (frissites / masodik lap): nincs uj sor, nincs uj feltoltes
  const r2 = await (await foglalasErkezes({ request: keres(alapTorzs()), env }, { fetchImpl: f, most: MOST + 5 })).json();
  assert.deepEqual(r2, { ok: true, uj: false });
  assert.equal(f.hivasok.filter((h) => h.url.includes('uploadClickConversions')).length, 1);
  assert.equal(db._s.prepare('SELECT COUNT(*) n FROM mp_foglalas').get().n, 1);
});

test('lanc: hozzajarulas nelkul nincs gclid a rekordban es nincs Google-hivas; visszatero -> visszatero akcio', async () => {
  _semaTorles();
  const db = d1(); const f = mockFetch();
  await foglalasErkezes({ request: keres(alapTorzs({ first_booking: 'false' }), { cookie: SUTI_NEM + `; _gcl_aw=GCL.${MOST}.${GCLID}` }), env: { MP_MERES_DB: db, ...API_ENV } }, { fetchImpl: f, most: MOST });
  const sor = db._s.prepare('SELECT * FROM mp_foglalas').get();
  assert.equal(sor.kattintas_ertek, null); assert.equal(sor.kattintas_tipus, null); assert.equal(sor.hozzajarulas_hirdetes, 0); assert.equal(sor.uj_vendeg, 0);
  assert.equal(f.hivasok.length, 0);
  const ft = db._s.prepare('SELECT akcio_id, allapot, valasz FROM mp_feltoltes ORDER BY akcio_id').all();
  assert.deepEqual(ft.map((x) => [x.akcio_id, x.allapot, x.valasz]), [['7834926162', 'kihagyva', 'nincs hirdetesi hozzajarulas'], ['7834926168', 'kihagyva', 'nincs hirdetesi hozzajarulas']]);
});

test('adatvedelem: a rekord es a feltoltes-naplo nem tartalmaz egeszsegugyi / szemelyes adatot; a bemenet a tobbi mezot eldobja', async () => {
  _semaTorles();
  const db = d1(); const f = mockFetch({ torzs: { partialFailureError: { message: 'bad gclid ' + GCLID } } });
  const t = alapTorzs({ service: 'Migrén piercing', category: 'Gyógy', g: '2038420', email: 'a@b.hu', phone: '+36301234567', name: 'Teszt Elek' });
  t.nev = 'Teszt Elek';
  await foglalasErkezes({ request: keres(t), env: { MP_MERES_DB: db, ...API_ENV } }, { fetchImpl: f, most: MOST });
  const minden = JSON.stringify([db._s.prepare('SELECT * FROM mp_foglalas').all(), db._s.prepare('SELECT * FROM mp_feltoltes').all()]);
  for (const tilt of ['Migr', 'Gyógy', '2038420', 'a@b.hu', '36301234567', 'Teszt Elek', 'migren', 'foglalas-ok-mi']) assert.ok(!minden.includes(tilt), 'nincs: ' + tilt);
  const naplo = JSON.stringify(db._s.prepare('SELECT * FROM mp_feltoltes').all());
  assert.ok(!naplo.includes(GCLID), 'a Google-valaszban visszaadott nyers gclid is kitakarva');
  // a Google-nek kiment torzsben sincs ilyen
  const upl = f.hivasok.find((h) => h.url.includes('uploadClickConversions'));
  for (const tilt of ['Migr', 'Gyógy', '2038420', 'a@b.hu', '3630', 'Teszt']) assert.ok(!upl.o.body.includes(tilt));
  assert.deepEqual(Object.keys(JSON.parse(upl.o.body).conversions[0]).sort(), ['consent', 'conversionAction', 'conversionDateTime', 'conversionValue', 'currencyCode', 'gclid', 'orderId']);
  // bookingUrl csak a Salonic MP-aldomainrol
  assert.ok(!bemenet({ ut: '/foglalas-ok', p: { bookingUrl: 'https://gonosz.hu/?placeId=6029&employeeId=1&startDate=2' } }).url.includes('gonosz'));
});

test('ket foglalasi ut: Salonic es beagyazott motor (booking_id) ugyanazzal a kulccsal es definicioval', async () => {
  _semaTorles();
  const db = d1(); const f = mockFetch();
  const env = { MP_MERES_DB: db };
  await foglalasErkezes({ request: keres({ ut: '/foglalas-ok', p: { placeId: '6029', employeeId: '77', startDate: '1791900000', price: '19900', first_booking: 'true', booking_id: 'mp_motor_123' } }), env }, { fetchImpl: f, most: MOST });
  const s = db._s.prepare('SELECT kulcs, forras, salonic_id, ertek FROM mp_foglalas').get();
  assert.deepEqual({ ...s }, { kulcs: '6029|77|1791900000', forras: 'motor', salonic_id: 'mp_motor_123', ertek: 19900 });
  // ugyanaz a foglalas a Salonic-utrol is jelzodik: deduplikalva
  const r = await (await foglalasErkezes({ request: keres({ ut: '/foglalas-ok', p: { bookingUrl: BURL(6029, 77, 1791900000), price: '19900', first_booking: 'true' } }), env }, { fetchImpl: f, most: MOST })).json();
  assert.equal(r.uj, false);
  // titok nelkul: nincs_hitelesites, nincs kimeno hivas
  assert.equal(f.hivasok.length, 0);
  assert.ok(db._s.prepare('SELECT allapot FROM mp_feltoltes').all().every((x) => ['nincs_hitelesites', 'kihagyva'].includes(x.allapot)));
});

test('elonezet: kornyezet=elonezet, MP_GADS_MOD=eles mellett is csak validateOnly', async () => {
  _semaTorles(); _tokenTorles();
  const db = d1(); const f = mockFetch();
  await foglalasErkezes({ request: keres(alapTorzs(), { host: 'claude-mp.medicalpiercing.pages.dev' }), env: { MP_MERES_DB: db, MP_GADS_MOD: 'eles', ...API_ENV } }, { fetchImpl: f, most: MOST });
  assert.equal(db._s.prepare('SELECT kornyezet FROM mp_foglalas').get().kornyezet, 'elonezet');
  assert.equal(JSON.parse(f.hivasok.find((h) => h.url.includes('upload')).o.body).validateOnly, true);
});

test('eles mod (mock): validateOnly=false, a mar elkuldott akcio nem megy ujra', async () => {
  _semaTorles(); _tokenTorles();
  const db = d1(); const f = mockFetch();
  const env = { MP_MERES_DB: db, MP_GADS_MOD: 'eles', MP_MERES_ADMIN_KULCS: 'k', ...API_ENV };
  await foglalasErkezes({ request: keres(alapTorzs()), env }, { fetchImpl: f, most: MOST });
  assert.equal(JSON.parse(f.hivasok.find((h) => h.url.includes('upload')).o.body).validateOnly, false);
  assert.deepEqual(db._s.prepare("SELECT allapot FROM mp_feltoltes WHERE mod='eles'").all().map((x) => x.allapot), ['elkuldve', 'elkuldve']);
  // ujraprobalas: nincs mit (mind elkuldve)
  const u = await (await admin({ request: new Request('https://www.medicalpiercing.hu/api/mp-foglalas', { method: 'POST', headers: { 'x-mp-kulcs': 'k' }, body: '{"muvelet":"ujra"}' }), env }, { fetchImpl: f, most: MOST })).json();
  assert.equal(u.ujraprobalva, 0);
});

test('admin: kulcs nelkul 403/404; riport es egy foglalas nyers azonosito nelkul', async () => {
  _semaTorles();
  const db = d1(); const f = mockFetch();
  const env = { MP_MERES_DB: db, MP_MERES_ADMIN_KULCS: 'admin-k', ...API_ENV };
  await foglalasErkezes({ request: keres(alapTorzs()), env }, { fetchImpl: f, most: MOST });
  assert.equal((await admin({ request: new Request('https://www.medicalpiercing.hu/api/mp-foglalas?riport=1'), env })).status, 403);
  assert.equal((await admin({ request: new Request('https://www.medicalpiercing.hu/api/mp-foglalas?riport=1'), env: { MP_MERES_DB: db } })).status, 404);
  const rip = await (await admin({ request: new Request('https://www.medicalpiercing.hu/api/mp-foglalas?riport=1&nap=30', { headers: { 'x-mp-kulcs': 'admin-k' } }), env }, { most: MOST + 60 })).json();
  assert.equal(rip.foglalasok[0].foglalas, 1); assert.equal(rip.foglalasok[0].google_kattintassal, 1);
  const egy = await (await admin({ request: new Request('https://www.medicalpiercing.hu/api/mp-foglalas?kulcs=' + encodeURIComponent('12169|555|1791800000'), { headers: { 'x-mp-kulcs': 'admin-k' } }), env })).json();
  assert.match(egy.foglalas.kattintas_maszk, /^h:/);
  assert.ok(!JSON.stringify([rip, egy]).includes(GCLID), 'riportban nincs nyers gclid');
});

test('fuggveny: vészkapcsolo, rossz keres, ismeretlen helyszin', async () => {
  _semaTorles();
  const db = d1();
  const ctx = (req, env) => ({ request: req, env, waitUntil: () => {} });
  assert.equal((await onRequest(ctx(keres(alapTorzs()), { MP_MERES_DB: db, MP_MERES_KI: '1' }))).status, 503);
  assert.equal(db._s.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='mp_foglalas'").get().n, 0, 'kikapcsolva semmit nem ir');
  assert.equal((await onRequest(ctx(new Request('https://www.medicalpiercing.hu/api/mp-foglalas', { method: 'POST', body: 'nem json' }), { MP_MERES_DB: db }))).status, 400);
  assert.equal((await onRequest(ctx(keres({ ut: '/foglalas-ok', p: { bookingUrl: BURL(1) } }), { MP_MERES_DB: db }))).status, 422);
});

test('elkulonites: az MP meres-kodja nem importal a Mosaic kodjabol, es Mosaic-azonosito nincs benne', () => {
  const gyoker = path.resolve(import.meta.dirname, '..');
  for (const f of ['lib/meres/meres.js', 'lib/meres/google-ads.js', 'lib/meres/lanc.js', 'functions/api/mp-foglalas.js', 'assets/js/mp-meres.js']) {
    const s = fs.readFileSync(path.join(gyoker, f), 'utf8');
    for (const m of s.matchAll(/from\s+'([^']+)'/g)) assert.ok(!m[1].includes('netlify') && !/^\.\.\/\.\.\/\.\.\//.test(m[1]), f + ': ' + m[1]);
    for (const tilt of ['7825199989', '28616665324611098', 'KULCS_DB', 'LIFECYCLE_DB', 'G-H4206SQ0Q7']) assert.ok(!s.includes(tilt), f + ' tartalmazza: ' + tilt);
  }
});
