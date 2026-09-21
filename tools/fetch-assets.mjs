// MOSAIC Head Spa - Wix tartalom es media letolto
// Hasznalat: node tools/fetch-assets.mjs
import { writeFile, mkdir, readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SITE = 'https://www.mosaicheadspa.hu';

export const PAGES = [
  '/', '/headspa-budapest', '/paros-headspa-budapest', '/headspa-ferfiaknak',
  '/headspa-arak-budapest', '/head-spa-kedvezmeny', '/head-spa-velemenyek',
  '/headspa-termekek-oxygeni', '/lezeres-szortelenites-budapest',
  '/noi-fodraszat-budapest', '/noi-fodrasz-budapest-balayage-hajfestes',
  '/balayage-haj-festes-budapest', '/noi-hajfestes-budapest',
  '/oxigenterapia-budapest', '/sminktetovalas-budapest',
  '/headspa-ajandekkartya', '/4-kezes-headspa-ajandekkartya',
  '/idpontfoglalas', '/aszf', '/impresszum',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const slug = (s) => decodeURIComponent(s)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-')
  .replace(/^-|-$/g, '').toLowerCase();

async function getText(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'hu-HU,hu;q=0.9' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function download(url, dest) {
  if (await exists(dest)) return 'skip';
  const r = await fetch(url, { headers: { 'user-agent': UA, referer: SITE + '/' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  return 'ok';
}

// --- 1. oldalak letoltese -----------------------------------------------
await mkdir(path.join(ROOT, 'tools/raw'), { recursive: true });
await mkdir(path.join(ROOT, 'assets/img'), { recursive: true });
await mkdir(path.join(ROOT, 'assets/video'), { recursive: true });

const htmls = {};
for (const p of PAGES) {
  const name = (p === '/' ? 'index' : p.replace(/^\//, '')) + '.html';
  const file = path.join(ROOT, 'tools/raw', name);
  if (await exists(file)) { htmls[p] = await readFile(file, 'utf8'); console.log('cache', p); continue; }
  try {
    const html = await getText(SITE + p);
    await writeFile(file, html);
    htmls[p] = html;
    console.log('oldal', p, (html.length / 1024 | 0) + 'kB');
  } catch (e) { console.log('HIBA', p, e.message); }
}

// --- 2. media URL-ek gyujtese -------------------------------------------
const imgIds = new Map();   // mediaId -> friendly basename
const videoIds = new Map(); // videoId -> best quality

for (const [page, html] of Object.entries(htmls)) {
  for (const m of html.matchAll(/static\.wixstatic\.com\/media\/([A-Za-z0-9_~.%-]+?\.(?:jpg|jpeg|png|webp|gif))((?:\/v1\/[^"'\ )]*?)?)/gi)) {
    const id = decodeURIComponent(m[1]);
    const tail = m[2] || '';
    const last = tail.split('/').pop() || '';
    if (!imgIds.has(id) || (imgIds.get(id) === null && last)) {
      const friendly = /\.(jpg|jpeg|png|webp|gif)$/i.test(last) && !last.startsWith(id.slice(0, 12)) ? last : null;
      imgIds.set(id, friendly);
    }
  }
  for (const m of html.matchAll(/video\.wixstatic\.com\/video\/([A-Za-z0-9_~-]+)\/(\d+p|file)\/mp4\/file\.mp4/g)) {
    const [, id, q] = m;
    const rank = q === 'file' ? 0 : parseInt(q);
    if (!videoIds.has(id) || rank > videoIds.get(id).rank) videoIds.set(id, { q, rank });
  }
}

// --- 3. egyedi fajlnevek -------------------------------------------------
const used = new Set();
const manifest = { images: {}, videos: {} };
for (const [id, friendly] of imgIds) {
  const ext = (id.match(/\.([a-z]+)$/i) || [, 'jpg'])[1].toLowerCase();
  let base = friendly ? slug(friendly).replace(/\.[a-z]+$/, '') : slug(id.replace(/~mv2.*$/, '').replace(/\.[a-z]+$/, ''));
  if (!base) base = 'kep';
  let name = `${base}.${ext}`;
  if (used.has(name)) {
    name = `${base}-${createHash('sha1').update(id).digest('hex').slice(0, 6)}.${ext}`;
  }
  used.add(name);
  manifest.images['https://static.wixstatic.com/media/' + id] = 'assets/img/' + name;
}
for (const [id, { q }] of videoIds) {
  manifest.videos[`https://video.wixstatic.com/video/${id}/${q}/mp4/file.mp4`] = 'assets/video/' + slug(id) + '.mp4';
}

await writeFile(path.join(ROOT, 'tools/media-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nMedia: ${Object.keys(manifest.images).length} kep, ${Object.keys(manifest.videos).length} video`);

// --- 4. letoltes (parhuzamosan, korlatozva) ------------------------------
const jobs = [
  ...Object.entries(manifest.images),
  ...Object.entries(manifest.videos),
].map(([url, rel]) => ({ url, dest: path.join(ROOT, rel), rel }));

let done = 0, failed = [];
const CONC = 8;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (jobs.length) {
    const j = jobs.shift();
    try { await download(j.url, j.dest); }
    catch (e) { failed.push(j.rel + ' <- ' + e.message); }
    if (++done % 25 === 0) console.log(`  ${done} fajl kesz...`);
  }
}));

console.log(`\nKesz: ${done} fajl. Hibas: ${failed.length}`);
if (failed.length) console.log(failed.slice(0, 20).join('\n'));
