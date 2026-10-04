// A foglalo kis (160x160) bélyegképei a site meglévő képeiből (tools/booking-kepek.json): assets/img/booking/<kulcs>.jpg
//   node tools/booking-kepek.mjs      (a böngészővel kicsinyít: Chrome, Playwright; a forrás az assets/img/ eredeti képe, a vágás a fókusz-pontra)
//
// Egy bejegyzés: { kulcs, forras, fx, fy, zoom } (fókusz-pont és a kép hányada: a kép szöveget / keretet ne tartalmazzon: arra vágunk, ahol nincs),
// vagy { kulcs, mozaik: [kulcs, kulcs, kulcs, kulcs] }: 2x2-es mozaik a megnevezett (már megadott) bejegyzések vágataiból.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const lista = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/booking-kepek.json'), 'utf8').replace(/^\uFEFF/, ''));
const KI = path.join(ROOT, 'assets/img/booking');
fs.mkdirSync(KI, { recursive: true });
const forrasKep = (k) => fs.readFileSync(path.join(ROOT, 'assets/img', k.forras)).toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage();
await page.goto('about:blank');
// a megadott vágatok (tile-ok) egy 160x160-as vászonra: 1 db = teljes, 4 db = 2x2 mozaik (2 px fehér hézag)
const adat = (vagatok) => page.evaluate(async (vs) => {
  const c = document.createElement('canvas'); c.width = c.height = 160;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.fillStyle = '#fff'; g.fillRect(0, 0, 160, 160);
  const n = vs.length === 1 ? 1 : 2; const hezag = n === 1 ? 0 : 2; const cella = (160 - hezag * (n - 1)) / n;
  for (let i = 0; i < vs.length; i++) {
    const { b64, fx, fy, zoom } = vs[i];
    const kep = new Image(); kep.src = 'data:image/jpeg;base64,' + b64; await kep.decode();
    const oldal = Math.min(kep.naturalWidth, kep.naturalHeight) * zoom;
    const x = Math.max(0, Math.min(kep.naturalWidth - oldal, kep.naturalWidth * fx - oldal / 2));
    const y = Math.max(0, Math.min(kep.naturalHeight - oldal, kep.naturalHeight * fy - oldal / 2));
    g.drawImage(kep, x, y, oldal, oldal, (i % n) * (cella + hezag), Math.floor(i / n) * (cella + hezag), cella, cella);
  }
  return c.toDataURL('image/jpeg', 0.82).split(',')[1];
}, vagatok);
const vagat = (k) => ({ b64: forrasKep(k), fx: k.fx, fy: k.fy, zoom: k.zoom });
for (const k of lista) {
  const vagatok = k.mozaik ? k.mozaik.map((nev) => vagat(lista.find((x) => x.kulcs === nev))) : [vagat(k)];
  fs.writeFileSync(path.join(KI, k.kulcs + '.jpg'), Buffer.from(await adat(vagatok), 'base64'));
}
await browser.close();
console.log('kesz:', lista.length, 'kep ->', KI);
