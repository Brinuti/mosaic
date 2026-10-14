// A foglalomotor TIPUS-ELSO belepese es a beepitett visszahivas-kero urlap (kontroll / ekszercsere / garancia).
// Valodi kuldes NELKUL: a /api/urlap kerest elfogja es eldobja (nem megy e-mail a szalonnak); a Salonic felé csak olvaso GET megy.
//
//   node tools/build.mjs && node tools/serve.mjs     (masik ablakban)
//   node tools/motor-tipus-teszt.mjs [--mobil]
//   BASE=https://<elonezet vagy eles> node tools/motor-tipus-teszt.mjs [--mobil]      (a meres-ellenorzesek csak a www.medicalpiercing.hu-n)
//
// Ellenorzi:
//   - a koztes oldalak (/idopontfoglalas, /kontroll) helyett a motor fo oldala: betolteskor magatol megnyilik; a header "Idopontfoglalas"
//     linkje es a /kontroll linkek a motort nyitjak (nincs lapbetoltes); piercing-tipus oldalrol egybol a helyszinnel nyilik;
//   - 4 kartya (Uj piercing / Kontroll / Ekszercsere / Garancia); az Uj piercing a naptaras utat inditja (5 lepes), a tobbi az urlapot (2 lepes);
//   - a foglalasinditas merese (GA4 foglalas_inditasa) PONTOSAN egyszer: belso linkrol / betolteskor az "Uj piercing" valasztasakor,
//     Salonic-linkre kattintaskor a kattintaskor (nem duplan);
//   - az urlap: kotelezo mezok, hibauzenetek (a regi /kontroll szovegei), a "Mire kersz idopontot?" lehetosegei tipusonkent;
//   - a bekuldott mezonevek / sorrend megegyeznek a regi /kontroll urlapeval (a szalon e-mailje valtozatlan); utana a /kontroll-ok oldal;
//   - hiba eseten uzenet, az urlap marad; ?motor=0 / 0%-os kapcsolo: a regi ut (a link a /idopontfoglalas oldalra visz).
import { chromium, devices } from './pw.mjs';

const PORT = +process.env.PORT || 4290;
const ELES = !!process.env.BASE;
const CIM = (process.env.BASE || `http://www.medicalpiercing.hu:${PORT}`).replace(/\/$/, '');
const MOBIL = process.argv.includes('--mobil');
const MERES_HOST = new URL(CIM).hostname === 'www.medicalpiercing.hu'; // a merokod (suti.js) csak itt fut
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${MOBIL ? 'mobil' : 'asztali'}: ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; return felt; };
const SZABAD = /^https:\/\/(www\.googletagmanager\.com\/(gtm|gtag\/js)|connect\.facebook\.net\/(en_US\/fbevents\.js|signals\/config\/)|analytics\.tiktok\.com\/i18n\/pixel\/|medicalpiercing\.salonic\.hu\/(selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
const b = await chromium.launch(ELES ? {} : { args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
const OPT = MOBIL ? { ...devices['Pixel 5'], locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

// multipart torzs -> [{ nev, fajl, ertek }]
const reszek = (buf, ct) => {
  const hat = /boundary=(.+)$/.exec(ct)[1];
  return buf.toString('latin1').split('--' + hat).slice(1, -1).map((x) => {
    const m = /name="([^"]*)"(?:; filename="([^"]*)")?/.exec(x);
    const v = x.slice(x.indexOf('\r\n\r\n') + 4, x.lastIndexOf('\r\n'));
    return { nev: Buffer.from(m[1], 'latin1').toString('utf8'), fajl: m[2] || null, ertek: m[2] ? '' : Buffer.from(v, 'latin1').toString('utf8') };
  });
};

// uj bongeszo-kontextus: elfogadott suti-sav (a meres igy fut), minden kulso kerest elkap (a Salonic olvaso GET-jei es a GTM-scriptek kivetelevel)
async function uj(urlapValasz = 200) {
  const ctx = await b.newContext(OPT);
  await ctx.addCookies([{ name: 'mp_suti', value: `v1-s1-m1-t${Math.floor(Date.now() / 1000)}`, domain: 'www.medicalpiercing.hu', path: '/' }]);
  const ki = [], urlap = [];
  await ctx.route(/\/api\/urlap$/, (r) => { urlap.push({ ct: r.request().headers()['content-type'], torzs: r.request().postDataBuffer() }); return r.fulfill({ status: urlapValasz, body: urlapValasz === 200 ? 'ok' : 'hiba' }); });
  await ctx.route(/\/api\/mp-foglalas$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await ctx.route((u) => !u.toString().startsWith(CIM), (r) => {
    const u = r.request().url();
    if (SZABAD.test(u) && r.request().method() === 'GET') return r.continue();
    ki.push({ u });
    return r.abort();
  });
  const p = await ctx.newPage();
  const hibak = [];
  p.on('pageerror', (e) => hibak.push(e.message.slice(0, 120)));
  return { ctx, p, ki, urlap, hibak };
}
const sr = (p, fn, a) => p.evaluate(([fn, a]) => { const h = document.querySelector('[data-mp-motor]'); return h ? new Function('r', 'a', fn)(h.shadowRoot, a) : null; }, [fn, a]);
const varj = async (p, sel, ms = 20000) => { for (let i = 0; i < ms / 250; i++) { if (await sr(p, 'return !!r.querySelector(a)', sel)) return true; await p.waitForTimeout(250); } return false; };
const kattint = (p, sel) => sr(p, 'const e=r.querySelector(a); if(!e) return false; e.click(); return true', sel);
const inditasok = (ki) => ki.filter((x) => /[?&]en=foglalas_inditasa/.test(x.u)).length;
// az oldal elso lathato linkje a megadott cimre (a motoron kivuli lapon)
const linkKattint = (p, sel) => p.evaluate((sel) => { const a = [...document.querySelectorAll(sel)].find((x) => x.offsetParent) || document.querySelector(sel); if (!a) return false; a.click(); return true; }, sel);

// A. a koztes oldal: betolteskor magatol megnyilik a tipus-valaszto
{
  const { ctx, p, hibak } = await uj();
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  ok('A: /idopontfoglalas: betolteskor magatol megnyilik a tipus-valaszto', await varj(p, '[data-tipus]'));
  await p.waitForTimeout(400);
  const m = await sr(p, 'const t=r.querySelector(".tartalom"), ab=r.querySelector(".ablak").getBoundingClientRect(), h=r.querySelector(".fej h2").getBoundingClientRect(); return { nevek:[...r.querySelectorAll("[data-tipus] .nev")].map(x=>x.textContent), sav:getComputedStyle(r.querySelector(".lepesek")).display, elfer:t.scrollHeight<=t.clientHeight+1, kozep:Math.abs((h.left+h.width/2)-(ab.left+ab.width/2)), vissza:getComputedStyle(r.querySelector("[data-vissza]")).visibility, szoveg:r.querySelector(".tartalom").innerText };');
  ok('A: 4 kartya: Uj piercing, Kontroll, Ekszercsere, Garancia', JSON.stringify(m.nevek) === JSON.stringify(['Új piercing', 'Kontroll', 'Ékszercsere', 'Garancia']), m.nevek.join(' | '));
  ok('A: a tipus-valaszto egy kepernyon, lepesjelzo nelkul, a cim kozepen, vissza gomb nincs', m.elfer && m.sav === 'none' && m.kozep <= 2 && m.vissza === 'hidden', JSON.stringify({ elfer: m.elfer, sav: m.sav, kozep: m.kozep, vissza: m.vissza }));
  ok('A: nincs "Kezeles" szo', !/kezel/i.test(m.szoveg));
  ok('A: nincs JS-hiba', !hibak.length, hibak.join(' | '));
  await ctx.close();
}

// B. a header "Idopontfoglalas" linkje: a motor nyilik, nincs lapbetoltes
{
  const { ctx, p } = await uj();
  await p.goto(CIM + '/', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  const cim = p.url();
  const volt = await linkKattint(p, 'a[href="/idopontfoglalas"]');
  ok('B: a fooldalon van /idopontfoglalas link', volt);
  ok('B: a link a tipus-valasztot nyitja (altalanos oldalon)', await varj(p, '[data-tipus]'));
  ok('B: az oldal cime nem valtozik (nincs lapbetoltes)', p.url() === cim, p.url());
  await ctx.close();
}

// C. piercing-tipus oldalrol is ugyanaz, mint mindenhonnan: a tipus-valaszto nyilik (nincs oldalfuggo ajanlas); a meres az "Uj piercing" valasztasakor, egyszer
{
  const { ctx, p, ki } = await uj();
  await p.goto(CIM + '/migren-piercing', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const cim = p.url(), elotte = inditasok(ki);
  const volt = await linkKattint(p, 'a[href="/idopontfoglalas"]');
  ok('C: a migren-oldalon van /idopontfoglalas link', volt);
  ok('C: tipusoldalrol is a tipus-valaszto nyilik (mindenhonnan ugyanaz)', await varj(p, '[data-tipus]') && !(await sr(p, 'return !!r.querySelector("[data-hely]")')));
  await kattint(p, '[data-tipus="uj"]');
  ok('C: az Uj piercing utan a helyszin-valasztas nyilik', await varj(p, '[data-hely]'));
  ok('C: az oldal cime nem valtozik', p.url() === cim, p.url());
  await p.waitForTimeout(1500);
  if (MERES_HOST) ok('C: a foglalasinditas GA4 merese pontosan egyszer (belso linkrol)', inditasok(ki) - elotte === 1, `${inditasok(ki) - elotte} db`);
  await ctx.close();
}

// D. Uj piercing a tipus-valasztobol: 5 lepes, a "Szolgaltatas" sav visszavisz; a meres egyszer
{
  const { ctx, p, ki } = await uj();
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  await varj(p, '[data-tipus]');
  await p.waitForTimeout(1500);
  const elotte = inditasok(ki);
  await kattint(p, '[data-tipus="uj"]');
  ok('D: az Uj piercing a helyszin-valasztast nyitja', await varj(p, '[data-hely]'));
  const sav = await sr(p, 'return [...r.querySelectorAll(".lepesek button")].map(x=>({n:x.textContent.replace(/^\\d+\\.\\s*/,"").trim(), kesz:x.classList.contains("kesz"), most:x.classList.contains("most")}))');
  ok('D: 5 lepes: Szolgaltatas, Helyszin, Piercing, Idopont, Adatok (az elso kesz, a masodik aktualis)', JSON.stringify(sav.map((x) => x.n)) === JSON.stringify(['Szolgáltatás', 'Helyszín', 'Piercing', 'Időpont', 'Adatok']) && sav[0].kesz && sav[1].most, JSON.stringify(sav));
  await p.waitForTimeout(1500);
  if (MERES_HOST) ok('D: a foglalasinditas merese az "Uj piercing" valasztasakor, egyszer', inditasok(ki) - elotte === 1, `${inditasok(ki) - elotte} db`);
  await kattint(p, '.lepesek button[data-lepes="tipus"]');
  ok('D: a "Szolgaltatas" sav visszavisz a tipus-valasztora', await varj(p, '[data-tipus]'));
  await kattint(p, '[data-tipus="uj"]');
  await varj(p, '[data-hely]');
  await p.waitForTimeout(1500);
  if (MERES_HOST) ok('D: visszalepes utan ujra valasztva sincs dupla meres', inditasok(ki) - elotte === 1, `${inditasok(ki) - elotte} db`);
  await ctx.close();
}

// E. Salonic-linkre kattintas: a meres a kattintaskor (suti.js), a motor nem duplazza (egy tartalmi oldalon: ott a motor nem nyilik magatol meg)
{
  const { ctx, p, ki } = await uj();
  await p.goto(CIM + '/a-migren-piercing-gyogyulasi-ideje', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const elotte = inditasok(ki);
  await p.evaluate(() => { const l = [...document.querySelectorAll('a[href^="https://medicalpiercing.salonic.hu"]')].filter((x) => /id[őo]pont/i.test(x.textContent) && !/garanci|kontroll|cser|m[oó]dos|\bid[őo]pontjai/i.test(x.textContent)); (l.find((x) => x.offsetParent) || l[0]).click(); });
  ok('E: Salonic-linkre (altalanos oldalon) a tipus-valaszto nyilik', await varj(p, '[data-tipus]'));
  await kattint(p, '[data-tipus="uj"]');
  await varj(p, '[data-hely]');
  await p.waitForTimeout(1500);
  if (MERES_HOST) ok('E: a meres pontosan egyszer (a kattintaskor, nem duplan)', inditasok(ki) - elotte === 1, `${inditasok(ki) - elotte} db`);
  await ctx.close();
}

// F-I. az urlap
const LEHETOSEGEK = { kontroll: 3, ekszercsere: 2, garancia: 1 };
{
  const { ctx, p, ki, urlap, hibak } = await uj();
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  await varj(p, '[data-tipus]');
  for (const [tipus, db] of Object.entries(LEHETOSEGEK)) {
    await kattint(p, `[data-tipus="${tipus}"]`);
    ok(`F: ${tipus}: az urlap nyilik (nincs naptar)`, await varj(p, 'form.urlap'));
    const m = await sr(p, 'return { sav:[...r.querySelectorAll(".lepesek button")].map(x=>x.textContent.replace(/^\\d+\\.\\s*/,"").trim()), opciok:[...r.querySelectorAll("select[name=mire] option")].map(x=>x.textContent), mezok:["nev","tel","email","mikor","varos","mire","miben","kep","orszag"].filter(n=>!r.querySelector("[name="+n+"]")), nap: !!r.querySelector("[data-slot],[data-nap],[data-hely]"), gomb:(r.querySelector("[data-kuld]")||{}).textContent };');
    ok(`F: ${tipus}: 2 lepes (Szolgaltatas, Adatok), a mezok megvannak, a "Mire kersz idopontot?" ${db} lehetoseg`, JSON.stringify(m.sav) === JSON.stringify(['Szolgáltatás', 'Adatok']) && !m.mezok.length && !m.nap && m.opciok.length === db && m.gomb === 'Visszahívást kérek!', JSON.stringify({ sav: m.sav, hianyzo: m.mezok, opciok: m.opciok.length, gomb: m.gomb }));
    await kattint(p, '[data-vissza]');
    if (!await varj(p, '[data-tipus]', 4000)) { ok(`F: ${tipus}: a vissza gomb a tipus-valasztora visz`, false); break; }
  }
  ok('F: urlapnal nem megy Salonic-kerés', !ki.some((x) => /salonic/.test(x.u)));

  // G. kotelezo mezok, hibauzenetek
  await kattint(p, '[data-tipus="kontroll"]');
  await varj(p, 'form.urlap');
  await p.waitForTimeout(500);
  await p.locator('[data-kuld]').click();
  await p.waitForTimeout(500);
  const hibak6 = await sr(p, 'return [...r.querySelectorAll(".mezo.hibas .hiba-uzenet")].map(x=>x.textContent)');
  ok('G: ures bekuldes: 6 hibauzenet (a regi /kontroll szovegeivel)', hibak6.length === 6 && hibak6.includes('Add meg a telefonszámot.') && hibak6.includes('Válassz dátumot.') && hibak6.includes('Add meg az e-mail-címet (például pelda@webhelyem.com).') && hibak6.includes('Írd be a választ.'), hibak6.join(' | '));
  ok('G: ures bekuldesre nem megy kerés', urlap.length === 0);
  await p.locator('input[name="email"]').fill('rossz');
  await p.locator('input[name="nev"]').click();
  const rosszEmail = await sr(p, 'return r.querySelector("input[name=email]").closest(".mezo").classList.contains("hibas")');
  await p.locator('input[name="email"]').fill('pelda@webhelyem.com');
  const joEmail = await sr(p, 'return !r.querySelector("input[name=email]").closest(".mezo").classList.contains("hibas")');
  ok('G: rossz e-mail hiba, javitasra eltunik', rosszEmail && joEmail);

  // H. kitoltes + bekuldes (elfogva): mezonevek / sorrend a regi /kontroll urlapeval, majd a /kontroll-ok oldal
  await p.locator('input[name="nev"]').fill('Teszt Elek');
  await p.locator('input[name="tel"]').fill('06 70 123 4567');
  await p.locator('input[name="mikor"]').fill('2026-09-15');
  await p.locator('input[name="varos"]').fill('Szeged');
  await p.locator('select[name="mire"]').selectOption({ index: 1 });
  await p.locator('textarea[name="miben"]').fill('Kontrollra szeretnék jönni.');
  await p.locator('input[name="kep"]').setInputFiles({ name: 'fulem.png', mimeType: 'image/png', buffer: PNG });
  await p.locator('[data-kuld]').click();
  await p.waitForURL(/\/kontroll-(ok|xyz)/, { timeout: 15000 }).catch(() => {});
  ok('H: a bekuldes utan a /kontroll-ok -> /kontroll-xyz koszonooldal nyilik', /\/kontroll-(ok|xyz)/.test(p.url()), p.url());
  ok('H: pontosan egy /api/urlap kerés ment', urlap.length === 1, `${urlap.length} db`);
  if (urlap.length === 1) {
    const r = reszek(urlap[0].torzs, urlap[0].ct);
    const nevek = r.map((x) => x.nev), ertek = (n) => (r.find((x) => x.nev === n) || {}).ertek;
    const VART = ['form-name', 'oldal', 'bot-field', 'Név', 'Telefonszám', 'E-mail cím', 'Mikor voltál nálunk?', 'Melyik városban voltál?', 'Miben segíthetünk?', 'Mire kérsz időpontot?', 'Kép'];
    ok('H: a mezonevek es a sorrend megegyeznek a regi /kontroll urlapeval', JSON.stringify(nevek) === JSON.stringify(VART), nevek.join(' | '));
    ok('H: az ertekek: urlap-nev, oldal, telefon (+36, a 06 elhagyva), datum, lehetoseg, kep', ertek('form-name') === 'kontroll-visszahivas' && ertek('oldal') === '/idopontfoglalas' && ertek('bot-field') === '' && ertek('Név') === 'Teszt Elek' && ertek('Telefonszám') === '+36 701234567' && ertek('E-mail cím') === 'pelda@webhelyem.com' && ertek('Mikor voltál nálunk?') === '2026. 09. 15.' && ertek('Melyik városban voltál?') === 'Szeged' && ertek('Mire kérsz időpontot?') === 'Konzultáció - Új vendégeknek - 5.000 Ft' && r.find((x) => x.nev === 'Kép').fajl === 'fulem.png', JSON.stringify(r.filter((x) => !x.fajl).map((x) => [x.nev, x.ertek])));
    try {
      const { level } = await import('../lib/levelek.js');
      const l = level('kontroll-visszahivas', r.filter((x) => !x.fajl).map((x) => [x.nev, x.ertek]));
      ok('H: a szalon e-mailje: targy a nevvel, valasz-cim a vendege', /Új visszahívás-kérés/.test(l.targy) && /Teszt Elek/.test(l.targy) && l.valasz === 'pelda@webhelyem.com', l.targy);
    } catch (e) { console.log('INFO H: a levelek.js nem toltheto be itt (' + e.message.slice(0, 60) + ')'); }
  }
  ok('H: nincs JS-hiba', !hibak.length, hibak.join(' | '));
  await ctx.close();
}

// I. hiba eseten uzenet, az urlap marad
{
  const { ctx, p, urlap } = await uj(500);
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  await varj(p, '[data-tipus]');
  await kattint(p, '[data-tipus="garancia"]');
  await varj(p, 'form.urlap');
  await p.waitForTimeout(400);
  await p.locator('input[name="nev"]').fill('Teszt Elek');
  await p.locator('input[name="tel"]').fill('+36 70 123 4567');
  await p.locator('input[name="email"]').fill('pelda@webhelyem.com');
  await p.locator('input[name="mikor"]').fill('2026-09-15');
  await p.locator('input[name="varos"]').fill('Pécs');
  await p.locator('textarea[name="miben"]').fill('Garanciális szúrás.');
  await p.locator('[data-kuld]').click();
  await p.waitForTimeout(1500);
  const m = await sr(p, 'return { uz:(r.querySelector(".kuld-uzenet")||{}).textContent, gomb:!!r.querySelector("[data-kuld]") && !r.querySelector("[data-kuld]").disabled, urlap:!!r.querySelector("form.urlap") }');
  ok('I: 500-as valasznal "Hiba tortent" uzenet, az urlap es a gomb marad', urlap.length === 1 && /Hiba történt/.test(m.uz || '') && m.gomb && m.urlap && !/kontroll-/.test(p.url()), JSON.stringify(m));
  await ctx.close();
}

// J. kikapcsolt motor (?motor=0): a regi ut
{
  const { ctx, p } = await uj();
  await p.goto(CIM + '/idopontfoglalas?motor=0', { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  ok('J: ?motor=0: az /idopontfoglalas a regi (tartalek) oldalra visz, a motor nem nyilik', /\/regi-idopontfoglalas/.test(p.url()) && !(await p.evaluate(() => !!document.querySelector('[data-mp-motor]'))), p.url());
  await p.goto(CIM + '/?motor=0', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  // a regi linkek "uj lapon" nyilnak (target=_blank): kikapcsolt motornal a link NEM kapja el a motor, a regi koztes oldal nyilik uj lapon
  const popup = ctx.waitForEvent('page', { timeout: 8000 }).then((pg) => pg, () => null);
  await linkKattint(p, 'a[href="/idopontfoglalas"]');
  const pg = await popup;
  if (pg) await pg.waitForURL(/idopontfoglalas/, { timeout: 8000 }).catch(() => {});
  ok('J: ?motor=0: a header link az /idopontfoglalas cimet nyitja (uj lapon), a motor az eredeti lapon nem nyilik', !!pg && /idopontfoglalas/.test(pg.url()) && !(await p.evaluate(() => !!document.querySelector('[data-mp-motor]'))), pg ? pg.url() : 'nincs uj lap');
  await ctx.close();
}

// L. a koztes oldalak helyett a fooldal: /kontroll -> a kontroll-urlap nyilik a fooldal fole, /idopontfoglalas -> a tipus-valaszto; bezarva a fooldal marad, a cim "/"
{
  const ctx0 = await b.newContext({ locale: 'hu-HU' });
  const hp = await ctx0.newPage();
  await hp.route((u) => !u.toString().startsWith(CIM), (r) => r.abort());
  await hp.goto(CIM + '/', { waitUntil: 'load' });
  const fooldalCim = await hp.title();
  await ctx0.close();
  for (const [ut, vart] of [['/kontroll', 'urlap'], ['/idopontfoglalas', 'tipus']]) {
    const { ctx, p } = await uj();
    await p.goto(CIM + ut, { waitUntil: 'load' });
    const nyilt = vart === 'urlap' ? await varj(p, 'form.urlap') : await varj(p, '[data-tipus]');
    const masik = await sr(p, vart === 'urlap' ? 'return !!r.querySelector("[data-tipus]")' : 'return !!r.querySelector("form.urlap")');
    ok(`L: ${ut}: betolteskor ${vart === 'urlap' ? 'a kontroll-urlap' : 'a tipus-valaszto'} nyilik meg`, nyilt && !masik);
    if (vart === 'urlap') ok('L: /kontroll: az urlap a "Kontroll" tipusu', /Kontroll/.test(await sr(p, 'return (r.querySelector(".urlap-fej")||{}).textContent||""')));
    ok(`L: ${ut}: a hatterben a fooldal van (azonos cim)`, (await p.title()) === fooldalCim, await p.title());
    await kattint(p, '[data-bezar]');
    await p.waitForTimeout(400);
    ok(`L: ${ut}: bezaras utan a fooldal marad, a cim "/"`, new URL(p.url()).pathname === '/' && !(await p.evaluate(() => !!document.querySelector('[data-mp-motor]'))), p.url());
    await ctx.close();
  }
}

// M. a link szovege dont: kontroll / ekszercsere / garancia -> egybol az urlap; minden mas foglalasi gomb -> a tipus-valaszto; a modositas-link a Salonicra megy
{
  const { ctx, p } = await uj();
  await p.goto(CIM + '/', { waitUntil: 'load' });
  await p.waitForTimeout(2000);
  await p.evaluate(() => { document.addEventListener('click', (e) => { window.__mpMegfogta = e.defaultPrevented; }); window.addEventListener('click', (e) => e.preventDefault()); });
  const ESETEK = [
    ['Időpontfoglalás', '/idopontfoglalas', 'tipus'],
    ['Időpontot foglalok!', 'https://medicalpiercing.salonic.hu/selectLocation', 'tipus'],
    ['Ricsi időpontjai', 'https://medicalpiercing.salonic.hu/employees/17769/', 'tipus'],
    ['Kontroll időpontok', '/kontroll', 'Kontroll'],
    ['Garancia / Kontroll időpontfoglalás >>', '/kontroll', 'Kontroll'],
    ['Időpontfoglalás Garanciális konzultációra >>', '/kontroll', 'Garancia'],
    ['Időpont foglalás ékszer cserére!', '/kontroll', 'Ékszercsere'],
    ['Budapest - Garancia időpontok >>', 'https://medicalpiercing.salonic.hu/selectEmployee/?placeId=6029', 'Garancia'],
    ['Módosítanál az időpontodon? Időpont módosítás!', 'https://medicalpiercing.salonic.hu/selectLocation', 'salonic'],
  ];
  for (const [szoveg, href, vart] of ESETEK) {
    await p.evaluate(([szoveg, href]) => { document.getElementById('mp-teszt-link')?.remove(); const a = document.createElement('a'); a.id = 'mp-teszt-link'; a.href = href; a.textContent = szoveg; a.style.cssText = 'position:fixed;top:0;left:0;z-index:1;padding:4px;background:#fff'; document.body.append(a); window.__mpMegfogta = null; }, [szoveg, href]);
    await p.evaluate(() => document.getElementById('mp-teszt-link').click());
    let allapot = 'semmi';
    if (vart === 'salonic') { await p.waitForTimeout(700); allapot = (await p.evaluate(() => window.__mpMegfogta)) === false && !(await p.evaluate(() => !!document.querySelector('[data-mp-motor]'))) ? 'salonic' : 'motor'; }
    else if (vart === 'tipus') { allapot = (await varj(p, '[data-tipus]', 8000)) ? 'tipus' : 'semmi'; }
    else if (await varj(p, 'form.urlap', 8000)) allapot = /Ékszercsere|Garancia|Kontroll/.exec(await sr(p, 'return (r.querySelector(".urlap-fej")||{}).textContent||""'))?.[0] || 'urlap';
    ok(`M: "${szoveg}" (${href.replace('https://medicalpiercing.salonic.hu', 'salonic')}) -> ${vart === 'tipus' ? 'tipus-valaszto' : vart === 'salonic' ? 'a Salonicra megy (a motor nem veszi at)' : 'urlap: ' + vart}`, allapot === vart || (vart === 'tipus' && allapot === 'tipus'), `kapott: ${allapot}`);
    if (await p.evaluate(() => !!document.querySelector('[data-mp-motor]'))) { await kattint(p, '[data-bezar]'); await p.waitForTimeout(200); }
  }
  await ctx.close();
}

// N. a piercing-lepes mindenhonnan ugyanaz, ket kerdesre szurve: Kinek? (magamnak / ket szemelynek) + Milyen szolgaltatas? (1 piercing / tobb piercing / fulbevalo); nincs oldalfuggo "Ajanlott"
for (const [honnan, ut] of [['migren-oldalrol', '/migren-piercing'], ['fooldalrol', '/']]) {
  const { ctx, p } = await uj();
  await p.goto(CIM + ut, { waitUntil: 'load' });
  await p.waitForTimeout(2200);
  await p.evaluate(() => { const l = [...document.querySelectorAll('a[href="/idopontfoglalas"]')]; (l.find((x) => x.offsetParent) || l[0]).click(); });
  await varj(p, '[data-tipus]'); await kattint(p, '[data-tipus="uj"]');
  await varj(p, '[data-hely]'); await kattint(p, '[data-hely="6029"]');
  const van = await varj(p, '[data-szolg]', 30000);
  await p.waitForTimeout(400);
  const olvas = () => sr(p, 'const nevek=[...r.querySelectorAll("[data-szolg] .nev > span")].map(x=>x.textContent.trim()); const on=[...r.querySelectorAll(".szeg button.on")].map(x=>x.textContent.replace(/legjobban megéri/i,"").trim()); const tilt=[...r.querySelectorAll(".szeg button[disabled]")].map(x=>x.textContent.trim()); return { cimkek:[...r.querySelectorAll(".szuro-cimke")].map(x=>x.textContent.trim().replace(/^[0-9]/,"")), szamok:[...r.querySelectorAll(".szam")].map(x=>x.textContent), on, tilt, db:nevek.length, nevek, fej:(r.querySelector(".lista-fej span:last-child")||{}).textContent, jelzo: !!r.querySelector("[data-mit=tobb] i"), ajanlott: /Ajánlott/.test(r.textContent), nevSzin: nevek.length?getComputedStyle(r.querySelector("[data-szolg] .nev")).color:"", arSzin: nevek.length?getComputedStyle(r.querySelector("[data-szolg] .ar")).color:"" }');
  ok(`N: ${honnan}: a lista betoltodik`, van);
  if (!van) { await ctx.close(); continue; }
  let m = await olvas();
  ok(`N: ${honnan}: ket kerdes (Kinek? / Milyen szolgaltatas?), alapertek: Magamnak + Tobb piercing (a "legjobban megeri" latszik elsore)`, JSON.stringify(m.cimkek) === JSON.stringify(['Kinek szeretnél időpontot?', 'Milyen piercing érdekel?']) && JSON.stringify(m.on) === JSON.stringify(['Magamnak', 'Több piercing']), JSON.stringify([m.cimkek, m.on]));
  ok(`N: ${honnan}: a harom cim szamozott: 1 Kinek? / 2 Milyen szolgaltatas? / 3 Valaszthato piercingek`, JSON.stringify(m.szamok) === JSON.stringify(['1', '2', '3']), JSON.stringify(m.szamok));
  ok(`N: ${honnan}: alapertek (Tobb piercing): 3 piercing, 2 piercing, 1+1 allergia`, m.db === 3 && /^3 piercing/.test(m.nevek[0]) && /^2 piercing/.test(m.nevek[1]) && /^1\+1/.test(m.nevek[2]), JSON.stringify(m.nevek));
  ok(`N: ${honnan}: a "Tobb piercing" gombon "legjobban megeri" jelzes van`, m.jelzo);
  await kattint(p, '[data-mit="egy"]'); m = await olvas();
  ok(`N: ${honnan}: 1 piercing: 9 lehetoseg (maj, lep, vastagbel, allergia is), "9 lehetőség" felirat, nincs "Ajanlott"`, m.db === 9 && /9 lehetőség/i.test(m.fej) && ['Máj', 'Lép', 'Vastagbél', 'Allergia'].every((x) => m.nevek.includes(x)) && !m.ajanlott, JSON.stringify(m.nevek));
  ok(`N: ${honnan}: a piercing neve kiemelt szinu (terrakotta), az ar sotet`, m.nevSzin === 'rgb(163, 90, 75)' && m.arSzin === 'rgb(69, 70, 89)', `${m.nevSzin} / ${m.arSzin}`);
  await kattint(p, '[data-mit="fulbevalo"]'); m = await olvas();
  ok(`N: ${honnan}: Fulbevalo: 1, 2, 3 db`, m.db === 3 && m.nevek.every((x) => /^Fülbevaló/.test(x)), JSON.stringify(m.nevek));
  await kattint(p, '[data-kinek="ketto"]'); m = await olvas();
  ok(`N: ${honnan}: Ket szemelynek: a Fulbevalo nem valaszthato (a valasztott fulbevalo helyett az 1 piercing lep: 2 szemelynek - 2 db)`, m.tilt.includes('Fülbevaló') && m.db === 1 && /^2 személynek – 2 db/.test(m.nevek[0]), JSON.stringify([m.tilt, m.nevek]));
  await kattint(p, '[data-mit="tobb"]'); m = await olvas();
  ok(`N: ${honnan}: Ket szemelynek + Tobb piercing: 2 szemelynek - 4 db es 6 db`, m.db === 2 && m.nevek.every((x) => /^2 személynek – [46] db/.test(x)), JSON.stringify(m.nevek));
  await ctx.close();
}
// Sopron: nincs "2 szemelynek - 2 db" (a Salonicban hianyzik): a ket szemelynek az elso letezo lehetosegre all (tobb piercing), az 1 piercing nem valaszthato
{
  const { ctx, p } = await uj();
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  await varj(p, '[data-tipus]'); await kattint(p, '[data-tipus="uj"]');
  await varj(p, '[data-hely]'); await kattint(p, '[data-hely="9067"]');
  await varj(p, '[data-szolg]', 30000); await p.waitForTimeout(300);
  await kattint(p, '[data-kinek="ketto"]');
  const m = await sr(p, 'return { tilt:[...r.querySelectorAll(".szeg button[disabled]")].map(x=>x.textContent.trim()), nevek:[...r.querySelectorAll("[data-szolg] .nev > span")].map(x=>x.textContent.trim()) }');
  ok('N: Sopron: ket szemelynek -> az 1 piercing es a fulbevalo nem valaszthato, a lista a tobb piercinges csomagokat mutatja', m.tilt.includes('1 piercing') && m.tilt.includes('Fülbevaló') && m.nevek.length >= 1, JSON.stringify(m));
  await ctx.close();
}

// O. a helyszin-valaszto sehol nem log ki oldalra (nincs vizszintes gorgetes), semmilyen szelessegen
for (const w of [320, 360, 375, 390, 393, 412, 480, 592, 700, 768, 1024, 1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 700 ? 740 : 900 }, locale: 'hu-HU' });
  await ctx.route((u) => !u.toString().startsWith(CIM), (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  await varj(p, '[data-tipus]'); await kattint(p, '[data-tipus="uj"]'); await varj(p, '[data-hely]');
  await p.waitForTimeout(300);
  const m = await sr(p, 'const t=r.querySelector(".tartalom"), tr=t.getBoundingClientRect(); const ks=[...r.querySelectorAll("[data-hely]")]; return { sw:t.scrollWidth, cw:t.clientWidth, tulog:ks.filter(k=>k.getBoundingClientRect().right>tr.right+0.5||k.getBoundingClientRect().left<tr.left-0.5).map(k=>k.textContent.trim()), levagott: ks.filter(k=>{const n=k.querySelector(".nev"); return n.scrollWidth>n.clientWidth+1;}).map(k=>k.textContent.trim()), db: ks.length }');
  ok(`O: ${w}px: a 15 helyszin-kartya oldalra nem log ki, a nev nem vagodik le`, m.db === 15 && m.sw <= m.cw + 1 && !m.tulog.length && !m.levagott.length, JSON.stringify(m));
  if (w <= 700) {
    // mobilon (Feri 2026-10-13): egy oszlop, nagy cellak es nagy betu; a gorgetes elfogadott
    const k = await sr(p, 'const ks=[...r.querySelectorAll("[data-hely]")]; const rr=ks.map(x=>x.getBoundingClientRect()); return { oszlop: new Set(rr.map(x=>Math.round(x.left))).size, magas: Math.round(Math.min(...rr.map(x=>x.height))), szeles: Math.round(Math.min(...rr.map(x=>x.width))), betu: parseFloat(getComputedStyle(ks[0].querySelector(".nev")).fontSize) };');
    ok(`O: ${w}px: a helyszinek egy oszlopban, nagy cellakban (>= 54 px magas, >= 17 px betu)`, k.oszlop === 1 && k.magas >= 54 && k.betu >= 17 && k.szeles >= w - 40, JSON.stringify(k));
  }
  await ctx.close();
}

// K. az urlap egy kepernyon: asztalon SEMMIKEPP nem lóg ki; mobilon egy kepernyore fer (mint a Salonic-adatlap) - tobb meretben (egyszer, az asztali futasban)
if (!MOBIL) {
  const MERETEK = [
    ['asztali 1920x1080', { viewport: { width: 1920, height: 1080 }, locale: 'hu-HU' }, false],
    ['asztali 1440x900', { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' }, false],
    ['asztali 1366x768', { viewport: { width: 1366, height: 768 }, locale: 'hu-HU' }, false],
    ['Pixel 5 (393x727)', { ...devices['Pixel 5'], locale: 'hu-HU' }, true],
    ['iPhone 12 (390x664)', { ...devices['iPhone 12'], locale: 'hu-HU' }, true],
    ['iPhone SE 3 (375x667)', { ...devices['iPhone SE (3rd gen)'], locale: 'hu-HU' }, true],
    ['Galaxy S9+ (320x658)', { ...devices['Galaxy S9+'], locale: 'hu-HU' }, true],
  ];
  for (const [nev, opt, mobil] of MERETEK) {
    for (const tipus of Object.keys(LEHETOSEGEK)) {
      const ctx = await b.newContext(opt);
      await ctx.route((u) => !u.toString().startsWith(CIM), (r) => r.abort());
      const p = await ctx.newPage();
      await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
      await varj(p, '[data-tipus]');
      await kattint(p, `[data-tipus="${tipus}"]`);
      await varj(p, 'form.urlap');
      await p.waitForTimeout(600);
      const m = await sr(p, 'const t=r.querySelector(".tartalom"), g=r.querySelector("[data-kuld]").getBoundingClientRect(), ab=r.querySelector(".ablak").getBoundingClientRect(); return { elfer: t.scrollHeight<=t.clientHeight+1, sh:t.scrollHeight, ch:t.clientHeight, gombAlja:Math.round(g.bottom), ablakAlja:Math.round(ab.bottom), kep: (r.querySelector("[name=kep]").getBoundingClientRect().bottom <= ab.bottom) };');
      ok(`K: ${nev}: ${tipus}: az urlap egy kepernyon (gorgetes nelkul), a gomb latszik`, m.elfer && m.gombAlja <= m.ablakAlja, `scrollH ${m.sh} / lathato ${m.ch}, gomb alja ${m.gombAlja} / ablak alja ${m.ablakAlja}`);
      await ctx.close();
      if (tipus === 'kontroll') continue; // a ket tovabbi tipus ugyanazt az elrendezest adja (csak a legordulo szovege mas): meretenkent elég egyszer
      break;
    }
  }
}

// K2. a piercing-lepes (ket szuro + az alapertelmezett lista): asztalon egy kepernyon (szigoru), mobilon nagy, olvashato elemek (a gorgetes elfogadott) (a Salonic-listaadat olvaso GET-tel jon)
if (!MOBIL) {
  const SALONIC = /^https:\/\/(medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
  const MERETEK2 = [
    ['asztali 1920x1080', { viewport: { width: 1920, height: 1080 }, locale: 'hu-HU' }, true],
    ['asztali 1440x900', { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' }, true],
    ['asztali 1366x768', { viewport: { width: 1366, height: 768 }, locale: 'hu-HU' }, true],
    ['Pixel 5 (393x727)', { ...devices['Pixel 5'], locale: 'hu-HU' }, false],
    ['iPhone 12 (390x664)', { ...devices['iPhone 12'], locale: 'hu-HU' }, false],
    ['iPhone SE 3 (375x667)', { ...devices['iPhone SE (3rd gen)'], locale: 'hu-HU' }, false],
    ['Galaxy S9+ (320x658)', { ...devices['Galaxy S9+'], locale: 'hu-HU' }, false],
  ];
  for (const [nev, opt, szigoru] of MERETEK2) {
    const ctx = await b.newContext(opt);
    await ctx.route((u) => !u.toString().startsWith(CIM), (r) => (r.request().method() === 'GET' && SALONIC.test(r.request().url()) ? r.continue() : r.abort()));
    const p = await ctx.newPage();
    await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
    await varj(p, '[data-tipus]');
    await kattint(p, '[data-tipus="uj"]');
    await varj(p, '[data-hely]');
    await kattint(p, '[data-hely="6029"]');
    const van = await varj(p, '[data-szolg]', 30000);
    await kattint(p, '[data-mit="egy"]'); // a leghosszabb lista (9 sor): ez a legrosszabb eset
    await p.waitForTimeout(500);
    const m = van ? await sr(p, 'const t=r.querySelector(".tartalom"); const ks=[...r.querySelectorAll("[data-szolg]")]; const tr=t.getBoundingClientRect(), o=r.querySelector(".osszegzes").getBoundingClientRect(), q=[...r.querySelectorAll(".szuro-sor")].map(x=>x.getBoundingClientRect()), f=r.querySelector(".lista-fej").getBoundingClientRect(); return { sor: ks.length, betu: parseFloat(getComputedStyle(ks[0].querySelector(".nev")).fontSize), gomb: Math.round(Math.min(...[...r.querySelectorAll(".szeg button")].map(x=>x.getBoundingClientRect().height))), sh:t.scrollHeight, ch:t.clientHeight, magas: Math.round(ks[0].getBoundingClientRect().height), egysoros: ks.every(k=>k.querySelector(".nev > span").getBoundingClientRect().height < 19), szabad: Math.round(tr.bottom - ks[ks.length-1].getBoundingClientRect().bottom - 14), tav: [Math.round(q[0].top-o.bottom), Math.round(q[1].top-q[0].bottom), Math.round(f.top-q[1].bottom)] };') : null;
    if (!m) { ok(`K2: ${nev}: a piercing-lista betoltodik`, false); await ctx.close(); continue; }
    const elfer = m.sh <= m.ch + 1;
    ok(`K2: ${nev}: a szuro-szekciok kozott van levego (Budapest / 1. kerdes / 2. kerdes / lista: legalabb 10 px)`, m.tav.every((x) => x >= 10), JSON.stringify(m.tav));
    if (szigoru) {
      ok(`K2: ${nev}: a legrosszabb esetben (9 sor) az utolso sor alatt van meg hely (>= 8 px)`, m.szabad >= 8, `${m.szabad} px`);
      ok(`K2: ${nev}: a piercing-lepes (szurok + ${m.sor} soros lista) egy kepernyon, gorgetes nelkul`, elfer, `scrollH ${m.sh} / lathato ${m.ch}, sormagassag ${m.magas}px`);
    } else {
      // mobilon (Feri 2026-10-13) az olvashatosag az elsodleges: nagy betu, magas sorok es gombok; a gorgetes elfogadott
      ok(`K2: ${nev}: a piercing-sorok nagyok (>= 52 px magas sor, >= 16 px betu), a szuro-gombok >= 48 px magasak`, m.magas >= 52 && m.betu >= 16 && m.gomb >= 48, `sor ${m.magas}px, betu ${m.betu}px, gomb ${m.gomb}px`);
      console.log(`INFO K2: ${nev}: ${m.sor} sor, ${elfer ? 'elfer' : `gorgetes kell (${m.sh} / ${m.ch})`}, sormagassag ${m.magas}px`);
    }
    await ctx.close();
  }
}

// P. az adatlap (utolso oldal) tetejen latszik a szakember (Feri kerese, 2026-10-14): Barki valasztasakor "Barki", kulonben a valasztott szakember
//    (fejkep / monogram + becenev, ugyanaz a csempe, mint az idopont-lepesben); a Salonic adatlapja a szakembert nem mutatja
{
  const { ctx, p } = await uj();
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  await varj(p, '[data-tipus]'); await kattint(p, '[data-tipus="uj"]');
  await varj(p, '[data-hely]'); await kattint(p, '[data-hely="6029"]');
  const van = await varj(p, '[data-szolg]', 30000);
  if (ok('P: a piercing-lista betoltodik (Budapest)', van)) {
    await kattint(p, '[data-mit="egy"]'); await p.waitForTimeout(300);
    await kattint(p, '[data-szolg]');
    const ido = await varj(p, '[data-slot]', 40000);
    if (ok('P: az idopontok betoltodnek', ido)) {
      const chipek = await sr(p, 'return [...r.querySelectorAll("[data-staff]")].map(x=>({id:x.dataset.staff, szoveg:x.textContent.trim()}))');
      ok('P: tobb szakember: Barki + nevek', chipek.length >= 3 && chipek[0].id === '', JSON.stringify(chipek));
      await kattint(p, '[data-slot]'); // alapertek: Barki
      const sav = () => sr(p, 'const c=r.querySelector(".adatlap-szakember .chip"); return c ? { szoveg: c.textContent.trim(), fejkep: !!c.querySelector(".fejkep"), cim: r.querySelector(".adatlap-szakember").textContent.trim(), lathato: c.getBoundingClientRect().height > 20 } : null');
      ok('P: az adatlap tetejen "Szakember" sav latszik', await varj(p, '.adatlap-szakember'));
      let m = await sav();
      ok('P: Barki: a sav "Barki", fejkeppel (ikon)', !!m && m.szoveg === 'Bárki' && m.fejkep && m.lathato && /^Szakember/.test(m.cim), JSON.stringify(m));
      // vissza az idopontokhoz, konkret szakember valasztasa
      await kattint(p, '[data-vissza]');
      await varj(p, '[data-staff]');
      const kivalasztott = chipek.find((x) => x.id !== '');
      await kattint(p, `[data-staff="${kivalasztott.id}"]`);
      await varj(p, '[data-slot]');
      await kattint(p, '[data-slot]');
      await varj(p, '.adatlap-szakember');
      m = await sav();
      ok(`P: valasztott szakember (${kivalasztott.szoveg}): a sav ugyanazt a csempet mutatja, mint az idopont-lepes`, !!m && m.szoveg === kivalasztott.szoveg && m.fejkep && m.lathato, JSON.stringify({ var: kivalasztott.szoveg, sav: m }));
    }
  }
  await ctx.close();
}

await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
