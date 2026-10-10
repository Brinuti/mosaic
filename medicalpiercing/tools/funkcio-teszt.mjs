// A klon.js funkcioinak probaja a helyi kiszolgalon (tools/serve.mjs), Playwrighttal.
//
//   node tools/funkcio-teszt.mjs     (asztali es mobil nezetben)
//
// Minden lepes OK/HIBA sort ir, a vegen osszesit; hiba eseten 1-es kilepesi koddal all le.
import { chromium, devices } from './pw.mjs';

const HELYI = process.env.HELYI || 'http://localhost:4290';
const b = await chromium.launch();
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; };

for (const [nezet, opt] of [['asztali', { viewport: { width: 1440, height: 900 } }], ['mobil', devices['Pixel 5']]]) {
  const ctx = await b.newContext(opt);
  const p = await ctx.newPage();
  const konzol = [];
  // csak a sajat kodunk hibai (a beagyazott kulso tartalmak - pl. az RTL-lejatszo - sajat hibait nem nezzuk)
  p.on('pageerror', (e) => { if (!/tcfapi|embed\.rtl|cross-origin frame/.test(e.message + (e.stack || ''))) konzol.push(e.message); });

  // 1. felugro menu
  await p.goto(HELYI + '/rolunk', { waitUntil: 'load' });
  await p.$$eval('[data-popupid]', (l) => (l.find((x) => x.getBoundingClientRect().width > 0) || l[0]).click());
  await p.waitForTimeout(800);
  const menu = await p.evaluate(() => {
    const r = document.getElementById('POPUPS_ROOT');
    const akt = r && r.querySelector('a[aria-current="page"]');
    const lb = r && r.querySelector('.wixui-lightbox');
    const rr = lb && lb.getBoundingClientRect();
    return { van: !!r, aktualis: akt ? akt.textContent : null, latszik: !!rr && rr.width > 100 && rr.left < innerWidth, linkek: r ? r.querySelectorAll('a[href]').length : 0 };
  });
  ok(`${nezet}: menu nyilik`, menu.van && menu.latszik, JSON.stringify(menu));
  // asztalin a Wix kiemeli az aktualis oldalt; mobilon a menu sima szoveges link, ott a Wix sem jeloli
  ok(`${nezet}: menu aktualis pont`, nezet === 'mobil' ? menu.aktualis === null : menu.aktualis === 'Rólunk', String(menu.aktualis));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
  ok(`${nezet}: menu Esc-re zar`, !(await p.$('#POPUPS_ROOT')));

  // 2. fulek
  await p.goto(HELYI + '/migren', { waitUntil: 'load' });
  const fulek = await p.$$('[data-hook="tab-item"]');
  if (fulek.length > 1) {
    await fulek[1].click();
    await p.waitForTimeout(300);
    const all = await p.evaluate(() => [...document.querySelectorAll('[data-hook="TabPanel"]')].map((x) => x.getAttribute('aria-hidden') + ':' + x.getBoundingClientRect().height));
    ok(`${nezet}: masodik ful`, all[0].startsWith('true') && all[1].startsWith('false') && parseFloat(all[1].split(':')[1]) > 50, all.join(' '));
  } else ok(`${nezet}: fulek megvannak`, false);

  // 3. galeria
  await p.goto(HELYI + '/piercer-kovacs-richard', { waitUntil: 'load' });
  const g0 = await p.$eval('[data-testid="gallery-item-item"] img', (i) => i.src).catch(() => null);
  if (g0) {
    await p.click('[data-testid="gallery-nextButton"]');
    await p.waitForTimeout(300);
    const g1 = await p.$eval('[data-testid="gallery-item-item"] img', (i) => i.src);
    ok(`${nezet}: galeria lapoz`, g0 !== g1);
  } else ok(`${nezet}: galeria megvan`, false);

  // 4. diavetites
  await p.goto(HELYI + '/mi-az-a-migren-piercing', { waitUntil: 'load' });
  const d = await p.evaluate(() => { const w = document.querySelector('.wixui-slideshow [data-testid="slidesWrapper"]'); return w ? w.querySelectorAll('[data-mp-dia]').length : 0; });
  ok(`${nezet}: diavetites diai`, d > 1, d + ' dia');
  if (d > 1) {
    await p.$eval('.wixui-slideshow [data-testid="nextButton"]', (x) => x.click());
    await p.waitForTimeout(1300);
    const lat = await p.evaluate(() => [...document.querySelectorAll('.wixui-slideshow [data-mp-dia]')].map((x) => !x.hidden));
    ok(`${nezet}: diavetites lapoz`, lat[1] && !lat[0], lat.join(','));
  }
  // 5. blog: link masolasa es kedveles
  await p.goto(HELYI + '/a-daith-piercing-hatasa-igy-mukodik', { waitUntil: 'load' });
  const linkGomb = await p.$('[data-hook="share-button__link"]');
  if (linkGomb) {
    await linkGomb.evaluate((x) => x.click());
    await p.waitForTimeout(200);
    ok(`${nezet}: blog link masolasa`, !!(await p.$('.mp-masolva')));
  }
  const kedv = await p.$('button [data-hook="like-button"]');
  if (kedv) {
    const elotte = await p.$eval('button [data-hook="like-button"]', (k) => k.parentElement.textContent);
    await p.$eval('button [data-hook="like-button"]', (k) => k.closest('button').click());
    const utana = await p.$eval('button [data-hook="like-button"]', (k) => k.parentElement.textContent);
    ok(`${nezet}: blog kedveles`, (parseInt(utana, 10) || 0) === (parseInt(elotte, 10) || 0) + 1, `${elotte} -> ${utana}`);
  }

  // 6. allasjelentkezes urlap
  await p.goto(HELYI + '/allasajanlat', { waitUntil: 'load' });
  const urlap = await p.$('form.wixui-form');
  if (urlap) {
    await p.$eval('form.wixui-form button.wixui-button', (b) => b.click());
    await p.waitForTimeout(200);
    const ures = await p.$$eval('form.wixui-form [aria-invalid="true"]', (l) => l.length);
    ok(`${nezet}: urlap ures mezokre hibat jelez`, ures > 0, ures + ' mezo');
    await p.$$eval('form.wixui-form input', (l) => l.forEach((i) => {
      if (i.type === 'file' || i.type === 'date' || i.getAttribute('aria-hidden')) return;
      i.value = i.type === 'email' ? 'teszt@example.com' : i.type === 'number' ? '5' : i.type === 'tel' ? '+36301234567' : (i.classList.contains('wixui-date-picker__input') ? '1990. 01. 01.' : 'Teszt');
    }));
    await p.$eval('form.wixui-form button.wixui-button', (b) => b.click());
    await p.waitForTimeout(800);
    const felirat = await p.$eval('form.wixui-form button.wixui-button', (b) => b.textContent);
    ok(`${nezet}: urlap bekuldes`, /Köszönjük/.test(felirat), felirat);
  } else ok(`${nezet}: urlap megvan`, false);

  ok(`${nezet}: nincs JS-hiba`, !konzol.length, konzol.join(' | '));
  await ctx.close();
}
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
