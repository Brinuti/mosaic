// DIAGNOSZTIKA valodi eszkozon (csak ?mhdebug=1 mellett toltodik; mashol nem fut): a kepernyon mutatja, mi tortenik egy foglalo-gomb erintesekor.
// Mikor kell: ha egy telefonon valami nem nyilik meg / feher a kepernyo, es a gepen (Playwright) nem reprodukalhato. Az igy talalt hiba: lasd docs/booking-engine/KIADAS_ELLENORZO.md.
// Nem kuld semmit sehova; a naplo a kepernyo aljan latszik, "Masolas" gombbal vagy kepernyokeppel osztható meg.
(function () {
  const L = []; const t0 = performance.now();
  const panel = document.createElement('div');
  panel.id = 'mh-debug';
  panel.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:50vh;overflow:auto;background:rgba(0,0,0,.88);color:#7CFC00;font:11px/1.35 monospace;z-index:2147483647;padding:4px 6px;white-space:pre-wrap;word-break:break-all;pointer-events:auto;';
  const gomb = document.createElement('button');
  gomb.textContent = 'Masolas'; gomb.style.cssText = 'position:sticky;top:0;float:right;font:12px sans-serif;padding:2px 8px;margin:0 0 4px 6px;';
  const pre = document.createElement('div');
  panel.append(gomb, pre);
  const mount = () => { if (!panel.isConnected) document.documentElement.appendChild(panel); };
  const render = () => { mount(); pre.textContent = L.join('\n'); panel.scrollTop = panel.scrollHeight; };
  const log = (s) => { L.push(((performance.now() - t0) / 1000).toFixed(2) + ' ' + s); render(); };
  gomb.addEventListener('click', (e) => { e.stopPropagation(); const s = L.join('\n'); (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => { gomb.textContent = 'Kimasolva'; }).catch(() => { gomb.textContent = 'Nem sikerult (keszits kepernyokepet)'; }); });
  const leir = (e) => { if (!e || !e.tagName) return String(e); const c = (e.className && e.className.toString ? e.className.toString() : '').slice(0, 30); return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (c ? '.' + c.replace(/\s+/g, '.') : ''); };
  const link = (e) => { const a = e && e.closest ? e.closest('a') : null; return a ? (a.getAttribute('href') || '').slice(0, 50) + ' [' + (a.getAttribute('target') || '-') + ']' : '-'; };
  log('start | ' + navigator.userAgent.slice(0, 90));
  log('ablak ' + innerWidth + 'x' + innerHeight + ' visual ' + (window.visualViewport ? Math.round(visualViewport.width) + 'x' + Math.round(visualViewport.height) + ' scale ' + visualViewport.scale.toFixed(2) : '-') + ' dpr ' + devicePixelRatio + ' | scrollY ' + Math.round(scrollY));
  window.__mhLog = log;
  log('launcher: ' + typeof window.openBooking);
  window.addEventListener('error', (e) => log('HIBA: ' + (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', (e) => log('ELUTASITOTT IGERET: ' + (e.reason && (e.reason.message || e.reason)) ));
  // az erintes: hova esik, mi van a pont alatt
  const pont = (nev) => (e) => {
    const x = e.clientX != null ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : null);
    const y = e.clientY != null ? e.clientY : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : null);
    const alatt = x != null ? document.elementsFromPoint(x, y).slice(0, 4).map(leir).join(' < ') : '?';
    if (nev === 'pointerdown' || nev === 'click') log(nev + ' cel=' + leir(e.target) + ' link=' + link(e.target) + ' | pont(' + Math.round(x) + ',' + Math.round(y) + ') alatt: ' + alatt + (nev === 'click' ? ' | defaultPrevented=' + e.defaultPrevented + ' trusted=' + e.isTrusted + ' scrollY=' + Math.round(scrollY) : ''));
    else log(nev + ' cel=' + leir(e.target));
  };
  window.addEventListener('pointerdown', pont('pointerdown'), true);
  window.addEventListener('touchend', pont('touchend'), true);
  window.addEventListener('click', pont('click'), true);
  // a kattintas vege (a launcher kezelője UTAN, buborek-fazis a documenten): torolte-e valaki az alapertelmezett muveletet
  document.addEventListener('click', (e) => { const a = e.target && e.target.closest && e.target.closest('a'); if (a && /foglalo-motor/.test(a.getAttribute('href') || '')) { log('click VEGE (document, buborek): defaultPrevented=' + e.defaultPrevented); setTimeout(allapot, 500); setTimeout(allapot, 2500); } }, false);
  // a foglalo allapota
  function allapot() {
    const h = document.getElementById('mosaic-booking-layer');
    const cs = h ? getComputedStyle(h) : null; const r = h ? h.getBoundingClientRect() : null;
    const b = document.body; const bcs = getComputedStyle(b); const hcs = getComputedStyle(document.documentElement);
    log('FOGLALO: ' + (h ? 'van | rect ' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' vis=' + cs.visibility + ' disp=' + cs.display + ' z=' + cs.zIndex : 'NINCS')
      + ' | body pos=' + bcs.position + ' top=' + bcs.top + ' transform=' + bcs.transform + ' filter=' + bcs.filter + ' | html overflow=' + hcs.overflow + ' | scrollY=' + Math.round(scrollY)
      + ' | kozepe: ' + leir(document.elementFromPoint(innerWidth / 2, innerHeight / 2)) + ' | inert gyerekek: ' + [...b.children].filter((x) => x.inert).length);
    if (h && h.shadowRoot) { const p = h.shadowRoot.querySelector('.be-panel'); const cim = h.shadowRoot.querySelector('.be-title'); const pr = p && p.getBoundingClientRect(); log('   panel: ' + (p ? Math.round(pr.left) + ',' + Math.round(pr.top) + ' ' + Math.round(pr.width) + 'x' + Math.round(pr.height) + ' opacity=' + getComputedStyle(p).opacity + ' be-open=' + !!h.shadowRoot.querySelector('.be-open') : 'nincs') + ' | cim: ' + (cim ? cim.textContent.slice(0, 40) : '-') + ' | stilus-lap: ' + (h.shadowRoot.querySelector('link') && !!h.shadowRoot.querySelector('link').sheet)); }
  }
  // a launcher hivasai
  const ov = () => { if (window.openBooking && !window.openBooking.__dbg) { const eredeti = window.openBooking; const csom = function (o, env) { log('openBooking hivva ' + JSON.stringify(o).slice(0, 80)); const r = eredeti.call(this, o, env); if (r && r.then) r.then(() => log('openBooking KESZ'), (x) => log('openBooking HIBA: ' + (x && (x.message || x)))); return r; }; csom.__dbg = true; window.openBooking = csom; } };
  ov(); setTimeout(ov, 500); setTimeout(ov, 2000);
  setTimeout(() => log('3 mp: launcher=' + typeof window.openBooking + ' | scrollY ' + Math.round(scrollY)), 3000);
})();
