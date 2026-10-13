// Medical Piercing - sajat (elso feles) foglalas-meres: NEM kulso merokod, kulso szkriptet nem tolt, csak a sajat
// /api/mp-foglalas vegpontra ir. Leiras: docs/MERES_GOOGLE_ARNYEK.md.
//
// 1) Minden oldalon: ha az URL-ben Google-kattintasazonosito van (gclid / gbraid / wbraid) ES a sajat suti-savban
//    (assets/js/suti.js, "mp_suti" suti) van marketing-hozzajarulas, eltarolja (localStorage "mp_gk", 90 nap). Hozzajarulas nelkul nem tarol semmit; ha a vendeg
//    kesobb, ugyanazon az oldalon fogadja el, akkor tarolja. Visszavonaskor torli.
// 2) A koszonooldalon (/foglalas-ok*): a foglalas parametereibol CSAK a kulcshoz / ertekhez szukseges mezoket kuldi
//    (bookingUrl, price, first_booking, booking_id ...); a szolgaltatas nevet, kategoriat, vendegazonositot NEM.
//    A kattintasazonositot csak hirdetesi hozzajarulassal kuldi (a szerver ezt a sutibol ujra ellenorzi).
// 3) Forras v2 (Feri kifejezett kerese, 2026-10-13: "hozzajarulas nelkul is menjen el"; kozos szabaly:
//    FORRASMERES-KOZOS-SZABALY-4-PROJEKT-2026-10-13.md): a munkamenet UTOLSO FIZETETT erintese a sessionStorage-ban
//    ("mp_forras", a lap bezarasaig): csatornanev + tisztitott utm_* + a kattintasi parameter TIPUSA + a hivatkozo KATEGORIAJA
//    + ido. Azonosito-ERTEK, URL NINCS benne, semmilyen hirdetesi platformnak nem megy; a koszonooldali jelzessel a sajat D1-be
//    kerul, a vegso cimket a szerver szamolja (lib/meres/cimke.js). Hirdetesi hozzajarulassal a fizetett erintes 30 napig a
//    szerver altal irt HttpOnly "mp_lpt" sutiben is el (/api/mp-forras); hozzajarulas nelkul suti nincs.
// 4) Meta / TikTok kattintasazonosito (fbclid, ttclid) CSAK hirdetesi hozzajarulassal, ugyanugy, mint a Google-e (mp_gk);
//    a szerver tarolja (D1), de most SEHOVA nem kuldi.
// 5) (A "Honnan hallottal rolunk?" kartya 2026-10-13-an Feri dontesere kikerult: alacsony kitoltesi arany varhato.)
(function () {
  'use strict';
  var h = location.hostname;
  if (!(h === 'www.medicalpiercing.hu' || /\.pages\.dev$/.test(h) || h === 'localhost' || h === '127.0.0.1')) return;
  var KULCS = 'mp_gk', NAP90 = 90 * 86400;
  var most = function () { return Math.floor(Date.now() / 1000); };

  var hirdetesiHozzajarulas = function () {
    // a sajat suti-sav dontese: "mp_suti=v1-s<0|1>-m<0|1>-t<unix>" (assets/js/suti.js)
    return /(?:^|;\s*)mp_suti=v1-s[01]-m1-t\d+(?:;|$)/.test(document.cookie);
  };
  var olvas = function () { try { return JSON.parse(localStorage.getItem(KULCS) || '{}') || {}; } catch (e) { return {}; } };
  var ir = function (o) { try { localStorage.setItem(KULCS, JSON.stringify(o)); } catch (e) { /* tiltott tarolo */ } };
  var torol = function () { try { localStorage.removeItem(KULCS); } catch (e) { /* tiltott tarolo */ } };

  // a koszonooldalon a suti.js mar kitisztitotta a cimet (#257): az eredeti parametereket a memoriabol olvassuk
  var KA = window.mpKoszonoAdat || null; // a koszonooldalon a suti.js altal kimentett minimalis adat (#257)
  var q = (function () {
    if (!KA) return new URLSearchParams(location.search);
    var m = new URLSearchParams();
    for (var k in KA.p) m.set(k, KA.p[k]);
    for (var t in KA.katt) m.set(t, KA.katt[t]);
    return m;
  })();
  var friss = {};
  ['gclid', 'gbraid', 'wbraid'].forEach(function (t) {
    var v = q.get(t);
    if (v && /^[A-Za-z0-9_-]{8,512}$/.test(v)) friss[t] = { ertek: v, ido: most() };
  });
  // Meta / TikTok kattintasazonosito: ugyanaz a szabaly (csak hozzajarulassal kerul az mp_gk-ba)
  ['fbclid', 'ttclid'].forEach(function (t) {
    var v = q.get(t);
    if (v && /^[A-Za-z0-9._-]{8,512}$/.test(v)) friss[t] = { ertek: v, ido: most() };
  });

  // ---------- forras v2: hozzajarulastol fuggetlen, azonosito-ERTEK nelkul (3. pont) ----------
  // A munkamenet UTOLSO FIZETETT erintese (last paid click): uj fizetett erkezes (gclid/gbraid/wbraid/fbclid/ttclid vagy
  // fizetett utm_medium) felulirja; nem fizetett erkezes fizetettet SOHA; belso hivatkozo (sajat tartomany, salonic.hu) nem
  // valtoztat (a klon.js a parametereket a belso linkeken tovabbviszi). Tarolt mezok (sessionStorage "mp_forras"):
  // { v:'mp_v2', p: google|meta|tiktok|egyeb|null, t, us, um, uc, ut, uco (utm_*, tisztitva), kp (a kattintasi parameter
  // TIPUSA), rk (search|social|egyeb|nincs a hivatkozo TARTOMANYABOL) }. A szerver (lib/meres/cimke.js) ujra tisztit es cimkez.
  var FORRAS = 'mp_forras', PLATFORMOK = ['google', 'meta', 'tiktok', 'egyeb'], V2 = 'mp_v2';
  var KP = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid'];
  var FIZ_MEDIUM = ['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'paid_search', 'cpm'];
  var forrasOlvas = function () {
    try {
      var o = JSON.parse(sessionStorage.getItem(FORRAS) || 'null');
      if (!o || !/^\d+$/.test(String(o.t))) return null;
      if (o.v === V2) return o;
      return PLATFORMOK.indexOf(o.p) >= 0 ? o : null; // regi (v1) alak: { p, t }
    } catch (e) { return null; }
  };
  var utm = function (v) { v = String(v == null ? '' : v).trim(); return /^[A-Za-z0-9._~:+-]{1,100}$/.test(v) ? v : null; };
  var refKat = function () {
    var r = document.referrer;
    if (!r) return 'nincs';
    var d; try { d = new URL(r).hostname.toLowerCase(); } catch (e) { return 'nincs'; }
    if (d === h || /(^|\.)medicalpiercing\.hu$/.test(d) || /(^|\.)salonic\.hu$/.test(d)) return 'belso';
    if (/(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia|baidu|seznam|startpage|qwant|search\.brave|aol|ask)\.[a-z.]+$/.test(d) || /(^|\.)(search|kereso)\./.test(d)) return 'search';
    if (/(^|\.)(facebook|fb|instagram|tiktok|youtube|twitter|x|linkedin|pinterest|reddit|threads|snapchat|messenger|whatsapp)\.(com|net|me)$/.test(d) || d === 't.co' || /(^|\.)lnkd\.in$/.test(d)) return 'social';
    return 'egyeb';
  };
  var fizetett = function (o) { return !!o && (KP.indexOf(o.kp) >= 0 || FIZ_MEDIUM.indexOf(String(o.um || '').toLowerCase()) >= 0); };
  var platform = function (o) {
    if (o.kp === 'gclid' || o.kp === 'gbraid' || o.kp === 'wbraid') return 'google';
    if (o.kp === 'fbclid') return 'meta';
    if (o.kp === 'ttclid') return 'tiktok';
    var s = String(o.us || '').toLowerCase();
    if (fizetett(o)) {
      if (['meta', 'facebook', 'fb', 'instagram', 'ig'].indexOf(s) >= 0) return 'meta';
      if (s === 'tiktok') return 'tiktok';
      if (['google', 'adwords', 'googleads'].indexOf(s) >= 0) return 'google';
    }
    return s ? 'egyeb' : null;
  };
  var erintes = function (u, rk) {
    var o = { v: V2, t: most(), rk: rk };
    var m = { us: 'utm_source', um: 'utm_medium', uc: 'utm_campaign', ut: 'utm_term', uco: 'utm_content' };
    for (var k in m) { var v = utm(u.get(m[k])); if (v) o[k] = v; }
    for (var i = 0; i < KP.length; i++) if (u.get(KP[i])) { o.kp = KP[i]; break; } // csak a TIPUS, az ertek nem
    o.p = platform(o);
    return o;
  };
  var jel = function (o) { return !!(o.kp || o.us || o.um || o.uc || o.rk === 'search' || o.rk === 'social' || o.rk === 'egyeb'); };
  var azonos = function (a, b) { return ['kp', 'us', 'um', 'uc', 'ut', 'uco'].every(function (k) { return (a[k] || null) === (b[k] || null); }); };
  // hirdetesi hozzajarulassal a fizetett erintes 30 napig a szerver altal irt HttpOnly sutiben is el (/api/mp-forras)
  var lptKuld = function () {
    var o = forrasOlvas();
    if (!o || o.v !== V2 || !fizetett(o) || !hirdetesiHozzajarulas()) return;
    var f = {}; ['v', 't', 'us', 'um', 'uc', 'ut', 'uco', 'kp', 'rk'].forEach(function (k) { if (o[k] != null) f[k] = o[k]; });
    try {
      fetch('/api/mp-forras', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify({ forras: f }) })
        .catch(function () { /* nem zavar */ });
    } catch (e) { /* regi bongeszo */ }
  };
  if (!KA && !/^\/(foglalas-ok|fulbevalo-ok)/i.test(location.pathname)) {
    var rk = refKat(), regi = forrasOlvas(), uj = erintes(new URLSearchParams(location.search), rk === 'belso' ? 'nincs' : rk);
    var csere = false;
    if (!regi) csere = rk !== 'belso' || jel(uj); // elso erkezes (belso hivatkozoval csak ha van jel, pl. uj lap)
    else if (rk === 'belso') csere = false; // belso navigacio / tovabbvitt parameterek: nem valtoztat
    else if (fizetett(uj)) csere = !(regi.v === V2 && fizetett(regi) && azonos(regi, uj)); // uj fizetett kattintas nyer (ujratoltes nem)
    else if (!(regi.v === V2 ? fizetett(regi) : PLATFORMOK.indexOf(regi.p) >= 0 && regi.p !== 'egyeb')) csere = jel(uj); // nem fizetett: csak nem-fizetett, nem direkt felulir
    if (csere) {
      try { sessionStorage.setItem(FORRAS, JSON.stringify(uj)); } catch (e) { /* tiltott tarolo */ }
      if (fizetett(uj)) lptKuld();
    }
  }
  // a suti-sav dontese / modositasa utan: hozzajarulassal a fizetett erintes sutije most kerul ki; visszavonaskor a szerver torli
  document.addEventListener('mp_suti_valtozas', function () {
    if (hirdetesiHozzajarulas()) { lptKuld(); return; }
    try { fetch('/api/mp-forras', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: '{}' }).catch(function () {}); } catch (e) { /* regi bongeszo */ }
  });
  // a koszonooldal cimeben a motor altal atvitt azonosito csak potlas: hozzajarulassal mar tarolt, ervenyes erteket nem ir felul
  var koszono = /^\/foglalas-ok[a-z0-9-]*\/?$/i.test(location.pathname);
  var mentes = function () {
    if (!hirdetesiHozzajarulas()) return;
    var o = olvas();
    for (var t in friss) if (!(koszono && o[t] && most() - o[t].ido <= NAP90)) o[t] = friss[t];
    for (var k in o) if (!o[k] || most() - o[k].ido > NAP90) delete o[k];
    ir(o);
  };
  if (Object.keys(friss).length) mentes();
  // a suti-sav esemenye a dontes / modositas utan
  document.addEventListener('mp_suti_valtozas', function () {
    if (hirdetesiHozzajarulas()) mentes(); else torol();
  });

  if (!/^\/foglalas-ok[a-z0-9-]*\/?$/i.test(KA ? KA.ut : location.pathname)) return;
  var p = {};
  ['bookingUrl', 'price', 'first_booking', 'booking_id', 'placeId', 'employeeId', 'startDate', 'serviceId'].forEach(function (k) {
    var v = q.get(k);
    if (v != null && v !== '') p[k] = v;
  });
  if (!p.bookingUrl && !(p.placeId && p.employeeId && p.startDate)) return; // nem foglalasbol erkezett
  var katNelkulKuldve = false, potolva = false;
  var vanKatt = function (o) { return !!(o && (o.gclid || o.gbraid || o.wbraid || o.fbclid || o.ttclid)); };
  var kuld = function (potlas) {
    var kat = hirdetesiHozzajarulas() ? olvas() : null;
    if (!potlas && !vanKatt(kat)) katNelkulKuldve = true;
    var torzs = { ut: KA ? KA.ut : location.pathname, p: p, kattintas: kat };
    var fo = forrasOlvas();
    if (fo && fo.p) torzs.forras_platform = fo.p; // csak a csatornanev, azonosito nelkul (visszafele kompatibilis)
    if (fo && fo.v === V2) {
      var f = {}; ['v', 't', 'us', 'um', 'uc', 'ut', 'uco', 'kp', 'rk'].forEach(function (k) { if (fo[k] != null) f[k] = fo[k]; });
      torzs.forras = f; // tisztitott bizonyitek, kattintasazonosito-ertek NELKUL
    }
    torzs.forras_v = V2;
    if (window.top !== window) torzs.keret = true;
    if (potlas) torzs.potlas = true;
    try {
      fetch('/api/mp-foglalas', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify(torzs) })
        .catch(function () { /* a vendeg folyamatat nem zavarja */ });
    } catch (e) { /* regi bongeszo */ }
  };

  // a suti-sav dontesere roviden varunk (ha a vendeg epp most fogad el), de legkesobb 4 mp utan kuldunk
  var elkuldve = false;
  var egyszer = function () { if (!elkuldve) { elkuldve = true; kuld(); } };
  // A foglalomotor keretebe toltott koszonooldal (assets/js/motor/motor.js): a motor UGYANEZT a koszonooldalt booking_id-vel
  // a fo ablakban nyitja meg, onnan megy a jelzes. A suti.js a motor visszaigazolasakor (1,5 mp-en belul) jeloli a
  // <html data-mp-motor-atvette="1">-et: ilyenkor a keretbol nem kuldunk. A regi, kozvetlenul beagyazott Salonic-naptarak
  // keretei (pl. /migren-piercing-uj) nem kapnak visszaigazolast: onnan kuldunk, mint eddig.
  if (window.top !== window) {
    setTimeout(function () { if (document.documentElement.getAttribute('data-mp-motor-atvette') !== '1') egyszer(); }, 1700);
    return;
  }
  // Kesoi (4 mp utani) hozzajarulas: a foglalas mar kattintasazonosito nelkul ment el. Ha most van hirdetesi hozzajarulas ES
  // tarolt azonosito, EGYSZER potlo kerest kuldunk; a szerver csak a meg azonosito nelkuli, friss, ugyanezen foglalasi
  // kulcsu (es motorosnal ugyanazon booking_id-ju) sort egesziti ki, felulirni nem tud (lib/meres/lanc.js).
  document.addEventListener('mp_suti_valtozas', function () {
    setTimeout(function () {
      if (!elkuldve || !katNelkulKuldve || potolva || !hirdetesiHozzajarulas() || !vanKatt(olvas())) return;
      potolva = true; kuld(true);
    }, 120);
  });
  if (/(?:^|;\s*)mp_suti=v1-/.test(document.cookie) || !/medicalpiercing\.hu$/.test(h)) egyszer();
  else {
    document.addEventListener('mp_suti_valtozas', function () { setTimeout(egyszer, 50); });
    setTimeout(egyszer, 4000);
    addEventListener('pagehide', egyszer); // ha a vendeg hamarabb tovabblep, akkor is kimegy (keepalive)
  }
})();
