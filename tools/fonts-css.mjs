// A Wix betucsalad-neveihez ingyenes helyettesitoket rendel @font-face-szel.
//
// A "sa" (size-adjust) ertekeket meressel allapitottuk meg: a tools/osszehasonlitas
// harness betuenkent osszeveti az eredeti Wix betu es a helyettesito szelesseget.
// A size-adjust miatt a szoveg ugyanolyan szeles lesz, mint az eles oldalon, ezert
// a sortoresek es a dobozmeretek is megegyeznek.
//
// Amelyik csaladot a Wix maga sem tolti be (sarabun, HelveticaNeueW01-*), ahhoz mi
// sem adunk fajlt: ugyanugy a rendszer betujere esik vissza, mint az eles oldalon.
//
// Hasznalat: node tools/fonts-css.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const jegyzek = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/fonts-jegyzek.json'), 'utf8'));

// wix csaladnev -> { wix-vastagsag: [helyettesito csalad, vastagsag, size-adjust %] }
// A roboto / roboto-thin / roboto-bold / lato / sarabun csaladokat nem itt kezeljuk:
// azok ingyenes Google Fonts betuk, es a tools/fonts-wix.mjs pontosan azt a kiadast
// menti le, amit a Wix hasznal (assets/css/wix-google-fonts.css).
const TERKEP = {
  // [helyettesito csalad, vastagsag, size-adjust %, ascent %, descent %]
  // A size-adjust a betuszelesseget, az ascent/descent a sormagassagot igazitja
  // az eredeti Wix-betu ertekeire - igy sem a sortores, sem a sormagassag nem csuszik el.
  "avenir-lt-w01_35-light1475496": { 400: ["Hanken Grotesk", 400, 99.91, 93.6, 25.0] },
  "avenir-lt-w05_35-light":        { 400: ["Hanken Grotesk", 400, 99.91, 93.6, 25.0] },
  "avenir-lt-w01_85-heavy1475544": { 400: ["Sarabun", 700, 103.89, 91.2, 23.7] },
  "din-next-w01-light":            { 400: ["Hanken Grotesk", 600, 94.68, 91.2, 35.0] },
  "helvetica-w01-light":           { 400: ["Arimo", 400, 100.986, 97.9, 25.0] },
  "helvetica-w02-light":           { 400: ["Arimo", 400, 100.986, 97.9, 25.0] },
  "futura-lt-w01-book":            { 400: ["Jost", 400, 104.314, 105.2, 29.3] },
  "futura-lt-w05-book":            { 400: ["Jost", 400, 104.314, 105.2, 29.3] },
  "proxima-n-w01-reg":             { 400: ["Hanken Grotesk", 400, 97.89, 91.2, 23.7] },
};

const talal = (family, weight) => jegyzek.filter((j) => j.family === family && j.weight === weight);

let ki = '/* Automatikusan generalt - ne szerkeszd kezzel. Forras: tools/fonts-css.mjs */\n';
let db = 0;
for (const [wixNev, wMap] of Object.entries(TERKEP)) {
  for (const [wixW, [csal, csalW, sa, asc, desc]] of Object.entries(wMap)) {
    const fajlok = talal(csal, csalW);
    if (!fajlok.length) { console.warn(`  ! hianyzik: ${csal} ${csalW} (${wixNev})`); continue; }
    for (const f of fajlok) {
      ki += `@font-face{font-family:'${wixNev}';font-style:normal;font-weight:${wixW};`
          + `font-display:swap;src:url(../fonts/${f.file}) format('woff2');`
          + (sa && sa !== 100 ? `size-adjust:${sa}%;` : '')
          + (asc ? `ascent-override:${asc}%;descent-override:${desc}%;line-gap-override:0%;` : '')
          + `unicode-range:${f.range}}\n`;
      db++;
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'assets/css/wix-fonts.css'), ki);
console.log(`assets/css/wix-fonts.css - ${db} @font-face szabaly, ${Object.keys(TERKEP).length} Wix csaladnev`);

// a letoltott betuk sajat neven is, tartaleknak es a mereshez
let k2 = '/* Automatikusan generalt - a letoltott ingyenes betuk sajat neven. */\n';
for (const f of jegyzek) {
  k2 += `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};`
      + `font-display:swap;src:url(../fonts/${f.file}) format("woff2");unicode-range:${f.range}}\n`;
}
fs.writeFileSync(path.join(ROOT, 'assets/css/fonts-keszlet.css'), k2);
console.log(`assets/css/fonts-keszlet.css - ${jegyzek.length} @font-face szabaly`);
