// Valodi probafoglalas a foglalomotorral (QA-2). A mero-kereseket eldobja es naplozza; a sajat /api/mp-foglalas jelzest
// elkapja es naplozza (nem kerul a D1-be). A Salonic felé csak a beagyazott adatlap megy (betoltes + bekuldes).
//   PROBA_EMAIL=<olvashato cim> PROBA_TELEFON=<Feri tesztszama> BASE=https://www.medicalpiercing.hu node tools/motor-proba/probafoglalas.mjs --nev=1 --hely=6029 --szolg=115575 --honnan=/migren-piercing [--mobil] [--kuld]
// --parameter-nelkul: ?motor=1 nelkul nyitja az oldalt (100%-os kapcsolo mellett ez a valodi latogato utja).
// --kuld nelkul csak kitolti (nem kuldi be). Utana AZONNAL: node tools/motor-proba/lemond.mjs <lemondoUrl> (a kimenetben). Egyben: proba-futtat.sh.
// Vendegnev: "TESZT –" "Claude"; az idopont a legtavolabbi nap legkesobbi idopontja.
import { chromium, devices } from '../pw.mjs';
import fs from 'node:fs';
const S = process.env.KI || new URL('./kimenet', import.meta.url).pathname; fs.mkdirSync(S, { recursive: true });
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const BASE = (process.env.BASE || 'https://www.medicalpiercing.hu').replace(/\/$/, '');
const MOBIL = process.argv.includes('--mobil'), KULD = process.argv.includes('--kuld');
// --parameter-nelkul: a ?motor=1 NEM kerul az URL-be (a kapcsolo 100%-on van: igy kapja egy valodi latogato)
const PARAMETER_NELKUL = process.argv.includes('--parameter-nelkul');
const NEV = arg('nev', 'x'), HELY = arg('hely', '6029'), SZOLG = arg('szolg', '115575'), HONNAN = arg('honnan', '/a-migren-piercing-gyogyulasi-ideje');
const GCLID = 'TESZTCLAUDE' + Date.now();
// a visszaigazolo level ide jon (a lemondo link miatt olvasni kell tudni); telefon: alapbol az MP szalon szama
// NINCS alapertelmezett telefonszam: a szalon szama egy meglevo Salonic-vendegprofilra (nem teszt) illeszkedett, ezert a probak
// KIZAROLAG Feri sajat tesztszamaval mennek (a szam a Drive MP-FOGLALOMOTOR-FELADAT.md-ben van, a repoba nem kerul).
// PROBA_TELEFON = nemzeti szam a 06/orszagkod nelkul (pl. "701234567"), a mezo magyar orszagkodos.
const EMAIL = process.env.PROBA_EMAIL, TELEFON = process.env.PROBA_TELEFON;
if (KULD && (!EMAIL || !TELEFON)) throw new Error('PROBA_EMAIL (olvashato cim) es PROBA_TELEFON (Feri tesztszama) kell');
const SZABAD = /^https:\/\/([a-z0-9]+\.salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha)\//;
const naplo = { nev: NEV, nezet: MOBIL ? 'mobil' : 'asztali', hely: HELY, szolg: SZOLG, honnan: HONNAN, gclid: GCLID, kezdes: new Date().toISOString(), eldobott: [], api: [], hibak: [] };
const b = await chromium.launch();
const ctx = await b.newContext(MOBIL ? { ...devices['Pixel 5'], locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' });
await ctx.route(/\/api\/mp-foglalas$/, (r) => { let k = false; try { const f = r.request().frame(); k = f !== f.page().mainFrame(); } catch (e) { k = true; } naplo.api.push({ keret: k, torzs: r.request().postData() }); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
await ctx.route((u) => !u.toString().startsWith(BASE), (r) => {
  const q = r.request(), u = q.url();
  if (SZABAD.test(u) || /^https:\/\/medicalpiercing\.hu\/(foglalas-ok|fulbevalo-ok)/.test(u)) return r.continue();
  naplo.eldobott.push(u.slice(0, 160)); return r.abort();
});
const p = await ctx.newPage();
p.on('pageerror', (e) => naplo.hibak.push(e.message.slice(0, 160)));
const sr = (fn, a) => p.evaluate(([fn, a]) => { const h = document.querySelector('[data-mp-motor]'); return h ? new Function('r', 'a', fn)(h.shadowRoot, a) : null; }, [fn, a]);
const varj = async (sel, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await sr('return !!r.querySelector(a)', sel)) return true; await p.waitForTimeout(250); } throw new Error('nincs: ' + sel); };
await p.goto(`${BASE}${HONNAN}?${PARAMETER_NELKUL ? '' : 'motor=1&'}gclid=${GCLID}`, { waitUntil: 'load' });
if (HONNAN !== '/a-migren-piercing-gyogyulasi-ideje') await p.goto(`${BASE}/a-migren-piercing-gyogyulasi-ideje`, { waitUntil: 'load' });
await p.waitForTimeout(1500);
await p.evaluate(() => { const l = [...document.querySelectorAll('a[href*="medicalpiercing.salonic.hu/selectLocation"]')]; const a = l.find((x) => x.offsetParent) || l[0]; a.scrollIntoView({ block: 'center' }); a.click(); });
for (let i = 0; i < 100; i++) { if (await sr('return !!r.querySelector("[data-hely]")')) break; if (await sr('const t=r.querySelector(\'[data-tipus="uj"]\'); if (t) { t.click(); return true; } return false')) break; await p.waitForTimeout(250); }
await varj('[data-hely]');
naplo.foglalasInditasGA4 = await p.evaluate(() => (window.dataLayer || []).filter((x) => x && x[0] === 'event' && x[1] === 'foglalas_inditasa').length);
await sr('r.querySelector(`[data-hely="${a}"]`).click()', HELY);
await varj('[data-szolg]');
const szolgNev = await sr(`for (const k of ['magamnak','ketto']) { const kb=r.querySelector('[data-kinek="'+k+'"]'); if(!kb||kb.disabled) continue; kb.click(); for (const m of ['egy','tobb','fulbevalo']) { const mb=r.querySelector('[data-mit="'+m+'"]'); if(!mb||mb.disabled) continue; mb.click(); const x=r.querySelector('[data-szolg="'+a+'"]'); if(x){ const n=x.title; x.click(); return n; } } } return null;`, SZOLG);
if (!szolgNev) throw new Error('nincs ilyen szolgaltatas ezen a helyszinen: ' + SZOLG);
naplo.szolgNev = szolgNev;
await varj('[data-slot]');
await p.waitForTimeout(4000);
for (let i = 0; i < 4; i++) { const t = await sr('const b=[...r.querySelectorAll("[data-honap]")].pop(); if(!b||b.disabled||!b.dataset.honap) return false; b.click(); return true'); if (!t) break; await p.waitForTimeout(700); }
await sr('[...r.querySelectorAll("[data-nap]")].pop().click()');
await p.waitForTimeout(900);
naplo.ido = await sr('const s=[...r.querySelectorAll("[data-slot]")].pop(); return {unix:+s.dataset.slot, szoveg:new Date(+s.dataset.slot*1000).toLocaleString("hu-HU",{timeZone:"Europe/Budapest"})}');
await sr('[...r.querySelectorAll("[data-slot]")].pop().click()');
await varj('iframe.adatlap');
naplo.adatlap = await sr('return r.querySelector("iframe.adatlap").src');
let f;
for (let i = 0; i < 80; i++) { await p.waitForTimeout(500); f = p.frames().find((x) => /guestData/.test(x.url())); if (f && await f.$('#GuestDataForm_guestLastName').catch(() => null)) break; }
naplo.osszegzes = (await f.evaluate(() => document.body.innerText)).split('\n').filter((x) => /Ft|perc|Medical Piercing - |\(\w+\)/.test(x)).slice(0, 6);
const tolt = async (sel, ertek) => { const l = f.locator(sel).first(); await l.click(); await l.pressSequentially(ertek, { delay: 40 }); };
await tolt('#GuestDataForm_guestPhoneTemp', TELEFON);
await tolt('#GuestDataForm_guestLastName', 'TESZT –');
await tolt('#GuestDataForm_guestFirstName', 'Claude');
await tolt('#GuestDataForm_guestEmail', EMAIL);
// az mp.css (Salonic "Egyedi CSS URL") mobilon elrejti a nem kotelezo megjegyzes-mezot: csak akkor toltjuk, ha latszik
naplo.megjegyzesLatszik = await f.locator('#GuestDataForm_guestComment').first().isVisible();
if (naplo.megjegyzesLatszik) await tolt('#GuestDataForm_guestComment', `Próbafoglalás (TESZT) – foglalómotor-ellenőrzés #${NEV}, azonnal lemondjuk.`);
await f.locator('#GuestDataForm_acceptTerms').check();
naplo.rejtettTelefon = await f.evaluate(() => [document.querySelector('#GuestDataForm_guestPhone')?.value, document.querySelector('#GuestDataForm_guestPhoneFull')?.value]);
if (await p.locator('iframe[src*="recaptcha"][src*="bframe"]').count()) naplo.recaptchaKeret = true;
p.on('response', async (r) => { if (r.request().method() === 'POST' && /salonic\.hu\/guestData/.test(r.url())) { let t = ''; try { t = await r.text(); } catch (e) {} naplo.kuldesValasz = { status: r.status(), torzs: t.slice(0, 1500) }; const m = t.match(/bookingId=([0-9a-f-]{36})/); if (m) { naplo.salonicUuid = m[1]; naplo.lemondoUrl = 'https://medicalpiercing.salonic.hu/booking/cancelBooking/' + m[1]; } } });
await p.screenshot({ path: `${S}/proba-${NEV}-urlap.png` });
if (!KULD) { naplo.megjegyzes = 'KULD nelkul: nem kuldtuk be'; console.log(JSON.stringify(naplo, null, 1)); await b.close(); process.exit(0); }
const nav = p.waitForURL(/\/(foglalas-ok[a-z0-9-]*|fulbevalo-ok\d*)\/?\?.*booking_id=mb_/i, { timeout: 90000 }).then(() => true, () => false);
await f.click('#button-submit-booking');
naplo.atadva = await nav;
naplo.koszonoUrl = p.url();
await p.waitForTimeout(6000);
naplo.marMert = await p.evaluate(() => document.documentElement.getAttribute('data-mp-mar-mert'));
naplo.keretUrl = (p.frames().find((x) => x !== p.mainFrame()) || { url: () => '' }).url();
await p.screenshot({ path: `${S}/proba-${NEV}-koszono.png` });
naplo.hibauzenetek = await (p.frames().find((x) => /guestData/.test(x.url())) || { evaluate: async () => [] }).evaluate(() => [...document.querySelectorAll('.errorMessage, .help-block, .has-error, .alert, .text-danger, .swal-text, .swal-title')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 8)).catch(() => []);
naplo.vege = new Date().toISOString();
fs.appendFileSync(`${S}/probafoglalasok.jsonl`, JSON.stringify(naplo) + '\n');
console.log(JSON.stringify(naplo, null, 1));
await b.close();
