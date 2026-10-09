// A MOSAIC Google-ertekeleseinek SZAMA minden oldalon az AKTUALIS (a Trustindex-widget adata), a beegetett (regi) szamok helyett (a tulajdonos kerese, 2026-10-09).
//
// A build (tools/netlify-build.mjs) ezt a szkriptet minden olyan oldalra felteszi, ahol "<szam> ... Google-velemeny / ertekeles / velemeny" jellegu szoveg van
// (kiveve a Melitta / PMU-specifikus foglalo oldalakat). A HTML-ben levo szam a tartalek (JS nelkul / a lekeres elott azt latni); a szkript:
//   1) az aktualis darabszamot a Trustindex-widget tartalmabol olvassa (ugyanaz a forras, mint a landingek sajat szkriptjei), 6 oraig tarolja a bongeszoben;
//   2) a szovegben (szoveg-csomopontok) es az aria-label / title / alt attributumokban a "<szam> [db] Google-velemeny / Google-ertekeles / vendegvelemeny /
//      valodi ertekeles / Google reviews / velemeny / ertekeles" mintaban a szamot kicsereli (a tagolas megmarad: 1.266 / 1 266 / 1,266 / 1266, a "+" jel is);
//   3) a kifejezett jelolok (data-gv-szam / data-ertekeles-db / #te-db-m: az elem szovege csak a szam) szamat is cseréli;
//   4) a kesobb (JS-sel) megjeleno szovegeket is ujra atnezi (rovid ideig).
// Kihagyas: data-gv-ki az elemen (vagy szulojen), <script>, <style>, <textarea>, <input>. Kitalalt szam nincs: ha a lekeres nem sikerul, a tartalek marad.
(function () {
  'use strict';
  var TI = 'https://cdn.trustindex.io/widgets/8a/8a7562c424f027774456be130a1/content.html';
  var KULCS = 'mh_gv_db', TARTAS = 6 * 3600 * 1000, MIN = 800, MAX = 50000;
  var KULCSSZO = '(?:db\\s+)?(?:Google[- ](?:v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)|Google reviews|vend[eé]gv[eé]lem[eé]ny|val[oó]di [eé]rt[eé]kel[eé]s|v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)';
  var MINTA = new RegExp('(\\d{1,2}[.,\\u00a0 \\u202f]\\d{3}|\\d{3,5})(\\+?\\s*' + KULCSSZO + ')', 'gi');
  var db = 0;

  function formaz(n, minta) {
    var s = String(n);
    if (/^\d{1,2}\.\d{3}$/.test(minta)) return s.replace(/(\d)(\d{3})$/, '$1.$2');
    if (/^\d{1,2},\d{3}$/.test(minta)) return s.replace(/(\d)(\d{3})$/, '$1,$2');
    var m = minta.match(/^\d{1,2}([   ])\d{3}$/);
    if (m) return s.replace(/(\d)(\d{3})$/, '$1' + m[1] + '$2');
    return s;
  }
  function csere(szoveg) {
    return szoveg.replace(MINTA, function (mind, szam, utana) { return formaz(db, szam) + utana; });
  }
  // Kifejezett jelolok: az elem szovege CSAK a szam (+ "+"): data-gv-szam, a landingek data-ertekeles-db jelzese, az oxigen #te-db-m
  function kifejezett(gyoker) {
    Array.prototype.forEach.call((gyoker || document).querySelectorAll('[data-gv-szam],[data-ertekeles-db],#te-db-m'), function (e) {
      var m = (e.textContent || '').match(/^\s*(\d{1,2}[.,\u00a0 \u202f]\d{3}|\d{3,5})(\+?)\s*$/); if (!m) return;
      var uj = formaz(db, m[1]) + m[2]; if (uj !== e.textContent.trim()) e.textContent = uj;
    });
  }
  function atnez(gyoker) {
    if (!db) return;
    kifejezett(gyoker);
    var bejaro = document.createTreeWalker(gyoker || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var sz = n.parentNode; if (!sz || /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(sz.nodeName)) return NodeFilter.FILTER_REJECT;
        if (sz.closest && sz.closest('[data-gv-ki]')) return NodeFilter.FILTER_REJECT;
        MINTA.lastIndex = 0; return MINTA.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var csomopontok = [], n;
    while ((n = bejaro.nextNode())) csomopontok.push(n);
    csomopontok.forEach(function (c) { var uj = csere(c.nodeValue); if (uj !== c.nodeValue) c.nodeValue = uj; });
    var elemek = (gyoker || document).querySelectorAll('[aria-label],[title],[alt]');
    Array.prototype.forEach.call(elemek, function (e) {
      if (e.closest && e.closest('[data-gv-ki]')) return;
      ['aria-label', 'title', 'alt'].forEach(function (a) {
        var v = e.getAttribute(a); if (!v) return;
        MINTA.lastIndex = 0; if (!MINTA.test(v)) return;
        var uj = csere(v); if (uj !== v) e.setAttribute(a, uj);
      });
    });
  }
  function kesz(n) {
    n = +n; if (!(n >= MIN && n <= MAX)) return;
    db = n; atnez();
    setTimeout(atnez, 1200); setTimeout(atnez, 3500);   // a JS-sel kesobb kirajzolt szovegek (pl. az ajandek-kartya motor) is
  }
  function tarolt() { try { var t = JSON.parse(localStorage.getItem(KULCS) || 'null'); return t && Date.now() - t.t < TARTAS ? t.n : 0; } catch (e) { return 0; } }
  function ment(n) { try { localStorage.setItem(KULCS, JSON.stringify({ n: n, t: Date.now() })); } catch (e) { /* privat mod */ } }
  function lekerSzam() {
    return fetch(TI, { credentials: 'omit' }).then(function (r) { return r.text(); }).then(function (t) {
      var d = new DOMParser().parseFromString(t, 'text/html'), a = d.querySelector('.ti-header .ti-rating-text a');
      var n = a ? +((a.textContent || '').replace(/\D/g, '')) : 0;
      if (n >= MIN && n <= MAX) { ment(n); return n; }
      return 0;
    });
  }
  function indul() {
    var t = tarolt(); if (t) { kesz(t); return; }
    lekerSzam().then(function (n) { if (n) kesz(n); }).catch(function () { /* a tartalek szam marad */ });
  }
  if (window.__mhGvTeszt) window.__mhGvTeszt({ MINTA: MINTA, csere: function (s, n) { db = n; return csere(s); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', indul); else indul();
})();
