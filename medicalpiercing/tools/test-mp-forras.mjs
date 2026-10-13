// Forras-cimke (forras_platform), Meta / TikTok azonositok (csak hozzajarulassal), onbevallas, sema-bovites, riport-bontas.
// Kulso hivas NINCS (mock fetch; a D1-et a node:sqlite utanozza).
//   node --test tools/test-mp-forras.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { foglalasErkezes, onbevallasErkezes, admin, semaBiztos, _semaTorles, BOVITES } from '../lib/meres/lanc.js';
import { forrasPlatform, onbevallasErtek, platformAzonositok, PLATFORMOK, ONBEVALLASOK } from '../lib/meres/forras.js';
import { riport } from '../lib/meres/riport.js';
import { onRequest as onbevallasVegpont } from '../functions/api/mp-onbevallas.js';

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
const MOST = 1791700000;
const BURL = (start = 1791800000) => `https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=12169&serviceId=9001&employeeId=555&startDate=${start}`;
const KULCS = (start = 1791800000) => `12169|555|${start}`;
const SUTI_IGEN = `mp_suti=v1-s1-m1-t${MOST}`;
const SUTI_NEM = `mp_suti=v1-s0-m0-t${MOST}`;
const FBCLID = 'IwAR0TESZTfbclid_abcdefghij';
const TTCLID = 'E.C.P.TESZTttclid_0123456789';
const FBP = `fb.1.${(MOST - 7200) * 1000}.1234567890`;
const TTP = '2TESZTttp-abcdef_123';
const kattintas = { fbclid: { ertek: FBCLID, ido: MOST - 3600 }, ttclid: { ertek: TTCLID, ido: MOST - 1800 } };
const keres = (utvonal, torzs, cookie = SUTI_IGEN, host = 'www.medicalpiercing.hu') => new Request(`https://${host}${utvonal}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(torzs) });
const torzs = (extra = {}, p = {}) => ({ ut: '/foglalas-ok-mi', p: { bookingUrl: BURL(), price: '24900', first_booking: 'true', ...p }, kattintas: null, ...extra });
const nemKuld = async () => { throw new Error('kulso hivas tilos'); };
async function foglal(env, t, cookie, most = MOST) { return (await foglalasErkezes({ request: keres('/api/mp-foglalas', t, cookie), env }, { fetchImpl: nemKuld, most })).json(); }
const sor = (db, k = KULCS()) => db.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').bind(k).first();
const uj = () => { _semaTorles(); const db = d1(); return { db, env: { MP_MERES_DB: db } }; };

test('feher lista: forras_platform es onbevallas', () => {
  assert.deepEqual(PLATFORMOK, ['google', 'meta', 'tiktok', 'egyeb']);
  for (const p of PLATFORMOK) assert.equal(forrasPlatform(p), p);
  assert.equal(forrasPlatform('TikTok'), 'tiktok');
  for (const r of ['', 'facebook', 'ismeros', 'gclid=abc', null, 5, { p: 'meta' }]) assert.equal(forrasPlatform(r), null);
  for (const o of ONBEVALLASOK) assert.equal(onbevallasErtek(o), o);
  for (const r of ['instagram', 'x', '', null, ['meta']]) assert.equal(onbevallasErtek(r), null);
});

test('sema: meglevo (regi) tablara idempotens bovites, a regi sor megmarad', async () => {
  const { db } = uj();
  // a regi sema: az uj oszlopok nelkul (es az igazolas-oszlopok nelkul is)
  db._s.exec(`CREATE TABLE mp_foglalas (kulcs TEXT PRIMARY KEY, salonic_id TEXT, forras TEXT NOT NULL, kornyezet TEXT NOT NULL, letrehozva INTEGER NOT NULL,
    ertek INTEGER, ertek_forras TEXT, uj_vendeg INTEGER, helyszin TEXT, hozzajarulas_dontott INTEGER NOT NULL, hozzajarulas_hirdetes INTEGER NOT NULL,
    hozzajarulas_analitika INTEGER NOT NULL, kattintas_tipus TEXT, kattintas_ertek TEXT, kattintas_ido INTEGER)`);
  db._s.exec(`INSERT INTO mp_foglalas (kulcs, forras, kornyezet, letrehozva, hozzajarulas_dontott, hozzajarulas_hirdetes, hozzajarulas_analitika) VALUES ('6029|1|2', 'salonic', 'eles', ${MOST - 100}, 0, 0, 0)`);
  await semaBiztos(db);
  _semaTorles();
  await semaBiztos(db); // masodszor: nem hibazik, nem duplikal
  const oszl = db._s.prepare('PRAGMA table_info(mp_foglalas)').all().map((o) => o.name);
  for (const [nev] of BOVITES) assert.equal(oszl.filter((o) => o === nev).length, 1, nev);
  for (const nev of ['forras_platform', 'onbevallas', 'meta_fbc', 'meta_fbp', 'meta_kattintas_ido', 'tiktok_ttclid', 'tiktok_ttp', 'tiktok_kattintas_ido']) assert.ok(oszl.includes(nev), nev);
  const regi = await sor(db, '6029|1|2');
  assert.equal(regi.forras_platform, null);
  assert.equal(regi.onbevallas, null);
});

test('forras_platform hozzajarulas NELKUL is tarolodik, azonosito nelkul; ismeretlen ertek -> NULL', async () => {
  const { db, env } = uj();
  const v = await foglal(env, torzs({ forras_platform: 'tiktok', kattintas }), SUTI_NEM);
  assert.equal(v.uj, true);
  const s = await sor(db);
  assert.equal(s.forras_platform, 'tiktok');
  assert.equal(s.hozzajarulas_hirdetes, 0);
  for (const o of ['meta_fbc', 'meta_fbp', 'meta_kattintas_ido', 'tiktok_ttclid', 'tiktok_ttp', 'tiktok_kattintas_ido', 'kattintas_ertek']) assert.equal(s[o], null, o);
  // dontes nelkul (nincs suti) is
  await foglal(env, torzs({ forras_platform: 'meta' }, { bookingUrl: BURL(1791800600) }), '');
  assert.equal((await sor(db, KULCS(1791800600))).forras_platform, 'meta');
  // nem feher listas ertek
  await foglal(env, torzs({ forras_platform: 'facebook.com' }, { bookingUrl: BURL(1791801200) }), SUTI_NEM);
  assert.equal((await sor(db, KULCS(1791801200))).forras_platform, null);
});

test('Meta / TikTok azonositok CSAK hirdetesi hozzajarulassal (suti + bongeszo)', async () => {
  const { db, env } = uj();
  const cookie = `${SUTI_IGEN}; _fbp=${FBP}; _ttp=${TTP}`;
  await foglal(env, torzs({ forras_platform: 'tiktok', kattintas }), cookie);
  const s = await sor(db);
  assert.equal(s.meta_fbc, `fb.1.${(MOST - 3600) * 1000}.${FBCLID}`);
  assert.equal(s.meta_kattintas_ido, MOST - 3600);
  assert.equal(s.meta_fbp, FBP);
  assert.equal(s.tiktok_ttclid, TTCLID);
  assert.equal(s.tiktok_kattintas_ido, MOST - 1800);
  assert.equal(s.tiktok_ttp, TTP);
  // ugyanez hozzajarulas nelkul: semmi
  await foglal(env, torzs({ kattintas }, { bookingUrl: BURL(1791800600) }), `${SUTI_NEM}; _fbp=${FBP}; _ttp=${TTP}; _fbc=fb.1.${MOST * 1000}.${FBCLID}`);
  const n = await sor(db, KULCS(1791800600));
  for (const o of ['meta_fbc', 'meta_fbp', 'tiktok_ttclid', 'tiktok_ttp']) assert.equal(n[o], null, o);
});

test('azonositok: formatum- es idoellenorzes, a frissebb fbc nyer', () => {
  const ures = platformAzonositok({ fbclid: { ertek: 'rossz<script>', ido: MOST }, ttclid: { ertek: 'rovid', ido: MOST } }, '_fbp=fb.1.x.1; _ttp=a b', MOST);
  assert.deepEqual(Object.values(ures).filter((v) => v !== null), []);
  const regi = platformAzonositok({ ttclid: { ertek: TTCLID, ido: MOST - 91 * 86400 } }, '', MOST);
  assert.equal(regi.tiktok_ttclid, null, '90 napnal regebbi');
  const suti = `_fbc=fb.1.${(MOST - 60) * 1000}.SUTIfbclid_12345`;
  assert.equal(platformAzonositok({ fbclid: { ertek: FBCLID, ido: MOST - 3600 } }, suti, MOST).meta_fbc, `fb.1.${(MOST - 60) * 1000}.SUTIfbclid_12345`);
  assert.equal(platformAzonositok({ fbclid: { ertek: FBCLID, ido: MOST } }, suti, MOST).meta_fbc, `fb.1.${MOST * 1000}.${FBCLID}`);
});

test('kesoi hozzajarulas (potlas) a Meta / TikTok oszlopokat is kitolti, a biztonsagi feltetelekkel', async () => {
  const { db, env } = uj();
  await foglal(env, torzs({ forras_platform: 'tiktok', kattintas }), SUTI_NEM);
  assert.equal((await sor(db)).tiktok_ttclid, null);
  // potlas nelkuli ismetelt jelzes nem ir
  await foglal(env, torzs({ kattintas }), SUTI_IGEN);
  assert.equal((await sor(db)).tiktok_ttclid, null);
  // potlas: kitolti
  const v = await foglal(env, torzs({ kattintas, potlas: true }), SUTI_IGEN, MOST + 60);
  assert.equal(v.potolva, true);
  let s = await sor(db);
  assert.equal(s.tiktok_ttclid, TTCLID); assert.ok(s.meta_fbc.endsWith(FBCLID)); assert.equal(s.hozzajarulas_hirdetes, 1);
  assert.equal(s.forras_platform, 'tiktok', 'a forras-cimke nem valtozik');
  // masodik potlas nem ir felul
  const masik = { ttclid: { ertek: 'MASIKttclid_0123456', ido: MOST } };
  assert.equal((await foglal(env, torzs({ kattintas: masik, potlas: true }), SUTI_IGEN, MOST + 120)).potolva, false);
  assert.equal((await sor(db)).tiktok_ttclid, TTCLID);
  // ablakon kivul / mas booking_id: nem ir
  const { db: db2, env: env2 } = uj();
  await foglal(env2, torzs({ kattintas }), SUTI_NEM);
  assert.equal((await foglal(env2, torzs({ kattintas, potlas: true }), SUTI_IGEN, MOST + 3 * 3600)).potolva, false);
  assert.equal((await foglal(env2, torzs({ kattintas, potlas: true }, { booking_id: 'mb_masik' }), SUTI_IGEN, MOST + 60)).potolva, false);
  assert.equal((await sor(db2)).tiktok_ttclid, null);
  // hozzajarulas nelkuli potlas: semmi
  assert.equal((await foglal(env2, torzs({ kattintas, potlas: true }), SUTI_NEM, MOST + 60)).potolva, undefined);
  assert.equal((await sor(db2)).meta_fbc, null);
});

test('admin: a nyers Meta / TikTok azonosito maszkolva', async () => {
  const { env } = uj();
  env.MP_MERES_ADMIN_KULCS = 'admin-k';
  await foglal(env, torzs({ kattintas }), `${SUTI_IGEN}; _fbp=${FBP}; _ttp=${TTP}`);
  const r = await (await admin({ request: new Request(`https://www.medicalpiercing.hu/api/mp-foglalas?kulcs=${encodeURIComponent(KULCS())}`, { headers: { 'x-mp-kulcs': 'admin-k' } }), env })).json();
  const s = JSON.stringify(r);
  for (const nyers of [FBCLID, TTCLID, FBP, TTP]) assert.ok(!s.includes(nyers), 'nincs nyers: ' + nyers);
  assert.match(r.foglalas.tiktok_ttclid, /^h:[0-9a-f]{8}$/);
});

test('onbevallas: csak letezo, friss, ures sorra, feher listaval, egyszer', async () => {
  const { db, env } = uj();
  const ob = async (t, most = MOST + 30, host) => (await onbevallasErkezes({ request: keres('/api/mp-onbevallas', t, '', host), env }, { most })).json();
  // nincs sor
  assert.deepEqual(await ob({ ...torzs(), onbevallas: 'tiktok' }), { ok: true, mentve: false });
  await foglal(env, torzs({ forras_platform: 'tiktok' }), SUTI_NEM);
  // rossz ertek
  const rossz = await onbevallasErkezes({ request: keres('/api/mp-onbevallas', { ...torzs(), onbevallas: 'instagram' }), env }, { most: MOST + 30 });
  assert.equal(rossz.status, 400);
  // masik kornyezet (elonezet) es mas booking_id nem talal
  assert.equal((await ob({ ...torzs(), onbevallas: 'meta' }, MOST + 30, 'x.medicalpiercing.pages.dev')).mentve, false);
  assert.equal((await ob({ ...torzs({}, { booking_id: 'mb_x' }), onbevallas: 'meta' })).mentve, false);
  // 2 oran tul nem
  assert.equal((await ob({ ...torzs(), onbevallas: 'meta' }, MOST + 3 * 3600)).mentve, false);
  // jo
  assert.equal((await ob({ ...torzs(), onbevallas: 'ismeros' })).mentve, true);
  assert.equal((await sor(db)).onbevallas, 'ismeros');
  // masodszor nem irhato felul
  assert.equal((await ob({ ...torzs(), onbevallas: 'google' })).mentve, false);
  assert.equal((await sor(db)).onbevallas, 'ismeros');
  // a Pages-fuggveny: GET 405, POST mukodik
  assert.equal((await onbevallasVegpont({ request: new Request('https://www.medicalpiercing.hu/api/mp-onbevallas'), env })).status, 405);
  assert.equal((await onbevallasVegpont({ request: keres('/api/mp-onbevallas', { ...torzs(), onbevallas: 'egyeb' }), env })).status, 200);
  // vészkapcsolo
  assert.equal((await onbevallasErkezes({ request: keres('/api/mp-onbevallas', { ...torzs(), onbevallas: 'egyeb' }), env: { ...env, MP_MERES_KI: '1' } })).status, 503);
});

test('riport: forras_platform szerinti bontas (+ Salonic-igazolt) es onbevallas; a regi mezok valtozatlanok', async () => {
  const { db, env } = uj();
  const t0 = MOST - 86400;
  const be = async (start, fp, igazolas, onb) => {
    await foglal(env, torzs({ forras_platform: fp }, { bookingUrl: BURL(start) }), SUTI_NEM, t0);
    await db.prepare('UPDATE mp_foglalas SET igazolas = ?, onbevallas = ? WHERE kulcs = ?').bind(igazolas, onb, KULCS(start)).run();
  };
  await be(1791800000, 'tiktok', 'igazolt', 'tiktok');
  await be(1791800600, 'tiktok', null, 'ismeros');
  await be(1791801200, 'google', 'igazolt', null);
  await be(1791801800, null, 'igazolt', 'meta');
  await be(1791802400, 'egyeb', 'nem_igazolt', null);
  const r = await riport(db, MOST, 7);
  const x = r.sorok.find((s) => s.d1_foglalas === 5);
  assert.ok(x);
  assert.equal(x.d1_igazolt, 3); assert.equal(x.d1_nem_igazolt, 1);
  assert.equal(x.forras_tiktok, 2); assert.equal(x.forras_tiktok_igazolt, 1);
  assert.equal(x.forras_google, 1); assert.equal(x.forras_google_igazolt, 1);
  assert.equal(x.forras_meta, 0);
  assert.equal(x.forras_egyeb, 1); assert.equal(x.forras_egyeb_igazolt, 0);
  assert.equal(x.forras_ismeretlen, 1); assert.equal(x.forras_ismeretlen_igazolt, 1);
  assert.equal(x.onbevallas_tiktok, 1); assert.equal(x.onbevallas_ismeros, 1); assert.equal(x.onbevallas_meta, 1); assert.equal(x.onbevallas_nincs, 2);
  for (const k of ['nap', 'd1_foglalas', 'd1_uj', 'd1_igazolt', 'd1_nem_igazolt', 'salonic_level', 'salonic_parositatlan', 'ads_all', 'ads_igazolt', 'ads_igazolt_ertek']) assert.ok(k in x, k);
  assert.ok(!JSON.stringify(r).includes(FBCLID));
});
