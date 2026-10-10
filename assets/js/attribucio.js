// QA-2 ERKEZESI ADATOK (DECISION-LOG #99 3. pont): a latogato erkezesi adatainak sajat (first-party) tarolasa, hogy a szerver-oldali meres (Meta CAPI, TikTok Events API, Google, GA4)
// a foglalashoz / vasarlashoz hozza tudja kotni. NEM mero-kod: nem tolt be kulso szkriptet, nem kuld semmit harmadik felnek; csak a sajat /api/meres-erkezes vegpontunkra ir (azonos eredet).
//   - PLATFORMONKENT KULON utolso kattintas + idobelyeg: Google (gclid / gbraid / wbraid, mind kulon), Meta (fbclid -> fbc), TikTok (ttclid)
//   - ELSO es UTOLSO erintes UTM-je (utm_elso: soha nem irodik felul; utm_utolso: minden uj UTM-es erkezesnel)
//   - _fbp, _ttp (a Meta- / TikTok-pixel sutije; csak OLVASSUK, mi nem hozunk letre sutit), GA4 client_id (_ga) + session_id (_ga_<mero-azonosito>)
//   - hozzajarulas: a suti.js dontese (mh_cc) - a szerver SZ-38 szerint hasznalja (Meta / TikTok hozzajarulas nelkul is, Google / GA4 a valos jel szerint)
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

  function olvas() {
    try { var o = JSON.parse(localStorage.getItem(KULCS)); if (o && o.v === 1) return o; } catch (e) { /* privat ablak / tiltott tarolo */ }
    return { v: 1 };
  }
  function ment(o) { try { localStorage.setItem(KULCS, JSON.stringify(o)); } catch (e) { /* nem baj: a memoriabeli pillanatkep akkor is megvan */ } }
  function suti(nev) {
    try { var m = d.cookie.match(new RegExp('(?:^|;\\s*)' + nev.replace(/[^\w-]/g, '') + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; }
  }

  // az uj kattintas / UTM az URL-bol; a regi (>90 nap) kattintas eldobva
  var allapot = olvas(), t = ma();
  ['google', 'meta', 'tiktok'].forEach(function (p) { var o = allapot[p]; if (o && o.ts && t - o.ts > TTL) delete allapot[p]; });
  try {
    var q = new URLSearchParams(location.search);
    ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { var v = q.get(k); if (v && MINTA[k].test(v)) { allapot.google = allapot.google || {}; allapot.google[k] = { ertek: v, ts: t }; } });
    var fb = q.get('fbclid'); if (fb && MINTA.fbclid.test(fb)) allapot.meta = { fbclid: fb, ts: t };
    var tt = q.get('ttclid'); if (tt && MINTA.ttclid.test(tt)) allapot.tiktok = { ttclid: { ertek: tt, ts: t } };
    var utm = {}, van = false;
    UTM.forEach(function (k) { var v = q.get('utm_' + k); if (v) { utm[k] = String(v).slice(0, 120); van = true; } });
    if (van) { utm.ts = t; allapot.utm_utolso = utm; if (!allapot.utm_elso) allapot.utm_elso = JSON.parse(JSON.stringify(utm)); }
  } catch (e) { /* hibas URL: nincs uj adat */ }
  ment(allapot);

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
    var a = olvas(), o = {};
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
  function kuld(o) {
    try {
      var jel = 'mhAttrKuldve:' + o.source_id;
      try { if (sessionStorage.getItem(jel)) return Promise.resolve({ allapot: 'mar_kuldve' }); } catch (e) { /* privat mod */ }
      var body = Object.assign({}, o, { attr: pillanatkep(), hozz: hozzajarulas(), oldal: location.origin + location.pathname });
      w.mhAttribucioEredmeny = { source_id: o.source_id, allapot: 'kuldve', kuldott: body };
      return fetch('/api/meres-erkezes', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', keepalive: true, body: JSON.stringify(body) })
        .then(function (r) {
          return r.json().catch(function () { return null; }).then(function (j) {
            w.mhAttribucioEredmeny = { source_id: o.source_id, allapot: 'valasz', status: r.status, valasz: j, kuldott: body };
            if (r.ok) { try { sessionStorage.setItem(jel, '1'); } catch (e) { /* nem baj */ } }
            return w.mhAttribucioEredmeny;
          });
        }).catch(function (e) { w.mhAttribucioEredmeny = { source_id: o.source_id, allapot: 'hiba', hiba: String(e && e.message || e).slice(0, 80) }; return w.mhAttribucioEredmeny; });
    } catch (e) { return Promise.resolve({ allapot: 'hiba' }); }
  }
  w.mhAttribucio = { pillanatkep: pillanatkep, hozzajarulas: hozzajarulas, kuld: kuld };
})();
