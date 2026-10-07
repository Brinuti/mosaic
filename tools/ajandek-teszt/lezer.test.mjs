// A LEZERES ajandekkartya kereskedo tesztjei (Node beepitett tesztfuttato):
//   node --test "tools/ajandek-teszt/lezer.test.mjs"
// A motort a lezeres adattal peldanyositjuk (ajandekMotor + ajandek-adat-lezer.js), a Stripe helyett a helyi mock (mock-stripe.mjs),
// a Szamlazz.hu helyett egy helyi HTTP-szerver (SZAMLAZZ_AGENT_URL, csak loopback fogadhato el). Valodi halozati forgalom / level nincs.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import { mockStripeInditas } from './mock-stripe.mjs';
import { ajandekMotor } from '../../netlify/lib/ajandek.js';
import { lezerKornyezet } from '../../netlify/lib/ajandek-lezer-env.js';
import '../../assets/js/ajandek-adat-lezer.js';

const HEADSPA = globalThis.AJANDEK_ADAT;
const LEZER = globalThis.AJANDEK_ADAT_LEZER;
const motor = ajandekMotor(LEZER, { elotag: '/api/ajandek-lezer/' });
const BAZIS = 'https://teszt.mosaicheadspa.hu';
const WHSEC = 'whsec_lezer_teszt';
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
      const v = szamlazzValasz ? szamlazzValasz(xml) : { status: 200, torzs: '<xmlszamlavalasz xmlns="http://www.szamlazz.hu/xmlszamlavalasz"><sikeres>true</sikeres><szamlaszam>E-LZ-2026-1</szamlaszam></xmlszamlavalasz>' };
      res.writeHead(v.status, { 'content-type': 'text/xml' });
      res.end(v.torzs);
    });
  });
  await new Promise((ok) => szamlazz.listen(0, '127.0.0.1', ok));
  ENV = lezerKornyezet({
    LEZER_STRIPE_SECRET_KEY: 'sk_test_mock_lezer', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_test_lezer_mock', LEZER_STRIPE_WEBHOOK_SECRET: WHSEC,
    LEZER_SZAMLAZZ_AGENT_KULCS: 'titkos-agent-kulcs-teszt', STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK, AJANDEK_AZONNALI: '1',
    SZAMLAZZ_AGENT_URL: `http://127.0.0.1:${szamlazz.address().port}/szamla/`,
    // a HeadSpa kulcsai is ott vannak a kornyezetben: a lezeres motor SOHA nem hasznalhatja ezeket
    STRIPE_SECRET_KEY: 'sk_live_HEADSPA_NE_HASZNALD', STRIPE_PUBLISHABLE_KEY: 'pk_live_HEADSPA', STRIPE_WEBHOOK_SECRET: 'whsec_HEADSPA', SZAMLAZZ_AGENT_KULCS: 'HEADSPA-KULCS',
  });
});
after(async () => { await mock.bezar(); await new Promise((ok) => szamlazz.close(ok)); });

const veletlenIp = () => `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(256)}`;
async function hiv(method, ut, { body, query, headers = {}, env = ENV, most } = {}) {
  const url = new URL(BAZIS + '/api/ajandek-lezer/' + ut);
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
  termek: 'lezer30', email: 'vevo@example.com', ajandekozott: 'Kiss Anna', nev: 'Teszt Elek', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.',
  ceges: null, attr: { variant_id: 'general', oldal: '/lezeres-ajandekkartya' }, mer: { ana: false, adv: false }, kulcs: 'k-' + crypto.randomUUID(), ...extra,
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

describe('lezeres kereskedo: kornyezet es adat', () => {
  test('a LEZER_* beallitasok a motor neveire kepezve; a HeadSpa kulcsai SOHA nem folynak at, hianyzo lezeres kulcs ures marad', () => {
    const e = lezerKornyezet({ STRIPE_SECRET_KEY: 'sk_live_headspa', STRIPE_PUBLISHABLE_KEY: 'pk_live_headspa', STRIPE_WEBHOOK_SECRET: 'whsec_headspa', SZAMLAZZ_AGENT_KULCS: 'headspa', MERES_HOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/abc', AJANDEK_TITOK: TITOK });
    assert.equal(e.STRIPE_SECRET_KEY, '');
    assert.equal(e.STRIPE_PUBLISHABLE_KEY, '');
    assert.equal(e.STRIPE_WEBHOOK_SECRET, '');
    assert.equal(e.SZAMLAZZ_AGENT_KULCS, '');
    assert.equal(e.MERES_HOOK_URL, '');          // nincs szerveroldali Zapier-meres a lezeres kartyanal
    assert.equal(e.AJANDEK_STRIPE_SZAMLA, '0');  // nincs Stripe-szamla
    assert.equal(e.AJANDEK_TITOK, TITOK);
    const f = lezerKornyezet({ LEZER_STRIPE_SECRET_KEY: 'rk_live_l', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_live_l', LEZER_STRIPE_WEBHOOK_SECRET: 'whsec_l', LEZER_SZAMLAZZ_AGENT_KULCS: 'lk', LEZER_AJANDEK_TITOK: 'masik' });
    assert.deepEqual([f.STRIPE_SECRET_KEY, f.STRIPE_PUBLISHABLE_KEY, f.STRIPE_WEBHOOK_SECRET, f.SZAMLAZZ_AGENT_KULCS, f.AJANDEK_TITOK], ['rk_live_l', 'pk_live_l', 'whsec_l', 'lk', 'masik']);
  });
  test('a termekek: fix osszegek, a szamla-tetel osszege = az ar, AAM; sajat azonositok (a HeadSpa-ekkel nem keverednek)', () => {
    const idk = Object.keys(LEZER.TERMEKEK);
    assert.deepEqual(idk, ['lezer30', 'lezer50', 'lezer100', 'lezer200']);
    for (const id of idk) {
      const t = LEZER.TERMEKEK[id];
      const sor = LEZER.szamlaTetelek(id);
      assert.equal(sor.reduce((o, x) => o + x.ft, 0), t.ar_ft, id);
      assert.ok(sor.every((x) => x.afa === 'AAM'), id);
      assert.ok(!(id in HEADSPA.TERMEKEK));
      assert.match(t.kartya_cim, /Lézeres szőrtelenítés ajándékkártya/);
      assert.deepEqual(t.kartya_felirat, ['MOSAIC LÉZERES', 'SZŐRTELENÍTÉS']);
    }
    assert.equal(LEZER.szamlaTetelek('egyeni'), null);
    assert.equal(LEZER.szamlaTetelek('__proto__'), null);
    assert.equal(LEZER.rendelesAzonosito('pi_3UNinYFv8vc2ArnL1mioRQd1'), 'LZ-1MIORQD1');
    assert.equal(HEADSPA.rendelesAzonosito('pi_3UNinYFv8vc2ArnL1mioRQd1'), 'MH-1MIORQD1');
  });
  test('a kliens-oldali lezeres adat sehol nem hivatkozik a HeadSpa-termekekre / video-adatra', () => {
    assert.deepEqual(LEZER.FINDER, []);
    assert.equal(LEZER.HEADSPA_VIDEO, null);
    assert.deepEqual(LEZER.ELEMEK, []);
    assert.equal(LEZER.ATVETELEK.length, 1);
    assert.equal(LEZER.oldalAlapertek('/lezeres-ajandekkartya/').termek, 'lezer50');
    assert.ok(LEZER.TERMEKEK[LEZER.oldalAlapertek('/lezeres-ajandekkartya').termek]);
  });
  test('beallitas: a lezeres publikus kulcs, a HeadSpa-e soha', async () => {
    const r = await hiv('GET', 'beallitas');
    assert.equal(r.status, 200);
    assert.equal(r.adat.publikus_kulcs, 'pk_test_lezer_mock');
    assert.doesNotMatch(r.body, /HEADSPA/);
    const nincs = await hiv('GET', 'beallitas', { env: lezerKornyezet({ STRIPE_SECRET_KEY: 'sk_live_headspa', STRIPE_PUBLISHABLE_KEY: 'pk_live_headspa', AJANDEK_TITOK: TITOK }) });
    assert.equal(nincs.adat.mod, 'nincs');
    assert.equal(nincs.adat.publikus_kulcs, null);
  });
});

describe('lezeres kereskedo: rendeles (/fizetes)', () => {
  test('PaymentIntent a termek fix osszegevel, lezeres leirassal, LZ- azonositoval; kartya + Revolut Pay; szamla-mod: agent', async () => {
    const r = await hiv('POST', 'fizetes', { body: torzs({ termek: 'lezer50' }) });
    assert.equal(r.status, 200, r.body);
    const pi = mock.allapot.pi(r.adat.pi);
    assert.equal(pi.amount, 5000000);
    assert.equal(pi.currency, 'huf');
    assert.match(pi.description, /^MOSAIC lézeres szőrtelenítés ajándékkártya - /);
    assert.equal(pi.metadata.termek, 'lezer50');
    assert.equal(pi.metadata.szamla_mod, 'agent');
    assert.equal(pi.metadata.szamla_id, undefined);
    assert.deepEqual([...(pi.payment_method_types || [])].sort(), ['card', 'revolut_pay']);
    assert.match(r.adat.rendeles_id, /^LZ-[0-9A-Z]{8}$/);
  });
  test('HeadSpa-termek, ismeretlen termek: elutasitva (a lezeres motor csak a sajat termekeit arulja)', async () => {
    for (const termek of ['egyeni', 'paros', '4kezes', 'arany', '__proto__']) {
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
  test('lezeres Stripe-kulcs nelkul 503 (nem a HeadSpa fiokjaval dolgozik)', async () => {
    const env = lezerKornyezet({ STRIPE_SECRET_KEY: 'sk_live_headspa', STRIPE_PUBLISHABLE_KEY: 'pk_live_headspa', AJANDEK_TITOK: TITOK, STRIPE_API_BASE: mock.url });
    const elotte = mock.allapot.pik.size;
    const r = await hiv('POST', 'fizetes', { body: torzs(), env });
    assert.ok(r.status >= 500 || r.status === 503, String(r.status));
    assert.equal(mock.allapot.pik.size, elotte);
  });
});

describe('lezeres kereskedo: fizetes utan (webhook): szamla a Szamlazz.hu-n, levelek, kod', () => {
  test('sikeres fizetes: a szamla a vasarlaskor (egyszer), AAM-tetellel; a vevo kodot es kartyat kap kotojel nelkul; a szalon "kupon" teendot', async () => {
    szamlazzKeresek = []; levelek = []; szamlazzValasz = null;
    const a = await fizetett({ termek: 'lezer30', szemelyre: null });
    assert.equal((await webhook(alairt(a.pi))).status, 200);
    assert.equal(szamlazzKeresek.length, 1);
    const xml = szamlazzKeresek[0];
    assert.match(xml, /<szamlaagentkulcs>titkos-agent-kulcs-teszt<\/szamlaagentkulcs>/);
    assert.doesNotMatch(xml, /HEADSPA/);
    assert.match(xml, new RegExp(`<rendelesSzam>${a.rendeles_id}</rendelesSzam>`));
    assert.match(xml, /<megnevezes>MOSAIC lézeres szőrtelenítés ajándékkártya – 30\.000 Ft értékben<\/megnevezes>/);
    assert.match(xml, /<afakulcs>AAM<\/afakulcs>/);
    assert.match(xml, /<bruttoErtek>30000<\/bruttoErtek>/);
    assert.match(xml, /<email>vevo@example.com<\/email>/);
    assert.doesNotMatch(xml, /<elonezetpdf>true/);
    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.szamla_szam, 'E-LZ-2026-1');
    assert.equal(pi.metadata.szamla_hiba, undefined);
    assert.equal(pi.metadata.kartya_kesz, '1');
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.ok(vevo && szalon);
    assert.match(vevo.targy, /LZ-[0-9A-Z]{8}/);
    assert.doesNotMatch(vevo.html + vevo.targy, /Head Spa|HEADSPA|Headspa/, 'a vevo-levelben nincs HeadSpa-marka');
    assert.match(vevo.html, /lezeres-szortelenites-budapest/);
    assert.match(szalon.html, /automatikusan kiállítottuk/);
    assert.match(szalon.html, /E-LZ-2026-1/);
    assert.match(szalon.html, /fix összegű kupont/);
    assert.match(szalon.html, /30\.000 Ft/);
    const kod = (/AK[0-9A-HJKMNP-TV-Z]{8}/.exec(szalon.html) || [])[0];
    assert.match(kod, KOD_RE);
    assert.ok(vevo.html.includes(kod));
    assert.doesNotMatch(szalon.html + vevo.html, /AK-[0-9A-Z]{4}-/);
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
    szamlazzValasz = () => (++hivas === 1 ? { status: 503, torzs: 'Service Unavailable' } : { status: 200, torzs: '<xmlszamlavalasz xmlns="x"><sikeres>true</sikeres><szamlaszam>E-LZ-2026-2</szamlaszam></xmlszamlavalasz>' });
    const a = await fizetett();
    assert.equal((await webhook(alairt(a.pi))).status, 200);
    assert.equal(szamlazzKeresek.length, 2);
    assert.equal(mock.allapot.pi(a.pi).metadata.szamla_szam, 'E-LZ-2026-2');
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
    const env = lezerKornyezet({ LEZER_STRIPE_SECRET_KEY: 'sk_test_mock_lezer', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_test_lezer_mock', LEZER_STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK, AJANDEK_AZONNALI: '1' });
    const r = await hiv('POST', 'fizetes', { body: torzs(), env });
    mock.allapot.sikeresIt(r.adat.pi, { mod: 'card' });
    assert.equal((await webhook(alairt(r.adat.pi), { env })).status, 200);
    assert.equal(szamlazzKeresek.length, 0);
    assert.equal(mock.allapot.pi(r.adat.pi).metadata.szamla_hiba, 'nincs_agent_kulcs');
    assert.match(levelek.find((l) => l.cimzett === 'szalon').html, /KÉZZEL KELL KIÁLLÍTANI/);
  });
  test('a webhook a HEADSPA titkaval alairva elutasitva (a ket Stripe-fiok titkai nem cserelhetok)', async () => {
    const a = await fizetett();
    const r = await webhook(alairt(a.pi, { titok: 'whsec_HEADSPA' }));
    assert.ok(r.status === 400 || r.status === 401, String(r.status));
  });
});

describe('lezeres oldal: a statikus fajlok', () => {
  const html = fs.readFileSync(new URL('../../foglalas/lezeres-ajandekkartya.html', import.meta.url), 'utf8');
  test('noindex, sajat canonical, a lezeres adat toltodik a HeadSpa adat UTAN, a HeadSpa-tartalom nincs rajta', () => {
    assert.match(html, /<meta name="robots" content="noindex, follow">/);
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.mosaicheadspa\.hu\/lezeres-ajandekkartya">/);
    const szkript = (n) => html.indexOf(`<script src="/assets/js/${n}"`);
    assert.ok(szkript('ajandek-adat.js') > 0 && szkript('ajandek-adat.js') < szkript('ajandek-adat-lezer.js'));
    assert.ok(szkript('ajandek-adat-lezer.js') < szkript('ajandek.js'));
    assert.doesNotMatch(html.replace(/<meta property="og:site_name"[^>]*>/, ''), /Head Spa|Headspa|HEADSPA/);
    assert.doesNotMatch(html, /vendeg-zsoka|ah-headspa|ah-elemek|id="ah-pontosan"/);
    assert.match(html, /id="ah-ceges"[^>]*hidden/);
    assert.match(html, /id="ah-fizmod"[^>]*hidden/);
    assert.equal((html.match(/name="atvetel"/g) || []).length, 1);
    assert.match(html, /ah_lz_vissza/);
  });
  test('a kliens minden azonositoja (getElementById) megvan a lezeres oldalon is, ahol a kod nem kezeli a hianyat', () => {
    const js = fs.readFileSync(new URL('../../assets/js/ajandek.js', import.meta.url), 'utf8');
    const kell = [...js.matchAll(/\$\('(ah-[a-z0-9-]+)'\)/g)].map((m) => m[1]);
    const nincs = [...new Set(kell)].filter((id) => !new RegExp(`id="${id}"`).test(html));
    // a HeadSpa-oldal azonositoi, amelyeket a kod null-biztosan kezel (a lezeres oldalon szandekosan nincs ilyen szekcio)
    const OK = new Set(['ah-headspa-video', 'ah-headspa-kep', 'ah-headspa-ido', 'ah-benefitek', 'ah-elemek']);
    assert.deepEqual(nincs.filter((x) => !OK.has(x)), []);
  });
});
