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
// DECISION #205 (2026-10-19, CSAK-MERES; a foglalasi folyamatot nem erinti): tovabbi, CSAK a belso szamlalonak szolo lepesek (a GA4 ezekbol NEM kap esemenyt / parametert):
//  verify_check (buko ellenorzes kodja), success_unverified (a verify-bukas ellenere letrejott foglalas), kimenet_ido (form_start -> kimenet idovodor), recovered (A2 utan sikeres),
//  a2_elofordulas (minden slot_lost / hold_expired elofordulas), lepes_bontas (lepes x forras x eszkoz), lepes_ido (lepes x idovodor a megnyitastol), c1_szabad / c1_elso_nap (C1: szabad idopontok),
//  price_irany (HS-2, 2026-10-23: a verify_check.price bukasanal a Salonic altal jelentett ar iranya a motor varthoz kepest: lt / gt / eq / unknown; osszeg, szolgaltatas NEM).
//  Zart listak, csak darabszam; az azonosito-ertek (gclid, fbclid, ttclid, utm) SOHA nem megy sehova, csak a 4 forras-kategoria neve. Lasd docs/booking-engine/LEPES_MERES.md 5c.
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

// --- DECISION #205 (2026-10-19): csak-meres bovites; a kliens es a szerver (netlify/lib/foglalo-szamlalo.js) ugyanazt a zart listat ismeri (teszt: egyezes) ---------------------------------
// Minden uj lepes CSAK a belso szamlalonak megy (nincs hozzajarulas-fuggo GA4-agu), tipus = zart lista(k) pontokkal osszefuzve; semmilyen szabad szoveg / azonosito nincs benne.
export const VERIFY_LEPES = 'verify_check';
export const NEM_IGAZOLT_LEPES = 'success_unverified';
export const KIMENET_LEPES = 'kimenet_ido';
export const RECOVERED_LEPES = 'recovered';
export const A2_LEPES = 'a2_elofordulas';
export const BONTAS_LEPES = 'lepes_bontas';
export const IDO_LEPES = 'lepes_ido';
export const C1_SZABAD_LEPES = 'c1_szabad';
export const C1_ELSO_LEPES = 'c1_elso_nap';
export const IRANY_LEPES = 'price_irany'; // HS-2: a bukott price-ellenorzes iranya (csak a verify_check.price-szal egy idoben)
export const BELSO_LEPESEK = Object.freeze([VERIFY_LEPES, NEM_IGAZOLT_LEPES, KIMENET_LEPES, RECOVERED_LEPES, A2_LEPES, BONTAS_LEPES, IDO_LEPES, C1_SZABAD_LEPES, C1_ELSO_LEPES, IRANY_LEPES]);
// a Salonic-atiranyitas ellenorzesenek (adapter.verifyConfirmation) bukhato ellenorzesei + a "nem volt mit ellenorizni" eset (S.expected hianya)
export const VERIFY_KODOK = Object.freeze(['params', 'place', 'service', 'slot', 'staff', 'price', 'no_expectation']);
// HS-2: a Salonic-atiranyitasban jelentett ar a motor varthoz kepest (lt = kisebb, gt = nagyobb, eq = egyezik, unknown = nem allapithato meg)
export const IRANYOK = Object.freeze(['lt', 'gt', 'eq', 'unknown']);
// form_start / megnyitas -> adott pillanat: zart idovodrok (a vodor-neve a hatar; a szerver ugyanezt a listat ismeri)
export const IDO_VODROK = Object.freeze([['lt5s', 5000], ['lt30s', 30000], ['lt60s', 60000], ['lt120s', 120000], ['lt300s', 300000], ['ge300s', Infinity]]);
export const KIMENETEK = Object.freeze(['success', 'success_unverified', 'verify_failed', 'slot_lost', 'hold_expired', 'c4_close']);
export const A2_OKOK = Object.freeze(['slot_lost', 'hold_expired']);
export const A2_SORSZAMOK = Object.freeze(['1', '2', '3', '4', 'ge5']); // az A2 elofordulasanak sorszama az ulesben (az 5. es a tovabbi: ge5)
export const RECOVERED_KIMENETEK = Object.freeze(['success', 'success_unverified']);
export const FORRASOK = Object.freeze(['google', 'meta', 'tiktok', 'egyeb']);
export const ESZKOZOK = Object.freeze(['mobil', 'asztali', 'tablet']);
export const BONTAS_LEPESEK = Object.freeze(['open', 'business', 'service', 'slots_loaded', 'slot', 'form_start', 'submit', 'success', 'success_unverified']); // a tolcser lepesei (+ a nem igazolt siker)
export const SZABAD_VODROK = Object.freeze(['0', '1-3', '4-10', '11-30', '31+']); // C1: a kovetkezo 7 nap szabad idopontjainak szama
export const ELSO_NAP_VODROK = Object.freeze(['ma', '1-2', '3-7', '8-14', '15+', 'nincs']); // C1: a legkorabbi szabad nap (hany nap mulva)
export const ESZKOZ_KUSZOB = Object.freeze({ mobil: 700, tablet: 1100 }); // az ablak szelessege (px): < 700 mobil (mint az engine telefon-elrendezese), < 1100 tablet, egyebkent asztali

/**
 * HS-2: a bukott price-ellenorzes (verify.checks.price: { expected: "26900 / 39900", actual: 29900 }) iranya. A "expected" a vart ar + az elfogadott (szakemberi) arak,
 * " / "-lel elvalasztva. lt: a jelentett ar az osszes elfogadott ar ALATT van; gt: FELETTE; eq: valamelyikkel egyezik (a bukott ellenorzesnel nem fordulhat elo, ez csak vedelem);
 * minden mas (hianyzo / nem szam, ket elfogadott ar KOZOTT, nem ertelmezheto): unknown. Csak a zart nevet adja vissza, az osszeg SOHA nem hagyja el a bongeszot.
 */
export function priceIrany(c) {
  try {
    const szam = (x) => { const n = typeof x === 'number' ? x : /^\d{1,9}$/.test(String(x === null || x === undefined ? '' : x).trim()) ? Number(String(x).trim()) : NaN; return Number.isFinite(n) ? n : NaN; };
    const jelentett = szam(c && c.actual);
    if (Number.isNaN(jelentett)) return 'unknown';
    const elfogadott = String(c && c.expected !== undefined && c.expected !== null ? c.expected : '').split('/').map((x) => szam(x)).filter((n) => !Number.isNaN(n));
    if (!elfogadott.length) return 'unknown';
    if (elfogadott.includes(jelentett)) return 'eq';
    if (jelentett < Math.min(...elfogadott)) return 'lt';
    if (jelentett > Math.max(...elfogadott)) return 'gt';
    return 'unknown';
  } catch (e) { return 'unknown'; }
}

/** Idotartam (ms) -> zart idovodor neve; nem szam: null (nincs mit kuldeni). */
export function idoVodor(ms) {
  const m = Number(ms);
  if (!Number.isFinite(m)) return null;
  return IDO_VODROK.find(([, hatar]) => Math.max(0, m) < hatar)[0];
}
/** Az ablak szelessege -> mobil | tablet | asztali (csak szelesseg-kuszob: nincs user-agent, nincs ujjlenyomat). Ismeretlen szelesseg: asztali. */
export function eszkozOsztaly(szelesseg) {
  const w = Number(szelesseg);
  if (!Number.isFinite(w) || w <= 0) return 'asztali';
  return w < ESZKOZ_KUSZOB.mobil ? 'mobil' : w < ESZKOZ_KUSZOB.tablet ? 'tablet' : 'asztali';
}
// forras-osztalyozas: a kattintas-azonosito kulcsanak LETE (az erteke sehova nem megy), utana az utm_source, utana a referrer gazdagepe; egyebkent egyeb
// SORREND: a Meta / TikTok azonosito (csak az URL-bol jon, mentett allapotbol nem potlodik) es az utm_source ELOBB, a Google-azonosito UTANA: a motor a megnyitas elott a mentett (mh_attr / _gcl_aw, 90 nap, hozzajarulassal)
// Google-azonositokkal potolja a kontextust, ezert egy Meta-hirdetesrol erkezo, korabban Google-ra kattintott latogato ne minosuljon 'google'-nak.
const AZONOSITO_FORRAS_ELSO = Object.freeze([['meta', ['fbclid']], ['tiktok', ['ttclid']]]);
const AZONOSITO_FORRAS_GOOGLE = Object.freeze(['gclid', 'gbraid', 'wbraid']);
const UTM_FORRAS = Object.freeze({ google: 'google', googleads: 'google', 'google-ads': 'google', adwords: 'google', facebook: 'meta', fb: 'meta', ig: 'meta', instagram: 'meta', meta: 'meta', tiktok: 'tiktok' });
const REFERRER_FORRAS = Object.freeze([['google', /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/], ['meta', /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|messenger\.com)$/], ['tiktok', /(^|\.)tiktok\.com$/]]);
/** { attribution, referrer } -> google | meta | tiktok | egyeb. Az attribution a motor kontextusa (parseContext): CSAK a kulcsok letet / az utm_source zart-listas erteket nezzuk, az azonosito erteket nem. */
export function forrasOsztaly(arg) {
  const { attribution = null, referrer = '' } = arg && typeof arg === 'object' ? arg : {};
  const a = attribution && typeof attribution === 'object' ? attribution : {};
  const van = (k) => typeof a[k] === 'string' && a[k] !== '';
  for (const [nev, kulcsok] of AZONOSITO_FORRAS_ELSO) if (kulcsok.some(van)) return nev;
  const utm = typeof a.utm_source === 'string' ? a.utm_source.trim().toLowerCase() : '';
  if (Object.prototype.hasOwnProperty.call(UTM_FORRAS, utm)) return UTM_FORRAS[utm];
  if (AZONOSITO_FORRAS_GOOGLE.some(van)) return 'google'; // megjegyzes: lehet a mentett (90 napos) Google-kattintas is, ha az aktualis URL-ben nincs azonosito
  try {
    const host = new URL(String(referrer)).hostname.toLowerCase();
    for (const [nev, re] of REFERRER_FORRAS) if (re.test(host)) return nev;
  } catch (e) { /* nincs / hibas referrer: egyeb */ }
  return 'egyeb';
}
/** A szabad idopontok szama -> zart vodor. */
export function szabadVodor(db) {
  const n = Number(db);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return n <= 3 ? '1-3' : n <= 10 ? '4-10' : n <= 30 ? '11-30' : '31+';
}
/** A legkorabbi szabad nap (ma-tol szamitott napok szama; null = nincs szabad idopont) -> zart vodor. */
export function elsoNapVodor(napok) {
  if (napok === null || napok === undefined || !Number.isFinite(Number(napok))) return 'nincs';
  const n = Number(napok);
  return n <= 0 ? 'ma' : n <= 2 ? '1-2' : n <= 7 ? '3-7' : n <= 14 ? '8-14' : '15+';
}
const budapestNap = (unix) => { // 'YYYY-MM-DD' budapesti ido szerint -> napsorszam (UTC-nap): ket nap kulonbsege = a naptari napok szama
  const k = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(unix * 1000));
  const [y, m, d] = k.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};
/**
 * C1 (a szabad idopontok nezet): a MAR betoltott idopont-listabol (nincs halozati hivas): a kovetkezo 7 nap szabad (kulonbozo kezdesu) idopontjainak szama + a legkorabbi szabad nap, zart vodorben.
 * slotok: a motor idopont-listaja ({ start_unix, staff_id }); staffId: a valasztott szakember (a motor "Elo foglaltsag" savjaval azonos szures); nowUnix: most (unix mp).
 * Vissza: { szabad: vodor, elso: vodor } vagy null, ha nem szamolhato. A lista nem modosul.
 */
export function c1Meres(slotok, { staffId = null, nowUnix } = {}) {
  const most = Number(nowUnix);
  if (!Array.isArray(slotok) || !Number.isFinite(most)) return null;
  const hatar = most + 7 * 86400;
  const idok = new Set(); let elso = null;
  for (const s of slotok) {
    if (!s || !Number.isFinite(s.start_unix) || s.start_unix <= most) continue;
    if (staffId && String(s.staff_id) !== String(staffId)) continue;
    if (s.start_unix <= hatar) idok.add(s.start_unix);
    if (elso === null || s.start_unix < elso) elso = s.start_unix;
  }
  return { szabad: szabadVodor(idok.size), elso: elsoNapVodor(elso === null ? null : budapestNap(elso) - budapestNap(most)) };
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
  // DECISION #205: a meter MEMORIABELI allapota (nincs tarolas, nincs idobelyeg-kuldes: csak vodor-darabok mennek a szamlalonak)
  const t0 = (() => { try { return Number(ido()); } catch (e) { return NaN; } })(); // a megnyitas ideje (a meter belso orajaval): a lepes-idok kiindulasa
  let eredet = 'egyeb'; let eszkoz = 'asztali'; // forras (google | meta | tiktok | egyeb) es eszkoz (mobil | tablet | asztali): egyszer, a megnyitaskor osztalyozva
  try { eredet = forrasOsztaly({ attribution: ctx && ctx.attribution, referrer: win && win.document ? win.document.referrer : '' }); } catch (e) { /* egyeb */ }
  try { eszkoz = eszkozOsztaly(win ? win.innerWidth : undefined); } catch (e) { /* asztali */ }
  let formStartMs = null; // az utolso adatlap-megjelenes (form_start) ideje: ebbol szamoljuk a kimenet-idot (csak ha volt form_start)
  let a2Fuggo = null; // az A2-t kivalto ok (slot_lost | hold_expired), amit a motor az A2 nezet megnyitasa elott jelzett (a2Ok); az A2 nezet egyszer hasznalja fel (nullazodik)
  let a2Db = 0; let a2Utolso = null; let a2UtolsoIdo = NaN; // az A2-k szama az ulesben, az utolso A2 oka (a recovered jelzohoz) es ideje (a dupla ertesites szurese)

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

  // DECISION #205: csak a belso szamlalonak; probabol nem, robotbol nem (kuld() maga szuri); minden hiba elnyelve (a meres hibaja sosem akadalyozhatja a foglalast)
  function belso(lepes, tipus, uzletag = allapot.business) {
    try {
      if (proba) return;
      kuld(tipus === undefined ? { lepes, uzletag } : { lepes, uzletag, tipus });
    } catch (e) { /* nem kritikus */ }
  }
  // egy tolcser-lepes forras x eszkoz bontasa + (a megnyitas kivetelevel) a megnyitastol eltelt ido vodre
  function bontas(lepes, uzletag) {
    try {
      if (!BONTAS_LEPESEK.includes(lepes)) return;
      belso(BONTAS_LEPES, `${lepes}.${eredet}.${eszkoz}`, uzletag);
      if (lepes === 'open') return;
      const v = idoVodor(Number(ido()) - t0);
      if (v) belso(IDO_LEPES, `${lepes}.${v}`, uzletag);
    } catch (e) { /* nem kritikus */ }
  }
  // form_start -> kimenet: az utolso adatlap-megjelenestol eltelt ido vodre (csak ha volt form_start); a kimenetek egy csoportja EGY idopontbol szamol, utana a kiindulas torlodik
  function kimenetek(nevek) {
    try {
      if (formStartMs === null) return;
      const v = idoVodor(Number(ido()) - formStartMs);
      formStartMs = null;
      if (v) for (const n of nevek) belso(KIMENET_LEPES, `${n}.${v}`);
    } catch (e) { /* nem kritikus */ }
  }
  // az A2 (elkelt idopont / lejart foglalasi ido) egy VALODI elofordulasa: a belso szamlalo MINDEN ilyet szamol (a GA4 egyszer-kapuja valtozatlan), sorszammal
  function a2Elofordulas(ok) {
    try {
      const most = Number(ido());
      // ugyanaz az ok, 2 mp-en belul, uj adatlap-megjelenes (form_start) nelkul = ugyanannak az elkelt idopontnak a dupla ertesitese (pl. ketszer megerkezo atiranyitas-jelzes): nem uj elofordulas
      if (ok === a2Utolso && Number.isFinite(most) && Number.isFinite(a2UtolsoIdo) && most - a2UtolsoIdo >= 0 && most - a2UtolsoIdo < 2000 && formStartMs === null) return;
      a2Db += 1; a2Utolso = ok; a2UtolsoIdo = most;
      belso(A2_LEPES, `${ok}.${a2Db >= 5 ? 'ge5' : a2Db}`);
      kimenetek([ok]);
    } catch (e) { /* nem kritikus */ }
  }
  // sikeres foglalas (success / success_unverified) egy A2 UTAN: ulesenkent egyszer
  function felgyogyult(kimenet) {
    try { if (a2Utolso && egyszer('recovered')) belso(RECOVERED_LEPES, `${a2Utolso}.${kimenet}`); } catch (e) { /* nem kritikus */ }
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
      bontas(lepes, uzletag); // DECISION #205: lepes x forras x eszkoz + idovodor (csak belso szamlalo)
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
    formStart(slotId) {
      try { formStartMs = Number(ido()); } catch (e) { formStartMs = null; } // a kimenet-ido kiindulasa (minden adatlap-megjelenes: az uj foglalasi ablak 5 perce ettol indul)
      if (egyszer('form_start:' + allapot.serviceId + ':' + slotId)) jelez('form_start');
    },
    /** A vendeg beadta az adatlapot (a Salonic visszairanyitott a mi oldalunkra): egyszer idopontonkent. */
    submit(slotId) { if (egyszer('submit:' + allapot.serviceId + ':' + slotId)) jelez('submit'); },
    /** Ellenorzott sikeres foglalas: egyszer foglalasonkent (a foglalas azonositoja csak a kulcsban van, sehova nem kerul). */
    success(ref) {
      if (!egyszer('success:' + ref)) return;
      jelez('success');
      kimenetek(['success']); felgyogyult('success'); // DECISION #205 (c), (d)
    },
    /**
     * DECISION #205 (a), (b): a Salonic atiranyitasa megerkezett, de az ellenorzes NEM igazolta (v = null: nem volt mit ellenorizni; vagy !v.ok). A motor ilyenkor is a koszonooldalra iranyit
     * (a foglalas a gyakorlatban letrejon), ezert a belso szamlalo kulon lepeskent szamolja: success_unverified (foglalas = success + success_unverified), a buko ellenorzesek kodjaival
     * (verify_check: egy darab minden buko ellenorzesre). A meglevo verify_failed hiba-szamlalas MARAD (a motor a meter.error-t kulon hivja). Igazolt (v.ok): nem tesz semmit (a success() szamolja).
     * Egyszer foglalasonkent (szolgaltatas + idopont); a GA4 ebbol semmit nem kap.
     */
    unverified(v, slotId) {
      try {
        if (v && v.ok) return;
        if (!egyszer('success_unverified:' + allapot.serviceId + ':' + slotId)) return;
        belso(NEM_IGAZOLT_LEPES);
        if (!v) belso(VERIFY_LEPES, 'no_expectation');
        else for (const [kod, c] of Object.entries(v.checks || {})) if (c && c.status === 'fail' && kod !== 'no_expectation' && VERIFY_KODOK.includes(kod)) belso(VERIFY_LEPES, kod);
        if (v && v.checks && v.checks.price && v.checks.price.status === 'fail') belso(IRANY_LEPES, priceIrany(v.checks.price)); // HS-2: csak a bukott price-ellenorzesnel; zart nev, osszeg nelkul
        bontas(NEM_IGAZOLT_LEPES, allapot.business);
        kimenetek(['success_unverified', 'verify_failed']); felgyogyult('success_unverified');
      } catch (e) { /* nem kritikus */ }
    },
    /**
     * DECISION #205 (d): az A2 nezetet kivalto ok, amit a motor KOZVETLENUL az A2 megnyitasa elott jelez: 'taken' (a vegso ellenorzes szerint elkelt), 'expired' (lejart a foglalasi ido),
     * 'redirect' (a Salonic elkelt idopontot jelzett vissza); minden mas (null): nem A2-nyitas. A kovetkezo meter.error('slot_lost' | 'hold_expired') EGYSZER hasznalja fel (ezutan nullazodik):
     * csak jelzett nyitas szamit uj elofordulasnak (az A2 ujrarajzolasa pl. a bongeszo vissza gombjaval nem), es az ok nem orokodik at egy korabbi A2-bol (a motor S.a2Reason ertekebol sem).
     */
    a2Ok(ok) { a2Fuggo = ok === 'expired' ? 'hold_expired' : ok === 'taken' || ok === 'redirect' ? 'slot_lost' : null; },
    /** DECISION #205 (e): a C1 (szabad idopontok) megjelent: a kovetkezo 7 nap szabad idopontjainak szama + a legkorabbi szabad nap, zart vodorben, a MAR betoltott listabol; egyszer (szolgaltatas, szakember) szerint. */
    c1(slotok, staffId, nowUnix) {
      try {
        if (proba) return;
        if (!egyszer('c1:' + allapot.serviceId + ':' + (staffId || ''))) return;
        const m = c1Meres(slotok, { staffId, nowUnix: Number.isFinite(Number(nowUnix)) ? Number(nowUnix) : Math.floor(Number(ido()) / 1000) });
        if (!m) return;
        belso(C1_SZABAD_LEPES, m.szabad); belso(C1_ELSO_LEPES, m.elso);
      } catch (e) { /* nem kritikus */ }
    },
    /** Hiba: errorType a HIBA_TIPUSOK egyike; egyszer (tipus, lepes, szolgaltatas) hármasonkent. */
    error(errorType, step, reszlet) {
      const t = HIBA_TIPUSOK.includes(errorType) ? errorType : 'client_error';
      if (t === 'slot_lost' || t === 'hold_expired') { const ok = a2Fuggo; a2Fuggo = null; if (ok) a2Elofordulas(ok); } // DECISION #205 (d): a belso szamlalo minden jelzett A2-nyitast szamol (az egyszer-kapu elott), a jelzett ok nullazodik
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
      if (s === 'C4') kimenetek(['c4_close']); // DECISION #205 (c): az adatlapon (C4) zart be: az adatlap megjeleneseto eltelt ido
    },
    /** Teszteleshez: az aktualis allapot. */
    allapot: () => ({ ...allapot, forras }),
  };
}
