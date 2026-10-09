// Vendeg-osszevonas: kezi jovahagyas (identity_merge_request), vegrehajtas, visszaforditas. Minden lepes merge_audit + security_audit.
// Az osszevonas a forras vendeg MINDEN adatat (MERGE_TABLAK) a celvendeghez teszi at; az eredeti Salonic-azonositok (salonic_guest_identity)
// megmaradnak. A forras vendeg 'merged' lesz (merged_into), a megosztott kep-linkjei visszavonodnak (ujra-ellenorzes kotelezo).
// Visszaforditas: a snapshot-ban tarolt sor-azonositok kerulnek vissza a forras vendeghez.
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, jsonIr, jsonOlvas, korlatHiba } from './db.js';
import { auditStmt, mergeAuditStmt } from './audit.js';
import { megkoveteli } from './rbac.js';
import { outboxStmt } from './outbox.js';

/** a guest_id oszlopot tartalmazo tablak, amelyek sorai osszevonaskor atkerulnek */
export const MERGE_TABLAK = Object.freeze([
  'salonic_guest_identity', 'booking', 'course', 'treatment_session', 'package_purchase', 'package_redemption', 'assessment_submission',
  'contraindication_alert', 'assessment_credit', 'treatment_plan', 'treatment_note', 'camera_image', 'image_comparison',
  'consent_event', 'unsubscribe', 'survey_response', 'review_request', 'complaint', 'message_job', 'message_ledger',
]);

const idk = async (db, tabla, guestId) => (await mind(db, `SELECT id FROM ${tabla} WHERE guest_id = ?1`, guestId)).map((r) => r.id);

export async function fuggoKeresek(db) {
  return mind(db, `SELECT r.*, s.name AS source_name, t.name AS target_name FROM identity_merge_request r
    JOIN guest s ON s.id = r.source_guest_id JOIN guest t ON t.id = r.target_guest_id WHERE r.status = 'pending' ORDER BY r.requested_at`);
}
export async function fuggoDarab(db) { return (await elso(db, 'SELECT COUNT(*) AS n FROM identity_merge_request WHERE status = \'pending\'')).n; }   // MERGE_REVIEW_PENDING

/** a vegrehajtas kozos magja. mod: 'manual' | 'auto'. */
async function vegrehajt(db, { forrasId, celId, mod, requestId = null, staffId = null, now }) {
  if (forrasId === celId) throw new CrmHiba('SAJAT_MAGABA', 'a vendeg nem vonhato ossze onmagaval', 400);
  const [f, c] = await Promise.all([elso(db, 'SELECT * FROM guest WHERE id = ?1', forrasId), elso(db, 'SELECT * FROM guest WHERE id = ?1', celId)]);
  if (!f || !c) throw new CrmHiba('NINCS_VENDEG', 'ismeretlen vendeg', 404);
  if (f.status !== 'active' || c.status !== 'active') throw new CrmHiba('NEM_AKTIV', 'csak aktiv vendegek vonhatok ossze', 409);

  // kura-utkozes: ket kezdett kura nem vonhato ossze
  const kurak = async (id) => mind(db, 'SELECT * FROM course WHERE guest_id = ?1 AND status IN (\'not_started\', \'active\', \'paused_clinical\')', id);
  const [fk, ck] = [await kurak(forrasId), await kurak(celId)];
  const fKezdett = fk.some((k) => k.treatment_index > 0), cKezdett = ck.some((k) => k.treatment_index > 0);
  if (fKezdett && cKezdett) throw new CrmHiba('MERGE_KURA_KONFLIKTUS', 'mindket vendegnek kezdett kurája van: kezi rendezes kell', 409);

  // dupla foglalasok (ugyanaz a szolgaltatas+idopont mindket vendegnel): a forras oldali dupla jelolve lesz
  const forrasFogl = await mind(db, 'SELECT * FROM booking WHERE guest_id = ?1', forrasId);
  const celFogl = await mind(db, 'SELECT * FROM booking WHERE guest_id = ?1', celId);
  const aktivAllapot = new Set(['booked', 'rescheduled', 'completed']);
  const duplak = [];
  for (const b of forrasFogl) {
    if (!aktivAllapot.has(b.status)) continue;
    const par = celFogl.find((x) => aktivAllapot.has(x.status) && x.service_code === b.service_code && x.start_at === b.start_at);
    if (!par) continue;
    const hasznalt = await elso(db, 'SELECT (SELECT COUNT(*) FROM treatment_session WHERE booking_id = ?1) + (SELECT COUNT(*) FROM package_redemption WHERE booking_id = ?1) AS n', b.id);
    if (hasznalt.n > 0) throw new CrmHiba('MERGE_DUPLA_FOGLALAS_KONFLIKTUS', 'a dupla foglalashoz mar kezeles / berlet kapcsolodik', 409);
    duplak.push({ forras: b.id, par: par.id });
  }

  // snapshot (visszaforditashoz)
  const snapshot = { tablak: {}, duplak, lezart_ures_kurak: [] };
  for (const t of MERGE_TABLAK) { const l = await idk(db, t, forrasId); if (l.length) snapshot.tablak[t] = l; }

  // ures nyitott kura kezelese (a "vendegenkent egy nyitott kura" index miatt): ha mindkettonek van, az URES (0 kezeles) lezarul
  const ut = [];
  const lezar = (k) => { ut.push(keszit(db, 'UPDATE course SET status = \'closed_individual\', closed_at = ?2, closed_reason = \'merge_ures_kura\', updated_at = ?2 WHERE id = ?1 AND treatment_index = 0', k.id, now)); snapshot.lezart_ures_kurak.push(k.id); };
  if (fk.length && ck.length) {
    if (fk[0].treatment_index === 0) lezar(fk[0]); else lezar(ck[0]);
  }

  // 1. a forras 'merged' lesz (a tobbi utasitas ettol fugg)
  ut.unshift(keszit(db, 'UPDATE guest SET status = \'merged\', merged_into = ?2, updated_at = ?3 WHERE id = ?1 AND status = \'active\'', forrasId, celId, now));
  for (const d of duplak) ut.push(keszit(db, 'UPDATE booking SET duplicate_of = ?2 WHERE id = ?1', d.forras, d.par));
  const feltetel = 'EXISTS (SELECT 1 FROM guest WHERE id = ?1 AND status = \'merged\' AND merged_into = ?2)';
  for (const t of MERGE_TABLAK) ut.push(keszit(db, `UPDATE ${t} SET guest_id = ?2 WHERE guest_id = ?1 AND ${feltetel}`, forrasId, celId));
  // elerhetosegek kiegeszitese, utolso kezeles
  const kiegeszit = [], p = [celId];
  const add = (o, v) => { p.push(v); kiegeszit.push(`${o} = COALESCE(${o}, ?${p.length})`); };
  if (f.name) add('name', f.name);
  if (f.email) add('email', f.email);
  if (f.phone) add('phone', f.phone);
  if (f.therapist_id) add('therapist_id', f.therapist_id);
  if (f.clinical_stop) { p.push(f.clinical_stop); kiegeszit.push(`clinical_stop = COALESCE(clinical_stop, ?${p.length})`); p.push(f.clinical_stop_at); kiegeszit.push(`clinical_stop_at = COALESCE(clinical_stop_at, ?${p.length})`); }
  if (f.last_treatment_at) { p.push(f.last_treatment_at); kiegeszit.push(`last_treatment_at = MAX(COALESCE(last_treatment_at, 0), ?${p.length})`); }
  if (kiegeszit.length) {
    p.push(now); const nowIdx = p.length; p.push(forrasId); const fIdx = p.length;
    ut.push(keszit(db, `UPDATE guest SET ${kiegeszit.join(', ')}, updated_at = ?${nowIdx} WHERE id = ?1 AND EXISTS (SELECT 1 FROM guest WHERE id = ?${fIdx} AND status = 'merged' AND merged_into = ?1)`, ...p));
  }
  // kep-linkek visszavonasa, megorzesi feladat
  ut.push(keszit(db, `UPDATE share_grant SET revoked_at = ?2, revoke_reason = 'merge' WHERE guest_id = ?1 AND revoked_at IS NULL`, forrasId, now));
  ut.push(keszit(db, `UPDATE retention_purge_job SET status = 'cancelled' WHERE guest_id = ?1 AND status IN ('planned', 'requested')`, forrasId));
  if (requestId) ut.push(keszit(db, 'UPDATE identity_merge_request SET status = \'approved\', decided_by = ?2, decided_at = ?3 WHERE id = ?1 AND status = \'pending\'', requestId, staffId, now));
  // a tobbi fuggo keres a forrasra: a cel megvaltozott -> elavult
  ut.push(keszit(db, 'UPDATE identity_merge_request SET status = \'rejected\', decided_at = ?2, decision_note = \'forras_osszevonva\' WHERE source_guest_id = ?1 AND status = \'pending\'', forrasId, now));

  const auditId = uuid();
  ut.push(mergeAuditStmt(db, { id: auditId, kind: mod === 'auto' ? 'auto_merge' : 'manual_merge', requestId, sourceGuestId: forrasId, targetGuestId: celId, snapshot, staffId, now }));
  ut.push(auditStmt(db, { staffId, action: 'guest.merge', resource: 'guest', resourceId: celId, guestId: celId, detail: { forras: forrasId, mod, merge_audit_id: auditId, athelyezett: Object.fromEntries(Object.entries(snapshot.tablak).map(([k, v]) => [k, v.length])) }, now }));
  ut.push(outboxStmt(db, { tipus: 'guest.merged', aggTipus: 'guest', aggId: celId, guestId: celId, payload: { source_guest_id: forrasId }, dedupeKey: `guest.merged:${auditId}`, now }));

  try { await tranzakcio(db, ut); } catch (e) {
    if (korlatHiba(e)) throw new CrmHiba('MERGE_KONFLIKTUS', `az osszevonas korlatba utkozott: ${e.message}`, 409);
    throw e;
  }
  const utana = await elso(db, 'SELECT status, merged_into FROM guest WHERE id = ?1', forrasId);
  if (utana.status !== 'merged' || utana.merged_into !== celId) throw new CrmHiba('MERGE_NEM_TORTENT_MEG', 'az osszevonas nem hajtodott vegre (verseny)', 409);
  return { mergeAuditId: auditId, forrasId, celId, athelyezett: snapshot.tablak, duplak };
}

/** kezi jovahagyas: az erintett kezelo (rbac: merge.approve) hagyja jova; a forras vendeg bekerul a celba. */
export async function jovahagy(db, { requestId, staffId, megjegyzes = null, now = most() }) {
  await megkoveteli(db, staffId, 'approve', 'merge', { resourceId: requestId, now });
  const k = await elso(db, 'SELECT * FROM identity_merge_request WHERE id = ?1', requestId);
  if (!k) throw new CrmHiba('NINCS_KERES', 'nincs ilyen osszevonasi keres', 404);
  if (k.status !== 'pending') throw new CrmHiba('NEM_FUGGO', `a keres allapota: ${k.status}`, 409);
  const e = await vegrehajt(db, { forrasId: k.source_guest_id, celId: k.target_guest_id, mod: 'manual', requestId, staffId, now });
  if (megjegyzes) await keszit(db, 'UPDATE identity_merge_request SET decision_note = ?2 WHERE id = ?1', requestId, megjegyzes).run();
  return e;
}

export async function elutasit(db, { requestId, staffId, megjegyzes = null, now = most() }) {
  await megkoveteli(db, staffId, 'approve', 'merge', { resourceId: requestId, now });
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE identity_merge_request SET status = \'rejected\', decided_by = ?2, decided_at = ?3, decision_note = ?4 WHERE id = ?1 AND status = \'pending\'', requestId, staffId, now, megjegyzes),
  ]);
  if (r.meta.changes !== 1) throw new CrmHiba('NEM_FUGGO', 'a keres nem fuggo', 409);
  await auditStmt(db, { staffId, action: 'merge.rejected', resource: 'identity_merge_request', resourceId: requestId, detail: { megjegyzes: !!megjegyzes }, now }).run();
  return { elutasitva: true };
}

/** automatikus osszevonas (csak belso hasznalatra, pl. adatjavito szkript): a merge_audit-ban 'auto_merge' */
export const automatikusOsszevon = (db, { forrasId, celId, now = most() }) => vegrehajt(db, { forrasId, celId, mod: 'auto', now });

/** visszaforditas: a merge_audit snapshot alapjan a sorok visszakerulnek a forras vendeghez. Egy osszevonas csak egyszer forditható vissza. */
export async function visszafordit(db, { mergeAuditId, staffId, ok = null, now = most() }) {
  await megkoveteli(db, staffId, 'approve', 'merge', { resourceId: mergeAuditId, now });
  const a = await elso(db, 'SELECT * FROM merge_audit WHERE id = ?1', mergeAuditId);
  if (!a || !['manual_merge', 'auto_merge'].includes(a.kind)) throw new CrmHiba('NINCS_OSSZEVONAS', 'nincs ilyen visszaforditható osszevonas', 404);
  const sn = jsonOlvas(a.snapshot, {});
  const forras = a.source_guest_id, cel = a.target_guest_id;
  const ut = [];
  ut.push(keszit(db, 'UPDATE guest SET status = \'active\', merged_into = NULL, updated_at = ?2 WHERE id = ?1 AND status = \'merged\' AND merged_into = ?3', forras, now, cel));
  for (const [tabla, lista] of Object.entries(sn.tablak || {})) {
    if (!MERGE_TABLAK.includes(tabla)) continue;
    ut.push(keszit(db, `UPDATE ${tabla} SET guest_id = ?1 WHERE guest_id = ?2 AND id IN (SELECT value FROM json_each(?3))`, forras, cel, jsonIr(lista)));
  }
  for (const d of sn.duplak || []) ut.push(keszit(db, 'UPDATE booking SET duplicate_of = NULL WHERE id = ?1', d.forras));
  // az osszevonaskor lezart ures kurak ujranyitasa (a vendeg-athelyezes UTAN, hogy a nyitott-kura index ne utkozzon)
  for (const kid of sn.lezart_ures_kurak || []) ut.push(keszit(db, 'UPDATE course SET status = \'not_started\', closed_at = NULL, closed_reason = NULL, updated_at = ?2 WHERE id = ?1 AND closed_reason = \'merge_ures_kura\' AND treatment_index = 0', kid, now));
  if (a.request_id) ut.push(keszit(db, 'UPDATE identity_merge_request SET status = \'reverted\', decision_note = COALESCE(decision_note, \'\') || \' [visszaforditva]\' WHERE id = ?1', a.request_id));
  const ujId = uuid();
  ut.push(mergeAuditStmt(db, { id: ujId, kind: 'revert', requestId: a.request_id, sourceGuestId: forras, targetGuestId: cel, revertsId: mergeAuditId, snapshot: { ok }, staffId, now }));
  ut.push(auditStmt(db, { staffId, action: 'guest.merge_reverted', resource: 'guest', resourceId: forras, guestId: forras, detail: { merge_audit_id: mergeAuditId, ok }, now }));
  try { await tranzakcio(db, ut); } catch (e) {
    if (korlatHiba(e)) throw new CrmHiba('MAR_VISSZAFORDITVA', `a visszaforditas nem lehetseges: ${e.message}`, 409);
    throw e;
  }
  return { visszaforditva: true, forrasId: forras, celId: cel };
}
