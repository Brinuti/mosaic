// Egysegtesztek: forras-cimkezes, hozzajarulas, titkos fuggvenyek, Salonic-adapter es a Worker-vegpontok (D1-szimulatorral, hamis Salonic-gal).
// Futtatas: node --test tools/test-gy-szerver.mjs   (halozat nincs, foglalas nincs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { belepes, cimkez, osszevon, fizetett, referrerKategoria, erintesAdatok } from '../lib/forras.js';
import { hozzajarulas } from '../lib/hozzajarulas.js';
import { tranzakcioId, hmacHex, ujToken, sha256Hex } from '../lib/titkos.js';
import { forrasVegpont, igazolasVegpont, foglalasVegpont, koszonoVegpont, kampanyokVegpont, adminVegpont, atiranyitasElemzes, visszahivasVegpont, sutiConfigVegpont, sutiTesztEllenorzes, SUTI_TESZT_ALAP } from '../lib/motor-szerver.js';
import { createSalonicAdapter, foglalasTipus, ALLAPOTFELMERES_ID } from '../public/assets/js/motor/salonic-adapter.js';
import { eloElemzes } from '../lib/salonic-szerver.js';
import { ujD1 } from './d1-szim.mjs';
import { onRequest as sutiStatVegpont } from '../functions/api/gy-suti-stat.js';
import { salonicHamis } from './salonic-hamis.mjs';

const BASE = 'https://gy.test';
const KULCS = 'proba-titkos-kulcs-0123456789abcdef';
const ADMIN = 'proba-admin-kulcs';
const ZAP = 'proba-zap-kulcs';
const BRAND = '1655523772', DSA = '12757996014';
const LISTA = new Map([[BRAND, { brand: true }], [DSA, { brand: false }]]);
const ts = () => Math.floor(Date.now() / 1000);
const HJ_IGEN = `gy_suti=v1-s1-m1-t${ts()}`;
const HJ_NEM = `gy_suti=v1-s0-m0-t${ts()}`;

// --- forras-cimkezes -----------------------------------------------------------------------------------------------------------------------
test('cimkez: a GY-15 2. pont szerinti esetek', () => {
  const l = { lista: LISTA, friss: true };
  const b = (search, referrer = '', path = '/') => belepes({ search, referrer, path });
  assert.equal(cimkez(b(`?utm_campaign=${BRAND}&gclid=ABCDEFGH12345`), l).cimke, 'google_brand');
  assert.equal(cimkez(b(`?utm_campaign=${DSA}&gclid=ABCDEFGH12345`), l).cimke, 'google_nem_brand');
  assert.equal(cimkez(b(`?utm_campaign=${DSA}&gbraid=ABCDEFGH12345`), l).cimke, 'google_nem_brand');
  // csak az egyik feltetel: bizonytalan, soha nem automatikus nem_brand
  assert.equal(cimkez(b('?gclid=ABCDEFGH12345'), l).cimke, 'google_bizonytalan');
  assert.equal(cimkez(b(`?utm_campaign=${DSA}`), l).cimke, 'google_bizonytalan');
  assert.equal(cimkez(b('?utm_campaign=99999999&gclid=ABCDEFGH12345'), l).cimke, 'google_bizonytalan'); // ismeretlen kampany-ID
  assert.equal(cimkez(b('?utm_source=google&utm_medium=cpc'), l).cimke, 'google_bizonytalan'); // UTM onmagaban nem bizonyitek (hiany a 90%-ban, soha nem brand / nem_brand)
  // ellentmondas
  assert.equal(cimkez(b(`?utm_campaign=${BRAND}&gclid=ABCDEFGH12345&utm_source=facebook`), l).cimke, 'ismeretlen');
  // organikus / direkt
  assert.equal(cimkez(b('', 'https://www.google.com/'), l).cimke, 'organikus');
  assert.equal(cimkez(b('', 'https://www.google.hu/search?q=x'), l).cimke, 'organikus');
  assert.equal(cimkez(b('', 'https://l.facebook.com/l.php?u=x'), l).cimke, 'organikus');
  assert.equal(cimkez(b(''), l).cimke, 'direkt');
  assert.equal(cimkez(null, l).cimke, 'ismeretlen');
  // sikertelen tablafrissites: az utolso lista marad, de az elavulast jelezzuk
  assert.equal(cimkez(b(`?utm_campaign=${BRAND}&gclid=ABCDEFGH12345`), { lista: LISTA, friss: false }).elavult, true);
  // ures lista (meg nem volt szinkron): minden kampany ismeretlen -> bizonytalan
  assert.equal(cimkez(b(`?utm_campaign=${BRAND}&gclid=ABCDEFGH12345`), { lista: new Map(), friss: false }).cimke, 'google_bizonytalan');
});

test('belepes: a kattintas-azonosito erteke csak ervenyes alakban, a tobbi platform erteke soha; a referrer csak domain', () => {
  const x = belepes({ search: '?gclid=<script>&utm_campaign=12 34&utm_source=google', referrer: 'https://www.google.com/search?q=derekfajas&x=1', path: '/derekfajas/' });
  assert.equal(x.kattintas_ertek, null);
  assert.equal(x.utm_campaign, null);
  assert.equal(x.ref_domain, 'google.com');
  const y = belepes({ search: '?fbclid=ABCDEFGH12345678' });
  assert.equal(y.kattintas_param, 'fbclid');
  assert.equal(y.kattintas_ertek, 'ABCDEFGH12345678'); // GY-25: a Meta / TikTok click-ID nyers erteke is (ervenyes alakban), csak hozzajarulassal tarolodik
  assert.equal(referrerKategoria('gyogytornaszom.hu'), 'sajat');
  assert.equal(referrerKategoria('bing.com'), 'search');
});

test('osszevon: az utolso FIZETETT forras nyer; direkt / organikus nem irja felul a fizetettet', () => {
  const fiz = belepes({ search: `?utm_campaign=${BRAND}&gclid=ABCDEFGH12345` });
  const org = belepes({ search: '', referrer: 'https://www.google.com/' });
  const dir = belepes({ search: '' });
  let a = osszevon(null, fiz);
  assert.equal(a.fizetett, true);
  a = osszevon(a, org); assert.equal(a.belepes.utm_campaign, BRAND);
  a = osszevon(a, dir); assert.equal(a.belepes.utm_campaign, BRAND);
  const fiz2 = belepes({ search: `?utm_campaign=${DSA}&gclid=ZZZZZZZZ99999` });
  a = osszevon(a, fiz2); assert.equal(a.belepes.utm_campaign, DSA);
  // nem fizetett utan direkt: marad az organikus
  let b = osszevon(null, org); b = osszevon(b, dir); assert.equal(b.fizetett, false); assert.equal(b.belepes.ref_kat, 'search');
  assert.equal(fizetett(dir), false);
});

test('hozzajarulas: a sajat gy_suti ertelmezese; hianyzo / ervenytelen / regi / jovobeli = nincs hozzajarulas; a CookieYes-suti nem szamit', () => {
  assert.deepEqual(hozzajarulas(HJ_IGEN), { allapot: 'igen', marketing: true, analitika: true });
  assert.deepEqual(hozzajarulas(`gy_suti=v1-s1-m0-t${ts()}`), { allapot: 'nem', marketing: false, analitika: true });
  assert.equal(hozzajarulas(HJ_NEM).allapot, 'nem');
  for (const rossz of ['', 'a=b', 'gy_suti=', 'gy_suti=v2-s1-m1-t1792000000', `gy_suti=v1-s1-m2-t${ts()}`, `gy_suti=v1-s1-m1-t${ts() - 500 * 86400}`, `gy_suti=v1-s1-m1-t${ts() + 5 * 86400}`, 'cookieyes-consent=consentid:abc,consent:yes,action:yes,advertisement:yes']) {
    assert.equal(hozzajarulas(rossz).allapot, 'nincs_dontes', rossz);
    assert.equal(hozzajarulas(rossz).marketing, false, rossz);
  }
});

test('titkos: a tranzakcio-azonosito hex, 64 karakter, determinisztikus; kulcs nelkul hiba', async () => {
  const a = await tranzakcioId('mb_abcdefghij123456', KULCS);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, await tranzakcioId('mb_abcdefghij123456', KULCS));
  assert.notEqual(a, await tranzakcioId('mb_abcdefghij123457', KULCS));
  assert.match(a, /^[A-Za-z0-9_-]{8,128}$/); // a GTM-trigger elvarasa (GY-15 5. pont)
  await assert.rejects(() => hmacHex('', 'x'));
  assert.match(ujToken(), /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await sha256Hex('a')).length, 64);
});

// --- Salonic-adapter a rogzitett valodi oldalakbol ---------------------------------------------------------------------------------------------------------------------
test('adapter: a 3 helyszin szolgaltatasai, arai, munkatarsai a Salonicbol (nincs beegetve)', async () => {
  const ad = createSalonicAdapter({ fetchImpl: salonicHamis() });
  const okt = await ad.getServices(8439);
  assert.deepEqual(okt.map((s) => [s.serviceId, s.activePrice]), [['24666', 23500], ['416586', 19000], ['24667', 19000], ['27315', 13500], ['36855', 17000], ['173650', 16000], ['234838', 29500], ['438133', 22400]]);
  const bat = await ad.getServices(418);
  assert.equal(bat.some((s) => s.serviceId === '173650'), false); // a gyogymasszazs csak az Oktogonban van
  assert.equal(bat.find((s) => s.serviceId === '24666').staffIds.length, 3);
  const staff = await ad.getStaff();
  assert.equal(Object.keys(staff).length, 29);
  assert.ok(Object.values(staff).every((e) => e.nev && /^https:\/\/cdn\.salonic\.hu\//.test(e.foto)));
  assert.equal(Object.values(staff).filter((e) => e.helyszinek.includes(2581)).length, 11);
});

test('foglalasTipus: csak a 24666 es a 416586 allapotfelmeres (Feri dontese); az allkapocs-kezeles nem', () => {
  assert.deepEqual([...ALLAPOTFELMERES_ID], ['24666', '416586']);
  assert.equal(foglalasTipus(24666), 'allapotfelmeres');
  assert.equal(foglalasTipus('416586'), 'allapotfelmeres');
  assert.equal(foglalasTipus('27315'), 'egyeb');
  assert.equal(foglalasTipus('24667'), 'egyeb');
});

test('eloElemzes: aktiv / torolve / ismeretlen', () => {
  const id = '85ebd7de-61c6-79fa-d1c5-c9303082fb23';
  assert.deepEqual(eloElemzes({ status: 200, url: 'x', html: `<a href="/selectDate/?startDate=1792512000&amp;bookingId=${id}">m</a>`, id }), { allapot: 'aktiv', startUnix: 1792512000 });
  assert.equal(eloElemzes({ status: 200, url: `https://gyogytornaszomhu.salonic.hu/booking/deleteSuccess/${id}`, html: '', id }).allapot, 'torolve');
  assert.equal(eloElemzes({ status: 500, url: 'x', html: '', id }).allapot, 'ismeretlen');
});

// --- vegpontok ------------------------------------------------------------------------------------------------------------------------------------------------------
const MOST = Date.UTC(2026, 9, 14, 10, 0, 0); // 2026-10-14 10:00 UTC
const unixMost = Math.floor(MOST / 1000);
const START = Math.floor((unixMost + 6 * 86400) / 900) * 900; // 6 nap mulva, negyedora-illesztve
const kornyezet = (felul = {}) => ({ GY_DB: ujD1(), GY_HMAC_KULCS: KULCS, GY_ADMIN_KULCS_HASH: null, ...felul });
async function ujKornyezet(felul = {}) { const e = kornyezet(felul); e.GY_ADMIN_KULCS_HASH = await sha256Hex(ADMIN); e.GY_ZAP_KULCS_HASH = await sha256Hex(ZAP); return e; }
const kerelem = (ut, body, { cookie = '', origin = BASE, metodus = 'POST', fejlec = {} } = {}) => new Request(BASE + ut, { method: metodus, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...fejlec }, ...(metodus === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
const sutikBol = (r) => r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
const deps = (felul = {}) => ({ most: () => MOST, fetch: salonicHamis({ szabad: { [`8439:24666:31525`]: [START + 3600] }, ...felul }) });

function redirectUrl({ place = 8439, service = '24666', start = START, emp = '31525', ar = 23500, uj = 'true', g = 'g:555' } = {}) {
  const bu = `https://gyogytornaszomhu.salonic.hu/guestData/?anyone=true&employeeId=${emp}&placeId=${place}&serviceId=${service}&startDate=${start}&back=mb_proba1234567890abcdef`;
  return `https://www.gyogytornaszom.hu/allapot-ok?first_booking=${uj}&service=X&price=${ar}&location=L&employee=E&g=${encodeURIComponent(g)}&bookingUrl=${encodeURIComponent(bu)}`;
}
const foglalasBody = (felul = {}) => ({ uuid: 'mb_proba1234567890abcdef', place_id: 8439, service_id: '24666', staff_id: '-1', start_unix: START, redirect_url: redirectUrl(felul.url || {}), ...felul.body });

test('atiranyitasElemzes: a Salonic parameterei, idegen host elutasitva', () => {
  const e = atiranyitasElemzes(redirectUrl());
  assert.deepEqual([e.placeId, e.serviceId, e.startUnix, e.employeeId, e.ar, e.ujVendeg], [8439, '24666', START, '31525', 23500, 'uj']);
  assert.equal(atiranyitasElemzes('https://x.hu/allapot-ok?price=1&bookingUrl=' + encodeURIComponent('https://evil.example/guestData/?placeId=1')), null);
  assert.equal(atiranyitasElemzes('nem url'), null);
});

test('forras-vegpont: munkamenet-suti hozzajarulas nelkul is; 30 napos suti csak hozzajarulassal; visszavonaskor torles', async () => {
  const env = await ujKornyezet();
  const d = deps();
  const be = { search: `?utm_campaign=${BRAND}&gclid=ABCDEFGH12345&utm_source=google&utm_medium=cpc`, referrer: '', path: '/derekfajas-ellen-kezeles/' };
  // hozzajarulas nelkul: csak a munkamenet-suti (session suti: nincs Max-Age)
  let r = await forrasVegpont({ request: kerelem('/api/gy-forras', be), env, deps: d });
  assert.equal(r.status, 200);
  const sc = r.headers.getSetCookie();
  assert.equal(sc.length, 1);
  assert.match(sc[0], /^gy_s=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Lax$/);
  assert.equal(r.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await r.json(), { ok: true });
  // hozzajarulassal: 30 napos suti is (HttpOnly, Secure, SameSite=Lax, Max-Age)
  const env2 = await ujKornyezet();
  r = await forrasVegpont({ request: kerelem('/api/gy-forras', be, { cookie: HJ_IGEN }), env: env2, deps: d });
  const sc2 = r.headers.getSetCookie();
  assert.equal(sc2.length, 2);
  assert.match(sc2.find((c) => c.startsWith('gy_lpt=')), /Max-Age=2592000/);
  assert.ok(sc2.every((c) => /Secure; HttpOnly; SameSite=Lax/.test(c)));
  // visszavonas: a gy_lpt torlodik (Max-Age=0), a rekord is
  const lpt = sc2.find((c) => c.startsWith('gy_lpt=')).split(';')[0];
  r = await forrasVegpont({ request: kerelem('/api/gy-forras', be, { cookie: `${lpt}; ${HJ_NEM}` }), env: env2, deps: d });
  assert.ok(r.headers.getSetCookie().some((c) => /^gy_lpt=; .*Max-Age=0/.test(c)));
  assert.equal((await env2.GY_DB.prepare("SELECT COUNT(*) AS n FROM gy_munkamenet WHERE fajta = 'l'").first()).n, 0);
  // kapcsolo KI: hozzajarulas nelkul nincs suti
  const env3 = await ujKornyezet({ GY_ATTR_NELKUL: '0' });
  r = await forrasVegpont({ request: kerelem('/api/gy-forras', be), env: env3, deps: d });
  assert.equal(r.headers.getSetCookie().length, 0);
  // eredet-vedelem: masik tartomanyrol nem, Origin nelkul nem
  assert.equal((await forrasVegpont({ request: kerelem('/api/gy-forras', be, { origin: 'https://evil.example' }), env, deps: d })).status, 403);
  assert.equal((await forrasVegpont({ request: kerelem('/api/gy-forras', be, { origin: null }), env, deps: d })).status, 403);
  assert.equal((await forrasVegpont({ request: kerelem('/api/gy-forras', 'nem json'), env, deps: d })).status, 400);
});

test('kampanyok-vegpont: kulcs nelkul 401; a BRAND-ID brand, a tobbi nem', async () => {
  const env = await ujKornyezet();
  const d = deps();
  const lista = { kampanyok: [{ id: BRAND, nev: '04 BRAND gyogytornaszom.hu', allapot: 'ENABLED' }, { id: DSA, nev: 'DSA - Automata', allapot: 'ENABLED' }] };
  assert.equal((await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', lista), env, deps: d })).status, 401);
  assert.equal((await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', lista, { fejlec: { 'x-gy-kulcs': 'rossz' } }), env, deps: d })).status, 401);
  const r = await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', lista, { fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d });
  assert.deepEqual(await r.json(), { ok: true, db: 2, brand: 1 });
  assert.equal((await env.GY_DB.prepare('SELECT brand FROM gy_kampany WHERE id = ?').bind(BRAND).first()).brand, 1);
  assert.equal((await env.GY_DB.prepare('SELECT brand FROM gy_kampany WHERE id = ?').bind(DSA).first()).brand, 0);
  assert.equal((await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', { kampanyok: [{ id: 'x' }] }, { fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).status, 400);
});

async function teljesFolyamat({ search = null, cookie = '', env = null, bodyFelul = {}, depsFelul = {}, uuid = 'mb_proba1234567890abcdef', szinkron = true } = {}) {
  env = env || (await ujKornyezet());
  const d = deps(depsFelul);
  if (szinkron) await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', { kampanyok: [{ id: BRAND, allapot: 'ENABLED' }, { id: DSA, allapot: 'ENABLED' }] }, { fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d });
  const f = await forrasVegpont({ request: kerelem('/api/gy-forras', { search: search || `?utm_campaign=${BRAND}&gclid=ABCDEFGH12345&utm_source=google&utm_medium=cpc`, referrer: '', path: '/' }, { cookie }), env, deps: d });
  const sutik = [cookie, sutikBol(f)].filter(Boolean).join('; ');
  const r = await foglalasVegpont({ request: kerelem('/api/gy-foglalas', { ...foglalasBody(), uuid, ...bodyFelul }, { cookie: sutik }), env, deps: d });
  return { env, d, sutik, r, j: await r.json() };
}

test('foglalas-vegpont: sikeres foglalas -> aktiv, egyszeri token, forras-cimke a D1-ben, nincs vendegadat', async () => {
  const { env, d, j } = await teljesFolyamat();
  assert.equal(j.ok, true);
  assert.equal(j.allapot, 'aktiv');
  assert.equal(j.koszono, '/allapot-ok/');
  assert.match(j.token, /^[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(Object.keys(j).sort(), ['allapot', 'koszono', 'ok', 'token']); // a valasz nem hordoz cimkét / forrast / szolgaltatasnevet
  const sor = await env.GY_DB.prepare('SELECT * FROM gy_foglalas').first();
  assert.equal(sor.cimke, 'google_markas');
  assert.equal(sor.tipus, 'allapotfelmeres');
  assert.equal(sor.uj_vendeg, 'uj');
  assert.equal(sor.hozzajarulas, 'nincs_dontes');
  assert.equal(sor.allapot, 'aktiv');
  assert.equal(sor.esemeny_kiadva, 0);
  // a foglalas-rekordban sehol nincs a nyers click-ID, a szolgaltatasnev, az utm, a Salonic g
  const mind = JSON.stringify(sor);
  for (const tilos of ['ABCDEFGH12345', 'Allapotfelmeres', 'Állapotfelmérés', 'g:555', 'utm_', 'gclid']) assert.equal(mind.includes(tilos), false, tilos);
  // a tobbi tabla: a click-ID csak a munkamenet-rekordban (max 24 ora), a riasztas / token / kampany tablakban nincs
  for (const t of ['gy_token', 'gy_riasztas', 'gy_kampany', 'gy_meta']) assert.equal(JSON.stringify((await env.GY_DB.prepare(`SELECT * FROM ${t}`).all()).results).includes('ABCDEFGH12345'), false, t);
  // GY-25: hozzajarulas-dontes nelkul (nincs_dontes) nyers click-ID a munkamenet-rekordban sem tarolodik
  assert.equal(JSON.stringify((await env.GY_DB.prepare('SELECT * FROM gy_munkamenet').all()).results).includes('ABCDEFGH12345'), false);
  void d;
});

test('koszono-vegpont: a token egyszer ad esemenyt (tipus, ertek, tranzakcio_id); tobbszor / token nelkul semleges', async () => {
  const { env, d, j } = await teljesFolyamat();
  const ker = (token) => koszonoVegpont({ request: kerelem('/api/gy-koszono', { token }), env, deps: d });
  const r1 = await ker(j.token);
  assert.equal(r1.headers.get('cache-control'), 'private, no-store');
  const e = await r1.json();
  assert.equal(e.tipus, 'allapotfelmeres');
  assert.equal(e.ertek, 23500);
  assert.match(e.tranzakcio_id, /^[0-9a-f]{64}$/);
  assert.equal(e.tranzakcio_id, await tranzakcioId('mb_proba1234567890abcdef', KULCS));
  assert.deepEqual(await (await ker(j.token)).json(), {}); // masodszor nem
  assert.deepEqual(await (await ker('x'.repeat(43))).json(), {}); // ismeretlen token
  assert.deepEqual(await (await koszonoVegpont({ request: kerelem('/api/gy-koszono', {}), env, deps: d })).json(), {}); // token nelkul
  assert.equal((await koszonoVegpont({ request: kerelem('/api/gy-koszono', { token: j.token }, { origin: 'https://evil.example' }), env, deps: d })).status, 403);
  assert.equal((await env.GY_DB.prepare('SELECT esemeny_kiadva FROM gy_foglalas').first()).esemeny_kiadva, 1);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_token').first()).n, 0); // a felhasznalt token sora torlodik
  // ismetelt foglalas-kerelem ugyanarra az UUID-ra: nincs masodik rekord, nincs uj token (az esemeny mar kiadva)
  const r2 = await foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody()), env, deps: d });
  const j2 = await r2.json();
  assert.equal(j2.ismetles, true);
  assert.equal(j2.token, undefined);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_foglalas').first()).n, 1);
});

test('koszono-token: 15 perc utan lejar', async () => {
  const { env, j } = await teljesFolyamat();
  const kesobb = { most: () => MOST + 16 * 60 * 1000 };
  assert.deepEqual(await (await koszonoVegpont({ request: kerelem('/api/gy-koszono', { token: j.token }), env, deps: kesobb })).json(), {});
});

test('az esemeny meg nem kiadva + uj foglalas-kerelem ugyanarra az UUID-ra: uj token, a rekord nem duplazodik', async () => {
  const { env, d, j } = await teljesFolyamat();
  const r = await foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody()), env, deps: d });
  const j2 = await r.json();
  assert.equal(j2.ismetles, true);
  assert.match(j2.token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(j2.token, j.token);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_foglalas').first()).n, 1);
  // a ket token kozul az elso felhasznalasa kiadja az esemenyt, a masodik mar nem (tartos deduplikacio)
  const a = await (await koszonoVegpont({ request: kerelem('/api/gy-koszono', { token: j.token }), env, deps: d })).json();
  const b = await (await koszonoVegpont({ request: kerelem('/api/gy-koszono', { token: j2.token }), env, deps: d })).json();
  assert.equal(!!a.tranzakcio_id, true);
  assert.deepEqual(b, {});
});

test('egyeb tipus: a Gyogytorna (24667) foglalas /foglalas-ok/ es tipus=egyeb', async () => {
  const d = { most: () => MOST, fetch: salonicHamis({ szabad: { '8439:24667:31525': [START + 7200] } }) };
  const env = await ujKornyezet();
  const body = { ...foglalasBody({ url: { service: '24667', ar: 19000 } }), service_id: '24667', uuid: 'mb_egyeb1234567890abcdef' };
  const j = await (await foglalasVegpont({ request: kerelem('/api/gy-foglalas', body), env, deps: d })).json();
  assert.equal(j.koszono, '/foglalas-ok/');
  const e = await (await koszonoVegpont({ request: kerelem('/api/gy-koszono', { token: j.token }), env, deps: d })).json();
  assert.equal(e.tipus, 'egyeb');
  assert.equal(e.ertek, 19000);
});

test('bizonytalan esetek: nincs token, nincs esemeny, nincs ujrapróbalas; riasztas csak technikai adattal', async () => {
  const eset = async (felul, depsFelul = {}, vart) => {
    const { env, d, j } = await teljesFolyamat({ bodyFelul: felul, depsFelul });
    assert.equal(j.allapot, 'bizonytalan', vart);
    assert.equal(j.token, undefined, vart);
    const sor = await env.GY_DB.prepare('SELECT allapot, esemeny_kiadva FROM gy_foglalas').first();
    assert.deepEqual([sor.allapot, sor.esemeny_kiadva], ['bizonytalan', 0], vart);
    const ria = (await env.GY_DB.prepare('SELECT tipus, adat FROM gy_riasztas').all()).results;
    assert.ok(ria.some((x) => x.adat === vart), vart + ' ' + JSON.stringify(ria));
    for (const x of ria) assert.equal(/ABCDEFGH|g:555|gclid|utm/.test(JSON.stringify(x)), false);
    void d;
  };
  // az idopont MEG szabad (a Salonic nem foglalta le)
  await eset({}, { szabad: { '8439:24666:31525': [START] } }, 'idopont_meg_szabad');
  // a Salonic nem valaszol
  await eset({}, { hiba: true }, 'katalogus_nem_elerheto');
  // az atiranyitas nem egyezik a kert valasztassal (masik idopont)
  await eset({ redirect_url: redirectUrl({ start: START + 900 }) }, {}, 'atiranyitas_nem_egyezik');
  // a fizetett ar nagyobb a katalogus-narnal (nem hihetö)
  await eset({ redirect_url: redirectUrl({ ar: 99999 }) }, {}, 'ar_nem_egyezik');
});

test('kedvezmenyes ar: a Salonic atiranyitasanak ara (<= katalogus-ar) az esemeny erteke', async () => {
  const env = await ujKornyezet();
  const d = deps();
  const j = await (await foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody({ url: { ar: 18800 } })), env, deps: d })).json();
  const e = await (await koszonoVegpont({ request: kerelem('/api/gy-koszono', { token: j.token }), env, deps: d })).json();
  assert.equal(e.ertek, 18800);
});

test('teszt-vendeg (GY_TESZT_G): rekord van, de nincs token / esemeny; a riportban nem szerepel', async () => {
  const env = await ujKornyezet({ GY_TESZT_G: 'g:555,g:777' });
  const d = deps();
  const j = await (await foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody()), env, deps: d })).json();
  assert.equal(j.token, undefined);
  assert.equal((await env.GY_DB.prepare('SELECT teszt FROM gy_foglalas').first()).teszt, 1);
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?riport=2026-10', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  assert.equal(rap.osszes, 0);
});

test('hozzajarulas-allapot a foglalas rekordjaban + sutik nelkul (direkt) is letrejon', async () => {
  const { env } = await teljesFolyamat({ cookie: HJ_NEM });
  assert.equal((await env.GY_DB.prepare('SELECT hozzajarulas FROM gy_foglalas').first()).hozzajarulas, 'nem');
  const env2 = await ujKornyezet();
  const d = deps();
  const j = await (await foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody()), env: env2, deps: d })).json();
  assert.equal(j.allapot, 'aktiv');
  const sor = await env2.GY_DB.prepare('SELECT cimke, bizonyitek FROM gy_foglalas').first();
  assert.equal(sor.cimke, 'ismeretlen'); // nincs munkamenet-suti: nincs bizonyitek -> ismeretlen
});

test('foglalas-vegpont: ervenytelen kerelmek, kulcs nelkul 503', async () => {
  const env = await ujKornyezet();
  const d = deps();
  assert.equal((await foglalasVegpont({ request: kerelem('/api/gy-foglalas', { uuid: 'rossz' }), env, deps: d })).status, 400);
  assert.equal((await foglalasVegpont({ request: kerelem('/api/gy-foglalas', { ...foglalasBody(), redirect_url: 'https://x.hu/?bookingUrl=https://evil.example/' }), env, deps: d })).status, 400);
  assert.equal((await foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody(), { origin: 'https://evil.example' }), env, deps: d })).status, 403);
  const kulcsNelkul = await ujKornyezet({ GY_HMAC_KULCS: '' });
  assert.equal((await foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody()), env: kulcsNelkul, deps: d })).status, 503);
  assert.equal((await foglalasVegpont({ request: kerelem('/api/gy-foglalas', null, { metodus: 'GET' }), env, deps: d })).status, 405);
});

test('admin riport: a 90%-os cel (nevezo, azonositott, hozzajarulo / nem hozzajarulo bontas); csak aggregalt szamok', async () => {
  const env = await ujKornyezet();
  const d = deps({ szabad: { '8439:24666:31525': [START + 3600, START + 7200, START + 10800] } });
  await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', { kampanyok: [{ id: BRAND }, { id: DSA }] }, { fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d });
  const ujFoglalas = async (uuid, search, referrer, cookie, startOffset) => {
    const f = await forrasVegpont({ request: kerelem('/api/gy-forras', { search, referrer, path: '/' }, { cookie }), env, deps: d });
    const c = [cookie, sutikBol(f)].filter(Boolean).join('; ');
    const s = START + startOffset;
    const url = redirectUrl({ start: s });
    d.fetch = salonicHamis({ szabad: { '8439:24666:31525': [START + 99999999] } }); // a foglalt idopontok nem szabadok
    return (await foglalasVegpont({ request: kerelem('/api/gy-foglalas', { ...foglalasBody(), uuid, start_unix: s, redirect_url: url }, { cookie: c }), env, deps: d })).json();
  };
  await ujFoglalas('mb_riport00000000000001', `?utm_campaign=${BRAND}&gclid=ABCDEFGH12345`, '', HJ_IGEN, 3600);
  await ujFoglalas('mb_riport00000000000002', `?utm_campaign=${DSA}&gclid=ABCDEFGH12346`, '', '', 7200);
  await ujFoglalas('mb_riport00000000000003', '?gclid=ABCDEFGH12347', '', '', 10800); // bizonytalan google
  await ujFoglalas('mb_riport00000000000004', '', 'https://www.google.com/', HJ_NEM, 14400);
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?riport=2026-10', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  assert.equal(rap.osszes, 4);
  assert.equal(rap.nevezo, 4);
  assert.equal(rap.azonositott, 3);
  assert.deepEqual([rap.hozzajarulo.nevezo, rap.hozzajarulo.azonositott, rap.nem_hozzajarulo.nevezo, rap.nem_hozzajarulo.azonositott], [1, 1, 3, 2]);
  assert.equal(rap.nem_hozzajarulo.hiany_google_bizonytalan, 1);
  assert.equal(/ABCDEFGH|g:555/.test(JSON.stringify(rap)), false);
  assert.equal((await adminVegpont({ request: kerelem('/api/gy-admin?riport=2026-10', null, { metodus: 'GET' }), env, deps: d })).status, 401);
});

// --- Zapier / Salonic-igazolas -------------------------------------------------------------------------------------------------------------------------------
const SID = '85ebd7de-61c6-79fa-d1c5-c9303082fb23';
const zapKerelem = (body, kulcs = ZAP) => kerelem('/api/gy-salonic-igazolas', body, { fejlec: kulcs ? { 'x-gy-zap-kulcs': kulcs } : {} });
async function foglalasLetrehozva(env, felul = {}) {
  const d = deps(felul);
  await foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody()), env, deps: d });
  return d;
}

test('igazolas: a Salonic elo oldala + hely/idopont egyezes -> igazolt=1; Zap-ujrakuldes nem duplikal', async () => {
  const env = await ujKornyezet();
  const d = await foglalasLetrehozva(env);
  const dd = { ...d, fetch: salonicHamis({ szabad: {}, foglalasok: { [SID]: { startUnix: START } } }) };
  const be = { esemeny: 'igazolas', salonic_id: SID, start_unix: START, place_id: 8439 };
  assert.equal((await igazolasVegpont({ request: zapKerelem(be, null), env, deps: dd })).status, 401);
  assert.equal((await igazolasVegpont({ request: zapKerelem(be, 'rossz'), env, deps: dd })).status, 401);
  const j = await (await igazolasVegpont({ request: zapKerelem(be), env, deps: dd })).json();
  assert.deepEqual(j, { ok: true, allapot: 'aktiv', igazolt: true });
  const sor = await env.GY_DB.prepare('SELECT igazolt, salonic_id, allapot FROM gy_foglalas').first();
  assert.equal(sor.igazolt, 1); assert.equal(sor.salonic_id, SID);
  const ujra = await (await igazolasVegpont({ request: zapKerelem(be), env, deps: dd })).json();
  assert.equal(ujra.ismetles, true);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_foglalas').first()).n, 1);
});

test('igazolas: ismeretlen / nem egyezo / nem aktiv a Salonicban -> nincs igazolas; nincs par -> riasztas; tobb jelolt -> nincs automatikus par', async () => {
  const env = await ujKornyezet();
  const d = await foglalasLetrehozva(env);
  const be = { esemeny: 'igazolas', salonic_id: SID, start_unix: START, place_id: 8439 };
  // a Salonicban nincs ilyen foglalas
  assert.equal((await igazolasVegpont({ request: zapKerelem(be), env, deps: { ...d, fetch: salonicHamis({ foglalasok: {} }) } })).status, 409);
  // az idopont nem egyezik az elo oldallal
  assert.equal((await igazolasVegpont({ request: zapKerelem(be), env, deps: { ...d, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START + 900 } } }) } })).status, 409);
  // a hely/idopont-parhoz nincs foglalas
  const masik = { ...be, start_unix: START + 1800 };
  assert.equal((await igazolasVegpont({ request: zapKerelem(masik), env, deps: { ...d, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START + 1800 } } }) } })).status, 200); // VEGLEGES kimenet: 2xx + nincs_par (a Zap nem probalja ujra)
  const np = await (await igazolasVegpont({ request: zapKerelem(masik), env, deps: { ...d, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START + 1800 } } }) } })).json();
  assert.deepEqual([np.ok, np.nincs_par, np.okkod], [true, true, 'nincs_motoros_jelolt']);
  assert.ok((await env.GY_DB.prepare("SELECT COUNT(*) AS n FROM gy_riasztas WHERE tipus = 'igazolas_nincs_par'").first()).n >= 1);
  assert.equal((await env.GY_DB.prepare('SELECT igazolt FROM gy_foglalas').first()).igazolt, 0);
  // ervenytelen torzs
  assert.equal((await igazolasVegpont({ request: zapKerelem({ esemeny: 'igazolas', salonic_id: 'x' }), env, deps: d })).status, 400);
  assert.equal((await igazolasVegpont({ request: zapKerelem({ ...be, nev: 'Kiss Pista' }), env, deps: { ...d, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START } } }) } })).status, 200); // a felesleges mezot nem tarolja
  // tobb jelolt: ugyanarra a helyre es idopontra ket foglalas
  const env2 = await ujKornyezet();
  const d2 = deps();
  for (const u of ['mb_proba1234567890abcdef', 'mb_masik1234567890abcdef']) await foglalasVegpont({ request: kerelem('/api/gy-foglalas', { ...foglalasBody(), uuid: u }), env: env2, deps: d2 });
  const r = await igazolasVegpont({ request: zapKerelem(be), env: env2, deps: { ...d2, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START } } }) } });
  assert.equal(r.status, 409);
  assert.equal((await env2.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_foglalas WHERE igazolt = 1').first()).n, 0);
});

test('lemondas: csak ha a Salonic elo oldala szerint torolve; ismetles rendben; ismeretlen foglalas -> 404', async () => {
  const env = await ujKornyezet();
  const d = await foglalasLetrehozva(env);
  const igaz = { esemeny: 'igazolas', salonic_id: SID, start_unix: START, place_id: 8439 };
  await igazolasVegpont({ request: zapKerelem(igaz), env, deps: { ...d, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START } } }) } });
  const lem = { esemeny: 'lemondas', salonic_id: SID };
  // meg aktiv: a Zap allitasa kevés
  assert.equal((await igazolasVegpont({ request: zapKerelem(lem), env, deps: { ...d, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START } } }) } })).status, 409);
  assert.equal((await env.GY_DB.prepare('SELECT allapot FROM gy_foglalas').first()).allapot, 'aktiv');
  const torolve = { ...d, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START, torolve: true } } }) };
  assert.equal((await (await igazolasVegpont({ request: zapKerelem(lem), env, deps: torolve })).json()).allapot, 'lemondott');
  assert.equal((await env.GY_DB.prepare('SELECT allapot FROM gy_foglalas').first()).allapot, 'lemondott');
  assert.equal((await (await igazolasVegpont({ request: zapKerelem(lem), env, deps: torolve })).json()).ismetles, true);
  assert.equal((await igazolasVegpont({ request: zapKerelem({ ...lem, salonic_id: '11111111-2222-3333-4444-555555555555' }), env, deps: torolve })).status, 404);
});

test('UTM-sablon (Feri 2026-10-13): kampany / hirdetescsoport / hirdetes azonosito a foglalasra kerul (csak szamok); ervenytelen ertek eldobva; riport-bontas', async () => {
  const { env, d } = await teljesFolyamat({ search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&utm_content=987654321&gyt_ag=123456789&gclid=ABCDEFGH12345` });
  const sor = await env.GY_DB.prepare('SELECT kampany, hirdetescsoport, hirdetes, cimke FROM gy_foglalas').first();
  assert.deepEqual({ ...sor }, { kampany: DSA, hirdetescsoport: '123456789', hirdetes: '987654321', cimke: 'google_nem_markas' });
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?riport=2026-10', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  assert.deepEqual(rap.kampany_bontas.map((x) => ({ ...x })), [{ kampany: DSA, hirdetescsoport: '123456789', cimke: 'google_nem_markas', db: 1 }]);
  // rossz formatum (nem 6-15 szamjegy / szoveg) -> null, nem javitjuk
  const { env: env2 } = await teljesFolyamat({ search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&utm_content=abc&gyt_ag=12&gclid=ABCDEFGH12345` });
  const sor2 = await env2.GY_DB.prepare('SELECT hirdetescsoport, hirdetes FROM gy_foglalas').first();
  assert.deepEqual({ ...sor2 }, { hirdetescsoport: null, hirdetes: null });
  // UTM nelkul (direkt): nincs azonosito
  const { env: env3 } = await teljesFolyamat({ search: '?x=1' });
  assert.equal((await env3.GY_DB.prepare('SELECT kampany FROM gy_foglalas').first()).kampany, null);
});

test('visszahivas: az elo "Telefonos Idopont" urlap mezoi; panasz NEM tarolodik (csak az ertesitesben); hibas mezok, elfogadas, robot, duplikalt szam, limit, eredet, megorzes', async () => {
  const hivasok = [];
  const env = await ujKornyezet({ GY_VISSZAHIVAS_WEBHOOK: 'https://hooks.test/gy' });
  const d = { most: () => MOST, fetch: async (url, o) => { hivasok.push({ url, body: JSON.parse(o.body) }); return new Response('ok'); } };
  const kuld = (b, opt = {}) => visszahivasVegpont({ request: kerelem('/api/gy-visszahivas', b, opt), env, deps: d });
  const jo = { nev: 'Minta Mária', email: 'minta@example.com', tel: '036 30 123 4567', surgosseg: '1-2 héten belül!', hivhato: 'Délután', rendelo: 'Batthyány', panasz: 'Derékfájás a TESZT panasz', elfogad_info: true, elfogad_adatv: true, oldal: '/online-gyogytorna/' };
  assert.equal((await kuld(jo)).status, 200);
  assert.equal(hivasok.length, 1);
  assert.deepEqual(hivasok[0].body, { nev: 'Minta Mária', email: 'minta@example.com', tel: '036 30 123 4567', mikor_szeretne_idopontot: '1-2 héten belül!', mikor_hivhatjuk: 'Délután', melyik_rendelo: 'Batthyány', panasz_roviden: 'Derékfájás a TESZT panasz', oldal: '/online-gyogytorna/', ido: hivasok[0].body.ido });
  const sor = await env.GY_DB.prepare('SELECT * FROM gy_visszahivas').first();
  assert.deepEqual({ ...sor, id: undefined, letrehozva: undefined }, { id: undefined, letrehozva: undefined, nev: 'Minta Mária', email: 'minta@example.com', tel: '036 30 123 4567', rendelo: 'Batthyány', surgosseg: '1-2 héten belül!', hivhato: 'Délután', oldal: '/online-gyogytorna/', ertesitve: 1, allapot: 'uj' });
  assert.equal(JSON.stringify(sor).includes('panasz'), false, 'a panasz szovege nem kerulhet a D1-be');
  assert.equal(JSON.stringify(sor).includes('Derékfájás'), false);
  // ugyanaz a szam 10 percen belul: sikert kap, de nincs ujabb sor / ertesites
  assert.equal((await kuld(jo)).status, 200);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_visszahivas').first()).n, 1);
  assert.equal(hivasok.length, 1);
  // panasz nelkul is rendben (nem kotelezo); az ertesitesben "-"
  assert.equal((await kuld({ ...jo, tel: '036 30 444 0000', panasz: '' })).status, 200);
  assert.equal(hivasok[1].body.panasz_roviden, '-');
  // hibas mezok (mindegyik 400)
  const rossz = (felul) => kuld({ ...jo, tel: '036 30 999 0000', ...felul });
  assert.equal((await rossz({ nev: 'A' })).status, 400);
  assert.equal((await rossz({ email: 'nem-email' })).status, 400);
  assert.equal((await rossz({ tel: '12345' })).status, 400);
  assert.equal((await rossz({ surgosseg: 'x' })).status, 400);
  assert.equal((await rossz({ hivhato: 'x' })).status, 400);
  assert.equal((await rossz({ rendelo: 'Mindegy' })).status, 400);
  assert.equal((await rossz({ elfogad_info: false })).status, 400);
  assert.equal((await rossz({ elfogad_adatv: false })).status, 400);
  assert.equal((await kuld('nem json')).status, 400);
  // robot (csapda-mezo): sikert kap, de nem mentunk semmit
  assert.equal((await kuld({ ...jo, tel: '036 30 777 0000', bot: 'x' })).status, 200);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_visszahivas').first()).n, 2);
  // ervenytelen oldal -> null (nem tarolunk idegen erteket)
  assert.equal((await kuld({ ...jo, tel: '036 30 666 0000', oldal: 'http://rossz' })).status, 200);
  assert.equal((await env.GY_DB.prepare("SELECT oldal FROM gy_visszahivas WHERE tel = '036 30 666 0000'").first()).oldal, null);
  // idegen eredet / GET
  assert.equal((await kuld(jo, { origin: 'https://rossz.example' })).status, 403);
  assert.equal((await visszahivasVegpont({ request: kerelem('/api/gy-visszahivas', null, { metodus: 'GET' }), env, deps: d })).status, 405);
  // webhook-hiba: a kerelem megvan (panasz nelkul), ertesitve=0, riasztas
  const env2 = await ujKornyezet({ GY_VISSZAHIVAS_WEBHOOK: 'https://hooks.test/gy' });
  const d2 = { most: () => MOST, fetch: async () => { throw new Error('halozat'); } };
  assert.equal((await visszahivasVegpont({ request: kerelem('/api/gy-visszahivas', jo), env: env2, deps: d2 })).status, 200);
  assert.equal((await env2.GY_DB.prepare('SELECT ertesitve FROM gy_visszahivas').first()).ertesitve, 0);
  assert.equal((await env2.GY_DB.prepare("SELECT COUNT(*) AS n FROM gy_riasztas WHERE tipus = 'visszahivas_nincs_ertesites'").first()).n, 1);
  assert.equal(JSON.stringify(await env2.GY_DB.prepare('SELECT * FROM gy_riasztas').all()).includes('Derékfájás'), false, 'a riasztasba sem kerulhet panasz');
  // oraankenti limit: 30 kerelem utan 429
  const env3 = await ujKornyezet();
  for (let i = 0; i < 30; i++) assert.equal((await visszahivasVegpont({ request: kerelem('/api/gy-visszahivas', { ...jo, tel: `036 30 100 ${String(1000 + i)}` }), env: env3, deps: d })).status, 200);
  assert.equal((await visszahivasVegpont({ request: kerelem('/api/gy-visszahivas', { ...jo, tel: '036 30 200 0000' }), env: env3, deps: d })).status, 429);
  // admin lista (kulcsos): panasz-mezo nincs
  const lista = await (await adminVegpont({ request: kerelem('/api/gy-admin?visszahivasok=1', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  assert.equal(lista.visszahivasok.length, 3);
  assert.equal(JSON.stringify(lista).includes('Derékfájás'), false);
  // megorzes: 60 nap utan torlodik
  const { takarit } = await import('../lib/db.js');
  await takarit(env.GY_DB, Math.floor((MOST + 61 * 86400 * 1000) / 1000));
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_visszahivas').first()).n, 0);
});

test('SAV_KI mod (GY_SAV_KI=1, Feri 2026-10-14): dontes nelkul az alapertelmezes "megadott"; a latogato kifejezett dontese elsobbseget el; kapcsolo nelkul a regi viselkedes', async () => {
  assert.deepEqual(hozzajarulas('', { alap: true }), { allapot: 'igen', marketing: true, analitika: true });
  assert.deepEqual(hozzajarulas('gy_suti=v2-s1-m1-t1', { alap: true }), { allapot: 'igen', marketing: true, analitika: true }); // ervenytelen suti = alapertek
  assert.equal(hozzajarulas(HJ_NEM, { alap: true }).allapot, 'nem'); // kifejezett elutasitas elsobbseget el
  assert.deepEqual(hozzajarulas(`gy_suti=v1-s1-m0-t${ts()}`, { alap: true }), { allapot: 'nem', marketing: false, analitika: true });
  assert.equal(hozzajarulas('').allapot, 'nincs_dontes'); // alap nelkul a regi
  const be = { search: `?utm_campaign=${BRAND}&gclid=ABCDEFGH12345&utm_source=google&utm_medium=cpc`, referrer: '', path: '/x/' };
  const d = deps();
  // KI mod, suti nelkul: 30 napos suti is megy (alapertelmezett hozzajarulas)
  const env = await ujKornyezet({ GY_SAV_KI: '1' });
  let r = await forrasVegpont({ request: kerelem('/api/gy-forras', be), env, deps: d });
  assert.equal(r.headers.getSetCookie().length, 2);
  assert.match(r.headers.getSetCookie().find((c) => c.startsWith('gy_lpt=')), /Max-Age=2592000/);
  // KI mod, de a latogato elutasitott: nincs 30 napos suti
  const env2 = await ujKornyezet({ GY_SAV_KI: '1' });
  r = await forrasVegpont({ request: kerelem('/api/gy-forras', be, { cookie: HJ_NEM }), env: env2, deps: d });
  assert.equal(r.headers.getSetCookie().length, 1);
  // kapcsolo nincs: a regi viselkedes
  const env3 = await ujKornyezet();
  r = await forrasVegpont({ request: kerelem('/api/gy-forras', be), env: env3, deps: d });
  assert.equal(r.headers.getSetCookie().length, 1);
});

test('sav-teszt: konfig (alapertek, kulcsos csere, ellenorzes), A/B statisztika oldalra / valtozatra bontva, elfogadasi arany a riportban', async () => {
  const env = await ujKornyezet();
  const d = { most: () => MOST };
  // alapertek: 1 oldal, 2 valtozat (A = a 16:35-os dizajn, B = kesleltetett, rovid szoveg)
  let r = await sutiConfigVegpont({ request: kerelem('/api/gy-suti-config', null, { metodus: 'GET', origin: null }), env });
  assert.equal(r.status, 200);
  const alap = await r.json();
  assert.deepEqual(alap.oldalak, ['/az-izuleti-fajdalom-okai-tunetei-es-gyogytornaja']);
  assert.deepEqual(alap.valtozatok.map((v) => [v.id, v.kesleltetes, v.gorgetes]), [['v1', 0, 0], ['v2', 3, 30]]);
  // csere: kulcs nelkul 401, ervenytelen konfig 400, ervenyes -> a GET mar az uj erteket adja
  const uj = { aktiv: true, oldalak: ['/masik-oldal/'], valtozatok: [{ id: 'v1', suly: 70, cim: 'Cim', szoveg: 'Szoveg', kesleltetes: 2, gorgetes: 10, pozicio: 'felso', gombsorrend: 'elutasit_elol', halvany: false, ismeretlen: 'x' }, { id: 'v3', suly: 30, cim: 'B', szoveg: 'B szoveg' }] };
  assert.equal((await sutiConfigVegpont({ request: kerelem('/api/gy-suti-config', uj), env })).status, 401);
  const fejlec = { 'x-gy-kulcs': ADMIN };
  assert.equal((await sutiConfigVegpont({ request: kerelem('/api/gy-suti-config', { ...uj, oldalak: ['http://rossz'] }, { fejlec }), env })).status, 400);
  assert.equal((await sutiConfigVegpont({ request: kerelem('/api/gy-suti-config', { ...uj, valtozatok: [{ ...uj.valtozatok[0], id: 'x' }] }, { fejlec }), env })).status, 400);
  assert.equal((await sutiConfigVegpont({ request: kerelem('/api/gy-suti-config', { ...uj, valtozatok: [{ ...uj.valtozatok[0], kesleltetes: 999 }] }, { fejlec }), env })).status, 400);
  assert.equal((await sutiConfigVegpont({ request: kerelem('/api/gy-suti-config', uj, { fejlec }), env })).status, 200);
  const gy = await (await sutiConfigVegpont({ request: kerelem('/api/gy-suti-config', null, { metodus: 'GET', origin: null }), env })).json();
  assert.deepEqual(gy.oldalak, ['/masik-oldal/']);
  assert.equal(gy.valtozatok[0].ismeretlen, undefined);
  assert.deepEqual(gy.valtozatok.map((v) => [v.id, v.pozicio, v.gombsorrend, v.halvany]), [['v1', 'felso', 'elutasit_elol', false], ['v3', 'also', 'elfogad_elol', true]]);
  assert.equal(sutiTesztEllenorzes(SUTI_TESZT_ALAP) !== null, true);
  // statisztika: oldalra / valtozatra / eszkozre bontva; ervenytelen valtozat / oldal / esemeny elutasitva
  const stat = (b) => sutiStatVegpont({ request: new Request(BASE + '/api/gy-suti-stat', { method: 'POST', body: JSON.stringify(b) }), env });
  const P = '/az-izuleti-fajdalom-okai-tunetei-es-gyogytornaja/';
  for (const [v, e, db] of [['v1', 'megjelent', 4], ['v1', 'elfogad', 2], ['v1', 'elutasit', 1], ['v1', 'dontes_nelkul', 1], ['v2', 'megjelent', 4], ['v2', 'elfogad', 3], ['v2', 'elutasit', 1]]) for (let i = 0; i < db; i++) assert.equal((await stat({ e, n: 'nagy', m: 1, v, p: P })).status, 204);
  assert.equal((await stat({ e: 'megjelent', n: 'nagy', m: 0, v: 'x', p: P })).status, 204); // ervenytelen valtozat -> v0
  assert.equal((await stat({ e: 'rossz', n: 'nagy', m: 0, v: 'v1', p: P })).status, 400);
  assert.equal((await stat({ e: 'megjelent', n: 'nagy', m: 0, v: 'v1', p: 'http://rossz' })).status, 204); // rossz oldal: a regi (oldal nelkuli) tablaba
  assert.equal((await env.GY_DB.prepare("SELECT COUNT(*) AS n FROM gy_suti_teszt WHERE oldal = ?").bind(P.toLowerCase()).first()).n >= 1, true);
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?suti_teszt=1', null, { metodus: 'GET', fejlec }), env, deps: d })).json();
  const v1 = rap.osszesitett.find((x) => x.verzio === 'v1'), v2 = rap.osszesitett.find((x) => x.verzio === 'v2');
  assert.deepEqual([v1.megjelent, v1.elfogad, v1.elutasit, v1.dontes_nelkul, v1.elfogadasi_arany], [4, 2, 1, 1, 50]); // 2 / (2+1+0+1)
  assert.deepEqual([v2.megjelent, v2.elfogad, v2.elfogadasi_arany], [4, 3, 75]);
  assert.equal(v1.eszkoz, 'mobil');
  assert.equal(JSON.stringify(rap).includes('cookie'), false);
});

test('GY: tobb utm_campaign (regi hirdetesszintu template + fiokszintu suffix): a szamszeru ID nyer, alias csak ellenorzott, konfliktusnal nincs valasztas, okkodok', () => {
  const SZ = 'gyogytornaszomhu-brand';
  const q = (s) => belepes({ search: s });
  // a BRAND landing: szoveges + szamszeru utm_campaign -> a szamszeru ID, brand
  const a = q(`?utm_source=google&utm_medium=cpc&utm_campaign=${SZ}&utm_source=google&utm_medium=cpc&utm_campaign=${BRAND}&utm_term=111222333&utm_content=987654321&gclid=ABCDEFGH12345`);
  assert.equal(a.utm_campaign, BRAND);
  assert.equal(cimkez(a, { lista: LISTA }).cimke, 'google_brand');
  assert.equal(cimkez(a, { lista: LISTA }).bizonyitek, 'kampany_es_katt');
  // fordított sorrend is ugyanaz
  assert.equal(q(`?utm_campaign=${BRAND}&utm_campaign=${SZ}&gclid=ABCDEFGH12345`).utm_campaign, BRAND);
  // csak a szoveges alias: ellenorzott megfeleltetes -> BRAND, kulon okkoddal
  const b = q(`?utm_campaign=${SZ}&gclid=ABCDEFGH12345`);
  assert.deepEqual([b.utm_campaign, cimkez(b, { lista: LISTA }).cimke, cimkez(b, { lista: LISTA }).bizonyitek], [BRAND, 'google_brand', 'kampany_alias_es_katt']);
  // ismeretlen szoveges kampany: marad bizonytalan, okkoddal (nincs kitalalt ID)
  const c = q('?utm_campaign=valami-mas&gclid=ABCDEFGH12345');
  assert.deepEqual([c.utm_campaign, cimkez(c, { lista: LISTA }).cimke, cimkez(c, { lista: LISTA }).bizonyitek], ['valami-mas', 'google_bizonytalan', 'utm_campaign_szoveges']);
  // ket KULONBOZO ervenyes ID: nem valasztunk
  const d = q(`?utm_campaign=${BRAND}&utm_campaign=${DSA}&gclid=ABCDEFGH12345`);
  assert.deepEqual([d.utm_campaign, cimkez(d, { lista: LISTA }).cimke, cimkez(d, { lista: LISTA }).bizonyitek], [null, 'google_bizonytalan', 'kampany_konfliktus']);
  // click-ID van, utm_campaign nincs
  assert.equal(cimkez(q('?gclid=ABCDEFGH12345'), { lista: LISTA }).bizonyitek, 'utm_campaign_hianyzik');
  // ugyanaz az ID ketszer: nem konfliktus
  assert.equal(q(`?utm_campaign=${BRAND}&utm_campaign=${BRAND}&gclid=ABCDEFGH12345`).utm_campaign, BRAND);
});

test('GY: a hirdetescsoport gyt_ag hianyaban az utm_term-bol jon (csak szamjegy)', async () => {
  const { hirdetesAzonositok } = await import('../lib/forras.js');
  assert.equal(hirdetesAzonositok(belepes({ search: `?utm_campaign=${DSA}&utm_term=123456789&gclid=ABCDEFGH12345` })).hirdetescsoport, '123456789');
  assert.equal(hirdetesAzonositok(belepes({ search: `?utm_campaign=${DSA}&utm_term=kulcsszo&gclid=ABCDEFGH12345` })).hirdetescsoport, null);
  assert.equal(hirdetesAzonositok(belepes({ search: `?utm_campaign=${DSA}&utm_term=123456789&gyt_ag=555666777&gclid=ABCDEFGH12345` })).hirdetescsoport, '555666777');
});

test('GY: a suti-stat kornyezet az Origin / Referer alapjan jon (a proxy a pages.dev hostot mutatja)', async () => {
  const { env } = await teljesFolyamat({ search: '?x=1' });
  const kuld = (fejlec) => sutiStatVegpont({ request: new Request('https://gyogytorna.pages.dev/api/gy-suti-stat', { method: 'POST', headers: fejlec, body: JSON.stringify({ e: 'megjelent', n: 'nagy', m: 1, v: 'v1', p: '/valami/' }) }), env });
  assert.equal((await kuld({ origin: 'https://www.gyogytornaszom.hu' })).status, 204);
  assert.equal((await kuld({ referer: 'https://www.gyogytornaszom.hu/valami/' })).status, 204);
  assert.equal((await kuld({ origin: 'https://claude-x.gyogytorna.pages.dev' })).status, 204);
  assert.equal((await kuld({})).status, 204);
  const sorok = (await env.GY_DB.prepare("SELECT kornyezet, SUM(db) AS n FROM gy_suti_teszt GROUP BY kornyezet").all()).results.map((x) => [x.kornyezet, x.n]).sort();
  assert.deepEqual(sorok, [['eles', 2], ['elonezet', 2]]);
});

// --- GY-22: 7 napos last paid click erintesi naplo (ARNYEK) ---------------------------------------------------------------------------------------------
const NAPMP = 86400 * 1000;
const dAt = (ms) => ({ most: () => MOST + ms, fetch: salonicHamis({ szabad: { '8439:24666:31525': [START + 3600] } }) });
async function lpcKornyezet() {
  const env = await ujKornyezet();
  await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', { kampanyok: [{ id: BRAND, allapot: 'ENABLED' }, { id: DSA, allapot: 'ENABLED' }] }, { fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() });
  return env;
}
const ping = (env, ms, search, cookie = HJ_IGEN, referrer = '') => forrasVegpont({ request: kerelem('/api/gy-forras', { search, referrer, path: '/cikk/' }, { cookie }), env, deps: dAt(ms) });
const foglal = async (env, ms, cookie, uuid) => { const r = await foglalasVegpont({ request: kerelem('/api/gy-foglalas', { ...foglalasBody(), uuid }, { cookie }), env, deps: dAt(ms) }); return r.json(); };
const lpcSor = (env, uuid) => env.GY_DB.prepare('SELECT cimke, lpc_cimke, lpc_bizonyitek, lpc_kampany, lpc_hirdetescsoport, lpc_hirdetes, lpc_kora_nap, kesoi_fizetett, lpc_verzio FROM gy_foglalas WHERE uuid = ?').bind(uuid).first();

test('GY-22 (a): gclid-es erkezes -> 3 nappal kesobbi direkt visszateres -> foglalas = google_nem_markas (a naplo kampany / hirdetescsoport / hirdetes ID-t es a kattintas korat is adja)', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&utm_content=987654321&gyt_ag=123456789&gclid=ABCDEFGH12345`);
  const lpt = sutikBol(r); // gy_lpt (30 nap) + gy_s
  const harom = 3 * NAPMP;
  await ping(env, harom, '', `${lpt}; ${HJ_IGEN}`, ''); // direkt visszateres: nem ir felul, nem naploz
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_erintes').first()).n, 1);
  const j = await foglal(env, harom + 3600 * 1000, lpt.split('; ').filter((c) => c.startsWith('gy_lpt=')).join('; ') + '; ' + HJ_IGEN, 'mb_lpca0000000000001');
  assert.equal(j.ok, true);
  const sor = await lpcSor(env, 'mb_lpca0000000000001');
  assert.deepEqual({ ...sor }, { cimke: 'google_nem_markas', lpc_cimke: 'google_nem_markas', lpc_bizonyitek: 'kampany_es_katt', lpc_kampany: DSA, lpc_hirdetescsoport: '123456789', lpc_hirdetes: '987654321', lpc_kora_nap: 3, kesoi_fizetett: null, lpc_verzio: 'lpc1' });
});

test('GY-22 (b): BRAND kattintas -> google_markas; ujabb fizetett felulirja a regebbit; organikus / direkt nem ir felul', async () => {
  const env = await lpcKornyezet();
  let r = await ping(env, 0, `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ABCDEFGH12345`);
  const lpt = sutikBol(r).split('; ').find((c) => c.startsWith('gy_lpt='));
  await ping(env, 2 * NAPMP, `?utm_source=google&utm_medium=cpc&utm_campaign=${BRAND}&gclid=ZZZZZZZZ99999`, `${lpt}; ${HJ_IGEN}`);
  await ping(env, 3 * NAPMP, '', `${lpt}; ${HJ_IGEN}`, 'https://www.google.com/'); // organikus visszateres
  const j = await foglal(env, 3 * NAPMP + 600000, `${lpt}; ${HJ_IGEN}`, 'mb_lpcb0000000000001');
  assert.equal(j.ok, true);
  const sor = await lpcSor(env, 'mb_lpcb0000000000001');
  assert.deepEqual([sor.lpc_cimke, sor.lpc_kampany, sor.lpc_kora_nap], ['google_markas', BRAND, 1]);
});

test('GY-22 (c): 8+ napos kattintas -> organikus_direkt + kesoi_fizetett kitoltve; 30 napnal regebbi nem szamit', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, `?utm_source=google&utm_medium=cpc&utm_campaign=${BRAND}&gclid=ABCDEFGH12345`);
  const lpt = sutikBol(r).split('; ').find((c) => c.startsWith('gy_lpt='));
  const j = await foglal(env, 8 * NAPMP + 3600000, `${lpt}; ${HJ_IGEN}`, 'mb_lpcc0000000000001');
  assert.equal(j.ok, true);
  const sor = await lpcSor(env, 'mb_lpcc0000000000001');
  assert.deepEqual([sor.lpc_cimke, sor.lpc_bizonyitek, sor.kesoi_fizetett, sor.lpc_kampany], ['organikus_direkt', 'nincs_fizetett_7_napon_belul', 'google_markas', null]);
  const j2 = await foglal(env, 31 * NAPMP, `${lpt}; ${HJ_IGEN}`, 'mb_lpcc0000000000002');
  assert.equal(j2.ok, true);
  assert.equal((await lpcSor(env, 'mb_lpcc0000000000002')).kesoi_fizetett, null);
  // azonosito nelkul (nincs suti) -> ismeretlen
  const j3 = await foglal(env, 0, HJ_IGEN, 'mb_lpcc0000000000003');
  assert.equal(j3.ok, true);
  const s3 = await lpcSor(env, 'mb_lpcc0000000000003');
  assert.deepEqual([s3.lpc_cimke, s3.lpc_bizonyitek], ['ismeretlen', 'nincs_azonosito']);
});

test('GY-22: ismeretlen kampany-ID google_bizonytalan, a kampanylista kesobbi frissitese utolag feloldja; ujratoltes nem naplozik ketszer', async () => {
  const env = await lpcKornyezet();
  const UJ = '99887766554';
  const r = await ping(env, 0, `?utm_source=google&utm_medium=cpc&utm_campaign=${UJ}&gclid=ABCDEFGH12345`);
  const lpt = sutikBol(r).split('; ').find((c) => c.startsWith('gy_lpt='));
  await ping(env, 60000, `?utm_source=google&utm_medium=cpc&utm_campaign=${UJ}&gclid=ABCDEFGH12345`, `${lpt}; ${HJ_IGEN}`); // ugyanaz 1 perc mulva: ujratoltes
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_erintes').first()).n, 1);
  assert.equal((await env.GY_DB.prepare('SELECT cimke FROM gy_erintes').first()).cimke, 'google_bizonytalan');
  const j = await foglal(env, 3600000, `${lpt}; ${HJ_IGEN}`, 'mb_lpcd0000000000001');
  assert.equal((await lpcSor(env, 'mb_lpcd0000000000001')).lpc_cimke, 'google_bizonytalan');
  await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', { kampanyok: [{ id: BRAND }, { id: DSA }, { id: UJ }] }, { fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() });
  await foglal(env, 3700000, `${lpt}; ${HJ_IGEN}`, 'mb_lpcd0000000000002');
  assert.deepEqual([(await lpcSor(env, 'mb_lpcd0000000000002')).lpc_cimke, (await lpcSor(env, 'mb_lpcd0000000000002')).lpc_bizonyitek], ['google_nem_markas', 'kampany_es_katt_utolag']);
});

test('GY-22 (d): elutasitas (visszavont hozzajarulas) utan nincs iras, a meglevo naplo torlodik; adatminimum: nyers click-ID / URL / UA nincs a naploban', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, `?utm_source=google&utm_medium=cpc&utm_campaign=${BRAND}&gclid=ABCDEFGH12345&email=a@b.hu`);
  const lpt = sutikBol(r).split('; ').find((c) => c.startsWith('gy_lpt='));
  const sor = JSON.stringify(await env.GY_DB.prepare('SELECT * FROM gy_erintes').first());
  for (const tilos of ['a@b.hu', 'utm_', 'Mozilla']) assert.equal(sor.includes(tilos), false, tilos);
  assert.equal((await env.GY_DB.prepare('SELECT katt_tipus AS t, katt_ertek AS k FROM gy_erintes').first()).k, 'ABCDEFGH12345'); // GY-25: a nyers click-ID csak a katt_ertek oszlopban (hozzajarulassal; 60 nap utan torlodik)
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_erintes').first()).n, 1);
  const NEM = `gy_suti=v1-s0-m0-t${ts()}`; // lábléci elutasítás: nincs marketing-hozzajarulas
  await ping(env, 1000, `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ZZZZZZZZ99999`, `${lpt}; ${NEM}`);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_erintes').first()).n, 0); // torolve, uj nem keletkezett
  const j = await foglal(env, 5000, `${lpt}; ${NEM}`, 'mb_lpce0000000000001');
  assert.equal(j.ok, true);
  assert.equal((await lpcSor(env, 'mb_lpce0000000000001')).lpc_bizonyitek, 'nincs_hozzajarulas');
});

test('GY-22 (e): naplohiba szimulalva -> a foglalas sikeres (fail-open), hibaszamlalo + riasztas', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, `?utm_source=google&utm_medium=cpc&utm_campaign=${BRAND}&gclid=ABCDEFGH12345`);
  const lpt = sutikBol(r).split('; ').find((c) => c.startsWith('gy_lpt='));
  await env.GY_DB.prepare('DROP TABLE gy_erintes').run(); // a naplo "elromlik"
  const r2 = await ping(env, 1000, `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ZZZZZZZZ99999`, `${lpt}; ${HJ_IGEN}`);
  assert.equal(r2.status, 200); // a forras-ping sem akad el
  const j = await foglal(env, 5000, `${lpt}; ${HJ_IGEN}`, 'mb_lpcf0000000000001');
  assert.equal(j.ok, true);
  assert.equal(j.allapot, 'aktiv');
  assert.match(j.token, /^[A-Za-z0-9_-]{43}$/);
  const sor = await lpcSor(env, 'mb_lpcf0000000000001');
  assert.equal(sor.lpc_cimke, null);
  assert.ok(Number((await env.GY_DB.prepare("SELECT ertek FROM gy_meta WHERE kulcs = 'lpc_hiba'").first()).ertek) >= 2);
  assert.ok((await env.GY_DB.prepare("SELECT COUNT(*) AS n FROM gy_riasztas WHERE tipus = 'lpc_hiba'").first()).n >= 2);
});

test('GY-22: a foglalas-valasz, a cimke es a koszono-esemeny VALTOZATLAN (arnyek); admin ?lpc= riport csak aggregalt szamokat ad; 37 napnal regebbi naplosor torlodik', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, `?utm_source=google&utm_medium=cpc&utm_campaign=${BRAND}&gclid=ABCDEFGH12345`);
  const cook = `${sutikBol(r)}; ${HJ_IGEN}`;
  const j = await foglal(env, 600000, cook, 'mb_lpcg0000000000001');
  assert.deepEqual(Object.keys(j).sort(), ['allapot', 'koszono', 'ok', 'token']);
  assert.equal((await env.GY_DB.prepare('SELECT cimke FROM gy_foglalas WHERE uuid = ?').bind('mb_lpcg0000000000001').first()).cimke, 'google_markas'); // GY-25: a foglalas cimkeje az uj (7 napos utolso fizetett kattintas), a regi a cimke_regi-ben
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?lpc=2026-10', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() })).json();
  assert.equal(rap.ok, true);
  assert.deepEqual([rap.szabaly_verzio, rap.nevezo, rap.lpc_azonositott, rap.munkamenet_azonositott, rap.erintesi_naplo_sorok], ['lpc1', 1, 1, 1, 1]);
  assert.equal(JSON.stringify(rap).includes('mb_lpc'), false);
  // megorzes: 37 nap utan a sor torlodik (takaritas)
  await takaritTeszt(env, MOST / 1000 + 38 * 86400);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_erintes').first()).n, 0);
});
async function takaritTeszt(env, most) { const { takarit } = await import('../lib/db.js'); await takarit(env.GY_DB, Math.floor(most)); }

// --- Zapier igazolas: munkatars-szukites, lemondas bookingId nelkul, kulcsrotacio (GPT-review 2026-10-18: MODOSITASSAL jovahagyva) -----------------------------------------------
const SID2 = '0f3a1c52-7d9e-4b8a-9c11-aa22bb33cc44';
async function ketFoglalas(env) {
  const d = deps();
  const uj = (uuid, emp) => foglalasVegpont({ request: kerelem('/api/gy-foglalas', foglalasBody({ url: { emp }, body: { uuid } })), env, deps: d });
  assert.equal((await (await uj('mb_ketfoglalas000001', '31525')).json()).ok, true);
  assert.equal((await (await uj('mb_ketfoglalas000002', '18783')).json()).ok, true);
  return d;
}
const elo = (d, foglalasok) => ({ ...d, fetch: salonicHamis({ szabad: {}, foglalasok }) });

test('igazolas: tobb jelolt -> a munkatars_nev CSAK szukit (pontosan egy employeeId + egy HMAC-egyezo jelolt); egyebkent 409 + okkod', async () => {
  const env = await ujKornyezet();
  const d = await ketFoglalas(env);
  const be = { esemeny: 'igazolas', salonic_id: SID, start_unix: START, place_id: 8439 };
  const dd = elo(d, { [SID]: { startUnix: START } });
  const r0 = await igazolasVegpont({ request: zapKerelem(be), env, deps: dd });
  assert.deepEqual([r0.status, (await r0.json()).okkod], [409, 'tobb_azonos_idopont_es_hely']);
  // ismeretlen nev / masik helyszin munkatarsa: nincs fuzzy egyezes
  for (const nev of ['Nincs Ilyen', 'Nemeth Nora']) {
    const r = await igazolasVegpont({ request: zapKerelem({ ...be, munkatars_nev: nev }), env, deps: dd });
    assert.deepEqual([r.status, (await r.json()).okkod], [409, 'munkatars_nev_nincs_egyezes']);
  }
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_foglalas WHERE salonic_id IS NOT NULL').first()).n, 0);
  // pontos nev (kis/nagybetu es ekezet nem szamit): a megfelelo foglalas igazolodik, a masik valtozatlan marad
  const r1 = await igazolasVegpont({ request: zapKerelem({ ...be, munkatars_nev: 'tomor ALEXANDRA' }), env, deps: dd });
  assert.deepEqual([r1.status, (await r1.json()).igazolt], [200, true]);
  const sorok = (await env.GY_DB.prepare('SELECT uuid, salonic_id, igazolt FROM gy_foglalas ORDER BY uuid').all()).results;
  assert.deepEqual(sorok.map((x) => [x.uuid, x.salonic_id, x.igazolt]), [['mb_ketfoglalas000001', SID, 1], ['mb_ketfoglalas000002', null, 0]]);
  // a masodik foglalas a sajat munkatarsaval igazolodik (mar csak egy jelolt maradt)
  const r2 = await igazolasVegpont({ request: zapKerelem({ ...be, salonic_id: SID2, munkatars_nev: 'Mosolygó Zsuzsanna' }), env, deps: elo(d, { [SID2]: { startUnix: START } }) });
  assert.equal(r2.status, 200);
});

test('lemondas bookingId nelkul: pontosan egy bizonyitottan torolt jelolt -> lemondott; 0 / tobb torolt / ellenorzesi hiba -> nem valtoztat, okkod', async () => {
  const env = await ujKornyezet();
  const d = await ketFoglalas(env);
  const be = { esemeny: 'igazolas', salonic_id: SID, start_unix: START, place_id: 8439 };
  await igazolasVegpont({ request: zapKerelem({ ...be, munkatars_nev: 'Tomor Alexandra' }), env, deps: elo(d, { [SID]: { startUnix: START } }) });
  await igazolasVegpont({ request: zapKerelem({ ...be, salonic_id: SID2, munkatars_nev: 'Mosolygó Zsuzsanna' }), env, deps: elo(d, { [SID2]: { startUnix: START } }) });
  const lem = { esemeny: 'lemondas', start_unix: START, place_id: 8439 };
  const allapotok = async () => (await env.GY_DB.prepare('SELECT allapot FROM gy_foglalas ORDER BY uuid').all()).results.map((x) => x.allapot);
  const futtat = async (foglalasok) => { const r = await igazolasVegpont({ request: zapKerelem(lem), env, deps: elo(d, foglalasok) }); return [r.status, await r.json()]; };
  // egyik sem torolt
  let [st, j] = await futtat({ [SID]: { startUnix: START }, [SID2]: { startUnix: START } });
  assert.deepEqual([st, j.valtozas, j.okkod], [200, false, 'nincs_torolt_jelolt']);
  // mindketto torolt: nem valasztunk
  [st, j] = await futtat({ [SID]: { startUnix: START, torolve: true }, [SID2]: { startUnix: START, torolve: true } });
  assert.deepEqual([j.valtozas, j.okkod], [false, 'tobb_torolt_jelolt']);
  // az egyik jelolt oldala nem ellenorizheto (404 a Salonicbol): semmi nem valtozik
  [st, j] = await futtat({ [SID]: { startUnix: START, torolve: true } });
  assert.deepEqual([j.valtozas, j.okkod], [false, 'ellenorzes_hiba']);
  assert.deepEqual(await allapotok(), ['aktiv', 'aktiv']);
  // pontosan egy bizonyitottan torolt: csak az mondodik le, ismetlesre nincs ujabb valtozas
  [st, j] = await futtat({ [SID]: { startUnix: START, torolve: true }, [SID2]: { startUnix: START } });
  assert.deepEqual([st, j.valtozas, j.allapot], [200, true, 'lemondott']);
  assert.deepEqual(await allapotok(), ['lemondott', 'aktiv']);
  [st, j] = await futtat({ [SID]: { startUnix: START, torolve: true }, [SID2]: { startUnix: START } });
  assert.equal(j.valtozas, false);
  // ervenytelen: sem bookingId, sem ervenyes hely / idopont
  assert.equal((await igazolasVegpont({ request: zapKerelem({ esemeny: 'lemondas', place_id: 8439 }), env, deps: d })).status, 400);
  assert.equal((await igazolasVegpont({ request: zapKerelem({ esemeny: 'igazolas', start_unix: START, place_id: 8439 }), env, deps: d })).status, 400);
});

test('Zap kulcs-rotacio: GY_ZAP_KULCS_HASH mellett GY_ZAP_KULCS_HASH_2 is ervenyes; hamis kulcs 401', async () => {
  const env = await ujKornyezet();
  env.GY_ZAP_KULCS_HASH_2 = await sha256Hex('uj-zap-kulcs');
  const d = deps();
  const be = { esemeny: 'igazolas', salonic_id: SID, start_unix: START, place_id: 8439 };
  assert.notEqual((await igazolasVegpont({ request: zapKerelem(be, 'uj-zap-kulcs'), env, deps: d })).status, 401);
  // VEGLEGESITETT csere (2026-10-19): ha a _2 be van allitva, a REGI hash-t a Zap-vegpont nem olvassa
  assert.equal((await igazolasVegpont({ request: zapKerelem(be, ZAP), env, deps: d })).status, 401);
  assert.equal((await igazolasVegpont({ request: zapKerelem(be, 'hamis'), env, deps: d })).status, 401);
  // vesz-visszaallitas: GY_ZAP_REGI_KULCS = "1" a regi hash-t is ervenyesiti
  env.GY_ZAP_REGI_KULCS = '1';
  assert.notEqual((await igazolasVegpont({ request: zapKerelem(be, ZAP), env, deps: d })).status, 401);
  delete env.GY_ZAP_REGI_KULCS;
  // az admin / kampany-vegpontok kulcsa (GY_ADMIN_KULCS_HASH) ettol fuggetlen
  assert.notEqual((await kampanyokVegpont({ request: kerelem('/api/gy-kampanyok', { kampanyok: [] }, { fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).status, 401);
  delete env.GY_ZAP_KULCS_HASH_2; // _2 nelkul a regi hash marad az egyetlen (visszafele kompatibilis)
  assert.equal((await igazolasVegpont({ request: zapKerelem(be, 'uj-zap-kulcs'), env, deps: d })).status, 401);
  assert.notEqual((await igazolasVegpont({ request: zapKerelem(be, ZAP), env, deps: d })).status, 401);
});

test('ugyanaz a kattintas (azonos gclid) UTM nelkul, belso navigacio: az eredeti kampany megmarad, nincs uj erintes; mas gclid = uj erintes; param_nevek csak nevek', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&utm_term=119331641405&utm_content=787722148962&gclid=ABCDEFGH12345&gad_source=1`);
  const sut = sutikBol(r);
  const lpt = sut.split('; ').find((c) => c.startsWith('gy_lpt=')), gys = sut.split('; ').find((c) => c.startsWith('gy_s='));
  // belso link: ugyanaz a gclid, UTM nelkul, sajat referrer
  await ping(env, 120000, '?gclid=ABCDEFGH12345', `${lpt}; ${gys}; ${HJ_IGEN}`, 'https://www.gyogytornaszom.hu/elso-cikk/');
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_erintes').first()).n, 1);
  const b = JSON.parse((await env.GY_DB.prepare("SELECT belepes FROM gy_munkamenet WHERE fajta = 'l'").first()).belepes);
  assert.deepEqual([b.utm_campaign, b.utm_term, b.param_nevek.join(',')], [DSA, '119331641405', 'gad_source,gclid,utm_campaign,utm_content,utm_medium,utm_source,utm_term']);
  const j = await foglal(env, 600000, `${lpt}; ${gys}; ${HJ_IGEN}`, 'mb_lpch0000000000001');
  assert.equal(j.ok, true);
  const sor = await env.GY_DB.prepare('SELECT cimke, kampany, hirdetescsoport, lpc_cimke, lpc_kampany FROM gy_foglalas WHERE uuid = ?').bind('mb_lpch0000000000001').first();
  assert.deepEqual({ ...sor }, { cimke: 'google_nem_markas', kampany: DSA, hirdetescsoport: '119331641405', lpc_cimke: 'google_nem_markas', lpc_kampany: DSA });
  // MASIK gclid UTM nelkul = uj kattintas (a regit nem orokli): kampany nelkuli erintes
  await ping(env, 900000, '?gclid=ZZZZZZZZ99999', `${lpt}; ${gys}; ${HJ_IGEN}`);
  assert.equal((await env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_erintes').first()).n, 2);
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?lpc=2026-10', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() })).json();
  assert.deepEqual(rap.kampany_nelkuli_fizetett.map((x) => [x.param_nevek, x.db]), [['["gclid"]', 1]]);
  assert.equal(JSON.stringify(rap).includes('ZZZZZZZZ99999'), false); // a click-ID ertek nem lathato
});

test('igazolas: ha az elo bookingDetails oldal egyertelmuen hordozza a munkatars-azonositot, az szukit (nev nelkul); ketertelmu / nincs: 409', async () => {
  const env = await ujKornyezet();
  const d = await ketFoglalas(env);
  const be = { esemeny: 'igazolas', salonic_id: SID, start_unix: START, place_id: 8439 };
  const r = await igazolasVegpont({ request: zapKerelem(be), env, deps: elo(d, { [SID]: { startUnix: START, emp: '18783' } }) });
  assert.deepEqual([r.status, (await r.json()).igazolt], [200, true]);
  const sorok = (await env.GY_DB.prepare('SELECT uuid, salonic_id FROM gy_foglalas ORDER BY uuid').all()).results;
  assert.deepEqual(sorok.map((x) => [x.uuid, x.salonic_id]), [['mb_ketfoglalas000001', null], ['mb_ketfoglalas000002', SID]]); // a 18783-as munkatars foglalasa
  // oldal munkatars-azonosito nelkul: 409, a diagnosztika a riasztasban (oldal_emp=0)
  const env2 = await ujKornyezet();
  const d2 = await ketFoglalas(env2);
  const r2 = await igazolasVegpont({ request: zapKerelem(be), env: env2, deps: elo(d2, { [SID]: { startUnix: START } }) });
  assert.equal(r2.status, 409);
  assert.match((await env2.GY_DB.prepare("SELECT adat FROM gy_riasztas WHERE tipus = 'igazolas_tobb_par'").first()).adat, /oldal_emp=0/);
});

test('gad_campaignid: tartalek kampany-ID csak ha az utm_campaign nincs; brand / nem brand csak pontos listaegyezessel, kulonben bizonytalan; fbclid onmagaban = social_meta', () => {
  const q = (x) => belepes({ search: x });
  // gad_campaignid + click-ID, utm_campaign nelkul
  const a = q(`?gclid=ABCDEFGH12345&gad_source=1&gad_campaignid=${BRAND}`);
  assert.equal(a.utm_campaign, BRAND);
  assert.deepEqual([cimkez(a, { lista: LISTA }).cimke, cimkez(a, { lista: LISTA }).bizonyitek], ['google_brand', 'gad_campaignid']);
  assert.deepEqual([cimkez(q(`?gbraid=ABCDEFGH12345&gad_campaignid=${DSA}`), { lista: LISTA }).cimke], ['google_nem_brand']);
  // ismeretlen szamjegyes ID: google_bizonytalan (nem kitalalt brand)
  const b = q('?gclid=ABCDEFGH12345&gad_campaignid=99887766554');
  assert.deepEqual([cimkez(b, { lista: LISTA }).cimke, cimkez(b, { lista: LISTA }).bizonyitek], ['google_bizonytalan', 'ismeretlen_kampany']);
  // nem szamjegyes gad_campaignid: nem kampany
  assert.equal(q('?gclid=ABCDEFGH12345&gad_campaignid=abc').utm_campaign, null);
  // ha az utm_campaign megvan, a gad_campaignid NEM irja felul (akkor sem, ha mas)
  assert.equal(q(`?utm_campaign=${DSA}&gclid=ABCDEFGH12345&gad_campaignid=${BRAND}`).utm_campaign, DSA);
  // fbclid onmagaban: social_meta, nem organikus, nem Google; ha Google-jel is van, az nyer
  const f = q('?fbclid=ABCDEFGH12345');
  assert.deepEqual([cimkez(f, { lista: LISTA }).cimke, cimkez(f, { lista: LISTA }).bizonyitek], ['ismeretlen', 'nem_google_fizetett']);
  const ef = erintesAdatok(f, { lista: LISTA });
  assert.deepEqual([ef.platform, ef.cimke, ef.bizonyitek, ef.katt_tipus, ef.katt_ertek], ['meta', 'meta', 'fbclid_utm_nelkul', 'fbclid', 'ABCDEFGH12345']); // GY-25: uj szokincs
  const et = erintesAdatok(q('?ttclid=ABCDEFGH12345&utm_source=tiktok&utm_medium=paid'), { lista: LISTA });
  assert.deepEqual([et.platform, et.cimke], ['tiktok', 'tiktok']);
  assert.equal(cimkez(q(`?fbclid=ABCDEFGH12345&gclid=ABCDEFGH12345&utm_campaign=${BRAND}`), { lista: LISTA }).cimke, 'google_brand');
});

// --- GY-23: szerveres Google Ads import - click-ID a foglalashoz + admin lista -------------------------------------------------------------------------------
import { budapestIdo } from '../lib/motor-szerver.js';
const GADS = (env, q = '') => adminVegpont({ request: kerelem('/api/gy-admin?gads=1' + q, null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() }).then((r) => r.json());
async function gadsFoglalas(env, { search, ms = 0, uuid, cookie = HJ_IGEN }) {
  const r = await ping(env, ms, search, cookie);
  const c = `${sutikBol(r)}; ${HJ_IGEN}`;
  const j = await foglal(env, ms + 600000, c, uuid);
  assert.equal(j.ok, true);
  return c;
}

test('budapestIdo: Google Ads import formatum, nyari / teli eltolas', () => {
  assert.equal(budapestIdo(Date.UTC(2026, 9, 14, 10, 0, 0) / 1000), '2026-10-14 12:00:00+02:00'); // nyari ido
  assert.equal(budapestIdo(Date.UTC(2026, 11, 14, 10, 0, 0) / 1000), '2026-12-14 11:00:00+01:00'); // teli ido
  assert.equal(budapestIdo(null), null);
});

test('GY-23: a 7 napos last paid click Google click-ID-ja a foglalashoz kerul (tipus + kattintas ideje + munkamenet + szabalyverzio); az admin lista CSAK igazolt, teszt nelkuli, Google-forrasu allapotfelmeres', async () => {
  const env = await lpcKornyezet();
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gbraid=GBRAIDTESZT12345`, uuid: 'mb_gads00000000000001' });
  let l = await GADS(env);
  assert.equal(l.db, 0); // meg nincs Salonic-igazolas -> nem kerul a listara
  const sor = await env.GY_DB.prepare('SELECT gads_katt_tipus, gads_katt_ertek, gads_katt_ido, gads_szabaly, ertek FROM gy_foglalas').first();
  assert.deepEqual([sor.gads_katt_tipus, sor.gads_katt_ertek, sor.gads_katt_ido, sor.gads_szabaly, sor.ertek], ['gbraid', 'GBRAIDTESZT12345', Math.floor(MOST / 1000), 'gads1+lpc1', 23500]);
  // Salonic-igazolas utan a listara kerul
  const be = { esemeny: 'igazolas', salonic_id: SID, start_unix: START, place_id: 8439 };
  const ig = await igazolasVegpont({ request: zapKerelem(be), env, deps: elo(deps(), { [SID]: { startUnix: START } }) });
  assert.equal((await ig.json()).igazolt, true);
  l = await GADS(env);
  assert.equal(l.db, 1);
  const x = l.aktiv[0];
  assert.deepEqual([x.click_id, x.click_tipus, x.ertek, x.penznem, x.allapot], ['GBRAIDTESZT12345', 'gbraid', 23500, 'HUF', 'aktiv']);
  assert.match(x.konverzio_ido, /^2026-10-14 \d\d:\d\d:\d\d\+02:00$/);
  assert.match(x.click_ido, /^2026-10-14 \d\d:\d\d:\d\d\+02:00$/);
  assert.equal(x.order_id, await tranzakcioId('mb_gads00000000000001', KULCS)); // ugyanaz, mint a dataLayer tranzakcio_id (deduplikalashoz)
  assert.equal(x.forras.szabaly, 'gads1+lpc1');
  assert.equal(x.forras.munkamenet, undefined); // GY-25 review: a latogato-hash nem megy ki az exportban
  const mind = JSON.stringify(l);
  for (const tilos of ['nev', 'email', 'telefon', 'kezeles', 'salonic_id', SID, 'mb_gads']) assert.equal(mind.includes(tilos), false, tilos);
  // lemondas: a lista lemondott agaban jelenik meg (kesobbi kiigazitashoz)
  await igazolasVegpont({ request: zapKerelem({ esemeny: 'lemondas', salonic_id: SID }), env, deps: elo(deps(), { [SID]: { startUnix: START, torolve: true } }) });
  l = await GADS(env);
  assert.deepEqual([l.aktiv.length, l.lemondott.length, l.lemondott[0].allapot], [0, 1, 'lemondott']);
  assert.match(l.lemondott[0].lemondva_ido, /^2026-10-14 /);
});

test('GY-23: hozzajarulas nelkul / nem Google erintes / organikus nincs click-ID; 60 nap utan a click-ID torlodik; teszt foglalas nincs a listan', async () => {
  const env = await lpcKornyezet();
  const NEM = `gy_suti=v1-s0-m0-t${ts()}`;
  // hozzajarulas nelkul: nincs mentes
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ABCDEFGH12345`, uuid: 'mb_gads00000000000002', cookie: NEM });
  assert.equal((await env.GY_DB.prepare("SELECT gads_katt_ertek AS k FROM gy_foglalas WHERE uuid = 'mb_gads00000000000002'").first()).k, null);
  // organikus / direkt visszateres (nincs 7 napos fizetett): nincs click-ID
  const env2 = await lpcKornyezet();
  await foglal(env2, 5000, HJ_IGEN, 'mb_gads00000000000003');
  assert.equal((await env2.GY_DB.prepare("SELECT gads_katt_ertek AS k FROM gy_foglalas WHERE uuid = 'mb_gads00000000000003'").first()).k, null);
  // 60 nap utan torles (a foglalas-rekord marad, a click-ID nem)
  const env3 = await lpcKornyezet();
  await gadsFoglalas(env3, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${BRAND}&gclid=ABCDEFGH12345`, uuid: 'mb_gads00000000000004' });
  assert.equal((await env3.GY_DB.prepare('SELECT gads_katt_ertek AS k FROM gy_foglalas').first()).k, 'ABCDEFGH12345');
  await takaritTeszt(env3, MOST / 1000 + 61 * 86400);
  const t = await env3.GY_DB.prepare('SELECT gads_katt_ertek AS k, gads_katt_tipus AS t, cimke FROM gy_foglalas').first();
  assert.deepEqual([t.k, t.t, t.cimke], [null, null, 'google_markas']);
});

// --- GY-24: lepesenkenti tolcsermeres (gy_motor_stat) ----------------------------------------------------------------------------------------------------------
import { motorStatVegpont, statKornyezet } from '../lib/motor-szerver.js';
const mstat = (env, body, origin = 'https://www.gyogytornaszom.hu') => motorStatVegpont({ request: new Request(BASE + '/api/gy-motor-stat', { method: 'POST', headers: origin ? { origin } : {}, body: typeof body === 'string' ? body : JSON.stringify(body) }), env, deps: { most: () => MOST } });
const mrows = async (env) => (await env.GY_DB.prepare('SELECT kornyezet, esemeny, lepes, kategoria, eszkoz, db FROM gy_motor_stat ORDER BY kornyezet, esemeny, lepes, kategoria, eszkoz').all()).results.map((x) => ({ ...x }));

test('GY-24 statKornyezet: Origin / Referer alapjan eles | elonezet | teszt', () => {
  const r = (h) => new Request(BASE + '/x', { method: 'POST', headers: h });
  assert.equal(statKornyezet(r({ origin: 'https://www.gyogytornaszom.hu' })), 'eles');
  assert.equal(statKornyezet(r({ origin: 'https://gyogytornaszom.hu' })), 'eles');
  assert.equal(statKornyezet(r({ referer: 'https://www.gyogytornaszom.hu/online-gyogytorna/' })), 'eles');
  assert.equal(statKornyezet(r({ origin: 'https://claude-ajandek-motor-vd7aof.gyogytorna.pages.dev' })), 'elonezet');
  assert.equal(statKornyezet(r({ origin: 'https://gyogytorna.pages.dev' })), 'elonezet');
  assert.equal(statKornyezet(r({ origin: 'https://evil.example/www.gyogytornaszom.hu' })), 'teszt');
  assert.equal(statKornyezet(r({ origin: 'http://127.0.0.1:8080' })), 'teszt');
  assert.equal(statKornyezet(r({})), 'teszt');
});

test('GY-24 /api/gy-motor-stat: csak fix esemeny / lepes / kategoria, a `kesz` kliensrol nem hamisithato, nincs szabad szoveg; eszkoz; kornyezet Origin szerint', async () => {
  const env = await ujKornyezet();
  assert.equal((await mstat(env, { e: 'nyit', m: 1 })).status, 204);
  assert.equal((await mstat(env, { e: 'lepes', l: 'ido', m: 0 })).status, 204);
  assert.equal((await mstat(env, { e: 'elakad', l: 'hivas', k: 'kotelezo_hianyzik', m: 1 })).status, 204);
  assert.equal((await mstat(env, { e: 'elakad', l: 'hivas', k: 'Kiss Pista panasza: derekfajas', m: 1 })).status, 204); // szabad szoveg -> 'egyeb'
  assert.equal((await mstat(env, { e: 'lepes', l: 'Kiss Pista', m: 0 })).status, 204); // ismeretlen lepes -> 'egyeb'
  assert.equal((await mstat(env, { e: 'kesz', l: 'adatlap', m: 0 })).status, 400); // a kesz csak szerveroldalon
  assert.equal((await mstat(env, { e: 'valami' })).status, 400);
  assert.equal((await mstat(env, 'nem json')).status, 400);
  assert.equal((await mstat(env, { e: 'nyit' }, 'https://claude-x.gyogytorna.pages.dev')).status, 204);
  assert.equal((await mstat(env, { e: 'bezar_gomb', l: 'szakember', m: 1 }, null)).status, 204);
  assert.equal((await motorStatVegpont({ request: new Request(BASE + '/api/gy-motor-stat', { method: 'GET' }), env })).status, 405);
  const sorok = await mrows(env);
  assert.deepEqual(sorok.map((x) => [x.kornyezet, x.esemeny, x.lepes, x.kategoria, x.eszkoz, x.db]).sort(), [
    ['elonezet', 'nyit', '', '', 'ismeretlen', 1], ['eles', 'elakad', 'hivas', 'egyeb', 'mobil', 1], ['eles', 'elakad', 'hivas', 'kotelezo_hianyzik', 'mobil', 1],
    ['eles', 'lepes', 'egyeb', '', 'asztali', 1], ['eles', 'lepes', 'ido', '', 'asztali', 1], ['eles', 'nyit', '', '', 'mobil', 1], ['teszt', 'bezar_gomb', 'szakember', '', 'mobil', 1],
  ].sort());
  assert.equal(JSON.stringify(sorok).match(/Kiss|derekfajas/i), null);
});

test('GY-24 kesz: szerveroldalon, csak tenyleges ELSO mentes utan (ismetles nem szamol ketszer); teszt foglalas = teszt kornyezet; visszahivas kesz lepes=hivas', async () => {
  const env = await ujKornyezet();
  const d = deps();
  const kuld = (uuid, felul = {}) => foglalasVegpont({ request: new Request(BASE + '/api/gy-foglalas', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ ...foglalasBody(), uuid, m: 1, ...felul }) }), env, deps: d });
  // BASE (a teszt-eredet) nem eles: teszt kornyezet
  assert.equal((await kuld('mb_tolcser000000001')).status, 200);
  assert.equal((await kuld('mb_tolcser000000001')).status, 200); // ismetles / dupla kuldes
  let k = (await mrows(env)).filter((x) => x.esemeny === 'kesz');
  assert.deepEqual(k.map((x) => [x.kornyezet, x.lepes, x.eszkoz, x.db]), [['teszt', 'adatlap', 'mobil', 1]]);
  // eles Origin-bol: eles kornyezet (GY_ORIGINS engedi)
  env.GY_ORIGINS = 'https://www.gyogytornaszom.hu';
  const r = await foglalasVegpont({ request: new Request(BASE + '/api/gy-foglalas', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://www.gyogytornaszom.hu' }, body: JSON.stringify({ ...foglalasBody(), uuid: 'mb_tolcser000000002' }) }), env, deps: d });
  assert.equal(r.status, 200);
  k = (await mrows(env)).filter((x) => x.esemeny === 'kesz' && x.kornyezet === 'eles');
  assert.deepEqual(k.map((x) => [x.lepes, x.eszkoz, x.db]), [['adatlap', 'ismeretlen', 1]]);
  // visszahivas
  const vh = await visszahivasVegpont({ request: kerelem('/api/gy-visszahivas', { m: 0, nev: 'Proba Teszt', email: 'p@example.com', tel: '036 30 555 0199', rendelo: 'Oktogon', surgosseg: 'A lehető leggyorsabban!', hivhato: 'Bármikor', panasz: 'derekfajas', elfogad_info: true, elfogad_adatv: true, oldal: '/x/' }), env, deps: d });
  assert.equal(vh.status, 200);
  const hk = (await mrows(env)).filter((x) => x.esemeny === 'kesz' && x.lepes === 'hivas');
  assert.deepEqual(hk.map((x) => [x.kornyezet, x.eszkoz, x.db]), [['teszt', 'asztali', 1]]);
  assert.equal(JSON.stringify(await mrows(env)).match(/Proba|p@example|036|derekfajas/i), null);
});

test('GY-24 admin ?tolcser=YYYY-MM: lepesenkenti darabszam eszkozonkent, kozelito arany + megjegyzes; 13 honap utan torles', async () => {
  const env = await ujKornyezet();
  for (const [e, l, k, m, n] of [['nyit', '', '', 1, 4], ['lepes', 'szolg', '', 1, 4], ['lepes', 'ido', '', 1, 3], ['elakad', 'ido', 'nincs_szabad_ido', 1, 1], ['bezar_gomb', 'ido', '', 1, 1], ['elhagy_jelzes', 'szolg', '', 0, 1]]) for (let i = 0; i < n; i++) await mstat(env, { e, l, k, m });
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?tolcser=2026-10', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() })).json();
  assert.equal(rap.ok, true);
  assert.deepEqual([rap.kornyezet, rap.nyit], ['eles', 4]);
  const ido = rap.lepesek.find((x) => x.lepes === 'ido');
  assert.deepEqual([ido.megjelent, ido.elakad, ido.bezar_gomb, ido.eszkozonkent.mobil.megjelent], [3, 1, 1, 3]);
  assert.equal(rap.lepesek.find((x) => x.lepes === 'szolg').elhagy_jelzes_becsles, 1);
  assert.equal(rap.elakadasok['ido|nincs_szabad_ido'], 1);
  assert.equal(rap.kozelito_arany.lepes_per_nyit_szazalek.ido, 75);
  assert.match(rap.megjegyzes, /KOZELITO/);
  assert.match(rap.megjegyzes, /BECSLES/);
  // masik kornyezet kulon kerheto
  const el = await (await adminVegpont({ request: kerelem('/api/gy-admin?tolcser=2026-10&kornyezet=elonezet', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() })).json();
  assert.equal(el.nyit, 0);
  // megorzes: 13 honap (396 nap) utan torlodik
  await takaritTeszt(env, MOST / 1000 + 397 * 86400);
  assert.equal((await mrows(env)).length, 0);
});

// --- GY-25: ELES 7 napos utolso fizetett kattintas (Meta / TikTok / Google), bizonyitek-forras, click-ID a foglalashoz -----------------------------------------
const gySor = (env, uuid) => env.GY_DB.prepare('SELECT cimke, bizonyitek, bizonyitek_forras, lpc_platform, lpc_katt_tipus, lpc_katt_ertek, gads_katt_ertek, kesoi_fizetett, cimke_regi FROM gy_foglalas WHERE uuid = ?').bind(uuid).first();

test('GY-25: Meta kattintas -> foglalas = meta (bizonyitek-forras suti, nyers fbclid a foglalason); organikus visszateres nem ir felul; ujabb TikTok igen; 8-30 nap csak kesoi jelzes', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, '?utm_source=facebook&utm_medium=paid_social&utm_campaign=1234567&fbclid=ABCDEFGH12345678');
  const lpt = sutikBol(r);
  // organikus belso ping 2 nappal kesobb: nem naplozodik, nem ir felul
  await ping(env, 2 * NAPMP, '', `${lpt}; ${HJ_IGEN}`, 'https://www.google.com/');
  const j = await foglal(env, 3 * NAPMP, `${lpt}; ${HJ_IGEN}`, 'mb_gy25a000000000001');
  assert.equal(j.ok, true);
  const a = await gySor(env, 'mb_gy25a000000000001');
  assert.deepEqual([a.cimke, a.bizonyitek_forras, a.lpc_platform, a.lpc_katt_tipus, a.lpc_katt_ertek, a.gads_katt_ertek], ['meta', 'suti', 'meta', 'fbclid', 'ABCDEFGH12345678', null]);
  // ujabb fizetett (TikTok) nyer
  await ping(env, 4 * NAPMP, '?utm_source=tiktok&utm_medium=paid&utm_campaign=777&ttclid=TTCLID1234567890', `${lpt}; ${HJ_IGEN}`);
  await foglal(env, 5 * NAPMP, `${lpt}; ${HJ_IGEN}`, 'mb_gy25b000000000001');
  const b = await gySor(env, 'mb_gy25b000000000001');
  assert.deepEqual([b.cimke, b.lpc_platform, b.lpc_katt_tipus, b.lpc_katt_ertek], ['tiktok', 'tiktok', 'ttclid', 'TTCLID1234567890']);
  // 12 nappal a legutolso fizetett utan: nem 7 napos nyertes -> organikus_direkt + kesoi jelzes
  await foglal(env, (4 + 12) * NAPMP, `${lpt}; ${HJ_IGEN}`, 'mb_gy25c000000000001');
  const c = await gySor(env, 'mb_gy25c000000000001');
  assert.equal(c.cimke, 'organikus_direkt');
  assert.equal(c.kesoi_fizetett, 'tiktok');
  assert.equal(c.lpc_katt_ertek, null);
});

test('GY-25: hirdetesi hozzajarulas nelkul nincs click-ID sehol (naplo, munkamenet, foglalas); a cimke a hozzajarulas nelkuli tartalekbol jon', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, '?utm_source=facebook&utm_medium=paid_social&utm_campaign=1234567&fbclid=ABCDEFGH12345678', HJ_NEM);
  await foglal(env, 600, `${sutikBol(r)}; ${HJ_NEM}`, 'mb_gy25d000000000001');
  for (const t of ['gy_erintes', 'gy_munkamenet', 'gy_foglalas']) assert.equal(JSON.stringify((await env.GY_DB.prepare(`SELECT * FROM ${t}`).all()).results).includes('ABCDEFGH12345678'), false, t);
  assert.equal((await gySor(env, 'mb_gy25d000000000001')).lpc_katt_ertek, null);
});

test('GY-25 review: hozzajarulas visszavonasakor a foglalason tarolt nyers click-ID is torlodik; a ?foglalas= nem adja ki a nyers erteket', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, '?utm_source=facebook&utm_medium=paid_social&utm_campaign=1234567&fbclid=ABCDEFGH12345678');
  const lpt = sutikBol(r);
  await foglal(env, 600, `${lpt}; ${HJ_IGEN}`, 'mb_gy25e000000000001');
  assert.equal((await gySor(env, 'mb_gy25e000000000001')).lpc_katt_ertek, 'ABCDEFGH12345678');
  const f = await (await adminVegpont({ request: kerelem('/api/gy-admin?foglalas=mb_gy25e000000000001', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() })).json();
  assert.equal(JSON.stringify(f).includes('ABCDEFGH12345678'), false);
  await ping(env, 1200, '', `${lpt}; ${HJ_NEM}`); // visszavonas
  assert.equal((await gySor(env, 'mb_gy25e000000000001')).lpc_katt_ertek, null);
});

test('GY-25: ?megtalalt= riport: platform / kampany / hirdetes, db, atlag nap; csak a >= 1 napos visszatero; nincs click-ID', async () => {
  const env = await lpcKornyezet();
  const r = await ping(env, 0, '?utm_source=facebook&utm_medium=paid_social&utm_campaign=1234567&fbclid=ABCDEFGH12345678');
  await foglal(env, 3 * NAPMP, `${sutikBol(r)}; ${HJ_IGEN}`, 'mb_gy25f000000000001');
  const ho = new Date(MOST).toISOString().slice(0, 7);
  const rap = await (await adminVegpont({ request: kerelem(`/api/gy-admin?megtalalt=${ho}`, null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() })).json();
  assert.equal(rap.ok, true);
  assert.deepEqual(rap.sorok.map((x) => [x.platform, x.kampany, x.db, x.atlag_nap]), [['meta', '1234567', 1, 3]]);
  assert.equal(JSON.stringify(rap).includes('ABCDEFGH'), false);
});

// --- GY-25: szerveres Google Ads feltoltes DRY-RUN naplo ---------------------------------------------------------------------------------------------------------
import { gfeltoltesFut, gfeltoltesPayload, gfeltoltesKeres, ujraprobaDontes, GFELT, maszk } from '../lib/gfeltoltes.js';
import { sema } from '../lib/db.js';
test('GY-25 feltoltes: payload csak a megengedett mezokkel, consent nelkul; maszk; dry-run naplo idempotens, csak igazolt Google allapotfelmeres', async () => {
  const p = gfeltoltesPayload({ kattTipus: 'gbraid', kattErtek: 'ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789', konverzioIdo: '2026-10-20 10:00:00+02:00', orderId: 'x'.repeat(64) });
  assert.deepEqual(Object.keys(p).sort(), ['conversionAction', 'conversionDateTime', 'conversionValue', 'currencyCode', 'gbraid', 'orderId']);
  assert.equal(p.conversionAction, 'customers/2596120588/conversionActions/7858300772');
  assert.equal(p.conversionValue, 19000);
  assert.equal(JSON.stringify(p).includes('consent'), false);
  assert.equal(gfeltoltesPayload({ kattTipus: 'fbclid', kattErtek: 'ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789' }), null);
  assert.equal(maszk('ABCDEFGH12345'), '*** (13)'); assert.equal(maszk('A'.repeat(24)), 'AAAA…AAA (24)');

  const env = await lpcKornyezet();
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789`, uuid: 'mb_gfel0000000000001' });
  const letre = unixMost + 600; // a gadsFoglalas a kattintas utan 10 perccel foglal
  const futas = (mikor = letre + GFELT.kesleltetes) => gfeltoltesFut({ db: env.GY_DB, env, most: mikor, budapestIdo });
  assert.deepEqual(await futas(), { mod: 'dry', uj: 0 }); // meg nincs Salonic-igazolas
  await env.GY_DB.prepare("UPDATE gy_foglalas SET igazolt = 1 WHERE uuid = 'mb_gfel0000000000001'").run();
  assert.deepEqual(await futas(letre + GFELT.kesleltetes - 1), { mod: 'dry', uj: 0 }); // 1 oraja meg nem telt le: nem naplozodik
  assert.deepEqual(await futas(), { mod: 'dry', uj: 1 });
  assert.deepEqual(await futas(), { mod: 'dry', uj: 0 }); // idempotens
  const sor = await env.GY_DB.prepare('SELECT * FROM gy_feltoltes').first();
  assert.deepEqual([sor.mod, sor.allapot, sor.katt_tipus, sor.katt_maszk, sor.ertek, sor.consent, sor.hiba], ['dry', 'dry', 'gclid', maszk('ABCDEFGH12345'+'abcdefghijklmnopqrstuvwxyz0123456789'), 19000, 'nem_ismert', null]);
  assert.equal(JSON.stringify(sor).includes('ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789'), false);
  assert.match(sor.order_id, /^[0-9a-f]{64}$/);
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?gfeltoltes=1', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: deps() })).json();
  assert.equal(rap.ok, true);
  assert.equal(JSON.stringify(rap).includes('ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789'), false);
  assert.equal(JSON.stringify(rap).includes('mb_gfel'), false);
  // ki mod: semmi; eles mod: a sor `varakozik` allapotba kerul (halozati hivas a naplo-futasbol nincs)
  const kesobb = letre + GFELT.kesleltetes;
  assert.deepEqual(await gfeltoltesFut({ db: env.GY_DB, env: { ...env, GY_GADS_FELTOLTES: 'ki' }, most: kesobb, budapestIdo }), { mod: 'ki', uj: 0 });
  assert.deepEqual(await gfeltoltesFut({ db: env.GY_DB, env: { ...env, GY_GADS_FELTOLTES: 'eles' }, most: kesobb, budapestIdo }), { mod: 'eles', uj: 1 });
  assert.equal((await env.GY_DB.prepare("SELECT allapot FROM gy_feltoltes WHERE mod = 'eles'").first()).allapot, 'varakozik');
  // lemondott foglalas nem kerul be
  await env.GY_DB.prepare("UPDATE gy_foglalas SET allapot = 'lemondott'").run();
  await env.GY_DB.prepare('DELETE FROM gy_feltoltes').run();
  assert.deepEqual(await futas(), { mod: 'dry', uj: 0 });
});

// --- GY-25 kiegeszites (2026-10-21 11:40) ------------------------------------------------------------------------------------------------------------------------
test('GY-25 kiegeszites: csak gbraid/wbraid = kihagyva_braid (dry es eles mod is); a kattintas KESOBBI, mint a foglalas = kihagyva_ido_sorrend; a naplo mezoi; nincs teljes click-ID / consent', async () => {
  const env = await lpcKornyezet();
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gbraid=GBRAIDABCD123456789012345`, uuid: 'mb_gbr00000000000001' });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&wbraid=WBRAIDABCD123456789012345`, uuid: 'mb_gbr00000000000002', ms: 2000000 });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789`, uuid: 'mb_gbr00000000000003', ms: 4000000 });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${BRAND}&gclid=ZZZZZZZZ99999abcdefghijklmnopqrstuvwxyz0123456789`, uuid: 'mb_gbr00000000000004', ms: 6000000 });
  await env.GY_DB.prepare('UPDATE gy_foglalas SET igazolt = 1').run();
  // a 4. foglalas kattintasa KESOBBI a foglalasnal (hibas ido): nem kuldheto
  await env.GY_DB.prepare("UPDATE gy_foglalas SET gads_katt_ido = letrehozva + 100 WHERE uuid = 'mb_gbr00000000000004'").run();
  const mikor = Math.floor(MOST / 1000) + 6000 + 600 + GFELT.kesleltetes;
  assert.deepEqual(await gfeltoltesFut({ db: env.GY_DB, env, most: mikor, budapestIdo }), { mod: 'dry', uj: 4 });
  const sorok = (await env.GY_DB.prepare('SELECT allapot, katt_tipus, katt_ido, katt_maszk, konverzio_ido, consent, ujraprobalas, google_hibakod, request_id, utolso_hiba_ido, kovetkezo_proba FROM gy_feltoltes ORDER BY id').all()).results;
  assert.deepEqual(sorok.map((x) => [x.allapot, x.katt_tipus]), [['kihagyva_braid', 'gbraid'], ['kihagyva_braid', 'wbraid'], ['dry', 'gclid'], ['kihagyva_ido_sorrend', 'gclid']]);
  assert.equal(sorok[2].katt_ido, Math.floor(MOST / 1000) + 4000);
  assert.match(sorok[2].konverzio_ido, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\+0[12]:00$/);
  assert.deepEqual([sorok[2].ujraprobalas, sorok[2].google_hibakod, sorok[2].request_id, sorok[2].utolso_hiba_ido, sorok[2].kovetkezo_proba], [0, null, null, null, null]);
  assert.equal(JSON.stringify(sorok).includes('GBRAIDABCD123456789012345') || JSON.stringify(sorok).includes('ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789'), false);
  // eles mod: a braid akkor sem megy ki (nincs kuldo es nincs dontes) - allapot kihagyva_braid
  assert.deepEqual(await gfeltoltesFut({ db: env.GY_DB, env: { ...env, GY_GADS_FELTOLTES: 'eles' }, most: mikor, budapestIdo }), { mod: 'eles', uj: 4 });
  assert.deepEqual((await env.GY_DB.prepare("SELECT allapot FROM gy_feltoltes WHERE mod = 'eles' ORDER BY id").all()).results.map((x) => x.allapot), ['kihagyva_braid', 'kihagyva_braid', 'varakozik', 'kihagyva_ido_sorrend']);
});

test('GY-25 kiegeszites: ujraproba-szabaly (atmeneti hiba backoff-fal max 5x, vegleges hiba / 90 napnal regebbi click-ID nincs ujra), ELES keres partial_failure=true, validate_only nincs', () => {
  const most = 1000000;
  assert.deepEqual(GFELT.ujraproba.varakozas, [3600, 10800, 21600, 43200, 86400]);
  assert.equal(GFELT.ujraproba.max, 5);
  // atmeneti: HTTP 429 / 5xx / halozati hiba / CLICK_NOT_FOUND / TOO_RECENT_EVENT -> kovetkezo proba a backoff szerint
  for (const x of [{ http: 429 }, { http: 503 }, { http: null }, { kod: 'CLICK_NOT_FOUND' }, { kod: 'TOO_RECENT_EVENT' }, { kod: 'INTERNAL_ERROR' }]) {
    assert.deepEqual(ujraprobaDontes({ ...x, proba: 0, most }), { allapot: 'hiba', kovetkezo: most + 3600, ok: 'ujraproba' }, JSON.stringify(x));
  }
  assert.equal(ujraprobaDontes({ http: 500, proba: 3, most }).kovetkezo, most + 43200);
  assert.equal(ujraprobaDontes({ http: 500, proba: 4, most }).kovetkezo, most + 86400);
  assert.deepEqual(ujraprobaDontes({ http: 500, proba: 5, most }), { allapot: 'hiba', kovetkezo: null, ok: 'ujraproba_kimerult' }); // legfeljebb 5 ujraproba
  // vegleges: ervenytelen / lejart click-ID, rossz sorrend, braid-tiltas, 4xx -> soha nincs ujra
  for (const x of [{ kod: 'UNPARSEABLE_GCLID' }, { kod: 'EXPIRED_EVENT' }, { kod: 'CONVERSION_PRECEDES_EVENT' }, { kod: 'ONE_PER_CLICK_CONVERSION_ACTION_NOT_PERMITTED_WITH_BRAID' }, { http: 400 }, { http: 403, kod: 'USER_PERMISSION_DENIED' }]) {
    assert.deepEqual(ujraprobaDontes({ ...x, proba: 0, most }), { allapot: 'hiba', kovetkezo: null, ok: 'vegleges' }, JSON.stringify(x));
  }
  assert.equal(ujraprobaDontes({ kod: 'CLICK_CONVERSION_ALREADY_EXISTS', most }).allapot, 'elfogadva'); // ugyanaz a konverzio mar bent van
  assert.equal(ujraprobaDontes({ kod: 'ORDER_ID_ALREADY_IN_USE', most }).allapot, 'elfogadva');
  assert.equal(ujraprobaDontes({ kod: 'DUPLICATE_ORDER_ID', most }).ok, 'vegleges'); // kereson belüli duplikatum: nem 'mar bent van'
  const k = gfeltoltesKeres([{ gclid: 'X' }]);
  assert.deepEqual(k, { conversions: [{ gclid: 'X' }], partialFailure: true, validateOnly: false });
});

test('GY-25 kiegeszites: lefedettseg-riport (?gfeltoltes=1): naponta a Google-forrasu igazolt allapotfelmeresek, ebbol gclid / csak braid / nincs click-ID; organikus, teszt, lemondott nincs benne', async () => {
  const env = await lpcKornyezet();
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789`, uuid: 'mb_lef00000000000001' });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gbraid=GBRAIDABCD123456789012345`, uuid: 'mb_lef00000000000002', ms: 2000000 });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ZZZZZZZZ99999abcdefghijklmnopqrstuvwxyz0123456789`, uuid: 'mb_lef00000000000003', ms: 4000000 });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=YYYYYYYY88888abcdefghijklmnopqrstuvwxyz0123456789`, uuid: 'mb_lef00000000000004', ms: 6000000 });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=QQQQQQQQ77777abcdefghijklmnopqrstuvwxyz0123456789`, uuid: 'mb_lef00000000000005', ms: 8000000 });
  await env.GY_DB.prepare('UPDATE gy_foglalas SET igazolt = 1').run();
  await env.GY_DB.prepare("UPDATE gy_foglalas SET gads_katt_ertek = NULL, gads_katt_tipus = NULL WHERE uuid = 'mb_lef00000000000003'").run(); // Google-forras, de nincs click-ID
  await env.GY_DB.prepare("UPDATE gy_foglalas SET cimke = 'organikus_direkt', gads_katt_ertek = NULL WHERE uuid = 'mb_lef00000000000004'").run(); // nem Google
  await env.GY_DB.prepare("UPDATE gy_foglalas SET allapot = 'lemondott' WHERE uuid = 'mb_lef00000000000005'").run();
  const d = deps(); d.most = () => MOST + 4 * 86400000;
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?gfeltoltes=1', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  assert.deepEqual(rap.lefedettseg.osszes, { google_igazolt_allapotfelmeres: 3, gclid: 1, gyanus_click_id: 0, csak_braid: 1, nincs_click_id: 1 });
  assert.equal(rap.lefedettseg.naponta.length, 1);
  assert.equal(rap.lefedettseg.naponta[0].nap, '2026-10-14');
  assert.equal(JSON.stringify(rap).includes('ABCDEFGH12345abcdefghijklmnopqrstuvwxyz0123456789') || JSON.stringify(rap).includes('GBRAIDABCD123456789012345') || JSON.stringify(rap).includes('mb_lef'), false);
});

test('GY-25 kiegeszites: a regi naplo allapot-nevei atnevezodnek (kesz -> dry, hibas_click_id -> kihagyva_click_id, eles_nincs_bekotve -> kihagyva_nincs_kuldo), a bovitett oszlopok megvannak', async () => {
  const env = await ujKornyezet();
  await sema(env.GY_DB);
  for (const [i, a] of ['kesz', 'hibas_click_id', 'eles_nincs_bekotve', 'dry'].entries()) {
    await env.GY_DB.prepare("INSERT INTO gy_feltoltes (uuid, mod, letrehozva, allapot) VALUES (?1, 'dry', 1, ?2)").bind(`u${i}`, a).run();
  }
  await sema(Object.create(env.GY_DB)); // uj kapcsolat-objektum: a migracio ujra lefut (ahogy egy hideg inditasnal)
  assert.deepEqual((await env.GY_DB.prepare('SELECT allapot FROM gy_feltoltes ORDER BY id').all()).results.map((x) => x.allapot), ['dry', 'kihagyva_click_id', 'kihagyva_nincs_kuldo', 'dry']);
  const sor = await env.GY_DB.prepare('SELECT ujraprobalas, katt_ido, google_hibakod, request_id, utolso_hiba_ido, kovetkezo_proba FROM gy_feltoltes').first();
  assert.deepEqual(sor, { ujraprobalas: 0, katt_ido: null, google_hibakod: null, request_id: null, utolso_hiba_ido: null, kovetkezo_proba: null });
});

// --- GY-25 (2026-10-21 12:15 visszajelzes): teszt-kizaras, click-ID karanten, diagnosztika, eles kuldo -----------------------------------------------------------
import { clickIdHiba, gfeltoltesKuld, valaszElemzes, kuldesKerelem, kuldhetoSorok } from '../lib/gfeltoltes.js';
import { uaElemzes, diagnosztika } from '../lib/forras.js';
const JO_GCLID = 'CjwKCAjw' + 'abcdefghijklmnopqrstuvwxyz0123456789' + 'ABCDEFG_-xyz';

test('GY-25 karanten: click-ID epseg (gclid >= 30 karakter, csak [A-Za-z0-9_-], nem TEST/TESZT) - a hibas nem kuldheto, a tesztfoglalas kizarva', async () => {
  assert.equal(clickIdHiba('gclid', JO_GCLID), null);
  assert.equal(clickIdHiba('gclid', 'TESZT_GCLID_12345'), 'click_id_teszt');
  assert.equal(clickIdHiba('gclid', 'x'.repeat(29)), 'click_id_rovid');
  assert.equal(clickIdHiba('gclid', 'x'.repeat(30)), null);
  assert.equal(clickIdHiba('gclid', 'a'.repeat(31) + ' b'), 'click_id_karakter');
  assert.equal(clickIdHiba('gclid', 'a'.repeat(40) + 'Test' + 'b'.repeat(10)), 'click_id_teszt');
  assert.equal(clickIdHiba('gclid', 'a'.repeat(40) + '=='), 'click_id_karakter');
  assert.equal(clickIdHiba('gclid', ''), 'click_id_hianyzik');

  const env = await lpcKornyezet();
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=${JO_GCLID}`, uuid: 'mb_kar00000000000001' });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=TESZT_GCLID_12345`, uuid: 'mb_kar00000000000002', ms: 2000000 });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=ROVIDGCLID123456`, uuid: 'mb_kar00000000000003', ms: 4000000 });
  await env.GY_DB.prepare('UPDATE gy_foglalas SET igazolt = 1').run();
  const mikor = Math.floor(MOST / 1000) + 4000 + 600 + GFELT.kesleltetes;
  assert.deepEqual(await gfeltoltesFut({ db: env.GY_DB, env, most: mikor, budapestIdo }), { mod: 'dry', uj: 3 });
  const sorok = (await env.GY_DB.prepare('SELECT allapot, hiba, katt_maszk FROM gy_feltoltes ORDER BY id').all()).results;
  assert.deepEqual(sorok.map((x) => [x.allapot, x.hiba]), [['dry', null], ['kihagyva_click_id', 'click_id_teszt'], ['kihagyva_click_id', 'click_id_rovid']]);
  assert.equal(JSON.stringify(sorok).includes('TESZT_GCLID_12345'), false); // a naploban csak maszkolt
  // a lefedettsegben a gyanus click-ID kulon sav, nem gclid
  const d = deps(); d.most = () => MOST + 4 * 86400000;
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?gfeltoltes=1', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  assert.deepEqual(rap.lefedettseg.osszes, { google_igazolt_allapotfelmeres: 3, gclid: 1, gyanus_click_id: 2, csak_braid: 0, nincs_click_id: 0 });
  // teszt=1 foglalas: a mar naplozott sora `kihagyva_teszt`, a lefedettsegbol is kimarad
  await env.GY_DB.prepare("UPDATE gy_foglalas SET teszt = 1 WHERE uuid = 'mb_kar00000000000002'").run();
  await gfeltoltesFut({ db: env.GY_DB, env, most: mikor, budapestIdo });
  assert.equal((await env.GY_DB.prepare("SELECT g.allapot FROM gy_feltoltes g JOIN gy_foglalas f ON f.uuid = g.uuid WHERE f.teszt = 1").first()).allapot, 'kihagyva_teszt');
  const rap2 = await (await adminVegpont({ request: kerelem('/api/gy-admin?gfeltoltes=1', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  assert.deepEqual(rap2.lefedettseg.osszes, { google_igazolt_allapotfelmeres: 2, gclid: 1, gyanus_click_id: 1, csak_braid: 0, nincs_click_id: 0 });
});

test('GY-25 diagnosztika: UA-csalad (bongeszo / OS / eszkoz), a UA nem tarolodik; "UTM igen, click-ID nem" eset a foglalason es a riportban (iOS Safari gyanu, gad_jel, ismetelt, referrer-host)', async () => {
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
  assert.deepEqual(uaElemzes(IOS), { bongeszo: 'safari', os: 'ios', eszkoz: 'mobil' });
  assert.deepEqual(uaElemzes(AND), { bongeszo: 'chrome', os: 'android', eszkoz: 'mobil' });
  assert.deepEqual(uaElemzes(WIN), { bongeszo: 'edge', os: 'windows', eszkoz: 'asztali' });
  assert.equal(uaElemzes('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1').bongeszo, 'chrome');
  assert.equal(uaElemzes('Mozilla/5.0 (compatible; Googlebot/2.1)').bongeszo, 'bot');
  assert.equal(uaElemzes('').bongeszo, 'nincs_ua');

  const env = await lpcKornyezet();
  const pingUa = (ms, search, ua, cookie = HJ_IGEN, referrer = '') => forrasVegpont({ request: kerelem('/api/gy-forras', { search, referrer, path: '/allapotfelmeres/' }, { cookie, fejlec: { 'user-agent': ua } }), env, deps: dAt(ms) });
  // 1) iOS Safari: fizetett UTM + gad_source, DE nincs gclid
  const r1 = await pingUa(0, `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gad_source=1&gad_campaignid=${DSA}`, IOS, HJ_IGEN, 'https://www.google.com/');
  assert.equal((await foglal(env, 600000, `${sutikBol(r1)}; ${HJ_IGEN}`, 'mb_dia00000000000001')).ok, true);
  // 2) Android Chrome: van gclid
  const r2 = await pingUa(2000000, `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=${JO_GCLID}`, AND);
  assert.equal((await foglal(env, 2600000, `${sutikBol(r2)}; ${HJ_IGEN}`, 'mb_dia00000000000002')).ok, true);
  await env.GY_DB.prepare('UPDATE gy_foglalas SET igazolt = 1').run();
  const f = (await env.GY_DB.prepare('SELECT uuid, cimke, bizonyitek, diag FROM gy_foglalas ORDER BY letrehozva').all()).results;
  const d1 = JSON.parse(f[0].diag), d2 = JSON.parse(f[1].diag);
  assert.deepEqual([f[0].cimke, f[0].bizonyitek], ['google_bizonytalan', 'kampany_katt_nelkul']);
  assert.equal(d1.bongeszo, 'safari'); assert.equal(d1.os, 'ios'); assert.equal(d1.eszkoz, 'mobil');
  assert.equal(d1.gad_jel, true); assert.equal(d1.privat_gyanu, true); assert.equal(d1.ismetelt, false); assert.equal(d1.ref_host, 'google.com'); assert.equal(d1.oldal, '/allapotfelmeres/');
  assert.equal(d2.privat_gyanu, false); assert.equal(d2.gad_jel, false); assert.equal(d2.os, 'android');
  assert.equal(f.map((x) => x.diag).join('').includes('Mozilla'), false); // a User-Agent maga nem tarolodik
  assert.equal(f.map((x) => x.diag).join('').includes(JO_GCLID), false);
  const d = deps(); d.most = () => MOST + 3 * 86400000;
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?gfeltoltes=1', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  const ios = rap.diagnosztika.eszkoz.find((x) => x.os === 'ios');
  assert.deepEqual([ios.click, ios.bongeszo, ios.privat_gyanu, ios.gad_jel, ios.ismetelt, ios.db], ['nincs_click_id', 'safari', '1', '1', '0', 1]);
  assert.equal(rap.diagnosztika.eszkoz.find((x) => x.os === 'android').click, 'gclid');
  assert.ok(rap.diagnosztika.forras.some((x) => x.click === 'nincs_click_id' && x.ref_host === 'google.com' && x.elso_oldal === '/allapotfelmeres/'));
  assert.ok(rap.diagnosztika.bizonyitek.length >= 1);
  assert.equal(JSON.stringify(rap).includes(JO_GCLID), false);
  // ismetelt latogato: ugyanazzal a sutivel masodik (nem fizetett) belepes -> a diagnosztika `ismetelt`
  const r3 = await pingUa(4000000, `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}`, IOS, `${sutikBol(r1)}; ${HJ_IGEN}`);
  const dd = diagnosztika({ ua: IOS, b: { param_nevek: [], ref_kat: 'nincs', landing: '/', utm_medium: 'cpc', kattintas_param: null }, ismetelt: true });
  assert.equal(dd.ismetelt, true); assert.equal(dd.privat_gyanu, true); assert.equal(r3.status, 200);
});

test('GY-25 ELES kuldo: validateOnly ELOSZOR, utana partialFailure=true csak a tiszta sorokkal; sorhiba (vegleges / atmeneti), hozzaferesi hiba, ujraproba, nincs dupla kuldes', async () => {
  const env = await lpcKornyezet();
  const E = { ...env, GY_GADS_FELTOLTES: 'eles' };
  const ids = ['mb_kuld0000000000001', 'mb_kuld0000000000002', 'mb_kuld0000000000003'];
  for (const [i, u] of ids.entries()) await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=${JO_GCLID}${i}`, uuid: u, ms: i * 2000000 });
  await env.GY_DB.prepare('UPDATE gy_foglalas SET igazolt = 1').run();
  const most = Math.floor(MOST / 1000) + 4000 + 600 + GFELT.kesleltetes;
  assert.deepEqual(await gfeltoltesFut({ db: env.GY_DB, env: E, most, budapestIdo }), { mod: 'eles', uj: 3 });
  assert.deepEqual((await env.GY_DB.prepare('SELECT allapot FROM gy_feltoltes ORDER BY id').all()).results.map((x) => x.allapot), ['varakozik', 'varakozik', 'varakozik']);

  // kuldo hamis: hivasonkent rogzit; a 2. sor vegleges hiba (EXPIRED_EVENT), a 3. atmeneti (CLICK_NOT_FOUND) a validalasnal
  const hivasok = [];
  const kuldo = async (k) => {
    hivasok.push(JSON.parse(JSON.stringify(k)));
    const hibak = k.validateOnly ? [[1, 'EXPIRED_EVENT'], [2, 'CLICK_NOT_FOUND']] : [];
    return { http: 200, requestId: 'req-' + hivasok.length, json: { results: k.conversions.map((c, i) => (!k.validateOnly || hibak.some(([x]) => x === i) ? (k.validateOnly ? {} : { gclid: c.gclid, conversionAction: c.conversionAction }) : {})), ...(hibak.length ? { partialFailureError: { details: [{ errors: hibak.map(([index, kod]) => ({ errorCode: { conversionUploadError: kod }, message: JO_GCLID, location: { fieldPathElements: [{ fieldName: 'conversions', index }] } })) }] } } : {}) } };
  };
  const ki = await gfeltoltesKuld({ db: env.GY_DB, env: E, most, kuldo });
  assert.equal(hivasok.length, 2);
  assert.equal(hivasok[0].validateOnly, true); assert.equal(hivasok[0].partialFailure, true); assert.equal(hivasok[0].conversions.length, 3);
  assert.equal(hivasok[1].validateOnly, false); assert.equal(hivasok[1].partialFailure, true); assert.equal(hivasok[1].conversions.length, 1); // csak a tiszta sor
  assert.equal(hivasok[1].conversions[0].gclid, JO_GCLID + '0');
  assert.equal(hivasok[1].conversions[0].conversionAction, 'customers/2596120588/conversionActions/7858300772');
  assert.deepEqual(ki, { kuldve: 1, elfogadva: 1, hiba: 2, kihagyva: 0 });
  const s = (await env.GY_DB.prepare('SELECT allapot, hiba, google_hibakod, ujraprobalas, kovetkezo_proba, request_id FROM gy_feltoltes ORDER BY id').all()).results;
  assert.deepEqual([s[0].allapot, s[0].request_id], ['elfogadva', 'req-2']);
  assert.deepEqual([s[1].allapot, s[1].hiba, s[1].google_hibakod, s[1].kovetkezo_proba], ['hiba', 'vegleges', 'EXPIRED_EVENT', null]);
  assert.deepEqual([s[2].allapot, s[2].hiba, s[2].google_hibakod, s[2].ujraprobalas, s[2].kovetkezo_proba], ['hiba', 'ujraproba', 'CLICK_NOT_FOUND', 1, most + 3600]);
  assert.equal(JSON.stringify(s).includes(JO_GCLID), false); // a Google hibauzenet (click-ID-t idezhet) nem tarolodik
  // nincs dupla kuldes: az elfogadott / vegleges sor soha nem megy ujra; az atmeneti csak a kovetkezo_proba utan
  const hivasok2 = []; const kuldo2 = async (k) => { hivasok2.push(k); return { http: 200, requestId: 'r', json: { results: k.conversions.map((c) => (k.validateOnly ? {} : { gclid: c.gclid, conversionAction: c.conversionAction })) } }; };
  assert.deepEqual(await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + 60, kuldo: kuldo2 }), { kuldve: 0, elfogadva: 0, hiba: 0, kihagyva: 0 });
  assert.equal(hivasok2.length, 0);
  assert.deepEqual(await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + 3600, kuldo: kuldo2 }), { kuldve: 1, elfogadva: 1, hiba: 0, kihagyva: 0 });
  assert.equal(hivasok2.length, 2); assert.equal(hivasok2[0].validateOnly, true); assert.equal(hivasok2[1].validateOnly, false);
  assert.equal((await env.GY_DB.prepare('SELECT allapot FROM gy_feltoltes WHERE id = 3').first()).allapot, 'elfogadva');

  // hozzaferesi hiba (403): a sorok NEM valtoznak (nem a konverzio hibaja), riport jelzi
  await env.GY_DB.prepare("UPDATE gy_feltoltes SET allapot = 'varakozik', kovetkezo_proba = NULL, ujraprobalas = 0 WHERE id = 2").run();
  const k403 = async () => ({ http: 403, requestId: null, json: { error: { status: 'PERMISSION_DENIED' } } });
  const r403 = await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + 7200, kuldo: k403 });
  assert.deepEqual(r403.keresHiba, { http: 403, kod: 'PERMISSION_DENIED' });
  assert.equal((await env.GY_DB.prepare('SELECT allapot FROM gy_feltoltes WHERE id = 2').first()).allapot, 'varakozik');
  // kuldo nelkul (nincs titok): a sorok varnak, halozati hivas nincs
  assert.equal((await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + 7200, kuldo: null })).nincsKuldo, true);
  // dry modban sosem kuld
  assert.deepEqual(await gfeltoltesKuld({ db: env.GY_DB, env, most: most + 7200, kuldo: k403 }), { kuldve: 0, elfogadva: 0, hiba: 0, kihagyva: 0 });
});

test('GY-25 ELES kuldo: kuldes elotti vegso ellenorzes (lemondott / teszt / hibas click-ID nem megy ki), kerelem-felepites, keres-szintu valaszelemzes', async () => {
  const env = await lpcKornyezet();
  const E = { ...env, GY_GADS_FELTOLTES: 'eles' };
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=${JO_GCLID}A`, uuid: 'mb_el00000000000001' });
  await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=${JO_GCLID}B`, uuid: 'mb_el00000000000002', ms: 2000000 });
  await env.GY_DB.prepare('UPDATE gy_foglalas SET igazolt = 1').run();
  const most = Math.floor(MOST / 1000) + 2000 + 600 + GFELT.kesleltetes;
  await gfeltoltesFut({ db: env.GY_DB, env: E, most, budapestIdo });
  await env.GY_DB.prepare("UPDATE gy_foglalas SET allapot = 'lemondott' WHERE uuid = 'mb_el00000000000001'").run(); // a naplozas UTAN lemondta
  await env.GY_DB.prepare("UPDATE gy_foglalas SET gads_katt_ertek = 'TESZT_GCLID_12345' WHERE uuid = 'mb_el00000000000002'").run();
  const hivasok = [];
  const ki = await gfeltoltesKuld({ db: env.GY_DB, env: E, most, kuldo: async (k) => { hivasok.push(k); return { http: 200, json: {}, requestId: 'x' }; } });
  assert.equal(hivasok.length, 0);
  assert.equal(ki.kihagyva, 2);
  assert.deepEqual((await env.GY_DB.prepare('SELECT allapot, hiba FROM gy_feltoltes ORDER BY id').all()).results.map((x) => [x.allapot, x.hiba]), [['kihagyva_lemondva', 'foglalas_nem_aktiv'], ['kihagyva_click_id', 'click_id_teszt']]);
  // kerelem: partialFailure mindig true; validateOnly a paramtertol fugg
  const k = kuldesKerelem([{ katt_tipus: 'gclid', katt_ertek: JO_GCLID, konverzio_ido: '2026-10-21 10:00:00+02:00', order_id: 'o'.repeat(64) }], { validateOnly: true });
  assert.deepEqual([k.partialFailure, k.validateOnly, k.conversions.length], [true, true, 1]);
  // valaszelemzes: sorhiba index, keres-szintu hiba
  assert.deepEqual([...valaszElemzes(200, { partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: 'CLICK_NOT_FOUND' }, location: { fieldPathElements: [{ fieldName: 'conversions', index: 4 }] } }] }] } }).sorHibak], [[4, 'CLICK_NOT_FOUND']]);
  assert.deepEqual(valaszElemzes(401, { error: { status: 'UNAUTHENTICATED' } }).keresHiba, { http: 401, kod: 'UNAUTHENTICATED' });
  assert.equal(valaszElemzes(200, {}).sorHibak.size, 0);
});

test('GY-25 ELES kuldo: ures / csomagolt / hosszeltero valasz NEM ad `elfogadva`-t; 400 sor-hivatkozassal csak azt a sort jeloli; elavult futas nem ir felul; token-hiba nem rontja a sorokat', async () => {
  const env = await lpcKornyezet();
  const E = { ...env, GY_GADS_FELTOLTES: 'eles' };
  for (const [i, u] of ['mb_ert0000000000001', 'mb_ert0000000000002'].entries()) await gadsFoglalas(env, { search: `?utm_source=google&utm_medium=cpc&utm_campaign=${DSA}&gclid=${JO_GCLID}${i}`, uuid: u, ms: i * 2000000 });
  await env.GY_DB.prepare('UPDATE gy_foglalas SET igazolt = 1').run();
  const most = Math.floor(MOST / 1000) + 2000 + 600 + GFELT.kesleltetes;
  await gfeltoltesFut({ db: env.GY_DB, env: E, most, budapestIdo });
  const allapotok = async () => (await env.GY_DB.prepare('SELECT allapot, google_hibakod FROM gy_feltoltes ORDER BY id').all()).results.map((x) => x.allapot);
  const valasz = (mit) => async (k) => (k.validateOnly ? { http: 200, requestId: 'v', json: {} } : { http: 200, requestId: 'e', json: mit });
  // ures `{}` es Composio-csomag: nincs results -> NEM elfogadva, a sorok visszaallnak
  for (const [i, mit] of [{}, { successful: true, data: { results: [{ gclid: 'x' }, { gclid: 'y' }] } }, { results: [{ gclid: 'x' }] }].entries()) {
    const r = await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + i, kuldo: valasz(mit) });
    assert.deepEqual(r.keresHiba, { http: 200, kod: 'VALASZ_ERTELMEZHETETLEN' });
    assert.deepEqual(await allapotok(), ['varakozik', 'varakozik']);
  }
  // results ures eleme = a sor nem ment at -> hiba (ujraproba), a masik elfogadva
  const r2 = await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + 10, kuldo: valasz({ results: [{ gclid: 'x', conversionAction: 'y' }, {}] }) });
  assert.deepEqual([r2.elfogadva, r2.hiba], [1, 1]);
  assert.deepEqual(await allapotok(), ['elfogadva', 'hiba']);
  // 400 sor-hivatkozassal: csak az a sor kap hibat, a tobbi valtozatlan
  await env.GY_DB.prepare("UPDATE gy_feltoltes SET allapot = 'varakozik', hiba = NULL, google_hibakod = NULL, ujraprobalas = 0, kovetkezo_proba = NULL, utolso_hiba_ido = NULL").run();
  const k400 = async () => ({ http: 400, requestId: 'q', json: { error: { status: 'INVALID_ARGUMENT', details: [{ errors: [{ errorCode: { conversionUploadError: 'UNPARSEABLE_GCLID' }, location: { fieldPathElements: [{ fieldName: 'conversions', index: 1 }] } }] }] } } });
  const r3 = await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + 20, kuldo: k400 });
  assert.equal(r3.keresHiba.http, 400);
  const s = (await env.GY_DB.prepare('SELECT allapot, google_hibakod FROM gy_feltoltes ORDER BY id').all()).results;
  assert.deepEqual([s[0].allapot, s[1].allapot, s[1].google_hibakod], ['varakozik', 'hiba', 'UNPARSEABLE_GCLID']);
  // elavult futas: ha a sort kozben mas lefoglalta (mas zar-ido), az eredmeny nem ir felul
  await env.GY_DB.prepare("UPDATE gy_feltoltes SET allapot = 'varakozik', hiba = NULL, google_hibakod = NULL, kovetkezo_proba = NULL, utolso_hiba_ido = NULL, request_id = NULL").run();
  const lassu = async (k) => { await env.GY_DB.prepare("UPDATE gy_feltoltes SET allapot = 'elfogadva', utolso_hiba_ido = NULL WHERE id = 1").run(); return { http: 200, requestId: 'z', json: k.validateOnly ? {} : { results: k.conversions.map((c) => ({ gclid: c.gclid })) } }; };
  await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + 30, kuldo: lassu });
  assert.equal((await env.GY_DB.prepare('SELECT request_id FROM gy_feltoltes WHERE id = 1').first()).request_id, null); // az id=1 sort nem irta felul a lassu futas
  // token-hiba (a Google Ads fele semmi nem ment): a sorok valtozatlanok
  await env.GY_DB.prepare("UPDATE gy_feltoltes SET allapot = 'varakozik', request_id = NULL, utolso_hiba_ido = NULL").run();
  const { googleAdsKuldo } = await import('../lib/gfeltoltes.js');
  const kuldo = googleAdsKuldo({ GOOGLE_ADS_DEVELOPER_TOKEN: 'a', GOOGLE_ADS_CLIENT_ID: 'b', GOOGLE_ADS_CLIENT_SECRET: 'c', GOOGLE_ADS_REFRESH_TOKEN: 'd' }, async () => new Response('{}', { status: 503 }));
  const r5 = await gfeltoltesKuld({ db: env.GY_DB, env: E, most: most + 40, kuldo });
  assert.deepEqual(r5.keresHiba, { http: 401, kod: 'UNAUTHENTICATED' });
  assert.deepEqual(await allapotok(), ['varakozik', 'varakozik']);
  assert.equal(googleAdsKuldo({}, fetch), null);
});
