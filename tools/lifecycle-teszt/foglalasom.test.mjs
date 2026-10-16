// "A foglalasod" oldal (Medical Piercing): sajat modosito / lemondo panel - a Salonic-oldalak mintajaval, valodi halozat nelkul.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { idopontokHtmlbol, lemondasiHatarido, urlapHtmlbol, szabadIdopontok, modosit, lemond, helyiEpoch, napKulcs, napCimke, INDOK } from '../../medicalpiercing/lib/salonic-modosit.js';
import { foglalasOldal, foglalasMuvelet, MINTA } from '../../medicalpiercing/lib/foglalasom.js';

const ID = '3f1c2b4a-1d2e-4f5a-9b8c-7d6e5f4a3b2c';
const MOST = helyiEpoch('2026-10-20', 9, 0);
const T1 = helyiEpoch('2026-10-27', 13, 0), T2 = helyiEpoch('2026-10-27', 13, 30);
const KEZDET = helyiEpoch('2026-10-23', 14, 30);
const SELECT = fs.readFileSync(new URL('./fixtures/salonic-selectdate.html', import.meta.url), 'utf8').replaceAll('__ID__', ID).replaceAll('__T1__', T1).replaceAll('__T2__', T2);
const html = (body, status = 200, fej = {}) => new Response(body, { status, headers: { 'content-type': 'text/html', ...fej } });
const atiranyit = (hova, fej = {}) => new Response(null, { status: 302, headers: { location: hova, ...fej } });

function hamisSalonic(lemondoOldal) {
  const hivasok = [];
  const fetchFn = async (url, o = {}) => {
    hivasok.push({ url, method: o.method || 'GET', body: o.body || null, cookie: (o.headers || {}).cookie || null, xrw: (o.headers || {})['x-requested-with'] || null });
    const u = new URL(url);
    if (u.pathname === '/selectDate/') return html(SELECT);
    if (u.pathname === '/editBooking/') return atiranyit(`/success-edit/${ID}`);
    if (u.pathname.startsWith('/success-edit/')) return html('<h1>Sikeres módosítás</h1>');
    if (u.pathname.startsWith('/booking/cancelBooking/')) return lemondoOldal(o, hivasok);
    if (u.pathname.startsWith('/success-cancel/')) return html('<h1>A foglalásodat lemondtuk</h1>');
    return html('nincs', 404);
  };
  return { fetchFn, hivasok };
}

test('idopontok: a selectDate-oldal linkjeibol, csak ehhez a foglalashoz', () => {
  const l = idopontokHtmlbol(SELECT, ID);
  assert.deepEqual(l, [{ ido: '13:00', start: T1 }, { ido: '13:30', start: T2 }]);
  assert.equal(lemondasiHatarido(SELECT), 'A foglalást legkésőbb 2026. október 26. 14:30-ig van lehetőséged lemondani.');
  assert.equal(napKulcs(T1), '2026-10-27');
  assert.equal(napCimke('2026-10-27'), 'október 27., kedd');
  assert.equal(helyiEpoch('2026-10-27', 13, 0), Date.UTC(2026, 9, 27, 12, 0) / 1000); // teli ido (CET)
  assert.equal(helyiEpoch('2026-10-20', 13, 0), Date.UTC(2026, 9, 20, 11, 0) / 1000); // nyari ido (CEST)
});

test('szabadIdopontok: a Salonic a kovetkezo szabad napot adja -> a valodi nap, elozo a kert nap elotti', async () => {
  const { fetchFn, hivasok } = hamisSalonic();
  const v = await szabadIdopontok(fetchFn, ID, '2026-10-25', MOST);
  assert.equal(v.nap, '2026-10-27'); assert.equal(v.kert, '2026-10-25');
  assert.equal(v.elozo, '2026-10-24'); assert.equal(v.kovetkezo, '2026-10-28');
  assert.equal(v.idopontok.length, 2);
  assert.match(hivasok[0].url, new RegExp(`/selectDate/\\?startDate=${helyiEpoch('2026-10-25')}&bookingId=${ID}$`));
  const ma = await szabadIdopontok(fetchFn, ID, '2020-01-01', MOST);
  assert.equal(ma.kert, '2026-10-20'); assert.equal(ma.elozo, null);
  assert.match(hivasok[1].url, new RegExp(`startDate=${MOST}&`));
});

test('modosit: csak szabad idopontra, editBooking -> success-edit', async () => {
  const { fetchFn, hivasok } = hamisSalonic();
  assert.deepEqual(await modosit(fetchFn, ID, T2 + 60, MOST), { ok: false, hiba: 'nem_szabad' });
  assert.ok(!hivasok.some((h) => h.url.includes('/editBooking/')));
  assert.deepEqual(await modosit(fetchFn, ID, T1, MOST), { ok: true, uj: T1 });
  assert.ok(hivasok.some((h) => h.url === `https://medicalpiercing.salonic.hu/editBooking/?bookingId=${ID}&startDate=${T1}`));
});

test('lemond: a Salonic sajat modja - GET (sutik), majd AJAX POST reason mezovel, JSON status:success', async () => {
  const { fetchFn, hivasok } = hamisSalonic((o) => (o.method === 'POST' ? new Response('{"status":"success"}', { headers: { 'content-type': 'application/json' } }) : html('<a class="btn-cancel-booking">Lemondás</a>', 200, { 'set-cookie': 'sess=xyz; Path=/; HttpOnly' })));
  assert.deepEqual(await lemond(fetchFn, ID), { ok: true });
  const post = hivasok.find((h) => h.method === 'POST');
  assert.equal(new URL(post.url).pathname, `/booking/cancelBooking/${ID}`);
  assert.equal(new URLSearchParams(post.body).get('reason'), INDOK);
  assert.equal(post.xrw, 'XMLHttpRequest'); assert.match(post.cookie, /sess=xyz/);
});

test('lemond: mar lemondva (atiranyitas), illetve hibas / nem JSON valasz -> hiba', async () => {
  assert.deepEqual(await lemond(hamisSalonic(() => atiranyit(`/success-cancel/${ID}`)).fetchFn, ID), { ok: true });
  assert.deepEqual(await lemond(hamisSalonic((o) => (o.method === 'POST' ? html('<h1>Hiba</h1>') : html('ok'))).fetchFn, ID), { ok: false, hiba: 'salonic_lemond' });
  assert.deepEqual(await lemond(hamisSalonic((o) => (o.method === 'POST' ? new Response('{"status":"error"}') : html('ok'))).fetchFn, ID), { ok: false, hiba: 'salonic_lemond' });
  assert.deepEqual(await lemond(hamisSalonic(() => html('nincs', 404)).fetchFn, ID), { ok: false, hiba: 'salonic_lemond' });
});

function hamisDb(sor) { return { prepare: () => ({ bind: () => ({ first: async () => sor }) }) }; }
const keres = (ut, o = {}) => new Request('https://www.medicalpiercing.hu' + ut, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone)', origin: 'https://www.medicalpiercing.hu', 'content-type': 'application/json', ...(o.headers || {}) }, method: o.method || 'GET', body: o.body });

test('vegpontok: idopontok JSON-ja nem tartalmaz Salonic-cimet / azonositot; POST-vedelem; ismetles 10 mp-en belul', async () => {
  const env = { LIFECYCLE_DB: hamisDb({ id: ID, allapot: 'aktiv', kezdet: KEZDET }) };
  const { fetchFn } = hamisSalonic(() => atiranyit(`/success-cancel/${ID}`));
  const r = await foglalasMuvelet(keres('/f/0123456789/idopontok?nap=2026-10-27'), env, fetchFn, MOST);
  const szoveg = await r.text();
  assert.equal(r.status, 200); assert.doesNotMatch(szoveg, /salonic|editBooking/i); assert.ok(!szoveg.includes(ID));
  assert.equal(JSON.parse(szoveg).idopontok[0].ido, '13:00');
  assert.equal((await foglalasMuvelet(keres('/f/0123456789/lemond', { method: 'POST', body: '{"biztos":true}', headers: { origin: 'https://gonosz.example' } }), env, fetchFn, MOST)).status, 403);
  assert.equal((await foglalasMuvelet(keres('/f/0123456789/lemond', { method: 'POST', body: '{"biztos":true}', headers: { 'user-agent': 'facebookexternalhit/1.1' } }), env, fetchFn, MOST)).status, 403);
  assert.equal((await foglalasMuvelet(keres('/f/1111111111/lemond', { method: 'POST', body: '{}' }), env, fetchFn, MOST)).status, 400);
  const ok = await foglalasMuvelet(keres('/f/2222222222/modosit', { method: 'POST', body: JSON.stringify({ start: T1 }) }), env, fetchFn, MOST);
  assert.deepEqual(await ok.json(), { ok: true, uj: T1 });
  assert.equal((await foglalasMuvelet(keres('/f/2222222222/modosit', { method: 'POST', body: JSON.stringify({ start: T2 }) }), env, fetchFn, MOST)).status, 429);
  const le = await foglalasMuvelet(keres('/f/3333333333/lemond', { method: 'POST', body: '{"biztos":true}' }), env, fetchFn, MOST);
  assert.deepEqual(await le.json(), { ok: true });
  const lemondott = { LIFECYCLE_DB: hamisDb({ id: ID, allapot: 'lemondva', kezdet: KEZDET }) };
  assert.equal((await foglalasMuvelet(keres('/f/4444444444/idopontok'), lemondott, fetchFn, MOST)).status, 409);
});

test('oldal: nincs iframe, sajat panel ket lehetoseggel, kozepre igazitott gomb', async () => {
  const t = await foglalasOldal({ ...MINTA, token: 'abcdef0123', id: ID, kezdet: Math.floor(Date.now() / 1000) + 7 * 86400 }).text();
  assert.doesNotMatch(t, /<iframe|salonic\.hu|bookingDetails/);
  assert.ok(!t.includes(ID));
  assert.match(t, /Időpont módosítása \/ lemondása<\/button>/);
  assert.match(t, /Másik időpontot választok/); assert.match(t, /Igen, lemondom/);
  assert.match(t, /data-alap="\/f\/abcdef0123"/);
  const minta = await foglalasOldal(MINTA, { minta: true }).text();
  assert.match(minta, /data-minta="1"/);
});
