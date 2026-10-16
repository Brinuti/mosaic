// Az uj, REJTETT oldalak (/uj-fooldal, es a /uj/... tukor) osszerakasa a dist/ mappaba (a build hivja: tools/build.mjs).
//
// Forras: uj-fooldal/index.html (a fooldal, kezzel irt), uj-oldalak/reszek/*.html (a kozos fejlec, lablec, ikonok), stilus:
// assets/css/uj-fooldal.css, szkript: assets/js/uj-fooldal.js, kepek: assets/img/ (az uj-* kepeket a tools/uj-fooldal-kepek.py gyartja).
// Nem a Wix-klon resze: a tools/wix2static.mjs nem erinti, es a klon/ mappaba sem kerul.
//
// A lapok a Wix-szel azonos cimeken el a tobbi oldal mellett, asztali es mobil kiszolgalasra is ugyanaz a (reszponziv) fajl.
// A mostani fooldalt (/) nem valtjak le. Rejtettek: nincsenek a sitemapben, semmi nem linkeli oket, noindex (meta + a fuggveny
// X-Robots-Tag fejlece); a build megall, ha a forrasbol a noindex hianyzik. A foglalomotor-inditot, a verziojeleket (?v=)
// es a foglalas-merest a build tobbi resze teszi ra, mint a tobbi lapra.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { kulcsbol, fajlnev } from '../lib/utvonal.js';
import { oldalHtml, indexHtml, KIZART_UTAK } from './uj-oldalak/sablon.mjs';
import { B_ALAP, GOOGLE_DB } from './uj-oldalak/kategoria.mjs';

export const UJ_FOOLDAL_UT = '/uj-fooldal';
export const TUKOR_ELO = '/uj';   // a tobbi oldal tukre: /uj/<eredeti utvonal>

// --- kozos reszek: <!--#nev--> -> uj-oldalak/reszek/nev.html ---------------------------------------------------------------
// <!--#velemenyek ti=<kulcs>--> : a velemeny-doboz egy masik (pl. kategoriankent szurt) Trustindex-widgettel
export function osszerak(ROOT, html) {
  return html.replace(/<!--#([a-z0-9-]+)(?: ti=([a-z0-9]+))?-->/g, (m, nev, ti) => {
    const resz = fs.readFileSync(path.join(ROOT, 'uj-oldalak/reszek', nev + '.html'), 'utf8').trimEnd();
    return ti ? resz.replace(/loader\.js\?[a-z0-9]+/, 'loader.js?' + ti) : resz;
  });
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
    if (/^\/(assets|api|_a|_m|uj\/|uj-)/.test(h) || /^\/(idopontfoglalas|kontroll)(?:[/?#]|$)/.test(h)) return m;
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
    // csak a szovegben (attributumban nem lehet <span>)
    .replace(/>([^<]*)</g, (m, t) => (/4\.100/.test(t) ? '>' + t.replace(/(?:[Tt]öbb mint\s+)?4\.100\+?/g, `<span data-ti-darab>${GOOGLE_DB}</span>`) + '<' : m));
}

// --- egy oldal kiirasa asztali es mobil kiszolgalasra (a Wix-szel azonos kulcs-szabaly) --------------------------------------
export function oldalKiir(ROOT, DIST, ut, html) {
  const kulcs = ut === '/' ? 'index' : kulcsbol(ut);
  const nev = fajlnev(kulcs) + '.html';
  const kesz = kepVerzio(ROOT, linkAtiras(ROOT, szovegJavit(osszerak(ROOT, html))));
  if (/karátos|14K arany|aranyozott|arannyal|arany (?:shenmen|ékszer|piercing)/i.test(kesz)) throw new Error(`${ut}: aranyos ekszer-szoveg maradt (a tulajdonos kerese: nincs arany)`);
  if (!/<meta name="robots" content="[^"]*noindex[^"]*"/i.test(kesz)) throw new Error(`${ut}: hianyzik a noindex meta (a lap rejtett)`);
  if (/rel="canonical"/i.test(kesz)) throw new Error(`${ut}: canonical nem lehet a noindex lapon`);
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
  console.log('uj-fooldal: ' + UJ_FOOLDAL_UT + ' (rejtett, noindex) asztali es mobil');
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
    const bAdat = B_ALAP.has(adat.ut) ? utSzerint.get(B_ALAP.get(adat.ut)) : null;
    if (B_ALAP.has(adat.ut) && !bAdat) throw new Error(`${adat.ut}: hianyzik a B valtozat tartalma (${B_ALAP.get(adat.ut)})`);
    oldalKiir(ROOT, DIST, TUKOR_ELO + adat.ut, oldalHtml(ROOT, bAdat || adat, { lapozo, b: !!bAdat }));
    jegyzek.push({ ut: adat.ut, cim: (bAdat || adat).cim, tipus: adat.tipus, uj: TUKOR_ELO + (eredeti.get(adat.ut) || encodeURI(adat.ut)) });
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
  oldalKiir(ROOT, DIST, '/uj', index);   // a rovid cim (/uj) ugyanazt az attekintest adja
  console.log(`uj-oldalak: ${db} tukor-oldal (/uj/...) + link-index (/uj-oldalak), rejtett, noindex`);
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
    for (const f of fs.readdirSync(dir, { recursive: true })) if (/^(uj-fooldal|uj\/.*)\.html$/.test(String(f).replace(/\\/g, '/'))) lapok.push(path.join(dir, f));
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
