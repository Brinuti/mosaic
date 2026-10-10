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
})();
