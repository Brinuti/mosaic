// Lifecycle-esemeny -> CRM ingest tesztek. A fixture a VALODI parser.js (ertelmez) kimenete kitalalt Salonic-ertesitokbol (nincs valodi vendegadat).
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujTeszt, mind, elso, szamol, BASE, NAP } from './fixtures.js';
import { ertelmez } from '../../netlify/lib/lifecycle/parser.js';
import { ingestLifecycleEsemeny, szolgaltatasTerkepFeltolt, SALONIC_SZOLGALTATAS_ALAP } from '../lib/ingest.js';
import { kapocs } from '../lib/lifecycle-kapocs.js';
import { outboxFeldolgoz } from '../lib/motor.js';

const ORA = 3600;
const UUID1 = '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const UUID2 = '11111111-2222-4333-8444-555555555555';
const SZOLG_ELSO = 'Haj Oxigénterápia - 1. alkalom';
const SZOLG_TOVABBI = '👩 Haj Oxigénterápia - 2. alkalomtól';
const SZOLG_KAMERA = 'AKCIÓS Hajkamerás vizsgálat és konzultáció';
const NAP1 = 'október 20. (kedd) 16:00';
const NAP2 = 'október 22. (csütörtök) 10:00';

const html = (cim, sorok, uuid, fiok) => `<html><body><table><tr><td>${cim}</td></tr>${sorok.map((s) => `<tr><td>${s}</td></tr>`).join('')}
${uuid ? `<tr><td><a href="https://app.salonic.hu/backend/signin/?customer=${fiok}&amp;redirect=%2Fcalendar%2FshowBooking%2F%3FbookingId%3D${uuid}">Foglalás megtekintése</a></td></tr>` : ''}</table></body></html>`;
const VENDEG = { nev: 'Demo Anna', tel: '06 30 111 2222', email: 'demo.anna@example.invalid' };
const KULDO = 'Mosaic Oxigen <app@salonic.hu>';

function foglaltLevel({ szolg = SZOLG_ELSO, datum = NAP1, uuid = UUID1, fiok = 'mosaic-oxigen', kuldo = KULDO, munka = 'Kata', v = VENDEG } = {}) {
  return { uzenetId: `g-${uuid}`, targy: `Új online foglalás érkezett: ${szolg}`, kuldo, html: html('Új online foglalás érkezett:', ['Foglaló adatai:', `Név: ${v.nev}`, `Mobiltelefonszám: ${v.tel}`, `E-mail cím: ${v.email}`, 'Időpont adatok:', `Szolgáltatás: ${szolg}`, `Munkatárs: ${munka}`, `Kezdő dátum: ${datum}`], uuid, fiok) };
}
function athelyezveLevel({ szolg = SZOLG_ELSO, regi = NAP1, uj = NAP2, uuid = UUID1, fiok = 'mosaic-oxigen', v = VENDEG } = {}) {
  return { uzenetId: `a-${uj}`, targy: `Foglalás módosítva vendég által: ${szolg}`, kuldo: KULDO, html: html('Foglalás módosítva:', ['Foglaló adatai:', `Név: ${v.nev}`, `Mobiltelefonszám: ${v.tel}`, `E-mail cím: ${v.email}`, `Szolgáltatás: ${szolg}`, 'Munkatárs: Kata', `RÉGI dátum: ${regi}`, `Új dátum: ${uj}`], uuid, fiok) };
}
/** a lemondas-ertesito azonosito (UUID / link) NELKUL jon */
function lemondvaLevel({ szolg = SZOLG_ELSO, datum = NAP1, ok = '', v = VENDEG } = {}) {
  return { uzenetId: `l-${datum}`, targy: `Foglalás lemondás - ${v.nev} - ${szolg}`, kuldo: KULDO, html: html('Az alábbi időpontot a vendég lemondta:', [`Lemondás oka: ${ok}${datum}`, `Szolgáltatás: ${szolg}`, 'Munkatárs: Kata', 'Foglaló adatai:', `Név: ${v.nev}`, `Mobiltelefonszám: ${v.tel}`, `E-mail cím: ${v.email}`], null) };
}
const elemez = (level, most = BASE) => { const e = ertelmez(level, most); assert.equal(e.ok, true, `a parser nem ertelmezte: ${e.miert}`); return e; };

test('INGEST foglalt: a parser-kimenet foglalassa alakul (oxygen / mosaic-oxigen, szolgaltatas-nev -> first_hair, kezelo-feloldas, Salonic UUID = kulso azonosito)', async () => {
  const t = await ujTeszt();
  const e = elemez(foglaltLevel());
  assert.equal(e.uzletag, 'oxygen');
  const r = await ingestLifecycleEsemeny(t.db, e, { most: BASE });
  assert.equal(r.ok, true);
  assert.equal(r.valtozas, 'uj');
  const b = await elso(t.db, 'SELECT * FROM booking');
  assert.deepEqual([b.account, b.external_id, b.service_code, b.status, b.start_at, b.therapist_id], ['mosaic-oxigen', UUID1, 'first_hair', 'booked', e.kezdet, t.staff.terapeuta]);
  const g = await elso(t.db, 'SELECT * FROM guest');
  assert.deepEqual([g.email, g.phone, g.name], ['demo.anna@example.invalid', '+36301112222', 'Demo Anna']);
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.confirmed'"), 1);
  assert.equal((await elso(t.db, 'SELECT last_sync_at FROM salonic_account WHERE id = \'mosaic-oxigen\'')).last_sync_at, BASE);
  assert.equal(await szamol(t.db, 'security_audit', "action = 'ingest.lifecycle' AND result = 'ok'"), 1);
});

test('INGEST idempotens: ugyanaz az ertesito (a Salonic tobb levelet kuld), vagy ismetelt feldolgozas nem duplikal', async () => {
  const t = await ujTeszt();
  const e = elemez(foglaltLevel());
  const a = await ingestLifecycleEsemeny(t.db, e, { most: BASE });
  const b = await ingestLifecycleEsemeny(t.db, { ...e }, { most: BASE + 5 });
  const c = await ingestLifecycleEsemeny(t.db, e, { most: BASE + 600 });
  assert.deepEqual([a.valtozas, b.valtozas, c.valtozas], ['uj', 'duplikalt', 'duplikalt']);
  assert.equal(await szamol(t.db, 'booking'), 1);
  assert.equal(await szamol(t.db, 'guest'), 1);
  assert.equal(await szamol(t.db, 'outbox_event'), 1);
  // azonosito nelkuli ertesito (szintetikus kulcs) is idempotens
  const t2 = await ujTeszt();
  const e2 = elemez(foglaltLevel({ uuid: null }));
  assert.equal(e2.foglalasId, null);
  const x = await ingestLifecycleEsemeny(t2.db, e2, { most: BASE });
  const y = await ingestLifecycleEsemeny(t2.db, e2, { most: BASE + 10 });
  assert.deepEqual([x.valtozas, y.valtozas], ['uj', 'duplikalt']);
  assert.equal(await szamol(t2.db, 'booking'), 1);
  assert.match((await elso(t2.db, 'SELECT external_id FROM booking')).external_id, /^szint-/);
});

test('INGEST mas uzletag / mas Salonic-fiok: figyelmen kivul hagyva (nem hiba, nem keletkezik vendeg / foglalas)', async () => {
  const t = await ujTeszt();
  const hair = elemez(foglaltLevel({ szolg: '👱‍♀️ Tőfestés + Szárítás - Hosszú haj', fiok: 'mosaic-hair', kuldo: 'Mosaic Hair <app@salonic.hu>', uuid: UUID2 }));
  assert.equal(hair.uzletag, 'hair');
  const r = await ingestLifecycleEsemeny(t.db, hair, { most: BASE });
  assert.deepEqual([r.ok, r.figyelmen_kivul, r.ok_kod], [true, true, 'MAS_UZLETAG']);
  const hs = elemez(foglaltLevel({ szolg: 'Head Spa', fiok: 'mosaicheadspa', kuldo: 'Mosaic Head Spa <app@salonic.hu>', uuid: UUID2 }));
  assert.equal((await ingestLifecycleEsemeny(t.db, hs, { most: BASE })).figyelmen_kivul, true);
  // oxygen uzletag, de mas fiok-nev
  assert.equal((await ingestLifecycleEsemeny(t.db, { ...elemez(foglaltLevel()), fiok: 'valami-masik' }, { most: BASE })).figyelmen_kivul, true);
  assert.equal(await szamol(t.db, 'booking'), 0);
  assert.equal(await szamol(t.db, 'guest'), 0);
  assert.equal(await szamol(t.db, 'outbox_event'), 0);
  // nem ertelmezett esemeny
  assert.equal((await ingestLifecycleEsemeny(t.db, { ok: false, miert: 'x' }, { most: BASE })).ok_kod, 'NEM_ERTELMEZETT_ESEMENY');
});

test('INGEST athelyezve: azonositoval es azonosito nelkul is a meglevo foglalas mozdul (nem cancelled, nem uj foglalas); ismetelt ertesito duplikalt', async () => {
  const t = await ujTeszt();
  const f = elemez(foglaltLevel());
  await ingestLifecycleEsemeny(t.db, f, { most: BASE });
  const a = elemez(athelyezveLevel());
  assert.equal(a.tipus, 'athelyezve');
  const r = await ingestLifecycleEsemeny(t.db, a, { most: BASE + ORA });
  assert.equal(r.valtozas, 'athelyezve');
  let b = await elso(t.db, 'SELECT * FROM booking');
  assert.deepEqual([b.status, b.start_at, b.original_start_at, b.reschedule_count], ['rescheduled', a.kezdet, f.kezdet, 1]);
  assert.equal(await szamol(t.db, 'booking'), 1);
  assert.equal((await ingestLifecycleEsemeny(t.db, a, { most: BASE + 2 * ORA })).valtozas, 'duplikalt');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.rescheduled'"), 1);
  // azonosito nelkul (szintetikus kulcs): a regi idopont + vendeg alapjan talalja meg
  const t2 = await ujTeszt();
  await ingestLifecycleEsemeny(t2.db, elemez(foglaltLevel({ uuid: null })), { most: BASE });
  const a2 = elemez(athelyezveLevel({ uuid: null }));
  assert.equal(a2.foglalasId, null);
  assert.equal((await ingestLifecycleEsemeny(t2.db, a2, { most: BASE + ORA })).valtozas, 'athelyezve');
  assert.equal((await ingestLifecycleEsemeny(t2.db, a2, { most: BASE + 2 * ORA })).valtozas, 'duplikalt');
  assert.equal(await szamol(t2.db, 'booking'), 1);
  b = await elso(t2.db, 'SELECT * FROM booking');
  assert.equal(b.start_at, a2.kezdet);
});

test('INGEST lemondva AZONOSITO NELKUL: a vendeg (e-mail / telefon) + idopont alapjan keresi meg a foglalast; ismetelt lemondas duplikalt; C0 job keletkezik', async () => {
  const t = await ujTeszt();
  await ingestLifecycleEsemeny(t.db, elemez(foglaltLevel()), { most: BASE });
  const l = elemez(lemondvaLevel());
  assert.equal(l.tipus, 'lemondva');
  assert.equal(l.foglalasId, null);
  const r = await ingestLifecycleEsemeny(t.db, l, { most: BASE + ORA });
  assert.equal(r.valtozas, 'lemondva');
  const b = await elso(t.db, 'SELECT * FROM booking');
  assert.equal(b.status, 'cancelled');
  assert.equal(await szamol(t.db, 'booking'), 1);
  assert.equal((await ingestLifecycleEsemeny(t.db, l, { most: BASE + 2 * ORA })).valtozas, 'duplikalt');
  assert.equal(await szamol(t.db, 'outbox_event', "event_type = 'booking.cancelled'"), 1);
  const o = await outboxFeldolgoz(t.db, { most: BASE + 3 * ORA });
  assert.ok((await mind(t.db, 'SELECT template_key FROM message_job')).some((j) => j.template_key === 'C0'));
  assert.ok(o.feldolgozott >= 2);
  // csak telefon egyezik (az e-mail mas): a telefon is azonosit
  const t2 = await ujTeszt();
  await ingestLifecycleEsemeny(t2.db, elemez(foglaltLevel()), { most: BASE });
  const r2 = await ingestLifecycleEsemeny(t2.db, elemez(lemondvaLevel({ v: { ...VENDEG, email: 'masik@example.invalid' } })), { most: BASE + ORA });
  assert.equal(r2.valtozas, 'lemondva');
  assert.equal(await szamol(t2.db, 'booking'), 1);
});

test('INGEST utolagos torles / "nem jelent meg" jelzes: nem lemondas, nem automatikus no_show (csak jelzes + audit); noShowAuto kapcsolhato', async () => {
  const t = await ujTeszt();
  const f = elemez(foglaltLevel());
  await ingestLifecycleEsemeny(t.db, f, { most: BASE });
  const utana = f.kezdet + 2 * ORA;
  const r = await ingestLifecycleEsemeny(t.db, elemez(lemondvaLevel(), f.kezdet), { most: utana });
  assert.deepEqual([r.valtozas, r.ok_kod], ['kihagyva', 'UTOLAGOS_TORLES']);
  assert.equal((await elso(t.db, 'SELECT status FROM booking')).status, 'booked');
  const r2 = await ingestLifecycleEsemeny(t.db, elemez(lemondvaLevel({ ok: 'Nem jelent meg ' }), BASE), { most: BASE + ORA });
  assert.equal(r2.ok_kod, 'NEM_JELENT_MEG_JELZES');
  assert.equal((await elso(t.db, 'SELECT status FROM booking')).status, 'booked');
  const r3 = await ingestLifecycleEsemeny(t.db, elemez(lemondvaLevel({ ok: 'Nem jelent meg ' }), BASE), { most: BASE + ORA, noShowAuto: true });
  assert.equal(r3.valtozas, 'no_show');
});

test('INGEST szolgaltatas-azonosito -> service code (466110 first_hair, 466158 followup_hair, 466147 camera_assessment); a service_catalog az igazsag', async () => {
  const t = await ujTeszt();
  assert.deepEqual(SALONIC_SZOLGALTATAS_ALAP, { 466110: 'first_hair', 466158: 'followup_hair', 466147: 'camera_assessment' });
  const cel = [[466110, 'first_hair'], [466158, 'followup_hair'], [466147, 'camera_assessment']];
  let i = 0;
  for (const [id, kod] of cel) {
    const e = elemez(foglaltLevel({ uuid: `aaaaaaaa-0000-4000-8000-00000000000${++i}`, datum: `október ${20 + i}. (${['szerda', 'csütörtök', 'péntek'][i - 1]}) 1${i}:00`, szolg: SZOLG_ELSO }));
    const r = await ingestLifecycleEsemeny(t.db, { ...e, szolgaltatasId: id }, { most: BASE });
    assert.equal(r.szolgaltatas, kod);
  }
  assert.deepEqual((await mind(t.db, 'SELECT service_code FROM booking ORDER BY start_at')).map((x) => x.service_code), ['first_hair', 'followup_hair', 'camera_assessment']);
  // a katalogus-terkep feltoltese idempotens; utana a service_catalog dont (mas azonosito a katalogusban)
  assert.equal((await szolgaltatasTerkepFeltolt(t.db)).valtozott, 3);
  assert.equal((await szolgaltatasTerkepFeltolt(t.db)).valtozott, 0);
  await t.db.prepare('UPDATE service_catalog SET salonic_service_ids = ?2 WHERE code = ?1').bind('followup_hair', JSON.stringify({ 'mosaic-oxigen': ['777001'] })).run();
  const e = elemez(foglaltLevel({ uuid: UUID2, datum: 'október 29. (csütörtök) 09:00' }));
  assert.equal((await ingestLifecycleEsemeny(t.db, { ...e, szolgaltatasId: '777001' }, { most: BASE })).szolgaltatas, 'followup_hair');
});

test('INGEST szolgaltatas-nev alapjan (Salonic-pillanatkep): 1. alkalom / 2. alkalomtol / hajkamera; ismeretlen szolgaltatas nem talalgat', async () => {
  const t = await ujTeszt();
  const cel = [[SZOLG_ELSO, 'first_hair'], [SZOLG_TOVABBI, 'followup_hair'], [SZOLG_KAMERA, 'camera_assessment']];
  let i = 0;
  for (const [szolg, kod] of cel) {
    const e = elemez(foglaltLevel({ szolg, uuid: `bbbbbbbb-0000-4000-8000-00000000000${++i}`, datum: `október ${19 + i}. (${['hétfő', 'kedd', 'szerda'][i - 1]}) 1${i}:30` }));
    assert.equal((await ingestLifecycleEsemeny(t.db, e, { most: BASE })).szolgaltatas, kod);
  }
  const ismeretlen = elemez(foglaltLevel({ szolg: 'Valami teljesen mas szolgaltatas', uuid: UUID2 }));
  const r = await ingestLifecycleEsemeny(t.db, ismeretlen, { most: BASE });
  assert.deepEqual([r.ok, r.ok_kod], [false, 'ISMERETLEN_SZOLGALTATAS']);
  assert.equal(await szamol(t.db, 'booking'), 3);
});

test('INGEST ismeretlen foglalas athelyezes-ertesitoje: uj foglalaskent az uj idopontra felvesszuk (nincs vendeg-osszecsuszas)', async () => {
  const t = await ujTeszt();
  const r = await ingestLifecycleEsemeny(t.db, elemez(athelyezveLevel({ uuid: UUID2 })), { most: BASE });
  assert.equal(r.valtozas, 'uj');
  assert.equal(await szamol(t.db, 'booking'), 1);
});

// ---------------------------------------------------------------- lifecycle-kapocs
test('KAPOCS nincs CRM_DB binding: semmit nem csinal, nem dob', async () => {
  assert.deepEqual(await kapocs({}, elemez(foglaltLevel())), { ok: true, kihagyva: 'nincs_CRM_DB' });
  assert.deepEqual((await kapocs(undefined, undefined)).kihagyva, 'nincs_CRM_DB');
  assert.equal((await kapocs({ CRM_DB: null }, {})).ok, true);
});

test('KAPOCS CRM_DB-vel: bekerul a foglalas; hibas esemeny / sulyos DB-hiba SOHA nem dob; CRM_KAPOCS=ki kikapcsolja', async () => {
  const t = await ujTeszt();
  const r = await kapocs({ CRM_DB: t.db }, elemez(foglaltLevel()), { most: BASE });
  assert.deepEqual([r.ok, r.eredmeny], [true, 'uj']);
  assert.equal(await szamol(t.db, 'booking'), 1);
  assert.equal((await kapocs({ CRM_DB: t.db }, elemez(foglaltLevel()), { most: BASE })).eredmeny, 'duplikalt');
  // mas uzletag: ok, figyelmen kivul
  const hair = elemez(foglaltLevel({ szolg: '👱‍♀️ Tőfestés + Szárítás - Hosszú haj', fiok: 'mosaic-hair', kuldo: 'Mosaic Hair <app@salonic.hu>', uuid: UUID2 }));
  assert.deepEqual((await kapocs({ CRM_DB: t.db }, hair)).eredmeny, 'figyelmen_kivul');
  // hibas bemenet / dobo DB
  assert.equal((await kapocs({ CRM_DB: t.db }, 'nem objektum')).ok, true);
  const dobo = { prepare() { throw new Error('D1_ERROR: tonkrement'); }, batch() { throw new Error('D1_ERROR'); } };
  const hiba = await kapocs({ CRM_DB: dobo }, elemez(foglaltLevel()));
  assert.equal(hiba.ok, false);
  assert.match(hiba.hiba, /D1_ERROR/);
  assert.deepEqual(await kapocs({ CRM_DB: t.db, CRM_KAPOCS: 'ki' }, elemez(foglaltLevel({ uuid: UUID2 }))), { ok: true, kihagyva: 'nincs_CRM_DB' });
  assert.equal(await szamol(t.db, 'booking'), 1);
});

test('KAPOCS lassu CRM nem lassithatja a lifecycle-t: idokorlat utan visszater (idotullepes), a hatterben futo munka hibaja sem dob', async () => {
  const lassu = { prepare() { return { bind() { return { first: () => new Promise((_, nem) => setTimeout(() => nem(new Error('kesei hiba')), 120)), run: () => new Promise((_, nem) => setTimeout(() => nem(new Error('kesei hiba')), 120)), all: () => new Promise((_, nem) => setTimeout(() => nem(new Error('kesei hiba')), 120)) }; } }; }, batch: () => new Promise(() => {}) };
  const t0 = Date.now();
  const r = await kapocs({ CRM_DB: lassu }, { ok: true, tipus: 'foglalt', uzletag: 'oxygen', fiok: 'mosaic-oxigen', kezdet: BASE + NAP, szolgaltatas: SZOLG_ELSO, nev: 'Demo Anna', email: 'a@example.invalid', foglalasId: UUID1 }, { idokorlatMs: 30 });
  assert.deepEqual([r.ok, r.hiba], [false, 'idotullepes']);
  assert.ok(Date.now() - t0 < 100);
  await new Promise((res) => setTimeout(res, 200));   // nincs kezeletlen elutasitas
});
