// #257: a koszonooldali adattisztitas probaja (assets/js/suti.js eleje + assets/js/mp-meres.js + motor-atadas).
//   node tools/build.mjs && node tools/serve.mjs &   majd   node tools/koszono-tisztitas-pw.mjs
// A helyi kiszolgalot www.medicalpiercing.hu neven nyitja (igy a merokodok betoltenenek); minden kulso kerest
// elkap es eldob, de a kert cimet rogziti. Az /api/mp-foglalas hivast utanozza.
import { chromium } from './pw.mjs';

const PORT = +process.env.PORT || 4290;
const CIM = `http://www.medicalpiercing.hu:${PORT}`;
const G = 'Cj0KCQjwTESZTKOSZONO_' + Date.now();
const START = 1900000000 + Math.floor(Math.random() * 1e6);
const BURL = `https://medicalpiercing.salonic.hu/guestData/?placeId=12169&serviceId=9001&employeeId=555&startDate=${START}`;
const ERZEKENY = ['Migr', 'service=', 'category=', 'Gy%C3%B3gy', 'location=', 'employee=', 'bookingUrl', 'serviceId', 'booking_id', G, 'Szeged', 'TesztKezelo'];
const koszono = (ut, extra = '') => `${CIM}${ut}?first_booking=true&location=Szeged&employee=TesztKezelo&bookingUrl=${encodeURIComponent(BURL)}&price=24900&service=Migr%C3%A9n%20piercing&g=2038420&category=Gy%C3%B3gy&booking_id=mb_tesztkoszono${START}&gclid=${G}${extra}`;
const suti = (igen) => ({ name: 'mp_suti', value: `v1-s${igen ? 1 : 0}-m${igen ? 1 : 0}-t${Math.floor(Date.now() / 1000)}`, domain: 'www.medicalpiercing.hu', path: '/' });

const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log((felt ? 'PASS ' : 'FAIL ') + nev + (info ? ' | ' + info : '')); if (!felt) hiba++; };

async function kornyezet(hozzajarul) {
  const ctx = await b.newContext();
  if (hozzajarul !== undefined) await ctx.addCookies([suti(hozzajarul)]);
  const kuldott = [], kulso = [];
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(CIM + '/api/mp-foglalas')) { kuldott.push(JSON.parse(r.request().postData())); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"uj":true}' }); }
    if (u.startsWith(CIM)) return r.continue();
    kulso.push({ u, ref: r.request().headers().referer || '' }); return r.abort();
  });
  return { ctx, kuldott, kulso };
}
const varj = (ms) => new Promise((r) => setTimeout(r, ms));
const szivarog = (s) => ERZEKENY.filter((x) => String(s).includes(x));

// 1-2. Minden koszonooldal (gyogy + divat): a cim tiszta, a merokodok tiszta cimet latnak, a sajat meres a teljes adatot kapja
for (const ut of ['/foglalas-ok-mi', '/foglalas-ok', '/foglalas-ok-slim', '/fulbevalo-ok', '/fulbevalo-ok3']) {
  const { ctx, kuldott, kulso } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(koszono(ut), { waitUntil: 'load' }); await varj(1500);
  const q = new URL(p.url()).searchParams;
  const allapot = await p.evaluate(() => ({ dl: JSON.stringify(window.dataLayer || []), ss: JSON.stringify(sessionStorage), ls: JSON.stringify(localStorage), eredeti: !!window.mpKoszonoEredeti, hist: history.length }));
  ok(`${ut}: a cimben csak price + first_booking marad`, [...q.keys()].sort().join(',') === 'first_booking,price' && q.get('price') === '24900', p.url().replace(CIM, ''));
  ok(`${ut}: a kulso kerések cime es Referer-e nem tartalmaz erzekeny adatot`, kulso.length > 0 && kulso.every((k) => !szivarog(k.u).length && !szivarog(k.ref).length), `${kulso.length} kulso keres; ` + kulso.filter((k) => szivarog(k.u).length || szivarog(k.ref).length).map((k) => k.u.slice(0, 70)).slice(0, 2).join(' '));
  ok(`${ut}: dataLayer / sessionStorage / localStorage erzekeny adat nelkul`, !szivarog(allapot.dl).length && !szivarog(allapot.ss).length && !szivarog(allapot.ls.replace(/mp_gk[^}]*}/, '')).length, [szivarog(allapot.dl), szivarog(allapot.ss)].join('/'));
  if (ut.startsWith('/foglalas-ok')) {
    const t = kuldott.at(-1);
    ok(`${ut}: a sajat meres megkapja a foglalasi adatokat (bookingUrl, booking_id, gclid)`, !!t && t.p.bookingUrl === BURL && t.p.booking_id === `mb_tesztkoszono${START}` && t.kattintas?.gclid?.ertek === G, t ? Object.keys(t.p).join(',') : 'nincs kuldes');
    ok(`${ut}: a sajat meres nem kapja a szolgaltatasnevet / helyszint / munkatarsat`, !!t && !szivarog(JSON.stringify(t.p)).filter((x) => !['bookingUrl', 'serviceId', 'booking_id', G].includes(x)).length);
  }
  await ctx.close();
}
// 3. Hozzajarulas nelkul is tiszta cim, a meres azonosito nelkul megy
{
  const { ctx, kuldott, kulso } = await kornyezet(false);
  const p = await ctx.newPage();
  await p.goto(koszono('/foglalas-ok-mi'), { waitUntil: 'load' }); await varj(1200);
  ok('3 elutasitas: tiszta cim, meres foglalasi adattal de gclid nelkul, kulso keres erzekeny adat nelkul',
    [...new URL(p.url()).searchParams.keys()].sort().join(',') === 'first_booking,price' && kuldott.length === 1 && !kuldott[0].kattintas && kuldott[0].p.bookingUrl === BURL && kulso.every((k) => !szivarog(k.u).length));
  await ctx.close();
}
// 4. Ujratoltes: a tiszta cimrol sem mer ketszer (a marMert az eredeti booking_id-t jegyzi meg), es a cim tiszta marad
{
  const { ctx, kuldott } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(koszono('/foglalas-ok-mi'), { waitUntil: 'load' }); await varj(1200);
  await p.goto(koszono('/foglalas-ok-mi'), { waitUntil: 'load' }); await varj(1200);
  ok('4 ugyanaz a foglalas masodszor: suti.js ismetlest jelol (data-mp-mar-mert)', (await p.evaluate(() => document.documentElement.getAttribute('data-mp-mar-mert'))) === '1');
  ok('4b a sajat meres szerveroldali dedupra hagyatkozik (ket keres, ugyanaz a kulcs)', kuldott.length === 2 && kuldott[0].p.bookingUrl === kuldott[1].p.bookingUrl);
  await ctx.close();
}
// 5. Motor-atadas: a keretben nyilo koszonooldal az EREDETI cimet kuldi a szulonek (a tisztitas utan is)
{
  const { ctx } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' });
  const url = await p.evaluate((src) => new Promise((res) => {
    window.addEventListener('message', (e) => { if (e.data && e.data.tipus === 'mp-foglalas-ok') res(e.data.url); });
    const f = document.createElement('iframe'); f.src = src; document.body.appendChild(f);
    setTimeout(() => res(null), 6000);
  }), koszono('/foglalas-ok-mi'));
  ok('5 keretbol a motor az eredeti parametereket kapja (bookingUrl, gclid)', !!url && new URL(url).searchParams.get('bookingUrl') === BURL && new URL(url).searchParams.get('gclid') === G, url ? 'megkapta' : 'nincs uzenet');
  await ctx.close();
}
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMIND PASS');
process.exit(hiba ? 1 : 0);
