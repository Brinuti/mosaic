// Merokodok es suti-sav: pontosan az, amit a Wix-oldalon az "Egyeni kod" (Custom
// Code) beallitas minden oldal <head>-jebe tett (a lementett oldalak
// pageHtmlEmbeds blokkja, 2026-10-10):
//
//   - Google Ads (gtag.js)          AW-11097894040
//   - Google Tag Manager            GTM-T9GR4JCK (benne a GA4, Meta, TikTok stb. cimkek)
//   - Convertize pixel              11722
//   - CookieYes suti-sav            a46a34517503eaa18c4543f0d0696746 (a hozzajarulast a
//                                   CookieYes kezeli, a GTM-cimkek ehhez igazodnak)
//   - Facebook domain-igazolas (a wix2static teszi be meta-cimkekent)
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
})();
