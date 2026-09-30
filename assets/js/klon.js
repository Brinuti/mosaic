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
