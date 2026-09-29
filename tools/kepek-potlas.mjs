// A hianyzo wixstatic kepek letoltese helybe.
// Hasznalat: node tools/kepek-potlas.mjs
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const RAWOK = [path.join(ROOT, 'tools/raw'), path.join(ROOT, 'tools/raw-mobil')];
const IMG = path.join(ROOT, 'assets/img');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const megvan = new Set(fs.readdirSync(IMG));

// minden wixstatic media-hivatkozas osszegyujtese
const kellenek = new Map(); // helyi fajlnev -> letoltesi URL (transzformacio nelkul, eredeti meret)
for (const RAW of RAWOK) for (const f of fs.readdirSync(RAW).filter((x) => x.endsWith('.html'))) {
  const s = fs.readFileSync(path.join(RAW, f), 'utf8');
  for (const m of s.matchAll(/https:\/\/static\.wixstatic\.com\/media\/([^"'\s)]+)/g)) {
    const u = decodeURIComponent(m[0]);
    const azon = u.match(/\/media\/([A-Za-z0-9_]+?)(?:~mv2)?(?:_[a-z]_[0-9_]+)*\.(jpg|jpeg|png|gif|webp|avif|svg)(?:$|[/?])/i);
    if (!azon) continue;
    const nev = azon[1] + '.' + azon[2].toLowerCase();
    if (megvan.has(nev) || kellenek.has(nev)) continue;
    // az eredeti fajl a /v1/ transzformacio nelkuli utvonalon erheto el
    kellenek.set(nev, u.split('/v1/')[0]);
  }
}

console.log(`${kellenek.size} hianyzo kep`);
let ok = 0, hiba = 0;
for (const [nev, url] of kellenek) {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) { console.warn(`  ! ${nev}: HTTP ${r.status}`); hiba++; continue; }
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(path.join(IMG, nev), buf);
  ok++;
  console.log(`  ${nev} (${(buf.length / 1024).toFixed(0)} kB)`);
}
console.log(`\n${ok} letoltve, ${hiba} hiba`);
