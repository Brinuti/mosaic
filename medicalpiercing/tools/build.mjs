// A publikalhato oldal osszerakasa a dist/ mappaba (Cloudflare Pages build-parancs).
//
//   node tools/build.mjs
//
// dist/_a/<fajl>.html   asztali lapok (klon/)
// dist/_m/<fajl>.html   mobil lapok (klon/m/)
// dist/assets/          kepek, betuk, stilusok, szkriptek
// dist/sitemap.xml, robots.txt, 404.html, _routes.json, _headers
// A kitelepulesek idopontjai a tablazatbol kerulnek a lapokra (lib/kitelepulesek.js).
// A cimek kiszolgalasat a functions/[[path]].js vegzi (lib/utvonal.js).
import fs from 'node:fs';
import path from 'node:path';
import { oldalak, mindenOldal } from './oldalak.mjs';
import { fajlnev } from '../lib/utvonal.js';
import { TABLAZAT_CSV, osszesSor, htmlFrissites } from '../lib/kitelepulesek.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DOMAIN = 'https://www.medicalpiercing.hu';

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

let db = 0;
for (const o of mindenOldal()) {
  for (const [be, ki] of [['klon', '_a'], ['klon/m', '_m']]) {
    const forras = path.join(ROOT, be, o.kulcs + '.html');
    if (!fs.existsSync(forras)) { console.warn('  ! hianyzik: ' + path.relative(ROOT, forras)); continue; }
    const cel = path.join(DIST, ki, fajlnev(o.kulcs) + '.html');
    fs.mkdirSync(path.dirname(cel), { recursive: true });
    fs.copyFileSync(forras, cel);
    db++;
  }
}
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });

// kitelepulesek: a videki helyszinek idopontjai a tablazatbol. Ha a tablazat nem erheto el, a
// mentett idopontok maradnak (futas kozben a lapok az /api/kitelepulesek-bol ugyis frissulnek).
{
  let sorok = {}, hibak = [], olvasva = false;
  try {
    const v = await fetch(TABLAZAT_CSV, { signal: AbortSignal.timeout(20000) });
    if (!v.ok) throw new Error('HTTP ' + v.status);
    ({ sorok, hibak } = osszesSor(await v.text()));
    olvasva = true;
  } catch (e) {
    console.warn(`  ! kitelepulesek: a tablazat nem olvashato (${e.message}), a mentett idopontok maradnak`);
  }
  // a datumblokkok jelolest kapnak akkor is, ha a tablazat most nem volt olvashato
  let lapDb = 0;
  for (const o of mindenOldal()) for (const ki of ['_a', '_m']) {
    const f = path.join(DIST, ki, fajlnev(o.kulcs) + '.html');
    if (!fs.existsSync(f)) continue;
    const r = htmlFrissites(fs.readFileSync(f, 'utf8'), sorok, o.ut);
    if (r.db) { fs.writeFileSync(f, r.html); lapDb++; }
  }
  console.log(`kitelepulesek: ${lapDb} lapon ${olvasva ? 'a tablazatbol frissitve' : 'csak jelolve'}` + (hibak.length ? `; nem ertelmezheto cellak:\n  ${hibak.join('\n  ')}` : ''));
}
// a Wix 404-es oldala (tools/oldalak.mjs NEMTALALT)
if (fs.existsSync(path.join(ROOT, 'klon/404.html'))) fs.copyFileSync(path.join(ROOT, 'klon/404.html'), path.join(DIST, '404.html'));

// sitemap: a Wix sitemapjeiben szereplo oldalak (a rejtett, bejarassal talalt oldalak nem)
const sitemapben = new Set(fs.readFileSync(path.join(ROOT, 'tools/sitemap-oldalak.txt'), 'utf8').split('\n').filter(Boolean));
const ma = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + oldalak().filter((o) => sitemapben.has(o.url)).map((o) => `<url><loc>${o.url}</loc><lastmod>${ma}</lastmod></url>`).join('\n')
  + '\n</urlset>\n');
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}/sitemap.xml\n`);
// a fuggveny csak a lapcimekre fusson, a fajlok kozvetlenul jojjenek
fs.writeFileSync(path.join(DIST, '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: ['/assets/*', '/sitemap.xml'] }, null, 2));
fs.writeFileSync(path.join(DIST, '_headers'), [
  '/assets/img/*', '  Cache-Control: public, max-age=2592000',
  '/assets/fonts/*', '  Cache-Control: public, max-age=31536000, immutable',
  '/assets/video/*', '  Cache-Control: public, max-age=2592000',
  '/assets/css/*', '  Cache-Control: public, max-age=3600',
  '/assets/js/*', '  Cache-Control: public, max-age=3600',
  '',
].join('\n'));
console.log(`dist/ kesz: ${db} lap (${oldalak().length} oldal x asztali/mobil)`);
