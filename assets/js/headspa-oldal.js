// MOSAIC Head Spa oldalak (headspa-budapest, headspa-arak-budapest, head-spa-kedvezmeny, headspa-termekek-oxygeni, head-spa-velemenyek) - mukodes.
//  1. Videok: a [data-video] gombok a sajat tarhelyrol (assets/video) egy felugro lejatszoban (<dialog>) inditjak a videot; csak kattintasra toltodik.
//  2. Korhinta (.korhinta): kep-sorozat gorgetheto savban, elozo / kovetkezo gombokkal.
//  3. Vendegertekelesek (Trustindex) es Google terkep: harmadik fel, a "funkcionalis" sutik elfogadasa utan (vagy a gombra kattintva) toltodnek be.
//  4. Mobil sticky CTA: a hero elgorgetese utan jelenik meg, a helyszin szekcional (es utana) eltunik.
// A szkript nem kuld meresi esemenyt (a foglalas-gombok a /foglalo-motor linkek: a launcher es a motor kezeli oket).
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const elem = (tag, attr = {}, ...gyerekek) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)) { if (v === null || v === undefined) continue; if (k === 'szoveg') e.textContent = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); }
    e.append(...gyerekek.filter(Boolean));
    return e;
  };

  // --- 1. videok -------------------------------------------------------------------------------------------------------------------
  let modal = null;
  function modalNyit(gomb) {
    const src = gomb.dataset.video;
    if (!src) return;
    if (!modal) {
      modal = elem('dialog', { class: 'video-modal', 'aria-label': 'Videó' });
      const bezar = elem('button', { type: 'button', class: 'video-modal-bezar', 'aria-label': 'Bezárás', szoveg: '×' });
      bezar.addEventListener('click', () => modal.close());
      modal.append(bezar);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });   // a hatterre kattintas is bezar
      modal.addEventListener('close', () => { const v = modal.querySelector('video'); if (v) { v.pause(); v.remove(); } });
      document.body.append(modal);
    }
    modal.classList.toggle('fekvo', gomb.dataset.fekvo !== undefined);
    const v = elem('video', { controls: '', playsinline: '', preload: 'auto', src, poster: gomb.dataset.poster || null, 'aria-label': gomb.getAttribute('aria-label') || 'Videó' });
    modal.querySelector('video')?.remove();
    modal.append(v);
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    const lejatszas = v.play(); if (lejatszas && lejatszas.catch) lejatszas.catch(() => {});   // ha a bongeszo letiltja az automatikus inditast, a vezerlo gombbal indul
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest('[data-video]');
    if (!g) return;
    e.preventDefault();
    modalNyit(g);
  });

  // --- 2. korhinta -------------------------------------------------------------------------------------------------------------------
  for (const k of document.querySelectorAll('.korhinta')) {
    const sav = k.querySelector('.korhinta-sav');
    const elozo = k.querySelector('.korhinta-gomb.elozo'), kov = k.querySelector('.korhinta-gomb.kovetkezo');
    if (!sav) continue;
    const lep = (irany) => sav.scrollBy({ left: irany * Math.max(240, sav.firstElementChild ? sav.firstElementChild.getBoundingClientRect().width + 18 : 300), behavior: 'smooth' });
    const frissit = () => {
      if (elozo) elozo.disabled = sav.scrollLeft < 8;
      if (kov) kov.disabled = sav.scrollLeft + sav.clientWidth > sav.scrollWidth - 8;
    };
    if (elozo) elozo.addEventListener('click', () => lep(-1));
    if (kov) kov.addEventListener('click', () => lep(1));
    sav.addEventListener('scroll', () => requestAnimationFrame(frissit), { passive: true });
    addEventListener('resize', frissit);
    frissit();
  }

  // --- 3. vendegertekelesek (Trustindex) es Google terkep ------------------------------------------------------------------------------
  const tiDoboz = $('trustindex');
  let tiBetoltve = false;
  function trustindexBetolt() {
    if (!tiDoboz || tiBetoltve) return;
    tiBetoltve = true;
    const f = elem('iframe', { class: 'ti-keret', src: tiDoboz.dataset.embed, title: 'Google-vélemények (Trustindex)', loading: 'eager', scrolling: 'no' });
    let proba = 0, legnagyobb = 0;
    const meret = (nullaz) => {
      try {
        const d = f.contentDocument;
        const w = d && d.querySelector('.ti-widget');
        if (!w) return false;
        if (!d.getElementById('hs-ti-stilus')) {
          const st = d.createElement('style');
          st.id = 'hs-ti-stilus';
          st.textContent = '@font-face{font-family:"Jost";font-style:normal;font-weight:400 600;font-display:swap;src:url(/assets/fonts/jost-400-latin.woff2) format("woff2")}'
            + 'html body .ti-widget,html body .ti-widget *{font-family:"Jost","Helvetica Neue",Arial,sans-serif!important}'
            + 'html,body{overflow:hidden!important}'
            + 'html body div.ti-controls-line,html body .ti-widget .ti-controls-line{display:none!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;visibility:hidden!important}';
          d.head.appendChild(st);
        }
        const m = Math.ceil(w.getBoundingClientRect().bottom + (parseFloat(d.defaultView.getComputedStyle(d.body).marginBottom) || 0) + 16);
        if (m > 60 && (nullaz || m > legnagyobb)) { legnagyobb = m; f.style.height = m + 'px'; }
        return true;
      } catch (hiba) { return true; }
    };
    const ido = setInterval(() => { proba++; meret(); if (proba > 3600 || !f.isConnected) clearInterval(ido); }, 700);
    addEventListener('resize', () => meret(true));
    tiDoboz.replaceChildren(f);
  }
  if (tiDoboz) {
    $('ti-gomb').addEventListener('click', () => { if (window.mhSuti && window.mhSuti.enged) window.mhSuti.enged('fun'); trustindexBetolt(); });
    if (window.mhSuti) {
      if (window.mhSuti.engedely('fun')) trustindexBetolt();
      window.mhSuti.figyel((d) => { if (d.fun) trustindexBetolt(); });
    }
  }
  function terkepBetolt() {
    const t = $('terkep');
    if (!t || t.querySelector('iframe')) return;
    t.prepend(elem('iframe', {
      title: 'Térkép: MOSAIC, 1023 Budapest, Bécsi út 2.', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: 'https://www.google.com/maps?q=' + encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed',
    }));
    const h = $('terkep-hely');
    if (h) h.remove();
  }
  if ($('terkep')) {
    $('terkep-gomb').addEventListener('click', terkepBetolt);
    if (window.mhSuti) { if (window.mhSuti.engedely('fun')) terkepBetolt(); window.mhSuti.figyel((d) => { if (d.fun) terkepBetolt(); }); }
  }

  // --- 4. mobil sticky CTA: gorgetes-figyelo (nem IntersectionObserver: az gyors ugrasnal nem jelez) -------------------------------------
  const sticky = $('sticky-cta'), hero = document.querySelector('.hero, .oldal-fej'), vege = $('helyszin');
  if (sticky && hero) {
    let ido = 0;
    const frissit = () => {
      ido = 0;
      const tulVan = hero.getBoundingClientRect().bottom <= 0;
      const veg = vege ? vege.getBoundingClientRect().top < innerHeight : false;
      const lat = tulVan && !veg;
      sticky.classList.toggle('lathato', lat);
      sticky.setAttribute('aria-hidden', lat ? 'false' : 'true');
      sticky.querySelectorAll('a').forEach((a) => (lat ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
      document.body.classList.toggle('sticky-be', lat);
    };
    const kesleltet = () => { if (!ido) ido = requestAnimationFrame(frissit); };
    addEventListener('scroll', kesleltet, { passive: true });
    addEventListener('resize', kesleltet);
    frissit();
  }
})();
