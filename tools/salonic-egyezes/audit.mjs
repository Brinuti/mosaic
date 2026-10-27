// Salonic kezdesi-racs audit: minden fiok / helyszin / szolgaltatas: milyen lepeskozzel ajanl kezdesi idopontot (a Salonic nyilvanos felulete, csak olvasas).
// Hasznalat: node audit.mjs <kimeneti-konyvtar> <fiok> [maxSzolgaltatas]
import fs from 'node:fs';
import { chromium, ujKontextus, nap, hhmm } from './ui-lib.mjs';

const D = process.argv[2], FIOK = process.argv[3], MAX = +(process.argv[4] || 999), PAR = +(process.env.PAR || 3);
const H = `https://${FIOK}.salonic.hu`;
const NYITO = 'mh_nincs_atiranyitas=1';
const ma = Math.floor(Date.now() / 1000);

const b = await chromium.launch();

async function felfedez() {
  const ctx = await ujKontextus(b); const p = await ctx.newPage();
  await p.goto(`${H}/booking/start?${NYITO}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(2500);
  const helyek = new Map();
  const gyujt = async () => { for (const h of await p.evaluate(() => [...document.querySelectorAll('a[href*="placeId="]')].map((a) => [a.getAttribute('href'), (a.innerText || a.textContent || '').trim().split('\n')[0].slice(0, 60)]))) { const m = h[0].match(/placeId=(\d+)/); if (m && !helyek.has(m[1])) helyek.set(m[1], h[1]); } const u = p.url().match(/placeId=(\d+)/); if (u && !helyek.has(u[1])) helyek.set(u[1], ''); };
  await gyujt();
  if (!helyek.size || /selectLocation/.test(p.url())) { await p.goto(`${H}/selectLocation/?${NYITO}`, { waitUntil: 'load' }); await p.waitForTimeout(1500); await gyujt(); }
  await ctx.close();
  return helyek;
}

async function szolgaltatasok(placeId) {
  const ctx = await ujKontextus(b); const p = await ctx.newPage();
  await p.goto(`${H}/selectSpecialization/?placeId=${placeId}&${NYITO}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(1500);
  let specs = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/showServices"]')].map((a) => a.getAttribute('href')))]);
  const ki = new Map();
  const olvas = () => p.evaluate(() => [...document.querySelectorAll('input[data-id]')].map((i) => { const g = i.closest('.inputGroup'); return { id: i.dataset.id, perc: +i.dataset.duration, ar: +i.dataset.price, emp: (i.dataset.employees || '').split(',').filter(Boolean), nev: (g?.innerText || '').split('\n')[0].trim().slice(0, 90) }; }));
  if (!specs.length && /showServices|employees/.test(p.url())) for (const s of await olvas()) ki.set(s.id, s);
  for (const href of specs) {
    await p.goto(H + href + (href.includes('?') ? '&' : '?') + NYITO, { waitUntil: 'load' });
    await p.waitForTimeout(700);
    for (const s of await olvas()) if (!ki.has(s.id)) ki.set(s.id, { ...s, spec: (href.match(/specId=(\d+)/) || [])[1] });
  }
  await ctx.close();
  return [...ki.values()];
}


async function munkatarsakKeres(placeId, serviceId) {
  const ctx = await ujKontextus(b); const p = await ctx.newPage(); let ki = [];
  try {
    await p.goto(`${H}/selectEmployee/?placeId=${placeId}&serviceId=${serviceId}&${NYITO}`, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(1500);
    const u = p.url().match(/employeeId=(\d+)/);
    if (u) ki = [u[1]];
    else ki = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="selectDate"]')].map((a) => (a.getAttribute('href').match(/employeeId=(\d+)/) || [])[1]).filter(Boolean))]);
  } catch (e) { /* -1 lesz */ }
  await ctx.close();
  return ki;
}

async function mintaz(placeId, s, emp) {
  const ctx = await ujKontextus(b); const p = await ctx.newPage();
  const napok = [];
  try {
    await p.goto(`${H}/selectDate/?employeeId=${emp}&placeId=${placeId}&serviceId=${s.id}&${NYITO}`, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(3500);
    const kattinthato = () => p.evaluate(() => [...document.querySelectorAll('.mbsc-calendar-slide-active .mbsc-calendar-cell:not(.mbsc-calendar-day-outer) [role=button][aria-label]')].filter((e) => e.getAttribute('aria-disabled') !== 'true').map((e) => e.getAttribute('aria-label')));
    let lista = await kattinthato();
    if (lista.length < 6) { await p.click('.mbsc-calendar-button-next', { force: true }).catch(() => {}); await p.waitForTimeout(3000); lista = lista.concat(await kattinthato()); }
    // a 3. naptol (a maihoz kozeli napok reszlegesek), egyenletesen szorva, legfeljebb 4 nap
    const v = lista.slice(2); const kivalasztott = v.length <= 4 ? v : [0, 1, 2, 3].map((i) => v[Math.floor((i * (v.length - 1)) / 3)]);
    const HON = { januar: 1, februar: 2, marcius: 3, aprilis: 4, majus: 5, junius: 6, julius: 7, augusztus: 8, szeptember: 9, oktober: 10, november: 11, december: 12 };
    const ek = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const label of kivalasztott) {
      const m = label.match(/([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]+) (\d{1,2}), (\d{4})$/); if (!m) continue;
      const cel = `${m[3]}-${String(HON[ek(m[1])]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
      let aktiv = await p.locator(`.mbsc-calendar-slide-active .mbsc-calendar-cell:not(.mbsc-calendar-day-outer) [role=button][aria-label="${label}"]`).count();
      if (!aktiv) { await p.click('.mbsc-calendar-button-next', { force: true }).catch(() => {}); await p.waitForTimeout(2000); aktiv = await p.locator(`.mbsc-calendar-slide-active .mbsc-calendar-cell:not(.mbsc-calendar-day-outer) [role=button][aria-label="${label}"]`).count(); }
      if (!aktiv) continue;
      let ol = [];
      const olvasN = () => p.evaluate(() => [...document.querySelectorAll('a[href*="guestData"]')].map((a) => +new URL(a.href).searchParams.get('startDate')));
      for (let proba = 0; proba < 3 && !ol.length; proba++) {
        await p.waitForTimeout(proba ? 1500 : 700);
        await p.locator(`.mbsc-calendar-slide-active .mbsc-calendar-cell:not(.mbsc-calendar-day-outer) [role=button][aria-label="${label}"]`).first().click({ force: true });
        for (let i = 0; i < 20; i++) { await p.waitForTimeout(250); ol = (await olvasN()).filter((u) => nap(u) === cel); if (ol.length) break; }
      }
      if (ol.length) { await p.waitForTimeout(500); ol = (await olvasN()).filter((u) => nap(u) === cel); }
      napok.push({ nap: cel, kezdesek: [...new Set(ol)].sort().map(hhmm) });
    }
  } catch (e) { napok.push({ hiba: String(e.message).slice(0, 100) }); }
  await ctx.close();
  return napok;
}

const helyek = await felfedez();
console.log(FIOK, 'helyszinek:', [...helyek].map(([k, v]) => `${k}${v ? ' ' + v : ''}`).join(' | '));
const eredmeny = [];
for (const [placeId, helyNev] of helyek) {
  const lista = (await szolgaltatasok(placeId)).slice(0, MAX);
  console.log(`  ${placeId} ${helyNev}: ${lista.length} szolgaltatas`);
  let i = 0;
  await Promise.all(Array.from({ length: PAR }, async () => {
    while (i < lista.length) {
      const s = lista[i++];
      if (!s.emp.length) s.emp = await munkatarsakKeres(placeId, s.id); // a Salonic nem irta ki a data-employees-t: a szakember-valasztobol
      const emp = s.emp[0] ?? '-1';
      const napok = await mintaz(placeId, s, emp);
      eredmeny.push({ fiok: FIOK, hely: placeId, helyNev, szolg: s.id, nev: s.nev, perc: s.perc, ar: s.ar, elsoMunkatars: emp, munkatarsak: s.emp, napok });
      console.log(`    ${s.id} ${s.perc}p ${s.nev.slice(0, 40)} | ${napok.map((n) => (n.kezdesek || []).length).join(',')}`);
    }
  }));
  fs.writeFileSync(`${D}/audit-${FIOK}.json`, JSON.stringify(eredmeny));
}
await b.close();
console.log('KESZ', FIOK, eredmeny.length);
