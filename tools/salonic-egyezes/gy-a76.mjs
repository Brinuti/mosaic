// Gyogytornaszom: Salonic-felulet (gyogytornaszomhu.salonic.hu, vendegkent) vs. a www.gyogytornaszom.hu foglalomotor, UGYANABBAN az idoben.
//   node gy.mjs <audit.json> <kimenet.json> [staff-minta: szolgaltatas/helyszin a szakemberenkenti vizsgalathoz]
import fs from 'node:fs';
import { chromium, ujKontextus, salonicIdopontok, nap, hhmm } from './ui-lib.mjs';
const [AUDIT, KIM, STAFF = '1'] = process.argv.slice(2);
const MOTOR = process.env.GY_MOTOR || 'https://www.gyogytornaszom.hu'; // A76: GY_MOTOR=https://www.a76.hu
const SZAK = process.env.SZAK_ATTR || 'szak'; // A76: SZAK_ATTR=szakember
const hostOf = (s) => `https://${s.fiok}.salonic.hu`;
const PAR = +(process.env.PAR || 2), HONAP = +(process.env.HONAP || 4);
const d = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const lista = [...new Map(d.map((s) => [s.hely + '|' + s.szolg, s])).values()];
const feladatok = [];
for (const s of lista) feladatok.push({ s, kulcs: `${s.hely}|${s.szolg}|any`, sal: '-1', szak: '' });
const b = await chromium.launch();
const eredmeny = fs.existsSync(KIM) ? JSON.parse(fs.readFileSync(KIM, 'utf8')) : {};

async function motorIdopontok(page, hely, szolg, szak, host) {
  const ki = new Set();
  const sr = (fn, a) => page.evaluate(([fn, a]) => { const x = [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('.fatyol')); return x ? new Function('r', 'a', fn)(x.shadowRoot, a) : null; }, [fn, a]);
  const varj = async (felt, a, ms = 40000) => { for (let i = 0; i < ms / 250; i++) { if (await sr(felt, a)) return true; await page.waitForTimeout(250); } return false; };
  for (let k = 0; k < 3; k++) { try { await page.goto(MOTOR + '/?motor=1', { waitUntil: 'domcontentloaded', timeout: 90000 }); break; } catch (e) { if (k === 2) throw e; await page.waitForTimeout(5000); } } await page.waitForTimeout(3500);
  await page.evaluate(([h, s, ho]) => { const a = document.createElement('a'); a.id = 'gyteszt'; a.href = `${ho}/selectDate/?placeId=${h}&serviceId=${s}`; a.textContent = 'x'; document.body.appendChild(a); a.click(); }, [hely, szolg, host]);
  if (!(await varj(`return !!r.querySelector("[data-${SZAK}]")`))) return { ki, hiba: 'nincs szakember-lepes' };
  await page.waitForTimeout(3000); // a motor hatterben tolti a szolgaltatas-adatokat: a tul korai valasztas "nincs szabad idopont" uzenetet ad
  await sr(`const x=r.querySelector('[data-${SZAK}="' + a + '"]') || r.querySelector('[data-${SZAK}]:not([data-${SZAK}=""])'); if(x) x.click()`, szak); // ha nincs "Barki" gomb (egyetlen szakember), az o kartyaja
  if (!(await varj('return !!r.querySelector("[data-nap]") || !!r.querySelector(".uzenet")', null, 60000))) return { ki, hiba: 'nincs naptar' };
  for (let i = 0; i < 60 && (await sr('return !!r.querySelector(".tovabbi")')); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(+(process.env.EXTRA_WAIT_MS || 0)); // A76: a motor a 3. (nagy) darabot kesobb tolti, es nincs "tovabbi" jelzo
  for (let ho = 0; ho < HONAP + 3; ho++) {
    const napok = await sr('return [...r.querySelectorAll("[data-nap]")].map(x=>x.dataset.nap)');
    for (const n of napok || []) {
      await sr('const x=r.querySelector(`[data-nap="${a}"]`); if(x) x.click()', n);
      await page.waitForTimeout(150);
      for (const u of (await sr('return [...r.querySelectorAll("[data-slot]")].map(x=>x.dataset.slot)')) || []) ki.add(nap(+u) + ' ' + hhmm(+u));
    }
    const tovabb = await sr('const bs=[...r.querySelectorAll("button[data-honap]")].filter(x=>x.dataset.honap); const nx=bs[bs.length-1]; if(!nx||nx.disabled) return false; nx.click(); return true');
    if (!tovabb) break;
    await page.waitForTimeout(500);
  }
  return { ki };
}

const sor = feladatok.filter((f) => !eredmeny[f.kulcs]).slice(0, +(process.env.MAXJOBS || 9999));
console.log('GY feladat:', feladatok.length, 'hatra:', sor.length);
let i = 0;
async function munka() {
  while (i < sor.length) {
    const f = sor[i++]; const t0 = Date.now();
    try {
      const merj = async (sekv = false) => {
        const c1 = await ujKontextus(b), c2 = await ujKontextus(b);
        let sal, mot;
        if (sekv) { // egymas utan: a Salonic naptar-API terheles alatt (egyszerre futo kerések) olykor ritkitott listat ad
          mot = await motorIdopontok(await c2.newPage(), f.s.hely, f.s.szolg, f.szak, hostOf(f.s));
          sal = await salonicIdopontok(await c1.newPage(), f.s.szolg, f.sal, { maxHonap: HONAP, host: hostOf(f.s), place: f.s.hely });
        } else {
          [sal, mot] = await Promise.all([
            salonicIdopontok(await c1.newPage(), f.s.szolg, f.sal, { maxHonap: HONAP, host: hostOf(f.s), place: f.s.hely }),
            motorIdopontok(await c2.newPage(), f.s.hely, f.s.szolg, f.szak, hostOf(f.s)),
          ]);
        }
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
      const van = (r) => r.csakS.length || r.csakM.length;
      const SEKV_CSAK = process.env.SEKV_CSAK === '1'; // terhelesmentes meres: mindig egymas utan
      let r1 = await merj(SEKV_CSAK), r2 = null, r3 = null;
      if (van(r1) && !r1.mot.hiba) r2 = await merj(SEKV_CSAK);
      if (r2 && van(r2)) r3 = await merj(true); // harmadik, egymas utani (terhelesmentes) meres dont
      const rs = [r1, r2, r3].filter(Boolean);
      const igaz = (k) => r1[k].filter((x) => rs.every((r) => r[k].includes(x)));
      eredmeny[f.kulcs] = { nev: f.s.nev, perc: f.s.perc, S: r1.S.length, M: r1.M.length, lim: r1.lim, csakS: igaz('csakS'), csakM: igaz('csakM'), elsoFutasCsakS: r1.csakS.length, elsoFutasCsakM: r1.csakM.length, masodikCsakS: r2 ? r2.csakS.length : null, masodikCsakM: r2 ? r2.csakM.length : null, sekvCsakS: r3 ? r3.csakS.length : null, sekvCsakM: r3 ? r3.csakM.length : null, ujrafutott: !!r2, salHiba: r1.sal.hiba || null, motHiba: r1.mot.hiba || null, mp: Math.round((Date.now() - t0) / 1000) };
    } catch (e) { eredmeny[f.kulcs] = { nev: f.s.nev, hiba: String(e.message).slice(0, 160) }; }
    fs.writeFileSync(KIM, JSON.stringify(eredmeny, null, 1));
    const r = eredmeny[f.kulcs];
    console.log(Object.keys(eredmeny).length + '/' + feladatok.length, f.kulcs, (r.nev || '').slice(0, 30), r.hiba || `S=${r.S} M=${r.M} csakS=${r.csakS.length} csakM=${r.csakM.length}${r.motHiba ? ' motHiba:' + r.motHiba : ''}${r.salHiba ? ' salHiba:' + r.salHiba : ''}`, r.mp + 's');
  }
}
await Promise.all(Array.from({ length: PAR }, munka));
await b.close(); console.log('KESZ GY');
