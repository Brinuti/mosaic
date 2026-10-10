// A Wix altal hasznalt INGYENES (Google Fonts) betuk helybe mentese.
//
// A Wix az oldal HTML-jebe agyazza a sajat @font-face szabalyait. Ezek egy resze
// a Google Fonts sajat fajljaira mutat (fonts-cache/googlefont/...): ezek Apache 2.0 /
// OFL licencuek, szabadon onhosztolhatok. Pontosan azt a kiadast toltjuk le, amit a
// Wix hasznal (pl. Roboto v18), igy a betuszelessegek karakterre egyeznek - a
// szovegek toresei es a dobozmeretek is azonosak lesznek az eles oldallal.
//
// A tobbi (Avenir, Futura, Helvetica, DIN Next, Proxima Nova) fizetos licencu es a
// Wix licence ala tartozik - azokat NEM masoljuk ki, hanem a tools/fonts-css.mjs
// ingyenes, meretre igazitott helyettesitoit hasznaljuk.
//
// Hasznalat: node tools/fonts-wix.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAWOK = [path.join(ROOT, 'tools/raw'), path.join(ROOT, 'tools/raw-mobil')];
const OUT = path.join(ROOT, 'assets/fonts');
fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

function fontFaceBlokkok(s) {
  const ki = [];
  let i = 0;
  for (;;) {
    const k = s.indexOf('@font-face', i);
    if (k < 0) break;
    const n = s.indexOf('{', k);
    if (n < 0) break;
    let d = 0, j = n;
    for (; j < s.length; j++) {
      if (s[j] === '{') d++;
      else if (s[j] === '}') { d--; if (!d) { j++; break; } }
    }
    ki.push(s.slice(k, j));
    i = j;
  }
  return ki;
}

const szabalyok = new Map(); // egyedi kulcs -> { csalad, stilus, suly, tart, utvonal }
for (const RAW of RAWOK) for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.html'))) {
  for (const b of fontFaceBlokkok(fs.readFileSync(path.join(RAW, f), 'utf8'))) {
    const src = (b.match(/url\(['"]?([^'")]+)/) || [])[1] || '';
    const m = src.match(/fonts-cache\/googlefont\/woff2(\/s\/[^'")]+\.woff2?)/);
    if (!m) continue; // nem Google Fonts -> nem masoljuk
    const csalad = (b.match(/font-family:\s*['"]?([^;'"]+)/) || [])[1].trim();
    const stilus = (b.match(/font-style:\s*([^;}]+)/) || [])[1]?.trim() || 'normal';
    const suly = (b.match(/font-weight:\s*([^;}]+)/) || [])[1]?.trim() || '400';
    const tart = (b.match(/unicode-range:\s*([^;}]+)/) || [])[1]?.trim() || null;
    const kulcs = `${csalad}|${stilus}|${suly}|${tart || ''}`;
    if (!szabalyok.has(kulcs)) szabalyok.set(kulcs, { csalad, stilus, suly, tart, utvonal: m[1] });
  }
}

let ujLetoltes = 0;
for (const r of szabalyok.values()) {
  r.fajl = r.utvonal.replace(/^\/s\//, '').replace(/\//g, '-'); // pl. roboto-v18-fIKu...woff2
  const cel = path.join(OUT, r.fajl);
  if (!fs.existsSync(cel)) {
    const resp = await fetch('https://fonts.gstatic.com' + r.utvonal, { headers: { 'user-agent': UA } });
    if (!resp.ok) { console.warn(`  ! ${r.utvonal}: HTTP ${resp.status}`); continue; }
    fs.writeFileSync(cel, Buffer.from(await resp.arrayBuffer()));
    ujLetoltes++;
  }
}

let css = `/* Automatikusan generalt - ne szerkeszd kezzel. Forras: tools/fonts-wix.mjs
   A Wix altal is hasznalt, ingyenes licencu Google Fonts fajlok, pontosan abban a
   kiadasban, amit az eles oldal tolt - igy a betuszelessegek karakterre egyeznek. */\n`;
for (const r of [...szabalyok.values()].sort((a, b) => (a.csalad + a.suly).localeCompare(b.csalad + b.suly))) {
  if (!r.fajl || !fs.existsSync(path.join(OUT, r.fajl))) continue;
  css += `@font-face{font-family:'${r.csalad}';font-style:${r.stilus};font-weight:${r.suly};`
       + `font-display:swap;src:url(../fonts/${r.fajl}) format('woff2')`
       + (r.tart ? `;unicode-range:${r.tart}` : '') + `}\n`;
}
fs.writeFileSync(path.join(ROOT, 'assets/css/wix-google-fonts.css'), css);

const csaladok = [...new Set([...szabalyok.values()].map((r) => r.csalad))];
console.log(`${szabalyok.size} @font-face szabaly, ${csaladok.length} csalad: ${csaladok.join(', ')}`);
console.log(`${ujLetoltes} uj fajl letoltve -> assets/fonts/`);
console.log('assets/css/wix-google-fonts.css kesz');
