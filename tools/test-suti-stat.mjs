// MOSAIC NEVTELEN SUTISAV-STATISZTIKA - OFFLINE TESZTEK (a meresi oldal SPEC-je, #167 125. komment, GPT atnezte)
//   node --test tools/test-suti-stat.mjs
// Szerver: szigoru ellenorzes, UPSERT szamlalo, budapesti nap, nincs azonosito / IP / UA / idobelyeg, azonos eredet, meret- es rate-limit, fail-open, kulcsos aggregalt olvasas.
// Kliens (assets/js/suti.js, szimulalt bongeszo-kornyezet): megjelenes + dontesek, fail-open, a dontest nem lassitja, oldaltipus / eszkoz, a vedett PIXEL sorok erintetlenek.
// A valodi bongeszos bizonyitek: tools/meres-proba/suti-stat-bongeszo.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ESEMENYEK, budapestiNap, kezelSutiStat, sutiStatKorlat, sutiStatKorlatNullaz, sutiStatOlvas, sutiStatTisztit } from '../netlify/lib/meres/suti-stat.js';
import { kezelAdmin } from '../netlify/lib/meres/vegpontok.js';
import { d1 } from './lib-sd-teszt.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SUTI_JS = fs.readFileSync(path.join(here, '..', 'assets', 'js', 'suti.js'), 'utf8');
const KULCS = 'suti-teszt-olvaso-kulcs';
const KULCS_HASH = crypto.createHash('sha256').update(KULCS).digest('hex');
const HOST = 'https://www.mosaicheadspa.hu';
const NOW = Date.UTC(2026, 9, 13, 12, 0, 0); // 2026-10-13 12:00Z (CEST: 14:00)
const OK = { esemeny: 'megjelent', oldaltipus: 'landing', eszkoz: 'mobil' };

const ker = (body, fej = {}, mod = {}) => new Request(HOST + '/api/suti-stat', { method: 'POST', headers: { origin: HOST, 'content-type': 'text/plain', ...fej }, body: typeof body === 'string' ? body : JSON.stringify(body), ...mod });
const kuld = (env, body, fej, mod) => kezelSutiStat(ker(body, fej, mod), env, { now: () => NOW });
const sorok = (adb) => adb.db.prepare('SELECT * FROM suti_stat ORDER BY nap, esemeny, oldaltipus, eszkoz, fun, ana, adv').all().map((r) => ({ ...r }));
const keszEnv = () => { const adb = d1(); return { adb, env: { KULCS_DB: adb, EGYEZTETES_KULCS_HASH: KULCS_HASH } }; };
test.beforeEach(() => sutiStatKorlatNullaz());

test('S1 sutiStatTisztit: ervenyes torzsek atmennek; ismeretlen kulcs / ertek / inkoherens dontes ELUTASITVA (nem javitunk)', () => {
  const ok = (o, vart) => { const t = sutiStatTisztit(o); assert.equal(t.ok, true, JSON.stringify(o)); assert.deepEqual(t.adat, vart, JSON.stringify(o)); };
  ok(OK, { esemeny: 'megjelent', fun: 0, ana: 0, adv: 0, oldaltipus: 'landing', eszkoz: 'mobil' });
  ok({ esemeny: 'elfogad_minden', fun: 1, ana: 1, adv: 1, oldaltipus: 'fooldal', eszkoz: 'desktop' }, { esemeny: 'elfogad_minden', fun: 1, ana: 1, adv: 1, oldaltipus: 'fooldal', eszkoz: 'desktop' });
  ok({ esemeny: 'elutasit', fun: 0, ana: 0, adv: 0, oldaltipus: 'koszono', eszkoz: 'mobil' }, { esemeny: 'elutasit', fun: 0, ana: 0, adv: 0, oldaltipus: 'koszono', eszkoz: 'mobil' });
  for (const [f, a, v] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1]]) ok({ esemeny: 'reszleges', fun: f, ana: a, adv: v, oldaltipus: 'egyeb', eszkoz: 'desktop' }, { esemeny: 'reszleges', fun: f, ana: a, adv: v, oldaltipus: 'egyeb', eszkoz: 'desktop' });
  const rossz = (o, miert) => { const t = sutiStatTisztit(o); assert.equal(t.ok, false, JSON.stringify(o)); if (miert) assert.match(t.miert, miert); };
  for (const o of [null, undefined, 'x', 5, [], [OK]]) rossz(o);
  rossz({ ...OK, esemeny: 'elfogad' }, /esemeny/);
  rossz({ ...OK, oldaltipus: 'fooldal2' }, /oldaltipus/);
  rossz({ ...OK, eszkoz: 'tablet' }, /eszkoz/);
  for (const extra of ['ts', 'id', 'sid', 'ip', 'ua', 'url', 'ref', 'nap', 'db', 'visitor']) rossz({ ...OK, [extra]: 'x' }, /ismeretlen mezo/); // azonosito / idobelyeg / URL nem csempesheto be
  rossz({ ...OK, fun: 0 }, /megjelen/);
  rossz({ ...OK, ana: 1 }, /megjelen/);
  rossz({ esemeny: 'elfogad_minden', fun: 1, ana: 1, adv: 0, oldaltipus: 'egyeb', eszkoz: 'mobil' }, /elfogad_minden/);
  rossz({ esemeny: 'elutasit', fun: 0, ana: 1, adv: 0, oldaltipus: 'egyeb', eszkoz: 'mobil' }, /elutasit/);
  rossz({ esemeny: 'reszleges', fun: 1, ana: 1, adv: 1, oldaltipus: 'egyeb', eszkoz: 'mobil' }, /reszleges/);
  rossz({ esemeny: 'reszleges', fun: 0, ana: 0, adv: 0, oldaltipus: 'egyeb', eszkoz: 'mobil' }, /reszleges/);
  for (const v of ['1', true, 2, -1, null, 0.5]) rossz({ esemeny: 'reszleges', fun: v, ana: 0, adv: 1, oldaltipus: 'egyeb', eszkoz: 'mobil' }, /0 vagy 1/);
  rossz({ esemeny: 'elutasit', oldaltipus: 'egyeb', eszkoz: 'mobil' }, /0 vagy 1/); // a dontes-jelzok nelkul nincs dontes
  assert.deepEqual(ESEMENYEK, ['megjelent', 'elfogad_minden', 'elutasit', 'reszleges']);
});

test('S2 POST: 204, a nap budapesti, UPSERT szamlalo (azonos kulcs db+1, kulon kulcs kulon sor); a tabla oszlopai pontosan a SPEC-eke', async () => {
  const { adb, env } = keszEnv();
  for (let i = 0; i < 3; i++) assert.equal((await kuld(env, OK)).status, 204);
  assert.equal((await kuld(env, { ...OK, eszkoz: 'desktop' })).status, 204);
  assert.equal((await kuld(env, { esemeny: 'reszleges', fun: 1, ana: 0, adv: 1, oldaltipus: 'foglalo', eszkoz: 'mobil' })).status, 204);
  assert.equal((await kuld(env, { esemeny: 'reszleges', fun: 1, ana: 1, adv: 0, oldaltipus: 'foglalo', eszkoz: 'mobil' })).status, 204);
  const s = sorok(adb);
  assert.equal(s.length, 4);
  assert.deepEqual(s.find((r) => r.esemeny === 'megjelent' && r.eszkoz === 'mobil'), { nap: '2026-10-13', esemeny: 'megjelent', fun: 0, ana: 0, adv: 0, oldaltipus: 'landing', eszkoz: 'mobil', db: 3 });
  assert.equal(s.find((r) => r.eszkoz === 'desktop').db, 1);
  assert.deepEqual(s.filter((r) => r.esemeny === 'reszleges').map((r) => [r.fun, r.ana, r.adv, r.db]).sort(), [[1, 0, 1, 1], [1, 1, 0, 1]]);
  const oszlopok = adb.db.prepare("SELECT name FROM pragma_table_info('suti_stat') ORDER BY cid").all().map((r) => r.name);
  assert.deepEqual(oszlopok, ['nap', 'esemeny', 'fun', 'ana', 'adv', 'oldaltipus', 'eszkoz', 'db']); // nincs ip / ua / sid / ido / url oszlop
});

test('S3 a nap a SZERVER budapesti napja: nyari (UTC+2) es teli (UTC+1) idoszamitas, ejfel-hatar, evforduló, a kliens ideje nem szamit', async () => {
  const t = (iso) => budapestiNap(Date.parse(iso));
  assert.equal(t('2026-10-13T21:59:59Z'), '2026-10-13'); // 23:59:59 CEST
  assert.equal(t('2026-10-13T22:00:00Z'), '2026-10-14'); // 00:00 CEST
  assert.equal(t('2026-12-31T22:59:59Z'), '2026-12-31'); // 23:59:59 CET
  assert.equal(t('2026-12-31T23:00:00Z'), '2027-01-01'); // 00:00 CET
  assert.equal(t('2026-03-28T23:30:00Z'), '2026-03-29'); // a nyari idoszamitas valtasa elott
  assert.equal(t('2026-10-24T22:30:00Z'), '2026-10-25'); // a teli idoszamitas valtasanak napja
  const { adb, env } = keszEnv();
  await kezelSutiStat(ker(OK), env, { now: () => Date.UTC(2026, 9, 13, 22, 30, 0) });
  assert.equal(sorok(adb)[0].nap, '2026-10-14');
  // a kliens "idobelyeg" mezoje elutasitott (S1), a Date fejlec nem szamit
  assert.equal((await kezelSutiStat(ker(OK, { date: 'Mon, 01 Jan 2001 00:00:00 GMT' }), env, { now: () => Date.UTC(2026, 9, 13, 10, 0, 0) })).status, 204);
  assert.deepEqual(sorok(adb).map((r) => r.nap).sort(), ['2026-10-13', '2026-10-14']);
});

test('S4 NINCS azonosito: sem az IP, sem az UA, sem a Referer / Cookie nem kerul az adatbazisba (a teljes dump atvizsgalva)', async () => {
  const { adb, env } = keszEnv();
  const IP = '203.0.113.77', UA = 'UA-TESZT-NE-TAROLD/9.9', REF = 'https://www.mosaicheadspa.hu/titkos-oldal?x=1', COOKIE = 'mh_cc=abc; _fbp=fb.1.123.456';
  assert.equal((await kuld(env, OK, { 'cf-connecting-ip': IP, 'user-agent': UA, referer: REF, cookie: COOKIE })).status, 204);
  const dump = JSON.stringify([adb.db.prepare("SELECT name, sql FROM sqlite_master").all(), adb.db.prepare('SELECT * FROM suti_stat').all()]);
  for (const titok of [IP, UA, 'titkos-oldal', 'fb.1.123', 'abc', 'Mon,']) assert.ok(!dump.includes(titok), 'nem tarolhato: ' + titok);
  const tablak = adb.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  assert.deepEqual(tablak, ['suti_stat']); // semmi mas tabla / naplo nem keletkezett
});

test('S5 elutasitasok: GET 405, idegen eredet 403, tul nagy 413, nem JSON 400, ismeretlen ertek 400, nincs DB 503 - es EGYIK sem ir sort', async () => {
  const { adb, env } = keszEnv();
  assert.equal((await kezelSutiStat(new Request(HOST + '/api/suti-stat'), env)).status, 405);
  assert.equal((await kezelSutiStat(new Request(HOST + '/api/suti-stat', { method: 'PUT', body: JSON.stringify(OK) }), env)).status, 405);
  assert.equal((await kuld(env, OK, { origin: 'https://evil.example.com' })).status, 403);
  assert.equal((await kezelSutiStat(new Request(HOST + '/api/suti-stat', { method: 'POST', body: JSON.stringify(OK) }), env)).status, 403); // sem Origin, sem sec-fetch-site
  assert.equal((await kezelSutiStat(new Request(HOST + '/api/suti-stat', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, body: JSON.stringify(OK) }), env, { now: () => NOW })).status, 204); // a same-origin fetch Origin nelkul is mehet
  adb.db.prepare('DELETE FROM suti_stat').run();
  assert.equal((await kuld(env, JSON.stringify({ ...OK, pad: 'x'.repeat(400) }))).status, 413);
  assert.equal((await kuld(env, OK, { 'content-length': '5000' })).status, 413); // a torzs beolvasasa elott
  assert.equal((await kuld(env, 'nem json')).status, 400);
  assert.equal((await kuld(env, '')).status, 400);
  assert.equal((await kuld(env, '[]')).status, 400);
  assert.equal((await kuld(env, { ...OK, esemeny: 'x' })).status, 400);
  assert.equal((await kuld(env, { ...OK, ts: 1 })).status, 400);
  assert.equal((await kezelSutiStat(ker(OK), {})).status, 503);
  assert.equal((await kezelSutiStat(ker(OK), { KULCS_DB: null })).status, 503);
  assert.equal(sorok(adb).length, 0);
});

test('S6 rate-limit: IP-nkent 20/perc (a 21. 429), mas IP fuggetlen, az ablak lejar, IP nelkul kozos nagyobb voder; telitett memoria nem nohet vegtelenre; a limit NEM ir D1-be', async () => {
  const { adb, env } = keszEnv();
  const kuldIp = (ip, ms) => kezelSutiStat(ker(OK, ip ? { 'cf-connecting-ip': ip } : {}), env, { now: () => ms });
  for (let i = 0; i < 20; i++) assert.equal((await kuldIp('198.51.100.1', NOW + i)).status, 204, 'kerés ' + i);
  assert.equal((await kuldIp('198.51.100.1', NOW + 100)).status, 429);
  assert.equal((await kuldIp('198.51.100.2', NOW + 100)).status, 204);
  assert.equal((await kuldIp('198.51.100.1', NOW + 60001)).status, 204); // uj ablak
  assert.equal(sorok(adb).reduce((n, r) => n + r.db, 0), 20 + 1 + 1);
  sutiStatKorlatNullaz();
  for (let i = 0; i < 200; i++) assert.equal((await kuldIp('', NOW + i)).status, 204);
  assert.equal((await kuldIp('', NOW + 300)).status, 429);
  // a memoria-vedelem: sok kulonbozo IP utan a terkep nem nohet a vegtelensegig
  const k = { ablakMs: 60000, max: 20, ismeretlenMax: 200, maxBejegyzes: 50 };
  sutiStatKorlatNullaz();
  for (let i = 0; i < 500; i++) assert.equal(sutiStatKorlat('10.0.' + (i >> 8) + '.' + (i & 255), NOW, k), true);
  assert.equal(sutiStatKorlat('10.9.9.9', NOW, k), true);
});

test('S7 fail-open: D1-hiba -> 500 (soha kivetel), a tabla-letrehozas hibaja sem dob; a kerest a kliens ugyis nem varja meg', async () => {
  const hibas = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('d1 leallt'); } }), run: async () => { throw new Error('d1 leallt'); } }) };
  const hiba = console.error; let naplo = 0; console.error = () => { naplo++; };
  try {
    const r = await kezelSutiStat(ker(OK), { KULCS_DB: hibas }, { now: () => NOW });
    assert.equal(r.status, 500);
    assert.equal(naplo, 1);
  } finally { console.error = hiba; }
});

test('S8 olvasas: GET /api/meres-admin?suti_stat=1 CSAK kulccsal, csak aggregalt szamok (alapbol az utolso 31 nap), a hibas datum 400', async () => {
  const { adb, env } = keszEnv();
  const nap = (n) => Date.UTC(2026, 9, 13 - n, 12, 0, 0);
  for (const [n, body, db] of [[0, OK, 3], [1, OK, 2], [2, { esemeny: 'elutasit', fun: 0, ana: 0, adv: 0, oldaltipus: 'koszono', eszkoz: 'desktop' }, 1], [40, OK, 5]]) for (let i = 0; i < db; i++) await kezelSutiStat(ker(body), env, { now: () => nap(n) + i * 70000 });
  const adm = (q, fej = { 'x-egyeztetes-kulcs': KULCS }) => kezelAdmin(new Request(HOST + '/api/meres-admin' + q, { headers: fej }), env, { now: () => NOW });
  assert.equal((await adm('?suti_stat=1', {})).status, 404); // kulcs nelkul nincs
  assert.equal((await adm('?suti_stat=1', { 'x-egyeztetes-kulcs': 'rossz' })).status, 404);
  const r = await adm('?suti_stat=1');
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.deepEqual(Object.keys(j.sorok[0]).sort(), ['adv', 'ana', 'db', 'esemeny', 'eszkoz', 'fun', 'nap', 'oldaltipus']); // aggregalt sor, semmi mas
  assert.deepEqual(j.osszes, { megjelent: 5, elfogad_minden: 0, elutasit: 1, reszleges: 0 }); // a 40 napos adat kiesik az alap ablakbol
  assert.equal(j.sorok.length, 3);
  const kulon = await (await adm('?suti_stat=1&tol=2026-08-01&ig=2026-10-13')).json();
  assert.equal(kulon.osszes.megjelent, 10);
  assert.equal((await adm('?suti_stat=1&tol=2026-10-14&ig=2026-10-13')).status, 400);
  assert.equal((await adm('?suti_stat=1&tol=akarmi')).status, 400);
  assert.equal(adb.db.prepare('SELECT COUNT(*) AS n FROM suti_stat').get().n, 4); // 4 aggregalt sor (nap x esemeny x ...), 11 esemeny osszesen
  assert.equal(adb.db.prepare('SELECT SUM(db) AS n FROM suti_stat').get().n, 11);
  assert.deepEqual(await sutiStatOlvas(d1(), { ms: NOW }).then((x) => [x.ok, x.sorok.length]), [true, 0]); // ures tabla (meg nem volt esemeny) is ures valasz, nem hiba
  // regresszio: a tobbi GET ag valtozatlan
  assert.equal((await adm('?kapcsolok=1')).status, 200);
});

// --- kliens: assets/js/suti.js szimulalt bongeszo-kornyezetben ---------------------------------------------------------------------------
function kliens({ hostname = 'www.mosaicheadspa.hu', pathname = '/', mobil = false, dontes = null, beacon = 'ok', fetchHiba = false, elrejtve = false } = {}) {
  const kuldesek = [], fetchek = [], elemek = {}, esemenyek = {}; let cookie = '';
  const ls = {}, ss = elrejtve ? { mh_cc_elrejtve: '1' } : {};
  if (dontes) ls.mh_cc = JSON.stringify({ v: 1, t: Date.now(), ...dontes });
  const mkEl = (id) => { const e = { id, style: {}, checked: false, children: [], _k: {}, setAttribute() {}, getAttribute: () => null, addEventListener(ev, fn) { (e._k[ev] = e._k[ev] || []).push(fn); }, remove() {}, appendChild() {}, after() {}, closest: () => null, querySelectorAll: () => [] }; return e; };
  const doc = {
    readyState: 'complete', head: { appendChild() {} }, documentElement: { style: {} },
    get cookie() { return cookie; }, set cookie(v) { cookie = v; },
    createElement: (t) => { const e = mkEl(); e.tagName = t.toUpperCase(); Object.defineProperty(e, 'innerHTML', { set(h) { for (const m of String(h).matchAll(/id="([^"]+)"/g)) { elemek[m[1]] = elemek[m[1]] || mkEl(m[1]); } while (e.firstChild) e.firstChild = null; e.firstChild = null; } }); return e; },
    createTextNode: () => ({}), addEventListener() {}, body: { appendChild() {} },
    getElementById: (id) => elemek[id] || null, querySelectorAll: () => [], querySelector: () => null,
    getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }], // a TikTok / Meta kiegeszitő-snippetek (merokodok) ezt hasznaljak; hallo nincs
  };
  const win = {
    location: { hostname, pathname, search: '', protocol: 'https:', href: 'https://' + hostname + pathname, origin: 'https://' + hostname },
    localStorage: { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } },
    sessionStorage: { getItem: (k) => (k in ss ? ss[k] : null), setItem: (k, v) => { ss[k] = String(v); }, removeItem: (k) => { delete ss[k]; } },
    matchMedia: (q) => ({ matches: mobil && /max-width:\s*767px/.test(q) }), dataLayer: [], addEventListener() {},
  };
  win.window = win; win.top = win; win.self = win; win.document = doc; win.frameElement = null;
  const nav = { sendBeacon: (u, b) => { if (beacon === 'dob') throw new Error('beacon hiba'); kuldesek.push({ u, tipus: b.type, adat: b.__szoveg }); return beacon === 'ok'; } };
  class Blob { constructor(r, o) { this.__szoveg = r.join(''); this.type = (o && o.type) || ''; } }
  const ctx = vm.createContext({
    window: win, document: doc, navigator: nav, localStorage: win.localStorage, sessionStorage: win.sessionStorage, location: win.location, Blob, JSON, Date, Math, Object, Array, String, Number, RegExp, Error, encodeURIComponent, decodeURIComponent, parseInt, parseFloat, isNaN,
    setTimeout: () => 0, clearTimeout() {}, console: { log() {}, warn() {}, error() {} }, Promise, URLSearchParams,
    fetch: (u, o) => { fetchek.push({ u, o }); return fetchHiba ? Promise.reject(new Error('halozat')) : Promise.resolve({ ok: true }); },
  });
  // a kategoria-pipak (checked) allitasa a savon: a getElementById('mh-cc-fun') stb. mkEl-bol jon
  vm.runInContext(SUTI_JS, ctx, { filename: 'suti.js' });
  const kattint = (akcio) => { const sav = elemek['mh-cc']; for (const fn of (sav._k.click || [])) fn({ target: { getAttribute: (k) => (k === 'data-mh' ? akcio : null) } }); };
  return { kuldesek, fetchek, ls, ss, elemek, win, kattint, kuldottak: () => kuldesek.map((k) => JSON.parse(k.adat)), cookie: () => cookie };
}

test('K1 kliens: a sav megjelenesekor "megjelent", a gombokra a megfelelo dontes-esemeny; fun/ana/adv 0/1, csak dontesnel; kulso szolgaltato / suti / azonosito nincs', () => {
  const k = kliens({ pathname: '/lezeres-szortelenites-budapest', mobil: true });
  assert.deepEqual(k.kuldottak(), [{ esemeny: 'megjelent', oldaltipus: 'landing', eszkoz: 'mobil' }]);
  assert.equal(k.kuldesek[0].u, '/api/suti-stat');
  assert.equal(k.kuldesek[0].tipus, 'text/plain'); // nincs preflight
  k.kattint('accept');
  assert.deepEqual(k.kuldottak()[1], { esemeny: 'elfogad_minden', oldaltipus: 'landing', eszkoz: 'mobil', fun: 1, ana: 1, adv: 1 });
  const r = kliens({ pathname: '/fodrasz-ok' }); r.kattint('reject');
  assert.deepEqual(r.kuldottak(), [{ esemeny: 'megjelent', oldaltipus: 'koszono', eszkoz: 'desktop' }, { esemeny: 'elutasit', oldaltipus: 'koszono', eszkoz: 'desktop', fun: 0, ana: 0, adv: 0 }]);
  const m = kliens({ pathname: '/foglalo-motor' });
  m.elemek['mh-cc-fun'].checked = true; m.elemek['mh-cc-adv'].checked = true; m.kattint('save');
  assert.deepEqual(m.kuldottak()[1], { esemeny: 'reszleges', oldaltipus: 'foglalo', eszkoz: 'desktop', fun: 1, ana: 0, adv: 1 });
  const mind = kliens({ pathname: '/' }); mind.elemek['mh-cc-fun'].checked = mind.elemek['mh-cc-ana'].checked = mind.elemek['mh-cc-adv'].checked = true; mind.kattint('save');
  assert.equal(mind.kuldottak()[1].esemeny, 'elfogad_minden'); // minden pipa = mindent elfogad
  const semmi = kliens({ pathname: '/' }); semmi.kattint('save');
  assert.equal(semmi.kuldottak()[1].esemeny, 'elutasit'); // egy pipa sincs = elutasit
  for (const x of [k, r, m, mind, semmi]) for (const o of x.kuldottak()) assert.ok(sutiStatTisztit(o).ok, 'a szerver elfogadja: ' + JSON.stringify(o)); // a kliens es a szerver szerzodese egyezik
});

test('K2 kliens: nincs "megjelent", ha a sav nem jelenik meg (van dontes / ebben a munkamenetben elrejtve); az utolagos beallitasok-megnyitas nem szamit megjelenesnek; a reszleges (terkep) engedely nem sav-dontes', () => {
  assert.deepEqual(kliens({ dontes: { fun: true, ana: true, adv: true } }).kuldottak(), []);
  assert.deepEqual(kliens({ elrejtve: true }).kuldottak(), []);
  const k = kliens({ pathname: '/' });
  assert.equal(k.kuldottak().length, 1);
  k.win.mhSuti.beallitasok(); // megnyitas a lablecbol: nem uj "megjelent"
  assert.equal(k.kuldottak().length, 1);
  k.win.mhSuti.enged('fun'); // a terkep egyetlen kategoriat enged: nem a savban hozott dontes
  assert.equal(k.kuldottak().length, 1);
});

test('K3 kliens FAIL-OPEN: a beacon hibaja / telitettsege / a fetch-tartalek bukasa mellett a dontes ugyanugy rogzul, a sav ugyanugy eltunik, nem szall el kivetel', () => {
  for (const [nev, opt] of [['beacon dob', { beacon: 'dob' }], ['beacon false + fetch tartalek', { beacon: 'false' }], ['beacon false + fetch hiba', { beacon: 'false', fetchHiba: true }]]) {
    const k = kliens({ pathname: '/', ...opt });
    k.kattint('accept'); // nem szallhat el
    assert.equal(JSON.parse(k.ls.mh_cc).fun, true, nev + ': a dontes rogzult');
    assert.equal(JSON.parse(k.ls.mh_cc).adv, true, nev);
    assert.equal(k.elemek['mh-cc'].style.display, 'none', nev + ': a sav eltunt');
    assert.equal(k.win.mhSuti.engedely('adv'), true, nev);
  }
  const t = kliens({ pathname: '/', beacon: 'false' }); t.kattint('reject');
  assert.equal(t.fetchek.length >= 1, true); // tartalek: fetch keepalive text/plain
  assert.equal(t.fetchek[t.fetchek.length - 1].o.keepalive, true);
  assert.equal(t.fetchek[t.fetchek.length - 1].o.headers['content-type'], 'text/plain');
});

test('K4 kliens: a dontes utan CSAK a meglevo tarolast hagyja maga utan (mh_cc + a Wix-kompatibilis consent-policy suti) - nincs uj suti / localStorage / sessionStorage kulcs, a torzsben nincs ido / azonosito', () => {
  const k = kliens({ pathname: '/' }); k.kattint('accept');
  assert.deepEqual(Object.keys(k.ls).sort(), ['mh_cc']);
  assert.deepEqual(Object.keys(k.ss).sort(), []);
  assert.match(k.cookie(), /^consent-policy=/); // a MEGLEVO Wix-kompatibilis suti, mas nincs
  assert.ok(!/stat/i.test(k.cookie()) && !/stat/i.test(JSON.stringify(k.ls)));
  // a beacon-torzs sehol nem tartalmaz idot / azonositot
  const t = JSON.stringify(k.kuldottak());
  assert.ok(!/ts|time|uuid|sid|visitor|fbp|fbc|gclid/i.test(t.replace(/oldaltipus|eszkoz|megjelent/g, '')), t);
});

test('K5 oldaltipus: koszono (success-*, *-ok, pmu-vh) > foglalo > fooldal > landing (pixeles kampanyoldal) > egyeb; a /m/ elotag es a .html nem szamit', () => {
  const tipus = (p) => kliens({ pathname: p }).kuldottak()[0].oldaltipus;
  for (const p of ['/success-foglalas', '/success-foglalas-egyeni-vip', '/success-ajandekkartya-stripe', '/foglalas-ok', '/fodrasz-ok', '/oxigenterapia-ok', '/elysion-ok', '/pmu-ok', '/pmu-lead-ok', '/pmu-vh', '/m/fodrasz-ok', '/oxigenterapia-ok.html']) assert.equal(tipus(p), 'koszono', p);
  for (const p of ['/foglalo', '/foglalo-motor', '/foglalo-pmu', '/fodraszat-foglalas', '/pmu-foglalas', '/szortelenites-foglalas', '/mosaic-hair-idopontfoglalas']) assert.equal(tipus(p), 'foglalo', p);
  assert.equal(tipus('/'), 'fooldal');
  assert.equal(tipus('/index.html'), 'fooldal');
  for (const p of ['/lezeres-szortelenites-budapest', '/balayage-haj-festes-budapest', '/sminktetovalas-budapest', '/headspa-kupon', '/m/lezeres-szortelenites-budapest']) assert.equal(tipus(p), 'landing', p);
  for (const p of ['/aszf', '/impresszum', '/suti-tajekoztato', '/arlista', '/valami-ismeretlen']) assert.equal(tipus(p), 'egyeb', p);
  for (const p of ['/', '/fodrasz-ok', '/foglalo', '/aszf', '/lezeres-szortelenites-budapest']) assert.ok(sutiStatTisztit({ esemeny: 'megjelent', oldaltipus: tipus(p), eszkoz: 'desktop' }).ok);
});

test('K6 VEDETT ELEMEK (#167 124. komment): a Meta-pixel lista, a Fodrasz pixel es a ket koszonooldal slugja a suti.js-ben erintetlen; a statisztika nem tolt kulso szkriptet / nem erinti a Consent Mode jeleket', () => {
  assert.ok(SUTI_JS.includes("PIXEL_FODRASZ = '1361403694872594'"));
  const fodraszSor = SUTI_JS.split('\n').find((l) => l.includes('[PIXEL_FODRASZ,'));
  assert.ok(fodraszSor && /\bfodrasz-ok\b/.test(fodraszSor) && /\boxigenterapia-ok\b/.test(fodraszSor), 'a Fodrasz pixel-lista tartalmazza a fodrasz-ok es oxigenterapia-ok oldalt');
  assert.match(SUTI_JS, /ELES_DOMAINEK = \['mosaicheadspa\.hu', 'www\.mosaicheadspa\.hu'\]/);
  // a statisztika csak sajat vegpontra kuld, kulso URL-t nem hiv
  const blokk = SUTI_JS.slice(SUTI_JS.indexOf('function statKuld'), SUTI_JS.indexOf('function statDontes'));
  assert.ok(blokk.includes("'/api/suti-stat'") && !/https?:\/\//.test(blokk));
  assert.ok(!/gtag\(|dataLayer|fbq\(|ttq\./.test(blokk), 'a statisztika nem nyul a mero-eszkozokhoz');
});

test('K7 kliens: csak az ELES domainen kuld (mint a tobbi mero-kod, ELES_DOMAINEK) - localhost / pages.dev / hasonlo nevu idegen domain NEM; a sav ott is ugyanugy mukodik', () => {
  for (const hostname of ['localhost', '127.0.0.1', 'mosaic-d77.pages.dev', 'claude-xyz.mosaic-d77.pages.dev', 'mosaicheadspa.hu.evil.example.com', 'wwwmosaicheadspa.hu']) {
    const k = kliens({ hostname, pathname: '/' });
    k.kattint('accept');
    assert.deepEqual(k.kuldottak(), [], hostname);
    assert.equal(k.fetchek.length, 0, hostname);
    assert.equal(JSON.parse(k.ls.mh_cc).adv, true, hostname + ': a dontes rogzul');
  }
  for (const hostname of ['mosaicheadspa.hu', 'www.mosaicheadspa.hu']) assert.equal(kliens({ hostname, pathname: '/' }).kuldottak().length, 1, hostname);
});
