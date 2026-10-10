// Az eles oldal (www.medicalpiercing.hu) osszes oldala, a Wix sitemap.xml-jeibol.
//
//   node tools/oldalak.mjs --frissit   a sitemapokbol ujra osszeszedi a listat (tools/oldalak.txt)
//   node tools/oldalak.mjs --utvonalak a Wix utvonaltablajabol a rejtett oldalakat is hozzaadja
//
// Minden oldalnak harom neve van:
//   url   - a teljes, kodolt Wix-cim (ahonnan lementjuk)
//   ut    - a dekodolt utvonal, pl. /varosok/bekescsaba (ezen a cimen el a klon is)
//   kulcs - biztonsagos fajlnev ekezet es irasjel nelkul, pl. varosok/bekescsaba
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE = 'https://www.medicalpiercing.hu';
const ROOT = path.resolve(import.meta.dirname, '..');
const LISTA = path.join(ROOT, 'tools/oldalak.txt');

export { kulcsbol } from '../lib/utvonal.js';
import { kulcsbol } from '../lib/utvonal.js';

export function oldalak() {
  return fs.readFileSync(LISTA, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean).map((url) => {
    const ut = decodeURIComponent(new URL(url).pathname).replace(/\/+$/, '') || '/';
    return { url, ut, kulcs: kulcsbol(ut) };
  });
}

// A Wix 404-es oldala (nem letezo cimre ezt adja): a mentes es az atalakitas az
// oldalakkal egyutt kezeli, a build dist/404.html-kent teszi ki.
export const NEMTALALT = { url: SITE + '/nincs-ilyen-oldal-404', ut: '/nincs-ilyen-oldal-404', kulcs: '404' };
export const mindenOldal = () => [...oldalak(), NEMTALALT];

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--frissit')) {
  const index = await (await fetch(SITE + '/sitemap.xml')).text();
  // a korabban bejarassal talalt (sitemapben nem szereplo) oldalak is maradnak
  const urlek = new Set(fs.existsSync(LISTA) ? fs.readFileSync(LISTA, 'utf8').split('\n').filter(Boolean) : []);
  for (const [, sm] of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const xml = await (await fetch(sm)).text();
    for (const [, u] of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>/g)) urlek.add(u);
  }
  fs.writeFileSync(LISTA, [...urlek].sort().join('\n') + '\n');
  console.log(`${urlek.size} oldal -> tools/oldalak.txt`);
}
// --bejaras: a lementett oldalak belso linkjei kozul azokat, amik nincsenek a
// sitemapben, de elnek (rejtett, noindex oldalak), hozzaadja a listahoz.
// Utana: node tools/mentes.mjs, es ujra --bejaras, amig nem talal ujat.
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--bejaras')) {
  const ismert = new Set(oldalak().map((o) => o.kulcs));
  const jeloltek = new Map();
  for (const mappa of ['tools/raw', 'tools/raw-mobil']) {
    for (const f of fs.readdirSync(path.join(ROOT, mappa), { recursive: true }).filter((x) => x.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(ROOT, mappa, f), 'utf8');
      for (const [, ut] of html.matchAll(/<a\b[^>]*?\bhref="https?:\/\/(?:www\.)?medicalpiercing\.hu(\/[^"?#]*)?[^"]*"/gi)) {
        let d; try { d = decodeURIComponent(ut || '/').replace(/^\/post\//, '/').replace(/\/+$/, '') || '/'; } catch { continue; }
        const k = kulcsbol(d);
        if (!ismert.has(k) && !jeloltek.has(k)) jeloltek.set(k, SITE + encodeURI(d));
      }
    }
  }
  const uj = [];
  for (const [k, url] of jeloltek) {
    const v = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 Chrome/131' } });
    console.log(v.status, k);
    if (v.status === 200) uj.push(url);
  }
  if (uj.length) fs.appendFileSync(LISTA, uj.join('\n') + '\n');
  console.log(`${uj.length} uj oldal a listahoz adva`);
}
// --utvonalak: a Wix minden oldal HTML-jebe beleteszi a webhely utvonaltablajat ("routes": minden
// statikus oldal, a rejtett, linkeletlen, noindex oldalak is, pl. akcios celoldalak,
// koszonooldalak). Ami ezek kozul a Wixen 200-zal el (es nem a Wix 404-es lapja), a listara kerul.
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--utvonalak')) {
  const html = await (await fetch(SITE + '/', { headers: { 'user-agent': 'Mozilla/5.0 Chrome/131' } })).text();
  const i = html.indexOf('"routes":') + '"routes":'.length;
  let mely = 0, j = i;
  for (; j < html.length; j++) { if (html[j] === '{') mely++; else if (html[j] === '}' && --mely === 0) break; }
  const routes = JSON.parse(html.slice(i, j + 1));
  const ismert = new Set(oldalak().map((o) => o.kulcs));
  const uj = [];
  for (const [r, v] of Object.entries(routes)) {
    if (v.type !== 'Static') continue;
    const d = '/' + r.replace(/^\.\//, '');
    if (ismert.has(kulcsbol(d))) continue;
    const url = SITE + encodeURI(d);
    const valasz = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 Chrome/131' } });
    const cim = valasz.status === 200 ? ((await valasz.text()).match(/<title>([^<]*)/) || [])[1] || '' : '';
    const jo = valasz.status === 200 && !/^404\b/.test(cim);
    console.log(valasz.status, jo ? 'UJ ' : '-  ', d, cim.slice(0, 60));
    if (jo) uj.push(url);
  }
  if (uj.length) fs.appendFileSync(LISTA, uj.join('\n') + '\n');
  console.log(`${uj.length} uj oldal a listahoz adva`);
}
if (process.argv[1] === fileURLToPath(import.meta.url) && !process.argv.some((a) => a.startsWith('--'))) {
  const l = oldalak();
  const kulcsok = new Set(l.map((o) => o.kulcs));
  console.log(`${l.length} oldal, ${kulcsok.size} egyedi kulcs`);
  for (const o of l) console.log(o.kulcs.padEnd(60), o.ut);
}
