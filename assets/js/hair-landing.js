// MOSAIC Hair - fodraszat-oldalak (kozponti + Betti + Noel + Evelin): galeria + nagyito, arlista-fulek, mobil sticky sav, Google-ertekeles,
// velemenyek, terkep, "legkozelebbi szabad konzultacio" (a Salonic naptarabol) es a landing-meres (dataLayer).
//
// Az oldalon belul nincs #horgony-link: a GTM History Change triggere minden hash-valtozasra merest inditana, ezert a gorgetest a JS vegzi.
// A foglalas a /foglalo-motor?business=hair... linkeken at tortenik (a launcher, assets/js/booking-launcher.js, a retegben nyitja);
// itt foglalo-kod nincs. Kitalalt adat nincs: ha a Salonic / a Trustindex nem valaszol, az adott elem rejtve marad.
(() => {
  'use strict';

  // A sajat kereteben nyiltunk meg (a Salonic visszairanyitott): a suti.js mar jelzett a szulonek.
  try { if (window.top !== window.self && window.parent.location.hostname === location.hostname) return; } catch (e) { /* idegen keret */ }

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, gyoker = document) => [...gyoker.querySelectorAll(sel)];
  const main = document.querySelector('main.hl');
  if (!main) return;
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- meres (dataLayer; a GTM-et es a hozzajarulast a suti.js kezeli) ----------------------------------------------------------------------
  // A MOSAIC_Hair_implementation_v2 "Analytics contract"-ja szerinti esemenynevek es kozos parameterek. A foglalas-lepeseket (booking_*) a foglalo-motor
  // maga kuldi: ezeket itt nem duplazzuk. A mérés bekotese (GTM-triggerek) az elemzo dolga: a dataLayer-esemenyek onmagukban nem kuldenek semmit.
  const kozos = () => {
    const q = new URLSearchParams(location.search);
    return {
      landing_id: main.dataset.landing || '', entry_intent: main.dataset.intent || '', staff: main.dataset.staff || '', service: '',
      source: q.get('utm_source') || '', medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '', creative: q.get('utm_content') || '',
    };
  };
  const meres = (esemeny, extra = {}) => { (window.dataLayer = window.dataLayer || []).push({ event: esemeny, ...kozos(), ...extra }); };
  meres('landing_view');

  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cta]');
    if (!c) return;
    const poz = c.dataset.poz || c.dataset.cta;
    if (c.dataset.konzult) meres('consultation_cta_click', { cta_position: poz, staff: c.dataset.staffCta || kozos().staff || ((c.href || '').match(/staff=([a-z]+)/) || [])[1] || '' });
    else if (c.dataset.service) meres('service_selected', { service: c.dataset.service, cta_position: poz, staff: c.dataset.staffCta || kozos().staff });
    else if (c.dataset.staffCta) meres('staff_selected', { staff: c.dataset.staffCta, cta_position: poz });
    else if (/^(fodrasz-oldal|fodrasz-nev|masik-fodrasz)-/.test(c.dataset.cta)) meres('staff_selected', { staff: c.dataset.cta.split('-').pop(), cta_position: poz });
  });

  // --- Google-ertekeles-sav + velemenyek: a Trustindex-widget AKTUALIS adata (kitalalt / beegetett ertek nincs) -----------------------------------
  const TI = 'https://cdn.trustindex.io/widgets/8a/8a7562c424f027774456be130a1/content.html';
  const csip = $('g-chip');
  if (csip) {
    csip.addEventListener('click', (e) => { // a velemenyekhez gorget (URL-valtozas nelkul); a Google-ra a velemenyek szekcio gombja visz
      const cel = $('velemenyek');
      if (!cel) return;
      e.preventDefault();
      cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
    });
    fetch(TI, { credentials: 'omit' }).then((r) => r.text()).then((t) => {
      const d = new DOMParser().parseFromString(t, 'text/html');
      const fej = d.querySelector('.ti-header');
      if (!fej) return;
      const db = ((fej.querySelector('.ti-rating-text a') || {}).textContent || '').replace(/\D/g, '');
      const cs = [...fej.querySelectorAll('.ti-stars .ti-star')].map((x) => (x.classList.contains('f') ? 1 : x.classList.contains('h') ? 0.5 : 0));
      if (!db || cs.length !== 5) return;
      const ossz = cs.reduce((x, y) => x + y, 0);
      const min = (((fej.querySelector('.ti-rating') || {}).textContent) || '').trim().replace(/ értékelés$/i, '');
      const cse = $('g-csillag');
      cse.style.setProperty('--ert', (ossz / 5) * 100 + '%');
      cse.setAttribute('aria-label', '5 csillagból ' + String(ossz).replace('.', ','));
      const szam = String(+db).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // 1 257 (a 4 jegyu szamot az Intl hu-HU nem csoportositja)
      $('g-szoveg').textContent = (min ? min + ' · ' : '') + szam + ' Google-vélemény';
      csip.setAttribute('aria-label', 'Google-értékelés: 5 csillagból ' + String(ossz).replace('.', ',') + ', ' + szam + ' vélemény');
      csip.hidden = false;
    }).catch(() => { /* nincs adat: a sav rejtve marad */ });
  }
  const tiDoboz = $('ti-doboz');
  if (tiDoboz && !tiDoboz.querySelector('iframe')) { // a velemenyek mindig azonnal megjelennek (a tulajdonos kerese, 2026-10-07): nincs hozzajarulas-kapu
    const f = document.createElement('iframe');
    f.src = tiDoboz.dataset.forras; f.title = 'Vendégértékelések (Trustindex)'; f.loading = 'eager';
    tiDoboz.replaceChildren(f);
  }

  // --- galeria: szuro + "tovabbi munkak" + nagyito --------------------------------------------------------------------------------------------
  const gal = document.querySelector('[data-galeria]');
  if (gal) {
    const elemek = $$('#galeria-racs > li', gal);
    const tobbGomb = $('galeria-tobb');
    const alap = +gal.dataset.db || 8;
    let szuro = '', kinyitva = false;
    const lathato = () => elemek.filter((li) => !szuro || li.dataset.szin === szuro);
    const frissit = () => {
      const lista = lathato(), hatar = kinyitva ? Infinity : alap;
      elemek.forEach((li) => { li.hidden = !(lista.includes(li) && lista.indexOf(li) < hatar); });
      if (tobbGomb) { tobbGomb.hidden = kinyitva || lista.length <= alap; tobbGomb.firstChild.textContent = `További munkák (${lista.length - alap}) `; }
    };
    $$('.szuro', gal).forEach((b) => b.addEventListener('click', () => {
      szuro = b.dataset.szuro;
      $$('.szuro', gal).forEach((x) => { x.classList.toggle('aktiv', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      meres('gallery_interaction', { action: 'filter', filter: szuro || 'osszes' });
      frissit();
    }));
    if (tobbGomb) tobbGomb.addEventListener('click', () => { kinyitva = true; frissit(); meres('gallery_interaction', { action: 'show_more' }); });
    frissit();

    // nagyito (dialog)
    const lb = $('lb'), lbImg = $('lb-img'), lbCim = $('lb-cim');
    let sor = [], i = 0, nyito = null;
    const mutat = () => {
      const g = sor[i];
      lbImg.src = g.dataset.nagy; lbImg.alt = g.dataset.alt;
      lbCim.textContent = `${i + 1} / ${sor.length} – ${g.dataset.alt}`;
      const egyedi = sor.length < 2;
      $('lb-elozo').hidden = $('lb-kovetkezo').hidden = egyedi;
    };
    const nyit = (gomb) => {
      sor = lathato().map((li) => li.querySelector('.kep-gomb'));
      i = Math.max(0, sor.indexOf(gomb)); nyito = gomb;
      mutat();
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
      meres('gallery_interaction', { action: 'open', index: i + 1 });
    };
    const lep = (d) => { i = (i + d + sor.length) % sor.length; mutat(); };
    gal.addEventListener('click', (e) => { const g = e.target.closest('.kep-gomb'); if (g) nyit(g); });
    $('lb-zar').addEventListener('click', () => lb.close());
    $('lb-elozo').addEventListener('click', () => lep(-1));
    $('lb-kovetkezo').addEventListener('click', () => lep(1));
    lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
    lb.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') lep(-1); else if (e.key === 'ArrowRight') lep(1); });
    lb.addEventListener('close', () => { lbImg.removeAttribute('src'); if (nyito) nyito.focus({ preventScroll: true }); });
    let tx = 0; // huzas (telefon)
    lb.addEventListener('touchstart', (e) => { tx = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50 && sor.length > 1) lep(dx > 0 ? -1 : 1); }, { passive: true });
  }

  // --- arlista-fulek -----------------------------------------------------------------------------------------------------------------------
  const arSzekcio = document.querySelector('[data-ar]');
  if (arSzekcio) {
    const fulek = $$('.ar-ful', arSzekcio), panelek = $$('.ar-csop', arSzekcio);
    const valt = (ful, fokusz = false) => {
      fulek.forEach((f) => { const be = f === ful; f.classList.toggle('aktiv', be); f.setAttribute('aria-selected', String(be)); f.tabIndex = be ? 0 : -1; });
      panelek.forEach((p) => { p.hidden = p.dataset.arCsop !== ful.dataset.arFul; });
      if (fokusz) ful.focus();
      meres('price_view', { action: 'tab', group: ful.dataset.arFul });
    };
    fulek.forEach((f) => { f.tabIndex = f.classList.contains('aktiv') ? 0 : -1; f.addEventListener('click', () => valt(f)); });
    arSzekcio.addEventListener('keydown', (e) => {
      const f = e.target.closest('.ar-ful');
      if (!f || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const k = fulek.indexOf(f);
      valt(fulek[e.key === 'Home' ? 0 : e.key === 'End' ? fulek.length - 1 : (k + (e.key === 'ArrowRight' ? 1 : -1) + fulek.length) % fulek.length], true);
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { meres('price_view', { action: 'section' }); io.disconnect(); } }, { threshold: 0.25 });
      io.observe(arSzekcio);
    }
  }

  // --- mobil sticky sav: a hero gombjai elgorgetese utan jelenik meg; a foglalo-/helyszin-szekcional eltunik -------------------------------------
  // Gorgetes-figyelo, nem IntersectionObserver (gyors ugrasnal az IO nem jelezne).
  const sticky = $('sticky-cta'), heroGombok = main.querySelector('.hero .cta-sor');
  if (sticky && heroGombok) {
    const kikapcs = ['foglalas', 'hely'].map($).filter(Boolean);
    let kesz = true;
    const frissit = () => {
      kesz = true;
      const ki = kikapcs.some((s) => { const r = s.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; });
      const lat = heroGombok.getBoundingClientRect().bottom <= 0 && !ki;
      if (sticky.classList.contains('lathato') === lat) return;
      sticky.classList.toggle('lathato', lat);
      sticky.setAttribute('aria-hidden', lat ? 'false' : 'true');
      $$('a', sticky).forEach((a) => (lat ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
      document.body.classList.toggle('sticky-be', lat);
    };
    const kerd = () => { if (kesz) { kesz = false; requestAnimationFrame(frissit); } };
    addEventListener('scroll', kerd, { passive: true });
    addEventListener('resize', kerd);
    frissit();
  }

  // --- Google terkep: hozzajarulas utan (funkcionalis) magatol, egyebkent a gombra kattintva toltodik be -----------------------------------------
  const terkepBetolt = () => {
    const t = $('terkep');
    if (!t || t.querySelector('iframe')) return;
    const f = document.createElement('iframe');
    f.title = 'Térkép: MOSAIC, 1023 Budapest, Bécsi út 2.'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    f.src = 'https://www.google.com/maps?q=' + encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed';
    t.prepend(f);
    const h = $('terkep-hely');
    if (h) h.remove();
  };
  const tg = $('terkep-gomb');
  if (tg) tg.addEventListener('click', terkepBetolt);
  if (window.mhSuti) { if (window.mhSuti.engedely('fun')) terkepBetolt(); window.mhSuti.figyel((d) => { if (d.fun) terkepBetolt(); }); }

  // --- legkozelebbi szabad konzultacio (a Salonic naptar-API-jabol; hiba / nincs idopont: az elem rejtve marad) ----------------------------------
  let H = null;
  try { H = JSON.parse(document.body.dataset.hair || 'null'); } catch (e) { /* nincs adat */ }
  const teaserek = $$('[data-kovetkezo]');
  if (H && teaserek.length) {
    const API = 'https://api.salonic.hu/calendar/getAvailableTimes';
    const ZONA = 'Europe/Budapest';
    const leker = (url) => { const ab = new AbortController(); const t = setTimeout(() => ab.abort(), 12000); return fetch(url, { credentials: 'omit', signal: ab.signal }).finally(() => clearTimeout(t)); };
    const kezdesek = async (kezelo, naptar) => {
      const p = new URLSearchParams({ startDate: Math.floor(Date.now() / 1000) - 3 * 3600, offset: 0, days: 21, placeId: H.place, serviceId: H.konzultacio, employeeId: kezelo || -1, calendarId: naptar, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0 });
      const j = await (await leker(API + '?' + p)).json();
      if (j.status !== 'success') throw new Error('API: ' + j.status);
      const most = Date.now() / 1000 + 30 * 60, ki = new Set();
      for (const kezelok of Object.values((j.data || {}).blocks || {})) for (const k of Object.values(kezelok)) for (const s of Object.values(k.slots || {})) if (s.timestamp > most) ki.add(s.timestamp);
      return [...ki].sort((a, b) => a - b);
    };
    const elso = async (kezelo) => {
      try { return (await kezdesek(kezelo, H.naptar))[0]; } catch (hiba) {
        // a naptar-azonosito megvaltozhatott: kiolvassuk a Salonic oldalarol, es egyszer ujraprobaljuk
        const m = (await (await leker(`https://mosaic-hair.salonic.hu/selectDate/?employeeId=-1&placeId=${H.place}&serviceId=${H.konzultacio}`)).text()).match(/calendarId:\s*'([^']+)'/);
        if (!m || m[1] === H.naptar) throw hiba;
        H.naptar = m[1];
        return (await kezdesek(kezelo, m[1]))[0];
      }
    };
    const nap = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date(ts * 1000));
    const cimke = (ts) => {
      const ma = Date.now() / 1000, d = nap(ts), ora = new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: false }).format(new Date(ts * 1000));
      if (d === nap(ma)) return 'Ma ' + ora;
      if (d === nap(ma + 86400)) return 'Holnap ' + ora;
      const nev = new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, weekday: 'long' }).format(new Date(ts * 1000));
      if (ts - ma < 6 * 86400) return nev[0].toUpperCase() + nev.slice(1) + ' ' + ora;
      return new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, month: 'short', day: 'numeric' }).format(new Date(ts * 1000)) + ' ' + ora;
    };
    const kitolt = (tz, ts) => {
      const a = tz.querySelector('a[data-ido-link]');
      a.textContent = cimke(ts);
      a.setAttribute('href', a.getAttribute('href') + '&start=' + ts);
      a.dataset.ido = ts;
      tz.hidden = false;
    };
    const futtat = () => {
      const csoport = new Map(); // fodrasz -> teaserek
      teaserek.forEach((tz) => { const k = tz.dataset.kovetkezo; (csoport.get(k) || csoport.set(k, []).get(k)).push(tz); });
      csoport.forEach((lista, k) => {
        const kezelo = k ? (H.fodraszok || {})[k] : null;
        if (k && !kezelo) return;
        elso(kezelo).then((ts) => { if (ts) lista.forEach((tz) => kitolt(tz, ts)); }).catch(() => { /* nincs adat: rejtve marad */ });
      });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(futtat, { timeout: 2500 }); else setTimeout(futtat, 800);
  }
})();
