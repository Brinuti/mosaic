// A Wix sajat szkriptjei helyett ez a fajl adja vissza az oldal viselkedeset
// (a MOSAIC klon assets/js/klon.js mintajara).
//
// Nem ujraertelmezi a mukodest: azokat az osztalyokat es attributumokat allitja,
// amiket az eles oldalon a Wix JS-e allit (merve, lasd az egyes szakaszokat).
// A kirajzolt oldal mar az eles oldal allapota (tools/elo-mentes.mjs), ezert itt
// csak a valtozasokat (kattintas, lapozas) kell kezelni.
(function () {
  'use strict';

  // --- 1. felugro menu (Wix lightbox "d3iz6") -------------------------------
  // A jobb felso gomb ([data-popupid]) a Wix felugro ablakat nyitja. A lementett
  // ablak (tools/popup-mentes.mjs) <template>-kent van az oldal vegen. A Wix az
  // ablakot jobbrol csusztatja be, az aktualis oldal menupontjat kiemeli
  // (MHn4_S + aria-current="page"), es a bezaro X, a fatyol es az Esc zarja.
  const AKTUALIS = 'MHn4_S';
  const utvonal = (href) => {
    try { const u = new URL(href, location.href); return decodeURIComponent(u.pathname).replace(/\/+$/, '') || '/'; } catch (e) { return null; }
  };
  const itt = utvonal(location.href);
  let nyitottAblak = null;
  const ablakZar = () => {
    if (!nyitottAblak) return;
    const a = nyitottAblak;
    nyitottAblak = null;
    a.classList.add('mp-felugro-zar');
    document.documentElement.classList.remove('mp-felugro-nyitva');
    setTimeout(() => a.remove(), 400);
  };
  const ablakNyit = (id) => {
    const t = document.getElementById('mp-popup-' + id);
    if (!t || nyitottAblak) return;
    const doboz = document.createElement('div');
    doboz.appendChild(t.content.cloneNode(true));
    const gyoker = doboz.querySelector('#POPUPS_ROOT');
    if (!gyoker) return;
    for (const a of gyoker.querySelectorAll('a[href]')) {
      if (utvonal(a.href) === itt && a.closest('.wixui-vertical-menu__item')) {
        a.setAttribute('aria-current', 'page');
        const burok = a.closest('[data-testid^="itemContentWrapper"]');
        if (burok) burok.classList.add(AKTUALIS);
      }
    }
    // a stilus is a sablonban van (a Wix kattintasra toltotte be)
    for (const st of doboz.querySelectorAll('style')) if (!document.getElementById(st.id || '-')) document.head.appendChild(st);
    gyoker.classList.add('mp-felugro');
    (document.getElementById('main_MF') || document.body).appendChild(gyoker);
    nyitottAblak = gyoker;
    document.documentElement.classList.add('mp-felugro-nyitva');
    const zaro = gyoker.querySelector('[data-testid="popupCloseIconButtonRoot"]');
    if (zaro) zaro.addEventListener('click', ablakZar);
    // a fatyolra (az ablakon kivulre) kattintva zar
    const ablak = gyoker.querySelector('.wixui-lightbox');
    gyoker.addEventListener('click', (e) => { if (ablak && !ablak.contains(e.target)) ablakZar(); });
    const elso = gyoker.querySelector('a[href]');
    if (elso) elso.focus({ preventScroll: true });
  };
  for (const g of document.querySelectorAll('[data-popupid]')) {
    g.addEventListener('click', (e) => { e.preventDefault(); ablakNyit(g.dataset.popupid); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ablakNyit(g.dataset.popupid); } });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ablakZar(); });

  // --- 2. diavetites (wixui-slideshow) ------------------------------------
  // Az eles oldalon merve: magatol lapoz, 1000 ms-os attunessel, utana 4 mp-ig all
  // egy dia; a nyilak lapoznak, a vegen korbeer. A diakat a tools/elo-mentes.mjs
  // tette a slidesWrapper-be (data-mp-dia, a nem aktualisak hidden).
  const ATTUNES = 1000, ALLAS = 4000;
  for (const sh of document.querySelectorAll('.wixui-slideshow')) {
    const w = sh.querySelector('[data-testid="slidesWrapper"]');
    const diak = w ? [...w.querySelectorAll(':scope > [data-mp-dia]')] : [];
    if (diak.length < 2) continue;
    let most = 0, ido = 0, folyamatban = false;
    const mutat = (uj) => {
      uj = (uj + diak.length) % diak.length;
      if (uj === most || folyamatban) return;
      folyamatban = true;
      const regi = diak[most], kov = diak[uj];
      kov.hidden = false;
      Object.assign(kov.style, { position: 'absolute', inset: '0', opacity: '0', transition: `opacity ${ATTUNES}ms ease-in-out` });
      regi.style.transition = `opacity ${ATTUNES}ms ease-in-out`;
      requestAnimationFrame(() => requestAnimationFrame(() => { kov.style.opacity = '1'; regi.style.opacity = '0'; }));
      setTimeout(() => {
        regi.hidden = true;
        Object.assign(regi.style, { opacity: '', transition: '' });
        Object.assign(kov.style, { position: '', inset: '', opacity: '', transition: '' });
        most = uj;
        folyamatban = false;
      }, ATTUNES + 30);
    };
    const indit = () => { clearInterval(ido); ido = setInterval(() => mutat(most + 1), ATTUNES + ALLAS); };
    const elozo = sh.querySelector('[data-testid="prevButton"]');
    const kovetkezo = sh.querySelector('[data-testid="nextButton"]');
    if (elozo) elozo.addEventListener('click', () => { mutat(most - 1); indit(); });
    if (kovetkezo) kovetkezo.addEventListener('click', () => { mutat(most + 1); indit(); });
    if (!w.style.position) w.style.position = 'relative';
    indit();
  }

  // --- 3. kepgaleria (wixui-gallery, "slide-show-gallery") --------------------
  // A Wix a galeria minden kepet "szellem" elemkent (gallery-item-ghost) a DOM-ban
  // tartja, a lathato elem (gallery-item-item) az aktualis. A nyilak lapoznak.
  for (const g of document.querySelectorAll('[data-testid="slide-show-gallery"]')) {
    const szellemek = [...g.querySelectorAll('[data-testid="gallery-item-ghost"]')];
    const lathato = g.querySelector('[data-testid="gallery-item-item"]');
    if (szellemek.length < 2 || !lathato) continue;
    let most = 0;
    const kepe = (el) => el.querySelector('img');
    const mutat = (i) => {
      most = (i + szellemek.length) % szellemek.length;
      const forras = kepe(szellemek[most]), cel = kepe(lathato);
      if (forras && cel) {
        cel.src = forras.getAttribute('src');
        if (forras.getAttribute('srcset')) cel.setAttribute('srcset', forras.getAttribute('srcset')); else cel.removeAttribute('srcset');
        cel.alt = forras.alt || '';
      }
      for (const sel of ['[data-testid="gallery-item-title"]', '[data-testid="gallery-item-description"]']) {
        const a = szellemek[most].querySelector(sel), b = lathato.querySelector(sel);
        if (a && b) b.innerHTML = a.innerHTML;
      }
    };
    const e = g.querySelector('[data-testid="gallery-prevButton"]');
    const k = g.querySelector('[data-testid="gallery-nextButton"]');
    if (e) e.addEventListener('click', () => mutat(most - 1));
    if (k) k.addEventListener('click', () => mutat(most + 1));
    let sx = null;
    lathato.addEventListener('pointerdown', (ev) => { sx = ev.clientX; });
    lathato.addEventListener('pointerup', (ev) => { if (sx !== null && Math.abs(ev.clientX - sx) > 40) mutat(most + (ev.clientX < sx ? 1 : -1)); sx = null; });
  }

  // --- 4. fulek (wixui-tabs) -----------------------------------------------
  // Az eles oldalon merve: az aktiv ful osztalya ...--current, aria-selected="true",
  // tabindex=0; a panel burka --isVisible osztalyt es aria-hidden="false"-t kap,
  // a tobbi aria-hidden="true" (az animacios fazis-osztalyokkal egyutt).
  const fazis = (el, latszik) => {
    for (const c of [...el.classList]) if (/---phase-\d+-(enter|exit)-done$/.test(c)) el.classList.replace(c, c.replace(/phase-\d+-(enter|exit)-done$/, latszik ? 'phase-10-enter-done' : 'phase-9-exit-done'));
  };
  for (const t of document.querySelectorAll('.wixui-tabs')) {
    const fulek = [...t.querySelectorAll('[data-hook="tab-item"]')];
    const panelek = [...t.querySelectorAll('[data-hook="TabPanel"]')];
    const AKT = [...new Set(fulek.flatMap((f) => [...f.classList]))].find((c) => /--current$/.test(c));
    const LATHATO = [...new Set(panelek.flatMap((p) => [...p.classList]))].find((c) => /--isVisible$/.test(c));
    if (!AKT || !LATHATO) continue;
    const valt = (i) => {
      fulek.forEach((f, j) => {
        f.classList.toggle(AKT, i === j);
        f.setAttribute('aria-selected', String(i === j));
        f.setAttribute('tabindex', i === j ? '0' : '-1');
        f.setAttribute('data-testid', i === j ? 'ActiveTabItem' : 'false');
      });
      for (const p of panelek) {
        const enyem = p.getAttribute('aria-labelledby') === fulek[i].id;
        p.classList.toggle(LATHATO, enyem);
        p.setAttribute('aria-hidden', String(!enyem));
        fazis(p, enyem);
        const anim = p.parentElement && /__animationWrapper/.test(p.parentElement.className) ? p.parentElement : null;
        if (anim) fazis(anim, enyem);
      }
    };
    fulek.forEach((f, i) => {
      f.addEventListener('click', () => valt(i));
      f.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const j = (i + (e.key === 'ArrowRight' ? 1 : -1) + fulek.length) % fulek.length;
          valt(j); fulek[j].focus();
        }
      });
    });
  }

  // --- 5. videodoboz (wixui-video-box) --------------------------------------
  // Nemitva, ismetelve magatol indul (mint a Wixen); kattintasra megall/indul,
  // a hangszoro-gomb a hangot kapcsolja (data-audio-mute / aria-pressed).
  for (const vb of document.querySelectorAll('.wixui-video-box')) {
    const v = vb.querySelector('video');
    if (!v) continue;
    v.muted = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
    const gomb = vb.querySelector('[role="button"][aria-pressed]');
    if (gomb) gomb.addEventListener('click', (e) => {
      if (e.target.closest('[data-testid="vb-audio"]')) return;
      if (v.paused) { v.play(); vb.setAttribute('data-playing', ''); } else { v.pause(); vb.removeAttribute('data-playing'); }
      gomb.setAttribute('aria-pressed', String(!v.paused));
    });
    const hang = vb.querySelector('[data-testid="vb-audio"]');
    if (hang) hang.addEventListener('click', (e) => {
      e.stopPropagation();
      v.muted = !v.muted;
      if (v.muted) hang.setAttribute('data-audio-mute', ''); else hang.removeAttribute('data-audio-mute');
      hang.setAttribute('aria-pressed', String(v.muted));
      vb.setAttribute('data-audio', v.muted ? 'off' : 'on');
    });
  }

  // --- 6. urlapok (wixui-form, allasjelentkezes) -----------------------------
  // A Wix-urlap mezoi valtozatlanok; a bekuldest a functions/[[path]].js kapja
  // (POST /api/urlap, multipart), es e-mailben tovabbitja. A datumvalaszto a
  // bongeszo sajat naptarat nyitja, a feltoltes-gomb a kivalasztott fajl nevet mutatja.
  for (const f of document.querySelectorAll('form.wixui-form')) {
    f.setAttribute('novalidate', '');
    for (const dp of f.querySelectorAll('.wixui-date-picker__input')) {
      const rejtett = document.createElement('input');
      rejtett.type = 'date';
      rejtett.tabIndex = -1;
      rejtett.setAttribute('aria-hidden', 'true');
      rejtett.style.cssText = 'position:absolute;left:0;bottom:0;opacity:0;pointer-events:none;width:1px;height:1px';
      dp.after(rejtett);
      const nyit = (e) => { if (e) e.preventDefault(); try { rejtett.showPicker(); } catch (x) { rejtett.focus(); } };
      dp.addEventListener('click', nyit);
      dp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') nyit(e); });
      const gomb = dp.parentElement && dp.parentElement.querySelector('button');
      if (gomb) gomb.addEventListener('click', nyit);
      rejtett.addEventListener('change', () => {
        dp.value = rejtett.value ? rejtett.value.replace(/-/g, '. ') + '.' : '';
        dp.dataset.ertek = rejtett.value;
      });
    }
    for (const fi of f.querySelectorAll('input[type="file"]')) {
      fi.addEventListener('change', () => {
        const cimke = f.querySelector(`label[for="${fi.id}"]`);
        if (cimke && fi.files[0]) { if (!cimke.dataset.eredeti) cimke.dataset.eredeti = cimke.textContent; cimke.textContent = fi.files[0].name; }
      });
    }
    const kuld = f.querySelector('button.wixui-button, button[type="submit"]');
    const cimkeje = (el) => {
      const l = f.querySelector(`label[for="${el.id}"]`);
      return ((l && (l.dataset.eredeti || l.textContent)) || el.name || el.id).trim().replace(/:$/, '');
    };
    const bekuld = async (e) => {
      if (e) e.preventDefault();
      let hibas = null;
      for (const el of f.querySelectorAll('input, textarea, select')) {
        if (el.type === 'date' || el.type === 'file' || el.type === 'hidden') continue;
        const ures = el.hasAttribute('required') && !el.value.trim();
        const jo = !ures && (!el.value || !el.pattern || new RegExp(el.pattern).test(el.value)) && (el.readOnly || el.checkValidity());
        el.setAttribute('aria-invalid', String(!jo));
        if (!jo && !hibas) hibas = el;
      }
      if (hibas) { hibas.focus(); return; }
      const adat = new FormData();
      adat.append('form-name', 'allasjelentkezes');
      adat.append('oldal', decodeURIComponent(location.pathname));
      adat.append('bot-field', '');
      for (const el of f.querySelectorAll('input, textarea, select')) {
        if (el.type === 'date') continue;
        if (el.type === 'file') { if (el.files[0]) adat.append(cimkeje(el), el.files[0]); continue; }
        adat.append(cimkeje(el), el.dataset.ertek || el.value);
      }
      const felirat = kuld && kuld.querySelector('.wixui-button__label, span');
      const eredeti = felirat ? felirat.textContent : '';
      if (kuld) kuld.setAttribute('aria-disabled', 'true');
      try {
        const v = await fetch('/api/urlap', { method: 'POST', body: adat });
        if (!v.ok) throw new Error(String(v.status));
        if (felirat) felirat.textContent = 'Köszönjük, megkaptuk!';
        f.reset();
        for (const c of f.querySelectorAll('label[data-eredeti]')) c.textContent = c.dataset.eredeti;
      } catch (x) {
        if (felirat) felirat.textContent = 'Hiba történt, próbáld újra!';
        setTimeout(() => { if (felirat) felirat.textContent = eredeti; }, 4000);
        if (kuld) kuld.setAttribute('aria-disabled', 'false');
      }
    };
    if (kuld) kuld.addEventListener('click', bekuld);
    f.addEventListener('submit', bekuld);
  }

  // --- 7. blogbejegyzes: megosztas es kedveles --------------------------------
  // A Wix-blog gombjai: Facebook, X, LinkedIn (megoszto ablak), link (vagolapra),
  // nyomtatas. A kedveles szamlaloja a Wix szerveren volt; a klonban a mentett szam
  // latszik, es a latogato sajat kedvelese a bongeszojeben marad meg.
  const cim = location.href.split('#')[0];
  const MEGOSZTO = {
    'share-button__facebook': 'https://www.facebook.com/sharer/sharer.php?u=',
    'share-button__twitter': 'https://twitter.com/intent/tweet?url=',
    'share-button__linked-in': 'https://www.linkedin.com/sharing/share-offsite/?url=',
  };
  for (const g of document.querySelectorAll('[data-hook^="share-button__"]')) {
    g.addEventListener('click', async (e) => {
      e.preventDefault();
      const tipus = g.dataset.hook;
      if (MEGOSZTO[tipus]) window.open(MEGOSZTO[tipus] + encodeURIComponent(cim), '_blank', 'noopener,width=640,height=560');
      else if (tipus === 'share-button__print') window.print();
      else if (tipus === 'share-button__link') {
        try { await navigator.clipboard.writeText(cim); } catch (x) { /* regi bongeszo: nincs vagolap */ }
        const jel = document.createElement('div');
        jel.className = 'mp-masolva';
        jel.textContent = 'A link másolva';
        document.body.appendChild(jel);
        setTimeout(() => jel.remove(), 2000);
      }
    });
  }
  let kedvelt = {};
  try { kedvelt = JSON.parse(localStorage.getItem('mp-kedvelt') || '{}'); } catch (x) { kedvelt = {}; }
  // A gomb (button[aria-label="Like post"]) a szivecsket (data-hook="like-button") es a
  // szamot (a like-count burok utolso szoveges eleme) tartalmazza.
  for (const k of document.querySelectorAll('[data-hook="like-button"]')) {
    const gomb = k.closest('button');
    if (!gomb || k.closest('a')) continue;
    const burok = k.parentElement;
    let szoveg = [...burok.childNodes].filter((n) => n.nodeType === 3).pop();
    const alap = szoveg ? parseInt(szoveg.textContent, 10) || 0 : 0;
    const allapot = gomb.querySelector('[aria-live]');
    const kulcs = itt;
    const rajzol = () => {
      const be = !!kedvelt[kulcs];
      k.classList.toggle('mp-kedvelt', be);
      if (!szoveg && (alap || be)) { szoveg = document.createTextNode(''); burok.appendChild(szoveg); }
      if (szoveg) szoveg.textContent = String(alap + (be ? 1 : 0));
      if (allapot) allapot.textContent = be ? 'A bejegyzés kedvelve' : 'A bejegyzés nincs kedvelve';
    };
    if (kedvelt[kulcs]) rajzol();
    gomb.addEventListener('click', (e) => {
      e.preventDefault();
      kedvelt[kulcs] = !kedvelt[kulcs];
      try { localStorage.setItem('mp-kedvelt', JSON.stringify(kedvelt)); } catch (x) { /* privat mod */ }
      rajzol();
    });
  }
})();
