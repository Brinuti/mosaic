// Bongeszos (Playwright) teszt: a teljes foglalasi folyamat a MOCKOLT Salonicon (rogzitett oldalak), valodi foglalas NELKUL.
// A tesztben a harmadik fel fele (GTM, GA, Meta...) semmi nem fut; a Salonic-hivasokat a bongeszo oldalon a page.route valaszolja.
//   node tools/build.mjs && node tools/test-gy-motor-pw.mjs [desktop|mobil]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { salonicHamis } from './salonic-hamis.mjs';
import { indit } from './serve.mjs';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const mod = process.argv[2] === 'mobil' ? 'mobil' : 'desktop';

const MOST = Math.floor(Date.now() / 1000);
const START = Math.floor((MOST + 6 * 86400) / 900) * 900 + 36000 % 900;
const EMP = '31525';
const KIEM_START = Math.floor((MOST + 86400) / 900) * 900 + 900; // "holnap" kb. ilyenkor
const bongeszoHamis = salonicHamis({ szabad: { [`8439:24666:${EMP}`]: [START, START + 900, START + 86400], '8439:24666:18783': [START + 1800, START + 86400], '418:416586:33185': [Math.floor(MOST / 900) * 900 + 7200, Math.floor(MOST / 900) * 900 + 23 * 3600, KIEM_START, KIEM_START + 1800] } });
const szerverHamis = salonicHamis({ szabad: {} }); // a szerver szerint a foglalt idopont mar nem szabad (a Salonic rogzitette)
const valos = globalThis.fetch;
globalThis.fetch = (u, i) => (String(u).includes('salonic.hu') ? szerverHamis(u, i) : valos(u, i));

// ELONEZET=<url>: a telepitett elonezeten fut (a szerver a VALODI Salonicot latja; a proba "g" azonositoja teszt-foglalas: token es esemeny NINCS - ez a vart eredmeny)
const ELONEZET = process.env.ELONEZET ? process.env.ELONEZET.replace(/\/$/, '') : null;
const srv = ELONEZET ? { port: 0, env: null, leall: async () => {} } : await indit({ env: { GY_HMAC_KULCS: 'pw-proba-kulcs-0123456789abcdef' } });
const ORIGIN = ELONEZET || `http://127.0.0.1:${srv.port}`;
const naplo = [];
const kulso = [];
const b = await chromium.launch({ args: ['--disable-http2', '--disable-quic', `--ip-address-space-overrides=127.0.0.1:${srv.port}=public`] }) // a mockolt https Salonic-keret es a helyi szerver kozott a Private Network Access ne blokkoljon;
const ctx = await b.newContext({ ...(mod === 'mobil' ? { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } }), ignoreHTTPSErrors: true });
await ctx.route('**/*', async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === 'cdn.salonic.hu') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64') });
  if (u.hostname.endsWith('salonic.hu')) {
    if (u.pathname.startsWith('/guestData') && process.env.ECHT_ADATLAP) { // kepkeszitéshez: a valodi Salonic-adatlap + a gy.css (curl-lel, a MOST szabad idoponttal)
      const { createSalonicAdapter } = await import('../public/assets/js/motor/salonic-adapter.js');
      const szabad = await createSalonicAdapter({ fetchImpl: valos }).getAvailability(8439, '24666', { days: 20 });
      const sl = szabad[Math.floor(szabad.length / 2)];
      const html = execFileSync('curl', ['-s', '-L', '-A', 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130 Safari/537.36', '--retry', '4', '--retry-all-errors', `https://gyogytornaszomhu.salonic.hu/guestData/?placeId=8439&serviceId=24666&employeeId=${sl.staff_id}&startDate=${sl.start_unix}&lang=hu`], { maxBuffer: 20e6 }).toString('utf8');
      const css = (await import('node:fs')).readFileSync(new URL('../public/salonic/gy.css', import.meta.url), 'utf8');
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html.replace('<head>', '<head><base href="https://gyogytornaszomhu.salonic.hu/"><style>' + css + '</style>') });
    }
    if (u.pathname.startsWith('/guestData')) {
      const bu = `https://gyogytornaszomhu.salonic.hu/guestData/?anyone=true&employeeId=${EMP}&placeId=8439&serviceId=24666&startDate=${START}&back=${u.searchParams.get('back')}`;
      const cel = `${ORIGIN}/allapot-ok/?first_booking=true&service=X&price=23500&location=L&employee=E&g=${encodeURIComponent('g:pw-proba')}&bookingUrl=${encodeURIComponent(bu)}`;
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><button id="foglal">Foglalas veglegesitese</button><script>document.getElementById('foglal').addEventListener('click',function(){location.href=${JSON.stringify(cel)}})</script>` });
    }
    const r = await bongeszoHamis(u.href);
    return route.fulfill({ status: r.status, contentType: r.headers.get('content-type') || 'text/html', body: await r.text(), headers: { 'access-control-allow-origin': '*' } });
  }
  if (u.origin === ORIGIN && ELONEZET) { // a sandbox-proxy a Chromiumbol megbizhatatlan: az elonezet kereseit curl-lel (ujraprobalkozassal) vegezzuk
    const q = route.request();
    const args = ['-s', '-i', '--retry', '4', '--retry-all-errors', '-X', q.method(), u.href, ...Object.entries(q.headers()).filter(([k]) => ['content-type', 'cookie', 'origin'].includes(k)).flatMap(([k, v]) => ['-H', `${k}: ${v}`]), ...(q.postData() ? ['--data-binary', q.postData()] : [])];
    const nyers = execFileSync('curl', args, { maxBuffer: 20e6 }).toString('latin1');
    const feje = nyers.split(/\r?\n\r?\n/); // tobb fejlec-blokk lehet (Connection Established / 100): az utolso HTTP blokk kell
    let i = 0; while (i < feje.length - 1 && /^HTTP\/[\d.]+ (100|200 Connection)/.test(feje[i])) i++;
    const fejSor = feje[i].split(/\r?\n/);
    const status = +fejSor[0].split(' ')[1];
    const hdr = {}; for (const sor of fejSor.slice(1)) { const k = sor.indexOf(':'); if (k > 0) { const n = sor.slice(0, k).toLowerCase(); hdr[n] = hdr[n] ? hdr[n] + '\n' + sor.slice(k + 1).trim() : sor.slice(k + 1).trim(); } }
    delete hdr['content-length']; delete hdr['content-encoding']; delete hdr['transfer-encoding'];
    return route.fulfill({ status, headers: hdr, body: Buffer.from(feje.slice(i + 1).join('\r\n\r\n'), 'latin1') });
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

// 1/b) kiemelt szakember (Nora, Batthyany ter, akcios allapotfelmeres): doboz a helyszin-lepesen + kiemelt kartya a szakember-lepesen
await oldal.goto(`${ORIGIN}/booking-test/?motor=1`);
await oldal.click('#gomb-allapot');
{
  const mk = oldal.locator('[data-gy-motor]');
  await mk.locator('[data-csalad="allapotfelmeres"]').click();
  await mk.locator('[data-valt="416586"]').click();
  await mk.locator('.kiemelt-doboz').waitFor();
  const doboz = await mk.locator('.kiemelt-doboz').innerText();
  assert.match(doboz, /Németh Nóra/); assert.match(doboz, /Ajánlott/); assert.match(doboz, /Rugalmasan elérhető időpontok/); assert.match(doboz, /Batthyány tér/);
  if (process.env.KEPEK) await oldal.screenshot({ path: `${process.env.KEPEK}/kiemelt-hely-${mod}.png` });
  await mk.locator('.kiemelt-doboz [data-kiem-ido]').filter({ hasText: /holnap|ma|október|november|december/ }).waitFor();
  const kiemSzoveg = await mk.locator('.kiemelt-doboz [data-kiem-ido]').innerText();
  assert.match(kiemSzoveg, /^Legkorábbi időpont: (holnap|ma) \d\d:\d\d$/);
  // Salonic: legkorabbi kiajanlott idopont most+24 ora; az API a 24 oran beluli (ma) idopontokat is adja, ezeket a motor nem mutathatja (Nora "ma 12:30" hiba)
  const kiemOra = kiemSzoveg.match(/(\d\d):(\d\d)$/);
  const varhato = new Date((KIEM_START) * 1000).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' });
  assert.equal(`${kiemOra[1]}:${kiemOra[2]}`, varhato, 'a kiemelt doboz a 24 oran beluli idopontokat kihagyja');
  await mk.locator('[data-hely="418"]').click();
  await mk.locator('.kartya.szak.kiemelt').waitFor();
  if (process.env.KEPEK) await oldal.screenshot({ path: `${process.env.KEPEK}/kiemelt-szakember-${mod}.png` });
  assert.equal(await mk.locator('.szak-racs .kartya.szak').nth(1).getAttribute('class').then((c) => /kiemelt/.test(c)), true); // a "Mindegy" utan az elso
  await mk.locator('.kartya.szak.kiemelt').click(); // a kiemelt szakember naptara
  await mk.locator('.nap.van').first().waitFor();
  await oldal.keyboard.press('Escape');
  // a rendelo-lepesen a doboz kozvetlenul a naptarra visz
  await oldal.click('#gomb-allapot');
  await mk.locator('[data-csalad="allapotfelmeres"]').click();
  await mk.locator('[data-valt="416586"]').click();
  await mk.locator('.kiemelt-doboz').click();
  await mk.locator('.nap.van').first().waitFor();
  await oldal.keyboard.press('Escape');
  // a nem akcios allapotfelmeresnel nincs kiemeles
  await oldal.click('#gomb-allapot');
  await mk.locator('[data-csalad="allapotfelmeres"]').click();
  await mk.locator('[data-valt="24666"]').click();
  await mk.locator('[data-hely="418"]').waitFor();
  assert.equal(await mk.locator('.kiemelt-doboz').count(), 0);
  await oldal.keyboard.press('Escape');
}
lep('kiemelt szakember: doboz a helyszin-lepesen (+ gyors utvonal a naptarra), narancs kartya a szakember-lepesen, a sima allapotfelmeresnel nincs kiemeles');

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
if (process.env.KEPEK) { await oldal.screenshot({ path: `${process.env.KEPEK}/valtozat-${mod}.png` }); }
const valtozatok = await m.locator('[data-valt]').count();
assert.ok(valtozatok >= 1);
await m.locator('[data-valt="24666"]').click();
await m.locator('[data-hely="8439"]').click();
await m.locator('[data-szak=""]').click();
if (process.env.KEPEK) { await oldal.screenshot({ path: `${process.env.KEPEK}/naptar-${mod}.png` }); }
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
if (process.env.KEPEK) { await oldal.waitForTimeout(process.env.ECHT_ADATLAP ? 5000 : 0); await oldal.screenshot({ path: `${process.env.KEPEK}/adatlap-${mod}.png` }); if (process.env.ECHT_ADATLAP) { const f = oldal.frames().find((x) => x.name() === 'gy-adatlap'); console.log('KERET', f && f.url(), f && await f.evaluate(() => ({ h: document.documentElement.scrollHeight, w: innerWidth, vis: getComputedStyle(document.body).display + '/' + getComputedStyle(document.body).visibility + '/' + getComputedStyle(document.body).opacity, txt: document.body.innerText.slice(0, 80), rs: document.readyState, len: document.body.innerHTML.length, form: !!document.querySelector('form'), kids: [...document.body.children].map((e) => e.tagName + '.' + (e.className || '').toString().slice(0, 30) + ':' + e.getBoundingClientRect().height).slice(0, 8) })).catch((e) => e.message)); process.exit(0); } }
// a Salonic "sikeres foglalas": az iframe a koszonooldalra navigal -> a launcher uzen -> a motor POST + atiranyit
const keret = oldal.frameLocator('[data-gy-motor] iframe[name="gy-adatlap"]');
await keret.locator('#foglal').click();
await oldal.waitForURL(`${ORIGIN}/allapot-ok/`, { timeout: 30000 });
lep('a foglalas utan a parameter-mentes /allapot-ok/ oldal (az URL-ben nincs semmilyen adat)');
if (ELONEZET) {
  await oldal.waitForTimeout(1500);
  assert.equal(await oldal.evaluate(() => (window.dataLayer || []).filter((e) => e.event === 'foglalas_kesz').length), 0);
  lep('elonezet: a teszt-foglalas (g:pw-proba) rekordja teszt=1, NINCS token es NINCS esemeny');
  assert.deepEqual(kulso, [], 'kulso kerelem: ' + kulso.join(','));
  await b.close(); console.log(`PW elonezet ${mod}: ${siker} lepes rendben`); process.exit(0);
}
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
assert.equal(await p2.evaluate(() => (window.dataLayer || []).filter((e) => !(e && (/^gy_suti_/.test(e.event || '') || e[0] === 'consent'))).length), 0); // csak a sutisav allapot-esemenye es a consent update (SAV_KI) lehet
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
// koztes foglalo oldal (/online-gyogytorna/ mintaja: /booking-auto/): a cimere erkezve a motor magatol megnyilik, a mogotte levo tartalom rejtett, bezarva elokerul; a ra mutato gombok is a motort nyitjak
await oldal.goto(`${ORIGIN}/booking-auto/?motor=1`);
await oldal.locator('[data-gy-motor] .ablak').waitFor();
assert.equal(await oldal.evaluate(() => getComputedStyle(document.getElementById('koztes-tartalom')).visibility), 'hidden', 'a tartalom a motor mogott rejtett');
assert.equal(await oldal.evaluate(() => location.pathname + location.search), '/booking-auto/?motor=1'); // az URL nem valtozik
await oldal.keyboard.press('Escape');
assert.equal(await oldal.locator('[data-gy-motor]').count(), 0);
assert.equal(await oldal.evaluate(() => getComputedStyle(document.getElementById('koztes-tartalom')).visibility), 'visible', 'bezarva a tartalom elokerul');
assert.equal(await oldal.evaluate(() => document.documentElement.classList.contains('gy-fh')), false);
await oldal.goto(`${ORIGIN}/booking-auto/?motor=0`); // kikapcsolt motor: az oldal marad, a tartalom lathato
await oldal.waitForTimeout(600);
assert.equal(await oldal.locator('[data-gy-motor]').count(), 0);
assert.equal(await oldal.evaluate(() => getComputedStyle(document.getElementById('koztes-tartalom')).visibility), 'visible');
await oldal.goto(`${ORIGIN}/booking-test/?motor=1`);
await oldal.click('#gomb-koztes'); // a koztes oldalra mutato gomb a motort nyitja (nincs lapbetoltes)
await oldal.locator('[data-gy-motor] .ablak').waitFor();
assert.equal(await oldal.evaluate(() => location.pathname), '/booking-test/');
await oldal.keyboard.press('Escape');
await oldal.click('#gomb-horgony'); // a #horgony-link nem nyitja a motort
await oldal.waitForTimeout(500);
assert.equal(await oldal.locator('[data-gy-motor]').count(), 0);
assert.equal(await oldal.evaluate(() => location.hash), '#telefonos');
lep('koztes foglalo oldal: a cimen a motor magatol megnyilik (tartalom rejtve, bezarva elokerul, ?motor=0: marad az oldal); a ra mutato gomb a motort nyitja, a #horgony nem');
// szakember-link (/employees/<id>/): a helyszin elore kitoltve, csak az o szolgaltatasai; az allapotfelmeres -> egybol a naptar
await oldal.goto(`${ORIGIN}/booking-test/?motor=1`);
await oldal.click('#gomb-szakember');
{
  const mk = oldal.locator('[data-gy-motor]');
  await mk.locator('[data-csalad="allapotfelmeres"]').click();
  await mk.locator('[data-valt="24666"], .nap.van').first().waitFor({ timeout: 15000 });
  if (await mk.locator('[data-valt="24666"]').count()) await mk.locator('[data-valt="24666"]').click(); // csak a szakember szolgaltatasai latszanak
  await mk.locator('.nap.van').first().waitFor({ timeout: 15000 }).catch(async (e) => { console.log('DEBUG lepes:', await mk.locator('.lepesek .most').innerText().catch(() => '?'), '|', (await mk.locator('.tartalom').innerText()).replace(/\s+/g, ' ').slice(0, 300)); throw e; });
  assert.match(await mk.locator('.osszegzes').innerText(), /Oktogon/);
  await oldal.keyboard.press('Escape');
}
lep('szakember-link: a helyszin elore kitoltve, az allapotfelmeres egybol a szakember naptarara visz');
// A Salonic az ELSO /guestData/ betoltesnel 10 percre lefoglalja az idopontot, a MASODIK betoltes a Salonic sajat naptarara iranyit (a keretben a Salonic-naptar jelent meg).
// Ezert visszalepeskor a betoltott adatlap marad (rejtve), ugyanarra az idopontra nincs masodik betoltes; dupla koppintas sem tolt ketszer.
await oldal.goto(`${ORIGIN}/booking-test/?motor=1`);
{
  let guestKeres = 0;
  const szamlalo = (r) => { if (/\/guestData/.test(r.url())) guestKeres++; };
  oldal.on('request', szamlalo);
  await oldal.click('#gomb-salonic');
  const mk = oldal.locator('[data-gy-motor]');
  await mk.locator('[data-csalad="allapotfelmeres"]').click();
  await mk.locator('[data-valt="24666"]').click();
  await mk.locator('[data-szak=""]').click().catch(() => {});
  await mk.locator('.nap.van').first().waitFor();
  const elso = mk.locator('.ido').first();
  const slot = await elso.getAttribute('data-slot');
  await elso.dblclick(); // dupla koppintas
  await mk.locator('iframe.adatlap.aktiv').waitFor();
  await oldal.waitForTimeout(600);
  assert.equal(await mk.locator('iframe.adatlap').count(), 1, 'dupla koppintasra is csak egy adatlap');
  await mk.locator('iframe.adatlap').evaluate((el) => { el.dataset.proba = 'ugyanaz'; });
  const elsoKeres = guestKeres;
  assert.equal(elsoKeres, 1, 'egyetlen /guestData/ betoltes');
  // vissza az idopont-valasztora ("Masik idopont"), majd UGYANAZ az idopont: nincs uj betoltes, ugyanaz a keret
  await mk.locator('.adatlap-sav .masik').click();
  await mk.locator('.nap.van').first().waitFor();
  assert.equal(await mk.locator('iframe.adatlap').first().isVisible(), false, 'az idopont-valasztonal a keret rejtett');
  await mk.locator(`.ido[data-slot="${slot}"]`).click();
  await mk.locator('iframe.adatlap.aktiv').waitFor();
  assert.equal(await mk.locator('iframe.adatlap').count(), 1);
  assert.equal(await mk.locator('iframe.adatlap').getAttribute('data-proba'), 'ugyanaz', 'ugyanaz a keret, nem toltodott ujra');
  assert.equal(guestKeres, elsoKeres, 'nincs masodik /guestData/ betoltes ugyanarra az idopontra');
  // masik idopont: uj keret (a regi rejtve marad); vissza az elsore: megint a regi keret
  await mk.locator('.adatlap-sav .masik').click();
  await mk.locator('.nap.van').first().waitFor();
  const masik = mk.locator('.ido').nth(1);
  const slot2 = await masik.getAttribute('data-slot');
  assert.notEqual(slot2, slot);
  await masik.click();
  await mk.locator('iframe.adatlap.aktiv').waitFor();
  assert.equal(await mk.locator('iframe.adatlap').count(), 2);
  await mk.locator('.adatlap-sav .masik').click();
  await mk.locator('.nap.van').first().waitFor();
  await mk.locator(`.ido[data-slot="${slot}"]`).click();
  await mk.locator('iframe.adatlap.aktiv').waitFor();
  assert.equal(await mk.locator('iframe.adatlap.aktiv').getAttribute('data-proba'), 'ugyanaz');
  assert.equal(guestKeres, 2, 'ket kulonbozo idopont = ket betoltes, a visszavalasztas nem tolt ujra');
  oldal.off('request', szamlalo);
  await oldal.keyboard.press('Escape');
}
lep('adatlap-keret megtartasa: visszalepeskor es ugyanarra az idopontra nincs masodik /guestData/ betoltes (Salonic 10 perces foglalasa), dupla koppintas sem tolt ketszer');
// visszahivas-kerelem: "Telefonon egyeztetek idopontot" az elso lepes aljan; az urlap mezoi az elo "Telefonos Idopont" urlapbol
// (kapcsolo: motor-kapcsolo.json "hivas"; alapbol 0, a proba ?hivas=1-gyel kapcsolja be)
await oldal.goto(`${ORIGIN}/booking-test/?motor=1&hivas=0`);
await oldal.click('#gomb-salonic');
assert.equal(await oldal.locator('[data-gy-motor] [data-hivas]').count(), 0, 'kapcsolo nelkul nincs visszahivas-gomb');
await oldal.keyboard.press('Escape');
await oldal.goto(`${ORIGIN}/booking-test/?motor=1&hivas=1`);
await oldal.click('#gomb-salonic');
{
  const mk = oldal.locator('[data-gy-motor]');
  await mk.locator('[data-hivas]').waitFor();
  assert.match(await mk.locator('[data-hivas]').innerText(), /Telefonon egyeztetek időpontot/);
  if (process.env.KEPEK) await oldal.screenshot({ path: `${process.env.KEPEK}/hivas-gomb-${mod}.png` });
  await mk.locator('[data-hivas]').click();
  await mk.locator('form.hivas-urlap').waitFor();
  assert.equal(await mk.locator('.fej h2').innerText(), 'Telefonos időpontfoglalás');
  // az elo urlap mezoi, szo szerint
  assert.deepEqual(await mk.locator('form.hivas-urlap .cimke-sz').allInnerTexts(), ['Név *', 'E-mail cím *', 'Telefonszám (FONTOS "036" kezdettel írja be!) *', 'Mikor szeretne időpontot? *', 'Mikor hívhatjuk? *', 'Melyik rendelőnkbe jönne? *', 'Panasza rövid leírása', 'Elfogadom az alábbiakat: *']);
  assert.deepEqual(await mk.locator('select[name="surgosseg"] option').allInnerTexts(), ['A lehető leggyorsabban!', '1-2 héten belül!', '1 hónapon belül.']);
  assert.deepEqual(await mk.locator('select[name="hivhato"] option').allInnerTexts(), ['Bármikor', 'Inkább reggel / de', 'Délután']);
  assert.deepEqual(await mk.locator('select[name="rendelo"] option').allInnerTexts(), ['Oktogon', 'Nyugati', 'Batthyány']);
  assert.deepEqual(await mk.locator('.elfogad span').allInnerTexts(), ['Ez nem egy általános információ kérő űrlap, hanem időpontegyeztetés.', 'A Gyógytornászom.hu Adatvédelmi Szabályzatát.']);
  assert.equal(await mk.locator('[data-kuld]').innerText(), 'Elküldöm az időpontfoglalást!');
  // vissza az elso lepesre, majd ujra: az adatok megmaradnak
  await mk.locator('input[name="nev"]').fill('Próba Teszt');
  await mk.locator('[data-vissza]').click();
  await mk.locator('[data-hivas]').waitFor();
  await mk.locator('[data-hivas]').click();
  assert.equal(await mk.locator('input[name="nev"]').inputValue(), 'Próba Teszt');
  // ures / hibas kuldes: hibauzenetek, nincs keres
  await mk.locator('input[name="nev"]').fill('');
  await mk.locator('[data-kuld]').click();
  assert.match(await mk.locator('[data-mezo="nev"] .hiba-uzenet').innerText(), /nevét/);
  assert.match(await mk.locator('[data-mezo="email"] .hiba-uzenet').innerText(), /e-mail/);
  assert.match(await mk.locator('[data-mezo="tel"] .hiba-uzenet').innerText(), /telefonszám/);
  assert.match(await mk.locator('[data-mezo="elfogad"] .hiba-uzenet').innerText(), /fogadnia/);
  if (process.env.KEPEK) await oldal.screenshot({ path: `${process.env.KEPEK}/hivas-hiba-${mod}.png` });
  await mk.locator('input[name="nev"]').fill('Próba Teszt');
  await mk.locator('input[name="email"]').fill('proba@example.com');
  await mk.locator('input[name="tel"]').fill('036 30 555 0199');
  await mk.locator('select[name="surgosseg"]').selectOption('1-2 héten belül!');
  await mk.locator('select[name="hivhato"]').selectOption('Délután');
  await mk.locator('select[name="rendelo"]').selectOption('Nyugati');
  await mk.locator('textarea[name="panasz"]').fill('TESZT panasz: derékfájás');
  await mk.locator('input[name="elfogad_info"]').check();
  await mk.locator('input[name="elfogad_adatv"]').check();
  if (process.env.KEPEK) await oldal.screenshot({ path: `${process.env.KEPEK}/hivas-urlap-${mod}.png` });
  await mk.locator('[data-kuld]').click();
  // a koszonooldal: /visszahivas-ok/ (URL-parameter nelkul; a panasz / szemelyes adat nem kerul az URL-be)
  await oldal.waitForURL(`${ORIGIN}/visszahivas-ok/`, { timeout: 15000 });
  const sor = await srv.env.GY_DB.prepare('SELECT nev, email, tel, rendelo, surgosseg, hivhato, oldal FROM gy_visszahivas').first();
  assert.deepEqual({ ...sor }, { nev: 'Próba Teszt', email: 'proba@example.com', tel: '036 30 555 0199', rendelo: 'Nyugati', surgosseg: '1-2 héten belül!', hivhato: 'Délután', oldal: '/booking-test/' });
  assert.equal(JSON.stringify(await srv.env.GY_DB.prepare('SELECT * FROM gy_visszahivas').all()).includes('derékfájás'), false); // a panasz nincs a D1-ben
  assert.equal(oldal.url().includes('?'), false);
}
lep('visszahivas-kerelem: az elo urlap mezoi szo szerint, hibauzenetek, kuldes -> D1-sor (panasz nelkul), atiranyitas a parameter-mentes /visszahivas-ok/ oldalra');
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
