// A foglalomotor FORMAZASANAK ellenorzese (valodi foglalas NELKUL: az adatlapot nem nyitja meg; a Salonic felé csak olvaso GET megy).
//
//   node tools/build.mjs && node tools/serve.mjs     (masik ablakban)
//   node tools/motor-formazas-teszt.mjs [--kep <mappa>]          (helyben)
//   BASE=https://<elonezet> node tools/motor-formazas-teszt.mjs   (elonezeten / elesben)
//
// Ellenorzi (mobilon TOBB keszuleken, es asztalon):
//   - 1. lepes: mind a 15 helyszin gorgetes nelkul latszik; nincs "Kitelepules" / "Allando rendelo" felirat;
//   - a fejlec cime kozepen van; a "Kezeles" szo sehol nem szerepel (helyette "Szolgaltatas");
//   - 2. lepes: asztalon a teljes lista egy kepernyon (gorgetes nelkul);
//   - 3. lepes: a szolgaltatas neve egy sorban fer el (MINDEN szolgaltatasnevre, a keszulek szelessegen);
//   - a "Vissza" gomb es a lepesjelzo mukodik (a helyszin-valasztasig is); a gombok es a sav legalabb 44 px magasak.
import { chromium, devices } from './pw.mjs';
import fs from 'node:fs';
const PORT = +process.env.PORT || 4290;
const ELES = !!process.env.BASE;
const CIM = (process.env.BASE || `http://www.medicalpiercing.hu:${PORT}`).replace(/\/$/, '');
const KEP = process.argv.includes('--kep') ? process.argv[process.argv.indexOf('--kep') + 1] : null;
if (KEP) fs.mkdirSync(KEP, { recursive: true });
const SZABAD = /^https:\/\/(medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
const b = await chromium.launch(ELES ? {} : { args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; return felt; };

const KESZULEKEK = [
  ['Pixel 5 (393x727)', { ...devices['Pixel 5'], locale: 'hu-HU' }, true],
  ['iPhone 12 (390x664)', { ...devices['iPhone 12'], locale: 'hu-HU' }, true],
  ['iPhone SE 3 (375x667)', { ...devices['iPhone SE (3rd gen)'], locale: 'hu-HU' }, true],
  ['Galaxy S9+ (320x658)', { ...devices['Galaxy S9+'], locale: 'hu-HU' }, true],
  ['asztali 1440x900', { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' }, false],
  ['asztali 1920x1080', { viewport: { width: 1920, height: 1080 }, locale: 'hu-HU' }, false],
];

async function egy(nev, opt, mobil) {
  const ctx = await b.newContext(opt);
  await ctx.route(/\/api\/mp-foglalas$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await ctx.route((u) => !u.toString().startsWith(CIM), (r) => (SZABAD.test(r.request().url()) && r.request().method() === 'GET' ? r.continue() : r.abort()));
  const p = await ctx.newPage();
  const jsHibak = [];
  p.on('pageerror', (e) => jsHibak.push(e.message.slice(0, 120)));
  const sr = (fn, a) => p.evaluate(([fn, a]) => { const h = document.querySelector('[data-mp-motor]'); return h ? new Function('r', 'a', fn)(h.shadowRoot, a) : null; }, [fn, a]);
  const varj = async (sel, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await sr('return !!r.querySelector(a)', sel)) return true; await p.waitForTimeout(250); } return false; };
  const kep = async (n) => { if (KEP) await p.screenshot({ path: `${KEP}/${nev.replace(/[^a-z0-9]+/gi, '-')}-${n}.png` }); };
  // a motor allapota: elfer-e a tartalom gorgetes nelkul, a cim kozepen van-e, szoveg
  const meres = () => sr('const t=r.querySelector(".tartalom"), ab=r.querySelector(".ablak").getBoundingClientRect(), h=r.querySelector(".fej h2").getBoundingClientRect(); return {elfer: t.scrollHeight<=t.clientHeight+1, sh:t.scrollHeight, ch:t.clientHeight, cimKozep: Math.abs((h.left+h.width/2)-(ab.left+ab.width/2)), szoveg: r.querySelector(".ablak").innerText};');

  await p.goto(`${CIM}/idopontfoglalas${ELES ? '' : '?motor=1'}`, { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const l = [...document.querySelectorAll('a[href*="medicalpiercing.salonic.hu/selectLocation"]')]; const a = l.find((x) => x.offsetParent) || l[0]; a.scrollIntoView({ block: 'center' }); a.click(); });
  for (let i = 0; i < 100; i++) { if (await sr('return !!r.querySelector("[data-hely]")')) break; if (await sr('const t=r.querySelector(\'[data-tipus="uj"]\'); if (t) { t.click(); return true; } return false')) break; await p.waitForTimeout(250); }
  if (!ok(`${nev}: a motor megnyilik`, await varj('[data-hely]'))) { await ctx.close(); return; }
  await p.waitForTimeout(500);

  // 1. helyszin
  const m1 = await meres();
  const db = await sr('return r.querySelectorAll("[data-hely]").length');
  ok(`${nev}: 1. lepes: mind a ${db} helyszin gorgetes nelkul latszik`, db === 15 && m1.elfer, `scrollH ${m1.sh} / lathato ${m1.ch}`);
  ok(`${nev}: 1. lepes: nincs "Kitelepules" / "Allando rendelo" felirat`, !/Kitelepülés|Állandó/.test(m1.szoveg));
  ok(`${nev}: a fejlec cime kozepen van`, m1.cimKozep <= 2, `elteres ${m1.cimKozep.toFixed(1)} px`);
  const meretek = await sr('const mn=(s)=>Math.min(...[...r.querySelectorAll(s)].map(e=>e.getBoundingClientRect().height)); return {sav: mn(".lepesek button"), bez: mn("[data-bezar]"), hely: mn("[data-hely]")};');
  ok(`${nev}: a lepesjelzo, a bezaras es a helyszin-gombok legalabb 44 px magasak`, meretek.sav >= 43.5 && meretek.bez >= 43.5 && meretek.hely >= 43.5, JSON.stringify(meretek));
  await kep('1-helyszin');

  // 2. szolgaltatas
  await sr('r.querySelector(`[data-hely="6029"]`).click()');
  if (!ok(`${nev}: a szolgaltatasok betoltodnek`, await varj('[data-szolg]'))) { await ctx.close(); return; }
  await p.waitForTimeout(500);
  const m2 = await meres();
  ok(`${nev}: a "Kezeles" szo sehol nem szerepel, a lepesjelzoben "Szolgaltatas" van`, !/kezel/i.test(m2.szoveg) && /Szolgáltatás/.test(m2.szoveg));
  if (!mobil) ok(`${nev}: 2. lepes: a teljes szolgaltatas-lista egy kepernyon (gorgetes nelkul)`, m2.elfer, `scrollH ${m2.sh} / lathato ${m2.ch}`);
  else console.log(`INFO ${nev}: 2. lepes: a lista ${m2.sh} px magas, ${m2.ch} px latszik (mobilon gorgetes elfogadott)`);
  ok(`${nev}: a fejlec cime kozepen van (2. lepes, vissza gombbal)`, m2.cimKozep <= 2, `elteres ${m2.cimKozep.toFixed(1)} px`);
  const nevek = await sr('return [...r.querySelectorAll("[data-szolg] .nev")].map(x=>x.textContent)');
  // MINDEN szolgaltatasnev egy sorban fer-e az osszegzo dobozban (itt, ezen a szeleessegen)
  const nemFer = await sr(`const t=r.querySelector(".tartalom"); const o=document.createElement("div"); o.className="osszegzes"; o.innerHTML='<div class="os-szolg"></div>'; t.prepend(o); const e=o.firstChild; const rossz=[]; for(const n of a){ e.textContent=n; if(e.scrollWidth>e.clientWidth+0.5) rossz.push(n); } o.remove(); return rossz;`, nevek);
  ok(`${nev}: mind a ${nevek.length} szolgaltatasnev egy sorban elfer az osszegzo dobozban`, nevek.length > 10 && !nemFer.length, nemFer.join(' | '));
  await kep('2-szolgaltatas');
  // "Vissza" gomb: a helyszin-valasztasig is eljut
  await sr('r.querySelector("[data-vissza]").click()');
  ok(`${nev}: a "Vissza" gomb a szolgaltatasokrol a helyszin-valasztasra visz`, await varj('[data-hely]', 4000) && !(await sr('return !!r.querySelector("[data-szolg]")')));

  // 3. idopont (a leghosszabb nevu szolgaltatas)
  await sr('r.querySelector(`[data-hely="6029"]`).click()');
  await varj('[data-szolg]');
  await sr('const x=[...r.querySelectorAll("[data-szolg]")].sort((a,b)=>b.querySelector(".nev").textContent.length-a.querySelector(".nev").textContent.length)[0]; x.click();');
  if (!ok(`${nev}: az idopont-lepes betoltodik`, await varj('[data-slot]', 40000))) { await ctx.close(); return; }
  await p.waitForTimeout(500);
  const m3 = await meres();
  const egySor = await sr('const e=r.querySelector(".os-szolg"); return {fer: e.scrollWidth<=e.clientWidth+0.5, szoveg:e.textContent, sw:e.scrollWidth, cw:e.clientWidth, fs:getComputedStyle(e).fontSize, magas: e.getBoundingClientRect().height};');
  ok(`${nev}: 3. lepes: a leghosszabb szolgaltatasnev egy sorban fer ("${egySor.szoveg}")`, egySor.fer, `szeles ${egySor.sw}/${egySor.cw} px, betu ${egySor.fs}, magassag ${Math.round(egySor.magas)}`);
  ok(`${nev}: 3. lepes: a fejlec cime kozepen van`, m3.cimKozep <= 2, `elteres ${m3.cimKozep.toFixed(1)} px`);
  await kep('3-idopont');
  // lepesjelzo: a "1. Helyszin" sav kattintasa
  await sr('r.querySelector(`.lepesek button[data-lepes="hely"]`).click()');
  ok(`${nev}: a lepesjelzo "Helyszin" savja a helyszin-valasztasra visz`, await varj('[data-hely]', 4000));
  ok(`${nev}: nincs JS-hiba`, !jsHibak.length, jsHibak.join(' | '));
  await ctx.close();
}

for (const [nev, opt, mobil] of KESZULEKEK) await egy(nev, opt, mobil);
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
