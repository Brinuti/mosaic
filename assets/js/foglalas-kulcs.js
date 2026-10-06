// A koszonooldal SAJAT kulcs-iroja (nem GTM, nem pixel, nem tag): a sikeres Salonic-foglalas utan a koszonooldalra erkezo bookingUrl-bol a foglalas kulcsa
// (placeId|employeeId|startUnix) -> a foglalo sajat booking_id-je a foglalas-kulcs tablaba (POST /api/foglalas-kulcs; a kulcsot a SZERVER kepezi a bookingUrl-bol).
// A tabla az e-mail-oldali parositast szolgalja (netlify/lib/foglalas-kulcs.js, docs/booking-engine/BOOKING_ID.md): egy kulcshoz egy booking_id, felulras nelkul, 180 nap.
//
// A booking_id forrasa: a bookingUrl "back" parametere (a Salonic visszaadja); ha az nincs, a foglalo bongeszo-kontextusa (sessionStorage: mhBookingCtx), de csak akkor, ha a
// szolgaltatas es az idopont egyezik a bookingUrl-evel. Egyik sincs = nem irunk (a koszonooldal ettol nem akad el, semmi nem latszik). Personal adat nem megy: csak az azonosito + a bookingUrl.
// Idempotens: oldal-ujratoltes nem ir ujra (sessionStorage jel); a szerver ugyanazt a parost ismet nem irja, mast nem ir felul.
(function () {
  'use strict';
  try {
    var q = new URLSearchParams(location.search);
    var bu = q.get('bookingUrl');
    if (!bu) return;
    var u; try { u = new URL(bu); } catch (e) { return; }
    if (u.protocol !== 'https:' || !/\.salonic\.hu$/.test(u.hostname) || u.pathname.replace(/\/+$/, '') !== '/guestData') return;
    var id = u.searchParams.get('back'), forras = 'back';
    if (!/^mb_[a-z0-9]{12,40}$/.test(id || '')) {
      id = null; forras = 'ctx';
      try {
        var c = JSON.parse(sessionStorage.getItem('mhBookingCtx'));
        if (c && /^mb_[a-z0-9]{12,40}$/.test(c.id || '') && String(c.service_id) === u.searchParams.get('serviceId') && String(c.slot_unix) === u.searchParams.get('startDate')) id = c.id;
      } catch (e) { /* nincs / hibas kontextus */ }
    }
    if (!id) return;
    var jel = 'mhKulcsIrva:' + id;
    try { if (sessionStorage.getItem(jel)) return; } catch (e) { /* privat mod: nem blokkolunk */ }
    window.mhKulcsEredmeny = { bookingId: id, forras: forras, allapot: 'kuldve' }; // csak az ellenorzo proba olvassa
    fetch('/api/foglalas-kulcs', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true,
      body: JSON.stringify({ booking_id: id, booking_url: bu, forras: forras }),
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        window.mhKulcsEredmeny = { bookingId: id, forras: forras, allapot: 'valasz', status: r.status, valasz: j };
        if (r.ok) { try { sessionStorage.setItem(jel, '1'); } catch (e) { /* nem baj */ } }
      });
    }).catch(function (e) { window.mhKulcsEredmeny = { bookingId: id, forras: forras, allapot: 'hiba', hiba: String(e && e.message || e).slice(0, 80) }; });
  } catch (e) { /* a koszonooldal ettol nem akadhat el */ }
})();
