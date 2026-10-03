// MOSAIC Gift Commerce Engine - a vasarlasi folyamat motorja (/ajandek).
//
// EGY motor, egy allapotgep (asztali es mobil ugyanazt hasznalja), a variant csak a
// tartalmat (config) cserli, a komponensfat nem. Komponensek (egy-egy fuggveny-csoport):
//   GiftHeader, GiftHero, GiftFinder, ProductGrid/ProductCard, ExperienceSection, SocialProof,
//   SelectedProductPanel, Checkout + OrderSummary, PaymentState (feldolgozas/hiba),
//   PurchaseSuccess, Personalization, FinalOrderHub.
//
// Allapotok:  bongeszes -> kivalasztva -> fizetes -> feldolgozas -> (hiba -> fizetes) | siker
//             siker -> szemelyre -> osszegzo        (nincs kosar, nincs kulon termekoldal)
//
// A PURCHASE esemeny KIZAROLAG akkor megy ki, ha a SZERVER a Stripe-tol visszakerdezve
// "fizetve"-t mond (GET /api/ajandek/rendeles). Stripe-kattintas, atutalasi igeny,
// kartya-letoltes, beváltás NEM purchase.
(function () {
  'use strict';
  var A = window.AJANDEK_ADAT;
  if (!A) { return; }

  var API = '/api/ajandek/';
  var TAROLO = 'ah_v1';
  var ATTR_KULCSOK = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ttclid'];
  var ATMENETEK = {
    bongeszes: ['kivalasztva'],
    kivalasztva: ['bongeszes', 'kivalasztva', 'fizetes'],
    fizetes: ['kivalasztva', 'feldolgozas'],
    feldolgozas: ['siker', 'hiba', 'fizetes'],
    hiba: ['fizetes', 'kivalasztva', 'feldolgozas'],
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
    card: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10.5h17M7 15h4"/>'
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
    utanAllapot: tar.utan_allapot || null
  };

  function ment() {
    tarolas.ir({
      v: 1, variant_id: S.variant.variant_id, termek: S.termek, finder: S.finder, urlap: S.urlap,
      attr: S.attr, pi: S.pi, cs: S.cs, rt: S.rt, csak_olvas: S.csakOlvas, fizetes_inditva: S.fizetesInditva,
      utan_allapot: S.utanAllapot, fizetve_ido: S.fizetveIdo
    });
  }

  // ---------------------------------------------------------------- meres (dataLayer / GA4 ecommerce)
  var kuldott = {};
  function kozosParam() {
    var p = { variant_id: S.variant.variant_id, gift_context: S.variant.gift_context };
    if (S.variant.relationship) p.relationship = S.variant.relationship;
    var alk = S.variant.occasion || alkalomURL;
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
    var lista = uresit($('ah-hero-bizalom'));
    c.hero_trust.forEach(function (t) {
      var li = h('li');
      if (t.csillag) li.appendChild(h('span', { class: 'ah-csillag', 'aria-hidden': 'true', text: '★★★★★' }));
      else li.appendChild(ikonSpan(t.ikon));
      li.appendChild(h('span', { class: 'ah-bizalom-szoveg' }, h('b', { text: t.szoveg }), h('small', { text: t.alszoveg })));
      lista.appendChild(li);
    });
    var kep = $('ah-hero-kep');
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

  // ---------------------------------------------------------------- SocialProof
  function proofRender() {
    var p = A.PROOFOK[S.variant.featured_proof] || A.PROOFOK.general;
    $('ah-proof-idezet').textContent = p.idezet;
    $('ah-proof-forras').textContent = p.forras;
    $('ah-proof').classList.toggle('ah-helyorzo', !p.valodi);
    // a Google-osszegzes (tulajdonosi adat, lasd ajandek-adat.js)
    $('ah-google-pont').textContent = A.GOOGLE.pont;
    $('ah-google-szam').textContent = A.GOOGLE.darab + ' Google-vélemény';
  }

  // ---------------------------------------------------------------- GiftFinder
  function finderRender() {
    var racs = uresit($('ah-finder-racs'));
    A.FINDER.forEach(function (f) {
      var gomb = h('button', { type: 'button', class: 'ah-valasz', 'data-finder': f.id, 'aria-pressed': S.finder === f.id ? 'true' : 'false', title: f.nyil },
        ikonSpan(f.ikon || 'gift'), h('span', { class: 'ah-valasz-szoveg' }, h('strong', { text: f.cim }), h('span', { text: f.leiras })), ikonSpan('chevron'));
      racs.appendChild(gomb);
    });
  }
  function finderValaszt(id) {
    var f = A.FINDER.filter(function (x) { return x.id === id; })[0];
    if (!f) return;
    S.finder = id;
    Array.prototype.forEach.call(document.querySelectorAll('[data-finder]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-finder') === id ? 'true' : 'false'); });
    ajanlottJelol(f.termek);
    mer('gift_finder_select', { finder_valasztas: f.id, product_type: termek(f.termek).product_type });
    ment();
    // nincs reload: a javasolt termek elotérbe kerul, a kepernyo ra gorget (mobilon es asztalin is)
    gorgess($('ah-termek-' + f.termek), 'center');
  }

  // ---------------------------------------------------------------- ProductGrid / ProductCard
  function termekKartya(t) {
    var kartya = h('article', { class: 'ah-termek', id: 'ah-termek-' + t.id, 'data-termek': t.id });
    // az "Ajanlott valasztas" szalag: a Gift Finder valasztasa, egyebkent a variant elso termeke (nem allit nepszerusegi adatot)
    kartya.appendChild(h('p', { class: 'ah-szalag', 'data-ajanlott-jel': t.id, text: 'Ajánlott választás', hidden: true }));
    var kep = h('div', { class: 'ah-termek-kep' });
    if (t.vizual && t.vizual.src) {
      kep.appendChild(h('img', { src: kepUt(t.vizual.src), alt: t.vizual.alt || '', width: t.vizual.w || null, height: t.vizual.h || null, loading: 'lazy', decoding: 'async', style: t.vizual.poz ? 'object-position:' + t.vizual.poz : null }));
    }
    if (t.badge) kep.appendChild(h('p', { class: 'ah-badge', text: t.badge }));
    kartya.appendChild(kep);
    var test = h('div', { class: 'ah-termek-test' });
    test.appendChild(h('h3', { text: t.nev }));
    test.appendChild(h('p', { class: 'ah-termek-fejlec', text: t.fejlec }));
    test.appendChild(h('p', { class: 'ah-termek-leiras', text: t.leiras }));
    var ul = h('ul', { class: 'ah-lista' });
    t.tartalom.forEach(function (sor) { ul.appendChild(listaSor(sor)); });
    test.appendChild(ul);
    test.appendChild(h('div', { class: 'ah-termek-alja' },
      h('p', { class: 'ah-ar-blokk' }, h('span', { class: 'ah-ar-cimke', text: 'aktuális ár' }), h('span', { class: 'ah-ar', text: A.arSzoveg(t.ar_ft) })),
      h('button', { type: 'button', class: 'ah-gomb ah-gomb-fo', 'data-valaszt': t.id }, h('span', { 'data-valaszt-szoveg': '', text: 'Ezt választom' }), ikonSpan('arrow'))));
    kartya.appendChild(test);
    return kartya;
  }
  function termekekRender() {
    var racs = uresit($('ah-termek-racs'));
    S.variant.product_order.forEach(function (id) { var t = termek(id); if (t) racs.appendChild(termekKartya(t)); });
    var finderTermek = S.finder ? (A.FINDER.filter(function (x) { return x.id === S.finder; })[0] || {}).termek : null;
    ajanlottJelol(finderTermek || S.variant.product_order[0]);
    valasztottJelol();
  }
  function ajanlottJelol(id) {
    Array.prototype.forEach.call(document.querySelectorAll('.ah-termek'), function (k) {
      var az = k.getAttribute('data-termek') === id;
      k.classList.toggle('ah-ajanlott', az);
      var jel = k.querySelector('[data-ajanlott-jel]');
      if (jel) jel.hidden = !az;
    });
  }
  function valasztottJelol() {
    Array.prototype.forEach.call(document.querySelectorAll('.ah-termek'), function (k) {
      var az = k.getAttribute('data-termek') === S.termek && S.allapot !== 'bongeszes';
      k.classList.toggle('ah-valasztott', az);
      var g = k.querySelector('[data-valaszt]');
      if (g) {
        var gsz = g.querySelector('[data-valaszt-szoveg]');
        if (gsz) gsz.textContent = az ? 'Kiválasztva ✓' : 'Ezt választom';
        g.classList.toggle('ah-gomb-kesz', az);
        g.classList.toggle('ah-gomb-fo', !az);
        if (az) k.setAttribute('aria-current', 'true'); else k.removeAttribute('aria-current');
      }
    });
  }
  function kivalaszt(id) {
    var t = termek(id);
    if (!t) return;
    S.termek = id;
    allapotba('kivalasztva', { ujra: true });
    mer('select_item', { ecommerce: { item_list_id: 'ajandek_' + S.variant.variant_id, item_list_name: 'MOSAIC ajándékkártya', items: [tetel(t)] }, product_type: t.product_type });
    stripeElokeszit();
    var panel = $('ah-kivalasztott');
    gorgess(panel, 'center');
    setTimeout(function () { fokusz(panel); }, 50);
  }

  // ---------------------------------------------------------------- SelectedProductPanel + OrderSummary
  function panelRender() {
    var t = termek(S.termek);
    if (!t) return;
    $('ah-kiv-cim').textContent = t.kartya_cim;
    kepBeallit($('ah-kiv-kep'), t);
    var lista = uresit($('ah-kiv-lista'));
    t.tartalom.forEach(function (sor) { lista.appendChild(listaSor(sor)); });
    $('ah-kiv-ar').textContent = A.arSzoveg(t.ar_ft);
    // "Perceken belul" csak garantalt teljesites mellett: a szerver /beallitas mondja meg (azonnali_kartya)
    $('ah-kiv-kezbesites').textContent = S.azonnali ? 'Perceken belül az e-mailedben.' : 'Sikeres fizetés után e-mailben kapod meg.';
  }
  function osszesitoRender() {
    var t = termek(S.termek);
    if (!t) return;
    $('ah-osszesito-nev').textContent = t.kartya_cim;
    kepBeallit($('ah-osszesito-kep'), t);
    var lista = uresit($('ah-osszesito-lista'));
    t.tartalom.filter(function (s) { return !/felhasználható/.test(s); }).forEach(function (sor) { lista.appendChild(listaSor(sor)); });
    var ar = A.arSzoveg(t.ar_ft);
    $('ah-osszesito-ar').textContent = ar;
    $('ah-osszesito-fej-ar').textContent = ar;
    $('ah-fizet-gomb').textContent = S.folyamatban ? 'Feldolgozzuk a fizetésed…' : 'Biztonságos fizetés — ' + ar;
  }

  // ---------------------------------------------------------------- ExperienceSection (video)
  function videoKot() {
    var v = $('ah-video'), gomb = $('ah-lejatszo'), doboz = $('ah-video-doboz');
    gomb.addEventListener('click', function () {
      v.preload = 'auto';
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* nem indult: marad a poszter */ });
    });
    v.addEventListener('play', function () { doboz.classList.add('ah-megy'); });
    v.addEventListener('click', function () { if (v.paused) v.play(); else { v.pause(); doboz.classList.remove('ah-megy'); } });
  }

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
      $('ah-fizet-gomb').disabled = S.mod === 'nincs';
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
        layout: { type: 'tabs', defaultCollapsed: false },
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
      $('ah-fizet-gomb').disabled = true;
    });
  }

  var MEZOK = [
    ['email', 'ah-email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Kérjük, adj meg érvényes e-mail címet.'; }],
    ['nev', 'ah-nev', function (v) { return v.length >= 3 ? '' : 'Kérjük, add meg a számlázási nevet.'; }],
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
    if (u.ceges_nev && !$('ah-ceges-nev').value) { $('ah-ceges-nev').value = u.ceges_nev; $('ah-ceges').open = true; }
    if (u.ceges_adoszam && !$('ah-ceges-adoszam').value) $('ah-ceges-adoszam').value = u.ceges_adoszam;
  }
  function validal() {
    var o = urlapOlvas(), elso = null, hibak = {};
    MEZOK.forEach(function (m) {
      var uzenet = m[2](o[m[0]]);
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
      termek: S.termek, email: o.email, nev: o.nev, iranyitoszam: o.iranyitoszam, varos: o.varos, cim: o.cim,
      ceges: (o.ceges_nev || o.ceges_adoszam) ? { nev: o.ceges_nev, adoszam: o.ceges_adoszam } : null,
      attr: Object.assign({}, kozosParam(), { oldal: S.attr.oldal })
    };
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
    gorgess($('ah-fizetesi-doboz'), 'center');
    if (stripeAdapter.elem && stripeAdapter.elem.focus) stripeAdapter.elem.focus();
  }

  // ---------------------------------------------------------------- atutalas (NEM vasarlas)
  // Az utalasi igeny 2 lepes: (1) a szamlazasi adatok ellenorzese utan egy kis urlap a kartyara kerulo adatokkal es a
  // telefonszammal (a Salonic-utalvany-ertekesiteshez kell), (2) a kuldes utan az utalasi adatok.
  function atutalasKer() {
    var panel = $('ah-atutalas');
    var gomb = $('ah-atutalas-gomb');
    if (panel.getAttribute('data-kesz') || panel.getAttribute('data-urlap')) { // mar megnyitottuk / elkuldtuk: csak ki-be kapcsoljuk
      panel.hidden = !panel.hidden;
      gomb.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      return;
    }
    var o = validal();
    if (!o) return;
    gomb.setAttribute('aria-expanded', 'true');
    panel.setAttribute('data-urlap', '1');
    atutalasUrlap(panel, o);
    panel.hidden = false;
    gorgess(panel, 'center');
  }
  function atutalasUrlap(panel, o, hiba) {
    uresit(panel);
    panel.appendChild(h('h3', { text: 'Átutalással fizetek' }));
    panel.appendChild(h('p', { class: 'ah-halk ah-kicsi', text: 'Az ajándékkártyát az utalás beérkezése után e-mailben küldjük. Két adatot még kérünk:' }));
    var tel = h('input', { id: 'ah-atu-tel', type: 'tel', autocomplete: 'tel', inputmode: 'tel', maxlength: '25', placeholder: '+36 20 123 4567', required: true });
    var nev = h('input', { id: 'ah-atu-nev', type: 'text', maxlength: '80', autocomplete: 'off', placeholder: 'Anna' });
    var uzenet = h('textarea', { id: 'ah-atu-uzenet', maxlength: '300', rows: '3', placeholder: 'Írd ide az üzenetet a kártyára…' });
    var hibaP = h('p', { class: 'ah-mezohiba', id: 'ah-atu-hiba', role: 'alert', hidden: !hiba, text: hiba || '' });
    var kuldGomb = h('button', { type: 'button', class: 'ah-gomb ah-gomb-fo ah-gomb-teljes', text: 'Utalási adatok kérése' });
    function mezo(cimke, az, elem, seg) {
      return h('div', { class: 'ah-mezo' }, h('label', { for: az, text: cimke }), elem, seg ? h('p', { class: 'ah-kicsi ah-halk', text: seg }) : null);
    }
    var urlap = h('div', { class: 'ah-atu-urlap' },
      mezo('Telefonszámod *', 'ah-atu-tel', tel, 'A számla és az ajándékkártya kiállításához kell, csak a szalon látja.'),
      mezo('Kinek szól az ajándék? (nem kötelező)', 'ah-atu-nev', nev, 'Ez a név kerül a kártyára.'),
      mezo('Üzenet a kártyára (nem kötelező)', 'ah-atu-uzenet', uzenet),
      hibaP, kuldGomb);
    panel.appendChild(urlap);
    kuldGomb.addEventListener('click', function () {
      var szam = (tel.value || '').replace(/\D/g, '');
      if (szam.length < 8) { hibaP.textContent = 'Add meg a telefonszámod (legalább 8 számjegy).'; hibaP.hidden = false; tel.focus(); return; }
      kuldGomb.disabled = true;
      var kerelem = szamlazasiAdat(o);
      kerelem['bot-field'] = $('ah-csapda').value;
      kerelem.telefon = tel.value.trim();
      kerelem.megajandekozott = nev.value.trim();
      kerelem.uzenet = uzenet.value.trim();
      api('atutalas', { json: kerelem }).then(function (v) {
        if (v.status === 400 && v.adat && v.adat.mezok) {
          var m = v.adat.mezok;
          throw Object.assign(new Error('ervenytelen'), { uzenet: m.telefon || m.uzenet || m.megajandekozott || 'Ellenőrizd a megadott adatokat.' });
        }
        if (v.status !== 200 || !v.adat.ok) throw new Error('atutalas');
        atutalasKesz(panel, o, v.adat.utalas || {});
      }).catch(function (e) {
        kuldGomb.disabled = false;
        hibaP.textContent = (e && e.uzenet) || 'Nem sikerült elküldeni az utalási adatokat. Próbáld újra, vagy hívj minket: 06 20 247 4444.';
        hibaP.hidden = false;
      });
    });
  }
  function atutalasKesz(panel, o, u) {
    uresit(panel);
    panel.setAttribute('data-kesz', '1');
    panel.appendChild(h('h3', { text: 'Átutalással fizetek' }));
    panel.appendChild(h('p', { text: 'Elküldtük az utalási adatokat a(z) ' + o.email + ' címre. Az ajándékkártyát az utalás beérkezése után e-mailben küldjük.' }));
    var dl = h('dl', { class: 'ah-meta' });
    [['Kedvezményezett', u.kedvezmenyezett], ['Számlaszám', u.szamlaszam], ['Összeg', A.arSzoveg(u.osszeg_ft)], ['Közlemény', u.kozlemeny]].forEach(function (p) {
      dl.appendChild(h('div', null, h('dt', { text: p[0] }), h('dd', { text: p[1] || '' })));
    });
    panel.appendChild(dl);
    panel.appendChild(h('p', { class: 'ah-kicsi ah-halk', text: 'Fontos: a közleménybe pontosan a fenti azonosítót írd, így tudjuk párosítani az utalást. Ez még nem vásárlás: az ajándékkártya az utalás beérkezése után készül el.' }));
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
    S.utanAllapot = S.utanAllapot === 'osszegzo' ? 'osszegzo' : 'szemelyre';
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
    var at = uresit($('ah-sz-atadas'));
    A.ATADASOK.forEach(function (x) { at.appendChild(h('option', { value: x.id, text: x.cim })); });
  }
  function szemelyreMent(ev) {
    ev.preventDefault();
    var gomb = $('ah-sz-gomb');
    if (gomb.disabled) return;
    gomb.disabled = true;
    hibaMezo('ah-sz-hiba', '');
    api('szemelyre', { json: {
      pi: S.pi, cs: S.cs, nev: ($('ah-sz-nev').value || '').trim(), uzenet: ($('ah-sz-uzenet').value || '').trim(),
      alkalom: $('ah-sz-alkalom').value, atadas: $('ah-sz-atadas').value
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

    // landing: kivalasztott panel
    var panel = $('ah-kivalasztott');
    panel.hidden = !(a === 'kivalasztva' && S.termek);
    if (a === 'kivalasztva' && S.termek) panelRender();
    valasztottJelol();

    // checkout
    if (fizNezet) {
      osszesitoRender();
      urlapTolt();
      $('ah-feldolgozas').hidden = a !== 'feldolgozas';
      $('ah-fizet-gomb').disabled = a === 'feldolgozas' || S.mod === 'nincs';
      $('ah-hibasav').hidden = a !== 'hiba';
      var urlapElemek = $('ah-urlap').querySelectorAll('input, button, details, select');
      Array.prototype.forEach.call(urlapElemek, function (e) {
        if (e.id === 'ah-fizet-gomb') return;
        if (a === 'feldolgozas') e.setAttribute('inert', ''); else e.removeAttribute('inert');
      });
      $('ah-nincs-fizetes').hidden = S.mod !== 'nincs';
      $('ah-fizetesi-elem').hidden = S.mod === 'nincs';
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
      if (a === 'hiba') { gorgess($('ah-hibasav'), 'center'); setTimeout(function () { fokusz($('ah-hibasav')); }, 30); }
      if (a === 'siker' || a === 'szemelyre') { if (elozoAllapot !== 'siker') { window.scrollTo(0, 0); setTimeout(function () { fokusz($('ah-siker-cim')); }, 30); } }
      if (a === 'osszegzo') { window.scrollTo(0, 0); setTimeout(function () { fokusz($('ah-osszegzo-cim')); }, 30); }
      if (a === 'kivalasztva' && (elozoAllapot === 'fizetes' || elozoAllapot === 'hiba')) { setTimeout(function () { gorgess($('ah-kivalasztott'), 'center'); }, 30); }
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
  window.addEventListener('popstate', function () {
    if (S.allapot === 'fizetes' || S.allapot === 'hiba') visszaKivalasztva();
    else if (S.allapot === 'feldolgozas') { try { history.pushState({ ah: 'fizetes' }, '', location.pathname + location.search + '#fizetes'); } catch (e) { /* nem baj */ } }
  });

  // ---------------------------------------------------------------- esemenyek bekotese
  function bekot() {
    document.addEventListener('click', function (ev) {
      var c = ev.target.closest ? ev.target.closest('[data-finder],[data-valaszt],[data-valtas]') : null;
      if (!c) return;
      if (c.hasAttribute('data-finder')) finderValaszt(c.getAttribute('data-finder'));
      else if (c.hasAttribute('data-valaszt')) kivalaszt(c.getAttribute('data-valaszt'));
      else if (c.hasAttribute('data-valtas')) { var x = $(c.getAttribute('data-valtas')); x.hidden = !x.hidden; }
    });
    $('ah-tovabb-gomb').addEventListener('click', fizetesre);
    $('ah-masik-gomb').addEventListener('click', function () { S.termek = null; allapotba('bongeszes'); gorgess($('ah-termek-racs'), 'center'); });
    $('ah-vissza-gomb').addEventListener('click', function () {
      // a checkout-bejegyzest a bongeszo-elozmenyekbol is levesszuk (a popstate visz vissza a kivalasztott allapotba)
      if (history.state && history.state.ah === 'fizetes') history.back(); else visszaKivalasztva();
    });
    $('ah-urlap').addEventListener('submit', fizetesBekuldes);
    $('ah-urlap').addEventListener('input', urlapMent);
    $('ah-ujra-gomb').addEventListener('click', ujraProbal);
    $('ah-masikmod-gomb').addEventListener('click', masikModra);
    $('ah-atutalas-gomb').addEventListener('click', atutalasKer);
    $('ah-osszesito-gomb').addEventListener('click', function () {
      var kartya = $('ah-osszesito'), nyitva = !kartya.classList.contains('ah-nyitva');
      kartya.classList.toggle('ah-nyitva', nyitva);
      this.setAttribute('aria-expanded', nyitva ? 'true' : 'false');
    });
    $('ah-szemelyre-urlap').addEventListener('submit', szemelyreMent);
    $('ah-sz-kihagy').addEventListener('click', szemelyreKihagy);
    $('ah-uj-vasarlas').addEventListener('click', ujVasarlas);
    $('ah-hero-cta').addEventListener('click', function (ev) { var f = $('ah-finder'); if (f) { ev.preventDefault(); gorgess(f, 'start'); } });
    videoKot();
  }

  // ---------------------------------------------------------------- inditas / visszaallitas
  function beallitasBetolt() {
    return api('beallitas').then(function (v) {
      var b = v.adat || {};
      S.mod = v.status === 200 && (b.mod === 'elo' || b.mod === 'teszt') ? b.mod : 'nincs';
      S.publikusKulcs = b.publikus_kulcs || null;
      if (!S.publikusKulcs) S.mod = 'nincs';
      S.azonnali = !!b.azonnali_kartya;
      if (S.mod === 'teszt') {
        document.body.appendChild(h('div', { class: 'ah-teszt-szalag', text: 'TESZT MÓD — nem valódi fizetés, nem valódi rendelés.' }));
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
    menuAktiv();
    heroRender();
    proofRender();
    finderRender();
    termekekRender();
    szemelyreInit();
    bekot();
    ment();
    render();
    beallitasBetolt().then(function () {
      if (S.allapot === 'kivalasztva') { panelRender(); stripeElokeszit(); }
      if (S.allapot === 'fizetes' || S.allapot === 'hiba') fizetesiElemInit();
    });
    visszaallit();
    // tesztelhetoseg: csak olvasasra
    window.__ajandek = { allapot: function () { return S.allapot; }, snapshot: function () { return JSON.parse(JSON.stringify({ allapot: S.allapot, termek: S.termek, variant_id: S.variant.variant_id, mod: S.mod, attr: S.attr, urlap: S.urlap, pi: S.pi })); } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
