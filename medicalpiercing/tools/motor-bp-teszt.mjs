// A motor budapesti ido-szamitasa (motor.js bp()) egyezik az Intl-es (Europe/Budapest) szamitassal: 2025-2031, 5 percenkent + a nyari/teli ido-valtas korul percenkent.
// node tools/motor-bp-teszt.mjs   (a motor.js-bol kiolvasott fuggvenyeket futtatja, nem masolatot)
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../assets/js/motor/motor.js', import.meta.url), 'utf8');
const i = src.indexOf('const DST = {};'), j = src.indexOf('const sb = ');
const bp = new Function(src.slice(i, j) + '; return bp;')();
const F = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const ref = (u) => { const p = Object.fromEntries(F.formatToParts(new Date(u * 1000)).map((x) => [x.type, x.value])); return { nap: `${p.year}-${p.month}-${p.day}`, ido: `${p.hour}:${p.minute}` }; };
let n = 0, rossz = 0; const peldak = [];
const ellenor = (u) => { n++; const a = bp(u), b = ref(u); if (a.nap !== b.nap || a.ido !== b.ido) { rossz++; if (peldak.length < 5) peldak.push([u, a.nap + ' ' + a.ido, b.nap + ' ' + b.ido]); } };
const t0 = Date.UTC(2025, 0, 1) / 1000, t1 = Date.UTC(2031, 0, 1) / 1000;
for (let u = t0; u < t1; u += 300) ellenor(u);
for (let ev = 2025; ev <= 2031; ev++) for (const ho of [2, 9]) { const u = Date.UTC(ev, ho, 20) / 1000; for (let k = 0; k < 12 * 24 * 60; k += 1) ellenor(u + k * 60); }
const t = process.hrtime.bigint(); for (let k = 0; k < 8000; k++) bp(t0 + k * 300); const us = Number(process.hrtime.bigint() - t) / 1000;
console.log(`${rossz ? 'HIBA' : 'OK  '} ${n} idopont egyezik az Intl-lel (${rossz} elteres)${peldak.length ? ' ' + JSON.stringify(peldak) : ''}; 8000 hivas: ${Math.round(us / 1000)} ms`);
process.exit(rossz ? 1 : 0);
