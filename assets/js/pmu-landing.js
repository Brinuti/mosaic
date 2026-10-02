// MOSAIC sminktetovalas landing (/pmu-sminktetovalas) - a jovahagyott asztali terv mukodese.
//
// Foglalo (4. resz), a terv uzleti logikaja szerint - a ket ag sosem aktiv egyszerre:
//   NEM (nem volt meg PMU a teruleten): 3 megerosites (2-2,5 ora, 4-7 het korrekcio, ne siess)
//        -> a szabad idopontok -> a Salonic adatlapja beagyazva (a foglalas az oldalon zarul)
//   IGEN (regi PMU): foto -> elerhetoseg -> Netlify-urlap (pmu-foto); naptar NINCS
// A kezelesek es a szabad idopontok ugyanonnan jonnek, mint a /foglalo-pmu oldalon: a Salonic
// kezelo-oldalarol es a nyilvanos naptar-API-bol. Idopontot nem talalunk ki: ha az adat nem
// jon meg, hibauzenet + link a teljes foglalora.
// Sikeres foglalas utan a Salonic a /pmu-ok oldalra iranyit (meres), onnan a klon.js a
// /foglalo-pmu koszonooldalara hoz - ugyanazzal a sessionStorage-adattal, mint ott.
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
  const TAROLO = 'mh_pmu_foglalas'; // a /foglalo-pmu koszonooldala ebbol olvas
  const OLDAL = 'pmu-sminktetovalas';

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
  const szombat = (ts) => fmt(ts, { weekday: 'short' }).toLowerCase().startsWith('szo');
  const teljes = (ts) => nagy(hetnap(ts)) + ', ' + fmt(ts, { month: 'short', day: 'numeric' }) + ' · ' + ora(ts);
  const ft = (n) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft';
  const tarol = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat mod */ } };
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
          const nev = (i.dataset.name || '').trim().replace(/\s*-\s*[\d. ]+\s*Ft helyett most\s*$/i, '');
          lista.push({ id: i.dataset.id, nev, ar: +i.dataset.price || 0, perc: +i.dataset.duration || 0 });
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
      hova.replaceChildren(...n.map((idok) => elem('a', { class: 'nap-kartya', href: '#foglalas', 'data-cta': 'idopontok-nap' },
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

  // --- 4. foglalo ----------------------------------------------------------------------
  const racs = document.querySelector('.fogl-racs');
  const allapot = { terulet: 'szemoldok', elozmeny: '', kezeles: null, fotok: [] };

  function valasztTerulet(t) {
    allapot.terulet = t;
    const r = document.querySelector('input[name=terulet][value="' + t + '"]');
    if (r) r.checked = true;
    if (allapot.elozmeny === 'nem') rajzolSlotok();
  }
  for (const r of document.querySelectorAll('input[name=terulet]')) r.addEventListener('change', () => valasztTerulet(r.value));

  function valasztElozmeny(v) {
    allapot.elozmeny = v || '';
    racs.dataset.elozmeny = allapot.elozmeny;
    for (const b of document.querySelectorAll('.igen-nem button')) b.setAttribute('aria-checked', String(b.dataset.valasz === allapot.elozmeny));
    for (const a of document.querySelectorAll('#fogl-2 [data-ag]')) a.hidden = a.dataset.ag !== allapot.elozmeny;
    // a ket ag sosem el egyszerre: IGEN mellett nincs naptar, NEM mellett nincs fotourlap
    if (allapot.elozmeny !== 'igen') $('foto-urlap').hidden = true;
    if (allapot.elozmeny !== 'nem') $('veglegesites').hidden = true;
    if (allapot.elozmeny === 'nem') rajzolSlotok();
  }
  for (const b of document.querySelectorAll('.igen-nem button')) b.addEventListener('click', () => {
    valasztElozmeny(b.dataset.valasz);
    meres({ event: 'pmu_landing_elozmeny', valasz: b.dataset.valasz });
  });

  // a tobbi szekcio gombjai elore beallitjak a foglalot
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-elozmeny], [data-terulet]');
    if (!a || a.closest('.fogl-racs')) return;
    if (a.dataset.terulet) valasztTerulet(a.dataset.terulet);
    if (a.dataset.elozmeny) valasztElozmeny(a.dataset.elozmeny);
  });
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cta]');
    if (c) meres({ event: 'pmu_landing_cta', cta: c.dataset.cta });
  });

  // NEM ag: megerositesek + szabad idopontok
  const pipak = [...document.querySelectorAll('input[name=tudom]')];
  const mindMegerositve = () => pipak.every((p) => p.checked);
  function uzenet(hova, szoveg) { hova.textContent = szoveg || ''; hova.hidden = !szoveg; }
  for (const p of pipak) p.addEventListener('change', () => {
    if (mindMegerositve()) { document.querySelector('.megerosites').classList.remove('hianyos'); uzenet($('fogl-uzenet'), ''); }
  });
  function megerositesKell() {
    if (mindMegerositve()) return false;
    const m = document.querySelector('.ag-nem .megerosites');
    m.classList.add('hianyos');
    uzenet($('fogl-uzenet'), 'Kérjük, előbb erősítsd meg a fenti három pontot – így biztosan neked való időpontot foglalsz.');
    (pipak.find((p) => !p.checked) || pipak[0]).focus();
    return true;
  }

  async function rajzolSlotok(hiba) {
    const hova = $('fogl-slotok');
    uzenet($('fogl-uzenet'), hiba || '');
    hova.replaceChildren(elem('p', { class: 'betolt', szoveg: 'Szabad időpontok keresése…' }));
    const terulet = allapot.terulet;
    try {
      const k = await teruletKezeles(terulet);
      if (terulet !== allapot.terulet) return;
      allapot.kezeles = k;
      $('teljes-naptar').href = '/foglalo-pmu' + (k ? '?kezeles=' + encodeURIComponent(k.id) : '');
      if (!k) {
        hova.replaceChildren(elem('p', { class: 'nincs' }, 'Erre a területre online most nem tudsz időpontot választani. ', elem('button', { type: 'button', class: 'link-gomb', 'data-visszahivas': 'nincs-kezeles', szoveg: 'Kérj visszahívást' }), ', és egyeztetünk.'));
        return;
      }
      const n = napok(await szabadKezdesek(k.id), 3);
      if (terulet !== allapot.terulet) return;
      if (!n.length) {
        hova.replaceChildren(elem('p', { class: 'nincs' }, 'A következő hetekre most nincs szabad időpont. ', elem('button', { type: 'button', class: 'link-gomb', 'data-visszahivas': 'nincs-idopont', szoveg: 'Kérj visszahívást' }), ', és közösen találunk egyet.'));
        return;
      }
      hova.replaceChildren(...n.map((idok) => {
        const ts = idok[0];
        return elem('button', { type: 'button', class: 'slot', 'aria-label': teljes(ts), onclick: () => slotValaszt(ts) },
          elem('span', { class: 'datum', szoveg: datum(ts) }),
          elem('span', { class: 'hetnap' + (szombat(ts) ? ' szombat' : ''), szoveg: hetnap(ts) }),
          elem('span', { class: 'ora', szoveg: ora(ts) }),
          elem('span', { html: SVG.jobbra, style: 'display:contents' }));
      }));
    } catch (e) {
      console.error(e);
      hova.replaceChildren(elem('p', { class: 'nincs' }, 'Most nem sikerült lekérni a szabad időpontokat. Próbáld újra pár perc múlva, vagy ', elem('a', { href: '/foglalo-pmu', szoveg: 'nézd meg a teljes naptárat' }), '.'));
    }
  }
  $('teljes-naptar').addEventListener('click', (e) => { if (megerositesKell()) e.preventDefault(); });

  function slotValaszt(ts) {
    if (megerositesKell()) return;
    const k = allapot.kezeles;
    if (!k) return;
    const url = SZALON.cim + '/guestData/?' + new URLSearchParams({ placeId: SZALON.placeId, serviceId: k.id, employeeId: -1, startDate: ts });
    // a /foglalo-pmu koszonooldalanak (a /pmu-ok meres utan oda jutunk)
    tarol(TAROLO, { ts, perc: k.perc, nev: k.nev, ar: k.ar ? ft(k.ar) : 'Egyedi ár', foto: document.querySelector('input[name=terulet]:checked + .radio + img').getAttribute('src') });
    $('vegl-osszegzes').replaceChildren(teljes(ts), elem('small', { szoveg: k.nev + ' · Töreki Melitta · 1023 Budapest, Bécsi út 2.' }));
    $('salonic-link').href = url;
    const keret = $('salonic');
    $('salonic-betolt').hidden = false;
    keret.style.visibility = 'hidden';
    keret.onload = () => { $('salonic-betolt').hidden = true; keret.style.visibility = ''; };
    keret.src = url;
    $('veglegesites').hidden = false;
    $('veglegesites').scrollIntoView({ behavior: 'smooth', block: 'start' });
    meres({ event: 'pmu_landing_idopont', kezeles: k.nev });
  }
  $('vegl-vissza').addEventListener('click', () => {
    $('veglegesites').hidden = true;
    $('salonic').removeAttribute('src');
    $('fogl-2').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  // A keretben a mi egyik oldalunk toltodott be (a suti.js jelzi):
  //  - sikeres foglalas: a Salonic a /pmu-ok oldalra iranyitott - a teljes ablakban nyitjuk meg (meres!);
  //  - ha az idopont kozben elkelt, a Salonic "vissza" iranyit: uj idopontokat mutatunk.
  window.mhKeretbenOldal = (href) => {
    const u = new URL(href);
    const ut = u.pathname.replace(/\/+$/, '');
    if (ut !== '' && ut !== '/' + OLDAL && ut !== '/foglalo-pmu') {
      u.searchParams.set('mh_proba', 'pmu');
      location.assign(u.href);
      return;
    }
    $('salonic').removeAttribute('src');
    $('veglegesites').hidden = true;
    if (allapot.kezeles) delete kezdesCache[allapot.kezeles.id];
    rajzolSlotok('Ez az időpont közben elfogyott. Itt vannak a következő szabad időpontok.');
    $('fogl-2').scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // --- IGEN ag: foto (nincs naptar) --------------------------------------------------------
  const MAX_FOTO = 5;
  function rajzolFotok() {
    $('foto-racs').replaceChildren(...allapot.fotok.map((f, i) => elem('div', {}, elem('img', { src: f.url, alt: 'Feltöltött fotó ' + (i + 1) }),
      elem('button', { type: 'button', 'aria-label': 'Fotó törlése', szoveg: '×', onclick: () => { URL.revokeObjectURL(f.url); allapot.fotok.splice(i, 1); rajzolFotok(); } }))));
    document.querySelector('.foto-zona').hidden = allapot.fotok.length >= MAX_FOTO;
  }
  // a telefonos fotok tobb MB-osak: 1600 px-re kicsinyitjuk (a Netlify-urlap merethatara miatt is)
  async function kicsinyit(fajl) {
    const kep = await createImageBitmap(fajl);
    const arany = Math.min(1, 1600 / Math.max(kep.width, kep.height));
    const v = elem('canvas', { width: Math.round(kep.width * arany), height: Math.round(kep.height * arany) });
    v.getContext('2d').drawImage(kep, 0, 0, v.width, v.height);
    return new Promise((ok, hiba) => v.toBlob((b) => (b ? ok(b) : hiba(new Error('toBlob'))), 'image/jpeg', 0.82));
  }
  $('foto-input').addEventListener('change', async (e) => {
    uzenet($('foto-hiba'), '');
    const fajlok = [...e.target.files].slice(0, MAX_FOTO - allapot.fotok.length);
    let rossz = 0;
    for (const f of fajlok) {
      try {
        if (!/^image\//.test(f.type) && !/\.(jpe?g|png|heic|heif|webp)$/i.test(f.name)) throw new Error('nem kep');
        const b = await kicsinyit(f);
        allapot.fotok.push({ blob: b, url: URL.createObjectURL(b) });
      } catch (err) { rossz++; }
    }
    if (rossz) uzenet($('foto-hiba'), 'Egy képet nem sikerült beolvasni. Kérjük, próbálj másik képet (JPG vagy PNG).');
    if (e.target.files.length > fajlok.length) uzenet($('foto-hiba'), 'Legfeljebb ' + MAX_FOTO + ' képet küldhetsz.');
    e.target.value = '';
    rajzolFotok();
  });

  const SZABALY = {
    nev: (v) => v.trim().length >= 2,
    telefon: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 9 && d.length <= 13; },
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  };
  function mezok(lista) {
    let elso = null;
    for (const [id, szabaly] of lista) {
      const i = $(id);
      const jo = SZABALY[szabaly](i.value);
      i.closest('.mezo').classList.toggle('rossz', !jo);
      if (!jo && !elso) elso = i;
    }
    if (elso) elso.focus();
    return !elso;
  }
  async function bekuld(adat, gomb) {
    gomb.setAttribute('aria-disabled', 'true');
    const regi = gomb.innerHTML;
    gomb.textContent = 'Küldés…';
    try {
      const o = adat instanceof FormData ? { body: adat } : { body: adat.toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } };
      const v = await leker('/', { method: 'POST', credentials: 'same-origin', ...o });
      if (!v.ok) throw new Error('HTTP ' + v.status);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    } finally { gomb.removeAttribute('aria-disabled'); gomb.innerHTML = regi; }
  }

  $('foto-gomb').addEventListener('click', async (e) => {
    const gomb = e.currentTarget;
    if (gomb.getAttribute('aria-disabled') === 'true') return;
    // a fotos ag kivalasztasa (a naptar ilyenkor eltunik)
    if (allapot.elozmeny !== 'igen') valasztElozmeny('igen');
    if ($('foto-urlap').hidden) {
      $('foto-urlap').hidden = false;
      gomb.firstChild.textContent = 'Fotók elküldése ';
      $('foto-input').click();
      return;
    }
    uzenet($('foto-hiba'), '');
    if (!allapot.fotok.length) { uzenet($('foto-hiba'), 'Kérjük, adj hozzá legalább egy fotót.'); return; }
    if (!mezok([['f-nev', 'nev'], ['f-telefon', 'telefon'], ['f-email', 'email']])) return;
    if (!$('f-hozzajarul').checked) { uzenet($('foto-hiba'), 'Kérjük, fogadd el az adatkezelést, hogy a fotóidat megnézhessük.'); return; }
    const adat = new FormData();
    adat.set('form-name', 'pmu-foto');
    adat.set('terulet', TERULETEK[allapot.terulet].nev);
    adat.set('nev', $('f-nev').value.trim());
    adat.set('telefon', $('f-telefon').value.trim());
    adat.set('email', $('f-email').value.trim());
    adat.set('oldal', OLDAL);
    allapot.fotok.forEach((f, i) => adat.set('foto' + (i + 1), f.blob, 'foto' + (i + 1) + '.jpg'));
    if (!(await bekuld(adat, gomb))) { uzenet($('foto-hiba'), 'Hiba történt a küldés közben. Kérjük, próbáld újra pár perc múlva.'); return; }
    meres({ event: 'generate_lead', lead_category: 'contact', label: 'Form name: PMU foto', form_id: 'pmu-foto' });
    allapot.fotok = [];
    rajzolFotok();
    $('foto-urlap').hidden = true;
    gomb.hidden = true;
    $('foto-kesz').hidden = false;
  });

  // --- visszahivas (harmadlagos CTA) -----------------------------------------------------------
  const ablak = $('visszahivas');
  const VH_LEIRAS = {
    modositas: 'Add meg a neved és a telefonszámod, és visszahívunk, hogy egyeztessük az új időpontot.',
  };
  let vhOk = 'hero';
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-visszahivas]');
    if (!g) return;
    vhOk = g.dataset.visszahivas;
    $('vh-leiras').textContent = VH_LEIRAS[vhOk] || 'Add meg a neved és a telefonszámod, és hamarosan visszahívunk.';
    $('vh-kesz').hidden = true;
    $('vh-kuld').hidden = false;
    uzenet($('vh-hiba'), '');
    ablak.showModal();
    $('vh-nev').focus();
  });
  ablak.addEventListener('click', (e) => { if (e.target === ablak) ablak.close(); });
  $('vh-kuld').addEventListener('click', async (e) => {
    const gomb = e.currentTarget;
    if (gomb.getAttribute('aria-disabled') === 'true') return;
    uzenet($('vh-hiba'), '');
    if (!mezok([['vh-nev', 'nev'], ['vh-telefon', 'telefon']])) return;
    const adat = new URLSearchParams({
      'form-name': 'pmu-visszahivas', nev: $('vh-nev').value.trim(), telefon: $('vh-telefon').value.trim(),
      szolgaltatas: 'Sminktetoválás – ' + TERULETEK[allapot.terulet].nev + (vhOk === 'modositas' ? ' (időpont módosítása)' : ''),
      volt_mar_tetovalasa: allapot.elozmeny === 'igen' ? 'Igen' : allapot.elozmeny === 'nem' ? 'Nem' : '',
      megjegyzes: $('vh-megjegyzes').value.trim(), oldal: OLDAL,
    });
    if (!(await bekuld(adat, gomb))) { uzenet($('vh-hiba'), 'Hiba történt a küldés közben. Kérjük, próbáld újra pár perc múlva.'); return; }
    // ugyanaz a meres, mint a sminktetovalas oldal "Smink form" urlapjanal, majd a pmu-vh koszonooldal
    const dl = (window.dataLayer = window.dataLayer || []);
    const cimke = 'Form name: Smink form';
    dl.push({ event: 'lead', event_label: cimke, event_category: 'contact' });
    dl.push({ ecommerce: null });
    dl.push({ event: 'generate_lead', lead_category: 'contact', label: cimke, form_id: '875a7aa0-161e-464f-9f14-24706dcccd86' });
    if (window.gtag) window.gtag('event', 'generate_lead', { event_category: 'contact', event_action: 'Submitted', event_label: cimke });
    $('vh-kuld').hidden = true;
    $('vh-kesz').hidden = false;
    setTimeout(() => { location.href = '/pmu-vh'; }, 1200);
  });

  // --- eredmenyek szurese ------------------------------------------------------------------------
  for (const b of document.querySelectorAll('.szuro button')) {
    b.addEventListener('click', () => {
      for (const x of document.querySelectorAll('.szuro button')) x.setAttribute('aria-selected', String(x === b));
      let lathato = 0;
      for (const k of document.querySelectorAll('#esetek .eset')) {
        const ok = b.dataset.szuro === 'osszes' || k.dataset.kategoria.split(' ').includes(b.dataset.szuro);
        k.hidden = !ok;
        if (ok) lathato++;
      }
      document.querySelector('.szuro-ures').hidden = lathato > 0;
    });
  }

  // --- video ---------------------------------------------------------------------------------------
  const video = $('video');
  $('video-gomb').addEventListener('click', () => {
    $('video-ablak').showModal();
    video.play().catch(() => {});
    meres({ event: 'pmu_landing_video' });
  });
  $('video-ablak').addEventListener('close', () => video.pause());
  $('video-ablak').addEventListener('click', (e) => { if (e.target === $('video-ablak')) $('video-ablak').close(); });
  // a hossz a fajlbol (csak a fejlecet tolti le)
  const hosszVideo = elem('video', { preload: 'metadata', muted: true, src: video.getAttribute('src') });
  hosszVideo.addEventListener('loadedmetadata', () => {
    const s = Math.round(hosszVideo.duration);
    if (!isFinite(s) || !s) return;
    $('video-hossz').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    $('video-hossz').hidden = false;
    hosszVideo.removeAttribute('src');
  });

  // --- terkep: Google-terkep a funkcionalis sutik engedelyezese utan (mint a klon tobbi oldalan) ---
  function terkep(engedve) {
    if (!engedve || $('terkep').querySelector('iframe')) return;
    $('terkep').prepend(elem('iframe', {
      title: 'Térkép: MOSAIC, 1023 Budapest, Bécsi út 2.', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: 'https://www.google.com/maps?q=' + encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed',
    }));
    $('terkep').querySelector('.terkep-kep').style.cssText = 'background:none;inset:auto 0 0 auto;width:auto;height:auto';
  }
  // a terv szerint a foglalo a NEM aggal indul (a harom megerositest a latogato pipalja ki)
  valasztElozmeny('nem');

  if (window.mhSuti) { terkep(window.mhSuti.engedely('fun')); window.mhSuti.figyel((d) => terkep(d.fun)); }
})();
