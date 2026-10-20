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

  // ---------- koszonooldali adattisztitas (#257) ----------
  // A Salonic a koszonooldalra (/foglalas-ok*, /fulbevalo-ok*) a foglalas adataival iranyit (service, category, location,
  // employee, bookingUrl ...), es mar az UTVONAL (pl. /foglalas-ok-klimax) is utalhat egeszsegugyi jellegu szolgaltatasra.
  // Ez a szkript a <head>-ben SZINKRON fut, a gtag.js / GTM / pixelek betoltese ELOTT:
  //  1) a sajat merehez szukseges MINIMALIS adat (foglalasi kulcs, ar, uj vendeg, booking_id, Google-kattintasazonosito)
  //     egy fagyasztott, nem felsorolhato objektumba kerul (window.mpKoszonoAdat); szolgaltatasnev, kategoria, helyszin,
  //     munkatars, vendegazonosito NEM;
  //  2) a cim semleges lesz: /foglalas-ok (vagy /fulbevalo-ok), parameterekbol csak a GTM-triggerekhez kello `price` es
  //     `first_booking`, valamint a Google kattintas-azonositok (gclid/gbraid/wbraid) maradnak, plusz a `mert=1` jel (ismetelt meres ellen) (a 3 Ads-konverzio triggere: Page Path tartalmazza "/foglalas-ok" + first_booking + price);
  //  3) a lap cime semleges (a build is atirja: tools/build.mjs).
  // Tarolas (suti, localStorage, sessionStorage) nincs.
  var KOSZONO_UT = /^\/(foglalas-ok|fulbevalo-ok)/i.test(location.pathname);
  var EREDETI = location.href;
  var eredetiQ = function () { try { return new URL(EREDETI).searchParams; } catch (e) { return new URLSearchParams(location.search); } };
  var MERES_P = ['bookingUrl', 'price', 'first_booking', 'booking_id', 'placeId', 'employeeId', 'startDate', 'serviceId'];
  var KATT = ['gclid', 'gbraid', 'wbraid'];
  var koszonoMinimalis = null; // a motor-atadas cime: eredeti utvonal + csak a meres parameterei
  if (KOSZONO_UT) {
    try {
      var eq = eredetiQ(), p0 = {}, k0 = {}, mq = new URLSearchParams();
      MERES_P.forEach(function (k) { if (eq.get(k)) { p0[k] = eq.get(k); mq.set(k, eq.get(k)); } });
      KATT.forEach(function (k) { if (eq.get(k)) { k0[k] = eq.get(k); mq.set(k, eq.get(k)); } });
      koszonoMinimalis = location.origin + location.pathname + (mq.toString() ? '?' + mq.toString() : '');
      var semlegesUt = /^\/fulbevalo-ok/i.test(location.pathname) ? '/fulbevalo-ok' : '/foglalas-ok';
      var adat = Object.freeze({ ut: semlegesUt, p: Object.freeze(p0), katt: Object.freeze(k0) }); // az eredeti (tipusra utalo) utvonal nem kerul bele
      try { Object.defineProperty(window, 'mpKoszonoAdat', { value: adat, writable: false, enumerable: false, configurable: false }); } catch (e) { /* mar letezik */ }
      var tq = new URLSearchParams();
      ['price', 'first_booking'].forEach(function (k) { if (eq.has(k)) tq.set(k, eq.get(k)); });
      // A Google kattintas-azonositok (gclid/gbraid/wbraid) a cimben maradnak: nem egeszsegugyi adat, es a fo Google-konverzio
      // (GTM 107) mobilon a suti nelkul csak a cimbol tudja a kattintashoz kotni (2026-10-18, a mobil konverzio felezodese utan).
      KATT.forEach(function (k) { if (eq.get(k)) tq.set(k, eq.get(k)); });
      // `mert=1`: a tisztitott cim jele. F5, vissza/elore, a tisztitott cim uj lapon: a foglalasi kulcs mar nincs a cimben,
      // ezert a marMert() errol a jelrol tudja, hogy ezt a foglalast mar kezeltuk (nincs uj tarolas, semleges ertek).
      tq.set('mert', '1');
      history.replaceState(history.state, '', semlegesUt + (tq.toString() ? '?' + tq.toString() : '') + location.hash);
      document.title = 'Sikeres foglalás | Medical Piercing';
    } catch (e) { /* regi bongeszo: marad a cim */ }
  }

  // ---------- hozzajarulas ----------
  var SUTI = 'mp_suti', NAP = 365;
  var olvasDontes = function () {
    var m = /(?:^|;\s*)mp_suti=v1-s([01])-m([01])-t(\d+)(?:;|$)/.exec(document.cookie);
    return m ? { stat: m[1] === '1', mark: m[2] === '1', t: +m[3] } : null;
  };
  var dontes = olvasDontes();
  // SAV_KI (Feri dontese, 2026-10-13 22:20): a sav NEM jelenik meg, vissza a 10-10 elotti allapotba (minden meres fut).
  // Kifejezett vendegdontes (lablec "Suti beallitasok") tovabbra is ervenyes es elsobbsegu. A sav nelkuli alapallapot jele
  // a "t0" suti (nem valodi dontes): ha a savot visszakapcsoljuk (SAV_KI = false), a t0 dontes nelkulinek szamit, es a sav ujra megjelenik.
  // Vissza: SAV_KI = false (Google-figyelmeztetes eseten 7 napon belul).
  // SAV-TESZT (Feri dontese, 2026-10-14 07:02): a sav CSAK konverzio szempontjabol semleges oldalakon jelenik meg
  // (kontroll-foglalas, utogondozasi cikk), hogy az elfogadasi aranyt merjuk (cel: >= 80%). Itt a t0 alapallapot
  // nem dontes, igy a sav megjelenik; a vendeg valasztasa (elfogad / elutasit) az egesz oldalon ervenyes.
  // Feri kerese (2026-10-14, kb. 07:30): az URLAPROL a sav lekerul (a /kontroll oldal az urlapot nyitja meg, a sav rafedett): a kontroll-oldal kikerult a
  // tesztoldalak kozul, es amig a foglalo ablak nyitva van, a sav rejtve van (akarmelyik oldalon; bezaras utan, ha nincs dontes, ujra latszik).
  // Feri dontese (2026-10-18 08:08): NINCS suti-sav sehol (a sav-teszt oldal is megszunik), es minden platformnak
  // elfogadott hozzajarulassal kuldunk mindent, ahogy a sav elott. A korabbi (sav-teszt idejen tarolt) elutasitas sem ervenyes.
  var TESZT_OLDAL = false;
  var SAV_KI = true;
  if (dontes && (!dontes.stat || !dontes.mark)) dontes = null;
  if (!dontes && SAV_KI) {
    dontes = { stat: true, mark: true, t: 0 };
    try {
      document.cookie = SUTI + '=v1-s1-m1-t0; path=/; max-age=' + NAP * 86400 +
        (ELES_DOMAINEK.indexOf(location.hostname) >= 0 ? '; domain=medicalpiercing.hu' : '') + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
    } catch (e) { /* tiltott suti */ }
  }

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
      // Remarketing / szemelyre szabott hirdetes nincs (Feri, 2026-10-12): a Google-jelek mindig npa=1-gyel mennek
      ad_personalization: 'denied',
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

  var TIKTOK_KODOS_SCHEDULE = true; // ATALLASKOR true (egyszerre a TikTok URL-szabaly kikapcsolasaval + mp_beallitas.tiktok_schedule=be); Feri 2026-10-19 19:50 "mehet es A"
  var tiktokFoglalas = null; // a koszonooldali TikTok SubmitForm adatai (lent: tiktokSubmitForm)
  // Igazolhato foglalas (Google Ads "Időpontfoglalás - igazolt", orderId = foglalasi kulcs): a kulcs ugyanaz, mint a szerveren
  // (lib/meres/meres.js foglalasKulcs: placeId|employeeId|startUnix), igy a szerver a Salonic-igazolas alapjan
  // RETRACT/RESTATE kiigazitast kuldhet ra. Csak szamok mennek ki (nincs szolgaltatasnev, nincs szemelyes adat).
  // Csak az elso, meg tisztitatlan betolteskor: F5 / vissza / uj lap a tisztitott cimen mar nem hordozza a kulcsot.
  // A divat fulpiercing (/fulbevalo-ok) NEM: alacsony erteku, Feri dontese (2026-10-13) - egyetlen platform se optimalizaljon ra.
  if (KOSZONO_UT && window.mpKoszonoAdat && !/^\/fulbevalo-ok/i.test(location.pathname) && !/fulbevalo-ok/i.test(String(window.mpKoszonoAdat.ut || ''))) {
    try {
      var kp = window.mpKoszonoAdat.p || {}, bq = new URLSearchParams();
      try { if (kp.bookingUrl) bq = new URL(kp.bookingUrl, 'https://medicalpiercing.salonic.hu/').searchParams; } catch (e) { /* */ }
      var kv = function (k) { var v = String(bq.get(k) || kp[k] || '').trim(); return /^\d+$/.test(v) ? v : ''; };
      var hely = kv('placeId'), mun = kv('employeeId'), kezd = kv('startDate');
      if (hely && mun && kezd) {
        var ar = Number(String(kp.price || '').replace(/[^\d.]/g, ''));
        window.dataLayer.push({ event: 'mp_foglalas_igazolhato', mp_foglalas_kulcs: hely + '|' + mun + '|' + kezd,
          mp_foglalas_ertek: Number.isFinite(ar) && ar > 0 ? Math.round(ar) : 1 });
        tiktokFoglalas = { id: 'Foglalas:' + hely + '|' + mun + '|' + kezd, ertek: Number.isFinite(ar) && ar > 0 ? Math.round(ar) : null };
      }
    } catch (e) { /* nincs kulcs: nincs esemeny */ }
  }

  var marketingFigyelok = [];
  // TikTok SubmitForm a koszonooldalrol (csak gyogypiercing /foglalas-ok, marketing-hozzajarulassal), ugyanazzal az
  // event_id-val, mint a szerveres Events API (lib/meres/tiktok.js: 'Foglalas:<kulcs>') -> a TikTok deduplikal.
  // (A Salonic-oldali GTM 'purchase' -> SubmitForm cimke ki van kapcsolva.)
  var tiktokSubmitForm = function () {
    if (!tiktokFoglalas || !eles) return;
    var probak = 0;
    var kuld = function () {
      if (window.ttq && typeof window.ttq.track === 'function' && window.ttq._i) {
        var tul = tiktokFoglalas.ertek ? { value: tiktokFoglalas.ertek, currency: 'HUF' } : {};
        try { window.ttq.track('SubmitForm', tul, { event_id: tiktokFoglalas.id }); } catch (e) { /* */ }
        // Elo konverzio (Feri 2026-10-19): kodos Schedule azonos event_id-val (a szerver is kuldi) -> dedup; az URL-szabaly ki
        if (TIKTOK_KODOS_SCHEDULE) { try { window.ttq.track('Schedule', tul, { event_id: tiktokFoglalas.id }); } catch (e) { /* */ } }
        tiktokFoglalas = null;
      } else if (++probak < 40) setTimeout(kuld, 250);
    };
    kuld();
  };
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
    'html[data-mp-motor-nyitva] #mp-cc{display:none!important}' +
    '#mp-cc{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483600;max-width:640px;margin:0 auto;background:#fff;color:#2b2b38;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.22);padding:12px 14px;font-size:13px;line-height:1.45;display:none}' +
    '#mp-cc p{margin:0 0 10px}' +
    '#mp-cc a{color:inherit;text-decoration:underline}' +
    '#mp-cc h2{font-size:15px;margin:0 0 6px;font-weight:700}' +
    '#mp-cc .mp-gombok{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '#mp-cc .mp-gomb{flex:1 1 0;min-width:120px;cursor:pointer;border-radius:999px;padding:9px 14px;font-size:14px;font-weight:700;border:2px solid #474759;background:#474759;color:#fff;white-space:nowrap}' +
    '#mp-cc .mp-gomb[data-mp=elutasit]{background:#6c6c7e;border-color:#6c6c7e}' +
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
    // elso megjelenes egy munkamenetben: nagyobb doboz (Feri, 2026-10-13: a vekony savra a foglalok ~2/3-a nem dontott);
    // a ket gomb egyforma sulyu marad (nincs "trukkos" sav), utana a tobbi oldalon ujra a vekony sav
    '#mp-cc .mp-nagy{display:none}' +
    '#mp-cc[data-nezet=nagy] .mp-rovid{display:none}' +
    '#mp-cc[data-nezet=nagy] .mp-nagy{display:block}' +
    '#mp-cc[data-nezet=nagy]{max-width:560px;padding:16px 18px;font-size:14px}' +
    '#mp-cc[data-nezet=nagy] #mp-cc-fo{display:block}' +
    '#mp-cc[data-nezet=nagy] #mp-cc-fo p{margin:0 0 12px}' +
    '#mp-cc[data-nezet=nagy] #mp-cc-fo .mp-gombok{flex-wrap:wrap;gap:8px}' +
    '#mp-cc[data-nezet=nagy] #mp-cc-fo .mp-gomb{flex:1 1 0;min-width:120px;padding:10px 14px;font-size:15px;border-width:2px}' +
    '#mp-cc[data-nezet=nagy] #mp-cc-fo .mp-link{flex:1 0 100%;text-align:center;padding:2px 0;font-size:13px}' +
        '@media (max-width:600px){#mp-cc[data-nezet=fo]{padding:4px 8px;font-size:11px}#mp-cc-fo{gap:6px}#mp-cc-fo .mp-gomb{padding:3px 8px;font-size:11px}#mp-cc-fo .mp-gombok{gap:4px}#mp-cc-fo .mp-link{font-size:10px;padding:2px 0}#mp-cc-fo p{font-size:10.5px}#mp-cc-fo .mp-gomb{padding:3px 7px}#mp-cc-beall p{margin-bottom:8px}}' +
    '@media (max-width:600px){#mp-cc[data-nezet=nagy]{padding:14px 14px;font-size:13.5px}#mp-cc[data-nezet=nagy] #mp-cc-fo p{font-size:13.5px}#mp-cc[data-nezet=nagy] #mp-cc-fo .mp-gomb{padding:10px 12px;font-size:15px}#mp-cc[data-nezet=nagy] #mp-cc-fo .mp-link{font-size:13px}';
  var kategoria = function (id, cim, leiras) {
    return '<div class="mp-kat"><div><b>' + cim + '</b><small>' + leiras + '</small></div>' +
      '<input type="checkbox"' + (id ? ' id="' + id + '"' : ' checked disabled') + ' aria-label="' + cim + '"></div>';
  };
  var JELOLES =
    '<div id="mp-cc-fo">' +
      '<h2 class="mp-nagy">Segítesz nekünk egy kattintással?</h2>' +
      '<p><span class="mp-nagy">A sütikkel azt mérjük, melyik hirdetésünkből érkeznek a foglalások, így kevesebb felesleges hirdetést mutatunk. Te döntöd el, engedélyezed-e; bármikor módosíthatod a lábléc „Süti beállítások” linkjén. </span>' +
        '<span class="mp-rovid">Sütikkel mérjük, melyik hirdetésből jönnek a foglalások </span>(<a href="/adatkezeles" target="_blank" rel="noopener">részletek</a>).</p>' +
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
  // A sav MINDIG az also szelen all (korabban a Wix gyorsmenu-gombja fole emelve, mobilon a tartalom kozepen lebegett, mikozben a
  // gomb gorgetesig nem is latszik). A kerek gyorsmenu-gomb (QUICK_ACTION_BAR, jobbra lent) csuszik a sav FOLE, amig a vekony sav
  // latszik; a sav elrejtesekor / a beallitas-nezetben visszaall. A felso fejlec "Idopontok" gombjat a sav nem takarja.
  var helyez = function () {
    var vekony = sav.getAttribute('data-nezet') === 'fo';
    sav.style.bottom = vekony ? '0px' : '8px';
    var q = document.getElementById('QUICK_ACTION_BAR');
    if (!q) return;
    if (vekony && sav.style.display !== 'none') {
      // az eredeti (Wix) also tavolsag, a mi felulirasunk elott olvasva
      if (q.getAttribute('data-mp-bottom') === null) q.setAttribute('data-mp-bottom', String(parseFloat(getComputedStyle(q).bottom) || 0));
      q.style.setProperty('bottom', (parseFloat(q.getAttribute('data-mp-bottom')) + sav.offsetHeight) + 'px', 'important');
    } else q.style.removeProperty('bottom');
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
  // nevtelen sutisav-statisztika (functions/api/mp-suti-stat.js): suti, azonosito, URL nelkul, csak napi darabszam
  var SAV_VERZIO = 'v4'; // v4 = teszt a semleges oldalakon (2026-10-14-tol)
  var statKuld = function (e, n) {
    try {
      var adat = JSON.stringify({ e: e, n: n || (sav && sav.getAttribute('data-nezet')) || '', m: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 1 : 0, v: SAV_VERZIO });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/mp-suti-stat', new Blob([adat], { type: 'text/plain' }));
      else fetch('/api/mp-suti-stat', { method: 'POST', body: adat, keepalive: true });
    } catch (x) { /* a statisztika soha nem zavarhatja a savot */ }
  };
  var elrejt = function () {
    if (sav) sav.style.display = 'none';
    var q = document.getElementById('QUICK_ACTION_BAR');
    if (q) q.style.removeProperty('bottom'); // a gyorsmenu-gomb visszaall az eredeti helyere
  };
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
    if (sav || keretben || !document.body || SAV_KI) return; // nincs sav, nincs lablec-link (Feri, 2026-10-18)
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
      if (mit === 'elfogad') { statKuld('elfogad'); rogzit(true, true); elrejt(); }
      else if (mit === 'elutasit') { statKuld('elutasit'); rogzit(false, false); elrejt(); }
      else if (mit === 'beall') { statKuld('beall'); mutat('beall'); }
      else if (mit === 'mentes') {
        var ms = document.getElementById('mp-cc-stat').checked, mm = document.getElementById('mp-cc-mark').checked;
        statKuld(mm ? 'elfogad' : (ms ? 'reszleges' : 'elutasit')); rogzit(ms, mm); elrejt();
      }
    });
    var ujrahelyez = function () { if (sav.style.display !== 'none') helyez(); };
    addEventListener('resize', ujrahelyez);
    addEventListener('scroll', ujrahelyez, { passive: true });
    addEventListener('load', ujrahelyez);
    lableclink();
    if (location.hash === '#suti-beallitasok') mutat('beall');
    else if (!dontes) {
      // munkamenetenkent az elso oldalon nagyobb doboz, utana vekony sav (tiltott tarolonal mindig a nagyobb)
      var nagy = true;
      try { nagy = sessionStorage.getItem('mp_cc_nagy') !== '1'; sessionStorage.setItem('mp_cc_nagy', '1'); } catch (e) { /* */ }
      mutat(nagy ? 'nagy' : 'fo');
      statKuld('megjelent', nagy ? 'nagy' : 'fo');
    }
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
    // a motornak (SAJAT tartomany, celzott origin - nem '*'): az eredeti utvonal es CSAK a meres parameterei (szolgaltatasnev,
    // helyszin, munkatars nelkul); a motor ezzel nyitja meg a koszonooldalt a fo ablakban
    try { window.parent.postMessage({ tipus: 'mp-foglalas-ok', url: koszonoMinimalis || location.href }, location.origin); } catch (e) { /* nincs szulo */ }
    setTimeout(function () { if (!atvette && !marMert()) meres(); }, 1500);
    return;
  }
  if (/^\/(foglalas-ok|fulbevalo-ok)/i.test(location.pathname) && marMert()) return;
  meres();

  // Ugyanannak a foglalasnak a koszonooldala egy bongeszoben csak EGYSZER mer: frissiteskor, visszalepeskor, ujranyitaskor
  // nem (QA-4). Kulcs: a motor booking_id-je, ennek hianyaban a Salonic bookingUrl-je; 30 napig emlekszik (localStorage,
  // szemelyes adat nincs benne). Az ismetlest a <html data-mp-mar-mert="1"> jeloli (a teszteknek).
  function marMert() {
    var q = eredetiQ();
    if (q.get('mert') === '1') { document.documentElement.setAttribute('data-mp-mar-mert', '1'); return true; } // mar tisztitott cim
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

  // TikTok SubmitForm a koszonooldalon: csak marketing-hozzajarulassal (a TikTok-pixelt a GTM tolti)
  marketingKor(tiktokSubmitForm);

  // Sajat, veletlen latogato-azonosito (external_id; Feri 2026-10-19: max. adat, egeszsegugyi adat es PII nelkul): nem e-mailbol /
  // telefonbol kepzett UUID, elso feles suti (mp_vid, 1 ev). A Meta-pixel maga hash-eli; a foglalasi meres a sajat szervernek
  // kuldi, ott csak a SHA-256 lenyomata kerul a Meta ARNYEK- es a TikTok-esemenybe.
  var latogatoAzon = function () {
    try {
      var m = document.cookie.match(/(?:^|; )mp_vid=([0-9a-f-]{36})(?:;|$)/);
      if (m) return m[1];
      var v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
      document.cookie = 'mp_vid=' + v + '; path=/; max-age=' + 365 * 86400 + (eles ? '; domain=medicalpiercing.hu' : '') + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
      return v;
    } catch (e) { return undefined; }
  };
  window.mpLatogatoAzon = latogatoAzon;

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
      window.fbq('init', '2177829632420786', { external_id: latogatoAzon() });
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
    var inditasEsemeny = function () {
      if (typeof window.gtag === 'function') window.gtag('event', 'foglalas_inditasa', { send_to: 'G-SJT2RN62H8', piercing_tipus: tipus });
      // TikTok: csak marketing-hozzajarulassal (a GA4-jel fent hozzajarulas nelkul is megy, a Consent Mode szerint suti nelkul)
      if (!(dontes && dontes.mark) || !window.ttq || typeof window.ttq.track !== 'function') return;
      // content_category (piercing-tipus) NEM megy a TikToknak: egeszsegi allapotra utalo kategoria (GPT + Claude, 2026-10-12)
      window.ttq.track('InitiateCheckout', { content_name: 'foglalas_inditasa' });
    };
    var foglalasInditasa = function (e) {
      if (e.type === 'auxclick' && e.button !== 1) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || !/^https:\/\/medicalpiercing\.salonic\.hu([/?#]|$)/i.test(a.href)) return;
      inditasEsemeny();
    };
    // a foglalomotor hivja, ha NEM Salonic-linkre kattintassal nyilt (a koztes /idopontfoglalas oldal helyett a motor foldala: az "Uj piercing"
    // valasztasakor ugyanez az esemeny fut, mint korabban az "Uj piercing idopontok" Salonic-linkre kattintaskor)
    window.mpSuti.foglalasInditas = inditasEsemeny;
    document.addEventListener('click', foglalasInditasa, true);
    document.addEventListener('auxclick', foglalasInditasa, true);
  }
  }
})();
