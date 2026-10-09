// Hozzajarulasok (consent_event) es leiratkozas (unsubscribe). Az e-mail marketing, az SMS marketing es a kepmarketing KULON csatorna, kulon
// hozzajarulassal; mindegyiknel szovegverzio + idobelyeg + visszavonas. A jelenlegi allapot a csatorna LEGUJABB eseme­nye (hozzafuzheto naplo).
// A marketing-felhasznalas kapuja: lehetMarketing(). A hozzajarulas hianya a foglalast / kezelest nem akadalyozza (B10).
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, valtozas } from './db.js';
import { auditStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { CSATORNA, MARKETING_CSATORNAK } from './constants.js';
import { megkoveteli } from './rbac.js';

const CSATORNAK = [CSATORNA.EMAIL, CSATORNA.SMS, CSATORNA.KEP, CSATORNA.ADATKEZELES];

/** a csatorna legutolso esemenye ('granted' | 'withdrawn' | null) */
export async function utolsoEsemeny(db, guestId, csatorna) {
  return elso(db, 'SELECT * FROM consent_event WHERE guest_id = ?1 AND channel = ?2 ORDER BY at DESC, rowid DESC LIMIT 1', guestId, csatorna);
}

/** csak a hozzajarulas (nem a teljes marketing-kapu): van-e ervenyes, nem visszavont opt-in */
export async function hozzajarulas(db, guestId, csatorna) {
  const e = await utolsoEsemeny(db, guestId, csatorna);
  return !!e && e.action === 'granted';
}

/**
 * Hozzajarulas rogzitese. A forras: booking_form | staff | assessment | admin. Szovegverzio kotelezo (a vendeg tenyleg ezt a szoveget latta).
 * A foglalasi urlapon a kipipalas OPCIONALIS es elore NEM kipipalt; kipipalas hianyaban nem kell esemeny (nincs hozzajarulas).
 */
export async function rogzit(db, { guestId, csatorna, szovegVerzio, szoveg = null, forras = 'booking_form', staffId = null, ipHash = null, now = most() }) {
  if (!CSATORNAK.includes(csatorna)) throw new CrmHiba('ISMERETLEN_CSATORNA', `ismeretlen csatorna: ${csatorna}`, 400);
  if (!szovegVerzio) throw new CrmHiba('SZOVEGVERZIO_KELL', 'a hozzajarulas szovegverziojat rogzíteni kell', 400);
  if (staffId) await megkoveteli(db, staffId, 'write', 'consent', { guestId, now });
  const g = await elso(db, 'SELECT status FROM guest WHERE id = ?1', guestId);
  if (!g || g.status !== 'active') throw new CrmHiba('NINCS_VENDEG', 'nincs aktiv vendeg', 404);
  const id = uuid();
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO consent_event (id, guest_id, channel, action, text_version, text_snapshot, source, recorded_by, ip_hash, at) VALUES (?1, ?2, ?3, \'granted\', ?4, ?5, ?6, ?7, ?8, ?9)', id, guestId, csatorna, szovegVerzio, szoveg, forras, staffId, ipHash, now),
    auditStmt(db, { staffId, action: 'consent.granted', resource: 'consent_event', resourceId: id, guestId, detail: { csatorna, szovegVerzio, forras }, ipHash, now }),
  ]);
  return { eventId: id };
}

/** visszavonas: azonnal hat (S02). Naplozott opt-out + unsubscribe sor + audit + outbox (a fuggo uzenetek kuldeskor ugyis ujraolvassak az allapotot). */
export async function visszavon(db, { guestId, csatorna, forras = 'staff', staffId = null, ipHash = null, now = most() }) {
  if (![CSATORNA.EMAIL, CSATORNA.SMS, CSATORNA.KEP].includes(csatorna)) throw new CrmHiba('ISMERETLEN_CSATORNA', `visszavonhato csatorna: email_marketing | sms_marketing | image_marketing`, 400);
  if (staffId) await megkoveteli(db, staffId, 'write', 'consent', { guestId, now });
  const eid = uuid(), uid = uuid();
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO consent_event (id, guest_id, channel, action, text_version, source, recorded_by, ip_hash, at) VALUES (?1, ?2, ?3, \'withdrawn\', ?4, ?5, ?6, ?7, ?8)', eid, guestId, csatorna, 'withdrawal', forras, staffId, ipHash, now),
    keszit(db, 'INSERT INTO unsubscribe (id, guest_id, channel, source, at) VALUES (?1, ?2, ?3, ?4, ?5)', uid, guestId, csatorna, forras, now),
    auditStmt(db, { staffId, action: 'consent.withdrawn', resource: 'consent_event', resourceId: eid, guestId, detail: { csatorna, forras }, ipHash, now }),
    outboxStmt(db, { tipus: 'consent.withdrawn', aggTipus: 'consent_event', aggId: eid, guestId, payload: { channel: csatorna }, dedupeKey: `consent.withdrawn:${eid}`, now }),
  ]);
  return { eventId: eid };
}

/** leiratkozas a levelben / SMS STOP: ugyanaz, mint a visszavonas (a forras jelzi az utat) */
export const leiratkozas = (db, { guestId, csatorna, forras = 'unsubscribe_link', ipHash = null, now = most() }) =>
  visszavon(db, { guestId, csatorna, forras, ipHash, now });

/** a vendeg nyitott panasza van-e (marketing / visszafoglalas STOP) */
export async function nyitottPanasz(db, guestId) { return !!(await elso(db, 'SELECT 1 AS x FROM complaint WHERE guest_id = ?1 AND status = \'open\' LIMIT 1', guestId)); }

/**
 * Marketing-kapu: ervenyes csatorna-opt-in ES nincs leiratkozas ES nincs nyitott panasz ES nincs szakmai stop ES aktiv vendeg.
 * Reszletes valasz: marketingAllapot(). Csak 'email_marketing' / 'sms_marketing' kerdezheto.
 */
export async function marketingAllapot(db, guestId, csatorna) {
  if (!MARKETING_CSATORNAK.includes(csatorna)) throw new CrmHiba('ISMERETLEN_CSATORNA', 'email_marketing | sms_marketing', 400);
  const g = await elso(db, 'SELECT status, clinical_stop FROM guest WHERE id = ?1', guestId);
  if (!g || g.status !== 'active') return { ok: false, ok_kod: 'NEM_AKTIV_VENDEG' };
  const e = await utolsoEsemeny(db, guestId, csatorna);
  if (!e) return { ok: false, ok_kod: 'NINCS_HOZZAJARULAS' };
  if (e.action !== 'granted') return { ok: false, ok_kod: 'VISSZAVONVA' };
  if (await nyitottPanasz(db, guestId)) return { ok: false, ok_kod: 'NYITOTT_PANASZ' };
  if (g.clinical_stop) return { ok: false, ok_kod: 'KLINIKAI_STOP' };
  return { ok: true, szovegVerzio: e.text_version, ota: e.at };
}
export async function lehetMarketing(db, guestId, csatorna) { return (await marketingAllapot(db, guestId, csatorna)).ok; }

/** kepmarketing: kulon, kifejezett hozzajarulas kell (a kezeleshez nem szukseges) */
export const lehetKepMarketing = (db, guestId) => hozzajarulas(db, guestId, CSATORNA.KEP);

/** a vendeg osszes csatornajanak jelenlegi allapota + a teljes valtozas-tortenet (profil / auditalhatosag) */
export async function allapot(db, guestId) {
  const ki = {};
  for (const cs of CSATORNAK) { const e = await utolsoEsemeny(db, guestId, cs); ki[cs] = e ? { action: e.action, szovegVerzio: e.text_version, at: e.at } : null; }
  return { csatornak: ki, tortenet: await mind(db, 'SELECT channel, action, text_version, source, at FROM consent_event WHERE guest_id = ?1 ORDER BY at, rowid', guestId) };
}
export { valtozas };
