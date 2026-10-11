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
  var szam = function (v) { return v && /^-?\d+$/.test(v) ? +v : null; };
  var oldalTipus = function () {
    var u;
    try { u = decodeURIComponent(location.pathname); } catch (e) { u = location.pathname; }
    u = u.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/3-piercing-2-araert/.test(u)) return '3pc';
    if (/kozerzetjavito-piercing-soft/.test(u)) return 'soft';
    var T = [[/migren|daith|fejfajas/, 'mi'], [/shenmen/, 'sh'], [/klimax/, 'kl'], [/slim|fogyas|etvagy/, 'sl'], [/allergia/, 'al'], [/(^|[-/])maj([-/]|$)/, 'mj'], [/(^|[-/])lep([-/]|$)/, 'lp'], [/vastagbel/, 'vb'], [/pajzsmirigy/, 'pm'], [/ful-piercing|fulbevalo/, 'divat']];
    var kod = 'alt', hol = Infinity;
    for (var i = 0; i < T.length; i++) { var m = T[i][0].exec(u); if (m && m.index < hol) { hol = m.index; kod = T[i][1]; } }
    if (kod === 'alt') { // az altalanos oldalakon (pl. /idopontfoglalas) a 30 percen belul nezett tipusoldal (suti.js: mp_tipus)
      try { var t = (localStorage.getItem('mp_tipus') || '').split('|'); if (t[0] && Date.now() - Number(t[1]) < 30 * 60 * 1000) kod = t[0]; } catch (e) { /* */ }
    }
    return kod;
  };

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
    var u = foglalasiLink(a);
    if (!u || !bekapcsolva()) return;
    e.preventDefault();
    var p = u.searchParams;
    var ctx = {
      placeId: szam(p.get('placeId')), employeeId: szam(p.get('employeeId')) > 0 ? szam(p.get('employeeId')) : (/^\/employees\/(\d+)/i.exec(u.pathname) || [])[1] || null,
      serviceId: szam(p.get('serviceId')) > 0 ? p.get('serviceId') : null, oldalTipus: oldalTipus(), link: u.href, forras: location.pathname,
    };
    motor().then(function (m) { m.nyit(ctx); }, function () {
      // a motor nem toltheto be: a vendeg a regi utat kapja (ugyanabban a lapban, a felugro-tilto nem allitja meg)
      gtagHiba('betoltes');
      location.href = u.href;
    });
  }, false);

  // elomelegites: a foglalasi gomb fole vitt eger / erintes betolti a motort (a kattintasra mar kesz)
  var meleg = function (e) {
    if (!bekapcsolva()) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    var u = a && foglalasiLink(a);
    if (!u) return;
    motor().then(function (m) { var pid = szam(u.searchParams.get('placeId')); if (pid) m.melegit(pid); }, function () {});
  };
  document.addEventListener('pointerover', meleg, { passive: true });
  document.addEventListener('touchstart', meleg, { passive: true });
})();
