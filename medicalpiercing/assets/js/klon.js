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
  // Az ablak kulso Wix-stilusai (menupontok, bezaro gomb) a felugro.css-ben vannak: mar a lap
  // betoltesekor kerjuk le, hogy nyitaskor ne villanjon fel formazatlanul.
  if (document.querySelector('[data-popupid]') && !document.getElementById('mp-felugro-css')) {
    const l = document.createElement('link');
    l.id = 'mp-felugro-css';
    l.rel = 'stylesheet';
    // a build a klon.js-t ?v=<verzio> jellel hivatkozza: ugyanez kerul a stilusra is
    l.href = '/assets/css/wix/felugro.css' + ((document.currentScript && new URL(document.currentScript.src).search) || '');
    document.head.appendChild(l);
  }
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
    // menupont ramutataskor: a Wix JS-e a T_TcVK osztalyt teszi a menupontra (feher betu,
    // sotet hatter - a felugro.css-ben), elhagyaskor leveszi; billentyuzetes fokusznal ugyanigy
    const RAMUTAT = 'T_TcVK';
    for (const pont of gyoker.querySelectorAll('[data-testid^="itemContentWrapper"]')) {
      pont.addEventListener('mouseenter', () => pont.classList.add(RAMUTAT));
      pont.addEventListener('mouseleave', () => pont.classList.remove(RAMUTAT));
      pont.addEventListener('focusin', () => pont.classList.add(RAMUTAT));
      pont.addEventListener('focusout', () => pont.classList.remove(RAMUTAT));
    }
    const zaro = gyoker.querySelector('[data-testid="popupCloseIconButtonRoot"]');
    if (zaro) zaro.addEventListener('click', ablakZar);
    // a fatyolra (az ablakon kivulre) kattintva zar
    const ablak = gyoker.querySelector('.wixui-lightbox');
    gyoker.addEventListener('click', (e) => { if (ablak && !ablak.contains(e.target)) ablakZar(); });
    // a Wix az ablak burkara (#popups-wrapper, role=dialog) teszi a fokuszt, nem az elso menupontra
    // (az elso pont igy nem kap kiemelest nyitaskor)
    const burok = gyoker.querySelector('#popups-wrapper') || gyoker.querySelector('a[href]');
    if (burok) burok.focus({ preventScroll: true });
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
  // Csak akkor lapoz, amikor latszik: kepbe kerulve kb. 5 mp mulva valt eloszor, kikerulve
  // megall (eles oldalon merve, 2026-10-10; ramutataskor nem all meg).
  const ATTUNES = 1000, ALLAS = 4000;
  for (const sh of document.querySelectorAll('.wixui-slideshow')) {
    const w = sh.querySelector('[data-testid="slidesWrapper"]');
    const diak = w ? [...w.querySelectorAll(':scope > [data-mp-dia]')] : [];
    if (diak.length < 2) continue;
    // a mentes nehol egy Wix-attunes kozepen kapta el a diat: az atmeneti osztalyai (pl.
    // "HTrn1j sAGPNe" = opacity:0) a dia megjelenese utan eltuntetnek - csak a minden dian
    // meglevo osztalyok maradnak (es a dia sajat comp- osztalya)
    const kozos = [...diak[0].classList].filter((c) => diak.every((d) => d.classList.contains(c)));
    for (const d of diak) d.className = [...d.classList].filter((c) => kozos.includes(c) || c === d.id).join(' ');
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
    let lathato = false;
    const indit = () => { clearInterval(ido); if (lathato) ido = setInterval(() => mutat(most + 1), ATTUNES + ALLAS); };
    const elozo = sh.querySelector('[data-testid="prevButton"]');
    const kovetkezo = sh.querySelector('[data-testid="nextButton"]');
    if (elozo) elozo.addEventListener('click', () => { mutat(most - 1); indit(); });
    if (kovetkezo) kovetkezo.addEventListener('click', () => { mutat(most + 1); indit(); });
    if (!w.style.position) w.style.position = 'relative';
    if (window.IntersectionObserver) {
      new IntersectionObserver((l) => {
        const uj = l[l.length - 1].isIntersecting;
        if (uj !== lathato) { lathato = uj; indit(); }
      }).observe(sh);
    } else { lathato = true; indit(); }
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
    // ramutataskor a Wix data-roll-in / data-show-audio jelzest tesz a dobozra: ettol latszik a
    // hangszoro-gomb (eles oldalon merve); az eger tavozasakor leveszi
    vb.addEventListener('mouseenter', () => { vb.setAttribute('data-roll-in', ''); vb.setAttribute('data-show-audio', ''); });
    vb.addEventListener('mouseleave', () => { vb.removeAttribute('data-roll-in'); vb.removeAttribute('data-show-audio'); });
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
      // a levél tárgya oldalanként: az állásajánlat-oldalakon jelentkezés, máshol általános üzenet
      adat.append('form-name', /^\/allasajanlat/.test(decodeURIComponent(location.pathname)) ? 'allasjelentkezes' : 'urlap');
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

  // --- 8. URL-parameterek megorzese es a foglalasi linkek -----------------------
  // A Wix-oldal sajat kodja (Velo, masterPage.js, minden oldalon) pontosan ezt tette: ha az
  // oldal parameterekkel nyilik, elmenti oket a munkamenetbe ("savedQueryParams"); ha
  // parameter nelkul, a mentetteket visszateszi a cimbe (ujratoltes nelkul).
  const MENTETT = 'savedQueryParams';
  try {
    const most = new URLSearchParams(location.search);
    if ([...most.keys()].length) {
      sessionStorage.setItem(MENTETT, JSON.stringify(Object.fromEntries(most)));
    } else {
      const m = JSON.parse(sessionStorage.getItem(MENTETT) || 'null');
      if (m && Object.keys(m).length) history.replaceState(history.state, '', location.pathname + '?' + new URLSearchParams(m) + location.hash);
    }
  } catch (x) { /* privat mod / hibas mentes: marad a cim */ }
  // A foglalasi linkek (medicalpiercing.salonic.hu) viszik tovabb a kattintas-azonositokat es
  // a kampanyparametereket, ha az oldal is ezekkel nyilt meg (a Salonic igy a hirdeteshez
  // kotheti a foglalast). A link sajat parametereit nem irjuk felul.
  const TOVABB = /^(fbclid|gclid|gbraid|wbraid|ttclid|utm_[a-z_]+)$/i;
  const SALONIC = /^https?:\/\/medicalpiercing\.salonic\.hu(\/|$)/i;
  const kiegeszit = (a) => {
    const href = a.getAttribute('href');
    if (!href || !SALONIC.test(href)) return;
    let u;
    try { u = new URL(href); } catch (x) { return; }
    let valtozott = false;
    for (const [k, v] of new URLSearchParams(location.search)) {
      if (TOVABB.test(k) && v && !u.searchParams.has(k)) { u.searchParams.set(k, v); valtozott = true; }
    }
    if (valtozott) a.setAttribute('href', u.href);
  };
  for (const a of document.querySelectorAll('a[href]')) kiegeszit(a);
  // a felugro menu linkjei kesobb kerulnek az oldalba: kattintaskor is kiegeszitjuk
  for (const esemeny of ['click', 'auxclick', 'contextmenu']) {
    document.addEventListener(esemeny, (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (a) kiegeszit(a); }, true);
  }

  // --- 9. varosoldalak: a CMS-lapozo ("Previous" / "Next") ---------------------------
  // A Wixen a helyszin-gyujtemeny lapozogombjai; az eles oldalon (2026-10-10, minden
  // varosoldalon kiprobalva) szinte mindenhol tiltva vannak, ahol nem, ott tesztelemekre
  // ("this-is-a-title-01") visznek. A klonban mindenhol tiltva: ne legyen hatastalan kattintas.
  if (/^\/varosok\//.test(itt)) {
    for (const g of document.querySelectorAll('button[aria-label="Previous"], button[aria-label="Next"]')) {
      g.disabled = true;
      g.setAttribute('aria-disabled', 'true');
      // a tiltott (szurke) kinezetet a Wix a burok aria-disabled jelzesebol rajzolja
      const burok = g.parentElement;
      if (burok && burok.hasAttribute('aria-disabled')) { burok.setAttribute('aria-disabled', 'true'); burok.tabIndex = -1; }
    }
  }

  // --- 10. fejlec: gorgeteskor eltunik (Wix "eltunik" gorgetesi effekt, csak asztalin) ------
  // Az eles oldalon merve (2026-10-10): kb. 400 px folyamatos lefele gorgetes utan a fejlec
  // felcsuszik (ptcyHf: translateY(-100%), .2s), kb. 400 px felfele gorgetesre vagy a lap
  // tetejen visszajon (d3PC2t). Minden asztali oldalon igy van (a mentett oldalak egy reszen a
  // jelzo osztaly meg nincs rajta: a Wix JS-e lassan, nehany mp alatt teszi fel). Mobilon nincs ilyen.
  const fejlec = document.getElementById('SITE_HEADER');
  if (fejlec && !document.getElementById('wixMobileViewport')) {
    const HATAR = 400;
    let utolso = scrollY, fordulo = scrollY, irany = 0, rejtve = false;
    const allit = (r) => {
      if (r === rejtve) return;
      rejtve = r;
      fejlec.classList.toggle('ptcyHf', r);
      fejlec.classList.toggle('d3PC2t', !r);
    };
    addEventListener('scroll', () => {
      if (document.documentElement.classList.contains('mp-felugro-nyitva')) return;
      const y = scrollY;
      const uj = y > utolso ? 1 : y < utolso ? -1 : irany;
      if (uj !== irany) { irany = uj; fordulo = utolso; }
      utolso = y;
      if (y <= 0) allit(false);
      else if (irany > 0 && y - fordulo >= HATAR) allit(true);
      else if (irany < 0 && fordulo - y >= HATAR) allit(false);
    }, { passive: true });
  }

  // --- 11. kitelepulesek: a videki helyszinek friss idopontjai ------------------------
  // A datumblokkokat a build jeloli meg (data-mp-kitelepules="<helyszin>", lib/kitelepulesek.js)
  // es mar a tablazat akkori allapotat irja beljuk; itt a lap betoltesekor a mostanit kerjuk le
  // (/api/kitelepulesek, a tablazat legfeljebb 5 perces masolata), igy a tablazat modositasa
  // es a mar elmult napok uj build nelkul is latszanak.
  const blokkok = document.querySelectorAll('[data-mp-kitelepules]');
  if (blokkok.length && window.fetch) {
    fetch('/api/kitelepulesek').then((v) => (v.ok ? v.json() : null)).then((adat) => {
      if (!adat || !adat.sorok) return;
      for (const b of blokkok) {
        const sorok = adat.sorok[b.dataset.mpKitelepules];
        if (!sorok || !sorok.length) continue;
        b.replaceChildren(...sorok.flatMap((s, i) => (i ? [document.createElement('br'), s] : [s])));
      }
    }).catch(() => { /* marad a build idejen beirt allapot */ });
  }

  // --- 12. Pro Gallery (pro-gallery-parent-container) ------------------------------------
  // Az eles oldalon merve (2026-10-10; fooldal comp-ld4dmnwl, /migren-piercing comp-ly48ww2y,
  // asztalin es mobilon):
  // - a "Next Item" / "Previous Item" nyil egy elemet lapoz: a Wix kikapcsolja a scroll-snapet,
  //   a .gallery-horizontal-scroll-inner-t kb. 370 ms alatt eltolja, aztan beallitja a
  //   scrollLeft-et es visszakapcsolja a snapet. Az elso elemnel nincs Previous (a mentett
  //   oldalon sincs, a Wix kesobb rajzolja), az utolsonal nincs Next. Ujjal gorgetve ugyanigy
  //   frissulnek a nyilak es a belyegkepek.
  // - a belyegkepsav a kiemelt (pro-gallery-highlight) kepet kozepre hozza:
  //   oszlop left = min(0, sav/2 - (i*lepes + margo + belyeg/2)); a Wix csak egy ablaknyi
  //   belyeget rajzol (asztalin 9, mobilon 3), ezeket hasznaljuk ujra. Belyegre kattintva oda lapoz.
  // - kepre kattintva teljes kepernyos nezet nyilik (feher hatter, nyilak, X, bal felul a
  //   bongeszo teljes kepernyoje; mobilon vissza-nyil es ujjal lapozas), a cimbe
  //   ?pgid=<galeria>-<elem> kerul; az X / vissza-nyil / Esc zarja.
  const PG_IDO = 370, PG_GORBE = 'cubic-bezier(.4,0,.35,1)';
  // tartalom eltolasa a cel scrollLeft-ig, a vegen a valodi gorgetes (mint a Wix)
  const pgCsusztat = (sc, belso, celX, kesz) => {
    const d = celX - sc.scrollLeft;
    if (Math.abs(d) < 1) { kesz(); return; }
    sc.style.scrollSnapType = 'none';
    belso.style.transition = 'none';
    belso.style.transform = 'translateX(0)';
    void belso.offsetWidth;
    belso.style.transition = `transform ${PG_IDO}ms ${PG_GORBE}`;
    belso.style.transform = `translateX(${-d}px)`;
    setTimeout(() => {
      belso.style.transition = 'none';
      belso.style.transform = '';
      sc.scrollLeft = celX;
      void belso.offsetWidth;
      belso.style.transition = '';
      sc.style.scrollSnapType = '';
      kesz();
    }, PG_IDO + 30);
  };
  const MOBIL_LAP = !!document.getElementById('wixMobileViewport');
  const PG_NYIL = '<svg width="15" height="27" viewBox="0 0 15 27" fill="currentColor" aria-hidden="true"><path d="M.198 25.926l1.06 1.06 13.259-13.258L1.258.47.198 1.53l12.197 12.198z"/></svg>';
  const PG_X = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M.5 .5l25 25M25.5 .5l-25 25"/></svg>';
  const PG_NAGYIT = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M1.5 24.5l9-9M15.5 10.5l9-9M16.5 1.5h8v8M1.5 16.5v8h8"/></svg>';
  const PG_NYIL_BLOG = '<svg width="23" height="39" viewBox="0 0 23 39" fill="currentColor" aria-hidden="true"><path d="M857.005,231.479L858.5,230l18.124,18-18.127,18-1.49-1.48L873.638,248Z" transform="translate(-855 -230)"/></svg>';
  const PG_VISSZA = '<svg width="26" height="20" viewBox="0 0 26 20" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M25 10H1.5M10.5 1L1.5 10l9 9"/></svg>';
  const pgCim = (pgid) => {
    const u = new URL(location.href);
    if (pgid) u.searchParams.set('pgid', pgid); else u.searchParams.delete('pgid');
    history.replaceState(history.state, '', u);
  };
  let pgNyitott = null;
  // gal: { kepek, ids, id } (Pro Gallery: a cimbe ?pgid= kerul) vagy { kepek, blog: true } (blogkepek, 14.)
  const pgTeljes = (gal, kezd, honnan) => {
    if (pgNyitott) return;
    const N = gal.kepek.length;
    const t = document.createElement('div');
    t.className = 'mp-pg-teljes' + (MOBIL_LAP ? ' mp-pg-mobil' : '') + (gal.blog ? ' mp-pg-blog' : '');
    t.setAttribute('role', 'dialog');
    t.setAttribute('aria-label', 'Gallery item, detailed view');
    t.tabIndex = -1;
    t.innerHTML = '<div class="mp-pg-sav"><div class="mp-pg-belso"></div></div>'
      + (MOBIL_LAP ? '' : `<button type="button" class="mp-pg-nagyit" title="Open in fullscreen">${PG_NAGYIT}</button>`)
      + (gal.blog ? `<button type="button" class="mp-pg-zar" aria-label="Bezárás">${PG_X}</button>`
        + `<button type="button" class="mp-pg-nyil mp-pg-elozo" aria-label="Previous gallery item">${PG_NYIL_BLOG}</button>`
        + `<button type="button" class="mp-pg-nyil mp-pg-kov" aria-label="Next gallery item">${PG_NYIL_BLOG}</button>`
        : `<button type="button" class="mp-pg-zar" aria-label="Exit expand mode">${MOBIL_LAP ? PG_VISSZA : PG_X}</button>`
        + `<button type="button" class="mp-pg-nyil mp-pg-elozo" aria-label="Previous Item">${PG_NYIL}</button>`
        + `<button type="button" class="mp-pg-nyil mp-pg-kov" aria-label="Next Item">${PG_NYIL}</button>`);
    const sav = t.querySelector('.mp-pg-sav'), belso = t.querySelector('.mp-pg-belso');
    const kepek = gal.kepek.map((src) => {
      const d = document.createElement('div');
      d.className = 'mp-pg-dia';
      const im = document.createElement('img');
      im.alt = '';
      im.decoding = 'async';
      im.dataset.src = src;
      d.appendChild(im);
      belso.appendChild(d);
      return im;
    });
    const elo = t.querySelector('.mp-pg-elozo'), kov = t.querySelector('.mp-pg-kov');
    let most = -1, fut = false;
    const allit = (k) => {
      if (k === most) return;
      most = k;
      elo.style.display = k > 0 ? '' : 'none';
      kov.style.display = k < N - 1 ? '' : 'none';
      for (let j = k - 1; j <= k + 1; j++) if (kepek[j] && !kepek[j].getAttribute('src')) kepek[j].src = kepek[j].dataset.src;
      if (!gal.blog) pgCim(gal.id + '-' + gal.ids[k]);
    };
    const lapoz = (k) => {
      if (fut || k < 0 || k >= N || k === most) return;
      fut = true;
      allit(k);
      pgCsusztat(sav, belso, k * sav.clientWidth, () => { fut = false; });
    };
    let ido = 0;
    sav.addEventListener('scroll', () => {
      if (fut) return;
      clearTimeout(ido);
      ido = setTimeout(() => allit(Math.max(0, Math.min(N - 1, Math.round(sav.scrollLeft / sav.clientWidth)))), 100);
    }, { passive: true });
    elo.addEventListener('click', () => lapoz(most - 1));
    kov.addEventListener('click', () => lapoz(most + 1));
    const nagyit = t.querySelector('.mp-pg-nagyit');
    if (nagyit) nagyit.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (t.requestFullscreen) t.requestFullscreen().catch(() => {});
    });
    const zar = () => {
      if (pgNyitott !== t) return;
      pgNyitott = null;
      document.removeEventListener('keydown', billentyu);
      if (document.fullscreenElement === t) document.exitFullscreen().catch(() => {});
      document.documentElement.classList.remove('mp-pg-nyitva');
      t.classList.remove('mp-pg-lathato');
      if (!gal.blog) pgCim(null);
      setTimeout(() => t.remove(), 300);
      if (honnan) honnan.focus({ preventScroll: true });
    };
    const billentyu = (e) => {
      if (e.key === 'Escape') zar();
      else if (e.key === 'ArrowRight') lapoz(most + 1);
      else if (e.key === 'ArrowLeft') lapoz(most - 1);
    };
    t.querySelector('.mp-pg-zar').addEventListener('click', zar);
    document.addEventListener('keydown', billentyu);
    document.body.appendChild(t);
    document.documentElement.classList.add('mp-pg-nyitva');
    pgNyitott = t;
    sav.scrollLeft = kezd * sav.clientWidth;
    allit(kezd);
    t.focus({ preventScroll: true });
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('mp-pg-lathato')));
  };

  const pgGaleriak = [];
  for (const par of document.querySelectorAll('.pro-gallery-parent-container')) {
    const kont = par.querySelector('[id^="pro-gallery-container-"]');
    const elemek = [...par.querySelectorAll('[data-hook="item-container"]')].sort((a, b) => a.dataset.idx - b.dataset.idx);
    if (!kont || !elemek.length) continue;
    const kepSrc = (el) => { const i = el.querySelector('img'); return i ? i.getAttribute('src') : ''; };
    const gal = { id: kont.id.replace(/^pro-gallery-container-(comp-)?/, ''), ids: elemek.map((e) => e.dataset.id), kepek: elemek.map(kepSrc) };
    pgGaleriak.push(gal);
    if (par.querySelector('[data-hook="item-action"][aria-haspopup="dialog"]')) {
      elemek.forEach((el, i) => {
        const akcio = el.querySelector('[data-hook="item-action"]');
        el.addEventListener('click', () => pgTeljes(gal, i, akcio));
        if (akcio) akcio.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pgTeljes(gal, i, akcio); } });
      });
    }

    const sc = par.querySelector('.gallery-horizontal-scroll');
    const belso = sc && sc.querySelector('.gallery-horizontal-scroll-inner');
    if (!belso || elemek.length < 2) continue;
    const N = elemek.length;
    const kov = par.querySelector('[data-hook="nav-arrow-next"]');
    let elo = par.querySelector('[data-hook="nav-arrow-back"]');
    if (kov && !elo) {
      // a Wix ugyanezt a gombot rajzolja balra, tukrozott nyillal
      elo = kov.cloneNode(true);
      elo.dataset.hook = 'nav-arrow-back';
      elo.setAttribute('aria-label', 'Previous Item');
      elo.style.left = kov.style.right || '23px';
      elo.style.right = '';
      const s = elo.querySelector('svg');
      if (s) s.style.transform = 'scaleX(-1) scale(1)';
      kov.before(elo);
    }
    // a Wix az elemet a sav kozepere hozza (a /migren-piercing csuszkajan: 463 px-es elem, 5 px
    // margo, 468 px-es sav -> 476, 949, ...), az utolso elemnel a tartalom vegeig (margo nelkul)
    const kozepek = () => { const a = sc.getBoundingClientRect().left - sc.scrollLeft; return elemek.map((e) => { const r = e.getBoundingClientRect(); return r.left - a + r.width / 2; }); };
    const celX = (i) => {
      const margo = parseFloat(getComputedStyle(elemek[N - 1]).marginRight) || 0;
      return Math.max(0, Math.round(Math.min(kozepek()[i] - sc.clientWidth / 2, sc.scrollWidth - sc.clientWidth - margo)));
    };
    const index = () => {
      const k = kozepek(), x = sc.scrollLeft + sc.clientWidth / 2;
      let b = 0;
      for (let i = 1; i < N; i++) if (Math.abs(k[i] - x) < Math.abs(k[b] - x)) b = i;
      return b;
    };
    // belyegkepsav
    const tsav = par.querySelector('[data-hook="gallery-thumbnails"]');
    const oszlop = tsav && tsav.querySelector('[data-hook="gallery-thumbnails-column"]');
    const belyegek = oszlop ? [...oszlop.querySelectorAll('.thumbnailItem')] : [];
    let tb = null;
    if (belyegek.length > 1 && belyegek[1].style.left) {
      const b0 = belyegek[0];
      tb = { lepes: parseFloat(belyegek[1].style.left) - (parseFloat(b0.style.left) || 0), meret: parseFloat(b0.style.width), margo: parseFloat(b0.style.marginLeft) || 0, sav: parseFloat(tsav.style.width) || tsav.clientWidth, kep: {} };
      for (const b of belyegek) tb.kep[b.dataset.key] = b.style.backgroundImage;
    }
    const belyegRajz = (i) => {
      if (!tb) return;
      const kezd = Math.max(0, Math.min(i - Math.floor(belyegek.length / 2), N - belyegek.length));
      belyegek.forEach((b, j) => {
        const k = kezd + j;
        if (k >= N) { b.style.display = 'none'; return; }
        b.style.display = '';
        b.dataset.mpIdx = k;
        b.dataset.key = gal.ids[k];
        b.style.left = k * tb.lepes + 'px';
        b.style.backgroundImage = tb.kep[gal.ids[k]] || `url("${gal.kepek[k]}")`;
        b.classList.toggle('pro-gallery-highlight', k === i);
      });
      oszlop.style.left = Math.min(0, tb.sav / 2 - (i * tb.lepes + tb.margo + tb.meret / 2)) + 'px';
    };
    const allapot = (i) => {
      if (elo) elo.style.display = i > 0 ? '' : 'none';
      if (kov) kov.style.display = i < N - 1 ? '' : 'none';
      belyegRajz(i);
    };
    let fut = false, cel = 0;
    const lapoz = (i) => {
      i = Math.max(0, Math.min(N - 1, i));
      if (fut) return;
      fut = true;
      cel = i;
      allapot(i);
      pgCsusztat(sc, belso, celX(i), () => { fut = false; });
    };
    if (kov) kov.addEventListener('click', (e) => { e.preventDefault(); lapoz((fut ? cel : index()) + 1); });
    if (elo) elo.addEventListener('click', (e) => { e.preventDefault(); lapoz((fut ? cel : index()) - 1); });
    for (const b of belyegek) b.addEventListener('click', () => { if (b.dataset.mpIdx) lapoz(+b.dataset.mpIdx); });
    let ido = 0;
    sc.addEventListener('scroll', () => {
      if (fut) return;
      clearTimeout(ido);
      ido = setTimeout(() => allapot(index()), 100);
    }, { passive: true });
    allapot(index());
  }
  // a Wix a ?pgid=... cimmel nyilo oldalon rogton a teljes kepernyos nezetet mutatja
  const pgid = new URLSearchParams(location.search).get('pgid');
  if (pgid) {
    for (const gal of pgGaleriak) {
      const i = gal.ids.findIndex((id) => pgid === gal.id + '-' + id);
      if (i >= 0) { pgTeljes(gal, i, null); break; }
    }
  }

  // --- 13. videolejatszo (Wix VideoPlayer, "Playable") -----------------------------------
  // A mentett oldalon a Wix lejatszo teljes DOM-ja megvan (a vezerlok rejtve), folotte a borito
  // (data-testid="playable-cover"). Az eles oldalon merve (2026-10-10, /3-piercing-2-araert):
  // - a boritora kattintva a borito eltunik es a video helyben indul; a vezerlok (felso / also
  //   sav) megjelennek: screen-block QGS4E_ -> oRkC28, top-block -qxe1Uw, bottom-block -SyVT0n;
  // - lejatszas kozben a vezerlok az eger tavozasakor rogton, mozdulatlan egernel kb. 2 mp
  //   mulva eltunnek (top-block -FyWkdw, bottom-block -dGEJNK, screen-block +aXrXkB);
  //   szunetben latszanak;
  // - a kepre kattintas lejatszas / szunet, kozepen felvillano jellel (.upGNDJ > .xGKNX2);
  // - lejatszas gomb: U10_e9 + "Play" / "Pause", data-playable-is-playing; nemitas: LSYah9 rbNMd9 +
  //   "Unmute", a hangero-sav 0%; a video vegen a borito visszajon.
  const VJ_SZUNET = '<svg class="Bf5r6b Nkf_4l" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 14"><path fill="#FFF" fill-rule="evenodd" d="M7 0h3v14H7V0zM0 0h3v14H0V0z"></path></svg>';
  const VJ_LEJATSZAS = '<svg class="NVmRhj Nkf_4l" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 14"><path fill="#FFF" fill-rule="evenodd" d="M.079 0L0 14l10.5-7.181z"></path></svg>';
  const percMp = (s) => { s = Math.max(0, Math.floor(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  for (const lj of document.querySelectorAll('[data-testid="playable"]')) {
    const v = lj.querySelector('video');
    const h = (n, tag) => lj.querySelector(`${tag || ''}[data-playable-hook="${n}"]`);
    const kont = h('player-container'), kepernyo = h('screen-block'), felso = h('top-block'), also = h('bottom-block');
    if (!v || !kont || !kepernyo || !felso || !also) continue;
    const gyoker = lj.parentElement;
    const borito = gyoker.querySelector('[data-testid="playable-cover"]');
    const boritoHely = borito && [borito.parentElement, borito.nextSibling];
    const lejatszoBurok = h('playback-control', 'div'), lejatszoGomb = h('playback-control', 'button');
    const nemit = h('mute-button'), hangero = h('volume-control'), hangeroSav = h('volume-input'), hangeroBlokk = h('volume-input-block');
    const halad = h('progress-control'), lejatszott = h('progress-played'), puffer = h('progress-buffered'), csuszka = h('progress-seek-button');
    const ido = h('time-control'), most = h('current-time-indicator'), hossz = h('duration-time-indicator');
    const teljesGomb = h('full-screen-button'), pipGomb = h('picture-in-picture-control', 'button');
    const jelzo = lj.querySelector('.upGNDJ');

    const vezerlok = (lathato) => {
      felso.classList.toggle('FyWkdw', lathato);
      also.classList.toggle('dGEJNK', lathato);
      kepernyo.classList.toggle('aXrXkB', !lathato);
    };
    let rejtes = 0;
    const mutat = () => {
      vezerlok(true);
      clearTimeout(rejtes);
      if (!v.paused) rejtes = setTimeout(() => vezerlok(false), 2000);
    };
    // mobilon a Wix a vezerloket nem mutatja, es a kepre koppintas sem allitja meg (merve)
    let elindult = MOBIL_LAP;
    const indit = () => {
      if (!elindult) {
        elindult = true;
        kepernyo.classList.replace('QGS4E_', 'oRkC28');
        felso.classList.remove('qxe1Uw');
        also.classList.remove('SyVT0n');
        kont.tabIndex = 0;
      }
      if (borito && borito.isConnected) borito.remove();
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    };
    const allapot = () => {
      const megy = !v.paused && !v.ended;
      if (lejatszoBurok) lejatszoBurok.dataset.playableIsPlaying = String(megy);
      if (lejatszoGomb) {
        lejatszoGomb.classList.toggle('U10_e9', !megy);
        lejatszoGomb.setAttribute('aria-label', megy ? 'Pause' : 'Play');
      }
      if (MOBIL_LAP) return;
      if (megy) mutat(); else { clearTimeout(rejtes); vezerlok(true); }
    };
    const frissit = () => {
      const d = isFinite(v.duration) ? v.duration : 0, t = v.currentTime || 0, a = d ? Math.min(1, t / d) : 0;
      const sz = +(a * 100).toFixed(2);
      if (lejatszott) lejatszott.style.transform = `scaleX(${+a.toFixed(3)})`;
      if (csuszka && halad) csuszka.style.transform = `translateX(${+(a * halad.clientWidth).toFixed(3)}px)`;
      if (halad) {
        halad.setAttribute('aria-valuetext', `Already played ${sz}%`);
        halad.setAttribute('aria-valuenow', sz.toFixed(2));
        halad.dataset.playablePlayedPercent = sz.toFixed(2);
      }
      if (ido) { ido.dataset.playableCurrentTime = String(t); ido.dataset.playableDuration = String(d); }
      if (most) most.textContent = percMp(t);
      if (hossz) hossz.textContent = percMp(d);
      if (puffer && d && v.buffered.length) puffer.style.width = Math.min(100, v.buffered.end(v.buffered.length - 1) / d * 100) + '%';
    };
    const hang = () => {
      const csend = v.muted || v.volume === 0, sz = csend ? 0 : Math.round(v.volume * 100);
      if (hangero) { hangero.dataset.playableVolumePercent = String(sz); hangero.dataset.playableIsMuted = String(csend); }
      if (hangeroSav) hangeroSav.style.width = sz + '%';
      if (hangeroBlokk) { hangeroBlokk.setAttribute('value', String(sz)); hangeroBlokk.setAttribute('aria-valuenow', String(sz)); }
      if (nemit) {
        nemit.classList.toggle('sBQrEF', !csend);
        nemit.classList.toggle('LSYah9', csend);
        nemit.classList.toggle('rbNMd9', csend);
        nemit.setAttribute('aria-label', csend ? 'Unmute' : 'Mute');
      }
    };
    // buboreksugo a gombok folott (.chEfQZ + D_qOXi): a gomb kozepere igazitva, de a lejatszon belul
    // (a Wixen merve: Mute 22.8 px, Enter Full Screen 108 px egy 226 px-es lejatszon)
    const sugo = lj.querySelector('.chEfQZ'), sugoSzoveg = sugo && sugo.querySelector('[data-playable-hook="tooltip-inner"]');
    const sugoGomb = (g, szoveg) => {
      if (!g || !sugo || !sugoSzoveg) return;
      g.addEventListener('mouseenter', () => {
        sugoSzoveg.textContent = szoveg();
        const szulo = sugo.parentElement.getBoundingClientRect(), r = g.getBoundingClientRect(), w = sugo.offsetWidth;
        const bal = Math.max(0, Math.min(r.left + r.width / 2 - szulo.left - w / 2, szulo.width - w));
        Object.assign(sugo.style, { left: bal + 'px', top: 'initial', bottom: '0px' });
        sugo.classList.add('D_qOXi');
      });
      g.addEventListener('mouseleave', () => sugo.classList.remove('D_qOXi'));
    };
    sugoGomb(nemit, () => (v.muted || v.volume === 0 ? 'Unmute' : 'Mute'));
    sugoGomb(pipGomb, () => (document.pictureInPictureElement ? 'Exit Picture-in-Picture' : 'Play Picture-in-Picture'));
    sugoGomb(teljesGomb, () => (document.fullscreenElement ? 'Exit Full Screen' : 'Enter Full Screen'));
    v.addEventListener('play', allapot);
    v.addEventListener('pause', allapot);
    v.addEventListener('timeupdate', frissit);
    v.addEventListener('loadedmetadata', frissit);
    v.addEventListener('progress', frissit);
    v.addEventListener('volumechange', hang);
    v.addEventListener('ended', () => {
      allapot();
      if (borito && !borito.isConnected) boritoHely[0].insertBefore(borito, boritoHely[1]);
    });

    if (borito) borito.addEventListener('click', (e) => { e.preventDefault(); indit(); });
    // a Wix kb. 200 ms-ot var a kattintas utan (a dupla kattintas teljes kepernyot valt)
    let kattIdo = 0;
    const teljesValt = () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (kont.requestFullscreen) kont.requestFullscreen().catch(() => {});
    };
    kepernyo.addEventListener('click', () => {
      if (MOBIL_LAP) return;
      if (!elindult) { indit(); return; }
      if (kattIdo) { clearTimeout(kattIdo); kattIdo = 0; teljesValt(); return; }
      kattIdo = setTimeout(() => {
        kattIdo = 0;
        const fut = !v.paused && !v.ended;
        if (jelzo) jelzo.innerHTML = `<div class="xGKNX2">${fut ? VJ_SZUNET : VJ_LEJATSZAS}</div>`;
        if (fut) v.pause(); else indit();
      }, 200);
    });
    if (lejatszoGomb) lejatszoGomb.addEventListener('click', (e) => { e.stopPropagation(); if (v.paused || v.ended) indit(); else v.pause(); });
    if (nemit) nemit.addEventListener('click', (e) => { e.stopPropagation(); v.muted = !v.muted; if (!v.muted && v.volume === 0) v.volume = 1; });
    // csuszkak: kattintas / huzas a sav menten
    const huz = (sav, allit) => {
      if (!sav) return;
      const ertek = (e) => { const r = sav.getBoundingClientRect(); return r.width ? Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) : 0; };
      sav.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        allit(ertek(e));
        const mozog = (m) => allit(ertek(m));
        const vege = () => { removeEventListener('pointermove', mozog); removeEventListener('pointerup', vege); };
        addEventListener('pointermove', mozog);
        addEventListener('pointerup', vege);
      });
    };
    huz(halad, (a) => { if (isFinite(v.duration)) { v.currentTime = a * v.duration; frissit(); } });
    huz(hangeroBlokk, (a) => { v.volume = a; v.muted = a === 0; });
    if (teljesGomb) teljesGomb.addEventListener('click', (e) => { e.stopPropagation(); teljesValt(); });
    document.addEventListener('fullscreenchange', () => {
      if (teljesGomb) teljesGomb.setAttribute('aria-label', document.fullscreenElement === kont ? 'Exit full screen' : 'Enter full screen');
    });
    if (pipGomb) pipGomb.addEventListener('click', (e) => {
      e.stopPropagation();
      if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
      else if (v.requestPictureInPicture) v.requestPictureInPicture().catch(() => {});
    });
    kont.addEventListener('keydown', (e) => {
      if (e.target !== kont || (e.key !== ' ' && e.key !== 'Enter')) return;
      e.preventDefault();
      if (v.paused || v.ended) indit(); else v.pause();
    });
    if (MOBIL_LAP) continue;
    lj.addEventListener('mousemove', () => { if (elindult) mutat(); });
    lj.addEventListener('mouseleave', () => { if (elindult && !v.paused) { clearTimeout(rejtes); vezerlok(false); } });
  }

  // --- 14. blogbejegyzes: kepek teljes kepernyon (Wix Ricos) ------------------------------
  // Az eles oldalon merve (2026-10-10): a bejegyzes kepere (vagy a ramutataskor megjeleno
  // "Kep kibontasa" gombra) kattintva feher, teljes kepernyos nezegeto nyilik a bejegyzes osszes
  // kepevel (a kep legfeljebb eredeti meretben, a felso 70 / also 20 px-es savon belul), bal
  // felul nagyitas, jobb felul X, tobb kepnel nyilak; Esc zarja. Mobilon csak X es lapozas.
  const blogKepek = [...document.querySelectorAll('figure[data-hook="figure-IMAGE"] [data-hook="image-viewer"]')];
  if (blogKepek.length) {
    const gal = { blog: true, kepek: blogKepek.map((b) => { const i = b.querySelector('img'); return i ? i.getAttribute('src') : ''; }) };
    blogKepek.forEach((b, i) => {
      if (!gal.kepek[i]) return;
      b.style.cursor = 'pointer';
      b.addEventListener('click', (e) => { e.preventDefault(); pgTeljes(gal, i, b.querySelector('[data-hook="image-expand-button"]')); });
    });
  }

  // --- 15. blog: hozzaszolas (Wix Comments) ---------------------------------------------
  // Az eles oldalon merve (2026-10-10): a "Hozzaszolas irasa..." mezore vagy egy csillagra
  // kattintva a doboz kinyilik: Felhasznalonev, E-mail-cim (nem nyilvanos), ertekeles (a
  // csillagok ramutataskor / kattintasra kitoltodnek), szoveg, "Megse" es "Kozzetetel". A Wix
  // hozzaszolas-szervere a klon mogott nincs: a hozzaszolas e-mailben megy a szalonnak (POST
  // /api/urlap, "blog-hozzaszolas"), es a jovahagyott hozzaszolast a mentes hozza az oldalra.
  // (A Wix-szerkeszto hangulatjel / kep / GIF / video gombjai ezert nincsenek.)
  const CSILLAG_TELI = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.9502,8.8922 C20.8322,8.5282 20.5222,8.2672 20.1432,8.2112 L15.1362,7.4842 L12.8962,2.9472 C12.5572,2.2592 11.4422,2.2592 11.1032,2.9472 L8.8642,7.4842 L3.8562,8.2112 C3.4772,8.2672 3.1682,8.5282 3.0492,8.8922 C2.9312,9.2562 3.0282,9.6502 3.3022,9.9172 L6.9262,13.4492 L6.0712,18.4362 C6.0062,18.8142 6.1582,19.1882 6.4682,19.4132 C6.7782,19.6412 7.1812,19.6692 7.5212,19.4912 L11.9992,17.1352 L16.4792,19.4912 C16.6262,19.5692 16.7862,19.6072 16.9452,19.6072 C17.1512,19.6072 17.3572,19.5412 17.5322,19.4132 C17.8422,19.1882 17.9942,18.8142 17.9292,18.4362 L17.0742,13.4502 L20.6982,9.9172 C20.9722,9.6502 21.0692,9.2562 20.9502,8.8922" fill-rule="evenodd"></path></svg>';
  const hszElem = (tag, osztaly, html) => { const e = document.createElement(tag); e.className = osztaly; if (html) e.innerHTML = html; return e; };
  for (const doboz of document.querySelectorAll('[id^="root-comment-box-start"]')) {
    const helytarto = doboz.querySelector('[data-hook="comment-box-placeholder"]');
    const keret = helytarto && helytarto.parentElement;
    if (!keret) continue;
    const csillagok = [...doboz.querySelectorAll('[data-hook="ratings-input-rating-star-wrapper"]')];
    const ures = csillagok.map((c) => c.querySelector('span').innerHTML);
    let ertek = 0;
    const rajzol = (n) => csillagok.forEach((c, i) => {
      const s = c.querySelector('span');
      const teli = i < n;
      if (c.dataset.mpTeli !== String(teli)) { s.innerHTML = teli ? CSILLAG_TELI : ures[i]; c.dataset.mpTeli = String(teli); }
      c.querySelector('input').checked = i + 1 === ertek;
    });
    let nyitva = false, sor = null, szoveg = null, gombok = null;
    const zar = () => {
      if (!nyitva) return;
      nyitva = false;
      sor.remove();
      gombok.remove();
      szoveg.replaceWith(helytarto);
      doboz.classList.remove('mp-hsz-nyitva');
      ertek = 0;
      rajzol(0);
    };
    const kuld = async () => {
      const [nev, email] = sor.querySelectorAll('input');
      const hibas = [[nev, !nev.value.trim()], [email, !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())], [szoveg, !szoveg.value.trim()]];
      for (const [m, h] of hibas) m.setAttribute('aria-invalid', String(h));
      const elso = hibas.find(([, h]) => h);
      if (elso) { elso[0].focus(); return; }
      const gomb = gombok.querySelector('.mp-hsz-kuld');
      gomb.disabled = true;
      const adat = new FormData();
      adat.append('form-name', 'blog-hozzaszolas');
      adat.append('oldal', decodeURIComponent(location.pathname));
      adat.append('bot-field', '');
      adat.append('Bejegyzés', (document.querySelector('[data-hook="post-title"]') || {}).textContent || document.title);
      adat.append('Felhasználónév', nev.value.trim());
      adat.append('E-mail-cím', email.value.trim());
      adat.append('Értékelés', ertek ? ertek + ' / 5' : '-');
      adat.append('Hozzászólás', szoveg.value.trim());
      let jo = false;
      try { jo = (await fetch('/api/urlap', { method: 'POST', body: adat })).ok; } catch (e) { jo = false; }
      gomb.disabled = false;
      if (!jo) { gomb.textContent = 'Hiba, próbáld újra'; return; }
      zar();
      const uzenet = hszElem('div', 'mp-hsz-uzenet', 'Köszönjük! A hozzászólásodat megkaptuk, jóváhagyás után jelenik meg.');
      keret.after(uzenet);
      setTimeout(() => uzenet.remove(), 8000);
    };
    const nyit = () => {
      if (nyitva) return;
      nyitva = true;
      doboz.classList.add('mp-hsz-nyitva');
      sor = hszElem('div', 'mp-hsz-sor', '<input class="mp-hsz-mezo" name="nev" placeholder="Felhasználónév" autocomplete="name" data-hook="comment-box-username">'
        + '<input class="mp-hsz-mezo" type="email" name="email" placeholder="E-mail-cím (nem nyilvános)" autocomplete="email" data-hook="comment-box-email">');
      keret.parentElement.insertBefore(sor, keret);
      szoveg = hszElem('textarea', 'mp-hsz-szoveg');
      szoveg.placeholder = 'Hozzászólás írása...';
      szoveg.setAttribute('aria-label', 'Hozzászólás írása...');
      helytarto.replaceWith(szoveg);
      gombok = hszElem('div', 'mp-hsz-gombok', '<button type="button" class="mp-hsz-megse" data-hook="secondary-btn">Mégse</button><button type="button" class="mp-hsz-kuld" data-hook="primary-btn">Közzététel</button>');
      keret.after(gombok);
      gombok.querySelector('.mp-hsz-megse').addEventListener('click', zar);
      gombok.querySelector('.mp-hsz-kuld').addEventListener('click', kuld);
      for (const m of [...sor.querySelectorAll('input'), szoveg]) m.addEventListener('input', () => m.removeAttribute('aria-invalid'));
      szoveg.focus();
    };
    helytarto.addEventListener('click', nyit);
    csillagok.forEach((c, i) => {
      c.style.cursor = 'pointer';
      c.addEventListener('mouseenter', () => rajzol(i + 1));
      c.addEventListener('mouseleave', () => rajzol(ertek));
      c.addEventListener('click', (e) => { e.preventDefault(); ertek = i + 1; rajzol(ertek); nyit(); });
    });
  }

  // --- 16. uj Wix-urlap (Wix Forms, /kontroll "Visszahivas kero") -------------------------
  // Az eles oldalon merve (2026-10-10). Bekuldeskor a hianyzo / hibas kotelezo mezok hibat
  // kapnak: a mezo burka ojL_C1u--error + data-error, a text-field-root oNTzDv_--error, a mezo
  // aria-invalid + aria-describedby, alatta a hibauzenet (field-error-*: oeM_EMx--visible, benne
  // a soVQCzh uzenet ikonnal). Az uzenetek: "Add meg az utóneved." (nev), "Add meg a
  // telefonszámot.", "Add meg az e-mail-címet (például pelda@webhelyem.com).", "Válassz dátumot.",
  // egyebkent "Írd be a választ.". Javitaskor a hiba eltunik. A datum a Wix-naptarhoz hasonlo
  // felugroban valaszthato ("2026. 10. 15."), a "Mire kérsz időpontot?" sajat legordulo, a
  // "Feltöltés!" kepeket csatol (a nevuk a gomb alatt). A bekuldes e-mailben megy (/api/urlap).
  const UJ_HIBA_IKON = '<svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20" class="srfS_dD" aria-hidden="true"><path fill-rule="evenodd" d="M9.5,3 C13.084,3 16,5.916 16,9.5 C16,13.084 13.084,16 9.5,16 C5.916,16 3,13.084 3,9.5 C3,5.916 5.916,3 9.5,3 Z M9.5,4 C6.467,4 4,6.467 4,9.5 C4,12.533 6.467,15 9.5,15 C12.533,15 15,12.533 15,9.5 C15,6.467 12.533,4 9.5,4 Z M10,11 L10,12 L9,12 L9,11 L10,11 Z M10,7 L10,10 L9,10 L9,7 L10,7 Z"></path></svg>';
  const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  const ketJegy = (n) => String(n).padStart(2, '0');
  const NYIL_LE = '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg>';
  for (const f of document.querySelectorAll('form')) {
    const kuldGomb = f.querySelector('[data-hook="submit-button"]');
    if (!kuldGomb) continue;
    f.setAttribute('novalidate', '');
    const cimke = (el) => {
      const l = f.querySelector(`[id="${el.id.replace('form-field-input-', 'form-field-label-')}"]`) || f.querySelector(`label[for="${el.id}"]`);
      return ((l && l.childNodes[0] && l.childNodes[0].textContent) || el.getAttribute('aria-label') || '').trim();
    };
    const mezok = [];
    for (const el of f.querySelectorAll('input[id^="form-field-input-"], textarea[id^="form-field-input-"]')) {
      const tarto = el.closest('[data-field-type]');
      let c = el;
      while (c && c !== f && !c.querySelector('[data-hook^="field-error-"]')) c = c.parentElement;
      const hiba = c && c !== f ? c.querySelector('[data-hook^="field-error-"]') : null;
      const tipus = el.tagName === 'TEXTAREA' ? 'szoveg' : el.dataset.hook === 'date-picker-input' ? 'datum'
        : el.type === 'email' ? 'email' : (el.type === 'phone' || el.inputMode === 'tel') ? 'telefon' : 'sor';
      const uzenet = tipus === 'email' ? 'Add meg az e-mail-címet (például pelda@webhelyem.com).' : tipus === 'telefon' ? 'Add meg a telefonszámot.'
        : tipus === 'datum' ? 'Válassz dátumot.' : tarto && tarto.dataset.fieldType === 'CONTACTS_FIRST_NAME' ? 'Add meg az utóneved.' : 'Írd be a választ.';
      mezok.push({ el, tipus, hiba, uzenet, nev: cimke(el) });
    }
    const hibaAllit = (m, van) => {
      const hid = 'form-field-error-' + m.el.id.replace(/^form-field-input-/, '');
      m.el.setAttribute('aria-invalid', String(van));
      if (van) m.el.setAttribute('aria-describedby', hid); else m.el.removeAttribute('aria-describedby');
      if (m.tipus === 'szoveg') {
        const d = m.el.closest('[data-error]');
        if (d) d.dataset.error = String(van);
        const k = m.el.closest('[data-field-type]');
        const burok = k && k.firstElementChild;
        if (burok) { burok.classList.toggle('ogfZBj6--error', van); burok.classList.toggle('stKJdMO', van); }
      } else {
        m.el.dataset.error = String(van);
        const mag = m.el.closest('.svEXDbE');
        if (mag) { mag.classList.toggle('ojL_C1u--error', van); mag.dataset.error = String(van); }
        const gyoker = m.el.closest('[data-hook="text-field-root"]');
        if (gyoker) gyoker.classList.toggle('oNTzDv_--error', van);
        if (m.tipus === 'datum') {
          const ik = m.el.parentElement.querySelector('[data-hook="date-picker-calendar-icon"]');
          if (ik) { ik.setAttribute('aria-invalid', String(van)); if (van) ik.setAttribute('aria-describedby', hid); else ik.removeAttribute('aria-describedby'); }
        }
      }
      if (m.hiba) {
        m.hiba.classList.toggle('oeM_EMx--visible', van);
        m.hiba.innerHTML = van ? `<div id="${hid}" class="soVQCzh" data-hook="errormessagewrapper-message">${UJ_HIBA_IKON}${m.uzenet}</div>` : '';
      }
    };
    const jo = (m) => {
      const v = m.el.value.trim();
      if (m.el.required && !v) return false;
      if (v && m.tipus === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      if (v && m.tipus === 'telefon') return (v.match(/\d/g) || []).length >= 6;
      return true;
    };
    for (const m of mezok) {
      const ures = () => {
        const mag = m.el.closest('.svEXDbE');
        const u = !m.el.value;
        m.el.dataset.emptyState = String(u);
        if (mag) mag.dataset.emptyState = String(u);
      };
      m.el.addEventListener('input', () => { ures(); if (m.el.getAttribute('aria-invalid') === 'true' && jo(m)) hibaAllit(m, false); });
      m.el.addEventListener('change', () => { ures(); if (m.el.getAttribute('aria-invalid') === 'true' && jo(m)) hibaAllit(m, false); });
    }
    // orszagkod-valaszto: a klonban csak magyar (+36) szam; a gomb a telefonmezore visz
    for (const g of f.querySelectorAll('[data-hook="country-selector-trigger"]')) {
      g.addEventListener('click', () => { const t = g.closest('.svEXDbE'); const i = t && t.querySelector('input'); if (i) i.focus(); });
    }
    // naptar
    for (const m of mezok.filter((x) => x.tipus === 'datum')) {
      const mag = m.el.closest('.svEXDbE');
      const ikon = mag && mag.querySelector('[data-hook="date-picker-calendar-icon"]');
      let nyitott = null;
      const ma = new Date();
      let ev = ma.getFullYear(), ho = ma.getMonth(), valasztott = null;
      const zar = () => { if (nyitott) { nyitott.remove(); nyitott = null; document.removeEventListener('mousedown', kivul, true); } };
      const kivul = (e) => { if (nyitott && !nyitott.contains(e.target) && !mag.contains(e.target)) zar(); };
      const rajz = () => {
        const elso = new Date(ev, ho, 1);
        const kezd = new Date(ev, ho, 1 - ((elso.getDay() + 6) % 7));
        let napok = '';
        for (let i = 0; i < 42; i++) {
          const d = new Date(kezd.getFullYear(), kezd.getMonth(), kezd.getDate() + i);
          const mas = d.getMonth() !== ho;
          const mai = d.toDateString() === ma.toDateString();
          const val = valasztott && d.toDateString() === valasztott.toDateString();
          napok += `<button type="button" class="mp-nap${mas ? ' mp-nap-mas' : ''}${mai ? ' mp-nap-ma' : ''}${val ? ' mp-nap-val' : ''}" data-d="${d.getFullYear()}-${d.getMonth()}-${d.getDate()}" aria-label="${d.getFullYear()}. ${HONAPOK[d.getMonth()]} ${d.getDate()}.">${d.getDate()}</button>`;
        }
        const evek = [];
        for (let y = ma.getFullYear() - 5; y <= ma.getFullYear() + 2; y++) evek.push(`<option value="${y}"${y === ev ? ' selected' : ''}>${y}</option>`);
        nyitott.innerHTML = `<div class="mp-naptar-fej"><button type="button" class="mp-naptar-lep" data-l="-1" aria-label="Előző hónap">‹</button>`
          + `<span class="mp-naptar-kozep"><label class="mp-naptar-val">${HONAPOK[ho]}${NYIL_LE}<select class="mp-naptar-ho" aria-label="Hónap">${HONAPOK.map((n, i) => `<option value="${i}"${i === ho ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`
          + `<label class="mp-naptar-val">${ev}${NYIL_LE}<select class="mp-naptar-ev" aria-label="Év">${evek.join('')}</select></label></span>`
          + `<button type="button" class="mp-naptar-lep" data-l="1" aria-label="Következő hónap">›</button></div>`
          + `<div class="mp-naptar-het">${['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((n) => `<span>${n}</span>`).join('')}</div>`
          + `<div class="mp-naptar-napok">${napok}</div>`
          + (MOBIL_LAP ? '<button type="button" class="mp-naptar-bezar">Bezárás</button>' : '');
      };
      const nyit = (e) => {
        if (e) e.preventDefault();
        if (nyitott) { zar(); return; }
        nyitott = document.createElement('div');
        // mobilon a Wix a kepernyo kozepen nyitja, "Bezárás" gombbal
        nyitott.className = 'mp-naptar' + (MOBIL_LAP ? ' mp-naptar-mobil' : '');
        nyitott.setAttribute('role', 'dialog');
        nyitott.setAttribute('aria-label', 'Naptár');
        rajz();
        mag.parentElement.style.position = 'relative';
        mag.after(nyitott);
        nyitott.addEventListener('click', (ev2) => {
          if (ev2.target.closest('.mp-naptar-bezar')) { zar(); return; }
          const lep = ev2.target.closest('.mp-naptar-lep');
          if (lep) { ho += +lep.dataset.l; if (ho < 0) { ho = 11; ev--; } if (ho > 11) { ho = 0; ev++; } rajz(); return; }
          const nap = ev2.target.closest('.mp-nap');
          if (nap) {
            const [y, mo, d] = nap.dataset.d.split('-').map(Number);
            valasztott = new Date(y, mo, d);
            m.el.value = `${y}. ${ketJegy(mo + 1)}. ${ketJegy(d)}.`;
            m.el.dispatchEvent(new Event('change', { bubbles: true }));
            zar();
          }
        });
        nyitott.addEventListener('change', (ev2) => {
          if (ev2.target.classList.contains('mp-naptar-ho')) ho = +ev2.target.value;
          if (ev2.target.classList.contains('mp-naptar-ev')) ev = +ev2.target.value;
          rajz();
        });
        document.addEventListener('mousedown', kivul, true);
      };
      if (ikon) ikon.addEventListener('click', nyit);
      if (mag) mag.addEventListener('click', (e) => { if (!ikon || !ikon.contains(e.target)) nyit(e); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zar(); });
    }
    // legordulo (a Wixen mert 6 lehetoseg)
    const LEHETOSEGEK = ['Kontroll - Meglévő vendégeknek - 0 Ft', 'Konzultáció - Új vendégeknek - 5.000 Ft', 'Garanciális szúrás - 5.000 Ft',
      'Ékszer csere - Nálunk vásárolt ékszerrel - 5.000 Ft', 'Ékszer csere - Hozott ékszerrel - 2.000 Ft', 'Sebkezelés / Tisztítás  - 2.000 Ft'];
    const legordulok = [];
    for (const gomb of f.querySelectorAll('[data-hook="dropdown-base"]')) {
      const szoveg = gomb.querySelector('[data-hook="dropdown-base-text"]');
      const tarto = gomb.closest('[data-hook="popover-element"]') || gomb.parentElement;
      const lg = { gomb, ertek: '', nev: (f.querySelector(`[id="${gomb.getAttribute('aria-labelledby')}"]`) || {}).textContent || gomb.getAttribute('aria-label') || '' };
      legordulok.push(lg);
      let lista = null;
      const zar = () => {
        if (!lista) return;
        lista.remove();
        lista = null;
        gomb.setAttribute('aria-expanded', 'false');
        const ikon = gomb.querySelector('[data-hook="suffix-icon"] svg');
        if (ikon) ikon.style.transform = '';
        document.removeEventListener('mousedown', kivul, true);
      };
      const kivul = (e) => { if (lista && !lista.contains(e.target) && !gomb.contains(e.target)) zar(); };
      gomb.addEventListener('click', (e) => {
        e.preventDefault();
        if (lista) { zar(); return; }
        lista = document.createElement('div');
        lista.className = 'mp-legordulo';
        lista.setAttribute('role', 'listbox');
        lista.innerHTML = LEHETOSEGEK.map((o) => `<div role="option" class="mp-legordulo-elem" aria-selected="${o === lg.ertek}">${o}</div>`).join('');
        tarto.style.position = 'relative';
        tarto.appendChild(lista);
        gomb.setAttribute('aria-expanded', 'true');
        const ikon = gomb.querySelector('[data-hook="suffix-icon"] svg');
        if (ikon) ikon.style.transform = 'rotate(180deg)';
        lista.addEventListener('click', (ev2) => {
          const o = ev2.target.closest('[role="option"]');
          if (!o) return;
          lg.ertek = o.textContent;
          if (szoveg) szoveg.textContent = lg.ertek;
          gomb.classList.remove('o_uTWgF--placeholder');
          zar();
        });
        document.addEventListener('mousedown', kivul, true);
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') zar(); });
    }
    // mobilon a legordulo a bongeszo sajat valasztoja (a Wixen is): valasztas utan nem halvany
    for (const sel of f.querySelectorAll('select[data-hook="native-select"]')) {
      sel.addEventListener('change', () => sel.classList.toggle('opHmsAa--placeholder', !sel.value));
    }
    // feltoltes: a "Feltöltés!" gomb a rejtett fajlmezot nyitja, a kivalasztott fajlok neve alatta
    const fajlMezo = f.querySelector('input[type="file"]');
    if (fajlMezo) {
      const fg = fajlMezo.parentElement.querySelector('button');
      let lista = null;
      if (fg) fg.addEventListener('click', (e) => { e.preventDefault(); fajlMezo.click(); });
      fajlMezo.addEventListener('change', () => {
        if (!lista) { lista = document.createElement('div'); lista.className = 'mp-fajlok'; fajlMezo.parentElement.after(lista); }
        lista.textContent = '';
        for (const x of fajlMezo.files) { const s = document.createElement('div'); s.textContent = x.name; lista.appendChild(s); }
      });
    }
    const felirat = kuldGomb.querySelector('span') || kuldGomb;
    const eredetiFelirat = felirat.textContent;
    kuldGomb.addEventListener('click', async (e) => {
      e.preventDefault();
      let elso = null;
      for (const m of mezok) { const ok = jo(m); hibaAllit(m, !ok); if (!ok && !elso) elso = m; }
      if (elso) { (elso.tipus === 'datum' ? elso.el.closest('.svEXDbE') : elso.el).scrollIntoView({ block: 'center' }); if (elso.tipus !== 'datum') elso.el.focus({ preventScroll: true }); return; }
      const adat = new FormData();
      adat.append('form-name', 'kontroll-visszahivas');
      adat.append('oldal', decodeURIComponent(location.pathname));
      adat.append('bot-field', '');
      for (const m of mezok) {
        let v = m.el.value.trim();
        if (m.tipus === 'telefon' && v && !v.startsWith('+')) v = '+36 ' + v.replace(/^0*(36)?/, '');
        adat.append(m.nev, v);
      }
      for (const lg of legordulok) adat.append(lg.nev.trim(), lg.ertek || '-');
      for (const sel of f.querySelectorAll('select[data-hook="native-select"]')) {
        adat.append(sel.getAttribute('aria-label') || sel.name, sel.value ? sel.options[sel.selectedIndex].textContent : '-');
      }
      if (fajlMezo) for (const x of fajlMezo.files) adat.append('Kép', x);
      kuldGomb.setAttribute('aria-disabled', 'true');
      try {
        const v = await fetch('/api/urlap', { method: 'POST', body: adat });
        if (!v.ok) throw new Error(String(v.status));
        felirat.textContent = 'Köszönjük, megkaptuk!';
        f.reset();
        for (const m of mezok) m.el.dispatchEvent(new Event('input'));
        for (const lg of legordulok) { lg.ertek = ''; const s = lg.gomb.querySelector('[data-hook="dropdown-base-text"]'); if (s) s.textContent = ''; lg.gomb.classList.add('o_uTWgF--placeholder'); }
        for (const sel of f.querySelectorAll('select[data-hook="native-select"]')) sel.classList.add('opHmsAa--placeholder');
        const fl = f.querySelector('.mp-fajlok');
        if (fl) fl.textContent = '';
      } catch (x) {
        felirat.textContent = 'Hiba történt, próbáld újra!';
        setTimeout(() => { felirat.textContent = eredetiFelirat; }, 4000);
      }
      kuldGomb.setAttribute('aria-disabled', 'false');
    });
  }
})();
