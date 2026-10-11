// Merokodok es suti-sav: pontosan az, amit a Wix-oldalon az "Egyeni kod" (Custom
// Code) beallitas minden oldal <head>-jebe tett (a lementett oldalak
// pageHtmlEmbeds blokkja, 2026-10-10):
//
//   - Google Ads (gtag.js)          AW-11097894040
//   - Google Tag Manager            GTM-T9GR4JCK (benne a GA4, a TikTok es a Google Ads-konverziok)
//   - Convertize pixel              11722
//   - CookieYes suti-sav            a46a34517503eaa18c4543f0d0696746 (a hozzajarulast a
//                                   CookieYes kezeli, a GTM-cimkek ehhez igazodnak)
//   - Facebook domain-igazolas (a wix2static teszi be meta-cimkekent)
//
// es amit a Wix beepitett marketing-integracioja adott (a GTM-ben nincs benne):
//
//   - Meta-pixel                    2177829632420786: alapkod + PageView, KIVEVE a
//                                   koszonooldalakat (/foglalas-ok*): ott se PageView, se
//                                   noscript-kep (a Schedule esemenyt a Salonic szervere kuldi)
//
// A GA4 (G-SJT2RN62H8) es a TikTok-pixel (CU2CR03C77UAQJITQK80) a GTM-bol jon (a GA4
// Google-cimke minden oldalon egyszer kuldi a page_view-t): kulon nem kell, kulonben dupla
// lenne. Csak Medical Piercing azonositok lehetnek itt (a Mosaic oldalnak sajat suti.js-e van).
//
// CSAK az eles domainen futnak (ELES_DOMAINEK), igy a probacimek (*.pages.dev,
// localhost) nem szennyezik a statisztikat, es a CookieYes-licenc is a domainhez kotott.
(function () {
  'use strict';
  var ELES_DOMAINEK = ['www.medicalpiercing.hu', 'medicalpiercing.hu'];
  if (ELES_DOMAINEK.indexOf(location.hostname) < 0) return;

  // A foglalomotor (assets/js/motor/motor.js) a Salonic adatlapjat keretben mutatja; sikeres foglalas utan a Salonic a
  // keretben iranyit a koszonooldalra (/foglalas-ok*; a divat fulpiercingnel /fulbevalo-ok*). Ilyenkor a koszonooldal jelez a motornak (postMessage), es ha a
  // motor 1,5 mp-en belul visszaigazolja, hogy UGYANEZT a koszonooldalt a fo ablakban nyitja meg (booking_id-vel), itt
  // NEM merunk (kulonben ketszer szamolna; a jelzes: <html data-mp-motor-atvette="1">). A regi, kozvetlenul beagyazott
  // Salonic-naptarak keretei (pl. /migren-piercing-uj) nem kapnak valaszt: ott minden a regi, a keretben merunk.
  if (window.top !== window && /^\/(foglalas-ok|fulbevalo-ok)/i.test(location.pathname)) {
    var atvette = false;
    window.addEventListener('message', function (e) {
      if (e.source === window.parent && e.data && e.data.tipus === 'mp-motor-atvette') {
        atvette = true;
        document.documentElement.setAttribute('data-mp-motor-atvette', '1');
      }
    });
    try { window.parent.postMessage({ tipus: 'mp-foglalas-ok', url: location.href }, '*'); } catch (e) { /* nincs szulo */ }
    setTimeout(function () { if (!atvette && !marMert()) meres(); }, 1500);
    return;
  }
  if (/^\/(foglalas-ok|fulbevalo-ok)/i.test(location.pathname) && marMert()) return;
  meres();

  // Ugyanannak a foglalasnak a koszonooldala egy bongeszoben csak EGYSZER mer: frissiteskor, visszalepeskor, ujranyitaskor
  // nem (QA-4). Kulcs: a motor booking_id-je, ennek hianyaban a Salonic bookingUrl-je; 30 napig emlekszik (localStorage,
  // szemelyes adat nincs benne). Az ismetlest a <html data-mp-mar-mert="1"> jeloli (a teszteknek).
  function marMert() {
    var q = new URLSearchParams(location.search);
    var kulcs = q.get('booking_id') || q.get('bookingUrl');
    if (!kulcs) return false;
    var T = 'mp_koszono', most = Date.now(), lista;
    try { lista = JSON.parse(localStorage.getItem(T) || '{}') || {}; } catch (e) { return false; }
    for (var k in lista) if (!(most - lista[k] < 30 * 864e5)) delete lista[k];
    var volt = Object.prototype.hasOwnProperty.call(lista, kulcs);
    if (volt) document.documentElement.setAttribute('data-mp-mar-mert', '1');
    else lista[kulcs] = most;
    try { localStorage.setItem(T, JSON.stringify(lista)); } catch (e) { /* tiltott tarolo: mint eddig, mer */ }
    return volt;
  }

  function meres() {
  var fej = document.head || document.documentElement;
  var szkript = function (src, attr) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    if (attr) for (var k in attr) s.setAttribute(k, attr[k]);
    fej.appendChild(s);
    return s;
  };

  // CookieYes suti-sav (a Wixen is az elso helyen toltott, szinkron)
  szkript('https://cdn-cookieyes.com/client_data/a46a34517503eaa18c4543f0d0696746/script.js', { id: 'cookieyes' });

  // Google Ads (gtag.js)
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  szkript('https://www.googletagmanager.com/gtag/js?id=AW-11097894040');
  window.gtag('js', new Date());
  window.gtag('config', 'AW-11097894040');

  // Google Tag Manager
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  szkript('https://www.googletagmanager.com/gtm.js?id=GTM-T9GR4JCK');

  // Convertize
  szkript('https://pixel.convertize.io/11722.js');

  // Meta-pixel (a Meta szabvanyos alapkodja), a koszonooldalakon nem
  if (!/^\/foglalas-ok/i.test(location.pathname)) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', '2177829632420786');
    window.fbq('track', 'PageView');
  }

  // TikTok "Foglalas inditasa" (Feri dontese, 2026-10-10, MP-WEBOLDAL-ELLENORZES H-7): minden
  // medicalpiercing.salonic.hu foglalasi linkre kattintaskor egy szabvanyos InitiateCheckout
  // esemeny, CSAK a www.medicalpiercing.hu-n, a koszonooldalakon (/foglalas-ok*) nem.
  // content_name: "foglalas_inditasa"; content_category: a piercing-tipus rovid kodja az oldal
  // cime alapjan (nem egeszsegugyi szoveg): mi (migren, daith, fejfajas), sh (shenmen),
  // kl (klimax), sl (slim, fogyas, etvagy), al (allergia), mj (maj), lp (lep), vb (vastagbel),
  // pm (pajzsmirigy), soft (kozerzetjavito soft akcio), 3pc (3 piercing 2 araert), egyebkent alt.
  // Ha a cimben tobb tipus is szerepel, a legelso szamit. Az altalanos oldalakon (pl.
  // /idopontfoglalas, ahova a tipusoldalak foglalas-gombjai uj lapon visznek) az utolso 30 percben
  // legutobb megnezett tipusoldal kodja szamit (localStorage: az uj lap a sessionStorage-ot nem
  // kapja meg), ha volt ilyen. A TikTok-pixelt a GTM tolti (a
  // hozzajarulas szerint): ha nincs betoltve, nem kuldunk semmit. Kattintasonkent pontosan egy
  // esemeny: bal (es Ctrl/Cmd) kattintas -> click, kozepso gomb -> auxclick.
  if (location.hostname === 'www.medicalpiercing.hu' && !/^\/foglalas-ok/i.test(location.pathname)) {
    var tipusKod = function () {
      var ut;
      try { ut = decodeURIComponent(location.pathname); } catch (e) { ut = location.pathname; }
      ut = ut.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      if (/3-piercing-2-araert/.test(ut)) return '3pc';
      if (/kozerzetjavito-piercing-soft/.test(ut)) return 'soft';
      var TIPUSOK = [
        [/migren|daith|fejfajas/, 'mi'], [/shenmen/, 'sh'], [/klimax/, 'kl'], [/slim|fogyas|etvagy/, 'sl'],
        [/allergia/, 'al'], [/(^|[-/])maj([-/]|$)/, 'mj'], [/(^|[-/])lep([-/]|$)/, 'lp'],
        [/vastagbel/, 'vb'], [/pajzsmirigy/, 'pm'],
      ];
      var kod = 'alt', hol = Infinity;
      for (var i = 0; i < TIPUSOK.length; i++) {
        var m = TIPUSOK[i][0].exec(ut);
        if (m && m.index < hol) { hol = m.index; kod = TIPUSOK[i][1]; }
      }
      return kod;
    };
    var tipus = tipusKod();
    try {
      if (tipus !== 'alt') localStorage.setItem('mp_tipus', tipus + '|' + Date.now());
      else {
        var t = (localStorage.getItem('mp_tipus') || '').split('|');
        if (t[0] && Date.now() - Number(t[1]) < 30 * 60 * 1000) tipus = t[0];
      }
    } catch (e) { /* tiltott tarolo: az oldal sajat kodja marad */ }
    // GA4 "foglalas_inditasa" (MP-FOGLALOMOTOR-FELADAT 6.): ugyanitt, ugyanazzal a rovid tipuskoddal (piercing_tipus),
    // a foglalomotor dontese elott (a motor indito-ja a buborekolo szakaszban fut), igy a motoros es a regi uton azonosan.
    // A gtag a GTM Google-cimkejen at a G-SJT2RN62H8-ba kuld (send_to), a hozzajarulas szerint.
    var foglalasInditasa = function (e) {
      if (e.type === 'auxclick' && e.button !== 1) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || !/^https:\/\/medicalpiercing\.salonic\.hu([/?#]|$)/i.test(a.href)) return;
      if (typeof window.gtag === 'function') window.gtag('event', 'foglalas_inditasa', { send_to: 'G-SJT2RN62H8', piercing_tipus: tipus });
      if (!window.ttq || typeof window.ttq.track !== 'function') return;
      window.ttq.track('InitiateCheckout', { content_name: 'foglalas_inditasa', content_category: tipus });
    };
    document.addEventListener('click', foglalasInditasa, true);
    document.addEventListener('auxclick', foglalasInditasa, true);
  }
  }
})();
