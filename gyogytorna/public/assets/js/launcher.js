// gyogytornaszom.hu foglalomotor - indito (kicsi; a motor kodjat csak az elso foglalaskor tolti).
//
// Kapcsolo: a motor-kapcsolo.json (a build irja be __GY_KAPCSOLO__ = 0..100): ennyi szazalek latogato kapja a helyben nyilo motort, a tobbi a
// Salonic eredeti foglalojat (vesz-visszaallitas: 0). Latogatoi vodor: localStorage gy_b (0..99). Proba: ?motor=1 / ?motor=0 a munkamenetre.
// Kerete: ha a Salonic adatlapja (iframe name="gy-adatlap") a koszonooldalra irany, ez a script ott csak annyit tesz, hogy a szulo-ablaknak
// uzen (postMessage), es NEM tolt be semmit (mero-kod sem: a GTM-et a WP-snippet hagyja ki ott).
// Koszonooldal (/allapot-ok/, /foglalas-ok/) a legfelso ablakban: az egyszeri tokennel (sessionStorage gy_tk) POST /api/gy-koszono ->
// dataLayer.push({event:'foglalas_kesz', tipus, ertek, tranzakcio_id}) (GY-15). Token nelkul / ervenytelen tokennel NEM kuld esemenyt.
// Egeszsegugyi adat soha nem kerul URL-be / dataLayerbe / naplora.
(function () {
  'use strict';
  var KAPCSOLO = __GY_KAPCSOLO__; // 0..100
  var VERZIO = '__GY_VERZIO__';
  var script = document.currentScript;
  var forras = script && script.src ? new URL(script.src, location.href) : new URL(location.href);
  var BASE = forras.pathname.replace(/\/assets\/js\/launcher\.js$/, '').replace(/\/$/, ''); // prod: /gy-foglalas, elonezet: ''
  var API = forras.origin + BASE;
  var MOTOR = API + '/assets/js/motor/motor.js?v=' + VERZIO;
  var KOSZONO = /^\/(allapot-ok|foglalas-ok)\/?$/i;
  var SAJAT = [location.origin, forras.origin, 'https://www.gyogytornaszom.hu', 'https://gyogytornaszom.hu'];

  // --- keretben: csak a koszonooldal jelzese a motornak ---
  if (window.top !== window) {
    if (window.name === 'gy-adatlap' && KOSZONO.test(location.pathname)) {
      var kuld = function (o) { try { window.parent.postMessage({ tipus: 'gy-foglalas-ok', url: location.href }, o); } catch (e) { /* */ } };
      var szulo = window.location.ancestorOrigins && window.location.ancestorOrigins[0]; // Chrome / Safari: a tenyleges szulo (nincs felesleges konzol-hiba); Firefoxban nincs: a sajat origin-ek mindegyike
      var celok = SAJAT.filter(function (o, i, t) { return t.indexOf(o) === i && (!szulo || o === szulo); });
      celok.forEach(kuld);
    }
    return;
  }

  var tarol = function (k, v) {
    try { if (v === undefined) return window.sessionStorage.getItem(k); window.sessionStorage.setItem(k, v); } catch (e) { /* */ }
    return null;
  };

  // --- koszonooldal (legfelso ablak) ---
  if (KOSZONO.test(location.pathname)) {
    var nyers = tarol('gy_tk');
    // a Salonic tartalek-utja a koszonooldalra parameterekkel erkezik: ezeket levesszuk a cimsorbol (a meres ne lassa)
    try { if (location.search) history.replaceState(null, '', location.pathname); } catch (e) { /* */ }
    if (!nyers) return;
    try { window.sessionStorage.removeItem('gy_tk'); } catch (e) { /* */ }
    var t;
    try { t = JSON.parse(nyers); } catch (e) { return; }
    if (!t || typeof t.token !== 'string' || !t.t || Date.now() - t.t > 15 * 60 * 1000) return;
    fetch(API + '/api/gy-koszono', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: t.token }) })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (j) {
        if (!j || (j.tipus !== 'allapotfelmeres' && j.tipus !== 'egyeb') || typeof j.tranzakcio_id !== 'string') return;
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'foglalas_kesz', tipus: j.tipus, ertek: Number(j.ertek) || 0, tranzakcio_id: j.tranzakcio_id });
      }, function () { /* hiba: esemeny nelkul */ });
    return;
  }

  // --- kapcsolo ---
  var kenyszer = null;
  try {
    var q = new URLSearchParams(location.search).get('motor');
    if (q === '1' || q === '0') tarol('gy_motor', q);
    kenyszer = tarol('gy_motor');
  } catch (e) { /* */ }
  var vodor = function () {
    try {
      var v = window.localStorage.getItem('gy_b');
      if (v === null || !/^\d{1,2}$/.test(v)) { v = String(Math.floor(Math.random() * 100)); window.localStorage.setItem('gy_b', v); }
      return +v;
    } catch (e) { return 100; } // tiltott tarolo: a Salonic eredeti utja
  };
  var bekapcsolva = function () { return kenyszer === '1' ? true : kenyszer === '0' ? false : vodor() < KAPCSOLO; };

  // --- forras-megtartas (GY-15): egyszer lapbetoltesenkent, csak ha a motor aktiv a latogatonak ---
  if (bekapcsolva()) {
    var ping = function () {
      try {
        fetch(API + '/api/gy-forras', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ search: location.search, referrer: document.referrer, path: location.pathname }) }).catch(function () { /* */ });
      } catch (e) { /* */ }
    };
    if (document.readyState === 'complete') ping(); else window.addEventListener('load', ping);
  }

  // --- foglalasi linkek ---
  var HOSZT = 'gyogytornaszomhu.salonic.hu';
  var KIZART = /giftcard|user|contact|policy|privacy|language|modosit|lemond|booking\/(details|delete)/i;
  var salonicLink = function (a) {
    var u;
    try { u = new URL(a.href); } catch (e) { return null; }
    return u.hostname === HOSZT && !KIZART.test(u.pathname) ? u : null;
  };
  var jeloltLink = function (a) { return a.hasAttribute('data-gy-foglalas') ? a : null; };
  var szam = function (v) { return v && /^-?\d+$/.test(v) ? +v : null; };
  var betolt = null;
  var motor = function () {
    if (!betolt) betolt = import(MOTOR).catch(function (e) { betolt = null; throw e; });
    return betolt;
  };
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || !bekapcsolva()) return;
    var u = salonicLink(a);
    var jel = jeloltLink(a);
    if (!u && !jel) return;
    e.preventDefault();
    var p = u ? u.searchParams : new URLSearchParams();
    var ctx = {
      placeId: szam(p.get('placeId')), employeeId: szam(p.get('employeeId')) > 0 ? szam(p.get('employeeId')) : null,
      serviceId: szam(p.get('serviceId')) > 0 ? p.get('serviceId') : null,
      csalad: jel ? jel.getAttribute('data-gy-foglalas') || null : null,
      link: u ? u.href : 'https://' + HOSZT + '/selectLocation', forras: location.pathname, apiBase: API,
    };
    motor().then(function (m) { m.nyit(ctx); }, function () { if (u) location.href = u.href; });
  }, false);

  // elomelegites
  var meleg = function (e) {
    if (!bekapcsolva()) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a && (salonicLink(a) || jeloltLink(a))) motor().then(function (m) { m.melegit(); }, function () { /* */ });
  };
  document.addEventListener('pointerover', meleg, { passive: true });
  document.addEventListener('touchstart', meleg, { passive: true });
})();
