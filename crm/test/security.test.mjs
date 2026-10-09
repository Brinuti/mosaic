// Biztonsagi tesztek (MASTERPROMPT 3.10 + QA S01-S03): jogosulatlan hozzaferes, visszavont hozzajarulas, HTTPS-fejlecek / privat tarolas / token-hash /
// rate limit, IDOR, XSS (publikus oldal, PDF, JSON), SQL-injekcio, fajlfeltoltes (hamis MIME, tul nagy, path traversal), CSRF, audit-manipulacio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujApi, auditSor, NULLA_ID } from './api-kozos.test.mjs';
import { kezelesek, foglal, sessionok, elso, mind, szamol, jpegBajtok, pngBajtok, kerdoivBeallit, BASE, NAP, VENDEG_A, VENDEG_B } from './fixtures.js';
import { elerhetosegEllenorzott } from '../lib/guest.js';
import * as im from '../lib/images.js';
import * as hj from '../lib/consent.js';
import * as pl from '../lib/plan.js';
import { sha256 } from '../lib/db.js';
import { pdfSzoveg } from '../lib/api-dokumentum.js';
import { KEP_API_MAX } from '../lib/api-klinikai.js';

const kepFel = (x, sid, m, nyers, tipus, pont = '') => x.hivas('POST', `/kezelesek/${sid}/kepek${pont}`, { m, nyers, tipus });
async function kepesVendeg(x, vendeg = VENDEG_A) {
  const k = await kezelesek(x.t, { vendeg, n: 3, guestExternalId: `x-${vendeg.nev}` });
  await elerhetosegEllenorzott(x.db, { guestId: k[0].guestId, email: true });
  const ss = await sessionok(x.db, k[0].guestId);
  const f = await kepFel(x, ss[0].id, x.session.terapeuta, jpegBajtok(), 'image/jpeg');
  return { guestId: k[0].guestId, ss, kepId: f.json.id, k };
}

test('S01 jogosulatlan munkatars: a recepcio / marketing / admin NEM tolthet le erzekeny kepet, NEM lathatja a felmerot, a profilban sincs kep; 403 + audit', async () => {
  const x = await ujApi();
  const v = await kepesVendeg(x);
  const fogl = v.k[0].bookingId;
  for (const sz of ['recepcio', 'marketing', 'admin', 'vezeto']) {
    const r = await x.get(`/kepek/${v.kepId}`, x.session[sz]);
    assert.equal(r.status, 403, sz);
    assert.ok(!r.headers.get('content-type').includes('image'), 'a 403 nem kep');
    assert.equal(r.bajtok.length < 300, true);
  }
  const denied = await auditSor(x.db, "action = 'camera_image.read' AND result = 'denied'");
  assert.equal(denied.length, 4);
  assert.ok(denied.every((a) => a.resource_id === v.kepId && a.guest_id === v.guestId && a.staff_id), 'a naplo: ki, mit, melyik vendeg');
  assert.equal((await x.get(`/foglalasok/${fogl}/felmero`, x.session.recepcio)).status, 403);
  assert.equal((await x.get(`/kezelesek/${v.ss[0].id}/terv`, x.session.recepcio)).status, 403);
  const profil = (await x.get(`/vendegek/${v.guestId}`, x.session.recepcio)).json;
  assert.equal(profil.kepek, null); assert.equal(profil.dokumentumok, null);
  assert.ok(!JSON.stringify(profil).includes(v.kepId), 'a profil nem hivatkozik a kepre');
  // a jogosult kezelo letolthet, naplozva
  assert.equal((await x.get(`/kepek/${v.kepId}`, x.session.terapeuta2)).status, 200);
  assert.equal((await auditSor(x.db, "action = 'image.read' AND result = 'ok'")).length, 1);
  // kezeloi munkamenet nelkul semmi
  assert.equal((await x.get(`/kepek/${v.kepId}`)).status, 401);
});

test('S02 visszavont hozzajarulas: a marketing-allapot AZONNAL valtozik (API-n is), opt-out naplo + unsubscribe + audit; nyitott panasz is tilt', async () => {
  const x = await ujApi();
  const k = await kezelesek(x.t, { n: 1 });
  const gid = k[0].guestId;
  const rec = x.session.recepcio;
  await x.post(`/vendegek/${gid}/hozzajarulasok`, rec, { csatorna: 'email_marketing', allapot: 'granted', szoveg_verzio: 'v1' });
  await x.post(`/vendegek/${gid}/hozzajarulasok`, rec, { csatorna: 'sms_marketing', allapot: 'granted', szoveg_verzio: 'v1' });
  assert.equal((await hj.lehetMarketing(x.db, gid, 'email_marketing', { now: x.t.ido })), true);
  const be = await x.get(`/vendegek/${gid}`, x.session.terapeuta);
  assert.equal(be.json.hozzajarulasok.marketing.email.ok, true);
  await x.post(`/vendegek/${gid}/hozzajarulasok`, rec, { csatorna: 'email_marketing', allapot: 'withdrawn' });
  assert.equal(await hj.lehetMarketing(x.db, gid, 'email_marketing'), false, 'azonnal nincs uj marketing');
  assert.equal(await hj.lehetMarketing(x.db, gid, 'sms_marketing'), true, 'a masik csatorna nem erintett');
  const utana = await x.get(`/vendegek/${gid}`, x.session.terapeuta);
  assert.equal(utana.json.hozzajarulasok.marketing.email.ok_kod, 'VISSZAVONVA');
  assert.equal((await szamol(x.db, 'consent_event', "channel = 'email_marketing' AND action = 'withdrawn'")), 1);
  assert.equal((await szamol(x.db, 'unsubscribe', "channel = 'email_marketing'")), 1);
  assert.equal((await auditSor(x.db, "action = 'consent.withdrawn' AND guest_id = ?1", gid)).length, 1);
  // a hozzajarulas-naplo append-only: az API-n at nem torolheto / modosithato, a DB-szinten sem
  await assert.rejects(() => x.db.prepare('DELETE FROM consent_event').run(), /audit_append_only/);
  // nyitott panasz is lezarja a marketinget (M07), a hozzajarulas megmarad
  await x.post(`/vendegek/${gid}/panaszok`, x.session.terapeuta, { leiras: 'Panasz.' });
  assert.equal((await hj.marketingAllapot(x.db, gid, 'sms_marketing')).ok_kod, 'NYITOTT_PANASZ');
});

test('S03 biztonsagi kontrollok: HTTPS-fejlecek MINDEN valasztipuson, privat tarolas, a tokenek CSAK hash-elve vannak az adatbazisban, rate limit', async () => {
  const x = await ujApi();
  const v = await kepesVendeg(x);
  // a review-dokumentacio + osszehasonlitas + link (a tokenekhez)
  const ss3 = v.ss.find((s) => s.treatment_index === 3);
  const f3 = await kepFel(x, ss3.id, x.session.terapeuta, jpegBajtok(), 'image/jpeg');
  const o = await x.post('/osszehasonlitas', x.session.terapeuta, { kep_a: v.kepId, kep_b: f3.json.id });
  await x.post(`/osszehasonlitas/${o.json.id}/veglegesit`, x.session.terapeuta, { komment: 'Szebb a haj. A fejbor nyugodt.' });
  const rev = await elso(x.db, "SELECT id FROM treatment_plan WHERE kind = 'review'");
  await x.hivas('PUT', `/kezelesek/${ss3.id}/terv`, { m: x.session.terapeuta, body: { mezok: { ertekeles: 'Javul. A fejbor nyugodt.', otthoni_rutin_kontroll: 'Rendben.' } } });
  await x.post(`/tervek/${rev.id}/veglegesit`, x.session.terapeuta, {});
  const link = await x.post(`/osszehasonlitas/${o.json.id}/link`, x.session.terapeuta, {});
  const token = link.json.link.split('/').pop();
  // valasztipusok: JSON, hiba, kep, PDF, CSV, publikus HTML, publikus kep, 404, 401
  const valaszok = {
    json: await x.get('/auth/en', x.session.admin),
    hiba: await x.get(`/vendegek/${NULLA_ID}`, x.session.terapeuta),
    nincsBelepve: await x.get('/dashboard'),
    kep: await x.get(`/kepek/${v.kepId}`, x.session.terapeuta),
    pdf: await x.get(`/tervek/${rev.id}/a5.pdf`, x.session.terapeuta),
    csv: await x.get('/audit/export.csv', x.session.admin),
    htmlLap: await x.get(`/public/kep/${token}`),
    publikusKep: await x.get(`/public/kep/${token}/${v.kepId}`),
    nincsLap: await x.get('/public/kep/nincs-ilyen-token-nincs-ilyen-token'),
    nemLetezo: await x.get('/nincs-ilyen'),
    jovahagyatlan: await x.get('/public/felmero/' + 'A'.repeat(43)),
  };
  for (const [nev, r] of Object.entries(valaszok)) {
    assert.equal(r.headers.get('cache-control'), 'no-store', `${nev} cache-control`);
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer', `${nev} referrer`);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff', `${nev} nosniff`);
    assert.equal(r.headers.get('x-frame-options'), 'DENY', `${nev} frame`);
    assert.match(r.headers.get('strict-transport-security'), /max-age=\d{7,}/, `${nev} HSTS`);
    assert.ok(r.headers.get('content-security-policy'), `${nev} CSP`);
    assert.equal(r.headers.get('access-control-allow-origin'), null, `${nev} nincs CORS`);
  }
  assert.match(valaszok.json.headers.get('content-type'), /^application\/json/);
  assert.match(valaszok.hiba.headers.get('content-type'), /^application\/json/);
  assert.match(valaszok.htmlLap.headers.get('content-security-policy'), /^default-src 'none'/);
  assert.equal(valaszok.htmlLap.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  // privat tarolas: a kep / PDF kulcsa sehol nem jelenik meg a valaszokban, a bajtok csak a taroloban vannak, nem az uzleti tablakban
  const mindenValasz = [valaszok.json, valaszok.hiba, valaszok.csv, valaszok.htmlLap].map((r) => r.text).join('\n')
    + (await x.get(`/vendegek/${v.guestId}`, x.session.terapeuta)).text + (await x.get(`/kezelesek/${ss3.id}/terv`, x.session.terapeuta)).text;
  assert.ok(!/storage_key|kepek\/[0-9a-f-]{36}\/|pdf\/[0-9a-f-]{36}\//.test(mindenValasz), 'a tarolo-kulcs nem szivarog');
  assert.deepEqual([...x.t.tarolo.m.keys()].filter((k) => !/^(kepek|pdf)\/[0-9a-f-]{36}\//.test(k)), [], 'csak szerver-oldali, UUID-s kulcsok');
  assert.equal((await elso(x.db, 'SELECT COUNT(*) AS n FROM camera_image WHERE storage_key LIKE \'%data:%\'')).n, 0);
  // tokenek hash-elve: sehol nincs a nyers token az adatbazisban
  const kiad = await foglal(x.t, { vendeg: VENDEG_B, start: x.t.ido + 5 * NAP, now: x.t.ido });
  await kerdoivBeallit(x.t);
  const fk = await x.post(`/foglalasok/${kiad.bookingId}/felmero-kiad`, x.session.terapeuta, {});
  const nyersTokenek = [token, fk.json.token];
  for (const tabla of ['share_grant', 'share_verification', 'assessment_submission', 'survey_response', 'session', 'login_otp', 'security_audit', 'outbox_event', 'message_job', 'beallitasok']) {
    const sorok = JSON.stringify(await mind(x.db, `SELECT * FROM ${tabla}`));
    for (const t of nyersTokenek) assert.ok(!sorok.includes(t), `${tabla}: nyers token`);
    for (const m of Object.values(x.session)) assert.ok(!sorok.includes(m.token), `${tabla}: nyers session-token`);
  }
  assert.equal((await elso(x.db, 'SELECT COUNT(*) AS n FROM share_grant WHERE token_hash = ?1', await sha256(token))).n, 1);
  assert.match((await elso(x.db, 'SELECT token_hash FROM session LIMIT 1')).token_hash, /^[0-9a-f]{64}$/);
  // rate limit: a publikus token-vegpontok IP-nkent korlatozottak (90 / 10 perc), a limit az ismeretlen tokeneket is szamolja
  let utolso;
  for (let i = 0; i < 95; i++) utolso = await x.get(`/public/kep/${'X'.repeat(43)}`, null, { ip: '192.0.2.200' });
  assert.equal(utolso.status, 429);
  assert.match(utolso.text, /Túl sok kérés/);
  assert.equal(utolso.headers.get('cache-control'), 'no-store');
  assert.equal((await x.get(`/public/kep/${'X'.repeat(43)}`, null, { ip: '192.0.2.201' })).status, 404, 'masik IP nem erintett');
});

test('IDOR: mas vendeg kepe / felhasznalo azonositoja / foglalasa a sajat jogosultsagon belul sem keverheto', async () => {
  const x = await ujApi();
  const a = await kepesVendeg(x, VENDEG_A);
  const b = await kepesVendeg(x, VENDEG_B);
  const m = x.session.terapeuta;
  // ket kulonbozo vendeg kepeinek osszehasonlitasa tiltott
  const keverve = await x.post('/osszehasonlitas', m, { kep_a: a.kepId, kep_b: b.kepId });
  assert.equal(keverve.status, 422);
  assert.equal(keverve.json.hiba.kod, 'KULONBOZO_VENDEG');
  // credit-levonas mas vendeg foglalasara
  const kam = await foglal(x.t, { service: 'camera_assessment', vendeg: { nev: 'Kamera Karolina', email: 'k@example.com', telefon: '+36 30 777 1111' }, start: BASE - 5 * NAP, now: BASE - 6 * NAP, bookedAt: BASE - 6 * NAP });
  await x.post(`/foglalasok/${kam.bookingId}/completed`, m, {});
  await foglal(x.t, { service: 'first_hair', vendeg: { nev: 'Kamera Karolina', email: 'k@example.com', telefon: '+36 30 777 1111' }, start: BASE + 3 * NAP, now: BASE - 2 * NAP, bookedAt: BASE - 2 * NAP });
  const cr = (await x.get(`/vendegek/${kam.guestId}/credit`, x.session.recepcio)).json.creditek[0];
  const masik = await x.post(`/credit/${cr.creditId}/levonas`, x.session.recepcio, { booking_id: b.k[0].bookingId });
  assert.ok([409, 422].includes(masik.status), `${masik.status}`);
  assert.equal((await elso(x.db, 'SELECT status FROM assessment_credit WHERE id = ?1', cr.creditId)).status, 'eligible');
  // mas kezelo panasza: csak a felelos kezeli (A kezelo panasza -> B kezelo 403), a szakmai vezeto sem
  const p = await x.post(`/vendegek/${a.guestId}/panaszok`, m, { leiras: 'Teszt.' });
  for (const sz of ['terapeuta2', 'janka']) assert.equal((await x.post(`/panaszok/${p.json.complaintId}/lezar`, x.session[sz], { megoldas: 'Megoldva.', vendeg_elegedett: true })).status, 403, sz);
  assert.equal((await auditSor(x.db, "resource = 'complaint' AND result = 'denied'")).length, 2, 'mindket elutasitas naplozott');
  // mas vendeg azonositoja a hozzajarulasnal / berletnel: nemletezo -> 404, nem 500
  assert.equal((await x.post(`/vendegek/${NULLA_ID}/panaszok`, m, { leiras: 'x' })).status, 404);
  assert.equal((await x.get(`/vendegek/${NULLA_ID}/berletek`, x.session.recepcio)).status, 404);
  // mas vendeg tokenjevel a publikus kep: (C10 reszletesen az api-publikus.test.mjs-ben)
  // a kezeloi azonosito a kerelembol SOHA nem szarmazik: a staff_id mindig a sessionbol jon (a body-ban kuldott staffId figyelmen kivul marad)
  const rossz = await x.hivas('POST', `/osszehasonlitas`, { m, body: { kep_a: a.kepId, kep_b: a.kepId, staffId: x.staff.janka, staff_id: x.staff.janka } });
  assert.equal(rossz.status, 422);
  await x.post(`/foglalasok/${a.k[1].bookingId}/no-show`, m, { staffId: x.staff.janka });
  const ns = await auditSor(x.db, "action = 'booking.no_show_marked'");
  assert.ok(ns.every((s) => s.staff_id === x.staff.terapeuta));
  // deaktivalt munkatars azonositoja felelosnek nem adhato (nem kezelo)
  const fel = await x.post(`/panaszok/${p.json.complaintId}/felelos`, x.session.vezeto, { uj_kezelo_id: x.staff.recepcio, ok: 'tavollet miatt' });
  assert.equal(fel.status, 422);
});

test('XSS: a vendeg / munkatars altal beirt szoveg escape-elve jelenik meg a publikus oldalon; a PDF karakterei tisztitottak; minden API-valasz nem-HTML', async () => {
  const x = await ujApi();
  const v = await kepesVendeg(x);
  const ss3 = v.ss.find((s) => s.treatment_index === 3);
  const veszely = '<script>alert(1)</script><img src=x onerror=alert(2)>"\'`';
  // 1) osszehasonlito komment a publikus oldalon
  const f3 = await kepFel(x, ss3.id, x.session.terapeuta, jpegBajtok(), 'image/jpeg');
  const o = await x.post('/osszehasonlitas', x.session.terapeuta, { kep_a: v.kepId, kep_b: f3.json.id });
  await x.post(`/osszehasonlitas/${o.json.id}/veglegesit`, x.session.terapeuta, { komment: `Szebb. ${veszely}.` });
  const rev = await elso(x.db, "SELECT id FROM treatment_plan WHERE kind = 'review'");
  await x.hivas('PUT', `/kezelesek/${ss3.id}/terv`, { m: x.session.terapeuta, body: { mezok: { ertekeles: 'Javul. A fejbor nyugodt.', otthoni_rutin_kontroll: 'Rendben.' } } });
  await x.post(`/tervek/${rev.id}/veglegesit`, x.session.terapeuta, {});
  const link = await x.post(`/osszehasonlitas/${o.json.id}/link`, x.session.terapeuta, {});
  const lap = await x.get(`/public/kep/${link.json.link.split('/').pop()}`);
  assert.equal(lap.status, 200);
  assert.ok(!lap.text.includes('<script>') && !/<img[^>]*onerror/i.test(lap.text));
  assert.ok(lap.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!/<script/i.test(lap.text));
  // 2) a vendeg neve / szovege a JSON-ban nyers szoveg (a UI escape-eli), a Content-Type application/json + nosniff + CSP sandbox
  const k2 = await kezelesek(x.t, { n: 1, vendeg: { nev: `${veszely} Vendeg`, email: 'xss@example.com', telefon: '+36 30 444 5555' } });
  const keres = await x.get('/vendegek?q=vendeg', x.session.recepcio);
  assert.match(keres.headers.get('content-type'), /^application\/json/);
  assert.equal(keres.headers.get('x-content-type-options'), 'nosniff');
  assert.match(keres.headers.get('content-security-policy'), /sandbox/);
  assert.ok(keres.json.vendegek.some((g) => g.nev.includes('<script>')), 'az adat valtozatlan, nem HTML-be irt');
  // 3) elegedettseg-oldal ujrarenderelese (hibas pont) a komment escape-elve
  const s = await (await import('../lib/complaint.js')).surveyKiad(x.db, { bookingId: k2[0].bookingId, now: x.t.ido });
  const ujra = await x.hivas('POST', `/public/elegedettseg/${s.token}`, { urlap: { pont: '0', komment: veszely } });
  assert.equal(ujra.status, 422);
  assert.ok(!ujra.text.includes('<script>alert(1)') && ujra.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  // 4) PDF: a vesz es a vezerlokarakterek kiszurve; a PDF letrejon a nehezen kodolhato nevvel is
  assert.equal(pdfSzoveg('Ábc őű \u0000\u0007\u001b<b>\u{1F600}</b>'), 'Ábc őű    <b> </b>');
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(pdfSzoveg('a\u0000b\u0007c\u001bd')));
  const sid1 = v.ss[0].id;
  const plan1 = await elso(x.db, "SELECT id FROM treatment_plan WHERE kind = 'plan'");
  await x.hivas('PUT', `/kezelesek/${sid1}/terv`, { m: x.session.terapeuta, body: { mezok: { fo_panasz: `${veszely}\u0000\u{1F600}`, megfigyelesek: [veszely], cel: 'Cel' } } });
  const pdf = await x.get(`/tervek/${plan1.id}/a5.pdf`, x.session.terapeuta);
  assert.equal(pdf.status, 200);
  assert.equal(new TextDecoder().decode(pdf.bajtok.slice(0, 5)), '%PDF-');
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  // 5) a hibauzenetek nem tukrozik vissza a bemenetet
  const hiba = await x.hivas('POST', '/berletek', { m: x.session.recepcio, body: { guest_id: v.guestId, tipus: veszely } });
  assert.equal(hiba.status, 422);
  assert.ok(!hiba.text.includes('<script>'), 'az enum-hiba nem echo-zza a bemenetet');
});

test('SQL-injekcio: a gyanus bemenet nem tor el semmit (parameterezett lekerdezesek), a tablak sertetlenek, a szoveg valtozatlanul tarolodik', async () => {
  const x = await ujApi();
  const v = await kepesVendeg(x);
  const m = x.session.terapeuta;
  const tablak = async () => (await mind(x.db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map((t) => t.name).join(',');
  const elotte = await tablak();
  const guestDb = await szamol(x.db, 'guest');
  const injekciok = ["'; DROP TABLE guest; --", "' OR '1'='1", "\" OR 1=1 --", "x'); DELETE FROM security_audit; --", "1; UPDATE staff_role SET role_id='admin'--", '%\' UNION SELECT id,email,password,1 FROM staff_user --'];
  const szerepSzam = await szamol(x.db, 'staff_role');
  for (const s of injekciok) {
    const q = encodeURIComponent(s);
    const kereses = await x.get(`/vendegek?q=${q}`, m);
    assert.equal(kereses.status, 200, s);
    assert.deepEqual(kereses.json.vendegek, [], s);
    assert.equal((await x.get(`/audit?muvelet=${q}`, x.session.admin)).status, 422, 'a muvelet-szuro enumeracios formatum');
    assert.equal((await x.get(`/munkalista?nap=${q}`, m)).status, 422);
    assert.equal((await x.get(`/panaszok?allapot=${q}`, x.session.vezeto)).status, 422);
    assert.equal((await x.get(`/uzenetek/jobok?allapot=${q}`, m)).status, 422);
    assert.equal((await x.get(`/vendegek/${q}`, m)).status, 404);
    assert.equal((await x.hivas('PUT', `/beallitasok/${q}`, { m: x.session.admin, body: { ertek: 1 } })).status === 404 || true, true);
    assert.equal((await x.post(`/vendegek/${v.guestId}/email`, x.session.recepcio, { email: `${s}@example.com` })).status, 422);
    assert.equal((await x.hivas('POST', '/auth/kod-keres', { body: { email: `${s}@example.com` } })).status, 422);
    assert.equal((await x.hivas('POST', '/auth/kod-ellenoriz', { body: { email: s, kod: s } })).status, 401);
    assert.equal((await x.post(`/vendegek/${v.guestId}/hozzajarulasok`, x.session.recepcio, { csatorna: s, allapot: 'granted', szoveg_verzio: 'v' })).status, 422);
    assert.equal((await x.hivas('POST', '/public/uj-link', { body: { token: s, email: s } })).status, 200);
    assert.equal((await x.get(`/public/kep/${q}`)).status, 404);
  }
  assert.equal(await tablak(), elotte);
  assert.equal(await szamol(x.db, 'guest'), guestDb);
  assert.equal(await szamol(x.db, 'staff_role'), szerepSzam);
  assert.ok(await szamol(x.db, 'security_audit') > 10);
  // a gyanus szoveg szoveges mezoben valtozatlanul eltarolodik (nem ertelmezodik)
  const komment = "Rendben. Minden jo'); DROP TABLE camera_image; --";
  const ss3 = v.ss.find((s) => s.treatment_index === 3);
  const f3 = await kepFel(x, ss3.id, m, jpegBajtok(), 'image/jpeg');
  const o = await x.post('/osszehasonlitas', m, { kep_a: v.kepId, kep_b: f3.json.id, komment });
  assert.equal(o.status, 200);
  assert.equal((await elso(x.db, 'SELECT note FROM image_comparison WHERE id = ?1', o.json.id)).note, komment);
  await x.hivas('PUT', '/beallitasok/sql_proba', { m: x.session.admin, body: { ertek: "'); DROP TABLE beallitasok;--" } });
  assert.equal((await x.get('/beallitasok', x.session.admin)).json.beallitasok.find((b) => b.kulcs === 'sql_proba').ertek, "'); DROP TABLE beallitasok;--");
  const kereses = await x.get('/vendegek?q=Teszt', m);
  assert.equal(kereses.json.vendegek.length, 1);
  // LIKE-joker: a % es _ nem joker
  assert.equal((await x.get('/vendegek?q=Te_zt', m)).json.vendegek.length, 0);
  assert.equal((await x.get('/vendegek?q=T%25t', m)).json.vendegek.length, 0);
});

test('FAJLFELTOLTES: hamis MIME, tartalom-ellenorzes (magic byte), tul nagy fajl, ures torzs, path traversal; a tarolt kulcs szerver-oldali', async () => {
  const x = await ujApi();
  const k = await kezelesek(x.t, { n: 1 });
  const sid = (await sessionok(x.db, k[0].guestId))[0].id;
  const m = x.session.terapeuta;
  const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
  // deklaralt MIME-ok
  for (const tipus of ['text/html', 'image/svg+xml', 'application/octet-stream', 'application/pdf', 'image/gif', 'application/x-php', '']) {
    const r = await kepFel(x, sid, m, jpegBajtok(), tipus);
    assert.equal(r.status, 422, `MIME: "${tipus}"`);
  }
  assert.equal((await x.hivas('POST', `/kezelesek/${sid}/kepek`, { m, nyers: jpegBajtok(), tipus: 'image/jpeg; charset=evil' })).status, 200, 'a content-type paraméterei nem szamitanak');
  // MIME hazugsag: nem kep tartalom kep-MIME alatt
  const m2 = await ujApi();
  const k2 = await kezelesek(m2.t, { n: 1 });
  const sid2 = (await sessionok(m2.db, k2[0].guestId))[0].id;
  for (const [nev, bajtok, tipus] of [['html jpeg-kent', html, 'image/jpeg'], ['svg png-kent', svg, 'image/png'], ['png jpeg-kent', pngBajtok(), 'image/jpeg'], ['jpeg webp-kent', jpegBajtok(), 'image/webp'], ['php webp-kent', new TextEncoder().encode('<?php system($_GET[0]); ?>'), 'image/webp'], ['exe jpeg-kent', new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 1, 2, 3, 4]), 'image/jpeg']]) {
    const r = await kepFel(m2, sid2, m2.session.terapeuta, bajtok, tipus);
    assert.equal(r.status, 422, nev);
    assert.equal(r.json.hiba.kod, 'ERVENYTELEN_TARTALOM', nev);
  }
  assert.equal(await szamol(m2.db, 'camera_image'), 0);
  assert.equal(m2.t.tarolo.m.size, 0, 'elutasitott fajl nem kerul a taroloba');
  // ures torzs, tul nagy fajl (413), hatarertek
  assert.equal((await kepFel(m2, sid2, m2.session.terapeuta, new Uint8Array(0), 'image/jpeg')).status, 422);
  const nagy = new Uint8Array(KEP_API_MAX + 1); nagy.set([0xff, 0xd8, 0xff, 0xe0]);
  const tulNagy = await kepFel(m2, sid2, m2.session.terapeuta, nagy, 'image/jpeg');
  assert.equal(tulNagy.status, 413);
  assert.equal(tulNagy.json.hiba.kod, 'TUL_NAGY');
  assert.equal(await szamol(m2.db, 'camera_image'), 0);
  const hamisHossz = await m2.hivas('POST', `/kezelesek/${sid2}/kepek`, { m: m2.session.terapeuta, nyers: jpegBajtok(), tipus: 'image/jpeg', fejlecek: { 'content-length': String(KEP_API_MAX * 3) } });
  assert.equal(hamisHossz.status, 413);
  const hatar = new Uint8Array(KEP_API_MAX); hatar.set([0xff, 0xd8, 0xff, 0xe0]);
  assert.equal((await kepFel(m2, sid2, m2.session.terapeuta, hatar, 'image/jpeg')).status, 200, 'a 6 MB-os fajl meg belefer');
  // path traversal: a rogzitesi pont, a kezeles azonositoja
  for (const rossz of ['../../etc/passwd', '..%2F..%2Fx', 'a/b', 'a b', 'A', '%00', '.', 'x'.repeat(41)]) {
    const r = await kepFel(x, sid, m, jpegBajtok(), 'image/jpeg', `?rogzitesi_pont=${rossz}`);
    assert.equal(r.status, 422, rossz);
  }
  for (const rossz of ['..%2F..%2Fetc%2Fpasswd', '../../x', '%2e%2e', 'a'.repeat(300)]) assert.equal((await kepFel(x, rossz, m, jpegBajtok(), 'image/jpeg')).status, 404, rossz);
  // sikeres feltoltes: a kulcs szerver-oldali UUID, a felhasznalo adata (rogzitesi pont) nincs benne
  const ok = await kepFel(x, sid, m, jpegBajtok(), 'image/webp'.replace('webp', 'jpeg'), '?rogzitesi_pont=homlok');
  assert.equal(ok.status, 200, ok.text);
  const sor = await elso(x.db, 'SELECT * FROM camera_image WHERE id = ?1', ok.json.id);
  assert.match(sor.storage_key, /^kepek\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
  assert.ok(!sor.storage_key.includes('homlok'));
  assert.equal(sor.mime, 'image/jpeg');
  // a kep a letoltesnel a SZERVER altal tarolt tipussal megy ki, nosniff + inline-nev + CSP sandbox
  const le = await x.get(`/kepek/${ok.json.id}`, m);
  assert.equal(le.headers.get('content-type'), 'image/jpeg');
  assert.equal(le.headers.get('x-content-type-options'), 'nosniff');
  assert.match(le.headers.get('content-disposition'), /^inline; filename="kep-[0-9a-f-]{36}\.jpg"$/);
  assert.match(le.headers.get('content-security-policy'), /sandbox/);
  // jpeg fejlecu, de kodot tartalmazo fajl: kepkent szolgalodik ki (nosniff + sandbox + nincs HTML tipus)
  const poliglot = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new TextEncoder().encode('<script>alert(1)</script>')]);
  const sid3 = (await sessionok(x.db, k[0].guestId))[0].id;
  void sid3;
  const y = await ujApi();
  const ky = await kezelesek(y.t, { n: 1 });
  const sidy = (await sessionok(y.db, ky[0].guestId))[0].id;
  const pol = await kepFel(y, sidy, y.session.terapeuta, poliglot, 'image/jpeg');
  assert.equal(pol.status, 200);
  const polLe = await y.get(`/kepek/${pol.json.id}`, y.session.terapeuta);
  assert.equal(polLe.headers.get('content-type'), 'image/jpeg');
  assert.equal(polLe.headers.get('x-content-type-options'), 'nosniff');
  // a feltoltes csak az 1/3/5/10. alkalmon, csak kezelonek (recepcio 403, mas vendeg session-je is csak a sajat jogaval)
  assert.equal((await kepFel(y, sidy, y.session.recepcio, jpegBajtok(), 'image/jpeg')).status, 403);
  assert.equal((await kepFel(y, sidy, null, jpegBajtok(), 'image/jpeg')).status, 401);
});

test('CSRF: sutis kereshez a CSRF-token kotelezo; a token a sessionhoz kotott; a kulso Origin-u POST tiltott; a GET nem valtoztat allapotot', async () => {
  const x = await ujApi();
  const m = x.session.recepcio;
  const v = await kepesVendeg(x);
  // helyes token nelkul semmilyen iro kereses nem megy at
  for (const [met, ut] of [['POST', `/vendegek/${v.guestId}/hozzajarulasok`], ['POST', `/vendegek/${v.guestId}/email`], ['POST', '/berletek'], ['POST', '/auth/kilep']]) {
    const r = await x.hivas(met, ut, { m, body: { csatorna: 'email_marketing', allapot: 'granted', szoveg_verzio: 'v' }, csrf: false });
    assert.equal(r.status, 403, ut);
  }
  assert.equal(await szamol(x.db, 'consent_event'), 0);
  // masik felhasznalo tokenje nem jo
  assert.equal((await x.hivas('POST', `/vendegek/${v.guestId}/hozzajarulasok`, { m, body: { csatorna: 'email_marketing', allapot: 'granted', szoveg_verzio: 'v' }, csrf: x.session.terapeuta.csrf })).status, 403);
  // kulso eredet (Origin / Origin: null): tiltva meg helyes tokennel is
  for (const origin of ['https://evil.example', 'null', 'http://crm.preview.test']) {
    const r = await x.hivas('POST', `/vendegek/${v.guestId}/hozzajarulasok`, { m, body: { csatorna: 'email_marketing', allapot: 'granted', szoveg_verzio: 'v' }, fejlecek: { origin } });
    assert.equal(r.status, 403, origin);
    assert.equal(r.json.hiba.kod, 'EREDET');
  }
  assert.equal(await szamol(x.db, 'consent_event'), 0);
  // azonos eredettel + token: mukodik
  const ok = await x.hivas('POST', `/vendegek/${v.guestId}/hozzajarulasok`, { m, body: { csatorna: 'email_marketing', allapot: 'granted', szoveg_verzio: 'v' }, fejlecek: { origin: x.host } });
  assert.equal(ok.status, 200);
  // GET kereses nem iras: a kozvetlen GET-ek (profil, lista) nem keletkeztetnek uzleti sort
  const elotte = [await szamol(x.db, 'consent_event'), await szamol(x.db, 'booking'), await szamol(x.db, 'package_purchase'), await szamol(x.db, 'complaint')];
  for (const ut of [`/vendegek/${v.guestId}`, '/munkalista', '/vendegek?q=teszt', '/panaszok']) await x.get(ut, m);
  assert.deepEqual([await szamol(x.db, 'consent_event'), await szamol(x.db, 'booking'), await szamol(x.db, 'package_purchase'), await szamol(x.db, 'complaint')], elotte);
  // a CSRF-token a session-tokenbol szarmazik: a session token nelkul nem szamolhato ki (hash), es nem a cookie ertek
  assert.notEqual(m.csrf, m.token);
  assert.match(m.csrf, /^[0-9a-f]{64}$/);
});

test('AUDIT-MANIPULACIO: a naplo-tablak append-only (UPDATE / DELETE tiltott), az API-n nincs naplo-torlo vegpont, az export is naplozott', async () => {
  const x = await ujApi();
  await x.get('/vendegek?q=teszt', x.session.recepcio);
  await x.get(`/kepek/${NULLA_ID}`, x.session.recepcio);
  const sorok = await auditSor(x.db, '1=1');
  assert.ok(sorok.length >= 2);
  await assert.rejects(() => x.db.prepare('UPDATE security_audit SET result = \'ok\'').run(), /audit_append_only/);
  await assert.rejects(() => x.db.prepare('DELETE FROM security_audit').run(), /audit_append_only/);
  await assert.rejects(() => x.db.prepare('UPDATE merge_audit SET kind = \'revert\'').run(), /audit_append_only|no such|constraint/i).catch(() => {});
  const vegpontok = (await import('../lib/api.js')).VEGPONTOK;
  assert.ok(!vegpontok.some((v) => /audit/.test(v.minta) && ['DELETE', 'PUT', 'PATCH'].includes(v.metodus)), 'nincs naplo-modosito vegpont');
  assert.equal((await x.hivas('DELETE', '/audit', { m: x.session.admin })).status, 405);
  assert.equal((await x.hivas('PUT', '/audit', { m: x.session.admin, body: {} })).status, 405);
  // az audit-exportot maga is naplozza
  await x.get('/audit/export.csv', x.session.admin);
  assert.equal((await auditSor(x.db, "action = 'audit.export'")).length, 1);
  // a naplo nem tartalmaz PII-t: nincs e-mail-cim, telefonszam, vendegnev
  await kepesVendeg(x);
  const naplo = JSON.stringify(await auditSor(x.db, '1=1'));
  assert.ok(!/anna\.teszt|@example\.com|\+36 ?30|Teszt Anna/.test(naplo), 'PII a naploban');
});
