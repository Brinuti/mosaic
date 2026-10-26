// 7 napos UTOLSO FIZETETT KATTINTAS forrasmeres (mind az 5 uzletag; Feri kerese 2026-10-19; docs/booking-engine/FORRAS_LPT.md):
//   A) tiszta fuggvenyek (tisztitas, suti kodolas / dekodolas / hamis suti / lejarat, 7 napos ablak hatarai, cimke-matrix)
//   B) a /api/mosaic-forras vegpont (Set-Cookie pontos alakja, torles, GET visszanyeres, cross-site, host, meret, ismeretlen mezok, veszkapcsolo)
//   C) a koszonooldali jelzes -> meres_forras (D1, node:sqlite): bizonyitek_forras mindharom erteke, nem ir felul / ujabb felulir, nyers azonosito NINCS, shadow-lanc potlas, hiba nem torheti el a mentest
//   D) a kliens (assets/js/attribucio.js, vm-harness): erkezes-erzekeles, tarolok, POST, hozzajarulas, lptKlikk / klikkReszletes, kuld()
//   E) a foglalo-oldali potlas (flow.js fillClickIds / handoffSearch / lptPotlas, engine.js, foglalo-pmu.js) + a vedett fajlok blob-hash-e
//   node --test tools/test-lpt-forras.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import * as L from '../netlify/lib/meres/forras-lpt.js';
import { kezelErkezes } from '../netlify/lib/meres/vegpontok.js';
import { erkezesTisztit } from '../netlify/lib/meres/erkezes.js';
import { UZLETAGAK } from '../netlify/lib/meres/esemeny-modell.js';
import { onRequest as forrasFv } from '../functions/api/mosaic-forras.js';
import { onRequest as erkezesFv } from '../functions/api/meres-erkezes.js';
import { parseContext, fillGoogleIds, fillClickIds, handoffSearch, withAttribution, lptPotlas, CLICK_KEYS, GOOGLE_KEYS } from '../assets/js/booking-engine/flow.js';
import { engineSearch } from '../assets/js/booking-engine/beagyazott.js';
import * as R from './lpt-riport-sql.mjs';
import { meresSema } from '../netlify/lib/meres/elosztas.js';

const GYOKER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const olvas = (...p) => fs.readFileSync(path.join(GYOKER, ...p), 'utf8');
const ATTR = olvas('assets/js/attribucio.js');
const ENGINE = olvas('assets/js/booking-engine/engine.js');
const PMU = olvas('assets/js/foglalo-pmu.js');

const NOW_MS = Date.UTC(2026, 9, 19, 12, 0, 0), NOW = NOW_MS / 1000, NAP = 86400;
const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789', GBRAID = '0AAAAAB_TESZT_gbraid_01234567', WBRAID = 'CoMKCQ_TESZT_wbraid_0123456789';
const FBCLID = 'IwAR_fbclid_TESZT_01', TTCLID = 'E.C.P.ttclid_TESZT_01';
const ID = (x) => ('mb_0muwq2ciorsos0tznsfyli' + x).toLowerCase(); // SOURCE_ID_MINTA: kisbetu / szamjegy
const BID = ID('q');

// ---------- segedek ----------
function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
const HOST = 'https://www.mosaicheadspa.hu';
const keres = (ut, { method = 'POST', body, cookie, origin = HOST, host = HOST, headers = {} } = {}) => new Request(host + ut, {
  method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...headers },
  ...(body !== undefined && method !== 'GET' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
});
const getKeres = (ut = '/api/mosaic-forras', o = {}) => keres(ut, { method: 'GET', origin: null, headers: { 'sec-fetch-site': 'same-origin' }, ...o });
const erintes = (o = {}) => ({ v: 1, ...o });
const KLIKK = (kp = 'gclid', kv = GCLID, o = {}) => erintes({ kp, kv, ...o });
const suti = (e) => `${L.LPT_SUTI}=${L.lptKodol(e)}`;
const sutiFejlecbol = (r) => { const sc = r.headers.get('set-cookie'); return sc ? sc.split(';')[0] : ''; };
const ertekFejlecbol = (r) => sutiFejlecbol(r).replace(/^mh_lpt=/, '');
const ures = async (r) => JSON.parse(await r.text());

// ======================================================================== A) tiszta fuggvenyek
test('A) utmTisztit: a nem engedett karakterek "_"-ra csereldnek (a Meta kotelezo UTM-je a kampany NEVET adja szokozokkel), max 100 karakter, ures / nem szoveg = null', () => {
  assert.equal(L.utmTisztit('Mosaic HeadSpa | Q4'), 'Mosaic_HeadSpa_Q4');
  assert.equal(L.utmTisztit('  google  '), 'google');
  assert.equal(L.utmTisztit('a.b_c~d:e+f-g'), 'a.b_c~d:e+f-g');
  assert.equal(L.utmTisztit('<script>alert(1)</script>'), 'script_alert_1_script');
  assert.equal(L.utmTisztit('x'.repeat(300)).length, 100);
  assert.equal(L.utmTisztit('a\nb\u0000c'), 'a_b_c');
  assert.equal(L.utmTisztit(12345), '12345');
  for (const rossz of ['', '   ', '|||', null, undefined, {}, [], true]) assert.equal(L.utmTisztit(rossz), null, JSON.stringify(rossz));
  assert.match(L.utmTisztit('ab'.repeat(60) + '!!'), /^[A-Za-z0-9._~:+-]{1,100}$/);
});
test('A) szamTisztit / klikkTisztit: hirdetesi azonosito csak szamjegy (max 20); a nyers kattintasazonosito az erkezes.js MINTA szerint (tipusonkent)', () => {
  assert.equal(L.szamTisztit('123456'), '123456'); assert.equal(L.szamTisztit(42), '42'); assert.equal(L.szamTisztit('1'.repeat(20)), '1'.repeat(20));
  for (const rossz of ['12a', '', '1'.repeat(21), '-5', '1.5', null, {}]) assert.equal(L.szamTisztit(rossz), null, String(rossz));
  assert.equal(L.klikkTisztit('gclid', GCLID), GCLID); assert.equal(L.klikkTisztit('fbclid', FBCLID), FBCLID); assert.equal(L.klikkTisztit('ttclid', TTCLID), TTCLID);
  assert.equal(L.klikkTisztit('gclid', 'rovid'), null); assert.equal(L.klikkTisztit('gclid', 'x'.repeat(201)), null); assert.equal(L.klikkTisztit('gclid', 'x'.repeat(200)), 'x'.repeat(200));
  assert.equal(L.klikkTisztit('fbclid', 'abc.def_ghi123'), null, 'a fbclid-ben nincs pont'); assert.equal(L.klikkTisztit('ttclid', 'E.C.P.1234'), 'E.C.P.1234');
  assert.equal(L.klikkTisztit('fbclid', 'abcdefg'), null, 'a fbclid legalabb 8 karakter'); assert.equal(L.klikkTisztit('fbclid', 'abcdefgh'), 'abcdefgh'); assert.equal(L.klikkTisztit('gclid', 'abcdefghi'), null, 'a gclid legalabb 10');
  assert.equal(L.klikkTisztit('ismeretlen', GCLID), null); assert.equal(L.klikkTisztit('gclid', 123456789012), null); assert.equal(L.klikkTisztit('gclid', '<script>aaaa'), null);
  // a szerver KATT_MINTA-ja pontosan az erkezes.js (meglevo shadow-lanc) mintaja: ugyanazt fogadja el / utasitja el
  for (const [kp, v] of [['gclid', GCLID], ['gclid', 'rovid'], ['fbclid', FBCLID], ['fbclid', 'a.b.c.d.e.f.g.h'], ['ttclid', TTCLID], ['ttclid', 'a b c d e f g h'], ['gbraid', GBRAID], ['wbraid', 'x'.repeat(10)], ['wbraid', 'x'.repeat(9)]]) {
    const attr = kp === 'fbclid' ? { meta: { fbclid: v } } : kp === 'ttclid' ? { tiktok: { ttclid: { ertek: v } } } : { google: { [kp]: { ertek: v } } };
    const { adat } = erkezesTisztit(attr, NOW_MS);
    const elfogad = kp === 'fbclid' ? !!(adat.meta && adat.meta.fbclid) : kp === 'ttclid' ? !!adat.tiktok : !!(adat.google && adat.google[kp]);
    assert.equal(L.klikkTisztit(kp, v) !== null, elfogad, `${kp}=${v}`);
  }
});
test('A) fizetett / fizetettPlatform: kattintasi parameter VAGY fizetett utm_medium; platform: parameterbol, utana utm_source-bol (meta / facebook / fb / instagram / ig, tiktok, google / adwords / googleads)', () => {
  for (const m of ['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'paid_search', 'cpm', 'CPC', 'Paid_Social']) assert.ok(L.fizetett({ um: m }), m);
  for (const m of ['organic', 'email', 'referral', 'social', '', undefined]) assert.ok(!L.fizetett({ um: m }), String(m));
  for (const kp of L.KATT_PARAMOK) assert.ok(L.fizetett({ kp }), kp);
  assert.ok(!L.fizetett(null) && !L.fizetett({}));
  assert.equal(L.fizetettPlatform({ kp: 'gclid' }), 'google'); assert.equal(L.fizetettPlatform({ kp: 'gbraid' }), 'google'); assert.equal(L.fizetettPlatform({ kp: 'wbraid' }), 'google');
  assert.equal(L.fizetettPlatform({ kp: 'fbclid' }), 'meta'); assert.equal(L.fizetettPlatform({ kp: 'ttclid' }), 'tiktok');
  assert.equal(L.fizetettPlatform({ kp: 'gclid', us: 'facebook' }), 'google', 'a kattintasi parameter az utm_source ELOTT');
  for (const [us, p] of [['meta', 'meta'], ['facebook', 'meta'], ['FB', 'meta'], ['instagram', 'meta'], ['ig', 'meta'], ['tiktok', 'tiktok'], ['google', 'google'], ['adwords', 'google'], ['googleads', 'google'], ['bing', null], ['newsletter', null]]) {
    assert.equal(L.fizetettPlatform({ um: 'cpc', us }), p, us);
  }
  assert.equal(L.fizetettPlatform({ um: 'organic', us: 'google' }), null, 'nem fizetett: nincs platform');
});
test('A) erintesTisztit: ismeretlen mezo eldobva, a kattintasi parameterbol a tipus (azonosito csak kv:true es mintaval), jovobeli / regi ido eldobva, v !== 1 -> null', () => {
  const e = L.erintesTisztit({ v: 1, us: 'Google', um: 'cpc', uc: 'Mosaic Q4', ut: 't', uco: 'c', gc: '123', ag: '456', ad: '789', kp: 'gclid', kv: GCLID, rk: 'search', t: NOW - 10, extra: 'x', p: 'google', __proto__: { a: 1 } }, NOW);
  assert.deepEqual(e, { v: 1, us: 'Google', um: 'cpc', uc: 'Mosaic_Q4', ut: 't', uco: 'c', gc: '123', ag: '456', ad: '789', kp: 'gclid', rk: 'search', t: NOW - 10 });
  assert.equal(L.erintesTisztit({ v: 1, kp: 'gclid', kv: GCLID }, NOW, { kv: true }).kv, GCLID);
  assert.equal(L.erintesTisztit({ v: 1, kp: 'gclid', kv: 'rovid' }, NOW, { kv: true }).kv, undefined);
  assert.equal(L.erintesTisztit({ v: 1, kp: 'fbclid', kv: GCLID.replace(/_/g, '.') }, NOW, { kv: true }).kv, undefined, 'kv a tipus mintaja szerint');
  assert.equal(L.erintesTisztit({ v: 1, kv: GCLID }, NOW, { kv: true }).kv, undefined, 'tipus nelkul nincs kv');
  assert.equal(L.erintesTisztit({ v: 1, kp: 'ismeretlen' }, NOW).kp, undefined);
  assert.equal(L.erintesTisztit({ v: 1, rk: 'belso' }, NOW).rk, undefined, 'a hivatkozo-kategoria feher listas');
  assert.equal(L.erintesTisztit({ v: 1, t: NOW + 301 }, NOW).t, undefined, 'jovobeli ido eldobva'); assert.equal(L.erintesTisztit({ v: 1, t: NOW + 300 }, NOW).t, NOW + 300);
  assert.equal(L.erintesTisztit({ v: 1, t: 1500000000 }, NOW).t, undefined, 'tul regi (2020 elotti) ido eldobva'); assert.equal(L.erintesTisztit({ v: 1, t: 'x' }, NOW).t, undefined); assert.equal(L.erintesTisztit({ v: 1, t: NOW - 1.5 }, NOW).t, undefined, 'nem egesz ido');
  for (const rossz of [null, undefined, 'x', 5, [], [{ v: 1 }], { v: 2 }, { v: '1' }, {}]) assert.equal(L.erintesTisztit(rossz, NOW), null, JSON.stringify(rossz));
});
test('A) suti kodolas / dekodolas: kor-forgas, hosszkorlat (legrosszabb eset is <= 1200), kompakt JSON base64url, p a szerver szamitasa', () => {
  const e = { v: 1, us: 'google', um: 'cpc', uc: 'Mosaic_HeadSpa_Q4', ut: 'kulcsszo', uco: 'hirdetes-1', gc: '23456789012', ag: '3456789012', ad: '456789012', kp: 'gclid', kv: GCLID, t: NOW - 100 };
  const ertek = L.lptKodol(e);
  assert.match(ertek, /^[A-Za-z0-9_-]+$/); assert.ok(ertek.length <= L.LPT_MAX_HOSSZ);
  const nyers = JSON.parse(Buffer.from(ertek, 'base64url').toString());
  assert.deepEqual(nyers, { v: 1, p: 'google', ...e });
  const d = L.lptDekodol(ertek, NOW);
  assert.deepEqual({ ...d }, { ...e, p: 'google', kor_s: 100, kor_nap: 0 });
  // legrosszabb eset: minden mezo a maximumon
  const nagy = { v: 1, us: 'a'.repeat(100), um: 'cpc', uc: 'b'.repeat(100), ut: 'c'.repeat(100), uco: 'd'.repeat(100), gc: '1'.repeat(20), ag: '2'.repeat(20), ad: '3'.repeat(20), kp: 'gclid', kv: 'k'.repeat(200), t: NOW };
  assert.ok(L.lptKodol(nagy).length <= L.LPT_MAX_HOSSZ, 'hosszkorlat: ' + L.lptKodol(nagy).length);
  assert.ok(L.lptDekodol(L.lptKodol(nagy), NOW), 'a legrosszabb eset is visszafejtheto'); assert.equal(L.lptDekodol(L.lptKodol(nagy), NOW).kv, 'k'.repeat(200), 'a kattintasazonosito mindig megmarad');
  // az Set-Cookie fejlec pontos alakja
  assert.equal(L.lptSuti(e), `mh_lpt=${ertek}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  assert.equal(L.lptSuti(null, true), 'mh_lpt=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  assert.equal(L.LPT_NAP * 86400, 2592000);
});
test('A) hamis / serult / lejart suti: null (nem dob hibat); a tartalom ujra tisztitott', () => {
  const ervenyes = { v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', t: NOW - 100 };
  const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const rossz = ['', undefined, null, 5, '%%%', 'nem base64!!', b64('nem json'), b64('[1,2]'), b64('null'), b64('5'), b64({ ...ervenyes, v: 2 }), b64({ ...ervenyes, v: undefined }),
    b64({ v: 1, kp: 'gclid', kv: GCLID }) /* nincs ido */, b64({ ...ervenyes, t: NOW + 1000 }) /* jovobeli */, b64({ v: 1, um: 'organic', t: NOW - 5 }) /* nem fizetett */, b64({ ...ervenyes, t: NOW - 31 * NAP }), 'A'.repeat(1201)];
  for (const r of rossz) assert.doesNotThrow(() => L.lptDekodol(r, NOW)), assert.equal(L.lptDekodol(r, NOW), null, String(r).slice(0, 30));
  // az injektalt / ismeretlen tartalom megtisztul
  const d = L.lptDekodol(b64({ ...ervenyes, uc: '<img src=x onerror=alert(1)>', ismeretlen: 'x', kv: 'nem minta!', rk: 'search' }), NOW);
  assert.equal(d.uc, 'img_src_x_onerror_alert_1'); assert.equal(d.kv, undefined); assert.equal(d.ismeretlen, undefined); assert.equal(d.rk, undefined, 'a sutiben nincs hivatkozo-kategoria');
  // lejarat hatarai: 30 nap pontosan meg ervenyes, +1 mp mar nem
  assert.ok(L.lptDekodol(b64({ ...ervenyes, t: NOW - 30 * NAP }), NOW)); assert.equal(L.lptDekodol(b64({ ...ervenyes, t: NOW - 30 * NAP - 1 }), NOW), null);
  assert.equal(L.lptDekodol(b64({ ...ervenyes, t: NOW - 31 * NAP }), NOW), null, '31 nap = nincs');
  // a Cookie fejlec: tobb suti, prototipus-vedelem, az elso elofordulas nyer
  assert.deepEqual(Object.keys(L.sutik('a=1; __proto__=x; b=2; a=3')).sort(), ['__proto__', 'a', 'b']); assert.equal(L.sutik('a=1; a=3').a, '1'); assert.equal(({}).x, undefined);
  assert.ok(L.lptOlvas(`_ga=GA1.2; ${suti(ervenyes)}; x=1`, NOW)); assert.equal(L.lptOlvas('', NOW), null); assert.equal(L.lptOlvas(undefined, NOW), null); assert.equal(L.lptOlvas('mh_lpt=', NOW), null);
});
test('A) 7 NAPOS ABLAK hatarai: 6 nap 23 ora = suti, pontosan 7 nap = suti, 7 nap 1 ora = kesei jelzes (a cimke valtozatlan), 30 nap = kesei, 31 nap = nincs semmi', () => {
  const sut = (kor) => L.lptOlvas(suti({ v: 1, kp: 'fbclid', kv: FBCLID, um: 'paid_social', us: 'meta', t: NOW - kor }), NOW);
  const direkt = { v: 1, rk: 'nincs', t: NOW - 60 };
  let v = L.bizonyitekValaszt({ munkamenet: direkt, suti: sut(6 * NAP + 23 * 3600) });
  assert.equal(v.bizonyitek_forras, 'suti'); assert.equal(v.kesei, null); assert.equal(v.bizonyitek.kor_nap, 6);
  v = L.bizonyitekValaszt({ munkamenet: direkt, suti: sut(7 * NAP) }); assert.equal(v.bizonyitek_forras, 'suti', 'pontosan 7 nap meg suti'); assert.equal(v.bizonyitek.kor_nap, 7);
  v = L.bizonyitekValaszt({ munkamenet: direkt, suti: sut(7 * NAP + 3600) }); assert.equal(v.bizonyitek_forras, 'munkamenet'); assert.deepEqual(v.kesei, { platform: 'meta', kor_nap: 7 }); assert.equal(v.bizonyitek, direkt);
  v = L.bizonyitekValaszt({ munkamenet: direkt, suti: sut(30 * NAP) }); assert.deepEqual(v.kesei, { platform: 'meta', kor_nap: 30 });
  v = L.bizonyitekValaszt({ munkamenet: direkt, suti: sut(31 * NAP) }); assert.equal(sut(31 * NAP), null); assert.equal(v.kesei, null); assert.equal(v.bizonyitek_forras, 'munkamenet');
  // nincs munkamenet-erintes: 7 napon beluli suti nyer; 8+ napos: nincs bizonyitek, de a kesei jelzes marad
  v = L.bizonyitekValaszt({ munkamenet: null, suti: sut(2 * NAP) }); assert.equal(v.bizonyitek_forras, 'suti');
  v = L.bizonyitekValaszt({ munkamenet: null, suti: sut(10 * NAP) }); assert.equal(v.bizonyitek, null); assert.equal(v.bizonyitek_forras, null); assert.deepEqual(v.kesei, { platform: 'meta', kor_nap: 10 });
  // a latogatas FIZETETT erintese mindig megelozi a sutit (munkamenet / latogatas); nem fizetett nem
  const fiz = { v: 1, rk: 'search', kp: 'gclid', t: NOW - 5 };
  v = L.bizonyitekValaszt({ munkamenet: fiz, tarolo: 'munkamenet', suti: sut(NAP) }); assert.equal(v.bizonyitek_forras, 'munkamenet'); assert.equal(v.bizonyitek, fiz); assert.equal(v.kesei, null, 'fizetett munkamenet mellett nincs kesei jelzes');
  v = L.bizonyitekValaszt({ munkamenet: fiz, tarolo: 'latogatas', suti: sut(NAP) }); assert.equal(v.bizonyitek_forras, 'latogatas');
  v = L.bizonyitekValaszt({ munkamenet: direkt, tarolo: 'latogatas', suti: null }); assert.equal(v.bizonyitek_forras, 'latogatas', 'nem fizetett latogatas-erintes is "latogatas"');
  v = L.bizonyitekValaszt({}); assert.deepEqual(v, { bizonyitek: null, bizonyitek_forras: null, kesei: null });
  assert.deepEqual([...L.BIZONYITEK_FORRASOK], ['munkamenet', 'latogatas', 'suti']);
});
test('A) cimkez: meta / tiktok / google markas / nem markas / organikus / ismeretlen matrix, fbclid utm nelkul, hianyos utm, google kampany-ID (utm_campaign vagy gc) a markas listaban', () => {
  const c = (e, lista = null) => { const r = L.cimkez(e, lista); return [r.forras_cimke, r.ismeretlen_ok || r.cimke_megjegyzes || null]; };
  // Meta
  assert.deepEqual(c({ kp: 'fbclid', um: 'paid_social', us: 'meta', uc: 'Kampany' }), ['meta', null]);
  assert.deepEqual(c({ um: 'paid_social', us: 'meta' }), ['meta', null], 'utm kattintasi parameter nelkul is');
  assert.deepEqual(c({ um: 'cpc', us: 'facebook' }), ['meta', null]); assert.deepEqual(c({ um: 'cpc', us: 'ig' }), ['meta', null]);
  assert.deepEqual(c({ kp: 'fbclid' }), ['meta', 'fbclid_utm_nelkul'], 'fbclid utm nelkul: meta, megjegyzessel');
  assert.deepEqual(c({ kp: 'fbclid', um: 'organic', us: 'facebook' }), ['meta', 'fbclid_utm_nelkul']);
  // TikTok
  assert.deepEqual(c({ kp: 'ttclid' }), ['tiktok', null]); assert.deepEqual(c({ um: 'paid_social', us: 'tiktok' }), ['tiktok', null]);
  // Google: nem markas / markas / lista hianyzik / nincs kampany-ID
  assert.deepEqual(c({ kp: 'gclid', uc: '111', us: 'google', um: 'cpc' }, ['222']), ['google_nem_markas', null]);
  assert.deepEqual(c({ kp: 'gclid', uc: '222', us: 'google', um: 'cpc' }, ['111', '222']), ['google_markas', null]);
  assert.deepEqual(c({ kp: 'gclid', gc: '222' }, ['222']), ['google_markas', null], 'a gad_campaignid / campaignid (gc) is szamit utm nelkul');
  assert.deepEqual(c({ kp: 'gclid', uc: 'nev', gc: '222' }, ['222']), ['google_markas', null], 'ha az utm_campaign nem szam, a gc dont');
  assert.deepEqual(c({ kp: 'gclid', uc: '222' }, null), ['google_nem_markas', 'markas_lista_hianyzik']);
  assert.deepEqual(c({ kp: 'gclid', uc: '222' }, []), ['google_nem_markas', null], 'ures lista: nincs markas');
  assert.deepEqual(c({ kp: 'gbraid' }, ['222']), ['google_nem_markas', 'nincs_kampany_id']); assert.deepEqual(c({ kp: 'wbraid', um: 'cpc', us: 'google' }, ['1']), ['google_nem_markas', 'nincs_kampany_id']);
  // organikus / direkt
  assert.deepEqual(c({ rk: 'nincs' }), ['organikus_direkt', 'direkt']); assert.deepEqual(c({ rk: 'search' }), ['organikus_direkt', 'organikus_kereso']); assert.deepEqual(c({ rk: 'social' }), ['organikus_direkt', 'organikus_social']);
  assert.deepEqual(c({ rk: 'egyeb' }), ['organikus_direkt', 'hivatkozo']); assert.deepEqual(c({ us: 'hirlevel', um: 'email', rk: 'nincs' }), ['organikus_direkt', 'organikus_utm']); assert.deepEqual(c({}), ['organikus_direkt', 'direkt']);
  // ismeretlen
  assert.deepEqual(c(null), ['ismeretlen', 'nincs_jel']); assert.deepEqual(c(undefined), ['ismeretlen', 'nincs_jel']);
  assert.deepEqual(c({ um: 'cpc', us: 'bing' }), ['ismeretlen', 'hianyos_utm'], 'fizetett medium, ismeretlen forras');
  assert.deepEqual(c({ um: 'cpc' }), ['ismeretlen', 'hianyos_utm'], 'fizetett medium forras nelkul');
  assert.deepEqual(c({ us: 'google' }), ['ismeretlen', 'hianyos_utm'], 'platformnev medium nelkul: hianyos hirdetesi utm'); assert.deepEqual(c({ us: 'facebook' }), ['ismeretlen', 'hianyos_utm']);
  assert.deepEqual(c({ us: 'google', um: 'organic' }), ['organikus_direkt', 'organikus_utm']);
  // zart lista
  for (const e of [{ kp: 'gclid', uc: '1' }, { kp: 'fbclid', um: 'cpc' }, { kp: 'ttclid' }, { rk: 'search' }, null, { um: 'cpc' }]) assert.ok(L.CIMKEK.includes(L.cimkez(e, ['1']).forras_cimke));
  assert.deepEqual([...L.CIMKEK], ['meta', 'tiktok', 'google_nem_markas', 'google_markas', 'organikus_direkt', 'ismeretlen']);
  assert.deepEqual(L.markasListaErtelmez('111, 222,abc,,3'), ['111', '222', '3']); assert.equal(L.markasListaErtelmez(null), null); assert.deepEqual(L.markasListaErtelmez(''), []);
});

// ======================================================================== B) a /api/mosaic-forras vegpont
const POST = (body, o = {}) => forrasFv({ request: keres('/api/mosaic-forras', { body, ...o }), env: o.env || {} });
const GET = (o = {}) => forrasFv({ request: getKeres('/api/mosaic-forras' + (o.query || ''), o), env: o.env || {} });
const FIZ_GOOGLE = () => ({ v: 1, us: 'google', um: 'cpc', uc: '12345', ut: 'kulcs', uco: 'hirdetes', gc: '111', ag: '222', ad: '333', kp: 'gclid', kv: GCLID });
test('B) POST fizetett erkezes: Set-Cookie pontos alakja (HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000), a tartalom a szerver-idovel, nyers azonositoval, no-store', async () => {
  const r = await POST({ forras: { ...FIZ_GOOGLE(), t: 1700000001 /* a kliens ideje NEM szamit */ }, hozz: { ana: true, adv: true, fun: false } });
  assert.equal(r.status, 200); assert.deepEqual(await ures(r), { ok: true, suti: true }); assert.equal(r.headers.get('cache-control'), 'no-store');
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /^mh_lpt=[A-Za-z0-9_-]+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
  const t = Math.floor(Date.now() / 1000);
  const d = L.lptDekodol(ertekFejlecbol(r), t);
  assert.ok(d, 'visszafejtheto'); assert.ok(Math.abs(d.t - t) <= 2, 'a szerver ideje'); assert.equal(d.kp, 'gclid'); assert.equal(d.kv, GCLID); assert.equal(d.p, 'google'); assert.equal(d.uc, '12345'); assert.equal(d.gc, '111'); assert.equal(d.ag, '222'); assert.equal(d.ad, '333');
  assert.ok(ertekFejlecbol(r).length <= 1200);
});
test('B) POST: minden platform (gclid / gbraid / wbraid / fbclid / ttclid) es a csak-UTM fizetett erkezes is suti; a nem fizetett erkezes NEM ir es NEM torol', async () => {
  for (const [kp, kv, p] of [['gclid', GCLID, 'google'], ['gbraid', GBRAID, 'google'], ['wbraid', WBRAID, 'google'], ['fbclid', FBCLID, 'meta'], ['ttclid', TTCLID, 'tiktok']]) {
    const r = await POST({ forras: { v: 1, kp, kv } }); const d = L.lptDekodol(ertekFejlecbol(r), Math.floor(Date.now() / 1000));
    assert.equal(d.kp, kp); assert.equal(d.kv, kv); assert.equal(d.p, p, kp);
  }
  let r = await POST({ forras: { v: 1, um: 'paid_social', us: 'meta', uc: 'Mosaic Q4', ad: '555' } }); let d = L.lptDekodol(ertekFejlecbol(r), Math.floor(Date.now() / 1000));
  assert.equal(d.p, 'meta'); assert.equal(d.kv, undefined); assert.equal(d.uc, 'Mosaic_Q4'); assert.equal(d.ad, '555');
  // nem fizetett: organikus / direkt / ures / hiany
  const meglevo = suti({ v: 1, kp: 'gclid', kv: GCLID, t: Math.floor(Date.now() / 1000) - 3 * NAP });
  for (const forras of [{ v: 1, rk: 'search' }, { v: 1, us: 'newsletter', um: 'email' }, { v: 1 }, {}, null, undefined, 'x']) {
    r = await POST({ forras, hozz: {} }, { cookie: meglevo }); assert.deepEqual(await ures(r), { ok: true, suti: false }); assert.equal(r.headers.get('set-cookie'), null, 'nem ir, nem torol: ' + JSON.stringify(forras));
  }
});
test('B) POST: ujabb fizetett kattintas FELULIR; ugyanaz a kattintas (azonos azonosito) ujra kuldve NEM frissiti az idot; organikus visszateres nem ir felul', async () => {
  const t0 = Math.floor(Date.now() / 1000);
  const regi = suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: '111', t: t0 - 3 * NAP });
  // masik platform ujabb kattintasa felulir (uj ido)
  let r = await POST({ forras: { v: 1, kp: 'fbclid', kv: FBCLID, um: 'paid_social', us: 'meta' } }, { cookie: regi }); let d = L.lptDekodol(ertekFejlecbol(r), t0);
  assert.equal(d.p, 'meta'); assert.equal(d.kv, FBCLID); assert.ok(d.kor_s <= 2);
  // masik google-kattintas (masik azonosito) is felulir
  r = await POST({ forras: { v: 1, kp: 'gclid', kv: 'Masik_gclid_0123456789', um: 'cpc', us: 'google', uc: '999' } }, { cookie: regi }); d = L.lptDekodol(ertekFejlecbol(r), t0);
  assert.equal(d.kv, 'Masik_gclid_0123456789'); assert.equal(d.uc, '999'); assert.ok(d.kor_s <= 2);
  // ugyanaz a kattintas ujra (ujratoltes / masik lap / munkamenet-vagas): az ido marad (3 nap), a tartalom frissul
  r = await POST({ forras: { v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: '111' } }, { cookie: regi }); d = L.lptDekodol(ertekFejlecbol(r), t0);
  assert.equal(d.kv, GCLID); assert.ok(Math.abs(d.kor_s - 3 * NAP) <= 2, 'az ido nem frissult: ' + d.kor_s);
  // organikus / direkt visszateres: semmi nem tortenik a sutivel (nincs Set-Cookie)
  r = await POST({ forras: { v: 1, rk: 'nincs' }, hozz: {} }, { cookie: regi }); assert.equal(r.headers.get('set-cookie'), null);
});
test('B) POST hozzajarulas: kifejezett elutasitas (hozz.adv === false) -> suti NINCS, a meglevo torlodik (Max-Age=0); dontes nelkul / adv:true / reszleges = engedett (DECISION #170)', async () => {
  const regi = suti({ v: 1, kp: 'gclid', kv: GCLID, t: Math.floor(Date.now() / 1000) - NAP });
  let r = await POST({ forras: FIZ_GOOGLE(), hozz: { ana: true, adv: false, fun: true } }, { cookie: regi });
  assert.deepEqual(await ures(r), { ok: true, suti: false }); assert.equal(r.headers.get('set-cookie'), 'mh_lpt=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  r = await POST({ hozz: { adv: false } }, { cookie: regi }); assert.equal(r.headers.get('set-cookie'), 'mh_lpt=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax', 'csak torlo keres (a kliens visszavonaskor)');
  r = await POST({ forras: FIZ_GOOGLE(), hozz: { adv: false } }, { cookie: 'mas=1' }); assert.equal(r.headers.get('set-cookie'), null, 'nincs mit torolni: nincs fejlec sem'); assert.deepEqual(await ures(r), { ok: true, suti: false });
  for (const hozz of [undefined, {}, null, { adv: true }, { ana: false }, { adv: null }, 'x']) { r = await POST({ forras: FIZ_GOOGLE(), hozz }); assert.ok(r.headers.get('set-cookie'), 'engedett: ' + JSON.stringify(hozz)); assert.match(r.headers.get('set-cookie'), /Max-Age=2592000/); }
});
test('B) POST: ismeretlen mezo / injektalt tartalom / hibas azonosito eldobva; a suti nem hordoz idegen mezot; a hosszkorlat tartva', async () => {
  const r = await POST({ forras: { ...FIZ_GOOGLE(), uc: '<script>x</script>', ismeretlen: 'x', rk: 'search', p: 'tiktok', extra: { a: 1 } }, ujmezo: 1 });
  const nyers = JSON.parse(Buffer.from(ertekFejlecbol(r), 'base64url').toString());
  assert.deepEqual(Object.keys(nyers).sort(), ['ad', 'ag', 'gc', 'kp', 'kv', 'p', 't', 'uc', 'uco', 'um', 'us', 'ut', 'v'].sort()); assert.equal(nyers.p, 'google', 'a platformot a szerver szamolja'); assert.equal(nyers.uc, 'script_x_script');
  const r2 = await POST({ forras: { v: 1, kp: 'gclid', kv: 'nem minta!!', um: 'cpc' } }); const d2 = L.lptDekodol(ertekFejlecbol(r2), Math.floor(Date.now() / 1000)); assert.equal(d2.kv, undefined); assert.equal(d2.kp, 'gclid', 'a tipus megmarad, az ertek nem');
  const r3 = await POST({ forras: { v: 1, kp: 'fbclid', kv: 'a.b.c.d.e.f.g.h.i', um: 'cpc' } }); assert.equal(L.lptDekodol(ertekFejlecbol(r3), Math.floor(Date.now() / 1000)).kv, undefined, 'fbclid pontokkal: elutasitva');
  const nagy = { v: 1, us: 'a'.repeat(300), um: 'cpc', uc: 'b'.repeat(300), ut: 'c'.repeat(300), uco: 'd'.repeat(300), gc: '1'.repeat(20), ag: '2'.repeat(20), ad: '3'.repeat(20), kp: 'gclid', kv: 'k'.repeat(200) };
  const r4 = await POST({ forras: nagy }); assert.ok(ertekFejlecbol(r4).length <= 1200); assert.equal(r4.status, 200);
  const r5 = await POST({ forras: { v: 2, kp: 'gclid', kv: GCLID } }); assert.equal(r5.headers.get('set-cookie'), null, 'v !== 1: elutasitva');
});
test('B) GET visszanyeres: a 30 napon beluli sutibol {suti, platform, kor_nap, klikk}; nincs / lejart / hamis suti = ures; ?adv=0 = ures; no-store; csak a kattintasi azonosito megy, utm nem', async () => {
  const t0 = Math.floor(Date.now() / 1000);
  const e = { v: 1, kp: 'ttclid', kv: TTCLID, um: 'paid_social', us: 'tiktok', uc: 'titkos kampany', t: t0 - 5 * NAP - 100 };
  let r = await GET({ cookie: suti(e) });
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store'); const j = await ures(r);
  assert.deepEqual(j, { ok: true, suti: true, platform: 'tiktok', kor_nap: 5, t: e.t, klikk: { ttclid: TTCLID } }, 'a t a suti kattintasi ideje');
  assert.equal(JSON.stringify(j).includes('titkos'), false, 'utm nem megy ki');
  assert.deepEqual(await ures(await GET({ cookie: suti({ ...e, kp: 'gbraid', kv: GBRAID }) })), { ok: true, suti: true, platform: 'google', kor_nap: 5, t: e.t, klikk: { gbraid: GBRAID } });
  assert.deepEqual(await ures(await GET({ cookie: suti({ v: 1, um: 'cpc', us: 'google', t: t0 - 60 }) })), { ok: true, suti: true, platform: 'google', kor_nap: 0, t: t0 - 60, klikk: {} }, 'csak utm: nincs azonosito');
  for (const cookie of [undefined, 'mas=1', 'mh_lpt=', 'mh_lpt=xxx', suti({ ...e, t: t0 - 31 * NAP }), 'mh_lpt=' + 'A'.repeat(2000)]) assert.deepEqual(await ures(await GET({ cookie })), { ok: true, suti: false, klikk: {} }, String(cookie).slice(0, 30));
  assert.deepEqual(await ures(await GET({ cookie: suti(e), query: '?adv=0' })), { ok: true, suti: false, klikk: {} }, 'a kliens tiltast jelez');
  assert.equal((await GET({ cookie: suti(e), query: '?adv=1' })).status, 200);
});
test('B) cross-site 403 (GET es POST), rossz host 404, tulmeret 413, hibas JSON 400, nem objektum 400, nem GET / POST 405, veszkapcsolo 503', async () => {
  const e = suti({ v: 1, kp: 'gclid', kv: GCLID, t: Math.floor(Date.now() / 1000) - 60 });
  // cross-site / hianyzo fejlecek: 403 (a suti-tartalom nem szivarog)
  for (const h of [{ 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' }, { 'sec-fetch-site': 'none' }, {}]) { const r = await forrasFv({ request: keres('/api/mosaic-forras', { method: 'GET', origin: null, cookie: e, headers: h }), env: {} }); assert.equal(r.status, 403, JSON.stringify(h)); assert.equal((await r.text()).includes(GCLID), false); }
  assert.equal((await forrasFv({ request: keres('/api/mosaic-forras', { method: 'GET', origin: 'https://evil.example', cookie: e }), env: {} })).status, 403);
  assert.equal((await POST({ forras: FIZ_GOOGLE() }, { origin: 'https://evil.example' })).status, 403); assert.equal((await POST({ forras: FIZ_GOOGLE() }, { origin: null })).status, 403);
  assert.equal((await POST({ forras: FIZ_GOOGLE() }, { origin: HOST })).status, 200);
  assert.equal((await forrasFv({ request: getKeres(), env: {} })).status, 200, 'azonos eredet (Sec-Fetch-Site: same-origin)');
  // host-vedelem
  for (const host of ['https://evil.example', 'https://mosaicheadspa.hu.evil.example', 'https://www.medicalpiercing.hu', 'https://example.com']) { const r = await forrasFv({ request: keres('/api/mosaic-forras', { host, origin: host, body: { forras: FIZ_GOOGLE() } }), env: {} }); assert.equal(r.status, 404, host); }
  for (const host of ['https://www.mosaicheadspa.hu', 'https://mosaicheadspa.hu', 'https://claude-lpt.mosaic-d77.pages.dev', 'https://abc123.mosaic-d77.pages.dev', 'http://localhost:8788', 'http://127.0.0.1:8788']) { const r = await forrasFv({ request: keres('/api/mosaic-forras', { host, origin: host, body: { forras: FIZ_GOOGLE() } }), env: {} }); assert.equal(r.status, 200, host); }
  // meret / forma / metodus
  assert.equal((await POST('x'.repeat(5000))).status, 413); assert.equal((await POST({ forras: FIZ_GOOGLE(), padding: 'x'.repeat(4000) })).status, 413);
  assert.equal((await POST('{nem json')).status, 400); assert.equal((await POST('')).status, 400); assert.equal((await POST('[1]')).status, 400); assert.equal((await POST('null')).status, 400); assert.equal((await POST('5')).status, 400);
  for (const method of ['PUT', 'DELETE', 'PATCH', 'OPTIONS']) assert.equal((await forrasFv({ request: keres('/api/mosaic-forras', { method, ...(method === 'PUT' || method === 'PATCH' ? { body: '{}' } : {}) }), env: {} })).status, 405, method);
  // veszkapcsolo: MOSAIC_LPT_KI=1
  for (const m of ['GET', 'POST']) { const r = await forrasFv({ request: m === 'GET' ? getKeres('/api/mosaic-forras', { cookie: e }) : keres('/api/mosaic-forras', { body: { forras: FIZ_GOOGLE() } }), env: { MOSAIC_LPT_KI: '1' } }); assert.equal(r.status, 503, m); assert.equal(r.headers.get('set-cookie'), null); assert.deepEqual(await ures(r), { ok: false, ki: true }); }
  assert.equal((await forrasFv({ request: getKeres(), env: { MOSAIC_LPT_KI: '0' } })).status, 200);
});
test('B) a Pages Function burka: hibaban 500 JSON (nem kivetel); a vegpont a functions/api alatt van, a logika a netlify/lib/meres-ben', async () => {
  const r = await forrasFv({ request: { method: 'POST', url: 'https://www.mosaicheadspa.hu/api/mosaic-forras', headers: { get() { throw new Error('boom'); } } }, env: {} });
  assert.equal(r.status, 500); assert.deepEqual(await ures(r), { ok: false, hiba: 'belso_hiba' });
  assert.ok(fs.existsSync(path.join(GYOKER, 'functions/api/mosaic-forras.js')) && fs.existsSync(path.join(GYOKER, 'netlify/lib/meres/forras-lpt.js')));
});

// ======================================================================== C) a koszonooldali jelzes -> meres_forras (D1)
const ERK = (o = {}) => ({ source_id: BID, uzletag: 'headspa', tipus: 'foglalas', szolgaltatas: 'HeadSpa', ar: 26900, first_booking: true, attr: {}, hozz: { ana: true, adv: true, fun: true }, oldal: HOST + '/foglalas-ok', ...o });
const SES = (o = {}) => ({ v: 1, t: NOW - 600, rk: 'nincs', ...o });
const erkezes = (env, body, { cookie, now = NOW_MS, deps = {} } = {}) => L.erkezesForrassal(keres('/api/meres-erkezes', { body, cookie }), env, kezelErkezes, { now: () => now, ...deps });
const ujEnv = (extra = {}) => { const d = d1(); return { d, env: { KULCS_DB: d, ...extra } }; };
const sor = (d, id = BID) => d.db.prepare('SELECT * FROM meres_forras WHERE source_id = ?').get(id);
const mind = (d) => d.db.prepare('SELECT * FROM meres_forras').all();

test('C) munkamenet: a latogatas fizetett erintese adja a cimket; a valasz additiv "forras" mezot kap; a meres_erkezes mentese valtozatlan; a sor mezoi', async () => {
  const { d, env } = ujEnv();
  const r = await erkezes(env, ERK({ forras: SES({ rk: 'search', us: 'google', um: 'cpc', uc: '111', gc: '111', ag: '222', ad: '333', kp: 'gclid' }), forras_tarolo: 'munkamenet' }));
  assert.equal(r.status, 200); const j = await ures(r);
  assert.equal(j.ok, true); assert.deepEqual(j.forras, { cimke: 'google_nem_markas', bizonyitek_forras: 'munkamenet', klikk_potolt: null, kesei_fizetett: false });
  assert.equal(j.frissitve, true, 'a meglevo valasz mezoi megmaradnak');
  const s = sor(d);
  assert.deepEqual({ ...s }, { source_id: BID, uzletag: 'headspa', tipus: 'foglalas', ido: NOW, forras_cimke: 'google_nem_markas', ismeretlen_ok: null, cimke_megjegyzes: 'markas_lista_hianyzik', bizonyitek_forras: 'munkamenet', platform: 'google',
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: '111', utm_term: null, utm_content: null, gad_campaignid: '111', adgroupid: '222', adid: '333', kattintas_param: 'gclid', kattintas_ido: NOW - 600, kattintas_kor_nap: null,
    kesei_fizetett: 0, kesei_fizetett_platform: null, klikk_potolt: null, referrer_kat: 'search', kesei_kor_nap: null });
  assert.equal(d.db.prepare('SELECT COUNT(*) AS n FROM meres_erkezes WHERE source_id = ?').get(BID).n, 1, 'a meres_erkezes sor megvan');
  assert.deepEqual(L.valaszAlak(s), j.forras);
});
test('C) latogatas (2 oras tarolo) / munkamenet: a klienstol jovo forras_tarolo jelzes; nem fizetett latogatas-erintes is "latogatas"; a fizetett latogatas elobb van, mint a suti', async () => {
  const { d, env } = ujEnv();
  const suti1 = suti(KLIKK('gclid', GCLID, { um: 'cpc', us: 'google', uc: '5', t: NOW - 2 * NAP }));
  let j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'search', kp: 'fbclid', um: 'paid_social', us: 'meta' }), forras_tarolo: 'latogatas' }), { cookie: suti1 }));
  assert.deepEqual(j.forras, { cimke: 'meta', bizonyitek_forras: 'latogatas', klikk_potolt: 'gclid', kesei_fizetett: false }, 'a fizetett latogatas-erintes megelozi a sutit (az attr-ba a suti gclid-je potlodik: a bongeszobol nem jott)');
  j = await ures(await erkezes(env, ERK({ source_id: ID('A'), forras: SES({ rk: 'social' }), forras_tarolo: 'latogatas' })));
  assert.equal(j.forras.bizonyitek_forras, 'latogatas'); assert.equal(j.forras.cimke, 'organikus_direkt');
  j = await ures(await erkezes(env, ERK({ source_id: ID('B'), forras: SES({ rk: 'social' }), forras_tarolo: 'barmi' })));
  assert.equal(j.forras.bizonyitek_forras, 'munkamenet', 'ismeretlen tarolo-jelzes = munkamenet');
  assert.equal(mind(d).length, 3);
});
test('C) SUTI: nincs fizetett erintes a latogatasban + a suti <= 7 napos -> bizonyitek_forras=suti, a cimke a sutibol, kattintas_kor_nap tarolva; NYERS azonosito sehol nincs a meres_forras-ban', async () => {
  const { d, env } = ujEnv();
  const cookie = suti({ v: 1, kp: 'fbclid', kv: FBCLID, um: 'paid_social', us: 'meta', uc: 'Mosaic_Q4', uco: 'hirdetes_1', gc: '23850', ad: '777', t: NOW - 3 * NAP - 7200 });
  const j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }) }), { cookie }));
  assert.deepEqual(j.forras, { cimke: 'meta', bizonyitek_forras: 'suti', klikk_potolt: 'fbclid', kesei_fizetett: false }, 'a bongeszo attr-ja ures volt: a sutibol potlodik');
  const s = sor(d);
  assert.equal(s.bizonyitek_forras, 'suti'); assert.equal(s.platform, 'meta'); assert.equal(s.kattintas_param, 'fbclid'); assert.equal(s.kattintas_kor_nap, 3); assert.equal(s.kattintas_ido, NOW - 3 * NAP - 7200);
  assert.equal(s.utm_campaign, 'Mosaic_Q4'); assert.equal(s.utm_content, 'hirdetes_1'); assert.equal(s.gad_campaignid, '23850'); assert.equal(s.adid, '777'); assert.equal(s.referrer_kat, null);
  // a nyers kattintasazonosito: a meres_forras egyetlen oszlopaban / az egesz tabla szovegeben sincs (se az erteke, se base64-ben)
  const dump = JSON.stringify(mind(d)); assert.equal(dump.includes(FBCLID), false); assert.equal(dump.includes(Buffer.from(FBCLID).toString('base64')), false);
  for (const o of d.db.prepare("SELECT name FROM pragma_table_info('meres_forras')").all()) assert.ok(!/kv|ertek$|raw|nyers|clid_ertek/.test(o.name) || o.name === 'kattintas_kor_nap', 'oszlop: ' + o.name);
  // nincs munkamenet-erintes sem (a kliens nem kuldott forras-jelzest): a suti akkor is adja a cimket
  const j2 = await ures(await erkezes(env, ERK({ source_id: ID('C') }), { cookie: suti({ v: 1, kp: 'ttclid', kv: TTCLID, t: NOW - 100 }) }));
  assert.deepEqual(j2.forras, { cimke: 'tiktok', bizonyitek_forras: 'suti', klikk_potolt: 'ttclid', kesei_fizetett: false });
});
test('C) a latogatas fizetett erintese megelozi a sutit (ujabb fizetett kattintas), organikus visszateres NEM ir felul; nem fizetett latogatas + friss suti = suti', async () => {
  const { d, env } = ujEnv();
  const meta3 = suti({ v: 1, kp: 'fbclid', kv: FBCLID, um: 'paid_social', us: 'meta', t: NOW - 3 * NAP });
  // ujabb fizetett (google) kattintas a latogatasban: a cimke google, nem a suti meta-ja
  let j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'search', kp: 'gclid', us: 'google', um: 'cpc', uc: '9' }) }), { cookie: meta3 }));
  assert.equal(j.forras.cimke, 'google_nem_markas'); assert.equal(j.forras.bizonyitek_forras, 'munkamenet'); assert.equal(j.forras.kesei_fizetett, false);
  // organikus visszateres (kereso / direkt): a suti fizetett kattintasa megmarad -> meta, suti
  for (const [i, rk] of [['A', 'search'], ['B', 'nincs'], ['C', 'social'], ['D', 'egyeb']]) {
    j = await ures(await erkezes(env, ERK({ source_id: ID(i), forras: SES({ rk }) }), { cookie: meta3 }));
    assert.deepEqual([j.forras.cimke, j.forras.bizonyitek_forras], ['meta', 'suti'], rk);
  }
  assert.equal(mind(d).length, 5);
});
test('C) KESEI fizetett kattintas: 8-30 napos suti -> a cimke NEM valtozik (a munkamenet nem fizetett erintese), kesei_fizetett=1 + platform + kor; 31 napos suti = semmi', async () => {
  const { d, env } = ujEnv();
  const kuld = (i, kor, forras = SES({ rk: 'search' })) => erkezes(env, ERK({ source_id: ID(i), forras }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: '1', t: NOW - kor }) }).then(ures);
  let j = await kuld('A', 7 * NAP + 3600);
  assert.deepEqual(j.forras, { cimke: 'organikus_direkt', bizonyitek_forras: 'munkamenet', klikk_potolt: null, kesei_fizetett: true }, 'a cimke nem a sutibol, az azonosito sem potlodik (>7 nap: csak kesei jelzes)');
  let s = sor(d, ID('A')); assert.deepEqual([s.kesei_fizetett, s.kesei_fizetett_platform, s.kesei_kor_nap, s.cimke_megjegyzes, s.platform, s.kattintas_param], [1, 'google', 7, 'organikus_kereso', null, null], 'a cimke es a bizonyitek nem a sutibol');
  j = await kuld('B', 30 * NAP); assert.equal(j.forras.kesei_fizetett, true); assert.equal(sor(d, ID('B')).kesei_kor_nap, 30);
  j = await kuld('C', 31 * NAP); assert.deepEqual(j.forras, { cimke: 'organikus_direkt', bizonyitek_forras: 'munkamenet', klikk_potolt: null, kesei_fizetett: false }, '31 napos suti: semmi');
  // nincs munkamenet-erintes + kesei suti: ismeretlen (nincs jel), de a kesei jelzes megvan; bizonyitek_forras nincs
  j = await ures(await erkezes(env, ERK({ source_id: ID('D') }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: NOW - 12 * NAP }) }));
  assert.deepEqual(j.forras, { cimke: 'ismeretlen', bizonyitek_forras: null, klikk_potolt: null, kesei_fizetett: true });
  assert.equal(sor(d, ID('D')).ismeretlen_ok, 'nincs_jel');
  // a kesei jelzes nem ir at fizetett latogatas-erintest
  j = await kuld('E', 20 * NAP, SES({ rk: 'search', kp: 'fbclid' })); assert.deepEqual([j.forras.cimke, j.forras.kesei_fizetett], ['meta', false]);
});
test('C) HOZZAJARULAS: kifejezett elutasitas (hozz.adv === false) mellett a suti sem bizonyitek, sem potlas; dontes nelkul / engedelyezve igen', async () => {
  const { d, env } = ujEnv();
  const cookie = suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: '1', t: NOW - NAP });
  let j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }), hozz: { ana: true, adv: false, fun: true }, lpt_potlas: ['gclid'] }), { cookie }));
  assert.deepEqual(j.forras, { cimke: 'organikus_direkt', bizonyitek_forras: 'munkamenet', klikk_potolt: null, kesei_fizetett: false });
  assert.deepEqual(JSON.parse(d.db.prepare('SELECT attr FROM meres_erkezes WHERE source_id = ?').get(BID).attr), {}, 'nincs potlas az attr-be');
  for (const [i, hozz] of [['A', undefined], ['B', {}], ['C', { adv: true }]]) {
    j = await ures(await erkezes(env, ERK({ source_id: ID(i), forras: SES({ rk: 'nincs' }), hozz }), { cookie })); assert.equal(j.forras.bizonyitek_forras, 'suti', JSON.stringify(hozz));
  }
});
test('C) klikk_potolt: a kliens jelzese (foglalo-atadas) CSAK ha a suti ugyanilyen azonositot hordoz; hamis jelzes / suti nelkul NULL; csak kattintasi parameter tipusok', async () => {
  const { d, env } = ujEnv();
  const kuld = (i, lpt, cookie) => erkezes(env, ERK({ source_id: ID(i), forras: SES({ rk: 'nincs' }), lpt_potlas: lpt, attr: { google: { gclid: { ertek: GCLID, ts: NOW - 10 } }, meta: { fbclid: FBCLID, ts: NOW - 10 }, tiktok: { ttclid: { ertek: TTCLID, ts: NOW - 10 } } } }), { cookie }).then(ures);
  const gc = suti({ v: 1, kp: 'gclid', kv: GCLID, t: NOW - NAP });
  assert.equal((await kuld('A', ['gclid'], gc)).forras.klikk_potolt, 'gclid');
  assert.equal((await kuld('B', ['fbclid'], gc)).forras.klikk_potolt, null, 'a suti nem fbclid-et hordoz');
  assert.equal((await kuld('C', ['gclid'], undefined)).forras.klikk_potolt, null, 'nincs suti');
  assert.equal((await kuld('D', ['gclid', 'rendszer', 5, null], gc)).forras.klikk_potolt, 'gclid');
  assert.equal((await kuld('E', 'gclid', gc)).forras.klikk_potolt, null, 'nem tomb');
  assert.equal((await kuld('F', ['gclid'], suti({ v: 1, um: 'cpc', us: 'google', t: NOW - NAP }))).forras.klikk_potolt, null, 'a sutiben nincs azonosito (csak utm)');
  assert.equal(sor(d, ID('A')).klikk_potolt, 'gclid');
});
test('C) shadow-lanc (meres_erkezes.attr): a sutibol POTLODIK a platform azonositoja, ha a bongeszobol nem jott; a bongeszobol jovo SOHA nem irodik felul; MOSAIC_LPT_ATTR_POTLAS=0 kikapcsolja', async () => {
  const attrOf = (d, id = BID) => JSON.parse(d.db.prepare('SELECT attr FROM meres_erkezes WHERE source_id = ?').get(id).attr);
  const t0 = NOW - 4 * NAP;
  // Google
  let { d, env } = ujEnv();
  let j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }) }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', t: t0 }) }));
  assert.deepEqual(attrOf(d).google, { gclid: { ertek: GCLID, ts: t0 } }); assert.equal(j.forras.klikk_potolt, 'gclid'); assert.equal(sor(d).klikk_potolt, 'gclid');
  // Meta (fbclid -> fbc a shadow-lanc szamara), TikTok
  ({ d, env } = ujEnv());
  await erkezes(env, ERK(), { cookie: suti({ v: 1, kp: 'fbclid', kv: FBCLID, t: t0 }) }); assert.deepEqual(attrOf(d).meta, { fbclid: FBCLID, ts: t0 });
  ({ d, env } = ujEnv());
  await erkezes(env, ERK(), { cookie: suti({ v: 1, kp: 'ttclid', kv: TTCLID, t: t0 }) }); assert.deepEqual(attrOf(d).tiktok, { ttclid: { ertek: TTCLID, ts: t0 } });
  // a bongeszobol jovo azonosito elsobbseget elvez (nincs potlas, a klikk_potolt NULL)
  ({ d, env } = ujEnv());
  j = await ures(await erkezes(env, ERK({ attr: { google: { gbraid: { ertek: GBRAID, ts: NOW - 50 } } } }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: t0 }) }));
  assert.deepEqual(attrOf(d).google, { gbraid: { ertek: GBRAID, ts: NOW - 50 } }); assert.equal(j.forras.klikk_potolt, null);
  ({ d, env } = ujEnv());
  await erkezes(env, ERK({ attr: { meta: { fbc: `fb.1.${(NOW - 50) * 1000}.IwAR_BONGESZO_0123`, ts: NOW - 50 } } }), { cookie: suti({ v: 1, kp: 'fbclid', kv: FBCLID, t: t0 }) }); assert.equal(attrOf(d).meta.fbclid, undefined); assert.match(attrOf(d).meta.fbc, /IwAR_BONGESZO_0123$/);
  // masik platform azonositoja mellett a hianyzo platform potlodik
  ({ d, env } = ujEnv());
  await erkezes(env, ERK({ attr: { google: { gclid: { ertek: GCLID, ts: NOW - 50 } } } }), { cookie: suti({ v: 1, kp: 'ttclid', kv: TTCLID, t: t0 }) }); assert.equal(attrOf(d).google.gclid.ertek, GCLID); assert.equal(attrOf(d).tiktok.ttclid.ertek, TTCLID);
  // env-kapcsolo: nincs potlas, a cimke (munkamenet / suti) tovabbra is megy
  ({ d, env } = ujEnv({ MOSAIC_LPT_ATTR_POTLAS: '0' }));
  j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }) }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: '1', t: t0 }) }));
  assert.deepEqual(attrOf(d), {}); assert.equal(j.forras.bizonyitek_forras, 'suti'); assert.equal(j.forras.klikk_potolt, null);
  // 30 napnal regebbi / hamis suti: nincs potlas
  ({ d, env } = ujEnv());
  await erkezes(env, ERK(), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: NOW - 31 * NAP }) }); assert.deepEqual(attrOf(d), {});
  // a potlott azonositot a meglevo shadow-lanc is hasznalja (googleKattintas / metaFbc)
  const { googleKattintas, metaFbc } = await import('../netlify/lib/meres/erkezes.js');
  ({ d, env } = ujEnv()); await erkezes(env, ERK(), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: t0 }) }); const er = erkezesTisztit(attrOf(d), NOW_MS).adat; assert.equal(googleKattintas(er).ertek, GCLID);
  ({ d, env } = ujEnv()); await erkezes(env, ERK(), { cookie: suti({ v: 1, kp: 'fbclid', kv: FBCLID, t: t0 }) }); assert.equal(metaFbc(erkezesTisztit(attrOf(d), NOW_MS).adat), `fb.1.${t0 * 1000}.${FBCLID}`);
});
test('C) a meres_forras HIBAJA / a veszkapcsolo SOSEM torheti el a meres_erkezes mentest: a valasz es a meres_erkezes sor valtozatlan, "forras" mezo nelkul', async () => {
  // a meres_forras tablara iro minden SQL hibazik
  const d = d1(); const rossz = { ...d, prepare: (sql) => { if (/meres_forras|meres_beallitas/.test(sql)) throw new Error('D1 hiba (teszt)'); return d.prepare(sql); }, batch: d.batch };
  const j = await ures(await erkezes({ KULCS_DB: rossz }, ERK({ forras: SES({ kp: 'gclid', rk: 'search' }) }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: NOW - 100 }) }));
  assert.equal(j.ok, true); assert.equal(j.forras, undefined); assert.equal(d.db.prepare('SELECT COUNT(*) AS n FROM meres_erkezes').get().n, 1);
  // veszkapcsolo: a burok teljesen kimarad (nincs tabla, nincs forras mezo, nincs potlas)
  const k = ujEnv({ MOSAIC_LPT_KI: '1' });
  const j2 = await ures(await erkezes(k.env, ERK({ forras: SES({ rk: 'search' }) }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: NOW - 100 }) }));
  assert.equal(j2.ok, true); assert.equal(j2.forras, undefined); assert.equal(k.d.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'meres_forras'").get().n, 0);
  assert.deepEqual(JSON.parse(k.d.db.prepare('SELECT attr FROM meres_erkezes').get().attr), {});
  // a kezelErkezes sajat hibai valtozatlanul mennek vissza (nincs adatbazis-kotes / ervenytelen source_id / uzletag / veszkapcsolo / tul nagy / nem JSON), nincs meres_forras sor
  let r = await L.erkezesForrassal(keres('/api/meres-erkezes', { body: ERK() }), {}, kezelErkezes, {}); assert.equal(r.status, 503);
  const e = ujEnv();
  r = await erkezes(e.env, ERK({ uzletag: 'ismeretlen' })); assert.equal(r.status, 422); assert.equal((await ures(r)).forras, undefined);
  r = await erkezes(e.env, ERK({ source_id: 'x' })); assert.equal(r.status, 422);
  r = await erkezes(e.env, 'nem json'); assert.equal(r.status, 400); r = await erkezes(e.env, JSON.stringify({ ...ERK(), padding: 'x'.repeat(8100) })); assert.equal(r.status, 413);
  r = await L.erkezesForrassal(keres('/api/meres-erkezes', { method: 'GET', origin: null }), e.env, kezelErkezes, {}); assert.equal(r.status, 405);
  r = await L.erkezesForrassal(keres('/api/meres-erkezes', { body: ERK(), origin: 'https://evil.example' }), e.env, kezelErkezes, {}); assert.equal(r.status, 403);
  const kapcsolo = ujEnv({ MERES_IRAS_KI: '1' }); r = await erkezes(kapcsolo.env, ERK()); assert.equal(r.status, 503); assert.equal((await ures(r)).forras, undefined);
  assert.equal((e.d.db.prepare("SELECT name FROM sqlite_master WHERE name = 'meres_forras'").get() || { name: null }).name === null || mind(e.d).length === 0, true, 'hibas keresekre nincs meres_forras sor');
  // a potlas ujraepitett keresenek hibaja is a regi (eredeti) keresre esik vissza
  let hivas = 0; const kezelHibas = async (req, env, deps) => { if (++hivas === 1) throw new Error('boom'); return kezelErkezes(req, env, deps); };
  const p = ujEnv(); r = await L.erkezesForrassal(keres('/api/meres-erkezes', { body: ERK(), cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: NOW - 100 }) }), p.env, kezelHibas, { now: () => NOW_MS });
  assert.equal(r.status, 200); assert.equal(hivas, 2); assert.deepEqual(JSON.parse(p.d.db.prepare('SELECT attr FROM meres_erkezes').get().attr), {}, 'a fallback az eredeti torzzsel mentett');
});
test('C) egy source_id-hoz egy sor: az ELSO iras nyer; csak az "ismeretlen" javulhat egy jobb bizonyitekkal; ujabb fizetett nem irja at a korabbi cimkezest utolag (idempotens)', async () => {
  const { d, env } = ujEnv();
  const gc = suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: '1', t: NOW - NAP });
  let j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'search' }) })));
  assert.equal(j.forras.cimke, 'organikus_direkt');
  // masodik kuldes (masik bongeszo-munkamenet, suti-val): az elso cimke marad, a valasz a TAROLT sort mutatja
  j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }) }), { cookie: gc })); assert.equal(j.forras.cimke, 'organikus_direkt'); assert.equal(j.forras.bizonyitek_forras, 'munkamenet');
  assert.equal(mind(d).length, 1);
  // ismeretlen -> javulhat
  const id = ID('X');
  assert.equal((await ures(await erkezes(env, ERK({ source_id: id })))).forras.cimke, 'ismeretlen');
  j = await ures(await erkezes(env, ERK({ source_id: id, forras: SES({ kp: 'fbclid', rk: 'social' }) }))); assert.equal(j.forras.cimke, 'meta'); assert.equal(sor(d, id).forras_cimke, 'meta');
  // ismeretlen nem irja at a mar meglevo cimkezest
  j = await ures(await erkezes(env, ERK({ source_id: id }))); assert.equal(j.forras.cimke, 'meta');
});
test('C) mind az 5 uzletag (headspa, fodrasz, oxigen, szor, pmu) + ajandekkartya tipus: ugyanaz a logika, sor uzletagankent; a zart lista nem bovult', async () => {
  assert.deepEqual([...UZLETAGAK], ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']);
  const { d, env } = ujEnv();
  for (const [i, uz] of UZLETAGAK.entries()) {
    const j = await ures(await erkezes(env, ERK({ source_id: ID(i), uzletag: uz, forras: SES({ rk: 'nincs' }) }), { cookie: suti({ v: 1, kp: 'ttclid', kv: TTCLID, t: NOW - 2 * NAP }) }));
    assert.deepEqual([j.forras.cimke, j.forras.bizonyitek_forras], ['tiktok', 'suti'], uz);
  }
  assert.deepEqual(d.db.prepare('SELECT uzletag FROM meres_forras ORDER BY uzletag').all().map((r) => r.uzletag), [...UZLETAGAK].sort());
  const j = await ures(await erkezes(env, ERK({ source_id: 'pi_3Sabc123XYZabc456', tipus: 'ajandekkartya', forras: SES({ rk: 'nincs' }) }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: NOW - NAP }) }));
  assert.equal(j.forras.cimke, 'google_nem_markas'); assert.equal(sor(d, 'pi_3Sabc123XYZabc456').tipus, 'ajandekkartya');
  assert.equal(d.db.prepare("SELECT COUNT(*) AS n FROM meres_forras WHERE tipus = 'foglalas'").get().n, 5);
});
test('C) google_markas_kampanyok a D1 meres_beallitas tablabol (a tabla a kodtol jon letre, uresen): hianyzo lista -> google_nem_markas + markas_lista_hianyzik; beallitva -> google_markas', async () => {
  const { d, env } = ujEnv();
  const gc = (kamp) => suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: kamp, t: NOW - NAP });
  let j = await ures(await erkezes(env, ERK(), { cookie: gc('222') })); assert.equal(j.forras.cimke, 'google_nem_markas'); assert.equal(sor(d).cimke_megjegyzes, 'markas_lista_hianyzik');
  assert.equal(d.db.prepare('SELECT COUNT(*) AS n FROM meres_beallitas').get().n, 0, 'ures tabla'); assert.deepEqual(d.db.prepare("SELECT name FROM pragma_table_info('meres_beallitas')").all().map((r) => r.name), ['kulcs', 'ertek', 'ido']);
  d.db.prepare("INSERT INTO meres_beallitas (kulcs, ertek, ido) VALUES ('google_markas_kampanyok', '111,222', ?)").run(NOW);
  j = await ures(await erkezes(env, ERK({ source_id: ID('M') }), { cookie: gc('222') })); assert.equal(j.forras.cimke, 'google_markas');
  j = await ures(await erkezes(env, ERK({ source_id: ID('N') }), { cookie: gc('333') })); assert.equal(j.forras.cimke, 'google_nem_markas'); assert.equal(sor(d, ID('N')).cimke_megjegyzes, null);
});
test('C) sema: CREATE TABLE IF NOT EXISTS a kodbol, additiv oszlop (oszlopokBiztosit) a regi tablara is; megorzes: a regi sorok torlodnek (alapbol 30 nap, MOSAIC_LPT_MEGORZES_NAP)', async () => {
  const d = d1();
  // regi (a kesei_kor_nap oszlop nelkuli) tabla: a kod hozzaadja
  d.db.exec('CREATE TABLE meres_forras (source_id TEXT PRIMARY KEY, uzletag TEXT NOT NULL, tipus TEXT, ido INTEGER NOT NULL, forras_cimke TEXT NOT NULL, ismeretlen_ok TEXT, cimke_megjegyzes TEXT, bizonyitek_forras TEXT, platform TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT, gad_campaignid TEXT, adgroupid TEXT, adid TEXT, kattintas_param TEXT, kattintas_ido INTEGER, kattintas_kor_nap INTEGER, kesei_fizetett INTEGER DEFAULT 0, kesei_fizetett_platform TEXT, klikk_potolt TEXT, referrer_kat TEXT)');
  await L.forrasSema(d); await L.forrasSema(d);
  assert.ok(d.db.prepare("SELECT name FROM pragma_table_info('meres_forras')").all().some((r) => r.name === 'kesei_kor_nap'));
  const env = { KULCS_DB: d };
  const regiId = ID('R');
  d.db.prepare("INSERT INTO meres_forras (source_id, uzletag, ido, forras_cimke) VALUES (?, 'headspa', ?, 'meta')").run(regiId, NOW - 31 * NAP);
  d.db.prepare("INSERT INTO meres_forras (source_id, uzletag, ido, forras_cimke) VALUES (?, 'headspa', ?, 'meta')").run(ID('s'), NOW - 29 * NAP);
  await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }) }));
  assert.equal(sor(d, regiId), undefined, '31 napos sor torolve'); assert.ok(sor(d, ID('s')), '29 napos sor megmarad'); assert.ok(sor(d));
  const hosszu = ujEnv({ MOSAIC_LPT_MEGORZES_NAP: '400' });
  hosszu.d.db.exec('CREATE TABLE meres_forras (source_id TEXT PRIMARY KEY, uzletag TEXT NOT NULL, tipus TEXT, ido INTEGER NOT NULL, forras_cimke TEXT NOT NULL, ismeretlen_ok TEXT, cimke_megjegyzes TEXT, bizonyitek_forras TEXT, platform TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT, gad_campaignid TEXT, adgroupid TEXT, adid TEXT, kattintas_param TEXT, kattintas_ido INTEGER, kattintas_kor_nap INTEGER, kesei_fizetett INTEGER DEFAULT 0, kesei_fizetett_platform TEXT, klikk_potolt TEXT, referrer_kat TEXT)');
  hosszu.d.db.prepare("INSERT INTO meres_forras (source_id, uzletag, ido, forras_cimke) VALUES (?, 'headspa', ?, 'meta')").run(regiId, NOW - 100 * NAP);
  await erkezes(hosszu.env, ERK()); assert.ok(sor(hosszu.d, regiId), 'MOSAIC_LPT_MEGORZES_NAP=400: a 100 napos sor megmarad');
  const rovid = ujEnv({ MOSAIC_LPT_MEGORZES_NAP: '3' }); await erkezes(rovid.env, ERK()); assert.equal(rovid.env.MOSAIC_LPT_MEGORZES_NAP, '3'); // ervenytelen (<7) ertek: az alap (30) marad - nem torol
  assert.equal(L.MEGORZES_NAP, 30);
});
test('C) a Pages Function burka (functions/api/meres-erkezes.js): valos kerestel, valos idovel; a vegpont valasza additiv "forras" mezot kap', async () => {
  const { d, env } = ujEnv();
  const t = Math.floor(Date.now() / 1000);
  const r = await erkezesFv({ request: keres('/api/meres-erkezes', { body: ERK({ forras: SES({ rk: 'nincs', t: t - 5 }) }), cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: '1', t: t - NAP }) }), env });
  assert.equal(r.status, 200); const j = await ures(r); assert.deepEqual(j.forras, { cimke: 'google_nem_markas', bizonyitek_forras: 'suti', klikk_potolt: 'gclid', kesei_fizetett: false });
  assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('content-type'), /application\/json/);
  const { onRequest } = await import('../functions/api/meres-erkezes.js'); assert.equal(typeof onRequest, 'function');
  assert.equal(sor(d).bizonyitek_forras, 'suti');
});

// ======================================================================== D) a kliens: assets/js/attribucio.js (vm-harness)
const tarolo = (kezdo = {}) => { const m = new Map(Object.entries(kezdo)); const irasok = []; return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { irasok.push(k); m.set(k, String(v)); }, removeItem: (k) => m.delete(k), _m: m, _irasok: irasok }; };
const CC = (o) => JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: true, ...o });
function hamisSuti(kezdo) { const dontes = { ...kezdo }; const figyelok = []; return { engedely: (k) => !!dontes[k], figyel: (fn) => figyelok.push(fn), ertesit: (uj) => { Object.assign(dontes, uj); figyelok.forEach((f) => f({ ...dontes })); } }; }
function kliens({ host = 'www.mosaicheadspa.hu', pathname = '/lezeres-szortelenites-budapest', search = '', referrer = '', cookie = '', ls = tarolo(), ss = tarolo(), suti = hamisSuti({ adv: true, ana: true }), nav = 'navigate', lptValasz, fetchImpl, forras = ATTR, kapu = true } = {}) {
  const hivasok = [], idozitok = [];
  const win = {};
  const ctx = {
    document: { get cookie() { return cookie; }, referrer }, localStorage: ls, sessionStorage: ss, location: { hostname: host, search, origin: 'https://' + host, pathname },
    performance: { getEntriesByType: () => [{ type: nav }] }, URL, URLSearchParams, Date, JSON, Math, Promise, String, Object, Array, encodeURIComponent, decodeURIComponent, RegExp,
    setTimeout: (f, ms) => { idozitok.push({ f, ms }); return idozitok.length; }, clearTimeout() {},
    fetch: fetchImpl || (async (u, o = {}) => {
      const metodus = o.method || 'GET'; hivasok.push({ u, metodus, body: o.body ? JSON.parse(o.body) : null, o });
      if (metodus === 'GET') return { ok: true, status: 200, json: async () => (lptValasz === undefined ? { ok: true, suti: false, klikk: {} } : lptValasz) };
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }),
  };
  win.top = win; win.self = win; Object.assign(win, ctx); win.window = win; if (suti) win.mhSuti = suti; // suti: null = nincs suti.js az oldalon (pl. /foglalo-motor)
  vm.createContext(win); vm.runInContext(forras, win);
  const posztok = () => hivasok.filter((h) => h.metodus === 'POST' && h.u === '/api/mosaic-forras');
  const kuldesek = () => hivasok.filter((h) => h.u === '/api/meres-erkezes');
  return { win, hivasok, idozitok, ls, ss, posztok, kuldesek, mh: win.mhAttribucio, j: (x) => JSON.parse(JSON.stringify(x)) };
}
const URL_GOOGLE = `?gclid=${GCLID}&utm_source=google&utm_medium=cpc&utm_campaign=12345&gad_campaignid=777&adgroupid=888&adid=999&utm_term=kulcs`;
const URL_META = `?fbclid=${FBCLID}&utm_source=meta&utm_medium=paid_social&utm_campaign=${encodeURIComponent('Mosaic HeadSpa | Q4')}&utm_term=csoport&utm_content=hirdetes&utm_id=23850123&ad_id=6001`;
const URL_TIKTOK = `?ttclid=${TTCLID}&utm_source=tiktok&utm_medium=paid_social&utm_campaign=tt1`;
const sessionTouch = (k) => { const v = k.ss._m.get('mh_forras'); return v ? JSON.parse(v) : null; };
const ASSERT_NINCS_AZON = (k, ...ertekek) => { const s = JSON.stringify([...k.ss._m.entries(), ...k.ls._m.entries()].filter(([n]) => /^mh_(forras|lpt)/.test(n))); for (const e of ertekek) assert.equal(s.includes(e), false, 'az azonosito ertek nem lehet a tarolokban: ' + e); };

test('D) fizetett erkezes (Google / Meta / TikTok): tisztitott erintes a sessionStorage-ban + 2 oras latogatas-tarolo; a nyers azonosito SOHA nem kerul tarolora; POST a sajat vegpontra (azonos eredet), az azonositot CSAK ez viszi', () => {
  for (const [nev, search, kp, kv, ref] of [['google', URL_GOOGLE, 'gclid', GCLID, 'search'], ['meta', URL_META, 'fbclid', FBCLID, 'social'], ['tiktok', URL_TIKTOK, 'ttclid', TTCLID, 'social']]) {
    const referrer = ref === 'search' ? 'https://www.google.com/' : 'https://l.facebook.com/';
    const k = kliens({ search, referrer, ss: tarolo(), ls: tarolo() });
    const t = sessionTouch(k);
    assert.equal(t.v, 1); assert.equal(t.kp, kp); assert.equal(t.rk, ref); assert.ok(Math.abs(t.t - Date.now() / 1000) < 5, nev);
    assert.equal(Object.keys(t).every((x) => ['v', 't', 'us', 'um', 'uc', 'ut', 'uco', 'gc', 'ag', 'ad', 'kp', 'rk'].includes(x)), true, nev + ': feher listas mezok');
    ASSERT_NINCS_AZON(k, kv, GCLID, FBCLID, TTCLID);
    const l = JSON.parse(k.ls._m.get('mh_forras_l')); assert.ok(l.lej > Date.now() / 1000 + 7100 && l.lej <= Date.now() / 1000 + 7201, '2 oras latogatas-tarolo'); assert.deepEqual(l.e, t);
    const p = k.posztok(); assert.equal(p.length, 1, nev + ': egy POST'); assert.equal(p[0].u, '/api/mosaic-forras'); assert.equal(p[0].o.credentials, 'same-origin'); assert.equal(p[0].o.keepalive, true);
    assert.equal(p[0].body.forras.kv, kv, nev + ': a nyers azonosito a POST-ban'); assert.equal(p[0].body.forras.kp, kp); assert.equal(p[0].body.forras.rk, undefined, 'a hivatkozo-kategoria nem megy a sutibe'); assert.deepEqual(p[0].body.hozz, { adv: true }, 'a hatalyos engedely');
    // a szerver ugyanazt ertekeli
    assert.equal(L.erintesTisztit(p[0].body.forras, Math.floor(Date.now() / 1000), { kv: true }).kv, kv);
  }
  // utm / hirdetesi azonositok
  const g = sessionTouch(kliens({ search: URL_GOOGLE })); assert.deepEqual([g.us, g.um, g.uc, g.ut, g.gc, g.ag, g.ad], ['google', 'cpc', '12345', 'kulcs', '777', '888', '999']);
  const m = sessionTouch(kliens({ search: URL_META })); assert.deepEqual([m.us, m.um, m.uc, m.ut, m.uco, m.gc, m.ad], ['meta', 'paid_social', 'Mosaic_HeadSpa_Q4', 'csoport', 'hirdetes', '23850123', '6001'], 'a Meta kotelezo UTM-je: utm_id (kampany-ID) es ad_id (hirdetes-ID)');
  // csak fizetett utm_medium (kattintasi parameter nelkul): fizetett erintes, nincs kv
  const u = kliens({ search: '?utm_source=google&utm_medium=cpc&utm_campaign=5' }); assert.equal(u.posztok().length, 1); assert.equal(u.posztok()[0].body.forras.kv, undefined); assert.equal(sessionTouch(u).kp, undefined);
  // hibas azonosito-minta: a TIPUS fizetett jel, az ertek nem megy
  const h = kliens({ search: '?gclid=rovid' }); assert.equal(h.posztok().length, 1); assert.equal(h.posztok()[0].body.forras.kv, undefined); assert.equal(h.posztok()[0].body.forras.kp, 'gclid');
});
test('D) NEM fizetett erkezes: organikus / direkt visszateres NEM ir felul fizetettet es csak a napi 1 erintesnaplo-jelzest kuldi (#495; mh_lpt-iras nincs); elso erkezeskor a nem fizetett erintes is tarolodik (direkt / kereso); belso hivatkozo nem valtoztat', () => {
  const fiz = kliens({ search: URL_GOOGLE, referrer: 'https://www.google.com/' });
  const elozo = fiz.ss._m.get('mh_forras');
  // ugyanabban a munkamenetben organikus kereso-erkezes / direkt: a fizetett marad
  for (const [search, referrer] of [['', 'https://www.google.com/'], ['', ''], ['?utm_source=hirlevel&utm_medium=email', ''], ['', 'https://t.co/x']]) {
    const k = kliens({ search, referrer, ss: tarolo({ mh_forras: elozo }), ls: tarolo() });
    assert.equal(k.ss._m.get('mh_forras'), elozo, `nem ir felul: ${search} / ${referrer}`); assert.deepEqual(k.posztok().map((x) => x.body.organikus === true), [true], 'csak a napi 1 organikus erintesnaplo-jelzes (#495), mh_lpt-iras nincs');
  }
  // elso erkezes, nem fizetett: tarolodik (a cimkehez kell), POST nincs
  const d = kliens({ search: '', referrer: '' }); assert.deepEqual([sessionTouch(d).rk, sessionTouch(d).kp], ['nincs', undefined]); assert.deepEqual(d.posztok().map((x) => x.body.organikus === true), [true], 'direkt: csak a napi 1 organikus erintesnaplo-jelzes (#495)');
  const s = kliens({ search: '', referrer: 'https://www.bing.com/search?q=x' }); assert.equal(sessionTouch(s).rk, 'search');
  const so = kliens({ search: '', referrer: 'https://www.instagram.com/' }); assert.equal(sessionTouch(so).rk, 'social');
  const eg = kliens({ search: '', referrer: 'https://blog.example.hu/cikk' }); assert.equal(sessionTouch(eg).rk, 'egyeb');
  // nem fizetett erintes nem fizetett erintest felulirhat, de nem direktet
  const sz = kliens({ search: '', referrer: 'https://www.google.com/', ss: tarolo({ mh_forras: JSON.stringify({ v: 1, t: Math.floor(Date.now() / 1000) - 600, rk: 'nincs' }) }) }); assert.equal(sessionTouch(sz).rk, 'search');
  const di = kliens({ search: '', referrer: '', ss: tarolo({ mh_forras: JSON.stringify({ v: 1, t: Math.floor(Date.now() / 1000) - 600, rk: 'search' }) }) }); assert.equal(sessionTouch(di).rk, 'search', 'direkt nem ir felul keresot');
  // belso hivatkozo (sajat tartomany / Salonic): nem valtoztat, nem POST-ol, akkor sem, ha az URL-ben van parameter
  for (const ref of ['https://www.mosaicheadspa.hu/headspa-budapest', 'https://mosaicheadspa.salonic.hu/guestData/', 'https://mosaic-pmu.salonic.hu/x']) {
    const k = kliens({ search: URL_META, referrer: ref, ss: tarolo({ mh_forras: elozo }) }); assert.equal(k.ss._m.get('mh_forras'), elozo, ref); assert.equal(k.posztok().length, 0, ref);
  }
  const ures_ = kliens({ search: URL_META, referrer: 'https://www.mosaicheadspa.hu/' }); assert.equal(ures_.ss._m.has('mh_forras'), true, 'belso hivatkozo + jel + nincs elozo erintes: tarolodik'); assert.equal(ures_.posztok().length, 0);
});
test('D) ujabb fizetett kattintas felulir (a munkamenetet es a sutit is); ugyanaz a fizetett erintes ujratoltese / vissza gomb nem POST-ol ujra; kulonbozo platform is felulir', () => {
  const regi = kliens({ search: URL_GOOGLE, referrer: 'https://www.google.com/' });
  const uj = kliens({ search: URL_META, referrer: 'https://l.facebook.com/', ss: tarolo({ mh_forras: regi.ss._m.get('mh_forras') }) });
  assert.equal(sessionTouch(uj).kp, 'fbclid'); assert.equal(uj.posztok().length, 1); assert.equal(uj.posztok()[0].body.forras.kp, 'fbclid');
  for (const nav of ['reload', 'back_forward']) { const k = kliens({ search: URL_GOOGLE, referrer: 'https://www.google.com/', ss: tarolo({ mh_forras: regi.ss._m.get('mh_forras') }), nav }); assert.equal(k.posztok().length, 0, nav); }
  // masik tabon ugyanaz a kattintas: nem csereli a munkamenetet, de a szerver-oldali dedup miatt a POST megengedett
  const ugyanaz = kliens({ search: URL_GOOGLE, referrer: 'https://www.google.com/', ss: tarolo({ mh_forras: regi.ss._m.get('mh_forras') }) }); assert.equal(ugyanaz.ss._m.get('mh_forras'), regi.ss._m.get('mh_forras')); assert.equal(ugyanaz.posztok().length, 1);
});
test('D) koszonooldal (Salonic-foglalas utan): NEM erkezes - nincs uj erintes, nincs POST (a visszanyert azonosito az URL-ben sem szamit uj fizetett kattintasnak)', () => {
  const elozo = JSON.stringify({ v: 1, t: Math.floor(Date.now() / 1000) - 900, rk: 'nincs' });
  for (const [pathname, search] of [['/foglalas-ok', `?gclid=${GCLID}&first_booking=true&bookingUrl=https%3A%2F%2Fmosaicheadspa.salonic.hu%2FguestData%2F%3Fback%3D${BID}`], ['/fodrasz-ok', `?fbclid=${FBCLID}`], ['/elysion-ok', ''], ['/oxigenterapia-ok', ''], ['/pmu-ok', `?gclid=${GCLID}&mh_proba=pmu`],
    ['/success-foglalas-egyeni-vip', `?ttclid=${TTCLID}`], ['/szortelenites-ok', ''], ['/pmu-vh', ''], ['/mas-oldal', `?gclid=${GCLID}&bookingUrl=x`]]) {
    const k = kliens({ pathname, search, referrer: 'https://mosaicheadspa.salonic.hu/', ss: tarolo({ mh_forras: elozo }) });
    assert.equal(k.ss._m.get('mh_forras'), elozo, pathname); assert.equal(k.posztok().length, 0, pathname);
  }
  // a nem koszonooldali azonos URL (gclid, nincs bookingUrl) viszont erkezes
  assert.equal(kliens({ pathname: '/lezeres-szortelenites-budapest', search: `?gclid=${GCLID}` }).posztok().length, 1);
});
test('D) HOZZAJARULAS: kifejezett elutasitas -> nincs erzekeles, nincs tarolas, nincs azonosito-POST; a korabban irt suti torlese (munkamenetenkent egyszer); dontes / suti.js nelkul semmi nem torlodik; visszavonas / megadas esemenyre jol reagal', () => {
  // suti.js: adv tiltva
  let k = kliens({ search: URL_GOOGLE, suti: hamisSuti({ adv: false, ana: true }), ls: tarolo({ mh_forras_l: JSON.stringify({ e: { v: 1, t: 1, rk: 'nincs' }, lej: Date.now() / 1000 + 100 }) }), ss: tarolo({ mh_forras: '{"v":1,"t":1}' }) });
  assert.equal(k.ss._m.has('mh_forras'), false, 'a tarolt erintes torolve'); assert.equal(k.ls._m.has('mh_forras_l'), false);
  assert.equal(k.posztok().length, 1); assert.deepEqual(k.posztok()[0].body, { hozz: { adv: false } }, 'csak a torlo keres, azonosito nelkul'); ASSERT_NINCS_AZON(k, GCLID);
  // ugyanabban a munkamenetben a masodik oldal nem kuld ujra torlest
  const ss = tarolo(); kliens({ search: '', suti: hamisSuti({ adv: false }), ss }); const k2 = kliens({ search: '', suti: hamisSuti({ adv: false }), ss }); assert.equal(k2.posztok().length, 0, 'munkamenetenkent egyszer');
  // tarolt (nem reszleges) elutasitas suti.js nelkul (pl. /foglalo-motor): ugyanaz
  k = kliens({ search: URL_GOOGLE, suti: null, ls: tarolo({ mh_cc: CC({ adv: false }) }) }); assert.equal(k.posztok().length, 1); assert.deepEqual(k.posztok()[0].body, { hozz: { adv: false } }); assert.equal(k.ss._m.has('mh_forras'), false);
  // DONTES NELKUL + nincs suti.js (pl. /foglalo-motor): nincs engedely, de NEM elutasitas -> semmi nem tortenik, semmi nem torlodik
  k = kliens({ search: URL_GOOGLE, suti: null, ss: tarolo({ mh_forras: '{"v":1,"t":1700000000,"rk":"nincs"}' }) }); assert.equal(k.hivasok.length, 0, 'nincs hivas'); assert.equal(k.ss._m.has('mh_forras'), true, 'a tarolt erintes megmarad');
  // reszleges bejegyzes suti.js nelkul: nem elutasitas
  k = kliens({ search: URL_GOOGLE, suti: null, ls: tarolo({ mh_cc: JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: false, adv: false, reszleges: true }) }) }); assert.equal(k.hivasok.length, 0);
  // engedellyel (suti.js: adv true; vagy tarolt adv:true) mukodik, a hozz allapotat a hatalyos engedely adja
  k = kliens({ search: URL_GOOGLE, suti: hamisSuti({ adv: true }), ls: tarolo({ mh_cc: CC({ adv: false, reszleges: true }) }) }); assert.equal(k.posztok().length, 1); assert.equal(k.posztok()[0].body.hozz.adv, true, 'a hatalyos engedely');
  k = kliens({ search: URL_GOOGLE, suti: null, ls: tarolo({ mh_cc: CC() }) }); assert.equal(k.posztok().length, 1);
  // visszavonas az oldal betoltese UTAN: a tarolt erintes torlodik, torlo keres megy
  const s = hamisSuti({ adv: true }); k = kliens({ search: URL_GOOGLE, suti: s }); assert.equal(k.ss._m.has('mh_forras'), true);
  s.ertesit({ adv: false }); assert.equal(k.ss._m.has('mh_forras'), false); assert.equal(k.ls._m.has('mh_forras_l'), false); assert.deepEqual(k.posztok().pop().body, { hozz: { adv: false } });
  // megadas az oldal betoltese utan: az aktualis oldal erkezese most rogzitodik + POST az azonositoval
  const s2 = hamisSuti({ adv: false }); k = kliens({ search: URL_META, referrer: 'https://l.facebook.com/', suti: s2 }); const elotte = k.posztok().length;
  s2.ertesit({ adv: true }); assert.equal(sessionTouch(k).kp, 'fbclid'); assert.equal(k.posztok().length, elotte + 1); assert.equal(k.posztok().pop().body.forras.kv, FBCLID);
  // a mh_forras tarolo irasa elutasitassal / engedely nelkul: 0
  k = kliens({ search: URL_GOOGLE, suti: hamisSuti({ adv: false }) }); assert.equal(k.ls._irasok.filter((x) => /mh_forras/.test(x)).length + k.ss._irasok.filter((x) => /mh_forras|mh_lpt_potlas/.test(x)).length, 0);
});
test('D) kuld() (koszonooldali jelzes): a body additiv "forras" (tisztitott, azonosito-ertek nelkul) + "forras_tarolo" + "lpt_potlas" (csak tipusok); a latogatas-tarolo visszaallitasa; engedely nelkul egyik sem', async () => {
  const t = Math.floor(Date.now() / 1000);
  // a latogatas-tarolo (2 oras) ures sessionStorage mellett: 'latogatas'
  const l = { e: { v: 1, t: t - 300, rk: 'social', kp: 'fbclid', um: 'paid_social', us: 'meta', uc: 'K', gc: '12' }, lej: t + 3000 };
  let k = kliens({ pathname: '/fodrasz-ok', ls: tarolo({ mh_forras_l: JSON.stringify(l) }), ss: tarolo() });
  await k.mh.kuld({ source_id: BID, uzletag: 'fodrasz', tipus: 'foglalas' });
  let b = k.kuldesek()[0].body; assert.deepEqual(b.forras, { v: 1, t: t - 300, rk: 'social', kp: 'fbclid', um: 'paid_social', us: 'meta', uc: 'K', gc: '12' }); assert.equal(b.forras_tarolo, 'latogatas'); assert.equal(b.lpt_potlas, undefined);
  assert.equal(JSON.parse(k.ss._m.get('mh_forras')).b, 'l', 'visszairva a sessionStorage-ba a latogatas-jelzessel'); assert.equal(b.forras.b, undefined, 'a belso jelzes nem megy ki');
  // a munkamenet-erintes -> 'munkamenet'; + a foglalo-atadasnal jelolt, sutibol potolt tipusok
  k = kliens({ pathname: '/foglalas-ok', ss: tarolo({ mh_forras: JSON.stringify({ v: 1, t: t - 100, rk: 'search', kp: 'gclid', gc: '5' }), mh_lpt_potlas: 'gclid,fbclid,rendszer' }) });
  await k.mh.kuld({ source_id: BID, uzletag: 'headspa', tipus: 'foglalas' });
  b = k.kuldesek()[0].body; assert.equal(b.forras_tarolo, 'munkamenet'); assert.deepEqual(b.lpt_potlas, ['gclid', 'fbclid']); assert.equal(JSON.stringify(b).includes(GCLID), false);
  assert.equal(k.ss._m.has('mh_lpt_potlas'), false, 'a sikeres kuldes utan a jelzes torolve');
  // lejart latogatas-tarolo: nincs forras; elutasitas: nincs forras / potlas
  k = kliens({ pathname: '/foglalas-ok', ls: tarolo({ mh_forras_l: JSON.stringify({ ...l, lej: t - 1 }) }) }); await k.mh.kuld({ source_id: BID, uzletag: 'headspa', tipus: 'foglalas' }); assert.equal(k.kuldesek()[0].body.forras, undefined); assert.equal(k.ls._m.has('mh_forras_l'), false, 'a lejart tarolo torolve');
  k = kliens({ pathname: '/foglalas-ok', suti: hamisSuti({ adv: false }), ss: tarolo({ mh_forras: JSON.stringify({ v: 1, t, rk: 'nincs' }), mh_lpt_potlas: 'gclid' }) }); await k.mh.kuld({ source_id: BID, uzletag: 'headspa', tipus: 'foglalas' });
  b = k.kuldesek()[0].body; assert.equal(b.forras, undefined); assert.equal(b.lpt_potlas, undefined); assert.ok(b.attr && b.hozz, 'a meglevo mezok valtozatlanok');
  // a meglevo body-mezok valtozatlanok; a hiba (tiltott tarolo) nem akadalyoz
  k = kliens({ pathname: '/foglalas-ok', ss: { getItem() { throw new Error('tiltott'); }, setItem() { throw new Error('tiltott'); }, removeItem() { throw new Error('tiltott'); } } });
  await k.mh.kuld({ source_id: BID, uzletag: 'headspa', tipus: 'foglalas' }); assert.equal(k.kuldesek().length, 1);
});
test('D) lptKlikk(): a GET egyszer indul (memoria), az eredmeny a megjovetel utan latszik; hozzajarulas nelkul nem is kerjuk; hibas / idegen valasz / hiba / idotullepes = {}', async () => {
  const valasz = { ok: true, suti: true, platform: 'meta', kor_nap: 2, klikk: { fbclid: FBCLID } };
  let k = kliens({ pathname: '/foglalo-motor', suti: hamisSuti({ adv: true }), lptValasz: valasz });
  assert.deepEqual(k.j(k.mh.lptKlikk()), {}, 'az elso hivas {}: a lekeres meg uton van (az atadas nem var ra)');
  assert.deepEqual(k.j(await k.mh.lptKlikkVar()), { fbclid: FBCLID }); assert.deepEqual(k.j(k.mh.lptKlikk()), { fbclid: FBCLID });
  k.mh.lptKlikk(); k.mh.lptKlikk(); await k.mh.lptKlikkVar(); assert.equal(k.hivasok.filter((h) => h.metodus === 'GET').length, 1, 'egyszer kerjuk le');
  const g = k.hivasok.find((h) => h.metodus === 'GET'); assert.equal(g.u, '/api/mosaic-forras'); assert.equal(g.o.credentials, 'same-origin'); assert.equal(g.o.cache, 'no-store');
  // visszavonas a lekeres utan: ures
  const s = hamisSuti({ adv: true }); k = kliens({ suti: s, lptValasz: valasz }); await k.mh.lptKlikkVar(); assert.deepEqual(k.j(k.mh.lptKlikk()), { fbclid: FBCLID }); s.adv = false; s.ertesit({ adv: false }); assert.deepEqual(k.j(k.mh.lptKlikk()), {});
  // engedely nelkul: nem is kerjuk le
  for (const opt of [{ suti: hamisSuti({ adv: false }) }, { suti: null }]) { k = kliens({ ...opt, lptValasz: valasz }); assert.deepEqual(k.j(k.mh.lptKlikk()), {}); assert.deepEqual(k.j(await k.mh.lptKlikkVar()), {}); assert.equal(k.hivasok.filter((h) => h.metodus === 'GET').length, 0); }
  // hibas / idegen valaszok
  for (const rossz of [null, {}, { ok: false }, { ok: true, klikk: [] }, { ok: true, klikk: { gclid: 'rovid', fbclid: 'a.b.c.d.e.f.g.h', ttclid: 5, ismeretlen: GCLID } }, 'szoveg', { ok: true, klikk: { gclid: '<script>x</script>xx' } }]) {
    k = kliens({ suti: hamisSuti({ adv: true }), lptValasz: rossz }); assert.deepEqual(k.j(await k.mh.lptKlikkVar()), {}, JSON.stringify(rossz));
  }
  k = kliens({ suti: hamisSuti({ adv: true }), fetchImpl: async () => { throw new Error('offline'); } }); assert.deepEqual(k.j(await k.mh.lptKlikkVar()), {});
  k = kliens({ suti: hamisSuti({ adv: true }), fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ ok: false, ki: true }) }) }); assert.deepEqual(k.j(await k.mh.lptKlikkVar()), {}, 'veszkapcsolo (503): ures');
  // idotullepes (6 mp): a fuggo lekeres {}-vel lezarul, a hivo nem akad el
  k = kliens({ suti: hamisSuti({ adv: true }), fetchImpl: () => new Promise(() => {}) }); const v = k.mh.lptKlikkVar(); k.idozitok.find((x) => x.ms === 6000).f(); assert.deepEqual(k.j(await v), {});
  // idegen host: nincs lekeres, nincs POST
  k = kliens({ host: 'evil.example', suti: hamisSuti({ adv: true }), search: URL_GOOGLE, lptValasz: valasz }); assert.deepEqual(k.j(await k.mh.lptKlikkVar()), {}); assert.equal(k.hivasok.length, 0);
  // a fetch hianya / dobo fetch nem dob hibat
  assert.doesNotThrow(() => kliens({ suti: hamisSuti({ adv: true }), search: URL_GOOGLE, fetchImpl: () => { throw new Error('boom'); } }).mh.lptKlikk());
});
test('D) klikkAzonositok / klikkReszletes: a bongeszobol jovo elsobbseget elvez (URL / mh_attr / _gcl / _fbc), a sutibol csak a hianyzo PLATFORM potlodik (a Google egy azonositot fogad el); engedely nelkul ures', async () => {
  const TAROLT = { gclid: 'Tarolt_gclid_0123456789', fbclid: 'Tarolt_fbclid_0123', ttclid: 'Tarolt.ttclid.0123' };
  const ts = Math.floor(Date.now() / 1000) - 1000;
  const lptV = { ok: true, suti: true, klikk: { gclid: 'Suti_gclid_0123456789' } };
  // csak a suti (azonosito nelkuli oldal, nincs mh_attr): potlas
  let k = kliens({ pathname: '/foglalo-motor', suti: hamisSuti({ adv: true }), lptValasz: { ok: true, klikk: { fbclid: FBCLID } } }); await k.mh.lptKlikkVar();
  assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: { fbclid: FBCLID }, lpt: ['fbclid'] }); assert.deepEqual(k.j(k.mh.klikkAzonositok()), { fbclid: FBCLID });
  // az URL elsobbseget elvez a suti felett (gclid az URL-ben, a sutiben mas gclid)
  k = kliens({ search: `?gclid=${GCLID}`, suti: hamisSuti({ adv: true }), lptValasz: lptV }); await k.mh.lptKlikkVar();
  assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: { gclid: GCLID }, lpt: [] });
  // a mh_attr (tarolt) is megelozi a sutit; a Google-cimke sutije (_gcl_aw) is
  k = kliens({ search: '?x=1', suti: hamisSuti({ adv: true }), ls: tarolo({ mh_cc: CC(), mh_attr: JSON.stringify({ v: 1, google: { gclid: { ertek: TAROLT.gclid, ts } }, meta: { fbclid: TAROLT.fbclid, ts }, tiktok: { ttclid: { ertek: TAROLT.ttclid, ts } } }) }), lptValasz: { ok: true, klikk: { gclid: 'Suti_gclid_0123456789' } } }); await k.mh.lptKlikkVar();
  assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: TAROLT, lpt: [] }, 'mh_attr: minden platform a bongeszobol');
  k = kliens({ search: '?x=1', suti: hamisSuti({ adv: true }), cookie: `_gcl_aw=GCL.1759759200.Gcl_aw_gclid_0123456789; _fbc=fb.1.${Date.now() - 1000}.Fbc_suti_fbclid_01`, lptValasz: { ok: true, klikk: { ttclid: TTCLID } } }); await k.mh.lptKlikkVar();
  assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: { gclid: 'Gcl_aw_gclid_0123456789', fbclid: 'Fbc_suti_fbclid_01', ttclid: TTCLID }, lpt: ['ttclid'] }, '_gcl_aw, _fbc a bongeszobol; csak a TikTok a sutibol');
  // Google: ha a bongeszobol van barmilyen Google-azonosito, a sutibol NEM potlodik masik Google-kulcs
  k = kliens({ search: '?x=1', suti: hamisSuti({ adv: true }), ls: tarolo({ mh_cc: CC(), mh_attr: JSON.stringify({ v: 1, google: { gbraid: { ertek: GBRAID, ts } } }) }), lptValasz: { ok: true, klikk: { gclid: GCLID } } }); await k.mh.lptKlikkVar();
  assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: { gbraid: GBRAID }, lpt: [] });
  // 90 napnal regebbi mh_attr nem szamit: a suti potol
  k = kliens({ search: '?x=1', suti: hamisSuti({ adv: true }), ls: tarolo({ mh_cc: CC(), mh_attr: JSON.stringify({ v: 1, meta: { fbclid: TAROLT.fbclid, ts: ts - 95 * NAP } }) }), lptValasz: { ok: true, klikk: { fbclid: FBCLID } } }); await k.mh.lptKlikkVar();
  assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: { fbclid: FBCLID }, lpt: ['fbclid'] });
  // engedely nelkul / elutasitas utan MINDEN ures (a szivargas kapuja)
  for (const opt of [{ suti: hamisSuti({ adv: false }) }, { suti: null }]) {
    k = kliens({ search: URL_GOOGLE + '&fbclid=' + FBCLID, cookie: '_gcl_aw=GCL.1759759200.Gcl_aw_gclid_0123456789; _fbc=fb.1.1759759200000.Fbc_suti_fbclid_01', ls: tarolo({ mh_attr: JSON.stringify({ v: 1, google: { gclid: { ertek: TAROLT.gclid, ts } } }) }), lptValasz: lptV, ...opt });
    assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: {}, lpt: [] }); assert.deepEqual(k.j(k.mh.klikkAzonositok()), {}); assert.deepEqual(k.j(k.mh.googleAzonositok()), {});
  }
  // visszavonas a lekeres utan
  const s = hamisSuti({ adv: true }); k = kliens({ suti: s, lptValasz: lptV }); await k.mh.lptKlikkVar(); assert.ok(k.mh.klikkAzonositok().gclid); s.ertesit({ adv: false }); assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: {}, lpt: [] });
  // lptJelol: csak ismert tipusok, engedellyel; ures lista torli
  k = kliens({ suti: hamisSuti({ adv: true }) }); k.mh.lptJelol(['gclid', 'x', 'gclid', 'ttclid']); assert.equal(k.ss._m.get('mh_lpt_potlas'), 'gclid,ttclid'); k.mh.lptJelol([]); assert.equal(k.ss._m.has('mh_lpt_potlas'), false);
  k = kliens({ suti: hamisSuti({ adv: false }) }); k.mh.lptJelol(['gclid']); assert.equal(k.ss._m.has('mh_lpt_potlas'), false);
});
test('D) hibatures: tiltott tarolo / hianyzo URL, URLSearchParams, performance, fetch es setTimeout mellett az oldal es a foglalas nem torik; a googleAzonositok() visszafele kompatibilis', () => {
  const dob = () => { throw new DOMException('tiltott tarolo', 'SecurityError'); };
  const tilt = { getItem: dob, setItem: dob, removeItem: dob };
  assert.doesNotThrow(() => kliens({ search: URL_GOOGLE, ls: tilt, ss: tilt, suti: hamisSuti({ adv: true }) }));
  const k = kliens({ search: URL_GOOGLE, ls: tilt, ss: tilt, suti: hamisSuti({ adv: true }) }); assert.equal(k.posztok().length, 1, 'tarolo nelkul is megy a POST (a suti a szerveren)');
  assert.doesNotThrow(() => kliens({ search: URL_GOOGLE, suti: hamisSuti({ adv: true }), fetchImpl: () => { throw new Error('boom'); } }));
  assert.doesNotThrow(() => kliens({ search: URL_GOOGLE, suti: hamisSuti({ adv: true }), fetchImpl: async () => { throw new Error('offline'); } }));
  // regi harness: nincs URL / performance (mint a regi tesztekben) - az oldal tovabbra is betolt
  const win = { }; const ctx = { document: { cookie: '' }, localStorage: tarolo({ mh_cc: CC() }), sessionStorage: tarolo(), location: { hostname: 'www.mosaicheadspa.hu', search: URL_GOOGLE, origin: 'https://www.mosaicheadspa.hu', pathname: '/x' }, URLSearchParams, Date, JSON, Math, Promise, String, Object, encodeURIComponent, decodeURIComponent, RegExp };
  win.top = win; win.self = win; Object.assign(win, ctx); win.window = win; vm.createContext(win); assert.doesNotThrow(() => vm.runInContext(ATTR, win)); assert.equal(typeof win.mhAttribucio.googleAzonositok, 'function');
  assert.deepEqual(JSON.parse(JSON.stringify(win.mhAttribucio.googleAzonositok())), { gclid: GCLID });
  assert.ok(!/document\.cookie\s*=|\.cookie\s*=/.test(ATTR), 'az attribucio.js nem allit sutit (a suti a szerver Set-Cookie-ja)');
  // idegen host: az attribucio.js tovabbra is mukodik (pillanatkep), a forras-meres nem
  const e = kliens({ host: 'evil.example', search: URL_GOOGLE, suti: hamisSuti({ adv: true }) }); assert.equal(e.hivasok.length, 0); assert.equal(e.ss._m.has('mh_forras'), false); assert.equal(e.j(e.mh.pillanatkep()).google.gclid.ertek, GCLID);
  for (const host of ['www.mosaicheadspa.hu', 'mosaicheadspa.hu', 'claude-x.mosaic-d77.pages.dev', 'localhost', '127.0.0.1']) assert.equal(kliens({ host, search: URL_GOOGLE, suti: hamisSuti({ adv: true }) }).posztok().length, 1, host);
});

// ======================================================================== E) foglalo-oldali potlas (flow.js / engine.js / foglalo-pmu.js) + vedett fajlok
const SALONIC = 'https://www.mosaicheadspa.hu/lezer-ok?first_booking=true&service=Teszt&price=0&g=g:1&bookingUrl=https%3A%2F%2Fmosaic.salonic.hu%2FguestData%2F%3Fback%3Dmb_abc';
test('E) fillClickIds: mind az 5 azonosito, csak a HIANYZO kulcs, az URL-beli elsobbseget elvez, tipusonkenti minta, a Google egy azonositot fogad el; fillGoogleIds valtozatlan', () => {
  assert.deepEqual([...CLICK_KEYS], ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid']); assert.deepEqual([...GOOGLE_KEYS], ['gclid', 'gbraid', 'wbraid']);
  assert.deepEqual(fillClickIds({}, { gclid: GCLID, fbclid: FBCLID, ttclid: TTCLID }), { gclid: GCLID, fbclid: FBCLID, ttclid: TTCLID });
  assert.deepEqual(fillClickIds({ fbclid: 'URLBOL_fbclid_01' }, { fbclid: FBCLID, ttclid: TTCLID }), { fbclid: 'URLBOL_fbclid_01', ttclid: TTCLID }, 'az URL-bol jovo fbclid nyer');
  assert.deepEqual(fillClickIds({ gbraid: GBRAID }, { gclid: GCLID, fbclid: FBCLID }), { gbraid: GBRAID, fbclid: FBCLID }, 'Google: ha mar van egy, masik Google-kulcs nem kerul melle');
  assert.deepEqual(fillClickIds({ utm_source: 'x' }, {}), { utm_source: 'x' });
  assert.deepEqual(fillClickIds({}, { gclid: 'rovid', fbclid: 'a.b.c.d.e.f.g.h', ttclid: 'x y z w q r s t', gbraid: 5 }), {}, 'tipusonkenti minta (fbclid: nincs pont; gclid: >= 10)');
  assert.deepEqual(fillClickIds({}, { fbclid: 'abcdefgh', ttclid: 'a.b.c.d.e.f' }), { fbclid: 'abcdefgh', ttclid: 'a.b.c.d.e.f' }); assert.deepEqual(fillClickIds({}, { utm_source: 'google', msclkid: 'xxxxxxxxxxxx' }), {});
  assert.equal(fillClickIds(undefined, { gclid: GCLID }), undefined); assert.deepEqual(fillClickIds({}, null), {}); assert.deepEqual(fillClickIds({}, 'x'), {});
  assert.deepEqual(fillGoogleIds({}, { gclid: GCLID, fbclid: FBCLID }), { gclid: GCLID }, 'a regi R1 fuggveny csak a Google-kulcsokat toltotte');
});
test('E) handoffSearch / withAttribution: a koszonooldal URL-je megkapja a sutibol visszanyert gclid / fbclid / ttclid-et, ha az URL-ben nincs; az URL-beli es a Salonic URL-jeben levo elsobbseget elvez; a Salonic URL elotagja bajtra valtozatlan', () => {
  const ki = withAttribution(SALONIC, handoffSearch('?business=hair&service=konzult', { fbclid: FBCLID, ttclid: TTCLID }));
  assert.ok(ki.startsWith(SALONIC)); assert.equal(ki.slice(SALONIC.length), `&fbclid=${FBCLID}&ttclid=${TTCLID}`);
  assert.equal(withAttribution(SALONIC, handoffSearch('?x=1', { gclid: GCLID })).slice(SALONIC.length), `&gclid=${GCLID}`);
  // URL-ben mar van: a keres valtozatlan (a kontextus nem irja felul); a Salonic URL azonositoja is elsobbseget elvez
  assert.equal(handoffSearch(`?fbclid=URLBOL_fbclid_01&utm_source=meta`, { fbclid: FBCLID }), `?fbclid=URLBOL_fbclid_01&utm_source=meta`);
  assert.equal(withAttribution(SALONIC + '&gclid=SALONICBOL_gclid_0123', handoffSearch('?x=1', { gclid: GCLID })), SALONIC + '&gclid=SALONICBOL_gclid_0123');
  assert.equal(handoffSearch('?a=1', { fbclid: 'a.b.c.d.e.f.g.h' }), '?a=1', 'hibas minta: nem kerul hozza'); assert.equal(handoffSearch('', {}), ''); assert.equal(handoffSearch('?a=1', undefined), '?a=1');
  assert.equal(withAttribution(SALONIC, handoffSearch('?utm_source=meta&fbclid=URLBOL_fbclid_01', { fbclid: 'URLBOL_fbclid_01' })).slice(SALONIC.length), '&fbclid=URLBOL_fbclid_01&utm_source=meta', 'az URL-bol jovo UTM tovabbra is megy');
});
test('E) lptPotlas: a kontextus attribution-jat a klikkReszletes() azonositoival egesziti ki, a SUTIBOL potolt kulcsokat jelzi (lptJelol); hiba / hianyzo mhAttribucio = semmi nem valtozik', () => {
  const jelolt = []; const ma = (r) => ({ klikkReszletes: () => r, lptJelol: (k) => jelolt.push(k) });
  let att = { fbclid: 'URLBOL_fbclid_01' };
  assert.deepEqual(lptPotlas(att, ma({ ids: { fbclid: FBCLID, ttclid: TTCLID }, lpt: ['fbclid', 'ttclid'] })), ['ttclid'], 'az URL-beli fbclid nem potolt'); assert.deepEqual(att, { fbclid: 'URLBOL_fbclid_01', ttclid: TTCLID }); assert.deepEqual(jelolt.pop(), ['ttclid']);
  att = {}; assert.deepEqual(lptPotlas(att, ma({ ids: { gclid: GCLID, ttclid: TTCLID }, lpt: ['ttclid'] })), ['ttclid'], 'a bongeszobol jovo (gclid) is bekerul, de NEM "potolt"'); assert.deepEqual(att, { gclid: GCLID, ttclid: TTCLID });
  att = {}; assert.deepEqual(lptPotlas(att, ma({ ids: {}, lpt: [] })), []); assert.deepEqual(att, {}); assert.deepEqual(jelolt.pop(), []);
  for (const rossz of [undefined, null, {}, { klikkReszletes: () => null }, { klikkReszletes: () => ({}) }, { klikkReszletes: () => { throw new Error('boom'); } }, { klikkReszletes: () => ({ ids: { gclid: 'rovid' }, lpt: ['gclid'] }), lptJelol: () => { throw new Error('boom'); } }]) { att = { a: 1 }; assert.doesNotThrow(() => lptPotlas(att, rossz)); assert.equal(att.gclid, undefined); }
  assert.deepEqual(lptPotlas(undefined, ma({ ids: {}, lpt: [] })), []);
});
test('E) a valodi attribucio.js + flow.js: a motor indulasakor elindul a lekeres, az atadas a mar megjott eredmenyt hasznalja (nem var); hozzajarulas nelkul semmi nem kerul az URL-be; az URL-beli elsobbseget elvez', async () => {
  const atadas = async ({ search = '?business=laser', suti: s = hamisSuti({ adv: true }), lptValasz, var_ = true, cookie = '' } = {}) => {
    const k = kliens({ pathname: '/lezeres-szortelenites-budapest', search, suti: s, lptValasz, cookie });
    const win = { location: { search, pathname: '/lezeres-szortelenites-budapest' } };
    const ctx = parseContext(engineSearch({ business: 'laser' }, win)); // a motor indulasa
    fillGoogleIds(ctx.attribution, k.mh.googleAzonositok()); k.mh.lptKlikk(); // R1 + a lekeres inditasa
    if (var_) await k.mh.lptKlikkVar();
    const potolt = lptPotlas(ctx.attribution, k.mh);
    return { href: withAttribution(SALONIC, handoffSearch(win.location.search, ctx.attribution)), potolt, ss: k.ss, k };
  };
  const meta = { ok: true, suti: true, platform: 'meta', kor_nap: 4, klikk: { fbclid: FBCLID } };
  let r = await atadas({ suti: hamisSuti({ adv: true }), lptValasz: meta });
  assert.equal(r.href, SALONIC + `&fbclid=${FBCLID}`); assert.deepEqual([...r.potolt], ['fbclid']); assert.equal(r.ss._m.get('mh_lpt_potlas'), 'fbclid');
  // a GET meg nem ert vissza az atadaskor: nem varunk ra, az URL valtozatlan (a Salonic URL + a motor sajat azonositoi)
  r = await atadas({ suti: hamisSuti({ adv: true }), lptValasz: meta, var_: false }); assert.equal(r.href, SALONIC); assert.deepEqual([...r.potolt], []);
  // az URL-beli azonosito elsobbseget elvez: a sutiben mas azonosito van
  r = await atadas({ search: `?business=laser&fbclid=URLBOL_fbclid_01`, suti: hamisSuti({ adv: true }), lptValasz: meta }); assert.equal(r.href, SALONIC + '&fbclid=URLBOL_fbclid_01'); assert.deepEqual([...r.potolt], []);
  // Google / TikTok a sutibol
  r = await atadas({ suti: hamisSuti({ adv: true }), lptValasz: { ok: true, klikk: { gbraid: GBRAID } } }); assert.equal(r.href, SALONIC + `&gbraid=${GBRAID}`);
  r = await atadas({ suti: hamisSuti({ adv: true }), lptValasz: { ok: true, klikk: { ttclid: TTCLID } } }); assert.equal(r.href, SALONIC + `&ttclid=${TTCLID}`);
  // a hozzajarulas nelkul / kifejezett elutasitas utan a koszonooldal URL-je BAJTRA a main-beli (nincs semmi hozzafuzve)
  for (const opt of [{ suti: hamisSuti({ adv: false }) }, { suti: null }]) { r = await atadas({ ...opt, lptValasz: meta, cookie: '_gcl_aw=GCL.1759759200.Gcl_aw_gclid_0123456789' }); assert.equal(r.href, withAttribution(SALONIC, '?business=laser'), 'main-nel azonos'); assert.deepEqual([...r.potolt], []); assert.equal(r.k.hivasok.filter((h) => h.metodus === 'GET').length, 0); }
  // a jelolt tipusok a koszonooldali jelzesben utaznak
  const k = kliens({ pathname: '/foglalas-ok', suti: hamisSuti({ adv: true }), ss: r.ss }); r = await atadas({ suti: hamisSuti({ adv: true }), lptValasz: meta });
  const k2 = kliens({ pathname: '/foglalas-ok', suti: hamisSuti({ adv: true }), ss: tarolo({ mh_lpt_potlas: r.ss._m.get('mh_lpt_potlas') }) }); await k2.mh.kuld({ source_id: BID, uzletag: 'headspa', tipus: 'foglalas' });
  assert.deepEqual(k2.kuldesek()[0].body.lpt_potlas, ['fbclid']); void k;
});
test('E) engine.js bekotese (struktura): a lekeres a parseContext / R1 UTAN, a tracker ELOTT indul; az atadas a lptPotlas-t hasznalja a withAttribution ELOTT; az R1-es szabalyok valtozatlanok', () => {
  const i = ENGINE.indexOf('F.parseContext('), j = ENGINE.indexOf('F.fillGoogleIds(ctx.attribution'), l = ENGINE.indexOf('win.mhAttribucio.lptKlikk()'), k = ENGINE.indexOf('createTracker({ ctx');
  assert.ok(i > 0 && j > i && l > j && k > l, 'sorrend: parseContext -> fillGoogleIds -> lptKlikk -> createTracker');
  const h = ENGINE.indexOf('F.lptPotlas(ctx.attribution, win.mhAttribucio)'), a = ENGINE.indexOf('win.location.assign(F.withAttribution(href, F.handoffSearch(win.location.search, ctx.attribution)))');
  assert.ok(h > 0 && a > h, 'lptPotlas az atadas elott'); assert.match(ENGINE, /if \(HANDOFF\) \{\s*F\.lptPotlas\(/);
  assert.ok(!/await[^;\n]*lptKlikk/.test(ENGINE), 'az atadas nem var a lekeresre');
  assert.ok(!/F\.withAttribution\(href, win\.location\.search\)/.test(ENGINE));
  assert.ok(!/localStorage|document\.cookie|mh_attr/.test(ENGINE.slice(ENGINE.indexOf('F.lptPotlas'), ENGINE.indexOf('F.lptPotlas') + 400)), 'az engine kozvetlenul nem olvas sutit / tarolot');
});
// foglalo-pmu.js: a R3 blokk (a valodi attribucio.js a szulo ablak)
const PMU_BLOKK = (forras) => { const m = forras.match(/(  \/\/ R3 \(DECISION #196\/1\)[\s\S]*?\n  window\.mhKeretbenOldal = \(href\) => \{[\s\S]*?\n  \};)/); assert.ok(m, 'a foglalo-pmu.js R3 blokkja megvan'); return m[1]; };
function pmuAtiranyitas({ beagyazva = true, szulo = {}, mhAttribucio = true, idegen = false, stub = null } = {}) {
  const blokk = PMU_BLOKK(PMU); const atiranyitasok = [];
  const b = kliens(szulo); const fo = b.win; fo.location.assign = (u) => atiranyitasok.push(u);
  if (!mhAttribucio) delete fo.mhAttribucio; if (stub) fo.mhAttribucio = stub;
  if (idegen) Object.defineProperty(fo, 'mhAttribucio', { configurable: true, get() { throw new Error('SecurityError: cross-origin'); } });
  const sajat = { location: { assign: (u) => atiranyitasok.push('SAJAT:' + u), search: '' } }; const win = { top: fo, location: sajat.location };
  const ctx = { window: win, BEAGYAZVA: beagyazva, URL, URLSearchParams, $: () => ({ removeAttribute() {} }), allapot: {}, history: { replaceState() {} }, mutat() {}, BELEPES: { ido() {} } };
  vm.createContext(ctx); vm.runInContext(blokk, ctx);
  return { be: (href) => ctx.window.mhKeretbenOldal(href), atiranyitasok, b };
}
const PMU_HREF = 'https://www.mosaicheadspa.hu/pmu-ok?bookingUrl=https%3A%2F%2Fmosaic-pmu.salonic.hu%2FguestData%2F%3Fback%3Dmb_abcdefghijkl&x=1';
const kulcsok = (u) => Object.fromEntries(CLICK_KEYS.map((k) => [k, new URL(u).searchParams.get(k)]));
const NINCS = Object.fromEntries(CLICK_KEYS.map((k) => [k, null]));
test('E) foglalo-pmu.js: a siker utani atiranyitas (/pmu-ok) a sutibol visszanyert gclid / fbclid / ttclid-et is hordozza (csak a hianyzo platformot, a bongeszobol jovo elsobbseget elvez), a potlast jelzi; a mh_proba es a tobbi parameter valtozatlan', async () => {
  const futtat = async (szulo, valasz) => { const r = pmuAtiranyitas({ szulo: { suti: hamisSuti({ adv: true }), ...szulo, lptValasz: valasz } }); await r.b.mh.lptKlikkVar(); r.be(PMU_HREF); return r; };
  let r = await futtat({ search: '?x=1', pathname: '/sminktetovalas-budapest' }, { ok: true, klikk: { fbclid: FBCLID } });
  let u = new URL(r.atiranyitasok[0]); assert.deepEqual([u.pathname, u.searchParams.get('mh_proba'), u.searchParams.get('x')], ['/pmu-ok', 'pmu', '1']); assert.deepEqual(kulcsok(u.href), { ...NINCS, fbclid: FBCLID }); assert.equal(r.b.ss._m.get('mh_lpt_potlas'), 'fbclid');
  r = await futtat({ search: '?x=1' }, { ok: true, klikk: { gclid: GCLID } }); assert.deepEqual(kulcsok(r.atiranyitasok[0]), { ...NINCS, gclid: GCLID }); assert.equal(r.b.ss._m.get('mh_lpt_potlas'), 'gclid');
  r = await futtat({ search: '?x=1' }, { ok: true, klikk: { ttclid: TTCLID } }); assert.deepEqual(kulcsok(r.atiranyitasok[0]), { ...NINCS, ttclid: TTCLID });
  // a szulo URL-jeben levo azonosito (hirdetesbol erkezo landing) elsobbseget elvez; a sutibol csak a hianyzo platform
  r = await futtat({ search: `?fbclid=URLBOL_fbclid_01` }, { ok: true, klikk: { fbclid: FBCLID } }); assert.deepEqual(kulcsok(r.atiranyitasok[0]), { ...NINCS, fbclid: 'URLBOL_fbclid_01' }); assert.equal(r.b.ss._m.has('mh_lpt_potlas'), false, 'nem potolt (a bongeszobol jott)');
  r = await futtat({ search: `?gclid=${GCLID}` }, { ok: true, klikk: { gbraid: GBRAID } }); assert.deepEqual(kulcsok(r.atiranyitasok[0]), { ...NINCS, gclid: GCLID }, 'a Google egy azonositot fogad el');
  // a R3 viselkedes (Google a mh_attr-bol) valtozatlan
  const ts = Math.floor(Date.now() / 1000) - 100;
  r = await futtat({ search: '?x=1', ls: tarolo({ mh_cc: CC(), mh_attr: JSON.stringify({ v: 1, google: { gclid: { ertek: GCLID, ts }, wbraid: { ertek: WBRAID, ts } } }) }) }, { ok: true, klikk: {} }); assert.deepEqual(kulcsok(r.atiranyitasok[0]), { ...NINCS, gclid: GCLID, wbraid: WBRAID });
  // a Salonic URL-jeben mar meglevo azonosito nem irodik felul
  r = pmuAtiranyitas({ szulo: { suti: hamisSuti({ adv: true }), search: '?x=1', lptValasz: { ok: true, klikk: { fbclid: FBCLID } } } }); await r.b.mh.lptKlikkVar(); r.be(PMU_HREF + '&fbclid=SALONICBOL_fbclid_01'); assert.equal(kulcsok(r.atiranyitasok[0]).fbclid, 'SALONICBOL_fbclid_01');
  // nem beagyazva: a sajat ablak (nincs mhAttribucio): a main-nel azonos
  r = pmuAtiranyitas({ beagyazva: false, szulo: { suti: hamisSuti({ adv: true }), search: URL_META } }); r.be(PMU_HREF); assert.ok(r.atiranyitasok[0].startsWith('SAJAT:')); assert.equal(r.atiranyitasok[0].slice(6), (() => { const x = new URL(PMU_HREF); x.searchParams.set('mh_proba', 'pmu'); return x.href; })());
});
test('E) foglalo-pmu.js HOZZAJARULAS: elutasitas / dontes nelkul / hibas minta / idegen szulo / regebbi szulo-szkript: azonosito nelkul, hiba nelkul, a main-nel azonos; a sutibol potolt hibas alak eldobva', async () => {
  const main = (() => { const x = new URL(PMU_HREF); x.searchParams.set('mh_proba', 'pmu'); return x.href; })();
  const ts = Math.floor(Date.now() / 1000) - 100;
  for (const [nev, szulo] of [['adv:false', { suti: hamisSuti({ adv: false }) }], ['dontes nelkul, suti.js nelkul', { suti: null }], ['tarolt elutasitas', { suti: null, ls: tarolo({ mh_cc: CC({ adv: false }) }) }]]) {
    const r = pmuAtiranyitas({ szulo: { ...szulo, search: `?gclid=${GCLID}&fbclid=${FBCLID}&ttclid=${TTCLID}`, cookie: '_gcl_aw=GCL.1759759200.Gcl_aw_gclid_0123456789; _fbc=fb.1.1759759200000.Fbc_suti_fbclid_01', lptValasz: { ok: true, klikk: { fbclid: FBCLID } }, ls: (szulo.ls || tarolo({ mh_attr: JSON.stringify({ v: 1, google: { gclid: { ertek: GCLID, ts } } }) })) } });
    await r.b.mh.lptKlikkVar(); r.be(PMU_HREF); assert.equal(r.atiranyitasok[0], main, nev + ': bajtra azonos a main-nel'); assert.equal(r.b.hivasok.filter((h) => h.metodus === 'GET').length, 0, nev + ': nincs lekeres');
  }
  for (const [nev, opt] of [['nincs mhAttribucio', { mhAttribucio: false }], ['idegen eredetu szulo', { idegen: true }], ['regebbi szulo (csak googleAzonositok)', { stub: { googleAzonositok: () => ({ gclid: GCLID }) } }]]) {
    const r = pmuAtiranyitas({ ...opt, szulo: { suti: hamisSuti({ adv: true }), search: URL_META } }); assert.doesNotThrow(() => r.be(PMU_HREF), nev);
    assert.equal(r.atiranyitasok[0], nev.startsWith('regebbi') ? main + `&gclid=${GCLID}` : main, nev);
  }
  // melysegi vedelem: a szulo (barmi okbol) hibas alakot adna -> a PMU sajat mintaellenorzese eldobja
  const s = pmuAtiranyitas({ stub: { klikkReszletes: () => ({ ids: { gclid: '<script>alert(1)', gbraid: 'rovid', fbclid: 'a.b.c.d.e.f.g.h', ttclid: 'x y z w q r s t' }, lpt: ['gclid', 'fbclid', 'ttclid'] }), lptJelol() {} }, szulo: { suti: hamisSuti({ adv: true }) } }); s.be(PMU_HREF); assert.equal(s.atiranyitasok[0], main);
  // az elfogyott idopont tovabbra sem navigal
  const e = pmuAtiranyitas({ szulo: { suti: hamisSuti({ adv: true }) } }); e.be('https://www.mosaicheadspa.hu/foglalo-pmu'); assert.equal(e.atiranyitasok.length, 0);
  // struktura: a PMU csak az attribucio.js hozzajarulasi kapus API-jan at olvas
  const blokk = PMU_BLOKK(PMU).slice(PMU_BLOKK(PMU).indexOf('function googleAzonositokHozzaad'));
  for (const tilos of [/\.location\.search/, /URLSearchParams\(fo\./, /pillanatkep\s*\(/, /document\.cookie/, /localStorage/, /mh_attr/, /_gcl_/, /mh_lpt/, /sessionStorage/]) assert.ok(!tilos.test(blokk), 'tiltott kapu-megkerules: ' + tilos);
  // a lekeres a PMU indulasakor (nem a koszonooldalon)
  assert.match(PMU, /!\/\^\\\/pmu-\(ok\|vh\)\\\/\?\$\/\.test\(location\.pathname\)\) \{ const fo0 = BEAGYAZVA \? window\.top : window; if \(fo0\.mhAttribucio && typeof fo0\.mhAttribucio\.lptKlikk === 'function'\) fo0\.mhAttribucio\.lptKlikk\(\)/);
});
test('E) uzletag-lefedettseg (struktura): az attribucio.js MINDEN oldalra a <head>-be kerul (build); a koszonooldal-lista = a foglalas-kulcs.js / a build FOGLALAS_KOSZONO listaja; mind az 5 Salonic-host megvan; a foglalo-oldali potlas a motorban es a PMU-ban', () => {
  const build = olvas('tools/netlify-build.mjs');
  assert.match(build, /if \(!h\.includes\('assets\/js\/attribucio\.js'\)\) h = h\.replace\(\/<\\\/head>\/i, '<script src="\/assets\/js\/attribucio\.js" defer><\/script><\/head>'\);/, 'minden oldal <head>-je (nincs oldal-szures)');
  const koszono = [...build.match(/const FOGLALAS_KOSZONO = new Set\(\[([\s\S]*?)\]\.map/)[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
  assert.ok(koszono.length >= 17);
  const kliensLista = ATTR.match(/var KOSZONO_UT = \/\^\\\/\(([^)]*)\)/)[1].replace('success-foglalas[a-z0-9-]*', '').split('|').filter(Boolean);
  for (const x of koszono.filter((n) => !n.startsWith('success-foglalas'))) assert.ok(kliensLista.includes(x), 'a kliens koszonooldal-listajaban: ' + x);
  assert.ok(/success-foglalas\[a-z0-9-\]\*/.test(ATTR));
  const kulcs = olvas('assets/js/foglalas-kulcs.js');
  for (const [host, uz] of [['mosaicheadspa.salonic.hu', 'headspa'], ['mosaic-hair.salonic.hu', 'fodrasz'], ['mosaic-oxigen.salonic.hu', 'oxigen'], ['mosaic-elysion.salonic.hu', 'szor'], ['mosaic-pmu.salonic.hu', 'pmu']]) {
    assert.ok(kulcs.includes(`'${host}': '${uz}'`), host); assert.ok(UZLETAGAK.includes(uz));
  }
  assert.match(kulcs, /window\.mhAttribucio\.kuld\(\{ source_id: id, uzletag: UZLETAG\[u\.hostname\]/, 'a koszonooldali jelzes (kuld) valtozatlan: a forras-jelzest az attribucio.js kuld() viszi');
  for (const f of ['foglalas-ok', 'fodrasz-ok', 'elysion-ok', 'oxigenterapia-ok', 'pmu-ok']) assert.ok(koszono.includes(f), f);
  assert.ok(fs.existsSync(path.join(GYOKER, 'klon/foglalas-ok.html')) && fs.existsSync(path.join(GYOKER, 'foglalas/pmu-ok.html')));
});
test('E) VEDETT fajlok: a meres-erkezes burok a vedett kezelErkezes-t hivja (nem masolja), az LPT netlify/ alatti egyetlen fajlja a forras-lpt.js; a vedett fajlok letezese (a blob-hash-eket a meres-naplo rogziti, a PR-ek kulon dokumentaljak a valtozasukat)', () => {
  const burok = fs.readFileSync(path.join(GYOKER, 'functions/api/meres-erkezes.js'), 'utf8');
  assert.match(burok, /kezelErkezes[^;]*from ['"][^'"]*netlify\/lib\/meres\/vegpontok\.js['"]/, 'a burok a vedett vegpontok.js kezelErkezes-et hasznalja');
  assert.ok(fs.existsSync(path.join(GYOKER, 'netlify/lib/meres/forras-lpt.js')), 'forras-lpt.js');
  for (const f of ['netlify/lib/meres/qa-nap.js', 'netlify/lib/meres/esemeny-modell.js', 'netlify/lib/foglalas-kulcs.js', 'netlify/lib/meres/vegpontok.js', 'netlify/lib/meres/google-proba.js']) assert.ok(fs.existsSync(path.join(GYOKER, f)), f);
});

// ======================================================================== F) a riport-eszkoz (tools/lpt-riport-sql.mjs): csak SQL-eloallito / formazo
test('F) riport: a "megtalalt foglalasok" SQL a valodi meres_forras tablan (sqlite) a vart csoportositast / aggregatumot adja; csak suti + fizetett cimke; idoszak / uzletag / tipus szuro', async () => {
  const { d, env } = ujEnv();
  const kuld = (i, uz, cookie, forras) => erkezes(env, ERK({ source_id: ID(i), uzletag: uz, forras: forras || SES({ rk: 'nincs' }) }), { cookie });
  const meta = (kor, camp, ad) => suti({ v: 1, kp: 'fbclid', kv: FBCLID, um: 'paid_social', us: 'meta', uc: camp, uco: ad, t: NOW - kor * NAP });
  await kuld('a1', 'headspa', meta(1, 'K1', 'H1')); await kuld('a2', 'headspa', meta(3, 'K1', 'H1')); await kuld('a3', 'headspa', meta(5, 'K1', 'H1')); await kuld('a4', 'headspa', meta(2, 'K1', 'H2'));
  await kuld('a5', 'pmu', suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', gc: '777', ad: '55', t: NOW - 2 * NAP }));
  await kuld('a6', 'headspa', meta(1, 'K9', 'H9'), SES({ rk: 'search', kp: 'fbclid', um: 'paid_social', us: 'meta', uc: 'K9' })); // munkamenet: nem "megtalalt"
  await kuld('a7', 'headspa', meta(20, 'K1', 'H1')); // kesei: nem "megtalalt"
  await kuld('a8', 'oxigen', undefined); // nincs suti
  const q = R.sqlek({ tol: NOW - 10 * NAP, ig: NOW + NAP });
  const sorok = d.db.prepare(q.megtalalt.replace(/^--.*\n/, '')).all().map((r) => ({ ...r }));
  assert.deepEqual(sorok, [
    { uzletag: 'headspa', platform: 'meta', kampany: 'K1', hirdetes: 'H1', darab: 3, atlag_kor_nap: 3, min_kor_nap: 1, max_kor_nap: 5 },
    { uzletag: 'headspa', platform: 'meta', kampany: 'K1', hirdetes: 'H2', darab: 1, atlag_kor_nap: 2, min_kor_nap: 2, max_kor_nap: 2 },
    { uzletag: 'pmu', platform: 'google', kampany: '777', hirdetes: '55', darab: 1, atlag_kor_nap: 2, min_kor_nap: 2, max_kor_nap: 2 },
  ], 'uzletag -> platform -> kampany -> hirdetes; a kampany az utm_campaign, hianyaban a gad_campaignid; a hirdetes az utm_content, hianyaban az adid');
  // a segedlekerdezesek is futnak
  const meg = d.db.prepare(q.megoszlas.replace(/^--.*\n/, '')).all().map((r) => ({ ...r }));
  assert.deepEqual(meg.filter((r) => r.uzletag === 'headspa').sort((x, y) => x.bizonyitek_forras.localeCompare(y.bizonyitek_forras)), [{ uzletag: 'headspa', bizonyitek_forras: 'munkamenet', darab: 2 }, { uzletag: 'headspa', bizonyitek_forras: 'suti', darab: 4 }], 'mennyit hoz a suti');
  const kes = d.db.prepare(q.kesei.replace(/^--.*\n/, '')).all().map((r) => ({ ...r })); assert.equal(kes.length, 1); assert.equal(kes[0].darab, 1); assert.equal(kes[0].max_kor_nap, 20);
  for (const k of ['potolt', 'cimkek']) assert.ok(Array.isArray(d.db.prepare(q[k].replace(/^--.*\n/, '')).all()), k);
  // szurok: uzletag, idoszak (a [tol, ig) a jelzes ideje), tipus
  assert.equal(d.db.prepare(R.sqlek({ tol: NOW - 10 * NAP, ig: NOW + NAP, uzletag: 'pmu' }).megtalalt).all().length, 1);
  assert.equal(d.db.prepare(R.sqlek({ tol: NOW + 5, ig: NOW + NAP }).megtalalt).all().length, 0, 'az idoszakon kivuli sorok nincsenek benne');
  assert.equal(d.db.prepare(R.sqlek({ tol: NOW - 10 * NAP, ig: NOW + NAP, tipus: 'ajandekkartya' }).megtalalt).all().length, 0);
});
test('F) riport: az idoszak / szurok ellenorzottek (nincs injektalhato szoveg); a CLI sql / formaz', () => {
  assert.equal(R.idoErtek('2026-10-01'), Date.UTC(2026, 9, 1) / 1000); assert.equal(R.idoErtek('1790812800'), 1790812800);
  for (const rossz of ['', 'x', '2026-13-45', "1; DROP TABLE meres_forras", '2026-10-01T00:00', undefined, '123']) assert.throws(() => R.idoErtek(rossz), /ido|YYYY/, String(rossz));
  assert.throws(() => R.sqlek({ tol: '2026-10-02', ig: '2026-10-01' }), /tol utan/); assert.throws(() => R.sqlek({ tol: '2026-10-01', ig: '2026-11-01', uzletag: "x' OR 1=1 --" }), /uzletag/); assert.throws(() => R.sqlek({ tol: '2026-10-01', ig: '2026-11-01', tipus: 'x' }), /tipus/);
  const sql = R.fo(['sql', '--tol', '2026-10-01', '--ig', '2026-11-01', '--uzletag', 'pmu']);
  assert.match(sql, /bizonyitek_forras = 'suti'/); assert.match(sql, /uzletag = 'pmu'/); assert.match(sql, /tipus = 'foglalas'/); assert.match(sql, /ido >= 1790812800 AND ido < 1793491200/); assert.equal((sql.match(/^SELECT/gm) || []).length, 5);
  assert.equal((R.fo(['sql', '--tol', '2026-10-01', '--ig', '2026-11-01', '--lekerdezes', 'kesei']).match(/^SELECT/gm) || []).length, 1); assert.throws(() => R.fo(['sql', '--tol', '2026-10-01', '--ig', '2026-11-01', '--lekerdezes', 'x']), /lekerdezes/); assert.throws(() => R.fo(['x']), /hasznalat/);
  assert.ok(!/(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\s/i.test(sql.replace(/--.*\n/g, '')), 'csak olvaso lekerdezes');
});
test('F) riport: a kis cellak (darab < min) ket lepcsoben osszevonodnak (sulyozott atlag, min / max); a wrangler --json alak is jo; a formazas', () => {
  const sorok = [{ uzletag: 'headspa', platform: 'meta', kampany: 'K1', hirdetes: 'A', darab: 5, atlag_kor_nap: 2.4, min_kor_nap: 0, max_kor_nap: 6 }, { uzletag: 'headspa', platform: 'meta', kampany: 'K1', hirdetes: 'B', darab: 1, atlag_kor_nap: 3, min_kor_nap: 3, max_kor_nap: 3 },
    { uzletag: 'headspa', platform: 'meta', kampany: 'K1', hirdetes: 'C', darab: 2, atlag_kor_nap: 5, min_kor_nap: 4, max_kor_nap: 6 }, { uzletag: 'headspa', platform: 'meta', kampany: 'K2', hirdetes: 'A', darab: 1, atlag_kor_nap: 1, min_kor_nap: 1, max_kor_nap: 1 },
    { uzletag: 'pmu', platform: 'google', kampany: '7', hirdetes: '(nincs)', darab: 2, atlag_kor_nap: 4, min_kor_nap: 3, max_kor_nap: 5 }];
  const o = R.kisCellakOsszevonasa([{ results: sorok }], 3);
  assert.deepEqual(o.map((x) => [x.uzletag, x.platform, x.kampany, x.hirdetes, x.darab, x.atlag_kor_nap, x.min_kor_nap, x.max_kor_nap, x.kicsi]), [
    ['headspa', 'meta', 'K1', 'A', 5, 2.4, 0, 6, false], ['headspa', 'meta', 'K1', '(egyeb hirdetesek)', 3, 4.33, 3, 6, false], ['headspa', 'meta', '(egyeb kampanyok)', '(osszevont)', 1, 1, 1, 1, true], ['pmu', 'google', '(egyeb kampanyok)', '(osszevont)', 2, 4, 3, 5, true]]);
  assert.equal(o.reduce((a, x) => a + x.darab, 0), 11, 'az osszeg megmarad'); assert.equal(R.kisCellakOsszevonasa(sorok, 0).length, 5, 'min <= 1: nincs osszevonas'); assert.equal(R.kisCellakOsszevonasa(sorok, 1).length, 5);
  assert.deepEqual(R.sorokBol(sorok), sorok); assert.deepEqual(R.sorokBol({ results: sorok }), sorok); assert.deepEqual(R.sorokBol([{ results: sorok.slice(0, 2) }, { results: sorok.slice(2) }]), sorok); assert.throws(() => R.sorokBol('x'), /ismeretlen/);
  assert.match(R.tablaSzoveg(o, { formatum: 'md' }), /^\| uzletag \| platform/); assert.equal(R.tablaSzoveg(o).split('\n').length, 5);
});

// ======================================================================== G) review-javitasok: F1 (potlasi ablak), F2 (ts), F3 (suti-tajekoztato), F4 (forras_adv), ekezet, klikk_potolt
const attrOf = (d, id = BID) => JSON.parse(d.db.prepare('SELECT attr FROM meres_erkezes WHERE source_id = ?').get(id).attr);
test('G) F1: a SUTIBOL visszanyert azonosito MIND AZ 5 tipusra csak <= 7 napos kattintasnal (GET klikk + shadow-lanc attr-potlas); 8-30 nap: csak kor_nap + kesei jelzes, azonosito-potlas nincs', async () => {
  const t0 = Math.floor(Date.now() / 1000);
  const AZ = { gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID, fbclid: FBCLID, ttclid: TTCLID };
  for (const [kp, kv] of Object.entries(AZ)) {
    for (const [kor, bent] of [[6 * NAP + 23 * 3600, true], [7 * NAP - 60, true], [7 * NAP + 3600, false], [8 * NAP, false], [30 * NAP - 60, false]]) {
      const j = await ures(await GET({ cookie: suti({ v: 1, kp, kv, t: t0 - kor }) }));
      assert.equal(j.suti, true, `${kp} ${kor}`); assert.deepEqual(j.klikk, bent ? { [kp]: kv } : {}, `GET: ${kp} ${(kor / NAP).toFixed(2)} nap`); assert.equal(j.kor_nap, Math.floor(kor / NAP)); assert.equal(j.t, t0 - kor);
    }
    assert.equal((await ures(await GET({ cookie: suti({ v: 1, kp, kv, t: t0 - 31 * NAP }) }))).suti, false, '31 nap = nincs');
    // a shadow-lanc attr-potlasa ugyanazzal az ablakkal (Google is: a 8 napos gclid a SUTIBOL nem potlodik)
    for (const [kor, bent] of [[6 * NAP + 23 * 3600, true], [7 * NAP, true], [7 * NAP + 3600, false], [8 * NAP, false], [30 * NAP, false], [31 * NAP, false]]) {
      const { d, env } = ujEnv();
      const j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }) }), { cookie: suti({ v: 1, kp, kv, t: NOW - kor }) }));
      assert.equal(Object.keys(attrOf(d)).length > 0, bent, `attr: ${kp} ${(kor / NAP).toFixed(2)} nap`); assert.equal(j.forras.klikk_potolt, bent ? kp : null, `klikk_potolt: ${kp} ${(kor / NAP).toFixed(2)} nap`);
    }
  }
  assert.ok(L.potlasAblakban({ kor_s: 7 * NAP })); assert.ok(!L.potlasAblakban({ kor_s: 7 * NAP + 1 })); assert.ok(!L.potlasAblakban(null)); assert.equal(L.POTLAS_NAP, 7);
  // a 8-30 napos kattintas a cimkehez tovabbra is csak "kesei" jelzes (nem valtozott)
  const { env } = ujEnv(); const j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'search' }) }), { cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: NOW - 8 * NAP }) }));
  assert.deepEqual(j.forras, { cimke: 'organikus_direkt', bizonyitek_forras: 'munkamenet', klikk_potolt: null, kesei_fizetett: true });
});
test('G) F1 kliens: a klikkReszletes() mh_attr-aga Meta / TikTok csak <= 7 napos (ts) azonositot ad (ts nelkuli sem); a Google ag (mh_attr 90 nap, _gcl_aw) VALTOZATLAN; az _fbc ideje is szamit; a regi GET-valasz nem potlas', async () => {
  const ts = Math.floor(Date.now() / 1000);
  const attr = (kor) => JSON.stringify({ v: 1, google: { gclid: { ertek: 'Tarolt_gclid_0123456789', ts: ts - kor } }, meta: { fbclid: 'Tarolt_fbclid_0123', ts: ts - kor }, tiktok: { ttclid: { ertek: 'Tarolt.ttclid.0123', ts: ts - kor } } });
  const reszl = (kor, extra = {}) => { const k = kliens({ search: '?x=1', suti: hamisSuti({ adv: true }), ls: tarolo({ mh_attr: attr(kor) }), ...extra }); return k.j(k.mh.klikkReszletes()); };
  assert.deepEqual(reszl(6 * NAP + 23 * 3600).ids, { gclid: 'Tarolt_gclid_0123456789', fbclid: 'Tarolt_fbclid_0123', ttclid: 'Tarolt.ttclid.0123' }, '6 nap: mind');
  assert.deepEqual(reszl(8 * NAP).ids, { gclid: 'Tarolt_gclid_0123456789' }, '8 nap: a Meta / TikTok kiesik, a Google marad (R1: 90 nap)');
  assert.deepEqual(reszl(60 * NAP).ids, { gclid: 'Tarolt_gclid_0123456789' }, '60 napos Meta / TikTok = nem; a Google 60 napos mh_attr tovabbra is jo');
  assert.deepEqual(reszl(89 * NAP).ids, { gclid: 'Tarolt_gclid_0123456789' });
  const tsNelkul = kliens({ search: '?x=1', suti: hamisSuti({ adv: true }), ls: tarolo({ mh_attr: JSON.stringify({ v: 1, google: { gclid: { ertek: GCLID } }, meta: { fbclid: FBCLID }, tiktok: { ttclid: { ertek: TTCLID } } }) }) }); assert.deepEqual(tsNelkul.j(tsNelkul.mh.klikkReszletes()).ids, { gclid: GCLID }, 'ts nelkul a Meta / TikTok nem hasznalhato (a Google R1 viselkedese valtozatlan)');
  // a 8 napos mh_attr Meta helyett a (friss) suti potol
  const k = kliens({ search: '?x=1', suti: hamisSuti({ adv: true }), ls: tarolo({ mh_attr: attr(8 * NAP) }), lptValasz: { ok: true, t: ts - NAP, klikk: { fbclid: FBCLID, ttclid: TTCLID } } }); await k.mh.lptKlikkVar();
  assert.deepEqual(k.j(k.mh.klikkReszletes()), { ids: { gclid: 'Tarolt_gclid_0123456789', fbclid: FBCLID, ttclid: TTCLID }, lpt: ['fbclid', 'ttclid'] });
  // _fbc: a suti ideje (ms) is szamit
  const fbc = (ido) => `_fbc=fb.1.${ido}.Fbc_suti_fbclid_01`;
  assert.deepEqual(reszl(60 * NAP, { cookie: fbc((ts - 6 * NAP) * 1000) }).ids.fbclid, 'Fbc_suti_fbclid_01'); assert.equal(reszl(60 * NAP, { cookie: fbc((ts - 8 * NAP) * 1000) }).ids.fbclid, undefined, '8 napos _fbc: nem'); assert.equal(reszl(60 * NAP, { cookie: fbc(ts - 8 * NAP) }).ids.fbclid, undefined, 'masodperces _fbc-ido is');
  // vedelem: ha a GET-valasz t-je >7 napos, a klikk nem potlas (a szerver mar nem adja, de a kliens sem hiszi el)
  const v = kliens({ suti: hamisSuti({ adv: true }), lptValasz: { ok: true, t: ts - 9 * NAP, klikk: { gclid: GCLID } } }); assert.deepEqual(v.j(await v.mh.lptKlikkVar()), {});
  const v2 = kliens({ suti: hamisSuti({ adv: true }), lptValasz: { ok: true, t: ts - 2 * NAP, klikk: { gclid: GCLID } } }); assert.deepEqual(v2.j(await v2.mh.lptKlikkVar()), { gclid: GCLID });
});
test('G) F2: ugyanazt az azonositot az URL-parse nem belyegzi ujra (mindharom platform); csak UJ azonosito kap uj ts-t; a sutibol POTOLT azonosito a suti valodi kattintasi idejet kapja (csak a koszonooldalon); a koszonooldali parse lefut', async () => {
  const now = Math.floor(Date.now() / 1000), T1 = now - 3 * NAP, T2 = now - 2 * NAP, T3 = now - NAP;
  const tarolt = () => tarolo({ mh_attr: JSON.stringify({ v: 1, google: { gclid: { ertek: GCLID, ts: T1 } }, meta: { fbclid: FBCLID, ts: T2 }, tiktok: { ttclid: { ertek: TTCLID, ts: T3 } } }) });
  const pk = (k) => k.j(k.mh.pillanatkep());
  // 1) ugyanaz az azonosito az URL-ben (hirdetes-ujranyitas / ugyanaz az oldal): a ts marad, a localStorage is a regi ts-t kapja
  let ls = tarolt(); let k = kliens({ search: `?gclid=${GCLID}&fbclid=${FBCLID}&ttclid=${TTCLID}`, ls });
  let p = pk(k); assert.equal(p.google.gclid.ts, T1); assert.equal(p.meta.ts, T2); assert.equal(p.tiktok.ttclid.ts, T3);
  const mentett = JSON.parse(ls._m.get('mh_attr')); assert.deepEqual([mentett.google.gclid.ts, mentett.meta.ts, mentett.tiktok.ttclid.ts], [T1, T2, T3], 'a tarolt allapot sem belyegzodik ujra');
  assert.equal(p.meta.fbc, `fb.1.${T2 * 1000}.${FBCLID}`, 'az fbc ideje a regi ts');
  // 2) UJ azonosito: uj ts (most)
  k = kliens({ search: '?gclid=Uj_gclid_0123456789&fbclid=Uj_fbclid_0123&ttclid=Uj.ttclid.0123', ls: tarolt() }); p = pk(k);
  for (const x of [p.google.gclid.ts, p.meta.ts, p.tiktok.ttclid.ts]) assert.ok(Math.abs(x - now) <= 5, 'uj azonosito = uj ts');
  assert.equal(p.google.gclid.ertek, 'Uj_gclid_0123456789');
  // 3) koszonooldal: a sutibol POTOLT azonosito (marker) a suti valodi kattintasi idejet kapja, nem a betoltes idejet
  const CT = now - 5 * NAP;
  const koszono = (marker, o = {}) => kliens({ pathname: '/fodrasz-ok', search: `?first_booking=true&gclid=${GCLID}&fbclid=${FBCLID}&ttclid=${TTCLID}&bookingUrl=${encodeURIComponent('https://mosaic-hair.salonic.hu/guestData/?back=' + BID)}`, ss: tarolo(marker ? { mh_lpt_potlas: marker } : {}), ...o });
  k = koszono(`gclid:${CT},fbclid:${CT + 60},ttclid:${CT + 120}`); p = pk(k);
  assert.deepEqual([p.google.gclid.ts, p.meta.ts, p.tiktok.ttclid.ts], [CT, CT + 60, CT + 120]); assert.equal(p.meta.fbc, `fb.1.${(CT + 60) * 1000}.${FBCLID}`, 'a shadow-lanc fbc ideje a suti kattintasi ideje');
  await k.mh.kuld({ source_id: BID, uzletag: 'fodrasz', tipus: 'foglalas' }); const b = k.kuldesek()[0].body; assert.equal(b.attr.google.gclid.ts, CT); assert.equal(b.attr.meta.ts, CT + 60); assert.deepEqual(b.lpt_potlas, ['gclid', 'fbclid', 'ttclid']);
  // a tarolt (egyezo) azonosito ts-e elsobbseget elvez a markerrel szemben
  p = pk(koszono(`gclid:${CT}`, { ls: tarolt() })); assert.equal(p.google.gclid.ts, T1);
  // marker nelkul / nem koszonooldalon / ervenytelen idovel / a jelolt kulcshoz nem tartozo azonositora: a mostani ido
  for (const [nev, kk] of [['marker nelkul', koszono(null)], ['nem koszonooldal', kliens({ pathname: '/lezeres-szortelenites-budapest', search: `?gclid=${GCLID}&fbclid=${FBCLID}`, ss: tarolo({ mh_lpt_potlas: `gclid:${CT},fbclid:${CT}` }) })],
    ['jovobeli ido', koszono(`gclid:${now + 99999}`)], ['szoveg ido', koszono('gclid:x,fbclid:')], ['2020 elotti', koszono('gclid:1500000000')], ['120 napnal regebbi', koszono(`gclid:${now - 121 * NAP}`)], ['ismeretlen kulcs', koszono(`rendszer:${CT}`)]]) {
    assert.ok(Math.abs(pk(kk).google.gclid.ts - now) <= 5, nev);
  }
  assert.ok(Math.abs(pk(koszono(`ttclid:${CT}`)).google.gclid.ts - now) <= 5, 'a jelolt kulcshoz tartozo azonosito kap suti-idot, a tobbi nem');
  assert.equal(pk(koszono(`ttclid:${CT}`)).tiktok.ttclid.ts, CT);
  // hozzajarulas nelkul a koszonooldali parse is lefut (SZ-38 memoria-pillanatkep), a marker ts-t ad, de nem ir tarolot
  const nk = koszono(`gclid:${CT}`, { suti: hamisSuti({ adv: false }) }); assert.equal(pk(nk).google.gclid.ertek, GCLID); assert.equal(nk.ls._irasok.filter((x) => x === 'mh_attr').length, 0);
  // a marker ideje a GET-valaszbol jon: lptJelol "kulcs:t"
  const g = kliens({ pathname: '/foglalo-motor', suti: hamisSuti({ adv: true }), lptValasz: { ok: true, t: CT, klikk: { fbclid: FBCLID } } }); await g.mh.lptKlikkVar(); g.mh.lptJelol(['fbclid', 'gclid']); assert.equal(g.ss._m.get('mh_lpt_potlas'), `fbclid:${CT},gclid:${CT}`);
  const g2 = kliens({ suti: hamisSuti({ adv: true }), lptValasz: { ok: true, klikk: { fbclid: FBCLID } } }); await g2.mh.lptKlikkVar(); g2.mh.lptJelol(['fbclid']); assert.equal(g2.ss._m.get('mh_lpt_potlas'), 'fbclid', 'ido nelkul csak a kulcs');
  // a GET-valasz t mezoje a szerverrol
  assert.ok((await ures(await GET({ cookie: suti({ v: 1, kp: 'gclid', kv: GCLID, t: Math.floor(Date.now() / 1000) - NAP }) }))).t > 1600000000);
});
test('G) F4: a szerver a HATALYOS marketing-allapotot (forras_adv) hasznalja a suti-olvasashoz / potlashoz; a "hozz" (nyers mh_cc, SZ-38) valtozatlan; reszleges mh_cc eset', async () => {
  const cookie = suti({ v: 1, kp: 'gclid', kv: GCLID, um: 'cpc', us: 'google', uc: '1', t: NOW - NAP });
  const RESZLEGES = { ana: false, adv: false, fun: true, reszleges: true }; // a suti.js: dontes nelkul / reszleges bejegyzes = alapertek (granted); a nyers mh_cc adv:false
  let { d, env } = ujEnv();
  let j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }), hozz: RESZLEGES, forras_adv: true }), { cookie }));
  assert.deepEqual(j.forras, { cimke: 'google_nem_markas', bizonyitek_forras: 'suti', klikk_potolt: 'gclid', kesei_fizetett: false }, 'forras_adv:true -> a suti hasznalhato, a nyers hozz.adv:false ellenere');
  assert.equal(JSON.parse(d.db.prepare('SELECT hozz FROM meres_erkezes').get().hozz).adv, false, 'a meres_erkezes.hozz a nyers allapotot tarolja (SZ-38 valtozatlan)');
  assert.ok(attrOf(d).google, 'attr-potlas');
  // regi viselkedes forras_adv nelkul: a nyers hozz.adv === false tilt
  ({ d, env } = ujEnv()); j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }), hozz: RESZLEGES }), { cookie })); assert.equal(j.forras.bizonyitek_forras, 'munkamenet'); assert.deepEqual(attrOf(d), {});
  // forras_adv:false: a suti nem hasznalhato, hozz:{} ellenere
  ({ d, env } = ujEnv()); j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }), hozz: {}, forras_adv: false, lpt_potlas: ['gclid'] }), { cookie })); assert.deepEqual(j.forras, { cimke: 'organikus_direkt', bizonyitek_forras: 'munkamenet', klikk_potolt: null, kesei_fizetett: false }); assert.deepEqual(attrOf(d), {});
  // nem boolean forras_adv: figyelmen kivul marad (a nyers hozz dont)
  for (const rossz of ['igen', 1, 0, null, {}, 'false']) { ({ d, env } = ujEnv()); j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }), hozz: { adv: false }, forras_adv: rossz }), { cookie })); assert.equal(j.forras.bizonyitek_forras, 'munkamenet', String(rossz)); ({ d, env } = ujEnv()); j = await ures(await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }), hozz: {}, forras_adv: rossz }), { cookie })); assert.equal(j.forras.bizonyitek_forras, 'suti', String(rossz)); }
  assert.equal(L.advEngedett({ forras_adv: true, hozz: { adv: false } }), true); assert.equal(L.advEngedett({ forras_adv: false }), false); assert.equal(L.advEngedett({ hozz: { adv: false } }), false); assert.equal(L.advEngedett({}), true); assert.equal(L.advEngedett(null), true);
  // kliens: a kuld() additiv forras_adv-ot kuld (a hatalyos engedely), a hozz valtozatlan
  const kuldBody = async (opt) => { const k = kliens({ pathname: '/foglalas-ok', ...opt }); await k.mh.kuld({ source_id: BID, uzletag: 'headspa', tipus: 'foglalas' }); return k.kuldesek()[0].body; };
  let b = await kuldBody({ suti: hamisSuti({ adv: true }), ls: tarolo({ mh_cc: JSON.stringify({ v: 1, t: Date.now(), reszleges: true, ...RESZLEGES }) }) });
  assert.equal(b.forras_adv, true); assert.deepEqual(b.hozz, { ana: false, adv: false, fun: true }, 'a nyers mh_cc (SZ-38) valtozatlan');
  b = await kuldBody({ suti: hamisSuti({ adv: false }), ls: tarolo({ mh_cc: CC({ adv: false }) }) }); assert.equal(b.forras_adv, false); assert.equal(b.hozz.adv, false);
  b = await kuldBody({ suti: hamisSuti({ adv: true }) }); assert.equal(b.forras_adv, true); assert.deepEqual(b.hozz, {});
  b = await kuldBody({ suti: null }); assert.equal(b.forras_adv, false, 'suti.js es dontes nelkul nincs engedely');
  // vegpontol vegpontig: kliens-torzs -> szerver (reszleges mh_cc, suti.js granted): a suti hasznalhato
  const k = kliens({ pathname: '/foglalas-ok', suti: hamisSuti({ adv: true }), ls: tarolo({ mh_cc: JSON.stringify({ v: 1, t: Date.now(), reszleges: true, ...RESZLEGES }) }) }); await k.mh.kuld({ source_id: BID, uzletag: 'headspa', tipus: 'foglalas' });
  ({ d, env } = ujEnv()); j = await ures(await erkezes(env, k.kuldesek()[0].body, { cookie })); assert.equal(j.forras.bizonyitek_forras, 'suti');
});
test('G) ekezetmentesites: "Karacsonyi akcio" ekezetesen -> Karacsonyi_akcio (szerver es kliens); a kombinalo jelek torolve, utana a tiltott karakterek "_"; a suti tartalma is tisztitott', async () => {
  const ek = 'Kar\u00e1csonyi akci\u00f3'; // Karácsonyi akció
  assert.equal(L.utmTisztit(ek), 'Karacsonyi_akcio'); assert.equal(L.utmTisztit('\u0150szi \u0170R \u00c1rv\u00edzt\u0171r\u0151 t\u00fck\u00f6rf\u00far\u00f3g\u00e9p'), 'Oszi_UR_Arvizturo_tukorfurogep');
  assert.equal(L.utmTisztit('e\u0301s \u00f1'), 'es_n', 'osszetett (NFD) alak'); assert.equal(L.utmTisztit('\u03b1\u03b2'), null, 'nem latin: eldobva'); assert.equal(L.utmTisztit('\u00e9\u00e9'.repeat(70)).length, 100);
  const k = kliens({ search: `?fbclid=${FBCLID}&utm_source=meta&utm_medium=paid_social&utm_campaign=${encodeURIComponent(ek)}&utm_content=${encodeURIComponent('\u0151sz')}` });
  assert.equal(JSON.parse(k.ss._m.get('mh_forras')).uc, 'Karacsonyi_akcio'); assert.equal(JSON.parse(k.ss._m.get('mh_forras')).uco, 'osz'); assert.equal(k.posztok()[0].body.forras.uc, 'Karacsonyi_akcio');
  const r = await POST({ forras: { v: 1, kp: 'fbclid', kv: FBCLID, um: 'paid_social', us: 'meta', uc: ek } }); assert.equal(L.lptDekodol(ertekFejlecbol(r), Math.floor(Date.now() / 1000)).uc, 'Karacsonyi_akcio');
  const { d, env } = ujEnv(); await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }) }), { cookie: suti({ v: 1, kp: 'fbclid', kv: FBCLID, um: 'paid_social', us: 'meta', uc: ek, t: NOW - NAP }) }); assert.equal(sor(d).utm_campaign, 'Karacsonyi_akcio');
});
test('G) klikk_potolt csak akkor kerul a sorba / a valaszba, ha a potlas TENYLEG mentodott: az "esemeny mar kiment" (frissitve:false) agon nem', async () => {
  const { d, env } = ujEnv();
  await meresSema(d);
  d.db.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, letrehozva, frissitve) VALUES ('FoglalasElso:' || ?1, 'FoglalasElso', 'alap', 'meta', 'headspa', ?1, 'elkuldve', ?2, ?2)").run(BID, NOW);
  const cookie = suti({ v: 1, kp: 'fbclid', kv: FBCLID, um: 'paid_social', us: 'meta', t: NOW - NAP });
  const r = await erkezes(env, ERK({ forras: SES({ rk: 'nincs' }), lpt_potlas: ['fbclid'] }), { cookie }); const j = await ures(r);
  assert.equal(j.frissitve, false, 'az esemeny mar kiment'); assert.ok(j.forras, 'a cimke igy is megvan'); assert.equal(j.forras.klikk_potolt, null); assert.equal(sor(d).klikk_potolt, null);
  assert.equal(d.db.prepare('SELECT COUNT(*) AS n FROM meres_erkezes WHERE source_id = ?').get(BID).n, 0, 'az attr nem mentodott');
  // kontroll: ugyanez egy meg nem kiment foglalasnal potolt
  const j2 = await ures(await erkezes(env, ERK({ source_id: ID('z'), forras: SES({ rk: 'nincs' }), lpt_potlas: ['fbclid'] }), { cookie })); assert.equal(j2.frissitve, true); assert.equal(j2.forras.klikk_potolt, 'fbclid');
});
test('G) F3: a suti-tajekoztato (foglalas/suti-tajekoztato.html) 3.4 szakasza tenyszeru mh_lpt bejegyzest kapott (egyetlen <li>, a 3.4 szakaszban)', () => {
  const uj = fs.readFileSync(path.join(GYOKER, 'foglalas/suti-tajekoztato.html'), 'utf8');
  const sorok = uj.split('\n').filter((l) => l.includes('mh_lpt'));
  assert.equal(sorok.length, 1, 'pontosan egy mh_lpt bejegyzes'); const sor = sorok[0];
  for (const resz of ['Mosaic Head Spa', 'első fél', 'HttpOnly', 'mh_lpt', '30 nap', 'legutóbbi hirdetési kattintás', 'platform, kampányjelölés, kattintásazonosító', 'marketing-hozzájárulással', 'Süti beállítások']) assert.ok(sor.includes(resz), resz);
  assert.ok(sor.trim().startsWith('<li>') && sor.trim().endsWith('</li>')); assert.ok(uj.indexOf(sor) > uj.indexOf('3.4. Marketing') && uj.indexOf(sor) < uj.indexOf('<h2>4. Külső oldalak'), 'a 3.4 szakaszban van');
});
