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
const ERZEKENY = ['Migr', 'service=', 'category=', 'Gy%C3%B3gy', 'location=', 'employee=', 'bookingUrl', 'serviceId', 'booking_id', G, 'Szeged', 'TesztKezelo', 'foglalas-ok-', 'fulbevalo-ok3', 'klimax', 'slim'];
const koszono = (ut, extra = '') => `${CIM}${ut}?first_booking=true&location=Szeged&employee=TesztKezelo&bookingUrl=${encodeURIComponent(BURL)}&price=24900&service=Migr%C3%A9n%20piercing&g=2038420&category=Gy%C3%B3gy&booking_id=mb_tesztkoszono${START}&gclid=${G}${extra}`;
const suti = (igen) => ({ name: 'mp_suti', value: `v1-s${igen ? 1 : 0}-m${igen ? 1 : 0}-t${Math.floor(Date.now() / 1000)}`, domain: 'www.medicalpiercing.hu', path: '/' });

const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1, MAP www.idegen-oldal.test 127.0.0.1'] });
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
  const allapot = await p.evaluate(() => ({ dl: JSON.stringify(window.dataLayer || []), ss: JSON.stringify(sessionStorage), ls: JSON.stringify(localStorage), cim: document.title,
    adat: JSON.stringify(window.mpKoszonoAdat || null), felsorolhato: Object.keys(window).includes('mpKoszonoAdat'), regi: 'mpKoszonoEredeti' in window, fagyott: Object.isFrozen(window.mpKoszonoAdat) }));
  const semleges = ut.startsWith('/fulbevalo-ok') ? '/fulbevalo-ok' : '/foglalas-ok';
  ok(`${ut}: semleges utvonal (${semleges}), a cimben csak price + first_booking + mert=1 marad`, new URL(p.url()).pathname === semleges && [...q.keys()].sort().join(',') === 'first_booking,mert,price' && q.get('price') === '24900' && q.get('mert') === '1', p.url().replace(CIM, ''));
  ok(`${ut}: semleges lapcim`, allapot.cim === 'Sikeres foglalás | Medical Piercing', allapot.cim);
  ok(`${ut}: a memoriaban csak minimalis, fagyasztott, nem felsorolhato adat (szolgaltatasnev, helyszin, munkatars nelkul); teljes eredeti URL nincs`,
    allapot.fagyott && !allapot.felsorolhato && !allapot.regi && !['Migr', '"service"', '"category"', 'Szeged', 'TesztKezelo', '"location"', '"employee"', '"g"', 'ok-mi', 'ok-slim', 'ok3', 'klimax'].some((x) => allapot.adat.includes(x)), allapot.adat.slice(0, 160));
  ok(`${ut}: a kulso kerések cime es Referer-e nem tartalmaz erzekeny adatot`, kulso.length > 0 && kulso.every((k) => !szivarog(k.u).length && !szivarog(k.ref).length), `${kulso.length} kulso keres; ` + kulso.filter((k) => szivarog(k.u).length || szivarog(k.ref).length).map((k) => k.u.slice(0, 70)).slice(0, 2).join(' '));
  ok(`${ut}: dataLayer / sessionStorage / localStorage erzekeny adat nelkul`, !szivarog(allapot.dl).length && !szivarog(allapot.ss).length && !szivarog(allapot.ls.replace(/mp_gk[^}]*}/, '').replace(/"mp_koszono":"[^"]*"/, '')).length, [szivarog(allapot.dl), szivarog(allapot.ss), szivarog(allapot.ls)].join('/'));
  // a divat fulpiercing koszonooldala (/fulbevalo-ok*) is pontosan ugyanigy jelez (a #242 ota ez hianyzott)
  {
    const t = kuldott.at(-1);
    ok(`${ut}: pontosan 1 sajat meres, semleges ut (${semleges}), a foglalasi adatokkal (bookingUrl, booking_id, gclid)`, kuldott.length === 1 && !!t && t.ut === semleges && t.p.bookingUrl === BURL && t.p.booking_id === `mb_tesztkoszono${START}` && t.kattintas?.gclid?.ertek === G, t ? `${kuldott.length} kuldes, ut=${t.ut}, ` + Object.keys(t.p).join(',') : 'nincs kuldes');
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
    [...new URL(p.url()).searchParams.keys()].sort().join(',') === 'first_booking,mert,price' && kuldott.length === 1 && !kuldott[0].kattintas && kuldott[0].p.bookingUrl === BURL && kulso.every((k) => !szivarog(k.u).length));
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
// 4c. Divat fulpiercing: a tisztitott cim F5-je / uj fulben megnyitasa sem kuld ujra
{
  const { ctx, kuldott } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(koszono('/fulbevalo-ok2'), { waitUntil: 'load' }); await varj(1200);
  const tiszta = p.url();
  await p.reload({ waitUntil: 'load' }); await varj(1200);
  const p2 = await ctx.newPage(); await p2.goto(tiszta, { waitUntil: 'load' }); await varj(1200);
  ok('4c /fulbevalo-ok2: 1 kuldes, F5 es uj ful a tisztitott cimrol: 0 uj kuldes', kuldott.length === 1 && new URL(tiszta).pathname === '/fulbevalo-ok', `${kuldott.length} kuldes, ${tiszta.replace(CIM, '')}`);
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
  const uq = url ? new URL(url) : null;
  ok('5 keretbol a sajat motor megkapja: eredeti utvonal + meres parameterei (bookingUrl, booking_id, gclid)', !!uq && uq.pathname === '/foglalas-ok-mi' && uq.searchParams.get('bookingUrl') === BURL && uq.searchParams.get('gclid') === G && !!uq.searchParams.get('booking_id'), url ? 'megkapta' : 'nincs uzenet');
  ok('5b a motornak kuldott cimben nincs szolgaltatasnev / helyszin / munkatars', !!uq && !['service', 'category', 'location', 'employee', 'g'].some((k) => uq.searchParams.has(k)));
  await ctx.close();
}
// 6. Idegen tartomanyrol beagyazva a koszonooldal NEM kuld uzenetet (celzott postMessage, nem '*')
{
  const { ctx } = await kornyezet(true);
  await ctx.route(/www\.idegen-oldal\.test/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>idegen</body></html>' }));
  const p = await ctx.newPage();
  await p.goto(`http://www.idegen-oldal.test:${PORT}/`, { waitUntil: 'load' });
  const url = await p.evaluate((src) => new Promise((res) => {
    window.addEventListener('message', (e) => { if (e.data && e.data.tipus === 'mp-foglalas-ok') res(e.data.url); });
    const f = document.createElement('iframe'); f.src = src; document.body.appendChild(f);
    setTimeout(() => res(null), 5000);
  }), koszono('/foglalas-ok-mi'));
  ok('6 idegen tartomanyu szulo nem kapja meg az uzenetet', url === null, url ? 'MEGKAPTA' : 'nem kapta meg');
  await ctx.close();
}
// 7. VALODI ujratoltes / uj lap / vissza-elore a TISZTITOTT cimrol: se cimkebetoltes (Ads, GA4, GTM, pixelek), se uj D1-kuldes
{
  const CIMKE = /googletagmanager|google-analytics|googleadservices|doubleclick|googlesyndication|facebook|tiktok|stape\./;
  const { ctx, kuldott, kulso } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(koszono('/foglalas-ok-mi'), { waitUntil: 'load' }); await varj(1500);
  const tiszta = p.url();
  const c0 = kulso.filter((k) => CIMKE.test(k.u)).length, d0 = kuldott.length;
  ok('7a elso megnyitas: a cimkek betoltenek es a sajat meres egyszer kuld', c0 > 0 && d0 === 1, `${c0} cimkekeres, ${d0} D1-kuldes, cim: ${tiszta.replace(CIM, '')}`);
  const uj = () => ({ c: kulso.filter((k) => CIMKE.test(k.u)).length - c0, d: kuldott.length - d0 });
  await p.reload({ waitUntil: 'load' }); await varj(1500);
  let u = uj(); const jel = await p.evaluate(() => document.documentElement.getAttribute('data-mp-mar-mert'));
  ok('7b page.reload() (F5) ugyanabban a fulben: 0 uj cimkekeres, 0 uj D1-kuldes', u.c === 0 && u.d === 0 && jel === '1' && p.url() === tiszta, `${u.c} cimke, ${u.d} D1, jel=${jel}`);
  const p2 = await ctx.newPage();
  await p2.goto(tiszta, { waitUntil: 'load' }); await varj(1500);
  u = uj();
  ok('7c a tisztitott cim uj fulben: 0 uj cimkekeres, 0 uj D1-kuldes', u.c === 0 && u.d === 0, `${u.c} cimke, ${u.d} D1`);
  await p2.close();
  await p.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' }); await varj(800);
  const c1 = kulso.filter((k) => CIMKE.test(k.u)).length; // a masik lap sajat cimkei
  await p.goBack({ waitUntil: 'load' }); await varj(1500);
  const vissza = { c: kulso.filter((k) => CIMKE.test(k.u)).length - c1, d: kuldott.length - d0, url: p.url() };
  ok('7d vissza a koszonooldalra: 0 uj cimkekeres, 0 uj D1-kuldes', vissza.c === 0 && vissza.d === 0 && vissza.url === tiszta, `${vissza.c} cimke, ${vissza.d} D1, ${vissza.url.replace(CIM, '')}`);
  await p.goForward({ waitUntil: 'load' }); await varj(800);
  await p.goBack({ waitUntil: 'load' }); await varj(1500);
  const c2 = kulso.filter((k) => CIMKE.test(k.u)).length;
  await p.evaluate(() => 0);
  ok('7e elore, majd ujra vissza: 0 uj D1-kuldes, a koszonooldal nem mer ujra', kuldott.length - d0 === 0 && (await p.evaluate(() => document.documentElement.getAttribute('data-mp-mar-mert') === '1' || performance.getEntriesByType('navigation')[0]?.type === 'back_forward')), `${kuldott.length - d0} D1`);
  // bfcache nelkul is: kozvetlen navigacio az elozmenybol (uj dokumentum) - a 7c lefedi; a nem cimke-oldal betoltese adja c2-c1-et
  void c2;
  await ctx.close();
}
// 8. Igazolhato foglalas (Google Ads "Időpontfoglalás - igazolt", orderId): elso betolteskor PONTOSAN egy esemeny a
//    szerverrel azonos kulccsal (placeId|employeeId|startUnix) es az arral; F5 / uj ful / vissza: nincs uj esemeny.
{
  const esem = (pg) => pg.evaluate(() => (window.dataLayer || []).filter((e) => e && e.event === 'mp_foglalas_igazolhato'));
  for (const hozza of [true, false]) {
    const { ctx } = await kornyezet(hozza);
    const p = await ctx.newPage();
    await p.goto(koszono('/foglalas-ok-mi'), { waitUntil: 'load' }); await varj(1200);
    const e1 = await esem(p);
    ok(`8a (${hozza ? 'hozzajarulassal' : 'hozzajarulas nelkul'}) elso betoltes: 1 esemeny, kulcs = 12169|555|${START}, ertek 24900, mas mezo nincs`,
      e1.length === 1 && e1[0].mp_foglalas_kulcs === `12169|555|${START}` && e1[0].mp_foglalas_ertek === 24900 && Object.keys(e1[0]).sort().join(',') === 'event,mp_foglalas_ertek,mp_foglalas_kulcs', JSON.stringify(e1));
    const tiszta = p.url();
    await p.reload({ waitUntil: 'load' }); await varj(1000);
    const e2 = await esem(p);
    const p2 = await ctx.newPage(); await p2.goto(tiszta, { waitUntil: 'load' }); await varj(1000);
    const e3 = await esem(p2);
    await p.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' }); await p.goBack({ waitUntil: 'load' }); await varj(1000);
    const e4 = await esem(p);
    ok(`8b (${hozza ? 'hozzajarulassal' : 'hozzajarulas nelkul'}) F5 / uj ful / vissza: 0 uj esemeny`, e2.length === 0 && e3.length === 0 && e4.length === 0, `${e2.length}/${e3.length}/${e4.length}`);
    await ctx.close();
  }
  // kulcs nelkuli koszonooldal (pl. hianyzo bookingUrl): nincs esemeny
  const { ctx } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/foglalas-ok?first_booking=true&price=24900`, { waitUntil: 'load' }); await varj(1000);
  ok('8c kulcs nelkul nincs esemeny', (await esem(p)).length === 0);
  await ctx.close();
}
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMIND PASS');
process.exit(hiba ? 1 : 0);
