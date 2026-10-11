// A motorban nyilo Salonic-adatlap mobilon (foglalas NINCS): elfer-e egy kepernyon gorgetes nelkul.
//   BASE=https://www.medicalpiercing.hu node adatlap-meres.mjs [--css helyi.css] [--kep nev] [--eszkoz "iPhone 12"]
import { chromium, devices } from '../pw.mjs';
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const S = process.env.KI || new URL('./kimenet', import.meta.url).pathname; fs.mkdirSync(S, { recursive: true });
const BASE = (process.env.BASE || 'https://www.medicalpiercing.hu').replace(/\/$/, '');
const CSS = arg('css') ? fs.readFileSync(arg('css'), 'utf8') : null;
const ESZKOZ = arg('eszkoz', 'Pixel 5'), HELY = arg('hely', '6029');
const b = await chromium.launch();
const ctx = await b.newContext(ESZKOZ === 'asztali' ? { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' } : { ...devices[ESZKOZ], locale: 'hu-HU' });
await ctx.route((u) => !u.toString().startsWith(BASE) && !u.toString().startsWith(CSS_URL) && !/^https:\/\/medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|guestData)\//.test(u.toString()), (r) => { const u = r.request().url(); if (r.request().method() === 'GET' && /^https:\/\/([a-z0-9.-]*salonic\.hu|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|www\.google\.com\/recaptcha|www\.gstatic\.com\/recaptcha)\//.test(u)) return r.continue(); return r.abort(); });
// --stilus: mintha a Salonic-fiokban be lenne allitva az "Egyedi CSS URL" (minden Salonic-oldal betolti az MP stiluslapjat)
const STILUS = process.argv.includes('--stilus') ? fs.readFileSync(new URL('../../assets/salonic/mp.css', import.meta.url), 'utf8') : CSS;
const CSS_URL = 'https://www.medicalpiercing.hu/assets/salonic/mp.css';
if (STILUS) {
  await ctx.route(CSS_URL, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: STILUS }));
  await ctx.route(/^https:\/\/medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|guestData)\//, async (r) => { const resp = await r.fetch(); let t = await resp.text(); t = t.replace('</head>', `<link rel="stylesheet" href="${CSS_URL}"></head>`); r.fulfill({ response: resp, body: t }); });
}
const p = await ctx.newPage();
const sr = (fn, a) => p.evaluate(([fn, a]) => { const h = document.querySelector('[data-mp-motor]'); return h ? new Function('r', 'a', fn)(h.shadowRoot, a) : null; }, [fn, a]);
const varj = async (sel) => { for (let i = 0; i < 160; i++) { if (await sr('return !!r.querySelector(a)', sel)) return; await p.waitForTimeout(250); } throw new Error('nincs ' + sel); };
await p.goto(BASE + '/a-migren-piercing-gyogyulasi-ideje?motor=1', { waitUntil: 'load' });
await p.evaluate(() => { const l = [...document.querySelectorAll('a[href*="medicalpiercing.salonic.hu/selectLocation"]')]; (l.find((x) => x.offsetParent) || l[0]).click(); });
for (let i = 0; i < 100; i++) { if (await sr('return !!r.querySelector("[data-hely]")')) break; if (await sr('const t=r.querySelector(\'[data-tipus="uj"]\'); if (t) { t.click(); return true; } return false')) break; await p.waitForTimeout(250); }
await varj('[data-hely]'); await sr('r.querySelector(`[data-hely="${a}"]`).click()', HELY);
await varj('[data-szolg]'); await sr('r.querySelector("[data-mit=egy]").click()'); await sr('[...r.querySelectorAll("[data-szolg]")].find(x=>/Migrén/.test(x.textContent)).click()');
await varj('[data-slot]'); await p.waitForTimeout(3500);
for (let i = 0; i < 4; i++) { const t = await sr('const b=[...r.querySelectorAll("[data-honap]")].pop(); if(!b||b.disabled||!b.dataset.honap) return false; b.click(); return true'); if (!t) break; await p.waitForTimeout(600); }
await sr('[...r.querySelectorAll("[data-nap]")].pop().click()'); await p.waitForTimeout(700);
await sr('[...r.querySelectorAll("[data-slot]")].pop().click()');
await varj('iframe.adatlap');
let f;
for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); f = p.frames().find((x) => /guestData/.test(x.url())); if (f && await f.$('#button-submit-booking').catch(() => null)) break; }
await p.waitForTimeout(1500);
const vp = p.viewportSize();
const keret = await sr('const i=r.querySelector("iframe.adatlap"); const b=i.getBoundingClientRect(); return {top:Math.round(b.top), height:Math.round(b.height), width:Math.round(b.width)}');
const belso = await f.evaluate(() => {
  const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), h: Math.round(b.height) }; };
  return { teljes: document.documentElement.scrollHeight, szel: document.documentElement.scrollWidth, ablak: innerHeight, bodyClass: document.body.className, egyediCss: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href).filter((h) => !/salonic\.hu|cdn|googleapis/.test(h)),
    navbar: r('.navbar'), fejlec: r('.page-header'), visszaszamlalo: r('.booking-time-remain-container'), telefon: r('#GuestDataForm_guestPhoneTemp'), email: r('#GuestDataForm_guestEmail'), megj: r('#GuestDataForm_guestComment'), feltetel: r('#GuestDataForm_acceptTerms'), gomb: r('#button-submit-booking'), lablec: r('footer'), sutisav: r('.cc-window') };
});
if (process.argv.includes('--dom')) fs.writeFileSync(S + '/adatlap-dom.html', await f.content());
const vaz = await f.evaluate(() => { const out = []; const jar = (e, d) => { if (d > 7) return; const b = e.getBoundingClientRect(); if (b.height > 8 && e.tagName !== 'SCRIPT') out.push('  '.repeat(d) + e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 4).join('.') : '') + ' [' + Math.round(b.top + scrollY) + '+' + Math.round(b.height) + ']'); for (const c of e.children) jar(c, d + 1); }; jar(document.body, 0); return out.join('\n'); });
if (process.argv.includes('--dom')) fs.writeFileSync(S + '/adatlap-vaz.txt', vaz);
const stilusok = await f.evaluate(() => { const cs = (sel, k) => { const e = document.querySelector(sel); return e ? k.map((x) => getComputedStyle(e)[x]).join(' ') : null; }; return { cimke: cs('.form-check label', ['fontSize', 'lineHeight']), panelDiv: cs('.panel-body > div', ['fontSize', 'display']), formGroup: cs('.form-group', ['marginBottom', 'paddingTop']), input: cs('#GuestDataForm_guestEmail', ['height']), mediaMax599: matchMedia('(max-width: 599px)').matches, iw: innerWidth, sajatCss: !!document.querySelector('link[href*="assets/salonic/mp.css"]'), cc: cs('.cc-window', ['height', 'fontSize']) }; });
console.log('STILUSOK', JSON.stringify(stilusok));
const keret2 = await sr('const i=r.querySelector("iframe.adatlap"); const b=i.getBoundingClientRect(); return {top:Math.round(b.top), height:Math.round(b.height)}');
console.log('KERET MOST', JSON.stringify(keret2));
console.log('DOBOZOK', JSON.stringify(await sr('return [".ablak",".fej",".tartalom",".adatlap-burok","iframe.adatlap"].map(s=>{const e=r.querySelector(s); if(!e) return s+": -"; const b=e.getBoundingClientRect(); return s+": "+[b.left,b.top,b.width,b.height].map(Math.round).join(",")+" lepes="+(r.querySelector(".ablak").dataset.lepes)})')));
console.log('FRAMEK', p.frames().map((x) => x.url().slice(0, 90)).join(' | '));
console.log(JSON.stringify({ eszkoz: ESZKOZ, kepernyo: vp, keret, belso }, null, 1));
const gombAlja = keret.top + (belso.gomb ? belso.gomb.top + belso.gomb.h : 99999);
console.log(`GOMB ALJA A KEPERNYON: ${gombAlja} px / ${vp.height} px (keret ${keret.top}–${keret.top + keret.height}); a keretben gorgetes kell: ${belso.teljes > keret.height}`);
await p.screenshot({ path: `${S}/adatlap-${arg('kep', 'mobil')}.png` });
await b.close();
