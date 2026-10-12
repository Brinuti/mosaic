// A foglalomotor funkcionalis tesztje MIND A 15 HELYSZINRE, asztalon es mobilon (valodi foglalas NELKUL: az adatlap kereset eldobjuk,
// igy a Salonic az idopontot sem foglalja le; a Salonic felé csak olvaso GET megy).
//
//   node tools/build.mjs && node tools/serve.mjs     (masik ablakban)
//   node tools/motor-helyszin-teszt.mjs [--csak 6029,12169] [--mobil|--asztali]      (alap: mindket nezet)
//   BASE=https://<elonezet> node tools/motor-helyszin-teszt.mjs                      (elonezeten / elesben ?motor=1-gyel)
//
// Helyszinenkent: a motor a helyszint kinalja; a kezelesek listaja es ara egyezik a Salonic-leképezéssel
// (tools/mp-salonic-lekepezes.json; az eltérést kiírja); van szabad idopont (Miskolcon a "nincs szabad idopont" uzenet a jo);
// a szakember-valaszto; a legtavolabbi nap legkesobbi idopontjara az adatlap cime helyes (placeId, serviceId, startDate =
// a valasztott idopont, lang=hu, back=mb_...); mobilon a keret a kepernyo aljaig er, a lepesjelzo rejtve.
import { chromium, devices } from './pw.mjs';
import { MINDEN_SZOLG, SZOLG_KATTINT } from './motor-teszt-segedek.mjs';
import fs from 'node:fs';
const BASE = (process.env.BASE || 'http://localhost:4290').replace(/\/$/, '');
const arg = (k) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const LEK = JSON.parse(fs.readFileSync(new URL('./mp-salonic-lekepezes.json', import.meta.url), 'utf8'));
const CSAK = arg('csak') ? arg('csak').split(',').map(Number) : null;
const NEZETEK = process.argv.includes('--mobil') ? [true] : process.argv.includes('--asztali') ? [false] : [false, true];
const SZABAD = /^https:\/\/(medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
const b = await chromium.launch();
let hiba = 0; const sorok = [];
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; return felt; };

async function egy(h, mobil) {
  const nev = `${h.varos} (${h.place_id}) ${mobil ? 'mobil' : 'asztali'}`;
  const ctx = await b.newContext(mobil ? { ...devices['Pixel 5'], locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' });
  await ctx.route((u) => !u.toString().startsWith(BASE), (r) => (r.request().method() === 'GET' && SZABAD.test(r.request().url()) ? r.continue() : r.abort()));
  const p = await ctx.newPage();
  const jsHiba = []; p.on('pageerror', (e) => jsHiba.push(e.message));
  const sr = (fn, a) => p.evaluate(([fn, a]) => { const x = document.querySelector('[data-mp-motor]'); return x ? new Function('r', 'a', fn)(x.shadowRoot, a) : null; }, [fn, a]);
  const varj = async (sel, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await sr('return !!r.querySelector(a)', sel)) return true; await p.waitForTimeout(250); } return false; };
  const sor = { helyszin: h.varos, placeId: h.place_id, nezet: mobil ? 'mobil' : 'asztali' };
  try {
    await p.goto(BASE + '/a-migren-piercing-gyogyulasi-ideje?motor=1', { waitUntil: 'load' });
    await p.evaluate(() => { const l = [...document.querySelectorAll('a[href*="medicalpiercing.salonic.hu/selectLocation"]')]; (l.find((x) => x.offsetParent) || l[0]).click(); });
    for (let i = 0; i < 100; i++) { if (await sr('return !!r.querySelector("[data-hely]")')) break; if (await sr('const t=r.querySelector(\'[data-tipus="uj"]\'); if (t) { t.click(); return true; } return false')) break; await p.waitForTimeout(250); }
    if (!ok(`${nev}: a motor megnyilik, a helyszin kozte van`, await varj(`[data-hely="${h.place_id}"]`))) return sor;
    await sr('r.querySelector(`[data-hely="${a}"]`).click()', h.place_id);
    if (!ok(`${nev}: a kezelesek betoltodnek`, await varj('[data-szolg]'))) return sor;
    const kezelesek = await sr(MINDEN_SZOLG); // az osszes szuro-kombinaciobol
    const vart = h.szolgaltatasok.map((s) => s.service_id);
    const kapott = kezelesek.map((k) => k.id);
    const hianyzik = vart.filter((x) => !kapott.includes(x)), tobblet = kapott.filter((x) => !vart.includes(x));
    const arElteres = kezelesek.filter((k) => { const s = h.szolgaltatasok.find((x) => x.service_id === k.id); return s && s.ar && String(s.ar) !== k.ar; }).map((k) => `${k.nev}: ${k.ar}`);
    sor.kezelesek = kapott.length;
    ok(`${nev}: ${kapott.length} kezeles, egyezik a lekepezessel (azonositok, arak)`, !hianyzik.length && !tobblet.length && !arElteres.length, [hianyzik.length ? 'hianyzik: ' + hianyzik.join(',') : '', tobblet.length ? 'uj: ' + tobblet.join(',') : '', arElteres.length ? 'ar: ' + arElteres.join('; ') : ''].filter(Boolean).join(' | '));
    // a leggyakoribb kezeles (Migren), ha nincs, az elso, amelyre a lekepezes szerint van idopont
    const cel = h.szolgaltatasok.find((s) => s.service_id === '115575' && s.szabad_60_nap > 0) || h.szolgaltatasok.find((s) => s.szabad_60_nap > 0) || h.szolgaltatasok[0];
    sor.kezeles = cel.nev;
    await sr(SZOLG_KATTINT, cel.service_id);
    const vanIdo = await varj('[data-slot], .uzenet', 35000) && await sr('return !!r.querySelector("[data-slot]")');
    // az elo allapot dont (a lekepezes ota a szalon megnyithatott / lezarhatott napokat): nincs idopont -> az uzenet es a tovabblepes
    if (!vanIdo) { sor.idopont = 'nincs' + (cel.szabad_60_nap > 0 ? ' (a lekepezes szerint volt!)' : ''); ok(`${nev}: ${cel.nev} - nincs szabad idopont: a motor ezt irja ki, masik kezelest / helyszint kinal`, await sr('const u=r.querySelector(".uzenet"); return !!u && /nincs szabad időpont/.test(u.textContent) && !!r.querySelector(".tartalom [data-lepes=hely]")')); return sor; }
    if (!(cel.szabad_60_nap > 0)) sor.megjegyzes = 'a lekepezeskor nem volt idopont, most van';
    ok(`${nev}: ${cel.nev} - van szabad idopont${sor.megjegyzes ? ' (' + sor.megjegyzes + ')' : ''}`, true);
    sor.szakemberek = await sr('return r.querySelectorAll("[data-staff]").length');
    ok(`${nev}: szakember-valaszto (Barki + nevek), ha tobb munkatars van`, sor.szakemberek === 0 || sor.szakemberek >= 3, String(sor.szakemberek));
    // ha csak egy szakember van: nem valasztatjuk, de kijelolve, fejkeppel (vagy monogrammal) mutatjuk, hogy a vendeg lassa, kihez megy
    if (sor.szakemberek === 0) {
      const egy = await sr('const c=r.querySelector(".chip.egy"); return c ? { nev: c.textContent.trim(), fejkep: !!c.querySelector(".fejkep"), valaszthato: !!r.querySelector("[data-staff]") } : null');
      ok(`${nev}: egy szakember: kijelolve, fejkeppel latszik, nem valaszthato`, !!egy && egy.fejkep && !egy.valaszthato && egy.nev.length > 0, JSON.stringify(egy));
    }
    await p.waitForTimeout(3000); // a tovabbi napok betoltese
    for (let i = 0; i < 4; i++) { const t = await sr('const b=[...r.querySelectorAll("[data-honap]")].pop(); if(!b||b.disabled||!b.dataset.honap) return false; b.click(); return true'); if (!t) break; await p.waitForTimeout(600); }
    await sr('[...r.querySelectorAll("[data-nap]")].pop().click()');
    await p.waitForTimeout(500);
    const slot = await sr('const s=[...r.querySelectorAll("[data-slot]")].pop(); return s ? +s.dataset.slot : null');
    sor.idopont = new Date(slot * 1000).toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' });
    await sr('[...r.querySelectorAll("[data-slot]")].pop().click()');
    if (!ok(`${nev}: adatlap`, await varj('iframe.adatlap'))) return sor;
    const u = new URL(await sr('return r.querySelector("iframe.adatlap").src'));
    ok(`${nev}: adatlap cime (guestData, placeId, serviceId, startDate = a valasztott idopont, lang=hu, back=mb_)`, u.hostname === 'medicalpiercing.salonic.hu' && u.pathname === '/guestData/' && u.searchParams.get('placeId') === String(h.place_id) && u.searchParams.get('serviceId') === cel.service_id && Number(u.searchParams.get('startDate')) === slot && u.searchParams.get('lang') === 'hu' && /^mb_[a-z0-9]{12,40}$/.test(u.searchParams.get('back') || ''), u.search.slice(0, 140));
    await p.waitForTimeout(400);
    const geo = await sr('const i=r.querySelector("iframe.adatlap").getBoundingClientRect(); return {alja:Math.round(i.bottom), mag:Math.round(i.height), ablak:innerHeight, lepesek:Math.round(r.querySelector(".lepesek").getBoundingClientRect().height), cim:r.querySelector(".fej h2").textContent}');
    ok(`${nev}: elrendezes (fejlec: "${h.varos} · Adatok"${mobil ? ', a keret a kepernyo aljaig, lepesjelzo nelkul' : ''})`, geo.cim === `${h.varos} · Adatok` && geo.mag > 300 && (!mobil || (geo.lepesek === 0 && Math.abs(geo.alja - geo.ablak) <= 1)), JSON.stringify(geo));
    ok(`${nev}: nincs JS-hiba`, !jsHiba.length, jsHiba.join(' | ').slice(0, 200));
  } catch (e) { ok(`${nev}: futas`, false, String(e.message).slice(0, 200)); }
  finally { sorok.push(sor); await ctx.close(); }
}

const feladatok = [];
for (const h of LEK.helyszinek) if (!CSAK || CSAK.includes(h.place_id)) for (const m of NEZETEK) feladatok.push([h, m]);
const PARH = 3;
await Promise.all(Array.from({ length: PARH }, async () => { while (feladatok.length) { const [h, m] = feladatok.shift(); await egy(h, m); } }));
await b.close();
console.log('\nOsszesites:');
for (const s of sorok.sort((a, c) => a.helyszin.localeCompare(c.helyszin, 'hu') || a.nezet.localeCompare(c.nezet))) console.log(`  ${s.helyszin.padEnd(15)} ${s.nezet.padEnd(8)} kezelesek: ${String(s.kezelesek ?? '-').padEnd(3)} ${String(s.kezeles || '').slice(0, 34).padEnd(35)} idopont: ${s.idopont || '-'}  szakember-chip: ${s.szakemberek ?? '-'}${s.megjegyzes ? '  [' + s.megjegyzes + ']' : ''}`);
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
