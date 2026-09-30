// A Wix VideoPlayer-dobozok videoinak es poszterkepeinek letoltese a
// tools/wix-oldaladatok.json alapjan (elobb: node tools/wix-oldaladatok.mjs).
//
//   node tools/videok-letoltese.mjs
//
// A videot abban a minosegben toltjuk le, amit az eles oldal lejatszoja kap
// (video.wixstatic.com/video/<id>/<q>/mp4/file.mp4), a posztert eredeti meretben
// (static.wixstatic.com/media/<id>f00N.jpg). A mar meglevo fajlokat kihagyja.
// A GitHub fajlonkent 100 MB-ot enged: ami ennel nagyobb, azt kisebb minosegben
// probalja ujra.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const KORLAT = 95 * 1024 * 1024;
const MINOSEGEK = ['1080p', '720p', '480p', '360p'];

const adatok = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/wix-oldaladatok.json'), 'utf8'));
const videok = new Map();   // id -> minoseg
const poszterek = new Set();
for (const dobozok of Object.values(adatok)) {
  for (const t of Object.values(dobozok)) {
    for (const l of Object.values(t.lejatszo || {})) {
      const m = /video\/([a-z0-9]+_[a-f0-9]{32})\/(\d+p)\//.exec(l.src || '');
      if (m) videok.set(m[1], m[2]);
      if (l.poszter) poszterek.add(l.poszter);
    }
  }
}

const letolt = async (url, cel, korlat = Infinity) => {
  const v = await fetch(url, { headers: { 'user-agent': UA, referer: 'https://www.mosaicheadspa.hu/' } });
  if (!v.ok) return `HTTP ${v.status}`;
  const b = Buffer.from(await v.arrayBuffer());
  if (b.length > korlat) return `tul nagy (${(b.length / 1048576).toFixed(0)} MB)`;
  fs.writeFileSync(cel, b);
  return null;
};

let uj = 0, hiba = 0;
fs.mkdirSync(path.join(ROOT, 'assets/video'), { recursive: true });
for (const [id, q] of videok) {
  const cel = path.join(ROOT, 'assets/video', id + '.mp4');
  if (fs.existsSync(cel)) continue;
  let ok = false;
  for (const mq of MINOSEGEK.slice(Math.max(0, MINOSEGEK.indexOf(q)))) {
    const h = await letolt(`https://video.wixstatic.com/video/${id}/${mq}/mp4/file.mp4`, cel, KORLAT);
    console.log(`video  ${id} ${mq}: ${h || 'ok ' + (fs.statSync(cel).size / 1048576).toFixed(1) + ' MB'}`);
    if (!h) { ok = true; uj++; break; }
  }
  if (!ok) hiba++;
}
for (const p of poszterek) {
  const cel = path.join(ROOT, 'assets/img', p);
  if (fs.existsSync(cel)) continue;
  const h = await letolt(`https://static.wixstatic.com/media/${p}`, cel);
  console.log(`poszter ${p}: ${h || 'ok'}`);
  if (h) hiba++; else uj++;
}
console.log(`\n${videok.size} video, ${poszterek.size} poszter; ${uj} uj fajl${hiba ? `, ${hiba} sikertelen` : ''}`);
