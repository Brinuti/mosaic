// Suti-sav, hozzajarulas-kezeles es merokodok - a Wix sajat rendszere helyett.
//
// Az eles Wix-oldalon ugyanez harom helyrol jott:
//   - a "Mosaic suti-sav" egyeni kod (bodyEnd): a sav kinezete es szovege
//     - ezt vesszuk at valtozatlanul, csak a Wix consentPolicyManager helyett
//     a sajat tarolonkba (localStorage) ment, es a Wix "consent-policy" sutijet
//     is olvassa/irja (a csere utan a korabbi dontes ervenyes marad);
//   - a Wix Google Tag Manager es Google Analytics integracioja (Consent Mode v2);
//   - egyeni kod a <head>-ben: Meta Pixel, Trustindex richsnippet.
//
// A kategoriak a suti-tajekoztato szerint:
//   fun = funkcionalis (Trustindex-velemenyek, Google-terkep)
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

  // A foglalo oldal (/foglalo-proba) beagyazott Salonic-adatlapja sikeres foglalas utan a mi
  // koszonooldalunkra iranyit - a keretben (ha az idopont kozben elkelt, a fooldalunkra).
  // Ilyenkor itt semmi nem fut (meres sem): a foglalo oldal dont - a koszonooldalt a teljes
  // ablakban nyitja meg, igy a konverzio egyszer, a fo ablakban merodik (mint eddig).
  try {
    if (window.top !== window.self && window.parent.location.hostname === location.hostname) {
      document.documentElement.style.visibility = 'hidden';
      if (typeof window.parent.mhKeretbenOldal === 'function') window.parent.mhKeretbenOldal(location.href);
      else window.top.location.replace(location.href);
      return;
    }
  } catch (e) { /* idegen oldal kereteben: nincs teendo */ }

  // --- beallitasok ------------------------------------------------------
  var GTM = 'GTM-PST2HB22';
  var GA4 = 'G-H4206SQ0Q7';
  // Meta-pixelek oldalanként, pontosan a Wix egyeni kodjainak oldal-beallitasa
  // szerint (Headspa / PMU / Fodrasz / Szor). A Wixen "szukseges" kategoriaban
  // voltak, igy hozzajarulastol fuggetlenul futottak - az adatsor miatt itt is.
  // 2026-10: a Meta-hirdetesek ajandekkartya- es kampany-landingjei is felkerultek (a Wixen
  // erkezo forgalom egy resze ilyen oldalon landolt, es nem volt _fbc / _fbp). A
  // ppc-allashirdetes (allasos hirdetes) SZANDEKOSAN kimarad a Meta-meresbol; alapertelmezett
  // pixel nincs: csak a felsorolt oldal kap pixelt.
  var PIXEL_HEADSPA = '3473839859576758', PIXEL_PMU = '1019878750660854',
    PIXEL_FODRASZ = '1361403694872594', PIXEL_SZOR = '643342342027957';
  var PIXEL_OLDALAK = {};
  [[PIXEL_HEADSPA, 'index home success-foglalas-egyeni-vip success-foglalas head-spa-kedvezmeny headspa-kupon headspa-ferfiaknak headspa-ajandekkartya success-elofizetes headspa-10szazalek-kedvezmennyel headspa-arak-budapest headspa-elofizetes success-foglalas-4kezes ajikartya-ok headspa-budapest-hungary head-spa-velemenyek foglalas-ok success-foglalas-paros headspa-budapest success-foglalas-paros-vip success-ajandekkartya-stripe 4-kezes-headspa-ajandekkartya paros-headspa-budapest success-ajandekkartya success-foglalas-egyeni japan-headspa-ajandekkartya headspa-ajandekkartya-anyukaknak headspa-ajándékkártya-ezo headspa-ajandakkartya-fiataloknak headspa-paros-csajos-ajandekkartya headspa-self-care idpontfoglalas'],
    [PIXEL_PMU, 'korrekcio-ok pmu-ok sminktetovalas-budapest eltavolitas-ok pmu-vh pmu-lead-ok sminktetovalas-budapest-rovid pmu-melitta'],
    [PIXEL_FODRASZ, 'fodraszat-foglalas balayage-haj-festes-budapest fodrasz-ok noi-fodrasz-budapesten-30-szazalek-kedvezmennyel noi-fodraszat-szoke noi-fodraszat-hullam 30szazalek oxigenterapia-ok noi-fodraszat-budapest noi-fodrasz-budapest-balayage-hajfestes noi-hajfestes-budapest oxigenterapia-budapest oxigenterapia-ferfiaknak mosaic-hair-idopontfoglalas'],
    [PIXEL_SZOR, 'lezeres-szortelenites-budapest szortelenites-foglalas elysion-ok szor-konzi-ok szortelenites-ok szortelenites-zsofi-rovid szortelenites-lezeres-kezeles-folyamata']
  ].forEach(function (s) { s[1].split(' ').forEach(function (o) { PIXEL_OLDALAK[o] = s[0]; }); });
  // az oldal Wix-beli neve az URL-bol ("/" -> index; a /m/ elotag es a .html nelkul)
  var OLDAL = decodeURIComponent(location.pathname).replace(/^\/(m\/)?/, '').replace(/\.html$/, '').replace(/\/$/, '') || 'index';
  // a Wix ezt az utvonalat kuldte a dataLayer-be es a GA4-be (kiterjesztes es /m/ nelkul)
  var UTVONAL = OLDAL === 'index' ? '/' : '/' + OLDAL;
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
    if (!o.reszleges) wixIr(o);
  }

  // --- a Wix korabbi dontese ----------------------------------------------
  // A Wix a dontest a "consent-policy" sutiben tarolta (.mosaicheadspa.hu, 1 ev):
  // {"ess":1,"func":1,"anl":1,"adv":1,"dt3":1,"ts":<perc 1970 ota>}, URL-kodolva.
  // A csere utan a visszatero latogato ne kapja meg ujra a savot: ha nincs sajat
  // dontes, de van Wix-dontes, azt vesszuk at. Visszafele is irjuk ugyanebben a
  // formaban, hogy egy esetleges visszaallas utan a Wix se kerdezzen ujra.
  var WIX_SUTI = 'consent-policy';
  function wixOlvas() {
    try {
      var m = d.cookie.match(/(?:^|;\s*)consent-policy=([^;]*)/);
      if (!m) return null;
      var c = JSON.parse(decodeURIComponent(m[1]));
      if (!c || c.ess === undefined) return null;
      var t = +c.ts > 0 ? c.ts * 6e4 : Date.now();
      if (Date.now() - t > ERVENYES_NAP * 864e5) return null;
      return { v: 1, t: t, fun: c.func == 1, ana: c.anl == 1, adv: c.adv == 1, wix: true };
    } catch (e) { return null; }
  }
  function wixIr(o) {
    try {
      var c = { ess: 1, func: o.fun ? 1 : 0, anl: o.ana ? 1 : 0, adv: o.adv ? 1 : 0, dt3: o.adv ? 1 : 0, ts: Math.floor(o.t / 6e4) };
      d.cookie = WIX_SUTI + '=' + encodeURIComponent(JSON.stringify(c)) + '; path=/; max-age=' + ERVENYES_NAP * 86400 +
        (eles ? '; domain=.mosaicheadspa.hu' : '') + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* nem baj */ }
  }

  var dontes = olvas();
  if (!dontes) {
    dontes = wixOlvas();
    if (dontes) { try { localStorage.setItem(KULCS, JSON.stringify(dontes)); } catch (e) { /* nem baj */ } }
  }
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

    // A Wix oldalmegtekintes-esemenyei a dataLayer-ben (a GTM-cimkek ezekre is epulhetnek)
    if (!betoltve.dl) {
      betoltve.dl = true;
      var cim = d.title;
      w.dataLayer.push({ event: 'Pageview', url: UTVONAL, title: cim });
      w.dataLayer.push({ ecommerce: null });
      w.dataLayer.push({ event: 'page_view', url: UTVONAL, title: cim, page_type: 'static' });
    }

    // GA4: mint a Wix "Google Tag (Advanced Consent Mode)" kodja - mindig betolt,
    // a hozzajarulast a Consent Mode jelei kezelik; az automatikus oldalmegtekintes
    // ki van kapcsolva, a Wix sajat csatornaja kuldte a page_view esemenyt.
    if (!betoltve.ga4) {
      betoltve.ga4 = true;
      betolt('https://www.googletagmanager.com/gtag/js?id=' + GA4);
      gtag('js', new Date());
      // a Wix minden GA4-hivasra (a GTM-bol jovokre is) rateszi: action_source=website
      gtag('set', { action_source: 'website' });
      gtag('config', GA4, { send_page_view: false });
      var lap = { page_location: location.origin + UTVONAL + location.search, page_title: d.title, action_source: 'website' };
      // a "visit" esemenyt nem kell kuldeni: a GA4 sajat "Esemeny letrehozasa" szabalya
      // minden page_view-rol keszit egy masolatot (a Wixen is igy jon letre)
      gtag('event', 'page_view', lap);
    }

    // Meta Pixel: az oldalhoz tartozo pixel, hozzajarulastol fuggetlenul (mint a Wixen)
    var pixel = PIXEL_OLDALAK[OLDAL];
    if (pixel && !betoltve.meta) {
      betoltve.meta = true;
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (w,d,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      w.fbq('init', pixel);
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
        '<p class="mh-txt">Sütiket használunk (<a href="/suti-tajekoztato" target="_blank" rel="noopener">részletek</a>).</p>' +
        '<button type="button" class="mh-link" data-mh="settings">Beállítások</button>' +
        '<button type="button" class="mh-primary" data-mh="accept">Elfogadom</button>' +
      '</div>' +
      '<div id="mh-cc-settings" style="display:none">' +
        '<h2>Süti beállítások</h2>' +
        kategoria('', 'Feltétlenül szükséges', 'Az oldal működéséhez kellenek, nem kapcsolhatók ki.') +
        kategoria('mh-cc-fun', 'Funkcionális', 'Kényelmi funkciók, pl. vendégértékelések és a térkép megjelenítése.') +
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
    // a savon belul barmilyen mozdulat leallitja az automatikus eltunest;
    // a beallitasok nezetet (a latogato nyitotta meg) nem rejtjuk el magatol
    if (melyik === 'settings') stopIdozito(); else inditIdozito();
  }
  // A lebego "Suti beallitasok" gomb nem jelenik meg (kerésre): a hozzajarulas a
  // lablec "Suti beallitasok" linkjevel modosithato (lasd lableclink()).
  function elrejt() { stopIdozito(); sav.style.display = 'none'; ujra.style.display = 'none'; }

  // Ha a latogato 20 masodpercig nem nyul a savhoz, eltunik (dontes nelkul - ilyenkor
  // minden nem-szukseges kategoria tiltva marad), es ebben a munkamenetben nem jon vissza.
  var AUTO_REJTES_MS = 20000;
  var idozito = null;
  function stopIdozito() { if (idozito) { clearTimeout(idozito); idozito = null; } }
  function inditIdozito() {
    stopIdozito();
    idozito = setTimeout(function () {
      idozito = null;
      try { sessionStorage.setItem('mh_cc_elrejtve', '1'); } catch (e) { /* nem baj */ }
      elrejt();
    }, AUTO_REJTES_MS);
  }
  function rejtveMunkamenetben() {
    try { return sessionStorage.getItem('mh_cc_elrejtve') === '1'; } catch (e) { return false; }
  }

  // "Suti beallitasok" link a lablecben, az "ASZF - Impresszum" sor vegen - a
  // tajekoztato szerint itt lehet a hozzajarulast utolag modositani vagy visszavonni.
  function lableclink() {
    var cel = null, linkek = d.querySelectorAll('a[href$="/impresszum"], a[href$="impresszum.html"]');
    for (var i = 0; i < linkek.length; i++) if (linkek[i].closest('footer')) cel = linkek[i];
    if (!cel || d.getElementById('mh-cc-lablec')) return;
    var kulso = cel.parentElement && cel.parentElement.tagName === 'SPAN' ? cel.parentElement : cel;
    var a = d.createElement('a');
    a.id = 'mh-cc-lablec';
    a.href = '#';
    a.className = cel.className;
    a.textContent = 'Süti beállítások';
    a.style.textDecoration = 'underline';
    a.addEventListener('click', function (e) { e.preventDefault(); mutat('settings'); });
    kulso.after(d.createTextNode(' - '), a);
  }

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
    ['pointerdown', 'focusin', 'mouseenter', 'touchstart'].forEach(function (ev) {
      sav.addEventListener(ev, stopIdozito, { passive: true });
    });
    lableclink();

    if ((!dontes || dontes.reszleges) && !rejtveMunkamenetben()) mutat('main');
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
