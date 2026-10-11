// Medical Piercing - sajat (elso feles) foglalas-meres: NEM kulso merokod, kulso szkriptet nem tolt, csak a sajat
// /api/mp-foglalas vegpontra ir. Leiras: docs/MERES_GOOGLE_ARNYEK.md.
//
// 1) Minden oldalon: ha az URL-ben Google-kattintasazonosito van (gclid / gbraid / wbraid) ES a CookieYes-ben van
//    hirdetesi hozzajarulas, eltarolja (localStorage "mp_gk", 90 nap). Hozzajarulas nelkul nem tarol semmit; ha a vendeg
//    kesobb, ugyanazon az oldalon fogadja el, akkor tarolja. Visszavonaskor torli.
// 2) A koszonooldalon (/foglalas-ok*): a foglalas parametereibol CSAK a kulcshoz / ertekhez szukseges mezoket kuldi
//    (bookingUrl, price, first_booking, booking_id ...); a szolgaltatas nevet, kategoriat, vendegazonositot NEM.
//    A kattintasazonositot csak hirdetesi hozzajarulassal kuldi (a szerver ezt a sutibol ujra ellenorzi).
(function () {
  'use strict';
  var h = location.hostname;
  if (!(h === 'www.medicalpiercing.hu' || /\.pages\.dev$/.test(h) || h === 'localhost' || h === '127.0.0.1')) return;
  var KULCS = 'mp_gk', NAP90 = 90 * 86400;
  var most = function () { return Math.floor(Date.now() / 1000); };

  var hirdetesiHozzajarulas = function () {
    var m = /(?:^|;\s*)cookieyes-consent=([^;]*)/.exec(document.cookie);
    if (!m) return false;
    var s; try { s = decodeURIComponent(m[1]); } catch (e) { s = m[1]; }
    return /(^|,)action:yes(,|$)/.test(s) && /(^|,)advertisement:yes(,|$)/.test(s);
  };
  var olvas = function () { try { return JSON.parse(localStorage.getItem(KULCS) || '{}') || {}; } catch (e) { return {}; } };
  var ir = function (o) { try { localStorage.setItem(KULCS, JSON.stringify(o)); } catch (e) { /* tiltott tarolo */ } };
  var torol = function () { try { localStorage.removeItem(KULCS); } catch (e) { /* tiltott tarolo */ } };

  var q = new URLSearchParams(location.search);
  var friss = {};
  ['gclid', 'gbraid', 'wbraid'].forEach(function (t) {
    var v = q.get(t);
    if (v && /^[A-Za-z0-9_-]{8,512}$/.test(v)) friss[t] = { ertek: v, ido: most() };
  });
  var mentes = function () {
    if (!hirdetesiHozzajarulas()) return;
    var o = olvas();
    for (var t in friss) o[t] = friss[t];
    for (var k in o) if (!o[k] || most() - o[k].ido > NAP90) delete o[k];
    ir(o);
  };
  if (Object.keys(friss).length) mentes();
  // a CookieYes sajat esemenye a dontes / modositas utan
  document.addEventListener('cookieyes_consent_update', function () {
    if (hirdetesiHozzajarulas()) mentes(); else torol();
  });

  if (!/^\/foglalas-ok[a-z0-9-]*\/?$/i.test(location.pathname)) return;
  var p = {};
  ['bookingUrl', 'price', 'first_booking', 'booking_id', 'placeId', 'employeeId', 'startDate', 'serviceId'].forEach(function (k) {
    var v = q.get(k);
    if (v != null && v !== '') p[k] = v;
  });
  if (!p.bookingUrl && !(p.placeId && p.employeeId && p.startDate)) return; // nem foglalasbol erkezett
  var kuld = function () {
    var torzs = { ut: location.pathname, p: p, kattintas: hirdetesiHozzajarulas() ? olvas() : null };
    try {
      fetch('/api/mp-foglalas', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify(torzs) })
        .catch(function () { /* a vendeg folyamatat nem zavarja */ });
    } catch (e) { /* regi bongeszo */ }
  };
  // a CookieYes-dontesre roviden varunk (ha a vendeg epp most fogad el), de legkesobb 4 mp utan kuldunk
  var elkuldve = false;
  var egyszer = function () { if (!elkuldve) { elkuldve = true; kuld(); } };
  if (/(?:^|;\s*)cookieyes-consent=[^;]*action(%3A|:)yes/.test(document.cookie) || !/medicalpiercing\.hu$/.test(h)) egyszer();
  else {
    document.addEventListener('cookieyes_consent_update', function () { setTimeout(egyszer, 50); });
    setTimeout(egyszer, 4000);
    addEventListener('pagehide', egyszer); // ha a vendeg hamarabb tovabblep, akkor is kimegy (keepalive)
  }
})();
