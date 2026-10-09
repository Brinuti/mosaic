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
import { pathToFileURL } from 'node:url';
import { ritkit } from './css-ritkitas.mjs';
import { atkot, atkotBelso, atkotSzoveg, kapcsolokBuildhez, kihagyottOldal, osszead, uresOldal, KAPCSOLOK } from './foglalo-atkotes.mjs';
import { popupAtkot } from './halott-popup.mjs';
import { fejlecAtalakit, ANGOL_JELOLO, headspaJelolo } from './fejlec-menu.mjs';
import { personaOldal } from './ajandek-variansok/elore-render.mjs';
import { CSP_CRM } from '../crm/lib/http.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
// Cloudflare Pages-en a main ag buildje az eles (a *.pages.dev cimeken a functions/[[path]].js ad noindexet)
const ELES = process.env.ELES === '1' || (process.env.CF_PAGES === '1' && process.env.CF_PAGES_BRANCH === 'main');
// A Salonic foglalo-linkek atkotese a kozos foglalora (/foglalo-motor), uzletagankent (tools/foglalo-atkotes.json): ami nincs bekapcsolva,
// ahhoz a build nem nyul, a kimenet bajtra azonos a mostanival.
const ATKOTES = kapcsolokBuildhez({ eles: ELES });
let atkotesDb = Object.fromEntries(KAPCSOLOK.map((k) => [k, 0]));

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
// Ugyanigy a <!--mh-lablec--> helyere a MOSAIC lablece.
const FEJLEC = { [LAP_A]: 'asztali', [LAP_M]: 'mobil' };
// A fejlec/lablec kozos finomitasa (mobil fejlec, akciosav, gomb, lablec): egy CSS-fajl, ket helyre kerul - a sajat oldalak fejlec-darabja moge itt,
// a Wixes (klon) oldalak beagyazott klon.css-e moge lent (BEAGYAZOTT).
const FEJLEC_CSS = fs.readFileSync(path.join(ROOT, 'assets/css/fejlec-lablec.css'), 'utf8');
// A fejlec kivonata a /sminktetovalas-budapest oldalrol keszult, ott a "Sminktetovalas" az aktiv (kijelolt) menupont. Az a sajat oldal, amelyik
// <!--mh-menu-aktiv:/utvonal--> jelolot tartalmaz, a sajat menupontjat kapja kijelolve (jelolo nelkul a fejlec valtozatlan marad).
const aktivMenu = (fejlec, utvonal, mobil) => {
  const ut = utvonal.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  if (!mobil) {
    return fejlec
      .replace(/ data-is-current="true" aria-current="true"/g, ' data-is-current="false" aria-current="false"')
      .replace(/ itemDepth02233374943--isCurrentPage/g, '')
      .replace(new RegExp(`( data-is-current=)"false"( aria-current=)"false"(><div class="itemShared2352141355__rootContainer(?: itemShared2352141355--isRow)?"><a data-item-label="true" data-testid="linkElement" href="${ut}" target="_self" class="itemDepth02233374943__root)`),
        '$1"true"$2"true"$3 itemDepth02233374943--isCurrentPage');
  }
  return fejlec
    .replace(/ aria-current="page"( class="[^"]*?) jqR3kU"/g, '$1"')
    .replace(new RegExp(`(<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\\d+") class="([^"]*)"(><div data-testid="itemWrapper" class="keDKhi"><span data-testid="linkWrapper" class="j945c8"><a data-testid="linkElement" href="${ut}")`),
      '$1 aria-current="page" class="$2 jqR3kU"$3');
};
for (const f of fs.readdirSync(path.join(ROOT, 'foglalas')).filter((x) => x.endsWith('.html'))) {
  const forras = fs.readFileSync(path.join(ROOT, 'foglalas', f), 'utf8');
  const aktiv = (forras.match(/<!--mh-menu-aktiv:([^>]+?)-->/) || [])[1];
  const angol = forras.includes(ANGOL_JELOLO);   // angol oldal: angol menucimkek / lablec (tools/fejlec-menu.mjs)
  for (const m of [LAP_A, LAP_M]) {
    const resz = (jel, fajl) => forras.includes(jel) ? fs.readFileSync(path.join(ROOT, 'assets/fejlec', fajl + '.html'), 'utf8') : '';
    let fejlec = fejlecAtalakit(resz('<!--mh-fejlec-->', FEJLEC[m]), m === LAP_M, angol); // az Ajandekkartya lenyilo, az onallo Paros Head Spa pont, az EN jelveny (tools/ajandek-menu.mjs, tools/fejlec-menu.mjs)
    if (aktiv && fejlec) fejlec = aktivMenu(fejlec, aktiv, m === LAP_M);
    let lablec = fejlecAtalakit(resz('<!--mh-lablec-->', 'lablec-' + FEJLEC[m]), m === LAP_M, angol);   // az uj lablec
    const kozosCss = '<style data-forras="fejlec-lablec">' + FEJLEC_CSS + '</style>';
    if (fejlec) fejlec += kozosCss; else if (lablec) lablec += kozosCss;
    fs.writeFileSync(path.join(m, f), forras.replace('<!--mh-fejlec-->', () => fejlec).replace('<!--mh-lablec-->', () => lablec));
  }
}
// Az ELES ajandekkartya-oldalak cimeit az uj ajandekkartya-motor veszi at (a tulajdonos kerese, 2026-10-04): ugyanaz az oldal (foglalas/ajandek.html)
// ezeken a cimeken is megjelenik (a cim dönti el a variantot: assets/js/ajandek-adat.js OLDAL_ALAPERTEK), indexelheto, sajat canonical-lal.
// A regi (Wixes) oldal valtozatlanul megvan a klon/ mappaban; itt kulon, REJTETT cimen is elerheto (-regi: noindex, nincs link ra, nincs a
// sitemapben) - visszaallashoz es osszehasonlitashoz. Az /ajandek cim marad (noindex): a levelekben / kampanyokban levo linkek tovabb mukodnek.
const REGI_AJANDEK_CIMEK = ['headspa-ajandekkartya', '4-kezes-headspa-ajandekkartya', 'ajandekkartya-szulinapra', 'ajandekkartya-ugc',
  'headspa-ajandekkartya-anyukaknak', 'headspa-ajandekkartya-noknek', 'headspa-paros-csajos-ajandekkartya', 'japan-headspa-ajandekkartya',
  // 2026-10-09 (a tulajdonos kerese): a harom korabbi hirdetesi oldal (ezo, self-care, fiataloknak) is az uj formatumot kapja; a regi peldany a "-regi" cimen megmarad
  'headspa-ajándékkártya-ezo', 'headspa-self-care', 'headspa-ajandakkartya-fiataloknak'].map((n) => n.normalize('NFC'));
// Ezek a hirdetesi oldalak a regi (Wixes) alakjukban is noindex-ek voltak (es nincsenek a sitemapben): az uj formatumban is azok maradnak
// (a tobbi cim a korabbi dontes szerint indexelheto). A canonical mindegyiknek onmaga.
const NOINDEX_AJANDEK_CIMEK = new Set(['headspa-ajándékkártya-ezo', 'headspa-self-care', 'headspa-ajandakkartya-fiataloknak'].map((n) => n.normalize('NFC')));
// A persona-oldalak hero-szoveget / -kepet / magyarazo-szekciojat a build elore beirja a HTML-be (nem az altalanos oldal villan fel a JS lefutasaig)
await import(pathToFileURL(path.join(ROOT, 'assets/js/ajandek-adat.js')).href);
const AJANDEK_ADAT = globalThis.AJANDEK_ADAT;
for (const m of [LAP_A, LAP_M]) {
  const uj = fs.readFileSync(path.join(m, 'ajandek.html'), 'utf8');
  for (const nev of REGI_AJANDEK_CIMEK) {
    const regiFajl = path.join(m, nev + '.html');
    if (fs.existsSync(regiFajl)) {
      const regiCim = 'https://www.mosaicheadspa.hu/' + encodeURI(nev) + '-regi';
      let r = fs.readFileSync(regiFajl, 'utf8');
      r = r.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, '<link rel="canonical" href="' + regiCim + '">')
        .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/i, '<meta property="og:url" content="' + regiCim + '">')
        .replace(/<head>/i, '<head><meta name="robots" content="noindex, nofollow">');
      fs.writeFileSync(path.join(m, nev + '-regi.html'), r);
    }
    const cim = 'https://www.mosaicheadspa.hu/' + encodeURI(nev);
    fs.writeFileSync(regiFajl, personaOldal(uj, nev, AJANDEK_ADAT)
      .replace(/<meta name="robots" content="[^"]*">\s*/i, NOINDEX_AJANDEK_CIMEK.has(nev) ? '<meta name="robots" content="noindex, nofollow">\n' : '')
      .replace('<link rel="canonical" href="https://www.mosaicheadspa.hu/ajandek">', '<link rel="canonical" href="' + cim + '">')
      .replace('<meta property="og:url" content="https://www.mosaicheadspa.hu/ajandek">', '<meta property="og:url" content="' + cim + '">'));
  }
}
// a nyitooldal a /_a/fooldal, /_m/fooldal fajlbol jon (lasd netlify/lib/utvonal.js)
for (const m of [LAP_A, LAP_M]) fs.renameSync(path.join(m, 'index.html'), path.join(m, 'fooldal.html'));
fs.cpSync(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });
// Apple Pay: a Stripe nyilvanos domain-ellenorzo fajlja (https://stripe.com/files/apple-pay/apple-developer-merchantid-domain-association,
// ugyanaz minden Stripe-kereskedonek) a /.well-known/ alatt, statikusan (nincs fuggvenyhivas). A domain regisztralasa a Stripe-ban (Payment method domains).
fs.cpSync(path.join(ROOT, 'well-known'), path.join(DIST, '.well-known'), { recursive: true });
// a Salonic foglalo oldalainak egyedi CSS-e (a Salonic "Egyedi CSS URL" beallitasa tolti be)
fs.cpSync(path.join(ROOT, 'salonic'), path.join(DIST, 'salonic'), { recursive: true });
// A foglalo (assets/js/booking-engine/**) moduljai egymast verziojel nelkul importaljak, a /assets/js/* viszont egy evig tarolhato
// (immutable): egy motor-javitas nem jutna el a mar betoltott bongeszokhoz (a tobbi sajat szkript az oldalakban kap ?v= jelet, ezek nem).
// A modulok tartalom-hash-eibol egy kozos verziojelet szamolunk, es beirjuk a modulok egymasra hivatkozasaiba es a foglalo-oldal importjaba.
const MOTOR_MODULOK = [];
(function bejar(mappa) {
  for (const e of fs.readdirSync(mappa, { withFileTypes: true })) {
    const p = path.join(mappa, e.name);
    if (e.isDirectory()) bejar(p); else if (e.name.endsWith('.js')) MOTOR_MODULOK.push(p);
  }
})(path.join(DIST, 'assets/js/booking-engine'));
MOTOR_MODULOK.sort();
// A foglalo kis kepei (assets/img/booking/*) ugyanigy egy evig tarolhatok: a tartalom-hash-uk a motor kodjaba kerul (__KEP_VERZIO__: a kep-URL-ek ?v= jele),
// igy egy kicserelt kep uj URL-t kap, es a motor verziojele is valtozik.
const KEP_MAPPA = path.join(DIST, 'assets/img/booking');
const KEP_VERZIO = crypto.createHash('sha1').update(fs.existsSync(KEP_MAPPA) ? fs.readdirSync(KEP_MAPPA).sort().map((f) => f + fs.readFileSync(path.join(KEP_MAPPA, f)).toString('base64')).join('\n') : '').digest('hex').slice(0, 10);
const MOTOR_VERZIO = crypto.createHash('sha1').update(MOTOR_MODULOK.map((p) => fs.readFileSync(p, 'utf8')).join('\n') + KEP_VERZIO).digest('hex').slice(0, 10);
for (const p of MOTOR_MODULOK) {
  const t = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, t.replace(/(from\s+['"])(\.{1,2}\/[^'"?]+\.js)(['"])/g, `$1$2?v=${MOTOR_VERZIO}$3`).split('__KEP_VERZIO__').join(KEP_VERZIO));
}
// A helyben nyilo foglalo-reteg inditoja (assets/js/booking-launcher.js) a motor es a stilusok tartalom-hash-et kapja (a /assets/js/* es a
// /assets/css/* egy evig tarolhato): a __MOTOR_VERZIO__ / __CSS_VERZIO__ jeleket itt irjuk be, a launcher sajat ?v= jele ezutan szamolodik.
const CSS_VERZIO = crypto.createHash('sha1').update(['booking-engine.css', 'booking-fonts.css'].map((c) => fs.readFileSync(path.join(DIST, 'assets/css', c), 'utf8')).join('\n')).digest('hex').slice(0, 10);
// (az oxigen-uj.js, a beagyazott foglalo-blokk gazdaja, ugyanezt a ket jelet kapja: assets/js/booking-engine/beagyazott.js)
for (const fajl of ['booking-launcher.js', 'oxigen-uj.js']) {
  const p = path.join(DIST, 'assets/js', fajl);
  if (!fs.existsSync(p)) continue;
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').split('__MOTOR_VERZIO__').join(MOTOR_VERZIO).split('__CSS_VERZIO__').join(CSS_VERZIO));
}
// Mobilkepek (assets/img/m/, tools/mobil-kepek.py): ami ott nincs (mar eleve kicsi),
// azt valtozatlanul bemasoljuk, igy a mobil oldal minden kepe megvan az m/ mappaban is.
const IMG = path.join(DIST, 'assets', 'img'), IMG_M = path.join(IMG, 'm');
fs.mkdirSync(IMG_M, { recursive: true });
for (const f of fs.readdirSync(IMG)) {
  if (f === 'm') continue;
  // az almappak (pl. pmu/, fooldal/haj/) is: a mobil oldalakon minden kephivatkozas az m/ ala mutat.
  // Mappa eseten egyesitunk (force:false): ha az m/ alatt mar van a mappabol nehany kicsinyitett
  // kep, a tobbi (pl. fooldal/haj/) akkor is atkerul, a mar meglevo kicsinyitettet nem irjuk felul.
  if (fs.statSync(path.join(IMG, f)).isDirectory()) fs.cpSync(path.join(IMG, f), path.join(IMG_M, f), { recursive: true, force: false, errorOnExist: false });
  else if (!fs.existsSync(path.join(IMG_M, f))) fs.copyFileSync(path.join(IMG, f), path.join(IMG_M, f));
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

// Cloudflare Pages (functions/[[path]].js): a fuggveny csak a lapcimekre fusson,
// a fajlok (kepek, stilusok, szkriptek, videok) kozvetlenul jojjenek - a
// fuggvenyhivasok szama igy a latogatasokkal aranyos, nem a fajlokeval.
// A Netlify ezeket a fajlokat figyelmen kivul hagyja.
fs.writeFileSync(path.join(DIST, '_routes.json'), JSON.stringify({
  version: 1,
  include: ['/*'],
  exclude: ['/assets/*', '/_a/*', '/_m/*', '/salonic/*', '/.well-known/*', '/favicon.ico',
    ...fs.readdirSync(DIST).filter((f) => f.endsWith('.xml')).map((f) => '/' + f)],
}, null, 1));
// 404-es lap: a Cloudflare Pages ennek hianyaban a nyitooldalt adna minden
// ismeretlen cimre (egyoldalas alkalmazaskent kezelne a webhelyet)
if (!fs.existsSync(path.join(DIST, '404.html'))) {
  fs.writeFileSync(path.join(DIST, '404.html'), '<!doctype html><html lang="hu"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">' +
    '<title>Az oldal nem található | MOSAIC Headspa</title><style>body{font:16px/1.5 Arial,sans-serif;' +
    'text-align:center;padding:15vh 20px;color:#222}a{color:#1b3a3a}</style></head><body>' +
    '<h1>Az oldal nem található</h1><p><a href="/">Vissza a nyitóoldalra</a></p></body></html>');
}

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
  '/.well-known/*',
  '  Content-Type: text/plain; charset=utf-8',
  '  Cache-Control: public, max-age=0, must-revalidate',
  // a HTML-beagyazasok (GYIK, arlistak) csak keretben jelennek meg, onalloan ne indexelodjenek
  '/assets/embed/*',
  '  X-Robots-Tag: noindex',
  // az /ajandek (a kampany- es levelbeli linkek cime) ugyanazt az oldalt adja, mint az eles ajandekkartya-cimek: ne indexelodjon ketszer
  // (a /ajandekkartya a fomenu valaszto oldala: szinten noindex). Az /oxigen-ajandekkartya 2026-10-08 ota indexelheto (a tulajdonos kerese; a sitemapben is szerepel).
  // a belso CRM: nincs gyorsitotar, nincs indexeles, szigoru CSP (kulso script / tracking nincs)
  '/crm',
  '  Cache-Control: no-store',
  '  X-Robots-Tag: noindex, nofollow',
  '  Referrer-Policy: no-referrer',
  `  Content-Security-Policy: ${CSP_CRM}`,
  '/crm/*',
  '  Cache-Control: no-store',
  '  X-Robots-Tag: noindex, nofollow',
  ...(ELES ? ['/ajandek', '  X-Robots-Tag: noindex', '/lezeres-ajandekkartya', '  X-Robots-Tag: noindex', '/ajandekkartya', '  X-Robots-Tag: noindex'] : []),
  '',
].join('\n'));

// Verziojel a sajat szkriptek es stilusok hivatkozasaira (?v=<tartalom-hash>):
// igy egy javitas azonnal eler minden latogatot, akkor is, ha a bongeszo meg
// egy regebbi valtozatot tarol.
// Minden sajat szkript es stiluslap (nem csak egy kezi lista): a /assets/js/* es /assets/css/*
// egy evig tarolhato (immutable), ezert ami verziojel nelkul megy ki, annak a javitasa nem jut el a
// latogatohoz - a regi CSS/JS marad a bongeszoben az uj HTML mellett (igy esett szet a PMU landing).
const SAJAT = [
  ...fs.readdirSync(path.join(ROOT, 'assets/js')).filter((f) => f.endsWith('.js')).map((f) => 'assets/js/' + f),
  ...fs.readdirSync(path.join(ROOT, 'assets/css')).filter((f) => f.endsWith('.css')).map((f) => 'assets/css/' + f),
];
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
// (a booking-launcher.js nem hoz letre oldal-elemet, a szovegeben levo szavak (pl. "category") ne tartsanak meg felesleges CSS-szabalyt)
const SAJAT_JS = fs.readdirSync(path.join(ROOT, 'assets/js')).filter((f) => f.endsWith('.js') && f !== 'booking-launcher.js')
  .map((f) => fs.readFileSync(path.join(ROOT, 'assets/js', f), 'utf8')).join('\n');
// A harom kis stiluslap (betuk + klon.css) beagyazva: kulon letoltesre varva blokkolnak
// az elso megjelenitest. A relativ betu-hivatkozasokat abszolutra irjuk.
const BEAGYAZOTT = ['wix-google-fonts.css', 'wix-fonts.css', 'klon.css'].map((f) => [f,
  fs.readFileSync(path.join(ROOT, 'assets/css', f), 'utf8').replace(/url\((['"]?)\.\.\/fonts\//g, 'url($1/assets/fonts/') + (f === 'klon.css' ? '\n' + FEJLEC_CSS : '')]);
// A GYIK szovegeben is van foglalo-link (assets/js/gyik.js): ugyanaz az atkotes. A verziojel a dist/-beli (atirt) tartalombol
// szamolodik, hogy az atirt szkript uj cimet kapjon (a regit a bongeszo egy evig tarthatja); atkotes nelkul a tartalom azonos.
if (ATKOTES.size) {
  const gyik = path.join(DIST, 'assets/js/gyik.js');
  const r = atkotSzoveg(fs.readFileSync(gyik, 'utf8'), ATKOTES);
  fs.writeFileSync(gyik, r.szoveg);
  atkotesDb = osszead(atkotesDb, r.db);
}
const verzio = Object.fromEntries(SAJAT.map((f) => [f,
  crypto.createHash('sha1').update(fs.readFileSync(path.join(DIST, f))).digest('hex').slice(0, 10)]));
// A sajat foglalo-oldalak (a motor / a PMU foglalo / a probaoldalak) maguk toltik a foglalot: ezekre a launcher nem kerul.
const FOGLALO_OLDALAK = new Set(['foglalo-motor.html', 'foglalas.html', 'booking-test.html', 'foglalo-pmu.html', 'foglalo-proba.html', 'sminktetovalas-budapest.html', 'szajtetovalas-budapest.html']);
// Szovegfinomitasok a kozos fejlecben/lableben. A Wixes oldalakban a szoveg HTML-entitasokkal van kodolva, a sajat darabokban sima betukkel: a mintak mindkettot elfogadjak.
const ENTITAS = { 'á': '&aacute;', 'é': '&eacute;', 'ó': '&oacute;', 'ö': '&ouml;', 'ő': '&odblac;', 'ü': '&uuml;', 'ű': '&udblac;', 'í': '&iacute;', 'ú': '&uacute;', 'Á': '&Aacute;' };
const TOLERANS = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[áéóöőüűíúÁ]/g, (c) => '(?:' + c + '|' + ENTITAS[c] + ')');
const AKCIOSAV = new RegExp(TOLERANS('Októberi akció! - 20% kedvezmény minden headspa foglalásra + ajándékkártyára!'), 'g');
const FOGLALAS_GOMB = new RegExp('(<a [^>]*style-mo70g2c7__root[^>]*aria-label=")' + TOLERANS('FOGLALÁS') + '("[^>]*><span class="StylableButton2545352419__container"><span class="StylableButton2545352419__label wixui-button__label" data-testid="stylablebutton-label">)' + TOLERANS('FOGLALÁS') + '(</span>)');
function fejlecSzoveg(h, mobil) {
  // a Wixes oldalak beegetett fomenujeben az Ajandekkartya menupont lenyilo lesz (a sajat oldalak darabjain mar megtortent: ismetelve nem csinal semmit)
  h = fejlecAtalakit(h, mobil);
  // lablec: az elvalasztok " - " helyett " · " (csak a szoveg-csomopontokban)
  h = h.replace(/(<div id="comp-m40zyigs"[^>]*><p[^>]*>)([\s\S]*?)(<\/p>)/,
    (m, a, tartalom, c) => a + tartalom.replace(/(^|>)([^<]*)/g, (mm, k, sz) => k + sz.replace(/ - /g, ' · ')) + c);
  if (mobil) {
    // az akciosav egy sorba ferjen (rovidebb szoveg), a fejlec gombja ne legyen csupa nagybetus
    h = h.replace(AKCIOSAV, 'Októberi akció! 20% kedvezmény minden headspa + ajándékkártyára');
    h = h.replace(FOGLALAS_GOMB, '$1Foglalás$2Foglalás$3');
  }
  return h;
}
// google-szam.js: mely oldalakra kerul fel (lasd lent): a foglalas/ alatti sajat oldalak, ahol a Google-ertekeles darabszama szovegben szerepel
const SAJAT_OLDALAK = new Set(fs.readdirSync(path.join(ROOT, 'foglalas')).filter((x) => x.endsWith('.html')));
const GV_MINTA = /(?:\d{1,2}[.,\u00a0 \u202f]\d{3}|\d{3,5})\+?\s*(?:db\s+)?(?:Google[- ](?:v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)|Google reviews|vend[eé]gv[eé]lem[eé]ny|val[oó]di [eé]rt[eé]kel[eé]s|v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)/i;
const GV_KIHAGY = /^(foglalo-pmu|pmu-ok|pmu-vh)\.html$/;   // Melitta / PMU-specifikus szam (nem a MOSAIC osszes ertekelese)
for (const mappa of [LAP_A, LAP_M]) {
  for (const f of fs.readdirSync(mappa).filter((x) => x.endsWith('.html'))) {
    const p = path.join(mappa, f);
    let h = fejlecSzoveg(ritkit(fs.readFileSync(p, 'utf8'), SAJAT_JS), mappa === LAP_M);
    h = headspaJelolo(h, f);   // az "Októberi akció" sáv csak a Head Spa oldalakon látszik (assets/css/fejlec-lablec.css)
    // Ahol a foglalo-linkek a motorra mutatnak (bekapcsolt atkotes: elonezet / helyi build), ott a CTA a foglalot HELYBEN nyitja (reteg),
    // nem visz at a /foglalo-motor oldalra. Kikapcsolt atkotesnel (eles, ma) semmi nem valtozik.
    const launcherOldal = ATKOTES.size > 0 && !kihagyottOldal(f) && !FOGLALO_OLDALAK.has(f) && !/^crm\.html$/.test(path.basename(f)); // ahol a launcher rajta van, a foglalo-linkek a retegben nyilnak
    if (launcherOldal) h = h.replace('</body>', '<script type="module" src="/assets/js/booking-launcher.js"></script></body>');
    // A MOSAIC Google-ertekeleseinek szama minden oldalon az AKTUALIS (assets/js/google-szam.js, a Trustindex-widget adata): a sajat oldalakra, ahol "<szam> ... Google-velemeny / ertekeles" szoveg van
    // (a Melitta / PMU-specifikus foglalo oldalak kivetelevel), felkerul a szkript; a HTML-ben levo szam a tartalek.
    if (SAJAT_OLDALAK.has(f) && GV_MINTA.test(h) && !GV_KIHAGY.test(f)) h = h.replace('</body>', '<script src="/assets/js/google-szam.js" defer></script></body>');
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
    // a foglalo-oldal importja a motor verzios cimere mutat (lasd MOTOR_VERZIO)
    h = h.split("/assets/js/booking-engine/engine.js'").join(`/assets/js/booking-engine/engine.js?v=${MOTOR_VERZIO}'`);
    // Salonic foglalo-linkek -> /foglalo-motor (a koszonooldalakat kihagyja; kikapcsolva a szoveg valtozatlan)
    if (ATKOTES.size && !kihagyottOldal(f)) { const r = atkot(h, ATKOTES); h = r.html; atkotesDb = osszead(atkotesDb, r.db); }
    // a sajat foglalo-oldalakra mutato linkek (fomenu "FOGLALAS" + az oldalak gombjai): csak ott, ahol a launcher rajta van (ugyanaz a reteg nyilik)
    if (launcherOldal) { const r = atkotBelso(h, f, ATKOTES, { launcher: true }); h = r.html; atkotesDb = osszead(atkotesDb, r.db); }
    // a Wix-felugro gombok, amelyekhez nincs felugro sablon (kupon-keres, telefonos konzultacio): a gomb a foglalora mutat, nem marad halott gomb (tools/halott-popup.mjs)
    h = popupAtkot(h, f).html;
    // a regi foglalo-oldalak: ures oldal + bezarhatatlan felugro foglalo (a cim megmarad, a mero kod az oldalon marad)
    if (launcherOldal) { const r = uresOldal(h, f, ATKOTES); h = r.html; atkotesDb = osszead(atkotesDb, r.db); }
    fs.writeFileSync(p, h);
  }
}

const html = fs.readdirSync(LAP_A).filter((f) => f.endsWith('.html')).length;
const mobil = fs.readdirSync(LAP_M).filter((f) => f.endsWith('.html')).length;
console.log(`dist/ kesz: ${html} asztali + ${mobil} mobil oldal, ${ELES ? 'ELES (indexelheto)' : 'PROBA (noindex)'}`);
console.log(`foglalo-atkotes: ${ATKOTES.size ? [...ATKOTES].map((k) => `${k} ${atkotesDb[k]}`).join(', ') : 'kikapcsolva (a linkek Salonic-linkek maradnak)'}`);
