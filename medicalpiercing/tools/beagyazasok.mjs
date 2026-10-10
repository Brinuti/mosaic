// A Wix HTML-beagyazasainak (HtmlComponent, www-medicalpiercing-hu.filesusr.com/html/...)
// helyi masolata. A wix2static.mjs a keretek cimet erre irja at (/assets/embed/<nev>.html).
//
//   node tools/beagyazasok.mjs
//
// A beagyazasok tartalma a Wix-szerkesztoben van (HTML-kod doboz); ha ott valtozik,
// ezt ujra kell futtatni. A bennuk hivatkozott kulso szolgaltatasokat kiirja.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets/embed');
fs.mkdirSync(OUT, { recursive: true });
const mappak = ['tools/elo-dom/asztali', 'tools/elo-dom/mobil'].map((m) => path.join(ROOT, m)).filter((m) => fs.existsSync(m));
const urlek = new Set();
for (const m of mappak) for (const f of fs.readdirSync(m, { recursive: true }).filter((x) => x.endsWith('.html'))) {
  for (const [u] of fs.readFileSync(path.join(m, f), 'utf8').matchAll(/https:\/\/www-medicalpiercing-hu\.filesusr\.com\/html\/[a-z0-9_]+\.html/g)) urlek.add(u);
}
for (const u of urlek) {
  const nev = u.split('/').pop();
  const v = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/131', referer: 'https://www.medicalpiercing.hu/' } });
  const html = await v.text();
  fs.writeFileSync(path.join(OUT, nev), html);
  const kulso = [...new Set([...html.matchAll(/(?:src|href)=["'](https?:\/\/[^"'/]+)/g)].map((m) => m[1]))];
  console.log(`${v.status} ${nev} ${(html.length / 1024).toFixed(1)} kB  ${kulso.join(' ')}`);
}
