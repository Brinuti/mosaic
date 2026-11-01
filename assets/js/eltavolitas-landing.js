// MOSAIC /sminktetovalas-eltavolitas-budapest - az oldal sajat szkriptje. NEM mero-kod: nem toltok kulso szkriptet, nem kuldok semmit harmadik felnek.
// Negy dolgot csinal:
//   1) belso gorgetes-gombok ([data-gorget="<id>"], <button>): NEM #horgony-link es NEM history-hivas (a GTM "History Change" trigger minden hash-valtasra merest inditana; ugyanez a minta az oxigen-hajvizsgalat.js-ben).
//   2) a hero videoja: alapbol nem toltodik (preload=none, a poszter latszik), a gombbal indul / all (nema, ismetlodo).
//   3) a ragados alsó sav (mobil): akkor latszik, ha a hero fo gombja mar kigorgetett a kepbol, es az urlap meg nem latszik.
//   4) a fotos elozures: a kepeket 1600 px-re kicsinyiti (a telefonos fotok tobb MB-osak), majd a MEGLEVO "pmu-proba-foto" urlap-levelre kuldi
//      (netlify/lib/levelek.js; POST "/" form-name-mel, ugyanugy, mint a /foglalo-pmu fotokuldese), de "eltavolitas" jelolessel (Ag / Kezeles-terulet / Bekuldve innen).
//      Siker utan egyetlen dataLayer-esemeny (eltavolitas_foto_lead): csak 'ana' hozzajarulassal, probajeles bongeszoben nem, zart ertekekkel, nev / e-mail / telefon / foto / URL nelkul.
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const OLDAL = 'sminktetovalas-eltavolitas-budapest';
  const MAX_FOTO = 5;
  const csokkentett = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- 1) belso gorgetes (URL-valtozas nelkul) ---
  document.addEventListener('click', (e) => {
    const g = e.target.closest && e.target.closest('[data-gorget]');
    if (!g) return;
    const cel = $(g.getAttribute('data-gorget'));
    if (!cel) return;
    e.preventDefault();
    cel.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'start' });
    const fok = cel.querySelector('h2, h3') || cel;
    if (!fok.hasAttribute('tabindex')) fok.setAttribute('tabindex', '-1');
    try { fok.focus({ preventScroll: true }); } catch (hiba) { /* nem fokuszalhato */ }
  });

  // --- 2) video ---
  const video = $('el-video');
  const keret = $('el-videokeret');
  const vGomb = $('el-video-gomb');
  if (video && vGomb) {
    const allapot = (megy) => {
      keret.dataset.megy = megy ? '1' : '0';
      vGomb.setAttribute('aria-label', megy ? 'Videó szüneteltetése' : 'Videó lejátszása');
    };
    vGomb.addEventListener('click', () => {
      if (video.paused) video.play().then(() => allapot(true)).catch(() => allapot(false));
      else { video.pause(); allapot(false); }
    });
    // nyugodt kapcsolaton, csokkentett mozgas nelkul a muted, ismetlodo lejatszas magatol indul, amint latszik
    const kapcsolat = navigator.connection || {};
    const nyugodt = !csokkentett && !kapcsolat.saveData && !/(^|-)2g$/.test(kapcsolat.effectiveType || '');
    if (nyugodt && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((tetelek) => {
        if (tetelek.some((t) => t.isIntersecting)) {
          io.disconnect();
          video.preload = 'auto';
          video.play().then(() => allapot(true)).catch(() => allapot(false));
        }
      }, { threshold: 0.5 });
      io.observe(keret);
    }
  }

  // --- 3) ragados alsó sav ---
  const sav = $('el-sav');
  const foGomb = $('el-fo-gomb');
  const urlapSzekcio = $('foto-urlap');
  if (sav && foGomb && urlapSzekcio && 'IntersectionObserver' in window) {
    let foLatszik = true;
    let urlapLatszik = false;
    const frissit = () => {
      const mutat = !foLatszik && !urlapLatszik;
      sav.dataset.lathato = mutat ? '1' : '0';
      document.body.dataset.sav = mutat ? '1' : '0';
    };
    new IntersectionObserver((t) => { foLatszik = t[0].isIntersecting; frissit(); }).observe(foGomb);
    new IntersectionObserver((t) => { urlapLatszik = t[0].isIntersecting; frissit(); }, { threshold: 0.05 }).observe(urlapSzekcio);
    frissit();
  }

  // --- 4) fotos elozures ---
  const urlap = $('el-urlap');
  if (!urlap) return;
  const fotok = []; // { blob, url }
  const mini = $('el-miniek');
  const szam = $('el-foto-szam');

  const hiba = (mezo, szoveg) => {
    const h = $('el-h-' + mezo);
    if (h) h.textContent = szoveg || '';
    const m = $('el-m-' + mezo);
    if (m) m.classList.toggle('el-rossz', !!szoveg);
  };

  const rajzol = () => {
    mini.replaceChildren(...fotok.map((f, i) => {
      const d = document.createElement('div');
      d.className = 'el-mini';
      const img = document.createElement('img');
      img.src = f.url;
      img.alt = 'Feltöltött fotó ' + (i + 1);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '×';
      b.setAttribute('aria-label', (i + 1) + '. fotó törlése');
      b.addEventListener('click', () => { URL.revokeObjectURL(f.url); fotok.splice(i, 1); rajzol(); });
      d.append(img, b);
      return d;
    }));
    szam.textContent = fotok.length ? fotok.length + ' fotó kiválasztva (legfeljebb ' + MAX_FOTO + ')' : 'Még nincs kiválasztott fotó.';
    if (fotok.length) hiba('foto', '');
  };

  // a telefonos fotok tobb MB-osak: 1600 px-re kicsinyitjuk (az EXIF / helyadat igy sem megy tovabb)
  const kicsinyit = async (fajl) => {
    const kep = await createImageBitmap(fajl);
    const arany = Math.min(1, 1600 / Math.max(kep.width, kep.height));
    const v = document.createElement('canvas');
    v.width = Math.round(kep.width * arany);
    v.height = Math.round(kep.height * arany);
    v.getContext('2d').drawImage(kep, 0, 0, v.width, v.height);
    return new Promise((ok, nem) => v.toBlob((b) => (b ? ok(b) : nem(new Error('toBlob'))), 'image/jpeg', 0.82));
  };

  $('el-foto-input').addEventListener('change', async (e) => {
    hiba('foto', '');
    const vannak = [...e.target.files];
    const hely = MAX_FOTO - fotok.length;
    let rossz = 0;
    for (const f of vannak.slice(0, Math.max(0, hely))) {
      try {
        if (!/^image\//.test(f.type) && !/\.(jpe?g|png|heic|heif|webp)$/i.test(f.name)) throw new Error('nem kep');
        const b = await kicsinyit(f);
        fotok.push({ blob: b, url: URL.createObjectURL(b) });
      } catch (err) { rossz++; }
    }
    if (rossz) hiba('foto', 'A kép feltöltése nem sikerült' + (vannak.length > 1 ? ' (' + rossz + ' képnél)' : '') + '. Kérlek, próbálj másik képet (JPG vagy PNG).');
    else if (vannak.length > hely) hiba('foto', 'Legfeljebb ' + MAX_FOTO + ' fotót küldhetsz.');
    e.target.value = '';
    rajzol();
  });

  const SZABALY = {
    nev: (v) => v.trim().length >= 2,
    telefon: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 9 && d.length <= 13; },
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
    terulet: (v) => !!v,
  };
  const UZENET = {
    nev: 'Kérlek, add meg a neved.',
    telefon: 'Kérlek, adj meg érvényes telefonszámot.',
    email: 'Kérlek, adj meg érvényes e-mail címet.',
    terulet: 'Kérlek, válaszd ki a területet.',
  };
  const mezoErtek = (mezo) => ($('el-' + mezo).value || '');
  for (const mezo of Object.keys(SZABALY)) {
    $('el-' + mezo).addEventListener('blur', () => { if (mezoErtek(mezo).trim()) hiba(mezo, SZABALY[mezo](mezoErtek(mezo)) ? '' : UZENET[mezo]); });
    $('el-' + mezo).addEventListener('input', () => { if (SZABALY[mezo](mezoErtek(mezo))) hiba(mezo, ''); });
  }

  const ujAzonosito = () => {
    try { const b = new Uint8Array(8); crypto.getRandomValues(b); return 'pl_' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return 'pl_' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); }
  };
  const TERULET_KOD = { 'szemöldök': 'szemoldok', 'ajak, szájkontúr': 'ajak', 'egyéb vagy nem tudom': 'egyeb' };
  const esemeny = (id, terulet) => {
    try {
      let proba = false;
      try { proba = localStorage.getItem('mhProba') === '1'; } catch (e) { /* tiltott tarolo: nem proba */ }
      if (proba) return;
      const s = window.mhSuti;
      if (!(s && typeof s.engedely === 'function' && s.engedely('ana'))) return;
      (window.dataLayer = window.dataLayer || []).push({
        event: 'eltavolitas_foto_lead', business: 'pmu', lead_type: 'removal_photo', source_page: '/' + OLDAL, event_id: id,
        foto_db: Math.max(1, Math.min(MAX_FOTO, fotok.length)), terulet: TERULET_KOD[terulet] || 'egyeb',
      });
    } catch (e) { /* a meres hibaja nem akadalyozhatja a kuldest */ }
  };

  const kuld = $('el-kuld');
  urlap.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (kuld.getAttribute('aria-disabled') === 'true') return;
    hiba('kuld', '');
    let elso = null;
    for (const mezo of ['terulet', 'nev', 'telefon', 'email']) {
      const jo = SZABALY[mezo](mezoErtek(mezo));
      hiba(mezo, jo ? '' : UZENET[mezo]);
      if (!jo && !elso) elso = $('el-' + mezo);
    }
    if (!fotok.length) { hiba('foto', 'Kérlek, tölts fel legalább egy fotót: fotó nélkül nem tudok segíteni.'); if (!elso) elso = $('el-foto-input'); }
    const hozzajarul = $('el-hozzajarul').checked;
    $('el-h-hozzajarul').textContent = hozzajarul ? '' : 'Kérlek, fogadd el az adatkezelést, hogy a fotóidat megnézhessem.';
    if (!hozzajarul && !elso) elso = $('el-hozzajarul');
    if (elso || !hozzajarul) { if (elso) elso.focus(); return; }

    const terulet = mezoErtek('terulet');
    const leadId = ujAzonosito();
    const adat = new FormData();
    adat.set('form-name', 'pmu-proba-foto');
    adat.set('bot-field', urlap.elements['bot-field'] ? urlap.elements['bot-field'].value : '');
    adat.set('ag', 'Eltávolítás – lézeres, fotó alapján');
    adat.set('nev', mezoErtek('nev').trim());
    adat.set('telefon', mezoErtek('telefon').trim());
    adat.set('email', mezoErtek('email').trim());
    adat.set('kezeles', 'Sminktetoválás eltávolítás – ' + terulet + ' (fotó alapján)');
    adat.set('idopont', '');
    adat.set('oldal', OLDAL);
    fotok.forEach((f, i) => adat.set('foto' + (i + 1), f.blob, 'foto' + (i + 1) + '.jpg'));

    kuld.setAttribute('aria-disabled', 'true');
    const regi = kuld.textContent;
    kuld.textContent = 'Küldés…';
    const ab = new AbortController();
    const ido = setTimeout(() => ab.abort(), 30000);
    try {
      const v = await fetch('/', { method: 'POST', credentials: 'same-origin', body: adat, signal: ab.signal });
      if (!v.ok) throw new Error('HTTP ' + v.status);
      esemeny(leadId, terulet);
      for (const f of fotok) URL.revokeObjectURL(f.url);
      fotok.length = 0;
      rajzol();
      $('el-urlap-keret').hidden = true;
      const kesz = $('el-kesz');
      kesz.hidden = false;
      kesz.scrollIntoView({ behavior: csokkentett ? 'auto' : 'smooth', block: 'center' });
      kesz.focus({ preventScroll: true });
    } catch (err) {
      console.error(err);
      hiba('kuld', 'Hiba történt a küldés közben. Kérlek, próbáld újra, vagy hívj minket: 06 20 247 4444.');
    } finally {
      clearTimeout(ido);
      kuld.removeAttribute('aria-disabled');
      kuld.textContent = regi;
    }
  });
})();
