// MOSAIC /sminktetovalas-eltavolitas-budapest - az oldal sajat szkriptje. NEM mero-kod: nem toltok kulso szkriptet, nem kuldok semmit harmadik felnek.
// Harom dolgot csinal:
//   1) belso gorgetes-gombok ([data-gorget="<id>"], <button>): NEM #horgony-link es NEM history-hivas (a GTM "History Change" trigger minden hash-valtasra merest inditana; ugyanez a minta az oxigen-hajvizsgalat.js-ben).
//   2) a hero videoja: alapbol nem toltodik (preload=none, a poszter latszik), a gombbal indul / all (nema, ismetlodo).
//   3) a ragados alsó sav (mobil): akkor latszik, ha a hero fo gombja mar kigorgetett a kepbol, es az urlap meg nem latszik.

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
    if (g.dataset.valaszt) valaszt(g.dataset.valaszt);
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
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
  addEventListener('message', (e) => {
    if (!fKeret || e.origin !== location.origin || e.source !== fKeret.contentWindow || !e.data || !e.data.mhFoglalo) return;
    if (e.data.magassag) fKeret.style.height = e.data.magassag + 'px';
  });
  if (foglSzekcio) {
    for (const b of foglSzekcio.querySelectorAll('.el-valaszt')) b.addEventListener('click', () => valaszt(b.dataset.valaszt));
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
})();
