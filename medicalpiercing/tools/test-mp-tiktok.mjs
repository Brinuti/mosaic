// MP TikTok Events API "Schedule" - CSAK NAPLO (lib/meres/tiktok.js, lib/meres/lanc.js). Kulso hivas NINCS: minden fetch
// egy szamlalo mock; a D1-et a node:sqlite utanozza.
//   node --test tools/test-mp-tiktok.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { tiktokTorzs, tiktokLepes, tiktokMod, hatalyosMod, jogosult, maszkoltTorzs, TIKTOK_VEGPONT, TIKTOK_PIXEL, TIKTOK_ABLAK } from '../lib/meres/tiktok.js';
import { foglalasErkezes, igazolasErkezes, _semaTorles } from '../lib/meres/lanc.js';
import { riport } from '../lib/meres/riport.js';
import { SEMLEGES_URL } from '../lib/meres/meres.js';

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
const HOST = 'www.medicalpiercing.hu';
const TTCLID = 'E.C.P.TESZTttclid_0123456789';
const TTP = '2TESZTttp-abcdef_123';
const KULCS = '12169|555|1791800000';
function szamlalo(valasz = { code: 0, message: 'OK' }) {
  const hivasok = [];
  const f = async (url, o = {}) => { hivasok.push({ url: String(url), o }); return new Response(JSON.stringify(valasz), { status: 200 }); };
  f.hivasok = hivasok;
  return f;
}
const alapSor = (x = {}) => ({
  kulcs: KULCS, kornyezet: 'eles', igazolas: 'igazolt', hozzajarulas_hirdetes: 1, letrehozva: MOST - 600, foglalas_ido: MOST - 900,
  ertek: 24900, uj_vendeg: 1, helyszin: 'szeged', tiktok_ttclid: TTCLID, tiktok_ttp: TTP, tiktok_kattintas_ido: MOST - 3600,
  meta_fbc: 'fb.1.1.IwARxxxxxxxx', kattintas_ertek: 'Cj0gclid', onbevallas: 'tiktok', forras_platform: 'tiktok', ...x,
});
const ujDb = async (mod) => {
  const db = d1();
  await db.prepare('CREATE TABLE IF NOT EXISTS mp_beallitas (kulcs TEXT PRIMARY KEY, ertek TEXT)').run();
  if (mod !== undefined) await db.prepare('INSERT INTO mp_beallitas VALUES (?, ?)').bind('tiktok_mod', mod).run();
  return db;
};
const naploSorok = (db) => db.prepare('SELECT * FROM mp_tiktok_feltoltes').all().then((r) => r.results);

test('torzs: Events API 2.0 forma; user csak ttclid + ttp; semleges URL; ertek csak ha ismert', () => {
  const t = tiktokTorzs(alapSor());
  assert.equal(t.event_source, 'web');
  assert.equal(t.event_source_id, TIKTOK_PIXEL);
  assert.equal(t.data.length, 1);
  const e = t.data[0];
  assert.deepEqual(Object.keys(e).sort(), ['event', 'event_id', 'event_time', 'page', 'properties', 'user']);
  assert.equal(e.event, 'SubmitForm'); // Feri dontese 2026-10-13: Leads -> Submit form, a koszonooldali bongeszos esemennyel azonos event_id
  assert.equal(e.event_time, MOST - 900, 'a foglalas (Salonic-level) ideje');
  assert.equal(e.event_id, `Foglalas:${KULCS}`, 'ugyanaz, mint a bongeszo deduplikacios azonositoja');
  assert.deepEqual(e.user, { ttclid: TTCLID, ttp: TTP });
  assert.deepEqual(e.page, { url: SEMLEGES_URL });
  assert.deepEqual(e.properties, { currency: 'HUF', value: 24900 });
  assert.equal(TIKTOK_VEGPONT, 'https://business-api.tiktok.com/open_api/v1.3/event/track/');
  // ttp nelkul / ertek nelkul
  const t2 = tiktokTorzs(alapSor({ tiktok_ttp: null, ertek: null }));
  assert.deepEqual(t2.data[0].user, { ttclid: TTCLID });
  assert.ok(!('properties' in t2.data[0]), 'ismeretlen ertek: nincs properties (nem 0 Ft)');
  assert.equal(tiktokTorzs(alapSor({ foglalas_ido: null })).data[0].event_time, MOST - 600, 'tartalek: koszonooldali rogzites');
});

test('torzs: nincs PII / egeszsegugyi / helyszin / szolgaltatas adat', () => {
  const s = JSON.stringify(tiktokTorzs(alapSor({ email: 'v@x.hu', telefon: '06301234567', szolgaltatas: 'Migren piercing', tipus: 'migren', kategoria: 'egeszseg' })));
  for (const tilos of ['email', 'phone', 'external_id', 'v@x.hu', '0630', 'migr', 'egeszseg', 'szeged', 'helyszin', 'content', 'uj_vendeg', 'tiktok', 'fb.1', 'Cj0gclid', 'user_agent', 'foglalas-ok-'])
    assert.ok(!s.toLowerCase().includes(tilos), tilos);
  assert.ok(!/"ip"|"user_agent"|"email"|"phone"|"external_id"|"contents?"|"content_(type|category|name|id)"/.test(s));
});

test('vedohalo: erzekeny nem-azonosito mezo -> dob; tiktokLepes semmit nem rogzit', async () => {
  assert.throws(() => tiktokTorzs(alapSor({ kulcs: 'migren|1|2' })), /erzekeny/);
  const db = await ujDb();
  const f = szamlalo();
  const r = await tiktokLepes(db, alapSor({ kulcs: 'klimax|1|2' }), {}, HOST, { fetchImpl: f, most: MOST });
  assert.equal(r.kihagyva, 'erzekeny_adat');
  // 2026-10-20: kihagyas-naplo - csak az ok, payload nelkul
  const ns = await naploSorok(db);
  assert.equal(ns.length, 1); assert.equal(ns[0].allapot, 'kihagyva:erzekeny_adat'); assert.equal(ns[0].payload_maszkolt, null);
  assert.equal(f.hivasok.length, 0);
  // a ttclid maga lehet barmilyen veletlen sor (azonosito, nem ellenorizzuk tartalomra)
  assert.doesNotThrow(() => tiktokTorzs(alapSor({ tiktok_ttclid: 'abcmajlepxyz12' })));
});

test('jogosultsag: eles + igazolt + hozzajarulas + ttclid + 7 napos ablak', () => {
  assert.deepEqual(jogosult(alapSor(), MOST), { ok: true });
  assert.equal(jogosult(alapSor({ tiktok_ttp: null }), MOST).ok, true, 'ttp nem kotelezo');
  assert.equal(jogosult(alapSor({ kornyezet: 'elonezet' }), MOST).miert, 'nem_eles');
  assert.equal(jogosult(alapSor({ igazolas: null }), MOST).miert, 'nem_igazolt');
  assert.equal(jogosult(alapSor({ igazolas: 'nem_igazolt' }), MOST).miert, 'nem_igazolt');
  assert.equal(jogosult(alapSor({ hozzajarulas_hirdetes: 0 }), MOST).miert, 'nincs_hozzajarulas');
  assert.equal(jogosult(alapSor({ tiktok_ttclid: null, tiktok_ttp: null }), MOST).ok, true); // 2026-10-19: IP/UA/external_id is azonosit
  assert.equal(jogosult(alapSor({ tiktok_ttclid: null }), MOST).ok, true); // _ttp eleg
  assert.equal(jogosult(alapSor({ foglalas_ido: MOST - TIKTOK_ABLAK - 1 }), MOST).miert, 'ablakon_kivul');
  assert.equal(jogosult(alapSor({ foglalas_ido: MOST - TIKTOK_ABLAK + 60 }), MOST).ok, true);
  assert.equal(jogosult(alapSor({ tiktok_kattintas_ido: MOST - 900 - TIKTOK_ABLAK - 1 }), MOST).miert, 'kattintas_ablakon_kivul');
});

test('mod: alapertelmezes naplo; ki / eles; eles csak token + eles hoszt mellett', async () => {
  assert.equal(await tiktokMod(await ujDb()), 'naplo');
  assert.equal(await tiktokMod(d1()), 'naplo', 'nincs mp_beallitas tabla');
  assert.equal(await tiktokMod(await ujDb('ki')), 'ki');
  assert.equal(await tiktokMod(await ujDb('valami')), 'naplo');
  assert.equal(await tiktokMod(await ujDb('ELES')), 'eles');
  assert.equal(hatalyosMod('eles', {}, HOST), 'naplo', 'token nelkul naplo');
  assert.equal(hatalyosMod('eles', { TIKTOK_EVENTS_TOKEN: 't' }, 'x.pages.dev'), 'naplo', 'elonezeti hoszt');
  assert.equal(hatalyosMod('naplo', { TIKTOK_EVENTS_TOKEN: 't' }, HOST), 'naplo', 'token onmagaban nem elesit');
  assert.equal(hatalyosMod('eles', { TIKTOK_EVENTS_TOKEN: 't' }, HOST), 'eles');
});

test('naplo mod: maszkolt torzs a tablaba, halozati hivas NINCS (token mellett sem)', async () => {
  for (const [mod, env] of [[undefined, {}], ['naplo', { TIKTOK_EVENTS_TOKEN: 'tok-TITOK' }], ['eles', {}]]) {
    const db = await ujDb(mod);
    const f = szamlalo();
    const r = await tiktokLepes(db, alapSor(), env, HOST, { fetchImpl: f, most: MOST });
    assert.deepEqual(r, { allapot: 'naplozva', mod: 'naplo' }, String(mod));
    assert.equal(f.hivasok.length, 0, `nincs fetch (${mod})`);
    const [s] = await naploSorok(db);
    assert.equal(s.kulcs, KULCS); assert.equal(s.mod, 'naplo'); assert.equal(s.allapot, 'naplozva'); assert.equal(s.ido, MOST);
    assert.ok(!s.payload_maszkolt.includes(TTCLID) && !s.payload_maszkolt.includes(TTP), 'nyers azonosito nincs a naploban');
    const p = JSON.parse(s.payload_maszkolt);
    assert.match(p.data[0].user.ttclid, /^h:[0-9a-f]{8}$/); assert.match(p.data[0].user.ttp, /^h:[0-9a-f]{8}$/);
    assert.equal(p.data[0].event_id, `Foglalas:${KULCS}`);
  }
});

test('ki mod: semmi nem rogzul, nincs fetch; nem jogosult sor: nincs rogzites', async () => {
  const db = await ujDb('ki');
  const f = szamlalo();
  assert.deepEqual(await tiktokLepes(db, alapSor(), { TIKTOK_EVENTS_TOKEN: 't' }, HOST, { fetchImpl: f, most: MOST }), { kihagyva: 'ki' });
  assert.equal((await naploSorok(db)).length, 0); assert.equal(f.hivasok.length, 0);
  const db2 = await ujDb();
  assert.deepEqual(await tiktokLepes(db2, alapSor({ hozzajarulas_hirdetes: 0 }), {}, HOST, { fetchImpl: f, most: MOST }), { kihagyva: 'nincs_hozzajarulas' });
  assert.equal(f.hivasok.length, 0);
});

test('idempotencia: ugyanaz a kulcs egyszer; eles modban csak a hiba probalhato ujra', async () => {
  const db = await ujDb();
  const f = szamlalo();
  await tiktokLepes(db, alapSor(), {}, HOST, { fetchImpl: f, most: MOST });
  assert.deepEqual(await tiktokLepes(db, alapSor(), {}, HOST, { fetchImpl: f, most: MOST + 60 }), { kihagyva: 'mar_rogzitve' });
  assert.equal((await naploSorok(db)).length, 1);
  assert.equal((await naploSorok(db))[0].ido, MOST, 'nem irodik felul');
  // naplozott kulcs elesre kapcsolas utan sem megy ki utolag
  await db.prepare("INSERT INTO mp_beallitas VALUES ('tiktok_mod', 'eles')").run();
  assert.deepEqual(await tiktokLepes(db, alapSor(), { TIKTOK_EVENTS_TOKEN: 'tok' }, HOST, { fetchImpl: f, most: MOST + 120 }), { kihagyva: 'mar_rogzitve' });
  assert.equal(f.hivasok.length, 0);
});

test('eles ag (csak tesztben): Access-Token fejlec, valasz kitakarva; hiba ujraprobalhato, elkuldott nem', async () => {
  const db = await ujDb('eles');
  const rossz = szamlalo({ code: 40001, message: `rossz ${TTCLID}` });
  const env = { TIKTOK_EVENTS_TOKEN: 'tok-TITOK' };
  assert.deepEqual(await tiktokLepes(db, alapSor(), env, HOST, { fetchImpl: rossz, most: MOST }), { allapot: 'hiba', mod: 'eles' });
  assert.equal(rossz.hivasok[0].url, TIKTOK_VEGPONT);
  assert.equal(rossz.hivasok[0].o.headers['Access-Token'], 'tok-TITOK');
  assert.equal(JSON.parse(rossz.hivasok[0].o.body).data[0].user.ttclid, TTCLID, 'a TikTok a nyers ttclid-t kapja');
  assert.ok(!JSON.stringify(await naploSorok(db)).includes(TTCLID));
  const jo = szamlalo();
  assert.deepEqual(await tiktokLepes(db, alapSor(), env, HOST, { fetchImpl: jo, most: MOST + 60 }), { allapot: 'elkuldve', mod: 'eles' });
  assert.deepEqual(await tiktokLepes(db, alapSor(), env, HOST, { fetchImpl: jo, most: MOST + 120 }), { kihagyva: 'mar_rogzitve' });
  assert.equal(jo.hivasok.length, 1);
});

test('maszkoltTorzs: az eredeti torzset nem modositja', async () => {
  const t = tiktokTorzs(alapSor());
  const m = await maszkoltTorzs(t);
  assert.equal(t.data[0].user.ttclid, TTCLID);
  assert.notEqual(m.data[0].user.ttclid, TTCLID);
});

// ---- lanc: mindket sorrend (koszonooldal elobb / Salonic-level elobb), a Google-folyamat erintetlen ----
const BURL = 'https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=12169&serviceId=9001&employeeId=555&startDate=1791800000';
const HO = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
function salonicLevel(start = 1791800000, datum = MOST - 30) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hourCycle: 'h23', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(start * 1000)).map((x) => [x.type, x.value]));
  const id = 'aaaaaaaa-bbbb-cccc-dddd-' + String(start).padStart(12, '0');
  const body = `Új online foglalás érkezett: 1 db Teszt Piercing Új online foglalás érkezett az alábbi adatokkal:Foglaló adatai:Új páciens - Még nem volt foglalása!Név: Teszt Vendég Mobiltelefonszám: 06301234567 E-mail cím: v@x.hu Időpont adatok:Szolgáltatás: 1 db Teszt Piercing Munkatárs: Teszt Munkatars Kezdő dátum: ${HO[+p.month - 1]} ${+p.day}. (hétfő) ${p.hour}:${p.minute} Foglalás megtekintése <a href="https://app.salonic.hu/backend/signin/?customer=medicalpiercing&redirect=%2Fcalendar%2FshowBooking%2F%3FbookingId%3D${id}">x</a>`;
  return { from: 'Medical Piercing <app@salonic.hu>', subject: 'Új online foglalás érkezett: 1 db Teszt Piercing', body, date: new Date(datum * 1000).toISOString() };
}
const foglalKeres = (cookie) => new Request(`https://${HOST}/api/mp-foglalas`, { method: 'POST', headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ ut: '/foglalas-ok-mi', p: { bookingUrl: BURL, price: '24900', first_booking: 'true' }, forras_platform: 'tiktok', kattintas: { ttclid: { ertek: TTCLID, ido: MOST - 1800 } } }) });
const igKeres = () => new Request(`https://${HOST}/api/mp-salonic-igazolas`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mp-igazolas': 'ig-TITOK' }, body: JSON.stringify(salonicLevel()) });

for (const sorrend of ['koszonooldal_elobb', 'salonic_elobb']) {
  test(`lanc (${sorrend}): igazolas utan 1 naplosor, TikTok-hivas nincs, Google-feltoltes ugyanugy fut`, async () => {
    _semaTorles();
    const db = d1();
    const env = { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: 'ig-TITOK', MP_GADS_MOD: 'validate', TIKTOK_EVENTS_TOKEN: 'tok-TITOK' };
    const hivasok = [];
    const f = async (url, o) => { hivasok.push(String(url)); return new Response('{"results":[{}]}', { status: 200 }); };
    const cookie = `mp_suti=v1-s1-m1-t${MOST}; _ttp=${TTP}`;
    if (sorrend === 'koszonooldal_elobb') {
      await foglalasErkezes({ request: foglalKeres(cookie), env }, { fetchImpl: f, most: MOST });
      assert.equal((await naploSorok(db)).length, 0, 'igazolas elott nincs naplosor');
      await igazolasErkezes({ request: igKeres(), env }, { fetchImpl: f, most: MOST + 30 });
    } else {
      await igazolasErkezes({ request: igKeres(), env }, { fetchImpl: f, most: MOST });
      await foglalasErkezes({ request: foglalKeres(cookie), env }, { fetchImpl: f, most: MOST + 30 });
    }
    const n = await naploSorok(db);
    assert.equal(n.length, 1);
    assert.equal(n[0].allapot, 'naplozva');
    assert.ok(!n[0].payload_maszkolt.includes(TTCLID));
    assert.ok(!hivasok.some((u) => u.includes('tiktok')), 'TikTok-hivas nincs');
    const g = await db.prepare('SELECT COUNT(*) AS db FROM mp_feltoltes').first();
    assert.ok(g.db >= 1, 'a Google-feltoltes naploja megvan');
    const r = await riport(db, MOST + 60, 7);
    assert.equal(r.sorok.reduce((a, s) => a + s.tiktok_naplo, 0), 1, 'riport: tiktok_naplo');
    assert.ok('d1_igazolt' in r.sorok[0] && 'ads_all' in r.sorok[0], 'meglevo mezok maradnak');
  });
}

test('lanc: hozzajarulas nelkul nincs ttclid -> nincs naplosor; a TikTok hibaja a Google-t nem allitja meg', async () => {
  _semaTorles();
  const db = d1();
  const env = { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: 'ig-TITOK', MP_GADS_MOD: 'validate' };
  const f = async () => new Response('{"results":[{}]}', { status: 200 });
  await foglalasErkezes({ request: foglalKeres(`mp_suti=v1-s0-m0-t${MOST}`), env }, { fetchImpl: f, most: MOST });
  const v = await (await igazolasErkezes({ request: igKeres(), env }, { fetchImpl: f, most: MOST + 30 })).json();
  assert.equal(v.igazolva, true);
  // 2026-10-20: nincs kuldes / naplozott torzs, csak a kihagyas oka
  assert.deepEqual((await naploSorok(db)).map((x) => [x.allapot, x.payload_maszkolt]), [['kihagyva:nincs_hozzajarulas', null]]);
  // eltort TikTok-tabla: a lepes elnyeli a hibat
  const rossz = { prepare: () => { throw new Error('db hiba'); } };
  assert.deepEqual(await tiktokLepes(rossz, alapSor(), {}, HOST, { most: MOST }), { kihagyva: 'hiba' });
});

test('lanc: kesoi hozzajarulas (potlas) mar igazolt soron -> 1 naplosor, fetch nincs', async () => {
  _semaTorles();
  const db = d1();
  const env = { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: 'ig-TITOK', MP_GADS_MOD: 'validate' };
  const hivasok = [];
  const f = async (url) => { hivasok.push(String(url)); return new Response('{"results":[{}]}', { status: 200 }); };
  await foglalasErkezes({ request: foglalKeres(`mp_suti=v1-s0-m0-t${MOST}`), env }, { fetchImpl: f, most: MOST });
  await igazolasErkezes({ request: igKeres(), env }, { fetchImpl: f, most: MOST + 30 });
  assert.deepEqual((await naploSorok(db)).map((x) => x.allapot), ['kihagyva:nincs_hozzajarulas']);
  const potlo = new Request(`https://${HOST}/api/mp-foglalas`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `mp_suti=v1-s1-m1-t${MOST}` },
    body: JSON.stringify({ ut: '/foglalas-ok-mi', p: { bookingUrl: BURL, price: '24900', first_booking: 'true' }, potlas: true, kattintas: { ttclid: { ertek: TTCLID, ido: MOST - 1800 } } }) });
  const v = await (await foglalasErkezes({ request: potlo, env }, { fetchImpl: f, most: MOST + 60 })).json();
  assert.equal(v.potolva, true);
  const n = await naploSorok(db);
  assert.equal(n.length, 1); assert.equal(n[0].allapot, 'naplozva', 'a kihagyva-sort a kesobbi naplozas felulirja');
  assert.ok(!hivasok.some((u) => u.includes('tiktok')));
});

// Feri 2026-10-19: IP + user agent a foglalas pillanatabol (mp_kontextus); egeszsegugyi / szemelyes adat tovabbra sem
{
  const { tiktokTorzs } = await import('../lib/meres/tiktok.js');
  const t2 = tiktokTorzs({ kulcs: '1|2|3', ertek: 24900, letrehozva: 1792300000, tiktok_ttclid: 'E.C.P.abcdefgh' }, { ip: '84.1.2.3', ua: 'Mozilla/5.0 teszt' });
  assert.equal(t2.data[0].user.ip, '84.1.2.3');
  assert.equal(t2.data[0].user.user_agent, 'Mozilla/5.0 teszt');
  const t3 = tiktokTorzs({ kulcs: '1|2|3', ertek: 24900, letrehozva: 1792300000, tiktok_ttclid: 'E.C.P.abcdefgh' }, { ip: 'nem-ip<script>', ua: null });
  assert.ok(!('ip' in t3.data[0].user) && !('user_agent' in t3.data[0].user));
  assert.ok(!/"email"|"phone"|"external_id"/.test(JSON.stringify(t2)));
  console.log('OK ip + user agent (kontextus)');
}

{
  const { tiktokTorzs } = await import('../lib/meres/tiktok.js');
  const h = 'b'.repeat(64);
  const t4 = tiktokTorzs({ kulcs: '1|2|3', ertek: 24900, letrehozva: 1792300000, tiktok_ttclid: 'E.C.P.abcdefgh' }, { ip: '84.1.2.3', ua: 'UA', ext: h });
  assert.equal(t4.data[0].user.external_id, h);
  assert.ok(!('external_id' in tiktokTorzs({ kulcs: '1|2|3', letrehozva: 1792300000 }, { ext: 'nem-hash' }).data[0].user));
  console.log('OK external_id (tiktok)');
}

{
  const { tiktokTorzs, maszkoltTorzs } = await import('../lib/meres/tiktok.js');
  const sor = { kulcs: '1|2|3', ertek: 24900, letrehozva: 1792300000, tiktok_ttclid: 'E.C.P.abcdefgh' };
  assert.equal(tiktokTorzs(sor).data.length, 1);
  const t5 = tiktokTorzs(sor, { ip: '84.1.2.3', ua: 'UA' }, { schedule: true });
  assert.deepEqual(t5.data.map((d) => d.event), ['SubmitForm', 'Schedule']);
  assert.equal(t5.data[0].event_id, t5.data[1].event_id);
  assert.equal(t5.data[1].event_id, 'Foglalas:1|2|3');
  assert.equal(t5.data[1].user.ttclid, 'E.C.P.abcdefgh');
  const m = await maszkoltTorzs(t5);
  assert.ok(m.data.every((d) => String(d.user.ttclid).startsWith('h:')));
  console.log('OK kodos Schedule (azonos event_id)');
}

// 2026-10-20: kihagyas-naplo a TikTok-agban is
test('azonosito nelkul -> kihagyva:nincs_azonosito naplozva (payload nelkul); kesobb ttclid-del a naplozas felulirja', async () => {
  const db = await ujDb();
  const f = szamlalo();
  const r1 = await tiktokLepes(db, alapSor({ tiktok_ttclid: null, tiktok_ttp: null }), {}, HOST, { fetchImpl: f, most: MOST });
  assert.deepEqual(r1, { kihagyva: 'nincs_azonosito' });
  let n = await naploSorok(db);
  assert.equal(n.length, 1); assert.equal(n[0].allapot, 'kihagyva:nincs_azonosito'); assert.equal(n[0].payload_maszkolt, null); assert.equal(n[0].mod, 'naplo');
  const r2 = await tiktokLepes(db, alapSor(), {}, HOST, { fetchImpl: f, most: MOST + 60 });
  assert.equal(r2.allapot, 'naplozva');
  n = await naploSorok(db);
  assert.equal(n.length, 1); assert.equal(n[0].allapot, 'naplozva'); assert.equal(n[0].ido, MOST + 60);
  assert.ok(!/"em"|"ph"|"fn"|"ln"|"email"|"phone"/.test(n[0].payload_maszkolt));
  // a naplozott sort egy kesobbi kihagyas nem irja felul
  assert.deepEqual(await tiktokLepes(db, alapSor({ hozzajarulas_hirdetes: 0 }), {}, HOST, { fetchImpl: f, most: MOST + 120 }), { kihagyva: 'mar_rogzitve' });
  assert.equal((await naploSorok(db))[0].allapot, 'naplozva');
  assert.equal(f.hivasok.length, 0);
});

test('nem eles kornyezet / ki mod: nincs kihagyas-sor', async () => {
  const db = await ujDb();
  assert.deepEqual(await tiktokLepes(db, alapSor({ kornyezet: 'elonezet' }), {}, HOST, { most: MOST }), { kihagyva: 'nem_eles' });
  assert.equal((await naploSorok(db).catch(() => [])).length, 0);
});

// ---- 2026-10-24: igazolatlan Salonic-forrasu foglalas -> kihagyva:nem_igazolt naplosor (csak naplo, kuldes nem valtozik) ----
{
  const { nemIgazoltNaplo, NAPLO_KORLAT } = await import('../lib/meres/lanc.js');
  const sorBeszur = async (db, o) => {
    const x = { kulcs: KULCS, salonic_id: null, forras: 'salonic', kornyezet: 'eles', letrehozva: MOST - 3 * 86400, igazolas: null, hozzajarulas_dontott: 1, hozzajarulas_hirdetes: 1, hozzajarulas_analitika: 1, tipus: 'migren', ...o };
    const oszl = Object.keys(x);
    await db.prepare(`INSERT INTO mp_foglalas (${oszl.join(',')}) VALUES (${oszl.map(() => '?').join(',')})`).bind(...oszl.map((k) => x[k])).run();
  };
  const alap = async (mod) => { _semaTorles(); const db = await ujDb(mod); const { semaBiztos } = await import('../lib/meres/lanc.js'); await semaBiztos(db); return db; };
  const f = (h) => async (url) => { h.push(String(url)); return new Response('{}', { status: 200 }); };

  test('nem_igazolt naplo: 48 ora utan igazolatlan Salonic-forrasu sor -> kihagyva:nem_igazolt (payload nelkul), fetch nincs, idempotens', async () => {
    const db = await alap(); const h = [];
    await sorBeszur(db, {});
    assert.deepEqual(await nemIgazoltNaplo(db, { TIKTOK_EVENTS_TOKEN: 't' }, HOST, { most: MOST, fetchImpl: f(h) }), { naplozva: 1 });
    assert.deepEqual((await naploSorok(db)).map((x) => [x.kulcs, x.allapot, x.payload_maszkolt, x.mod]), [[KULCS, 'kihagyva:nem_igazolt', null, 'naplo']]);
    assert.deepEqual(await nemIgazoltNaplo(db, {}, HOST, { most: MOST + 60, fetchImpl: f(h) }), { naplozva: 0 }); // idempotens
    assert.equal((await naploSorok(db)).length, 1); assert.equal(h.length, 0, 'halozati hivas nincs');
    // a sor igazolasa NEM valtozik (a karbantartas dolga), a mp_foglalas erintetlen
    assert.equal((await db.prepare('SELECT igazolas FROM mp_foglalas').first()).igazolas, null);
  });

  test('nem_igazolt naplo: mar nem_igazolt sor visszamenoleg is (14 nap), 48 oranal frissebb / motoros / igazolt / elonezet / 14 napnal regebbi sor nem', async () => {
    const db = await alap();
    await sorBeszur(db, { kulcs: 'k|regi|1', igazolas: 'nem_igazolt', letrehozva: MOST - 10 * 86400 });
    await sorBeszur(db, { kulcs: 'k|friss|2', letrehozva: MOST - 3600 });                       // meg a 48 oras ablakban
    await sorBeszur(db, { kulcs: 'k|motor|3', forras: 'motor', salonic_id: 'b1', igazolas: 'nem_igazolt' }); // nem Salonic-forrasu
    await sorBeszur(db, { kulcs: 'k|igazolt|4', igazolas: 'igazolt' });
    await sorBeszur(db, { kulcs: 'k|elonezet|5', kornyezet: 'elonezet', igazolas: 'nem_igazolt' });
    await sorBeszur(db, { kulcs: 'k|nagyonregi|6', igazolas: 'nem_igazolt', letrehozva: MOST - 20 * 86400 });
    assert.deepEqual(await nemIgazoltNaplo(db, {}, HOST, { most: MOST }), { naplozva: 1 });
    assert.deepEqual((await naploSorok(db)).map((x) => [x.kulcs, x.allapot]), [['k|regi|1', 'kihagyva:nem_igazolt']]);
  });

  test('D1-lekerdezesszam, TELJES foglalas-kerelem (foglalasErkezes) hatralekkal: Salonic-level nelkul <= 44 (a naplo fut), Salonic-levellel <= 50 (a naplo NEM fut, az igazolas-ag alapterhe ~48); a Cloudflare ingyenes csomag hivasonkenti korlatja 50', async () => {
    const meres = async (levellel) => {
      _semaTorles(); const db0 = d1();
      let n = 0;
      const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), run: () => { n += 1; return db0.prepare(sql).bind(...args).run(); }, first: () => { n += 1; return db0.prepare(sql).bind(...args).first(); }, all: () => { n += 1; return db0.prepare(sql).bind(...args).all(); } });
      const db = { prepare: (sql) => stmt(sql), batch: (l) => { n += l.length; return db0.batch(l); } };
      const env = { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: 'ig-TITOK', MP_GADS_MOD: 'validate', TIKTOK_EVENTS_TOKEN: 'tok-TITOK' };
      const h = [];
      const uj = (cookie, start) => new Request(`https://${HOST}/api/mp-foglalas`, { method: 'POST', headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ ut: '/foglalas-ok-mi', p: { price: '24900', first_booking: 'true', placeId: '12169', employeeId: '555', startDate: String(start) }, kattintas: { ttclid: { ertek: TTCLID, ido: MOST - 1800 } } }) });
      await foglalasErkezes({ request: uj(`mp_suti=v1-s1-m1-t${MOST}`, 1791900000), env }, { fetchImpl: f(h), most: MOST }); // sema + elso sor
      for (let i = 0; i < 10; i++) await sorBeszur(db0, { kulcs: `k|nem${i}`, letrehozva: MOST - 4 * 86400 + i });                                  // nem_igazolt hatralek
      const T = MOST + 86400 * 2;
      if (levellel) await db0.prepare("INSERT INTO mp_salonic_igazolas (booking_id, employee_ids, start_unix, uj_paciens, erkezett, rogzitve) VALUES ('B1','555',1791990000,0,?,?)").bind(T - 100, T - 100).run();
      n = 0;
      const r = await foglalasErkezes({ request: uj(`mp_suti=v1-s1-m1-t${T}`, 1791990000), env }, { fetchImpl: f(h), most: T });
      assert.equal(r.status, 200); assert.equal((await r.json()).uj, true, 'uj foglalas (nem duplikalt): a teljes lanc fut');
      assert.equal(h.filter((u) => u.includes('tiktok')).length, 0, 'TikTok-hivas nincs (a naplo nem kuld)');
      return n;
    };
    const nelkul = await meres(false), levellel = await meres(true);
    assert.ok(nelkul <= 44, `Salonic-level nelkul: ${nelkul} D1-lekerdezes`);
    assert.ok(levellel <= 50, `Salonic-levellel: ${levellel} D1-lekerdezes`);
  });

  test('nem_igazolt naplo: ki mod -> semmi; fulpiercing = divat_fulpiercing ok; kesobbi igazolas a kihagyva-sort felulirja (a kuldes folyamata valtozatlan)', async () => {
    const dbKi = await alap('ki'); await sorBeszur(dbKi, {});
    assert.deepEqual(await nemIgazoltNaplo(dbKi, {}, HOST, { most: MOST }), { naplozva: 0 });
    assert.equal((await dbKi.prepare('SELECT COUNT(*) AS n FROM mp_tiktok_feltoltes').first()).n, 0);
    const db = await alap(); await sorBeszur(db, { tipus: 'ful' });
    await nemIgazoltNaplo(db, {}, HOST, { most: MOST });
    assert.deepEqual((await naploSorok(db)).map((x) => x.allapot), ['kihagyva:divat_fulpiercing']);
    // kesobb igazolt + jogosult sor: a tiktokLepes a kihagyva-sort naplozva-ra irja (meglevo viselkedes)
    const db2 = await alap(); await sorBeszur(db2, {}); await nemIgazoltNaplo(db2, {}, HOST, { most: MOST });
    assert.deepEqual((await naploSorok(db2)).map((x) => x.allapot), ['kihagyva:nem_igazolt']);
    const r = await tiktokLepes(db2, alapSor({ kulcs: KULCS }), {}, HOST, { most: MOST + 120 });
    assert.equal(r.allapot, 'naplozva'); assert.deepEqual((await naploSorok(db2)).map((x) => x.allapot), ['naplozva']);
  });

  test('nem_igazolt naplo: foglalasErkezes vegig - az igazolatlan Salonic-forrasu sor a KOVETKEZO foglalas karbantartasakor naplozodik, a valasz es a Google-folyamat valtozatlan; hiba nem allitja meg', async () => {
    _semaTorles(); const db = d1();
    const env = { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: 'ig-TITOK', MP_GADS_MOD: 'validate' };
    const h = []; const fe = f(h);
    // 1. foglalas (booking_id nelkul = salonic-forras), 3 nappal kesobb a 2. foglalas karbantartasa
    const nelkul = () => new Request(`https://${HOST}/api/mp-foglalas`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `mp_suti=v1-s1-m1-t${MOST}` },
      body: JSON.stringify({ ut: '/foglalas-ok-mi', p: { price: '24900', first_booking: 'true', placeId: '12169', employeeId: '555', startDate: '1791900000' }, kattintas: { ttclid: { ertek: TTCLID, ido: MOST - 1800 } } }) });
    const a = await (await foglalasErkezes({ request: nelkul(), env }, { fetchImpl: fe, most: MOST })).json();
    assert.equal(a.uj, true); assert.equal((await naploSorok(db)).length, 0);
    await db.prepare("UPDATE mp_foglalas SET forras = 'salonic', salonic_id = NULL").run();
    const mp = await foglalasErkezes({ request: foglalKeres(`mp_suti=v1-s1-m1-t${MOST + 3 * 86400}`), env }, { fetchImpl: fe, most: MOST + 3 * 86400 });
    assert.equal(mp.status, 200);
    const n = await naploSorok(db);
    assert.ok(n.some((x) => x.allapot === 'kihagyva:nem_igazolt' && x.payload_maszkolt === null), 'az 1. foglalas naplozva');
    assert.equal(h.filter((u) => u.includes('tiktok')).length, 0, 'TikTok-hivas nincs');
    assert.equal((await db.prepare("SELECT igazolas FROM mp_foglalas ORDER BY letrehozva LIMIT 1").first()).igazolas, 'nem_igazolt', 'a karbantartas valtozatlanul nem_igazolt-ra allitja');
    // eltort naplo: a fuggveny nem dob
    const rossz = { prepare: () => { throw new Error('db hiba'); } };
    assert.deepEqual(await nemIgazoltNaplo(rossz, {}, HOST, { most: MOST }), { naplozva: 0 });
  });

  test('nem_igazolt naplo: hatralek eseten kerelmenkent legfeljebb NAPLO_KORLAT sor, a tobbi a kovetkezo kerelemben; igazolt/elkuldve sort nem ir felul', async () => {
    const db = await alap();
    for (let i = 0; i < 15; i += 1) await sorBeszur(db, { kulcs: `k|hatralek|${i}`, letrehozva: MOST - 3 * 86400 + i });
    let osszes = 0;
    for (let k = 0; k < 40; k += 1) { const r = await nemIgazoltNaplo(db, {}, HOST, { most: MOST + k }); assert.ok(r.naplozva <= NAPLO_KORLAT, 'kerelmenkent legfeljebb NAPLO_KORLAT'); osszes += r.naplozva; if (!r.naplozva) break; }
    assert.equal(osszes, 15, 'a hatralek kerelmenkent fogy, vegul mind naplozva');
    assert.deepEqual(await nemIgazoltNaplo(db, {}, HOST, { most: MOST + 100 }), { naplozva: 0 });
    // mar elkuldott / naplozott sort a nem_igazolt nem ir felul
    const db2 = await alap(); await sorBeszur(db2, {});
    await db2.prepare("INSERT INTO mp_tiktok_feltoltes (kulcs, mod, allapot, payload_maszkolt, ido) VALUES (?, 'naplo', 'elkuldve', NULL, ?)").bind(KULCS, MOST).run();
    assert.deepEqual(await nemIgazoltNaplo(db2, {}, HOST, { most: MOST + 5 }), { naplozva: 0 });
    assert.deepEqual((await naploSorok(db2)).map((x) => x.allapot), ['elkuldve']);
    // eles mod + token + eles host: 0 fetch, a sor kihagyva
    const dbE = await alap('eles'); await sorBeszur(dbE, {}); const h = [];
    await nemIgazoltNaplo(dbE, { TIKTOK_EVENTS_TOKEN: 'tok' }, HOST, { most: MOST, fetchImpl: f(h) });
    assert.equal(h.length, 0); assert.deepEqual((await naploSorok(dbE)).map((x) => [x.allapot, x.mod]), [['kihagyva:nem_igazolt', 'eles']]);
  });
}
