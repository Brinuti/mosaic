// A lezeres oldal "8 kezeles, csak 6-ot fizetsz" abrajanak kepernyokepe a LASER-EMAIL-03 levelhez (assets/email/laser/program-8-6.jpg).
// Az oldalt a helyi tesztszerver adja (tools/headspa-teszt/szerver.mjs), a kep a program-szekcio bal oszlopanak (cim + koros abra) 2x-es kepernyokepe, JPEG-re alakitva.
//   node tools/email-kepek/program-kepernyokep.mjs        (PLAYWRIGHT_UTVONAL: a playwright-core node_modules mappaja, ha nincs a repo mellett)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean);
let chromium;
for (const k of keres) { try { ({ chromium } = createRequire(path.join(k, 'x.js'))('playwright-core')); break; } catch { /* kovetkezo */ } }
if (!chromium) throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');

const { szerver, bazis } = await szerverInditas();
const bongeszo = await chromium.launch({ executablePath: process.env.CHROME_UTVONAL || undefined });
const p = await (await bongeszo.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 })).newPage();
await p.goto(bazis + '/lezeres-szortelenites-budapest', { waitUntil: 'load' });
await p.evaluate(() => { for (const e of document.querySelectorAll('body *')) { if (getComputedStyle(e).position === 'fixed') e.remove(); } });
const elem = p.locator('.program-racs > div').first(); // a bal oszlop: cim + az 1-8. alkalom koreibe (a jobb oldali szoveg es a "szamold ki" link nem kell)
await elem.scrollIntoViewIfNeeded();
const png = path.join(GYOKER, 'assets/email/laser/program-8-6.png');
const r = await elem.boundingBox();
await p.screenshot({ path: png, clip: { x: r.x - 28, y: r.y - 24, width: r.width + 56, height: r.height + 40 } });
await bongeszo.close(); szerver.close();
// PNG -> JPEG (1088 px szeles, <= 240 KB)
execFileSync('python3', ['-I', '-c', `
from PIL import Image
im = Image.open(${JSON.stringify(png)}).convert('RGB')
w = 1088
im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
im.save(${JSON.stringify(png.replace('.png', '.jpg'))}, 'JPEG', quality=84, optimize=True, progressive=True)
`]);
fs.unlinkSync(png);
console.log('kesz: assets/email/laser/program-8-6.jpg');
