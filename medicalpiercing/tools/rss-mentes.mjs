// A blog RSS-csatornaja (/blog-feed.xml) a Wixrol, egyszer lementve (a blogot a klon statikusan
// adja, uj bejegyzes nem keletkezik). A Wix-kepek (static.wixstatic.com) helyett a sajat
// /assets/img/ masolat; ami meg nincs meg, azt a csatornaban szereplo meretben letolti.
//
//   node tools/rss-mentes.mjs        -> assets/blog-feed.xml (a build a dist/blog-feed.xml-be teszi)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const IMG = path.join(ROOT, 'assets/img');
const v = await fetch('https://www.medicalpiercing.hu/blog-feed.xml');
if (!v.ok) throw new Error('blog-feed.xml: HTTP ' + v.status);
let xml = await v.text();
let csere = 0, uj = 0;
const urlek = [...new Set(xml.match(/https:\/\/static\.wixstatic\.com\/media\/[^"<>\s]+/g) || [])];
for (const u of urlek) {
  const m = /\/media\/([^/]+?)(?:~mv2)?\.(jpe?g|png|gif|webp)/i.exec(u);
  if (!m) continue;
  const alap = m[1], kit = m[2].toLowerCase();
  let nev = [`${alap}.${kit}`, `${alap}.jpg`, `${alap}.png`, `${alap}.webp`].find((n) => fs.existsSync(path.join(IMG, n)));
  if (!nev) {
    nev = `${alap}.${kit}`;
    const k = await fetch(u.replace(/\/file\.\w+$/, '/file.' + kit));
    if (!k.ok) { console.log('nem toltheto le:', u); continue; }
    fs.writeFileSync(path.join(IMG, nev), Buffer.from(await k.arrayBuffer()));
    uj++;
  }
  xml = xml.split(u).join(`https://www.medicalpiercing.hu/assets/img/${nev}`);
  csere++;
}
xml = xml.replace(/(<enclosure url="[^"]+\.(jpe?g|png|gif|webp)" length="0" type=")image\/png"/g, (s, a, k) => `${a}image/${k === 'jpg' ? 'jpeg' : k}"`);
fs.writeFileSync(path.join(ROOT, 'assets/blog-feed.xml'), xml);
console.log(`assets/blog-feed.xml: ${(xml.match(/<item>/g) || []).length} bejegyzes, ${csere} kep a sajat tarhelyrol (${uj} uj letoltes)`);
