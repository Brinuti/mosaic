// A ket platform-adapter (Netlify-fuggveny, Cloudflare Pages-fuggveny) bekotesenek tesztje:
// Request -> kozos kezelo -> Response, es a levelek kuldese. A 'nodemailer' es a 'worker-mailer'
// helyett csonk fut (csonk-hook.mjs), a Stripe helyett a mock.
//   node --test tools/ajandek-teszt/adapterek.test.mjs
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { register } from 'node:module';
import { mockStripeInditas } from './mock-stripe.mjs';

register('./csonk-hook.mjs', import.meta.url);

const WHSEC = 'whsec_adapter_teszt';
let mock;
let ENV;
let netlify;
let cloudflare;
const ENV_KULCSOK = ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_API_BASE', 'AJANDEK_TITOK',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_TO', 'AJANDEK_AZONNALI', 'AJANDEK_BAZIS_URL'];
const mentett = {};

before(async () => {
  mock = await mockStripeInditas();
  ENV = {
    STRIPE_SECRET_KEY: 'sk_test_mock_adapter', STRIPE_PUBLISHABLE_KEY: 'pk_test_mock_adapter', STRIPE_WEBHOOK_SECRET: WHSEC,
    STRIPE_API_BASE: mock.url, AJANDEK_TITOK: 'adapter-titok-adapter-titok-adapter-titok',
  };
  netlify = await import('../../netlify/functions/ajandek.mjs');
  cloudflare = await import(new URL('../../functions/api/ajandek/[[kind]].js', import.meta.url).href);
  for (const k of ENV_KULCSOK) mentett[k] = process.env[k];
});
after(async () => {
  for (const k of ENV_KULCSOK) {
    if (mentett[k] === undefined) delete process.env[k];
    else process.env[k] = mentett[k];
  }
  await mock.bezar();
});

const rendeles = (extra = {}) => ({
  termek: 'paros', email: 'vevo@example.com', nev: 'Adapter Anna', iranyitoszam: '1023', varos: 'Budapest', cim: 'Bécsi út 2.',
  attr: { variant_id: 'general' }, kulcs: 'k-' + crypto.randomUUID(), ...extra,
});
function alairt(piId) {
  const torzs = JSON.stringify({ id: 'evt_a', type: 'payment_intent.succeeded', data: { object: { id: piId, metadata: { forras: 'ajandek-motor' } } } });
  const t = Math.floor(Date.now() / 1000);
  return { torzs, fejlec: `t=${t},v1=${crypto.createHmac('sha256', WHSEC).update(`${t}.${torzs}`).digest('hex')}` };
}

test('Netlify-adapter: config.path, Request -> Response, process.env, nodemailer-levelek', async () => {
  assert.deepEqual(netlify.config, { path: '/api/ajandek/*' });
  Object.assign(process.env, ENV, { SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'mosaic@example.com', SMTP_PASS: 'abcd efgh ijkl mnop', MAIL_TO: 'szalon@example.com' });
  delete process.env.MAIL_FROM;
  globalThis.__ajandekLevelek = [];

  let v = await netlify.default(new Request('https://www.mosaicheadspa.hu/api/ajandek/beallitas'));
  assert.equal(v.status, 200);
  assert.equal(v.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await v.json(), { mod: 'teszt', publikus_kulcs: 'pk_test_mock_adapter', azonnali_kartya: false, foto: false });

  v = await netlify.default(new Request('https://www.mosaicheadspa.hu/api/ajandek/fizetes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rendeles({ osszeg: 1 })),
  }));
  assert.equal(v.status, 200);
  const f = await v.json();
  assert.equal(f.osszeg, 53800);
  assert.equal(mock.allapot.pi(f.pi).amount, 5380000);

  mock.allapot.sikeresIt(f.pi);
  const e = alairt(f.pi);
  v = await netlify.default(new Request('https://www.mosaicheadspa.hu/api/ajandek/webhook', {
    method: 'POST', headers: { 'Stripe-Signature': e.fejlec, 'Content-Type': 'application/json' }, body: e.torzs,
  }));
  assert.equal(v.status, 200, await v.clone().text());
  const l = globalThis.__ajandekLevelek;
  assert.equal(l.length, 2);
  assert.ok(l.every((x) => x.csomag === 'nodemailer' && x.from === 'Mosaic Headspa <mosaic@example.com>'));
  assert.equal(l[0].beallitas.auth.pass, 'abcdefghijklmnop', 'a szokozok kiesnek a jelszobol');
  assert.equal(l[0].beallitas.secure, true);
  const szalon = l.find((x) => x.to === 'szalon@example.com');
  const vevo = l.find((x) => x.to === 'vevo@example.com');
  assert.equal(szalon.replyTo, 'vevo@example.com');
  assert.equal(vevo.replyTo, 'szalon@example.com');
  assert.match(szalon.subject, /^Új ajándékkártya-rendelés \(fizetve\)/);
  // a levelben levo linkek a keres origin-jere mutatnak (nincs AJANDEK_BAZIS_URL)
  assert.ok(szalon.html.includes('https://www.mosaicheadspa.hu/api/ajandek/kiallit?pi='));

  // nincs SMTP-beallitas: a kuldes hibat dob -> a webhook nem 2xx (a Stripe ujraprobalja)
  delete process.env.SMTP_HOST;
  const g = await netlify.default(new Request('https://www.mosaicheadspa.hu/api/ajandek/fizetes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rendeles()),
  })).then((x) => x.json());
  mock.allapot.sikeresIt(g.pi);
  const e2 = alairt(g.pi);
  v = await netlify.default(new Request('https://www.mosaicheadspa.hu/api/ajandek/webhook', { method: 'POST', headers: { 'stripe-signature': e2.fejlec }, body: e2.torzs }));
  assert.equal(v.status, 500);
});

test('Cloudflare-adapter: onRequest(context), context.env, worker-mailer alapertekek, kapcsolat lezarva', async () => {
  globalThis.__ajandekLevelek = [];
  globalThis.__ajandekZarasok = [];
  const env = { ...ENV, SMTP_PASS: 'abcd efgh', ASSETS: { fetch: () => { throw new Error('nem kellene'); } } };
  const hivas = (req) => cloudflare.onRequest({ request: req, env, next: () => { throw new Error('nem kellene'); } });

  let v = await hivas(new Request('https://mosaicheadspa.pages.dev/api/ajandek/beallitas'));
  assert.equal(v.status, 200);
  assert.equal((await v.json()).mod, 'teszt');
  assert.equal(globalThis.__ajandekZarasok.length, 0, 'level nelkul nincs SMTP-kapcsolat');

  v = await hivas(new Request('https://mosaicheadspa.pages.dev/api/ajandek/nincs'));
  assert.equal(v.status, 404);

  const f = await hivas(new Request('https://mosaicheadspa.pages.dev/api/ajandek/fizetes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rendeles({ termek: 'egyeni' })),
  })).then((x) => x.json());
  assert.equal(f.osszeg, 26900);
  mock.allapot.sikeresIt(f.pi);
  const e = alairt(f.pi);
  v = await hivas(new Request('https://mosaicheadspa.pages.dev/api/ajandek/webhook', { method: 'POST', headers: { 'stripe-signature': e.fejlec }, body: e.torzs }));
  assert.equal(v.status, 200);
  const l = globalThis.__ajandekLevelek;
  assert.equal(l.length, 2);
  assert.ok(l.every((x) => x.csomag === 'worker-mailer'));
  assert.equal(l[0].beallitas.host, 'smtp.gmail.com');
  assert.equal(l[0].beallitas.credentials.username, 'mosaicheadspa@gmail.com');
  assert.equal(l[0].beallitas.credentials.password, 'abcdefgh');
  assert.deepEqual(l[0].from, { name: 'Mosaic Headspa', email: 'mosaicheadspa@gmail.com' });
  const szalon = l.find((x) => x.to === 'mosaicheadspa@gmail.com');
  const vevo = l.find((x) => x.to === 'vevo@example.com');
  assert.equal(szalon.reply, 'vevo@example.com');
  assert.equal(vevo.reply, 'mosaicheadspa@gmail.com');
  assert.equal(globalThis.__ajandekZarasok.length, 1, 'egy kapcsolat, a vegen lezarva');

  // kiallitas: a GET megerosito oldal nem kuld levelet, a POST igen
  const szalonHtml = szalon.html;
  const link = /href="(https:\/\/mosaicheadspa\.pages\.dev\/api\/ajandek\/kiallit\?[^"]+)"/.exec(szalonHtml)[1].replace(/&amp;/g, '&');
  v = await hivas(new Request(link));
  assert.equal(v.status, 200);
  const lap = await v.text();
  assert.match(lap, /<form method="post"/);
  const kod = /name="kod" value="([^"]+)"/.exec(lap)[1]; // a javasolt kod elo van toltve
  assert.equal(l.length, 2);
  const u = new URL(link);
  v = await hivas(new Request(u.origin + u.pathname, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ pi: u.searchParams.get('pi'), t: u.searchParams.get('t'), kod }).toString(),
  }));
  assert.equal(v.status, 200);
  assert.equal(l.length, 3);
  assert.equal(mock.allapot.pi(f.pi).metadata.kartya_kesz, '1');

  // nincs SMTP_PASS: a webhook nem 2xx
  const g = await hivas(new Request('https://mosaicheadspa.pages.dev/api/ajandek/fizetes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(rendeles()),
  })).then((x) => x.json());
  mock.allapot.sikeresIt(g.pi);
  const e2 = alairt(g.pi);
  delete env.SMTP_PASS;
  v = await hivas(new Request('https://mosaicheadspa.pages.dev/api/ajandek/webhook', { method: 'POST', headers: { 'stripe-signature': e2.fejlec }, body: e2.torzs }));
  assert.equal(v.status, 500);
});

// Egy Request-szeru objektum, aminek a torzsehez NEM szabad hozzanyulni (a tul nagy torzset nem olvassuk be).
function nemOlvashato(url, method, fejlecek) {
  return {
    url, method, headers: new Headers(fejlecek),
    get body() { throw new Error('a torzset nem lett volna szabad beolvasni'); },
    text() { throw new Error('a torzset nem lett volna szabad beolvasni'); },
  };
}

test('mindket adapter: tul nagy content-length -> 413 a torzs beolvasasa nelkul; content-length nelkul olvasas kozben all meg', async () => {
  Object.assign(process.env, ENV);
  const env = { ...ENV };
  const cf = (req) => cloudflare.onRequest({ request: req, env, next: () => { throw new Error('nem kellene'); } });
  const nf = (req) => netlify.default(req, {});
  for (const futtat of [nf, cf]) {
    for (const [ut, meret] of [['webhook', 512 * 1024 + 1], ['fizetes', 32 * 1024 + 1], ['atutalas', 10 * 1024 * 1024], ['szemelyre', 'nem-szam']]) {
      const v = await futtat(nemOlvashato(`https://www.mosaicheadspa.hu/api/ajandek/${ut}`, 'POST', { 'content-type': 'application/json', 'content-length': String(meret) }));
      assert.equal(v.status, 413, `${ut} ${meret}`);
      assert.deepEqual(await v.json(), { hiba: 'tul_nagy' });
      assert.equal(v.headers.get('cache-control'), 'no-store');
    }
    // content-length nelkul (pl. chunked): a 32 KB feletti JSON-torzs olvasas kozben 413
    let v = await futtat(new Request('https://www.mosaicheadspa.hu/api/ajandek/fizetes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'y'.repeat(40 * 1024) }),
    }));
    assert.equal(v.status, 413);
    // a webhooknak 512 KB jar: egy 100 KB-os (alairatlan) torzs eljut a kezeloig (-> 400 alairas)
    v = await futtat(new Request('https://www.mosaicheadspa.hu/api/ajandek/webhook', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'y'.repeat(100 * 1024) }),
    }));
    assert.equal(v.status, 400);
    assert.deepEqual(await v.json(), { hiba: 'alairas' });
  }
});

test('a kereskorlat a platform altal adott IP-t hasznalja (Netlify: context.ip, Cloudflare: cf-connecting-ip), nem a hamisithato fejleceket', async () => {
  const { _korlatAlaphelyzet } = await import('../../netlify/lib/ajandek.js');
  Object.assign(process.env, ENV);
  const torzs = JSON.stringify({ 'bot-field': 'x' });
  const keres = (fejlecek) => new Request('https://www.mosaicheadspa.hu/api/ajandek/atutalas', {
    method: 'POST', headers: { 'content-type': 'application/json', ...fejlecek }, body: torzs,
  });
  _korlatAlaphelyzet();
  // Netlify: a kliens hiaba kuld minden kereshez mas cf-connecting-ip / x-forwarded-for fejlecet
  for (let i = 0; i < 3; i++) {
    const v = await netlify.default(keres({ 'cf-connecting-ip': `203.0.113.${i}`, 'x-forwarded-for': `198.51.100.${i}` }), { ip: '192.0.2.1' });
    assert.equal(v.status, 200);
  }
  let v = await netlify.default(keres({ 'cf-connecting-ip': '203.0.113.99' }), { ip: '192.0.2.1' });
  assert.equal(v.status, 429);
  assert.ok(Number(v.headers.get('retry-after')) > 0);
  // Cloudflare: a cf-connecting-ip-t a Cloudflare allitja be
  _korlatAlaphelyzet();
  const env = { ...ENV };
  const cf = (req) => cloudflare.onRequest({ request: req, env, next: () => { throw new Error('nem kellene'); } });
  for (let i = 0; i < 3; i++) assert.equal((await cf(keres({ 'cf-connecting-ip': '192.0.2.7', 'x-forwarded-for': `198.51.100.${i}` }))).status, 200);
  v = await cf(keres({ 'cf-connecting-ip': '192.0.2.7', 'x-forwarded-for': '198.51.100.200' }));
  assert.equal(v.status, 429);
  _korlatAlaphelyzet();
});
