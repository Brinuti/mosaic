// DECISION #250 (01-MERES 6464351642): a megszakadt kuldesek kezelese. (a) qa-nap folyamatban_regi / megszakadt_7nap (csak olvaso, sarga lampa); (b) a 'folyamatban' ujraproba plafonos
// (MAX_PROBA), utana 'megszakadt' - elosztas.js (ARNYEK), meta-elo.js, tiktok-elo.js; (c) ujraprobal_mp a hivonak, ha friss 'folyamatban' cellat talalunk; + 4 s fetch-timeout az ELO modulokban.
//   node --test tools/test-folyamatban-plafon.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { elosztas, erkezesMent, meresSema } from '../netlify/lib/meres/elosztas.js';
import { ELO_FETCH_TIMEOUT_MS as META_TIMEOUT, metaEloKuld } from '../netlify/lib/meres/meta-elo.js';
import { ELO_FETCH_TIMEOUT_MS as TT_TIMEOUT, tiktokEloKuld } from '../netlify/lib/meres/tiktok-elo.js';
import { napIntervallum, qaKorlatNullaz, qaNap } from '../netlify/lib/meres/qa-nap.js';
import { d1 } from './lib-sd-teszt.mjs';

const HOST = 'https://www.mosaicheadspa.hu';
const T0 = Date.UTC(2026, 9, 28, 5, 30, 41);
const ID = (x) => ('mb_0muwq2ciorsos0tznsfyli' + x).toLowerCase();
const BU = 'https://mosaicheadspa.salonic.hu/guestData/?placeId=16&serviceId=77&startDate=1790000000';
const ERK = (o = {}) => ({ source_id: ID('q'), uzletag: 'headspa', tipus: 'foglalas', szolgaltatas: 'Headspa kezeles', ar: 15000, first_booking: true, g: 'g:555', bookingUrl: BU, attr: { fbp: 'fb.1.1790000000.1234567890' }, hozz: { ana: true, adv: true, fun: true }, oldal: HOST + '/success', ua: 'UA/1.0', ip: '203.0.113.9', ...o });
const FK = (o = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: ID('q'), jelleg: 'elso', kupon: false, ertek: 15000, ido: Math.floor(T0 / 1000), vendeg: { email: 'proba.vendeg@example.com', telefon: '+36301234567', g: '555' }, ...o });
const EV_ENV = { MERES_ELOSZTO: '1', META_TESZT_KOD: 'TEST12345', TIKTOK_TESZT_KOD: 'TEST67890', GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' };
const OK = { allapot: 'elkuldve', http_status: 200, valasz: '{}', kuldo: 'kozvetlen' };
const sorok = (d) => d.db.prepare('SELECT id, esemeny_nev, platform, allapot, probalkozas, indok, frissitve FROM meres_kuldes ORDER BY id').all().map((r) => ({ ...r }));
const meglevo = (d, nev, platform) => sorok(d).find((r) => r.esemeny_nev === nev && r.platform === platform);

test('P1 elosztas: a megszakadt hivas sora 3 probalkozas utan "megszakadt" (nem marad vegtelen ideig folyamatban), friss folyamatban cellanal ujraprobal_mp a hivonak', async () => {
  const d = d1(); await meresSema(d); await erkezesMent(d, ERK(), T0);
  const hiv = []; const jo = async (k) => { hiv.push(k.platform); return OK; };
  const megszakit = async () => { throw new Error('megszakitva (a hivo lecsatlakozott)'); };
  // 1. hivas: a FoglalasElso / meta kuldesen megszakad -> a sor folyamatban, probalkozas 1
  await assert.rejects(elosztas(d, FK(), { env: EV_ENV, kuldo: megszakit, now: () => T0 }), /megszakitva/);
  let c = meglevo(d, 'HeadSpa_FoglalasElso', 'meta') || sorok(d).find((r) => r.allapot === 'folyamatban');
  assert.equal(c.allapot, 'folyamatban'); assert.equal(c.probalkozas, 1);
  const cPl = c.platform;
  // 2. hivas +64 s: a friss cellat kihagyja (duplikalt), a tobbit elkuldi, es megmondja a hivonak, mikor probalja ujra
  const r2 = await elosztas(d, FK(), { env: EV_ENV, kuldo: jo, now: () => T0 + 64000 });
  assert.ok(r2.ujraprobal_mp >= 56 && r2.ujraprobal_mp <= 66, `ujraprobal_mp = ${r2.ujraprobal_mp}`);
  assert.equal(sorok(d).find((r) => r.id === c.id).allapot, 'folyamatban', 'a friss sort nem vette at');
  // 3. hivas +125 s: ujraprobalhato (probalkozas 1 < 3) -> ujra megszakad (2)
  await assert.rejects(elosztas(d, FK(), { env: EV_ENV, kuldo: megszakit, now: () => T0 + 125000 }), /megszakitva/);
  assert.equal(sorok(d).find((r) => r.id === c.id).probalkozas, 2);
  // 4. hivas +250 s: (2 < 3) -> ujra megszakad (3)
  await assert.rejects(elosztas(d, FK(), { env: EV_ENV, kuldo: megszakit, now: () => T0 + 250000 }), /megszakitva/);
  assert.equal(sorok(d).find((r) => r.id === c.id).probalkozas, 3);
  // 5. hivas +400 s: a plafon elerve -> 'megszakadt', a cellara NEM megy kuldes
  hiv.length = 0;
  const r5 = await elosztas(d, FK(), { env: EV_ENV, kuldo: jo, now: () => T0 + 400000 });
  const veg = sorok(d).find((r) => r.id === c.id);
  assert.equal(veg.allapot, 'megszakadt'); assert.match(veg.indok, /^megszakadt: a kuldes 3 probalkozas/);
  assert.equal(cPl, 'meta'); assert.ok(!hiv.includes('meta'), `a megszakadt meta cellara nem megy kuldes (hivasok: ${hiv.join(',')})`);
  assert.equal(r5.ujraprobal_mp, undefined, 'nincs friss folyamatban cella');
  // 6. tovabbi hivas: a megszakadt sor vegleges, nem probalja ujra
  const elotte = sorok(d).length;
  const r6 = await elosztas(d, FK(), { env: EV_ENV, kuldo: jo, now: () => T0 + 900000 });
  assert.equal(sorok(d).find((r) => r.id === c.id).allapot, 'megszakadt'); assert.equal(sorok(d).length, elotte);
  assert.ok(['mar_kuldve', 'kesz'].includes(r6.allapot));
});

test('P2 elosztas: egy friss folyamatban cella, minden mas vegleges -> mar_kuldve + ujraprobal_mp; a hiba-ag plafonja (3) valtozatlan', async () => {
  const d = d1(); await meresSema(d); await erkezesMent(d, ERK({ attr: { fbp: 'fb.1.1790000000.1234567890', ga4: { client_id: '1234567890.1759759200', session_id: '1759759200', measurement_id: 'G-H4206SQ0Q7' } } }), T0);
  const jo = async () => OK;
  await elosztas(d, FK(), { env: EV_ENV, kuldo: jo, now: () => T0 });
  const id = sorok(d).find((r) => r.platform === 'meta').id;
  d.db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', probalkozas = 1, frissitve = ? WHERE id = ?").run(Math.floor(T0 / 1000), id);
  const r = await elosztas(d, FK(), { env: EV_ENV, kuldo: jo, now: () => T0 + 30000 });
  assert.equal(r.allapot, 'mar_kuldve'); assert.ok(r.ujraprobal_mp >= 90 && r.ujraprobal_mp <= 100, `ujraprobal_mp = ${r.ujraprobal_mp}`);
});

for (const [nev, kuld, TIMEOUT, tabla, ENV, valasz] of [
  ['meta-elo', metaEloKuld, META_TIMEOUT, 'meres_meta_elo', { META_ELO_BE: 'headspa', META_ELO_TOKEN: 'teszt-elo-token-0123456789abcdef' }, { events_received: 1 }],
  ['tiktok-elo', tiktokEloKuld, TT_TIMEOUT, 'meres_tiktok_elo', { TIKTOK_ELO_BE: 'headspa', TIKTOK_ELO_TOKEN: 'teszt-elo-token-0123456789abcdef', MERES_ELOSZTO: '1' }, { code: 0, message: 'OK' }],
]) {
  test(`P3 ${nev}: 4 s fetch-timeout (AbortSignal), a folyamatban sor plafonos (megszakadt), friss folyamatban sornal ujraprobal_mp`, async () => {
    assert.equal(TIMEOUT, 4000);
    const d = d1(); await meresSema(d); await erkezesMent(d, ERK(), T0);
    let jel = null; const f = async (u, o) => { jel = o.signal; return { status: 200, json: async () => valasz }; };
    const dep = (ms, fi = f) => ({ env: ENV, fetchImpl: fi, now: () => T0 + ms });
    const r1 = await kuld(d, FK(), dep(0));
    assert.equal(r1.allapot, 'elkuldve'); assert.ok(jel instanceof AbortSignal, 'a kerelem signal-t kap');
    // a megszakadt hivas utani allapot szimulalasa
    const allit = (probalkozas, frissitveMs) => d.db.prepare(`UPDATE ${tabla} SET allapot = 'folyamatban', probalkozas = ?, frissitve = ?`).run(probalkozas, Math.floor((T0 + frissitveMs) / 1000));
    allit(1, 0);
    const friss = await kuld(d, FK(), dep(30000)); assert.equal(friss.allapot, 'mar_kuldve'); assert.ok(friss.ujraprobal_mp >= 90 && friss.ujraprobal_mp <= 100, `ujraprobal_mp = ${friss.ujraprobal_mp}`);
    const ujra = await kuld(d, FK(), dep(130000)); assert.equal(ujra.allapot, 'elkuldve', 'probalkozas 1 < 3: az ELAKADAS_MP utan ujraprobalhato');
    allit(3, 0);
    let hivott = 0; const szamol = async (u, o) => { hivott++; return f(u, o); };
    const meg = await kuld(d, FK(), dep(130000, szamol));
    assert.equal(meg.allapot, 'megszakadt'); assert.equal(hivott, 0, 'a plafonos sorra nem megy kuldes');
    const sor = d.db.prepare(`SELECT allapot, indok FROM ${tabla}`).get(); assert.equal(sor.allapot, 'megszakadt'); assert.match(sor.indok, /^megszakadt: a kuldes 3 probalkozas/);
    const tovabb = await kuld(d, FK(), dep(900000, szamol)); assert.equal(tovabb.allapot, 'mar_kuldve'); assert.equal(hivott, 0);
  });
}

test('P4 qa-nap: folyamatban_regi (> 10 perc) uzletag x platform, max_perc, megszakadt_7nap; sarga lampa; a friss / a masik nap-ablakon kivuli / a google_proba sor nem szamit; csak olvas', async () => {
  qaKorlatNullaz();
  const d = d1(); await meresSema(d);
  const NOW = Date.UTC(2026, 9, 28, 12, 0, 0); const s = (ms) => Math.floor((NOW - ms) / 1000);
  const ins = (nev, pl, uz, allapot, letre, fris, forras = 'motor') => d.db.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, uzletag, source_id, allapot, letrehozva, frissitve, forras) VALUES (?,?,?,?,?,?,?,?,?,?)").run(`e_${nev}_${pl}_${allapot}_${letre}`, nev, 'alap', pl, uz, `s_${nev}_${letre}`, allapot, letre, fris, forras);
  ins('A', 'meta', 'szor', 'folyamatban', s(3600e3), s(3600e3));        // 60 perce folyamatban -> szamit
  ins('B', 'tiktok', 'szor', 'folyamatban', s(1200e3), s(1200e3));       // 20 perc -> szamit
  ins('C', 'meta', 'headspa', 'folyamatban', s(300e3), s(300e3));        // 5 perc -> friss, nem szamit
  ins('D', 'meta', 'headspa', 'folyamatban', s(9 * 86400e3), s(9 * 86400e3)); // 9 napos -> a 7 napos ablakon kivul
  ins('E', 'meta', 'oxigen', 'megszakadt', s(2 * 86400e3), s(86400e3));  // megszakadt, 7 napon belul -> szamit
  ins('F', 'google', 'szor', 'folyamatban', s(7200e3), s(7200e3), 'google_proba'); // proba sor -> kizarva
  const kor = napIntervallum('2026-10-28');
  const j = await qaNap(d, kor, { mostMs: NOW });
  const sz = j.uzletagak.szor.folyamatban_regi;
  assert.equal(sz.db, 2); assert.equal(sz.max_perc, 60); assert.deepEqual(sz.platformok, { meta: { db: 1, max_perc: 60 }, tiktok: { db: 1, max_perc: 20 } });
  assert.equal(j.uzletagak.headspa.folyamatban_regi.db, 0);
  assert.equal(j.uzletagak.oxigen.folyamatban_regi.megszakadt_7nap, 1);
  assert.equal(j.uzletagak.szor.lampa, 'sarga'); assert.equal(j.uzletagak.oxigen.lampa, 'sarga'); assert.notEqual(j.uzletagak.headspa.lampa, 'sarga');
  assert.deepEqual(j.osszes.folyamatban_regi, { db: 2, max_perc: 60, megszakadt_7nap: 1 });
  // csak olvas
  const elotte = JSON.stringify(sorok(d));
  await qaNap(d, kor, { mostMs: NOW });
  assert.equal(JSON.stringify(sorok(d)), elotte);
});
