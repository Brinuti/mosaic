// Foglalas (booking) + naplo (booking_event). A Salonic-ertesitobol jovo esemenyek IDEMPOTENS feldolgozasa es a completed-igazolas.
//  - ingestBookingEvent: booked / rescheduled / cancelled / no_show. Az ismetelt esemeny nem duplikal, a reschedule NEM cancelled, a sorrendiseg
//    (eventAt) vedett, az ervenytelen atmenet naplozva kimarad. A completed SOHA nem jon be innen (a Salonic "attended" csak jelzes).
//  - igazolCompleted: az EGYETLEN ut a completed-hez: jogosult kezelo igazolja, egy tranzakcioban (db.batch), duplazodas ellen UNIQUE-kal.
//    Csak a kezelo-igazolt completed noveli a kura sorszamat; camera_assessment / legacy_combo nem kezeles-alkalom.
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, valtozas, korlatHiba, beszurHa, jsonOlvas } from './db.js';
import { FIOK_ALAP, FOGLALAS_AKTIV, FOGLALAS_ATMENET, INGEST_ALLAPOTOK, SZOLGALTATAS } from './constants.js';
import { auditStmt, bookingEventStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { megkoveteli } from './rbac.js';
import { vendegAzonosit, vegleges } from './guest.js';
import * as kura from './course.js';
import * as berlet from './package.js';
import * as credit from './credit.js';

export const foglalas = (db, id) => elso(db, 'SELECT * FROM booking WHERE id = ?1', id);
export const foglalasKulsoId = (db, account, externalId) => elso(db, 'SELECT * FROM booking WHERE account = ?1 AND external_id = ?2', account, externalId);
export const esemenyek = (db, bookingId) => mind(db, 'SELECT * FROM booking_event WHERE booking_id = ?1 ORDER BY event_at, rowid', bookingId);

/** szolgaltatas-kod feloldasa: a kod maga, vagy a service_catalog.salonic_service_ids terkepe a fiokra. Ismeretlen: hiba (nem talalgatunk). */
export async function szolgaltatasKod(db, account, nyers) {
  const s = String(nyers ?? '').trim();
  const sorok = await mind(db, 'SELECT code, salonic_service_ids FROM service_catalog');
  if (sorok.some((r) => r.code === s)) return s;
  for (const r of sorok) {
    const ids = (jsonOlvas(r.salonic_service_ids, {}) || {})[account] || [];
    if (ids.map(String).includes(s)) return r.code;
  }
  throw new CrmHiba('ISMERETLEN_SZOLGALTATAS', `ismeretlen szolgaltatas: ${s}`, 400);
}

async function kezeloFeloldas(db, th) {
  if (!th) return { id: null, nev: null };
  if (typeof th === 'string') th = { nev: th };
  if (th.staffId) return { id: th.staffId, nev: th.nev || null };
  if (!th.nev) return { id: null, nev: null };
  const r = await elso(db, 'SELECT id FROM staff_user WHERE active = 1 AND (salonic_name = ?1 OR name = ?1) LIMIT 2', th.nev);
  return { id: r?.id || null, nev: th.nev };
}

/**
 * Salonic-foglalas esemeny feldolgozasa.
 * p: { account?, externalId, service, start, end?, status: booked|rescheduled|cancelled|no_show, guest: {externalId?, nev, email, telefon},
 *      therapist?: {staffId?, nev}, eventAt?, eventId?, bookedAt?, now? }
 * Visszaad: { valtozas: 'uj'|'athelyezve'|'lemondva'|'no_show'|'duplikalt'|'elavult'|'kihagyva', bookingId, guestId, ... }
 */
export async function ingestBookingEvent(db, p, _kor = 0) {
  const now = p.now ?? most();
  const account = p.account || FIOK_ALAP;
  const externalId = String(p.externalId ?? '').trim();
  if (!externalId) throw new CrmHiba('HIANYZO_AZONOSITO', 'externalId kotelezo', 400);
  if (!Number.isInteger(p.start)) throw new CrmHiba('ERVENYTELEN_IDOPONT', 'start: egesz epoch masodperc', 400);
  const status = p.status || 'booked';
  if (status !== 'completed' && !INGEST_ALLAPOTOK.includes(status)) throw new CrmHiba('ERVENYTELEN_ALLAPOT', `ismeretlen allapot: ${status}`, 400);
  const eventAt = p.eventAt ?? now;
  const kod = await szolgaltatasKod(db, account, p.service);
  const letezo = await foglalasKulsoId(db, account, externalId);

  // A Salonic "completed / attended" jelzese NEM igazolas: csak naplo-jelzes, allapotot nem valtoztat.
  if (status === 'completed') {
    if (letezo) await bookingEventStmt(db, { bookingId: letezo.id, idempotencyKey: `hint:${account}:${externalId}:${p.eventId || eventAt}`, type: 'salonic_attended_hint', fromStatus: letezo.status, eventAt, detail: { megjegyzes: 'csak kezelo igazolhatja' }, now }).run();
    return { valtozas: 'kihagyva', ok: 'COMPLETED_CSAK_IGAZOLASSAL', bookingId: letezo?.id || null };
  }

  if (!letezo) return ujFoglalas(db, { p, now, account, externalId, status, kod, eventAt }, _kor);
  return meglevoFoglalas(db, { p, now, b: letezo, status, eventAt }, 0);
}

async function ujFoglalas(db, { p, now, account, externalId, status, kod, eventAt }, kor) {
  const g = await vendegAzonosit(db, { account, externalGuestId: p.guest?.externalId, nev: p.guest?.nev, email: p.guest?.email, telefon: p.guest?.telefon, now });
  const kez = await kezeloFeloldas(db, p.therapist);
  const id = uuid();
  const kezdoAllapot = status === 'rescheduled' ? 'booked' : status;   // ismeretlen foglalas athelyezes-ertesitoje: uj foglalaskent vesszuk fel az uj idovel
  const ha = { sql: 'SELECT 1 FROM booking WHERE id = ?', params: [id] };
  const ut = [
    keszit(db,
      `INSERT OR IGNORE INTO booking (id, account, external_id, guest_id, service_code, therapist_id, therapist_name, start_at, end_at, status, version, booked_at, original_start_at, reschedule_count,
         cancelled_at, no_show_at, last_event_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?8, 0, ?12, ?13, ?14, ?15, ?15)`,
      id, account, externalId, g.guestId, kod, kez.id, kez.nev, p.start, p.end ?? null, kezdoAllapot, p.bookedAt ?? eventAt,
      kezdoAllapot === 'cancelled' ? eventAt : null, kezdoAllapot === 'no_show' ? eventAt : null, eventAt, now),
    bookingEventStmt(db, { bookingId: id, idempotencyKey: `${account}:${externalId}:${kezdoAllapot}:${p.start}:first`, type: kezdoAllapot, toStatus: kezdoAllapot, newStart: p.start, eventAt, detail: { service: kod, first_seen: true }, now, ha }),
  ];
  if (kezdoAllapot === 'booked') {
    ut.push(outboxStmt(db, { tipus: 'booking.confirmed', aggTipus: 'booking', aggId: id, guestId: g.guestId, payload: { booking_id: id, service_code: kod, start_at: p.start }, dedupeKey: `booking.confirmed:${id}`, now, ha }));
  }
  const [r] = await tranzakcio(db, ut);
  if (valtozas(r) !== 1) {   // verseny / dupla kuldes: a masik hivas mar letrehozta
    if (kor >= 2) throw new CrmHiba('VERSENY', 'a foglalas feldolgozasa utkozott', 409);
    const mar = await foglalasKulsoId(db, account, externalId);
    if (!mar) {   // nem azonos kulso azonosito, de ugyanaz a vendeg ugyanarra a szolgaltatasra es idopontra mar aktiv (pl. a masik Salonic-fiokbol): nem duplikalunk
      const par = await elso(db, 'SELECT * FROM booking WHERE guest_id = ?1 AND service_code = ?2 AND start_at = ?3 AND status IN (\'booked\', \'rescheduled\', \'completed\') AND duplicate_of IS NULL', g.guestId, kod, p.start);
      if (!par) throw new CrmHiba('VERSENY', 'a foglalas beszurasa nem sikerult', 409);
      await bookingEventStmt(db, { bookingId: par.id, idempotencyKey: `dup:${account}:${externalId}:${p.start}`, type: 'duplicate_ignored', fromStatus: par.status, newStart: p.start, eventAt, detail: { account, external_id: externalId }, now }).run();
      return { valtozas: 'duplikalt', ok: 'KERESZT_FIOK_DUPLA', bookingId: par.id, guestId: par.guest_id };
    }
    return meglevoFoglalas(db, { p, now, b: mar, status, eventAt }, 0);
  }
  const b = await foglalas(db, id);
  if (['first_hair', 'followup_hair'].includes(kod)) await kura.kuraBiztosit(db, b.guest_id, { now });
  if (kezdoAllapot === 'booked') {
    if (kod === SZOLGALTATAS.FOLLOWUP_HAIR) await berlet.autoFoglal(db, id, { now });
    if (kod === SZOLGALTATAS.FIRST_HAIR) await credit.elsoFoglalasKapcsol(db, { bookingId: id, now });
  }
  return { valtozas: 'uj', bookingId: id, guestId: b.guest_id, identity: g.eredmeny, mergeRequestIds: g.mergeRequestIds, allapot: kezdoAllapot };
}

async function meglevoFoglalas(db, { p, now, b, status, eventAt }, kor) {
  const guestId = await vegleges(db, b.guest_id);
  const kulcsAlap = `${b.account}:${b.external_id}`;
  // sorrendiseg: regebbi esemeny nem irhatja felul az ujabbat
  if (eventAt < b.last_event_at) {
    await bookingEventStmt(db, { bookingId: b.id, idempotencyKey: `stale:${kulcsAlap}:${status}:${p.start}:${eventAt}`, type: 'stale', fromStatus: b.status, toStatus: status, newStart: p.start, eventAt, now }).run();
    return { valtozas: 'elavult', bookingId: b.id, guestId };
  }
  let ujAllapot = status;
  if (status === 'booked' && FOGLALAS_AKTIV.includes(b.status) && p.start !== b.start_at) ujAllapot = 'rescheduled';
  // azonos allapot + azonos idopont = ismetelt esemeny
  const azonos = (['cancelled', 'no_show'].includes(ujAllapot) && b.status === ujAllapot)
    || (['booked', 'rescheduled'].includes(status) && FOGLALAS_AKTIV.includes(b.status) && p.start === b.start_at);
  if (azonos) return { valtozas: 'duplikalt', bookingId: b.id, guestId };
  if (!FOGLALAS_ATMENET[b.status].includes(ujAllapot)) {
    await bookingEventStmt(db, { bookingId: b.id, idempotencyKey: `invalid:${kulcsAlap}:${b.status}>${ujAllapot}:${p.start}:${eventAt}`, type: 'invalid_transition', fromStatus: b.status, toStatus: ujAllapot, newStart: p.start, eventAt, now }).run();
    return { valtozas: 'kihagyva', ok: 'ERVENYTELEN_ATMENET', bookingId: b.id, guestId, regi: b.status };
  }

  const ujVerzio = b.version + 1;
  const ha = { sql: 'SELECT 1 FROM booking WHERE id = ? AND version = ?', params: [b.id, ujVerzio] };
  const kulcs = p.eventId ? `ev:${b.account}:${p.eventId}` : `${kulcsAlap}:${ujAllapot}:${p.start}:v${ujVerzio}`;
  const lastEvent = Math.max(eventAt, b.last_event_at);
  let frissit, kimenet;
  if (ujAllapot === 'rescheduled') {
    frissit = keszit(db, 'UPDATE booking SET start_at = ?3, end_at = ?4, status = \'rescheduled\', reschedule_count = reschedule_count + 1, version = version + 1, last_event_at = ?5, updated_at = ?6 WHERE id = ?1 AND version = ?2 AND status IN (\'booked\', \'rescheduled\')', b.id, b.version, p.start, p.end ?? null, lastEvent, now);
    kimenet = outboxStmt(db, { tipus: 'booking.rescheduled', aggTipus: 'booking', aggId: b.id, guestId, payload: { booking_id: b.id, old_start_at: b.start_at, new_start_at: p.start }, dedupeKey: `booking.rescheduled:${b.id}:v${ujVerzio}`, now, ha });
  } else if (ujAllapot === 'cancelled') {
    frissit = keszit(db, 'UPDATE booking SET status = \'cancelled\', cancelled_at = ?3, version = version + 1, last_event_at = ?4, updated_at = ?5 WHERE id = ?1 AND version = ?2 AND status IN (\'booked\', \'rescheduled\')', b.id, b.version, eventAt, lastEvent, now);
    kimenet = outboxStmt(db, { tipus: 'booking.cancelled', aggTipus: 'booking', aggId: b.id, guestId, payload: { booking_id: b.id }, dedupeKey: `booking.cancelled:${b.id}`, now, ha });
  } else {   // no_show
    frissit = keszit(db, 'UPDATE booking SET status = \'no_show\', no_show_at = ?3, version = version + 1, last_event_at = ?4, updated_at = ?5 WHERE id = ?1 AND version = ?2 AND status IN (\'booked\', \'rescheduled\')', b.id, b.version, eventAt, lastEvent, now);
    kimenet = outboxStmt(db, { tipus: 'booking.no_show', aggTipus: 'booking', aggId: b.id, guestId, payload: { booking_id: b.id }, dedupeKey: `booking.no_show:${b.id}`, now, ha });
  }
  const [r] = await tranzakcio(db, [
    frissit,
    bookingEventStmt(db, { bookingId: b.id, idempotencyKey: kulcs, type: ujAllapot, fromStatus: b.status, toStatus: ujAllapot, oldStart: b.start_at, newStart: ujAllapot === 'rescheduled' ? p.start : b.start_at, eventAt, detail: { version: ujVerzio }, now, ha }),
    kimenet,
  ]);
  if (valtozas(r) !== 1) {   // versenyhelyzet (masik hivas elobb valtoztatott): ujraolvas, legfeljebb 3-szor
    if (kor >= 3) throw new CrmHiba('VERSENY', 'a foglalas feldolgozasa utkozott', 409);
    return meglevoFoglalas(db, { p, now, b: await foglalas(db, b.id), status, eventAt }, kor + 1);
  }
  if (ujAllapot === 'rescheduled') {
    const pk = await berlet.athelyezesKovet(db, { bookingId: b.id, regiStart: b.start_at, ujStart: p.start, esemenyIdo: eventAt, now });
    await credit.athelyezesKovet(db, { bookingId: b.id });
    return { valtozas: 'athelyezve', bookingId: b.id, guestId, berlet: pk };
  }
  if (ujAllapot === 'cancelled') {
    await berlet.lemondasKovet(db, { bookingId: b.id, esemenyIdo: eventAt, now });
    await credit.lemondasKovet(db, { bookingId: b.id, now });
    return { valtozas: 'lemondva', bookingId: b.id, guestId };
  }
  await berlet.noShowKovet(db, { bookingId: b.id, now });
  return { valtozas: 'no_show', bookingId: b.id, guestId };
}

/**
 * A kezeles / felmeres megtortentenek igazolasa (completed). CSAK jogosult kezelo (rbac: booking.confirm). Egy tranzakcio (db.batch):
 * booking -> completed, treatment_session (UNIQUE booking_id, UNIQUE course+index), kura-sorszam++, dokumentum-sor (missing), Google-keres, outbox, audit.
 * Idempotens: az ismetelt igazolas { mar: true }-t ad, nem noveli ketszer a sorszamot.
 */
export async function igazolCompleted(db, { bookingId, staffId, now = most(), ipHash = null }) {
  await megkoveteli(db, staffId, 'confirm', 'booking', { resourceId: bookingId, ipHash, now });
  const b = await foglalas(db, bookingId);
  if (!b) throw new CrmHiba('NINCS_FOGLALAS', 'nincs ilyen foglalas', 404);
  if (b.status === 'completed') {
    const s = await elso(db, 'SELECT * FROM treatment_session WHERE booking_id = ?1', bookingId);
    return { mar: true, bookingId, treatmentIndex: s?.treatment_index ?? null };
  }
  if (!FOGLALAS_AKTIV.includes(b.status)) throw new CrmHiba('NEM_IGAZOLHATO', `a ${b.status} foglalas nem igazolhato completed-nek`, 409);
  if (b.duplicate_of) throw new CrmHiba('NEM_IGAZOLHATO', 'dupla foglalas nem igazolhato', 409);
  const g = await elso(db, 'SELECT * FROM guest WHERE id = ?1', b.guest_id);
  if (!g || g.status !== 'active') throw new CrmHiba('NEM_AKTIV_VENDEG', 'a vendeg nem aktiv (osszevont?)', 409);

  const bookingFrissit = keszit(db, 'UPDATE booking SET status = \'completed\', completed_at = ?2, completed_by = ?3, version = version + 1, updated_at = ?2 WHERE id = ?1 AND status IN (\'booked\', \'rescheduled\')', bookingId, now, staffId);
  const hoz = { sql: 'SELECT 1 FROM booking WHERE id = ? AND status = \'completed\' AND completed_by = ? AND completed_at = ?', params: [bookingId, staffId, now] };
  const eventKulcs = `completed:${b.account}:${b.external_id}`;
  const esemeny = (ha) => bookingEventStmt(db, { bookingId, idempotencyKey: eventKulcs, type: 'completed', fromStatus: b.status, toStatus: 'completed', oldStart: b.start_at, newStart: b.start_at, actor: staffId, eventAt: now, now, ha });

  // ---- nem kezeles-alkalom: kamera-felmeres, kombinalt (regi) kezeles ----
  if (b.service_code !== SZOLGALTATAS.FIRST_HAIR && b.service_code !== SZOLGALTATAS.FOLLOWUP_HAIR) {
    const ut = [bookingFrissit, esemeny(hoz)];
    let creditId = null;
    if (b.service_code === SZOLGALTATAS.CAMERA) {
      const c = credit.letrehozStmts(db, { kameraFoglalas: b, staffId, now });
      creditId = c.creditId; ut.push(...c.stmts);
      ut.push(outboxStmt(db, { tipus: 'assessment.completed', aggTipus: 'booking', aggId: bookingId, guestId: b.guest_id, payload: { booking_id: bookingId, credit_id: creditId }, dedupeKey: `assessment.completed:${bookingId}`, now, ha: hoz }));
    }
    ut.push(auditStmt(db, { staffId, action: 'booking.completed', resource: 'booking', resourceId: bookingId, guestId: b.guest_id, detail: { service: b.service_code, kezeles_alkalom: false }, now, ha: hoz }));
    try { await tranzakcio(db, ut); } catch (e) { if (korlatHiba(e)) return ujraOlvasIgazolt(db, bookingId); throw e; }
    const utana = await foglalas(db, bookingId);
    if (utana.status !== 'completed') throw new CrmHiba('NEM_IGAZOLHATO', 'az igazolas nem tortent meg (verseny)', 409);
    if (b.service_code === SZOLGALTATAS.CAMERA) await credit.ujraKapcsol(db, b.guest_id, { now });
    return { mar: false, bookingId, treatmentIndex: null, kezelesAlkalom: false, creditId };
  }

  // ---- kezeles-alkalom ----
  if (g.clinical_stop) throw new CrmHiba('KLINIKAI_STOP', `szakmai stop (${g.clinical_stop}): a kezeles nem igazolhato`, 409);
  const nyitott = await elso(db, 'SELECT 1 AS x FROM contraindication_alert WHERE guest_id = ?1 AND status IN (\'open\', \'acknowledged\', \'clinical_stop\')', b.guest_id);
  if (nyitott) throw new CrmHiba('KLINIKAI_FELULVIZSGALAT_KELL', 'nyitott ellenjavallati jelzes: a kezelo / szakmai vezeto felulvizsgalata kell', 409);
  const k = await kura.kuraBiztosit(db, b.guest_id, { now });
  const index = kura.kovetkezoIndex(k, b.service_code);
  const sessionId = uuid();
  const therapistId = b.therapist_id || staffId;
  const sessionHa = { sql: 'SELECT 1 FROM treatment_session WHERE id = ?', params: [sessionId] };
  const felh = await berlet.felhasznalStmts(db, { bookingId, sessionId, now });
  const ut = [
    bookingFrissit,
    beszurHa(db, { tabla: 'treatment_session', ha: hoz, adat: { id: sessionId, booking_id: bookingId, course_id: k.id, guest_id: b.guest_id, treatment_index: index, therapist_id: therapistId, confirmed_by: staffId, confirmed_at: now, camera_required: kura.kameraKotelezo(index) ? 1 : 0, created_at: now } }),
    esemeny(sessionHa),
    ...kura.kezelesStmts(db, { booking: b, kura: k, index, sessionId, staffId, therapistId, now }),
    ...felh.stmts,
  ];
  try { await tranzakcio(db, ut); } catch (e) {
    if (korlatHiba(e)) return ujraOlvasIgazolt(db, bookingId);   // masik igazolas elobb vegzett (UNIQUE) -> idempotens eredmeny
    throw e;
  }
  const s = await elso(db, 'SELECT * FROM treatment_session WHERE id = ?1', sessionId);
  if (!s) {
    const mar = await ujraOlvasIgazolt(db, bookingId);
    return mar;
  }
  if (felh.purchaseId) await berlet.allapotFrissit(db, felh.purchaseId, now);
  await credit.ujraKapcsol(db, b.guest_id, { now });
  return { mar: false, bookingId, sessionId, courseId: k.id, treatmentIndex: index, cameraRequired: kura.kameraKotelezo(index), dokumentum: kura.dokumentumFajta(index), kezelesAlkalom: true };
}

async function ujraOlvasIgazolt(db, bookingId) {
  const b = await foglalas(db, bookingId);
  if (b?.status !== 'completed') throw new CrmHiba('VERSENY', 'az igazolas utkozott, probald ujra', 409);
  const s = await elso(db, 'SELECT * FROM treatment_session WHERE booking_id = ?1', bookingId);
  return { mar: true, bookingId, treatmentIndex: s?.treatment_index ?? null };
}
