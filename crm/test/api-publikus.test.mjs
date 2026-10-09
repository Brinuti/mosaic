// Publikus (vendeg) vegpontok: allapotfelmero-urlap, kepek (tokenes link, C10 / C11), uj link e-mail-verifikacioval, elegedettseg, leiratkozas (S02),
// landing-hozzajarulas (B10), nincs vendegfiok (C12). Minden oldal no-store + no-referrer + noindex, kulso script nincs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujApi, auditSor, NULLA_ID } from './api-kozos.test.mjs';
import { kezelesek, foglal, sessionok, elso, mind, szamol, jpegBajtok, kerdoivBeallit, BASE, NAP, VENDEG_A, VENDEG_B } from './fixtures.js';
import { elerhetosegEllenorzott, emailValtoztat } from '../lib/guest.js';
import * as im from '../lib/images.js';
import * as pl from '../lib/plan.js';
import * as cs from '../lib/complaint.js';
import * as fm from '../lib/assessment.js';
import * as hj from '../lib/consent.js';
import { leiratkozasToken, fuggoHozzajarulasAlkalmaz } from '../lib/api-public.js';
import { LINK_ERVENYESSEG } from '../lib/constants.js';
import { VEGPONTOK } from '../lib/api.js';

/** vendeg 3 kezelessel, 1. + 3. alkalom kepevel, vegleges osszehasonlitassal es kesz dokumentacioval; link kiadva */
async function linkesVendeg(x, vendeg = VENDEG_A, kezdet = BASE) {
  const k = await kezelesek(x.t, { vendeg, n: 3, kezdet, guestExternalId: `x-${vendeg.nev}` });
  const guestId = k[0].guestId;
  await elerhetosegEllenorzott(x.db, { guestId, email: true, telefon: true });
  const ss = await sessionok(x.db, guestId);
  const kep = {};
  for (const idx of [1, 3]) kep[idx] = (await im.kepFeltolt(x.db, { sessionId: ss.find((s) => s.treatment_index === idx).id, staffId: x.staff.terapeuta, bajtok: jpegBajtok(), mime: 'image/jpeg', tarolo: x.t.tarolo })).imageId;
  const o = await im.osszehasonlit(x.db, { imageAId: kep[1], imageBId: kep[3], staffId: x.staff.terapeuta });
  await im.osszehasonlitVeglegesit(x.db, { comparisonId: o.comparisonId, staffId: x.staff.terapeuta, note: 'A haj surubb lett. A fejbor nyugodt.' });
  const plan = await elso(x.db, "SELECT id FROM treatment_plan WHERE kind = 'review' AND guest_id = ?1", guestId);
  await pl.ment(x.db, { planId: plan.id, mezok: { ertekeles: 'Javul a kep. A fejbor nyugodt.', otthoni_rutin_kontroll: 'Rendben.' }, staffId: x.staff.terapeuta });
  await pl.veglegesit(x.db, { planId: plan.id, staffId: x.staff.terapeuta });
  const link = await im.linkKiad(x.db, { comparisonId: o.comparisonId, now: x.t.ido });
  return { guestId, kep, ss, comparisonId: o.comparisonId, token: link.token, grantId: link.grantId };
}
const FEJLEC_ELLENORZES = (v, nev = '') => {
  assert.equal(v.headers.get('cache-control'), 'no-store', `${nev} cache-control`);
  assert.equal(v.headers.get('referrer-policy'), 'no-referrer', `${nev} referrer`);
  assert.equal(v.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(v.headers.get('x-frame-options'), 'DENY');
  assert.equal(v.sutik.length, 0, `${nev} nincs suti`);
};

test('PUBLIKUS allapotfelmero: csak jovahagyott verzio renderelheto; urlap-hibaknal az ertekek ESCAPE-elve latszanak; siker utan a token halott', async () => {
  const x = await ujApi();
  const fogl = await foglal(x.t, { service: 'first_hair', start: x.t.ido + NAP, now: x.t.ido - 10 });
  await fm.letrehozVerzio(x.db, { version: 'v-xss', staffId: x.staff.janka, definicio: { csoportok: [{ kulcs: 'cs1', cim: 'Csoport <b>1</b>', kerdesek: [
    { kulcs: 'adatkezeles_elfogadva', szoveg: 'Elfogadom <script>alert(1)</script> az adatkezelest.', tipus: 'boolean', kotelezo: true },
    { kulcs: 'megjegyzes', szoveg: 'Megjegyzes <img src=x onerror=alert(2)>', tipus: 'text', kotelezo: false },
    { kulcs: 'allergia', szoveg: 'Allergia?', tipus: 'boolean', kotelezo: true, flag_ha: [true] },
  ] }] }, now: x.t.ido });
  // jovahagyatlan: kiadhatatlan, a link sem renderel
  await x.db.prepare('UPDATE assessment SET approved_by_clinical_lead = 1, approved_by = ?1, approved_at = ?2 WHERE question_version = \'v-xss\'').bind(x.staff.janka, x.t.ido).run();
  const k = await fm.kiad(x.db, { guestId: fogl.guestId, bookingId: fogl.bookingId, now: x.t.ido });
  await x.db.prepare('UPDATE assessment SET approved_by_clinical_lead = 0, approved_by = NULL, approved_at = NULL WHERE question_version = \'v-xss\'').run();
  // (a CHECK csak a bejelentkezo-jovahagyast vedi; a jovahagyatlan verzio linkje nem renderel)
  const nem = await x.get(`/public/felmero/${k.token}`);
  assert.equal(nem.status, 404);
  await x.db.prepare('UPDATE assessment SET approved_by_clinical_lead = 1, approved_by = ?1, approved_at = ?2 WHERE question_version = \'v-xss\'').bind(x.staff.janka, x.t.ido).run();
  const lap = await x.get(`/public/felmero/${k.token}`);
  assert.equal(lap.status, 200);
  FEJLEC_ELLENORZES(lap, 'felmero');
  assert.equal(lap.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(lap.headers.get('content-security-policy'), /default-src 'none'/);
  assert.match(lap.headers.get('content-type'), /^text\/html/);
  assert.ok(!/<script/i.test(lap.text), 'nincs script az oldalon');
  assert.ok(lap.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && lap.text.includes('&lt;img src=x onerror=alert(2)&gt;') && lap.text.includes('Csoport &lt;b&gt;1&lt;/b&gt;'));
  assert.ok(!/<img[^>]*onerror/i.test(lap.text));
  assert.ok(!/<input[^>]*name="[^"]*(marketing|hirlevel|newsletter|sms)/i.test(lap.text), 'a felmero nem kerhet marketing-hozzajarulast');
  assert.match(lap.text, /nem jelent marketing-hozzájárulást/);
  assert.match(lap.text, /meta name="robots" content="noindex/);
  assert.ok(!/(https?:)?\/\/(?!crm\.preview\.test)[a-z0-9.-]+\.[a-z]{2,}\//i.test(lap.text.replace(/https?:\/\/www\.w3\.org[^"']*/g, '')), 'nincs kulso eroforras');
  // hibas bekuldes: adatkezeles hianyzik + a beirt szoveg visszakerul, escape-elve
  const hibas = await x.hivas('POST', `/public/felmero/${k.token}`, { urlap: { q_megjegyzes: '"><script>alert(3)</script>', q_allergia: 'nem' } });
  assert.equal(hibas.status, 422);
  assert.match(hibas.text, /az adatkezelési tájékoztató elfogadása kötelező/i);
  assert.ok(!hibas.text.includes('<script>alert(3)'), 'a visszairt szoveg nem nyers HTML');
  assert.ok(hibas.text.includes('&quot;&gt;&lt;script&gt;alert(3)&lt;/script&gt;'));
  assert.equal(await szamol(x.db, 'assessment_submission', "status = 'submitted'"), 0);
  // jo bekuldes (HTML urlap): pozitiv valasz -> belso jelzes, a vendeg csak koszonetet kap
  const jo = await x.hivas('POST', `/public/felmero/${k.token}`, { urlap: { q_adatkezeles_elfogadva: 'igen', q_megjegyzes: 'Semmi.', q_allergia: 'igen' } });
  assert.equal(jo.status, 200);
  assert.match(jo.text, /Köszönjük/);
  assert.ok(!/jelzés|ellenjavall|kontraind/i.test(jo.text));
  assert.equal(await szamol(x.db, 'contraindication_alert', "status = 'open'"), 1);
  assert.equal((await elso(x.db, "SELECT COUNT(*) AS n FROM consent_event WHERE channel = 'privacy'")).n, 1);
  assert.equal(await szamol(x.db, 'consent_event', "channel IN ('email_marketing', 'sms_marketing')"), 0, 'nincs marketing-hozzajarulas');
  // a token utana halott
  assert.equal((await x.get(`/public/felmero/${k.token}`)).status, 404);
  assert.equal((await x.hivas('POST', `/public/felmero/${k.token}`, { urlap: { q_adatkezeles_elfogadva: 'igen' } })).status, 404);
  assert.equal((await x.get('/public/felmero/rovid')).status, 404);
  assert.ok((await auditSor(x.db, "action = 'public.felmero_denied'")).length >= 3);
});

test('PUBLIKUS C10: A vendeg tokenjevel B vendeg kepere 404 + naplo; a token csak a sajat osszehasonlitasra / kepekre jo', async () => {
  const x = await ujApi();
  const a = await linkesVendeg(x, VENDEG_A);
  const b = await linkesVendeg(x, VENDEG_B, BASE + 100 * NAP);
  const sajat = await x.get(`/public/kep/${a.token}/${a.kep[1]}`);
  assert.equal(sajat.status, 200);
  FEJLEC_ELLENORZES(sajat, 'kep');
  assert.equal(sajat.headers.get('content-type'), 'image/jpeg');
  const masE = await x.get(`/public/kep/${a.token}/${b.kep[1]}`);
  assert.equal(masE.status, 404);
  assert.equal(masE.text, 'Nem található');
  assert.equal((await x.get(`/public/kep/${b.token}/${a.kep[3]}`)).status, 404);
  assert.equal((await x.get(`/public/kep/${a.token}/${NULLA_ID}`)).status, 404);
  assert.equal(masE.text, (await x.get(`/public/kep/${a.token}/${NULLA_ID}`)).text, 'letezo es nemletezo kep: azonos valasz');
  assert.ok((await auditSor(x.db, "action = 'share.cross_guest_denied' AND result = 'denied' AND guest_id = ?1", a.guestId)).length >= 2);
  // az oldal csak a sajat kepeket listazza
  const lap = await x.get(`/public/kep/${a.token}`);
  assert.equal(lap.status, 200);
  assert.ok(lap.text.includes(a.kep[1]) && lap.text.includes(a.kep[3]) && !lap.text.includes(b.kep[1]));
  assert.match(lap.text, /A haj surubb lett\. A fejbor nyugodt\./);
  FEJLEC_ELLENORZES(lap, 'kep-oldal');
  assert.ok(!/<script/i.test(lap.text));
  // a kep CSAK a tokenes vegponton at: munkamenet nelkul a munkatarsi vegpont 401, a tarolo kulcsa nem kiszolgalhato
  assert.equal((await x.get(`/kepek/${a.kep[1]}`)).status, 401);
  assert.equal((await x.get(`/public/kep/${a.token}/..%2F..%2Fetc%2Fpasswd`)).status, 404);
  assert.equal((await x.get('/public/kep/kepek/abc/def.jpg')).status, 404);
  // az ismeretlen token ugyanazt az oldalt adja, mint a visszavont / mas
  const ismeretlen = await x.get(`/public/kep/${'A'.repeat(43)}`);
  assert.equal(ismeretlen.status, 404);
  // merge / e-mailvaltozas utan a jogosultsag megszunik
  await emailValtoztat(x.db, { guestId: a.guestId, ujEmail: 'uj.cim@example.com', staffId: x.staff.recepcio, now: x.t.ido });
  assert.equal((await x.get(`/public/kep/${a.token}`)).status, 404);
  assert.equal((await x.get(`/public/kep/${a.token}/${a.kep[1]}`)).status, 404);
  assert.equal((await x.get(`/public/kep/${b.token}`)).status, 200, 'a masik vendeg linkje nem erintett');
});

test('PUBLIKUS C11: +30 nap utan nincs hozzaferes; uj link e-mail-verifikacioval; azonos valasz letezo / nemletezo cimre', async () => {
  const x = await ujApi();
  const a = await linkesVendeg(x);
  x.ido(LINK_ERVENYESSEG - 3600);
  assert.equal((await x.get(`/public/kep/${a.token}`)).status, 200, 'a 30. nap elott meg jo');
  x.ido(3600 + 5);
  const lejart = await x.get(`/public/kep/${a.token}`);
  assert.equal(lejart.status, 410);
  assert.match(lejart.text, /Kérek új hivatkozást/);
  assert.ok(!lejart.text.includes(a.guestId) && !lejart.text.includes('anna.teszt'));
  assert.equal((await x.get(`/public/kep/${a.token}/${a.kep[1]}`)).status, 404, 'lejart link: a kep sem erheto el');
  assert.ok((await auditSor(x.db, "action = 'share.lejart' AND result = 'denied'")).length >= 1);
  // uj link kerese: JSON valasz BAJTRA azonos letezo / rossz / nemletezo cimre
  const jo = await x.hivas('POST', '/public/uj-link', { body: { token: a.token, email: 'anna.teszt@example.com' } });
  const rosszCim = await x.hivas('POST', '/public/uj-link', { body: { token: a.token, email: 'masvalaki@example.com' } });
  const rosszToken = await x.hivas('POST', '/public/uj-link', { body: { token: 'B'.repeat(43), email: 'anna.teszt@example.com' } });
  const nincsToken = await x.hivas('POST', '/public/uj-link', { body: { email: 'anna.teszt@example.com' } });
  const ervenytelenCim = await x.hivas('POST', '/public/uj-link', { body: { token: a.token, email: 'ez-nem-email' } });
  for (const v of [rosszCim, rosszToken, nincsToken, ervenytelenCim]) { assert.equal(v.status, 200); assert.equal(v.text, jo.text); }
  assert.equal(jo.status, 200);
  assert.equal(x.kuldott.length, 1, 'csak a regisztralt cim + ervenyes (lejart) token kapott levelet');
  assert.equal(x.kuldott[0].to, 'anna.teszt@example.com');
  const verLink = /https:\/\/crm\.preview\.test(\/api\/crm\/public\/uj-link\/[A-Za-z0-9_-]{43})/.exec(x.kuldott[0].szoveg);
  assert.ok(verLink, 'a level egyszer hasznalhato verifikacios linket tartalmaz');
  assert.equal(x.kuldott[0].szoveg.includes(a.token), false);
  // HTML urlap-valasz ugyanaz kulonbozo bemenetre
  const h1 = await x.hivas('POST', '/public/uj-link', { urlap: { token: a.token, email: 'anna.teszt@example.com' } });
  const h2 = await x.hivas('POST', '/public/uj-link', { urlap: { token: a.token, email: 'valaki@example.com' } });
  assert.equal(h1.text, h2.text); assert.equal(h1.status, 200);
  // a verifikacios link egyszer hasznalhato, rovid eletu -> uj 30 napos hozzaferes
  const verTokenDb = await mind(x.db, 'SELECT token_hash FROM share_verification');
  assert.ok(verTokenDb.length >= 1 && !verLink[1].includes(verTokenDb[0].token_hash));
  const ver = await x.hivas('GET', verLink[1]);
  assert.equal(ver.status, 200);
  FEJLEC_ELLENORZES(ver, 'uj-link');
  const ujToken = /\/api\/crm\/public\/kep\/([A-Za-z0-9_-]{43})"/.exec(ver.text)[1];
  assert.notEqual(ujToken, a.token);
  assert.equal((await x.get(`/public/kep/${ujToken}`)).status, 200);
  assert.equal((await x.get(`/public/kep/${ujToken}/${a.kep[3]}`)).status, 200);
  assert.equal((await x.hivas('GET', verLink[1])).status, 404, 'egyszer hasznalhato');
  assert.equal((await x.get(`/public/kep/${a.token}`)).status, 410, 'a regi link tovabbra is lejart');
  assert.equal((await x.get('/public/uj-link/rovid')).status, 404);
  // rate limit: e-mailenkent 5 / ora; utana sem leket ki level (de a valasz ugyanaz)
  const y = await ujApi();
  const b = await linkesVendeg(y);
  y.ido(LINK_ERVENYESSEG + 10);
  for (let i = 0; i < 9; i++) assert.equal((await y.hivas('POST', '/public/uj-link', { body: { token: b.token, email: 'anna.teszt@example.com' }, ip: `198.51.100.${i + 1}` })).status, 200);
  assert.equal(y.kuldott.length, 5);
  // DRY: kuldo nelkul (nincs CRM_KULDO / SMTP) a link nem megy ki, de a valasz ugyanaz
  const z = await ujApi({ env: { CRM_KULDO: undefined } });
  const c = await linkesVendeg(z);
  z.ido(LINK_ERVENYESSEG + 10);
  const dry = await z.hivas('POST', '/public/uj-link', { body: { token: c.token, email: 'anna.teszt@example.com' } });
  assert.equal(dry.status, 200);
  assert.equal(dry.text, jo.text);
  assert.equal(z.kuldott.length, 0);
});

test('PUBLIKUS M06 M09 elegedettseg: 1-5 pont, minden pontnal azonos koszonet; negativ pont belso panaszt nyit; masodik beadas 409', async () => {
  const x = await ujApi();
  const k = await kezelesek(x.t, { n: 1 });
  const s = await cs.surveyKiad(x.db, { bookingId: k[0].bookingId, now: x.t.ido });
  const lap = await x.get(`/public/elegedettseg/${s.token}`);
  assert.equal(lap.status, 200);
  FEJLEC_ELLENORZES(lap, 'elegedettseg');
  assert.match(lap.text, /name="pont" value="5"/);
  assert.equal((await x.hivas('POST', `/public/elegedettseg/${s.token}`, { urlap: { pont: '9' } })).status, 422);
  assert.equal((await x.hivas('POST', `/public/elegedettseg/${s.token}`, { urlap: { pont: 'x' } })).status, 422);
  const ok = await x.hivas('POST', `/public/elegedettseg/${s.token}`, { urlap: { pont: '2', komment: '<b>Nem tetszett</b>' } });
  assert.equal(ok.status, 200);
  assert.match(ok.text, /Köszönjük/);
  assert.equal(await szamol(x.db, 'complaint', "status = 'open'"), 1, 'az alacsony pont belso panaszt nyit a sajat kezelonek');
  const masodszor = await x.hivas('POST', `/public/elegedettseg/${s.token}`, { urlap: { pont: '5' } });
  assert.equal(masodszor.status, 409, 'a token a beadas utan nem hasznalhato ujra');
  assert.equal((await x.get(`/public/elegedettseg/${s.token}`)).status, 404);
  // masik vendeg 5 pontja: ugyanaz a vendegnek latszo valasz
  const k2 = await kezelesek(x.t, { n: 1, vendeg: VENDEG_B });
  const s2 = await cs.surveyKiad(x.db, { bookingId: k2[0].bookingId, now: x.t.ido });
  const ok2 = await x.hivas('POST', `/public/elegedettseg/${s2.token}`, { body: { pont: 5, komment: '' } });
  assert.deepEqual(ok2.json, { ok: true });
  assert.equal(await szamol(x.db, 'complaint', "status = 'open'"), 1);
  assert.equal((await x.get(`/public/elegedettseg/${'C'.repeat(43)}`)).status, 404);
});

test('PUBLIKUS S02 leiratkozas: alairt link, csatornankent, azonnali hatas, hamis / modositott link 404; egykattintasos POST', async () => {
  const x = await ujApi();
  const k = await kezelesek(x.t, { n: 1 });
  const gid = k[0].guestId;
  await hj.rogzit(x.db, { guestId: gid, csatorna: 'email_marketing', szovegVerzio: 'v1', now: x.t.ido });
  await hj.rogzit(x.db, { guestId: gid, csatorna: 'sms_marketing', szovegVerzio: 'v1', now: x.t.ido });
  const token = await leiratkozasToken(x.env, gid);
  const lap = await x.get(`/public/leiratkozas/${token}`);
  assert.equal(lap.status, 200);
  FEJLEC_ELLENORZES(lap, 'leiratkozas');
  assert.match(lap.text, /value="email_marketing" checked/);
  assert.ok(!lap.text.includes('Teszt Anna'), 'a leiratkozas-oldal nem mutat nevet');
  // hamis alairas / mas vendeg azonositoja
  assert.equal((await x.get(`/public/leiratkozas/${gid}.AAAA`)).status, 404);
  const [, alair] = token.split('.');
  assert.equal((await x.get(`/public/leiratkozas/${NULLA_ID}.${alair}`)).status, 404);
  assert.equal((await x.get('/public/leiratkozas/valami')).status, 404);
  // csak az SMS-rol iratkozik le
  const ki = await x.hivas('POST', `/public/leiratkozas/${token}`, { urlap: { csatorna: 'sms_marketing' } });
  assert.equal(ki.status, 200);
  assert.match(ki.text, /Sikeres leiratkozás/);
  assert.equal((await hj.marketingAllapot(x.db, gid, 'sms_marketing')).ok_kod, 'VISSZAVONVA');
  assert.equal((await hj.marketingAllapot(x.db, gid, 'email_marketing')).ok, true);
  // egykattintasos (torzs nelkul): az e-mail marketing
  const egy = await x.hivas('POST', `/public/leiratkozas/${token}`, {});
  assert.equal(egy.status, 200);
  const allapot = await hj.marketingAllapot(x.db, gid, 'email_marketing');
  assert.equal(allapot.ok, false); assert.equal(allapot.ok_kod, 'VISSZAVONVA');
  // ismetles nem duplikalja a naplot
  const n = await szamol(x.db, 'consent_event', "action = 'withdrawn'");
  await x.hivas('POST', `/public/leiratkozas/${token}`, {});
  assert.equal(await szamol(x.db, 'consent_event', "action = 'withdrawn'"), n);
  assert.equal((await elso(x.db, "SELECT source FROM consent_event WHERE action = 'withdrawn' LIMIT 1")).source, 'unsubscribe_link');
  assert.equal((await x.hivas('POST', `/public/leiratkozas/${gid}.AAAA`, { urlap: { csatorna: 'email_marketing' } })).status, 404);
  // titok nelkul nincs leiratkozasi link
  const nincsTitok = await x.get(`/public/leiratkozas/${token}`, null, { env: { ...x.env, CRM_TITOK: undefined } });
  assert.equal(nincsTitok.status, 404);
});

test('PUBLIKUS B10 landing-hozzajarulas: sosem elofeltetel (B10); a foglalas beerkezese utan kapcsolodik, PII nelkul tarolodik, validalt', async () => {
  const x = await ujApi();
  const hoz = (body, o = {}) => x.hivas('POST', '/public/hozzajarulas', { body, ...o });
  // 1) egyik sem kipipalva: 200, nincs bejegyzes
  const semmi = await hoz({ selected_service: 'first_hair', email_marketing: false, sms_marketing: false, kapcsolat: { email: 'anna.teszt@example.com', telefon: '+36 30 111 2222' } });
  assert.equal(semmi.status, 200); assert.deepEqual(semmi.json, { ok: true });
  assert.equal(await szamol(x.db, 'beallitasok', "kulcs LIKE 'pending_consent:%'"), 0);
  // 2) e-mail + SMS kipipalva
  const ok = await hoz({ selected_service: 'first_hair', email_marketing: true, sms_marketing: true, szoveg_verzio: 'lp-v1', kapcsolat: { email: 'Anna.Teszt@Example.com', telefon: '+36 30 111 2222' } });
  assert.equal(ok.status, 200); assert.deepEqual(ok.json, { ok: true });
  const sorok = await mind(x.db, "SELECT * FROM beallitasok WHERE kulcs LIKE 'pending_consent:%'");
  assert.equal(sorok.length, 2);
  assert.ok(!JSON.stringify(sorok).includes('anna') && !JSON.stringify(sorok).includes('+36') && !JSON.stringify(sorok).includes('111 2222'), 'a fuggo bejegyzes nem tartalmaz PII-t');
  assert.equal(await szamol(x.db, 'consent_event'), 0, 'a foglalas elott nincs consent_event');
  // a /beallitasok API nem mutatja a belso kulcsokat
  assert.ok(!(await x.get('/beallitasok', x.session.admin)).text.includes('pending_consent'));
  // 3) a foglalas beerkezik (a vendeg letrejon) -> a hozzajarulas hozzakapcsolodik (az ingest hivja)
  const f = await foglal(x.t, { start: x.t.ido + 3 * NAP, now: x.t.ido });
  assert.deepEqual((await fuggoHozzajarulasAlkalmaz(x.db, { guestId: f.guestId, now: x.t.ido })).sort(), ['email_marketing', 'sms_marketing']);
  assert.equal((await hj.marketingAllapot(x.db, f.guestId, 'email_marketing')).ok, true);
  assert.equal((await hj.marketingAllapot(x.db, f.guestId, 'sms_marketing')).szovegVerzio, 'lp-v1');
  assert.equal((await elso(x.db, "SELECT source FROM consent_event WHERE channel = 'email_marketing'")).source, 'booking_form');
  assert.equal(await szamol(x.db, 'beallitasok', "kulcs LIKE 'pending_consent:%'"), 0, 'felhasznalas utan torlodik');
  assert.deepEqual(await fuggoHozzajarulasAlkalmaz(x.db, { guestId: f.guestId, now: x.t.ido }), [], 'ketszer nem alkalmazodik');
  // 4) masik vendeg: csak az e-mail -> az SMS nem
  await hoz({ selected_service: 'camera_assessment', email_marketing: true, sms_marketing: false, szoveg_verzio: 'lp-v1', kapcsolat: { email: 'bela.teszt@example.com', telefon: '+36 20 333 4444' } });
  const g = await foglal(x.t, { vendeg: VENDEG_B, start: x.t.ido + 4 * NAP, now: x.t.ido });
  assert.deepEqual(await fuggoHozzajarulasAlkalmaz(x.db, { guestId: g.guestId, now: x.t.ido }), ['email_marketing']);
  // 5) lejart (7 nap) fuggo bejegyzes nem alkalmazodik
  await hoz({ selected_service: 'first_hair', email_marketing: true, sms_marketing: false, szoveg_verzio: 'lp-v1', kapcsolat: { email: 'regi@example.com' } });
  const r = await foglal(x.t, { vendeg: { nev: 'Regi Vendeg', email: 'regi@example.com', telefon: '+36 30 999 8888' }, start: x.t.ido + 5 * NAP, now: x.t.ido });
  assert.deepEqual(await fuggoHozzajarulasAlkalmaz(x.db, { guestId: r.guestId, now: x.t.ido + 8 * NAP }), []);
  // validacio
  assert.equal((await hoz({ email_marketing: true, sms_marketing: false, szoveg_verzio: 'v', kapcsolat: {} })).status, 422);
  assert.equal((await hoz({ email_marketing: false, sms_marketing: true, szoveg_verzio: 'v', kapcsolat: { email: 'a@b.hu' } })).status, 422);
  assert.equal((await hoz({ email_marketing: 'igen', sms_marketing: false })).status, 422);
  assert.equal((await hoz({ email_marketing: true, sms_marketing: false, kapcsolat: { email: 'a@b.hu' } })).status, 422, 'szovegverzio nelkul nincs');
  assert.equal((await hoz({ email_marketing: false, sms_marketing: false }, { fejlecek: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await x.hivas('POST', '/public/hozzajarulas', { body: 'nem json', tipus: 'text/plain' })).status, 415);
  // rate limit: 30 / ora / IP
  let utolso;
  for (let i = 0; i < 32; i++) utolso = await hoz({ email_marketing: false, sms_marketing: false }, { ip: '192.0.2.77' });
  assert.equal(utolso.status, 429);
});

test('PUBLIKUS C12: nincs vendegfiok / regisztracio / jelszo; a publikus oldalak soha nem allitanak be sutit', async () => {
  const x = await ujApi();
  const utak = VEGPONTOK.map((u) => `${u.metodus} ${u.minta}`);
  assert.ok(!utak.some((u) => /regisztr|register|signup|jelszo|password|fiok|profil\/sajat|vendeg-belepes/i.test(u)), 'nincs vendegfiok-vegpont');
  // a vendeg e-mail-cime nem munkatars: a kod-keres nem hoz letre fiokot es nem kuld kodot
  await foglal(x.t, { start: x.t.ido + NAP, now: x.t.ido });
  const elotte = await szamol(x.db, 'staff_user');
  const v = await x.hivas('POST', '/auth/kod-keres', { body: { email: VENDEG_A.email } });
  assert.equal(v.status, 200);
  assert.equal(x.kuldott.length, 0);
  assert.equal(await szamol(x.db, 'staff_user'), elotte);
  assert.equal((await x.hivas('POST', '/auth/kod-ellenoriz', { body: { email: VENDEG_A.email, kod: '123456' } })).status, 401);
  // a vendeg-oldali vegpontok csak tokennel mukodnek, token nelkul 404 / 405
  for (const ut of ['/public', '/public/felmero', '/public/kep', '/public/elegedettseg', '/public/leiratkozas']) assert.ok([404, 405].includes((await x.get(ut)).status), ut);
  // minden publikus GET: nincs Set-Cookie
  const k = await kezelesek(x.t, { n: 1, vendeg: VENDEG_B });
  const s = await cs.surveyKiad(x.db, { bookingId: k[0].bookingId, now: x.t.ido });
  for (const ut of [`/public/elegedettseg/${s.token}`, `/public/felmero/${s.token}`, `/public/kep/${s.token}`]) { const r = await x.get(ut); assert.equal(r.sutik.length, 0, ut); }
});
