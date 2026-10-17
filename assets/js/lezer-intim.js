// MOSAIC INTIM lezeres szortelenites (/intim-lezeres-szortelenites-budapest) - az oldal sajat, kis szkriptje.
// NEM mero-kod: nem toltenek kulso szkriptet, nem kuldenek semmit harmadik felnek, nincs dataLayer-esemeny. Ketto dolgot csinal:
//   1) mobil sticky CTA (csak telefonon latszik, lasd a lezer-landing.css .sticky-cta szabalyait): a hero foglalo-gombjainak elgorgetese utan jon be, a zaro (#foglalas) szekciotol eltunik
//   2) az orvosi ajanlas videoja (a /lezeres-szortelenites-budapest videoja, 8 MB): kattintasra toltodik be, addig a poszter latszik
// A foglalo-gombok ketto, szimpla /foglalo-motor?... linkek: a foglalo-reteget (booking-launcher.js) a build teszi az oldalra, a kattintast az kezeli.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  // --- mobil sticky CTA ---
  var sticky = $('sticky-cta'), hero = document.querySelector('.in-hero-cta'), zaro = $('foglalas');
  if (sticky && hero && zaro) {
    var ido = 0;
    var frissit = function () {
      ido = 0;
      var tulVan = hero.getBoundingClientRect().bottom <= 0;           // a hero foglalo-gombjai mar elgorgetve
      var vegen = zaro.getBoundingClientRect().top < window.innerHeight; // a zaro szekcio kepernyon van (vagy mar elhagytuk): ott maga a szekcio a cel
      var lat = tulVan && !vegen;
      sticky.classList.toggle('lathato', lat);
      sticky.setAttribute('aria-hidden', lat ? 'false' : 'true');
      Array.prototype.forEach.call(sticky.querySelectorAll('a'), function (a) { if (lat) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1'); });
      document.body.classList.toggle('sticky-be', lat);
    };
    var kesleltet = function () { if (!ido) ido = window.requestAnimationFrame(frissit); };
    window.addEventListener('scroll', kesleltet, { passive: true });
    window.addEventListener('resize', kesleltet);
    frissit();
  }

  // --- orvosi videó: kattintasra ---
  Array.prototype.forEach.call(document.querySelectorAll('.video-kartya[data-video]'), function (zv) {
    zv.addEventListener('click', function () {
      var poszter = zv.querySelector('img');
      var v = document.createElement('video');
      v.controls = true; v.autoplay = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
      if (poszter) v.poster = poszter.getAttribute('src');
      v.setAttribute('aria-label', zv.getAttribute('data-cim') || 'Videó');
      var s = document.createElement('source'); s.src = zv.getAttribute('data-video'); s.type = 'video/mp4'; v.appendChild(s);
      var hely = document.createElement('div'); hely.className = 'video-kartya'; hely.appendChild(v);
      zv.replaceWith(hely);
      var p = v.play(); if (p && p.catch) p.catch(function () { /* a vezerlokkel inditja */ });
    }, { once: true });
  });
})();
