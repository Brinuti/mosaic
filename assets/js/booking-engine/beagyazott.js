// MOSAIC Booking Engine - BEAGYAZOTT foglalo-blokk (landing-oldal szekcioja): a meglevo motor 'page' modja, egy elem belsejeben, Shadow DOM-ban.
//
// A helyben nyilo reteg (layer.js) testvere, de nem fixed panel: a gazdaelem a landing oldal szekciojaban all, a motor az oldal gorgetesevel fut
// (engine.js: embedded). Nincs popup, nincs uj URL: az elozmeny-bejegyzesek URL nelkuliek (urlAllapot: false; GTM History Change), a vissza gomb lepesenkent lep.
// Hasznalja: assets/js/oxigen-uj.js (/oxigenterapia-budapest-uj). A kontextust (uzletag, szolgaltatas, UTM, forras-oldal) a hivo adja, a motor nem kerdez ujra.
//
//   const b = beagyazFoglalo(hostElem, { business: 'oxygen', service: '466110' }, { cssHref, fontsHref });
//   b.engine   a startEngine() eredmenye ({ start: Promise, destroy() ... })
//   b.destroy()

import { startEngine, warmUp } from './engine.js';

const CONTEXT_KEYS = ['business', 'service', 'category', 'voucher', 'intent', 'staff', 'booking', 'service_id', 'service_category', 'source_page', 'start'];

/** A motor keresesi kontextusa: az oldal sajat URL-jenek hirdetesi azonositoi (UTM, click ID) + a hivas + a forras-oldal (mint layer.js). */
export function engineSearch(context, win = window) {
  const q = new URLSearchParams(win.location.search);
  for (const k of CONTEXT_KEYS) q.delete(k);
  for (const [k, v] of Object.entries(context || {})) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  q.set('source_page', win.location.pathname);
  return '?' + q.toString();
}

// A beagyazott shell kinezete (a Shadow DOM-ban a booking-engine.css mellett): nem tapad (sticky) az oldal fejlecehez, a landing kartyajaba illik.
const KERET_CSS = `
:host { display: block; }
.be-shell-embed { background: var(--hatter); }
.be-shell-embed .be-head { position: static; }
.be-shell-embed .be-main { max-width: 640px; }
`;

export function beagyazFoglalo(host, context, env = {}) {
  const win = env.win || window; const doc = win.document;
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  const cssHref = (env.cssHref || '/assets/css/booking-engine.css').replace(/"/g, '');
  shadow.innerHTML = '<link rel="stylesheet" href="' + cssHref + '"><style>' + KERET_CSS + '</style><div class="be-beagyazott"></div>';
  const root = shadow.querySelector('.be-beagyazott');
  // a @font-face csak a dokumentumban mukodik (Shadow DOM-ban nem): mint a retegnel
  if (env.fontsHref && !doc.querySelector('link[data-be-fonts]')) {
    const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = env.fontsHref; l.setAttribute('data-be-fonts', ''); doc.head.append(l);
  }
  const engine = startEngine({ root, win, doc, mode: 'page', embedded: true, urlAllapot: false, defaultBusiness: null, search: engineSearch(context, win) });
  let lezarva = false;
  return {
    engine,
    root,
    destroy() {
      if (lezarva) return;
      lezarva = true;
      try { if (engine) engine.destroy(); } catch (e) { /* a blokk akkor is kiurul */ }
      shadow.innerHTML = '';
    },
  };
}

/** Elomelegites (Salonic-kapcsolat + szolgaltatas-lista + az elso 14 nap): a foglalo-blokk kozeledtekor. */
export function melegit(context) { try { warmUp({ business: context.business, service: context.service }); } catch (e) { /* nem kritikus */ } }
