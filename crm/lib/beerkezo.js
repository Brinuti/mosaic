// Kep-beerkezo: vendeg nelkuli, rovid eletu kepek (tablet -> kezelo masik eszkozon). Hozzarendeles: a kep a kivalasztott kezeleshez kerul (images.kepFeltolt), a beerkezobol torlodik.
// A nem hozzarendelt kep BEERKEZO_ORAK ora mulva automatikusan torlodik (egeszsegi adat: nem maradhat gazdatlanul).
import { CrmHiba, uuid, most, elso, mind, keszit, tranzakcio } from './db.js';
import { KEP_MIME, KEP_MAX_BAJT } from './constants.js';
import { auditStmt } from './audit.js';
import { megkoveteli } from './rbac.js';
import { tartalomEgyezik, kepFeltolt, FEJLECEK } from './images.js';

export const BEERKEZO_ORAK = 6;
export const BEERKEZO_MAX_DARAB = 40;
const KITERJESZTES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function bajtHash(bajtok) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bajtok));
  return [...h].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** lejart kepek torlese (adatbazis + bajtok) */
export async function lejartakTorlese(db, { tarolo, now = most() }) {
  const lejart = await mind(db, 'SELECT id, storage_key FROM image_inbox WHERE expires_at <= ?1', now);
  for (const k of lejart) {
    await tranzakcio(db, [keszit(db, 'DELETE FROM image_inbox WHERE id = ?1', k.id), auditStmt(db, { staffId: null, action: 'image.inbox_expired', resource: 'image_inbox', resourceId: k.id, now })]);
    try { await tarolo.del(k.storage_key); } catch { /* az adatbazis mar nem hivatkozik ra */ }
  }
  return lejart.length;
}

export async function beerkezoFeltolt(db, { staffId, bajtok, mime, tarolo, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'camera_image', { now });
  if (!KEP_MIME.includes(mime)) throw new CrmHiba('ERVENYTELEN_MIME', 'csak jpeg / png / webp', 400);
  if (!bajtok?.length || bajtok.length > KEP_MAX_BAJT) throw new CrmHiba('ERVENYTELEN_MERET', 'ures vagy tul nagy fajl', 400);
  if (!tartalomEgyezik(bajtok, mime)) throw new CrmHiba('ERVENYTELEN_TARTALOM', 'a fajl tartalma nem egyezik a tipussal', 400);
  await lejartakTorlese(db, { tarolo, now });
  const db_ = await elso(db, 'SELECT COUNT(*) AS n FROM image_inbox');
  if (db_.n >= BEERKEZO_MAX_DARAB) throw new CrmHiba('BEERKEZO_TELE', 'a beerkezo tele van: rendeld hozza vagy vesd el a kepeket', 409);
  const id = uuid();
  const kulcs = `beerkezo/${id}.${KITERJESZTES[mime]}`;
  await tarolo.put(kulcs, bajtok, { mime, meret: bajtok.length });
  try {
    await tranzakcio(db, [
      keszit(db, 'INSERT INTO image_inbox (id, storage_key, mime, size_bytes, sha256, uploaded_by, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
        id, kulcs, mime, bajtok.length, await bajtHash(bajtok), staffId, now, now + BEERKEZO_ORAK * 3600),
      auditStmt(db, { staffId, action: 'image.inbox_upload', resource: 'image_inbox', resourceId: id, detail: { meret: bajtok.length }, now }),
    ]);
  } catch (e) { await tarolo.del(kulcs); throw e; }
  return { id, lejar: now + BEERKEZO_ORAK * 3600 };
}

export async function beerkezoLista(db, { staffId, tarolo, now = most() }) {
  await megkoveteli(db, staffId, 'read', 'camera_image', { now });
  await lejartakTorlese(db, { tarolo, now });
  return mind(db, `SELECT i.id, i.created_at, i.expires_at, i.size_bytes, u.name AS feltoltotte FROM image_inbox i LEFT JOIN staff_user u ON u.id = i.uploaded_by ORDER BY i.created_at DESC`);
}

export async function beerkezoOlvas(db, { id, staffId, tarolo, ipHash = null, now = most() }) {
  const k = await elso(db, 'SELECT * FROM image_inbox WHERE id = ?1 AND expires_at > ?2', id, now);
  if (!k) throw new CrmHiba('NINCS_KEP', 'nincs ilyen kep (lehet, hogy lejart)', 404);
  await megkoveteli(db, staffId, 'read', 'camera_image', { resourceId: id, ipHash, now });
  await auditStmt(db, { staffId, action: 'image.inbox_read', resource: 'image_inbox', resourceId: id, ipHash, now }).run();
  const f = await tarolo.get(k.storage_key);
  if (!f) throw new CrmHiba('HIANYZO_FAJL', 'a fajl nem talalhato a taroloban', 500);
  return { ...f, fejlecek: FEJLECEK };
}

async function torol(db, k, { staffId, tarolo, ok, now }) {
  await tranzakcio(db, [keszit(db, 'DELETE FROM image_inbox WHERE id = ?1', k.id), auditStmt(db, { staffId, action: 'image.inbox_removed', resource: 'image_inbox', resourceId: k.id, detail: { ok }, now })]);
  try { await tarolo.del(k.storage_key); } catch { /* az adatbazis mar nem hivatkozik ra */ }
}

export async function beerkezoElvet(db, { id, staffId, tarolo, now = most() }) {
  await megkoveteli(db, staffId, 'write', 'camera_image', { resourceId: id, now });
  const k = await elso(db, 'SELECT * FROM image_inbox WHERE id = ?1', id);
  if (!k) throw new CrmHiba('NINCS_KEP', 'nincs ilyen kep', 404);
  await torol(db, k, { staffId, tarolo, ok: 'elvetve', now });
  return { torolve: true };
}

/** a beerkezo kepet a kivalasztott kezeleshez rendeli (csere: a meglevo kepet felulirja); siker utan a beerkezobol torlodik */
export async function beerkezoHozzarendel(db, { id, sessionId, staffId, tarolo, csere = false, now = most() }) {
  const k = await elso(db, 'SELECT * FROM image_inbox WHERE id = ?1 AND expires_at > ?2', id, now);
  if (!k) throw new CrmHiba('NINCS_KEP', 'nincs ilyen kep (lehet, hogy lejart)', 404);
  const f = await tarolo.get(k.storage_key);
  if (!f) throw new CrmHiba('HIANYZO_FAJL', 'a fajl nem talalhato a taroloban', 500);
  const r = await kepFeltolt(db, { sessionId, staffId, bajtok: f.bajtok, mime: k.mime, tarolo, csere, now });
  await torol(db, k, { staffId, tarolo, ok: 'hozzarendelve', now });
  return r;
}
