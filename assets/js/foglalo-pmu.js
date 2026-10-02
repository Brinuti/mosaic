// Naptar-elso foglalo felulet (proba) a sminktetovalashoz: /foglalo-pmu
//
// A vendeg eloszor egy havi naptart lat a szabad napokkal, a napra kattintva valaszt
// kezelest, aztan kezdesi idopontot, vegul a Salonic beagyazott adatlapjan foglal.
//
// Honnan tudjuk a szabad idot kezeles nelkul? A PMU-szalonban egy kezelo van, es a
// Salonic a legrovidebb (30 perces) kezeles szabad kezdeseit adja meg 15 percenkent - ezekbol
// osszerakhatok a naptar szabad savjai ([kezdes, kezdes + 30 perc) unioja). Egy D perces
// kezeles ott kezdodhet, ahol a savban meg D perc hatra van. (Egy honapra elore minden
// idotartamra napra-percre egyezett a Salonic sajat valaszaval.) Biztonsagbol a kivalasztott
// idopontot az adatlap elott meg a valodi kezelesre is lekerdezzuk.
//
// A kezelesek listaja a Salonic kezelo-oldalarol jon (/employees/<id>/), a szabad idok a
// nyilvanos naptar-API-bol (api.salonic.hu/calendar/getAvailableTimes) - mindketto engedi
// a mas domainrol valo lekerest. A foglalast a Salonic adatlapja rogziti (lasd foglalo.js).
(() => {
  'use strict';

  // A sajat kereteben nyiltunk meg (a Salonic visszairanyitott): nem rajzolunk, szolunk a szulonek.
  try {
    if (window.top !== window.self && window.parent.location.hostname === location.hostname) {
      document.documentElement.style.visibility = 'hidden';
      if (typeof window.parent.mhKeretbenOldal === 'function') window.parent.mhKeretbenOldal(location.href);
      return;
    }
  } catch (e) { /* idegen oldal kereteben */ }

  const SZALON = {
    nev: 'MOSAIC Sminktetoválás',
    cim: 'https://mosaic-pmu.salonic.hu',
    placeId: 14585,
    kezelo: 32428, // Melitta
    // a Salonic naptar-azonositoja (az idopontvalaszto oldalan van, de azt csak munkamenettel adja)
    naptar: '76a8541e-bb52-22ab-f8c0-531b86f55abb',
  };
  const API = 'https://api.salonic.hu/calendar/getAvailableTimes';
  const ZONA = 'Europe/Budapest';
  const ELORE_NAP = 92; // ennyi napot kerunk le egyszerre (a Salonic ennyit egy kerdesre is ad)
  const PERC = 60;

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
  const percSzoveg = (p) => (p >= 60 ? Math.floor(p / 60) + ' óra' + (p % 60 ? ' ' + (p % 60) + ' perc' : '') : p + ' perc');
  const fmt = (ts, o) => new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, ...o }).format(new Date(ts * 1000));
  const napKulcs = (ts) => fmt(ts, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\s/g, '');
  const ora = (ts) => fmt(ts, { hour: '2-digit', minute: '2-digit' });
  const ora24 = (ts) => +fmt(ts, { hour: 'numeric', hourCycle: 'h23' });
  const szoveg = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');

  function leker(url) {
    const ab = new AbortController();
    const ido = setTimeout(() => ab.abort(), 15000);
    return fetch(url, { credentials: 'omit', signal: ab.signal }).finally(() => clearTimeout(ido));
  }
  async function szabadKezdesek(szolgId, tol, napok) {
    const p = new URLSearchParams({
      startDate: tol, offset: 0, days: napok, placeId: SZALON.placeId, serviceId: szolgId, employeeId: -1,
      calendarId: SZALON.naptar, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0,
    });
    const j = await (await leker(API + '?' + p)).json();
    if (j.status !== 'success') throw new Error('API: ' + j.status);
    const most = Date.now() / 1000;
    const ki = new Set();
    for (const kezelok of Object.values(j.data.blocks || {})) {
      for (const k of Object.values(kezelok)) for (const s of Object.values(k.slots || {})) if (s.timestamp > most) ki.add(s.timestamp);
    }
    return [...ki].sort((a, b) => a - b);
  }

  const allapot = {
    kezelesek: [], alap: null, // a legrovidebb kezeles: ebbol szamoljuk a szabad savokat
    napok: new Map(), // napKulcs -> { elso: ts, savok: [[tol, ig], ...] }
    lepes: 900, // a kezdesek kozti lepes (mp), a Salonic 15 perce
    honap: null, nap: null, kezeles: null, idopont: null,
  };

  // --- lepesek -------------------------------------------------------------
  const LEPESEK = ['nap', 'kezeles', 'idopont', 'adatok'];
  function lepes(nev) {
    for (const l of LEPESEK) $(l).hidden = l !== nev;
    const i = LEPESEK.indexOf(nev);
    for (const li of $('lepesek').children) {
      const j = LEPESEK.indexOf(li.dataset.lepes);
      li.className = j === i ? 'aktiv' : j < i ? 'kesz' : '';
    }
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  $('lepesek').addEventListener('click', (e) => { const li = e.target.closest('li.kesz'); if (li) lepes(li.dataset.lepes); });
  for (const g of document.querySelectorAll('[data-vissza]')) g.addEventListener('click', () => lepes(g.dataset.vissza));

  function hibaUzenet(hova, e) {
    console.error(e);
    hova.replaceChildren(elem('div', { class: 'hiba', style: 'grid-column: 1 / -1' },
      'Most nem sikerült betölteni az adatokat. ',
      elem('a', { href: SZALON.cim + '/employees/' + SZALON.kezelo + '/?placeId=' + SZALON.placeId, szoveg: 'Foglalj itt' }), '.'));
  }

  // --- adatok: kezelesek + szabad savok --------------------------------------
  async function kezelesekBetolt() {
    const v = await leker(SZALON.cim + '/employees/' + SZALON.kezelo + '/?placeId=' + SZALON.placeId);
    const d = new DOMParser().parseFromString(await v.text(), 'text/html');
    const lista = [...d.querySelectorAll('input[data-id][data-duration]')].map((i) => {
      const teljes = (i.dataset.name || '').trim();
      // "Ajaktetovalas - Aquarell - 124.900 Ft helyett most" -> nev + eredeti ar
      const m = teljes.match(/^(.*?)\s*-\s*([\d. ]+)\s*Ft helyett most\s*$/i);
      const label = d.querySelector('label[for="' + i.id + '"]');
      return {
        id: i.dataset.id,
        nev: m ? m[1] : teljes,
        eredeti: m ? +m[2].replace(/\D/g, '') : 0,
        ar: +i.dataset.price || 0,
        perc: +i.dataset.duration || 0,
        leiras: label ? szoveg(label.querySelector('.service-description-booking-showServices, .service-description')) : '',
      };
    }).filter((k, i, t) => k.perc > 0 && t.findIndex((x) => x.id === k.id) === i);
    if (!lista.length) throw new Error('nincs kezeles');
    allapot.kezelesek = lista;
    allapot.alap = lista.reduce((a, b) => (b.perc < a.perc ? b : a));
  }

  async function savokBetolt() {
    const alap = allapot.alap;
    const kezdesek = await szabadKezdesek(alap.id, Math.floor(Date.now() / 1000) - 3 * 3600, ELORE_NAP);
    const kul = kezdesek.slice(1).map((t, i) => t - kezdesek[i]).filter((x) => x > 0);
    if (kul.length) allapot.lepes = Math.min(...kul);
    allapot.napok = new Map();
    for (const t of kezdesek) {
      const k = napKulcs(t);
      if (!allapot.napok.has(k)) allapot.napok.set(k, { elso: t, savok: [] });
      const savok = allapot.napok.get(k).savok;
      const veg = t + alap.perc * PERC;
      const utolso = savok[savok.length - 1];
      if (utolso && t <= utolso[1]) utolso[1] = Math.max(utolso[1], veg);
      else savok.push([t, veg]);
    }
  }

  // egy D perces kezeles lehetseges kezdesei egy napon (a szabad savokbol)
  function kezdesek(napAdat, perc) {
    const ki = [];
    for (const [tol, ig] of napAdat.savok) for (let t = tol; t + perc * PERC <= ig; t += allapot.lepes) ki.push(t);
    return ki;
  }
  const leghosszabb = (napAdat) => Math.max(0, ...napAdat.savok.map(([a, b]) => (b - a) / PERC));

  // --- 1. havi naptar -------------------------------------------------------
  const honapKulcs = (ts) => fmt(ts, { year: 'numeric', month: '2-digit' }).replace(/\s/g, '');
  function honapok() {
    const ma = Math.floor(Date.now() / 1000);
    const ki = [];
    for (let t = ma; t <= ma + ELORE_NAP * 86400; t += 86400) { const k = honapKulcs(t); if (!ki.includes(k)) ki.push(k); }
    return ki;
  }

  function rajzolNaptar() {
    const hk = honapok();
    if (!allapot.honap || !hk.includes(allapot.honap)) {
      const elsoSzabad = [...allapot.napok.values()][0];
      allapot.honap = elsoSzabad ? honapKulcs(elsoSzabad.elso) : hk[0];
    }
    const i = hk.indexOf(allapot.honap);
    $('elozo-honap').disabled = i <= 0;
    $('kovetkezo-honap').disabled = i >= hk.length - 1;
    // a honap napjai (delben szamolva, hogy az oraatallitas ne zavarjon)
    const [ev, ho] = allapot.honap.split('.').filter(Boolean).map(Number);
    const elso = Date.UTC(ev, ho - 1, 1, 10) / 1000;
    $('honap-cim').textContent = fmt(elso, { year: 'numeric', month: 'long' });
    const hetnap = (new Date(elso * 1000).getUTCDay() + 6) % 7; // hetfo = 0
    const napSzam = new Date(Date.UTC(ev, ho, 0)).getUTCDate();
    const mai = napKulcs(Date.now() / 1000);
    const cellak = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((n) => elem('div', { class: 'hetnap', szoveg: n }));
    for (let x = 0; x < hetnap; x++) cellak.push(elem('div', { class: 'nnap ures' }));
    for (let n = 1; n <= napSzam; n++) {
      const t = elso + (n - 1) * 86400;
      const k = napKulcs(t);
      const adat = allapot.napok.get(k);
      const hossz = adat ? leghosszabb(adat) : 0;
      const maxKezeles = Math.max(...allapot.kezelesek.map((x) => x.perc));
      const cimke = !adat ? (k < mai ? '' : 'Nincs szabad időpont')
        : 'Szabad: ' + adat.savok.map(([a, b]) => ora(a) + '–' + ora(b)).join(', ');
      cellak.push(elem('button', {
        type: 'button', class: 'nnap' + (adat ? (hossz >= maxKezeles ? ' sok' : ' keves') : ''),
        disabled: !adat, 'aria-pressed': String(k === allapot.nap), title: cimke, 'aria-label': fmt(t, { month: 'long', day: 'numeric' }) + '. ' + cimke,
        onclick: () => napValaszt(k),
      }, elem('b', { szoveg: String(n) }), elem('i')));
    }
    $('naptar').replaceChildren(...cellak);
  }
  $('elozo-honap').addEventListener('click', () => { const hk = honapok(); allapot.honap = hk[Math.max(0, hk.indexOf(allapot.honap) - 1)]; rajzolNaptar(); });
  $('kovetkezo-honap').addEventListener('click', () => { const hk = honapok(); allapot.honap = hk[Math.min(hk.length - 1, hk.indexOf(allapot.honap) + 1)]; rajzolNaptar(); });

  // --- 2. kezeles a valasztott napra ------------------------------------------
  function napValaszt(k) {
    allapot.nap = k;
    const adat = allapot.napok.get(k);
    $('kezeles-cim').textContent = fmt(adat.elso, { month: 'long', day: 'numeric', weekday: 'long' }) + ' – melyik kezelést kérnéd?';
    $('napi-sav').textContent = 'Szabad időszak ezen a napon: ' + adat.savok.map(([a, b]) => ora(a) + '–' + ora(b)).join(', ');
    const sorrend = [...allapot.kezelesek].sort((a, b) => (kezdesek(adat, b.perc).length > 0) - (kezdesek(adat, a.perc).length > 0));
    $('kezelesek').replaceChildren(...sorrend.map((s) => {
      const db = kezdesek(adat, s.perc).length;
      const arSzoveg = s.ar ? ft(s.ar) : /ingyenes/i.test(s.nev) ? 'Ingyenes' : 'Egyedi ár';
      return elem('button', { type: 'button', class: 'kartya', disabled: !db, onclick: () => kezelesValaszt(s) },
        elem('span'),
        elem('span', {},
          elem('span', { class: 'nev', szoveg: s.nev }),
          elem('span', { class: 'info', szoveg: percSzoveg(s.perc) + (s.leiras ? ' · ' + s.leiras : '') }),
          elem('span', { class: 'cimke', szoveg: db ? db + ' kezdési időpont' : 'Ezen a napon nem fér bele' })),
        elem('span', { class: 'ar' }, s.eredeti ? elem('span', { class: 'athuzott', szoveg: ft(s.eredeti) }) : null, arSzoveg));
    }));
    rajzolNaptar();
    lepes('kezeles');
  }

  // --- 3. kezdesi idopont -----------------------------------------------------
  function kezelesValaszt(s) {
    allapot.kezeles = s;
    allapot.idopont = null;
    const adat = allapot.napok.get(allapot.nap);
    $('idopont-cim').textContent = s.nev + ' (' + percSzoveg(s.perc) + ') – mikor kezdjük?';
    const lista = kezdesek(adat, s.perc);
    const reszek = [['Délelőtt', (h) => h < 12], ['Délután', (h) => h >= 12 && h < 17], ['Este', (h) => h >= 17]];
    $('idok').replaceChildren(...reszek.flatMap(([cim, felt]) => {
      const r = lista.filter((ts) => felt(ora24(ts)));
      if (!r.length) return [];
      return [elem('div', { class: 'napresz', szoveg: cim }), elem('div', { class: 'idok' }, ...r.map((ts) =>
        elem('button', { type: 'button', class: 'ido', szoveg: ora(ts), title: ora(ts) + '–' + ora(ts + s.perc * PERC), onclick: (e) => idopontValaszt(ts, e.currentTarget) })))];
    }));
    lepes('idopont');
  }

  // --- 4. ellenorzes es a Salonic adatlapja ------------------------------------
  async function idopontValaszt(ts, gomb) {
    const s = allapot.kezeles;
    for (const g of document.querySelectorAll('#idok .ido')) g.setAttribute('aria-pressed', String(g === gomb));
    gomb.disabled = true;
    try {
      // a valodi kezelesre is megkerdezzuk a Salonicot (pl. ha kesobb kulon szabaly lenne ra)
      const valodi = await szabadKezdesek(s.id, allapot.napok.get(allapot.nap).elso - 3 * 3600, 1);
      if (!valodi.includes(ts)) {
        gomb.disabled = false;
        $('idok').prepend(elem('div', { class: 'hiba', szoveg: 'Ez az időpont erre a kezelésre már nem foglalható – kérlek, válassz másikat.' }));
        gomb.remove();
        return;
      }
    } catch (e) { /* ha az ellenorzes nem sikerul, a Salonic adatlapja ugyis ellenoriz */ }
    gomb.disabled = false;
    allapot.idopont = ts;
    const sorok = [
      ['Kezelés', s.nev],
      ['Időtartam', percSzoveg(s.perc)],
      ['Ár', s.ar ? ft(s.ar) : /ingyenes/i.test(s.nev) ? 'Ingyenes' : 'Egyedi ár'],
      ['Időpont', fmt(ts, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) + ' ' + ora(ts) + '–' + ora(ts + s.perc * PERC)],
      ['Kezelő', 'Melitta'],
      ['Helyszín', '1023 Budapest, Bécsi út 4.'],
    ];
    $('osszegzes-adatok').replaceChildren(...sorok.flatMap(([k, v]) => [elem('dt', { szoveg: k }), elem('dd', { szoveg: v })]));
    const url = SZALON.cim + '/guestData/?' + new URLSearchParams({ placeId: SZALON.placeId, serviceId: s.id, employeeId: -1, startDate: ts });
    $('veglegesit').href = url;
    const keret = $('salonic');
    $('salonic-betolt').hidden = false;
    keret.style.visibility = 'hidden';
    keret.onload = () => { $('salonic-betolt').hidden = true; keret.style.visibility = ''; };
    keret.src = url;
    lepes('adatok');
  }

  // A keretben a mi egyik oldalunk toltodott be (suti.js / ez a fajl jelzi): koszonooldal ->
  // teljes ablakban nyitjuk meg (a meres ott fut); fooldal vagy ez az oldal -> az idopont
  // kozben elkelt (a Salonic "vissza" iranyitott), friss adatokkal vissza a naptarhoz.
  window.mhKeretbenOldal = (href) => {
    const ut = new URL(href).pathname.replace(/\/+$/, '');
    if (ut !== '' && ut !== '/foglalo-pmu') { location.assign(href); return; }
    $('salonic').removeAttribute('src');
    savokBetolt().then(() => {
      if (allapot.napok.has(allapot.nap)) napValaszt(allapot.nap); else { rajzolNaptar(); lepes('nap'); }
      $(allapot.napok.has(allapot.nap) ? 'kezelesek' : 'naptar').before(elem('div', { class: 'hiba', szoveg: 'A választott időpontot közben lefoglalták – kérlek, válassz másikat.' }));
    }).catch((e) => hibaUzenet($('naptar'), e));
  };

  (async () => {
    try {
      await kezelesekBetolt();
      await savokBetolt();
      rajzolNaptar();
    } catch (e) { hibaUzenet($('naptar'), e); }
  })();
})();
