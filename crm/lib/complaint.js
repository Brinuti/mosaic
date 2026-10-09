// Elegedettseg (survey_response) es panaszkezeles (complaint). SZABALYOK (MASTERPROMPT 3.9, 88-97. dontes):
//  - az elso completed kezeles +3h utan 1-5 pontos belso kerdoiv (opcionalis komment); +24h Google-keres (review_request) MINDEN vendegnek, ponttol fuggetlenul
//  - 1-3 pont VAGY negativ szoveg -> Janka (szakmai vezeto) ertesitest kap (outbox alert.negative_survey), DE a panaszt a vendeg SAJAT kezeloje intezi
//    (24 oran belul, lehetoleg telefonon: 2 hivaskiserlet, utana szemelyes e-mail; minden erintkezes naplozott)
//  - nyitott panasz = marketing / visszafoglalas STOP (consent.marketingAllapot), a tranzakcios tajekoztatas marad
//  - kompenzacio (visszateritis, ingyen potlas, kedvezmeny) CSAK szalonvezetoi jovahagyassal (compensation_approval)
//  - resolved: a kezelo dokumentalja a megoldast ES a vendeg mar nem elegedetlen; egyebkent nyitva marad. Lezaras utan elmaradt uzenet nem potlodik.
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, valtozas, korlatHiba, beszurHa, sha256, ujToken } from './db.js';
import { auditStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { megkoveteli, szerepek } from './rbac.js';
import { PANASZ_HATARIDO, PANASZ_HIVAS_KISERLET, SURVEY_RIASZTAS_PONT, KOMPENZACIO_FAJTA, TOKEN_BAJT } from './constants.js';

const NEGATIV_SZAVAK = ['rossz', 'elegedetlen', 'csalodt', 'fajt', 'fájt', 'allergi', 'kiutes', 'viszket', 'egett', 'sertett', 'kellemetlen', 'panasz', 'pocsek', 'borzaszto', 'szornyu', 'nem javasol', 'penzvissza', 'kar a penzert'];
const ekezetmentes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** egyszeru, konzervativ kulcsszavas jelzes (a kezelo / Janka kezzel is jelolhet): negativ szoveges komment? */
export function negativSzoveg(szoveg) {
  const s = ekezetmentes(szoveg);
  return NEGATIV_SZAVAK.map(ekezetmentes).some((w) => s.includes(w));
}

// ---- survey ---------------------------------------------------------------------------------------------------------------------------------
/** kerdoiv-link az ELSO completed kezeleshez (S0, +3h-kor hivja a motor). Plaintext token csak itt; a DB-ben a hash. */
export async function surveyKiad(db, { bookingId, now = most() }) {
  const s = await elso(db, 'SELECT s.*, b.status AS bstatus FROM treatment_session s JOIN booking b ON b.id = s.booking_id WHERE s.booking_id = ?1', bookingId);
  if (!s || s.bstatus !== 'completed') throw new CrmHiba('NEM_IGAZOLT', 'kerdoiv csak igazolt (completed) kezeleshez adhato ki', 409);
  if (s.treatment_index !== 1) throw new CrmHiba('NEM_ELSO_KEZELES', 'a belso elegedettsegi kerdoiv az elso kezeles utan megy', 409);
  const token = ujToken(TOKEN_BAJT), hash = await sha256(token);
  const van = await elso(db, 'SELECT * FROM survey_response WHERE booking_id = ?1', bookingId);
  if (van) {
    if (van.score !== null) return { mar: true, surveyId: van.id };
    await keszit(db, 'UPDATE survey_response SET token_hash = ?2 WHERE id = ?1 AND score IS NULL', van.id, hash).run();
    return { mar: false, surveyId: van.id, token };
  }
  const id = uuid();
  try {
    await tranzakcio(db, [
      keszit(db, 'INSERT INTO survey_response (id, guest_id, booking_id, therapist_id, token_hash, issued_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)', id, s.guest_id, bookingId, s.therapist_id, hash, now),
      auditStmt(db, { action: 'survey.issued', resource: 'survey_response', resourceId: id, guestId: s.guest_id, now }),
    ]);
  } catch (e) { if (korlatHiba(e)) return surveyKiad(db, { bookingId, now }); throw e; }
  return { mar: false, surveyId: id, token };
}

/**
 * Pontszam beadasa (a vendeg a tokenes linken). Negativ (<=3 vagy negativ szoveg) eseten EGY tranzakcioban: panasz-sor a sajat kezelonek (24h),
 * Janka-riasztas es kezeloi feladat (outbox). A Google-keres (review_request) ettol FUGGETLEN.
 */
export async function surveyBead(db, { token, pont, komment = null, negativ = null, now = most(), ipHash = null }) {
  if (!Number.isInteger(pont) || pont < 1 || pont > 5) throw new CrmHiba('ERVENYTELEN_PONT', 'a pontszam 1..5 egesz szam', 400);
  const sv = await elso(db, 'SELECT * FROM survey_response WHERE token_hash = ?1', await sha256(String(token ?? '')));
  if (!sv) throw new CrmHiba('ISMERETLEN_LINK', 'ervenytelen kerdoiv-link', 404);
  if (sv.score !== null) throw new CrmHiba('MAR_BEADVA', 'a kerdoivet mar kitoltottek', 409);
  const szoveg = komment ? String(komment).slice(0, 2000) : null;
  const neg = negativ === null ? negativSzoveg(szoveg) : !!negativ;
  const riaszt = pont <= SURVEY_RIASZTAS_PONT || neg;
  const ut = [keszit(db, 'UPDATE survey_response SET score = ?2, comment = ?3, negative = ?4, submitted_at = ?5 WHERE id = ?1 AND score IS NULL', sv.id, pont, szoveg, neg ? 1 : 0, now)];
  let panaszId = null;
  if (riaszt) {
    const kezelo = sv.therapist_id || (await elso(db, 'SELECT therapist_id FROM guest WHERE id = ?1', sv.guest_id))?.therapist_id;
    if (!kezelo) throw new CrmHiba('NINCS_KEZELO', 'a panaszhoz nem tartozik kezelo', 409);
    panaszId = uuid();
    const ha = { sql: 'SELECT 1 FROM survey_response WHERE id = ? AND score = ? AND submitted_at = ?', params: [sv.id, pont, now] };
    ut.push(beszurHa(db, { tabla: 'complaint', ha, adat: { id: panaszId, guest_id: sv.guest_id, booking_id: sv.booking_id, survey_id: sv.id, therapist_id: kezelo, status: 'open', source: 'survey', description: szoveg, opened_at: now, due_at: now + PANASZ_HATARIDO } }));
    ut.push(outboxStmt(db, { tipus: 'alert.negative_survey', aggTipus: 'survey_response', aggId: sv.id, guestId: sv.guest_id, payload: { survey_id: sv.id, complaint_id: panaszId, score: pont, negative_text: neg, therapist_id: kezelo }, dedupeKey: `alert.negative_survey:${sv.id}`, now, ha }));
    ut.push(outboxStmt(db, { tipus: 'complaint.opened', aggTipus: 'complaint', aggId: panaszId, guestId: sv.guest_id, payload: { complaint_id: panaszId, therapist_id: kezelo, due_at: now + PANASZ_HATARIDO }, dedupeKey: `complaint.opened:${panaszId}`, now, ha }));
    ut.push(auditStmt(db, { action: 'complaint.opened', resource: 'complaint', resourceId: panaszId, guestId: sv.guest_id, detail: { forras: 'survey', pont }, ipHash, now, ha }));
  }
  ut.push(auditStmt(db, { action: 'survey.submitted', resource: 'survey_response', resourceId: sv.id, guestId: sv.guest_id, detail: { pont, negativ: neg }, ipHash, now }));
  try { await tranzakcio(db, ut); } catch (e) { if (korlatHiba(e)) throw new CrmHiba('MAR_BEADVA', 'a kerdoiv kozben beerkezett', 409); throw e; }
  return { surveyId: sv.id, riasztas: riaszt, complaintId: riaszt ? panaszId : null };
}

/** kezelonkenti riport (88. dontes): kitoltesek, atlag, negativ darab */
export async function kezeloRiport(db, { tol = 0, ig = 4102444800 } = {}) {
  return mind(db, `SELECT s.therapist_id, u.name, COUNT(*) AS db, ROUND(AVG(s.score), 2) AS atlag, SUM(CASE WHEN s.score <= ?3 OR s.negative = 1 THEN 1 ELSE 0 END) AS negativ
    FROM survey_response s LEFT JOIN staff_user u ON u.id = s.therapist_id WHERE s.score IS NOT NULL AND s.submitted_at >= ?1 AND s.submitted_at <= ?2 GROUP BY s.therapist_id ORDER BY atlag`, tol, ig, SURVEY_RIASZTAS_PONT);
}

// ---- panasz ---------------------------------------------------------------------------------------------------------------------------------
export const panasz = (db, id) => elso(db, 'SELECT * FROM complaint WHERE id = ?1', id);
export const nyitottPanaszok = (db) => mind(db, 'SELECT * FROM complaint WHERE status = \'open\' ORDER BY due_at');
export async function nyitottPanasz(db, guestId) { return !!(await elso(db, 'SELECT 1 AS x FROM complaint WHERE guest_id = ?1 AND status = \'open\' LIMIT 1', guestId)); }

/** kezi panasz-megnyitas (a kezelo szalonban / telefonon kapott panaszt rogzit). A felelos a vendeg kezeloje (vagy a megadott). */
export async function panaszNyit(db, { guestId, bookingId = null, kezeloId = null, forras = 'staff', leiras = null, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'complaint', { guestId, now });
  const g = await elso(db, 'SELECT * FROM guest WHERE id = ?1', guestId);
  if (!g || g.status !== 'active') throw new CrmHiba('NINCS_VENDEG', 'nincs aktiv vendeg', 404);
  const b = bookingId ? await elso(db, 'SELECT * FROM booking WHERE id = ?1', bookingId) : null;
  const felelos = kezeloId || b?.therapist_id || g.therapist_id || staffId;
  const id = uuid();
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO complaint (id, guest_id, booking_id, therapist_id, status, source, description, opened_at, due_at) VALUES (?1, ?2, ?3, ?4, \'open\', ?5, ?6, ?7, ?8)', id, guestId, bookingId, felelos, forras, leiras, now, now + PANASZ_HATARIDO),
    outboxStmt(db, { tipus: 'complaint.opened', aggTipus: 'complaint', aggId: id, guestId, payload: { complaint_id: id, therapist_id: felelos, due_at: now + PANASZ_HATARIDO }, dedupeKey: `complaint.opened:${id}`, now }),
    auditStmt(db, { staffId, action: 'complaint.opened', resource: 'complaint', resourceId: id, guestId, detail: { forras, felelos }, now }),
  ]);
  return { complaintId: id, felelos, hatarido: now + PANASZ_HATARIDO };
}

async function sajatKezelo(db, c, staffId, muvelet, now) {
  await megkoveteli(db, staffId, 'write', 'complaint', { guestId: c.guest_id, resourceId: c.id, now });
  if (c.therapist_id !== staffId) {   // a szakmai vezeto sem intezheti: a SAJAT kezelo felelos
    await auditStmt(db, { staffId, action: `complaint.${muvelet}`, resource: 'complaint', resourceId: c.id, guestId: c.guest_id, result: 'denied', detail: { ok: 'nem_a_felelos_kezelo' }, now }).run();
    throw new CrmHiba('NEM_A_FELELOS', 'a panaszt a vendeg sajat kezeloje intezi', 403);
  }
}

/** erintkezes naplozasa. 2 hivaskiserlet, azutan szemelyes e-mail (ha a hivas nem sikerult). */
export async function probalkozas(db, { complaintId, staffId, tipus, eredmeny, megjegyzes = null, now = most() }) {
  const c = await panasz(db, complaintId);
  if (!c) throw new CrmHiba('NINCS_PANASZ', 'nincs ilyen panasz', 404);
  await sajatKezelo(db, c, staffId, 'contact', now);
  if (c.status !== 'open') throw new CrmHiba('LEZART', 'a panasz mar lezart', 409);
  if (!['call', 'email'].includes(tipus)) throw new CrmHiba('ERVENYTELEN_TIPUS', 'call | email', 400);
  if (!['reached', 'no_answer', 'sent', 'bounced'].includes(eredmeny)) throw new CrmHiba('ERVENYTELEN_EREDMENY', 'reached | no_answer | sent | bounced', 400);
  const hivasok = await mind(db, 'SELECT outcome FROM complaint_contact_attempt WHERE complaint_id = ?1 AND kind = \'call\'', complaintId);
  if (tipus === 'call') {
    if (hivasok.length >= PANASZ_HIVAS_KISERLET) throw new CrmHiba('MAX_HIVAS', `legfeljebb ${PANASZ_HIVAS_KISERLET} hivaskiserlet; ezutan szemelyes e-mail`, 409);
  } else if (hivasok.length < PANASZ_HIVAS_KISERLET && !hivasok.some((h) => h.outcome === 'reached')) {
    throw new CrmHiba('ELOBB_KET_HIVAS', 'e-mail elott ket (sikertelen) hivaskiserlet szukseges, kiveve ha a vendeg telefonon elerheto volt', 409);
  }
  const id = uuid();
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO complaint_contact_attempt (id, complaint_id, kind, outcome, note, staff_id, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)', id, complaintId, tipus, eredmeny, megjegyzes, staffId, now),
    keszit(db, 'UPDATE complaint SET first_contact_at = COALESCE(first_contact_at, ?2) WHERE id = ?1', complaintId, now),
    auditStmt(db, { staffId, action: 'complaint.contact', resource: 'complaint', resourceId: complaintId, guestId: c.guest_id, detail: { tipus, eredmeny }, now }),
  ]);
  return { attemptId: id, hatarido_belul: now <= c.due_at };
}

/**
 * Lezaras: CSAK a felelos kezelo, dokumentalt megoldassal, legalabb egy erintkezes utan, ha a vendeg mar nem elegedetlen es nincs fuggo kompenzacio.
 * Egyebkent a panasz NYITVA marad ({ lezarva: false }). Lezaras utan a marketing a friss vendegallapot szerint indulhat ujra (kimaradtak nem potlodnak).
 */
export async function lezar(db, { complaintId, staffId, megoldas, vendegElegedett, now = most() }) {
  const c = await panasz(db, complaintId);
  if (!c) throw new CrmHiba('NINCS_PANASZ', 'nincs ilyen panasz', 404);
  await sajatKezelo(db, c, staffId, 'resolve', now);
  if (c.status === 'resolved') return { lezarva: true, mar: true };
  if (!megoldas || !String(megoldas).trim()) throw new CrmHiba('MEGOLDAS_KELL', 'a megoldast dokumentalni kell', 400);
  const probak = (await elso(db, 'SELECT COUNT(*) AS n FROM complaint_contact_attempt WHERE complaint_id = ?1', complaintId)).n;
  if (probak < 1) throw new CrmHiba('NINCS_ERINTKEZES', 'lezaras elott legalabb egy dokumentalt erintkezes kell', 409);
  const fuggo = (await elso(db, 'SELECT COUNT(*) AS n FROM compensation_approval WHERE complaint_id = ?1 AND status = \'pending\'', complaintId)).n;
  if (fuggo > 0) throw new CrmHiba('FUGGO_KOMPENZACIO', 'fuggo kompenzacio-jovahagyas mellett nem zarhato le', 409);
  if (vendegElegedett !== true) {   // tovabbra is elegedetlen: nyitva marad, a megoldas-kiserlet dokumentalva
    await tranzakcio(db, [
      keszit(db, 'UPDATE complaint SET resolution = ?2, guest_satisfied = 0 WHERE id = ?1 AND status = \'open\'', complaintId, String(megoldas)),
      auditStmt(db, { staffId, action: 'complaint.resolve_attempt', resource: 'complaint', resourceId: complaintId, guestId: c.guest_id, detail: { elegedett: false }, now }),
    ]);
    return { lezarva: false, ok_kod: 'MEG_ELEGEDETLEN' };
  }
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE complaint SET status = \'resolved\', resolution = ?2, guest_satisfied = 1, resolved_by = ?3, resolved_at = ?4 WHERE id = ?1 AND status = \'open\'', complaintId, String(megoldas), staffId, now),
    outboxStmt(db, { tipus: 'complaint.resolved', aggTipus: 'complaint', aggId: complaintId, guestId: c.guest_id, payload: { complaint_id: complaintId }, dedupeKey: `complaint.resolved:${complaintId}`, now, ha: { sql: 'SELECT 1 FROM complaint WHERE id = ? AND status = \'resolved\'', params: [complaintId] } }),
    auditStmt(db, { staffId, action: 'complaint.resolved', resource: 'complaint', resourceId: complaintId, guestId: c.guest_id, now, ha: { sql: 'SELECT 1 FROM complaint WHERE id = ? AND status = \'resolved\'', params: [complaintId] } }),
  ]);
  return { lezarva: valtozas(r) === 1 };
}

/** a felelos kezelo cseréje (pl. tavollet) - szalonvezeto */
export async function felelosCsere(db, { complaintId, ujKezeloId, staffId, ok, now = most() }) {
  await megkoveteli(db, staffId, 'reassign', 'complaint', { resourceId: complaintId, now });
  if (!ok) throw new CrmHiba('INDOK_KELL', 'indok kell', 400);
  const sz = await szerepek(db, ujKezeloId);
  if (!sz.includes('therapist')) throw new CrmHiba('NEM_KEZELO', 'az uj felelos kezelo kell legyen', 400);
  await tranzakcio(db, [
    keszit(db, 'UPDATE complaint SET therapist_id = ?2 WHERE id = ?1 AND status = \'open\'', complaintId, ujKezeloId),
    auditStmt(db, { staffId, action: 'complaint.reassign', resource: 'complaint', resourceId: complaintId, detail: { ujKezeloId, ok }, now }),
  ]);
}

/** a 24 oras hatarido lejart, es meg nem volt erintkezes (felugyeleti lista) */
export const keso = (db, now = most()) => mind(db, 'SELECT * FROM complaint WHERE status = \'open\' AND first_contact_at IS NULL AND due_at < ?1 ORDER BY due_at', now);

// ---- kompenzacio ----------------------------------------------------------------------------------------------------------------------------
/** kompenzacio KERESE (a felelos kezelo) - penzugyi hatasa csak szalonvezetoi jovahagyas utan van */
export async function kompenzacioKeres(db, { complaintId, tipus, osszeg = null, staffId, now = most() }) {
  const c = await panasz(db, complaintId);
  if (!c) throw new CrmHiba('NINCS_PANASZ', 'nincs ilyen panasz', 404);
  await megkoveteli(db, staffId, 'request', 'compensation', { guestId: c.guest_id, resourceId: complaintId, now });
  if (!KOMPENZACIO_FAJTA.includes(tipus)) throw new CrmHiba('ISMERETLEN_FAJTA', KOMPENZACIO_FAJTA.join(' | '), 400);
  if (['refund', 'discount'].includes(tipus) && !(Number.isInteger(osszeg) && osszeg > 0)) throw new CrmHiba('ERVENYTELEN_OSSZEG', 'pozitiv egesz forint kell', 400);
  const id = uuid();
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO compensation_approval (id, complaint_id, kind, amount_huf, status, requested_by, requested_at) VALUES (?1, ?2, ?3, ?4, \'pending\', ?5, ?6)', id, complaintId, tipus, osszeg, staffId, now),
    auditStmt(db, { staffId, action: 'compensation.requested', resource: 'compensation_approval', resourceId: id, guestId: c.guest_id, detail: { tipus, osszeg }, now }),
  ]);
  return { approvalId: id };
}

/** szalonvezetoi dontes (approved | rejected) - kulon approval-naplo */
export async function kompenzacioDont(db, { approvalId, staffId, dontes, megjegyzes = null, now = most() }) {
  await megkoveteli(db, staffId, 'approve', 'compensation', { resourceId: approvalId, now });
  if (!['approved', 'rejected'].includes(dontes)) throw new CrmHiba('ERVENYTELEN_DONTES', 'approved | rejected', 400);
  const k = await elso(db, 'SELECT k.*, c.guest_id FROM compensation_approval k JOIN complaint c ON c.id = k.complaint_id WHERE k.id = ?1', approvalId);
  if (!k) throw new CrmHiba('NINCS_JOVAHAGYAS', 'nincs ilyen kompenzacio-keres', 404);
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE compensation_approval SET status = ?2, decided_by = ?3, decided_at = ?4, decision_note = ?5 WHERE id = ?1 AND status = \'pending\'', approvalId, dontes, staffId, now, megjegyzes),
    auditStmt(db, { staffId, action: `compensation.${dontes}`, resource: 'compensation_approval', resourceId: approvalId, guestId: k.guest_id, detail: { tipus: k.kind, osszeg: k.amount_huf }, now }),
  ]);
  if (valtozas(r) !== 1) throw new CrmHiba('NEM_FUGGO', 'a keres mar eldontott', 409);
}

/** kiadhato-e a kompenzacio (penzugyi muvelet elott kotelezo ellenorzes) */
export async function kompenzacioKiadhato(db, approvalId) { return !!(await elso(db, 'SELECT 1 AS x FROM compensation_approval WHERE id = ?1 AND status = \'approved\'', approvalId)); }
