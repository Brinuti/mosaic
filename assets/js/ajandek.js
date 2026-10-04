// MOSAIC Gift Commerce Engine - a vasarlasi folyamat motorja (/ajandek).
//
// EGY motor, egy allapotgep (asztali es mobil ugyanazt hasznalja), a variant csak a
// tartalmat (config) cserli, a komponensfat nem. Komponensek (egy-egy fuggveny-csoport):
//   GiftHeader, GiftHero, GiftFinder, ProductGrid/ProductCard, ExperienceSection, SocialProof,
//   SelectedProductPanel, Checkout + OrderSummary, PaymentState (feldolgozas/hiba),
//   PurchaseSuccess, Personalization, FinalOrderHub.
//
// Allapotok:  bongeszes -> kivalasztva -> [tervezo (csak otthon nyomtatott kartya)] -> fizetes -> feldolgozas -> (hiba -> fizetes) | siker
//             siker -> szemelyre (csak szemelyes atvetelnel) -> osszegzo        (nincs kosar, nincs kulon termekoldal)
// A termek kivalasztasakor alatta nyitva van a kezeles-bemutato (video + leiras) es mellette az atvetel valasztasa (nincs felugro ablak);
// az otthon nyomtatott kartyat a mini szemelyre szabo (dizajn + foto + idezet) testre szabja.
//
// A PURCHASE esemeny KIZAROLAG akkor megy ki, ha a SZERVER a Stripe-tol visszakerdezve
// "fizetve"-t mond (GET /api/ajandek/rendeles). Stripe-kattintas, atutalasi igeny,
// kartya-letoltes, beváltás NEM purchase.
(function () {
  'use strict';
  var A = window.AJANDEK_ADAT;
  if (!A) { return; }
  var KT = window.AJANDEK_KARTYA || null;

  var API = '/api/ajandek/';
  var TAROLO = 'ah_v1';
  var ATTR_KULCSOK = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ttclid'];
  var ATMENETEK = {
    bongeszes: ['kivalasztva'],
    kivalasztva: ['bongeszes', 'kivalasztva', 'tervezo', 'fizetes'],
    tervezo: ['kivalasztva', 'tervezo', 'fizetes'],
    fizetes: ['kivalasztva', 'tervezo', 'feldolgozas'],
    feldolgozas: ['siker', 'hiba', 'fizetes'],
    hiba: ['fizetes', 'kivalasztva', 'tervezo', 'feldolgozas'],
    siker: ['szemelyre', 'osszegzo'],
    szemelyre: ['osszegzo'],
    osszegzo: []
  };

  // ---------------------------------------------------------------- segedek
  function $(id) { return document.getElementById(id); }
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }
  function uresit(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function veletlen() {
    try { var b = new Uint8Array(12); crypto.getRandomValues(b); return Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }
    catch (e) { return String(Date.now()) + Math.random().toString(16).slice(2); }
  }
  function csendesMozgas() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function gorgess(e, blokk) { if (e && e.scrollIntoView) e.scrollIntoView({ behavior: csendesMozgas() ? 'auto' : 'smooth', block: blokk || 'start' }); }
  function fokusz(e) { if (e && e.focus) { try { e.focus({ preventScroll: true }); } catch (x) { e.focus(); } } }
  function termek(id) { return A.TERMEKEK[id] || null; }

  // ---------------------------------------------------------------- ikonok (egyszeru vonalikonok, a szinuk a szovegeke)
  var IKONOK = {
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c0-3.4 2.7-5.6 6-5.6s6 2.2 6 5.6"/><circle cx="17" cy="9.5" r="2.6"/><path d="M16.5 14.2c3 .1 5 2 5 5"/>',
    gift: '<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M3.5 13h17M12 9v11M12 9C10.5 4.5 6 5 6 7.4 6 9.4 9.5 9 12 9zm0 0c1.5-4.5 6-4 6-1.6 0 2-3.5 1.6-6 1.6z"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
    monitor: '<rect x="3.5" y="5" width="17" height="11.5" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    leaf: '<path d="M5 19c0-8 5-13.5 14-14 .3 8.7-4.7 14-12.5 14.2"/><path d="M5 19c3-4.2 6.2-6.8 10-8.5"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    sparkle: '<path d="M11 4l1.9 5.1L18 11l-5.1 1.9L11 18l-1.9-5.1L4 11l5.1-1.9z"/><path d="M19 4v4M17 6h4"/>',
    waves: '<path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
    lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="M9 5l7 7-7 7"/>',
    pencil: '<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    pin: '<path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 0 0-13 0c0 5.4 6.5 11 6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    phone: '<path d="M6.5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L16 13l4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4z"/>',
    card: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10.5h17M7 15h4"/>',
    camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/>',
    store: '<path d="M4 9.5L5.6 5h12.8L20 9.5"/><path d="M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5"/><path d="M5.5 12v7.5h13V12M10 19.5v-4h4v4"/>',
    home: '<path d="M4 11l8-6.5L20 11"/><path d="M6 10v9.5h12V10M10 19.5v-5h4v5"/>',
    building: '<rect x="5.5" y="4" width="13" height="16" rx="1.5"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10.5 20v-4h3v4"/>',
    hourglass: '<path d="M7 4h10M7 20h10M8 4c0 4 4 5 4 8s-4 4-4 8M16 4c0 4-4 5-4 8s4 4 4 8"/>',
    shield: '<path d="M12 3.5l7 2.5v5.5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    flip: '<path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.5"/><path d="M20 4v4.5h-4.5"/><path d="M20 12a8 8 0 0 1-13.6 5.7L4 15.5"/><path d="M4 20v-4.5h4.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    printer: '<path d="M7 9V4.5h10V9"/><path d="M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2"/><rect x="7" y="13.5" width="10" height="6.5" rx=".8"/>'
  };
  function ikonKitolt(span, nev) {
    if (!span || !IKONOK[nev]) return span;
    span.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">' + IKONOK[nev] + '</svg>';
    return span;
  }
  function ikonSpan(nev) { return ikonKitolt(h('span', { class: 'ah-ikon', 'aria-hidden': 'true' }), nev); }
  function ikonokKitolt(gyoker) {
    Array.prototype.forEach.call((gyoker || document).querySelectorAll('[data-ikon]'), function (e) { if (!e.firstChild) ikonKitolt(e, e.getAttribute('data-ikon')); });
  }
  // a termektartalom soranak ikonja (a szoveg alapjan; a jovahagyott tartalmi sorok nem valtoznak, csak a jelolo)
  function sorIkon(sor) {
    if (/terapeuta/i.test(sor)) return 'users';
    if (/^1 fő/i.test(sor)) return 'user';
    if (/vendég|fő\b/i.test(sor)) return 'users';
    if (/szárítás/i.test(sor)) return 'sparkle';
    if (/felhasználható|időpont/i.test(sor)) return 'calendar';
    if (/perc/i.test(sor)) return 'clock';
    return 'check';
  }
  function listaSor(sor) { return h('li', null, ikonSpan(sorIkon(sor)), h('span', { text: sor })); }
  // mobilon a build a HTML-ben levo kepeket a /assets/img/m/ valtozatra irja at - a JS-bol epitett kepekkel is ezt tesszuk
  function kepUt(src) {
    var k = $('ah-hero-kep');
    var mobil = k && /\/assets\/img\/m\//.test(k.getAttribute('src') || '');
    return mobil ? String(src).replace('/assets/img/', '/assets/img/m/') : src;
  }
  function kepBeallit(img, t) {
    if (!img) return;
    var v = t && t.vizual;
    if (v && v.src) { img.setAttribute('src', kepUt(v.src)); img.setAttribute('alt', v.alt || ''); img.style.objectPosition = v.poz || ''; img.hidden = false; }
    else { img.removeAttribute('src'); img.hidden = true; }
  }

  var tarolas = {
    olvas: function () { try { return JSON.parse(sessionStorage.getItem(TAROLO)) || {}; } catch (e) { return {}; } },
    ir: function (o) { try { sessionStorage.setItem(TAROLO, JSON.stringify(o)); } catch (e) { /* privat ablak: a folyamat tarolo nelkul is megy */ } }
  };
  function helyiOlvas(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function helyiIr(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* nem baj */ } }

  // ---------------------------------------------------------------- allapot
  var tar = tarolas.olvas();
  var Q = new URLSearchParams(location.search);

  // variant: az URL-bol (ervenytelen/ismeretlen/hianyzo -> GENERAL), egyebkent a sessionbol; vegig megmarad
  var variant = A.variantFeloldas(Q.has('variant') ? Q.get('variant') : tar.variant_id);

  // attribucio: UTM-ek es kattintas-azonositok; uj kampany-kattintas felulirja, egyebkent a session orzi
  var attr = (tar.attr && typeof tar.attr === 'object') ? tar.attr : {};
  var ujAttr = false;
  ATTR_KULCSOK.forEach(function (k) {
    var v = Q.get(k);
    if (v) { if (!ujAttr) { attr = {}; ujAttr = true; } attr[k] = String(v).slice(0, 200); }
  });
  if (!attr.oldal) attr.oldal = location.pathname;
  var alkalomURL = (Q.get('occasion') || '').trim().slice(0, 40);

  var S = {
    allapot: 'bongeszes',
    variant: variant,
    termek: tar.termek && termek(tar.termek) ? tar.termek : null,
    finder: tar.finder || null,
    urlap: tar.urlap || {},
    attr: attr,
    pi: tar.pi || null,
    cs: tar.cs || null,
    rt: tar.rt || null,                  // csak olvasasi rendeles-token (levelbeli link); a client_secret nem kerul e-mailbe/URL-be
    csakOlvas: !!tar.csak_olvas,         // a levelbeli linkkel megnyitott rendeles: nincs szerkesztes, nincs purchase
    fizetesInditva: tar.fizetes_inditva || null, // annak a PaymentIntentnek az azonositoja, amelyiknek a fizeteset EBBEN a munkamenetben inditottuk
    rendeles: null,
    mod: 'betolt',          // betolt | elo | teszt | nincs
    azonnali: false,
    fizetveIdo: tar.fizetve_ido || 0,   // a sikeres fizetes ideje (ms): a vasarlas utani nezet csak rovid ideig all vissza
    folyamatban: false,     // dupla beküldés ellen
    elemKesz: false,
    fizMod: null,
    fiz: 'kartya',          // fizetesi mod: kartya (Stripe: kartya / tarca) | atutalas
    atuKesz: false,         // az atutalasi igenyt elkuldtuk
    stripeHiba: false,      // a Stripe nem toltott be
    utanAllapot: tar.utan_allapot || null,
    atvetel: tar.atvetel === 'szemelyesen' ? 'szemelyesen' : 'otthon', // hogyan veszi at a kartyat (a fizetes elott valasztja)
    tervezo: ujTervezo(tar.tervezo),                                  // a mini szemelyre szabo adatai
    fotoLehet: false                                                  // a szerver /beallitas jelzi: van-e foto-tarolo (KV)
  };
  // a variant-link (?variant=) a Gift Finder elovalasztasat is beallitja (a vevo kesobbi valasztasa felulirja)
  if (Q.has('variant')) S.finder = variant.gift_finder_preselect || null;

  function ment() {
    tarolas.ir({
      v: 1, variant_id: S.variant.variant_id, termek: S.termek, finder: S.finder, urlap: S.urlap,
      attr: S.attr, pi: S.pi, cs: S.cs, rt: S.rt, csak_olvas: S.csakOlvas, fizetes_inditva: S.fizetesInditva,
      utan_allapot: S.utanAllapot, fizetve_ido: S.fizetveIdo,
      atvetel: S.atvetel,
      tervezo: { tema: S.tervezo.tema, idezet: S.tervezo.idezet, nev: S.tervezo.nev, fotoId: S.tervezo.fotoId, fotoPoz: S.tervezo.fotoPoz, kihagyva: S.tervezo.kihagyva }
    });
  }

  // ---------------------------------------------------------------- meres (dataLayer / GA4 ecommerce)
  var kuldott = {};
  function kozosParam() {
    var p = { variant_id: S.variant.variant_id, gift_context: S.variant.gift_context };
    if (S.variant.relationship) p.relationship = S.variant.relationship;
    var alk = S.variant.occasion === 'dynamic' ? alkalomURL : (S.variant.occasion || alkalomURL);
    if (alk) p.occasion = alk;
    ATTR_KULCSOK.forEach(function (k) { if (S.attr[k]) p[k] = S.attr[k]; });
    return p;
  }
  function tetel(t) {
    return { item_id: t.item_id, item_name: t.nev, item_category: 'Ajándékkártya', item_category2: t.product_type, price: t.ar_ft, quantity: 1 };
  }
  function mer(nev, tartalom, egyszer) {
    if (egyszer) { if (kuldott[egyszer]) return false; kuldott[egyszer] = true; }
    var dl = window.dataLayer = window.dataLayer || [];
    dl.push({ ecommerce: null });
    var o = { event: nev };
    var k = kozosParam();
    Object.keys(k).forEach(function (x) { o[x] = k[x]; });
    Object.keys(tartalom || {}).forEach(function (x) { o[x] = tartalom[x]; });
    dl.push(o);
    return true;
  }
  function meresViewItem() {
    var tetelek = S.variant.product_order.map(function (id) { return tetel(termek(id)); });
    mer('view_item', { ecommerce: { currency: A.PENZNEM, item_list_id: 'ajandek_' + S.variant.variant_id, item_list_name: 'MOSAIC ajándékkártya', items: tetelek } }, 'view_item');
  }

  // ---------------------------------------------------------------- allapotgep
  function allapotba(uj, opciok) {
    opciok = opciok || {};
    if (S.allapot === uj && !opciok.ujra) return true;
    if (!opciok.eroltet && (ATMENETEK[S.allapot] || []).indexOf(uj) < 0) {
      if (window.console) console.warn('ajandek: tiltott allapotatmenet', S.allapot, '->', uj);
      return false;
    }
    S.allapot = uj;
    render();
    ment();
    return true;
  }

  // ---------------------------------------------------------------- GiftHero (variant config)
  function heroRender() {
    var c = S.variant;
    $('ah-hero-eyebrow').textContent = c.hero_eyebrow;
    $('ah-hero-cim').textContent = c.hero_title;
    $('ah-hero-alcim').textContent = c.hero_subtitle;
    $('ah-hero-cta-szoveg').textContent = c.hero_cta;
    var biz = $('ah-hero-biztositas');
    if (biz) { biz.textContent = c.reassurance || ''; biz.hidden = !c.reassurance; }
    var lista = uresit($('ah-hero-bizalom'));
    c.hero_trust.forEach(function (t) {
      var li = h('li');
      // a "href" a lap egy szekciojara mutat (pl. a Google-ertekeles a velemenyekhez visz): kattinthato
      var tarto = t.href ? li.appendChild(h('a', { class: 'ah-bizalom-link', href: t.href, 'data-gorgess': String(t.href).replace(/^#/, '') })) : li;
      if (t.csillag) tarto.appendChild(h('span', { class: 'ah-csillag', 'aria-hidden': 'true', text: '★★★★★' }));
      else tarto.appendChild(ikonSpan(t.ikon));
      tarto.appendChild(h('span', { class: 'ah-bizalom-szoveg' }, h('b', { text: t.szoveg }),
        t.alszoveg_rovid ? h('small', null, h('span', { class: 'ah-m-hosszu', text: t.alszoveg }), h('span', { class: 'ah-m-rovid', text: t.alszoveg_rovid })) : h('small', { text: t.alszoveg })));
      lista.appendChild(li);
    });
    var kep = $('ah-hero-kep');
    if (c.hero_media && c.hero_media.poz) kep.style.objectPosition = c.hero_media.poz;
    if (c.hero_media) {
      // mobilon a build a /assets/img/m/ valtozatra irja at a HTML-ben levo kepeket - a config kepeivel is ezt tesszuk
      var mobilKep = /\/assets\/img\/m\//.test(kep.getAttribute('src') || '');
      var src = mobilKep ? c.hero_media.src.replace('/assets/img/', '/assets/img/m/') : c.hero_media.src;
      if (kep.getAttribute('src') !== src) kep.setAttribute('src', src);
      kep.setAttribute('alt', c.hero_media.alt || '');
    }
    // ellenvetes-blokk: csak ha a variant tolti (GENERAL: nincs)
    var blokk = $('ah-ellenvetes');
    if (c.objection_title) {
      $('ah-ellenvetes-cim').textContent = c.objection_title;
      $('ah-ellenvetes-szoveg').textContent = c.objection_body || '';
      blokk.hidden = false;
    } else blokk.hidden = true;
  }

  // ---------------------------------------------------------------- Ilyen a Head Spa (video + elmeny) / Pontosan ezt kapja / vendegvideok sorrendje
  function headspaRender() {
    var v = A.HEADSPA_VIDEO, gomb = $('ah-headspa-video');
    if (v && gomb) {
      gomb.setAttribute('data-vendeg', v.src);
      var kep = $('ah-headspa-kep');
      if (kep && v.poster) kep.setAttribute('src', kepUt(v.poster));
      $('ah-headspa-ido').textContent = v.ido || '';
      gomb.setAttribute('aria-label', 'Mi az a Head Spa: a kezelés videójának lejátszása' + (v.ido ? ' (' + v.ido + ')' : ''));
    }
    var lista = $('ah-benefitek');
    if (!lista) return;
    uresit(lista);
    (A.BENEFITOK || []).forEach(function (b) {
      lista.appendChild(h('li', null, h('span', { class: 'ah-benefit-ikon' }, ikonSpan(b.ikon)), h('div', null, h('strong', { text: b.cim }), h('span', { text: b.szoveg }))));
    });
  }
  // "Pontosan ezt kapja": egy MOSAIC Head Spa szeansz elemei (AJANDEK_ADAT.ELEMEK): kattintasra a lejatszo-ablakban (16:9) indul a rovid felvetel
  function elemekRender() {
    var lista = $('ah-elemek');
    if (!lista) return;
    uresit(lista);
    (A.ELEMEK || []).forEach(function (e) {
      var jatszo = h('span', { class: 'ah-vendeg-lejatszas', 'aria-hidden': 'true' });
      jatszo.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="19"/><path d="M16 12.5v15l12-7.5z"/></svg>';
      lista.appendChild(h('li', null,
        h('button', { type: 'button', class: 'ah-elem', 'data-vendeg': e.video, 'data-nev': e.nev, 'data-forma': 'szeles', 'aria-label': e.nev + ' (' + e.ido + ') – videó lejátszása' },
          h('span', { class: 'ah-elem-kep' }, h('img', { src: kepUt(e.poster), alt: '', width: 640, height: 360, loading: 'lazy', decoding: 'async' }), jatszo),
          h('span', { class: 'ah-elem-cimke' }, h('b', { text: e.nev })))));
    });
  }
  // galeria (Miert MOSAIC): lapozhato sor kis kepekkel, kattintasra nagyito (elozo / kovetkezo, nyilbillentyuk, huzas)
  function galeriaInit() {
    var lista = $('ah-galeria'), lb = $('ah-lightbox');
    if (!lista || !A.GALERIA) return;
    var kepek = A.GALERIA;
    uresit(lista);
    kepek.forEach(function (k, i) {
      lista.appendChild(h('li', null, h('button', { type: 'button', class: 'ah-gal-kep', 'data-gal': String(i), 'aria-label': 'Kép nagyítása: ' + k.alt },
        h('img', { src: kepUt(k.src), alt: k.alt, width: k.w, height: k.h, loading: 'lazy', decoding: 'async' }))));
    });
    if (!lb) return;
    var akt = 0, kep = $('ah-lb-kep'), felirat = $('ah-lb-felirat');
    function mutat(i) {
      akt = (i + kepek.length) % kepek.length;
      kep.setAttribute('src', kepek[akt].src);
      kep.setAttribute('alt', kepek[akt].alt);
      felirat.textContent = kepek[akt].alt + ' (' + (akt + 1) + '/' + kepek.length + ')';
    }
    function bezar() { if (lb.close) lb.close(); else lb.removeAttribute('open'); }
    lista.addEventListener('click', function (ev) {
      var g = ev.target.closest ? ev.target.closest('[data-gal]') : null;
      if (!g) return;
      mutat(+g.getAttribute('data-gal'));
      if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    });
    $('ah-lb-elozo').addEventListener('click', function () { mutat(akt - 1); });
    $('ah-lb-kovetkezo').addEventListener('click', function () { mutat(akt + 1); });
    $('ah-lb-bezar').addEventListener('click', bezar);
    lb.addEventListener('click', function (ev) { if (ev.target === lb) bezar(); });
    lb.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowLeft') mutat(akt - 1); else if (ev.key === 'ArrowRight') mutat(akt + 1); });
    var x0 = null;
    lb.addEventListener('touchstart', function (ev) { x0 = ev.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (ev) {
      if (x0 === null) return;
      var dx = ev.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) mutat(akt + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }
  // lapozhato sorok (vendeg-videok, szeansz elemei): a nyilak gorgetnek, a sor erintessel / gorgetessel is lapozhato
  function karusszelBekot() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-karusszel]'), function (kar) {
      var sin = kar.querySelector('.ah-kar-sin');
      var nyilak = kar.querySelectorAll('.ah-kar-nyil');
      if (!sin) return;
      function frissit() {
        var max = sin.scrollWidth - sin.clientWidth - 2;
        Array.prototype.forEach.call(nyilak, function (n) {
          n.disabled = +n.getAttribute('data-irany') < 0 ? sin.scrollLeft <= 2 : sin.scrollLeft >= max;
        });
        kar.classList.toggle('ah-kar-nincs', max <= 0);
      }
      Array.prototype.forEach.call(nyilak, function (n) {
        n.addEventListener('click', function () {
          sin.scrollBy({ left: +n.getAttribute('data-irany') * Math.max(200, sin.clientWidth * 0.85), behavior: csendesMozgas() ? 'auto' : 'smooth' });
        });
      });
      sin.addEventListener('scroll', function () { window.requestAnimationFrame(frissit); }, { passive: true });
      window.addEventListener('resize', frissit);
      frissit();
      setTimeout(frissit, 700);
    });
  }
  // a persona szerinti sorrend: az elso testimonial-videok a variant szerint (a vendegvideok mind valodi vendegek)
  function vendegRendez() {
    var lista = document.querySelector('.ah-vendeg-lista');
    if (!lista) return;
    (S.variant.vendeg_sorrend || []).slice().reverse().forEach(function (vid) {
      var li = lista.querySelector('[data-vid="' + vid + '"]');
      if (li) lista.insertBefore(li, lista.firstChild);
    });
  }

  // A hero videoja: csak ha van (hero_media.video), a betoltes utan indul (a fotó az LCP-elem), nem indul csendes-mozgas
  // vagy adatkimelo beallitasnal; a fotó marad a poszter, a video lagyan beuszik, amint lejatszik.
  function heroVideo() {
    var m = S.variant.hero_media, v = $('ah-hero-video');
    if (!v || !m || !m.video || !m.video.src || csendesMozgas()) return;
    try { if (navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || ''))) return; } catch (e) { /* nem baj */ }
    // A bongeszo a lathatatlan (kijelzon kivuli / meg nem kiszamolt elrendezesu) nema videot "energiatakarekossagbol" megallitja,
    // ezert a lejatszas a betoltott adat utan indul, es amikor a video ujra lathatova valik, folytatodik; kilepve a kepbol megall.
    function inditas() {
      function proba() {
        var p = v.play();
        if (p && p.catch) p.catch(function () { /* nem indult: marad a fotó */ });
      }
      v.addEventListener('playing', function () { v.classList.add('ah-megy'); }, { once: true });
      v.addEventListener('canplay', proba, { once: true });
      v.preload = 'auto';   // a HTML-ben "none" (a betoltesig nem tolt semmit); innen indul az adat
      v.setAttribute('src', m.video.src);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (lista) {
          lista.forEach(function (e) {
            if (e.isIntersecting) { if (v.paused && v.readyState >= 2) proba(); } else if (!v.paused) v.pause();
          });
        }, { threshold: 0.1 }).observe(v);
      }
    }
    if (document.readyState === 'complete') setTimeout(inditas, 400);
    else window.addEventListener('load', function () { setTimeout(inditas, 400); }, { once: true });
  }

  // ---------------------------------------------------------------- SocialProof
  function proofRender() {
    var p = A.PROOFOK[S.variant.featured_proof] || A.PROOFOK.general;
    $('ah-proof-idezet').textContent = p.idezet;
    $('ah-proof-forras').textContent = p.forras;
    $('ah-proof').classList.toggle('ah-helyorzo', !p.valodi);
    // a Google-osszegzes (tulajdonosi adat, lasd ajandek-adat.js)
    $('ah-google-pont').textContent = A.GOOGLE.pont;
    $('ah-google-szam').textContent = A.GOOGLE.darab + ' Google-vélemény';
    // a "Miért a MOSAIC Headspa?" blokk értékelés-jelvénye ugyanebből az adatból
    Array.prototype.forEach.call(document.querySelectorAll('[data-google-pont]'), function (e) { e.textContent = A.GOOGLE.pont; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-google-szam]'), function (e) { e.textContent = A.GOOGLE.darab + ' Google-vélemény'; });
    trustindexInit();
    terkepInit();
  }

  // A valodi Google-velemenyek a Trustindex-widgetbol jonnek (ugyanaz a widget, mint az elo oldalon: head-spa-velemenyek). A Trustindex a suti-
  // tajekoztato szerint "funkcionalis" szolgaltatas: csak a hozzajarulas utan toltjuk be (mhSuti.engedely('fun')); addig a tulajdonos altal
  // megadott valodi velemeny latszik, es egy gombbal engedelyezheto. A widget megjelenese utan a tartalek-kartya eltunik.
  // Az elo oldal fooldalan is ez a beagyazas latszik (assets/embed/, iframe): inline ertekeles-fejlec + valodi velemeny-kartyak.
  var TI_KERET = '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html';
  var tiBetoltve = false;
  function trustindexBetolt() {
    var doboz = $('ah-trustindex');
    if (!doboz || tiBetoltve) return;
    tiBetoltve = true;
    var tartalek = $('ah-proof');
    var f = h('iframe', { class: 'ah-ti-keret', src: TI_KERET, title: 'Google-vélemények (Trustindex)', loading: 'lazy' });
    // az iframe azonos eredetu: a magassagat a tartalomhoz igazitjuk; a tartalek-kartya csak a valodi widget megjelenese utan tunik el
    var proba = 0;
    function meret() {
      try {
        var d = f.contentDocument;
        if (!d || !d.body) return false;
        var kesz = !!d.querySelector('.ti-widget');
        if (!d.getElementById('ah-ti-stilus') && d.head) {
          var st = d.createElement('style'); st.id = 'ah-ti-stilus';
          st.textContent = 'html body div.ti-controls-line,html body .ti-widget .ti-controls-line{display:none!important;height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;visibility:hidden!important}';   // a lapozo-sav (gorgetosav) elrejtese; a kartyak huzassal tovabbra is lapozhatok
          d.head.appendChild(st);
        }
        var m = Math.max(d.body.scrollHeight, d.documentElement.scrollHeight);
        if (kesz && m > 60) {
          f.style.height = (m + 6) + 'px';
          if (tartalek) tartalek.hidden = true;
          var ossz = document.querySelector('.ah-google-ossz');   // a widget fejlecenek sajat osszegzese van: nem ismeteljuk
          if (ossz) ossz.hidden = true;
        }
        return kesz;
      } catch (e) { if (tartalek) tartalek.hidden = true; return true; }
    }
    var ido = setInterval(function () { proba++; if ((meret() && proba > 6) || proba > 60) clearInterval(ido); }, 400);
    window.addEventListener('resize', meret);
    doboz.appendChild(f);
    if (tartalek) {
      var gomb = $('ah-ti-gomb'), megj = tartalek.querySelector('.ah-ti-megjegyzes');
      if (gomb) gomb.hidden = true;
      if (megj) megj.textContent = 'A vélemények betöltése…';
    }
  }
  // az "Itt találsz minket" doboz pici térképe (OpenStreetMap): harmadik fél tartalma, ezért a Trustindexhez hasonlóan csak a "funkcionális"
  // hozzájárulás után töltődik be; addig egy helyőrző + gomb áll a helyén
  function terkepInit() {
    var doboz = $('ah-terkep'), gomb = $('ah-terkep-gomb');
    if (!doboz || !gomb) return;
    var engedelyezve = function () { try { return !!(window.mhSuti && window.mhSuti.engedely('fun')); } catch (e) { return false; } };
    function betolt() {
      if (doboz.querySelector('iframe')) return;
      var f = document.createElement('iframe');
      f.src = doboz.getAttribute('data-src');
      f.title = 'A MOSAIC Head Spa a térképen (OpenStreetMap)';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer';
      doboz.appendChild(f);
      doboz.classList.add('ah-terkep-kesz');
    }
    if (engedelyezve()) { betolt(); return; }
    gomb.addEventListener('click', function () {
      try { if (window.mhSuti && window.mhSuti.enged) window.mhSuti.enged('fun'); } catch (e) { /* nem baj */ }
      if (engedelyezve()) betolt();
    });
    try { if (window.mhSuti && window.mhSuti.figyel) window.mhSuti.figyel(function () { if (engedelyezve()) betolt(); }); } catch (e) { /* nem baj */ }
  }
  function trustindexInit() {
    var gomb = $('ah-ti-gomb');
    var engedelyezve = function () { try { return !!(window.mhSuti && window.mhSuti.engedely('fun')); } catch (e) { return false; } };
    if (engedelyezve()) { trustindexBetolt(); return; }
    if (gomb) gomb.addEventListener('click', function () {
      try { if (window.mhSuti && window.mhSuti.enged) window.mhSuti.enged('fun'); } catch (e) { /* nem baj */ }
      trustindexBetolt();
    });
    try { if (window.mhSuti && window.mhSuti.figyel) window.mhSuti.figyel(function () { if (engedelyezve()) trustindexBetolt(); }); } catch (e) { /* nem baj */ }
  }

  // ---------------------------------------------------------------- ProductGrid / ProductCard (1. lepes: elmeny-valasztas, radio)
  // A kijelzett termek: a valasztott, ennek hianyaban az ajanlott (a variant elovalasztasa, egyebkent az elso a variant sorrendjeben);
  // igy a 2. (video) es a 3. (atvetel) lepes mindig ki van toltve. A vevo valasztasa (radio) allitja be az S.termek-et.
  function ajanlottId() {
    var f = S.finder ? A.FINDER.filter(function (x) { return x.id === S.finder; })[0] : null;
    return (f && f.termek) || S.variant.product_order[0];
  }
  function kijelzett() { return S.termek && termek(S.termek) ? S.termek : ajanlottId(); }
  function termekKartya(t) {
    var meta = [['clock', t.osszefoglalo, t.osszefoglalo_rovid], [t.vendeg_db > 1 ? 'users' : 'user', t.vendeg_db + ' fő']];
    var lista = h('ul', { class: 'ah-termek-meta' });
    // mobilon a rovid szoveg latszik (.ah-m-rovid), asztalon a hosszu
    meta.forEach(function (m) { if (m[1]) lista.appendChild(h('li', null, ikonSpan(m[0]), m[2] ? h('span', null, h('span', { class: 'ah-m-hosszu', text: m[1] }), h('span', { class: 'ah-m-rovid', text: m[2] })) : h('span', { text: m[1] }))); });
    var kep = h('span', { class: 'ah-termek-kep' });
    if (t.vizual && t.vizual.src) {
      kep.appendChild(h('img', { src: kepUt(t.vizual.src), alt: '', width: t.vizual.w || null, height: t.vizual.h || null, loading: 'lazy', decoding: 'async', style: t.vizual.poz ? 'object-position:' + t.vizual.poz : null }));
    }
    // plusz sor minden kártyán: a kezelés felépítése (felugró ablak); a gomb a kártyán belül sem választja ki a terméket
    var menet = h('button', { type: 'button', class: 'ah-kez-link', 'data-kez': t.id, 'aria-haspopup': 'dialog' }, ikonSpan('list'), h('span', { text: 'Hogyan épül fel a kezelés?' }), ikonSpan('chevron'));
    return h('label', { class: 'ah-termek', id: 'ah-termek-' + t.id, 'data-termek': t.id },
      h('input', { type: 'radio', name: 'termek', value: t.id, class: 'ah-termek-radio' }),
      kep,
      h('span', { class: 'ah-termek-test' }, h('strong', { class: 'ah-termek-nev', text: t.nev }), lista, menet, h('span', { class: 'ah-ar', text: A.arSzoveg(t.ar_ft) })),
      h('span', { class: 'ah-radio-jel', 'aria-hidden': 'true' }));
  }
  // a kezelés felépítése: felugró ablak (lépések az éles oldal ajándékkártya-oldalairól)
  var kezTermek = null, kezFokusz = null;
  function kezAblakNyit(id, forras) {
    var t = termek(id), abl = $('ah-kez-ablak');
    var m = t && t.kezeles && t.kezeles.menet;
    if (!t || !abl || !m) return;
    kezTermek = id; kezFokusz = forras || null;
    $('ah-kez-ablak-cim').textContent = m.nev;
    // a kezelés alapképe (ugyanaz, mint a kártyán), hogy lássa, miről van szó
    var kep = $('ah-kez-kep');
    if (t.vizual && t.vizual.src) { kep.src = kepUt(t.vizual.src); kep.style.objectPosition = t.vizual.poz || '50% 50%'; kep.hidden = false; } else kep.hidden = true;
    $('ah-kez-bevezeto').textContent = m.bevezeto || '';
    $('ah-kez-bevezeto').hidden = !m.bevezeto;
    var lista = uresit($('ah-kez-elemek'));
    m.elemek.forEach(function (e) { lista.appendChild(h('li', e[1] ? { class: 'ah-kiemelt' } : null, ikonSpan('check'), h('span', { text: e[0] }))); });
    $('ah-kez-utana').textContent = m.utana || '';
    $('ah-kez-ido').textContent = m.ido ? 'Időtartam: ' + m.ido : '';
    if (abl.showModal) abl.showModal(); else abl.setAttribute('open', '');
    fokusz($('ah-kez-bezar'));
  }
  function kezAblakZar() {
    var abl = $('ah-kez-ablak');
    if (!abl) return;
    if (abl.close) { if (abl.open) abl.close(); } else abl.removeAttribute('open');
  }
  function kezAblakBekot() {
    var abl = $('ah-kez-ablak');
    if (!abl) return;
    $('ah-kez-bezar').addEventListener('click', kezAblakZar);
    abl.addEventListener('click', function (ev) { if (ev.target === abl) kezAblakZar(); }); // a háttérre kattintva is bezárul
    abl.addEventListener('close', function () { if (kezFokusz && kezFokusz.focus) { try { kezFokusz.focus(); } catch (e) { /* nem baj */ } } });
    $('ah-kez-valaszt').addEventListener('click', function () { var id = kezTermek; kezFokusz = null; kezAblakZar(); if (id) { kivalaszt(id); gorgessVideora(); } });
    document.addEventListener('click', function (ev) {
      var g = ev.target.closest ? ev.target.closest('.ah-kez-link') : null;
      if (!g) return;
      ev.preventDefault();
      kezAblakNyit(g.getAttribute('data-kez'), g);
    });
  }
  function termekekRender() {
    var racs = uresit($('ah-termek-racs'));
    S.variant.product_order.forEach(function (id) { var t = termek(id); if (t) racs.appendChild(termekKartya(t)); });
    valasztottJelol();
  }
  function valasztottJelol() {
    var aktiv = kijelzett();
    Array.prototype.forEach.call(document.querySelectorAll('.ah-termek'), function (k) {
      var az = k.getAttribute('data-termek') === aktiv;
      k.classList.toggle('ah-valasztott', az);
      var r = k.querySelector('input'); if (r) r.checked = az;
    });
  }
  // keskeny kepernyon a 2. lepes (video) a termek-lista ALATT van: a vevo valasztasa utan odagorgetunk, hogy latsszon, hogy valtozik valami
  function gorgessVideora() {
    var lep = document.querySelector('#ah-lepesek .ah-lepes:nth-child(2)'), lista = $('ah-termek-racs');
    var fej = lep && lep.querySelector('.ah-lepes-fej');
    if (!fej || !lista) return;
    if (lep.getBoundingClientRect().top < lista.getBoundingClientRect().bottom - 4) return;   // egymas mellett (asztali): nincs mit gorgetni
    // a ragados fejlec (az eles oldal fejlece, kb. 77 px) alatt: a 2. lepes CIME kerul a kepernyo tetejere (fejlec + 22 px), nem a video
    function cel() { var fh = document.getElementById('SITE_HEADER'); return Math.max(0, fej.getBoundingClientRect().top + window.pageYOffset - ((fh ? fh.getBoundingClientRect().height : 77) + 22)); }
    setTimeout(function () {
      window.scrollTo({ top: cel(), behavior: csendesMozgas() ? 'auto' : 'smooth' });
      // a gorgetes vegen (a kepek / a szoveg magassaga kozben valtozhat) szukseg eseten pontositunk
      setTimeout(function () { if (Math.abs(cel() - window.pageYOffset) > 8) window.scrollTo({ top: cel(), behavior: 'auto' }); }, 900);
    }, 60);
  }
  // a vevo valasztasa: a 2. es 3. lepes a helyen frissul (keskeny kepernyon a videohoz gorgetunk: gorgessVideora)
  function kivalaszt(id) {
    var t = termek(id);
    if (!t) return;
    var uj = S.termek !== id;
    S.termek = id;
    allapotba('kivalasztva', { ujra: true });
    if (uj) mer('select_item', { ecommerce: { item_list_id: 'ajandek_' + S.variant.variant_id, item_list_name: 'MOSAIC ajándékkártya', items: [tetel(t)] }, product_type: t.product_type });
    stripeElokeszit();
  }

  // ---------------------------------------------------------------- 2-3. lepes (video + vasarlas) es OrderSummary
  var mediaTermek = null;
  function lepesekRender() {
    var id = kijelzett(), t = termek(id);
    if (!t) return;
    var k = t.kezeles || {};
    $('ah-kiv-cim').textContent = t.nev;
    $('ah-kiv-ar').textContent = A.arSzoveg(t.ar_ft);
    var leiras = uresit($('ah-kiv-leiras'));
    (k.leiras && k.leiras.length ? k.leiras : [t.leiras]).forEach(function (sor) { leiras.appendChild(h('p', { text: sor })); });
    // a kezeles videoja (TERMEKEK.*.kezeles.video, 9:16); csak akkor epitjuk ujra, ha masik termek lett kijelolve (a lejatszas ne szakadjon meg)
    if (mediaTermek !== id) {
      mediaTermek = id;
      var media = uresit($('ah-kiv-media'));
      var poszter = (k.video && k.video.poster) || (t.vizual && t.vizual.src) || null;
      if (k.video && k.video.src) {
        media.appendChild(h('video', { controls: true, playsinline: true, preload: 'none', poster: poszter ? kepUt(poszter) : null, 'aria-label': t.nev + ': a kezelés videója' }, h('source', { src: k.video.src, type: 'video/mp4' })));
      } else {
        media.appendChild(h('figure', { class: 'ah-kez-hamarosan' },
          poszter ? h('img', { src: kepUt(poszter), alt: (t.vizual && t.vizual.alt) || '', loading: 'lazy', decoding: 'async' }) : null,
          h('figcaption', { text: 'A kezelés videója hamarosan itt lesz.' })));
      }
    }
    atvetelRender();
  }
  function osszesitoRender() {
    var t = termek(S.termek);
    if (!t) return;
    $('ah-osszesito-nev').textContent = t.kartya_cim;
    kepBeallit($('ah-osszesito-kep'), t);
    var lista = uresit($('ah-osszesito-lista'));
    t.tartalom.filter(function (s) { return !/felhasználható/.test(s); }).forEach(function (sor) { lista.appendChild(listaSor(sor)); });
    lista.appendChild(h('li', null, ikonSpan(S.atvetel === 'otthon' ? 'mail' : 'store'), h('span', { text: S.atvetel === 'otthon' ? 'Kártya e-mailben' : 'Papír kártya a szalonban' })));
    $('ah-osszesito-forma').textContent = S.atvetel === 'otthon' ? 'Digitális ajándékkártya' : 'Átvétel a szalonban';
    var ar = A.arSzoveg(t.ar_ft);
    $('ah-osszesito-ar').textContent = ar;
    $('ah-osszesito-fej-ar').textContent = ar;
    var atv = atvetelOpcio().cim;
    if (S.atvetel === 'otthon' && !S.tervezo.kihagyva) atv += ' (személyre szabott: ' + temaNev(S.tervezo.tema) + ')';
    $('ah-osszesito-atvetel').textContent = 'Átvétel: ' + atv;
  }

  // ---------------------------------------------------------------- vendeg-videok (valodi testimonial videok, modalis lejatszo)
  function vendegVideok() {
    var abl = $('ah-video-ablak'), v = $('ah-video'), bezar = $('ah-video-bezar');
    if (!abl || !v || !bezar) return;
    function leall() { try { v.pause(); } catch (e) { /* nem baj */ } v.removeAttribute('src'); try { v.load(); } catch (e) { /* nem baj */ } }
    function lezar() { leall(); if (abl.close) abl.close(); else abl.removeAttribute('open'); }
    document.addEventListener('click', function (ev) {
      var g = ev.target.closest ? ev.target.closest('[data-vendeg]') : null;
      if (!g) return;
      v.setAttribute('src', g.getAttribute('data-vendeg'));
      // a lejatszo alakja a forras videohoz igazodik: alap 9:16 (vendeg-videok), data-forma="negyzet" 1:1, "szeles" 16:9
      var forma = g.getAttribute('data-forma') || (g.hasAttribute('data-szeles') ? 'szeles' : '');
      abl.classList.toggle('ah-szeles', forma === 'szeles');
      abl.classList.toggle('ah-negyzet', forma === 'negyzet');
      abl.setAttribute('aria-label', (g.getAttribute('data-nev') || 'Vendég') + ' videója');
      if (abl.showModal) abl.showModal(); else abl.setAttribute('open', '');
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* a vezerlokkel inditható */ });
    });
    bezar.addEventListener('click', lezar);
    // a hatterre (a doboz melletti sotet teruletre) kattintas is bezar
    abl.addEventListener('click', function (ev) { if (ev.target === abl) lezar(); });
    abl.addEventListener('close', leall);
  }

  // ---------------------------------------------------------------- atvetel: hogyan veszi at a kartyat (a fizetes elott)
  var ATVETEL_INFO = {
    otthon: 'Design, fotó és idézet is kerülhet rá.',
    szemelyesen: 'A MOSAIC saját designjával, a szalonban (Bécsi út 2.).'
  };
  function atvetelOpcio() {
    for (var i = 0; i < A.ATVETELEK.length; i++) if (A.ATVETELEK[i].id === S.atvetel) return A.ATVETELEK[i];
    return A.ATVETELEK[0];
  }
  function atvetelRender() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name="atvetel"]'), function (r) { r.checked = r.value === S.atvetel; });
    // a gomb azt mondja, hova visz: a személyre szabható (otthon nyomtatott) kártyánál a személyre szabóra, egyébként a vásárláshoz
    var felirat = $('ah-tovabb-gomb') && $('ah-tovabb-gomb').firstElementChild;
    if (felirat) felirat.textContent = (S.atvetel === 'otthon' && KT) ? 'Tovább a személyre szabáshoz' : 'Tovább a vásárláshoz';
  }
  function atvetelValaszt(id) {
    if (!A.ATVETELEK.some(function (x) { return x.id === id; })) return;
    S.atvetel = id;
    ment();
    atvetelRender();
  }
  function tovabbGomb() {
    if (!S.termek || S.allapot === 'bongeszes') kivalaszt(kijelzett());
    if (S.atvetel === 'otthon' && window.AJANDEK_KARTYA) tervezoNyit(); else fizetesre();
  }

  // ---------------------------------------------------------------- mini szemelyre szabo (csak az otthon kinyomtatott kartyahoz)
  // Dizajn + foto + idezet + nev, elo elonezettel. A kartya HTML-jet/CSS-et a szerver is ugyanebbol (ajandek-kartya.js) rajzolja,
  // igy az elonezet = a kinyomtatott kartya. A fotot a "Tovabb" gomb feltolti (POST /api/ajandek/foto), a fizetes csak az azonositot kuldi.
  var tervezoKesz = false;
  var fotoBlob = null;      // a feldolgozott (<= 1600 px) JPEG
  var fotoUrl = null;       // blob: URL az elonezethez
  var fotoAdat = null;      // ugyanez dataURL-ben (sessionStorage / feltoltes)
  function ujTervezo(m) {
    m = (m && typeof m === 'object') ? m : {};
    return {
      tema: KT && KT.tema(m.tema) ? m.tema : (KT ? KT.TEMAK[0].id : 'smaragd'),
      idezet: String(m.idezet || '').slice(0, 160),
      nev: String(m.nev || '').slice(0, 40),
      fotoId: typeof m.fotoId === 'string' ? m.fotoId : null,
      fotoPoz: KT ? KT.pozOlvas(KT.pozIr(m.fotoPoz)) : { x: 50, y: 50, z: 1 },
      kihagyva: !!m.kihagyva
    };
  }
  function fotoTarolasOlvas() { try { return sessionStorage.getItem('ah_foto') || null; } catch (e) { return null; } }
  function fotoTarolasIr(adat) {
    try { if (adat) sessionStorage.setItem('ah_foto', adat); else sessionStorage.removeItem('ah_foto'); } catch (e) { /* tul nagy / privat ablak: a foto csak ebben az oldalbetoltesben el */ }
  }
  function fotoBeallit(blob, adat) {
    if (fotoUrl) { try { URL.revokeObjectURL(fotoUrl); } catch (e) { /* nem baj */ } }
    fotoBlob = blob || null;
    fotoUrl = blob ? URL.createObjectURL(blob) : null;
    fotoAdat = adat || null;
  }
  function fotoVisszaallit() {
    var adat = fotoTarolasOlvas();
    if (!adat || fotoBlob) return Promise.resolve();
    return fetch(adat).then(function (r) { return r.blob(); }).then(function (b) { fotoBeallit(b, adat); }).catch(function () { fotoTarolasIr(null); });
  }
  function blobAdatba(blob) {
    return new Promise(function (ok, rossz) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result)); };
      fr.onerror = function () { rossz(new Error('olvasas')); };
      fr.readAsDataURL(blob);
    });
  }
  function kepDekodolImg(fajl) {
    return new Promise(function (ok, rossz) {
      var u = URL.createObjectURL(fajl), i = new Image();
      i.onload = function () { URL.revokeObjectURL(u); ok(i); };
      i.onerror = function () { URL.revokeObjectURL(u); rossz(new Error('kep')); };
      i.src = u;
    });
  }
  function kepDekodol(fajl) {
    if (window.createImageBitmap) return createImageBitmap(fajl, { imageOrientation: 'from-image' }).catch(function () { return kepDekodolImg(fajl); });
    return kepDekodolImg(fajl);
  }
  function fotoBetolt(fajl) {
    hibaMezo('ah-foto-hiba', '');
    if (!fajl) return;
    if (!/^image\//.test(fajl.type || '') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(fajl.name || '')) { hibaMezo('ah-foto-hiba', 'Ez nem képfájl. Válassz egy JPG vagy PNG képet.'); return; }
    if (fajl.size > 30 * 1024 * 1024) { hibaMezo('ah-foto-hiba', 'Ez a kép túl nagy (legfeljebb 30 MB).'); return; }
    kepDekodol(fajl).then(function (forras) {
      var w = forras.naturalWidth || forras.width, hh = forras.naturalHeight || forras.height;
      var sk = Math.min(1, 1600 / Math.max(w, hh));
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * sk)); cv.height = Math.max(1, Math.round(hh * sk));
      var cx = cv.getContext('2d');
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      cx.drawImage(forras, 0, 0, cv.width, cv.height);
      if (forras.close) forras.close();
      return new Promise(function (ok, rossz) { cv.toBlob(function (b) { if (b) ok(b); else rossz(new Error('blob')); }, 'image/jpeg', 0.86); });
    }).then(function (blob) {
      fotoBeallit(blob, null);
      S.tervezo.fotoId = null;
      S.tervezo.fotoPoz = { x: 50, y: 50, z: 1 };
      tervezoRender();
      ment();
      return blobAdatba(blob).then(function (adat) { fotoAdat = adat; fotoTarolasIr(adat); });
    }).catch(function () { hibaMezo('ah-foto-hiba', 'A képet nem sikerült megnyitni. Próbálj másik képet (JPG vagy PNG).'); });
  }
  function fotoTorol() {
    fotoBeallit(null, null);
    fotoTarolasIr(null);
    S.tervezo.fotoId = null;
    S.tervezo.fotoPoz = { x: 50, y: 50, z: 1 };
    $('ah-foto-fajl').value = '';
    tervezoRender();
    ment();
  }
  function fotoFeltolt() {
    var adat = fotoAdat ? Promise.resolve(fotoAdat) : blobAdatba(fotoBlob);
    return adat.then(function (d) { return api('foto', { json: { kep: d } }); }).then(function (v) {
      if (v.status === 200 && v.adat && v.adat.id) { S.tervezo.fotoId = v.adat.id; ment(); return; }
      var e = new Error('foto'); e.statusz = v.status; throw e;
    });
  }

  function kartyaAdat() {
    var t = termek(S.termek) || {};
    return {
      tema: S.tervezo.tema, idezet: S.tervezo.idezet, nev: S.tervezo.nev, fotoSrc: fotoUrl, fotoPoz: S.tervezo.fotoPoz,
      felirat: t.kartya_felirat, ertek: t.ar_ft ? A.arSzoveg(t.ar_ft) : '', kod: null, ervenyes: null, minta: true
    };
  }
  function temaMiniek() {
    if (!KT) return;
    KT.TEMAK.forEach(function (t) {
      var kep = document.querySelector('[data-tema-gomb="' + t.id + '"] .ah-tema-kep');
      if (!kep) return;
      var adat = kartyaAdat(); adat.tema = t.id; adat.oldal = 'elol';   // a design-valasztoban csak az elolap latszik
      kep.innerHTML = KT.html(adat);
    });
  }
  // mobilon a design-valaszto legordulo: a gomb a kivalasztott design mini kepet + nevet mutatja, a racs lenyilik
  function temaNyitFrissit() {
    var kep = $('ah-tema-nyit-kep'), nev = $('ah-tema-nyit-nev');
    if (!kep || !nev || !KT) return;
    var adat = kartyaAdat(); adat.tema = S.tervezo.tema; adat.oldal = 'elol';
    kep.innerHTML = KT.html(adat);
    nev.textContent = temaNev(S.tervezo.tema);
  }
  function temaLegordul(nyit) {
    var tv = $('ah-tv-design'), g = $('ah-tema-nyit');
    if (!tv || !g) return;
    tv.classList.toggle('ah-tema-nyitva', !!nyit);
    g.setAttribute('aria-expanded', nyit ? 'true' : 'false');
  }
  function tervezoRender() {
    if (!KT) return;
    $('ah-ak-elonezet').innerHTML = KT.html(kartyaAdat());
    var racs = $('ah-tema-racs');
    if (!tervezoKesz) {
      uresit(racs);
      KT.TEMAK.forEach(function (t) {
        racs.appendChild(h('button', { type: 'button', class: 'ah-tema', role: 'radio', 'data-tema-gomb': t.id, 'aria-checked': 'false', 'aria-label': t.nev + ' design' },
          h('span', { class: 'ah-tema-kep' }), h('span', { class: 'ah-tema-nev', text: t.nev })));
      });
      tervezoKesz = true;
    }
    Array.prototype.forEach.call(racs.querySelectorAll('[data-tema-gomb]'), function (b) {
      var az = b.getAttribute('data-tema-gomb') === S.tervezo.tema;
      b.setAttribute('aria-checked', az ? 'true' : 'false');
      b.classList.toggle('ah-tema-valasztott', az);
    });
    temaMiniek();
    temaNyitFrissit();
    var van = !!fotoUrl;
    $('ah-foto-blokk').hidden = !S.fotoLehet;
    $('ah-foto-torol').hidden = !van;
    $('ah-zoom-sor').hidden = !van;
    $('ah-mozgat').hidden = !van;
    $('ah-mozgat-seg').hidden = !van;
    $('ah-zoom').value = String(S.tervezo.fotoPoz.z);
    // mobilon a rovid szoveg ("Másik fotó") latszik, hogy a gomb a cim mellett elferjen
    $('ah-foto-gomb-szoveg').innerHTML = van ? 'Másik fotó<span class="ah-m-hosszu"> választása</span>' : 'Fotó<span class="ah-m-hosszu"> feltöltése</span>';
    $('ah-ak-elonezet').classList.toggle('ah-foto-van', van);
    // az első fotó után egy rövid jelzés a kártyán: a fotó húzással is igazítható
    if (van && !huzasJelezve && !$('ah-ak-elonezet').querySelector('.ah-huz-jelzo')) {
      $('ah-ak-elonezet').appendChild(h('span', { class: 'ah-huz-jelzo', 'aria-hidden': 'true', text: '✥ Húzd a fotót az igazításhoz' }));
    }
  }
  function tervezoMezokTolt() {
    $('ah-idezet').value = S.tervezo.idezet;
    $('ah-tervezo-nev').value = S.tervezo.nev;
  }
  function tervezoNyit() {
    if (!S.termek) return;
    if (allapotba('tervezo')) {
      try { history.pushState({ ah: 'tervezo' }, '', location.pathname + location.search + '#szemelyre-szabas'); } catch (e) { /* nem baj */ }
    }
  }
  function tervezoKihagy() {
    S.tervezo.kihagyva = true;
    ment();
    fizetesre();
  }
  function tervezoTovabb() {
    var tv = S.tervezo;
    tv.idezet = ($('ah-idezet').value || '').split('\n').slice(0, 5).join('\n').trim().slice(0, KT.IDEZET_MAX);
    tv.nev = ($('ah-tervezo-nev').value || '').trim().slice(0, KT.NEV_MAX);
    $('ah-ajandekozott').value = tv.nev;
    tv.kihagyva = !(fotoUrl || tv.idezet || tv.nev); // semmit nem adott meg: a MOSAIC alap kartyaja
    hibaMezo('ah-tervezo-hiba', '');
    var gomb = $('ah-tervezo-tovabb'), felirat = $('ah-tervezo-tovabb-szoveg');
    function vissza() { gomb.disabled = false; felirat.textContent = 'Tovább a fizetéshez'; }
    if (fotoUrl && !tv.fotoId) {
      gomb.disabled = true; felirat.textContent = 'Fotó feltöltése…';
      fotoFeltolt().then(function () { vissza(); ment(); fizetesre(); }).catch(function (e) {
        vissza();
        hibaMezo('ah-tervezo-hiba', e && e.statusz === 503
          ? 'A fotó feltöltése most nem érhető el. Töröld a fotót, vagy próbáld újra később.'
          : 'A fotót nem sikerült feltölteni. Próbáld újra, vagy töröld a fotót és folytasd nélküle.');
      });
      return;
    }
    ment();
    fizetesre();
  }
  // A fotokivagas: a kartyan a fotohely (.ak-ablak) tartalma object-position + scale; a huzas a tartalmat koveti
  var huzas = null;
  var huzasMozdult = false;   // a legutobbi erintes huzas volt-e (akkor nem nyilik meg a nagyitas)
  var huzasJelezve = false;   // az "Húzd a fotót" jelzés az első mozgatás / nagyítás után eltűnik
  var mozgatIdo = null;
  function huzasJelzoEltun() {
    huzasJelezve = true;
    var j = document.querySelector('#ah-ak-elonezet .ah-huz-jelzo');
    if (j && j.parentNode) j.parentNode.removeChild(j);
  }
  // a fotó áthelyezése nyilakkal: dx = +1 -> a fotó jobbra megy (a fókuszpont balra), dy = +1 -> a fotó fel megy; a nagyított kép mozgási tere 0..100 %
  function fotoMozgat(dx, dy) {
    var p = S.tervezo.fotoPoz;
    p.x = Math.min(100, Math.max(0, p.x - dx * 10));
    p.y = Math.min(100, Math.max(0, p.y - dy * 10));
    huzasJelzoEltun();
    fotoStilus();
    clearTimeout(mozgatIdo);
    mozgatIdo = setTimeout(function () { ment(); temaMiniek(); }, 250);
  }
  function fotoStilus() {
    var p = S.tervezo.fotoPoz;
    Array.prototype.forEach.call(document.querySelectorAll('#ah-ak-elonezet .ak-ablak img'), function (i) {
      i.style.objectPosition = p.x + '% ' + p.y + '%';
      i.style.transformOrigin = p.x + '% ' + p.y + '%';
      i.style.transform = 'scale(' + p.z + ')';
    });
  }
  // A kartya-elonezet nagyitasa: nagy kartya egy ablakban (asztalon a kepernyohoz illesztve, mobilon ujjal mozgathato, a kartya a kepernyonel nagyobb)
  var nagyFordit = false;
  function kartyaNagyRender() {
    var d = kartyaAdat();
    d.oldal = nagyFordit ? 'hat' : 'elol';
    $('ah-ak-nagy-kartya').innerHTML = KT.html(d);
    $('ah-ak-nagy-fordit-szoveg').textContent = nagyFordit ? 'Vissza az előlapra' : 'Fordítsd meg a kártyát';
  }
  function kartyaNagyit() {
    var abl = $('ah-ak-nagy');
    if (!KT || !abl) return;
    nagyFordit = $('ah-ak-elonezet').classList.contains('ah-megfordit');
    kartyaNagyRender();
    if (abl.showModal) abl.showModal(); else abl.setAttribute('open', '');
    var g = $('ah-ak-nagy-gorgeto');
    g.scrollLeft = (g.scrollWidth - g.clientWidth) / 2;
    g.scrollTop = (g.scrollHeight - g.clientHeight) / 2;
    fokusz($('ah-ak-nagy-bezar'));
  }
  function nagyitasBekot() {
    var abl = $('ah-ak-nagy');
    if (!abl) return;
    function zar() { if (abl.close) { if (abl.open) abl.close(); } else abl.removeAttribute('open'); }
    $('ah-ak-nagy-bezar').addEventListener('click', zar);
    $('ah-ak-nagy-fordit').addEventListener('click', function () { nagyFordit = !nagyFordit; kartyaNagyRender(); });
    // az ablak ures reszere kattintva bezarul
    abl.addEventListener('click', function (ev) { if (ev.target === abl || ev.target === $('ah-ak-nagy-gorgeto')) zar(); });
    abl.addEventListener('close', function () { var n = $('ah-nagyit'); if (n && n.focus) { try { n.focus({ preventScroll: true }); } catch (e) { /* nem baj */ } } });
  }
  function tervezoBekot() {
    var doboz = $('ah-ak-elonezet');
    // a kartya megfordithato: csak az elolap latszik, alatta egy "Forditsd meg" link a hatoldalhoz (3D forgatas)
    var fordit = $('ah-fordit');
    if (fordit) fordit.addEventListener('click', function () {
      var meg = doboz.classList.toggle('ah-megfordit');
      fordit.setAttribute('aria-pressed', meg ? 'true' : 'false');
      $('ah-fordit-szoveg').textContent = meg ? 'Vissza az előlapra' : 'Fordítsd meg a kártyát';
    });
    doboz.addEventListener('pointerdown', function (ev) {
      var abl = ev.target.closest ? ev.target.closest('.ak-ablak') : null;
      var kep = abl && abl.querySelector('img');
      if (!kep || !fotoUrl) return;
      var r = abl.getBoundingClientRect();
      huzasMozdult = false;
      huzas = { x: ev.clientX, y: ev.clientY, mozdult: false, fw: r.width, fh: r.height, nw: kep.naturalWidth || 1, nh: kep.naturalHeight || 1, p0: { x: S.tervezo.fotoPoz.x, y: S.tervezo.fotoPoz.y } };
      try { doboz.setPointerCapture(ev.pointerId); } catch (e) { /* nem baj */ }
      doboz.classList.add('ah-huz');
      huzasJelzoEltun();
      ev.preventDefault();
    });
    doboz.addEventListener('pointermove', function (ev) {
      if (!huzas) return;
      var q = huzas, z = S.tervezo.fotoPoz.z;
      if (Math.abs(ev.clientX - q.x) + Math.abs(ev.clientY - q.y) > 6) q.mozdult = true;
      var s = Math.max(q.fw / q.nw, q.fh / q.nh), iw = q.nw * s, ih = q.nh * s;
      var dxk = z * iw - q.fw, dyk = z * ih - q.fh; // a nagyitott kep teljes "mozgastere"
      var nx = dxk > 1 ? q.p0.x - (ev.clientX - q.x) * 100 / dxk : q.p0.x;
      var ny = dyk > 1 ? q.p0.y - (ev.clientY - q.y) * 100 / dyk : q.p0.y;
      S.tervezo.fotoPoz.x = Math.min(100, Math.max(0, nx));
      S.tervezo.fotoPoz.y = Math.min(100, Math.max(0, ny));
      fotoStilus();
    });
    function vege() {
      if (!huzas) return;
      huzasMozdult = !!huzas.mozdult;
      huzas = null;
      doboz.classList.remove('ah-huz');
      ment();
      temaMiniek();
    }
    doboz.addEventListener('pointerup', vege);
    doboz.addEventListener('pointercancel', vege);
    // rakattintas (nem huzas) = nagyitas; a sarokban egy nagyito gomb is van
    doboz.addEventListener('click', function () { if (huzasMozdult) { huzasMozdult = false; return; } kartyaNagyit(); });
    $('ah-nagyit').addEventListener('click', kartyaNagyit);
    nagyitasBekot();

    $('ah-tema-racs').addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-tema-gomb]') : null;
      if (!b) return;
      S.tervezo.tema = b.getAttribute('data-tema-gomb');
      ment();
      tervezoRender();
      temaLegordul(false);
    });
    $('ah-tema-nyit').addEventListener('click', function () { temaLegordul(!$('ah-tv-design').classList.contains('ah-tema-nyitva')); });
    document.addEventListener('click', function (ev) { var tv = $('ah-tv-design'); if (tv && tv.classList.contains('ah-tema-nyitva') && !(ev.target.closest && ev.target.closest('#ah-tv-design'))) temaLegordul(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && $('ah-tv-design') && $('ah-tv-design').classList.contains('ah-tema-nyitva')) { temaLegordul(false); fokusz($('ah-tema-nyit')); } });
    $('ah-foto-gomb').addEventListener('click', function () { $('ah-foto-fajl').click(); });
    $('ah-foto-fajl').addEventListener('change', function () { fotoBetolt(this.files && this.files[0]); });
    $('ah-foto-torol').addEventListener('click', fotoTorol);
    $('ah-zoom').addEventListener('input', function () {
      S.tervezo.fotoPoz.z = Math.min(3, Math.max(1, Number(this.value) || 1));
      huzasJelzoEltun();
      fotoStilus();
    });
    $('ah-zoom').addEventListener('change', function () { ment(); temaMiniek(); });
    $('ah-mozgat').addEventListener('click', function (ev) {
      var gomb = ev.target.closest ? ev.target.closest('button[data-irany]') : null;
      if (!gomb) return;
      var d = gomb.getAttribute('data-irany').split(',');
      fotoMozgat(Number(d[0]) || 0, Number(d[1]) || 0);
    });
    var idozito = null;
    $('ah-idezet').addEventListener('input', function () {
      // legfeljebb 5 sor: a szoveg a dizajn biztonsagos teruleten belul marad
      var sorok = (this.value || '').split('\n');
      if (sorok.length > 5) this.value = sorok.slice(0, 5).join('\n');
      S.tervezo.idezet = (this.value || '').slice(0, KT.IDEZET_MAX);
      clearTimeout(idozito);
      idozito = setTimeout(function () { ment(); tervezoRender(); }, 120);
    });
    $('ah-tervezo-nev').addEventListener('input', function () {
      S.tervezo.nev = (this.value || '').slice(0, KT.NEV_MAX);
      $('ah-ajandekozott').value = S.tervezo.nev;
      clearTimeout(idozito);
      idozito = setTimeout(function () { ment(); tervezoRender(); }, 120);
    });
    $('ah-tervezo-tovabb').addEventListener('click', tervezoTovabb);
    $('ah-tervezo-kihagy').addEventListener('click', tervezoKihagy);
    $('ah-tervezo-vissza').addEventListener('click', function () {
      if (history.state && history.state.ah === 'tervezo') history.back(); else allapotba('kivalasztva');
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="atvetel"]'), function (r) {
      r.addEventListener('change', function () { if (this.checked) atvetelValaszt(this.value); });
    });
  }
  function temaNev(id) { var t = KT && KT.tema(id); return t ? t.nev : ''; }

  // ---------------------------------------------------------------- Checkout
  var stripeAdapter = { stripe: null, elements: null, elem: null, betoltes: null, osszeg: null };

  function stripeBetolt() {
    if (stripeAdapter.betoltes) return stripeAdapter.betoltes;
    stripeAdapter.betoltes = new Promise(function (ok, nem) {
      if (typeof window.Stripe === 'function') return ok(window.Stripe);
      var s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.async = true;
      s.onload = function () { typeof window.Stripe === 'function' ? ok(window.Stripe) : nem(new Error('stripe')); };
      s.onerror = function () { stripeAdapter.betoltes = null; nem(new Error('stripe')); };
      document.head.appendChild(s);
    });
    return stripeAdapter.betoltes;
  }
  function stripeElokeszit() {
    // a szandek (termekvalasztas) pillanataban elore betoltjuk, hogy a checkout azonnal kesz legyen
    if (S.mod === 'elo' || S.mod === 'teszt') stripeBetolt().catch(function () { /* a checkoutban jelezzuk */ });
  }
  function osszegFt() { var t = termek(S.termek); return t ? t.ar_ft : 0; }

  function fizetesiElemInit() {
    var t = termek(S.termek);
    if (!t) return Promise.resolve();
    var tarto = $('ah-fizetesi-elem');
    if (S.mod === 'nincs' || S.mod === 'betolt') {
      $('ah-nincs-fizetes').hidden = S.mod === 'betolt';
      fizModRender();
      return Promise.resolve();
    }
    return stripeBetolt().then(function (Stripe) {
      var osszeg = t.ar_ft * 100; // a Stripe HUF-ot is ezredekben szamolja: forint x 100
      if (stripeAdapter.elements) {
        if (stripeAdapter.osszeg !== osszeg) { stripeAdapter.elements.update({ amount: osszeg }); stripeAdapter.osszeg = osszeg; }
        return;
      }
      stripeAdapter.stripe = stripeAdapter.stripe || Stripe(S.publikusKulcs);
      stripeAdapter.elements = stripeAdapter.stripe.elements({
        mode: 'payment', amount: osszeg, currency: 'huf', locale: 'hu',
        appearance: {
          theme: 'stripe',
          variables: { colorPrimary: '#244a4d', colorBackground: '#ffffff', colorText: '#243436', colorDanger: '#8f3b2e', fontFamily: 'Jost, "Helvetica Neue", Arial, sans-serif', borderRadius: '12px', spacingUnit: '4px' }
        }
      });
      stripeAdapter.osszeg = osszeg;
      stripeAdapter.elem = stripeAdapter.elements.create('payment', {
        // fulek a kartya-urlap felett: a kartya alapbol kivalasztva, a Revolut Pay es a Google Pay mellette, mindig lathatoan (nem az urlap alatt)
        layout: { type: 'tabs', defaultCollapsed: false },
        paymentMethodOrder: ['card', 'revolut_pay', 'google_pay'],
        // a szamlazasi adatokat (nev, e-mail, cim) mi kerjuk be es adjuk at a megerositeskor
        fields: { billingDetails: { name: 'never', email: 'never', address: 'never' } }
      });
      stripeAdapter.elem.on('change', function (e) {
        S.elemKesz = !!(e && e.complete);
        S.fizMod = e && e.value && e.value.type ? e.value.type : null;
        if (e && e.error) { hibaMezo('ah-fizetes-hiba', e.error.message); } else hibaMezo('ah-fizetes-hiba', '');
      });
      stripeAdapter.elem.mount(tarto);
    }).catch(function () {
      $('ah-nincs-fizetes').hidden = false;
      S.stripeHiba = true;
      fizModRender();
    });
  }

  // telefonszam: a szerver (telefonTisztit) is ugyanezt koveteli
  function telefonOk(v) {
    var db = v.replace(/\D/g, '').length;
    return /^\+?[0-9][0-9 ()\/.-]{5,24}$/.test(v) && db >= 8 && db <= 15;
  }
  // [kulcs, mezo-id, ellenorzo, (feltetel: csak akkor kotelezo)]
  var MEZOK = [
    ['ajandekozott', 'ah-ajandekozott', function (v) { return v.length >= 2 ? '' : 'Add meg az ajándékozott nevét.'; }],
    ['nev', 'ah-nev', function (v) { return v.length >= 3 ? '' : 'Kérjük, add meg a számlázási nevet.'; }],
    ['email', 'ah-email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Kérjük, adj meg érvényes e-mail címet.'; }],
    ['telefon', 'ah-telefon', function (v) { return telefonOk(v) ? '' : 'Átutalásnál add meg a telefonszámod (legalább 8 számjegy).'; }, function () { return S.fiz === 'atutalas'; }],
    ['iranyitoszam', 'ah-iranyitoszam', function (v) { return /^[0-9]{4}$/.test(v) ? '' : 'Négyjegyű irányítószámot adj meg.'; }],
    ['varos', 'ah-varos', function (v) { return v.length >= 2 ? '' : 'Kérjük, add meg a várost.'; }],
    ['cim', 'ah-cim', function (v) { return v.length >= 4 ? '' : 'Kérjük, add meg az utcát és a házszámot.'; }]
  ];
  function hibaMezo(az, uzenet) {
    var e = $(az);
    if (!e) return;
    e.textContent = uzenet || '';
    e.hidden = !uzenet;
  }
  function urlapOlvas() {
    var o = {};
    MEZOK.forEach(function (m) { o[m[0]] = ($(m[1]).value || '').trim(); });
    o.ceges_nev = ($('ah-ceges-nev').value || '').trim();
    o.ceges_adoszam = ($('ah-ceges-adoszam').value || '').trim();
    return o;
  }
  function urlapMent() { S.urlap = urlapOlvas(); ment(); }
  function urlapTolt() {
    var u = S.urlap || {};
    MEZOK.forEach(function (m) { if (u[m[0]] && !$(m[1]).value) $(m[1]).value = u[m[0]]; });
    // az ajandekozott neve a szemelyre szabo nevevel egy: a kozos allapot a S.tervezo.nev
    if (!$('ah-ajandekozott').value && S.tervezo.nev) $('ah-ajandekozott').value = S.tervezo.nev;
    if (u.ceges_nev && !$('ah-ceges-nev').value) { $('ah-ceges-nev').value = u.ceges_nev; $('ah-ceges').open = true; }
    if (u.ceges_adoszam && !$('ah-ceges-adoszam').value) $('ah-ceges-adoszam').value = u.ceges_adoszam;
  }
  function validal() {
    var o = urlapOlvas(), elso = null, hibak = {};
    MEZOK.forEach(function (m) {
      var uzenet = m[3] && !m[3]() ? '' : m[2](o[m[0]]);
      hibaMezo(m[1] + '-hiba', uzenet);
      $(m[1]).classList.toggle('ah-hibas', !!uzenet);
      $(m[1]).setAttribute('aria-invalid', uzenet ? 'true' : 'false');
      if (uzenet) { hibak[m[0]] = uzenet; if (!elso) elso = $(m[1]); }
    });
    // ceges szamla: a ketto egyutt kell (a szerver is igy ellenorzi)
    var cegesHiba = (o.ceges_nev || o.ceges_adoszam) && !(o.ceges_nev && o.ceges_adoszam)
      ? 'Céges számlához add meg a cégnevet és az adószámot is.' : '';
    hibaMezo('ah-ceges-hiba', cegesHiba);
    if (cegesHiba) { $('ah-ceges').open = true; if (!elso) elso = $(o.ceges_nev ? 'ah-ceges-adoszam' : 'ah-ceges-nev'); }
    if (elso) { gorgess(elso, 'center'); fokusz(elso); return null; }
    return o;
  }
  function szamlazasiAdat(o) {
    return {
      termek: S.termek, ajandekozott: o.ajandekozott, email: o.email, nev: o.nev, iranyitoszam: o.iranyitoszam, varos: o.varos, cim: o.cim,
      ceges: (o.ceges_nev || o.ceges_adoszam) ? { nev: o.ceges_nev, adoszam: o.ceges_adoszam } : null,
      attr: Object.assign({}, kozosParam(), { oldal: S.attr.oldal }),
      atvetel: S.atvetel,
      szemelyre: szemelyreMezok()
    };
  }
  // az otthon nyomtatott kartya szemelyre szabasa (ha a vevo adott meg valamit): a szerver ezeket a metadata-ba irja
  function szemelyreMezok() {
    if (S.atvetel !== 'otthon' || S.tervezo.kihagyva || !KT) return null;
    var tv = S.tervezo, m = { tema: tv.tema, idezet: tv.idezet, nev: tv.nev };
    if (tv.fotoId) { m.foto_id = tv.fotoId; m.foto_poz = KT.pozIr(tv.fotoPoz); }
    return m;
  }

  function api(utvonal, opciok) {
    opciok = opciok || {};
    var kerek = { method: opciok.method || 'GET', headers: {}, credentials: 'same-origin' };
    if (opciok.json) { kerek.method = 'POST'; kerek.headers['content-type'] = 'application/json'; kerek.body = JSON.stringify(opciok.json); }
    return fetch(API + utvonal, kerek).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (adat) { return { status: r.status, adat: adat }; });
    });
  }

  // ---------------------------------------------------------------- fizetes: beküldés (dupla beküldés ellen vedett)
  function fizetesBekuldes(ev) {
    ev.preventDefault();
    if (S.folyamatban) return;
    if (S.allapot !== 'fizetes' && S.allapot !== 'hiba') return;
    var o = validal();
    if (!o) return;
    if ($('ah-csapda').value) return; // robot
    if (S.fiz === 'atutalas') return atutalasKuldes(o);
    if ((S.mod !== 'elo' && S.mod !== 'teszt') || !stripeAdapter.elements) { $('ah-nincs-fizetes').hidden = false; return; }
    S.folyamatban = true;
    S.urlap = o;
    // a Stripe megkoveteli, hogy az elements.submit() a felhasznaloi esemeny soran, kesleltetes nelkul fusson
    var elokeszites = stripeAdapter.elements.submit();
    allapotba('feldolgozas');
    hibaSavElrejt();
    Promise.resolve(elokeszites).then(function (r) {
      if (r && r.error) { hibaMezo('ah-fizetes-hiba', r.error.message); S.folyamatban = false; allapotba('fizetes'); return null; }
      mer('add_payment_info', { ecommerce: { currency: A.PENZNEM, value: osszegFt(), payment_type: S.fizMod || 'card', items: [tetel(termek(S.termek))] }, product_type: termek(S.termek).product_type, payment_method: S.fizMod || 'card' });
      var kerelem = szamlazasiAdat(o);
      kerelem.kulcs = veletlen();
      if (S.pi && S.cs) { kerelem.pi = S.pi; kerelem.cs = S.cs; }
      kerelem['bot-field'] = '';
      return api('fizetes', { json: kerelem }).then(function (v) {
        if (v.status !== 200 || !v.adat.client_secret) {
          var e = new Error('szerver'); e.szerver = v; throw e;
        }
        // ebben a munkamenetben inditjuk ennek a PaymentIntentnek a fizeteset: csak ekkor mehet ki rola purchase
        S.pi = v.adat.pi; S.cs = v.adat.client_secret; S.rt = null; S.csakOlvas = false; S.fizetesInditva = S.pi; ment();
        return stripeAdapter.stripe.confirmPayment({
          elements: stripeAdapter.elements,
          clientSecret: S.cs,
          confirmParams: {
            return_url: location.origin + location.pathname + '?variant=' + encodeURIComponent(S.variant.variant_id),
            payment_method_data: { billing_details: { name: o.nev, email: o.email, address: { line1: o.cim, line2: '', city: o.varos, state: '', postal_code: o.iranyitoszam, country: 'HU' } } }
          },
          redirect: 'if_required'
        });
      }).then(function (eredmeny) {
        if (!eredmeny) return;
        if (eredmeny.error) {
          var tipus = eredmeny.error.type;
          if (tipus === 'validation_error') { hibaMezo('ah-fizetes-hiba', eredmeny.error.message); S.folyamatban = false; allapotba('fizetes'); return; }
          hibaAllapot(eredmeny.error.message);
          return;
        }
        return fizetesEllenorzes(S.pi, S.cs, 25000);
      });
    }).catch(function (e) {
      try { console.error('ajandek: a fizetes megszakadt', e); } catch (x) { /* nem baj */ }
      var uzenet = 'Hálózati vagy szerverhiba történt. Kérjük, próbáld újra.';
      if (e && e.szerver && e.szerver.status === 429) uzenet = 'Túl sok próbálkozás történt. Kérjük, várj pár percet, és próbáld újra, vagy hívj minket: 06 20 247 4444.';
      if (e && e.szerver && e.szerver.adat && e.szerver.adat.mezok) {
        S.folyamatban = false; allapotba('fizetes');
        var mz = e.szerver.adat.mezok;
        var szHiba = Object.keys(mz).filter(function (k) { return k === 'foto' || k === 'atvetel' || k.indexOf('szemelyre') === 0; });
        if (szHiba.length) {
          if (mz.foto || mz['szemelyre.foto']) { S.tervezo.fotoId = null; ment(); }
          hibaMezo('ah-fizetes-hiba', mz.foto || mz['szemelyre.foto'] || 'A személyre szabott kártya adatai nem érvényesek: lépj vissza a személyre szabáshoz, és ellenőrizd őket.');
          return;
        }
        var latszik = false;
        Object.keys(e.szerver.adat.mezok).forEach(function (k) {
          var az = k.indexOf('ceges') === 0 ? 'ah-ceges-hiba' : 'ah-' + k + '-hiba';
          if ($(az)) { hibaMezo(az, e.szerver.adat.mezok[k]); latszik = true; }
        });
        if (!latszik) hibaMezo('ah-fizetes-hiba', 'Ellenőrizd a megadott adatokat, majd próbáld újra.');
        return;
      }
      hibaAllapot(uzenet);
    });
  }

  // a rendeles lekerdezese: fizetes utan a client_secrettel, a levelbeli linkkel nyitott (csak olvasasi) nezetben a rt-tokennel
  function rendelesUt() {
    return 'rendeles?pi=' + encodeURIComponent(S.pi) + '&' + (S.csakOlvas ? 'rt=' + encodeURIComponent(S.rt) : 'cs=' + encodeURIComponent(S.cs));
  }

  // a szerver (nem a bongeszo!) mondja meg, hogy fizetve van-e
  function fizetesEllenorzes(pi, cs, maxMs) {
    var vege = Date.now() + (maxMs || 25000);
    function kor() {
      return api('rendeles?pi=' + encodeURIComponent(pi) + '&cs=' + encodeURIComponent(cs)).then(function (v) {
        var r = v.adat || {};
        if (v.status === 200 && r.allapot === 'fizetve') { S.folyamatban = false; return sikerre(r); }
        if (v.status === 200 && r.allapot === 'sikertelen') { S.folyamatban = false; if (!S.termek && r.termek) S.termek = r.termek; return hibaAllapot(''); }
        if (Date.now() > vege) {
          S.folyamatban = false;
          if (r.allapot === 'feldolgozas') return fuggoben();
          return hibaAllapot('');
        }
        return new Promise(function (ok) { setTimeout(ok, 1500); }).then(kor);
      }).catch(function () {
        if (Date.now() > vege) { S.folyamatban = false; return hibaAllapot('Nem sikerült ellenőrizni a fizetést. Ha a kártyád megterhelődött, e-mailben megerősítést küldünk.'); }
        return new Promise(function (ok) { setTimeout(ok, 2000); }).then(kor);
      });
    }
    return kor();
  }
  function fuggoben() {
    // a fizetes meg feldolgozas alatt van (pl. kesleltetett fizetesi mod): nem hiba, nem purchase
    hibaSavBeallit(true);
    allapotba('hiba');
  }
  // fuggo = a fizetes feldolgozasa tart (ilyenkor nincs "ujra" gomb, hogy ne fizessen ketszer)
  function hibaSavBeallit(fuggo) {
    var sav = $('ah-hibasav');
    sav.querySelector('h3').textContent = fuggo ? 'A fizetésed feldolgozása még tart.' : 'A fizetés nem sikerült.';
    sav.querySelector('p').textContent = fuggo ? 'Amint megérkezik, e-mailben értesítünk. Ne fizess újra.' : 'Nem terheltük meg a kártyádat. Próbáld újra, vagy válassz másik fizetési módot.';
    sav.querySelector('.ah-gombsor').hidden = !!fuggo;
  }
  function hibaAllapot(reszlet) {
    S.folyamatban = false;
    hibaSavBeallit(false);
    $('ah-hibasav-resz').textContent = reszlet || '';
    allapotba('hiba');
  }
  function hibaSavElrejt() { $('ah-hibasav').hidden = true; }

  // "Ujra megprobalom": visszavisz a fizetesi modhoz - a fizetest NEM inditja el maga (egy elutasitott kartyat nem kuldunk el
  // ujra a vevo ujabb kattintasa nelkul); a megadott adatok es a kartya mezo megmaradnak
  function ujraProbal() {
    allapotba('fizetes');
    gorgess($('ah-fizetesi-doboz'), 'center');
    if (stripeAdapter.elem && stripeAdapter.elem.focus) stripeAdapter.elem.focus();
    else fokusz($('ah-fizet-gomb'));
  }
  function masikModra() {
    allapotba('fizetes');
    gorgess($('ah-fizmod'), 'center');
    var r = document.querySelector('input[name="fizmod"]:checked');
    if (r) fokusz(r);
  }

  // ---------------------------------------------------------------- fizetesi mod (kartya / atutalas)
  function fizModValaszt(m) {
    S.fiz = m === 'atutalas' ? 'atutalas' : 'kartya';
    hibaMezo('ah-fizetes-hiba', '');
    hibaMezo('ah-atu-hiba', '');
    hibaMezo('ah-telefon-hiba', '');
    $('ah-telefon').classList.remove('ah-hibas');
    fizModRender();
  }
  function fizModRender() {
    var at = S.fiz === 'atutalas', t = termek(S.termek);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="fizmod"]'), function (r) { r.checked = r.value === S.fiz; });
    $('ah-fizetesi-doboz').hidden = at;
    $('ah-atu-doboz').hidden = !at;
    $('ah-telefon-mezo').hidden = !at;
    $('ah-mezo-racs').classList.toggle('ah-tel-latszik', at);
    $('ah-atu-uzenet-mezo').hidden = !(at && S.atvetel === 'szemelyesen'); // otthon nyomtatott kartyanal az uzenet a szemelyre szabobol jon
    $('ah-biztonsag').hidden = at;
    $('ah-jogi-elo').textContent = at ? 'A megrendelés elküldésével' : 'A fizetés gombra kattintva';
    var ar = t ? A.arSzoveg(t.ar_ft) : '';
    $('ah-fizet-gomb').textContent = S.folyamatban
      ? (at ? 'Elküldjük a rendelésed…' : 'Feldolgozzuk a fizetésed…')
      : (at ? 'Rendelés elküldése — ' : 'Biztonságos fizetés — ') + ar;
    $('ah-fizet-gomb').disabled = S.allapot === 'feldolgozas' || S.atuKesz || (!at && (S.mod === 'nincs' || S.stripeHiba));
    $('ah-urlap-fizetes').classList.toggle('ah-atu-kesz', !!S.atuKesz);
    $('ah-urlap-fizetes').setAttribute('data-fiz', S.fiz);
    if (S.atuKesz) $('ah-urlap-adatok').setAttribute('inert', ''); else $('ah-urlap-adatok').removeAttribute('inert');
  }

  // ---------------------------------------------------------------- atutalas (NEM vasarlas)
  // Az utalasi igeny: a fizetesi mod valasztoban az "Atutalas" + a rendeles elkuldese. A szerver egy nyilvantartasi rekordot
  // hoz letre, es e-mailben elkuldi az utalasi adatokat; a kartyat a szalon az utalas beerkezese utan allitja ki.
  function atutalasKuldes(o) {
    if (S.folyamatban) return;
    S.folyamatban = true;
    S.urlap = o; ment();
    hibaMezo('ah-atu-hiba', '');
    fizModRender();
    var kerelem = szamlazasiAdat(o);
    kerelem['bot-field'] = $('ah-csapda').value;
    kerelem.telefon = o.telefon;
    if (S.atvetel !== 'otthon') kerelem.uzenet = ($('ah-atu-uzenet').value || '').trim();
    api('atutalas', { json: kerelem }).then(function (v) {
      if (v.status === 400 && v.adat && v.adat.mezok) {
        var m = v.adat.mezok, latszik = false;
        Object.keys(m).forEach(function (k) {
          var az = k.indexOf('ceges') === 0 ? 'ah-ceges-hiba' : 'ah-' + k + '-hiba';
          if ($(az)) { hibaMezo(az, m[k]); latszik = true; }
        });
        throw Object.assign(new Error('ervenytelen'), { uzenet: latszik ? 'Ellenőrizd a megjelölt adatokat.' : (m.uzenet || m.foto || m['szemelyre.foto'] || 'Ellenőrizd a megadott adatokat.') });
      }
      if (v.status !== 200 || !v.adat.ok) throw new Error('atutalas');
      S.folyamatban = false;
      atutalasKesz($('ah-atutalas'), o, v.adat.utalas || {});
    }).catch(function (e) {
      S.folyamatban = false;
      fizModRender();
      hibaMezo('ah-atu-hiba', (e && e.uzenet) || 'Nem sikerült elküldeni a rendelést. Próbáld újra, vagy hívj minket: 06 20 247 4444.');
    });
  }
  function atutalasKesz(panel, o, u) {
    uresit(panel);
    S.atuKesz = true;
    panel.appendChild(h('h3', { text: 'Elküldtük a rendelésed ✓' }));
    panel.appendChild(h('p', { text: 'Az utalási adatokat elküldtük a(z) ' + o.email + ' címre. Az ajándékkártyát az utalás beérkezése és visszaigazolása után állítjuk ki, és e-mailben küldjük, ezért nem érkezik azonnal.' }));
    var dl = h('dl', { class: 'ah-meta' });
    [['Kedvezményezett', u.kedvezmenyezett], ['Számlaszám', u.szamlaszam], ['Összeg', A.arSzoveg(u.osszeg_ft)], ['Közlemény', u.kozlemeny]].forEach(function (p) {
      dl.appendChild(h('div', null, h('dt', { text: p[0] }), h('dd', { text: p[1] || '' })));
    });
    panel.appendChild(dl);
    panel.appendChild(h('p', { class: 'ah-kicsi ah-halk', text: 'Fontos: a közleménybe pontosan a fenti azonosítót írd, így tudjuk párosítani az utalást. Ez még nem vásárlás: az ajándékkártya az utalás beérkezése után készül el.' }));
    panel.hidden = false;
    fizModRender();
    gorgess(panel, 'center');
    mer('bank_transfer_request', { ecommerce: { currency: A.PENZNEM, value: osszegFt(), items: [tetel(termek(S.termek))] }, product_type: termek(S.termek).product_type, payment_method: 'bank_transfer' });
  }

  // ---------------------------------------------------------------- PurchaseSuccess
  function sikerre(r) {
    S.rendeles = r;
    S.pi = S.pi || null;
    if (!S.termek && r.termek) S.termek = r.termek;
    purchaseMeres(r);
    S.fizetveIdo = Date.now();
    try { if (location.hash === '#fizetes') history.replaceState({}, '', location.pathname + location.search); } catch (e) { /* nem baj */ }
    S.utanAllapot = (S.utanAllapot === 'osszegzo' || S.atvetel === 'otthon') ? 'osszegzo' : 'szemelyre';
    allapotba('siker', { eroltet: true });
    if (S.utanAllapot === 'osszegzo') allapotba('osszegzo', { eroltet: true });
    else allapotba('szemelyre');
    kartyaFigyel();
  }
  // A dataLayer "purchase" esemeny: CSAK sikeres (a szerver altal a Stripe-tol visszakerdezett) fizetes utan, PaymentIntentenkent
  // EGYSZER. Nem megy ki: a fizetes inditasakor, oldalfrissiteskor, visszalepeskor, a levelbeli (csak olvasasi) link megnyitasakor,
  // es ha a fizetest nem ebben a munkamenetben inditottuk (pl. tovabbitott link masik eszkozon).
  function purchaseMeres(r) {
    var t = termek(r.termek) || termek(S.termek);
    if (!t || !S.pi || S.csakOlvas) return;
    if (S.fizetesInditva !== S.pi) return;
    var kulcs = 'ah_purchase_' + S.pi;
    if (helyiOlvas(kulcs)) return; // egy PaymentIntent csak egyszer purchase (frissites, visszalepes)
    helyiIr(kulcs, '1');
    var attrSrv = r.attr || {};
    // az ertek a SZERVER (Stripe) altal visszaigazolt brutto osszeg, nem a bongeszo konfigja
    var ertek = Number(r.osszeg) > 0 ? Number(r.osszeg) : t.ar_ft;
    var penznem = r.penznem || A.PENZNEM;
    var tet = tetel(t);
    tet.price = ertek;
    mer('purchase', {
      ecommerce: { transaction_id: S.pi, value: ertek, currency: penznem, items: [tet] },
      transaction_id: S.pi, value: ertek, currency: penznem,
      // event_id: a bongeszos es a szerveroldali (Meta / TikTok) esemeny ugyanazzal az azonositoval deduplikalhato
      event_id: S.pi,
      product_type: t.product_type, quantity: 1, payment_method: r.fizetesi_mod || 'card',
      variant_id: attrSrv.variant_id || S.variant.variant_id
    });
  }
  function metaSor(dl, cimke, ertek) { dl.appendChild(h('div', null, h('dt', { text: cimke }), h('dd', { text: ertek }))); }
  var HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
  // YYYY-MM-DD -> "2027. április 3-ig" (a -ig rag a 3-hoz: a mai napot is beleertve)
  function ervenyesSzoveg(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[1] + '. ' + HONAPOK[+m[2] - 1] + ' ' + (+m[3]) + '-ig' : null;
  }

  function sikerRender() {
    var r = S.rendeles;
    if (!r) return;
    var t = termek(r.termek) || termek(S.termek);
    var dl = uresit($('ah-siker-meta'));
    metaSor(dl, 'Ajándékkártya', r.kartya_cim || (t && t.kartya_cim) || '');
    metaSor(dl, 'Összeg', A.arSzoveg(r.osszeg));
    metaSor(dl, 'Rendelés', '#' + r.rendeles_id);
    metaSor(dl, 'E-mail', r.email || '');
    kartyaAllapotRender();
  }
  function kartyaAllapotRender() {
    var r = S.rendeles, hely = uresit($('ah-kartya-allapot'));
    if (!r) return;
    if (r.kartya && r.kartya.allapot === 'kesz' && r.kartya.url) {
      hely.appendChild(h('a', { class: 'ah-gomb ah-gomb-fo', href: r.kartya.url, target: '_blank', rel: 'noopener', text: 'Ajándékkártya letöltése' }));
      hely.appendChild(h('p', { class: 'ah-kartya-megjegyzes', text: 'Megnyílik a nyomtatható kártya: nyomtasd ki, vagy mentsd PDF-ként. E-mailben is elküldtük.' }));
    } else {
      hely.appendChild(h('div', { class: 'ah-keszul' }, h('span', { class: 'ah-forgo', 'aria-hidden': 'true' }), h('span', { text: 'Készítjük az ajándékkártyádat…' })));
      // a szalon kezzel allitja ki a kartyat (lasd AJANDEK.md): idoigeny nem igerheto, de a telefonszam mindig ott van
      hely.appendChild(h('p', { class: 'ah-kartya-megjegyzes', text: (S.azonnali ? 'Perceken belül itt és az e-mailedben is megjelenik.' : 'Elkészültekor itt megjelenik, és e-mailben is megkapod.') + ' Kérdésed van? Hívj minket: ' + A.SZALON.telefon + '.' }));
    }
  }
  // auto-refresh: amig az ajandekkartya keszul, idonkent ujrakerdezzuk a szervert. A hatterben levo lap nem
  // kerdez (es a hatterben toltott ido nem szamit a korlatba); visszatereskor azonnal frissit.
  var figyelSzamlalo = 0, figyelIdozito = null;
  function kartyaKesz() { return !!(S.rendeles && S.rendeles.kartya && S.rendeles.kartya.allapot === 'kesz'); }
  function kartyaFigyel() {
    clearTimeout(figyelIdozito);
    if (!S.rendeles || kartyaKesz() || figyelSzamlalo >= 90) return;
    figyelIdozito = setTimeout(kartyaLeker, 10000);
  }
  function kartyaLeker() {
    clearTimeout(figyelIdozito);
    if (!S.rendeles || kartyaKesz()) return;
    if (document.hidden) { kartyaFigyel(); return; }
    figyelSzamlalo++;
    api(rendelesUt()).then(function (v) {
      if (v.status === 200 && v.adat.allapot === 'fizetve') { S.rendeles = v.adat; frissitUtan(); }
      kartyaFigyel();
    }).catch(kartyaFigyel);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && (S.allapot === 'siker' || S.allapot === 'szemelyre' || S.allapot === 'osszegzo')) kartyaLeker();
  });
  function frissitUtan() { sikerRender(); if (S.allapot === 'osszegzo') osszegzoRender(); }

  // ---------------------------------------------------------------- Personalization
  function szemelyreInit() {
    var al = uresit($('ah-sz-alkalom'));
    al.appendChild(h('option', { value: '', text: 'Válassz alkalmat' }));
    A.ALKALMAK.forEach(function (x) { al.appendChild(h('option', { value: x.id, text: x.cim })); });
  }
  function szemelyreMent(ev) {
    ev.preventDefault();
    var gomb = $('ah-sz-gomb');
    if (gomb.disabled) return;
    gomb.disabled = true;
    hibaMezo('ah-sz-hiba', '');
    api('szemelyre', { json: {
      pi: S.pi, cs: S.cs, nev: ($('ah-sz-nev').value || '').trim(), uzenet: ($('ah-sz-uzenet').value || '').trim(),
      alkalom: $('ah-sz-alkalom').value, atadas: S.atvetel === 'otthon' ? 'nyomtatott' : 'fizikai'
    } }).then(function (v) {
      if (v.status !== 200 || !v.adat.allapot) throw new Error('szemelyre');
      S.rendeles = v.adat;
      S.utanAllapot = 'osszegzo';
      allapotba('osszegzo');
    }).catch(function () {
      hibaMezo('ah-sz-hiba', 'Most nem sikerült elmenteni. Próbáld újra, vagy hagyd ki most — az ajándékkártyád így is kész.');
    }).then(function () { gomb.disabled = false; });
  }
  function szemelyreKihagy() { S.utanAllapot = 'osszegzo'; allapotba('osszegzo'); }

  // "Újabb ajándékkártyát vásárolok": a megrendelés az e-mailben lévő linkkel továbbra is elérhető; az oldal tiszta
  // lappal indul (új PaymentIntent, új purchase), a beírt számlázási adatok megmaradnak
  function ujVasarlas() {
    clearTimeout(figyelIdozito); figyelSzamlalo = 0;
    S.pi = null; S.cs = null; S.rt = null; S.csakOlvas = false; S.fizetesInditva = null;
    S.rendeles = null; S.utanAllapot = null; S.fizetveIdo = 0; S.termek = null; S.folyamatban = false;
    S.atvetel = 'otthon'; S.tervezo = ujTervezo(null); fotoBeallit(null, null); fotoTarolasIr(null);
    // a kifizetett fizetoelem helyett ujat epitunk (tiszta kartyamezok)
    try { if (stripeAdapter.elem && stripeAdapter.elem.destroy) stripeAdapter.elem.destroy(); } catch (e) { /* nem baj */ }
    stripeAdapter.elem = null; stripeAdapter.elements = null; stripeAdapter.osszeg = null; S.elemKesz = false;
    allapotba('bongeszes', { eroltet: true });
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- FinalOrderHub
  function osszegzoRender() {
    var r = S.rendeles;
    if (!r) return;
    var t = termek(r.termek) || termek(S.termek);
    var dl = uresit($('ah-osszegzo-meta'));
    metaSor(dl, 'Ajándékkártya', r.kartya_cim || (t && t.kartya_cim) || '');
    metaSor(dl, 'Összeg', A.arSzoveg(r.osszeg));
    metaSor(dl, 'Rendelés', '#' + r.rendeles_id);
    if (r.atvetel) metaSor(dl, 'Átvétel', r.atvetel === 'szemelyesen' ? 'Személyesen, a szalonban' : 'E-mailben, otthon nyomtatva');
    if (r.szemelyre && r.szemelyre.tema) metaSor(dl, 'Személyre szabott design', temaNev(r.szemelyre.tema) + (r.szemelyre.foto ? ', saját fotóval' : ''));
    if (r.szemelyre && r.szemelyre.nev) metaSor(dl, 'Megajándékozott', r.szemelyre.nev);
    var ervenyes = r.kartya && ervenyesSzoveg(r.kartya.ervenyes_ig);
    metaSor(dl, 'Érvényesség', ervenyes || A.ERVENYESSEG_HONAP + ' hónapig');
    metaSor(dl, 'Beváltás', 'Online időpontfoglalásnál, a kártyán lévő kuponkóddal');
    var gombok = uresit($('ah-osszegzo-gombok'));
    var kesz = r.kartya && r.kartya.allapot === 'kesz' && r.kartya.url;
    if (kesz) gombok.appendChild(h('a', { class: 'ah-gomb ah-gomb-fo', href: r.kartya.url, target: '_blank', rel: 'noopener', text: 'Ajándékkártya letöltése' }));
    else gombok.appendChild(h('button', { type: 'button', class: 'ah-gomb ah-gomb-fo', disabled: true, 'aria-disabled': 'true', text: 'Készítjük az ajándékkártyádat…' }));
    if (kesz) {
      var targy = 'Ajándék a MOSAIC Head Spa-ba';
      // a szerver abszolut URL-t ad (levelekben is ez megy); relativ esetre a sajat origin kerul elé
      var kartyaUrl = /^https?:\/\//.test(r.kartya.url) ? r.kartya.url : location.origin + r.kartya.url;
      var torzs = (r.szemelyre && r.szemelyre.nev ? r.szemelyre.nev + ', ' : '') + 'ez a MOSAIC Head Spa ajándékkártyád: ' + kartyaUrl;
      gombok.appendChild(h('a', { class: 'ah-gomb ah-gomb-kor', href: 'mailto:?subject=' + encodeURIComponent(targy) + '&body=' + encodeURIComponent(torzs), text: 'Elküldöm e-mailben' }));
    }
    gombok.appendChild(h('button', { type: 'button', class: 'ah-gomb ah-gomb-kor', 'data-valtas': 'ah-bevaltas', text: 'Hogyan váltható be?' }));
    gombok.appendChild(h('button', { type: 'button', class: 'ah-link', 'data-valtas': 'ah-nyomtatas', text: 'Nyomtatási útmutató' }));
  }

  // ---------------------------------------------------------------- nezet (render)
  var elozoAllapot = null;
  function render() {
    var a = S.allapot;
    document.body.setAttribute('data-allapot', a);
    var fokuszNezet = a !== 'bongeszes' && a !== 'kivalasztva';
    document.body.setAttribute('data-nezet', fokuszNezet ? 'fokusz' : 'landing');
    $('ah-landing').hidden = fokuszNezet;
    $('ah-fokusz').hidden = !fokuszNezet;
    var fizNezet = a === 'fizetes' || a === 'feldolgozas' || a === 'hiba';
    $('ah-fizetes').hidden = !fizNezet;
    var utanNezet = a === 'siker' || a === 'szemelyre' || a === 'osszegzo';
    $('ah-utan').hidden = !utanNezet;
    $('ah-vissza-gomb').hidden = !(a === 'fizetes' || a === 'hiba');
    $('ah-vissza-gomb').innerHTML = '<span aria-hidden="true">←</span>&nbsp;' + (S.atvetel === 'otthon' && KT ? 'Vissza a személyre szabáshoz' : 'Másik élményt választok');
    var tervNezet = a === 'tervezo';
    $('ah-tervezo').hidden = !tervNezet;
    if (tervNezet) { if (elozoAllapot !== 'tervezo') tervezoMezokTolt(); tervezoRender(); }

    // landing: a harom lepes (termek-valaszto, video, atvetel + tovabb)
    lepesekRender();
    valasztottJelol();

    // checkout
    if (fizNezet) {
      osszesitoRender();
      urlapTolt();
      $('ah-feldolgozas').hidden = a !== 'feldolgozas';
      $('ah-hibasav').hidden = a !== 'hiba';
      var urlapElemek = $('ah-urlap').querySelectorAll('input, button, details, select');
      Array.prototype.forEach.call(urlapElemek, function (e) {
        if (e.id === 'ah-fizet-gomb') return;
        if (a === 'feldolgozas') e.setAttribute('inert', ''); else e.removeAttribute('inert');
      });
      $('ah-nincs-fizetes').hidden = S.mod !== 'nincs';
      $('ah-fizetesi-elem').hidden = S.mod === 'nincs';
      fizModRender();
      if (a === 'fizetes' || a === 'hiba') fizetesiElemInit();
    }

    // vasarlas utan
    if (utanNezet) {
      sikerRender();
      $('ah-siker').hidden = a === 'osszegzo';
      $('ah-szemelyre').hidden = a !== 'szemelyre';
      $('ah-osszegzo').hidden = a !== 'osszegzo';
      if (a === 'osszegzo') osszegzoRender();
    }

    // fokusz es gorgetes az uj nezetre (nem a landing tetejere)
    if (elozoAllapot !== a) {
      if (a === 'fizetes' && (elozoAllapot === 'kivalasztva' || elozoAllapot === null)) { window.scrollTo(0, 0); setTimeout(function () { fokusz($('ah-fizetes-cim')); }, 30); }
      if (a === 'tervezo') { window.scrollTo(0, 0); setTimeout(function () { fokusz($('ah-tervezo-cim')); }, 30); }
      if (a === 'hiba') { gorgess($('ah-hibasav'), 'center'); setTimeout(function () { fokusz($('ah-hibasav')); }, 30); }
      if (a === 'siker' || a === 'szemelyre') { if (elozoAllapot !== 'siker') { window.scrollTo(0, 0); setTimeout(function () { fokusz($('ah-siker-cim')); }, 30); } }
      if (a === 'osszegzo') { window.scrollTo(0, 0); setTimeout(function () { fokusz($('ah-osszegzo-cim')); }, 30); }
      if (a === 'kivalasztva' && (elozoAllapot === 'fizetes' || elozoAllapot === 'hiba' || elozoAllapot === 'tervezo')) { setTimeout(function () { gorgess($('ah-lepesek'), 'center'); }, 30); }
    }
    elozoAllapot = a;
  }

  // ---------------------------------------------------------------- tovabb a fizetesre (history: a visszalepes a kivalasztott allapotba visz)
  function fizetesre() {
    if (!S.termek) return;
    if (allapotba('fizetes')) {
      try { history.pushState({ ah: 'fizetes' }, '', location.pathname + location.search + '#fizetes'); } catch (e) { /* nem baj */ }
      mer('begin_checkout', { ecommerce: { currency: A.PENZNEM, value: osszegFt(), items: [tetel(termek(S.termek))] }, product_type: termek(S.termek).product_type }, 'begin_' + S.termek + '_' + (S.pi || ''));
    }
  }
  function visszaKivalasztva() {
    if (S.folyamatban) return;
    allapotba('kivalasztva');
  }
  // a fizetesbol vissza: otthon nyomtatott kartyanal a szemelyre szabo, egyebkent a kivalasztott termek
  function visszaElozo() {
    if (S.folyamatban) return;
    allapotba(S.atvetel === 'otthon' && KT ? 'tervezo' : 'kivalasztva');
  }
  window.addEventListener('popstate', function () {
    if (S.allapot === 'fizetes' || S.allapot === 'hiba') visszaElozo();
    else if (S.allapot === 'tervezo') allapotba('kivalasztva');
    else if (S.allapot === 'feldolgozas') { try { history.pushState({ ah: 'fizetes' }, '', location.pathname + location.search + '#fizetes'); } catch (e) { /* nem baj */ } }
  });

  // ---------------------------------------------------------------- esemenyek bekotese
  function bekot() {
    document.addEventListener('click', function (ev) {
      var gg = ev.target.closest ? ev.target.closest('[data-gorgess]') : null;
      if (gg) { var cel = $(gg.getAttribute('data-gorgess')); if (cel) { ev.preventDefault(); gorgess(cel, 'start'); setTimeout(function () { fokusz(cel); }, 450); } return; }
      var c = ev.target.closest ? ev.target.closest('[data-valtas]') : null;
      if (!c) return;
      if (c.hasAttribute('data-valtas')) { var x = $(c.getAttribute('data-valtas')); x.hidden = !x.hidden; }
    });
    $('ah-tovabb-gomb').addEventListener('click', tovabbGomb);
    $('ah-termek-racs').addEventListener('change', function (ev) { var r = ev.target; if (r && r.name === 'termek') { kivalaszt(r.value); gorgessVideora(); } });
    $('ah-vissza-gomb').addEventListener('click', function () {
      // a checkout-bejegyzest a bongeszo-elozmenyekbol is levesszuk (a popstate visz vissza a kivalasztott allapotba)
      if (history.state && history.state.ah === 'fizetes') history.back(); else visszaElozo();
    });
    $('ah-urlap').addEventListener('submit', fizetesBekuldes);
    $('ah-urlap').addEventListener('input', urlapMent);
    $('ah-ujra-gomb').addEventListener('click', ujraProbal);
    $('ah-masikmod-gomb').addEventListener('click', masikModra);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="fizmod"]'), function (r) {
      r.addEventListener('change', function () { if (this.checked) fizModValaszt(this.value); });
    });
    // az ajandekozott neve a szemelyre szabo nevevel egy (mindket mezo ugyanazt a S.tervezo.nev erteket irja)
    $('ah-ajandekozott').addEventListener('input', function () {
      S.tervezo.nev = (this.value || '').slice(0, KT ? KT.NEV_MAX : 40);
      var tn = $('ah-tervezo-nev');
      if (tn && tn.value !== S.tervezo.nev) tn.value = S.tervezo.nev;
    });
    $('ah-osszesito-gomb').addEventListener('click', function () {
      var kartya = $('ah-osszesito'), nyitva = !kartya.classList.contains('ah-nyitva');
      kartya.classList.toggle('ah-nyitva', nyitva);
      this.setAttribute('aria-expanded', nyitva ? 'true' : 'false');
    });
    $('ah-szemelyre-urlap').addEventListener('submit', szemelyreMent);
    $('ah-sz-kihagy').addEventListener('click', szemelyreKihagy);
    $('ah-uj-vasarlas').addEventListener('click', ujVasarlas);
    $('ah-hero-cta').addEventListener('click', function (ev) { var f = $('ah-finder'); if (f) { ev.preventDefault(); gorgess(f, 'start'); } });
    vendegVideok();
    kezAblakBekot();
    if (KT) tervezoBekot();
  }

  // ---------------------------------------------------------------- inditas / visszaallitas
  function beallitasBetolt() {
    return api('beallitas').then(function (v) {
      var b = v.adat || {};
      S.mod = v.status === 200 && (b.mod === 'elo' || b.mod === 'teszt') ? b.mod : 'nincs';
      S.publikusKulcs = b.publikus_kulcs || null;
      if (!S.publikusKulcs) S.mod = 'nincs';
      S.azonnali = !!b.azonnali_kartya;
      S.fotoLehet = !!b.foto;
      // a "TESZT MÓD" szalag alapból nem látszik (a tulajdonos kérése); csak a ?teszt=1 paraméterrel jelenik meg, a variáns-kapcsolóval együtt
      if (S.mod === 'teszt' && /(^|[?&])teszt=1(&|$)/.test(location.search)) {
        // teszt-modban a szalagon variant-kapcsolo is van (csak itt: az eles oldalon nincs): a link a ?variant= parametert allitja
        var kapcsolo = h('span', { class: 'ah-teszt-var' }, 'Variáns: ');
        Object.keys(A.VARIANTOK).forEach(function (id) {
          kapcsolo.appendChild(h('a', { href: location.pathname + '?variant=' + id, text: id, 'aria-current': id === S.variant.variant_id ? 'true' : null }));
        });
        document.body.appendChild(h('div', { class: 'ah-teszt-szalag' }, h('span', { text: 'TESZT MÓD — nem valódi fizetés, nem valódi rendelés.' }), kapcsolo));
      }
    }).catch(function () { S.mod = 'nincs'; });
  }

  // A Stripe-visszateres (payment_intent, client_secret) es a levelbeli rendeles-link (rendeles + rt) adatait a lap elejen futo
  // kis szkript (foglalas/ajandek.html) mar kivette az URL-bol es a sessionStorage-ba tette, MIELOTT a suti.js / GTM
  // beolvashatta volna a cimet (a client_secret nem kerulhet a meresbe).
  function visszaAdat() {
    try {
      var v = JSON.parse(sessionStorage.getItem('ah_vissza') || '{}');
      sessionStorage.removeItem('ah_vissza');
      return v && typeof v === 'object' ? v : {};
    } catch (e) { return {}; }
  }

  function visszaallit() {
    var vissza = visszaAdat();
    var pi = vissza.payment_intent, cs = vissza.payment_intent_client_secret;
    // Stripe 3DS / atiranyitas utani visszateres: a szerver ellenorzi a fizetest
    if (pi && cs) {
      S.pi = pi; S.cs = cs; S.rt = null; S.csakOlvas = false;
      S.folyamatban = true;
      allapotba('feldolgozas', { eroltet: true });
      fizetesEllenorzes(pi, cs, 30000);
      return;
    }
    // levelbeli rendeles-link: csak olvasas (a fizetes nem ebben a munkamenetben indult -> nincs purchase, nincs szerkesztes)
    if (vissza.rendeles && vissza.rt) {
      S.pi = String(vissza.rendeles); S.rt = String(vissza.rt); S.cs = null; S.csakOlvas = true; S.utanAllapot = 'osszegzo';
      api(rendelesUt()).then(function (v) {
        if (v.status === 200 && v.adat.allapot === 'fizetve') {
          S.rendeles = v.adat;
          if (!S.termek && v.adat.termek) S.termek = v.adat.termek;
          S.fizetveIdo = Date.now();
          allapotba('siker', { eroltet: true });
          allapotba('osszegzo', { eroltet: true });
          kartyaFigyel();
        } else { S.pi = null; S.rt = null; S.csakOlvas = false; S.utanAllapot = null; ment(); alap(); }
      }).catch(function () { S.pi = null; S.rt = null; S.csakOlvas = false; S.utanAllapot = null; ment(); alap(); });
      return;
    }
    // mar fizetett rendeles ugyanabban a sessionben: frissites utan a szemelyre szabas lepese (siker/szemelyre) rovid
    // ideig (30 perc) visszaall, hogy a vevo ne veszitse el; a vegleges nezet (Minden kesz) utan a frissites tiszta
    // lappal indul (a rendeles a levelbeli linkkel elerheto). Uj hirdetesi kattintas (UTM / click-azonosito) is tiszta lap.
    var friss = S.fizetveIdo && Date.now() - S.fizetveIdo < 30 * 60 * 1000 && !ujAttr && S.utanAllapot !== 'osszegzo';
    if (S.utanAllapot && !friss) { S.pi = null; S.cs = null; S.rt = null; S.csakOlvas = false; S.fizetesInditva = null; S.utanAllapot = null; S.fizetveIdo = 0; S.termek = null; ment(); }
    if (S.pi && (S.cs || S.rt) && S.utanAllapot) {
      api(rendelesUt()).then(function (v) {
        if (v.status === 200 && v.adat.allapot === 'fizetve') {
          S.rendeles = v.adat;
          purchaseMeres(v.adat);
          allapotba('siker', { eroltet: true });
          if (S.utanAllapot === 'osszegzo' || S.csakOlvas) allapotba('osszegzo', { eroltet: true }); else allapotba('szemelyre');
          kartyaFigyel();
        } else { S.pi = null; S.cs = null; S.rt = null; S.csakOlvas = false; S.utanAllapot = null; S.fizetveIdo = 0; ment(); alap(); }
      }).catch(function () { alap(); });
      return;
    }
    alap();
  }
  function alap() {
    // megszakadt checkout ugyanabban a sessionben: a kivalasztott termek es a beirt adatok megmaradnak
    if (S.termek) { allapotba('kivalasztva'); } else render();
    meresViewItem();
  }

  // A fejlec az eles oldal menuje (a sminktetovalas oldal mintajabol kivonva): ott a "Sminktetovalas" az aktualis oldal.
  // Itt az "Ajandekkartya" menupont az aktiv (a Wix "isCurrentPage" osztalya + aria-current).
  function menuAktiv() {
    var gyoker = document.getElementById('mh-fejlec');
    if (!gyoker) return;
    var cel = gyoker.querySelectorAll('a[href="/headspa-ajandekkartya"]');
    Array.prototype.forEach.call(gyoker.querySelectorAll('[class*="--isCurrentPage"]'), function (e) {
      (e.getAttribute('class') || '').split(/\s+/).forEach(function (tok) {
        if (tok.indexOf('--isCurrentPage') < 0) return;
        e.classList.remove(tok);
        e.removeAttribute('aria-current');
        Array.prototype.forEach.call(cel, function (c) {
          if ((c.getAttribute('class') || '').indexOf(tok.split('--')[0]) > -1) { c.classList.add(tok); c.setAttribute('aria-current', 'page'); }
        });
      });
    });
  }

  function init() {
    // a statikus tartalom a config-bol (a komponensfa nem valtozik, csak a tartalom)
    ikonokKitolt(document);
    if (KT && !document.getElementById('ah-ak-css')) { var st = document.createElement('style'); st.id = 'ah-ak-css'; st.textContent = KT.CSS; document.head.appendChild(st); }
    fotoVisszaallit().then(function () { if (S.allapot === 'tervezo') tervezoRender(); });
    menuAktiv();
    heroRender();
    heroVideo();
    proofRender();
    termekekRender();
    headspaRender();
    elemekRender();
    galeriaInit();
    atvetelRender();
    vendegRendez();
    karusszelBekot();
    szemelyreInit();
    bekot();
    ment();
    render();
    beallitasBetolt().then(function () {
      if (S.allapot === 'kivalasztva') { lepesekRender(); stripeElokeszit(); }
      if (S.allapot === 'tervezo') tervezoRender();
      if (S.allapot === 'fizetes' || S.allapot === 'hiba') fizetesiElemInit();
    });
    visszaallit();
    // tesztelhetoseg: csak olvasasra
    window.__ajandek = { allapot: function () { return S.allapot; }, snapshot: function () { return JSON.parse(JSON.stringify({ allapot: S.allapot, termek: S.termek, variant_id: S.variant.variant_id, mod: S.mod, attr: S.attr, urlap: S.urlap, pi: S.pi })); } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
