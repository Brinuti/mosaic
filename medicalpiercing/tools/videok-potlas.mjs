// A Wix uresen (vagy a Facebook-keretnel rejtve) mentett videolejatszoinak kitoltese a
// tools/videok-mentes.mjs altal az eles oldalrol lementett tartalommal (tools/wix-videok.json).
//
//   import { videokPotlasa } from './videok-potlas.mjs';   // a wix2static.mjs hasznalja
//   node tools/videok-potlas.mjs                            // a klon/ meglevo lapjaira
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
export const ADAT = path.join(ROOT, 'tools/wix-videok.json');
const adat = () => (fs.existsSync(ADAT) ? JSON.parse(fs.readFileSync(ADAT, 'utf8')) : {});

// a <div ...> nyitocimke utani tartalom vege (a hozza tartozo </div> eleje)
function zaro(html, tol) {
  const re = /<div\b|<\/div>/g;
  re.lastIndex = tol;
  for (let m, mely = 1; (m = re.exec(html));) if ((mely += m[0] === '</div>' ? -1 : 1) === 0) return m.index;
  return -1;
}
const lejatszok = (html) => [...html.matchAll(/<div id="(comp-[a-z0-9]+)" class="VideoPlayer\d+__root[^"]*">/g)]
  .map((m) => { const tol = m.index + m[0].length; return { id: m[1], tol, ig: zaro(html, tol) }; });

// ures: nincs benne se keret, se (Wix-videonal) sajat lejatszo; Facebook: a keret meg rejtett
// (a Facebook SDK-ja nem rajzolta ki)
const hianyos = (belso) => !/<iframe\b|<video\b|data-testid="playable"/.test(belso) || (/fb-video/.test(belso) && /visibility: hidden/.test(belso));
export const uresVideok = (html) => lejatszok(html).filter((l) => l.ig > 0 && hianyos(html.slice(l.tol, l.ig))).map((l) => l.id);

export function videokPotlasa(html, nezet, kulcs, hianyzo) {
  const lap = adat()[`${nezet} ${kulcs}`] || {};
  for (const l of lejatszok(html).reverse()) {
    if (l.ig < 0 || !hianyos(html.slice(l.tol, l.ig))) continue;
    if (!lap[l.id]) { hianyzo?.add(`video ${l.id} (tools/videok-mentes.mjs)`); continue; }
    html = html.slice(0, l.tol) + lap[l.id] + html.slice(l.ig);
  }
  return html;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let db = 0;
  for (const nezet of ['asztali', 'mobil']) {
    const mappa = path.join(ROOT, nezet === 'mobil' ? 'klon/m' : 'klon');
    for (const f of fs.readdirSync(mappa, { recursive: true }).filter((x) => x.endsWith('.html'))) {
      if (nezet === 'asztali' && f.startsWith('m/')) continue;
      const fajl = path.join(mappa, f);
      const regi = fs.readFileSync(fajl, 'utf8');
      const hianyzo = new Set();
      const uj = videokPotlasa(regi, nezet, f.replace(/\.html$/, ''), hianyzo);
      if (uj !== regi) { fs.writeFileSync(fajl, uj); db++; }
      for (const h of hianyzo) console.log(`HIANYZIK ${nezet} ${f}: ${h}`);
    }
  }
  console.log(db + ' lap frissitve');
}
