// MOSAIC Booking Engine V1 - kozos merasi szerzodes (dataLayer)
//
// A MASTER SPEC 10. pontja szerinti esemenyek es parameterek. A motor csak a dataLayer-be ir; GTM-et, pixelt, konverziot
// ez a modul nem hoz letre es nem modosit (kulso fiokban semmi nem valtozik). A probaoldalon a suti.js/GTM nem fut,
// igy az esemenyek ott sehova nem jutnak el; elesiteskor kulon dontes, hogyan kapcsolodik a mostani merakeszlethez.
//
// Nem megfigyelheto esemeny: booking_submit - az "Idopont lefoglalasa" gomb a Salonic beagyazott adatlapjan van.

export const EVENTS = Object.freeze([
  'booking_open', 'booking_intent_selected', 'booking_service_selected', 'booking_filter_used', 'booking_slot_viewed',
  'booking_slot_selected', 'booking_details_started', 'booking_completed', 'booking_slot_lost', 'booking_no_slots',
  'booking_callback_requested', 'booking_error',
]);

const PARAMS = ['business', 'service', 'service_id', 'booking_type', 'staff_id', 'source_page', 'booking_id', 'list_price', 'final_price',
  'pricing_rule', 'voucher', 'new_or_returning', 'acquisition', 'step', 'reason', 'count', 'filter'];

const cookie = (doc, name) => {
  try { const m = String(doc && doc.cookie).match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : undefined; } catch (e) { return undefined; }
};

/** ctx: parseContext() eredmenye. dataLayer: tomb (alap: window.dataLayer). */
export function createTracker({ ctx, dataLayer, doc = typeof document !== 'undefined' ? document : null, storage = null, now = () => Date.now() }) {
  const base = { business: ctx.business, source_page: ctx.sourcePage || undefined, ...ctx.attribution, fbc: cookie(doc, '_fbc'), fbp: cookie(doc, '_fbp') };
  const dl = dataLayer || (typeof window !== 'undefined' ? (window.dataLayer = window.dataLayer || []) : []);
  let seq = 0;

  function onceKey(key) {
    if (!storage) return true;
    try { if (storage.getItem(key)) return false; storage.setItem(key, String(now())); } catch (e) { /* privat mod: nem blokkolunk */ }
    return true;
  }

  /** Egy esemeny a dataLayer-be. Ismeretlen esemenyt nem kuldunk (a szerzodes zart). Visszaadja a bejegyzest vagy null-t. */
  function track(event, params = {}, { once = null } = {}) {
    if (!EVENTS.includes(event)) { if (typeof console !== 'undefined') console.warn('Ismeretlen merasi esemeny:', event); return null; }
    if (once && !onceKey('be_once_' + event + '_' + once)) return null;
    const entry = { event, ...base };
    for (const k of PARAMS) if (params[k] !== undefined && params[k] !== null && params[k] !== '') entry[k] = params[k];
    entry.event_id = `${event}-${now()}-${++seq}`;
    for (const k of Object.keys(entry)) if (entry[k] === undefined) delete entry[k];
    dl.push(entry);
    return entry;
  }
  /** A kezdo allapotban (H0) meg nincs uzletag: a valasztas utan allitjuk be, a tovabbi esemenyek mar azzal mennek. */
  function setBusiness(business) { base.business = business; }
  return { track, base, setBusiness };
}
