// Az /arlista oldal szuroje es keresoje (foglalas/arlista.html; a tools/arlista-oldal.mjs generalja az oldalt, docs/ARLISTA.md).
//  - a chipek uzletagra szurnek (oldalfrissites nelkul); az URL #uzletag-azonositoja (pl. /arlista#szortelenites) is ezt valasztja ki;
//  - a kereso minden uzletagban keres (ekezet- es kisbetu-fuggetlenul), az ures csoportokat / szekciokat elrejti;
//  - a fodraszat szekcioban a "Noel (-20%)" kapcsolo a Noel kedvezmenyes arait mutatja (az arak a HTML-ben vannak, itt csak atkapcsol);
//  - a szuro-sav a fejlec alatt letapad (a fejlec magassagat meri).
// Az URL-t NEM irjuk (nincs history.pushState / replaceState / hash-valtas), hogy a GTM "History Change" triggerei ne induljanak; a bejovo #hash-t olvassuk.
// JS nelkul minden uzletag latszik, a chipek a szekciokra ugranak (horgonyok), a Noel-kapcsolo rejtve marad.
(function () {
  'use strict';
  var doc = document;
  var html = doc.documentElement;
  var szekciok = [].slice.call(doc.querySelectorAll('[data-arl-szekcio]'));
  if (!szekciok.length) return;
  var szuro = doc.getElementById('arl-szuro');
  var sav = doc.getElementById('arl-szuro-sav');
  var chipek = [].slice.call(doc.querySelectorAll('.arl-chip'));
  var mezo = doc.getElementById('arl-q');
  var kiir = doc.getElementById('arl-talalat');
  var nincs = doc.getElementById('arl-nincs');
  var kozep = doc.getElementById('arak');
  html.classList.add('arl-js');

  // ---- a letapado sav helye: a fejlec magassaga ----
  function meretek() {
    var f = doc.getElementById('SITE_HEADER');
    var h = f ? Math.round(f.getBoundingClientRect().height) : 0;
    if (h > 30) html.style.setProperty('--arl-fej', h + 'px');
    if (szuro) { var s = Math.round(szuro.getBoundingClientRect().height); if (s > 30) html.style.setProperty('--arl-sav', s + 'px'); }
    jelzo();
  }
  function jelzo() {
    if (!sav || !szuro) return;
    var tobb = sav.scrollWidth > sav.clientWidth + 2 && sav.scrollLeft + sav.clientWidth < sav.scrollWidth - 2;
    szuro.classList.toggle('tobb', tobb);
  }
  meretek();
  window.addEventListener('resize', meretek);
  window.addEventListener('load', meretek);
  setTimeout(meretek, 500);
  setTimeout(meretek, 1800);
  if (sav) sav.addEventListener('scroll', jelzo, { passive: true });
  if (window.ResizeObserver) { var f0 = doc.getElementById('SITE_HEADER'); if (f0) new ResizeObserver(meretek).observe(f0); }

  // ---- kereso: normalizalas ----
  function norm(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* regi bongeszo: ekezetesen keresunk */ }
    return s.replace(/[őö]/g, 'o').replace(/[űü]/g, 'u').replace(/\s+/g, ' ');
  }
  var sorok = [];
  szekciok.forEach(function (sz, i) {
    var csop = sz.querySelector('.arl-fej h2');
    var szekcioSzoveg = norm(csop ? csop.textContent : '');
    [].forEach.call(sz.querySelectorAll('.arl-sor'), function (sor) {
      var cs = sor.closest('[data-arl-csoport]');
      var cim = cs ? cs.querySelector('.arl-csoport-cim') : null;
      sorok.push({ elem: sor, szekcio: i, csoport: cs, szoveg: norm(sor.textContent + ' ' + (cim ? cim.textContent : '')) + ' ' + szekcioSzoveg });
    });
  });

  var allapot = { szuro: 'mind' };

  function alkalmaz() {
    var q = norm(mezo ? mezo.value : '').trim();
    var szavak = q ? q.split(' ').filter(Boolean) : [];
    var db = 0;
    var szekcioDb = szekciok.map(function () { return 0; });
    sorok.forEach(function (s) {
      var talal = !szavak.length || szavak.every(function (sz) { return s.szoveg.indexOf(sz) > -1; });
      s.elem.hidden = !talal;
      if (talal) { db++; szekcioDb[s.szekcio]++; }
    });
    [].forEach.call(doc.querySelectorAll('[data-arl-csoport]'), function (cs) {
      cs.hidden = !!szavak.length && !cs.querySelector('.arl-sor:not([hidden])');
    });
    szekciok.forEach(function (sz, i) {
      var ide = szavak.length ? szekcioDb[i] > 0 : (allapot.szuro === 'mind' || allapot.szuro === sz.id);
      sz.hidden = !ide;
    });
    var aktivId = szavak.length ? 'mind' : allapot.szuro;
    chipek.forEach(function (c) {
      var be = c.getAttribute('data-szuro') === aktivId;
      c.classList.toggle('aktiv', be);
      if (be) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
    });
    if (kiir) kiir.textContent = szavak.length ? (db ? db + ' találat' : 'Nincs találat') : '';
    if (nincs) nincs.classList.toggle('latszik', !!szavak.length && db === 0);
  }

  function chipLathato(id) {
    var c = chipek.filter(function (x) { return x.getAttribute('data-szuro') === id; })[0];
    if (!c || !sav) return;
    var cel = c.offsetLeft - (sav.clientWidth - c.offsetWidth) / 2;
    try { sav.scrollTo({ left: cel, behavior: 'smooth' }); } catch (e) { sav.scrollLeft = cel; }
  }

  function tetejere() {
    if (!kozep) return;
    var fej = (parseInt(getComputedStyle(html).getPropertyValue('--arl-fej'), 10) || 88) + (parseInt(getComputedStyle(html).getPropertyValue('--arl-sav'), 10) || 62);
    var y = kozep.getBoundingClientRect().top + window.pageYOffset - fej - 4;
    if (window.pageYOffset > y) window.scrollTo(0, Math.max(0, y));
  }

  function beallit(id, gorgetes) {
    allapot.szuro = id;
    if (mezo && mezo.value) mezo.value = '';
    alkalmaz();
    chipLathato(id);
    if (gorgetes) tetejere();
  }

  chipek.forEach(function (c) {
    c.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // uj lapon nyitas: a #hash az uj lapon valaszt
      e.preventDefault();
      beallit(c.getAttribute('data-szuro'), true);
    });
  });

  // ---- kereso ----
  var idozito = 0;
  if (mezo) {
    mezo.addEventListener('input', function () { clearTimeout(idozito); idozito = setTimeout(function () { alkalmaz(); if (mezo.value) chipLathato('mind'); }, 90); });
    mezo.addEventListener('search', alkalmaz);
    mezo.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
  }

  // ---- bejovo #hash: uzletag-azonosito (vagy egy sor azonositoja, pl. #paros) ----
  function hashbol() {
    var h = '';
    try { h = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { h = (location.hash || '').slice(1); }
    if (!h) return false;
    if (h === 'arak') { beallit('mind', false); return true; }
    var el = doc.getElementById(h);
    var sz = el && el.closest ? el.closest('[data-arl-szekcio]') : null;
    if (!sz) return false;
    beallit(sz.id, false);
    requestAnimationFrame(function () { try { el.scrollIntoView(); } catch (e) { /* nincs */ } });
    return true;
  }
  window.addEventListener('hashchange', hashbol);

  // ---- fodraszat: Noel kedvezmenyes arai ----
  [].forEach.call(doc.querySelectorAll('[data-arl-noel]'), function (doboz) {
    var sz = doboz.closest('[data-arl-szekcio]');
    if (!sz) return;
    doboz.hidden = false;
    [].forEach.call(doboz.querySelectorAll('[data-noel]'), function (gomb) {
      gomb.addEventListener('click', function () {
        var be = gomb.getAttribute('data-noel') === '1';
        sz.classList.toggle('noel', be);
        [].forEach.call(doboz.querySelectorAll('[data-noel]'), function (g) {
          var aktiv = g === gomb;
          g.classList.toggle('aktiv', aktiv);
          g.setAttribute('aria-pressed', aktiv ? 'true' : 'false');
        });
      });
    });
  });

  alkalmaz();
  hashbol();
})();
