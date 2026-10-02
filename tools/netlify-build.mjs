// A publikalhato mappa (dist/) osszerakasa a klonbol.
//
// A klon oldalai a klon/ mappaban vannak, a kepek, betuk es videok viszont a
// projekt gyokereben, az assets/ alatt. A kiszolgalon a kettonek egymas mellett
// kell lennie, ezert egy friss dist/ mappaba masoljuk:
//
//   dist/_a/*.html     <- klon/*.html      (asztali)
//   dist/_m/*.html     <- klon/m/*.html    (mobil)
//
// A latogato ezeket nem kozvetlenul eri el: a netlify/edge-functions/oldal.js a
// Wix-szel azonos, kiterjesztes nelkuli cimen (pl. /headspa-budapest) adja a
// bongeszonek megfelelo valtozatot.
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
import crypto from 'node:crypto';
import { ritkit } from './css-ritkitas.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ELES = process.env.ELES === '1';

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const LAP_A = path.join(DIST, '_a'), LAP_M = path.join(DIST, '_m');
fs.mkdirSync(LAP_A, { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'klon')).filter((x) => x.endsWith('.html'))) fs.copyFileSync(path.join(ROOT, 'klon', f), path.join(LAP_A, f));
fs.cpSync(path.join(ROOT, 'klon', 'm'), LAP_M, { recursive: true });
// Sajat (nem a Wixrol mentett) oldalak, pl. a foglalo proba (/foglalo-proba): egy reszponziv
// fajl, ugyanaz megy az asztali es a mobil mappaba is. Linket nem kapnak, noindex-esek.
// A <!--mh-fejlec--> jelolo helyere a MOSAIC oldal fejlece kerul (tools/fejlec-kivonat.mjs):
// az asztali mappaba az asztali, a mobilba a mobil valtozat - pontosan ugyanaz, mint a tobbi oldalon.
const FEJLEC = { [LAP_A]: 'asztali', [LAP_M]: 'mobil' };
for (const f of fs.readdirSync(path.join(ROOT, 'foglalas')).filter((x) => x.endsWith('.html'))) {
  const forras = fs.readFileSync(path.join(ROOT, 'foglalas', f), 'utf8');
  for (const m of [LAP_A, LAP_M]) {
    const fejlec = forras.includes('<!--mh-fejlec-->') ? fs.readFileSync(path.join(ROOT, 'assets/fejlec', FEJLEC[m] + '.html'), 'utf8') : '';
    fs.writeFileSync(path.join(m, f), forras.replace('<!--mh-fejlec-->', () => fejlec));
  }
}
// a nyitooldal a /_a/fooldal, /_m/fooldal fajlbol jon (lasd netlify/lib/utvonal.js)
for (const m of [LAP_A, LAP_M]) fs.renameSync(path.join(m, 'index.html'), path.join(m, 'fooldal.html'));
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
// a Salonic foglalo oldalainak egyedi CSS-e (a Salonic "Egyedi CSS URL" beallitasa tolti be)
fs.cpSync(path.join(ROOT, 'salonic'), path.join(DIST, 'salonic'), { recursive: true });
// Mobilkepek (assets/img/m/, tools/mobil-kepek.py): ami ott nincs (mar eleve kicsi),
// azt valtozatlanul bemasoljuk, igy a mobil oldal minden kepe megvan az m/ mappaban is.
const IMG = path.join(DIST, 'assets', 'img'), IMG_M = path.join(IMG, 'm');
fs.mkdirSync(IMG_M, { recursive: true });
for (const f of fs.readdirSync(IMG)) {
  if (f === 'm' || fs.existsSync(path.join(IMG_M, f))) continue;
  // az almappak (pl. pmu/) is: a mobil oldalakon minden kephivatkozas az m/ ala mutat
  if (fs.statSync(path.join(IMG, f)).isDirectory()) fs.cpSync(path.join(IMG, f), path.join(IMG_M, f), { recursive: true });
  else fs.copyFileSync(path.join(IMG, f), path.join(IMG_M, f));
}
// sitemap es robots.txt: elesben a Wix mostani fajljai szo szerint (tools/wix-sitemap/),
// hogy a keresok ugyanazt a cimlistat lassak; a probaoldalon mindent tiltunk.
const SITEMAP = path.join(ROOT, 'tools', 'wix-sitemap');
for (const f of fs.readdirSync(SITEMAP).filter((x) => x.endsWith('.xml'))) fs.copyFileSync(path.join(SITEMAP, f), path.join(DIST, f));
fs.writeFileSync(path.join(DIST, 'robots.txt'), ELES
  ? fs.readFileSync(path.join(SITEMAP, 'robots.txt'), 'utf8')
  : 'User-agent: *\nDisallow: /\n');

// A regi /post/ cimeket es a mobil/asztali valasztast a netlify/edge-functions
// intezi (utvonal.js) - kulon atiranyitasi szabaly nem kell.
fs.writeFileSync(path.join(DIST, '_redirects'), '');

fs.writeFileSync(path.join(DIST, '_headers'), [
  '/*',
  ...(ELES ? [] : ['  X-Robots-Tag: noindex, nofollow']),
  // A szkriptekre az oldalak mindig tartalom-hash verziojellel (?v=...) hivatkoznak, igy
  // egy javitas uj cimet kap - a bongeszo nyugodtan tarolhatja oket egy evig.
  '/assets/js/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  '/assets/css/*',
  '  Cache-Control: public, max-age=31536000, immutable',
  // a kepek, videok es betuk neve a Wix-azonosito (nem valtozik), ezert egy evig maradhatnak
  '/assets/img/*',
  '  Cache-Control: public, max-age=31536000',
  '/assets/video/*',
  '  Cache-Control: public, max-age=31536000',
  '/assets/fonts/*',
  '  Cache-Control: public, max-age=31536000',
  // a Salonic oldalan (salonic/pmu.css) is ezeket a betuket hasznaljuk - mas domainrol csak igy toltodnek
  '  Access-Control-Allow-Origin: *',
  // a Salonic-CSS-t (salonic/) verziojel nelkul toltik be: mindig ujraellenorizze a bongeszo,
  // kulonben egy javitas nem latszana azonnal (a valtozatlan fajlt 304-gyel, gyorsan kapja meg)
  '/salonic/*',
  '  Cache-Control: public, max-age=0, must-revalidate',
  '  Access-Control-Allow-Origin: *',
  // a HTML-beagyazasok (GYIK, arlistak) csak keretben jelennek meg, onalloan ne indexelodjenek
  '/assets/embed/*',
  '  X-Robots-Tag: noindex',
  '',
].join('\n'));

// Verziojel a sajat szkriptek es stilusok hivatkozasaira (?v=<tartalom-hash>):
// igy egy javitas azonnal eler minden latogatot, akkor is, ha a bongeszo meg
// egy regebbi valtozatot tarol.
const SAJAT = ['assets/js/klon.js', 'assets/js/suti.js', 'assets/js/galeriak.js', 'assets/js/gyik.js', 'assets/js/arlistak.js', 'assets/js/oldaltablak.js', 'assets/js/foglalo.js', 'assets/js/foglalo-pmu.js', 'assets/css/klon.css'];
// Oldalankenti LCP-kep (a legnagyobb tartalmi elem), egyszer bongeszovel lemerve:
// tools/lcp-elofeltoltes.json ({ mobil: { lap: kep }, asztali: {...} }). Elotoltjuk, es nem lusta.
const LCP = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/lcp-elofeltoltes.json'), 'utf8'));
// Kattintasra indulo videok poszterei (klon.js KATTINTOS + oldaltablak.js): a build eleve
// beirja a poszterkepet es a lejatszo gombot, igy az elso kirajzolaskor latszik (mobilon ez a
// legnagyobb tartalmi elem); a klon.js csak a kattintast koti ra.
const klonForras = fs.readFileSync(path.join(ROOT, 'assets/js/klon.js'), 'utf8');
const kattintosBlokk = klonForras.slice(klonForras.indexOf('const KATTINTOS = {'), klonForras.indexOf('};', klonForras.indexOf('const KATTINTOS = {')));
const KATTINTOS = Object.fromEntries([...kattintosBlokk.matchAll(/'(comp-[a-z0-9]+)': '([^']+)'/g)].map((m) => [m[1], m[2]]));
{
  const t = fs.readFileSync(path.join(ROOT, 'assets/js/oldaltablak.js'), 'utf8');
  Object.assign(KATTINTOS, JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)).kattintos || {});
}
const LEJATSZO_GOMB = '<button type="button" class="mh-video-gomb" aria-label="Videó lejátszása"><svg viewBox="0 0 40 40" width="50" height="50" fill="currentColor" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="rgba(0,0,0,.35)" stroke="currentColor" stroke-width="2"/><path d="M16 12.5v15l12-7.5z"/></svg></button>';
// A sajat szkriptek szovege: a CSS-ritkitas ezekben is keresi az osztalyneveket (amit a
// klon.js futas kozben tesz ki, annak a stilusa is maradjon meg).
const SAJAT_JS = fs.readdirSync(path.join(ROOT, 'assets/js')).filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8')).join('\n');
// A harom kis stiluslap (betuk + klon.css) beagyazva: kulon letoltesre varva blokkolnak
// az elso megjelenitest. A relativ betu-hivatkozasokat abszolutra irjuk.
const BEAGYAZOTT = ['wix-google-fonts.css', 'wix-fonts.css', 'klon.css'].map((f) => [f,
  fs.readFileSync(path.join(ROOT, 'assets/css', f), 'utf8').replace(/url\((['"]?)\.\.\/fonts\//g, 'url($1/assets/fonts/')]);
const verzio = Object.fromEntries(SAJAT.map((f) => [f,
  crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 10)]));
for (const mappa of [LAP_A, LAP_M]) {
  for (const f of fs.readdirSync(mappa).filter((x) => x.endsWith('.html'))) {
    const p = path.join(mappa, f);
    let h = ritkit(fs.readFileSync(p, 'utf8'), SAJAT_JS);
    for (const [fajl, css] of BEAGYAZOTT) {
      let elso = true;
      h = h.replace(new RegExp('<link rel="stylesheet" href="/assets/css/' + fajl.replace('.', '\\.') + '">', 'g'),
        () => (elso ? (elso = false, '<style data-forras="' + fajl + '">' + css + '</style>') : ''));
    }
    for (const [fajl, v] of Object.entries(verzio)) h = h.split(fajl + '"').join(fajl + '?v=' + v + '"');
    // A tisztan adatot tarolo szkriptek (window.MH_* = {...}) ne blokkoljak a megjelenitest:
    // defer-rel a klon.js elott, sorrendben futnak (az is defer).
    // A suti.js (hozzajarulas + meresi kodok) is defer: sorrendben a klon.js elott fut, a
    // savot amugy is DOMContentLoaded-kor rajzolja, a GTM-et pedig o maga tolti be aszinkron.
    h = h.replace(/<script src="([^"]*assets\/js\/(?:galeriak|gyik|arlistak|oldaltablak|suti)\.js[^"]*)"><\/script>/g, '<script src="$1" defer></script>');
    // Lusta kepbetoltes: a Wix a kepernyo tetejen levo kepeket fetchpriority="high"-jal vagy
    // loading="eager"-rel jelolte, a tobbit loading="lazy"-vel - az atalakitas utan jelolet
    // nelkul maradt kepek ezert mind azonnal letoltodtek. Ezekre lazy kerul, kiveve az elso
    // kettot (asztalin ezek kozt van a legnagyobb tartalmi elem).
    let jeloletlen = 0;
    h = h.replace(/<img\b(?![^>]*\b(?:loading|fetchpriority)=)/g, (m) => (++jeloletlen <= 2 ? m : '<img loading="lazy" decoding="async"'));
    const lcp = LCP[mappa === LAP_M ? 'mobil' : 'asztali'][f.replace(/\.html$/, '')];
    for (const [azon, ertek] of Object.entries(KATTINTOS)) {
      const [azonosito, kocka, mod] = ertek.split('/');
      if (mod === 'auto' && mappa === LAP_A) continue; // asztalin magatol indulo video (klon.js)
      const poszter = '/assets/img/' + azonosito + kocka + '.jpg';
      const betolt = poszter === lcp ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
      h = h.replace(new RegExp('(<div id="' + azon + '"[^>]*>)(</div>)'),
        '$1<div class="mh-video"><img ' + betolt + ' src="' + poszter + '" alt="">' + LEJATSZO_GOMB + '</div>$2');
    }
    if (lcp) {
      h = h.replace(/<head>/i, '<head><link rel="preload" as="image" href="' + encodeURI(lcp) + '" fetchpriority="high">');
      h = h.split('<img loading="lazy" decoding="async" src="' + lcp + '"').join('<img fetchpriority="high" src="' + lcp + '"');
    }
    // mobilon a kisebb kepvaltozatok (a teljes URL-ek - og:image, JSON-LD - maradnak)
    if (mappa === LAP_M) h = h.replace(/(["'(\s,])\/assets\/img\/(?!m\/)/g, '$1/assets/img/m/');
    fs.writeFileSync(p, h);
  }
}

const html = fs.readdirSync(LAP_A).filter((f) => f.endsWith('.html')).length;
const mobil = fs.readdirSync(LAP_M).filter((f) => f.endsWith('.html')).length;
console.log(`dist/ kesz: ${html} asztali + ${mobil} mobil oldal, ${ELES ? 'ELES (indexelheto)' : 'PROBA (noindex)'}`);
