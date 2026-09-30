// A GYIK-ok szovege -> assets/js/gyik.js
//
// Az eles oldalon a GYIK-ok Common Ninja widgetek voltak (fizetos, kulso
// szolgaltato). Helyettuk a klon.js 5b. szakasza sajat harmonikat rajzol; a
// kerdesek es valaszok a src/partials/faq-*.html fajlokbol jonnek (ugyanazok a
// szovegek, mint a kezzel epitett valtozatban).
//
//   node tools/gyik.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MAPPA = path.join(ROOT, 'src/partials');

const gyik = {};
for (const f of fs.readdirSync(MAPPA).filter((x) => /^faq-.*\.html$/.test(x))) {
  const html = fs.readFileSync(path.join(MAPPA, f), 'utf8');
  const nev = f.replace(/^faq-|\.html$/g, '');
  gyik[nev] = [...html.matchAll(/<button class="faq-q"[^>]*>([\s\S]*?)<\/button>\s*<div class="faq-a">([\s\S]*?)<\/div>\s*<\/div>/g)]
    .map((m) => [m[1].trim(), m[2].replace(/\s+/g, ' ').trim()]);
}

fs.writeFileSync(path.join(ROOT, 'assets/js/gyik.js'),
  '// A tools/gyik.mjs generalja a src/partials/faq-*.html-bol - kezzel ne szerkeszd.\n' +
  '// nev -> [[kerdes, valasz-HTML], ...]\n' +
  'window.MH_GYIK = ' + JSON.stringify(gyik) + ';\n');
console.log(Object.entries(gyik).map(([k, v]) => `${k}: ${v.length}`).join(', '));
