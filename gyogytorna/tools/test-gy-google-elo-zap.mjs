// UJ-94 / DECISION #264 (b): az ELO akcio (7362127659) validateOnly-probaja a GY-26 Zapier-mintan; alapbol KI; kizarolag validateOnly=true.
//   node --test tools/test-gy-google-elo-zap.mjs   (a gyogytorna/ mappabol)
import test from 'node:test';
import assert from 'node:assert/strict';
import { eloSema } from '../lib/google-elo.js';
import { eloZapFazis, eloZapKivalaszt, eloZapVegpont, vedohaloElo, zapMod } from '../lib/google-elo-zap.js';
import { sema, foglalasLetrehoz } from '../lib/db.js';
import { tranzakcioId, sha256Hex } from '../lib/titkos.js';
import { ujD1 } from './d1-szim.mjs';

const MOST = 1791900000, TOL = 1791800000;
const KULCS = 'proba-titkos-kulcs-0123456789abcdef';
const ZAPKULCS = 'zap-proba-kulcs-0123456789';
const GCLID = 'Cj0KCQjwXYZAB_gclid_0123456789abcdef0123456789';
const ENV = async (extra = {}) => ({ GY_GADS_ELO_ZAP: 'validate', GY_GADS_ELO_TOL: String(TOL), GY_HMAC_KULCS: KULCS, GY_ZAP_KULCS_HASH: await sha256Hex(ZAPKULCS), ...extra });
const F = (n, o = {}) => ({ uuid: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, tipus: 'allapotfelmeres', uj_vendeg: 'ismeretlen', cimke: 'google_brand', bizonyitek: null, hozzajarulas: 'igen', allapot: 'aktiv', teszt: false, gads_katt_tipus: 'gclid', gads_katt_ertek: GCLID + n, gads_katt_ido: MOST - 20000, ...o });
async function ujDb(fs) {
  const db = ujD1(); await sema(db);
  for (const [i, f] of fs.entries()) { await foglalasLetrehoz(db, f, MOST - 7200 - i); if (f.igazolt !== false) await db.prepare('UPDATE gy_foglalas SET igazolt = 1 WHERE uuid = ?').bind(f.uuid).run(); }
  return db;
}
const sorok = (db) => { try { return sorokOlvas(db); } catch (e) { return []; } }; // nincs tabla = nincs sor
const sorokOlvas = (db) => db._db.prepare('SELECT uuid, mod, allapot, hiba, http, probalkozas, katt_maszk FROM gy_feltoltes_elo ORDER BY uuid').all().map((r) => ({ ...r }));
const kerelem = (metodus, body, kulcs = ZAPKULCS) => new Request('https://gyogytorna.pages.dev/api/gy-gads-elo-zap', { method: metodus, headers: { ...(kulcs ? { 'x-gy-zap-kulcs': kulcs } : {}), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const hiv = async (db, env, metodus, body, kulcs) => { const r = await eloZapVegpont({ request: kerelem(metodus, body, kulcs), env: { ...env, GY_DB: db }, deps: { most: () => MOST * 1000 } }); return { status: r.status, body: await r.json() }; };
const pf = (...kodok) => ({ partialFailureError: { details: [{ errors: kodok.map(([i, c]) => ({ errorCode: { conversionUploadError: c }, location: { fieldPathElements: [{ fieldName: 'conversions', index: i }] } })) }] } });

test('A) alapbol KI: nincs kapcsolo -> nincs jelolt, nem ir; kulcs nelkul / hibas kulccsal 401; rossz metodus 405', async () => {
  const db = await ujDb([F(1)]);
  assert.equal(zapMod({}), 'ki'); assert.equal(zapMod({ GY_GADS_ELO_ZAP: 'eles' }), 'ki'); assert.equal(zapMod({ GY_GADS_ELO_ZAP: 'VALIDATE' }), 'validate');
  const env = await ENV({ GY_GADS_ELO_ZAP: undefined });
  const r = await hiv(db, env, 'GET'); assert.deepEqual(r.body, { ok: true, mod: 'ki', nincs: true }); assert.equal(sorok(db).length, 0);
  assert.equal((await hiv(db, await ENV(), 'GET', null, '')).status, 401); assert.equal((await hiv(db, await ENV(), 'GET', null, 'rossz')).status, 401);
  assert.equal((await eloZapVegpont({ request: kerelem('DELETE'), env: { ...(await ENV()), GY_DB: db } })).status, 405);
});

test('B) GET: hianyzo tol / titkos kulcs -> nincs; jelolt nelkul nincs; a keres CSAK validateOnly=true, az ELO akcio, az order_id a bongeszonek kiadott HMAC', async () => {
  const f = F(1); const db = await ujDb([f]);
  assert.equal((await hiv(db, await ENV({ GY_GADS_ELO_TOL: undefined }), 'GET')).body.miert, 'nincs_tol');
  assert.equal((await hiv(db, await ENV({ GY_HMAC_KULCS: undefined }), 'GET')).body.miert, 'nincs_titkos_kulcs');
  assert.equal((await hiv(db, await ENV(), 'GET')).body.db, 1);
  const db2 = await ujDb([]); assert.equal((await hiv(db2, await ENV(), 'GET')).body.miert, 'nincs_jelolt');
  const db3 = await ujDb([F(1)]); const r = (await hiv(db3, await ENV(), 'GET')).body;
  assert.equal(r.keres.validateOnly, true); assert.equal(r.keres.partialFailure, true); assert.equal(r.keres.conversions.length, 1);
  const c = r.keres.conversions[0];
  assert.equal(c.conversionAction, 'customers/2596120588/conversionActions/7362127659'); assert.equal(c.orderId, await tranzakcioId(f.uuid, KULCS)); assert.equal(c.gclid, GCLID + '1'); assert.equal(c.conversionValue, 19000); assert.equal(c.currencyCode, 'HUF');
  assert.ok(r.zar && r.zar.length >= 16); assert.equal(r.cel.akcio, '7362127659');
  assert.deepEqual(sorok(db3).map((s) => [s.mod, s.allapot, s.probalkozas]), [['zap_validate', 'lefoglalva', 1]]);
  assert.equal(JSON.stringify(sorok(db3)).includes(GCLID), false, 'nyers click-ID nincs a tarolt allapotban');
});

test('C) vedohaloElo: validateOnly=false / mas akcio / mas mezo / hibas order_id / hibas click-ID / tul nagy adag elutasitva', () => {
  const jo = () => ({ partialFailure: true, validateOnly: true, conversions: [{ gclid: GCLID + '1', conversionAction: 'customers/2596120588/conversionActions/7362127659', conversionDateTime: 'x', conversionValue: 19000, currencyCode: 'HUF', orderId: 'a'.repeat(64) }] });
  assert.equal(vedohaloElo(jo()), null);
  const m = (f) => { const k = jo(); f(k); return vedohaloElo(k); };
  assert.equal(m((k) => { k.validateOnly = false; }), 'nem_validate_only'); assert.equal(m((k) => { delete k.validateOnly; }), 'nem_validate_only');
  assert.equal(m((k) => { k.partialFailure = false; }), 'partial_failure'); assert.equal(m((k) => { k.extra = 1; }), 'ismeretlen_fomezo');
  assert.equal(m((k) => { k.conversions[0].conversionAction = 'customers/2596120588/conversionActions/7858300772'; }), 'akcio');
  assert.equal(m((k) => { k.conversions[0].userIdentifiers = []; }), 'ismeretlen_mezo'); assert.equal(m((k) => { k.conversions[0].orderId = 'x'; }), 'order_id');
  assert.equal(m((k) => { k.conversions[0].gclid = 'rovid'; }), 'click_id'); assert.equal(m((k) => { k.conversions[0].conversionValue = 1; }), 'ertek');
  assert.equal(m((k) => { k.conversions[0].consent = { adUserData: 'DENIED', adPersonalization: 'GRANTED' }; }), 'consent');
  assert.equal(m((k) => { k.conversions = Array.from({ length: 11 }, () => jo().conversions[0]); }), 'adag'); assert.equal(m((k) => { k.conversions = []; }), 'adag');
  const gb = jo(); delete gb.conversions[0].gclid; gb.conversions[0].gbraid = GCLID + '1'; assert.equal(vedohaloElo(gb), 'click_id'); assert.equal(vedohaloElo(gb, { braid: true }), null);
});

test('D) a lefoglalt sor nem valaszthato ujra (nincs dupla), a lejart zar utan ujra; a jogosultsag a Worker-sweep szabalyai szerint (igazolt, nem teszt, nem braid, click-ID jo, tol utan)', async () => {
  const db = await ujDb([F(1), F(2, { igazolt: false }), F(3, { teszt: true }), F(4, { gads_katt_tipus: 'gbraid', gads_katt_ertek: GCLID + '4' }), F(5, { gads_katt_ertek: 'rovid' }), F(6, { hozzajarulas: 'nem' })]);
  const env = await ENV();
  const a = (await hiv(db, env, 'GET')).body; assert.equal(a.db, 1); assert.deepEqual(a.kihagyva, { kihagyva_braid: 1, kihagyva_click_id: 1 });
  const b = (await hiv(db, env, 'GET')).body; assert.equal(b.miert, 'nincs_jelolt', 'a lefoglalt sor nem kerul ujra a keresbe');
  const ujra = await eloZapKivalaszt({ db, env, most: MOST + 901 }); assert.equal(ujra.body.db, 1, 'a lejart zar utan ujra kivalaszthato');
});

test('E) POST: elfogadva / soronkenti Google hibakod / mar_bent; a zar egyszer hasznalhato; ismeretlen zar 409; a valasz csak darabszam + hibakod', async () => {
  const db = await ujDb([F(1), F(2), F(3)]); const env = await ENV();
  const g = (await hiv(db, env, 'GET')).body; assert.equal(g.db, 3);
  const r = await hiv(db, env, 'POST', { zar: g.zar, http: 200, valasz: JSON.stringify(pf([1, 'EXPIRED_EVENT'], [2, 'ORDER_ID_ALREADY_IN_USE'])) });
  assert.equal(r.status, 200); assert.deepEqual([r.body.feldolgozva, r.body.elfogadva, r.body.mar_bent, r.body.hiba], [3, 1, 1, 1]); assert.deepEqual(r.body.kodok, { EXPIRED_EVENT: 1, ORDER_ID_ALREADY_IN_USE: 1 });
  assert.deepEqual(sorok(db).map((s) => [s.allapot, s.hiba]), [['mar_bent', 'ORDER_ID_ALREADY_IN_USE'], ['hiba', 'EXPIRED_EVENT'], ['elfogadva', null]]); // uuid szerint; a keres sorrendje: a legregebbi foglalas (F3) az 0. index
  assert.equal((await hiv(db, env, 'POST', { zar: g.zar, http: 200, valasz: {} })).body.hiba, 'mar_lezarva');
  assert.equal((await hiv(db, env, 'POST', { zar: 'x'.repeat(40), http: 200, valasz: {} })).body.hiba, 'ismeretlen_zar');
  assert.equal((await hiv(db, env, 'POST', { zar: 'rovid', http: 200, valasz: {} })).body.hiba, 'ervenytelen_torzs');
  assert.equal(JSON.stringify(r.body).includes(GCLID), false);
  // az elfogadva / mar_bent sor veglegesnek szamit: nem kerul ujra kivalasztasra
  assert.equal((await eloZapKivalaszt({ db, env, most: MOST + 3600 })).body.db, 1, 'csak a hibas sor kerul ujra (legfeljebb 3 probaig)');
});

test('F) keres-szintu hiba (401 UNAUTHENTICATED): minden sor hiba a keres-szintu kodkal, a Google uzenete nem kerul tarolasra; 3 sikertelen proba utan nem valaszthato ujra', async () => {
  const db = await ujDb([F(1)]); const env = await ENV();
  for (let i = 0; i < 3; i += 1) {
    const g = await eloZapKivalaszt({ db, env, most: MOST + i * 4000 }); assert.equal(g.body.db, 1);
    const r = await eloZapFazis({ db, env, most: MOST + i * 4000, be: { zar: g.body.zar, http: 401, valasz: { error: { status: 'UNAUTHENTICATED', message: 'szabad szoveg ' + GCLID } } } });
    assert.equal(r.body.keres_hiba.kod, 'UNAUTHENTICATED'); assert.equal(r.body.hiba, 1);
  }
  assert.deepEqual(sorok(db).map((s) => [s.allapot, s.hiba, s.http, s.probalkozas]), [['hiba', 'UNAUTHENTICATED', 401, 3]]);
  assert.equal(JSON.stringify(sorok(db)).includes('szabad szoveg'), false);
  assert.equal((await eloZapKivalaszt({ db, env, most: MOST + 20000 })).body.miert, 'nincs_jelolt');
});

test('G) a Worker nem hivja a Google Ads-et (nincs fetch), es nem kell GOOGLE_ADS_* titok; a masik (Worker-sweep) validate sor nem akadalyozza; hibas torzs 400', async () => {
  const eredeti = globalThis.fetch; let hivasok = 0; globalThis.fetch = async () => { hivasok += 1; throw new Error('tilos'); };
  try {
    const db = await ujDb([F(1)]); const env = await ENV();
    assert.equal('GOOGLE_ADS_REFRESH_TOKEN' in env, false);
    const g = (await hiv(db, env, 'GET')).body; assert.equal(g.db, 1);
    await hiv(db, env, 'POST', { zar: g.zar, http: 200, valasz: {} });
    assert.equal(hivasok, 0);
    const r = await eloZapVegpont({ request: new Request('https://x/api/gy-gads-elo-zap', { method: 'POST', headers: { 'x-gy-zap-kulcs': ZAPKULCS }, body: '{nem json' }), env: { ...env, GY_DB: db } });
    assert.equal(r.status, 400);
  } finally { globalThis.fetch = eredeti; }
  // egy korabbi Worker-sweep (mod=validate, elfogadva) sor mas modban van: a zap-proba ettol meg lefut
  const db2 = await ujDb([F(1)]); await eloSema(db2);
  await db2.prepare("INSERT INTO gy_feltoltes_elo (uuid, mod, allapot, probalkozas, letrehozva, frissitve) VALUES (?, 'validate', 'elfogadva', 1, ?, ?)").bind(F(1).uuid, MOST, MOST).run();
  assert.equal((await hiv(db2, await ENV(), 'GET')).body.db, 1);
});
