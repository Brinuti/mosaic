// MOSAIC Booking Engine - a sajat foglalas-azonosito (booking_id) es a bongeszo meresi kontextusa (QA-1)
//
// A foglalo a folyamat ELEJEN (startEngine) general egy sajat azonositot, es elmenti a bongeszo meresi kontextusaba (sessionStorage, "mhBookingCtx"):
// ugyanabban a munkamenetben, ugyanazon a tartomanyon a koszonooldal (az eles atadasnal a fo ablakban nyilik) is olvashatja. A Salonic nem ad sajat
// foglalas-azonositot, ezert ez a kapocs a foglalo, a koszonooldal es (ha a Salonic visszaadja) a szerver-oldali mereshez. DECISION-LOG #97: correlation_id.
//
// Szemelyes adat nincs benne (se nev, se e-mail, se telefon, se Salonic vendeg-azonosito). Fuggetlen modul (bongeszo es Node, nincs fuggosege).
// Az azonosito Salonicnak torteno atadasa a salonic-adapter.js dolga (beginBooking: bookingId), az atiranyitas visszhangjat is ott olvassuk.

export const CTX_KEY = 'mhBookingCtx';
export const CTX_MS = 30 * 60 * 1000; // mint a foglalo allapotanak mentese (SNAP_MS): ennyi ideig folytathato ugyanaz a foglalas
export const ID_PREFIX = 'mb_';
export const ID_RE = /^mb_[a-z0-9]{12,40}$/;

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const RANDOM_CHARS = 14; // 36^14 = ~6e21: veletlen utkozes gyakorlatilag kizart; a kezdo idobelyeg (base36) csak rendezhetoseget / hibakeresest ad

// A bongeszoben crypto.getRandomValues; Node 20+ alatt is (globalThis.crypto). Ha nincs, Math.random (a kontextus akkor sem all meg; az utkozes-esely itt is elhanyagolhato).
function randomChars(n, getRandomValues = globalThis.crypto && globalThis.crypto.getRandomValues && globalThis.crypto.getRandomValues.bind(globalThis.crypto)) {
  const bytes = new Uint8Array(n);
  if (getRandomValues) getRandomValues(bytes); else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]; // a 256 % 36 torzitas itt lényegtelen: az azonosito nem titok, csak egyedi
  return out;
}

/** Uj azonosito: "mb_" + base36 idobelyeg + 14 veletlen karakter (kb. 26 karakter, csak [a-z0-9_]). */
export function newBookingId({ now = Date.now, getRandomValues } = {}) {
  return ID_PREFIX + Math.floor(now()).toString(36).padStart(9, '0').slice(-9) + randomChars(RANDOM_CHARS, getRandomValues);
}

export const isBookingId = (v) => typeof v === 'string' && ID_RE.test(v);

const clean = (v) => (v === undefined || v === null || v === '' ? null : v);
const num = (v) => (Number.isFinite(+v) && v !== null && v !== '' && v !== undefined ? +v : null);

// A tarolt kontextus ellenorzese: ami nem ervenyes alak, azt eldobjuk (nem hiszunk a tarolonak)
function sane(o) {
  if (!o || typeof o !== 'object' || !isBookingId(o.id) || !Number.isFinite(o.created)) return null;
  return o;
}

/**
 * A foglalas bongeszo-oldali meresi kontextusa. storage: sessionStorage (vagy null: akkor csak memoriaban el, a motor ettol fuggetlenul mukodik).
 *   begin(info)     a folyamat eleje: a meg ervenyes (nem lezart, CTX_MS-nel nem regebbi) kontextust folytatja, egyebkent ujat general. info: { business, source_page }.
 *   update(patch)   mezok hozzaadasa (business, service_id, slot_unix, staff_id, sent_at, carrier): csak ismert kulcsok, szemelyes adat nem.
 *   complete(echo)  a foglalas lezarult (a Salonic atiranyitott): { returned, where }; a kovetkezo begin() ujat general, de a koszonooldal meg olvashatja.
 *   get()           a mostani kontextus (a koszonooldalnak is: nem general ujat).
 */
export function createBookingContext({ storage = null, now = Date.now, ttlMs = CTX_MS, newId = () => newBookingId({ now }) } = {}) {
  let cur = null;
  const read = () => { try { const o = sane(JSON.parse(storage.getItem(CTX_KEY))); return o; } catch (e) { return null; } };
  const write = () => { if (!storage || !cur) return; try { storage.setItem(CTX_KEY, JSON.stringify(cur)); } catch (e) { /* privat mod / tele tarolo: nem blokkolunk */ } };
  const fresh = (o) => o && !o.completed_at && now() - (o.seen || o.created) < ttlMs;

  function begin(info = {}) {
    const stored = storage ? read() : null;
    if (fresh(cur)) { /* ugyanezen a motoron belul */ } else if (fresh(stored)) cur = stored;
    else cur = { id: newId(), created: now(), seen: now(), business: null, source_page: null, service_id: null, slot_unix: null, staff_id: null, carrier: null, sent_at: null, returned: null, completed_at: null };
    cur.seen = now();
    if (clean(info.business) && !cur.business) cur.business = String(info.business);
    if (clean(info.source_page) && !cur.source_page) cur.source_page = String(info.source_page).slice(0, 120);
    write();
    return cur;
  }

  function update(patch = {}) {
    if (!cur) begin();
    if ('business' in patch) cur.business = clean(patch.business) && String(patch.business);
    if ('service_id' in patch) cur.service_id = clean(patch.service_id) && String(patch.service_id);
    if ('slot_unix' in patch) cur.slot_unix = num(patch.slot_unix);
    if ('staff_id' in patch) cur.staff_id = clean(patch.staff_id) && String(patch.staff_id); // "-1" = barmelyik szakember
    if ('carrier' in patch) cur.carrier = clean(patch.carrier) && String(patch.carrier);
    if ('sent_at' in patch) cur.sent_at = num(patch.sent_at);
    cur.seen = now();
    write();
    return cur;
  }

  function complete(echo = null) {
    if (!cur) begin();
    cur.completed_at = now();
    cur.returned = echo ? { returned: !!echo.returned, where: clean(echo.where) } : { returned: false, where: null };
    write();
    return cur;
  }

  // a koszonooldal: nem general ujat; a lezart kontextust is megkapja (kor-hatar nelkul a lezaras utan CTX_MS-ig)
  const get = () => {
    const o = cur || (storage ? read() : null);
    return o && now() - (o.completed_at || o.seen || o.created) < ttlMs ? o : null;
  };

  return { begin, update, complete, get, get id() { return cur ? cur.id : null; } };
}
