// MOSAIC statikus oldalgenerator.
// A src/pages/*.html torzsekbol + src/partials/* sablonokbol keszit teljes
// HTML oldalakat a projekt gyokereben. Hasznalat: node tools/build.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const SITE = 'https://www.mosaicheadspa.hu';

const header = await readFile(path.join(SRC, 'partials/header.html'), 'utf8');
const footer = await readFile(path.join(SRC, 'partials/footer.html'), 'utf8');

// <!--include nev--> helyettesitese a src/partials/nev.html tartalmaval
async function expandIncludes(html) {
  const re = /<!--include\s+([a-z0-9-]+)\s*-->/gi;
  const names = [...html.matchAll(re)].map((m) => m[1]);
  for (const n of new Set(names)) {
    const part = await readFile(path.join(SRC, 'partials', n + '.html'), 'utf8');
    html = html.replace(new RegExp(`<!--include\\s+${n}\\s*-->`, 'gi'), () => part.trimEnd());
  }
  return html;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page({ meta, body }) {
  // aktiv menupont megjelolese (a meglevo class attributumba fuzve)
  const markActive = (html, key) => html.replace(
    new RegExp(`<li([^>]*)data-nav="${key}"`),
    (full, pre) => (/class="/.test(pre)
      ? `<li${pre.replace('class="', 'class="is-active ')}data-nav="${key}"`
      : `<li class="is-active"${pre}data-nav="${key}"`),
  );

  let nav = header;
  if (meta.nav) nav = markActive(nav, meta.nav);
  // ha almenupont aktiv, a szulo (Head Spa / Fodraszat) is kapjon jelolest
  if (meta.parent) nav = markActive(nav, meta.parent);

  const slug = meta.slug === 'index' ? '/' : '/' + meta.slug;

  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description || '')}">
<link rel="canonical" href="${SITE}${slug}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description || '')}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${slug}">
${meta.image ? `<meta property="og:image" content="${SITE}/${meta.image}">` : ''}
<link rel="icon" href="assets/img/c2eb0f_ebf1831725394a0591c64e442a81b333.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body>

${nav.trim()}

<main>
${body.trim()}
</main>

${footer.trim()}
</body>
</html>
`;
}

const files = (await readdir(path.join(SRC, 'pages'))).filter((f) => f.endsWith('.html'));
const built = [];

for (const f of files) {
  const raw = await readFile(path.join(SRC, 'pages', f), 'utf8');
  const m = raw.match(/^<!--meta\s*([\s\S]*?)-->/);
  if (!m) { console.log('KIHAGYVA (nincs meta):', f); continue; }
  const meta = JSON.parse(m[1]);
  meta.slug = f.replace(/\.html$/, '');
  const body = await expandIncludes(raw.slice(m[0].length));
  await writeFile(path.join(ROOT, f), page({ meta, body }));
  built.push(meta.slug);
  console.log('kesz:', f);
}

// sitemap.xml
const today = new Date().toISOString().slice(0, 10);
const urls = built.map((s) => `  <url><loc>${SITE}${s === 'index' ? '/' : '/' + s}</loc><lastmod>${today}</lastmod></url>`).join('\n');
await writeFile(path.join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

await writeFile(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

console.log(`\n${built.length} oldal legeneralva + sitemap.xml + robots.txt`);
