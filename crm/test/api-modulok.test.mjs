// A masik fejleszto moduljainak (dashboard, merok, motor, ingest, demo) bekotese az API-ba: a vegpontok a valodi modulokat hivjak.
// Ha egy modul hianyzik, a megfelelo teszt kimarad (az api-vegpontok.test.mjs a 501-et vizsgalja).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujApi, auditSor } from './api-kozos.test.mjs';
import { kezelesek, foglal, szamol, elso, mind, BASE, NAP, VENDEG_A } from './fixtures.js';
import { opcionalisModul } from '../lib/api-modulok.js';
import { fuggoHozzajarulasSweep } from '../lib/api-public.js';
import { leiratkozasTokenSync, sha256Szinkron, hmacSha256Szinkron } from '../lib/api-token.js';
import { sha256 } from '../lib/db.js';
import { ertelmez } from '../../netlify/lib/lifecycle/parser.js';
import * as hj from '../lib/consent.js';

const van = async (nev) => !!(await opcionalisModul(nev));
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

test('MODUL a szinkron SHA-256 / HMAC egyezik a Web Crypto-val (a leiratkozasi token a motornak szinkron kell)', async () => {
  for (const szoveg of ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(200), 'Árvíztűrő tükörfúrógép']) {
    assert.equal(hex(sha256Szinkron(new TextEncoder().encode(szoveg))), await sha256(szoveg), szoveg.length);
  }
  const kulcs = await crypto.subtle.importKey('raw', new TextEncoder().encode('titok-titok-titok-1234'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const vart = new Uint8Array(await crypto.subtle.sign('HMAC', kulcs, new TextEncoder().encode('unsub|valami')));
  assert.equal(hex(hmacSha256Szinkron(new TextEncoder().encode('titok-titok-titok-1234'), new TextEncoder().encode('unsub|valami'))), hex(vart));
  const hosszu = 'k'.repeat(100);   // 64 bajtnal hosszabb kulcs
  const kulcs2 = await crypto.subtle.importKey('raw', new TextEncoder().encode(hosszu), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  assert.equal(hex(hmacSha256Szinkron(new TextEncoder().encode(hosszu), new TextEncoder().encode('uzenet'))), hex(new Uint8Array(await crypto.subtle.sign('HMAC', kulcs2, new TextEncoder().encode('uzenet')))));
  assert.equal(leiratkozasTokenSync({ CRM_TITOK: 'rovid' }, 'g'), null);
});

test('MODUL demo-belepes: a demo.js adatot betolti (egyszer), a demo-munkatars lep be; a dashboard / merok / uzenet-jobok a valodi modulokbol jon', async (t) => {
  if (!(await van('demo')) || !(await van('dashboard')) || !(await van('merok'))) return t.skip('demo / dashboard / merok modul hianyzik');
  const x = await ujApi({ env: { CRM_DEMO: '1', CRM_KULDO: undefined } });
  const hostDemo = 'https://elonezet.mosaic-d77.pages.dev';
  const be = await x.hivas('POST', '/auth/demo', { body: { szerep: 'therapist' }, host: hostDemo });
  assert.equal(be.status, 200, be.text);
  assert.match(be.json.felhasznalo.id, /^demo-staff-therapist-1$/);
  const vendegek = await szamol(x.db, 'guest');
  assert.ok(vendegek >= 10, `demo-vendegek: ${vendegek}`);
  const m = { token: /crm_sess=([^;]+)/.exec(be.sutik[0])[1], csrf: be.json.csrf };
  const g = (ut, mm = m, o = {}) => x.hivas('GET', ut, { m: mm, host: hostDemo, ...o });
  // masodik belepes nem tolt be ujra
  await x.hivas('POST', '/auth/demo', { body: { szerep: 'salon_manager' }, host: hostDemo });
  assert.equal(await szamol(x.db, 'guest'), vendegek);
  const kezelo = await g('/dashboard?nezet=kezelo');
  assert.equal(kezelo.status, 200, kezelo.text);
  assert.ok(kezelo.json && typeof kezelo.json === 'object');
  const vezeto = { token: /crm_sess=([^;]+)/.exec((await x.hivas('POST', '/auth/demo', { body: { szerep: 'salon_manager' }, host: hostDemo })).sutik[0])[1] };
  vezeto.csrf = (await x.hivas('GET', '/auth/en', { m: vezeto, host: hostDemo })).json.csrf;
  const menedzs = await g('/dashboard?nezet=menedzsment', vezeto);
  assert.equal(menedzs.status, 200, menedzs.text);
  assert.ok(!/anna|@example|telefon|\+36/i.test(menedzs.text), 'a menedzsment-nezet aggregalt, nyers adat nelkul');
  assert.equal((await g('/dashboard?nezet=menedzsment')).status, 403, 'a kezelo nem lathatja a menedzsment-nezetet');
  assert.equal((await g('/dashboard?nezet=kezelo', vezeto)).status, 403);
  const marketing = { token: /crm_sess=([^;]+)/.exec((await x.hivas('POST', '/auth/demo', { body: { szerep: 'marketing' }, host: hostDemo })).sutik[0])[1] };
  const merok = await g('/merok', marketing);
  assert.equal(merok.status, 200, merok.text);
  assert.ok('SHOW1' in merok.json || Object.keys(merok.json).length > 3);
  assert.equal((await g('/merok?kezelo=nem-uuid', marketing)).status, 422);
  // a kereso a demo-vendegeket megtalalja, a recepcio csak maszkolt adatot kap
  const rec = { token: /crm_sess=([^;]+)/.exec((await x.hivas('POST', '/auth/demo', { body: { szerep: 'reception' }, host: hostDemo })).sutik[0])[1] };
  const kereses = await g('/vendegek?q=demo', rec);
  assert.equal(kereses.status, 200);
  assert.ok(kereses.json.vendegek.length >= 5);
  assert.ok(kereses.json.vendegek.every((v) => /\*\*\*/.test(v.email_maszkolt)));
  // uzenet-jobok a motor jobLista-jabol, uzemmod dry
  const jobok = await g('/uzenetek/jobok', m);
  assert.equal(jobok.status, 200, jobok.text);
  assert.ok(Array.isArray(jobok.json.jobok));
  assert.equal((await g('/uzenetek/uzemmod', m)).json.kuldes, 'dry');
  // eles hoszton a demo-munkamenet hasztalan
  assert.equal((await x.hivas('GET', '/auth/en', { m, host: 'https://www.mosaicheadspa.hu' })).status, 401);
});

test('MODUL /tick: DRY (a vendegnek 0 level), a kuldes alapbol dry; kulcs nelkul 401; a landing-hozzajarulas a tick-ben kapcsolodik a vendeghez', async (t) => {
  if (!(await van('motor'))) return t.skip('motor modul hianyzik');
  const x = await ujApi({ env: { CRM_KULDO: undefined } });
  const kulcs = { 'x-crm-kulcs': 'gepi-kulcs' };
  assert.equal((await x.hivas('POST', '/tick', { body: {} })).status, 401);
  // landing: hozzajarulas, majd a foglalas beerkezik (az ingest.js-en keresztul, az API NELKUL) -> a tick kapcsolja
  await x.hivas('POST', '/public/hozzajarulas', { body: { selected_service: 'first_hair', email_marketing: true, sms_marketing: false, szoveg_verzio: 'lp-v1', kapcsolat: { email: VENDEG_A.email } } });
  const f = await foglal(x.t, { start: x.t.ido + 3 * NAP, now: x.t.ido - 60, bookedAt: x.t.ido - 60 });
  assert.equal(await szamol(x.db, 'consent_event'), 0);
  const tick = await x.hivas('POST', '/tick', { body: {}, fejlecek: kulcs });
  assert.equal(tick.status, 200, tick.text);
  assert.equal(tick.json.kuldve, 0, 'dry modban nincs valodi kuldes');
  assert.equal((await hj.marketingAllapot(x.db, f.guestId, 'email_marketing')).ok, true, 'a hozzajarulas a foglalashoz kapcsolodott');
  assert.equal(x.kuldott.length, 0);
  // a tick idempotens
  const ujra = await x.hivas('POST', '/tick', { body: {}, fejlecek: kulcs });
  assert.equal(ujra.status, 200);
  assert.equal(await szamol(x.db, 'consent_event', "channel = 'email_marketing'"), 1);
  assert.equal(await fuggoHozzajarulasSweep(x.db, { now: x.t.ido }), 0);
  // a motor konfigja DRY marad akkor is, ha az env-ben valami mas szerepel (csak 'eles' kapcsolja at)
  const dry = await x.hivas('POST', '/tick', { body: {}, fejlecek: kulcs, env: { ...x.env, CRM_KULDES: 'talan' } });
  assert.equal(dry.json.kuldve, 0);
});

test('MODUL /ingest: a lifecycle parser elemzett esemenyebol foglalas lesz (kulcsos, idempotens); jovahagyatlan kulcs / ismeretlen esemeny nem iro', async (t) => {
  if (!(await van('ingest'))) return t.skip('ingest modul hianyzik');
  const x = await ujApi();
  const kulcs = { 'x-crm-kulcs': 'gepi-kulcs' };
  const esemeny = { ok: true, tipus: 'foglalt', uzletag: 'oxygen', fiok: 'mosaic-oxigen', foglalasId: '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8', nev: 'Demo Anna', telefonNyers: '06 30 111 2222', email: 'demo.anna@example.invalid', szolgaltatasId: 466110, munkatars: 'Kata', kezdet: x.t.ido + 5 * NAP };
  assert.equal((await x.hivas('POST', '/ingest', { body: esemeny })).status, 401);
  assert.equal(await szamol(x.db, 'booking'), 0);
  const ok = await x.hivas('POST', '/ingest', { body: esemeny, fejlecek: kulcs });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.valtozas, 'uj');
  assert.equal(await szamol(x.db, 'booking', "service_code = 'first_hair'"), 1);
  const ism = await x.hivas('POST', '/ingest', { body: esemeny, fejlecek: kulcs });
  assert.equal(ism.json.valtozas, 'duplikalt');
  assert.equal(await szamol(x.db, 'booking'), 1);
  // landing-hozzajarulas az ingest-kor kapcsolodik (a vendeg letrejotte utan, ugyanabban a hivasban)
  await x.hivas('POST', '/public/hozzajarulas', { body: { selected_service: 'first_hair', email_marketing: true, sms_marketing: false, szoveg_verzio: 'lp-v1', kapcsolat: { email: 'masik.vendeg@example.invalid' } } });
  const masik = await x.hivas('POST', '/ingest', { body: { ...esemeny, foglalasId: '11111111-2222-4333-8444-555555555555', email: 'masik.vendeg@example.invalid', telefonNyers: '06 30 999 8888', nev: 'Masik Vendeg', kezdet: x.t.ido + 6 * NAP }, fejlecek: kulcs });
  assert.equal(masik.status, 200, masik.text);
  const g = await elso(x.db, "SELECT id FROM guest WHERE email = 'masik.vendeg@example.invalid'");
  assert.equal((await hj.marketingAllapot(x.db, g.id, 'email_marketing')).ok, true);
  // ervenytelen torzs
  assert.equal((await x.hivas('POST', '/ingest', { body: 'nem json', tipus: 'text/plain', fejlecek: kulcs })).status, 415);
  assert.equal((await x.hivas('POST', '/ingest', { body: '{rossz', fejlecek: kulcs })).status, 400);
  assert.equal((await x.hivas('POST', '/ingest', { body: { ok: true, tipus: 'valami' }, fejlecek: kulcs })).json.ok, false);
  void ertelmez; void mind;
});

test('MODUL uzenet-jobok ujrafuttatasa: 404 nemletezo, 409 nem ujrafuttathato, csak admin / marketing (message_template.write)', async (t) => {
  if (!(await van('motor'))) return t.skip('motor modul hianyzik');
  const x = await ujApi();
  const k = await kezelesek(x.t, { n: 1 });
  const id = crypto.randomUUID();
  await x.db.prepare("INSERT INTO message_job (id, guest_id, template_key, template_version, channel, idempotency_key, status, run_at, created_at) VALUES (?1, ?2, 'T0-F', 1, 'email', 'teszt-ujra-1', 'sent', ?3, ?3)").bind(id, k[0].guestId, x.t.ido).run();
  assert.equal((await x.post(`/uzenetek/jobok/${id}/ujra`, x.session.terapeuta, {})).status, 403);
  assert.equal((await x.post(`/uzenetek/jobok/${id}/ujra`, x.session.admin, {})).status, 409);
  assert.equal((await x.post('/uzenetek/jobok/00000000-0000-4000-8000-000000000009/ujra', x.session.admin, {})).status, 404);
  await x.db.prepare("UPDATE message_job SET status = 'dead' WHERE id = ?1").bind(id).run();
  const ok = await x.post(`/uzenetek/jobok/${id}/ujra`, x.session.admin, {});
  assert.equal(ok.status, 200, ok.text);
  assert.ok(!('payload' in (ok.json.job || {})), 'a nyers job-sor nem megy ki');
  assert.equal(x.kuldott.length, 0);
  const lista = (await x.get('/uzenetek/jobok?allapot=dry_run', x.session.terapeuta)).json.jobok;
  assert.ok(Array.isArray(lista));
  assert.equal((await auditSor(x.db, "action = 'message.rerun'")).length, 1);
  // az elonezet / sandbox: a motor.js jelenleg nem exportal ilyen fuggvenyt -> 501 (vagy mukodik, ha mar van)
  const el = await x.post('/uzenetek/elonezet', x.session.terapeuta, { template_key: 'T-24', guest_id: k[0].guestId });
  assert.ok([200, 501].includes(el.status), `${el.status} ${el.text.slice(0, 100)}`);
  const sb = await x.post('/uzenetek/sandbox-proba', x.session.admin, { template_key: 'T-24', guest_id: k[0].guestId });
  assert.ok([200, 501].includes(sb.status), `${sb.status}`);
});
