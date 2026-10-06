// MOSAIC Booking Engine - a helyben nyilo foglalo-reteg
//
// A szolgaltatas-oldalon NEM visszuk at a vendeget kulon foglalasi oldalra: a CTA ugyanazon az oldalon megnyitja a foglalot.
//   - mobilon teljes kepernyos reteg ("mini app"), asztali gepen kozepre nyilo panel; bezaraskor ugyanoda ter vissza az oldalon
//   - a belepesi kontextust (uzletag, szolgaltatas / kategoria, UTM / click ID, forras-oldal) a hivo adja: nem kerdez ujra, ami mar ismert
//   - az URL frissul (?booking=1&business=...): mukodik a bongeszo vissza gombja, ujratolteskor ujra megnyilik, linkelheto
//   - Shadow DOM: az oldal (Wix-klon) stilusai nem szivarognak be, a foglalo stilusa nem szivarog ki
// A szamlalas / hand-off a motoreben marad (engine.js): sikeres foglalas utan a meglevo koszonooldal nyilik meg, a meres valtozatlan.

import { startEngine, warmUp } from './engine.js';
import { cleanStaffKey, cleanCoupon } from './flow.js';

const HOST_ID = 'mosaic-booking-layer';
const CONTEXT_KEYS = ['business', 'service', 'category', 'voucher', 'intent', 'staff']; // ezek kerulnek az URL-be; a tobbi (UTM, click ID) az oldal sajat URL-jen van
const BOOKING_KEYS = [...CONTEXT_KEYS, 'booking', 'service_id', 'service_category', 'source_page'];

let current = null;

/** A hivas (openBooking({...})) es az URL egysegesitese: alias-ok (service_id, service_category), voucher -> '1'. */
export function normalizeOptions(o = {}) {
  const get = (...ks) => { for (const k of ks) { const v = o instanceof URLSearchParams ? o.get(k) : o[k]; if (v !== undefined && v !== null && v !== '' && v !== false) return String(v); } return null; };
  const out = {
    business: get('business'),
    service: get('service', 'service_id'),
    category: get('category', 'service_category'),
    intent: get('intent'),
    staff: cleanStaffKey(get('staff', 'munkatars', 'szakember')), // munkatars-link: a szakember a CTA-ban (pl. data-booking="business=hair&staff=betti")
    voucher: get('voucher') && get('voucher') !== '0' && get('voucher') !== 'false' ? '1' : null,
    kupon: cleanCoupon(get('kupon', 'kuponkod', 'coupon')), // kuponkod: az adatlapon a kupon mezobe kerul (a motor a kontextusbol, nem az URL-allapotbol veszi)
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}

/** Az URL a reteg nyitasakor: az oldal sajat cime + booking=1 + a kontextus (a regi booking-parameterek helyett). */
export function layerUrl(href, opts) {
  const u = new URL(href);
  for (const k of BOOKING_KEYS) u.searchParams.delete(k);
  u.hash = '';
  u.searchParams.set('booking', '1');
  for (const [k, v] of Object.entries(opts)) if (k !== 'kupon') u.searchParams.set(k, v); // a kuponkod nem kerul az (elozmeny-)URL-be
  return u.pathname + u.search;
}

/** Az URL a reteg bezarasa utan: a booking-parameterek nelkul. */
export function cleanUrl(href) {
  const u = new URL(href);
  for (const k of BOOKING_KEYS) u.searchParams.delete(k);
  u.hash = '';
  return u.pathname + u.search;
}

export function isOpen() { return !!current; }

/**
 * Megnyitja a foglalot.
 * opts: { business, service | service_id, category | service_category, intent, voucher } (mind opcionalis; ha nincs uzletag: szolgaltatas-elso kezdo allapot)
 * env:  { restored: true } ha az oldal mar ?booking=1-gyel toltodott be (nincs elozo bejegyzes, nem pusholunk); cssHref / fontsHref; opener (fokusz-visszaadas);
 *       zarhatatlan: true -> bezarhatatlan reteg (a regi foglalo-cimek ures oldalain): nincs X; a bongeszo vissza gombja az elso lepesnel elhagyja az oldalt
 *       (nem marad ures oldal); a suti-sav (#mh-cc) az inert-bol kimarad, hogy a hozzajarulas megadhato maradjon
 *       urlAllapot: true -> az URL is frissul (?booking=1&business=...): alapbol NEM, mert a GTM History Change triggerei minden URL-valtozasnal
 *       oldalmegtekintes-esemenyeket (Meta PageView, GA4 page_view / visit, Google Ads page_view) inditanak; csak GTM-kizaro szabaly utan kapcsolhato be
 */
export function openBooking(opts = {}, env = {}) {
  const win = env.win || window; const doc = win.document;
  if (current) return current.engine;
  const context = normalizeOptions(opts);
  const restored = !!env.restored;
  const urlAllapot = !!env.urlAllapot;
  const opener = env.opener || doc.activeElement;
  const zarhatatlan = !!env.zarhatatlan;

  // --- gazdaelem + Shadow DOM -------------------------------------------------------------------------------------------------------
  const host = doc.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;';
  const shadow = host.attachShadow({ mode: 'open' });
  const cssHref = env.cssHref || '/assets/css/booking-engine.css';
  shadow.innerHTML = '<link rel="stylesheet" href="' + cssHref.replace(/"/g, '') + '"><div class="be-layer"><div class="be-backdrop"></div>'
    + '<section class="be-panel" role="dialog" aria-modal="true" aria-label="Időpontfoglalás" tabindex="-1"><div class="be-panel-body"></div></section></div>';
  const layerEl = shadow.querySelector('.be-layer');
  const panel = shadow.querySelector('.be-panel');
  const body = shadow.querySelector('.be-panel-body');
  // A stilus megerkezeseig a reteg rejtett: stilus nelkul a fejlec ikonjai (pl. a telefon) hatalmas, kek SVG-kent villannanak fel (elso megnyitas, hideg gyorsitotar)
  host.style.visibility = 'hidden';
  const sheet = shadow.querySelector('link[rel="stylesheet"]');
  if (env.fontsHref && !doc.querySelector('link[data-be-fonts]')) { // a @font-face csak a dokumentumban mukodik (Shadow DOM-ban nem)
    const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = env.fontsHref; l.setAttribute('data-be-fonts', ''); doc.head.append(l);
  }

  // --- oldal: gorgetes-zar, inert hatter ---------------------------------------------------------------------------------------------
  // A gorgetes-zar: CSAK a gorgetest zarjuk (overflow:hidden), az oldal poziciojat NEM mozgatjuk. Korabban a body "fixed" + top:-scrollY volt: egy hosszu
  // oldalon (20 000+ px) ez egy hatalmas, felfele eltolt rogzitett elem, amit a telefonok (iOS Safari, Chrome Android) a lap aljan mar nem rajzoltak ki:
  // a reteg letrejott, de FEHER kepernyo maradt (csak az oldal tetejen, scrollY ~ 0-nal mukodott). A viewport-gorgetest az hatarozza meg, amelyik elem
  // overflow-ja a viewportra szarmazik: alapbol a body (a html overflow-ja "visible"), ha a html maga is allitott overflow-t, akkor a html. A
  // html overflow:hidden-je a Wix-klon oldalain (ahol a body a gorgeto) az oldal tetejere ugratna, ezert a body-t zarjuk. A gorgetosav helyet a
  // html padding-right tartja.
  const html = doc.documentElement, bodyEl = doc.body;
  const scrollY = win.scrollY || html.scrollTop || 0;
  const lockEl = win.getComputedStyle(html).overflowY === 'visible' ? bodyEl : html;
  const prev = { overflow: lockEl.style.overflow, paddingRight: html.style.paddingRight };
  const scrollbar = win.innerWidth - html.clientWidth;
  lockEl.style.overflow = 'hidden';
  if (scrollbar > 0) html.style.paddingRight = scrollbar + 'px';
  const inerted = [...doc.body.children].filter((el) => el !== host && !el.inert && !(zarhatatlan && (el.id === 'mh-cc' || el.id === 'mh-cc-reopen')));
  for (const el of inerted) el.inert = true;
  doc.body.append(host);

  // --- URL-allapot (vissza gomb, ujratoltes, linkelhetoseg) -------------------------------------------------------------------------
  const sourcePage = win.location.pathname;
  const engineSearch = (() => { // a motor sajat kontextusa: az oldal URL-jenek hirdetesi azonositoi + a hivas + a forras-oldal
    const q = new URLSearchParams(win.location.search);
    for (const k of BOOKING_KEYS) q.delete(k);
    for (const [k, v] of Object.entries(context)) q.set(k, v);
    q.set('source_page', sourcePage);
    return '?' + q.toString();
  })();
  // a vissza gomb a reteg-allapotokon at mukodik; az URL alapbol valtozatlan marad (lasd fent)
  if (!restored) { const allapot = { beLayer: true, view: null, depth: 0 }; if (urlAllapot) win.history.pushState(allapot, '', layerUrl(win.location.href, context)); else win.history.pushState(allapot, ''); }

  // --- bezaras ---------------------------------------------------------------------------------------------------------------------
  let closed = false;
  function teardown() {
    if (closed) return;
    closed = true;
    try { engine.destroy(); } catch (e) { /* a reteg akkor is bezarul */ }
    host.remove();
    lockEl.style.overflow = prev.overflow; html.style.paddingRight = prev.paddingRight;
    if (Math.abs((win.scrollY || html.scrollTop || 0) - scrollY) > 1) win.scrollTo(0, scrollY); // a pozicio normalisan megmarad; csak ha elmozdult
    for (const el of inerted) el.inert = false;
    current = null;
    if (opener && typeof opener.focus === 'function' && doc.contains(opener)) opener.focus({ preventScroll: true });
  }
  function requestClose() {
    if (closed) return;
    if (restored) { if (urlAllapot) win.history.replaceState(null, '', cleanUrl(win.location.href)); teardown(); return; }
    // A reteg AZONNAL eltunik, a motor pedig nem rajzol ujra: a visszalepes kozben a bongeszo egy korabbi (pl. elavult) reteg-bejegyzesre is erhet, annak
    // a nezete nem villanhat fel (a sminktetovalo-keret sajat lepesei is a szulo elozmenyeibe kerulnek, igy a lepesszam pontos).
    if (engine.state) engine.state.closing = true;
    host.style.visibility = 'hidden';
    const steps = (engine.state ? engine.state.depth : 0) + 1;
    win.history.go(-steps); // a popstate (onExit) zarja be a reteget es allitja vissza az eredeti cimet
    win.setTimeout(() => { if (!closed) { if (urlAllapot) win.history.replaceState(null, '', cleanUrl(win.location.href)); teardown(); } }, 800); // ha a bongeszo nem lepett vissza
  }
  // Bezarhatatlan reteg: a visszalepes az elso lepesnel elhagyja az (ures) oldalt: vissza az elozo oldalra, ha nincs, a fooldalra (nem marad ures oldal)
  const kilep = () => { const cim = win.location.href; win.history.back(); win.setTimeout(() => { if (win.location.href === cim) win.location.replace('/'); }, 700); };
  const onExit = () => { teardown(); if (zarhatatlan) kilep(); };

  // --- billentyuzet: Esc nem zar, Tab a panelen belul marad -----------------------------------------------------------------------------
  const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
  shadow.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); return; } // a foglalo nem zarodik be veletlenul: csak a jobb felso X zarja be (a bongeszo vissza gombja lepesenkent visszalep)
    if (e.key !== 'Tab') return;
    const list = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => !el.hidden && el.getClientRects().length);
    if (!list.length) { e.preventDefault(); panel.focus(); return; }
    const first = list[0]; const last = list[list.length - 1]; const active = shadow.activeElement;
    if (e.shiftKey && (active === first || active === panel)) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
  });
  // (a hatterre kattintas SEM zar: csak az X)

  // --- a motor ------------------------------------------------------------------------------------------------------------------------
  const engine = startEngine({ root: body, win, doc, mode: 'layer', search: engineSearch, defaultBusiness: null, onClose: requestClose, onExit, urlAllapot, closable: !zarhatatlan });
  current = { host, engine, close: requestClose, restored };
  // megjelenites: ha a stilus megerkezett (vagy 3 mp utan akkor is): a reteg lathatova valik es becsuszik
  let latszik = false;
  const mutat = () => {
    if (latszik || closed) return;
    latszik = true;
    host.style.visibility = '';
    win.requestAnimationFrame(() => { layerEl.classList.add('be-open'); panel.focus({ preventScroll: true }); });
  };
  if (sheet && !sheet.sheet) { sheet.addEventListener('load', mutat); sheet.addEventListener('error', mutat); win.setTimeout(mutat, 3000); } else mutat();
  return engine;
}

export function closeBooking() { if (current) current.close(); }

/** Elomelegites a CTA kontextusabol (a launcher a CTA fole vitt egerre / erintesre hivja): Salonic-kapcsolat + szolgaltatas-lista, adott szolgaltatasnal idopontok. */
export function warm(opts = {}) { try { warmUp(normalizeOptions(opts)); } catch (e) { /* nem kritikus */ } }
