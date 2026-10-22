// MOSAIC /hajvizsgalat-budapest - az oldal sajat, kis szkriptje. NEM mero-kod: nem toltok kulso mero-szkriptet, nem kuldok semmit harmadik felnek, nincs dataLayer-esemeny, nincs halozati kerese a gorgetesnek.
// Ketto dolgot csinal:
//   1) belso gorgetes-gombok ([data-gorget="<id>"], <button>): a hero Google-ertekelese a "Vendegeink velemenye" blokkra, a "Megnezem a terkepen" gomb a terkepes blokkra gorget.
//      NEM #horgony-link es NEM history-hivas: az URL nem valtozik (nincs pushState / replaceState / hash-valtas), mert a GTM "History Change" trigger minden hash- / history-valtozasra merest inditana
//      (lasd OXIGEN-LANDING.md; ugyanez a minta a hair-evelin-uj.js-ben). A cel fejlecere (h2 / h3, ha nincs: a celelemre) teszi a fokuszt (billentyuzet / kepernyoolvaso), gorgetes nelkul.
//   2) Google-terkep (#terkep): harmadik fel, ezert csak a funkcionalis sutik engedelyezese utan (suti.js: mhSuti), vagy a "Google terkep megjelenitese" gombra toltodik be.
// A mobil sticky CTA, a Trustindex-velemenyek, a video, a kezelok lapozoja az oxigen-landing.js (valtozatlan) dolga.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // --- 1) belso gorgetes (URL-valtozas nelkul) ---
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest('[data-gorget]');
    if (!g) return;
    const cel = $(g.getAttribute('data-gorget'));
    if (!cel) return;
    e.preventDefault();
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
    const fok = cel.querySelector('h2, h3') || cel;
    if (!fok.hasAttribute('tabindex')) fok.setAttribute('tabindex', '-1');
    try { fok.focus({ preventScroll: true }); } catch (hiba) { /* nem fokuszalhato */ }
  });

  // --- 2) Google-terkep ---
  const terkepBetolt = () => {
    const t = $('terkep');
    if (!t || t.querySelector('iframe')) return;
    const f = document.createElement('iframe');
    f.title = 'Térkép: MOSAIC, 1023 Budapest, Bécsi út 2.';
    f.loading = 'lazy';
    f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://www.google.com/maps?q=' + encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed';
    t.prepend(f);
    const h = $('terkep-hely');
    if (h) h.remove();
  };
  if ($('terkep')) {
    const gomb = $('terkep-gomb');
    if (gomb) gomb.addEventListener('click', terkepBetolt);
    if (window.mhSuti) {
      try { if (window.mhSuti.engedely('fun')) terkepBetolt(); window.mhSuti.figyel((d) => { if (d && d.fun) terkepBetolt(); }); } catch (hiba) { /* a suti-kezelo nem valaszol: a gomb marad */ }
    }
  }
})();
