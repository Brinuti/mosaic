// Wix SSR HTML -> onallo statikus oldal (a MOSAIC klon tools/wix2static.mjs mintajara).
//
//   node tools/wix2static.mjs            tools/raw       -> klon/     (asztali)
//   node tools/wix2static.mjs --mobil    tools/raw-mobil -> klon/m/   (mobil)
//   node tools/wix2static.mjs rolunk     csak a megadott kulcsu oldal(ak)
//
// A Wix a bongeszo azonositoja alapjan ket kulon oldalt ad (asztali es 320 px
// szeles mobil), ezert mindkettot kulon alakitjuk at. Hogy melyiket kapja a
// latogato, azt a functions/[[path]].js donti el ugyanugy, ahogy a Wix.
import fs from 'node:fs';
import path from 'node:path';
import { mindenOldal as oldalak, kulcsbol } from './oldalak.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MOBIL = process.argv.includes('--mobil');
const RAW = path.join(ROOT, MOBIL ? 'tools/raw-mobil' : 'tools/raw');
// a kirajzolt oldal (tools/elo-mentes.mjs) az elsodleges forras; ha nincs, a szerveroldali mentes
const ELO = path.join(ROOT, 'tools/elo-dom', MOBIL ? 'mobil' : 'asztali');
const OUT = path.join(ROOT, MOBIL ? 'klon/m' : 'klon');
const DOMAIN = 'https://www.medicalpiercing.hu';
const IMGDIR = path.join(ROOT, 'assets/img');

const helyiKepek = new Set(fs.readdirSync(IMGDIR));
const hianyzoKepek = new Set();
const LISTA = oldalak();
const ismertKulcs = new Set(LISTA.map((o) => o.kulcs));

// --- 1. kepek: static.wixstatic.com/media/<id>... -> /assets/img/<id>.<ext> ---
function helyiKepNev(url) {
  const u = decodeURIComponent(url.replace(/&amp;/g, '&'));
  const m = u.match(/\/media\/([A-Za-z0-9_]+?)(?:~mv2)?(?:_[a-z]_[0-9_]+)*\.(jpg|jpeg|png|gif|webp|avif|svg)(?:$|[/?])/i);
  return m ? m[1] + '.' + m[2].toLowerCase() : null;
}
function kepekAtirasa(html) {
  return html.replace(/https:\/\/static\.wixstatic\.com\/media\/[^"'\s)\\&]+(?:&amp;[^"'\s)\\&]+)*/g, (url) => {
    const nev = helyiKepNev(url);
    if (!nev) return url;
    if (!helyiKepek.has(nev)) { hianyzoKepek.add(nev + '  <- ' + url.slice(0, 120)); return url; }
    return '/assets/img/' + nev;
  });
}
const PARASTORAGE_KEPEK = {
  'services/linguist-flags/1.1005.0/assets/flags/square/HUN_2x.png': 'flag-HUN_2x.png',
  'services/linguist-flags/1.1005.0/assets/flags/square/HUN.png': 'flag-HUN.png',
  'services/editor-elements-library/dist/thunderbolt/media/sloppyframe.3214ce8e.png': 'sloppyframe.png',
};
function parastorageKepek(html) {
  for (const [tavoli, helyi] of Object.entries(PARASTORAGE_KEPEK)) {
    if (!html.includes(tavoli)) continue;
    if (!helyiKepek.has(helyi)) { hianyzoKepek.add(helyi + '  <- ' + tavoli); continue; }
    html = html.split('https://static.parastorage.com/' + tavoli).join('/assets/img/' + helyi);
  }
  return html;
}

// --- 2. belso linkek: a teljes Wix-cim helyett gyokertol indulo cim ---------
// Az utvonal maradhat ekezetes/kodolt: a functions/[[path]].js dekodolja, es a
// kulcsbol() fuggvennyel talalja meg a fajlt. A /post/ elotagot a Wix is elfogadja.
let atirtLink = 0, ismeretlenLink = new Set();
function linkekAtirasa(html) {
  // a domain utan rogton johet ?, # is (pl. https://www.medicalpiercing.hu#ekszerek)
  return html.replace(/(<a\b[^>]*?\bhref=")https?:\/\/(?:www\.)?medicalpiercing\.hu([/?#][^"]*)?"/gi, (egesz, eleje, ut = '/') => {
    if (!ut.startsWith('/')) ut = '/' + ut;
    const [tiszta] = ut.split(/[?#]/);
    let k;
    try { k = kulcsbol(decodeURIComponent(tiszta).replace(/^\/post\//, '/')); } catch { k = null; }
    if (!ismertKulcs.has(k)) ismeretlenLink.add(ut);
    atirtLink++;
    return `${eleje}${ut}"`;
  });
}

// --- 3. scriptek, Wix-eloretoltesek ------------------------------------
function scriptekTorlese(html) {
  const ld = [];
  html = html.replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, (m) => `<!--mp-ld-${ld.push(m) - 1}-->`);
  html = html
    .replace(/<!--pageHtmlEmbeds\.(\w+) start-->[\s\S]*?<!--pageHtmlEmbeds\.\1 end-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<link\b[^>]*rel="(?:preconnect|dns-prefetch|preload|prefetch|modulepreload)"[^>]*>/gi, '')
    .replace(/<link\b[^>]*\brel="(?:preload|prefetch)"[^>]*>/gi, '')
    .replace(/<link\b[^>]*href="https:\/\/siteassets\.parastorage\.com[^>]*>/gi, '')
    // a futas kozben beszurt mero-keretek (GTM, YouTube-mero) - a klonban a suti.js adja a merest
    .replace(/<iframe\b[^>]*googletagmanager\.com[^>]*>\s*<\/iframe>/gi, '')
    .replace(/<iframe height="0" width="0" style="display: none; visibility: hidden;"[^>]*>\s*<\/iframe>/gi, '')
    .replace(/ data-gtm-yt-inspected-[\w-]+="[^"]*"/g, '');
  return html.replace(/<!--mp-ld-(\d+)-->/g, (_, i) => ld[+i]);
}

// --- 4. Wix @font-face szabalyok (a sajat betukeszlet lep a helyukre) -------
let torolt = 0;
function wixBetukTorlese(html) {
  let ki = '', i = 0;
  for (;;) {
    const kezd = html.indexOf('@font-face', i);
    if (kezd < 0) { ki += html.slice(i); break; }
    const nyit = html.indexOf('{', kezd);
    if (nyit < 0) { ki += html.slice(i); break; }
    let melyseg = 0, j = nyit;
    for (; j < html.length; j++) {
      if (html[j] === '{') melyseg++;
      else if (html[j] === '}') { melyseg--; if (!melyseg) { j++; break; } }
    }
    const blokk = html.slice(kezd, j);
    if (/parastorage\.com|wixstatic\.com/.test(blokk)) { ki += html.slice(i, kezd); torolt++; }
    else ki += html.slice(i, j);
    i = j;
  }
  return ki;
}

// --- 5. sajat betuk, stilus, viselkedes -----------------------------------
function sajatBeszuras(html) {
  const fej = `
<meta name="facebook-domain-verification" content="oj1ahwm1kfvzw0sunuigz3uhlbozp3" />
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/klon.css">
<script src="/assets/js/suti.js"></script>`;
  const lab = `\n<script src="/assets/js/klon.js" defer></script>`;
  return html.replace(/<\/head>/i, fej + '\n</head>').replace(/<\/body>/i, lab + '\n</body>');
}

// --- 6. keretek es videok helyi cimre ---------------------------------------
// - a Wix HTML-beagyazasai (filesusr.com/html/...) -> /assets/embed/ (tools/beagyazasok.mjs)
// - a Wix Google-terkepe (a Wix sajat Google-kulcsaval, a Wix CDN-jerol) -> a Google
//   sajat beagyazott terkepe ugyanarra a helyszinre (data-mp-terkep: tools/elo-mentes.mjs)
// - a Wix-videok (video.wixstatic.com) -> /assets/video/ (tools/media.mjs)
const helyiBeagyazasok = new Set(fs.existsSync(path.join(ROOT, 'assets/embed')) ? fs.readdirSync(path.join(ROOT, 'assets/embed')) : []);
const helyiVideok = new Set(fs.existsSync(path.join(ROOT, 'assets/video')) ? fs.readdirSync(path.join(ROOT, 'assets/video')) : []);
const hianyzo = new Set();
const htmlDekod = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function keretek(html) {
  html = html.replace(/https:\/\/www-medicalpiercing-hu\.filesusr\.com\/html\/([a-z0-9_]+\.html)/g, (u, nev) => {
    if (!helyiBeagyazasok.has(nev)) { hianyzo.add('beagyazas ' + nev); return u; }
    return '/assets/embed/' + nev;
  });
  html = html.replace(/<iframe\b[^>]*googleMap[^>]*>/g, (k) => {
    const m = k.match(/data-mp-terkep="([^"]*)"/);
    let q = 'Budapest, Újpesti rkp. 7, 1137', z = 15;
    if (m) {
      try {
        const d = JSON.parse(htmlDekod(m[1]));
        const l = (d.locations || [])[d.defaultLocation || 0] || (d.locations || [])[0];
        if (l) q = l.latitude && l.longitude ? `${l.latitude},${l.longitude}` : l.address;
        if (d.zoom) z = d.zoom;
      } catch (e) { hianyzo.add('terkep-adat'); }
    } else hianyzo.add('terkep-adat (nincs data-mp-terkep)');
    const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&amp;z=${z}&amp;hl=hu&amp;output=embed`;
    return k.replace(/ data-mp-terkep="[^"]*"/, '').replace(/ src="[^"]*"/, ` src="${src}"`).replace(/ data-src="[^"]*"/, '');
  });
  html = html.replace(/https:\/\/video\.wixstatic\.com\/video\/([a-z0-9]{6}_[a-f0-9]{32})\/\d+p\/mp4\/file\.mp4/g, (u, id) => {
    if (!helyiVideok.has(id + '.mp4')) { hianyzo.add('video ' + id); return u; }
    return '/assets/video/' + id + '.mp4';
  });
  return html;
}

// --- 7. felugro ablakok (lightbox) <template>-kent ----------------------------
// A tools/popup-mentes.mjs altal lementett ablak; a klon.js 1. szakasza nyitja meg.
function felugrok(html) {
  const idk = [...new Set([...html.matchAll(/data-popupid="([^"]+)"/g)].map((m) => m[1]))];
  const blokkok = [];
  for (const id of idk) {
    const f = path.join(ROOT, 'assets/popup', `${id}-${MOBIL ? 'mobil' : 'asztali'}.html`);
    if (!fs.existsSync(f)) { hianyzo.add('felugro ' + id); continue; }
    let t = fs.readFileSync(f, 'utf8');
    t = wixBetukTorlese(linkekAtirasa(parastorageKepek(kepekAtirasa(t))));
    blokkok.push(`<template id="mp-popup-${id}">\n${t}\n</template>`);
  }
  return blokkok.length ? html.replace(/<\/body>/i, blokkok.join('\n') + '\n</body>') : html;
}

// --- 8. kulso Wix-stilusfajlok helyi masolata --------------------------------
const WIXCSS = path.join(ROOT, 'assets/css/wix');
async function wixCss(url) {
  const nev = decodeURIComponent(url.split('/').pop()).replace(/[^A-Za-z0-9._-]+/g, '_');
  const cel = path.join(WIXCSS, nev);
  if (!fs.existsSync(cel)) {
    fs.mkdirSync(WIXCSS, { recursive: true });
    const v = await fetch(url);
    if (!v.ok) { hianyzo.add('wix-css ' + url); return nev; }
    fs.writeFileSync(cel, wixBetukTorlese(await v.text()));
  }
  return nev;
}

// --- futtatas ------------------------------------------------------------
const kertek = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let db = 0;
const vegyes = [];
for (const o of LISTA.filter((x) => !kertek.length || kertek.includes(x.kulcs))) {
  // a kirajzolt mentes csak akkor jo, ha benne van a Wix fo stilusa (lasd elo-mentes.mjs)
  // Nehany oldalt a Wix a bongeszoben ujrarajzol, es a stilust ilyenkor kulso
  // (parastorage) CSS-fajlokbol adja, a beagyazott <style>-ok helyett. Ezeknel a
  // kirajzolt tartalomhoz a szerveroldali mentes (tools/raw) beagyazott stilusait
  // tesszuk: az osztalynevek ugyanazok, igy a megjelenes azonos.
  const elo = path.join(ELO, o.kulcs + '.html');
  const nyers = path.join(RAW, o.kulcs + '.html');
  let forras = null;
  if (fs.existsSync(elo)) {
    const e = fs.readFileSync(elo, 'utf8');
    if (e.includes('<style id="css_masterPage"') || !fs.existsSync(nyers)) forras = e;
    else {
      const stilusok = [...fs.readFileSync(nyers, 'utf8').matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');
      // a kulso Wix-stilusfajlok (pl. a blog-module) helyi masolata: assets/css/wix/
      let k = e;
      for (const [link, url] of [...e.matchAll(/<link\b[^>]*href="(https:\/\/static\.parastorage\.com\/[^"]+\.css)"[^>]*>/gi)].map((m) => [m[0], m[1]])) {
        k = k.replace(link, link.includes('stylesheet') ? `<link rel="stylesheet" href="/assets/css/wix/${await wixCss(url)}">` : '');
      }
      forras = k.replace(/<\/head>/i, stilusok + '\n</head>');
      vegyes.push(o.kulcs);
    }
  }
  const be = nyers;
  if (!fs.existsSync(be)) { console.log('nincs lementve: ' + o.kulcs); continue; }
  let html = (forras ?? fs.readFileSync(be, 'utf8')).replace(/\u0000/g, '');
  const elotte = html.length;
  html = scriptekTorlese(html);
  html = wixBetukTorlese(html);
  html = kepekAtirasa(html);
  html = parastorageKepek(html);
  html = linkekAtirasa(html);
  html = keretek(html);
  html = felugrok(html);
  html = sajatBeszuras(html);
  // az og:image / twitter:image es a JSON-LD kepcime teljes cim maradjon (mint a Wixen)
  html = html.replace(/(<meta (?:property|name)="(?:og|twitter):image(?::secure_url)?" content=")\/assets\//g, `$1${DOMAIN}/assets/`)
    .replace(/(<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>)/gi, (m) => m.replace(/"\/assets\//g, `"${DOMAIN}/assets/`));
  const ki = path.join(OUT, o.kulcs + '.html');
  fs.mkdirSync(path.dirname(ki), { recursive: true });
  fs.writeFileSync(ki, html);
  db++;
  if (kertek.length) console.log(`${o.kulcs.padEnd(50)} ${(elotte / 1024).toFixed(0).padStart(5)} kB -> ${(html.length / 1024).toFixed(0).padStart(5)} kB`);
}
console.log(`${db} oldal (${MOBIL ? 'mobil' : 'asztali'}), ${torolt} Wix @font-face torolve, ${atirtLink} belso link atirva`);
if (ismeretlenLink.size) console.log(`Ismeretlen belso cel (${ismeretlenLink.size}): ${[...ismeretlenLink].slice(0, 30).join('  ')}`);
if (vegyes.length) console.log(`Kirajzolt tartalom + szerveroldali stilus (${vegyes.length}): ${vegyes.join(' ')}`);
if (hianyzo.size) console.log(`Hianyzik: ${[...hianyzo].join(', ')}`);
if (hianyzoKepek.size) { console.log(`\nHIANYZO HELYI KEP (${hianyzoKepek.size}):`); for (const k of hianyzoKepek) console.log('  ' + k); }
