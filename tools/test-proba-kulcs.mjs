// CELHOZ KOTOTT, LEJARATOS PROBA-KULCS (DECISION #199 / #200; netlify/lib/meres/proba-kulcs.js + vegpontok.js) - OFFLINE TESZTEK
//   node --test tools/test-proba-kulcs.mjs
// Valodi SQLite (node:sqlite) a D1 helyett, fix ora, hamis halozat; semmi nem megy ki, nincs titok. Lefedi: a proba-kulcs KIZAROLAG a ket google_proba muveletre es KIZAROLAG POST-ra jo
// (minden mas muvelet, minden GET, a ?kulcs= query, rossz / hianyzo kulcs, a ?qa=nap ag: nincs belepes), a lejarat (valtozo, hianyzo valtozo, ervenytelen hash, a kodban rogzitett
// kemeny plafon), a naplozas (a muvelet ELOTT; ha nem naplozhato: elutasitas), es hogy a fo kulcs viselkedese valtozatlan.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sema } from '../netlify/lib/foglalas-kulcs.js';
import { meresSema } from '../netlify/lib/meres/elosztas.js';
import { kezelAdmin } from '../netlify/lib/meres/vegpontok.js';
import { PROBA_KULCS_MUVELETEK, PROBA_KULCS_PLAFON_MS, probaKulcsEllenorzes } from '../netlify/lib/meres/proba-kulcs.js';
import { MEGEROSITES } from '../netlify/lib/meres/google-proba.js';
import { qaKorlatNullaz } from '../netlify/lib/meres/qa-nap.js';
import { ENV_ALAP, d1 } from './lib-sd-teszt.mjs';

const MOST = Date.UTC(2026, 9, 19, 22, 30, 0);          // 2026-10-20 00:30 Budapest: a merge utan, a futas ideje
const FO_KULCS = 'fo-kulcs-teszt';
const PROBA_KULCS = 'proba-kulcs-' + 'a1b2c3d4'.repeat(6);
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const LEJAR = '2026-10-20T12:00:00Z';
const WEBHOOK = 'https://hooks.zapier.com/hooks/catch/1/teszt/';
const GCL = 'CjwKCAjwTESZTproba_' + 'a'.repeat(30); // egy valodi HeadSpa Google-feltoltes gclid-je (a google_proba ebbol valaszt, csak olvas)

// a futas_id veletlen (a source_id / order_id benne): az osszehasonlitashoz kicserelve
const norm = (r) => { const t = JSON.stringify(r), f = r.body && r.body.futas_id; return f ? t.split(f).join('FUTAS') : t; };

async function vilag({ env = {}, naploHiba = false } = {}) {
  qaKorlatNullaz();
  const D = d1();
  const raw = { prepare: D.prepare, batch: D.batch };
  // naploHiba: a proba_kulcs_naplo irasa hibat ad (a naplozhatatlan muvelet nem futhat)
  const db = naploHiba ? { ...raw, prepare: (sql) => { if (/proba_kulcs_naplo/.test(sql)) throw new Error('naplo-hiba'); return raw.prepare(sql); } } : raw;
  await sema(raw); await meresSema(raw);
  const e = { KULCS_DB: db, EGYEZTETES_KULCS_HASH: hash(FO_KULCS), GOOGLE_PROBA_KULCS_HASH: hash(PROBA_KULCS), GOOGLE_PROBA_KULCS_LEJAR: LEJAR, GOOGLE_ARNYEK_WEBHOOK_URL: WEBHOOK, ...ENV_ALAP, ...env };
  const sql = (q, ...a) => D.db.prepare(q).all(...a).map((r) => ({ ...r }));
  // egy valodi HeadSpa Google-feltoltes (FoglalasElso, elkuldve): a google_proba gclid-forrasa; enelkul minden google_proba 409-cel allna meg
  D.db.prepare('INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, kerelem, letrehozva, frissitve, forras, ertek, penznem) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('FoglalasElso:mb_teszt', 'FoglalasElso', 'alap', 'google', 'ARNYEK-7825199989', 'headspa', 's_teszt', 'elkuldve', JSON.stringify({ body: { gclid: GCL, conversion_action_id: '7825199989' } }), MOST / 1000 - 3600, MOST / 1000 - 3600, 'motor', 26900, 'HUF');
  const hivasok = [];
  const fetchImpl = async (url, opt) => { hivasok.push({ url, body: JSON.parse(opt.body) }); return { status: 200, text: async () => '{"status":"success","id":"z1"}' }; };
  const hiv = async (method, { kulcs, body, url = 'https://x.pages.dev/api/meres-admin', fejlec = true, most = MOST } = {}) => {
    const h = { 'content-type': 'application/json', ...(kulcs && fejlec ? { 'x-egyeztetes-kulcs': kulcs } : {}) };
    const u = kulcs && !fejlec ? url + (url.includes('?') ? '&' : '?') + 'kulcs=' + encodeURIComponent(kulcs) : url;
    const r = await kezelAdmin(new Request(u, { method, headers: h, ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) }), e, { now: () => most, fetchImpl });
    return { status: r.status, body: await r.json() };
  };
  const naplo = () => { try { return sql('SELECT muvelet, kuld, eles, ido FROM proba_kulcs_naplo ORDER BY id'); } catch (er) { return []; } };
  const probaSorok = () => sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE forras = 'google_proba'")[0].n;
  return { e, sql, hiv, naplo, hivasok, probaSorok };
}

test('a proba-kulcs a ket google_proba muveletre ugyanazt adja, mint a fo kulcs (szaraz futas 200, kuldes, visszavonas), es a hasznalat naplozva (kuld / eles jelzessel)', async () => {
  const w = await vilag();
  for (const body of [{ muvelet: 'google_proba' }, { muvelet: 'google_proba_visszavon', kuld: true, eles: true }]) {
    const fo = await w.hiv('POST', { kulcs: FO_KULCS, body }), proba = await w.hiv('POST', { kulcs: PROBA_KULCS, body });
    assert.notEqual(proba.status, 404, 'a proba-kulcs belep: ' + JSON.stringify(body));
    assert.equal(norm(proba), norm(fo), 'a muvelet eredmenye azonos a fo kulcsos hivassal (a kuldesi kapuk a google-proba.js-ben valtozatlanok): ' + JSON.stringify(body));
  }
  const szaraz = await w.hiv('POST', { kulcs: PROBA_KULCS, body: { muvelet: 'google_proba' } });
  assert.equal(szaraz.status, 200, 'szaraz futas (a gclid-forras megvan): 200'); assert.equal(szaraz.body.ok, true);
  assert.equal(w.hivasok.length, 0, 'szaraz futas: nincs halozat'); assert.equal(w.probaSorok(), 0, 'szaraz futas: nincs iras');
  // a kuldes a proba-kulccsal ugyanugy megy, mint a fo kulccsal (kulon vilagban: a 24 oras plafon / ujrafuttatas-idempotencia ne zavarjon)
  const A = await vilag(), B = await vilag();
  const kuld = { muvelet: 'google_proba', kuld: true, megerosit: MEGEROSITES };
  const rp = await A.hiv('POST', { kulcs: PROBA_KULCS, body: kuld }), rf = await B.hiv('POST', { kulcs: FO_KULCS, body: kuld });
  assert.equal(rp.status, 200, JSON.stringify(rp.body).slice(0, 200)); assert.equal(rp.status, rf.status);
  assert.ok(A.hivasok.length > 0 && A.hivasok.length === B.hivasok.length, 'ugyanannyi kimeno hivas: ' + A.hivasok.length + ' / ' + B.hivasok.length);
  assert.equal(A.probaSorok(), B.probaSorok()); assert.ok(A.probaSorok() > 0);
  assert.deepEqual(A.naplo().map((n) => [n.muvelet, n.kuld, n.eles, n.ido]), [['google_proba', 1, 0, MOST / 1000]], 'csak a proba-kulcsos hasznalat naplozott (a fo kulcsos nem), kuld jelzessel');
  assert.deepEqual(B.naplo(), []);
  assert.deepEqual(w.naplo().map((n) => [n.muvelet, n.kuld, n.eles]), [['google_proba', 0, 0], ['google_proba_visszavon', 1, 1], ['google_proba', 0, 0]], 'a szaraz / visszavonas hasznalatok is naplozva (eles jelzessel)');
});

test('a proba-kulcs MINDEN mas muveletre 404, allapotvaltozas es naplo nelkul (iras-kapcsolo, sd_kapcsolo, kapcsolo, megerosit, ajandek_ujra, ismeretlen, hianyzo, null torzs)', async () => {
  const w = await vilag();
  const elotte = JSON.stringify([w.sql('SELECT * FROM meres_kapcsolo'), w.sql('SELECT COUNT(*) AS n FROM meres_kuldes')]);
  for (const body of [{ muvelet: 'iras', be: false }, { muvelet: 'sd_kapcsolo', uzletag: 'oxigen', be: true }, { muvelet: 'kapcsolo', platform: 'google', be: false }, { muvelet: 'megerosit', id: 1, allapot: 'elkuldve' },
    { muvelet: 'ajandek_ujra', pi: 'pi_1234567890' }, { muvelet: 'valami' }, {}, null, 'null', '[1]', 'nem json', { muvelet: ['google_proba'] }, { muvelet: 'GOOGLE_PROBA' }, { muvelet: 'google_proba ' }]) {
    const r = await w.hiv('POST', { kulcs: PROBA_KULCS, body });
    assert.ok([404, 400].includes(r.status), 'nincs belepes: ' + JSON.stringify(body) + ' -> ' + r.status);
    if (r.status === 400) assert.equal(r.body.miert, 'nem JSON', 'a 400 csak a nem-JSON torzsre (a kulcs mar belepett, a torzs nem olvashato): ' + JSON.stringify(body));
    else assert.deepEqual(r.body, { ok: false });
  }
  assert.equal(JSON.stringify([w.sql('SELECT * FROM meres_kapcsolo'), w.sql('SELECT COUNT(*) AS n FROM meres_kuldes')]), elotte, 'semmi nem valtozott');
  assert.deepEqual(w.naplo(), [], 'nem engedett muvelet nem naplozott (es nem is futott)');
});

test('a proba-kulcs minden GET-re, a ?kulcs= query-re, rossz / hianyzo kulcsra es a ?qa=nap agra nem enged be', async () => {
  const w = await vilag();
  for (const url of ['?kapcsolok=1', '?fuggo=1', '?source_id=gp_x', '?egyeztetes=1&tol=1&ig=2', '']) {
    assert.equal((await w.hiv('GET', { kulcs: PROBA_KULCS, url: 'https://x.pages.dev/api/meres-admin' + url })).status, 404, 'GET: ' + url);
  }
  assert.equal((await w.hiv('POST', { kulcs: PROBA_KULCS, fejlec: false, body: { muvelet: 'google_proba' } })).status, 404, 'a ?kulcs= query-ben a proba-kulcs nem fogadhato el');
  assert.equal((await w.hiv('POST', { kulcs: 'rossz-kulcs', body: { muvelet: 'google_proba' } })).status, 404);
  assert.equal((await w.hiv('POST', { body: { muvelet: 'google_proba' } })).status, 404);
  assert.equal((await w.hiv('POST', { kulcs: PROBA_KULCS.slice(0, -1), body: { muvelet: 'google_proba' } })).status, 404);
  for (const q of ['?qa=nap&datum=2026-10-19', '?qa=t2start']) { // a qa-ag sajat (fo) kulcs-ellenorzesen akad el: a proba-kulcs ott 403 (GET); POST-ra a qa-ag 405-ot ad, a kulcs vizsgalata elott
    qaKorlatNullaz();
    assert.equal((await w.hiv('GET', { kulcs: PROBA_KULCS, url: 'https://x.pages.dev/api/meres-admin' + q })).status, 403, 'GET ' + q);
    assert.notEqual((await w.hiv('POST', { kulcs: PROBA_KULCS, url: 'https://x.pages.dev/api/meres-admin' + q, body: { muvelet: 'google_proba' } })).status, 200, 'POST ' + q);
  }
  assert.deepEqual(w.naplo(), []);
});

test('lejarat: a LEJAR utan, hianyzo / ervenytelen LEJAR-nal, ervenytelen hash-nel es a kodban rogzitett plafon utan a proba-kulcs nem er semmit', async () => {
  const body = { muvelet: 'google_proba' };
  assert.notEqual((await (await vilag()).hiv('POST', { kulcs: PROBA_KULCS, body })).status, 404, 'a LEJAR elott ervenyes');
  const w1 = await vilag(); assert.equal((await w1.hiv('POST', { kulcs: PROBA_KULCS, body, most: Date.parse(LEJAR) })).status, 404, 'pontosan a LEJAR-kor mar lejart');
  assert.equal((await w1.hiv('POST', { kulcs: PROBA_KULCS, body, most: Date.parse(LEJAR) + 1 })).status, 404);
  for (const env of [{ GOOGLE_PROBA_KULCS_LEJAR: '' }, { GOOGLE_PROBA_KULCS_LEJAR: undefined }, { GOOGLE_PROBA_KULCS_LEJAR: 'holnap' }, { GOOGLE_PROBA_KULCS_HASH: '' }, { GOOGLE_PROBA_KULCS_HASH: undefined }, { GOOGLE_PROBA_KULCS_HASH: 'xyz' }, { GOOGLE_PROBA_KULCS_HASH: hash(PROBA_KULCS).slice(0, 63) }]) {
    assert.equal((await (await vilag({ env })).hiv('POST', { kulcs: PROBA_KULCS, body })).status, 404, JSON.stringify(env));
  }
  // a kemeny plafon: egy "2030-ig" meghosszabbitott LEJAR sem er semmit a plafon (2026-10-21 00:00Z) utan, de elotte igen
  const hosszu = await vilag({ env: { GOOGLE_PROBA_KULCS_LEJAR: '2030-01-01T00:00:00Z' } });
  assert.notEqual((await hosszu.hiv('POST', { kulcs: PROBA_KULCS, body, most: PROBA_KULCS_PLAFON_MS - 1 })).status, 404, 'a plafon elott a (hosszu) LEJAR szerint ervenyes');
  assert.equal((await hosszu.hiv('POST', { kulcs: PROBA_KULCS, body, most: PROBA_KULCS_PLAFON_MS })).status, 404, 'a plafon utan semmilyen valtozo nem tarthatja eletben');
  assert.equal(PROBA_KULCS_PLAFON_MS, Date.UTC(2026, 9, 21), 'a plafon: 2026-10-21 00:00Z (<= 48 ora a 10-19-i kiadastol)');
  // a fo kulcs a proba-kulcs lejarata utan is valtozatlanul mukodik
  assert.notEqual((await w1.hiv('POST', { kulcs: FO_KULCS, body, most: PROBA_KULCS_PLAFON_MS + 1000 })).status, 404);
});

test('naplo nelkul nincs muvelet: ha a proba-kulcsos hasznalat nem naplozhato, 404 es SEMMI nem fut (0 kimeno hivas, 0 iras); a fo kulcs ettol fuggetlen', async () => {
  const w = await vilag({ naploHiba: true });
  for (const body of [{ muvelet: 'google_proba' }, { muvelet: 'google_proba', kuld: true, megerosit: MEGEROSITES }, { muvelet: 'google_proba_visszavon', kuld: true, megerosit: MEGEROSITES, eles: true }]) {
    assert.equal((await w.hiv('POST', { kulcs: PROBA_KULCS, body })).status, 404, JSON.stringify(body));
  }
  assert.equal(w.hivasok.length, 0, 'nem ment ki semmi'); assert.equal(w.probaSorok(), 0, 'nem keletkezett proba-sor');
  assert.equal((await w.hiv('POST', { kulcs: FO_KULCS, body: { muvelet: 'google_proba' } })).status, 200, 'a fo kulcsos hivas nem naplozik, nem erinti');
});

test('a fo kulcs viselkedese valtozatlan: minden muvelet es GET tovabbra is elerheto vele; a proba-kulcs nem fo kulcs', async () => {
  const w = await vilag();
  assert.equal((await w.hiv('GET', { kulcs: FO_KULCS, url: 'https://x.pages.dev/api/meres-admin?kapcsolok=1' })).status, 200);
  assert.equal((await w.hiv('POST', { kulcs: FO_KULCS, body: { muvelet: 'iras', be: true } })).status, 200);
  assert.equal((await w.hiv('GET', { kulcs: PROBA_KULCS, url: 'https://x.pages.dev/api/meres-admin?kapcsolok=1' })).status, 404);
  assert.deepEqual(PROBA_KULCS_MUVELETEK, ['google_proba', 'google_proba_visszavon'], 'pontosan a ket muvelet');
  assert.equal(await probaKulcsEllenorzes(new Request('https://x/', { headers: { 'x-egyeztetes-kulcs': FO_KULCS } }), { GOOGLE_PROBA_KULCS_HASH: hash(PROBA_KULCS), GOOGLE_PROBA_KULCS_LEJAR: LEJAR }, MOST), false, 'a fo kulcs nem proba-kulcs');
});
