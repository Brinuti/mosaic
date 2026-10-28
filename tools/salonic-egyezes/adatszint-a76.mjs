// ADATSZINTU egyezes-meres (2026-10-28): az ELO motor-adapter listaja vs. a Salonic szakemberenkenti (teljes) naptar-adata. Hianyzo = a motor nem kinal egy Salonic-idopontot; tobblet = a motor olyat kinal, ami a szakember-lekeresben nincs.
// Hasznalat: node tools/salonic-egyezes/adatszint-a76.mjs [alap-url]; az alap-url alapbol az eles motor (a Playwright a /opt/node22/lib/node_modules-bol).
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'hu-HU', timezoneId: 'Europe/Budapest' });
const pg = await ctx.newPage();
const FIOK = [{ nev: 'Oktogon', host: 'https://a76.salonic.hu', placeId: 387, spec: 563, cal: '77b0c834-72fc-be7d-3f61-f5cd9a8378ca' }, { nev: 'Móricz', host: 'https://a76-moricz.salonic.hu', placeId: 733, spec: 1298, cal: '7bf81aa4-4a64-a029-bb60-cb71b53566af' }];
const out = [];
for (const F of FIOK) {
await pg.goto(F.host + '/privacy', { waitUntil: 'networkidle' });
out.push(...await pg.evaluate(async (f) => {
  const res = [];
  {
    const html = await (await fetch(`${f.host}/showServices/?placeId=${f.placeId}&specId=${f.spec}&lang=hu`, { credentials: 'omit' })).text();
    const svcs = [...html.matchAll(/<input[^>]*\bdata-id="(\d+)"[^>]*>/g)].map((m) => ({ id: m[1], emp: ((m[0].match(/data-employees="([^"]*)"/) || [])[1] || '').split(',').filter(Boolean), nev: ((m[0].match(/data-name="([^"]*)"/) || [])[1] || '').slice(0, 24) }));
    const url = (svc, emp, start, days) => 'https://api.salonic.hu/calendar/getAvailableTimes?' + new URLSearchParams({ startDate: start, offset: 0, days, placeId: f.placeId, serviceId: svc, employeeId: emp, calendarId: f.cal, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0 });
    const get = async (u) => { for (let i = 0; i < 4; i++) { try { return await (await fetch(u, { credentials: 'omit' })).json(); } catch (e) { await new Promise((r) => setTimeout(r, 1500 * (i + 1))); } } throw new Error('lekérés sikertelen'); };
    const slots = async (svc, emp, start, days) => { const j = await get(url(svc, emp, start, days)); const m = {}; for (const per of Object.values((j.data && j.data.blocks) || {})) for (const [st, k] of Object.entries(per)) { if (st === '-1') continue; for (const s of Object.values(k.slots || {})) (m[st] = m[st] || new Set()).add(s.timestamp); } return m; };
    const base = Math.floor((Math.floor(Date.now() / 1000) - 3 * 3600) / 300) * 300;
    for (const sv of svcs) {
      const plan = [[0, 7], [7, 14], [21, 59]]; // az A76 motor 'bárki' terve: 7 nap, majd (az elsőt megvárva) a 14 és 59 napos darab párhuzamosan
      const ids = sv.emp;
      // igazság: szakemberenként
      const igaz = {}; for (const id of ids) { igaz[id] = new Set(); for (const [o, n] of [[0, 50], [50, 50]]) { const m = await slots(sv.id, id, base + o * 86400, n); (m[id] || new Set()).forEach((x) => igaz[id].add(x)); } }
      const unioIgaz = new Set(Object.values(igaz).flatMap((s) => [...s]));
      for (let k = 1; k <= 3; k++) {
        const p0 = await slots(sv.id, -1, base, 7); const rest = await Promise.all(plan.slice(1).map(([o, n]) => slots(sv.id, -1, base + o * 86400, n))); const parts = [p0, ...rest];
        const any = {}; for (const m of parts) for (const [st, v] of Object.entries(m)) { any[st] = any[st] || new Set(); v.forEach((x) => any[st].add(x)); }
        const unioAny = new Set(Object.values(any).flatMap((s) => [...s]));
        const horizon = base + 80 * 86400;
        const hianyIdo = [...unioIgaz].filter((x) => x < horizon && !unioAny.has(x)).length;
        const hianySzak = ids.reduce((a, id) => a + [...igaz[id]].filter((x) => x < base + 80 * 86400 && !(any[id] || new Set()).has(x)).length, 0);
        res.push({ fiok: f.nev, szolg: `${sv.id} ${sv.nev}`, mer: k, szakember: ids.length, igazIdopont: [...unioIgaz].filter((x) => x < horizon).length, hianyzoKulonbozoIdopont: hianyIdo, hianyzoSzakemberSlot60nap: hianySzak });
      }
    }
  }
  return res;
}, F));
}
const rossz = out.filter((x) => x.hianyzoKulonbozoIdopont > 0 || x.hianyzoSzakemberSlot60nap > 0);
console.log('A76 – szolgáltatás × mérés:', out.length, '| összes igaz különböző időpont (mérésenként összegezve):', out.reduce((a, x) => a + x.igazIdopont, 0));
console.log('hiányzó különböző időpont ("bárki" mód):', out.reduce((a, x) => a + x.hianyzoKulonbozoIdopont, 0), '| hiányzó szakember-időpont (szakember szűrésnél, 60 nap):', out.reduce((a, x) => a + x.hianyzoSzakemberSlot60nap, 0));
console.log('eltérő sorok:', rossz.length ? JSON.stringify(rossz) : 'NINCS');
console.log(JSON.stringify([...new Set(out.map((x) => `${x.fiok}:${x.szolg}:${x.szakember}sz`))]));
await b.close();
