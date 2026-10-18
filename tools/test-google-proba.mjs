// GOOGLE ARNYEK BACKEND PROBA-FELTOLTES + VISSZAVONAS (DECISION #196; netlify/lib/meres/google-proba.js) - OFFLINE TESZTEK
//   node --test tools/test-google-proba.mjs
// Valodi SQLite (node:sqlite) a D1 helyett, hamis halozat (a Zapier-webhookok), fix ora; semmi nem megy ki, nincs titok. Lefedi: a 8 akcio a kodbol, szaraz alapertelmezes (irasmentes, halozatmentes),
// a gclid szerveroldali valasztasa es sehol-nem-szivarog, a kuldes kapui, a zart torzs, az elo ID / HeadSpa / idegen mezo tiltas, ujrafuttatas-idempotencia, veszkapcsolo, 24 oras plafon,
// a T2 / QA-nap / lampa / egyeztetosor KIZARAS, a biztonsagi ellenorzesek tovabbi futasa a proba-soron, a RETRACTION tukorkepe (szaraz / dryRun / eles).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sema } from '../netlify/lib/foglalas-kulcs.js';
import { meresSema } from '../netlify/lib/meres/elosztas.js';
import { kezelAdmin } from '../netlify/lib/meres/vegpontok.js';
import { ARNYEK, ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { napIntervallum, qaKorlatNullaz, qaNap, t2Start } from '../netlify/lib/meres/qa-nap.js';
import { egyeztetoSorok } from '../netlify/lib/meres/egyeztetes-sor.js';
import { MEGEROSITES, PROBA_AKCIOK, PROBA_MAX_24H, akciokValasztas, googleProbaMuvelet, probaEllenorzes, probaKerelem, visszavonasKerelem } from '../netlify/lib/meres/google-proba.js';
import { ENV_ALAP, KULCS_SZOVEG, d1 } from './lib-sd-teszt.mjs';

const MOST = Date.UTC(2026, 9, 18, 12, 0, 0); // 2026-10-18 14:00 Budapest
const NOW_SEC = MOST / 1000;
const NAP = '2026-10-18';
const KULCS_HASH = crypto.createHash('sha256').update(KULCS_SZOVEG).digest('hex');
const GCL_FOGL = 'CjwKCAjwTESZTfoglalaselso_' + 'a'.repeat(30);   // a legfrissebb FoglalasElso feltoltes gclid-je (ezt kell valasztani)
const GCL_KARTYA = 'CjwKCAjwTESZTajandekkartya_' + 'b'.repeat(30); // frissebb, de Ajandekkartya: csak masodik valasztas
const GCL_REGI = 'CjwKCAjwTESZTregifoglalas_' + 'c'.repeat(30);    // regebbi FoglalasElso
const ELVART_8 = ['7825199995', '7825200898', '7825200901', '7825200904', '7825200907', '7825200910', '7825200913', '7825200916'];
const HEADSPA_ID = [ARNYEK.google.akciok.headspa.FoglalasElso, ARNYEK.google.akciok.headspa.Ajandekkartya];
const sha8 = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
const WEBHOOK = 'https://hooks.zapier.com/hooks/catch/1/teszt/';
const KORREKCIO = 'https://hooks.zapier.com/hooks/catch/1/korrekcio/';

function halozat({ tukroz = false, hiba = new Set(), valasz = null } = {}) {
  const hivasok = [];
  const fetchImpl = async (url, opt) => {
    const body = JSON.parse(opt.body);
    hivasok.push({ url, body });
    const akcio = body.conversion_action_id || (body.adjustments && body.adjustments[0].conversionActionId);
    if (hiba.has(akcio)) return { status: 500, text: async () => '{"status":"error"}' };
    if (valasz) return { status: 200, text: async () => valasz(body) };
    return { status: 200, text: async () => JSON.stringify({ status: 'success', id: 'z1', ...(tukroz ? { visszhang: body } : {}) }) };
  };
  return { fetchImpl, hivasok };
}

async function vilag({ env = {}, valos = true } = {}) {
  qaKorlatNullaz();
  const D = d1();
  const db = { prepare: D.prepare, batch: D.batch };
  await sema(db); await meresSema(db);
  const e = { KULCS_DB: db, EGYEZTETES_KULCS_HASH: KULCS_HASH, ...ENV_ALAP, GOOGLE_ARNYEK_WEBHOOK_URL: WEBHOOK, GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001', ...env };
  const sql = (q, ...a) => D.db.prepare(q).all(...a).map((r) => ({ ...r }));
  const futtat = (q, ...a) => D.db.prepare(q).run(...a);
  const beszur = (o) => futtat('INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, kerelem, letrehozva, frissitve, forras, indok, ertek, penznem) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    o.esemeny_id, o.nev || 'FoglalasElso', o.tipus || 'alap', o.platform || 'google', o.platform_nev || 'ARNYEK-7825199989', o.uzletag || 'headspa', o.source_id || 's_' + o.esemeny_id, o.allapot || 'elkuldve',
    o.kerelem === undefined ? null : o.kerelem === null ? null : JSON.stringify(o.kerelem), o.t ?? NOW_SEC - 3600, o.t ?? NOW_SEC - 3600, o.forras || 'motor', o.indok || null, o.ertek ?? 26900, 'HUF');
  const googleKerelem = (akcio, gclid) => ({ url: 'zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)', method: 'POST', fejlec_nevek: ['content-type'], cel: { customer_id: ARNYEK.google.customerId, conversion_action_id: akcio, athidalas: 'zapier-webhook' }, body: { conversion_action_id: akcio, gclid, conversion_date_time: '2026-10-17 12:00:00+02:00', value: 26900, currency: 'HUF', order_id: 'x', ad_user_data: 'DENIED' } });
  if (valos) { // 4 valodi HeadSpa Google-feltoltes: regi FoglalasElso, frissebb FoglalasElso, meg frissebb Ajandekkartya (kartya), + egy NEM HeadSpa / nem elkuldott sor (nem valaszthato)
    beszur({ esemeny_id: 'FoglalasElso:mb_regi', nev: 'FoglalasElso', platform_nev: 'ARNYEK-7825199989', kerelem: googleKerelem('7825199989', GCL_REGI), t: NOW_SEC - 5 * 86400, forras: 'motor' });
    beszur({ esemeny_id: 'FoglalasElso:mb_uj', nev: 'FoglalasElso', platform_nev: 'ARNYEK-7825199989', kerelem: googleKerelem('7825199989', GCL_FOGL), t: NOW_SEC - 2 * 86400, forras: 'motor' });
    beszur({ esemeny_id: 'Ajandekkartya:pi_1', nev: 'Ajandekkartya', platform_nev: 'ARNYEK-7825199992', kerelem: googleKerelem('7825199992', GCL_KARTYA), t: NOW_SEC - 3600, forras: 'kartya' });
    beszur({ esemeny_id: 'FoglalasElso:mb_hiba', nev: 'FoglalasElso', platform_nev: 'ARNYEK-7825199989', allapot: 'hiba', kerelem: googleKerelem('7825199989', 'CjwKCAjwTESZThibas_' + 'd'.repeat(30)), t: NOW_SEC - 60 });
  }
  const post = async (body, { kulcs = KULCS_SZOVEG, net, envFelul = {}, url = 'https://x.pages.dev/api/meres-admin' } = {}) => {
    const h = net || halozat();
    const r = await kezelAdmin(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(kulcs ? { 'x-egyeztetes-kulcs': kulcs } : {}) }, body: JSON.stringify(body) }), { ...e, ...envFelul }, { now: () => MOST, fetchImpl: h.fetchImpl });
    return { status: r.status, body: await r.json(), hivasok: h.hivasok };
  };
  const probaSorok = () => sql("SELECT * FROM meres_kuldes WHERE forras = 'google_proba' ORDER BY id");
  const osszSor = () => sql('SELECT COUNT(*) AS n FROM meres_kuldes')[0].n;
  return { D, db, e, sql, futtat, beszur, post, probaSorok, osszSor, googleKerelem };
}
// KOZVETLEN hivas a muvelet-belepesi pontra (a Request-feldolgozas nelkul: az egyideju hivasok igy ugyanazon az await-melysegen lepnek, a verseny determinisztikusan megjelenik)
const direkt = (w, body, { net, envFelul = {} } = {}) => googleProbaMuvelet(w.db, { ...w.e, ...envFelul }, body, { now: MOST, fetchImpl: (net || halozat()).fetchImpl });
const kuld = (extra = {}) => ({ muvelet: 'google_proba', kuld: true, megerosit: MEGEROSITES, ...extra });

test('A1 a 8 probalhato akcio PONTOSAN a vart (a kodbol, nem talgatva): nincs HeadSpa, nincs elo akcio, az ID-k az ARNYEK-tablabol', () => {
  assert.deepEqual(PROBA_AKCIOK.map((a) => a.id), ELVART_8);
  assert.equal(PROBA_AKCIOK.length, 8);
  for (const a of PROBA_AKCIOK) {
    assert.notEqual(a.uzletag, 'headspa');
    assert.equal(ARNYEK.google.akciok[a.uzletag][a.esemeny], a.id, 'az ID az ARNYEK.google.akciok tablabol jon');
    assert.ok(!ELO_CELOK.google_primary.includes(a.id));
  }
  assert.deepEqual(PROBA_AKCIOK.map((a) => a.cimke), ['ARNYEK Fodrasz Elso', 'ARNYEK Fodrasz Konz', 'ARNYEK Oxigen Elso', 'ARNYEK Oxigen Konz', 'ARNYEK Szor Elso', 'ARNYEK Szor Konz', 'ARNYEK PMU Foglalas', 'ARNYEK PMU Konz']);
  for (const id of HEADSPA_ID) assert.ok(!ELVART_8.includes(id));
});

test('A2 SZARAZ alapertelmezes: halozat es iras nelkul; a gclid szerveroldalon valasztodik (a legfrissebb FoglalasElso), es SEHOL nincs a valaszban', async () => {
  const w = await vilag(); const elotte = w.osszSor();
  const net = halozat();
  const r = await w.post({ muvelet: 'google_proba' }, { net });
  assert.equal(r.status, 200); assert.equal(r.body.mod, 'szaraz');
  assert.equal(net.hivasok.length, 0, 'szaraz: nincs halozat'); assert.equal(w.osszSor(), elotte, 'szaraz: nincs D1-iras');
  const szoveg = JSON.stringify(r.body);
  for (const g of [GCL_FOGL, GCL_KARTYA, GCL_REGI]) assert.ok(!szoveg.includes(g), 'a nyers gclid nincs a valaszban');
  assert.ok(!szoveg.includes('TESZThibas'));
  assert.equal(r.body.gclid, 'gclid#1'); assert.equal(r.body.gclid_hash8, sha8(GCL_FOGL), 'a legfrissebb FoglalasElso gclid-je valasztodott (nem az Ajandekkartya)');
  assert.equal(r.body.gclid_hossz, GCL_FOGL.length);
  assert.equal(r.body.terv.length, 8);
  assert.deepEqual(r.body.terv.map((t) => t.conversion_action_id), ELVART_8);
  assert.equal(new Set(r.body.terv.map((t) => t.order_id)).size, 8, 'order_id egyedi');
  for (const t of r.body.terv) {
    assert.match(t.order_id, /^Proba:[0-9a-f]{8}:\d{10}$/); assert.equal(t.ad_user_data, 'DENIED'); assert.equal(t.value, 1); assert.equal(t.currency, 'HUF');
    assert.deepEqual([...t.body_mezok].sort(), ['ad_user_data', 'conversion_action_id', 'conversion_date_time', 'currency', 'gclid', 'order_id', 'value']);
    assert.match(t.conversion_date_time, /^2026-10-18 13:5\d:\d\d\+02:00$/, 'a kuldes elott 2 perccel (Budapest), nem a jovoben');
  }
  assert.match(r.body.futas_id, /^[0-9a-f]{8}$/); assert.equal(r.body.ugyfel, '6088874770');
  assert.deepEqual(Object.keys(r.body.kuldes_feltetelei).sort(), ['meres_elosztas_be', 'webhook_beallitva'], 'a szaraz valasz megmutatja a kuldes feltetelei kozul a kornyezetet (titok nelkul: csak igen / nem)');
  assert.ok(Object.values(r.body.kuldes_feltetelei).every((x) => typeof x === 'boolean'));
});

test('A3 gclid_sorszam: ELOBB az osszes FoglalasElso (ujabb -> regebbi: 1., 2.), UTANA az Ajandekkartya (3.); nincs hasznalhato gclid -> 409 (a hiba / mas forras / 80 napnal regebbi sor nem valaszthato)', async () => {
  const w = await vilag();
  const h = async (n) => (await w.post({ muvelet: 'google_proba', gclid_sorszam: n })).body.gclid_hash8;
  assert.equal(await h(1), sha8(GCL_FOGL)); assert.equal(await h(2), sha8(GCL_REGI), 'a FoglalasElso sorok elobb: 2. = a regebbi FoglalasElso'); assert.equal(await h(3), sha8(GCL_KARTYA));
  const ures = await vilag({ valos: false });
  ures.beszur({ esemeny_id: 'FoglalasElso:mb_regiregi', kerelem: ures.googleKerelem('7825199989', 'CjwKCAjwTESZTnagyonregi_' + 'e'.repeat(30)), t: NOW_SEC - 90 * 86400 });
  ures.beszur({ esemeny_id: 'FoglalasElso:mb_fodr', uzletag: 'fodrasz', kerelem: ures.googleKerelem('7825199995', 'CjwKCAjwTESZTfodrasz_' + 'f'.repeat(30)) });
  ures.beszur({ esemeny_id: 'FoglalasElso:mb_meta', platform: 'meta', kerelem: { cel: {}, body: { gclid: 'CjwKCAjwTESZTmeta_' + 'g'.repeat(30) } } });
  const r = await ures.post({ muvelet: 'google_proba' });
  assert.equal(r.status, 409); assert.match(r.body.miert, /nincs hasznalhato valodi HeadSpa gclid/);
});

test('A4 a KULDES kapui: megerosites, MERES_ELOSZTO, webhook, iras-veszkapcsolo, 24 oras plafon - mindegyiknel 0 halozat, 0 iras', async () => {
  const w = await vilag(); const net = halozat(); const elotte = w.osszSor();
  const ell = async (feltetel, status, re) => { const r = await feltetel(); assert.equal(r.status, status, JSON.stringify(r.body)); if (re) assert.match(r.body.miert, re); assert.equal(net.hivasok.length, 0); assert.equal(w.osszSor(), elotte); };
  await ell(() => w.post({ muvelet: 'google_proba', kuld: true }, { net }), 400, /megerosit/);
  await ell(() => w.post({ muvelet: 'google_proba', kuld: true, megerosit: 'igen' }, { net }), 400, /megerosit/);
  await ell(() => w.post({ muvelet: 'google_proba', megerosit: MEGEROSITES }, { net }), 200); // kuld nelkul: szaraz
  await ell(() => w.post(kuld(), { net, envFelul: { MERES_ELOSZTO: '0' } }), 409, /MERES_ELOSZTO/);
  await ell(() => w.post(kuld(), { net, envFelul: { GOOGLE_ARNYEK_WEBHOOK_URL: '' } }), 409, /WEBHOOK/);
  await ell(() => w.post(kuld(), { net, envFelul: { GOOGLE_ARNYEK_WEBHOOK_URL: 'https://evil.example/hook' } }), 409, /WEBHOOK/);
  await ell(() => w.post(kuld(), { net, envFelul: { MERES_IRAS_KI: '1' } }), 503, /veszkapcsolo/);
  for (let i = 0; i < PROBA_MAX_24H - 7; i++) w.beszur({ esemeny_id: `Proba:aaaaaaaa:${String(1000000000 + i)}`, forras: 'google_proba', source_id: 'gp_aaaaaaaa', t: NOW_SEC - 100, uzletag: 'pmu', allapot: 'elkuldve' });
  const n2 = w.osszSor();
  const r = await w.post(kuld(), { net }); assert.equal(r.status, 429); assert.match(r.body.miert, /24 oran/); assert.equal(net.hivasok.length, 0); assert.equal(w.osszSor(), n2);
});

test('A5 KULDES: 8 POST a relay-Zapra, zart torzs, a D1-sorok forras=google_proba / source_id=gp_<futas>, a gclid csak a kuldott torzsben van (a naploban / valaszban / platform_valaszban gclid#1)', async () => {
  const w = await vilag(); const net = halozat({ tukroz: true });
  const r = await w.post(kuld({ futas_id: '0a1b2c3d' }), { net });
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.mod, 'kuldes'); assert.equal(r.body.kuldve, 8);
  assert.equal(net.hivasok.length, 8);
  assert.deepEqual(net.hivasok.map((h) => h.body.conversion_action_id), ELVART_8);
  for (const h of net.hivasok) {
    assert.equal(h.url, WEBHOOK);
    assert.deepEqual(Object.keys(h.body).sort(), ['ad_user_data', 'conversion_action_id', 'conversion_date_time', 'currency', 'gclid', 'order_id', 'value']);
    assert.equal(h.body.gclid, GCL_FOGL, 'a kuldott torzsben a valodi gclid van'); assert.equal(h.body.ad_user_data, 'DENIED'); assert.equal(h.body.value, 1);
    assert.equal(h.body.order_id, `Proba:0a1b2c3d:${h.body.conversion_action_id}`);
    assert.ok(!/@|\+36|email|telefon|nev/i.test(JSON.stringify(h.body)), 'nincs vendegadat');
  }
  const sorok = w.probaSorok();
  assert.equal(sorok.length, 8);
  for (const s of sorok) {
    assert.equal(s.forras, 'google_proba'); assert.equal(s.source_id, 'gp_0a1b2c3d'); assert.equal(s.platform, 'google'); assert.equal(s.allapot, 'elkuldve'); assert.equal(s.http_status, 200);
    assert.equal(s.esemeny_tipus, 'alap'); assert.equal(s.ertek, 1); assert.equal(s.penznem, 'HUF'); assert.equal(s.salonic_uuid, null);
    assert.ok(!s.kerelem.includes(GCL_FOGL) && !String(s.platform_valasz).includes(GCL_FOGL) && !s.hozzajarulas.includes(GCL_FOGL), 'a gclid a D1-ben sincs');
    assert.ok(s.kerelem.includes('gclid#1') && s.kerelem.includes(sha8(GCL_FOGL))); assert.equal(s.platform_valasz, '{"http":200,"status":"success","id":"z1"}', 'a Zap nyers valasz-torzse (visszhangja) NEM tarolodik: csak http + status + id');
    const k = JSON.parse(s.kerelem); assert.equal(k.cel.customer_id, '6088874770'); assert.equal(k.cel.proba, true);
  }
  assert.ok(!JSON.stringify(r.body).includes(GCL_FOGL)); assert.ok(r.body.eredmenyek.every((e) => e.valasz_roviden === '{"http":200,"status":"success","id":"z1"}'));
  assert.equal(w.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE forras <> 'google_proba' AND esemeny_id LIKE 'Proba:%'")[0].n, 0);
});

test('A6 UJRAFUTTATAS ugyanazzal a futas_id-vel: az elkuldott sor nem megy ketszer, a hibas ujraprobalhato (max 3), a 8. sem duplazodik', async () => {
  const w = await vilag(); const net1 = halozat({ hiba: new Set(['7825200913']) });
  const r1 = await w.post(kuld({ futas_id: 'abcdef01' }), { net: net1 });
  assert.equal(r1.body.kuldve, 7); assert.equal(r1.body.eredmenyek.find((e) => e.conversion_action_id === '7825200913').allapot, 'hiba');
  const net2 = halozat();
  const r2 = await w.post(kuld({ futas_id: 'abcdef01' }), { net: net2 });
  assert.equal(net2.hivasok.length, 1, 'csak a hibas ujra');
  assert.equal(net2.hivasok[0].body.conversion_action_id, '7825200913'); assert.equal(r2.body.eredmenyek.filter((e) => e.duplikalt).length, 7);
  assert.equal(w.probaSorok().length, 8); assert.ok(w.probaSorok().every((s) => s.allapot === 'elkuldve'));
  const net3 = halozat(); const r3 = await w.post(kuld({ futas_id: 'abcdef01' }), { net: net3 });
  assert.equal(net3.hivasok.length, 0); assert.equal(r3.body.kuldve, 0);
});

test('A7 veszkapcsolo: platform:google / uzletag:pmu / mind kikapcsolva -> az erintett cella KIHAGYVA, nem megy ki', async () => {
  const w = await vilag(); w.futtat("INSERT INTO meres_kapcsolo (kulcs, be, ok, ido) VALUES ('uzletag:pmu', 0, 'teszt', 1)");
  const net = halozat(); const r = await w.post(kuld(), { net });
  assert.equal(net.hivasok.length, 6); assert.deepEqual(r.body.eredmenyek.filter((e) => e.allapot === 'kihagyva').map((e) => e.conversion_action_id), ['7825200913', '7825200916']);
  const w2 = await vilag(); w2.futtat("INSERT INTO meres_kapcsolo (kulcs, be, ok, ido) VALUES ('platform:google', 0, 'teszt', 1)");
  const n2 = halozat(); await w2.post(kuld(), { net: n2 }); assert.equal(n2.hivasok.length, 0);
  const w3 = await vilag(); w3.futtat("INSERT INTO meres_kapcsolo (kulcs, be, ok, ido) VALUES ('mind', 0, 'teszt', 1)");
  const n3 = halozat(); await w3.post(kuld(), { net: n3 }); assert.equal(n3.hivasok.length, 0);
});

test('A8 VEDELMEK: a HeadSpa / elo / ismeretlen akcio nem kerheto; a manipulalt kerelmet a probaEllenorzes fail-closed megfogja (idegen mezo, vendegadat, GRANTED, ertek, fiok, order_id, gclid)', async () => {
  const w = await vilag(); const net = halozat();
  for (const rossz of [HEADSPA_ID[0], HEADSPA_ID[1], ...ELO_CELOK.google_primary, '123', '']) {
    const r = await w.post({ muvelet: 'google_proba', akciok: [rossz] }, { net }); assert.equal(r.status, 400, rossz); assert.match(r.body.miert, /probalhato/);
  }
  assert.equal((await w.post({ muvelet: 'google_proba', akciok: [] })).status, 400); assert.equal((await w.post({ muvelet: 'google_proba', akciok: ['7825200913', '7825200913'] })).status, 400);
  assert.equal((await w.post({ muvelet: 'google_proba', futas_id: 'nem-hexa' })).status, 400);
  assert.equal(net.hivasok.length, 0);
  const reszhalmaz = await w.post({ muvelet: 'google_proba', akciok: ['7825200913', '7825200916'] }); assert.equal(reszhalmaz.body.terv.length, 2);
  // fail-closed ellenorzes
  const jo = probaKerelem(PROBA_AKCIOK[0], { gclid: GCL_FOGL, futasId: '0a1b2c3d', nowSec: NOW_SEC });
  assert.equal(probaEllenorzes(jo), null);
  const valtoztat = (f) => { const k = structuredClone(jo); f(k); return probaEllenorzes(k); };
  assert.match(valtoztat((k) => { k.body.email = 'a@b.hu'; }), /zart lista/);
  assert.match(valtoztat((k) => { delete k.body.currency; }), /zart lista/);
  assert.match(valtoztat((k) => { k.body.phone = '+36301234567'; delete k.body.currency; }), /zart lista/);
  assert.match(valtoztat((k) => { k.cel.customer_id = '7030256606'; }), /nem az ARNYEK/);
  assert.match(valtoztat((k) => { k.cel.conversion_action_id = ELO_CELOK.google_primary[0]; k.body.conversion_action_id = ELO_CELOK.google_primary[0]; }), /elo konverzios/);
  assert.match(valtoztat((k) => { k.cel.conversion_action_id = HEADSPA_ID[0]; k.body.conversion_action_id = HEADSPA_ID[0]; }), /8 probalhato/);
  assert.match(valtoztat((k) => { k.body.conversion_action_id = '7825200916'; }), /eltero/);
  assert.match(valtoztat((k) => { k.body.ad_user_data = 'GRANTED'; }), /DENIED/);
  assert.match(valtoztat((k) => { k.body.value = 99000; }), /proba-ertek/);
  assert.match(valtoztat((k) => { k.body.currency = 'EUR'; }), /proba-ertek/);
  assert.match(valtoztat((k) => { k.body.order_id = 'FoglalasElso:mb_0abc'; }), /order_id/);
  assert.match(valtoztat((k) => { k.body.order_id = 'Proba:0a1b2c3d:7825200916'; }), /order_id/);
  assert.match(valtoztat((k) => { k.body.gclid = 'rovid'; }), /gclid/);
  assert.match(valtoztat((k) => { k.body.conversion_date_time = 'ma'; }), /conversion_date_time/);
  assert.equal(probaEllenorzes(null), 'hianyos kerelem');
  assert.deepEqual(akciokValasztas(null).akciok, PROBA_AKCIOK);
});

test('A9 vegpont: kulcs nelkul / rossz kulccsal 404 (nincs hatas), ismeretlen muvelet 400, a meglevo GET es POST muveletek valtozatlanok', async () => {
  const w = await vilag(); const net = halozat(); const elotte = w.osszSor();
  assert.equal((await w.post({ muvelet: 'google_proba' }, { kulcs: '', net })).status, 404);
  assert.equal((await w.post(kuld(), { kulcs: 'rossz', net })).status, 404);
  assert.equal((await w.post(kuld(), { kulcs: '', net })).status, 404);
  assert.equal(net.hivasok.length, 0); assert.equal(w.osszSor(), elotte);
  assert.equal((await w.post({ muvelet: 'google_proba_x' })).status, 400);
  const kap = await kezelAdmin(new Request('https://x.pages.dev/api/meres-admin?kapcsolok=1', { headers: { 'x-egyeztetes-kulcs': KULCS_SZOVEG } }), w.e, {});
  assert.equal(kap.status, 200); assert.equal((await kap.json()).ok, true);
});

// ---------- Review (PASS with notes) javitasai: kulcs csak fejlecben, verseny / ujraprobalas / plafon, Zap-valasz tarolasa ----------
test('A10 a kulcs CSAK fejlecben fogadhato el a ket muvelet-nel: ?kulcs= query-kulcs -> 404 (0 halozat, 0 iras); a meglevo muveletek viselkedese valtozatlan', async () => {
  const w = await vilag(); const net = halozat(); const elotte = w.osszSor();
  const q = `https://x.pages.dev/api/meres-admin?kulcs=${encodeURIComponent(KULCS_SZOVEG)}`;
  const env = { GOOGLE_KORREKCIO_ELES: '1', GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO };
  for (const body of [{ muvelet: 'google_proba' }, kuld(), { muvelet: 'google_proba_visszavon', futas_id: '0a0a0a0a' }, { muvelet: 'google_proba_visszavon', futas_id: '0a0a0a0a', kuld: true, megerosit: MEGEROSITES, eles: true }]) {
    const r = await w.post(body, { kulcs: '', url: q, net, envFelul: env });
    assert.equal(r.status, 404, JSON.stringify(body)); assert.deepEqual(r.body, { ok: false });
  }
  assert.equal(net.hivasok.length, 0); assert.equal(w.osszSor(), elotte);
  assert.equal((await w.post({ muvelet: 'google_proba' }, { kulcs: 'rossz', url: q, net })).status, 404, 'rossz fejlec + jo query-kulcs: 404');
  assert.equal((await w.post({ muvelet: 'google_proba' }, { url: q, net })).status, 200, 'jo fejlec (query mellett is): rendben');
  assert.equal((await w.post({ muvelet: 'kapcsolo', platform: 'meta', be: true }, { kulcs: '', url: q, net })).status, 200, 'a MEGLEVO admin-muveletek a query-kulcsot tovabbra is elfogadjak (nem ennek a PR-nak a hatóköre)');
});

test('A11 VERSENY: 3 egyideju azonos futas_id-s kuld:true -> osszesen 8 POST, 8 D1-sor; 3 egyideju ujraprobalas (hiba sorok) -> szinten 8 POST (compare-and-swap)', async () => {
  const w = await vilag(); const net = halozat();
  const rs = await Promise.all([1, 2, 3].map(() => direkt(w, kuld({ futas_id: 'c0ffee01' }), { net })));
  assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.status)));
  assert.equal(net.hivasok.length, 8, 'osszesen 8 POST'); assert.equal(rs.reduce((n, r) => n + r.body.kuldve, 0), 8);
  assert.equal(new Set(net.hivasok.map((h) => h.body.order_id)).size, 8, 'minden order_id pontosan egyszer');
  assert.equal(w.probaSorok().length, 8); assert.ok(w.probaSorok().every((s) => s.allapot === 'elkuldve' && s.probalkozas === 1));
  const w2 = await vilag(); await w2.post(kuld({ futas_id: 'c0ffee02' }), { net: halozat({ hiba: new Set(ELVART_8) }) });
  assert.ok(w2.probaSorok().every((s) => s.allapot === 'hiba' && s.probalkozas === 1));
  const n2 = halozat(); const rs2 = await Promise.all([1, 2, 3].map(() => direkt(w2, kuld({ futas_id: 'c0ffee02' }), { net: n2 })));
  assert.ok(rs2.every((r) => r.status === 200));
  assert.equal(n2.hivasok.length, 8, 'az ujraprobalas-verseny sem POST-ol tobbet'); assert.ok(w2.probaSorok().every((s) => s.allapot === 'elkuldve' && s.probalkozas === 2));
  // visszavonas: 3 egyideju ELES hivas -> 8 POST
  const env = { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO, GOOGLE_KORREKCIO_ELES: '1' };
  const w3 = await vilag(); await w3.post(kuld({ futas_id: 'c0ffee03' }));
  const n3 = halozat(); const rs3 = await Promise.all([1, 2, 3].map(() => direkt(w3, { muvelet: 'google_proba_visszavon', futas_id: 'c0ffee03', kuld: true, megerosit: MEGEROSITES, eles: true }, { net: n3, envFelul: env })));
  assert.ok(rs3.every((r) => r.status === 200)); assert.equal(n3.hivasok.length, 8); assert.equal(w3.probaSorok().filter((s) => s.esemeny_id.startsWith('Visszavon:')).length, 8);
  const w4 = await vilag(); await w4.post(kuld({ futas_id: 'c0ffee13' })); const vis4 = { muvelet: 'google_proba_visszavon', futas_id: 'c0ffee13', kuld: true, megerosit: MEGEROSITES, eles: true };
  await direkt(w4, vis4, { net: halozat({ hiba: new Set(ELVART_8) }), envFelul: env });
  const n4 = halozat(); await Promise.all([1, 2, 3].map(() => direkt(w4, vis4, { net: n4, envFelul: env })));
  assert.equal(n4.hivasok.length, 8, 'a visszavonas ujraprobalas-versenye sem POST-ol tobbet'); assert.ok(w4.probaSorok().filter((s) => s.esemeny_id.startsWith('Visszavon:')).every((s) => s.allapot === 'elkuldve' && s.probalkozas === 2));
});

test('A12 ON CONFLICT DO NOTHING: ha a SELECT elavult (a sor kozben megjelent), az INSERT nem dob kivetelt es nem POST-ol - feltoltes es visszavonas', async () => {
  const w = await vilag(); await w.post(kuld({ futas_id: 'c0ffee04' }));
  const elavult = { prepare: (sql) => (/SELECT id, allapot, probalkozas, frissitve/.test(sql) ? { bind: () => ({ first: async () => null }) } : w.db.prepare(sql)), batch: w.db.batch };
  const n1 = halozat(); const r1 = await w.post(kuld({ futas_id: 'c0ffee04' }), { net: n1, envFelul: { KULCS_DB: elavult } });
  assert.equal(r1.status, 200, JSON.stringify(r1.body)); assert.equal(n1.hivasok.length, 0); assert.ok(r1.body.eredmenyek.every((e) => e.duplikalt)); assert.equal(w.probaSorok().length, 8);
  const env = { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO, GOOGLE_KORREKCIO_ELES: '1' }; const vis = { muvelet: 'google_proba_visszavon', futas_id: 'c0ffee04', kuld: true, megerosit: MEGEROSITES, eles: true };
  await w.post(vis, { envFelul: env });
  const n2 = halozat(); const r2 = await w.post(vis, { net: n2, envFelul: { ...env, KULCS_DB: elavult } });
  assert.equal(r2.status, 200, JSON.stringify(r2.body)); assert.equal(n2.hivasok.length, 0); assert.ok(r2.body.eredmenyek.every((e) => e.duplikalt)); assert.equal(w.probaSorok().length, 16);
});

test('A13 soronkenti 3 probalkozas: a 4. kiserlet NEM POST-ol (feltoltes es visszavonas is)', async () => {
  const hibas = () => halozat({ hiba: new Set(ELVART_8) });
  const w = await vilag(); const hossz = [];
  for (let i = 0; i < 4; i++) { const n = hibas(); await w.post(kuld({ futas_id: 'c0ffee05' }), { net: n }); hossz.push(n.hivasok.length); }
  assert.deepEqual(hossz, [8, 8, 8, 0]); assert.ok(w.probaSorok().every((s) => s.allapot === 'hiba' && s.probalkozas === 3));
  const w2 = await vilag(); await w2.post(kuld({ futas_id: 'c0ffee06' }));
  const env = { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO, GOOGLE_KORREKCIO_ELES: '1' }; const hv = [];
  for (let i = 0; i < 4; i++) { const n = hibas(); await w2.post({ muvelet: 'google_proba_visszavon', futas_id: 'c0ffee06', kuld: true, megerosit: MEGEROSITES, eles: true }, { net: n, envFelul: env }); hv.push(n.hivasok.length); }
  assert.deepEqual(hv, [8, 8, 8, 0]); const vis = w2.probaSorok().filter((s) => s.esemeny_id.startsWith('Visszavon:'));
  assert.equal(vis.length, 8); assert.ok(vis.every((s) => s.allapot === 'hiba' && s.probalkozas === 3));
});

test('A14 a 120 s "folyamatban" ablak: a friss (60 s) sor nem POST-ol, a regi (200 s) ujraprobalhato - feltoltes es visszavonas is', async () => {
  const sor = (w, esemenyId, futas, kor, tipus) => w.beszur({ esemeny_id: esemenyId, nev: tipus === 'korrekcio' ? 'Visszavonas' : 'FoglalasElso', tipus, platform_nev: 'ARNYEK-x', uzletag: 'fodrasz', source_id: 'gp_' + futas, allapot: 'folyamatban', kerelem: null, t: NOW_SEC - kor, forras: 'google_proba' });
  const w = await vilag(); const futas = 'c0ffee07';
  sor(w, `Proba:${futas}:${ELVART_8[0]}`, futas, 60, 'alap'); sor(w, `Proba:${futas}:${ELVART_8[1]}`, futas, 200, 'alap');
  const net = halozat(); const r = await w.post(kuld({ futas_id: futas }), { net });
  assert.equal(r.status, 200); assert.equal(net.hivasok.length, 7, '6 uj + a 200 s-es ujraprobalt; a 60 s-es NEM');
  assert.ok(!net.hivasok.some((h) => h.body.conversion_action_id === ELVART_8[0])); assert.ok(net.hivasok.some((h) => h.body.conversion_action_id === ELVART_8[1]));
  assert.equal(r.body.eredmenyek.find((e) => e.conversion_action_id === ELVART_8[0]).duplikalt, true);
  const w2 = await vilag(); const f2 = 'c0ffee08'; await w2.post(kuld({ futas_id: f2 }));
  sor(w2, `Visszavon:Proba:${f2}:${ELVART_8[0]}`, f2, 60, 'korrekcio'); sor(w2, `Visszavon:Proba:${f2}:${ELVART_8[1]}`, f2, 200, 'korrekcio');
  const env = { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO, GOOGLE_KORREKCIO_ELES: '1' }; const n2 = halozat();
  const r2 = await w2.post({ muvelet: 'google_proba_visszavon', futas_id: f2, kuld: true, megerosit: MEGEROSITES, eles: true }, { net: n2, envFelul: env });
  assert.equal(r2.status, 200, JSON.stringify(r2.body)); assert.equal(n2.hivasok.length, 7);
  assert.ok(!n2.hivasok.some((h) => h.body.adjustments[0].conversionActionId === ELVART_8[0])); assert.ok(n2.hivasok.some((h) => h.body.adjustments[0].conversionActionId === ELVART_8[1]));
});

let SZAM = 0;
const tolt = (w, n, allapot, kor = 100) => { for (let i = 0; i < n; i++) w.beszur({ esemeny_id: `Proba:aaaaaaaa:${String(2000000000 + SZAM++)}`, forras: 'google_proba', source_id: 'gp_aaaaaaaa', t: NOW_SEC - kor, uzletag: 'pmu', allapot }); };
test('A15 24 oras plafon (DONTES): a KIMENO kiserleteket szamolja (elkuldve / hiba / folyamatban); a kihagyva (dry-run, veszkapcsolo) es a 24 oranal regebbi sorokat NEM; az idempotens ujrafuttatas / ujraprobalas nem uj sor -> nem 429-ezik', async () => {
  const w1 = await vilag(); tolt(w1, 38, 'kihagyva'); tolt(w1, 2, 'elkuldve');
  assert.equal((await w1.post(kuld())).status, 200, 'a 38 kihagyva sor nem szamit: 2 + 8 <= 40');
  const w2 = await vilag(); tolt(w2, 33, 'hiba'); assert.equal((await w2.post(kuld())).status, 429, '33 hiba + 8 uj = 41 > 40');
  const w3 = await vilag(); tolt(w3, 33, 'folyamatban', 90000); assert.equal((await w3.post(kuld())).status, 200, 'a 24 oranal regebbi sorok nem szamitanak');
  const w4 = await vilag(); tolt(w4, 32, 'folyamatban'); assert.equal((await w4.post(kuld())).status, 200, 'pontosan 40 (32 + 8): meg rendben');
  // a plafonnal egyenlo allapot: az idempotens ujrafuttatas (0 uj sor) NEM 429, az uj futas igen
  const w5 = await vilag(); await w5.post(kuld({ futas_id: 'c0ffee09' })); tolt(w5, 32, 'elkuldve');
  const n5 = halozat(); const r5 = await w5.post(kuld({ futas_id: 'c0ffee09' }), { net: n5 });
  assert.equal(r5.status, 200, JSON.stringify(r5.body)); assert.equal(n5.hivasok.length, 0); assert.ok(r5.body.eredmenyek.every((e) => e.duplikalt));
  assert.equal((await w5.post(kuld({ futas_id: 'c0ffee10' }))).status, 429, 'uj futas: 40 + 8 > 40');
  // az ujraprobalas (hiba sorok UPDATE-je) sem uj sor
  const w6 = await vilag(); await w6.post(kuld({ futas_id: 'c0ffee11' }), { net: halozat({ hiba: new Set(ELVART_8) }) }); tolt(w6, 32, 'elkuldve');
  const n6 = halozat(); const r6 = await w6.post(kuld({ futas_id: 'c0ffee11' }), { net: n6 }); assert.equal(r6.status, 200); assert.equal(n6.hivasok.length, 8);
  // visszavonas: az eles uj sorok szamitanak (429), a dry-run (kuld:true, eles nelkul) nem
  const w7 = await vilag(); await w7.post(kuld({ futas_id: 'c0ffee12' })); tolt(w7, 32, 'elkuldve');
  const env = { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO, GOOGLE_KORREKCIO_ELES: '1' }; const vis = { muvelet: 'google_proba_visszavon', futas_id: 'c0ffee12', kuld: true, megerosit: MEGEROSITES };
  assert.equal((await w7.post({ ...vis, eles: true }, { envFelul: env })).status, 429, 'eles: 40 + 8 uj > 40');
  assert.equal((await w7.post(vis, { envFelul: env })).status, 200, 'dry-run: kihagyva sorok, nem szamit');
});

test('A16 futas_id nelkul ket hivas KULONBOZO azonositot kap (8 hexa); a megadott futas_id valtozatlan', async () => {
  const w = await vilag(); const a = await w.post({ muvelet: 'google_proba' }); const b = await w.post({ muvelet: 'google_proba' });
  assert.match(a.body.futas_id, /^[0-9a-f]{8}$/); assert.match(b.body.futas_id, /^[0-9a-f]{8}$/); assert.notEqual(a.body.futas_id, b.body.futas_id);
  assert.notDeepEqual(a.body.terv.map((t) => t.order_id), b.body.terv.map((t) => t.order_id)); assert.equal(a.body.source_id, `gp_${a.body.futas_id}`);
  const net = halozat(); await w.post(kuld(), { net }); await w.post(kuld(), { net });
  assert.equal(net.hivasok.length, 16); assert.equal(new Set(w.probaSorok().map((s) => s.source_id)).size, 2);
  assert.equal((await w.post({ muvelet: 'google_proba', futas_id: '0123abcd' })).body.futas_id, '0123abcd');
});

test('A17 a Zap NYERS valasz-torzse SOHA nem tarolodik / nem kerul a valaszba: kisbetus, base64, csonkolt visszhang es gclid-visszhangzo status / id sem; csak http + biztonsagos status / id', async () => {
  const b64 = (x) => Buffer.from(x).toString('base64');
  const V = {
    kisbetu: [(b) => JSON.stringify({ status: 'success', id: 'z1', visszhang: b.gclid.toLowerCase() }), '{"http":200,"status":"success","id":"z1"}'],
    base64: [(b) => JSON.stringify({ status: 'success', id: 'z1', visszhang: b64(JSON.stringify(b)) }), '{"http":200,"status":"success","id":"z1"}'],
    csonka: [(b) => JSON.stringify({ status: 'success', id: 'z1', visszhang: b.gclid.slice(0, 14) + '...' }), '{"http":200,"status":"success","id":"z1"}'],
    nyers_szoveg: [(b) => 'OK ' + b.gclid.toLowerCase() + ' ' + JSON.stringify(b), '{"http":200}'],
    id_visszhang: [(b) => JSON.stringify({ status: 'success', id: b.gclid }), '{"http":200,"status":"success"}'],
    status_kisbetus_visszhang: [(b) => JSON.stringify({ status: b.gclid.toLowerCase(), id: 'z2' }), '{"http":200,"id":"z2"}'],
    id_base64_visszhang: [(b) => JSON.stringify({ status: 'success', id: b64(b.gclid).replace(/[+/=]/g, '').slice(0, 40) }), '{"http":200,"status":"success"}'],
    veszelyes_id: [() => JSON.stringify({ status: 'success', id: '<script>alert(1)</script>' }), '{"http":200,"status":"success"}'],
    hosszu_id: [() => JSON.stringify({ status: 'success', id: 'x'.repeat(65) }), '{"http":200,"status":"success"}'],
    hatar_id: [() => JSON.stringify({ status: 'success', id: 'x'.repeat(64) }), `{"http":200,"status":"success","id":"${'x'.repeat(64)}"}`],
    objektum_id: [() => JSON.stringify({ status: 'success', id: { be: 'agyazott' } }), '{"http":200,"status":"success"}'],
    tomb: [() => JSON.stringify(['success', 'z1']), '{"http":200}'],
  };
  for (const [nev, [valasz, vart]] of Object.entries(V)) {
    const w = await vilag(); const r = await w.post(kuld({ futas_id: '5e5e5e5e' }), { net: halozat({ valasz }) });
    assert.equal(r.status, 200, nev); assert.equal(r.body.kuldve, 8, nev);
    for (const sor of w.probaSorok()) assert.equal(sor.platform_valasz, vart, `${nev}: D1 platform_valasz`);
    for (const e of r.body.eredmenyek) assert.equal(e.valasz_roviden, vart, `${nev}: valasz_roviden`);
    const minden = JSON.stringify(w.probaSorok()) + JSON.stringify(r.body);
    for (const darab of [GCL_FOGL, GCL_FOGL.toLowerCase(), GCL_FOGL.slice(0, 14), b64(GCL_FOGL).slice(0, 24)]) assert.ok(!minden.includes(darab), `${nev}: a gclid (vagy kisbetus / base64 / csonka alakja) nincs a D1-ben / valaszban: ${darab}`);
  }
  // HTTP-hiba: csak a status-kod (+ a Zap status mezoje); halozati hiba: a kivetel szovege (URL, gclid) sem tarolodik
  const w2 = await vilag(); const r2 = await w2.post(kuld({ futas_id: '5e5e5e5f' }), { net: halozat({ hiba: new Set(ELVART_8) }) });
  assert.ok(w2.probaSorok().every((s) => s.allapot === 'hiba' && s.platform_valasz === '{"http":500,"status":"error"}')); assert.ok(r2.body.eredmenyek.every((e) => e.valasz_roviden === '{"http":500,"status":"error"}'));
  const w3 = await vilag(); const dob = { hivasok: [], fetchImpl: async (url, opt) => { throw new Error(`connect ECONNREFUSED ${url} ${JSON.parse(opt.body).gclid}`); } };
  const r3 = await w3.post(kuld({ futas_id: '5e5e5e60' }), { net: dob });
  assert.ok(w3.probaSorok().every((s) => s.allapot === 'hiba' && s.platform_valasz === '{"http":null}' && s.http_status === null));
  assert.ok(!JSON.stringify(r3.body).includes('hooks.zapier.com') && !JSON.stringify(w3.probaSorok()).includes('hooks.zapier.com') && !JSON.stringify(r3.body).includes(GCL_FOGL) && !JSON.stringify(w3.probaSorok()).includes(GCL_FOGL));
});

// ---------- T2 / QA-nap / lampa / egyeztetosor KIZARAS ----------
const kivonat = (j) => { const c = structuredClone(j); delete c.generalva_utc; for (const u of Object.values(c.uzletagak)) for (const p of Object.values(u.arnyek)) delete p.proba_sor_kizarva; return c; };

test('T1 a proba-sorok KIZARVA a QA-nap szamlalokbol (elkuldve / alap_elkuldve / forras / jogosultsag / lampa / osszes); csak a proba_sor_kizarva jelzi; a visszavonas-sorok is', async () => {
  const w = await vilag({ valos: false });
  w.beszur({ esemeny_id: 'FoglalasElso:mb_a', uzletag: 'fodrasz', platform_nev: 'ARNYEK-7825199995', kerelem: w.googleKerelem('7825199995', GCL_FOGL) });
  w.beszur({ esemeny_id: 'FoglalasElso:mb_b', uzletag: 'headspa', kerelem: w.googleKerelem('7825199989', GCL_REGI) });
  const nap = napIntervallum(NAP, MOST);
  const elotte = await qaNap(w.db, nap, { env: w.e, mostMs: MOST });
  await w.post(kuld({ futas_id: 'beadbeef' }));
  await w.post({ muvelet: 'google_proba_visszavon', futas_id: 'beadbeef', kuld: true, megerosit: MEGEROSITES }, { envFelul: { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO } });
  assert.equal(w.probaSorok().length, 16, '8 feltoltes + 8 visszavonas-sor');
  const utana = await qaNap(w.db, nap, { env: w.e, mostMs: MOST });
  assert.deepEqual(kivonat(utana), kivonat(elotte), 'a QA-nap jelentes (szamlalok, lampa, osszes, biztonsag) a proba-sorokkal bajtra azonos');
  const g = (j, u) => j.uzletagak[u].arnyek.google;
  assert.equal(g(utana, 'fodrasz').proba_sor_kizarva, 4); assert.equal(g(utana, 'oxigen').proba_sor_kizarva, 4); assert.equal(g(utana, 'szor').proba_sor_kizarva, 4); assert.equal(g(utana, 'pmu').proba_sor_kizarva, 4);
  assert.equal(g(utana, 'headspa').proba_sor_kizarva, undefined, 'headspa nincs proba-sor');
  assert.equal(g(utana, 'fodrasz').elkuldve, 1); assert.equal(g(utana, 'fodrasz').alap_elkuldve, 1); assert.deepEqual(Object.keys(g(utana, 'fodrasz').forras), ['motor']);
  assert.equal(utana.osszes.biztonsag.nem_arnyek_cel, 0); assert.equal(utana.osszes.biztonsag.elo_id_talalat, 0); assert.equal(utana.osszes.biztonsag.dupla, 0);
});

test('T2 a biztonsagi ellenorzesek a proba-soron IS futnak: elo akciora / idegen fiokra menesztett proba-sor jelzodik (elo_id_talalat, nem_arnyek_cel), a proba-jeloles nem mentesit', async () => {
  const w = await vilag({ valos: false });
  w.beszur({ esemeny_id: 'Proba:11111111:7030256606', nev: 'FoglalasElso', uzletag: 'pmu', forras: 'google_proba', source_id: 'gp_11111111', platform_nev: 'ARNYEK-7030256606', kerelem: { url: 'x', cel: { customer_id: '6088874770', conversion_action_id: '7030256606' }, body: { conversion_action_id: '7030256606' } } });
  w.beszur({ esemeny_id: 'Proba:22222222:7825200913', nev: 'FoglalasElso', uzletag: 'pmu', forras: 'google_proba', source_id: 'gp_22222222', kerelem: { url: 'x', cel: { customer_id: '1234567890', conversion_action_id: '7825200913' }, body: {} } });
  const j = await qaNap(w.db, napIntervallum(NAP, MOST), { env: w.e, mostMs: MOST });
  assert.ok(j.osszes.biztonsag.elo_id_talalat >= 1, 'elo ID a proba-sorban jelezve'); assert.ok(j.osszes.biztonsag.nem_arnyek_cel >= 2, 'idegen / elo cel a proba-sorban jelezve');
  assert.equal(j.uzletagak.pmu.arnyek.google.proba_sor_kizarva, 2); assert.equal(j.uzletagak.pmu.arnyek.google.elkuldve, 0, 'de a szamlalokba nem szamit');
});

test('T3 az egyeztetosor NEM latja a proba-forrasokat (source_id gp_*), a T2_START a proba-sorokat kulon szamolja (csak ha vannak)', async () => {
  const w = await vilag();
  const ig = NOW_SEC + 3600, tol = NOW_SEC - 86400;
  const eloszor = await egyeztetoSorok(w.db, { tol, ig });
  const t0 = await t2Start(w.db, w.e, MOST); assert.equal(t0.d1.sorok.meres_kuldes.google_proba_db, undefined, 'proba-sor nelkul a T2_START valtozatlan alaku');
  await w.post(kuld({ futas_id: 'cafe0001' }));
  const utana = await egyeztetoSorok(w.db, { tol, ig });
  assert.equal(utana.ok, true); assert.deepEqual(utana.sorok.map((s) => s.booking_id), eloszor.sorok.map((s) => s.booking_id)); assert.equal(utana.sorok.filter((s) => String(s.booking_id).startsWith('gp_')).length, 0);
  assert.equal(utana.osszegzes.foglalas, eloszor.osszegzes.foglalas);
  const t1 = await t2Start(w.db, w.e, MOST); assert.equal(t1.d1.sorok.meres_kuldes.google_proba_db, 8); assert.equal(t1.d1.sorok.meres_kuldes.db, t0.d1.sorok.meres_kuldes.db + 8);
});

// ---------- RETRACTION (visszavonas) ----------
test('V1 SZARAZ visszavonas: a terv a feltoltesek TUKORKEPE (ugyanazok az order_id-k es akciok), halozat es iras nelkul, dryRun, a visszavonas ideje nem a jovoben', async () => {
  const w = await vilag(); await w.post(kuld({ futas_id: 'f00d0001' }));
  const net = halozat(); const elotte = w.osszSor();
  const r = await w.post({ muvelet: 'google_proba_visszavon', futas_id: 'f00d0001' }, { net });
  assert.equal(r.status, 200); assert.equal(r.body.mod, 'szaraz'); assert.equal(r.body.dry_run, true); assert.equal(r.body.retraction_db, 8); assert.equal(r.body.webhook_beallitva, false); assert.equal(r.body.eles_engedelyezve, false);
  assert.equal(net.hivasok.length, 0); assert.equal(w.osszSor(), elotte);
  const feltoltott = w.probaSorok().map((s) => s.esemeny_id).sort();
  assert.deepEqual(r.body.terv.map((t) => t.order_id).sort(), feltoltott);
  assert.deepEqual(r.body.terv.map((t) => t.conversion_action_id), ELVART_8);
  for (const t of r.body.terv) { assert.equal(t.type, 'RETRACTION'); assert.ok(t.adjustment_date_time > t.eredeti_conversion_date_time, 'a visszavonas az eredeti konverzio UTAN'); assert.match(t.adjustment_date_time, /^2026-10-18 14:00:00\+02:00$/); }
  assert.ok(!JSON.stringify(r.body).includes(GCL_FOGL));
});

test('V2 visszavonas kuld:true de ELES NELKUL: a korrekcio-Zapra SEMMI nem megy (0 POST, meg a webhook + GOOGLE_KORREKCIO_ELES=1 mellett sem), csak a dry-run SOR kerul a D1-be (kihagyva / dry_run); ujrahivasra nem ismetlodik', async () => {
  const w = await vilag(); await w.post(kuld({ futas_id: 'f00d0002' }));
  const net = halozat(); const keres = { muvelet: 'google_proba_visszavon', futas_id: 'f00d0002', kuld: true, megerosit: MEGEROSITES };
  const env = { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO, GOOGLE_KORREKCIO_ELES: '1' };
  const r = await w.post(keres, { net, envFelul: env }); // eles:true hianyzik
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.mod, 'dry_run_sor'); assert.equal(r.body.dry_run, true); assert.equal(r.body.visszavonva, 0); assert.equal(r.body.posztolt_db, 0);
  assert.equal(net.hivasok.length, 0, 'dry-run: a korrekcio-Zap hivasa SEM');
  const vis = w.probaSorok().filter((s) => s.esemeny_id.startsWith('Visszavon:'));
  assert.equal(vis.length, 8); assert.ok(vis.every((s) => s.allapot === 'kihagyva' && /^dry_run/.test(s.indok) && s.esemeny_tipus === 'korrekcio' && s.source_id === 'gp_f00d0002' && s.probalkozas === 0 && s.http_status === null && s.platform_valasz === null));
  assert.ok(r.body.eredmenyek.every((e) => e.dry_run === true && e.posztolt === false && !e.duplikalt));
  for (const s of vis) { const k = JSON.parse(s.kerelem); assert.equal(k.body.dryRun, true); assert.equal(k.cel.dry_run, true); }
  const n2 = halozat(); const r2 = await w.post(keres, { net: n2, envFelul: env });
  assert.equal(n2.hivasok.length, 0); assert.equal(r2.body.eredmenyek.filter((e) => e.duplikalt).length, 8, 'a dry-run sor nem ismetlodik'); assert.equal(w.probaSorok().length, 16);
  // eles:true env nelkul es webhook nelkul is csak dry-run sor (a webhook a dry-run-hoz nem kell)
  const w2 = await vilag(); await w2.post(kuld({ futas_id: 'f00d0012' }));
  const n3 = halozat(); const r3 = await w2.post({ ...keres, futas_id: 'f00d0012', eles: true }, { net: n3, envFelul: {} });
  assert.equal(r3.status, 200); assert.equal(r3.body.mod, 'dry_run_sor'); assert.equal(n3.hivasok.length, 0);
});

test('V3 ELES visszavonas (POST a korrekcio-Zapra) CSAK eles:true ES GOOGLE_KORREKCIO_ELES=1 ES megerosit ES webhook mellett (dryRun:false); a dry-run sorokat az eles kor veszi at; ketszer nem megy', async () => {
  const w = await vilag(); await w.post(kuld({ futas_id: 'f00d0003' }));
  const kul = async (extra, env) => { const net = halozat(); const r = await w.post({ muvelet: 'google_proba_visszavon', futas_id: 'f00d0003', kuld: true, megerosit: MEGEROSITES, ...extra }, { net, envFelul: { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO, ...env } }); return { r, net }; };
  const a = await kul({ eles: true }, {}); assert.equal(a.r.body.dry_run, true, 'eles:true, de nincs GOOGLE_KORREKCIO_ELES -> dryRun'); assert.equal(a.net.hivasok.length, 0);
  const b0 = await kul({}, { GOOGLE_KORREKCIO_ELES: '1' }); assert.equal(b0.r.body.dry_run, true, 'GOOGLE_KORREKCIO_ELES=1, de eles:true nincs -> dryRun'); assert.equal(b0.net.hivasok.length, 0);
  assert.equal(w.probaSorok().filter((s) => s.esemeny_id.startsWith('Visszavon:')).length, 8);
  // eles, megerosites nelkul: 400, nincs POST
  const m = await kul({ eles: true, megerosit: 'nem' }, { GOOGLE_KORREKCIO_ELES: '1' }); assert.equal(m.r.status, 400); assert.equal(m.net.hivasok.length, 0);
  // eles, webhook nelkul: 409
  const nw = await w.post({ muvelet: 'google_proba_visszavon', futas_id: 'f00d0003', kuld: true, megerosit: MEGEROSITES, eles: true }, { net: halozat(), envFelul: { GOOGLE_KORREKCIO_ELES: '1' } }); assert.equal(nw.status, 409); assert.match(nw.body.miert, /KORREKCIO_WEBHOOK/);
  // az eles kor felulirja a dry-run sorokat
  const b = await kul({ eles: true }, { GOOGLE_KORREKCIO_ELES: '1' });
  assert.equal(b.r.body.dry_run, false); assert.equal(b.r.body.mod, 'kuldes'); assert.equal(b.net.hivasok.length, 8); assert.ok(b.net.hivasok.every((h) => h.url === KORREKCIO && h.body.dryRun === false && h.body.adjustments.length === 1)); assert.equal(b.r.body.visszavonva, 8); assert.equal(b.r.body.posztolt_db, 8);
  for (const h of b.net.hivasok) { const aj = h.body.adjustments[0]; assert.equal(aj.type, 'RETRACTION'); assert.match(aj.orderId, /^Proba:f00d0003:\d{10}$/); assert.equal(aj.conversionActionId, aj.orderId.split(':')[2]); assert.equal(aj.adjustmentDateTime, '2026-10-18 14:00:00+02:00'); assert.deepEqual(Object.keys(aj).sort(), ['adjustmentDateTime', 'conversionActionId', 'note', 'orderId', 'type']); }
  const vis = w.probaSorok().filter((s) => s.esemeny_id.startsWith('Visszavon:')); assert.equal(vis.length, 8);
  assert.ok(vis.every((s) => s.allapot === 'elkuldve' && s.indok === null && s.platform_valasz === '{"http":200,"status":"success","id":"z1"}'));
  const c = await kul({ eles: true }, { GOOGLE_KORREKCIO_ELES: '1' }); assert.equal(c.net.hivasok.length, 0, 'az elkuldott visszavonas nem ismetlodik');
});

test('V4 visszavonas hibaesetek: futas_id kell (400), ismeretlen futas (404), a webhook / megerosites / MERES_ELOSZTO kapuk, csak az ELKULDOTT feltoltesek kerulnek a tervbe, a nem-proba order_id / elo akcio nem vonhato vissza', async () => {
  const w = await vilag(); const net = halozat();
  assert.equal((await w.post({ muvelet: 'google_proba_visszavon' }, { net })).status, 400);
  assert.equal((await w.post({ muvelet: 'google_proba_visszavon', futas_id: 'zz' }, { net })).status, 400);
  assert.equal((await w.post({ muvelet: 'google_proba_visszavon', futas_id: '99999999' }, { net })).status, 404);
  await w.post(kuld({ futas_id: 'f00d0005' }), { net: halozat({ hiba: new Set(['7825200916']) }) });
  const terv = await w.post({ muvelet: 'google_proba_visszavon', futas_id: 'f00d0005' }, { net });
  assert.equal(terv.body.retraction_db, 7, 'a hibas (nem feltoltott) sor nincs a tervben'); assert.ok(!terv.body.terv.some((t) => t.conversion_action_id === '7825200916'));
  const ell = async (extra, envFelul, status, re) => { const r = await w.post({ muvelet: 'google_proba_visszavon', futas_id: 'f00d0005', kuld: true, megerosit: MEGEROSITES, eles: true, ...extra }, { net, envFelul: { GOOGLE_KORREKCIO_ELES: '1', ...envFelul } }); assert.equal(r.status, status, JSON.stringify(r.body)); if (re) assert.match(r.body.miert, re); };
  await ell({ megerosit: 'nem' }, { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO }, 400, /megerosit/);
  await ell({}, {}, 409, /KORREKCIO_WEBHOOK/);
  await ell({}, { GOOGLE_KORREKCIO_WEBHOOK_URL: 'https://evil.example/x' }, 409, /KORREKCIO_WEBHOOK/);
  await ell({}, { GOOGLE_KORREKCIO_WEBHOOK_URL: KORREKCIO, MERES_ELOSZTO: '0' }, 409, /MERES_ELOSZTO/);
  assert.equal(net.hivasok.length, 0);
  const nowSec = NOW_SEC;
  assert.match(visszavonasKerelem({ orderId: 'Proba:0a1b2c3d:7030256606', akcioId: '7030256606', nowSec }).tiltva, /8 probalhato/);
  assert.match(visszavonasKerelem({ orderId: 'Proba:0a1b2c3d:' + HEADSPA_ID[0], akcioId: HEADSPA_ID[0], nowSec }).tiltva, /8 probalhato/);
  assert.match(visszavonasKerelem({ orderId: 'FoglalasElso:mb_valodi', akcioId: '7825200913', nowSec }).tiltva, /proba-feltoltes/);
  assert.match(visszavonasKerelem({ orderId: 'Proba:0a1b2c3d:7825200913', akcioId: '7825200916', nowSec }).tiltva, /proba-feltoltes/);
  assert.equal(visszavonasKerelem({ orderId: 'Proba:0a1b2c3d:7825200913', akcioId: '7825200913', nowSec }).dryRun, true, 'alapbol dryRun');
});
