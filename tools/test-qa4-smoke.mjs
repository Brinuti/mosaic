// QA-4 SMOKE TEST - szerver-oldali resz (DECISION #120 / 2. pont), futtatas: node --test tools/test-qa4-smoke.mjs
//   (a) a koszonooldali kulcs-iras nem lassithatja / nem blokkolhatja a foglalast  -> itt: a vegpont gyors es SOSEM dob / lóg; a bongeszo-oldali resz: tools/meres-proba/qa4-smoke-bongeszo.mjs
//   (b) hiba eseten fail-open  -> D1-hiba / Salonic-hiba / platformhiba = JSON-valasz (soha nem kivetel), a parositas a platformhibatol fuggetlen
//   (c) a veszkapcsolo (meres_kapcsolo "iras" VAGY MERES_IRAS_KI=1) TENYLEGESEN leallitja az UJ irasokat (kulcs-iras, erkezesi adat, parositas), az olvasas megy, visszakapcsolva ujra ir
// A tablak valodi SQLite-on (node:sqlite) futnak, a D1-felulet vekony heja; a Salonic-oldalak a valodi (mentett) oldalak.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { kezelKulcs, kezelEgyeztetes } from '../netlify/lib/foglalas-kulcs.js';
import { kezelAdmin, kezelErkezes } from '../netlify/lib/meres/vegpontok.js';
import { irasKi } from '../netlify/lib/meres/iras-kapcsolo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (f) => fs.readFileSync(path.join(here, 'fixtures', 'salonic', f), 'utf8');
const BID = 'mb_0muwq2ciorsos0tznsfyliq';
const BID2 = 'mb_0muwq2ciorsos0tznsfyl22';
const UUID = '3f10fabc-4f7d-9257-2088-cfe7b5b24a2e';
const URL_HAIR = (bid, start = 1792512000) => `https://mosaic-hair.salonic.hu/guestData/?anyone=true&employeeId=25095&placeId=10823&serviceId=232804&startDate=${start}&back=${bid}`;
const KULCS_SZOVEG = 'qa4-smoke-olvaso-kulcs';
const NOW = Date.UTC(2026, 9, 6, 14, 0, 0);

function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  const kulso = { prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
  return { db, kulso, db_n: (tabla) => { try { return db.prepare(`SELECT COUNT(*) n FROM ${tabla}`).get().n; } catch { return 0; } } };
}
const env = (D, extra = {}) => ({ KULCS_DB: D.kulso, EGYEZTETES_KULCS_HASH: crypto.createHash('sha256').update(KULCS_SZOVEG).digest('hex'), ...extra });
const salonic = async (url) => {
  const u = String(url); const ok = (szoveg) => ({ ok: true, status: 200, url: u, text: async () => szoveg });
  if (u.includes(`/booking/bookingDetails/${UUID}`)) return ok(fx('kulcs-bookingDetails-hair.html'));
  if (u.includes('/selectDate/?startDate=')) return ok(fx('kulcs-selectDate-modositas-hair.html'));
  return { ok: false, status: 404, url: u, text: async () => '' };
};
const KOSZONO = (e, bid = BID, start) => kezelKulcs(new Request('https://x.pages.dev/api/foglalas-kulcs', { method: 'POST', headers: { origin: 'https://x.pages.dev', 'content-type': 'application/json' }, body: JSON.stringify({ booking_id: bid, booking_url: URL_HAIR(bid, start), forras: 'back' }) }), e);
const ERKEZES = (e, sid = BID) => kezelErkezes(new Request('https://x.pages.dev/api/meres-erkezes', { method: 'POST', headers: { origin: 'https://x.pages.dev', 'content-type': 'application/json' }, body: JSON.stringify({ source_id: sid, uzletag: 'fodrasz', tipus: 'foglalas', szolgaltatas: 'Fodrasz', ar: 0, first_booking: true, attr: { fbp: `fb.1.${Math.floor(NOW / 1000 - 9000) * 1000}.1234567890` }, hozz: { ana: true, adv: true, fun: true }, oldal: 'https://x.pages.dev/fodrasz-ok' }) }), e);
const PAROSIT = (e, body = {}) => kezelEgyeztetes(new Request('https://x.pages.dev/api/foglalas-egyeztetes', { method: 'POST', headers: { 'x-egyeztetes-kulcs': KULCS_SZOVEG }, body: JSON.stringify({ uuid: UUID, host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)', idopont_szoveg: 'Október 20. (kedd) 18:00 - 18:30', munkatarsak: ['Noel - 20% kedvezmény!'], level_datuma: new Date().toISOString(), ...body }) }), e, { fetchImpl: salonic, now: () => Date.now() });
const ADMIN = (e, body) => kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?kulcs=${KULCS_SZOVEG}`, { method: 'POST', body: JSON.stringify(body) }), e, { now: () => NOW });
const TABLAK = ['foglalas_kulcs', 'foglalas_kulcs_irasok', 'meres_erkezes', 'foglalas_egyeztetes'];
const darabok = (D) => Object.fromEntries(TABLAK.map((t) => [t, D.db_n(t)]));

// ======================================================================================================================================================
test('(c) alaphelyzet: a harom uj iras (kulcs-iras, erkezesi adat, parositas) ir; a kapcsolo alapbol "be"', async () => {
  const D = d1(); const e = env(D);
  assert.equal(await irasKi(D.kulso, e), null);
  const k = await KOSZONO(e); assert.equal(k.status, 200); assert.equal((await k.json()).irva, true);
  assert.equal((await ERKEZES(e)).status, 200);
  const p = await PAROSIT(e); assert.equal(p.status, 200); assert.equal((await p.json()).allapot, 'parositott');
  const n = darabok(D);
  assert.equal(n.foglalas_kulcs, 1); assert.ok(n.foglalas_kulcs_irasok >= 1); assert.equal(n.meres_erkezes, 1); assert.ok(n.foglalas_egyeztetes >= 1);
});

test('(c) VESZKAPCSOLO (meres_kapcsolo "iras" = ki): a kulcs-iras, az erkezesi adat ES a parositas 503 / 0 uj sor; az olvasas megy; visszakapcsolva ujra ir', async () => {
  const D = d1(); const e = env(D);
  // elozmeny: egy foglalas mar be van irva (a kapcsolo nem torolhet semmit)
  assert.equal((await KOSZONO(e)).status, 200); assert.equal((await ERKEZES(e)).status, 200); assert.equal((await PAROSIT(e)).status, 200);
  const elotte = darabok(D);
  // a kapcsolo kikapcsolasa a kulcsos admin vegponton at (futasi idoben, nincs ujratelepites)
  const ki = await (await ADMIN(e, { muvelet: 'iras', be: false, ok: 'smoke teszt' })).json();
  assert.deepEqual(ki, { ok: true, kulcs: 'iras', be: false });
  assert.equal(await irasKi(D.kulso, e), 'kapcsolo');
  // UJ foglalas (mas booking_id, mas idopont, mas UUID): egyik irasi ut sem ir
  const UUID_UJ = '99999999-8888-7777-6666-555555555555';
  const k = await KOSZONO(e, BID2, 1792598400); const kj = await k.json();
  assert.equal(k.status, 503); assert.equal(kj.ok, false); assert.equal(kj.ki, true);
  const er = await ERKEZES(e, BID2); assert.equal(er.status, 503); assert.equal((await er.json()).ki, true);
  const p = await PAROSIT(e, { uuid: UUID_UJ }); const pj = await p.json();
  assert.equal(p.status, 503); assert.equal(pj.ok, false); assert.equal(pj.allapot, 'ki');
  // lemondas-kezeles es nevtabla-frissites is iras: szinten leall
  const lem = await PAROSIT(e, { tipus: 'lemondas', felado: 'Mosaic Hair', szolgaltatas: 'x', idopont_szoveg: 'Október 20. (kedd) 18:00 - 18:30', munkatarsak: ['Noel'] }); assert.equal(lem.status, 503);
  assert.deepEqual(darabok(D), elotte, 'a veszkapcsolo mellett egyetlen uj sor sem keletkezhet');
  // olvasas tovabbra is megy (a mar beirt foglalas allapota; a kulcsos GET)
  const g = await kezelEgyeztetes(new Request(`https://x.pages.dev/api/foglalas-egyeztetes?kulcs=${KULCS_SZOVEG}&uuid=${UUID}`), e);
  assert.equal(g.status, 200); assert.equal((await g.json()).allapot.allapot, 'parositott');
  const lista = await (await kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?kulcs=${KULCS_SZOVEG}&kapcsolok=1`), e)).json();
  assert.deepEqual(lista.kapcsolok.map((x) => [x.kulcs, x.be]), [['iras', 0]]);
  // visszakapcsolas: ujra ir
  assert.deepEqual(await (await ADMIN(e, { muvelet: 'iras', be: true })).json(), { ok: true, kulcs: 'iras', be: true });
  assert.equal(await irasKi(D.kulso, e), null);
  assert.equal((await KOSZONO(e, BID2, 1792598400)).status, 200);
  assert.equal(D.db_n('foglalas_kulcs'), elotte.foglalas_kulcs + 1);
});

test('(c) VESZKAPCSOLO a kornyezeti valtozoval (MERES_IRAS_KI=1): D1-olvasas nelkul, azonnal leallitja az uj irasokat; GET megy', async () => {
  const D = d1(); const e = env(D, { MERES_IRAS_KI: '1' });
  assert.equal(await irasKi(D.kulso, e), 'env');
  assert.equal((await KOSZONO(e)).status, 503); assert.equal((await ERKEZES(e)).status, 503); assert.equal((await PAROSIT(e)).status, 503);
  assert.deepEqual(darabok(D), { foglalas_kulcs: 0, foglalas_kulcs_irasok: 0, meres_erkezes: 0, foglalas_egyeztetes: 0 });
  // a platform-kapcsolok ("mind") NEM allitjak le az irast (kulon dolog): azok a kuldest allitjak le
  const D2 = d1(); const e2 = env(D2);
  await ADMIN(e2, { muvelet: 'kapcsolo', be: false, ok: 'platformok' });
  assert.equal(await irasKi(D2.kulso, e2), null);
  assert.equal((await KOSZONO(e2)).status, 200);
});

test('(c) a kapcsolo kulcsos: kulcs nelkul / rossz kulccsal 404, az "iras" kapcsolo nem allithato kivulrol', async () => {
  const D = d1(); const e = env(D);
  const rossz = await kezelAdmin(new Request('https://x.pages.dev/api/meres-admin?kulcs=rossz', { method: 'POST', body: JSON.stringify({ muvelet: 'iras', be: false }) }), e, { now: () => NOW });
  assert.equal(rossz.status, 404);
  assert.equal(await irasKi(D.kulso, e), null);
  assert.equal((await kezelAdmin(new Request('https://x.pages.dev/api/meres-admin', { method: 'POST', body: JSON.stringify({ muvelet: 'iras', be: false }) }), e)).status, 404);
});

// ======================================================================================================================================================
test('(b) FAIL-OPEN: a D1 hibaja / a kotes hianya / a Salonic hibaja = JSON-valasz (soha nem kivetel), a vendeg-oldali vegpontok sosem lognak', async () => {
  const hibas = { prepare: () => { throw new Error('D1 nem elerheto'); }, batch: async () => { throw new Error('D1 nem elerheto'); } };
  const e = { KULCS_DB: hibas, EGYEZTETES_KULCS_HASH: crypto.createHash('sha256').update(KULCS_SZOVEG).digest('hex') };
  for (const [nev, hivas] of [['kulcs-iras', () => KOSZONO(e)], ['erkezes', () => ERKEZES(e)], ['parositas', () => PAROSIT(e)]]) {
    const t0 = Date.now(); let v; try { v = await hivas(); } catch (x) { assert.fail(`${nev}: kivetel a vendeg/Zap fele: ${x.message}`); }
    assert.ok(v instanceof Response, nev); assert.ok([500, 503].includes(v.status), `${nev}: ${v.status}`);
    assert.ok(Date.now() - t0 < 1000, `${nev}: lassu hibaag`);
    const j = await v.json(); assert.equal(j.ok, false);
  }
  // nincs D1-kotes (az elesben az elesites elott ez az alaphelyzet): 503, sosem kivetel
  for (const hivas of [() => KOSZONO({}), () => ERKEZES({}), () => PAROSIT({})]) { const v = await hivas(); assert.equal(v.status, 503); }
  // a kapcsolo olvasasa fail-open: ha a tabla nem olvashato, az irast nem allitjuk le (de a kovetkezo, valos iras hibaja is JSON)
  assert.equal(await irasKi(hibas, {}), null);
  assert.equal(await irasKi(null, {}), null);
  // Salonic-hiba a parositasban: nem kivetel, fuggoben marad (ujraprobalhato), a platformok fele semmi nem megy
  const D = d1(); const e2 = env(D);
  const v = await kezelEgyeztetes(new Request('https://x.pages.dev/api/foglalas-egyeztetes', { method: 'POST', headers: { 'x-egyeztetes-kulcs': KULCS_SZOVEG }, body: JSON.stringify({ uuid: UUID, host: 'mosaic-hair.salonic.hu' }) }), e2, { fetchImpl: async () => { throw new Error('halozati hiba'); }, now: () => NOW });
  assert.ok(v.status === 200 || v.status === 500 || v.status === 503, 'status: ' + v.status);
  const j = await v.json(); assert.ok(typeof j === 'object' && j !== null);
});

test('(b) FAIL-OPEN: a platformkuldes hibaja (esemenyKuldo kivetel) nem akasztja meg a parositast: a valasz parositott marad, az esemeny_kuldes hibaallapot', async () => {
  const D = d1(); const e = env(D, { MERES_ELOSZTO: '1' });
  await KOSZONO(e);
  const v = await kezelEgyeztetes(new Request('https://x.pages.dev/api/foglalas-egyeztetes', { method: 'POST', headers: { 'x-egyeztetes-kulcs': KULCS_SZOVEG }, body: JSON.stringify({ uuid: UUID, host: 'mosaic-hair.salonic.hu', felado: 'Mosaic Hair', szolgaltatas: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)', idopont_szoveg: 'Október 20. (kedd) 18:00 - 18:30', munkatarsak: ['Noel - 20% kedvezmény!'], level_datuma: new Date().toISOString() }) }), e, { fetchImpl: salonic, now: () => Date.now(), esemenyKuldo: async () => { throw new Error('platform leallt'); } });
  const j = await v.json();
  assert.equal(v.status, 200); assert.equal(j.allapot, 'parositott'); assert.equal(j.esemeny_kuldes.allapot, 'hiba');
});

// ======================================================================================================================================================
test('(a) SEBESSEG (szerver-oldali, in-memory D1): a kulcs-iras es az erkezesi iras mediansa elhanyagolhato, a kapcsolo-olvasas nem lassit szamottevoen', async () => {
  const D = d1(); const e = env(D);
  const mer = async (f, n = 60) => { const ido = []; for (let i = 0; i < n; i++) { const t0 = process.hrtime.bigint(); await f(i); ido.push(Number(process.hrtime.bigint() - t0) / 1e6); } ido.sort((a, b) => a - b); return { p50: ido[Math.floor(n * 0.5)], p95: ido[Math.floor(n * 0.95)], max: ido[n - 1] }; };
  const id = (i) => `mb_${String(i).padStart(3, '0')}abcdefghijklmnop${String(i).padStart(3, '0')}`;
  const kulcs = await mer((i) => KOSZONO(e, id(i), 1792512000 + i * 1800));
  const erkez = await mer((i) => ERKEZES(e, id(i)));
  console.log('# szerver-oldali idok (ms, in-memory D1):', JSON.stringify({ kulcs, erkez }));
  assert.ok(kulcs.p95 < 50 && erkez.p95 < 50, 'a szerver-oldali feldolgozas legfeljebb tizedmasodperc');
  assert.equal(D.db_n('foglalas_kulcs'), 60);
});
