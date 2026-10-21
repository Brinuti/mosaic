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
  ok('A: 4 kartya: Uj piercing, Kontroll, Ekszercsere / visszarakas, Garancia', JSON.stringify(m.nevek) === JSON.stringify(['Új piercing', 'Kontroll', 'Ékszercsere / visszarakás', 'Garancia']), m.nevek.join(' | '));
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

// E. Salonic-linkre kattintas: a meres a kattintaskor (suti.js), a motor nem duplazza (a /migren lapon: ott a motor nem nyilik magatol meg, es a regi / uj dizajnban is van altalanos Salonic-link)
{
  const { ctx, p, ki } = await uj();
  await p.goto(CIM + '/migren', { waitUntil: 'load' });
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
// az ekszercsere / visszarakas urlapon a ket csere mellett a kiesett ekszer ujraszurasa (kozerzetjavito / fulbevalo; a tulajdonos dontese, 2026-10-16)
const LEHETOSEGEK = { kontroll: 3, ekszercsere: 4, garancia: 1 };
{
  const { ctx, p, ki, urlap, hibak } = await uj();
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  await varj(p, '[data-tipus]');
  for (const [tipus, db] of Object.entries(LEHETOSEGEK)) {
    await kattint(p, `[data-tipus="${tipus}"]`);
    ok(`F: ${tipus}: az urlap nyilik (nincs naptar)`, await varj(p, 'form.urlap'));
    const m = await sr(p, 'return { sav:[...r.querySelectorAll(".lepesek button")].map(x=>x.textContent.replace(/^\\d+\\.\\s*/,"").trim()), opciok:[...r.querySelectorAll("select[name=mire] option")].map(x=>x.textContent), mezok:["nev","tel","email","mikor","varos","mire","miben","kep","orszag"].filter(n=>!r.querySelector("[name="+n+"]")), nap: !!r.querySelector("[data-slot],[data-nap],[data-hely]"), gomb:(r.querySelector("[data-kuld]")||{}).textContent };');
    ok(`F: ${tipus}: 2 lepes (Szolgaltatas, Adatok), a mezok megvannak, a "Mire kersz idopontot?" ${db} lehetoseg`, JSON.stringify(m.sav) === JSON.stringify(['Szolgáltatás', 'Adatok']) && !m.mezok.length && !m.nap && m.opciok.length === db && m.gomb === 'Visszahívást kérek!', JSON.stringify({ sav: m.sav, hianyzo: m.mezok, opciok: m.opciok.length, gomb: m.gomb }));
    // Feri kerese (2026-10-21): kontroll / garancia: az urlap felett a fogadasi ido es az idopont-egyeztetes (az ekszerceresnel nincs)
    const figy = await sr(p, 'const f=r.querySelector(".urlap-figy"); return f ? { szoveg: f.textContent, folotte: !!(f.compareDocumentPosition(r.querySelector("form.urlap")) & Node.DOCUMENT_POSITION_FOLLOWING) } : null;');
    ok(`F: ${tipus}: ${tipus === 'ekszercsere' ? 'nincs' : 'az urlap folott latszik a'} "H-Cs 8-14 ora" es a "Csak idopont-egyeztetessel" figyelmeztetes`, tipus === 'ekszercsere' ? !figy : !!figy && figy.folotte && /hétfőtől csütörtökig/.test(figy.szoveg) && /8:00–14:00/.test(figy.szoveg) && /Csak időpont-egyeztetéssel/.test(figy.szoveg), JSON.stringify(figy));
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
  // (az uj fooldal - elesitve az eredeti cimen - a foglalasi linket ugyanabban a lapban nyitja: ott a lap maga jut a regi koztes oldalra)
  const ujLap = (await p.$eval('a[href="/idopontfoglalas"]', (a) => a.target)) === '_blank';
  const popup = ujLap ? ctx.waitForEvent('page', { timeout: 8000 }).then((pg) => pg, () => null) : null;
  await linkKattint(p, 'a[href="/idopontfoglalas"]');
  const pg = ujLap ? await popup : p;
  if (pg) await pg.waitForURL(/idopontfoglalas/, { timeout: 8000 }).catch(() => {});
  const motorNyitva = await p.evaluate(() => !!document.querySelector('[data-mp-motor]')).catch(() => false);
  ok(`J: ?motor=0: a header link az /idopontfoglalas cimet nyitja (${ujLap ? 'uj lapon' : 'ugyanabban a lapban'}), a motor nem nyilik`, !!pg && /idopontfoglalas/.test(pg.url()) && !motorNyitva, pg ? pg.url() : 'nincs uj lap');
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

// N. a piercing-lepes mindenhonnan ugyanaz (a tulajdonos kerese, 2026-10-20: "regen egy listaban volt az osszes piercing, egymas alatt"): NINCS szurosor (Magamnak / 2 szemelynek,
//    1 piercing / 2-3 piercing / Fulbevalo), a 4,8-as ertekeles mellett a felugro "Hogy néz ki egy szúrás?", MINDEN lehetoseg kartyaja egy listaban, tomor kartyakkal;
//    minden kartyan "Részletek" (lenyitja) + "Időpontot választok" (tovabb). Sorrend: 3 piercing, 2 piercing (kiemelve, "Akció · Legjobban megéri"), 1 piercing (a tipusoldal piercingje elol), 1+1, 2 szemelynek, fulbevalo.
for (const [honnan, ut, elso] of [['migren-oldalrol', '/migren-piercing', 'Migrén'], ['lep-oldalrol', '/lep-piercing', 'Lép'], ['fooldalrol', '/', 'Migrén']]) {
  const { ctx, p } = await uj();
  await p.goto(CIM + ut, { waitUntil: 'load' });
  await p.waitForTimeout(2200);
  await p.evaluate(() => { const l = [...document.querySelectorAll('a[href="/idopontfoglalas"]')]; (l.find((x) => x.offsetParent) || l[0]).click(); });
  await varj(p, '[data-tipus]'); await kattint(p, '[data-tipus="uj"]');
  await varj(p, '[data-hely]'); await kattint(p, '[data-hely="6029"]');
  const van = await varj(p, '[data-szolg]', 30000);
  await p.waitForTimeout(400);
  const olvas = () => sr(p, 'const kiemelt=[...r.querySelectorAll(".pk.pk-ajanlott .pk-cim b")].map(x=>x.textContent), jelzo=[...r.querySelectorAll(".pk-jelzo")].map(x=>x.textContent); const nevek=[...r.querySelectorAll("[data-szolg] .nev > span")].map(x=>x.textContent.trim()); const ny=r.querySelector(".pk.nyitva"); const kartyak=[...r.querySelectorAll(".pk:not([hidden])")]; return { kiemelt, jelzo, fejlec:!!r.querySelector(".pk-fejlec"), tartalmaz:/Az ár tartalmazza/.test(r.textContent), szuro:r.querySelectorAll(".pk-szuro, .szeg").length, db:nevek.length, nevek, latszik:kartyak.map(x=>x.querySelector(".pk-cim b").textContent), ketgomb:kartyak.every(k=>k.querySelector(".pk-gombok .pk-reszlet[data-nyit]") && k.querySelector(".pk-gombok .pk-valaszt[data-szolg]")), nyitott:ny?ny.querySelector(".pk-cim b").textContent:"", foto:!!(ny&&ny.querySelector(".pk-pont img")), garancia:!!(ny&&ny.querySelector(".pk-garancia")), plusz:!!r.querySelector("[data-plusz]"), kedv:ny?(ny.querySelector(".pk-kedv")||{}).textContent||"":"", tobb:!!r.querySelector("[data-tobbtipus]"), csempe:/Mikor\\?|Fáj\\?/.test(r.textContent) }');
  ok(`N: ${honnan}: a lista betoltodik`, van);
  if (!van) { await ctx.close(); continue; }
  let m = await olvas();
  // a "Kiesett ékszer újraszúrása" belsős Salonic-szolgáltatás (a tulajdonos döntése, 2026-10-16): sehol nincs a listában
  const nincsUjra = (l) => !l.some((x) => /kiesett|újraszúr/i.test(x));
  const elsok = m.nevek.slice(2, 11);
  ok(`N: ${honnan}: az elso ketto a 3 piercing es a 2 piercing, kiemelve ("Akció · Legjobban megéri"); a tobbi nincs kiemelve`, /^3 piercing/.test(m.nevek[0]) && /^2 piercing/.test(m.nevek[1]) && JSON.stringify(m.kiemelt) === JSON.stringify(['3 piercing', '2 piercing']) && m.jelzo.length === 2 && m.jelzo.every((x) => /Akció/.test(x) && /Legjobban megéri/.test(x)), JSON.stringify([m.kiemelt, m.jelzo]));
  ok(`N: ${honnan}: egy listaban az osszes: 3 + 2 piercing, utana a 9 db 1 piercing (a(z) ${elso} piercing elol; Máj, Lép, Vastagbél, Allergia megvan), 1+1, majd a 2 szemelynek es a fulbevalok; nincs "Kiesett ékszer újraszúrása"`,
    m.db >= 15 && m.latszik.length === m.db && nincsUjra(m.nevek) && m.latszik[2] === elso + ' piercing' && ['Máj', 'Lép', 'Vastagbél', 'Allergia'].every((x) => elsok.includes(x))
    && /^1\+1/.test(m.nevek[11]) && /^2 személynek/.test(m.nevek[12]) && /^Fülbevaló/.test(m.nevek[m.db - 1])
    && m.ketgomb && !m.tobb && !m.plusz && !m.csempe, JSON.stringify(m.latszik));
  ok(`N: ${honnan}: a(z) 2 szemelynek es a fulbevalo is a listaban van (nem kell szuro)`, m.nevek.some((x) => /^2 személynek/.test(x)) && m.nevek.filter((x) => /^Fülbevaló/.test(x)).length === 3, JSON.stringify(m.nevek.slice(12)));
  await kattint(p, '.pk:not(.pk-ajanlott) .pk-reszlet'); m = await olvas();
  ok(`N: ${honnan}: az elso (nem kiemelt) kartya "Részletek" gombjara az nyilik le, fulfotoval, garanciaval, "Az ár tartalmazza"-val`, m.nyitott === elso + ' piercing' && m.foto && m.garancia && (await sr(p, 'return /Az ár tartalmazza/.test(r.querySelector(".pk.nyitva").textContent)')) === true, m.nyitott);
  await kattint(p, '.pk:not(.nyitva):not(.pk-ajanlott) .pk-reszlet'); m = await olvas();
  ok(`N: ${honnan}: egy masik kartya "Részletek" gombjara az nyilik le (egyszerre egy)`, !!m.nyitott && m.nyitott !== elso + ' piercing' && (await sr(p, 'return r.querySelectorAll(".pk.nyitva").length')) === 1, m.nyitott);
  await kattint(p, '.pk.nyitva .pk-reszlet');
  await sr(p, 'const k=[...r.querySelectorAll(".pk")].find(x=>/^3 piercing/.test(x.querySelector(".pk-cim b").textContent)); k.querySelector(".pk-reszlet").click()'); m = await olvas();
  ok(`N: ${honnan}: a 3 piercing "Részletek"-je: a kedvezmeny magyarazata (kulon-kulon 3 × ... lenne, ... Ft-ot sporolsz)`, m.nyitott === '3 piercing' && /Így jön ki a kedvezmény/.test(m.kedv) && /Külön-külön 3 × [\d.]+ Ft = [\d.]+ Ft lenne/.test(m.kedv) && /Ft-ot spórolsz/.test(m.kedv), JSON.stringify([m.nyitott, m.kedv]));
  await sr(p, 'const k=[...r.querySelectorAll(".pk")].find(x=>/^2 piercing/.test(x.querySelector(".pk-cim b").textContent)); k.querySelector(".pk-reszlet").click()'); m = await olvas();
  ok(`N: ${honnan}: a 2 piercing kedvezmenye is ki van fejtve`, m.nyitott === '2 piercing' && /Külön-külön 2 × [\d.]+ Ft = [\d.]+ Ft lenne/.test(m.kedv), m.kedv);
  await kattint(p, '[data-szuras]');
  ok(`N: ${honnan}: "Hogy néz ki egy szúrás?": a video felugrik (nem a lista alatt nyilik)`, (await sr(p, 'return !!r.querySelector(".pk-felugro[role=dialog] video") && !r.querySelector(".tartalom video")')) === true);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  ok(`N: ${honnan}: az Esc csak a videot zarja be, a foglalo nyitva marad`, (await sr(p, 'return !r.querySelector(".pk-felugro") && !!r.querySelector(".pk")')) === true);
  await kattint(p, '[data-szuras]'); await kattint(p, '[data-szuras-bezar]');
  ok(`N: ${honnan}: a video X-szel is bezarhato`, (await sr(p, 'return !r.querySelector(".pk-felugro") && !!r.querySelector(".pk")')) === true);
  await ctx.close();
}

// K2. a piercing-lepes merete (a tulajdonos latvanyterve, 2026-10-16): minden meretben nagy, olvashato elemek, semmi nem log ki; asztalon az elso kartya
//     "Időpontot választok" gombja gorgetes nelkul latszik (a Salonic-listaadat olvaso GET-tel jon)
if (!MOBIL) {
  const SALONIC = /^https:\/\/(medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
  const MERETEK2 = [
    ['asztali 1920x1080', { viewport: { width: 1920, height: 1080 }, locale: 'hu-HU' }, true],
    ['asztali 1440x900', { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' }, true],
    ['asztali 1366x768', { viewport: { width: 1366, height: 768 }, locale: 'hu-HU' }, false],
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
    const van = await varj(p, '.pk', 30000);
    await p.waitForTimeout(500);
    const m = van ? await sr(p, 'const t=r.querySelector(".tartalom"); const fej=[...r.querySelectorAll(".pk:not([hidden]) .pk-fej")]; const is=r.querySelector(".pk-info-sor"); const v=r.querySelector(".pk .pk-valaszt"); const tr=t.getBoundingClientRect(); return { sor: fej.length, magas: Math.round(Math.min(...fej.map(x=>x.getBoundingClientRect().height))), betu: parseFloat(getComputedStyle(r.querySelector(".pk-cim b")).fontSize), reszlet: Math.round(Math.min(...[...r.querySelectorAll(".pk .pk-reszlet")].map(x=>x.getBoundingClientRect().height))), valaszt: v ? Math.round(v.getBoundingClientRect().height) : 0, kilog: t.scrollWidth > t.clientWidth + 1 || [...r.querySelectorAll(".pk:not([hidden])")].some(k=>k.scrollWidth > k.clientWidth + 1), latszik: v ? Math.round(v.getBoundingClientRect().bottom - tr.bottom) : 999, infoSor: is ? Math.round(is.getBoundingClientRect().height) : 0 };') : null;
    if (!m) { ok(`K2: ${nev}: a piercing-lista betoltodik`, false); await ctx.close(); continue; }
    ok(`K2: ${nev}: tomor kartyak (a fej 40–70 px), a nev >= 14 px, a "Részletek" es az "Időpontot választok" >= 34 px, a 4,8 + "Hogy néz ki egy szúrás?" egy sorban, semmi nem log ki`, m.magas >= 40 && m.magas <= 70 && m.betu >= 14 && m.reszlet >= 34 && m.valaszt >= 34 && m.infoSor <= 36 && !m.kilog, JSON.stringify(m));
    if (szigoru) ok(`K2: ${nev}: az elso kartya "Időpontot választok" gombja gorgetes nelkul latszik`, m.latszik <= 0, `${m.latszik} px`);
    if (!szigoru) console.log(`INFO K2: ${nev}: a valaszto gomb ${m.latszik <= 0 ? 'gorgetes nelkul latszik' : `${m.latszik} px-re a lathato resz alatt (gorgetes kell)`}`);
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

// Q. az urlap ket egymas melletti mezoje (Mikor voltal nalunk? + Melyik varosban voltal?) mobilon nem akad ossze (Feri kepe, 2026-10-14: iOS-en a datummezo a
//    sajat oszlopa fole nyult). Chromiumban nem reprodukalhato az iOS-hiba, ezert a dobozmodellt es az oszlophatart is ellenorizzuk (a javitas ezekre epul).
if (MOBIL) {
  for (const w of [360, 375, 390, 412, 480]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 760 }, isMobile: true, hasTouch: true, locale: 'hu-HU' });
    await ctx.route((u) => !u.toString().startsWith(CIM), (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
    await varj(p, '[data-tipus]'); await kattint(p, '[data-tipus="garancia"]');
    if (ok(`Q: ${w}px: az urlap megnyilik`, await varj(p, '#mp-mikor'))) {
      const m = await sr(p, 'const da=r.querySelector("#mp-mikor"), vc=r.querySelector("#mp-varos"), dr=da.getBoundingClientRect(), vr=vc.getBoundingClientRect(), mr=da.closest(".mezo").getBoundingClientRect(), ur=r.querySelector(".urlap").getBoundingClientRect(), nr=r.querySelector("#mp-nev").getBoundingClientRect(); const cs=getComputedStyle(da); return { egySorban: Math.abs(dr.top - vr.top) < 6, atfed: dr.right > vr.left + 0.5, oszlopon_belul: dr.left >= mr.left - 0.5 && dr.right <= mr.right + 0.5, urlapon_belul: vr.right <= ur.right + 0.5, doboz: cs.boxSizing, szeles: Math.round(dr.width), oszlop: Math.round(mr.width), dMagas: Math.round(dr.height), nMagas: Math.round(nr.height), sw: r.querySelector(".tartalom").scrollWidth, cw: r.querySelector(".tartalom").clientWidth };');
      ok(`Q: ${w}px: a datum- es a varos-mezo nem akad ossze, a datum a sajat oszlopan belul marad, border-box`, !m.atfed && m.oszlopon_belul && m.urlapon_belul && m.doboz === 'border-box' && m.sw <= m.cw + 1, JSON.stringify(m));
      ok(`Q: ${w}px: a datummezo nem magasabb a tobbi mezonel (legfeljebb 3 px)`, m.dMagas <= m.nMagas + 3, `${m.dMagas} / ${m.nMagas} px`);
    }
    await ctx.close();
  }
}

// R. a suti-sav az urlapon / a foglalo ablak mellett nem latszik (Feri kerese, 2026-10-14): a /kontroll (urlap) nem tesztoldal; a tesztoldalon (utogondozasi cikk) a sav
//    latszik, de amig a foglalo ablak nyitva van, rejtett, bezaras utan (dontes nelkul) ujra latszik
if (MERES_HOST) {
  const ctx = await b.newContext(OPT);
  await ctx.route((u) => !u.toString().startsWith(CIM), (r) => (SZABAD.test(r.request().url()) && r.request().method() === 'GET' ? r.continue() : r.abort()));
  const p = await ctx.newPage();
  const savLatszik = () => p.evaluate(() => { const e = document.getElementById('mp-cc'); if (!e) return false; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && r.height > 10; });
  await p.goto(CIM + '/kontroll', { waitUntil: 'load' });
  ok('R: /kontroll: az urlap megnyilik', await varj(p, '#mp-nev, [data-urlap], .urlap', 25000));
  await p.waitForTimeout(1500);
  ok('R: /kontroll (urlap): nincs suti-sav', !(await savLatszik()));
  await p.goto(CIM + '/shenmen-piercing-ezt-tedd-ha-begyulladt', { waitUntil: 'load' });
  let van = false; for (let i = 0; i < 30 && !van; i++) { van = await savLatszik(); if (!van) await p.waitForTimeout(250); }
  ok('R: a tesztoldalon (utogondozasi cikk) a suti-sav latszik', van);
  await linkKattint(p, 'a[href="/idopontfoglalas"]');
  ok('R: a foglalo megnyilik', await varj(p, '[data-tipus]', 20000));
  await p.waitForTimeout(400);
  ok('R: amig a foglalo ablak nyitva van, a suti-sav rejtett', !(await savLatszik()));
  await sr(p, 'r.querySelector("[data-bezar]").click()');
  await p.waitForTimeout(500);
  ok('R: a foglalo bezarasa utan (dontes nelkul) a suti-sav ujra latszik', await savLatszik());
  await ctx.close();
}

await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
