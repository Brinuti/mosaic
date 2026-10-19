// Forras v2: last paid click (bongeszo-logika vm-ben), tisztitas, hivatkozo-kategoria, cimkez() (markas listaval),
// ismeretlen okok, mp_lpt suti hozzajarulas-kapuja, riport-lefedettseg, havi CSV. Kulso hivas NINCS.
//   node --test tools/test-mp-forras-v2.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { foglalasErkezes, _semaTorles } from '../lib/meres/lanc.js';
import { utmTisztit, bizonyitekBemenet, cimkez, forrasVegpont, lptOlvas, lptErtek, markasListaErtelmez, fizetett, CIMKEK } from '../lib/meres/cimke.js';
import { riport, haviCsv, honapHatar } from '../lib/meres/riport.js';
import { kiigazitasVegpont } from '../lib/meres/kiigazitas.js';

const JS = fs.readFileSync(new URL('../assets/js/mp-meres.js', import.meta.url), 'utf8');
const MOST = 1791700000;

/** Az mp-meres.js futtatasa egy lapbetoltesre: { url, referrer, tar (sessionStorage Map), cookie } -> { tar, hivasok } */
function lap({ url, referrer = '', tar = new Map(), cookie = '', top = true, ls = new Map(), nowMs = null, opener = null, nav = null, tiltott = false, esemeny = null }) {
  const figyelok = {};
  const u = new URL(url);
  const hivasok = [];
  const dob = () => { throw new Error('SecurityError'); };
  const sessionStorage = tiltott ? { getItem: dob, setItem: dob, removeItem: dob } : { getItem: (k) => (tar.has(k) ? tar.get(k) : null), setItem: (k, v) => tar.set(k, String(v)), removeItem: (k) => tar.delete(k) };
  const localStorage = tiltott ? { getItem: dob, setItem: dob, removeItem: dob } : { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
  const w = {
    location: { hostname: u.hostname, pathname: u.pathname, search: u.search, href: u.href },
    document: { referrer, cookie, addEventListener: (n, f) => { (figyelok[n] = figyelok[n] || []).push(f); }, documentElement: { getAttribute: () => null } },
    sessionStorage, localStorage, URLSearchParams, URL, JSON, Math, Date: nowMs == null ? Date : { now: () => nowMs }, Object, String, Number, setTimeout: () => 0,
    addEventListener: () => {}, opener,
    fetch: (cim, o) => { hivasok.push({ cim, torzs: JSON.parse(o.body) }); return Promise.resolve({}); },
  };
  if (nav) w.performance = { getEntriesByType: () => [{ type: nav }] };
  w.window = w; w.top = top ? w : {};
  vm.runInNewContext(JS, w);
  if (esemeny) { w.document.cookie = esemeny.cookie; for (const f of figyelok[esemeny.nev] || []) f(); }
  return { tar, ls, hivasok, forras: tar.has('mp_forras') ? JSON.parse(tar.get('mp_forras')) : null, latogatas: ls.has('mp_forras_l') ? JSON.parse(ls.get('mp_forras_l')) : null };
}
const H = 'https://www.medicalpiercing.hu';

test('bongeszo: last paid click - fizetett felulir, nem fizetett nem; belso hivatkozo nem valtoztat', () => {
  const tar = new Map();
  let r = lap({ url: `${H}/?utm_source=meta&utm_medium=paid_social&utm_campaign=111&utm_term=222&utm_content=333&fbclid=SECRETfbclid123`, referrer: 'https://l.facebook.com/', tar });
  assert.equal(r.forras.p, 'meta'); assert.equal(r.forras.kp, 'fbclid'); assert.equal(r.forras.rk, 'social'); assert.equal(r.forras.uc, '111');
  assert.ok(!tar.get('mp_forras').includes('SECRET'), 'kattintasazonosito-ertek nincs a taroloban');
  // organikus kereses: nem irja felul
  r = lap({ url: `${H}/elerhetosegek`, referrer: 'https://www.google.com/', tar });
  assert.equal(r.forras.p, 'meta');
  // belso navigacio tovabbvitt (mas) parameterekkel: nem valtoztat
  r = lap({ url: `${H}/arak?ttclid=XXXXXXXXXX`, referrer: `${H}/`, tar });
  assert.equal(r.forras.p, 'meta');
  // uj fizetett kattintas (TikTok) kivulrol: felulir
  r = lap({ url: `${H}/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=777&ttclid=E.C.P.abcdefgh`, referrer: '', tar });
  assert.equal(r.forras.p, 'tiktok'); assert.equal(r.forras.kp, 'ttclid'); assert.equal(r.forras.rk, 'nincs');
  // Google cpc: felulir
  r = lap({ url: `${H}/?utm_source=google&utm_medium=cpc&utm_campaign=999&gclid=Cj0KCQabcdefgh`, referrer: 'https://www.google.hu/', tar });
  assert.equal(r.forras.p, 'google'); assert.equal(r.forras.kp, 'gclid'); assert.equal(r.forras.rk, 'search');
  // ugyanannak a fizetett erintesnek az ujratoltese az idot nem irja at
  const t0 = r.forras.t; tar.set('mp_forras', JSON.stringify({ ...r.forras, t: t0 - 500 }));
  r = lap({ url: `${H}/?utm_source=google&utm_medium=cpc&utm_campaign=999&gclid=Cj0KCQabcdefgh`, referrer: 'https://www.google.hu/', tar });
  assert.equal(r.forras.t, t0 - 500);
});

test('bongeszo: nem fizetett erintesek, regi (v1) tarolt alak, koszonooldal nem valtoztat', () => {
  let r = lap({ url: `${H}/`, referrer: '' });
  assert.deepEqual([r.forras.p, r.forras.rk, r.forras.kp], [null, 'nincs', undefined]);
  r = lap({ url: `${H}/`, referrer: 'https://www.bing.com/search?q=x', tar: r.tar }); // direkt -> kereso (nem direkt felulir)
  assert.equal(r.forras.rk, 'search');
  r = lap({ url: `${H}/`, referrer: '', tar: r.tar }); // direkt nem ir felul
  assert.equal(r.forras.rk, 'search');
  r = lap({ url: `${H}/?utm_source=hirlevel&utm_medium=email`, referrer: '', tar: r.tar });
  assert.equal(r.forras.us, 'hirlevel'); assert.equal(r.forras.p, 'egyeb');
  // belso hivatkozo, ures tarolo, jel nelkul: nincs tarolas
  assert.equal(lap({ url: `${H}/arak`, referrer: `${H}/` }).forras, null);
  assert.equal(lap({ url: `${H}/arak`, referrer: 'https://medicalpiercing.salonic.hu/booking/' }).forras, null);
  // regi v1 alak { p: 'tiktok' }: nem fizetett erkezes nem irja felul, fizetett igen
  const tar = new Map([['mp_forras', JSON.stringify({ p: 'tiktok', t: MOST })]]);
  assert.equal(lap({ url: `${H}/?utm_source=ig`, referrer: 'https://instagram.com/', tar }).forras.p, 'tiktok');
  assert.equal(lap({ url: `${H}/?gclid=Cj0KCQabcdefgh`, referrer: '', tar }).forras.p, 'google');
  // koszonooldalon nincs erintes-frissites
  assert.equal(lap({ url: `${H}/foglalas-ok?utm_source=meta&utm_medium=paid_social` }).forras, null);
});

test('bongeszo: hivatkozo-kategoriak (csak tartomany) es utm-tisztitas', () => {
  const k = (ref) => lap({ url: `${H}/?utm_source=x&utm_medium=cpc`, referrer: ref }).forras.rk;
  assert.equal(k(''), 'nincs');
  assert.equal(k('https://www.google.com/'), 'search');
  assert.equal(k('https://duckduckgo.com/'), 'search');
  assert.equal(k('https://m.facebook.com/story?id=1'), 'social');
  assert.equal(k('https://www.instagram.com/'), 'social');
  assert.equal(k('https://t.co/abc'), 'social');
  assert.equal(k('https://www.tiktok.com/'), 'social');
  assert.equal(k('https://valami-blog.hu/cikk?nev=Pista'), 'egyeb');
  const f = lap({ url: `${H}/?utm_source=meta&utm_medium=paid_social&utm_campaign=${'1'.repeat(101)}&utm_term=<script>&utm_content=a%20b`, referrer: 'https://valami-blog.hu/x?email=a@b.hu' }).forras;
  assert.equal(f.uc, undefined); assert.equal(f.ut, undefined); assert.equal(f.uco, undefined);
  assert.ok(!JSON.stringify(f).includes('valami-blog'), 'hivatkozo URL nincs tarolva');
});

test('bongeszo: hozzajarulassal fizetett erkezeskor /api/mp-forras hivas (a bizonyitek ertek nelkul; a nyers azonosito kulon, 2026-10-19), hozzajarulas nelkul nincs', () => {
  const igen = lap({ url: `${H}/?fbclid=SECRETfbclid123&utm_source=meta&utm_medium=paid_social`, cookie: `mp_suti=v1-s1-m1-t${MOST}` });
  const h = igen.hivasok.filter((x) => x.cim === '/api/mp-forras');
  assert.equal(h.length, 1); assert.equal(h[0].torzs.forras.kp, 'fbclid'); assert.ok(!JSON.stringify(h[0].torzs.forras).includes('SECRET'));
  assert.deepEqual([h[0].torzs.kattintas.t, h[0].torzs.kattintas.e, h[0].torzs.kattintas.i], ['fbclid', 'SECRETfbclid123', h[0].torzs.forras.t], 'a nyers azonosito csak hozzajarulassal, a HttpOnly sutihez, az erintes idejevel');
  assert.equal(lap({ url: `${H}/?fbclid=SECRETfbclid123`, cookie: `mp_suti=v1-s0-m0-t${MOST}` }).hivasok.length, 0);
  assert.equal(lap({ url: `${H}/?fbclid=SECRETfbclid123` }).hivasok.length, 0);
  assert.equal(lap({ url: `${H}/`, cookie: `mp_suti=v1-s1-m1-t${MOST}` }).hivasok.length, 0, 'nem fizetett erintesre nincs hivas');
});

test('bongeszo (review #432): kesobbi oldalon adott hozzajarulasnal a regi mp_gk-azonosito NEM kerul a sutibe; a sajat (egyezo ideju) igen', () => {
  const tar = new Map(), ls = new Map();
  // 1. oldal: fizetett erkezes hozzajarulas nelkul (mp_gk nem irodik), a munkamenetben a meta erintes
  lap({ url: `${H}/?utm_source=meta&utm_medium=paid_social&fbclid=UJfbclid12345`, tar, ls });
  const t = JSON.parse(tar.get('mp_forras')).t;
  // egy korabbi latogatasbol maradt, 5 napos mp_gk (mas erintes)
  ls.set('mp_gk', JSON.stringify({ fbclid: { ertek: 'REGIfbclid12345', ido: t - 5 * 86400 } }));
  // 2. oldal (belso), itt fogad el: mp_suti_valtozas
  let r = lap({ url: `${H}/arak`, referrer: `${H}/`, tar, ls, esemeny: { nev: 'mp_suti_valtozas', cookie: `mp_suti=v1-s1-m1-t${MOST}` } });
  let h = r.hivasok.filter((x) => x.cim === '/api/mp-forras');
  assert.equal(h.length, 1); assert.equal(h[0].torzs.kattintas, undefined, 'regi azonosito nem megy');
  // ha az mp_gk ugyanabbol az erintesbol van (egyezo ido), mehet
  ls.set('mp_gk', JSON.stringify({ fbclid: { ertek: 'UJfbclid12345', ido: t } }));
  r = lap({ url: `${H}/arak`, referrer: `${H}/`, tar, ls, esemeny: { nev: 'mp_suti_valtozas', cookie: `mp_suti=v1-s1-m1-t${MOST}` } });
  h = r.hivasok.filter((x) => x.cim === '/api/mp-forras');
  assert.deepEqual(h[0].torzs.kattintas, { t: 'fbclid', e: 'UJfbclid12345', i: t });
});

test('utmTisztit es bizonyitekBemenet', () => {
  assert.equal(utmTisztit(' meta '), 'meta');
  assert.equal(utmTisztit('a'.repeat(100)), 'a'.repeat(100));
  assert.equal(utmTisztit('a'.repeat(101)), null);
  for (const r of ['a b', 'x<y', 'é', '', null, {}, 'a/b', 'a=b']) assert.equal(utmTisztit(r), null, String(r));
  assert.equal(utmTisztit('120.3_~:+-x'), '120.3_~:+-x');
  assert.equal(bizonyitekBemenet({ us: 'meta' }, MOST), null, 'rk nelkul nem bizonyitek');
  const b = bizonyitekBemenet({ v: 'mp_v2', us: 'meta', um: 'paid_social', uc: '1', kp: 'fbclid', rk: 'social', t: MOST - 10, gclid: 'X', extra: 1 }, MOST);
  assert.deepEqual(b, { utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: '1', utm_term: null, utm_content: null, kattintas_param: 'fbclid', referrer_kat: 'social', forras_ido: MOST - 10 });
  assert.equal(bizonyitekBemenet({ kp: 'SECRETvalue', rk: 'nincs', t: MOST + 99999 }, MOST).kattintas_param, null);
  assert.equal(bizonyitekBemenet({ kp: 'gclid', rk: 'nincs', t: MOST + 99999 }, MOST).forras_ido, null);
});

const v2 = (o) => ({ forras_verzio: 'mp_v2', referrer_kat: 'nincs', ...o });
test('cimkez: platformok, Google markas lista, organikus / direkt, ismeretlen okok', () => {
  const L = ['111', '222'];
  assert.deepEqual(cimkez(v2({ kattintas_param: 'gclid', utm_campaign: '111' }), L), { forras_cimke: 'google_markas', ismeretlen_ok: null, cimke_megjegyzes: null });
  assert.equal(cimkez(v2({ kattintas_param: 'gclid', utm_campaign: '333' }), L).forras_cimke, 'google_nem_markas');
  assert.deepEqual(cimkez(v2({ kattintas_param: 'gclid', utm_campaign: '111' }), null), { forras_cimke: 'google_nem_markas', ismeretlen_ok: null, cimke_megjegyzes: 'markas_lista_hianyzik' });
  assert.deepEqual(cimkez(v2({ kattintas_param: 'gbraid' }), L), { forras_cimke: 'google_nem_markas', ismeretlen_ok: null, cimke_megjegyzes: 'nincs_kampany_id' });
  assert.equal(cimkez(v2({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: '222' }), L).forras_cimke, 'google_markas');
  assert.equal(cimkez(v2({ utm_source: 'meta', utm_medium: 'paid_social' }), L).forras_cimke, 'meta');
  assert.equal(cimkez(v2({ utm_source: 'Instagram', utm_medium: 'PAID' }), L).forras_cimke, 'meta');
  assert.equal(cimkez(v2({ utm_source: 'tiktok', utm_medium: 'paid_social' }), L).forras_cimke, 'tiktok');
  assert.equal(cimkez(v2({ kattintas_param: 'ttclid' }), L).forras_cimke, 'tiktok');
  assert.deepEqual(cimkez(v2({ kattintas_param: 'fbclid' }), L), { forras_cimke: 'meta', ismeretlen_ok: null, cimke_megjegyzes: 'fbclid_utm_nelkul' });
  assert.deepEqual(cimkez(v2({ utm_source: 'valami', utm_medium: 'cpc' }), L), { forras_cimke: 'ismeretlen', ismeretlen_ok: 'hianyos_utm', cimke_megjegyzes: null });
  assert.equal(cimkez(v2({ utm_source: 'meta' }), L).ismeretlen_ok, 'hianyos_utm');
  assert.deepEqual(cimkez(v2({ utm_source: 'hirlevel', utm_medium: 'email' }), L), { forras_cimke: 'organikus_direkt', ismeretlen_ok: null, cimke_megjegyzes: 'organikus_utm' });
  assert.equal(cimkez(v2({ referrer_kat: 'search' }), L).cimke_megjegyzes, 'organikus_kereso');
  assert.equal(cimkez(v2({ referrer_kat: 'social' }), L).cimke_megjegyzes, 'organikus_social');
  assert.equal(cimkez(v2({ referrer_kat: 'egyeb' }), L).cimke_megjegyzes, 'hivatkozo');
  assert.deepEqual(cimkez(v2({}), L), { forras_cimke: 'organikus_direkt', ismeretlen_ok: null, cimke_megjegyzes: 'direkt' });
  assert.deepEqual(cimkez({ forras_verzio: 'mp_v2', referrer_kat: null }, L), { forras_cimke: 'ismeretlen', ismeretlen_ok: 'nincs_jel', cimke_megjegyzes: null });
  assert.equal(cimkez({ forras_verzio: 'mp_v2', forras_keret: 1 }, L).ismeretlen_ok, 'iframe_munkamenet');
  assert.equal(cimkez({ forras_platform: 'tiktok' }, L).forras_cimke, 'tiktok');
  assert.equal(cimkez({ forras_platform: 'google' }, L).forras_cimke, 'google_nem_markas');
  assert.equal(cimkez({ forras_platform: 'egyeb' }, L).ismeretlen_ok, 'regi_kliens');
  assert.equal(cimkez({}, L).ismeretlen_ok, 'nincs_jel');
  // minden kimenet a feher listan
  for (const s of [v2({}), {}, v2({ kattintas_param: 'wbraid' })]) assert.ok(CIMKEK.includes(cimkez(s, L).forras_cimke));
  assert.deepEqual(markasListaErtelmez(' 111, 222 ,x,'), ['111', '222']);
  assert.equal(markasListaErtelmez(null), null);
});

// ---------- szerver: D1-utanzat ----------
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
const uj = () => { _semaTorles(); const db = d1(); return { db, env: { MP_MERES_DB: db } }; };
const BURL = (start) => `https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=12169&serviceId=9001&employeeId=555&startDate=${start}`;
const SUTI_IGEN = `mp_suti=v1-s1-m1-t${MOST}`;
const SUTI_NEM = `mp_suti=v1-s0-m0-t${MOST}`;
const keres = (ut, torzs, cookie, host = 'www.medicalpiercing.hu') => new Request(`https://${host}${ut}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(torzs) });
const nemKuld = async () => { throw new Error('kulso hivas tilos'); };
let st = 1791800000;
async function foglal(env, extra, cookie = SUTI_NEM, most = MOST, p = {}) {
  const start = (st += 600);
  await foglalasErkezes({ request: keres('/api/mp-foglalas', { ut: '/foglalas-ok', p: { bookingUrl: BURL(start), price: '24900', first_booking: 'true', ...p }, ...extra }, cookie), env }, { fetchImpl: nemKuld, most });
  return env.MP_MERES_DB._s.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').get(`12169|555|${start}`);
}
const META = { v: 'mp_v2', us: 'meta', um: 'paid_social', uc: '120', ut: '121', uco: '122', kp: 'fbclid', rk: 'social', t: MOST - 100 };

test('szerver: bizonyitek hozzajarulas NELKUL tarolva, cimke kiszamolva, kattintasazonosito-ertek nincs', async () => {
  const { env } = uj();
  const s = await foglal(env, { forras: { ...META, gclid: 'SECRET' }, forras_platform: 'meta', forras_v: 'mp_v2' });
  assert.equal(s.hozzajarulas_hirdetes, 0);
  assert.deepEqual([s.utm_source, s.utm_medium, s.utm_campaign, s.utm_term, s.utm_content, s.kattintas_param, s.referrer_kat, s.forras_ido, s.forras_verzio],
    ['meta', 'paid_social', '120', '121', '122', 'fbclid', 'social', MOST - 100, 'mp_v2']);
  assert.deepEqual([s.forras_cimke, s.ismeretlen_ok, s.forras_platform, s.bizonyitek_forras, s.forras_keret], ['meta', null, 'meta', 'munkamenet', 0]);
  assert.equal(s.meta_fbc, null); assert.ok(!JSON.stringify(s).includes('SECRET'));
  // v2 kliens erintes nelkul, keretbol -> iframe_munkamenet; keret nelkul -> nincs_jel
  assert.deepEqual([(await foglal(env, { forras_v: 'mp_v2', keret: true })).ismeretlen_ok, (await foglal(env, { forras_v: 'mp_v2' })).ismeretlen_ok], ['iframe_munkamenet', 'nincs_jel']);
  // regi kliens: csak forras_platform
  const r = await foglal(env, { forras_platform: 'tiktok' });
  assert.deepEqual([r.forras_cimke, r.forras_verzio, r.cimke_megjegyzes], ['tiktok', null, 'regi_kliens']);
});

test('szerver: Google markas lista a D1-bol (mp_beallitas.google_markas_kampanyok), hianyzo lista jelzese', async () => {
  const { db, env } = uj();
  const G = { v: 'mp_v2', us: 'google', um: 'cpc', uc: '555', kp: 'gclid', rk: 'search', t: MOST - 50 };
  let s = await foglal(env, { forras: G });
  assert.deepEqual([s.forras_cimke, s.cimke_megjegyzes], ['google_nem_markas', 'markas_lista_hianyzik']);
  db._s.prepare("INSERT INTO mp_beallitas (kulcs, ertek) VALUES ('google_markas_kampanyok', '555,666')").run();
  s = await foglal(env, { forras: G });
  assert.deepEqual([s.forras_cimke, s.cimke_megjegyzes], ['google_markas', null]);
  s = await foglal(env, { forras: { ...G, uc: '777' } });
  assert.equal(s.forras_cimke, 'google_nem_markas');
  s = await foglal(env, { forras: { v: 'mp_v2', kp: 'gclid', rk: 'nincs', t: MOST } });
  assert.deepEqual([s.forras_cimke, s.cimke_megjegyzes], ['google_nem_markas', 'nincs_kampany_id']);
});

test('mp_lpt suti: csak hirdetesi hozzajarulassal es fizetett erintessel; HttpOnly, Secure, SameSite=Lax, 30 nap; visszavonaskor torles', async () => {
  const v = (t, cookie) => forrasVegpont({ request: keres('/api/mp-forras', t, cookie) }, { most: MOST });
  let r = await v({ forras: META }, SUTI_IGEN);
  const sc = r.headers.get('set-cookie');
  assert.match(sc, /^mp_lpt=[A-Za-z0-9_-]+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
  const ertek = sc.split(';')[0].slice(7);
  assert.ok(!Buffer.from(ertek, 'base64url').toString().includes('SECRET'));
  assert.equal(lptOlvas(`mp_lpt=${ertek}`, MOST).utm_campaign, '120');
  assert.equal(lptOlvas(`mp_lpt=${ertek}`, MOST + 31 * 86400), null, '30 nap utan nem ervenyes');
  r = await v({ forras: META }, SUTI_NEM);
  assert.equal(r.headers.get('set-cookie'), null, 'hozzajarulas nelkul nincs suti');
  r = await v({ forras: META }, '');
  assert.equal(r.headers.get('set-cookie'), null, 'dontes nelkul nincs suti');
  r = await v({}, `${SUTI_NEM}; mp_lpt=${ertek}`);
  assert.match(r.headers.get('set-cookie'), /^mp_lpt=; Max-Age=0;/, 'visszavonas: torles');
  r = await v({ forras: { v: 'mp_v2', rk: 'search', t: MOST } }, SUTI_IGEN);
  assert.equal(r.headers.get('set-cookie'), null, 'nem fizetett erintes nem kerul sutibe');
  r = await forrasVegpont({ request: keres('/api/mp-forras', { forras: META }, SUTI_IGEN, 'evil.example.com') }, { most: MOST });
  assert.equal(r.status, 404);
});

test('szerver: mp_lpt tartalek csak hozzajarulassal es csak ha a munkamenetben nincs fizetett erintes', async () => {
  const { env } = uj();
  const lpt = `mp_lpt=${lptErtek(bizonyitekBemenet({ ...META, t: MOST - 5 * 86400 }, MOST))}`;
  let s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lpt}`);
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras, s.forras_ido], ['meta', 'suti', MOST - 5 * 86400]);
  s = await foglal(env, { forras_v: 'mp_v2' }, `${SUTI_IGEN}; ${lpt}`);
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras], ['meta', 'suti']);
  // hozzajarulas nelkul a sutit nem hasznaljuk
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_NEM}; ${lpt}`);
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras], ['organikus_direkt', 'munkamenet']);
  // a munkamenet fizetett erintese nyer a suti felett
  s = await foglal(env, { forras: { v: 'mp_v2', us: 'tiktok', um: 'paid_social', kp: 'ttclid', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lpt}`);
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras], ['tiktok', 'munkamenet']);
});

test('mp_lpt 7 napos cimke-ablak (Feri 2026-10-14): 8-30 napos fizetett kattintas cimket nem ad, csak kesoi jelzes', async () => {
  const { env } = uj();
  const lpt = (nap) => `mp_lpt=${lptErtek(bizonyitekBemenet({ ...META, t: MOST - nap * 86400 }, MOST))}`;
  let s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lpt(6.9)}`);
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras, s.lpt_jelzes], ['meta', 'suti', null], '7 napon belul: cimke');
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lpt(12)}`);
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras, s.lpt_jelzes], ['organikus_direkt', 'munkamenet', 'kesoi:meta:12'], '8-30 nap: kesoi jelzes, cimke nem valtozik');
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lpt(31)}`);
  assert.deepEqual([s.forras_cimke, s.lpt_jelzes], ['organikus_direkt', null], '30 nap felett semmi');
  assert.equal(lptOlvas(lpt(8), MOST).kesoi, true);
  // pontos hatar: 7*86400 mp -> cimke; 7*86400+1 -> kesoi
  const hatar = (mp) => `mp_lpt=${lptErtek(bizonyitekBemenet({ ...META, t: MOST - mp }, MOST))}`;
  assert.equal(lptOlvas(hatar(7 * 86400), MOST).kesoi, false);
  assert.equal(lptOlvas(hatar(7 * 86400 + 1), MOST).kesoi, true);
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${hatar(7 * 86400)}`);
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras], ['meta', 'suti'], 'pontosan 7 nap: cimke');
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${hatar(7 * 86400 + 1)}`);
  assert.deepEqual([s.forras_cimke, s.lpt_jelzes], ['organikus_direkt', 'kesoi:meta:7'], '7 nap + 1 mp: kesoi');
  assert.equal(lptOlvas(lpt(8), MOST).kor_nap, 8);
});

test('mp_lpt nyers kattintasazonosito: sutibe kerul (hozzajarulassal), visszanyerheto, a hianyzo mezot potolja, felulirni nem ir', async () => {
  const v = (t, cookie) => forrasVegpont({ request: keres('/api/mp-forras', t, cookie) }, { most: MOST });
  const FB = 'IwAR0abcdefGHIJK_123-xyz';
  let r = await v({ forras: META, kattintas: { t: 'fbclid', e: FB, i: META.t } }, SUTI_IGEN);
  const ertek = /^mp_lpt=([^;]+)/.exec(r.headers.get('set-cookie'))[1];
  assert.equal(lptOlvas(`mp_lpt=${ertek}`, MOST).kattintas_azonosito, FB);
  // tipus-elteres / ervenytelen formatum: a suti azonosito NELKUL jon letre
  r = await v({ forras: META, kattintas: { t: 'gclid', e: FB, i: META.t } }, SUTI_IGEN);
  assert.equal(lptOlvas(/^(mp_lpt=[^;]+)/.exec(r.headers.get('set-cookie'))[1], MOST).kattintas_azonosito, null, 'tipus-elteres');
  r = await v({ forras: META, kattintas: { t: 'fbclid', e: 'rossz<script>ertek', i: META.t } }, SUTI_IGEN);
  assert.equal(lptOlvas(/^(mp_lpt=[^;]+)/.exec(r.headers.get('set-cookie'))[1], MOST).kattintas_azonosito, null, 'formatum');
  r = await v({ forras: META, kattintas: { t: 'fbclid', e: 'a'.repeat(301), i: META.t } }, SUTI_IGEN);
  assert.equal(lptOlvas(/^(mp_lpt=[^;]+)/.exec(r.headers.get('set-cookie'))[1], MOST).kattintas_azonosito, null, 'tul hosszu');
  // regi (masik erintesbol szarmazo) azonosito: az ido nem egyezik az erintesevel -> nem kerul a sutibe; ido nelkul sem
  r = await v({ forras: META, kattintas: { t: 'fbclid', e: FB, i: META.t - 86400 } }, SUTI_IGEN);
  assert.equal(lptOlvas(/^(mp_lpt=[^;]+)/.exec(r.headers.get('set-cookie'))[1], MOST).kattintas_azonosito, null, 'regi ido');
  r = await v({ forras: META, kattintas: { t: 'fbclid', e: FB } }, SUTI_IGEN);
  assert.equal(lptOlvas(/^(mp_lpt=[^;]+)/.exec(r.headers.get('set-cookie'))[1], MOST).kattintas_azonosito, null, 'ido nelkul');
  // hozzajarulas nelkul nincs suti
  r = await v({ forras: META, kattintas: { t: 'fbclid', e: FB, i: META.t } }, SUTI_NEM);
  assert.equal(r.headers.get('set-cookie'), null);

  const { env } = uj();
  const lptB = (o, nap) => `mp_lpt=${lptErtek({ ...bizonyitekBemenet({ ...o, t: MOST - nap * 86400 }, MOST), kattintas_azonosito: o.ki })}`;
  // Meta: a visszatero foglalo (munkamenetben nincs fizetett erintes) megkapja az fbc-t a sutibol
  let s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lptB({ ...META, ki: FB }, 2)}`);
  assert.equal(s.meta_fbc, `fb.1.${(MOST - 2 * 86400) * 1000}.${FB}`);
  assert.equal(s.meta_kattintas_ido, MOST - 2 * 86400);
  assert.equal(s.lpt_jelzes, 'azonosito:meta');
  // a bongeszobol / _fbc sutibol jott erteket soha nem irja felul
  const FBC_SUTI = `fb.1.${(MOST - 3600) * 1000}.SAJATbongeszo123`;
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; _fbc=${FBC_SUTI}; ${lptB({ ...META, ki: FB }, 2)}`);
  assert.equal(s.meta_fbc, FBC_SUTI);
  assert.equal(s.lpt_jelzes, null);
  // Google gclid es TikTok ttclid
  const G = { v: 'mp_v2', us: 'google', um: 'cpc', uc: '123', kp: 'gclid', rk: 'search' };
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lptB({ ...G, ki: 'Cj0KCQjwTEST_gclid1' }, 1)}`);
  assert.deepEqual([s.kattintas_tipus, s.kattintas_ertek, s.kattintas_ido, s.lpt_jelzes], ['gclid', 'Cj0KCQjwTEST_gclid1', MOST - 86400, 'azonosito:google']);
  const T = { v: 'mp_v2', us: 'tiktok', um: 'paid_social', kp: 'ttclid', rk: 'social' };
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lptB({ ...T, ki: 'E.C.P.ttclidTEST1' }, 3)}`);
  assert.deepEqual([s.tiktok_ttclid, s.tiktok_kattintas_ido, s.lpt_jelzes], ['E.C.P.ttclidTEST1', MOST - 3 * 86400, 'azonosito:tiktok']);
  // 7 napon tul az azonosito NEM potol (kesoi jelzes marad)
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_IGEN}; ${lptB({ ...META, ki: FB }, 9)}`);
  assert.deepEqual([s.meta_fbc, s.lpt_jelzes], [null, 'kesoi:meta:9']);
  // hozzajarulas nelkul nem potol
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 } }, `${SUTI_NEM}; ${lptB({ ...META, ki: FB }, 2)}`);
  assert.equal(s.meta_fbc, null);
});

test('riport: cimkek, lefedettseg osszes / uj vendeg, hozzajarulas szerinti bontas, igazolt; csak eles', async () => {
  const { db, env } = uj();
  const t = MOST - 3 * 86400;
  await foglal(env, { forras: META }, SUTI_NEM, t); // uj (first_booking), meta, hozzajarulas nelkul
  await foglal(env, { forras: { v: 'mp_v2', rk: 'search', t } }, SUTI_IGEN, t); // uj, organikus, hozzajarulassal
  await foglal(env, { forras_v: 'mp_v2' }, SUTI_NEM, t); // uj, ismeretlen (nincs_jel)
  await foglal(env, { forras: META, ut: '/fulbevalo-ok' }, SUTI_NEM, t, { first_booking: 'false' }); // visszatero, meta, divat fulpiercing
  // elonezet sor: nem szamit
  await foglalasErkezes({ request: keres('/api/mp-foglalas', { ut: '/foglalas-ok', p: { bookingUrl: BURL(1799999999), first_booking: 'true' }, forras: META }, SUTI_NEM, 'x.medicalpiercing.pages.dev'), env }, { fetchImpl: nemKuld, most: t });
  db._s.prepare("UPDATE mp_foglalas SET igazolas = 'igazolt' WHERE forras_cimke = 'meta' AND uj_vendeg = 1").run();
  const r = await riport(db, MOST, 7);
  const x = r.sorok.find((s) => s.d1_foglalas > 0);
  assert.equal(x.d1_foglalas, 4);
  assert.deepEqual([x.cimke_meta, x.cimke_meta_igazolt, x.cimke_organikus_direkt, x.cimke_ismeretlen], [2, 1, 1, 1]);
  assert.deepEqual([x.d1_uj_vendeg, x.uj_cimke_meta, x.uj_cimke_meta_igazolt, x.uj_cimke_ismeretlen], [3, 1, 1, 1]);
  assert.equal(x.lefedettseg_osszes, 75); assert.equal(x.lefedettseg_uj, 66.7);
  assert.equal(x.lefedettseg_hozzajarulassal, 100); assert.equal(x.lefedettseg_hozzajarulas_nelkul, 66.7);
  assert.equal(x.lefedettseg_uj_hozzajarulas_nelkul, 50);
  assert.deepEqual(x.ismeretlen_okok, { nincs_jel: 1 });
  assert.equal(x.forras_meta, 2, 'a regi mezok megmaradnak');
  assert.deepEqual([x.d1_ful, x.d1_ful_igazolt, x.ful_cimke_meta, x.ful_cimke_organikus_direkt], [1, 0, 1, 0], 'divat fulpiercing bontas');
  assert.equal(r.google_markas_lista, null);
});

test('havi CSV: honaphatar (Budapest), szemelyes adat nelkul, titkos vegponton', async () => {
  const h = honapHatar('2026-10');
  assert.equal(new Date(h.tol * 1000).toISOString(), '2026-09-30T22:00:00.000Z');
  assert.equal(new Date(h.ig * 1000).toISOString(), '2026-10-31T23:00:00.000Z');
  assert.equal(honapHatar('2026-13'), null);
  const { db, env } = uj();
  const okt = Date.UTC(2026, 9, 10) / 1000;
  await foglal(env, { forras: META }, SUTI_IGEN, okt);
  await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: okt } }, SUTI_NEM, okt, { first_booking: 'false' });
  await foglal(env, { forras: META }, SUTI_NEM, Date.UTC(2026, 8, 30, 21) / 1000); // szeptember (Budapest 23:00)
  db._s.prepare("UPDATE mp_foglalas SET igazolas = 'igazolt'").run();
  const csv = await haviCsv(db, '2026-10', MOST);
  const sorok = csv.trim().split('\n');
  assert.equal(sorok[0], 'ho,forras_cimke,foglalas,igazolt,uj_vendeg,uj_vendeg_igazolt,hozzajarulassal,verzio,pillanatkep');
  assert.equal(sorok.length, 1 + CIMKEK.length);
  assert.match(sorok.find((s) => s.includes(',meta,')), /^2026-10,meta,1,1,1,1,1,mp_v2,\d{4}-/);
  assert.match(sorok.find((s) => s.includes(',organikus_direkt,')), /^2026-10,organikus_direkt,1,1,0,0,0,/);
  assert.ok(!/12169|555|salonic/.test(csv), 'kulcs / azonosito nincs benne');
  // vegpont: titok nelkul 404/403, titokkal CSV, rossz ho 400
  const env2 = { ...env, MP_KIIGAZITAS_TITOK: 'titok123' };
  const g = (q, titok) => kiigazitasVegpont({ request: new Request(`https://www.medicalpiercing.hu/api/mp-kiigazitas?${q}`, { headers: titok ? { 'x-mp-kiigazitas': titok } : {} }), env: env2 }, { most: MOST });
  assert.equal((await g('riport=havi&ho=2026-10', 'rossz')).status, 403);
  const v = await g('riport=havi&ho=2026-10', 'titok123');
  assert.equal(v.status, 200); assert.match(v.headers.get('content-type'), /text\/csv/);
  assert.equal(await v.text(), csv.replace(/\d{4}-\d\d-\d\dT[^\n,]+/g, (m) => m));
  assert.equal((await g('riport=havi&ho=2026-1', 'titok123')).status, 400);
});

test('fizetett(): medium-lista', () => {
  for (const m of ['cpc', 'CPC', 'paid_social', 'paid', 'ppc']) assert.ok(fizetett({ utm_medium: m }), m);
  for (const m of ['email', 'social', 'organic', '', null]) assert.ok(!fizetett({ utm_medium: m }), String(m));
});

// ---------------- latogatas-tarolo (localStorage "mp_forras_l", 2 ora) es "nincs_jel" diagnosztika ----------------
const KOSZ = `${H}/foglalas-ok?first_booking=true&bookingUrl=${encodeURIComponent('https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=12169&serviceId=9001&employeeId=555&startDate=1791900000')}`;
const MS = MOST * 1000;
const jelzes = (r) => r.hivasok.find((h) => h.cim === '/api/mp-foglalas')?.torzs;

test('latogatas-tarolo: ugyanaz a tisztitott erintes, 2 ora lejarat; uj lap (ures sessionStorage) olvassa es visszairja', () => {
  const ls = new Map();
  const a = lap({ url: `${H}/?utm_source=google&utm_medium=cpc&utm_campaign=999&gclid=Cj0KCQSECRETabc`, referrer: 'https://www.google.com/', ls, nowMs: MS });
  assert.equal(a.latogatas.lej, MOST + 7200);
  assert.deepEqual(a.latogatas.e, a.forras, 'ugyanazok a mezok');
  assert.ok(!ls.get('mp_forras_l').includes('SECRET'), 'kattintasazonosito-ertek nincs a latogatas-taroloban');
  // uj lap (noopener): ures sessionStorage, belso hivatkozo, jel nelkul -> a latogatas-tarolobol, b = 'l'
  const b = lap({ url: `${H}/arak`, referrer: `${H}/`, ls, nowMs: MS + 1800e3 });
  assert.deepEqual([b.forras.p, b.forras.kp, b.forras.uc, b.forras.b], ['google', 'gclid', '999', 'l']);
  assert.equal(b.latogatas.lej, MOST + 1800 + 7200, 'oldalmegtekintes megujitja a lejaratot');
  assert.equal(b.latogatas.e.b, undefined, 'a tarolo-jelzes nem kerul a latogatas-taroloba');
  // a koszonooldal ugyanezen a lapon: forras_tarolo = latogatas
  const k = lap({ url: KOSZ, referrer: `${H}/arak`, tar: b.tar, ls, nowMs: MS + 1900e3, cookie: `mp_suti=v1-s0-m0-t${MOST}` });
  const t = jelzes(k);
  assert.equal(t.forras_tarolo, 'latogatas'); assert.equal(t.forras.kp, 'gclid'); assert.equal(t.forras.b, undefined);
  assert.ok(!JSON.stringify(t).includes('SECRET'));
  // sajat munkamenet-erintessel: munkamenet
  const k2 = lap({ url: KOSZ, tar: a.tar, ls: new Map(), nowMs: MS, cookie: `mp_suti=v1-s0-m0-t${MOST}` });
  assert.equal(jelzes(k2).forras_tarolo, 'munkamenet');
});

test('latogatas-tarolo: lejarat utan nem ervenyes (torlodik), uj lapon nincs erintes -> a jelzesben nincs forras', () => {
  const ls = new Map();
  lap({ url: `${H}/?gclid=Cj0KCQabcdefgh`, ls, nowMs: MS });
  const b = lap({ url: `${H}/arak`, referrer: `${H}/`, ls, nowMs: MS + 7201e3 });
  assert.equal(b.forras, null); assert.equal(b.latogatas, null, 'lejart: torolve');
  const k = lap({ url: KOSZ, referrer: `${H}/arak`, tar: b.tar, ls, nowMs: MS + 7300e3, cookie: `mp_suti=v1-s0-m0-t${MOST}` });
  assert.equal(jelzes(k).forras, undefined); assert.equal(jelzes(k).forras_tarolo, undefined);
  // pont a lejarat elott meg ervenyes
  const ls2 = new Map();
  lap({ url: `${H}/?gclid=Cj0KCQabcdefgh`, ls: ls2, nowMs: MS });
  assert.equal(lap({ url: `${H}/arak`, referrer: `${H}/`, ls: ls2, nowMs: MS + 7199e3 }).forras.p, 'google');
});

test('latogatas-tarolo: last paid click mindket taroloban', () => {
  // A lap: google (t0); B lap kesobb: meta fizetett -> a latogatas-tarolo meta; A lapon a kovetkezo oldal: meta (ujabb fizetett nyer)
  const ls = new Map();
  const a = lap({ url: `${H}/?gclid=Cj0KCQabcdefgh`, ls, nowMs: MS });
  const b = lap({ url: `${H}/?utm_source=meta&utm_medium=paid_social&fbclid=FBabcdefgh`, referrer: 'https://l.facebook.com/', ls, nowMs: MS + 60e3 });
  assert.equal(b.forras.p, 'meta'); assert.equal(b.latogatas.e.p, 'meta');
  const a2 = lap({ url: `${H}/arak`, referrer: `${H}/`, tar: a.tar, ls, nowMs: MS + 120e3 });
  assert.deepEqual([a2.forras.p, a2.forras.b], ['meta', 'l']);
  // nem fizetett erkezes uj lapon (organikus kereso) nem irja felul a latogatas fizetett erinteset
  const c = lap({ url: `${H}/`, referrer: 'https://www.google.com/', ls, nowMs: MS + 180e3 });
  assert.deepEqual([c.forras.p, c.forras.kp], ['meta', 'fbclid']); assert.equal(c.latogatas.e.p, 'meta');
  // nem fizetett latogatas-erintes nem irja felul a munkamenet fizetett erinteset, regebbi fizetett sem
  const ls2 = new Map([['mp_forras_l', JSON.stringify({ e: { v: 'mp_v2', t: MOST + 500, rk: 'search' }, lej: MOST + 7200 })]]);
  const d = lap({ url: `${H}/arak`, referrer: `${H}/`, tar: new Map([['mp_forras', JSON.stringify({ v: 'mp_v2', p: 'tiktok', kp: 'ttclid', t: MOST, rk: 'nincs' })]]), ls: ls2, nowMs: MS + 600e3 });
  assert.deepEqual([d.forras.p, d.forras.b], ['tiktok', undefined]);
  assert.equal(d.latogatas.e.p, 'tiktok', 'a latogatas-tarolo a hatalyos (fizetett) erintest kapja');
  const ls3 = new Map([['mp_forras_l', JSON.stringify({ e: { v: 'mp_v2', p: 'meta', kp: 'fbclid', t: MOST - 500, rk: 'social' }, lej: MOST + 7200 })]]);
  const e = lap({ url: `${H}/arak`, referrer: `${H}/`, tar: new Map([['mp_forras', JSON.stringify({ v: 'mp_v2', p: 'tiktok', kp: 'ttclid', t: MOST, rk: 'nincs' })]]), ls: ls3, nowMs: MS + 600e3 });
  assert.equal(e.forras.p, 'tiktok', 'regebbi fizetett latogatas-erintes nem nyer');
  // nem fizetett munkamenet (direkt) + fizetett latogatas: a fizetett nyer
  const ls4 = new Map([['mp_forras_l', JSON.stringify({ e: { v: 'mp_v2', p: 'meta', kp: 'fbclid', t: MOST - 500, rk: 'social' }, lej: MOST + 7200 })]]);
  const f = lap({ url: `${H}/arak`, referrer: `${H}/`, tar: new Map([['mp_forras', JSON.stringify({ v: 'mp_v2', t: MOST, rk: 'nincs' })]]), ls: ls4, nowMs: MS + 600e3 });
  assert.equal(f.forras.p, 'meta');
});

test('latogatas-tarolo: hibas / idegen tartalom es tiltott tarolo nem tor', () => {
  for (const v of ['nem json', '{"e":{"v":"mp_v2","t":"x"},"lej":9999999999}', '{"e":{"p":"google","t":1},"lej":9999999999}', '{"e":null,"lej":9999999999}', '[]']) {
    const r = lap({ url: `${H}/arak`, referrer: `${H}/`, ls: new Map([['mp_forras_l', v]]), nowMs: MS });
    assert.equal(r.forras, null, v); assert.equal(r.latogatas, null, `${v}: torolve`);
  }
  const r = lap({ url: `${H}/?gclid=Cj0KCQabcdefgh`, tiltott: true, nowMs: MS });
  assert.equal(r.forras, null);
  const k = lap({ url: KOSZ, tiltott: true, nowMs: MS, cookie: `mp_suti=v1-s0-m0-t${MOST}` });
  assert.ok(jelzes(k), 'tiltott taroloval is megy a jelzes');
});

test('diagnosztika: oldalszamlalo, elozo oldal navigacios tipusa, elso oldal opener / hivatkozo-kategoria', () => {
  const tar = new Map(), ls = new Map();
  lap({ url: `${H}/arak`, referrer: 'https://www.google.com/search?q=x', tar, ls, nowMs: MS, opener: {}, nav: 'navigate' });
  lap({ url: `${H}/elerhetosegek`, referrer: `${H}/arak`, tar, ls, nowMs: MS, nav: 'reload' });
  const k = lap({ url: KOSZ, referrer: `${H}/elerhetosegek`, tar, ls, nowMs: MS, nav: 'navigate', cookie: `mp_suti=v1-s0-m0-t${MOST}` });
  assert.deepEqual(jelzes(k).diag, { oldalak: 3, nav: 'reload', opener: 1, elso_ref: 'kereso' });
  assert.ok(!JSON.stringify(jelzes(k).diag).includes('google'), 'URL nincs benne');
  // az elso oldal maga a koszonooldal (nincs elozo): a sajat tipusa; opener nelkul, belso hivatkozo
  const k2 = lap({ url: KOSZ, referrer: `${H}/x`, nowMs: MS, nav: 'back_forward', cookie: `mp_suti=v1-s0-m0-t${MOST}` });
  assert.deepEqual(jelzes(k2).diag, { oldalak: 1, nav: 'back_forward', opener: 0, elso_ref: 'belso' });
  // keretben nem szamol
  assert.equal(lap({ url: `${H}/arak`, top: false }).tar.get('mp_oldalak'), undefined);
});

test('szerver: forras_tarolo -> bizonyitek_forras = latogatas; diag feher lista; riport bontasok', async () => {
  const { db, env } = uj();
  const G = { v: 'mp_v2', us: 'google', um: 'cpc', uc: '555', kp: 'gclid', rk: 'search', t: MOST - 50 };
  let s = await foglal(env, { forras: G, forras_tarolo: 'latogatas', diag: { oldalak: 2, nav: 'navigate', opener: 1, elso_ref: 'belso' } });
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras, s.diag_oldalak, s.diag_nav, s.diag_opener, s.diag_elso_ref], ['google_nem_markas', 'latogatas', 2, 'navigate', 1, 'belso']);
  s = await foglal(env, { forras: G, forras_tarolo: 'barmi' });
  assert.equal(s.bizonyitek_forras, 'munkamenet');
  // hibas diag-ertekek eldobva; ismeretlen mezo nem kerul be
  s = await foglal(env, { forras_v: 'mp_v2', diag: { oldalak: '5', nav: 'https://x.hu/', opener: 2, elso_ref: 'https://google.com', url: 'https://x' } });
  assert.deepEqual([s.diag_oldalak, s.diag_nav, s.diag_opener, s.diag_elso_ref, s.ismeretlen_ok], [null, null, null, null, 'nincs_jel']);
  assert.ok(!JSON.stringify(s).includes('https://x'));
  s = await foglal(env, { forras_v: 'mp_v2', diag: { oldalak: 100000, nav: 'prerender', opener: 0, elso_ref: 'nincs' } });
  assert.deepEqual([s.diag_oldalak, s.diag_nav, s.diag_opener, s.diag_elso_ref], [999, 'prerender', 0, 'nincs']);
  await foglal(env, { forras_v: 'mp_v2', diag: { oldalak: 3, elso_ref: 'belso' } });
  // mp_lpt suti tartalek: 'suti' marad, akkor is, ha a kliens latogatast jelez
  const lpt = `mp_lpt=${lptErtek(bizonyitekBemenet({ ...META, t: MOST - 86400 }, MOST))}`;
  s = await foglal(env, { forras: { v: 'mp_v2', rk: 'nincs', t: MOST - 10 }, forras_tarolo: 'latogatas' }, `${SUTI_IGEN}; ${lpt}`);
  assert.deepEqual([s.forras_cimke, s.bizonyitek_forras], ['meta', 'suti']);
  const r = await riport(db, MOST + 60, 2);
  const x = r.sorok.find((o) => o.d1_foglalas > 0);
  assert.deepEqual(x.bizonyitek_forrasok, { munkamenet: 1, latogatas: 1, suti: 1, nincs: 3 });
  assert.deepEqual(x.nincs_jel_elso_ref, { belso: 1, kereso: 0, social: 0, egyeb: 0, nincs: 1, ismeretlen: 1 });
  assert.deepEqual(x.nincs_jel_oldalak, { '1': 0, '2-3': 1, '4+': 1, ismeretlen: 1 });
  assert.deepEqual(x.ismeretlen_okok, { nincs_jel: 3 });
});
