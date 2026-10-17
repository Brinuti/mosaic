// Medical Piercing foglalomotor - indito (minden lapon, kicsi, a motor kodjat csak az elso foglalaskor tolti).
//
// A kapcsolo (motor-kapcsolo.json, a build irja be): 100 = a foglalasi linkek (medicalpiercing.salonic.hu) a helyben nyilo
// motort nyitjak; 0 = mindenki a regi Salonic-foglalot kapja (vesz-visszaallitas, a mar betoltott lapokon is: a kapcsolo
// minden kattintaskor ervenyes). Proba: a lap cimeben ?motor=1 (bekapcsolva) / ?motor=0 (kikapcsolva) erre a munkamenetre.
//
// A foglalasinditas merese (TikTok InitiateCheckout + GA4 foglalas_inditasa) a suti.js-ben, a kattintas elfogo (capture)
// szakaszaban fut: a motor dontese elott, mindket uton azonosan. Ez az indito a buborekolo szakaszban dont.
(function () {
  'use strict';
  var KAPCSOLO = __MOTOR_KAPCSOLO__; // 0 | 100
  var MOTOR = '/assets/js/motor/motor.js?v=__MOTOR_VERZIO__';
  if (window.top !== window) return; // keretben (pl. a koszonooldal a Salonic-adatlap utan) nem
  if (/^\/(foglalas-ok|fulbevalo-ok)/i.test(location.pathname)) return;

  var kenyszer = null;
  try {
    var q = new URLSearchParams(location.search).get('motor');
    if (q === '1' || q === '0') sessionStorage.setItem('mp_motor', q);
    kenyszer = sessionStorage.getItem('mp_motor');
  } catch (e) { /* tiltott tarolo: a kapcsolo dont */ }
  var bekapcsolva = function () { return kenyszer === '1' ? true : kenyszer === '0' ? false : KAPCSOLO >= 100; };

  // foglalasi linkek: a Salonic foglalo oldalai (az ajandekkartya, a fiok, a jogi oldalak nem)
  var FOGLALO = /^\/(selectlocation|selectspecialization|showservices|employees|selectemployee|selectdate|booking\/start)?\/?/i;
  var KIZART = /giftcard|user|contact|policy|privacy|fizetesi|language/i;
  var foglalasiLink = function (a) {
    var u;
    try { u = new URL(a.href); } catch (e) { return null; }
    if (u.hostname !== 'medicalpiercing.salonic.hu' || KIZART.test(u.pathname) || !FOGLALO.test(u.pathname)) return null;
    return u;
  };
  // A regi koztes oldalak (/idopontfoglalas = a 4 kartya, /kontroll = a visszahivas-kero urlap) megszuntek: a cimuk a fooldalt adja (a build
  // a fooldal tartalmat teszi oda), es betolteskor magatol megnyilik a foglalo (/idopontfoglalas: tipus-valaszto, /kontroll: a kontroll-urlap);
  // bezarva a fooldal marad, a cim "/" lesz. Minden ra mutato link is a motort nyitja (nincs lapbetoltes). A regi oldalak csak a vesz-
  // visszaallitas (0%-os kapcsolo, ?motor=0, a motor nem tolt be) tartaleka: /regi-idopontfoglalas, /regi-kontroll (noindex).
  var BELSO = /^\/(idopontfoglalas|kontroll)\/?$/i;
  var belsoLink = function (a) {
    var u;
    try { u = new URL(a.href); } catch (e) { return null; }
    return u.origin === location.origin && BELSO.test(u.pathname) ? u : null;
  };
  var szam = function (v) { return v && /^-?\d+$/.test(v) ? +v : null; };
  // A Salonic foglalooldalai a legfelso ablakban a motorra iranyitanak at (assets/salonic/atiranyitas.js, docs/SALONIC_ATIRANYITAS.md).
  // Ahol a vendeg szandekosan a Salonicra megy (a motor ki van kapcsolva / nem toltheto be / modositas-lemondas), a link ezt a
  // kikerulo parametert kapja, kulonben a Salonic visszakuldene ide (hurok).
  var KIKERULO = 'mp_nincs_atiranyitas';
  var kikerul = function (href) {
    try { var k = new URL(href); if (k.hostname !== 'medicalpiercing.salonic.hu') return href; k.searchParams.set(KIKERULO, '1'); return k.href; } catch (e) { return href; }
  };
  var kikerulLink = function (a) { var h = a.getAttribute('href'); if (h && /^https?:\/\/medicalpiercing\.salonic\.hu(\/|$)/i.test(a.href)) a.setAttribute('href', kikerul(a.href)); };
  // a lap cimenek kattintas-azonositoi a Salonic-adatlapnak (mint a klon.js a linkeken; a Google-azonositok nem)
  var TOVABB = /^(fbclid|ttclid|utm_[a-z_]+)$/i;
  // A link szovege dont: ha kontrollt, ekszercserét vagy garanciat emlit, egybol az ures-urlap nyilik; minden mas foglalasi gomb a tipus-valasztot nyitja.
  var szoveg = function (a) { return ((a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' + (a.getAttribute('title') || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' '); };
  var urlapTipus = function (a, u) {
    var t = szoveg(a);
    if (/ekszer\s*cser/.test(t)) return 'ekszercsere';
    if (/garanci/.test(t) && !/kontrol/.test(t)) return 'garancia';
    if (/kontrol/.test(t)) return 'kontroll';
    return /^\/kontroll\/?$/i.test(u.pathname) ? 'kontroll' : null;
  };
  // az idopont modositasa / lemondasa a Salonic vendeg-fiokjaban tortenik: ezek a linkek a Salonicra mennek
  var NEM_FOGLALAS = /modosit|lemond/;
  var regiOldal = function () { return '/regi-' + location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase() + location.search + location.hash; };

  var betolt = null;
  var motor = function () {
    if (!betolt) betolt = import(MOTOR).catch(function (e) { betolt = null; throw e; });
    return betolt;
  };
  var gtagHiba = function (ok) { try { if (typeof window.gtag === 'function') window.gtag('event', 'motor_hiba', { send_to: 'G-SJT2RN62H8', hiba_tipus: ok }); } catch (e) { /* */ } };

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var b = belsoLink(a);
    if (b && bekapcsolva()) {
      e.preventDefault();
      var bctx = { merjen: true, tipus: urlapTipus(a, b), link: 'https://medicalpiercing.salonic.hu/selectLocation', forras: location.pathname };
      motor().then(function (m) { m.nyit(bctx); }, function () { gtagHiba('betoltes'); location.href = '/regi-' + b.pathname.replace(/^\/+|\/+$/g, '').toLowerCase() + b.search; });
      return;
    }
    var u = foglalasiLink(a);
    if (!u || !bekapcsolva() || NEM_FOGLALAS.test(szoveg(a))) { kikerulLink(a); return; }
    e.preventDefault();
    var p = u.searchParams;
    var ctx = {
      placeId: szam(p.get('placeId')), employeeId: szam(p.get('employeeId')) > 0 ? szam(p.get('employeeId')) : (/^\/employees\/(\d+)/i.exec(u.pathname) || [])[1] || null,
      serviceId: szam(p.get('serviceId')) > 0 ? p.get('serviceId') : null, tipus: urlapTipus(a, u), link: u.href, forras: location.pathname,
    };
    motor().then(function (m) { m.nyit(ctx); }, function () {
      // a motor nem toltheto be: a vendeg a regi utat kapja (ugyanabban a lapban, a felugro-tilto nem allitja meg)
      gtagHiba('betoltes');
      location.href = kikerul(u.href);
    });
  }, false);

  // elomelegites: a foglalasi gomb fole vitt eger / erintes betolti a motort (a kattintasra mar kesz)
  var meleg = function (e) {
    if (!bekapcsolva()) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    var u = a && (foglalasiLink(a) || belsoLink(a));
    if (!u) return;
    motor().then(function (m) { var pid = szam(u.searchParams.get('placeId')); if (pid) m.melegit(pid); }, function () {});
  };
  // az (egykori) koztes oldalak cimen betolteskor magatol megnyilik a foglalo; bezarva a fooldal marad (a cim "/" lesz)
  // A Salonicrol atiranyitott vendeg (?mp_honnan=salonic; placeId / serviceId / employeeId a Salonic-cimbol) a /idopontfoglalas cimre jon.
  if (BELSO.test(location.pathname)) {
    var sp = new URLSearchParams(location.search);
    var salonicrol = sp.get('mp_honnan') === 'salonic';
    var hely = szam(sp.get('placeId')), szolg = szam(sp.get('serviceId')), szak = szam(sp.get('employeeId'));
    // a Salonic-link, amelyet a motor kapott volna: ebbol veszi az adatlap a kattintas-azonositokat, es ez a tartalek-ut
    var salonicLink = function () {
      var l = new URL('https://medicalpiercing.salonic.hu/' + (hely ? (szolg || szak ? 'showServices/' : 'selectSpecialization/') : 'selectLocation'));
      if (hely) l.searchParams.set('placeId', hely);
      if (szolg && szolg > 0) l.searchParams.set('serviceId', szolg);
      if (szak && szak > 0) l.searchParams.set('employeeId', szak);
      sp.forEach(function (v, k) { if (v && TOVABB.test(k) && !l.searchParams.has(k)) l.searchParams.set(k, v); });
      return l.href;
    };
    var vissza = function () { location.replace(salonicrol ? kikerul(salonicLink()) : regiOldal()); };
    if (!bekapcsolva()) { vissza(); return; }
    var auto = function () {
      var kontroll = /^\/kontroll\/?$/i.test(location.pathname);
      var bezarasUtan = function () {
        try {
          var m = new URLSearchParams(location.search);
          ['mp_honnan', 'placeId', 'serviceId', 'employeeId', 'specId'].forEach(function (k) { m.delete(k); });
          var q = m.toString();
          history.replaceState(null, '', '/' + (q ? '?' + q : '') + location.hash);
        } catch (e) { /* */ }
      };
      motor().then(function (m) {
        m.nyit({ tipus: kontroll ? 'kontroll' : null, merjen: !kontroll, placeId: kontroll ? null : hely, serviceId: kontroll || !(szolg > 0) ? null : String(szolg), employeeId: kontroll || !(szak > 0) ? null : szak,
          link: salonicLink(), forras: salonicrol ? '/salonic-atiranyitas' : location.pathname, bezarasUtan: bezarasUtan });
      }, function () { gtagHiba('betoltes'); vissza(); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
  }
  document.addEventListener('pointerover', meleg, { passive: true });
  document.addEventListener('touchstart', meleg, { passive: true });
})();
