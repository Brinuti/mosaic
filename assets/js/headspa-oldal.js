// MOSAIC Head Spa oldalak (headspa-budapest, headspa-arak-budapest, head-spa-kedvezmeny, headspa-termekek-oxygeni, head-spa-velemenyek) - mukodes.
//  1. Videok: a [data-video] gombok a sajat tarhelyrol (assets/video) egy felugro lejatszoban (<dialog>) inditjak a videot; csak kattintasra toltodik.
//  2. Korhinta (.korhinta): kep-sorozat gorgetheto savban, elozo / kovetkezo gombokkal.
//  3. Vendegertekelesek (Trustindex): MINDIG azonnal megjelennek (nincs hozzajarulas-kapu); a Google terkep harmadik fel: a "funkcionalis" sutik elfogadasa utan (vagy a gombra kattintva) toltodik be.
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
  // Racs-nezet (data-racs): a Trustindex-csuszka (100 kartya van a widgetben) helyett TOBB kartya latszik egyszerre (asztalon 3 oszlop x 3 sor, telefonon 4),
  // a "Meg tobb velemeny" gomb lepesenkent tovabbiakat mutat (legfeljebb 3x annyit). A widget sajat kinezete marad, csak az elrendezes valtozik.
  const RACS = !!(tiDoboz && tiDoboz.hasAttribute('data-racs'));
  const RACS_CSS = 'html body .ti-widget .ti-reviews-container{overflow:visible!important;height:auto!important}'
    + 'html body .ti-widget .ti-reviews-container-wrapper{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;transform:none!important;width:auto!important;height:auto!important;position:static!important;left:auto!important;margin:0!important;padding:0!important}'
    + 'html body .ti-widget .ti-review-item{position:static!important;left:auto!important;width:auto!important;max-width:none!important;margin:0!important;float:none!important;transform:none!important}'
    + 'html body .ti-widget .ti-controls,html body .ti-widget .ti-controls-line{display:none!important}'
    + 'html body .ti-widget .ti-widget-header{margin-bottom:16px!important}'
    + '@media (max-width:819px){html body .ti-widget .ti-reviews-container-wrapper{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    + '@media (max-width:519px){html body .ti-widget .ti-reviews-container-wrapper{grid-template-columns:1fr}}';
  let racsN = 0, racsMax = 0, racsLepes = 0;
  function trustindexBetolt() {
    if (!tiDoboz || tiBetoltve) return;
    tiBetoltve = true;
    const f = elem('iframe', { class: 'ti-keret', src: tiDoboz.dataset.embed, title: 'Google-vélemények (Trustindex)', loading: 'eager', scrolling: 'no' });
    let proba = 0, legnagyobb = 0;
    const racsFrissit = (d) => {
      const stilus = d.getElementById('hs-ti-db');
      if (stilus) stilus.textContent = 'html body .ti-widget .ti-review-item:nth-child(n+' + (racsN + 1) + '){display:none!important}';
      const db = d.querySelectorAll('.ti-review-item').length;
      const sor = $('ti-tobb-sor');
      if (sor) sor.hidden = !(db > racsN && racsN < racsMax);
    };
    const tobb = $('ti-tobb');
    if (RACS && tobb) tobb.addEventListener('click', () => {
      try { racsN = Math.min(racsN + racsLepes, racsMax); racsFrissit(f.contentDocument); meret(true); } catch (hiba) { /* a keret nem erheto el */ }
    });
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
        if (RACS && !d.getElementById('hs-ti-racs')) {
          const rs = d.createElement('style'); rs.id = 'hs-ti-racs'; rs.textContent = RACS_CSS; d.head.appendChild(rs);
          const db = d.createElement('style'); db.id = 'hs-ti-db'; d.head.appendChild(db);
          const sz = f.clientWidth || tiDoboz.clientWidth;
          racsLepes = sz >= 820 ? 9 : sz >= 520 ? 6 : 4;   // egy lepes = 3 oszlop x 3 sor / 2 x 3 / 4 kartya
          racsMax = racsLepes * 3;
          racsN = racsLepes;
          racsFrissit(d);
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
  if (tiDoboz) trustindexBetolt();   // a velemenyek MINDIG azonnal megjelennek (a tulajdonos kerese, 2026-10-07): nincs hozzajarulas-kapu
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
