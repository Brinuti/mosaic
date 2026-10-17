// Medical Piercing - a Salonic foglalooldalak atiranyitasa a sajat foglalomotorra (docs/SALONIC_ATIRANYITAS.md).
//
// A Salonic-fiok (medicalpiercing.salonic.hu) GTM-cimkeje tolti be (docs/salonic-atiranyitas-gtm.html), CSAK a legfelso ablakban:
// a sajat motorunk keretben (iframe) nyitja a Salonic /guestData/ adatlapjat - ott ez a fajl le sem toltodik, es ha megis, itt is kilep.
// Aki kozvetlenul a Salonic foglalo oldalaira erkezik (regi hirdetesek, Google-profil, konyvjelzo), az a www.medicalpiercing.hu
// /idopontfoglalas cimere kerul (location.replace), ahol a motor betolteskor magatol megnyilik, a Salonic-cimbol kiolvashato
// helyszinnel / kezelessel / szakemberrel; a kattintas-azonositok (fbclid, gclid, ttclid, utm_*) a cimben maradnak.
//
// NEM iranyit at: keretben; nem foglalo oldalon (adatlap /guestData/, /booking/*, /user/*, ajandekkartya, jogi oldalak, nyelvvaltas,
// lemondas, "A foglalasod"); ha a cimben ismeretlen parameter van (pl. egy SMS-/e-mail-link azonositoja); ha a cimben, vagy ebben a
// lapban korabban, ott volt a ?mp_nincs_atiranyitas=1; ha a hivatkozo a sajat oldalunk (*.medicalpiercing.hu); ha ebben a lapban
// 30 mp-en belul mar ugyanoda iranyitottunk (hurok-vedelem).
// Kapcsolo: a build irja be (salonic-atiranyitas.json "be" ES motor-kapcsolo.json "arany" = 100). A fajlt a Salonic mindig
// ellenorizve kapja (lib/salonic-css.js: no-cache), igy a kikapcsolas azonnal hat. Vesz-kikapcsolas a GTM-ben: a cimke szuneteltetese.
(function () {
  'use strict';
  var BE = __ATIRANYITAS_BE__; // 1 | 0
  var SALONIC_HOST = 'medicalpiercing.salonic.hu';
  var CEL = 'https://www.medicalpiercing.hu/idopontfoglalas';
  var KIKERULO = 'mp_nincs_atiranyitas';
  var TAROLO = 'mp_atiranyitas';
  // a Salonic foglalasi tolcserenek oldalai (minden mas: marad)
  var FOGLALO = /^\/(selectlocation|selectspecialization|showservices|selectemployee|selectdate|employees(\/\d+)?)?\/?$/i;
  // ismert parameterek; barmi mas (pl. foglalas-azonosito, token) eseten nem iranyitunk at
  var ISMERT = /^(placeid|employeeid|serviceid|specid|startdate|back|lang|_gl|fbclid|gclid|gbraid|wbraid|ttclid|msclkid|igsh|igshid|srsltid|mibextid|utm_[a-z_]+|hsa_[a-z_]+)$/i;
  var TOVABB = /^(fbclid|gclid|gbraid|wbraid|ttclid|msclkid|utm_[a-z_]+)$/i;
  var szam = function (v) { return v && /^-?\d{1,9}$/.test(v) ? v : null; };

  /** A cel cime (string) vagy null, ha ezt a Salonic-cimet nem iranyitjuk at. Tiszta fuggveny (teszt: tools/salonic-atiranyitas-teszt.mjs). */
  function celCim(href) {
    var u;
    try { u = new URL(href); } catch (e) { return null; }
    if (u.hostname.toLowerCase() !== SALONIC_HOST || !FOGLALO.test(u.pathname)) return null;
    var p = u.searchParams, kulcsok = [], i;
    p.forEach(function (v, k) { kulcsok.push(k); });
    for (i = 0; i < kulcsok.length; i++) {
      if (kulcsok[i] === KIKERULO) return null;
      if (!ISMERT.test(kulcsok[i])) return null;
    }
    var c = new URL(CEL);
    var placeId = szam(p.get('placeId'));
    var employeeId = szam(p.get('employeeId')) || (/^\/employees\/(\d+)/i.exec(u.pathname) || [])[1] || null;
    var serviceId = szam(p.get('serviceId'));
    var specId = szam(p.get('specId'));
    if (placeId) c.searchParams.set('placeId', placeId);
    if (serviceId && +serviceId > 0) c.searchParams.set('serviceId', serviceId);
    if (employeeId && +employeeId > 0) c.searchParams.set('employeeId', employeeId);
    if (specId) c.searchParams.set('specId', specId);
    for (i = 0; i < kulcsok.length; i++) {
      if (TOVABB.test(kulcsok[i]) && !c.searchParams.has(kulcsok[i])) c.searchParams.set(kulcsok[i], p.get(kulcsok[i]));
    }
    c.searchParams.set('mp_honnan', 'salonic'); // jelolo: a sajat meres (D1 / GA4) igy kulon latja az atiranyitott vendegeket
    return c.href;
  }

  var MP = window.mpSalonicAtiranyitas = { celCim: celCim, kikerulo: KIKERULO };
  try { if (window.top !== window.self) return; } catch (e) { return; } // keretben (a sajat motorunkban) soha
  if (!BE) return;
  var t = null;
  try { t = window.sessionStorage; } catch (e) { t = null; }
  try {
    if (new URL(location.href).searchParams.get(KIKERULO) === '1') { if (t) t.setItem(KIKERULO, '1'); return; }
    if (t && t.getItem(KIKERULO) === '1') return;
    // a sajat oldalunkrol jott (a motor ki van kapcsolva / nem toltott be / modositas-lemondas link): szandekosan a Salonicon foglal.
    // A Salonic a sajat atiranyitasain (pl. /selectSpecialization/ -> /showServices/) eldobja a cim parametereit, a kikerulot is,
    // a hivatkozo viszont megmarad.
    var ref = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';
    if (/(^|\.)medicalpiercing\.hu$/.test(ref)) { if (t) t.setItem(KIKERULO, '1'); return; }
  } catch (e) { return; }
  var cel = celCim(location.href);
  if (!cel) return;
  try {
    var elozo = t ? String(t.getItem(TAROLO) || '').split('|') : [];
    if (elozo[1] === cel && Date.now() - (+elozo[0] || 0) < 30000) return; // hurok-vedelem: ugyanoda 30 mp-en belul masodszor nem
    if (t) t.setItem(TAROLO, Date.now() + '|' + cel);
  } catch (e) { /* tiltott tarolo: egyszeri atiranyitas */ }
  MP.cel = cel;
  location.replace(cel);
})();
