// Egysegtesztek: forras-cimkezes, hozzajarulas, titkos fuggvenyek, Salonic-adapter es a Worker-vegpontok (D1-szimulatorral, hamis Salonic-gal).
// Futtatas: node --test tools/test-gy-szerver.mjs   (halozat nincs, foglalas nincs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { belepes, cimkez, osszevon, fizetett, referrerKategoria } from '../lib/forras.js';
import { hozzajarulas } from '../lib/hozzajarulas.js';
import { tranzakcioId, hmacHex, ujToken, sha256Hex } from '../lib/titkos.js';
import { forrasVegpont, igazolasVegpont, foglalasVegpont, koszonoVegpont, kampanyokVegpont, adminVegpont, atiranyitasElemzes, visszahivasVegpont } from '../lib/motor-szerver.js';
import { createSalonicAdapter, foglalasTipus, ALLAPOTFELMERES_ID } from '../public/assets/js/motor/salonic-adapter.js';
import { eloElemzes } from '../lib/salonic-szerver.js';
import { ujD1 } from './d1-szim.mjs';
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
  assert.equal(y.kattintas_ertek, null);
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
  assert.equal(sor.cimke, 'google_brand');
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
  assert.equal(JSON.stringify((await env.GY_DB.prepare('SELECT * FROM gy_munkamenet').all()).results).includes('ABCDEFGH12345'), true);
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
  assert.equal((await igazolasVegpont({ request: zapKerelem(masik), env, deps: { ...d, fetch: salonicHamis({ foglalasok: { [SID]: { startUnix: START + 1800 } } }) } })).status, 404);
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
  assert.deepEqual({ ...sor }, { kampany: DSA, hirdetescsoport: '123456789', hirdetes: '987654321', cimke: 'google_nem_brand' });
  const rap = await (await adminVegpont({ request: kerelem('/api/gy-admin?riport=2026-10', null, { metodus: 'GET', fejlec: { 'x-gy-kulcs': ADMIN } }), env, deps: d })).json();
  assert.deepEqual(rap.kampany_bontas.map((x) => ({ ...x })), [{ kampany: DSA, hirdetescsoport: '123456789', cimke: 'google_nem_brand', db: 1 }]);
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
