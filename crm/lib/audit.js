// Audit-iras: security_audit (ki, mit, mikor, eredmeny, ip-hash), booking_event (foglalas-naplo), merge_audit (osszevonas-naplo).
// A *Stmt fuggvenyek ELOKESZITETT utasitast adnak vissza, hogy az uzleti iras ugyanabban a batch-ben (tranzakcioban) fusson.
// A naplo-tablak csak hozzafuzhetok (migracio trigger). Szemelyes adat NEM kerul a detail mezobe.
import { uuid, most, jsonIr, keszit, mind, futtat, beszurHa } from './db.js';

/** security_audit sor (utasitas). result: ok | denied | error. ha: {sql, params} - csak akkor ir, ha a feltetel igaz (lasd db.beszurHa) */
export function auditStmt(db, { staffId = null, action, resource, resourceId = null, guestId = null, result = 'ok', detail = null, ipHash = null, now = most(), ha = null }) {
  return beszurHa(db, { tabla: 'security_audit', ha, adat: { id: uuid(), at: now, staff_id: staffId, action, resource, resource_id: resourceId, guest_id: guestId, result, detail: jsonIr(detail), ip_hash: ipHash } });
}
/** security_audit sor kiirasa kulon (ha nincs mas irando) */
export async function naplo(db, adat) { return auditStmt(db, adat).run(); }

/** booking_event sor (utasitas). idempotencyKey UNIQUE: ismetelt esemeny nem duplikal (INSERT OR IGNORE). ha: felteteles iras (db.beszurHa) */
export function bookingEventStmt(db, { bookingId, idempotencyKey, type, fromStatus = null, toStatus = null, oldStart = null, newStart = null, actor = 'system', eventAt, detail = null, now = most(), ha = null }) {
  return beszurHa(db, { tabla: 'booking_event', ignore: true, ha, adat: { id: uuid(), booking_id: bookingId, idempotency_key: idempotencyKey, type, from_status: fromStatus, to_status: toStatus, old_start_at: oldStart, new_start_at: newStart, actor, event_at: eventAt ?? now, detail: jsonIr(detail), created_at: now } });
}

/** merge_audit sor (utasitas) */
export function mergeAuditStmt(db, { id = uuid(), kind, requestId = null, sourceGuestId, targetGuestId, revertsId = null, snapshot = null, staffId = null, now = most() }) {
  return keszit(db,
    'INSERT INTO merge_audit (id, kind, request_id, source_guest_id, target_guest_id, reverts_id, snapshot, staff_id, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
    id, kind, requestId, sourceGuestId, targetGuestId, revertsId, jsonIr(snapshot), staffId, now);
}

/** audit-lekerdezes (admin / szalonvezeto): szurok opcionalisak */
export async function auditLista(db, { guestId, staffId, action, result, tol, ig, limit = 200 } = {}) {
  const felt = [], p = [];
  const add = (sql, v) => { p.push(v); felt.push(sql.replace('?', `?${p.length}`)); };
  if (guestId) add('guest_id = ?', guestId);
  if (staffId) add('staff_id = ?', staffId);
  if (action) add('action = ?', action);
  if (result) add('result = ?', result);
  if (tol) add('at >= ?', tol);
  if (ig) add('at <= ?', ig);
  p.push(Math.min(Number(limit) || 200, 1000));
  return mind(db, `SELECT * FROM security_audit ${felt.length ? 'WHERE ' + felt.join(' AND ') : ''} ORDER BY at DESC, rowid DESC LIMIT ?${p.length}`, ...p);
}
export { futtat };
