// MOSAIC Head Spa - az ANGOL oldal (/headspa-budapest-hungary) kiegeszito szkriptje.
// A kozos headspa-oldal.js a felugro video-lejatszot es a Google terkepet magyar feliratokkal hozza letre ("Videó", "Bezárás", "Térkép: ..."):
// ezeket angolra cserli, amint megjelennek (a kozos fajl valtozatlan marad). Mast nem csinal, es nem kuld meresi esemenyt.
(() => {
  'use strict';
  const FORDITAS = { 'Videó': 'Video', 'Bezárás': 'Close' };
  const javit = (e) => {
    if (!(e instanceof Element)) return;
    for (const x of [e, ...e.querySelectorAll('[aria-label], iframe[title]')]) {
      const al = x.getAttribute('aria-label');
      if (al && FORDITAS[al]) x.setAttribute('aria-label', FORDITAS[al]);
      if (x.tagName === 'IFRAME' && /^Térkép:/.test(x.getAttribute('title') || '')) x.setAttribute('title', x.getAttribute('title').replace(/^Térkép:/, 'Map:'));
    }
  };
  new MutationObserver((lista) => { for (const m of lista) for (const e of m.addedNodes) javit(e); }).observe(document.body, { childList: true, subtree: true });
})();
