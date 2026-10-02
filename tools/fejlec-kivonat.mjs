// A MOSAIC oldal fejlecenek (menusor + akcios sav) kiemelese a klonbol, hogy a sajat
// (nem Wixrol mentett) oldalak - pl. a /pmu-sminktetovalas landing - PONTOSAN ugyanazt a
// fejlecet kapjak, mint a tobbi oldal.
//
//   node tools/fejlec-kivonat.mjs
//
// A klon egy oldalat (klon/sminktetovalas-budapest.html es a mobil parja) bongeszoben
// megnyitja, es kimasolja:
//   - a #SITE_HEADER HTML-jet (mobilon a menu-kontenerrel egyutt),
//   - azokat a CSS-szabalyokat, amelyek a fejlec elemeire vonatkoznak (a Wix osztalyaival,
//     valtozatlanul), a fejlec szabad (osztaly/id nelkuli) szabalyait a #mh-fejlec ala szukitve,
//   - a fejleckent hasznalt CSS-valtozokat es az orokolt betu-beallitasokat.
// A Wix-szuloelemek (masterPage stb.) display:contents burkolokent maradnak meg, igy a rajuk
// epulo szelektorok is mukodnek, de elrendezest nem adnak (a sticky fejlec a <body>-hoz tapad).
//
// Ugyanigy a lablecet (#SITE_FOOTER) is: assets/fejlec/lablec-asztali.html, lablec-mobil.html
// (<!--mh-lablec--> jelolo, #mh-lablec burok).
//
// Eredmeny: assets/fejlec/asztali.html es assets/fejlec/mobil.html. Ezeket a
// tools/netlify-build.mjs szurja be a <!--mh-fejlec--> jelolo helyere (az _a/ mappaba az
// asztalit, az _m/ mappaba a mobilt). A muködest (legordulo, mobil menu, "i" felugro ablak)
// ugyanugy az assets/js/klon.js adja, mint a tobbi oldalon.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = path.resolve(import.meta.dirname, '..');
const KI = path.join(ROOT, 'assets/fejlec');
const MINTA = 'sminktetovalas-budapest';
const PORT = 4180;
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = createRequire('/opt/node22/lib/node_modules/')('playwright'); }

fs.mkdirSync(KI, { recursive: true });
const szerver = spawn(process.execPath, [path.join(ROOT, 'tools/serve-klon.mjs')], { stdio: 'ignore' });
await new Promise((ok) => setTimeout(ok, 700));

// a bongeszoben fut: kiemeli a fejlecet es a hozza tartozo CSS-t
function kiemel({ allapotOsztalyok, gyokerId, kiegeszitok, burokId }) {
  const fejlec = document.getElementById(gyokerId);
  // mobilon a lenyilo menu (es a fatyla) a fejlecen kivul lehet
  const tobbi = kiegeszitok
    .map((id) => document.getElementById(id)).filter((e) => e && !fejlec.contains(e));
  const gyokerek = [fejlec, ...tobbi.filter((e) => !tobbi.some((m) => m !== e && m.contains(e)))];
  const fa = new Set();
  for (const g of gyokerek) { fa.add(g); for (const e of g.querySelectorAll('*')) fa.add(e); }
  const osok = [];
  for (let e = fejlec.parentElement; e; e = e.parentElement) osok.push(e);
  const jelek = (elemek) => {
    const s = new Set();
    for (const e of elemek) {
      if (e.id) s.add('#' + e.id);
      for (const c of e.classList) s.add('.' + c);
    }
    return s;
  };
  const faJel = jelek(fa), osJel = jelek(osok);
  // a klon.js altal futas kozben ki-be kapcsolt allapotosztalyok (nyitott menu, almenu stb.)
  for (const c of allapotOsztalyok) faJel.add('.' + c);
  const tokenek = (sel) => (sel.replace(/\[[^\]]*\]/g, '').match(/[#.][\w-]+(?:\\.[\w-]*)*/g) || []).map((t) => t.replace(/\\/g, ''));
  // a szelektor szetvagasa a legfelso szintu vesszoknel
  const reszek = (sel) => {
    const ki = []; let m = 0, a = 0;
    for (let i = 0; i < sel.length; i++) {
      const c = sel[i];
      if (c === '(' || c === '[') m++; else if (c === ')' || c === ']') m--;
      else if (c === ',' && !m) { ki.push(sel.slice(a, i).trim()); a = i + 1; }
    }
    ki.push(sel.slice(a).trim());
    return ki.filter(Boolean);
  };
  const csupasz = (sel) => sel.replace(/::?(hover|focus|focus-visible|focus-within|active|visited|before|after|placeholder|marker|selection|first-letter|first-line)\b(\([^)]*\))?/g, '') || '*';
  const illik = (sel) => { try { const s = csupasz(sel); for (const e of fa) if (e.matches(s)) return true; } catch { /* ervenytelen */ } return false; };

  const valtozok = {};
  const kulcskepek = new Set();
  const szabaly = (r) => {
    if (r instanceof CSSStyleRule) {
      const megtart = [];
      for (const s of reszek(r.selectorText)) {
        const t = tokenek(s);
        if (t.length) {
          const benne = t.some((x) => faJel.has(x));
          const ismert = t.every((x) => faJel.has(x) || osJel.has(x));
          if (benne && ismert) megtart.push(s);
          else if (!benne && ismert) {
            // csak a szulokre vonatkozo szabaly: a CSS-valtozoit visszuk at
            for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; if (p.startsWith('--')) valtozok[p] = r.style.getPropertyValue(p).trim(); }
          }
        } else if (/^(:root|html|body)\b/.test(s)) {
          for (let i = 0; i < r.style.length; i++) { const p = r.style[i]; if (p.startsWith('--')) valtozok[p] = r.style.getPropertyValue(p).trim(); }
        } else if (illik(s)) {
          megtart.push(':where(#' + burokId + ') ' + s);
        }
      }
      if (!megtart.length) return '';
      for (const m of r.style.cssText.matchAll(/animation(?:-name)?:\s*([\w-]+)/g)) kulcskepek.add(m[1]);
      return megtart.join(',') + '{' + r.style.cssText + '}';
    }
    if (r instanceof CSSMediaRule || r instanceof CSSSupportsRule) {
      const belso = [...r.cssRules].map(szabaly).join('');
      if (!belso) return '';
      return (r instanceof CSSMediaRule ? '@media ' + r.conditionText : '@supports ' + r.conditionText) + '{' + belso + '}';
    }
    return '';
  };
  let css = '';
  const kepkockak = {};
  for (const lap of document.styleSheets) {
    let szabalyok; try { szabalyok = lap.cssRules; } catch { continue; }
    for (const r of szabalyok) {
      if (r instanceof CSSKeyframesRule) kepkockak[r.name] = r.cssText;
      else css += szabaly(r);
    }
  }
  for (const k of kulcskepek) if (kepkockak[k]) css += kepkockak[k];

  // orokolt betu- es szinbeallitasok a fejlec szulojetol; a CSS-valtozok szamitott erteke is
  // (a Wix tema-szinei - pl. --color_36 - tobb helyrol, egymasra epulve jonnek)
  const szulo = getComputedStyle(fejlec.parentElement);
  for (let i = 0; i < szulo.length; i++) {
    const p = szulo[i];
    if (p.startsWith('--')) valtozok[p] = szulo.getPropertyValue(p).trim();
  }
  const orokolt = ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'letter-spacing', '-webkit-font-smoothing']
    .map((p) => p + ':' + szulo.getPropertyValue(p)).join(';');
  const burok = osok.filter((e) => e !== document.body && e !== document.documentElement).reverse()
    .map((e) => ({ tag: e.tagName.toLowerCase(), id: e.id, cls: e.className }));
  return {
    html: gyokerek.map((g) => g.outerHTML).join('\n'),
    css,
    valtozok: Object.entries(valtozok).map(([k, v]) => k + ':' + v).join(';'),
    orokolt,
    burok,
    gyokerOsztaly: [document.documentElement.className, document.body.className].join(' ').trim(),
    gyokerIdk: gyokerek.map((g) => g.id).filter(Boolean),
  };
}

// a hivatkozasok es kepek abszolut, kiterjesztes nelkuli cimre (a Netlify-n igy elnek az oldalak)
function cimek(html) {
  return html
    .replace(/(src|href)="(?:\.\.\/)?(assets\/[^"]*)"/g, '$1="/$2"')
    .replace(/srcSet="([^"]*)"/gi, (m, v) => 'srcSet="' + v.replace(/(^|,\s*)(?:\.\.\/)?assets\//g, '$1/assets/') + '"')
    .replace(/href="https:\/\/www\.mosaicheadspa\.hu\/?([^"#?]*)([^"]*)"/g, (m, ut, maradek) => `href="/${ut.replace(/\.html$/, '')}${maradek}"`)
    .replace(/href="(?!\/|https?:|mailto:|tel:|#)([^"#?]+?)(?:\.html)?([#?][^"]*)?"/g, (m, ut, maradek) => `href="/${ut === 'index' ? '' : ut}${maradek || ''}"`);
}

// a klon.js-ben classList.toggle/add-dal allitott osztalyok: ezek szabalyai is kellenek
const ALLAPOT = [...new Set([...fs.readFileSync(path.join(ROOT, 'assets/js/klon.js'), 'utf8')
  .matchAll(/classList\.(?:toggle|add)\('([\w-]+)'/g)].map((m) => m[1]))];
// fejlec: SITE_HEADER (+ mobilon a menu-kontener), lablec: SITE_FOOTER
const RESZEK = [
  { nev: 'fejlec', gyokerId: 'SITE_HEADER', burokId: 'mh-fejlec', fajl: (n) => n, popup: true,
    kiegeszitok: ['MENU_AS_CONTAINER', 'overlay-MENU_AS_CONTAINER', 'MENU_AS_CONTAINER_EXPANDABLE_MENU'] },
  { nev: 'lablec', gyokerId: 'SITE_FOOTER', burokId: 'mh-lablec', fajl: (n) => 'lablec-' + n, popup: false, kiegeszitok: [] },
];
const bongeszo = await playwright.chromium.launch();
for (const [nev, ua, ut] of [['asztali', undefined, `/${MINTA}.html`], ['mobil', UA_MOBIL, `/m/${MINTA}.html`]]) {
  const lap = await bongeszo.newPage({ viewport: nev === 'mobil' ? { width: 390, height: 844 } : { width: 1440, height: 900 }, userAgent: ua, isMobile: nev === 'mobil' });
  await lap.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await lap.goto(`http://localhost:${PORT}${ut}`, { waitUntil: 'load' });
  for (const resz of RESZEK) {
    const k = await lap.evaluate(kiemel, { allapotOsztalyok: ALLAPOT, gyokerId: resz.gyokerId, kiegeszitok: resz.kiegeszitok, burokId: resz.burokId });
    const nyit = k.burok.map((b) => `<${b.tag}${b.id ? ` id="${b.id}"` : ''}${b.cls ? ` class="${b.cls}"` : ''} style="display:contents">`).join('');
    const zar = k.burok.map((b) => `</${b.tag}>`).reverse().join('');
    const popup = resz.popup ? fs.readFileSync(path.join(ROOT, nev === 'mobil' ? 'assets/popup/info-mobil.html' : 'assets/popup/info.html'), 'utf8').trim() : '';
    const ki = [
      `<!-- A MOSAIC oldal ${resz.nev}e (${nev}), a klon ${MINTA} oldalabol - generalta: tools/fejlec-kivonat.mjs -->`,
      `<style data-forras="${resz.nev}">#${resz.burokId}{display:contents;${k.valtozok};${k.orokolt}}${k.css}</style>`,
      `<div id="${resz.burokId}" class="${k.gyokerOsztaly}">${nyit}`,
      cimek(k.html),
      `${zar}</div>`,
      ...(popup ? [`<template id="mh-popup-rk7x7">\n${popup}\n</template>`] : []),
      // a Wix mobil fejlece 320 px szeles elrendezes: a klon oldalain a viewport nagyitja fel a
      // kepernyo szelessegere, itt (device-width viewport mellett) a reszt nagyitjuk ugyanennyire
      ...(nev === 'mobil' ? [`<script>(function(){function z(){var n=document.documentElement.clientWidth/320;for(var i of ${JSON.stringify(k.gyokerIdk)}){var e=document.getElementById(i);if(e)e.style.zoom=n}}z();addEventListener('resize',z)})()</script>`] : []),
    ].join('\n') + '\n';
    const fajl = resz.fajl(nev) + '.html';
    fs.writeFileSync(path.join(KI, fajl), ki);
    console.log(`assets/fejlec/${fajl}  ${(ki.length / 1024).toFixed(0)} kB (CSS ${(k.css.length / 1024).toFixed(0)} kB)`);
  }
  await lap.close();
}
await bongeszo.close();
szerver.kill();
