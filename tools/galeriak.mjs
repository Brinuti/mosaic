// A Wix Pro Gallery galeriak teljes kepllistaja -> assets/js/galeriak.js
//
// A lapozos (slider) galeriakbol a Wix HTML-je csak az elso ket kepet rajzolja ki,
// a tobbit a bongeszoben tolti be. A teljes lista a mentett oldalak Wix-adataiban
// van ("<doboz>_galleryData": {"items": [...]}). Ez a szkript kigyujti, a hianyzo
// kepeket letolti a static.wixstatic.com-rol (ha van halozat), es megirja az
// assets/js/galeriak.js-t, amibol a klon.js 7. szakasza a lapozot felepiti.
//
//   node tools/galeriak.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMG = path.join(ROOT, 'assets/img');
const FORRASOK = ['tools/raw', 'tools/raw-mobil'].map((m) => path.join(ROOT, m)).filter((m) => fs.existsSync(m));

// JSON-objektum kivagasa a kezdo kapcsos zarojeltol (idezojelek figyelembevetelevel)
function kivag(szoveg, kezd) {
  let mely = 0, idezet = false, vedett = false;
  for (let i = kezd; i < szoveg.length; i++) {
    const c = szoveg[i];
    if (idezet) {
      if (vedett) vedett = false;
      else if (c === '\\') vedett = true;
      else if (c === '"') idezet = false;
    } else if (c === '"') idezet = true;
    else if (c === '{' || c === '[') mely++;
    else if (c === '}' || c === ']') { if (--mely === 0) return szoveg.slice(kezd, i + 1); }
  }
  return null;
}

const galeriak = {};
for (const mappa of FORRASOK) {
  for (const f of fs.readdirSync(mappa).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(mappa, f), 'utf8');
    for (const m of html.matchAll(/"(comp-[a-z0-9]+)_galleryData":\{/g)) {
      if (galeriak[m[1]]) continue;
      const json = kivag(html, m.index + m[0].length - 1);
      if (!json) continue;
      const adat = JSON.parse(json);
      galeriak[m[1]] = (adat.items || [])
        .map((it) => ({
          kep: String(it.mediaUrl || '').replace('~mv2', ''),
          eredeti: String(it.mediaUrl || ''),
          alt: (it.metaData && (it.metaData.alt || it.metaData.title)) || '',
        }))
        .filter((x) => /\.(jpe?g|png|webp|gif)$/i.test(x.kep));
    }
  }
}

// hianyzo kepek letoltese
let letoltve = 0, hianyzik = 0;
for (const lista of Object.values(galeriak)) {
  for (const it of lista) {
    const cel = path.join(IMG, it.kep);
    if (fs.existsSync(cel)) continue;
    try {
      const v = await fetch('https://static.wixstatic.com/media/' + it.eredeti);
      if (!v.ok) throw new Error('HTTP ' + v.status);
      fs.writeFileSync(cel, Buffer.from(await v.arrayBuffer()));
      letoltve++;
    } catch {
      hianyzik++;
    }
  }
}

// csak a helyben meglevo kepek kerulnek a listaba
const ki = {};
for (const [doboz, lista] of Object.entries(galeriak)) {
  ki[doboz] = lista.filter((it) => fs.existsSync(path.join(IMG, it.kep))).map((it) => [it.kep, it.alt]);
}
fs.writeFileSync(path.join(ROOT, 'assets/js/galeriak.js'),
  '// A tools/galeriak.mjs generalja - kezzel ne szerkeszd.\n' +
  '// doboz-azonosito -> [[kepfajl, alt], ...] a Wix-galeria sorrendjeben\n' +
  'window.MH_GALERIAK = ' + JSON.stringify(ki) + ';\n');

const osszes = Object.values(galeriak).reduce((a, l) => a + l.length, 0);
console.log(`${Object.keys(galeriak).length} galeria, ${osszes} kep; letoltve: ${letoltve}, hianyzik: ${hianyzik}`);
