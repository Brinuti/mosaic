// A publikalhato mappa (dist/) osszerakasa a klonbol.
//
// A klon oldalai a klon/ mappaban vannak, a kepek, betuk es videok viszont a
// projekt gyokereben, az assets/ alatt. A kiszolgalon a kettonek egymas mellett
// kell lennie, ezert egy friss dist/ mappaba masoljuk:
//
//   dist/*.html        <- klon/*.html      (asztali)
//   dist/m/*.html      <- klon/m/*.html    (mobil)
//   dist/assets/       <- assets/
//   dist/robots.txt, dist/sitemap.xml, dist/_redirects, dist/_headers
//
// Amig nem az eles domainen fut (ELES=1 nincs beallitva), minden oldal
// "noindex" fejlecet kap, es a robots.txt mindent tilt - igy a probaoldal nem
// kerul be a Google-be, es nem versenyez a mostani Wix-oldallal.
//
//   node tools/netlify-build.mjs          probaoldal (noindex)
//   ELES=1 node tools/netlify-build.mjs   eles publikalas
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ELES = process.env.ELES === '1';

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

fs.cpSync(path.join(ROOT, 'klon'), DIST, { recursive: true });
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'sitemap.xml'), path.join(DIST, 'sitemap.xml'));

fs.writeFileSync(path.join(DIST, 'robots.txt'), ELES
  ? 'User-agent: *\nAllow: /\n\nSitemap: https://www.mosaicheadspa.hu/sitemap.xml\n'
  : 'User-agent: *\nDisallow: /\n');

// A Wix a suti-tajekoztatot /post/ elotaggal szolgalta ki - a regi cim is mukodjon.
fs.writeFileSync(path.join(DIST, '_redirects'), [
  '/post/suti-tajekoztato  /suti-tajekoztato  301',
  '/post/*                 /:splat            301',
  '',
].join('\n'));

fs.writeFileSync(path.join(DIST, '_headers'), [
  '/*',
  ...(ELES ? [] : ['  X-Robots-Tag: noindex, nofollow']),
  '/assets/*',
  '  Cache-Control: public, max-age=604800',
  // a HTML-beagyazasok (GYIK, arlistak) csak keretben jelennek meg, onalloan ne indexelodjenek
  '/assets/embed/*',
  '  X-Robots-Tag: noindex',
  '',
].join('\n'));

const html = fs.readdirSync(DIST).filter((f) => f.endsWith('.html')).length;
const mobil = fs.readdirSync(path.join(DIST, 'm')).filter((f) => f.endsWith('.html')).length;
console.log(`dist/ kesz: ${html} asztali + ${mobil} mobil oldal, ${ELES ? 'ELES (indexelheto)' : 'PROBA (noindex)'}`);
