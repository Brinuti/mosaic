// A regi (Wixes) oldalrol rejtett -regi peldany keszitese az ujrastilusozas ELOTT / mellett (az eredeti klon fajl megmarad: a visszaallitas a foglalas/<nev>.html torlese).
//
//   node tools/ujrastilus/regi-peldany.mjs <nev> [<nev> ...] [--lcp-torol]
//   pl.: node tools/ujrastilus/regi-peldany.mjs paros-headspa-budapest --lcp-torol
//
// Mit csinal oldalankent:
//   klon/<nev>.html   -> klon/<nev>-regi.html      (asztali)
//   klon/m/<nev>.html -> klon/m/<nev>-regi.html    (mobil)
//   a peldanyban: <meta name="robots" content="noindex, nofollow"/>, canonical + og:url = https://www.mosaicheadspa.hu/<nev>-regi
//   --lcp-torol: a tools/lcp-elofeltoltes.json "<nev>" sorai (mobil + asztali) torlese (az uj oldal maga elotolti a hero-kepet; a -regi oldalnak nem kell)
// A script ujrafuttathato (ha a -regi mar megvan, kihagyja), es ervenyes JSON-t / HTML-t hagy maga utan.
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const BAZIS = 'https://www.mosaicheadspa.hu';
const args = process.argv.slice(2);
const lcpTorol = args.includes('--lcp-torol');
const nevek = args.filter((a) => !a.startsWith('--'));
if (!nevek.length) { console.error('hasznalat: node tools/ujrastilus/regi-peldany.mjs <nev> [<nev> ...] [--lcp-torol]'); process.exit(2); }
let hiba = 0;
for (const nev of nevek) {
  for (const mappa of ['klon', path.join('klon', 'm')]) {
    const forras = path.join(GYOKER, mappa, nev + '.html');
    const cel = path.join(GYOKER, mappa, nev + '-regi.html');
    if (!fs.existsSync(forras)) { console.error(`HIBA: nincs ${path.join(mappa, nev + '.html')}`); hiba++; continue; }
    if (fs.existsSync(cel)) { console.log(`kihagyva (mar megvan): ${path.join(mappa, nev + '-regi.html')}`); continue; }
    let k = fs.readFileSync(forras, 'utf8');
    const regi = `${BAZIS}/${nev}-regi`;
    const canon = k.match(/<link rel="canonical" href="[^"]*"\s*\/?>/);
    const og = k.match(/<meta property="og:url" content="[^"]*"\s*\/?>/);
    if (!canon || !og) { console.error(`HIBA: ${path.join(mappa, nev + '.html')}: nincs canonical / og:url (${!!canon}/${!!og})`); hiba++; continue; }
    const noindex = /<meta name="robots" content="noindex/.test(k) ? '' : '<meta name="robots" content="noindex, nofollow"/>';
    k = k.replace(canon[0], noindex + `<link rel="canonical" href="${regi}"/>`).replace(og[0], `<meta property="og:url" content="${regi}"/>`);
    fs.writeFileSync(cel, k);
    console.log(`kesz: ${path.join(mappa, nev + '-regi.html')}`);
  }
  if (lcpTorol) {
    const f = path.join(GYOKER, 'tools', 'lcp-elofeltoltes.json');
    const t = fs.readFileSync(f, 'utf8');
    const nl = t.includes('\r\n') ? '\r\n' : '\n';
    const sorok = t.split(nl);
    const ki = sorok.map((l, i) => [l, i]).filter(([l]) => l.startsWith(`  "${nev}":`)).map(([, i]) => i);
    for (const i of ki.reverse()) {
      if (!sorok[i].trimEnd().endsWith(',')) { // utolso kulcs: az elozo sor vesszoje is kell torolve
        sorok[i - 1] = sorok[i - 1].replace(/,\s*$/, '');
      }
      sorok.splice(i, 1);
    }
    JSON.parse(sorok.join(nl));
    fs.writeFileSync(f, sorok.join(nl));
    console.log(`LCP-tabla: ${ki.length} sor torolve (${nev})`);
  }
}
process.exit(hiba ? 1 : 0);
