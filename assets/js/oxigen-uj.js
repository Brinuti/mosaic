// MOSAIC oxigenterapia UJ landing (/oxigenterapia-budapest-uj, noindex proba) - mukodes.
// Az eles oldal szkriptjenek (oxigen-landing.js) masolata + atalakitas: kezelok / eredmenyek lapozo, video, Trustindex, mobil sticky sav megmaradt;
// uj: a problemakartyak, az ar-/csomag-konstansok EGY helyen, a mérés (spec 2.5), a BEAGYAZOTT foglalo (a meglevo motor 'page' modja) es a marketing-hozzajarulas.
//
// Az oldalon belul nincs #horgony-link: a GTM History Change triggere minden hash-valtozasra merest inditana, ezert a "foglalok" gombok (data-foglal)
// JS-bol gorgetnek (scrollIntoView + fokusz), az URL valtozatlan marad. Nincs popup, nincs uj lap.
// Ezen az oldalon nincs suti.js, igy nincs GTM / pixel: az esemenyek csak a dataLayer-be kerulnek (PII nelkul, stabil event_id-vel).
(() => {
  'use strict';

  // A sajat kereteben nyiltunk meg (a Salonic visszairanyitott): nem rajzolunk.
  try { if (window.top !== window.self && window.parent.location.hostname === location.hostname) return; } catch (e) { /* idegen keret */ }

  // ================================================================================================================
  // EGY HELYEN: arak, idotartamok, csomagok, Salonic-azonositok. A HTML [data-ar] / [data-perc] elemeinek szoveget innen toltjuk be
  // (a HTML-ben ugyanez az ertek all JS nelkuli tartalekkent; a tools/oxigen-uj-teszt ellenorzi az egyezest). A szoveg a MASTERPROMPT.md-bol jon.
  // ================================================================================================================
  const AJANLAT = Object.freeze({
    first_hair: Object.freeze({ serviceId: '466110', ar: 29900, perc: 80, nev: 'Első kezelés állapotfelméréssel' }),
    camera_assessment: Object.freeze({ serviceId: '466147', ar: 4990, perc: 30, nev: 'Hajkamerás állapotfelmérés' }),
    further_treatment: Object.freeze({ serviceId: '466158', ar: 26000, perc: null, nev: 'További kezelés' }),
  });
  const CSOMAG = Object.freeze({
    berlet5: Object.freeze({ ar: 130000, alkalom: 5, honap: 6 }),
    berlet10: Object.freeze({ ar: 260000, alkalom: 10, honap: 12 }),
    kura: Object.freeze({ ar: 289900, alkalom: 11, kontroll: Object.freeze([1, 3, 5, 10]), zaras: 11, ritmus_het: 2 }),
  });
  const SALONIC = Object.freeze({ host: 'mosaic-oxigen.salonic.hu', placeId: '14409' });
  const HOZZAJARULAS_VERZIO = 'tervezet-2026-10-09';
  const OLDAL_VARIANS = 'oxyg_uj';
  window.MOSAIC_OXYG_AJANLAT = Object.freeze({ AJANLAT, CSOMAG, SALONIC }); // a teszt / a CRM-hook olvassa

  const NBSP = ' ';
  const ft = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + NBSP + 'Ft';
  const ARAK = { ...Object.fromEntries(Object.entries(AJANLAT).map(([k, v]) => [k, v.ar])), berlet5: CSOMAG.berlet5.ar, berlet10: CSOMAG.berlet10.ar, kura: CSOMAG.kura.ar };
  document.querySelectorAll('[data-ar]').forEach((e) => { const v = ARAK[e.dataset.ar]; if (v !== undefined) e.textContent = ft(v); });
  document.querySelectorAll('[data-perc]').forEach((e) => { const a = AJANLAT[e.dataset.perc]; if (a && a.perc) e.textContent = a.perc + NBSP + 'perc'; });

  const $ = (id) => document.getElementById(id);
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const salonicUrl = (kulcs) => `https://${SALONIC.host}/selectEmployee/?placeId=${SALONIC.placeId}&serviceId=${AJANLAT[kulcs].serviceId}`;

  // ================================================================================================================
  // Meres (spec 2.5): dataLayer, stabil event_id, PII nelkul (nincs nev / e-mail / telefon / egeszsegi adat; a panasz-szegmens csak kategoria-kulcs).
  // ================================================================================================================
  const pv = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/-/g, '').slice(0, 16);
  let sorszam = 0;
  const meres = (esemeny, adat = {}) => {
    const bejegyzes = { event: esemeny, event_id: `${esemeny}-${pv}-${++sorszam}`, page_variant: OLDAL_VARIANS, ...adat };
    (window.dataLayer = window.dataLayer || []).push(bejegyzes);
    return bejegyzes;
  };

  // ================================================================================================================
  // Allapot
  // ================================================================================================================
  const blokk = $('foglalas');
  const allapot = { szolg: 'first_hair', panaszok: new Set(), kapcsolo: { email: false, sms: false }, motor: null, motorSzolg: null, mod: 'beepitett', inditva: new Set() };
  const frissitAdatok = () => {
    if (!blokk) return;
    blokk.dataset.selectedService = allapot.szolg;
    blokk.dataset.complaints = [...allapot.panaszok].join(',');
    blokk.dataset.consentEmail = String(allapot.kapcsolo.email);
    blokk.dataset.consentSms = String(allapot.kapcsolo.sms);
  };
  // A foglalas-elokeszites hookja (a CRM-mentes kesobb keszul): a kijelolt szolgaltatas, a valasztott panasz-szegmensek, a hozzajarulasok
  window.MOSAIC_OXYG = Object.freeze({
    kontextus: () => ({
      selected_service: allapot.szolg,
      service_id: AJANLAT[allapot.szolg].serviceId,
      complaint_segments: [...allapot.panaszok],
      consent_marketing_email: allapot.kapcsolo.email,
      consent_marketing_sms: allapot.kapcsolo.sms,
      consent_text_version: HOZZAJARULAS_VERZIO,
      booking_mode: allapot.mod,
    }),
  });

  meres('view_oxyg_landing', { page: location.pathname });

  // ================================================================================================================
  // Problemakartyak: tobb is valaszthato, nem diagnozis; a valasztas a foglalo mellett latszik (es a data- hookban / a mérésben)
  // ================================================================================================================
  const panaszCimek = {};
  const panaszAllapot = $('panasz-allapot');
  const panaszFrissit = () => {
    const nevek = [...allapot.panaszok].map((k) => panaszCimek[k]);
    if (panaszAllapot) panaszAllapot.textContent = nevek.length ? 'Kiválasztva: ' + nevek.join(', ') + '.' : 'Még nem választottál panaszt.';
    const fp = $('fo-panasz');
    if (fp) { fp.hidden = !nevek.length; fp.textContent = nevek.length ? 'Választott panaszaid: ' + nevek.join(', ') + '.' : ''; }
    frissitAdatok();
  };
  document.querySelectorAll('.panasz[data-panasz]').forEach((b) => {
    panaszCimek[b.dataset.panasz] = (b.querySelector('.panasz-cim') || b).textContent.trim();
    b.addEventListener('click', () => {
      const kulcs = b.dataset.panasz;
      const be = !allapot.panaszok.has(kulcs);
      if (be) allapot.panaszok.add(kulcs); else allapot.panaszok.delete(kulcs);
      b.setAttribute('aria-pressed', String(be));
      panaszFrissit();
      meres('select_problem', { problem: kulcs, selected: be, selected_count: allapot.panaszok.size });
    });
  });

  // ================================================================================================================
  // A beagyazott foglalo: a meglevo MOSAIC motor (assets/js/booking-engine/engine.js, 'page' mod, beagyazott.js), Shadow DOM-ban a lapon belul.
  // ================================================================================================================
  const MOTOR_V = '__MOTOR_VERZIO__';
  const CSS_V = '__CSS_VERZIO__';
  const verzio = (v) => (v.startsWith('__') ? '' : '?v=' + v); // fejlesztesben (nem epitett) nincs verziojel
  const CSS_HREF = '/assets/css/booking-engine.css' + verzio(CSS_V);
  const FONTS_HREF = '/assets/css/booking-fonts.css' + verzio(CSS_V);
  let modul = null;
  const modulBetolt = () => (modul ||= import('/assets/js/booking-engine/beagyazott.js' + verzio(MOTOR_V)));
  const host = $('foglalo-host');
  const szolgSzoveg = (kulcs) => {
    const a = AJANLAT[kulcs];
    return [a.nev, a.perc ? a.perc + NBSP + 'perc' : null, ft(a.ar)].filter(Boolean).join(' · ');
  };
  const szolgKijelol = (kulcs) => {
    allapot.szolg = kulcs;
    if ($('fo-szolg')) $('fo-szolg').textContent = szolgSzoveg(kulcs);
    document.querySelectorAll('#foglalas [data-foglal]').forEach((e) => e.setAttribute('aria-pressed', String(e.dataset.foglal === kulcs)));
    frissitAdatok();
  };

  // Tartalek (Salonic) mod: ha a beepitett foglalo nem toltheto be / a Salonic adatai nem erkeznek meg, a vendeg a Salonic sajat foglalojan folytathatja
  // (ugyanarra a szolgaltatasra), es a felulet kis felirattal jelzi. kemeny = a motor le van allitva; lagy = a motor hibaoldala latszik, a Salonic-link mellette.
  function tartalekMod(kulcs, fajta, ok) {
    if (allapot.mod === 'tartalek' && allapot.tartalekFajta === 'kemeny') return;
    allapot.mod = 'tartalek';
    allapot.tartalekFajta = fajta;
    $('fo-mod').hidden = false;
    $('fo-tartalek-link').href = salonicUrl(kulcs);
    $('fo-tartalek').hidden = false;
    if (fajta === 'kemeny') { leallit(); host.hidden = true; }
    blokk.dataset.bookingMode = 'fallback_salonic';
    meres('booking_fallback_salonic', { selected_service: kulcs, service_type: kulcs, reason: ok || 'unknown', fallback_kind: fajta });
  }
  function tartalekVissza() {
    if (allapot.mod !== 'tartalek' || allapot.tartalekFajta !== 'lagy') return;
    allapot.mod = 'beepitett';
    allapot.tartalekFajta = null;
    $('fo-mod').hidden = true;
    $('fo-tartalek').hidden = true;
    delete blokk.dataset.bookingMode;
  }
  function leallit() {
    if (allapot.figyelo) { allapot.figyelo.disconnect(); allapot.figyelo = null; }
    clearTimeout(allapot.orzo);
    if (allapot.motor) { allapot.motor.destroy(); allapot.motor = null; }
    allapot.motorSzolg = null;
  }

  async function foglaloIndit(kulcs) {
    if (!host || !blokk) return;
    if (new URLSearchParams(location.search).get('foglalo') === 'tartalek') { tartalekMod(kulcs, 'kemeny', 'forced'); return; } // proba: kenyszeritett tartalek mod
    if (allapot.motor && allapot.motorSzolg === kulcs) return;
    leallit();
    allapot.motorSzolg = kulcs;
    allapot.mod = 'beepitett';
    host.hidden = false;
    $('fo-mod').hidden = true;
    $('fo-tartalek').hidden = true;
    try {
      const m = await modulBetolt();
      if (allapot.motorSzolg !== kulcs) return; // kozben masik szolgaltatast valasztott
      const b = m.beagyazFoglalo(host, { business: 'oxygen', service: AJANLAT[kulcs].serviceId }, { cssHref: CSS_HREF, fontsHref: FONTS_HREF });
      allapot.motor = b;
      // a motor hibaoldalait (Salonic nem valaszol) figyeljuk: ott a tartalek-link megjelenik
      const nezet = () => (b.engine && b.engine.state ? b.engine.state.shown : null);
      const ellenoriz = () => { if (allapot.motor !== b) return; if (nezet() === 'A3') tartalekMod(kulcs, 'lagy', 'engine_error'); else tartalekVissza(); };
      allapot.figyelo = new MutationObserver(() => queueMicrotask(ellenoriz));
      allapot.figyelo.observe(b.root, { childList: true, subtree: true });
      // ha 15 mp utan is a "Betoltes..." latszik, a Salonic-link megjelenik (a motor tovabb probalkozik)
      allapot.orzo = setTimeout(() => { if (allapot.motor === b && b.root.querySelector('.be-loading')) tartalekMod(kulcs, 'lagy', 'slow_load'); }, 15000);
      if (b.engine && b.engine.start) await b.engine.start;
    } catch (e) {
      console.warn('[oxigen-uj] a beepitett foglalo nem indult el, tartalek (Salonic) mod:', e && e.message);
      if (allapot.motorSzolg === kulcs) tartalekMod(kulcs, 'kemeny', 'engine_start_failed');
    }
  }

  // --- a "foglalok" gombok: a szolgaltatas elore kivalasztva, a lapon belul a foglalohoz gorgetes + fokusz (billentyuzettel is: <button>) ---
  const foglalohoGorget = () => {
    const cel = $('foglalo');
    if (!cel) return;
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
    cel.focus({ preventScroll: true });
  };
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-foglal]');
    if (!g) return;
    const kulcs = g.dataset.foglal;
    if (!AJANLAT[kulcs]) return;
    const cta = g.dataset.cta || 'cta';
    // spec esemenynevek (click_hero_first, click_hero_camera, ...): maga az esemeny; a tobbi gomb: click_cta + cta-azonosito
    if (/^click_/.test(cta)) meres(cta, { selected_service: kulcs, service_type: kulcs });
    else meres('click_cta', { cta, selected_service: kulcs, service_type: kulcs });
    szolgKijelol(kulcs);
    if (!allapot.inditva.has(kulcs)) { allapot.inditva.add(kulcs); meres('booking_start', { selected_service: kulcs, service_type: kulcs, source: cta }); }
    foglaloIndit(kulcs);
    foglalohoGorget();
  });
  // A foglalo-blokk kozeledtekor (nem kell gombra kattintani) a kivalasztott szolgaltatassal elindul; a kodot a gombok fole vitt egerre / fokuszra / erintesre elore toltjuk
  if (blokk && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((l) => { if (l.some((x) => x.isIntersecting)) { io.disconnect(); foglaloIndit(allapot.szolg); } }, { rootMargin: '900px 0px' });
    io.observe(blokk);
  } else if (blokk) {
    addEventListener('load', () => foglaloIndit(allapot.szolg), { once: true });
  }
  const elolegez = () => { modulBetolt().catch(() => {}); };
  ['pointerover', 'focusin', 'touchstart'].forEach((t) => document.addEventListener(t, (e) => { if (e.target.closest && e.target.closest('[data-foglal]')) elolegez(); }, { passive: true, once: true }));
  // az elso valodi hasznalat a beagyazott foglaloban (kattintas / fokusz): booking_start, ha meg nem volt a gombbol
  if ($('foglalo-doboz')) $('foglalo-doboz').addEventListener('pointerdown', () => {
    if (!allapot.inditva.has(allapot.szolg)) { allapot.inditva.add(allapot.szolg); meres('booking_start', { selected_service: allapot.szolg, service_type: allapot.szolg, source: 'embedded_booking' }); }
  });

  // --- marketing-hozzajarulas: csatornankent kulon, onkentes, ELORE NEM KIPIPALT; csak UI + data- hook + dataLayer (a mentes a CRM-ben kesobb keszul) ---
  document.querySelectorAll('input[data-consent]').forEach((c) => {
    c.checked = false;
    c.addEventListener('change', () => {
      const csatorna = c.dataset.consent === 'marketing_sms' ? 'sms' : 'email';
      allapot.kapcsolo[csatorna] = c.checked;
      frissitAdatok();
      meres('consent_marketing_changed', { channel: csatorna, granted: c.checked, consent_text_version: HOZZAJARULAS_VERZIO });
      kapcsolatFrissit(); hozzajarulasKuld();
    });
  });
  // A hozzajarulas rogzitese: a foglalo (Salonic) kerete miatt az oldal nem latja a foglalas adatait, ezert a hozzajarulashoz kulon megadott e-mail / telefon kell.
  // A /api/crm/public/hozzajarulas hashelve tarolja, es a foglalas beerkezese utan kapcsolja a vendeghez. A mérésbe (dataLayer) SOHA nem kerul szemelyes adat.
  const kapcsolatEl = document.getElementById('hozzajarulas-kapcsolat');
  const hjEmail = document.getElementById('hj-email'); const hjTel = document.getElementById('hj-tel'); const hjAllapot = document.getElementById('hj-allapot');
  let hjMentett = false;
  const kapcsolatFrissit = () => { if (kapcsolatEl) kapcsolatEl.hidden = !(allapot.kapcsolo.email || allapot.kapcsolo.sms); };
  const hozzajarulasKuld = async () => {
    if (!kapcsolatEl) return;
    const e = allapot.kapcsolo.email; const sm = allapot.kapcsolo.sms;
    const email = hjEmail.value.trim(); const telefon = hjTel.value.trim();
    if (!e && !sm && !hjMentett) return;
    if ((e && !/^\S+@\S+\.\S+$/.test(email)) || (sm && telefon.replace(/\D/g, '').length < 9)) { hjAllapot.textContent = 'A hozzájárulás rögzítéséhez add meg az adatot (e-mail / telefonszám).'; return; }
    try {
      const r = await fetch('/api/crm/public/hozzajarulas', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
        body: JSON.stringify({ selected_service: allapot.szolg, email_marketing: e, sms_marketing: sm, szoveg_verzio: HOZZAJARULAS_VERZIO, kapcsolat: { ...(email ? { email } : {}), ...(telefon ? { telefon } : {}) } }) });
      if (!r.ok) throw new Error('hiba');
      hjMentett = e || sm;
      hjAllapot.textContent = (e || sm) ? 'Rögzítettük. A foglalásod beérkezése után lép életbe, bármikor visszavonható.' : 'A hozzájárulást visszavontad.';
    } catch { hjAllapot.textContent = 'Most nem sikerült rögzíteni. A foglalást ez nem érinti.'; }
  };
  if (hjEmail) hjEmail.addEventListener('change', hozzajarulasKuld);
  if (hjTel) hjTel.addEventListener('change', hozzajarulasKuld);
  szolgKijelol(allapot.szolg);
  panaszFrissit();

  // ================================================================================================================
  // Lapozhato sorok (kezelok, eredmenyek) - az eles oldal szkriptjebol
  // ================================================================================================================
  function lapozo(sav, elozo, kovetkezo, rejtsdHaNincsTul) {
    if (!sav || !elozo || !kovetkezo) return;
    const frissit = () => {
      const tul = sav.scrollWidth > sav.clientWidth + 4;
      if (rejtsdHaNincsTul) elozo.hidden = kovetkezo.hidden = !tul;
      elozo.disabled = sav.scrollLeft < 4;
      kovetkezo.disabled = sav.scrollLeft + sav.clientWidth > sav.scrollWidth - 4;
    };
    const lapoz = (irany) => {
      const kartya = sav.firstElementChild;
      const lepes = kartya ? kartya.getBoundingClientRect().width + parseFloat(getComputedStyle(sav).columnGap || 20) : sav.clientWidth * 0.9;
      sav.scrollBy({ left: irany * lepes, behavior: csokkentett ? 'auto' : 'smooth' });
    };
    elozo.addEventListener('click', () => lapoz(-1));
    kovetkezo.addEventListener('click', () => lapoz(1));
    sav.addEventListener('scroll', frissit, { passive: true });
    addEventListener('resize', frissit);
    frissit();
  }
  lapozo($('kezelo-sav'), $('kezelo-elozo'), $('kezelo-kovetkezo'), true);
  document.querySelectorAll('.ba-keret').forEach((k) => lapozo(k.querySelector('.ba-sav'), k.querySelector('.elozo'), k.querySelector('.kovetkezo'), true));

  // --- mobil sticky CTA: a hero elgorgetese utan latszik, a foglalo szekcio elejen (es utana) eltunik ---
  // Gorgetes-figyelo, nem IntersectionObserver (gyors ugrasnal / gorgetes-linknel az IO nem jelezne).
  const sticky = $('sticky-cta'), hero = document.querySelector('.hero');
  if (sticky && hero && blokk) {
    let kesz = true;
    const frissit = () => {
      kesz = true;
      const lat = hero.getBoundingClientRect().bottom <= 0 && blokk.getBoundingClientRect().top >= innerHeight;
      if (sticky.classList.contains('lathato') === lat) return;
      sticky.classList.toggle('lathato', lat);
      sticky.setAttribute('aria-hidden', lat ? 'false' : 'true');
      sticky.querySelectorAll('button, a').forEach((a) => (lat ? a.removeAttribute('tabindex') : a.setAttribute('tabindex', '-1')));
      document.body.classList.toggle('sticky-be', lat);
    };
    const kerd = () => { if (kesz) { kesz = false; requestAnimationFrame(frissit); } };
    addEventListener('scroll', kerd, { passive: true });
    addEventListener('resize', kerd);
    frissit();
  }

  // --- video: csak kattintasra toltodik be ---
  const doboz = $('video-doboz'), gomb = $('video-gomb');
  if (doboz && gomb) {
    gomb.addEventListener('click', () => {
      const v = document.createElement('video');
      v.src = doboz.dataset.video;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      v.setAttribute('playsinline', 'true');
      v.setAttribute('aria-label', 'Így zajlik egy oxigénterápiás kezelés a MOSAIC-ban');
      gomb.replaceWith(v);
      v.play().catch(() => { /* a vezérlők megmaradnak, a látogató elindíthatja */ });
      meres('play_oxyg_video', { video: 'kezeles_9x16' });
    }, { once: true });
  }

  // --- vendegvelemenyek: az eredeti Trustindex-csuszka keretben (az eles oldal megoldasa: azonnal betolt) ---
  const tiDoboz = $('ti-doboz');
  if (tiDoboz && !tiDoboz.querySelector('iframe')) {
    const f = document.createElement('iframe');
    f.src = tiDoboz.dataset.forras;
    f.title = 'Vendégértékelések (Trustindex)';
    f.loading = 'lazy';
    tiDoboz.replaceChildren(f);
  }

  // --- egyeb kattintasok merese (Glamour, Google, utvonal): data-cta, PII nelkul ---
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cta]');
    if (c && !c.hasAttribute('data-foglal')) meres('click_cta', { cta: c.dataset.cta });
  });
})();
