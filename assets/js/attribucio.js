// QA-2 ERKEZESI ADATOK (DECISION-LOG #99 3. pont): a latogato erkezesi adatainak sajat (first-party) tarolasa, hogy a szerver-oldali meres (Meta CAPI, TikTok Events API, Google, GA4)
// a foglalashoz / vasarlashoz hozza tudja kotni. NEM mero-kod: nem tolt be kulso szkriptet, nem kuld semmit harmadik felnek; csak a sajat /api/meres-erkezes vegpontunkra ir (azonos eredet).
//   - PLATFORMONKENT KULON utolso kattintas + idobelyeg: Google (gclid / gbraid / wbraid, mind kulon), Meta (fbclid -> fbc), TikTok (ttclid)
//   - ELSO es UTOLSO erintes UTM-je (utm_elso: soha nem irodik felul; utm_utolso: minden uj UTM-es erkezesnel)
//   - _fbp, _ttp (a Meta- / TikTok-pixel sutije; csak OLVASSUK, mi nem hozunk letre sutit), GA4 client_id (_ga) + session_id (_ga_<mero-azonosito>)
//   - hozzajarulas: a suti.js dontese (mh_cc) - a szerver SZ-38 szerint hasznalja (Meta / TikTok hozzajarulas nelkul is, Google / GA4 a valos jel szerint)
// TAROLAS (GPT-dontes, 2026-10-10, QA-5 elotti higienia): a kattintasazonositok es az UTM CSAK a marketing-hozzajarulas (mh_cc.adv, suti.js) utan kerulnek a localStorage-ba ('mh_attr').
//   Hozzajarulas elott / nelkul az adat csak MEMORIABAN (az aktualis oldal URL-jebol) van, ez megy a foglalas kuldesekor a szervernek (SZ-38 valtozatlan); localStorage-iras nincs.
//   A hozzajarulas pillanataban a memoriabeli pillanatkep kiirodik; visszavonaskor / elutasitasnal a tarolt 'mh_attr' torlodik.
// 7 NAPOS UTOLSO FIZETETT KATTINTAS (2026-10-19, Feri kifejezett kerese; docs/booking-engine/FORRAS_LPT.md): a fizetett erkezes (gclid / gbraid / wbraid / fbclid / ttclid VAGY fizetett utm_medium) tisztitott erintese a munkamenetben
//   (sessionStorage 'mh_forras') + 2 oras latogatas-tarolo (localStorage 'mh_forras_l'; csak utm, a kattintasi parameter TIPUSA, a hivatkozo KATEGORIAJA - azonosito-ERTEK nem); a fizetett erkezeskor a sajat /api/mosaic-forras vegpontra
//   megy egy POST (a kattintasazonosito ERTEKET CSAK ez viszi, a szerver altal irt HttpOnly 'mh_lpt' sutihez); a koszonooldali jelzes (kuld) az erintest + a tarolo tipusat is viszi; lptKlikk() / klikkAzonositok(): a sutibol a szerverrol
//   visszanyert azonositok (a foglalo koszonooldal-atadasa fuzi az URL-hez). MINDEN csak marketing-engedellyel (engedely()), csak a felso ablakban; a hiba SOSEM akadalyozza az oldalt / a foglalast.
// ARNYEKMOD: az eles domainen (mosaicheadspa.hu) QA-4 (DECISION-LOG #120) ota fut (ELES_ENGEDELYEZVE = true): csak a sajat /api/meres-erkezes vegpontra ir, a kuldes kizarolag ARNYEK-celpontokra megy (docs/booking-engine/QA4_ELESITES.md). Vészkapcsolo: meres_kapcsolo 'iras' / MERES_IRAS_KI.
(function () {
  'use strict';
  var ELES_DOMAINEK = ['mosaicheadspa.hu', 'www.mosaicheadspa.hu'];
  var ELES_ENGEDELYEZVE = true;
  var w = window, d = document;
  try {
    if (w.mhAttribucio) return;
    if (ELES_DOMAINEK.indexOf(location.hostname) >= 0 && !ELES_ENGEDELYEZVE) return;
    if (w.top !== w.self) return; // keretben (osszehasonlito eszkoz, beagyazott keret) nem gyujtunk
  } catch (e) { return; }

  var KULCS = 'mh_attr', TTL = 90 * 86400; // a Google kattintasazonositoja 90 napig ervenyes
  var MINTA = { gclid: /^[A-Za-z0-9_-]{10,200}$/, gbraid: /^[A-Za-z0-9_-]{10,200}$/, wbraid: /^[A-Za-z0-9_-]{10,200}$/, fbclid: /^[A-Za-z0-9_-]{8,200}$/, ttclid: /^[A-Za-z0-9_.-]{8,200}$/ };
  var UTM = ['source', 'medium', 'campaign', 'term', 'content'];
  var ma = function () { return Math.floor(Date.now() / 1000); };
  // 7 napos utolso fizetett kattintas (docs/booking-engine/FORRAS_LPT.md): a parse (lent) mar a vegen levo szakasz elott fut, ezert ezek a deklaraciok itt vannak
  var KP = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid'], F_POTLAS = 'mh_lpt_potlas', POTLAS_MP = 7 * 86400; // POTLAS_MP: a sutibol / Meta- es TikTok-azonositokbol potolt kattintas legnagyobb kora (7 nap = a cimke-ablak)
  // a Salonic-foglalas utani koszonooldalak (assets/js/foglalas-kulcs.js, tools/netlify-build.mjs FOGLALAS_KOSZONO): ezek NEM erkezesek, ott nem keletkezik uj erintes
  var KOSZONO_UT = /^\/(success-foglalas[a-z0-9-]*|oxigenterapia-masodik|ajikartya-ok|eltavolitas-ok|elysion-ok|fodrasz-ok|foglalas-ok|korrekcio-ok|oxigenterapia-ok|pmu-ok|szor-konzi-ok|szortelenites-ok|pmu-vh|pmu-lead-ok)\/?$/;
  function koszonoOldal() { return KOSZONO_UT.test(location.pathname) || /(?:^|[?&])bookingUrl=/.test(location.search); }
  // a foglalo-atadasnal a SUTIBOL potolt azonositok (sessionStorage 'mh_lpt_potlas': "kulcs:suti-kattintasi-ido,..."): a koszonooldalon az URL-ben levo ilyen azonosito ts-e a suti VALODI kattintasi ideje
  // (nem a koszonooldal betoltese), igy a shadow-lanc fbc / ts ideje sem a foglalas ideje. Csak a koszonooldalon (oda megy az atadas). -> { kulcs: unix mp }
  function potlasIdok() {
    var o = {};
    try {
      if (!koszonoOldal()) return o;
      String(sessionStorage.getItem(F_POTLAS) || '').split(',').forEach(function (e) {
        var p = e.split(':'), n = Number(p[1]);
        if (KP.indexOf(p[0]) >= 0 && Number.isInteger(n) && n > 1600000000 && n <= ma() + 300 && ma() - n <= 120 * 86400) o[p[0]] = n;
      });
    } catch (e) { /* nincs jelzes */ }
    return o;
  }

  // marketing-hozzajarulas (a suti.js dontese): dontes nelkul / elutasitva = false
  function engedely() {
    try { if (w.mhSuti && typeof w.mhSuti.engedely === 'function') return !!w.mhSuti.engedely('adv'); } catch (e) { /* a suti.js hibaja: nincs engedely */ }
    return hozzajarulas().adv === true;
  }
  function torol() { try { localStorage.removeItem(KULCS); } catch (e) { /* nem baj */ } }
  // csak engedellyel olvas a tarolobol (hozzajarulas nelkul a regebben, engedely elott tarolt adat sem hasznalhato: torolve)
  function olvas() {
    if (!engedely()) { torol(); return { v: 1 }; }
    try { var o = JSON.parse(localStorage.getItem(KULCS)); if (o && o.v === 1) return o; } catch (e) { /* privat ablak / tiltott tarolo */ }
    return { v: 1 };
  }
  // csak engedellyel ir; engedely nelkul NINCS localStorage-iras (a memoriabeli pillanatkep marad)
  function ment(o) { if (!engedely()) return false; try { localStorage.setItem(KULCS, JSON.stringify(o)); return true; } catch (e) { return false; /* nem baj: a memoriabeli pillanatkep akkor is megvan */ } }
  function suti(nev) {
    try { var m = d.cookie.match(new RegExp('(?:^|;\\s*)' + nev.replace(/[^\w-]/g, '') + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; }
  }

  // az uj kattintas / UTM az URL-bol; a regi (>90 nap) kattintas eldobva
  var allapot = olvas(), t = ma();
  ['google', 'meta', 'tiktok'].forEach(function (p) { var o = allapot[p]; if (o && o.ts && t - o.ts > TTL) delete allapot[p]; });
  try {
    var q = new URLSearchParams(location.search);
    // F2: UGYANAZT az azonositot nem belyegezzuk ujra (a mar tarolt / memoriabeli azonositoval egyezo ertek megtartja a ts-t); csak UJ azonosito kap uj ts-t - a sutibol potolt azonosito (koszonooldal)
    // a suti valodi kattintasi idejet (potlasIdok), kulonben a mostani idot. A parse a koszonooldalon is lefut (a hozzajarulas nelkuli SZ-38 memoria-pillanatkep es a Google R1 ettol fugg).
    var pi = potlasIdok();
    ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { var v = q.get(k); if (v && MINTA[k].test(v)) { var r = allapot.google && allapot.google[k]; allapot.google = allapot.google || {}; allapot.google[k] = { ertek: v, ts: r && r.ertek === v && r.ts ? r.ts : (pi[k] || t) }; } });
    var fb = q.get('fbclid'); if (fb && MINTA.fbclid.test(fb)) { var rm = allapot.meta; allapot.meta = { fbclid: fb, ts: rm && rm.fbclid === fb && rm.ts ? rm.ts : (pi.fbclid || t) }; }
    var tt = q.get('ttclid'); if (tt && MINTA.ttclid.test(tt)) { var rt = allapot.tiktok && allapot.tiktok.ttclid; allapot.tiktok = { ttclid: { ertek: tt, ts: rt && rt.ertek === tt && rt.ts ? rt.ts : (pi.ttclid || t) } }; }
    var utm = {}, van = false;
    UTM.forEach(function (k) { var v = q.get('utm_' + k); if (v) { utm[k] = String(v).slice(0, 120); van = true; } });
    if (van) { utm.ts = t; allapot.utm_utolso = utm; if (!allapot.utm_elso) allapot.utm_elso = JSON.parse(JSON.stringify(utm)); }
  } catch (e) { /* hibas URL: nincs uj adat */ }
  ment(allapot); // engedely nelkul nem ir (csak memoria)
  // a hozzajarulas valtozasa (suti.js): megadva -> a memoriabeli pillanatkep kiirodik; visszavonva / elutasitva -> a tarolt adat torlodik
  var figyeloKotve = false;
  function valtozott() {
    try { if (engedely()) ment(allapot); else torol(); } catch (e) { /* nem baj */ }
    try { lptValtozott(); } catch (e) { /* nem baj */ }
  }
  function figyeloKot() {
    if (figyeloKotve) return true;
    try { if (w.mhSuti && typeof w.mhSuti.figyel === 'function') { w.mhSuti.figyel(valtozott); figyeloKotve = true; } } catch (e) { /* nem baj */ }
    return figyeloKotve;
  }
  if (!figyeloKot()) { try { d.addEventListener('DOMContentLoaded', figyeloKot); w.addEventListener('load', figyeloKot); } catch (e) { /* nincs esemeny-API */ } }

  function ga4() {
    var o = {};
    var ga = suti('_ga'), m = ga && ga.match(/^GA\d\.\d+\.(\d+\.\d+)$/); if (m) o.client_id = m[1];
    try { // a mero-azonosito sutije: _ga_<G-utan levő resz>; GS1: GS1.1.<session_id>.<n>..., GS2: GS2.1.s<session_id>$o...
      (d.cookie || '').split(';').forEach(function (c) {
        var p = c.trim().match(/^_ga_([A-Z0-9]{6,12})=(.*)$/); if (!p) return;
        var s = p[2].match(/^GS1\.\d\.(\d{9,11})\./) || p[2].match(/^GS2\.\d\.s(\d{9,11})\$/);
        if (s && !o.session_id) { o.session_id = s[1]; o.measurement_id = 'G-' + p[1]; }
      });
    } catch (e) { /* nincs session */ }
    return o;
  }
  /** A szerver (erkezes.js erkezesTisztit) altal vart alak: { google, meta, tiktok, utm_elso, utm_utolso, fbp, ttp, ga4 }. A Meta fbc: a sajat _fbc suti, tartalekban az fbclid-bol. */
  function pillanatkep() {
    var a = allapot, o = {}; // a memoriabeli allapot (engedellyel a tarolt + az uj URL-adat, engedely nelkul csak az URL-adat)
    if (a.google) o.google = a.google;
    var fbc = suti('_fbc');
    if (fbc || a.meta) o.meta = { fbc: fbc || (a.meta && a.meta.fbclid ? 'fb.1.' + a.meta.ts * 1000 + '.' + a.meta.fbclid : undefined), fbclid: a.meta && a.meta.fbclid, ts: a.meta && a.meta.ts };
    if (a.tiktok) o.tiktok = a.tiktok;
    if (a.utm_elso) o.utm_elso = a.utm_elso;
    if (a.utm_utolso) o.utm_utolso = a.utm_utolso;
    var fbp = suti('_fbp'); if (fbp) o.fbp = fbp;
    var ttp = suti('_ttp'); if (ttp) o.ttp = ttp;
    var g = ga4(); if (g.client_id || g.session_id) o.ga4 = g;
    return o;
  }
  function hozzajarulas() {
    try { var c = JSON.parse(localStorage.getItem('mh_cc')); if (c && c.v === 1) return { ana: !!c.ana, adv: !!c.adv, fun: !!c.fun }; } catch (e) { /* nincs dontes */ }
    return {};
  }

  /**
   * Az erkezesi adatok kuldese a szervernek, a foglalas / vasarlas azonositojaval (source_id: booking_id | Stripe pi_ | ATU-... rendelesazonosito).
   * o: { source_id, uzletag, tipus: 'foglalas' | 'ajandekkartya', szolgaltatas, ar, first_booking, g, kategoria, munkatars, bookingUrl }. Szemelyes adat (nev, e-mail, telefon) NEM megy.
   * A hiba sosem akadalyozhatja a foglalast / vasarlast; az eredmeny a window.mhAttribucioEredmeny-ben latszik (ellenorzo proba).
   */
  // UJ-67/69/71/73: a szerver CSAK bekapcsolt uzletagnal ad "tiktok_elo" jelzest az erkezes valaszaban (TIKTOK_ELO_BE + titok). A bongeszos TikTok-esemeny ugyanazzal az event_id-val megy, mint a szerveres Events API
  // (a TikTok deduplikal); marketing-hozzajarulas nelkul nem; a pixel kesobbi betoltodeset (GTM) max. 10 mp-ig varjuk; egy event_id egyszer.
  function tiktokEloKuld(t) {
    try {
      if (!t || !/^[A-Za-z]{3,30}$/.test(String(t.esemeny || '')) || !/^[A-Za-z0-9_-]{8,160}$/.test(String(t.event_id || '')) || !engedely()) return;
      var probak = 0;
      var probal = function () {
        if (w.ttq && typeof w.ttq.track === 'function' && w.ttq._i) {
          var jel = 'mhTtqElo:' + t.event_id;
          try { if (sessionStorage.getItem(jel)) return; sessionStorage.setItem(jel, '1'); } catch (e) { /* privat mod: a pixel maga is deduplikal az event_id-val */ }
          try { w.ttq.track(t.esemeny, {}, { event_id: t.event_id }); } catch (e2) { /* nem baj */ }
        } else if (++probak < 40) setTimeout(probal, 250);
      };
      probal();
    } catch (e3) { /* regi bongeszo */ }
  }
  function kuld(o) {
    try {
      var jel = 'mhAttrKuldve:' + o.source_id;
      try { if (sessionStorage.getItem(jel)) return Promise.resolve({ allapot: 'mar_kuldve' }); } catch (e) { /* privat mod */ }
      var body = Object.assign({}, o, { attr: pillanatkep(), hozz: hozzajarulas(), oldal: location.origin + location.pathname });
      try { // 7 napos utolso fizetett kattintas: a latogatas erintese (tisztitva, azonosito-ertek nelkul) + a tarolo tipusa + a foglalo-atadasnal a sutibol potolt kattintasi parameterek (csak tipusok)
        body.forras_adv = engedely(); // a HATALYOS marketing-allapot (a "hozz" nyers mh_cc marad, SZ-38): a szerver a suti-olvasashoz / potlashoz ezt hasznalja
        var fo = forrasOlvas();
        if (fo) { body.forras = tiszta(fo); body.forras_tarolo = fo.b === 'l' ? 'latogatas' : 'munkamenet'; }
        var pot = lptPotlasOlvas(); if (pot.length) body.lpt_potlas = pot;
      } catch (e) { /* a forras-jelzes hibaja nem akadalyozhatja a foglalast */ }
      w.mhAttribucioEredmeny = { source_id: o.source_id, allapot: 'kuldve', kuldott: body };
      return fetch('/api/meres-erkezes', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify(body) })
        .then(function (r) {
          return r.json().catch(function () { return null; }).then(function (j) {
            w.mhAttribucioEredmeny = { source_id: o.source_id, allapot: 'valasz', status: r.status, valasz: j, kuldott: body };
            if (r.ok) { try { sessionStorage.setItem(jel, '1'); sessionStorage.removeItem(F_POTLAS); } catch (e) { /* nem baj */ } }
            if (r.ok && j && j.tiktok_elo) tiktokEloKuld(j.tiktok_elo);
            return w.mhAttribucioEredmeny;
          });
        }).catch(function (e) { w.mhAttribucioEredmeny = { source_id: o.source_id, allapot: 'hiba', hiba: String(e && e.message || e).slice(0, 80) }; return w.mhAttribucioEredmeny; });
    } catch (e) { return Promise.resolve({ allapot: 'hiba' }); }
  }
  /**
   * A Google kattintasazonositok a foglalo kontextusaba / a koszonooldal URL-jebe (DECISION #196 / 1., R1-R3): az oldal MENTETT allapotabol (a memoriabeli pillanatkep = az aktualis URL +
   * a hozzajarulassal tarolt mh_attr) es a Google-cimke sajat sutijebol (_gcl_aw: gclid, _gcl_gb: gbraid; a GTM a hozzajarulas szerint allitja), ha az aktualis URL-ben nincs azonosito.
   * HOZZAJARULAS: marketing-engedely (engedely(), ugyanaz mint a tarolasnal) nelkul / elutasitva UTAN ures objektumot ad: a mentett allapotbol semmi nem szivarog at. Csak olvas (nem ir
   * localStorage-ot, nem allit sutit, nem hiv semmit); a mintat (10-200 karakter) ugyanaz a MINTA vedi. Visszaadja: { gclid?, gbraid?, wbraid? } (ertekek, nem objektumok).
   */
  function googleAzonositok() {
    var o = {};
    try {
      if (!engedely()) return o;
      var g = allapot.google || {};
      var most = ma(); // a 90 napnal regebbi kattintas-azonosito nem hasznalhato (a Google-cimke sutije is addig el)
      ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { var e = g[k] && g[k].ertek; if (e && MINTA[k].test(e) && (!g[k].ts || most - g[k].ts <= TTL)) o[k] = e; });
      [['gclid', '_gcl_aw'], ['gbraid', '_gcl_gb']].forEach(function (p) {
        if (o[p[0]]) return;
        var s = suti(p[1]), m = s && s.match(/^GCL\.\d{9,11}\.([A-Za-z0-9_-]{10,200})$/);
        if (m && MINTA[p[0]].test(m[1])) o[p[0]] = m[1];
      });
    } catch (e) { /* nincs mentett azonosito */ }
    return o;
  }
  // ===================== 7 NAPOS UTOLSO FIZETETT KATTINTAS (forras-meres) =====================
  var LPT_HOST = /^(www\.)?mosaicheadspa\.hu$/.test(location.hostname) || /\.pages\.dev$/.test(location.hostname) || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var F_SESS = 'mh_forras', F_LATOG = 'mh_forras_l', F_TOROLVE = 'mh_lpt_torolve', LATOG_MP = 2 * 3600, F_V = 1;
  var FIZ_MEDIUM = ['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'paid_search', 'cpm'];
  function utmT(v) { v = String(v == null ? '' : v).trim(); if (v.normalize) v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); v = v.replace(/[^A-Za-z0-9._~:+-]+/g, '_').slice(0, 100).replace(/^_+|_+$/g, ''); return v || null; }
  function szamT(v) { v = String(v == null ? '' : v).trim(); return /^\d{1,20}$/.test(v) ? v : null; }
  function refKat() { // a hivatkozo KATEGORIAJA (URL nincs): belso | search | social | egyeb | nincs
    var r = d.referrer; if (!r) return 'nincs';
    var h; try { h = new URL(r).hostname.toLowerCase(); } catch (e) { return 'nincs'; }
    if (h === location.hostname || /(^|\.)mosaicheadspa\.hu$/.test(h) || /(^|\.)salonic\.hu$/.test(h)) return 'belso';
    if (/(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia|baidu|seznam|startpage|qwant|search\.brave|aol|ask)\.[a-z.]+$/.test(h) || /(^|\.)(search|kereso)\./.test(h)) return 'search';
    if (/(^|\.)(facebook|fb|instagram|tiktok|youtube|twitter|x|linkedin|pinterest|reddit|threads|snapchat|messenger|whatsapp)\.(com|net|me)$/.test(h) || h === 't.co' || /(^|\.)lnkd\.in$/.test(h)) return 'social';
    return 'egyeb';
  }
  function navTipus() {
    try {
      var n = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (n && n.type) return n.type;
      var r = performance.navigation && performance.navigation.type;
      return r === 1 ? 'reload' : r === 2 ? 'back_forward' : 'navigate';
    } catch (e) { return 'navigate'; }
  }
  function fizetett(o) { return !!o && (KP.indexOf(o.kp) >= 0 || FIZ_MEDIUM.indexOf(String(o.um || '').toLowerCase()) >= 0); }
  function jel(o) { return !!(o.kp || o.us || o.um || o.uc || o.rk === 'search' || o.rk === 'social' || o.rk === 'egyeb'); }
  function azonos(a, b) { return ['kp', 'us', 'um', 'uc', 'ut', 'uco', 'gc', 'ag', 'ad'].every(function (k) { return (a[k] || null) === (b[k] || null); }); }
  /** Az URL-bol az erkezes erintese ({ touch, kv }): touch = tisztitott (azonosito-ERTEK nelkul), kv = a nyers kattintasazonosito (CSAK a sutit iro POST viszi). */
  function erintes(uq, rk) {
    var o = { v: F_V, t: ma(), rk: rk }, kv = null, m = { us: 'utm_source', um: 'utm_medium', uc: 'utm_campaign', ut: 'utm_term', uco: 'utm_content' };
    for (var k in m) { var x = utmT(uq.get(m[k])); if (x) o[k] = x; }
    for (var i = 0; i < KP.length; i++) { var v = uq.get(KP[i]); if (v) { o.kp = KP[i]; if (MINTA[KP[i]].test(v)) kv = v; break; } } // a TIPUS (az ertek csak a POST-ban)
    var gc = szamT(uq.get('gad_campaignid')) || szamT(uq.get('campaignid')) || szamT(uq.get('utm_id')), ag = szamT(uq.get('adgroupid')), ad = szamT(uq.get('adid')) || szamT(uq.get('ad_id'));
    if (gc) o.gc = gc; if (ag) o.ag = ag; if (ad) o.ad = ad;
    return { touch: o, kv: kv };
  }
  function tiszta(o) { var f = {}; ['v', 't', 'us', 'um', 'uc', 'ut', 'uco', 'gc', 'ag', 'ad', 'kp', 'rk'].forEach(function (k) { if (o[k] != null) f[k] = o[k]; }); return f; }
  function ervenyes(o) { return o && typeof o === 'object' && o.v === F_V && /^\d+$/.test(String(o.t)) ? o : null; }
  function mOlvas() { try { return ervenyes(JSON.parse(sessionStorage.getItem(F_SESS) || 'null')); } catch (e) { return null; } }
  function mIr(o) { try { var f = tiszta(o); if (o.b === 'l') f.b = 'l'; sessionStorage.setItem(F_SESS, JSON.stringify(f)); } catch (e) { /* tiltott tarolo */ } } // a 'b: l' jelzes (latogatas-tarolobol visszaallitva) megmarad
  function lOlvas() {
    try {
      var x = JSON.parse(localStorage.getItem(F_LATOG) || 'null');
      if (!x || typeof x !== 'object' || !(Number(x.lej) > ma())) { if (x) localStorage.removeItem(F_LATOG); return null; }
      var o = ervenyes(x.e); if (o) return o;
      localStorage.removeItem(F_LATOG); return null; // hibas / idegen tartalom
    } catch (e) { try { localStorage.removeItem(F_LATOG); } catch (x2) { /* tiltott tarolo */ } return null; }
  }
  function lIr(o) { if (!ervenyes(o)) return; try { localStorage.setItem(F_LATOG, JSON.stringify({ e: tiszta(o), lej: ma() + LATOG_MP })); } catch (e) { /* tiltott tarolo */ } }
  function forrasTorol() { try { sessionStorage.removeItem(F_SESS); sessionStorage.removeItem(F_POTLAS); } catch (e) { /* nem baj */ } try { localStorage.removeItem(F_LATOG); } catch (e2) { /* nem baj */ } }
  /** A hatalyos erintes a ket tarolobol (engedely nelkul null): sessionStorage; ha ures, a 2 oras latogatas-tarolo ('b: l' jelzessel, a szerver 'latogatas'-kent tarolja); ujabb fizetett a latogatas-taroloban nyer. */
  function forrasOlvas() {
    if (!engedely()) return null;
    var s = mOlvas(), l = lOlvas();
    if (l && (!s || (fizetett(l) && (!fizetett(s) || Number(l.t) > Number(s.t))))) { var o = tiszta(l); o.b = 'l'; mIr(o); return o; }
    return s;
  }
  // KIFEJEZETT elutasitas (nem csak "nincs engedely"): a suti.js hatalyos dontese; suti.js nelkuli oldalon (pl. /foglalo-motor) a tarolt, nem reszleges mh_cc elutasitas. Dontes nelkul NEM elutasitas (DECISION #170: alapertek granted).
  function elutasitva() {
    try {
      if (w.mhSuti && typeof w.mhSuti.engedely === 'function') return !w.mhSuti.engedely('adv');
      var c = JSON.parse(localStorage.getItem('mh_cc'));
      return !!(c && c.v === 1 && !c.reszleges && !c.adv);
    } catch (e) { return false; }
  }
  function hozzPost() { var h = hozzajarulas(); if (engedely()) h.adv = true; return h; } // a HATALYOS allapot (a reszleges / dontes nelkuli bejegyzes nem "elutasitas")
  function lptPost(torzs) {
    try {
      if (!LPT_HOST || typeof fetch !== 'function') return;
      fetch('/api/mosaic-forras', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify(torzs) }).catch(function () { /* nem zavar */ });
    } catch (e) { /* regi bongeszo */ }
  }
  /** Fizetett erkezes: a szerver iras HttpOnly sutit (mh_lpt). A kattintasazonosito ERTEKE csak ebben a keresben megy, marketing-engedellyel. */
  function lptKuld(t, kv) {
    if (!engedely() || !fizetett(t)) return;
    var f = tiszta(t); delete f.rk;
    if (kv && f.kp && MINTA[f.kp] && MINTA[f.kp].test(kv)) f.kv = kv;
    lptPost({ forras: f, lap: location.pathname, hozz: hozzPost() }); // lap: a landing utvonal (az erintesnaplohoz; query nelkul)
  }
  function lptTorolKuld() { lptPost({ hozz: { adv: false } }); } // kifejezett elutasitas / visszavonas: a szerver torli a sutit
  // #495 (UJ-80) ERINTESNAPLO: az organikus / direkt visszateres (nem fizetett erkezes, nem belso navigacio, nem ujratoltes) NAPI 1x jelzes a szervernek (mh_vid suti + konnyu erintes-sor). A szerver a MERES_VID_BE
  // kapcsolo es a titkos kulcs hianyaban semmit nem ir, es "vid: false"-t jelez: ekkor 7 napig nem probalkozunk ujra. Marketing-engedely nelkul nem megy; a napi korlat a localStorage-ban (tiltott tarolo: nem kuldunk).
  var F_VID_NAP = 'mh_vid_nap', F_VID_KI = 'mh_vid_ki';
  function napKulcs() { var dt = new Date(); return dt.getUTCFullYear() + '-' + (dt.getUTCMonth() + 1) + '-' + dt.getUTCDate(); }
  function vidOrganikusKuld(t) {
    if (!engedely() || fizetett(t) || !LPT_HOST || typeof fetch !== 'function') return;
    try {
      if (Number(localStorage.getItem(F_VID_KI) || 0) > ma()) return; // a szerver kikapcsolt allapotot jelzett: nem probalkozunk
      if (localStorage.getItem(F_VID_NAP) === napKulcs()) return;
    } catch (e) { return; }
    try {
      fetch('/api/mosaic-forras', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify({ forras: tiszta(t), organikus: true, lap: location.pathname, hozz: hozzPost() }) })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (j) { if (!j) return; try { localStorage.setItem(F_VID_NAP, napKulcs()); if (j.vid === false) localStorage.setItem(F_VID_KI, String(ma() + 86400)); } catch (e2) { /* nem baj */ } }) // a napi jelzes csak sikeres valasz utan; kikapcsolt szerver: 1 nap szunet
        .catch(function () { /* nem zavar */ });
    } catch (e3) { /* regi bongeszo */ }
  }
  function erkezesFeldolgoz() {
    if (!LPT_HOST) return;
    if (!engedely()) { // nincs engedely: nincs erzekeles. KIFEJEZETT elutasitasnal a tarolt erintes torolve, a korabban irt suti torlese (munkamenetenkent egyszer); dontes / suti.js nelkul semmi nem torlodik
      if (!elutasitva()) return;
      forrasTorol();
      var mar = null; try { mar = sessionStorage.getItem(F_TOROLVE); } catch (e) { /* nem baj */ }
      if (!mar) { try { sessionStorage.setItem(F_TOROLVE, '1'); } catch (e2) { /* nem baj */ } lptTorolKuld(); }
      return;
    }
    if (koszonoOldal()) { latogatasFrissit(); return; } // koszonooldal: nem erkezes
    var rk = refKat(), regi = forrasOlvas(), er = erintes(new URLSearchParams(location.search), rk === 'belso' ? 'nincs' : rk), uj = er.touch, csere = false;
    if (!regi) csere = rk !== 'belso' || jel(uj); // elso erkezes (belso hivatkozoval csak ha van jel)
    else if (rk === 'belso') csere = false; // belso navigacio / tovabbvitt parameterek: nem valtoztat
    else if (fizetett(uj)) csere = !(fizetett(regi) && azonos(regi, uj)); // uj fizetett kattintas nyer
    else if (!fizetett(regi)) csere = jel(uj); // nem fizetett: csak nem fizetettet ir felul, es nem direktet; fizetettet SOHA
    if (csere) mIr(uj);
    var nt = navTipus();
    if (fizetett(uj) && rk !== 'belso' && nt !== 'reload' && nt !== 'back_forward') lptKuld(uj, er.kv); // a szerver ugyanazt a kattintast nem frissiti ujra
    else if (!fizetett(uj) && rk !== 'belso' && nt !== 'reload' && nt !== 'back_forward') vidOrganikusKuld(uj); // #495: organikus / direkt visszateres, napi 1x
    latogatasFrissit();
  }
  function latogatasFrissit() { var o = forrasOlvas(); if (o) lIr(o); } // minden oldalmegtekintes, amig van erintes, 2 orara megujitja a latogatas-tarolot
  // a hozzajarulas valtozasa: megadva -> a jelenlegi oldal erkezese most kerul rogzitesre; visszavonva / elutasitva -> a tarolt erintes torlodik, a szerver torli a sutit
  function lptValtozott() {
    if (!LPT_HOST) return;
    if (engedely()) { erkezesFeldolgoz(); return; }
    if (elutasitva()) { forrasTorol(); lptTorolKuld(); }
  }
  // a foglalo-atadasnal a sutibol potolt kattintasi parameterek TIPUSAI (sessionStorage, ugyanaz a lap-munkamenet): a koszonooldali jelzes viszi (klikk_potolt)
  function lptJelol(kulcsok) {
    try {
      if (!engedely()) return;
      var l = []; (kulcsok || []).forEach(function (k) { if (KP.indexOf(k) >= 0 && l.indexOf(k) < 0) l.push(k); });
      // "kulcs:suti-kattintasi-ido" (a GET-valasz t mezoje); ido nelkul csak a kulcs
      if (l.length) sessionStorage.setItem(F_POTLAS, l.map(function (k) { return lpt.t ? k + ':' + lpt.t : k; }).join(',')); else sessionStorage.removeItem(F_POTLAS);
    } catch (e) { /* nem baj */ }
  }
  function lptPotlasOlvas() {
    var o = [];
    try { if (!engedely()) return o; String(sessionStorage.getItem(F_POTLAS) || '').split(',').forEach(function (e) { var k = e.split(':')[0]; if (KP.indexOf(k) >= 0 && o.indexOf(k) < 0) o.push(k); }); } catch (e) { /* nem baj */ }
    return o;
  }

  // --- a sutibol (a szerverrol, GET) visszanyert kattintasazonositok: egyszer kerjuk le (a foglalo megnyitasakor), a memoriaban tartjuk; az atadas (handoff) a MAR MEGJOTT eredmenyt hasznalja, nem var ra ---
  var lpt = { inditva: false, kesz: false, klikk: {}, t: null, ig: null }; // t: a suti kattintasi ideje (a GET-valaszbol)
  function lptInditas() {
    if (lpt.inditva) return lpt.ig;
    lpt.inditva = true;
    lpt.ig = new Promise(function (ok) {
      var vege = function (k) { lpt.klikk = k || {}; lpt.kesz = true; ok(lpt.klikk); };
      try {
        if (!LPT_HOST || typeof fetch !== 'function') { vege({}); return; }
        setTimeout(function () { if (!lpt.kesz) vege({}); }, 6000);
        fetch('/api/mosaic-forras', { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            var k = {}, s = j && j.ok === true && j.klikk && typeof j.klikk === 'object' ? j.klikk : {}, tv = Number(j && j.t);
            lpt.t = Number.isInteger(tv) && tv > 1600000000 && tv <= ma() + 300 ? tv : null;
            KP.forEach(function (p) { if (typeof s[p] === 'string' && MINTA[p].test(s[p])) k[p] = s[p]; });
            if (lpt.t && ma() - lpt.t > POTLAS_MP) k = {}; // vedelem: a 7 napnal regebbi kattintas azonositoja nem potlas (a szerver mar nem adja)
            vege(k);
          }).catch(function () { vege({}); });
      } catch (e) { vege({}); }
    });
    return lpt.ig;
  }
  /** A sutibol visszanyert azonositok ({gclid?, gbraid?, wbraid?, fbclid?, ttclid?} vagy {}). Az elso hivas inditja a lekerest; marketing-engedely nelkul / elutasitas utan {} (nem is keri le). */
  function lptKlikk() {
    var o = {};
    try { if (!engedely()) return o; lptInditas(); for (var k in lpt.klikk) o[k] = lpt.klikk[k]; } catch (e) { /* nincs adat */ }
    return o;
  }
  /** Promise: a lekeres eredmenye (legfeljebb 6 mp utan {}); tesztekhez es ellenorzesekhez. */
  function lptKlikkVar() {
    try { if (!engedely()) return Promise.resolve({}); return lptInditas().then(function () { return lptKlikk(); }); } catch (e) { return Promise.resolve({}); }
  }
  /**
   * Az osszevont kattintasazonositok a foglalo koszonooldal-atadasahoz: a BONGESZOBOL jovo elsobbseget elvez (Google: az URL / mh_attr / _gcl_aw / _gcl_gb = googleAzonositok(), valtozatlanul; Meta: az URL / mh_attr fbclid,
   * tartalekban a _fbc suti; TikTok: az URL / mh_attr ttclid - Meta / TikTok csak <= 7 napos kattintas), a sutibol (lptKlikk, <= 7 napos kattintas) csak az a platform potlodik, amelyikhez a bongeszobol NEM jott azonosito. -> { ids: { gclid?.. ttclid? }, lpt: [a sutibol potolt kulcsok] }
   * Hozzajarulas nelkul / elutasitas utan ures (ugyanaz a kapu, mint a googleAzonositok()-nal). Csak olvas.
   */
  function klikkReszletes() {
    var ids = {}, lp = [];
    try {
      if (!engedely()) return { ids: ids, lpt: lp };
      var g = googleAzonositok(), most = ma();
      for (var gk in g) ids[gk] = g[gk];
      // Meta / TikTok: a click-through ablakuk 7 nap -> csak <= 7 napos (ts) azonosito; a Google ag (googleAzonositok: mh_attr 90 nap, _gcl_aw) VALTOZATLAN
      var mt = allapot.meta, fb = mt && mt.fbclid;
      if (fb && MINTA.fbclid.test(fb) && mt.ts && most - mt.ts <= POTLAS_MP) ids.fbclid = fb;
      else {
        var fbc = suti('_fbc'), fm = fbc && fbc.match(/^fb\.[0-2]\.(\d{10,13})\.([A-Za-z0-9_-]{8,200})$/), fsec = fm && (fm[1].length >= 13 ? Math.floor(Number(fm[1]) / 1000) : Number(fm[1]));
        if (fm && most - fsec <= POTLAS_MP) ids.fbclid = fm[2]; // az _fbc ideje a kattintas (vagy a Pixel betoltesenek) ideje
      }
      var tk = allapot.tiktok && allapot.tiktok.ttclid;
      if (tk && tk.ertek && MINTA.ttclid.test(tk.ertek) && tk.ts && most - tk.ts <= POTLAS_MP) ids.ttclid = tk.ertek;
      var s = lptKlikk(), googleVan = !!(ids.gclid || ids.gbraid || ids.wbraid);
      KP.forEach(function (k) {
        if (!s[k] || ids[k]) return;
        if ((k === 'gclid' || k === 'gbraid' || k === 'wbraid') && googleVan) return; // a Google egy azonositot fogad el: a bongeszobol jovo elsobbseget elvez
        ids[k] = s[k]; lp.push(k);
        if (k === 'gclid' || k === 'gbraid' || k === 'wbraid') googleVan = true;
      });
    } catch (e) { /* nincs adat */ }
    return { ids: ids, lpt: lp };
  }
  function klikkAzonositok() { return klikkReszletes().ids; }

  try { erkezesFeldolgoz(); } catch (e) { /* a forras-meres hibaja sosem akadalyozhatja az oldalt */ }

  w.mhAttribucio = { pillanatkep: pillanatkep, hozzajarulas: hozzajarulas, kuld: kuld, googleAzonositok: googleAzonositok, lptKlikk: lptKlikk, lptKlikkVar: lptKlikkVar, klikkAzonositok: klikkAzonositok, klikkReszletes: klikkReszletes, lptJelol: lptJelol };
})();
