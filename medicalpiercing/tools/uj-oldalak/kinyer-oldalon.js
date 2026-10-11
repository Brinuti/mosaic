// A bongeszoben (Playwright page.evaluate) fut: egy Wix-klon oldal TARTALMANAK kinyerese.
// Visszaad: { cim, leiras, tipus, szekciok: [ { id, bgSzin, horgonyok, fa } ], urlapok, magassag }, ahol a "fa" a szekcio elemeinek
// olvasasi sorrendu fastrukturaja: sor (egymas melletti oszlopok) / verem (egymas alatti elemek) / levelek (h, p, ul, kep, gomb, iframe, galeria, cikk, posztok).
// Nem dont a megjelenesrol: csak azt adja, ami az oldalon van (szoveg, kep, link, beagyazas), a Wix-elrendezes (XY-vagas) szerint csoportositva.
// A sablon (tools/uj-oldalak/sablon.mjs) dont a megjelenesrol.
(() => {
  const ROOT = document.querySelector('main#PAGES_CONTAINER');
  if (!ROOT) return { hiba: 'nincs PAGES_CONTAINER' };
  const abs = (r) => ({ x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) });
  const lathato = (e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
  const lathatoLanc = (e) => { for (let k = e; k && k !== ROOT; k = k.parentElement) { const cs = getComputedStyle(k); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tiszta = (s) => s.replace(/[​‌‍﻿]/g, '').replace(/ /g, ' ');
  const urlAbs = (u) => { try { const x = new URL(u, location.href); return x.origin === location.origin ? x.pathname + x.search + x.hash : x.href; } catch { return u; } };
  const szoveg = (e) => tiszta(e.textContent).replace(/\s+/g, ' ').trim();

  // inline HTML: szoveg + vastag/dolt/link/sortores (a Wix a vastagot stilussal adja: a szamitott stilus alapjan)
  const inline = (blokk) => {
    const alap = parseInt(getComputedStyle(blokk).fontWeight, 10) || 400;
    const alapDolt = getComputedStyle(blokk).fontStyle === 'italic';
    const bejar = (n, vastag, dolt) => {
      let h = '';
      for (const k of n.childNodes) {
        if (k.nodeType === 3) {
          let t = tiszta(k.textContent); if (!t) continue;
          t = esc(t);
          if (vastag && t.trim()) t = `<strong>${t}</strong>`;
          if (dolt && t.trim()) t = `<em>${t}</em>`;
          h += t;
        } else if (k.nodeType === 1) {
          const tag = k.tagName.toLowerCase();
          if (tag === 'br') { h += '<br>'; continue; }
          if (['script', 'style', 'svg', 'img', 'iframe', 'button', 'input'].includes(tag)) continue;
          const cs = getComputedStyle(k);
          if (cs.display === 'none') continue;
          const v = (parseInt(cs.fontWeight, 10) || 400) >= 600 && alap < 600;
          const d = cs.fontStyle === 'italic' && !alapDolt;
          if (tag === 'a') {
            const href = k.getAttribute('href');
            const belso = bejar(k, false, false);
            const cel = k.getAttribute('target') === '_blank' ? ' target="_blank" rel="noopener"' : '';
            h += href && belso.trim() ? `<a href="${esc(urlAbs(href))}"${cel}>${belso}</a>` : belso;
          } else h += bejar(k, vastag || v, dolt || d);
        }
      }
      return h;
    };
    return bejar(blokk, false, false).replace(/<\/strong>(\s*)<strong>/g, '$1').replace(/<\/em>(\s*)<em>/g, '$1').replace(/(<br>\s*){3,}/g, '<br><br>').replace(/^(\s|<br>)+|(\s|<br>)+$/g, '').trim();
  };
  const szovegesHtml = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

  // a nem tartalom: sablon-nyelv (template), tartalom nelkuli popupok
  const kizart = (e) => !!e.closest('template,[data-testid="mp-popup"]');
  // a kulon kezelt tartomanyok (a cikk, a poszt-lista, a friss bejegyzesek): azokat sajat levelek irjak le
  const kulonTartomany = '[data-hook="post-page"] article[data-hook="post"],[data-hook="recent-posts"],[data-hook="post-list-item"],form,[data-hook="comments-container"],[id^="root-comment-box-start"],[data-hook="top-level-comment-list"]';
  const kulon = (e) => !!e.closest(kulonTartomany);
  const galeriaTartomany = '.pro-gallery';

  const szekciok = [...ROOT.querySelectorAll('section.wixui-section')].filter((s) => !s.parentElement.closest('section.wixui-section'));
  const szekcioDe = (e) => { let top = e.closest('section.wixui-section'); while (top && top.parentElement && top.parentElement.closest('section.wixui-section')) top = top.parentElement.closest('section.wixui-section'); return top; };

  const levelek = [];
  const felvesz = (e, o, rect) => { levelek.push({ ...o, r: rect || abs(e.getBoundingClientRect()), sz: szekcioDe(e), el: e }); };
  const kesz = new WeakSet();

  // --- szoveges blokkok: cimsorok, bekezdesek, listak ---
  for (const e of ROOT.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,ol')) {
    if (kesz.has(e) || kizart(e) || kulon(e) || e.closest(galeriaTartomany)) continue;
    const tag = e.tagName.toLowerCase();
    if ((tag === 'ul' || tag === 'ol') && e.parentElement.closest('ul,ol')) continue;
    if (tag !== 'ul' && tag !== 'ol' && e.closest('li')) continue;
    const panel = e.closest('[role="tabpanel"]');
    if (!panel && !lathatoLanc(e)) continue;
    if (!panel && !lathato(e)) continue;
    if (tag === 'ul' || tag === 'ol') {
      const lis = [...e.children].filter((x) => x.tagName === 'LI').map((li) => inline(li)).filter((h) => szovegesHtml(h));
      if (!lis.length) continue;
      kesz.add(e); felvesz(e, { t: 'ul', rendezett: tag === 'ol', elemek: lis, panel: panel ? panel.id : '' });
      continue;
    }
    const html = inline(e);
    if (!szovegesHtml(html) || szovegesHtml(html) === 'Id') continue;   // 'Id': a Wix-szerkesztobol maradt, eltakart szovegtores a /rolunk arkartyaja mogott
    const cs = getComputedStyle(e);
    kesz.add(e);
    const kit = e.querySelector('[data-mp-kitelepules]');   // kitelepulesi idopontok: a lap betoltesekor a tablazatbol frissulnek
    felvesz(e, { t: /^h[1-6]$/.test(tag) ? 'h' : 'p', n: /^h[1-6]$/.test(tag) ? +tag[1] : 0, html, fs: Math.round(parseFloat(cs.fontSize)), fw: parseInt(cs.fontWeight, 10) || 400, kozep: cs.textAlign === 'center', ...(kit ? { kit: kit.getAttribute('data-mp-kitelepules') } : {}), panel: panel ? panel.id : '' });
  }

  // --- kepek (a galeria kepeit a galeria-level irja) ---
  const latottKep = new Set();
  for (const im of ROOT.querySelectorAll('img')) {
    if (kizart(im) || kulon(im) || im.closest(galeriaTartomany)) continue;
    const panel = im.closest('[role="tabpanel"]');
    if (!panel && !lathatoLanc(im)) continue;
    const src = im.getAttribute('src') || im.getAttribute('data-src') || '';
    if (!src || /^data:/.test(src)) continue;
    const r = im.getBoundingClientRect();
    if (!panel && (r.width < 12 || r.height < 12)) continue;
    const rect = abs(r);
    const kulcs = src + '|' + rect.x + '|' + rect.y;
    if (latottKep.has(kulcs)) continue; latottKep.add(kulcs);
    const a = im.closest('a');
    const bg = !!im.closest('[data-hook="bgLayers"],[id^="bgMedia_"]');
    felvesz(im, { t: 'kep', src: urlAbs(src), alt: im.getAttribute('alt') || '', link: a && a.getAttribute('href') ? urlAbs(a.getAttribute('href')) : '', bg, nw: im.naturalWidth, nh: im.naturalHeight, panel: panel ? panel.id : '' });
  }

  // --- galeria (Pro Gallery): egy level a galeria osszes kepevel ---
  for (const g of ROOT.querySelectorAll('.pro-gallery')) {
    if (kizart(g) || !lathatoLanc(g) || (g.parentElement && g.parentElement.closest('.pro-gallery'))) continue;
    const kepek = []; const lattak = new Set();
    for (const im of g.querySelectorAll('img')) {
      const src = im.getAttribute('src') || im.getAttribute('data-src') || '';
      if (!src || /^data:/.test(src) || lattak.has(src)) continue; lattak.add(src);
      const a = im.closest('a');
      const cim = (im.closest('[data-hook="gallery-item-container"]') || im).getAttribute('aria-label') || '';
      kepek.push({ src: urlAbs(src), alt: im.getAttribute('alt') || cim || '', link: a && a.getAttribute('href') && !/^#/.test(a.getAttribute('href')) ? urlAbs(a.getAttribute('href')) : '' });
    }
    if (kepek.length) felvesz(g, { t: 'galeria', kepek });
  }

  // --- gombok / onallo linkek ---
  for (const a of ROOT.querySelectorAll('a[href]')) {
    if (kizart(a) || kulon(a) || a.closest(galeriaTartomany)) continue;
    if (a.closest('p,h1,h2,h3,h4,h5,h6,li')) continue;
    if (a.querySelector('img')) continue;
    if (!lathatoLanc(a) || !lathato(a)) continue;
    const t = szoveg(a);
    if (!t) continue;
    felvesz(a, { t: 'gomb', szoveg: t, href: urlAbs(a.getAttribute('href')), kulso: /^https?:/.test(urlAbs(a.getAttribute('href'))) });
  }

  // --- feliratos gombok (pl. a keresooldal szuro-fulei): nem linkek, nem urlap-gombok ---
  for (const g of ROOT.querySelectorAll('button')) {
    if (kizart(g) || kulon(g) || g.closest(galeriaTartomany) || g.closest('form') || !lathatoLanc(g) || !lathato(g)) continue;
    const t = szoveg(g);
    if (!t || t.length > 80 || g.closest('a')) continue;
    if (/^(Előző|Következő|Previous|Next|Play|Mute)/.test(t)) continue;
    felvesz(g, { t: 'cimke', szoveg: t });
  }

  // --- beagyazasok ---
  for (const f of ROOT.querySelectorAll('iframe')) {
    if (kizart(f) || kulon(f)) continue;
    if (!lathatoLanc(f)) continue;
    const src = f.getAttribute('src') || f.getAttribute('data-src') || '';
    const fajta = /youtube|youtu\.be/.test(src) ? 'yt' : /google\.[a-z.]+\/maps|maps\.google/.test(src) ? 'terkep' : /\/assets\/embed\//.test(src) ? 'beagyazas' : 'egyeb';
    felvesz(f, { t: 'iframe', src, cim: f.getAttribute('title') || '', fajta });
  }
  for (const v of ROOT.querySelectorAll('video')) {
    if (kizart(v) || kulon(v) || !lathatoLanc(v)) continue;
    const forras = v.getAttribute('src') || (v.querySelector('source') && v.querySelector('source').getAttribute('src')) || '';
    felvesz(v, { t: 'video', src: forras ? urlAbs(forras) : '', poster: v.getAttribute('poster') ? urlAbs(v.getAttribute('poster')) : '', hurok: v.loop, nemakt: v.muted });
  }

  // --- urlap (a mezok a Wix-urlap szerint; a kuldes a /api/urlap vegpontra megy, lasd lib/levelek.js) ---
  const urlapok = [...ROOT.querySelectorAll('input,textarea,select')].filter((x) => lathatoLanc(x) && x.type !== 'hidden').map((x) => {
    const cimke = x.getAttribute('aria-label') || x.placeholder || (x.labels && x.labels[0] && szoveg(x.labels[0])) || '';
    return { tag: x.tagName.toLowerCase(), tipus: x.type || '', nev: x.name || x.id || '', cimke: tiszta(cimke).trim(), kotelezo: x.required || x.getAttribute('aria-required') === 'true' };
  });

  // --- urlapok (Wix-urlap): a mezok cimkevel, tipussal; a kuldest a sablon kezeli (POST /api/urlap) ---
  const cimkeTisztit = (t) => tiszta(t || '').replace(/\s*\*\s*(required)?\s*$/i, '').replace(/\s+required$/i, '').replace(/^(.{3,}?)\.\s*\1$/, '$1').replace(/\s+/g, ' ').trim();
  for (const f of ROOT.querySelectorAll('form')) {
    if (kizart(f) || !lathatoLanc(f)) continue;
    const mezok = [];
    for (const x of f.querySelectorAll('input,textarea,select')) {
      if (x.type === 'hidden' || x.type === 'radio' || x.type === 'checkbox') continue;
      const fajl = x.type === 'file';
      if (!fajl && !lathatoLanc(x)) continue;
      const burok = x.closest('[id^="comp-"]') || x.closest('[data-field-type]') || x.parentElement;
      const lab = (x.labels && x.labels[0]) || burok.querySelector('label');
      let cimke = lab ? ([...lab.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('') || lab.textContent) : '';
      cimke = cimkeTisztit(cimke || x.getAttribute('aria-label') || x.placeholder || '');
      const datum = !!x.closest('.wixui-date-picker') || x.getAttribute('data-hook') === 'date-picker-input';
      mezok.push({ tag: x.tagName.toLowerCase(), tipus: fajl ? 'file' : datum ? 'date' : (x.type || 'text'), cimke, kotelezo: !!(x.required || x.getAttribute('aria-required') === 'true'), nev: x.name || '' });
    }
    const kuld = f.querySelector('button[type="submit"],[data-hook="submit-button"]');
    const kuldFelirat = kuld ? szoveg(kuld) : '';
    felvesz(f, { t: 'urlap', mezok, kuld: kuldFelirat, id: f.id });
  }

  // --- a blogcikk (Wix Blog posta oldal): cim, datum, torzs, friss bejegyzesek ---
  const cikkEl = ROOT.querySelector('[data-hook="post-page"] article[data-hook="post"]');
  let cikk = null;
  if (cikkEl) {
    const torzsEl = cikkEl.querySelector('[data-hook="post-description"]') || cikkEl;
    const torzs = [];
    const cikkKesz = new WeakSet();
    for (const e of torzsEl.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,ol,img,a[href],iframe,video,blockquote')) {
      if (cikkKesz.has(e)) continue;
      const tag = e.tagName.toLowerCase();
      if (tag === 'img') {
        const src = e.getAttribute('src') || ''; if (!src || /^data:/.test(src)) continue;
        const a = e.closest('a');
        if (torzs.length && torzs[torzs.length - 1].t === 'kep' && torzs[torzs.length - 1].src === urlAbs(src)) continue;
        torzs.push({ t: 'kep', src: urlAbs(src), alt: e.getAttribute('alt') || '', link: a && a.getAttribute('href') ? urlAbs(a.getAttribute('href')) : '', nw: e.naturalWidth, nh: e.naturalHeight });
        continue;
      }
      if (tag === 'a') {
        if (e.closest('p,h1,h2,h3,h4,h5,h6,li,blockquote') || e.querySelector('img')) continue;
        const t = szoveg(e); if (!t) continue;
        torzs.push({ t: 'gomb', szoveg: t, href: urlAbs(e.getAttribute('href')), kulso: /^https?:/.test(urlAbs(e.getAttribute('href'))) });
        continue;
      }
      if (tag === 'iframe') { const src = e.getAttribute('src') || ''; torzs.push({ t: 'iframe', src, cim: e.getAttribute('title') || '', fajta: /youtube|youtu\.be/.test(src) ? 'yt' : 'egyeb' }); continue; }
      if (tag === 'video') { torzs.push({ t: 'video', src: e.getAttribute('src') ? urlAbs(e.getAttribute('src')) : '', poster: '', hurok: false, nemakt: false }); continue; }
      if (tag === 'ul' || tag === 'ol') {
        if (e.parentElement.closest('ul,ol')) continue;
        const lis = [...e.children].filter((x) => x.tagName === 'LI').map((li) => inline(li)).filter((h) => szovegesHtml(h));
        if (lis.length) { cikkKesz.add(e); torzs.push({ t: 'ul', rendezett: tag === 'ol', elemek: lis }); }
        continue;
      }
      if (e.closest('li')) continue;
      if (tag === 'p' && e.closest('blockquote')) continue;
      const html = inline(e);
      if (!szovegesHtml(html)) continue;
      cikkKesz.add(e);
      torzs.push({ t: /^h[1-6]$/.test(tag) ? 'h' : tag === 'blockquote' ? 'idezet' : 'p', n: /^h[1-6]$/.test(tag) ? +tag[1] : 0, html });
    }
    const hero = cikkEl.querySelector('[data-hook="post-hero-image"] img');
    cikk = {
      cim: szoveg(cikkEl.querySelector('h1') || { textContent: '' }),
      datum: szoveg(cikkEl.querySelector('[data-hook="time-ago"]') || { textContent: '' }),
      olvasas: szoveg(cikkEl.querySelector('[data-hook="time-to-read"]') || { textContent: '' }),
      frissitve: (() => { const p = [...cikkEl.querySelectorAll('p')].find((x) => /Friss/.test(x.textContent) && x.querySelector('[data-hook="time-ago"]')); return p ? szoveg(p) : ''; })(),
      hero: hero ? { src: urlAbs(hero.getAttribute('src') || ''), alt: hero.getAttribute('alt') || '' } : null,
      torzs,
      kedvelesek: (() => { const k = cikkEl.parentElement.querySelector('[data-hook="like-button-with-count__like-count"],.like-button-with-count__like-count'); return k ? szoveg(k) : ''; })(),
      ertekeles: (() => { const r = cikkEl.querySelector('[data-hook="ratings-display is-ready"]'); const t = r ? szoveg(r) : ''; const m = t.match(/(\d(?:[.,]\d)?)\s*\|\s*(\d+)\s*értékelés/); return m ? { atlag: m[1], db: +m[2] } : null; })(),
      hozzaszolasok: [...(ROOT.querySelector('[data-hook="post-page"]') || ROOT).querySelectorAll('[data-hook^="list-item"]')].map((li) => {
        const tart = li.querySelector('[data-hook="comment-content"]');
        const ert = li.querySelector('[data-hook="ratings-display"]');
        return { szerzo: szoveg(li.querySelector('[data-hook="comments-author"]') || { textContent: '' }), datum: szoveg(li.querySelector('[data-hook="time-ago"]') || { textContent: '' }), ertek: ert ? +ert.getAttribute('data-rating') || 0 : 0, html: tart ? (inline(tart.querySelector('[data-id="content-viewer"]') || tart)) : '', valasz: !/top-level/.test(li.getAttribute('data-hook') || '') };
      }).filter((h) => h.html),
    };
    felvesz(cikkEl, { t: 'cikk', ...cikk });
  }
  // friss bejegyzesek (a cikk alatt)
  for (const lista of ROOT.querySelectorAll('[data-hook="recent-posts"]')) {
    const elemek = [...lista.querySelectorAll('[data-hook="recent-post-list-item"]')].map((it) => {
      const a = it.querySelector('a[href]'); const im = it.querySelector('img');
      const cimEl = it.querySelector('[data-hook="recent-post__title"] a') || a;
      return { cim: szoveg(cimEl || { textContent: '' }), href: a ? urlAbs(a.getAttribute('href')) : '', kep: im ? urlAbs(im.getAttribute('src') || '') : '' };
    }).filter((x) => x.href);
    const fej = lista.querySelector('h2');
    const mind = lista.querySelector('header a[href]');
    felvesz(lista, { t: 'friss', cim: fej ? szoveg(fej) : '', elemek, mindHref: mind ? urlAbs(mind.getAttribute('href')) : '', mindSzoveg: mind ? szoveg(mind) : '' });
  }
  // a blog lista oldal bejegyzesei
  const listaElemek = [...ROOT.querySelectorAll('[data-hook="post-list-item"]')];
  if (listaElemek.length) {
    const elemek = listaElemek.map((it) => {
      const a = it.querySelector('a[href]'); const im = it.querySelector('img');
      const leiras = it.querySelector('[data-hook="post-description"]');
      const meta = it.querySelector('.blog-post-metadata-font');
      const stat = it.querySelector('[data-hook="post-stats"]'), kedv = it.querySelector('[data-hook="like-button-with-count__like-count"],.like-button-with-count__like-count'), ert = it.querySelector('[data-hook="ratings-display"],[data-hook~="ratings-display"]');
      return { cim: szoveg(it.querySelector('h2') || { textContent: '' }), href: a ? urlAbs(a.getAttribute('href')) : '', kep: im ? urlAbs(im.getAttribute('src') || '') : '', kepAlt: im ? (im.getAttribute('alt') || '') : '', kivonat: leiras ? szoveg(leiras) : '', meta: meta ? szoveg(meta) : '', stat: stat ? [...stat.querySelectorAll('span')].map((x) => szoveg(x)).filter(Boolean).join(' · ') : '', kedveles: kedv ? szoveg(kedv) : '', ertekeles: ert ? szoveg(ert).replace(/^.*?([\d.]+\s*\|\s*\d+\s*értékelés).*$/, '$1') : '' };
    });
    felvesz(listaElemek[0], { t: 'posztok', elemek });
  }

  // --- horgonyok (belso #linkek celjai) ---
  const horgonyok = (s) => [...s.querySelectorAll('[role="region"] > div[id]')].map((d) => d.id).filter(Boolean);

  // --- elrendezes: a Wix-tervezo csoportjai (DOM) + XY-vagas az egyes csoportok elemei kozott ---
  // 1. a levelekbol a DOM ose-lancai szerint fa epul (egyagu lancok osszevonva): a tervezo csoportjai (kartyak, dobozok, ismetlok) egyben maradnak.
  // 2. egy csoport elemeit (levelek es alcsoportok) a helyzetuk szerint rendezzuk: egymas melletti oszlopok (sor) vagy egymas alatti sorok (verem).
  // 3. az ismetlo (role=list / listitem) elemei DOM-sorrendben racsba (racs) kerulnek: a csempek egyben, olvasasi sorrendben.
  const KILOG = 3;
  const egyesit = (rs) => { const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y)), x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
  const vag = (atomok, tengely) => {
    const kezd = tengely === 'y' ? (o) => o.r.y : (o) => o.r.x;
    const veg = tengely === 'y' ? (o) => o.r.y + o.r.h : (o) => o.r.x + o.r.w;
    const rend = atomok.slice().sort((a, b) => kezd(a) - kezd(b) || (tengely === 'y' ? a.r.x - b.r.x : a.r.y - b.r.y));
    const csoportok = []; let akt = [rend[0]]; let vegeMax = veg(rend[0]);
    for (const o of rend.slice(1)) {
      if (kezd(o) >= vegeMax - KILOG) { csoportok.push(akt); akt = [o]; vegeMax = veg(o); } else { akt.push(o); vegeMax = Math.max(vegeMax, veg(o)); }
    }
    csoportok.push(akt);
    return csoportok.length > 1 ? csoportok : null;
  };
  const egyszerusit = (n) => {
    const k = [];
    for (const g of n.k) { if (g.t === n.t && !g.kartya) k.push(...g.k); else k.push(g); }
    n.k = k;
    return n.k.length === 1 ? n.k[0] : n;
  };
  // egymas melletti, kepjel kezdodo oszlopok, amikben tobb kartya van egymas alatt (a tervezo nem csoportositotta): sorfolytonos racs
  // (pl. 4 oszlop x 2 piercing-kartya: ikon, nev, lista, gomb) - igy a kartyak egyben maradnak, olvasasi sorrendben
  const egysegek = (n) => {
    if (n.t !== 'verem' || n.kartya) return null;
    const idx = n.k.map((x, i) => (x.t === 'kep' ? i : -1)).filter((i) => i >= 0);
    if (!idx.length || idx[0] !== 0) return null;
    const eg = idx.map((i, j) => n.k.slice(i, j + 1 < idx.length ? idx[j + 1] : n.k.length));
    if (eg.some((a) => a.length < 2)) return null;
    return eg.map((a) => ({ t: 'verem', kartya: true, k: a }));
  };
  const racsra = (oszlopok) => {
    if (oszlopok.length < 2) return null;
    const eg = oszlopok.map(egysegek);
    if (!eg.every(Boolean) || !eg.some((e) => e.length >= 2)) return null;
    const sorok = Math.max(...eg.map((e) => e.length)), k = [];
    for (let r = 0; r < sorok; r++) for (const e of eg) if (e[r]) k.push(e[r]);
    return { t: 'racs', k };
  };
  // ikonnal kezdodo kartyak, amiket a tervezo nem csoportositott (pl. 4 x 2 piercing-kartya: ikon, nev, lista, gomb): az azonos meretu
  // kis kepek (ikonok) racsa adja a kartyak helyet, a tobbi elem az oszlopa es sora szerinti ikonhoz tartozik
  const kozep = (r) => r.x + r.w / 2;
  const csoportosit = (ertekek, hatar) => { const r = [...ertekek].sort((a, b) => a - b), cs = []; for (const v of r) { const u = cs[cs.length - 1]; if (u && v - u[u.length - 1] <= hatar) u.push(v); else cs.push([v]); } return cs; };
  const ikonKartyak = (atomok) => {
    const jel = (a) => `${Math.round(a.r.w / 12)}x${Math.round(a.r.h / 12)}`;
    const ikonok0 = atomok.filter((a) => a.tree.t === 'kep' && a.r.w >= 36 && a.r.w <= 130 && a.r.h >= 36 && a.r.h <= 130);
    const db = {}; for (const a of ikonok0) db[jel(a)] = (db[jel(a)] || 0) + 1;
    const legjobb = Object.keys(db).sort((a, b) => db[b] - db[a])[0];
    if (!legjobb || db[legjobb] < 3) return null;
    const ikonok = ikonok0.filter((a) => jel(a) === legjobb);
    const oszlopCs = csoportosit(ikonok.map((a) => kozep(a.r)), 24), sorCs = csoportosit(ikonok.map((a) => a.r.y), 24);
    const oszlopKozep = oszlopCs.map((c) => c.reduce((x, y) => x + y, 0) / c.length), sorY = sorCs.map((c) => Math.min(...c));
    if (oszlopKozep.length < 2 && sorY.length < 2) return null;
    const lepesX = oszlopKozep.length > 1 ? Math.min(...oszlopKozep.slice(1).map((v, i) => v - oszlopKozep[i])) : Infinity;
    const lepesY = sorY.length > 1 ? Math.min(...sorY.slice(1).map((v, i) => v - sorY[i])) : Infinity;
    const kartyak = sorY.map(() => oszlopKozep.map(() => []));
    const maradek = [];
    const ikonSet = new Set(ikonok);
    const oszlopDe = (a) => { const k = kozep(a.r); let j = -1, d = Infinity; oszlopKozep.forEach((c, i) => { if (Math.abs(c - k) < d) { d = Math.abs(c - k); j = i; } }); return d <= (Number.isFinite(lepesX) ? lepesX * 0.55 : 400) ? j : -1; };
    const sorDe = (a) => { let j = -1; sorY.forEach((y, i) => { if (y <= a.r.y + 8 && (j < 0 || y > sorY[j])) j = i; }); return j; };
    for (const a of atomok) {
      if (ikonSet.has(a)) { const o = oszlopDe(a), r = sorDe(a); if (o >= 0 && r >= 0) kartyak[r][o].unshift(a); else maradek.push(a); continue; }
      const o = oszlopDe(a), r = sorDe(a);
      const szeles = Number.isFinite(lepesX) && a.r.w > lepesX * 1.35;
      const sorban = r >= 0 && (r === sorY.length - 1 ? true : a.r.y < sorY[r] + lepesY);
      if (o >= 0 && r >= 0 && !szeles && sorban) kartyak[r][o].push(a); else maradek.push(a);
    }
    const kartyaAtomok = [];
    for (const sor of kartyak) for (const k of sor) if (k.length) {
      const rend = k.slice().sort((a, b) => (a.tree.t === 'kep' && ikonSet.has(a) ? -1 : 0) - (b.tree.t === 'kep' && ikonSet.has(b) ? -1 : 0) || a.r.y - b.r.y || a.r.x - b.r.x);
      kartyaAtomok.push({ r: egyesit(rend.map((a) => a.r)), tree: rend.length === 1 ? rend[0].tree : { t: 'verem', kartya: true, k: rend.map((a) => a.tree) } });
    }
    if (kartyaAtomok.length < 3) return null;
    // a kartyak egy racs-atomma (sorfolytonos), a tobbi elem mellette marad
    const racs = { r: egyesit(kartyaAtomok.map((a) => a.r)), tree: { t: 'racs', k: kartyaAtomok.map((a) => a.tree) } };
    return [racs, ...maradek];
  };
  const rendez = (atomok) => {
    if (atomok.length === 1) return atomok[0].tree;
    const kart = atomok.length >= 6 ? ikonKartyak(atomok) : null;
    if (kart) return rendez(kart);
    let cs = vag(atomok, 'x');
    if (cs) { const oszlopok = cs.map(rendez); return racsra(oszlopok) || egyszerusit({ t: 'sor', k: oszlopok }); }
    cs = vag(atomok, 'y');
    if (cs) return egyszerusit({ t: 'verem', k: cs.map(rendez) });
    const rend = atomok.slice().sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x);   // atfedo elemek: olvasasi sorrend
    return { t: 'verem', k: rend.map((a) => a.tree) };
  };
  const levelBol = (o) => { const { sz, r, el, ...marad } = o; return { ...marad, y: r.y, x: r.x, w: r.w, h: r.h }; };
  const dom = (a, b) => (a === b ? 0 : (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
  const fabol = (ls, gyoker) => {
    const csucs = (el) => ({ el, deti: new Map(), levelek: [], lista: false, elem: false });
    const g = csucs(gyoker);
    for (const l of ls) {
      let cur = g;
      const lanc = []; for (let a = l.el.parentElement; a && a !== gyoker; a = a.parentElement) lanc.unshift(a);
      for (const a of lanc) { if (!cur.deti.has(a)) cur.deti.set(a, csucs(a)); cur = cur.deti.get(a); }
      cur.levelek.push(l);
    }
    const epit = (n) => {
      const atomok = [
        ...n.levelek.map((l) => ({ r: l.r, el: l.el, tree: levelBol(l) })),
        ...[...n.deti.values()].map(epit),
      ];
      const jelol = { lista: n.lista || (n.el.matches && n.el.matches('[role="list"],fluid-columns-repeater,.wixui-repeater')), elem: n.elem || (n.el.matches && n.el.matches('[role="listitem"]')) };
      let r, tree;
      if (atomok.length === 1) { ({ r, tree } = atomok[0]); if (jelol.elem) tree = { ...tree, kartya: true }; return { r, el: n.el, tree, lista: jelol.lista, elem: jelol.elem }; }
      r = egyesit(atomok.map((a) => a.r));
      if (jelol.lista || atomok.filter((a) => a.elem).length >= 2) {
        const dr = atomok.slice().sort((a, b) => dom(a.el, b.el));
        tree = { t: 'racs', k: dr.map((a) => (a.elem ? (a.tree.kartya ? a.tree : { ...(a.tree.t === 'verem' ? a.tree : { t: 'verem', k: [a.tree] }), kartya: true }) : a.tree)) };
      } else tree = rendez(atomok);
      if (jelol.elem) tree = { ...(tree.t === 'verem' ? tree : { t: 'verem', k: [tree] }), kartya: true };
      return { r, el: n.el, tree, lista: jelol.lista, elem: jelol.elem };
    };
    return epit(g).tree;
  };

  // oszlopokba rendezett kartya-racsok (egymas melletti oszlopok, mindegyikben tobb kartya) -> egyetlen, sorfolytonos racs
  const utofeldolgoz = (n) => {
    if (n.k) n.k = n.k.map(utofeldolgoz);
    if ((n.t === 'racs' || n.t === 'sor') && n.k.length >= 2 && n.k.every((x) => x.t === 'racs')) {
      const sorok = Math.max(...n.k.map((x) => x.k.length)), k = [];
      for (let r = 0; r < sorok; r++) for (const x of n.k) if (x.k[r]) k.push(x.k[r]);
      return { t: 'racs', k };
    }
    return n;
  };

  // --- szekciok osszerakasa ---
  const sorrend = new Map(szekciok.map((s, i) => [s, i]));
  const csoportok = new Map();
  for (const l of levelek) {
    const idx = sorrend.has(l.sz) ? sorrend.get(l.sz) : -1;
    if (!csoportok.has(idx)) csoportok.set(idx, []);
    csoportok.get(idx).push(l);
  }
  const out = [];
  for (const [idx, ls] of [...csoportok.entries()].sort((a, b) => a[0] - b[0])) {
    const s = idx >= 0 ? szekciok[idx] : null;
    const sr = s ? abs(s.getBoundingClientRect()) : { x: 0, y: 0, w: innerWidth, h: 0 };
    // a hatterkepek: a szekciot teljesen kitolto (vagy mas elem altal jelentosen takart) hatter nem tartalom
    const tartalom = ls.filter((l) => !(l.t === 'kep' && l.bg));
    const megtartott = []; let elhagyott = 0;
    for (const k of ls.filter((l) => l.t === 'kep' && l.bg)) {
      const terulet = k.r.w * k.r.h;
      const kitolt = k.r.w >= sr.w * 0.9 && k.r.h >= sr.h * 0.7;
      let takart = 0;
      for (const t of tartalom) {
        const ox = Math.max(0, Math.min(k.r.x + k.r.w, t.r.x + t.r.w) - Math.max(k.r.x, t.r.x));
        const oy = Math.max(0, Math.min(k.r.y + k.r.h, t.r.y + t.r.h) - Math.max(k.r.y, t.r.y));
        takart += ox * oy;
      }
      if (kitolt || (terulet && takart / terulet > 0.25)) { elhagyott++; continue; }
      // a kepre ralogo szoveg: a kep latszo resze a szoveg melletti sav (a Wix-ban a szoveg a kep felett all)
      if (takart) {
        const felett = tartalom.filter((t) => Math.min(k.r.x + k.r.w, t.r.x + t.r.w) > Math.max(k.r.x, t.r.x) && Math.min(k.r.y + k.r.h, t.r.y + t.r.h) > Math.max(k.r.y, t.r.y));
        const kozep = k.r.x + k.r.w / 2;
        const jobbra = felett.filter((t) => t.r.x + t.r.w / 2 > kozep), balra = felett.filter((t) => t.r.x + t.r.w / 2 <= kozep);
        if (jobbra.length && !balra.length) { const x1 = Math.min(...jobbra.map((t) => t.r.x)) - 6; if (x1 - k.r.x >= 100) k.r = { ...k.r, w: x1 - k.r.x }; }
        else if (balra.length && !jobbra.length) { const x0 = Math.max(...balra.map((t) => t.r.x + t.r.w)) + 6; if (k.r.x + k.r.w - x0 >= 100) k.r = { ...k.r, w: k.r.x + k.r.w - x0, x: x0 }; }
      }
      megtartott.push(k);
    }
    const hasznalt = [...tartalom, ...megtartott];
    if (!hasznalt.length) continue;
    const kepAlap = s && s.querySelector('[id^="bgMedia_"] img');
    out.push({
      id: s ? s.id : '', y: sr.y, h: sr.h,
      bgSzin: s ? getComputedStyle(s.querySelector('[data-testid="colorUnderlay"]') || s).backgroundColor : '',
      bgKep: kepAlap ? urlAbs(kepAlap.getAttribute('src') || '') : '',
      hatterElhagyva: elhagyott,
      horgonyok: s ? horgonyok(s) : [],
      fa: utofeldolgoz(fabol(hasznalt, s || ROOT)),
    });
  }
  return { cim: document.title, leiras: (document.querySelector('meta[name="description"]') || {}).content || '', tipus: cikk ? 'cikk' : listaElemek.length ? 'blog' : 'oldal', szekciok: out, urlapok, magassag: Math.round(document.documentElement.scrollHeight) };
})()
