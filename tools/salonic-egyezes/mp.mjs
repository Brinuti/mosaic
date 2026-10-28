// Medical Piercing: Salonic-felulet (medicalpiercing.salonic.hu, vendegkent, "barki") vs. a medicalpiercing.hu foglalomotor, UGYANABBAN az idoben.
//   node mp.mjs <audit.json> <kimenet.json> [szolgaltatas/helyszin] [csak-helyszinek,vesszovel]
import fs from 'node:fs';
import { chromium, ujKontextus, salonicIdopontok, nap, hhmm } from './ui-lib.mjs';
const [AUDIT, KIM, DB = '4', CSAK = ''] = process.argv.slice(2);
const HOST = 'https://medicalpiercing.salonic.hu', MOTOR = process.env.MP_MOTOR || 'https://www.medicalpiercing.hu';
const PAR = +(process.env.PAR || 2), HONAP = +(process.env.HONAP || 4);
const d = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const helyek = new Map();
for (const s of d) { if (CSAK && !CSAK.split(',').includes(String(s.hely))) continue; if (!helyek.has(s.hely)) helyek.set(s.hely, []); helyek.get(s.hely).push(s); }
const feladatok = [];
for (const [hely, l] of helyek) { // helyszinenkent: hosszanként az első szolgáltatás, majd feltöltés a lista elejéről
  const k = new Map(); for (const s of l) if (!k.has(s.perc)) k.set(s.perc, s);
  const kivalasztott = [...k.values()]; for (const s of l) { if (kivalasztott.length >= +DB) break; if (!kivalasztott.includes(s)) kivalasztott.push(s); }
  for (const s of kivalasztott.slice(0, +DB)) feladatok.push({ hely, s, kulcs: `${hely}|${s.szolg}` });
}
const eredmeny = fs.existsSync(KIM) ? JSON.parse(fs.readFileSync(KIM, 'utf8')) : {};
const b = await chromium.launch();

async function motorIdopontok(page, hely, szolg) {
  const ki = new Set();
  const sr = (fn, a) => page.evaluate(([fn, a]) => { const x = document.querySelector('[data-mp-motor]'); return x && x.shadowRoot ? new Function('r', 'a', fn)(x.shadowRoot, a) : null; }, [fn, a]);
  const varj = async (felt, a, ms = 40000) => { for (let i = 0; i < ms / 200; i++) { if (await sr(felt, a)) return true; await page.waitForTimeout(200); } return false; };
  await page.goto(MOTOR + '/idopontfoglalas?motor=1', { waitUntil: 'load', timeout: 60000 });
  if (!(await varj('return !!r.querySelector("[data-tipus=uj]")'))) return { ki, hiba: 'nincs tipus-valaszto' };
  await sr('r.querySelector("[data-tipus=uj]").click()');
  if (!(await varj('return !!r.querySelector(`[data-hely="${a}"]`)', hely))) return { ki, hiba: 'nincs helyszin ' + hely };
  await sr('r.querySelector(`[data-hely="${a}"]`).click()', hely);
  if (!(await varj('return !!r.querySelector("[data-szolg]")'))) return { ki, hiba: 'nincs szolgaltatas-lista' };
  if (!(await sr('const x=r.querySelector(`[data-szolg="${a}"]`); if(x){x.click();return true}return false', szolg))) return { ki, hiba: 'a szolgaltatas nincs a motor listajaban', nincs: true };
  const van = await varj('const ab=r.querySelector(".ablak"); return ab && ab.dataset.tovabbi==="0" && (r.querySelector("[data-slot]") || r.querySelector("[data-nap]") || r.querySelector(".uzenet"))', null, 60000);
  if (!van) return { ki, hiba: 'az idopontok nem toltodtek be' };
  for (let i = 0; i < HONAP + 4; i++) {
    const napok = await sr('return [...r.querySelectorAll("[data-nap]")].filter(x=>!x.disabled).map(x=>x.dataset.nap)');
    for (const n of napok || []) {
      await sr('const x=r.querySelector(`[data-nap="${a}"]`); if(x) x.click()', n);
      await page.waitForTimeout(150);
      for (const t of (await sr('return [...r.querySelectorAll("[data-slot]")].map(x=>x.textContent.trim())')) || []) ki.add(n + ' ' + t);
    }
    const tovabb = await sr('const b=r.querySelector(".honap-fej button:last-child"); if(!b||b.disabled||!b.dataset.honap) return false; b.click(); return true');
    if (!tovabb) break;
    await page.waitForTimeout(500);
  }
  return { ki };
}

const sor = feladatok.filter((f) => !eredmeny[f.kulcs]);
console.log('MP feladat:', feladatok.length, 'hatra:', sor.length);
let i = 0;
async function munka() {
  while (i < sor.length) {
    const f = sor[i++]; const t0 = Date.now();
    try {
      const merj = async () => {
        const c1 = await ujKontextus(b), c2 = await ujKontextus(b);
        const [sal, mot] = await Promise.all([
          salonicIdopontok(await c1.newPage(), f.s.szolg, '-1', { maxHonap: HONAP, host: HOST, place: f.hely }),
          motorIdopontok(await c2.newPage(), f.hely, f.s.szolg),
        ]);
        await c1.close(); await c2.close();
        const ma = Date.now() / 1000 + 35 * 60;
        const S = [...sal.idopontok].filter((u) => u > ma).map((u) => nap(u) + ' ' + hhmm(u)).sort();
        const M = [...mot.ki].sort();
        const maxS = S.length ? S[S.length - 1].slice(0, 10) : null, maxM = M.length ? M[M.length - 1].slice(0, 10) : null;
        const lim = maxS && maxM ? (maxS < maxM ? maxS : maxM) : null;
        const kozos = (x) => !lim || x.slice(0, 10) <= lim;
        const SS = new Set(S), MM = new Set(M);
        return { S, M, lim, csakS: S.filter((x) => kozos(x) && !MM.has(x)), csakM: M.filter((x) => kozos(x) && !SS.has(x)), sal, mot };
      };
      let r1 = await merj(), r2 = null;
      if ((r1.csakS.length || r1.csakM.length) && !r1.mot.hiba) { r2 = await merj(); }
      const igazS = r2 ? r1.csakS.filter((x) => r2.csakS.includes(x)) : r1.csakS, igazM = r2 ? r1.csakM.filter((x) => r2.csakM.includes(x)) : r1.csakM;
      eredmeny[f.kulcs] = { nev: f.s.nev, perc: f.s.perc, S: r1.S.length, M: r1.M.length, lim: r1.lim, csakS: igazS, csakM: igazM, elsoFutasCsakS: r1.csakS.length, elsoFutasCsakM: r1.csakM.length, ujrafutott: !!r2, salHiba: r1.sal.hiba || null, motHiba: r1.mot.hiba || null, motNincs: !!r1.mot.nincs, mp: Math.round((Date.now() - t0) / 1000) };
    } catch (e) { eredmeny[f.kulcs] = { nev: f.s.nev, hiba: String(e.message).slice(0, 160) }; }
    fs.writeFileSync(KIM, JSON.stringify(eredmeny, null, 1));
    const r = eredmeny[f.kulcs];
    console.log(Object.keys(eredmeny).length + '/' + feladatok.length, f.kulcs, (r.nev || '').slice(0, 30), r.hiba || `S=${r.S} M=${r.M} csakS=${r.csakS.length} csakM=${r.csakM.length}${r.motHiba ? ' motHiba:' + r.motHiba : ''}${r.salHiba ? ' salHiba:' + r.salHiba : ''}`, r.mp + 's');
  }
}
await Promise.all(Array.from({ length: PAR }, munka));
await b.close(); console.log('KESZ MP');
