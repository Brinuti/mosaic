// MOSAIC Booking Engine V1 - lepes-meres (DECISION-LOG #88): a foglalo lepes-eseményei ket csatornan.
//
//  1. GA4 (dataLayer): CSAK elfogadott statisztikai hozzajarulasnal (mhSuti.engedely('ana')). Pontosan ezek az esemenynevek:
//     booking_open, booking_business, booking_service, booking_slots_loaded (load_ms), booking_slot, booking_form_start, booking_submit,
//     booking_success, booking_close (step = a lepes, ahol bezartak), booking_error (error_type). Minden esemenyen: business, service_id, source_page.
//  2. Nevtelen belso szamlalo (POST /api/foglalo-szamlalo, lasd netlify/lib/foglalo-szamlalo.js): MINDEN latogatora, hozzajarulastol fuggetlenul,
//     suti / azonosito / szemelyes adat nelkul; a szerver csak naponkenti, uzletagankenti darabszamot tarol.
//
// NINCS szemelyes adat: se nev, se e-mail, se telefonszam, se foglalas-azonosito, se URL-lekerdezes (a source_page csak az oldal utvonala, megszurve).
// A modul a regi tracking.js szerzodest (booking_open / booking_error is) NEM bantja: a tracking.js ezt a ket nevet a dataLayer-be mar nem irja
// (lasd RESERVED_BY_STEPS), igy egy lepesrol csak egy esemeny jon. Az esemenyek a foglalo SAJAT lepesein szuletnek (kattintas / betoltes), nem
// az ujrarajzolason, es a "per ules" kulcsok miatt egy lepes ketszer nem szamolodik.
//
// booking_submit: az "Idopont lefoglalasa" gomb a Salonic beagyazott adatlapjan van (idegen eredet, nem megfigyelheto). A beadast onnan latjuk,
// hogy az adatlap a SAJAT oldalunkra iranyit vissza (sikeres foglalas / elkelt idopont): ez a megfigyelheto "elkuldte" jel.

export const ESEMENYEK = Object.freeze({
  open: 'booking_open', business: 'booking_business', service: 'booking_service', slots_loaded: 'booking_slots_loaded', slot: 'booking_slot',
  form_start: 'booking_form_start', submit: 'booking_submit', success: 'booking_success', close: 'booking_close', error: 'booking_error',
});
export const UZLETAGAK = Object.freeze(['headspa', 'hair', 'oxygen', 'laser', 'pmu', 'gift']);
export const HIBA_TIPUSOK = Object.freeze(['salonic_api', 'no_slots', 'timeout', 'validation', 'slot_lost', 'hold_expired', 'verify_failed', 'unknown_redirect', 'callback_failed', 'client_error']);
// Hiba-reszlet (DECISION #188, 2026-10-15): CSAK a belso szamlalonak (nem a GA4-nek): <hibatipus>.<nezet-kod>.<hibakod>.<http> darabszam, URL / uzenet / azonosito nelkul.
export const HIBA_KODOK = Object.freeze(['HTTP', 'PARSE', 'API_STATUS', 'SERVICE_NOT_FOUND', 'NO_CALENDAR', 'UNKNOWN_BUSINESS', 'NOT_SUPPORTED', 'TIMEOUT', 'OTHER', 'NONE']);
export const RESZLET_LEPES = 'error_reszlet';
export const VEGPONT = '/api/foglalo-szamlalo';
// A regi tracking.js ezt a ket nevet a dataLayer-be nem irja (a lepes-meres adja, a spec szerinti parameterekkel)
export const RESERVED_BY_STEPS = Object.freeze(['booking_open', 'booking_error']);

const NINCS = 'none';
/**
 * Probajeloles (Feri, 2026-10-11): a ?proba=1 ezt a bongeszot tartosan probanak jeloli (localStorage mhProba=1), a ?proba=0 torli.
 * Probabol sem a GA4, sem a belso szamlalo nem kap lepest (a probafoglalasok ne torzitsak a napi szamokat). Hiba / tiltott tarolo: nem proba.
 */
export const PROBA_KULCS = 'mhProba';
export function probaJel(win) {
  try {
    const q = new win.URLSearchParams(win.location.search).get('proba');
    const ls = win.localStorage;
    if (q === '1') ls.setItem(PROBA_KULCS, '1'); else if (q === '0') ls.removeItem(PROBA_KULCS);
    return ls.getItem(PROBA_KULCS) === '1';
  } catch (e) { return false; }
}
/** Az oldal utvonala a GA4-nek / a szamlalonak: csak /betu-szam-kotojel-pont-alahuzas, lekerdezes / horgony / @ nelkul; ami nem az, '(direct)'. */
export function tisztaOldal(p) {
  if (typeof p !== 'string') return '(direct)';
  const s = p.split(/[?#]/)[0].slice(0, 80);
  return /^\/[A-Za-z0-9À-ɏ/_\-.%~]*$/.test(s) && !s.includes('@') ? s : '(direct)';
}
const tisztaUzletag = (b) => (UZLETAGAK.includes(b) ? b : NINCS);
const tisztaSzolgaltatas = (id) => (id !== undefined && id !== null && /^[A-Za-z0-9_-]{1,40}$/.test(String(id)) ? String(id) : NINCS);
/**
 * A hiba-reszlet tipusa: { code, status } -> '<hibatipus>.<nezet-kod>.<hibakod>.<http>', vagy null, ha az adott hibatipus nem hordoz reszletet.
 * Zart listak, a szerver ervenyesitesevel egyezoen (a kimenet MINDIG elfogadhato): timeout -> TIMEOUT, client_error -> NONE, salonic_api -> az adapter hibakodja (ismeretlen: OTHER);
 * a nezet-kod a foglalo nezeteinek alakja (C1, HS1, A3_SENT, ...), minden mas 'ismeretlen'; HTTP-statusz csak HTTP / API_STATUS kod mellett (100-599), egyebkent 0. Csak darabszam-kulcs, szemelyes adat nincs.
 */
const RESZLET_KODOK = Object.freeze({ timeout: ['TIMEOUT'], client_error: ['NONE'], salonic_api: HIBA_KODOK.filter((k) => k !== 'NONE' && k !== 'TIMEOUT') });
export function hibaReszlet(hibaTipus, step, reszlet) {
  const lehet = RESZLET_KODOK[hibaTipus];
  if (!lehet) return null;
  const { code, status } = reszlet && typeof reszlet === 'object' ? reszlet : {};
  const kod = lehet.length === 1 ? lehet[0] : (lehet.includes(code) ? code : 'OTHER');
  const nezet = typeof step === 'string' && /^[A-Z][A-Z0-9_]{0,11}$/.test(step) ? step : 'ismeretlen';
  const http = (kod === 'HTTP' || kod === 'API_STATUS') && Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
  return `${hibaTipus}.${nezet}.${kod}.${http}`;
}

/**
 * win: az ablak (mock-olhato); ctx: parseContext() eredmenye; ido: () => ms.
 * A visszaadott meter-nek egy metodusa van lepesenkent; mind biztonsagosan hivhato (hiba sosem akadalyozza a foglalast).
 */
export function createStepMeter({ win = typeof window !== 'undefined' ? window : null, ctx = {}, ido = () => Date.now() } = {}) {
  const allapot = { business: tisztaUzletag(ctx.business), serviceId: NINCS };
  const forras = tisztaOldal(ctx.sourcePage || (win && win.location ? win.location.pathname : ''));
  const kulcsok = new Set();
  const proba = win ? probaJel(win) : false;
  let lezarva = false;
  const egyszer = (k) => { if (kulcsok.has(k)) return false; kulcsok.add(k); return true; };

  // a statisztikai hozzajarulas (mhSuti.engedely('ana')); a dontes barmikor valtozhat, ezert esemenyenkent kerdezzuk
  const hozzajarult = () => { try { const s = win && win.mhSuti; return !!(s && typeof s.engedely === 'function' && s.engedely('ana')); } catch (e) { return false; } };
  // robot (Playwright / WebDriver) nem szamolodik a belso szamlaloba, kiveve a probafuttatas kifejezett jelzesevel (a proba maga fogja el a kerest)
  const robot = () => { try { return !!(win.navigator && win.navigator.webdriver) && !win.__MH_SZAMLALO_PROBA; } catch (e) { return false; } };

  function kuld(adat) {
    try {
      if (!win || robot()) return;
      const torzs = JSON.stringify(adat);
      const nav = win.navigator;
      if (nav && typeof nav.sendBeacon === 'function') { if (nav.sendBeacon(VEGPONT, new win.Blob([torzs], { type: 'text/plain' }))) return; }
      if (typeof win.fetch === 'function') win.fetch(VEGPONT, { method: 'POST', body: torzs, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } }).catch(() => {});
    } catch (e) { /* a szamlalo hibaja nem akadalyozhatja a foglalast */ }
  }

  function jelez(lepes, { uzletag = allapot.business, extra = {}, szamlalo = {} } = {}) {
    try {
      if (proba) return; // probafoglalas: semmi nem megy (sem GA4, sem szamlalo)
      const nev = ESEMENYEK[lepes];
      // A GTM adatreteg-modellje az ertekeket megorzi: ami egy korabbi esemenyen rajta volt (load_ms, step, error_type), a kovetkezo esemenyre is atorokolodne
      // (pl. a booking_slot megkapna egy regi step-et, a booking_close egy regi error_type-ot). Ezert MINDEN esemeny mindhárom kulcsot felulirja: ami az adott
      // esemenyen nem ertelmezett, az undefined: a GTM ezt TOROLNI a modellbol, es a GA4-tag a parametert nem kuldi el (a null-t ures ertekkent kuldene: ep.step=;
      // kiprobalva a GTM 'Latest' kornyezeteben, lasd tools/meres-proba/lepes-proba.mjs --gtm-kornyezet).
      const adat = { event: nev, business: uzletag, service_id: allapot.serviceId, source_page: forras, load_ms: undefined, step: undefined, error_type: undefined, ...extra };
      if (hozzajarult() && win) { (win.dataLayer = win.dataLayer || []).push(adat); }
      kuld({ lepes, uzletag, ...szamlalo });
    } catch (e) { /* nem kritikus */ }
  }

  return {
    /** A foglalo megnyilt (egyszer ulesenkent). */
    open() { if (egyszer('open')) jelez('open'); },
    /** Az uzletag eldolt: a vendeg a kezdo kepernyon valasztott, vagy a link mar megmondta (egyszer uzletagankent). */
    business(b) {
      const u = tisztaUzletag(b); allapot.business = u; allapot.serviceId = NINCS;
      if (u !== NINCS && egyszer('business:' + u)) jelez('business', { uzletag: u });
    },
    /** Szolgaltatas-valasztas (minden valasztas szamit; az ujrarajzolas nem). */
    service(serviceId) { allapot.serviceId = tisztaSzolgaltatas(serviceId); jelez('service'); },
    /** Az idopontok megerkeztek (a foglalo kerte -> az elso adat), load_ms = a betoltes ideje; egyszer szolgaltatasonkent. */
    slotsLoaded(ms) {
      if (!egyszer('slots_loaded:' + allapot.serviceId)) return;
      const load = Math.max(0, Math.min(60000, Math.round(Number(ms) || 0)));
      jelez('slots_loaded', { extra: { load_ms: load }, szamlalo: { load_ms: load } });
    },
    /** Idopont-valasztas (minden valasztas szamit). */
    slot() { jelez('slot'); },
    /** Az adatlap (a Salonic beagyazott urlapja) megjelent: egyszer idopontonkent. */
    formStart(slotId) { if (egyszer('form_start:' + allapot.serviceId + ':' + slotId)) jelez('form_start'); },
    /** A vendeg beadta az adatlapot (a Salonic visszairanyitott a mi oldalunkra): egyszer idopontonkent. */
    submit(slotId) { if (egyszer('submit:' + allapot.serviceId + ':' + slotId)) jelez('submit'); },
    /** Ellenorzott sikeres foglalas: egyszer foglalasonkent (a foglalas azonositoja csak a kulcsban van, sehova nem kerul). */
    success(ref) { if (egyszer('success:' + ref)) jelez('success'); },
    /** Hiba: errorType a HIBA_TIPUSOK egyike; egyszer (tipus, lepes, szolgaltatas) hármasonkent. */
    error(errorType, step, reszlet) {
      const t = HIBA_TIPUSOK.includes(errorType) ? errorType : 'client_error';
      if (egyszer('error:' + t + ':' + step + ':' + allapot.serviceId)) {
        jelez('error', { extra: { error_type: t }, szamlalo: { tipus: t } });
        if (reszlet && !proba) { try { const rt = hibaReszlet(t, step, reszlet); if (rt) kuld({ lepes: RESZLET_LEPES, uzletag: allapot.business, tipus: rt }); } catch (e) { /* a modul minden hivasa biztonsagos: a reszlet hibaja sem akadalyozhatja a foglalast */ } } // hiba-reszlet: ugyanaz az egyszer-kapu, nincs GA4
      }
    },
    /** A reteg bezarult: step = a nezet kodja, ahol a vendeg bezarta (egyszer ulesenkent). */
    close(step) {
      if (lezarva) return; lezarva = true;
      const s = typeof step === 'string' && /^[A-Za-z0-9_]{1,12}$/.test(step) ? step : 'ismeretlen';
      jelez('close', { extra: { step: s }, szamlalo: { tipus: s } });
    },
    /** Teszteleshez: az aktualis allapot. */
    allapot: () => ({ ...allapot, forras }),
  };
}
