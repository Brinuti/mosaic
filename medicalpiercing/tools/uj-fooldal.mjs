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
import { oldalHtml, indexHtml } from './uj-oldalak/sablon.mjs';

export const UJ_FOOLDAL_UT = '/uj-fooldal';
export const TUKOR_ELO = '/uj';   // a tobbi oldal tukre: /uj/<eredeti utvonal>

// --- kozos reszek: <!--#nev--> -> uj-oldalak/reszek/nev.html ---------------------------------------------------------------
export function osszerak(ROOT, html) {
  return html.replace(/<!--#([a-z0-9-]+)-->/g, (m, nev) => fs.readFileSync(path.join(ROOT, 'uj-oldalak/reszek', nev + '.html'), 'utf8').trimEnd());
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
  tukor = fs.existsSync(f) ? new Set(JSON.parse(fs.readFileSync(f, 'utf8')).map((o) => o.ut)) : new Set();
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

// --- egy oldal kiirasa asztali es mobil kiszolgalasra (a Wix-szel azonos kulcs-szabaly) --------------------------------------
export function oldalKiir(ROOT, DIST, ut, html) {
  const kulcs = ut === '/' ? 'index' : kulcsbol(ut);
  const nev = fajlnev(kulcs) + '.html';
  const kesz = kepVerzio(ROOT, linkAtiras(ROOT, osszerak(ROOT, html)));
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
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json') && !x.startsWith('_')).sort()) {
    const adat = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (KIHAGY.has(adat.ut)) continue;
    oldalKiir(ROOT, DIST, TUKOR_ELO + adat.ut, oldalHtml(ROOT, adat, { lapozo }));
    jegyzek.push({ ut: adat.ut, cim: adat.cim, tipus: adat.tipus, uj: TUKOR_ELO + (eredeti.get(adat.ut) || encodeURI(adat.ut)) });
    db++;
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
