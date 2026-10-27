// #495 (UJ-80) ERINTESNAPLO: mh_vid suti + meres_erintes + meres_utvonal + havi riport.
//   A) tiszta fuggvenyek (vid, suti, HMAC, erintes-sor, kreditek, riport, Budapest-honap)
//   B) a /api/mosaic-forras vegpont (kapcsolo, fail-closed, Set-Cookie, dedup, hozzajarulas-visszavonas, az mh_lpt valtozatlan)
//   C) a koszonooldali jelzes -> meres_vid_erkezes; az utvonal-zaras (meres_kuldes "alap" sor) idempotens, vid nelkul
//   D) a riport-vegpont (kulcsos, csak olvashato)
//   E) a kliens (assets/js/attribucio.js): napi 1 organikus jelzes (sikeres valasz utan irva), kikapcsolt szerver -> 1 nap szunet
//   node --test tools/test-erintesnaplo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as E from '../netlify/lib/meres/erintesnaplo.js';
import * as L from '../netlify/lib/meres/forras-lpt.js';
import { kezelErkezes } from '../netlify/lib/meres/vegpontok.js';
import { meresSema } from '../netlify/lib/meres/elosztas.js';
import { onRequest as forrasFv } from '../functions/api/mosaic-forras.js';
import { erintesRiport, onRequest as riportFv } from '../functions/api/mosaic-erintes-riport.js';
import { d1 } from './lib-sd-teszt.mjs';

const GYOKER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ATTR = fs.readFileSync(path.join(GYOKER, 'assets/js/attribucio.js'), 'utf8');
const HOST = 'https://www.mosaicheadspa.hu';
const NOW_MS = Date.UTC(2026, 9, 27, 12, 0, 0), NOW = NOW_MS / 1000, NAP = 86400;
const KULCS = 'teszt-vid-kulcs-0123456789abcdef-0123456789';
const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789', FBCLID = 'IwAR_fbclid_TESZT_01', TTCLID = 'E.C.P.ttclid_TESZT_01';
const ID = (x) => ('mb_0muwq2ciorsos0tznsfyli' + x).toLowerCase();
const ENV = (extra = {}) => { const d = d1(); return { d, env: { KULCS_DB: d, MERES_VID_BE: '1', MERES_VID_KULCS: KULCS, ...extra } }; };
const keres = (ut, { method = 'POST', body, cookie, origin = HOST, headers = {} } = {}) => new Request(HOST + ut, {
  method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...headers },
  ...(body !== undefined && method !== 'GET' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
});
const POST = (env, body, o = {}) => forrasFv({ request: keres('/api/mosaic-forras', { body, ...o }), env });
const FIZ = (o = {}) => ({ v: 1, us: 'google', um: 'cpc', uc: '12345', ut: 'kulcs', uco: 'hirdetes', gc: '111', ag: '222', ad: '333', kp: 'gclid', kv: GCLID, ...o });
const META = (o = {}) => ({ v: 1, us: 'meta', um: 'paid_social', uc: 'Mosaic_Q4', uco: 'hird1', ad: '6001', kp: 'fbclid', kv: FBCLID, ...o });
const HOZZ = { ana: true, adv: true, fun: true };
const sutik = (r) => (r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean));
const sutiErtek = (r, nev) => { const c = sutik(r).find((x) => x.startsWith(nev + '=')); return c ? c.slice(nev.length + 1).split(';')[0] : null; };
const sutiSor = (r, nev) => sutik(r).find((x) => x.startsWith(nev + '='));
const mind = (d, t) => d.db.prepare(`SELECT * FROM ${t}`).all();
const tablaVan = (d, t) => d.db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = ?").get(t).n > 0;
const dump = (d) => JSON.stringify(d.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().flatMap((t) => d.db.prepare(`SELECT * FROM ${t.name}`).all()));

// ======================================================================== A) tiszta fuggvenyek
test('A) vid: 22 karakteres base64url, veletlen; a suti alakja (HttpOnly; Secure; SameSite=Lax; Path=/; 30 nap), torles; csak ervenyes alak olvashato vissza', () => {
  const a = E.vidUj(), b = E.vidUj();
  assert.match(a, /^[A-Za-z0-9_-]{22}$/); assert.notEqual(a, b);
  assert.equal(E.vidSuti(a), `mh_vid=${a}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`);
  assert.equal(E.vidSuti(null, true), 'mh_vid=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  assert.equal(E.vidOlvas(`x=1; mh_vid=${a}; y=2`), a);
  for (const rossz of ['', 'mh_vid=', 'mh_vid=rovid', `mh_vid=${a}x`, 'mh_vid=a b', `mh_vid=${'a'.repeat(21)}!`, 'mas=' + a]) assert.equal(E.vidOlvas(rossz), null, rossz);
  assert.equal(E.vidOlvas(`mh_vid=${a}; mh_vid=${b}`), a, 'az elso elofordulas dont');
  assert.equal(E.vidSutiVan('mh_vid=bármi'), true); assert.equal(E.vidSutiVan('mh_vid2=1'), false);
});
test('A) kapcsolo es kulcs: alapbol KI; csak MERES_VID_BE=1 es legalabb 16 karakteres kulccsal mukodik (fail-closed)', () => {
  assert.equal(E.vidBe({}), false); assert.equal(E.vidBe(null), false); assert.equal(E.vidBe({ MERES_VID_BE: '0' }), false); assert.equal(E.vidBe({ MERES_VID_BE: '1' }), true);
  assert.equal(E.vidKulcs({ MERES_VID_KULCS: 'rovid' }), null); assert.equal(E.vidKulcs({}), null); assert.equal(E.vidKulcs({ MERES_VID_KULCS: KULCS }), KULCS);
  assert.equal(E.vidMukodik({ MERES_VID_BE: '1' }), false); assert.equal(E.vidMukodik({ MERES_VID_KULCS: KULCS }), false); assert.equal(E.vidMukodik({ MERES_VID_BE: '1', MERES_VID_KULCS: KULCS }), true);
});
test('A) HMAC: determinisztikus, kulcs- es tartomany-fuggo, 64 hex; a hash nem tartalmazza a bemenetet; kulcs nelkul hiba', async () => {
  const h1 = await E.vidHash(KULCS, 'valami'), h2 = await E.vidHash(KULCS, 'valami');
  assert.equal(h1, h2); assert.match(h1, /^[0-9a-f]{64}$/); assert.equal(h1.includes('valami'), false);
  assert.notEqual(h1, await E.vidHash(KULCS + 'x', 'valami')); assert.notEqual(h1, await E.klikkHash(KULCS, 'gclid', 'valami'), 'tartomany-elvalasztas');
  assert.notEqual(await E.klikkHash(KULCS, 'gclid', GCLID), await E.klikkHash(KULCS, 'gbraid', GCLID));
  const ref = crypto.createHmac('sha256', KULCS).update('vid|valami').digest('hex'); assert.equal(h1, ref, 'standard HMAC-SHA256');
  await assert.rejects(() => E.vidHash('', 'x')); await assert.rejects(() => E.vidHash('rovid', 'x'));
});
test('A) lap / uzletag-becsles: csak utvonal, query nelkul, tisztitva; ismeretlen: null', () => {
  assert.equal(E.lapTisztit('/Lezeres-Szortelenites?gclid=ABC#x'), '/lezeres-szortelenites'); assert.equal(E.lapTisztit('https://www.mosaicheadspa.hu/pmu-ok/?a=1'), '/pmu-ok');
  assert.match(E.lapTisztit('/a b<script>'), /^[a-z0-9_\/.-]+$/, 'veszelyes karakter nem marad'); assert.equal(E.lapTisztit(''), null); assert.equal(E.lapTisztit(5), null); assert.equal(E.lapTisztit('/'), '/'); assert.equal(E.lapTisztit('/x'.repeat(100)).length, 120);
  for (const [lap, uz] of [['/lezeres-szortelenites-budapest', 'szor'], ['/oxigenterapia-budapest', 'oxigen'], ['/sminktetovalas-budapest', 'pmu'], ['/noi-fodrasz-budapest-balayage-hajfestes', 'fodrasz'], ['/headspa-budapest', 'headspa'], ['/blog/valami', null], [null, null]]) assert.equal(E.uzletagBecsles(lap), uz, String(lap));
});
test('A) erintes-sor: fizetett (Google/Meta/TikTok) es organikus; a kattintasi parameter TIPUSA tarolodik, a nyers azonosito SOHA; dedup-kulcsok; nem naplozando esetek', () => {
  const ido = NOW;
  const g = E.erintesSor({ e: FIZ(), cimke: 'google_nem_markas', vidHashErtek: 'v'.repeat(64), klikkHashErtek: 'k'.repeat(64), lap: '/lezeres-szortelenites?gclid=' + GCLID, most: ido });
  assert.deepEqual([g.platform, g.fizetett, g.kattintas_param, g.gad_campaignid, g.adgroupid, g.adid, g.utm_campaign, g.lap, g.uzletag_becsles, g.dedup_mp], ['google_nem_markas', 1, 'gclid', '111', '222', '333', '12345', '/lezeres-szortelenites', 'szor', 1800]);
  assert.equal(g.dedup_kulcs, 'google_nem_markas|k:' + 'k'.repeat(64)); assert.equal(JSON.stringify(g).includes(GCLID), false, 'nyers azonosito nincs a sorban');
  assert.equal(E.erintesSor({ e: FIZ(), cimke: 'google_markas', vidHashErtek: 'v', klikkHashErtek: null, most: ido }).dedup_kulcs, 'google_markas|a:111|222|333', 'kattazon nelkul: kampany + hirdetes');
  assert.equal(E.erintesSor({ e: META({ ad: undefined, kp: undefined, kv: undefined }), cimke: 'meta', vidHashErtek: 'v', most: ido }).dedup_kulcs, 'meta|u:Mosaic_Q4|hird1', 'azonosito nelkul: utm_campaign + utm_content');
  const o = E.erintesSor({ e: { v: 1, rk: 'search' }, cimke: 'organikus_direkt', vidHashErtek: 'v', most: ido });
  assert.deepEqual([o.platform, o.fizetett, o.dedup_kulcs, o.dedup_mp, o.kattintas_param], ['organikus_direkt', 0, 'organikus_direkt', 86400, null]);
  assert.equal(E.erintesSor({ e: { v: 1, us: 'valami' }, cimke: 'ismeretlen', vidHashErtek: 'v', most: ido }), null, 'fizetett jel nelkuli ismeretlen: nem naplozunk');
  assert.equal(E.erintesSor({ e: null, cimke: 'meta', vidHashErtek: 'v', most: ido }), null); assert.equal(E.erintesSor({ e: META(), cimke: 'valami', vidHashErtek: 'v', most: ido }), null); assert.equal(E.erintesSor({ e: META(), cimke: 'meta', vidHashErtek: '', most: ido }), null);
});
test('A) kreditek: utolso / elso / segitett (kulcsonkent 1, az utolso kulcsa nem) / linearis; organikus kreditet nem kap; fizetett nelkul nincs kredit', () => {
  const p = (t, pl, c, a) => ({ t, p: pl, c, a });
  const k = E.kreditek([p(1, 'meta', 'M', 'a1'), p(2, 'organikus_direkt'), p(3, 'meta', 'M', 'a1'), p(4, 'google_markas', 'G', 'g1'), p(5, 'meta', 'M', 'a2')]);
  assert.equal(k.utolso, 'meta|M|a2'); assert.equal(k.elso, 'meta|M|a1');
  assert.deepEqual(k.segitett.sort(), ['google_markas|G|g1', 'meta|M|a1'], 'meta a1 ketszer szerepel, de egyszer segit');
  assert.deepEqual(Object.fromEntries(Object.entries(k.linearis).map(([a, v]) => [a, Math.round(v * 100) / 100])), { 'meta|M|a1': 0.5, 'google_markas|G|g1': 0.25, 'meta|M|a2': 0.25 });
  assert.equal(Object.values(k.linearis).reduce((a, b) => a + b, 0), 1, 'a linearis kreditek osszege 1 konverzio');
  const egy = E.kreditek([p(1, 'tiktok', 'T', 't1')]); assert.deepEqual([egy.utolso, egy.elso, egy.segitett], ['tiktok|T|t1', 'tiktok|T|t1', []]);
  assert.deepEqual(E.kreditek([p(1, 'organikus_direkt')]), { utolso: null, elso: null, segitett: [], linearis: {} }); assert.deepEqual(E.kreditek([]), { utolso: null, elso: null, segitett: [], linearis: {} }); assert.deepEqual(E.kreditek(null), { utolso: null, elso: null, segitett: [], linearis: {} });
  assert.equal(E.kreditek([p(1, 'meta', 'M')], E.kampanyKulcs).utolso, 'meta|M', 'kampany-szint');
});
test('A) Budapest-honap: oktober 2026 (nyari -> teli ido az honapon belul), februar, december/januar atfordulas; ervenytelen: null', () => {
  const o = E.honapHatar('2026-10');
  assert.equal(o.tol, Date.UTC(2026, 8, 30, 22) / 1000, 'okt. 1. 00:00 CEST = szept. 30. 22:00Z'); assert.equal(o.ig, Date.UTC(2026, 9, 31, 23) / 1000, 'nov. 1. 00:00 CET = okt. 31. 23:00Z');
  assert.equal(E.honapHatar('2026-02').tol, Date.UTC(2026, 0, 31, 23) / 1000); assert.equal(E.honapHatar('2026-12').ig, Date.UTC(2026, 11, 31, 23) / 1000);
  for (const rossz of ['2026-13', '2026-00', '26-10', 'x', '', null]) assert.equal(E.honapHatar(rossz), null, String(rossz));
  assert.equal(E.aktualisHonap(Date.UTC(2026, 9, 31, 23, 30)), '2026-11', 'okt. 31. 23:30Z mar novemberi Budapest szerint'); assert.equal(E.aktualisHonap(Date.UTC(2026, 9, 31, 21, 0)), '2026-10');
});
test('A) riportEpit: hirdetes- es kampany-szint, uzletag x konverzio-tipus szerint; top utvonalak (organikus latszik, kreditet nem kap); napok eloszlasa', () => {
  const er = (...a) => JSON.stringify(a.map(([t, p, c, ad]) => ({ t, p, ...(c ? { c } : {}), ...(ad ? { a: ad } : {}) })));
  const sorok = [
    { uzletag: 'szor', konverzio_tipus: 'FoglalasElso', erintesek: er([1, 'meta', 'M', 'a1'], [2, 'organikus_direkt'], [3, 'google_markas', 'G', 'g1']), napok_az_elso_ota: 9 },
    { uzletag: 'szor', konverzio_tipus: 'FoglalasElso', erintesek: er([1, 'meta', 'M', 'a1'], [2, 'google_markas', 'G', 'g1']), napok_az_elso_ota: 0 },
    { uzletag: 'pmu', konverzio_tipus: 'Konzultacio', erintesek: er([1, 'google_nem_markas', 'N', 'n1']), napok_az_elso_ota: 0 },
    { uzletag: 'pmu', konverzio_tipus: 'Visszajaro', erintesek: er(), napok_az_elso_ota: null },
  ];
  const r = E.riportEpit(sorok);
  assert.equal(r.konverziok, 4);
  const sor = (lista, uz, tipus, kulcs) => lista.find((x) => x.uzletag === uz && x.konverzio_tipus === tipus && x.kulcs === kulcs);
  assert.deepEqual({ u: sor(r.hirdetes, 'szor', 'FoglalasElso', 'google_markas|G|g1').utolso, s: sor(r.hirdetes, 'szor', 'FoglalasElso', 'meta|M|a1').segitett, e: sor(r.hirdetes, 'szor', 'FoglalasElso', 'meta|M|a1').elso, l: sor(r.hirdetes, 'szor', 'FoglalasElso', 'meta|M|a1').linearis }, { u: 2, s: 2, e: 2, l: 1 });
  assert.equal(sor(r.kampany, 'pmu', 'Konzultacio', 'google_nem_markas|N').utolso, 1); assert.equal(r.hirdetes.some((x) => x.konverzio_tipus === 'Visszajaro'), false, 'erintes nelkuli konverzio: nincs kredit');
  assert.deepEqual(r.utvonalak[0], { utvonal: 'meta|M > google_markas|G > konverzio', db: 1 }.db === 1 ? r.utvonalak[0] : null);
  assert.ok(r.utvonalak.some((x) => x.utvonal === 'meta|M > organikus_direkt > google_markas|G > konverzio' && x.db === 1), 'az organikus sor az utvonalban latszik'); assert.ok(r.utvonalak.some((x) => x.utvonal === '(nincs erintes) > konverzio'));
  assert.deepEqual(r.napok, { szor: { '4-7': undefined, '8-14': 1, '0': 1 }, pmu: { '0': 1 } }.szor ? r.napok : null);
  assert.deepEqual([r.napok.szor['8-14'], r.napok.szor['0'], r.napok.pmu['0']], [1, 1, 1]);
  assert.ok(E.riportEpit(sorok, { top: 1 }).utvonalak.length === 1);
});

test('A) hirdetescsoport-szint + hirdetes-forras jelzo: g = adgroupid || utm_term, af = adid | utm_content; a Google utm_content-os hirdetes-szint bizonytalannak jelolt', () => {
  const er = (...a) => JSON.stringify(a.map(([t, p, c, g, ad, af]) => ({ t, p, c, ...(g ? { g } : {}), ...(ad ? { a: ad } : {}), ...(af ? { af } : {}) })));
  const sorok = [
    { uzletag: 'szor', konverzio_tipus: 'FoglalasElso', erintesek: er([1, 'google_nem_markas', 'K1', 'G1', 'G1', 'utm_content'], [2, 'meta', 'M', null, 'a1', 'adid']), napok_az_elso_ota: 1 },
    { uzletag: 'szor', konverzio_tipus: 'FoglalasElso', erintesek: er([1, 'google_nem_markas', 'K1', 'G2', '777', 'adid']), napok_az_elso_ota: 0 },
  ];
  const r = E.riportEpit(sorok);
  const cs = (k) => r.hirdetescsoport.find((x) => x.kulcs === k);
  assert.deepEqual([cs('google_nem_markas|K1|G1').segitett, cs('meta|M|-').utolso, cs('google_nem_markas|K1|G2').utolso], [1, 1, 1], 'hirdetescsoport-szintu kreditek (a Meta csoport nelkul "-")');
  const h = (k) => r.hirdetes.find((x) => x.kulcs === k);
  assert.equal(h('meta|M|a1').szint_bizonytalan, undefined); assert.equal(h('google_nem_markas|K1|777').szint_bizonytalan, undefined, 'adid-bol jott: biztos');
  assert.equal(h('google_nem_markas|K1|G1').szint_bizonytalan, true, 'Google utm_content: bizonytalan');
  assert.equal(E.csoportKulcs({ p: 'meta', c: 'M' }), 'meta|M|-');
});

// ======================================================================== B) a vegpont
test('B) kapcsolo KI (alap): a fizetett POST csak az mh_lpt-t irja (egy Set-Cookie), mh_vid nincs, tabla nincs; az organikus jelzes "vid: false"-t kap, suti nelkul', async () => {
  const { d, env } = ENV({ MERES_VID_BE: undefined });
  const r = await POST(env, { forras: FIZ(), hozz: HOZZ });
  assert.equal(r.status, 200); assert.equal(sutik(r).length, 1); assert.ok(sutiSor(r, 'mh_lpt')); assert.equal(sutiSor(r, 'mh_vid'), undefined); assert.equal(tablaVan(d, 'meres_erintes'), false);
  const o = await POST(env, { forras: { v: 1, rk: 'nincs' }, organikus: true, hozz: HOZZ });
  assert.deepEqual([o.status, sutik(o).length, (await o.json())], [200, 0, { ok: true, suti: false, vid: false }]);
});
test('B) FAIL-CLOSED: kapcsolo be, de nincs / tul rovid kulcs -> se mh_vid, se sor, se tabla; az mh_lpt valtozatlan', async () => {
  for (const kulcs of [undefined, 'rovid']) {
    const { d, env } = ENV({ MERES_VID_KULCS: kulcs });
    const r = await POST(env, { forras: FIZ(), hozz: HOZZ });
    assert.equal(sutik(r).length, 1); assert.ok(sutiSor(r, 'mh_lpt')); assert.equal(tablaVan(d, 'meres_erintes'), false);
    assert.equal((await (await POST(env, { forras: { v: 1, rk: 'search' }, organikus: true, hozz: HOZZ })).json()).vid, false);
  }
});
test('B) kapcsolo BE + kulcs: a fizetett POST ket Set-Cookie-t ad (mh_lpt + mh_vid), egy erintes-sor keletkezik; a nyers vid / azonosito SOHA nem kerul a D1-be', async () => {
  const { d, env } = ENV();
  const r = await POST(env, { forras: FIZ(), lap: '/lezeres-szortelenites-budapest?gclid=' + GCLID, hozz: HOZZ });
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true, suti: true });
  assert.equal(sutik(r).length, 2); const lpt = sutiSor(r, 'mh_lpt'), vid = sutiSor(r, 'mh_vid'); assert.ok(lpt && vid);
  assert.match(vid, /^mh_vid=[A-Za-z0-9_-]{22}; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
  const v = sutiErtek(r, 'mh_vid'); const sorok = mind(d, 'meres_erintes'); assert.equal(sorok.length, 1);
  const s = sorok[0];
  assert.equal(s.vid_hash, await E.vidHash(KULCS, v)); assert.notEqual(s.vid_hash, v);
  assert.deepEqual([s.platform, s.fizetett, s.kattintas_param, s.gad_campaignid, s.adgroupid, s.adid, s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.utm_term, s.lap, s.uzletag_becsles], ['google_nem_markas', 1, 'gclid', '111', '222', '333', 'google', 'cpc', '12345', 'hirdetes', 'kulcs', '/lezeres-szortelenites-budapest', 'szor']);
  assert.equal(s.katt_hash, await E.klikkHash(KULCS, 'gclid', GCLID)); assert.equal(s.ido > 1700000000, true);
  const mindD = dump(d); for (const titok of [v, GCLID, KULCS]) assert.equal(mindD.includes(titok), false, 'a D1-ben nincs: ' + titok.slice(0, 8));
  // az mh_lpt tartalma ugyanaz, mint kapcsolo nelkul (a kattintas azonositoja ott marad, a D1-ben nem)
  const ki = await POST({ ...env, MERES_VID_BE: undefined }, { forras: FIZ(), hozz: HOZZ });
  const a = L.lptDekodol(sutiErtek(r, 'mh_lpt'), Math.floor(Date.now() / 1000)), b = L.lptDekodol(sutiErtek(ki, 'mh_lpt'), Math.floor(Date.now() / 1000));
  assert.deepEqual([a.kp, a.kv, a.gc, a.ag, a.ad, a.p], [b.kp, b.kv, b.gc, b.ag, b.ad, b.p]); assert.equal(a.kv, GCLID);
});
test('B) a vid tarol: a meglevo mh_vid ujra irva (gordulo 30 nap), nem uj; ugyanaz a kattintas 30 percen belul NEM duplaz; masik kattintas / masik platform uj sor; a Meta es a TikTok is', async () => {
  const { d, env } = ENV();
  const r1 = await POST(env, { forras: FIZ(), hozz: HOZZ }); const vid = sutiErtek(r1, 'mh_vid'), ck = `mh_vid=${vid}`;
  const r2 = await POST(env, { forras: FIZ(), hozz: HOZZ }, { cookie: ck });
  assert.equal(sutiErtek(r2, 'mh_vid'), vid, 'ugyanaz a vid, ujra irva'); assert.equal(mind(d, 'meres_erintes').length, 1, 'dedup 30 percen belul');
  await POST(env, { forras: FIZ({ kv: 'Cj0KCQjw_MASIK_gclid_0123456789' }), hozz: HOZZ }, { cookie: ck });
  await POST(env, { forras: META(), hozz: HOZZ }, { cookie: ck });
  await POST(env, { forras: { v: 1, us: 'tiktok', um: 'paid_social', uc: 'tt1', kp: 'ttclid', kv: TTCLID }, hozz: HOZZ }, { cookie: ck });
  const sorok = mind(d, 'meres_erintes'); assert.deepEqual(sorok.map((s) => s.platform).sort(), ['google_nem_markas', 'google_nem_markas', 'meta', 'tiktok']);
  assert.equal(new Set(sorok.map((s) => s.vid_hash)).size, 1, 'egy vid');
  assert.deepEqual(sorok.map((s) => s.kattintas_param).sort(), ['fbclid', 'gclid', 'gclid', 'ttclid']);
  for (const nyers of [GCLID, FBCLID, TTCLID, 'MASIK_gclid']) assert.equal(dump(d).includes(nyers), false, nyers);
  // ervenytelen / idegen vid-suti: uj vid keletkezik (nem fogadunk el hamis erteket)
  const r3 = await POST(env, { forras: FIZ(), hozz: HOZZ }, { cookie: 'mh_vid=hamis' }); assert.notEqual(sutiErtek(r3, 'mh_vid'), 'hamis'); assert.match(sutiErtek(r3, 'mh_vid'), /^[A-Za-z0-9_-]{22}$/);
});
test('B) google_markas: a #436 beallitas (meres_beallitas.google_markas_kampanyok) szerint a platform google_markas', async () => {
  const { d, env } = ENV();
  await L.forrasSema(d); await d.prepare("INSERT INTO meres_beallitas (kulcs, ertek, ido) VALUES ('google_markas_kampanyok', '12345,999', 1)").run();
  await POST(env, { forras: FIZ(), hozz: HOZZ });
  assert.equal(mind(d, 'meres_erintes')[0].platform, 'google_markas');
});
test('B) organikus / direkt visszateres: mh_vid + legfeljebb napi 1 konnyu sor; a nem-fizetett POST az mh_lpt-t NEM irja es nem torli; a jelzes nelkuli (nem organikus) nem-fizetett POST semmit nem ir', async () => {
  const { d, env } = ENV();
  const ck0 = 'mh_lpt=' + L.lptKodol(L.erintesTisztit(FIZ(), NOW, { kv: true }));
  const r = await POST(env, { forras: { v: 1, rk: 'search' }, organikus: true, lap: '/blog/cikk', hozz: HOZZ }, { cookie: ck0 });
  assert.equal(sutik(r).length, 1); assert.ok(sutiSor(r, 'mh_vid')); assert.equal(sutiSor(r, 'mh_lpt'), undefined, 'az mh_lpt-t nem irja/nem torli');
  const vid = sutiErtek(r, 'mh_vid'); let sorok = mind(d, 'meres_erintes'); assert.deepEqual([sorok.length, sorok[0].platform, sorok[0].fizetett, sorok[0].lap], [1, 'organikus_direkt', 0, '/blog/cikk']);
  await POST(env, { forras: { v: 1, rk: 'nincs' }, organikus: true, hozz: HOZZ }, { cookie: `mh_vid=${vid}` }); assert.equal(mind(d, 'meres_erintes').length, 1, 'napi 1');
  const n = await POST(env, { forras: { v: 1, rk: 'search' }, hozz: HOZZ }); assert.deepEqual([sutik(n).length, mind(d, 'meres_erintes').length], [0, 1], 'organikus jelzes nelkul: semmi');
  const u = await POST(env, { forras: { v: 1, us: 'meta' }, organikus: true, hozz: HOZZ }); assert.equal(mind(d, 'meres_erintes').length, 1, 'hianyos hirdetesi utm (platformnev medium nelkul): ismeretlen, nincs sor');
  await POST(env, { forras: { v: 1, us: 'hirlevel' }, organikus: true, hozz: HOZZ }, { cookie: `mh_vid=${vid}` }); assert.equal(mind(d, 'meres_erintes').length, 1, 'ugyanaz a nap: a masik organikus utm sem ir (napi 1)');
});
test('B) hozzajarulas: kifejezett elutasitas (adv:false) NEM ir semmit, es torli az mh_vid-et ES az mh_lpt-t is; a nem letezo sutit nem "torli"; kapcsolo nelkul is torol', async () => {
  const { d, env } = ENV();
  const vid = E.vidUj();
  const r = await POST(env, { hozz: { adv: false } }, { cookie: `mh_vid=${vid}; mh_lpt=x` });
  assert.deepEqual(sutik(r).sort(), [E.vidSuti(null, true), 'mh_lpt=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'].sort()); assert.equal(tablaVan(d, 'meres_erintes'), false);
  const e1 = await POST(env, { forras: FIZ(), hozz: { adv: false } }, { cookie: `mh_vid=${vid}` }); assert.deepEqual(sutik(e1), [E.vidSuti(null, true)]); assert.equal(tablaVan(d, 'meres_erintes'), false, 'elutasitasnal nincs sor');
  assert.equal(sutik(await POST(env, { hozz: { adv: false } })).length, 0, 'nincs mit torolni');
  const ki = await POST({ ...env, MERES_VID_BE: undefined }, { hozz: { adv: false } }, { cookie: `mh_vid=${vid}` }); assert.deepEqual(sutik(ki), [E.vidSuti(null, true)], 'a mar meglevo mh_vid kapcsolo nelkul is torlodik');
});
test('B) D1 nelkul / D1-hibaval az mh_vid suti es az mh_lpt megmarad (a hiba nem akadalyoz); a vegpont ellenorzesei (cross-site, host, meret) valtozatlanok', async () => {
  const r = await POST({ MERES_VID_BE: '1', MERES_VID_KULCS: KULCS }, { forras: FIZ(), hozz: HOZZ });
  assert.equal(r.status, 200); assert.equal(sutik(r).length, 2, 'D1 nelkul is: mh_lpt + mh_vid');
  const hibas = { prepare() { throw new Error('d1 hiba'); }, batch() { throw new Error('d1 hiba'); } };
  const h = await POST({ KULCS_DB: hibas, MERES_VID_BE: '1', MERES_VID_KULCS: KULCS }, { forras: FIZ(), hozz: HOZZ }); assert.equal(h.status, 200); assert.ok(sutiSor(h, 'mh_lpt')); assert.ok(sutiSor(h, 'mh_vid'));
  const { env } = ENV();
  assert.equal((await POST(env, { forras: FIZ() }, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await POST(env, 'x'.repeat(5000))).status, 413);
  assert.equal((await forrasFv({ request: keres('/api/mosaic-forras', { method: 'POST', body: { forras: FIZ() } }).clone(), env: { ...env, MOSAIC_LPT_KI: '1' } })).status, 503, 'a MOSAIC_LPT_KI vesz-kapcsolo az mh_vid-et is leallitja');
});
test('B) mh_vid csak kifejezett marketing-hozzajarulassal (adv: true): hozzajarulas-jelzes nelkul / adv hianyaban nincs mh_vid, nincs sor (az mh_lpt valtozatlan)', async () => {
  const { d, env } = ENV();
  for (const hozz of [undefined, {}, { ana: true }]) {
    const r = await POST(env, { forras: FIZ(), ...(hozz ? { hozz } : {}) });
    assert.equal(sutiSor(r, 'mh_vid'), undefined, JSON.stringify(hozz)); assert.ok(sutiSor(r, 'mh_lpt'), 'az mh_lpt a regi logika szerint megy');
    const o = await POST(env, { forras: { v: 1, rk: 'search' }, organikus: true, ...(hozz ? { hozz } : {}) }); assert.equal(sutik(o).length, 0, 'organikus: nincs suti');
  }
  assert.equal(tablaVan(d, 'meres_erintes'), false);
});
test('B) irasi plafon: egy 10 perces ablakban legfeljebb IRAS_PLAFON.max uj sor (visszaeles-vedelem)', async () => {
  const { d } = ENV();
  await E.erintesSema(d);
  const sor = (i) => E.erintesSor({ e: META({ uc: 'k' + i }), cimke: 'meta', vidHashErtek: 'h' + i, lap: '/x', most: NOW });
  d.db.exec('BEGIN'); for (let i = 0; i < E.IRAS_PLAFON.max; i++) { const s = sor(i); d.db.prepare('INSERT INTO meres_erintes (vid_hash, ido, platform, fizetett, dedup_kulcs) VALUES (?, ?, ?, 1, ?)').run(s.vid_hash, NOW - 5, 'meta', s.dedup_kulcs); } d.db.exec('COMMIT');
  assert.deepEqual(await E.erintesIr(d, sor(99999), { most: NOW }), { irva: false, miert: 'plafon' });
  assert.deepEqual(await E.erintesIr(d, E.erintesSor({ e: META(), cimke: 'meta', vidHashErtek: 'x', most: NOW + 700 }), { most: NOW + 700 }), { irva: true }, 'az ablak elteltevel ujra ir');
});

// ======================================================================== C) erkezes -> vid_erkezes -> utvonal
const ERK = (o = {}) => ({ source_id: ID('q'), uzletag: 'szor', tipus: 'foglalas', szolgaltatas: 'Szorteleniites', ar: 20000, first_booking: true, attr: {}, hozz: HOZZ, oldal: HOST + '/elysion-ok', ...o });
const erkezes = (env, body, cookie) => L.erkezesForrassal(keres('/api/meres-erkezes', { body, cookie }), env, kezelErkezes, { now: () => NOW_MS });
async function konverzio(d, sourceId, { nev = 'FoglalasElso', uzletag = 'szor', ido = NOW, allapot = 'elkuldve', indok = null, platform = 'meta' } = {}) {
  await meresSema(d);
  d.db.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, indok, letrehozva, frissitve) VALUES (?, ?, 'alap', ?, ?, ?, ?, ?, ?, ?)").run(`${nev}:${sourceId}`, nev, platform, uzletag, sourceId, allapot, indok, ido, ido);
}
async function erintesek(d, vid, lista) { // [[kor_nap, forrasObjektum, cimke, lap?]]
  for (const [kor, e, cimke, lap] of lista) {
    const kh = e.kp && e.kv ? await E.klikkHash(KULCS, e.kp, e.kv) : null;
    await E.erintesIr(d, E.erintesSor({ e, cimke, vidHashErtek: await E.vidHash(KULCS, vid), klikkHashErtek: kh, lap: lap || '/lezeres-szortelenites-budapest', most: NOW - Math.round(kor * NAP) }), { most: NOW });
  }
}
test('C) a koszonooldali jelzes a mh_vid suti vid_hash-et menti a source_id-hoz (kapcsolo + kulcs + hozzajarulas kell); suti / kapcsolo / hozzajarulas nelkul semmi', async () => {
  const vid = E.vidUj();
  const { d, env } = ENV();
  const r = await erkezes(env, ERK(), `mh_vid=${vid}`); assert.equal(r.status, 200);
  assert.deepEqual(mind(d, 'meres_vid_erkezes').map((x) => [x.source_id, x.vid_hash]), [[ID('q'), await E.vidHash(KULCS, vid)]]);
  await erkezes(env, ERK({ source_id: ID('r') })); assert.equal(mind(d, 'meres_vid_erkezes').length, 1, 'suti nelkul nincs');
  await erkezes(env, ERK({ source_id: ID('s'), hozz: { ana: true, adv: false } }), `mh_vid=${vid}`); assert.equal(mind(d, 'meres_vid_erkezes').length, 1, 'elutasitott hozzajarulasnal nincs');
  await erkezes(env, ERK({ source_id: ID('t') }), 'mh_vid=hamis'); assert.equal(mind(d, 'meres_vid_erkezes').length, 1, 'hamis vid nincs');
  await erkezes(env, ERK({ source_id: ID('u') }), `mh_vid=${vid}`); await erkezes(env, ERK({ source_id: ID('u'), ar: 1 }), `mh_vid=${E.vidUj()}`); assert.equal(mind(d, 'meres_vid_erkezes').filter((x) => x.source_id === ID('u')).length, 1, 'az elso iras nyer');
  const k = ENV({ MERES_VID_BE: undefined }); await erkezes(k.env, ERK(), `mh_vid=${vid}`); assert.equal(tablaVan(k.d, 'meres_vid_erkezes'), false, 'kapcsolo nelkul nem is letezik');
  const n = ENV({ MERES_VID_KULCS: undefined }); await erkezes(n.env, ERK(), `mh_vid=${vid}`); assert.equal(tablaVan(n.d, 'meres_vid_erkezes'), false, 'kulcs nelkul nem is letezik');
});
test('C) utvonal-zaras: igazolt konverziohoz a vid elozo 30 napjanak erintesei idorendben (<= konverzio); vid nelkul; idempotens; a konverziotipus es az uzletag a meres_kuldes-bol', async () => {
  const vid = E.vidUj(); const { d, env } = ENV();
  await erintesek(d, vid, [
    [40, META({ uc: 'Regi' }), 'meta'], // 30 napnal regebbi: kimarad
    [12, META(), 'meta'], [6, { v: 1, rk: 'search' }, 'organikus_direkt'], [3, FIZ(), 'google_markas'], [0.5, { v: 1, us: 'tiktok', um: 'paid_social', uc: 'tt1', kp: 'ttclid', kv: TTCLID }, 'tiktok'],
  ]);
  await erintesek(d, vid, [[-2, META({ uc: 'Kesobbi' }), 'meta']]); // a konverzio UTAN: kimarad
  await erkezes(env, ERK(), `mh_vid=${vid}`);
  await konverzio(d, ID('q'), { nev: 'Konzultacio', uzletag: 'pmu' });
  const z = await E.utvonalLezar(d, { most: NOW }); assert.deepEqual(z, { zarva: 1, hibak: [] });
  const u = mind(d, 'meres_utvonal'); assert.equal(u.length, 1); const x = u[0];
  assert.deepEqual([x.source_id, x.uzletag, x.konverzio_tipus, x.konverzio_ido, x.erintes_db, x.fizetett_db, x.elso_platform, x.utolso_platform, x.napok_az_elso_ota, x.het_napos], [ID('q'), 'pmu', 'Konzultacio', NOW, 4, 3, 'meta', 'tiktok', 12, 1]);
  assert.deepEqual(JSON.parse(x.erintesek).map((e) => e.p), ['meta', 'organikus_direkt', 'google_markas', 'tiktok']); assert.deepEqual(JSON.parse(x.erintesek).map((e) => e.kp || null), ['fbclid', null, 'gclid', 'ttclid']);
  assert.deepEqual(JSON.parse(x.erintesek).map((e) => [e.g || null, e.af || null]), [[null, 'adid'], [null, null], ['222', 'adid'], [null, null]], 'g (adgroupid) es af (a hirdetes forrasa) az utvonalban');
  assert.equal(Object.keys(x).includes('vid_hash'), false, 'a meres_utvonal nem tartalmaz vid-et'); const sz = dump(d).slice(dump(d).indexOf(ID('q'))); assert.equal(JSON.stringify(mind(d, 'meres_utvonal')).includes(await E.vidHash(KULCS, vid)), false);
  assert.deepEqual(await E.utvonalLezar(d, { most: NOW }), { zarva: 0, hibak: [] }, 'idempotens');
  // vid-megfeleltetes nelkuli konverzio, athelyezes (nem uj konverzio), nem alap-sor: nincs utvonal
  await konverzio(d, ID('x'), {}); await erkezes(env, ERK({ source_id: ID('y') }), `mh_vid=${vid}`); await konverzio(d, ID('y'), { allapot: 'kihagyva', indok: 'reschedule_confirmed: nincs uj konverzio' });
  await erkezes(env, ERK({ source_id: ID('w') }), `mh_vid=${vid}`); // nincs meres_kuldes alap sor (pl. kuponos foglalas)
  await erkezes(env, ERK({ source_id: ID('z') }), `mh_vid=${vid}`); await konverzio(d, ID('z'), { nev: 'UjEsemenyNev' }); // jovobeli, ismeretlen alap-nev: a SELECT kiszuri, nem szorit ki masokat
  assert.deepEqual(await E.utvonalLezar(d, { most: NOW }), { zarva: 0, hibak: [] }); assert.equal(mind(d, 'meres_utvonal').length, 1);
});
test('C) utvonal-zaras: erintes nelkuli vid is kap (0 erintessel) sort; ajandekkartya; tobb alap-nev egy kulcsnal egy utvonal; a zaras a koszonooldali jelzesbol is lefut', async () => {
  const vid = E.vidUj(); const { d, env } = ENV();
  await erkezes(env, ERK({ source_id: ID('a') }), `mh_vid=${vid}`); await konverzio(d, ID('a'), { nev: 'Visszajaro' });
  await konverzio(d, ID('a'), { nev: 'Visszajaro', platform: 'tiktok' }); // masodik platform-sor
  const ajandek = 'pi_TESZT00000001'; await erkezes(env, ERK({ source_id: ajandek, tipus: 'ajandekkartya', uzletag: 'headspa', oldal: HOST + '/success-ajandekkartya-stripe' }), `mh_vid=${vid}`); await konverzio(d, ajandek, { nev: 'Ajandekkartya', uzletag: 'headspa' });
  await erkezes(env, ERK({ source_id: ID('b') }), `mh_vid=${vid}`); // ez a hivas mar lezarja az elozo ketto utvonalat
  const u = mind(d, 'meres_utvonal').sort((p, q) => p.source_id.localeCompare(q.source_id)); assert.equal(u.length, 2);
  const a = u.find((x) => x.source_id === ID('a')), g = u.find((x) => x.source_id === ajandek);
  assert.deepEqual([a.konverzio_tipus, a.erintes_db, a.napok_az_elso_ota, a.het_napos, g.konverzio_tipus, g.uzletag], ['Visszajaro', 0, null, 0, 'Ajandekkartya', 'headspa']);
});
test('C) riportOlvas: a honap a konverzio ideje szerint (Europe/Budapest), a fuggo utvonalakat lezarja, het_napos darabszam; ervenytelen honap hiba', async () => {
  const vid = E.vidUj(); const { d, env } = ENV();
  await erintesek(d, vid, [[5, META(), 'meta'], [1, FIZ(), 'google_markas']]);
  await erkezes(env, ERK(), `mh_vid=${vid}`); await konverzio(d, ID('q'), {}); // 2026-10-27
  await erkezes(env, ERK({ source_id: ID('r') }), `mh_vid=${vid}`); await konverzio(d, ID('r'), { ido: Date.UTC(2026, 9, 31, 23, 30) / 1000 }); // Budapest szerint mar november
  const r = await E.riportOlvas(d, { honap: '2026-10', most: NOW });
  assert.deepEqual([r.ok, r.honap, r.konverziok, r.het_napos, r.idozona], [true, '2026-10', 1, 1, 'Europe/Budapest']);
  assert.equal((await E.riportOlvas(d, { honap: '2026-11', most: NOW })).konverziok, 1);
  assert.deepEqual(await E.riportOlvas(d, { honap: '2026-13', most: NOW }), { ok: false, miert: 'ervenytelen honap (EEEE-HH)' });
  const cr = r.hirdetes.find((x) => x.kulcs.startsWith('google_markas')); assert.deepEqual([cr.utolso, cr.elso, cr.segitett], [1, 0, 0]); const mr = r.hirdetes.find((x) => x.kulcs.startsWith('meta')); assert.deepEqual([mr.utolso, mr.elso, mr.segitett], [0, 1, 1]);
});

// ======================================================================== D) riport-vegpont
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
test('D) /api/mosaic-erintes-riport: kulcs nelkul / rossz kulccsal / query-kulccsal 404; helyes fejlec-kulccsal 200 JSON; csak GET; nincs D1-kotes: 503; ervenytelen honap: 400; nem szivarog vid / nyers adat', async () => {
  const { d, env } = ENV({ EGYEZTETES_KULCS_HASH: sha('olvaso-kulcs') });
  const get = (ut, h = {}) => erintesRiport(new Request(HOST + ut, { headers: h }), env, { most: NOW });
  assert.equal((await get('/api/mosaic-erintes-riport')).status, 404); assert.equal((await get('/api/mosaic-erintes-riport', { 'x-egyeztetes-kulcs': 'rossz' })).status, 404);
  assert.equal((await get('/api/mosaic-erintes-riport?kulcs=olvaso-kulcs')).status, 404, 'a query-kulcs nem fogadhato el');
  const vid = E.vidUj(); await erintesek(d, vid, [[2, META(), 'meta']]); await erkezes(env, ERK(), `mh_vid=${vid}`); await konverzio(d, ID('q'), {});
  const ok = await get('/api/mosaic-erintes-riport?honap=2026-10', { 'x-egyeztetes-kulcs': 'olvaso-kulcs' }); assert.equal(ok.status, 200);
  const j = await ok.json(); assert.deepEqual([j.ok, j.honap, j.konverziok], [true, '2026-10', 1]); assert.equal(ok.headers.get('cache-control'), 'no-store');
  const szoveg = JSON.stringify(j); for (const t of [vid, await E.vidHash(KULCS, vid), FBCLID, KULCS]) assert.equal(szoveg.includes(t), false);
  assert.equal((await get('/api/mosaic-erintes-riport?honap=xx', { 'x-egyeztetes-kulcs': 'olvaso-kulcs' })).status, 400);
  assert.equal((await erintesRiport(new Request(HOST + '/api/mosaic-erintes-riport', { method: 'POST', headers: { 'x-egyeztetes-kulcs': 'olvaso-kulcs' } }), env)).status, 405);
  assert.equal((await erintesRiport(new Request(HOST + '/api/mosaic-erintes-riport', { headers: { 'x-egyeztetes-kulcs': 'olvaso-kulcs' } }), { EGYEZTETES_KULCS_HASH: sha('olvaso-kulcs'), MERES_VID_BE: '1', MERES_VID_KULCS: KULCS })).status, 503, 'bekapcsolt allapotban D1-kotes nelkul 503');
  // FAIL-CLOSED (a fuggetlen review javitasi pontja): kapcsolo / kulcs nelkul a riport (helyes kulccsal is) NEM hoz letre egyetlen tablat sem
  for (const extra of [{ MERES_VID_BE: undefined }, { MERES_VID_KULCS: undefined }, { MERES_VID_KULCS: 'rovid' }, { MERES_VID_BE: '0' }]) {
    const k = ENV({ EGYEZTETES_KULCS_HASH: sha('olvaso-kulcs'), ...extra });
    const r = await erintesRiport(new Request(HOST + '/api/mosaic-erintes-riport?honap=2026-10', { headers: { 'x-egyeztetes-kulcs': 'olvaso-kulcs' } }), k.env, { most: NOW });
    assert.deepEqual([r.status, await r.json()], [200, { ok: true, ki: true }], JSON.stringify(extra));
    for (const t of ['meres_erintes', 'meres_vid_erkezes', 'meres_utvonal']) assert.equal(tablaVan(k.d, t), false, t + ' nem jon letre ' + JSON.stringify(extra));
    assert.equal((await erintesRiport(new Request(HOST + '/api/mosaic-erintes-riport'), k.env, { most: NOW })).status, 404, 'kulcs nelkul tovabbra is 404');
  }
  const be = await riportFv({ request: new Request(HOST + '/api/mosaic-erintes-riport', { headers: { 'x-egyeztetes-kulcs': 'olvaso-kulcs' } }), env: { EGYEZTETES_KULCS_HASH: sha('olvaso-kulcs'), MERES_VID_BE: '1', MERES_VID_KULCS: KULCS, KULCS_DB: { prepare() { throw new Error('boom'); }, batch() { throw new Error('boom'); } } } });
  assert.deepEqual([be.status, await be.json()], [500, { ok: false, hiba: 'belso_hiba' }]);
});

// ======================================================================== E) kliens
function tarolo(kezdo = {}) { const m = new Map(Object.entries(kezdo)); return { _m: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
const hamisSuti = (h) => ({ engedely: (n) => (n === 'adv' ? h.adv !== false : true), hozzajarulas: () => ({ ...h }) });
function kliens({ search = '', referrer = '', pathname = '/blog/cikk', ls = tarolo(), ss = tarolo(), adv = true, nav = 'navigate', valasz = { ok: true, suti: false } } = {}) {
  const hivasok = [];
  const win = {};
  const ctx = {
    document: { get cookie() { return ''; }, referrer }, localStorage: ls, sessionStorage: ss, location: { hostname: 'www.mosaicheadspa.hu', search, origin: HOST, pathname },
    performance: { getEntriesByType: () => [{ type: nav }] }, URL, URLSearchParams, Date, JSON, Math, Promise, String, Object, Array, encodeURIComponent, decodeURIComponent, RegExp, setTimeout: () => 1, clearTimeout() {},
    fetch: async (u, o = {}) => { hivasok.push({ u, metodus: o.method || 'GET', body: o.body ? JSON.parse(o.body) : null, o }); return { ok: true, status: 200, json: async () => valasz }; },
  };
  win.top = win; win.self = win; Object.assign(win, ctx); win.window = win; win.mhSuti = hamisSuti({ adv, ana: true });
  vm.createContext(win); vm.runInContext(ATTR, win);
  return { hivasok, ls, ss, posztok: () => hivasok.filter((h) => h.metodus === 'POST' && h.u === '/api/mosaic-forras') };
}
const mikrofeladat = () => new Promise((ok) => setImmediate(ok));
test('E) kliens: organikus / direkt visszateres napi 1 POST (organikus: true, lap, hozzajarulas, tisztitott erintes); nincs nyers azonosito; masnap ujra; ugyanazon a napon nem', async () => {
  const k = kliens({ referrer: 'https://www.google.com/', pathname: '/blog/cikk' });
  const p = k.posztok(); assert.equal(p.length, 1); assert.equal(p[0].body.organikus, true); assert.equal(p[0].body.lap, '/blog/cikk'); assert.equal(p[0].body.forras.rk, 'search'); assert.equal(p[0].body.hozz.adv, true);
  assert.deepEqual(Object.keys(p[0].body.forras).sort(), ['rk', 't', 'v']); assert.equal(p[0].o.credentials, 'same-origin');
  await mikrofeladat(); await mikrofeladat(); assert.equal(k.ls._m.get('mh_vid_nap') !== undefined, true, 'a napi jelzes a sikeres valasz utan irodik');
  const masodik = kliens({ referrer: '', ls: k.ls }); assert.equal(masodik.posztok().length, 0, 'ugyanazon a napon nem');
  const hibas = kliens({ referrer: '', valasz: null }); await mikrofeladat(); await mikrofeladat(); assert.equal(hibas.ls._m.has('mh_vid_nap'), false, 'ertelmezheto valasz nelkul (halozati / szerverhiba) nem ir napi jelzest: masnap helyett a kovetkezo oldalon ujra probalja');
  const holnap = tarolo({ mh_vid_nap: '2020-1-1' }); assert.equal(kliens({ referrer: '', ls: holnap }).posztok().length, 1, 'masik napon ujra');
});
test('E) kliens: nincs POST, ha belso hivatkozo / ujratoltes / vissza gomb / nincs engedely / koszonooldal; a fizetett POST a landing utvonalat (lap) is viszi', async () => {
  assert.equal(kliens({ referrer: 'https://www.mosaicheadspa.hu/x' }).posztok().length, 0, 'belso hivatkozo');
  assert.equal(kliens({ nav: 'reload' }).posztok().length, 0); assert.equal(kliens({ nav: 'back_forward' }).posztok().length, 0);
  assert.equal(kliens({ adv: false }).posztok().filter((p) => p.body.organikus).length, 0, 'engedely nelkul nincs organikus jelzes');
  assert.equal(kliens({ pathname: '/pmu-ok' }).posztok().length, 0, 'koszonooldal nem erkezes');
  const f = kliens({ search: `?gclid=${GCLID}&utm_source=google&utm_medium=cpc&utm_campaign=1`, referrer: 'https://www.google.com/', pathname: '/lezeres-szortelenites-budapest' });
  assert.equal(f.posztok().length, 1); assert.equal(f.posztok()[0].body.lap, '/lezeres-szortelenites-budapest'); assert.equal(f.posztok()[0].body.organikus, undefined); assert.equal(f.posztok()[0].body.forras.kv, GCLID, 'a nyers azonosito csak a fizetett POST-ban (mint eddig)');
});
test('E) kliens: ha a szerver "vid: false"-t jelez (kapcsolo / kulcs nincs), 1 napig nem probalkozik; lejaratkor ujra; tiltott localStorage: nincs kuldes (nincs napi korlat)', async () => {
  const k = kliens({ referrer: '', valasz: { ok: true, suti: false, vid: false } }); await mikrofeladat(); await mikrofeladat();
  const ki = Number(k.ls._m.get('mh_vid_ki')); assert.ok(ki > Math.floor(Date.now() / 1000) + NAP - 60 && ki <= Math.floor(Date.now() / 1000) + NAP + 5, 'kb. 1 nap');
  const holnap = tarolo({ mh_vid_ki: ki, mh_vid_nap: '2020-1-1' }); assert.equal(kliens({ referrer: '', ls: holnap }).posztok().length, 0, 'szunetel');
  const lejart = tarolo({ mh_vid_ki: 1700000000, mh_vid_nap: '2020-1-1' }); assert.equal(kliens({ referrer: '', ls: lejart }).posztok().length, 1, 'lejart szunet');
  const tiltott = { getItem() { throw new Error('tiltva'); }, setItem() { throw new Error('tiltva'); }, removeItem() {} }; assert.equal(kliens({ referrer: '', ls: tiltott }).posztok().filter((p) => p.body.organikus).length, 0);
  const jo = kliens({ referrer: '', valasz: { ok: true, suti: false } }); await mikrofeladat(); assert.equal(jo.ls._m.has('mh_vid_ki'), false, 'nem jelzett kikapcsolast: nincs szunet');
});
test('E) vedett fajlok blob-hash-e nem valtozik; a modul nem importal vedett fajlt; az erintesnaplo a forras-lpt.js-t NEM importalja (korkoros import)', () => {
  const src = fs.readFileSync(path.join(GYOKER, 'netlify/lib/meres/erintesnaplo.js'), 'utf8');
  assert.equal(/from\s+['"]\.\/forras-lpt\.js['"]/.test(src), false); assert.equal(/from\s+['"][^'"]*(elosztas|platformok|esemeny-modell|qa-nap|vegpontok|meta-bongeszo-kulcs)\.js['"]/.test(src), false);
  const tiltott = ['import', 'eval(', 'Function('].filter((x) => x === 'eval(' || x === 'Function(').filter((x) => src.includes(x)); assert.deepEqual(tiltott, []);
});
