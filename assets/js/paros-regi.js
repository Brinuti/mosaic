// A (regi, Wixes tartalmu) Paros Head Spa oldal (/paros-headspa-budapest) kiegeszito mukodese - 2026-10-09, a tulajdonos kerese:
//  1. Hero: a KOZOS videos hero (assets/js/video-hero.js, docs/VIDEOS_HERO.md): hang nelkuli hatter-klip, a play gomb a hangos paros videot NAGY ablakban nyitja; itt csak a meres.
//  2. Legkozelebbi szabad idopontok (#idopontok): a Salonic nyilvanos naptar-API-bol, ugyanaz a kod, mint az ujratervezett (-uj) oldalon (assets/js/paros-landing.js).
//     Idopontot nem talalunk ki: ha az API nem valaszol, a foglalo-motorra vezetunk. Csak az elonezeten (*.pages.dev, localhost) jelennek meg MINTA idopontok, jelolve.
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
  const NAPI_IDO = () => (matchMedia('(max-width: 700px)').matches ? 3 : 4);   // oszloponkent ennyi idopont latszik elsore (a tobbi a "+N" gombra); telefonon kevesebb: kompaktabb
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
  let betoltve = false;
  async function idopontokBetolt() {
    if (betoltve) return;
    betoltve = true;
    const uzenet = $('slot-uzenet');
    uzenet.hidden = true;
    try {
      const napok = csoportosit(await szabadKezdesek());
      if (!napok.size) {
        $('napok').replaceChildren(); nyilFrissit();
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
      $('napok').replaceChildren(); nyilFrissit();
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

  // --- 1. hero: a play gomb nagy ablakban nyitja a hangos videot (video-hero.js); a meres: paros_landing_video ----------------------------------------------
  document.addEventListener('vh:video', (e) => meres({ event: 'paros_landing_video', video: e.detail.video }));
})();
