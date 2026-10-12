// MP Salonic-igazolas (lib/meres/igazolas.js, lanc.js igazolasErkezes, functions/api/mp-salonic-igazolas.js).
// Google-hivas NINCS (mock fetch); a D1-et a node:sqlite utanozza. A 27 eset a 2026-10-11-i valodi, merheto foglalasok
// anonim adatai (D1-kulcs, munkatars, kezdes, a Salonic-level ideje es "Uj paciens" jelzese; vendegadat nincs benne).
//   node --test tools/test-mp-igazolas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { googleIdo, _tokenTorles } from '../lib/meres/google-ads.js';
import { foglalasErkezes, igazolasErkezes, _semaTorles, IGAZOLAS_HATARIDO } from '../lib/meres/lanc.js';
import { levelErtelmezes, budapestUnix } from '../lib/meres/igazolas.js';
import { onRequest } from '../functions/api/mp-salonic-igazolas.js';

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
function mockFetch() {
  const hivasok = [];
  const f = async (url, o = {}) => {
    hivasok.push({ url: String(url), o });
    if (String(url).startsWith('https://oauth2.googleapis.com/')) return new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), { status: 200 });
    return new Response(JSON.stringify({ results: [{}] }), { status: 200 });
  };
  f.hivasok = hivasok;
  return f;
}
const API_ENV = { GOOGLE_ADS_DEVELOPER_TOKEN: 'dev', GOOGLE_ADS_CLIENT_ID: 'cid', GOOGLE_ADS_CLIENT_SECRET: 'cs', GOOGLE_ADS_REFRESH_TOKEN: 'rt' };
const TITOK = 'igazolas-TITOK';
const GCLID = 'Cj0KCQjwIGAZOLASgclid_0123456789';
const SUTI_IGEN = 'mp_suti=v1-s1-m1-t1791700000';
const SUTI_NEM = 'mp_suti=v1-s0-m0-t1791700000';
const unix = (iso) => Math.floor(Date.parse(iso) / 1000);
const FIX = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'mp-igazolas-2026-10-11.json'), 'utf8'));

const level = ({ munkatars, kezdes, ujPaciens, iso, id, felado = 'Medical Piercing <app@salonic.hu>', targy = 'Új online foglalás érkezett: 1 db Teszt Piercing' }) => ({
  from: felado, subject: targy, date: iso,
  body: `<p>Új online foglalás érkezett az alábbi adatokkal, melyet a rendszer automatikusan jóváhagyott:</p><p>Foglaló adatai:</p>${ujPaciens ? '<p>Új páciens - Még nem volt foglalása!</p>' : ''}<p>Név: Teszt Vendég</p><p>Mobiltelefonszám: 06301234567</p><p>E-mail cím: vendeg@pelda.hu</p><p>Időpont adatok:</p><p>Szolgáltatás: 1 db Teszt Piercing</p><p>Munkatárs: ${munkatars}</p><p>Kezdő dátum: ${kezdes}</p><a href="https://app.salonic.hu/backend/signin/?customer=medicalpiercing&amp;redirect=%2Fcalendar%2FshowBooking%2F%3FbookingId%3D${id}">Foglalás megtekintése</a>`,
});
const idFor = (kulcs) => 'a1b2c3d4-0000-4000-8000-' + kulcs.replace(/\D/g, '').slice(-12).padStart(12, '0');
const igKeres = (l, titok = TITOK) => new Request('https://www.medicalpiercing.hu/api/mp-salonic-igazolas', { method: 'POST', headers: { 'content-type': 'application/json', 'x-mp-igazolas': titok }, body: JSON.stringify(l) });
const kKeres = (x, { cookie } = {}) => {
  const [place, emp, start] = x.kulcs.split('|');
  const p = { placeId: place, employeeId: emp, startDate: start, price: String(x.ertek), first_booking: String(x.first) };
  if (x.motor) p.booking_id = 'mb_teszt' + start;
  const torzs = { ut: '/foglalas-ok', p, kattintas: x.gclid ? { gclid: { ertek: GCLID, ido: unix(x.level) - 600 } } : null };
  return new Request('https://www.medicalpiercing.hu/api/mp-foglalas', { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? (x.hozz ? SUTI_IGEN : SUTI_NEM) }, body: JSON.stringify(torzs) });
};
const uploads = (f) => f.hivasok.filter((h) => h.url.includes('uploadClickConversions')).map((h) => JSON.parse(h.o.body));

test('levelErtelmezes: valos formatum, nyari/teli ido, evvaltas; nem Salonic / nem MP / nem uj foglalas elutasitva', () => {
  const x = FIX[0];
  const l = levelErtelmezes(level({ ...x, iso: x.level, id: idFor(x.kulcs) }));
  assert.equal(l.ok, true); assert.equal(l.startUnix, Number(x.kulcs.split('|')[2])); assert.equal(l.ujPaciens, true);
  assert.deepEqual(l.employeeIds, ['19566']); assert.equal(l.erkezett, unix(x.level)); assert.equal(l.bookingId, idFor(x.kulcs));
  // teli ido (okt. 25. utan): +01:00
  assert.equal(budapestUnix(2026, 10, 30, 9, 10), 1793347800);
  assert.equal(budapestUnix(2026, 12, 16, 13, 0), 1797422400);
  // evvaltas: decemberi level, januari foglalas
  const ev = levelErtelmezes(level({ munkatars: 'Kovács Gabriella', kezdes: 'január 5. (kedd) 10:00', ujPaciens: false, iso: '2026-12-30T10:00:00Z', id: idFor('1') }));
  assert.equal(ev.startUnix, budapestUnix(2027, 1, 5, 10, 0));
  assert.equal(levelErtelmezes(level({ ...x, iso: x.level, id: idFor('2'), felado: 'Medical Piercing <app@salonic.hu.gonosz.com>' })).ok, false);
  assert.equal(levelErtelmezes(level({ ...x, iso: x.level, id: idFor('2'), felado: 'Gonosz <tamado@pelda.hu>' })).hiba, 'nem_salonic_felado');
  assert.equal(levelErtelmezes(level({ ...x, iso: x.level, id: idFor('2'), felado: '"A76 Móricz" <app@salonic.hu>' })).hiba, 'nem_mp_fiok');
  assert.equal(levelErtelmezes(level({ ...x, iso: x.level, id: idFor('2'), targy: 'Foglalás lemondás - Teszt' })).hiba, 'nem_uj_foglalas');
});

test('27 valodi foglalas (2026-10-11): mind igazolt, helyes uj-vendeg besorolas, a 4 vitatott ismeretlen; feltoltes csak igazolas utan', async () => {
  _semaTorles(); _tokenTorles();
  const db = d1(); const f = mockFetch();
  const env = { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: TITOK, ...API_ENV };
  // vegyesen: hol a level er elobb, hol a koszonooldal (Zapier-kesesek)
  for (const [i, x] of FIX.entries()) {
    const most = unix(x.level);
    const lv = () => igazolasErkezes({ request: igKeres(level({ ...x, iso: x.level, id: idFor(x.kulcs) })), env }, { fetchImpl: f, most: most + 60 });
    const ko = () => foglalasErkezes({ request: kKeres(x), env }, { fetchImpl: f, most: most + 5 });
    if (i % 2) { await lv(); await ko(); } else { await ko(); await lv(); }
  }
  const sorok = db._s.prepare('SELECT * FROM mp_foglalas ORDER BY kulcs').all();
  assert.equal(sorok.length, 27);
  for (const x of FIX) {
    const s = sorok.find((r) => r.kulcs === x.kulcs);
    assert.equal(s.igazolas, 'igazolt', x.kulcs);
    assert.equal(s.foglalas_ido, unix(x.level), 'konverzios ido = a foglalas (level) ideje: ' + x.kulcs);
    assert.equal(s.uj_vendeg_igazolt, x.ujPaciens ? 1 : null, x.kulcs);
  }
  // a 4 vitatott: a koszonooldal first_booking=true-t mondott, a Salonic nem "Uj paciens" -> ismeretlen (nem uj)
  for (const x of FIX.filter((v) => v.vitatott)) {
    const s = sorok.find((r) => r.kulcs === x.kulcs);
    assert.equal(s.uj_vendeg, 1); assert.equal(s.uj_vendeg_igazolt, null);
  }
  // azonos kezdes, mas munkatars (okt. 13. 11:00): a munkatars szerint helyesen parosodott
  assert.notEqual(sorok.find((r) => r.kulcs === '6029|13509|1791882000').igazolas_id, sorok.find((r) => r.kulcs === '10329|32224|1791882000').igazolas_id);
  // feltoltes: csak a 2 hozzajarulasos + gclid-es foglalasbol, a foglalas idejevel es a kulcs mint order_id
  const up = uploads(f).flatMap((t) => t.conversions);
  assert.deepEqual([...new Set(up.map((c) => c.orderId))].sort(), ['14144|30145|1792496400', '14145|19566|1793350200']);
  for (const c of up) {
    const x = FIX.find((v) => v.kulcs === c.orderId);
    assert.equal(c.conversionDateTime, googleIdo(unix(x.level)));
    assert.equal(c.gclid, GCLID);
    assert.ok(uploads(f).every((t) => t.validateOnly === true), 'dryrun / validateOnly');
  }
  assert.equal(up.length, 4, 'mindketto "Uj paciens": Foglalas + uj vendeg');
  // a vitatott, hozzajarulasos (gclid nelkuli) esetben sem ment "uj vendeg" akcio
  const naplo = db._s.prepare("SELECT akcio_id FROM mp_feltoltes WHERE kulcs = '14145|19566|1793347800'").all().map((r) => r.akcio_id);
  assert.deepEqual(naplo, ['7834926162']);
  // adatminimalizalas: az igazolas-tablaban nincs nev / telefon / e-mail / szolgaltatas
  const ig = JSON.stringify(db._s.prepare('SELECT * FROM mp_salonic_igazolas').all());
  for (const tilt of ['Teszt Vendég', '06301234567', 'vendeg@', 'Piercing', 'Kovács', 'Kamilli']) assert.ok(!ig.includes(tilt), tilt);
});

test('fantom / kesoi koszonooldal-ujranyitas: Salonic-level nelkul nincs feltoltes, 48 ora utan nem_igazolt', async () => {
  _semaTorles(); _tokenTorles();
  const db = d1(); const f = mockFetch();
  const env = { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: TITOK, ...API_ENV };
  const x = { kulcs: '12169|27569|1791795900', ertek: 24900, first: true, hozz: true, gclid: true, level: '2026-10-11T19:10:00Z' };
  const r = await (await foglalasErkezes({ request: kKeres(x), env }, { fetchImpl: f, most: unix(x.level) })).json();
  assert.deepEqual(r, { ok: true, uj: true });
  assert.equal(uploads(f).length, 0, 'igazolas nelkul semmi nem megy a Google-nek');
  assert.equal(db._s.prepare('SELECT COUNT(*) n FROM mp_feltoltes').get().n, 0);
  // egy kesobbi (masik) foglalas karbantartasa a lejart sort nem_igazolt-ra allitja
  await foglalasErkezes({ request: kKeres({ kulcs: '6029|13509|1792999800', ertek: 24900, first: true, hozz: false, level: x.level }), env }, { fetchImpl: f, most: unix(x.level) + IGAZOLAS_HATARIDO + 10 });
  assert.equal(db._s.prepare("SELECT igazolas FROM mp_foglalas WHERE kulcs = '12169|27569|1791795900'").get().igazolas, 'nem_igazolt');
  // ha ezutan megis jonne hozza level, mar nem parosodik (fail-closed)
  const kesve = await (await igazolasErkezes({ request: igKeres(level({ munkatars: 'Szulimán Nikoletta', kezdes: 'október 12. (hétfő) 11:05', ujPaciens: true, iso: '2026-10-13T20:00:00Z', id: idFor('kesve') })), env }, { fetchImpl: f, most: unix(x.level) + IGAZOLAS_HATARIDO + 20 })).json();
  assert.equal(kesve.igazolva, false);
  assert.equal(uploads(f).length, 0);
});

test('kesoi es duplikalt igazolas: a level utan EGY feltoltes; az ismetelt level / ujratoltes nem kuld ujra', async () => {
  _semaTorles(); _tokenTorles();
  const db = d1(); const f = mockFetch();
  const env = { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: TITOK, ...API_ENV };
  const x = FIX.find((v) => v.gclid && v.motor);
  const most = unix(x.level);
  await foglalasErkezes({ request: kKeres(x), env }, { fetchImpl: f, most });
  assert.equal(uploads(f).length, 0, 'a level elott meg nincs feltoltes');
  const l = level({ ...x, iso: x.level, id: idFor(x.kulcs) });
  const r1 = await (await igazolasErkezes({ request: igKeres(l), env }, { fetchImpl: f, most: most + 900 })).json();
  assert.deepEqual(r1, { ok: true, igazolva: true });
  assert.equal(uploads(f).length, 1);
  const r2 = await (await igazolasErkezes({ request: igKeres(l), env }, { fetchImpl: f, most: most + 1800 })).json();
  assert.equal(r2.ismetelt, true);
  await foglalasErkezes({ request: kKeres(x), env }, { fetchImpl: f, most: most + 2000 }); // koszonooldal ujratoltese
  assert.equal(uploads(f).length, 1, 'tovabbra is egy feltoltes');
  assert.equal(db._s.prepare('SELECT COUNT(*) n FROM mp_salonic_igazolas').get().n, 1);
});

test('vegpont: titok nelkul 404, rossz titokkal 403, GET 405; nem MP-s level 2xx de nem igazol', async () => {
  _semaTorles();
  const db = d1();
  const ctx = (req, env) => ({ request: req, env, waitUntil: () => {} });
  const x = FIX[0]; const l = level({ ...x, iso: x.level, id: idFor(x.kulcs) });
  assert.equal((await onRequest(ctx(igKeres(l), { MP_MERES_DB: db }))).status, 404);
  assert.equal((await onRequest(ctx(igKeres(l, 'rossz'), { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: TITOK }))).status, 403);
  assert.equal((await onRequest(ctx(new Request('https://www.medicalpiercing.hu/api/mp-salonic-igazolas'), { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: TITOK }))).status, 405);
  const a76 = await onRequest(ctx(igKeres(level({ ...x, iso: x.level, id: idFor('a76'), felado: '"A76 Móricz" <app@salonic.hu>' })), { MP_MERES_DB: db, MP_IGAZOLAS_TITOK: TITOK }));
  assert.equal(a76.status, 200); assert.deepEqual(await a76.json(), { ok: true, igazolva: false, hiba: 'nem_mp_fiok' });
});

test('elkulonites: az igazolas-kod nem importal a Mosaic kodjabol', () => {
  const gyoker = path.resolve(import.meta.dirname, '..');
  for (const f of ['lib/meres/igazolas.js', 'functions/api/mp-salonic-igazolas.js']) {
    const s = fs.readFileSync(path.join(gyoker, f), 'utf8');
    for (const m of s.matchAll(/from\s+'([^']+)'/g)) assert.ok(!m[1].includes('netlify') && !/^\.\.\/\.\.\/\.\.\//.test(m[1]), f + ': ' + m[1]);
  }
});

test('titok a D1-ben (SHA-256 lenyomat): jo titokkal igazol, rosszal 403, lenyomat nelkul 404', async () => {
  _semaTorles();
  const db = d1(); const f = mockFetch();
  const env = { MP_MERES_DB: db, ...API_ENV };
  const x = FIX[0]; const l = level({ ...x, iso: x.level, id: idFor(x.kulcs) });
  assert.equal((await igazolasErkezes({ request: igKeres(l), env }, { fetchImpl: f, most: unix(x.level) })).status, 404);
  const { createHash } = await import('node:crypto');
  db._s.exec('CREATE TABLE IF NOT EXISTS mp_beallitas (kulcs TEXT PRIMARY KEY, ertek TEXT)');
  db._s.prepare("INSERT INTO mp_beallitas VALUES ('igazolas_titok_sha256', ?)").run(createHash('sha256').update(TITOK).digest('hex'));
  assert.equal((await igazolasErkezes({ request: igKeres(l, 'rossz'), env }, { fetchImpl: f, most: unix(x.level) })).status, 403);
  const elo = new Request('https://claude-mp-salonic-igazolas.medicalpiercing.pages.dev/api/mp-salonic-igazolas', { method: 'POST', headers: { 'content-type': 'application/json', 'x-mp-igazolas': TITOK }, body: JSON.stringify(l) });
  assert.equal((await igazolasErkezes({ request: elo, env }, { fetchImpl: f, most: unix(x.level) })).status, 404, 'elonezeten a D1-lenyomat nem ervenyes');
  const jo = await igazolasErkezes({ request: igKeres(l), env }, { fetchImpl: f, most: unix(x.level) });
  assert.equal(jo.status, 200);
  assert.equal((await jo.json()).ok, true);
});
