// ADATSZINTU egyezes-meres (2026-10-28): az ELO motor-adapter listaja vs. a Salonic szakemberenkenti (teljes) naptar-adata. Hianyzo = a motor nem kinal egy Salonic-idopontot; tobblet = a motor olyat kinal, ami a szakember-lekeresben nincs.
// Hasznalat: node tools/salonic-egyezes/adatszint-gy.mjs [alap-url]; az alap-url alapbol az eles motor (a Playwright a /opt/node22/lib/node_modules-bol).
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'https://gyogytorna.pages.dev';
const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'hu-HU', timezoneId: 'Europe/Budapest' });
const pg = await ctx.newPage();
await pg.goto(`${BASE}/booking-test/?motor=1`, { waitUntil: 'domcontentloaded' });
const out = await pg.evaluate(async (BASE) => {
  const { createSalonicAdapter, HELYSZINEK, CALENDAR_ID } = await import(`${BASE}/assets/js/motor/salonic-adapter.js`);
  const ad = createSalonicAdapter({ cacheMs: 0 });
  const cal = CALENDAR_ID;
  const url = (place, svc, emp, start, days) => 'https://api.salonic.hu/calendar/getAvailableTimes?' + new URLSearchParams({ startDate: start, offset: 0, days, placeId: place, serviceId: svc, employeeId: emp, calendarId: cal, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0 });
  const igaz = async (place, svc, emp, base, days) => { const set = new Set(); for (const [o, n] of [[0, 50], [50, 50]]) { const j = await (await fetch(url(place, svc, emp, base + o * 86400, n), { credentials: 'omit' })).json(); for (const per of Object.values((j.data && j.data.blocks) || {})) for (const [st, k] of Object.entries(per)) { if (String(st) !== String(emp)) continue; for (const s of Object.values(k.slots || {})) set.add(s.timestamp); } } return set; };
  const res = [];
  for (const pid of Object.keys(HELYSZINEK)) {
    const svcs = await ad.getServices(+pid);
    for (const sv of svcs) {
      if (!sv.staffIds || !sv.staffIds.length) continue;
      const base = Math.floor((Math.floor(Date.now() / 1000) - 3 * 3600) / 300) * 300;
      const min = Math.floor(Date.now() / 1000);
      const motor = await ad.getAvailability(+pid, sv.serviceId, { days: 100, firstDays: 7, fresh: true });
      const mS = {}; for (const x of motor) (mS[x.staff_id] = mS[x.staff_id] || new Set()).add(x.start_unix);
      for (const id of sv.staffIds) {
        const t = [...(await igaz(+pid, sv.serviceId, id, base, 100))].filter((x) => x > min);
        const m = mS[id] || new Set();
        const hi = t.filter((x) => !m.has(x)).length;
        res.push({ hely: HELYSZINEK[pid].nev, szolg: `${sv.serviceId} ${sv.name.slice(0, 24)}`, id, igaz: t.length, motor: [...m].filter((x) => t.includes(x)).length, hianyzik: hi });
      }
    }
  }
  return res;
}, BASE);
const rossz = out.filter((x) => x.hianyzik > 0);
console.log('vizsgált szakember × szolgáltatás:', out.length, '| összes időpont (igaz):', out.reduce((a, x) => a + x.igaz, 0), '| hiányzó a motorból:', out.reduce((a, x) => a + x.hianyzik, 0));
console.log('hibás sorok:', rossz.length ? JSON.stringify(rossz) : 'NINCS');
console.log(JSON.stringify(out.filter((x) => x.szolg.startsWith('24667')).map((x) => `${x.hely.slice(-8)}/${x.id}:${x.motor}/${x.igaz}`)));
await b.close();
