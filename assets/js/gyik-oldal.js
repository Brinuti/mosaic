// A /gyik oldal keresoje: gepeles kozben szuri a kerdeseket (ekezet- es kisbetu-fuggetlenul), elrejti az ures szekciokat, a keves talalatot kinyitja.
// Mukodik JS nelkul is (akkor minden kerdes latszik, a harmonika nativ <details>).
(function () {
  'use strict';
  var mezo = document.getElementById('gy-q');
  if (!mezo) return;
  var kiir = document.getElementById('gy-talalat');
  var nincs = document.getElementById('gy-nincs');
  var szekciok = [].slice.call(document.querySelectorAll('[data-gy-szekcio]'));
  var chipek = [].slice.call(document.querySelectorAll('.gy-chips a'));
  var tetelek = [];
  szekciok.forEach(function (sz, i) {
    [].forEach.call(sz.querySelectorAll('details'), function (d) {
      tetelek.push({ elem: d, szekcio: i, szoveg: norm(d.textContent) });
    });
  });
  function norm(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* regi bongeszo: ekezetesen keresunk */ }
    return s.replace(/[őö]/g, 'o').replace(/[űü]/g, 'u').replace(/\s+/g, ' ');
  }
  var idozito = 0;
  function szur() {
    var q = norm(mezo.value).trim();
    var szavak = q.split(' ').filter(Boolean);
    var db = 0, szekciobanDb = szekciok.map(function () { return 0; });
    tetelek.forEach(function (t) {
      var talal = !szavak.length || szavak.every(function (sz) { return t.szoveg.indexOf(sz) > -1; });
      t.elem.hidden = !talal;
      if (talal) { db++; szekciobanDb[t.szekcio]++; }
    });
    var keves = szavak.length && db > 0 && db <= 6;
    tetelek.forEach(function (t) { if (szavak.length) t.elem.open = !!keves && !t.elem.hidden; });
    szekciok.forEach(function (sz, i) {
      sz.hidden = !!szavak.length && szekciobanDb[i] === 0;
      var jelzo = sz.querySelector('.gy-db');
      var osszes = sz.querySelectorAll('details').length;
      if (jelzo) jelzo.textContent = szavak.length ? szekciobanDb[i] + ' / ' + osszes + ' találat' : osszes + ' kérdés';
    });
    chipek.forEach(function (c, i) { c.style.display = szavak.length && szekciobanDb[i] === 0 ? 'none' : ''; });
    if (kiir) kiir.textContent = szavak.length ? (db ? db + ' találat' : 'Nincs találat') : '';
    if (nincs) nincs.classList.toggle('latszik', !!szavak.length && db === 0);
  }
  mezo.addEventListener('input', function () { clearTimeout(idozito); idozito = setTimeout(szur, 90); });
  mezo.addEventListener('search', szur);
  mezo.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
})();
