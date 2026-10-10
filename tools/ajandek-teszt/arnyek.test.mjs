// QA-2 ARNYEK-meres az ajandekkartyan: a #89-es elo ut (Stripe payment_intent.succeeded -> meresKuld) mellett, UGYANABBOL a webhookbol, a pi_ azonositoval;
// utalasos kartyanal a tenyleges befizetesnel (kiallit) az ATU- azonositoval. Mock Stripe + hamis platform-halozat (valodi kulso hivas nincs).
//   node --test tools/ajandek-teszt/arnyek.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mockStripeInditas } from './mock-stripe.mjs';
import { ajandekKezel, kiallitToken, kuponKod } from '../../netlify/lib/ajandek.js';
import { erkezesMent, naploLeker } from '../../netlify/lib/meres/elosztas.js';

const BAZIS = 'https://teszt.mosaicheadspa.hu';
const WHSEC = 'whsec_teszt_titok';
const TITOK = 'teszt-titok-teszt-titok-teszt-titok-0123456789';
const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789';
const NOW = Date.now();
const IDO = Math.floor(NOW / 1000) - 60;
const ATTR = () => ({ google: { gclid: { ertek: GCLID, ts: IDO - 100 } }, meta: { fbc: `fb.1.${(IDO - 90) * 1000}.IwAR_fbclid_TESZT_01`, ts: IDO - 90 }, tiktok: { ttclid: { ertek: 'E.C.P.ttclid_TESZT_01', ts: IDO - 80 } },
  utm_utolso: { source: 'google', medium: 'cpc', campaign: 'oszi', ts: IDO - 90 }, fbp: `fb.1.${(IDO - 9000) * 1000}.1234567890`, ttp: 'ttp_TESZT_0123456789abcdef', ga4: { client_id: '1234567890.1759759200', session_id: '1759759200' } });

function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
let mock, ENV, DB; const platformHivasok = []; const levelek = [];
const igazFetch = globalThis.fetch;
const PLATFORM_HOSTOK = ['graph.facebook.com', 'business-api.tiktok.com', 'hooks.zapier.com', 'google-analytics.com'];
before(async () => {
  mock = await mockStripeInditas();
  // a platform-hivasokat elfogjuk (NEM mennek ki a halozatra); a Stripe-mock hivasai valodiak (helyi)
  globalThis.fetch = async (url, o) => {
    const u = String(url); const p = PLATFORM_HOSTOK.findIndex((h) => u.includes(h));
    if (p < 0) return igazFetch(url, o);
    if (u.includes('/debug/mp/collect')) return { status: 200, text: async () => JSON.stringify({ validationMessages: [] }) };
    const kulcs = ['meta', 'tiktok', 'google', 'ga4'][p]; platformHivasok.push({ kulcs, url: u, body: JSON.parse(o.body) });
    return { status: 200, text: async () => JSON.stringify({ meta: { events_received: 1, fbtrace_id: 'x' }, tiktok: { code: 0, message: 'OK' }, google: { results: [{}] }, ga4: {} }[kulcs]) };
  };
});
after(async () => { globalThis.fetch = igazFetch; await mock.bezar(); });
const ujKornyezet = (extra = {}) => { DB = d1(); platformHivasok.length = 0; levelek.length = 0; return { STRIPE_SECRET_KEY: 'sk_test_mock_123', STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_123', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK,
  KULCS_DB: DB, MERES_ELOSZTO: '1', META_TESZT_KOD: 'TEST12345', TIKTOK_TESZT_KOD: 'TEST67890', GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001', META_CAPI_TOKEN: 't', TIKTOK_EVENTS_TOKEN: 't', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/teszt/', GA4_TESZT_API_SECRET: 't', ...extra }; };
const ip = () => `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(256)}`;
async function hiv(method, ut, { body, headers = {}, env, most } = {}) {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const v = await ajandekKezel({ method, url: BAZIS + '/api/ajandek/' + ut, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...headers }, text, env, most, kuld: async (l) => { levelek.push(l); } });
  return { ...v, adat: /json/.test(v.headers['content-type'] || '') ? JSON.parse(v.body) : null };
}
const torzs = (extra = {}) => ({ termek: 'egyeni', email: 'teszt.claude@example.com', ajandekozott: 'Kiss Anna', nev: 'TESZT – Claude', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.', ceges: null,
  attr: { variant_id: 'general', gift_context: 'general', oldal: '/ajandek' }, mer: { ana: true, adv: true }, kulcs: 'k-' + crypto.randomUUID(), telefon: '+36 70 942 0090', ...extra });
const alairt = (piId) => { const pi = mock.allapot.pi(piId); const t = JSON.stringify({ id: 'evt_' + crypto.randomUUID().replace(/-/g, ''), object: 'event', type: 'payment_intent.succeeded', data: { object: { id: piId, object: 'payment_intent', status: 'succeeded', metadata: pi.metadata } } }); const ts = Math.floor(Date.now() / 1000); return { t, f: `t=${ts},v1=${crypto.createHmac('sha256', WHSEC).update(`${ts}.${t}`).digest('hex')}` }; };
const webhook = (piId, env) => { const e = alairt(piId); return hiv('POST', 'webhook', { body: e.t, headers: { 'stripe-signature': e.f }, env }); };
const erk = (id, o = {}) => erkezesMent(DB, { source_id: id, uzletag: 'headspa', tipus: 'ajandekkartya', attr: ATTR(), hozz: { ana: true, adv: true, fun: true }, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://x.pages.dev/ajandek', szolgaltatas: 'egyeni', ...o }, NOW);

test('AJANDEKKARTYA (Stripe-kartya): a webhookbol, pi_ azonositoval: Ajandekkartya + Schedule ernyo, ertek = tenyleges ar HUF, hash-elt azonositok; ismetlesre nem kuld ujra; az elo (#89) ut metadataja valtozatlan', async () => {
  const env = ujKornyezet();
  const r = await hiv('POST', 'fizetes', { body: torzs(), env }); assert.equal(r.status, 200, r.body);
  const pi = r.adat.pi; await erk(pi); // a bongeszo a fizetes ELOTT kuldi az erkezesi adatot
  mock.allapot.sikeresIt(pi);
  const mdElotte = JSON.stringify(mock.allapot.pi(pi).metadata);
  assert.equal((await webhook(pi, env)).status, 200);
  const meta = platformHivasok.filter((h) => h.kulcs === 'meta').map((h) => h.body.data[0]);
  assert.deepEqual(meta.map((d) => [d.event_name, d.event_id]), [['HeadSpa_Ajandekkartya', `Ajandekkartya:${pi}`], ['Schedule', `Schedule:${pi}`]]);
  const ar = mock.allapot.pi(pi).amount / 100;
  assert.ok(ar > 0 && meta.every((d) => d.custom_data.value === ar && d.custom_data.currency === 'HUF' && d.custom_data.order_id === pi && d.user_data.em && d.user_data.fbc && d.user_data.fbp));
  assert.ok(meta.every((d) => !d.user_data.ph), 'a kartyas vasarlasnal telefonszamot a Stripe-fizetes nem gyujt: csak e-mail-hash megy (a valos adat)');
  assert.deepEqual(platformHivasok.filter((h) => h.kulcs === 'tiktok').map((h) => h.body.data[0].event), ['HeadSpa_Ajandekkartya', 'CompletePayment']);
  assert.deepEqual([platformHivasok.filter((h) => h.kulcs === 'google')[0].body.conversion_action_id, platformHivasok.filter((h) => h.kulcs === 'google')[0].body.order_id], ['7825199992', `Ajandekkartya:${pi}`]);
  assert.equal(platformHivasok.filter((h) => h.kulcs === 'ga4')[0].body.events[0].params.transaction_id, pi);
  const naplo = await naploLeker(DB, pi); assert.equal(naplo.kuldesek.filter((k) => k.allapot === 'elkuldve').length, 6); assert.ok(naplo.kuldesek.every((k) => k.source_id === pi));
  assert.equal(JSON.stringify(mock.allapot.pi(pi).metadata).includes('esemeny'), JSON.stringify(mdElotte).includes('esemeny'), 'az elosztas nem ir a PI metadataba');
  const n = platformHivasok.length; assert.equal((await webhook(pi, env)).status, 200); assert.equal(platformHivasok.length, n, 'a Stripe ujrakuldese nem duplaz');
});
test('AJANDEKKARTYA: kuldes ELOTTI elo ellenorzes - visszaterített fizetesre nem megy esemeny; elosztas nelkuli kornyezetben (MERES_ELOSZTO hianyzik / nincs KULCS_DB) semmi nem tortenik, a webhook 200', async () => {
  let env = ujKornyezet();
  let pi = (await hiv('POST', 'fizetes', { body: torzs(), env })).adat.pi; await erk(pi); mock.allapot.sikeresIt(pi); mock.allapot.visszaterites(pi);
  assert.equal((await webhook(pi, env)).status, 200); assert.equal(platformHivasok.length, 0);
  assert.ok((await naploLeker(DB, pi)).kuldesek.every((k) => k.allapot === 'kihagyva'));
  for (const kikapcsolt of [{ MERES_ELOSZTO: '' }, { KULCS_DB: undefined }]) {
    env = { ...ujKornyezet(), ...kikapcsolt }; pi = (await hiv('POST', 'fizetes', { body: torzs(), env })).adat.pi; mock.allapot.sikeresIt(pi);
    assert.equal((await webhook(pi, env)).status, 200); assert.equal(platformHivasok.length, 0);
  }
});
test('AJANDEKKARTYA (utalas): az igenyleskor NINCS konverzio; a tenyleges befizetesnel (szalon: kiallit) igen, az ATU- azonositoval; ismetlesre nem duplaz', async () => {
  const env = ujKornyezet();
  const r = await hiv('POST', 'atutalas', { body: torzs(), env }); assert.equal(r.status, 200, r.body);
  const ref = r.adat.utalas.kozlemeny; assert.match(ref, /^ATU-[A-Z0-9]{6}$/);
  await erk(ref);
  assert.equal(platformHivasok.length, 0, 'az igenyles nem konverzio');
  const pi = [...mock.allapot.pik.values()].find((x) => x.metadata && x.metadata.atu_ref === ref).id;
  const t = await kiallitToken(env, pi); const kod = await kuponKod(env, pi);
  const ki = () => hiv('POST', 'kiallit', { body: new URLSearchParams({ pi, t, kod }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, env });
  assert.equal((await ki()).status, 200);
  const meta = platformHivasok.filter((h) => h.kulcs === 'meta').map((h) => h.body.data[0]);
  assert.deepEqual(meta.map((d) => d.event_id), [`Ajandekkartya:${ref}`, `Schedule:${ref}`]);
  assert.ok(meta.every((d) => d.custom_data.order_id === ref && d.custom_data.value > 0 && d.user_data.em && d.user_data.ph), 'az utalasos igenynel van telefonszam is');
  const n = platformHivasok.length; await ki(); assert.equal(platformHivasok.length, n, 'a masodik kiallitas nem kuld ujra');
  assert.equal((await naploLeker(DB, ref)).kuldesek.filter((k) => k.allapot === 'elkuldve').length, 6);
});
