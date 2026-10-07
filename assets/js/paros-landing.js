// MOSAIC Paros Head Spa landing (/paros-headspa-budapest, jelenleg -uj cimen) - mukodes.
//
//  1. Idopont-valaszto (#idopontok): a legkozelebbi szabad napok oszlopokban, napi nehany idoponttal, a Salonic nyilvanos naptar-API-bol (ugyanaz a forras, mint a
//     lezeres / PMU landingen). Idopontot nem talalunk ki: ha az API nem valaszol, a foglalo-motorra vezetunk. Egy idopontra kattintva a helyben nyilo
//     foglalo-motor (reteg) nyilik meg a Paros szolgaltatassal es az idopont idobelyegevel (&start=<unix>): rogton az adatlap (docs/booking-engine/BOOKING_LAYER.md).
//     Csak az elonezeten (*.pages.dev, localhost) - ahol a Salonic CORS-a miatt a valodi idopontok nem toltodnek be - jelennek meg MINTA idopontok, jelolve.
//  2. Hero: mozgo video a paros kezelobol. Vendegvideok (kattintasra toltodnek be), a paros kezelesrol szolo valodi Google-velemenyek es az ertekelesek szama
//     (a Trustindex-widget aktualis adata), a Trustindex-velemenyek (MINDIG azonnal), mobil sticky CTA,
//     a lepesek kepsorozatanak pontjai, gorgetes (URL-valtozas nelkul: a GTM "History Change" ne induljon).
(() => {
  'use strict';

  // A sajat kereteben nyiltunk meg (a Salonic visszairanyitott): a suti.js mar jelzett a szulonek.
  try { if (window.top !== window.self && window.parent.location.hostname === location.hostname) return; } catch (e) { /* idegen keret */ }

  const SZALON = {
    cim: 'https://mosaicheadspa.salonic.hu',
    placeId: 10427,
    szolgaltatas: '302999', // "PAROS MOSAIC Head Spa kezeles (50 perc + Szaritas)" - 53 800 Ft, 80 perc (docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json)
    naptar: 'ebf1c485-e15e-d57f-de78-284a6591ece4', // a Salonic naptar-azonositoja; ha valtozik, a kod a Salonic oldalarol ujra kiolvassa
  };
  const API = 'https://api.salonic.hu/calendar/getAvailableTimes';
  const ZONA = 'Europe/Budapest';
  const ELORE_NAP = 45;
  const MAX_NAP = 28;       // ennyi napot rajzolunk ki (a nyilak gorgetik)
  const NAPI_IDO = 4;       // oszloponkent ennyi idopont latszik elsore (a tobbi a "+N" gombra)
  const MOTOR = '/foglalo-motor?business=headspa&service=paros';

  const $ = (id) => document.getElementById(id);
  const meres = (adat) => { (window.dataLayer = window.dataLayer || []).push(adat); };
  const elem = (tag, attr = {}, ...gyerek) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)) {
      if (k === 'szoveg') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const g of gyerek) if (g != null) e.append(g);
    return e;
  };
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const szam = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fmt = (ts, o) => new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, ...o }).format(new Date(ts * 1000));
  const ora = (ts) => fmt(ts, { hour: '2-digit', minute: '2-digit', hour12: false });
  const isoNap = (ts) => new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA }).format(new Date(ts * 1000)); // 2026-10-07
  const nagy = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const motorUrl = (ts) => MOTOR + (ts ? '&start=' + ts : '');

  // --- CTA-meres: ugyanaz a minta, mint az oxigen / PMU landingen (data-cta) -------------------------------------------------------
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cta]');
    if (c) meres({ event: 'paros_landing_cta', cta: c.dataset.cta });
  });

  // --- gorgetes (URL-valtozas nelkul) ---------------------------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-gorgetes]');
    if (!g) return;
    const cel = $(g.dataset.gorgetes);
    if (!cel) return;
    e.preventDefault();
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
  });

  // --- 1. idopont-valaszto ---------------------------------------------------------------------------------------------------------
  function leker(url, o = {}) {
    const ab = new AbortController();
    const ido = setTimeout(() => ab.abort(), 15000);
    return fetch(url, { credentials: 'omit', signal: ab.signal, ...o }).finally(() => clearTimeout(ido));
  }
  async function apiKezdesek(naptar) {
    const p = new URLSearchParams({
      startDate: Math.floor(Date.now() / 1000) - 3 * 3600, offset: 0, days: ELORE_NAP, placeId: SZALON.placeId, serviceId: SZALON.szolgaltatas,
      employeeId: -1, calendarId: naptar, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0,
    });
    const j = await (await leker(API + '?' + p)).json();
    if (j.status !== 'success') throw new Error('API: ' + j.status);
    const most = Date.now() / 1000 + 30 * 60;
    const ki = new Set();
    for (const kezelok of Object.values(j.data.blocks || {})) {
      for (const k of Object.values(kezelok)) for (const s of Object.values(k.slots || {})) if (s.timestamp > most) ki.add(s.timestamp);
    }
    return [...ki].sort((a, b) => a - b);
  }
  async function szabadKezdesek() {
    try { return await apiKezdesek(SZALON.naptar); } catch (hiba) {
      // a naptar-azonosito megvaltozhatott: kiolvassuk a Salonic oldalarol, es egyszer ujraprobaljuk
      const m = (await (await leker(`${SZALON.cim}/selectDate/?employeeId=-1&placeId=${SZALON.placeId}&serviceId=${SZALON.szolgaltatas}`)).text()).match(/calendarId:\s*'([^']+)'/);
      if (!m || m[1] === SZALON.naptar) throw hiba;
      SZALON.naptar = m[1];
      return apiKezdesek(m[1]);
    }
  }

  // MINTA idopontok: csak az elonezeten (a Salonic CORS-a csak a www.mosaicheadspa.hu eredetnek engedi a lekerest), hogy a kinezet megitelheto legyen
  const ELONEZET = /(^|\.)pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
  function mintaKezdesek() {
    const ki = [];
    const mai = isoNap(Math.floor(Date.now() / 1000));
    const [y, m, d] = mai.split('-').map(Number);
    for (let n = 1; ki.length < 60 && n < 40; n++) {
      const nap = new Date(Date.UTC(y, m - 1, d + n));
      if (nap.getUTCDay() === 0) continue; // vasarnap zarva
      for (const h of [10, 11, 12, 13, 14, 15, 16, 17]) {
        if (nap.getUTCDay() === 6 && h > 15) continue;
        let ts = Date.UTC(nap.getUTCFullYear(), nap.getUTCMonth(), nap.getUTCDate(), h);
        ts -= (Number(new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, hour: '2-digit', hour12: false }).format(new Date(ts))) - h) * 3600000;
        ki.push(Math.floor(ts / 1000));
      }
    }
    return ki;
  }

  /** a nap idopontjai kozul n darab, a nap folyamán szetosztva (reggeltol estig) */
  const valogat = (lista, n) => (lista.length <= n ? lista : Array.from({ length: n }, (_, i) => lista[Math.round((i * (lista.length - 1)) / (n - 1))]));
  const chip = (ts, minta) => elem('a', {
    class: 'ido', href: motorUrl(ts), 'data-ido': ts, 'data-cta': 'idopont', 'data-minta': minta ? '1' : false,
    'aria-label': `${fmt(ts, { month: 'long', day: 'numeric' })} ${ora(ts)}`, szoveg: ora(ts),
  });
  function napRajzol(napok, minta) {
    const hova = $('napok');
    const oszlopok = [...napok].slice(0, MAX_NAP).map(([iso, lista]) => {
      const ts0 = lista[0];
      const mutat = valogat(lista, NAPI_IDO);
      const idok = elem('div', { class: 'nap-idok' }, ...mutat.map((ts) => chip(ts, minta)));
      if (lista.length > mutat.length) {
        const tobb = elem('button', { type: 'button', class: 'link-gomb', 'aria-label': `${lista.length - mutat.length} további időpont megjelenítése`, szoveg: `+${lista.length - mutat.length} időpont` });
        tobb.addEventListener('click', () => { idok.replaceChildren(...lista.map((ts) => chip(ts, minta))); }, { once: true });
        idok.append(tobb);
      }
      return elem('div', { class: 'nap-oszlop', 'data-nap': iso },
        elem('div', { class: 'nap-fej' }, elem('b', { szoveg: nagy(fmt(ts0, { weekday: 'short' }).replace(/\.$/, '')) }), elem('span', { szoveg: fmt(ts0, { month: 'short', day: 'numeric' }).replace(/\.$/, '') })),
        idok);
    });
    hova.replaceChildren(...oszlopok);
    nyilFrissit();
  }
  function nyilFrissit() {
    const hova = $('napok'), gomb = $('napok-kov');
    const tul = hova.scrollWidth > hova.clientWidth + 4;
    gomb.hidden = !tul;
    const vegen = hova.scrollLeft + hova.clientWidth >= hova.scrollWidth - 4;
    gomb.classList.toggle('vissza', vegen);
    gomb.setAttribute('aria-label', vegen ? 'Vissza az első napokhoz' : 'Következő napok');
  }
  $('napok-kov').addEventListener('click', () => {
    const hova = $('napok');
    const vegen = hova.scrollLeft + hova.clientWidth >= hova.scrollWidth - 4;
    hova.scrollTo({ left: vegen ? 0 : hova.scrollLeft + hova.clientWidth, behavior: csokkentett ? 'auto' : 'smooth' });
  });
  $('napok').addEventListener('scroll', nyilFrissit, { passive: true });
  addEventListener('resize', nyilFrissit);

  const csoportosit = (k) => {
    const napok = new Map();
    for (const ts of k) { const d = isoNap(ts); if (!napok.has(d)) napok.set(d, []); napok.get(d).push(ts); }
    return napok;
  };
  let betoltve = false;
  async function idopontokBetolt() {
    if (betoltve) return;
    betoltve = true;
    const uzenet = $('slot-uzenet');
    uzenet.hidden = true;
    try {
      const napok = csoportosit(await szabadKezdesek());
      if (!napok.size) {
        $('napok').replaceChildren();
        uzenet.replaceChildren('A következő hetekre most nincs szabad páros időpont. ', elem('a', { href: motorUrl(), szoveg: 'Nézd meg a foglalóban →' }));
        uzenet.hidden = false;
        return;
      }
      napRajzol(napok, false);
    } catch (hiba) {
      console.error(hiba);
      if (ELONEZET) {
        napRajzol(csoportosit(mintaKezdesek()), true);
        uzenet.textContent = 'MINTA időpontok: az előnézeten a valódi időpontok nem töltődnek be, az éles oldalon a MOSAIC naptárából jönnek.';
        uzenet.hidden = false;
        return;
      }
      $('napok').replaceChildren();
      uzenet.replaceChildren('Most nem sikerült lekérni a szabad időpontokat. ', elem('a', { href: motorUrl(), szoveg: 'Nézd meg itt az összeset →' }));
      uzenet.hidden = false;
    }
  }
  // az idopontokat csak akkor kerjuk le, amikor a szekcio kozel kerul a kepernyohoz (felesleges API-hivas nelkul); telefonon a hero alatt van, ott rogton
  const idoSzekcio = $('idopontok');
  if ('IntersectionObserver' in window) {
    const fig = new IntersectionObserver((t) => { if (t.some((x) => x.isIntersecting)) { fig.disconnect(); idopontokBetolt(); } }, { rootMargin: '800px 0px' });
    fig.observe(idoSzekcio);
  } else idopontokBetolt();

  // --- vendegvideok: kattintasra toltodnek be (a poszter latszik addig; a fajl csak ekkor), lejatszhatok, vezerlokkel ----------------------
  for (const gomb of document.querySelectorAll('.video-kartya[data-video]')) {
    gomb.addEventListener('click', () => {
      for (const masik of document.querySelectorAll('.videok video')) masik.pause();
      const poszter = gomb.querySelector('img');
      const v = elem('video', { controls: true, autoplay: true, playsinline: true, preload: 'auto', poster: poszter ? poszter.getAttribute('src') : false, 'aria-label': gomb.dataset.cim || 'Videó' });
      v.append(elem('source', { src: gomb.dataset.video, type: 'video/mp4' }));
      gomb.replaceWith(elem('div', { class: 'video-kartya' }, v));
      v.play().catch(() => { /* a vezerlokkel inditja */ });
      meres({ event: 'paros_landing_video', video: gomb.dataset.video });
    }, { once: true });
  }

  // --- Trustindex-velemenyek: az eredeti embed iframe-ben, MINDIG azonnal (a tulajdonos kerese, 2026-10-07: nincs hozzajarulas-kapu) -------------
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
        if (!d.getElementById('paros-ti-stilus')) {
          const st = d.createElement('style');
          st.id = 'paros-ti-stilus';
          st.textContent = '@font-face{font-family:"Jost";font-style:normal;font-weight:400 600;font-display:swap;src:url(/assets/fonts/jost-400-latin.woff2) format("woff2")}'
            + 'html body .ti-widget,html body .ti-widget *{font-family:"Jost","Helvetica Neue",Arial,sans-serif!important}'
            + 'html,body{overflow:hidden!important}'
            + 'html body div.ti-controls-line,html body .ti-widget .ti-controls-line{display:none!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;visibility:hidden!important}';
          d.head.appendChild(st);
        }
        const m = Math.ceil(w.getBoundingClientRect().bottom + (parseFloat(d.defaultView.getComputedStyle(d.body).marginBottom) || 0) + 16);
        if (m > 60 && (nullaz || m > legnagyobb)) { legnagyobb = m; f.style.height = m + 'px'; } // csak nonek: a lapozo kartyai kozott ne ugraljon az oldal
        return true;
      } catch (hiba) { return true; }
    };
    const ido = setInterval(() => { proba++; meret(); if (proba > 3600 || !f.isConnected) clearInterval(ido); }, 700);
    addEventListener('resize', () => meret(true));
    tiDoboz.replaceChildren(f);
  }
  trustindexBetolt();

  // --- ertekelesek szama + a paros kezelesrol szolo VALODI Google-velemenyek: a Trustindex-widget aktualis adata; a HTML-ben tartalek (szo szerinti, valodi) ertekek allnak ---------
  const TI = 'https://cdn.trustindex.io/widgets/8a/8a7562c424f027774456be130a1/content.html';
  const nevRendez = (s) => s.toLowerCase().replace(/(^|[\s\-“"'’])(\p{L})/gu, (m, k, b) => k + b.toUpperCase());
  function idezetekFrissit(d) {
    const hova = $('idezetek');
    if (!hova) return;
    const talalat = [];
    for (const it of d.querySelectorAll('.ti-review-item')) {
      const pont = parseFloat(it.getAttribute('data-rating') || '0');
      const sz = ((it.querySelector('.ti-review-content') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      const nev = ((it.querySelector('.ti-name') || {}).textContent || '').replace(/\s+/g, ' ').trim();
      const datum = ((it.querySelector('.ti-date') || {}).textContent || '').trim();
      // csak a paros / parban kezelesrol szolo, magyar, 5 csillagos, ertelmes hosszu velemenyek (a widget sorrendje: legujabb elol)
      if (pont >= 5 && it.getAttribute('data-language') === 'hu' && /p[áa]ros|p[áa]rban/i.test(sz) && sz.length >= 40 && sz.length <= 240 && nev && !/[&@]/.test(nev)) talalat.push({ sz, nev: nevRendez(nev), datum });
      if (talalat.length === 3) break;
    }
    if (talalat.length < 3) return; // kevesebb: marad a HTML-beli tartalek
    hova.replaceChildren(...talalat.map((t) => elem('figure', { class: 'idezet' },
      elem('span', { class: 'csillagok', 'aria-label': '5 csillag', szoveg: '★★★★★' }),
      elem('blockquote', { szoveg: t.sz }),
      elem('figcaption', {}, elem('span', { class: 'avatar', 'aria-hidden': 'true', szoveg: t.nev.charAt(0) }),
        elem('span', {}, elem('b', { szoveg: t.nev }), elem('small', { szoveg: 'Google vélemény' + (t.datum ? ' · ' + t.datum : '') }))))));
  }
  (async () => {
    try {
      const d = new DOMParser().parseFromString(await (await fetch(TI, { credentials: 'omit' })).text(), 'text/html');
      const a = d.querySelector('.ti-header .ti-rating-text a');
      const n = ((a && a.textContent.match(/\d[\d\s.]*/)) || [''])[0].replace(/\D/g, '');
      if (n) {
        for (const e of document.querySelectorAll('[data-ertekeles-db]')) e.textContent = szam(+n);
        for (const l of document.querySelectorAll('.google-nagy[aria-label]')) l.setAttribute('aria-label', l.getAttribute('aria-label').replace(/\d+ Google-vélemény/, `${n} Google-vélemény`));
      }
      idezetekFrissit(d);
    } catch (hiba) { console.error(hiba); }
  })();

  // --- hero: mozgo video a paros kezelobol (telefonon a fuggoleges valtozat). A fenykep (poszter) azonnal latszik, a videofajl csak az oldal betoltese utan,
  //     lassu / adatspóroló kapcsolaton vagy csokkentett mozgas mellett egyaltalan nem toltodik. ----------------------------------------------------------
  const hv = $('hero-video');
  if (hv && !csokkentett && !(navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || '')))) {
    const indit = () => {
      hv.src = matchMedia('(max-width: 700px)').matches ? hv.dataset.mobil : hv.dataset.asztal;
      hv.addEventListener('playing', () => hv.classList.add('aktiv'), { once: true });
      hv.play().catch(() => { /* a poszter marad */ });
      if ('IntersectionObserver' in window) { // ha a hero kikerul a kepernyorol, a video megall (energia, adat)
        new IntersectionObserver((t) => { for (const x of t) { if (x.isIntersecting) hv.play().catch(() => {}); else hv.pause(); } }, { threshold: 0.05 }).observe(hv);
      }
    };
    if (document.readyState === 'complete') indit(); else addEventListener('load', indit, { once: true });
  }

  // --- mobil sticky CTA: a hero gombjanak elgorgetese utan jon be, es amig az idopont-szekcio a kepernyon van, nem latszik (maga a szekcio a cel).
  //     Gorgetes-figyelo (nem IntersectionObserver): az gyors ugrasnal / gorgeto-linknel nem jelezne. ----------------------------------------
  const sticky = $('sticky-cta'), heroGomb = document.querySelector('.hero .cta-sor');
  if (sticky && heroGomb && idoSzekcio) {
    let kesz = 0;
    const frissit = () => {
      kesz = 0;
      const tulVan = heroGomb.getBoundingClientRect().bottom <= 0;
      const r = idoSzekcio.getBoundingClientRect();
      const idoLatszik = r.top < innerHeight * 0.85 && r.bottom > innerHeight * 0.15;
      const lat = tulVan && !idoLatszik;
      sticky.classList.toggle('lathato', lat);
      sticky.setAttribute('aria-hidden', lat ? 'false' : 'true');
      sticky.querySelectorAll('a').forEach((a) => (lat ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
      document.body.classList.toggle('sticky-be', lat);
    };
    const kesleltet = () => { if (!kesz) kesz = requestAnimationFrame(frissit); };
    addEventListener('scroll', kesleltet, { passive: true });
    addEventListener('resize', kesleltet);
    frissit();
  }

  // --- a lepesek kepsorozatanak pontjai (telefonon: oldalra gorgetheto sor) ------------------------------------------------------------------
  const lepesSor = $('lepes-sor'), pontok = $('lepes-pontok');
  if (lepesSor && pontok) {
    const elemek = [...lepesSor.children];
    pontok.replaceChildren(...elemek.map(() => elem('span')));
    const frissit = () => {
      const kozep = lepesSor.scrollLeft + lepesSor.clientWidth / 2;
      let legkozelebbi = 0, tav = Infinity;
      elemek.forEach((li, i) => { const t = Math.abs(li.offsetLeft - lepesSor.offsetLeft + li.offsetWidth / 2 - kozep); if (t < tav) { tav = t; legkozelebbi = i; } });
      [...pontok.children].forEach((p, i) => p.classList.toggle('aktiv', i === legkozelebbi));
    };
    lepesSor.addEventListener('scroll', frissit, { passive: true });
    addEventListener('resize', frissit);
    frissit();
  }
})();
