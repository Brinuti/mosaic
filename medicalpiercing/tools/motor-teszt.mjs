// A foglalomotor probaja (valodi foglalas NELKUL: az adatlapot nem kuldjuk be, a Salonic felé csak olvaso GET megy).
//
//   node tools/build.mjs && node tools/serve.mjs     (masik ablakban)
//   node tools/motor-teszt.mjs [--mobil]
//
// A bongeszo a helyi kiszolgalot www.medicalpiercing.hu neven nyitja meg (mint a meres-teszt), minden adatkuldo kerest
// elkap es eldob. Ellenorzi:
//   - kapcsolo 0 (alap): a foglalasi link a regi Salonic-utat nyitja, a motor nem toltodik be;
//   - ?motor=1: a link a helyben nyilo motort nyitja, az oldal cime nem valtozik; 15 helyszin; Budapest -> a szolgaltatasok
//     magyarul, a tipusoldalon az ajanlott kezeles elol; naptar, szabad idopont; az adatlap a Salonic /guestData/ cime
//     (placeId, serviceId, startDate, lang=hu, back=mb_...);
//   - a koszonooldal atadasa: a keretben megnyilo /foglalas-ok-mi jelez, a motor atveszi, a fo ablakban UGYANAZ a
//     koszonooldal nyilik UGYANAZOKKAL a parameterekkel + booking_id; a keretben nincs meres, a fo ablakban egyszer;
//   - ?motor=0 a kapcsolot felulirja (regi ut); a foglalasinditas merese (TikTok InitiateCheckout, GA4 foglalas_inditasa)
//     kattintasonkent egyszer, a motor dontese elott;
//   - ?motor=1 mellett a /foglalas-ok* oldalon nincs indito.
import { chromium, devices } from './pw.mjs';

const PORT = +process.env.PORT || 4290;
const CIM = `http://www.medicalpiercing.hu:${PORT}`;
const MOBIL = process.argv.includes('--mobil');
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${MOBIL ? 'mobil' : 'asztali'}: ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; };
const SZABAD = /^https:\/\/(www\.googletagmanager\.com\/(gtm|gtag\/js)|connect\.facebook\.net\/(en_US\/fbevents\.js|signals\/config\/)|analytics\.tiktok\.com\/i18n\/pixel\/|medicalpiercing\.salonic\.hu\/(selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
const OPT = MOBIL ? { ...devices['Pixel 5'], userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' } : { viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };

async function kornyezet() {
  const ctx = await b.newContext(OPT);
  const ki = [];
  await ctx.route((u) => !u.toString().startsWith(CIM), (r) => {
    const u = r.request().url();
    if (SZABAD.test(u) && r.request().method() === 'GET') return r.continue();
    let keret = false;
    try { const f = r.request().frame(); keret = !!f && f !== f.page().mainFrame(); } catch (e) { keret = true; } // keret-navigacio
    ki.push({ u, keret });
    return r.abort();
  });
  return { ctx, ki };
}
const motorAllapot = (p) => p.evaluate(() => { const h = document.querySelector('[data-mp-motor]'); return h ? h.shadowRoot.querySelector('.tartalom').innerText.slice(0, 400) : null; });
const motorKattint = (p, sel) => p.evaluate((sel) => { const el = document.querySelector('[data-mp-motor]').shadowRoot.querySelector(sel); if (!el) return false; el.click(); return true; }, sel);
const varMotor = async (p, sel, ms = 25000) => { for (let i = 0; i < ms / 250; i++) { if (await p.evaluate((sel) => !!document.querySelector('[data-mp-motor]')?.shadowRoot.querySelector(sel), sel)) return true; await p.waitForTimeout(250); } return false; };
// az elso lathato foglalasi link (selectLocation, showServices, employees, ...; az ajandekkartya nem)
const kattintLink = (p) => p.evaluate(() => {
  const jo = (a) => /^https:\/\/medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|employees|selectEmployee|selectDate)/i.test(a.href);
  const l = [...document.querySelectorAll('a[href]')].filter(jo);
  const a = l.find((x) => x.offsetParent !== null) || l[0];
  a.scrollIntoView({ block: 'center' }); a.click(); return a.href;
});
const salonicNavigacio = (ctx) => ctx.waitForEvent('request', { predicate: (r) => r.isNavigationRequest() && /medicalpiercing\.salonic\.hu/.test(r.url()), timeout: 8000 }).then((r) => r.url(), () => null);

// 1. kapcsolo 0: regi ut
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  const nav = salonicNavigacio(ctx);
  await kattintLink(p);
  const cel = await nav;
  await p.waitForTimeout(800);
  ok('kapcsolo 0: a link a Salonicot nyitja, motor nincs', !!cel && !(await motorAllapot(p)), cel ? cel.slice(0, 80) : 'nincs Salonic-navigacio');
  await ctx.close();
}

// 2. ?motor=1: a motor vegig az adatlapig, majd a koszonooldal atadasa
{
  const { ctx, ki } = await kornyezet();
  const p = await ctx.newPage();
  // a vendeg a migren-oldalrol (gclid-del) erkezik, a foglalas a /idopontfoglalas oldalon indul (mint a valosagban)
  await p.goto(CIM + '/migren-piercing?motor=1&gclid=TESZTGCLID123', { waitUntil: 'load' });
  await p.goto(CIM + '/idopontfoglalas', { waitUntil: 'load' });
  await p.waitForTimeout(3000);
  const elotte = ki.length;
  const cim = p.url();
  await kattintLink(p);
  ok('?motor=1: a motor megnyilik', await varMotor(p, '[data-hely]'), '');
  ok('az oldal cime nem valtozik', p.url() === cim, p.url());
  const helyek = await p.evaluate(() => document.querySelector('[data-mp-motor]').shadowRoot.querySelectorAll('[data-hely]').length);
  ok('15 helyszin', helyek === 15, String(helyek));
  const merkez = ki.slice(elotte).filter((x) => /analytics\.tiktok\.com\/api|google-analytics\.com\/g\/collect|\/g\/collect/.test(x.u));
  const ga = ki.slice(elotte).filter((x) => /[?&]en=foglalas_inditasa/.test(x.u));
  ok('GA4 foglalas_inditasa egyszer (eldobva)', ga.length === 1, `${ga.length} db; ${merkez.length} meroeszkoz-keres`);
  await motorKattint(p, '[data-hely="6029"]');
  ok('Budapest: a kezelesek betoltodnek', await varMotor(p, '[data-szolg]'));
  const szolg = await p.evaluate(() => [...document.querySelector('[data-mp-motor]').shadowRoot.querySelectorAll('[data-szolg]')].map((x) => x.querySelector('.nev').textContent));
  ok('a kezelesek magyarul, a migren-oldalon a migren-piercing az elso', /Migrén/.test(szolg[0] || '') && szolg.length >= 15, szolg.slice(0, 2).join(' | '));
  await motorKattint(p, '[data-szolg]');
  ok('naptar: van szabad idopont', await varMotor(p, '[data-slot]'));
  const szakemberek = await p.evaluate(() => document.querySelector('[data-mp-motor]').shadowRoot.querySelectorAll('[data-staff]').length);
  ok('Budapest: szakemberválasztó (Bárki + nevek)', szakemberek >= 3, String(szakemberek));
  await motorKattint(p, '[data-slot]');
  ok('adatlap: a Salonic keret betoltodik', await varMotor(p, 'iframe.adatlap'));
  const src = await p.evaluate(() => document.querySelector('[data-mp-motor]').shadowRoot.querySelector('iframe.adatlap').src);
  const u = new URL(src);
  ok('adatlap cime: guestData, placeId 6029, serviceId, startDate, lang=hu, back=mb_..., gclid tovabbviszi', u.hostname === 'medicalpiercing.salonic.hu' && u.pathname === '/guestData/' && u.searchParams.get('placeId') === '6029' && /^\d+$/.test(u.searchParams.get('serviceId')) && /^\d{10}$/.test(u.searchParams.get('startDate')) && u.searchParams.get('lang') === 'hu' && /^mb_[a-z0-9]{12,40}$/.test(u.searchParams.get('back') || '') && u.searchParams.get('gclid') === 'TESZTGCLID123', src.slice(0, 160));
  // a koszonooldal atadasa: a keretet a helyi koszonooldalra iranyitjuk (a Salonic sikeres foglalas utani atiranyitasa helyett)
  const startDate = u.searchParams.get('startDate'), serviceId = u.searchParams.get('serviceId');
  const bookingUrl = `https://medicalpiercing.salonic.hu/guestData/?placeId=6029&serviceId=${serviceId}&employeeId=-1&startDate=${startDate}`;
  const koszono = `${CIM}/foglalas-ok-mi?first_booking=true&price=24900&employee=Teszt&location=Budapest&service=Teszt&g=1&bookingUrl=${encodeURIComponent(bookingUrl)}`;
  const kiElotte = ki.length;
  const jelzesek = [];
  ctx.on('request', (r) => { if (r.method() === 'POST' && /\/api\/mp-foglalas$/.test(r.url())) { let k = false; try { const f = r.frame(); k = f !== f.page().mainFrame(); } catch (e) { k = true; } jelzesek.push({ keret: k, torzs: r.postData() || '' }); } });
  const nav = p.waitForURL(/\/foglalas-ok-mi\?.*booking_id=mb_/, { timeout: 15000 }).then(() => true, () => false);
  await p.evaluate((k) => { document.querySelector('[data-mp-motor]').shadowRoot.querySelector('iframe.adatlap').src = k; }, koszono);
  const atadva = await nav;
  const vegso = new URL(p.url());
  ok('koszonooldal: a fo ablakban nyilik, ugyanazokkal a parameterekkel + booking_id', atadva && vegso.searchParams.get('bookingUrl') === bookingUrl && vegso.searchParams.get('price') === '24900' && vegso.searchParams.get('first_booking') === 'true' && /^mb_/.test(vegso.searchParams.get('booking_id') || ''), p.url().slice(0, 140));
  ok('a booking_id ugyanaz, mint az adatlap back parametere', vegso.searchParams.get('booking_id') === u.searchParams.get('back'));
  await p.waitForTimeout(7000);
  const kesobb = ki.slice(kiElotte);
  const keretbol = kesobb.filter((x) => x.keret && /google|facebook|tiktok|convertize|stape/.test(x.u));
  ok('a keretben (a motor atvette) nincs merokeres', keretbol.length === 0, keretbol.map((x) => x.u.slice(0, 60)).join(' | '));
  ok('sajat foglalas-meres (/api/mp-foglalas): pontosan 1 jelzes, a fo ablakbol, booking_id-vel', jelzesek.length === 1 && !jelzesek[0].keret && /"booking_id":"mb_/.test(jelzesek[0].torzs), JSON.stringify(jelzesek.map((j) => ({ keret: j.keret, booking_id: /booking_id/.test(j.torzs) }))));
  const meta = kesobb.filter((x) => /facebook\.com\/tr/.test(x.u));
  ok('a koszonooldalon nincs Meta-esemeny', meta.length === 0, String(meta.length));
  await ctx.close();
}

// 3. ?motor=0 felulirja; 4. koszonooldalon nincs indito
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(CIM + '/idopontfoglalas?motor=1', { waitUntil: 'load' });
  await p.goto(CIM + '/idopontfoglalas?motor=0', { waitUntil: 'load' });
  const nav = salonicNavigacio(ctx);
  await kattintLink(p);
  const cel = await nav;
  await p.waitForTimeout(600);
  ok('?motor=0: regi ut (a munkamenetben is felulirja a ?motor=1-et)', !!cel && !(await motorAllapot(p)));
  await p.goto(CIM + '/foglalas-ok-mi?motor=1&first_booking=true', { waitUntil: 'load' });
  const inditoBetoltve = await p.evaluate(() => [...document.scripts].some((s) => /motor-indito/.test(s.src)));
  ok('a koszonooldalon az indito betolt, de nem csinal semmit (keret / koszonooldal)', inditoBetoltve && !(await p.evaluate(() => !!document.querySelector('[data-mp-motor]'))));
  await ctx.close();
}

// 5. a regi, kozvetlenul beagyazott Salonic-naptar (motor nelkul): a keretbe toltott koszonooldal 1,5 mp utan mer
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  const keretKeres = [];
  ctx.on('request', (r) => { try { const f = r.frame(); if (f && f !== f.page().mainFrame() && /googletagmanager\.com\/gtm\.js/.test(r.url())) keretKeres.push(r.url()); } catch (e) { /* */ } });
  await p.goto(CIM + '/kapcsolat', { waitUntil: 'load' }).catch(() => p.goto(CIM + '/', { waitUntil: 'load' }));
  await p.evaluate((k) => { const f = document.createElement('iframe'); f.src = k; f.style.cssText = 'width:400px;height:300px'; document.body.appendChild(f); }, CIM + '/foglalas-ok-mi?first_booking=true&price=24900');
  await p.waitForTimeout(5000);
  ok('regi beagyazott naptar: a keretben a koszonooldal mer (GTM betolt), ha a motor nem veszi at', keretKeres.length >= 1, String(keretKeres.length));
  await ctx.close();
}

await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
