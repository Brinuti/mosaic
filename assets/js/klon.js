// A Wix sajat szkriptjei helyett ez a fajl adja vissza az oldal viselkedeset.
//
// Nem ujraertelmezi a mukodest: pontosan azokat az osztalyokat es attributumokat
// allitja, amiket az eles oldalon a Wix JS-e allit. Az eles oldalon megmert
// allapotok:
//
//   mobil menu nyitva : MENU_AS_CONTAINER      data-undisplayed="false" + I_VSKP
//                       MENU_AS_CONTAINER_TOGGLE  + d0L2ow
//                       a benne levo .vlJDcR      + d0L2ow
//                       a benne levo .pp3XSB      + sqDofR   (hamburgerbol X)
//                       aria-label: "Navigációs menü bezárása"
//   mobil almenu nyitva: a <li>                 + rErQ82, a gombon aria-expanded="true"
//   asztali legordulo  : az itemWrapper         data-hovered="true" data-shown="true"
//                       a positionBox           style="margin-top: -4px;"
//
// Gorgetesi vagy belepo animaciot szandekosan nem ad hozza semmihez.
(function () {
  'use strict';

  // --- 1. mobil menu --------------------------------------------------
  const menu = document.getElementById('MENU_AS_CONTAINER');
  const kapcsolo = document.getElementById('MENU_AS_CONTAINER_TOGGLE');
  if (menu && kapcsolo) {
    const ikon = kapcsolo.querySelector('.pp3XSB');
    const doboz = kapcsolo.querySelector('.vlJDcR');
    const CIMKE = { nyit: 'Navigációs menü megnyitása', zar: 'Navigációs menü bezárása' };

    const allit = (nyitva) => {
      menu.setAttribute('data-undisplayed', nyitva ? 'false' : 'true');
      menu.classList.toggle('I_VSKP', nyitva);
      kapcsolo.classList.toggle('d0L2ow', nyitva);
      if (doboz) doboz.classList.toggle('d0L2ow', nyitva);
      if (ikon) ikon.classList.toggle('sqDofR', nyitva);
      kapcsolo.setAttribute('aria-label', nyitva ? CIMKE.zar : CIMKE.nyit);
    };
    const valt = () => allit(menu.getAttribute('data-undisplayed') !== 'false');

    kapcsolo.addEventListener('click', valt);
    kapcsolo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); valt(); }
    });
    const fatyol = document.getElementById('overlay-MENU_AS_CONTAINER');
    if (fatyol) fatyol.addEventListener('click', () => allit(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') allit(false); });
  }

  // --- 2. mobil menu lenyilo almenui ----------------------------------
  for (const gomb of document.querySelectorAll('[data-testid="expandablemenu-toggle"]')) {
    gomb.addEventListener('click', (e) => {
      e.preventDefault();
      const tetel = gomb.closest('li');
      if (!tetel) return;
      const nyitva = !tetel.classList.contains('rErQ82');
      tetel.classList.toggle('rErQ82', nyitva);
      gomb.setAttribute('aria-expanded', String(nyitva));
    });
  }

  // --- 3. asztali vizszintes menu legordulo elemei --------------------
  // A Wix a legordulot ra-allassal nyitja. A CSS-ben van :hover szabaly is, de az
  // csak a megamenu-valtozatra vonatkozik, a mi menunket az attributumok nyitjak.
  for (const tetel of document.querySelectorAll('[data-testid="menuItemDepth0"]')) {
    const doboz = tetel.querySelector('[class*="__positionBox"]');
    if (!doboz) continue;

    const mutat = (be) => {
      if (be) {
        tetel.setAttribute('data-hovered', 'true');
        tetel.setAttribute('data-shown', 'true');
        doboz.style.marginTop = '-4px';
      } else {
        tetel.removeAttribute('data-hovered');
        tetel.removeAttribute('data-shown');
        doboz.removeAttribute('style');
      }
    };

    tetel.addEventListener('mouseenter', () => mutat(true));
    tetel.addEventListener('mouseleave', () => mutat(false));
    // billentyuzettel is elerheto legyen
    tetel.addEventListener('focusin', () => mutat(true));
    tetel.addEventListener('focusout', (e) => {
      if (!tetel.contains(e.relatedTarget)) mutat(false);
    });
    const gomb = tetel.querySelector('.itemShared2352141355__accessibilityIcon');
    if (gomb) gomb.addEventListener('click', (e) => {
      e.preventDefault();
      mutat(tetel.getAttribute('data-shown') !== 'true');
    });
  }

  // --- 4. video visszatetele ------------------------------------------
  // Az eles oldalon a Wix Playable lejatszoja tesz egy <video> elemet a
  // .VideoPlayer__playerContainer dobozba. Vezerlogomb nincs: a video magatol
  // indul, nemitva, vegtelenitve. Ugyanezt tesszuk, csak a helyi fajllal.
  // Az eles mobil valtozat egyaltalan nem rak be videot - ezert a klon mobil
  // oldalain sem keresunk semmit.
  const VIDEOK = {
    'comp-m73bstee': 'c2eb0f_909ce4959fe24f4f984d8953fd315d67.mp4',
    'comp-m7j9ka9m1': 'c2eb0f_cc22b1baf4c64848938cb7d48575b561.mp4',
  };
  // a sajat utvonalunkbol olvassuk ki, hova mutassanak a tarsfajlok (klon/ vagy klon/m/)
  const sajatSrc = (document.currentScript && document.currentScript.src) || '';
  const GYOKER = sajatSrc.split('assets/js/klon.js')[0];

  // az eles mobil oldal nem inditja el a lejatszot, ezert ott mi sem tesszuk
  const mobilOldal = !!document.getElementById('wixMobileViewport');

  for (const [azon, fajl] of (mobilOldal ? [] : Object.entries(VIDEOK))) {
    const gazda = document.getElementById(azon);
    if (!gazda) continue;
    const doboz = gazda.querySelector('[data-testid="playable"]');
    if (!doboz || doboz.querySelector('video')) continue;
    const v = document.createElement('video');
    v.src = GYOKER + 'assets/video/' + fajl;
    v.preload = 'none';
    v.autoplay = true;
    v.loop = true;
    v.muted = true;            // enelkul a bongeszo nem inditana el magatol
    v.playsInline = true;
    v.setAttribute('playsinline', 'true');
    // az eles oldalon a lejatszo sajat CSS-e adja ezeket - nalunk a stilus jon ide
    v.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain';
    doboz.appendChild(v);
  }

  // --- 4a. oszlop-hattervideok (wix-video) ----------------------------------
  // A <video> elem megvan a mentesben, csak a forrasa hianyzik: a Wix a
  // data-video-info alapjan tolti be. Ugyanezt tesszuk a helyi fajllal. A mobil
  // mentesekben ilyen elem nincs (az eles mobil oldal is csak a poszterkepet mutatja).
  for (const tarto of document.querySelectorAll('wix-video[data-video-info]')) {
    let info;
    try { info = JSON.parse(tarto.getAttribute('data-video-info')); } catch (e) { continue; }
    const v = tarto.querySelector('video');
    if (!v || v.src || !info.videoId) continue;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = !!info.autoPlay;
    v.style.cssText = 'width:100%;height:100%;object-fit:' + (info.fittingType === 'fill' ? 'cover' : 'contain');
    const poszter = tarto.querySelector('.bgVideoposter');
    v.addEventListener('playing', () => { if (poszter) poszter.style.visibility = 'hidden'; }, { once: true });
    v.src = GYOKER + 'assets/video/' + info.videoId + '.mp4';
  }

  // --- 4b. kattintasra indulo videok (velemeny- es kezelesvideok) ----------
  // A tobbi VideoPlayer-dobozt a Wix poszterkeppel es lejatszas-gombbal rajzolja
  // ki, es kattintasra indul. A klonban ezek a dobozok teljesen uresek (a Wix a
  // tartalmukat kulon JSON-bol tolti) - ez a tablazat mondja meg, melyikbe mi
  // kerul: doboz-azonosito -> Wix videoazonosito. A poszter a
  // assets/img/<azonosito>f000.jpg, a video a assets/video/<azonosito>.mp4.
  //
  // A tablazatot a tools/wix-oldaladatok.mjs kimenetebol kell kitolteni (lasd
  // VIDEOK.md). Amelyik doboz nincs benne, az ures marad, mint eddig.
  const KATTINTOS = {
  };

  const lejatszoGomb = () => {
    const g = document.createElement('button');
    g.type = 'button';
    g.className = 'mh-video-gomb';
    g.setAttribute('aria-label', 'Videó lejátszása');
    g.innerHTML = '<svg viewBox="0 0 40 40" width="50" height="50" fill="currentColor" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="19" fill="rgba(0,0,0,.35)" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M16 12.5v15l12-7.5z"/></svg>';
    return g;
  };

  const videoElem = (azonosito) => {
    const v = document.createElement('video');
    v.src = GYOKER + 'assets/video/' + azonosito + '.mp4';
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('playsinline', 'true');
    return v;
  };

  for (const [azon, azonosito] of Object.entries(KATTINTOS)) {
    const doboz = document.getElementById(azon);
    if (!doboz || doboz.firstElementChild) continue;
    const tarto = document.createElement('div');
    tarto.className = 'mh-video';
    const kep = document.createElement('img');
    kep.src = GYOKER + 'assets/img/' + azonosito + 'f000.jpg';
    kep.alt = '';
    kep.loading = 'lazy';
    const gomb = lejatszoGomb();
    tarto.append(kep, gomb);
    tarto.addEventListener('click', () => tarto.replaceChildren(videoElem(azonosito)), { once: true });
    doboz.appendChild(tarto);
  }

  // --- 4c. videogaleria (Wix Video lista) ------------------------------------
  // A galeria bélyegkepei, cimei es a lejatszas-gombok megvannak, csak kattintasra
  // nem tortenik semmi. A bélyegkep neve <videoazonosito>f002.jpg - ebbol tudjuk,
  // melyik video tartozik hozza. Ha a video helyben megvan (assets/video/), egy
  // felugro lejatszoban inditjuk; ha nincs, a gomb nem csinal semmit, mint eddig.
  const megvan = new Map();
  const letezik = (url) => {
    if (!megvan.has(url)) {
      megvan.set(url, fetch(url, { method: 'HEAD' }).then((r) => r.ok).catch(() => false));
    }
    return megvan.get(url);
  };

  const felugro = (azonosito, cim) => {
    const hatter = document.createElement('div');
    hatter.className = 'mh-felugro';
    hatter.setAttribute('role', 'dialog');
    hatter.setAttribute('aria-label', cim || 'Videó');
    const zar = document.createElement('button');
    zar.type = 'button';
    zar.className = 'mh-felugro-zar';
    zar.setAttribute('aria-label', 'Bezárás');
    zar.textContent = '×';
    const v = videoElem(azonosito);
    hatter.append(v, zar);
    const bezar = () => { v.pause(); hatter.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') bezar(); };
    hatter.addEventListener('click', (e) => { if (e.target === hatter || e.target === zar) bezar(); });
    document.addEventListener('keydown', esc);
    document.body.appendChild(hatter);
    zar.focus();
  };

  // A kiemelt (nagy) video nem a bélyegkep-listaban van, ezert minden
  // lejatszas-gombtol felfele keressuk a legkozelebbi elemet, amiben pontosan egy
  // videohoz tartozo bélyegkep van.
  const POSZTER = /assets\/img\/([a-z0-9]+_[a-f0-9]{32})f00\d\.jpg/g;
  for (const gomb of document.querySelectorAll('[data-hook="overlay-play-button"]')) {
    let elem = gomb.parentElement, azonosito = null;
    for (let i = 0; elem && i < 12; i++, elem = elem.parentElement) {
      const talalt = new Set([...elem.innerHTML.matchAll(POSZTER)].map((m) => m[1]));
      if (talalt.size === 1) { azonosito = [...talalt][0]; break; }
      if (talalt.size > 1) break;
    }
    if (!azonosito) continue;
    const url = GYOKER + 'assets/video/' + azonosito + '.mp4';
    const kep = elem.querySelector('img[alt]');
    const cim = kep ? kep.alt : '';
    gomb.addEventListener('click', (e) => {
      e.preventDefault();
      letezik(url).then((van) => { if (van) felugro(azonosito, cim); });
    });
  }

  // --- 5. beagyazott tartalmak: Trustindex-velemenyek es Google-terkep ------
  // Az eles oldalon ezek a Wix HtmlComponent / GoogleMap dobozaiban, keretben
  // (iframe) jelennek meg. A klonban a dobozok uresek - ide tesszuk vissza oket,
  // ugyanugy keretben, a doboz teljes meretere.
  //
  // Mindketto harmadik feltol tolt be tartalmat, ezert a tajekoztato szerint a
  // "funkcionalis" kategoriaba tartoznak: amig a latogato ezt nem engedte, egy
  // helykitolto all a helyukon, egy gombbal, ami csak ezt a kategoriat engedelyezi.
  const TRUSTINDEX = 'https://cdn.trustindex.io/loader.js?8a7562c424f027774456be130a1';
  const TERKEP = 'https://www.google.com/maps?q=' +
    encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed';
  const TERKEP_LINK = 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.');

  const BEAGYAZASOK = {
    // Trustindex-widget (472x317-es doboz; a velemenyek es a szortelenites
    // oldalon a mellette levo szovegdobozban a Wix-szerkesztobe beirt kod is latszik)
    'comp-m7q9i6yk': 'velemeny',   // head-spa-velemenyek
    'comp-mlg8q2rf5': 'velemeny',  // lezeres-szortelenites-budapest
    'comp-mnmzylj31': 'velemeny',  // oxigenterapia-budapest (ugyanaz a doboz, ugyanakkora)
    'comp-mghyh3i9': 'velemeny',   // index, "olvasd el vendegeinktol" alatt (980x357, mobilon 315x488)
    // Google-terkep
    'comp-m3znoat23': 'terkep', 'comp-m7iq5wws1': 'terkep', 'comp-m7j9kag62': 'terkep',
    'comp-m7kiqhv01': 'terkep', 'comp-m7pxb9eh': 'terkep', 'comp-m7q2fh4v': 'terkep',
    'comp-mciu8zie': 'terkep', 'comp-mghyuypd4': 'terkep', 'comp-micq2kcn': 'terkep',
  };

  const keret = (fajta) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'display:block;width:100%;height:100%;border:0;background:transparent';
    if (fajta === 'terkep') {
      f.title = 'MOSAIC Head Spa térkép - 1023 Budapest, Bécsi út 2.';
      f.src = TERKEP;
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.allowFullscreen = true;
    } else {
      f.title = 'Vendégértékelések';
      f.srcdoc = '<!doctype html><html><head><meta charset="utf-8">' +
        '<style>html,body{margin:0;background:transparent}</style></head><body>' +
        '<script defer async src="' + TRUSTINDEX + '"><\/script></body></html>';
    }
    return f;
  };

  const helykitolto = (fajta) => {
    const h = document.createElement('div');
    h.className = 'mh-helykitolto';
    const szoveg = fajta === 'terkep'
      ? 'A térkép a Google-től töltődik be.'
      : 'A vendégértékelések a Trustindextől töltődnek be.';
    const gomb = fajta === 'terkep' ? 'Térkép megjelenítése' : 'Értékelések megjelenítése';
    h.innerHTML = '<p>' + szoveg + '</p><button type="button">' + gomb + '</button>' +
      (fajta === 'terkep'
        ? '<a href="' + TERKEP_LINK + '" target="_blank" rel="noopener">Megnyitás a Google Térképen</a>'
        : '');
    h.querySelector('button').addEventListener('click', () => {
      if (window.mhSuti) window.mhSuti.enged('fun');
      else kitolt(true);
    });
    return h;
  };

  const kitolt = (engedve) => {
    for (const [azon, fajta] of Object.entries(BEAGYAZASOK)) {
      const doboz = document.getElementById(azon);
      if (!doboz) continue;
      const most = doboz.firstElementChild;
      if (engedve) {
        if (most && most.tagName === 'IFRAME') continue;
        doboz.replaceChildren(keret(fajta));
      } else if (!most) {
        doboz.appendChild(helykitolto(fajta));
      }
    }
  };

  if (window.mhSuti) {
    kitolt(window.mhSuti.engedely('fun'));
    window.mhSuti.figyel((d) => { if (d.fun) kitolt(true); });
  } else {
    kitolt(true);
  }
})();
