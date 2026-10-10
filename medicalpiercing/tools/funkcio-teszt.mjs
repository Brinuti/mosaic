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
    // a kepernyon kell latszania, fuggolegesen is (rogzitett elhelyezes nelkul a lap aljara kerult)
    return { van: !!r, aktualis: akt ? akt.textContent : null, latszik: !!rr && rr.width > 100 && rr.left < innerWidth && rr.top >= 0 && rr.top < innerHeight / 2, linkek: r ? r.querySelectorAll('a[href]').length : 0 };
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

  // 7. Pro Gallery (fooldal, belyegkepes): nyil, belyegkep, teljes kepernyo (a Wixen merve)
  await p.goto(HELYI + '/', { waitUntil: 'load' });
  const par = p.locator('[id="pro-gallery-container-comp-ld4dmnwl"]').locator('xpath=ancestor::*[contains(@class,"pro-gallery-parent-container")][1]');
  await par.scrollIntoViewIfNeeded();
  const pg = () => par.evaluate((x) => {
    const h = x.querySelector('.gallery-horizontal-scroll');
    const t = [...x.querySelectorAll('.thumbnailItem')];
    const elo = x.querySelector('[data-hook="nav-arrow-back"]');
    const k = t.find((y) => y.classList.contains('pro-gallery-highlight'));
    // a belyegkepsav ablakkent gorget (asztalin 9, mobilon 3 belyeg): a kiemelt elem sorszama a data-mp-idx
    return { sl: Math.round(h.scrollLeft), w: h.clientWidth, kiem: k ? +k.dataset.mpIdx : -1, elo: !!elo && elo.style.display !== 'none' };
  });
  const pg0 = await pg();
  ok(`${nezet}: galeria kezdet (Previous rejtve)`, pg0.sl === 0 && pg0.kiem === 0 && !pg0.elo, JSON.stringify(pg0));
  await par.locator('[data-hook="nav-arrow-next"]').click();
  await p.waitForTimeout(700);
  const pg1 = await pg();
  ok(`${nezet}: galeria Next egy kepet lapoz`, pg1.sl === pg1.w && pg1.kiem === 1 && pg1.elo, JSON.stringify(pg1));
  await par.locator('.thumbnailItem[data-mp-idx="2"]').click();
  await p.waitForTimeout(700);
  const pg2 = await pg();
  ok(`${nezet}: galeria belyegkepre ugrik`, pg2.sl === 2 * pg2.w && pg2.kiem === 2, JSON.stringify(pg2));
  await par.locator('[data-hook="item-container"]').nth(2).click({ force: true });
  await p.waitForTimeout(600);
  ok(`${nezet}: galeria teljes kepernyo + pgid`, !!(await p.$('.mp-pg-teljes')) && /[?&]pgid=ld4dmnwl-/.test(p.url()), p.url());
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
  ok(`${nezet}: galeria teljes kepernyo Esc-re zar`, !(await p.$('.mp-pg-teljes')) && !/pgid=/.test(p.url()));

  // 8. videolejatszo (Wix Playable): a boritora kattintva eltunik, asztalin a vezerlok latszanak
  await p.goto(HELYI + '/3-piercing-2-araert', { waitUntil: 'load' });
  const vl = p.locator('[data-testid="playable-cover"]').first();
  if (await vl.count()) {
    const id = await vl.evaluate((x) => x.parentElement.id);
    await vl.scrollIntoViewIfNeeded();
    await vl.click();
    await p.waitForTimeout(400);
    const va = await p.evaluate((id) => { const g = document.getElementById(id); return { borito: !!g.querySelector('[data-testid="playable-cover"]'), vezerlo: !g.querySelector('[data-playable-hook="bottom-block"]').classList.contains('SyVT0n') }; }, id);
    ok(`${nezet}: video borito eltunik, ${nezet === 'mobil' ? 'vezerlok nelkul (mint a Wixen)' : 'vezerlok latszanak'}`, !va.borito && va.vezerlo === (nezet !== 'mobil'), JSON.stringify(va));
  } else ok(`${nezet}: videolejatszo megvan`, false);

  // 9. blogkep teljes kepernyon, tobb keppel
  await p.goto(HELYI + '/daith-piercing-kutatas-a-vagus-ideg-stimulacioja-es-a-migrenkezelese', { waitUntil: 'load' });
  const bk = p.locator('figure[data-hook="figure-IMAGE"] [data-hook="image-viewer"]').first();
  await bk.scrollIntoViewIfNeeded();
  await bk.click();
  await p.waitForTimeout(500);
  ok(`${nezet}: blogkep nezegeto`, (await p.$$eval('.mp-pg-blog .mp-pg-dia', (l) => l.length)) === 7);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  ok(`${nezet}: blogkep nezegeto Esc-re zar`, !(await p.$('.mp-pg-teljes')));

  // 10. fejlec gorgeteskor (csak asztalin): 400 px lefele utan eltunik, felfele visszajon
  await p.goto(HELYI + '/kontroll', { waitUntil: 'load' });
  await p.evaluate(() => scrollTo(0, 900));
  await p.waitForTimeout(300);
  const fejLe = await p.$eval('#SITE_HEADER', (f) => f.classList.contains('ptcyHf'));
  await p.evaluate(() => scrollTo(0, 300));
  await p.waitForTimeout(300);
  const fejFel = await p.$eval('#SITE_HEADER', (f) => f.classList.contains('ptcyHf'));
  ok(`${nezet}: fejlec gorgeteskor`, nezet === 'mobil' ? !fejLe && !fejFel : fejLe && !fejFel, `${fejLe} ${fejFel}`);

  // 11. /kontroll visszahivas-kero (uj Wix-urlap): ures bekuldesre a Wix hibauzenetei, kitoltve elmegy
  await p.goto(HELYI + '/kontroll', { waitUntil: 'load' });
  const ku = p.locator('form').first();
  await ku.locator('[data-hook="submit-button"]').click();
  await p.waitForTimeout(300);
  const kh = await ku.locator('[data-hook="errormessagewrapper-message"]').count();
  ok(`${nezet}: kontroll-urlap ures bekuldesre 6 hibauzenet`, kh === 6, kh + ' uzenet');
  await ku.locator('input[type=text]').first().fill('Teszt Elek');
  await ku.locator('input[inputmode=tel]').fill('301234567');
  await ku.locator('input[type=email]').fill('teszt@example.com');
  await ku.locator('[data-hook="date-picker-calendar-icon"]').click();
  await p.locator('.mp-nap:not(.mp-nap-mas)').first().click();
  await ku.locator('input[aria-label="Melyik városban voltál?"]').fill('Budapest');
  await ku.locator('textarea').fill('Teszt');
  await ku.locator('[data-hook="submit-button"]').click();
  await p.waitForTimeout(800);
  const kf = await ku.locator('[data-hook="submit-button"]').textContent();
  ok(`${nezet}: kontroll-urlap bekuldes`, /Köszönjük/.test(kf), kf);

  ok(`${nezet}: nincs JS-hiba`, !konzol.length, konzol.join(' | '));
  await ctx.close();
}
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
