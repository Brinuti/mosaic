// Mosaic PMU: Salonic-felulet (mosaic-pmu, Melitta) vs. a /foglalo-motor?business=pmu (kezelesvalaszto -> idopont). Korrekcio: a motor szandekosan elrejti.
import fs from 'node:fs';
import { chromium, ujKontextus, salonicIdopontok, nap, hhmm, MOTOR } from './ui-lib.mjs';
const KIM = process.argv[2] || 'pmu-eredmeny.json', HONAP = 4;
const KARTYA = { 471160: /Személyes konzultáció/, 471034: /Aquarell/, 471152: /Rúzs hatású/, 471153: /Hibrid/, 471154: /Soft powder/, 481061: /Szempilla sűrítés/, 481062: /Füstös/ };
const b = await chromium.launch();
const eredmeny = fs.existsSync(KIM) ? JSON.parse(fs.readFileSync(KIM, 'utf8')) : {};
async function motor(sid) {
  const ki = new Set(); const p = await (await ujKontextus(b)).newPage();
  await p.goto(`${MOTOR}/foglalo-motor?business=pmu&service=${sid}`, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForTimeout(3000);
  await p.getByText(/IDŐPONTOT FOGLALOK/i).first().waitFor({ timeout: 60000 }); await p.getByText(/IDŐPONTOT FOGLALOK/i).first().click({ force: true }); await p.waitForTimeout(2500);
  await p.getByText(KARTYA[sid]).first().click({ force: true });
  const van = await p.waitForSelector('.nnap', { state: 'attached', timeout: 60000 }).then(() => true).catch(() => false);
  if (!van) return { ki, hiba: 'nincs naptar' };
  await p.waitForTimeout(3000);
  const HON = { januar: 1, februar: 2, marcius: 3, aprilis: 4, majus: 5, junius: 6, julius: 7, augusztus: 8, szeptember: 9, oktober: 10, november: 11, december: 12 };
  const ek = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const latott = new Set();
  for (let ho = 0; ho < HONAP; ho++) {
    const m = (await p.evaluate(() => document.body.innerText)).match(/(20\d\d)\.\s*([A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]+)/); if (!m) break;
    const ev = +m[1], hon = HON[ek(m[2])];
    for (const d of await p.evaluate(() => [...document.querySelectorAll('.nnap:not([disabled])')].map((e) => e.textContent.trim()).filter(Boolean))) { // az ures kitoltocellak nem napok (korabban hamis "-00" kulcsot adtak)
      const k = `${ev}-${hon}-${d}`; if (latott.has(k)) continue; latott.add(k);
      await p.locator('.nnap:not([disabled])', { hasText: new RegExp('^' + d + '$') }).first().click({ force: true }); await p.waitForTimeout(250);
      for (const t of await p.evaluate(() => [...document.querySelectorAll('.idogomb')].map((e) => e.textContent.trim()))) ki.add(`${ev}-${String(hon).padStart(2, '0')}-${String(d).padStart(2, '0')} ${t}`);
    }
    const kov = p.locator('#kovetkezo-honap').first();
    if (!(await kov.count()) || (await kov.isDisabled().catch(() => false))) break;
    await kov.click({ force: true }); await p.waitForTimeout(700);
  }
  return { ki };
}
async function ui(sid) { const p = await (await ujKontextus(b)).newPage(); return salonicIdopontok(p, sid, '-1', { maxHonap: HONAP, host: 'https://mosaic-pmu.salonic.hu', place: 14585 }); }
for (const sid of Object.keys(KARTYA)) {
  if (eredmeny[sid]) continue;
  const t0 = Date.now();
  const merj = async (sekv) => {
    let s, m;
    if (sekv) { m = await motor(sid); s = await ui(sid); } else [s, m] = await Promise.all([ui(sid), motor(sid)]);
    const ma = Date.now() / 1000 + 35 * 60;
    const S = [...s.idopontok].filter((u) => u > ma).map((u) => nap(u) + ' ' + hhmm(u)).sort(), M = [...m.ki].sort();
    const mx = (a) => (a.length ? a[a.length - 1].slice(0, 10) : null); const lim = mx(S) && mx(M) ? (mx(S) < mx(M) ? mx(S) : mx(M)) : null;
    const k = (x) => !lim || x.slice(0, 10) <= lim; const SS = new Set(S), MM = new Set(M);
    return { S, M, lim, csakS: S.filter((x) => k(x) && !MM.has(x)), csakM: M.filter((x) => k(x) && !SS.has(x)), hiba: m.hiba };
  };
  try {
    const r1 = await merj(false); let r2 = null, r3 = null; const van = (r) => r.csakS.length || r.csakM.length;
    if (van(r1) && !r1.hiba) r2 = await merj(false); if (r2 && van(r2)) r3 = await merj(true);
    const rs = [r1, r2, r3].filter(Boolean); const igaz = (kk) => r1[kk].filter((x) => rs.every((r) => r[kk].includes(x)));
    eredmeny[sid] = { S: r1.S.length, M: r1.M.length, lim: r1.lim, csakS: igaz('csakS'), csakM: igaz('csakM'), elsoCsakS: r1.csakS.length, elsoCsakM: r1.csakM.length, ujrafutott: !!r2, motHiba: r1.hiba || null, mp: Math.round((Date.now() - t0) / 1000) };
  } catch (e) { eredmeny[sid] = { hiba: String(e.message).slice(0, 150) }; }
  fs.writeFileSync(KIM, JSON.stringify(eredmeny, null, 1));
  const r = eredmeny[sid]; console.log(sid, r.hiba || `S=${r.S} M=${r.M} csakS=${r.csakS.length} csakM=${r.csakM.length} ${r.motHiba || ''}`);
}
await b.close(); console.log('KESZ PMU');
