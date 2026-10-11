// Tavoli fustteszt (elonezet / eles): BASE=https://... node tools/motor-proba/motor-fust.mjs [--mobil]
// FIGYELEM: az adatlap megnyitasa a Salonicban 5 percre lefoglalja az idopontot - ezert a legtavolabbi nap legkesobbi idopontjat valasztja.
// Minden meroeszkoz-kerest eldob; a Salonic felé csak olvaso GET (es a beagyazott adatlap betoltese) megy, bekuldes NINCS.
import { chromium, devices } from '../pw.mjs';
import fs from 'node:fs';
const KI = process.env.KI || new URL('./kimenet', import.meta.url).pathname; fs.mkdirSync(KI, { recursive: true });
const BASE = process.env.BASE.replace(/\/$/, '');
const MOBIL = process.argv.includes('--mobil');
let hiba = 0;
const ok = (n, f, i = '') => { console.log(`${f ? 'OK  ' : 'HIBA'} ${MOBIL ? 'mobil' : 'asztali'}: ${n}${i ? '  ' + i : ''}`); if (!f) hiba++; };
const SZABAD = /^https:\/\/(medicalpiercing\.salonic\.hu\/|api\.salonic\.hu\/calendar\/getAvailableTimes|[a-z0-9]+\.salonic\.hu\/|cdn\.jsdelivr\.net\/|cdnjs\.cloudflare\.com\/|fonts\.(googleapis|gstatic)\.com\/)/;
const b = await chromium.launch();
const OPT = MOBIL ? { ...devices['Pixel 5'] } : { viewport: { width: 1440, height: 900 } };
const ki = [];
async function kornyezet(salonicNavTilt) {
  const ctx = await b.newContext(OPT);
  await ctx.route((u) => !u.toString().startsWith(BASE), (r) => {
    const q = r.request(); const u = q.url();
    let fo = false; try { fo = q.isNavigationRequest() && q.frame() === q.frame().page().mainFrame(); } catch (e) {}
    if (salonicNavTilt && fo) { ki.push(u); return r.abort(); }
    if (q.method() === 'GET' && SZABAD.test(u)) return r.continue();
    ki.push(u); return r.abort();
  });
  await ctx.route(/\/api\/mp-foglalas$/, (r) => r.abort());
  return ctx;
}
const sr = (p, fn, a) => p.evaluate(([fn, a]) => { const h = document.querySelector('[data-mp-motor]'); return h ? new Function('r', 'a', fn)(h.shadowRoot, a) : null; }, [fn, a]);
const varMotor = async (p, sel, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await sr(p, 'return !!r.querySelector(a)', sel)) return true; await p.waitForTimeout(250); } return false; };
const kattintLink = (p) => p.evaluate(() => {
  const l = [...document.querySelectorAll('a[href]')].filter((a) => /^https:\/\/medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|employees|selectEmployee|selectDate)/i.test(a.href));
  const a = l.find((x) => x.offsetParent !== null) || l[0]; a.scrollIntoView({ block: 'center' }); a.click(); return a.href;
});
{ // alap (kapcsolo szerint)
  const ctx = await kornyezet(true); const p = await ctx.newPage();
  await p.goto(BASE + '/idopontfoglalas', { waitUntil: 'load' });
  const nav = ctx.waitForEvent('request', { predicate: (r) => r.isNavigationRequest() && /medicalpiercing\.salonic\.hu/.test(r.url()), timeout: 8000 }).then((r) => r.url(), () => null);
  await kattintLink(p); const cel = await nav; await p.waitForTimeout(800);
  const motor = await p.evaluate(() => !!document.querySelector('[data-mp-motor]'));
  console.log(`alap: ${cel ? 'Salonic-navigacio ' + cel.slice(0, 70) : 'nincs Salonic-navigacio'}; motor: ${motor}`);
  ok('alap (0%): regi Salonic-ut, motor nincs', !!cel && !motor);
  await ctx.close();
}
{ // ?motor=1 az adatlapig
  const ctx = await kornyezet(false); const p = await ctx.newPage();
  const hibak = []; p.on('pageerror', (e) => hibak.push(e.message));
  await p.goto(BASE + '/idopontfoglalas?motor=1&gclid=FUSTTESZT123', { waitUntil: 'load' });
  const cim = p.url();
  await kattintLink(p);
  ok('?motor=1: megnyilik', await varMotor(p, '[data-hely]'));
  ok('cim valtozatlan', p.url() === cim);
  ok('15 helyszin', (await sr(p, 'return r.querySelectorAll("[data-hely]").length')) === 15);
  await sr(p, 'r.querySelector("[data-hely=\\"6029\\"]").click()');
  ok('Budapest kezelesei', await varMotor(p, '[data-szolg]'));
  const sz = await sr(p, 'return [...r.querySelectorAll("[data-szolg] .nev")].map(x=>x.textContent)');
  ok('magyar nevek', sz.length >= 15 && sz.some((x) => /Migrén/.test(x)), sz.slice(0, 2).join(' | '));
  await sr(p, 'r.querySelector("[data-szolg]").click()');
  ok('szabad idopont', await varMotor(p, '[data-slot]'));
  // az adatlap a Salonicban 5 percre lefoglalja az idopontot: a legtavolabbi nap legkesobbi idopontjat valasztjuk
  await p.waitForTimeout(4000);
  for (let i = 0; i < 4; i++) { const t = await sr(p, 'const b=[...r.querySelectorAll("[data-honap]")].pop(); if(!b||b.disabled||!b.dataset.honap) return false; b.click(); return true'); if (!t) break; await p.waitForTimeout(600); }
  await sr(p, 'const n=[...r.querySelectorAll("[data-nap]")].pop(); if(n) n.click()');
  await p.waitForTimeout(800);
  console.log('valasztott nap:', await sr(p, 'return (r.querySelector(".alcim")||{}).textContent'), '| ido:', await sr(p, 'return [...r.querySelectorAll("[data-slot]")].pop().textContent'));
  await sr(p, '[...r.querySelectorAll("[data-slot]")].pop().click()');
  ok('adatlap keret', await varMotor(p, 'iframe.adatlap'));
  const src = await sr(p, 'return r.querySelector("iframe.adatlap").src');
  const u = new URL(src);
  ok('guestData cim', u.pathname === '/guestData/' && u.searchParams.get('lang') === 'hu' && /^mb_/.test(u.searchParams.get('back') || '') && u.searchParams.get('gclid') === 'FUSTTESZT123', src.slice(0, 150));
  let mezok = 0;
  for (let i = 0; i < 60 && !mezok; i++) { await p.waitForTimeout(500); const f = p.frames().find((f) => /guestData/.test(f.url())); if (f) mezok = await f.evaluate(() => document.querySelectorAll('input:not([type=hidden])').length).catch(() => 0); }
  ok('a Salonic-adatlap betoltodik a keretben (beviteli mezok)', mezok >= 3, String(mezok));
  await p.screenshot({ path: `${KI}/fust-${MOBIL ? 'm' : 'a'}.png` });
  ok('nincs JS-hiba', hibak.length === 0, hibak.join(' | ').slice(0, 200));
  await ctx.close();
}
await b.close();
console.log('eldobott kulso kerest:', ki.length, [...new Set(ki.map((x) => new URL(x).hostname))].join(', '));
console.log(hiba ? `${hiba} HIBA` : 'Minden rendben');
process.exit(hiba ? 1 : 0);
