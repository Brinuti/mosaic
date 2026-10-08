// A lifecycle e-mailek kepernyokepes elonezete (a levelek ugyanazzal a kirajzolo kodjaval, mint az eles kuldesnel; a kepek a repo assets/ mappajabol, helyi szerverrol).
//
//   node tools/lifecycle-teszt/elonezet.mjs <ki-mappa> [AZONOSITO,AZONOSITO | mind] [szelesseg,szelesseg]
//   pl.: node tools/lifecycle-teszt/elonezet.mjs /tmp/elonezet PMU-EMAIL-04 600,390
//
// Kimenet: <ki-mappa>/<AZONOSITO>-<szelesseg>.png (teljes level) + <AZONOSITO>.html. Kornyezeti valtozok: PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja), CHROME_UTVONAL.
// A minta-vendeg / -foglalas ugyanaz, mint a minta-levelek.mjs-ben (Ferenc, 2026-10-28 16:00; a munkatars uzletagonkent: lezer Zsofi, PMU Melitta, hair Betti).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { KATALOG, KOZOS } from '../../netlify/lib/lifecycle/katalog/index.js';
import snapshot from '../../netlify/lib/lifecycle/szolgaltatasok.js';
import { szegmensek } from '../../netlify/lib/lifecycle/uzletag.js';
import { szegmensEgyezik } from '../../netlify/lib/lifecycle/terv.js';
import { ertekek, emailKirajzol, feladatKirajzol } from '../../netlify/lib/lifecycle/render.js';

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [kiMappa, lista = 'mind', szelessegek = '600,390'] = process.argv.slice(2);
if (!kiMappa) { console.error('hasznalat: node tools/lifecycle-teszt/elonezet.mjs <ki-mappa> [AZONOSITO,... | mind] [szelesseg,...]'); process.exit(1); }
fs.mkdirSync(kiMappa, { recursive: true });
const SZURO = lista === 'mind' ? null : new Set(lista.split(','));

const KEZDET = Math.floor(Date.UTC(2026, 9, 28, 15, 0) / 1000);
const MUNKATARS = { laser: 'Zsófi', pmu: 'Melitta', hair: 'Betti', headspa: null, oxygen: null };
function szolg(uzletag, uz) {
  const l = snapshot.szolgaltatasok.filter((s) => s.uzletag === uzletag).map((s) => s.nev);
  const jo = l.filter((n) => szegmensEgyezik(uz, szegmensek(uzletag, n)));
  return jo.find((n) => !/kupon|akci/i.test(n)) || jo[0] || l[0];
}
const fogl = (uzletag, nev, kezdet = KEZDET) => ({ id: 1, token: 'MINTA00001', uzletag, keresztnev: 'Ferenc', nev: 'Deák Ferenc', telefon: '+36709420090', email: 'deakfi@grantis.hu', szolgaltatas: nev, munkatars: MUNKATARS[uzletag], kezdet });

// helyi statikus szerver a repo gyokerere (a kepek / logo ugyanazzal az utvonallal, mint az eleshen)
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const szerver = http.createServer((q, s) => {
  const f = path.join(GYOKER, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(GYOKER) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
});
await new Promise((r) => szerver.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${szerver.address().port}`;

const tetelek = [];
for (const [uzletag, kat] of Object.entries(KATALOG)) for (const uz of kat.uzenetek) if (uz.csatorna !== 'sms' && (!SZURO || SZURO.has(uz.id))) tetelek.push({ uzletag, uz });
for (const uz of KOZOS.uzenetek) if (uz.csatorna === 'email' && (!SZURO || SZURO.has(uz.id))) tetelek.push({ uzletag: 'headspa', uz });
if (!tetelek.length) { console.error('nincs ilyen azonosito'); process.exit(1); }

function playwright() {
  for (const k of [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean)) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();
const bongeszo = await chromium.launch({ executablePath: process.env.CHROME_UTVONAL, headless: true });
for (const { uzletag, uz } of tetelek) {
  const f = fogl(uzletag, szolg(uzletag, uz));
  const ert = ertekek(f, 'email', { base, most: KEZDET - 5 * 86400, ujKezdet: KEZDET + 7 * 86400 });
  const ki = uz.csatorna === 'feladat' ? feladatKirajzol(uz, ert, f) : emailKirajzol(uz, ert);
  fs.writeFileSync(path.join(kiMappa, `${uz.id}.html`), ki.html);
  for (const w of szelessegek.split(',').map(Number)) {
    const ctx = await bongeszo.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    await p.setContent(ki.html, { waitUntil: 'load' });
    await p.waitForLoadState('networkidle').catch(() => {});
    const torott = await p.$$eval('img', (l) => l.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
    await p.screenshot({ path: path.join(kiMappa, `${uz.id}-${w}.png`), fullPage: true });
    console.log(`${uz.id} ${w}px${torott.length ? '  TOROTT KEP: ' + torott.join(', ') : ''}  tárgy: ${ki.targy}`);
    await ctx.close();
  }
}
await bongeszo.close(); szerver.close();
