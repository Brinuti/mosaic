// Az uj, rejtett fooldal (/uj-fooldal) viselkedese. Onallo: a Wix-klon klon.js-e nem fut ezen a lapon.
// 1. fejlec (gorgetes-arnyek, mobilmenu, lenyilo almenuk)   2. "Osszes piercing tipus", ekszer-galeria   3. videoablak
// 4. Google-velemenyek: Trustindex-widget (tartalek, ha nem toltodik be), kitelepulesi idopontok
// 5. URL-parameterek megorzese es a foglalasi linkek (a klon.js 8. szakaszanak mase: ugyanaz a munkamenet-kulcs)
// A foglalasi gombok (/idopontfoglalas, /kontroll) a motor-indito.js-t hasznaljak (a build teszi a lapra), meres a suti.js-ben.
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // --- 1. fejlec -------------------------------------------------------------------------------------------
  const fejlec = $('#fejlec');
  const gorgetes = () => fejlec.classList.toggle('gorgetve', window.scrollY > 6);
  gorgetes();
  window.addEventListener('scroll', gorgetes, { passive: true });

  const nyito = $('#menu-nyito');   // a hirdetesi landolo rovid fejlecen nincs mobilmenu (fejlec-landolo.html)
  const menuZar = () => {
    if (!nyito) return;
    fejlec.classList.remove('menu-nyitva');
    nyito.setAttribute('aria-expanded', 'false');
    nyito.setAttribute('aria-label', 'Menü megnyitása');
    $('use', nyito).setAttribute('href', '#i-menu');
    document.documentElement.style.overflow = '';
  };
  if (nyito) nyito.addEventListener('click', () => {
    const nyit = !fejlec.classList.contains('menu-nyitva');
    fejlec.classList.toggle('menu-nyitva', nyit);
    nyito.setAttribute('aria-expanded', String(nyit));
    nyito.setAttribute('aria-label', nyit ? 'Menü bezárása' : 'Menü megnyitása');
    $('use', nyito).setAttribute('href', nyit ? '#i-close' : '#i-menu');
    document.documentElement.style.overflow = nyit ? 'hidden' : '';
  });
  // a menü linkjére kattintva a mobilmenü bezárul (a lapon belüli horgonyoknál is)
  if ($('#menu')) $('#menu').addEventListener('click', (e) => { if (e.target.closest('a')) { menuZar(); lenyiloZar(); } });
  window.matchMedia('(min-width: 1001px)').addEventListener('change', (e) => { if (e.matches) menuZar(); });

  const lenyilok = $$('.lenyilo');
  const lenyiloZar = (except) => lenyilok.forEach((l) => {
    if (l === except) return;
    l.classList.remove('nyitva');
    $('.menu-gomb', l).setAttribute('aria-expanded', 'false');
  });
  lenyilok.forEach((l) => {
    const gomb = $('.menu-gomb', l);
    gomb.addEventListener('click', () => {
      const nyit = !l.classList.contains('nyitva');
      lenyiloZar(l);
      l.classList.toggle('nyitva', nyit);
      gomb.setAttribute('aria-expanded', String(nyit));
    });
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.lenyilo')) lenyiloZar(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    lenyiloZar(); menuZar();
  });

  // --- 2. osszes piercing tipus ----------------------------------------------------------------------------
  const tobb = $('#tobb-piercing');
  if (tobb) {
    const cimke = tobb.firstChild;
    const eredeti = cimke.textContent;
    tobb.addEventListener('click', () => {
      const nyit = tobb.getAttribute('aria-expanded') !== 'true';
      $$('.kartya.tovabbi').forEach((k) => { k.hidden = !nyit; });
      tobb.setAttribute('aria-expanded', String(nyit));
      cimke.textContent = nyit ? 'Kevesebb típus megjelenítése ' : eredeti;
    });
  }

  // --- 2b. ekszer-galeria: helyben lapozhato (nyilak, ujjal huzas, billentyuzet), a kovetkezo kepek elore toltodnek ----------------
  const galeria = $('#galeria-sav');
  if (galeria) {
    const diak = $$('.dia', galeria);
    const elozo = $('.galeria-elozo'), kovetkezo = $('.galeria-kov'), szamlalo = $('[data-aktualis]');
    const index = () => Math.max(0, Math.min(diak.length - 1, Math.round(galeria.scrollLeft / Math.max(1, galeria.clientWidth))));
    const frissit = () => {
      const i = index();
      szamlalo.textContent = String(i + 1);
      elozo.disabled = i === 0;
      kovetkezo.disabled = i === diak.length - 1;
      // a kovetkezo ket kep (es az elozo) azonnal toltodik, hogy lapozaskor mar kesz legyen
      [i - 1, i + 1, i + 2].forEach((j) => { const im = diak[j] && $('img', diak[j]); if (im && im.loading === 'lazy') im.loading = 'eager'; });
    };
    const lapoz = (d) => galeria.scrollTo({ left: (index() + d) * galeria.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    elozo.addEventListener('click', () => lapoz(-1));
    kovetkezo.addEventListener('click', () => lapoz(1));
    galeria.addEventListener('scroll', () => window.requestAnimationFrame(frissit), { passive: true });
    galeria.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); lapoz(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); lapoz(-1); }
    });
    window.addEventListener('resize', frissit);
    frissit();
  }

  // --- 2c. nagyito: az ekszerkepre kattintva nagyban nyilik (nyilak, billentyuzet, ujjal huzas; Esc / hatter zar) -------------------
  const nagyito = $('#nagyito');
  if (galeria && nagyito && typeof nagyito.showModal === 'function') {
    const diakGomb = $$('.dia-nagyit', galeria);
    const kep = $('.nagyito-kep', nagyito), szam = $('[data-n]', nagyito);
    let idx = 0;
    const mutat = (i) => {
      idx = (i + diakGomb.length) % diakGomb.length;
      kep.src = diakGomb[idx].dataset.nagy;
      kep.alt = $('img', diakGomb[idx]).alt;
      szam.textContent = String(idx + 1);
      const kov = diakGomb[(idx + 1) % diakGomb.length]; if (kov) new Image().src = kov.dataset.nagy;   // a kovetkezo elore toltodik
    };
    diakGomb.forEach((g, i) => g.addEventListener('click', () => { mutat(i); nagyito.showModal(); }));
    $('.nagyito-elozo', nagyito).addEventListener('click', () => mutat(idx - 1));
    $('.nagyito-kov', nagyito).addEventListener('click', () => mutat(idx + 1));
    $('.nagyito-zar', nagyito).addEventListener('click', () => nagyito.close());
    nagyito.addEventListener('click', (e) => { if (e.target === nagyito) nagyito.close(); });
    nagyito.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); mutat(idx + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); mutat(idx - 1); }
    });
    let x0 = null;
    nagyito.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    nagyito.addEventListener('touchend', (e) => { if (x0 === null) return; const d = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(d) > 50) mutat(idx + (d < 0 ? 1 : -1)); }, { passive: true });
    nagyito.addEventListener('close', () => { kep.removeAttribute('src'); });
  }

  // --- 3. videoablak ---------------------------------------------------------------------------------------
  // erintokepernyon (telefon, tablet) a lejatszott video teljes kepernyore ugrik (a tulajdonos kerese, 2026-10-16)
  const ERINTO = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  const teljesKepernyo = (el) => {
    if (document.fullscreenElement || document.webkitFullscreenElement || el.webkitDisplayingFullscreen) return null;
    try {
      const kero = el.requestFullscreen || el.webkitRequestFullscreen;
      if (kero) { const p = kero.call(el); return p && p.then ? p : Promise.resolve(); }
      if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();   // iPhone: csak a video elem tud teljes kepernyot
    } catch (x) { /* nem tamogatott: marad a helyben / ablakban lejatszas */ }
    return null;
  };
  const ablak = $('#videoablak');
  if (ablak && typeof ablak.showModal === 'function') {
    const keret = $('.videoablak-keret', ablak);
    const bezar = () => { if (ablak.open) ablak.close(); };
    ablak.addEventListener('close', () => { keret.textContent = ''; });
    $('.videoablak-zar', ablak).addEventListener('click', bezar);
    ablak.addEventListener('click', (e) => { if (e.target === ablak) bezar(); });
    $$('a.video[data-embed]').forEach((a) => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const f = document.createElement('iframe');
      // erintokepernyon: iPhone-on a YouTube a sajat teljes kepernyos lejatszojaban indul (playsinline=0), kevesebb felirat a kepen (iv_load_policy=3)
      f.src = ERINTO && /youtube/.test(a.dataset.embed) ? a.dataset.embed + (a.dataset.embed.includes('?') ? '&' : '?') + 'playsinline=0&iv_load_policy=3&fs=1' : a.dataset.embed;
      f.title = a.dataset.cim || 'Videó';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      keret.textContent = '';
      keret.appendChild(f);
      ablak.classList.toggle('allo', a.hasAttribute('data-allo'));   // allo (9:16) video: allo ablak
      // erintokepernyon az ablak kitolti a kepernyot (a YouTube feliratai, gombjai a fekete savokra kerulnek, nem a videora),
      // es ahol lehet (Android), a lejatszo teljes kepernyore ugrik, a fekvo video fekvo tajolasban
      ablak.classList.toggle('mobil', ERINTO);
      ablak.showModal();
      if (ERINTO) {
        const p = teljesKepernyo(keret);
        if (p && !a.hasAttribute('data-allo')) p.then(() => { const t = window.screen && window.screen.orientation; if (t && t.lock) t.lock('landscape').catch(() => {}); }).catch(() => {});
      }
    }));
    ablak.addEventListener('close', () => { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); });
  }

  // --- 3b. az oldal sajat videoi (mp4) erintokepernyon a lejatszaskor teljes kepernyore ugranak; a vegen visszaallnak ---
  // (iPhone: playsinline nelkul a Safari a sajat teljes kepernyos lejatszojaban inditja; Android: teljes kepernyo a lejatszaskor)
  const hangosVideo = (v) => v instanceof HTMLVideoElement && v.controls && !v.loop && !v.defaultMuted;
  if (ERINTO) {
    $$('video').forEach((v) => { if (hangosVideo(v)) { v.playsInline = false; v.removeAttribute('playsinline'); } });
    document.addEventListener('play', (e) => { if (hangosVideo(e.target)) teljesKepernyo(e.target); }, true);
    document.addEventListener('ended', (e) => { if (hangosVideo(e.target) && document.fullscreenElement === e.target && document.exitFullscreen) document.exitFullscreen().catch(() => {}); }, true);
  }

  // --- 3c. a sajat (allo) videok boritojan nagy lejatszas-gomb, kattintasra indul (a tulajdonos kerese, 2026-10-16, 4. kor: "latszodjon, hogy le tudja
  // jatszani"); a lejatszo vezerlosavja az inditas utan jelenik meg (a 3b. elott a playsinline mar lekerult, a teljes kepernyo a lejatszaskor jon)
  $$('video[controls]').forEach((v) => {
    if (v.closest('[data-vsav]') || v.autoplay || !v.paused || !v.parentElement) return;
    const szulo = v.parentElement;
    if (getComputedStyle(szulo).position === 'static') szulo.style.position = 'relative';
    const g = document.createElement('button');
    g.type = 'button'; g.className = 'video-indito' + (v.hasAttribute('data-terv') ? ' terv' : ''); // (tervezett borito: a lejatszas-jel a kepen van)
    g.setAttribute('aria-label', v.getAttribute('aria-label') || 'Videó lejátszása');
    g.innerHTML = '<span class="lejatszo"><svg class="ik" aria-hidden="true"><use href="#i-play"/></svg></span>';
    // a video LATHATO helye a szulohoz kepest (a CSS-eltolast - pl. left:50% + translateX(-50%) - is figyelembe veve; az offsetLeft ezt nem latja)
    const igazit = () => {
      const vr = v.getBoundingClientRect(), pr = szulo.getBoundingClientRect();
      g.style.left = (vr.left - pr.left - szulo.clientLeft + szulo.scrollLeft) + 'px'; g.style.top = (vr.top - pr.top - szulo.clientTop + szulo.scrollTop) + 'px';
      g.style.width = vr.width + 'px'; g.style.height = vr.height + 'px';
    };
    v.controls = false;
    v.after(g); igazit();
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(igazit); ro.observe(v); ro.observe(szulo); }
    window.addEventListener('resize', igazit);
    const kesz = () => { if (g.isConnected) g.remove(); v.controls = true; };
    g.addEventListener('click', () => { kesz(); const p = v.play(); if (p && p.catch) p.catch(() => {}); });
    v.addEventListener('play', kesz, { once: true });
  });

  // --- 3d. az allo Facebook-videok tervezett boritoja (tools/uj-fooldal.mjs fbBorito): kattintasra a helyen tolt be a Facebook-lejatszo, indulasra keszen ---
  $$('.fb-indito[data-fb-src]').forEach((g) => g.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = g.dataset.fbSrc.replace(/&(amp;)?autoplay=[^&]*/g, '') + '&autoplay=true';
    f.title = g.dataset.fbCim || 'Videó';
    if (g.dataset.fbWidth) f.width = g.dataset.fbWidth;
    if (g.dataset.fbHeight) f.height = g.dataset.fbHeight;
    f.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';
    f.allowFullscreen = true;
    f.setAttribute('frameborder', '0');
    g.replaceWith(f);
    f.focus();
  }));

  // --- 4. Google-velemenyek: a Trustindex-widget (az oldalban a loader.js tolti, lapozhato); ha 9 mp alatt nem jelenik meg, a mentett tartalek latszik ---
  // A Trustindex-loader a widgetet csak a lap kozeleben, felhasznaloi tevekenyseg utan tolti: a 9 masodperc attol szamit, hogy a doboz kozel er a kepernyohoz
  // (a lap aljan levo doboz, pl. a kategoria-oldalakon, nem mutat tartalekot, amig a latogato oda nem gorget).
  // (dobozonkent: egy lapon tobb widget is lehet, pl. a velemenyek oldalan kategoriankent)
  $$('[data-trustindex]').forEach((tiHely) => {
    const tartalek = tiHely.parentElement && $('[data-tartalek]', tiHely.parentElement);
    if (!tartalek) return;
    const indit = () => window.setTimeout(() => { if (!$('.ti-widget', tiHely)) tartalek.hidden = false; }, 9000);
    if ('IntersectionObserver' in window) {
      const figyel = new IntersectionObserver((e) => { if (e[0].isIntersecting) { figyel.disconnect(); indit(); } }, { rootMargin: '600px' });
      figyel.observe(tiHely);
    } else indit();
  });

  // --- 4d. a keves velemenyt mutato widget (pl. a lep-oldal sajat, szurt widgetje: 1 velemeny) ne nyuljon a teljes szelessegre (a tulajdonos kerese, 2026-10-16) ---
  $$('[data-trustindex]').forEach((hely) => {
    const doboz = hely.closest('.velemeny-doboz');
    if (!doboz || !('MutationObserver' in window)) return;
    const meret = () => { const db = $$('.ti-review-item', hely).length; if (db) doboz.classList.toggle('ti-keves', db <= 2); };
    const figyel = new MutationObserver(meret);
    figyel.observe(hely, { childList: true, subtree: true });
    window.setTimeout(() => figyel.disconnect(), 60000);
  });

  // --- 4c. a hos ertekeles-sora (kategoria-oldalak): a pontszam es a vélemenyek szama a Trustindex-widget fejlecebol (/api/ertekeles), a build idejen irt szoveg tartalek ---
  const ertekelesek = $$('[data-ti-ertekeles]');
  const darabok = $$('[data-ti-darab]');   // a cimben szereplo vendegszam ("... 5 022 vendegunk leirta")
  if ((ertekelesek.length || darabok.length) && window.fetch) {
    fetch('/api/ertekeles').then((v) => (v.ok ? v.json() : null)).then((a) => {
      if (!a || !a.db || !a.pont) return;
      const szoveg = a.szoveg + ' – ' + String(a.pont).replace('.', ',') + ' – ' + a.db.toLocaleString('hu-HU') + ' vélemény »';
      ertekelesek.forEach((e) => { e.textContent = szoveg; });
      darabok.forEach((e) => { e.textContent = a.db.toLocaleString('hu-HU'); });
    }).catch(() => { /* marad a build idejen irt szoveg */ });
  }

  // --- 4b. kitelepulesek: a helyszin-csempek friss idopontjai (a build mar beirta; itt a tablazat mostani allapota, /api/kitelepulesek) ---
  const ROVID = { 'Január': 'Jan.', 'Február': 'Febr.', 'Március': 'Márc.', 'Április': 'Ápr.', 'Május': 'Máj.', 'Június': 'Jún.', 'Július': 'Júl.', 'Augusztus': 'Aug.', 'Szeptember': 'Szept.', 'Október': 'Okt.', 'November': 'Nov.', 'December': 'Dec.' };
  const rovid = (sor) => sor.replace(/^[^\s\d]+/, (h) => ROVID[h] || h).replace(/,\s*/g, ',\u2009');
  const datumok = $$('[data-mp-kitelepules]');
  const akcHelyek = $('[data-akc-helyek]');
  const kitAdat = (datumok.length || akcHelyek) && window.fetch
    ? fetch('/api/kitelepulesek').then((v) => (v.ok ? v.json() : null)).catch(() => null) : Promise.resolve(null);
  if (datumok.length) {
    kitAdat.then((adat) => {
      if (!adat || !adat.sorok) return; // (marad a build idejen beirt allapot)
      for (const d of datumok) {
        const sorok = adat.sorok[d.dataset.mpKitelepules];
        if (sorok && sorok.length) d.replaceChildren(...sorok.map(d.hasAttribute('data-teljes') ? (x) => x : rovid).flatMap((x, i) => (i ? [document.createElement('br'), x] : [x])));
      }
    });
  }

  // --- 4f. az oszi akcio oldala ("Hol és mikor?", a tulajdonos kerese, 2026-10-16): Budapest mellett a ket legkozelebbi kitelepulesi nap a tablazatbol
  // (a helyszin valodi napja, nem kitalalt "szabad idopont": a szabad idopontokat a foglalo mutatja); ha nincs adat, csak Budapest + a gomb latszik ---
  if (akcHelyek) {
    const HONAP = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
    const HO_ROVID = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
    const NAP = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
    const most = new Date(), ma = new Date(most); ma.setHours(0, 0, 0, 0);
    if (most.getHours() >= 15) ma.setDate(ma.getDate() + 1); // (delutan a mai kitelepulesi nap mar nem foglalhato: a kovetkezo napot mutatjuk)
    const kovetkezo = (sorok) => {
      let leg = null;
      for (const sor of sorok || []) {
        const m = /^(\S+)\s+([\d,\s]+)$/.exec(sor.trim()); const h = m ? HONAP.indexOf(m[1]) : -1;
        if (h < 0) continue;
        const ev = ma.getFullYear() + (h < ma.getMonth() - 2 ? 1 : 0); // (decemberben a januari sor mar a kovetkezo ev)
        for (const n of m[2].split(',').map((x) => +x.trim()).filter(Boolean)) { const d = new Date(ev, h, n); if (d >= ma && (!leg || d < leg)) leg = d; }
      }
      return leg;
    };
    const ma0 = new Date(most); ma0.setHours(0, 0, 0, 0);
    const szoveg = (d) => { const k = Math.round((d - ma0) / 864e5); return k === 0 ? 'ma' : k === 1 ? 'holnap' : `${HO_ROVID[d.getMonth()]} ${d.getDate()}., ${NAP[d.getDay()]}`; };
    kitAdat.then((adat) => {
      if (!adat || !adat.sorok) return;
      const jelolt = [];
      for (const li of $$('#helyszinek .helyek li')) {
        const kulcs = li.querySelector('[data-mp-kitelepules]'), a = li.querySelector('a[href]'), nev = li.querySelector('b');
        const d = kulcs && a && nev && kovetkezo(adat.sorok[kulcs.dataset.mpKitelepules]);
        if (d) jelolt.push({ d, nev: nev.textContent, href: a.getAttribute('href') });
      }
      jelolt.sort((x, y) => x.d - y.d).slice(0, 2).forEach((j) => {
        const li = document.createElement('li'); li.className = 'akc-hely';
        const bal = document.createElement('div'), b = document.createElement('b'), s1 = document.createElement('span'), s2 = document.createElement('span');
        b.textContent = j.nev; s1.textContent = 'kitelepülés'; s2.className = 'akc-kov'; s2.textContent = 'Következő nap: ' + szoveg(j.d);
        bal.append(b, s1, s2);
        const g = document.createElement('a'); g.className = 'gomb gomb-kicsi'; g.href = j.href; g.textContent = 'Foglalás';
        li.append(bal, g); akcHelyek.append(li);
      });
    });
  }
  // az akcio-oldal "Ezt foglalom" gombjai (data-csomag): a foglalo a csomaggal elovalasztva nyilik (motor.js nyit: a Piercing-lepesben az a csomag elol, lenyitva).
  // (a kattintas a motor-indito elott fut - elkapo fazis -; a foglalasi ut es a meres ugyanaz)
  document.addEventListener('click', (e) => { const a = e.target && e.target.closest ? e.target.closest('a[data-csomag]') : null; if (a) window.__mpCsomag = a.dataset.csomag; }, true);

  // --- 4e. a vendegek videos beszamoloi (lapozhato sav): csak a boritokep toltodik (lustan), a video kattintasra indul helyben; egyszerre egy szol ---
  $$('[data-vsav]').forEach((sav) => {
    const sor = $('.vsav-sav', sav), elozo = $('.vsav-elozo', sav), kov = $('.vsav-kov', sav);
    if (!sor) return;
    const frissit = () => {
      const van = sor.scrollWidth > sor.clientWidth + 2;
      sav.classList.toggle('vsav-nincs-gorg', !van);
      if (elozo) elozo.disabled = sor.scrollLeft <= 2;
      if (kov) kov.disabled = sor.scrollLeft + sor.clientWidth >= sor.scrollWidth - 2;
    };
    const lapoz = (irany) => sor.scrollBy({ left: irany * sor.clientWidth * 0.9, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (elozo) elozo.addEventListener('click', () => lapoz(-1));
    if (kov) kov.addEventListener('click', () => lapoz(1));
    sor.addEventListener('scroll', () => window.requestAnimationFrame(frissit), { passive: true });
    window.addEventListener('resize', frissit);
    frissit();
    sav.addEventListener('click', (e) => {
      const g = e.target.closest('[data-vsav-video]');
      if (!g) return;
      const v = document.createElement('video');
      v.src = g.dataset.vsavVideo; v.controls = true; v.playsInline = !ERINTO; v.autoplay = true; v.preload = 'auto';
      const kep = $('img', g); if (kep) v.poster = kep.currentSrc || kep.src;
      v.className = 'vsav-video';
      g.replaceWith(v);
      $$('video.vsav-video').forEach((m) => { if (m !== v && !m.paused) m.pause(); });
      v.addEventListener('play', () => $$('video.vsav-video').forEach((m) => { if (m !== v && !m.paused) m.pause(); }));
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    });
  });

  // --- 4f. kiemelt visszajelzes a tulajdonosnak (/uj/visszajelzes; a vendeglevelek "Valami nem volt rendben" gombja ide visz) ---
  (() => {
    const f = document.getElementById('visszajelzes'); if (!f) return;
    const allapot = f.querySelector('.vj-allapot'), gomb = f.querySelector('button');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!f.checkValidity()) { allapot.textContent = 'Kérjük, töltsd ki a nevet, az e-mail-címet és az üzenetet.'; f.reportValidity && f.reportValidity(); return; }
      const adat = new FormData(f); adat.append('form-name', 'tulajdonosi-visszajelzes'); adat.append('oldal', location.pathname + location.search);
      gomb.disabled = true; allapot.textContent = 'Küldés…';
      try {
        const v = await fetch('/api/urlap', { method: 'POST', body: adat });
        if (!v.ok) throw new Error(String(v.status));
        f.reset(); allapot.textContent = 'Köszönjük, megkaptuk! A tulajdonosunk hamarosan keres.';
      } catch (x) { allapot.textContent = 'Hiba történt, kérjük, próbáld újra, vagy hívj minket: +36 1 901 7444.'; gomb.disabled = false; }
    });
  })();

  // --- 5. URL-parameterek megorzese es a foglalasi linkek (klon.js 8.) --------------------------------------
  const MENTETT = 'savedQueryParams';
  const GK = /^(gclid|gbraid|wbraid)$/i;
  // korabbi (a javitas elotti) munkamenetbol maradt Google-kattintasazonosito: torles, vissza nem irjuk (klon.js 8. masa)
  try {
    const regi = JSON.parse(sessionStorage.getItem(MENTETT) || 'null');
    if (regi && typeof regi === 'object' && Object.keys(regi).some((k) => GK.test(k))) {
      const tiszta = Object.fromEntries(Object.entries(regi).filter(([k]) => !GK.test(k)));
      if (Object.keys(tiszta).length) sessionStorage.setItem(MENTETT, JSON.stringify(tiszta)); else sessionStorage.removeItem(MENTETT);
    }
  } catch (x) { try { sessionStorage.removeItem(MENTETT); } catch (y) { /* tiltott tarolo */ } }
  try {
    const most = new URLSearchParams(location.search);
    if ([...most.keys()].length) {
      // a Google-kattintasazonositot hozzajarulas nelkul NEM taroljuk (a belso linkek viszik tovabb, lent)
      const ment = Object.fromEntries([...most].filter(([k]) => !GK.test(k)));
      if (Object.keys(ment).length) sessionStorage.setItem(MENTETT, JSON.stringify(ment));
    } else {
      const m0 = JSON.parse(sessionStorage.getItem(MENTETT) || 'null');
      const m = m0 && typeof m0 === 'object' ? Object.fromEntries(Object.entries(m0).filter(([k]) => !GK.test(k))) : null;
      if (m && Object.keys(m).length) history.replaceState(history.state, '', location.pathname + '?' + new URLSearchParams(m) + location.hash);
    }
  } catch (x) { /* privat mod / hibas mentes: marad a cim */ }
  // A Salonic-linkek viszik az fbclid / ttclid / utm_* parametereket (a Google-kattintasazonositot nem), a sajat tartomany
  // belso linkjei a Google-kattintasazonositot (hogy egy masik belso oldalon elfogadott suti utan is meglegyen).
  const TOVABB = /^(fbclid|gclid|gbraid|wbraid|ttclid|utm_[a-z_]+)$/i;
  const SALONIC = /^https?:\/\/medicalpiercing\.salonic\.hu(\/|$)/i;
  const kiegeszit = (a) => {
    const href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    let u;
    try { u = new URL(href, location.href); } catch (x) { return; }
    const salonic = SALONIC.test(u.href);
    const belso = u.origin === location.origin && /^https?:$/.test(u.protocol);
    if (!salonic && !belso) return;
    let valtozott = false;
    for (const [k, v] of new URLSearchParams(location.search)) {
      if (!v || u.searchParams.has(k)) continue;
      if (salonic ? (TOVABB.test(k) && !GK.test(k)) : GK.test(k)) { u.searchParams.set(k, v); valtozott = true; }
    }
    if (valtozott) a.setAttribute('href', u.href);
  };
  $$('a[href]').forEach(kiegeszit);
  ['click', 'auxclick', 'contextmenu'].forEach((esemeny) => {
    document.addEventListener(esemeny, (e) => { const a = e.target.closest && e.target.closest('a[href]'); if (a) kiegeszit(a); }, true);
  });
})();
