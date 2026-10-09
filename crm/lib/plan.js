// Szemelyes dokumentacio: treatment_plan (A5 kuraterv / kontroll-ertekeles / kurazaro) + treatment_note. Allapotgep:
//   missing -> draft -> therapist_final -> generated_pdf -> sent
// A sor (missing) a kezeles igazolasakor jon letre (course.kezelesStmts): 1. alkalom = 'plan', 3/5/10 = 'review', 11 = 'closing'.
// SZEMELYES dokumentum / kep CSAK akkor kuldheto, ha therapist_final + a megfelelo kepek megvannak + a cimzett ellenorzott (kuldhetoE).
// Altalanos (nem szemelyes) uzenet hianyos dokumentacio mellett is mehet - azt az uzenet-motor kezeli, itt nincs kapuja.
// A tartalom ugyanabbol az egy kezeloi urlapbol (fields) generalodik: A5 PDF + biztonsagos e-mail. A PDF-et a pdf.js rendereli; ide a bajtok jonnek.
// Hiany: +24h -> kezeloi riasztas (alert.doc24), +48h -> Janka (alert.doc48): dokumentumRiasztasok().
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, valtozas, jsonIr, jsonOlvas, korlatHiba, normEmail } from './db.js';
import { auditStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { megkoveteli } from './rbac.js';
import { DOKUMENTUM_HATARIDO, ERTEKELES_MONDAT, KAMERA_KOTELEZO_ALKALMAK, KURAZARO_ALKALOM, KEZELES_RITMUS_NAP } from './constants.js';

/** a 2-3 mondatos ertekeleshez: mondatok szama (. ! ? zarojelek; ures szakaszok nem szamitanak) */
export function mondatSzam(szoveg) {
  return String(szoveg ?? '').split(/[.!?]+(?:\s+|$)/).map((x) => x.trim()).filter((x) => x.length >= 2).length;
}
const nemUres = (v) => typeof v === 'string' && v.trim().length > 0;
const mondatOk = (v) => { const n = mondatSzam(v); return n >= ERTEKELES_MONDAT.min && n <= ERTEKELES_MONDAT.max; };

/** a kotelezo mezok szabalyai fajtankent (MASTERPROMPT 1151-1165). Visszaad: hianyzo / hibas mezok listaja. */
export function mezoHibak(kind, f = {}) {
  const h = [];
  const kell = (felt, nev) => { if (!felt) h.push(nev); };
  if (kind === 'plan') {
    kell(nemUres(f.fo_panasz), 'fo_panasz');
    kell(Array.isArray(f.megfigyelesek) && f.megfigyelesek.some(nemUres), 'megfigyelesek');
    kell(nemUres(f.cel), 'cel');
    kell(f.teljes_kura_11 === true || nemUres(f.egyeni_terv_indok), 'ajanlott_terv');   // 11 alkalmas kura VAGY szakmailag indokolt egyeni terv
    kell(Number.isInteger(f.ritmus_nap) && f.ritmus_nap > 0, 'ritmus_nap');
    kell(f.otthoni_apolas && nemUres(f.otthoni_apolas.termek) && nemUres(f.otthoni_apolas.hasznalat), 'otthoni_apolas');
    kell(mondatOk(f.kezeloi_javaslat), 'kezeloi_javaslat_2_3_mondat');
    const k = f.kovetkezo_idopont;
    kell(k && (nemUres(k.booking_id) || nemUres(k.javasolt_intervallum)), 'kovetkezo_idopont');
  } else if (kind === 'review') {
    kell(mondatOk(f.ertekeles), 'ertekeles_2_3_mondat');
    kell(nemUres(f.otthoni_rutin_kontroll), 'otthoni_rutin_kontroll');
  } else if (kind === 'closing') {
    kell(nemUres(f.kiindulo_panasz), 'kiindulo_panasz');
    kell(nemUres(f.cel), 'cel');
    kell(nemUres(f.zaro_ertekeles), 'zaro_ertekeles');
    kell(nemUres(f.fenntartasi_javaslat), 'fenntartasi_javaslat');   // egyeni; fenntarto kezeles csak kulon indoklassal
    kell(nemUres(f.otthoni_rutin), 'otthoni_rutin');
  } else h.push('ismeretlen_fajta');
  return h;
}

export const terv = (db, id) => elso(db, 'SELECT * FROM treatment_plan WHERE id = ?1', id);
export const tervSession = (db, sessionId, kind = null) => (kind
  ? elso(db, 'SELECT * FROM treatment_plan WHERE session_id = ?1 AND kind = ?2', sessionId, kind)
  : elso(db, 'SELECT * FROM treatment_plan WHERE session_id = ?1', sessionId));
export const mezok = (p) => jsonOlvas(p?.fields, {});

/** mezok mentese (draft). therapist_final / generated_pdf utan szerkesztve visszaall draftra (a PDF ervenytelen); elkuldott dokumentum nem szerkesztheto. */
export async function ment(db, { planId, mezok: uj, staffId, now = most() }) {
  const p = await terv(db, planId);
  if (!p) throw new CrmHiba('NINCS_TERV', 'nincs ilyen dokumentum', 404);
  await megkoveteli(db, staffId, 'write', 'plan', { guestId: p.guest_id, resourceId: planId, now });
  if (p.status === 'sent') throw new CrmHiba('MAR_ELKULDVE', 'az elkuldott dokumentum nem szerkesztheto', 409);
  const egyesitett = { ...mezok(p), ...uj };
  const visszaall = ['therapist_final', 'generated_pdf'].includes(p.status);
  await tranzakcio(db, [
    keszit(db, `UPDATE treatment_plan SET fields = ?2, status = 'draft', therapist_id = COALESCE(therapist_id, ?3), version = version + ?4, final_at = NULL, approved_by = NULL, pdf_file_id = NULL, pdf_generated_at = NULL, updated_at = ?5 WHERE id = ?1 AND status <> 'sent'`,
      planId, jsonIr(egyesitett), staffId, visszaall ? 1 : 0, now),
    auditStmt(db, { staffId, action: 'plan.save', resource: 'treatment_plan', resourceId: planId, guestId: p.guest_id, detail: { visszaallt_draftra: visszaall }, now }),
  ]);
  return { status: 'draft', version: p.version + (visszaall ? 1 : 0) };
}

/** a kezelo veglegesiti (therapist_final): a kotelezo mezok mind ki vannak toltve */
export async function veglegesit(db, { planId, staffId, now = most() }) {
  const p = await terv(db, planId);
  if (!p) throw new CrmHiba('NINCS_TERV', 'nincs ilyen dokumentum', 404);
  await megkoveteli(db, staffId, 'write', 'plan', { guestId: p.guest_id, resourceId: planId, now });
  if (p.status !== 'draft') throw new CrmHiba('NEM_VAZLAT', `a dokumentum allapota: ${p.status}`, 409);
  const hibak = mezoHibak(p.kind, mezok(p));
  if (hibak.length) throw new CrmHiba('HIANYOS_MEZOK', `hianyzo / hibas mezok: ${hibak.join(', ')}`, 400, hibak);
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE treatment_plan SET status = \'therapist_final\', final_at = ?2, approved_by = ?3, therapist_id = ?3, updated_at = ?2 WHERE id = ?1 AND status = \'draft\'', planId, now, staffId),
    auditStmt(db, { staffId, action: 'plan.final', resource: 'treatment_plan', resourceId: planId, guestId: p.guest_id, detail: { kind: p.kind }, now }),
    outboxStmt(db, { tipus: 'plan.final', aggTipus: 'treatment_plan', aggId: planId, guestId: p.guest_id, payload: { plan_id: planId, kind: p.kind }, dedupeKey: `plan.final:${planId}:v${p.version}`, now }),
  ]);
  if (valtozas(r) !== 1) throw new CrmHiba('VERSENY', 'a dokumentum kozben valtozott', 409);
  return { status: 'therapist_final' };
}

/** a PDF-hez szukseges adatok: levezetett mezok (nev, datum, sorszam, kezelo, booking ID) + a kezeloi urlap */
export async function a5Adat(db, planId) {
  const p = await terv(db, planId);
  if (!p) throw new CrmHiba('NINCS_TERV', 'nincs ilyen dokumentum', 404);
  const s = await elso(db, `SELECT s.treatment_index, s.confirmed_at, b.external_id AS salonic_booking_id, b.start_at, g.name AS vendeg_nev, g.email AS vendeg_email, u.name AS kezelo_nev
    FROM treatment_session s JOIN booking b ON b.id = s.booking_id JOIN guest g ON g.id = s.guest_id LEFT JOIN staff_user u ON u.id = s.therapist_id WHERE s.id = ?1`, p.session_id);
  return { planId, kind: p.kind, status: p.status, version: p.version, levezetett: { vendeg_nev: s.vendeg_nev, datum: s.start_at, kezeles_sorszam: s.treatment_index, kezelo_nev: s.kezelo_nev, salonic_booking_id: s.salonic_booking_id }, mezok: mezok(p) };
}

/** a generalt PDF eltarolasa (tarolo.put) es allapotvaltas therapist_final -> generated_pdf. A bajtokat a pdf.js adja. */
export async function pdfRogzit(db, { planId, bajtok, tarolo, staffId = null, now = most() }) {
  const p = await terv(db, planId);
  if (!p) throw new CrmHiba('NINCS_TERV', 'nincs ilyen dokumentum', 404);
  if (staffId) await megkoveteli(db, staffId, 'write', 'plan', { guestId: p.guest_id, resourceId: planId, now });
  if (p.status !== 'therapist_final') throw new CrmHiba('NEM_VEGLEGES', 'PDF csak therapist_final dokumentumbol keszulhet', 409);
  if (!bajtok?.length) throw new CrmHiba('URES_PDF', 'ures PDF', 400);
  const kulcs = `pdf/${p.guest_id}/${p.id}-v${p.version}.pdf`;
  await tarolo.put(kulcs, bajtok, { mime: 'application/pdf', meret: bajtok.length });
  try {
    const [r] = await tranzakcio(db, [
      keszit(db, 'UPDATE treatment_plan SET status = \'generated_pdf\', pdf_file_id = ?2, pdf_generated_at = ?3, updated_at = ?3 WHERE id = ?1 AND status = \'therapist_final\'', planId, kulcs, now),
      auditStmt(db, { staffId, action: 'plan.pdf', resource: 'treatment_plan', resourceId: planId, guestId: p.guest_id, detail: { meret: bajtok.length }, now }),
    ]);
    if (valtozas(r) !== 1) throw new CrmHiba('VERSENY', 'a dokumentum kozben valtozott', 409);
  } catch (e) { await tarolo.del(kulcs); throw e; }
  return { pdfFileId: kulcs };
}

/** a PDF kiolvasasa (csak jogosult kezelo; naplozott) */
export async function pdfOlvas(db, { planId, staffId, tarolo, now = most() }) {
  const p = await terv(db, planId);
  if (!p?.pdf_file_id) throw new CrmHiba('NINCS_PDF', 'nincs generalt PDF', 404);
  await megkoveteli(db, staffId, 'read', 'plan', { guestId: p.guest_id, resourceId: planId, now });
  await auditStmt(db, { staffId, action: 'plan.pdf_read', resource: 'treatment_plan', resourceId: planId, guestId: p.guest_id, now }).run();
  return tarolo.get(p.pdf_file_id);
}

/**
 * Kuldheto-e a SZEMELYES dokumentum (A5 e-mail / kontroll-ertekeles / kurazaro):
 *  - allapot: therapist_final vagy generated_pdf (a draft / missing SOHA)
 *  - a kotelezo mezok megvannak
 *  - a megfelelo kepek megvannak (plan: 1. alkalom kepe; review: a session kepe + vegleges osszehasonlitas; closing: 1/3/5/10, vagy dokumentalt indok)
 *  - a cimzett ellenorzott: aktiv vendeg, ervenyes + ellenorzott e-mail, es a megadott cimzett egyezik a nyilvantartottal
 */
export async function kuldhetoE(db, planId, { cimzett = null } = {}) {
  const p = await terv(db, planId);
  if (!p) return { ok: false, hianyok: ['NINCS_DOKUMENTUM'] };
  const hianyok = [];
  if (!['therapist_final', 'generated_pdf'].includes(p.status)) hianyok.push(`ALLAPOT:${p.status}`);
  for (const m of mezoHibak(p.kind, mezok(p))) hianyok.push(`MEZO:${m}`);
  const s = await elso(db, 'SELECT * FROM treatment_session WHERE id = ?1', p.session_id);
  const kepek = await mind(db, 'SELECT treatment_index FROM camera_image WHERE guest_id = ?1 AND deleted_at IS NULL', p.guest_id);
  const vanKep = (idx) => kepek.some((k) => k.treatment_index === idx);
  if (p.kind === 'plan' && !vanKep(s.treatment_index)) hianyok.push('KEP:alkalom_kepe_hianyzik');
  if (p.kind === 'review') {
    if (!vanKep(s.treatment_index)) hianyok.push('KEP:alkalom_kepe_hianyzik');
    const o = await elso(db, 'SELECT 1 AS x FROM image_comparison c JOIN camera_image b ON b.id = c.image_b_id WHERE c.guest_id = ?1 AND c.status = \'final\' AND b.session_id = ?2', p.guest_id, p.session_id);
    if (!o) hianyok.push('KEP:vegleges_osszehasonlitas_hianyzik');
  }
  if (p.kind === 'closing') {
    const mentesites = nemUres(mezok(p).hianyzo_kep_indok);
    for (const idx of KAMERA_KOTELEZO_ALKALMAK) if (!vanKep(idx) && !mentesites) hianyok.push(`KEP:${idx}_alkalom_kepe_hianyzik`);
  }
  const g = await elso(db, 'SELECT * FROM guest WHERE id = ?1', p.guest_id);
  if (!g || g.status !== 'active') hianyok.push('CIMZETT:nem_aktiv_vendeg');
  else {
    if (!g.email || !normEmail(g.email)) hianyok.push('CIMZETT:nincs_ervenyes_email');
    else if (!g.email_verified) hianyok.push('CIMZETT:email_nem_ellenorzott');
    if (cimzett && normEmail(cimzett) !== g.email) hianyok.push('CIMZETT:nem_egyezik_a_nyilvantartottal');
  }
  return { ok: hianyok.length === 0, hianyok, cimzett: g?.email || null };
}

/** elkuldve (sent): csak ha kuldhetoE; a tenyleges kuldest az uzenet-motor vegzi, ez rogziti az eredmenyt */
export async function elkuldve(db, { planId, cimzett = null, now = most() }) {
  const elozo = await terv(db, planId);
  if (elozo?.status === 'sent') return { mar: true };
  const k = await kuldhetoE(db, planId, { cimzett });
  if (!k.ok) throw new CrmHiba('NEM_KULDHETO', `a dokumentum nem kuldheto: ${k.hianyok.join(', ')}`, 409, k.hianyok);
  const p = elozo;
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE treatment_plan SET status = \'sent\', sent_at = ?2, recipient_email = ?3, updated_at = ?2 WHERE id = ?1 AND status IN (\'therapist_final\', \'generated_pdf\')', planId, now, k.cimzett),
    auditStmt(db, { action: 'plan.sent', resource: 'treatment_plan', resourceId: planId, guestId: p.guest_id, detail: { kind: p.kind }, now }),
    outboxStmt(db, { tipus: 'plan.sent', aggTipus: 'treatment_plan', aggId: planId, guestId: p.guest_id, payload: { plan_id: planId, kind: p.kind }, dedupeKey: `plan.sent:${planId}`, now }),
  ]);
  return { mar: valtozas(r) !== 1 };
}

// ---- 24h / 48h hianyzo dokumentacio -----------------------------------------------------------------------------------------------------
/** a mar lejart hatarideju, meg nem veglegesitett dokumentumok: level 'DOC24' (kezelo) vagy 'DOC48' (Janka) */
export async function hianyzoDokumentumok(db, { now = most() } = {}) {
  const sorok = await mind(db, `SELECT p.id, p.session_id, p.guest_id, p.kind, p.status, p.therapist_id, p.due_at, s.confirmed_at FROM treatment_plan p
    JOIN treatment_session s ON s.id = p.session_id WHERE p.status IN ('missing', 'draft') AND p.due_at <= ?1 ORDER BY p.due_at`, now);
  return sorok.map((p) => ({ planId: p.id, sessionId: p.session_id, guestId: p.guest_id, kind: p.kind, status: p.status, therapistId: p.therapist_id, completedAt: p.confirmed_at,
    level: now >= p.confirmed_at + DOKUMENTUM_HATARIDO.JANKA_RIASZTAS ? 'DOC48' : 'DOC24' }));
}

/** riasztasok kiirasa az outboxba (idempotens: dedupe_key). A DOC48 a DOC24-et nem helyettesiti, mindketto kimegy (kezelo, majd Janka). */
export async function dokumentumRiasztasok(db, { now = most() } = {}) {
  const ki = [];
  for (const d of await hianyzoDokumentumok(db, { now })) {
    const ut = [outboxStmt(db, { tipus: 'alert.doc24', aggTipus: 'treatment_plan', aggId: d.planId, guestId: d.guestId, payload: { plan_id: d.planId, therapist_id: d.therapistId, kind: d.kind }, dedupeKey: `alert.doc24:${d.planId}`, now })];
    if (d.level === 'DOC48') ut.push(outboxStmt(db, { tipus: 'alert.doc48', aggTipus: 'treatment_plan', aggId: d.planId, guestId: d.guestId, payload: { plan_id: d.planId, therapist_id: d.therapistId, kind: d.kind }, dedupeKey: `alert.doc48:${d.planId}`, now }));
    const eredmeny = await tranzakcio(db, ut);
    ki.push({ ...d, ujDoc24: valtozas(eredmeny[0]) === 1, ujDoc48: ut.length > 1 && valtozas(eredmeny[1]) === 1 });
  }
  return ki;
}

// ---- kurazaro (11. alkalom) ---------------------------------------------------------------------------------------------------------------------
/**
 * A kurazaro dokumentum adatai: a 11. alkalom igazolt, hivatkozas a KORABBI 1/3/5/10 kepekre es osszehasonlitasokra. A zarashoz UJ kamerakep NEM kell.
 */
export async function kurazaro(db, { courseId }) {
  const s11 = await elso(db, 'SELECT * FROM treatment_session WHERE course_id = ?1 AND treatment_index = ?2', courseId, KURAZARO_ALKALOM);
  if (!s11) return { kesz: false, ok_kod: 'NINCS_11_ALKALOM' };
  const kepek = await mind(db, 'SELECT i.id, i.treatment_index, i.capture_point FROM camera_image i JOIN treatment_session s ON s.id = i.session_id WHERE s.course_id = ?1 AND i.deleted_at IS NULL ORDER BY i.treatment_index', courseId);
  const referenciak = {};
  for (const idx of KAMERA_KOTELEZO_ALKALMAK) referenciak[idx] = kepek.filter((k) => k.treatment_index === idx).map((k) => k.id);
  const hianyzo = KAMERA_KOTELEZO_ALKALMAK.filter((i) => !referenciak[i].length);
  const osszehasonlitasok = await mind(db, 'SELECT c.id FROM image_comparison c JOIN camera_image a ON a.id = c.image_a_id JOIN treatment_session s ON s.id = a.session_id WHERE s.course_id = ?1 AND c.status = \'final\'', courseId);
  const zaro = await tervSession(db, s11.id, 'closing');
  return { kesz: true, sessionId: s11.id, ujKameraKotelezo: false, referenciak, hianyzoKepek: hianyzo, osszehasonlitasok: osszehasonlitasok.map((c) => c.id), zaroDokumentum: zaro ? { planId: zaro.id, status: zaro.status } : null, ritmusNap: KEZELES_RITMUS_NAP };
}

// ---- kezeloi jegyzet ------------------------------------------------------------------------------------------------------------------------
export async function jegyzet(db, { sessionId, staffId, tipus = 'general', szoveg, veglegesit: vegleges = false, now = most() }) {
  const s = await elso(db, 'SELECT * FROM treatment_session WHERE id = ?1', sessionId);
  if (!s) throw new CrmHiba('NINCS_KEZELES', 'nincs ilyen kezeles', 404);
  await megkoveteli(db, staffId, 'write', 'treatment_note', { guestId: s.guest_id, resourceId: sessionId, now });
  if (!['camera_review', 'general', 'adverse_reaction'].includes(tipus)) throw new CrmHiba('ERVENYTELEN_TIPUS', 'camera_review | general | adverse_reaction', 400);
  if (!nemUres(szoveg)) throw new CrmHiba('URES_SZOVEG', 'ures jegyzet', 400);
  if (tipus === 'camera_review' && vegleges && !mondatOk(szoveg)) throw new CrmHiba('MONDATSZAM', 'a kameras ertekeles 2-3 mondat', 400);
  const id = uuid();
  const ut = [
    keszit(db, 'INSERT INTO treatment_note (id, session_id, guest_id, therapist_id, kind, text, status, created_at, final_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)', id, sessionId, s.guest_id, staffId, tipus, szoveg, vegleges ? 'final' : 'draft', now, vegleges ? now : null),
    auditStmt(db, { staffId, action: 'note.create', resource: 'treatment_note', resourceId: id, guestId: s.guest_id, detail: { tipus }, now }),
  ];
  if (tipus === 'adverse_reaction') {   // szokatlan reakcio: szakmai stop + kura szuneteltetes (kezeloi felulvizsgalat kotelezo)
    ut.push(keszit(db, 'UPDATE guest SET clinical_stop = COALESCE(clinical_stop, \'adverse_reaction\'), clinical_stop_at = COALESCE(clinical_stop_at, ?2), updated_at = ?2 WHERE id = ?1', s.guest_id, now));
    ut.push(keszit(db, 'UPDATE course SET status = \'paused_clinical\', paused_at = ?2, paused_reason = \'adverse_reaction\', updated_at = ?2 WHERE guest_id = ?1 AND status = \'active\'', s.guest_id, now));
  }
  await tranzakcio(db, ut);
  return { noteId: id };
}
export const jegyzetek = (db, sessionId) => mind(db, 'SELECT * FROM treatment_note WHERE session_id = ?1 ORDER BY created_at, rowid', sessionId);
export { korlatHiba };
