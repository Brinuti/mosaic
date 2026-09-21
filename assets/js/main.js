/* MOSAIC Head Spa - interaktiv elemek (mobil menu, GYIK, video lightbox) */
(function () {
  'use strict';

  var doc = document;

  /* --- mobil menu ------------------------------------------------------ */
  var toggle = doc.querySelector('.nav-toggle');
  var scrim = doc.querySelector('.nav-scrim');

  function closeNav() {
    doc.body.classList.remove('nav-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = doc.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  if (scrim) scrim.addEventListener('click', closeNav);

  /* almenu nyitasa mobilon (desktopon hoverrel nyilik) */
  doc.querySelectorAll('.has-sub > a').forEach(function (link) {
    link.addEventListener('click', function (e) {
      if (window.matchMedia('(max-width: 980px)').matches) {
        e.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });

  /* --- GYIK harmonika --------------------------------------------------- */
  doc.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var open = item.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* --- video lightbox --------------------------------------------------- */
  var box = doc.querySelector('.lightbox');
  var boxInner = box && box.querySelector('.lightbox-body');

  function closeBox() {
    if (!box) return;
    box.classList.remove('open');
    if (boxInner) boxInner.innerHTML = '';
  }

  if (box) {
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lightbox-close')) closeBox();
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeBox(); closeNav(); }
    });
  }

  doc.querySelectorAll('[data-video]').forEach(function (el) {
    el.addEventListener('click', function () {
      if (!box || !boxInner) return;
      var v = doc.createElement('video');
      v.src = el.getAttribute('data-video');
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      boxInner.appendChild(v);
      box.classList.add('open');
    });
  });

  /* --- aktualis ev a lablecben ----------------------------------------- */
  var yr = doc.querySelector('[data-year]');
  if (yr) yr.textContent = new Date().getFullYear();
})();
