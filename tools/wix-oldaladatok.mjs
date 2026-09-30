// A Wix oldal-adatainak (page JSON) letoltese es a hianyzo tartalmak kigyujtese.
//
// A Wix a videolejatszok, a HTML-beagyazasok (HtmlComponent) es a terkepek
// tartalmat nem a HTML-ben kuldi, hanem egy kulon JSON-bol tolti be a bongeszoben.
// Ezert maradtak ezek a dobozok uresek a klonban. A JSON cime benne van minden
// lementett oldalban (tools/raw-mobil/*.html) - ez a szkript letolti mindket
// nezetben (mobil, asztali), es dobozonkent kiirja, mi tartozik hozza.
//
//   node tools/wix-oldaladatok.mjs
//
// Kell hozza halozat a siteassets.parastorage.com fele.
// Eredmeny:
//   tools/wix-json/<oldal>-<nezet>-<n>.json   a nyers valaszok (ujrafeldolgozhatok)
//   tools/wix-oldaladatok.json                oldalankent: doboz -> videok, poszterek, URL-ek
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'tools/raw-mobil');
const KI = path.join(ROOT, 'tools/wix-json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
fs.mkdirSync(KI, { recursive: true });

const htmlDekod = (s) => s.replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/');

// a mobil cimbol asztalit csinal
function asztali(url) {
  const u = new URL(url);
  u.searchParams.set('viewMode', 'desktop');
  u.searchParams.set('formFactor', 'desktop');
  if (u.searchParams.has('deviceType')) u.searchParams.set('deviceType', 'Desktop');
  return u.toString();
}

// Minden "comp-..." kulcsu objektumbol kigyujti, ami a tartalmat azonositja.
function kigyujt(json, talalat) {
  const bejar = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (/^comp-[a-z0-9]+$/.test(k) && v && typeof v === 'object') {
        const s = JSON.stringify(v);
        const t = talalat[k] || (talalat[k] = { videok: new Set(), poszterek: new Set(), url: new Set(), cimek: new Set() });
        for (const m of s.matchAll(/video\.wixstatic\.com\\?\/video\\?\/([a-z0-9]+_[a-f0-9]{32})/g)) t.videok.add(m[1]);
        for (const m of s.matchAll(/"(?:videoId|videoRef|uri)":"([a-z0-9]+_[a-f0-9]{32})(?:\/[^"]*)?"/g)) t.videok.add(m[1]);
        for (const m of s.matchAll(/([a-z0-9]+_[a-f0-9]{32})f00\d\.jpg/g)) t.poszterek.add(m[1]);
        for (const m of s.matchAll(/https?:\\?\/\\?\/[^"\s]*(?:filesusr\.com|youtube\.com|youtu\.be|vimeo\.com|salonic\.hu|trustindex\.io|google\.com\\?\/maps)[^"\s]*/g)) t.url.add(m[0].replace(/\\\//g, '/'));
        for (const m of s.matchAll(/"(?:title|name|alt)":"([^"]{2,120})"/g)) t.cimek.add(m[1]);
        // VideoPlayer-beallitasok (a klon.js KATTINTOS tablazatahoz)
        if (v.playableConfig && typeof v.src === 'string') {
          const nezet = v.isMobileView || v.isMobile ? 'mobil' : 'asztali';
          (t.lejatszo || (t.lejatszo = {}))[nezet] = {
            src: v.src,
            poszter: v.playableConfig.poster && v.playableConfig.poster.uri,
            autoplay: !!v.autoplay, muted: !!v.muted, loop: !!v.loop, controls: !!v.controls,
            hossz: v.duration,
          };
        }
      }
      bejar(v);
    }
  };
  bejar(json);
}

const eredmeny = {};
const fajlok = fs.readdirSync(RAW).filter((f) => f.endsWith('.html')).sort();
let hiba = 0;

for (const f of fajlok) {
  const oldal = f.replace(/\.html$/, '');
  const html = fs.readFileSync(path.join(RAW, f), 'utf8');
  const cimek = [...new Set([...html.matchAll(/https:\/\/siteassets\.parastorage\.com\/pages\/pages\/thunderbolt\?[^"'\s]+/g)]
    .map((m) => htmlDekod(m[0])))];
  const talalat = {};
  let n = 0;
  for (const mobilCim of cimek) {
    for (const [nezet, cim] of [['mobil', mobilCim], ['asztali', asztali(mobilCim)]]) {
      n++;
      try {
        const v = await fetch(cim, { headers: { 'user-agent': UA, referer: 'https://www.mosaicheadspa.hu/' } });
        if (!v.ok) { console.log(`  ${oldal} ${nezet}: HTTP ${v.status}`); hiba++; continue; }
        const json = await v.json();
        fs.writeFileSync(path.join(KI, `${oldal}-${nezet}-${n}.json`), JSON.stringify(json));
        kigyujt(json, talalat);
      } catch (e) {
        console.log(`  ${oldal} ${nezet}: ${e.message}`); hiba++;
      }
    }
  }
  // csak azokat a dobozokat tartjuk meg, amikhez tartalom tartozik
  const tiszta = {};
  for (const [k, t] of Object.entries(talalat)) {
    if (!t.videok.size && !t.url.size && !t.poszterek.size) continue;
    tiszta[k] = Object.fromEntries(Object.entries(t).map(([a, b]) => [a, b instanceof Set ? [...b] : b]));
  }
  eredmeny[oldal] = tiszta;
  console.log(`${oldal.padEnd(45)} ${Object.keys(tiszta).length} doboz tartalommal`);
}

fs.writeFileSync(path.join(ROOT, 'tools/wix-oldaladatok.json'), JSON.stringify(eredmeny, null, 1));
console.log(`\nKesz: tools/wix-oldaladatok.json${hiba ? ` (${hiba} sikertelen letoltes)` : ''}`);
