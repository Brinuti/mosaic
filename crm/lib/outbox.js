// Tranzakcios outbox: az uzleti modulok esemenyt irnak (outbox_event), az uzenet-motor (crm/lib/messages/) ezekbol dolgozik.
// A dedupe_key UNIQUE: ugyanabbol az esemenybol soha nem lesz ket uzenet / ertesites.
//
// Esemeny-tipusok (payload mindig szemelyes adat NELKUL; guest_id az outbox_event.guest_id oszlopban):
//   booking.confirmed {booking_id, service_code, start_at}        booking.rescheduled {booking_id, old_start_at, new_start_at}
//   booking.cancelled {booking_id}   booking.no_show {booking_id}  booking.completed {booking_id, treatment_index, camera_required}
//   assessment.completed {booking_id, credit_id}                   package.purchased {purchase_id, package_type, early_purchase}
//   package.policy_violation {purchase_id, booking_id, code}       alert.contraindication {alert_id, therapist_id}
//   alert.negative_survey {survey_id, complaint_id, score}  (Janka)  complaint.opened {complaint_id, therapist_id, due_at}
//   complaint.resolved {complaint_id}                              alert.doc24 {plan_id, therapist_id}   alert.doc48 {plan_id}
//   plan.final {plan_id, kind}  plan.sent {plan_id, kind}          share.link_issued {grant_id}   share.verification {verification_id}
//   consent.withdrawn {channel}  credit.eligible {credit_id}       credit.used_booking_cancelled {credit_id}
import { uuid, most, jsonIr, keszit, mind, futtat, valtozas, beszurHa } from './db.js';

/** INSERT OR IGNORE: ismetelt dedupe_key nem hoz letre masodik sort */
export function outboxStmt(db, { tipus, aggTipus, aggId, guestId = null, payload = null, dedupeKey, now = most(), ha = null }) {
  return beszurHa(db, { tabla: 'outbox_event', ignore: true, ha, adat: { id: uuid(), event_type: tipus, aggregate_type: aggTipus, aggregate_id: aggId, guest_id: guestId, payload: jsonIr(payload), dedupe_key: dedupeKey ?? `${tipus}:${aggId}`, status: 'pending', attempts: 0, created_at: now } });
}

/** a feldolgozatlan esemenyek (a motor ezt olvassa) */
export const fuggoEsemenyek = (db, limit = 100) => mind(db, 'SELECT * FROM outbox_event WHERE status = \'pending\' ORDER BY created_at, rowid LIMIT ?1', limit);

/** atomikus claim: csak az kapja meg, akinek a pending -> processing valtas sikerult */
export async function claim(db, id) { return valtozas(await futtat(db, 'UPDATE outbox_event SET status = \'processing\', attempts = attempts + 1 WHERE id = ?1 AND status = \'pending\'', id)) === 1; }
export const kesz = (db, id, now = most()) => futtat(db, 'UPDATE outbox_event SET status = \'processed\', processed_at = ?2 WHERE id = ?1', id, now);
export const hibas = (db, id) => futtat(db, 'UPDATE outbox_event SET status = \'failed\' WHERE id = ?1', id);
