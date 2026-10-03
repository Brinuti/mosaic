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
    $('ah-hero-cta').textContent = c.hero_cta;
    var lista = uresit($('ah-hero-bizalom'));
    c.hero_trust.forEach(function (sor) {
      var li = h('li');
      var m = /^★+/.exec(sor);
      if (m) { li.appendChild(h('span', { class: 'ah-csillag', 'aria-hidden': 'true', text: m[0] })); li.appendChild(document.createTextNode(sor.slice(m[0].length))); }
      else li.textContent = sor;
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
    $('ah-proof-forras').textContent = '★★★★★ ' + p.forras;
    $('ah-proof').classList.toggle('ah-helyorzo', !p.valodi);
  }

  // ---------------------------------------------------------------- GiftFinder
  function finderRender() {
    var racs = uresit($('ah-finder-racs'));
    A.FINDER.forEach(function (f) {
      var gomb = h('button', { type: 'button', class: 'ah-valasz', 'data-finder': f.id, 'aria-pressed': S.finder === f.id ? 'true' : 'false' },
        h('strong', { text: f.cim }), h('span', { text: f.leiras }), h('em', { text: '→ ' + f.nyil }));
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
    // jelvenyek egy sorban: a termek sajat jelvenye (pl. PREMIUM ELMENY) + a Gift Finder "AJANLOTT" jelzese
    kartya.appendChild(h('div', { class: 'ah-jelvenyek', 'data-jelvenyek': t.id, hidden: !t.badge },
      t.badge ? h('p', { class: 'ah-badge', text: t.badge }) : null,
      h('p', { class: 'ah-badge ah-badge-ajanlott', 'data-ajanlott-jel': t.id, text: 'AJÁNLOTT', hidden: true })));
    kartya.appendChild(h('h3', { text: t.nev }));
    kartya.appendChild(h('p', { class: 'ah-termek-fejlec', text: t.fejlec }));
    kartya.appendChild(h('p', { class: 'ah-termek-leiras', text: t.leiras }));
    var ul = h('ul', { class: 'ah-lista' });
    t.tartalom.forEach(function (sor) { ul.appendChild(h('li', { text: sor })); });
    kartya.appendChild(ul);
    kartya.appendChild(h('p', { class: 'ah-ar', text: A.arSzoveg(t.ar_ft) }));
    kartya.appendChild(h('button', { type: 'button', class: 'ah-gomb ah-gomb-fo', 'data-valaszt': t.id, text: 'Ezt választom' }));
    return kartya;
  }
  function termekekRender() {
    var racs = uresit($('ah-termek-racs'));
    S.variant.product_order.forEach(function (id) { var t = termek(id); if (t) racs.appendChild(termekKartya(t)); });
    ajanlottJelol(S.finder ? (A.FINDER.filter(function (x) { return x.id === S.finder; })[0] || {}).termek : null);
    valasztottJelol();
  }
  function ajanlottJelol(id) {
    Array.prototype.forEach.call(document.querySelectorAll('.ah-termek'), function (k) {
      var az = k.getAttribute('data-termek') === id;
      k.classList.toggle('ah-ajanlott', az);
      var jel = k.querySelector('[data-ajanlott-jel]');
      if (jel) jel.hidden = !az;
      var sor = k.querySelector('[data-jelvenyek]');
      if (sor) sor.hidden = !(az || (termek(k.getAttribute('data-termek')) || {}).badge);
    });
  }
  function valasztottJelol() {
    Array.prototype.forEach.call(document.querySelectorAll('.ah-termek'), function (k) {
      var az = k.getAttribute('data-termek') === S.termek && S.allapot !== 'bongeszes';
      k.classList.toggle('ah-valasztott', az);
      var g = k.querySelector('[data-valaszt]');
      if (g) {
        g.textContent = az ? 'Kiválasztva ✓' : 'Ezt választom';
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
    var lista = uresit($('ah-kiv-lista'));
    t.tartalom.forEach(function (sor) { lista.appendChild(h('li', { text: sor })); });
    $('ah-kiv-ar').textContent = A.arSzoveg(t.ar_ft);
    // "Perceken belul" csak garantalt teljesites mellett: a szerver /beallitas mondja meg (azonnali_kartya)
    $('ah-kiv-kezbesites').textContent = S.azonnali ? 'Perceken belül az e-mailedben.' : 'Sikeres fizetés után e-mailben kapod meg.';
  }
  function osszesitoRender() {
    var t = termek(S.termek);
    if (!t) return;
    $('ah-osszesito-nev').textContent = t.kartya_cim;
    var lista = uresit($('ah-osszesito-lista'));
    t.tartalom.filter(function (s) { return !/felhasználható/.test(s); }).forEach(function (sor) { lista.appendChild(h('li', { text: sor })); });
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
            payment_method_data: { billing_details: { name: o.nev, email: o.email, address: { line1: o.cim, city: o.varos, postal_code: o.iranyitoszam, country: 'HU' } } }
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
  function atutalasKer() {
    var panel = $('ah-atutalas');
    var gomb = $('ah-atutalas-gomb');
    if (panel.getAttribute('data-kesz')) { // mar elkuldtuk: csak ki-be kapcsoljuk, nem kuldjuk ujra
      panel.hidden = !panel.hidden;
      gomb.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      return;
    }
    var o = validal();
    if (!o) return;
    gomb.setAttribute('aria-expanded', 'true');
    uresit(panel).appendChild(h('p', { text: 'Elküldjük az utalási adatokat…' }));
    panel.hidden = false;
    var kerelem = szamlazasiAdat(o);
    kerelem['bot-field'] = $('ah-csapda').value;
    api('atutalas', { json: kerelem }).then(function (v) {
      if (v.status !== 200 || !v.adat.ok) { throw new Error('atutalas'); }
      var u = v.adat.utalas || {};
      uresit(panel);
      panel.setAttribute('data-kesz', '1');
      panel.appendChild(h('h3', { text: 'Átutalással fizetek' }));
      panel.appendChild(h('p', { text: 'Elküldtük az utalási adatokat a(z) ' + o.email + ' címre. Az ajándékkártyát az utalás beérkezése után készítjük el.' }));
      var dl = h('dl', { class: 'ah-meta' });
      [['Kedvezményezett', u.kedvezmenyezett], ['Számlaszám', u.szamlaszam], ['Összeg', A.arSzoveg(u.osszeg_ft)], ['Közlemény', u.kozlemeny]].forEach(function (p) {
        dl.appendChild(h('div', null, h('dt', { text: p[0] }), h('dd', { text: p[1] || '' })));
      });
      panel.appendChild(dl);
      panel.appendChild(h('p', { class: 'ah-kicsi ah-halk', text: 'Ez még nem vásárlás: az ajándékkártya az utalás beérkezése után készül el.' }));
      mer('bank_transfer_request', { ecommerce: { currency: A.PENZNEM, value: osszegFt(), items: [tetel(termek(S.termek))] }, product_type: termek(S.termek).product_type, payment_method: 'bank_transfer' });
    }).catch(function () {
      uresit(panel).appendChild(h('p', { class: 'ah-mezohiba', text: 'Nem sikerült elküldeni az utalási adatokat. Próbáld újra, vagy hívj minket: 06 20 247 4444.' }));
    });
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
      hely.appendChild(h('p', { class: 'ah-kartya-megjegyzes', text: S.azonnali ? 'Perceken belül itt és az e-mailedben is megjelenik.' : 'Elkészültekor itt megjelenik, és e-mailben is megkapod.' }));
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
    $('ah-segitseg-gomb').addEventListener('click', function () {
      var p = $('ah-segitseg'), nyit = p.hidden;
      p.hidden = !nyit;
      this.setAttribute('aria-expanded', nyit ? 'true' : 'false');
    });
    $('ah-szemelyre-urlap').addEventListener('submit', szemelyreMent);
    $('ah-sz-kihagy').addEventListener('click', szemelyreKihagy);
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
    // mar fizetett rendeles ugyanabban a sessionben: frissites utan is az utan-nezet - de csak rovid ideig, es egy
    // uj hirdetesi kattintas (UTM / click-azonosito az URL-ben) tiszta lappal indul, hogy ujabb ajandekot lehessen venni
    var friss = S.fizetveIdo && Date.now() - S.fizetveIdo < 2 * 3600 * 1000 && !ujAttr;
    if (S.utanAllapot && !friss) { S.pi = null; S.cs = null; S.rt = null; S.csakOlvas = false; S.utanAllapot = null; S.fizetveIdo = 0; ment(); }
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

  function init() {
    // a statikus tartalom a config-bol (a komponensfa nem valtozik, csak a tartalom)
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
