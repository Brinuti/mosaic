// A foglalomotor FORMAZASANAK ellenorzese (valodi foglalas NELKUL: az adatlapot nem nyitja meg; a Salonic felé csak olvaso GET megy).
//
//   node tools/build.mjs && node tools/serve.mjs     (masik ablakban)
//   node tools/motor-formazas-teszt.mjs [--kep <mappa>]          (helyben)
//   BASE=https://<elonezet> node tools/motor-formazas-teszt.mjs   (elonezeten / elesben)
//
// Ellenorzi (mobilon TOBB keszuleken, es asztalon):
//   - 1. lepes: asztalon mind a 15 helyszin gorgetes nelkul latszik, mobilon egy oszlopban nagy cellak (gorgetes elfogadott); nincs "Kitelepules" / "Allando rendelo" felirat;
//   - a fejlec cime kozepen van; a "Kezeles" szo sehol nem szerepel (helyette "Szolgaltatas");
//   - 2. lepes: asztalon a teljes lista egy kepernyon (gorgetes nelkul);
//   - 3. lepes: a szolgaltatas neve egy sorban fer el (MINDEN szolgaltatasnevre, a keszulek szelessegen);
//   - a "Vissza" gomb es a lepesjelzo mukodik (a helyszin-valasztasig is); a lepesjelzo es a bezaras legalabb 44 px, a helyszin-gombok legalabb 38 px magasak.
import { chromium, devices } from './pw.mjs';
import { MINDEN_SZOLG, SZOLG_KATTINT } from './motor-teszt-segedek.mjs';
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

  // (a /migren lapon a regi es az uj dizajnban is van altalanos Salonic-foglalo link; az uj blogcikkekben a foglalas gomb belso link: /idopontfoglalas)
  await p.goto(`${CIM}/migren${ELES ? '' : '?motor=1'}`, { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const l = [...document.querySelectorAll('a[href*="medicalpiercing.salonic.hu/selectLocation"]')]; const a = l.find((x) => x.offsetParent) || l[0]; a.scrollIntoView({ block: 'center' }); a.click(); });
  for (let i = 0; i < 100; i++) { if (await sr('return !!r.querySelector("[data-hely]")')) break; if (await sr('const t=r.querySelector(\'[data-tipus="uj"]\'); if (t) { t.click(); return true; } return false')) break; await p.waitForTimeout(250); }
  if (!ok(`${nev}: a motor megnyilik`, await varj('[data-hely]'))) { await ctx.close(); return; }
  await p.waitForTimeout(500);

  // 1. helyszin
  const m1 = await meres();
  const db = await sr('return r.querySelectorAll("[data-hely]").length');
  if (!mobil) ok(`${nev}: 1. lepes: mind a ${db} helyszin gorgetes nelkul latszik`, db === 15 && m1.elfer, `scrollH ${m1.sh} / lathato ${m1.ch}`);
  else {
    // mobilon (Feri 2026-10-13): egy oszlop, nagy cellak; ha kell, gorgetni lehet, az utolso helyszin is elerheto
    const e = await sr('const ks=[...r.querySelectorAll("[data-hely]")]; const t=r.querySelector(".tartalom"); const u=ks[ks.length-1]; u.scrollIntoView({block:"end"}); const tr=t.getBoundingClientRect(), ur=u.getBoundingClientRect(); const rr=ks.map(x=>x.getBoundingClientRect()); return { oszlop: new Set(rr.map(x=>Math.round(x.left))).size, utolsoLatszik: ur.top>=tr.top-1 && ur.bottom<=tr.bottom+1, magas: Math.round(Math.min(...rr.map(x=>x.height))) };');
    ok(`${nev}: 1. lepes: a ${db} helyszin egy oszlopban, nagy cellakban, az utolso gorgetessel elerheto`, db === 15 && e.oszlop === 1 && e.magas >= 54 && e.utolsoLatszik, JSON.stringify(e));
    await sr('r.querySelector(".tartalom").scrollTop = 0');
  }
  ok(`${nev}: 1. lepes: nincs "Kitelepules" / "Allando rendelo" felirat`, !/Kitelepülés|Állandó/.test(m1.szoveg));
  ok(`${nev}: a fejlec cime kozepen van`, m1.cimKozep <= 2, `elteres ${m1.cimKozep.toFixed(1)} px`);
  const meretek = await sr('const mn=(s)=>Math.min(...[...r.querySelectorAll(s)].map(e=>e.getBoundingClientRect().height)); return {sav: mn(".lepesek button"), bez: mn("[data-bezar]"), hely: mn("[data-hely]")};');
  // a lepesjelzo es a bezaras >= 44 px; a helyszin-gombok asztalon >= 38 px (15 helyszin egy kepernyon), mobilon >= 54 px (nagy, olvashato cellak)
  ok(`${nev}: a lepesjelzo es a bezaras legalabb 44 px, a helyszin-gombok legalabb ${mobil ? 54 : 38} px magasak`, meretek.sav >= 43.5 && meretek.bez >= 43.5 && meretek.hely >= (mobil ? 53.5 : 37.5), JSON.stringify(meretek));
  await kep('1-helyszin');

  // 2. szolgaltatas
  await sr('r.querySelector(`[data-hely="6029"]`).click()');
  if (!ok(`${nev}: a szolgaltatasok betoltodnek`, await varj('[data-szolg]'))) { await ctx.close(); return; }
  await p.waitForTimeout(500);
  const m2 = await meres();
  ok(`${nev}: a "Kezeles" szo sehol nem szerepel, a lepesjelzoben "Szolgaltatas" van`, !/kezel/i.test(m2.szoveg) && /Szolgáltatás/.test(m2.szoveg));
  // 2026-10-16: a lenyithato piercing-kartyak (a tulajdonos latvanyterve) gorgethetok; a meretek a motor-tipus-teszt K2-ben
  console.log(`INFO ${nev}: 2. lepes: a lista ${m2.sh} px magas, ${m2.ch} px latszik (a lenyithato kartyak gorgethetok)`);
  ok(`${nev}: a fejlec cime kozepen van (2. lepes, vissza gombbal)`, m2.cimKozep <= 2, `elteres ${m2.cimKozep.toFixed(1)} px`);
  const osszes = await sr(MINDEN_SZOLG); // az osszes szolgaltatas (a ket szuro minden kombinaciojabol)
  const nevek = osszes.map((x) => x.nev);
  // MINDEN szolgaltatasnev egy sorban fer-e az osszegzo dobozban (itt, ezen a szeleessegen)
  const nemFer = await sr(`const t=r.querySelector(".tartalom"); const o=document.createElement("div"); o.className="osszegzes"; o.innerHTML='<div class="os-szolg"></div>'; t.prepend(o); const e=o.firstChild; const rossz=[]; for(const n of a){ e.textContent=n; if(e.scrollWidth>e.clientWidth+0.5) rossz.push(n); } o.remove(); return rossz;`, nevek);
  ok(`${nev}: mind a ${nevek.length} szolgaltatasnev egy sorban elfer az osszegzo dobozban`, nevek.length >= 15 && !nemFer.length, nemFer.join(' | '));
  await kep('2-szolgaltatas');
  // "Vissza" gomb: a helyszin-valasztasig is eljut
  await sr('r.querySelector("[data-vissza]").click()');
  ok(`${nev}: a "Vissza" gomb a szolgaltatasokrol a helyszin-valasztasra visz`, await varj('[data-hely]', 4000) && !(await sr('return !!r.querySelector("[data-szolg]")')));

  // 3. idopont (a leghosszabb nevu szolgaltatas)
  await sr('r.querySelector(`[data-hely="6029"]`).click()');
  await varj('[data-szolg]');
  const leghosszabb = [...osszes].sort((a, b) => b.nev.length - a.nev.length)[0];
  await sr(SZOLG_KATTINT, leghosszabb.id);
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
