// MOSAIC lezeres szortelenites landing (/lezeres-szortelenites-budapest) - mukodes.
//
//  1. Idopont-valaszto (#foglalas): havi naptar + a kivalasztott nap idopontjai a Salonic nyilvanos naptar-API-bol (ugyanaz a forras, mint a
//     PMU landingen). Idopontot nem talalunk ki: ha az API nem valaszol, a Salonic-linkre vezetunk. Egy idopontra kattintva a Salonic
//     /guestData/ adatlapja nyilik (az idopont mar kivalasztva).
//  2. Kalkulator (#szamolo): a legdragabb terulet teljes aron, minden tovabbi terulet 50%-on (akkor is, ha nagy terulet). Alapbol nehany
//     terulet ki van jelolve, hogy lassa, hogy kalkulator; az elso kezeles 20% kedvezmennyel.
//  3. Arforras: az #arlista tablazat sorai (data-ar, data-elso, data-tartalmaz) - a kalkulator es a valaszto ebbol olvas,
//     igy az arakat egy helyen kell karbantartani.
//  4. Apro segedek: data-terulet (a valasztot az adott teruletre allitja), data-gyik (kinyitja a GYIK-elemet), Google terkep, ertekelesek szama,
//     Zsofi videoja (kattintasra toltodik be) es kepgaleriaja, az eredeti Trustindex-embed (a sutik elfogadasa utan).
(() => {
  'use strict';

  const SZALON = {
    cim: 'https://mosaic-elysion.salonic.hu',
    placeId: 14586,
    kezelo: 32417, // Elysion Pro Szortelenites (egyetlen kezelo)
    naptar: '02742cf7-07cb-a3ef-fc7c-b871c86ce163', // a Salonic naptar-azonositoja; ha valtozik, a kod a Salonic oldalarol ujra kiolvassa
  };
  const API = 'https://api.salonic.hu/calendar/getAvailableTimes';
  const ZONA = 'Europe/Budapest';
  const ELORE_NAP = 92;
  const KONZULT = { nev: 'Ingyenes konzultáció', elso: '476477' };
  const EGYEDI = { kulcs: 'egyedi', nev: 'Több terület (egyedi csomag)', elso: '476478' };
  const ALAP_VALASZTAS = ['lab', 'honalj', 'intim']; // a kalkulator indito allapota
  const ELSO_KEDVEZMENY = 0.8; // az elso kezeles 20% kedvezmennyel

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
  // 12 000 Ft (nem torheto szokozzel; az Intl a 4 jegyu szamokat nem tagolna: 9 500 -> "9500")
  const szam = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const ft = (n) => szam(n) + ' Ft';
  const fmt = (ts, o) => new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, ...o }).format(new Date(ts * 1000));
  const ora = (ts) => fmt(ts, { hour: '2-digit', minute: '2-digit' });
  const isoNap = (ts) => new Intl.DateTimeFormat('sv-SE', { timeZone: ZONA }).format(new Date(ts * 1000)); // 2026-10-07
  const SVG_NYIL = (irany) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${irany < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}"/></svg>`;

  // --- arforras: az arlista tablazat ------------------------------------------------------------------------------------------
  const SOROK = [...document.querySelectorAll('#arlista tr[data-kulcs]')].map((tr) => ({
    kulcs: tr.dataset.kulcs,
    nev: tr.dataset.nev,
    ar: +tr.dataset.ar,
    elso: tr.dataset.elso,
    tartalmaz: (tr.dataset.tartalmaz || '').split(',').filter(Boolean),
    csomag: !!tr.dataset.csomag,
    csoport: tr.closest('.ar-csoport').querySelector('.csoport-nev').textContent.trim(),
    csoportIkon: tr.closest('.ar-csoport').querySelector('.csoport-ikon').innerHTML, // az ikonok egyetlen forrasa az arlista (a motor testresz-ikonjai)
  }));
  const AR = Object.fromEntries(SOROK.map((s) => [s.kulcs, s]));
  const SZOLGALTATAS = { ...AR, [EGYEDI.kulcs]: { ...EGYEDI, ar: 0, tartalmaz: [] } };

  // --- 2. kalkulator -------------------------------------------------------------------------------------------------------------
  /** A kivalasztott teruletek ara: a legdragabb teljes aron, a tobbi 50%-on. Az azonos arunal a tablazat sorrendje dont. */
  function szamol(kulcsok) {
    const sorok = SOROK.filter((s) => !s.csomag && kulcsok.has(s.kulcs)).sort((a, b) => b.ar - a.ar);
    const tetelek = sorok.map((s, i) => ({ ...s, fizet: i === 0 ? s.ar : s.ar / 2, teljes: i === 0 }));
    const lista = tetelek.reduce((o, t) => o + t.ar, 0);
    const alkalom = tetelek.reduce((o, t) => o + t.fizet, 0);
    return { tetelek, lista, alkalom, kedvezmeny: lista - alkalom, program: alkalom * 6, ajandek: alkalom * 2, elso: alkalom * ELSO_KEDVEZMENY };
  }
  // a kalkulatorban nem szerepelnek a kesz csomagok (azok sajat, fix aru sorok), csak az egyes teruletek
  const SZAMOLO_CSOPORTOK = [...new Set(SOROK.filter((s) => !s.csomag).map((s) => s.csoport))];
  const valasztott = new Set(ALAP_VALASZTAS.filter((k) => AR[k]));
  const CALC_IKON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5"/></svg>';

  const szuloje = (kulcs) => SOROK.find((s) => s.tartalmaz.includes(kulcs) && valasztott.has(s.kulcs));
  function szamoloValaszt(kulcs) {
    if (valasztott.has(kulcs)) valasztott.delete(kulcs);
    else {
      valasztott.add(kulcs);
      for (const gy of AR[kulcs].tartalmaz) valasztott.delete(gy); // a szulo mar tartalmazza: ne szamoljunk ketszer
    }
    szamoloRajzol();
  }
  function szamoloRajzol() {
    const hova = $('szamolo-valaszto');
    const e = szamol(valasztott);
    hova.replaceChildren(
      elem('h3', { class: 'szamolo-cim', html: `<span class="szamolo-ikon">${CALC_IKON}</span>Árkalkulátor` }),
      ...SZAMOLO_CSOPORTOK.map((cs) => elem('div', { class: 'sz-csoport' },
        elem('div', { class: 'sz-csoport-nev', html: `${SOROK.find((s) => s.csoport === cs).csoportIkon}<span>${cs}</span>` }),
        elem('div', { class: 'sz-chipek' }, ...SOROK.filter((s) => !s.csomag && s.csoport === cs).map((s) => {
          const szulo = szuloje(s.kulcs);
          return elem('button', {
            type: 'button', class: 'sz-chip', 'data-kulcs': s.kulcs, 'aria-pressed': String(valasztott.has(s.kulcs)), disabled: !!szulo,
            title: szulo ? `Benne van a(z) ${szulo.nev} árában` : false,
            html: `<span>${s.nev.replace(/ \(.*/, '')}</span> <small>${ft(s.ar)}</small>`,
          });
        })))),
      // telefonon a gombok alatt van az eredmeny: egy ragados osszegsav mutatja az aktualis arat (tapra az eredmenyhez ugrik)
      elem('a', { class: 'sz-sav', href: '#szamolo-eredmeny-cim', hidden: !e.tetelek.length, html: `<span>Alkalmanként <b>${ft(e.alkalom)}</b></span><span>Részletek ↓</span>` }));
    const tartalom = $('szamolo-tartalom');
    if (!e.tetelek.length) {
      tartalom.innerHTML = '<p class="szamolo-ures">Válassz legalább egy területet.<br><span class="halk">Például teljes láb + hónalj: 59&nbsp;000 + 9&nbsp;500 = 68&nbsp;500 Ft alkalmanként.</span></p>';
      return;
    }
    const egy = e.tetelek.length === 1;
    tartalom.replaceChildren(...[
      elem('ul', { class: 'sz-sorok' }, ...e.tetelek.map((t) => elem('li', { class: t.teljes ? 'teljes' : '' },
        elem('span', { html: `<span>${t.nev}<small>${t.teljes ? (egy ? 'teljes ár' : 'a legdrágább: teljes ár') : `50% kedvezmény · ${ft(t.ar)} helyett`}</small></span>` }),
        elem('span', { class: 'osszeg', szoveg: ft(t.fizet) })))),
      // tobb teruletnel az eredeti (kulon-kulon vett) ar athuzva, pirossal: lassa, mekkora a kedvezmeny; egy teruletnel nincs mit athuzni
      elem('div', { class: 'sz-ossz' }, elem('span', { szoveg: 'Alkalmanként' }), elem('div', { class: 'sz-ar' }, e.kedvezmeny ? elem('s', { class: 'regi-ar', szoveg: ft(e.lista) }) : null, elem('b', { szoveg: ft(e.alkalom) }))),
      e.kedvezmeny ? elem('div', { class: 'sz-kedv', html: `<span>Csomagkedvezmény alkalmanként</span><span>−${ft(e.kedvezmeny)}</span>` }) : null,
      elem('div', { class: 'sz-elso', html: `<span>Az első kezelés 20% kedvezménnyel</span><b>${ft(e.elso)}</b>` }),
      elem('div', { class: 'sz-program', html: `<div class="sz-sor"><span>8 alkalmas program: csak 6 alkalmat fizetsz</span><b>${ft(e.program)}</b></div><small>A 4. és a 8. alkalom ajándék (${ft(e.ajandek)} értékben).</small>` }),
      elem('div', { class: 'sz-cta' },
        elem('a', { class: 'gomb gomb-arany gomb-szeles', href: '#foglalas', 'data-terulet': egy ? e.tetelek[0].kulcs : EGYEDI.kulcs, html: `${egy ? 'Időpontot foglalok' : 'Egyedi csomagot foglalok'} <span class="nyil">→</span>` }),
        // telefonon rovidebb valtozat, hogy elferjen egy sorban
        elem('p', { class: 'sz-lab', html: '<span class="hosszu">Az ár a program végéig fix. 8 alkalomból csak 6-ot fizetsz, 2 alkalom ajándék.</span><span class="rovid">Az ár fix, 8 alkalomból csak 6-ot fizetsz, 2 ajándék.</span>' }))].filter(Boolean));
  }
  $('szamolo-valaszto').addEventListener('click', (e) => {
    const b = e.target.closest('.sz-chip');
    if (!b || b.disabled) return;
    szamoloValaszt(b.dataset.kulcs);
    const uj = e.currentTarget.querySelector(`.sz-chip[data-kulcs="${b.dataset.kulcs}"]`);
    if (uj) uj.focus({ preventScroll: true }); // az ujrarajzolas ne dobja el a billentyuzet-fokuszt
  });
  szamoloRajzol();

  // --- 1. idopont-valaszto (naptar) ------------------------------------------------------------------------------------------------
  const allapot = { mod: 'kezeles', terulet: 'honalj', napok: new Map(), nap: null, honap: null };

  const szolgaltatasId = () => (allapot.mod === 'konzult' ? KONZULT.elso : (SZOLGALTATAS[allapot.terulet] || {}).elso);
  // Ha az API nem valaszol / nincs szabad nap: a helyben nyilo foglalo-motor (NEM kozvetlen Salonic-link: a Salonic sajat sikeroldalan vegzodo foglalas a meresben nem latszik)
  const motorUrl = () => (allapot.mod === 'konzult' ? '/foglalo-motor?business=laser&service=konzult' : '/foglalo-motor?business=laser&intent=first');
  // a kivalasztott idopont adatlapja: az idopont mar benne van (ugyanezt a cimet nyitja a foglalo-motor is)
  const adatlapUrl = (id, ts) => `${SZALON.cim}/guestData/?anyone=true&employeeId=${SZALON.kezelo}&placeId=${SZALON.placeId}&serviceId=${id}&startDate=${ts}&back=`;

  function leker(url, o = {}) {
    const ab = new AbortController();
    const ido = setTimeout(() => ab.abort(), 15000);
    return fetch(url, { credentials: 'omit', signal: ab.signal, ...o }).finally(() => clearTimeout(ido));
  }
  async function apiKezdesek(id, naptar) {
    const p = new URLSearchParams({
      startDate: Math.floor(Date.now() / 1000) - 3 * 3600, offset: 0, days: ELORE_NAP, placeId: SZALON.placeId, serviceId: id,
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
  const cache = {};
  function szabadKezdesek(id) {
    if (!cache[id]) {
      cache[id] = (async () => {
        try { return await apiKezdesek(id, SZALON.naptar); } catch (hiba) {
          // a naptar-azonosito megvaltozhatott: kiolvassuk a Salonic oldalarol, es egyszer ujraprobaljuk
          const m = (await (await leker(`${SZALON.cim}/selectDate/?employeeId=-1&placeId=${SZALON.placeId}&serviceId=${id}`)).text()).match(/calendarId:\s*'([^']+)'/);
          if (!m || m[1] === SZALON.naptar) throw hiba;
          SZALON.naptar = m[1];
          return apiKezdesek(id, m[1]);
        }
      })();
      cache[id].catch(() => { delete cache[id]; });
    }
    return cache[id];
  }

  const ketjegy = (n) => String(n).padStart(2, '0');
  function idokRajzol() {
    const hova = $('idok');
    const lista = allapot.napok.get(allapot.nap) || [];
    if (!lista.length) { hova.replaceChildren(); return; }
    const id = szolgaltatasId();
    hova.replaceChildren(
      elem('p', { class: 'idok-cim', szoveg: fmt(lista[0], { month: 'long', day: 'numeric', weekday: 'long' }) }),
      elem('div', { class: 'ido-racs' }, ...lista.map((ts) => elem('a', {
        class: 'ido', href: adatlapUrl(id, ts), 'aria-label': `${fmt(ts, { month: 'long', day: 'numeric' })} ${ora(ts)}`, szoveg: ora(ts),
      }))));
  }
  function napValaszt(iso) { allapot.nap = iso; naptarRajzol(); }
  function honapLep(irany) {
    const [y, mo] = allapot.honap;
    const d = new Date(Date.UTC(y, mo + irany, 1));
    allapot.honap = [d.getUTCFullYear(), d.getUTCMonth()];
    naptarRajzol();
  }
  function naptarRajzol() {
    const [y, mo] = allapot.honap;
    const kulcsok = [...allapot.napok.keys()];
    const ho = `${y}-${ketjegy(mo + 1)}`;
    const cim = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, mo, 15)));
    const lapoz = (irany, tiltva) => elem('button', {
      type: 'button', class: 'naptar-lapoz', 'aria-label': irany < 0 ? 'Előző hónap' : 'Következő hónap', disabled: tiltva, html: SVG_NYIL(irany), onclick: () => honapLep(irany),
    });
    const eltolas = (new Date(Date.UTC(y, mo, 1)).getUTCDay() + 6) % 7; // hetfo az elso oszlop
    const hossz = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const cellak = [];
    for (const nap of ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']) cellak.push(elem('span', { class: 'naptar-hetnap', szoveg: nap }));
    for (let i = 0; i < eltolas; i++) cellak.push(elem('span'));
    for (let d = 1; d <= hossz; d++) {
      const iso = `${ho}-${ketjegy(d)}`;
      if (allapot.napok.has(iso)) {
        cellak.push(elem('button', {
          type: 'button', class: 'naptar-nap', 'aria-pressed': String(iso === allapot.nap), 'aria-label': `${d}. ${cim.split(' ')[1] || ''}: szabad időpontok`, szoveg: String(d), onclick: () => napValaszt(iso),
        }));
      } else cellak.push(elem('span', { class: 'naptar-nap', szoveg: String(d) }));
    }
    $('naptar').replaceChildren(
      elem('div', { class: 'naptar-fej' }, lapoz(-1, ho <= kulcsok[0].slice(0, 7)), elem('b', { szoveg: cim }), lapoz(1, ho >= kulcsok[kulcsok.length - 1].slice(0, 7))),
      elem('div', { class: 'naptar-racs' }, ...cellak));
    idokRajzol();
  }

  let kerNo = 0;
  async function idopontokBetolt() {
    const uzenet = $('slot-uzenet');
    const id = szolgaltatasId();
    const en = ++kerNo;
    allapot.napok = new Map();
    allapot.nap = null;
    uzenet.hidden = true;
    $('idok').replaceChildren();
    $('naptar').replaceChildren(elem('div', { class: 'naptar-csontvaz csontvaz' }));
    if (!id) return;
    try {
      const k = await szabadKezdesek(id);
      if (en !== kerNo) return; // kozben masik teruletet valasztott
      const napok = new Map();
      for (const ts of k) { const d = isoNap(ts); if (!napok.has(d)) napok.set(d, []); napok.get(d).push(ts); }
      allapot.napok = napok;
      if (!napok.size) {
        $('naptar').replaceChildren();
        uzenet.replaceChildren('A következő hetekre most nincs szabad időpont. ', elem('a', { href: motorUrl(), szoveg: 'Nézd meg a foglalóban →' }));
        uzenet.hidden = false;
        return;
      }
      const elso = [...napok.keys()][0];
      allapot.nap = elso; // az elso szabad nap alapbol ki van jelolve, hogy az idopontok rogton latszanak
      allapot.honap = [+elso.slice(0, 4), +elso.slice(5, 7) - 1];
      naptarRajzol();
    } catch (hiba) {
      if (en !== kerNo) return;
      console.error(hiba);
      $('naptar').replaceChildren();
      uzenet.replaceChildren('Most nem sikerült lekérni a szabad időpontokat. ', elem('a', { href: motorUrl(), szoveg: 'Nézd meg itt az összeset →' }));
      uzenet.hidden = false;
    }
  }

  function valasztoRajzol() {
    const konzult = allapot.mod === 'konzult';
    $('lepes-terulet').hidden = konzult;
    $('lepes-idopont').querySelector('.szam').textContent = konzult ? '2' : '3';
    for (const r of document.querySelectorAll('input[name="mod"]')) r.checked = r.value === allapot.mod;
    $('terulet-select').value = allapot.terulet;
  }
  function beallit(mod, terulet) {
    if (terulet && !SZOLGALTATAS[terulet]) return;
    const regi = [allapot.mod, allapot.terulet].join();
    allapot.mod = mod || allapot.mod;
    if (terulet) allapot.terulet = terulet;
    valasztoRajzol();
    if ([allapot.mod, allapot.terulet].join() !== regi) idopontokBetolt();
  }

  $('terulet-select').addEventListener('change', (e) => { if (e.target.value) beallit('kezeles', e.target.value); });
  for (const r of document.querySelectorAll('input[name="mod"]')) r.addEventListener('change', () => beallit(r.value));

  // a tobbi szekcio gombjai: a valasztot az adott teruletre allitjuk, es oda gorgetunk
  document.addEventListener('click', (e) => {
    const g = e.target.closest('a[data-terulet]');
    if (g) {
      if (!SZOLGALTATAS[g.dataset.terulet]) return;
      e.preventDefault();
      beallit('kezeles', g.dataset.terulet);
      $('foglalo').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const q = e.target.closest('a[data-gyik]');
    if (q) {
      const d = $('gyik-' + q.dataset.gyik);
      if (!d) return;
      e.preventDefault();
      d.open = true;
      d.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // az idopontokat csak akkor kerjuk le, amikor a foglalo kozel kerul a kepernyohoz (felesleges API-hivas nelkul)
  valasztoRajzol();
  const foglalo = $('foglalo');
  if ('IntersectionObserver' in window) {
    const fig = new IntersectionObserver((t) => { if (t.some((x) => x.isIntersecting)) { fig.disconnect(); idopontokBetolt(); } }, { rootMargin: '600px 0px' });
    fig.observe(foglalo);
  } else idopontokBetolt();

  // --- videok (Zsofi konzultacios videoja, szorbenoves-video): kattintasra toltodnek be (a poszter latszik addig; a fajl csak ekkor), lejatszhatok, vezerlokkel -----
  for (const zv of document.querySelectorAll('.video-kartya[data-video]')) {
    zv.addEventListener('click', () => {
      const poszter = zv.querySelector('img');
      const v = elem('video', { controls: true, autoplay: true, playsinline: true, preload: 'auto', poster: poszter ? poszter.getAttribute('src') : false, 'aria-label': zv.dataset.cim || 'Videó' });
      v.append(elem('source', { src: zv.dataset.video, type: 'video/mp4' }));
      const hely = elem('div', { class: 'video-kartya' }, v);
      zv.replaceWith(hely);
      v.play().catch(() => { /* a vezerlokkel inditja */ });
    }, { once: true });
  }

  // --- a kalkulatorra mutato linkek ([data-szamolo]): JS-gorgetes, NEM #hash (a GTM "History Change" esemenyt ne indítsa) ---
  // (és a [data-gorgetes="<id>"] linkek is: pl. "Mutasd az eredményeket" -> #eredmenyek, szintén hash nélkül)
  document.addEventListener('click', (e) => {
    const l = e.target.closest('[data-szamolo], [data-gorgetes]');
    if (!l) return;
    e.preventDefault();
    const c = $(l.hasAttribute('data-szamolo') ? 'szamolo' : l.getAttribute('data-gorgetes'));
    if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // --- Zsofi kepgaleria: kattintasra nagyban (lapozhato, Esc / hatterre kattintas bezarja) ------------------------------------------------
  const gKepek = [...document.querySelectorAll('.galeria-kep')];
  if (gKepek.length) {
    const nagyito = elem('dialog', { class: 'nagyito', 'aria-label': 'Nagyított kép' });
    const nagyKep = elem('img', { alt: '' });
    let idx = 0;
    const mutat = (i) => { idx = (i + gKepek.length) % gKepek.length; const im = gKepek[idx].querySelector('img'); nagyKep.src = gKepek[idx].dataset.nagy || im.src; nagyKep.alt = im.alt; };
    nagyito.append(nagyKep,
      elem('button', { type: 'button', class: 'zar', 'aria-label': 'Bezárás', szoveg: '×', onclick: () => nagyito.close() }),
      elem('button', { type: 'button', class: 'elozo', 'aria-label': 'Előző kép', szoveg: '‹', onclick: () => mutat(idx - 1) }),
      elem('button', { type: 'button', class: 'kov', 'aria-label': 'Következő kép', szoveg: '›', onclick: () => mutat(idx + 1) }));
    nagyito.addEventListener('click', (e) => { if (e.target === nagyito) nagyito.close(); });
    nagyito.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') mutat(idx - 1); if (e.key === 'ArrowRight') mutat(idx + 1); });
    document.body.append(nagyito);
    gKepek.forEach((g, i) => g.addEventListener('click', () => { mutat(i); nagyito.showModal(); }));
  }

  // --- Vendegertekelesek: az eredeti Trustindex-embed (ugyanaz, mint a fooldalon es az ajandekkartya oldalon), iframe-ben --------------------
  // Harmadik fel: a "funkcionalis" sutik elfogadasa utan (vagy a gombra kattintva) toltodik be; addig helykitolto + gomb all a helyen.
  // Az iframe azonos eredetu: a magassagat a widget tartalmahoz igazitjuk.
  const tiDoboz = $('trustindex');
  let tiBetoltve = false;
  function trustindexBetolt() {
    if (!tiDoboz || tiBetoltve) return;
    tiBetoltve = true;
    const f = elem('iframe', { class: 'ti-keret', src: tiDoboz.dataset.embed, title: 'Google-vélemények (Trustindex)', loading: 'eager', scrolling: 'no' });  // nem lazy: a hozzajarulas utan azonnal toltodjon, ne csak gorgetesre
    let proba = 0, legnagyobb = 0;
    const meret = (nullaz) => {
      try {
        const d = f.contentDocument;
        const w = d && d.querySelector('.ti-widget');
        if (!w) return false;
        if (!d.getElementById('lezer-ti-stilus')) {
          const st = d.createElement('style');
          st.id = 'lezer-ti-stilus';
          st.textContent = '@font-face{font-family:"Jost";font-style:normal;font-weight:400 600;font-display:swap;src:url(/assets/fonts/jost-400-latin.woff2) format("woff2")}'
            + 'html body .ti-widget,html body .ti-widget *{font-family:"Jost","Helvetica Neue",Arial,sans-serif!important}'
            + 'html,body{overflow:hidden!important}'
            + 'html body div.ti-controls-line,html body .ti-widget .ti-controls-line{display:none!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;visibility:hidden!important}';
          d.head.appendChild(st);
        }
        const m = Math.ceil(w.getBoundingClientRect().bottom + (parseFloat(d.defaultView.getComputedStyle(d.body).marginBottom) || 0) + 16);
        if (m > 60 && (nullaz || m > legnagyobb)) { legnagyobb = m; f.style.height = m + 'px'; } // csak nonek: a lapozo kartyai kozott ne ugraljon az oldal, de a hosszabb kartya se vagodjon le
        return true;
      } catch (hiba) { return true; }
    };
    const ido = setInterval(() => { proba++; meret(); if (proba > 3600 || !f.isConnected) clearInterval(ido); }, 700);
    addEventListener('resize', () => meret(true));
    tiDoboz.replaceChildren(f);
  }
  if (tiDoboz) {
    $('ti-gomb').addEventListener('click', () => { if (window.mhSuti && window.mhSuti.enged) window.mhSuti.enged('fun'); trustindexBetolt(); });
    if (window.mhSuti) {
      if (window.mhSuti.engedely('fun')) trustindexBetolt();
      window.mhSuti.figyel((d) => { if (d.fun) trustindexBetolt(); });
    }
  }

  // --- mobil sticky CTA (csak telefonon latszik, lasd a CSS-t): nem rogton jon be: csak az elso, 4 kepes szekcio (Mennyibe kerul?) elgorgetese utan
  //     (a tulajdonos kerese: 3-4 kep utan); a foglalo szekciotol (es utana) eltunik. Gorgetes-figyelo (nem IntersectionObserver): az gyors ugrasnal,
  //     amikor a szekcio soha nem kerul a kepernyore (pl. horgonylink, gyors lendites), nem jelezne.
  const sticky = $('sticky-cta'), kepesSzekcio = $('mennyibe'), foglSzekcio = $('foglalas');
  if (sticky && kepesSzekcio && foglSzekcio) {
    let ido = 0;
    const frissit = () => {
      ido = 0;
      const tulVan = kepesSzekcio.getBoundingClientRect().bottom <= 0;   // az elso, 4 kepes szekcio mar elgorgetve
      const vegen = foglSzekcio.getBoundingClientRect().top < innerHeight; // a foglalo kepernyon van, vagy mar elhagytuk: ott maga a foglalo a cel
      const lat = tulVan && !vegen;
      sticky.classList.toggle('lathato', lat);
      sticky.setAttribute('aria-hidden', lat ? 'false' : 'true');
      sticky.querySelectorAll('a').forEach((a) => (lat ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
      document.body.classList.toggle('sticky-be', lat);
    };
    const kesleltet = () => { if (!ido) ido = requestAnimationFrame(frissit); };
    addEventListener('scroll', kesleltet, { passive: true });
    addEventListener('resize', kesleltet);
    frissit();
  }

  // --- Google terkep: a funkcionalis sutik engedelyezese utan magatol, egyebkent a gombra kattintva toltodik be ----------------------
  function terkepBetolt() {
    const t = $('terkep');
    if (!t || t.querySelector('iframe')) return;
    t.prepend(elem('iframe', {
      title: 'Térkép: MOSAIC, 1023 Budapest, Bécsi út 2.', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: 'https://www.google.com/maps?q=' + encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed',
    }));
    const h = $('terkep-hely');
    if (h) h.remove();
  }
  $('terkep-gomb').addEventListener('click', terkepBetolt);
  if (window.mhSuti) { if (window.mhSuti.engedely('fun')) terkepBetolt(); window.mhSuti.figyel((d) => { if (d.fun) terkepBetolt(); }); }

  // --- ertekelesek szama: a Trustindex-widget aktualis adata (a sutik "funkcionalis" csoportja); a HTML-ben a tartalek ertek all -------
  const TI = 'https://cdn.trustindex.io/widgets/8a/8a7562c424f027774456be130a1/content.html';
  let tiKesz = false;
  async function ertekelesFrissit() {
    if (tiKesz || !(window.mhSuti && window.mhSuti.engedely('fun'))) return;
    tiKesz = true;
    try {
      const d = new DOMParser().parseFromString(await (await fetch(TI, { credentials: 'omit' })).text(), 'text/html');
      const a = d.querySelector('.ti-header .ti-rating-text a');
      const n = ((a && a.textContent.match(/\d[\d\s.]*/)) || [''])[0].replace(/\D/g, '');
      if (!n) return;
      for (const e of document.querySelectorAll('[data-ertekeles-db]')) e.textContent = szam(+n);
      for (const l of document.querySelectorAll('.google-nagy[aria-label]')) l.setAttribute('aria-label', l.getAttribute('aria-label').replace(/\d+ Google-vélemény/, `${n} Google-vélemény`));
    } catch (hiba) { tiKesz = false; console.error(hiba); }
  }
  ertekelesFrissit();
  if (window.mhSuti && window.mhSuti.figyel) window.mhSuti.figyel(ertekelesFrissit);
})();
