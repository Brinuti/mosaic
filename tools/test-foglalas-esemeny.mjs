// A foglalasi "jegyzettomb" (netlify/lib/foglalas-esemeny.js, functions/api/foglalas-esemeny.js, assets/js/booking-engine/jegyzettomb.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { irasEllenorzes, ujjlenyomat, ir, olvas, olvasLekerdezes, kezel, kulcs, ELET_MP, MAX_SZOLGALTATAS } from '../netlify/lib/foglalas-esemeny.js';
import { onRequest } from '../functions/api/foglalas-esemeny.js';
import { irasAdat, olvasUrl, utolsoFoglalasPerc } from '../assets/js/booking-engine/jegyzettomb.js';
import { eloAllapot } from '../assets/js/booking-engine/elo-foglaltsag.js';

const NOW = 1_800_000_000_000; // ms
const jo = (felul = {}) => ({ uzletag: 'hair', szolgaltatas: '466110', kezdes: NOW / 1000 + 3 * 86400, vendeg: '2461253', ...felul });

// hamis KV: put / get, a lejarat (expirationTtl) nyilvantartasaval
function hamisKv() {
  const t = new Map(); const ttl = new Map();
  return { t, ttl, get: async (k) => (t.has(k) ? t.get(k) : null), put: async (k, v, o = {}) => { t.set(k, v); ttl.set(k, o.expirationTtl); } };
}
const post = (test, { origin = 'https://x.mosaic-d77.pages.dev', host = 'x.mosaic-d77.pages.dev' } = {}) => new Request(`https://${host}/api/foglalas-esemeny`, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: typeof test === 'string' ? test : JSON.stringify(test) });
const get = (qs, host = 'x.mosaic-d77.pages.dev') => new Request(`https://${host}/api/foglalas-esemeny?${qs}`);

test('iras-ellenorzes: jo jelzes elfogadva, a szamok szovegkent', () => {
  const e = irasEllenorzes(jo({ szolgaltatas: 466110, vendeg: 2461253 }), NOW);
  assert.equal(e.ok, true); assert.deepEqual(e.adat, jo());
});

test('iras-ellenorzes: ismeretlen uzletag, rossz azonositok, rossz kezdes, hianyzo mezok elutasitva', () => {
  for (const [felul, hiba] of [[{ uzletag: 'pmu' }, 'ismeretlen_uzletag'], [{ uzletag: 'x' }, 'ismeretlen_uzletag'], [{ uzletag: undefined }, 'ismeretlen_uzletag'],
    [{ szolgaltatas: '12a' }, 'rossz_szolgaltatas'], [{ szolgaltatas: '' }, 'rossz_szolgaltatas'], [{ szolgaltatas: '1'.repeat(13) }, 'rossz_szolgaltatas'],
    [{ vendeg: '-1' }, 'rossz_vendeg'], [{ vendeg: undefined }, 'rossz_vendeg'],
    [{ kezdes: 'ma' }, 'rossz_kezdes'], [{ kezdes: 1.5 }, 'rossz_kezdes'], [{ kezdes: NOW / 1000 - 3 * 3600 }, 'kezdes_tartomanyon_kivul'], [{ kezdes: NOW / 1000 + 500 * 86400 }, 'kezdes_tartomanyon_kivul']]) {
    assert.deepEqual(irasEllenorzes(jo(felul), NOW), { ok: false, hiba }, JSON.stringify(felul));
  }
  assert.equal(irasEllenorzes('{rossz', NOW).hiba, 'rossz_json');
  assert.equal(irasEllenorzes('[1]', NOW).hiba, 'rossz_alak');
  assert.equal(irasEllenorzes('null', NOW).hiba, 'rossz_alak');
});

test('ujjlenyomat: ugyanaz a foglalas ugyanaz, mas foglalas mas; a vendeg-azonosito nem szerepel benne', async () => {
  const a = await ujjlenyomat(jo()); const b = await ujjlenyomat(jo()); const c = await ujjlenyomat(jo({ kezdes: jo().kezdes + 1800 }));
  assert.equal(a, b); assert.notEqual(a, c);
  assert.match(a, /^d:[0-9a-f]{32}$/); assert.ok(!a.includes('2461253'));
});

test('ir: elso foglalas beirva (a SZERVER idejevel, lejarattal); ugyanaz a foglalas ujra nem szamit (a koszonooldal ujratoltese)', async () => {
  const kv = hamisKv();
  assert.equal(await ir(kv, jo(), NOW), 'irva');
  assert.deepEqual(JSON.parse(kv.t.get(kulcs('hair', '466110'))), { t: NOW });
  assert.equal(kv.ttl.get(kulcs('hair', '466110')), ELET_MP);
  assert.equal(await ir(kv, jo(), NOW + 60_000), 'duplikalt');
  assert.deepEqual(JSON.parse(kv.t.get(kulcs('hair', '466110'))), { t: NOW }, 'a duplikalt nem frissit');
  assert.equal(await ir(kv, jo({ kezdes: jo().kezdes + 3600 }), NOW + 120_000), 'irva', 'masik foglalas ugyanarra a kezelesre: ujabb idopont');
  assert.deepEqual(JSON.parse(kv.t.get(kulcs('hair', '466110'))), { t: NOW + 120_000 });
});

test('ir: a kihagyott (teszt-) vendeg foglalasa nem kerul a jegyzettombbe, semmit nem ir', async () => {
  const kv = hamisKv();
  assert.equal(await ir(kv, jo(), NOW, { kihagy: ['999', '2461253'] }), 'kihagyva');
  assert.equal(kv.t.size, 0);
});

test('olvas: nincs bejegyzes = null; van = a kor (ms) a szerver idejehez; tobb valtozat kozul a legujabb; hibas / jovobeli bejegyzes kimarad', async () => {
  const kv = hamisKv();
  assert.equal(await olvas(kv, 'hair', ['1'], NOW), null);
  kv.t.set(kulcs('hair', '1'), JSON.stringify({ t: NOW - 20 * 60_000 }));
  kv.t.set(kulcs('hair', '2'), JSON.stringify({ t: NOW - 5 * 60_000 }));
  kv.t.set(kulcs('hair', '3'), '{rossz');
  kv.t.set(kulcs('hair', '4'), JSON.stringify({ t: NOW + 60_000 }));
  kv.t.set(kulcs('oxygen', '1'), JSON.stringify({ t: NOW - 1000 }));
  assert.equal(await olvas(kv, 'hair', ['1'], NOW), 20 * 60_000);
  assert.equal(await olvas(kv, 'hair', ['1', '2', '3'], NOW), 5 * 60_000, 'a legujabb valtozat szamit');
  assert.equal(await olvas(kv, 'hair', ['3', '4'], NOW), null, 'hibas es jovobeli bejegyzes nem szamit');
  assert.equal(await olvas(kv, 'hair', ['9'], NOW), null);
});

test('olvas-lekerdezes: ervenyes / ervenytelen', () => {
  const q = (s) => olvasLekerdezes(new URLSearchParams(s));
  assert.deepEqual(q('uzletag=hair&szolgaltatas=1,2,1'), { uzletag: 'hair', szolgaltatasok: ['1', '2'] });
  assert.equal(q('uzletag=pmu&szolgaltatas=1'), null);
  assert.equal(q('uzletag=hair'), null);
  assert.equal(q('uzletag=hair&szolgaltatas=1,x'), null);
  assert.equal(q('uzletag=hair&szolgaltatas=' + Array.from({ length: MAX_SZOLGALTATAS + 1 }, (_, i) => i + 1).join(',')), null);
});

test('vegpont: iras -> olvasas koreset (elonezeti domain: az iras be van kapcsolva); a valasz nem gyorsitotarazhato', async () => {
  const env = { ESEMENYEK: hamisKv() };
  const w = await kezel(post(jo()), env, NOW);
  assert.equal(w.status, 200); assert.deepEqual(await w.json(), { irva: true, ok: 'irva' });
  assert.equal(w.headers.get('cache-control'), 'no-store');
  const r = await kezel(get('uzletag=hair&szolgaltatas=466110'), env, NOW + 7 * 60_000);
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { kor_ms: 7 * 60_000 });
  assert.deepEqual(await (await kezel(get('uzletag=hair&szolgaltatas=1'), env, NOW)).json(), { kor_ms: null });
  assert.deepEqual(await (await kezel(post(jo()), env, NOW + 1000)).json(), { irva: false, ok: 'duplikalt' });
});

test('vegpont: az ELES domainen az iras alapbol KI van kapcsolva (semmit nem tarol); az ESEMENY_IRAS="1" kapcsolja be; az olvasas mindig megy', async () => {
  const kv = hamisKv();
  const ki = await kezel(post(jo(), { origin: 'https://www.mosaicheadspa.hu', host: 'www.mosaicheadspa.hu' }), { ESEMENYEK: kv }, NOW);
  assert.equal(ki.status, 200); assert.deepEqual(await ki.json(), { irva: false, ok: 'kikapcsolva' }); assert.equal(kv.t.size, 0);
  const be = await kezel(post(jo(), { origin: 'https://www.mosaicheadspa.hu', host: 'www.mosaicheadspa.hu' }), { ESEMENYEK: kv, ESEMENY_IRAS: '1' }, NOW);
  assert.deepEqual(await be.json(), { irva: true, ok: 'irva' }); assert.equal(kv.t.size, 2);
  const o = await kezel(get('uzletag=hair&szolgaltatas=466110', 'www.mosaicheadspa.hu'), { ESEMENYEK: kv }, NOW + 60_000);
  assert.deepEqual(await o.json(), { kor_ms: 60_000 });
});

test('vegpont: idegen eredet, rossz jelzes, tul nagy test, rossz metodus elutasitva; teszt-vendeg kihagyva; tarolo nelkul nem hibazik', async () => {
  const env = { ESEMENYEK: hamisKv(), ESEMENY_KIHAGY: ' 111 , 2461253 ' };
  assert.equal((await kezel(post(jo(), { origin: 'https://masik.example' }), env, NOW)).status, 403);
  assert.equal((await kezel(post(jo(), { origin: 'nem-url' }), env, NOW)).status, 403);
  assert.equal((await kezel(post(jo({ uzletag: 'x' })), env, NOW)).status, 400);
  assert.equal((await kezel(post('{"x":"' + 'a'.repeat(2000) + '"}'), env, NOW)).status, 413);
  assert.equal((await kezel(new Request('https://x.mosaic-d77.pages.dev/api/foglalas-esemeny', { method: 'DELETE' }), env, NOW)).status, 405);
  assert.equal((await kezel(get('uzletag=hair'), env, NOW)).status, 400);
  assert.deepEqual(await (await kezel(post(jo()), env, NOW)).json(), { irva: false, ok: 'kihagyva' }); assert.equal(env.ESEMENYEK.t.size, 0);
  assert.deepEqual(await (await kezel(post(jo()), {}, NOW)).json(), { irva: false, ok: 'nincs_tarolo' });
  assert.deepEqual(await (await kezel(get('uzletag=hair&szolgaltatas=1'), {}, NOW)).json(), { kor_ms: null });
  const rossz = { get: async () => { throw new Error('KV hiba'); }, put: async () => { throw new Error('KV hiba'); } };
  assert.deepEqual(await (await kezel(get('uzletag=hair&szolgaltatas=1'), { ESEMENYEK: rossz }, NOW)).json(), { kor_ms: null }, 'olvasasi hiba: nincs adat, nem hiba');
  assert.equal((await kezel(post(jo()), { ESEMENYEK: rossz }, NOW)).status, 500);
});

test('Pages Function: az onRequest a kezelore vezet (eles ido, hamis KV)', async () => {
  const env = { ESEMENYEK: hamisKv() };
  const r = await onRequest({ request: post({ ...jo(), kezdes: Math.floor(Date.now() / 1000) + 86400 }), env });
  assert.equal(r.status, 200); assert.equal((await r.json()).irva, true);
});

test('kliens: irasAdat a motor vart valasztasabol + a Salonic vendeg-azonositojabol; hianyzo adatnal null (nem irunk)', () => {
  const v = { reported: { guestId: '2461253' } };
  assert.deepEqual(irasAdat('hair', { serviceId: 466110, startUnix: 1_800_259_200 }, v), { uzletag: 'hair', szolgaltatas: '466110', kezdes: 1_800_259_200, vendeg: '2461253' });
  assert.equal(irasAdat('hair', { serviceId: 466110, startUnix: 1_800_259_200 }, { reported: {} }), null);
  assert.equal(irasAdat('hair', { serviceId: 466110, startUnix: 1_800_259_200 }, null), null);
  assert.equal(irasAdat('hair', null, v), null);
  assert.equal(irasAdat(null, { serviceId: 1, startUnix: 1 }, v), null);
  assert.equal(irasAdat('hair', { serviceId: 1 }, v), null);
});

test('kliens: olvasUrl (a valtozatok egyben, ismetles nelkul); utolsoFoglalasPerc = szerver-kor + az azota eltelt ido', () => {
  assert.equal(olvasUrl('headspa', [10, '20', 10]), '/api/foglalas-esemeny?uzletag=headspa&szolgaltatas=10,20');
  assert.equal(utolsoFoglalasPerc({ kor_ms: 5 * 60_000 }, 1000, 1000), 5);
  assert.equal(utolsoFoglalasPerc({ kor_ms: 5 * 60_000 }, 1000, 1000 + 90_000), 6.5);
  assert.equal(utolsoFoglalasPerc({ kor_ms: 5 * 60_000 }, 5000, 1000), 5, 'visszaugro ora nem csokkenti');
  for (const rossz of [null, {}, { kor_ms: null }, { kor_ms: -1 }, { kor_ms: 'x' }]) assert.equal(utolsoFoglalasPerc(rossz, 0, 0), null);
});

test('sav: a "N perce foglaltak utoljara" sor csak valodi (jegyzettombi) adatbol, 24 oran belul', () => {
  const sorok = (perc) => eloAllapot({ szabad: 5, utolsoFoglalasPerc: perc }).extra;
  assert.deepEqual(sorok(null), []); assert.deepEqual(sorok(undefined), []);
  assert.deepEqual(sorok(36), ['36 perce foglaltak utoljára erre a kezelésre.']);
  assert.deepEqual(sorok(36.9), ['36 perce foglaltak utoljára erre a kezelésre.']);
  assert.deepEqual(sorok(0.2), ['Az imént foglaltak erre a kezelésre.']);
  assert.deepEqual(sorok(150), ['2 órája foglaltak utoljára erre a kezelésre.']);
  assert.deepEqual(sorok(24 * 60 + 1), [], 'a 24 oranal regebbit nem emlegetjuk');
});
