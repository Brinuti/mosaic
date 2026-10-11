// A publikalhato oldal osszerakasa a dist/ mappaba (Cloudflare Pages build-parancs).
//
//   node tools/build.mjs
//
// dist/_a/<fajl>.html   asztali lapok (klon/)
// dist/_m/<fajl>.html   mobil lapok (klon/m/)
// dist/assets/          kepek, betuk, stilusok, szkriptek
// dist/sitemap.xml, robots.txt, blog-feed.xml, 404.html, _routes.json, _headers
// A kitelepulesek idopontjai a tablazatbol kerulnek a lapokra (lib/kitelepulesek.js).
// A cimek kiszolgalasat a functions/[[path]].js vegzi (lib/utvonal.js).
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { oldalak, mindenOldal } from './oldalak.mjs';
import { fajlnev } from '../lib/utvonal.js';
import { TABLAZAT_CSV, osszesSor, htmlFrissites } from '../lib/kitelepulesek.js';
import { takarit } from './takaritas.mjs';
import { gyorsit } from './gyorsitas.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DOMAIN = 'https://www.medicalpiercing.hu';

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// az elso kepernyo kepei es betui oldalankent (tools/hajtas-meres.mjs; tools/gyorsitas.mjs)
const HAJTAS = fs.existsSync(path.join(ROOT, 'tools/hajtas.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/hajtas.json'), 'utf8')) : {};
let db = 0;
for (const o of mindenOldal()) {
  for (const [be, ki] of [['klon', '_a'], ['klon/m', '_m']]) {
    const forras = path.join(ROOT, be, o.kulcs + '.html');
    if (!fs.existsSync(forras)) { console.warn('  ! hianyzik: ' + path.relative(ROOT, forras)); continue; }
    const cel = path.join(DIST, ki, fajlnev(o.kulcs) + '.html');
    fs.mkdirSync(path.dirname(cel), { recursive: true });
    // a Wixtol orokolt, semmire nem hasznalt kod nelkul (tools/takaritas.mjs), gyorsabb
    // betoltesi sorrenddel (tools/gyorsitas.mjs)
    fs.writeFileSync(cel, gyorsit(takarit(fs.readFileSync(forras, 'utf8')), (HAJTAS[o.kulcs] || {})[ki === '_a' ? 'a' : 'm']));
    db++;
  }
}
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
// foglalomotor (assets/js/motor/, assets/js/motor-indito.js; MP-FOGLALOMOTOR-FELADAT): az indito minden lapra kerul, a
// kapcsolo (motor-kapcsolo.json: 0 = mindenki a regi Salonic-foglalot kapja, 100 = a motor nyilik) az inditoba irodik.
// A motor moduljai egymast verziojellel importaljak (?v=<a modulok tartalmanak jele>): egy evig tarolhatok (_headers),
// es egy javitas utan a bongeszo az uj modult keri.
{
  const MAPPA = path.join(DIST, 'assets/js/motor');
  const modulok = fs.readdirSync(MAPPA).filter((f) => f.endsWith('.js')).sort();
  const h = crypto.createHash('sha256');
  for (const f of modulok) h.update(fs.readFileSync(path.join(MAPPA, f)));
  const mv = h.digest('hex').slice(0, 10);
  for (const f of modulok) {
    const fajl = path.join(MAPPA, f);
    fs.writeFileSync(fajl, fs.readFileSync(fajl, 'utf8').replace(/(from\s+'\.\/[\w-]+\.js)'/g, `$1?v=${mv}'`));
  }
  const kapcsolo = JSON.parse(fs.readFileSync(path.join(ROOT, 'motor-kapcsolo.json'), 'utf8')).arany === 100 ? 100 : 0;
  const indito = path.join(DIST, 'assets/js/motor-indito.js');
  fs.writeFileSync(indito, fs.readFileSync(indito, 'utf8').replace('__MOTOR_KAPCSOLO__', String(kapcsolo)).replace('__MOTOR_VERZIO__', mv));
  let n = 0;
  for (const ki of ['_a', '_m']) for (const f of fs.readdirSync(path.join(DIST, ki), { recursive: true }).filter((x) => x.endsWith('.html'))) {
    const fajl = path.join(DIST, ki, f);
    const html = fs.readFileSync(fajl, 'utf8');
    if (html.includes('/assets/js/motor-indito.js') || !/<\/body>/i.test(html)) continue;
    fs.writeFileSync(fajl, html.replace(/<\/body>/i, '<script src="/assets/js/motor-indito.js" defer></script>\n</body>'));
    n++;
  }
  console.log(`foglalomotor: kapcsolo ${kapcsolo}%, ${modulok.length} modul (?v=${mv}), indito ${n} lapon`);
}

// a Wix 404-es oldala (tools/oldalak.mjs NEMTALALT)
if (fs.existsSync(path.join(ROOT, 'klon/404.html'))) fs.writeFileSync(path.join(DIST, '404.html'), gyorsit(takarit(fs.readFileSync(path.join(ROOT, 'klon/404.html'), 'utf8')), (HAJTAS['404'] || {}).a));

// a sajat stilusok es szkriptek verziojelet kapnak (?v=<tartalom-hash>): a bongeszo egy evig
// tarolja oket (_headers), es egy uj kiadas utan az uj jel miatt azonnal az uj fajlt keri. A
// klon.js a sajat ?v= jelet adja tovabb a felugro ablak stilusanak (assets/css/wix/felugro.css).
{
  const SAJAT = ['assets/css/klon.css', 'assets/css/wix-fonts.css', 'assets/css/wix-google-fonts.css', 'assets/js/klon.js', 'assets/js/suti.js', 'assets/css/wix/felugro.css'];
  const h = crypto.createHash('sha256');
  for (const f of SAJAT) h.update(fs.readFileSync(path.join(DIST, f)));
  const v = h.digest('hex').slice(0, 10);
  const minta = new RegExp(`((?:href|src)="/(?:${SAJAT.map((f) => f.replace(/[.]/g, '\\.')).join('|')}))"`, 'g');
  for (const ki of ['_a', '_m']) {
    for (const f of fs.readdirSync(path.join(DIST, ki), { recursive: true }).filter((x) => x.endsWith('.html'))) {
      const fajl = path.join(DIST, ki, f);
      fs.writeFileSync(fajl, fs.readFileSync(fajl, 'utf8').replace(minta, `$1?v=${v}"`));
    }
  }
  if (fs.existsSync(path.join(DIST, '404.html'))) fs.writeFileSync(path.join(DIST, '404.html'), fs.readFileSync(path.join(DIST, '404.html'), 'utf8').replace(minta, `$1?v=${v}"`));
  console.log(`verziojel: ?v=${v}`);
}

// sajat foglalas-meres (assets/js/mp-meres.js, docs/MERES_GOOGLE_ARNYEK.md): minden lap <head>-jebe, verziojellel
{
  const v = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIST, 'assets/js/mp-meres.js'))).digest('hex').slice(0, 10);
  const cimke = `<script src="/assets/js/mp-meres.js?v=${v}" defer></script>`;
  let n = 0;
  const lapok = ['_a', '_m'].flatMap((ki) => fs.readdirSync(path.join(DIST, ki), { recursive: true }).filter((x) => x.endsWith('.html')).map((f) => path.join(DIST, ki, f)));
  for (const fajl of lapok) {
    const html = fs.readFileSync(fajl, 'utf8');
    if (!html.includes('</head>') || html.includes('/assets/js/mp-meres.js')) continue;
    fs.writeFileSync(fajl, html.replace('</head>', cimke + '</head>'));
    n++;
  }
  console.log(`mp-meres: ${n} lapon`);
}

// #257: a koszonooldalak (foglalas-ok*, fulbevalo-ok*) lapcime semleges: a "foglalas-ok-klimax | Medical Piercing" tipusu cim
// a GA4 / Google Ads / TikTok fele (oldalcim) egeszsegugyi jellegu szolgaltatasra utalna. A suti.js futas kozben is atirja.
{
  const SEMLEGES = 'Sikeres foglalás | Medical Piercing';
  let n = 0;
  for (const ki of ['_a', '_m']) for (const f of fs.readdirSync(path.join(DIST, ki)).filter((x) => /^(foglalas-ok|fulbevalo-ok)[a-z0-9-]*\.html$/.test(x))) {
    const fajl = path.join(DIST, ki, f);
    const html = fs.readFileSync(fajl, 'utf8');
    const uj = html.replace(/<title>[^<]*<\/title>/, `<title>${SEMLEGES}</title>`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/g, `$1${SEMLEGES}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/g, `$1${SEMLEGES}$2`)
      .replace(/https:\/\/www\.medicalpiercing\.hu\/(foglalas-ok|fulbevalo-ok)[a-z0-9-]*/g, 'https://www.medicalpiercing.hu/$1');
    if (uj !== html) { fs.writeFileSync(fajl, uj); n++; }
  }
  console.log(`koszonooldal-cim semleges: ${n} lapon`);
}

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

// a tobbi stilus es szkript (a Wix mentett CSS-fajljai) fajlonkent a sajat tartalmanak jelet kapja
// (?v=<hash>), igy ezek is egy evig tarolhatok (_headers)
{
  const jelek = new Map();
  const jel = (f) => {
    if (!jelek.has(f)) jelek.set(f, fs.existsSync(path.join(DIST, f)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(DIST, f))).digest('hex').slice(0, 10) : null);
    return jelek.get(f);
  };
  const tobbi = /((?:href|src)="\/(assets\/(?:css|js)\/[^"?#]+\.(?:css|js)))"/g;
  const lapok = ['404.html', ...['_a', '_m'].flatMap((ki) => fs.readdirSync(path.join(DIST, ki), { recursive: true }).filter((x) => x.endsWith('.html')).map((x) => path.join(ki, x)))];
  for (const l of lapok) {
    const fajl = path.join(DIST, l);
    if (!fs.existsSync(fajl)) continue;
    const r = fs.readFileSync(fajl, 'utf8');
    const u = r.replace(tobbi, (m, eleje, f) => (jel(f) ? `${eleje}?v=${jel(f)}"` : m));
    if (u !== r) fs.writeFileSync(fajl, u);
  }
  console.log(`verziojel: +${[...jelek.values()].filter(Boolean).length} Wix-stilus sajat jellel`);
}

// sitemap: a Wix sitemapjeiben szereplo oldalak (a rejtett, bejarassal talalt oldalak nem)
const sitemapben = new Set(fs.readFileSync(path.join(ROOT, 'tools/sitemap-oldalak.txt'), 'utf8').split('\n').filter(Boolean));
const ma = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + oldalak().filter((o) => sitemapben.has(o.url)).map((o) => `<url><loc>${o.url}</loc><lastmod>${ma}</lastmod></url>`).join('\n')
  + '\n</urlset>\n');
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${DOMAIN}/sitemap.xml\n`);
// a blog RSS-csatornaja ugyanazon a cimen, mint a Wixen (tools/rss-mentes.mjs)
fs.copyFileSync(path.join(ROOT, 'assets/blog-feed.xml'), path.join(DIST, 'blog-feed.xml'));
// a fuggveny csak a lapcimekre fusson, a fajlok kozvetlenul jojjenek
fs.writeFileSync(path.join(DIST, '_routes.json'), JSON.stringify({ version: 1, include: ['/*'], exclude: ['/assets/*', '/sitemap.xml', '/blog-feed.xml'] }, null, 2));
fs.writeFileSync(path.join(DIST, '_headers'), [
  '/assets/img/*', '  Cache-Control: public, max-age=2592000',
  '/assets/fonts/*', '  Cache-Control: public, max-age=31536000, immutable',
  '/assets/video/*', '  Cache-Control: public, max-age=2592000',
  // minden hivatkozasuk ?v=<tartalom-jel>-lel megy (fent), igy egy evig tarolhatok
  '/assets/css/*', '  Cache-Control: public, max-age=31536000, immutable',
  '/assets/js/*', '  Cache-Control: public, max-age=31536000, immutable',
  // a Salonic adatlapjanak stiluslapja (a Salonic-fiok "Egyedi CSS URL"-je, verziojel nelkul): rovid ideig tarolhato
  '/assets/salonic/*', '  Cache-Control: public, max-age=600', '  Access-Control-Allow-Origin: *',
  '',
].join('\n'));
console.log(`dist/ kesz: ${db} lap (${oldalak().length} oldal x asztali/mobil)`);
