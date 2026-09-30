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
  // Az eles mobil valtozat ezt a kettot nem inditja el magatol, hanem poszterrel
  // es lejatszas-gombbal mutatja - ott a 4b. pont (KATTINTOS) tolti ki oket.
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
    hangGomb(doboz, v);
  }

  // A hero-video fölött a Wixen is ott a felirat: "hangot ra!" - a nemitva
  // induló videóhoz kell egy hanggomb. Kattintasra az elejerol, hanggal indul.
  function hangGomb(doboz, v) {
    doboz.style.position = 'relative';
    const g = document.createElement('button');
    g.type = 'button';
    g.className = 'mh-hang';
    const allit = () => {
      g.setAttribute('aria-label', v.muted ? 'Hang bekapcsolása' : 'Hang kikapcsolása');
      g.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">' +
        '<path d="M3 9v6h4l5 5V4L7 9H3z"/>' +
        (v.muted
          ? '<path d="M16 9l5 5m0-5l-5 5" stroke="currentColor" stroke-width="2" fill="none"/>'
          : '<path d="M16.5 12a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/>') +
        '</svg><span>' + (v.muted ? 'Hangot rá!' : '') + '</span>';
    };
    const valt = () => {
      if (v.muted) { v.muted = false; v.currentTime = 0; } else v.muted = true;
      v.play().catch(() => {});
      allit();
    };
    g.addEventListener('click', (e) => { e.stopPropagation(); valt(); });
    v.addEventListener('click', valt);
    v.style.cursor = 'pointer';
    allit();
    doboz.appendChild(g);
  }

  // Mobilon a Wix nem inditja el magatol a hero-videot, hanem a sajat
  // poszterkepevel es lejatszas-gombbal mutatja - ezt a 4b. pont (KATTINTOS)
  // adja, kattintasra hanggal indul.

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
    // A Wix CSS-e a videot atlatszonak tartja (.X9nqm0 {opacity:0}), es a sajat
    // JS-e teszi lathatova, amikor elindult - ugyanigy teszunk, kulonben a
    // poszter eltunese utan ures marad a helye.
    v.addEventListener('playing', () => {
      v.style.opacity = '1';
      if (poszter) poszter.style.visibility = 'hidden';
    }, { once: true });
    v.src = GYOKER + 'assets/video/' + info.videoId + '.mp4';
  }

  // --- 4b. kattintasra indulo videok (velemeny- es kezelesvideok) ----------
  // A tobbi VideoPlayer-dobozt a Wix poszterkeppel es lejatszas-gombbal rajzolja
  // ki, es kattintasra indul. A klonban ezek a dobozok teljesen uresek (a Wix a
  // tartalmukat kulon JSON-bol tolti) - ez a tablazat mondja meg, melyikbe mi
  // kerul: doboz-azonosito -> '<Wix videoazonosito>/<poszterkocka>'. A poszter a
  // assets/img/<azonosito><kocka>.jpg, a video a assets/video/<azonosito>.mp4.
  //
  // A tablazat a tools/wix-oldaladatok.json 'lejatszo' mezoibol keszult (lasd
  // VIDEOK.md), a fajlokat a tools/videok-letoltese.mjs tolti le. Az asztali es a
  // mobil oldal ugyanazokat a dobozokat hasznalja. A ket magatol indulo video
  // (comp-m73bstee, comp-m7j9ka9m1) mobilon szinten kattintasra indul - az eles
  // mobil oldalon is -, asztalin a 4. pont tolti ki oket, ezert ott kimaradnak.
  const KATTINTOS = {
    // 4-kezes-headspa-ajandekkartya
    'comp-micq2kak2': 'c2eb0f_7c74e304d3394deeb1101d7612e658ce/f001',
    'comp-micq2kam1': 'c2eb0f_ecca71a0b1ec412cbb80698cfd5cc50f/f001',
    'comp-micq2kan2': 'c2eb0f_3b9f1c40760f4809b8e590f7ca2b0329/f002',
    // balayage-haj-festes-budapest
    'comp-mrypn3dp': 'c2eb0f_1f095db5b74d4ceea9ddf64a78da9586/f000',
    // head-spa-velemenyek
    'comp-m7qaffi5': 'c2eb0f_7c74e304d3394deeb1101d7612e658ce/f001',
    'comp-m7qaffie': 'c2eb0f_ecca71a0b1ec412cbb80698cfd5cc50f/f001',
    'comp-m7qaffig1': 'c2eb0f_3b9f1c40760f4809b8e590f7ca2b0329/f002',
    'comp-m7qagb0l': 'c2eb0f_9ede44a0586f41c0b76b4dc0f7b91fec/f002',
    'comp-m7qah6zi': 'c2eb0f_4a41bc381a7844d6ac0d05e774bcb8ed/f002',
    'comp-m9beyies': 'c2eb0f_ae591f491e2d4231925c7762b32435cb/f001',
    'comp-m9bfcphn': 'c2eb0f_9fb46d0b1a044eb5b3c958bb9db91cc5/f001',
    'comp-m9bfcrq3': 'c2eb0f_c03c84ffdffa4cc19e27577c6aa34cd5/f002',
    'comp-m9bfcztz': 'c2eb0f_a257ba46eb394befa925dce60d484434/f002',
    'comp-m9bfd2ds': 'c2eb0f_b14d6ca682e14e55a6a425915039caab/f001',
    'comp-m9bfd5s6': 'c2eb0f_40c49eeb3c6b4d9582872ddea9eff3e9/f002',
    'comp-m9bfdaht': 'c2eb0f_906e91e58e2a43b9bd71c91245be8096/f001',
    'comp-m9bfddxx': 'c2eb0f_f2b260f36e3848fdb57e3d9aa955d050/f001',
    'comp-m9bfdiyk': 'c2eb0f_a04d5f3451404517985437fe74ecc985/f001',
    'comp-m9bfft86': 'c2eb0f_59775b73467e41ef9e7b83538eb81001/f001',
    // headspa-ajandekkartya
    'comp-m7iovsj6': 'c2eb0f_909ce4959fe24f4f984d8953fd315d67/f001',
    'comp-m7ip9jhk4': 'c2eb0f_7c74e304d3394deeb1101d7612e658ce/f001',
    'comp-m7ip9jhn4': 'c2eb0f_ecca71a0b1ec412cbb80698cfd5cc50f/f001',
    'comp-m7ip9jhp': 'c2eb0f_3b9f1c40760f4809b8e590f7ca2b0329/f002',
    // headspa-budapest
    'comp-m7hojhow': 'c2eb0f_3b9f1c40760f4809b8e590f7ca2b0329/f002',
    'comp-m7hqx89t': 'c2eb0f_909ce4959fe24f4f984d8953fd315d67/f001',
    // headspa-budapest-hungary
    'comp-m7j9ka9m1': 'c2eb0f_cc22b1baf4c64848938cb7d48575b561/f001',
    'comp-m7j9kabl6': 'c2eb0f_37fec91bc51845e6957fe64382bbff06/f001',
    'comp-m7j9kabn1': 'c2eb0f_10121cae642848349dc372ccb6bca66e/f002',
    'comp-m7j9kabo5': 'c2eb0f_b8ca665737504be3b704a03c8c804111/f002',
    'comp-m7j9kac93': 'c2eb0f_0cb96191fdeb4a7683abc456dce91200/f001',
    // index
    'comp-m73bstee': 'c2eb0f_909ce4959fe24f4f984d8953fd315d67/f000',
    'comp-mcx91b5p': 'c2eb0f_ae591f491e2d4231925c7762b32435cb/f001',
    'comp-mcx91b6t1': 'c2eb0f_c03c84ffdffa4cc19e27577c6aa34cd5/f002',
    'comp-mcx91b6w': 'c2eb0f_9fb46d0b1a044eb5b3c958bb9db91cc5/f001',
    'comp-mcx91b6y': 'c2eb0f_a257ba46eb394befa925dce60d484434/f002',
    'comp-mcx91b6z2': 'c2eb0f_b14d6ca682e14e55a6a425915039caab/f001',
    'comp-mcx91b71': 'c2eb0f_40c49eeb3c6b4d9582872ddea9eff3e9/f002',
    'comp-mcx91b724': 'c2eb0f_f2b260f36e3848fdb57e3d9aa955d050/f001',
    'comp-mcx91b75': 'c2eb0f_906e91e58e2a43b9bd71c91245be8096/f001',
    'comp-mcx91b762': 'c2eb0f_a04d5f3451404517985437fe74ecc985/f001',
    'comp-mcx91b781': 'c2eb0f_59775b73467e41ef9e7b83538eb81001/f001',
    'comp-mcxa1fja1': 'c2eb0f_7c74e304d3394deeb1101d7612e658ce/f001',
    'comp-mcxa1fk2': 'c2eb0f_ecca71a0b1ec412cbb80698cfd5cc50f/f001',
    'comp-mcxa1fk4': 'c2eb0f_3b9f1c40760f4809b8e590f7ca2b0329/f002',
    'comp-mcxa1fk6': 'c2eb0f_9ede44a0586f41c0b76b4dc0f7b91fec/f002',
    'comp-mcxa1fk82': 'c2eb0f_4a41bc381a7844d6ac0d05e774bcb8ed/f002',
    // lezeres-szortelenites-budapest
    'comp-mo8el1a3': 'c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0/f000',
    // noi-fodrasz-budapest-balayage-hajfestes
    'comp-m5p8g24q': 'c2eb0f_d0737d55559445caa0687b3c2017518a/f002',
    // noi-fodraszat-budapest
    'comp-mb6gkw8b': 'c2eb0f_d0737d55559445caa0687b3c2017518a/f000',
    'comp-mceuvvuv': 'c2eb0f_02d4a83e09c84997a1af28ff3d2f4516/f002',
    // noi-hajfestes-budapest
    'comp-mc7ays5b': 'c2eb0f_d1d7131a5e48466599172992ad24c321/f000',
    // oxigenterapia-budapest
    'comp-mciu8zc12': 'c2eb0f_360d73a2bc224690bb9d79edb4f6ed91/f001',
    // sminktetovalas-budapest
    'comp-mu6upovp': 'c2eb0f_a4af4c18f0f64aff93f4c57ed0fb326e/f000',
  };

  function lejatszoGomb() {
    const g = document.createElement('button');
    g.type = 'button';
    g.className = 'mh-video-gomb';
    g.setAttribute('aria-label', 'Videó lejátszása');
    g.innerHTML = '<svg viewBox="0 0 40 40" width="50" height="50" fill="currentColor" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="19" fill="rgba(0,0,0,.35)" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M16 12.5v15l12-7.5z"/></svg>';
    return g;
  }

  const videoElem = (azonosito) => {
    const v = document.createElement('video');
    v.src = GYOKER + 'assets/video/' + azonosito + '.mp4';
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('playsinline', 'true');
    return v;
  };

  for (const [azon, ertek] of Object.entries(KATTINTOS)) {
    const doboz = document.getElementById(azon);
    if (!doboz || doboz.firstElementChild) continue;
    const [azonosito, kocka] = ertek.split('/');
    const tarto = document.createElement('div');
    tarto.className = 'mh-video';
    const kep = document.createElement('img');
    kep.src = GYOKER + 'assets/img/' + azonosito + kocka + '.jpg';
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

  // --- 5. beagyazott tartalmak: HTML-beagyazasok es Google-terkep ----------
  // Az eles oldalon ezek a Wix HtmlComponent / GoogleMap dobozaiban, keretben
  // (iframe) jelennek meg. A klonban a dobozok uresek - ide tesszuk vissza oket,
  // ugyanugy keretben, a doboz teljes meretere. A HtmlComponent-ek tartalmat a Wix
  // a www-mosaicheadspa-hu.filesusr.com/html/<nev>.htm cimrol tolti; ezeket
  // valtozatlanul letoltottuk az assets/embed/ ala (tools/wix-oldaladatok.json).
  //
  // Mindegyik harmadik feltol tolt be tartalmat (Trustindex, Common Ninja,
  // Google), ezert a tajekoztato szerint a "funkcionalis" kategoriaba tartoznak:
  // amig a latogato ezt nem engedte, egy helykitolto all a helyukon, egy gombbal,
  // ami csak ezt a kategoriat engedelyezi.
  const TERKEP = 'https://www.google.com/maps?q=' +
    encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.') + '&output=embed';
  const TERKEP_LINK = 'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('MOSAIC Head Spa, 1023 Budapest, Bécsi út 2.');

  // assets/embed/<nev>.html -> [cim, szolgaltato]
  const EMBEDEK = {
    'c2eb0f_614b09d160b9382c4cffcde6d7828dcb': ['Vendégértékelések', 'Trustindex'],
    'c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6': ['Vendégértékelések', 'Trustindex'],
    'c2eb0f_e2a637ece2437154df156d36cae403f4': ['Gyakori kérdések', 'Common Ninja'],
    'c2eb0f_dab261d3e84629df7798238e716f0266': ['Gyakori kérdések', 'Common Ninja'],
    'c2eb0f_97df67cb524ad4ad76e22fddea2496e5': ['Gyakori kérdések', 'Common Ninja'],
    'c2eb0f_7101a51e50aef2435d5ed679e90074d4': ['Gyakori kérdések', 'Common Ninja'],
    'c2eb0f_193bec926d66321bf99ada19cf4105a5': ['Gyakori kérdések', 'Common Ninja'],
    'c2eb0f_89f74d4c7a84ec25afa7aad7f0133562': ['Árlista', 'Common Ninja'],
    'c2eb0f_ebe819c8a20603ef818d0ff477702c21': ['Árlista', 'Common Ninja'],
  };

  // doboz -> 'terkep' vagy egy EMBEDEK-kulcs
  const BEAGYAZASOK = {
    // Trustindex-widget (a velemenyek es a szortelenites oldalon a mellette levo
    // szovegdobozban a Wix-szerkesztobe beirt kod is latszik - az eles oldalon is)
    'comp-m7q9i6yk': 'c2eb0f_614b09d160b9382c4cffcde6d7828dcb',   // head-spa-velemenyek
    'comp-mlg8q2rf5': 'c2eb0f_614b09d160b9382c4cffcde6d7828dcb',  // lezeres-szortelenites-budapest
    'comp-mnmzylj31': 'c2eb0f_614b09d160b9382c4cffcde6d7828dcb',  // oxigenterapia-budapest
    'comp-mghyh3i9': 'c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6',   // index ("olvasd el vendegeinktol")
    // arlistak (Common Ninja)
    'comp-mb6gc2i53': 'c2eb0f_89f74d4c7a84ec25afa7aad7f0133562',  // noi-fodraszat-budapest
    'comp-m5p3vva4': 'c2eb0f_89f74d4c7a84ec25afa7aad7f0133562',   // noi-fodrasz-budapest-balayage-hajfestes
    'comp-metxv9d0': 'c2eb0f_89f74d4c7a84ec25afa7aad7f0133562',   // noi-hajfestes-budapest
    'comp-mb6g8h6k': 'c2eb0f_ebe819c8a20603ef818d0ff477702c21',   // balayage-haj-festes-budapest
    // Google-terkep
    'comp-m3znoat23': 'terkep', 'comp-m7iq5wws1': 'terkep', 'comp-m7j9kag62': 'terkep',
    'comp-m7kiqhv01': 'terkep', 'comp-m7pxb9eh': 'terkep', 'comp-m7q2fh4v': 'terkep',
    'comp-mciu8zie': 'terkep', 'comp-mghyuypd4': 'terkep', 'comp-micq2kcn': 'terkep',
  };

  const keret = (fajta) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'display:block;width:100%;height:100%;border:0;background:transparent';
    f.loading = 'lazy';
    if (fajta === 'terkep') {
      f.title = 'MOSAIC Head Spa térkép - 1023 Budapest, Bécsi út 2.';
      f.src = TERKEP;
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.allowFullscreen = true;
    } else {
      f.title = EMBEDEK[fajta][0];
      f.src = GYOKER + 'assets/embed/' + fajta + '.html';
      f.allowFullscreen = true;
    }
    return f;
  };

  const helykitolto = (fajta) => {
    const h = document.createElement('div');
    h.className = 'mh-helykitolto';
    const [cim, kitol] = fajta === 'terkep' ? ['Térkép', 'Google'] : EMBEDEK[fajta];
    const szoveg = cim + ': a tartalom külső szolgáltatótól (' + kitol + ') töltődik be.';
    const gomb = cim + ' megjelenítése';
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
  // --- 5b. GYIK: sajat harmonika a Common Ninja widget helyett ------------------
  // Az eles oldalon a GYIK-ok fizetos Common Ninja widgetek, fix magassagu
  // keretben (a fooldalon ketto egymas alatt, alattuk sok ures hellyel). Helyettuk
  // sajat harmonika all, a szoveg az assets/js/gyik.js-bol jon (tools/gyik.mjs).
  // A doboz magassaga a tartalomhoz igazodik; a ketreszes GYIK-oknal az elso
  // dobozba kerul a teljes lista, a masodik eltunik.
  const GYIK = window.MH_GYIK || {};
  const GYIK_DOBOZOK = {
    'comp-m5m8txa6': 'fooldal', 'comp-m5m8w3ok': null,          // index
    'comp-m7kiqhte': 'fooldal', 'comp-m7kiqhtg1': null,         // headspa-ferfiaknak
    'comp-m7pxb9cs': 'fooldal', 'comp-m7pxb9cu': null,          // paros-headspa-budapest
    'comp-m7io5w964': 'masodik',                                // headspa-ajandekkartya
    'comp-micq2kau4': 'masodik',                                // 4-kezes-headspa-ajandekkartya
    'comp-mlg8q2yy2': 'szortelenites',                          // lezeres-szortelenites-budapest
    'comp-mciu8zgq': 'oxigen',                                  // oxigenterapia-budapest
  };
  for (const [azon, nev] of Object.entries(GYIK_DOBOZOK)) {
    const doboz = document.getElementById(azon);
    if (!doboz) continue;
    if (!nev || !GYIK[nev]) { doboz.classList.add('mh-gyik-rejtett'); continue; }
    const lista = document.createElement('div');
    lista.className = 'mh-gyik';
    GYIK[nev].forEach(([kerdes, valasz], i) => {
      const tetel = document.createElement('div');
      tetel.className = 'mh-gyik-tetel';
      const gomb = document.createElement('button');
      gomb.type = 'button';
      gomb.id = azon + '-k' + i;
      gomb.setAttribute('aria-expanded', 'false');
      gomb.setAttribute('aria-controls', azon + '-v' + i);
      gomb.innerHTML = '<span>' + kerdes + '</span><i aria-hidden="true"></i>';
      const panel = document.createElement('div');
      panel.className = 'mh-gyik-valasz';
      panel.id = azon + '-v' + i;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', gomb.id);
      panel.hidden = true;
      panel.innerHTML = valasz;
      gomb.addEventListener('click', () => {
        const nyitva = gomb.getAttribute('aria-expanded') === 'true';
        gomb.setAttribute('aria-expanded', String(!nyitva));
        panel.hidden = nyitva;
      });
      tetel.append(gomb, panel);
      lista.appendChild(tetel);
    });
    doboz.classList.add('mh-gyik-doboz');
    doboz.replaceChildren(lista);
  }

  // --- 6. Wix "fluid-columns-repeater" (pl. a head spa arkartyak) ---------
  // A Wix sajat eleme rejtve (visibility:hidden) erkezik, es a JS-e teszi
  // lathatova, miutan a hezagokat CSS-valtozokba irta. Ugyanezt tesszuk a
  // horizontal-gap / vertical-gap attributumokbol.
  for (const r of document.querySelectorAll('fluid-columns-repeater')) {
    const h = Number(r.getAttribute('horizontal-gap')) || 0;
    const f = Number(r.getAttribute('vertical-gap')) || 0;
    r.style.setProperty('--item-margin', (f / 2) + 'px ' + (h / 2) + 'px');
    r.style.setProperty('--margin-top', (-f / 2) + 'px');
    r.style.setProperty('--margin-bottom', (-f / 2) + 'px');
    r.style.setProperty('--margin-inline-start', (-h / 2) + 'px');
    r.style.setProperty('--margin-inline-end', (-h / 2) + 'px');
    r.style.visibility = 'visible';
  }
  // --- 7. Wix Pro Gallery lapozo ----------------------------------------------
  // A lapozos galeriakbol a Wix HTML-je csak az elso ket kepet es egy "kovetkezo"
  // nyilat rajzol ki, a tobbit es a mukodest a sajat JS-e adja. A teljes
  // kepllista az assets/js/galeriak.js-ben van (tools/galeriak.mjs). A dia a
  // galeria meretet tolti ki (a Wix "fill" / "fit" beallitasa szerint), a
  // nyilak es a bélyegkepek lapoznak, a vegen korbeer.
  const GALERIAK = window.MH_GALERIAK || {};
  for (const tarto of document.querySelectorAll('.pro-gallery.slider[id^="pro-gallery-container-"]')) {
    const lista = GALERIAK[tarto.id.replace('pro-gallery-container-', '')];
    const gorgeto = tarto.querySelector('.gallery-horizontal-scroll');
    const belso = tarto.querySelector('.gallery-horizontal-scroll-inner');
    if (!lista || lista.length < 2 || !gorgeto || !belso) continue;

    const illeszt = tarto.querySelector('.cube-type-fit') ? 'contain' : 'cover';
    gorgeto.style.overflow = 'hidden';
    gorgeto.classList.remove('scroll-snap');
    belso.style.cssText = 'display:flex;height:100%;transition:transform .45s ease';
    belso.replaceChildren(...lista.map(([kep, alt], i) => {
      const dia = document.createElement('div');
      dia.style.cssText = 'flex:0 0 100%;height:100%';
      const img = document.createElement('img');
      img.src = GYOKER + 'assets/img/' + kep;
      img.alt = alt;
      img.loading = i < 2 ? 'eager' : 'lazy';
      img.style.cssText = 'display:block;width:100%;height:100%;object-fit:' + illeszt;
      dia.appendChild(img);
      return dia;
    }));

    // bélyegkepek: az elso kettobol vesszuk a meretet es a lepeskozt
    const oszlop = tarto.parentElement.querySelector('[data-hook="gallery-thumbnails-column"]');
    let belyegek = [];
    if (oszlop) {
      const minta = oszlop.querySelectorAll('.thumbnailItem');
      const lepes = minta.length > 1 ? parseFloat(minta[1].style.left) - parseFloat(minta[0].style.left) : 0;
      if (minta.length && lepes > 0) {
        const alapStilus = minta[0].getAttribute('style').replace(/background-image:[^;]*;?/, '').replace(/left:[^;]*;?/, '');
        belyegek = lista.map(([kep], i) => {
          const b = document.createElement('div');
          b.className = 'thumbnailItem';
          b.setAttribute('style', alapStilus + ';background-image:url(' + GYOKER + 'assets/img/' + kep + ');left:' + (i * lepes) + 'px;cursor:pointer');
          b.addEventListener('click', () => ugrik(i));
          return b;
        });
        oszlop.replaceChildren(...belyegek);
        oszlop.style.transition = 'left .45s ease';
        oszlop.dataset.lepes = String(lepes);
      }
    }

    let most = 0;
    const ugrik = (i) => {
      most = (i + lista.length) % lista.length;
      belso.style.transform = 'translateX(' + (-100 * most) + '%)';
      belyegek.forEach((b, j) => b.classList.toggle('pro-gallery-highlight', j === most));
      if (oszlop && belyegek.length) {
        // az aktiv bélyegkep maradjon lathato: kozepre gorgetjuk, a szeleken megallva
        const lepes = Number(oszlop.dataset.lepes);
        const lathato = oszlop.parentElement.clientWidth;
        const teljes = belyegek.length * lepes;
        const eltolas = Math.max(0, Math.min(teljes - lathato, most * lepes - (lathato - lepes) / 2));
        oszlop.style.left = (-eltolas) + 'px';
      }
    };

    const kovetkezo = tarto.querySelector('[data-hook="nav-arrow-next"]');
    if (kovetkezo) {
      const elozo = kovetkezo.cloneNode(true);
      elozo.setAttribute('data-hook', 'nav-arrow-prev');
      elozo.setAttribute('aria-label', 'Previous Item');
      elozo.style.right = '';
      elozo.style.left = kovetkezo.style.right || '23px';
      const nyil = elozo.querySelector('svg');
      if (nyil) nyil.style.transform = 'scaleX(-1)';
      kovetkezo.after(elozo);
      kovetkezo.addEventListener('click', (e) => { e.preventDefault(); ugrik(most + 1); });
      elozo.addEventListener('click', (e) => { e.preventDefault(); ugrik(most - 1); });
    }

    // erinto-kepernyon huzassal is lapozhato
    let startX = null;
    gorgeto.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    gorgeto.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const d = e.clientX - startX;
      startX = null;
      if (Math.abs(d) > 40) ugrik(most + (d < 0 ? 1 : -1));
    });
    ugrik(0);
  }
})();
