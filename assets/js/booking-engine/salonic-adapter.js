// MOSAIC Booking Engine V1 - SalonicAdapter
//
// Fuggetlen modul (bongeszo es Node, nincs fuggosege). A Salonic NYILVANOS felületeire epul; az audit
// (docs/booking-engine/PMU_LIVE_ADAPTER_FINDINGS.md) szerint foglalas-API nincs, ezert:
//
//   olvasas   getServices / getStaff / getAvailability   a Salonic nyilvanos oldalaibol es naptar-API-jabol
//   foglalas  beginBooking                               a Salonic beagyazhato /guestData/ adatlap cime (a foglalast a
//                                                        Salonic rogziti, reCAPTCHA mogott) - mi nem kuldunk be semmit
//   ellenorzes verifyConfirmation                        a Salonic sikeres foglalas utani atiranyitasanak parameterei
//                                                        (first_booking, price, employee, location, service, g, bookingUrl)
//
// createBooking / getBooking / updateBooking NEM tamogatott (SalonicError NOT_SUPPORTED): ne hivjuk oket.
// A verifyConfirmation kliensoldali (URL-bol dolgozik), ezert hamisithato: a siker "atiranyitas-alapu", nem szerver-oldali.
//
// Szolgaltatas-ID, ar, idotartam, munkatars soha nincs beleegetve: mindig a Salonicbol olvassuk. Ami nem olvashato, az
// null (nem talalunk ki erteket). A Salonic oldalai nem szerzodeses felulet - hiba eseten a hivo (UI) tartalekkent a
// Salonic eredeti oldalara dobhat (lasd saloniclink / guestDataUrl).

export const TIMEZONE = 'Europe/Budapest';

// Uzletagankent a technikai fiok (az auditbol; a 14585/10427 stb. a site kodjaban is igy szerepel).
// calendarId: a Salonic naptar-azonositoja (uzletagonkent allando; ha a Salonic elutasitja, az adapter a selectDate oldalbol olvassa ki ujra).
// specIds / employeeId csak ott kell, ahol a Salonic kategoriaoldala nem listaz (Lezer: egymunkatarsas, PMU: munkatarsoldal).
export const BUSINESSES = Object.freeze({
  headspa: { account: 'mosaicheadspa', host: 'https://mosaicheadspa.salonic.hu', placeId: 10427, calendarId: 'ebf1c485-e15e-d57f-de78-284a6591ece4' },
  hair: { account: 'mosaic-hair', host: 'https://mosaic-hair.salonic.hu', placeId: 10823, calendarId: 'f2bf7672-fa03-f092-e14b-fc23577e5ab2' },
  oxygen: { account: 'mosaic-oxigen', host: 'https://mosaic-oxigen.salonic.hu', placeId: 14409, calendarId: 'de045315-2757-ad57-0d83-d86a7b287c78' },
  laser: { account: 'mosaic-elysion', host: 'https://mosaic-elysion.salonic.hu', placeId: 14586, specIds: [66404, 66405], calendarId: '02742cf7-07cb-a3ef-fc7c-b871c86ce163' },
  pmu: { account: 'mosaic-pmu', host: 'https://mosaic-pmu.salonic.hu', placeId: 14585, employeeId: 32428 },
});

const API_URL = 'https://api.salonic.hu/calendar/getAvailableTimes';
const ANY_STAFF = -1;

export class SalonicError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'SalonicError';
    this.code = code; // NOT_SUPPORTED | UNKNOWN_BUSINESS | SERVICE_NOT_FOUND | HTTP | PARSE | NO_CALENDAR | API_STATUS | TIMEOUT
    Object.assign(this, extra);
  }
}

// --- tiszta segedek (egyseg-tesztelhetok) ------------------------------------------------------------------------------
const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>' };
export const decodeEntities = (s) => String(s ?? '').replace(/&(?:amp|quot|#0?39|lt|gt);/g, (m) => ENTITIES[m]);
const clean = (s) => decodeEntities(s).replace(/\s+/g, ' ').trim();
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decodeEntities(m[2])]));
const toInt = (v) => (v === undefined || v === null || v === '' ? null : Number.isFinite(+v) ? Math.round(+v) : null);
const digits = (v) => { const d = String(v ?? '').replace(/[^\d]/g, ''); return d ? +d : null; };
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// A Salonic a data-name erteket idezojel-kezeles nelkul irja ki (pl. data-name="... MOSAIC "Relax" Head Spa ..."), ezert a
// szabvanyos attributum-olvasas az elso belso idezojelnel levagna a nevet. A nevet a kovetkezo data-* attributumig olvassuk.
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
    // "Ajaktetovalas - Aquarell - 124.900 Ft helyett most": a "helyett" ar a listaar, a data-price az aktualis ar
    const helyett = name.match(/([\d.]+)\s*Ft helyett most/i);
    out.push({
      serviceId: a['data-id'],
      name,
      durationMin: toInt(a['data-duration']),
      activePrice: toInt(a['data-price']), // null, ha ures; a 0 valodi 0 (pl. ingyenes konzultacio)
      listPrice: helyett ? digits(helyett[1]) : null, // egyebkent a listaar nem olvashato
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

export const parseCalendarId = (html) => (String(html).match(/calendarId:\s*'([^']+)'/) || [])[1] || null;

/**
 * A Salonic-fiok "Egyeni CSS URL" beallitasa: ha a fiok betolti a MOSAIC kozos stiluslapjat (salonic/pmu.css, salonic/mosaic.css),
 * az oldalaban megjelenik egy <link rel="stylesheet" href="https://www.mosaicheadspa.hu/salonic/...css">. A motor ebbol tudja, hogy
 * a beagyazott adatlap tomor (egy kepernyos) vagy az alap, magas kinezetu, es ehhez meretezi a keretet.
 */
export function parseCustomCss(html, hosts = ['www.mosaicheadspa.hu', 'mosaicheadspa.hu']) {
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const a = attrsOf(m[0]);
    if (!/stylesheet/i.test(a.rel || '') || !a.href) continue;
    try { const u = new URL(a.href); if (hosts.includes(u.hostname) && /^\/salonic\/[^/]+\.css$/i.test(u.pathname)) return a.href; } catch (e) { /* hibas href */ }
  }
  return null;
}

/** A naptar-API valaszabol szabad idopontok (a UI-szerzodes: MASTER SPEC 6.). A "-1" kulcsu blokk ures helykitolto, kimarad. */
export function slotsFromApi(json, ctx) {
  if (!json || json.status !== 'success') throw new SalonicError('API_STATUS', 'A naptar-API nem sikeres valaszt adott: ' + (json && json.status), { status: json && json.status });
  const { business, service, minUnix = 0 } = ctx;
  const slots = [];
  for (const perDay of Object.values((json.data && json.data.blocks) || {})) {
    for (const [staffId, k] of Object.entries(perDay)) {
      if (staffId === String(ANY_STAFF)) continue;
      for (const s of Object.values(k.slots || {})) {
        if (!(s.timestamp > minUnix)) continue;
        const startUnix = +s.timestamp;
        slots.push({
          slot_id: `${business}:${service.serviceId}:${staffId}:${startUnix}`,
          start_at: new Date(startUnix * 1000).toISOString(),
          end_at: service.durationMin ? new Date((startUnix + service.durationMin * 60) * 1000).toISOString() : null,
          start_unix: startUnix,
          staff_id: staffId,
          staff_label: clean(k.employeeName) || null,
          service_id: service.serviceId,
          available: true,
          list_price: service.listPrice,
          final_price: service.activePrice, // a Salonic aktualis ara; ennel tobbet (munkatarsi akcio, aznapi ar) nem tudunk
          pricing_rule: null,
          formatted: s.formattedFull || s.formatted || null,
        });
      }
    }
  }
  return slots.sort((a, b) => a.start_unix - b.start_unix || String(a.staff_id).localeCompare(String(b.staff_id)));
}

/**
 * A Salonic sikeres foglalas utani atiranyitasanak ellenorzese a vart valasztassal szemben.
 * expected: { business, serviceId, startUnix, staffId (-1 = barki), staffName?, activePrice }.
 * Kliensoldali (URL), ezert csak "atiranyitas-alapu" bizonyitek. booking_id nincs: bookingRef szintetikus (g-serviceId-startDate).
 */
export function verifyConfirmation(urlOrQuery, expected, businesses = BUSINESSES) {
  const cfg = businesses[expected.business];
  if (!cfg) throw new SalonicError('UNKNOWN_BUSINESS', 'Ismeretlen uzletag: ' + expected.business);
  const u = new URL(String(urlOrQuery), 'https://redirect.invalid');
  const q = u.searchParams;
  const missing = ['price', 'employee', 'g', 'bookingUrl'].filter((k) => !q.get(k));
  const checks = {};
  const set = (name, status, exp, act) => { checks[name] = { status, expected: exp ?? null, actual: act ?? null }; };

  let bu = null;
  try { if (q.get('bookingUrl')) bu = new URL(q.get('bookingUrl'), cfg.host); } catch (e) { /* hibas bookingUrl */ }
  const buServiceId = bu && bu.searchParams.get('serviceId');
  const buStart = bu && toInt(bu.searchParams.get('startDate'));
  const buPlace = bu && toInt(bu.searchParams.get('placeId'));
  const buHost = bu && bu.hostname;

  set('params', missing.length ? 'fail' : 'pass', null, missing.length ? 'hianyzik: ' + missing.join(', ') : null);
  set('place', bu ? (buHost === new URL(cfg.host).hostname && (buPlace === null || buPlace === cfg.placeId) ? 'pass' : 'fail') : 'fail', `${new URL(cfg.host).hostname}/placeId ${cfg.placeId}`, bu ? `${buHost}/placeId ${buPlace}` : null);
  set('service', buServiceId ? (buServiceId === String(expected.serviceId) ? 'pass' : 'fail') : 'fail', String(expected.serviceId), buServiceId);
  set('slot', buStart !== null ? (buStart === expected.startUnix ? 'pass' : 'fail') : 'fail', expected.startUnix, buStart);
  const employee = q.get('employee');
  if (expected.staffId === ANY_STAFF || expected.staffId === undefined || expected.staffId === null) set('staff', 'skipped', 'barki', employee);
  else if (!expected.staffName) set('staff', 'skipped', String(expected.staffId), employee); // nincs nev, amihez hasonlitani lehetne
  else set('staff', employee && (norm(employee) === norm(expected.staffName) || norm(employee).includes(norm(expected.staffName)) || norm(expected.staffName).includes(norm(employee))) ? 'pass' : 'fail', expected.staffName, employee);
  const price = digits(q.get('price'));
  // elfogadhato arak: a vart ar + a szakemberi kedvezmenyes arak (pl. "barmely szakember" valasztasnal a Salonic a kedvezmenyes
  // szakemberhez is oszthat); egyik sem olvashato = kihagyott ellenorzes
  const accepted = [expected.activePrice, ...(expected.acceptablePrices || [])].filter((v) => v !== null && v !== undefined);
  if (!accepted.length) set('price', 'skipped', null, price); // a Salonic nem adott kiolvashato arat
  else set('price', price === null ? 'fail' : accepted.includes(price) ? 'pass' : 'fail', accepted.join(' / '), price);

  const ok = Object.values(checks).every((c) => c.status !== 'fail');
  return {
    ok,
    checks,
    bookingRef: q.get('g') && buServiceId && buStart !== null ? `${q.get('g')}-${buServiceId}-${buStart}` : null,
    bookingRefKind: 'synthetic', // a Salonic nem ad booking_id-t az atiranyitasban
    firstBooking: q.get('first_booking') === 'true', // a Salonic sajat uj/visszatero jelzese (acquisition guardrail alapja)
    reported: { price, employee, location: q.get('location'), service: q.get('service'), guestId: q.get('g') },
    attestation: 'redirect-url: kliensoldali, nem szerver-oldali ellenorzes',
  };
}

// --- az adapter ---------------------------------------------------------------------------------------------------------
export function createSalonicAdapter({ fetchImpl = globalThis.fetch, now = () => Date.now(), timeoutMs = 15000, retries = 1, cacheMs = 5 * 60 * 1000, businesses = BUSINESSES, storage = null, persistMs = 10 * 60 * 1000 } = {}) {
  const cache = new Map(); // kulcs -> { t, v }
  // A tartos (sessionStorage) gyorsitotar: a szolgaltatas-lista / hely ket oldalbetoltes kozott is megmarad (a foglalo masodik megnyitasa azonnali);
  // az ar / idotartam legfeljebb persistMs-ig regi (a C4-nel az ar ellenorzese ugyis a Salonic atiranyitasa alapjan tortenik).
  const readPersist = (key) => { if (!storage) return undefined; try { const j = JSON.parse(storage.getItem('mhSalonic:' + key)); if (j && now() - j.t < persistMs) return j.v; } catch (e) { /* hibas / hianyzo bejegyzes */ } return undefined; };
  const writePersist = (key, v) => { if (!storage) return; try { storage.setItem('mhSalonic:' + key, JSON.stringify({ t: now(), v })); } catch (e) { /* tele / tiltott tarolo */ } };
  const cached = async (key, fn, { persist = false } = {}) => {
    const c = cache.get(key);
    if (c && now() - c.t < cacheMs) return c.v;
    if (persist) { const p = readPersist(key); if (p !== undefined) { cache.set(key, { t: now(), v: p }); return p; } }
    const v = await fn();
    cache.set(key, { t: now(), v });
    if (persist) writePersist(key, v);
    return v;
  };
  const cfgOf = (business) => {
    const c = businesses[business];
    if (!c) throw new SalonicError('UNKNOWN_BUSINESS', 'Ismeretlen uzletag: ' + business);
    return c;
  };

  // csak GET: idokorlat + egy ujraprobalas halozati/5xx hibara (a foglalas nem megy rajta, nincs mellekhatas)
  async function getText(url) {
    let last;
    for (let i = 0; i <= retries; i++) {
      const ab = new AbortController();
      const timer = setTimeout(() => ab.abort(), timeoutMs);
      try {
        const r = await fetchImpl(url, { credentials: 'omit', signal: ab.signal });
        if (r.status >= 500 && i < retries) { last = new SalonicError('HTTP', 'HTTP ' + r.status, { url, status: r.status }); continue; }
        if (!r.ok) throw new SalonicError('HTTP', 'HTTP ' + r.status, { url, status: r.status });
        return await r.text();
      } catch (e) {
        if (e instanceof SalonicError && e.code === 'HTTP' && e.status < 500) throw e;
        last = e instanceof SalonicError ? e : new SalonicError(e && e.name === 'AbortError' ? 'TIMEOUT' : 'HTTP', 'Lekeres sikertelen: ' + (e && e.message), { url });
      } finally { clearTimeout(timer); }
    }
    throw last;
  }

  // A szolgaltatas-lista + az egyeni CSS jele: a kategoria-oldalak PARHUZAMOSAN toltodnek (a fodraszatnal 14 oldal), a sorrend a kategoriak sorrendje marad.
  const servicesRaw = (business) => cached('services:' + business, async () => {
    const cfg = cfgOf(business);
    const found = [];
    let customCss = null;
    const page = async (url) => { const t = await getText(url); customCss = customCss || parseCustomCss(t); return t; }; // az egyeni CSS jelet a mar letoltott oldalakbol olvassuk
    const add = (list, spec) => { for (const s of list) if (!found.some((x) => x.serviceId === s.serviceId)) found.push({ ...s, specId: spec ? spec.specId : null, category: spec ? spec.name : null }); };
    if (cfg.employeeId) add(parseServices(await page(`${cfg.host}/employees/${cfg.employeeId}/?placeId=${cfg.placeId}`)), null);
    let specs = (cfg.specIds || []).map((id) => ({ specId: String(id), name: null }));
    if (!specs.length && !cfg.employeeId) specs = parseSpecs(await page(`${cfg.host}/selectSpecialization/?placeId=${cfg.placeId}`));
    const oldalak = await Promise.all(specs.map((spec) => page(`${cfg.host}/showServices/?placeId=${cfg.placeId}&specId=${spec.specId}`)));
    specs.forEach((spec, i) => add(parseServices(oldalak[i]), spec));
    if (!found.length) throw new SalonicError('PARSE', `Nem talaltam szolgaltatast: ${business}`, { business });
    return { found, customCss };
  }, { persist: true });

  async function getServices(business) { return (await servicesRaw(business)).found; }

  /** Az adatlap megjelenese: { customCss } - a MOSAIC kozos stiluslapjanak cime, ha a Salonic-fiok betolti; egyebkent null (alap kinezet). */
  async function getPresentation(business) {
    return { customCss: (await servicesRaw(business)).customCss || null };
  }

  async function findService(business, serviceId) {
    const s = (await getServices(business)).find((x) => x.serviceId === String(serviceId));
    if (!s) throw new SalonicError('SERVICE_NOT_FOUND', `A(z) ${serviceId} szolgaltatas nincs a Salonic aktualis listajaban (${business})`, { business, serviceId });
    return s;
  }

  // A naptar-azonosito uzletagonkent allando (a szolgaltatasok kozott nem valtozik): a beallitott (cfg.calendarId) azonnal hasznalhato, nem kell hozza
  // a selectDate oldal (0,8-2 mp). Ha a Salonic elutasitja (megvaltozott), a selectDate oldalbol olvassuk ki ujra.
  const calendarFromPage = (business, serviceId) => cached('calendar:' + business, async () => {
    const cfg = cfgOf(business);
    const id = parseCalendarId(await getText(`${cfg.host}/selectDate/?employeeId=${ANY_STAFF}&placeId=${cfg.placeId}&serviceId=${serviceId}`));
    if (!id) throw new SalonicError('NO_CALENDAR', 'Nem talaltam naptar-azonositot', { business, serviceId });
    return id;
  });
  const calendarOverride = new Map();
  const calendarId = async (business, serviceId) => calendarOverride.get(business) || cfgOf(business).calendarId || calendarFromPage(business, serviceId);

  // Egy naptar-API hivas: [startDate, startDate + days nap) szabad idopontjai (minden minLead-szuro nelkul; a hivo szur)
  async function fetchSlots(business, service, staffId, startDate, days) {
    const cfg = cfgOf(business);
    const run = async (calId) => {
      const p = new URLSearchParams({ startDate, offset: 0, days, placeId: cfg.placeId, serviceId: service.serviceId, employeeId: staffId, calendarId: calId, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0 });
      let json;
      try { json = JSON.parse(await getText(API_URL + '?' + p)); } catch (e) { if (e instanceof SalonicError) throw e; throw new SalonicError('PARSE', 'A naptar-API valasza nem JSON', { business }); }
      return json;
    };
    let json = await run(await calendarId(business, service.serviceId));
    if ((!json || json.status !== 'success') && cfg.calendarId && !calendarOverride.has(business)) { // a beallitott azonosito mar nem jo: kiolvasas a Salonic oldalabol
      const id = await calendarFromPage(business, service.serviceId);
      if (id !== cfg.calendarId) { calendarOverride.set(business, id); json = await run(id); }
    }
    const d = (json && json.data) || {};
    if (d.placeName || d.placeAddress) cache.set('place:' + business, { t: now(), v: { name: clean(d.placeName) || null, address: clean(d.placeAddress) || null, phone: clean(d.placePhone) || null } });
    return slotsFromApi(json, { business, service, minUnix: 0 });
  }

  // A szabad idopontok: a keresett idoszak parhuzamos reszekre (legfeljebb CHUNK_DAYS nap) bontva toltodik (a Salonic naptar-API ideje a napok szamaval no:
  // 92 nap a fodraszatnal 4 mp, 14 nap 1 mp); firstDays-szel az elso resz kulon, hamarabb erkezik (first), a teljes lista kesobb (full).
  // Az egyes reszek rovid ideig (AVAIL_MS) megosztottak: az elolegzett (prefetch) kereses eredmenyet a megnyilo naptar azonnal megkapja. A kezdo idopont
  // 5 percre kerekitett (a "most - 3 ora" korlat miatt ez artalmatlan), igy az elolegzett es a kesobbi kereses kulcsa megegyezik.
  const CHUNK_DAYS = 31;
  const AVAIL_MS = 90 * 1000;
  const chunkCache = new Map();
  function chunk(business, service, staffId, startDate, n) {
    const key = [business, service.serviceId, staffId, startDate, n].join(':');
    const hit = chunkCache.get(key);
    if (hit && now() - hit.t < AVAIL_MS) return hit.p;
    const p = fetchSlots(business, service, staffId, startDate, n);
    chunkCache.set(key, { t: now(), p });
    p.catch(() => { const c = chunkCache.get(key); if (c && c.p === p) chunkCache.delete(key); }); // hiba utan a kovetkezo hivas ujra probalja
    return p;
  }
  const mergeSlots = (ls) => { const seen = new Set(); return ls.flat().filter((s) => (seen.has(s.slot_id) ? false : seen.add(s.slot_id))).sort((a, b) => a.start_unix - b.start_unix || String(a.staff_id).localeCompare(String(b.staff_id))); };

  /**
   * Szabad idopontok. from: unix mp (alap: most - 3 ora, hogy a budapesti nap elejet is tartalmazza), days: alap 14.
   * firstDays + onMore: az elso firstDays nap azonnal visszater, a teljes (days napos) lista kesobb az onMore(lista | null, hiba) hivasban erkezik.
   */
  async function getAvailability(business, serviceId, { staffId = ANY_STAFF, from, days = 14, minLeadMinutes = 0, firstDays = null, onMore = null } = {}) {
    const service = await findService(business, serviceId);
    const base = from ?? Math.floor((Math.floor(now() / 1000) - 3 * 3600) / 300) * 300;
    const split = (off, n) => { const k = Math.ceil(n / CHUNK_DAYS); const per = Math.ceil(n / k); return Array.from({ length: k }, (_, i) => [off + i * per, Math.min(per, n - i * per)]).filter(([, d]) => d > 0); };
    const f = firstDays && firstDays < days ? firstDays : null;
    const plan = f ? [[0, f], ...split(f, days - f)] : split(0, days);
    const lists = plan.map(([off, n]) => chunk(business, service, staffId, base + off * 86400, n));
    const minUnix = Math.floor(now() / 1000) + minLeadMinutes * 60;
    const keep = (l) => l.filter((x) => x.start_unix > minUnix);
    const full = Promise.all(lists).then(mergeSlots);
    if (f && onMore) { full.then((l) => onMore(keep(l)), (e) => onMore(null, e)); return keep(await lists[0]); }
    return keep(await full);
  }

  /** A helyszin neve, cime, telefonja (a naptar-API valaszabol; a cim nincs beleegetve). */
  async function getPlace(business) {
    const c = cache.get('place:' + business);
    if (c) return c.v;
    const first = (await getServices(business)).find((s) => s.durationMin);
    if (first) await getAvailability(business, first.serviceId, { days: 1 });
    const c2 = cache.get('place:' + business);
    return c2 ? c2.v : { name: null, address: null, phone: null };
  }

  /** A szolgaltatashoz tartozo munkatarsak: azonosito a Salonic szolgaltatas-listajabol, nev a naptar-API-bol (csak ha van szabad idopontja a keretben: days nap). */
  async function getStaff(business, serviceId, { days = 60 } = {}) {
    const service = await findService(business, serviceId);
    const cfg = cfgOf(business);
    const ids = service.staffIds.length ? service.staffIds : cfg.employeeId ? [String(cfg.employeeId)] : [];
    const names = new Map();
    for (const s of await getAvailability(business, serviceId, { days })) if (!names.has(s.staff_id)) names.set(s.staff_id, s.staff_label);
    return ids.map((id) => ({ staff_id: id, staff_label: names.get(id) ?? null }));
  }

  /** Foglalas inditasa: a Salonic adatlap cime (iframe-be vagy tartalekkent uj lapon). Ismeretlen szolgaltatasra nem ad cimet. */
  async function beginBooking({ business, serviceId, startUnix, staffId = ANY_STAFF }) {
    const cfg = cfgOf(business);
    const service = await findService(business, serviceId);
    if (!Number.isInteger(startUnix)) throw new SalonicError('PARSE', 'startUnix kotelezo (egesz, unix mp)');
    const q = new URLSearchParams({ placeId: cfg.placeId, serviceId: service.serviceId, employeeId: staffId, startDate: startUnix });
    return {
      guestDataUrl: `${cfg.host}/guestData/?${q}`,
      expected: { business, serviceId: service.serviceId, startUnix, staffId, activePrice: service.activePrice },
    };
  }

  const notSupported = (name) => async () => { throw new SalonicError('NOT_SUPPORTED', `${name}: a Salonic nyilvanos feluleten nincs ilyen muvelet (lasd docs/booking-engine/PMU_LIVE_ADAPTER_FINDINGS.md)`); };

  return {
    capabilities: Object.freeze({ createBooking: false, getBooking: false, updateBooking: false, bookingId: 'synthetic', priceReadback: 'redirect-attested' }),
    businesses: Object.keys(businesses),
    getServices, getStaff, getAvailability, getPlace, getPresentation, beginBooking,
    verifyConfirmation: (url, expected) => verifyConfirmation(url, expected, businesses),
    createBooking: notSupported('createBooking'),
    getBooking: notSupported('getBooking'),
    updateBooking: notSupported('updateBooking'),
    clearCache: () => cache.clear(),
  };
}
