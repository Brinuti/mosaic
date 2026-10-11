// A sajat suti-sav (assets/js/suti.js) probaja ELES DOMAINNEL, de adatkuldes nelkul (mint a meres-teszt):
//
//   node tools/build.mjs && node tools/serve.mjs     (masik ablakban)
//   node tools/sav-teszt.mjs            (asztali)
//   node tools/sav-teszt.mjs --mobil
//
// A bongeszo a helyi kiszolgalot www.medicalpiercing.hu neven nyitja meg (a merokodok igy betoltenek); kifele csak
// a GTM / gtag.js / Meta / TikTok szkriptfajljai mehetnek, minden adatkuldo kerest elkapunk es eldobunk.
//
// Ellenorzi:
//   - dontes elott: a sav latszik (Elfogadom / Elutasitom / Beallitasok, /adatkezeles link); Meta, TikTok, Convertize
//     NEM tolt es nem kuld; a Google Consent Mode alapallapota (ad_storage, ad_user_data, ad_personalization,
//     analytics_storage = denied) a gtag.js / GTM ELOTT van a dataLayer-ben; a GA4 suti nelkul (gcs=G100) mer;
//     foglalasi linkre kattintva GA4 foglalas_inditasa megy (suti nelkul), TikTok InitiateCheckout nem;
//     mobilon a sav nem takarja a fejlec "Idopontok" gombjat es a Wix gyorsmenu-savjat;
//   - "Elfogadom": mp_suti=v1-s1-m1, Consent Mode update granted, Meta (PageView 1x), Convertize, TikTok betolt;
//   - "Elutasitom": mp_suti=v1-s0-m0, sem azonnal, sem a kovetkezo oldalon nincs Meta / TikTok / Convertize, sav nincs;
//   - lablec "Suti beallitasok": a beallitasok nyilnak, csak statisztika -> mp_suti=v1-s1-m0, Meta nincs;
//   - koszonooldal (/foglalas-ok-mi) elfogadott hozzajarulassal: nincs fbq, nincs Meta-keres;
//   - ?motor=1: a foglalomotor megnyilik (dontes elott, a sav mellett is).
import { chromium, devices } from './pw.mjs';

const PORT = +process.env.PORT || 4290;
const CIM = `http://www.medicalpiercing.hu:${PORT}`;
const MOBIL = process.argv.includes('--mobil');
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${MOBIL ? 'mobil' : 'asztali'}: ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; };
const SZABAD = /^https:\/\/(www\.googletagmanager\.com\/(gtm|gtag\/js)|connect\.facebook\.net\/(en_US\/fbevents\.js|signals\/config\/)|analytics\.tiktok\.com\/i18n\/pixel\/|medicalpiercing\.salonic\.hu\/(selectSpecialization|showServices|selectDate)\/|api\.salonic\.hu\/calendar\/getAvailableTimes)/;
const MARKETING = /facebook|tiktok|convertize/;
const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
const OPT = MOBIL ? { ...devices['Pixel 5'], userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' } : { viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };

async function kornyezet(suti) {
  const ctx = await b.newContext(OPT);
  if (suti) await ctx.addCookies([{ name: 'mp_suti', value: suti, domain: 'www.medicalpiercing.hu', path: '/' }]);
  const ki = [], betolt = [];
  await ctx.route((u) => !u.toString().startsWith(CIM), (r) => {
    const u = r.request().url();
    if (SZABAD.test(u) && r.request().method() === 'GET') { betolt.push(u); return r.continue(); }
    ki.push({ u, d: r.request().postData() || '' });
    return r.abort();
  });
  return { ctx, ki, betolt };
}
const marketingKeres = (ki, betolt) => [...betolt, ...ki.map((x) => x.u)].filter((u) => MARKETING.test(u));
const varGtm = async (p, betolt) => { for (let i = 0; i < 40 && !betolt.some((u) => /gtm\.js\?id=GTM-T9GR4JCK/.test(u)); i++) await p.waitForTimeout(250); await p.waitForTimeout(3000); };
const sutiErtek = async (ctx) => ((await ctx.cookies()).find((c) => c.name === 'mp_suti') || {}).value || null;
const savLathato = (p) => p.evaluate(() => { const s = document.getElementById('mp-cc'); return !!s && getComputedStyle(s).display !== 'none'; });
const savGomb = (p, mit) => p.locator(`#mp-cc [data-mp="${mit}"]:visible`).first();

// 1. dontes elott
{
  const { ctx, ki, betolt } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(CIM + '/a-migren-piercing-gyogyulasi-ideje', { waitUntil: 'load' });
  await varGtm(p, betolt);
  ok('dontes elott: a sav latszik', await savLathato(p));
  const szoveg = await p.evaluate(() => document.getElementById('mp-cc').innerText);
  ok('a sav magyar, Elfogadom + Elutasitom + Beallitasok', /Elfogadom/.test(szoveg) && /Elutasítom/.test(szoveg) && /Beállítások/.test(szoveg) && /Sütiket használunk/.test(szoveg));
  ok('link az /adatkezeles oldalra', await p.evaluate(() => !!document.querySelector('#mp-cc a[href="/adatkezeles"]')));
  const meret = await p.evaluate(() => [...document.querySelectorAll('#mp-cc-fo .mp-gomb')].map((g) => { const s = getComputedStyle(g); return [g.offsetHeight, s.backgroundColor, s.color, s.fontWeight, s.fontSize].join('|'); }));
  ok('Elfogadom es Elutasitom egyenrangu (azonos meret es stilus)', meret.length === 2 && meret[0] === meret[1], meret.join(' / '));
  ok('dontes elott: nincs Meta, TikTok, Convertize keres', !marketingKeres(ki, betolt).length, marketingKeres(ki, betolt).slice(0, 3).join(' '));
  ok('dontes elott: nincs fbq / ttq', await p.evaluate(() => !window.fbq && !window.ttq));
  const cm = await p.evaluate(() => {
    const dl = window.dataLayer.map((x) => (x && typeof x === 'object' && 'length' in x ? Array.from(x) : x));
    const d = dl.findIndex((x) => Array.isArray(x) && x[0] === 'consent' && x[1] === 'default');
    const gtm = dl.findIndex((x) => x && x.event === 'gtm.js');
    const js = dl.findIndex((x) => Array.isArray(x) && x[0] === 'js');
    return { d, gtm, js, alap: d >= 0 ? dl[d][2] : null, frissites: dl.some((x) => Array.isArray(x) && x[0] === 'consent' && x[1] === 'update') };
  });
  const a = cm.alap || {};
  ok('Consent Mode default: ad_storage, ad_user_data, ad_personalization, analytics_storage = denied', a.ad_storage === 'denied' && a.ad_user_data === 'denied' && a.ad_personalization === 'denied' && a.analytics_storage === 'denied', JSON.stringify(a));
  ok('Consent Mode default a gtag/GTM elott, update nincs', cm.d >= 0 && cm.d < cm.gtm && cm.d < cm.js && !cm.frissites, JSON.stringify({ default: cm.d, js: cm.js, gtm: cm.gtm }));
  ok('GTM es Google Ads gtag.js betolt (Consent Mode)', betolt.some((u) => /gtm\.js\?id=GTM-T9GR4JCK/.test(u)) && betolt.some((u) => /gtag\/js\?id=AW-11097894040/.test(u)));
  const ga = ki.filter((x) => /tid=G-SJT2RN62H8/.test(x.u));
  ok('GA4 suti nelkul mer (gcs=G100)', ga.length > 0 && ga.every((x) => /[?&]gcs=G100/.test(x.u)), ga.map((x) => (x.u.match(/[?&]gcs=([^&]+)/) || [])[1]).join(','));
  ok('dontes elott: nincs mp_suti suti', !(await sutiErtek(ctx)));
  if (MOBIL) {
    const fedes = await p.evaluate(() => {
      const s = document.getElementById('mp-cc').getBoundingClientRect();
      const at = (r) => r && r.width && !(r.bottom <= s.top || r.top >= s.bottom || r.right <= s.left || r.left >= s.right);
      const fej = document.getElementById('SITE_HEADER'), q = document.getElementById('QUICK_ACTION_BAR');
      const idopont = [...document.querySelectorAll('#SITE_HEADER a')].find((x) => /Időpont/i.test(x.innerText));
      return { fej: at(fej && fej.getBoundingClientRect()), idopont: at(idopont && idopont.getBoundingClientRect()), q: at(q && q.offsetHeight ? q.getBoundingClientRect() : null), magas: Math.round(s.height), also: Math.round(innerHeight - s.bottom) };
    });
    ok('mobil: a sav nem takarja a fejlec "Idopontok" gombjat es a gyorsmenu-savot', !fedes.fej && !fedes.idopont && !fedes.q, JSON.stringify(fedes));
    ok('mobil: a sav legfeljebb a kepernyo harmada', fedes.magas < 844 / 3, fedes.magas + ' px');
    ok('mobil: a sav az also szelen all (nem lebeg a tartalom kozepen)', fedes.also <= 1, fedes.also + ' px az alsotol');
  }
  // foglalasi link dontes nelkul: GA4 foglalas_inditasa (suti nelkul) igen, TikTok nem
  const elotte = ki.length;
  await p.evaluate(() => { const a = [...document.querySelectorAll('a[href^="https://medicalpiercing.salonic.hu"]')].find((x) => x.offsetParent !== null); a.click(); });
  // a motor (nincs lapelhagyas) mellett a GA4 kotege kesobb megy el: legfeljebb 10 mp-ig varjuk a foglalas_inditasa keresre
  for (let i = 0; i < 40 && !ki.slice(elotte).some((x) => /[?&]en=foglalas_inditasa/.test(x.u)); i++) await p.waitForTimeout(250);
  await p.waitForTimeout(500);
  const uj = ki.slice(elotte);
  ok('dontes elott: foglalasi kattintas -> GA4 foglalas_inditasa (gcs=G100)', uj.some((x) => /[?&]en=foglalas_inditasa/.test(x.u) && /[?&]gcs=G100/.test(x.u)), uj.filter((x) => /en=/.test(x.u)).map((x) => (x.u.match(/[?&]en=([^&]+)/) || [])[1]).join(','));
  ok('dontes elott: foglalasi kattintas -> nincs TikTok', !uj.some((x) => /tiktok/.test(x.u)));
  // a foglalomotor (100%-os kapcsolo) a foglalasi kattintasra megnyilik es eltakarja a savot: bezarjuk, hogy a gombjai elerhetok legyenek
  await p.evaluate(() => { const h = document.querySelector('[data-mp-motor]'); const x = h && h.shadowRoot.querySelector('[data-bezar]'); if (x) x.click(); });

  // 2. Elfogadom (ugyanazon az oldalon)
  await savGomb(p, 'elfogad').click();
  for (let i = 0; i < 40 && !betolt.some((u) => /fbevents\.js/.test(u)); i++) await p.waitForTimeout(250);
  await p.waitForTimeout(4000);
  ok('Elfogadom: mp_suti = v1-s1-m1', /^v1-s1-m1-t\d+$/.test(await sutiErtek(ctx) || ''), await sutiErtek(ctx));
  ok('Elfogadom: a sav eltunik', !(await savLathato(p)));
  const upd = await p.evaluate(() => window.dataLayer.map((x) => (x && typeof x === 'object' && 'length' in x ? Array.from(x) : x)).filter((x) => Array.isArray(x) && x[0] === 'consent' && x[1] === 'update').pop());
  ok('Elfogadom: Consent Mode update granted', upd && upd[2].ad_storage === 'granted' && upd[2].analytics_storage === 'granted' && upd[2].ad_user_data === 'granted' && upd[2].ad_personalization === 'granted', JSON.stringify(upd && upd[2]));
  ok('Elfogadom: Meta-pixel betolt, PageView egyszer', betolt.filter((u) => /fbevents\.js/.test(u)).length === 1 && ki.filter((x) => /facebook\.com\/tr\/?\?id=2177829632420786&ev=PageView/.test(x.u)).length === 1, ki.filter((x) => /facebook\.com\/tr/.test(x.u)).length + ' Meta-keres');
  ok('Elfogadom: Convertize betolt', ki.some((x) => /pixel\.convertize\.io\/11722\.js/.test(x.u)));
  const ttMost = betolt.some((u) => /analytics\.tiktok\.com\/i18n\/pixel\//.test(u));
  // a TikTok-pixelt a GTM tolti (ad_storage-hozzajarulashoz kotott cimke): a GTM a hozzajarulas utan maga potolja
  await p.goto(CIM + '/rolunk', { waitUntil: 'load' });
  await varGtm(p, betolt);
  ok('Elfogadom: TikTok-pixel betolt (GTM)', betolt.some((u) => /analytics\.tiktok\.com\/i18n\/pixel\//.test(u)), ttMost ? 'mar ugyanazon az oldalon' : 'a kovetkezo oldalon');
  ok('Elfogadom utan a kovetkezo oldalon: nincs sav', !(await savLathato(p)));
  await ctx.close();
}

// 3. Elutasitom
{
  const { ctx, ki, betolt } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(CIM + '/rolunk', { waitUntil: 'load' });
  await varGtm(p, betolt);
  await savGomb(p, 'elutasit').click();
  await p.waitForTimeout(4000);
  ok('Elutasitom: mp_suti = v1-s0-m0', /^v1-s0-m0-t\d+$/.test(await sutiErtek(ctx) || ''), await sutiErtek(ctx));
  await p.goto(CIM + '/migren-piercing', { waitUntil: 'load' });
  await varGtm(p, betolt);
  ok('Elutasitom: sem azonnal, sem a kovetkezo oldalon nincs Meta / TikTok / Convertize', !marketingKeres(ki, betolt).length, marketingKeres(ki, betolt).slice(0, 3).join(' '));
  ok('Elutasitom: a kovetkezo oldalon nincs sav', !(await savLathato(p)));
  const ga = ki.filter((x) => /tid=G-SJT2RN62H8/.test(x.u));
  ok('Elutasitom: GA4 suti nelkul (gcs=G100)', ga.length > 0 && ga.every((x) => /[?&]gcs=G100/.test(x.u)));
  // lablec: a dontes modosithato
  const link = p.locator('#mp-cc-lablec');
  ok('lablec: "Suti beallitasok" link', (await link.count()) === 1);
  await link.scrollIntoViewIfNeeded();
  await link.click();
  ok('lablec: a beallitasok nyilnak, a negyzetek a dontes szerint uresek', await p.evaluate(() => getComputedStyle(document.getElementById('mp-cc-beall')).display !== 'none' && !document.getElementById('mp-cc-stat').checked && !document.getElementById('mp-cc-mark').checked));
  await p.locator('#mp-cc-stat').check();
  await savGomb(p, 'mentes').click();
  await p.waitForTimeout(2500);
  ok('csak statisztika: mp_suti = v1-s1-m0, Meta / TikTok / Convertize tovabbra sincs', /^v1-s1-m0-t\d+$/.test(await sutiErtek(ctx) || '') && !marketingKeres(ki, betolt).length, await sutiErtek(ctx));
  await ctx.close();
}

// 4. koszonooldal elfogadott hozzajarulassal: nincs Meta
{
  const { ctx, ki, betolt } = await kornyezet(`v1-s1-m1-t${Math.floor(Date.now() / 1000)}`);
  const p = await ctx.newPage();
  const bu = encodeURIComponent(`https://medicalpiercing.salonic.hu/selectDate/?placeId=6029&serviceId=1&employeeId=1&startDate=${1800000000 + Math.floor(Math.random() * 1e6)}`);
  await p.goto(`${CIM}/foglalas-ok-mi?first_booking=1&bookingUrl=${bu}&price=25000`, { waitUntil: 'load' });
  await varGtm(p, betolt);
  ok('koszonooldal (elfogadva): nincs fbq, nincs Meta-keres', !(await p.evaluate(() => !!window.fbq)) && ![...betolt, ...ki.map((x) => x.u)].some((u) => /facebook/.test(u)));
  ok('koszonooldal (elfogadva): GTM fut, a sav nem latszik', betolt.some((u) => /gtm\.js\?id=GTM-T9GR4JCK/.test(u)) && !(await savLathato(p)));
  await ctx.close();
}

// 5. a foglalomotor ?motor=1-gyel, dontes elott (a sav latszik)
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(CIM + '/a-migren-piercing-gyogyulasi-ideje?motor=1', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  ok('motor: a sav latszik', await savLathato(p));
  await p.evaluate(() => {
    const l = [...document.querySelectorAll('a[href]')].filter((a) => /^https:\/\/medicalpiercing\.salonic\.hu\/(selectLocation|selectSpecialization|showServices|employees|selectEmployee|selectDate)/i.test(a.href));
    const a = l.find((x) => x.offsetParent !== null) || l[0];
    a.scrollIntoView({ block: 'center' }); a.click();
  });
  let megvan = false;
  for (let i = 0; i < 100 && !megvan; i++) { megvan = await p.evaluate(() => { const r = document.querySelector('[data-mp-motor]')?.shadowRoot; if (!r) return false; const t = r.querySelector('[data-tipus="uj"]'); if (t) t.click(); return !!r.querySelector('[data-hely]'); }); if (!megvan) await p.waitForTimeout(250); }
  ok('motor: ?motor=1-gyel megnyilik (15 helyszin)', megvan && (await p.evaluate(() => document.querySelector('[data-mp-motor]').shadowRoot.querySelectorAll('[data-hely]').length)) === 15);
  await ctx.close();
}

await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
