// A /kontroll urlap telefonmezojenek orszagkod-valasztoja (uj Wix Forms) az eles oldalrol.
//
//   node tools/orszagok-mentes.mjs   -> assets/data/orszagok.json, assets/img/flag-<ISO3>(_2x).png
//
// A Wix a valasztot csak kattintasra rajzolja ki (a mentett oldalban nincs benne). Itt a Wixen
// asztali es mobil nezetben kinyitjuk, es elmentjuk: az orszagok listajat (ISO2, a zaszlo
// ISO3-neve, magyar nev, hivoszam, a Wix sorrendjeben), a lenyilo (asztalon) es az also panel
// (telefonon) vazat ures listaval, nezetenkent egy minta-sort, valamint a nyitott allapot nyilat. A
// zaszlokat (1x es 2x) helyi fajlba toltjuk, ugyanugy, ahogy a kivalasztott magyar zaszlo is
// helyi (assets/img/flag-HUN.png). A klon.js 16. szakasza ebbol rajzolja ki a valasztot.
//
// Merokeres nem megy ki (tools/meres-tiltas.mjs), es urlapot sem kuldunk be.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { meresTiltas } from './meres-tiltas.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const b = await chromium.launch();
const ki = {};
for (const MOB of [false, true]) {
  const ctx = await b.newContext(MOB ? { ...devices['Pixel 5'], locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' });
  await meresTiltas(ctx);
  await ctx.route(/\/_api\/(wix-forms|form-submission|forms)|\/forms\/v\d|submit/i, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto('https://www.medicalpiercing.hu/kontroll', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(8000);
  const g = p.locator('form [data-hook="country-selector-trigger"]').first();
  await g.scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await g.click();
  await p.waitForSelector('[role="listbox"].sAfN4Lu [role="option"]', { timeout: 15000 });
  await p.waitForTimeout(1000);
  ki[MOB ? 'mobil' : 'asztali'] = await p.evaluate(() => {
    const lb = document.querySelector('[role="listbox"].sAfN4Lu');
    let port = lb;
    while (port.parentElement !== document.body && !port.hasAttribute('data-floating-ui-portal')) port = port.parentElement;
    const kl = port.cloneNode(true);
    const klb = kl.querySelector('[role="listbox"]');
    const minta = klb.querySelector('[role="option"]').outerHTML;
    klb.innerHTML = '';
    const orszagok = [...lb.querySelectorAll('[role="option"]')].map((o) => [
      o.id.split('_option-')[1],
      ((o.querySelector('img') || {}).src || '').replace(/^.*square\/([A-Z0-9_]+)\.png.*$/, '$1'),
      ((o.querySelector('[data-hook="wut-text-aria-label"]') || {}).textContent || (o.querySelector('[aria-label]') || o).getAttribute('aria-label') || '').replace(/\s*\+\d+$/, '').trim(),
      (o.textContent.match(/\+\d+/) || [''])[0],
    ]);
    const nyil = document.querySelector('form [data-hook="country-selector-trigger"] .s__6zIpSX svg').outerHTML;
    return { vaz: kl.outerHTML, minta, orszagok, nyilFel: nyil };
  });
  await ctx.close();
}
await b.close();

const a = ki.asztali;
// a nevet az asztali lista adja (a mobil sor mas szerkezetu); a kod, a zaszlo es a hivoszam egyezzen
const kulcs = (o) => [o[0], o[1], o[3]].join(' ');
const kul = a.orszagok.filter((o, i) => !ki.mobil.orszagok[i] || kulcs(o) !== kulcs(ki.mobil.orszagok[i]));
if (a.orszagok.length < 200 || a.orszagok.some((o) => !o[2]) || a.orszagok.length !== ki.mobil.orszagok.length || kul.length) {
  console.log(a.orszagok.length, ki.mobil.orszagok.length, JSON.stringify(kul.slice(0, 5)), JSON.stringify(ki.mobil.orszagok.filter((o, i) => !a.orszagok[i] || kulcs(o) !== kulcs(a.orszagok[i])).slice(0, 5)));
  throw new Error('hianyos vagy eltero orszaglista');
}
const adat = { orszagok: a.orszagok, asztali: a.vaz, mobil: ki.mobil.vaz, minta: a.minta, mintaMobil: ki.mobil.minta, nyilFel: a.nyilFel };
fs.mkdirSync(path.join(ROOT, 'assets/data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'assets/data/orszagok.json'), JSON.stringify(adat));
console.log(`${a.orszagok.length} orszag -> assets/data/orszagok.json`);

// zaszlok
const ZASZLO = 'https://static.parastorage.com/services/linguist-flags/1.1005.0/assets/flags/square/';
let uj = 0;
for (const [, iso3] of a.orszagok) {
  for (const n of [iso3, iso3 + '_2x']) {
    const cel = path.join(ROOT, 'assets/img', `flag-${n}.png`);
    if (fs.existsSync(cel)) continue;
    const v = await fetch(ZASZLO + n + '.png');
    if (!v.ok) { console.log(`HIBA ${n}: ${v.status}`); continue; }
    fs.writeFileSync(cel, Buffer.from(await v.arrayBuffer()));
    uj++;
  }
}
console.log(`${uj} uj zaszlo -> assets/img/`);
