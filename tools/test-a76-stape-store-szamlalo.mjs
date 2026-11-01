// A76 Stape Store szamlalo (csak olvas): fake-fetch teszt – a „Filter documents” utvonal, lapozas, oranki darabszam, jelzo-eloszlas, a kulcs nem szivarog.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dokumentumokLeker, futtat, osszegez, priceJellemzes } from './a76-stape-store-szamlalo.mjs';

const KEY = 'sk_teszt_titkos_kulcs_0123456789';
const doc = (i, iso, fbc) => ({ key: 'k' + i, collection_name: 'a76_schedule_log', created_at: iso, updated_at: iso, data: { event_id: 'e' + i, client_id: 'c' + i, ...(fbc === undefined ? {} : { fbc_suti_van: fbc }) } });
function szerver(lapok, { kurzorMezo = 'cursor' } = {}) {
  const hivasok = [];
  const f = async (url, o) => {
    hivasok.push({ url, method: o.method, body: o.body ? JSON.parse(o.body) : null });
    const u = new URL(url);
    if (u.pathname.endsWith('/collections')) return { status: 200, text: async () => JSON.stringify({ success: true, data: { items: [{ name: 'a76_schedule_log' }] } }) };
    const b = JSON.parse(o.body); const k = b.pagination[kurzorMezo]; const idx = k ? Number(k) : 0;
    if (b.pagination.cursor !== undefined && kurzorMezo !== 'cursor') return { status: 200, text: async () => JSON.stringify({ success: true, data: { pagination: { limit: 2, next_cursor: '1' }, items: lapok[0] } }) }; // rossz mezo: mindig az elso lap
    const kov = idx + 1 < lapok.length ? String(idx + 1) : null;
    return { status: 200, text: async () => JSON.stringify({ success: true, data: { pagination: { limit: 2, next_cursor: kov }, items: lapok[idx] } }) };
  };
  f.hivasok = hivasok; return f;
}
const LAPOK = [[doc(1, '2026-10-26T10:41:00Z', 1), doc(2, '2026-10-26T10:55:00Z', 0)], [doc(3, '2026-10-26T11:10:00Z'), doc(4, '2026-10-26T14:05:00Z', 1)], [doc(5, '2026-10-25T09:00:00Z', 1)]];

test('a Filter documents utvonal (POST .../collections/<kol>/documents, time_range + pagination), lapozas a kurzorral', async () => {
  const f = szerver(LAPOK);
  const r = await dokumentumokLeker({ api: `https://stape.a76.hu/stape-api/${KEY}/v2/store`, kol: 'a76_schedule_log', tolIso: '2026-10-26T10:40:00.000Z', limit: 2, hiv: async (m, u, b) => { const x = await f(u, { method: m, body: JSON.stringify(b) }); return { status: x.status, json: JSON.parse(await x.text()) }; } });
  assert.equal(r.docs.length, 5); assert.equal(r.valtozat, 'cursor'); assert.equal(r.hiba, null);
  assert.equal(f.hivasok[0].method, 'POST'); assert.match(f.hivasok[0].url, /\/v2\/store\/collections\/a76_schedule_log\/documents$/);
  assert.deepEqual(f.hivasok[0].body, { time_range: { created_at: { from: '2026-10-26T10:40:00.000Z' } }, pagination: { limit: 2 } });
  assert.equal(f.hivasok[1].body.pagination.cursor, '1');
});
test('osszegez: oranki (Budapest) darabszam es a jelzo-mezo eloszlasa; a tol elotti sor kimarad; mezonevek ertek nelkul', () => {
  const docs = LAPOK.flat(); const o = osszegez(docs, { tolMs: Date.parse('2026-10-26T10:40:00Z'), mezo: 'fbc_suti_van' });
  assert.deepEqual(o.oraSzam, { '2026-10-26 11': 2, '2026-10-26 12': 1, '2026-10-26 15': 1 });
  assert.deepEqual(o.jelzo['2026-10-26 11'], { 0: 1, 1: 1, nincs: 0 }); assert.deepEqual(o.jelzo['2026-10-26 12'], { 0: 0, 1: 0, nincs: 1 });
  assert.deepEqual(o.mezonevek, ['client_id', 'event_id', 'fbc_suti_van']);
});
test('futtat: a kimenet nem tartalmazza a kulcsot, az azonositokat; HIBA kulcs nelkul; hibas valasz nem dob', async () => {
  const sorok = []; const f = szerver(LAPOK);
  const r = await futtat({ key: KEY, kollekciok: ['a76_schedule_log'], tol: '2026-10-26T10:40:00Z', fetchImpl: f, naplo: (s) => sorok.push(s), most: Date.parse('2026-10-27T05:00:00Z') });
  assert.equal(r.ok, true); const ki = sorok.join('\n');
  assert.equal(ki.includes(KEY), false); assert.equal(/e[1-5]\b|c[1-5]\b/.test(ki.replace(/[a-z_]+id/g, '')), false);
  assert.match(ki, /2026-10-26 11h \(Budapest\): 2 sor; fbc_suti_van: 1=1 0=1 nincs=0/); assert.match(ki, /5 dokumentum, 3 lap/);
  assert.equal((await futtat({ key: '', kollekciok: ['x'], naplo: () => {} })).ok, false);
  const hibas = async () => ({ status: 404, text: async () => 'nincs' }); const s2 = [];
  await futtat({ key: KEY, kollekciok: ['x'], fetchImpl: hibas, naplo: (s) => s2.push(s) }); assert.match(s2.join('\n'), /HIBA HTTP 404/);
  const dob = async () => { throw new Error('halozat ' + KEY); }; const s3 = [];
  await futtat({ key: KEY, kollekciok: ['x'], fetchImpl: dob, naplo: (s) => s3.push(s) }); assert.equal(s3.join('\n').includes(KEY), false);
});
test('a lapozo-mezo nevet kiprobalja (cursor -> next_cursor), ha az elso nem ervenyes', async () => {
  const f = szerver(LAPOK, { kurzorMezo: 'next_cursor' });
  const r = await dokumentumokLeker({ api: 'https://x/stape-api/k/v2/store', kol: 'a', tolIso: '2026-10-26T10:40:00.000Z', limit: 2, hiv: async (m, u, b) => { const x = await f(u, { method: m, body: JSON.stringify(b) }); return { status: x.status, json: JSON.parse(await x.text()) }; } });
  assert.equal(r.valtozat, 'next_cursor'); assert.equal(r.docs.length, 5);
});

test('priceJellemzes: csak jellemzes, ertek nincs (van / ures / csak szamjegy / first_booking); hibas URL-re nincs_url', () => {
  assert.deepEqual(priceJellemzes('https://a76.hu/foglalas-ok/?price=19000&first_booking=true&x=SZEMELYES'), { price: 'van', ures: 'nem', csak_szamjegy: 'igen', first_booking: 'igen' });
  assert.deepEqual(priceJellemzes('https://a76.hu/foglalas-ok/?price=19%20000%20Ft'), { price: 'van', ures: 'nem', csak_szamjegy: 'nem', first_booking: 'nem' });
  assert.deepEqual(priceJellemzes('https://a76.hu/foglalas-ok/?price=&first_booking=true'), { price: 'van', ures: 'igen', csak_szamjegy: 'nem', first_booking: 'igen' });
  assert.deepEqual(priceJellemzes('https://a76.hu/foglalas-moricz/'), { price: 'nincs', ures: '-', csak_szamjegy: '-', first_booking: 'nem' });
  assert.equal(priceJellemzes('nem url').price, 'nincs_url');
  assert.equal(JSON.stringify(priceJellemzes('https://a76.hu/?price=1234&email=a@b.hu')).includes('1234'), false, 'az ertek nem kerul ki');
});

test('kategoriakNaponta (UJ-93 0. lepes): zart halmaz, esemenynev szerinti napi bontas, nyers ertek / URL nem kerul ki', async () => {
  const { kategoriakNaponta, KATEGORIAK } = await import('./a76-stape-store-szamlalo.mjs');
  const doc = (t, ev, fb) => ({ created_at: t, data: { event_name: ev, first_booking_raw: fb, page_location: 'https://x/?email=SZEMELYES@x.hu' } });
  const docs = [
    doc('2026-10-30T14:30:00Z', 'a76_booking_booked', 'false'), doc('2026-10-30T14:40:00Z', 'a76_booking_booked', 'false'),
    doc('2026-10-30T15:00:00Z', 'page_view', 'hianyzik'), doc('2026-10-30T15:10:00Z', 'a76_booking_booked', 'true'),
    doc('2026-10-30T15:20:00Z', 'a76_booking_booked', 'SZEMELYES@x.hu'), doc('2026-10-30T15:30:00Z', 'a76_booking_booked', undefined),
    doc('2026-10-29T10:00:00Z', 'a76_booking_booked', '1'), doc('2026-10-20T10:00:00Z', 'a76_booking_booked', '0'),
  ];
  const r = kategoriakNaponta(docs, { tolMs: Date.parse('2026-10-29T00:00:00Z'), mezo: 'first_booking_raw' });
  assert.deepEqual(r['2026-10-30'].a76_booking_booked, { false: 2, true: 1, egyeb: 1, nincs: 1 });
  assert.deepEqual(r['2026-10-30'].page_view, { hianyzik: 1 });
  assert.deepEqual(r['2026-10-29'].a76_booking_booked, { 1: 1 });
  assert.equal(r['2026-10-20'], undefined, 'a tol elotti dokumentum kimarad');
  assert.equal(JSON.stringify(r).includes('SZEMELYES'), false); assert.ok(KATEGORIAK.includes('egyeb'));
  const sorok = []; const f = szerver(LAPOK);
  await futtat({ key: KEY, kollekciok: ['a76_schedule_log'], tol: '2026-10-26T10:40:00Z', kategoria: true, mezo: 'fbc_suti_van', fetchImpl: f, naplo: (s) => sorok.push(s), most: Date.parse('2026-10-26T12:00:00Z') });
  assert.equal(sorok.join('\n').includes(KEY), false);
});

test('hianyzoSzerkezet (UJ-93 0. lepes): a mezo nelkuli sorok kulcskeszlete (csak kulcsnevek), ora (UTC) es utvonal szerint; nyers ertek / URL-query / azonosito nem kerul a kimenetre', async () => {
  const { hianyzoSzerkezet } = await import('./a76-stape-store-szamlalo.mjs');
  const mk = (iso, dd) => ({ created_at: iso, data: dd });
  const docs = [
    mk('2026-10-30T15:06:10Z', { event_name: 'gtm.js', a76_nav: 'navigate', a76_nav_diag: 'x', first_booking_raw: 'false', page_location: 'https://www.a76.hu/foglalas-moricz/?first_booking=false&gclid=TITKOS1234' }),
    mk('2026-10-30T15:48:20Z', { event_name: 'gtm.js', a76_nav: 'navigate', page_location: 'https://www.a76.hu/foglalas-moricz/?gclid=TITKOS5678' }),
    mk('2026-10-30T15:49:20Z', { event_name: 'gtm.js', client_id: 'c1', page_location: 'https://www.a76.hu/foglalas-oktogon/' }),
    mk('2026-10-30T12:00:00Z', { event_name: 'gtm.js', page_location: 'https://www.a76.hu/foglalas-moricz/' }), // tol elott
  ];
  const ki = hianyzoSzerkezet(docs, { tolMs: Date.parse('2026-10-30T14:46:30Z'), mezo: 'first_booking_raw' });
  assert.deepEqual(ki, {
    'van | a76_nav,a76_nav_diag,-a76_sched_ok | kulcsszam=5 | /foglalas-moricz/ | 2026-10-30T15Z': 1,
    'nincs | a76_nav,-a76_nav_diag,-a76_sched_ok | kulcsszam=3 | /foglalas-moricz/ | 2026-10-30T15Z': 1,
    'nincs | -a76_nav,-a76_nav_diag,-a76_sched_ok | kulcsszam=3 | /foglalas-oktogon/ | 2026-10-30T15Z': 1,
  });
  const szoveg = JSON.stringify(ki); assert.ok(!/TITKOS|gclid|first_booking=/.test(szoveg), 'nincs nyers ertek / query');
});

test('keresztNavFirstBooking (UJ-99): first_booking_raw x a76_nav zart halmaz, a tol elotti sor kimarad, nyers ertek nem kerul ki', async () => {
  const { keresztNavFirstBooking } = await import('./a76-stape-store-szamlalo.mjs');
  const mk = (iso, dd) => ({ created_at: iso, data: dd });
  const docs = [
    mk('2026-10-30T15:06:00Z', { first_booking_raw: 'false', a76_nav: 'navigate' }),
    mk('2026-10-30T15:07:00Z', { first_booking_raw: 'false', a76_nav: 'reload' }),
    mk('2026-10-30T15:08:00Z', { first_booking_raw: 'ures', a76_nav: 'back_forward|x|y' }),
    mk('2026-10-30T15:09:00Z', { first_booking_raw: 'TITKOS', a76_nav: 'valami_mas' }),
    mk('2026-10-30T15:10:00Z', { a76_nav: 'navigate' }),
    mk('2026-10-30T12:00:00Z', { first_booking_raw: 'true', a76_nav: 'navigate' }), // tol elott
  ];
  const ki = keresztNavFirstBooking(docs, { tolMs: Date.parse('2026-10-30T14:46:30Z') });
  assert.deepEqual(ki, { 'false x navigate': 1, 'false x reload': 1, 'ures x back_forward': 1, 'egyeb x egyeb': 1, 'nincs x navigate': 1 });
  assert.ok(!/TITKOS|valami_mas/.test(JSON.stringify(ki)));
});

test('consentJellemzes + utvonalConsentOsszesites (UJ-99): zart halmaz, query / nyers ertek nem kerul ki, tol elotti sor kimarad', async () => {
  const { consentJellemzes, utvonalConsentOsszesites } = await import('./a76-stape-store-szamlalo.mjs');
  assert.equal(consentJellemzes({ ad_storage: 'granted', analytics_storage: 'denied', titkos: 'x' }, ['ad_storage', 'analytics_storage', 'titkos']), 'ad_storage=granted,analytics_storage=denied');
  assert.equal(consentJellemzes({ ad_storage: 'valami-egyeb' }), 'ad_storage=egyeb:string:valamiegyeb'); assert.equal(consentJellemzes({ ad_storage: true }), 'ad_storage=egyeb:boolean:true'); assert.equal(consentJellemzes(null), 'ad_storage=nincs'); assert.equal(consentJellemzes({}), 'ad_storage=nincs');
  const t = '2026-10-30T14:46:30Z';
  const sor = (iso, loc, fb, cs) => ({ created_at: iso, data: { page_location: loc, first_booking_raw: fb, consent_state: cs } });
  const docs = [
    sor('2026-10-30T16:00:00Z', 'https://a76.hu/foglalas-ok/?price=1234&email=x', '1', { ad_storage: 'granted' }),
    sor('2026-10-30T17:00:00Z', 'https://a76.hu/foglalas-moricz/', '0', { ad_storage: 'denied' }),
    sor('2026-10-30T17:10:00Z', 'https://a76.hu/foglalas-moricz/', undefined, { ad_storage: 'granted' }),
    sor('2026-10-30T18:00:00Z', 'https://a76.hu/masik/', 'varatlan-ertek', { ad_storage: 'granted' }),
    sor('2026-10-30T10:00:00Z', 'https://a76.hu/foglalas-ok/', '1', { ad_storage: 'granted' }), // tol elott
  ];
  const ki = utvonalConsentOsszesites(docs, { tolMs: Date.parse(t) });
  assert.deepEqual(ki, { '2026-10-30 | /foglalas-ok/ | first_booking_raw=1 | nav=nincs | ad_storage=granted': 1, '2026-10-30 | /foglalas-moricz/ | first_booking_raw=0 | nav=nincs | ad_storage=denied': 1, '2026-10-30 | /foglalas-moricz/ | first_booking_raw=nincs | nav=nincs | ad_storage=granted': 1, '2026-10-30 | egyeb | first_booking_raw=egyeb | nav=nincs | ad_storage=granted': 1 });
  assert.ok(!JSON.stringify(ki).match(/price|email|varatlan/));
});

test('egyediFoglalasok (UJ-99 3.): tag 95 feltetelnek megfelelo sorok egyedi booking_id-ra, azonosito nem kerul ki', async () => {
  const { egyediFoglalasok } = await import('./a76-stape-store-szamlalo.mjs');
  const B1 = 'AbCdEfGhIjKlMnOpQrStUv'; const B2 = 'ZyXwVuTsRqPoNmLkJiHgFe';
  const sor = (iso, loc, fb, nav, cs) => ({ created_at: iso, data: { page_location: loc, first_booking_raw: fb, a76_nav: nav, consent_state: cs } });
  const g = { ad_storage: true };
  const docs = [
    sor('2026-10-31T10:00:00Z', `https://a76.hu/foglalas-ok/?booking_id=${B1}&x=1`, 'false', 'navigate', g),
    sor('2026-10-31T10:05:00Z', `https://a76.hu/foglalas-ok/?booking_id=${B1}`, 'false', 'navigate', g), // ugyanaz a foglalas ujra
    sor('2026-10-31T11:00:00Z', `https://a76.hu/foglalas-moricz/?booking_id=${B2}`, 'false', 'navigate|x', { ad_storage: 'granted' }),
    sor('2026-10-31T12:00:00Z', 'https://a76.hu/foglalas-ok/', 'false', 'navigate', g), // nincs booking_id
    sor('2026-10-31T13:00:00Z', `https://a76.hu/foglalas-ok/?booking_id=${B2}`, 'false', 'reload', g), // nem navigate
    sor('2026-10-31T14:00:00Z', `https://a76.hu/foglalas-ok/?booking_id=${B2}`, 'true', 'navigate', g), // nem false
    sor('2026-10-31T15:00:00Z', `https://a76.hu/foglalas-ok/?booking_id=${B2}`, 'false', 'navigate', { ad_storage: false }), // consent denied
    sor('2026-10-31T16:00:00Z', `https://a76.hu/masik/?booking_id=${B2}`, 'false', 'navigate', g), // nem foglalasi oldal
    sor('2026-10-31T17:00:00Z', 'https://a76.hu/foglalas-ok/?booking_id=rovid', 'false', 'navigate', g), // ervenytelen minta
  ];
  const ki = egyediFoglalasok(docs, { tolMs: 0 });
  assert.deepEqual(ki, { '2026-10-31': { sorok: 5, egyedi_booking_id: 2, booking_id_nelkul: 2 } });
  assert.ok(!JSON.stringify(ki).includes(B1) && !JSON.stringify(ki).includes(B2));
});
