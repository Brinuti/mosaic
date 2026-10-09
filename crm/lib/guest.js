// Vendeg + salonic_guest_identity. A vendeg-azonositas szabalya (MASTERPROMPT 63-64. dontes):
//   - ismert (fiok, kulso azonosito) -> ugyanaz a vendeg
//   - ELLENORZOTT e-mail ES telefon egyezik pontosan EGY meglevo vendeggel -> automatikus osszefuzes (auto_link, naplozva)
//   - csak az egyik egyezik / tobb jelolt / hianyzo adat -> uj (ideiglenes) vendeg + identity_merge_request (kezi jovahagyas)
//   - CSAK nev szerinti egyezes SOHA nem hoz osszevonast (a nev-egyezes csak tajekoztato jelzo a keresben)
// "Ellenorzott" itt: ervenyes formatum (e-mail) / ertelmezheto magyar-nemzetkozi szam (telefon), Salonic-foglalasbol szarmazo adat.
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, korlatHiba, normEmail, normTelefon, jsonIr } from './db.js';
import { auditStmt, mergeAuditStmt } from './audit.js';
import { FIOK_ALAP } from './constants.js';
import { megkoveteli } from './rbac.js';

/** ekezet- es kisbetu-fuggetlen nev (csak tajekoztato egyezeshez) */
export const nevKulcs = (n) => String(n ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const vendeg = (db, id) => elso(db, 'SELECT * FROM guest WHERE id = ?1', id);

/** a vendeg vegleges (nem osszevont) azonositoja: a merged_into lancot koveti */
export async function vegleges(db, guestId) {
  let id = guestId;
  for (let i = 0; i < 10; i++) {
    const g = await elso(db, 'SELECT id, status, merged_into FROM guest WHERE id = ?1', id);
    if (!g) return null;
    if (g.status !== 'merged' || !g.merged_into) return g.id;
    id = g.merged_into;
  }
  throw new CrmHiba('MERGE_LANC', 'tul hosszu osszevonasi lanc', 500);
}

export function azonosKulcs(externalGuestId, email, telefon) {
  if (externalGuestId) return String(externalGuestId);
  if (email) return `email:${email}`;
  if (telefon) return `tel:${telefon}`;
  return `anon:${uuid()}`;
}

/** hiányzó elérhetőségek kitöltése (a meglévő érték nem íródik felül) */
function kitoltStmt(db, g, { nev, email, telefon }, now) {
  const sets = [], p = [g.id];
  const add = (oszlop, ertek) => { p.push(ertek); sets.push(`${oszlop} = ?${p.length}`); };
  if (!g.name && nev) add('name', nev);
  if (!g.email && email) { add('email', email); add('email_verified', 1); }
  if (!g.phone && telefon) { add('phone', telefon); add('phone_verified', 1); }
  if (!sets.length) return null;
  p.push(now); sets.push(`updated_at = ?${p.length}`);
  return keszit(db, `UPDATE guest SET ${sets.join(', ')} WHERE id = ?1`, ...p);
}

/**
 * Vendeg azonositasa egy bejovo foglalashoz. Idempotens. Visszaad:
 *  { guestId, identityId, eredmeny: 'meglevo_identity' | 'auto_osszefuzes' | 'uj_vendeg', mergeRequestIds: [...] }
 */
export async function vendegAzonosit(db, { account = FIOK_ALAP, externalGuestId = null, nev = null, email = null, telefon = null, now = most() }, _ujra = false) {
  const em = normEmail(email), tel = normTelefon(telefon);
  const acc = await elso(db, 'SELECT id FROM salonic_account WHERE id = ?1 AND active = 1', account);
  if (!acc) throw new CrmHiba('ISMERETLEN_FIOK', `ismeretlen vagy inaktiv Salonic-fiok: ${account}`, 400);
  const kulcs = azonosKulcs(externalGuestId, em, tel);

  // 1. ismert identity
  const ident = await elso(db, 'SELECT * FROM salonic_guest_identity WHERE account = ?1 AND external_id = ?2', account, kulcs);
  if (ident) {
    const gid = await vegleges(db, ident.guest_id);
    const g = await vendeg(db, gid);
    const k = kitoltStmt(db, g, { nev, email: em, telefon: tel }, now);
    if (k) await k.run();
    return { guestId: gid, identityId: ident.id, eredmeny: 'meglevo_identity', mergeRequestIds: [] };
  }

  // 2. jeloltek (CSAK e-mail / telefon alapjan; nev szerint soha)
  const emailJeloltek = em ? await mind(db, 'SELECT * FROM guest WHERE status = \'active\' AND email = ?1', em) : [];
  const telJeloltek = tel ? await mind(db, 'SELECT * FROM guest WHERE status = \'active\' AND phone = ?1', tel) : [];
  const mindketto = emailJeloltek.filter((a) => telJeloltek.some((b) => b.id === a.id));
  const identId = uuid();

  // 2a. egyertelmu automatikus osszefuzes: pontosan egy vendeg, e-mail ES telefon is ellenorzottan egyezik
  if (mindketto.length === 1 && mindketto[0].email_verified === 1 && mindketto[0].phone_verified === 1) {
    const g = mindketto[0];
    const ut = [
      keszit(db, 'INSERT INTO salonic_guest_identity (id, account, external_id, guest_id, name, email, phone, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)', identId, account, kulcs, g.id, nev, em, tel, now),
      mergeAuditStmt(db, { kind: 'auto_link', sourceGuestId: g.id, targetGuestId: g.id, snapshot: { identity_id: identId, account, external_id: kulcs, email_match: true, phone_match: true, name_match: nevKulcs(nev) === nevKulcs(g.name) }, now }),
      auditStmt(db, { action: 'guest.auto_link', resource: 'guest', resourceId: g.id, guestId: g.id, detail: { account, identity_id: identId }, now }),
    ];
    const k = kitoltStmt(db, g, { nev, email: em, telefon: tel }, now);
    if (k) ut.push(k);
    try { await tranzakcio(db, ut); } catch (e) {
      if (!_ujra && korlatHiba(e)) return vendegAzonosit(db, { account, externalGuestId, nev, email, telefon, now }, true);
      throw e;
    }
    return { guestId: g.id, identityId: identId, eredmeny: 'auto_osszefuzes', mergeRequestIds: [] };
  }

  // 2b. uj vendeg; bizonytalan jeloltekre kezi jovahagyasi keres
  const ujId = uuid();
  const jeloltek = new Map();
  for (const g of [...emailJeloltek, ...telJeloltek]) jeloltek.set(g.id, g);
  const ut = [
    keszit(db, 'INSERT INTO guest (id, name, email, email_verified, phone, phone_verified, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, \'active\', ?7, ?7)', ujId, nev, em, em ? 1 : 0, tel, tel ? 1 : 0, now),
    keszit(db, 'INSERT INTO salonic_guest_identity (id, account, external_id, guest_id, name, email, phone, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)', identId, account, kulcs, ujId, nev, em, tel, now),
    auditStmt(db, { action: 'guest.create', resource: 'guest', resourceId: ujId, guestId: ujId, detail: { account, jeloltek: jeloltek.size }, now }),
  ];
  const kerIdk = [];
  for (const g of jeloltek.values()) {
    const emailEgy = !!em && g.email === em, telEgy = !!tel && g.phone === tel;
    const ok = emailEgy && telEgy ? 'email_es_telefon_egyezik_de_nem_egyertelmu' : emailEgy ? 'csak_email_egyezik' : 'csak_telefon_egyezik';
    const kid = uuid();
    kerIdk.push(kid);
    ut.push(keszit(db,
      'INSERT INTO identity_merge_request (id, source_guest_id, target_guest_id, status, email_match, phone_match, name_match, reason, involved_staff, requested_at) VALUES (?1, ?2, ?3, \'pending\', ?4, ?5, ?6, ?7, ?8, ?9)',
      kid, ujId, g.id, emailEgy ? 1 : 0, telEgy ? 1 : 0, nevKulcs(nev) && nevKulcs(nev) === nevKulcs(g.name) ? 1 : 0, ok, jsonIr(g.therapist_id ? [g.therapist_id] : []), now));
    ut.push(auditStmt(db, { action: 'merge.request_created', resource: 'identity_merge_request', resourceId: kid, guestId: g.id, detail: { ok }, now }));
  }
  try { await tranzakcio(db, ut); } catch (e) {
    if (!_ujra && korlatHiba(e)) return vendegAzonosit(db, { account, externalGuestId, nev, email, telefon, now }, true);   // verseny: a masik hivas mar letrehozta
    throw e;
  }
  return { guestId: ujId, identityId: identId, eredmeny: 'uj_vendeg', mergeRequestIds: kerIdk };
}

/** kereses a belso UI-hoz: e-mail / telefon / nev (a nev itt CSAK keresesre jo, osszevonasra nem) */
export async function kereses(db, { q, limit = 25 }) {
  const s = String(q ?? '').trim();
  if (s.length < 2) return [];
  const em = normEmail(s), tel = normTelefon(s);
  if (em || tel) return mind(db, 'SELECT id, name, email, phone, status FROM guest WHERE status = \'active\' AND (email = ?1 OR phone = ?2) LIMIT ?3', em, tel, limit);
  const like = `%${s.toLowerCase()}%`;
  return mind(db, 'SELECT id, name, email, phone, status FROM guest WHERE status = \'active\' AND lower(name) LIKE ?1 ORDER BY name LIMIT ?2', like, limit);
}

/**
 * E-mailcim valtoztatas (kezelo / recepcio): a megosztott kep-linkek jogosultsaga azonnal ervenytelenedik (ujra-ellenorzes kotelezo),
 * az uj cim ellenorizetlen (email_verified = 0) amig a vendeg meg nem erositi.
 */
export async function emailValtoztat(db, { guestId, ujEmail, staffId, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'guest_basic', { guestId, now });
  const em = normEmail(ujEmail);
  if (!em) throw new CrmHiba('ERVENYTELEN_EMAIL', 'ervenytelen e-mail', 400);
  const g = await vendeg(db, guestId);
  if (!g || g.status !== 'active') throw new CrmHiba('NINCS_VENDEG', 'nincs aktiv vendeg', 404);
  if (g.email === em) return { valtozott: false };
  await tranzakcio(db, [
    keszit(db, 'UPDATE guest SET email = ?2, email_verified = 0, updated_at = ?3 WHERE id = ?1', guestId, em, now),
    keszit(db, 'UPDATE share_grant SET revoked_at = ?2, revoke_reason = \'email_changed\' WHERE guest_id = ?1 AND revoked_at IS NULL', guestId, now),
    auditStmt(db, { staffId, action: 'guest.email_changed', resource: 'guest', resourceId: guestId, guestId, detail: { grants_revoked: true }, now }),
  ]);
  return { valtozott: true };
}

/** a vendeg elerhetosegenek ellenorzottsag-jelzese (pl. a vendeg visszaigazolta) */
export async function elerhetosegEllenorzott(db, { guestId, email, telefon, staffId = null, now = most() }) {
  const sets = [], p = [guestId];
  if (email !== undefined) { p.push(email ? 1 : 0); sets.push(`email_verified = ?${p.length}`); }
  if (telefon !== undefined) { p.push(telefon ? 1 : 0); sets.push(`phone_verified = ?${p.length}`); }
  if (!sets.length) return;
  p.push(now); sets.push(`updated_at = ?${p.length}`);
  await tranzakcio(db, [keszit(db, `UPDATE guest SET ${sets.join(', ')} WHERE id = ?1`, ...p), auditStmt(db, { staffId, action: 'guest.contact_verified', resource: 'guest', resourceId: guestId, guestId, now })]);
}
