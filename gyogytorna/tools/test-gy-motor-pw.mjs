// Bongeszos (Playwright) teszt: a teljes foglalasi folyamat a MOCKOLT Salonicon (rogzitett oldalak), valodi foglalas NELKUL.
// A tesztben a harmadik fel fele (GTM, GA, Meta...) semmi nem fut; a Salonic-hivasokat a bongeszo oldalon a page.route valaszolja.
//   node tools/build.mjs && node tools/test-gy-motor-pw.mjs [desktop|mobil]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { salonicHamis } from './salonic-hamis.mjs';
import { indit } from './serve.mjs';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const mod = process.argv[2] === 'mobil' ? 'mobil' : 'desktop';

const MOST = Math.floor(Date.now() / 1000);
const START = Math.floor((MOST + 6 * 86400) / 900) * 900 + 36000 % 900;
const EMP = '31525';
const bongeszoHamis = salonicHamis({ szabad: { [`8439:24666:${EMP}`]: [START, START + 900, START + 86400] } });
const szerverHamis = salonicHamis({ szabad: {} }); // a szerver szerint a foglalt idopont mar nem szabad (a Salonic rogzitette)
const valos = globalThis.fetch;
globalThis.fetch = (u, i) => (String(u).includes('salonic.hu') ? szerverHamis(u, i) : valos(u, i));

const srv = await indit({ env: { GY_HMAC_KULCS: 'pw-proba-kulcs-0123456789abcdef' } });
const ORIGIN = `http://127.0.0.1:${srv.port}`;
const naplo = [];
const kulso = [];
const b = await chromium.launch({ args: [`--ip-address-space-overrides=127.0.0.1:${srv.port}=public`] }) // a mockolt https Salonic-keret es a helyi szerver kozott a Private Network Access ne blokkoljon;
const ctx = await b.newContext({ ...(mod === 'mobil' ? { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } }), ignoreHTTPSErrors: true });
await ctx.route('**/*', async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === 'cdn.salonic.hu') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
  if (u.hostname.endsWith('salonic.hu')) {
    if (u.pathname.startsWith('/guestData')) {
      const bu = `https://gyogytornaszomhu.salonic.hu/guestData/?anyone=true&employeeId=${EMP}&placeId=8439&serviceId=24666&startDate=${START}&back=${u.searchParams.get('back')}`;
      const cel = `${ORIGIN}/allapot-ok/?first_booking=true&service=X&price=23500&location=L&employee=E&g=${encodeURIComponent('g:pw-proba')}&bookingUrl=${encodeURIComponent(bu)}`;
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><button id="foglal">Foglalas veglegesitese</button><script>document.getElementById('foglal').addEventListener('click',function(){location.href=${JSON.stringify(cel)}})</script>` });
    }
    const r = await bongeszoHamis(u.href);
    return route.fulfill({ status: r.status, contentType: r.headers.get('content-type') || 'text/html', body: await r.text(), headers: { 'access-control-allow-origin': '*' } });
  }
  if (u.origin === ORIGIN) return route.continue();
  kulso.push(u.hostname);
  return route.abort();
});
const oldal = await ctx.newPage();
oldal.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') naplo.push(m.text()); });
oldal.on('pageerror', (e) => naplo.push('pageerror: ' + e.message));
let siker = 0;
const lep = (nev) => { siker++; console.log(`  ok ${siker}. ${nev}`); };

// 1) kapcsolo 0%: a link a Salonic eredeti utjat adja (nincs motor)
await oldal.goto(`${ORIGIN}/booking-test/`);
assert.equal(await oldal.locator('[data-gy-motor]').count(), 0);
lep('a kapcsolo 0%: a motor nem nyilik, a link marad a Salonicon');

// 2) ?motor=1: a motor nyilik; vegig a folyamat
await oldal.goto(`${ORIGIN}/booking-test/?motor=1`);
await oldal.click('#gomb-allapot');
const m = oldal.locator('[data-gy-motor]');
await m.locator('.ablak').waitFor();
assert.equal(await oldal.evaluate(() => document.documentElement.style.overflow), 'hidden');
assert.equal(await oldal.evaluate(() => location.pathname + location.search), '/booking-test/?motor=1'); // az URL nem valtozik
lep('a motor megnyilik, az URL nem valtozik, a hatter gorgetese zarolt');
await m.locator('[data-csalad="allapotfelmeres"]').click();
await m.locator('[data-valt]').first().waitFor();
const valtozatok = await m.locator('[data-valt]').count();
assert.ok(valtozatok >= 1);
await m.locator('[data-valt="24666"]').click();
await m.locator('[data-hely="8439"]').click();
await m.locator('[data-szak=""]').click();
await m.locator('.nap.van').first().waitFor();
lep(`szolgaltatas -> valtozat(${valtozatok}) -> helyszin -> szakember -> naptar`);
// fokuszcsapda / Esc / vissza
await oldal.keyboard.press('Tab');
assert.equal(await oldal.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-gy-motor')), true);
await m.locator('[data-vissza]').click();
await m.locator('[data-szak=""]').waitFor();
await m.locator('[data-szak=""]').click();
await m.locator('.nap.van').first().waitFor();
lep('vissza gomb + fokuszcsapda a retegen belul marad');
await m.locator('.ido').first().click();
await m.locator('iframe[name="gy-adatlap"]').waitFor();
lep('az idopont utan a Salonic adatlapja beagyazva');
// a Salonic "sikeres foglalas": az iframe a koszonooldalra navigal -> a launcher uzen -> a motor POST + atiranyit
const keret = oldal.frameLocator('[data-gy-motor] iframe[name="gy-adatlap"]');
await keret.locator('#foglal').click();
await oldal.waitForURL(`${ORIGIN}/allapot-ok/`, { timeout: 15000 });
lep('a foglalas utan a parameter-mentes /allapot-ok/ oldal (az URL-ben nincs semmilyen adat)');
await oldal.waitForFunction(() => (window.dataLayer || []).some((e) => e.event === 'foglalas_kesz'), null, { timeout: 15000 });
const esemeny = await oldal.evaluate(() => window.dataLayer.filter((e) => e.event === 'foglalas_kesz'));
assert.equal(esemeny.length, 1);
assert.equal(esemeny[0].tipus, 'allapotfelmeres');
assert.equal(esemeny[0].ertek, 23500);
assert.match(esemeny[0].tranzakcio_id, /^[0-9a-f]{64}$/);
assert.deepEqual(Object.keys(esemeny[0]).sort(), ['ertek', 'event', 'tipus', 'tranzakcio_id']);
lep('foglalas_kesz: pontosan egy esemeny, csak tipus + ertek + tranzakcio_id');
// ujratoltes: nincs masodik esemeny (token egyszeri)
await oldal.reload();
await oldal.waitForTimeout(700);
assert.equal(await oldal.evaluate(() => (window.dataLayer || []).filter((e) => e.event === 'foglalas_kesz').length), 0);
lep('ujratoltes / token ujrafelhasznalas: nincs masodik esemeny');
// kozvetlen megnyitas token nelkul
const p2 = await ctx.newPage();
await p2.goto(`${ORIGIN}/allapot-ok/?price=1&bookingUrl=x`);
await p2.waitForTimeout(500);
assert.equal(await p2.evaluate(() => (window.dataLayer || []).length), 0);
assert.equal(await p2.evaluate(() => location.search), '');
lep('token nelkul megnyitott koszonooldal: nincs esemeny, a parameterek levalnak a cimsorrol');
// bezaras / Esc
await oldal.goto(`${ORIGIN}/booking-test/?motor=1`);
await oldal.click('#gomb-salonic');
await oldal.locator('[data-gy-motor] .ablak').waitFor();
await oldal.keyboard.press('Escape');
assert.equal(await oldal.locator('[data-gy-motor]').count(), 0);
assert.equal(await oldal.evaluate(() => document.documentElement.style.overflow), '');
lep('Esc bezarja; a gorgetes-zar es az inert visszaall');
// forras-ping elment
const forrasDb = (await srv.env.GY_DB.prepare('SELECT COUNT(*) AS n FROM gy_munkamenet').first()).n;
assert.ok(forrasDb >= 1);
lep('a forras-megtartas lefutott (munkamenet-rekord)');
// harmadik felek: a teszt alatt nem ment ki semmi
assert.deepEqual(kulso, [], 'kulso kerelem: ' + kulso.join(','));
lep('0 kimeno kulso (meres) kerelem a teszt alatt');
const hibak = naplo.filter((x) => !/Failed to load resource/.test(x));
assert.deepEqual(hibak, [], 'konzolhiba: ' + hibak.join(' | '));
lep('nincs konzolhiba');
await b.close(); await srv.leall();
console.log(`PW ${mod}: ${siker} lepes rendben`);
process.exit(0);
