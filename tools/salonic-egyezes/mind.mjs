// Betti osszes szolgaltatasa: Salonic-felulet (bongeszo, vendegkent) vs. a Mosaic foglalomotor. Eredmeny: JSON.
import fs from 'node:fs';
import { chromium, ujKontextus, salonicIdopontok, motorIdopontok, nap, hhmm, BETTI } from './ui-lib.mjs';
const D = process.argv[2], KIM = process.argv[3] || 'mind.json', PAR = +(process.argv[4] || 3);
const lista = JSON.parse(fs.readFileSync(D + '/hair-szolg.json', 'utf8')).filter((s) => s.emp.includes(BETTI));
const eredmeny = fs.existsSync(D + '/' + KIM) ? JSON.parse(fs.readFileSync(D + '/' + KIM, 'utf8')) : {};
const b = await chromium.launch();
const sor = lista.filter((s) => !eredmeny[s.id]);
let i = 0;
async function munka() {
  while (i < sor.length) {
    const s = sor[i++];
    const t0 = Date.now();
    try {
      const c1 = await ujKontextus(b), c2 = await ujKontextus(b);
      const [sal, mot] = await Promise.all([salonicIdopontok(await c1.newPage(), s.id), motorIdopontok(await c2.newPage(), s.id)]);
      await c1.close(); await c2.close();
      const ma = Math.floor(Date.now() / 1000);
      const S = [...sal.idopontok].filter((u) => u > ma + 35 * 60).map((u) => nap(u) + ' ' + hhmm(u));
      const M = [...mot.idopontok];
      const maxS = S.length ? S.map((x) => x.slice(0, 10)).sort().pop() : null;
      eredmeny[s.id] = { nev: s.nev, perc: s.perc, salonic: S.sort(), motor: M.sort(), maxSalDatum: maxS, salElerheto: sal.elerheto, salHiba: sal.hiba || null, motHiba: mot.hiba || null, motorValaszto: mot.valaszto, mp: Math.round((Date.now() - t0) / 1000), idopont: new Date().toISOString() };
    } catch (e) { eredmeny[s.id] = { nev: s.nev, perc: s.perc, hiba: String(e.message).slice(0, 200) }; }
    fs.writeFileSync(D + '/' + KIM, JSON.stringify(eredmeny, null, 1));
    console.log(Object.keys(eredmeny).length + '/' + lista.length, s.id, s.nev.slice(0, 50), eredmeny[s.id].hiba || `S=${eredmeny[s.id].salonic.length} M=${eredmeny[s.id].motor.length}`, eredmeny[s.id].mp + 's');
  }
}
await Promise.all(Array.from({ length: PAR }, munka));
await b.close();
console.log('KESZ');
