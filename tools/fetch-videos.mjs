// Wix videok letoltese.
// A Wix video-galeria poszterkepe <videoId>f000/f001/f002.jpg nevu, ebbol
// szarmaztathato a video URL-je: video.wixstatic.com/video/<videoId>/<q>/mp4/file.mp4
import { writeFile, mkdir, readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const QUALITIES = ['1080p', '720p', '480p'];

const ids = new Set();
const explicit = new Map(); // videoId -> quality (ha a HTML-ben szerepelt)

const files = (await readdir(path.join(ROOT, 'tools/raw'))).filter((f) => f.endsWith('.html'));
for (const f of files) {
  const html = await readFile(path.join(ROOT, 'tools/raw', f), 'utf8');
  for (const m of html.matchAll(/media\/([a-z0-9]+_[a-f0-9]{32})f\d{3}\.jpg/gi)) ids.add(m[1]);
  for (const m of html.matchAll(/video\.wixstatic\.com\/video\/([A-Za-z0-9_~-]+)\/(\d+p)\/mp4\/file\.mp4/g)) {
    ids.add(m[1]);
    explicit.set(m[1], m[2]);
  }
}

// a bongeszoben talalt, SSR-ben nem szereplo videok
for (const id of ['c2eb0f_909ce4959fe24f4f984d8953fd315d67']) ids.add(id);

console.log(ids.size, 'lehetseges video azonosito');
await mkdir(path.join(ROOT, 'assets/video'), { recursive: true });

const exists = async (p) => { try { await access(p); return true; } catch { return false; } };

const manifest = {};
let ok = 0, miss = 0;

async function tryOne(id) {
  const dest = path.join(ROOT, 'assets/video', id + '.mp4');
  const qs = explicit.has(id) ? [explicit.get(id), ...QUALITIES] : QUALITIES;
  if (await exists(dest)) { manifest[id] = 'assets/video/' + id + '.mp4'; ok++; return; }
  for (const q of qs) {
    const url = `https://video.wixstatic.com/video/${id}/${q}/mp4/file.mp4`;
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, referer: 'https://www.mosaicheadspa.hu/' } });
      if (!r.ok) continue;
      await writeFile(dest, Buffer.from(await r.arrayBuffer()));
      manifest[id] = 'assets/video/' + id + '.mp4';
      ok++;
      return;
    } catch { /* kovetkezo minoseg */ }
  }
  miss++;
}

const queue = [...ids];
await Promise.all(Array.from({ length: 5 }, async () => {
  while (queue.length) await tryOne(queue.shift());
}));

await writeFile(path.join(ROOT, 'tools/video-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Letoltve: ${ok}, nem talalhato: ${miss}`);
