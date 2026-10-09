// 4 990 Ft hajkamera-felmeres credit (assessment_credit). A CRM csak JELZI a jogosultsagot, a levonast a recepcio / kezelo jeloli kezzel.
//  - letrejon, amikor a camera_assessment foglalast a kezelo completed-nek igazolja (a 4 990 Ft helyben kifizetve)
//  - jogosult (eligible), ha a felmeres idopontja UTAN, 30 naptari napon belul FIRST (first_hair) foglalas KELETKEZIK (booked_at); a kezelés ideje kesobbi is lehet
//  - athelyezes megtartja, teljes lemondas megszunteti (constants.CREDIT.UJRA_JOGOSULT_LEMONDAS_UTAN: uj foglalas az ablakban ujra jogosit)
//  - levonas: jelolLevonas() - egyszer, DB-szinten (immutabilis used_at / used_booking_uuid / used_by_staff_id, trigger + UNIQUE)
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, valtozas, beszurHa, naptariNapVege } from './db.js';
import { CREDIT, SZOLGALTATAS, SZOLGALTATAS_ADAT } from './constants.js';
import { auditStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { megkoveteli } from './rbac.js';

/** a completed-igazolas batch-utasitasa(i): credit letrehozasa a kamera-foglalashoz (csak ha a foglalas tenyleg completed lett) */
export function letrehozStmts(db, { kameraFoglalas, staffId, now }) {
  const id = uuid();
  return {
    creditId: id,
    stmts: [
      beszurHa(db, {
        tabla: 'assessment_credit', ignore: true,
        ha: { sql: 'SELECT 1 FROM booking WHERE id = ? AND status = \'completed\' AND completed_by = ?', params: [kameraFoglalas.id, staffId] },
        adat: { id, guest_id: kameraFoglalas.guest_id, camera_booking_id: kameraFoglalas.id, amount_huf: CREDIT.osszeg, window_start: kameraFoglalas.start_at, window_end: naptariNapVege(kameraFoglalas.start_at, CREDIT.ablak_naptari_nap), status: 'open', created_at: now },
      }),
    ],
  };
}

/** a vendeg aktiv first_hair foglalasai kozul a nyitott creditekhez tartozok osszekapcsolasa (idempotens) */
export async function ujraKapcsol(db, guestId, { now = most() } = {}) {
  const nyitott = await mind(db, 'SELECT * FROM assessment_credit WHERE guest_id = ?1 AND status = \'open\' ORDER BY window_start', guestId);
  for (const c of nyitott) {
    const b = await elso(db,
      `SELECT b.* FROM booking b WHERE b.guest_id = ?1 AND b.service_code = ?2 AND b.status IN ('booked', 'rescheduled') AND b.duplicate_of IS NULL
         AND b.booked_at >= ?3 AND b.booked_at <= ?4
         AND NOT EXISTS (SELECT 1 FROM assessment_credit x WHERE x.first_booking_id = b.id AND x.status IN ('eligible', 'used'))
       ORDER BY b.booked_at LIMIT 1`, guestId, SZOLGALTATAS.FIRST_HAIR, c.window_start, c.window_end);
    if (!b) continue;
    const [r] = await tranzakcio(db, [
      keszit(db, 'UPDATE assessment_credit SET status = \'eligible\', first_booking_id = ?2, eligible_at = ?3 WHERE id = ?1 AND status = \'open\'', c.id, b.id, now),
      auditStmt(db, { action: 'credit.eligible', resource: 'assessment_credit', resourceId: c.id, guestId, detail: { first_booking_id: b.id }, now }),
      outboxStmt(db, { tipus: 'credit.eligible', aggTipus: 'assessment_credit', aggId: c.id, guestId, payload: { credit_id: c.id }, dedupeKey: `credit.eligible:${c.id}:${b.id}`, now }),
    ]);
    if (valtozas(r) !== 1) continue;
  }
}

/** hook: uj / athelyezett first_hair foglalas (booking.js hivja) */
export async function elsoFoglalasKapcsol(db, { bookingId, now = most() }) {
  const b = await elso(db, 'SELECT * FROM booking WHERE id = ?1', bookingId);
  if (!b || b.service_code !== SZOLGALTATAS.FIRST_HAIR) return;
  await ujraKapcsol(db, b.guest_id, { now });
}

/** hook: teljes lemondas. A jogosultsag megszunik; ha a levonas mar megtortent (used), kezi felulvizsgalat-riasztas. */
export async function lemondasKovet(db, { bookingId, now = most() }) {
  const c = await elso(db, 'SELECT * FROM assessment_credit WHERE first_booking_id = ?1', bookingId);
  if (!c) return null;
  if (c.status === 'used') {
    await tranzakcio(db, [
      outboxStmt(db, { tipus: 'credit.used_booking_cancelled', aggTipus: 'assessment_credit', aggId: c.id, guestId: c.guest_id, payload: { credit_id: c.id }, dedupeKey: `credit.used_booking_cancelled:${c.id}`, now }),
      auditStmt(db, { action: 'credit.used_booking_cancelled', resource: 'assessment_credit', resourceId: c.id, guestId: c.guest_id, result: 'error', detail: { booking_id: bookingId }, now }),
    ]);
    return { statusz: 'used_booking_cancelled' };
  }
  const uj = CREDIT.UJRA_JOGOSULT_LEMONDAS_UTAN ? 'open' : 'void';
  await tranzakcio(db, [
    keszit(db, 'UPDATE assessment_credit SET status = ?2, first_booking_id = NULL, eligible_at = NULL WHERE id = ?1 AND status = \'eligible\'', c.id, uj),
    auditStmt(db, { action: 'credit.lost', resource: 'assessment_credit', resourceId: c.id, guestId: c.guest_id, detail: { booking_id: bookingId, uj }, now }),
  ]);
  if (uj === 'open') await ujraKapcsol(db, c.guest_id, { now });   // az ablakban mas aktiv first foglalas ujra jogosit
  return { statusz: uj };
}

/** hook: athelyezes - a jogosultsag marad (nincs teendo; a fuggveny a P08-hoz ellenorzesre szolgal) */
export async function athelyezesKovet(db, { bookingId }) {
  const c = await elso(db, 'SELECT status FROM assessment_credit WHERE first_booking_id = ?1', bookingId);
  return { marad: !!c && ['eligible', 'used'].includes(c.status) };
}

/** a vendeg creditjeinek allapota a recepcio / kezelo felulethez ("figyelmezteto" jelzes, nem automatikus levonas) */
export async function ellenoriz(db, guestId, { now = most() } = {}) {
  const lista = await mind(db, 'SELECT * FROM assessment_credit WHERE guest_id = ?1 ORDER BY window_start', guestId);
  return lista.map((c) => {
    let allapot = c.status;
    if (c.status === 'open' && now > c.window_end) allapot = 'expired';
    return {
      creditId: c.id, allapot, osszeg: c.amount_huf, hatarido: c.window_end, maradekNap: Math.max(0, Math.ceil((c.window_end - now) / 86400)),
      firstBookingId: c.first_booking_id, felhasznalva: c.used_at,
      jogosult: allapot === 'eligible',
      fizetendoAzElsoKezelesre: allapot === 'eligible' ? SZOLGALTATAS_ADAT.first_hair.ar - c.amount_huf : SZOLGALTATAS_ADAT.first_hair.ar,   // 24 910 Ft csak a jogosult vendegre igaz
    };
  });
}

/**
 * A 4 990 Ft levonasanak kezi jelolese (recepcio / kezelo). Egyszer, DB-szinten: a UPDATE csak eligible + used_at IS NULL sorra hat, a trigger
 * a felhasznalt sort nem engedi modositani, es used_booking_uuid UNIQUE. bookingId = az a first_hair foglalas, amelybol levontak (booking UUID).
 */
export async function jelolLevonas(db, { creditId, bookingId, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'mark', 'credit', { resourceId: creditId, now });
  const c = await elso(db, 'SELECT * FROM assessment_credit WHERE id = ?1', creditId);
  if (!c) throw new CrmHiba('NINCS_CREDIT', 'nincs ilyen credit', 404);
  if (c.status === 'used') throw new CrmHiba('CREDIT_MAR_FELHASZNALVA', 'a credit mar levonva', 409);
  if (c.status !== 'eligible') throw new CrmHiba('NEM_JOGOSULT', `a credit nem jogosult (${c.status})`, 409);
  if (c.first_booking_id !== bookingId) throw new CrmHiba('MASIK_FOGLALAS', 'a levonas csak a jogosultsagot adoo first foglalasra jelolheto', 409);
  const b = await elso(db, 'SELECT * FROM booking WHERE id = ?1', bookingId);
  if (!b || b.guest_id !== c.guest_id || b.service_code !== SZOLGALTATAS.FIRST_HAIR || !['booked', 'rescheduled', 'completed'].includes(b.status)) {
    throw new CrmHiba('ERVENYTELEN_FOGLALAS', 'a foglalas nem ervenyes first kezeles', 409);
  }
  let r;
  try {
    [r] = await tranzakcio(db, [
      keszit(db, 'UPDATE assessment_credit SET status = \'used\', used_at = ?2, used_booking_uuid = ?3, used_by_staff_id = ?4 WHERE id = ?1 AND status = \'eligible\' AND used_at IS NULL AND first_booking_id = ?3', creditId, now, bookingId, staffId),
      auditStmt(db, { staffId, action: 'credit.use', resource: 'assessment_credit', resourceId: creditId, guestId: c.guest_id, detail: { booking_uuid: bookingId, osszeg: c.amount_huf },
        now, ha: { sql: 'SELECT 1 FROM assessment_credit WHERE id = ? AND status = \'used\' AND used_by_staff_id = ? AND used_booking_uuid = ?', params: [creditId, staffId, bookingId] } }),
    ]);
  } catch (e) {
    throw new CrmHiba('CREDIT_MAR_FELHASZNALVA', `a levonas nem rogzitheto: ${e.message}`, 409);
  }
  if (valtozas(r) !== 1) throw new CrmHiba('CREDIT_MAR_FELHASZNALVA', 'a credit kozben felhasznalodott', 409);
  return { levonas: c.amount_huf, fizetendo: SZOLGALTATAS_ADAT.first_hair.ar - c.amount_huf, usedAt: now, usedBookingUuid: bookingId, staffId };
}
