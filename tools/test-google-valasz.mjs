// UJ-11 (#167 6321101806): Google ARNYEK feltoltes valasz-naplo (meres_kuldes.ad_user_data + google_reszleges_hiba, POST /api/meres-google-valasz, qa-nap google_valasz sor).
//   node --test tools/test-google-valasz.mjs
// Valodi SQLite (node:sqlite) a D1 helyett (lib-sd-teszt.mjs); semmi nem megy ki a halozatra, nincs titok, nincs szemelyes adat.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sema } from '../netlify/lib/foglalas-kulcs.js';
import { elosztas, erkezesMent, meresSema } from '../netlify/lib/meres/elosztas.js';
import { googleValaszRogzit, kezelGoogleValasz } from '../netlify/lib/meres/google-valasz.js';
import { napIntervallum, qaNap } from '../netlify/lib/meres/qa-nap.js';
import { d1 } from './lib-sd-teszt.mjs';

const KULCS = 'google-valasz-teszt-kulcs-0123456789';
const KULCS_HASH = crypto.createHash('sha256').update(KULCS).digest('hex');
const NOW = Date.UTC(2026, 9, 12, 10, 0, 0);
const IDO = Math.floor(NOW / 1000) - 60;
const BID = 'mb_0muwq2ciorsos0tznsfyliq';
const BID2 = 'mb_0muwq2ciorsos0tznsfyli2';
const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789';
const ENV = { MERES_ELOSZTO: '1', META_TESZT_KOD: 'TEST1', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/teszt/' };
const FK = (sid, o = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: sid, jelleg: 'elso', kupon: false, ertek: 26900, ido: IDO, szolgaltatas: 'HeadSpa', vendeg: { email: 'Teszt.Claude@Example.com', telefon: '06 30 000 0001' }, ...o });
const erk = (sid, hozz) => ({ source_id: sid, uzletag: 'headspa', attr: { google: { gclid: { ertek: GCLID, ts: IDO - 100 } }, ga4: { client_id: '1234567890.1759759200' } }, hozz, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/success-foglalas-egyeni' });
const hamisFetch = async () => ({ status: 200, text: async () => '{}' });

async function vilag() {
  const D = d1(); const db = { prepare: D.prepare, batch: D.batch };
  await sema(db); await meresSema(db);
  return { D, db, sql: (q, ...a) => D.db.prepare(q).all(...a).map((r) => ({ ...r })) };
}
async function googleSor(w, sid, hozz) {
  await erkezesMent(w.db, erk(sid, hozz), NOW);
  await elosztas(w.db, FK(sid), { env: ENV, fetchImpl: hamisFetch, now: () => NOW });
  return w.sql("SELECT id, esemeny_id, allapot, ad_user_data, google_reszleges_hiba, platform_valasz FROM meres_kuldes WHERE platform = 'google' AND source_id = ?1 AND esemeny_tipus = 'alap'", sid)[0];
}

test('sema: ket uj, additiv oszlop (ad_user_data, google_reszleges_hiba); a meglevo sorok NULL-ok', async () => {
  const w = await vilag();
  const oszl = w.sql("SELECT name FROM pragma_table_info('meres_kuldes')").map((r) => r.name);
  assert.ok(oszl.includes('ad_user_data') && oszl.includes('google_reszleges_hiba'));
});
test('kuldeskor: a google sor ad_user_data-ja a kuldeskori ertek (GRANTED / DENIED), a visszajelzes NULL', async () => {
  const w = await vilag();
  const granted = await googleSor(w, BID, { ana: true, adv: true, fun: true });
  assert.equal(granted.allapot, 'elkuldve'); assert.equal(granted.ad_user_data, 'GRANTED'); assert.equal(granted.google_reszleges_hiba, null);
  const denied = await googleSor(w, BID2, { ana: true, adv: false, fun: true });
  assert.equal(denied.allapot, 'elkuldve'); assert.equal(denied.ad_user_data, 'DENIED');
});
test('googleValaszRogzit: OK (kod ures) / reszleges hiba / elso visszajelzes marad / maszkolas / hibas kod / ismeretlen sor', async () => {
  const w = await vilag();
  const s = await googleSor(w, BID, { ana: true, adv: true, fun: true });
  // reszleges hiba: a click ID-t, e-mailt, hash-t az uzenetbol kivesszuk
  const r1 = await googleValaszRogzit(w.db, { esemeny_id: s.esemeny_id, kod: 'UNPARSEABLE_GCLID', uzenet: `gclid=${GCLID} nem ertelmezheto, a@b.hu ${'a'.repeat(64)}`, elfogadva: 0, elutasitva: 1 }, NOW + 5000);
  assert.deepEqual([r1.status, r1.body.ok, r1.body.rogzitve, r1.body.kod], [200, true, true, 'UNPARSEABLE_GCLID']);
  const sor = w.sql('SELECT google_reszleges_hiba AS h, platform_valasz AS v FROM meres_kuldes WHERE id = ?1', s.id)[0];
  assert.equal(sor.h, 'UNPARSEABLE_GCLID');
  assert.match(sor.v, /google_valasz:UNPARSEABLE_GCLID elfogadva=0 elutasitva=1/);
  assert.ok(!sor.v.includes(GCLID) && !sor.v.includes('a@b.hu') && !sor.v.includes('a'.repeat(64)), 'click ID / e-mail / hash nem kerul a naploba');
  // az elso visszajelzes marad (ujrajatszas / mas kod nem irja felul)
  const r2 = await googleValaszRogzit(w.db, { esemeny_id: s.esemeny_id, kod: '' }, NOW + 9000);
  assert.deepEqual([r2.status, r2.body.mar_rogzitve], [200, true]);
  assert.equal(w.sql('SELECT google_reszleges_hiba AS h FROM meres_kuldes WHERE id = ?1', s.id)[0].h, 'UNPARSEABLE_GCLID');
  // OK: kod ures -> '' (nem NULL)
  const s2 = await googleSor(w, BID2, { ana: true, adv: true, fun: true });
  const r3 = await googleValaszRogzit(w.db, { id: s2.id, kod: '', elfogadva: 1, elutasitva: 0 }, NOW);
  assert.equal(r3.status, 200); assert.equal(w.sql('SELECT google_reszleges_hiba AS h FROM meres_kuldes WHERE id = ?1', s2.id)[0].h, '');
  // hibas kod / ismeretlen / nem google sor / hianyzo azonosito / nem objektum
  assert.equal((await googleValaszRogzit(w.db, { esemeny_id: s.esemeny_id, kod: 'kisbetu' }, NOW)).status, 422);
  assert.equal((await googleValaszRogzit(w.db, { esemeny_id: 'FoglalasElso:mb_nincs', kod: 'X' }, NOW)).status, 404);
  const meta = w.sql("SELECT id FROM meres_kuldes WHERE platform = 'meta' LIMIT 1")[0];
  assert.equal((await googleValaszRogzit(w.db, { id: meta.id, kod: 'X' }, NOW)).status, 404, 'csak google sor');
  assert.equal((await googleValaszRogzit(w.db, { kod: 'X' }, NOW)).status, 400);
  assert.equal((await googleValaszRogzit(w.db, null, NOW)).status, 400);
});
test('kezelGoogleValasz: kulcs csak fejlecben (rossz / hianyzo / query-kulcs = 404), 405 / 400 / 413, siker', async () => {
  const w = await vilag();
  const s = await googleSor(w, BID, { ana: true, adv: true, fun: true });
  const env = { KULCS_DB: w.db, MERES_GOOGLE_VALASZ_KULCS_HASH: KULCS_HASH };
  const kerj = (o = {}, fejlec = { 'x-meres-google-kulcs': KULCS }, url = 'https://x.test/api/meres-google-valasz') => new Request(url, { method: 'POST', headers: fejlec, body: JSON.stringify({ esemeny_id: s.esemeny_id, kod: '', ...o }), ...o.__init });
  assert.equal((await kezelGoogleValasz(kerj({}, {}), env)).status, 404, 'kulcs nelkul');
  assert.equal((await kezelGoogleValasz(kerj({}, { 'x-meres-google-kulcs': 'rossz' }), env)).status, 404);
  assert.equal((await kezelGoogleValasz(kerj({}, {}, `https://x.test/api/meres-google-valasz?kulcs=${KULCS}`), env)).status, 404, 'a query-kulcs nem fogadhato el');
  assert.equal((await kezelGoogleValasz(kerj(), { ...env, MERES_GOOGLE_VALASZ_KULCS_HASH: '' })).status, 404, 'beallitas nelkul nincs vegpont');
  assert.equal((await kezelGoogleValasz(new Request('https://x.test/a', { method: 'GET', headers: { 'x-meres-google-kulcs': KULCS } }), env)).status, 405);
  assert.equal((await kezelGoogleValasz(new Request('https://x.test/a', { method: 'POST', headers: { 'x-meres-google-kulcs': KULCS }, body: 'nem json' }), env)).status, 400);
  assert.equal((await kezelGoogleValasz(new Request('https://x.test/a', { method: 'POST', headers: { 'x-meres-google-kulcs': KULCS }, body: 'x'.repeat(5000) }), env)).status, 413);
  assert.equal((await kezelGoogleValasz(kerj(), { ...env, KULCS_DB: null })).status, 503);
  const ok = await kezelGoogleValasz(kerj({ kod: 'ZAP_HIBA' }), env);
  assert.equal(ok.status, 200); assert.equal((await ok.json()).kod, 'ZAP_HIBA');
  assert.equal(w.sql('SELECT google_reszleges_hiba AS h FROM meres_kuldes WHERE id = ?1', s.id)[0].h, 'ZAP_HIBA');
});
test('qaNap.google_valasz: uzletagonkenti darabszamok (elkuldve / google_elfogadta / denied / reszleges_hiba / nincs_visszajelzes); regi sema: sema_hianyzik', async () => {
  const w = await vilag();
  const a = await googleSor(w, BID, { ana: true, adv: true, fun: true }); // GRANTED
  const b = await googleSor(w, BID2, { ana: true, adv: false, fun: true }); // DENIED
  await googleValaszRogzit(w.db, { id: a.id, kod: '', elfogadva: 1 }, NOW);
  await googleValaszRogzit(w.db, { id: b.id, kod: 'CONSENT_DENIED' }, NOW);
  const nap = napIntervallum('2026-10-12', NOW + 86400000);
  let r = await qaNap(w.db, nap, { mostMs: NOW + 86400000 });
  assert.deepEqual(r.szekcio_hibak, [], 'nincs szekcio-hiba');
  assert.deepEqual(r.google_valasz.osszes, { elkuldve: 2, google_elfogadta: 1, denied: 1, reszleges_hiba: 1, nincs_visszajelzes: 0 });
  assert.deepEqual(r.google_valasz.uzletagok.headspa, r.google_valasz.osszes);
  // a visszajelzes nelkuli sor: nincs_visszajelzes
  const c = await googleSor(w, 'mb_0muwq2ciorsos0tznsfyli3', { ana: true, adv: true, fun: true });
  r = await qaNap(w.db, nap, { mostMs: NOW + 86400000 });
  assert.equal(r.google_valasz.osszes.nincs_visszajelzes, 1); assert.equal(r.google_valasz.osszes.elkuldve, 3);
  assert.ok(c.id);
  // regi sema (a ket oszlop nelkul)
  const D = d1(); const db = { prepare: D.prepare, batch: D.batch };
  await sema(db);
  D.db.prepare('CREATE TABLE meres_kuldes (id INTEGER PRIMARY KEY AUTOINCREMENT, esemeny_id TEXT NOT NULL, esemeny_nev TEXT NOT NULL, esemeny_tipus TEXT NOT NULL, platform TEXT NOT NULL, platform_nev TEXT, uzletag TEXT NOT NULL, source_id TEXT NOT NULL, allapot TEXT NOT NULL, letrehozva INTEGER NOT NULL, frissitve INTEGER NOT NULL)').run();
  const regi = await qaNap(db, nap, { mostMs: NOW + 86400000 });
  assert.deepEqual(regi.google_valasz, { sema_hianyzik: true });
});
