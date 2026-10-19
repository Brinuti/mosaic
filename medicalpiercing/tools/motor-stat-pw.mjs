// Foglalomotor lepes-statisztika (Feri 2026-10-19): a motor nyitasakor / lepeskor / bezaraskor nevtelen jelzes megy az /api/mp-motor-stat-ra.
//   node tools/build.mjs && node tools/serve.mjs &   majd   node tools/motor-stat-pw.mjs
import { chromium } from './pw.mjs';
const PORT = +process.env.PORT || 4290;
const CIM = `http://www.medicalpiercing.hu:${PORT}`;
const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
let hiba = 0; const ok = (n, f, i = '') => { console.log((f ? 'PASS ' : 'FAIL ') + n + (i ? ' | ' + i : '')); if (!f) hiba++; };
const ctx = await b.newContext({ viewport: { width: 390, height: 800 } });
const jel = [];
await ctx.route('**/*', (r) => { const u = r.request().url();
  if (u.startsWith(CIM + '/api/mp-motor-stat')) { jel.push(JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: 204 }); }
  if (u.startsWith(CIM)) return r.continue(); return r.abort(); });
const p = await ctx.newPage();
await p.goto(`${CIM}/idopontfoglalas`, { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 2500));
ok('1 nyit jelzes', jel.some((j) => j.e === 'nyit'), JSON.stringify(jel));
ok('2 elso lepes jelzes', jel.some((j) => j.e === 'lepes' && j.l));
ok('3 mobil jeloles', jel.every((j) => j.m === 1));
ok('4 nincs szemelyes / URL adat', jel.every((j) => Object.keys(j).every((k) => ['e', 'l', 'm'].includes(k))));
const n0 = jel.length;
await p.evaluate(() => { const h = document.querySelector('[data-mp-motor]') || [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('[data-bezar]')); h && h.shadowRoot.querySelector('[data-bezar]').click(); });
await new Promise((r) => setTimeout(r, 800));
ok('5 bezar jelzes a lepessel', jel.slice(n0).some((j) => j.e === 'bezar' && j.l), JSON.stringify(jel.slice(n0)));
await b.close(); console.log(hiba ? `HIBA: ${hiba}` : 'MIND PASS'); process.exit(hiba ? 1 : 0);
