// A foglalo kis (160x160) bélyegképei a site meglévő képeiből (tools/booking-kepek.json): assets/img/booking/<kulcs>.jpg
//   node tools/booking-kepek.mjs      (a böngészővel kicsinyít: Chrome, Playwright; a forrás az assets/img/ eredeti képe, a vágás a fókusz-pontra)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const lista = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/booking-kepek.json'), 'utf8'));
const KI = path.join(ROOT, 'assets/img/booking');
fs.mkdirSync(KI, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage();
await page.goto('about:blank');
for (const k of lista) {
  const b64 = fs.readFileSync(path.join(ROOT, 'assets/img', k.forras)).toString('base64');
  const adat = await page.evaluate(async ({ b64, fx, fy, zoom }) => {
    const kep = new Image(); kep.src = 'data:image/jpeg;base64,' + b64; await kep.decode();
    const oldal = Math.min(kep.naturalWidth, kep.naturalHeight) * zoom;
    const x = Math.max(0, Math.min(kep.naturalWidth - oldal, kep.naturalWidth * fx - oldal / 2));
    const y = Math.max(0, Math.min(kep.naturalHeight - oldal, kep.naturalHeight * fy - oldal / 2));
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(kep, x, y, oldal, oldal, 0, 0, 160, 160);
    return c.toDataURL('image/jpeg', 0.82).split(',')[1];
  }, { b64, fx: k.fx, fy: k.fy, zoom: k.zoom });
  fs.writeFileSync(path.join(KI, k.kulcs + '.jpg'), Buffer.from(adat, 'base64'));
}
await browser.close();
console.log('kesz:', lista.length, 'kep ->', KI);
