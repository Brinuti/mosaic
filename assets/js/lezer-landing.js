// MOSAIC lezeres szortelenites landing (/lezeres-szortelenites-budapest) - mukodes.
//
//  1. Idopont-valaszto (#foglalas): a legkozelebbi szabad idopontok elo lekerdezese a Salonic nyilvanos naptar-API-bol
//     (ugyanaz a forras, mint a PMU landingen). Idopontot nem talalunk ki: ha az API nem valaszol, a Salonic-linkre vezetunk.
//  2. Kalkulator (#szamolo): a legdragabb terulet teljes aron, minden tovabbi terulet 50%-on (akkor is, ha nagy terulet).
//  3. Arforras: az #arlista tablazat sorai (data-ar, data-elso, data-tartalmaz) - a kalkulator es a valaszto ebbol olvas,
//     igy az arakat egy helyen kell karbantartani.
//  4. Apro segedek: data-terulet (a valasztot az adott teruletre allitja), data-gyik (kinyitja a GYIK-elemet), terkep.
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
  const datum = (ts) => fmt(ts, { month: 'short', day: 'numeric' }); // "okt. 6."
  const napKulcs = (ts) => fmt(ts, { year: 'numeric', month: '2-digit', day: '2-digit' });

  // --- arforras: az arlista tablazat ------------------------------------------------------------------------------------------
  const SOROK = [...document.querySelectorAll('#arlista tr[data-kulcs]')].map((tr) => ({
    kulcs: tr.dataset.kulcs,
    nev: tr.dataset.nev,
    ar: +tr.dataset.ar,
    elso: tr.dataset.elso,
    tartalmaz: (tr.dataset.tartalmaz || '').split(',').filter(Boolean),
    csomag: !!tr.dataset.csomag,
    csoport: tr.closest('.ar-csoport').querySelector('h3').childNodes[0].textContent.trim(),
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
    return { tetelek, lista, alkalom, kedvezmeny: lista - alkalom, program: alkalom * 6, ajandek: alkalom * 2 };
  }
  // a kalkulatorban nem szerepelnek a kesz csomagok (azok sajat, fix aru sorok), csak az egyes teruletek
  const SZAMOLO_CSOPORTOK = [...new Set(SOROK.filter((s) => !s.csomag).map((s) => s.csoport))];
  const valasztott = new Set();

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
    hova.replaceChildren(elem('h3', { class: 'szamolo-cim', szoveg: 'Jelöld be a területeket' }),
      ...SZAMOLO_CSOPORTOK.map((cs) => elem('div', { class: 'sz-csoport' },
        elem('div', { class: 'sz-csoport-nev', szoveg: cs }),
        elem('div', { class: 'sz-chipek' }, ...SOROK.filter((s) => !s.csomag && s.csoport === cs).map((s) => {
          const szulo = szuloje(s.kulcs);
          return elem('button', {
            type: 'button', class: 'sz-chip', 'data-kulcs': s.kulcs, 'aria-pressed': String(valasztott.has(s.kulcs)), disabled: !!szulo,
            title: szulo ? `Benne van a(z) ${szulo.nev} árában` : false,
            html: `${s.nev.replace(/ \(.*/, '')} <small>${ft(s.ar)}</small>`,
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
    tartalom.replaceChildren(
      elem('ul', { class: 'sz-sorok' }, ...e.tetelek.map((t) => elem('li', { class: t.teljes ? 'teljes' : '' },
        elem('span', { html: `${t.nev}<small>${t.teljes ? (egy ? 'teljes ár' : 'a legdrágább: teljes ár') : `50% kedvezmény · ${ft(t.ar)} helyett`}</small>` }),
        elem('span', { class: 'osszeg', szoveg: ft(t.fizet) })))),
      elem('div', { class: 'sz-ossz' }, elem('span', { szoveg: 'Alkalmanként' }), elem('b', { szoveg: ft(e.alkalom) })),
      e.kedvezmeny ? elem('p', { class: 'sz-kedv', szoveg: `Csomagkedvezmény: ${ft(e.kedvezmeny)} alkalmanként` }) : null,
      elem('div', { class: 'sz-program', html: `8 alkalmas program: csak 6 alkalmat fizetsz<b>${ft(e.program)}</b>A 4. és a 8. alkalom ajándék (${ft(e.ajandek)} értékben).` }),
      elem('a', { class: 'gomb gomb-arany gomb-szeles', href: '#foglalas', 'data-terulet': egy ? e.tetelek[0].kulcs : EGYEDI.kulcs, html: `${egy ? 'Időpontot foglalok' : 'Egyedi csomagot foglalok'} <span class="nyil">→</span>` }),
      elem('p', { class: 'sz-lab', szoveg: 'Tájékoztató számítás. A végleges csomagot a konzultáción állítjuk össze, az ár a program végéig fix.' }));
  }
  $('szamolo-valaszto').addEventListener('click', (e) => {
    const b = e.target.closest('.sz-chip');
    if (!b || b.disabled) return;
    szamoloValaszt(b.dataset.kulcs);
    const uj = e.currentTarget.querySelector(`.sz-chip[data-kulcs="${b.dataset.kulcs}"]`);
    if (uj) uj.focus({ preventScroll: true }); // az ujrarajzolas ne dobja el a billentyuzet-fokuszt
  });
  szamoloRajzol();

  // --- 1. idopont-valaszto -----------------------------------------------------------------------------------------------------
  const allapot = { mod: 'kezeles', terulet: 'honalj', oldal: 0, kezdesek: [] };
  const CHIP_KULCSOK = [...document.querySelectorAll('#terulet-chipek .chip')].map((c) => c.dataset.terulet);
  const SOR = 3; // ennyi idopontot mutatunk egyszerre

  const szolgaltatasId = () => (allapot.mod === 'konzult' ? KONZULT.elso : (SZOLGALTATAS[allapot.terulet] || {}).elso);
  const salonicUrl = (id, tol) => `${SZALON.cim}/selectDate/?employeeId=${SZALON.kezelo}&placeId=${SZALON.placeId}&serviceId=${id}${tol ? '&startDate=' + tol : ''}`;

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

  function slotokRajzol() {
    const hova = $('slotok'), tovabb = $('slot-tovabb'), uzenet = $('slot-uzenet');
    const id = szolgaltatasId();
    const k = allapot.kezdesek;
    $('tovabbi-idopontok').href = salonicUrl(id);
    uzenet.hidden = true;
    if (!k.length) { hova.replaceChildren(); tovabb.hidden = true; return; }
    const kezd = (allapot.oldal % Math.ceil(k.length / SOR)) * SOR; // az utolso oldal utan korbefordul
    const lap = k.slice(kezd, kezd + SOR);
    hova.replaceChildren(...lap.map((ts) => elem('a', {
      class: 'slot', href: salonicUrl(id, Math.floor(ts / 86400) * 86400), target: '_blank', rel: 'noopener',
      'aria-label': `${datum(ts)} ${ora(ts)}`,
    }, elem('small', { szoveg: datum(ts) }), elem('b', { szoveg: ora(ts) }))));
    tovabb.hidden = k.length <= SOR;
  }
  let kerNo = 0;
  async function slotokBetolt() {
    const hova = $('slotok'), uzenet = $('slot-uzenet');
    const id = szolgaltatasId();
    const en = ++kerNo;
    allapot.oldal = 0;
    allapot.kezdesek = [];
    $('slot-tovabb').hidden = true;
    uzenet.hidden = true;
    hova.replaceChildren(...Array.from({ length: SOR }, () => elem('span', { class: 'slot csontvaz' })));
    $('tovabbi-idopontok').href = salonicUrl(id);
    if (!id) return;
    try {
      const k = await szabadKezdesek(id);
      if (en !== kerNo) return; // kozben masik teruletet valasztott
      allapot.kezdesek = k.slice(0, SOR * 8);
      if (!k.length) {
        hova.replaceChildren();
        uzenet.replaceChildren('A következő hetekre most nincs szabad időpont. ', elem('a', { href: salonicUrl(id), target: '_blank', rel: 'noopener', szoveg: 'Nézd meg a foglalórendszerben →' }));
        uzenet.hidden = false;
        return;
      }
      slotokRajzol();
    } catch (hiba) {
      if (en !== kerNo) return;
      console.error(hiba);
      hova.replaceChildren();
      uzenet.replaceChildren('Most nem sikerült lekérni a szabad időpontokat. ', elem('a', { href: salonicUrl(id), target: '_blank', rel: 'noopener', szoveg: 'Nézd meg itt az összeset →' }));
      uzenet.hidden = false;
    }
  }

  function valasztoRajzol() {
    const konzult = allapot.mod === 'konzult';
    $('lepes-terulet').hidden = konzult;
    $('lepes-idopont').querySelector('.szam').textContent = konzult ? '2' : '3';
    for (const r of document.querySelectorAll('input[name="mod"]')) r.checked = r.value === allapot.mod;
    for (const c of document.querySelectorAll('#terulet-chipek .chip')) c.setAttribute('aria-pressed', String(c.dataset.terulet === allapot.terulet));
    $('terulet-select').value = CHIP_KULCSOK.includes(allapot.terulet) ? '' : allapot.terulet;
  }
  function beallit(mod, terulet) {
    if (terulet && !SZOLGALTATAS[terulet]) return;
    const regi = [allapot.mod, allapot.terulet].join();
    allapot.mod = mod || allapot.mod;
    if (terulet) allapot.terulet = terulet;
    valasztoRajzol();
    if ([allapot.mod, allapot.terulet].join() !== regi) slotokBetolt();
  }

  // a "masik terulet" legordulo: a chipekben nem szereplo teruletek es csomagok, csoportonkent
  {
    const sel = $('terulet-select');
    const csoportok = new Map();
    for (const s of SOROK) if (!CHIP_KULCSOK.includes(s.kulcs)) csoportok.set(s.csoport, [...(csoportok.get(s.csoport) || []), s]);
    for (const [cs, lista] of csoportok) sel.append(elem('optgroup', { label: cs.replace(/ \(.*/, '') }, ...lista.map((s) => elem('option', { value: s.kulcs, szoveg: s.nev }))));
  }
  $('terulet-chipek').addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) beallit('kezeles', c.dataset.terulet); });
  $('terulet-select').addEventListener('change', (e) => { if (e.target.value) beallit('kezeles', e.target.value); });
  for (const r of document.querySelectorAll('input[name="mod"]')) r.addEventListener('change', () => beallit(r.value));
  $('slot-tovabb').addEventListener('click', () => { allapot.oldal++; slotokRajzol(); });

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
    const fig = new IntersectionObserver((t) => { if (t.some((x) => x.isIntersecting)) { fig.disconnect(); slotokBetolt(); } }, { rootMargin: '600px 0px' });
    fig.observe(foglalo);
  } else slotokBetolt();

  // --- terkep: Google-terkep a funkcionalis sutik engedelyezese utan (mint a tobbi oldalon) ------------------------------------------
  function terkep(engedve) {
    const t = $('terkep');
    if (!engedve || !t || t.querySelector('iframe')) return;
    t.prepend(elem('iframe', {
      title: 'Térkép: MOSAIC, 1023 Budapest, Bécsi út 2.', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade',
      src: 'https://www.google.com/maps?q=' + encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed',
    }));
    t.querySelector('.terkep-kep').style.cssText = 'background:none;inset:auto 0 0 auto;width:auto;height:auto';
  }
  if (window.mhSuti) { terkep(window.mhSuti.engedely('fun')); window.mhSuti.figyel((d) => terkep(d.fun)); }
})();
