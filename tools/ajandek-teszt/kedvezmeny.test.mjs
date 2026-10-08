// Kedvezmenykodok (10%) az ajandekkartya-vasarlasnal - szerveroldali tesztek (Node beepitett tesztfuttato):
//   node --test tools/ajandek-teszt/kedvezmeny.test.mjs
// A kezelot (netlify/lib/ajandek.js) kozvetlenul hivjuk, a Stripe helyett a helyi mock (mock-stripe.mjs), a Szamlazz.hu helyett helyi csonk. Halozat / level nincs.
// A szabaly (a tulajdonos, 2026-10-08): 18 kod, kodonkent tobbszor hasznalhato, a vevo a kartya MAR akcios aranak 90%-at fizeti, a kartya erteke valtozatlan,
// mindharom kereskedonel (Head Spa, lezer, oxigen) ugyanaz a lista; a fizetendo osszeget es a szamla tetelet MINDIG a szerver szamolja.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { mockStripeInditas } from './mock-stripe.mjs';
import { ajandekKezel, ajandekMotor, kartyaToken, kiallitToken, kuponKod } from '../../netlify/lib/ajandek.js';
import { KEDVEZMENYKODOK, KEDVEZMENY_SZAZALEK, kedvezmenyKeres, kedvezmenyKodEgysegesit, kedvezmenyesAr, kedvezmenyesTetelek } from '../../netlify/lib/ajandek-kedvezmeny.js';
import { lezerKornyezet } from '../../netlify/lib/ajandek-lezer-env.js';
import '../../assets/js/ajandek-adat-lezer.js';
import '../../assets/js/ajandek-adat-oxigen.js';

const ADAT = globalThis.AJANDEK_ADAT;
const LEZER = globalThis.AJANDEK_ADAT_LEZER;
const OXIGEN = globalThis.AJANDEK_ADAT_OXIGEN;
const lezerMotor = ajandekMotor(LEZER, { elotag: '/api/ajandek-lezer/' });
const BAZIS = 'https://teszt.mosaicheadspa.hu';
const WHSEC = 'whsec_teszt_titok';
const TITOK = 'teszt-titok-teszt-titok-teszt-titok-0123456789';
const KODOK_LISTA = ['BETTI10', 'BRIGI10', 'DORI10', 'ENIKO10', 'FANNI10', 'GINA10', 'JANKA10', 'JUDIT10', 'MELI10', 'MONI10', 'NIKI10', 'NOEL10', 'TUNDI10', 'VIKI10', 'VIVISZ10', 'VIVIV10', 'WIKI10', 'ZSOFI10'];

let mock, szamlazz, ENV, LEZER_ENV;
let levelek = [];
let szamlazzKeresek = [];

before(async () => {
  mock = await mockStripeInditas();
  szamlazz = http.createServer((req, res) => {
    const reszek = [];
    req.on('data', (c) => reszek.push(c));
    req.on('end', () => {
      const m = /<\?xml[\s\S]*<\/xmlszamla>/.exec(Buffer.concat(reszek).toString('utf8'));
      szamlazzKeresek.push(m ? m[0] : '');
      res.writeHead(200, { 'content-type': 'text/xml' });
      res.end('<xmlszamlavalasz xmlns="http://www.szamlazz.hu/xmlszamlavalasz"><sikeres>true</sikeres><szamlaszam>E-KED-2026-1</szamlaszam></xmlszamlavalasz>');
    });
  });
  await new Promise((ok) => szamlazz.listen(0, '127.0.0.1', ok));
  ENV = { STRIPE_SECRET_KEY: 'sk_test_mock_123', STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_123', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK };
  LEZER_ENV = lezerKornyezet({
    LEZER_STRIPE_SECRET_KEY: 'sk_test_mock_lezer', LEZER_STRIPE_PUBLISHABLE_KEY: 'pk_test_lezer_mock', LEZER_STRIPE_WEBHOOK_SECRET: WHSEC,
    LEZER_SZAMLAZZ_AGENT_KULCS: 'titkos-agent-kulcs-teszt', STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK, AJANDEK_AZONNALI: '1',
    SZAMLAZZ_AGENT_URL: `http://127.0.0.1:${szamlazz.address().port}/szamla/`,
  });
});
after(async () => { await mock.bezar(); await new Promise((ok) => szamlazz.close(ok)); });

const veletlenIp = () => `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(256)}`;
async function hivMotorral(kezel, elotag, method, ut, { body, query, headers = {}, env = ENV, ip } = {}) {
  const url = new URL(BAZIS + elotag + ut);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const v = await kezel({
    method, url: url.toString(), headers: { 'content-type': 'application/json', 'x-forwarded-for': ip || veletlenIp(), ...headers }, text, env, ip,
    kuld: async (l) => { levelek.push(l); },
  });
  return { ...v, adat: /json/.test(v.headers['content-type'] || '') ? JSON.parse(v.body) : null };
}
const hiv = (method, ut, opc) => hivMotorral(ajandekKezel, '/api/ajandek/', method, ut, opc);
const hivLezer = (method, ut, opc = {}) => hivMotorral(lezerMotor.ajandekKezel, '/api/ajandek-lezer/', method, ut, { env: LEZER_ENV, ...opc });

const torzs = (extra = {}) => ({
  termek: 'egyeni', email: 'vevo@example.com', ajandekozott: 'Kiss Anna', nev: 'Teszt Elek', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.',
  ceges: null, attr: { variant_id: 'general', oldal: '/ajandek' }, mer: { ana: false, adv: false }, kulcs: 'k-' + crypto.randomUUID(), ...extra,
});
function alairt(piId, tipus = 'payment_intent.succeeded', titok = WHSEC) {
  const pi = mock.allapot.pi(piId);
  const t = JSON.stringify({ id: 'evt_' + crypto.randomUUID().replace(/-/g, ''), object: 'event', type: tipus, data: { object: { id: piId, object: 'payment_intent', status: 'succeeded', metadata: pi.metadata } } });
  const ts = Math.floor(Date.now() / 1000);
  return { body: t, headers: { 'stripe-signature': `t=${ts},v1=${crypto.createHmac('sha256', titok).update(`${ts}.${t}`).digest('hex')}` } };
}
const huf = (n) => Number(n).toLocaleString('hu-HU').replace(/\s/g, ' ');   // csak a keresesekhez: a szoveg a motor arSzoveg-e

describe('ajandek-kedvezmeny.js: a kodok es a szamitas', () => {
  test('a lista a tulajdonos 18 kodja, 10%; a kod egysegesitese (kis/nagybetu, szokoz, kotojel); ismeretlen / ures / nem szoveg -> null; kikapcsolhato', () => {
    assert.deepEqual([...KEDVEZMENYKODOK], KODOK_LISTA);
    assert.equal(KEDVEZMENY_SZAZALEK, 10);
    for (const kod of KODOK_LISTA) assert.deepEqual(kedvezmenyKeres(kod), { kod, szazalek: 10 }, kod);
    assert.deepEqual(kedvezmenyKeres(' betti10 '), { kod: 'BETTI10', szazalek: 10 });
    assert.deepEqual(kedvezmenyKeres('Betti-10'), { kod: 'BETTI10', szazalek: 10 });
    assert.deepEqual(kedvezmenyKeres('vivisz 10'), { kod: 'VIVISZ10', szazalek: 10 });
    for (const rossz of ['', ' ', 'NINCS10', 'BETTI', 'BETTI100', 'BETTI11', 'AKABCDEFGH', 'x'.repeat(500), null, undefined, 10, {}, ['BETTI10']]) assert.equal(kedvezmenyKeres(rossz), null, String(rossz));
    assert.equal(kedvezmenyKeres('BETTI10', { bekapcsolva: false }), null);
    assert.equal(kedvezmenyKodEgysegesit('  a-b c_d.e '), 'ABCDE');
    assert.equal(kedvezmenyKodEgysegesit(42), '');
  });

  test('a fizetendo osszeg egesz forint (a Stripe HUF-nal csak egesz forintot fogad): minden kereskedo minden termekere; a szamla tetelei pontosan a fizetendo osszeget adjak', () => {
    assert.equal(kedvezmenyesAr(26900, 10), 24210);
    assert.equal(kedvezmenyesAr(53800, 10), 48420);
    assert.equal(kedvezmenyesAr(39900, 10), 35910);
    assert.equal(kedvezmenyesAr(4990, 10), 4491);
    for (const adat of [ADAT, LEZER, OXIGEN]) {
      for (const t of Object.values(adat.TERMEKEK)) {
        const ar = kedvezmenyesAr(t.ar_ft, 10);
        assert.ok(Number.isSafeInteger(ar) && ar > 0 && ar < t.ar_ft, t.id);
        const tetelek = adat.szamlaTetelek(t.id);
        const uj = kedvezmenyesTetelek(tetelek, 10);
        assert.equal(uj.reduce((o, x) => o + x.ft, 0), ar, t.id + ' tetelei');
        assert.deepEqual(uj.map((x) => [x.nev, x.adokod, x.afa]), tetelek.map((x) => [x.nev, x.adokod, x.afa]), t.id + ': a nev / ado nem valtozik');
        assert.ok(uj.every((x) => Number.isSafeInteger(x.ft) && x.ft > 0), t.id);
      }
    }
    // a 4 kezes: a ket tetel arhanyadosa megmarad (15 000 adomentes + 24 900 27%-os)
    assert.deepEqual(kedvezmenyesTetelek(ADAT.szamlaTetelek('4kezes'), 10).map((x) => x.ft), [13500, 22410]);
    // kerekitesi maradek: az osszeg akkor is pontos, ha a tetelek kulon-kulon kerekitve elternenek
    assert.equal(kedvezmenyesTetelek([{ nev: 'a', ft: 1005 }, { nev: 'b', ft: 1005 }, { nev: 'c', ft: 1005 }], 10).reduce((o, x) => o + x.ft, 0), kedvezmenyesAr(3015, 10));
  });
});

describe('/kedvezmeny (a vevo ellenorzi a kodot) es /beallitas', () => {
  test('ervenyes kod: a kartya erteke, a szazalek es a fizetendo osszeg; kis/nagybetu es szokoz nem szamit; minden kereskedonel', async () => {
    let r = await hiv('POST', 'kedvezmeny', { body: { kod: ' betti10 ', termek: 'egyeni' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.adat, { ok: true, kod: 'BETTI10', szazalek: 10, ertek_ft: 26900, fizetendo_ft: 24210 });
    r = await hiv('POST', 'kedvezmeny', { body: { kod: 'ZSOFI10', termek: '4kezes' } });
    assert.deepEqual(r.adat, { ok: true, kod: 'ZSOFI10', szazalek: 10, ertek_ft: 39900, fizetendo_ft: 35910 });
    const lz = Object.keys(LEZER.TERMEKEK)[0];
    r = await hivLezer('POST', 'kedvezmeny', { body: { kod: 'NOEL10', termek: lz } });
    assert.deepEqual(r.adat, { ok: true, kod: 'NOEL10', szazalek: 10, ertek_ft: LEZER.TERMEKEK[lz].ar_ft, fizetendo_ft: kedvezmenyesAr(LEZER.TERMEKEK[lz].ar_ft, 10) });
    const ox = Object.keys(OXIGEN.TERMEKEK)[0];
    const oxMotor = ajandekMotor(OXIGEN, { elotag: '/api/ajandek-oxigen/' });
    r = await hivMotorral(oxMotor.ajandekKezel, '/api/ajandek-oxigen/', 'POST', 'kedvezmeny', { body: { kod: 'MELI10', termek: ox }, env: ENV });
    assert.deepEqual(r.adat, { ok: true, kod: 'MELI10', szazalek: 10, ertek_ft: OXIGEN.TERMEKEK[ox].ar_ft, fizetendo_ft: kedvezmenyesAr(OXIGEN.TERMEKEK[ox].ar_ft, 10) });
  });

  test('ervenytelen kod -> ok: false (200); ures kod / ismeretlen termek -> 400; kikapcsolva (AJANDEK_KEDVEZMENY=0) -> ok: false, a /beallitas jelzi', async () => {
    let r = await hiv('POST', 'kedvezmeny', { body: { kod: 'NINCS10', termek: 'egyeni' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.adat, { ok: false, hiba: 'ervenytelen_kod' });
    r = await hiv('POST', 'kedvezmeny', { body: { kod: '', termek: 'egyeni' } });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.kedvezmeny);
    for (const termek of ['arany', '__proto__', '', 'constructor']) {
      r = await hiv('POST', 'kedvezmeny', { body: { kod: 'BETTI10', termek } });
      assert.equal(r.status, 400, termek);
      assert.ok(r.adat.mezok.termek);
    }
    const ki = { ...ENV, AJANDEK_KEDVEZMENY: '0' };
    r = await hiv('POST', 'kedvezmeny', { body: { kod: 'BETTI10', termek: 'egyeni' }, env: ki });
    assert.deepEqual(r.adat, { ok: false, hiba: 'ki' });
    assert.equal((await hiv('GET', 'beallitas', { env: ki })).adat.kedvezmeny, false);
    assert.equal((await hiv('GET', 'beallitas')).adat.kedvezmeny, true);
  });

  test('visszaeles-vedelem: csak JSON (415), kulso oldalrol tiltva (403), IP-nkent korlatos (429 + retry-after): a kodok kitalalasa ellen', async () => {
    let r = await hiv('POST', 'kedvezmeny', { body: 'kod=BETTI10&termek=egyeni', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    assert.equal(r.status, 415);
    r = await hiv('POST', 'kedvezmeny', { body: { kod: 'BETTI10', termek: 'egyeni' }, headers: { origin: 'https://masik.example' } });
    assert.equal(r.status, 403);
    assert.equal((await hiv('GET', 'kedvezmeny')).status, 405);
    const ip = veletlenIp();
    let utolso;
    for (let i = 0; i < 11; i++) utolso = await hiv('POST', 'kedvezmeny', { body: { kod: 'PROBA' + i, termek: 'egyeni' }, ip, headers: { 'x-forwarded-for': ip } });
    assert.equal(utolso.status, 429);
    assert.ok(Number(utolso.headers['retry-after']) > 0);
  });
});

describe('/fizetes kedvezmenykoddal', () => {
  test('a PaymentIntent a fizetendo osszegre szol (24 210 Ft), a metadata a kodot es a kartya erteket tartalmazza; a valasz osszege is a fizetendo', async () => {
    const r = await hiv('POST', 'fizetes', { body: torzs({ kedvezmeny: ' niki10 ' }) });
    assert.equal(r.status, 200, r.body);
    assert.equal(r.adat.osszeg, 24210);
    const pi = mock.allapot.pi(r.adat.pi);
    assert.equal(pi.amount, 2421000);
    assert.equal(pi.currency, 'huf');
    assert.equal(pi.metadata.kedv_kod, 'NIKI10');
    assert.equal(pi.metadata.kedv_szazalek, '10');
    assert.equal(pi.metadata.kedv_ertek, '26900');
    assert.equal(pi.metadata.termek, 'egyeni');
  });

  test('kedvezmenykod nelkul teljes ar, metadata nelkul (a regi viselkedes valtozatlan)', async () => {
    const r = await hiv('POST', 'fizetes', { body: torzs() });
    assert.equal(r.adat.osszeg, 26900);
    const pi = mock.allapot.pi(r.adat.pi);
    assert.equal(pi.amount, 2690000);
    for (const m of ['kedv_kod', 'kedv_szazalek', 'kedv_ertek']) assert.equal(pi.metadata[m], undefined, m);
  });

  test('hibas kod -> 400 mezo-hibaval, PI NEM jon letre (a vevo ne fizessen teljes arat kedvezmeny-hitben); ures kod = nincs kedvezmeny; a tobbi hiba mellett is jelzi', async () => {
    const elotte = mock.allapot.pik.size;
    let r = await hiv('POST', 'fizetes', { body: torzs({ kedvezmeny: 'NINCS10' }) });
    assert.equal(r.status, 400);
    assert.equal(r.adat.hiba, 'ervenytelen');
    assert.match(r.adat.mezok.kedvezmeny, /nem érvényes/);
    assert.equal(mock.allapot.pik.size, elotte);
    r = await hiv('POST', 'fizetes', { body: torzs({ kedvezmeny: 'NINCS10', email: 'rossz' }) });
    assert.deepEqual(Object.keys(r.adat.mezok).sort(), ['email', 'kedvezmeny']);
    r = await hiv('POST', 'fizetes', { body: torzs({ kedvezmeny: '   ' }) });
    assert.equal(r.status, 200);
    assert.equal(r.adat.osszeg, 26900);
    // kikapcsolva: a kod nem ervenyes (nem fizethet kedvezmenyes aron)
    r = await hiv('POST', 'fizetes', { body: torzs({ kedvezmeny: 'BETTI10' }), env: { ...ENV, AJANDEK_KEDVEZMENY: '0' } });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.kedvezmeny);
  });

  test('a kliens altal kuldott osszeg / szazalek nem szamit: csak a kod; mas mezok (kedv_*, ar) figyelmen kivul', async () => {
    const r = await hiv('POST', 'fizetes', { body: torzs({ kedvezmeny: 'BETTI10', kedv_szazalek: 90, osszeg: 1, ar_ft: 1, kedv_kod: 'X', kedvezmeny_szazalek: 99 }) });
    assert.equal(r.status, 200);
    assert.equal(r.adat.osszeg, 24210);
    const pi = mock.allapot.pi(r.adat.pi);
    assert.equal(pi.metadata.kedv_szazalek, '10');
    assert.equal(pi.metadata.kedv_kod, 'BETTI10');
  });

  test('termekvaltas / kod torlese ugyanazon a PI-n (fizetes elott): az osszeg es a metadata frissul, a kod torolve a metadatabol', async () => {
    const a = await hiv('POST', 'fizetes', { body: torzs({ kedvezmeny: 'BETTI10' }) });
    assert.equal(a.adat.osszeg, 24210);
    // masik termek ugyanazzal a kodoval: ugyanaz a PI, uj osszeg
    const b = await hiv('POST', 'fizetes', { body: torzs({ termek: 'paros', kedvezmeny: 'BETTI10', kulcs: 'k-' + crypto.randomUUID() }), query: {} , headers: {} });
    assert.equal(b.adat.osszeg, 48420);
    // ugyanaz a PI frissitese (pi + cs): kod torlese
    const c = await hiv('POST', 'fizetes', { body: torzs({ termek: 'egyeni', pi: a.adat.pi, cs: a.adat.client_secret }) });
    assert.equal(c.status, 200, c.body);
    assert.equal(c.adat.pi, a.adat.pi, 'ugyanaz a PI');
    assert.equal(c.adat.osszeg, 26900);
    const pi = mock.allapot.pi(a.adat.pi);
    assert.equal(pi.amount, 2690000);
    for (const m of ['kedv_kod', 'kedv_szazalek', 'kedv_ertek']) assert.ok(!pi.metadata[m], m + ' torolve');
    // es vissza: a kod ujra
    const d = await hiv('POST', 'fizetes', { body: torzs({ termek: 'egyeni', kedvezmeny: 'GINA10', pi: a.adat.pi, cs: a.adat.client_secret }) });
    assert.equal(d.adat.pi, a.adat.pi);
    assert.equal(d.adat.osszeg, 24210);
    assert.equal(mock.allapot.pi(a.adat.pi).metadata.kedv_kod, 'GINA10');
  });
});

describe('Stripe-szamla (HeadSpa) kedvezmenykoddal', () => {
  const ENV_SZ = () => ({ ...ENV, AJANDEK_STRIPE_SZAMLA: '1' });
  const sorok = (szamla) => szamla.lines.data.map((t) => ({ nev: t.description, osszeg: t.amount, kod: t.tax_code }));
  test('egyeni: 1 tetel 24 210 Ft (27%), a szamla osszege = a PI osszege, a tetelnev valtozatlan, a szamla megjegyzese a kodot mutatja', async () => {
    const r = await hiv('POST', 'fizetes', { body: torzs({ kedvezmeny: 'BETTI10' }), env: ENV_SZ() });
    assert.equal(r.status, 200, r.body);
    assert.equal(r.adat.szamla, 'stripe');
    assert.equal(r.adat.osszeg, 24210);
    const pi = mock.allapot.pi(r.adat.pi);
    const sz = mock.allapot.szamla(pi.invoice);
    assert.equal(pi.amount, 2421000);
    assert.equal(sz.total, 2421000);
    assert.equal(sz.amount_due, 2421000);
    assert.deepEqual(sorok(sz), [{ nev: 'Egyéni Headspa Ajándékkártya 20% kedvezménnyel - 50+30 perces', osszeg: 2421000, kod: 'txcd_20040009' }]);
    assert.equal(sz.description, 'Kedvezménykód: BETTI10 (−10% a kártya árából)');
    assert.equal(pi.metadata.kedv_kod, 'BETTI10');
    assert.equal(pi.metadata.szamla_mod, 'invoice');
  });

  test('4 kezes: a ket tetel aranyosan (13 500 adomentes + 22 410 27%-os = 35 910 Ft), az ado a 27%-os soron', async () => {
    const r = await hiv('POST', 'fizetes', { body: torzs({ termek: '4kezes', kedvezmeny: 'VIVISZ10' }), env: ENV_SZ() });
    assert.equal(r.status, 200, r.body);
    assert.equal(r.adat.szamla, 'stripe');
    assert.equal(r.adat.osszeg, 35910);
    const sz = mock.allapot.szamla(mock.allapot.pi(r.adat.pi).invoice);
    assert.deepEqual(sorok(sz).map((x) => [x.osszeg, x.kod]).sort(), [[1350000, 'txcd_00000000'], [2241000, 'txcd_20040009']].sort());
    assert.equal(sz.total, 3591000);
    assert.equal(sz.tax, Math.round(2241000 * 27 / 127));
  });

  test('kedvezmenykod nelkul a szamla valtozatlan (teljes ar, nincs megjegyzes)', async () => {
    const r = await hiv('POST', 'fizetes', { body: torzs(), env: ENV_SZ() });
    const sz = mock.allapot.szamla(mock.allapot.pi(r.adat.pi).invoice);
    assert.equal(sz.total, 2690000);
    assert.ok(!sz.description);
  });
});

describe('/atutalas kedvezmenykoddal', () => {
  test('az utalando osszeg a fizetendo (24 210 Ft); a nyilvantartasi PI, a szalon- es a vevo-level a kodot es a kartya erteket mutatja', async () => {
    levelek = [];
    const r = await hiv('POST', 'atutalas', { body: torzs({ kedvezmeny: 'JUDIT10', telefon: '+36 20 123 4567' }) });
    assert.equal(r.status, 200, r.body);
    assert.equal(r.adat.osszeg, 24210);
    assert.equal(r.adat.utalas.osszeg_ft, 24210);
    const pi = [...mock.allapot.pik.values()].find((x) => x.metadata && x.metadata.atu_ref === r.adat.rendeles_ref);
    assert.equal(pi.amount, 2421000);
    assert.equal(pi.metadata.kedv_kod, 'JUDIT10');
    assert.equal(pi.metadata.kedv_ertek, '26900');
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    assert.match(szalon.html, /JUDIT10 \(−10%: −2[\s\u00a0.]690 Ft\)/);
    assert.match(szalon.html, /A kártya értéke/);
    assert.match(vevo.html, /JUDIT10/);
    assert.match(vevo.html, /26[\s .]900 Ft/);
    assert.match(vevo.html, /24[\s .]210 Ft/);
  });

  test('hibas kod -> 400, nincs PI, nincs level; kod nelkul a regi viselkedes', async () => {
    levelek = [];
    const elotte = mock.allapot.pik.size;
    const r = await hiv('POST', 'atutalas', { body: torzs({ kedvezmeny: 'NINCS10', telefon: '+36201234567' }) });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.kedvezmeny);
    assert.equal(mock.allapot.pik.size, elotte);
    assert.equal(levelek.length, 0);
    const j = await hiv('POST', 'atutalas', { body: torzs({ telefon: '+36201234567' }) });
    assert.equal(j.adat.osszeg, 26900);
  });
});

describe('fizetes utan: levelek, rendeles, kartya, kiallitas', () => {
  const azonnali = () => ({ ...ENV, AJANDEK_AZONNALI: '1' });
  async function fizetett(extra) {
    const r = await hiv('POST', 'fizetes', { body: torzs(extra), env: azonnali() });
    assert.equal(r.status, 200, r.body);
    mock.allapot.sikeresIt(r.adat.pi, { mod: 'card' });
    return r.adat;
  }
  test('a szalon-level a kodot, a fizetett osszeget ES a kartya erteket mutatja; a vevo-level a fizetett osszeget es a kartya erteket', async () => {
    const a = await fizetett({ kedvezmeny: 'WIKI10' });
    levelek = [];
    assert.equal((await hiv('POST', 'webhook', { ...alairt(a.pi), env: azonnali() })).status, 200);
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    assert.ok(szalon && vevo);
    assert.match(szalon.html, /WIKI10/);
    assert.match(szalon.html, /A kártya értéke/);
    assert.match(szalon.html, /24[\s .]210 Ft/);
    assert.match(szalon.html, /26[\s .]900 Ft/);
    assert.match(vevo.html, /Fizetett összeg/);
    assert.match(vevo.html, /WIKI10/);
    assert.match(vevo.html, /26[\s .]900 Ft/);
  });

  test('kedvezmenykod nelkul a levelekben nincs kedvezmeny-sor (a regi levelek valtozatlanok)', async () => {
    const a = await fizetett();
    levelek = [];
    await hiv('POST', 'webhook', { ...alairt(a.pi), env: azonnali() });
    for (const l of levelek) {
      assert.doesNotMatch(l.html, /Kedvezménykód|A kártya értéke|Fizetett összeg/, l.cimzett);
    }
  });

  test('/rendeles: a fizetett osszeg + a kedvezmeny (kod, szazalek, a kartya erteke); a kartya LAPJAN a kartya ERTEKE (26 900 Ft) latszik, nem a fizetett osszeg', async () => {
    const a = await fizetett({ kedvezmeny: 'MELI10' });
    await hiv('POST', 'webhook', { ...alairt(a.pi), env: azonnali() });
    const ren = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret }, env: azonnali() });
    assert.equal(ren.status, 200);
    assert.equal(ren.adat.osszeg, 24210);
    assert.deepEqual(ren.adat.kedvezmeny, { kod: 'MELI10', szazalek: 10, ertek: 26900 });
    const k = await hiv('GET', 'kartya', { query: { pi: a.pi, t: await kartyaToken(azonnali(), a.pi) }, env: azonnali() });
    assert.equal(k.status, 200, k.body.slice(0, 300));
    assert.match(k.body, /26[\s .]900 Ft/);
    assert.doesNotMatch(k.body, /24[\s .]210/);
  });

  test('kedvezmenykod nelkuli rendelesnel a /rendeles kedvezmeny mezoje null', async () => {
    const a = await fizetett();
    const ren = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret }, env: azonnali() });
    assert.equal(ren.adat.kedvezmeny, null);
  });
});

describe('lezeres kereskedo (Szamlazz.hu Agent) kedvezmenykoddal', () => {
  test('a szamla tetele a fizetendo osszeg (AAM), a megjegyzes a kodot tartalmazza; az osszeg-ellenorzes nem akad el', async () => {
    const termek = Object.keys(LEZER.TERMEKEK)[0];
    const ar = LEZER.TERMEKEK[termek].ar_ft;
    const r = await hivLezer('POST', 'fizetes', { body: torzs({ termek, kedvezmeny: 'TUNDI10' }) });
    assert.equal(r.status, 200, r.body);
    assert.equal(r.adat.osszeg, kedvezmenyesAr(ar, 10));
    mock.allapot.sikeresIt(r.adat.pi, { mod: 'card' });
    szamlazzKeresek = [];
    levelek = [];
    const w = await hivLezer('POST', 'webhook', alairt(r.adat.pi));
    assert.equal(w.status, 200, w.body);
    assert.equal(szamlazzKeresek.length, 1);
    const xml = szamlazzKeresek[0];
    assert.match(xml, /Kedvezménykód: TUNDI10/);
    const ft = [...xml.matchAll(/<bruttoErtek>([\d.]+)<\/bruttoErtek>/g)].map((m) => Number(m[1]));
    assert.ok(ft.length >= 1);
    assert.equal(ft[0], kedvezmenyesAr(ar, 10));
    const pi = mock.allapot.pi(r.adat.pi);
    assert.ok(pi.metadata.szamla_szam, 'a szamla kiallitva: ' + (pi.metadata.szamla_hiba || ''));
    assert.ok(!pi.metadata.szamla_hiba);
  });

  test('a lezeres PI osszege a fizetendo; a HeadSpa kodok ugyanazok (egy kozos lista)', async () => {
    const termek = Object.keys(LEZER.TERMEKEK)[1];
    for (const kod of ['BETTI10', 'ZSOFI10']) {
      const r = await hivLezer('POST', 'fizetes', { body: torzs({ termek, kedvezmeny: kod }) });
      assert.equal(mock.allapot.pi(r.adat.pi).amount, kedvezmenyesAr(LEZER.TERMEKEK[termek].ar_ft, 10) * 100);
      assert.equal(mock.allapot.pi(r.adat.pi).metadata.kedv_kod, kod);
    }
  });
});
