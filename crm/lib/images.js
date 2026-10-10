// Hajkamera-kepek (camera_image), osszehasonlitas (image_comparison) es megosztas (share_grant). NINCS vendegportal.
//  - kep CSAK az 1 / 3 / 5 / 10. kezelesen vehet fel; a bajtok a `tarolo` feluletre kerulnek (put/get/del), az adatbazisban csak a storage_key van
//  - a vendeg a kepeket veletlen tokenes linken kapja: CSAK a SHA-256 hash tarolodik, 30 nap, vendegszintu ACL (A vendeg tokenje B kepere 404 + audit)
//  - lejart (vagy osszevonas / e-mailvaltozas miatt visszavont) link: uj link CSAK a regisztralt e-mail ellenorzesevel (egyszer hasznalhato token);
//    a valasz SOHA nem arulja el, hogy az e-mail letezik-e; rate limit
//  - a link fogadasakor a hivo Cache-Control: no-store es Referrer-Policy: no-referrer fejleceket tegyen a valaszra (FEJLECEK)
// tarolo: { put(kulcs, bajtok, {mime, meret}), get(kulcs) -> {bajtok, mime}|null, del(kulcs) } - a hivo adja at.
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, valtozas, korlatHiba, sha256, ujToken, normEmail } from './db.js';
import { KAMERA_KOTELEZO_ALKALMAK, KEP_MIME, KEP_MAX_BAJT, LINK_ERVENYESSEG, ELLENORZO_TOKEN_ERVENYESSEG, UJ_LINK_KERES_LIMIT, TOKEN_BAJT } from './constants.js';
import { auditStmt } from './audit.js';
import { outboxStmt } from './outbox.js';
import { megkoveteli } from './rbac.js';
import { vegleges } from './guest.js';
import { mondatSzam } from './plan.js';
import { ERTEKELES_MONDAT } from './constants.js';

export const FEJLECEK = Object.freeze({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
const KITERJESZTES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** tartalom-ellenorzes: a fajl elejenek (magic bytes) egyeznie kell a deklaralt MIME-mal */
export function tartalomEgyezik(bajtok, mime) {
  const b = bajtok instanceof Uint8Array ? bajtok : new Uint8Array(bajtok || []);
  if (mime === 'image/jpeg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mime === 'image/webp') return b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
  return false;
}
async function bajtHash(bajtok) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bajtok));
  return [...h].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ---- kepek ------------------------------------------------------------------------------------------------------------------------------------
/** kep felvetele egy IGAZOLT kezeleshez. Csak az 1/3/5/10. alkalom; MIME + tartalom + meret ellenorzes; a storage_key szerver-oldali (path traversal ellen). */
export async function kepFeltolt(db, { sessionId, staffId, bajtok, mime, capturePoint = 'fo', tarolo, csere = false, now = most() }) {
  const s = await elso(db, 'SELECT * FROM treatment_session WHERE id = ?1', sessionId);
  if (!s) throw new CrmHiba('NINCS_KEZELES', 'nincs ilyen (igazolt) kezeles', 404);
  await megkoveteli(db, staffId, 'write', 'camera_image', { guestId: s.guest_id, resourceId: sessionId, now });
  if (!KAMERA_KOTELEZO_ALKALMAK.includes(s.treatment_index)) throw new CrmHiba('NEM_KAMERA_ALKALOM', `a ${s.treatment_index}. kezelesen nem keszul kotelezo hajkamera-felvetel`, 409);
  if (!KEP_MIME.includes(mime)) throw new CrmHiba('ERVENYTELEN_MIME', 'csak jpeg / png / webp', 400);
  if (!bajtok?.length || bajtok.length > KEP_MAX_BAJT) throw new CrmHiba('ERVENYTELEN_MERET', 'ures vagy tul nagy fajl', 400);
  if (!tartalomEgyezik(bajtok, mime)) throw new CrmHiba('ERVENYTELEN_TARTALOM', 'a fajl tartalma nem egyezik a tipussal', 400);
  if (!/^[a-z0-9_-]{1,40}$/.test(capturePoint)) throw new CrmHiba('ERVENYTELEN_PONT', 'a rogzitesi pont: a-z0-9_-', 400);
  const id = uuid();
  const kulcs = `kepek/${s.guest_id}/${sessionId}/${id}.${KITERJESZTES[mime]}`;
  // csere: a regi kep (ugyanaz az alkalom + rogzitesi pont) ugyanabban a tranzakcioban torlodik, igy nincs "kep nelkuli" pillanat
  const regi = csere ? await elso(db, 'SELECT id, storage_key FROM camera_image WHERE session_id = ?1 AND capture_point = ?2 AND deleted_at IS NULL', sessionId, capturePoint) : null;
  await tarolo.put(kulcs, bajtok, { mime, meret: bajtok.length });
  try {
    await tranzakcio(db, [
      ...(regi ? kepTorolStmtek(db, { imageId: regi.id, guestId: s.guest_id, staffId, ok: 'csere', now }) : []),
      keszit(db, 'INSERT INTO camera_image (id, guest_id, session_id, treatment_index, capture_point, storage_key, mime, size_bytes, sha256, taken_by, taken_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)',
        id, s.guest_id, sessionId, s.treatment_index, capturePoint, kulcs, mime, bajtok.length, await bajtHash(bajtok), staffId, now),
      auditStmt(db, { staffId, action: 'image.upload', resource: 'camera_image', resourceId: id, guestId: s.guest_id, detail: { alkalom: s.treatment_index, meret: bajtok.length }, now }),
    ]);
  } catch (e) {
    await tarolo.del(kulcs);
    if (korlatHiba(e)) throw new CrmHiba('MAR_VAN_KEP', 'ehhez az alkalomhoz es rogzitesi ponthoz mar van kep', 409);
    throw e;
  }
  if (regi) { try { await tarolo.del(regi.storage_key); } catch { /* a regi bajtok torlese ujraprobalhato; az adatbazis mar nem hivatkozik rajuk */ } }
  return { imageId: id, storageKey: kulcs, treatmentIndex: s.treatment_index, felulirt: regi ? regi.id : null };
}

/** a kep torlesenek utasitasai: soft delete (a rogzitesi pont felszabadul az ujrafeltolteshez), az erintett vendeg-linkek visszavonasa, audit */
function kepTorolStmtek(db, { imageId, guestId, staffId, ok, now }) {
  return [
    keszit(db, "UPDATE camera_image SET deleted_at = ?2, capture_point = capture_point || '#torolt-' || id WHERE id = ?1 AND deleted_at IS NULL", imageId, now),
    keszit(db, "UPDATE share_grant SET revoked_at = ?2, revoke_reason = 'image_deleted' WHERE revoked_at IS NULL AND comparison_id IN (SELECT id FROM image_comparison WHERE image_a_id = ?1 OR image_b_id = ?1)", imageId, now),
    auditStmt(db, { staffId, action: 'image.delete', resource: 'camera_image', resourceId: imageId, guestId, detail: { ok }, now }),
  ];
}

/** kep torlese (rossz / hibas felvetel): csak kezelo / szakmai vezeto (camera_image.write); a bajtok is torlodnek a taroloból, a vendeg-linkek a kepre visszavonodnak */
export async function kepTorol(db, { imageId, staffId, tarolo, ok = 'torles', now = most() }) {
  const k = await elso(db, 'SELECT id, guest_id, storage_key FROM camera_image WHERE id = ?1 AND deleted_at IS NULL', imageId);
  if (!k) throw new CrmHiba('NINCS_KEP', 'nincs ilyen kep', 404);
  await megkoveteli(db, staffId, 'write', 'camera_image', { guestId: k.guest_id, resourceId: imageId, now });
  await tranzakcio(db, kepTorolStmtek(db, { imageId, guestId: k.guest_id, staffId, ok, now }));
  try { await tarolo.del(k.storage_key); } catch { /* az adatbazis mar nem hivatkozik ra */ }
  return { torolve: true };
}

/** kep olvasasa MUNKATARSNAK: csak kezelo / szakmai vezeto; a recepcio megtagadva + audit (S01). Minden hozzaferes naplozott. */
export async function kepOlvas(db, { imageId, staffId, tarolo, ipHash = null, now = most() }) {
  const k = await elso(db, 'SELECT * FROM camera_image WHERE id = ?1 AND deleted_at IS NULL', imageId);
  if (!k) throw new CrmHiba('NINCS_KEP', 'nincs ilyen kep', 404);
  await megkoveteli(db, staffId, 'read', 'camera_image', { guestId: k.guest_id, resourceId: imageId, ipHash, now });
  await auditStmt(db, { staffId, action: 'image.read', resource: 'camera_image', resourceId: imageId, guestId: k.guest_id, ipHash, now }).run();
  const f = await tarolo.get(k.storage_key);
  if (!f) throw new CrmHiba('HIANYZO_FAJL', 'a fajl nem talalhato a taroloban', 500);
  return { ...f, fejlecek: FEJLECEK };
}

export const kepek = (db, guestId) => mind(db, 'SELECT id, session_id, treatment_index, capture_point, mime, taken_at, taken_by FROM camera_image WHERE guest_id = ?1 AND deleted_at IS NULL ORDER BY treatment_index, capture_point', guestId);

// ---- osszehasonlitas -----------------------------------------------------------------------------------------------------------------------
/** ket kep osszehasonlitasa (A = korabbi, B = kesobbi alkalom, UGYANAZ a rogzitesi pont). A 2-3 mondatos ertekeles a veglegesiteskor kotelezo. */
export async function osszehasonlit(db, { imageAId, imageBId, staffId, note = null, now = most() }) {
  const [a, b] = await Promise.all([elso(db, 'SELECT * FROM camera_image WHERE id = ?1', imageAId), elso(db, 'SELECT * FROM camera_image WHERE id = ?1', imageBId)]);
  if (!a || !b) throw new CrmHiba('NINCS_KEP', 'ismeretlen kep', 404);
  await megkoveteli(db, staffId, 'write', 'image_comparison', { guestId: a.guest_id, now });
  if (a.guest_id !== b.guest_id) throw new CrmHiba('KULONBOZO_VENDEG', 'az osszehasonlitott kepek ugyanazon vendegehez tartozzanak', 400);
  if (a.treatment_index >= b.treatment_index) throw new CrmHiba('SORREND', 'az A kep a korabbi alkalom kepe kell legyen', 400);
  if (a.capture_point !== b.capture_point) throw new CrmHiba('ELTERO_ROGZITESI_PONT', 'az osszehasonlitashoz azonos rogzitesi pont kell', 400);
  const id = uuid();
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO image_comparison (id, guest_id, image_a_id, image_b_id, note, status, author_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, \'draft\', ?6, ?7)', id, a.guest_id, imageAId, imageBId, note, staffId, now),
    auditStmt(db, { staffId, action: 'comparison.create', resource: 'image_comparison', resourceId: id, guestId: a.guest_id, detail: { a: a.treatment_index, b: b.treatment_index }, now }),
  ]);
  return { comparisonId: id };
}

export async function osszehasonlitVeglegesit(db, { comparisonId, staffId, note = null, now = most() }) {
  const c = await elso(db, 'SELECT * FROM image_comparison WHERE id = ?1', comparisonId);
  if (!c) throw new CrmHiba('NINCS_OSSZEHASONLITAS', 'nincs ilyen osszehasonlitas', 404);
  await megkoveteli(db, staffId, 'write', 'image_comparison', { guestId: c.guest_id, resourceId: comparisonId, now });
  const szoveg = note ?? c.note;
  const n = mondatSzam(szoveg);
  if (n < ERTEKELES_MONDAT.min || n > ERTEKELES_MONDAT.max) throw new CrmHiba('MONDATSZAM', `a szemelyes ertekeles ${ERTEKELES_MONDAT.min}-${ERTEKELES_MONDAT.max} mondat`, 400);
  await tranzakcio(db, [
    keszit(db, 'UPDATE image_comparison SET note = ?2, status = \'final\', final_at = ?3 WHERE id = ?1', comparisonId, szoveg, now),
    auditStmt(db, { staffId, action: 'comparison.final', resource: 'image_comparison', resourceId: comparisonId, guestId: c.guest_id, now }),
  ]);
}

// ---- megosztas (share_grant) ------------------------------------------------------------------------------------------------------------
/**
 * 30 napos, veletlen tokenes link kiadasa a vendegnek. A plaintext token CSAK ebben a valaszban van; az adatbazisban a SHA-256 hash.
 * Feltetelek: vegleges osszehasonlitas + a kesobbi alkalom dokumentacioja legalabb therapist_final + a vendeg aktiv, ellenorzott e-mail.
 */
export async function linkKiad(db, { comparisonId, kiadta = 'system', now = most() }) {
  const c = await elso(db, 'SELECT c.*, b.session_id AS b_session FROM image_comparison c JOIN camera_image b ON b.id = c.image_b_id WHERE c.id = ?1', comparisonId);
  if (!c) throw new CrmHiba('NINCS_OSSZEHASONLITAS', 'nincs ilyen osszehasonlitas', 404);
  if (c.status !== 'final') throw new CrmHiba('NEM_VEGLEGES', 'az osszehasonlitas nincs veglegesitve', 409);
  const doku = await elso(db, 'SELECT status FROM treatment_plan WHERE session_id = ?1 AND kind IN (\'review\', \'closing\', \'plan\') ORDER BY created_at LIMIT 1', c.b_session);
  if (!doku || !['therapist_final', 'generated_pdf', 'sent'].includes(doku.status)) throw new CrmHiba('DOKUMENTACIO_HIANYOS', 'a szemelyes kep csak kesz kezeloi dokumentacioval kuldheto', 409);
  const gid = await vegleges(db, c.guest_id);
  const g = await elso(db, 'SELECT * FROM guest WHERE id = ?1', gid);
  if (!g || g.status !== 'active' || !g.email || !g.email_verified) throw new CrmHiba('CIMZETT_NEM_ELLENORZOTT', 'nincs ellenorzott cimzett', 409);
  return ujGrant(db, { guest: g, comparisonId, kiadta, renewedFrom: null, now });
}

async function ujGrant(db, { guest, comparisonId, kiadta, renewedFrom, now }) {
  const token = ujToken(TOKEN_BAJT), id = uuid(), lejar = now + LINK_ERVENYESSEG;
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO share_grant (id, guest_id, comparison_id, token_hash, email_at_issue, issued_at, expires_at, issued_by, renewed_from) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)', id, guest.id, comparisonId, await sha256(token), guest.email, now, lejar, kiadta, renewedFrom),
    auditStmt(db, { staffId: kiadta === 'system' ? null : kiadta, action: 'share.issued', resource: 'share_grant', resourceId: id, guestId: guest.id, detail: { comparison_id: comparisonId, lejar, megujitas: !!renewedFrom }, now }),
    outboxStmt(db, { tipus: 'share.link_issued', aggTipus: 'share_grant', aggId: id, guestId: guest.id, payload: { grant_id: id, comparison_id: comparisonId }, dedupeKey: `share.link_issued:${id}`, now }),
  ]);
  return { token, grantId: id, expiresAt: lejar, to: guest.email };
}

async function visszavonSql(db, grantId, ok, now) {
  return keszit(db, 'UPDATE share_grant SET revoked_at = ?2, revoke_reason = ?3 WHERE id = ?1 AND revoked_at IS NULL', grantId, now, ok).run();
}

/**
 * A vendeg elerese a tokenes linken (publikus vegpont mogott). Visszaad { ok, status, ... }:
 *  200 siker | 404 ismeretlen / visszavont / mas vendeg erintett (nem arulunk el semmit) | 410 lejart (ujLinkKerheto) | 403 reserved
 * Minden elutasitas auditalt (security_audit, result=denied). Merge / e-mailvaltozas utan a jogosultsag ujraellenorzodik.
 */
export async function hozzaferes(db, { token, comparisonId = null, imageId = null, tarolo = null, ipHash = null, now = most() }) {
  const tiltas = async (status, kod, grant, reszlet = {}) => {
    await auditStmt(db, { action: `share.${kod}`, resource: 'share_grant', resourceId: grant?.id ?? null, guestId: grant?.guest_id ?? null, result: 'denied', detail: { status, ...reszlet }, ipHash, now }).run();
    return { ok: false, status, kod, fejlecek: FEJLECEK, ...(status === 410 ? { ujLinkKerheto: true } : {}) };
  };
  const hash = await sha256(String(token ?? ''));
  const grant = await elso(db, 'SELECT * FROM share_grant WHERE token_hash = ?1', hash);
  if (!grant) return tiltas(404, 'ismeretlen_token', null);
  if (grant.revoked_at) return tiltas(404, 'visszavont', grant);
  if (now >= grant.expires_at) return tiltas(410, 'lejart', grant);
  // jogosultsag ujraellenorzes: a vendeg aktiv, nem osszevont, az e-mail cim nem valtozott a kiadas ota
  const g = await elso(db, 'SELECT * FROM guest WHERE id = ?1', grant.guest_id);
  if (!g || g.status !== 'active' || g.email !== grant.email_at_issue) {
    await visszavonSql(db, grant.id, g?.status === 'merged' ? 'merge' : 'email_changed', now);
    return tiltas(404, 'jogosultsag_megszunt', grant);
  }
  // vendegszintu ACL: a link csak a SAJAT osszehasonlitasra / kepeire szol
  const osszeh = await elso(db, 'SELECT * FROM image_comparison WHERE id = ?1', grant.comparison_id);
  if (comparisonId && comparisonId !== grant.comparison_id) return tiltas(404, 'cross_guest_denied', grant, { kert: 'comparison' });
  let kep = null;
  if (imageId) {
    kep = await elso(db, 'SELECT * FROM camera_image WHERE id = ?1 AND deleted_at IS NULL', imageId);
    if (!kep || kep.guest_id !== grant.guest_id || !osszeh || ![osszeh.image_a_id, osszeh.image_b_id].includes(imageId)) {
      return tiltas(404, 'cross_guest_denied', grant, { kert: 'image', letezik: !!kep });
    }
  }
  if (!osszeh || osszeh.guest_id !== grant.guest_id) return tiltas(404, 'cross_guest_denied', grant, { kert: 'comparison' });
  await tranzakcio(db, [
    keszit(db, 'UPDATE share_grant SET last_access_at = ?2, access_count = access_count + 1 WHERE id = ?1', grant.id, now),
    auditStmt(db, { action: 'share.access', resource: imageId ? 'camera_image' : 'image_comparison', resourceId: imageId || osszeh.id, guestId: grant.guest_id, ipHash, now }),
  ]);
  const kepLista = await mind(db, 'SELECT id, treatment_index, capture_point FROM camera_image WHERE id IN (?1, ?2) ORDER BY treatment_index', osszeh.image_a_id, osszeh.image_b_id);
  const ki = { ok: true, status: 200, fejlecek: FEJLECEK, osszehasonlitas: { id: osszeh.id, ertekeles: osszeh.note, kepek: kepLista }, lejar: grant.expires_at };
  if (kep && tarolo) { const f = await tarolo.get(kep.storage_key); ki.kep = f; }
  return ki;
}

/** visszavonas (kezelo / szakmai vezeto): egy grant vagy a vendeg osszes linkje */
export async function visszavon(db, { grantId = null, guestId = null, staffId, ok = 'staff', now = most() }) {
  await megkoveteli(db, staffId, 'revoke', 'share_grant', { guestId, resourceId: grantId, now });
  const [r] = await tranzakcio(db, [
    grantId
      ? keszit(db, 'UPDATE share_grant SET revoked_at = ?2, revoke_reason = \'staff\' WHERE id = ?1 AND revoked_at IS NULL', grantId, now)
      : keszit(db, 'UPDATE share_grant SET revoked_at = ?2, revoke_reason = \'staff\' WHERE guest_id = ?1 AND revoked_at IS NULL', guestId, now),
    auditStmt(db, { staffId, action: 'share.revoked', resource: 'share_grant', resourceId: grantId, guestId, detail: { ok }, now }),
  ]);
  return valtozas(r);
}

/** merge / e-mailvaltozas utani jogosultsag-ujraellenorzes: minden olyan link visszavonasa, amelynek vendege osszevont / cime valtozott */
export async function jogosultsagUjraellenorzes(db, { guestId, now = most() }) {
  const r = await keszit(db, `UPDATE share_grant SET revoked_at = ?2, revoke_reason = COALESCE(
      (SELECT CASE g.status WHEN 'merged' THEN 'merge' ELSE 'email_changed' END FROM guest g WHERE g.id = share_grant.guest_id), 'guest_gone')
    WHERE guest_id = ?1 AND revoked_at IS NULL AND NOT EXISTS (SELECT 1 FROM guest g WHERE g.id = share_grant.guest_id AND g.status = 'active' AND g.email = share_grant.email_at_issue)`, guestId, now).run();
  return valtozas(r);
}

// ---- uj link kerese (lejart link) ----------------------------------------------------------------------------------------------------------
async function limit(db, kulcs, { ablak, max }, now) {
  const kezd = Math.floor(now / ablak) * ablak;
  await keszit(db, 'INSERT INTO rate_limit (key, window_start, count) VALUES (?1, ?2, 1) ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1', kulcs, kezd).run();
  const r = await elso(db, 'SELECT count FROM rate_limit WHERE key = ?1 AND window_start = ?2', kulcs, kezd);
  return r.count <= max;
}
const ALTALANOS_VALASZ = Object.freeze({ ok: true, uzenet: 'Ha az e-mail-cim nalunk regisztralt, elkuldtuk az ellenorzo hivatkozast.' });

/**
 * "Kérek új linket": a lejart (vagy visszavont) link tokenje + a vendeg altal megadott e-mail. A VALASZ MINDIG UGYANAZ (nem szivarog, hogy az e-mail
 * letezik-e). `belso` (a hivonak, NEM a HTTP-valaszba): ha az e-mail a nyilvantartotthoz tartozik, itt van a kuldendo ellenorzo token.
 * Rate limit: e-mailenkent es IP-nkent. Munkatars altal visszavont link nem ujithato.
 */
export async function ujLinkKeres(db, { token, email, ipHash = null, now = most() }) {
  const em = normEmail(email);
  const emHash = await sha256(`email|${em || String(email ?? '')}`);
  const eppen = (await limit(db, `renew:e:${emHash}`, UJ_LINK_KERES_LIMIT, now)) && (ipHash ? await limit(db, `renew:i:${ipHash}`, UJ_LINK_KERES_LIMIT, now) : true);
  if (!eppen) {
    await auditStmt(db, { action: 'share.renew_rate_limited', resource: 'share_grant', result: 'denied', ipHash, now }).run();
    return { valasz: ALTALANOS_VALASZ, belso: null };
  }
  const grant = await elso(db, 'SELECT * FROM share_grant WHERE token_hash = ?1', await sha256(String(token ?? '')));
  let belso = null;
  if (grant && grant.revoke_reason !== 'staff' && em) {
    const gid = await vegleges(db, grant.guest_id);
    const g = gid ? await elso(db, 'SELECT * FROM guest WHERE id = ?1', gid) : null;
    const lejart = now >= grant.expires_at || !!grant.revoked_at;
    if (g && g.status === 'active' && g.email && g.email === em && lejart) {
      const vt = ujToken(TOKEN_BAJT), vid = uuid();
      await tranzakcio(db, [
        keszit(db, 'INSERT INTO share_verification (id, guest_id, origin_grant_id, token_hash, created_at, expires_at, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)', vid, g.id, grant.id, await sha256(vt), now, now + ELLENORZO_TOKEN_ERVENYESSEG, ipHash),
        outboxStmt(db, { tipus: 'share.verification', aggTipus: 'share_verification', aggId: vid, guestId: g.id, payload: { verification_id: vid }, dedupeKey: `share.verification:${vid}`, now }),
        auditStmt(db, { action: 'share.renew_requested', resource: 'share_verification', resourceId: vid, guestId: g.id, ipHash, now }),
      ]);
      belso = { to: g.email, verificationToken: vt, verificationId: vid, guestId: g.id };
    }
  }
  if (!belso) await auditStmt(db, { action: 'share.renew_no_match', resource: 'share_grant', resourceId: grant?.id ?? null, result: 'denied', ipHash, now }).run();
  return { valasz: ALTALANOS_VALASZ, belso };
}

/** az e-mailben kapott ellenorzo token beváltása: EGYSZER hasznalhato, rovid eletu; siker -> uj 30 napos link */
export async function ujLinkEllenoriz(db, { verifikaciosToken, ipHash = null, now = most() }) {
  const hash = await sha256(String(verifikaciosToken ?? ''));
  const v = await elso(db, 'SELECT * FROM share_verification WHERE token_hash = ?1', hash);
  const elutasit = async () => { await auditStmt(db, { action: 'share.verify_failed', resource: 'share_verification', resourceId: v?.id ?? null, guestId: v?.guest_id ?? null, result: 'denied', ipHash, now }).run(); return { ok: false, status: 404, fejlecek: FEJLECEK }; };
  if (!v || v.used_at || now >= v.expires_at) return elutasit();
  const [r] = await tranzakcio(db, [keszit(db, 'UPDATE share_verification SET used_at = ?2 WHERE id = ?1 AND used_at IS NULL', v.id, now)]);
  if (valtozas(r) !== 1) return elutasit();   // masik beváltás elobb ment
  const origin = await elso(db, 'SELECT * FROM share_grant WHERE id = ?1', v.origin_grant_id);
  const gid = await vegleges(db, v.guest_id);
  const g = gid ? await elso(db, 'SELECT * FROM guest WHERE id = ?1', gid) : null;
  const osszeh = origin ? await elso(db, 'SELECT * FROM image_comparison WHERE id = ?1', origin.comparison_id) : null;
  if (!g || g.status !== 'active' || !osszeh || osszeh.guest_id !== g.id) return elutasit();
  const uj = await ujGrant(db, { guest: g, comparisonId: osszeh.id, kiadta: 'system', renewedFrom: origin.id, now });
  return { ok: true, status: 200, token: uj.token, grantId: uj.grantId, expiresAt: uj.expiresAt, comparisonId: osszeh.id, fejlecek: FEJLECEK };
}
