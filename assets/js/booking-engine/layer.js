// MOSAIC Booking Engine - a helyben nyilo foglalo-reteg
//
// A szolgaltatas-oldalon NEM visszuk at a vendeget kulon foglalasi oldalra: a CTA ugyanazon az oldalon megnyitja a foglalot.
//   - mobilon teljes kepernyos reteg ("mini app"), asztali gepen kozepre nyilo panel; bezaraskor ugyanoda ter vissza az oldalon
//   - a belepesi kontextust (uzletag, szolgaltatas / kategoria, UTM / click ID, forras-oldal) a hivo adja: nem kerdez ujra, ami mar ismert
//   - az URL frissul (?booking=1&business=...): mukodik a bongeszo vissza gombja, ujratolteskor ujra megnyilik, linkelheto
//   - Shadow DOM: az oldal (Wix-klon) stilusai nem szivarognak be, a foglalo stilusa nem szivarog ki
// A szamlalas / hand-off a motoreben marad (engine.js): sikeres foglalas utan a meglevo koszonooldal nyilik meg, a meres valtozatlan.

import { startEngine } from './engine.js';

const HOST_ID = 'mosaic-booking-layer';
const CONTEXT_KEYS = ['business', 'service', 'category', 'voucher', 'intent']; // ezek kerulnek az URL-be; a tobbi (UTM, click ID) az oldal sajat URL-jen van
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
    voucher: get('voucher') && get('voucher') !== '0' && get('voucher') !== 'false' ? '1' : null,
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v));
}

/** Az URL a reteg nyitasakor: az oldal sajat cime + booking=1 + a kontextus (a regi booking-parameterek helyett). */
export function layerUrl(href, opts) {
  const u = new URL(href);
  for (const k of BOOKING_KEYS) u.searchParams.delete(k);
  u.hash = '';
  u.searchParams.set('booking', '1');
  for (const [k, v] of Object.entries(opts)) u.searchParams.set(k, v);
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
 * env:  { restored: true } ha az oldal mar ?booking=1-gyel toltodott be (nincs elozo bejegyzes, nem pusholunk); cssHref / fontsHref; opener (fokusz-visszaadas)
 */
export function openBooking(opts = {}, env = {}) {
  const win = env.win || window; const doc = win.document;
  if (current) return current.engine;
  const context = normalizeOptions(opts);
  const restored = !!env.restored;
  const opener = env.opener || doc.activeElement;

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
  if (env.fontsHref && !doc.querySelector('link[data-be-fonts]')) { // a @font-face csak a dokumentumban mukodik (Shadow DOM-ban nem)
    const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = env.fontsHref; l.setAttribute('data-be-fonts', ''); doc.head.append(l);
  }

  // --- oldal: gorgetes-zar, inert hatter ---------------------------------------------------------------------------------------------
  const html = doc.documentElement;
  const prev = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
  const scrollbar = win.innerWidth - html.clientWidth;
  html.style.overflow = 'hidden';
  if (scrollbar > 0) html.style.paddingRight = scrollbar + 'px';
  const inerted = [...doc.body.children].filter((el) => el !== host && !el.inert);
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
  if (!restored) win.history.pushState({ beLayer: true, view: null, depth: 0 }, '', layerUrl(win.location.href, context));

  // --- bezaras ---------------------------------------------------------------------------------------------------------------------
  let closed = false;
  function teardown() {
    if (closed) return;
    closed = true;
    try { engine.destroy(); } catch (e) { /* a reteg akkor is bezarul */ }
    host.remove();
    html.style.overflow = prev.overflow; html.style.paddingRight = prev.paddingRight;
    for (const el of inerted) el.inert = false;
    current = null;
    if (opener && typeof opener.focus === 'function' && doc.contains(opener)) opener.focus({ preventScroll: true });
  }
  function requestClose() {
    if (closed) return;
    if (restored) { win.history.replaceState(null, '', cleanUrl(win.location.href)); teardown(); return; }
    const steps = (engine.state ? engine.state.depth : 0) + 1;
    win.history.go(-steps); // a popstate (onExit) zarja be a reteget es allitja vissza az eredeti cimet
    win.setTimeout(() => { if (!closed) { win.history.replaceState(null, '', cleanUrl(win.location.href)); teardown(); } }, 800); // ha a bongeszo nem lepett vissza
  }
  const onExit = () => teardown();

  // --- billentyuzet: Esc bezar, Tab a panelen belul marad -----------------------------------------------------------------------------
  const FOCUSABLE = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])';
  shadow.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); requestClose(); return; }
    if (e.key !== 'Tab') return;
    const list = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => !el.hidden && el.getClientRects().length);
    if (!list.length) { e.preventDefault(); panel.focus(); return; }
    const first = list[0]; const last = list[list.length - 1]; const active = shadow.activeElement;
    if (e.shiftKey && (active === first || active === panel)) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
  });
  shadow.querySelector('.be-backdrop').addEventListener('click', requestClose);

  // --- a motor ------------------------------------------------------------------------------------------------------------------------
  const engine = startEngine({ root: body, win, doc, mode: 'layer', search: engineSearch, defaultBusiness: null, onClose: requestClose, onExit });
  current = { host, engine, close: requestClose, restored };
  win.requestAnimationFrame(() => { layerEl.classList.add('be-open'); panel.focus({ preventScroll: true }); });
  return engine;
}

export function closeBooking() { if (current) current.close(); }
