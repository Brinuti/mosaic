// ELETUT-esemenyek egysegtesztjei (DECISION-LOG #102): netlify/lib/meres/eletut-modell.js, eletut-kerelem.js, eletut.js, nyelo mod, /api/foglalas-eletut, ajandekkartya-visszaterites
//   node --test tools/test-eletut.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { ELETUT_ALLAPOTOK, atmenet, diagNev, eletutEsemenyId, idoRendben, kezdesAKulcsbol, korrekcioId, visszavonasId, visszateritesId } from '../netlify/lib/meres/eletut-modell.js';
import { ga4RefundKerelem, googleKorrekcioKerelem, metaDiagKerelem, tiktokDiagKerelem } from '../netlify/lib/meres/eletut-kerelem.js';
import { eletutFeldolgoz, eletutOlvas, eletutRiasztasok, fuggoFeldolgoz, visszateritesFeldolgoz } from '../netlify/lib/meres/eletut.js';
import { elosztas, erkezesMent, kapcsoloBeallit } from '../netlify/lib/meres/elosztas.js';
import { kuldes, googleIdo } from '../netlify/lib/meres/platformok.js';
import { kezelEletut, kezelAdmin } from '../netlify/lib/meres/vegpontok.js';
import { sema as kulcsSema } from '../netlify/lib/foglalas-kulcs.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
const BID = 'mb_0muwq2ciorsos0tznsfyliq';
const UUID = '2aae042b-7acf-30e2-017f-66febe61e2e3';
const PI = 'pi_3Sabc123XYZabc456';
const NOW = Date.UTC(2026, 9, 6, 14, 0, 0);
const IDO = Math.floor(NOW / 1000) - 60;
const H = 3600 * 1000;
const ENV = {
  MERES_ELOSZTO: '1', MERES_ELETUT: '1', MERES_NAPLO_TELJES: '1', META_TESZT_KOD: 'TEST83939', TIKTOK_TESZT_KOD: 'TEST83543', GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001',
  META_CAPI_TOKEN: 't', TIKTOK_EVENTS_TOKEN: 't', GA4_TESZT_API_SECRET: 't', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/alap/', GOOGLE_KORREKCIO_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/korrekcio/',
};
const BE = () => ({
  google: { wbraid: { ertek: 'CoMKCQ_wbraid_TESZT_0123', ts: IDO - 50 } }, meta: { fbc: `fb.1.${(IDO - 90) * 1000}.IwAR_fbclid_TESZT_01`, fbclid: 'IwAR_fbclid_TESZT_01', ts: IDO - 90 },
  tiktok: { ttclid: { ertek: 'E.C.P.ttclid_TESZT_01', ts: IDO - 80 } }, fbp: `fb.1.${(IDO - 9000) * 1000}.1234567890`, ttp: 'ttp_TESZT_0123456789abcdef',
  ga4: { client_id: '1234567890.1759759200', session_id: '1759759200', measurement_id: 'G-H4206SQ0Q7' },
});
const FK = (o = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: BID, jelleg: 'elso', kupon: false, ertek: 26900, ido: IDO, szolgaltatas: 'HeadSpa', vendeg: { email: 'Teszt.Claude@Example.com', telefon: '06 70 942 0090' }, ...o });
const SIKER = { meta: { events_received: 1, messages: [], fbtrace_id: 'trace' }, tiktok: { code: 0, message: 'OK', request_id: 'req' }, google: { status: 'success', id: 'abc' }, korrekcio: { status: 'success', id: 'kor' }, ga4: '' };
const hamis = () => {
  const hivasok = [];
  const f = async (url, o) => {
    const u = String(url);
    if (u.includes('/debug/mp/collect')) return { status: 200, text: async () => JSON.stringify({ validationMessages: [] }) };
    const kulcs = u.includes('graph.facebook.com') ? 'meta' : u.includes('business-api.tiktok.com') ? 'tiktok' : u.includes('/catch/1/korrekcio/') ? 'korrekcio' : u.includes('hooks.zapier.com') ? 'google' : 'ga4';
    hivasok.push({ kulcs, url: u, body: JSON.parse(o.body) });
    return { status: kulcs === 'ga4' ? 204 : 200, text: async () => (typeof SIKER[kulcs] === 'string' ? SIKER[kulcs] : JSON.stringify(SIKER[kulcs])) };
  };
  return { f, hivasok };
};
/** A foglalas LETREHOZASA: bongeszo erkezesi adat + a (QA-2) alap- es ernyoesemenyek kuldese a hamis halozaton. */
async function letrehoz(o = {}) {
  const db = d1(); const fk = FK(o.fk); const h = hamis();
  await erkezesMent(db, { source_id: fk.source_entity_id, uzletag: fk.uzletag, attr: o.attr || BE(), hozz: o.hozz || { ana: true, adv: true, fun: true }, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/koszonjuk' }, NOW);
  const r = await elosztas(db, fk, { env: { ...ENV, ...(o.env || {}) }, fetchImpl: h.f, now: () => NOW });
  return { db, fk, h, r };
}
const sor = (db, sql, ...a) => db.prepare(sql).bind(...a).all().then((x) => x.results);
const eletut = (db, be, d = {}) => eletutFeldolgoz(db, { source_id: BID, ...be }, { env: ENV, now: () => NOW + 2 * H, ...d });

// --- modell -----------------------------------------------------------------------------------------------------------------------------------
test('eletut-modell: azonositok, diagnosztikai nevek, allapotgep (azonos = idempotens, mas = ellentmondas), idoszeruseg, kezdes a kulcsbol', () => {
  assert.deepEqual([...ELETUT_ALLAPOTOK], ['lemondva', 'nem_jelent_meg', 'megjelent']);
  assert.deepEqual([eletutEsemenyId('megjelent', BID), eletutEsemenyId('nem_jelent_meg', BID), visszavonasId(`FoglalasElso:${BID}`), korrekcioId(`Ajandekkartya:${PI}`, 5000), visszateritesId(PI, 5000)],
    [`Megjelent:${BID}`, `NemJelentMeg:${BID}`, `Visszavonas:FoglalasElso:${BID}`, `Korrekcio:Ajandekkartya:${PI}:5000`, `Visszaterites:${PI}:5000`]);
  assert.deepEqual([diagNev('megjelent', 'pmu'), diagNev('nem_jelent_meg', 'headspa'), diagNev('megjelent', 'szor'), diagNev('megjelent', 'oxigen'), diagNev('megjelent', 'fodrasz')], ['PMU_Megjelent', 'HeadSpa_NemJelentMeg', 'Szor_Megjelent', 'Oxigen_Megjelent', 'Fodrasz_Megjelent']);
  assert.deepEqual(atmenet(null, 'lemondva'), { ok: true }); assert.deepEqual(atmenet('megjelent', 'megjelent'), { ok: true, idempotens: true });
  for (const [a, b] of [['megjelent', 'nem_jelent_meg'], ['nem_jelent_meg', 'megjelent'], ['lemondva', 'megjelent'], ['megjelent', 'lemondva']]) assert.equal(atmenet(a, b).ok, false, `${a} -> ${b}`);
  assert.equal(atmenet(null, 'ismeretlen').ok, false);
  assert.equal(idoRendben('megjelent', 2000000000, 1999999999).ok, false, 'az idopont kezdete elott nem lehet megjelent'); assert.equal(idoRendben('megjelent', 2000000000, 2000000001).ok, true);
  assert.equal(idoRendben('lemondva', 2000000000, 1000).ok, true, 'a lemondas barmikor jon'); assert.equal(idoRendben('nem_jelent_meg', null, 1).ok, true, 'ismeretlen kezdes: nincs korlat');
  assert.equal(kezdesAKulcsbol('10427|24354|1793469600'), 1793469600); assert.equal(kezdesAKulcsbol('rossz'), null);
});

// --- kerelem-epitok ----------------------------------------------------------------------------------------------------------------------------
test('Google-korrekcio (Zapier, a 01a0e569 minta szerint): RETRACTION / RESTATEMENT torzs, dryRun ALAPBOL, eles csak GOOGLE_KORREKCIO_ELES=1; csak ARNYEK akcio; nem a jovoben; a cim titok', () => {
  const nowSec = Math.floor(NOW / 1000);
  const k = googleKorrekcioKerelem({ tipus: 'RETRACTION', orderId: `FoglalasElso:${BID}`, akcioId: '7825199989', idoUnix: nowSec - 10, megjegyzes: 'lemondva' }, {}, nowSec);
  assert.deepEqual(Object.keys(k.body).sort(), ['adjustments', 'dryRun']); assert.equal(k.body.dryRun, true, 'alapbol dryRun');
  assert.deepEqual(k.body.adjustments[0], { type: 'RETRACTION', orderId: `FoglalasElso:${BID}`, conversionActionId: '7825199989', adjustmentDateTime: googleIdo(nowSec - 10), note: 'lemondva' });
  assert.match(k.body.adjustments[0].adjustmentDateTime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/, 'a Zap DATE_RE-je');
  assert.equal(k.webhook_env, 'GOOGLE_KORREKCIO_WEBHOOK_URL'); assert.ok(!/hooks\.zapier\.com/.test(k.url), 'a webhook-cim titok'); assert.equal(k.cel.dry_run, true);
  assert.equal(googleKorrekcioKerelem({ tipus: 'RETRACTION', orderId: 'x', akcioId: '7825199989', idoUnix: nowSec }, { GOOGLE_KORREKCIO_ELES: '1' }, nowSec).body.dryRun, false, 'eles csak kifejezett beallitassal');
  const r = googleKorrekcioKerelem({ tipus: 'RESTATEMENT', orderId: 'x', akcioId: '7825199992', idoUnix: nowSec, ertek: 13450.4 }, {}, nowSec).body.adjustments[0];
  assert.deepEqual([r.type, r.value, r.currency], ['RESTATEMENT', 13450, 'HUF']);
  assert.match(googleKorrekcioKerelem({ tipus: 'RESTATEMENT', orderId: 'x', akcioId: '7825199992', idoUnix: nowSec, ertek: 0 }, {}, nowSec).tiltva, /pozitiv/);
  for (const elo of ['7497204933', '7030256606', '7803645055', '123']) assert.match(googleKorrekcioKerelem({ tipus: 'RETRACTION', orderId: 'x', akcioId: elo, idoUnix: nowSec }, {}, nowSec).tiltva, /ARNYEK/, 'elo / ismeretlen akcio TILTVA: ' + elo);
  assert.match(googleKorrekcioKerelem({ tipus: 'RETRACTION', orderId: 'x', akcioId: '7825199989', idoUnix: nowSec + 60 }, {}, nowSec).tiltva, /jovoben/);
  assert.match(googleKorrekcioKerelem({ tipus: 'RETRACTION', orderId: 'x'.repeat(65), akcioId: '7825199989', idoUnix: nowSec }, {}, nowSec).tiltva, /order_id/);
  assert.match(googleKorrekcioKerelem({ tipus: 'MAS', orderId: 'x', akcioId: '7825199989', idoUnix: nowSec }, {}, nowSec).tiltva, /tipus/);
});
test('Meta / TikTok diagnosztikai esemeny: NEM konverzio (nincs value / currency), egyedi nev, sajat event_id, csak ARNYEK + tesztkod, 7 napnal regebbi nem megy, felhasznaloi adat nelkul kihagyva', () => {
  const nowSec = Math.floor(NOW / 1000);
  const d = { nev: 'HeadSpa_Megjelent', esemenyId: `Megjelent:${BID}`, idoUnix: nowSec - 100, allapot: 'megjelent', user: { em: ['a'.repeat(64)], fbc: 'fb.1.1.x' }, sourceId: BID, uzletag: 'headspa' };
  const m = metaDiagKerelem(d, { META_TESZT_KOD: 'TEST83939' }, nowSec); const e = m.body.data[0];
  assert.deepEqual([e.event_name, e.event_id, e.action_source, e.custom_data.esemeny_tipus, e.custom_data.eletut_allapot, m.body.test_event_code, m.cel.dataset], ['HeadSpa_Megjelent', `Megjelent:${BID}`, 'physical_store', 'diagnosztika', 'megjelent', 'TEST83939', '28616665324611098']);
  assert.ok(!('value' in e.custom_data) && !('currency' in e.custom_data), 'nem konverzio: nincs ertek'); assert.equal(metaDiagKerelem({ ...d, allapot: 'nem_jelent_meg' }, { META_TESZT_KOD: 'T' }, nowSec).body.data[0].action_source, 'other');
  assert.match(metaDiagKerelem(d, {}, nowSec).tiltva, /META_TESZT_KOD/); assert.match(metaDiagKerelem(d, { META_TESZT_KOD: 'T', META_ARNYEK_DATASET: '3473839859576758' }, nowSec).tiltva, /ARNYEK/);
  assert.match(metaDiagKerelem({ ...d, idoUnix: nowSec - 8 * 86400 }, { META_TESZT_KOD: 'T' }, nowSec).kihagyva, /7 napnal/); assert.match(metaDiagKerelem({ ...d, user: {} }, { META_TESZT_KOD: 'T' }, nowSec).kihagyva, /felhasznaloi adat/);
  const t = tiktokDiagKerelem({ ...d, nev: 'HeadSpa_NemJelentMeg', esemenyId: `NemJelentMeg:${BID}`, allapot: 'nem_jelent_meg', user: { email: 'b'.repeat(64) } }, { TIKTOK_TESZT_KOD: 'TEST83543' }, nowSec); const te = t.body.data[0];
  assert.deepEqual([te.event, te.event_id, t.body.test_event_code, t.body.event_source_id, 'value' in te.properties], ['HeadSpa_NemJelentMeg', `NemJelentMeg:${BID}`, 'TEST83543', 'DB2GTTJC77UE4D1NE4MG', false]);
  assert.match(tiktokDiagKerelem(d, {}, nowSec).tiltva, /TIKTOK_TESZT_KOD/); assert.match(tiktokDiagKerelem(d, { TIKTOK_TESZT_KOD: 'T', TIKTOK_ARNYEK_PIXEL: 'CTDGK5BC77U0PIODKP30' }, nowSec).tiltva, /ARNYEK/);
  assert.notEqual(te.event, 'CompletePayment');
});
test('GA4 refund: csak teszt-property, transaction_id = a pi_, a visszaterites erteke, client_id kell, 72 oranal regebbi kimarad; az elo property TILTVA', () => {
  const nowSec = Math.floor(NOW / 1000); const d = { transactionId: PI, ertek: 8000, idoUnix: nowSec - 5, client: { client_id: '1.2', session_id: '3' }, consent: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' }, esemenyId: visszateritesId(PI, 800000) };
  const k = ga4RefundKerelem(d, { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' }, nowSec); const ev = k.body.events[0];
  assert.deepEqual([ev.name, ev.params.transaction_id, ev.params.value, ev.params.currency, k.cel.measurement_id, k.body.client_id], ['refund', PI, 8000, 'HUF', 'G-TESZT00001', '1.2']);
  assert.match(ga4RefundKerelem(d, { GA4_TESZT_MEASUREMENT_ID: 'G-H4206SQ0Q7' }, nowSec).tiltva, /elo/); assert.match(ga4RefundKerelem(d, {}, nowSec).tiltva, /teszt-property/);
  assert.match(ga4RefundKerelem({ ...d, client: {} }, { GA4_TESZT_MEASUREMENT_ID: 'G-T' }, nowSec).tiltva, /client_id/); assert.match(ga4RefundKerelem({ ...d, idoUnix: nowSec - 80 * 3600 }, { GA4_TESZT_MEASUREMENT_ID: 'G-T' }, nowSec).kihagyva, /72/);
});

// --- nyelo mod ---------------------------------------------------------------------------------------------------------------------------------
test('NYELO MOD (MERES_KULDES_MOD=nyelo): a kerelem elkeszul es naplozodik, de NINCS halozati hivas, nincs szukseg titokra; nyelo modon kivul valodi hivas', async () => {
  let hivas = 0; const f = async () => { hivas++; return { status: 200, text: async () => '{}' }; };
  const k = metaDiagKerelem({ nev: 'X', esemenyId: 'e', idoUnix: Math.floor(NOW / 1000), allapot: 'megjelent', user: { em: ['a'] }, sourceId: BID, uzletag: 'headspa' }, { META_TESZT_KOD: 'T' }, Math.floor(NOW / 1000));
  const r = await kuldes(k, { MERES_KULDES_MOD: 'nyelo' }, f);
  assert.deepEqual([r.allapot, r.kuldo, hivas, JSON.parse(r.valasz).nyelo], ['elkuldve', 'nyelo', 0, true]);
  assert.equal((await kuldes(k, {}, f)).allapot, 'nincs_hitelesites', 'nyelo mod nelkul a titok hianya tovabbra is nincs_hitelesites'); assert.equal(hivas, 0);
  const t = await letrehoz({ env: { MERES_KULDES_MOD: 'nyelo' } });
  assert.equal(t.h.hivasok.length, 0, 'a letrehozas-esemenyek sem mennek ki'); const sorok = await sor(t.db, "SELECT allapot, kuldo FROM meres_kuldes WHERE allapot = 'elkuldve'");
  assert.ok(sorok.length === 6 && sorok.every((x) => x.kuldo === 'nyelo'), 'a naplo szerint elkuldve, kuldo = nyelo');
});

// --- eletut-feldolgozas (allapotgep + cellak) ---------------------------------------------------------------------------------------------------
test('LEMONDVA: elo ellenorzes torolve -> Google RETRACTION (dryRun alapbol: allapot "dryrun"), Meta / TikTok semmi; a kerelem a 01a0e569 sema szerint; ismetles = nincs uj kuldes', async () => {
  const { db } = await letrehoz(); const h = hamis();
  const r = await eletut(db, { allapot: 'lemondva', forras: 'teszt' }, { fetchImpl: h.f, eloEllenorzes: async () => 'torolve' });
  assert.deepEqual([r.allapot, r.eletut_allapot, r.cellak.map((c) => `${c.platform}:${c.allapot}`)], ['kesz', 'lemondva', ['google:dryrun']]);
  assert.equal(h.hivasok.length, 1); const b = h.hivasok[0];
  assert.equal(b.kulcs, 'korrekcio'); assert.match(b.url, /\/catch\/1\/korrekcio\//, 'a korrekcios webhook, nem az alap');
  assert.deepEqual(b.body.adjustments[0], { type: 'RETRACTION', orderId: `FoglalasElso:${BID}`, conversionActionId: '7825199989', adjustmentDateTime: googleIdo(Math.floor((NOW + 2 * H) / 1000)), note: `lemondva: ${BID}` });
  assert.equal(b.body.dryRun, true);
  const k = (await sor(db, "SELECT * FROM meres_kuldes WHERE esemeny_tipus = 'eletut'"))[0];
  assert.deepEqual([k.esemeny_id, k.platform, k.allapot, k.kuldo], [`Visszavonas:FoglalasElso:${BID}`, 'google', 'dryrun', 'zapier-webhook']);
  const r2 = await eletut(db, { allapot: 'lemondva' }, { fetchImpl: h.f, eloEllenorzes: async () => 'torolve' });
  assert.deepEqual([r2.allapot, h.hivasok.length], ['mar_kuldve', 1], 'a dryrun sor eles konfiguracio nelkul nem megy ujra');
  assert.equal((await sor(db, 'SELECT COUNT(*) AS n FROM (SELECT esemeny_id, platform FROM meres_kuldes GROUP BY esemeny_id, platform HAVING COUNT(*) > 1)'))[0].n, 0, '0 dupla');
});
test('ELES korrekcio (GOOGLE_KORREKCIO_ELES=1): dryRun:false, allapot "elkuldve"; a korabbi dryrun sor eles konfiguracional ujrafeldolgozhato (fuggo): ugyanaz a sor frissul, nem dupla', async () => {
  const { db } = await letrehoz(); const h = hamis();
  await eletut(db, { allapot: 'lemondva' }, { fetchImpl: h.f, eloEllenorzes: async () => 'torolve' }); assert.equal(h.hivasok[0].body.dryRun, true);
  const ELES = { ...ENV, GOOGLE_KORREKCIO_ELES: '1' };
  const fu = await fuggoFeldolgoz(db, { env: ELES, fetchImpl: h.f, now: () => NOW + 3 * H, feloldo: async () => ({ eloEllenorzes: async () => 'torolve' }) });
  assert.equal(fu.feldolgozott, 1); assert.equal(h.hivasok.length, 2); assert.equal(h.hivasok[1].body.dryRun, false);
  const sorok = await sor(db, "SELECT allapot, probalkozas FROM meres_kuldes WHERE esemeny_tipus = 'eletut'");
  assert.deepEqual(sorok.map((x) => [x.allapot, x.probalkozas]), [['elkuldve', 2]]);
  assert.equal((await fuggoFeldolgoz(db, { env: ELES, fetchImpl: h.f, now: () => NOW + 4 * H, feloldo: async () => ({ eloEllenorzes: async () => 'torolve' }) })).feldolgozott, 0, 'nincs mit ujraprobalni');
});
test('LEMONDVA vedelmek: a foglalas meg EL a Salonicban -> nem_torolve (nincs kuldes); nem ellenorizheto -> halasztva; nincs alapesemeny -> ismeretlen_foglalas; ki / ervenytelen bemenet', async () => {
  const { db } = await letrehoz(); const h = hamis();
  assert.equal((await eletut(db, { allapot: 'lemondva' }, { fetchImpl: h.f, eloEllenorzes: async () => 'aktiv' })).allapot, 'nem_torolve');
  const hal = await eletut(db, { allapot: 'lemondva' }, { fetchImpl: h.f, eloEllenorzes: async () => { throw new Error('halozat'); } }); assert.deepEqual([hal.allapot, hal.ujraprobal_mp], ['halasztva', 180]);
  assert.equal(h.hivasok.length, 0); assert.equal((await sor(db, 'SELECT * FROM meres_eletut')).length, 0, 'allapot nem rogzul, amig nincs elo ellenorzes');
  assert.equal((await eletutFeldolgoz(db, { source_id: 'mb_0muwxxxxxxxxxxxxxxxxxxx', allapot: 'lemondva' }, { env: ENV, eloEllenorzes: async () => 'torolve' })).allapot, 'ismeretlen_foglalas');
  assert.equal((await eletutFeldolgoz(db, { source_id: BID, allapot: 'lemondva' }, { env: { ...ENV, MERES_ELETUT: '0' } })).allapot, 'ki');
  assert.equal((await eletutFeldolgoz(db, { source_id: PI, allapot: 'lemondva' }, { env: ENV })).allapot, 'ervenytelen'); assert.equal((await eletutFeldolgoz(db, { source_id: BID, allapot: 'fizetve' }, { env: ENV })).allapot, 'ervenytelen');
});
test('NEM JELENT MEG: Google RETRACTION + Meta / TikTok "HeadSpa_NemJelentMeg" diagnosztika (event_id NemJelentMeg:<booking_id>, nincs ertek); a felhasznaloi adat az ERESETI alapesemenybol (em / ph / fbc / fbp), IP / UA nelkul', async () => {
  const { db } = await letrehoz(); const h = hamis();
  const r = await eletut(db, { allapot: 'nem_jelent_meg' }, { fetchImpl: h.f, eloEllenorzes: async () => 'aktiv', start: Math.floor(NOW / 1000) - 3600 });
  assert.deepEqual([r.allapot, r.cellak.map((c) => `${c.platform}:${c.allapot}`).sort()], ['kesz', ['google:dryrun', 'meta:elkuldve', 'tiktok:elkuldve']]);
  const meta = h.hivasok.find((x) => x.kulcs === 'meta').body.data[0], tt = h.hivasok.find((x) => x.kulcs === 'tiktok').body.data[0];
  assert.deepEqual([meta.event_name, meta.event_id, meta.action_source, meta.custom_data.esemeny_tipus, 'value' in meta.custom_data], ['HeadSpa_NemJelentMeg', `NemJelentMeg:${BID}`, 'other', 'diagnosztika', false]);
  assert.ok(meta.user_data.em && meta.user_data.ph && meta.user_data.fbc && meta.user_data.fbp && meta.user_data.external_id); assert.ok(!meta.user_data.client_ip_address && !meta.user_data.client_user_agent, 'a letrehozaskori IP / UA nem megy');
  assert.deepEqual([tt.event, tt.event_id], ['HeadSpa_NemJelentMeg', `NemJelentMeg:${BID}`]); assert.ok(tt.user.email && tt.user.phone && tt.user.ttclid && tt.user.ttp && !tt.user.ip && !tt.user.user_agent);
  assert.ok(!('value' in tt.properties));
  const ids = (await sor(db, "SELECT esemeny_id FROM meres_kuldes WHERE esemeny_tipus = 'eletut'")).map((x) => x.esemeny_id).sort();
  assert.deepEqual(ids, [`NemJelentMeg:${BID}`, `NemJelentMeg:${BID}`, `Visszavonas:FoglalasElso:${BID}`].sort(), 'az alap- / ernyo- / eletut-esemenyek azonositoi kulonbozoek');
});
test('MEGJELENT: Meta / TikTok "HeadSpa_Megjelent" diagnosztika (physical_store, nem konverzio), Google semmi; kulonbozo uzletag: PMU_Megjelent; a vendeg-adat felulirhato (friss hash)', async () => {
  const { db } = await letrehoz({ fk: { uzletag: 'pmu' } }); const h = hamis();
  const r = await eletut(db, { allapot: 'megjelent', vendeg: { email: 'Uj@Example.com', telefon: '+36 30 111 2222' } }, { fetchImpl: h.f, eloEllenorzes: async () => 'aktiv' });
  assert.deepEqual(r.cellak.map((c) => `${c.platform}:${c.allapot}`).sort(), ['meta:elkuldve', 'tiktok:elkuldve']); assert.ok(!h.hivasok.some((x) => x.kulcs === 'korrekcio'), 'megjelent: Google-korrekcio nincs');
  const meta = h.hivasok.find((x) => x.kulcs === 'meta').body.data[0];
  assert.deepEqual([meta.event_name, meta.event_id, meta.action_source], ['PMU_Megjelent', `Megjelent:${BID}`, 'physical_store']);
  const regi = JSON.parse((await sor(db, "SELECT kerelem FROM meres_kuldes WHERE platform = 'meta' AND esemeny_tipus = 'alap'"))[0].kerelem).body.data[0].user_data;
  assert.notDeepEqual(meta.user_data.em, regi.em, 'a friss vendeg-adat hash-e kerult be');
  assert.equal((await sor(db, "SELECT COUNT(*) AS n FROM meres_kuldes WHERE esemeny_tipus = 'eletut' AND platform = 'google'"))[0].n, 0);
});
test('ELLENTMONDAS: megjelent utan nem_jelent_meg / lemondva (es forditva) nem kuld semmit, riasztas + naplo; azonos allapot ismet idempotens', async () => {
  const { db } = await letrehoz(); const h = hamis(); const d = { fetchImpl: h.f, eloEllenorzes: async () => 'aktiv' };
  await eletut(db, { allapot: 'megjelent' }, d); const n = h.hivasok.length;
  const e1 = await eletut(db, { allapot: 'nem_jelent_meg' }, d); assert.deepEqual([e1.allapot, e1.riasztas, e1.eletut_allapot], ['ellentmondas', true, 'megjelent']);
  const e2 = await eletut(db, { allapot: 'lemondva' }, { fetchImpl: h.f, eloEllenorzes: async () => 'torolve' }); assert.equal(e2.allapot, 'ellentmondas'); assert.equal(h.hivasok.length, n, 'nem ment ki ellentmondo esemeny');
  assert.equal((await eletut(db, { allapot: 'megjelent' }, d)).allapot, 'mar_kuldve'); assert.equal(h.hivasok.length, n);
  const rj = await eletutRiasztasok(db); assert.equal(rj.length, 2); assert.ok(rj.every((x) => /^ellentmondas/.test(x.eredmeny)));
  const o = await eletutOlvas(db, BID); assert.deepEqual([o.allapot.allapot, o.naplo.length >= 4], ['megjelent', true]);
});
test('IDOSZERUSEG + ELO ALLAPOT: az idopont kezdete elott nincs megjelent / nem_jelent_meg (korai); torolt foglalasra nincs megjelent (torolt_foglalas)', async () => {
  const { db } = await letrehoz(); const h = hamis();
  const kor = await eletut(db, { allapot: 'megjelent' }, { fetchImpl: h.f, eloEllenorzes: async () => 'aktiv', start: Math.floor(NOW / 1000) + 86400 }); assert.equal(kor.allapot, 'korai');
  const tor = await eletut(db, { allapot: 'megjelent' }, { fetchImpl: h.f, eloEllenorzes: async () => 'torolve' }); assert.equal(tor.allapot, 'torolt_foglalas');
  assert.equal(h.hivasok.length, 0); assert.equal((await sor(db, 'SELECT * FROM meres_eletut')).length, 0);
});
test('HALASZTAS: a GOOGLE_KORREKCIO_VARAKOZAS_ORA ideje alatt a Google-cella halasztva; a fuggo-feldolgozas utana elkuldi (a Zap dryRun-nal)', async () => {
  const { db } = await letrehoz(); const h = hamis(); const E = { ...ENV, GOOGLE_KORREKCIO_VARAKOZAS_ORA: '24' };
  const r = await eletutFeldolgoz(db, { source_id: BID, allapot: 'lemondva' }, { env: E, fetchImpl: h.f, now: () => NOW + 2 * H, eloEllenorzes: async () => 'torolve' });
  assert.deepEqual([r.allapot, r.cellak[0].allapot], ['halasztva', 'halasztva']); assert.equal(h.hivasok.length, 0);
  assert.equal((await fuggoFeldolgoz(db, { env: E, fetchImpl: h.f, now: () => NOW + 12 * H, feloldo: async () => ({ eloEllenorzes: async () => 'torolve' }) })).eredmenyek[0].cellak[0], 'google=halasztva', 'meg kora');
  const fu = await fuggoFeldolgoz(db, { env: E, fetchImpl: h.f, now: () => NOW + 25 * H, feloldo: async () => ({ eloEllenorzes: async () => 'torolve' }) });
  assert.equal(fu.eredmenyek[0].cellak[0], 'google=dryrun'); assert.equal(h.hivasok.length, 1);
});
test('VESZKAPCSOLO + KIHAGYAS: platform:meta kikapcsolva -> a Meta-diagnosztika "kihagyva: veszkapcsolo"; ha az eredeti Google-konverzio nem ment ki (nincs kattintasazonosito), nincs mit visszavonni (kihagyva)', async () => {
  const { db } = await letrehoz(); const h = hamis();
  await kapcsoloBeallit(db, { platform: 'meta', be: false, ok: 'teszt' }, NOW);
  const r = await eletut(db, { allapot: 'nem_jelent_meg' }, { fetchImpl: h.f, eloEllenorzes: async () => 'aktiv' });
  assert.match(r.cellak.find((c) => c.platform === 'meta').indok, /^veszkapcsolo: platform:meta/); assert.ok(!h.hivasok.some((x) => x.kulcs === 'meta'));
  const t = await letrehoz({ attr: { fbp: BE().fbp, ga4: BE().ga4 } }); const h2 = hamis(); // kattintas nelkul: a Google-konverzio kihagyva
  const r2 = await eletut(t.db, { allapot: 'lemondva' }, { fetchImpl: h2.f, eloEllenorzes: async () => 'torolve' });
  assert.match(r2.cellak[0].indok, /nincs mit visszavonni/); assert.equal(h2.hivasok.length, 0);
});
test('MAS UZLETAG / KONZULTACIO: a szor-konzultacio megjelenese "Szor_Megjelent"; a kupon- / visszajaro foglalas is lemondhato (az eredeti Google-sor nelkul: nincs mit visszavonni)', async () => {
  const t = await letrehoz({ fk: { uzletag: 'szor', jelleg: 'konzultacio', ertek: 0 } }); const h = hamis();
  await eletut(t.db, { allapot: 'megjelent' }, { fetchImpl: h.f, eloEllenorzes: async () => 'aktiv' });
  assert.equal(h.hivasok.find((x) => x.kulcs === 'meta').body.data[0].event_name, 'Szor_Megjelent');
  const v = await letrehoz({ fk: { jelleg: 'visszajaro' } }); const r = await eletut(v.db, { allapot: 'lemondva' }, { fetchImpl: hamis().f, eloEllenorzes: async () => 'torolve' });
  assert.match(r.cellak[0].indok, /nincs mit visszavonni/);
});

// --- ajandekkartya visszaterites ---------------------------------------------------------------------------------------------------------------
async function kartya() {
  const db = d1(); const h = hamis(); const fk = { tipus: 'ajandekkartya', uzletag: 'headspa', source_entity_id: PI, ertek: 26900, ido: IDO, szolgaltatas: 'Ajandekkartya', vendeg: { email: 'Teszt.Claude@Example.com', telefon: '' }, forras: 'kartya' };
  await erkezesMent(db, { source_id: PI, uzletag: 'headspa', tipus: 'ajandekkartya', attr: BE(), hozz: { ana: true, adv: true, fun: true }, ua: 'UA', ip: '203.0.113.7', oldal: 'https://x/ajandek' }, NOW);
  await elosztas(db, fk, { env: ENV, fetchImpl: h.f, now: () => NOW });
  return { db };
}
test('AJANDEKKARTYA visszaterites: reszleges -> Google RESTATEMENT (uj ertek) + GA4 refund (delta); teljes -> RETRACTION + GA4 refund (a maradek); ismetles / kisebb osszeg = nincs uj kuldes', async () => {
  const { db } = await kartya(); const h = hamis(); const d = { env: ENV, fetchImpl: h.f, now: () => NOW + H };
  const r1 = await visszateritesFeldolgoz(db, { source_id: PI, osszeg_filler: 2690000, visszateritett_filler: 1000000 }, d); // 26 900 Ft-bol 10 000 Ft vissza
  assert.deepEqual([r1.allapot, r1.eletut_allapot, r1.cellak.map((c) => `${c.platform}:${c.allapot}`)], ['kesz', 'reszben_visszateritve', ['google:dryrun', 'ga4:elkuldve']]);
  const g1 = h.hivasok.find((x) => x.kulcs === 'korrekcio').body.adjustments[0];
  assert.deepEqual([g1.type, g1.orderId, g1.conversionActionId, g1.value, g1.currency], ['RESTATEMENT', `Ajandekkartya:${PI}`, '7825199992', 16900, 'HUF']);
  const a1 = h.hivasok.find((x) => x.kulcs === 'ga4' && x.body.events[0].name === 'refund').body.events[0].params; assert.deepEqual([a1.transaction_id, a1.value, a1.currency], [PI, 10000, 'HUF']);
  const r2 = await visszateritesFeldolgoz(db, { source_id: PI, osszeg_filler: 2690000, visszateritett_filler: 2690000 }, d);
  assert.deepEqual([r2.eletut_allapot, r2.cellak.map((c) => `${c.platform}:${c.allapot}`)], ['visszateritve', ['google:dryrun', 'ga4:elkuldve']]);
  const g2 = h.hivasok.filter((x) => x.kulcs === 'korrekcio')[1].body.adjustments[0]; assert.deepEqual([g2.type, 'value' in g2], ['RETRACTION', false]);
  const a2 = h.hivasok.filter((x) => x.kulcs === 'ga4' && x.body.events[0].name === 'refund')[1].body.events[0].params; assert.equal(a2.value, 16900, 'a GA4 refund a maradek (delta), nem a teljes osszeg');
  const n = h.hivasok.length;
  assert.equal((await visszateritesFeldolgoz(db, { source_id: PI, osszeg_filler: 2690000, visszateritett_filler: 2690000 }, d)).allapot, 'mar_kuldve');
  assert.equal((await visszateritesFeldolgoz(db, { source_id: PI, osszeg_filler: 2690000, visszateritett_filler: 500000 }, d)).allapot, 'mar_kuldve', 'kisebb kumulalt osszeg nem allitja vissza'); assert.equal(h.hivasok.length, n);
  const ids = (await sor(db, "SELECT esemeny_id, platform FROM meres_kuldes WHERE esemeny_tipus = 'korrekcio' ORDER BY id")).map((x) => `${x.platform}:${x.esemeny_id}`);
  assert.deepEqual(ids, [`google:Korrekcio:Ajandekkartya:${PI}:1000000`, `ga4:Visszaterites:${PI}:1000000`, `google:Visszavonas:Ajandekkartya:${PI}`, `ga4:Visszaterites:${PI}:2690000`]);
  assert.equal((await sor(db, 'SELECT COUNT(*) AS n FROM (SELECT esemeny_id, platform FROM meres_kuldes GROUP BY esemeny_id, platform HAVING COUNT(*) > 1)'))[0].n, 0);
});
test('AJANDEKKARTYA visszaterites vedelmek: ervenytelen osszeg / pi; nem kikuldott vasarlas = ismeretlen_vasarlas; Meta / TikTok nem kap korrekciot; ki, ha MERES_ELETUT nincs bekapcsolva', async () => {
  const { db } = await kartya(); const h = hamis(); const d = { env: ENV, fetchImpl: h.f, now: () => NOW + H };
  assert.equal((await visszateritesFeldolgoz(db, { source_id: PI, osszeg_filler: 100, visszateritett_filler: 200 }, d)).allapot, 'ervenytelen');
  assert.equal((await visszateritesFeldolgoz(db, { source_id: BID, osszeg_filler: 100, visszateritett_filler: 50 }, d)).allapot, 'ervenytelen');
  assert.equal((await visszateritesFeldolgoz(db, { source_id: 'pi_3Xnemletezik99', osszeg_filler: 100, visszateritett_filler: 50 }, d)).allapot, 'ismeretlen_vasarlas');
  assert.equal((await visszateritesFeldolgoz(db, { source_id: PI, osszeg_filler: 2690000, visszateritett_filler: 100 }, { ...d, env: { ...ENV, MERES_ELETUT: '0' } })).allapot, 'ki');
  await visszateritesFeldolgoz(db, { source_id: PI, osszeg_filler: 2690000, visszateritett_filler: 100000 }, d);
  assert.ok(!h.hivasok.some((x) => (x.kulcs === 'meta' || x.kulcs === 'tiktok')), 'a Meta / TikTok a konverziot nem vonja vissza: nincs refund-esemeny');
});

// --- vegpont (/api/foglalas-eletut) ---------------------------------------------------------------------------------------------------------
const KULCS = 'teszt-kulcs';
const KULCS_HASH = crypto.createHash('sha256').update(KULCS).digest('hex');
const reszletek = (allapot, uuid, start) => `<html>${allapot === 'torolve' ? 'Idopont torolve!' : `Visszaigazolt <a href="/selectDate/?startDate=${start}&amp;bookingId=${uuid}">x</a>`}</html>`;
const salonic = (allapot, start = 1793469600) => async (u) => ({ ok: true, status: 200, url: u, text: async () => reszletek(allapot, UUID, start) });
async function vegpontKornyezet(o = {}) {
  const t = await letrehoz(o); await kulcsSema(t.db);
  const kulcs = o.kulcs === undefined ? '10427|24354|1793469600' : o.kulcs;
  await t.db.prepare('INSERT INTO foglalas_egyeztetes (uuid, allapot, probalkozas, kulcs, booking_id, kuldve, riasztas, letrehozva, frissitve) VALUES (?1, ?2, 1, ?3, ?4, ?5, 0, ?5, ?5)').bind(UUID, 'parositott', kulcs, BID, Math.floor(NOW / 1000)).run();
  return { ...t, env: { ...ENV, KULCS_DB: t.db, EGYEZTETES_KULCS_HASH: KULCS_HASH } };
}
const ker = (body, kulcs = KULCS, method = 'POST') => new Request('https://x.pages.dev/api/foglalas-eletut' + (method === 'GET' ? body : ''), { method, headers: { 'x-egyeztetes-kulcs': kulcs }, body: method === 'GET' ? undefined : JSON.stringify(body) });
test('/api/foglalas-eletut: kulcs nelkul / rossz kulccsal 404; ervenytelen bemenet 400; nincs parositas -> ismeretlen_foglalas; lemondva a Salonic elo ellenorzesevel (torolve -> kesz, el -> nem_torolve)', async () => {
  const k = await vegpontKornyezet(); const h = hamis();
  assert.equal((await kezelEletut(ker({ uuid: UUID, allapot: 'lemondva' }, ''), k.env)).status, 404); assert.equal((await kezelEletut(ker({ uuid: UUID, allapot: 'lemondva' }, 'rossz'), k.env)).status, 404);
  assert.equal((await kezelEletut(ker({ allapot: 'lemondva' }), k.env)).status, 400); assert.equal((await kezelEletut(ker({ uuid: 'nem-uuid', allapot: 'lemondva' }), k.env)).status, 400);
  assert.equal((await kezelEletut(ker({ uuid: UUID, allapot: 'lemondva', ido: 'nem-datum' }), k.env)).status, 400);
  assert.equal((await (await kezelEletut(ker({ uuid: '11111111-1111-1111-1111-111111111111', allapot: 'lemondva' }), k.env)).json()).allapot, 'ismeretlen_foglalas');
  const el = await (await kezelEletut(ker({ uuid: UUID, allapot: 'lemondva' }), k.env, { fetchImpl: salonic('visszaigazolt'), now: () => NOW + H })).json(); assert.equal(el.allapot, 'nem_torolve');
  const tr = await (await kezelEletut(ker({ uuid: UUID, allapot: 'lemondva', ido: '2026-10-06T15:00:00Z', forras: 'teszt' }), k.env, { fetchImpl: salonic('torolve'), now: () => NOW + 2 * H })).json();
  assert.deepEqual([tr.ok, tr.allapot, tr.eletut_allapot, tr.cellak.map((c) => c.platform)], [true, 'kesz', 'lemondva', ['google']]);
  const g = await (await kezelEletut(ker(`?source_id=${BID}`, KULCS, 'GET'), k.env)).json(); assert.deepEqual([g.allapot.allapot, g.naplo.length >= 2, g.kuldesek.length], ['lemondva', true, 1]);
  const lista = await (await kezelEletut(ker('?riasztas=1', KULCS, 'GET'), k.env)).json(); assert.equal(lista.db, 1, 'a nem_torolve elutasitas a riasztas-listan');
});
test('/api/foglalas-eletut: megjelent / nem_jelent_meg a kulcsbol vett kezdes utan; booking_id-vel is hivhato; halasztva, ha a Salonic nem erheto el; "fuggo" muvelet', async () => {
  const k = await vegpontKornyezet({ kulcs: `10427|24354|${Math.floor(NOW / 1000) + 86400}` });
  const korai = await (await kezelEletut(ker({ uuid: UUID, allapot: 'megjelent' }), k.env, { fetchImpl: salonic('visszaigazolt'), now: () => NOW })).json(); assert.equal(korai.allapot, 'korai');
  const k2 = await vegpontKornyezet({ kulcs: `10427|24354|${Math.floor(NOW / 1000) - 7200}` });
  const ok = await (await kezelEletut(ker({ booking_id: BID, allapot: 'megjelent' }), k2.env, { fetchImpl: salonic('visszaigazolt', Math.floor(NOW / 1000) - 7200), now: () => NOW })).json();
  assert.deepEqual([ok.allapot, ok.cellak.map((c) => c.platform).sort()], ['kesz', ['meta', 'tiktok']]);
  const k3 = await vegpontKornyezet({ kulcs: `10427|24354|${Math.floor(NOW / 1000) - 7200}` });
  const hal = await (await kezelEletut(ker({ uuid: UUID, allapot: 'nem_jelent_meg' }), k3.env, { fetchImpl: async () => { throw new Error('halozat'); }, now: () => NOW })).json(); assert.equal(hal.allapot, 'halasztva');
  const fu = await (await kezelEletut(ker({ muvelet: 'fuggo' }), k3.env, { fetchImpl: salonic('visszaigazolt'), now: () => NOW })).json(); assert.deepEqual([fu.ok, fu.feldolgozott], [true, 0]);
});
test('/api/meres-admin: ajandek_visszaterites_ujra / ajandek_teszt_visszateritese - kulcsos, ervenytelen pi / osszeg 400, a kezelo (deps) megkapja a pi-t es az osszeget; kezelo nelkul 501', async () => {
  const k = await vegpontKornyezet(); let latott = null;
  const adm = (body, deps = {}) => kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?kulcs=${KULCS}`, { method: 'POST', body: JSON.stringify(body) }), k.env, deps);
  assert.equal((await adm({ muvelet: 'ajandek_visszaterites_ujra', pi: PI })).status, 501); assert.equal((await adm({ muvelet: 'ajandek_visszaterites_ujra', pi: 'rossz' }, { ajandekVisszateritesUjra: async () => 'kesz' })).status, 400);
  const u = await (await adm({ muvelet: 'ajandek_visszaterites_ujra', pi: PI }, { ajandekVisszateritesUjra: async (env, pi) => { latott = pi; return 'kesz'; } })).json(); assert.deepEqual([u.ok, u.allapot, latott], [true, 'kesz', PI]);
  assert.equal((await adm({ muvelet: 'ajandek_teszt_visszateritese', pi: PI, osszeg: -5 }, { ajandekTesztVisszateritese: async () => ({}) })).status, 400);
  const t = await (await adm({ muvelet: 'ajandek_teszt_visszateritese', pi: PI, osszeg: 5000 }, { ajandekTesztVisszateritese: async (env, pi, osszeg) => ({ refund_id: 're_1', osszeg }) })).json(); assert.deepEqual([t.ok, t.osszeg], [true, 5000]);
  assert.equal((await kezelAdmin(new Request('https://x.pages.dev/api/meres-admin', { method: 'POST', body: '{}' }), k.env, {})).status, 404, 'kulcs nelkul 404');
});
