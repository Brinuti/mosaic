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

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ELES = process.env.ELES === '1';

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const LAP_A = path.join(DIST, '_a'), LAP_M = path.join(DIST, '_m');
fs.mkdirSync(LAP_A, { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'klon')).filter((x) => x.endsWith('.html'))) fs.copyFileSync(path.join(ROOT, 'klon', f), path.join(LAP_A, f));
fs.cpSync(path.join(ROOT, 'klon', 'm'), LAP_M, { recursive: true });
// a nyitooldal a /_a/fooldal, /_m/fooldal fajlbol jon (lasd netlify/lib/utvonal.js)
for (const m of [LAP_A, LAP_M]) fs.renameSync(path.join(m, 'index.html'), path.join(m, 'fooldal.html'));
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
// Mobilkepek (assets/img/m/, tools/mobil-kepek.py): ami ott nincs (mar eleve kicsi),
// azt valtozatlanul bemasoljuk, igy a mobil oldal minden kepe megvan az m/ mappaban is.
const IMG = path.join(DIST, 'assets', 'img'), IMG_M = path.join(IMG, 'm');
fs.mkdirSync(IMG_M, { recursive: true });
for (const f of fs.readdirSync(IMG)) {
  if (fs.statSync(path.join(IMG, f)).isFile() && !fs.existsSync(path.join(IMG_M, f))) fs.copyFileSync(path.join(IMG, f), path.join(IMG_M, f));
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
  // A szkripteket es stilusokat mindig ujraellenorzi a bongeszo (kulonben egy
  // javitas napokig nem latszana).
  '/assets/js/*',
  '  Cache-Control: public, max-age=0, must-revalidate',
  '/assets/css/*',
  '  Cache-Control: public, max-age=0, must-revalidate',
  // a kepek, videok es betuk neve a Wix-azonosito (nem valtozik), ezert egy evig maradhatnak
  '/assets/img/*',
  '  Cache-Control: public, max-age=31536000',
  '/assets/video/*',
  '  Cache-Control: public, max-age=31536000',
  '/assets/fonts/*',
  '  Cache-Control: public, max-age=31536000',
  // a HTML-beagyazasok (GYIK, arlistak) csak keretben jelennek meg, onalloan ne indexelodjenek
  '/assets/embed/*',
  '  X-Robots-Tag: noindex',
  '',
].join('\n'));

// Verziojel a sajat szkriptek es stilusok hivatkozasaira (?v=<tartalom-hash>):
// igy egy javitas azonnal eler minden latogatot, akkor is, ha a bongeszo meg
// egy regebbi valtozatot tarol.
const SAJAT = ['assets/js/klon.js', 'assets/js/suti.js', 'assets/js/galeriak.js', 'assets/js/gyik.js', 'assets/js/arlistak.js', 'assets/js/oldaltablak.js', 'assets/css/klon.css'];
// Oldalankenti LCP-kep (a legnagyobb tartalmi elem), egyszer bongeszovel lemerve:
// tools/lcp-elofeltoltes.json ({ mobil: { lap: kep }, asztali: {...} }). Elotoltjuk, es nem lusta.
const LCP = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/lcp-elofeltoltes.json'), 'utf8'));
const verzio = Object.fromEntries(SAJAT.map((f) => [f,
  crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 10)]));
for (const mappa of [LAP_A, LAP_M]) {
  for (const f of fs.readdirSync(mappa).filter((x) => x.endsWith('.html'))) {
    const p = path.join(mappa, f);
    let h = fs.readFileSync(p, 'utf8');
    for (const [fajl, v] of Object.entries(verzio)) h = h.split(fajl + '"').join(fajl + '?v=' + v + '"');
    // A tisztan adatot tarolo szkriptek (window.MH_* = {...}) ne blokkoljak a megjelenitest:
    // defer-rel a klon.js elott, sorrendben futnak (az is defer).
    h = h.replace(/<script src="([^"]*assets\/js\/(?:galeriak|gyik|arlistak|oldaltablak)\.js[^"]*)"><\/script>/g, '<script src="$1" defer></script>');
    // Lusta kepbetoltes: a Wix a kepernyo tetejen levo kepeket fetchpriority="high"-jal vagy
    // loading="eager"-rel jelolte, a tobbit loading="lazy"-vel - az atalakitas utan jelolet
    // nelkul maradt kepek ezert mind azonnal letoltodtek. Ezekre lazy kerul, kiveve az elso
    // kettot (asztalin ezek kozt van a legnagyobb tartalmi elem).
    let jeloletlen = 0;
    h = h.replace(/<img\b(?![^>]*\b(?:loading|fetchpriority)=)/g, (m) => (++jeloletlen <= 2 ? m : '<img loading="lazy" decoding="async"'));
    const lcp = LCP[mappa === LAP_M ? 'mobil' : 'asztali'][f.replace(/\.html$/, '')];
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
