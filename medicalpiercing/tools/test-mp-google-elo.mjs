// UJ-63 (MP): csere nelkuli potlas az ELO "All - Idopontfoglalas" akcion (7468541217), azonos orderId-vel; alapbol KI.
//   node --test tools/test-mp-google-elo.mjs   (a medicalpiercing/ mappabol)
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ELO_AKCIO, VARAKOZAS_MP, ABLAK_NAP_ALAP, eloAblakNap, eloKonverzio, eloMod, eloPotlas, eloTol, valaszErtekel } from '../lib/meres/google-elo.js';
import { semaBiztos, _semaTorles } from '../lib/meres/lanc.js';

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
const MOST = 1791900000;
const TOL = 1791800000;
const HOST = 'www.medicalpiercing.hu';
const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789';
const API_ENV = { MP_GADS_ELO: 'dry', MP_GADS_ELO_TOL: String(TOL), GOOGLE_ADS_DEVELOPER_TOKEN: 'dev', GOOGLE_ADS_CLIENT_ID: 'cid', GOOGLE_ADS_CLIENT_SECRET: 'csec', GOOGLE_ADS_REFRESH_TOKEN: 'rtok' };
const SOR = (o = {}) => ({ kulcs: '12169|555|1791850000', salonic_id: 'b1', forras: 'motor', kornyezet: 'eles', letrehozva: MOST - 4000, foglalas_ido: MOST - 4000, ertek: 24900, hozzajarulas_dontott: 1, hozzajarulas_hirdetes: 1, hozzajarulas_analitika: 1, kattintas_tipus: 'gclid', kattintas_ertek: GCLID, kattintas_ido: MOST - 9000, igazolas: 'igazolt', ...o });
async function ujDb(sorok = [SOR()]) {
  _semaTorles(); const db = d1(); await semaBiztos(db);
  for (const s of sorok) { const k = Object.keys(s); await db.prepare(`INSERT INTO mp_foglalas (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).bind(...k.map((x) => s[x])).run(); }
  return db;
}
function hamisFetch(valasz = {}, status = 200) {
  const h = [];
  const f = async (url, o = {}) => {
    h.push({ url: String(url), body: o.body ? (String(url).includes('oauth') ? o.body : JSON.parse(o.body)) : null });
    if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), { status: 200 });
    return new Response(JSON.stringify(typeof valasz === 'function' ? valasz(h) : valasz), { status });
  };
  f.hivasok = h; f.api = () => h.filter((x) => x.url.includes('googleads')); return f;
}
const naplo = (db) => db._s.prepare('SELECT * FROM mp_feltoltes_elo').all();

test('A) kapcsolo: alapbol KI; csak dry / eles; a tol ervenyes unix; az elo akcio 7468541217', () => {
  assert.equal(eloMod({}), 'ki'); assert.equal(eloMod({ MP_GADS_ELO: 'valami' }), 'ki'); assert.equal(eloMod({ MP_GADS_ELO: 'DRY' }), 'dry'); assert.equal(eloMod({ MP_GADS_ELO: 'eles' }), 'eles');
  assert.equal(eloTol({}), null); assert.equal(eloTol({ MP_GADS_ELO_TOL: '12' }), null); assert.equal(eloTol({ MP_GADS_ELO_TOL: String(TOL) }), TOL);
  assert.equal(ELO_AKCIO, '7468541217');
});
test('A) eloKonverzio: az ELO akciora, azonos orderId-vel (a foglalasi kulcs); kattintas nelkul null; ertek csak ha van', () => {
  const k = eloKonverzio({ kulcs: '12169|555|1791850000', letrehozva: 1791850000, ertek: 24900, kattintas: { tipus: 'gclid', ertek: GCLID } });
  assert.deepEqual([k.conversionAction, k.orderId, k.gclid, k.conversionValue, k.currencyCode, k.consent], ['customers/2626380837/conversionActions/7468541217', '12169|555|1791850000', GCLID, 24900, 'HUF', { adUserData: 'GRANTED' }]);
  assert.match(k.conversionDateTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.equal(eloKonverzio({ kulcs: 'k', letrehozva: 1, kattintas: null }), null); assert.equal(eloKonverzio({ kulcs: 'k', letrehozva: 1, kattintas: { tipus: 'fbclid', ertek: 'x' } }), null);
  assert.equal('conversionValue' in eloKonverzio({ kulcs: 'k', letrehozva: 1, ertek: null, kattintas: { tipus: 'gbraid', ertek: 'y' } }), false);
});
test('A) valaszErtekel: siker, "mar bent van" = siker (nincs dupla), egyeb partialFailure = hiba, HTTP-hiba', () => {
  assert.deepEqual(valaszErtekel(200, '{}', { validate: true }), { allapot: 'elfogadva', kod: null }); assert.deepEqual(valaszErtekel(200, '{}', { validate: false }), { allapot: 'elkuldve', kod: null });
  const pf = (c) => JSON.stringify({ partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: c } }] }] } });
  assert.equal(valaszErtekel(200, pf('ORDER_ID_ALREADY_IN_USE'), { validate: false }).allapot, 'mar_bent'); assert.equal(valaszErtekel(200, pf('CLICK_CONVERSION_ALREADY_EXISTS'), { validate: false }).allapot, 'mar_bent');
  assert.deepEqual(valaszErtekel(200, pf('EXPIRED_EVENT'), { validate: false }), { allapot: 'hiba', kod: 'EXPIRED_EVENT' });
  assert.equal(valaszErtekel(403, JSON.stringify({ error: { status: 'PERMISSION_DENIED' } }), { validate: false }).kod, 'PERMISSION_DENIED');
});
test('B) alapbol KI / hianyzo tol / hianyzo API-titok: nincs halozati hivas, nincs tabla', async () => {
  const db = await ujDb(); const f = hamisFetch();
  assert.deepEqual(await eloPotlas({ db, env: {}, host: HOST, most: MOST, fetchImpl: f }), { allapot: 'ki' });
  assert.equal((await eloPotlas({ db, env: { ...API_ENV, MP_GADS_ELO_TOL: undefined }, host: HOST, most: MOST, fetchImpl: f })).allapot, 'nincs_tol');
  assert.equal((await eloPotlas({ db, env: { MP_GADS_ELO: 'dry', MP_GADS_ELO_TOL: String(TOL) }, host: HOST, most: MOST, fetchImpl: f })).allapot, 'nincs_szallito');
  assert.equal((await eloPotlas({ db, env: { ...API_ENV, MP_GADS_MOD: 'off' }, host: HOST, most: MOST, fetchImpl: f })).allapot, 'ki', 'a meglevo MP_GADS_MOD=off veszkapcsolo ezt is leallitja');
  assert.equal(f.hivasok.length, 0); assert.equal(db._s.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'mp_feltoltes_elo'").get().n, 0);
});
test('B) dry: validateOnly=true, az ELO akcio, azonos orderId; naplo a sajat tablaban; nyers gclid nincs a naploban; masodik futas nem tolt ujra', async () => {
  const db = await ujDb(); const f = hamisFetch();
  const r = await eloPotlas({ db, env: API_ENV, host: HOST, most: MOST, fetchImpl: f });
  assert.deepEqual([r.allapot, r.feldolgozva, r.eredmenyek], ['kesz', 1, { elfogadva: 1 }]);
  const h = f.api()[0]; assert.match(h.url, /\/customers\/2626380837:uploadClickConversions$/); assert.equal(h.body.validateOnly, true); assert.equal(h.body.partialFailure, true);
  assert.equal(h.body.conversions[0].conversionAction, 'customers/2626380837/conversionActions/7468541217'); assert.equal(h.body.conversions[0].orderId, '12169|555|1791850000');
  const n = naplo(db); assert.equal(n.length, 1); assert.deepEqual([n[0].mod, n[0].allapot, n[0].probalkozas], ['dry', 'elfogadva', 1]); assert.equal(JSON.stringify(n).includes(GCLID), false); assert.match(n[0].kattintas_maszk, /^h:/);
  const r2 = await eloPotlas({ db, env: API_ENV, host: HOST, most: MOST + 60, fetchImpl: f }); assert.equal(r2.feldolgozva, 0); assert.equal(f.api().length, 1, 'az elfogadott dry sor nem ismetlodik');
});
test('B) eles csak MP_GADS_ELO=eles ES MP_GADS_MOD=eles ES eles host: valodi feltoltes (validateOnly=false); masik hoston dry marad', async () => {
  const db = await ujDb(); const f = hamisFetch();
  await eloPotlas({ db, env: { ...API_ENV, MP_GADS_ELO: 'eles', MP_GADS_MOD: 'eles' }, host: 'elonezet.example.pages.dev', most: MOST, fetchImpl: f });
  assert.equal(f.api()[0].body.validateOnly, true, 'nem eles host: validateOnly');
  const db2 = await ujDb(); const f2 = hamisFetch();
  const r = await eloPotlas({ db: db2, env: { ...API_ENV, MP_GADS_ELO: 'eles', MP_GADS_MOD: 'eles' }, host: HOST, most: MOST, fetchImpl: f2 });
  assert.equal(f2.api()[0].body.validateOnly, false); assert.deepEqual(r.eredmenyek, { elkuldve: 1 }); assert.equal(naplo(db2)[0].mod, 'eles');
  const db3 = await ujDb(); const f3 = hamisFetch(); await eloPotlas({ db: db3, env: { ...API_ENV, MP_GADS_ELO: 'eles' }, host: HOST, most: MOST, fetchImpl: f3 }); assert.equal(f3.api()[0].body.validateOnly, true, 'MP_GADS_MOD nelkul eles sem megy');
});
test('B) jogosultsag: csak igazolt, nem ful, van kattintas + hirdetesi hozzajarulas, a tol utani, legalabb VARAKOZAS_MP-s sor; eles modban csak eles kornyezet', async () => {
  const sorok = [SOR({ kulcs: '1|1|1791850001' }),
    SOR({ kulcs: '1|1|1791850002', igazolas: null }), SOR({ kulcs: '1|1|1791850003', tipus: 'ful' }), SOR({ kulcs: '1|1|1791850004', kattintas_ertek: null, kattintas_tipus: null }),
    SOR({ kulcs: '1|1|1791850005', hozzajarulas_hirdetes: 0 }), SOR({ kulcs: '1|1|1791850006', foglalas_ido: TOL - 10, letrehozva: TOL - 10 }), SOR({ kulcs: '1|1|1791850007', foglalas_ido: MOST - 100, letrehozva: MOST - 100 }), SOR({ kulcs: '1|1|1791850008', kornyezet: 'elonezet' })];
  const db = await ujDb(sorok); const f = hamisFetch();
  const r = await eloPotlas({ db, env: API_ENV, host: HOST, most: MOST, fetchImpl: f });
  assert.deepEqual(f.api().map((x) => x.body.conversions[0].orderId).sort(), ['1|1|1791850001', '1|1|1791850008'], 'dry modban az elonezet is mehet (validateOnly)'); assert.equal(r.feldolgozva, 2);
  const db2 = await ujDb(sorok); const f2 = hamisFetch(); await eloPotlas({ db: db2, env: { ...API_ENV, MP_GADS_ELO: 'eles', MP_GADS_MOD: 'eles' }, host: HOST, most: MOST, fetchImpl: f2 });
  assert.deepEqual(f2.api().map((x) => x.body.conversions[0].orderId), ['1|1|1791850001'], 'eles modban csak az eles kornyezet'); assert.ok(VARAKOZAS_MP >= 600);
});
test('B) "mar bent van" a Google szerint = siker (nincs dupla); hiba: legfeljebb 3 probalkozas; OAuth / halozati hiba nem dob', async () => {
  const bent = (c) => () => ({ partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: c } }] }] } });
  const db = await ujDb(); await eloPotlas({ db, env: { ...API_ENV, MP_GADS_ELO: 'eles', MP_GADS_MOD: 'eles' }, host: HOST, most: MOST, fetchImpl: hamisFetch(bent('ORDER_ID_ALREADY_IN_USE')) });
  assert.equal(naplo(db)[0].allapot, 'mar_bent'); const f = hamisFetch(); await eloPotlas({ db, env: { ...API_ENV, MP_GADS_ELO: 'eles', MP_GADS_MOD: 'eles' }, host: HOST, most: MOST + 60, fetchImpl: f }); assert.equal(f.api().length, 0, 'mar_bent veglegesnek szamit');
  const db2 = await ujDb(); const rossz = hamisFetch(bent('EXPIRED_EVENT'));
  for (let i = 0; i < 5; i++) await eloPotlas({ db: db2, env: { ...API_ENV, MP_GADS_ELO: 'eles', MP_GADS_MOD: 'eles' }, host: HOST, most: MOST + i * 60, fetchImpl: rossz });
  assert.equal(rossz.api().length, 3); assert.deepEqual([naplo(db2)[0].allapot, naplo(db2)[0].probalkozas, naplo(db2)[0].kod], ['hiba', 3, 'EXPIRED_EVENT']);
  const db3 = await ujDb(); const dob = async () => { throw new Error('halozat'); };
  assert.equal((await eloPotlas({ db: db3, env: API_ENV, host: HOST, most: MOST, fetchImpl: dob })).allapot, 'kesz'); assert.equal(naplo(db3)[0].allapot, 'hiba');
});
test('B) a kattintas konverzios ablakan kivuli (alap 30 nap) foglalas kihagyva_ablakon_kivul (nincs EXPIRED_EVENT-hivas); az ablak MP_GADS_ELO_ABLAK_NAP-pal allithato (1..90)', async () => {
  assert.equal(ABLAK_NAP_ALAP, 30); assert.equal(eloAblakNap({}), 30); assert.equal(eloAblakNap({ MP_GADS_ELO_ABLAK_NAP: '90' }), 90); assert.equal(eloAblakNap({ MP_GADS_ELO_ABLAK_NAP: '91' }), 30); assert.equal(eloAblakNap({ MP_GADS_ELO_ABLAK_NAP: '0' }), 30);
  const sorok = [SOR({ kulcs: '1|1|1791850001', kattintas_ido: MOST - 4000 - 29 * 86400 }), SOR({ kulcs: '1|1|1791850002', kattintas_ido: MOST - 4000 - 36 * 86400 }), SOR({ kulcs: '1|1|1791850003', kattintas_ido: null })];
  const db = await ujDb(sorok); const f = hamisFetch();
  const r = await eloPotlas({ db, env: API_ENV, host: HOST, most: MOST, fetchImpl: f });
  assert.deepEqual(f.api().map((x) => x.body.conversions[0].orderId).sort(), ['1|1|1791850001', '1|1|1791850003'], 'a 29 napos es a kattintas-ido nelkuli megy, a 36 napos nem');
  assert.deepEqual(r.eredmenyek, { elfogadva: 2, kihagyva_ablakon_kivul: 1 }); assert.equal(naplo(db).find((x) => x.kulcs === '1|1|1791850002').allapot, 'kihagyva_ablakon_kivul');
  const f2 = hamisFetch(); await eloPotlas({ db, env: API_ENV, host: HOST, most: MOST + 60, fetchImpl: f2 }); assert.equal(f2.api().length, 0, 'a kihagyott nem ismetlodik');
  const db2 = await ujDb(sorok); const f3 = hamisFetch(); await eloPotlas({ db: db2, env: { ...API_ENV, MP_GADS_ELO_ABLAK_NAP: '90' }, host: HOST, most: MOST, fetchImpl: f3 }); assert.equal(f3.api().length, 3, '90 napos ablakkal mind megy');
});
