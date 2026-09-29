// Wix SSR HTML -> onallo statikus oldal.
// Hasznalat: node tools/wix2static.mjs [oldalnev ...]   (nev nelkul: mind)
// Bemenet: tools/raw/*.html   Kimenet: klon/*.html
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'tools/raw');
const OUT = path.join(ROOT, 'klon');
const IMGDIR = path.join(ROOT, 'assets/img');

const helyiKepek = new Set(fs.readdirSync(IMGDIR));
const hianyzoKepek = new Set();

// --- 1. wixstatic media URL -> helyi fajl -------------------------------
// A tavoli URL alakja: .../media/<id>[~mv2][_d_...]<.ext>/v1/<transzform>/<barmi>.<ext>
// Helyi fajlnev: <id>.<ext>  (a ~mv2 es a _d_... resz nelkul)
function helyiKepNev(url) {
  const u = decodeURIComponent(url);
  const m = u.match(/\/media\/([A-Za-z0-9_]+?)(?:~mv2)?(?:_[a-z]_[0-9_]+)*\.(jpg|jpeg|png|gif|webp|avif|svg)(?:$|[/?])/i);
  if (!m) return null;
  return m[1] + '.' + m[2].toLowerCase();
}

function kepekAtirasa(html) {
  return html.replace(/https:\/\/static\.wixstatic\.com\/media\/[^"'\s)]+/g, (url) => {
    const nev = helyiKepNev(url);
    if (!nev) return url;
    if (!helyiKepek.has(nev)) { hianyzoKepek.add(nev + '  <- ' + url.slice(0, 120)); return url; }
    return 'assets/img/' + nev;
  });
}

// --- 2. scriptek eltavolitasa ------------------------------------------
function scriptekTorlese(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    // Wix-host eloretoltesek: mar nem kellenek
    .replace(/<link\b[^>]*rel="(?:preconnect|dns-prefetch|preload|prefetch|modulepreload)"[^>]*>/gi, '');
}


// --- 2b. Wix sajat @font-face szabalyainak eltavolitasa ------------------
// A Wix a betuit (koztuk fizetos licencuket) a sajat CDN-jerol tolti. Ezeket
// kivesszuk, es helyettuk a sajat, ingyenes betukeszletunk lep eletbe
// (assets/css/wix-fonts.css). Igy az oldal nem fugg a Wixtol.
function wixBetukTorlese(html) {
  let ki = '', i = 0, db = 0;
  for (;;) {
    const kezd = html.indexOf('@font-face', i);
    if (kezd < 0) { ki += html.slice(i); break; }
    const nyit = html.indexOf('{', kezd);
    if (nyit < 0) { ki += html.slice(i); break; }
    let melyseg = 0, j = nyit;
    for (; j < html.length; j++) {
      if (html[j] === '{') melyseg++;
      else if (html[j] === '}') { melyseg--; if (!melyseg) { j++; break; } }
    }
    const blokk = html.slice(kezd, j);
    // csak a tavoli (Wix CDN-es) szabalyokat dobjuk el
    if (/parastorage.com|wixstatic.com/.test(blokk)) { ki += html.slice(i, kezd); db++; }
    else ki += html.slice(i, j);
    i = j;
  }
  torolt += db;
  return ki;
}
let torolt = 0;

// --- 3. sajat betukeszlet + viselkedes beszurasa -----------------------
const FEJ_EXTRA = `
<link rel="stylesheet" href="assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="assets/css/wix-fonts.css">
<link rel="stylesheet" href="assets/css/klon.css">`;
const LAB_EXTRA = `
<script src="assets/js/klon.js" defer></script>`;

function sajatBeszuras(html) {
  html = html.replace(/<\/head>/i, FEJ_EXTRA + '\n</head>');
  html = html.replace(/<\/body>/i, LAB_EXTRA + '\n</body>');
  return html;
}

// --- futtatas ----------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
const kertek = process.argv.slice(2);
const fajlok = fs.readdirSync(RAW).filter((f) => f.endsWith('.html'))
  .filter((f) => !kertek.length || kertek.includes(f) || kertek.includes(f.replace(/\.html$/, '')));

for (const f of fajlok) {
  let html = fs.readFileSync(path.join(RAW, f), 'utf8');
  const elotte = html.length;
  html = scriptekTorlese(html);
  html = wixBetukTorlese(html);
  html = kepekAtirasa(html);
  html = sajatBeszuras(html);
  fs.writeFileSync(path.join(OUT, f), html);
  console.log(`${f.padEnd(40)} ${String(torolt).padStart(3)} @font-face torolve   ${(elotte / 1024).toFixed(0)} kB -> ${(html.length / 1024).toFixed(0)} kB`);
}
if (hianyzoKepek.size) {
  console.log(`\nHIANYZO HELYI KEP (${hianyzoKepek.size}):`);
  for (const k of hianyzoKepek) console.log('  ' + k);
}
