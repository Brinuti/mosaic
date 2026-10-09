// Belepes / munkamenet tesztek: e-mailes egyszeri kod (egyszer hasznalhato, lejar, zarolas, rate limit), azonos valasz letezo / nemletezo cimre,
// session (idle + abszolut lejarat, kilepes), hamis CSRF, CRM_ADMIN_EMAILS bootstrap, demo-belepes (eles hoszton letiltva).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujApi, auditSor } from './api-kozos.test.mjs';
import { sha256 } from '../lib/db.js';
import { OTP_ERVENYESSEG, SESSION_IDLE, SESSION_ABS } from '../lib/auth.js';

const kodKer = (x, email, o = {}) => x.hivas('POST', '/auth/kod-keres', { body: { email }, ...o });
const kodEll = (x, email, kod, o = {}) => x.hivas('POST', '/auth/kod-ellenoriz', { body: { email, kod }, ...o });
const utolsoKod = (x) => x.kuldott.at(-1).szoveg.match(/\b(\d{6})\b/)[1];
const sutiToken = (v) => /crm_sess=([^;]+)/.exec(v.sutik.join('\n'))[1];

test('AUTH kod-keres: a valasz letezo es nemletezo cimre BAJTRA azonos, a kod csak a letezonek megy ki', async () => {
  const x = await ujApi();
  const email = (await x.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(x.staff.terapeuta).first()).email;
  const a = await kodKer(x, email);
  const b = await kodKer(x, 'nincs.ilyen@example.com');
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(a.text, b.text);
  assert.deepEqual(a.json, { ok: true, uzenet: 'Ha az e-mail-cím engedélyezett, elküldtük a belépési kódot.' });
  assert.equal(x.kuldott.length, 1);
  assert.equal(x.kuldott[0].to, email);
  assert.match(x.kuldott[0].szoveg, /\b\d{6}\b/);
  assert.ok(!a.text.includes(utolsoKod(x)), 'a valasz nem tartalmazza a kodot (nincs demo-mod)');
  // inaktiv munkatars sem kap kodot, a valasz ugyanaz
  await x.db.prepare('UPDATE staff_user SET active = 0 WHERE id = ?1').bind(x.staff.recepcio).run();
  const em2 = (await x.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(x.staff.recepcio).first()).email;
  const c = await kodKer(x, em2);
  assert.equal(c.text, a.text);
  assert.equal(x.kuldott.length, 1);
  // ervenytelen formatum: validacios hiba (nem arul el letezest)
  assert.equal((await kodKer(x, 'nem-email')).status, 422);
});

test('AUTH a kod hash-elve tarolodik, 10 percig er, egyszer hasznalhato; a belepes suti HttpOnly+Secure+SameSite=Strict', async () => {
  const x = await ujApi();
  const em = (await x.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(x.staff.terapeuta).first()).email;
  await kodKer(x, em);
  const kod = utolsoKod(x);
  const sor = await x.db.prepare('SELECT * FROM login_otp WHERE email = ?1').bind(em).first();
  assert.notEqual(sor.code_hash, kod);
  assert.match(sor.code_hash, /^[0-9a-f]{64}$/);
  assert.equal(sor.expires_at - sor.created_at, OTP_ERVENYESSEG);
  const v = await kodEll(x, em, kod);
  assert.equal(v.status, 200);
  assert.equal(v.json.felhasznalo.email, em);
  assert.deepEqual(v.json.felhasznalo.szerepek, ['therapist']);
  assert.match(v.json.csrf, /^[0-9a-f]{64}$/);
  const suti = v.sutik.find((s) => s.startsWith('crm_sess='));
  assert.match(suti, /HttpOnly/); assert.match(suti, /Secure/); assert.match(suti, /SameSite=Strict/);
  // a session tokenje hash-elve van az adatbazisban
  const token = sutiToken(v);
  assert.equal(await x.db.prepare('SELECT COUNT(*) AS n FROM session WHERE token_hash = ?1').bind(token).first().then((r) => r.n), 0);
  assert.equal(await x.db.prepare('SELECT COUNT(*) AS n FROM session WHERE token_hash = ?1').bind(await sha256(token)).first().then((r) => r.n), 1);
  // masodszor ugyanaz a kod: elutasitva (egyszer hasznalhato)
  const ujra = await kodEll(x, em, kod);
  assert.equal(ujra.status, 401);
  assert.equal(ujra.json.hiba.kod, 'KOD_ERVENYTELEN');
  // a belepes naplozott, a naplo nem tartalmaz e-mailt vagy kodot
  const naplo = JSON.stringify(await auditSor(x.db, "action LIKE 'auth.%'"));
  assert.ok(naplo.includes('auth.login'));
  assert.ok(!naplo.includes(em) && !naplo.includes(kod));
});

test('AUTH a kod 10 perc utan lejar; ujabb kerees az elozot ervenytelenitti', async () => {
  const x = await ujApi();
  const em = (await x.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(x.staff.terapeuta).first()).email;
  await kodKer(x, em);
  const regi = utolsoKod(x);
  x.ido(OTP_ERVENYESSEG + 1);
  assert.equal((await kodEll(x, em, regi)).status, 401);
  await kodKer(x, em); const elso = utolsoKod(x);
  await kodKer(x, em); const masodik = utolsoKod(x);
  if (elso !== masodik) assert.equal((await kodEll(x, em, elso)).status, 401);
  assert.equal((await kodEll(x, em, masodik)).status, 200);
});

test('AUTH hibas-proba szamlalo + zarolas: 5 rossz tipp utan a helyes kod sem jo; a zarolas nem arul el semmit', async () => {
  const x = await ujApi();
  const em = (await x.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(x.staff.terapeuta).first()).email;
  await kodKer(x, em);
  const jo = utolsoKod(x);
  const rossz = jo === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await kodEll(x, em, rossz)).status, 401);
  assert.equal((await kodEll(x, em, jo)).status, 401, 'a kod 5 hibas proba utan eldobott');
  assert.equal((await x.db.prepare('SELECT attempts FROM login_otp WHERE email = ?1').bind(em).first()).attempts, 5);
  // az e-mailenkenti probalkozas-limit (10 / 15 perc) letezestol fuggetlenul lep be: a nemletezo cim ugyanigy 429-et kap
  let utolso;
  for (let i = 0; i < 14; i++) utolso = await kodEll(x, 'nincs.ilyen@example.com', '123456');
  assert.equal(utolso.status, 429);
  let utolso2;
  for (let i = 0; i < 6; i++) utolso2 = await kodEll(x, em, rossz);
  assert.equal(utolso2.status, 429);
  assert.equal(utolso.json.hiba.kod, utolso2.json.hiba.kod);
  // 15 perc mulva (uj ablak) uj kodkeressel ujra lehet lepni
  x.ido(901 + 3600);
  await kodKer(x, em);
  assert.equal((await kodEll(x, em, utolsoKod(x))).status, 200);
});

test('AUTH parhuzamos tippeles sem kerulheti meg a korlatot, es a helyes kodot csak EGY parhuzamos beváltás kapja meg', async () => {
  const x = await ujApi();
  const em = (await x.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(x.staff.terapeuta).first()).email;
  await kodKer(x, em);
  const kod = utolsoKod(x);
  const par = await Promise.all([1, 2, 3, 4].map(() => kodEll(x, em, kod)));
  assert.equal(par.filter((v) => v.status === 200).length, 1);
  assert.equal(par.filter((v) => v.status === 401).length, 3);
});

test('AUTH kod-keres rate limit: e-mailenkent 5 / ora (a 6. -> 429), letezestol fuggetlenul', async () => {
  const x = await ujApi();
  const em = (await x.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(x.staff.terapeuta).first()).email;
  const statuszok = [];
  for (let i = 0; i < 7; i++) statuszok.push((await kodKer(x, em, { ip: `198.51.100.${i + 1}` })).status);
  assert.deepEqual(statuszok, [200, 200, 200, 200, 200, 429, 429]);
  const nincs = [];
  for (let i = 0; i < 7; i++) nincs.push((await kodKer(x, 'nincs@example.com', { ip: `198.51.100.${i + 20}` })).status);
  assert.deepEqual(nincs, statuszok);
  // IP-nkent 20 / ora
  const ip = [];
  for (let i = 0; i < 22; i++) ip.push((await kodKer(x, `valaki${i}@example.com`, { ip: '203.0.113.99' })).status);
  assert.equal(ip.filter((s) => s === 429).length, 2);
});

test('AUTH CRM_ADMIN_EMAILS: az elso admin / szalonvezeto automatikusan felvetetik, a masik cim nem', async () => {
  const x = await ujApi({ env: { CRM_ADMIN_EMAILS: 'Tulaj@Example.com; masik@example.com' } });
  assert.equal(await x.db.prepare('SELECT COUNT(*) AS n FROM staff_user WHERE email = ?1').bind('tulaj@example.com').first().then((r) => r.n), 0);
  await kodKer(x, 'TULAJ@example.com');
  assert.equal(x.kuldott.length, 1);
  assert.equal(x.kuldott[0].to, 'tulaj@example.com');
  const v = await kodEll(x, 'tulaj@example.com', utolsoKod(x));
  assert.equal(v.status, 200);
  assert.deepEqual([...v.json.felhasznalo.szerepek].sort(), ['admin', 'salon_manager']);
  await kodKer(x, 'valaki.mas@example.com');
  assert.equal(x.kuldott.length, 1, 'nem admin-lista, nem munkatars: nincs kod');
  // bootstrap naplozott
  assert.equal((await auditSor(x.db, "action = 'staff.bootstrap_admin'")).length, 1);
  // deaktivalt admin nem lep be ujra (a lista nem aktivalja ujra)
  await x.db.prepare('UPDATE staff_user SET active = 0 WHERE email = ?1').bind('tulaj@example.com').run();
  const n = x.kuldott.length;
  await kodKer(x, 'tulaj@example.com');
  assert.equal(x.kuldott.length, n);
});

test('AUTH session: idle (30 perc) es abszolut (12 ora) lejarat, kilepes visszavon, a token hash-elve', async () => {
  const x = await ujApi();
  const m = x.session.terapeuta;
  assert.equal((await x.get('/auth/en', m)).status, 200);
  x.ido(SESSION_IDLE - 60);
  assert.equal((await x.get('/auth/en', m)).status, 200, 'aktivitas meghosszabbitja az idle-t');
  x.ido(SESSION_IDLE - 60);
  assert.equal((await x.get('/auth/en', m)).status, 200);
  x.ido(SESSION_IDLE + 1);
  assert.equal((await x.get('/auth/en', m)).status, 401, 'idle idokorlat');
  assert.equal((await x.get('/auth/en', m)).status, 401, 'a lejart session veglegesen ervenytelen');
  // abszolut: percenkent aktiv, mégis lejar 12 ora utan
  const m2 = await x.munkamenet(x.staff.recepcio);
  let allapot = 200;
  for (let i = 0; i < (SESSION_ABS / 60) + 5 && allapot === 200; i++) { x.ido(60 * 20); allapot = (await x.get('/auth/en', m2)).status; if (i > 200) break; }
  assert.equal(allapot, 401);
  // kilepes
  const m3 = await x.munkamenet(x.staff.admin);
  const k = await x.hivas('POST', '/auth/kilep', { m: m3 });
  assert.equal(k.status, 200);
  assert.match(k.sutik[0], /Max-Age=0/);
  assert.equal((await x.get('/auth/en', m3)).status, 401);
  // deaktivalt munkatars session-je azonnal ervenytelen
  const m4 = await x.munkamenet(x.staff.vezeto);
  await x.db.prepare('UPDATE staff_user SET active = 0 WHERE id = ?1').bind(x.staff.vezeto).run();
  assert.equal((await x.get('/auth/en', m4)).status, 401);
});

test('AUTH hamis / hianyzo CSRF-token: minden iro keres 403 (a session onmagaban nem eleg), az olvasas nem kell hozza', async () => {
  const x = await ujApi();
  const m = x.session.terapeuta;
  const nincs = await x.hivas('POST', '/osszehasonlitas', { m, body: {}, csrf: false });
  assert.equal(nincs.status, 403); assert.equal(nincs.json.hiba.kod, 'CSRF');
  const hamis = await x.hivas('POST', '/osszehasonlitas', { m, body: {}, csrf: 'a'.repeat(64) });
  assert.equal(hamis.status, 403); assert.equal(hamis.json.hiba.kod, 'CSRF');
  // masik munkamenet CSRF-je nem jo
  const masik = await x.hivas('POST', '/osszehasonlitas', { m, body: {}, csrf: x.session.recepcio.csrf });
  assert.equal(masik.status, 403);
  // a helyes CSRF-fel a keres eljut a validaciohoz
  assert.equal((await x.hivas('POST', '/osszehasonlitas', { m, body: {} })).status, 422);
  assert.equal((await x.get('/dashboard', m)).status !== 403, true);
  assert.ok((await auditSor(x.db, "action = 'csrf.rejected'")).length >= 3);
  // kulso eredetu (Origin) POST: tiltva
  const kulso = await x.hivas('POST', '/auth/kod-keres', { body: { email: 'a@b.hu' }, fejlecek: { origin: 'https://evil.example' } });
  assert.equal(kulso.status, 403);
  const sajat = await x.hivas('POST', '/auth/kod-keres', { body: { email: 'a@b.hu' }, fejlecek: { origin: x.host } });
  assert.equal(sajat.status, 200);
});

test('AUTH demo-belepes: CSAK CRM_DEMO=1 es NEM eles hoszton (www.mosaicheadspa.hu / mosaicheadspa.hu -> 404)', async () => {
  // 1) CRM_DEMO nincs beallitva
  let x = await ujApi();
  assert.equal((await x.hivas('POST', '/auth/demo', { body: { szerep: 'therapist' } })).status, 404);
  // 2) CRM_DEMO=1, de eles hoszt
  x = await ujApi({ env: { CRM_DEMO: '1' } });
  for (const h of ['https://www.mosaicheadspa.hu', 'https://mosaicheadspa.hu', 'https://WWW.MOSAICHEADSPA.HU', 'https://www.mosaicheadspa.hu.']) {
    const v = await x.hivas('POST', '/auth/demo', { body: { szerep: 'admin' }, host: h });
    assert.equal(v.status, 404, h);
    assert.equal(v.sutik.length, 0);
  }
  // a Host fejlec hamisitasa az URL-hoszt mellett sem nyit utat
  assert.equal((await x.hivas('POST', '/auth/demo', { body: { szerep: 'admin' }, host: 'https://crm.preview.test', fejlecek: { host: 'www.mosaicheadspa.hu' } })).status, 404);
  assert.equal((await auditSor(x.db, "action = 'auth.demo_login'")).length, 0);
  // 3) CRM_DEMO=1 + elonezeti hoszt: mukodik
  const ok = await x.hivas('POST', '/auth/demo', { body: { szerep: 'reception' }, host: 'https://claude-valami.mosaic-d77.pages.dev' });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.felhasznalo.szerepek, ['reception']);
  assert.match(ok.json.felhasznalo.email, /@(demo|example)\.invalid$/);   // sajat demo-fiok, vagy a demo.js munkatarsa
  const token = sutiToken(ok);
  const en = await x.hivas('GET', '/auth/en', { m: { token, csrf: ok.json.csrf }, host: 'https://claude-valami.mosaic-d77.pages.dev' });
  assert.equal(en.status, 200);
  // ismeretlen szerep: 422
  assert.equal((await x.hivas('POST', '/auth/demo', { body: { szerep: 'root' } })).status, 422);
  // a demo-munkamenet eles hoszton (vedelmi vonal) semmire nem jo
  const eles = await x.hivas('GET', '/auth/en', { m: { token, csrf: ok.json.csrf }, host: 'https://www.mosaicheadspa.hu' });
  assert.equal(eles.status, 401);
  // demo kikapcsolva: a korabbi demo-munkamenet is hasztalan
  const nemdemo = await x.hivas('GET', '/auth/en', { m: { token, csrf: ok.json.csrf }, env: { ...x.env, CRM_DEMO: '0' } });
  assert.equal(nemdemo.status, 401);
});

test('AUTH demo-mod: a kod CSAK demo-modban (es kuldo nelkul) adhato vissza a valaszban; a demo-cimre nem megy kod', async () => {
  const x = await ujApi({ env: { CRM_DEMO: '1', CRM_KULDO: undefined, SMTP_PASS: undefined } });
  const em = (await x.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(x.staff.terapeuta).first()).email;
  const demo = await kodKer(x, em);
  assert.match(demo.json.demo_kod, /^\d{6}$/);
  assert.equal((await kodEll(x, em, demo.json.demo_kod)).status, 200);
  // eles hoszton ugyanaz a keres NEM ad vissza kodot
  const eles = await kodKer(x, em, { host: 'https://www.mosaicheadspa.hu' });
  assert.equal(eles.json.demo_kod, undefined);
  assert.deepEqual(Object.keys(eles.json).sort(), ['ok', 'uzenet']);
  // demo-nelkuli kornyezet: sincs
  const y = await ujApi({ env: { CRM_KULDO: undefined, SMTP_PASS: undefined } });
  const em2 = (await y.db.prepare('SELECT email FROM staff_user WHERE id = ?1').bind(y.staff.terapeuta).first()).email;
  assert.equal((await kodKer(y, em2)).json.demo_kod, undefined);
  // demo.invalid cimre sosem keszul kod
  await y.hivas('POST', '/auth/kod-keres', { body: { email: 'demo-admin@demo.invalid' } });
  assert.equal(await y.db.prepare('SELECT COUNT(*) AS n FROM login_otp WHERE email LIKE \'%demo.invalid\'').first().then((r) => r.n), 0);
});

test('AUTH CRM_DB hianyaban 503 ertheto uzenettel, ismeretlen utvonal 404, rossz metodus 405', async () => {
  const x = await ujApi();
  const v = await x.hivas('GET', '/auth/en', { env: {} });
  assert.equal(v.status, 503);
  assert.match(v.json.hiba.uzenet, /CRM_DB/);
  assert.equal((await x.get('/nincs-ilyen', x.session.admin)).status, 404);
  assert.equal((await x.hivas('PUT', '/vendegek', { m: x.session.admin, body: {} })).status, 405);
  assert.equal((await x.hivas('GET', '/vendegek/nem-uuid', { m: x.session.admin })).status, 404);
  assert.equal((await x.hivas('GET', '/vendegek/..%2F..%2Fetc', { m: x.session.admin })).status, 404);
});
