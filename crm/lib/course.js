// Kura (course) es kezeles (treatment_session). SZABALYOK (MASTERPROMPT 3.4):
//  - a treatment_index CSAK kezelo-igazolt, egyszeri completed utan no (booking.igazolCompleted hivja a kezelesStmts-t egy batch-ben)
//  - camera_assessment NEM kezeles-alkalom; first_hair = 1, followup_hair = 2..11
//  - kamera-felvetel kotelezo: 1 / 3 / 5 / 10 (camera_required flag); a 2. kezelesnel nincs; a 11. = zaras, nincs uj kotelezo kamerakep
//  - allapotok: not_started -> active -> completed_11 | paused_clinical | closed_individual
import { CrmHiba, uuid, most, elso, mind, keszit, korlatHiba, beszurHa } from './db.js';
import { KURA_HOSSZ, KAMERA_KOTELEZO_ALKALMAK, KURAZARO_ALKALOM, DOKUMENTUM_ALKALMANKENT, DOKUMENTUM_HATARIDO, SZOLGALTATAS, KEZELES_RITMUS_NAP, GOOGLE_KESLELTETES } from './constants.js';
import { auditStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { megkoveteli } from './rbac.js';

export const kameraKotelezo = (index) => KAMERA_KOTELEZO_ALKALMAK.includes(index);
export const dokumentumFajta = (index) => DOKUMENTUM_ALKALMANKENT[index] || null;

export const nyitottKura = (db, guestId) => elso(db, 'SELECT * FROM course WHERE guest_id = ?1 AND status IN (\'not_started\', \'active\', \'paused_clinical\')', guestId);

/** a vendegnek van nyitott kurája (nincs: not_started letrejon). Verseny ellen UNIQUE index. */
export async function kuraBiztosit(db, guestId, { now = most() } = {}) {
  const van = await nyitottKura(db, guestId);
  if (van) return van;
  try {
    await beszurHa(db, { tabla: 'course', adat: { id: uuid(), guest_id: guestId, status: 'not_started', treatment_index: 0, created_at: now, updated_at: now } }).run();
  } catch (e) { if (!korlatHiba(e)) throw e; }
  return nyitottKura(db, guestId);
}

/**
 * Melyik kezeles-sorszam kovetkezik, es szabad-e. Hibak: ELSO_KEZELES_HIANYZIK (followup 1. kezeles nelkul), ELSO_KEZELES_MAR_MEGVAN,
 * KURA_LEZARVA / KURA_SZUNETEL, KURA_TELJES.
 */
export function kovetkezoIndex(kura, szolgaltatas) {
  if (szolgaltatas !== SZOLGALTATAS.FIRST_HAIR && szolgaltatas !== SZOLGALTATAS.FOLLOWUP_HAIR) throw new CrmHiba('NEM_KEZELES', `${szolgaltatas} nem kura-alkalom`, 400);
  if (kura.status === 'paused_clinical') throw new CrmHiba('KURA_SZUNETEL', 'a kura szakmai okbol szuneteltetve van', 409);
  if (!['not_started', 'active'].includes(kura.status)) throw new CrmHiba('KURA_LEZARVA', `a kura allapota: ${kura.status}`, 409);
  const kov = kura.treatment_index + 1;
  if (kov > KURA_HOSSZ) throw new CrmHiba('KURA_TELJES', 'a kura mar teljes', 409);
  if (szolgaltatas === SZOLGALTATAS.FIRST_HAIR && kov !== 1) throw new CrmHiba('ELSO_KEZELES_MAR_MEGVAN', 'az elso kezeles mar megtortent ebben a kurában', 409);
  if (szolgaltatas === SZOLGALTATAS.FOLLOWUP_HAIR && kov === 1) throw new CrmHiba('ELSO_KEZELES_HIANYZIK', 'folytato kezeles az elso kezeles nelkul nem igazolhato (kezi korrekcio: kuraKorrekcio)', 409);
  return kov;
}

/**
 * A completed-igazolas batch-utasitasai (booking.igazolCompleted hivja, a booking UPDATE es a treatment_session INSERT UTAN).
 * Minden utasitas a sessionId letezesehez kotott (EXISTS), igy ha a session-beszuras nem tortent meg, semmi nem ir.
 */
export function kezelesStmts(db, { booking, kura, index, sessionId, staffId, therapistId, now }) {
  const ha = { sql: 'SELECT 1 FROM treatment_session WHERE id = ?', params: [sessionId] };
  const zaro = index === KURAZARO_ALKALOM;
  const ut = [
    keszit(db,
      `UPDATE course SET treatment_index = ?2, status = ?3, started_at = COALESCE(started_at, ?4), completed_at = ?5, updated_at = ?4
         WHERE id = ?1 AND treatment_index = ?6 AND status IN ('not_started', 'active') AND EXISTS (SELECT 1 FROM treatment_session WHERE id = ?7)`,
      kura.id, index, zaro ? 'completed_11' : 'active', now, zaro ? now : null, index - 1, sessionId),
    keszit(db, 'UPDATE guest SET last_treatment_at = ?2, therapist_id = ?3, updated_at = ?2 WHERE id = ?1 AND EXISTS (SELECT 1 FROM treatment_session WHERE id = ?4)', booking.guest_id, now, therapistId, sessionId),
  ];
  const fajta = dokumentumFajta(index);
  if (fajta) {
    ut.push(beszurHa(db, { tabla: 'treatment_plan', ignore: true, ha, adat: {
      id: uuid(), session_id: sessionId, guest_id: booking.guest_id, course_id: kura.id, kind: fajta, status: 'missing', therapist_id: therapistId,
      version: 1, due_at: now + DOKUMENTUM_HATARIDO.KEZELO_RIASZTAS, created_at: now, updated_at: now } }));
  }
  if (index === 1) {   // G0: Google-ertekeleskeres, MINDEN elso vendegnek, pontszamtol fuggetlenul
    ut.push(beszurHa(db, { tabla: 'review_request', ignore: true, ha, adat: { id: uuid(), guest_id: booking.guest_id, booking_id: booking.id, due_at: now + GOOGLE_KESLELTETES, status: 'pending', created_at: now } }));
  }
  ut.push(outboxStmt(db, { tipus: 'booking.completed', aggTipus: 'booking', aggId: booking.id, guestId: booking.guest_id, ha,
    payload: { booking_id: booking.id, treatment_index: index, camera_required: kameraKotelezo(index), course_closing: zaro, first: index === 1 },
    dedupeKey: `booking.completed:${booking.id}`, now }));
  ut.push(auditStmt(db, { staffId, action: 'course.treatment_confirmed', resource: 'treatment_session', resourceId: sessionId, guestId: booking.guest_id, ha,
    detail: { booking_id: booking.id, treatment_index: index, course_id: kura.id }, now }));
  return ut;
}

/** kura-osszegzo: hol tart, mi a kovetkezo, kell-e kamera / dokumentum */
export async function kuraAllapot(db, guestId) {
  const kura = (await nyitottKura(db, guestId)) || (await elso(db, 'SELECT * FROM course WHERE guest_id = ?1 ORDER BY created_at DESC LIMIT 1', guestId));
  if (!kura) return { status: 'not_started', treatmentIndex: 0, kovetkezoAlkalom: 1, kameraKotelezo: true, kuraAjanlhato: true };
  const g = await elso(db, 'SELECT clinical_stop FROM guest WHERE id = ?1', guestId);
  const kov = kura.treatment_index + 1;
  return {
    courseId: kura.id, status: kura.status, treatmentIndex: kura.treatment_index,
    kovetkezoAlkalom: kov <= KURA_HOSSZ ? kov : null,
    kameraKotelezo: kov <= KURA_HOSSZ ? kameraKotelezo(kov) : false,
    dokumentum: kov <= KURA_HOSSZ ? dokumentumFajta(kov) : null,
    ritmusNap: KEZELES_RITMUS_NAP,
    kuraAjanlhato: !g?.clinical_stop && !['paused_clinical', 'closed_individual'].includes(kura.status),   // szakmai stop alatt kura / berlet nem ajanlhato
  };
}

export const kezelesek = (db, courseId) => mind(db, 'SELECT * FROM treatment_session WHERE course_id = ?1 ORDER BY treatment_index', courseId);

/** szakmai szuneteltetes (kezelo / szakmai vezeto) */
export async function szuneteltet(db, { courseId, staffId, ok, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'course', { resourceId: courseId, now });
  if (!ok) throw new CrmHiba('INDOK_KELL', 'indok kell', 400);
  const k = await elso(db, 'SELECT * FROM course WHERE id = ?1', courseId);
  if (!k) throw new CrmHiba('NINCS_KURA', 'nincs ilyen kura', 404);
  if (!['not_started', 'active'].includes(k.status)) throw new CrmHiba('NEM_SZUNETELTETHETO', `allapot: ${k.status}`, 409);
  await keszit(db, 'UPDATE course SET status = \'paused_clinical\', paused_at = ?2, paused_reason = ?3, updated_at = ?2 WHERE id = ?1', courseId, now, ok).run();
  await auditStmt(db, { staffId, action: 'course.pause', resource: 'course', resourceId: courseId, guestId: k.guest_id, detail: { ok }, now }).run();
}
export async function folytat(db, { courseId, staffId, ok, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'course', { resourceId: courseId, now });
  const k = await elso(db, 'SELECT c.*, g.clinical_stop FROM course c JOIN guest g ON g.id = c.guest_id WHERE c.id = ?1', courseId);
  if (!k || k.status !== 'paused_clinical') throw new CrmHiba('NEM_SZUNETEL', 'a kura nem szunetel', 409);
  if (k.clinical_stop) throw new CrmHiba('KLINIKAI_STOP', 'a szakmai stop feloldasa elobb szukseges', 409);
  await keszit(db, 'UPDATE course SET status = ?2, paused_at = NULL, paused_reason = NULL, updated_at = ?3 WHERE id = ?1', courseId, k.treatment_index > 0 ? 'active' : 'not_started', now).run();
  await auditStmt(db, { staffId, action: 'course.resume', resource: 'course', resourceId: courseId, guestId: k.guest_id, detail: { ok }, now }).run();
}
/** egyeni lezaras (fenntartas / szakmai megszakitas) - a kezelo indokkal */
export async function egyeniLezaras(db, { courseId, staffId, ok, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'course', { resourceId: courseId, now });
  if (!ok) throw new CrmHiba('INDOK_KELL', 'indok kell', 400);
  const k = await elso(db, 'SELECT * FROM course WHERE id = ?1', courseId);
  if (!k || !['not_started', 'active', 'paused_clinical'].includes(k.status)) throw new CrmHiba('NEM_LEZARHATO', 'a kura nem lezarhato', 409);
  await keszit(db, 'UPDATE course SET status = \'closed_individual\', closed_at = ?2, closed_reason = ?3, updated_at = ?2 WHERE id = ?1', courseId, now, ok).run();
  await auditStmt(db, { staffId, action: 'course.close_individual', resource: 'course', resourceId: courseId, guestId: k.guest_id, detail: { ok }, now }).run();
}
/** naplozott kezi korrekcio (pl. mas rendszerben mar megtortent kezelesek atvezetese): a sorszam beallitasa */
export async function kuraKorrekcio(db, { courseId, ujIndex, staffId, ok, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'course', { resourceId: courseId, now });
  if (!ok || !Number.isInteger(ujIndex) || ujIndex < 0 || ujIndex >= KURA_HOSSZ) throw new CrmHiba('ERVENYTELEN_KORREKCIO', 'indok es 0..10 sorszam kell', 400);
  const k = await elso(db, 'SELECT * FROM course WHERE id = ?1', courseId);
  if (!k || !['not_started', 'active'].includes(k.status)) throw new CrmHiba('NEM_KORRIGALHATO', 'csak nyitott kura korrigalhato', 409);
  const sessionMax = (await elso(db, 'SELECT COALESCE(MAX(treatment_index), 0) AS m FROM treatment_session WHERE course_id = ?1', courseId)).m;
  if (ujIndex < sessionMax) throw new CrmHiba('NEM_KORRIGALHATO', 'a sorszam nem lehet kisebb az igazolt kezelesek legnagyobb sorszamanal', 409);
  await keszit(db, 'UPDATE course SET treatment_index = ?2, status = ?3, started_at = COALESCE(started_at, ?4), updated_at = ?4 WHERE id = ?1', courseId, ujIndex, ujIndex > 0 ? 'active' : 'not_started', now).run();
  await auditStmt(db, { staffId, action: 'course.correction', resource: 'course', resourceId: courseId, guestId: k.guest_id, detail: { regi: k.treatment_index, uj: ujIndex, ok }, now }).run();
}
