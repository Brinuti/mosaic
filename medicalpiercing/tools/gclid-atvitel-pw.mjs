// A Google-kattintasazonosito (gclid) atvitelenek probaja: assets/js/klon.js (belso linkek, Salonic-linkek),
// assets/js/mp-meres.js (tarolas csak hozzajarulassal, koszonooldali potlas), a motor koszonooldali atadasanak eredmenye.
//   node tools/build.mjs && node tools/serve.mjs &   majd   node tools/gclid-atvitel-pw.mjs
// Minden kulso kerest eldob; az /api/mp-foglalas hivast elkapja (a helyi kiszolgalo nem futtat fuggvenyt).
import assert from 'node:assert/strict';
import { chromium } from './pw.mjs';

const PORT = +process.env.PORT || 4290;
const CIM = `http://www.medicalpiercing.hu:${PORT}`;
const G = 'Cj0KCQjwTESZTATVITEL_' + Date.now();
const G_REGI = 'Cj0KCQjwTESZTREGI_' + Date.now();
const START = 1900000000 + Math.floor(Math.random() * 1e6);
const BURL = encodeURIComponent(`https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=12169&serviceId=9001&employeeId=555&startDate=${START}`);
// a motor altal a fo ablakban nyitott koszonooldal (ugyanazok a parameterek + booking_id + a lap sajat gclid-je)
const koszono = (g) => `${CIM}/foglalas-ok-mi?first_booking=true&price=24900&bookingUrl=${BURL}&booking_id=mb_teszt${Date.now()}${g ? '&gclid=' + g : ''}`;
const suti = (igen) => ({ name: 'mp_suti', value: `v1-s${igen ? 1 : 0}-m${igen ? 1 : 0}-t${Math.floor(Date.now() / 1000)}`, domain: 'www.medicalpiercing.hu', path: '/' });

const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log((felt ? 'PASS ' : 'FAIL ') + nev + (info ? ' | ' + info : '')); if (!felt) hiba++; };
// SAV_KI (assets/js/suti.js, Feri dontese, 2026-10-13): a suti-sav nem jelenik meg, a dontes nelkuli alapallapot az elfogadott "t0" suti.
// Ilyenkor "dontes elotti" allapot nincs: az erre epulo pontok (2a, 3c, 4, 7, 9) nem ertelmezhetok - kihagyjuk, jelolve (a sav visszakapcsolasakor ujra futnak).
const SAV_KI = await (async () => {
  const ctx = await b.newContext();
  await ctx.route('**/*', (r) => (r.request().url().startsWith(CIM) ? r.continue() : r.abort()));
  const p = await ctx.newPage();
  await p.goto(`${CIM}/adatkezeles`, { waitUntil: 'load' });
  const t0 = /(?:^|;\s*)mp_suti=v1-s1-m1-t0(?:;|$)/.test(await p.evaluate(() => document.cookie));
  await ctx.close();
  return t0;
})();
if (SAV_KI) console.log('SAV_KI: a suti-sav ki van kapcsolva (alapbol elfogadott t0 suti) - a dontes elotti allapotra epulo pontok kihagyva');
const okD = (nev, felt, info = '') => (SAV_KI ? console.log('KIHAGYVA (SAV_KI) ' + nev) : ok(nev, felt, info));

async function kornyezet(elore) {
  const ctx = await b.newContext();
  if (elore !== undefined) await ctx.addCookies([suti(elore)]);
  const kuldott = [], kulso = [];
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(CIM + '/api/mp-foglalas')) { kuldott.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"uj":true}' }); }
    if (u.startsWith(CIM)) return r.continue();
    kulso.push(u); return r.abort();
  });
  return { ctx, kuldott, kulso };
}
const dontes = (p, igen) => p.evaluate((igen) => { // a suti-sav donteset utanozza: suti + a sav esemenye
  document.cookie = `mp_suti=v1-s${igen ? 1 : 0}-m${igen ? 1 : 0}-t${Math.floor(Date.now() / 1000)}; path=/; max-age=31536000`;
  document.dispatchEvent(new CustomEvent('mp_suti_valtozas', { detail: { stat: igen, mark: igen } }));
}, igen);
const tarolt = (p) => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('mp_gk') || 'null'); } catch (e) { return 'hiba'; } });
const kattintasa = (k) => (k.at(-1) && k.at(-1).kattintas && k.at(-1).kattintas.gclid ? k.at(-1).kattintas.gclid.ertek : null);
const varKuldes = async (k) => { for (let i = 0; i < 40 && !k.length; i++) await new Promise((r) => setTimeout(r, 200)); };

// 1. Azonnali elfogadas (mar elfogadott suti), majd foglalas
{
  const { ctx, kuldott } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?gclid=${G}`, { waitUntil: 'load' });
  ok('1a azonnali elfogadas: a gclid tarolva', (await tarolt(p))?.gclid?.ertek === G);
  await p.goto(koszono(G), { waitUntil: 'load' }); await varKuldes(kuldott);
  ok('1b foglalas: a meres a gclid-et kuldi', kattintasa(kuldott) === G, JSON.stringify(kuldott.at(-1)?.kattintas || null).slice(0, 80));
  await ctx.close();
}
// 2. Kesobbi elfogadas ugyanazon az oldalon
{
  const { ctx, kuldott } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?gclid=${G}`, { waitUntil: 'load' });
  okD('2a dontes elott: semmi nincs tarolva', (await tarolt(p)) === null);
  await dontes(p, true);
  ok('2b elfogadas utan ugyanazon a lapon: tarolva', (await tarolt(p))?.gclid?.ertek === G);
  await p.goto(koszono(G), { waitUntil: 'load' }); await varKuldes(kuldott);
  ok('2c foglalas: kuldve', kattintasa(kuldott) === G);
  await ctx.close();
}
// 3. Masik belso oldalra lep dontes nelkul, ott fogad el, majd foglal
{
  const { ctx, kuldott } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?gclid=${G}`, { waitUntil: 'load' });
  // a kesobb bekerulo linkek (pl. a suti-sav adatkezelesi linkje) kattintaskor egeszulnek ki: contextmenu-esemeny navigacio nelkul
  const linkek = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => { a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return a.href; }));
  const belso = linkek.filter((h) => h.startsWith(CIM) && !h.includes('#'));
  const salonic = linkek.filter((h) => /medicalpiercing\.salonic\.hu/.test(h));
  ok('3a belso linkek viszik a gclid-et', belso.length > 0 && belso.every((h) => new URL(h).searchParams.get('gclid') === G), `${belso.length} belso link`);
  ok('3b Salonic-linkek NEM viszik a gclid-et', salonic.every((h) => !/[?&](gclid|gbraid|wbraid)=/.test(h)), `${salonic.length} Salonic-link`);
  const cel = belso.find((h) => new URL(h).pathname.length > 1) || belso[0];
  await p.goto(cel, { waitUntil: 'load' });
  const munkamenet = await p.evaluate(() => sessionStorage.getItem('savedQueryParams') || '');
  okD('3c a masodik oldal cimeben ott a gclid, tarolva meg semmi (munkamenetben sem)', new URL(p.url()).searchParams.get('gclid') === G && (await tarolt(p)) === null && !munkamenet.includes(G), new URL(p.url()).pathname);
  await dontes(p, true);
  ok('3d elfogadas a masodik oldalon: tarolva', (await tarolt(p))?.gclid?.ertek === G);
  await p.goto(koszono(null), { waitUntil: 'load' }); await varKuldes(kuldott);
  ok('3e foglalas (a koszonooldal cimeben nincs gclid): kuldve a tarolt', kattintasa(kuldott) === G);
  await ctx.close();
}
// 3/b. Csak a koszonooldalon fogad el (a motor a lap gclid-jet a koszonooldal cimebe tette)
{
  const { ctx, kuldott } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(koszono(G), { waitUntil: 'load' });
  await dontes(p, true); await varKuldes(kuldott);
  ok('3f elfogadas a koszonooldalon: a potolt gclid kuldve', kattintasa(kuldott) === G);
  await ctx.close();
}
// 4. Elutasitas: nincs tarolas, nincs kattintasazonosito a kuldesben, a Salonic nem kapja meg
{
  const { ctx, kuldott, kulso } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?gclid=${G}`, { waitUntil: 'load' });
  await dontes(p, false);
  okD('4a elutasitas: semmi nincs tarolva (localStorage, sessionStorage, suti)', (await tarolt(p)) === null && !(await p.evaluate((g) => JSON.stringify(sessionStorage) + document.cookie, G)).includes(G));
  const salonic = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => /medicalpiercing\.salonic\.hu/.test(h)));
  ok('4b elutasitas: Salonic-link gclid nelkul', salonic.every((h) => !/[?&](gclid|gbraid|wbraid)=/.test(h)), `${salonic.length} link`);
  await p.goto(koszono(G), { waitUntil: 'load' }); await varKuldes(kuldott);
  okD('4c elutasitas: a foglalas-meres kattintasazonosito nelkul', kuldott.length > 0 && !kuldott.at(-1).kattintas, JSON.stringify(kuldott.at(-1)?.kattintas));
  okD('4d elutasitas a koszonooldalon sem tarol', (await tarolt(p)) === null);
  ok('4e egyetlen kulso kerest sem kap gclid-et', !kulso.some((u) => u.includes(G)), kulso.filter((u) => u.includes(G)).slice(0, 2).join(' '));
  await ctx.close();
}
// 5. A potlas nem irja felul a hozzajarulassal mar tarolt ervenyes erteket
{
  const { ctx, kuldott } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?gclid=${G_REGI}`, { waitUntil: 'load' });
  await p.goto(koszono(G), { waitUntil: 'load' }); await varKuldes(kuldott);
  ok('5 koszonooldali potlas nem ir felul: a korabban tarolt megy', kattintasa(kuldott) === G_REGI && (await tarolt(p))?.gclid?.ertek === G_REGI);
  await ctx.close();
}
// 6. fbclid / utm tovabbra is megy a Salonic-linkekre (a Meta Schedule miatt nem nyulunk hozza)
{
  const { ctx } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?gclid=${G}&fbclid=TESZTFB123456&utm_source=teszt`, { waitUntil: 'load' });
  const s = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => /medicalpiercing\.salonic\.hu/.test(h)));
  ok('6 Salonic-linkek: fbclid + utm marad, gclid nem', s.length > 0 && s.every((h) => h.includes('fbclid=TESZTFB123456') && h.includes('utm_source=teszt') && !h.includes('gclid=')), `${s.length} link`);
  await ctx.close();
}
// 7. Kesoi (4 mp utani) elfogadas a koszonooldalon: elso kuldes azonosito nelkul, utana EGY potlo keres gclid-del
{
  const { ctx, kuldott } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(koszono(G), { waitUntil: 'load' });
  await p.waitForTimeout(4600);
  const elso = kuldott.length;
  await dontes(p, true); await p.waitForTimeout(800);
  await dontes(p, true); await p.waitForTimeout(500); // dupla esemeny: nem mehet ki masodik potlas
  okD('7a 4 mp utan: egy kuldes, azonosito nelkul', elso === 1 && !kuldott[0].kattintas && !kuldott[0].potlas);
  okD('7b kesoi elfogadas: pontosan EGY potlo keres, gclid-del', kuldott.length === 2 && kuldott[1].potlas === true && kuldott[1].kattintas?.gclid?.ertek === G, `${kuldott.length} keres`);
  await ctx.close();
}
// 8. Elfogadas 4 mp-en belul: egy kuldes gclid-del, potlas nincs
{
  const { ctx, kuldott } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(koszono(G), { waitUntil: 'load' });
  await p.waitForTimeout(800); await dontes(p, true); await p.waitForTimeout(4500);
  ok('8 elfogadas 4 mp-en belul: egy kuldes gclid-del, potlas nelkul', kuldott.length === 1 && kuldott[0].kattintas?.gclid?.ertek === G && !kuldott[0].potlas, `${kuldott.length} keres`);
  await ctx.close();
}
// 9. Kesoi ELUTASITAS: nincs potlo keres, nincs tarolas
{
  const { ctx, kuldott } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(koszono(G), { waitUntil: 'load' });
  await p.waitForTimeout(4600); await dontes(p, false); await p.waitForTimeout(800);
  okD('9 kesoi elutasitas: egy kuldes azonosito nelkul, potlas es tarolas nincs', kuldott.length === 1 && !kuldott[0].kattintas && (await tarolt(p)) === null);
  await ctx.close();
}
// 10. Korabbi munkamenetbol maradt gclid (a javitas elotti savedQueryParams): nem kerul vissza a cimbe, a tarolo kitisztul
{
  const { ctx } = await kornyezet();
  await ctx.addInitScript((g) => { try { if (!sessionStorage.getItem('teszt_elokeszitve')) { sessionStorage.setItem('savedQueryParams', JSON.stringify({ gclid: g, utm_source: 'regi' })); sessionStorage.setItem('teszt_elokeszitve', '1'); } } catch (e) {} }, G_REGI);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' }); await p.waitForTimeout(400);
  const ss = await p.evaluate(() => sessionStorage.getItem('savedQueryParams'));
  ok('10a regi munkamenet: a gclid nem kerul vissza a cimbe, az utm igen', !p.url().includes('gclid') && p.url().includes('utm_source=regi'), p.url().replace(CIM, ''));
  ok('10b regi munkamenet: a taroloban nincs tobbe gclid', !!ss && !ss.includes(G_REGI) && ss.includes('regi'), ss);
  const linkek = await p.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => { a.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); return a.href; }));
  ok('10c regi munkamenet: egyetlen link sem viszi a regi gclid-et', !linkek.some((h) => h.includes(G_REGI)));
  await ctx.close();
}
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMIND PASS');
process.exit(hiba ? 1 : 0);
