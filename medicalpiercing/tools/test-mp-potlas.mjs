// DECISION #253 / #256: egyszeri, kulcs-listas potlas a NORMAL lancba (igazoltra allitas + meglevo ARNYEK-feltoltes; az elo All akciora NEM tolt) (lib/meres/potlas.js, functions/api/mp-potlas.js). Google-hivas NINCS (fetch kamu).
//   node --test tools/test-mp-potlas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _semaTorles, semaBiztos } from '../lib/meres/lanc.js';
import { _tokenTorles } from '../lib/meres/google-ads.js';
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
  _semaTorles(); _tokenTorles(); const db = d1(); await semaBiztos(db);
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
  const nincsApi = await kornyezet({ MP_KIIGAZITAS_TITOK: 'T', MP_GADS_MOD: 'eles' }); assert.equal((await fut(nincsApi, { kulcsok: [KULCS] })).j.hiba, 'nincs_szallito');
  const nincsEles = await kornyezet({ MP_KIIGAZITAS_TITOK: 'T', ...API }); // MP_GADS_MOD nincs
  assert.equal((await fut(nincsEles, { kulcsok: [KULCS], mod: 'eles' })).j.hiba, 'eles_nem_engedelyezett');
  assert.equal((await fut(k, { kulcsok: [KULCS], mod: 'eles' }, { host: 'x.medicalpiercing.pages.dev' })).j.hiba, 'eles_nem_engedelyezett', 'elonezeti hoszton nincs eles');
});

const konvAkciok = (f) => f.hivasok.filter((h) => h.url.includes('uploadClickConversions')).flatMap((h) => JSON.parse(h.body).conversions.map((c) => c.conversionAction.split('/').pop()));
const feltoltesHivasok = (f) => f.hivasok.filter((h) => h.url.includes('uploadClickConversions'));

test('dry: a normal lanc ARNYEK-akcioi validateOnly modban (MP_GADS_MOD=eles mellett is), az elo All akcio SOHA, SEMMIT nem ir az mp_foglalas / mp_salonic_igazolas tablakba, a valasz nem tartalmaz kattintasazonositot', async () => {
  const k = await kornyezet(); await k.fogl(KULCS); await k.level('B1', S1 + 1000);
  const f = kamuFetch([{ status: 200, body: {} }]);
  const r = await fut(k, { kulcsok: [KULCS] }, {}, f);
  assert.equal(r.status, 200); assert.equal(r.j.mod, 'dry'); assert.equal(r.j.lanc, 'arnyek');
  assert.equal(r.j.eredmenyek[KULCS].allapot, 'feldolgozva');
  assert.deepEqual(r.j.eredmenyek[KULCS].feltoltesek.map((x) => x.akcio).sort(), ['7834926162', '7834926165']);
  assert.ok(r.j.eredmenyek[KULCS].feltoltesek.every((x) => x.mod === 'validate' && x.allapot === 'elfogadva'));
  const hiv = feltoltesHivasok(f); assert.equal(hiv.length, 1); assert.equal(JSON.parse(hiv[0].body).validateOnly, true);
  assert.ok(!konvAkciok(f).includes('7468541217'), 'az elo All akciora nem megy');
  assert.equal(k.db._s.prepare('SELECT igazolas FROM mp_foglalas WHERE kulcs = ?').get(KULCS).igazolas, 'nem_igazolt');
  assert.equal(k.db._s.prepare('SELECT kulcs FROM mp_salonic_igazolas WHERE booking_id = ?').get('B1').kulcs, null);
  assert.ok(!JSON.stringify(r.j).includes(GCLID), 'nincs nyers kattintasazonosito a valaszban');
});

test('eles: igazoltra allitja a sort (mint igazoltJeloles), a levelet hozzarendeli, valodi ARNYEK-feltoltes (Foglalas + Uj); az elo All akcio SOHA; masodik hivas nem duplaz', async () => {
  const k = await kornyezet(); await k.fogl(KULCS); await k.level('B1', S1 + 1000, '257', S1 + 1005);
  const f = kamuFetch([{ status: 200, body: {} }]);
  const r = await fut(k, { kulcsok: [KULCS], mod: 'eles' }, {}, f);
  assert.equal(r.j.eredmenyek[KULCS].allapot, 'feldolgozva'); assert.equal(r.j.eredmenyek[KULCS].igazolt_jelolve, true);
  assert.ok(r.j.eredmenyek[KULCS].feltoltesek.every((x) => x.mod === 'eles' && x.allapot === 'elkuldve'));
  const sor = k.db._s.prepare('SELECT igazolas, igazolas_id, foglalas_ido, uj_vendeg_igazolt FROM mp_foglalas WHERE kulcs = ?').get(KULCS);
  assert.deepEqual({ ...sor }, { igazolas: 'igazolt', igazolas_id: 'B1', foglalas_ido: S1 + 1005, uj_vendeg_igazolt: 1 });
  assert.equal(k.db._s.prepare('SELECT kulcs FROM mp_salonic_igazolas WHERE booking_id = ?').get('B1').kulcs, KULCS);
  const hiv = feltoltesHivasok(f); assert.equal(hiv.length, 1); const t = JSON.parse(hiv[0].body);
  assert.equal(t.validateOnly, false); assert.deepEqual(t.conversions.map((c) => c.conversionAction.split('/').pop()).sort(), ['7834926162', '7834926165']); assert.ok(t.conversions.every((c) => c.orderId === KULCS));
  assert.ok(!konvAkciok(f).includes('7468541217'));
  const f2 = kamuFetch(); const r2 = await fut(k, { kulcsok: [KULCS], mod: 'eles' }, {}, f2);
  assert.equal(r2.j.eredmenyek[KULCS].allapot, 'nincs_uj_feltoltes'); assert.equal(feltoltesHivasok(f2).length, 0, 'masodik hivas nem kuld ujra');
});

test('elutasitasok: nincs sor / nem eles / divat-ful / nincs kattintas / nincs hozzajarulas / nincs level / tobb level / rossz munkatars / hozzarendelt level - semmi nem megy ki, semmi nem iródik; 40 napos kattintas: a normal lanc kapuja kihagyja', async () => {
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
  const f = kamuFetch();
  const ossz = {};
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) { const r = await fut(k, { kulcsok: [K(n)], mod: 'eles' }, {}, f); ossz[n] = r.j.eredmenyek[K(n)].ok; }
  assert.deepEqual(ossz, { 1: 'nem_eles', 2: 'divat_ful', 3: 'nincs_google_kattintas', 4: 'nincs_hirdetesi_hozzajarulas', 5: 'nincs_salonic_level', 6: 'tobb_salonic_level', 7: 'nincs_salonic_level', 8: 'nincs_salonic_level' });
  assert.equal(feltoltesHivasok(f).length, 0, 'egy sem ment ki');
  assert.equal(k.db._s.prepare("SELECT COUNT(*) AS n FROM mp_foglalas WHERE igazolas = 'igazolt'").get().n, 0);
  await k.fogl(K(9), { kattintas_ido: S1 - 40 * 86400 }); await k.level('L9', S1 + 900, '9');
  const r9 = await fut(k, { kulcsok: [K(9)], mod: 'eles' }, {}, f);
  assert.ok(r9.j.eredmenyek[K(9)].feltoltesek.every((x) => x.allapot === 'kihagyva'), 'a 14 napos kapu (DECISION #245) kihagyja'); assert.equal(feltoltesHivasok(f).length, 0);
});

test('Google-hiba: a feltoltes allapota hiba, a sor igazolt marad (az igazolas igaz); ujrafuttatva ujraprobal; mar elkuldott akciot nem kuld ujra', async () => {
  const k = await kornyezet(); await k.fogl(KULCS); await k.level('B1', S1 + 1000);
  const r = await fut(k, { kulcsok: [KULCS], mod: 'eles' }, {}, kamuFetch([{ status: 500, body: { error: { status: 'INTERNAL' } } }]));
  assert.ok(r.j.eredmenyek[KULCS].feltoltesek.every((x) => x.allapot === 'hiba'));
  assert.equal(k.db._s.prepare('SELECT igazolas FROM mp_foglalas WHERE kulcs = ?').get(KULCS).igazolas, 'igazolt');
  const f = kamuFetch([{ status: 200, body: {} }]);
  const r2 = await fut(k, { kulcsok: [KULCS], mod: 'eles' }, {}, f);
  assert.ok(r2.j.eredmenyek[KULCS].feltoltesek.every((x) => x.allapot === 'elkuldve')); assert.equal(r2.j.eredmenyek[KULCS].igazolt_jelolve, false);
  assert.equal(k.db._s.prepare("SELECT COUNT(*) AS n FROM mp_feltoltes WHERE kulcs = ? AND mod = 'eles' AND allapot = 'elkuldve'").get(KULCS).n, 2);
});
