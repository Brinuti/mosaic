// ADATSZINTU egyezes-meres (2026-10-28): az ELO motor-adapter listaja vs. a Salonic szakemberenkenti (teljes) naptar-adata. Hianyzo = a motor nem kinal egy Salonic-idopontot; tobblet = a motor olyat kinal, ami a szakember-lekeresben nincs.
// Hasznalat: node tools/salonic-egyezes/adatszint-mp.mjs [alap-url]; az alap-url alapbol az eles motor (a Playwright a /opt/node22/lib/node_modules-bol).
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'https://www.medicalpiercing.hu';
const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'hu-HU', timezoneId: 'Europe/Budapest' });
const pg = await ctx.newPage();
await pg.goto(`${BASE}/robots.txt`, { waitUntil: 'domcontentloaded' });
const out = await pg.evaluate(async (BASE) => {
  const { createSalonicAdapter, HELYSZINEK, CALENDAR_ID } = await import(`${BASE}/assets/js/motor/salonic-adapter.js`);
  const ad = createSalonicAdapter({ cacheMs: 0 });
  const url = (place, svc, emp, start, days) => 'https://api.salonic.hu/calendar/getAvailableTimes?' + new URLSearchParams({ startDate: start, offset: 0, days, placeId: place, serviceId: svc, employeeId: emp, calendarId: CALENDAR_ID, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0 });
  const igaz = async (place, svc, emp, base) => { const set = new Set(); for (const [o, n] of [[0, 50], [50, 50]]) { const j = await (await fetch(url(place, svc, emp, base + o * 86400, n), { credentials: 'omit' })).json(); for (const per of Object.values((j.data && j.data.blocks) || {})) for (const [st, k] of Object.entries(per)) { if (String(st) !== String(emp)) continue; for (const s of Object.values(k.slots || {})) set.add(s.timestamp); } } return set; };
  const res = []; const hibak = [];
  for (const pid of Object.keys(HELYSZINEK)) {
    let svcs; try { svcs = await ad.getServices(+pid); } catch (e) { hibak.push(`${pid} szolgáltatások: ${e.message}`); continue; }
    for (const sv of svcs) {
      const base = Math.floor((Math.floor(Date.now() / 1000) - 3 * 3600) / 300) * 300; const min = Math.floor(Date.now() / 1000);
      let motor; try { motor = await ad.getAvailability(+pid, sv.serviceId, { days: 100, firstDays: 21, fresh: true }); } catch (e) { hibak.push(`${pid}/${sv.serviceId} motor: ${e.message}`); continue; }
      const mS = {}; for (const x of motor) (mS[x.staff_id] = mS[x.staff_id] || new Set()).add(x.start_unix);
      const ids = [...new Set([...(sv.staffIds || []), ...Object.keys(mS)])];
      for (const id of ids) {
        const t = [...(await igaz(+pid, sv.serviceId, id, base))].filter((x) => x > min);
        const m = mS[id] || new Set();
        res.push({ hely: HELYSZINEK[pid].varos, szolg: `${sv.serviceId} ${String(sv.name).slice(0, 22)}`, id, igaz: t.length, motor: t.filter((x) => m.has(x)).length, hianyzik: t.filter((x) => !m.has(x)).length, tobblet: [...m].filter((x) => !t.includes(x)).length, lista: (sv.staffIds || []).includes(id) });
      }
    }
  }
  return { res, hibak };
}, BASE);
const rossz = out.res.filter((x) => x.hianyzik > 0);
console.log('MP – vizsgált hely×szolgáltatás×szakember:', out.res.length, '| igaz időpont:', out.res.reduce((a, x) => a + x.igaz, 0), '| hiányzó a motorból:', out.res.reduce((a, x) => a + x.hianyzik, 0), '| a motor többlete (nem a szakember-lekérésben):', out.res.reduce((a, x) => a + x.tobblet, 0));
console.log('hibák:', out.hibak.length ? out.hibak.join(' | ') : 'nincs');
console.log('hiányos sorok:', rossz.length ? JSON.stringify(rossz) : 'NINCS');
const per = {}; for (const x of out.res) { per[x.hely] = per[x.hely] || { igaz: 0, hianyzik: 0 }; per[x.hely].igaz += x.igaz; per[x.hely].hianyzik += x.hianyzik; }
console.log(JSON.stringify(per));
await b.close();
