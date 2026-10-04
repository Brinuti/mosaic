// MOSAIC Booking Engine V1 - a folyamat tiszta (DOM-mentes, halozat-mentes) logikaja
//
// Allapotok a wireframe-ok szerint (docs: MOSAIC_HeadSpa_Booking_Engine_V1_Wireframe.md):
//   HS2 elmeny, HS3 ajandekkartya-tipus, C1 idopont (a PMU-foglalo havi naptara; nincs osszegzo kepernyo),
//   C4 vendegadatok (a Salonic beagyazott adatlapja), C5 rogzites, C6 siker, A1 nincs idopont, A2 elkelt, A3 technikai hiba.
// Az utvonalak (ROUTES) pontosan a wireframe routing tablaja; a teszt ezt veti ossze vele.

export const TIMEZONE = 'Europe/Budapest';

// --- allapotgep -----------------------------------------------------------------------------------------------------------
export const EXIT_GIFTCARD = 'EXIT_GIFTCARD'; // az ajandekkartya-vasarlas NEM foglalasi allapot: kilep a Gift Card funnelbe
export const ROUTES = Object.freeze({
  // HeadSpa: az elmeny-valasztas (HS2) az elso allapot; alatta ket link: ajandekkartya-bevaltas (HS3) es -vasarlas (kilep a Gift Card funnelbe)
  HS2: { service: 'C1', voucher: 'HS3', giftcard: EXIT_GIFTCARD },
  HS3: { service: 'C1' },
  // Oxigen: egy belepesi kerdes (OX1); ha egy szandekhoz tobb Salonic-szolgaltatas tartozik, rovid valasztas (OX2) - csak C1 elott
  OX1: { service: 'C1', variant: 'OX2' },
  OX2: { service: 'C1' },
  // Fodraszat: HA1 (mit szeretnel) -> HA2 (kezeles) -> [HA2B (hajhossz)] -> HA3 (van valasztott fodraszod?) -> [HA3B] -> C1;
  // az ingyenes konzultacio (HA-CONSULT) egyenesen C1-re megy; konkret szolgaltatas landing a HA3-ra
  HA1: { intent: 'HA2', consult: 'C1' },
  HA2: { group: 'HA2B', service: 'HA3' },
  HA2B: { service: 'HA3' },
  HA3: { any: 'C1', choose: 'HA3B' },
  HA3B: { staff: 'C1' },
  // Lezer: LA1 (melyik ut illik rad) -> LA2 (terulet; "mar tudom") / LA3 (terulet; "mar jarok kezelesre") -> LA2B (kezeles) -> C1;
  // az ingyenes konzultacio egyenesen C1-re megy; szakember nincs (egy kezelo)
  LA1: { consult: 'C1', known: 'LA2', returning: 'LA3' },
  LA2: { area: 'LA2B', service: 'C1' },
  LA3: { area: 'LA2B', service: 'C1' },
  LA2B: { service: 'C1' },
  // Nincs osszegzo kepernyo (design, 2026-10-04): az idopont kivalasztasa utan rogton a Salonic adatlapja (C4).
  C1: { slot: 'C4', none: 'A1' },
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

/**
 * Belepesi pont: konkret szolgaltatas ismert -> az uzletag "exact" allapota (alap: C1; Fodraszat: HA3, a szakember-kerdes); ajandekkartya-szandek -> HS3
 * (ha az uzletagnak van); egyebkent (generic) az uzletag elso allapota (HS2 / OX1 / HA1).
 */
export function entryState({ hasService, voucher, first = 'HS2', voucherState = 'HS3', exact = 'C1' }) {
  if (hasService) return exact;
  return voucher && voucherState ? voucherState : first;
}

/** Egy szandekhoz (pl. "Elso kezeles") tartozo Salonic-szolgaltatasok; ha tobb is van, az engine rovid valasztast kinal (OX2). */
export const intentCandidates = (services, intent) => services.filter((s) => intent.test(s));

// --- Fodraszat: kategoria-szandekek, kezelesek hajhossz szerint, szakemberi arkedvezmeny --------------------------------------------
const normCat = (s) => String(s ?? '').normalize('NFC').trim().toLowerCase();

/**
 * Egy szandek (pl. "Hajfestes") Salonic-szolgaltatasai a jovahagyott kategoria-lista szerint. A konzultacio kulon ag (nem tartozik ide).
 * A catchAll szandek ("Egyeb") azt is megkapja, amit egyik szandek sem igenyel (uj Salonic-kategoria sem vesz el).
 */
export function intentServices(services, intents, intent) {
  const claimed = new Set(intents.flatMap((i) => (i.categories || []).map(normCat)));
  const own = new Set((intent.categories || []).map(normCat));
  return services.filter((s) => s.bookingType !== 'consultation' && (own.has(normCat(s.category)) || (intent.catchAll && !claimed.has(normCat(s.category)))));
}

const LENGTH_RE = /\s*[-–]\s*(Rövid|Közepes|Hosszú|Extra\s+Hosszú|Félhosszú)\s+haj\s*$/i;
const LENGTH_LABEL = { 'rövid': 'Rövid haj', 'közepes': 'Közepes haj', 'hosszú': 'Hosszú haj', 'extra hosszú': 'Extra hosszú haj', 'félhosszú': 'Félhosszú haj' };
const tidy = (s) => s.replace(/\s*\+\s*/g, ' + ').replace(/\s*\/\s*/g, ' / ').replace(/(\S)-\s+/g, '$1 – ').replace(/\s+-\s+/g, ' – ').replace(/\s+/g, ' ').trim();
const groupKey = (stem) => stem.toLowerCase().replace(/[^\p{L}\p{N}+]/gu, ''); // a Salonic nevei kozott szokozes/irasjel-elteres van, ez kiegyenlit

/** "Balayage ... - Kozepes haj" -> { stem: "Balayage ...", length: "Kozepes haj" }; hajhossz nelkuli szolgaltatasnal length = null. */
export function parseLength(name) {
  const clean = displayName(name);
  const m = clean.match(LENGTH_RE);
  if (!m) return { stem: tidy(clean), length: null };
  return { stem: tidy(clean.replace(LENGTH_RE, '')), length: LENGTH_LABEL[m[1].toLowerCase().replace(/\s+/g, ' ')] || null };
}

/** A szolgaltatasok kezelesenkent (a hajhossz-valtozatok egy csoportban), a Salonic sorrendjeben; a hajhosszak idotartam szerint rendezve. */
export function groupServices(services) {
  const groups = new Map();
  for (const service of services) {
    const { stem, length } = parseLength(service.name);
    const key = groupKey(stem);
    if (!groups.has(key)) groups.set(key, { key, title: stem, items: [] });
    groups.get(key).items.push({ service, length });
  }
  const out = [...groups.values()];
  for (const g of out) g.items.sort((a, b) => (a.service.durationMin || 0) - (b.service.durationMin || 0));
  return out;
}

const rangeOf = (nums) => { const v = nums.filter((n) => n !== null && n !== undefined); return v.length ? [Math.min(...v), Math.max(...v)] : null; };
/** Egy kezelescsoport tomor jellemzoje: "2 ora 30 perc - 3 ora 30 perc · 39 950 - 48 950 Ft" (egy valtozatnal egyetlen ertek). */
export function groupFacts(group) {
  const d = rangeOf(group.items.map((i) => i.service.durationMin));
  const p = rangeOf(group.items.map((i) => i.service.activePrice));
  const dur = d ? (d[0] === d[1] ? durationLabel(d[0]) : `${durationLabel(d[0])} – ${durationLabel(d[1])}`) : '';
  const price = p ? (p[0] === p[1] ? formatPrice(p[0]) : `${formatPrice(p[0]).replace(/ Ft$/, '')} – ${formatPrice(p[1])}`) : '';
  return [dur, price].filter(Boolean).join(' · ');
}

/** A Salonic szakemberi cimkeje ("Noel - 20% kedvezmeny!") a kedvezmeny szazalekat tartalmazza; 0, ha nincs. */
export const staffDiscountPercent = (label) => { const m = /(\d{1,2})\s*%\s*kedvezm/i.exec(label || ''); return m ? +m[1] : 0; };
/** A szolgaltatas ara az adott szakemberrel (a szakemberi kedvezmennyel; nincs kedvezmeny = a Salonic ara). */
export function priceFor(service, staffLabel) {
  if (service.activePrice === null || service.activePrice === undefined) return null;
  const pct = staffDiscountPercent(staffLabel);
  return pct ? Math.round(service.activePrice * (100 - pct) / 100) : service.activePrice;
}

// --- ido (Europe/Budapest) --------------------------------------------------------------------------------------------------
const fmt = (unix, o, locale = 'hu-HU') => new Intl.DateTimeFormat(locale, { timeZone: TIMEZONE, ...o }).format(new Date(unix * 1000));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const dayKey = (unix) => fmt(unix, { year: 'numeric', month: '2-digit', day: '2-digit' }, 'sv-SE'); // 2026-10-03
export const timeLabel = (unix) => fmt(unix, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); // 10:00

/** "Ma" / "Holnap" / "Hetfo". */
export function dayLabel(unix, nowUnix) {
  const k = dayKey(unix);
  if (k === dayKey(nowUnix)) return 'Ma';
  if (k === dayKey(nowUnix + 86400)) return 'Holnap';
  return cap(fmt(unix, { weekday: 'long' }));
}
/** "Szombat, okt. 3." (osszegzes, siker) */
export const longDate = (unix) => `${cap(fmt(unix, { weekday: 'long' }))}, ${fmt(unix, { month: 'short', day: 'numeric' })}`;

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

export function filterSlots(slots, { staffId = null, day = null } = {}) {
  return slots.filter((s) => (!staffId || String(s.staff_id) === String(staffId)) && (!day || dayKey(s.start_unix) === day));
}

// --- havi naptar (a PMU-foglalo naptara): csak a szabad napok aktivak, a valasztott nap idopontjai gombokban ----------------------------
/** A havi naptar honapjai: a mai honaptol az utolso szabad idopontig / a keresesi hatarig (nowUnix + days nap), YYYY-MM kulccsal. */
export function monthList(nowUnix, days = 92) {
  const out = [];
  for (let t = nowUnix; t <= nowUnix + days * 86400; t += 86400) { const k = dayKey(t).slice(0, 7); if (!out.includes(k)) out.push(k); }
  return out;
}
/** Egy honap racsa hetfovel kezdve: { title: "2026. október" (a stilus nagybetuzi), cells: [{ blank: true } | { n, key, free }] }. */
export function monthGrid(monthKeyStr, freeDays) {
  const [y, m] = monthKeyStr.split('-').map(Number);
  const first = Date.UTC(y, m - 1, 1, 10) / 1000;
  const lead = (new Date(first * 1000).getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: lead }, () => ({ blank: true }));
  for (let n = 1; n <= dim; n++) { const key = `${monthKeyStr}-${String(n).padStart(2, '0')}`; cells.push({ n, key, free: freeDays.has(key) }); }
  return { title: fmt(first, { year: 'numeric', month: 'long' }), cells };
}
/** Egy nap idopontjai a PMU-foglalo szabalya szerint: az egesz es fel orakat mutatjuk, a negyedet csak ha mellette nincs ilyen. Egy idopont = egy bejegyzes. */
export function dayTimes(slots, key) {
  const nap = uniqueTimes(slots).filter((s) => dayKey(s.start_unix) === key);
  const set = new Set(nap.map((s) => s.start_unix));
  return nap.filter((s) => s.start_unix % 1800 === 0 || (!set.has(s.start_unix - 900) && !set.has(s.start_unix + 900)));
}

// --- megjelenites ------------------------------------------------------------------------------------------------------------
const EMOJI = /[\p{Extended_Pictographic}‍️]/gu;
/** A Salonic nevebol: emoji es a "KUPONKODDAL - " elotag nelkul (a kupon-allapotot kulon jelezzuk). */
// A Salonic nevebol: emoji, "KUPONKODDAL - " elotag es a zarojeles akcios szoveg ("(9.900 Ft helyett most 0 Ft!)") nelkul: a listaar/akcio kulon latszik.
export const displayName = (name) => String(name || '').replace(EMOJI, '').replace(/^\s*KUPONKÓDDAL\s*-\s*/i, '').replace(/\s*\(\s*[\d.\s]+Ft helyett most[^)]*\)/i, '').replace(/\s+/g, ' ').trim();
/** A 0 Ft-os szolgaltatas felirata (alap: "Ingyenes", pl. konzultacio; az egyedi csomagnal "Egyedi ar"), egyebkent a formazott ar. */
export const priceLabel = (n, zeroLabel = 'Ingyenes') => (n === 0 ? zeroLabel : formatPrice(n));
// Ezres tagolas minden meretnel ("4 990 Ft", "29 900 Ft"): az Intl hu-HU a negyjegyu szamokat nem tagolja, ezert kezzel.
export const formatPrice = (n) => (n === null || n === undefined ? '' : `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ft`);
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
// defaultBusiness: ha az URL nem nevezi meg az uzletagat: a /foglalo-motor oldalon HeadSpa (alap), a /foglalas oldalon es a retegben null
// -> a szolgaltatas-elso kezdo allapot (H0). Az aliasok (service_id, service_category) a CTA-hivasokhoz (openBooking) valok.
export function parseContext(search, referrer = '', origin = '', { defaultBusiness = 'headspa' } = {}) {
  const q = new URLSearchParams(search);
  let sourcePage = q.get('source_page') || '';
  if (!sourcePage && referrer) { try { const r = new URL(referrer); if (!origin || r.origin === origin) sourcePage = r.pathname; } catch (e) { /* hibas referrer */ } }
  const attribution = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'fbclid', 'ttclid']) if (q.get(k)) attribution[k] = q.get(k);
  return {
    business: q.get('business') || defaultBusiness,
    serviceKey: q.get('service') || q.get('service_id') || null,
    category: q.get('category') || q.get('service_category') || null, // kategoria-landing: a szandek kulcsa (pl. balayage) -> kozvetlenul a kezeles-valasztasra
    voucher: q.get('voucher') === '1' || q.get('intent') === 'voucher',
    intent: q.get('intent') || null, // lezer: first | returning (a regi "Elso idopontok" / "Kezeles idopontok" gombok) -> egyenesen a terulet-valasztasra
    sourcePage,
    attribution,
    sample: q.get('minta') || null,
  };
}

/**
 * Sikeres foglalas utan atadjuk a vendeget a MEGLEVO koszonooldalnak (a mostani meres valtozatlanul azon fut), de csak az eles
 * tartomanyon: ott a Salonic atiranyitasa a sajat oldalunkra jon vissza. Elonezeten / helyben a motor maga mutatja a sikert
 * (a Salonic az eles koszonooldalra iranyit, az onnan nem ertesitheti az elonezeti oldalt). ?atadas=0 kikapcsolja, ?atadas=1 bekapcsolja.
 */
export const ATTRIBUTION_KEYS = Object.freeze(['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid', 'msclkid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']);

/**
 * Az atadott koszonooldal-URL (a Salonic allitja elo, a motor nem nyul bele) VEGERE fuzi a motor sajat URL-jen erkezett hirdetesi azonositokat
 * (gclid, fbclid, ttclid, utm_* ...), ha a Salonic URL-je nem tartalmazza oket. Igy a hirdetesbol KOZVETLENUL a foglalora erkezo latogato
 * azonositoi (es a GA4 kampany-forrasa) a koszonooldalon is megvannak: a platformok a ma is hasznalt modon, az oldal URL-jebol olvassak (nem a
 * referrerbol). A Salonic paraméterei bajtra valtozatlanok maradnak (nem szerializaljuk ujra az URL-t); ha nincs mit hozzaadni, az href valtozatlan.
 */
export function withAttribution(href, search = '') {
  let u;
  try { u = new URL(href); } catch (e) { return href; }
  const q = new URLSearchParams(search);
  const add = ATTRIBUTION_KEYS.filter((k) => q.get(k) && !u.searchParams.has(k)).map((k) => `${k}=${encodeURIComponent(q.get(k))}`);
  if (!add.length) return href;
  const hash = href.indexOf('#');
  const base = hash >= 0 ? href.slice(0, hash) : href, frag = hash >= 0 ? href.slice(hash) : '';
  return base + (base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?') + add.join('&') + frag;
}

export function shouldHandoff(hostname, search = '', liveHosts = ['www.mosaicheadspa.hu', 'mosaicheadspa.hu']) {
  const v = new URLSearchParams(search).get('atadas');
  if (v === '0') return false;
  if (v === '1') return true;
  return liveHosts.includes(hostname);
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
