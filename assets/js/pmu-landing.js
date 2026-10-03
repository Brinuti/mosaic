// MOSAIC sminktetovalas landing (/pmu-sminktetovalas) - a jovahagyott asztali terv mukodese.
//
// Foglalo (4. resz): a megtervezett foglalasi folyamat (/foglalo-pmu?beagyazva=1) keretben - a
// kezeles -> idopont -> kerdes (NEM: commitment, IGEN: foto, naptar nelkul) -> adatok logika ott el.
// A hero "legkozelebbi szabad idopontok" kartyai ugyanonnan jonnek, mint a /foglalo-pmu oldalon:
// a Salonic kezelo-oldalarol es a nyilvanos naptar-API-bol. Idopontot nem talalunk ki.
(() => {
  'use strict';

  // A sajat kereteben nyiltunk meg (a Salonic visszairanyitott): a suti.js mar jelzett a szulonek.
  try { if (window.top !== window.self && window.parent.location.hostname === location.hostname) return; } catch (e) { /* idegen keret */ }

  const SZALON = {
    cim: 'https://mosaic-pmu.salonic.hu',
    placeId: 14585,
    kezelo: 32428, // Toreki Melitta
    naptar: '76a8541e-bb52-22ab-f8c0-531b86f55abb',
  };
  const API = 'https://api.salonic.hu/calendar/getAvailableTimes';
  const ZONA = 'Europe/Budapest';
  const ELORE_NAP = 92;

  // terulet -> Salonic-kezeles (a kezeles neve alapjan; az elso talalat szamit)
  const TERULETEK = {
    szemoldok: { nev: 'Szemöldök', re: /szem[oö]ld[oö]k/i, kerul: /hibrid|korrekci|friss[ií]t|konzult/i },
    ajak: { nev: 'Ajak', re: /ajak/i, kerul: /korrekci|friss[ií]t|konzult/i },
    szemhej: { nev: 'Szemhéj', re: /szemh[eé]j/i, kerul: /korrekci|friss[ií]t|konzult/i },
    frissites: { nev: 'Frissítés', re: /friss[ií]t/i, kerul: /konzult/i },
  };

  const $ = (id) => document.getElementById(id);
  const elem = (tag, attr = {}, ...gyerek) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)) {
      if (k === 'szoveg') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const g of gyerek) if (g != null) e.append(g);
    return e;
  };
  const SVG = {
    naptar: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    ora: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    jobbra: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  };
  const fmt = (ts, o) => new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, ...o }).format(new Date(ts * 1000));
  const napKulcs = (ts) => fmt(ts, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\s/g, '');
  const ora = (ts) => fmt(ts, { hour: '2-digit', minute: '2-digit' });
  const nagy = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const datum = (ts) => nagy(fmt(ts, { month: 'short', day: 'numeric' })); // "Okt. 6."
  const hetnap = (ts) => fmt(ts, { weekday: 'long' });
  const iso = (ts) => new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA }).format(new Date(ts * 1000)); // 2026-10-06
  const meres = (adat) => { (window.dataLayer = window.dataLayer || []).push(adat); };

  function leker(url, o = {}) {
    const ab = new AbortController();
    const ido = setTimeout(() => ab.abort(), 15000);
    return fetch(url, { credentials: 'omit', signal: ab.signal, ...o }).finally(() => clearTimeout(ido));
  }

  // --- Salonic-adatok ------------------------------------------------------------
  let kezelesekIgeret = null;
  function kezelesek() {
    if (!kezelesekIgeret) {
      kezelesekIgeret = (async () => {
        const v = await leker(SZALON.cim + '/employees/' + SZALON.kezelo + '/?placeId=' + SZALON.placeId);
        const d = new DOMParser().parseFromString(await v.text(), 'text/html');
        const lista = [];
        for (const i of d.querySelectorAll('input[data-id][data-duration]')) {
          if (lista.some((k) => k.id === i.dataset.id)) continue;
          // "Ajaktetovalas - Aquarell - 124.900 Ft helyett most" -> nev + eredeti ar
          const nyers = (i.dataset.name || '').trim();
          const m = nyers.match(/^(.*?)\s*-\s*([\d. ]+)\s*Ft helyett most\s*$/i);
          lista.push({ id: i.dataset.id, nev: m ? m[1] : nyers, eredeti: m ? +m[2].replace(/\D/g, '') : 0, ar: +i.dataset.price || 0, perc: +i.dataset.duration || 0 });
        }
        if (!lista.length) throw new Error('nincs kezeles');
        return lista;
      })();
      kezelesekIgeret.catch(() => { kezelesekIgeret = null; });
    }
    return kezelesekIgeret;
  }
  async function teruletKezeles(terulet) {
    const t = TERULETEK[terulet];
    const lista = await kezelesek();
    return lista.find((k) => t.re.test(k.nev) && !t.kerul.test(k.nev)) || lista.find((k) => t.re.test(k.nev)) || null;
  }
  const kezdesCache = {};
  function szabadKezdesek(kezelesId) {
    if (!kezdesCache[kezelesId]) {
      const p = new URLSearchParams({
        startDate: Math.floor(Date.now() / 1000) - 3 * 3600, offset: 0, days: ELORE_NAP, placeId: SZALON.placeId, serviceId: kezelesId,
        employeeId: -1, calendarId: SZALON.naptar, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0,
      });
      kezdesCache[kezelesId] = (async () => {
        const j = await (await leker(API + '?' + p)).json();
        if (j.status !== 'success') throw new Error('API: ' + j.status);
        const most = Date.now() / 1000 + 30 * 60;
        const ki = new Set();
        for (const kezelok of Object.values(j.data.blocks || {})) {
          for (const k of Object.values(kezelok)) for (const s of Object.values(k.slots || {})) if (s.timestamp > most) ki.add(s.timestamp);
        }
        return [...ki].sort((a, b) => a - b);
      })();
      kezdesCache[kezelesId].catch(() => { delete kezdesCache[kezelesId]; });
    }
    return kezdesCache[kezelesId];
  }
  // naponkent csoportositva: [[elso kezdes, [kezdesek]], ...]
  function napok(kezdesek, db) {
    const m = new Map();
    for (const ts of kezdesek) { const k = napKulcs(ts); if (!m.has(k)) { if (m.size >= db) break; m.set(k, []); } m.get(k).push(ts); }
    return [...m.values()];
  }

  // --- 1b. legkozelebbi szabad idopontok (szemoldok, a leggyakoribb kezeles) -------------
  (async () => {
    const hova = $('hero-napok');
    try {
      const k = await teruletKezeles('szemoldok');
      if (!k) throw new Error('nincs szemoldok-kezeles');
      const n = napok(await szabadKezdesek(k.id), 3);
      if (!n.length) {
        hova.replaceChildren(elem('p', { class: 'nap-uzenet', szoveg: 'A következő hetekre most nincs szabad időpont. Kérj visszahívást, és közösen találunk egyet!' }));
        return;
      }
      hova.replaceChildren(...n.map((idok) => elem('a', { class: 'nap-kartya', href: '#foglalas', 'data-foglalo': 'lepes=szolg&nap=' + iso(idok[0]), 'data-cta': 'idopontok-nap' },
        elem('span', { class: 'ikon-kor', html: SVG.naptar }),
        elem('span', { class: 'kis-nyil', html: SVG.jobbra }),
        elem('span', { class: 'datum', szoveg: datum(idok[0]) }),
        elem('span', { class: 'hetnap', szoveg: hetnap(idok[0]) }),
        elem('span', { class: 'orak', html: SVG.ora }, idok.slice(0, 3).map(ora).join(' / ')))));
    } catch (e) {
      console.error(e);
      hova.replaceChildren(elem('p', { class: 'nap-uzenet' }, 'Most nem sikerült lekérni a szabad időpontokat. ', elem('a', { href: '/foglalo-pmu', szoveg: 'Nézd meg itt az összeset →' })));
    }
  })();

  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cta]');
    if (c) meres({ event: 'pmu_landing_cta', cta: c.dataset.cta });
  });

  // --- 2. arak: a kartyak arai a Salonicbol frissulnek (a HTML-ben levo ertek a tartalek) ------------
  (async () => {
    try {
      const lista = await kezelesek();
      const norm = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const ft = (n) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft';
      for (const k of document.querySelectorAll('.ar-kartya[data-salonic]')) {
        const szavak = k.dataset.salonic.split('-');
        const t = lista.find((x) => szavak.every((w) => norm(x.nev).includes(w)));
        if (!t || !t.ar) continue;
        k.querySelector('.ar-most').textContent = ft(t.ar);
        // athuzott (regi) ar nem jelenik meg: csak a valos, jelenlegi ar; az idotartam mindenhol 2-2,5 ora (HTML)
      }
    } catch (e) { console.error(e); }
  })();

  // --- 4. foglalo: a megtervezett foglalasi folyamat (/foglalo-pmu) beagyazva -------------------
  // A keret magassagat a beagyazott oldal jelzi (postMessage), nezetvaltaskor a keret tetejere
  // gorgetunk, ha az mar a kepernyon kivul van. A tobbi szekcio gombjai (data-foglalo) a folyamat
  // megfelelo lepeset nyitjak meg: lepes=szolg (kezelesvalasztas), lepes=foto (regi PMU: foto),
  // lepes=visszahivas (10 perces konzultacio), kezeles=<kulcsszo> (kezeles elore kivalasztva).
  const keret = $('foglalo');
  const ALAP = '/foglalo-pmu?beagyazva=1';
  let nezetek = 0;
  keret.addEventListener('load', () => { nezetek = 0; });
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.source !== keret.contentWindow || !e.data || !e.data.mhFoglalo) return;
    if (e.data.magassag) keret.style.height = e.data.magassag + 'px';
    // az elso (betolteskori) nezetnel nem gorgetunk
    // mobilon minden lepesvaltaskor a keret teteje a fejlec ala kerul, igy az adott lepes egesze a kepernyon van
    if (e.data.nezet && nezetek++ && (mobil() || keret.getBoundingClientRect().top < 0)) keretIgazit();
  });
  const mobil = () => matchMedia('(max-width: 700px)').matches;
  function keretIgazit() {
    const fej = document.getElementById('SITE_HEADER');
    const fejAlja = fej && /fixed|sticky/.test(getComputedStyle(fej).position) ? Math.max(0, fej.getBoundingClientRect().bottom) : 0;
    const cel = $('foglalo-keret').getBoundingClientRect().top + scrollY - fejAlja - (mobil() ? 6 : 16);
    scrollTo({ top: Math.max(0, cel), behavior: 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-foglalo]');
    if (!g) return;
    e.preventDefault();
    keret.loading = 'eager';
    keret.src = ALAP + '&' + g.dataset.foglalo;
    keretIgazit();
  });

  // --- eredmenyek: Szemoldok / Ajak szuro, eloszor 12 kep ----------------------------------------
  const refRacs = $('esetek');
  const ELSO = 16;
  let szuro = 'osszes';
  function rajzolRef(mind) {
    let n = 0;
    for (const k of refRacs.querySelectorAll('.ref')) {
      const ok = szuro === 'osszes' || k.dataset.kategoria === szuro;
      k.hidden = !ok;
      if (ok) k.classList.toggle('tobb', ++n > ELSO);
    }
    refRacs.classList.toggle('zart', !mind && n > ELSO);
    $('ref-tobb').hidden = mind || n <= ELSO;
  }
  function valasztSzuro(nev) {
    szuro = nev;
    for (const x of document.querySelectorAll('.szuro button')) x.setAttribute('aria-selected', String(x.dataset.szuro === nev));
    rajzolRef(false);
  }
  for (const b of document.querySelectorAll('.szuro button')) b.addEventListener('click', () => valasztSzuro(b.dataset.szuro));
  for (const a of document.querySelectorAll('[data-szuro-ugras]')) a.addEventListener('click', () => valasztSzuro(a.dataset.szuroUgras));
  $('ref-tobb').addEventListener('click', () => rajzolRef(true));
  rajzolRef(false);

  // --- referenciak: kattintasra nagyban (lapozhato, Esc / hatterre kattintas bezarja) -------------------
  const nagyito = elem('dialog', { class: 'nagyito', 'aria-label': 'Nagyított kép' });
  const nagyKep = elem('img', { alt: '' });
  let nagyIdx = 0;
  const lathatoRefek = () => [...refRacs.querySelectorAll('.ref')].filter((f) => !f.hidden);
  const nagyMutat = (i) => { const l = lathatoRefek(); nagyIdx = (i + l.length) % l.length; const im = l[nagyIdx].querySelector('img'); nagyKep.src = im.src; nagyKep.alt = im.alt; };
  nagyito.append(nagyKep,
    elem('button', { type: 'button', class: 'vh-zar', 'aria-label': 'Bezárás', szoveg: '×', onclick: () => nagyito.close() }),
    elem('button', { type: 'button', class: 'lapoz elozo', 'aria-label': 'Előző kép', szoveg: '‹', onclick: () => nagyMutat(nagyIdx - 1) }),
    elem('button', { type: 'button', class: 'lapoz kov', 'aria-label': 'Következő kép', szoveg: '›', onclick: () => nagyMutat(nagyIdx + 1) }));
  nagyito.addEventListener('click', (e) => { if (e.target === nagyito) nagyito.close(); });
  nagyito.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') nagyMutat(nagyIdx - 1); if (e.key === 'ArrowRight') nagyMutat(nagyIdx + 1); });
  document.body.append(nagyito);
  refRacs.addEventListener('click', (e) => {
    const f = e.target.closest('.ref');
    if (!f) return;
    nagyMutat(lathatoRefek().indexOf(f));
    nagyito.showModal();
  });

  // --- terkep: a MOSAIC Google-ertekelese a Trustindex-widget aktualis tartalmabol ----------------------
  // A Trustindex a suti-tajekoztato szerint "funkcionalis" szolgaltatas: csak ennek engedelyezese utan kerdezzuk le.
  const TI = 'https://cdn.trustindex.io/widgets/8a/8a7562c424f027774456be130a1/content.html';
  let tiKesz = false;
  async function ertekelesFrissit() {
    if (tiKesz || !$('te-db') || !(window.mhSuti && mhSuti.engedely('fun'))) return;
    tiKesz = true;
    try {
      const d = new DOMParser().parseFromString(await (await fetch(TI, { credentials: 'omit' })).text(), 'text/html');
      const fej = d.querySelector('.ti-header');
      const db = ((fej && fej.querySelector('.ti-rating-text a')) || {}).textContent || '';
      const n = (db.match(/\d[\d\s.]*/) || [''])[0].replace(/\D/g, '');
      const cs = fej ? [...fej.querySelectorAll('.ti-stars .ti-star')].map((x) => (x.classList.contains('f') ? 1 : x.classList.contains('h') ? 0.5 : 0)) : [];
      const min = ((fej && fej.querySelector('.ti-rating')) || {}).textContent;
      if (n) $('te-db').textContent = new Intl.NumberFormat('hu-HU').format(+n).replace(/\s/g, '.') + ' Google-vélemény';
      if (cs.length === 5) {
        const ossz = cs.reduce((a, b) => a + b, 0);
        $('te-csillagok').style.setProperty('--ert', (ossz / 5) * 100 + '%');
        $('te-csillagok').setAttribute('aria-label', '5 csillagból ' + String(ossz).replace('.', ','));
      }
      if (min && min.trim()) $('te-minosites').textContent = min.trim().replace(/ értékelés$/i, '');
    } catch (e) { tiKesz = false; console.error(e); }
  }
  ertekelesFrissit();
  if (window.mhSuti && mhSuti.figyel) mhSuti.figyel(ertekelesFrissit);

  // --- velemenyek: lapozhato sor ---------------------------------------------------------------------
  const velRacs = $('vel-racs');
  const velAllapot = () => {
    $('vel-elozo').disabled = velRacs.scrollLeft < 4;
    $('vel-kov').disabled = velRacs.scrollLeft + velRacs.clientWidth > velRacs.scrollWidth - 4;
  };
  const velLapoz = (irany) => velRacs.scrollBy({ left: irany * velRacs.clientWidth * 0.9, behavior: 'smooth' });
  $('vel-elozo').addEventListener('click', () => velLapoz(-1));
  $('vel-kov').addEventListener('click', () => velLapoz(1));
  velRacs.addEventListener('scroll', velAllapot, { passive: true });
  addEventListener('resize', velAllapot);
  velAllapot();

  // --- video (Google Drive, allo formatum): csak kattintasra toltodik be ------------------------------
  const VIDEO = 'https://drive.google.com/file/d/1HaOg3JRFZmDfUAJ0rgHAtzW2UndqO09i/preview';
  $('video-gomb').addEventListener('click', () => {
    $('video-keret').replaceChildren(elem('iframe', { src: VIDEO, title: 'Videó: hogyan dolgozom', allow: 'autoplay; fullscreen', allowfullscreen: true }));
    $('video-ablak').showModal();
    meres({ event: 'pmu_landing_video' });
  });
  $('video-ablak').addEventListener('close', () => $('video-keret').replaceChildren());
  $('video-ablak').addEventListener('click', (e) => { if (e.target === $('video-ablak')) $('video-ablak').close(); });


  // --- terkep: Google-terkep a funkcionalis sutik engedelyezese utan (mint a klon tobbi oldalan) ---
  function terkep(engedve) {
    if (!engedve || $('terkep').querySelector('iframe')) return;
    $('terkep').prepend(elem('iframe', {
      title: 'Térkép: MOSAIC, 1023 Budapest, Bécsi út 2.', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: 'https://www.google.com/maps?q=' + encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed',
    }));
    $('terkep').querySelector('.terkep-kep').style.cssText = 'background:none;inset:auto 0 0 auto;width:auto;height:auto';
  }
  if (window.mhSuti) { terkep(window.mhSuti.engedely('fun')); window.mhSuti.figyel((d) => terkep(d.fun)); }
})();
