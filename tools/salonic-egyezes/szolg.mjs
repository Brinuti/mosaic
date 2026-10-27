import { chromium, ujKontextus, H, PLACE, BETTI } from './ui-lib.mjs';
import fs from 'node:fs';
const b = await chromium.launch();
const ctx = await ujKontextus(b); const p = await ctx.newPage();
await p.goto(`${H}/selectSpecialization/?placeId=${PLACE}&mh_nincs_atiranyitas=1`, { waitUntil: 'load' });
await p.waitForTimeout(1500);
const specs = await p.evaluate(() => [...new Map([...document.querySelectorAll('a[href*="showServices"]')].map(a => [a.getAttribute('href'), (a.closest('.card,div')?.innerText || '').split('\n')[0].trim().slice(0, 60)])).entries()]);
const out = [];
for (const [href, nev] of specs) {
  await p.goto(H + href + '&mh_nincs_atiranyitas=1', { waitUntil: 'load' });
  await p.waitForTimeout(700);
  const l = await p.evaluate(() => [...document.querySelectorAll('input[data-id]')].map(i => { const g = i.closest('.inputGroup'); return { id: i.dataset.id, perc: +i.dataset.duration, ar: +i.dataset.price, emp: (i.dataset.employees || '').split(','), nev: (g?.innerText || '').split('\n')[0].trim() }; }));
  const cim = await p.evaluate(() => (document.querySelector('h1,h2,h3,.specialization-title')?.textContent || '').trim());
  for (const s of l) out.push({ kat: href.match(/specId=(\d+)/)[1], ...s });
}
fs.writeFileSync(process.argv[2] + '/hair-szolg.json', JSON.stringify(out, null, 1));
for (const s of out) console.log(s.kat, s.id, s.perc + 'p', s.ar, s.emp.includes(BETTI) ? 'BETTI' : '-----', s.nev.slice(0, 80));
await b.close();
