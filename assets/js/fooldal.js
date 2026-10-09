// MOSAIC főoldal (/) - működés.
//  0. Hero: közös videós hero (video-hero.js); a play gomb a hangos videót nagy ablakban nyitja.
//  1. Videók: a [data-video] kártyák a saját tárhelyről (assets/video) egy felugró lejátszóban (<dialog>) indítják a videót; csak kattintásra töltődik.
//  2. Körhinta ([data-korhinta]): oldalra görgethető sor előző / következő gombokkal.
//  3. Hatások-fülek (zsíros / száraz / hajhullás).
//  4. Vendégértékelések (Trustindex): MINDIG azonnal megjelennek (a tulajdonos kérése, 2026-10-07: nincs hozzájárulás-kapu); az értékelések száma a widget aktuális adata.
//     A Google térkép harmadik fél: a "funkcionális" sütik elfogadása után (vagy a gombra kattintva) töltődik be.
//  5. CTA-mérés (data-cta -> dataLayer, mint a többi landingen), görgetés URL-változás nélkül (a GTM "History Change" ne induljon), mobil sticky CTA.
// A foglalás-gombok /foglalo-motor linkek: a launcher és a motor kezeli őket (a szkript nem nyúl hozzájuk).
(() => {
  'use strict';

  // A saját keretében nyiltunk meg (a Salonic visszairányított): a suti.js már jelzett a szülőnek.
  try { if (window.top !== window.self && window.parent.location.hostname === location.hostname) return; } catch (e) { /* idegen keret */ }

  const $ = (id) => document.getElementById(id);
  const meres = (adat) => { (window.dataLayer = window.dataLayer || []).push(adat); };
  const elem = (tag, attr = {}, ...gyerekek) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)) { if (v === null || v === undefined || v === false) continue; if (k === 'szoveg') e.textContent = v; else e.setAttribute(k, v === true ? '' : v); }
    e.append(...gyerekek.filter(Boolean));
    return e;
  };
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const szam = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // --- 0. hero: a KOZOS videos hero (assets/js/video-hero.js): a hatter-klip lusta indulasa, a play gomb + a NAGY lejatszo-ablak; itt csak a meres ----------------
  document.addEventListener('vh:video', (e) => meres({ event: 'fooldal_video', video: e.detail.video }));

  // --- 5. CTA-mérés + görgetés -------------------------------------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('[data-cta]');
    if (c) meres({ event: 'fooldal_cta', cta: c.dataset.cta });
  });
  document.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest('[data-gorgetes]');
    if (!g) return;
    const cel = $(g.dataset.gorgetes);
    if (!cel) return;
    e.preventDefault();
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
  });

  // --- 1. videók -------------------------------------------------------------------------------------------------------------------
  let modal = null;
  function modalNyit(gomb) {
    const src = gomb.dataset.video;
    if (!src) return;
    if (!modal) {
      modal = elem('dialog', { class: 'video-modal', 'aria-label': 'Videó' });
      const bezar = elem('button', { type: 'button', class: 'video-modal-bezar', 'aria-label': 'Bezárás', szoveg: '×' });
      bezar.addEventListener('click', () => modal.close());
      modal.append(bezar);
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });   // a háttérre kattintás is bezár
      modal.addEventListener('close', () => { const v = modal.querySelector('video'); if (v) { v.pause(); v.remove(); } });
      document.body.append(modal);
    }
    modal.classList.toggle('fekvo', gomb.dataset.fekvo !== undefined);
    const v = elem('video', { controls: true, playsinline: true, preload: 'auto', src, poster: gomb.dataset.poster || null, 'aria-label': gomb.getAttribute('aria-label') || 'Videó' });
    modal.querySelector('video')?.remove();
    modal.append(v);
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    const lejatszas = v.play(); if (lejatszas && lejatszas.catch) lejatszas.catch(() => {});   // ha a böngésző letiltja az automatikus indítást, a vezérlő gombbal indul
    meres({ event: 'fooldal_video', video: src });
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest('[data-video]');
    if (!g) return;
    e.preventDefault();
    modalNyit(g);
  });

  // --- 2. körhinta -------------------------------------------------------------------------------------------------------------------
  for (const k of document.querySelectorAll('[data-korhinta]')) {
    const sav = k.querySelector('.korhinta-sav');
    const elozo = k.querySelector('.korhinta-gomb.elozo'), kov = k.querySelector('.korhinta-gomb.kovetkezo');
    if (!sav) continue;
    const lep = (irany) => sav.scrollBy({ left: irany * Math.max(240, sav.clientWidth * 0.8), behavior: csokkentett ? 'auto' : 'smooth' });
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

  // --- 3. hatások-fülek --------------------------------------------------------------------------------------------------------------
  const fulek = [...document.querySelectorAll('.hatas-fulek [role="tab"]')];
  if (fulek.length) {
    const valt = (ful, fokusz) => {
      for (const f of fulek) {
        const be = f === ful;
        f.classList.toggle('aktiv', be);
        f.setAttribute('aria-selected', String(be));
        f.tabIndex = be ? 0 : -1;
        const panel = $(f.getAttribute('aria-controls'));
        if (panel) panel.hidden = !be;
      }
      if (fokusz) ful.focus();
    };
    fulek.forEach((f, i) => {
      f.addEventListener('click', () => valt(f, false));
      f.addEventListener('keydown', (e) => {
        const kovetkezo = e.key === 'ArrowRight' ? (i + 1) % fulek.length : e.key === 'ArrowLeft' ? (i - 1 + fulek.length) % fulek.length : -1;
        if (kovetkezo >= 0) { e.preventDefault(); valt(fulek[kovetkezo], true); }
      });
    });
  }

  // --- 3b. telefonon csukott blokkok (details.mobil-csukott): telefonon csukva (kattintásra nyílik), asztalon mindig nyitva (a feliratot a CSS rejti: nyitott-allando) ---
  const mobilMq = matchMedia('(max-width: 700px)');
  const csukottak = [...document.querySelectorAll('details.mobil-csukott')];
  const mobilAllit = () => { for (const d of csukottak) { d.open = !mobilMq.matches; d.classList.toggle('nyitott-allando', !mobilMq.matches); } };
  mobilMq.addEventListener('change', mobilAllit);
  mobilAllit();

  // --- 3c. GYIK telefonon: az első 6 kérdés látszik, a többi a "További kérdések" gombra (asztalon mind látszik; a tartalom a HTML-ben mind megvan) ---
  const gyikRacs = document.querySelector('.gyik-racs');
  if (gyikRacs) {
    const kerdesek = [...gyikRacs.querySelectorAll('details')];
    const ELSO = 6;
    kerdesek.slice(ELSO).forEach((d) => d.classList.add('mobil-rejtett'));
    const gomb = elem('button', { type: 'button', class: 'gomb gomb-korvonal gomb-kicsi gyik-tobb', 'aria-expanded': 'false', szoveg: `További kérdések (${kerdesek.length - ELSO})` });
    gomb.addEventListener('click', () => {
      const nyit = gyikRacs.classList.toggle('kinyitva');
      gomb.setAttribute('aria-expanded', String(nyit));
      gomb.textContent = nyit ? 'Kevesebb kérdés' : `További kérdések (${kerdesek.length - ELSO})`;
    });
    gyikRacs.after(gomb);
  }

  // --- 4. vendégértékelések (Trustindex) ----------------------------------------------------------------------------------------------
  const tiDoboz = $('trustindex');
  function trustindexBetolt() {
    if (!tiDoboz) return;
    const f = elem('iframe', { class: 'ti-keret', src: tiDoboz.dataset.embed, title: 'Google-vélemények (Trustindex)', loading: 'eager', scrolling: 'no' });
    let proba = 0, legnagyobb = 0;
    const meret = (nullaz) => {
      try {
        const d = f.contentDocument;
        const w = d && d.querySelector('.ti-widget');
        if (!w) return false;
        if (!d.getElementById('fo-ti-stilus')) {
          const st = d.createElement('style');
          st.id = 'fo-ti-stilus';
          st.textContent = '@font-face{font-family:"Jost";font-style:normal;font-weight:400 600;font-display:swap;src:url(/assets/fonts/jost-400-latin.woff2) format("woff2")}'
            + 'html body .ti-widget,html body .ti-widget *{font-family:"Jost","Helvetica Neue",Arial,sans-serif!important}'
            + 'html,body{overflow:hidden!important}'
            + 'html body div.ti-controls-line,html body .ti-widget .ti-controls-line{display:none!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;visibility:hidden!important}';
          d.head.appendChild(st);
        }
        const m = Math.ceil(w.getBoundingClientRect().bottom + (parseFloat(d.defaultView.getComputedStyle(d.body).marginBottom) || 0) + 16);
        if (m > 60 && (nullaz || m > legnagyobb)) { legnagyobb = m; f.style.height = m + 'px'; }   // csak nőnek: a lapozó kártyái között ne ugráljon az oldal
        return true;
      } catch (hiba) { return true; }
    };
    const ido = setInterval(() => { proba++; meret(); if (proba > 3600 || !f.isConnected) clearInterval(ido); }, 700);
    addEventListener('resize', () => meret(true));
    tiDoboz.replaceChildren(f);
  }
  trustindexBetolt();   // a vélemények MINDIG azonnal megjelennek

  // az értékelések száma: a Trustindex-widget aktuális adata; a HTML-ben a tartalék érték áll
  const TI = 'https://cdn.trustindex.io/widgets/8a/8a7562c424f027774456be130a1/content.html';
  (async () => {
    try {
      const d = new DOMParser().parseFromString(await (await fetch(TI, { credentials: 'omit' })).text(), 'text/html');
      const a = d.querySelector('.ti-header .ti-rating-text a');
      const n = ((a && a.textContent.match(/\d[\d\s.]*/)) || [''])[0].replace(/\D/g, '');
      if (!n) return;
      for (const e of document.querySelectorAll('[data-ertekeles-db]')) e.textContent = szam(+n);
      for (const l of document.querySelectorAll('a[aria-label*="Google-vélemény"]')) l.setAttribute('aria-label', l.getAttribute('aria-label').replace(/\d+ Google-vélemény/, `${n} Google-vélemény`));
    } catch (hiba) { /* nem sikerült: a HTML-ben a tartalék érték marad */ }
  })();

  // Google térkép: a funkcionális sütik elfogadása után vagy a gombra kattintva
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

  // --- mobil sticky CTA: a hero elgörgetése után jön be, a helyszín szekciónál eltűnik. Görgetés-figyelő (nem IntersectionObserver: az gyors ugrásnál nem jelez) ---------
  const sticky = $('sticky-cta'), hero = document.querySelector('.vh-hero'), vege = $('helyszin');
  if (sticky && hero) {
    let ido = 0;
    const frissit = () => {
      ido = 0;
      const gombok = hero.querySelector('.vh-cta');
      const tulVan = (gombok || hero).getBoundingClientRect().bottom <= 0;
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
