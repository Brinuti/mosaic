// A Cloudflare Pages-fuggveny (functions/[[path]].js) koszonooldal-naplozasanak tesztje: a regi ajandekkartya-koszonooldal
// (/success-ajandekkartya-stripe?session_id=pi_...) betoltese a PaymentIntent metadataba kerul (koszono_ekkor), a valaszt nem lassitja.
//   node --test tools/ajandek-teszt/koszono-naplo.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import crypto from 'node:crypto';
import { mockStripeInditas } from './mock-stripe.mjs';

register('./csonk-hook.mjs', import.meta.url);

let mock;
let ENV;
let fuggveny;
const TITOK = 'koszono-titok-koszono-titok-koszono-titok';

before(async () => {
  mock = await mockStripeInditas();
  ENV = {
    STRIPE_SECRET_KEY: 'sk_test_mock_koszono', STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_koszono', STRIPE_WEBHOOK_SECRET: 'whsec_koszono',
    STRIPE_API_BASE: mock.url, AJANDEK_TITOK: TITOK,
  };
  fuggveny = await import(new URL('../../functions/[[path]].js', import.meta.url).href);
});
after(async () => { await mock.bezar(); });

const rendeles = () => ({
  termek: 'egyeni', email: 'vevo@example.com', ajandekozott: 'Kiss Anna', nev: 'Teszt Elek', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.',
  attr: { variant_id: 'general' }, mer: { ana: true, adv: false }, kulcs: 'k-' + crypto.randomUUID(),
});

async function fizetettPi() {
  const { ajandekKezel } = await import('../../netlify/lib/ajandek.js');
  const v = await ajandekKezel({
    method: 'POST', url: 'https://teszt.mosaicheadspa.hu/api/ajandek/fizetes', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.1.1.1' },
    text: JSON.stringify(rendeles()), env: ENV, kuld: async () => {},
  });
  assert.equal(v.status, 200, v.body);
  const pi = JSON.parse(v.body).pi;
  mock.allapot.sikeresIt(pi);
  return pi;
}

// a Pages-kornyezet utanzata: ASSETS.fetch (a lap fajlja), waitUntil (a hatterben futo munka)
function kontextus(url, { method = 'GET', headers = {}, env = ENV } = {}) {
  const hatter = [];
  const hivasok = [];
  const context = {
    request: new Request(url, { method, headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0)', 'cf-connecting-ip': '10.' + crypto.randomInt(256) + '.' + crypto.randomInt(256) + '.1', ...headers } }),
    env: { ...env, ASSETS: { fetch: async (u) => { hivasok.push(String(u)); return new Response('<html>koszono</html>', { status: 200, headers: { 'content-type': 'text/html' } }); } } },
    waitUntil: (p) => { hatter.push(p); },
    next: async () => new Response('next', { status: 404 }),
  };
  return { context, hatter, hivasok };
}

test('a koszonooldal betoltese (keretben) a rendeles metadataba kerul, a valasz az oldal maga', async () => {
  const pi = await fizetettPi();
  const { context, hatter, hivasok } = kontextus(`https://www.mosaicheadspa.hu/success-ajandekkartya-stripe?ertek=26900&session_id=${pi}`, { headers: { 'sec-fetch-dest': 'iframe' } });
  const v = await fuggveny.onRequest(context);
  assert.equal(v.status, 200);
  assert.equal(await v.text(), '<html>koszono</html>');
  assert.equal(hivasok.length, 1, 'az oldal fajlja kiszolgalva');
  assert.equal(hatter.length, 1, 'a naplozas a hatterben fut (waitUntil)');
  await Promise.all(hatter);
  const md = mock.allapot.pi(pi).metadata;
  assert.match(md.koszono_ekkor, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(md.koszono_keret, 'keret');
});

test('kozvetlen oldalbetoltes (nem keret): keret = oldal; a masodik betoltes nem ir felul', async () => {
  const pi = await fizetettPi();
  const url = `https://www.mosaicheadspa.hu/success-ajandekkartya-stripe?ertek=26900&session_id=${pi}`;
  let k = kontextus(url, { headers: { 'sec-fetch-dest': 'document' } });
  await fuggveny.onRequest(k.context);
  await Promise.all(k.hatter);
  const elso = { ...mock.allapot.pi(pi).metadata };
  assert.equal(elso.koszono_keret, 'oldal');
  k = kontextus(url, { headers: { 'sec-fetch-dest': 'iframe' } });
  await fuggveny.onRequest(k.context);
  await Promise.all(k.hatter);
  assert.deepEqual(mock.allapot.pi(pi).metadata, elso);
});

test('nem naplozunk: mas oldal, POST, hianyzo / nem PI azonosito (regi fizetolinkes cs_...), HEAD', async () => {
  const pi = await fizetettPi();
  const esetek = [
    ['https://www.mosaicheadspa.hu/headspa-budapest?session_id=' + pi, 'GET'],
    ['https://www.mosaicheadspa.hu/success-ajandekkartya-stripe?ertek=26900', 'GET'],
    ['https://www.mosaicheadspa.hu/success-ajandekkartya-stripe?session_id=cs_live_abc123', 'GET'],
    ['https://www.mosaicheadspa.hu/success-ajandekkartya-stripe?session_id=', 'GET'],
    ['https://www.mosaicheadspa.hu/success-ajandekkartya-stripe?session_id=' + pi, 'HEAD'],
  ];
  for (const [url, method] of esetek) {
    const k = kontextus(url, { method });
    await fuggveny.onRequest(k.context);
    assert.equal(k.hatter.length, 0, method + ' ' + url + ': nincs hatterben futo naplozas');
  }
  assert.equal(mock.allapot.pi(pi).metadata.koszono_ekkor, undefined);
});

test('a naplozas hibaja (Stripe nem elerheto) nem torik el az oldalt', async () => {
  const pi = await fizetettPi();
  const k = kontextus(`https://www.mosaicheadspa.hu/success-ajandekkartya-stripe?ertek=26900&session_id=${pi}`, { env: { ...ENV, STRIPE_API_BASE: 'http://127.0.0.1:9' } });
  const v = await fuggveny.onRequest(k.context);
  assert.equal(v.status, 200);
  await Promise.all(k.hatter); // nem dob
  assert.equal(mock.allapot.pi(pi).metadata.koszono_ekkor, undefined);
});

test('waitUntil nelkuli kornyezet (pl. helyi kiszolgalo): az oldal kiszolgalhato, naplozas nincs', async () => {
  const pi = await fizetettPi();
  const k = kontextus(`https://www.mosaicheadspa.hu/success-ajandekkartya-stripe?ertek=26900&session_id=${pi}`);
  delete k.context.waitUntil;
  const v = await fuggveny.onRequest(k.context);
  assert.equal(v.status, 200);
  assert.equal(mock.allapot.pi(pi).metadata.koszono_ekkor, undefined);
});
