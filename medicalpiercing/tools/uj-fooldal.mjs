// Az uj, REJTETT oldalak (/uj-fooldal, es a /uj/... tukor) osszerakasa a dist/ mappaba (a build hivja: tools/build.mjs).
//
// Forras: uj-fooldal/index.html (a fooldal, kezzel irt), uj-oldalak/reszek/*.html (a kozos fejlec, lablec, ikonok), stilus:
// assets/css/uj-fooldal.css, szkript: assets/js/uj-fooldal.js, kepek: assets/img/ (az uj-* kepeket a tools/uj-fooldal-kepek.py gyartja).
// Nem a Wix-klon resze: a tools/wix2static.mjs nem erinti, es a klon/ mappaba sem kerul.
//
// A lapok a Wix-szel azonos cimeken el a tobbi oldal mellett, asztali es mobil kiszolgalasra is ugyanaz a (reszponziv) fajl.
// Elesitve (lib/uj-eles.js, UJ_ELES = true; a tulajdonos kerese, 2026-10-16): az uj lapok az EREDETI cimeken (/, /migren-piercing ...), a regi
// Wix-klon SEO-fejlecevel (cim, leiras, canonical, og/twitter, ld+json, ellenorzo cimkek, robots: elesFej); a regi oldal a /regi/... cimen marad.
// UJ_ELES = false: rejtve a /uj-fooldal es a /uj/... cimen (nincsenek a sitemapben, noindex: meta + a fuggveny X-Robots-Tag fejlece; a build megall,
// ha a forrasbol a noindex hianyzik). A foglalomotor-inditot, a verziojeleket (?v=) es a foglalas-merest a build tobbi resze teszi ra, mint a tobbi lapra.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { kulcsbol, fajlnev } from '../lib/utvonal.js';
import { UJ_ELES, REGI_ELO } from '../lib/uj-eles.js';
import { oldalHtml, indexHtml, KIZART_UTAK } from './uj-oldalak/sablon.mjs';
import { B_ALAP, GOOGLE_DB } from './uj-oldalak/kategoria.mjs';

export const UJ_FOOLDAL_UT = UJ_ELES ? '/' : '/uj-fooldal';
export const TUKOR_ELO = UJ_ELES ? '' : '/uj';   // a tobbi oldal: elesitve az eredeti cimen, kulonben a rejtett tukor (/uj/<eredeti utvonal>)

// --- kozos reszek: <!--#nev--> -> uj-oldalak/reszek/nev.html ---------------------------------------------------------------
// <!--#velemenyek ti=<kulcs>--> : a velemeny-doboz egy masik (pl. kategoriankent szurt) Trustindex-widgettel
// (a kozos resz maga is tartalmazhat kozos reszt, pl. kapcsolat -> szalon-galeria: legfeljebb 3 szint melyen)
export function osszerak(ROOT, html) {
  for (let szint = 0; szint < 3 && /<!--#[a-z0-9-]+(?: ti=[a-z0-9]+)?-->/.test(html); szint++) {
    html = html.replace(/<!--#([a-z0-9-]+)(?: ti=([a-z0-9]+))?-->/g, (m, nev, ti) => {
      const resz = fs.readFileSync(path.join(ROOT, 'uj-oldalak/reszek', nev + '.html'), 'utf8').trimEnd();
      return ti ? resz.replace(/loader\.js\?[a-z0-9]+/, 'loader.js?' + ti) : resz;
    });
  }
  return html;
}

// --- kepek verziojele: az /assets/img/ 30 napig tarolodik, a megvaltozott uj-* kep ujra-keres kell (?v=<tartalom-hash>) ----------
const jelek = new Map();
export function kepVerzio(ROOT, html) {
  return html.replace(/(\/assets\/img\/uj-[A-Za-z0-9_-]+\.(?:webp|png|jpg))(?![?\w])/g, (m, f) => {
    if (!jelek.has(f)) {
      const p = path.join(ROOT, f);
      jelek.set(f, fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 8) : null);
    }
    return jelek.get(f) ? `${f}?v=${jelek.get(f)}` : m;
  });
}

// --- a tukor-oldalak jegyzeke (az eredeti utvonalak, amiknek van uj valtozata): a belso linkek az ujra mutatnak ------------------
let tukor = null;
export function tukorJegyzek(ROOT) {
  if (tukor) return tukor;
  const f = path.join(ROOT, 'uj-oldalak/jegyzek.json');
  tukor = fs.existsSync(f) ? new Set(JSON.parse(fs.readFileSync(f, 'utf8')).map((o) => o.ut).filter((ut) => !KIZART_UTAK.has(ut))) : new Set();
  return tukor;
}
// belso link atiras: / -> /uj-fooldal, /x -> /uj/x ha az x-nek van uj valtozata; a foglalasi cimek (/idopontfoglalas, /kontroll) maradnak
// (a foglalomotor ezekre a pontos cimekre figyel), a fajlok, az API es a horgonyok valtozatlanok
export function linkAtiras(ROOT, html) {
  const t = tukorJegyzek(ROOT);
  if (!t.size) return html;
  return html.replace(/(<a\b[^>]*?\shref=")(\/[^"]*)(")/g, (m, a, h, z) => {
    // elesitve a forrasban kezzel irt /uj/... es /uj-fooldal linkek az eredeti cimre mutatnak
    if (UJ_ELES && /^\/uj-fooldal(?=[?#]|$)/.test(h)) return a + '/' + h.slice(11) + z;
    if (UJ_ELES && /^\/uj\//.test(h)) return a + h.slice(3) + z;
    if (/^\/(assets|api|_a|_m|uj\/|uj-|regi\/)/.test(h) || /^\/(idopontfoglalas|kontroll)(?:[/?#]|$)/.test(h)) return m;
    const [ut0, ...marad] = h.split(/(?=[?#])/);
    let ut;
    try { ut = decodeURIComponent(ut0).replace(/\/+$/, '') || '/'; } catch { return m; }
    if (ut === '/') return a + UJ_FOOLDAL_UT + marad.join('') + z;
    return t.has(ut) ? a + (TUKOR_ELO + ut0) + marad.join('') + z : m;
  });
}

// --- szovegjavitas az osszes uj lapon (a tulajdonos kerese, 2026-10-16) ------------------------------------------------------
// Az ekszereknel nincs arany (sem 14 karatos bevonat), nem "tanusitvannyal rendelkezo / antiallergen", hanem magas minosegu orvosi fem, G23 titanium.
// A regi "4.100+" velemenyszam helyett a Google-velemenyek mostani szama (build ideju tartalek: GOOGLE_DB, a lap a /api/ertekeles szamara frissiti).
const EKSZER_MONDAT = 'Kizárólag <strong>magas minőségű orvosi fémből, G23 titániumból</strong> készült ékszerekkel dolgozunk.';
export function szovegJavit(html) {
  // a <script> / <style> blokkok tartalma valtozatlan marad (a szoveg-csere csak a lathato szovegre vonatkozik)
  const vedett = [];
  const vissza = (h) => h.replace(/\u0000(\d+)\u0000/g, (m, i) => vedett[+i]);
  return vissza(szovegJavitBelso(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => `\u0000${vedett.push(m) - 1}\u0000`)));
}
function szovegJavitBelso(html) {
  return html
    .replace(/<strong>A legmagasabb minőségű(?:<\/strong>)? \(tanúsítvánnyal rendelkező\) (?:<strong>)?G23 Titánium antiallergén<\/strong> ékszerek ezüst színben, vagy <strong>14 karátos arannyal(?: bevonva<\/strong>|<\/strong> bevonva)\./g, EKSZER_MONDAT)
    .replace(/<strong>G23 Titánium, antiallergén orvosi fém piercingek\.<\/strong>/g, '<strong>Magas minőségű orvosi fém: G23 titánium piercingek.</strong>')
    .replace(/Az ezüst színűek titánból, az arany ékszerek pedig orvosi fémből és 14K arannyal vannak<br>\s*bevonva\./g, 'Ékszereink magas minőségű orvosi fémből, G23 titániumból készülnek.')
    .replace(/<p><strong>Az anyaga alapján tehát választhatsz:<\/strong><\/p>\s*<p>[·\s]*nemesfémet \(ezüstözött, aranyozott\)<\/p>\s*<p>[·\s]*ezüstöt<\/p>\s*<p>[·\s]*titániumot<\/p>/g,
      '<p>Nálunk kizárólag <strong>magas minőségű orvosi fémből, G23 titániumból</strong> készült ékszereket használunk.</p>')
    .replace(/ \(ez a páciens kérésének megfelelően arannyal bevont is lehetett\)/g, '')
    .replace(/ha ilyen van akkor arany vagy fehérarany ékszert szoktunk javasolni, viszont<br>\s*ezek nem kaphatóak nálunk a vendégnek kell hoznia magával\./g,
      'ha ilyen van, akkor a vendég által hozott, számára megfelelő ékszert javasoljuk: ezek nem kaphatóak nálunk, a vendégnek kell hoznia magával.')
    .replace(/Találsz feketéket, aranyozottat, ezüst színűt\. Minden ékszerünk a legmagasabb minőségű G23 Titániumból készült orvosi fém, antiallergének és autóklávban fertőtlenítjük őket\./g,
      'Minden ékszerünk magas minőségű orvosi fémből, G23 titániumból készül, és autoklávban fertőtlenítjük őket.')
    // a hosszu szovegu gomb (> 18 betu) keskeny kepernyon tobb sorba torhet; a rovid gombok soha (uj-fooldal.css: .gomb nowrap)
    .replace(/<a class="gomb([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (m, o, at, belso) => (belso.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim().length > 18 ? `<a class="gomb${o} gomb-hosszu"${at}>${belso}</a>` : m))
    // minden link ugyanabban az ablakban nyilik (a tulajdonos kerese, 2026-10-16: a kulon ablak a regi Wix miatt volt)
    .replace(/(<a\b[^>]*?)\s+target="_blank"/g, '$1')
    // csak a szovegben (attributumban nem lehet <span>): a regi velemenyszam; a "Ft" es az ezres tagolas nem torik uj sorba
    .replace(/>([^<]*)</g, (m, t) => {
      let x = t.replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d) (Ft|forint)\b/g, '$1\u00a0$2')
        .replace(/([a-záéíóöőúüű]),([a-záéíóöőúüű])/gi, '$1, $2');   // a Wix-szovegben a vesszo utan neha hianyzik a szokoz ("felaron,a")
      if (/4\.100/.test(x)) x = x.replace(/(?:[Tt]öbb mint\s+)?4\.100\+?/g, `<span data-ti-darab>${GOOGLE_DB}</span>`);
      return '>' + x + '<';
    });
}

// --- a velemeny-blokkok alatti "Tovább az összes véleményhez »" link (a tulajdonos kerese, 2026-10-16, 4. kor; reszek/velemenyek.html, tools/uj-video-velemenyek.mjs):
// a piercing-oldalakon a Velemenyek oldal sajat kategoriajara mutat, magan a Velemenyek oldalon nincs
const VELEMENYEK_UT = '/migren-shenmen-piercing-velemenyek';
const VELEMENY_HORGONY = { '/migren-piercing': 'v-migren', '/shenmen-piercing': 'v-shenmen', '/klimax-piercing': 'v-klimax', '/slim-etvagycsokkento-piercing': 'v-slim', '/allergia-piercing': 'v-allergia', '/maj-piercing': 'v-maj' };
function velemenyLink(ut, html) {
  const alap = TUKOR_ELO ? ut.replace(new RegExp('^' + TUKOR_ELO + '(?=/)'), '') : ut;
  if (alap === VELEMENYEK_UT) return html.replace(/\s*<p class="velemeny-osszes">.*?<\/p>/g, '');
  // ahol az eredeti oldal sajat "Tovább az összes véleményhez >>" linkje (kat-tovabb, a tukor-sablonban p.kozep) kozvetlenul utana all, a mienk nem kell
  // (a tulajdonos jelezte, 2026-10-16: a piercing-oldalakon duplan volt); a horgonyt ilyenkor az eredeti link kapja
  html = html.replace(/\s*<p class="velemeny-osszes">.*?<\/p>((?:\s*<\/?(?:section|div|p)\b[^>]*>)*\s*<a\b[^>]*\shref="\/migren-shenmen-piercing-velemenyek[^"]*"[^>]*>Tovább az összes véleményhez)/g, '$1');
  const h = VELEMENY_HORGONY[alap];
  return h ? html.replace(/(<(?:p class="velemeny-osszes"|div class="tarto kat-tovabb")><a class="szoveg-link" href=")\/migren-shenmen-piercing-velemenyek"/g, `$1${VELEMENYEK_UT}#${h}"`) : html;
}

// --- arc-fokusz a levagott kepeken (a tulajdonos kerese, 2026-10-16, 4. kor: mobilon ne logjon ki arc / fej): uj-oldalak/kep-fokusz.json
// (tools/kep-fokusz.py, OpenCV-arcfelismeres) -> object-position a kepen; ahol a lapon mar van object-position, az marad
let fokusz = null;
function kepFokusz(ROOT, html) {
  if (!fokusz) { const f = path.join(ROOT, 'uj-oldalak/kep-fokusz.json'); fokusz = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {}; }
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const m = /\ssrc="([^"?]+)/.exec(tag);
    const p = m && fokusz[m[1]];
    if (!p || /object-position/.test(tag)) return tag;
    return /\sstyle="/.test(tag) ? tag.replace(/\sstyle="/, ` style="object-position:${p};`) : tag.replace(/^<img\b/, `<img style="object-position:${p}"`);
  });
}

// --- videoboritok (a tulajdonos kerese, 2026-10-16, 4. kor): a YouTube letterboxos kepe helyett a sajat, GPT-vel tervezett indexkep
// (GPT-hatter + a video valodi kepkockaja / a szereplo valodi fotoja + felirat, assets/img/uj-yt-<id>.webp; a lejatszas-jel a kepen van, az oldal sajat
// jele ezeken rejtett, uj-egyseges.css), a mar meglevo szep boritok (szuras, GYIK, media) mindenhol; az elmosodott videoboritok helyett eles kocka
const YT_KEP = {
  '7bGYxWxje2U': 'uj-yt-7bGYxWxje2U.webp', 'x332O9DyMHc': 'uj-yt-x332O9DyMHc.webp', 'paM9uwnJfZI': 'uj-yt-paM9uwnJfZI.webp',
  'MBr44D96ed0': 'uj-yt-MBr44D96ed0.webp', 'GP8JN-ouuxU': 'uj-yt-GP8JN-ouuxU.webp', '1qARKjvQ5EU': 'uj-yt-1qARKjvQ5EU.webp',
  'GCO50aHDAyU': 'uj-szuras-video.webp', '5Gs8oYgKdQI': 'uj-gyik-video.webp', 'JX4nNVb-jB8': 'uj-video-hirtv.webp', 'foEQNUg6DzI': 'uj-video-divany.webp',
};
const POSZTER = { '/assets/img/36b443_db44b65ac652434f81f368121ed6ccccf000.webp': '/assets/img/uj-poszter-36b443-db44.webp' };
function videoBorito(html) {
  const meret = (x) => x.replace(/\s(?:width|height)="\d+"/g, '');
  return html.replace(/<img\b([^>]*?)\ssrc="https:\/\/i\.ytimg\.com\/vi\/([\w-]+)\/(?:hq|sd|mq|maxres)?default\.jpg"([^>]*)>/g, (m, a, id, z) => (YT_KEP[id] ? `<img${meret(a)} src="/assets/img/${YT_KEP[id]}" width="1280" height="720"${meret(z)}>` : m))
    .replace(/\sposter="([^"?]+)"/g, (m, f) => (POSZTER[f] ? ` poster="${POSZTER[f]}"` : m));
}

// --- az allo Facebook-videok (plugins/video.php iframe) helyett tervezett borito (a tulajdonos kerese, 2026-10-16: "ezekhez az allovideokhoz is csinalhatsz
// thumbnailt"): assets/img/uj-fb-<video-azonosito>.webp (tools/uj-velemeny-borito.mjs, tools/kep-forras/fb-boritok.json); kattintasra a helyen tolt be
// a Facebook-lejatszo (assets/js/uj-fooldal.js 3d.) - addig a Facebook semmit nem tolt a lapon
function fbBorito(ROOT, html) {
  return html.replace(/<iframe\b([^>]*?)\ssrc="(https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Fmedicalpiercing\.hu%2Fvideos%2F(\d+)%2F[^"]*)"([^>]*)><\/iframe>/g, (m, a, src, id, z) => {
    if (!fs.existsSync(path.join(ROOT, `assets/img/uj-fb-${id}.webp`))) return m;
    const cim = ((a + z).match(/\stitle="([^"]*)"/) || [])[1] || 'Videó';
    const meret = ['width', 'height'].map((k) => ((a + z).match(new RegExp(`\\s${k}="(\\d+)"`)) || [])[0] || '').join('');
    return `<button type="button" class="fb-indito" data-fb-src="${src}" data-fb-cim="${cim}"${meret.replace(/\s(width|height)=/g, ' data-fb-$1=')} aria-label="Videó lejátszása: ${cim}"><img src="/assets/img/uj-fb-${id}.webp" alt="" width="540" height="960" loading="lazy" decoding="async"></button>`;
  });
}

// --- elesitve: a regi (Wix-klon) oldal SEO-fejlece az uj lapra (cim, leiras, canonical, og/twitter, article, ld+json, Google / Facebook ellenorzo
// cimke, RSS, robots): ugyanazon a cimen a keresok es a megosztasok ugyanazt latjak, mint eddig. Az eredeti nelkuli uj lapok (csapatunk, ekszereink,
// kapcsolat) sajat canonicalt es og-cimkeket kapnak; a 404 noindex.
const DOMAIN = 'https://www.medicalpiercing.hu';
const idezojel = (x) => String(x).replace(/"/g, '&quot;');
function regiFej(ROOT, ut) {
  const f = path.join(ROOT, 'klon', (ut === '/' ? 'index' : kulcsbol(ut)) + '.html');
  if (!fs.existsSync(f)) return null;
  const s = fs.readFileSync(f, 'utf8');
  const fej = s.slice(0, s.search(/<\/head>/i));
  const cim = (/<title>([\s\S]*?)<\/title>/i.exec(fej) || [])[1];
  const minta = /<meta\b[^>]*\b(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+|article:[^"]+|google-site-verification|facebook-domain-verification)"[^>]*>|<link\b[^>]*\brel="(?:canonical|alternate)"[^>]*>|<script type="application\/ld\+json">[\s\S]*?<\/script>/gi;
  return { cim: cim && cim.trim(), cimkek: [...fej.matchAll(minta)].map((m) => m[0].replace(/\s*\/>$/, '>')) };
}
function elesFej(ROOT, ut, html) {
  const r = ut === '/404' ? null : regiFej(ROOT, ut);   // a Wix 404-es lapjanak fejlece ("Post | Medical Piercing", canonical) nem kell
  const ki = html.replace(/<!-- Rejtett próbaoldal[^>]*-->\n?/, '').replace(/<meta name="robots" content="noindex,nofollow">\n?/, '');
  if (r) {
    const leirasVan = r.cimkek.some((c) => /name="description"/i.test(c));
    return ki.replace(/<title>[\s\S]*?<\/title>/, (m) => (r.cim ? `<title>${r.cim}</title>` : m))
      .replace(/<meta name="description" content="[^"]*">\n?/, (m) => (leirasVan ? '' : m))
      .replace(/(<meta name="viewport"[^>]*>\n?)/, (m) => `${m}${r.cimkek.join('\n')}\n`);
  }
  const cim = idezojel((/<title>([\s\S]*?)<\/title>/.exec(ki) || [])[1] || 'Medical Piercing');
  const leiras = (/<meta name="description" content="([^"]*)"/.exec(ki) || [])[1] || '';
  const sajat = ut === '/404' ? ['<meta name="robots" content="noindex,nofollow">']
    : [`<link rel="canonical" href="${DOMAIN}${ut}">`, `<meta property="og:title" content="${cim}">`, `<meta property="og:description" content="${leiras}">`,
      `<meta property="og:url" content="${DOMAIN}${ut}">`, '<meta property="og:site_name" content="Medical Piercing">', '<meta property="og:type" content="website">'];
  return ki.replace(/(<meta name="viewport"[^>]*>\n?)/, (m) => `${m}${sajat.join('\n')}\n`);
}

// --- egy oldal kiirasa asztali es mobil kiszolgalasra (a Wix-szel azonos kulcs-szabaly) --------------------------------------
export function oldalKiir(ROOT, DIST, ut, html) {
  const kulcs = ut === '/' ? 'index' : kulcsbol(ut);
  const nev = fajlnev(kulcs) + '.html';
  let kesz = kepVerzio(ROOT, kepFokusz(ROOT, fbBorito(ROOT, videoBorito(linkAtiras(ROOT, szovegJavit(velemenyLink(ut, osszerak(ROOT, html))))))));
  if (/karátos|14K arany|aranyozott|arannyal|arany (?:shenmen|ékszer|piercing)/i.test(kesz)) throw new Error(`${ut}: aranyos ekszer-szoveg maradt (a tulajdonos kerese: nincs arany)`);
  if (UJ_ELES && ut !== '/uj-oldalak') {
    kesz = elesFej(ROOT, ut, kesz);
    if (/\(új főoldal\)/.test(kesz)) throw new Error(`${ut}: a lapcim meg a rejtett probaoldale`);
    if (ut !== '/404' && !/rel="canonical"/i.test(kesz) && !/<meta name="robots" content="[^"]*noindex/i.test(kesz)) throw new Error(`${ut}: elesitve hianyzik a canonical`);
  } else {
    if (!/<meta name="robots" content="[^"]*noindex[^"]*"/i.test(kesz)) throw new Error(`${ut}: hianyzik a noindex meta (a lap rejtett)`);
    if (/rel="canonical"/i.test(kesz)) throw new Error(`${ut}: canonical nem lehet a noindex lapon`);
  }
  // minden helyi kep- es betu-hivatkozasnak letezni kell (hianyzo fajl = torott kep az eles lapon)
  const hianyzo = [...new Set([...kesz.matchAll(/(?:src|href|data-nagy)="(\/assets\/[^"?#]+)"/g)].map((m) => m[1]))].filter((f) => !fs.existsSync(path.join(ROOT, f)));
  if (hianyzo.length) throw new Error(`${ut}: hianyzo fajlok: ` + hianyzo.join(', '));
  for (const ki of ['_a', '_m']) {
    const cel = path.join(DIST, ki, nev);
    fs.mkdirSync(path.dirname(cel), { recursive: true });
    fs.writeFileSync(cel, kesz);
  }
  return nev;
}

export function ujFooldal(ROOT, DIST) {
  oldalKiir(ROOT, DIST, UJ_FOOLDAL_UT, fs.readFileSync(path.join(ROOT, 'uj-fooldal/index.html'), 'utf8'));
  console.log('uj-fooldal: ' + UJ_FOOLDAL_UT + (UJ_ELES ? ' (elesitve, a regi fooldal SEO-fejlecevel)' : ' (rejtett, noindex)') + ' asztali es mobil');
}

// --- az osszes tobbi oldal tukre: /uj/<eredeti utvonal> (uj-oldalak/tartalom/*.json -> tools/uj-oldalak/sablon.mjs) + a link-index (/uj-oldalak) ---
// A tartalmat a tools/uj-oldalak/kinyer.mjs szedi ki a Wix-klonbol (egyszer, a repoba mentve); a build csak a sablont futtatja (nincs bongeszo).
// Kihagyva: a foglalasi cimek (/idopontfoglalas, /kontroll: a foglalomotor nyitja), a kezdolap (az az uj fooldal kezzel irt valtozata).
const KIHAGY = new Set(['/', '/idopontfoglalas', '/kontroll']);
export function ujOldalak(ROOT, DIST) {
  const dir = path.join(ROOT, 'uj-oldalak/tartalom');
  if (!fs.existsSync(dir)) return;
  const lapozo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/varos-lapozo.json'), 'utf8'));
  const jegyzek = [{ ut: '/', cim: 'Főoldal (új főoldal)', tipus: 'oldal', uj: UJ_FOOLDAL_UT }];
  const eredeti = new Map(fs.readFileSync(path.join(ROOT, 'tools/oldalak.txt'), 'utf8').split('\n').filter(Boolean).map((u) => [decodeURIComponent(new URL(u).pathname).replace(/\/+$/, '') || '/', new URL(u).pathname]));
  let db = 0;
  const adatok = fs.readdirSync(dir).filter((x) => x.endsWith('.json') && !x.startsWith('_')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const utSzerint = new Map(adatok.map((a) => [a.ut, a]));
  const sajatDir = path.join(ROOT, 'uj-oldalak/sajat');
  const sajatNevek = new Set(fs.existsSync(sajatDir) ? fs.readdirSync(sajatDir).filter((x) => x.endsWith('.html')).map((x) => '/' + x.slice(0, -5)) : []);
  for (const adat of adatok) {
    if (KIHAGY.has(adat.ut) || KIZART_UTAK.has(adat.ut)) continue;
    if (sajatNevek.has(adat.ut)) continue;   // kezzel irt uj valtozata van (uj-oldalak/sajat/), lent irodik ki
    // a migren / shenmen / klimax / slim oldal alapja a "B" valtozat (az eredeti -b oldal tartalma, a kategoria-dizajnnal): ugyanazon a (b nelkuli) cimen
    // elesitve az eredeti -b cim (migren-piercing-b ...) is ugyanazt a B-oldalt adja: a Convertize-kiserlet (a mobilos latogatok egy reszet a -b oldalra
    // viszi) igy is az uj oldalt mutatja
    const bCim = UJ_ELES && [...B_ALAP.values()].includes(adat.ut);
    const bAdat = B_ALAP.has(adat.ut) ? utSzerint.get(B_ALAP.get(adat.ut)) : bCim ? adat : null;
    if (B_ALAP.has(adat.ut) && !bAdat) throw new Error(`${adat.ut}: hianyzik a B valtozat tartalma (${B_ALAP.get(adat.ut)})`);
    oldalKiir(ROOT, DIST, TUKOR_ELO + adat.ut, oldalHtml(ROOT, bAdat || adat, { lapozo, b: !!bAdat }));
    jegyzek.push({ ut: adat.ut, cim: (bAdat || adat).cim, tipus: adat.tipus, uj: TUKOR_ELO + (eredeti.get(adat.ut) || encodeURI(adat.ut)), regi: UJ_ELES ? REGI_ELO + (eredeti.get(adat.ut) || encodeURI(adat.ut)) : undefined });
    db++;
  }
  // --- kezzel irt uj oldalak (uj-oldalak/sajat/<nev>.html -> /uj/<nev>): az elso sor <!--oldal {"cim","leiras"} -->, utana a <main> tartalma ---
  // (Csapatunk, Kapcsolat, Ekszereink: a regi oldalon nincs ilyen onallo lap, a tulajdonos kerese 2026-10-16)
  if (fs.existsSync(sajatDir)) {
    for (const f of fs.readdirSync(sajatDir).filter((x) => x.endsWith('.html')).sort()) {
      const nev = f.slice(0, -5);
      const forras = fs.readFileSync(path.join(sajatDir, f), 'utf8');
      const m = /^<!--oldal (\{[\s\S]*?\}) -->\n/.exec(forras);
      if (!m) throw new Error(`uj-oldalak/sajat/${f}: hianyzik az elso sor (<!--oldal {"cim":...,"leiras":...} -->)`);
      const meta = JSON.parse(m[1]);
      const fo = osszerak(ROOT, forras.slice(m[0].length));
      const horgony = new Set([...fo.matchAll(/\sid="([a-z]+)"/g)].map((x) => x[1]));
      const adat = { ut: '/' + nev, kulcs: nev, cim: meta.cim, leiras: meta.leiras, tipus: 'oldal', szekciok: [] };
      oldalKiir(ROOT, DIST, TUKOR_ELO + adat.ut, oldalHtml(ROOT, adat, { fo, sajat: true, horgony, nagyito: /data-ekszer-galeria|id="ekszerek"/.test(fo) }));
      jegyzek.push({ ut: adat.ut, cim: meta.cim, tipus: 'oldal', uj: TUKOR_ELO + adat.ut });
      db++;
    }
  }
  const index = indexHtml(ROOT, jegyzek, { datum: new Date().toISOString().slice(0, 10) });
  oldalKiir(ROOT, DIST, '/uj-oldalak', index);
  if (!UJ_ELES) oldalKiir(ROOT, DIST, '/uj', index);   // a rovid cim (/uj) ugyanazt az attekintest adja (elesitve a /uj a fooldalra visz)
  console.log(UJ_ELES ? `uj-oldalak: ${db} uj oldal az EREDETI cimeken (elesitve; a regi oldal: ${REGI_ELO}/...) + link-index (/uj-oldalak, rejtett)`
    : `uj-oldalak: ${db} tukor-oldal (/uj/...) + link-index (/uj-oldalak), rejtett, noindex`);
  return jegyzek;
}

// --- kitelepulesek: a helyszin-csempek datumai a tablazatbol (a build irja be; a lap betolteskor frissiti: uj-fooldal.js) ----------
const HONAP_ROVID = { 'Január': 'Jan.', 'Február': 'Febr.', 'Március': 'Márc.', 'Április': 'Ápr.', 'Május': 'Máj.', 'Június': 'Jún.', 'Július': 'Júl.', 'Augusztus': 'Aug.', 'Szeptember': 'Szept.', 'Október': 'Okt.', 'November': 'Nov.', 'December': 'Dec.' };
export const rovidSor = (sor) => sor.replace(/^[A-ZÁÉÍÓÖŐÚÜŰa-záéíóöőúüű]+/, (h) => HONAP_ROVID[h] || h).replace(/,\s*/g, ',\u2009');
export function ujKitelepules(DIST, sorok) {
  let db = 0;
  const lapok = [];
  for (const ki of ['_a', '_m']) {
    const dir = path.join(DIST, ki);
    // elesitve minden lap (a regi oldalak /regi/ masolata nelkul: azokat a regi frissito kezeli); kulonben csak a rejtett uj lapok
    const uj = (f) => (UJ_ELES ? f.endsWith('.html') && !f.startsWith('regi/') : /^(uj-fooldal|uj\/.*)\.html$/.test(f));
    for (const f of fs.readdirSync(dir, { recursive: true })) if (uj(String(f).replace(/\\/g, '/'))) lapok.push(path.join(dir, f));
  }
  for (const f of lapok) {
    const html = fs.readFileSync(f, 'utf8');
    const uj = html.replace(/(<span class="datum" data-mp-kitelepules="([a-z]+)">)[^<]*(<\/span>)/g, (m, nyit, k, zar) => {
      if (!sorok[k] || !sorok[k].length) return m;
      db++;
      return nyit + sorok[k].map(rovidSor).join('<br>') + zar;
    });
    if (uj !== html) fs.writeFileSync(f, uj);
  }
  console.log(`uj-oldalak: kitelepulesi idopontok beirva (${db} csempe)`);
}
