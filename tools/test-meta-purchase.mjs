// UJ-62 (#167 6387024988): a HeadSpa ajandekkartya-vasarlas szabvanyos Meta Purchase esemenye (META_PURCHASE_MOD = ki | arnyek).
//   node --test tools/test-meta-purchase.mjs
// Valodi SQLite (node:sqlite) a D1 helyett; a fetch egy szamlalo mock - semmi nem megy ki a halozatra, nincs titok, nincs szemelyes adat.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { esemenyek, metaNev, metaPurchaseMod } from '../netlify/lib/meres/esemeny-modell.js';
import { ajandekForras } from '../netlify/lib/meres/ajandek-esemeny.js';
import { elosztas, erkezesMent, kapcsoloBeallit } from '../netlify/lib/meres/elosztas.js';
import { ARNYEK, metaKerelem } from '../netlify/lib/meres/platformok.js';
import { erkezesTisztit } from '../netlify/lib/meres/erkezes.js';
import { hozzajarulasTisztit, platformSzabaly } from '../netlify/lib/meres/hozzajarulas.js';
import { felhasznaloHash } from '../netlify/lib/meres/felhasznalo-hash.js';

const h = (s) => crypto.createHash('sha256').update(s).digest('hex');
const KULCS = 'teszt-guest-hmac-kulcs-0123456789abcdef';
const PI = 'pi_3Sabc123XYZabc456';
const ATU = 'ATU-ABC12345';
const NOW = Date.UTC(2026, 9, 6, 14, 0, 0); const IDO = Math.floor(NOW / 1000) - 60;
const BE = () => ({ google: { gclid: { ertek: 'Cj0KCQjw_TESZT_gclid_0123456789', ts: IDO - 100 } }, meta: { fbc: `fb.1.${(IDO - 90) * 1000}.IwAR_fbclid_TESZT_01`, fbclid: 'IwAR_fbclid_TESZT_01', ts: IDO - 90 }, tiktok: { ttclid: { ertek: 'E.C.P.ttclid_TESZT_01', ts: IDO - 80 } }, fbp: `fb.1.${(IDO - 9000) * 1000}.1234567890`, ttp: 'ttp_TESZT_0123456789abcdef', ga4: { client_id: '1234567890.1759759200', session_id: '1759759200' } });
const TELJES_ENV = { META_TESZT_KOD: 'TEST12345', TIKTOK_TESZT_KOD: 'TEST67890', GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001', MERES_ELOSZTO: '1', META_CAPI_TOKEN: 't', TIKTOK_EVENTS_TOKEN: 't', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/teszt/', GA4_TESZT_API_SECRET: 't', GUEST_HMAC_KEY_V1: KULCS };
const ARNYEK_ENV = { ...TELJES_ENV, META_PURCHASE_MOD: 'arnyek' };
const kartyaPi = (o = {}) => ({ id: PI, status: 'succeeded', amount: 5380000, amount_received: 5380000, created: IDO, receipt_email: 'vevo@example.com', metadata: { termek: 'x', telefon: '06 30 000 0002', nev: 'Szabó Éva', varos: 'Debrecen', iranyitoszam: '4025' }, latest_charge: null, ...o });
const atuPi = () => ({ id: 'pi_3Satu0000XYZ000000', status: 'requires_payment_method', amount: 2990000, created: IDO, receipt_email: 'vevo@example.com', metadata: { termek: 'y', fizetesi_mod: 'atutalas', atutalas_beerkezett: '1', atu_ref: ATU, atutalas_ekkor: new Date(NOW - 30000).toISOString(), nev: 'Szabó Éva' }, latest_charge: null });

function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({ run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...args) || null, all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }) });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
const SIKER = { meta: { events_received: 1 }, tiktok: { code: 0 }, google: {}, ga4: {} };
const hamis = () => {
  const hivasok = [];
  const f = async (url, o) => {
    if (String(url).includes('/debug/mp/collect')) return { status: 200, text: async () => JSON.stringify({ validationMessages: [] }) };
    const kulcs = ['meta', 'tiktok', 'google', 'ga4'][['graph.facebook.com', 'business-api.tiktok.com', 'hooks.zapier.com', 'google-analytics.com'].findIndex((x) => String(url).includes(x))];
    hivasok.push({ kulcs, url: String(url), body: JSON.parse(o.body) });
    return { status: 200, text: async () => JSON.stringify(SIKER[kulcs]) };
  };
  return { f, hivasok };
};
const erkBe = (sourceId) => ({ source_id: sourceId, uzletag: 'ajandekkartya' === 'x' ? 'x' : 'headspa', tipus: 'ajandekkartya', attr: BE(), hozz: { ana: true, adv: true, fun: true }, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/success-ajandekkartya-stripe' });
const sorok = (db) => db.db.prepare('SELECT esemeny_id, esemeny_nev, esemeny_tipus, platform, allapot, indok, ertek, penznem FROM meres_kuldes ORDER BY id').all().map((r) => ({ ...r }));
async function fut(pi, mod, env, { eloEllenorzes, fetchImpl } = {}) {
  const w = d1(); const m = hamis();
  const { fk } = ajandekForras(pi, mod);
  await erkezesMent(w, erkBe(fk.source_entity_id), NOW);
  const r = await elosztas(w, fk, { env, fetchImpl: fetchImpl || m.f, now: () => NOW, eloEllenorzes });
  return { w, m, r, fk };
}

test('metaPurchaseMod: alap ki; csak az "arnyek" ertek kapcsol be (az "eles" es minden mas ertek = ki)', () => {
  for (const v of [undefined, null, '', 'ki', 'KI', 'eles', 'ELES', 'be', '1', 'true', 'arnyek2']) assert.equal(metaPurchaseMod({ META_PURCHASE_MOD: v }), 'ki', String(v));
  assert.equal(metaPurchaseMod({}), 'ki'); assert.equal(metaPurchaseMod(undefined), 'ki');
  for (const v of ['arnyek', ' ARNYEK ', 'Arnyek']) assert.equal(metaPurchaseMod({ META_PURCHASE_MOD: v }), 'arnyek');
});

test('esemenyek: opcio nelkul az ajandekkartya lista valtozatlan (alap + ernyo); az opcioval + Purchase (st-<pi>, csak Meta); foglalasnal / mas uzletagnal / utalasnal a szabaly', () => {
  const fkKartya = ajandekForras(kartyaPi(), 'kartya').fk;
  const regi = esemenyek(fkKartya);
  assert.deepEqual(regi.map((e) => [e.nev, e.tipus]), [['Ajandekkartya', 'alap'], ['Schedule', 'ernyo']]);
  assert.deepEqual(esemenyek(fkKartya, undefined, {}), regi); assert.deepEqual(esemenyek(fkKartya, undefined, { metaPurchase: false }), regi);
  const uj = esemenyek(fkKartya, undefined, { metaPurchase: true });
  assert.deepEqual(uj.slice(0, 2), regi, 'a regi ket esemeny valtozatlan');
  assert.equal(uj.length, 3);
  const p = uj[2];
  assert.deepEqual([p.nev, p.tipus, p.esemeny_id, p.ertek, p.penznem, p.ertek_forras, p.nyitott], ['Purchase', 'purchase', 'st-' + PI, 53800, 'HUF', 'tenyleges_ar', false]);
  assert.deepEqual([...p.csak_platform], ['meta']);
  assert.equal(metaNev(p, 'headspa'), 'Purchase'); assert.equal(metaNev(regi[0], 'headspa'), 'HeadSpa_Ajandekkartya'); assert.equal(metaNev(regi[1], 'headspa'), 'Schedule');
  // utalas: a sajat rendeles-azonosito
  const fkAtu = ajandekForras(atuPi(), 'atutalas').fk; assert.equal(esemenyek(fkAtu, undefined, { metaPurchase: true }).find((e) => e.tipus === 'purchase').esemeny_id, 'st-' + ATU);
  // foglalas / mas uzletag: nincs Purchase
  const foglalas = { tipus: 'foglalas', uzletag: 'headspa', source_entity_id: 'mb_0muwq2ciorsos0tznsfyliq', jelleg: 'elso', kupon: false, ertek: 26900 };
  assert.ok(!esemenyek(foglalas, undefined, { metaPurchase: true }).some((e) => e.tipus === 'purchase'));
  assert.ok(!esemenyek({ ...fkKartya, uzletag: 'fodrasz' }, undefined, { metaPurchase: true }).some((e) => e.tipus === 'purchase'));
});

test('elosztas, ki mod (alap, "eles" es ismeretlen ertek is): a meres_kuldes sorok es a kimeno hivasok BAJTRA azonosak a META_PURCHASE_MOD nelkuli futassal; Purchase nincs', async () => {
  const alap = await fut(kartyaPi(), 'kartya', TELJES_ENV);
  for (const v of ['ki', 'eles', 'valami']) {
    const x = await fut(kartyaPi(), 'kartya', { ...TELJES_ENV, META_PURCHASE_MOD: v });
    assert.deepEqual(sorok(x.w), sorok(alap.w), v + ': sorok'); assert.deepEqual(x.m.hivasok, alap.m.hivasok, v + ': kimeno hivasok'); assert.equal(x.r.esemenyek.length, 2);
  }
  assert.ok(!sorok(alap.w).some((s) => s.esemeny_nev === 'Purchase'));
});

test('elosztas, arnyek mod: a Purchase pontosan egy sor (csak meta), a regi sorok valtozatlanok; a Meta-keres: Purchase, st-<pi>, ertek / penznem / order_id / content_name, ARNYEK dataset + tesztkod', async () => {
  const alap = await fut(kartyaPi(), 'kartya', TELJES_ENV);
  const x = await fut(kartyaPi(), 'kartya', ARNYEK_ENV);
  assert.equal(x.r.allapot, 'kesz');
  const regiSorok = sorok(alap.w), ujSorok = sorok(x.w);
  assert.equal(ujSorok.length, regiSorok.length + 1, 'egyetlen uj sor');
  const purchase = ujSorok.filter((s) => s.esemeny_nev === 'Purchase');
  assert.equal(purchase.length, 1); assert.deepEqual([purchase[0].esemeny_id, purchase[0].esemeny_tipus, purchase[0].platform, purchase[0].allapot, purchase[0].ertek, purchase[0].penznem], ['st-' + PI, 'purchase', 'meta', 'elkuldve', 53800, 'HUF']);
  assert.deepEqual(ujSorok.filter((s) => s.esemeny_nev !== 'Purchase'), regiSorok, 'a tobbi sor valtozatlan');
  const metaHivasok = x.m.hivasok.filter((c) => c.kulcs === 'meta');
  const pc = metaHivasok.find((c) => c.body.data[0].event_name === 'Purchase');
  assert.ok(pc, 'van Purchase Meta-hivas'); assert.equal(metaHivasok.length, 3, 'HeadSpa_Ajandekkartya + Schedule + Purchase');
  assert.ok(pc.url.includes('/28616665324611098/events') && !pc.url.includes('3473839859576758'), 'csak az ARNYEK dataset');
  assert.equal(pc.body.test_event_code, 'TEST12345');
  const d = pc.body.data[0];
  assert.deepEqual([d.event_id, d.action_source, d.event_time, d.event_source_url], ['st-' + PI, 'website', IDO, 'https://www.mosaicheadspa.hu/success-ajandekkartya-stripe']);
  assert.deepEqual([d.custom_data.value, d.custom_data.currency, d.custom_data.order_id, d.custom_data.content_name, d.custom_data.content_category], [53800, 'HUF', PI, 'ajandekkartya', 'headspa']);
  assert.deepEqual([d.user_data.em, d.user_data.fn, d.user_data.ct, d.user_data.zp, d.user_data.country], [[h('vevo@example.com')], [h('éva')], [h('debrecen')], [h('4025')], [h('hu')]], 'a mostani teljes user_data (hash)');
  assert.ok(d.user_data.fbp && d.user_data.fbc && d.user_data.client_ip_address === '203.0.113.7' && d.user_data.client_user_agent === 'UA TESZT');
  // a tobbi platformra a Purchase nem megy ki: ugyanannyi hivas, mint a ki modban (+1 meta)
  assert.deepEqual(['tiktok', 'google', 'ga4'].map((k) => x.m.hivasok.filter((c) => c.kulcs === k).length), ['tiktok', 'google', 'ga4'].map((k) => alap.m.hivasok.filter((c) => c.kulcs === k).length));
  assert.ok(!x.m.hivasok.filter((c) => c.kulcs !== 'meta').some((c) => JSON.stringify(c.body).includes('st-' + PI)), 'a st- azonosito csak a Meta-ban');
  // nyers vendegadat sehol: se a hivasokban, se a D1-ben
  const kimenet = JSON.stringify(x.m.hivasok).toLowerCase(); for (const nyers of ['szabó', 'éva', 'debrecen', 'vevo@example.com', '06 30 000 0002']) assert.ok(!kimenet.includes(nyers.toLowerCase()), 'kimeno hivas: ' + nyers);
  const dump = JSON.stringify(x.w.db.prepare('SELECT * FROM meres_kuldes').all()).toLowerCase(); for (const nyers of ['szabó', 'vevo@example.com', 'debrecen']) assert.ok(!dump.includes(nyers), 'D1: ' + nyers);
});

test('idempotencia: ugyanaz a PaymentIntent masodszor (webhook-ujraprobalas) nem kuld, nem iras ujat; a Purchase-sor VEGLEGES', async () => {
  const w = d1(); const m = hamis(); const { fk } = ajandekForras(kartyaPi(), 'kartya'); await erkezesMent(w, erkBe(PI), NOW);
  const elso = await elosztas(w, fk, { env: ARNYEK_ENV, fetchImpl: m.f, now: () => NOW });
  const hivasElotte = m.hivasok.length, sorokElotte = sorok({ db: w.db });
  const masodik = await elosztas(w, fk, { env: ARNYEK_ENV, fetchImpl: m.f, now: () => NOW + 5000 });
  assert.equal(elso.allapot, 'kesz'); assert.equal(masodik.allapot, 'mar_kuldve');
  assert.equal(m.hivasok.length, hivasElotte, 'nem megy ki ujra'); assert.deepEqual(sorok({ db: w.db }), sorokElotte);
  // ha a kapcsolo KI modbol arnyekba valt egy mar kuldott PI-n: csak a Purchase megy ki (a tobbi cella vegleges)
  const w2 = d1(); const m2 = hamis(); await erkezesMent(w2, erkBe(PI), NOW);
  await elosztas(w2, fk, { env: TELJES_ENV, fetchImpl: m2.f, now: () => NOW }); const elotte = m2.hivasok.length;
  await elosztas(w2, fk, { env: ARNYEK_ENV, fetchImpl: m2.f, now: () => NOW + 5000 });
  assert.equal(m2.hivasok.length, elotte + 1); assert.equal(m2.hivasok[elotte].body.data[0].event_name, 'Purchase');
});

test('utalas (a szalon igazolta a befizetest): st-<ATU-...> azonosito, a tenyleges befizetes erteke; fizetes nelkuli (nem beerkezett) utalas = nincs Purchase', async () => {
  const x = await fut(atuPi(), 'atutalas', ARNYEK_ENV);
  const pc = x.m.hivasok.find((c) => c.kulcs === 'meta' && c.body.data[0].event_name === 'Purchase').body.data[0];
  assert.deepEqual([pc.event_id, pc.custom_data.value, pc.custom_data.order_id], ['st-' + ATU, 29900, ATU]);
  // meg nem erkezett be: az ajandekForras kihagyja, elosztas sem fut
  assert.ok(ajandekForras({ ...atuPi(), metadata: { ...atuPi().metadata, atutalas_beerkezett: '0' } }, 'atutalas').kihagyva);
  // kartyas mod utalasos rendelesre: kihagyva (a Purchase a tenyleges befizetesnel all elo)
  assert.ok(ajandekForras(atuPi(), 'kartya').kihagyva);
});

test('visszaterites / vita / lemondas: az elo allapot-ellenorzes "torolve" -> a Purchase kihagyva, Meta-hivas nincs (a visszavonas NEM kuldjuk: csak naplo)', async () => {
  const x = await fut(kartyaPi(), 'kartya', ARNYEK_ENV, { eloEllenorzes: async () => 'torolve' });
  assert.equal(x.m.hivasok.length, 0, 'semmi nem megy ki');
  const p = sorok(x.w).filter((s) => s.esemeny_nev === 'Purchase'); assert.equal(p.length, 1); assert.equal(p[0].allapot, 'kihagyva'); assert.match(p[0].indok, /lemondva/);
  const ismeretlen = await fut(kartyaPi(), 'kartya', ARNYEK_ENV, { eloEllenorzes: async () => { throw new Error('stripe nem elerheto'); } });
  assert.equal(ismeretlen.m.hivasok.length, 0); assert.equal(ismeretlen.r.allapot, 'halasztva'); assert.ok(sorok(ismeretlen.w).filter((s) => s.esemeny_nev === 'Purchase').every((s) => s.allapot === 'halasztva'));
});

test('veszkapcsolo (platform:meta / cella:headspa:meta) a Purchase-ra is ervenyes; sikertelen Meta-hivas = hiba (ujraprobalhato), nem veszik el', async () => {
  const w = d1(); const m = hamis(); const { fk } = ajandekForras(kartyaPi(), 'kartya'); await erkezesMent(w, erkBe(PI), NOW);
  await kapcsoloBeallit(w, { uzletag: 'headspa', platform: 'meta', be: false, ok: 'teszt' }, NOW);
  await elosztas(w, fk, { env: ARNYEK_ENV, fetchImpl: m.f, now: () => NOW });
  assert.equal(m.hivasok.filter((c) => c.kulcs === 'meta').length, 0);
  const p = sorok({ db: w.db }).find((s) => s.esemeny_nev === 'Purchase'); assert.equal(p.allapot, 'kihagyva'); assert.match(p.indok, /^veszkapcsolo/);
  // hibas valasz
  const w2 = d1(); await erkezesMent(w2, erkBe(PI), NOW);
  const rossz = async (url, o) => ({ status: 500, text: async () => '{"error":"x"}' });
  await elosztas(w2, fk, { env: ARNYEK_ENV, fetchImpl: rossz, now: () => NOW });
  const ph = sorok({ db: w2.db }).find((s) => s.esemeny_nev === 'Purchase'); assert.notEqual(ph.allapot, 'elkuldve');
});

test('vedelmek: a Purchase-keres sem allithato elo pixelre, sem tesztkod nelkul; az "eles" mod nincs implementalva (nincs eles token / cel a kodban)', async () => {
  const fkKartya = ajandekForras(kartyaPi(), 'kartya').fk;
  const p = esemenyek(fkKartya, undefined, { metaPurchase: true }).find((e) => e.tipus === 'purchase');
  const erk = erkezesTisztit(BE(), NOW).adat; const hozz = hozzajarulasTisztit({ ana: true, adv: true, fun: true });
  const ctx = { fk: { ...fkKartya, ido: IDO }, erk, ua: 'UA', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/x', hozz: { meta: platformSzabaly('meta', hozz, ARNYEK_ENV) }, hash: await felhasznaloHash(ARNYEK_ENV, fkKartya.vendeg) };
  for (const elo of ['3473839859576758', '1361403694872594', '643342342027957', '1019878750660854', '729596671946533', '99999']) assert.match(metaKerelem(p, ctx, { ...ARNYEK_ENV, META_ARNYEK_DATASET: elo }).tiltva, /ARNYEK/, 'cel: ' + elo);
  assert.match(metaKerelem(p, ctx, { ...ARNYEK_ENV, META_TESZT_KOD: undefined }).tiltva, /META_TESZT_KOD/);
  const ok = metaKerelem(p, ctx, ARNYEK_ENV); assert.ok(ok.url.includes(ARNYEK.meta.datasetId) && ok.cel.test_event_code === 'TEST12345');
  // forraskod: nincs eles pixel-cel a Purchase-agban
  const fs = await import('node:fs'); const forras = fs.readFileSync(new URL('../netlify/lib/meres/esemeny-modell.js', import.meta.url), 'utf8');
  assert.ok(!/3473839859576758/.test(forras), 'az esemeny-modell nem tartalmaz eles pixel-azonositot');
});
