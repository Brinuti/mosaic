// MOSAIC szajtetovalas landing (/szajtetovalas-budapest): a hero allo vendegvideoja (Rita) es a Melitta-szekcio videoablaka.
// A tobbi (szabad idopontok, arak, foglalo, galeria, velemenyek, terkep) a kozos pmu-landing.js-e.
//
// A hero-video: alapbol nem toltodik (preload=none, a poszter latszik). Nyugodt kapcsolaton, csokkentett mozgas nelkul, ha a hero a kepernyon van,
// az oldal betoltese utan NEMA, ismetlodo lejatszas indul (a videoba beegetett magyar felirat igy hang nelkul is ertheto); a gomb hanggal, elolrol inditja.
// Csokkentett mozgasnal, adatspolo modban es 2G-n nincs automatikus lejatszas: a gomb inditja (hanggal).
// Meres: a letezo "pmu_landing_video" esemeny (mint a /sminktetovalas-budapest videoja), uj esemeny-nev nincs.
(() => {
  'use strict';

  const SRC = '/assets/video/szajtetovalas-rita.mp4';
  const POSZTER = '/assets/img/szaj/rita-poszter.jpg';
  const $ = (id) => document.getElementById(id);
  const meres = (adat) => { (window.dataLayer = window.dataLayer || []).push(adat); };
  const kartya = $('hero-videokep'), video = $('hero-video'), gomb = $('hero-video-gomb');

  const tiltott = () => {
    const k = navigator.connection || {};
    return matchMedia('(prefers-reduced-motion: reduce)').matches || k.saveData === true || /2g$/.test(k.effectiveType || '');
  };
  const CIMKE = {
    lejatszas: ['Videó lejátszása', 'Videó lejátszása hanggal'],
    nema: ['Hanggal nézem', 'Hang bekapcsolása, a videó elölről indul'],
  };
  const allapot = (a) => {
    if (!kartya) return;
    kartya.dataset.allapot = a;
    const c = CIMKE[a];
    if (c && gomb) { gomb.querySelector('.hv-szoveg').textContent = c[0]; gomb.setAttribute('aria-label', c[1]); }
  };

  if (kartya && video && gomb) {
    let betoltve = document.readyState === 'complete', lathato = false, inditva = false;
    const nemaInditas = () => {
      if (inditva || tiltott()) return;
      inditva = true;
      video.muted = true;
      video.loop = true;
      const p = video.play();
      if (p && p.then) p.then(() => { if (kartya.dataset.allapot === 'lejatszas') allapot('nema'); }).catch(() => allapot('lejatszas'));
    };
    const probal = () => { if (betoltve && lathato) nemaInditas(); };
    if (!betoltve) addEventListener('load', () => { betoltve = true; probal(); }, { once: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        lathato = e.isIntersecting;
        // nema lejatszas kozben a kepernyorol kigorgetve megall, visszagorgetve folytatodik
        if (kartya.dataset.allapot === 'nema') { if (lathato) video.play().catch(() => {}); else video.pause(); }
        else probal();
      }, { threshold: 0.35 }).observe(kartya);
    } else { lathato = true; probal(); }

    gomb.addEventListener('click', () => {
      video.muted = false;
      video.loop = false;
      video.controls = true;
      video.currentTime = 0;
      allapot('hangos');
      // hanggal: a felhasznalo kattintasa miatt engedelyezett; ha megsem, nema marad
      const p = video.play();
      if (p && p.catch) p.catch(() => { video.muted = true; video.loop = true; video.controls = false; allapot('nema'); video.play().catch(() => allapot('lejatszas')); });
      meres({ event: 'pmu_landing_video' });
    });
  }

  // --- a Melitta-szekcio kartyaja: ugyanaz a vendegvideo felugro ablakban, kattintasra toltodik ---
  const nyit = $('szaj-video-gomb'), ablak = $('szaj-video-ablak'), keret = $('szaj-video-keret');
  if (nyit && ablak && keret) {
    nyit.addEventListener('click', () => {
      if (video && !video.paused) video.pause();
      const v = document.createElement('video');
      v.src = SRC;
      v.poster = POSZTER;
      v.controls = true;
      v.playsInline = true;
      v.preload = 'auto';
      keret.replaceChildren(v);
      ablak.showModal();
      v.play().catch(() => { /* a vezerlokkel inditja */ });
      meres({ event: 'pmu_landing_video' });
    });
    ablak.addEventListener('close', () => {
      keret.replaceChildren();
      // a hero nema lejatszasa folytatodik, ha az volt
      if (kartya && kartya.dataset.allapot === 'nema') video.play().catch(() => {});
    });
    ablak.addEventListener('click', (e) => { if (e.target === ablak) ablak.close(); });
  }
})();
