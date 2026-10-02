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
  // mobilon a kisebb (max. 1000 px szeles) kepvaltozatok: assets/img/m/ (tools/mobil-kepek.py + build)
  const KEPEK = GYOKER + (mobilOldal ? 'assets/img/m/' : 'assets/img/');

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
  // Hangsav nelkuli videok: a Wixre feltoltott eredeti fajlban sincs hang
  // (video.wixstatic.com/video/<id>/file) - ezekre nem teszunk hanggombot.
  const NEMA_VIDEOK = new Set(['c2eb0f_c49cecf68dc14cdf99207280fb646f62']);

  // A hattervideo csak akkor toltodik, amikor a latogato a kozelebe gorget (a kepernyo
  // tetejen levo azonnal) - igy a lejjebb levo, tobb MB-os videok nem lassitjak a betoltest.
  const kozelben = (elem, fn) => {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver((bej) => {
      if (bej.some((b) => b.isIntersecting)) { io.disconnect(); fn(); }
    }, { rootMargin: '800px 0px' });
    io.observe(elem);
  };

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
    kozelben(tarto, () => { v.src = GYOKER + 'assets/video/' + info.videoId + '.mp4'; });
    const oszlop = document.getElementById(info.containerId);
    if (oszlop && !NEMA_VIDEOK.has(info.videoId)) hangGomb(oszlop, v);
  }

  // Mobilon a Wix a hattervideo helyen csak a poszterkepet mutatja. A kert
  // viselkedes szerint ott is mozogjon: a poszter fole ugyanazt a videot tesszuk.
  // (doboz -> videoazonosito; csak az asztalin is lejatszodo hattervideok.)
  const MOBIL_HATTERVIDEOK = {
    'comp-m7qdhnhw': 'c2eb0f_c49cecf68dc14cdf99207280fb646f62',   // index
    'comp-m7ith1w21': 'c2eb0f_7c74e304d3394deeb1101d7612e658ce',  // headspa-ajandekkartya
  };
  if (mobilOldal) {
    for (const [azon, videoId] of Object.entries(MOBIL_HATTERVIDEOK)) {
      const media = document.getElementById('bgMedia_' + azon);
      const oszlop = document.getElementById(azon);
      if (!media || !oszlop || media.querySelector('video')) continue;
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.autoplay = true;
      v.playsInline = true;
      v.setAttribute('playsinline', 'true');
      v.preload = 'auto';
      v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
      media.style.position = 'relative';
      media.appendChild(v);
      kozelben(media, () => { v.src = GYOKER + 'assets/video/' + videoId + '.mp4'; });
      if (!NEMA_VIDEOK.has(videoId)) hangGomb(oszlop, v);
    }
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

  // a kesobb athozott oldalak dobozai (tools/oldaltablak.mjs -> assets/js/oldaltablak.js)
  const TABLAK = window.MH_TABLAK || {};
  Object.assign(KATTINTOS, TABLAK.kattintos);

  for (const [azon, ertek] of Object.entries(KATTINTOS)) {
    const doboz = document.getElementById(azon);
    if (!doboz) continue;
    const [azonosito, kocka, mod] = ertek.split('/');
    // a build (netlify-build.mjs) a poszter + gomb HTML-jet mar beirta: csak a kattintast kotjuk ra
    const kesz = doboz.querySelector(':scope > .mh-video');
    if (kesz) {
      kesz.addEventListener('click', () => kesz.replaceChildren(videoElem(azonosito)), { once: true });
      continue;
    }
    if (doboz.firstElementChild) continue;
    // az asztalin magatol indulo lejatszo: nemitva, vegtelenitve, hanggombbal (mint a 4. pont)
    if (mod === 'auto' && !mobilOldal) {
      const v = document.createElement('video');
      v.src = GYOKER + 'assets/video/' + azonosito + '.mp4';
      v.poster = KEPEK + azonosito + kocka + '.jpg';
      v.autoplay = v.loop = v.muted = v.playsInline = true;
      v.setAttribute('playsinline', 'true');
      v.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover';
      doboz.appendChild(v);
      hangGomb(doboz, v);
      continue;
    }
    const tarto = document.createElement('div');
    tarto.className = 'mh-video';
    const kep = document.createElement('img');
    kep.src = KEPEK + azonosito + kocka + '.jpg';
    kep.alt = '';
    // a kepernyon levo poszter (pl. a mobil hero) a legnagyobb tartalmi elem: azonnal toltodjon
    if (doboz.getBoundingClientRect().top < innerHeight) kep.fetchPriority = 'high';
    else kep.loading = 'lazy';
    const gomb = lejatszoGomb();
    tarto.append(kep, gomb);
    tarto.addEventListener('click', () => tarto.replaceChildren(videoElem(azonosito)), { once: true });
    doboz.appendChild(tarto);
  }

  // --- 4c. kezeles-videok (Wix Video csatorna) -------------------------------
  // A Wix Video listabol a HTML csak az elso 8 videot rajzolja ki, es a lapozo
  // nyilak (css-slider) sem mukodnek. A csatorna teljes, 15 videos listaja itt
  // van (Wix VOD API, lasd VIDEOK.md); a hianyzo elemeket az utolso minta
  // lemasolasaval tesszuk a sor vegere. A nyilak lapoznak, a videok pedig a
  // bélyegkep helyen, kis ablakban jatszodnak le (nem ugranak fel).
  // [Wix videoazonosito, cim, hossz]; a poszter: assets/img/<azonosito>f002.jpg
  const VIDEOTAR = [
    ['c2eb0f_a772c9222aa949a0888a4aa2298ef0b5', 'Fejmasszázs eszközökkel', '00:37'],
    ['c2eb0f_a12ccd3c1d8741698774232c8bee7efd', 'Kézmasszázs', '00:39'],
    ['c2eb0f_08e23fa612e846eca8137312513c1fec', 'Arcmasszázs', '00:37'],
    ['c2eb0f_29c8623e64464bdb96b1d61fa5ed6556', 'Mélytisztító hajmosás', '00:21'],
    ['c2eb0f_225ee4f9b6164d3c858705c394f7d04e', 'Fejbőr masszírozó fésű', '00:34'],
    ['c2eb0f_430fb9fbd2e744b08703615db12f4018', '20 ujjas fejmasszírozó', '00:12'],
    ['c2eb0f_bbb818fad4674d2097775970ca10c3d0', 'Arcroller', '00:18'],
    ['c2eb0f_4dd11049dc03482e8b6a169484d1b976', 'Fajmasszírozó körkefe', '00:13'],
    ['c2eb0f_c02456fd01664cb59eb593266e0a8279', 'Nyakmasszázs', '00:13'],
    ['c2eb0f_7eec543c5b944e89966b93b4649ed71a', 'Személyre kikevert hajpakolás', '00:23'],
    ['c2eb0f_cefa94f02ca34e3388845e308afc24f7', 'Dekoltázs masszázs', '00:13'],
    ['c2eb0f_95f0e62128e946b98eff0a6adda4c14c', 'Rózsakvarc fejbőrfésű', '00:26'],
    ['c2eb0f_c68f720ea07c4cc6b19dd56b1ab51f35', 'Körvízsugaras vízterápia', '00:38'],
    ['c2eb0f_85f266a4010d40aba40c28ee4af9230e', 'Rózsakvarc arcmasszírozás', '00:26'],
    ['c2eb0f_4b543396abd34dcc92dfe594049c8a78', 'Személyre kikevert arcpakolás', '00:19'],
  ];
  const posztere = (id) => KEPEK + id + 'f002.jpg';

  let mostSzol = null;
  const helybenJatszik = (elem, id) => {
    const borito = elem.querySelector('[data-hook="thumbnail-cover"]');
    if (!borito) return;
    if (mostSzol && mostSzol !== borito) {
      const regi = mostSzol.querySelector('video');
      if (regi) regi.pause();
    }
    mostSzol = borito;
    if (borito.querySelector('video')) { borito.querySelector('video').play().catch(() => {}); return; }
    const v = videoElem(id);
    v.poster = posztere(id);
    v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:3';
    borito.style.position = 'relative';
    borito.appendChild(v);
  };

  for (const csuszka of document.querySelectorAll('[data-hook="css-slider"]')) {
    const sor = csuszka.querySelector('[data-hook="css-slider-slides"]');
    if (!sor || !sor.children.length) continue;
    const meglevo = [...sor.children];
    const idje = (el) => { const m = el.innerHTML.match(/assets\/img\/([a-z0-9]+_[a-f0-9]{32})f00\d\.jpg/); return m && m[1]; };
    const vanMar = new Set(meglevo.map(idje));
    const minta = meglevo[meglevo.length - 1];
    const mintaId = idje(minta);
    // a hianyzo videok hozzaadasa a minta masolasaval
    for (const [id, cim, hossz] of VIDEOTAR) {
      if (vanMar.has(id) || !mintaId) continue;
      const uj = minta.cloneNode(true);
      uj.innerHTML = uj.innerHTML.split(mintaId).join(id);
      const cimElem = uj.querySelector('[data-hook="title"]');
      if (cimElem) cimElem.textContent = cim;
      const kep = uj.querySelector('img');
      if (kep) kep.alt = cim;
      for (const e of uj.querySelectorAll('div')) {
        if (!e.children.length && /^\d\d:\d\d$/.test(e.textContent.trim())) e.textContent = hossz;
      }
      sor.appendChild(uj);
    }
    // lejatszas helyben
    for (const elem of sor.children) {
      const id = idje(elem);
      if (!id) continue;
      for (const g of elem.querySelectorAll('[data-hook="overlay-play-button"], [data-hook="title"]')) {
        (g.closest('button') || g).addEventListener('click', (e) => { e.preventDefault(); helybenJatszik(elem, id); });
      }
    }
    // lapozo nyilak: egy latható szelessegnyit gorgetnek
    const elozo = csuszka.querySelector('[data-hook="css-slider-prev-button"]');
    const kovetkezo = csuszka.querySelector('[data-hook="css-slider-next-button"]');
    const allapot = () => {
      const max = sor.scrollWidth - sor.clientWidth - 2;
      for (const [g, tilt] of [[elozo, sor.scrollLeft <= 2], [kovetkezo, sor.scrollLeft >= max]]) {
        if (!g) continue;
        g.disabled = tilt;
        g.setAttribute('aria-hidden', String(tilt));
        g.tabIndex = tilt ? -1 : 0;
        g.style.visibility = tilt ? 'hidden' : '';
      }
    };
    const lapoz = (irany) => {
      const lepes = Math.max(sor.firstElementChild.getBoundingClientRect().width, sor.clientWidth - sor.firstElementChild.getBoundingClientRect().width);
      sor.scrollBy({ left: irany * lepes, behavior: 'smooth' });
    };
    if (elozo) elozo.addEventListener('click', () => lapoz(-1));
    if (kovetkezo) kovetkezo.addEventListener('click', () => lapoz(1));
    sor.addEventListener('scroll', allapot, { passive: true });
    allapot();
  }

  // Mobilon a Wix Video egy 320x250-es, egyszerre egy diat mutato lapozo
  // (data-channel-layout="mobile"). Ugyanigy: a hianyzo videok diakent a vegere,
  // nyilak es huzas lapoz, a lejatszas a dian belul indul.
  for (const fo of document.querySelectorAll('[data-channel-layout="mobile"] [data-hook="main-ui"]')) {
    const diak0 = [...fo.querySelectorAll('[data-index]')];
    if (!diak0.length) continue;
    const sav = diak0[0].parentElement;
    const idje = (el) => { const m = el.innerHTML.match(/assets\/img\/([a-z0-9]+_[a-f0-9]{32})f00\d\.jpg/); return m && m[1]; };
    const vanMar = new Set(diak0.map(idje));
    const minta = diak0[diak0.length - 1];
    const mintaId = idje(minta);
    const mintaCim = (minta.querySelector('[data-hook="title"] [title]') || {}).title || '';
    for (const [id, cim] of VIDEOTAR) {
      if (vanMar.has(id) || !mintaId) continue;
      const uj = minta.cloneNode(true);
      uj.innerHTML = uj.innerHTML.split(mintaId).join(id).split(mintaCim).join(cim);
      sav.appendChild(uj);
    }
    const diak = [...sav.children];
    diak.forEach((d, i) => { d.setAttribute('data-index', String(i)); d.removeAttribute('data-active'); });
    const szel = diak[0].getBoundingClientRect().width || 320;
    sav.style.transition = 'transform .35s ease';
    sav.parentElement.style.overflow = 'hidden';
    const pottyok = fo.querySelector('[data-hook="navigation-dots"]');
    if (pottyok) pottyok.style.display = 'none';

    let most = 0;
    const ugrik = (i) => {
      most = Math.max(0, Math.min(diak.length - 1, i));
      sav.style.transform = 'translateX(' + (-most * szel) + 'px)';
      for (const v of sav.querySelectorAll('video')) v.pause();
      nyilBal.style.visibility = most ? '' : 'hidden';
      nyilJobb.style.visibility = most < diak.length - 1 ? '' : 'hidden';
    };
    const nyil = (irany) => {
      const g = document.createElement('button');
      g.type = 'button';
      g.className = 'mh-dia-nyil mh-dia-nyil-' + (irany < 0 ? 'bal' : 'jobb');
      g.setAttribute('aria-label', irany < 0 ? 'Előző videó' : 'Következő videó');
      g.innerHTML = '<svg viewBox="0 0 53 100" width="14" height="26" fill="currentColor" aria-hidden="true"' +
        (irany < 0 ? ' style="transform:scaleX(-1)"' : '') + '><path d="M5.16 99.14L2.15 96.13 48.6 50.11 2.15 4.3 5.16 1.29 54.62 50.11"/></svg>';
      g.addEventListener('click', (e) => { e.stopPropagation(); ugrik(most + irany); });
      fo.appendChild(g);
      return g;
    };
    fo.style.position = 'relative';
    const nyilBal = nyil(-1), nyilJobb = nyil(1);

    diak.forEach((d, i) => {
      const id = idje(d);
      const gomb = d.querySelector('[data-hook="overlay-play-button"]');
      if (!id || !gomb) return;
      gomb.addEventListener('click', (e) => {
        e.preventDefault();
        const doboz = gomb.closest('[style*="position:relative"]') || d;
        if (doboz.querySelector('video')) return;
        const v = videoElem(id);
        v.poster = posztere(id);
        v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;z-index:3';
        doboz.appendChild(v);
      });
    });

    let startX = null;
    sav.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    sav.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) ugrik(most + (dx < 0 ? 1 : -1));
    });
    ugrik(0);
  }

  // --- 5. beagyazott tartalmak: HTML-beagyazasok es Google-terkep ----------
  // Az eles oldalon ezek a Wix HtmlComponent / GoogleMap dobozaiban, keretben
  // (iframe) jelennek meg. A klonban a dobozok uresek - ide tesszuk vissza oket,
  // ugyanugy keretben, a doboz teljes meretere. A HtmlComponent-ek tartalmat a Wix
  // a www-mosaicheadspa-hu.filesusr.com/html/<nev>.htm cimrol tolti; ezeket
  // valtozatlanul letoltottuk az assets/embed/ ala (tools/wix-oldaladatok.json).
  //
  // Mindegyik harmadik feltol tolt be tartalmat (Trustindex, Google), ezert a tajekoztato szerint a "funkcionalis" kategoriaba tartoznak:
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
  };

  // doboz -> 'terkep' vagy egy EMBEDEK-kulcs
  const BEAGYAZASOK = {
    // Trustindex-widget (a velemenyek es a szortelenites oldalon a mellette levo
    // szovegdobozban a Wix-szerkesztobe beirt kod is latszik - az eles oldalon is)
    'comp-m7q9i6yk': 'c2eb0f_614b09d160b9382c4cffcde6d7828dcb',   // head-spa-velemenyek
    'comp-mlg8q2rf5': 'c2eb0f_614b09d160b9382c4cffcde6d7828dcb',  // lezeres-szortelenites-budapest
    'comp-mnmzylj31': 'c2eb0f_614b09d160b9382c4cffcde6d7828dcb',  // oxigenterapia-budapest
    'comp-mghyh3i9': 'c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6',   // index ("olvasd el vendegeinktol")
    // Google-terkep
    'comp-m3znoat23': 'terkep', 'comp-m7iq5wws1': 'terkep', 'comp-m7j9kag62': 'terkep',
    'comp-m7kiqhv01': 'terkep', 'comp-m7pxb9eh': 'terkep', 'comp-m7q2fh4v': 'terkep',
    'comp-mciu8zie': 'terkep', 'comp-mghyuypd4': 'terkep', 'comp-micq2kcn': 'terkep',
  };

  Object.assign(EMBEDEK, TABLAK.embedek);
  Object.assign(BEAGYAZASOK, TABLAK.beagyazasok);
  // a Wix-szerkesztobe szovegkent beirt Trustindex-kod a kesobb athozott oldalakon
  for (const azon of TABLAK.rejtett || []) {
    const d = document.getElementById(azon);
    if (d) d.style.visibility = 'hidden';
  }

  const keret = (fajta) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'display:block;width:100%;height:100%;border:0;background:transparent';
    f.loading = 'lazy';
    if (fajta.startsWith('yt:')) {
      f.title = 'Videó (YouTube)';
      f.src = 'https://www.youtube-nocookie.com/embed/' + fajta.slice(3);
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
    } else if (fajta === 'terkep') {
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
    const [cim, kitol] = fajta === 'terkep' ? ['Térkép', 'Google'] : fajta.startsWith('yt:') ? ['Videó', 'YouTube'] : EMBEDEK[fajta];
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
  // --- 5b. GYIK es arlistak: sajat kod a fizetos Common Ninja widgetek helyett ---
  // Az eles oldalon ezek Common Ninja widgetek, fix magassagu keretben (a
  // fooldalon ket GYIK egymas alatt, alattuk sok ures hellyel). Helyettuk sajat
  // harmonika es tablazat all; a tartalom a Common Ninja-bol egyszer letoltve
  // (tools/commonninja.mjs -> assets/js/gyik.js, assets/js/arlistak.js). A doboz
  // magassaga a tartalomhoz igazodik; ahol a Wixen ket GYIK volt egymas alatt,
  // ott az elso dobozba kerul mindketto egy listaban, a masodik eltunik.
  const GYIK = window.MH_GYIK || {};
  const ARLISTAK = window.MH_ARLISTAK || {};
  const GYIK_1 = 'c2eb0f_e2a637ece2437154df156d36cae403f4';   // "MOSAIC GYIK 1"
  const GYIK_2 = 'c2eb0f_dab261d3e84629df7798238e716f0266';   // "MOSAIC GYIK 2"
  const GYIK_AJANDEK = 'c2eb0f_97df67cb524ad4ad76e22fddea2496e5';
  const GYIK_DOBOZOK = {
    'comp-m5m8txa6': [GYIK_1, GYIK_2], 'comp-m5m8w3ok': null,    // index
    'comp-m7kiqhte': [GYIK_1, GYIK_2], 'comp-m7kiqhtg1': null,   // headspa-ferfiaknak
    'comp-m7pxb9cs': [GYIK_1, GYIK_2], 'comp-m7pxb9cu': null,    // paros-headspa-budapest
    'comp-m7io5w964': [GYIK_AJANDEK],                            // headspa-ajandekkartya
    'comp-micq2kau4': [GYIK_AJANDEK],                            // 4-kezes-headspa-ajandekkartya
    'comp-mlg8q2yy2': ['c2eb0f_7101a51e50aef2435d5ed679e90074d4'], // lezeres-szortelenites-budapest
    'comp-mciu8zgq': ['c2eb0f_193bec926d66321bf99ada19cf4105a5'],  // oxigenterapia-budapest
  };
  const ARLISTA_DOBOZOK = {
    'comp-mb6gc2i53': 'c2eb0f_89f74d4c7a84ec25afa7aad7f0133562',  // noi-fodraszat-budapest (Betti)
    'comp-m5p3vva4': 'c2eb0f_89f74d4c7a84ec25afa7aad7f0133562',   // noi-fodrasz-budapest-balayage-hajfestes
    'comp-metxv9d0': 'c2eb0f_89f74d4c7a84ec25afa7aad7f0133562',   // noi-hajfestes-budapest
    'comp-mb6g8h6k': 'c2eb0f_ebe819c8a20603ef818d0ff477702c21',   // balayage-haj-festes-budapest (Noel)
  };

  Object.assign(GYIK_DOBOZOK, TABLAK.gyik);
  Object.assign(ARLISTA_DOBOZOK, TABLAK.arlista);

  // Az eles oldalon a GYIK kulso keretben (Common Ninja iframe) volt, igy a
  // merokodok (pl. a TikTok automatikus egyeztetese) nem lattak bele. Nalunk az
  // oldal resze - hogy a TikTok ne olvassa ki belole a szalon e-mail-cimet (es ne
  // kosse azt minden latogatohoz), a szovegben a kukacot CSS rajzolja ki: a
  // latogato ugyanazt latja, a szkript viszont nem talal e-mail-cimet.
  function rejtettKukac(elem) {
    const jarok = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT);
    const talalt = [];
    while (jarok.nextNode()) if (/\S@\S/.test(jarok.currentNode.nodeValue)) talalt.push(jarok.currentNode);
    for (const t of talalt) {
      const darabok = t.nodeValue.split('@');
      const tores = document.createDocumentFragment();
      darabok.forEach((d, i) => {
        if (i) { const k = document.createElement('span'); k.className = 'mh-kukac'; tores.append(k); }
        tores.append(d);
      });
      t.replaceWith(tores);
    }
  }

  // A Wix a doboz koruli racsoknak a regi widget mereteihez igazitott minimalis
  // magassagot adott (pl. min-height:1881px, illetve "ek" elemek) - ez az uj,
  // rovidebb tartalom alatt ures helykent maradna. A szulo-racsoknal (a
  // szekcioig) kikapcsoljuk.
  function tartalomMagassag(doboz) {
    let e = doboz.parentElement;
    for (let i = 0; e && i < 6; i++, e = e.parentElement) {
      if (/gridContainer$/.test(e.getAttribute('data-mesh-id') || '')) {
        e.style.minHeight = '0';
        // a Wix "ek" elemei (…-wedge-N) a regi sormagassagot tartanak fenn
        for (const ek of e.querySelectorAll(':scope > [data-mesh-id*="-wedge-"]')) ek.style.display = 'none';
      }
      if (e.tagName === 'SECTION') break;
    }
  }

  for (const [azon, nevek] of Object.entries(GYIK_DOBOZOK)) {
    const doboz = document.getElementById(azon);
    if (!doboz) continue;
    if (!nevek) {
      // a doboz mogott allo, csak neki szolo (ures) hatterkartya is tunjon el
      const r = doboz.getBoundingClientRect();
      doboz.classList.add('mh-gyik-rejtett');
      for (const t of doboz.parentElement.children) {
        if (t === doboz || !t.id) continue;
        const q = t.getBoundingClientRect();
        const fed = q.top < r.bottom && q.bottom > r.top && q.left < r.right && q.right > r.left;
        const ures = !t.textContent.trim() && !t.querySelector('img, video, iframe, svg');
        if (fed && ures) t.classList.add('mh-gyik-rejtett');
      }
      continue;
    }
    const tetelek = nevek.flatMap((n) => GYIK[n] || []);
    if (!tetelek.length) continue;
    const lista = document.createElement('div');
    lista.className = 'mh-gyik';
    tetelek.forEach(([kerdes, valasz], i) => {
      const tetel = document.createElement('div');
      tetel.className = 'mh-gyik-tetel';
      const gomb = document.createElement('button');
      gomb.type = 'button';
      gomb.id = azon + '-k' + i;
      gomb.setAttribute('aria-expanded', 'false');
      gomb.setAttribute('aria-controls', azon + '-v' + i);
      gomb.innerHTML = '<span></span><i aria-hidden="true"></i>';
      gomb.firstChild.textContent = kerdes;
      const panel = document.createElement('div');
      panel.className = 'mh-gyik-valasz';
      panel.id = azon + '-v' + i;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', gomb.id);
      panel.hidden = true;
      panel.innerHTML = valasz;
      rejtettKukac(panel);
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
    tartalomMagassag(doboz);
  }

  // Arlista: tablazat; keskeny kepernyon (mobil) soronkent kartya, a hajhosszal
  // cimkezve. A "X helyett Y" arak athuzott regi + kiemelt uj arkent jelennek meg.
  const arCella = (td, ertek) => {
    const m = ertek.match(/^(.*?)\s+helyett\s+(.*)$/);
    if (!m) { td.textContent = ertek; return; }
    const regi = document.createElement('s');
    regi.textContent = m[1];
    const uj = document.createElement('strong');
    uj.textContent = m[2];
    td.append(regi, document.createElement('br'), uj);
  };
  for (const [azon, nev] of Object.entries(ARLISTA_DOBOZOK)) {
    const doboz = document.getElementById(azon);
    const adat = ARLISTAK[nev];
    if (!doboz || !adat) continue;
    const tabla = document.createElement('table');
    tabla.className = 'mh-arlista';
    const fej = tabla.createTHead().insertRow();
    adat.fejlec.forEach((f, i) => {
      const th = document.createElement('th');
      th.textContent = f;
      if (!i) th.setAttribute('aria-label', 'Szolgáltatás');
      fej.appendChild(th);
    });
    const test = tabla.createTBody();
    for (const sor of adat.sorok) {
      const tr = test.insertRow();
      sor.forEach((ertek, i) => {
        const td = document.createElement(i ? 'td' : 'th');
        if (i) { td.dataset.cimke = adat.fejlec[i]; arCella(td, ertek); } else { td.scope = 'row'; td.textContent = ertek; }
        tr.appendChild(td);
      });
    }
    doboz.classList.add('mh-gyik-doboz');
    doboz.replaceChildren(tabla);
    tartalomMagassag(doboz);
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
      // csak a lathato es a szomszedos dia toltodik be (betolt), a tobbi lapozaskor
      img.dataset.src = KEPEK + kep;
      img.alt = alt;
      img.loading = 'lazy';
      img.decoding = 'async';
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
          // a bélyegkep csak akkor toltodik be, amikor a galeria a kepernyo kozelebe er
          b.setAttribute('style', alapStilus + ';left:' + (i * lepes) + 'px;cursor:pointer');
          b.dataset.kep = KEPEK + kep;
          b.addEventListener('click', () => ugrik(i));
          return b;
        });
        oszlop.replaceChildren(...belyegek);
        const belyegBetolt = () => belyegek.forEach((b) => { b.style.backgroundImage = 'url(' + b.dataset.kep + ')'; });
        if ('IntersectionObserver' in window) {
          const figyelo = new IntersectionObserver((bejegyzesek) => {
            if (bejegyzesek.some((e) => e.isIntersecting)) { figyelo.disconnect(); belyegBetolt(); }
          }, { rootMargin: '600px 0px' });
          figyelo.observe(tarto);
        } else belyegBetolt();
        oszlop.style.transition = 'left .45s ease';
        oszlop.dataset.lepes = String(lepes);
      }
    }

    let most = 0;
    const diak = [...belso.children];
    const betolt = (i) => {
      for (const d of [-1, 0, 1, 2]) {
        const img = diak[(i + d + lista.length) % lista.length].firstElementChild;
        if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
      }
    };
    const ugrik = (i) => {
      most = (i + lista.length) % lista.length;
      betolt(most);
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

  // --- 7b. racsos galeriak + nagyitas kattintasra -----------------------------
  // A racsos (nem lapozos) galeriakbol a Wix mobilon csak az elso 4-6 kepet
  // rajzolja ki, a doboz viszont mindegyik helyet fenntartja - nagy ures resz
  // marad. Ezeket a teljes kepllistabol (assets/js/galeriak.js) CSS-racskent
  // epitjuk ujra: ugyanannyi oszloppal, hezaggal es kepparannyal, mint a Wix.
  // Minden galeria (a lapozosak is) kattintasra nagyit: felugro kep lapozassal.
  const nagyito = (lista, kezdo) => {
    let i = kezdo;
    const h = document.createElement('div');
    h.className = 'mh-nagyito';
    h.setAttribute('role', 'dialog');
    h.setAttribute('aria-label', 'Kép nagyítva');
    h.innerHTML = '<img alt=""><button type="button" class="mh-nagyito-zar" aria-label="Bezárás">×</button>' +
      '<button type="button" class="mh-nagyito-nyil mh-nagyito-bal" aria-label="Előző kép">‹</button>' +
      '<button type="button" class="mh-nagyito-nyil mh-nagyito-jobb" aria-label="Következő kép">›</button>' +
      '<div class="mh-nagyito-szam"></div>';
    const kep = h.querySelector('img'), szam = h.querySelector('.mh-nagyito-szam');
    const mutat = (j) => {
      i = (j + lista.length) % lista.length;
      kep.src = KEPEK + lista[i][0];
      kep.alt = lista[i][1] || '';
      szam.textContent = (i + 1) + ' / ' + lista.length;
    };
    const bezar = () => { h.remove(); document.removeEventListener('keydown', bill); };
    const bill = (e) => {
      if (e.key === 'Escape') bezar();
      else if (e.key === 'ArrowLeft') mutat(i - 1);
      else if (e.key === 'ArrowRight') mutat(i + 1);
    };
    h.addEventListener('click', (e) => {
      if (e.target.closest('.mh-nagyito-bal')) mutat(i - 1);
      else if (e.target.closest('.mh-nagyito-jobb')) mutat(i + 1);
      else if (e.target === h || e.target.closest('.mh-nagyito-zar')) bezar();
    });
    let sx = null;
    h.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    h.addEventListener('touchend', (e) => {
      if (sx === null) return;
      const d = e.changedTouches[0].clientX - sx;
      sx = null;
      if (Math.abs(d) > 40) mutat(i + (d < 0 ? 1 : -1));
    });
    document.addEventListener('keydown', bill);
    document.body.appendChild(h);
    mutat(i);
    h.querySelector('.mh-nagyito-zar').focus();
  };

  for (const tarto of document.querySelectorAll('.pro-gallery[id^="pro-gallery-container-"]')) {
    const doboz = tarto.id.replace('pro-gallery-container-', '');
    const lista = GALERIAK[doboz];
    if (!lista || !lista.length) continue;

    if (tarto.classList.contains('slider')) {
      // lapozos galeria: a dia kepere kattintva nagyit (a 7. szakasz epitette a diakat)
      const belso = tarto.querySelector('.gallery-horizontal-scroll-inner');
      if (belso) [...belso.children].forEach((dia, i) => {
        dia.style.cursor = 'zoom-in';
        dia.addEventListener('click', () => nagyito(lista, i));
      });
      continue;
    }

    // racs: oszlopszam, hezag es keparany a Wix-kirajzolasbol
    const elemek = [...tarto.querySelectorAll('[data-hook="item-container"]')];
    if (!elemek.length) continue;
    const r0 = elemek[0].getBoundingClientRect();
    const elsoSor = elemek.filter((e) => Math.abs(e.getBoundingClientRect().top - r0.top) < 4);
    const oszlop = Math.max(1, elsoSor.length);
    const xek = elsoSor.map((e) => e.getBoundingClientRect().left).sort((a, b) => a - b);
    const hezag = oszlop > 1 ? Math.max(0, Math.round(xek[1] - xek[0] - r0.width)) : 5;
    const arany = r0.height / r0.width;
    const illeszt = tarto.querySelector('.cube-type-fit') ? 'contain' : 'cover';

    const racs = document.createElement('div');
    racs.className = 'mh-racs';
    racs.style.cssText = 'display:grid;grid-template-columns:repeat(' + oszlop + ',1fr);gap:' + hezag + 'px';
    lista.forEach(([kep, alt], i) => {
      const cella = document.createElement('button');
      cella.type = 'button';
      cella.className = 'mh-racs-cella';
      cella.setAttribute('aria-label', 'Kép nagyítása' + (alt ? ': ' + alt : ''));
      cella.style.aspectRatio = String(1 / arany);
      const img = document.createElement('img');
      img.src = KEPEK + kep;
      img.alt = alt;
      img.loading = 'lazy';
      img.style.objectFit = illeszt;
      cella.appendChild(img);
      cella.addEventListener('click', () => nagyito(lista, i));
      racs.appendChild(cella);
    });
    tarto.replaceChildren(racs);
    tarto.style.height = 'auto';
    // a Wix fix magassagai a galeria kornyeken (a doboz, a keret, a racsok)
    let e = tarto.parentElement;
    for (let k = 0; e && k < 8; k++, e = e.parentElement) {
      if (e.id === doboz) { e.style.setProperty('height', 'auto', 'important'); break; }
      e.style.height = 'auto';
    }
    const wixDoboz = document.getElementById(doboz);
    if (wixDoboz) tartalomMagassag(wixDoboz);
  }

  // --- 7c. horgonyos menulinkek (pl. GYIK, Kapcsolat) ---------------------------
  // A Wix a menupontokat data-anchor="anchors-..." attributummal jeloli, es a
  // sajat JS-e gorget a hozza tartozo szekciohoz. A horgony -> szekcio parositas
  // a Wix oldal-adataibol (anchorDataIdToCompIdMap, tools/wix-json/).
  const HORGONYOK = {
    'anchors-m3znoasf3': 'comp-m3znoarb',
    'anchors-m4l2o45y4': 'comp-m4l2o45p',
    'anchors-m5l1xx2p5': 'comp-m5l1xx2o5',
    'anchors-m5l1xx3s4': 'comp-m5l1xx3r3',
    'anchors-m5l1xx5l2': 'comp-m5l1xx5j5',
    'anchors-m5p3vmz93': 'comp-m5p3vmyh',
    'anchors-m7io5w8n4': 'comp-m7io5w8m',
    'anchors-m7ipdoix1': 'comp-m7ipdoiu',
    'anchors-m95snrjx5': 'comp-m95snrjw3',
    'anchors-m95snrky': 'comp-m95snrkv',
    'anchors-m95snroo1': 'comp-m95snrom5',
    'anchors-m95tiafe1': 'comp-m95tiadv',
    'anchors-mb6g8h65': 'comp-mb6g8h60',
    'anchors-mblskd615': 'comp-mblskd603',
    'anchors-mciu8zaf5': 'comp-mciu8zae4',
    'anchors-mciu8zbx1': 'comp-mciu8zbw',
    'anchors-micq2k9e6': 'comp-micq2k9c',
    'anchors-micq2ka51': 'comp-micq2ka41',
    'anchors-mlg8q2z32': 'comp-mlg8q2z13',
    'anchors-mlgjpxj5': 'comp-mlgjpxi2',
    'anchors-mnmzylj04': 'comp-mnmzyliv',
    'anchors-mrys9zup4': 'comp-mrys9zuo',
  };
  const fejlecMagassag = () => {
    const f = document.getElementById('SITE_HEADER');
    if (!f) return 0;
    const cs = getComputedStyle(f);
    return /fixed|sticky/.test(cs.position) ? f.getBoundingClientRect().height : 0;
  };
  const odaGorget = (cel, sima) => {
    const y = cel.getBoundingClientRect().top + scrollY - fejlecMagassag();
    window.scrollTo({ top: Math.max(0, y), behavior: sima ? 'smooth' : 'auto' });
  };
  const fajlnev = (ut) => (ut.split('/').pop() || 'index.html').replace(/\.html$/, '');
  for (const a of document.querySelectorAll('a[data-anchor]')) {
    const szekcio = HORGONYOK[a.getAttribute('data-anchor')];
    const href = a.getAttribute('href');
    if (!szekcio || !href) continue;
    a.setAttribute('href', href.split('#')[0] + '#' + szekcio);
    a.addEventListener('click', (e) => {
      if (fajlnev(href.split('#')[0]) !== fajlnev(location.pathname)) return;
      const cel = document.getElementById(szekcio);
      if (!cel) return;
      e.preventDefault();
      // a mobil menu zarodjon be
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      history.replaceState(null, '', '#' + szekcio);
      odaGorget(cel, true);
    });
  }
  // masik oldalrol erkezve (#comp-...): a GYIK, galeriak atrendezese utan igazitunk
  if (location.hash.length > 1) {
    const cel = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (cel) setTimeout(() => odaGorget(cel, false), 150);
  }

  // A Wix Forms bekuldes utan a Wix "Lead" jelentese megy a GTM- es a GA4-csatornara.
  // Pontosan ez kerult a dataLayer-be (az eles oldalon a Wix sajat kodjaval
  // ellenorizve, 2026-09-30): lead -> {ecommerce:null} -> generate_lead (user_data:
  // a mezok Wix-kulcsai, az e-mail- es telefonszam-mezo "email" / "phone_number"
  // neven), majd a GA4-nek egy generate_lead esemeny. A GTM a generate_lead-re
  // inditja a GA4 "ajandekkartya_utalas", a TikTok "PlaceAnOrder" es a Stape
  // (Meta CAPI) cimket.
  // A Wix user_data-atalakitasa (thunderbolt reporter-api, R()): a kulcsnev alapjan
  // email / phone_number / address.*; ha nincs ilyen kulcs, az elso e-mail-, illetve
  // telefonszam-formaju ertek kerul email / phone_number neven a helyere.
  const WIX_UD = { email: ['email'], phone_number: ['phone', 'phone_number'], 'address.first_name': ['first_name', 'firstname'],
    'address.last_name': ['last_name', 'lastname', 'surname'], 'address.street': ['address', 'street'], 'address.city': ['city', 'town'],
    'address.region': ['region', 'state', 'province'], 'address.postal_code': ['postal', 'postal_code', 'zip'], 'address.country': ['country'] };
  function wixUserData(ertekek) {
    const t = {};
    const betesz = (cel, kulcs, v) => { const r = kulcs.split('.'), u = r.pop(); r.reduce((o, k) => (o[k] = o[k] || {}), cel)[u] = v; };
    for (const [k, v] of Object.entries(ertekek)) {
      const talalt = Object.entries(WIX_UD).find(([, minta]) => minta.some((m) => k.toLowerCase().includes(m) && v));
      if (talalt) { if (talalt[0].includes('.')) betesz(t, talalt[0], v); else t[talalt[0]] = v; } else t[k] = v;
    }
    const keres = (re) => Object.entries(ertekek).find(([, v]) => typeof v === 'string' && re.test(v));
    if (!t.email) { const e = keres(/[^\s@]+@[^\s@]+\.[^\s@]+/); if (e) { delete t[e[0]]; t.email = e[1].match(/[^\s@]+@[^\s@]+\.[^\s@]+/)[0]; } }
    if (!t.phone_number) { const e = keres(/^\+?[\d\s()-]{7,}$/); if (e) { delete t[e[0]]; t.phone_number = e[1]; } }
    return t;
  }
  // A Wix telefonmezo erteke nemzetkozi formaban (+36...)
  const wixTelefon = (v) => {
    let x = String(v || '').replace(/[^\d+]/g, '');
    if (!x) return '';
    if (!x.startsWith('+')) x = '+36' + x.replace(/^(06|36|0)/, '');
    return x;
  };
  // adat: URLSearchParams/FormData; kulcsok: [[sajat nev, Wix-kulcs], ...];
  // extra: tovabbi Wix-ertekek (pl. az ASZF jelolonegyzet: true)
  function wixLead(adat, kulcsok, urlapNev, formId, extra) {
    const ertekek = {};
    for (const [sajat, wix] of kulcsok) {
      let v = adat.get(sajat);
      if (typeof v !== 'string' || !v.trim()) continue;
      ertekek[wix] = sajat === 'telefon' ? wixTelefon(v) : v.trim();
    }
    Object.assign(ertekek, extra || {});
    const cimke = 'Form name: ' + urlapNev;
    const dl = (window.dataLayer = window.dataLayer || []);
    dl.push({ event: 'lead', event_label: cimke, event_category: 'contact' });
    dl.push({ ecommerce: null });
    dl.push({ event: 'generate_lead', lead_category: 'contact', label: cimke, form_id: formId, user_data: wixUserData(ertekek) });
    if (window.gtag) window.gtag('event', 'generate_lead', { event_category: 'contact', event_action: 'Submitted', event_label: cimke });
  }

  // A Wix radiogombjai nem <label>-ben vannak, es a kijeloles latszatat is a
  // Wix JS-e rajzolja (data-checked + "...--checked" osztaly): ezt itt potoljuk.
  function wixValasztok(urlap) {
    const allapot = () => {
      for (const i of urlap.querySelectorAll('input[type=radio], input[type=checkbox]')) {
        for (let e = i.parentElement; e && e !== urlap && !e.matches('fieldset'); e = e.parentElement) {
          if (e.hasAttribute('data-checked')) e.setAttribute('data-checked', String(i.checked));
          if (e.dataset.mhPipa) e.classList.toggle(e.dataset.mhPipa, i.checked);
        }
        i.setAttribute('aria-checked', String(i.checked));
      }
    };
    for (const e of urlap.querySelectorAll('[class*="--checked"]')) e.dataset.mhPipa = [...e.classList].find((c) => c.endsWith('--checked'));
    for (const e of urlap.querySelectorAll('.sYOg_Hk')) e.dataset.mhPipa = 'oi7np_Q--checked';
    for (const r of urlap.querySelectorAll('[data-hook="core-radio-button"]')) {
      r.style.cursor = 'pointer';
      r.addEventListener('click', (e) => {
        const i = r.querySelector('input[type=radio]');
        if (!i || e.target === i) return;
        i.checked = true;
        i.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    urlap.addEventListener('change', allapot);
  }

  // --- 7d. ajandekkartya-urlap -> Netlify Forms ---------------------------------
  // Az eles oldalon a Wix Forms kuldi be, majd a /success-ajandekkartya oldalra
  // iranyit; a vevonek es nektek a Wix Automations kuld e-mailt. A klonban a
  // Netlify Forms fogadja (a lathatatlan urlapleiras a klon-kiegeszites.mjs-bol),
  // az e-maileket a netlify/functions/submission-created.mjs kuldi.
  const URLAP_MEZOK = [
    ['Ajándékozott Teljes Neve', 'ajandekozott'],
    ['Fizető fél Vezetékneve', 'vezeteknev'],
    ['Fizető fél Keresztneve', 'keresztnev'],
    ['E-mail cím', 'email'],
    ['Telefonszámod', 'telefon'],
    ['Számlázási cím', 'szamlazasi_cim'],
    ['Cégnév', 'cegnev'],
    ['Cég adószám', 'adoszam'],
  ];
  for (const urlap of document.querySelectorAll('form[id^="form-7715ab48"]')) {
    const gomb = urlap.querySelector('[data-hook="submit-button"]');
    if (!gomb) continue;
    const uzenet = document.createElement('p');
    uzenet.className = 'mh-urlap-uzenet';
    uzenet.setAttribute('role', 'alert');
    gomb.after(uzenet);
    const mezo = (cimke) => [...urlap.querySelectorAll('input')].find((i) => (i.getAttribute('aria-label') || '').startsWith(cimke));

    wixValasztok(urlap);
    urlap.addEventListener('input', (e) => e.target.classList.remove('mh-hibas'));

    const kuld = async (e) => {
      e.preventDefault();
      uzenet.textContent = '';
      let hibas = null;
      for (const i of urlap.querySelectorAll('input[required]:not([type=radio])')) {
        const rossz = i.type === 'checkbox' ? !i.checked : !i.value.trim() || !i.checkValidity();
        i.setAttribute('aria-invalid', String(rossz));
        i.classList.toggle('mh-hibas', rossz);
        if (rossz && !hibas) hibas = i;
      }
      const kartya = urlap.querySelector('input[type=radio]:checked');
      if (!kartya) hibas = hibas || urlap.querySelector('input[type=radio]');
      if (hibas) {
        uzenet.textContent = 'Kérlek, töltsd ki a csillaggal (*) jelölt mezőket, és válaszd ki a kártyát.';
        hibas.focus();
        return;
      }
      const adat = new URLSearchParams({ 'form-name': 'ajandekkartya', oldal: location.pathname.split('/').pop() || 'index.html' });
      for (const [cimke, nev] of URLAP_MEZOK) { const i = mezo(cimke); adat.set(nev, i ? i.value.trim() : ''); }
      adat.set('kartya', kartya.getAttribute('aria-label') || kartya.value);
      adat.set('aszf', 'elfogadva');
      gomb.setAttribute('aria-disabled', 'true');
      gomb.style.opacity = '.6';
      try {
        const v = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: adat.toString() });
        if (!v.ok) throw new Error('HTTP ' + v.status);
        // merokodok (ha a latogato engedte): a GTM es a Meta ezt latja konverziokent
        wixLead(adat, [['keresztnev', 'fizeto_fel_keresztneve'], ['vezeteknev', 'fizeto_fel_vezetekneve'], ['email', 'e_mail_cim'],
          ['telefon', 'telefonszam'], ['szamlazasi_cim', 'cim'], ['cegnev', 'cegnev_opcionalis'], ['adoszam', 'ceg_adoszam_opcionalis'],
          ['ajandekozott', 'ajandekozott_neve'], ['kartya', 'milyen_kartyat_kersz']],
          'Ajándékkártya ', '7715ab48-7c85-4c1c-8fbc-a38c1cb1a23c', { form_field_d3ec: true });
        location.href = '/success-ajandekkartya';
      } catch (err) {
        uzenet.textContent = 'Hiba történt a küldés közben. Kérlek, próbáld újra, vagy írj nekünk: mosaicheadspa@gmail.com';
        gomb.removeAttribute('aria-disabled');
        gomb.style.opacity = '';
      }
    };
    gomb.addEventListener('click', kuld);
    urlap.addEventListener('submit', kuld);
  }


  // --- 7e. PMU-visszahivaskeres (pmu-foglalas) -> Netlify Forms -------------------
  // Az eles oldalon Wix Forms. Az asztali nezetben a "Szolgaltatas" lenyilo
  // lista opcioit a Wix JS-e rajzolna ki: helyette egy lathatatlan, a gombot
  // teljesen fedo nativ <select> kerul ra (a mobil nezetben eleve az van).
  const PMU_SZOLGALTATASOK = [
    'Ajaktetoválás - Aquarell - 99.000 Ft',
    'Ajaktetoválás - Rúzs hatású - 110.000 Ft',
    'Szemöldök tetoválás - Hibrid - 79.000 Ft',
    'Szemöldök tetoválás - Soft powder - 79.000 Ft',
    'Szemöldök tetoválás eltávolítás - 18.000 Ft',
    'Szempilla sűrítés - 47.000 Ft',
    'Szemhéj tetoválás - Füstös - 63.000 Ft',
  ];
  for (const urlap of document.querySelectorAll('form[id^="form-875a7aa0"]')) {
    const gomb = urlap.querySelector('[data-hook="submit-button"]');
    if (!gomb) continue;
    const uzenet = document.createElement('p');
    uzenet.className = 'mh-urlap-uzenet mh-urlap-uzenet--pmu';
    uzenet.setAttribute('role', 'alert');
    gomb.after(uzenet);
    wixValasztok(urlap);

    let valaszto = urlap.querySelector('select[data-hook="native-select"]');
    const lenyilo = urlap.querySelector('button[data-hook="dropdown-base"]');
    if (!valaszto && lenyilo) {
      valaszto = document.createElement('select');
      valaszto.setAttribute('aria-label', 'Szolgáltatás');
      valaszto.className = 'mh-lenyilo';
      valaszto.innerHTML = '<option value="" disabled selected></option>' +
        PMU_SZOLGALTATASOK.map((o) => `<option>${o}</option>`).join('');
      lenyilo.parentElement.style.position = 'relative';
      lenyilo.tabIndex = -1;
      lenyilo.setAttribute('aria-hidden', 'true');
      lenyilo.after(valaszto);
      const szoveg = lenyilo.querySelector('[data-hook="dropdown-base-text"]');
      valaszto.addEventListener('change', () => { if (szoveg) szoveg.textContent = valaszto.value; });
    }
    const valasztott = () => (valaszto && valaszto.selectedIndex > 0 ? valaszto.options[valaszto.selectedIndex].text : '');
    const hibaJel = (el, rossz) => {
      if (!el) return;
      el.setAttribute('aria-invalid', String(rossz));
      (el === valaszto && lenyilo ? lenyilo : el).classList.toggle('mh-hibas', rossz);
    };
    urlap.addEventListener('input', (e) => e.target.classList.remove('mh-hibas'));
    urlap.addEventListener('change', (e) => { if (e.target === valaszto) hibaJel(valaszto, false); });

    const nev = urlap.querySelector('input[aria-label="Név"]');
    const telefon = urlap.querySelector('input[aria-label^="Telefonszám"]');
    const megjegyzes = urlap.querySelector('textarea');
    const kuld = async (e) => {
      e.preventDefault();
      if (gomb.getAttribute('aria-disabled') === 'true') return;
      uzenet.textContent = '';
      let hibas = null;
      const tel = telefon ? telefon.value.replace(/[^\d+]/g, '') : '';
      for (const [el, rossz] of [[nev, !nev || !nev.value.trim()], [telefon, tel.replace(/\D/g, '').length < 8], [valaszto, !valasztott()]]) {
        hibaJel(el, rossz);
        if (rossz && !hibas) hibas = el;
      }
      const tetovalas = urlap.querySelector('input[type=radio]:checked');
      if (!tetovalas) hibas = hibas || urlap.querySelector('input[type=radio]');
      if (hibas) {
        uzenet.textContent = 'Kérlek, töltsd ki a csillaggal (*) jelölt mezőket (a telefonszámot is helyesen).';
        hibas.focus();
        return;
      }
      const adat = new URLSearchParams({
        'form-name': 'pmu-visszahivas',
        nev: nev.value.trim(),
        telefon: telefon.value.trim(),
        szolgaltatas: valasztott(),
        volt_mar_tetovalasa: tetovalas.value,
        megjegyzes: megjegyzes ? megjegyzes.value.trim() : '',
        oldal: location.pathname.split('/').pop() || 'index.html',
      });
      gomb.setAttribute('aria-disabled', 'true');
      gomb.style.opacity = '.6';
      try {
        const v = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: adat.toString() });
        if (!v.ok) throw new Error('HTTP ' + v.status);
        wixLead(adat, [['nev', 'nev'], ['telefon', 'telefonszam'], ['szolgaltatas', 'szolgaltatas'],
          ['volt_mar_tetovalasa', 'volt_mar_korabban_tetovalasod'], ['megjegyzes', 'mit_beszeljuenk_at_a_foglalas_elott']],
          'Smink form', '875a7aa0-161e-464f-9f14-24706dcccd86');
        // mint a Wixen: a pmu-vh koszonooldalra visz
        location.href = '/pmu-vh';
      } catch (err) {
        uzenet.textContent = 'Hiba történt a küldés közben. Kérlek, próbáld újra, vagy hívj minket: 06 20 247 4444';
        gomb.removeAttribute('aria-disabled');
        gomb.style.opacity = '';
      }
    };
    gomb.addEventListener('click', kuld);
    urlap.addEventListener('submit', kuld);
  }

  // --- 7f. allasjelentkezesek (PPC, fodrasz) -> Netlify Forms -------------------
  // Az eles oldalon Wix Forms, bekuldes utan a Wix a koszonooldalra iranyit. A
  // mezok a Wix-cimkejuk eleje alapjan kapnak nevet (a Netlify-urlapleiras a
  // klon-kiegeszites.mjs-ben). A fodrasz-urlap hajkepeit a bongeszoben
  // kicsinyitjuk (a Netlify 8 MB-ot fogad egy bekuldesben), legfeljebb 10-et.
  const JELENTKEZESEK = {
    'form-5b88872c': {
      nev: 'ppc-jelentkezes', siker: '/allashirdetes-ok', wixNev: 'PPC űrlap', wixId: '5b88872c-2a75-4ae1-9376-fdcced9f5ff4',
      wixKulcsok: [['nev', 'first_name'], ['email', 'email'], ['telefon', 'phone'], ['jelenlegi_munkahely', 'tell_us_what_you_need_help_with'],
        ['motivacio', 'miert_valtanal'], ['berigeny', 'form_field'], ['google_ads_ev', 'form_field_1'],
        ['cpa', 'miert_gondolod_hogy_alacsonyabb_cpa_kat_tudnal_elerni_mint_en_10'], ['google_ads_iparag', 'google_ads'],
        ['meta_ads_ev', 'meta_ads'], ['meta_ads_iparag', 'meta_ads_1'], ['wix', 'wix'], ['wordpress', 'wordpress_ben_melyik_szerkesztot_hasznalod']],
      mezok: [
        ['Hány év tapasztalatod van Google', 'google_ads_ev'], ['Milyen iparágakban hirdettél Google', 'google_ads_iparag'],
        ['Hány év tapasztalatod van Facebook', 'meta_ads_ev'], ['Milyen iparágakban hirdettél Facebook', 'meta_ads_iparag'],
        ['Milyen tapasztalatod van WIX', 'wix'], ['Wordpress', 'wordpress'], ['Hol dolgozol most', 'jelenlegi_munkahely'],
        ['Mi a fő motivációd', 'motivacio'], ['Miért gondolod', 'cpa'], ['Havi bérigényed', 'berigeny'],
      ],
    },
    'form-86cf1fc1': {
      nev: 'fodrasz-jelentkezes', siker: '/fodrasz-allas-ok', wixNev: 'Fodrász', wixId: '86cf1fc1-4770-408e-b0a0-d3cf7c3bb447',
      wixKulcsok: [['nev', 'first_name'], ['email', 'email'], ['telefon', 'phone'], ['szuletesi_ev', 'melyik_evben_szuelettel'],
        ['tapasztalat', 'hany_ev_tapasztalatod_van'], ['jelenlegi_munkahely', 'hol_dolgozol_es_miert_valtanal'],
        ['referencia_link', 'fb_insta_tiktok_referenciaid_linkje']],
      mezok: [
        ['Név', 'nev'], ['Melyik évben', 'szuletesi_ev'], ['Hány év tapasztalatod', 'tapasztalat'],
        ['Hol dolgozol', 'jelenlegi_munkahely'], ['Fb / Insta', 'referencia_link'],
      ],
    },
  };
  const MAX_KEP = 10;
  const kicsinyit = (fajl) => new Promise((kesz) => {
    if (!/^image\//.test(fajl.type)) { kesz(fajl.size < 4e6 ? fajl : null); return; }
    const kep = new Image();
    kep.onload = () => {
      const arany = Math.min(1, 1600 / Math.max(kep.width, kep.height));
      const c = document.createElement('canvas');
      c.width = Math.round(kep.width * arany);
      c.height = Math.round(kep.height * arany);
      c.getContext('2d').drawImage(kep, 0, 0, c.width, c.height);
      c.toBlob((b) => kesz(b && new File([b], fajl.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })), 'image/jpeg', 0.8);
      URL.revokeObjectURL(kep.src);
    };
    kep.onerror = () => kesz(null);
    kep.src = URL.createObjectURL(fajl);
  });

  for (const [elotag, cfg] of Object.entries(JELENTKEZESEK)) {
    for (const urlap of document.querySelectorAll(`form[id^="${elotag}"]`)) {
      const gomb = urlap.querySelector('[data-hook="submit-button"]');
      if (!gomb) continue;
      const uzenet = document.createElement('p');
      uzenet.className = 'mh-urlap-uzenet';
      uzenet.setAttribute('role', 'alert');
      gomb.after(uzenet);
      urlap.addEventListener('input', (e) => e.target.classList.remove('mh-hibas'));

      // mezo -> nev: tipus szerint (e-mail, telefon), kulonben a cimke eleje alapjan;
      // a cimke nelkuli szovegmezo a nev (a PPC-urlapon)
      const mezok = [];
      for (const i of urlap.querySelectorAll('input:not([type=file]):not([type=hidden]), textarea')) {
        const cimke = (i.getAttribute('aria-label') || '').trim();
        let nev = i.type === 'email' ? 'email' : (i.type === 'phone' || i.type === 'tel' || /^Telefonszám|Telefonszám$/.test(cimke)) ? 'telefon' : null;
        if (!nev) { const t = cfg.mezok.find(([eleje]) => cimke.startsWith(eleje)); nev = t ? t[1] : (!cimke ? 'nev' : null); }
        if (nev) mezok.push([i, nev]);
      }

      // fajlfeltoltes: a Wix gombja a rejtett <input type=file>-t nyitja meg
      const fajlMezo = urlap.querySelector('input[type=file]');
      let kepek = [];
      if (fajlMezo) {
        const gyoker = fajlMezo.closest('[data-hook="file-upload-root"]');
        const feltolt = gyoker && gyoker.querySelector('button');
        const lista = document.createElement('p');
        lista.className = 'mh-fajlok';
        (gyoker || fajlMezo).after(lista);
        fajlMezo.accept = 'image/*';
        if (feltolt) feltolt.addEventListener('click', (e) => { e.preventDefault(); fajlMezo.click(); });
        fajlMezo.addEventListener('change', () => {
          kepek = [...kepek, ...fajlMezo.files].slice(0, MAX_KEP);
          lista.textContent = kepek.length ? `${kepek.length} kép kiválasztva (legfeljebb ${MAX_KEP})` : '';
          fajlMezo.value = '';
        });
      }

      const kuld = async (e) => {
        e.preventDefault();
        if (gomb.getAttribute('aria-disabled') === 'true') return;
        uzenet.textContent = '';
        let hibas = null;
        for (const [i, nev] of mezok) {
          const ertek = i.value.trim();
          const rossz = (i.required && !ertek) || (ertek && !i.checkValidity()) ||
            (nev === 'telefon' && i.required && ertek.replace(/\D/g, '').length < 8);
          i.setAttribute('aria-invalid', String(!!rossz));
          i.classList.toggle('mh-hibas', !!rossz);
          if (rossz && !hibas) hibas = i;
        }
        if (hibas) {
          uzenet.textContent = 'Kérlek, töltsd ki a kötelező mezőket (az e-mail-címet és a telefonszámot is helyesen).';
          hibas.focus();
          return;
        }
        const adat = new FormData();
        adat.set('form-name', cfg.nev);
        adat.set('oldal', location.pathname.split('/').pop() || 'index.html');
        for (const [i, nev] of mezok) adat.set(nev, i.value.trim());
        gomb.setAttribute('aria-disabled', 'true');
        gomb.style.opacity = '.6';
        try {
          const kicsik = (await Promise.all(kepek.map(kicsinyit))).filter(Boolean);
          kicsik.forEach((f, n) => adat.set('kepek' + (n + 1), f, f.name));
          const v = await fetch('/', { method: 'POST', body: adat });
          if (!v.ok) throw new Error('HTTP ' + v.status);
          wixLead(adat, cfg.wixKulcsok, cfg.wixNev, cfg.wixId);
          location.href = cfg.siker;
        } catch (err) {
          uzenet.textContent = 'Hiba történt a küldés közben. Kérlek, próbáld újra, vagy írj nekünk: mosaicheadspa@gmail.com';
          gomb.removeAttribute('aria-disabled');
          gomb.style.opacity = '';
        }
      };
      gomb.addEventListener('click', kuld);
      urlap.addEventListener('submit', kuld);
    }
  }

  // --- 8. Wix-felugro ablak (lightbox): a fejlec "i" ikonja ---------------
  // Az eles oldalon a [data-popupid] elemre kattintva a Wix JS-e letolti es
  // kirajzolja a felugro ablakot. A klonban a kesz HTML az oldal vegen van egy
  // <template id="mh-popup-<id>">-ben (tools/popup-info.mjs + klon-kiegeszites.mjs).
  // A Wixszel egyezo viselkedes:
  //   - a doboz a Wix CSS-eben levo motion-glideIn animacioval jobbrol uszik be
  //     (600ms): a Wix a --motion-left valtozoba a doboz bal szelet irja, es az
  //     animaciot "paused"-bol inditja, a vegen data-motion-enter="done"
  //   - a hatteroldal nem gorgetheto, amig nyitva van
  //   - bezaras: X gomb, Esc, a fatyolra kattintas (popupsWithCloseOnOverlayClick),
  //     kilepo animacio nelkul (a Wixen is azonnal eltunik)
  const popupok = {};
  let nyitottPopup = null;
  let popupNyito = null;

  function popupElem(id) {
    if (popupok[id]) return popupok[id];
    const sablon = document.getElementById('mh-popup-' + id);
    if (!sablon) return null;
    document.body.appendChild(sablon.content.cloneNode(true));
    const gyoker = document.querySelector('[data-mh-popup="' + id + '"]');
    if (!gyoker) return null;
    // az X, illetve a dobozon kivul barhova (a fatyolra) kattintas bezar
    gyoker.addEventListener('click', (e) => {
      if (e.target.closest('[data-mh-popup-zar]') || !e.target.closest('.mh-popup-doboz')) popupZar();
    });
    gyoker.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-mh-popup-zar]')) { e.preventDefault(); popupZar(); }
    });
    popupok[id] = gyoker;
    return gyoker;
  }

  function popupNyit(id, nyito) {
    const gyoker = popupElem(id);
    if (!gyoker) return;
    if (nyitottPopup) popupZar();
    popupNyito = nyito || null;
    const doboz = gyoker.querySelector('.mh-popup-doboz');
    if (doboz) doboz.removeAttribute('data-motion-enter');
    gyoker.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    nyitottPopup = gyoker;
    if (doboz) {
      // az animacio 0%-an meg nincs eltolas, ezert itt a vegleges helyet merjuk
      doboz.style.setProperty('--motion-left', doboz.getBoundingClientRect().left + 'px');
      doboz.style.animationPlayState = 'running';
      const kesz = () => { doboz.setAttribute('data-motion-enter', 'done'); doboz.style.animationPlayState = ''; };
      if (getComputedStyle(doboz).animationName === 'none') kesz();
      else doboz.addEventListener('animationend', kesz, { once: true });
    }
    gyoker.focus({ preventScroll: true });
  }

  function popupZar() {
    if (!nyitottPopup) return;
    nyitottPopup.hidden = true;
    nyitottPopup = null;
    document.documentElement.style.overflow = '';
    if (popupNyito) popupNyito.focus({ preventScroll: true });
    popupNyito = null;
  }

  for (const nyito of document.querySelectorAll('[data-popupid]')) {
    const id = nyito.getAttribute('data-popupid');
    if (!document.getElementById('mh-popup-' + id)) continue;
    nyito.addEventListener('click', (e) => { e.preventDefault(); popupNyit(id, nyito); });
    nyito.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); popupNyit(id, nyito); }
    });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') popupZar(); });
})();
