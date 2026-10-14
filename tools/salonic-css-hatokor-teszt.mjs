// SALONIC ADATLAP (gyogytornas elrendezes, 2026-10-14): az uj blokk (salonic/mosaic.css, salonic/pmu.css) CSAK az adatlapon (page-booking-guestData-body) ervenyes,
// a "A foglalasod" oldalakra (reszletek / modositas / lemondas / sikeroldalak) NEM; a HeadSpa-fiok angol adatlapja nem kap magyar szoveget.
// Futtatas:  node tools/salonic-css-hatokor-teszt.mjs        Kornyezet: PLAYWRIGHT_UTVONAL (a playwright-core szulomappaja), CHROME_UTVONAL.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PW = process.env.PLAYWRIGHT_UTVONAL || '/opt/node22/lib/node_modules/playwright/node_modules';
const { chromium } = createRequire(path.join(PW, 'x.js'))('playwright-core');
const CHROME = process.env.CHROME_UTVONAL || undefined;

const FAJLOK = [['mosaic.css', 'customer-mosaic-oxigen'], ['mosaic.css', 'customer-mosaicheadspa'], ['pmu.css', 'customer-mosaic-pmu']];
const OLDALAK = ['page-booking-guestData-body', 'page-booking-bookingDetails-body', 'page-booking-selectDate-body', 'page-booking-editSuccess-body', 'page-booking-deleteSuccess-body'];
const eredmenyek = [];
const ell = (nev, ok, adat) => eredmenyek.push({ nev, ok: !!ok, adat: adat ?? null });

const bongeszo = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  for (const [fajl, osztaly] of FAJLOK) {
    const css = fs.readFileSync(path.join(GYOKER, 'salonic', fajl), 'utf8').replace(/@font-face[^}]*}/g, '');
    // szintaxis: a kapcsos zarojelek egyensulya (a "magyarazat" nelkuli szoveg)
    let d = 0, min = 0; for (const c of css.replace(/\/\*[\s\S]*?\*\//g, '')) { if (c === '{') d++; if (c === '}') d--; min = Math.min(min, d); }
    ell(`${fajl}: a kapcsos zarojelek egyensulyban vannak`, d === 0 && min === 0, { d, min });
    const lap = await (await bongeszo.newContext({ viewport: { width: 390, height: 800 } })).newPage();
    for (const id of OLDALAK) {
      await lap.setContent(`<!doctype html><html><head><style>${css}</style></head><body id="${id}" class="${osztaly} ${id}"><div class="cc-window" style="display:block">cookie</div><div class="panel-body"><div><span class="d-block mb-3">x</span><hr></div></div><div class="form-check"><label><input type="checkbox"><a class="policy">a</a>, <a class="policy">b</a><span class="required">*</span></label></div></body></html>`);
      const r = await lap.evaluate(() => ({ cc: getComputedStyle(document.querySelector('.cc-window')).display, mb3: getComputedStyle(document.querySelector('.d-block.mb-3')).display, lbl: getComputedStyle(document.querySelector('.form-check label')).fontSize }));
      const adatlap = id === 'page-booking-guestData-body';
      ell(`${fajl} (${osztaly}) ${id}: ${adatlap ? 'az uj blokk ervenyes (sutisav, "*-gal jelolt" mondat, hosszu hozzajarulas rejtve)' : 'az uj blokk NEM ervenyes (valtozatlan)'}`,
        adatlap ? (r.cc === 'none' && r.mb3 === 'none' && r.lbl === '0px') : (r.cc !== 'none' && r.mb3 !== 'none' && r.lbl !== '0px'), r);
    }
  }
  // magyar / angol rovid hozzajarulasi szoveg (::before): a HeadSpa-fiok angol, nem kaphat magyar szoveget
  const mosaic = fs.readFileSync(path.join(GYOKER, 'salonic', 'mosaic.css'), 'utf8').replace(/@font-face[^}]*}/g, '');
  const lap = await (await bongeszo.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  for (const [osztaly, var_] of [['customer-mosaic-hair', 'Megismertem'], ['customer-mosaicheadspa', 'I accept']]) {
    await lap.setContent(`<!doctype html><html><head><style>${mosaic}</style></head><body id="page-booking-guestData-body" class="${osztaly} page-booking-guestData-body"><div class="form-check"><label><input type="checkbox"><a class="policy">a</a>, <a class="policy">b</a><span class="required">*</span></label></div></body></html>`);
    const tartalom = await lap.evaluate(() => getComputedStyle(document.querySelector('.form-check label'), '::before').content);
    ell(`${osztaly}: a rovid hozzajarulasi szoveg nyelve (${var_})`, tartalom.includes(var_), tartalom);
  }
} finally { await bongeszo.close(); }

let rossz = 0;
for (const e of eredmenyek) { if (!e.ok) rossz++; console.log((e.ok ? 'OK   ' : 'HIBA ') + e.nev + (e.ok ? '' : '  ' + JSON.stringify(e.adat))); }
console.log(rossz === 0 ? `PASS (${eredmenyek.length}/${eredmenyek.length})` : `FAIL (${eredmenyek.length - rossz}/${eredmenyek.length})`);
process.exit(rossz === 0 ? 0 : 1);
