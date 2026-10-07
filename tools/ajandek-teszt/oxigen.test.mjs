// Az OXIGENTERAPIA ajandekkartya kereskedo tesztjei (Node beepitett tesztfuttato):
//   node --test "tools/ajandek-teszt/oxigen.test.mjs"
// A motort az oxigenes adattal peldanyositjuk (ajandekMotor + ajandek-adat-oxigen.js), a Stripe helyett a helyi mock (mock-stripe.mjs),
// a Szamlazz.hu helyett egy helyi HTTP-szerver (SZAMLAZZ_AGENT_URL, csak loopback fogadhato el). Valodi halozati forgalom / level nincs.
// A lezeres kereskedo tesztjeinek (lezer.test.mjs) parja: ugyanaz a motor, mas termekek, sajat kulcsok.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import { mockStripeInditas } from './mock-stripe.mjs';
import { ajandekMotor } from '../../netlify/lib/ajandek.js';
import { oxigenKornyezet } from '../../netlify/lib/ajandek-oxigen-env.js';
import { lezerKornyezet } from '../../netlify/lib/ajandek-lezer-env.js';
import '../../assets/js/ajandek-adat-lezer.js';
import '../../assets/js/ajandek-adat-oxigen.js';

const HEADSPA = globalThis.AJANDEK_ADAT;
const LEZER = globalThis.AJANDEK_ADAT_LEZER;
const OXIGEN = globalThis.AJANDEK_ADAT_OXIGEN;
const motor = ajandekMotor(OXIGEN, { elotag: '/api/ajandek-oxigen/' });
const BAZIS = 'https://teszt.mosaicheadspa.hu';
const WHSEC = 'whsec_oxigen_teszt';
const TITOK = 'teszt-titok-teszt-titok-teszt-titok-0123456789';
const KOD_RE = /^AK[0-9A-HJKMNP-TV-Z]{8}$/;

let mock, szamlazz, ENV;
let levelek = [];
let szamlazzKeresek = [];
let szamlazzValasz = null; // (xml) => { status, torzs }

before(async () => {
  mock = await mockStripeInditas();
  szamlazz = http.createServer((req, res) => {
    const reszek = [];
    req.on('data', (c) => reszek.push(c));
    req.on('end', () => {
      const torzs = Buffer.concat(reszek).toString('utf8');
      const m = /<\?xml[\s\S]*<\/xmlszamla>/.exec(torzs);
      const xml = m ? m[0] : '';
      szamlazzKeresek.push(xml);
      const v = szamlazzValasz ? szamlazzValasz(xml) : { status: 200, torzs: '<xmlszamlavalasz xmlns="http://www.szamlazz.hu/xmlszamlavalasz"><sikeres>true</sikeres><szamlaszam>E-OX-2026-1</szamlaszam></xmlszamlavalasz>' };
      res.writeHead(v.status, { 'content-type': 'text/xml' });
      res.end(v.torzs);
    });
  });
  await new Promise((ok) => szamlazz.listen(0, '127.0.0.1', ok));
  ENV = oxigenKornyezet({
    OXIGEN_STRIPE_SECRET_KEY: 'sk_test_mock_oxigen', OXIGEN_STRIPE_PUBLISHABLE_KEY: 'pk_test_oxigen_mock', OXIGEN_STRIPE_WEBHOOK_SECRET: WHSEC,
    OXIGEN_SZAMLAZZ_AGENT_KULCS: 'titkos-oxigen-agent-kulcs-teszt', STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK, AJANDEK_AZONNALI: '1',
    SZAMLAZZ_AGENT_URL: `http://127.0.0.1:${szamlazz.address().port}/szamla/`,
    // a HeadSpa es a lezeres kulcsai is ott vannak a kornyezetben: az oxigenes motor SOHA nem hasznalhatja ezeket
    STRIPE_SECRET_KEY: 'sk_live_HEADSPA_NE_HASZNALD', STRIPE_PUBLISHABLE_KEY: 'pk_live_HEADSPA', STRIPE_WEBHOOK_SECRET: 'whsec_HEADSPA', SZAMLAZZ_AGENT_KULCS: 'HEADSPA-KULCS',
    LEZER_STRIPE_SECRET_KEY: 'rk_live_LEZER_NE_HASZNALD', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_live_LEZER', LEZER_STRIPE_WEBHOOK_SECRET: 'whsec_LEZER', LEZER_SZAMLAZZ_AGENT_KULCS: 'LEZER-KULCS',
  });
});
after(async () => { await mock.bezar(); await new Promise((ok) => szamlazz.close(ok)); });

const veletlenIp = () => `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(256)}`;
async function hiv(method, ut, { body, query, headers = {}, env = ENV, most } = {}) {
  const url = new URL(BAZIS + '/api/ajandek-oxigen/' + ut);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const v = await motor.ajandekKezel({
    method, url: url.toString(), headers: { 'content-type': 'application/json', 'x-forwarded-for': veletlenIp(), ...headers }, text, env, most,
    kuld: async (l) => { levelek.push(l); },
  });
  const adat = /json/.test(v.headers['content-type'] || '') ? JSON.parse(v.body) : null;
  return { ...v, adat };
}
const torzs = (extra = {}) => ({
  termek: 'elso', email: 'vevo@example.com', ajandekozott: 'Kiss Anna', nev: 'Teszt Elek', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.',
  ceges: null, attr: { variant_id: 'general', oldal: '/oxigen-ajandekkartya' }, mer: { ana: false, adv: false }, kulcs: 'k-' + crypto.randomUUID(), ...extra,
});
function alairt(piId, { titok = WHSEC, tipus = 'payment_intent.succeeded' } = {}) {
  const pi = mock.allapot.pi(piId);
  const t = JSON.stringify({ id: 'evt_' + crypto.randomUUID().replace(/-/g, ''), object: 'event', type: tipus, data: { object: { id: piId, object: 'payment_intent', status: 'succeeded', metadata: pi.metadata } } });
  const ts = Math.floor(Date.now() / 1000);
  return { torzs: t, fejlec: `t=${ts},v1=${crypto.createHmac('sha256', titok).update(`${ts}.${t}`).digest('hex')}` };
}
const webhook = (e, opc = {}) => hiv('POST', 'webhook', { body: e.torzs, headers: { 'stripe-signature': e.fejlec }, ...opc });
async function fizetett(extra) {
  const r = await hiv('POST', 'fizetes', { body: torzs(extra) });
  assert.equal(r.status, 200, r.body);
  mock.allapot.sikeresIt(r.adat.pi, { mod: 'card' });
  return r.adat;
}

describe('oxigenes kereskedo: kornyezet es adat', () => {
  test('az OXIGEN_* beallitasok a motor neveire kepezve; a HeadSpa es a lezeres kulcsai SOHA nem folynak at, hianyzo oxigenes kulcs ures marad', () => {
    const e = oxigenKornyezet({ STRIPE_SECRET_KEY: 'sk_live_headspa', STRIPE_PUBLISHABLE_KEY: 'pk_live_headspa', STRIPE_WEBHOOK_SECRET: 'whsec_headspa', SZAMLAZZ_AGENT_KULCS: 'headspa',
      LEZER_STRIPE_SECRET_KEY: 'rk_live_lezer', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_live_lezer', LEZER_STRIPE_WEBHOOK_SECRET: 'whsec_lezer', LEZER_SZAMLAZZ_AGENT_KULCS: 'lezer',
      MERES_HOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/abc', AJANDEK_TITOK: TITOK });
    assert.equal(e.STRIPE_SECRET_KEY, '');
    assert.equal(e.STRIPE_PUBLISHABLE_KEY, '');
    assert.equal(e.STRIPE_WEBHOOK_SECRET, '');
    assert.equal(e.SZAMLAZZ_AGENT_KULCS, '');
    assert.equal(e.MERES_HOOK_URL, '');          // nincs szerveroldali Zapier-meres az oxigenes kartyanal
    assert.equal(e.AJANDEK_STRIPE_SZAMLA, '0');  // nincs Stripe-szamla
    assert.equal(e.AJANDEK_TITOK, TITOK);
    const f = oxigenKornyezet({ OXIGEN_STRIPE_SECRET_KEY: 'rk_live_o', OXIGEN_STRIPE_PUBLISHABLE_KEY: 'pk_live_o', OXIGEN_STRIPE_WEBHOOK_SECRET: 'whsec_o', OXIGEN_SZAMLAZZ_AGENT_KULCS: 'ok', OXIGEN_AJANDEK_TITOK: 'masik' });
    assert.deepEqual([f.STRIPE_SECRET_KEY, f.STRIPE_PUBLISHABLE_KEY, f.STRIPE_WEBHOOK_SECRET, f.SZAMLAZZ_AGENT_KULCS, f.AJANDEK_TITOK], ['rk_live_o', 'pk_live_o', 'whsec_o', 'ok', 'masik']);
    // a lezeres kornyezet sem kap oxigenes kulcsot (a ket kereskedo kulcsai nem keverednek)
    const l = lezerKornyezet({ OXIGEN_STRIPE_SECRET_KEY: 'rk_live_o', OXIGEN_SZAMLAZZ_AGENT_KULCS: 'ok' });
    assert.equal(l.STRIPE_SECRET_KEY, '');
    assert.equal(l.SZAMLAZZ_AGENT_KULCS, '');
  });
  test('a termekek: a 4 jovahagyott kartya, a szamla-tetel osszege = az ar, AAM; sajat azonositok (a HeadSpa/lezeres termekekkel nem keverednek)', () => {
    const idk = Object.keys(OXIGEN.TERMEKEK);
    assert.deepEqual(idk, ['kamera', 'elso', 'ot', 'tiz']);
    const arak = { kamera: 4990, elso: 29900, ot: 130000, tiz: 260000 };
    for (const id of idk) {
      const t = OXIGEN.TERMEKEK[id];
      const sor = OXIGEN.szamlaTetelek(id);
      assert.equal(t.ar_ft, arak[id], id);
      assert.equal(sor.reduce((o, x) => o + x.ft, 0), t.ar_ft, id);
      assert.ok(sor.every((x) => x.afa === 'AAM'), id);
      assert.ok(!(id in LEZER.TERMEKEK), id);
      assert.match(t.kartya_cim, /Oxigénterápia ajándékkártya/);
      assert.equal(t.kartya_felirat[0], 'OXIGÉNTERÁPIA');
      // a nev nem ismetli az arat (az ar-soron latszik), a szamla-tetel viszont igen; az "5 alkalmas bérlet" / "10 alkalmas bérlet" nev a darabszamot mondja, nem az arat
      assert.doesNotMatch(t.nev.replace(/^(5|10) alkalmas bérlet$/, 'X'), /\d/, id);
      assert.match(sor[0].nev, new RegExp(`^MOSAIC oxigénterápia ajándékkártya – ${t.nev} – ${OXIGEN.arSzoveg(t.ar_ft).replace('.', '\\.')} értékben$`), id);
    }
    // a HeadSpa "egyeni" stb. nincs az oxigenes adatban
    for (const id of ['egyeni', 'paros', '4kezes', 'honalj', 'basic']) assert.ok(!(id in OXIGEN.TERMEKEK), id);
    assert.equal(OXIGEN.szamlaTetelek('egyeni'), null);
    assert.equal(OXIGEN.szamlaTetelek('__proto__'), null);
    assert.equal(OXIGEN.rendelesAzonosito('pi_3UNinYFv8vc2ArnL1mioRQd1'), 'OX-1MIORQD1');
    assert.equal(LEZER.rendelesAzonosito('pi_3UNinYFv8vc2ArnL1mioRQd1'), 'LZ-1MIORQD1');
    assert.equal(HEADSPA.rendelesAzonosito('pi_3UNinYFv8vc2ArnL1mioRQd1'), 'MH-1MIORQD1');
  });
  test('az arak, az alkalmak es a szolgaltatas-azonositok egyeznek a Salonic (mosaic-oxigen) szolgaltatasaival (docs pillanatkep, 2026-10-07)', () => {
    const j = JSON.parse(fs.readFileSync(new URL('../../docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json', import.meta.url), 'utf8'));
    const oxigen = new Map(j.services.filter((x) => x.business === 'oxygen').map((x) => [Number(x.salonic_service_id), x]));
    const alkalmak = { kamera: 1, elso: 1, ot: 5, tiz: 10 };
    for (const [id, t] of Object.entries(OXIGEN.TERMEKEK)) {
      const sz = t.salonic_szolgaltatas;
      const x = oxigen.get(sz.id);
      assert.ok(x, `${id}: nincs ilyen Salonic-szolgaltatas (${sz.id})`);
      assert.equal(String(x.salonic_spec_id), String(sz.spec), id);
      assert.equal(t.alkalom, alkalmak[id], id);
      assert.equal(x.active_price * t.alkalom, t.ar_ft, `${id}: az ar nem egyezik a Salonic listaarabol szamoltal (${x.active_price} x ${t.alkalom})`);
      assert.equal(String(x.service_name_raw).replace(/^[^\p{L}]+/u, ''), sz.nev, id);
      // a tobb alkalmas kartyanal a szalon-level megmondja, hanyszor felhasznalhato a kupon
      assert.ok(sz.felhasznalas, id);
      if (t.alkalom > 1) assert.match(sz.felhasznalas, new RegExp(`${t.alkalom}-(ször|szer)`), id); else assert.match(sz.felhasznalas, /egyszer/, id);
    }
  });
  test('a kliens-oldali oxigenes adat sehol nem hivatkozik a HeadSpa-termekekre / video-adatra', () => {
    assert.deepEqual(OXIGEN.FINDER, []);
    assert.equal(OXIGEN.HEADSPA_VIDEO, null);
    assert.deepEqual(OXIGEN.ELEMEK, []);
    assert.equal(OXIGEN.ATVETELEK.length, 1);
    assert.equal(OXIGEN.oldalAlapertek('/oxigen-ajandekkartya/').termek, 'elso');
    assert.ok(OXIGEN.TERMEKEK[OXIGEN.oldalAlapertek('/oxigen-ajandekkartya').termek]);
    for (const t of Object.values(OXIGEN.TERMEKEK)) assert.equal(t.kezeles.video, undefined, 'nincs jovahagyott oxigenes video');
    // minden kep, amire az adat hivatkozik, megvan
    const kepek = [...Object.values(OXIGEN.TERMEKEK).map((t) => t.vizual.src), ...OXIGEN.GALERIA.map((k) => k.src), OXIGEN.VARIANTOK.general.hero_media.src, OXIGEN.SZALON.kartya_hatter];
    for (const k of kepek) assert.ok(fs.existsSync(new URL('../..' + k, import.meta.url)), k);
  });
  test('beallitas: az oxigenes publikus kulcs, a HeadSpa-e / a lezeres-e soha', async () => {
    const r = await hiv('GET', 'beallitas');
    assert.equal(r.status, 200);
    assert.equal(r.adat.publikus_kulcs, 'pk_test_oxigen_mock');
    assert.doesNotMatch(r.body, /HEADSPA|LEZER/);
    const nincs = await hiv('GET', 'beallitas', { env: oxigenKornyezet({ STRIPE_SECRET_KEY: 'sk_live_headspa', STRIPE_PUBLISHABLE_KEY: 'pk_live_headspa', LEZER_STRIPE_SECRET_KEY: 'rk_live_lezer', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_live_lezer', AJANDEK_TITOK: TITOK }) });
    assert.equal(nincs.adat.mod, 'nincs');
    assert.equal(nincs.adat.publikus_kulcs, null);
  });
});

describe('oxigenes kereskedo: rendeles (/fizetes)', () => {
  test('PaymentIntent a termek fix osszegevel (alkalom x egysegar), oxigenes leirassal, OX- azonositoval; kartya + Revolut Pay; szamla-mod: agent', async () => {
    for (const [termek, osszeg] of [['kamera', 499000], ['elso', 2990000], ['ot', 13000000], ['tiz', 26000000]]) {
      const r = await hiv('POST', 'fizetes', { body: torzs({ termek }) });
      assert.equal(r.status, 200, r.body);
      const pi = mock.allapot.pi(r.adat.pi);
      assert.equal(pi.amount, osszeg, termek);
      assert.equal(pi.currency, 'huf');
      assert.match(pi.description, /^MOSAIC oxigénterápia ajándékkártya - /);
      assert.equal(pi.metadata.termek, termek);
      assert.equal(pi.metadata.szamla_mod, 'agent');
      assert.equal(pi.metadata.szamla_id, undefined);
      assert.deepEqual([...(pi.payment_method_types || [])].sort(), ['card', 'revolut_pay']);
      assert.match(r.adat.rendeles_id, /^OX-[0-9A-Z]{8}$/);
    }
  });
  test('HeadSpa- es lezeres termek, ismeretlen termek: elutasitva (az oxigenes motor csak a sajat termekeit arulja)', async () => {
    for (const termek of ['egyeni', 'paros', '4kezes', 'arany', 'honalj', 'basic', 'summer', '__proto__']) {
      const r = await hiv('POST', 'fizetes', { body: torzs({ termek }) });
      assert.equal(r.status, 400, termek);
      assert.ok(r.adat.mezok.termek, termek);
    }
  });
  test('ceges szamla (ujKATA: nem lehet): elutasitva; a banki atutalas es a szemelyes (papir) atvetel sincs', async () => {
    let r = await hiv('POST', 'fizetes', { body: torzs({ ceges: { nev: 'Teszt Kft.', adoszam: '12345678-2-41' } }) });
    assert.equal(r.status, 400);
    assert.match(JSON.stringify(r.adat.mezok), /céges számlát nem/);
    r = await hiv('POST', 'fizetes', { body: torzs({ atvetel: 'szemelyesen' }) });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.atvetel);
    r = await hiv('POST', 'atutalas', { body: torzs() });
    assert.equal(r.status, 404);
  });
  test('oxigenes Stripe-kulcs nelkul 503 (nem a HeadSpa / a lezeres fiokjaval dolgozik)', async () => {
    const env = oxigenKornyezet({ STRIPE_SECRET_KEY: 'sk_live_headspa', STRIPE_PUBLISHABLE_KEY: 'pk_live_headspa', LEZER_STRIPE_SECRET_KEY: 'rk_live_lezer', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_live_lezer', AJANDEK_TITOK: TITOK, STRIPE_API_BASE: mock.url });
    const elotte = mock.allapot.pik.size;
    const r = await hiv('POST', 'fizetes', { body: torzs(), env });
    assert.ok(r.status >= 500 || r.status === 503, String(r.status));
    assert.equal(mock.allapot.pik.size, elotte);
  });
});

describe('oxigenes kereskedo: fizetes utan (webhook): szamla a Szamlazz.hu-n, levelek, kod', () => {
  test('sikeres fizetes (5 kezeles): a szamla a vasarlaskor (egyszer), AAM-tetellel; a vevo kodot es kartyat kap kotojel nelkul; a szalon "kupon" teendot (5 felhasznalas)', async () => {
    szamlazzKeresek = []; levelek = []; szamlazzValasz = null;
    const a = await fizetett({ termek: 'ot', szemelyre: null });
    assert.equal((await webhook(alairt(a.pi))).status, 200);
    assert.equal(szamlazzKeresek.length, 1);
    const xml = szamlazzKeresek[0];
    assert.match(xml, /<szamlaagentkulcs>titkos-oxigen-agent-kulcs-teszt<\/szamlaagentkulcs>/);
    assert.doesNotMatch(xml, /HEADSPA|LEZER/);
    assert.match(xml, new RegExp(`<rendelesSzam>${a.rendeles_id}</rendelesSzam>`));
    assert.match(xml, /<megnevezes>MOSAIC oxigénterápia ajándékkártya – 5 alkalmas bérlet – 130\.000 Ft értékben<\/megnevezes>/);
    assert.match(xml, /<afakulcs>AAM<\/afakulcs>/);
    assert.match(xml, /<bruttoErtek>130000<\/bruttoErtek>/);
    assert.match(xml, /<email>vevo@example.com<\/email>/);
    assert.doesNotMatch(xml, /<elonezetpdf>true/);
    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.szamla_szam, 'E-OX-2026-1');
    assert.equal(pi.metadata.szamla_hiba, undefined);
    assert.equal(pi.metadata.kartya_kesz, '1');
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.ok(vevo && szalon);
    assert.match(vevo.targy, /OX-[0-9A-Z]{8}/);
    assert.doesNotMatch(vevo.html + vevo.targy, /Head Spa|HEADSPA|Headspa|lézeres|Lézeres/, 'a vevo-levelben nincs HeadSpa- / lezeres marka');
    assert.match(vevo.html, /oxigenterapia-budapest/);
    assert.match(szalon.html, /automatikusan kiállítottuk/);
    assert.match(szalon.html, /E-OX-2026-1/);
    assert.match(szalon.html, /100%-os kupont/);
    assert.match(szalon.html, /TEENDŐ: 100%-OS KUPON A SALONICBAN \(OXIGÉN\)/);
    assert.match(szalon.html, /Haj Oxigénterápia - 2\. alkalomtól – 5-ször felhasználható kupon/);   // a pontos Salonic-szolgaltatas neve + a felhasznalasok szama
    assert.match(szalon.html, /130\.000 Ft/);
    assert.doesNotMatch(szalon.html, /maradék/);
    const kod = (/AK[0-9A-HJKMNP-TV-Z]{8}/.exec(szalon.html) || [])[0];
    assert.match(kod, KOD_RE);
    assert.ok(vevo.html.includes(kod));
    assert.doesNotMatch(szalon.html + vevo.html, /AK-[0-9A-Z]{4}-/);
  });
  test('termekajandek: az 5 kezelesesnel sampon, a 10 kezelesesnel sampon + balzsam (az oxigen oldal berlet-ajandeka); a szalon-level szerint a beváltáskor kell atadni; az 1 kezelesesnel nincs', async () => {
    const t = OXIGEN.TERMEKEK;
    assert.match(t.ot.tartalom.join(' | '), /Ajándék: 1 literes Oxygeni sampon \(19\.800 Ft értékben\)/);
    assert.match(t.tiz.tartalom.join(' | '), /Ajándék: 1 literes Oxygeni sampon \(19\.800 Ft értékben\) \+ 1 literes Oxygeni balzsam \(28\.000 Ft értékben\)/);
    for (const id of ['kamera', 'elso']) { assert.ok(!t[id].tartalom.some((x) => /Ajándék/.test(x)), id); assert.equal(t[id].szalon_megjegyzes, '', id); assert.ok(!t[id].kezeles.leiras.some((x) => x == null), id); }
    levelek = [];
    for (const [termek, szoveg, nincs] of [['ot', /termékajándék jár: 1 literes Oxygeni sampon \(19\.800 Ft értékben\)\. Ezt nem most, hanem a kártya átvételekor/, /balzsam/], ['tiz', /sampon \(19\.800 Ft értékben\) \+ 1 literes Oxygeni balzsam \(28\.000 Ft értékben\)\. Ezt nem most/, null], ['elso', null, /termékajándék|Ne felejtsd/]]) {
      levelek = [];
      const a = await fizetett({ termek });
      assert.equal((await webhook(alairt(a.pi))).status, 200);
      const szalon = levelek.find((l) => l.cimzett === 'szalon').html;
      if (szoveg) assert.match(szalon, szoveg, termek);
      if (nincs) assert.doesNotMatch(szalon, nincs, termek);
      assert.doesNotMatch(levelek.find((l) => l.cimzett === 'vevo@example.com').html, /Ne felejtsd/, 'a vevo-level nem kap szalon-megjegyzest');
    }
  });
  test('az 1 kezelesre szolo kartyanal a szalon-level "egyszer felhasznalhato" kupont kér a megfelelo szolgaltatasra', async () => {
    szamlazzKeresek = []; levelek = []; szamlazzValasz = null;
    for (const [termek, szoveg] of [['kamera', /AKCIÓS Hajkamerás vizsgálat és konzultáció – egyszer felhasználható kupon/], ['elso', /Haj Oxigénterápia - 1\. alkalom – egyszer felhasználható kupon/], ['tiz', /Haj Oxigénterápia - 2\. alkalomtól – 10-szer felhasználható kupon/]]) {
      levelek = [];
      const a = await fizetett({ termek });
      assert.equal((await webhook(alairt(a.pi))).status, 200);
      assert.match(levelek.find((l) => l.cimzett === 'szalon').html, szoveg, termek);
    }
  });
  test('a nyomtathato kartya az oxigenes hatterrel jelenik meg; a HeadSpa kartya hattere valtozatlan', async () => {
    szamlazzKeresek = []; levelek = []; szamlazzValasz = null;
    const a = await fizetett({ termek: 'tiz' });
    assert.equal((await webhook(alairt(a.pi))).status, 200);
    const kartya = await hiv('GET', 'kartya', { query: { pi: a.pi, t: await motor.kartyaToken(ENV, a.pi) } });
    assert.equal(kartya.status, 200, kartya.body.slice(0, 200));
    assert.match(kartya.body, /\/assets\/img\/ajandek\/kartya-hatter-oxigen\.jpg/);
    assert.doesNotMatch(kartya.body, /kartya-hatter\.jpg|kartya-hatter-lezer/);
    assert.match(kartya.body, /OXIGÉNTERÁPIA<br>10 ALKALMAS BÉRLET/);
    assert.ok(fs.existsSync(new URL('../../assets/img/ajandek/kartya-hatter-oxigen.jpg', import.meta.url)));
    const { kartyaOldal } = await import('../../netlify/lib/ajandek-levelek.js');
    const headspa = kartyaOldal({ bazis: 'https://x.hu', kod: 'AKABCDEFGH', ar_szoveg: '26.900 Ft', ervenyes_ig: '2027-04-07' });
    assert.match(headspa, /\/assets\/img\/ajandek\/kartya-hatter\.jpg/);
    assert.doesNotMatch(headspa, /oxigen/i);
  });
  test('a webhook ismetlese NEM allit ki masodik szamlat es nem kuld uj levelet', async () => {
    szamlazzKeresek = []; levelek = []; szamlazzValasz = null;
    const a = await fizetett();
    const e = alairt(a.pi);
    assert.equal((await webhook(e)).status, 200);
    const levelDb = levelek.length;
    assert.equal(szamlazzKeresek.length, 1);
    assert.equal((await webhook(alairt(a.pi))).status, 200);
    assert.equal(szamlazzKeresek.length, 1);
    assert.equal(levelek.length, levelDb);
  });
  test('Szamlazz.hu-hiba (veglegesen): nincs szamla, a kartya es a vevo-level megvan, a szalon "KEZZEL KELL KIALLITANI" levelet kap; a hiba a PI-n', async () => {
    szamlazzKeresek = []; levelek = [];
    szamlazzValasz = () => ({ status: 200, torzs: '<xmlszamlavalasz xmlns="x"><sikeres>false</sikeres><hibakod>3</hibakod><hibauzenet>Hibás kulcs</hibauzenet></xmlszamlavalasz>' });
    const a = await fizetett();
    assert.equal((await webhook(alairt(a.pi))).status, 200);
    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.szamla_szam, undefined);
    assert.match(pi.metadata.szamla_hiba, /3: Hibás kulcs/);
    assert.equal(pi.metadata.kartya_kesz, '1');
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.match(szalon.html, /KÉZZEL KELL KIÁLLÍTANI/);
    assert.ok(levelek.find((l) => l.cimzett === 'vevo@example.com'));
    szamlazzValasz = null;
  });
  test('atmeneti Szamlazz.hu-hiba (503): egy ujraproba, utana sikeres', async () => {
    szamlazzKeresek = []; levelek = [];
    let hivas = 0;
    szamlazzValasz = () => (++hivas === 1 ? { status: 503, torzs: 'Service Unavailable' } : { status: 200, torzs: '<xmlszamlavalasz xmlns="x"><sikeres>true</sikeres><szamlaszam>E-OX-2026-2</szamlaszam></xmlszamlavalasz>' });
    const a = await fizetett();
    assert.equal((await webhook(alairt(a.pi))).status, 200);
    assert.equal(szamlazzKeresek.length, 2);
    assert.equal(mock.allapot.pi(a.pi).metadata.szamla_szam, 'E-OX-2026-2');
    szamlazzValasz = null;
  });
  test('elonezeti mod (SZAMLA_ELONEZET=1): elonezeti PDF-keres, valodi szamla nincs; a rendelesen "ELONEZET" jelzo', async () => {
    szamlazzKeresek = []; levelek = [];
    szamlazzValasz = () => ({ status: 200, torzs: '<xmlszamlavalasz xmlns="x"><sikeres>true</sikeres><pdf>AAAA</pdf></xmlszamlavalasz>' });
    const env = { ...ENV, SZAMLA_ELONEZET: '1' };
    const r = await hiv('POST', 'fizetes', { body: torzs(), env });
    mock.allapot.sikeresIt(r.adat.pi, { mod: 'card' });
    assert.equal((await webhook(alairt(r.adat.pi), { env })).status, 200);
    assert.equal(szamlazzKeresek.length, 1);
    assert.match(szamlazzKeresek[0], /<elonezetpdf>true<\/elonezetpdf>/);
    assert.equal(mock.allapot.pi(r.adat.pi).metadata.szamla_szam, 'ELONEZET');
    szamlazzValasz = null;
  });
  test('agent-kulcs nelkul: nincs hivas, a szalon kezzel allitja ki a szamlat (a fizetes es a kartya nem akad el)', async () => {
    szamlazzKeresek = []; levelek = [];
    const env = oxigenKornyezet({ OXIGEN_STRIPE_SECRET_KEY: 'sk_test_mock_oxigen', OXIGEN_STRIPE_PUBLISHABLE_KEY: 'pk_test_oxigen_mock', OXIGEN_STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK, AJANDEK_AZONNALI: '1',
      // a lezeres Agent-kulcs ott van a kornyezetben, de az oxigenes motor nem hasznalhatja
      LEZER_SZAMLAZZ_AGENT_KULCS: 'LEZER-KULCS', SZAMLAZZ_AGENT_KULCS: 'HEADSPA-KULCS', SZAMLAZZ_AGENT_URL: `http://127.0.0.1:${szamlazz.address().port}/szamla/` });
    const r = await hiv('POST', 'fizetes', { body: torzs(), env });
    mock.allapot.sikeresIt(r.adat.pi, { mod: 'card' });
    assert.equal((await webhook(alairt(r.adat.pi), { env })).status, 200);
    assert.equal(szamlazzKeresek.length, 0);
    assert.equal(mock.allapot.pi(r.adat.pi).metadata.szamla_hiba, 'nincs_agent_kulcs');
    assert.match(levelek.find((l) => l.cimzett === 'szalon').html, /KÉZZEL KELL KIÁLLÍTANI/);
  });
  test('a webhook a HEADSPA / a LEZERES titkaval alairva elutasitva (a Stripe-fiokok titkai nem cserelhetok)', async () => {
    const a = await fizetett();
    for (const titok of ['whsec_HEADSPA', 'whsec_LEZER']) {
      const r = await webhook(alairt(a.pi, { titok }));
      assert.ok(r.status === 400 || r.status === 401, titok + ' ' + r.status);
    }
  });
});

describe('oxigenes oldal: a statikus fajlok', () => {
  const html = fs.readFileSync(new URL('../../foglalas/oxigen-ajandekkartya.html', import.meta.url), 'utf8');
  test('noindex, sajat canonical, az oxigenes adat toltodik a HeadSpa adat UTAN, a HeadSpa- es lezeres tartalom nincs rajta', () => {
    assert.match(html, /<meta name="robots" content="noindex, follow">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.mosaicheadspa\.hu\/oxigen-ajandekkartya">/);
    const szkript = (n) => html.indexOf(`<script src="/assets/js/${n}"`);
    assert.ok(szkript('ajandek-adat.js') > 0 && szkript('ajandek-adat.js') < szkript('ajandek-adat-oxigen.js'));
    assert.ok(szkript('ajandek-adat-oxigen.js') < szkript('ajandek.js'));
    assert.equal(szkript('ajandek-adat-lezer.js'), -1);
    assert.doesNotMatch(html.replace(/<meta property="og:site_name"[^>]*>/, '').replace(/MOSAIC-ban|MOSAIC szalonban/g, ''), /Head Spa|Headspa|HEADSPA|lézer|Lézer|szőrtelen|Zsófi/);
    assert.doesNotMatch(html, /vendeg-zsoka|ah-headspa|ah-elemek|id="ah-pontosan"|ah_lz|hero-lezer|kartya-hatter-lezer|atadas-szemelyre-lezer/);
    assert.match(html, /id="ah-ceges"[^>]*hidden/);
    assert.match(html, /id="ah-fizmod"[^>]*hidden/);
    assert.equal((html.match(/name="atvetel"/g) || []).length, 1);
    assert.match(html, /ah_ox_vissza/);
    assert.match(html, /<a href="\/oxigenterapia-budapest">online időpontfoglalásnál<\/a>/);
    // minden kep, amire az oldal hivatkozik, megvan
    for (const m of html.matchAll(/src="(\/assets\/[^"]+)"/g)) if (!/\.js$/.test(m[1])) assert.ok(fs.existsSync(new URL('../..' + m[1], import.meta.url)), m[1]);
  });
  test('a kliens minden azonositoja (getElementById) megvan az oxigenes oldalon is, ahol a kod nem kezeli a hianyat', () => {
    const js = fs.readFileSync(new URL('../../assets/js/ajandek.js', import.meta.url), 'utf8');
    const kell = [...js.matchAll(/\$\('(ah-[a-z0-9-]+)'\)/g)].map((m) => m[1]);
    const nincs = [...new Set(kell)].filter((id) => !new RegExp(`id="${id}"`).test(html));
    // a HeadSpa-oldal azonositoi, amelyeket a kod null-biztosan kezel (az oxigenes oldalon szandekosan nincs ilyen szekcio)
    const OK = new Set(['ah-headspa-video', 'ah-headspa-kep', 'ah-headspa-ido', 'ah-benefitek', 'ah-elemek']);
    assert.deepEqual(nincs.filter((x) => !OK.has(x)), []);
  });
});
