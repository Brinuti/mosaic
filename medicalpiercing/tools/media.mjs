// A Wix-oldalak kepeinek es videoinak letoltese helyi fajlba.
//
//   node tools/media.mjs
//
// Kepek: a Wix az eredeti feltoltott kepet (media/<id>) futas kozben meretezi; mi az
// eredetit mentjuk le assets/img/<id>.<ext> neven (a ~mv2 jelzo nelkul) - a
// wix2static.mjs erre irja at a hivatkozasokat. A tul nagy eredetiket a
// tools/kepek-kicsinyites.mjs kicsinyiti.
// Videok: a legjobb minosegu mp4 (assets/video/<id>.mp4).
// A mar meglevo fajlokat nem tolti le ujra.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
// az eredetiek a tools/eredeti-kepek/ ala (nincs a tarhazban); a kiszolgalt, kicsinyitett
// valtozatot a tools/kepek-kicsinyites.py teszi az assets/img/ ala
const IMG = path.join(ROOT, 'tools/eredeti-kepek');
// az eredeti videok is gyorsitotarba; a kiszolgalt, tomoritett valtozatot a tools/videok.mjs keszíti
const VID = path.join(ROOT, 'tools/eredeti-videok');
fs.mkdirSync(IMG, { recursive: true });
fs.mkdirSync(VID, { recursive: true });

const oldalFajlok = (mappa) => fs.readdirSync(mappa, { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => path.join(mappa, f));
const kepek = new Map();  // helyi nev -> tavoli cim
const videok = new Map(); // id -> { q, rang }
const MAPPAK = ['tools/raw', 'tools/raw-mobil', 'tools/elo-dom/asztali', 'tools/elo-dom/mobil'].map((m) => path.join(ROOT, m)).filter((m) => fs.existsSync(m));
for (const f of MAPPAK.flatMap(oldalFajlok)) {
  const html = fs.readFileSync(f, 'utf8');
  for (const [, id, ext] of html.matchAll(/static\.wixstatic\.com\/media\/([A-Za-z0-9_]+?)(?:~mv2|%7Emv2)?(?:_[a-z]_[0-9_]+)*\.(jpg|jpeg|png|gif|webp|avif|svg)/gi)) {
    const nev = id + '.' + ext.toLowerCase();
    if (!kepek.has(nev)) kepek.set(nev, null);
  }
  // a pontos tavoli fajlnev (~mv2-vel vagy anelkul) kell a letolteshez
  for (const [, teljes, id, ext] of html.matchAll(/static\.wixstatic\.com\/media\/(([A-Za-z0-9_]+?)(?:~mv2|%7Emv2)?(?:_[a-z]_[0-9_]+)*\.(jpg|jpeg|png|gif|webp|avif|svg))/gi)) {
    const nev = id + '.' + ext.toLowerCase();
    if (!kepek.get(nev)) kepek.set(nev, 'https://static.wixstatic.com/media/' + teljes.replace('%7E', '~'));
  }
  for (const [, id, q] of html.matchAll(/video\/([a-z0-9]{6}_[a-f0-9]{32})\/(\d+)p\/mp4\/file\.mp4/g)) {
    if (!videok.has(id) || +q > videok.get(id)) videok.set(id, +q);
  }
}

const feladatok = [
  ...[...kepek].map(([nev, url]) => ({ url, cel: path.join(IMG, nev) })),
  ...[...videok].map(([id, q]) => ({ url: `https://video.wixstatic.com/video/${id}/${q}p/mp4/file.mp4`, cel: path.join(VID, id + '.mp4') })),
].filter((f) => !fs.existsSync(f.cel));

let kesz = 0; const hibak = [];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (feladatok.length) {
    const f = feladatok.shift();
    try {
      const v = await fetch(f.url, { headers: { 'user-agent': UA, referer: 'https://www.medicalpiercing.hu/' } });
      if (!v.ok) throw new Error('HTTP ' + v.status);
      fs.writeFileSync(f.cel, Buffer.from(await v.arrayBuffer()));
      kesz++;
    } catch (e) { hibak.push(`${path.basename(f.cel)} <- ${f.url}: ${e.message}`); }
  }
}));
console.log(`${kepek.size} kep, ${videok.size} video; ${kesz} uj fajl letoltve, ${hibak.length} hiba`);
for (const h of hibak) console.log('  HIBA ' + h);
