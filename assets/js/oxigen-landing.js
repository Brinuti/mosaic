// MOSAIC oxigenterapia landing (/oxigenterapia-budapest) - a kezelok, az eredmenyek es a videok mukodese.
//
// Az oldalon belul nincs #horgony-link: a GTM History Change triggere minden hash-valtozasra merest inditana, ezert a
// "gorgess ide" gombok (data-gorgetes) a JS-ben gorgetnek, az URL valtozatlan marad. A foglalas a Salonic-linkeken keresztul
// (a build kozponti link-terkepe kesobb a kozos foglalora koti at), ezert itt foglalo-kod nincs.
(() => {
  'use strict';

  // A sajat kereteben nyiltunk meg (a Salonic visszairanyitott): a suti.js mar jelzett a szulonek.
  try { if (window.top !== window.self && window.parent.location.hostname === location.hostname) return; } catch (e) { /* idegen keret */ }

  const $ = (id) => document.getElementById(id);
  const meres = (adat) => { (window.dataLayer = window.dataLayer || []).push(adat); };

  // --- CTA-mérés: ugyanaz a minta, mint a PMU landingen (data-cta) ----------------------------------
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cta]');
    if (c) meres({ event: 'oxigen_landing_cta', cta: c.dataset.cta });
  });

  // --- gorgetes (URL-valtozas nelkul) ---------------------------------------------------------------
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-gorgetes]');
    if (!g) return;
    const cel = $(g.dataset.gorgetes);
    if (!cel) return;
    const r = $('protokoll');
    if (r && g.dataset.gorgetes === 'kezeles') r.open = true;
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
  });

  // --- lapozhato sorok (kezelok, eredmenyek) --------------------------------------------------------
  function lapozo(sav, elozo, kovetkezo, rejtsdHaNincsTul) {
    if (!sav || !elozo || !kovetkezo) return;
    const allapot = () => {
      const tul = sav.scrollWidth > sav.clientWidth + 4;
      if (rejtsdHaNincsTul) elozo.hidden = kovetkezo.hidden = !tul;
      elozo.disabled = sav.scrollLeft < 4;
      kovetkezo.disabled = sav.scrollLeft + sav.clientWidth > sav.scrollWidth - 4;
    };
    const lapoz = (irany) => {
      const kartya = sav.firstElementChild;
      const lepes = kartya ? kartya.getBoundingClientRect().width + parseFloat(getComputedStyle(sav).columnGap || 20) : sav.clientWidth * 0.9;
      sav.scrollBy({ left: irany * lepes, behavior: csokkentett ? 'auto' : 'smooth' });
    };
    elozo.addEventListener('click', () => lapoz(-1));
    kovetkezo.addEventListener('click', () => lapoz(1));
    sav.addEventListener('scroll', allapot, { passive: true });
    addEventListener('resize', allapot);
    allapot();
  }
  // --- hero-galeria: egy dia egyszerre, pontokkal; magatol lapoz, amig a latogato bele nem nyul ------------
  const hgSav = $('hg-sav');
  if (hgSav) {
    const diak = [...hgSav.children];
    const pontok = $('hg-pontok');
    let jelenlegi = 0, sajat = false, idozito = null;
    const pontFrissit = () => [...pontok.children].forEach((p, i) => (i === jelenlegi ? p.setAttribute('aria-current', 'true') : p.removeAttribute('aria-current')));
    const jelol = () => { // huzas / gorgetes utan a gorgetesi helyzetbol
      jelenlegi = Math.min(diak.length - 1, Math.round(hgSav.scrollLeft / Math.max(1, hgSav.clientWidth)));
      pontFrissit();
    };
    const menj = (i, sima = true) => {
      jelenlegi = ((i % diak.length) + diak.length) % diak.length;
      pontFrissit();
      hgSav.scrollTo({ left: jelenlegi * hgSav.clientWidth, behavior: sima && !csokkentett ? 'smooth' : 'auto' });
    };
    diak.forEach((d, i) => {
      const p = document.createElement('button');
      p.type = 'button';
      p.setAttribute('aria-label', (i + 1) + '. fotó');
      p.addEventListener('click', () => menj(i));
      pontok.append(p);
    });
    $('hg-elozo').addEventListener('click', () => menj(jelenlegi - 1));
    $('hg-kovetkezo').addEventListener('click', () => menj(jelenlegi + 1));
    hgSav.addEventListener('scroll', jelol, { passive: true });
    addEventListener('resize', () => menj(jelenlegi, false));
    jelol();
    // automatikus lapozas: csak ha a latogato nem kerte a mozgas csokkentet, es csak amig nem nyult a galeriahoz
    const megall = () => { sajat = true; clearInterval(idozito); };
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((e) => $('hero-galeria').addEventListener(e, megall, { passive: true, once: true }));
    if (!csokkentett && diak.length > 1) {
      idozito = setInterval(() => { if (!sajat && !document.hidden) menj(jelenlegi + 1); }, 6000);
    }
  }

  lapozo($('kezelo-sav'), $('kezelo-elozo'), $('kezelo-kovetkezo'), true);
  document.querySelectorAll('.ba-keret').forEach((k) => lapozo(k.querySelector('.ba-sav'), k.querySelector('.elozo'), k.querySelector('.kovetkezo'), true));

  // --- video: csak kattintasra toltodik be ----------------------------------------------------------
  const doboz = $('video-doboz'), gomb = $('video-gomb');
  if (doboz && gomb) {
    gomb.addEventListener('click', () => {
      const v = document.createElement('video');
      v.src = doboz.dataset.video;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      v.setAttribute('playsinline', 'true');
      v.setAttribute('aria-label', 'Így zajlik egy oxigénterápiás kezelés');
      gomb.replaceWith(v);
      v.play().catch(() => { /* a vezérlők megmaradnak, a látogató elindíthatja */ });
      meres({ event: 'oxigen_landing_video' });
    }, { once: true });
  }

  // --- a MOSAIC Google-ertekelese es velemenyei a Trustindex-widget aktualis tartalmabol -----------------------------
  // A Trustindex a suti-tajekoztato szerint "funkcionalis" szolgaltatas: csak ennek engedelyezese utan kerdezzuk le (egyszer).
  const TI = 'https://cdn.trustindex.io/widgets/8a/8a7562c424f027774456be130a1/content.html';
  let tiSzoveg = null;
  const tiLeker = () => (tiSzoveg ||= fetch(TI, { credentials: 'omit' }).then((r) => r.text()).then((t) => new DOMParser().parseFromString(t, 'text/html')));
  const nevszep = (n) => n.trim().toLocaleLowerCase('hu').replace(/(^|[\s"“(-])(\p{L})/gu, (m, e, b) => e + b.toLocaleUpperCase('hu'));
  const csillagok = (d) => {
    const fej = d.querySelector('.ti-header');
    const db = ((fej && fej.querySelector('.ti-rating-text a')) || {}).textContent || '';
    const n = (db.match(/\d[\d\s.]*/) || [''])[0].replace(/\D/g, '');
    const cs = fej ? [...fej.querySelectorAll('.ti-stars .ti-star')].map((x) => (x.classList.contains('f') ? 1 : x.classList.contains('h') ? 0.5 : 0)) : [];
    const min = ((fej && fej.querySelector('.ti-rating')) || {}).textContent;
    return { n, cs, min };
  };

  let chipKesz = false;
  async function ertekelesFrissit() {
    if (chipKesz || !$('te-db') || !(window.mhSuti && mhSuti.engedely('fun'))) return;
    chipKesz = true;
    try {
      const { n, cs, min } = csillagok(await tiLeker());
      if (n) $('te-db').textContent = new Intl.NumberFormat('hu-HU').format(+n).replace(/\s/g, '.') + ' Google-vélemény';
      if (cs.length === 5) {
        const ossz = cs.reduce((x, y) => x + y, 0);
        $('te-csillagok').style.setProperty('--ert', (ossz / 5) * 100 + '%');
        $('te-csillagok').setAttribute('aria-label', '5 csillagból ' + String(ossz).replace('.', ','));
      }
      if (min && min.trim()) $('te-minosites').textContent = min.trim().replace(/ értékelés$/i, '');
    } catch (e) { chipKesz = false; console.error(e); }
  }
  ertekelesFrissit();

  // vendegvelemenyek: valos Google-velemenyek (Trustindex) lapozhato kartyakon; hozzajarulasig gombos helykitolto
  const tiDoboz = $('ti-doboz');
  let velKesz = false;
  async function velemenyekBetolt() {
    if (velKesz || !tiDoboz || !(window.mhSuti ? mhSuti.engedely('fun') : true)) return;
    velKesz = true;
    try {
      const d = await tiLeker();
      const lista = [...d.querySelectorAll('.ti-review-item')].map((it) => {
        const szoveg = ((it.querySelector('.ti-review-content') || {}).textContent || '').replace(/\(Google által fordítva[^)]*\)/i, '').replace(/\s+/g, ' ').trim();
        return { szoveg, nev: ((it.querySelector('.ti-name') || {}).textContent || '').trim(), datum: ((it.querySelector('.ti-date') || {}).textContent || '').trim(), ertek: +(it.dataset.rating || 5) };
      }).filter((v) => v.ertek >= 5 && v.szoveg.length >= 45 && !/^\+\d/.test(v.szoveg)).slice(0, 9);
      if (!lista.length) throw new Error('nincs velemeny');
      const { n, min } = csillagok(d);
      const keret = document.createElement('div');
      keret.className = 'ti-keret';
      keret.innerHTML = '<div class="ti-fej"><span class="te-csillagok" style="--ert:100%" role="img" aria-label="5 csillagból 5"></span><b>' + (min ? min.trim().replace(/ értékelés$/i, '') : 'Kiváló') + '</b>' +
        (n ? '<span>' + new Intl.NumberFormat('hu-HU').format(+n).replace(/\s/g, '.') + ' Google-vélemény</span>' : '') + '</div>' +
        '<div class="ti-sav"></div><button type="button" class="lapozo elozo" aria-label="Előző vélemények" hidden><svg><use href="#i-bal"/></svg></button><button type="button" class="lapozo kovetkezo" aria-label="Következő vélemények" hidden><svg><use href="#i-jobb"/></svg></button>';
      const sav = keret.querySelector('.ti-sav');
      for (const v of lista) {
        const k = document.createElement('article');
        k.className = 'ti-kartya';
        const cs = document.createElement('span'); cs.className = 'ti-csillag'; cs.setAttribute('aria-label', '5 csillag'); cs.textContent = '★★★★★';
        const t = document.createElement('p'); t.textContent = v.szoveg;
        const nev = document.createElement('p'); nev.className = 'ti-nev';
        nev.append(nevszep(v.nev));
        const kicsi = document.createElement('small'); kicsi.textContent = 'Google-vélemény · ' + v.datum;
        nev.append(kicsi);
        k.append(cs, t, nev);
        sav.append(k);
      }
      tiDoboz.replaceChildren(keret);
      lapozo(sav, keret.querySelector('.elozo'), keret.querySelector('.kovetkezo'), true);
    } catch (e) { velKesz = false; console.error(e); }
  }
  if (tiDoboz) {
    $('ti-gomb').addEventListener('click', () => { if (window.mhSuti) mhSuti.enged('fun'); else velemenyekBetolt(); });
    velemenyekBetolt();
  }

  if (window.mhSuti && mhSuti.figyel) mhSuti.figyel(() => { ertekelesFrissit(); velemenyekBetolt(); });
})();
