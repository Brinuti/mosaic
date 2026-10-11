// Az uj, REJTETT fooldal (/uj-fooldal) osszerakasa a dist/ mappaba (a build hivja: tools/build.mjs).
//
// Forras: uj-fooldal/index.html (kezzel irt lap, a latvanyterv alapjan), stilus: assets/css/uj-fooldal.css, szkript:
// assets/js/uj-fooldal.js, kepek: assets/img/ (az uj-* kepeket a tools/uj-fooldal-kepek.py gyartja). Nem a Wix-klon resze:
// a tools/wix2static.mjs nem erinti, es a klon/ mappaba sem kerul.
//
// A lap a Wix-szel azonos cimeken el a tobbi oldal mellett (/uj-fooldal), asztali es mobil kiszolgalasra is ugyanaz a
// (reszponziv) fajl. A mostani fooldalt (/) nem valtja le. Rejtett: nincs a sitemapben, semmi nem linkeli, noindex
// (meta + a fuggveny X-Robots-Tag fejlece); a build megall, ha a forrasbol a noindex hianyzik.
// A foglalomotor-inditot, a verziojeleket (?v=) es a foglalas-merest a build tobbi resze teszi ra, mint a tobbi lapra.
import fs from 'node:fs';
import path from 'node:path';

export const UJ_FOOLDAL_UT = '/uj-fooldal';

export function ujFooldal(ROOT, DIST) {
  const forras = fs.readFileSync(path.join(ROOT, 'uj-fooldal/index.html'), 'utf8');
  if (!/<meta name="robots" content="[^"]*noindex[^"]*"/i.test(forras)) throw new Error('uj-fooldal/index.html: hianyzik a noindex meta (a lap rejtett)');
  if (/rel="canonical"/i.test(forras)) throw new Error('uj-fooldal/index.html: canonical nem lehet a noindex lapon');
  // minden helyi kep- es betu-hivatkozasnak letezni kell (hianyzo fajl = torott kep az eles lapon)
  const hianyzo = [...new Set([...forras.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map((m) => m[1]))].filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (hianyzo.length) throw new Error('uj-fooldal/index.html: hianyzo fajlok: ' + hianyzo.join(', '));
  for (const ki of ['_a', '_m']) fs.writeFileSync(path.join(DIST, ki, 'uj-fooldal.html'), forras);
  console.log('uj-fooldal: ' + UJ_FOOLDAL_UT + ' (rejtett, noindex) asztali es mobil');
}
