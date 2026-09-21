// Jogi oldalak (ASZF, Impresszum) generalasa a kinyert szovegblokkbol.
import { readFile, writeFile } from 'node:fs/promises';
import { clean } from './rich.mjs';

const JOBS = [
  { page: 'aszf', block: 25, nav: 'aszf',
    title: 'ÁSZF - Általános Szerződési Feltételek - MOSAIC Head Spa',
    desc: 'A MOSAIC Head Spa (Big in Japan Kft.) általános szerződési feltételei.' },
  { page: 'impresszum', block: 25, nav: 'impresszum',
    title: 'Impresszum - MOSAIC Head Spa',
    desc: 'A MOSAIC Head Spa üzemeltetőjének, a Big in Japan Kft. adatai.' },
];

for (const j of JOBS) {
  const raw = JSON.parse(await readFile(`tools/content/${j.page}.json`, 'utf8'));
  const arr = Array.isArray(raw) ? raw : raw.blocks;
  const body = clean(arr[j.block].html);
  const meta = { title: j.title, description: j.desc, nav: j.nav };
  const out = `<!--meta\n${JSON.stringify(meta)}\n-->\n\n`
    + `<section class="section bg-white">\n  <div class="wrap mw-720 prose">\n`
    + body.split('\n').map((l) => '    ' + l).join('\n')
    + `\n  </div>\n</section>\n`;
  await writeFile(`src/pages/${j.page}.html`, out);
  console.log(j.page, '->', out.length, 'karakter');
}
