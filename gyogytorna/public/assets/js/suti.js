// gyogytornaszom.hu - SAJAT suti-sav (hozzajarulas-kezeles). CookieYes nincs es nem is lesz (Feri, 2026-10-13). Az MP #280/#296 sav gyogytornahoz igazitott valtozata.
// Leiras: docs/SUTISAV.md (a consent-allapot semaja, a dataLayer-esemeny, a tarolas, a visszavonas).
//
// Ez a szkript CSAK a hozzajarulast kezeli: merokodot NEM tolt be (a GTM-WCPQM7N-et a WordPress-oldal es a meresi felelos kezeli, a Consent Initialization
// alapertelmezes - analytics_storage, ad_storage, ad_user_data, ad_personalization = denied - a GTM-ben van). Itt Meta / TikTok nincs, csak Google.
//
// Allapot (a "gy_suti" elso feles suti, 365 nap): "v1-s<0|1>-m<0|1>-t<unix mp>"; s = statisztika (analytics_storage), m = marketing (ad_storage + ad_user_data).
// ad_personalization mindig denied (nincs remarketing). Hianyzo vagy ervenytelen allapot = NINCS hozzajarulas. A szerver (lib/hozzajarulas.js) ugyanezt a sutit olvassa.
// dataLayer: oldalbetoltesenkent { event:'gy_suti_allapot', gy_suti_dontott, gy_suti_stat, gy_suti_mark, gy_suti_verzio }, valtozaskor { event:'gy_suti_valtozas', ... };
// dontes eseten gtag('consent','update', ...). Document esemeny: "gy_suti_valtozas" (detail: { stat, mark }). API: window.gySuti.{engedely(k), beallitasok(), dontott()}.
// A sav keretben (iframe) soha nem jelenik meg. Visszavonas / modositas: lablec "Suti beallitasok" link, #suti-beallitasok, window.gySuti.beallitasok().
// Nevtelen statisztika (suti, IP, URL, azonosito nelkul): POST /api/gy-suti-stat - csak napi darabszam.
// SAV_KI (Feri dontese, 2026-10-14: "sutisavot ne rakjunk ki egyaltalan"; ugyanaz a megoldas, mint a Medical Piercingen): se nagy doboz, se vekony sav. Dontes nelkul az alapertelmezes
// "megadott" (statisztika + marketing; a szerver is ezt latja, GY_SAV_KI), a lableci "Suti beallitasok" link megmarad, a latogato kifejezett dontese (elutasitas, visszavonas) elsobbseget el.
// Biztonsagi fek: ha Google-iranyelv-figyelmeztetes erkezik, SAV_KI = false (a sav visszajon). Probahoz: window.GY_SAV_KI = false (a teszt allitja be).
(function () {
  'use strict';
  if (window.gySuti) return;
  var keretben = window.top !== window;
  var script = document.currentScript;
  var forras = script && script.src ? new URL(script.src, location.href) : new URL(location.href);
  var BASE = forras.pathname.replace(/\/assets\/js\/suti\.js$/, '').replace(/\/$/, ''); // eles: /gy-foglalas, elonezet: ''
  var API = forras.origin + BASE;
  var ELES = location.hostname === 'www.gyogytornaszom.hu' || location.hostname === 'gyogytornaszom.hu';
  var SUTI = 'gy_suti', NAP = 365, VERZIO = 'v1', SAV_VERZIO = 'v1';
  var SAV_KI = window.GY_SAV_KI === undefined ? true : !!window.GY_SAV_KI;
  var ADATVEDELEM = ELES ? '/adatvedelmi-nyilatkozat/' : 'https://www.gyogytornaszom.hu/adatvedelmi-nyilatkozat/';

  var olvas = function () {
    var m = /(?:^|;\s*)gy_suti=v1-s([01])-m([01])-t(\d{9,11})(?:;|$)/.exec(document.cookie);
    if (!m) return null;
    var t = +m[3], most = Date.now() / 1000;
    if (t > most + 86400 || t < most - 400 * 86400) return null; // ervenytelen / lejart: nincs hozzajarulas, a sav ujra kerdez
    return { stat: m[1] === '1', mark: m[2] === '1', t: t };
  };
  var dontes = olvas();

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  var jelek = function (d) {
    return { ad_storage: d && d.mark ? 'granted' : 'denied', ad_user_data: d && d.mark ? 'granted' : 'denied', ad_personalization: 'denied', analytics_storage: d && d.stat ? 'granted' : 'denied' };
  };
  var allapotEsemeny = function (nev) {
    var alap = SAV_KI && !dontes; // SAV_KI: dontes nelkul az alapertelmezes "megadott"
    window.dataLayer.push({ event: nev, gy_suti_dontott: !!dontes, gy_suti_stat: alap || !!(dontes && dontes.stat), gy_suti_mark: alap || !!(dontes && dontes.mark), gy_suti_verzio: VERZIO, gy_suti_sav_ki: SAV_KI, gy_suti_alap: alap });
  };
  // mentett dontes: a Google-jelek frissitese (a default-ot a GTM Consent Initialization adja, denied); nincs dontes: semmi nem valtozik (denied marad)
  if (dontes) window.gtag('consent', 'update', jelek(dontes));
  allapotEsemeny('gy_suti_allapot');

  var rogzit = function (stat, mark) {
    dontes = { stat: !!stat, mark: !!mark, t: Math.floor(Date.now() / 1000) };
    try {
      document.cookie = SUTI + '=v1-s' + (stat ? 1 : 0) + '-m' + (mark ? 1 : 0) + '-t' + dontes.t + '; path=/; max-age=' + NAP * 86400 +
        (ELES ? '; domain=gyogytornaszom.hu' : '') + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* tiltott suti: csak erre az oldalra ervenyes */ }
    window.gtag('consent', 'update', jelek(dontes));
    allapotEsemeny('gy_suti_valtozas');
    try { document.dispatchEvent(new CustomEvent('gy_suti_valtozas', { detail: { stat: dontes.stat, mark: dontes.mark } })); } catch (e) { /* regi bongeszo */ }
  };

  var sav = null;
  var STILUS =
    '#gy-cc,#gy-cc *{box-sizing:border-box;font-family:Poppins,"Segoe UI",Roboto,Arial,sans-serif}' +
    '#gy-cc{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147482000;max-width:640px;margin:0 auto;background:#fff;color:#1b2733;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.22);padding:12px 14px;font-size:13px;line-height:1.45;display:none}' +
    '#gy-cc p{margin:0 0 10px}#gy-cc a{color:inherit;text-decoration:underline}#gy-cc h2{font-size:15px;margin:0 0 6px;font-weight:700;color:#0c4c8a}' +
    '#gy-cc .gy-gombok{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    // az Elfogadom es az Elutasitom ugyanolyan meretu, szinu es sulyu (nincs "trukkos" sav)
    '#gy-cc .gy-gomb{flex:1 1 0;min-width:120px;cursor:pointer;border-radius:999px;padding:9px 14px;font-size:14px;font-weight:700;border:2px solid #0c4c8a;background:#0c4c8a;color:#fff;white-space:nowrap}' +
    '#gy-cc .gy-gomb.gy-halvany{background:#5d89b5;border-color:#5d89b5}' +
    '#gy-cc .gy-link{flex:0 0 auto;cursor:pointer;border:none;background:none;color:#1b2733;padding:8px 4px;font-size:13px;text-decoration:underline}' +
    '#gy-cc .gy-kat{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:8px 0;border-top:1px solid #e3ebf2}#gy-cc .gy-kat small{display:block;color:#55687a}' +
    '#gy-cc input[type=checkbox]{width:20px;height:20px;margin-top:2px;flex:none;accent-color:#0c4c8a}#gy-cc-beall .gy-gombok{margin-top:10px}' +
    '#gy-cc[data-nezet=fo]{left:0;right:0;bottom:0;max-width:none;border-radius:0;padding:5px 10px;font-size:12px;line-height:1.3;box-shadow:0 -1px 6px rgba(0,0,0,.15)}' +
    '#gy-cc-fo{display:flex;align-items:center;gap:8px}#gy-cc-fo p{flex:1 1 auto;margin:0}#gy-cc-fo .gy-gombok{flex:0 0 auto;flex-wrap:nowrap;gap:6px}' +
    '#gy-cc-fo .gy-gomb{flex:0 0 auto;min-width:0;padding:4px 10px;font-size:12px;border-width:1px}#gy-cc-fo .gy-link{padding:4px 2px;font-size:11px}' +
    '#gy-cc .gy-nagy{display:none}#gy-cc[data-nezet=nagy] .gy-nagy{display:block}' +
    '#gy-cc[data-nezet=nagy]{max-width:560px;padding:16px 18px;font-size:14px}#gy-cc[data-nezet=nagy] #gy-cc-fo{display:block}#gy-cc[data-nezet=nagy] #gy-cc-fo p{margin:0 0 12px}' +
    '#gy-cc[data-nezet=nagy] #gy-cc-fo .gy-gombok{flex-wrap:wrap;gap:8px}#gy-cc[data-nezet=nagy] #gy-cc-fo .gy-gomb{flex:1 1 0;min-width:120px;padding:10px 14px;font-size:15px;border-width:2px}' +
    '#gy-cc[data-nezet=nagy] #gy-cc-fo .gy-link{flex:1 0 100%;text-align:center;padding:2px 0;font-size:13px}' +
    '@media (max-width:600px){#gy-cc[data-nezet=nagy] #gy-cc-fo .gy-gombok{flex-direction:column;align-items:stretch}#gy-cc[data-nezet=nagy] #gy-cc-fo .gy-gomb{flex:0 0 auto;width:100%}#gy-cc[data-nezet=fo]{padding:4px 8px;font-size:11px}#gy-cc-fo{gap:6px}#gy-cc-fo .gy-gomb{padding:3px 8px;font-size:11px}#gy-cc-fo .gy-gombok{gap:4px}#gy-cc-fo .gy-link{font-size:10px;padding:2px 0}#gy-cc-fo p{font-size:10.5px}#gy-cc[data-nezet=nagy]{padding:14px;font-size:13.5px}}';
  var kategoria = function (id, cim, leiras) {
    return '<div class="gy-kat"><div><b>' + cim + '</b><small>' + leiras + '</small></div><input type="checkbox"' + (id ? ' id="' + id + '"' : ' checked disabled') + ' aria-label="' + cim + '"></div>';
  };
  var JELOLES =
    '<div id="gy-cc-fo">' +
      '<h2 class="gy-nagy">Segítesz nekünk egy kattintással?</h2>' +
      '<p>A sütikkel azt mérjük, melyik hirdetésünkből érkeznek a foglalások, így kevesebb felesleges hirdetést mutatunk. (<a href="' + ADATVEDELEM + '" target="_blank" rel="noopener">részletek</a>).</p>' +
      // Elfogadom elol (asztalon balra, mobilon felul), az Elutasitom mogotte: ugyanakkora, ugyanolyan betu, csak kicsit halvanyabb
      '<div class="gy-gombok"><button type="button" class="gy-gomb" data-gy="elfogad">Elfogadom</button><button type="button" class="gy-gomb gy-halvany" data-gy="elutasit">Elutasítom</button><button type="button" class="gy-link" data-gy="beall">Beállítások</button></div>' +
    '</div>' +
    '<div id="gy-cc-beall" style="display:none"><h2>Süti beállítások</h2>' +
      kategoria('', 'Szükséges', 'Az oldal és a foglalás működéséhez kellenek (pl. ennek a döntésnek a tárolása), nem kapcsolhatók ki.') +
      kategoria('gy-cc-stat', 'Statisztika', 'Megmutatja, hogyan használják a látogatók az oldalt (Google Analytics).') +
      kategoria('gy-cc-mark', 'Marketing', 'Hirdetéseink mérése: melyik Google-hirdetésből érkezett a foglalás (Google Ads). Személyre szabott hirdetést nem használunk.') +
      '<p style="margin:8px 0 0"><a href="' + ADATVEDELEM + '" target="_blank" rel="noopener">Adatkezelési tájékoztató</a></p>' +
      '<div class="gy-gombok"><button type="button" class="gy-gomb" data-gy="elfogad">Elfogadom</button><button type="button" class="gy-gomb gy-halvany" data-gy="elutasit">Elutasítom</button><button type="button" class="gy-link" data-gy="mentes">Kiválasztottak mentése</button></div>' +
    '</div>';
  var mutat = function (nezet) {
    if (!sav) return;
    document.getElementById('gy-cc-fo').style.display = nezet === 'beall' ? 'none' : '';
    document.getElementById('gy-cc-beall').style.display = nezet === 'beall' ? '' : 'none';
    if (nezet === 'beall') { // elore bepipalt negyzet nem ervenyes hozzajarulas: dontes nelkul uresek
      document.getElementById('gy-cc-stat').checked = !!(dontes && dontes.stat);
      document.getElementById('gy-cc-mark').checked = !!(dontes && dontes.mark);
    }
    sav.setAttribute('data-nezet', nezet || 'fo');
    sav.style.display = 'block';
  };
  var statKuld = function (e, n) {
    try {
      var adat = JSON.stringify({ e: e, n: n || (sav && sav.getAttribute('data-nezet')) || '', m: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 1 : 0, v: SAV_VERZIO });
      if (navigator.sendBeacon) navigator.sendBeacon(API + '/api/gy-suti-stat', new Blob([adat], { type: 'text/plain' }));
      else fetch(API + '/api/gy-suti-stat', { method: 'POST', body: adat, keepalive: true });
    } catch (x) { /* a statisztika soha nem zavarhatja a savot */ }
  };
  var elrejt = function () { if (sav) sav.style.display = 'none'; };
  var lablec = function () {
    if (document.getElementById('gy-cc-lablec')) return;
    // az eles lablec: <ul id="nav2"> ... <li><a rel="privacy-policy" href=".../adatvedelmi-nyilatkozat/">; tartalek: barmelyik adatvedelmi link
    var cel = document.querySelector('a[rel~="privacy-policy"]');
    if (!cel) { var l = document.querySelectorAll('footer a[href*="adatvedelmi-nyilatkozat"]'); for (var i = 0; i < l.length; i++) cel = l[i]; }
    if (!cel) return;
    var a = document.createElement('a');
    a.id = 'gy-cc-lablec'; a.href = '#suti-beallitasok'; a.textContent = 'Süti beállítások'; a.className = cel.className; a.style.color = 'inherit';
    a.addEventListener('click', function (e) { e.preventDefault(); mutat('beall'); });
    var li = cel.parentElement;
    if (li && li.tagName === 'LI' && li.parentElement) { var uj = document.createElement('li'); uj.className = li.className.replace(/\bmenu-item-privacy-policy\b|\bmenu-item-\d+\b/g, '').trim(); uj.appendChild(a); li.after(uj); }
    else { a.style.textDecoration = 'underline'; cel.after(document.createTextNode(' - '), a); }
  };
  var felepit = function () {
    if (sav || keretben || !document.body) return;
    var st = document.createElement('style'); st.textContent = STILUS; document.head.appendChild(st);
    sav = document.createElement('div');
    sav.id = 'gy-cc'; sav.setAttribute('role', 'dialog'); sav.setAttribute('aria-label', 'Süti beállítások'); sav.innerHTML = JELOLES;
    document.body.appendChild(sav);
    sav.addEventListener('click', function (e) {
      var g = e.target && e.target.closest ? e.target.closest('[data-gy]') : null;
      if (!g) return;
      var mit = g.getAttribute('data-gy');
      if (mit === 'elfogad') { statKuld('elfogad'); rogzit(true, true); elrejt(); }
      else if (mit === 'elutasit') { statKuld('elutasit'); rogzit(false, false); elrejt(); }
      else if (mit === 'beall') { statKuld('beall'); mutat('beall'); }
      else if (mit === 'mentes') {
        var ms = document.getElementById('gy-cc-stat').checked, mm = document.getElementById('gy-cc-mark').checked;
        statKuld(mm ? 'elfogad' : (ms ? 'reszleges' : 'elutasit')); rogzit(ms, mm); elrejt();
      }
    });
    lablec();
    if (location.hash === '#suti-beallitasok') mutat('beall');
    else if (!dontes && !SAV_KI) { // munkamenetenkent az elso oldalon nagyobb doboz, utana vekony sav; ket egyforma suly gomb
      var nagy = true;
      try { nagy = sessionStorage.getItem('gy_cc_nagy') !== '1'; sessionStorage.setItem('gy_cc_nagy', '1'); } catch (e) { /* */ }
      mutat(nagy ? 'nagy' : 'fo');
      statKuld('megjelent', nagy ? 'nagy' : 'fo');
    }
  };
  window.gySuti = {
    engedely: function (k) { return dontes ? !!dontes[k] : SAV_KI; },
    beallitasok: function () { if (!sav) felepit(); mutat('beall'); },
    dontott: function () { return !!dontes; }
  };
  if (!keretben) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', felepit); else felepit(); }
})();
