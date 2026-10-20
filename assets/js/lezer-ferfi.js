// MOSAIC lezeres szortelenites FERFIAKNAK (/vegleges-szortelenites-ferfiaknak) - az oldal sajat, kis szkriptje.
// NEM mero-kod: nem toltenek kulso szkriptet, nem kuldenek semmit harmadik felnek, nincs dataLayer-esemeny, nincs kulso halozati keres. Ket dolgot csinal:
//   1) belso gorgetes: a [data-gorget="<id>"] gombok (hero ertekeles-sor, "Mutasd az arakat", hely-sor, "Gorgess lejjebb") az oldalon belul a cel-elemhez gorgetnek.
//      NEM #horgony-linkek: a GTM "History Change" triggere minden hash-valtozasra merest inditana, ezert az URL nem valtozik (nincs pushState / replaceState / hash);
//      a cel fejlecere (h2) kerul a fokusz (billentyuzet / kepernyoolvaso), gorgetes nelkul.
//   2) a szalon-galeria ([data-galeria]): erintesre huzhato (CSS scroll-snap), asztalon nyilak, pottyos jelzo, billentyuzet (balra / jobbra / Home / End), aria-cimkek.
(function () {
  'use strict';
  var csokkentett = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- 1) belso gorgetes ---------------------------------------------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-gorget]');
    if (!g) return;
    var cel = document.getElementById(g.getAttribute('data-gorget'));
    if (!cel) return;
    e.preventDefault();
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
    var szekcio = cel.closest('section');
    var fej = cel.querySelector('h2') || (szekcio && szekcio.querySelector('h2'));
    if (fej) { fej.setAttribute('tabindex', '-1'); fej.focus({ preventScroll: true }); }
  });

  // --- 2) szalon-galeria ---------------------------------------------------------------------------------------------------------
  Array.prototype.forEach.call(document.querySelectorAll('[data-galeria]'), function (gal) {
    var sav = gal.querySelector('.fl-gal-sav');
    var kepek = sav ? Array.prototype.slice.call(sav.children) : [];
    if (!sav || kepek.length < 2) return;
    var elozo = gal.querySelector('.fl-gal-nyil.elozo'), kov = gal.querySelector('.fl-gal-nyil.kovetkezo');
    var pontok = gal.querySelector('.fl-gal-pontok'), allapot = gal.querySelector('.fl-gal-allapot');
    var lepes = function () { return kepek.length > 1 ? kepek[1].offsetLeft - kepek[0].offsetLeft : sav.clientWidth; };
    var latszik = function () { return Math.max(1, Math.round(sav.clientWidth / (lepes() || 1))); };
    var helyek = function () { return Math.max(1, kepek.length - latszik() + 1); };   // ahany "megallo" van (az utolso oldalon az utolso kep a jobb szelen)
    var aktiv = function () { return Math.min(helyek() - 1, Math.max(0, Math.round(sav.scrollLeft / (lepes() || 1)))); };
    var ide = function (i) {
      i = Math.min(helyek() - 1, Math.max(0, i));
      sav.scrollTo({ left: i * lepes(), behavior: csokkentett ? 'auto' : 'smooth' });
    };
    var pontEpit = function () {
      if (!pontok) return;
      var n = helyek();
      if (pontok.children.length === n) return;
      pontok.textContent = '';
      for (var i = 0; i < n; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'fl-gal-pont';
        b.setAttribute('aria-label', (i + 1) + '. kép');
        b.addEventListener('click', (function (k) { return function () { ide(k); }; })(i));
        pontok.appendChild(b);
      }
    };
    var frissit = function () {
      pontEpit();
      var a = aktiv(), n = helyek();
      if (elozo) elozo.disabled = sav.scrollLeft < 4;
      if (kov) kov.disabled = sav.scrollLeft + sav.clientWidth > sav.scrollWidth - 4;
      if (pontok) Array.prototype.forEach.call(pontok.children, function (p, i) { if (i === a) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current'); });
      if (allapot) allapot.textContent = (a + 1) + '. kép a(z) ' + kepek.length + ' közül' + (latszik() > 1 ? ' (több kép látszik egyszerre)' : '');
      void n;
    };
    var ido = 0;
    sav.addEventListener('scroll', function () { if (!ido) ido = window.requestAnimationFrame(function () { ido = 0; frissit(); }); }, { passive: true });
    window.addEventListener('resize', frissit);
    if (elozo) elozo.addEventListener('click', function () { ide(aktiv() - 1); });
    if (kov) kov.addEventListener('click', function () { ide(aktiv() + 1); });
    sav.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); ide(aktiv() - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); ide(aktiv() + 1); }
      else if (e.key === 'Home') { e.preventDefault(); ide(0); }
      else if (e.key === 'End') { e.preventDefault(); ide(helyek() - 1); }
    });
    frissit();
  });
})();
