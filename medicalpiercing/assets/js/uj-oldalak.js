// Az uj, rejtett oldalak (/uj/...) viselkedese. A fejlec / menu / videoablak / URL-parameterek az uj-fooldal.js-ben vannak (azt is betolti az oldal);
// itt: kepgaleria-sav, kepnagyito, urlapok (POST /api/urlap, mint az eredeti oldalon), blog (kedveles, megosztas, kereso), link-index szuro.
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const sima = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const csendes = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- 1. kepgaleria: lapozhato sav (nyilak, ujjal huzas, billentyuzet) -------------------------------------------------------------
  $$('.kar').forEach((kar) => {
    const sav = $('.kar-sav', kar), dias = $$('.kar-dia', sav);
    const elozo = $('.kar-elozo', kar), kov = $('.kar-kov', kar), szam = $('[data-kar-akt]', kar);
    if (!sav || !dias.length) return;
    const lepes = () => (dias[1] ? dias[1].offsetLeft - dias[0].offsetLeft : sav.clientWidth);
    // a kovetkezo kepek elore toltese csak akkor, ha a galeria a kepernyo kozeleben van es a lap mar betoltott, vagy a latogato lapoz (gyorsitas, 2026-10-17:
    // kulonben minden galeria - a lap aljan levo szalon-galeria is - a lap betoltesekor 9 nagy kepet toltott, a hosben pedig a tobbi kep az elsotol vette el a savszelesseget)
    let elore = false;
    const frissit = () => {
      const i = Math.round(sav.scrollLeft / Math.max(1, lepes()));
      if (szam) szam.textContent = String(Math.min(dias.length, i + 1));
      // ha minden kep elfer, a nyilak es a szamlalo feleslegesek
      kar.classList.toggle('kar-nincs-gorg', sav.scrollWidth <= sav.clientWidth + 2);
      if (elozo) elozo.disabled = sav.scrollLeft <= 2;
      if (kov) kov.disabled = sav.scrollLeft + sav.clientWidth >= sav.scrollWidth - 2;
      // a kovetkezo kepek elore toltodnek
      if (elore) dias.slice(i, i + 9).forEach((d) => { const im = $('img', d); if (im && im.loading === 'lazy') im.loading = 'eager'; });
    };
    const indul = () => { elore = true; frissit(); };
    const betoltve = () => (document.readyState === 'complete' ? indul() : window.addEventListener('load', indul, { once: true }));
    if ('IntersectionObserver' in window) {
      const figyel = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { figyel.disconnect(); betoltve(); } }, { rootMargin: '600px 0px' });
      figyel.observe(kar);
    } else betoltve();
    sav.addEventListener('scroll', () => { elore = true; }, { passive: true, once: true });
    const lapoz = (d) => {
      const n = Math.max(1, Math.floor(sav.clientWidth / Math.max(1, lepes())));
      sav.scrollTo({ left: sav.scrollLeft + d * n * lepes(), behavior: csendes ? 'auto' : 'smooth' });
    };
    if (elozo) elozo.addEventListener('click', () => lapoz(-1));
    if (kov) kov.addEventListener('click', () => lapoz(1));
    sav.addEventListener('scroll', () => window.requestAnimationFrame(frissit), { passive: true });
    sav.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); lapoz(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); lapoz(-1); } });
    window.addEventListener('resize', frissit);
    frissit();
  });

  // --- 2. kepnagyito: a kepre kattintva nagyban nyilik (galeria: nyilak / billentyuzet / ujjal huzas, Esc zar) -------------------------
  const nezo = $('#kepnezo');
  if (nezo && typeof nezo.showModal === 'function') {
    const kep = $('.nagyito-kep', nezo), szam = $('[data-n]', nezo), ossz = $('[data-ossz]', nezo);
    const elozo = $('.nagyito-elozo', nezo), kov = $('.nagyito-kov', nezo), szamlalo = $('.nagyito-szam', nezo);
    let csoport = [], idx = 0;
    const mutat = (i) => {
      idx = (i + csoport.length) % csoport.length;
      const im = csoport[idx];
      kep.src = im.currentSrc || im.src;
      kep.alt = im.alt || '';
      szam.textContent = String(idx + 1);
      const k = csoport[(idx + 1) % csoport.length]; if (k && csoport.length > 1) new Image().src = k.currentSrc || k.src;
    };
    document.addEventListener('click', (e) => {
      const im = e.target.closest && e.target.closest('img[data-nagyit]');
      if (!im || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      csoport = im.dataset.grp ? $$(`img[data-nagyit][data-grp="${im.dataset.grp}"]`) : [im];
      const egy = csoport.length < 2;
      elozo.hidden = kov.hidden = szamlalo.hidden = egy;
      ossz.textContent = String(csoport.length);
      mutat(csoport.indexOf(im));
      nezo.showModal();
    });
    elozo.addEventListener('click', () => mutat(idx - 1));
    kov.addEventListener('click', () => mutat(idx + 1));
    $('.nagyito-zar', nezo).addEventListener('click', () => nezo.close());
    nezo.addEventListener('click', (e) => { if (e.target === nezo) nezo.close(); });
    nezo.addEventListener('keydown', (e) => {
      if (csoport.length < 2) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); mutat(idx + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); mutat(idx - 1); }
    });
    let x0 = null;
    nezo.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    nezo.addEventListener('touchend', (e) => { if (x0 === null || csoport.length < 2) return; const d = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(d) > 50) mutat(idx + (d < 0 ? 1 : -1)); }, { passive: true });
    nezo.addEventListener('close', () => { kep.removeAttribute('src'); });
  }

  // --- 3. urlapok: allasjelentkezes, hozzaszolas (POST /api/urlap, multipart: ugyanaz a szerkezet, mint az eredeti oldalon) ---------------
  const siker = (f) => { const u = f.dataset.siker; return u ? (/^\/uj(\/|$)/.test(location.pathname) ? '/uj' : '') + u : ''; };
  $$('form.urlap').forEach((f) => {
    const uz = $('.urlap-uzenet', f);
    const mutat = (szoveg, hiba) => { if (!uz) return; uz.hidden = false; uz.textContent = szoveg; uz.classList.toggle('hiba', !!hiba); };
    const mezok = () => $$('input:not([name="bot-field"]),textarea,select', f);
    mezok().forEach((m) => m.addEventListener('input', () => m.removeAttribute('aria-invalid')));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      let elso = null;
      for (const m of mezok()) {
        const v = (m.value || '').trim();
        let jo = true;
        if (m.required && !v) jo = false;
        else if (v && m.type === 'email') jo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        else if (v && m.type === 'tel') jo = (v.match(/\d/g) || []).length >= 6;
        m.setAttribute('aria-invalid', String(!jo));
        if (!jo && !elso) elso = m;
      }
      if (elso) { elso.focus(); mutat('Kérlek, töltsd ki helyesen a jelölt mezőket.', true); return; }
      const adat = new FormData();
      adat.append('form-name', f.dataset.urlap || 'urlap');
      adat.append('oldal', decodeURIComponent(location.pathname));
      adat.append('bot-field', ($('[name="bot-field"]', f) || {}).value || '');
      if (f.dataset.cim) adat.append('Bejegyzés', f.dataset.cim);
      for (const m of mezok()) {
        const nev = m.name || m.id;
        if (m.type === 'file') { for (const x of m.files) adat.append(nev, x); continue; }
        adat.append(nev, m.value);
      }
      const gomb = $('button[type="submit"]', f);
      if (gomb) gomb.disabled = true;
      try {
        const v = await fetch('/api/urlap', { method: 'POST', body: adat });
        if (!v.ok) throw new Error(String(v.status));
        f.reset();
        const cel = siker(f);
        if (cel) { mutat('Köszönjük, megkaptuk!'); location.assign(cel); return; }
        mutat(f.dataset.urlap === 'blog-hozzaszolas' ? 'Köszönjük! A hozzászólásodat megkaptuk, jóváhagyás után jelenik meg.' : 'Köszönjük, megkaptuk!');
        const r = f.closest('details'); if (r) window.setTimeout(() => { r.open = false; }, 4000);
      } catch (x) {
        mutat('Hiba történt, próbáld újra!', true);
      }
      if (gomb) gomb.disabled = false;
    });
  });

  // --- 4. blog: kedveles, megosztas ------------------------------------------------------------------------------------------------
  $$('.kedvel').forEach((g) => {
    const kulcs = 'mpKedvel:' + g.dataset.kedvel;
    const alap = parseInt(String(g.dataset.db || '0').replace(/\D/g, ''), 10) || 0;
    const szamEl = $('[data-kedvel-db]', g);
    let be = false;
    try { be = localStorage.getItem(kulcs) === '1'; } catch (x) { /* privat mod */ }
    const rajz = () => { g.setAttribute('aria-pressed', String(be)); szamEl.textContent = String(alap + (be ? 1 : 0)); };
    rajz();
    g.addEventListener('click', () => { be = !be; try { localStorage.setItem(kulcs, be ? '1' : '0'); } catch (x) { /* privat mod */ } rajz(); });
  });
  $$('[data-megoszt]').forEach((d) => {
    const url = d.dataset.megoszt;
    $$('.megoszt', d).forEach((m) => {
      const mod = m.dataset.m;
      if (mod === 'nyomtat') m.addEventListener('click', () => window.print());
      if (mod === 'link') m.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url); m.setAttribute('aria-label', 'Link másolva'); m.title = 'Link másolva'; }
        catch (x) { window.prompt('Az oldal címe:', url); }
      });
    });
  });

  // --- 5. szuro: a blog-lista es a link-index kereso mezoje -------------------------------------------------------------------------
  const szuro = (mezo, elemek, db, szoveg) => {
    if (!mezo) return;
    mezo.addEventListener('input', () => {
      const q = sima(mezo.value.trim());
      let n = 0;
      for (const e of elemek) { const lathato = !q || sima(e.dataset.szoveg).includes(q); e.hidden = !lathato; if (lathato) n++; }
      if (db) db.textContent = n + ' ' + szoveg;
      $$('.idx-csoport').forEach((c) => { c.hidden = !$$('li', c).some((li) => !li.hidden); });
    });
  };
  szuro($('[data-poszt-szuro]'), $$('#poszt-lista .poszt'), $('[data-poszt-db]'), 'bejegyzés');
  szuro($('[data-idx-szuro]'), $$('.idx-lista li'), $('[data-idx-db]'), 'oldal');

  // --- blog: 12 kartya oldalankent, szamozott lapozo; az oldal a cim horgonyaban (#oldal-2), nem URL-parameterben
  // (a parameterek a meresi parameter-megorzesbe kerulnenek, uj-fooldal.js 5.). JavaScript nelkul minden kartya latszik.
  const blogRacs = $('[data-blog-racs]'), blogNav = $('[data-blog-lapozo]');
  if (blogRacs && blogNav) {
    const kartyak = $$('.blog-kartya', blogRacs), DB = 12, lapok = Math.ceil(kartyak.length / DB);
    const horgony = () => { const m = /^#oldal-(\d+)$/.exec(location.hash); return m ? +m[1] : 1; };
    const gomb = (szoveg, n, akt, cimke) => {
      const g = document.createElement('button');
      g.type = 'button'; g.textContent = szoveg; g.className = 'blog-lap' + (akt ? ' akt' : '');
      if (cimke) g.setAttribute('aria-label', cimke);
      if (akt) g.setAttribute('aria-current', 'page');
      if (n < 1 || n > lapok) g.disabled = true; else g.addEventListener('click', () => mutat(n, true));
      return g;
    };
    const mutat = (n, gorget) => {
      n = Math.min(Math.max(1, n || 1), lapok);
      kartyak.forEach((k, i) => { k.hidden = Math.floor(i / DB) + 1 !== n; });
      blogNav.replaceChildren(gomb('‹', n - 1, false, 'Előző oldal'), ...Array.from({ length: lapok }, (_, i) => gomb(String(i + 1), i + 1, i + 1 === n, (i + 1) + '. oldal')), gomb('›', n + 1, false, 'Következő oldal'));
      try { history.replaceState(history.state, '', location.pathname + location.search + (n > 1 ? '#oldal-' + n : '')); } catch (x) { /* marad a cim */ }
      if (gorget) blogRacs.scrollIntoView({ behavior: csendes ? 'auto' : 'smooth', block: 'start' });
    };
    if (lapok > 1) mutat(horgony(), false);
    window.addEventListener('hashchange', () => mutat(horgony(), false));
  }
})();
