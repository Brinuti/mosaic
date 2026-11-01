// MOSAIC /sminktetovalas-eltavolitas-budapest - az oldal sajat szkriptje. NEM mero-kod: nem toltok kulso szkriptet, nem kuldok semmit harmadik felnek.
// Harom dolgot csinal:
//   1) belso gorgetes-gombok ([data-gorget="<id>"], <button>): NEM #horgony-link es NEM history-hivas (a GTM "History Change" trigger minden hash-valtasra merest inditana; ugyanez a minta az oxigen-hajvizsgalat.js-ben).
//   2) a hero videoja: alapbol nem toltodik (preload=none, a poszter latszik), a gombbal indul / all (nema, ismetlodo).
//   3) a ragados alsó sav (mobil): akkor latszik, ha a hero fo gombja mar kigorgetett a kepbol, es az urlap meg nem latszik.
//   4) az "Igy nez ki az eltavolitas" kepei: kattintasra nagyban nyilnak, mobilon es asztalon is nagyithatok (lasd lent). Nem kuld semmit, nem hoz letre merest.
//   Foglalas-valasztas utan (kartya vagy a "...foglalok" gombok) a naptarhoz ugrik, hogy latsszon: tortenik valami.

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const OLDAL = 'sminktetovalas-eltavolitas-budapest';
  const MAX_FOTO = 5;
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- 1) belso gorgetes (URL-valtozas nelkul) ---
  document.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest('[data-gorget]');
    if (!g) return;
    const cel = $(g.getAttribute('data-gorget'));
    if (!cel) return;
    e.preventDefault();
    let ugras = cel;
    if (g.dataset.valaszt) { valaszt(g.dataset.valaszt); ugras = foglalasiCel(true) || cel; }
    ugras.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
    const fok = cel.querySelector('h2, h3') || cel;
    if (!fok.hasAttribute('tabindex')) fok.setAttribute('tabindex', '-1');
    try { fok.focus({ preventScroll: true }); } catch (hiba) { /* nem fokuszalhato */ }
  });

  // --- 1b) foglalas: ketfele jelentkezes (ingyenes konzultacio / eltavolito kezeles), MINDKETTO a naptarba nyilik ---
  // A naptar a MEGLEVO /foglalo-pmu foglalo (beagyazva): a keret magassagat a foglalo jelzi (postMessage), mint a /sminktetovalas-budapest oldalon.
  // Konzultacio: a Salonic "Ingyenes konzultacio" szolgaltatasa (?kezeles=konzultacio); eltavolito kezeles: a Salonic "Tetovalas eltavolitas" (#foglalas[data-kezeles-kulcs] = a szolgaltatas azonositoja).
  // A foglalo (2026-11-01 ota, Feri) mindenkitol megkerdezi, volt-e mar sminktetovalasa; akinek van, elobb fotot tolt fel, es csak 2026-11-09-tol kap idopontot (lasd foglalo-pmu.js). A "kerdes=kihagy" jelzes megszunt.
  const foglSzekcio = $('foglalas');
  const fKeret = $('el-foglalo');
  const kerBox = $('el-foglalo-doboz');
  let utolso = '';
  function valaszt(mit) {
    if (!foglSzekcio) return;
    for (const b of foglSzekcio.querySelectorAll('[data-valaszt]')) b.setAttribute('aria-pressed', b.dataset.valaszt === mit ? 'true' : 'false');
    const kez = mit === 'kezeles' ? (foglSzekcio.dataset.kezelesKulcs || '').trim() : 'konzultacio';
    if (!kez) return;
    if (utolso !== kez) { fKeret.src = '/foglalo-pmu?beagyazva=1&kezeles=' + encodeURIComponent(kez); utolso = kez; }
    kerBox.hidden = false;
  }
  // Hova gorgessunk, miutan a vendeg valasztott? A naptar a ket kartya ALATT nyilik, mobilon ez gyakran a kepernyon kivul van, es nem latszik, hogy tortent valami.
  // szekciobol = true: a szekcio tetejere gorgetunk (hero / galeria gomb); ha onnan a naptar teteje a kepernyo also 40%-aba esne, kozvetlenul a naptarra.
  // szekciobol = false: a vendeg a kartyakat latja (kartya-kattintas): ha a naptar teteje mar a kepernyo felso 60%-aban van, nem mozdul; kulonben a naptarra ugrik.
  function foglalasiCel(szekciobol) {
    if (!kerBox || !foglSzekcio || kerBox.hidden) return null;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const doboz = kerBox.getBoundingClientRect().top;
    if (szekciobol) return doboz - foglSzekcio.getBoundingClientRect().top > vh * 0.6 ? kerBox : foglSzekcio;
    return doboz >= 0 && doboz < vh * 0.6 ? null : kerBox;
  }
  addEventListener('message', (e) => {
    if (!fKeret || e.origin !== location.origin || e.source !== fKeret.contentWindow || !e.data || !e.data.mhFoglalo) return;
    if (e.data.magassag) fKeret.style.height = e.data.magassag + 'px';
  });
  if (foglSzekcio) {
    for (const b of foglSzekcio.querySelectorAll('.el-valaszt')) {
      b.addEventListener('click', () => {
        valaszt(b.dataset.valaszt);
        const cel = foglalasiCel(false);
        if (cel) cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
      });
    }
  }

  // --- 2) video ---
  const video = $('el-video');
  const keret = $('el-videokeret');
  const vGomb = $('el-video-gomb');
  if (video && vGomb) {
    const allapot = (megy) => {
      keret.dataset.megy = megy ? '1' : '0';
      vGomb.setAttribute('aria-label', megy ? 'Videó szüneteltetése' : 'Videó lejátszása');
    };
    vGomb.addEventListener('click', () => {
      if (video.paused) video.play().then(() => allapot(true)).catch(() => allapot(false));
      else { video.pause(); allapot(false); }
    });
    // nyugodt kapcsolaton, csokkentett mozgas nelkul a muted, ismetlodo lejatszas magatol indul, amint latszik
    const kapcsolat = navigator.connection || {};
    const nyugodt = !csokkentett && !kapcsolat.saveData && !/(^|-)2g$/.test(kapcsolat.effectiveType || '');
    if (nyugodt && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((tetelek) => {
        if (tetelek.some((t) => t.isIntersecting)) {
          io.disconnect();
          video.preload = 'auto';
          video.play().then(() => allapot(true)).catch(() => allapot(false));
        }
      }, { threshold: 0.5 });
      io.observe(keret);
    }
  }

  // --- 3) ragados alsó sav ---
  const sav = $('el-sav');
  const foGomb = $('el-fo-gomb');
  const urlapSzekcio = $('foglalas');
  if (sav && foGomb && urlapSzekcio && 'IntersectionObserver' in window) {
    let foLatszik = true;
    let urlapLatszik = false;
    const frissit = () => {
      const mutat = !foLatszik && !urlapLatszik;
      sav.dataset.lathato = mutat ? '1' : '0';
      document.body.dataset.sav = mutat ? '1' : '0';
    };
    new IntersectionObserver((t) => { foLatszik = t[0].isIntersecting; frissit(); }).observe(foGomb);
    new IntersectionObserver((t) => { urlapLatszik = t[0].isIntersecting; frissit(); }, { threshold: 0.05 }).observe(urlapSzekcio);
    frissit();
  }

  // --- 4) kepek nagyban, nagyithatoan ---
  // Az "Igy nez ki az eltavolitas" szekcio .el-kep elemei: kattintas / Enter / szokoz = nagy nezet (<dialog>, Esc zar, a fokusz visszaker).
  // Nagyitas: asztalon gorgetes, kattintas (nagyit / visszaall), +/- gombok, huzas (mozgatas); mobilon ket ujjas csipes, dupla koppintas, huzas; lapozas: nyilak / gombok / vizszintes huzas (nem nagyitott kepnel).
  // Semmi mereskod, semmi halozati keres a mar betoltott kepeken kivul.
  const kepek = Array.from(document.querySelectorAll('.el-galeria .el-kep'));
  if (kepek.length && typeof document.createElement('dialog') !== 'undefined') {
    const MAX = 4;
    const LEPES = 1.5;
    const ikon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8.5v5M8.5 11h5"/></svg>';
    const elem = (tag, attr = {}, html) => {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attr)) e.setAttribute(k, v);
      if (html != null) e.innerHTML = html;
      return e;
    };
    const cimkeSzoveg = (k) => ((k.querySelector('.el-cimke') || {}).textContent || 'Kép').trim();
    kepek.forEach((k, i) => {
      k.setAttribute('data-nagyit', String(i));
      k.setAttribute('role', 'button');
      k.setAttribute('tabindex', '0');
      k.setAttribute('aria-label', 'Kép nagyítása: ' + cimkeSzoveg(k) + ' (' + (i + 1) + '/' + kepek.length + ')');
      k.append(elem('span', { class: 'el-nagyit-jel' }, ikon));
    });

    let dlg = null;
    let szint; let kep; let felirat; let tipp; let btnElozo; let btnKov; let btnKi; let btnBe; let btnEgy;
    let idx = 0; let s = 1; let tx = 0; let ty = 0;
    let nyitoElem = null;
    const mutatok = new Map();
    let utolsoTap = { t: 0, x: 0, y: 0 };
    let huzas = null; let mozgott = false; let csipes = null;

    const korlatoz = (v, a, b) => Math.min(b, Math.max(a, v));
    const alkalmaz = () => {
      const mx = Math.max(0, (kep.offsetWidth * s - szint.clientWidth) / 2);
      const my = Math.max(0, (kep.offsetHeight * s - szint.clientHeight) / 2);
      tx = korlatoz(tx, -mx, mx); ty = korlatoz(ty, -my, my);
      kep.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + s + ')';
      szint.dataset.nagyitva = s > 1.01 ? '1' : '0';
      kep.dataset.nagyitas = s.toFixed(3);
      btnKi.disabled = s <= 1.001;
      btnBe.disabled = s >= MAX - 0.001;
      btnEgy.textContent = s > 1.01 ? Math.round(s * 100) + '%' : '100%';
    };
    // A nagyitas a (cx, cy) kepernyo-pont koruli: a pont alatti kepresz a helyen marad.
    const nagyit = (ujS, cx, cy) => {
      ujS = korlatoz(ujS, 1, MAX);
      const r = szint.getBoundingClientRect();
      const px = cx - (r.left + r.width / 2);
      const py = cy - (r.top + r.height / 2);
      tx = px - (px - tx) * (ujS / s); ty = py - (py - ty) * (ujS / s); s = ujS;
      alkalmaz();
    };
    const kozepre = (ujS) => { const r = szint.getBoundingClientRect(); nagyit(ujS, r.left + r.width / 2, r.top + r.height / 2); };
    const mutat = (n) => {
      idx = (n + kepek.length) % kepek.length;
      const forras = kepek[idx].querySelector('img');
      kep.src = forras.currentSrc || forras.src;
      kep.alt = forras.alt || '';
      s = 1; tx = 0; ty = 0;
      felirat.textContent = cimkeSzoveg(kepek[idx]) + ' · ' + (idx + 1) + ' / ' + kepek.length;
      alkalmaz();
      for (const m of [idx - 1, idx + 1]) { const f = kepek[(m + kepek.length) % kepek.length].querySelector('img'); if (f) new Image().src = f.currentSrc || f.src; }
    };
    const kepenVan = (x, y) => { const r = kep.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
    const kapcsol = (x, y) => (s > 1.01 ? kozepre(1) : nagyit(2.5, x, y));
    const bezar = () => { if (dlg && dlg.open) { if (dlg.close) dlg.close(); else { dlg.removeAttribute('open'); lezart(); } } };
    function lezart() {
      document.documentElement.style.overflow = '';
      mutatok.clear(); huzas = null; csipes = null;
      if (nyitoElem && nyitoElem.focus) { try { nyitoElem.focus({ preventScroll: true }); } catch (hiba) { /* nem fokuszalhato */ } }
    }
    const epit = () => {
      dlg = elem('dialog', { class: 'el-nagy', 'aria-label': 'Nagyított kép' });
      const fej = elem('div', { class: 'el-nagy-fej' });
      felirat = elem('p', { class: 'el-nagy-felirat', 'aria-live': 'polite' });
      const zar = elem('button', { type: 'button', class: 'el-nagy-gomb', 'aria-label': 'Bezárás' }, '×');
      fej.append(felirat, zar);
      szint = elem('div', { class: 'el-nagy-szint' });
      kep = elem('img', { class: 'el-nagy-kep', alt: '', draggable: 'false' });
      szint.append(kep);
      const alj = elem('div', { class: 'el-nagy-alj' });
      const gombok = elem('div', { class: 'el-nagy-gombok' });
      btnElozo = elem('button', { type: 'button', class: 'el-nagy-gomb', 'aria-label': 'Előző kép' }, '‹');
      btnKi = elem('button', { type: 'button', class: 'el-nagy-gomb', 'aria-label': 'Kicsinyítés' }, '−');
      btnEgy = elem('button', { type: 'button', class: 'el-nagy-gomb el-nagy-egy', 'aria-label': 'Eredeti méret' }, '100%');
      btnBe = elem('button', { type: 'button', class: 'el-nagy-gomb', 'aria-label': 'Nagyítás' }, '+');
      btnKov = elem('button', { type: 'button', class: 'el-nagy-gomb', 'aria-label': 'Következő kép' }, '›');
      gombok.append(btnElozo, btnKi, btnEgy, btnBe, btnKov);
      tipp = elem('p', { class: 'el-nagy-tipp' });
      alj.append(gombok, tipp);
      dlg.append(fej, szint, alj);
      document.body.append(dlg);

      zar.addEventListener('click', bezar);
      btnElozo.addEventListener('click', () => mutat(idx - 1));
      btnKov.addEventListener('click', () => mutat(idx + 1));
      btnKi.addEventListener('click', () => kozepre(s / LEPES));
      btnBe.addEventListener('click', () => kozepre(s * LEPES));
      btnEgy.addEventListener('click', () => kozepre(1));
      dlg.addEventListener('close', lezart);
      dlg.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); mutat(idx - 1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); mutat(idx + 1); }
        else if (e.key === '+' || e.key === '=') { e.preventDefault(); kozepre(s * LEPES); }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); kozepre(s / LEPES); }
        else if (e.key === '0') { e.preventDefault(); kozepre(1); }
        else if (e.key === 'Escape' && !dlg.close) bezar();
      });
      // asztal: gorgetes = nagyitas az egermutato korul (trackpad-csipes: ctrl + gorgetes)
      szint.addEventListener('wheel', (e) => {
        e.preventDefault();
        nagyit(s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), e.clientX, e.clientY);
      }, { passive: false });
      szint.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        try { szint.setPointerCapture(e.pointerId); } catch (hiba) { /* nincs mit */ }
        mutatok.set(e.pointerId, { x: e.clientX, y: e.clientY });
        kep.dataset.gesztus = '1';
        if (mutatok.size === 2) {
          const [a, b] = Array.from(mutatok.values());
          csipes = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
          huzas = null; mozgott = true;
        } else if (mutatok.size === 1) {
          huzas = { x: e.clientX, y: e.clientY, tx0: tx, ty0: ty, t: Date.now() };
          mozgott = false;
        }
      });
      szint.addEventListener('pointermove', (e) => {
        if (!mutatok.has(e.pointerId)) return;
        mutatok.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mutatok.size >= 2 && csipes) {
          const [a, b] = Array.from(mutatok.values());
          const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
          nagyit(s * (d / csipes.d), mx, my);
          tx += mx - csipes.mx; ty += my - csipes.my; alkalmaz();
          csipes = { d, mx, my };
          return;
        }
        if (!huzas) return;
        const dx = e.clientX - huzas.x; const dy = e.clientY - huzas.y;
        if (Math.hypot(dx, dy) > 6) mozgott = true;
        if (s > 1.01) {
          tx = huzas.tx0 + dx; ty = huzas.ty0 + dy; alkalmaz();
          szint.dataset.huz = mozgott ? '1' : '0';
        }
      });
      const vege = (e) => {
        if (!mutatok.has(e.pointerId)) return;
        mutatok.delete(e.pointerId);
        szint.dataset.huz = '0';
        if (csipes && mutatok.size < 2) {
          csipes = null;
          // az egyik ujj fent marad: onnan folytathato a mozgatas
          const maradt = Array.from(mutatok.values())[0];
          huzas = maradt ? { x: maradt.x, y: maradt.y, tx0: tx, ty0: ty, t: Date.now() } : null;
          mozgott = true;
          if (s < 1.05) { s = 1; tx = 0; ty = 0; alkalmaz(); }
        }
        if (mutatok.size === 0) {
          delete kep.dataset.gesztus;
          const h = huzas; huzas = null;
          if (!h || e.type === 'pointercancel') return;
          const dx = e.clientX - h.x; const dy = e.clientY - h.y;
          if (!mozgott) {
            // koppintas / kattintas
            if (!kepenVan(e.clientX, e.clientY)) { bezar(); return; }
            if (e.pointerType === 'mouse') { kapcsol(e.clientX, e.clientY); return; }
            const most = Date.now();
            if (most - utolsoTap.t < 320 && Math.hypot(e.clientX - utolsoTap.x, e.clientY - utolsoTap.y) < 40) { utolsoTap = { t: 0, x: 0, y: 0 }; kapcsol(e.clientX, e.clientY); }
            else utolsoTap = { t: most, x: e.clientX, y: e.clientY };
          } else if (s <= 1.01 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            mutat(idx + (dx < 0 ? 1 : -1));
          }
        }
      };
      szint.addEventListener('pointerup', vege);
      szint.addEventListener('pointercancel', vege);
      addEventListener('resize', () => { if (dlg.open) alkalmaz(); });
    };
    const nyit = (n, forras) => {
      if (!dlg) epit();
      nyitoElem = forras || null;
      tipp.textContent = matchMedia('(pointer: coarse)').matches
        ? 'Két ujjal nagyíthatsz, kétszer koppintva is. Húzással mozgathatod.'
        : 'Görgetéssel vagy kattintással nagyíthatsz, húzással mozgathatod.';
      document.documentElement.style.overflow = 'hidden';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      mutat(n);
      // a kep betoltese utan a korlatozas pontos meretet kap
      if (!kep.complete) kep.addEventListener('load', alkalmaz, { once: true });
    };
    document.addEventListener('click', (e) => {
      const k = e.target.closest && e.target.closest('.el-kep[data-nagyit]');
      if (k) nyit(Number(k.getAttribute('data-nagyit')), k);
    });
    document.addEventListener('keydown', (e) => {
      const k = e.target.closest && e.target.closest('.el-kep[data-nagyit]');
      if (!k) return;
      if (e.key === ' ') e.preventDefault(); // ne gorgesse az oldalt; a megnyitas a felengedesre tortenik
      else if (e.key === 'Enter') { e.preventDefault(); nyit(Number(k.getAttribute('data-nagyit')), k); }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key !== ' ') return;
      const k = e.target.closest && e.target.closest('.el-kep[data-nagyit]');
      if (k) nyit(Number(k.getAttribute('data-nagyit')), k);
    });
  }
})();
