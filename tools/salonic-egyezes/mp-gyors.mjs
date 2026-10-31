// Medical Piercing: a motor (bongeszo, az ELOTOLTES kivarasaval, majd kattintas) vs. a Salonic naptar-API, minden helyszin x minden szolgaltatas (gyors, ~10 perc).
//   node tools/salonic-egyezes/mp-gyors.mjs <kimenet.json> <audit-medicalpiercing.json>   (WAIT=3000 ms az elotoltes kivarasa, PAR=4)
// A hiba, amit a 2026-10-27-i mintavetel nem talalt meg (a 3 es 2 piercing naptara Debrecenben nem lapozhato): csak az elotoltes kivarasa utan jelentkezik.
import fs from 'node:fs';
import { chromium, ujKontextus } from './ui-lib.mjs';
import { createSalonicAdapter } from '../../medicalpiercing/assets/js/motor/salonic-adapter.js';
const MOTOR = process.env.MP_MOTOR || 'https://www.medicalpiercing.hu';
const KIM = process.argv[2], WAIT = +(process.env.WAIT ?? 3000), PAR = +(process.env.PAR || 4);
const AUDIT = process.argv[3] || 'audit-medicalpiercing.json'; // az audit.mjs kimenete (medicalpiercing fiok)
const audit = JSON.parse(fs.readFileSync(AUDIT,'utf8'));
const feladat = audit.map(x => ({ hely: x.hely, szolg: x.szolg, nev: x.nev }));
const res = fs.existsSync(KIM) ? JSON.parse(fs.readFileSync(KIM,'utf8')) : {};
const b = await chromium.launch();
const nap = (u)=>new Date(u*1000).toLocaleDateString('sv-SE',{timeZone:'Europe/Budapest'});
const hm = (u)=>new Date(u*1000).toLocaleTimeString('hu-HU',{timeZone:'Europe/Budapest',hour:'2-digit',minute:'2-digit',hour12:false});
async function motor(f) {
  const c = await ujKontextus(b); const page = await c.newPage();
  const sr = (fn,a)=>page.evaluate(([fn,a])=>{const x=document.querySelector('[data-mp-motor]');return x&&x.shadowRoot?new Function('r','a',fn)(x.shadowRoot,a):null;},[fn,a]);
  const varj = async (fn,a,ms=40000)=>{for(let k=0;k<ms/200;k++){if(await sr(fn,a))return true;await page.waitForTimeout(200);}return false;};
  try {
    await page.goto(MOTOR+'/idopontfoglalas?motor=1',{waitUntil:'load',timeout:60000});
    if(!await varj('return !!r.querySelector("[data-tipus=uj]")')) return {hiba:'nincs tipus'};
    await sr('r.querySelector("[data-tipus=uj]").click()');
    if(!await varj('return !!r.querySelector(`[data-hely="${a}"]`)',f.hely)) return {hiba:'nincs hely'};
    await sr('r.querySelector(`[data-hely="${a}"]`).click()',f.hely);
    if(!await varj('return !!r.querySelector("[data-szolg]")')) return {hiba:'nincs lista'};
    await page.waitForTimeout(WAIT);
    const van = await sr('const x=r.querySelector(`[data-szolg="${a}"]`); if(x){x.click();return true}return false',f.szolg);
    if(!van) return {nincsMotorban:true};
    if(!await varj('const ab=r.querySelector(".ablak"); return ab && ab.dataset.tovabbi==="0" && (r.querySelector("[data-slot]")||r.querySelector("[data-nap]")||r.querySelector(".uzenet"))',null,60000)) return {hiba:'nem toltott'};
    await page.waitForTimeout(1200);
    const ki = new Set();
    for (let i=0;i<8;i++){
      const napok = await sr('return [...r.querySelectorAll("[data-nap]")].filter(x=>!x.disabled).map(x=>x.dataset.nap)');
      for (const n of napok||[]) { await sr('const x=r.querySelector(`[data-nap="${a}"]`); if(x) x.click()',n); await page.waitForTimeout(60);
        for (const t of (await sr('return [...r.querySelectorAll("[data-slot]")].map(x=>x.textContent.trim())'))||[]) ki.add(n+' '+t); }
      const t = await sr('const b=r.querySelector(".honap-fej button:last-child"); if(!b||b.disabled||!b.dataset.honap) return false; b.click(); return true');
      if(!t) break; await page.waitForTimeout(300);
    }
    return { ki:[...ki] };
  } finally { await c.close(); }
}
const ssor = feladat.filter(f=>!res[f.hely+'|'+f.szolg]); let i=0;
async function munka(){ while(i<ssor.length){ const f=ssor[i++]; const k=f.hely+'|'+f.szolg;
  try {
    const a = createSalonicAdapter({cacheMs:0});
    const [m, api] = await Promise.all([motor(f), a.getAvailability(+f.hely, f.szolg, {days:100, minLeadMinutes:35, fresh:true}).catch(e=>({hiba:String(e.code||e.message)}))]);
    if (m.hiba || m.nincsMotorban || api.hiba) { res[k]={nev:f.nev, ...(m.hiba?{motHiba:m.hiba}:{}), ...(m.nincsMotorban?{nincsMotorban:true}:{}), ...(api.hiba?{apiHiba:api.hiba}:{})}; }
    else { const S = new Set(api.map(x=>nap(x.start_unix)+' '+hm(x.start_unix))), M = new Set(m.ki);
      const maxS=[...S].sort().pop()?.slice(0,10), maxM=[...M].sort().pop()?.slice(0,10); const lim=maxS&&maxM?(maxS<maxM?maxS:maxM):(maxS||maxM);
      const koz=(x)=>!lim||x.slice(0,10)<=lim;
      res[k]={nev:f.nev,S:S.size,M:M.size,maxS,maxM,csakS:[...S].filter(x=>koz(x)&&!M.has(x)),csakM:[...M].filter(x=>koz(x)&&!S.has(x))}; }
  } catch(e){ res[k]={nev:f.nev,hiba:String(e.message).slice(0,100)}; }
  fs.writeFileSync(KIM, JSON.stringify(res)); const r=res[k];
  console.log(Object.keys(res).length+'/'+feladat.length, k, (r.nev||'').slice(0,28), r.hiba||r.motHiba||r.apiHiba||(r.nincsMotorban?'NINCS A MOTORBAN':`S=${r.S} M=${r.M} csakS=${r.csakS.length} csakM=${r.csakM.length} maxS=${r.maxS} maxM=${r.maxM}`));
}}
await Promise.all(Array.from({length:PAR},munka)); await b.close();
