// Berlet (package_5 / package_10): vasarlas (CSAK szemelyesen, recepcio rogzit), ajandekok, alkalom-foglalas/-felhasznalas, lejarat-szabalyok,
// szalonvezetoi hosszabbitas es refund. Minden iras audit + tranzakcio (db.batch) + idempotens.
//
// SZABALYOK (MASTERPROMPT 3.7, 98-103. dontes):
//  - 5-os: 130 000 Ft, 5 FOLYTATO (followup_hair) alkalom, 6 ho; 10-es: 260 000 Ft, 10 alkalom, 12 ho. Az 1. kezeles (first_hair) NEM fogyaszt alkalmat.
//  - 2x5 = ket vasarlas, ket sampon, nincs upgrade / kedvezmeny (a ket 5-os ugyanannyi, mint egy 10-es).
//  - az elso kezeles ELOTT vagy NAPJAN vasarolt berlethez extra kis ajandek (extra_small, keszletfuggo).
//  - lejarat ELOTT booked alkalom a lejarat utan is teljesitheto; lejarat UTAN egyszer athelyezheto, max az athelyezes elotti slot + 30 nap;
//    lejarat utani teljes lemondas = az alkalom jogosultsaga megszunik (forfeited).
//  - keses / no-show onmagaban NEM penz, NEM levonas (no_show -> az alkalom felszabadul).
//  - a CRM nem blokkolhatja a Salonic athelyezest: a szabalysertest policy_violation jelolessel + outbox riasztassal rogziti.
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, korlatHiba, honapHozzaad, naptariNapHozzaad, helyiNap, beszurHa, valtozas } from './db.js';
import { BERLET, KORAI_AJANDEK, BERLET_LEJARAT_UTANI_ATHELYEZES_MAX, BERLET_LEJARAT_UTANI_ATHELYEZES_NAP, SZOLGALTATAS, MASODPERC } from './constants.js';
import { auditStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { megkoveteli } from './rbac.js';

const AKTIV_ALLAPOT = ['paid_active', 'extended_by_manager'];

export const csomag = (db, id) => elso(db, 'SELECT * FROM package_purchase WHERE id = ?1', id);
const egysegek = (p) => p.units_total + p.units_adjust;

/** alkalom-szamok egy berlethez */
export async function szamok(db, purchaseId) {
  const sorok = await mind(db, 'SELECT status, COUNT(*) AS n FROM package_redemption WHERE purchase_id = ?1 GROUP BY status', purchaseId);
  const m = Object.fromEntries(sorok.map((r) => [r.status, r.n]));
  return { used: m.used || 0, reserved: m.reserved || 0, forfeited: m.forfeited || 0, released: m.released || 0 };
}

/**
 * Hany alkalom FOGLALHATO ma ebbol a berletbol (nincs lefoglalva, nincs felhasznalva, nincs elveszve; a lejart / visszaterített berlet 0).
 * A lejarat-ertesitok (B30 / B7) csak akkor mehetnek, ha ez > 0.
 */
export async function szabadAlkalmak(db, csomagVagyId, { now = most() } = {}) {
  const p = typeof csomagVagyId === 'string' ? await csomag(db, csomagVagyId) : csomagVagyId;
  if (!p || !AKTIV_ALLAPOT.includes(p.status) || now > p.expires_at) return 0;
  const sz = await szamok(db, p.id);
  return Math.max(0, egysegek(p) - sz.used - sz.reserved - sz.forfeited);
}

/** a berlet szamolt allapota (az oszlop frissitese: allapotFrissit) */
export async function allapotSzamol(db, p, now = most()) {
  if (p.status === 'refunded') return 'refunded';
  const sz = await szamok(db, p.id);
  const elfogyott = sz.used + sz.forfeited >= egysegek(p);
  if (elfogyott && sz.reserved === 0) return 'exhausted';
  if (now > p.expires_at && sz.reserved === 0) return 'expired';
  return p.status === 'extended_by_manager' ? 'extended_by_manager' : 'paid_active';
}
export async function allapotFrissit(db, purchaseId, now = most()) {
  const p = await csomag(db, purchaseId);
  if (!p) return null;
  const uj = await allapotSzamol(db, p, now);
  if (uj !== p.status) await keszit(db, 'UPDATE package_purchase SET status = ?2 WHERE id = ?1 AND status NOT IN (\'refunded\')', purchaseId, uj).run();
  return uj;
}

async function elsoKezelesIdopont(db, guestId) {
  return elso(db, 'SELECT b.start_at FROM treatment_session s JOIN booking b ON b.id = s.booking_id WHERE s.guest_id = ?1 AND s.treatment_index = 1', guestId);
}

/**
 * Berlet-vasarlas rogzitese (recepcio). Csak szemelyes, teljes ar elore; az ar nem modosithato (nincs kedvezmeny).
 * idempotencyKey: ismetelt hivas ugyanazt a vasarlast adja vissza. ajandekAtadva: az ajandekok a kifizetessel azonnal atadva.
 */
export async function vasarol(db, { guestId, tipus, staffId, fizetesIdeje = null, csatorna = 'in_person', ar = null, idempotencyKey = null, ajandekAtadva = false, megjegyzes = null, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'package', { guestId, now });
  const def = BERLET[tipus];
  if (!def) throw new CrmHiba('ISMERETLEN_BERLET', `ismeretlen berlet: ${tipus}`, 400);
  if (csatorna !== 'in_person') throw new CrmHiba('ONLINE_VASARLAS_TILOS', 'berlet csak szemelyesen vasarolhato', 400);
  if (ar !== null && ar !== def.ar) throw new CrmHiba('AR_NEM_MODOSITHATO', 'a berlet ara fix, nincs kedvezmeny', 400);
  if (idempotencyKey) {
    const van = await elso(db, 'SELECT * FROM package_purchase WHERE idempotency_key = ?1', idempotencyKey);
    if (van) return { mar: true, purchaseId: van.id, purchase: van };
  }
  const g = await elso(db, 'SELECT * FROM guest WHERE id = ?1', guestId);
  if (!g || g.status !== 'active') throw new CrmHiba('NINCS_VENDEG', 'nincs aktiv vendeg', 404);
  if (g.clinical_stop) throw new CrmHiba('KLINIKAI_STOP', 'szakmai stop alatt berlet nem ertekesitheto', 409);

  const fizetve = fizetesIdeje ?? now;
  const lejarat = honapHozzaad(fizetve, def.honap);
  const elsoK = await elsoKezelesIdopont(db, guestId);
  const korai = !elsoK || helyiNap(fizetve) <= helyiNap(elsoK.start_at);   // az elso kezeles elott VAGY napjan
  const id = uuid();
  const ut = [keszit(db,
    `INSERT INTO package_purchase (id, guest_id, package_type, price_huf, units_total, units_adjust, channel, paid_upfront, paid_at, expires_at, original_expires_at, status, early_purchase, recorded_by, idempotency_key, note, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 0, 'in_person', 1, ?6, ?7, ?7, 'paid_active', ?8, ?9, ?10, ?11, ?12)`,
    id, guestId, tipus, def.ar, def.alkalom, fizetve, lejarat, korai ? 1 : 0, staffId, idempotencyKey, megjegyzes, now)];
  const ajandekok = [...def.ajandekok, ...(korai ? [KORAI_AJANDEK] : [])];
  for (const kind of ajandekok) {
    ut.push(keszit(db,
      'INSERT INTO package_gift (id, purchase_id, kind, status, stock_dependent, handed_at, handed_by, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
      uuid(), id, kind, ajandekAtadva ? 'handed_over' : 'due', kind === KORAI_AJANDEK ? 1 : 0, ajandekAtadva ? now : null, ajandekAtadva ? staffId : null, now));
  }
  ut.push(auditStmt(db, { staffId, action: 'package.purchase', resource: 'package_purchase', resourceId: id, guestId, detail: { tipus, ar: def.ar, korai, ajandekok, lejarat }, now }));
  ut.push(outboxStmt(db, { tipus: 'package.purchased', aggTipus: 'package_purchase', aggId: id, guestId, payload: { purchase_id: id, package_type: tipus, early_purchase: korai }, dedupeKey: `package.purchased:${id}`, now }));
  try { await tranzakcio(db, ut); } catch (e) {
    if (idempotencyKey && korlatHiba(e)) { const van = await elso(db, 'SELECT * FROM package_purchase WHERE idempotency_key = ?1', idempotencyKey); if (van) return { mar: true, purchaseId: van.id, purchase: van }; }
    throw e;
  }
  // a vendeg mar lefoglalt tovabbi kezelesei a berletre kerulnek
  const foglalasok = await mind(db, 'SELECT id FROM booking WHERE guest_id = ?1 AND service_code = \'followup_hair\' AND status IN (\'booked\', \'rescheduled\') ORDER BY start_at', guestId);
  for (const b of foglalasok) await autoFoglal(db, b.id, { now });
  return { mar: false, purchaseId: id, korai, ajandekok, lejarat, purchase: await csomag(db, id) };
}

/** a berlet hely-ellenorzese az INSERT-be: van-e meg szabad egyseg (verseny ellen) */
const KAPACITAS_HA = (purchaseId) => ({
  sql: `SELECT 1 FROM package_purchase p WHERE p.id = ? AND p.status IN ('paid_active', 'extended_by_manager')
        AND (SELECT COUNT(*) FROM package_redemption r WHERE r.purchase_id = p.id AND r.status IN ('reserved', 'used', 'forfeited')) < p.units_total + p.units_adjust`,
  params: [purchaseId],
});

/**
 * Egy tovabbi (followup_hair) foglalas hozzarendelese berlethez (foglalt alkalom). Automatikus: a legkorabban lejaro, szabad alkalmu berletre,
 * ha a foglalas a lejarat ELOTT jott letre (booked_at <= expires_at). Idempotens (UNIQUE booking_id).
 */
export async function autoFoglal(db, bookingId, { now = most() } = {}) {
  const b = await elso(db, 'SELECT * FROM booking WHERE id = ?1', bookingId);
  if (!b || b.service_code !== SZOLGALTATAS.FOLLOWUP_HAIR || !['booked', 'rescheduled'].includes(b.status)) return null;
  const van = await elso(db, 'SELECT * FROM package_redemption WHERE booking_id = ?1', bookingId);
  if (van) return van;
  const jeloltek = await mind(db, `SELECT * FROM package_purchase WHERE guest_id = ?1 AND status IN ('paid_active', 'extended_by_manager') AND expires_at >= ?2 ORDER BY expires_at, created_at`, b.guest_id, b.booked_at);
  for (const p of jeloltek) {
    if ((await szabadAlkalmakFoglalashoz(db, p)) <= 0) continue;
    const id = uuid();
    const r = await beszurHa(db, { tabla: 'package_redemption', ignore: true, ha: KAPACITAS_HA(p.id), adat: { id, purchase_id: p.id, booking_id: bookingId, guest_id: b.guest_id, status: 'reserved', source: 'auto', reserved_at: now, created_at: now } }).run();
    if (valtozas(r) === 1) {
      await auditStmt(db, { action: 'package.reserve', resource: 'package_redemption', resourceId: id, guestId: b.guest_id, detail: { purchase_id: p.id, booking_id: bookingId, source: 'auto' }, now }).run();
      return elso(db, 'SELECT * FROM package_redemption WHERE id = ?1', id);
    }
    const mar = await elso(db, 'SELECT * FROM package_redemption WHERE booking_id = ?1', bookingId);
    if (mar) return mar;   // masik hivas elobb foglalta
  }
  return null;
}
async function szabadAlkalmakFoglalashoz(db, p) {
  const sz = await szamok(db, p.id);
  return egysegek(p) - sz.used - sz.reserved - sz.forfeited;
}

/** kezi hozzarendeles (recepcio / kezelo): booking -> adott berlet. A lejarat utan letrejott foglalas nem rendelheto hozza. */
export async function foglal(db, { purchaseId, bookingId, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'package', { resourceId: purchaseId, now });
  const p = await csomag(db, purchaseId), b = await elso(db, 'SELECT * FROM booking WHERE id = ?1', bookingId);
  if (!p || !b || p.guest_id !== b.guest_id) throw new CrmHiba('NEM_EGYEZIK', 'a berlet es a foglalas nem ugyanaze a vendege', 400);
  if (b.service_code !== SZOLGALTATAS.FOLLOWUP_HAIR) throw new CrmHiba('NEM_FOLYTATO', 'berletalkalom csak folytato kezelesre (followup_hair) hasznalhato; az 1. kezeles nem fogyaszt', 400);
  if (!['booked', 'rescheduled'].includes(b.status)) throw new CrmHiba('NEM_AKTIV', 'csak aktiv foglalas rendelheto hozza', 409);
  if (b.booked_at > p.expires_at) throw new CrmHiba('LEJARAT_UTANI_FOGLALAS', 'a foglalas a berlet lejarata utan jott letre', 409);
  const id = uuid();
  const r = await beszurHa(db, { tabla: 'package_redemption', ha: KAPACITAS_HA(purchaseId), adat: { id, purchase_id: purchaseId, booking_id: bookingId, guest_id: b.guest_id, status: 'reserved', source: 'staff', reserved_at: now, created_at: now } }).run().catch((e) => { if (korlatHiba(e)) throw new CrmHiba('MAR_HOZZARENDELVE', 'a foglalas mar berlethez tartozik', 409); throw e; });
  if (valtozas(r) !== 1) throw new CrmHiba('NINCS_SZABAD_ALKALOM', 'nincs szabad alkalom a berletben', 409);
  await auditStmt(db, { staffId, action: 'package.reserve', resource: 'package_redemption', resourceId: id, guestId: b.guest_id, detail: { purchase_id: purchaseId, booking_id: bookingId, source: 'staff' }, now }).run();
  return elso(db, 'SELECT * FROM package_redemption WHERE id = ?1', id);
}

/** felszabaditas (recepcio): a foglalt alkalom visszakerul a szabad keretbe (pl. a vendeg ugy dont, alkalmankent fizet) */
export async function felszabadit(db, { bookingId, staffId, ok = null, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'package', { resourceId: bookingId, now });
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE package_redemption SET status = \'released\', released_at = ?2 WHERE booking_id = ?1 AND status = \'reserved\'', bookingId, now),
    auditStmt(db, { staffId, action: 'package.release', resource: 'package_redemption', resourceId: bookingId, detail: { ok }, now }),
  ]);
  return valtozas(r) === 1;
}

/** a completed-igazolas batch-utasitasai: a foglalt alkalom felhasznalttá valik (csak ha a kezeles-sor tenyleg beszurodott) */
export async function felhasznalStmts(db, { bookingId, sessionId, now }) {
  await autoFoglal(db, bookingId, { now });   // ha meg nem volt foglalva, de van jogosult berlet (lejarat elotti foglalas)
  const rd = await elso(db, 'SELECT * FROM package_redemption WHERE booking_id = ?1', bookingId);
  if (!rd || rd.status !== 'reserved') return { stmts: [], purchaseId: rd?.purchase_id || null };
  return {
    purchaseId: rd.purchase_id,
    stmts: [keszit(db, 'UPDATE package_redemption SET status = \'used\', used_at = ?2 WHERE booking_id = ?1 AND status = \'reserved\' AND EXISTS (SELECT 1 FROM treatment_session WHERE id = ?3)', bookingId, now, sessionId)],
  };
}

/**
 * Athelyezes ELLENORZES (a recepcio / UI hasznalhatja a Salonic-athelyezes elott): lejarat utan csak egyszer, max a mostani slot + 30 nap.
 * Lejarat elott: korlatlan (a foglalas a lejarat utan is teljesitheto, ha a foglalas a lejarat elott jott letre).
 */
export async function athelyezesEngedett(db, { bookingId, ujStart, mikor = most() }) {
  const rd = await elso(db, 'SELECT * FROM package_redemption WHERE booking_id = ?1', bookingId);
  if (!rd || rd.status !== 'reserved') return { engedett: true, lejarat_utan: false };
  const p = await csomag(db, rd.purchase_id);
  const b = await elso(db, 'SELECT start_at FROM booking WHERE id = ?1', bookingId);
  if (mikor <= p.expires_at) return { engedett: true, lejarat_utan: false };
  if (rd.expiry_reschedules >= BERLET_LEJARAT_UTANI_ATHELYEZES_MAX) return { engedett: false, lejarat_utan: true, kod: 'masodik_athelyezes' };
  if (ujStart > naptariNapHozzaad(b.start_at, BERLET_LEJARAT_UTANI_ATHELYEZES_NAP)) return { engedett: false, lejarat_utan: true, kod: 'tul_keso_athelyezes' };
  return { engedett: true, lejarat_utan: true };
}

/** hook: a foglalas athelyezodott (booking.js hivja az athelyezes UTAN, a regi slot ismereteben). Szabalysertes: jeloles + riasztas. */
export async function athelyezesKovet(db, { bookingId, regiStart, ujStart, esemenyIdo, now = most() }) {
  const rd = await elso(db, 'SELECT * FROM package_redemption WHERE booking_id = ?1', bookingId);
  if (!rd || rd.status !== 'reserved') return null;
  const p = await csomag(db, rd.purchase_id);
  if (esemenyIdo <= p.expires_at) return { lejarat_utan: false };
  let kod = null;
  if (rd.expiry_reschedules >= BERLET_LEJARAT_UTANI_ATHELYEZES_MAX) kod = 'masodik_athelyezes';
  else if (ujStart > naptariNapHozzaad(regiStart, BERLET_LEJARAT_UTANI_ATHELYEZES_NAP)) kod = 'tul_keso_athelyezes';
  const ut = [keszit(db, 'UPDATE package_redemption SET expiry_reschedules = expiry_reschedules + 1, policy_violation = COALESCE(policy_violation, ?2) WHERE id = ?1', rd.id, kod)];
  ut.push(auditStmt(db, { action: 'package.expiry_reschedule', resource: 'package_redemption', resourceId: rd.id, guestId: rd.guest_id, result: kod ? 'error' : 'ok', detail: { booking_id: bookingId, regi: regiStart, uj: ujStart, kod }, now }));
  if (kod) ut.push(outboxStmt(db, { tipus: 'package.policy_violation', aggTipus: 'package_redemption', aggId: rd.id, guestId: rd.guest_id, payload: { purchase_id: p.id, booking_id: bookingId, code: kod }, dedupeKey: `package.policy_violation:${rd.id}:${ujStart}`, now }));
  await tranzakcio(db, ut);
  return { lejarat_utan: true, szabalysertes: kod };
}

/** hook: lemondas (booking.js hivja). Lejarat elott: az alkalom felszabadul; lejarat utan: az alkalom jogosultsaga megszunik (forfeited). */
export async function lemondasKovet(db, { bookingId, esemenyIdo, now = most() }) {
  const rd = await elso(db, 'SELECT * FROM package_redemption WHERE booking_id = ?1', bookingId);
  if (!rd || rd.status !== 'reserved') return null;
  const p = await csomag(db, rd.purchase_id);
  const lejart = esemenyIdo > p.expires_at;
  await tranzakcio(db, [
    lejart
      ? keszit(db, 'UPDATE package_redemption SET status = \'forfeited\', forfeited_at = ?2 WHERE id = ?1 AND status = \'reserved\'', rd.id, now)
      : keszit(db, 'UPDATE package_redemption SET status = \'released\', released_at = ?2 WHERE id = ?1 AND status = \'reserved\'', rd.id, now),
    auditStmt(db, { action: lejart ? 'package.forfeit' : 'package.release', resource: 'package_redemption', resourceId: rd.id, guestId: rd.guest_id, detail: { booking_id: bookingId, ok: 'cancelled' }, now }),
  ]);
  await allapotFrissit(db, p.id, now);
  return { statusz: lejart ? 'forfeited' : 'released' };
}

/** hook: no-show. Onmagaban NINCS penz / levonas: az alkalom felszabadul. */
export async function noShowKovet(db, { bookingId, now = most() }) {
  const rd = await elso(db, 'SELECT * FROM package_redemption WHERE booking_id = ?1', bookingId);
  if (!rd || rd.status !== 'reserved') return null;
  await tranzakcio(db, [
    keszit(db, 'UPDATE package_redemption SET status = \'released\', released_at = ?2 WHERE id = ?1 AND status = \'reserved\'', rd.id, now),
    auditStmt(db, { action: 'package.release', resource: 'package_redemption', resourceId: rd.id, guestId: rd.guest_id, detail: { booking_id: bookingId, ok: 'no_show_no_penalty' }, now }),
  ]);
  return { statusz: 'released' };
}

/** szalonvezetoi egyedi hosszabbitas (nem automatikus). Indok kotelezo. */
export async function hosszabbit(db, { purchaseId, staffId, ujLejarat = null, honap = null, ok, now = most() }) {
  await megkoveteli(db, staffId, 'approve', 'package', { resourceId: purchaseId, now });
  if (!ok || !String(ok).trim()) throw new CrmHiba('INDOK_KELL', 'a hosszabbitashoz indok kell', 400);
  const p = await csomag(db, purchaseId);
  if (!p) throw new CrmHiba('NINCS_BERLET', 'nincs ilyen berlet', 404);
  if (p.status === 'refunded') throw new CrmHiba('VISSZATERITETT', 'visszaterített berlet nem hosszabbithato', 409);
  const uj = ujLejarat ?? honapHozzaad(p.expires_at, honap || 0);
  if (!(uj > p.expires_at)) throw new CrmHiba('ERVENYTELEN_LEJARAT', 'az uj lejarat nem kesobbi a jelenleginel', 400);
  await tranzakcio(db, [
    keszit(db, 'UPDATE package_purchase SET expires_at = ?2, status = \'extended_by_manager\' WHERE id = ?1', purchaseId, uj),
    keszit(db, 'INSERT INTO package_adjustment (id, purchase_id, kind, old_expires_at, new_expires_at, reason, approved_by, at) VALUES (?1, ?2, \'extension\', ?3, ?4, ?5, ?6, ?7)', uuid(), purchaseId, p.expires_at, uj, ok, staffId, now),
    auditStmt(db, { staffId, action: 'package.extend', resource: 'package_purchase', resourceId: purchaseId, guestId: p.guest_id, detail: { regi: p.expires_at, uj }, now }),
  ]);
  return { lejarat: uj };
}

/** naplozott kezi korrekcio (alkalom-szam), szalonvezeto */
export async function korrekcio(db, { purchaseId, deltaUnits, staffId, ok, now = most() }) {
  await megkoveteli(db, staffId, 'approve', 'package', { resourceId: purchaseId, now });
  if (!ok || !Number.isInteger(deltaUnits) || deltaUnits === 0) throw new CrmHiba('ERVENYTELEN_KORREKCIO', 'indok es nem nulla egesz delta kell', 400);
  const p = await csomag(db, purchaseId);
  if (!p) throw new CrmHiba('NINCS_BERLET', 'nincs ilyen berlet', 404);
  await tranzakcio(db, [
    keszit(db, 'UPDATE package_purchase SET units_adjust = units_adjust + ?2 WHERE id = ?1', purchaseId, deltaUnits),
    keszit(db, 'INSERT INTO package_adjustment (id, purchase_id, kind, delta_units, reason, approved_by, at) VALUES (?1, ?2, \'manual_correction\', ?3, ?4, ?5, ?6)', uuid(), purchaseId, deltaUnits, ok, staffId, now),
    auditStmt(db, { staffId, action: 'package.correction', resource: 'package_purchase', resourceId: purchaseId, guestId: p.guest_id, detail: { deltaUnits }, now }),
  ]);
}

/**
 * Refund (szalonvezeto). mod 'teljes': CSAK ha 0 felhasznalt alkalom, SEMMILYEN kezeles nem tortent, es vegleges ellenjavallat van
 * (guest.clinical_stop = contraindication). A bontatlan ajandekot visszakerik (return_due), a felbontottat nem vonjak le a refundbol.
 * mod 'egyedi': szakmai okbol megszakitott kura, a szalonvezeto egyedi osszeget hataroz meg (indok kotelezo).
 * ajandekAllapot: { <giftId>: 'bontatlan' | 'felbontott' } - minden atadott ajandekhoz kotelezo megadni.
 */
export async function refund(db, { purchaseId, staffId, mod = 'teljes', osszeg = null, ok, ajandekAllapot = {}, now = most() }) {
  await megkoveteli(db, staffId, 'approve', 'package', { resourceId: purchaseId, now });
  if (!ok || !String(ok).trim()) throw new CrmHiba('INDOK_KELL', 'a refundhoz indok kell', 400);
  const p = await csomag(db, purchaseId);
  if (!p) throw new CrmHiba('NINCS_BERLET', 'nincs ilyen berlet', 404);
  if (p.status === 'refunded') throw new CrmHiba('MAR_VISSZATERITVE', 'a berlet mar vissza van terítve', 409);
  const g = await elso(db, 'SELECT * FROM guest WHERE id = ?1', p.guest_id);
  const sz = await szamok(db, purchaseId);
  let osszegVegso;
  if (mod === 'teljes') {
    const kezelesek = (await elso(db, 'SELECT COUNT(*) AS n FROM treatment_session WHERE guest_id = ?1', p.guest_id)).n;
    if (sz.used > 0 || kezelesek > 0) throw new CrmHiba('REFUND_FELTETEL', 'teljes refund csak 0 felhasznalt alkalom es 0 elvegzett kezeles eseten', 409);
    if (g.clinical_stop !== 'contraindication') throw new CrmHiba('REFUND_FELTETEL', 'teljes refundhoz vegleges ellenjavallat (clinical_stop) kell', 409);
    osszegVegso = p.price_huf;
  } else if (mod === 'egyedi') {
    if (!Number.isInteger(osszeg) || osszeg <= 0 || osszeg > p.price_huf) throw new CrmHiba('ERVENYTELEN_OSSZEG', 'az osszeg 1..vasarlasi ar kozotti egesz forint', 400);
    osszegVegso = osszeg;
  } else throw new CrmHiba('ISMERETLEN_MOD', 'mod: teljes | egyedi', 400);

  const ajandekok = await mind(db, 'SELECT * FROM package_gift WHERE purchase_id = ?1', purchaseId);
  const ut = [
    keszit(db, 'UPDATE package_purchase SET status = \'refunded\', refunded_at = ?2 WHERE id = ?1 AND status <> \'refunded\'', purchaseId, now),
    keszit(db, 'UPDATE package_redemption SET status = \'released\', released_at = ?2 WHERE purchase_id = ?1 AND status = \'reserved\'', purchaseId, now),
  ];
  const ajandekAudit = {};
  for (const a of ajandekok) {
    if (a.status === 'handed_over') {
      const all = ajandekAllapot[a.id];
      if (!['bontatlan', 'felbontott'].includes(all)) throw new CrmHiba('AJANDEK_ALLAPOT_KELL', `az atadott ajandek allapota kotelezo: ${a.id}`, 400);
      const uj = all === 'bontatlan' ? 'return_due' : 'kept_opened';
      ut.push(keszit(db, 'UPDATE package_gift SET status = ?2 WHERE id = ?1', a.id, uj));
      ajandekAudit[a.id] = uj;
    } else if (a.status === 'due') {
      ut.push(keszit(db, 'UPDATE package_gift SET status = \'cancelled\' WHERE id = ?1', a.id));
      ajandekAudit[a.id] = 'cancelled';
    }
  }
  ut.push(keszit(db, 'INSERT INTO package_adjustment (id, purchase_id, kind, amount_huf, reason, approved_by, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)', uuid(), purchaseId, mod === 'teljes' ? 'refund_full' : 'refund_individual', osszegVegso, ok, staffId, now));
  ut.push(auditStmt(db, { staffId, action: `package.refund_${mod}`, resource: 'package_purchase', resourceId: purchaseId, guestId: p.guest_id, detail: { osszeg: osszegVegso, ajandekok: ajandekAudit }, now }));
  ut.push(outboxStmt(db, { tipus: 'package.refunded', aggTipus: 'package_purchase', aggId: purchaseId, guestId: p.guest_id, payload: { purchase_id: purchaseId, mod }, dedupeKey: `package.refunded:${purchaseId}`, now }));
  await tranzakcio(db, ut);
  return { osszeg: osszegVegso, ajandekok: ajandekAudit };
}

/** ajandek atadasa (recepcio): a teljes ar kifizetesekor azonnal */
export async function ajandekAtad(db, { giftId, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'gift', { resourceId: giftId, now });
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE package_gift SET status = \'handed_over\', handed_at = ?2, handed_by = ?3 WHERE id = ?1 AND status = \'due\'', giftId, now, staffId),
    auditStmt(db, { staffId, action: 'package.gift_handover', resource: 'package_gift', resourceId: giftId, now }),
  ]);
  if (valtozas(r) !== 1) throw new CrmHiba('NEM_ATADHATO', 'az ajandek nem atadhato (nem esedekes)', 409);
}

/** a visszakert (bontatlan) ajandek visszaerkezett */
export async function ajandekVisszavesz(db, { giftId, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'gift', { resourceId: giftId, now });
  const g = await elso(db, 'SELECT g.*, p.guest_id FROM package_gift g JOIN package_purchase p ON p.id = g.purchase_id WHERE g.id = ?1', giftId);
  if (!g) throw new CrmHiba('NINCS_AJANDEK', 'nincs ilyen ajandek', 404);
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE package_gift SET status = \'returned\', returned_at = ?2 WHERE id = ?1 AND status = \'return_due\'', giftId, now),
    keszit(db, 'INSERT INTO package_adjustment (id, purchase_id, kind, reason, approved_by, at) SELECT ?1, purchase_id, \'gift_return\', ?3, ?4, ?5 FROM package_gift WHERE id = ?2 AND status = \'returned\' AND returned_at = ?5', uuid(), giftId, `ajandek visszavetel: ${g.kind}`, staffId, now),
    auditStmt(db, { staffId, action: 'package.gift_returned', resource: 'package_gift', resourceId: giftId, guestId: g.guest_id, now }),
  ]);
  if (valtozas(r) !== 1) throw new CrmHiba('NEM_VISSZAVEHETO', 'az ajandek nem visszakeres alatt all', 409);
}

/**
 * Lejarat-figyelo (B30 / B7): azok a berletek, amelyek lejarata `napElore` napon belul van, es van TENYLEGES szabad alkalmuk.
 * (az uzenet-motor a napElore = 30 / 7 ertekekkel hivja; a vegso szabadsag-ellenorzes kuldeskor megismetlodik)
 */
export async function lejaratFigyelo(db, { napElore, now = most() }) {
  const hatar = now + napElore * MASODPERC.NAP;
  const jeloltek = await mind(db, 'SELECT * FROM package_purchase WHERE status IN (\'paid_active\', \'extended_by_manager\') AND expires_at > ?1 AND expires_at <= ?2 ORDER BY expires_at', now, hatar);
  const ki = [];
  for (const p of jeloltek) {
    const szabad = await szabadAlkalmak(db, p, { now });
    if (szabad > 0) ki.push({ purchaseId: p.id, guestId: p.guest_id, packageType: p.package_type, expiresAt: p.expires_at, szabad });
  }
  return ki;
}

/** berlet-osszegzo a vendegprofilhoz */
export async function vendegBerletei(db, guestId, { now = most() } = {}) {
  const lista = await mind(db, 'SELECT * FROM package_purchase WHERE guest_id = ?1 ORDER BY paid_at', guestId);
  const ki = [];
  for (const p of lista) {
    const sz = await szamok(db, p.id);
    ki.push({ ...p, szamok: sz, szabad: await szabadAlkalmak(db, p, { now }), ajandekok: await mind(db, 'SELECT * FROM package_gift WHERE purchase_id = ?1', p.id) });
  }
  return ki;
}
export { BERLET };
