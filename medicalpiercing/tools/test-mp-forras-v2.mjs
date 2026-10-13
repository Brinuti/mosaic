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
function lap({ url, referrer = '', tar = new Map(), cookie = '', top = true }) {
  const u = new URL(url);
  const hivasok = [];
  const sessionStorage = { getItem: (k) => (tar.has(k) ? tar.get(k) : null), setItem: (k, v) => tar.set(k, String(v)), removeItem: (k) => tar.delete(k) };
  const ls = new Map();
  const localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
  const w = {
    location: { hostname: u.hostname, pathname: u.pathname, search: u.search, href: u.href },
    document: { referrer, cookie, addEventListener: () => {}, documentElement: { getAttribute: () => null } },
    sessionStorage, localStorage, URLSearchParams, URL, JSON, Math, Date, Object, String, Number, setTimeout: () => 0,
    addEventListener: () => {},
    fetch: (cim, o) => { hivasok.push({ cim, torzs: JSON.parse(o.body) }); return Promise.resolve({}); },
  };
  w.window = w; w.top = top ? w : {};
  vm.runInNewContext(JS, w);
  return { tar, hivasok, forras: tar.has('mp_forras') ? JSON.parse(tar.get('mp_forras')) : null };
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

test('bongeszo: hozzajarulassal fizetett erkezeskor /api/mp-forras hivas (ertek nelkul), hozzajarulas nelkul nincs', () => {
  const igen = lap({ url: `${H}/?fbclid=SECRETfbclid123&utm_source=meta&utm_medium=paid_social`, cookie: `mp_suti=v1-s1-m1-t${MOST}` });
  const h = igen.hivasok.filter((x) => x.cim === '/api/mp-forras');
  assert.equal(h.length, 1); assert.equal(h[0].torzs.forras.kp, 'fbclid'); assert.ok(!JSON.stringify(h[0]).includes('SECRET'));
  assert.equal(lap({ url: `${H}/?fbclid=SECRETfbclid123`, cookie: `mp_suti=v1-s0-m0-t${MOST}` }).hivasok.length, 0);
  assert.equal(lap({ url: `${H}/?fbclid=SECRETfbclid123` }).hivasok.length, 0);
  assert.equal(lap({ url: `${H}/`, cookie: `mp_suti=v1-s1-m1-t${MOST}` }).hivasok.length, 0, 'nem fizetett erintesre nincs hivas');
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
