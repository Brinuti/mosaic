// ADATSZINTU egyezes-meres (2026-10-28): az ELO motor-adapter listaja vs. a Salonic szakemberenkenti (teljes) naptar-adata. Hianyzo = a motor nem kinal egy Salonic-idopontot; tobblet = a motor olyat kinal, ami a szakember-lekeresben nincs.
// Hasznalat: node tools/salonic-egyezes/adatszint-mosaic.mjs [alap-url]; az alap-url alapbol az eles motor (a Playwright a /opt/node22/lib/node_modules-bol).
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'https://www.mosaicheadspa.hu';
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
const b = await chromium.launch();
const ctx = await b.newContext({ locale: 'hu-HU', timezoneId: 'Europe/Budapest' });
const pg = await ctx.newPage();
await pg.goto(`${BASE}/robots.txt`, { waitUntil: 'domcontentloaded' });
const out = await pg.evaluate(async ([BASE, ONLY]) => {
  const { createSalonicAdapter, BUSINESSES } = await import(`${BASE}/assets/js/booking-engine/salonic-adapter.js`);
  const ad = createSalonicAdapter({ cacheMs: 0 });
  const res = []; const hibak = [];
  for (const [biz, cfg] of Object.entries(BUSINESSES)) {
    if (ONLY.length && !ONLY.includes(biz)) continue;
    let svcs; try { svcs = await ad.getServices(biz); } catch (e) { hibak.push(`${biz} szolgáltatások: ${e.message}`); continue; }
    let cal = cfg.calendarId;
    if (!cal) { try { const h = await (await fetch(`${cfg.host}/selectDate/?employeeId=-1&placeId=${cfg.placeId}&serviceId=${svcs[0].serviceId}&lang=hu`, { credentials: 'omit' })).text(); cal = (h.match(/calendarId:\s*'([^']+)'/) || [])[1]; } catch (e) { /* */ } }
    if (!cal) { hibak.push(`${biz}: nincs naptár-azonosító`); continue; }
    const url = (svc, emp, start, days) => 'https://api.salonic.hu/calendar/getAvailableTimes?' + new URLSearchParams({ startDate: start, offset: 0, days, placeId: cfg.placeId, serviceId: svc, employeeId: emp, calendarId: cal, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0 });
    const igaz = async (svc, emp, base) => { const set = new Set(); for (const [o, n] of [[0, 50], [50, 50]]) { const j = await (await fetch(url(svc, emp, base + o * 86400, n), { credentials: 'omit' })).json(); for (const per of Object.values((j.data && j.data.blocks) || {})) for (const [st, k] of Object.entries(per)) { if (String(st) !== String(emp)) continue; for (const s of Object.values(k.slots || {})) set.add(s.timestamp); } } return set; };
    for (const sv of svcs) {
      const base = Math.floor((Math.floor(Date.now() / 1000) - 3 * 3600) / 300) * 300; const min = Math.floor(Date.now() / 1000) + 30 * 60;
      let motor; try { motor = await ad.getAvailability(biz, sv.serviceId, { days: 92, firstDays: 14, minLeadMinutes: 30, fresh: true }); } catch (e) { hibak.push(`${biz}/${sv.serviceId} motor: ${e.message}`); continue; }
      const mS = {}; for (const x of motor) (mS[x.staff_id] = mS[x.staff_id] || new Set()).add(x.start_unix);
      const ids = [...new Set([...(sv.staffIds || []), ...(cfg.employeeId ? [String(cfg.employeeId)] : []), ...Object.keys(mS)])];
      for (const id of ids) {
        const t = [...(await igaz(sv.serviceId, id, base))].filter((x) => x > min && x < base + 92 * 86400);
        const m = [...(mS[id] || new Set())].filter((x) => x < base + 92 * 86400);
        res.push({ biz, szolg: `${sv.serviceId} ${String(sv.name).slice(0, 22)}`, id, igaz: t.length, motor: t.filter((x) => m.includes(x)).length, hianyzik: t.filter((x) => !m.includes(x)).length, tobblet: m.filter((x) => !t.includes(x)).length });
      }
    }
  }
  return { res, hibak };
}, [BASE, ONLY]);
const rossz = out.res.filter((x) => x.hianyzik > 0 || x.tobblet > 0);
console.log('Mosaic – vizsgált üzletág×szolgáltatás×szakember:', out.res.length, '| igaz időpont:', out.res.reduce((a, x) => a + x.igaz, 0), '| hiányzó a motorból:', out.res.reduce((a, x) => a + x.hianyzik, 0), '| a motor többlete (a szakember-lekérésben nincs):', out.res.reduce((a, x) => a + x.tobblet, 0));
console.log('hibák:', out.hibak.length ? out.hibak.join(' | ') : 'nincs');
const per = {}; for (const x of out.res) { per[x.biz] = per[x.biz] || { sor: 0, igaz: 0, hianyzik: 0, tobblet: 0 }; per[x.biz].sor++; per[x.biz].igaz += x.igaz; per[x.biz].hianyzik += x.hianyzik; per[x.biz].tobblet += x.tobblet; }
console.log(JSON.stringify(per));
console.log('eltérő sorok:', rossz.length ? JSON.stringify(rossz.slice(0, 40)) : 'NINCS');
await b.close();
