// EGY valodi probafoglalas az ELONEZETEN (Feri jovahagyasa, 2026-10-13): fizikai allapotfelmeres, nem csucsidoben (a naptar legtavolabbi napja), sajat teszt-vendegadatokkal;
// utana AZONNAL lemondas (tools/valodi-lemondas). A kimenet NEM tartalmaz szemelyes adatot es Salonic-azonositot.
//   VENDEG_EMAIL=... VENDEG_TEL="70 942 0090" node tools/valodi-probafoglalas-pw.mjs <elonezet-url>
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const ORIGIN = process.argv[2].replace(/\/$/, '');
const EMAIL = process.env.VENDEG_EMAIL, TEL = process.env.VENDEG_TEL;
assert.ok(EMAIL && TEL, 'VENDEG_EMAIL es VENDEG_TEL kell');
const curl = (url, q) => {
  const args = ['-s', '-i', '-A', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36', '--retry', '5', '--retry-all-errors', '-X', q.method(), url, ...Object.entries(q.headers()).filter(([k]) => ['content-type', 'cookie', 'origin'].includes(k)).flatMap(([k, v]) => ['-H', `${k}: ${v}`]), ...(q.postData() ? ['--data-binary', q.postData()] : [])];
  const nyers = execFileSync('curl', args, { maxBuffer: 20e6 }).toString('latin1');
  const feje = nyers.split(/\r?\n\r?\n/);
  let i = 0; while (i < feje.length - 1 && /^HTTP\/[\d.]+ (100|200 Connection)/.test(feje[i])) i++;
  const fejSor = feje[i].split(/\r?\n/);
  const hdr = {}; for (const sor of fejSor.slice(1)) { const k = sor.indexOf(':'); if (k > 0) { const n = sor.slice(0, k).toLowerCase(); hdr[n] = hdr[n] ? hdr[n] + '\n' + sor.slice(k + 1).trim() : sor.slice(k + 1).trim(); } }
  delete hdr['content-length']; delete hdr['content-encoding']; delete hdr['transfer-encoding'];
  return { status: +fejSor[0].split(' ')[1], headers: hdr, body: Buffer.from(feje.slice(i + 1).join('\r\n\r\n'), 'latin1') };
};
const b = await chromium.launch({ args: ['--disable-http2', '--disable-quic'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, ignoreHTTPSErrors: true }); // a sandbox proxy sajat CA-t hasznal
let koszonoKeret = 0;
await ctx.route('**/*', async (route) => {
  const q = route.request(); const u = new URL(q.url());
  if (u.origin === ORIGIN) return route.fulfill(curl(u.href, q));
  // a Salonic a keretet a MEGLEVO (elo) koszonooldalra iranyitja; az elonezeten ezt a lapot az elonezet koszonooldala helyettesiti (a launcherrel)
  if (u.hostname === 'www.gyogytornaszom.hu' && /^\/allapot-ok\/?$/.test(u.pathname)) {
    koszonoKeret++;
    const lap = curl(`${ORIGIN}/allapot-ok/`, q);
    const html = lap.body.toString('utf8').replace('src="/assets/js/launcher.js"', `src="${ORIGIN}/assets/js/launcher.js"`).replace('src="/assets/js/suti.js"', `src="${ORIGIN}/assets/js/suti.js"`);
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  }
  return route.continue();
});
let p, m, keret;
for (let kiserlet = 1; kiserlet <= 8; kiserlet++) { // a sandbox halozata a Chromiumbol megbizhatatlan: az ELOKESZITES (a veglegesites elott) ujraprobalhato
  try {
    if (p) await p.close().catch(() => {});
    p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 120)));
    await p.goto(`${ORIGIN}/booking-test/?motor=1`, { timeout: 60000 });
    await p.click('#gomb-allapot');
    m = p.locator('[data-gy-motor]');
    await m.locator('[data-csalad="allapotfelmeres"]').click({ timeout: 25000 });
    await m.locator('[data-valt="24666"]').click({ timeout: 15000 });
    await m.locator('[data-hely="8439"]').click({ timeout: 15000 });
    await m.locator('[data-szak=""]').click({ timeout: 25000 });
    await m.locator('.nap.van').first().waitFor({ timeout: 40000 });
    await p.waitForTimeout(6000); // a tobbi nap is betoltodjon
    for (let i = 0; i < 6; i++) { const kov = m.locator('.honap-fej [data-honap]').nth(1); if (!(await kov.getAttribute('data-honap'))) break; await kov.click(); }
    const napok = m.locator('.nap.van'); const db = await napok.count();
    await napok.nth(db - 1).click();
    const idok = m.locator('.ido'); const n = await idok.count();
    await idok.nth(Math.floor(n / 2)).click();
    await m.locator('iframe[name="gy-adatlap"]').waitFor({ timeout: 30000 });
    keret = p.frameLocator('[data-gy-motor] iframe[name="gy-adatlap"]');
    await keret.locator('#GuestDataForm_guestLastName').waitFor({ timeout: 40000 });
    break;
  } catch (e) { console.log(`elokeszites ${kiserlet}. kiserlet sikertelen: ${String(e.message).split('\n')[0].slice(0, 100)}`); if (kiserlet === 8) throw e; }
}
await keret.locator('#GuestDataForm_guestPhoneTemp').click();
await p.keyboard.press('End');
await p.keyboard.type(' ' + TEL, { delay: 40 });
await keret.locator('#GuestDataForm_guestLastName').pressSequentially('Teszt', { delay: 30 });
await keret.locator('#GuestDataForm_guestFirstName').pressSequentially('Claude', { delay: 30 });
await keret.locator('#GuestDataForm_guestEmail').pressSequentially(EMAIL, { delay: 20 });
await keret.locator('#GuestDataForm_acceptTerms').check();
await p.waitForTimeout(4000); // reCAPTCHA
const fr = p.frames().find((x) => x.name() === 'gy-adatlap');
console.log('urlap allapot:', JSON.stringify(await fr.evaluate(() => ({ dis: document.getElementById('button-submit-booking').disabled, tel: document.getElementById('GuestDataForm_guestPhoneTemp').value.replace(/\d/g, '#'), ln: document.getElementById('GuestDataForm_guestLastName').value.length, fn: document.getElementById('GuestDataForm_guestFirstName').value.length, em: document.getElementById('GuestDataForm_guestEmail').value.length, terms: document.getElementById('GuestDataForm_acceptTerms').checked, rc: typeof window.grecaptcha, w: innerWidth }))));
const gomb = keret.locator('#button-submit-booking');
await gomb.waitFor();
console.log('veglegesito gomb engedelyezve:', await gomb.isEnabled());
await gomb.click();
await p.waitForURL(`${ORIGIN}/allapot-ok/`, { timeout: 90000 });
console.log('a foglalas utan a fo ablak URL-je:', new URL(p.url()).pathname + new URL(p.url()).search);
await p.waitForFunction(() => (window.dataLayer || []).some((e) => e && e.event === 'foglalas_kesz'), null, { timeout: 30000 }).catch(() => {});
const esemenyek = await p.evaluate(() => window.dataLayer.filter((e) => e && e.event === 'foglalas_kesz'));
console.log('foglalas_kesz esemenyek szama:', esemenyek.length);
for (const e of esemenyek) console.log('mezok:', Object.keys(e).sort().join(','), '| tipus=', e.tipus, '| ertek tipusa=', typeof e.ertek, '| tranzakcio_id formatum 64 hex:', /^[0-9a-f]{64}$/.test(e.tranzakcio_id));
await p.reload(); await p.waitForTimeout(1500);
console.log('ujratoltes utan foglalas_kesz:', await p.evaluate(() => window.dataLayer.filter((e) => e && e.event === 'foglalas_kesz').length));
const p2 = await ctx.newPage();
await p2.goto(`${ORIGIN}/allapot-ok/`); await p2.waitForTimeout(1500);
console.log('kozvetlen megnyitas foglalas_kesz:', await p2.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event === 'foglalas_kesz').length));
console.log('koszono-keret kiszolgalasok:', koszonoKeret);
await b.close();
