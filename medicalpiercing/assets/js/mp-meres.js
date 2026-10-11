// Medical Piercing - sajat (elso feles) foglalas-meres: NEM kulso merokod, kulso szkriptet nem tolt, csak a sajat
// /api/mp-foglalas vegpontra ir. Leiras: docs/MERES_GOOGLE_ARNYEK.md.
//
// 1) Minden oldalon: ha az URL-ben Google-kattintasazonosito van (gclid / gbraid / wbraid) ES a sajat suti-savban
//    (assets/js/suti.js, "mp_suti" suti) van marketing-hozzajarulas, eltarolja (localStorage "mp_gk", 90 nap). Hozzajarulas nelkul nem tarol semmit; ha a vendeg
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
    // a sajat suti-sav dontese: "mp_suti=v1-s<0|1>-m<0|1>-t<unix>" (assets/js/suti.js)
    return /(?:^|;\s*)mp_suti=v1-s[01]-m1-t\d+(?:;|$)/.test(document.cookie);
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
  // a koszonooldal cimeben a motor altal atvitt azonosito csak potlas: hozzajarulassal mar tarolt, ervenyes erteket nem ir felul
  var koszono = /^\/foglalas-ok[a-z0-9-]*\/?$/i.test(location.pathname);
  var mentes = function () {
    if (!hirdetesiHozzajarulas()) return;
    var o = olvas();
    for (var t in friss) if (!(koszono && o[t] && most() - o[t].ido <= NAP90)) o[t] = friss[t];
    for (var k in o) if (!o[k] || most() - o[k].ido > NAP90) delete o[k];
    ir(o);
  };
  if (Object.keys(friss).length) mentes();
  // a suti-sav esemenye a dontes / modositas utan
  document.addEventListener('mp_suti_valtozas', function () {
    if (hirdetesiHozzajarulas()) mentes(); else torol();
  });

  if (!/^\/foglalas-ok[a-z0-9-]*\/?$/i.test(location.pathname)) return;
  var p = {};
  ['bookingUrl', 'price', 'first_booking', 'booking_id', 'placeId', 'employeeId', 'startDate', 'serviceId'].forEach(function (k) {
    var v = q.get(k);
    if (v != null && v !== '') p[k] = v;
  });
  if (!p.bookingUrl && !(p.placeId && p.employeeId && p.startDate)) return; // nem foglalasbol erkezett
  var katNelkulKuldve = false, potolva = false;
  var vanKatt = function (o) { return !!(o && (o.gclid || o.gbraid || o.wbraid)); };
  var kuld = function (potlas) {
    var kat = hirdetesiHozzajarulas() ? olvas() : null;
    if (!potlas && !vanKatt(kat)) katNelkulKuldve = true;
    var torzs = { ut: location.pathname, p: p, kattintas: kat };
    if (potlas) torzs.potlas = true;
    try {
      fetch('/api/mp-foglalas', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify(torzs) })
        .catch(function () { /* a vendeg folyamatat nem zavarja */ });
    } catch (e) { /* regi bongeszo */ }
  };
  // a suti-sav dontesere roviden varunk (ha a vendeg epp most fogad el), de legkesobb 4 mp utan kuldunk
  var elkuldve = false;
  var egyszer = function () { if (!elkuldve) { elkuldve = true; kuld(); } };
  // A foglalomotor keretebe toltott koszonooldal (assets/js/motor/motor.js): a motor UGYANEZT a koszonooldalt booking_id-vel
  // a fo ablakban nyitja meg, onnan megy a jelzes. A suti.js a motor visszaigazolasakor (1,5 mp-en belul) jeloli a
  // <html data-mp-motor-atvette="1">-et: ilyenkor a keretbol nem kuldunk. A regi, kozvetlenul beagyazott Salonic-naptarak
  // keretei (pl. /migren-piercing-uj) nem kapnak visszaigazolast: onnan kuldunk, mint eddig.
  if (window.top !== window) {
    setTimeout(function () { if (document.documentElement.getAttribute('data-mp-motor-atvette') !== '1') egyszer(); }, 1700);
    return;
  }
  // Kesoi (4 mp utani) hozzajarulas: a foglalas mar kattintasazonosito nelkul ment el. Ha most van hirdetesi hozzajarulas ES
  // tarolt azonosito, EGYSZER potlo kerest kuldunk; a szerver csak a meg azonosito nelkuli, friss, ugyanezen foglalasi
  // kulcsu (es motorosnal ugyanazon booking_id-ju) sort egesziti ki, felulirni nem tud (lib/meres/lanc.js).
  document.addEventListener('mp_suti_valtozas', function () {
    setTimeout(function () {
      if (!elkuldve || !katNelkulKuldve || potolva || !hirdetesiHozzajarulas() || !vanKatt(olvas())) return;
      potolva = true; kuld(true);
    }, 120);
  });
  if (/(?:^|;\s*)mp_suti=v1-/.test(document.cookie) || !/medicalpiercing\.hu$/.test(h)) egyszer();
  else {
    document.addEventListener('mp_suti_valtozas', function () { setTimeout(egyszer, 50); });
    setTimeout(egyszer, 4000);
    addEventListener('pagehide', egyszer); // ha a vendeg hamarabb tovabblep, akkor is kimegy (keepalive)
  }
})();
