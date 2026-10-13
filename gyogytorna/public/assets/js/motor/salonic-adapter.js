// Gyogytornaszom.hu foglalomotor - Salonic-adapter (a MOSAIC / Medical Piercing motor salonic-adapter.js-enek helyszin alapu valtozata).
//
// Fuggetlen modul (bongeszo es Node / Worker, nincs fuggosege). A Salonic NYILVANOS feluleteire epul, CSAK olvas (GET):
//   olvasas    getServices / getStaff / getAvailability / getPlace   a gyogytornaszomhu.salonic.hu oldalaibol es a naptar-API-bol
//   foglalas   beginBooking                                          a beagyazhato /guestData/ adatlap cime: a foglalast a Salonic rogziti
//   ellenorzes verifyConfirmation                                    a Salonic sikeres foglalas utani atiranyitasanak parameterei (kliensoldali)
//
// Egyetlen Salonic-fiok (gyogytornaszomhu), HAROM helyszin (placeId): Batthyany ter 418, Nyugati ter 2581, Oktogon 8439. A szolgaltatas-ID, ar,
// idotartam, munkatars, fotok NINCSENEK beegetve: mindig a Salonicbol olvassuk (2026-10-13-i leképezés: docs/SALONIC_LEKEPEZES.md).
// A foglalas "tipusa" (allapotfelmeres / egyeb) kivetel: ez uzleti dontes (Feri, 2026-10-13), az ALLAPOTFELMERES_ID-k listaja lent.
// Egeszsegugyi adat ide nem kerul: a katalogus-neveket az ajanlatbol olvassuk, vendegadatot ez a modul nem lat.

export const TIMEZONE = 'Europe/Budapest';
export const FIOK = 'gyogytornaszomhu';
export const HOST = 'https://gyogytornaszomhu.salonic.hu';
// A naptar-azonosito fiokszintu (mind a 3 helyszinen ugyanez, a /selectDate/ oldalbol, 2026-10-13); ha a Salonic elutasitja, az adapter a selectDate oldalbol olvassa ki ujra.
export const CALENDAR_ID = '90a47ea8-daee-7569-c643-144df67e72de';

/** A 3 helyszin (placeId -> kod, nev, rovid cim a Salonic helyszinvalasztoja szerint, 2026-10-13). */
export const HELYSZINEK = Object.freeze({
  418: { kod: 'batthyany', nev: 'Batthyány tér', cim: '1027 Budapest, Vitéz utca 9.' },
  2581: { kod: 'nyugati', nev: 'Nyugati tér', cim: '1055 Budapest, Bajcsy-Zsilinszky út 72.' },
  8439: { kod: 'oktogon', nev: 'Oktogon', cim: '1061 Budapest, Paulay Ede utca 47.' },
});
export const HELYSZIN_SORREND = Object.freeze([8439, 2581, 418]);

/**
 * A "fizikai allapotfelmeres" szolgaltatas-azonositoi (Feri dontese, 2026-10-13: "sima allapotfelmeres"): Szemelyes Allapotfelmeres (24666) es
 * Egyeni 20% Akcios Allapotfelmeres (416586). A "Szemelyes allkapocs kezeles" (27315) NEM allapotfelmeres. Az elsodleges konverzio (tipus='allapotfelmeres').
 */
export const ALLAPOTFELMERES_ID = Object.freeze(['24666', '416586']);
export const foglalasTipus = (serviceId) => (ALLAPOTFELMERES_ID.includes(String(serviceId)) ? 'allapotfelmeres' : 'egyeb');

const API_URL = 'https://api.salonic.hu/calendar/getAvailableTimes';
export const ANY_STAFF = -1;

// A sajat foglalas-azonosito (booking_id) hordozoja az adatlap cimen (a MOSAIC-meres szerint a Salonic a "back" parametert megorzi).
export const BOOKING_ID_PARAM = 'back';
export const BOOKING_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export class SalonicError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'SalonicError';
    this.code = code; // UNKNOWN_PLACE | SERVICE_NOT_FOUND | HTTP | PARSE | NO_CALENDAR | API_STATUS | TIMEOUT | NOT_SUPPORTED
    Object.assign(this, extra);
  }
}

// --- tiszta segedek ----------------------------------------------------------------------------------------------------
const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
export const decodeEntities = (s) => String(s ?? '').replace(/&(?:amp|quot|#0?39|lt|gt|nbsp);/g, (m) => ENTITIES[m]);
const clean = (s) => decodeEntities(s).replace(/\s+/g, ' ').trim();
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decodeEntities(m[2])]));
const toInt = (v) => (v === undefined || v === null || v === '' ? null : Number.isFinite(+v) ? Math.round(+v) : null);
const digits = (v) => { const d = String(v ?? '').replace(/[^\d]/g, ''); return d ? +d : null; };
const NAME_ATTR = /\bdata-name="([\s\S]*?)"(?=\s+data-(?:price|duration|employees)=)/;

/** A kezelesek a Salonic oldalairol: `<input data-id data-duration data-price data-name data-employees>`. */
export function parseServices(html) {
  const out = [];
  for (const m of String(html).matchAll(/<input[^>]*\bdata-id="[^"]*"[^>]*>/g)) {
    const nm = m[0].match(NAME_ATTR);
    const a = attrsOf(nm ? m[0].replace(nm[0], 'data-name=""') : m[0]);
    if (nm) a['data-name'] = decodeEntities(nm[1]);
    if (a['data-duration'] === undefined || out.some((s) => s.serviceId === a['data-id'])) continue;
    const name = clean(a['data-name']);
    const helyett = name.match(/([\d.]+)\s*Ft helyett/i);
    out.push({
      serviceId: a['data-id'],
      name,
      durationMin: toInt(a['data-duration']),
      activePrice: toInt(a['data-price']),
      listPrice: helyett ? digits(helyett[1]) : null,
      staffIds: (a['data-employees'] || '').split(',').map((x) => x.trim()).filter(Boolean),
    });
  }
  return out;
}

/** Kategoriak (specId) a selectSpecialization oldalrol. */
export function parseSpecs(html) {
  const specs = new Map();
  for (const m of String(html).matchAll(/<a[^>]*showServices[^>]*specId=(\d+)[^>]*>/g)) {
    if (!specs.has(m[1])) specs.set(m[1], clean(attrsOf(m[0])['data-name']) || null);
  }
  return [...specs].map(([specId, name]) => ({ specId, name }));
}

/** A munkatarsak a /employees oldalrol: { id, nev, foto, helyszinek:[placeId] } (egy munkatars tobb helyszinen is szerepelhet). */
export function parseEmployees(html) {
  const out = new Map();
  for (const m of String(html).matchAll(/<div class="card card-profile">([\s\S]*?)<hr>/g)) {
    const blokk = m[1];
    const id = (/href="\/employees\/(\d+)\/\?placeId=(\d+)"/.exec(blokk) || [])[1];
    if (!id) continue;
    const place = +(/placeId=(\d+)/.exec(blokk) || [])[1];
    const nev = clean((/<h4 class="card-title[^>]*>\s*<a [^>]*>([^<]+)<\/a>/.exec(blokk) || [])[1]);
    const foto = (/<img[^>]*class="img"[^>]*src="(https:\/\/cdn\.salonic\.hu\/[^"]+)"/.exec(blokk) || [])[1] || null;
    const e = out.get(id) || { id, nev: nev || null, foto, helyszinek: [] };
    if (nev && !e.nev) e.nev = nev;
    if (foto && !e.foto) e.foto = foto;
    if (place && !e.helyszinek.includes(place)) e.helyszinek.push(place);
    out.set(id, e);
  }
  return [...out.values()];
}

export const parseCalendarId = (html) => (String(html).match(/calendarId:\s*'([^']+)'/) || [])[1] || null;

/** A naptar-API valaszabol szabad idopontok. A "-1" kulcsu blokk ures helykitolto, kimarad. */
export function slotsFromApi(json, ctx) {
  if (!json || json.status !== 'success') throw new SalonicError('API_STATUS', 'A naptar-API nem sikeres valaszt adott: ' + (json && json.status), { status: json && json.status });
  const { placeId, service, minUnix = 0 } = ctx;
  const slots = [];
  for (const perDay of Object.values((json.data && json.data.blocks) || {})) {
    for (const [staffId, k] of Object.entries(perDay)) {
      if (staffId === String(ANY_STAFF)) continue;
      for (const s of Object.values(k.slots || {})) {
        if (!(s.timestamp > minUnix)) continue;
        const startUnix = +s.timestamp;
        slots.push({
          slot_id: `${placeId}:${service.serviceId}:${staffId}:${startUnix}`,
          start_unix: startUnix,
          staff_id: staffId,
          staff_label: clean(k.employeeName) || null,
          service_id: service.serviceId,
          final_price: service.activePrice,
        });
      }
    }
  }
  return slots.sort((a, b) => a.start_unix - b.start_unix || String(a.staff_id).localeCompare(String(b.staff_id)));
}

/** A sajat azonosito visszhangja a Salonic atiranyitasaban (pontos egyezes). */
export function echoedBookingId(query, bookingUrl, id) {
  const sent = id && BOOKING_ID_PATTERN.test(String(id)) ? String(id) : null;
  if (!sent) return { sent: null, returned: false, where: null };
  const find = (params, prefix) => { for (const [k, v] of params) if (v === sent) return `${prefix}:${k}`; return null; };
  const where = find(query, 'param') || (bookingUrl ? find(bookingUrl.searchParams, 'bookingUrl') : null);
  return { sent, returned: where !== null, where };
}

/**
 * A Salonic sikeres foglalas utani atiranyitasanak ellenorzese a vart valasztassal szemben (URL-bol; a Worker is ugyanezt futtatja
 * a /api/gy-foglalas-ban, de a vart ertekeket a SAJAT elo Salonic-adataibol kepezi). expected: { placeId, serviceId, startUnix, staffId (-1 = barki), activePrice, bookingId? }.
 */
export function verifyConfirmation(urlOrQuery, expected) {
  const u = new URL(String(urlOrQuery), 'https://redirect.invalid');
  const q = u.searchParams;
  const checks = {};
  const set = (name, status, exp, act) => { checks[name] = { status, expected: exp ?? null, actual: act ?? null }; };
  let bu = null;
  try { if (q.get('bookingUrl')) bu = new URL(q.get('bookingUrl'), HOST); } catch (e) { /* hibas bookingUrl */ }
  const missing = ['price', 'bookingUrl'].filter((k) => !q.get(k));
  set('params', missing.length ? 'fail' : 'pass', null, missing.length ? 'hianyzik: ' + missing.join(', ') : null);
  const buPlace = bu && toInt(bu.searchParams.get('placeId'));
  set('place', bu ? (bu.hostname === new URL(HOST).hostname && buPlace === +expected.placeId ? 'pass' : 'fail') : 'fail', expected.placeId, buPlace);
  const buService = bu && bu.searchParams.get('serviceId');
  set('service', buService ? (buService === String(expected.serviceId) ? 'pass' : 'fail') : 'fail', String(expected.serviceId), buService);
  const buStart = bu && toInt(bu.searchParams.get('startDate'));
  set('slot', buStart !== null ? (buStart === expected.startUnix ? 'pass' : 'fail') : 'fail', expected.startUnix, buStart);
  const price = digits(q.get('price'));
  if (expected.activePrice === null || expected.activePrice === undefined) set('price', 'skipped', null, price);
  else set('price', price === expected.activePrice ? 'pass' : 'fail', expected.activePrice, price);
  return {
    ok: Object.values(checks).every((c) => c.status !== 'fail'),
    checks,
    bookingId: echoedBookingId(q, bu, expected.bookingId),
    firstBooking: q.get('first_booking') === 'true',
  };
}

/** A Salonic-fiok egyedi stiluslapja ("Egyedi CSS URL"), ha a gyogytornaszom.hu sajat /gy-foglalas/salonic/*.css fajlja: a cime, egyebkent null. */
export function parseCustomCss(html) {
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const rel = /\brel\s*=\s*["']([^"']*)["']/i.exec(m[0]), href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(m[0]);
    if (!rel || !href || !/stylesheet/i.test(rel[1])) continue;
    try { const u = new URL(href[1].replace(/&amp;/g, '&'), HOST); if (/^(www\.)?gyogytornaszom\.hu$/.test(u.hostname) && /\/salonic\/[^/]+\.css$/i.test(u.pathname)) return u.href; } catch (e) { /* hibas href */ }
  }
  return null;
}

// --- az adapter ---------------------------------------------------------------------------------------------------------
export function createSalonicAdapter({ fetchImpl = globalThis.fetch, now = () => Date.now(), timeoutMs = 15000, retries = 1, cacheMs = 5 * 60 * 1000, storage = null, persistMs = 10 * 60 * 1000, headers = null } = {}) {
  const cache = new Map();
  const readPersist = (key) => { if (!storage) return undefined; try { const j = JSON.parse(storage.getItem('gySalonic:' + key)); if (j && now() - j.t < persistMs) return j.v; } catch (e) { /* hibas bejegyzes */ } return undefined; };
  const writePersist = (key, v) => { if (!storage) return; try { storage.setItem('gySalonic:' + key, JSON.stringify({ t: now(), v })); } catch (e) { /* tele / tiltott tarolo */ } };
  const folyamatban = new Map(); // ugyanarra a kulcsra egyszerre csak egy lekeres fut
  const cached = async (key, fn, { persist = false } = {}) => {
    const c = cache.get(key);
    if (c && now() - c.t < cacheMs) return c.v;
    if (persist) { const p = readPersist(key); if (p !== undefined) { cache.set(key, { t: now(), v: p }); return p; } }
    if (folyamatban.has(key)) return folyamatban.get(key);
    const pr = (async () => {
      const v = await fn();
      cache.set(key, { t: now(), v });
      if (persist) writePersist(key, v);
      return v;
    })();
    folyamatban.set(key, pr);
    const torol = () => folyamatban.delete(key);
    pr.then(torol, torol);
    return pr;
  };
  const helyszin = (placeId) => {
    const h = HELYSZINEK[+placeId];
    if (!h) throw new SalonicError('UNKNOWN_PLACE', 'Ismeretlen helyszin: ' + placeId, { placeId });
    return h;
  };

  // csak GET: idokorlat + egy ujraprobalas halozati/5xx hibara. Visszaad: { text, url } (url: a vegso cim az atiranyitasok utan)
  async function get(url) {
    let last;
    for (let i = 0; i <= retries; i++) {
      const ab = new AbortController();
      const timer = setTimeout(() => ab.abort(), timeoutMs);
      try {
        const r = await fetchImpl(url, { credentials: 'omit', signal: ab.signal, ...(headers ? { headers } : {}) });
        if (r.status >= 500 && i < retries) { last = new SalonicError('HTTP', 'HTTP ' + r.status, { url, status: r.status }); continue; }
        if (!r.ok) throw new SalonicError('HTTP', 'HTTP ' + r.status, { url, status: r.status });
        return { text: await r.text(), url: r.url || url };
      } catch (e) {
        if (e instanceof SalonicError && e.code === 'HTTP' && e.status < 500) throw e;
        last = e instanceof SalonicError ? e : new SalonicError(e && e.name === 'AbortError' ? 'TIMEOUT' : 'HTTP', 'Lekeres sikertelen: ' + (e && e.message), { url });
      } finally { clearTimeout(timer); }
    }
    throw last;
  }
  // a letoltott Salonic-oldalakbol azt is kiolvassuk, betolti-e a fiok a sajat stiluslapunkat (getPresentation)
  let stilus;
  const page = async (path, params) => {
    const r = await get(`${HOST}${path}?${new URLSearchParams({ ...params, lang: 'hu' })}`);
    stilus = parseCustomCss(r.text); writePersist('stilus', stilus);
    return r;
  };
  /** Az adatlap megjelenese: { customCss } - a sajat stiluslap cime, ha a Salonic-fiok betolti; egyebkent null (alap kinezet). */
  async function getPresentation() {
    if (stilus === undefined) { const p = readPersist('stilus'); if (p !== undefined) stilus = p; }
    if (stilus === undefined) { try { await page('/selectLocation/', {}); } catch (e) { stilus = null; } }
    return { customCss: stilus || null };
  }

  /** A helyszin szolgaltatasai (kategoriankent; a sorrend a Salonice). Minden szolgaltatasnak van specId / category mezoje. */
  const getServices = (placeId) => cached('services:' + placeId, async () => {
    helyszin(placeId);
    const found = [];
    const add = (list, spec) => { for (const s of list) if (!found.some((x) => x.serviceId === s.serviceId)) found.push({ ...s, specId: spec ? spec.specId : null, category: spec ? spec.name : null }); };
    const elso = await page('/selectSpecialization/', { placeId });
    const vegso = new URL(elso.url);
    if (/\/showServices\//.test(vegso.pathname)) {
      // egy kategoria: a Salonic egyenesen a szolgaltatas-listara iranyitott, de a lang=hu-t elhagyta: magyarul kell
      const specId = vegso.searchParams.get('specId');
      add(parseServices((await page('/showServices/', { placeId, specId })).text), { specId, name: null });
    } else {
      const specs = parseSpecs(elso.text);
      const oldalak = await Promise.all(specs.map((spec) => page('/showServices/', { placeId, specId: spec.specId })));
      specs.forEach((spec, i) => add(parseServices(oldalak[i].text), spec));
    }
    if (!found.length) throw new SalonicError('PARSE', `Nem talaltam szolgaltatast: ${placeId}`, { placeId });
    return found;
  }, { persist: true });

  /** A munkatarsak (azonosito -> { id, nev, foto, helyszinek }) a Salonic /employees oldalarol (egy kerdes az osszes helyszinre). */
  const getStaff = () => cached('staff', async () => {
    const r = await get(`${HOST}/employees?lang=hu`);
    const lista = parseEmployees(r.text);
    if (!lista.length) throw new SalonicError('PARSE', 'Nem talaltam munkatarsat');
    return Object.fromEntries(lista.map((e) => [e.id, e]));
  }, { persist: true });

  async function findService(placeId, serviceId) {
    const s = (await getServices(placeId)).find((x) => x.serviceId === String(serviceId));
    if (!s) throw new SalonicError('SERVICE_NOT_FOUND', `A(z) ${serviceId} szolgaltatas nincs a(z) ${placeId} helyszin listajaban`, { placeId, serviceId });
    return s;
  }

  let calendarOverride = null;
  const calendarFromPage = (placeId, serviceId) => cached('calendar', async () => {
    const id = parseCalendarId((await page('/selectDate/', { employeeId: ANY_STAFF, placeId, serviceId })).text);
    if (!id) throw new SalonicError('NO_CALENDAR', 'Nem talaltam naptar-azonositot', { placeId, serviceId });
    return id;
  });

  async function fetchSlots(placeId, service, staffId, startDate, days) {
    const run = async (calId) => {
      const p = new URLSearchParams({ startDate, offset: 0, days, placeId, serviceId: service.serviceId, employeeId: staffId, calendarId: calId, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0 });
      try { return JSON.parse((await get(API_URL + '?' + p)).text); } catch (e) { if (e instanceof SalonicError) throw e; throw new SalonicError('PARSE', 'A naptar-API valasza nem JSON', { placeId }); }
    };
    let json = await run(calendarOverride || CALENDAR_ID);
    if ((!json || json.status !== 'success') && !calendarOverride) {
      const id = await calendarFromPage(placeId, service.serviceId);
      if (id !== CALENDAR_ID) { calendarOverride = id; json = await run(id); }
    }
    const d = (json && json.data) || {};
    if (d.placeName || d.placeAddress) cache.set('place:' + placeId, { t: now(), v: { name: clean(d.placeName) || null, address: clean(d.placeAddress) || null, phone: clean(d.placePhone) || null } });
    return slotsFromApi(json, { placeId, service });
  }

  const CHUNK_DAYS = 90; // az elso 21 nap utan a maradek egyben jon
  const AVAIL_MS = 90 * 1000;
  const chunkCache = new Map();
  function chunk(placeId, service, staffId, startDate, n, fresh = false) {
    const key = [placeId, service.serviceId, staffId, startDate, n].join(':');
    const hit = chunkCache.get(key);
    if (!fresh && hit && now() - hit.t < AVAIL_MS) return hit.p;
    const p = fetchSlots(placeId, service, staffId, startDate, n);
    chunkCache.set(key, { t: now(), p });
    p.catch(() => { const c = chunkCache.get(key); if (c && c.p === p) chunkCache.delete(key); });
    return p;
  }
  const mergeSlots = (ls) => { const seen = new Set(); return ls.flat().filter((s) => (seen.has(s.slot_id) ? false : seen.add(s.slot_id))).sort((a, b) => a.start_unix - b.start_unix || String(a.staff_id).localeCompare(String(b.staff_id))); };

  /** Szabad idopontok: from (unix mp, alap: most - 3 ora), days (alap 60); firstDays + onMore: az elso resz hamarabb jon. */
  async function getAvailability(placeId, serviceId, { staffId = ANY_STAFF, from, days = 60, minLeadMinutes = 0, firstDays = null, onMore = null, fresh = false } = {}) {
    helyszin(placeId);
    const service = await findService(placeId, serviceId);
    const base = from ?? Math.floor((Math.floor(now() / 1000) - 3 * 3600) / 300) * 300;
    const split = (off, n) => { const k = Math.ceil(n / CHUNK_DAYS); const per = Math.ceil(n / k); return Array.from({ length: k }, (_, i) => [off + i * per, Math.min(per, n - i * per)]).filter(([, d]) => d > 0); };
    const f = firstDays && firstDays < days ? firstDays : null;
    const plan = f ? [[0, f], ...split(f, days - f)] : split(0, days);
    const lists = plan.map(([off, n]) => chunk(placeId, service, staffId, base + off * 86400, n, fresh));
    const minUnix = Math.floor(now() / 1000) + minLeadMinutes * 60;
    const keep = (l) => l.filter((x) => x.start_unix > minUnix);
    const full = Promise.all(lists).then(mergeSlots);
    if (f && onMore) { full.then((l) => onMore(keep(l)), (e) => onMore(null, e)); return keep(await lists[0]); }
    return keep(await full);
  }

  /** A helyszin neve, cime, telefonja (a naptar-API valaszabol). */
  function getPlace(placeId) {
    const c = cache.get('place:' + placeId);
    return c ? c.v : null;
  }

  /** Foglalas inditasa: a Salonic adatlap cime (iframe-be), a sajat azonositoval (back). */
  async function beginBooking({ placeId, serviceId, startUnix, staffId = ANY_STAFF, bookingId = null }) {
    helyszin(placeId);
    const service = await findService(placeId, serviceId);
    if (!Number.isInteger(startUnix)) throw new SalonicError('PARSE', 'startUnix kotelezo (egesz, unix mp)');
    const q = new URLSearchParams({ placeId, serviceId: service.serviceId, employeeId: staffId, startDate: startUnix, lang: 'hu' });
    const id = bookingId && BOOKING_ID_PATTERN.test(String(bookingId)) ? String(bookingId) : null;
    if (id) q.set(BOOKING_ID_PARAM, id);
    return {
      guestDataUrl: `${HOST}/guestData/?${q}`,
      expected: { placeId: +placeId, serviceId: service.serviceId, startUnix, staffId, activePrice: service.activePrice, ...(id ? { bookingId: id } : {}) },
    };
  }

  return { getServices, getStaff, getAvailability, getPlace, getPresentation, beginBooking, verifyConfirmation, clearCache: () => { cache.clear(); chunkCache.clear(); } };
}
