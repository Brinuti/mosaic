// A klon oldalainak kiegeszitese azzal, amit a Wix a sajat rendszerebol adott:
// suti-sav + merokodok (assets/js/suti.js) es a Facebook-domainigazolas.
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

export function kiegeszit(html, elotag) {
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
