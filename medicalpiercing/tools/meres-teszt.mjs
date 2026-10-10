// A merokodok es a koszonooldal-lanc probaja ELES DOMAINNEL, de adatkuldes nelkul.
//
//   node tools/build.mjs && node tools/serve.mjs     (masik ablakban)
//   node tools/meres-teszt.mjs
//
// A bongeszo a helyi kiszolgalot www.medicalpiercing.hu neven nyitja meg (igy a suti.js betolti a
// merokodokat), de kifele csak a szkriptfajlok letoltese mehet (GTM, Meta, TikTok): minden
// adatkuldo kerest (GA4 / stape, Google Ads, Meta, TikTok, Convertize, CookieYes) elkapunk,
// feljegyzunk es eldobunk - egyik platformhoz sem jut el semmi.
//
// Ellenorzi:
//   - normal oldalon: CookieYes, AW-11097894040, GTM-T9GR4JCK, Meta-pixel 2177829632420786 betolt,
//     a Meta PageView es a GA4 page_view pontosan egyszer menne ki;
//   - a 13 koszonooldalon (/foglalas-ok*): 200, nincs atiranyitas / ujratoltes, a parameterek
//     megmaradnak, a Meta-pixel semmit nem tolt es nem kuld; a GTM fut;
//   - a foglalasi linkek viszik a gclid / fbclid / ttclid / utm_* parametereket, a parameterek a
//     munkamenetben megmaradnak (mint a Wixen);
//   - a medicalpiercing/ kodban nincs Mosaic-azonosito.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';

const PORT = +process.env.PORT || 4290;
const CIM = `http://www.medicalpiercing.hu:${PORT}`;
const ROOT = path.resolve(import.meta.dirname, '..');
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; };

// csak ezek a szkriptek tolthetok le kivulrol; minden mas kulso keres eldobva
const SZABAD = /^https:\/\/(www\.googletagmanager\.com\/(gtm|gtag\/js)|connect\.facebook\.net\/(en_US\/fbevents\.js|signals\/config\/)|analytics\.tiktok\.com\/i18n\/pixel\/)/;
const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
// a Meta-pixel a "HeadlessChrome" bongeszonek nem kuld: rendes Chrome-azonosito
const ASZTALI = { viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };
const MOBIL = { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };

async function megnyit(ut, ctx) {
  const p = await ctx.newPage();
  const ki = [], betolt = [], navigaciok = [];
  await p.route((u) => !u.toString().startsWith(CIM), (r) => {
    const u = r.request().url();
    if (SZABAD.test(u) && r.request().method() === 'GET') { betolt.push(u); return r.continue(); }
    ki.push(u); return r.abort();
  });
  p.on('framenavigated', (f) => { if (f === p.mainFrame()) navigaciok.push(f.url()); });
  await p.goto(CIM + ut, { waitUntil: 'load' });
  await p.waitForTimeout(6000);
  return { p, ki, betolt, navigaciok };
}
const db = (lista, re) => lista.filter((u) => re.test(u)).length;

// 1. normal oldal
{
  const ctx = await b.newContext(ASZTALI);
  const { p, ki, betolt } = await megnyit('/rolunk', ctx);
  ok('CookieYes betoltes', db(ki, /cdn-cookieyes\.com\/client_data\/a46a34517503eaa18c4543f0d0696746/) === 1);
  ok('Google Ads AW-11097894040 (gtag.js)', db(betolt, /gtag\/js\?id=AW-11097894040/) === 1);
  ok('GTM-T9GR4JCK', db(betolt, /gtm\.js\?id=GTM-T9GR4JCK/) === 1);
  ok('Meta-pixel alapkod (fbevents.js)', db(betolt, /fbevents\.js/) === 1);
  ok('Meta PageView pontosan egyszer', db(ki, /facebook\.com\/tr\/?\?id=2177829632420786&ev=PageView/) === 1, String(db(ki, /facebook\.com\/tr/)) + ' Meta-keres');
  ok('GA4 G-SJT2RN62H8 page_view pontosan egyszer', db(ki, /tid=G-SJT2RN62H8.*[?&]en=page_view/) === 1, ki.filter((u) => /G-SJT2RN62H8/.test(u)).map((u) => (u.match(/[?&]en=([^&]+)/) || [])[1]).join(','));
  ok('TikTok-pixel CU2CR03C77UAQJITQK80 betolt (GTM)', db(betolt, /sdkid=CU2CR03C77UAQJITQK80/) >= 1);
  ok('Facebook domain-igazolo meta-cimke', await p.$eval('meta[name="facebook-domain-verification"]', (m) => m.content).catch(() => null) === 'oj1ahwm1kfvzw0sunuigz3uhlbozp3');
  await ctx.close();
}

// 2. koszonooldalak
const KOSZONO = ['', '-mi', '-shenmen', '-klimax', '-slim', '-allergia', '-maj', '-lep', '-vastagbel', '-2piercing', '-3piercing', '-4piercing', '-6piercing'];
const PARAM = '?first_booking=1&location=Budapest&employee=Teszt%20Elek&bookingUrl=' + encodeURIComponent('https://medicalpiercing.salonic.hu/selectDate/?placeId=6029&serviceId=1&employeeId=1&startDate=1791700000') + '&price=25000&service=Migr%C3%A9n%20piercing&g=123&category=Migr%C3%A9n';
for (const [i, s] of KOSZONO.entries()) {
  const ctx = await b.newContext(i % 2 ? MOBIL : ASZTALI);
  const ut = '/foglalas-ok' + s;
  const { p, ki, betolt, navigaciok } = await megnyit(ut + PARAM, ctx);
  // a valasz kozvetlenul a helyi kiszolgalotol (nem a bongeszon at: annak a domain-atiranyitasa itt nem el)
  const v = await fetch(`http://127.0.0.1:${PORT}${ut}${PARAM}`, { redirect: 'manual' });
  ok(`${ut}: 200, atiranyitas nelkul`, v.status === 200, String(v.status));
  ok(`${ut}: a cim es a parameterek valtozatlanok, nincs ujratoltes`, p.url() === CIM + ut + PARAM && navigaciok.length === 1, `${navigaciok.length} navigacio`);
  ok(`${ut}: Meta-pixel semmit nem tolt / kuld`, !db(betolt, /facebook/) && !db(ki, /facebook/) && !(await p.$('noscript img[src*="facebook"]')));
  ok(`${ut}: GTM fut`, db(betolt, /gtm\.js\?id=GTM-T9GR4JCK/) === 1);
  await ctx.close();
}

// 3. parameterek: megorzes es foglalasi linkek
{
  const ctx = await b.newContext(ASZTALI);
  const { p } = await megnyit('/rolunk?gclid=G1&fbclid=F1&ttclid=T1&utm_source=teszt&utm_campaign=k1&egyeb=x', ctx);
  const linkek = await p.$$eval('a[href*="salonic.hu"]', (l) => l.map((a) => a.href));
  const mind = linkek.filter((h) => /medicalpiercing\.salonic\.hu/i.test(h));
  ok('foglalasi linkek: gclid, fbclid, ttclid, utm_* tovabb', mind.length > 0 && mind.every((h) => /[?&]gclid=G1/.test(h) && /[?&]fbclid=F1/.test(h) && /[?&]ttclid=T1/.test(h) && /[?&]utm_source=teszt/.test(h) && /[?&]utm_campaign=k1/.test(h)), `${mind.length} link, pl. ${mind[0]}`);
  ok('foglalasi linkek: mas parameter nem megy at', mind.every((h) => !/[?&]egyeb=/.test(h)));
  // parameter nelkuli kovetkezo oldal: a Wixhez hasonloan visszakerulnek a cimbe
  await p.goto(CIM + '/elerhetosegek', { waitUntil: 'load' });
  await p.waitForTimeout(500);
  ok('munkamenet: a parameterek visszakerulnek a cimbe', /gclid=G1/.test(p.url()) && /utm_source=teszt/.test(p.url()), p.url());
  const l2 = await p.$$eval('a[href*="medicalpiercing.salonic.hu"]', (l) => l.map((a) => a.href));
  ok('munkamenet: a kovetkezo oldal foglalasi linkjei is viszik', l2.length > 0 && l2.every((h) => /gclid=G1/.test(h)));
  // parameteres foglalasi link (blogbejegyzes): a sajat parameterei megmaradnak, a kattintas-azonositok hozzajonnek
  await p.goto(CIM + '/a-daith-piercing-hatasa-igy-mukodik', { waitUntil: 'load' });
  await p.waitForTimeout(500);
  const l3 = await p.$$eval('a[href*="medicalpiercing.salonic.hu/showServices"]', (l) => l.map((a) => a.href));
  ok('foglalasi linkek: a link sajat parameterei megmaradnak', l3.length > 0 && l3.every((h) => /placeId=6029/.test(h) && /employeeId=13509/.test(h) && /gclid=G1/.test(h)), l3[0]);
  await ctx.close();
}

// 4. nincs Mosaic-azonosito a medicalpiercing kodjaban
{
  const mosaic = fs.readFileSync(path.join(ROOT, '../assets/js/suti.js'), 'utf8');
  const azonositok = [...new Set((mosaic.match(/\b(GTM-[A-Z0-9]{6,}|AW-\d{8,}|G-[A-Z0-9]{8,}|\d{15,16}|[A-Z0-9]{20})\b/g) || []))]
    .filter((x) => !/^(GTM-T9GR4JCK|AW-11097894040|G-SJT2RN62H8|2177829632420786|CU2CR03C77UAQJITQK80)$/.test(x));
  const fajlok = ['assets/js/suti.js', 'assets/js/klon.js', 'functions/[[path]].js', 'lib/kitelepulesek.js', 'lib/utvonal.js', 'wrangler.toml'];
  const talalat = [];
  for (const f of fajlok) { const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); for (const a of azonositok) if (t.includes(a)) talalat.push(`${f}: ${a}`); }
  ok('nincs Mosaic-azonosito a medicalpiercing kodban', !talalat.length, talalat.join(', ') || `${azonositok.length} Mosaic-azonositot kerestunk`);
}

await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
