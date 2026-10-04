// MOSAIC Booking Engine - a foglalo-reteg indito szkriptje (apro: csak a CTA-kat figyeli, a foglalo kodja az elso megnyitaskor toltodik)
//
//   openBooking({ business: 'hair', service_category: 'balayage' })   // a CTA mogotti hivas
//   closeBooking()
//   <button data-booking='{"business":"headspa","service":"paros"}'>   vagy   data-booking="business=hair&category=balayage"
//   <a href="/foglalo-motor?business=oxygen&service=466110">           (a linktermeken at kerult CTA-k: a retegben nyilnak meg, JS nelkul a /foglalo-motor oldalra visznek)
//
// A build (tools/netlify-build.mjs) a __MOTOR_VERZIO__ / __CSS_VERZIO__ jeleket tartalom-hash-re cseréli (a /assets/js/* egy evig tarolhato).
// Ha az oldal ?booking=1-gyel toltodik be (ujratoltes, megosztott link, "elore" gomb), a reteg ujra megnyilik.

const V_MOTOR = '__MOTOR_VERZIO__';
const V_CSS = '__CSS_VERZIO__';
const verzio = (v) => (v.startsWith('__') ? '' : '?v=' + v); // fejlesztesben (nem epitett) nincs verziojel
const ENGINE_PATH = '/foglalo-motor';
const CSS_HREF = '/assets/css/booking-engine.css' + verzio(V_CSS);
const FONTS_HREF = '/assets/css/booking-fonts.css' + verzio(V_CSS);

let betoltes = null;
const modul = () => (betoltes ||= import('./booking-engine/layer.js' + verzio(V_MOTOR)));

async function megnyit(opts, env = {}) {
  const m = await modul();
  return m.openBooking(opts, { cssHref: CSS_HREF, fontsHref: FONTS_HREF, ...env });
}

function parseDataBooking(s) {
  const t = String(s || '').trim();
  if (t.startsWith('{')) { try { return JSON.parse(t); } catch (e) { return {}; } }
  return Object.fromEntries(new URLSearchParams(t));
}

// a linktermekbol kapott CTA-k: <a href="/foglalo-motor?business=..."> -> opts; minden mas link nem a miénk
function optsFromLink(a) {
  let u;
  try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { return null; }
  if (u.origin !== location.origin || u.pathname.replace(/\/+$/, '') !== ENGINE_PATH) return null;
  return Object.fromEntries(u.searchParams);
}

window.openBooking = (opts, env) => megnyit(opts || {}, env);
window.closeBooking = () => { if (betoltes) betoltes.then((m) => m.closeBooking()); };

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // uj lapon / ablakban nyitast a bongeszore hagyjuk
  const el = e.target.closest && e.target.closest('[data-booking], a[href*="foglalo-motor"]');
  if (!el) return;
  const opts = el.hasAttribute('data-booking') ? parseDataBooking(el.getAttribute('data-booking')) : optsFromLink(el);
  if (!opts) return;
  e.preventDefault();
  megnyit(opts, { opener: el });
});

// a CTA fole vitt egerre / fokuszra mar toltjuk a foglalo kodjat (az elso megnyitas ne varakoztasson)
const elolegez = (e) => { if (e.target.closest && e.target.closest('[data-booking], a[href*="foglalo-motor"]')) modul(); };
document.addEventListener('pointerover', elolegez, { passive: true });
document.addEventListener('focusin', elolegez);

function bookingParamok() {
  const q = new URLSearchParams(location.search);
  return q.get('booking') === '1' ? Object.fromEntries(q) : null;
}
function visszaallit() {
  const p = bookingParamok();
  if (p) megnyit(p, { restored: true });
}
visszaallit();
// "elore" gomb: a bezart reteg URL-jere lepve (booking=1) nyiljon meg ujra; a motor sajat popstate-kezeloje csak nyitott retegben fut
window.addEventListener('popstate', () => { if (bookingParamok() && !document.getElementById('mosaic-booking-layer')) visszaallit(); });
