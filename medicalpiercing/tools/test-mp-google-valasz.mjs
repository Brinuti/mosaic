// MP Google ARNYEK feltoltes valasz-naplo (lib/meres/google-valasz.js, functions/api/mp-google-valasz.js). Kulso hivas NINCS; a D1-et a node:sqlite utanozza.
//   node --test tools/test-mp-google-valasz.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { googleValaszRogzit, googleValaszRiport, googleValaszVegpont, uzenetTisztit, VALASZ_SEMA } from '../lib/meres/google-valasz.js';
import { SEMA, _semaTorles } from '../lib/meres/lanc.js';
import { MP_GADS } from '../lib/meres/google-ads.js';

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
const AKCIO = MP_GADS.akciok.foglalas;
const AKCIO2 = MP_GADS.akciok.uj;
const KULCS = '12169|555|1791800000';
const KULCS2 = '12169|556|1791801000';
const KULCS3 = '12169|557|1791802000';
const TITOK = 'mp-google-valasz-teszt-kulcs-0123456789';
const TITOK_HASH = crypto.createHash('sha256').update(TITOK).digest('hex');
const ADMIN = 'admin-teszt-kulcs';
const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789';

async function vilag() {
  _semaTorles();
  const db = d1();
  for (const q of SEMA) await db.prepare(q).run(); // a valodi mp_feltoltes tabla (lanc.js SEMA)
  const feltolt = (kulcs, akcio, mod, allapot, ido = MOST - 60) => db._s.prepare('INSERT INTO mp_feltoltes (kulcs, akcio_id, mod, kuldo, allapot, http_status, ido) VALUES (?,?,?,?,?,?,?)').run(kulcs, akcio, mod, 'zapier', allapot, 200, ido);
  feltolt(KULCS, AKCIO, 'eles', 'elkuldve');
  feltolt(KULCS, AKCIO2, 'eles', 'elkuldve');
  feltolt(KULCS2, AKCIO, 'eles', 'elkuldve');
  feltolt(KULCS3, AKCIO, 'dryrun', 'elfogadva'); // proba: nem kap visszajelzest
  return { db, sql: (q, ...a) => db._s.prepare(q).all(...a).map((r) => ({ ...r })) };
}
const kerj = (torzs, fejlec = { 'x-mp-google-kulcs': TITOK }, method = 'POST', url = 'https://x.test/api/mp-google-valasz') =>
  new Request(url, { method, headers: fejlec, ...(method === 'GET' ? {} : { body: typeof torzs === 'string' ? torzs : JSON.stringify(torzs) }) });

test('rogzites: OK (kod ures) / reszleges hiba / elso visszajelzes marad / requestId megmarad', async () => {
  const w = await vilag();
  const r1 = await googleValaszRogzit(w.db, { order_id: KULCS, conversion_action_id: AKCIO, kod: '', request_id: 'abc-123_DEF', elfogadva: 1, elutasitva: 0 }, MOST);
  assert.deepEqual([r1.status, r1.body.ok, r1.body.rogzitve], [200, true, true]);
  const r2 = await googleValaszRogzit(w.db, { order_id: KULCS, conversion_action_id: AKCIO2, kod: 'UNPARSEABLE_GCLID', elfogadva: 0, elutasitva: 1, uzenet: 'requestId=abc123def gclid expired' }, MOST);
  assert.equal(r2.status, 200);
  const sorok = w.sql('SELECT akcio_id, kod, request_id, elfogadva, elutasitva, uzenet FROM mp_google_valasz ORDER BY akcio_id');
  assert.equal(sorok.length, 2);
  const ok = sorok.find((s) => s.akcio_id === AKCIO), hiba = sorok.find((s) => s.akcio_id === AKCIO2);
  assert.deepEqual([ok.kod, ok.request_id, ok.elfogadva, ok.elutasitva], ['', 'abc-123_DEF', 1, 0]);
  assert.deepEqual([hiba.kod, hiba.elfogadva, hiba.elutasitva], ['UNPARSEABLE_GCLID', 0, 1]);
  assert.match(hiba.uzenet, /gclid expired/); // a hasznos hibaszoveg megmarad
  // az elso visszajelzes marad (ujrajatszas / mas kod nem irja felul)
  const r3 = await googleValaszRogzit(w.db, { order_id: KULCS, conversion_action_id: AKCIO, kod: 'EXPIRED_EVENT' }, MOST + 5);
  assert.deepEqual([r3.status, r3.body.rogzitve, r3.body.mar_rogzitve], [200, false, true]);
  assert.equal(w.sql('SELECT kod FROM mp_google_valasz WHERE kulcs = ? AND akcio_id = ?', KULCS, AKCIO)[0].kod, '');
});

test('rogzites: a TAROLT uzenet maszkolt (nyers gclid / e-mail / hash nem kerul a tablaba); hibas request_id nem tarolodik', async () => {
  const w = await vilag();
  const nyers = `gclid=${GCLID} bela@example.com ${'ab'.repeat(32)} +36 30 123 4567 requestId=abc123def`;
  const r = await googleValaszRogzit(w.db, { order_id: KULCS, conversion_action_id: AKCIO, kod: 'UNPARSEABLE_GCLID', uzenet: nyers, request_id: 'rossz id!' }, MOST);
  assert.equal(r.status, 200);
  const sor = w.sql('SELECT uzenet, request_id FROM mp_google_valasz')[0];
  assert.ok(!sor.uzenet.includes(GCLID) && !sor.uzenet.includes('bela@example.com') && !sor.uzenet.includes('ab'.repeat(32)) && !sor.uzenet.includes('123 4567'), `tarolt uzenet: ${sor.uzenet}`);
  assert.match(sor.uzenet, /requestId=abc123def/);
  assert.equal(sor.request_id, null, 'hibas request_id nem tarolodik');
});
test('megorzes: a 120 napnal regebbi visszajelzes torlodik; a riport csak az eles, elkuldott feltoltest szamolja es az idoablakon belul', async () => {
  const w = await vilag();
  w.db._s.exec(VALASZ_SEMA);
  w.db._s.prepare('INSERT INTO mp_google_valasz (kulcs, akcio_id, kod, ido) VALUES (?,?,?,?)').run('regi|1|2', AKCIO, 'EXPIRED_EVENT', MOST - 121 * 86400);
  await googleValaszRogzit(w.db, { order_id: KULCS, conversion_action_id: AKCIO, kod: '' }, MOST);
  assert.deepEqual(w.sql('SELECT kulcs FROM mp_google_valasz').map((x) => x.kulcs), [KULCS], 'a regi sor torlodott');
  // riport: hiba-allapotu es idoablakon kivuli feltoltes nem szamit
  w.db._s.prepare('INSERT INTO mp_feltoltes (kulcs, akcio_id, mod, kuldo, allapot, http_status, ido) VALUES (?,?,?,?,?,?,?)').run('hiba|1|2', AKCIO, 'eles', 'zapier', 'hiba', 500, MOST - 60);
  w.db._s.prepare('INSERT INTO mp_feltoltes (kulcs, akcio_id, mod, kuldo, allapot, http_status, ido) VALUES (?,?,?,?,?,?,?)').run('regi|3|4', AKCIO, 'eles', 'zapier', 'elkuldve', 200, MOST - 30 * 86400);
  // ezekhez is van visszajelzes-kod: a hibakodok kozott sem szerepelhetnek (hiba-allapotu feltoltes; idoablakon kivuli feltoltes, de FRISS visszajelzes-sorral)
  const vsor = w.db._s.prepare('INSERT INTO mp_google_valasz (kulcs, akcio_id, kod, ido) VALUES (?,?,?,?)');
  vsor.run('hiba|1|2', AKCIO, 'HIBA_ALLAPOT_KOD', MOST - 30); vsor.run('regi|3|4', AKCIO, 'ABLAKON_KIVUL_KOD', MOST - 30);
  await googleValaszRogzit(w.db, { order_id: KULCS2, conversion_action_id: AKCIO, kod: 'EXPIRED_EVENT' }, MOST);
  const r = await googleValaszRiport(w.db, 7, MOST);
  assert.equal(r.osszes.elkuldve, 3, 'a hiba-allapotu es a 30 napos sor nincs benne');
  assert.deepEqual(r.hibakodok, [{ kod: 'EXPIRED_EVENT', db: 1 }], 'a hibakodok is csak az eles, elkuldott, idoablakon beluli feltoltesekre');
});
test('rogzites: hibas bemenet / ismeretlen sor / proba-sor / nem MP akcio', async () => {
  const w = await vilag();
  const r = (o) => googleValaszRogzit(w.db, o, MOST);
  assert.equal((await r(null)).status, 400);
  assert.equal((await r({ conversion_action_id: AKCIO, kod: '' })).status, 400, 'order_id kell');
  assert.equal((await r({ order_id: 'x'.repeat(130), conversion_action_id: AKCIO, kod: '' })).status, 400);
  assert.equal((await r({ order_id: KULCS, conversion_action_id: AKCIO, kod: 'kisbetu' })).status, 422);
  assert.equal((await r({ order_id: KULCS, conversion_action_id: '6088874770', kod: '' })).status, 422, 'a Mosaic fiok / nem MP akcio');
  assert.equal((await r({ order_id: KULCS, conversion_action_id: '7825199989', kod: '' })).status, 422, 'Mosaic ARNYEK akcio');
  assert.equal((await r({ order_id: '1|2|3', conversion_action_id: AKCIO, kod: '' })).status, 404, 'ismeretlen sor');
  assert.equal((await r({ order_id: KULCS3, conversion_action_id: AKCIO, kod: '' })).status, 404, 'a dryrun sor nem kap visszajelzest');
  assert.equal(w.sql('SELECT COUNT(*) AS n FROM mp_google_valasz')[0].n, 0, 'semmi nem keletkezett');
});

test('uzenet-maszkolas: a kattintasazonosito MINDEN alakban kimarad; a hasznos szoveg megmarad', async () => {
  const CK = 'EAIaIQobChMIjP2zq9v8gAMV0QZ_AB1x7wO3EAAYASAAEgK-3fD_BwE';
  const BR = '0AAAAADcFKiYuh-Hh4gV1YtkWbg_SVNJ9';
  const alakok = [
    `hiba gbraid "${BR}" nem ertelmezheto`, `{"gclid":"${CK}","x":1}`, `{'wbraid': '${BR}'}`, `googleClickId: ${CK}`, `google_click_id=${CK}`,
    `UNPARSEABLE_GCLID ${CK}`, `https://x.test/?a=1&gclid%3D${CK}&b=2`, `gclid%22%3A%22${CK}%22`, `invalid click ${CK} for order`, `ALLAPOT ${BR}${BR}`,
    `kapcsolat: teszt.vendeg@example.com ${'a'.repeat(64)} +36 30 123 4567`,
    '+36 (30) 123-4567', '06/30/123-4567', '0630/1234567', '+36.30.123.4567', '(06-30) 123-4567', '06 30 / 123 45 67', '%2B36%2030%20123%204567',
    'bela%40gmail.com', 'email=bela%40gmail.com', '\u0151@gmail.com', 'info@p\u00e9lda.hu', '"kis bela"@example.com', 'kov\u00e1cs.b\u00e9la@gmail.com',
    `em_${'ab12'.repeat(16)}`, `x${'cd34'.repeat(16)}`,
  ];
  for (const u of alakok) {
    const v = uzenetTisztit(u);
    assert.ok(!v.includes(CK) && !v.includes(BR) && !v.includes(CK.slice(0, 18)) && !v.includes(BR.slice(0, 14)), `kiszivarog: ${u} -> ${v}`);
    assert.ok(!v.includes('@') && !v.includes('a'.repeat(32)) && !v.includes('123 4567') && !/\d{3}[\s/.-]?\d{4}/.test(v) && !/(ab12|cd34){4}/.test(v) && !/bela|vendeg|kov/i.test(v), `szemelyes adat: ${u} -> ${v}`);
  }
  // CPU-vedelem: a tamado bemenet 1000 karakterre vagva, es gyors
  const t0 = performance.now();
  uzenetTisztit('gclid' + ' '.repeat(3990)); uzenetTisztit('a@'.repeat(2000)); uzenetTisztit('gclid "'.repeat(600));
  assert.ok(performance.now() - t0 < 100, 'tamado bemenet lassu');
  const jo = uzenetTisztit('requestId=abc123def gclid expired; CONVERSION_ACTION_NOT_ELIGIBLE for gclid not found');
  assert.match(jo, /requestId=abc123def/); assert.match(jo, /gclid expired/); assert.match(jo, /CONVERSION_ACTION_NOT_ELIGIBLE/); assert.match(jo, /gclid not found/);
  assert.ok(uzenetTisztit('x '.repeat(400)).length <= 300);
});

test('vegpont: kulcs csak fejlecben (rossz / hianyzo / query / beallitas nelkul = 404), 405 / 400 / 413 / 503, siker', async () => {
  const w = await vilag();
  const env = { MP_MERES_DB: w.db, MP_GOOGLE_VALASZ_KULCS_HASH: TITOK_HASH };
  const torzs = { order_id: KULCS, conversion_action_id: AKCIO, kod: '' };
  const h = async (req, e = env) => googleValaszVegpont({ request: req, env: e }, { most: MOST });
  assert.equal((await h(kerj(torzs, {}))).status, 404, 'kulcs nelkul');
  assert.equal((await h(kerj(torzs, { 'x-mp-google-kulcs': 'rossz' }))).status, 404);
  assert.equal((await h(kerj(torzs, {}, 'POST', `https://x.test/api/mp-google-valasz?kulcs=${TITOK}`))).status, 404, 'a query-kulcs nem fogadhato el');
  assert.equal((await h(kerj(torzs), { ...env, MP_GOOGLE_VALASZ_KULCS_HASH: '' })).status, 404, 'beallitas nelkul nincs vegpont');
  assert.equal((await h(kerj({ ...torzs, order_id: KULCS2 }), { ...env, MP_GOOGLE_VALASZ_KULCS_HASH: TITOK_HASH + '\n' })).status, 200, 'a Secret zaro ujsora nem teszi siketce');
  assert.equal((await h(kerj(torzs), { MP_GOOGLE_VALASZ_KULCS_HASH: TITOK_HASH })).status, 503, 'D1 nelkul csak ervenyes kulccsal 503');
  assert.equal((await h(new Request('https://x.test/a', { method: 'POST', body: '{}' }), { MP_GOOGLE_VALASZ_KULCS_HASH: TITOK_HASH })).status, 404, 'kulcs nelkul D1 nelkul is 404');
  assert.equal((await h(kerj(null, { 'x-mp-google-kulcs': TITOK }, 'PUT'))).status, 405);
  assert.equal((await h(kerj('nem json'))).status, 400);
  assert.equal((await h(kerj('x'.repeat(5000)))).status, 413);
  const ok = await h(kerj(torzs));
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), { ok: true, rogzitve: true, kod: '' });
  assert.equal(w.sql('SELECT COUNT(*) AS n FROM mp_google_valasz')[0].n, 2, 'a trim-es kulcsu hivas (KULCS2) es a siker-hivas (KULCS)');
});

test('D1-keret: egy visszahivas legfeljebb 4 lekerdezes (tabla, kereses, beiras, megorzes-torles)', async () => {
  const w = await vilag();
  let n = 0;
  const szamolo = { prepare: (sql) => { n++; return w.db.prepare(sql); } };
  await googleValaszVegpont({ request: kerj({ order_id: KULCS, conversion_action_id: AKCIO, kod: 'EXPIRED_EVENT' }), env: { MP_MERES_DB: szamolo, MP_GOOGLE_VALASZ_KULCS_HASH: TITOK_HASH } }, { most: MOST });
  assert.ok(n <= 4, `D1-lekerdezesek: ${n}`); // tabla, kereses, beiras, megorzes-torles
});

test('riport (admin): darabszamok akciónként, nincs nyers azonosito; a tabla hianyaban sema_hianyzik', async () => {
  const w = await vilag();
  assert.deepEqual(await googleValaszRiport(w.db, 7, MOST), { sema_hianyzik: true });
  await googleValaszRogzit(w.db, { order_id: KULCS, conversion_action_id: AKCIO, kod: '', request_id: 'rid1' }, MOST);
  await googleValaszRogzit(w.db, { order_id: KULCS, conversion_action_id: AKCIO2, kod: 'UNPARSEABLE_GCLID', uzenet: `gclid=${GCLID}` }, MOST);
  const r = await googleValaszRiport(w.db, 7, MOST);
  assert.deepEqual(r.osszes, { elkuldve: 3, google_elfogadta: 1, reszleges_hiba: 1, nincs_visszajelzes: 1 });
  assert.deepEqual(r.akciok.find((a) => a.akcio === AKCIO), { akcio: AKCIO, elkuldve: 2, google_elfogadta: 1, reszleges_hiba: 0, nincs_visszajelzes: 1 });
  assert.deepEqual(r.hibakodok, [{ kod: 'UNPARSEABLE_GCLID', db: 1 }]);
  assert.ok(!JSON.stringify(r).includes(GCLID) && !JSON.stringify(r).includes(KULCS), 'nincs nyers azonosito / foglalasi kulcs');
  // a vegponton: admin-kulcs kell
  const env = { MP_MERES_DB: w.db, MP_MERES_ADMIN_KULCS: ADMIN };
  const get = (f) => googleValaszVegpont({ request: new Request('https://x.test/api/mp-google-valasz?riport=1&nap=7', { headers: f }), env }, { most: MOST });
  assert.equal((await get({})).status, 403);
  assert.equal((await get({ 'x-mp-kulcs': 'rossz' })).status, 403);
  const ok = await get({ 'x-mp-kulcs': ADMIN });
  assert.equal(ok.status, 200); assert.equal((await ok.json()).osszes.elkuldve, 3);
  assert.equal((await googleValaszVegpont({ request: new Request('https://x.test/api/mp-google-valasz?riport=1'), env: {} }, { most: MOST })).status, 404, 'admin-kulcs nelkul nincs riport');
  assert.equal((await googleValaszVegpont({ request: new Request('https://x.test/api/mp-google-valasz'), env }, { most: MOST })).status, 404, 'GET riport nelkul 404');
});

test('a foglalas-kerelem utja nem erintett: a modul nem importalja a lanc.js-t, nem ir mp_feltoltes-be / mp_foglalas-ba', async () => {
  const { readFileSync } = await import('node:fs');
  const forras = readFileSync(new URL('../lib/meres/google-valasz.js', import.meta.url), 'utf8');
  assert.ok(!/from '\.\/lanc\.js'/.test(forras));
  assert.ok(!/(INSERT INTO|UPDATE|DELETE FROM)\s+mp_(feltoltes|foglalas)/i.test(forras), 'csak az mp_google_valasz tablaba ir');
});
