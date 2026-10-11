// A motor naptarat a Salonic sajat adataval veti ossze, MIND A 15 HELYSZINEN: ugyanazok a napok (az osszes honapban, a Salonic legtavolabbi napjaig)
// es ugyanazok az idopontok a legtavolabbi napon, mint a Salonic naptar-API-ban. (Debrecen: a decemberi idopontok hianyoztak, mert az ablak csak 62 nap volt.)
// Csak olvaso GET megy a Salonic fele; foglalas nincs (az adatlapig nem lep).
//
//   node tools/build.mjs && node tools/serve.mjs                   (masik ablakban)
//   node tools/motor-naptar-teszt.mjs [--csak 11424,6029] [--mobil] [--szolg 115575]
//   BASE=https://<elonezet> node tools/motor-naptar-teszt.mjs
import { chromium, devices } from './pw.mjs';
import { SZOLG_KATTINT } from './motor-teszt-segedek.mjs';
const BASE = (process.env.BASE || 'http://www.medicalpiercing.hu:4290').replace(/\/$/, '');
const ELES = !!process.env.BASE;
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const MOBIL = process.argv.includes('--mobil');
const SZOLG = arg('szolg') || '115575'; // Migren (Fejfajas / Migren Piercing)
const HELYEK = [6029, 11424, 13422, 14144, 10330, 10329, 10357, 12348, 12353, 12236, 9067, 12169, 14145, 14229, 12237];
const CSAK = arg('csak') ? arg('csak').split(',').map(Number) : HELYEK;
const CAL = '53089fd9-1f59-da3d-dc33-64e6c841f0c9';
const SZABAD = /^https:\/\/(medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
const b = await chromium.launch(ELES ? {} : { args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; return felt; };
const budapest = (u) => new Date(u * 1000).toLocaleString('sv-SE', { timeZone: 'Europe/Budapest' }); // "2026-12-21 10:35:00"

// a Salonic naptar-API-ja (ugyanaz a hivas, mint a motore, de 250 napra): { napok: Set, idok: Map(nap -> [HH:MM]) }
async function salonic(placeId, serviceId) {
  const base = Math.floor((Math.floor(Date.now() / 1000) - 3 * 3600) / 300) * 300;
  const p = new URLSearchParams({ startDate: base, offset: 0, days: 250, placeId, serviceId, employeeId: -1, calendarId: CAL, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0 });
  const j = await (await fetch('https://api.salonic.hu/calendar/getAvailableTimes?' + p)).json();
  if (j.status !== 'success') throw new Error('Salonic: ' + j.status);
  const minUnix = Math.floor(Date.now() / 1000) + 30 * 60;
  const idok = new Map();
  for (const pd of Object.values(j.data.blocks || {})) for (const [sid, k] of Object.entries(pd)) {
    if (sid === '-1') continue;
    for (const s of Object.values(k.slots || {})) { if (!(s.timestamp > minUnix)) continue; const [nap, ido] = budapest(+s.timestamp).split(' '); if (!idok.has(nap)) idok.set(nap, new Set()); idok.get(nap).add(ido.slice(0, 5)); }
  }
  return idok;
}

async function egy(placeId) {
  const nev = `${placeId} ${MOBIL ? 'mobil' : 'asztali'}`;
  const ctx = await b.newContext(MOBIL ? { ...devices['Pixel 5'], locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' });
  await ctx.route((u) => !u.toString().startsWith(BASE), (r) => (r.request().method() === 'GET' && SZABAD.test(r.request().url()) ? r.continue() : r.abort()));
  const p = await ctx.newPage();
  const jsHiba = []; p.on('pageerror', (e) => jsHiba.push(e.message));
  const sr = (fn, a) => p.evaluate(([fn, a]) => { const x = document.querySelector('[data-mp-motor]'); return x ? new Function('r', 'a', fn)(x.shadowRoot, a) : null; }, [fn, a]);
  const varj = async (felt, a, ms = 40000) => { for (let i = 0; i < ms / 200; i++) { if (await sr(felt, a)) return true; await p.waitForTimeout(200); } return false; };
  try {
    const [vart, ] = await Promise.all([salonic(placeId, SZOLG), p.goto(BASE + '/idopontfoglalas?motor=1', { waitUntil: 'load' })]);
    if (!ok(`${nev}: a tipus-valaszto megnyilik`, await varj('return !!r.querySelector("[data-tipus=uj]")'))) return;
    await sr('r.querySelector("[data-tipus=uj]").click()');
    await varj('return !!r.querySelector(`[data-hely="${a}"]`)', placeId);
    await sr('r.querySelector(`[data-hely="${a}"]`).click()', placeId);
    if (!ok(`${nev}: a piercing-lista betoltodik`, await varj('return !!r.querySelector("[data-szolg]")'))) return;
    if (!ok(`${nev}: a vizsgalt piercing megvan a szurok (Kinek? / Milyen szolgaltatas?) kozott`, await sr(SZOLG_KATTINT, SZOLG))) return;
    // az idopontok (az elso 21 nap, majd a tobbi) betoltese: addig var, amig a "tovabbi napok" jelzo el nem tunik
    const van = await varj('const ab=r.querySelector(".ablak"); return ab && ab.dataset.tovabbi==="0" && (r.querySelector("[data-slot]") || r.querySelector(".uzenet"))', null, 45000);
    if (!ok(`${nev}: az idopontok teljesen betoltodtek`, van)) return;
    if (!vart.size) { ok(`${nev}: a Salonicban nincs szabad idopont -> a motor is ezt irja`, await sr('return !!r.querySelector(".uzenet") && !r.querySelector("[data-slot]")')); return; }
    // vegiglapozza az osszes honapot, es osszegyujti a valaszthato napokat
    const kapott = new Set(); let utolsoNap = null;
    for (let i = 0; i < 8; i++) {
      for (const n of await sr('return [...r.querySelectorAll("[data-nap]")].map(x=>x.dataset.nap)')) kapott.add(n);
      const tovabb = await sr('const b=r.querySelector(".honap-fej button:last-child"); if(!b||b.disabled||!b.dataset.honap) return false; b.click(); return true');
      if (!tovabb) break;
      await p.waitForTimeout(80);
    }
    const vartNapok = [...vart.keys()].sort(), kaptNapok = [...kapott].sort();
    const ma = budapest(Math.floor(Date.now() / 1000)).slice(0, 10);
    const hianyzik = vartNapok.filter((n) => !kapott.has(n) && n !== ma), tobblet = kaptNapok.filter((n) => !vart.has(n) && n !== ma);
    ok(`${nev}: ugyanazok a napok, mint a Salonicban (${vartNapok.length} nap, ${vartNapok[0]} .. ${vartNapok[vartNapok.length - 1]})`, !hianyzik.length && !tobblet.length, [hianyzik.length ? 'a motorban hianyzik: ' + hianyzik.join(',') : '', tobblet.length ? 'a Salonicban nincs: ' + tobblet.join(',') : ''].filter(Boolean).join(' | '));
    // a legtavolabbi nap idopontjai
    utolsoNap = vartNapok[vartNapok.length - 1];
    await sr('const x=r.querySelector(`[data-nap="${a}"]`); if(x) x.click()', utolsoNap);
    await p.waitForTimeout(150);
    const motorIdok = new Set(await sr('return [...r.querySelectorAll("[data-slot]")].map(x=>x.textContent.trim())'));
    const salonicIdok = vart.get(utolsoNap);
    const elt = [...salonicIdok].filter((t) => !motorIdok.has(t)).concat([...motorIdok].filter((t) => !salonicIdok.has(t)));
    ok(`${nev}: a legtavolabbi nap (${utolsoNap}) idopontjai egyeznek (${salonicIdok.size} db)`, !elt.length, elt.length ? 'elteres: ' + elt.join(',') : '');
    ok(`${nev}: nincs JS-hiba`, !jsHiba.length, jsHiba.join(' | '));
  } catch (e) { ok(`${nev}: futas`, false, String(e).slice(0, 200)); }
  finally { await ctx.close(); }
}
for (const h of CSAK) await egy(h);
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
