// Wix SSR HTML -> onallo statikus oldal.
//
// A Wix a bongeszo azonositoja alapjan ketfele oldalt szolgal ki: asztali gepen a
// szeles valtozatot, telefonon egy kulon, 320 pixel szeles mobil valtozatot. Mindkettot
// kulon mentjuk le es kulon alakitjuk at, hogy a megjelenes mindkettoben azonos legyen:
//
//   node tools/wix2static.mjs           tools/raw       -> klon/      (asztali)
//   node tools/wix2static.mjs --mobil   tools/raw-mobil -> klon/m/    (mobil)
//
// Egy oldalnevet megadva csak azt epiti ujra, pl.: node tools/wix2static.mjs index
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MOBIL = process.argv.includes('--mobil');
const RAW = path.join(ROOT, MOBIL ? 'tools/raw-mobil' : 'tools/raw');
const OUT = MOBIL ? path.join(ROOT, 'klon/m') : path.join(ROOT, 'klon');
// A mobil oldalak egy szinttel lejjebb vannak, ezert a kozos fajlokra visszafele kell mutatni.
const ELOTAG = MOBIL ? '../' : '';
const IMGDIR = path.join(ROOT, 'assets/img');

const helyiKepek = new Set(fs.readdirSync(IMGDIR));
const hianyzoKepek = new Set();
// minden lementett oldal neve - csak ezekre a belso hivatkozasokat irjuk at
const oldalak = new Set(fs.readdirSync(path.join(ROOT, 'tools/raw'))
  .filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')));

// --- 1. wixstatic media URL -> helyi fajl -------------------------------
// A tavoli URL alakja: .../media/<id>[~mv2][_d_...]<.ext>/v1/<transzform>/<barmi>.<ext>
// Helyi fajlnev: <id>.<ext>  (a ~mv2 es a meretjelzo resz nelkul)
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
    return ELOTAG + 'assets/img/' + nev;
  });
}

// --- 2. belso hivatkozasok atirasa -------------------------------------
// A Wix minden belso linket teljes cimmel ir ki (https://www.mosaicheadspa.hu/...).
// Ezeket helyi fajlnevre csereljuk, kulonben a klonbol visszavinne a Wix-oldalra.
// A canonical es az og:url szandekosan marad teljes cim - azok az SEO-hoz kellenek.
// A blogbejegyzeseket a Wix a /post/ eloteg alatt is kiszolgalja, mi viszont
// egy sima oldalkent mentjuk le - ezert az elotagot levagjuk.
function slugbol(ut) {
  const tiszta = ut.replace(/^\/+|\/+$/g, '').replace(/^post\//, '');
  const slug = tiszta || 'index';
  return oldalak.has(slug) ? slug : null;
}

function linkekAtirasa(html) {
  let db = 0;
  const csere = (egesz, eleje, hatulja) => {
    const [ut, ...maradek] = (hatulja || '').split(/(?=[#?])/);
    const slug = slugbol(ut);
    if (!slug) return egesz;
    db++;
    return `${eleje}${slug}.html${maradek.join('')}"`;
  };
  const ki = html
    // teljes cim - a per jel el is maradhat (a fejlec logoja a puszta domainre mutat)
    .replace(/(<a\b[^>]*?\bhref=")https:\/\/www\.mosaicheadspa\.hu(?:\/([^"]*))?"/gi, csere)
    // gyokertol indulo cim, pl. href="/post/suti-tajekoztato"
    .replace(/(<a\b[^>]*?\bhref=")\/([^"/][^"]*|)"/gi, csere);
  atirtLink += db;
  return ki;
}
let atirtLink = 0;

// --- 3. scriptek eltavolitasa ------------------------------------------
function scriptekTorlese(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    // Wix-host eloretoltesek: mar nem kellenek
    .replace(/<link\b[^>]*rel="(?:preconnect|dns-prefetch|preload|prefetch|modulepreload)"[^>]*>/gi, '');
}

// --- 4. Wix sajat @font-face szabalyainak eltavolitasa ------------------
// A Wix a betuit (koztuk fizetos licencuket) a sajat CDN-jerol tolti. Ezeket
// kivesszuk, es helyettuk a sajat betukeszletunk lep eletbe (assets/css/wix-fonts.css
// es wix-google-fonts.css). Igy az oldal nem fugg a Wix szervereitol.
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
    if (/parastorage\.com|wixstatic\.com/.test(blokk)) { ki += html.slice(i, kezd); db++; }
    else ki += html.slice(i, j);
    i = j;
  }
  torolt += db;
  return ki;
}
let torolt = 0;

// --- 5. asztali <-> mobil valtas -----------------------------------------
// A Wix a bongeszo azonositoja alapjan dontott: telefonon a 320 pixeles mobil
// oldalt kuldte, minden mason az asztalit. Nem a keperyno szelessege szamit,
// ezert egy keskenyre huzott asztali ablak tovabbra is az asztali valtozatot kapja.
// Ugyanezt a dontest masoljuk le. A <head> legelejere kerul, hogy meg a tartalom
// megjelenese elott lefusson, igy nincs villanas.
const TELEFON = "/iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/i";
// A keretbe (iframe) agyazott oldal sosem ugrik at - igy marad hasznalhato az
// osszehasonlito harness, es egy beagyazott elonezet sem dobja ki a latogatot.
const valtoScript = MOBIL
  ? `<script>(function(){if(window.top!==window.self)return;`
    + `if(${TELEFON}.test(navigator.userAgent))return;`
    + `var n=location.pathname.split('/').pop()||'index.html';`
    + `if(n.slice(-5)!=='.html')n+='.html';`
    + `location.replace('../'+n+location.search+location.hash)})()</script>`
  : `<script>(function(){if(window.top!==window.self)return;`
    + `if(!${TELEFON}.test(navigator.userAgent))return;`
    + `var n=location.pathname.split('/').pop()||'index.html';`
    + `if(n.slice(-5)!=='.html')n+='.html';`
    + `location.replace('m/'+n+location.search+location.hash)})()</script>`;

// --- 6. sajat betukeszlet + viselkedes beszurasa -----------------------
function sajatBeszuras(html) {
  const fej = `
<link rel="stylesheet" href="${ELOTAG}assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="${ELOTAG}assets/css/wix-fonts.css">
<link rel="stylesheet" href="${ELOTAG}assets/css/klon.css">`;
  const lab = `
<script src="${ELOTAG}assets/js/klon.js" defer></script>`;
  return html
    .replace(/<head([^>]*)>/i, `<head$1>\n${valtoScript}`)
    .replace(/<\/head>/i, fej + '\n</head>')
    .replace(/<\/body>/i, lab + '\n</body>');
}

// --- futtatas ----------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
const kertek = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const fajlok = fs.readdirSync(RAW).filter((f) => f.endsWith('.html'))
  .filter((f) => !kertek.length || kertek.includes(f) || kertek.includes(f.replace(/\.html$/, '')));

for (const f of fajlok) {
  let html = fs.readFileSync(path.join(RAW, f), 'utf8');
  const elotte = html.length;
  html = scriptekTorlese(html);
  html = wixBetukTorlese(html);
  html = kepekAtirasa(html);
  html = linkekAtirasa(html);
  html = sajatBeszuras(html);
  fs.writeFileSync(path.join(OUT, f), html);
  console.log(`${f.padEnd(42)} ${(elotte / 1024).toFixed(0).padStart(5)} kB -> ${(html.length / 1024).toFixed(0).padStart(5)} kB`);
}
console.log(`\n${fajlok.length} oldal (${MOBIL ? 'mobil' : 'asztali'}), ${torolt} Wix @font-face torolve, ${atirtLink} belso link atirva`);
if (hianyzoKepek.size) {
  console.log(`\nHIANYZO HELYI KEP (${hianyzoKepek.size}):`);
  for (const k of hianyzoKepek) console.log('  ' + k);
}
