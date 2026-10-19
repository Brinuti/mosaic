// TikTok kodos Schedule (Feri 2026-10-19): a koszonooldal SubmitForm + Schedule esemenyt kuld UGYANAZZAL az event_id-val,
// mint a szerver ('Foglalas:<placeId>|<employeeId>|<startDate>'); a divat fulpiercing (/fulbevalo-ok) nem kuld semmit.
//   node tools/build.mjs && node tools/serve.mjs &   majd   node tools/tiktok-schedule-pw.mjs
import { chromium } from './pw.mjs';
const PORT = +process.env.PORT || 4290;
const CIM = `http://www.medicalpiercing.hu:${PORT}`;
const START = 1900000000 + Math.floor(Math.random() * 1e6);
const BURL = `https://medicalpiercing.salonic.hu/guestData/?placeId=12169&serviceId=9001&employeeId=555&startDate=${START}`;
const koszono = (ut) => `${CIM}${ut}?first_booking=true&bookingUrl=${encodeURIComponent(BURL)}&price=24900`;
const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log((felt ? 'PASS ' : 'FAIL ') + nev + (info ? ' | ' + info : '')); if (!felt) hiba++; };
async function futtat(ut) {
  const ctx = await b.newContext();
  await ctx.addCookies([{ name: 'mp_suti', value: `v1-s1-m1-t${Math.floor(Date.now() / 1000)}`, domain: 'www.medicalpiercing.hu', path: '/' }]);
  await ctx.addInitScript(() => { window.__tt = []; window.ttq = { _i: { x: 1 }, track: (...a) => window.__tt.push(JSON.parse(JSON.stringify(a))), page() {}, load() {}, revokeConsent() {} }; });
  await ctx.route('**/*', (r) => { const u = r.request().url();
    if (u.startsWith(CIM + '/api/')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    if (u.startsWith(CIM)) return r.continue(); return r.abort(); });
  const p = await ctx.newPage(); await p.goto(koszono(ut), { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 2500));
  const tt = await p.evaluate(() => window.__tt); await ctx.close(); return tt;
}
// Az atallas elott a kapcsolo ki: a teszt ideiglenesen true-val futtatando (PW_SCHEDULE=1 nem kell, a build-et kell atirni)
const id = `Foglalas:12169|555|${START}`;
const gy = await futtat('/foglalas-ok');
const sf = gy.find((a) => a[0] === 'SubmitForm'), sc = gy.find((a) => a[0] === 'Schedule');
ok('1 gyogy: SubmitForm megy', !!sf, JSON.stringify(sf));
ok('2 gyogy: Schedule megy', !!sc, JSON.stringify(sc));
ok('3 azonos event_id a szerverrel', sc && sf && sc[2].event_id === id && sf[2].event_id === id);
ok('4 ertek HUF', sc && sc[1].value === 24900 && sc[1].currency === 'HUF');
ok('5 egyszer', gy.filter((a) => a[0] === 'Schedule').length === 1);
const di = await futtat('/fulbevalo-ok');
ok('6 divat: nincs Schedule/SubmitForm', !di.some((a) => a[0] === 'Schedule' || a[0] === 'SubmitForm'), JSON.stringify(di));
await b.close();
console.log(hiba ? `HIBA: ${hiba}` : 'MIND PASS'); process.exit(hiba ? 1 : 0);
