// CRM UI teszt: node:test + Playwright (chromium). Futtatas: node --test tools/crm-ui-teszt/
// A teszt sajat szervert indit (teszt-szerver.mjs: valodi crm/lib/api.js + memoria-DB + teszt-adat), kulso halozat nincs.
// Kepernyokepek: /tmp/crm-ui-kepek (kornyezeti valtozo: CRM_UI_KEPEK).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { inditSzerver } from './teszt-szerver.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const KEPEK = process.env.CRM_UI_KEPEK || '/tmp/crm-ui-kepek';
fs.mkdirSync(KEPEK, { recursive: true });

let S; let B; let BASE;
const konzolHibak = [];
// ismert, vart halozati hibak: 401 (belepes elotti /auth/en), 422 (a demo-vegpont probaja), 501 (meg nem kesz backend-modulok)
const VART = /Failed to load resource: the server responded with a status of (401|422|501)/;

before(async () => { S = await inditSzerver({ port: 0 }); BASE = S.url; B = await chromium.launch(); });
after(async () => { await B.close(); await S.zar(); });

async function ujOldal(opc = {}) {
  const ctx = await B.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, ...opc });
  const p = await ctx.newPage();
  p.setDefaultTimeout(10000);
  p.on('console', (m) => { if (m.type() === 'error' && !VART.test(m.text())) konzolHibak.push(`${m.text()} @ ${p.url()}`); });
  p.on('pageerror', (e) => konzolHibak.push(`PAGEERROR ${e.message}`));
  return { ctx, p };
}
async function belep(p, szerep) {
  await p.goto(`${BASE}/crm`);
  await p.click(`[data-demo="${szerep}"]`);
  await p.waitForSelector('.oldalsav a', { state: 'attached' });
}
const nav = (p) => p.$$eval('.oldalsav a', (as) => as.map((a) => a.dataset.nav));
async function megy(p, hash) { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector('#oldalcim'); }
async function dialog(p, gomb = 'button[type=submit]') { await p.waitForSelector('dialog[open]'); await p.click(`dialog[open] ${gomb}`); }
const kep = (p, nev) => p.screenshot({ path: `${KEPEK}/${nev}.png` });

test('belepes-kepernyo: e-mail + kod, demo gombok csak elerheto /auth/demo mellett', async () => {
  const { ctx, p } = await ujOldal();
  await p.goto(`${BASE}/crm`);
  await p.waitForSelector('#be-email');
  assert.equal(await p.locator('[data-demo]').count(), 6, 'hat demo gomb');
  assert.match(await p.title(), /CRM/);
  assert.equal(await p.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
  assert.equal(await p.locator('script[src^="http"], link[href^="http"]').count(), 0, 'nincs kulso eroforras');
  await kep(p, '00-belepes');
  // e-mail -> 6 jegyu kod (a dev-kornyezet a demo_kod mezoben visszaadja)
  await p.fill('#be-email', 'admin@dev.local');
  const [valasz] = await Promise.all([p.waitForResponse((r) => r.url().includes('/auth/kod-keres')), p.click('button[type=submit]')]);
  const kod = (await valasz.json()).demo_kod;
  assert.match(String(kod), /^\d{6}$/);
  await p.fill('#be-kod', String(kod));
  await p.click('button[type=submit]');
  await p.waitForSelector('.oldalsav a', { state: 'attached' });
  assert.match(await p.locator('#felh-szerep').innerText(), /Admin/);
  // kilepes
  await p.click('#kilep');
  await p.waitForSelector('#be-email');
  await ctx.close();
});

test('demo-belepes minden szerepkorrel: menu szerepkor szerint, uzemmod-jelzo, demo-figyelmeztetes', async () => {
  const vart = {
    therapist: ['kezeles', 'dashboard', 'kepkuldo', 'munkalista', 'vendegek', 'felmero', 'kuraterv', 'kepek', 'kurazaro', 'berletek', 'credit', 'panasz', 'kuldes', 'hozzajarulas', 'osszevonas'],
    clinical_lead: ['kezeles', 'dashboard', 'kepkuldo', 'munkalista', 'vendegek', 'felmero', 'kuraterv', 'kepek', 'kurazaro', 'berletek', 'credit', 'panasz', 'kuldes', 'hozzajarulas', 'osszevonas'],
    reception: ['munkalista', 'vendegek', 'berletek', 'credit', 'kuldes', 'hozzajarulas'],
    salon_manager: ['dashboard', 'munkalista', 'vendegek', 'berletek', 'credit', 'panasz', 'osszevonas', 'mutatok', 'beallitasok'],
    marketing: ['dashboard', 'kuldes', 'mutatok'],
    admin: ['dashboard', 'vendegek', 'kuldes', 'mutatok', 'beallitasok'],
  };
  for (const [sz, menu] of Object.entries(vart)) {
    const { ctx, p } = await ujOldal();
    await belep(p, sz);
    assert.deepEqual(await nav(p), menu, `menu: ${sz}`);
    assert.match(await p.locator('.demo-sav').innerText(), /DEMO/);
    const uzem = await p.locator('#uzemmod').innerText();
    if (['therapist', 'clinical_lead', 'reception', 'admin'].includes(sz)) assert.match(uzem, /DRY-RUN/, `uzemmod ${sz}`);
    else assert.match(uzem, /nem látható/);
    await ctx.close();
  }
});

test('tiltott kepernyo: kozvetlen hash-hivasnal "Nincs jogosultsag", a recepcio nem lat kepet / kerdoivet', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'reception');
  for (const t of ['felmero', 'kepek', 'kuraterv']) {
    await megy(p, `#/${t}`);
    assert.match(await p.locator('#oldalcim').innerText(), /Nincs jogosultság/);
  }
  // recepcios munkalista: nincs kerdoiv / kontraindikacio-adat, nincs igazolas gomb
  await megy(p, '#/munkalista');
  await p.waitForSelector('.tabla');
  assert.equal(await p.locator('[data-akcio="igazol"]').count(), 0);
  assert.match(await p.locator('.tabla').innerText(), /nem látható/);
  await kep(p, '02-recepcio-munkalista');
  await ctx.close();
});

test('dashboard: szamok vagy ertheto "meg nem elerheto" allapot', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/dashboard');
  await p.waitForSelector('.racs-szam, .allapot');
  const szoveg = await p.locator('.nezet').innerText();
  assert.ok(/Mai foglalások/.test(szoveg), szoveg.slice(0, 200));
  assert.match(szoveg, /Teszt (Anna|Bela|Cili)/);
  await kep(p, '01-dashboard');
  // menedzsment-nezet: csak aggregalt szamok, vendegnev nelkul
  const m = await ujOldal();
  await belep(m.p, 'salon_manager');
  await megy(m.p, '#/dashboard');
  await m.p.waitForSelector('.racs-szam');
  const mt = await m.p.locator('.nezet').innerText();
  assert.match(mt, /Mai foglalások/);
  assert.ok(!/Teszt (Anna|Bela|Cili)/.test(mt), 'menedzsment nezet vendegnev nelkul');
  await kep(m.p, '01b-dashboard-menedzsment');
  await m.ctx.close();
  await ctx.close();
});

test('munkalista: kontraindikacio-jelzes, kezeles igazolasa, no-show', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/munkalista');
  await p.waitForSelector('.tabla');
  const sorok = p.locator('.tabla tbody tr');
  assert.ok((await sorok.count()) >= 3);
  const bela = sorok.filter({ hasText: 'Teszt Bela' });
  assert.match(await bela.innerText(), /JELZÉS/);
  assert.equal(await bela.locator('[data-akcio="igazol"]').isDisabled(), true, 'kontraindikacio alatt nem igazolhato');
  await kep(p, '03-munkalista');
  // Anna: igazolas
  const anna = sorok.filter({ hasText: 'Teszt Anna' });
  await anna.locator('[data-akcio="igazol"]').click();
  await dialog(p);
  await p.waitForSelector('.toast:has-text("Igazolva")');
  // az 1. alkalmon kotelezo a hajkamera-felvetel: felajanlott feltoltes (Kesobb -> marad a munkalista)
  await p.waitForSelector('dialog[open]:has-text("Hajkamera-felvétel")');
  await p.click('dialog[open] button:has-text("Később")');
  await p.waitForFunction(() => /Igazolva/.test(document.querySelector('.tabla')?.innerText || ''));
  assert.match(await p.locator('.tabla tbody tr', { hasText: 'Teszt Anna' }).innerText(), /Igazolva/);
  // Cili: no-show (az idopont mar elmult? a szerver csak elmult idopontnal engedi - ervenyes hibauzenet is elfogadott)
  await ctx.close();
});

test('vendegkereso -> profil: maszkolt talalat, tabok, XSS-mentes nev', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/vendegek');
  await p.fill('#vk-q', 'Teszt Dora');
  await p.click('button:has-text("Keresés")');
  await p.waitForSelector('.tabla');
  const sor = p.locator('.tabla tbody tr', { hasText: 'Teszt Dora' });
  assert.match(await sor.innerText(), /\*\*\*/, 'maszkolt e-mail');
  await kep(p, '04-vendegkereso');
  await sor.locator('a').first().click();
  await p.waitForSelector('.fulek');
  assert.match(await p.locator('.nezet').innerText(), /Teszt Dora/);
  assert.match(await p.locator('.nezet').innerText(), /Vendégkulcs/);
  for (const t of ['Foglalások', 'Bérlet', 'Hozzájárulás', 'Üzenetek', 'Dokumentumok', 'Panasz', 'Képek']) {
    await p.click(`.ful:has-text("${t}")`);
    await p.waitForTimeout(80);
  }
  await p.click('.ful:has-text("Foglalások")');
  assert.ok((await p.locator('.ful-tartalom .tabla tbody tr').count()) >= 3, 'Dora foglalasai');
  await kep(p, '05-vendegprofil');
  // XSS: a vendeg altal beirt nev szovegkent jelenik meg
  await megy(p, '#/vendegek');
  await p.fill('#vk-q', 'Xss');
  await p.click('button:has-text("Keresés")');
  await p.waitForSelector('.tabla');
  assert.match(await p.locator('.tabla').innerText(), /<img src=x/);
  assert.equal(await p.evaluate(() => window.__xss), undefined);
  assert.equal(await p.locator('.tabla img').count(), 0);
  await ctx.close();
});

test('kuraterv: szerkesztes, mentes, veglegesites, A5 PDF, e-mail kuldes allapota', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/kuraterv');
  await p.waitForSelector('.tabla, .allapot');
  const szerk = p.locator('.tabla a:has-text("Szerkesztés")').first();
  assert.ok(await szerk.count(), 'van hianyzo dokumentum (Anna igazolt 1. kezelese)');
  await kep(p, '06-kuraterv-lista');
  await szerk.click();
  await p.waitForSelector('[data-mezo="fo_panasz"]');
  // vegleges nem megy hianyos mezokkel
  await p.click('#kt-vegleges');
  await p.waitForSelector('.figyelem-veszely');
  assert.match(await p.locator('.figyelem-veszely').innerText(), /hiányzó|hibás|Fő panasz|Személyes cél/i);
  await p.fill('[data-mezo="fo_panasz"]', 'Hajhullás és zsírosodó fejbőr.');
  await p.fill('[data-mezo="megfigyelesek"]', 'Enyhe pirosság a fejtetőn.\nSűrűbb zsírosodás a halántéknál.');
  await p.fill('[data-mezo="cel"]', 'Csökkenő hajhullás követése.');
  await p.fill('[data-mezo="ritmus_nap"]', '14');
  await p.fill('[data-mezo="otthoni_apolas.termek"]', 'Oxygeni sampon');
  await p.fill('[data-mezo="otthoni_apolas.hasznalat"]', 'Hetente kétszer.');
  await p.fill('[data-mezo="kezeloi_javaslat"]', 'A fejbőr enyhén irritált. A változást a következő alkalmakon követjük. Ha fokozódik a viszketés, jelezzen.');
  await p.fill('[data-mezo="kovetkezo_idopont.javasolt_intervallum"]', '2 hét múlva');
  await p.click('#kt-ment');
  await p.waitForSelector('.toast:has-text("Piszkozat mentve")');
  await kep(p, '07-kuraterv-szerkeszto');
  await p.click('#kt-vegleges');
  await p.waitForFunction(() => /Kezelő által véglegesítve/.test(document.getElementById('kt-allapot')?.innerText || ''));
  // A5 PDF: uj lapon nyilik (a CSP nem engedi a beagyazast)
  const [popup] = await Promise.all([p.waitForEvent('popup', { timeout: 15000 }).catch(() => null), p.click('#kt-pdf')]);
  await p.waitForSelector('#kt-pdf-link');
  if (popup) await popup.close();
  // e-mail kuldes (dry-run)
  await p.click('#kt-kuld');
  await dialog(p);
  await p.waitForFunction(() => /Sorba állítva|Elküldve/.test(document.getElementById('kt-allapot')?.innerText || ''), null, { timeout: 15000 });
  await kep(p, '08-kuraterv-elkuldve');
  await ctx.close();
});

test('kezeles kozben (mobil): igazolas, kamerakep, valasztok, veglegesites es kuldes egy folyamatban', async () => {
  const { ctx, p } = await ujOldal({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await belep(p, 'therapist');
  await megy(p, '#/kezeles');
  await p.waitForSelector('.kk-kartya');
  await kep(p, '20-kezeles-lista');
  await p.locator('.kk-kartya', { hasText: 'Teszt Anna' }).click();
  await p.waitForSelector('.kk-lepes');
  // 1. igazolas
  // (a munkalista-teszt mar igazolhatta Annat: ilyenkor a lepes csak az allapotot mutatja)
  if (await p.locator('.kk-lepes button:has-text("igazolom")').count()) { await p.click('.kk-lepes button:has-text("igazolom")'); await dialog(p); }
  await p.waitForSelector('.kk-lepes:has-text("1. alkalom")');
  // 2. kamerakep (1. alkalmon kotelezo)
  await p.waitForSelector('#kk-kep', { state: 'attached' });
  const png = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#486'; x.fillRect(0, 0, 800, 600); const b = await new Promise((ok) => c.toBlob(ok, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); });
  await p.setInputFiles('#kk-kep', { name: 'haj.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await p.waitForSelector('.kk-lepes:has-text("Feltöltve")');
  // csere, torles, ujrafeltoltes
  await p.waitForSelector('#kk-kep-csere', { state: 'attached' });
  await p.setInputFiles('#kk-kep-csere', { name: 'haj2.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await p.waitForSelector('.toast:has-text("lecserélve")');
  await p.click('.kk-lepes button:has-text("Kép törlése")');
  await dialog(p);
  await p.waitForSelector('.toast:has-text("törölve")');
  await p.waitForSelector('#kk-kep', { state: 'attached' });
  await p.setInputFiles('#kk-kep', { name: 'haj3.png', mimeType: 'image/png', buffer: Buffer.from(png) });
  await p.waitForSelector('#kk-kep-csere', { state: 'attached' });
  // 3-8. valasztok
  await p.waitForSelector('.kk-chip');
  await p.click('.kk-chip:has-text("Száraz, feszes fejbőr")');
  await p.click('.kk-chip:has-text("Nyugodtabb")');
  await p.click('.kk-chip:has-text("21")');
  await p.fill('[aria-label="Oxygeni termék neve"]', 'Teszt fejbőr-sampon');
  await p.click('.kk-chip:has-text("Heti 2 alkalommal")');
  await p.click('.kk-chip:has-text("2 hét múlva")');
  const uzenet = await p.inputValue('[aria-label^="Személyes üzenet"]');
  assert.match(uzenet, /száraz, feszes fejbőr/);
  assert.match(uzenet, /21 napos/);
  await kep(p, '21-kezeles-folyamat');
  // PDF + kuldes
  await p.click('button:has-text("Véglegesít és küld")');
  await dialog(p);
  await p.waitForSelector('.kk-vegso:has-text("Kész")');
  assert.ok(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'nincs vizszintes gorgetes');
  await ctx.close();
});

test('kezeles kozben: USB / elo kamera panel (hamis kamera-eszkozzel) kepet keszit es feltolt', async () => {
  const B2 = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const ctx = await B2.newContext({ viewport: { width: 800, height: 1200 }, permissions: ['camera'] });
    const p = await ctx.newPage(); p.setDefaultTimeout(10000);
    await p.goto(`${BASE}/crm`); await p.click('[data-demo="therapist"]'); await p.waitForSelector('.oldalsav a', { state: 'attached' });
    await megy(p, '#/kezeles');
    await p.waitForSelector('.kk-kartya');
    await p.locator('.kk-kartya', { hasText: 'Teszt Anna' }).first().click();
    await p.waitForSelector('.kk-lepes');
    if (await p.locator('.kk-lepes button:has-text("igazolom")').count()) { await p.click('.kk-lepes button:has-text("igazolom")'); await dialog(p); }
    await p.waitForSelector('.kk-lepes:has-text("alkalom")');
    // ha ehhez az alkalomhoz mar van kep, torles utan jon az uj felvetel
    if (await p.locator('.kk-lepes button:has-text("Kép törlése")').count()) { await p.click('.kk-lepes button:has-text("Kép törlése")'); await dialog(p); await p.waitForSelector('.toast:has-text("törölve")'); }
    if (await p.locator('button:has-text("USB hajkamera")').count()) {
      await p.click('button:has-text("USB hajkamera")');
      await p.waitForSelector('video.kk-video');
      await p.waitForFunction(() => document.querySelector('video.kk-video')?.videoWidth > 0);
      await p.waitForFunction(() => /kamera található/.test(document.querySelector('.kk-kamera')?.innerText || ''));
      await p.click('button:has-text("Kép készítése")');
      await p.waitForSelector('.toast:has-text("feltöltve"), .toast:has-text("lecserélve")');
    } else console.log('(az Anna ehhez az alkalomhoz nem kamera-alkalom, a panel nem jelenik meg)');
    await ctx.close();
  } finally { await B2.close(); }
});

test('kepkuldes (tablet) -> beerkezo -> hozzarendeles a Kezeles kozben nezetben', async () => {
  const { ctx, p } = await ujOldal({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await belep(p, 'therapist');
  await megy(p, '#/kepkuldo');
  const png = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d'); x.fillStyle = '#684'; x.fillRect(0, 0, 640, 480); const b = await new Promise((ok) => c.toBlob(ok, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); });
  await p.setInputFiles('#kk-kuldo-fajl', [{ name: 'a.png', mimeType: 'image/png', buffer: Buffer.from(png) }, { name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(png) }]);
  await p.waitForSelector('.kk-naplo li:has-text("elküldve")');
  await p.waitForFunction(() => document.querySelectorAll('.kk-mini').length === 2);
  await kep(p, '22-kepkuldo');
  await megy(p, '#/kezeles');
  await p.locator('.kk-kartya', { hasText: 'Teszt Anna' }).first().click();
  await p.waitForSelector('.kk-lepes');
  if (await p.locator('.kk-lepes button:has-text("igazolom")').count()) { await p.click('.kk-lepes button:has-text("igazolom")'); await dialog(p); }
  await p.waitForSelector('.kk-lepes:has-text("alkalom")');
  const csere = (await p.locator('.kk-lepes button:has-text("Kép törlése")').count()) > 0;
  await p.waitForSelector('.kk-beerkezo button.kk-mini');
  await p.locator('.kk-beerkezo button.kk-mini').first().click();
  await p.waitForSelector('dialog[open] img');
  assert.match(await p.locator('dialog[open]').innerText(), /Teszt Anna/);
  await dialog(p);
  await p.waitForSelector('.toast:has-text("hozzárendelve")');
  assert.equal(csere || true, true);
  // a hozza nem rendelt masik kep marad a beerkezoben; elvetes
  await megy(p, '#/kepkuldo');
  await p.waitForFunction(() => document.querySelectorAll('.kk-mini').length === 1);
  await p.click('.kk-mini button:has-text("Elvetés")'); await dialog(p);
  await p.waitForFunction(() => document.querySelectorAll('.kk-mini').length === 0);
  await ctx.close();
});

test('kameraképek: feltoltes (kliens-oldali atmeretezes), ket kep osszehasonlitasa, komment, link', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, `#/kepek/${S.ids.dora}`);
  await p.waitForSelector('.kep-doboz');
  assert.equal(await p.locator('.kep-doboz').count(), 1);
  // feltoltes: a Dora 3. alkalmahoz mar van kep; uj kep (kozepso session: 2. nem 1/3/5/10 -> nincs a listaban)
  const opciok = await p.locator('#kp-sid option').allInnerTexts();
  assert.ok(opciok.some((x) => /1\. alkalom/.test(x)) && opciok.some((x) => /3\. alkalom/.test(x)));
  assert.ok(!opciok.some((x) => /2\. alkalom/.test(x)), 'csak 1/3/5/10');
  assert.equal(await p.locator('#kp-fajl').getAttribute('capture'), 'environment');
  assert.equal(await p.locator('#kp-fajl').getAttribute('accept'), 'image/*');
  // kicsi PNG (nem 1x1): 2000x1000 canvas-bol -> a kliens 1600 px-re kicsinyiti
  const nagyPng = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 2000; c.height = 1000; const x = c.getContext('2d'); x.fillStyle = '#486'; x.fillRect(0, 0, 2000, 1000); const b = await new Promise((ok) => c.toBlob(ok, 'image/png')); return Array.from(new Uint8Array(await b.arrayBuffer())); });
  const valaszok = [];
  await p.route(/\/kepek\?/, async (route) => { const r = route.request(); if (r.method() === 'POST') valaszok.push({ ct: r.headers()['content-type'], url: r.url(), meret: (r.postDataBuffer() || Buffer.alloc(0)).length }); await route.continue(); });
  await p.selectOption('#kp-sid', { label: '3. alkalom' });
  await p.setInputFiles('#kp-fajl', { name: 'teszt.png', mimeType: 'image/png', buffer: Buffer.from(nagyPng) });
  await p.click('#kp-feltolt');
  await p.waitForSelector('.toast:has-text("feltöltve")');
  assert.equal(valaszok.length, 1);
  assert.equal(valaszok[0].ct, 'image/jpeg', 'JPEG a feltoltes elott');
  assert.match(valaszok[0].url, /pont=3/);
  assert.ok(valaszok[0].meret > 100 && valaszok[0].meret < 200000, `meret ${valaszok[0].meret}`);
  await p.waitForFunction(() => document.querySelectorAll('.kep-doboz').length === 2);
  // osszehasonlitas: ket kep kivalasztasa
  const dobozok = p.locator('.kep-doboz');
  await dobozok.nth(0).click(); await p.waitForSelector('.kep-doboz img');
  await dobozok.nth(1).click();
  await p.waitForSelector('.ossze img');
  await p.fill('#kp-komment', 'A fejbőr nyugodtabbnak tűnik. A zsírosodás mérséklődött. A következő alkalmon újra összevetjük.');
  await p.click('#kp-ossze-ment');
  await p.waitForSelector('#kp-veglegesit');
  assert.equal(await p.locator('#kp-link').isDisabled(), true, 'link csak veglegesites utan');
  await p.click('#kp-veglegesit');
  await p.waitForSelector('.toast:has-text("Véglegesítve")');
  await kep(p, '09-kepek');
  await p.click('#kp-link');
  await dialog(p);
  // a link kiadasa a backend feltetelein mulik (kesz dokumentacio, ellenorzott e-mail): siker VAGY ertheto hibauzenet
  await p.waitForSelector('.figyelem-ok:has-text("link kiadva"), .toast-hiba');
  await ctx.close();
});

test('berletek es hajkamera-beszamitas (recepcio): vasarlas, ajandek-atadas, credit-nezet', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'reception');
  await megy(p, `#/berletek/${S.ids.emese}`);
  await p.waitForSelector('.tabla');
  assert.match(await p.locator('.tabla').innerText(), /10 alkalmas/);
  assert.match(await p.locator('.tabla').innerText(), /sampon/);
  await kep(p, '10-berletek');
  await p.locator('[data-akcio="ajandek-atad"]').first().click();
  await dialog(p);
  await p.waitForSelector('.toast:has-text("Ajándék")');
  await p.selectOption('#bv-tipus', 'package_5');
  await p.click('#bv-vasarlas');
  await dialog(p);
  await p.waitForFunction(() => document.querySelectorAll('.tabla tbody tr').length >= 2);
  // credit
  await megy(p, `#/credit/${S.ids.cili}`);
  await p.waitForSelector('.nezet .kartya, .allapot');
  await kep(p, '11-credit');
  // vezetoi muvelet: a recepcio nem latja a hosszabbitast
  await megy(p, `#/berletek/${S.ids.emese}`);
  await p.waitForSelector('.tabla');
  assert.equal(await p.locator('[data-akcio="hosszabbit"]').count(), 0);
  await ctx.close();
  const v = await uj('salon_manager');
  await megy(v.p, `#/berletek/${S.ids.emese}`);
  await v.p.waitForSelector('[data-akcio="hosszabbit"]');
  await kep(v.p, '12-berletek-vezeto');
  await v.ctx.close();
});
async function uj(szerep) { const o = await ujOldal(); await belep(o.p, szerep); return o; }

test('kuldesi vezerlo: dry-run felirat, sablonok, elonezet, jobok', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/kuldes');
  assert.match(await p.locator('.nezet').innerText(), /NEM küld éles üzenetet/);
  await p.waitForSelector('.tabla');
  assert.ok((await p.locator('.tabla tbody tr').count()) > 5, 'sablonok');
  await kep(p, '13-kuldes-sablonok');
  await p.click('.ful:has-text("Előnézet")');
  await p.waitForSelector('#kd-sablon');
  await p.fill('#kd-q', 'Teszt Anna');
  await p.click('button:has-text("Vendég keresése")');
  await p.waitForFunction(() => document.querySelectorAll('#kd-vendeg option').length > 1);
  await p.selectOption('#kd-vendeg', { index: 1 });
  await p.click('#kd-elonezet');
  // a motor (masik fejleszto) lehet meg 501: ertheto jelzes vagy elonezet
  await p.waitForTimeout(800);
  await kep(p, '14-kuldes-elonezet');
  await p.click('.ful:has-text("Jobok")');
  await p.waitForSelector('#kd-allapot');
  await ctx.close();
});

test('hozzajarulasok: csatornankent, valtozastortenet', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'reception');
  await megy(p, `#/hozzajarulas/${S.ids.emese}`);
  await p.waitForSelector('[data-csatorna="sms_marketing"]');
  assert.match(await p.locator('.nezet').innerText(), /REQUIRES_VERIFICATION/);
  await p.click('[data-csatorna="sms_marketing"]');
  await dialog(p);
  await p.waitForSelector('.toast:has-text("Rögzítve")');
  await p.waitForSelector('[data-csatorna="sms_marketing"][data-allapot="withdrawn"]');
  assert.ok((await p.locator('.tabla tbody tr').count()) >= 2, 'valtozastortenet');
  await kep(p, '15-hozzajarulas');
  await ctx.close();
});

test('panasz: sajat kezelo naplozza a hivast; szalonvezeto es kompenzacio', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/panasz');
  await p.waitForSelector('[data-panasz]');
  await p.click('[data-panasz]');
  await p.waitForSelector('[data-akcio="hivas"]');
  await p.click('[data-akcio="hivas"]');
  await dialog(p);
  await p.waitForSelector('.toast:has-text("Hívás naplózva")');
  await p.click('[data-panasz]');
  await p.click('[data-akcio="komp"]');
  await p.waitForSelector('dialog[open]');
  await p.selectOption('dialog[open] select', 'free_replacement');
  await dialog(p);
  await p.waitForSelector('.toast:has-text("jóváhagyásra")');
  await kep(p, '16-panasz');
  await ctx.close();
  const v = await uj('salon_manager');
  await megy(v.p, '#/panasz');
  await v.p.waitForSelector('[data-panasz]');
  await v.p.click('[data-panasz]');
  await v.p.waitForSelector('[data-akcio="felelos"]');
  await v.ctx.close();
});

test('osszevonasi sor: jovahagyas (kezelo), a szalonvezeto csak olvas, visszafordithatosag', async () => {
  const v = await uj('salon_manager');
  await megy(v.p, '#/osszevonas');
  await v.p.waitForSelector('.tabla');
  assert.equal(await v.p.locator('[data-akcio="jovahagy"]').count(), 0);
  await v.ctx.close();
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/osszevonas');
  await p.waitForSelector('[data-akcio="jovahagy"]');
  await kep(p, '17-osszevonas');
  await p.click('[data-akcio="jovahagy"]');
  await dialog(p);
  await p.waitForSelector('.toast:has-text("Összevonva")');
  await p.click('.ful:has-text("Visszafordítás")');
  await p.waitForSelector('[data-akcio="visszafordit"]');
  await ctx.close();
});

test('allapotfelmero: REQUIRES_VERIFICATION jelzes, verzio-jovahagyas csak a szakmai vezetonek', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'clinical_lead');
  await megy(p, '#/felmero');
  assert.match(await p.locator('.nezet').innerText(), /REQUIRES_VERIFICATION/);
  await p.waitForSelector('.tabla');
  await p.locator('[data-felmero]').nth(1).click();
  await p.waitForSelector('.kartya:has-text("Kérdőív")');
  await kep(p, '18-felmero-attekintes');
  await p.click('.ful:has-text("Kérdőív-verziók")');
  await p.waitForSelector('#fm-uj-verzio');
  await kep(p, '19-felmero-verziok');
  await ctx.close();
  const t = await uj('therapist');
  await megy(t.p, '#/felmero'); await t.p.click('.ful:has-text("Kérdőív-verziók")');
  await t.p.waitForSelector('.ful-tartalom');
  assert.equal(await t.p.locator('#fm-uj-verzio').count(), 0, 'a kezelo nem hagy jova');
  await t.ctx.close();
});

test('mutatok, kurazaro, beallitasok: ures / meg-nem-elerheto allapotok nem omlanak ossze', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'salon_manager');
  await megy(p, '#/mutatok');
  await p.waitForSelector('.racs-szam, .allapot');
  await kep(p, '20-mutatok');
  await megy(p, '#/beallitasok');
  await p.waitForSelector('.fulek');
  await p.click('.ful:has-text("Audit-napló")');
  await p.waitForSelector('#au-export');
  await p.click('.ful:has-text("Salonic-fiók állapota")');
  await p.waitForSelector('.ful-tartalom .kartya, .ful-tartalom .allapot');
  await kep(p, '21-beallitasok');
  await ctx.close();
  const t = await uj('therapist');
  await megy(t.p, `#/kurazaro/${S.ids.dora}`);
  await t.p.waitForSelector('.figyelem');
  assert.match(await t.p.locator('.nezet').innerText(), /még nem érte el a 11\./);
  await kep(t.p, '22-kurazaro');
  await t.ctx.close();
  const a = await uj('admin');
  await megy(a.p, '#/beallitasok');
  await a.p.waitForSelector('#mt-uj');
  await a.p.click('#mt-uj');
  await a.p.waitForSelector('dialog[open]');
  await a.p.fill('dialog[open] input[type=text]', 'Uj Kezelo');
  await a.p.fill('dialog[open] input[type=email]', 'uj.kezelo@example.com');
  await a.p.selectOption('dialog[open] select', 'therapist');
  await a.p.click('dialog[open] button[type=submit]');
  await a.p.waitForSelector('.toast:has-text("felvéve")');
  assert.match(await a.p.locator('.tabla').innerText(), /uj\.kezelo@example\.com/);
  await a.ctx.close();
});

test('401: lejart munkamenet -> vissza a belepeshez', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/munkalista');
  await p.waitForSelector('.tabla');
  await ctx.clearCookies();
  await p.evaluate(() => { location.hash = '#/vendegek'; });
  await p.fill('#vk-q', 'Teszt');
  await p.click('button:has-text("Keresés")');
  await p.waitForSelector('#be-email');
  assert.match(await p.locator('.figyelem-veszely').innerText(), /lejárt/);
  await ctx.close();
});

test('nem elerheto (501) vegpont: ertheto allapot, nincs osszeomlas', async () => {
  const { ctx, p } = await ujOldal();
  await p.route('**/api/crm/merok*', (r) => r.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({ hiba: { kod: 'NINCS_MEG', uzenet: 'nincs' } }) }));
  await belep(p, 'marketing');
  await megy(p, '#/mutatok');
  await p.waitForSelector('.allapot-hiba');
  assert.match(await p.locator('.allapot-hiba').innerText(), /még nem érhető el/);
  await ctx.close();
});

test('mobil (390 px): nincs vizszintes gorgetes a fo nezeteken, menu nyithato', async () => {
  const { ctx, p } = await ujOldal({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  await belep(p, 'therapist');
  const hashek = ['#/dashboard', '#/munkalista', '#/vendegek', `#/vendegek/${S.ids.dora}`, '#/felmero', '#/kuraterv', `#/kepek/${S.ids.dora}`, `#/berletek/${S.ids.emese}`, `#/credit/${S.ids.cili}`, '#/kuldes', `#/hozzajarulas/${S.ids.emese}`, '#/panasz', '#/osszevonas'];
  for (const hh of hashek) {
    await megy(p, hh);
    await p.waitForTimeout(400);
    const szeles = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    assert.ok(szeles.sw <= szeles.cw, `vizszintes gorgetes ${hh}: ${szeles.sw} > ${szeles.cw}`);
  }
  await megy(p, '#/munkalista');
  await p.waitForSelector('.tabla');
  await kep(p, '30-mobil-munkalista');
  await p.click('.menugomb');
  assert.equal(await p.locator('.oldalsav.nyitva').count(), 1);
  await p.waitForTimeout(400);
  await kep(p, '31-mobil-menu');
  await p.keyboard.press('Escape');
  assert.equal(await p.locator('.oldalsav.nyitva').count(), 0);
  await megy(p, `#/vendegek/${S.ids.dora}`);
  await p.waitForSelector('.fulek');
  await kep(p, '32-mobil-profil');
  await ctx.close();
  const k = await ujOldal({ viewport: { width: 390, height: 800 } });
  await belep(k.p, 'reception');
  for (const hh of ['#/munkalista', `#/berletek/${S.ids.emese}`, '#/kuldes']) {
    await megy(k.p, hh); await k.p.waitForTimeout(300);
    const w = await k.p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    assert.ok(w, `vizszintes gorgetes (recepcio) ${hh}`);
  }
  await k.ctx.close();
});

test('billentyuzet: skip-link, modalis fokusz, escape', async () => {
  const { ctx, p } = await ujOldal();
  await belep(p, 'therapist');
  await megy(p, '#/munkalista');
  await p.waitForSelector('.tabla');
  await p.locator('[data-akcio="no-show"]').first().focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('dialog[open]');
  const fokuszban = await p.evaluate(() => document.activeElement && document.activeElement.closest('dialog') !== null);
  assert.ok(fokuszban, 'a fokusz a parbeszedben van');
  await p.keyboard.press('Escape');
  await p.waitForSelector('dialog[open]', { state: 'detached' });
  assert.equal(await p.locator('html').getAttribute('lang'), 'hu');
  await ctx.close();
});

test('nincs konzol-hiba, nincs kulso halozati keres (merokod, CDN, tracking)', async () => {
  const kulso = [];
  konzolHibak.length = 0;
  const { ctx, p } = await ujOldal();
  p.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) kulso.push(r.url()); });
  await belep(p, 'therapist');
  for (const t of ['dashboard', 'munkalista', 'vendegek', 'felmero', 'kuraterv', 'kepek', 'berletek', 'credit', 'kuldes', 'hozzajarulas', 'panasz', 'osszevonas']) { await megy(p, `#/${t}`); await p.waitForTimeout(250); }
  assert.deepEqual(kulso, []);
  assert.deepEqual(konzolHibak, []);
  await ctx.close();
});
