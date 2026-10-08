// Az "Ott leszek" gomb (form-name = pmu-megerosites) bekotesenek tesztje a Cloudflare Pages-fuggvenyben (functions/[[path]].js):
// a szalon levele a Salonic-jelolestol fuggetlenul kimegy, a jelolest a fuggveny hatterben (waitUntil) indítja, es csak ennel az urlapnal.
//   node --test tools/salonic-teszt/pmu-megerosites-hook.test.mjs
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { register } from 'node:module';

register('../ajandek-teszt/csonk-hook.mjs', import.meta.url);

let szerver, ALAP, kerelmek, fuggveny;
before(async () => {
  szerver = http.createServer((req, res) => {
    kerelmek.push({ method: req.method, ut: req.url });
    // belepesi oldal (nincs bejelentkezes) -> a jelolo "belepes sikertelen"-nel megall; a lenyeg: megprobalkozott-e
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<form><input name="LoginForm[customer]"><input name="LoginForm[password]" type="password"></form>');
  });
  await new Promise((ok) => szerver.listen(0, '127.0.0.1', ok));
  ALAP = `http://127.0.0.1:${szerver.address().port}`;
  fuggveny = await import(new URL('../../functions/[[path]].js', import.meta.url).href);
});
after(async () => { await new Promise((ok) => szerver.close(ok)); });
beforeEach(() => { kerelmek = []; globalThis.__ajandekLevelek = []; });

const SMTP = { SMTP_HOST: 'smtp.teszt', SMTP_USER: 'szalon@teszt', SMTP_PASS: 'jelszo jelszo', MAIL_TO: 'szalon@teszt' };
function hivas(mezok, env = {}) {
  const hatter = [];
  const torzs = new URLSearchParams(mezok);
  const context = {
    request: new Request('https://www.mosaicheadspa.hu/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: torzs }),
    env: { ...SMTP, ...env, ASSETS: { fetch: async () => new Response('x') } },
    waitUntil: (p) => { hatter.push(p); },
    next: async () => new Response('next', { status: 404 }),
  };
  return { context, hatter };
}
const kezdet = () => String(Math.floor(Date.now() / 1000) + 5 * 86400);
const OTT = (extra = {}) => ({ 'form-name': 'pmu-megerosites', idopont: '2026. október 27. 14:00', kezeles: 'Szemöldöktetoválás', ar: '79 000 Ft', oldal: 'pmu-ok', kezdet: kezdet(), g: '3393366', ...extra });

test('"Ott leszek": a szalon levele kimegy, es a Salonic-jeloles hatterben elindul', async () => {
  const { context, hatter } = hivas(OTT(), { SALONIC_PMU_JELSZO: 'titok', SALONIC_PMU_URL: ALAP });
  const v = await fuggveny.onRequest(context);
  assert.equal(v.status, 200);
  assert.equal(await v.text(), 'ok');
  assert.equal(globalThis.__ajandekLevelek.length > 0, true, 'a szalon e-mailje elment');
  assert.equal(hatter.length, 1, 'egy hatterfeladat indult');
  await Promise.all(hatter);
  assert.ok(kerelmek.some((k) => k.ut.startsWith('/backend/signin')), 'a jelolo megprobalt belepni a (mock) Salonicba');
});

test('jelszo nelkul (nincs beallitva) nem hiv semmit, a level igy is kimegy', async () => {
  const { context, hatter } = hivas(OTT(), { SALONIC_PMU_URL: ALAP });
  const v = await fuggveny.onRequest(context);
  assert.equal(await v.text(), 'ok');
  assert.equal(globalThis.__ajandekLevelek.length > 0, true);
  await Promise.all(hatter);
  assert.equal(kerelmek.length, 0);
});

test('SMTP nelkul sem akad el: a jelolest akkor is elinditja, a valasz "ok"', async () => {
  const { context, hatter } = hivas(OTT(), { SMTP_PASS: '', SALONIC_PMU_JELSZO: 'titok', SALONIC_PMU_URL: ALAP });
  const v = await fuggveny.onRequest(context);
  assert.equal(await v.text(), 'ok');
  await Promise.all(hatter);
  assert.ok(kerelmek.length > 0);
});

test('SALONIC_JELOLES=0 (kikapcsolo) vagy hianyzo/rossz mezok: nincs Salonic-keres', async () => {
  for (const [extra, env] of [
    [{}, { SALONIC_JELOLES: '0' }],
    [{ g: '' }, {}],
    [{ g: 'abc' }, {}],
    [{ kezdet: '' }, {}],
    [{ kezdet: '1000' }, {}],
  ]) {
    const { context, hatter } = hivas(OTT(extra), { SALONIC_PMU_JELSZO: 'titok', SALONIC_PMU_URL: ALAP, ...env });
    const v = await fuggveny.onRequest(context);
    assert.equal(await v.text(), 'ok');
    await Promise.all(hatter);
  }
  assert.equal(kerelmek.length, 0, 'egyik esetben sem keresett a Saloniccal');
});

test('mas urlapnal (pl. ajandekkartya) soha nem hivja a Salonicot', async () => {
  const { context, hatter } = hivas({ 'form-name': 'ajandekkartya', kezdet: kezdet(), g: '3393366' }, { SALONIC_PMU_JELSZO: 'titok', SALONIC_PMU_URL: ALAP });
  await fuggveny.onRequest(context);
  await Promise.all(hatter);
  assert.equal(kerelmek.length, 0);
});

test('ha a Salonic nem elerheto, a valasz akkor is "ok" (nem dob kivetelt)', async () => {
  const { context, hatter } = hivas(OTT(), { SALONIC_PMU_JELSZO: 'titok', SALONIC_PMU_URL: 'http://127.0.0.1:1' });
  const v = await fuggveny.onRequest(context);
  assert.equal(await v.text(), 'ok');
  await assert.doesNotReject(Promise.all(hatter));
});
