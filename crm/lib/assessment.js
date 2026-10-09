// Digitalis allapotfelmero (assessment / assessment_submission) + kontraindikacio-flag (contraindication_alert).
// FIGYELEM - REQUIRES_VERIFICATION: az Oxygeni hivatalos szakmai protokoll kerdeseit es az ellenjavallati listat NEM talaljuk ki. Az ALAP_KERDOIV
// csak a MASTERPROMPT 1142-1150. soraban rogzitett KERDESCSOPORTOK vazat adja; a protokollfuggo kerdesek `requires_verification: true` jeloltek,
// a verzio `approved_by_clinical_lead = 0` allapotban VENDEGNEK NEM KIADHATO, amig a szakmai vezeto (Janka) a gyartoi protokoll alapjan at nem nezi
// es jova nem hagyja (jovahagyVerzio). A jelzes (flag) = a vendeg pozitiv valasza egy `flag_ha` kerdesre; ez NEM orvosi dontes, csak kezeloi ertesites.
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, jsonIr, jsonOlvas, sha256, ujToken, korlatHiba, valtozas, beszurHa } from './db.js';
import { auditStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { megkoveteli, szerepek, lehet } from './rbac.js';
import { CSATORNA, TOKEN_BAJT } from './constants.js';

const RV = true;   // requires_verification rovid jelolese
export const ALAP_VERZIO = 'v0-vazlat-REQUIRES_VERIFICATION';

/** a kerdescsoportok vaza (1142-1150. sor). A szoveg-tartalom ELŐKÉSZÍTŐ, a protokollfuggo kerdesek jelolve. */
export const ALAP_KERDOIV = Object.freeze({
  csoportok: [
    { kulcs: 'foglalas', cim: 'Foglalas es elerhetoseg', kerdesek: [
      { kulcs: 'adatkezeles_elfogadva', szoveg: 'Az adatkezelesi tajekoztatot elolvastam es elfogadom (ez nem marketing-hozzajarulas).', tipus: 'boolean', kotelezo: true },
    ] },
    { kulcs: 'panasz', cim: 'Panasz es cel', kerdesek: [
      { kulcs: 'panasz_tipus', szoveg: 'Mi a panaszod?', tipus: 'multi', opciok: ['hajhullas', 'ritkulas', 'zsirosodas', 'hamlas_erzekenyseg', 'vekony_haj'], kotelezo: true },
      { kulcs: 'tunetek_kezdete', szoveg: 'Mikor kezdodtek a tunetek?', tipus: 'text', kotelezo: false },
      { kulcs: 'valtozas', szoveg: 'Hogyan valtozott az utobbi idoben?', tipus: 'select', opciok: ['javul', 'valtozatlan', 'romlik'], kotelezo: false },
      { kulcs: 'vendeg_celja', szoveg: 'Mit szeretnel elerni?', tipus: 'text', kotelezo: false },
    ] },
    { kulcs: 'elozmenyek', cim: 'Korabbi reakciok, allergiak, szakmai elozmenyek', kerdesek: [
      { kulcs: 'korabbi_reakcio', szoveg: 'Volt korabban bor- vagy fejbor-reakciod?', tipus: 'boolean', kotelezo: true, flag_ha: [true], requires_verification: RV },
      { kulcs: 'termek_allergia', szoveg: 'Ismert termekallergiad van?', tipus: 'boolean', kotelezo: true, flag_ha: [true], requires_verification: RV },
      { kulcs: 'aktualis_fejbor_tunet', szoveg: 'Van jelenleg fejbor-tuneted?', tipus: 'boolean', kotelezo: true, flag_ha: [true], requires_verification: RV },
      { kulcs: 'szakmai_elozmeny', szoveg: 'REQUIRES_VERIFICATION: a gyartoi protokoll szerinti szakmai elozmeny-kerdesek helye.', tipus: 'text', kotelezo: false, requires_verification: RV },
    ] },
    { kulcs: 'rutin', cim: 'Otthoni rutin, termekek, hajfestes', kerdesek: [
      { kulcs: 'otthoni_rutin', szoveg: 'Milyen hajapolast hasznalsz?', tipus: 'text', kotelezo: false },
      { kulcs: 'aktualis_termekek', szoveg: 'Milyen termekeket hasznalsz jelenleg?', tipus: 'text', kotelezo: false },
      { kulcs: 'hajfestes', szoveg: 'Festett vagy szokitett a hajad?', tipus: 'boolean', kotelezo: false },
      { kulcs: 'hajmosasi_szunet_tudomasul', szoveg: 'Tudomasul veszem, hogy a kezeles elott 24 oraval nem javasolt hajat mosni.', tipus: 'boolean', kotelezo: true },
    ] },
    { kulcs: 'biztonsag', cim: 'Biztonsagi jelzes', kerdesek: [
      { kulcs: 'sulyosbodo_tunet', szoveg: 'Sulyosbodo tunetet vagy szokatlan reakciot tapasztalsz?', tipus: 'boolean', kotelezo: true, flag_ha: [true], requires_verification: RV },
      { kulcs: 'ellenjavallat_jelzes', szoveg: 'REQUIRES_VERIFICATION: ellenjavallati kerdes(ek) a gyartoi protokoll szerint.', tipus: 'boolean', kotelezo: false, flag_ha: [true], requires_verification: RV },
    ] },
  ],
});

const kerdesek = (def) => def.csoportok.flatMap((c) => c.kerdesek);

// ---- verziok ----------------------------------------------------------------------------------------------------------------------------
export async function letrehozVerzio(db, { version = ALAP_VERZIO, definicio = ALAP_KERDOIV, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'assessment_version', { now });
  const id = uuid();
  try {
    await tranzakcio(db, [
      keszit(db, 'INSERT INTO assessment (id, question_version, questions, approved_by_clinical_lead, created_by, created_at) VALUES (?1, ?2, ?3, 0, ?4, ?5)', id, version, jsonIr(definicio), staffId, now),
      auditStmt(db, { staffId, action: 'assessment.version_created', resource: 'assessment', resourceId: id, detail: { version }, now }),
    ]);
  } catch (e) { if (korlatHiba(e)) throw new CrmHiba('VERZIO_LETEZIK', 'ez a verzio mar letezik', 409); throw e; }
  return { assessmentId: id, version };
}

/** szakmai vezetoi jovahagyas (a gyartoi protokoll szerinti atnezes utan). Jovahagyatlan verzio a vendegnek nem adhato ki. */
export async function jovahagyVerzio(db, { version, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'approve', 'assessment_version', { now });
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE assessment SET approved_by_clinical_lead = 1, approved_by = ?2, approved_at = ?3 WHERE question_version = ?1 AND approved_by_clinical_lead = 0 AND retired_at IS NULL', version, staffId, now),
    auditStmt(db, { staffId, action: 'assessment.version_approved', resource: 'assessment', resourceId: version, detail: { version }, now }),
  ]);
  if (valtozas(r) !== 1) throw new CrmHiba('NEM_JOVAHAGYHATO', 'ismeretlen, mar jovahagyott vagy visszavont verzio', 409);
}

export const aktivVerzio = (db) => elso(db, 'SELECT * FROM assessment WHERE approved_by_clinical_lead = 1 AND retired_at IS NULL ORDER BY approved_at DESC, rowid DESC LIMIT 1');

/** kiadhato-e a kerdoiv a vendegnek: csak jovahagyott verzio */
export async function kiadhato(db) {
  const v = await aktivVerzio(db);
  return v ? { ok: true, version: v.question_version, assessmentId: v.id } : { ok: false, ok_kod: 'NINCS_JOVAHAGYOTT_VERZIO', megjegyzes: 'REQUIRES_VERIFICATION: a kerdoiv szakmai vezetoi jovahagyasra var' };
}

// ---- kiadas, kitoltes ---------------------------------------------------------------------------------------------------------------------
/** kitoltesi link a foglaláshoz (T0). Visszaadja a plaintext tokent (csak a hash tarolodik). Jovahagyatlan verzio: hiba. */
export async function kiad(db, { guestId, bookingId = null, now = most() }) {
  const k = await kiadhato(db);
  if (!k.ok) throw new CrmHiba('NINCS_JOVAHAGYOTT_VERZIO', 'a kerdoiv nincs jovahagyva, vendegnek nem adhato ki', 409);
  if (bookingId) {
    const van = await elso(db, 'SELECT * FROM assessment_submission WHERE booking_id = ?1 ORDER BY issued_at DESC LIMIT 1', bookingId);
    if (van && van.status !== 'issued') return { mar: true, submissionId: van.id };
    if (van) {   // meg nincs kitoltve: uj token (a regi hash lecserelodik)
      const token = ujToken(TOKEN_BAJT);
      await keszit(db, 'UPDATE assessment_submission SET token_hash = ?2 WHERE id = ?1 AND status = \'issued\'', van.id, await sha256(token)).run();
      return { mar: false, submissionId: van.id, token, version: k.version };
    }
  }
  const id = uuid(), token = ujToken(TOKEN_BAJT);
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO assessment_submission (id, assessment_id, guest_id, booking_id, token_hash, status, issued_at) VALUES (?1, ?2, ?3, ?4, ?5, \'issued\', ?6)', id, k.assessmentId, guestId, bookingId, await sha256(token), now),
    auditStmt(db, { action: 'assessment.issued', resource: 'assessment_submission', resourceId: id, guestId, detail: { version: k.version }, now }),
  ]);
  return { mar: false, submissionId: id, token, version: k.version };
}

function validal(def, valaszok) {
  const hibak = [], tiszta = {};
  for (const q of kerdesek(def)) {
    const v = valaszok?.[q.kulcs];
    const ures = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
    if (ures) { if (q.kotelezo) hibak.push(`${q.kulcs}: kotelezo`); continue; }
    if (q.tipus === 'boolean' && typeof v !== 'boolean') hibak.push(`${q.kulcs}: igen/nem`);
    else if (q.tipus === 'text' && (typeof v !== 'string' || v.length > 2000)) hibak.push(`${q.kulcs}: szoveg (max 2000)`);
    else if (q.tipus === 'select' && !(q.opciok || []).includes(v)) hibak.push(`${q.kulcs}: ervenytelen opcio`);
    else if (q.tipus === 'multi' && !(Array.isArray(v) && v.every((x) => (q.opciok || []).includes(x)))) hibak.push(`${q.kulcs}: ervenytelen opcio`);
    else tiszta[q.kulcs] = v;
  }
  return { hibak, tiszta };
}

/**
 * Kitoltes beadasa (a vendeg a tokenes linken). Az adatkezelesi tajekoztato elfogadasa KOTELEZO, de kulon van a marketing-hozzajarulastol.
 * Pozitiv biztonsagi valasz -> safety_flag + contraindication_alert (nyitott) + outbox alert.contraindication (a kezelo ertesul).
 */
export async function bead(db, { token, valaszok, adatkezelesVerzio = 'REQUIRES_VERIFICATION', now = most(), ipHash = null }) {
  const s = await elso(db, 'SELECT s.*, a.questions FROM assessment_submission s JOIN assessment a ON a.id = s.assessment_id WHERE s.token_hash = ?1', await sha256(String(token ?? '')));
  if (!s) throw new CrmHiba('ISMERETLEN_LINK', 'ervenytelen kitoltesi link', 404);
  if (s.status !== 'issued') throw new CrmHiba('MAR_BEADVA', 'a kerdoivet mar kitoltottek', 409);
  const def = jsonOlvas(s.questions, { csoportok: [] });
  if (valaszok?.adatkezeles_elfogadva !== true) throw new CrmHiba('ADATKEZELES_KELL', 'az adatkezelesi tajekoztato elfogadasa kotelezo', 400);
  const { hibak, tiszta } = validal(def, valaszok);
  if (hibak.length) throw new CrmHiba('ERVENYTELEN_VALASZ', hibak.join('; '), 400, hibak);
  const flagek = kerdesek(def).filter((q) => (q.flag_ha || []).some((x) => tiszta[q.kulcs] === x)).map((q) => q.kulcs);
  const b = s.booking_id ? await elso(db, 'SELECT * FROM booking WHERE id = ?1', s.booking_id) : null;
  const alertId = uuid();
  const ut = [
    keszit(db, 'UPDATE assessment_submission SET status = \'submitted\', answers = ?2, privacy_accepted_at = ?3, safety_flag = ?4, flagged_questions = ?5, submitted_at = ?3, token_hash = NULL WHERE id = ?1 AND status = \'issued\'', s.id, jsonIr(tiszta), now, flagek.length ? 1 : 0, jsonIr(flagek)),
    beszurHa(db, { tabla: 'consent_event', ha: { sql: 'SELECT 1 FROM assessment_submission WHERE id = ? AND status = \'submitted\'', params: [s.id] }, adat: { id: uuid(), guest_id: s.guest_id, channel: CSATORNA.ADATKEZELES, action: 'granted', text_version: adatkezelesVerzio, source: 'assessment', ip_hash: ipHash, at: now } }),
    auditStmt(db, { action: 'assessment.submitted', resource: 'assessment_submission', resourceId: s.id, guestId: s.guest_id, detail: { flag: flagek.length > 0 }, ipHash, now }),
  ];
  if (flagek.length) {
    const ha = { sql: 'SELECT 1 FROM assessment_submission WHERE id = ? AND status = \'submitted\'', params: [s.id] };
    ut.push(beszurHa(db, { tabla: 'contraindication_alert', ha, adat: { id: alertId, submission_id: s.id, guest_id: s.guest_id, booking_id: s.booking_id, therapist_id: b?.therapist_id ?? null, status: 'open', flagged: jsonIr(flagek), created_at: now } }));
    ut.push(outboxStmt(db, { tipus: 'alert.contraindication', aggTipus: 'contraindication_alert', aggId: alertId, guestId: s.guest_id, payload: { alert_id: alertId, therapist_id: b?.therapist_id ?? null, booking_id: s.booking_id }, dedupeKey: `alert.contraindication:${s.id}`, now, ha }));
  }
  try { await tranzakcio(db, ut); } catch (e) { if (korlatHiba(e)) throw new CrmHiba('MAR_BEADVA', 'a kerdoiv kozben beerkezett', 409); throw e; }
  const utana = await elso(db, 'SELECT status FROM assessment_submission WHERE id = ?1', s.id);
  if (utana.status !== 'submitted') throw new CrmHiba('MAR_BEADVA', 'a kerdoiv kozben beerkezett', 409);
  return { submissionId: s.id, jelzes: flagek.length > 0, alertId: flagek.length ? alertId : null, flagek };
}

// ---- kezeloi atnezes, riasztas ---------------------------------------------------------------------------------------------------------
export const nyitottRiasztasok = (db) => mind(db, 'SELECT * FROM contraindication_alert WHERE status IN (\'open\', \'acknowledged\') ORDER BY created_at');

/** a kezelo tudomasul veszi a riasztast (open -> acknowledged) */
export async function tudomasulVesz(db, { alertId, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'resolve', 'contraindication_alert', { resourceId: alertId, now });
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE contraindication_alert SET status = \'acknowledged\', acknowledged_by = ?2, acknowledged_at = ?3 WHERE id = ?1 AND status = \'open\'', alertId, staffId, now),
    auditStmt(db, { staffId, action: 'alert.acknowledged', resource: 'contraindication_alert', resourceId: alertId, now }),
  ]);
  return valtozas(r) === 1;
}

/**
 * Kezeloi atnezes. eredmeny: cleared (feloldva, a kezeles mehet) | consult / postponed (az alert nyitva marad, kezeles NEM igazolhato) |
 * contraindicated (clinical_stop: a vendeg 'contraindication' stop-ot kap, a kura szuneteltetve, kura / berlet nem ajanlhato).
 */
export async function attekint(db, { submissionId, staffId, eredmeny, megjegyzes = null, now = most() }) {
  await megkoveteli(db, staffId, 'review', 'assessment', { resourceId: submissionId, now });
  if (!['cleared', 'consult', 'postponed', 'contraindicated'].includes(eredmeny)) throw new CrmHiba('ERVENYTELEN_EREDMENY', 'cleared | consult | postponed | contraindicated', 400);
  const s = await elso(db, 'SELECT * FROM assessment_submission WHERE id = ?1', submissionId);
  if (!s || s.status === 'issued') throw new CrmHiba('NINCS_BEADOTT_KERDOIV', 'nincs beadott kerdoiv', 404);
  const alert = await elso(db, 'SELECT * FROM contraindication_alert WHERE submission_id = ?1', submissionId);
  const ut = [keszit(db, 'UPDATE assessment_submission SET status = \'reviewed\', reviewed_by = ?2, reviewed_at = ?3, review_outcome = ?4, review_note = ?5 WHERE id = ?1', submissionId, staffId, now, eredmeny, megjegyzes)];
  if (alert) {
    const uj = { cleared: 'cleared', consult: 'acknowledged', postponed: 'acknowledged', contraindicated: 'clinical_stop' }[eredmeny];
    ut.push(keszit(db, 'UPDATE contraindication_alert SET status = ?2, acknowledged_by = COALESCE(acknowledged_by, ?3), acknowledged_at = COALESCE(acknowledged_at, ?4), resolved_by = ?5, resolved_at = ?6, resolution = ?7 WHERE id = ?1',
      alert.id, uj, staffId, now, ['cleared', 'contraindicated'].includes(eredmeny) ? staffId : null, ['cleared', 'contraindicated'].includes(eredmeny) ? now : null, megjegyzes));
  }
  if (eredmeny === 'contraindicated') {
    ut.push(keszit(db, 'UPDATE guest SET clinical_stop = \'contraindication\', clinical_stop_at = ?2, updated_at = ?2 WHERE id = ?1', s.guest_id, now));
    ut.push(keszit(db, 'UPDATE course SET status = \'paused_clinical\', paused_at = ?2, paused_reason = \'contraindication\', updated_at = ?2 WHERE guest_id = ?1 AND status IN (\'not_started\', \'active\')', s.guest_id, now));
  }
  ut.push(auditStmt(db, { staffId, action: 'assessment.reviewed', resource: 'assessment_submission', resourceId: submissionId, guestId: s.guest_id, detail: { eredmeny }, now }));
  await tranzakcio(db, ut);
  return { eredmeny };
}

/** klinikai stop feloldasa - csak a szakmai vezeto (clinical_lead), indokkal */
export async function stopFeloldas(db, { guestId, staffId, ok, now = most() }) {
  const sz = await szerepek(db, staffId);
  if (!lehet(sz, 'approve', 'assessment_version')) {
    await auditStmt(db, { staffId, action: 'clinical_stop.release', resource: 'guest', resourceId: guestId, guestId, result: 'denied', now }).run();
    throw new CrmHiba('TILTOTT', 'a szakmai stop feloldasa a szakmai vezeto feladata', 403);
  }
  if (!ok) throw new CrmHiba('INDOK_KELL', 'indok kell', 400);
  await tranzakcio(db, [
    keszit(db, 'UPDATE guest SET clinical_stop = NULL, clinical_stop_at = NULL, updated_at = ?2 WHERE id = ?1', guestId, now),
    keszit(db, 'UPDATE contraindication_alert SET status = \'cleared\', resolved_by = ?2, resolved_at = ?3, resolution = COALESCE(resolution, ?4) WHERE guest_id = ?1 AND status IN (\'open\', \'acknowledged\', \'clinical_stop\')', guestId, staffId, now, ok),
    auditStmt(db, { staffId, action: 'clinical_stop.release', resource: 'guest', resourceId: guestId, guestId, detail: { ok }, now }),
  ]);
}

/** kura / berlet ajanlhato-e (szakmai stop vagy nyitott ellenjavallati jelzes alatt NEM) */
export async function kuraAjanlhato(db, guestId) {
  const g = await elso(db, 'SELECT clinical_stop FROM guest WHERE id = ?1', guestId);
  if (g?.clinical_stop) return { ok: false, ok_kod: `clinical_stop:${g.clinical_stop}` };
  const a = await elso(db, 'SELECT status FROM contraindication_alert WHERE guest_id = ?1 AND status IN (\'open\', \'acknowledged\', \'clinical_stop\') LIMIT 1', guestId);
  if (a) return { ok: false, ok_kod: `alert:${a.status}` };
  return { ok: true };
}

/** a foglalashoz tartozo kerdoiv allapota (T-24 emlekeztetohoz: kitoltetlen-e) */
export async function kerdoivAllapot(db, bookingId) {
  const s = await elso(db, 'SELECT status, safety_flag FROM assessment_submission WHERE booking_id = ?1 ORDER BY issued_at DESC LIMIT 1', bookingId);
  return s ? { status: s.status, jelzes: s.safety_flag === 1, kitoltve: s.status !== 'issued' } : { status: 'missing', kitoltve: false, jelzes: false };
}
