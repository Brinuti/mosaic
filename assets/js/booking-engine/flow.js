// MOSAIC Booking Engine V1 - a folyamat tiszta (DOM-mentes, halozat-mentes) logikaja
//
// Allapotok a wireframe-ok szerint (docs: MOSAIC_HeadSpa_Booking_Engine_V1_Wireframe.md):
//   HS1 intent, HS2 elmeny, HS3 ajandekkartya-tipus, C1 gyors idopontok, C2 naptar, C3 osszegzes,
//   C4 vendegadatok (a Salonic beagyazott adatlapja), C5 rogzites, C6 siker, A1 nincs idopont, A2 elkelt, A3 technikai hiba.
// Az utvonalak (ROUTES) pontosan a wireframe routing tablaja; a teszt ezt veti ossze vele.

export const TIMEZONE = 'Europe/Budapest';

// --- allapotgep -----------------------------------------------------------------------------------------------------------
export const EXIT_GIFTCARD = 'EXIT_GIFTCARD'; // az ajandekkartya-vasarlas NEM foglalasi allapot: kilep a Gift Card funnelbe
export const ROUTES = Object.freeze({
  HS1: { book: 'HS2', voucher: 'HS3', giftcard: EXIT_GIFTCARD },
  HS2: { service: 'C1' },
  HS3: { service: 'C1' },
  C1: { slot: 'C3', more: 'C2', none: 'A1' },
  C2: { slot: 'C3', none: 'A1' },
  C3: { next: 'C4' },
  C4: { submit: 'C5' },
  C5: { success: 'C6', slot_lost: 'A2', error: 'A3' },
  A1: { callback: 'A1_SENT' },
  A2: { retry: 'C1' },
  A3: { retry: 'C4', callback: 'A3_SENT' },
});

export function next(state, event) {
  const to = ROUTES[state] && ROUTES[state][event];
  if (!to) throw new Error(`Ervenytelen atmenet: ${state} --${event}-->`);
  return to;
}

/** Belepesi pont: konkret szolgaltatas ismert -> C1; ajandekkartya-szandek -> HS3; egyebkent (generic) HS1. */
export function entryState({ hasService, voucher }) {
  if (hasService) return 'C1';
  return voucher ? 'HS3' : 'HS1';
}

// --- ido (Europe/Budapest) --------------------------------------------------------------------------------------------------
const fmt = (unix, o, locale = 'hu-HU') => new Intl.DateTimeFormat(locale, { timeZone: TIMEZONE, ...o }).format(new Date(unix * 1000));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const dayKey = (unix) => fmt(unix, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'sv-SE'); // 2026-10-03
export const timeLabel = (unix) => fmt(unix, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); // 10:00
export const hourOf = (unix) => +fmt(unix, { hour: 'numeric', hourCycle: 'h23' });

/** Napszak a wireframe szuroje szerint: Delelott (12 ora elott), Delutan (12-18), Este (18-tol). */
export const daypartOf = (unix) => { const h = hourOf(unix); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; };
export const DAYPARTS = Object.freeze([['any', 'Bármelyik'], ['morning', 'Délelőtt'], ['afternoon', 'Délután'], ['evening', 'Este']]);

/** "Ma" / "Holnap" / "Hetfo". */
export function dayLabel(unix, nowUnix) {
  const k = dayKey(unix);
  if (k === dayKey(nowUnix)) return 'Ma';
  if (k === dayKey(nowUnix + 86400)) return 'Holnap';
  return cap(fmt(unix, { weekday: 'long' }));
}
/** "Szombat, okt. 3." (osszegzes, siker) */
export const longDate = (unix) => `${cap(fmt(unix, { weekday: 'long' }))}, ${fmt(unix, { month: 'short', day: 'numeric' })}`;
/** "Szo 3." (a naptar-sav gombjai) */
export const stripLabel = (unix) => `${cap(fmt(unix, { weekday: 'short' }).replace(/\.$/, ''))} ${fmt(unix, { day: 'numeric' }).replace(/\.$/, '')}.`;

// --- idopontok --------------------------------------------------------------------------------------------------------------
/** Ugyanarra az idopontra tobb munkatars is lehet szabad: "barki megfelelo" nezetben egy idopont = egy bejegyzes. */
export function uniqueTimes(slots) {
  const seen = new Set();
  const out = [];
  for (const s of [...slots].sort((a, b) => a.start_unix - b.start_unix)) {
    if (seen.has(s.start_unix)) continue;
    seen.add(s.start_unix);
    out.push(s);
  }
  return out;
}

export function filterSlots(slots, { daypart = 'any', staffId = null, day = null } = {}) {
  return slots.filter((s) => (daypart === 'any' || daypartOf(s.start_unix) === daypart)
    && (!staffId || String(s.staff_id) === String(staffId))
    && (!day || dayKey(s.start_unix) === day));
}

/** C1: a legkozelebbi legfeljebb `max` (3-5) idopont, napok szerint csoportositva. */
export function quickSlots(slots, { max = 5, nowUnix }) {
  const picked = uniqueTimes(slots).slice(0, max);
  const groups = [];
  for (const s of picked) {
    const key = dayKey(s.start_unix);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) { g = { key, label: dayLabel(s.start_unix, nowUnix), items: [] }; groups.push(g); }
    g.items.push({ startUnix: s.start_unix, time: timeLabel(s.start_unix), slot: s });
  }
  return groups;
}

/** C2: a napok, amelyekre van szabad idopont (a sav gombjai), az elso `max` nap. */
export function availableDays(slots, { max = 14 } = {}) {
  const seen = new Map();
  for (const s of slots) if (!seen.has(dayKey(s.start_unix))) seen.set(dayKey(s.start_unix), s.start_unix);
  return [...seen].slice(0, max).map(([key, unix]) => ({ key, unix, label: stripLabel(unix) }));
}

// --- megjelenites ------------------------------------------------------------------------------------------------------------
const EMOJI = /[\p{Extended_Pictographic}‍️]/gu;
/** A Salonic nevebol: emoji es a "KUPONKODDAL - " elotag nelkul (a kupon-allapotot kulon jelezzuk). */
export const displayName = (name) => String(name || '').replace(EMOJI, '').replace(/^\s*KUPONKÓDDAL\s*-\s*/i, '').replace(/\s+/g, ' ').trim();
export const formatPrice = (n) => (n === null || n === undefined ? '' : `${new Intl.NumberFormat('hu-HU').format(n)} Ft`);
export const durationLabel = (min) => (min >= 60 ? `${Math.floor(min / 60)} óra${min % 60 ? ' ' + (min % 60) + ' perc' : ''}` : `${min} perc`);

/** Az uzletag kartyai (HS2/HS3): minden kartyahoz a Salonic aktualis szolgaltatasa; ami nincs a Salonicban, kimarad (nem talalunk ki ujat). */
export function cardsFor(services, cards, { voucher = false } = {}) {
  const pool = services.filter((s) => (s.bookingType === 'voucher_redemption') === voucher);
  const out = [];
  for (const card of cards) {
    const service = pool.find((s) => card.test(displayName(s.name)));
    if (service) out.push({ card, service });
  }
  return out;
}

/** ?service= (azonosito vagy kulcsszavak a nevben) -> szolgaltatas; az "exact service landing" belepeshez. */
export function findByKey(services, key, { voucher = false } = {}) {
  if (!key) return null;
  const pool = services.filter((s) => (s.bookingType === 'voucher_redemption') === voucher);
  const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const words = norm(key).split(/[^a-z0-9]+/).filter(Boolean);
  return pool.find((s) => s.serviceId === String(key)) || pool.find((s) => words.length && words.every((w) => norm(displayName(s.name)).includes(w))) || null;
}

// --- belepesi kontextus -------------------------------------------------------------------------------------------------------
export function parseContext(search, referrer = '', origin = '') {
  const q = new URLSearchParams(search);
  let sourcePage = q.get('source_page') || '';
  if (!sourcePage && referrer) { try { const r = new URL(referrer); if (!origin || r.origin === origin) sourcePage = r.pathname; } catch (e) { /* hibas referrer */ } }
  const attribution = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'fbclid', 'ttclid']) if (q.get(k)) attribution[k] = q.get(k);
  return {
    business: q.get('business') || 'headspa',
    serviceKey: q.get('service') || null,
    voucher: q.get('voucher') === '1' || q.get('intent') === 'voucher',
    sourcePage,
    attribution,
    sample: q.get('minta') || null,
  };
}

/** A Salonic adatlap (iframe) altal betoltott oldalunk: elkelt idopont (fooldal / maga a foglalo), visszaigazolas, vagy ismeretlen. */
export function classifyRedirect(href, { enginePath = '/foglalo-motor' } = {}) {
  let u;
  try { u = new URL(href); } catch (e) { return 'unknown'; }
  const path = u.pathname.replace(/\/+$/, '');
  if (path === '' || path === enginePath) return 'slot_lost';
  return u.searchParams.get('bookingUrl') ? 'confirmation' : 'unknown';
}

// --- naptar-fajl es terkep ----------------------------------------------------------------------------------------------------
export function icsFor({ startUnix, durationMin, title, location, description }) {
  const t = (unix) => new Date(unix * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc = (s) => String(s ?? '').replace(/[\\,;]/g, '\\$&').replace(/\r?\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MOSAIC//Foglalas//HU', 'BEGIN:VEVENT',
    `UID:motor-${startUnix}@mosaicheadspa.hu`, `DTSTAMP:${t(Math.floor(Date.now() / 1000))}`, `DTSTART:${t(startUnix)}`, `DTEND:${t(startUnix + durationMin * 60)}`,
    `SUMMARY:${esc(title)}`, `LOCATION:${esc(location)}`, `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', `DESCRIPTION:${esc('Holnap: ' + title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
export const mapsUrl = (address) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address);
