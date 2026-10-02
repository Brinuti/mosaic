// Sajat foglalo felulet (proba) a Salonic adataira epitve: /foglalo-proba
//
// A kezelestipusokat es a keleseket a Salonic foglalo oldalaibol olvassuk ki (a
// salonic.hu oldalai engedik a mas domainrol valo lekerest), a szabad idopontokat a
// Salonic nyilvanos naptar-API-ja adja (api.salonic.hu/calendar/getAvailableTimes).
// A foglalas veglegesitese (nev, elerhetoseg, foglalasi dij) a Salonic sajat oldalan
// tortenik: a kivalasztott idoponttal egyenesen az adatmegado lepesre (/guestData/)
// visszuk a vendeget - a foglalast igy a Salonic rogziti, minden e-mailjevel, a
// koszonooldali meressel egyutt, ugyanugy, mint eddig. (A Salonic az adatlapot
// reCAPTCHA-val vedi, azt csak a sajat oldalan lehet kitolteni.)
(() => {
  'use strict';

  const SZALON = {
    nev: 'MOSAIC Headspa',
    cim: 'https://mosaicheadspa.salonic.hu',
    placeId: 10427,
  };
  const API = 'https://api.salonic.hu/calendar/getAvailableTimes';
  const NAP_MP = 86400;
  const ZONA = 'Europe/Budapest';
  const NAPOK_SZAMA = 14; // egyszerre ennyi napot toltunk be

  const $ = (id) => document.getElementById(id);
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
  const ft = (n) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft';
  const perc = (p) => (p >= 60 ? Math.floor(p / 60) + ' óra' + (p % 60 ? ' ' + (p % 60) + ' perc' : '') : p + ' perc');
  const datumFmt = (ts, o) => new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, ...o }).format(new Date(ts * 1000));
  const napKulcs = (ts) => datumFmt(ts, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const ora = (ts) => +datumFmt(ts, { hour: 'numeric', hourCycle: 'h23' });

  const allapot = {
    kategoriak: [], kategoria: null,
    szolgaltatasok: [], szolgaltatas: null,
    naptar: null, // calendarId (a Salonic idopontvalaszto oldalarol)
    betoltveIg: 0, // eddig a napig (unix) toltottuk be az idopontokat
    idopontok: [], // { ts, munkatars }
    munkatarsNevek: new Map(),
    munkatars: -1, nap: null, idopont: null,
  };

  async function oldal(ut) {
    const v = await fetch(SZALON.cim + ut, { credentials: 'omit' });
    if (!v.ok) throw new Error('HTTP ' + v.status);
    return new DOMParser().parseFromString(await v.text(), 'text/html');
  }
  const szoveg = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');

  // --- lepesek -------------------------------------------------------------
  const LEPESEK = ['kategoria', 'szolgaltatas', 'idopont', 'osszegzes'];
  function lepes(nev) {
    for (const l of LEPESEK) $(l).hidden = l !== nev;
    const i = LEPESEK.indexOf(nev);
    for (const li of $('lepesek').children) {
      const j = LEPESEK.indexOf(li.dataset.lepes);
      li.className = j === i ? 'aktiv' : j < i ? 'kesz' : '';
    }
    $('also').hidden = nev !== 'idopont';
    scrollTo({ top: 0, behavior: 'smooth' });
    try { history.replaceState(null, '', '#' + nev); } catch (e) { /* nem baj */ }
  }
  $('lepesek').addEventListener('click', (e) => {
    const li = e.target.closest('li.kesz');
    if (li) lepes(li.dataset.lepes);
  });
  for (const g of document.querySelectorAll('[data-vissza]')) g.addEventListener('click', () => lepes(g.dataset.vissza));

  function hibaUzenet(hova, e) {
    console.error(e);
    hova.replaceChildren(elem('div', { class: 'hiba' },
      'Most nem sikerült betölteni az adatokat. ',
      elem('a', { href: SZALON.cim + '/selectSpecialization/?placeId=' + SZALON.placeId, szoveg: 'Foglalj itt' }),
      '.'));
  }

  // --- 1. kezelestipusok ---------------------------------------------------
  async function kategoriak() {
    const hova = $('kategoriak');
    try {
      const d = await oldal('/selectSpecialization/?placeId=' + SZALON.placeId);
      const lista = [];
      for (const a of d.querySelectorAll('a[href*="showServices"]')) {
        const spec = new URL(a.getAttribute('href'), SZALON.cim).searchParams.get('specId');
        if (!spec || lista.some((k) => k.spec === spec)) continue;
        const doboz = a.closest('.card-header, .card') || a.parentElement;
        lista.push({
          spec,
          nev: szoveg(doboz.querySelector('.list-group-item-specName')) || szoveg(a),
          leiras: szoveg(doboz.querySelector('.card-description')),
          kep: (doboz.querySelector('img') || {}).src || '',
        });
      }
      if (!lista.length) throw new Error('nincs kezelestipus');
      allapot.kategoriak = lista;
      hova.replaceChildren(...lista.map((k) => elem('button', { type: 'button', class: 'kartya', onclick: () => kategoriaValaszt(k) },
        k.kep ? elem('img', { src: k.kep, alt: '', loading: 'lazy' }) : elem('span'),
        elem('span', {}, elem('span', { class: 'nev', szoveg: k.nev }), k.leiras ? elem('span', { class: 'info', szoveg: k.leiras }) : null),
        elem('span', { class: 'ar', szoveg: '›' }))));
      if (lista.length === 1) kategoriaValaszt(lista[0]);
    } catch (e) { hibaUzenet(hova, e); }
  }

  // --- 2. kezelesek --------------------------------------------------------
  async function kategoriaValaszt(k) {
    allapot.kategoria = k;
    $('szolgaltatas-cim').textContent = k.nev;
    const hova = $('szolgaltatasok');
    hova.replaceChildren(elem('div', { class: 'betolt', szoveg: 'Kezelések betöltése…' }));
    lepes('szolgaltatas');
    try {
      const d = await oldal('/showServices/?placeId=' + SZALON.placeId + '&specId=' + k.spec);
      const lista = [...d.querySelectorAll('input[type=checkbox][data-id]')].map((i) => {
        const label = d.querySelector('label[for="' + i.id + '"]') || i.parentElement;
        return {
          id: i.dataset.id,
          nev: i.dataset.name,
          ar: +i.dataset.price || 0,
          perc: +i.dataset.duration || 0,
          leiras: szoveg(label.querySelector('.service-description-booking-showServices')),
          cimke: szoveg(label.querySelector('.label-promo')),
        };
      });
      if (!lista.length) throw new Error('nincs kezeles');
      allapot.szolgaltatasok = lista;
      hova.replaceChildren(...lista.map((s) => elem('button', { type: 'button', class: 'kartya', onclick: () => szolgaltatasValaszt(s) },
        elem('span'),
        elem('span', {},
          elem('span', { class: 'nev', szoveg: s.nev }),
          elem('span', { class: 'info', szoveg: perc(s.perc) + (s.leiras ? ' · ' + s.leiras : '') }),
          s.cimke ? elem('span', { class: 'cimke', szoveg: s.cimke === 'Discount' ? 'Akció' : s.cimke === 'New' ? 'Új' : s.cimke }) : null),
        elem('span', { class: 'ar', szoveg: ft(s.ar) }))));
    } catch (e) { hibaUzenet(hova, e); }
  }

  // --- 3. kezelo es idopont ------------------------------------------------
  async function naptarAzonosito(szolg) {
    const v = await fetch(SZALON.cim + '/selectDate/?employeeId=-1&placeId=' + SZALON.placeId + '&serviceId=' + szolg, { credentials: 'omit' });
    const m = (await v.text()).match(/calendarId:\s*'([^']+)'/);
    if (!m) throw new Error('nincs calendarId');
    return m[1];
  }

  async function idopontokBetolt(tol, napok) {
    const p = new URLSearchParams({
      startDate: tol, offset: 0, days: napok, placeId: SZALON.placeId, serviceId: allapot.szolgaltatas.id,
      employeeId: -1, calendarId: allapot.naptar, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0,
    });
    const v = await fetch(API + '?' + p, { credentials: 'omit' });
    const j = await v.json();
    if (j.status !== 'success') throw new Error('API: ' + j.status);
    const most = Date.now() / 1000;
    for (const munkatarsak of Object.values(j.data.blocks || {})) {
      for (const [mid, m] of Object.entries(munkatarsak)) {
        allapot.munkatarsNevek.set(mid, m.employeeName.trim());
        for (const s of Object.values(m.slots || {})) {
          if (s.timestamp > most && !allapot.idopontok.some((x) => x.ts === s.timestamp && x.munkatars === mid)) {
            allapot.idopontok.push({ ts: s.timestamp, munkatars: mid });
          }
        }
      }
    }
  }

  async function szolgaltatasValaszt(s) {
    Object.assign(allapot, { szolgaltatas: s, idopontok: [], munkatarsNevek: new Map(), munkatars: -1, nap: null, idopont: null });
    lepes('idopont');
    $('munkatarsak').replaceChildren();
    $('napok').replaceChildren();
    $('idok').replaceChildren(elem('div', { class: 'betolt', szoveg: 'Szabad időpontok keresése…' }));
    alsoFrissit();
    try {
      allapot.naptar = allapot.naptar || await naptarAzonosito(s.id);
      // a mai nap eleje (budapesti ido szerint nem kell pontosnak lennie: a mult idopontokat kiszurjuk)
      const ma = Math.floor(Date.now() / 1000) - 3 * 3600;
      await Promise.all([idopontokBetolt(ma, 7), idopontokBetolt(ma + 7 * NAP_MP, 7)]);
      allapot.betoltveIg = ma + NAPOK_SZAMA * NAP_MP;
      rajzolIdopont();
    } catch (e) { hibaUzenet($('idok'), e); }
  }

  async function tovabbiNapok(gomb) {
    gomb.disabled = true;
    gomb.textContent = '…';
    try {
      await idopontokBetolt(allapot.betoltveIg, 7);
      allapot.betoltveIg += 7 * NAP_MP;
      rajzolIdopont();
    } catch (e) { gomb.textContent = 'Hiba – újra'; gomb.disabled = false; }
  }

  const szurt = () => allapot.idopontok.filter((x) => allapot.munkatars === -1 || x.munkatars === allapot.munkatars);

  function rajzolIdopont() {
    // kezelok: csak azok, akiknek van szabad idopontja
    const vanIdeje = new Set(allapot.idopontok.map((x) => x.munkatars));
    const kezelok = [...allapot.munkatarsNevek].filter(([id]) => vanIdeje.has(id));
    $('munkatarsak').replaceChildren(...(kezelok.length > 1 ? [[-1, 'Bárki'], ...kezelok] : []).map(([id, nev]) =>
      elem('button', { type: 'button', class: 'chip', 'aria-pressed': String(allapot.munkatars === id), szoveg: nev,
        onclick: () => { allapot.munkatars = id; allapot.idopont = null; rajzolIdopont(); } })));

    // napok: a betoltott idoszak minden napja, a szabad idopont nelkuliek tiltva
    const idok = szurt();
    const napiDb = new Map();
    for (const x of idok) napiDb.set(napKulcs(x.ts), (napiDb.get(napKulcs(x.ts)) || 0) + 1);
    const elsoNap = Math.floor(Date.now() / 1000);
    const napok = [];
    for (let t = elsoNap; t < allapot.betoltveIg; t += NAP_MP) napok.push(t);
    if (!allapot.nap || !napiDb.has(allapot.nap)) allapot.nap = napok.map(napKulcs).find((k) => napiDb.has(k)) || null;
    $('napok').replaceChildren(...napok.map((t) => {
      const k = napKulcs(t);
      return elem('button', { type: 'button', class: 'nap', disabled: !napiDb.has(k), 'aria-pressed': String(k === allapot.nap),
        title: napiDb.has(k) ? napiDb.get(k) + ' szabad időpont' : 'Nincs szabad időpont',
        onclick: () => { allapot.nap = k; allapot.idopont = null; rajzolIdopont(); } },
        elem('small', { szoveg: datumFmt(t, { weekday: 'short' }) }),
        elem('b', { szoveg: datumFmt(t, { day: 'numeric' }) }),
        elem('small', { szoveg: datumFmt(t, { month: 'short' }) }));
    }), elem('button', { type: 'button', class: 'tovabbnap', szoveg: 'Későbbi napok ›', onclick: (e) => tovabbiNapok(e.currentTarget) }));
    const kijelolt = $('napok').querySelector('[aria-pressed="true"]');
    if (kijelolt) kijelolt.scrollIntoView({ block: 'nearest', inline: 'center' });

    // idopontok a kivalasztott napon (Barki: minden kezelo idopontja egyszer)
    const hova = $('idok');
    if (!allapot.nap) {
      hova.replaceChildren(elem('div', { class: 'ures', szoveg: 'Ebben az időszakban nincs szabad időpont – nézd meg a későbbi napokat.' }));
      alsoFrissit();
      return;
    }
    const napi = [...new Set(idok.filter((x) => napKulcs(x.ts) === allapot.nap).map((x) => x.ts))].sort((a, b) => a - b);
    const reszek = [['Délelőtt', (h) => h < 12], ['Délután', (h) => h >= 12 && h < 17], ['Este', (h) => h >= 17]];
    hova.replaceChildren(...reszek.flatMap(([cim, felt]) => {
      const r = napi.filter((ts) => felt(ora(ts)));
      if (!r.length) return [];
      return [elem('div', { class: 'napresz', szoveg: cim }), elem('div', { class: 'idok' }, ...r.map((ts) =>
        elem('button', { type: 'button', class: 'ido', 'aria-pressed': String(allapot.idopont === ts), szoveg: datumFmt(ts, { hour: '2-digit', minute: '2-digit' }),
          onclick: () => { allapot.idopont = ts; rajzolIdopont(); } })))];
    }));
    alsoFrissit();
  }

  function alsoFrissit() {
    const s = allapot.szolgaltatas;
    const ts = allapot.idopont;
    $('also-szoveg').replaceChildren(ts
      ? elem('span', {}, elem('b', { szoveg: datumFmt(ts, { month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' }) }))
      : elem('span', { szoveg: s ? 'Válassz időpontot' : '' }));
    $('also-gomb').disabled = !ts;
  }
  $('also-gomb').addEventListener('click', () => { if (allapot.idopont) osszegzes(); });

  // --- 4. osszegzes es atadas a Salonicnak -----------------------------------
  function osszegzes() {
    const s = allapot.szolgaltatas;
    const ts = allapot.idopont;
    // a valasztott kezelo; "Barki" eseten a Salonic osztja ki (ugyanugy, mint nala)
    const mid = allapot.munkatars;
    const sorok = [
      ['Kezelés', s.nev],
      ['Időtartam', perc(s.perc)],
      ['Ár', ft(s.ar)],
      ['Időpont', datumFmt(ts, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })],
      ['Kezelő', mid === -1 ? 'Bárki (a szalon osztja be)' : allapot.munkatarsNevek.get(mid)],
      ['Helyszín', SZALON.nev + ', 1023 Budapest, Bécsi út 4.'],
    ];
    $('osszegzes-adatok').replaceChildren(...sorok.flatMap(([k, v]) => [elem('dt', { szoveg: k }), elem('dd', { szoveg: v })]));
    $('veglegesit').href = SZALON.cim + '/guestData/?' + new URLSearchParams({
      placeId: SZALON.placeId, serviceId: s.id, employeeId: mid, startDate: ts,
    });
    lepes('osszegzes');
  }

  kategoriak();
})();
