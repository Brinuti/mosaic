// Szeles-kepernyos oldalellenorzes: minden asztali oldalt (dist/_a) vegigmer nagyon szeles nezetben (alapbol 1920 / 2560 / 3440 px) es az 1440 px-es alappal veti ossze.
// Miert: 2026-10-16-an a foldal ajandekkartya-szekcioja 1920 px felett osszecsuszott (a szoveg oszlopanak jobb oldali paddingje a nezet szelessegevel nott, a racs 1360 px-nel megall),
// ezt kezi neznessel senki nem latta. Ez az eszkoz az ilyen hibakat keresi automatikusan:
//   - szoveg a szoveggel atfedesben (a szoveg-sorok teglalapjai metszik egymast)
//   - szoveg kilog a sajat dobozabol (kartya, gomb, cimke)
//   - oszlop osszeszukul, amikor a nezet szelesedik (az 1440 px-es szelesseghez kepest <65%, es <300 px)
//   - nagyon keskeny szovegoszlop (<120 px, 25+ karakter) vagy szetfutott szovegsor (>1000 px, 200+ karakter)
//   - kep nyujtott (>6% oldalarany-elteres, object-fit nelkul), felnagyitott (>1.25x a termeszetes meretnek, 300 px felett), toresett
//   - vizszintes tulcsordulas / a nezetbol kilogo elem (clip nelkul)
//   - egy szekcio tartalma egyik oldalra csusztatott vagy szigetszeru (aszimmetria / <30% szelessegu tartalom)
//
//   node tools/netlify-build.mjs && node tools/szeles-teszt/szeles-ellenorzes.mjs [--szelesseg=1920,2560,3440] [--oldal=fooldal,headspa-budapest] [--kep=mappa] [--ki=eredmeny.json]
//
// Kornyezet: PLAYWRIGHT_UTVONAL (a playwright node_modules mappaja; alapbol a globalis) es PLAYWRIGHT_BROWSERS_PATH. Kulso halozat nincs: minden nem helyi keres megszakad.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const DIST = path.join(GYOKER, 'dist');
const arg = (nev, alap) => (process.argv.find((a) => a.startsWith(`--${nev}=`)) || '').slice(nev.length + 3) || alap;
const SZELESSEGEK = arg('szelesseg', '1920,2560,3440').split(',').map(Number);
const ALAP = 1440;
const MAGASSAG = 1100;
const KEP_MAPPA = arg('kep', '');
const KI = arg('ki', '');
const SZURO = arg('oldal', '').split(',').filter(Boolean);
const PARHUZAMOS = Number(arg('parhuzamos', '3'));
const KIHAGYOTT = /-regi$|^booking-test$|^crm$|^foglalo-proba$|^mobil$/;

const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp4': 'video/mp4', '.txt': 'text/plain', '.ico': 'image/x-icon', '.gif': 'image/gif', '.avif': 'image/avif' };

function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright'); } catch { /* kovetkezo */ } }
  throw new Error('playwright nem talalhato (PLAYWRIGHT_UTVONAL)');
}

/** A dist/ kiszolgalasa az eles utvonal-logikaval (netlify/lib/utvonal.js): asztali valtozat, kiterjesztes nelkuli cimek. */
async function szerverInditas() {
  const { utvonal } = await import(pathToFileURL(path.join(GYOKER, 'netlify/lib/utvonal.js')).href);
  const szerver = http.createServer((req, res) => {
    const ut = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const r = utvonal(ut, 'Mozilla/5.0 (X11; Linux x86_64) Chrome/131');
    let f;
    if (r === null) f = path.resolve(DIST, '.' + ut);
    else if (r.atiranyit) { res.writeHead(301, { location: r.atiranyit }); return res.end(); }
    else f = path.resolve(DIST, '.' + r.atir + '.html');
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nincs'); }
    const meret = fs.statSync(f).size; const t = TIPUS[path.extname(f).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range;
    if (range) { const [a, b] = range.replace('bytes=', '').split('-'); const s = +a; const e = b ? +b : meret - 1; res.writeHead(206, { 'content-type': t, 'content-range': `bytes ${s}-${e}/${meret}`, 'accept-ranges': 'bytes', 'content-length': e - s + 1 }); return fs.createReadStream(f, { start: s, end: e }).pipe(res); }
    res.writeHead(200, { 'content-type': t, 'content-length': meret, 'accept-ranges': 'bytes' }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  await new Promise((ok) => szerver.once('listening', ok));
  return { szerver, bazis: 'http://localhost:' + szerver.address().port };
}

/** A bongeszoben futo vizsgalat: egy nezet-szelessegen az oldal minden mert adata. */
function oldalVizsgalat() {
  const vw = innerWidth;
  const lathato = (el) => { try { return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }); } catch { return true; } };
  const kulcs = (el) => { const r = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const n = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0; r.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ':' + n); } return r.reverse().join('>'); };
  const nev = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
  const fix = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  const klip = (el) => { for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflowX !== 'visible' || s.overflow !== 'visible') return true; if (s.position === 'fixed') return true; } return false; };
  // lathatatlan "csak kepernyoolvasonak" szoveg (clip / 1px) es a tarolojabol kilogo (overflow: hidden/auto) szoveg nem szamit lathato szovegnek
  const srCache = new Map();
  const srOnly = (el) => { for (let e = el, i = 0; e && i < 4 && e !== document.body; e = e.parentElement, i++) { if (!srCache.has(e)) { const s = getComputedStyle(e); srCache.set(e, (s.position === 'absolute' && s.clip !== 'auto' && /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(s.clip)) || (s.overflow === 'hidden' && e.offsetWidth <= 2 && e.offsetHeight <= 2) || (s.clipPath && /inset\(50%\)|inset\(100%\)/.test(s.clipPath))); } if (srCache.get(e)) return true; } return false; };
  const klipCache = new Map();
  const klipDoboz = (e) => { if (!klipCache.has(e)) { const s = getComputedStyle(e); klipCache.set(e, (s.overflowX !== 'visible' || s.overflowY !== 'visible') ? e.getBoundingClientRect() : null); } return klipCache.get(e); };
  const levagott = (el, r) => { const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2; for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) { const d = klipDoboz(e); if (d && (cx < d.left - 1 || cx > d.right + 1 || cy < d.top - 1 || cy > d.bottom + 1)) return true; } return false; };
  const sx = scrollX, sy = scrollY;
  const KI = { vw, doc_szeles: document.documentElement.scrollWidth, magassag: document.documentElement.scrollHeight };

  // --- szovegsorok teglalapjai ---
  const sorok = [];
  const bejaro = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = bejaro.nextNode(); n; n = bejaro.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t.length < 2) continue;
    const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT|OPTION|TEXTAREA)$/.test(el.tagName) || el.closest('svg, template, [hidden]')) continue;
    if (!lathato(el) || srOnly(el)) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    for (const r of rg.getClientRects()) { if (r.width < 3 || r.height < 5) continue; if (r.right < -200 || r.left > vw + 200 || levagott(el, r)) continue; sorok.push({ el, t, x1: r.left + sx, y1: r.top + sy + r.height * 0.15, x2: r.right + sx, y2: r.bottom + sy - r.height * 0.22 }); } // a sor-teglalap felso 15% / also 22%-at levagjuk: a betumagassag alatti / feletti ures sav (nagy szamjegyek, felso-/alsohosszak) nem szamit atfedesnek
  }
  const fixCache = new Map(); const fixel = (el) => { if (!fixCache.has(el)) fixCache.set(el, fix(el)); return fixCache.get(el); };

  // --- 1. szoveg a szoveggel atfedesben ---
  const atfedes = [];
  const rend = sorok.filter((s) => !fixel(s.el)).sort((a, b) => a.y1 - b.y1);
  for (let i = 0; i < rend.length; i++) {
    const a = rend[i];
    for (let j = i + 1; j < rend.length && rend[j].y1 < a.y2 - 3; j++) {
      const b = rend[j]; if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      if (ox < 4 || oy < 4) continue;
      const kisebb = Math.min((a.x2 - a.x1) * (a.y2 - a.y1), (b.x2 - b.x1) * (b.y2 - b.y1));
      if (ox * oy < 0.3 * kisebb) continue;
      atfedes.push({ a: nev(a.el), at: a.t.slice(0, 28), b: nev(b.el), bt: b.t.slice(0, 28), y: Math.round(a.y1), x: Math.round(Math.max(a.x1, b.x1)) });
      if (atfedes.length > 40) break;
    }
    if (atfedes.length > 40) break;
  }
  KI.atfedes = atfedes;

  // --- 2. szoveg kilog a sajat dobozabol ---
  const kartyaE = (el) => {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (r.width >= vw * 0.9 || r.width < 20 || r.height < 14) return false;
    const szin = (s.backgroundColor.match(/[\d.]+/g) || []).map(Number); const alfa = szin.length > 3 ? szin[3] : (szin.length ? 1 : 0);
    return s.boxShadow !== 'none' || (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') || alfa >= 0.3 || (s.backgroundImage && s.backgroundImage !== 'none');
  };
  const kilog = [], latott = new Set();
  const elemSorok = new Map(); for (const s of sorok) { if (!elemSorok.has(s.el)) elemSorok.set(s.el, []); elemSorok.get(s.el).push(s); }
  for (const [el, lista] of elemSorok) {
    if (fixel(el) && !el.closest('a, button')) { /* a rogzitett elemek (fejlec) is vizsgalhatok */ }
    const bal = Math.min(...lista.map((s) => s.x1)) - sx, jobb = Math.max(...lista.map((s) => s.x2)) - sx;
    let doboz = null; for (let e = el; e && e !== document.body; e = e.parentElement) { if (kartyaE(e)) { doboz = e; break; } }
    if (!doboz) continue;
    const d = doboz.getBoundingClientRect(); if (getComputedStyle(doboz).overflowX !== 'visible' && doboz.scrollWidth <= doboz.clientWidth + 1) continue;
    if (bal < d.left - 2 || jobb > d.right + 2) { const k = nev(doboz) + '|' + nev(el); if (!latott.has(k)) { latott.add(k); kilog.push({ doboz: nev(doboz), doboz_szeles: Math.round(d.width), szoveg: nev(el), szoveg_szeles: Math.round(jobb - bal), t: lista[0].t.slice(0, 28), y: Math.round(lista[0].y1) }); } }
    if (kilog.length > 40) break;
  }
  KI.kilog = kilog;

  // --- 3. szovegoszlopok szelessege (az alappal valo osszevetes a Node oldalon tortenik) ---
  const oszlopok = [];
  for (const [el, lista] of elemSorok) {
    if (!/^(P|H1|H2|H3|H4|H5|H6|LI|DIV|SPAN|A|B|SMALL|FIGCAPTION|BLOCKQUOTE|SUMMARY|BUTTON|LABEL|TD|DT|DD)$/.test(el.tagName)) continue;
    const kozvetlen = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ').replace(/\s+/g, ' ').trim();
    if (kozvetlen.length < 15) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1) continue;
    oszlopok.push({ k: kulcs(el), n: nev(el), w: Math.round(r.width), l: kozvetlen.length, y: Math.round(r.top + sy), x: Math.round(r.left + sx) });
  }
  KI.oszlopok = oszlopok.slice(0, 1500);

  // --- 4. kepek ---
  const kepek = [];
  for (const im of document.images) {
    if (!lathato(im)) continue; const r = im.getBoundingClientRect(); if (r.width < 24 || r.height < 24) continue;
    // a forgatott (transform) kepeknel a getBoundingClientRect a forgatott keret: a valodi (elrendezesi) meret az offset*
    const ow = im.offsetWidth || r.width, oh = im.offsetHeight || r.height;
    const s = getComputedStyle(im); const nyers = { n: nev(im), src: (im.currentSrc || im.src || '').split('/').slice(-2).join('/').slice(0, 60), w: Math.round(ow), h: Math.round(oh), nw: im.naturalWidth, nh: im.naturalHeight, y: Math.round(r.top + sy) };
    if (im.complete && im.naturalWidth === 0 && im.getAttribute('src')) { kepek.push({ ...nyers, baj: 'torott' }); continue; }
    if (!im.naturalWidth) continue;
    if (s.objectFit === 'fill' && Math.abs((ow / oh) / (im.naturalWidth / im.naturalHeight) - 1) > 0.06) kepek.push({ ...nyers, baj: 'nyujtott', arany_elteres: +(((ow / oh) / (im.naturalWidth / im.naturalHeight) - 1) * 100).toFixed(1) });
    if (ow > 300 && ow / im.naturalWidth > 1.25) kepek.push({ ...nyers, baj: 'felnagyitott', szorzo: +(ow / im.naturalWidth).toFixed(2) });
  }
  KI.kepek = kepek;

  // --- 5. nezetbol kilogo elemek (clip nelkul) ---
  const kilogElem = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue;
    if (r.right <= vw + 2 && r.left >= -2) continue;
    if (r.right < -500 || r.left > vw + 500) continue;
    if (!lathato(el) || klip(el) || fixel(el)) continue;
    kilogElem.push({ n: nev(el), jobb: Math.round(r.right), bal: Math.round(r.left), w: Math.round(r.width), y: Math.round(r.top + sy) });
    if (kilogElem.length >= 12) break;
  }
  KI.kilog_elem = kilogElem;

  // --- 6. szekciok tartalmanak elhelyezkedese ---
  const szekciok = []; const szDb = {};
  const gyokerek = [...(document.querySelector('main') ? document.querySelector('main').children : []), ...[...document.body.children].filter((e) => e.tagName === 'SECTION')];
  for (const sz of gyokerek) {
    const r = sz.getBoundingClientRect(); if (r.height < 160 || r.width < vw * 0.9 || !lathato(sz)) continue;
    let minx = Infinity, maxx = -Infinity;
    for (const s of sorok) { if (sz.contains(s.el)) { minx = Math.min(minx, s.x1 - sx); maxx = Math.max(maxx, s.x2 - sx); } }
    for (const im of sz.querySelectorAll('img, video, iframe, canvas')) { if (!lathato(im)) continue; const q = im.getBoundingClientRect(); if (q.width < 30) continue; minx = Math.min(minx, q.left); maxx = Math.max(maxx, q.right); }
    if (!isFinite(minx)) continue;
    const bal = Math.round(minx - r.left), jobb = Math.round(r.right - maxx), tart = Math.round(maxx - minx);
    const szn = nev(sz); szDb[szn] = (szDb[szn] || 0) + 1;
    szekciok.push({ n: szn, i: szDb[szn], y: Math.round(r.top + sy), h: Math.round(r.height), bal, jobb, tartalom: tart, aszim: Math.abs(bal - jobb), arany: +(tart / vw).toFixed(2) });
  }
  KI.szekciok = szekciok;
  return KI;
}

/** Az 1440 px-es alap es a szeles nezet osszevetese: szukulo vagy szetfuto oszlopok, szekcio-aszimmetria. */
function osszevet(alap, szeles) {
  const talalat = [];
  const alapW = new Map((alap?.oszlopok || []).map((o) => [o.k, o]));
  for (const o of szeles.oszlopok) {
    const a = alapW.get(o.k);
    if (a && a.w >= 120 && o.w < a.w * 0.65 && o.w < 300) talalat.push({ tipus: 'osszeszukul', elem: o.n, alap: a.w, szeles: o.w, y: o.y, t: o.l + ' kar.' });
    else if (!a && o.w < 120 && o.l >= 25) talalat.push({ tipus: 'keskeny_oszlop', elem: o.n, szeles: o.w, y: o.y, t: o.l + ' kar.' });
    if (o.w > 1000 && o.l >= 200) talalat.push({ tipus: 'szetfutott_sor', elem: o.n, szeles: o.w, y: o.y, t: o.l + ' kar.' });
    else if (a && o.w > 1000 && o.w > a.w * 1.4 && o.l >= 120) talalat.push({ tipus: 'szetfutott_sor', elem: o.n, alap: a.w, szeles: o.w, y: o.y, t: o.l + ' kar.' });
  }
  const alapSz = new Map((alap?.szekciok || []).map((q) => [q.n + '#' + q.i, q]));
  for (const s of szeles.szekciok) {
    const a = alapSz.get(s.n + '#' + s.i);
    // csak az szamit hibanak, ami a szelesedessel romlik: az aszimmetria aranya (a nezet szelessegehez kepest) legalabb 6 szazalekponttal no az 1440 px-es alaphoz kepest
    const alapAszim = a ? a.aszim / alap.vw : 0;
    if (s.aszim > szeles.vw * 0.12 && s.tartalom < szeles.vw * 0.8 && s.aszim / szeles.vw - alapAszim > 0.06) talalat.push({ tipus: 'aszimmetria', elem: s.n, bal: s.bal, jobb: s.jobb, tartalom: s.tartalom, alap_aszim_arany: +alapAszim.toFixed(2), y: s.y });
    if (s.tartalom < szeles.vw * 0.18 && s.h > 300) talalat.push({ tipus: 'sziget', elem: s.n, tartalom: s.tartalom, y: s.y, h: s.h });
  }
  for (const k of szeles.kilog) talalat.push({ tipus: 'szoveg_kilog_dobozbol', ...k });
  for (const k of szeles.atfedes) talalat.push({ tipus: 'szoveg_atfedes', ...k });
  const alapKep = new Map((alap?.kepek || []).map((k) => [k.src + '|' + k.n, k]));
  for (const k of szeles.kepek) {
    const a = alapKep.get(k.src + '|' + k.n);
    // a felnagyitas csak akkor szamit szeles-hibanak, ha a szelesedessel romlik (>=1.5x es legalabb 15%-kal tobb, mint 1440 px-en); a nyujtas/torott kep barmilyen szelessegen hiba
    if (k.baj === 'felnagyitott' && !(k.szorzo >= 1.5 && (!a || k.szorzo > (a.szorzo || 1) * 1.15))) continue;
    talalat.push({ tipus: 'kep_' + k.baj, ...k, alap_szorzo: a?.szorzo });
  }
  for (const k of szeles.kilog_elem) talalat.push({ tipus: 'nezetbol_kilog', ...k });
  if (szeles.doc_szeles > szeles.vw + 1) talalat.push({ tipus: 'vizszintes_gorgetes', doc: szeles.doc_szeles, vw: szeles.vw });
  return talalat;
}

async function main() {
  const { chromium } = playwright();
  const { szerver, bazis } = await szerverInditas();
  const lap = fs.readdirSync(path.join(DIST, '_a')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).filter((n) => !KIHAGYOTT.test(n) && (!SZURO.length || SZURO.includes(n))).sort();
  const bongeszo = await chromium.launch();
  const eredmeny = {}; let kesz = 0;
  const feldolgoz = async (nev) => {
    const utv = nev === 'fooldal' ? '/' : '/' + nev;
    const oldal = { nev, utv, szelessegek: {}, hiba: null };
    for (const w of [ALAP, ...SZELESSEGEK]) {
      const ctx = await bongeszo.newContext({ viewport: { width: w, height: MAGASSAG }, deviceScaleFactor: 1 });
      await ctx.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort());
      await ctx.route('**/*.mp4', (r) => r.abort());
      const p = await ctx.newPage();
      const orakutya = setTimeout(() => { oldal.hiba = `idotullepes (${w}px, 100 mp)`; ctx.close().catch(() => {}); }, 100000);
      try {
        const v = await p.goto(bazis + utv, { waitUntil: 'load', timeout: 60000 }).catch((e) => { throw e; });
        if (!v || v.status() >= 400) { oldal.hiba = 'HTTP ' + (v && v.status()); await ctx.close(); break; }
        await p.evaluate(async () => { await document.fonts?.ready; const m = document.documentElement.scrollHeight; for (let y = 0; y < m; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 45)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 250)); });
        oldal.szelessegek[w] = await p.evaluate(oldalVizsgalat);
        if (KEP_MAPPA && w !== ALAP) {
          fs.mkdirSync(KEP_MAPPA, { recursive: true });
          const c2 = await bongeszo.newContext({ viewport: { width: w, height: MAGASSAG }, deviceScaleFactor: 0.3 });
          await c2.route((u) => !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort()); await c2.route('**/*.mp4', (r) => r.abort());
          const p2 = await c2.newPage(); await p2.goto(bazis + utv, { waitUntil: 'load', timeout: 60000 });
          await p2.evaluate(async () => { const m = document.documentElement.scrollHeight; for (let y = 0; y < m; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 45)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 250)); });
          await p2.screenshot({ path: path.join(KEP_MAPPA, `${nev}-${w}.png`), fullPage: true }); await c2.close();
        }
      } catch (e) { oldal.hiba = oldal.hiba || String(e.message || e).slice(0, 200); }
      clearTimeout(orakutya);
      await ctx.close().catch(() => {});
      if (oldal.hiba && /idotullepes/.test(oldal.hiba)) break;
    }
    const alap = oldal.szelessegek[ALAP];
    oldal.talalatok = {};
    for (const w of SZELESSEGEK) if (oldal.szelessegek[w]) oldal.talalatok[w] = osszevet(alap, oldal.szelessegek[w]);
    // a nyers oszlop-adatot nem tartjuk meg (nagy)
    for (const w of Object.keys(oldal.szelessegek)) { delete oldal.szelessegek[w].oszlopok; delete oldal.szelessegek[w].kepek; }
    eredmeny[nev] = oldal; kesz++;
    if (KI) fs.writeFileSync(KI, JSON.stringify(eredmeny, null, 1));
    const db = Object.values(oldal.talalatok).reduce((s, t) => s + t.length, 0);
    console.log(`[${kesz}/${lap.length}] ${nev}: ${oldal.hiba ? 'HIBA ' + oldal.hiba : db + ' talalat'}`);
  };
  const sor = [...lap];
  await Promise.all(Array.from({ length: PARHUZAMOS }, async () => { while (sor.length) await feldolgoz(sor.shift()); }));
  await bongeszo.close(); szerver.close();
  if (KI) fs.writeFileSync(KI, JSON.stringify(eredmeny, null, 1));
  return eredmeny;
}

const eredmeny = await main();
// osszegzes a konzolra: tipusonkent, oldalankent
const tipusok = {};
for (const [nev, o] of Object.entries(eredmeny)) for (const [w, lista] of Object.entries(o.talalatok || {})) for (const t of lista) { (tipusok[t.tipus] ||= {}); (tipusok[t.tipus][nev] ||= new Set()).add(w); }
console.log('\n=== ÖSSZEGZÉS (tipus -> oldalak db) ===');
for (const [t, o] of Object.entries(tipusok)) console.log(t.padEnd(24), Object.keys(o).length, 'oldal');
