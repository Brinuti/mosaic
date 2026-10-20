// MOSAIC /oxigenterapia-ferfiaknak - az oldal SAJAT, kis szkriptje (csak ezen az oldalon toltodik be). NEM mero-kod: nem kuld dataLayer-esemenyt, nem toltenek kulso szkriptet,
// nincs halozati kerese. Ketto dolgot csinal:
//
//  1) belso gorgetes (a tulajdonos kerese, 2026-10-20: az ertekeles, a terkep es az eredmenyek-link SEHOL ne vigyen ki az oldalrol, hanem az oldalon belul gorgessen):
//     a [data-gorget="<id>"] gombok (nem #horgony-linkek: a GTM History Change triggere minden hash-valtozasra merest inditana, ezert az URL NEM valtozik: nincs
//     pushState / replaceState / hash) a cel-szekciohoz gorgetnek, es a cel H2-jere teszik a fokuszt (tabindex=-1; billentyuzet / kepernyoolvaso), gorgetes nelkul.
//  2) lapozhato kep-galeria ([data-galeria], a felujitott szalon fotoi): erintesre huzhato (CSS scroll-snap), nyilak asztalon, pottyos jelzo, szamlalo, bal / jobb nyil
//     billentyu (Home / End is), aria-cimkek; a kepek lustan toltodnek, a keparany fix (CSS aspect-ratio), JS nelkul is gorgetheto.
(() => {
  'use strict';
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- 1) belso gorgetes ------------------------------------------------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest('[data-gorget]');
    if (!g) return;
    const cel = document.getElementById(g.getAttribute('data-gorget'));
    if (!cel) return;
    e.preventDefault();
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
    const fej = cel.querySelector('h2');
    if (fej) { fej.setAttribute('tabindex', '-1'); fej.focus({ preventScroll: true }); }
  });

  // --- 2) lapozhato galeria -----------------------------------------------------------------------------------------------------------------
  document.querySelectorAll('[data-galeria]').forEach((gal) => {
    const sav = gal.querySelector('.fgal-sav');
    const diak = sav ? [...sav.children] : [];
    if (!sav || diak.length < 2) return;
    const elozo = gal.querySelector('.lapozo.elozo'), kovetkezo = gal.querySelector('.lapozo.kovetkezo');
    const als = gal.querySelector('.fgal-als'), pontok = gal.querySelector('.fgal-pontok'), szamlalo = gal.querySelector('.fgal-szamlalo');
    const n = diak.length;
    let jelenlegi = 0;

    const lepes = () => (diak[1].offsetLeft - diak[0].offsetLeft) || sav.clientWidth;   // egy dia + a kozte levo hezag
    const lathato = () => Math.max(1, Math.round((sav.clientWidth + 1) / lepes()));      // hany dia latszik egyszerre (telefonon 1, asztalon 3)
    const veg = () => sav.scrollLeft + sav.clientWidth >= sav.scrollWidth - 3;
    const elsoIdx = () => Math.min(n - 1, Math.round(sav.scrollLeft / lepes()));          // az elso (balrol) latszo dia sorszama
    const frissit = () => {
      jelenlegi = veg() ? n - 1 : elsoIdx();
      const db = lathato();
      const elso = Math.min(jelenlegi, n - db);
      if (elozo) elozo.disabled = sav.scrollLeft < 3;
      if (kovetkezo) kovetkezo.disabled = veg();
      if (pontok) [...pontok.children].forEach((p, i) => { if (i === jelenlegi) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current'); });
      if (szamlalo) szamlalo.textContent = db > 1 ? (Math.max(0, elso) + 1) + '–' + Math.min(n, Math.max(0, elso) + db) + ' / ' + n : (jelenlegi + 1) + ' / ' + n;
    };
    const menj = (i, sima = true) => {
      const cel = Math.max(0, Math.min(n - 1, i));
      sav.scrollTo({ left: diak[cel].offsetLeft - diak[0].offsetLeft, behavior: sima && !csokkentett ? 'smooth' : 'auto' });
    };

    if (pontok) diak.forEach((d, i) => {
      const p = document.createElement('button');
      p.type = 'button';
      p.setAttribute('aria-label', (i + 1) + '. kép');
      p.addEventListener('click', () => menj(i));
      pontok.append(p);
    });
    if (elozo) { elozo.hidden = false; elozo.addEventListener('click', () => menj(elsoIdx() - 1)); }
    if (kovetkezo) { kovetkezo.hidden = false; kovetkezo.addEventListener('click', () => menj(elsoIdx() + 1)); }
    if (als) als.hidden = false;

    gal.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); menj(elsoIdx() - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); menj(elsoIdx() + 1); }
      else if (e.key === 'Home') { e.preventDefault(); menj(0); }
      else if (e.key === 'End') { e.preventDefault(); menj(n - 1); }
    });

    let kesz = true;
    sav.addEventListener('scroll', () => { if (kesz) { kesz = false; requestAnimationFrame(() => { kesz = true; frissit(); }); } }, { passive: true });
    addEventListener('resize', frissit);
    frissit();
  });
})();
