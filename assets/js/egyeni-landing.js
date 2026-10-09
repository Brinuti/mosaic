// MOSAIC Head Spa AKCIO oldal = az Egyeni Head Spa landing (/head-spa-kedvezmeny; 2026-10-09 ota ez az akcio oldal) - mukodes.
//
//  1. Idopont-valaszto (#napok): a legkozelebbi szabad napok oszlopokban, napi nehany idoponttal, a Salonic nyilvanos naptar-API-bol (ugyanaz a forras, mint a
//     paros / lezeres / PMU landingen). Az Egyeni HeadSpa ket Salonic-valtozata ("Relax" es "Hair", azonos kezelok, azonos ar) idopontjainak unioja, mint a foglalo-motorban.
//     Idopontot nem talalunk ki: ha az API nem valaszol, a foglalo-motorra vezetunk. Egy idopontra kattintva a helyben nyilo foglalo-motor (reteg) nyilik meg az
//     Egyeni szolgaltatassal es az idopont idobelyegevel (&start=<unix>): rogton az adatlap (docs/booking-engine/BOOKING_LAYER.md).
//     Csak az elonezeten (*.pages.dev, localhost) - ahol a Salonic CORS-a miatt a valodi idopontok nem toltodnek be - jelennek meg MINTA idopontok, jelolve.
//     Egyeni / Paros valaszto (#valtozat, radio): a valasztas atvaltja az ajanlat-panelt, a szabad idopontokat (a Paros: Salonic 302999) es a foglalo-motor linkjeit.
//  2. Mozgokepek (video[data-klip]) es a hangos videok NAGY felugro ablaka (a play gombok: button[data-nagyvideo]): a KOZOS videos hero kodja (assets/js/video-hero.js, docs/VIDEOS_HERO.md);
//     itt csak a meres (a document 'vh:video' esemenyere a sajat dataLayer-esemeny).
//  3. Trustindex-velemenyek (MINDIG azonnal), az ertekelesek szama (a widget aktualis adata), mobil sticky CTA, a lepesek / vendegvideok pontjai,
//     gorgetes (URL-valtozas nelkul: a GTM "History Change" ne induljon).
(() => {
  'use strict';

  // A sajat kereteben nyiltunk meg (a Salonic visszairanyitott): a suti.js mar jelzett a szulonek.
  try { if (window.top !== window.self && window.parent.location.hostname === location.hostname) return; } catch (e) { /* idegen keret */ }

  const SZALON = {
    cim: 'https://mosaicheadspa.salonic.hu',
    placeId: 10427,
    naptar: 'ebf1c485-e15e-d57f-de78-284a6591ece4', // a Salonic naptar-azonositoja; ha valtozik, a kod a Salonic oldalarol ujra kiolvassa
  };
  const API = 'https://api.salonic.hu/calendar/getAvailableTimes';
  const ZONA = 'Europe/Budapest';
  const ELORE_NAP = 45;
  const MAX_NAP = 28;       // ennyi napot rajzolunk ki (a nyilak gorgetik)
  const NAPI_IDO = () => (matchMedia('(max-width: 700px)').matches ? 3 : 4);   // oszloponkent ennyi idopont latszik elsore (a tobbi a "+N" gombra); telefonon kevesebb: kompaktabb
  // A ket valtozat Salonic-szolgaltatasai (docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json):
  //  egyeni: "EGYENI 50 perces MOSAIC Relax / Hair Head Spa kezeles + 30 perc hajszaritas" - 26 900 Ft, 80 perc (ket valtozat, a motor az uniojukat mutatja)
  //  paros: "PAROS MOSAIC Head Spa kezeles (50 perc + Szaritas)" - 53 800 Ft, 80 perc
  const VALTOZATOK = {
    egyeni: { szolgaltatasok: ['302342', '302499'], motor: '/foglalo-motor?business=headspa&service=egyeni', cim: 'A következő szabad egyéni időpontok', nincs: 'A következő hetekre most nincs szabad egyéni időpont. ' },
    paros: { szolgaltatasok: ['302999'], motor: '/foglalo-motor?business=headspa&service=paros', cim: 'A következő szabad páros időpontok', nincs: 'A következő hetekre most nincs szabad páros időpont. ' },
  };
  let valtozat = 'egyeni';

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
  const motorUrl = (ts, v = valtozat) => VALTOZATOK[v].motor + (ts ? '&start=' + ts : '');

  // --- CTA-meres: ugyanaz a minta, mint a paros / oxigen / PMU landingen (data-cta) -----------------------------------------------
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cta]');
    if (c) meres({ event: 'egyeni_landing_cta', cta: c.dataset.cta });
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
  async function egySzolgaltatas(naptar, szolgaltatas) {
    const p = new URLSearchParams({
      startDate: Math.floor(Date.now() / 1000) - 3 * 3600, offset: 0, days: ELORE_NAP, placeId: SZALON.placeId, serviceId: szolgaltatas,
      employeeId: -1, calendarId: naptar, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0,
    });
    const j = await (await leker(API + '?' + p)).json();
    if (j.status !== 'success') throw new Error('API: ' + j.status);
    const most = Date.now() / 1000 + 30 * 60;
    const ki = new Set();
    for (const kezelok of Object.values(j.data.blocks || {})) {
      for (const k of Object.values(kezelok)) for (const s of Object.values(k.slots || {})) if (s.timestamp > most) ki.add(s.timestamp);
    }
    return [...ki];
  }
  /** a valtozat Salonic-szolgaltatasainak idopont-unioja (az Egyeni ket Salonic-valtozata, mint a motorban); ha csak az egyik valaszol, annak az idopontjai */
  async function apiKezdesek(naptar, v) {
    const mind = await Promise.allSettled(VALTOZATOK[v].szolgaltatasok.map((id) => egySzolgaltatas(naptar, id)));
    const jok = mind.filter((r) => r.status === 'fulfilled');
    if (!jok.length) throw mind[0].reason;
    return [...new Set(jok.flatMap((r) => r.value))].sort((a, b) => a - b);
  }
  async function szabadKezdesek(v) {
    try { return await apiKezdesek(SZALON.naptar, v); } catch (hiba) {
      // a naptar-azonosito megvaltozhatott: kiolvassuk a Salonic oldalarol, es egyszer ujraprobaljuk
      const m = (await (await leker(`${SZALON.cim}/selectDate/?employeeId=-1&placeId=${SZALON.placeId}&serviceId=${VALTOZATOK[v].szolgaltatasok[0]}`)).text()).match(/calendarId:\s*'([^']+)'/);
      if (!m || m[1] === SZALON.naptar) throw hiba;
      SZALON.naptar = m[1];
      return apiKezdesek(m[1], v);
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
      const mutat = valogat(lista, NAPI_IDO());
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
  // elore / vissza nyil (asztalon es telefonon is): a kijelolt idoszak a legkorabbi -> a visszanyil letiltva (halvany); a vegen az elorenyil
  function nyilFrissit() {
    const hova = $('napok'), kov = $('napok-kov'), elozo = $('napok-elozo');
    const tul = hova.scrollWidth > hova.clientWidth + 4;
    kov.hidden = elozo.hidden = !tul;
    elozo.disabled = hova.scrollLeft <= 4;
    kov.disabled = hova.scrollLeft + hova.clientWidth >= hova.scrollWidth - 4;
  }
  const lapoz = (irany) => { const hova = $('napok'); hova.scrollBy({ left: irany * hova.clientWidth, behavior: csokkentett ? 'auto' : 'smooth' }); };
  $('napok-kov').addEventListener('click', () => lapoz(1));
  $('napok-elozo').addEventListener('click', () => lapoz(-1));
  $('napok').addEventListener('scroll', nyilFrissit, { passive: true });
  addEventListener('resize', nyilFrissit);

  const csoportosit = (k) => {
    const napok = new Map();
    for (const ts of k) { const d = isoNap(ts); if (!napok.has(d)) napok.set(d, []); napok.get(d).push(ts); }
    return napok;
  };
  // az idopontok valtozatonkent egyszer toltodnek le (a valtozat-valto a gyorsitotarbol rajzol)
  const cache = {}, folyamatban = {};
  function adatBetolt(v) {
    if (cache[v]) return Promise.resolve(cache[v]);
    if (folyamatban[v]) return folyamatban[v];
    folyamatban[v] = (async () => {
      try {
        const napok = csoportosit(await szabadKezdesek(v));
        return (cache[v] = napok.size ? { napok, minta: false } : { ures: true });
      } catch (hiba) {
        console.error(hiba);
        return (cache[v] = ELONEZET ? { napok: csoportosit(mintaKezdesek()), minta: true } : { hiba: true });
      }
    })();
    return folyamatban[v];
  }
  async function idopontokMutat() {
    const v = valtozat, uzenet = $('slot-uzenet');
    uzenet.hidden = true;
    if (!cache[v]) $('napok').replaceChildren(elem('div', { class: 'napok-csontvaz csontvaz' }));
    const adat = await adatBetolt(v);
    if (v !== valtozat) return; // kozben masik valtozatot valasztott
    if (adat.ures) {
      $('napok').replaceChildren(); nyilFrissit();
      uzenet.replaceChildren(VALTOZATOK[v].nincs, elem('a', { href: motorUrl(null, v), szoveg: 'Nézd meg a foglalóban →' }));
      uzenet.hidden = false;
    } else if (adat.hiba) {
      $('napok').replaceChildren(); nyilFrissit();
      uzenet.replaceChildren('Most nem sikerült lekérni a szabad időpontokat. ', elem('a', { href: motorUrl(null, v), szoveg: 'Nézd meg itt az összeset →' }));
      uzenet.hidden = false;
    } else {
      napRajzol(adat.napok, adat.minta);
      if (adat.minta) {
        uzenet.textContent = 'MINTA időpontok: az előnézeten a valódi időpontok nem töltődnek be, az éles oldalon a MOSAIC naptárából jönnek.';
        uzenet.hidden = false;
      }
    }
  }

  // --- Egyeni / Paros valaszto: az ajanlat-panel, a szabad idopontok es a foglalo-linkek valtanak ------------------------------------
  function valtozatBeallit(v, jelez) {
    if (!VALTOZATOK[v]) return;
    valtozat = v;
    for (const r of document.querySelectorAll('input[name="valtozat"]')) r.checked = r.value === v;
    for (const panel of document.querySelectorAll('.ajanlat-panel')) panel.hidden = panel.dataset.panel !== v;
    const cim = $('ido-cim-valtozo'); if (cim) cim.textContent = VALTOZATOK[v].cim;
    const tovabbi = $('tovabbi-idopontok'); if (tovabbi) tovabbi.setAttribute('href', VALTOZATOK[v].motor);
    if (jelez) meres({ event: 'egyeni_landing_cta', cta: 'valtozat-' + v });
    if (kezdve) idopontokMutat();
  }
  let kezdve = false;
  for (const r of document.querySelectorAll('input[name="valtozat"]')) r.addEventListener('change', () => { if (r.checked) valtozatBeallit(r.value, true); });
  // hirdetesbol / linkbol: ?tipus=paros az elejen a paros valtozatot valasztja
  try { const t = new URLSearchParams(location.search).get('tipus'); if (t && VALTOZATOK[t]) valtozatBeallit(t, false); } catch (e) { /* nincs kereses */ }
  function idopontokBetolt() { if (kezdve) return; kezdve = true; idopontokMutat(); }
  // az idopontokat csak akkor kerjuk le, amikor a szekcio kozel kerul a kepernyohoz (felesleges API-hivas nelkul); telefonon a hero alatt van, ott rogton
  const idoSzekcio = $('idopontok');
  if ('IntersectionObserver' in window) {
    const fig = new IntersectionObserver((t) => { if (t.some((x) => x.isIntersecting)) { fig.disconnect(); idopontokBetolt(); } }, { rootMargin: '800px 0px' });
    fig.observe(idoSzekcio);
  } else idopontokBetolt();

  // --- 2. mozgokepek + hangos videok nagy ablaka: assets/js/video-hero.js; itt csak a meres -----------------------------------------------------------
  document.addEventListener('vh:video', (e) => meres({ event: 'egyeni_landing_video', video: e.detail.video }));

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
        if (!d.getElementById('egyeni-ti-stilus')) {
          const st = d.createElement('style');
          st.id = 'egyeni-ti-stilus';
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

  // --- ertekelesek szama: a Trustindex-widget aktualis adata; a HTML-ben a tartalek ertek all ----------------------------------------------
  const TI = 'https://cdn.trustindex.io/widgets/8a/8a7562c424f027774456be130a1/content.html';
  (async () => {
    try {
      const d = new DOMParser().parseFromString(await (await fetch(TI, { credentials: 'omit' })).text(), 'text/html');
      const a = d.querySelector('.ti-header .ti-rating-text a');
      const n = ((a && a.textContent.match(/\d[\d\s.]*/)) || [''])[0].replace(/\D/g, '');
      if (!n) return;
      for (const e of document.querySelectorAll('[data-ertekeles-db]')) e.textContent = szam(+n);
      for (const l of document.querySelectorAll('.vh-google[aria-label]')) l.setAttribute('aria-label', l.getAttribute('aria-label').replace(/\d+ Google-vélemény/, `${n} Google-vélemény`));
    } catch (hiba) { console.error(hiba); }
  })();

  // --- mobil sticky CTA: a hero gombjanak elgorgetese utan jon be, es amig az idopont-szekcio a kepernyon van, nem latszik (maga a szekcio a cel).
  //     Gorgetes-figyelo (nem IntersectionObserver): az gyors ugrasnal / gorgeto-linknel nem jelezne. ----------------------------------------
  const sticky = $('sticky-cta'), heroGomb = document.querySelector('.vh-hero .vh-cta');
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

  // --- a lepesek / vendegvideok oldalra gorgetheto soranak pontjai (telefonon) -----------------------------------------------------------
  function pontok(sorId, pontId) {
    const sor = $(sorId), pont = $(pontId);
    if (!sor || !pont) return;
    const elemek = [...sor.children];
    pont.replaceChildren(...elemek.map(() => elem('span')));
    const frissit = () => {
      const kozep = sor.scrollLeft + sor.clientWidth / 2;
      let legkozelebbi = 0, tav = Infinity;
      elemek.forEach((li, i) => { const t = Math.abs(li.offsetLeft - sor.offsetLeft + li.offsetWidth / 2 - kozep); if (t < tav) { tav = t; legkozelebbi = i; } });
      [...pont.children].forEach((p, i) => p.classList.toggle('aktiv', i === legkozelebbi));
    };
    sor.addEventListener('scroll', frissit, { passive: true });
    addEventListener('resize', frissit);
    frissit();
  }
  pontok('lepes-sor', 'lepes-pontok');
  const videokSor = document.querySelector('.videok');
  if (videokSor) { videokSor.id = videokSor.id || 'videok-sor'; pontok(videokSor.id, 'videok-pontok'); }
})();
