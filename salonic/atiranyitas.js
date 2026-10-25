// Mosaic - a regi Salonic foglalooldalak atiranyitasa a fooldalra (docs/booking-engine/SALONIC_ATIRANYITAS.md; minta: Medical Piercing, medicalpiercing/assets/salonic/atiranyitas.js).
//
// A Salonic-fiokok (mosaicheadspa / mosaic-hair / mosaic-oxigen / mosaic-elysion; a mosaic-pmu-ban nincs GTM) GTM-cimkeje tolti be (docs/booking-engine/gtm-salonic-atiranyitas.html),
// CSAK a legfelso ablakban: a sajat foglalonk keretben (iframe) nyitja a Salonic /guestData/ adatlapjat - ott ez a fajl le sem toltodik, es ha megis, itt is kilep.
// Aki kozvetlenul a Salonic foglalo oldalaira erkezik (regi hirdetesek, Google-profil, konyvjelzo, regi e-mail-link), az a https://www.mosaicheadspa.hu/
// fooldalra kerul (location.replace: a Vissza gomb nem visz vissza a Salonicra); a kattintas-azonositok (fbclid, gclid, ttclid, utm_*) a cimben maradnak,
// a foglalo NEM nyilik meg magatol, helyszint / kezelest / szakembert nem viszunk at (a Salonic-cimbol ez bizonytalan).
//
// NEM iranyit at: keretben; nem foglalo oldalon (adatlap /guestData/, /booking/* = "A foglalasod" / lemondas, /success/*, /user/*, ajandekkartya, jogi oldalak,
// nyelvvaltas); ha a cimben ismeretlen parameter van (pl. egy SMS-/e-mail-link azonositoja); ha a cimben, vagy ebben a lapban korabban, ott volt
// a ?mh_nincs_atiranyitas=1; ha a hivatkozo a sajat oldalunk (*.mosaicheadspa.hu: a vendeg szandekosan a Salonicra ment); ha ebben a lapban 30 mp-en belul
// mar ugyanoda iranyitottunk (hurok-vedelem).
// Kapcsolo: a BE allando (1 | 0). A fajlt a Salonic mindig ellenorizve kapja (/salonic/*: no-cache), igy a BE = 0 merge-elese a deploy utan azonnal hat.
// Vesz-kikapcsolas a GTM-ben: a cimke szuneteltetese (a kod ekkor meg sem toltodik).
(function () {
  'use strict';
  var BE = 1; // 1 | 0
  var SALONIC_HOST = /^(mosaicheadspa|mosaic-hair|mosaic-oxigen|mosaic-elysion|mosaic-pmu)\.salonic\.hu$/i; // a mosaic-pmu fiokban jelenleg nincs GTM (a cimke ott nem fut), a kod kesz ra
  var CEL = 'https://www.mosaicheadspa.hu/'; // a fooldalra, a foglalo NEM nyilik meg magatol
  var KIKERULO = 'mh_nincs_atiranyitas';
  var TAROLO = 'mh_atiranyitas';
  // a Salonic foglalasi tolcserenek oldalai (minden mas: marad)
  var FOGLALO = /^\/(selectlocation|selectspecialization|showservices|selectemployee|selectdate|employees(\/\d+)?)?\/?$/i;
  // ismert parameterek; barmi mas (pl. foglalas-azonosito, token) eseten nem iranyitunk at
  var ISMERT = /^(placeid|employeeid|serviceid|specid|startdate|back|lang|_gl|fbclid|gclid|gbraid|wbraid|ttclid|msclkid|igsh|igshid|srsltid|mibextid|utm_[a-z_]+|hsa_[a-z_]+)$/i;
  var TOVABB = /^(fbclid|gclid|gbraid|wbraid|ttclid|msclkid|utm_[a-z_]+)$/i;

  /** A cel cime (string) vagy null, ha ezt a Salonic-cimet nem iranyitjuk at. Tiszta fuggveny (teszt: tools/test-salonic-atiranyitas.mjs). */
  function celCim(href) {
    var u;
    try { u = new URL(href); } catch (e) { return null; }
    if (!SALONIC_HOST.test(u.hostname) || !FOGLALO.test(u.pathname)) return null;
    var p = u.searchParams, kulcsok = [], i;
    p.forEach(function (v, k) { kulcsok.push(k); });
    for (i = 0; i < kulcsok.length; i++) {
      if (kulcsok[i] === KIKERULO) return null;
      if (!ISMERT.test(kulcsok[i])) return null;
    }
    var c = new URL(CEL);
    for (i = 0; i < kulcsok.length; i++) {
      if (TOVABB.test(kulcsok[i]) && !c.searchParams.has(kulcsok[i])) c.searchParams.set(kulcsok[i], p.get(kulcsok[i]));
    }
    c.searchParams.set('mh_honnan', 'salonic'); // jelolo: a sajat meres (D1 / GA4) igy kulon latja az atiranyitott vendegeket
    return c.href;
  }

  var MH = window.mhSalonicAtiranyitas = { celCim: celCim, kikerulo: KIKERULO };
  try { if (window.top !== window.self) return; } catch (e) { return; } // keretben (a sajat foglalonkban) soha
  if (!BE) return;
  var t = null;
  try { t = window.sessionStorage; } catch (e) { t = null; }
  try {
    if (new URL(location.href).searchParams.get(KIKERULO) === '1') { if (t) t.setItem(KIKERULO, '1'); return; }
    if (t && t.getItem(KIKERULO) === '1') return;
    // a sajat oldalunkrol jott (szandekosan a Salonicon foglal / modosit): nem iranyitunk at, es ebben a lapban tobbet sem.
    // A Salonic a sajat atiranyitasain (pl. /selectSpecialization/ -> /showServices/) eldobja a cim parametereit, a kikerulot is,
    // a hivatkozo viszont megmarad.
    var ref = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';
    if (/(^|\.)mosaicheadspa\.hu$/.test(ref)) { if (t) t.setItem(KIKERULO, '1'); return; }
  } catch (e) { return; }
  var cel = celCim(location.href);
  if (!cel) return;
  try {
    var elozo = t ? String(t.getItem(TAROLO) || '').split('|') : [];
    if (elozo[1] === cel && Date.now() - (+elozo[0] || 0) < 30000) return; // hurok-vedelem: ugyanoda 30 mp-en belul masodszor nem
    if (t) t.setItem(TAROLO, Date.now() + '|' + cel);
  } catch (e) { /* tiltott tarolo: egyszeri atiranyitas */ }
  MH.cel = cel;
  location.replace(cel);
})();
