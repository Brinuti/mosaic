// Wix SSR HTML -> rendezett tartalomblokkok (sajat HTML megirasahoz)
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(await readFile(path.join(ROOT, 'tools/media-manifest.json'), 'utf8'));

const localFor = (url) => {
  const m = url.match(/\/media\/([A-Za-z0-9_~.%-]+?\.(?:jpg|jpeg|png|webp|gif))/i);
  if (!m) return null;
  return manifest.images['https://static.wixstatic.com/media/' + decodeURIComponent(m[1])] || null;
};

function cleanRich(html) {
  return html
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/\sdata-testid="[^"]*"/g, '')
    .replace(/<span style="[^"]*font-family[^"]*">/g, '<span>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

await mkdir(path.join(ROOT, 'tools/content'), { recursive: true });
const files = (await readdir(path.join(ROOT, 'tools/raw'))).filter(f => f.endsWith('.html'));

for (const f of files) {
  const html = await readFile(path.join(ROOT, 'tools/raw', f), 'utf8');
  const blocks = [];
  // sorrendhelyes vegigjaras: rich text, kep, gomb
  const re = /(<div[^>]*data-testid="richTextElement"[^>]*>)|(<img\b[^>]*>)|(<a\b[^>]*data-testid="linkElement"[^>]*>)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      // rich text blokk vegenek keresese (egyszeru div-melyseg szamlalas)
      let i = re.lastIndex, depth = 1;
      const sub = /<\/?div\b[^>]*>/gi; sub.lastIndex = i;
      let s;
      while (depth > 0 && (s = sub.exec(html))) {
        depth += s[0].startsWith('</') ? -1 : 1;
        i = sub.lastIndex;
      }
      const inner = html.slice(re.lastIndex, i - 6);
      const txt = cleanRich(inner);
      if (txt.replace(/<[^>]*>/g, '').trim()) blocks.push({ t: 'text', html: txt });
      re.lastIndex = i;
    } else if (m[2]) {
      const src = (m[2].match(/\ssrc="([^"]+)"/) || [])[1] || '';
      const alt = (m[2].match(/\salt="([^"]*)"/) || [])[1] || '';
      const local = localFor(src);
      if (local) blocks.push({ t: 'img', local, alt });
    } else {
      const href = (m[3].match(/\shref="([^"]+)"/) || [])[1] || '';
      const close = html.indexOf('</a>', re.lastIndex);
      const label = html.slice(re.lastIndex, close).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (label) blocks.push({ t: 'link', href, label });
    }
  }
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1] || '';
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
  const out = { file: f, title, desc, blocks };
  await writeFile(path.join(ROOT, 'tools/content', f.replace('.html', '.json')), JSON.stringify(out, null, 1));
  console.log(f.padEnd(45), blocks.length, 'blokk');
}
