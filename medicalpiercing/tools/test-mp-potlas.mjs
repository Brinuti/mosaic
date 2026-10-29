// DECISION #253: egyszeri, kulcs-listas potlas az elo All akcion (lib/meres/potlas.js, functions/api/mp-potlas.js). Google-hivas NINCS (fetch kamu).
//   node --test tools/test-mp-potlas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _semaTorles, semaBiztos } from '../lib/meres/lanc.js';
import { potlasVegpont } from '../lib/meres/potlas.js';

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
const MOST = 1793300000; // 2026-10-29
const S1 = MOST - 3 * 86400; const KULCS = `6029|257|${S1 + 1000}`; const KULCS2 = `11424|27|${S1 + 2000}`;
const API = { GOOGLE_ADS_DEVELOPER_TOKEN: 'dev', GOOGLE_ADS_CLIENT_ID: 'cid', GOOGLE_ADS_CLIENT_SECRET: 'sec', GOOGLE_ADS_REFRESH_TOKEN: 'ref' };
const ELES_ENV = { MP_KIIGAZITAS_TITOK: 'T', MP_GADS_MOD: 'eles', ...API };
const GCLID = 'GCLID-NYERS-AZONOSITO-123';

async function kornyezet(env = ELES_ENV) {
  _semaTorles(); const db = d1(); await semaBiztos(db);
  const fogl = async (kulcs, extra = {}) => {
    const r = { kornyezet: 'eles', tipus: null, igazolas: 'nem_igazolt', kattintas_tipus: 'gclid', kattintas_ertek: GCLID, kattintas_ido: S1 - 86400, hozzajarulas_hirdetes: 1, letrehozva: S1, ...extra };
    await db.prepare(`INSERT INTO mp_foglalas (kulcs, forras, kornyezet, letrehozva, hozzajarulas_dontott, hozzajarulas_hirdetes, hozzajarulas_analitika, kattintas_tipus, kattintas_ertek, kattintas_ido, tipus, igazolas, ertek)
      VALUES (?, 'oldal', ?, ?, 1, ?, 0, ?, ?, ?, ?, ?, 15000)`).bind(kulcs, r.kornyezet, r.letrehozva, r.hozzajarulas_hirdetes, r.kattintas_tipus, r.kattintas_ertek, r.kattintas_ido, r.tipus, r.igazolas).run();
  };
  const level = async (id, start, emp = '257', erkezett = S1 + 1005, kulcs = null) =>
    db.prepare('INSERT INTO mp_salonic_igazolas (booking_id, employee_ids, start_unix, uj_paciens, erkezett, rogzitve, kulcs) VALUES (?, ?, ?, 1, ?, ?, ?)').bind(id, emp, start, erkezett, MOST, kulcs).run();
  return { db, fogl, level, env: { ...env, MP_MERES_DB: db } };
}
const keres = (body, { host = 'www.medicalpiercing.hu', titok = 'T', method = 'POST' } = {}) => new Request(`https://${host}/api/mp-potlas`, { method, headers: { 'x-mp-kiigazitas': titok, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });
function kamuFetch(valaszok = []) {
  const hivasok = [];
  const f = async (url, opt) => {
    hivasok.push({ url: String(url), body: opt && opt.body ? String(opt.body) : '' });
    if (String(url).includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'AT' }), { status: 200 });
    const v = valaszok.shift() || { status: 200, body: {} };
    return new Response(JSON.stringify(v.body || {}), { status: v.status || 200 });
  };
  f.hivasok = hivasok; return f;
}
const fut = async (k, body, o = {}, f = kamuFetch()) => { const v = await potlasVegpont({ request: keres(body, o), env: k.env }, { fetchImpl: f, most: MOST }); return { status: v.status, j: await v.json(), f }; };

test('vedelem: titok nelkul 404, rossz titok 403, GET 405, rossz torzs 400, vesz-kikapcsolo / hitelesites hianya / eles-engedely hianya 409', async () => {
  const k0 = await kornyezet({ ...ELES_ENV, MP_KIIGAZITAS_TITOK: undefined });
  assert.equal((await fut(k0, { kulcsok: [KULCS] })).status, 404);
  const k = await kornyezet();
  assert.equal((await fut(k, { kulcsok: [KULCS] }, { titok: 'rossz' })).status, 403);
  assert.equal((await fut(k, null, { method: 'GET' })).status, 405);
  for (const rossz of [{}, { kulcsok: [] }, { kulcsok: ['rossz'] }, { kulcsok: [KULCS, KULCS2, '1|2|3', '4|5|6'] }, { kulcsok: [KULCS], mod: 'valami' }]) assert.equal((await fut(k, rossz)).status, 400, JSON.stringify(rossz));
  const ki = await kornyezet({ ...ELES_ENV, MP_GADS_MOD: 'off' }); assert.equal((await fut(ki, { kulcsok: [KULCS] })).status, 409);
  const nincsApi = await kornyezet({ MP_KIIGAZITAS_TITOK: 'T', MP_GADS_MOD: 'eles' }); assert.equal((await fut(nincsApi, { kulcsok: [KULCS] })).j.hiba, 'nincs_google_hitelesites');
  const nincsEles = await kornyezet({ MP_KIIGAZITAS_TITOK: 'T', ...API }); // MP_GADS_MOD nincs
  assert.equal((await fut(nincsEles, { kulcsok: [KULCS], mod: 'eles' })).j.hiba, 'eles_nem_engedelyezett');
  assert.equal((await fut(k, { kulcsok: [KULCS], mod: 'eles' }, { host: 'x.medicalpiercing.pages.dev' })).j.hiba, 'eles_nem_engedelyezett', 'elonezeti hoszton nincs eles');
});

test('dry: validateOnly feltoltes, SEMMIT nem ir az mp_foglalas / mp_salonic_igazolas tablakba, a valasz nem tartalmaz kattintasazonositot', async () => {
  const k = await kornyezet(); await k.fogl(KULCS); await k.level('B1', S1 + 1000);
  const f = kamuFetch([{ status: 200, body: {} }]);
  const r = await fut(k, { kulcsok: [KULCS] }, {}, f);
  assert.equal(r.status, 200); assert.equal(r.j.mod, 'dry'); assert.equal(r.j.eredmenyek[KULCS].allapot, 'elfogadva');
  const g = f.hivasok.find((h) => h.url.includes('uploadClickConversions')); const t = JSON.parse(g.body);
  assert.equal(t.validateOnly, true); assert.equal(t.conversions[0].conversionAction, 'customers/2626380837/conversionActions/7468541217'); assert.equal(t.conversions[0].orderId, KULCS);
  assert.equal(k.db._s.prepare('SELECT igazolas FROM mp_foglalas WHERE kulcs = ?').get(KULCS).igazolas, 'nem_igazolt');
  assert.equal(k.db._s.prepare('SELECT kulcs FROM mp_salonic_igazolas WHERE booking_id = ?').get('B1').kulcs, null);
  assert.ok(!JSON.stringify(r.j).includes(GCLID), 'nincs nyers kattintasazonosito a valaszban');
  assert.equal(k.db._s.prepare('SELECT mod, allapot FROM mp_feltoltes_elo WHERE kulcs = ?').get(KULCS).mod, 'dry');
});

test('eles: igazoltra allitja a sort (mint igazoltJeloles), a levelet hozzarendeli, valodi feltoltes; masodik hivas nem duplaz', async () => {
  const k = await kornyezet(); await k.fogl(KULCS); await k.level('B1', S1 + 1000, '257', S1 + 1005);
  const f = kamuFetch([{ status: 200, body: {} }]);
  const r = await fut(k, { kulcsok: [KULCS], mod: 'eles' }, {}, f);
  assert.equal(r.j.eredmenyek[KULCS].allapot, 'elkuldve'); assert.equal(r.j.eredmenyek[KULCS].igazolt_jelolve, true);
  const sor = k.db._s.prepare('SELECT igazolas, igazolas_id, foglalas_ido, uj_vendeg_igazolt FROM mp_foglalas WHERE kulcs = ?').get(KULCS);
  assert.deepEqual({ ...sor }, { igazolas: 'igazolt', igazolas_id: 'B1', foglalas_ido: S1 + 1005, uj_vendeg_igazolt: 1 });
  assert.equal(k.db._s.prepare('SELECT kulcs FROM mp_salonic_igazolas WHERE booking_id = ?').get('B1').kulcs, KULCS);
  const t = JSON.parse(f.hivasok.find((h) => h.url.includes('uploadClickConversions')).body); assert.equal(t.validateOnly, false); assert.equal(t.conversions[0].consent.adUserData, 'GRANTED');
  const f2 = kamuFetch(); const r2 = await fut(k, { kulcsok: [KULCS], mod: 'eles' }, {}, f2);
  assert.deepEqual(r2.j.eredmenyek[KULCS], { allapot: 'kihagyva', ok: 'mar_felt_oltve' }); assert.equal(f2.hivasok.filter((h) => h.url.includes('uploadClickConversions')).length, 0);
});

test('elutasitasok: nincs sor / nem eles / divat-ful / nincs kattintas / nincs hozzajarulas / nincs level / tobb level / rossz munkatars / hozzarendelt level / ablakon kivul - semmi nem megy ki, semmi nem iródik', async () => {
  const k = await kornyezet();
  const K = (n) => `1|${n}|${S1 + 100 * n}`;
  await k.fogl(K(1), { kornyezet: 'elonezet' }); await k.level('L1', S1 + 100);
  await k.fogl(K(2), { tipus: 'ful' }); await k.level('L2', S1 + 200, '2');
  await k.fogl(K(3), { kattintas_ertek: null, kattintas_tipus: null }); await k.level('L3', S1 + 300, '3');
  await k.fogl(K(4), { hozzajarulas_hirdetes: 0 }); await k.level('L4', S1 + 400, '4');
  await k.fogl(K(5)); // nincs level
  await k.fogl(K(6)); await k.level('L6a', S1 + 600, '6'); await k.level('L6b', S1 + 610, '6');
  await k.fogl(K(7)); await k.level('L7', S1 + 700, '99'); // masik munkatars
  await k.fogl(K(8)); await k.level('L8', S1 + 800, '8', S1 + 805, 'MAS|1|2'); // mar masik sorhoz rendelt level
  await k.fogl(K(9), { kattintas_ido: S1 - 40 * 86400 }); await k.level('L9', S1 + 900, '9'); // 40 napos kattintas
  const f = kamuFetch();
  const ossz = {};
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) { const r = await fut(k, { kulcsok: [K(n)], mod: 'eles' }, {}, f); ossz[n] = r.j.eredmenyek[K(n)].ok; }
  assert.deepEqual(ossz, { 1: 'nem_eles', 2: 'divat_ful', 3: 'nincs_google_kattintas', 4: 'nincs_hirdetesi_hozzajarulas', 5: 'nincs_salonic_level', 6: 'tobb_salonic_level', 7: 'nincs_salonic_level', 8: 'nincs_salonic_level', 9: 'kattintas_ablakon_kivul' });
  assert.equal(f.hivasok.filter((h) => h.url.includes('uploadClickConversions')).length, 0, 'egy sem ment ki');
  assert.equal(k.db._s.prepare("SELECT COUNT(*) AS n FROM mp_foglalas WHERE igazolas = 'igazolt'").get().n, 0);
});

test('Google-hiba: allapot hiba + kod, a sor igazolt marad (az igazolas igaz), a kovetkezo hivas ujraprobal; mar_bent sikernek szamit', async () => {
  const k = await kornyezet(); await k.fogl(KULCS); await k.level('B1', S1 + 1000);
  const hibas = { status: 200, body: { partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: 'TOO_RECENT_CONVERSION_ACTION' } }] }] } } };
  const r = await fut(k, { kulcsok: [KULCS], mod: 'eles' }, {}, kamuFetch([hibas]));
  assert.equal(r.j.eredmenyek[KULCS].allapot, 'hiba'); assert.equal(r.j.eredmenyek[KULCS].kod, 'TOO_RECENT_CONVERSION_ACTION');
  assert.equal(k.db._s.prepare('SELECT igazolas FROM mp_foglalas WHERE kulcs = ?').get(KULCS).igazolas, 'igazolt');
  const bent = { status: 200, body: { partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: 'CLICK_CONVERSION_ALREADY_EXISTS' } }] }] } } };
  const r2 = await fut(k, { kulcsok: [KULCS], mod: 'eles' }, {}, kamuFetch([bent]));
  assert.equal(r2.j.eredmenyek[KULCS].allapot, 'mar_bent');
  assert.equal(k.db._s.prepare('SELECT probalkozas FROM mp_feltoltes_elo WHERE kulcs = ?').get(KULCS).probalkozas, 2);
});
