// Egy Mosaic-uzletag osszes szolgaltatasa: Salonic-felulet vs. foglalomotor, UGYANABBAN az idoben (parban). Hasznalat:
//   node fiok.mjs <audit.json> <uzletag> <salonic-host> <placeId> <kimenet.json> [mod: any|staff|all] [staffMinta]
import fs from 'node:fs';
import { chromium, ujKontextus, salonicIdopontok, motorIdopontok, nap, hhmm } from './ui-lib.mjs';
const [AUDIT, BIZ, HOST, PLACE, KIM, MOD = 'any', MINTA = '0'] = process.argv.slice(2);
const PAR = +(process.env.PAR || 3), HONAP = +(process.env.HONAP || 4);
const d = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
const lista = [...new Map(d.map((s) => [s.szolg, s])).values()];
const eredmeny = fs.existsSync(KIM) ? JSON.parse(fs.readFileSync(KIM, 'utf8')) : {};
const b = await chromium.launch();

async function szakemberek(sid) {
  const c = await ujKontextus(b); const p = await c.newPage(); let ki = [];
  try {
    await p.goto(`${HOST}/selectEmployee/?placeId=${PLACE}&serviceId=${sid}&mh_nincs_atiranyitas=1`, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(1500);
    if (/selectEmployee/.test(p.url())) ki = await p.evaluate(() => { const m = new Map(); for (const a of document.querySelectorAll('a[href*="selectDate"]')) { const id = (a.getAttribute('href').match(/employeeId=(\d+)/) || [])[1]; if (!id || +id <= 0) continue; const t = (a.innerText || '').trim(); if (t && !/^[\u00d6\u00f6]sszes|id[\u0151o]pont/i.test(t) && !m.get(id)) m.set(id, t); else if (!m.has(id)) m.set(id, ''); } return [...m].map(([id, nev]) => ({ id, nev })); });
  } catch (e) {}
  await c.close(); return ki;
}

const feladatok = [];
const nevek = new Map(); // employeeId -> nev
for (const s of lista) {
  if (MOD !== 'staff') feladatok.push({ s, kulcs: `${s.szolg}|any`, sal: '-1', mot: null });
}
if (MOD !== 'any') {
  const minta = +MINTA; const szamlalo = new Map();
  for (const s of lista) {
    const sz = (s.munkatarsak || []).length > 1 ? await szakemberek(s.szolg) : [];
    for (const e of sz) {
      nevek.set(e.id, e.nev);
      const n = szamlalo.get(e.id) || 0;
      if (minta && n >= minta) continue;
      szamlalo.set(e.id, n + 1);
      if (!(e.nev || '').trim()) { console.log('NEV HIANYZIK', s.szolg, e.id); continue; }
      feladatok.push({ s, kulcs: `${s.szolg}|${e.id}`, sal: e.id, mot: (/kedvezm/i.test(e.nev) ? (e.nev || '').trim().split(/\s+/)[0] : (e.nev || '').trim().split(/\s+/).pop()) || null, salNev: e.nev });
    }
  }
}
const sor = feladatok.filter((f) => !eredmeny[f.kulcs]);
console.log(BIZ, 'feladat:', feladatok.length, 'hatra:', sor.length);
let i = 0;
async function munka() {
  while (i < sor.length) {
    const f = sor[i++]; const t0 = Date.now();
    try {
      const merj = async (sekv = false) => {
        const c1 = await ujKontextus(b), c2 = await ujKontextus(b);
        let sal, mot;
        const sOpt = { maxHonap: HONAP, host: HOST, place: PLACE }, mOpt = { maxHonap: HONAP, business: BIZ };
        if (sekv) { // egymas utan (terhelesmentesen): a Salonic naptar-API sok egyideju keres alatt olykor ritkitott listat ad
          mot = await motorIdopontok(await c2.newPage(), f.s.szolg, f.mot, mOpt);
          sal = await salonicIdopontok(await c1.newPage(), f.s.szolg, f.sal, sOpt);
        } else {
          [sal, mot] = await Promise.all([salonicIdopontok(await c1.newPage(), f.s.szolg, f.sal, sOpt), motorIdopontok(await c2.newPage(), f.s.szolg, f.mot, mOpt)]);
        }
        await c1.close(); await c2.close();
        const ma = Date.now() / 1000 + 35 * 60;
        const S = [...sal.idopontok].filter((u) => u > ma).map((u) => nap(u) + ' ' + hhmm(u)).sort();
        const M = [...mot.idopontok].sort();
        const maxS = S.length ? S[S.length - 1].slice(0, 10) : null, maxM = M.length ? M[M.length - 1].slice(0, 10) : null;
        const lim = maxS && maxM ? (maxS < maxM ? maxS : maxM) : null;
        const kozos = (x) => !lim || x.slice(0, 10) <= lim;
        const SS = new Set(S), MM = new Set(M);
        return { S, M, lim, csakS: S.filter((x) => kozos(x) && !MM.has(x)), csakM: M.filter((x) => kozos(x) && !SS.has(x)), sal, mot };
      };
      const van = (r) => r.csakS.length || r.csakM.length;
      let r1 = await merj(), r2 = null, r3 = null;
      if (van(r1)) r2 = await merj();
      if (r2 && van(r2)) r3 = await merj(true);
      const rs = [r1, r2, r3].filter(Boolean);
      const igaz = (k) => r1[k].filter((x) => rs.every((r) => r[k].includes(x)));
      eredmeny[f.kulcs] = { nev: f.s.nev, perc: f.s.perc, mod: f.mot || 'any', salNev: f.salNev || null, S: r1.S.length, M: r1.M.length, lim: r1.lim, csakS: igaz('csakS'), csakM: igaz('csakM'), elsoFutasCsakS: r1.csakS.length, elsoFutasCsakM: r1.csakM.length, masodikCsakS: r2 ? r2.csakS.length : null, masodikCsakM: r2 ? r2.csakM.length : null, sekvCsakS: r3 ? r3.csakS.length : null, sekvCsakM: r3 ? r3.csakM.length : null, ujrafutott: !!r2, salHiba: r1.sal.hiba || (r1.sal.elerheto === false ? 'nem elerheto' : null), motHiba: r1.mot.hiba || null, valaszto: r1.mot.valaszto, mp: Math.round((Date.now() - t0) / 1000) };
    } catch (e) { eredmeny[f.kulcs] = { nev: f.s.nev, hiba: String(e.message).slice(0, 160) }; }
    fs.writeFileSync(KIM, JSON.stringify(eredmeny, null, 1));
    const r = eredmeny[f.kulcs];
    console.log(Object.keys(eredmeny).length + '/' + feladatok.length, f.kulcs, (r.nev || '').slice(0, 28), r.hiba || `S=${r.S} M=${r.M} csakS=${r.csakS.length} csakM=${r.csakM.length}${r.salHiba ? ' salHiba:' + r.salHiba : ''}${r.motHiba ? ' motHiba:' + r.motHiba : ''}`, r.mp + 's');
  }
}
await Promise.all(Array.from({ length: PAR }, munka));
await b.close(); console.log('KESZ', BIZ);
