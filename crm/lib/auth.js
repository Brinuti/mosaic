// Belepes es munkamenet a belso CRM-hez (jelszo nincs): e-mailes 6 jegyu egyszeri kod + `crm_sess` munkamenet-suti.
//
//  - kod: kriptografiailag veletlen, CSAK a hash-e tarolodik (login_otp), 10 perc, EGYSZER hasznalhato, hibas probak szamlalva (max 5 / kod),
//    e-mailenkent es IP-nkent rate limit; a kod-keres valasza MINDIG azonos (nem arulja el, hogy a cim letezik-e)
//  - munkamenet-token: veletlen, csak a hash tarolodik (session), idle- es abszolut idokorlat; a CSRF-token a session-tokenbol szarmazik
//  - CRM_ADMIN_EMAILS: a felsorolt cimek az elso belepeskor automatikusan munkatarsat valnak (admin + salon_manager)
//  - demo-belepes (POST /auth/demo): csak env.CRM_DEMO === '1' ES nem eles hoszt (a hoszt-ellenorzes az api.js-ben)
// Platformfuggetlen: csak a db-felulet, a Web Crypto es az injektalt kuldo. Szemelyes adat (e-mail, kod) a naploba NEM kerul.
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio, valtozas, sha256, ujToken, normEmail } from './db.js';
import { auditStmt } from './audit.js';
import { SZEREPKOROK } from './constants.js';
import { ApiHiba, csrfTokenSessionbol, egyenlo, limit } from './http.js';

export const OTP_ERVENYESSEG = 10 * 60;        // 10 perc
export const OTP_MAX_PROBA = 5;                // kodonkent
export const SESSION_IDLE = 30 * 60;           // 30 perc inaktivitas
export const SESSION_ABS = 12 * 3600;          // 12 ora abszolut
export const KOD_KER_LIMIT_EMAIL = { ablak: 3600, max: 5 };
export const KOD_KER_LIMIT_IP = { ablak: 3600, max: 20 };
export const KOD_ELLENORIZ_LIMIT_EMAIL = { ablak: 900, max: 10 };
export const KOD_ELLENORIZ_LIMIT_IP = { ablak: 900, max: 40 };
export const DEMO_DOMAIN = 'demo.invalid';
export const DEMO_LIMIT_IP = { ablak: 3600, max: 60 };
const SESSION_FRISSITES_KOZ = 30;              // last_seen_at frissites legfeljebb ennyi masodpercenkent

export const ALTALANOS_KOD_KER_VALASZ = Object.freeze({ ok: true, uzenet: 'Ha az e-mail-cím engedélyezett, elküldtük a belépési kódot.' });
const KOD_HIBA = () => new ApiHiba('KOD_ERVENYTELEN', 'Hibás vagy lejárt kód.', 401);

/** CRM_ADMIN_EMAILS (vesszovel / szokozzel / pontosvesszovel elvalasztva) -> normalizalt cimek */
export function adminEmailek(env) {
  return String(env?.CRM_ADMIN_EMAILS || '').split(/[\s,;]+/).map((x) => normEmail(x)).filter(Boolean);
}
const pepper = (env) => String(env?.CRM_SO || 'crm');
const kodHash = (env, email, kod) => sha256(`otp|${pepper(env)}|${email}|${kod}`);

/** 000000..999999, torzitasmentesen (elutasito mintavetel) */
export function hatJegyuKod() {
  const b = new Uint32Array(1);
  const hatar = Math.floor(4294967296 / 1000000) * 1000000;
  do { crypto.getRandomValues(b); } while (b[0] >= hatar);
  return String(b[0] % 1000000).padStart(6, '0');
}

export async function felhasznalo(db, staffId) {
  const u = await elso(db, 'SELECT id, name, email FROM staff_user WHERE id = ?1 AND active = 1', staffId);
  if (!u) return null;
  const sz = await mind(db, 'SELECT role_id FROM staff_role WHERE staff_id = ?1 ORDER BY role_id', staffId);
  return { id: u.id, nev: u.name, email: u.email, szerepek: sz.map((r) => r.role_id) };
}

async function munkatarsEmailre(db, email) {
  return elso(db, 'SELECT id, active FROM staff_user WHERE email = ?1', email);
}

/** az elso admin / szalonvezeto felvetele a CRM_ADMIN_EMAILS alapjan (csak ha meg nincs ilyen munkatars) */
async function adminFelvesz(db, email, now) {
  const nev = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase()) || 'Admin';
  const id = uuid();
  await tranzakcio(db, [
    keszit(db, 'INSERT OR IGNORE INTO staff_user (id, email, name, active, created_at) VALUES (?1, ?2, ?3, 1, ?4)', id, email, nev, now),
    keszit(db, 'INSERT OR IGNORE INTO staff_role (staff_id, role_id, granted_by, granted_at) SELECT id, ?2, \'CRM_ADMIN_EMAILS\', ?3 FROM staff_user WHERE email = ?1 AND id = ?4', email, 'admin', now, id),
    keszit(db, 'INSERT OR IGNORE INTO staff_role (staff_id, role_id, granted_by, granted_at) SELECT id, ?2, \'CRM_ADMIN_EMAILS\', ?3 FROM staff_user WHERE email = ?1 AND id = ?4', email, 'salon_manager', now, id),
    auditStmt(db, { action: 'staff.bootstrap_admin', resource: 'staff_user', resourceId: id, detail: { forras: 'CRM_ADMIN_EMAILS' }, now, ha: { sql: 'SELECT 1 FROM staff_user WHERE id = ?', params: [id] } }),
  ]);
  return munkatarsEmailre(db, email);
}

// ---- kod keres ----------------------------------------------------------------------------------------------------------------------------
/**
 * Belepesi kod kerese. A VALASZ MINDIG azonos (ALTALANOS_KOD_KER_VALASZ), akar letezik a cim, akar nem. A rate limit a kereseket szamolja
 * (nem a letezest), ezert a 429 sem arul el semmit.
 * Visszaad: { valasz, kuldes: Promise|null, demoKod }. A `kuldo` ({to, targy, html, szoveg}) injektalt; null = nincs kuldo (DRY): ilyenkor a kod
 * csak a `demoKod`-ban adhato vissza, es CSAK ha demo === true (a hivo allitja be: CRM_DEMO es nem eles hoszt).
 */
export async function kodKer(db, { email, ipHash = null, env = {}, kuldo = null, demo = false, now = most() }) {
  const em = normEmail(email);
  if (!em) throw new ApiHiba('ERVENYTELEN_EMAIL', 'Érvénytelen e-mail-cím.', 422);
  const emHash = await sha256(`otpreq|${pepper(env)}|${em}`);
  if (!(await limit(db, `otp:e:${emHash}`, KOD_KER_LIMIT_EMAIL, now)) || !(await limit(db, `otp:i:${ipHash || 'noip'}`, KOD_KER_LIMIT_IP, now))) {
    throw new ApiHiba('TUL_SOK_KERES', 'Túl sok kérés, próbáld meg később.', 429);
  }
  const munkatars = await munkatarsEmailre(db, em);
  const jogosult = !demoMunkatarsE({ email: em }) && ((munkatars && munkatars.active === 1) || (!munkatars && adminEmailek(env).includes(em)));
  const kod = hatJegyuKod();
  const hash = await kodHash(env, em, kod);   // a nemletezo cimnel is lefut (kiegyenlitett munka)
  let kuldes = null, demoKod = null;
  if (jogosult) {
    await tranzakcio(db, [
      keszit(db, 'UPDATE login_otp SET used_at = ?2 WHERE email = ?1 AND used_at IS NULL', em, now),   // a korabbi kod ervenytelen
      keszit(db, 'INSERT INTO login_otp (id, email, code_hash, created_at, expires_at, attempts, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)', uuid(), em, hash, now, now + OTP_ERVENYESSEG, ipHash),
    ]);
    if (typeof kuldo === 'function') {
      kuldes = Promise.resolve().then(() => kuldo({
        to: em, targy: 'MOSAIC CRM – belépési kód',
        szoveg: `A belépési kódod: ${kod}\nA kód ${OTP_ERVENYESSEG / 60} percig érvényes és egyszer használható.\nHa nem te kérted, hagyd figyelmen kívül ezt a levelet.`,
        html: `<p>A belépési kódod:</p><p style="font-size:28px;letter-spacing:6px;font-weight:600">${kod}</p><p>A kód ${OTP_ERVENYESSEG / 60} percig érvényes és egyszer használható.<br>Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.</p>`,
      })).catch((e) => { console.error('crm: a belepesi kod kuldese sikertelen:', e?.name || 'hiba'); });
    } else if (demo === true) {
      demoKod = kod;
    }
  }
  await auditStmt(db, { staffId: jogosult ? munkatars?.id ?? null : null, action: 'auth.code_requested', resource: 'login_otp', result: 'ok', ipHash, now }).run();
  return { valasz: ALTALANOS_KOD_KER_VALASZ, kuldes, demoKod };
}

// ---- kod ellenorzes -> munkamenet -----------------------------------------------------------------------------------------------------------
async function ujMunkamenet(db, { staffId, ipHash, uaHash = null, now }) {
  const token = ujToken(32), id = uuid();
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO session (id, token_hash, staff_id, created_at, expires_at, last_seen_at, ip_hash, ua_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?4, ?6, ?7)', id, await sha256(token), staffId, now, now + SESSION_ABS, ipHash, uaHash),
    keszit(db, 'UPDATE staff_user SET last_login_at = ?2 WHERE id = ?1', staffId, now),
    auditStmt(db, { staffId, action: 'auth.login', resource: 'session', resourceId: id, ipHash, now }),
  ]);
  return { token, csrf: await csrfTokenSessionbol(token), sessionId: id, felhasznalo: await felhasznalo(db, staffId) };
}

export async function kodEllenoriz(db, { email, kod, ipHash = null, uaHash = null, env = {}, now = most() }) {
  const em = normEmail(email);
  const kodSzoveg = String(kod ?? '').replace(/\s+/g, '');
  const emHash = await sha256(`otpchk|${pepper(env)}|${em || String(email ?? '')}`);
  // a szamlalo minden probat szamol (letezestol fuggetlenul): a zarolas sem arul el semmit
  if (!(await limit(db, `otpchk:e:${emHash}`, KOD_ELLENORIZ_LIMIT_EMAIL, now)) || !(await limit(db, `otpchk:i:${ipHash || 'noip'}`, KOD_ELLENORIZ_LIMIT_IP, now))) {
    await auditStmt(db, { action: 'auth.login_locked', resource: 'login_otp', result: 'denied', ipHash, now }).run();
    throw new ApiHiba('ZAROLT', 'Túl sok sikertelen próbálkozás, várj néhány percet.', 429);
  }
  const elutasit = async (ok) => { await auditStmt(db, { action: 'auth.login_failed', resource: 'login_otp', result: 'denied', detail: { ok }, ipHash, now }).run(); throw KOD_HIBA(); };
  if (!em || !/^\d{6}$/.test(kodSzoveg)) return elutasit('formatum');
  const otp = await elso(db, 'SELECT * FROM login_otp WHERE email = ?1 AND used_at IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 1', em);
  if (!otp || now >= otp.expires_at) return elutasit('nincs_ervenyes_kod');
  // a proba atomikusan szamolodik ELOBB (parhuzamos tippelgetes sem kerulheti meg a korlatot)
  const probaR = await keszit(db, 'UPDATE login_otp SET attempts = attempts + 1 WHERE id = ?1 AND used_at IS NULL AND attempts < ?2', otp.id, OTP_MAX_PROBA).run();
  if (valtozas(probaR) !== 1) return elutasit('proba_limit');
  if (!egyenlo(await kodHash(env, em, kodSzoveg), otp.code_hash)) return elutasit('hibas_kod');
  const claim = await keszit(db, 'UPDATE login_otp SET used_at = ?2 WHERE id = ?1 AND used_at IS NULL AND expires_at > ?2', otp.id, now).run();
  if (valtozas(claim) !== 1) return elutasit('mar_felhasznalva');
  let u = await munkatarsEmailre(db, em);
  if (!u && adminEmailek(env).includes(em)) u = await adminFelvesz(db, em, now);
  if (!u || u.active !== 1) return elutasit('nem_munkatars');
  return ujMunkamenet(db, { staffId: u.id, ipHash, uaHash, now });
}

// ---- demo ---------------------------------------------------------------------------------------------------------------------------------
/** demo-belepes egy szerepkorrel (a feltetelek - CRM_DEMO, nem eles hoszt - ellenorzese a hivo dolga). A demo-munkatars e-mailje @demo.invalid. */
export async function demoBelep(db, { szerep, ipHash = null, now = most() }) {
  if (!SZEREPKOROK.includes(szerep)) throw new ApiHiba('ISMERETLEN_SZEREP', `A szerep: ${SZEREPKOROK.join(' | ')}.`, 422);
  if (!(await limit(db, `demo:i:${ipHash || 'noip'}`, DEMO_LIMIT_IP, now))) throw new ApiHiba('TUL_SOK_KERES', 'Túl sok kérés, próbáld meg később.', 429);
  // ha a demo.js betoltotte a demo-munkatarsakat, ezek kozul lepunk be (a demo-vendegek a sajat kezeloikhez tartoznak), kulonben sajat demo-fiok
  let u = await elso(db, 'SELECT id, email, active FROM staff_user WHERE id = ?1', `demo-staff-${szerep}-1`);
  if (u && !(await elso(db, 'SELECT 1 AS x FROM staff_role WHERE staff_id = ?1 AND role_id = ?2', u.id, szerep))) u = null;
  const email = `demo-${szerep.replace(/_/g, '-')}@${DEMO_DOMAIN}`;
  if (!u) u = await munkatarsEmailre(db, email);
  if (!u) {
    const id = uuid();
    await tranzakcio(db, [
      keszit(db, 'INSERT OR IGNORE INTO staff_user (id, email, name, active, created_at) VALUES (?1, ?2, ?3, 1, ?4)', id, email, `Demo ${szerep}`, now),
      keszit(db, 'INSERT OR IGNORE INTO staff_role (staff_id, role_id, granted_by, granted_at) SELECT id, ?2, \'demo\', ?3 FROM staff_user WHERE email = ?1', email, szerep, now),
    ]);
    u = await munkatarsEmailre(db, email);
  }
  if (!u || u.active !== 1) throw new CrmHiba('DEMO_NEM_ELERHETO', 'A demo-hozzáférés nem érhető el.', 404);
  await auditStmt(db, { staffId: u.id, action: 'auth.demo_login', resource: 'session', detail: { szerep }, ipHash, now }).run();
  return ujMunkamenet(db, { staffId: u.id, ipHash, now });
}
/** demo-munkatars: a sajat @demo.invalid fiok vagy a demo.js (demo-staff-*, @example.invalid) munkatarsai - eles hoszton / demo nelkul a munkamenetuk hasztalan */
export const demoMunkatarsE = ({ id = '', email = '' } = {}) => /@(demo|example)\.invalid$/.test(String(email)) || String(id).startsWith('demo-staff-');

// ---- munkamenet-ellenorzes, kilepes ------------------------------------------------------------------------------------------------------
/** a sutiban kapott token -> { sessionId, staffId, csrf, email } vagy null (ismeretlen / visszavont / lejart / inaktiv munkatars) */
export async function munkamenet(db, token, { now = most() } = {}) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const s = await elso(db, `SELECT s.id, s.staff_id, s.expires_at, s.last_seen_at, s.created_at, u.email FROM session s JOIN staff_user u ON u.id = s.staff_id
    WHERE s.token_hash = ?1 AND s.revoked_at IS NULL AND u.active = 1`, await sha256(token));
  if (!s) return null;
  const utolso = s.last_seen_at ?? s.created_at;
  if (now >= s.expires_at || now - utolso >= SESSION_IDLE) {
    await keszit(db, 'UPDATE session SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL', s.id, now).run();   // lejart: vegleg ervenytelen
    return null;
  }
  if (now - utolso >= SESSION_FRISSITES_KOZ) await keszit(db, 'UPDATE session SET last_seen_at = ?2 WHERE id = ?1', s.id, now).run();
  return { sessionId: s.id, staffId: s.staff_id, email: s.email, csrf: await csrfTokenSessionbol(token) };
}

export async function kilep(db, token, { now = most(), ipHash = null } = {}) {
  if (!token) return false;
  const s = await elso(db, 'SELECT id, staff_id FROM session WHERE token_hash = ?1', await sha256(token));
  if (!s) return false;
  await tranzakcio(db, [
    keszit(db, 'UPDATE session SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL', s.id, now),
    auditStmt(db, { staffId: s.staff_id, action: 'auth.logout', resource: 'session', resourceId: s.id, ipHash, now }),
  ]);
  return true;
}

/** egy munkatars osszes munkamenetenek visszavonasa (deaktivalas, szerepkor-valtozas) */
export const munkamenetekVisszavon = (db, staffId, now = most()) => keszit(db, 'UPDATE session SET revoked_at = ?2 WHERE staff_id = ?1 AND revoked_at IS NULL', staffId, now);
