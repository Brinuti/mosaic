// Az uj, rejtett fooldal (/uj-fooldal) viselkedese. Onallo: a Wix-klon klon.js-e nem fut ezen a lapon.
// 1. fejlec (gorgetes-arnyek, mobilmenu, lenyilo almenuk)   2. "Osszes piercing tipus", ekszer-galeria   3. videoablak
// 4. Google-velemenyek: a mentett adatok elesben frissulnek a Trustindex-widgetbol (hiba eseten marad a mentett)
// 5. URL-parameterek megorzese es a foglalasi linkek (a klon.js 8. szakaszanak mase: ugyanaz a munkamenet-kulcs)
// A foglalasi gombok (/idopontfoglalas, /kontroll) a motor-indito.js-t hasznaljak (a build teszi a lapra), meres a suti.js-ben.
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // --- 1. fejlec -------------------------------------------------------------------------------------------
  const fejlec = $('#fejlec');
  const gorgetes = () => fejlec.classList.toggle('gorgetve', window.scrollY > 6);
  gorgetes();
  window.addEventListener('scroll', gorgetes, { passive: true });

  const nyito = $('#menu-nyito');
  const menuZar = () => {
    fejlec.classList.remove('menu-nyitva');
    nyito.setAttribute('aria-expanded', 'false');
    nyito.setAttribute('aria-label', 'Menü megnyitása');
    document.documentElement.style.overflow = '';
  };
  nyito.addEventListener('click', () => {
    const nyit = !fejlec.classList.contains('menu-nyitva');
    fejlec.classList.toggle('menu-nyitva', nyit);
    nyito.setAttribute('aria-expanded', String(nyit));
    nyito.setAttribute('aria-label', nyit ? 'Menü bezárása' : 'Menü megnyitása');
    document.documentElement.style.overflow = nyit ? 'hidden' : '';
  });
  // a menü linkjére kattintva a mobilmenü bezárul (a lapon belüli horgonyoknál is)
  $('#menu').addEventListener('click', (e) => { if (e.target.closest('a')) { menuZar(); lenyiloZar(); } });
  window.matchMedia('(min-width: 1001px)').addEventListener('change', (e) => { if (e.matches) menuZar(); });

  const lenyilok = $$('.lenyilo');
  const lenyiloZar = (except) => lenyilok.forEach((l) => {
    if (l === except) return;
    l.classList.remove('nyitva');
    $('.menu-gomb', l).setAttribute('aria-expanded', 'false');
  });
  lenyilok.forEach((l) => {
    const gomb = $('.menu-gomb', l);
    gomb.addEventListener('click', () => {
      const nyit = !l.classList.contains('nyitva');
      lenyiloZar(l);
      l.classList.toggle('nyitva', nyit);
      gomb.setAttribute('aria-expanded', String(nyit));
    });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.lenyilo')) lenyiloZar(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    lenyiloZar(); menuZar();
  });

  // --- 2. osszes piercing tipus ----------------------------------------------------------------------------
  const tobb = $('#tobb-piercing');
  if (tobb) {
    const cimke = tobb.firstChild;
    const eredeti = cimke.textContent;
    tobb.addEventListener('click', () => {
      const nyit = tobb.getAttribute('aria-expanded') !== 'true';
      $$('.kartya.tovabbi').forEach((k) => { k.hidden = !nyit; });
      tobb.setAttribute('aria-expanded', String(nyit));
      cimke.textContent = nyit ? 'Kevesebb típus megjelenítése ' : eredeti;
    });
  }

  // --- 2b. ekszer-galeria: helyben lapozhato (nyilak, ujjal huzas, billentyuzet), a kovetkezo kepek elore toltodnek ----------------
  const galeria = $('#galeria-sav');
  if (galeria) {
    const diak = $$('.dia', galeria);
    const elozo = $('.galeria-elozo'), kovetkezo = $('.galeria-kov'), szamlalo = $('[data-aktualis]');
    const index = () => Math.max(0, Math.min(diak.length - 1, Math.round(galeria.scrollLeft / Math.max(1, galeria.clientWidth))));
    const frissit = () => {
      const i = index();
      szamlalo.textContent = String(i + 1);
      elozo.disabled = i === 0;
      kovetkezo.disabled = i === diak.length - 1;
      // a kovetkezo ket kep (es az elozo) azonnal toltodik, hogy lapozaskor mar kesz legyen
      [i - 1, i + 1, i + 2].forEach((j) => { const im = diak[j] && $('img', diak[j]); if (im && im.loading === 'lazy') im.loading = 'eager'; });
    };
    const lapoz = (d) => galeria.scrollTo({ left: (index() + d) * galeria.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    elozo.addEventListener('click', () => lapoz(-1));
    kovetkezo.addEventListener('click', () => lapoz(1));
    galeria.addEventListener('scroll', () => window.requestAnimationFrame(frissit), { passive: true });
    galeria.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); lapoz(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); lapoz(-1); }
    });
    window.addEventListener('resize', frissit);
    frissit();
  }

  // --- 3. videoablak ---------------------------------------------------------------------------------------
  const ablak = $('#videoablak');
  if (ablak && typeof ablak.showModal === 'function') {
    const keret = $('.videoablak-keret', ablak);
    const bezar = () => { if (ablak.open) ablak.close(); };
    ablak.addEventListener('close', () => { keret.textContent = ''; });
    $('.videoablak-zar', ablak).addEventListener('click', bezar);
    ablak.addEventListener('click', (e) => { if (e.target === ablak) bezar(); });
    $$('a.video[data-embed]').forEach((a) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const f = document.createElement('iframe');
      f.src = a.dataset.embed;
      f.title = a.dataset.cim || 'Videó';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      keret.textContent = '';
      keret.appendChild(f);
      ablak.showModal();
    }));
  }

  // --- 4. Google-velemenyek: elo frissites a Trustindex-widgetbol -------------------------------------------
  // Ugyanaz a widget, amit az eles oldal (assets/embed/f18724_bff0f1a0...html) is betolt; a tartalmat a Trustindex a sajat
  // CDN-jen adja. Csak szamot es szoveget olvasunk ki (textContent), semmi nem kerul innerHTML-be.
  const TRUSTINDEX = 'https://cdn.trustindex.io/widgets/78/783989431b063202f926c7609f9/content.html';
  const velemenyFrissit = async () => {
    const lista = $('[data-velemenyek]');
    if (!lista) return;
    const v = await fetch(TRUSTINDEX, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!v.ok) return;
    const doc = new DOMParser().parseFromString(await v.text(), 'text/html');
    const pont = parseFloat(($('.ti-header-rating', doc) || {}).textContent);
    const darab = parseInt((($('.ti-header-rating-reviews', doc) || {}).textContent || '').replace(/\D/g, ''), 10);
    if (!(pont >= 3.5 && pont <= 5) || !(darab >= 100 && darab < 1e6)) return;
    const pontSzoveg = pont.toFixed(1);
    $$('[data-ertekeles]').forEach((e) => { e.textContent = pontSzoveg; });
    $$('[data-darab]').forEach((e) => { e.textContent = String(darab).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); });
    const csillag = $('.csillagok[role="img"]'); if (csillag) csillag.setAttribute('aria-label', '5 csillagból ' + pontSzoveg.replace('.', ','));
    // a legfrissebb jó (4-5 csillagos), szöveges vélemények a mentett kártyák helyére
    const friss = $$('.ti-review-item', doc).map((it) => ({
      nev: (($('.ti-name', it) || {}).textContent || '').trim(),
      szoveg: (($('.ti-review-content', it) || {}).textContent || '').trim(),
      csillag: Math.round(parseFloat(it.getAttribute('data-rating')) || 0),
    })).filter((r) => r.nev && r.szoveg.length > 20 && r.csillag >= 4).slice(0, 2);
    const kartyak = $$('article.velemeny', lista);
    if (friss.length < 2 || kartyak.length < 2) return;
    friss.forEach((r, i) => {
      const k = kartyak[i];
      $('.monogram', k).textContent = r.nev.charAt(0).toUpperCase();
      $('header b', k).textContent = r.nev;
      $('p', k).textContent = r.szoveg;
      $('.csillagok', k).setAttribute('aria-label', r.csillag + ' csillag');
    });
  };
  const kesleltet = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
  window.addEventListener('load', () => kesleltet(() => { velemenyFrissit().catch(() => { /* marad a mentett adat */ }); }));

  // --- 5. URL-parameterek megorzese es a foglalasi linkek (klon.js 8.) --------------------------------------
  const MENTETT = 'savedQueryParams';
  const GK = /^(gclid|gbraid|wbraid)$/i;
  try {
    const most = new URLSearchParams(location.search);
    if ([...most.keys()].length) {
      // a Google-kattintasazonositot hozzajarulas nelkul NEM taroljuk (a belso linkek viszik tovabb, lent)
      const ment = Object.fromEntries([...most].filter(([k]) => !GK.test(k)));
      if (Object.keys(ment).length) sessionStorage.setItem(MENTETT, JSON.stringify(ment));
    } else {
      const m0 = JSON.parse(sessionStorage.getItem(MENTETT) || 'null');
      const m = m0 && typeof m0 === 'object' ? Object.fromEntries(Object.entries(m0).filter(([k]) => !GK.test(k))) : null;
      if (m && Object.keys(m).length) history.replaceState(history.state, '', location.pathname + '?' + new URLSearchParams(m) + location.hash);
    }
  } catch (x) { /* privat mod / hibas mentes: marad a cim */ }
  // A Salonic-linkek viszik az fbclid / ttclid / utm_* parametereket (a Google-kattintasazonositot nem), a sajat tartomany
  // belso linkjei a Google-kattintasazonositot (hogy egy masik belso oldalon elfogadott suti utan is meglegyen).
  const TOVABB = /^(fbclid|gclid|gbraid|wbraid|ttclid|utm_[a-z_]+)$/i;
  const SALONIC = /^https?:\/\/medicalpiercing\.salonic\.hu(\/|$)/i;
  const kiegeszit = (a) => {
    const href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    let u;
    try { u = new URL(href, location.href); } catch (x) { return; }
    const salonic = SALONIC.test(u.href);
    const belso = u.origin === location.origin && /^https?:$/.test(u.protocol);
    if (!salonic && !belso) return;
    let valtozott = false;
    for (const [k, v] of new URLSearchParams(location.search)) {
      if (!v || u.searchParams.has(k)) continue;
      if (salonic ? (TOVABB.test(k) && !GK.test(k)) : GK.test(k)) { u.searchParams.set(k, v); valtozott = true; }
    }
    if (valtozott) a.setAttribute('href', u.href);
  };
  $$('a[href]').forEach(kiegeszit);
  ['click', 'auxclick', 'contextmenu'].forEach((esemeny) => {
    document.addEventListener(esemeny, (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (a) kiegeszit(a); }, true);
  });
})();
