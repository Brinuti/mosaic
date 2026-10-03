// A Gift Commerce Engine szerveroldalanak tesztjei (Node beepitett tesztfuttato, nincs uj fuggoseg):
//   node --test tools/ajandek-teszt/
// A kezelot (netlify/lib/ajandek.js) kozvetlenul hivjuk; a Stripe helyett a helyi mock fut
// (mock-stripe.mjs), a STRIPE_API_BASE erre mutat. Valodi halozati forgalom / level nincs.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mockStripeInditas } from './mock-stripe.mjs';
import { ajandekKezel, kuponKod, kiallitToken, kartyaToken } from '../../netlify/lib/ajandek.js';
import { utvonal } from '../../netlify/lib/utvonal.js';
import { config as edgeConfig } from '../../netlify/edge-functions/oldal.js';

const ADAT = globalThis.AJANDEK_ADAT;
const BAZIS = 'https://teszt.mosaicheadspa.hu';
const WHSEC = 'whsec_teszt_titok';
const KOD_RE = /^AK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

let mock;
let ENV;
let levelek = [];

before(async () => {
  mock = await mockStripeInditas();
  ENV = {
    STRIPE_SECRET_KEY: 'sk_test_mock_123',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_123',
    STRIPE_WEBHOOK_SECRET: WHSEC,
    STRIPE_API_BASE: mock.url,
    AJANDEK_TITOK: 'teszt-titok',
  };
});
after(async () => { await mock.bezar(); });

async function hiv(method, ut, { body, query, headers = {}, env = ENV, most, kuld } = {}) {
  const url = new URL(BAZIS + '/api/ajandek/' + ut);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  const v = await ajandekKezel({
    method, url: url.toString(), headers: { 'content-type': 'application/json', ...headers }, text, env, most,
    kuld: kuld || (async (l) => { levelek.push(l); }),
  });
  const adat = /json/.test(v.headers['content-type'] || '') ? JSON.parse(v.body) : null;
  return { ...v, adat };
}

const rendelesTorzs = (extra = {}) => ({
  termek: 'egyeni', email: 'vevo@example.com', nev: 'Teszt Elek', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.',
  ceges: null,
  attr: { variant_id: 'general', gift_context: 'general', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'oszi', gclid: 'gcl-123', oldal: '/ajandek?utm_source=google' },
  kulcs: 'k-' + crypto.randomUUID(),
  ...extra,
});

async function ujRendeles(extra) {
  const r = await hiv('POST', 'fizetes', { body: rendelesTorzs(extra) });
  assert.equal(r.status, 200, r.body);
  return r.adat;
}
async function fizetettRendeles(extra, mod = 'card') {
  const r = await ujRendeles(extra);
  mock.allapot.sikeresIt(r.pi, { mod });
  return r;
}

function alairtEsemeny(piId, { titok = WHSEC, ts = Math.floor(Date.now() / 1000), tipus = 'payment_intent.succeeded', metadata } = {}) {
  const pi = mock.allapot.pi(piId);
  const torzs = JSON.stringify({
    id: 'evt_' + crypto.randomUUID().replace(/-/g, ''), object: 'event', type: tipus,
    data: { object: { id: piId, object: 'payment_intent', status: 'succeeded', metadata: metadata ?? pi.metadata } },
  });
  const sig = crypto.createHmac('sha256', titok).update(`${ts}.${torzs}`).digest('hex');
  return { torzs, fejlec: `t=${ts},v1=${sig}` };
}
const webhook = (e, opciok = {}) => hiv('POST', 'webhook', { body: e.torzs, headers: { 'stripe-signature': e.fejlec }, ...opciok });

// fuggetlen (node:crypto) szamitas a kodra, a kezelotol fuggetlenul
function vartKod(titok, piId) {
  const b = crypto.createHmac('sha256', titok).update('kod:' + piId).digest();
  let n = 0n;
  for (let i = 0; i < 5; i++) n = (n << 8n) | BigInt(b[i]);
  const abc = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  for (let i = 7; i >= 0; i--) s += abc[Number((n >> BigInt(5 * i)) & 31n)];
  return `AK-${s.slice(0, 4)}-${s.slice(4)}`;
}

// --- kozos adat -------------------------------------------------------------------------------------------
describe('ajandek-adat: variantFeloldas', () => {
  test('hianyzo / ismeretlen / prototipus-nevek / nagybetus -> general', () => {
    const g = ADAT.VARIANTOK.general;
    for (const x of [undefined, null, '', 'nincs-ilyen', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', {}, 42]) {
      assert.equal(ADAT.variantFeloldas(x), g, `variant: ${String(x)}`);
    }
    assert.equal(ADAT.variantFeloldas('GENERAL'), g);
    assert.equal(ADAT.variantFeloldas('  General '), g);
    assert.equal(ADAT.variantFeloldas('general').variant_id, 'general');
  });
});

describe('utvonal-kizarasok', () => {
  test('az /api/ utak valtozatlanul tovabbmennek (utvonal.js -> null, edge excludedPath)', () => {
    assert.equal(utvonal('/api/ajandek/fizetes', ''), null);
    assert.equal(utvonal('/api/ajandek/kartya', 'iPhone'), null);
    assert.ok(edgeConfig.excludedPath.includes('/api/*'));
    // a tobbi lap valtozatlan
    assert.deepEqual(utvonal('/headspa-budapest', ''), { atir: '/_a/headspa-budapest' });
  });
});

// --- utvalasztas -----------------------------------------------------------------------------------------
describe('utvalasztas', () => {
  test('ismeretlen ut -> 404 JSON, rossz metodus -> 405, minden valasz no-store', async () => {
    for (const ut of ['nincs', 'constructor', '__proto__', 'toString', '']) {
      const r = await hiv('GET', ut);
      assert.equal(r.status, 404, ut);
      assert.deepEqual(r.adat, { hiba: 'nincs' });
      assert.equal(r.headers['cache-control'], 'no-store');
    }
    const r = await hiv('GET', 'fizetes');
    assert.equal(r.status, 405);
    assert.equal(r.headers.allow, 'POST');
    assert.equal((await hiv('POST', 'beallitas')).status, 405);
    assert.equal((await hiv('HEAD', 'kiallit')).status, 405);
    const kivul = await ajandekKezel({ method: 'GET', url: BAZIS + '/api/masik/x', headers: {}, text: '', env: ENV });
    assert.equal(kivul.status, 404);
  });
});

// --- /beallitas --------------------------------------------------------------------------------------------
describe('/beallitas', () => {
  test('mod a kulcs elotagjabol; publikus kulcs csak ha van mod; azonnali_kartya', async () => {
    const eset = async (env) => (await hiv('GET', 'beallitas', { env })).adat;
    assert.deepEqual(await eset({}), { mod: 'nincs', publikus_kulcs: null, azonnali_kartya: false });
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'sk_test_x' })).mod, 'nincs');
    assert.equal((await eset({ STRIPE_PUBLISHABLE_KEY: 'pk_test_x' })).mod, 'nincs');
    assert.deepEqual(await eset({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_y' }), { mod: 'teszt', publikus_kulcs: 'pk_test_y', azonnali_kartya: false });
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'rk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_y' })).mod, 'teszt');
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_y' })).mod, 'elo');
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'rk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_y' })).mod, 'elo');
    // vegyes (teszt titkos + eles publikus): a fizetes ugysem mukodne
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_live_y' })).mod, 'nincs');
    assert.equal((await eset({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_y' })).mod, 'nincs');
    assert.equal((await eset({ ...ENV, AJANDEK_AZONNALI: '1' })).azonnali_kartya, true);
    assert.equal((await eset({ ...ENV, AJANDEK_AZONNALI: 'true' })).azonnali_kartya, false);
    const r = await hiv('GET', 'beallitas');
    assert.equal(r.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-store');
  });
});

// --- /fizetes ------------------------------------------------------------------------------------------------
describe('/fizetes', () => {
  test('validacio: rossz e-mail, ismeretlen termek, hianyzo nev/cim -> 400 mezo-hibakkal, PI nem jon letre', async () => {
    const elotte = mock.allapot.pik.size;
    let r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ email: 'nem-email', termek: 'arany', nev: '  ', cim: '' }) });
    assert.equal(r.status, 400);
    assert.equal(r.adat.hiba, 'ervenytelen');
    for (const m of ['email', 'termek', 'nev', 'cim']) assert.equal(typeof r.adat.mezok[m], 'string', m);
    assert.equal(r.adat.mezok.varos, undefined);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ termek: '__proto__' }) });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.termek);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ termek: 'constructor', email: 'a@b', iranyitoszam: '', varos: '' }) });
    assert.deepEqual(Object.keys(r.adat.mezok).sort(), ['email', 'iranyitoszam', 'termek', 'varos']);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ nev: 'x'.repeat(121), email: 'a'.repeat(250) + '@x.hu' }) });
    assert.ok(r.adat.mezok.nev && r.adat.mezok.email);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ ceges: { nev: 'Minta Kft.', adoszam: '' } }) });
    assert.ok(r.adat.mezok['ceges.adoszam']);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ ceges: { nev: '', adoszam: '12345678-1-42' } }) });
    assert.ok(r.adat.mezok['ceges.nev']);
    r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs: 'rossz kulcs <script>' }) });
    assert.ok(r.adat.mezok.kulcs);
    r = await hiv('POST', 'fizetes', { body: '{nem json' });
    assert.equal(r.status, 400);
    assert.equal(r.adat.hiba, 'ervenytelen');
    r = await hiv('POST', 'fizetes', { body: '[1,2]' });
    assert.equal(r.status, 400);
    assert.equal(mock.allapot.pik.size, elotte);
  });

  test('robotcsapda (bot-field) -> 200 ok-nak latszo valasz, de nincs PI', async () => {
    const elotte = mock.allapot.pik.size;
    const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ 'bot-field': 'http://spam' }) });
    assert.equal(r.status, 200);
    assert.deepEqual(r.adat, { ok: true });
    assert.equal(mock.allapot.pik.size, elotte);
  });

  test('nincs Stripe-beallitas -> 503 nincs_beallitva', async () => {
    const r = await hiv('POST', 'fizetes', { body: rendelesTorzs(), env: { STRIPE_API_BASE: mock.url } });
    assert.equal(r.status, 503);
    assert.deepEqual(r.adat, { hiba: 'nincs_beallitva' });
  });

  test('a PI-t a szerver araval hozza letre (a kliens osszege nem szamit), HUF x100, metadata', async () => {
    const torzs = rendelesTorzs({ osszeg: 1, amount: 100, ar_ft: 5, attr: { variant_id: 'NINCS-ILYEN', utm_source: 'meta', fbclid: 'fb-1', relationship: 'Barátnő!!' } });
    const r = await hiv('POST', 'fizetes', { body: torzs });
    assert.equal(r.status, 200);
    assert.match(r.adat.pi, /^pi_/);
    assert.equal(r.adat.client_secret, mock.allapot.pi(r.adat.pi).client_secret);
    assert.equal(r.adat.osszeg, 26900);
    assert.equal(r.adat.penznem, 'HUF');
    assert.equal(r.adat.rendeles_id, ADAT.rendelesAzonosito(r.adat.pi));
    const pi = mock.allapot.pi(r.adat.pi);
    assert.equal(pi.amount, 2690000);
    assert.equal(pi.amount % 100, 0);
    assert.equal(pi.currency, 'huf');
    assert.deepEqual(pi.automatic_payment_methods, { enabled: true });
    assert.equal(pi.receipt_email, 'vevo@example.com');
    assert.equal(pi.description, 'MOSAIC Head Spa ajándékkártya - Egyéni Head Spa');
    assert.equal(pi.metadata.forras, 'ajandek-motor');
    assert.equal(pi.metadata.termek, 'egyeni');
    assert.equal(pi.metadata.product_type, 'egyeni');
    assert.equal(pi.metadata.variant_id, 'general');
    assert.equal(pi.metadata.gift_context, 'general');
    assert.equal(pi.metadata.relationship, undefined, 'ervenytelen azonosito kimarad');
    assert.equal(pi.metadata.utm_source, 'meta');
    assert.equal(pi.metadata.fbclid, 'fb-1');
    assert.equal(pi.metadata.nev, 'Teszt Elek');
    assert.equal(pi.metadata.iranyitoszam, '1023');
    assert.equal(pi.metadata.varos, 'Budapest');
    assert.equal(pi.metadata.cim, 'Bécsi út 2.');
    assert.equal(pi.metadata.kartya_cim, 'Egyéni MOSAIC Head Spa ajándékkártya');
    assert.equal(pi.metadata.ceges_nev, undefined, 'ures ertek kihagyva');
    for (const v of Object.values(pi.metadata)) assert.ok(v.length <= 500);
    const keres = mock.allapot.keresek.filter((k) => k.path === '/v1/payment_intents').at(-1);
    assert.equal(keres.idem, 'ah-' + torzs.kulcs);
    assert.ok(keres.verzio, 'Stripe-Version fejlec');
  });

  test('minden termek ara a configbol, x100, 100-zal oszthato; ceges adatok a metadataban', async () => {
    for (const [id, t] of Object.entries(ADAT.TERMEKEK)) {
      const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ termek: id, ceges: { nev: 'Minta Kft.', adoszam: '12345678-1-42' } }) });
      assert.equal(r.status, 200, id);
      const pi = mock.allapot.pi(r.adat.pi);
      assert.equal(pi.amount, t.ar_ft * 100, id);
      assert.equal(pi.amount % 100, 0);
      assert.equal(r.adat.osszeg, t.ar_ft);
      assert.equal(pi.metadata.ceges_nev, 'Minta Kft.');
      assert.equal(pi.metadata.ceges_adoszam, '12345678-1-42');
    }
  });

  test('variant_id: __proto__ / constructor / nagybetus -> general', async () => {
    for (const v of ['__proto__', 'constructor', 'GENERAL', '']) {
      const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ attr: { variant_id: v } }) });
      assert.equal(mock.allapot.pi(r.adat.pi).metadata.variant_id, 'general', v);
    }
    const r = await hiv('POST', 'fizetes', { body: rendelesTorzs({ attr: null }) });
    assert.equal(r.status, 200);
    assert.equal(mock.allapot.pi(r.adat.pi).metadata.variant_id, 'general');
  });

  test('ugyanazzal a kulcs-csal idempotens (ugyanaz a PI, nem jon letre masodik)', async () => {
    const torzs = rendelesTorzs();
    const a = await hiv('POST', 'fizetes', { body: torzs });
    const elotte = mock.allapot.pik.size;
    const b = await hiv('POST', 'fizetes', { body: torzs });
    assert.equal(b.status, 200);
    assert.equal(b.adat.pi, a.adat.pi);
    assert.equal(b.adat.client_secret, a.adat.client_secret);
    assert.equal(mock.allapot.pik.size, elotte);
  });

  test('ugyanaz a kulcs mas termekkel pi/cs nelkul -> nem hiba, uj PI a helyes arral', async () => {
    const kulcs = 'k-' + crypto.randomUUID();
    const a = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs }) });
    const b = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: 'paros' }) });
    assert.equal(b.status, 200);
    assert.notEqual(b.adat.pi, a.adat.pi);
    assert.equal(mock.allapot.pi(b.adat.pi).amount, 5380000);
  });

  test('pi+cs es requires_payment_method -> frissites ugyanazon a PI-n (termekvaltas, regi kulcsok torolve)', async () => {
    const kulcs = 'k-' + crypto.randomUUID();
    const a = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, ceges: { nev: 'Minta Kft.', adoszam: '12345678-1-42' } }) });
    assert.equal(mock.allapot.pi(a.adat.pi).metadata.ceges_nev, 'Minta Kft.');
    const elotte = mock.allapot.pik.size;
    const b = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: 'paros', email: 'masik@example.com', pi: a.adat.pi, cs: a.adat.client_secret }) });
    assert.equal(b.status, 200);
    assert.equal(b.adat.pi, a.adat.pi);
    assert.equal(b.adat.client_secret, a.adat.client_secret);
    assert.equal(b.adat.osszeg, 53800);
    assert.equal(mock.allapot.pik.size, elotte);
    const pi = mock.allapot.pi(a.adat.pi);
    assert.equal(pi.amount, 5380000);
    assert.equal(pi.receipt_email, 'masik@example.com');
    assert.equal(pi.metadata.termek, 'paros');
    assert.equal(pi.metadata.kartya_cim, 'Páros MOSAIC Head Spa ajándékkártya');
    assert.equal(pi.metadata.ceges_nev, undefined);
    assert.equal(pi.description, 'MOSAIC Head Spa ajándékkártya - Páros Head Spa');
    // sikertelen probalkozas utan (requires_payment_method + hiba) is frissitheto
    mock.allapot.bukas(a.adat.pi);
    const c = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: '4kezes', pi: a.adat.pi, cs: a.adat.client_secret }) });
    assert.equal(c.adat.pi, a.adat.pi);
    assert.equal(mock.allapot.pi(a.adat.pi).amount, 3990000);
  });

  test('rossz cs -> uj PI (a regi valtozatlan); mar kifizetett PI -> uj PI', async () => {
    const kulcs = 'k-' + crypto.randomUUID();
    const a = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs }) });
    const rossz = a.adat.pi + '_secret_hamis';
    const b = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: 'paros', pi: a.adat.pi, cs: rossz }) });
    assert.equal(b.status, 200);
    assert.notEqual(b.adat.pi, a.adat.pi);
    assert.equal(mock.allapot.pi(a.adat.pi).amount, 2690000);
    assert.equal(mock.allapot.pi(b.adat.pi).amount, 5380000);

    mock.allapot.sikeresIt(b.adat.pi);
    const c = await hiv('POST', 'fizetes', { body: rendelesTorzs({ kulcs, termek: 'paros', pi: b.adat.pi, cs: b.adat.client_secret }) });
    assert.equal(c.status, 200);
    assert.notEqual(c.adat.pi, b.adat.pi);
    assert.equal(mock.allapot.pi(c.adat.pi).status, 'requires_payment_method');
    assert.equal(mock.allapot.pi(b.adat.pi).status, 'succeeded');
  });

  test('Stripe 5xx / halozati hiba -> 502 { hiba: stripe }, stack trace nelkul', async () => {
    mock.allapot.kovetkezoHiba(500);
    const r = await hiv('POST', 'fizetes', { body: rendelesTorzs() });
    assert.equal(r.status, 502);
    assert.deepEqual(r.adat, { hiba: 'stripe' });
    const h = await hiv('POST', 'fizetes', { body: rendelesTorzs(), env: { ...ENV, STRIPE_API_BASE: 'http://127.0.0.1:1' } });
    assert.equal(h.status, 502);
    assert.deepEqual(h.adat, { hiba: 'stripe' });
    assert.doesNotMatch(h.body, /at |Error|sk_test/);
  });
});

// --- /rendeles -------------------------------------------------------------------------------------------------
describe('/rendeles', () => {
  test('rossz / hianyzo / mas PI-hez tartozo client_secret -> 403', async () => {
    const a = await ujRendeles();
    const b = await ujRendeles();
    for (const query of [
      { pi: a.pi },
      { pi: a.pi, cs: '' },
      { pi: a.pi, cs: a.pi + '_secret_rossz' },
      { pi: a.pi, cs: b.client_secret },
      { pi: 'nem-pi', cs: 'x' },
      { pi: 'pi_nincsilyenazonosito', cs: 'pi_nincsilyenazonosito_secret_x' },
    ]) {
      const r = await hiv('GET', 'rendeles', { query });
      assert.equal(r.status, 403, JSON.stringify(query));
      assert.deepEqual(r.adat, { hiba: 'tiltott' });
    }
  });

  test('idegen (nem ajandek-motor) PI -> 404', async () => {
    const v = await fetch(mock.url + '/v1/payment_intents', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + ENV.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'amount=1000000&currency=huf&metadata[forras]=fizetolink',
    });
    const idegen = await v.json();
    const r = await hiv('GET', 'rendeles', { query: { pi: idegen.id, cs: idegen.client_secret } });
    assert.equal(r.status, 404);
    assert.deepEqual(r.adat, { hiba: 'nincs' });
  });

  test('allapotok csak a Stripe-tol visszakerdezve: nyitott -> sikertelen / feldolgozas -> fizetve', async () => {
    const a = await ujRendeles({ attr: { variant_id: 'general', utm_source: 'tiktok', ttclid: 'tt-9', gclid: 'g-1', oldal: '/x' } });
    const q = { pi: a.pi, cs: a.client_secret };
    let r = await hiv('GET', 'rendeles', { query: { ...q, allapot: 'fizetve', status: 'succeeded' } });
    assert.equal(r.status, 200);
    assert.equal(r.adat.allapot, 'nyitott');
    assert.equal(r.adat.rendeles_id, a.rendeles_id);
    assert.equal(r.adat.termek, 'egyeni');
    assert.equal(r.adat.termek_nev, 'Egyéni Head Spa');
    assert.equal(r.adat.kartya_cim, 'Egyéni MOSAIC Head Spa ajándékkártya');
    assert.equal(r.adat.osszeg, 26900);
    assert.equal(r.adat.penznem, 'HUF');
    assert.equal(r.adat.email, 'vevo@example.com');
    assert.equal(r.adat.fizetesi_mod, null);
    assert.equal(r.adat.fizetve_ekkor, null);
    assert.deepEqual(Object.keys(r.adat.attr).sort(), ['fbclid', 'gclid', 'gift_context', 'occasion', 'relationship', 'ttclid', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term', 'variant_id']);
    assert.equal(r.adat.attr.utm_source, 'tiktok');
    assert.equal(r.adat.attr.ttclid, 'tt-9');
    assert.equal(r.adat.attr.utm_term, null);
    assert.deepEqual(r.adat.kartya, { allapot: 'keszul', ervenyes_ig: null });
    assert.equal(r.adat.szemelyre, null);
    assert.equal(r.headers['cache-control'], 'no-store');

    mock.allapot.bukas(a.pi);
    assert.equal((await hiv('GET', 'rendeles', { query: q })).adat.allapot, 'sikertelen');
    mock.allapot.feldolgozas(a.pi);
    assert.equal((await hiv('GET', 'rendeles', { query: q })).adat.allapot, 'feldolgozas');
    mock.allapot.sikeresIt(a.pi);
    r = await hiv('GET', 'rendeles', { query: q });
    assert.equal(r.adat.allapot, 'fizetve');
    assert.equal(r.adat.fizetesi_mod, 'card');
    assert.match(r.adat.fizetve_ekkor, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.match(r.adat.kartya.ervenyes_ig, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(r.adat.kartya.allapot, 'keszul');
    assert.equal(r.adat.kartya.kod, undefined, 'a kod csak kesz kartyanal');
    assert.equal(r.adat.kartya.url, undefined);
    assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
  });

  test('ervenyes_ig: a vasarlas BUDAPESTI napjatol 6 honap (honap vegere igazitva)', async () => {
    const eset = async (iso) => {
      const a = await ujRendeles();
      mock.allapot.sikeresIt(a.pi, { created: Math.floor(Date.parse(iso) / 1000) });
      const r = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
      assert.equal(r.adat.fizetve_ekkor, new Date(iso).toISOString());
      return r.adat.kartya.ervenyes_ig;
    };
    assert.equal(await eset('2026-10-02T22:30:00Z'), '2027-04-03'); // Budapesten mar okt. 3., 00:30
    assert.equal(await eset('2026-10-02T21:30:00Z'), '2027-04-02');
    assert.equal(await eset('2026-08-31T10:00:00Z'), '2027-02-28');
  });

  test('fizetesi_mod: apple_pay / google_pay a tarcabol, link a tipusbol', async () => {
    for (const mod of ['apple_pay', 'google_pay', 'link']) {
      const a = await fizetettRendeles({}, mod);
      const r = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
      assert.equal(r.adat.fizetesi_mod, mod);
    }
  });
});

// --- webhook ---------------------------------------------------------------------------------------------------------
describe('/webhook', () => {
  test('ervenytelen / hianyzo / lejart alairas -> 400, levelek nincsenek', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const jo = alairtEsemeny(a.pi);
    assert.equal((await hiv('POST', 'webhook', { body: jo.torzs })).status, 400);
    assert.equal((await webhook({ torzs: jo.torzs, fejlec: jo.fejlec.replace(/v1=./, 'v1=0') })).status, 400);
    assert.equal((await webhook({ torzs: jo.torzs + ' ', fejlec: jo.fejlec })).status, 400);
    assert.equal((await webhook(alairtEsemeny(a.pi, { titok: 'whsec_mas' }))).status, 400);
    const regi = alairtEsemeny(a.pi, { ts: Math.floor(Date.now() / 1000) - 301 });
    const r = await webhook(regi);
    assert.equal(r.status, 400);
    assert.deepEqual(r.adat, { hiba: 'alairas' });
    // a "most" parameterrel a tolerancian belul mar jo
    assert.equal((await webhook(regi, { most: new Date(Date.now() - 200 * 1000) })).status, 200);
    assert.equal(levelek.length, 2);
    levelek = [];
    assert.equal((await hiv('POST', 'webhook', { body: jo.torzs, headers: { 'stripe-signature': jo.fejlec }, env: { ...ENV, STRIPE_WEBHOOK_SECRET: '' } })).status, 503);
    assert.equal(levelek.length, 0);
  });

  test('payment_intent.succeeded -> pontosan EGY szalon- es EGY vevo-level, ketszeri kezbesitesnel is', async () => {
    const a = await fizetettRendeles({ termek: '4kezes', ceges: { nev: 'Minta & Társa Kft.', adoszam: '12345678-1-42' } }, 'apple_pay');
    levelek = [];
    const e = alairtEsemeny(a.pi);
    const r1 = await webhook(e);
    assert.equal(r1.status, 200);
    assert.deepEqual(r1.adat, { ok: true });
    const r2 = await webhook(e);
    assert.equal(r2.status, 200);
    assert.equal((await webhook(alairtEsemeny(a.pi))).status, 200); // uj esemeny-azonosito, ugyanaz a PI
    assert.equal(levelek.length, 2);
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    assert.ok(szalon && vevo);

    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.ertesites, '1');
    const kod = await kuponKod(ENV, a.pi);
    assert.equal(pi.metadata.kod, kod);
    assert.equal(kod, vartKod(ENV.AJANDEK_TITOK, a.pi));

    assert.equal(szalon.targy, `Új ajándékkártya-rendelés (fizetve) – ${a.rendeles_id}`);
    assert.equal(szalon.valasz, 'vevo@example.com');
    assert.ok(szalon.html.includes(kod));
    assert.ok(szalon.html.includes('39.900 Ft'));
    assert.ok(szalon.html.includes('4 kezes Head Spa'));
    assert.ok(szalon.html.includes('Minta &amp; Társa Kft.'));
    assert.ok(szalon.html.includes('12345678-1-42'));
    assert.ok(szalon.html.includes('1023 Budapest, Bécsi út 2.'));
    assert.ok(szalon.html.includes('Apple Pay'));
    assert.match(szalon.html, /Salonicban hozd létre a kuponkódot/);
    assert.match(szalon.html, /100% kedvezmény/);
    const token = await kiallitToken(ENV, a.pi);
    assert.ok(szalon.html.includes(`${BAZIS}/api/ajandek/kiallit?pi=${a.pi}&amp;t=${token}`));

    assert.equal(vevo.targy, `Megkaptuk a fizetésed – MOSAIC ajándékkártya (${a.rendeles_id})`);
    assert.equal(vevo.valasz, 'szalon');
    assert.ok(vevo.html.includes(a.rendeles_id));
    assert.ok(vevo.html.includes('39.900 Ft'));
    assert.match(vevo.html, /elkészítésén dolgozunk; amint kész, e-mailben küldjük/);
    assert.ok(vevo.html.includes(`${BAZIS}/ajandek?payment_intent=${a.pi}&amp;payment_intent_client_secret=${a.client_secret}&amp;redirect_status=succeeded`));
    assert.ok(!vevo.html.includes(kod), 'a kod meg nem megy ki a vevonek');
    for (const l of levelek) assert.doesNotMatch(l.html, /perceken belül|azonnal/i);
  });

  test('idegen PI, mas esemenytipus, vagy a Stripe szerint meg nem sikeres PI -> 200, de nincs level', async () => {
    levelek = [];
    const v = await fetch(mock.url + '/v1/payment_intents', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + ENV.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'amount=1000000&currency=huf',
    });
    const idegen = await v.json();
    mock.allapot.sikeresIt(idegen.id);
    assert.equal((await webhook(alairtEsemeny(idegen.id))).status, 200);
    // az esemeny hazudik (forras), de a Stripe-tol visszakerdezett PI nem a miénk
    assert.equal((await webhook(alairtEsemeny(idegen.id, { metadata: { forras: 'ajandek-motor' } }))).status, 200);
    assert.equal(mock.allapot.pi(idegen.id).metadata.ertesites, undefined);

    const a = await fizetettRendeles();
    assert.equal((await webhook(alairtEsemeny(a.pi, { tipus: 'payment_intent.created' }))).status, 200);
    assert.equal((await webhook(alairtEsemeny(a.pi, { tipus: 'charge.refunded' }))).status, 200);
    const nyitott = await ujRendeles();
    assert.equal((await webhook(alairtEsemeny(nyitott.pi))).status, 200);
    assert.equal(levelek.length, 0);
  });

  test('levelkuldesi hiba -> nem 2xx (a Stripe ujraprobalja), es ujraprobalaskor csak a hianyzo level megy ki', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const e = alairtEsemeny(a.pi);
    const r1 = await webhook(e, { kuld: async (l) => { if (l.cimzett !== 'szalon') throw new Error('SMTP le'); levelek.push(l); } });
    assert.equal(r1.status, 500);
    assert.equal(mock.allapot.pi(a.pi).metadata.ertesites, 'szalon');
    const r2 = await webhook(e);
    assert.equal(r2.status, 200);
    assert.deepEqual(levelek.map((l) => l.cimzett), ['szalon', 'vevo@example.com']);
    assert.equal(mock.allapot.pi(a.pi).metadata.ertesites, '1');
    // levelkuldo nelkul (pl. nincs SMTP) sem "nyel el" semmit
    const b = await fizetettRendeles();
    const r3 = await webhook(alairtEsemeny(b.pi), { kuld: async () => { throw new Error('nincs SMTP-beallitas'); } });
    assert.equal(r3.status, 500);
    assert.equal(mock.allapot.pi(b.pi).metadata.ertesites, undefined);
  });

  test('AJANDEK_AZONNALI=1: a webhook kiallitja a kartyat, a vevo-levelben mar a kartya linkje es a kod van', async () => {
    const env = { ...ENV, AJANDEK_AZONNALI: '1' };
    const a = await fizetettRendeles();
    levelek = [];
    assert.equal((await webhook(alairtEsemeny(a.pi), { env })).status, 200);
    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.kartya_kesz, '1');
    assert.ok(pi.metadata.kartya_kiallitva_ekkor);
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    const kod = await kuponKod(env, a.pi);
    assert.ok(vevo.html.includes(`${BAZIS}/api/ajandek/kartya?pi=${a.pi}&amp;t=${await kartyaToken(env, a.pi)}`));
    assert.ok(!vevo.html.includes(a.client_secret), 'a tovabbithato kartya-linkben nincs client_secret');
    assert.ok(vevo.html.includes(kod));
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.match(szalon.html, /már megkapta/);
    for (const l of levelek) assert.doesNotMatch(l.html, /perceken belül|azonnal/i);
    const r = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret }, env });
    assert.equal(r.adat.kartya.allapot, 'kesz');
    assert.equal(r.adat.kartya.kod, kod);
  });
});

// --- /kiallit es /kartya ------------------------------------------------------------------------------------------------
// a megerosito oldal urlapja: application/x-www-form-urlencoded POST ugyanarra az utra
const kiallitPost = (pi, t, opciok = {}) => hiv('POST', 'kiallit', {
  body: new URLSearchParams({ pi, t }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, ...opciok,
});
const rosszTokenek = async (piId, jo) => ['', 'abc', jo.replace(/^./, (c) => (c === '0' ? '1' : '0')), await kiallitToken(ENV, 'pi_masikazonosito123')];

describe('/kiallit', () => {
  test('GET: hibas token 403; nem fizetett 409; jo token -> csak megerosito oldal (POST-urlap), NEM allit ki es NEM kuld levelet', async () => {
    const a = await fizetettRendeles();
    const token = await kiallitToken(ENV, a.pi);
    levelek = [];
    for (const t of await rosszTokenek(a.pi, token)) {
      const r = await hiv('GET', 'kiallit', { query: { pi: a.pi, t } });
      assert.equal(r.status, 403, t);
      assert.match(r.headers['content-type'], /^text\/html; charset=utf-8/);
      assert.doesNotMatch(r.body, /<form/);
    }
    const nyitott = await ujRendeles();
    assert.equal((await hiv('GET', 'kiallit', { query: { pi: nyitott.pi, t: await kiallitToken(ENV, nyitott.pi) } })).status, 409);

    const metaElotte = mock.allapot.pi(a.pi).metadata;
    for (let i = 0; i < 3; i++) { // pl. levelszkenner + linkelonezet + a szalon kattintasa
      const r = await hiv('GET', 'kiallit', { query: { pi: a.pi, t: token } });
      assert.equal(r.status, 200);
      assert.match(r.body, /Kiállítod az ajándékkártyát\?/);
      assert.match(r.body, /<form method="post" action="\/api\/ajandek\/kiallit">/);
      assert.ok(r.body.includes(`<input type="hidden" name="pi" value="${a.pi}">`));
      assert.ok(r.body.includes(`<input type="hidden" name="t" value="${token}">`));
      assert.ok(r.body.includes('Igen, a kuponkódot létrehoztam a Salonicban – kiküldjük a kártyát'));
      assert.ok(r.body.includes(await kuponKod(ENV, a.pi)));
      assert.ok(r.body.includes('vevo@example.com'));
      assert.ok(r.body.includes(a.rendeles_id));
      assert.match(r.headers['content-security-policy'], /form-action 'self'/);
    }
    assert.deepEqual(mock.allapot.pi(a.pi).metadata, metaElotte, 'a GET nem modosit');
    assert.equal(levelek.length, 0, 'a GET nem kuld levelet');
  });

  test('POST: hibas token 403; jo token -> kartya_kesz=1 + vevo-level a kartya linkjevel; ketszer sem kuld ketszer', async () => {
    const a = await fizetettRendeles();
    const token = await kiallitToken(ENV, a.pi);
    levelek = [];
    for (const t of await rosszTokenek(a.pi, token)) {
      const r = await kiallitPost(a.pi, t);
      assert.equal(r.status, 403, t);
    }
    assert.equal((await hiv('POST', 'kiallit', { body: 'nem urlap', headers: { 'content-type': 'application/json' } })).status, 403);
    assert.equal(mock.allapot.pi(a.pi).metadata.kartya_kesz, undefined);
    assert.equal(levelek.length, 0);

    const most = new Date('2026-10-03T12:00:00Z');
    const r = await kiallitPost(a.pi, token, { most });
    assert.equal(r.status, 200);
    assert.match(r.body, /Kiállítva, a vevő megkapta a levelet/);
    assert.match(r.headers['content-security-policy'], /form-action 'none'/);
    const pi = mock.allapot.pi(a.pi);
    assert.equal(pi.metadata.kartya_kesz, '1');
    assert.equal(pi.metadata.kartya_kiallitva_ekkor, most.toISOString());
    assert.equal(levelek.length, 1);
    const l = levelek[0];
    assert.equal(l.cimzett, 'vevo@example.com');
    assert.equal(l.valasz, 'szalon');
    const kod = await kuponKod(ENV, a.pi);
    const kt = await kartyaToken(ENV, a.pi);
    assert.ok(l.html.includes(`${BAZIS}/api/ajandek/kartya?pi=${a.pi}&amp;t=${kt}`));
    assert.ok(!l.html.includes(a.client_secret), 'a tovabbithato kartya-linkben nincs client_secret');
    assert.ok(l.html.includes(kod));
    assert.doesNotMatch(l.html, /perceken belül|azonnal/i);

    const r2 = await kiallitPost(a.pi, token);
    assert.equal(r2.status, 200);
    assert.match(r2.body, /már ki van állítva/);
    assert.equal(levelek.length, 1);
    // kiallitas utan a GET is csak a "mar kiallitva" oldalt adja, gomb nelkul
    const g = await hiv('GET', 'kiallit', { query: { pi: a.pi, t: token } });
    assert.equal(g.status, 200);
    assert.match(g.body, /már ki van állítva/);
    assert.doesNotMatch(g.body, /<form/);
    assert.match(g.headers['content-security-policy'], /form-action 'none'/);
    assert.equal(levelek.length, 1);

    const rr = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
    assert.equal(rr.adat.kartya.allapot, 'kesz');
    assert.equal(rr.adat.kartya.kod, kod);
    assert.match(rr.adat.kartya.kod, KOD_RE);
    assert.equal(rr.adat.kartya.url, `${BAZIS}/api/ajandek/kartya?pi=${a.pi}&t=${kt}`);
    assert.doesNotMatch(rr.adat.kartya.url, /cs=|_secret_/);
  });

  test('POST JSON-nal is mukodik; nem fizetett PI -> 409', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const r = await hiv('POST', 'kiallit', { body: { pi: a.pi, t: await kiallitToken(ENV, a.pi) } });
    assert.equal(r.status, 200);
    assert.equal(mock.allapot.pi(a.pi).metadata.kartya_kesz, '1');
    assert.equal(levelek.length, 1);
    const nyitott = await ujRendeles();
    assert.equal((await kiallitPost(nyitott.pi, await kiallitToken(ENV, nyitott.pi))).status, 409);
    assert.equal(levelek.length, 1);
  });

  test('levelkuldesi hiba eseten nem allitja kesznek (a szalon ujraprobalhatja)', async () => {
    const a = await fizetettRendeles();
    const t = await kiallitToken(ENV, a.pi);
    const r = await kiallitPost(a.pi, t, { kuld: async () => { throw new Error('SMTP le'); } });
    assert.equal(r.status, 502);
    assert.equal(mock.allapot.pi(a.pi).metadata.kartya_kesz, undefined);
  });
});

describe('/szemelyre', () => {
  test('nem fizetett PI -> 409; rossz cs -> 403', async () => {
    const a = await ujRendeles();
    let r = await hiv('POST', 'szemelyre', { body: { pi: a.pi, cs: a.client_secret, nev: 'Anna' } });
    assert.equal(r.status, 409);
    r = await hiv('POST', 'szemelyre', { body: { pi: a.pi, cs: a.pi + '_secret_x', nev: 'Anna' } });
    assert.equal(r.status, 403);
  });

  test('validacio: nev<=80, uzenet<=300, alkalom/atadas csak a listabol', async () => {
    const a = await fizetettRendeles();
    const alap = { pi: a.pi, cs: a.client_secret };
    for (const [mezo, ertek] of [['nev', 'x'.repeat(81)], ['uzenet', 'y'.repeat(301)], ['alkalom', 'hapci'], ['alkalom', '__proto__'], ['atadas', 'galamb'], ['atadas', 'constructor']]) {
      const r = await hiv('POST', 'szemelyre', { body: { ...alap, [mezo]: ertek } });
      assert.equal(r.status, 400, mezo + '=' + ertek);
      assert.ok(r.adat.mezok[mezo]);
    }
    assert.equal(mock.allapot.pi(a.pi).metadata.szemelyre_nev, undefined);
  });

  test('fizetett PI-n ment, a valasz a /rendeles formaja; fizikai atadasnal szalon-ertesito (modositaskor ujra)', async () => {
    const a = await fizetettRendeles();
    levelek = [];
    const alap = { pi: a.pi, cs: a.client_secret };
    let r = await hiv('POST', 'szemelyre', { body: { ...alap, nev: '  Kiss  Anna ', uzenet: 'Boldog\r\nszülinapot!\u0007', alkalom: 'szuletesnap', atadas: 'digitalis' } });
    assert.equal(r.status, 200);
    assert.equal(r.adat.allapot, 'fizetve');
    assert.deepEqual(r.adat.szemelyre, { nev: 'Kiss Anna', uzenet: 'Boldog\nszülinapot!', alkalom: 'szuletesnap', atadas: 'digitalis' });
    assert.equal(levelek.length, 0);
    const md = mock.allapot.pi(a.pi).metadata;
    assert.equal(md.szemelyre_nev, 'Kiss Anna');
    assert.equal(md.szemelyre_alkalom, 'szuletesnap');

    r = await hiv('POST', 'szemelyre', { body: { ...alap, nev: 'Kiss Anna', uzenet: 'Boldog\nszülinapot!', alkalom: 'szuletesnap', atadas: 'fizikai' } });
    assert.equal(r.status, 200);
    assert.equal(levelek.length, 1);
    assert.equal(levelek[0].cimzett, 'szalon');
    assert.match(levelek[0].targy, /^Fizikai ajándékkártyát kértek – /);
    assert.ok(levelek[0].html.includes('Kiss Anna'));
    assert.ok(levelek[0].html.includes(await kuponKod(ENV, a.pi)));
    // ugyanaz megint: nincs uj level
    await hiv('POST', 'szemelyre', { body: { ...alap, nev: 'Kiss Anna', uzenet: 'Boldog\nszülinapot!', alkalom: 'szuletesnap', atadas: 'fizikai' } });
    assert.equal(levelek.length, 1);
    // modositott nev: a szalon ujra ertesul
    await hiv('POST', 'szemelyre', { body: { ...alap, nev: 'Kiss Anikó', uzenet: 'Boldog\nszülinapot!', alkalom: 'szuletesnap', atadas: 'fizikai' } });
    assert.equal(levelek.length, 2);
    assert.match(levelek[1].targy, /^Módosult/);
    // torles: ures mezok -> szemelyre null
    r = await hiv('POST', 'szemelyre', { body: { ...alap, nev: '', uzenet: '', alkalom: '', atadas: '' } });
    assert.equal(r.adat.szemelyre, null);
  });
});

describe('/kartya', () => {
  test('kesz allapotig 409 barati HTML (frissitessel); rossz cs -> 403 HTML', async () => {
    const nyitott = await ujRendeles();
    let r = await hiv('GET', 'kartya', { query: { pi: nyitott.pi, cs: nyitott.client_secret } });
    assert.equal(r.status, 409);
    const a = await fizetettRendeles();
    r = await hiv('GET', 'kartya', { query: { pi: a.pi, cs: a.client_secret } });
    assert.equal(r.status, 409);
    assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.match(r.body, /Készítjük az ajándékkártyádat…/);
    assert.match(r.body, /<meta http-equiv="refresh" content="20">/);
    assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    r = await hiv('GET', 'kartya', { query: { pi: a.pi, cs: a.pi + '_secret_x' } });
    assert.equal(r.status, 403);
    assert.match(r.headers['content-type'], /text\/html/);
  });

  test('kartya-token (t): kesz allapotban 200 cs nelkul; rossz / mas celu token 403; nem-kesz allapotban sincs kod; /rendeles es /szemelyre nem fogadja el', async () => {
    const a = await fizetettRendeles();
    const t = await kartyaToken(ENV, a.pi);
    // nem-kesz allapotban a token sem adja ki a kodot
    let r = await hiv('GET', 'kartya', { query: { pi: a.pi, t } });
    assert.equal(r.status, 409);
    assert.match(r.body, /Készítjük az ajándékkártyádat…/);
    assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    // rossz token, masik PI tokenje, a kiallito token, nagybetus hamis, hianyzo pi
    const masik = await fizetettRendeles();
    for (const query of [
      { pi: a.pi, t: t.replace(/^./, (c) => (c === '0' ? '1' : '0')) },
      { pi: a.pi, t: await kartyaToken(ENV, masik.pi) },
      { pi: a.pi, t: await kiallitToken(ENV, a.pi) },
      { pi: a.pi, t: 'abc' },
      { pi: masik.pi, t },
      { t },
    ]) {
      r = await hiv('GET', 'kartya', { query });
      assert.equal(r.status, 403, JSON.stringify(query));
      assert.doesNotMatch(r.body, /AK-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    }
    assert.equal((await kiallitPost(a.pi, await kiallitToken(ENV, a.pi))).status, 200);
    r = await hiv('GET', 'kartya', { query: { pi: a.pi, t } });
    assert.equal(r.status, 200);
    assert.ok(r.body.includes(await kuponKod(ENV, a.pi)));
    assert.ok(!r.body.includes(a.client_secret));
    assert.ok(!r.body.includes('vevo@example.com'), 'a kartya-oldal nem mutatja a vevo e-mailjet');
    // nagybetus hex is ugyanaz a token
    assert.equal((await hiv('GET', 'kartya', { query: { pi: a.pi, t: t.toUpperCase() } })).status, 200);
    // a regi pi+cs format tovabbra is mukodik, ugyanazt az oldalt adja
    const regi = await hiv('GET', 'kartya', { query: { pi: a.pi, cs: a.client_secret } });
    assert.equal(regi.status, 200);
    assert.equal(regi.body, r.body);
    // a kartya-token NEM hitelesit a /rendeles-hez es a /szemelyre-hez
    for (const query of [{ pi: a.pi, t }, { pi: a.pi, cs: t }, { pi: a.pi, t, cs: '' }]) {
      const rr = await hiv('GET', 'rendeles', { query });
      assert.equal(rr.status, 403, JSON.stringify(query));
      assert.deepEqual(rr.adat, { hiba: 'tiltott' });
    }
    for (const body of [{ pi: a.pi, t, nev: 'Betolakodo' }, { pi: a.pi, cs: t, nev: 'Betolakodo' }]) {
      const sz = await hiv('POST', 'szemelyre', { body });
      assert.equal(sz.status, 403);
    }
    assert.equal(mock.allapot.pi(a.pi).metadata.szemelyre_nev, undefined);
    // a /rendeles valasza valtozatlan alaku: kartya.kod + kartya.url (a t-s link)
    const rr = await hiv('GET', 'rendeles', { query: { pi: a.pi, cs: a.client_secret } });
    assert.deepEqual(Object.keys(rr.adat.kartya).sort(), ['allapot', 'ervenyes_ig', 'kod', 'url']);
    assert.equal(rr.adat.kartya.url, `${BAZIS}/api/ajandek/kartya?pi=${a.pi}&t=${t}`);
  });

  test('kesz kartya: 200 nyomtathato HTML a koddal, a szemelyre szabassal, escape-elve (XSS-proba)', async () => {
    const a = await fizetettRendeles({ termek: 'paros' });
    const alap = { pi: a.pi, cs: a.client_secret };
    const xssNev = '"><img src=x onerror=alert(1)>';
    const xssUzenet = '<script>alert("x")</script>\nSzeretettel & puszi \'<b>\'';
    let r = await hiv('POST', 'szemelyre', { body: { ...alap, nev: xssNev, uzenet: xssUzenet, alkalom: 'szuletesnap', atadas: 'nyomtatott' } });
    assert.equal(r.status, 200);
    assert.equal((await kiallitPost(a.pi, await kiallitToken(ENV, a.pi))).status, 200);
    r = await hiv('GET', 'kartya', { query: { pi: a.pi, t: await kartyaToken(ENV, a.pi) } });
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.match(r.headers['content-security-policy'], /default-src 'none'/);
    assert.match(r.headers['content-security-policy'], /form-action 'none'/);
    assert.match(r.headers['content-security-policy'], /script-src 'sha256-[A-Za-z0-9+/=]+'/);
    const h = r.body;
    const kod = await kuponKod(ENV, a.pi);
    assert.ok(h.includes(kod));
    assert.ok(h.includes('MOSAIC Head Spa ajándékkártya'));
    assert.ok(h.includes('Páros MOSAIC Head Spa ajándékkártya'));
    assert.ok(h.includes('Születésnap'));
    assert.ok(h.includes('6 hónapig felhasználható'));
    assert.ok(h.includes('https://www.mosaicheadspa.hu/idpontfoglalas'));
    assert.ok(h.includes('kuponkód mezőbe írhatod be a kódot'));
    assert.ok(h.includes(`${BAZIS}/assets/img/logo-143x54@2x.png`));
    assert.ok(h.includes('Nyomtatás / Mentés PDF-ként'));
    assert.match(h, /@media print\{[^}]*\{[^}]*\}[^]*\.nem-nyomtat\{display:none!important\}/);
    assert.ok(h.includes('1023 Budapest, Bécsi út 2.'));
    assert.ok(h.includes('06 20 247 4444'));
    // XSS: a nyers jelolok nem kerulhetnek az oldalba
    assert.ok(!h.includes('<img src=x'));
    assert.ok(!h.includes('<script>alert'));
    assert.ok(!h.includes("'<b>'"));
    assert.ok(h.includes('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(h.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
    assert.ok(h.includes('Szeretettel &amp; puszi &#39;&lt;b&gt;&#39;'));
    // pontosan egy <script> (a nyomtatogomb), es annak hash-e szerepel a CSP-ben
    assert.equal(h.match(/<script>/g).length, 1);
    const js = /<script>([^<]*)<\/script>/.exec(h)[1];
    const hash = crypto.createHash('sha256').update(js).digest('base64');
    assert.ok(r.headers['content-security-policy'].includes(`'sha256-${hash}'`));
    // ervenyesseg: a vasarlas napjatol 6 honap
    const rr = await hiv('GET', 'rendeles', { query: alap });
    const [ev, ho, nap] = rr.adat.kartya.ervenyes_ig.split('-').map(Number);
    const honapok = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
    assert.ok(h.includes(`${ev}. ${honapok[ho - 1]} ${nap}-ig`));
  });
});

// --- /atutalas ---------------------------------------------------------------------------------------------------------
describe('/atutalas', () => {
  test('levelek a vevonek es a szalonnak, a valaszban az utalasi adatok, NEM hoz letre PI-t', async () => {
    levelek = [];
    const keresekElotte = mock.allapot.keresek.length;
    const torzs = rendelesTorzs({ termek: '4kezes', megajandekozott: 'Nagy Mária', osszeg: 1 });
    delete torzs.kulcs;
    const r = await hiv('POST', 'atutalas', { body: torzs });
    assert.equal(r.status, 200);
    assert.equal(r.adat.ok, true);
    assert.equal(r.adat.osszeg, 39900);
    assert.match(r.adat.rendeles_ref, /^ATU-[A-Z0-9]{6}$/);
    assert.deepEqual(r.adat.utalas, {
      kedvezmenyezett: ADAT.BANK.kedvezmenyezett, szamlaszam: ADAT.BANK.szamlaszam, osszeg_ft: 39900,
      kozlemeny: `${r.adat.rendeles_ref} Nagy Mária`,
    });
    assert.equal(mock.allapot.keresek.length, keresekElotte, 'nincs Stripe-hivas');
    assert.equal(levelek.length, 2);
    const vevo = levelek.find((l) => l.cimzett === 'vevo@example.com');
    const szalon = levelek.find((l) => l.cimzett === 'szalon');
    assert.ok(vevo && szalon);
    assert.equal(vevo.valasz, 'szalon');
    assert.equal(szalon.valasz, 'vevo@example.com');
    assert.ok(vevo.html.includes('39.900 Ft'));
    assert.ok(!vevo.html.includes('26.900 Ft') && !vevo.html.includes('53.800 Ft'), 'csak a valasztott termek ara');
    assert.ok(vevo.html.includes(ADAT.BANK.szamlaszam));
    assert.ok(vevo.html.includes(`${r.adat.rendeles_ref} Nagy Mária`));
    assert.match(szalon.targy, /^Új ajándékkártya-igény \(átutalás, még nincs kifizetve\)/);
    assert.ok(szalon.html.includes(r.adat.rendeles_ref));
    assert.ok(szalon.html.includes('4 kezes Head Spa'));
  });

  test('validacio 400; robotcsapda -> 200 levelek nelkul; szalon-level hibaja -> 502', async () => {
    levelek = [];
    let r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ email: 'rossz', termek: 'x', megajandekozott: 'n'.repeat(81) }) });
    assert.equal(r.status, 400);
    assert.ok(r.adat.mezok.email && r.adat.mezok.termek && r.adat.mezok.megajandekozott);
    r = await hiv('POST', 'atutalas', { body: rendelesTorzs({ 'bot-field': 'x' }) });
    assert.equal(r.status, 200);
    assert.equal(levelek.length, 0);
    r = await hiv('POST', 'atutalas', { body: rendelesTorzs(), kuld: async () => { throw new Error('SMTP le'); } });
    assert.equal(r.status, 502);
  });
});

// --- kuponkod ------------------------------------------------------------------------------------------------------------------
describe('kuponkod', () => {
  test('determinisztikus, AK-XXXX-XXXX Crockford, AJANDEK_TITOK nelkul a titkos kulcs SHA-256-jabol', async () => {
    const k1 = await kuponKod(ENV, 'pi_3UMSqdTesztAzonosito');
    assert.equal(k1, await kuponKod(ENV, 'pi_3UMSqdTesztAzonosito'));
    assert.match(k1, KOD_RE);
    assert.equal(k1, vartKod('teszt-titok', 'pi_3UMSqdTesztAzonosito'));
    assert.notEqual(k1, await kuponKod(ENV, 'pi_3UMSqdMasikAzonosito'));
    const env2 = { STRIPE_SECRET_KEY: 'sk_test_mock_123' };
    const titok2 = crypto.createHash('sha256').update('sk_test_mock_123').digest();
    assert.equal(await kuponKod(env2, 'pi_3UMSqdTesztAzonosito'), vartKod(titok2, 'pi_3UMSqdTesztAzonosito'));
    for (let i = 0; i < 200; i++) assert.match(await kuponKod(ENV, 'pi_' + i.toString(36).padStart(10, 'x')), KOD_RE);
  });
});
