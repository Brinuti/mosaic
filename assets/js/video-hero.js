// MOSAIC KOZOS videos hero - mukodes (2026-10-09). Az oldalak: / (fooldal), /head-spa-kedvezmeny, /paros-headspa-budapest. Hasznalat, szerkezet: docs/VIDEOS_HERO.md.
//
//  1. Hang nelkuli klipek (video[data-klip]): a hero hattere, a kartyak, savok hattere stb. Csak akkor toltodnek be es jatszanak, amikor a kepernyon vannak (IntersectionObserver);
//     a nyitokep (poster / .vh-hatter) addig latszik. A hero klipje (.vh-video) az oldal betoltese (a hero kepe, legfeljebb 3 mp) utan indul, es beuszik a nyitokep fole.
//     CSOKKENTETT MOZGAS (prefers-reduced-motion) vagy ADATTAKAREKOS / LASSU kapcsolat (saveData, 2g / 3g) eseten egyetlen klip sem toltodik be: csak a nyitokepek latszanak.
//  2. Play gomb + NAGY lejatszo-ablak: a [data-nagyvideo="<mp4>"] gomb (opcionalis data-cim) a hangos videot felugro <dialog>-ban nyitja, vezerlokkel; a fajl csak ekkor toltodik be.
//     Az ablak elso hasznalatkor jon letre (nem kell hozza HTML). Bezaras: X gomb, hatterre kattintas, Esc; utana a lathato klipek ujra indulnak.
//     Meres: az oldal maga figyeli a document 'vh:video' esemenyet (detail: { video, cim }), es kuldi a sajat dataLayer-esemenyet - ez a fajl nem tud oldalspecifikus nevekrol.
//  Az oldalak sajat JS-e nem nyul ezekhez (a klip-inditas / a nagy ablak csak itt van).
(() => {
  'use strict';

  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const kapcsolat = navigator.connection || {};
  const lassu = !!(kapcsolat.saveData || /(^|-)2g$|^3g$/.test(kapcsolat.effectiveType || ''));
  const mozgas = !csokkentett && !lassu;
  const $ = (sel, gyoker = document) => gyoker.querySelector(sel);

  // --- 1. klipek: lusta betoltes + inditas, csak a lathatok jatszanak ---------------------------------------------------------------
  const lathatok = new Set();
  function klipInditas() {
    const klipek = [...document.querySelectorAll('video[data-klip]')];
    if (!mozgas || !('IntersectionObserver' in window)) return;
    const indit = (v) => {
      if (!v.getAttribute('src')) { v.preload = 'auto'; v.src = v.dataset.klip; }
      const p = v.play();
      if (p && p.catch) p.catch(() => { /* a bongeszo nem engedte: a nyitokep marad */ });
    };
    const fig = new IntersectionObserver((tetelek) => {
      for (const t of tetelek) {
        if (t.isIntersecting) { lathatok.add(t.target); indit(t.target); } else { lathatok.delete(t.target); t.target.pause(); }
      }
    }, { rootMargin: '120px 0px', threshold: 0.2 });
    for (const v of klipek) {
      if (v.classList.contains('vh-video')) v.addEventListener('playing', () => v.classList.add('lejatszik'), { once: true });
      fig.observe(v);
    }
  }
  // a hero kepe (LCP) elobb: a klipek akkor indulnak, amikor a hero kepe betoltott (legfeljebb 3 mp mulva akkor is): nem kell megvarni a lassu kulso elemeket (pl. Trustindex)
  let klipKezdve = false;
  const klipKezd = () => { if (klipKezdve) return; klipKezdve = true; klipInditas(); };
  const heroKep = $('.vh-hatter');
  if (heroKep && !heroKep.complete) {
    heroKep.addEventListener('load', klipKezd, { once: true });
    heroKep.addEventListener('error', klipKezd, { once: true });
    setTimeout(klipKezd, 3000);
  } else klipKezd();

  // --- 2. play gomb: NAGY lejatszo-ablak a hangos videonak ----------------------------------------------------------------------------
  let dlg = null, tart = null, lbGomb = null;
  function ablakKeszit() {
    dlg = document.createElement('dialog');
    dlg.className = 'vh-lb';
    dlg.setAttribute('aria-label', 'Videó');
    const be = document.createElement('button');
    be.type = 'button';
    be.className = 'vh-lb-be';
    be.setAttribute('aria-label', 'Bezárás');
    be.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    tart = document.createElement('div');
    tart.className = 'vh-lb-tartalom';
    dlg.append(be, tart);
    be.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target === tart) dlg.close(); });
    dlg.addEventListener('close', () => {
      tart.replaceChildren(); // a video leall, a fajl felszabadul
      if (lbGomb) lbGomb.focus({ preventScroll: true });
      lbGomb = null;
      if (mozgas) for (const v of lathatok) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    });
    document.body.append(dlg);
  }
  function nagyNyit(gomb) {
    const src = gomb.dataset.nagyvideo;
    if (!src) return;
    if (!dlg) {
      ablakKeszit();
      if (typeof dlg.showModal !== 'function') { dlg.remove(); dlg = null; location.href = src; return; } // nagyon regi bongeszo: maga a fajl nyilik meg
    }
    for (const v of document.querySelectorAll('video[data-klip]')) v.pause();
    const v = document.createElement('video');
    v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('aria-label', gomb.dataset.cim || 'Videó');
    const forras = document.createElement('source');
    forras.src = src; forras.type = 'video/mp4';
    v.append(forras);
    tart.replaceChildren(v);
    lbGomb = gomb;
    dlg.showModal();
    const p = v.play();
    if (p && p.catch) p.catch(() => { /* a vezerlokkel inditja */ });
    document.dispatchEvent(new CustomEvent('vh:video', { detail: { video: src, cim: gomb.dataset.cim || '' } }));
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest('[data-nagyvideo]');
    if (!g) return;
    e.preventDefault();
    nagyNyit(g);
  });

  window.mhVideoHero = { mozgas, csokkentett, lassu };
})();
