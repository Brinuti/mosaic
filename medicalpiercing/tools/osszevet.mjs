// Kepernyokepes osszevetes: az eles Wix-oldal es a helyi klon (tools/serve.mjs) egymas mellett.
//
//   node tools/osszevet.mjs [--mobil] <kulcs> [kulcs...]   -> tools/osszevetes/<kulcs>[-m].png
//
// Mindket oldalt vegiggorgeti (a Wix lustan tolt), majd teljes oldalas kepet keszit,
// es kiirja a ket oldal magassagat. A kepek nincsenek a tarhazban.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { oldalak } from './oldalak.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'tools/osszevetes');
fs.mkdirSync(OUT, { recursive: true });
const MOBIL = process.argv.includes('--mobil');
const HELYI = process.env.HELYI || 'http://localhost:4290';
const kertek = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const lista = oldalak().filter((o) => kertek.includes(o.kulcs));

const b = await chromium.launch();
const ctxOpt = MOBIL ? { ...devices['Pixel 5'] } : { viewport: { width: 1440, height: 900 } };
async function kep(url, fajl) {
  const ctx = await b.newContext(ctxOpt);
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 90000 }).catch((e) => console.log('  ! ' + e.message));
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(2500);
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.screenshot({ path: fajl, fullPage: true });
  await ctx.close();
  return h;
}
for (const o of lista) {
  const sfx = MOBIL ? '-m' : '';
  const nev = o.kulcs.replace(/\//g, '__');
  const he = await kep(o.url, path.join(OUT, `${nev}${sfx}-eredeti.png`));
  const hk = await kep(HELYI + encodeURI(o.ut), path.join(OUT, `${nev}${sfx}-klon.png`));
  console.log(`${o.kulcs.padEnd(50)} eredeti ${he}px  klon ${hk}px  ${he === hk ? 'OK' : 'ELTER ' + (hk - he)}`);
}
await b.close();
