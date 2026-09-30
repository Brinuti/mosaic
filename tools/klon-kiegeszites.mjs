// A klon oldalainak kiegeszitese azzal, amit a Wix a sajat rendszerebol adott:
// suti-sav + merokodok (assets/js/suti.js), a Facebook-domainigazolas es a fejlec
// "i" ikonjara nyilo felugro ablak (assets/popup/, lasd tools/popup-info.mjs).
//
// A wix2static.mjs minden atalakitott oldalra lefuttatja. Kulon is futtathato a
// mar meglevo klon/ fajlokra (pl. ha a tools/raw/ nincs meg a gepen):
//
//   node tools/klon-kiegeszites.mjs
//
// Tobbszor futtatva sem szur be semmit ketszer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JEL = '<!--mh-kiegeszites-->';

// A fejlec logoja: a Wix a 3000x3000-es eredetibol elore kicsinyitett, elesitett
// valtozatot kuldott (fill, kozepre vagva, usm). A klonban az eredeti allt, amit a
// bongeszo 143x54-re kicsinyit - ez recés, pixeles. Helyette a Wixszel azonos
// modon (kozepre vagva, Lanczos + usm_0.66 elesites) kicsinyitett 1x/2x/3x
// valtozatok kerulnek be: assets/img/logo-<szeles>x<magas>@<n>x.png.
const LOGO = 'c2eb0f_ebf1831725394a0591c64e442a81b333.png';
function logoCsere(html, elotag) {
  return html.replace(/<img\b[^>]*assets\/img\/c2eb0f_ebf1831725394a0591c64e442a81b333\.png[^>]*>/g, (img) => {
    const m = img.match(/width="(\d+)" height="(\d+)"/);
    if (!m) return img;
    const alap = `${elotag}assets/img/logo-${m[1]}x${m[2]}`;
    const srcset = `${alap}@1x.png 1x, ${alap}@2x.png 2x, ${alap}@3x.png 3x`;
    return img
      .replace(/srcSet="[^"]*"/, `srcSet="${srcset}"`)
      .replace(/ src="[^"]*"/, ` src="${alap}@1x.png"`);
  });
}

// A Wix-felugro ablakok (lightbox) tartalmat a Wix JS-e kattintasra tolti be.
// A klonban a tools/popup-info.mjs altal elkeszitett HTML <template>-kent kerul az
// oldal vegere (igy nem tolt be es nem rajzol semmit, amig nem kell), a klon.js a
// [data-popupid] elemre kattintva innen nyitja meg. Ujrafuttatva a regi blokkot csereli.
const POPUPOK = { rk7x7: { asztali: 'assets/popup/info.html', mobil: 'assets/popup/info-mobil.html' } };
const POPUP_BLOKK = /\n?<!--mh-popup-->[\s\S]*?<!--\/mh-popup-->/g;
function popupBeszuras(html, elotag) {
  const ROOT = path.resolve(import.meta.dirname, '..');
  const nezet = elotag ? 'mobil' : 'asztali';
  const blokkok = Object.entries(POPUPOK)
    .filter(([id]) => html.includes(`data-popupid="${id}"`))
    .map(([id, f]) => `<template id="mh-popup-${id}">\n${fs.readFileSync(path.join(ROOT, f[nezet]), 'utf8').trim()}\n</template>`);
  html = html.replace(POPUP_BLOKK, '');
  if (!blokkok.length) return html;
  return html.replace(/<\/body>/i, `<!--mh-popup-->\n${blokkok.join('\n')}\n<!--/mh-popup-->\n</body>`);
}

export function kiegeszit(html, elotag) {
  if (html.includes(LOGO)) html = logoCsere(html, elotag);
  // a galeriak teljes kepllistaja (tools/galeriak.mjs) - a klon.js 7. szakasza hasznalja
  if (!html.includes('assets/js/galeriak.js')) {
    html = html.replace(/<\/head>/i, `<script src="${elotag}assets/js/galeriak.js"></script>\n</head>`);
  }
  // a GYIK-ok szovege (tools/gyik.mjs) - a klon.js 5b. szakasza hasznalja
  if (!html.includes('assets/js/gyik.js')) {
    html = html.replace(/<\/head>/i, `<script src="${elotag}assets/js/gyik.js"></script>\n</head>`);
  }
  html = popupBeszuras(html, elotag);
  if (html.includes(JEL)) return html;
  const fej = [
    JEL,
    '<meta name="facebook-domain-verification" content="yaoi87nral4y1dniepta2xcfb5jwfy" />',
    `<script src="${elotag}assets/js/suti.js"></script>`,
  ].join('\n');
  return html.replace(/<\/head>/i, fej + '\n</head>');
}

// kozvetlen futtatas: a meglevo klon/ es klon/m/ oldalak
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(import.meta.dirname, '..');
  let db = 0;
  for (const [mappa, elotag] of [['klon', ''], ['klon/m', '../']]) {
    for (const f of fs.readdirSync(path.join(ROOT, mappa)).filter((x) => x.endsWith('.html'))) {
      const p = path.join(ROOT, mappa, f);
      const regi = fs.readFileSync(p, 'utf8');
      const uj = kiegeszit(regi, elotag);
      if (uj !== regi) { fs.writeFileSync(p, uj); db++; }
    }
  }
  console.log(`${db} oldal kiegeszitve`);
}
