// Suti-sav, hozzajarulas-kezeles es merokodok - a Wix sajat rendszere helyett.
//
// Az eles Wix-oldalon ugyanez harom helyrol jott:
//   - a "Mosaic suti-sav" egyeni kod (bodyEnd): a sav kinezete es szovege
//     - ezt vesszuk at valtozatlanul, csak a Wix consentPolicyManager helyett
//     a sajat tarolonkba (localStorage) ment;
//   - a Wix Google Tag Manager es Google Analytics integracioja (Consent Mode v2);
//   - egyeni kod a <head>-ben: Meta Pixel, Trustindex richsnippet.
//
// A kategoriak a suti-tajekoztato szerint:
//   fun = funkcionalis (Trustindex-velemenyek, Common Ninja GYIK es arlistak, Google-terkep)
//   ana = statisztika  (Google Analytics 4)
//   adv = marketing    (Google Ads, Meta, TikTok - a GTM-en es a Pixelen at)
//
// A tobbi szkript a window.mhSuti feluleten at kerdezheti le a dontest:
//   mhSuti.engedely('fun')         -> true/false
//   mhSuti.figyel(fn)              -> fn(dontes) minden valtozaskor
//   mhSuti.enged('fun')            -> egy kategoria utolagos engedelyezese
//   mhSuti.beallitasok()           -> a sav megnyitasa a beallitasoknal
(function () {
  'use strict';

  // --- beallitasok ------------------------------------------------------
  var GTM = 'GTM-PST2HB22';
  var GA4 = 'G-H4206SQ0Q7';
  var META_PIXEL = '3473839859576758';
  var TRUSTINDEX_SNIPPET = 'https://cdn.trustindex.io/assets/js/richsnippet.js?392183251480g320';
  // A merokodok csak az eles domainen futnak - a probaoldal (netlify.app,
  // localhost) ne szennyezze a statisztikat es a hirdetesi adatokat.
  var ELES_DOMAINEK = ['mosaicheadspa.hu', 'www.mosaicheadspa.hu'];
  var KULCS = 'mh_cc';
  var ERVENYES_NAP = 365; // a tajekoztato szerint 12 honap

  var w = window, d = document;
  if (w.mhSuti) return;

  // Keretbe agyazva (az osszehasonlito eszkoz) se sav, se meres.
  var beagyazott = w.top !== w.self;
  var eles = ELES_DOMAINEK.indexOf(location.hostname) >= 0;

  // --- tarolas ----------------------------------------------------------
  function olvas() {
    try {
      var o = JSON.parse(localStorage.getItem(KULCS));
      if (o && o.v === 1 && Date.now() - o.t < ERVENYES_NAP * 864e5) return o;
    } catch (e) { /* privat ablak, tiltott tarolo */ }
    return null;
  }
  function tarol(o) {
    try { localStorage.setItem(KULCS, JSON.stringify(o)); } catch (e) { /* nem baj */ }
  }

  var dontes = olvas();
  var figyelok = [];

  // --- Google Consent Mode v2 ------------------------------------------
  // Ugyanazok a jelek, amiket a Wix integracioja allitott.
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  if (!w.gtag) w.gtag = gtag;

  function jelek(p) {
    p = p || {};
    return {
      ad_storage: p.adv ? 'granted' : 'denied',
      ad_user_data: p.adv ? 'granted' : 'denied',
      ad_personalization: p.adv ? 'granted' : 'denied',
      analytics_storage: p.ana ? 'granted' : 'denied',
      functionality_storage: p.fun ? 'granted' : 'denied',
      personalization_storage: 'granted',
      security_storage: 'granted'
    };
  }

  function betolt(src) {
    var s = d.createElement('script');
    s.async = true;
    s.src = src;
    (d.head || d.documentElement).appendChild(s);
  }

  // --- merokodok ---------------------------------------------------------
  var betoltve = {};

  function merokodok() {
    if (!eles || beagyazott) return;
    var p = dontes || {};

    // GTM: a Wix is mindig betoltotte, a cimkeit a Consent Mode jelei engedik
    // vagy tiltjak. (A szerveroldali Stape-meres es a TikTok a GTM-ben van.)
    if (!betoltve.gtm) {
      betoltve.gtm = true;
      w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      betolt('https://www.googletagmanager.com/gtm.js?id=' + GTM);
    }

    // GA4: csak statisztikai hozzajarulassal. A Wix sajat csatornajan kuldte
    // az oldalmegtekintest - itt ezt maga a gtag teszi.
    if (p.ana && !betoltve.ga4) {
      betoltve.ga4 = true;
      betolt('https://www.googletagmanager.com/gtag/js?id=' + GA4);
      gtag('js', new Date());
      gtag('config', GA4);
    }

    // Meta Pixel: csak marketing-hozzajarulassal. (A Wixen egyeni kodkent
    // hozzajarulastol fuggetlenul futott - a tajekoztato szerint viszont
    // marketing-suti, ezert itt a donteshez kotjuk.)
    if (p.adv && !betoltve.meta) {
      betoltve.meta = true;
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (w,d,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      w.fbq('init', META_PIXEL);
      w.fbq('track', 'PageView');
    }
  }

  // alapallapot: amig nincs dontes, minden tiltva
  var alap = jelek(dontes);
  if (!dontes) alap.wait_for_update = 500;
  gtag('consent', 'default', alap);

  // A Trustindex ertekeles-snippet (csillagok a Google-talalatban) a Wixen is
  // hozzajarulastol fuggetlenul futott: sutit nem hasznal, csak strukturalt adatot ad.
  if (!beagyazott) betolt(TRUSTINDEX_SNIPPET);

  merokodok();

  // --- dontes rogzitese ---------------------------------------------------
  // reszleges: csak egy kategoriat engedett (pl. a terkepnel), a savban meg nem dontott
  function rogzit(fun, ana, adv, reszleges) {
    dontes = { v: 1, t: Date.now(), fun: !!fun, ana: !!ana, adv: !!adv };
    if (reszleges) dontes.reszleges = true;
    tarol(dontes);
    gtag('consent', 'update', jelek(dontes));
    // A Wix is ezt az esemenyt kuldte - ha a GTM-ben erre epul egy aktivalo, maradjon mukodokepes.
    w.dataLayer.push({ event: 'consentPolicyChanged' });
    merokodok();
    for (var i = 0; i < figyelok.length; i++) {
      try { figyelok[i](dontes); } catch (e) { /* egy hibas figyelo ne allitsa meg a tobbit */ }
    }
  }

  // --- a sav --------------------------------------------------------------
  // Kinezet es szoveg: az eles oldal "Mosaic suti-sav" egyeni kodjabol, valtozatlanul.
  var STILUS =
    '#mh-cc,#mh-cc *{box-sizing:border-box;font-family:inherit}' +
    '#mh-cc{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483000;max-width:520px;margin:0 auto;background:#fff;color:#222;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.18);padding:8px 10px 8px 14px;font-size:13px;line-height:1.4;display:none}' +
    '#mh-cc h2{font-size:15px;margin:0 0 6px;font-weight:600}' +
    '#mh-cc a{color:inherit;text-decoration:underline}' +
    '#mh-cc-main{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}' +
    '#mh-cc-main .mh-txt{flex:1 1 auto;margin:0}' +
    '#mh-cc .mh-row{display:flex;gap:8px;flex-wrap:wrap}' +
    '#mh-cc button{cursor:pointer;border-radius:999px;padding:7px 14px;font-size:13px;border:1px solid #222;background:#fff;color:#222;white-space:nowrap}' +
    '#mh-cc button.mh-primary{background:#222;color:#fff}' +
    '#mh-cc .mh-link{border:none;background:none;padding:7px 2px;text-decoration:underline}' +
    '#mh-cc .mh-cat{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 0;border-top:1px solid #eee}' +
    '#mh-cc .mh-cat small{display:block;color:#666}' +
    '#mh-cc input[type=checkbox]{width:20px;height:20px;margin-top:2px;flex:none}' +
    '#mh-cc-reopen{position:fixed;left:12px;bottom:12px;z-index:2147482999;background:#fff;color:#222;border:1px solid #ccc;border-radius:999px;padding:6px 12px;font-size:12px;cursor:pointer;display:none;box-shadow:0 2px 8px rgba(0,0,0,.12)}';

  function kategoria(id, cim, leiras) {
    return '<div class="mh-cat"><div><b>' + cim + '</b><small>' + leiras + '</small></div>' +
      '<input type="checkbox"' + (id ? ' id="' + id + '"' : ' checked disabled') + ' aria-label="' + cim + '"></div>';
  }

  var JELOLES =
    '<div id="mh-cc" role="dialog" aria-live="polite" aria-label="Süti beállítások">' +
      '<div id="mh-cc-main">' +
        '<p class="mh-txt">Sütiket használunk (<a href="suti-tajekoztato.html" target="_blank" rel="noopener">részletek</a>).</p>' +
        '<button type="button" class="mh-link" data-mh="settings">Beállítások</button>' +
        '<button type="button" class="mh-primary" data-mh="accept">Elfogadom</button>' +
      '</div>' +
      '<div id="mh-cc-settings" style="display:none">' +
        '<h2>Süti beállítások</h2>' +
        kategoria('', 'Feltétlenül szükséges', 'Az oldal működéséhez kellenek, nem kapcsolhatók ki.') +
        kategoria('mh-cc-fun', 'Funkcionális', 'Kényelmi funkciók, pl. vendégértékelések, GYIK, árlisták és a térkép megjelenítése.') +
        kategoria('mh-cc-ana', 'Statisztika', 'Megmutatja, hogyan használják a látogatók az oldalt.') +
        kategoria('mh-cc-adv', 'Marketing', 'Hirdetéseink mérése (Google, Meta, TikTok) és releváns ajánlatok.') +
        '<div class="mh-row" style="margin-top:12px">' +
          '<button type="button" class="mh-primary" data-mh="save">Kiválasztottak mentése</button>' +
          '<button type="button" data-mh="accept">Mindet elfogadom</button>' +
          '<button type="button" class="mh-link" data-mh="reject">Mindet elutasítom</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<button type="button" id="mh-cc-reopen">Süti beállítások</button>';

  var sav, ujra;

  function nezet(melyik) {
    d.getElementById('mh-cc-main').style.display = melyik === 'main' ? 'flex' : 'none';
    d.getElementById('mh-cc-settings').style.display = melyik === 'settings' ? '' : 'none';
  }
  function mutat(melyik) {
    if (melyik === 'settings') {
      // Elore bepipalt negyzet nem ervenyes hozzajarulas - dontes nelkul uresek.
      var p = dontes || {};
      d.getElementById('mh-cc-fun').checked = !!p.fun;
      d.getElementById('mh-cc-ana').checked = !!p.ana;
      d.getElementById('mh-cc-adv').checked = !!p.adv;
    }
    nezet(melyik || 'main');
    sav.style.display = 'block';
    ujra.style.display = 'none';
  }
  function elrejt() { sav.style.display = 'none'; ujra.style.display = 'block'; }

  function felepit() {
    if (beagyazott || sav) return;
    var st = d.createElement('style');
    st.textContent = STILUS;
    d.head.appendChild(st);

    // A mobil mentesekben a sav jelolese mar benne van (a Wix SSR-bol) - azt hasznaljuk.
    sav = d.getElementById('mh-cc');
    ujra = d.getElementById('mh-cc-reopen');
    if (sav) sav.remove();
    if (ujra) ujra.remove();
    var tarto = d.createElement('div');
    tarto.innerHTML = JELOLES;
    while (tarto.firstChild) d.body.appendChild(tarto.firstChild);
    sav = d.getElementById('mh-cc');
    ujra = d.getElementById('mh-cc-reopen');

    sav.addEventListener('click', function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute('data-mh');
      if (!a) return;
      if (a === 'accept') { rogzit(true, true, true); elrejt(); }
      else if (a === 'reject') { rogzit(false, false, false); elrejt(); }
      else if (a === 'settings') mutat('settings');
      else if (a === 'save') {
        rogzit(d.getElementById('mh-cc-fun').checked,
          d.getElementById('mh-cc-ana').checked,
          d.getElementById('mh-cc-adv').checked);
        elrejt();
      }
    });
    ujra.addEventListener('click', function () { mutat('settings'); });

    if (dontes && !dontes.reszleges) ujra.style.display = 'block';
    else mutat('main');
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', felepit);
  else felepit();

  // --- felulet a tobbi szkriptnek -------------------------------------------
  w.mhSuti = {
    engedely: function (kat) { return !!(dontes && dontes[kat]); },
    figyel: function (fn) { figyelok.push(fn); },
    enged: function (kat) {
      // A savot nyitva hagyjuk, ha meg nem dontott: egy terkep megnyitasa nem
      // jelenti a statisztika es a marketing elutasitasat.
      var p = dontes || {}, reszleges = !dontes || !!dontes.reszleges;
      rogzit(kat === 'fun' || p.fun, kat === 'ana' || p.ana, kat === 'adv' || p.adv, reszleges);
    },
    beallitasok: function () { if (sav) mutat('settings'); }
  };
})();
