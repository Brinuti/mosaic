// Sajat suti-sav (hozzajarulas-kezeles) es merokodok a www.medicalpiercing.hu-n. A Wixen a sav a CookieYes volt
// (a46a3451...), de a szkriptje 2026-10-10 ota 403-at ad: nem volt sav, nem volt hozzajarulasi suti, a merokodok
// hozzajarulas nelkul futottak. Feri dontese (2026-10-11 11:21): sajat sav. Leiras: docs/SUTISAV.md.
//
// Merokodok (a Wix "Egyeni kod" + a Wix marketing-integracioja szerint):
//   - Google Ads (gtag.js)          AW-11097894040        mindig betolt, Consent Mode v2 szerint mer
//   - Google Tag Manager            GTM-T9GR4JCK          mindig betolt (benne a GA4 G-SJT2RN62H8 - Consent Mode -,
//                                                         es a TikTok-pixel CU2CR03C77UAQJITQK80, amely a GTM-ben
//                                                         ad_storage-hozzajarulashoz kotott)
//   - Convertize pixel              11722                 CSAK marketing-hozzajarulassal
//   - Meta-pixel                    2177829632420786      CSAK marketing-hozzajarulassal, es a koszonooldalakon
//                                                         (/foglalas-ok*) soha: ott se PageView, se noscript-kep
//                                                         (a Schedule esemenyt a Salonic szervere kuldi)
//   - Facebook domain-igazolas (a wix2static teszi be meta-cimkekent)
//
// Kategoriak: szukseges (mindig) / statisztika (analytics_storage) / marketing (ad_storage, ad_user_data,
// ad_personalization + Meta, TikTok, Convertize). A dontes a "mp_suti" elso feles sutiben van (365 nap), formaja:
// "v1-s<0|1>-m<0|1>-t<unix mp>"; ezt olvassa a szerveres foglalas-meres is (lib/meres/google-ads.js hozzajarulas()).
// A tobbi szkript: window.mpSuti.engedely('stat'|'mark'), window.mpSuti.beallitasok(), es a document
// "mp_suti_valtozas" esemenye (detail: { stat, mark }).
//
// A sav minden cimen megjelenik (az elonezeten is tesztelheto), keretben (iframe) soha. A merokodok CSAK az eles
// domainen futnak (ELES_DOMAINEK), igy a probacimek (*.pages.dev, localhost) nem szennyezik a statisztikat.
// Csak Medical Piercing azonositok lehetnek itt (a Mosaic oldalnak sajat suti.js-e van).
(function () {
  'use strict';
  var ELES_DOMAINEK = ['www.medicalpiercing.hu', 'medicalpiercing.hu'];
  var eles = ELES_DOMAINEK.indexOf(location.hostname) >= 0;
  var keretben = window.top !== window;
  var KOSZONO = /^\/foglalas-ok/i.test(location.pathname);
  if (window.mpSuti) return;

  // ---------- hozzajarulas ----------
  var SUTI = 'mp_suti', NAP = 365;
  var olvasDontes = function () {
    var m = /(?:^|;\s*)mp_suti=v1-s([01])-m([01])-t(\d+)(?:;|$)/.exec(document.cookie);
    return m ? { stat: m[1] === '1', mark: m[2] === '1', t: +m[3] } : null;
  };
  var dontes = olvasDontes();

  // Google Consent Mode v2: az alapallapot a gtag.js es a GTM betoltese ELOTT (ez a szkript a <head>-ben szinkron fut).
  // Dontes nelkul minden nem szukseges tarolas tiltva; a gtag/GTM ilyenkor suti nelkuli jelet (cookieless ping) kuld.
  //   ads_data_redaction: true  -> ad_storage = denied mellett a hirdetesi kattintasazonositok kitakarva mennek.
  //   url_passthrough: NEM kapcsoljuk be: a klon.js mar tovabbviszi a gclid/fbclid/ttclid/utm_* parametereket a
  //   munkamenetben es a foglalasi linkeken (Wix-azonos viselkedes), a passthrough ezt duplazna / atirna a belso
  //   linkeket; a szerveres feltoltes pedig hozzajarulas nelkul ugysem kuld gclid-et. Lasd docs/SUTISAV.md.
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  var jelek = function (d) {
    return {
      ad_storage: d && d.mark ? 'granted' : 'denied',
      ad_user_data: d && d.mark ? 'granted' : 'denied',
      ad_personalization: d && d.mark ? 'granted' : 'denied',
      analytics_storage: d && d.stat ? 'granted' : 'denied'
    };
  };
  var alap = jelek(null);
  alap.functionality_storage = 'granted';
  alap.security_storage = 'granted';
  alap.personalization_storage = 'denied';
  if (!dontes) alap.wait_for_update = 500;
  window.gtag('consent', 'default', alap);
  window.gtag('set', 'ads_data_redaction', true);
  if (dontes) window.gtag('consent', 'update', jelek(dontes));

  var marketingFigyelok = [];
  var rogzit = function (stat, mark) {
    var elozo = dontes;
    dontes = { stat: !!stat, mark: !!mark, t: Math.floor(Date.now() / 1000) };
    try {
      document.cookie = SUTI + '=v1-s' + (stat ? 1 : 0) + '-m' + (mark ? 1 : 0) + '-t' + dontes.t + '; path=/; max-age=' + NAP * 86400 +
        (eles ? '; domain=medicalpiercing.hu' : '') + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* tiltott suti: csak erre az oldalra ervenyes */ }
    window.gtag('consent', 'update', jelek(dontes));
    window.dataLayer.push({ event: 'mp_suti_valtozas', mp_suti_stat: dontes.stat, mp_suti_mark: dontes.mark });
    if (elozo && elozo.mark && !dontes.mark) {
      // visszavonas: a mar betoltott pixelek ne taroljanak tovabb (a kovetkezo oldalon mar be sem toltenek)
      try { if (window.fbq) window.fbq('consent', 'revoke'); } catch (e) { /* */ }
      try { if (window.ttq && window.ttq.revokeConsent) window.ttq.revokeConsent(); } catch (e) { /* */ }
    }
    if (dontes.mark) for (var i = 0; i < marketingFigyelok.length; i++) { try { marketingFigyelok[i](); } catch (e) { /* */ } }
    try { document.dispatchEvent(new CustomEvent('mp_suti_valtozas', { detail: { stat: dontes.stat, mark: dontes.mark } })); } catch (e) { /* regi bongeszo */ }
  };
  // marketing-kod: azonnal, ha mar van hozzajarulas; kulonben a hozzajarulas pillanataban (egyszer)
  var marketingKor = function (fn) {
    var volt = false;
    var futtat = function () { if (!volt) { volt = true; fn(); } };
    if (dontes && dontes.mark) futtat(); else marketingFigyelok.push(futtat);
  };

  // ---------- a sav ----------
  var sav = null;
  var STILUS =
    '#mp-cc,#mp-cc *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}' +
    '#mp-cc{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483000;max-width:640px;margin:0 auto;background:#fff;color:#2b2b38;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.22);padding:12px 14px;font-size:13px;line-height:1.45;display:none}' +
    '#mp-cc p{margin:0 0 10px}' +
    '#mp-cc a{color:inherit;text-decoration:underline}' +
    '#mp-cc h2{font-size:15px;margin:0 0 6px;font-weight:700}' +
    '#mp-cc .mp-gombok{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '#mp-cc .mp-gomb{flex:1 1 0;min-width:120px;cursor:pointer;border-radius:999px;padding:9px 14px;font-size:14px;font-weight:700;border:2px solid #474759;background:#474759;color:#fff;white-space:nowrap}' +
    '#mp-cc .mp-link{flex:0 0 auto;cursor:pointer;border:none;background:none;color:#2b2b38;padding:8px 4px;font-size:13px;text-decoration:underline}' +
    '#mp-cc .mp-kat{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:8px 0;border-top:1px solid #eee}' +
    '#mp-cc .mp-kat small{display:block;color:#5b5b66}' +
    '#mp-cc input[type=checkbox]{width:20px;height:20px;margin-top:2px;flex:none;accent-color:#474759}' +
    '#mp-cc-beall .mp-gombok{margin-top:10px}' +
    // vekony, egysoros sav (Feri, 2026-10-11 16:14): a beallitasok nezet marad doboz
    '#mp-cc[data-nezet=fo]{left:0;right:0;bottom:0;max-width:none;border-radius:0;padding:5px 10px;font-size:12px;line-height:1.3;box-shadow:0 -1px 6px rgba(0,0,0,.15)}' +
    '#mp-cc-fo{display:flex;align-items:center;gap:8px}' +
    '#mp-cc-fo p{flex:1 1 auto;margin:0}' +
    '#mp-cc-fo .mp-gombok{flex:0 0 auto;flex-wrap:nowrap;gap:6px}' +
    '#mp-cc-fo .mp-gomb{flex:0 0 auto;min-width:0;padding:4px 10px;font-size:12px;border-width:1px}' +
    '#mp-cc-fo .mp-link{padding:4px 2px;font-size:11px}' +
    '@media (max-width:600px){#mp-cc[data-nezet=fo]{padding:4px 8px;font-size:11px}#mp-cc-fo{gap:6px}#mp-cc-fo .mp-gomb{padding:3px 8px;font-size:11px}#mp-cc-fo .mp-gombok{gap:4px}#mp-cc-fo .mp-link{font-size:10px;padding:2px 0}#mp-cc-fo p{font-size:10.5px}#mp-cc-fo .mp-gomb{padding:3px 7px}#mp-cc-beall p{margin-bottom:8px}}';
  var kategoria = function (id, cim, leiras) {
    return '<div class="mp-kat"><div><b>' + cim + '</b><small>' + leiras + '</small></div>' +
      '<input type="checkbox"' + (id ? ' id="' + id + '"' : ' checked disabled') + ' aria-label="' + cim + '"></div>';
  };
  var JELOLES =
    '<div id="mp-cc-fo">' +
      '<p>Sütiket használunk a méréshez (<a href="/adatkezeles" target="_blank" rel="noopener">részletek</a>).</p>' +
      '<div class="mp-gombok">' +
        '<button type="button" class="mp-gomb" data-mp="elutasit">Elutasítom</button>' +
        '<button type="button" class="mp-gomb" data-mp="elfogad">Elfogadom</button>' +
        '<button type="button" class="mp-link" data-mp="beall">Beállítások</button>' +
      '</div>' +
    '</div>' +
    '<div id="mp-cc-beall" style="display:none">' +
      '<h2>Süti beállítások</h2>' +
      kategoria('', 'Szükséges', 'Az oldal működéséhez kellenek (pl. ennek a döntésnek a tárolása), nem kapcsolhatók ki.') +
      kategoria('mp-cc-stat', 'Statisztika', 'Megmutatja, hogyan használják a látogatók az oldalt (Google Analytics).') +
      kategoria('mp-cc-mark', 'Marketing', 'Hirdetéseink mérése és releváns hirdetések (Google Ads, Meta, TikTok, Convertize).') +
      '<p style="margin:8px 0 0"><a href="/adatkezeles" target="_blank" rel="noopener">Adatkezelési tájékoztató</a></p>' +
      '<div class="mp-gombok">' +
        '<button type="button" class="mp-gomb" data-mp="elutasit">Elutasítom</button>' +
        '<button type="button" class="mp-gomb" data-mp="elfogad">Elfogadom</button>' +
        '<button type="button" class="mp-link" data-mp="mentes">Kiválasztottak mentése</button>' +
      '</div>' +
    '</div>';
  // mobilon a Wix gyorsmenu-savja (QUICK_ACTION_BAR) folott marad; a felso fejlec "Idopontok" gombjat nem takarja
  var helyez = function () {
    // (a gyorsmenu-sav gorgeteskor csuszik be: akkor is helyet hagyunk neki, ha eppen nem latszik)
    var vekony = sav.getAttribute('data-nezet') !== 'beall';
    var q = document.getElementById('QUICK_ACTION_BAR'), also = vekony ? 0 : 8;
    if (q && q.offsetHeight) {
      var r = q.getBoundingClientRect();
      var res = r.top < innerHeight && r.bottom <= innerHeight + 1 ? Math.max(0, innerHeight - r.bottom) : 16;
      also = q.offsetHeight + res + (vekony ? 0 : 8);
    }
    sav.style.bottom = also + 'px';
  };
  var mutat = function (nezet) {
    if (!sav) return;
    document.getElementById('mp-cc-fo').style.display = nezet === 'beall' ? 'none' : '';
    document.getElementById('mp-cc-beall').style.display = nezet === 'beall' ? '' : 'none';
    if (nezet === 'beall') {
      // elore bepipalt negyzet nem ervenyes hozzajarulas: dontes nelkul uresek
      document.getElementById('mp-cc-stat').checked = !!(dontes && dontes.stat);
      document.getElementById('mp-cc-mark').checked = !!(dontes && dontes.mark);
    }
    sav.setAttribute('data-nezet', nezet || 'fo');
    sav.style.display = 'block';
    helyez();
    setTimeout(function () { if (sav.style.display !== 'none') helyez(); }, 1200);
  };
  var elrejt = function () { if (sav) sav.style.display = 'none'; };
  var lableclink = function () {
    // "Suti beallitasok" a lablec "Adatkezelesi tajekoztato" linkje utan: itt lehet a dontest modositani / visszavonni
    if (document.getElementById('mp-cc-lablec')) return;
    var cel = null, l = document.querySelectorAll('footer a[href$="/adatkezeles"], footer a[href="adatkezeles"]');
    for (var i = 0; i < l.length; i++) cel = l[i];
    var a = document.createElement('a');
    a.id = 'mp-cc-lablec';
    a.href = '#suti-beallitasok';
    a.textContent = 'Süti beállítások';
    a.style.textDecoration = 'underline';
    a.addEventListener('click', function (e) { e.preventDefault(); mutat('beall'); });
    if (cel) { a.className = cel.className; a.style.color = 'inherit'; cel.after(document.createTextNode(' - '), a); }
  };
  var felepit = function () {
    if (sav || keretben || !document.body) return;
    var st = document.createElement('style');
    st.textContent = STILUS;
    document.head.appendChild(st);
    sav = document.createElement('div');
    sav.id = 'mp-cc';
    sav.setAttribute('role', 'dialog');
    sav.setAttribute('aria-label', 'Süti beállítások');
    sav.innerHTML = JELOLES;
    document.body.appendChild(sav);
    sav.addEventListener('click', function (e) {
      var g = e.target && e.target.closest ? e.target.closest('[data-mp]') : null;
      if (!g) return;
      var mit = g.getAttribute('data-mp');
      if (mit === 'elfogad') { rogzit(true, true); elrejt(); }
      else if (mit === 'elutasit') { rogzit(false, false); elrejt(); }
      else if (mit === 'beall') mutat('beall');
      else if (mit === 'mentes') { rogzit(document.getElementById('mp-cc-stat').checked, document.getElementById('mp-cc-mark').checked); elrejt(); }
    });
    var ujrahelyez = function () { if (sav.style.display !== 'none') helyez(); };
    addEventListener('resize', ujrahelyez);
    addEventListener('scroll', ujrahelyez, { passive: true });
    addEventListener('load', ujrahelyez);
    lableclink();
    if (location.hash === '#suti-beallitasok') mutat('beall');
    else if (!dontes) mutat('fo');
  };
  window.mpSuti = {
    engedely: function (k) { return !!(dontes && dontes[k]); },
    beallitasok: function () { if (!sav) felepit(); mutat('beall'); },
    dontott: function () { return !!dontes; }
  };
  if (!keretben) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', felepit);
    else felepit();
  }

  // ---------- merokodok: CSAK az eles domainen ----------
  if (!eles) return;

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

  // Google Ads (gtag.js): mindig betolt; a Consent Mode alapallapota (fent) mar a dataLayer-ben van
  szkript('https://www.googletagmanager.com/gtag/js?id=AW-11097894040');
  window.gtag('js', new Date());
  window.gtag('config', 'AW-11097894040');

  // Google Tag Manager
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
  szkript('https://www.googletagmanager.com/gtm.js?id=GTM-T9GR4JCK');

  // Convertize es Meta-pixel: CSAK marketing-hozzajarulassal (ha a vendeg kesobb fogad el, akkor abban a pillanatban)
  marketingKor(function () {
    // Convertize
    szkript('https://pixel.convertize.io/11722.js');

    // Meta-pixel (a Meta szabvanyos alapkodja), a koszonooldalakon nem
    if (!KOSZONO) {
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
  });

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
  // kapja meg), ha volt ilyen. A TikTok-pixelt a GTM tolti (ad_storage-hozzajarulassal):
  // marketing-hozzajarulas nelkul, vagy ha nincs betoltve, nem kuldunk semmit. Kattintasonkent pontosan egy
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
      // TikTok: csak marketing-hozzajarulassal (a GA4-jel fent hozzajarulas nelkul is megy, a Consent Mode szerint suti nelkul)
      if (!(dontes && dontes.mark) || !window.ttq || typeof window.ttq.track !== 'function') return;
      window.ttq.track('InitiateCheckout', { content_name: 'foglalas_inditasa', content_category: tipus });
    };
    document.addEventListener('click', foglalasInditasa, true);
    document.addEventListener('auxclick', foglalasInditasa, true);
  }
  }
})();
