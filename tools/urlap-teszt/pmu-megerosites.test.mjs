// Az "Ott leszek" gomb (form-name = pmu-megerosites) a Cloudflare Pages-fuggvenyben (functions/[[path]].js):
// a szalon levele kimegy, es a fuggveny SEMMI mast nem hiv (a Salonic-naptar jelolese 2026-10-08-an kikerult).
//   node --test tools/urlap-teszt/pmu-megerosites.test.mjs
import test, { before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('../ajandek-teszt/csonk-hook.mjs', import.meta.url);

let fuggveny, kimeno;
before(async () => {
  fuggveny = await import(new URL('../../functions/[[path]].js', import.meta.url).href);
  globalThis.fetch = async (url) => { kimeno.push(String(url)); return new Response('x'); };
});
beforeEach(() => { kimeno = []; globalThis.__ajandekLevelek = []; });

const SMTP = { SMTP_HOST: 'smtp.teszt', SMTP_USER: 'szalon@teszt', SMTP_PASS: 'jelszo jelszo', MAIL_TO: 'szalon@teszt' };
function hivas(mezok, env = {}) {
  const hatter = [];
  return {
    hatter,
    context: {
      request: new Request('https://www.mosaicheadspa.hu/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(mezok) }),
      env: { ...SMTP, ...env, ASSETS: { fetch: async () => new Response('x') } },
      waitUntil: (p) => { hatter.push(p); },
      next: async () => new Response('next', { status: 404 }),
    },
  };
}
const OTT = { 'form-name': 'pmu-megerosites', idopont: '2026. október 27. 14:00', kezeles: 'Szemöldöktetoválás', ar: '79 000 Ft', oldal: 'pmu-ok', kezdet: String(Math.floor(Date.now() / 1000) + 5 * 86400), g: '3393366' };

test('"Ott leszek": a szalon levele kimegy, hatterfeladat nem indul, kulso hivas nincs', async () => {
  const { context, hatter } = hivas(OTT, { SALONIC_PMU_JELSZO: 'maradvany-titok' });
  const v = await fuggveny.onRequest(context);
  assert.equal(v.status, 200);
  assert.equal(await v.text(), 'ok');
  assert.equal(globalThis.__ajandekLevelek.length, 1, 'a szalon e-mailje elment');
  const level = globalThis.__ajandekLevelek[0];
  assert.equal(level.to, 'szalon@teszt');
  assert.match(level.subject, /megerősítette/);
  assert.match(level.html, /14:00/);
  assert.equal(hatter.length, 0, 'nincs hatterfeladat');
  assert.deepEqual(kimeno, [], 'a fuggveny semmilyen kulso cimet nem hiv');
});

test('SMTP nelkul is "ok" a valasz, es nincs kulso hivas', async () => {
  const { context } = hivas(OTT, { SMTP_PASS: '' });
  const v = await fuggveny.onRequest(context);
  assert.equal(await v.text(), 'ok');
  assert.deepEqual(kimeno, []);
});
