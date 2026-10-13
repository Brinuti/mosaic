// Az uj, rejtett fooldal (/uj-fooldal) viselkedese. Onallo: a Wix-klon klon.js-e nem fut ezen a lapon.
// 1. fejlec (gorgetes-arnyek, mobilmenu, lenyilo almenuk)   2. "Osszes piercing tipus", ekszer-galeria   3. videoablak
// 4. Google-velemenyek: Trustindex-widget (tartalek, ha nem toltodik be), kitelepulesi idopontok
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
    $('use', nyito).setAttribute('href', '#i-menu');
    document.documentElement.style.overflow = '';
  };
  nyito.addEventListener('click', () => {
    const nyit = !fejlec.classList.contains('menu-nyitva');
    fejlec.classList.toggle('menu-nyitva', nyit);
    nyito.setAttribute('aria-expanded', String(nyit));
    nyito.setAttribute('aria-label', nyit ? 'Menü bezárása' : 'Menü megnyitása');
    $('use', nyito).setAttribute('href', nyit ? '#i-close' : '#i-menu');
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

  // --- 2c. nagyito: az ekszerkepre kattintva nagyban nyilik (nyilak, billentyuzet, ujjal huzas; Esc / hatter zar) -------------------
  const nagyito = $('#nagyito');
  if (galeria && nagyito && typeof nagyito.showModal === 'function') {
    const diakGomb = $$('.dia-nagyit', galeria);
    const kep = $('.nagyito-kep', nagyito), szam = $('[data-n]', nagyito);
    let idx = 0;
    const mutat = (i) => {
      idx = (i + diakGomb.length) % diakGomb.length;
      kep.src = diakGomb[idx].dataset.nagy;
      kep.alt = $('img', diakGomb[idx]).alt;
      szam.textContent = String(idx + 1);
      const kov = diakGomb[(idx + 1) % diakGomb.length]; if (kov) new Image().src = kov.dataset.nagy;   // a kovetkezo elore toltodik
    };
    diakGomb.forEach((g, i) => g.addEventListener('click', () => { mutat(i); nagyito.showModal(); }));
    $('.nagyito-elozo', nagyito).addEventListener('click', () => mutat(idx - 1));
    $('.nagyito-kov', nagyito).addEventListener('click', () => mutat(idx + 1));
    $('.nagyito-zar', nagyito).addEventListener('click', () => nagyito.close());
    nagyito.addEventListener('click', (e) => { if (e.target === nagyito) nagyito.close(); });
    nagyito.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); mutat(idx + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); mutat(idx - 1); }
    });
    let x0 = null;
    nagyito.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    nagyito.addEventListener('touchend', (e) => { if (x0 === null) return; const d = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(d) > 50) mutat(idx + (d < 0 ? 1 : -1)); }, { passive: true });
    nagyito.addEventListener('close', () => { kep.removeAttribute('src'); });
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

  // --- 4. Google-velemenyek: a Trustindex-widget (az oldalban a loader.js tolti, lapozhato); ha 9 mp alatt nem jelenik meg, a mentett tartalek latszik ---
  // A Trustindex-loader a widgetet csak a lap kozeleben, felhasznaloi tevekenyseg utan tolti: a 9 masodperc attol szamit, hogy a doboz kozel er a kepernyohoz
  // (a lap aljan levo doboz, pl. a kategoria-oldalakon, nem mutat tartalekot, amig a latogato oda nem gorget).
  const tiHely = $('[data-trustindex]'), tartalek = $('[data-tartalek]');
  if (tiHely && tartalek) {
    const indit = () => window.setTimeout(() => { if (!$('.ti-widget', tiHely)) tartalek.hidden = false; }, 9000);
    if ('IntersectionObserver' in window) {
      const figyel = new IntersectionObserver((e) => { if (e[0].isIntersecting) { figyel.disconnect(); indit(); } }, { rootMargin: '600px' });
      figyel.observe(tiHely);
    } else indit();
  }

  // --- 4c. a hos ertekeles-sora (kategoria-oldalak): a pontszam es a vélemenyek szama a Trustindex-widget fejlecebol (/api/ertekeles), a build idejen irt szoveg tartalek ---
  const ertekelesek = $$('[data-ti-ertekeles]');
  if (ertekelesek.length && window.fetch) {
    fetch('/api/ertekeles').then((v) => (v.ok ? v.json() : null)).then((a) => {
      if (!a || !a.db || !a.pont) return;
      const szoveg = a.szoveg + ' – ' + String(a.pont).replace('.', ',') + ' – ' + a.db.toLocaleString('hu-HU') + ' vélemény »';
      ertekelesek.forEach((e) => { e.textContent = szoveg; });
    }).catch(() => { /* marad a build idejen irt szoveg */ });
  }

  // --- 4b. kitelepulesek: a helyszin-csempek friss idopontjai (a build mar beirta; itt a tablazat mostani allapota, /api/kitelepulesek) ---
  const ROVID = { 'Január': 'Jan.', 'Február': 'Febr.', 'Március': 'Márc.', 'Április': 'Ápr.', 'Május': 'Máj.', 'Június': 'Jún.', 'Július': 'Júl.', 'Augusztus': 'Aug.', 'Szeptember': 'Szept.', 'Október': 'Okt.', 'November': 'Nov.', 'December': 'Dec.' };
  const rovid = (sor) => sor.replace(/^[^\s\d]+/, (h) => ROVID[h] || h).replace(/,\s*/g, ',\u2009');
  const datumok = $$('[data-mp-kitelepules]');
  if (datumok.length && window.fetch) {
    fetch('/api/kitelepulesek').then((v) => (v.ok ? v.json() : null)).then((adat) => {
      if (!adat || !adat.sorok) return;
      for (const d of datumok) {
        const sorok = adat.sorok[d.dataset.mpKitelepules];
        if (sorok && sorok.length) d.replaceChildren(...sorok.map(d.hasAttribute('data-teljes') ? (x) => x : rovid).flatMap((x, i) => (i ? [document.createElement('br'), x] : [x])));
      }
    }).catch(() => { /* marad a build idejen beirt allapot */ });
  }

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
