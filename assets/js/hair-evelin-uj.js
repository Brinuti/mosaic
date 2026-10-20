// MOSAIC Hair - az Evelin-oldal UJ, hirdetesi valtozata (/noi-hajfestes-evelin-uj): belso gorgetes ("Terkep" / ertekeles-sor -> a helyszin-terkep / a Google-velemenyek blokkja).
//
// A tulajdonos kerese (2026-10-20): az ertekeles es a terkep SEHOL ne vigyen ki az oldalrol, hanem gorgessen az oldalon belul a megfelelo blokkra.
// A [data-gorget="<id>"] gombok (nem #horgony-linkek: a GTM History Change triggere minden hash-valtozasra merest inditana, ezert az URL nem valtozik) a cel-elemhez gorgetnek,
// es a cel fejlecere teszik a fokuszt (billentyuzet / kepernyoolvaso), gorgetes nelkul. NEM mero-kod: dataLayer-esemenyt nem kuld, kulso halozati kerese nincs.
(() => {
  'use strict';
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-gorget]');
    if (!g) return;
    const cel = document.getElementById(g.dataset.gorget);
    if (!cel) return;
    e.preventDefault();
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
    const fej = cel.querySelector('h2');
    if (fej) { fej.setAttribute('tabindex', '-1'); fej.focus({ preventScroll: true }); }
  });
})();
