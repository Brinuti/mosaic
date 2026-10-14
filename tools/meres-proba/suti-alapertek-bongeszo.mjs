// SUTI-SAV LEVETELE (meresi oldal DECISION #170) - bongeszo-ellenorzes: a VALODI suti.js, valodi Chromium, helyi dist.
//   - uj latogato: nincs sav; Consent Mode alapertek = analytics_storage / ad_storage / ad_user_data / ad_personalization granted, functionality_storage denied;
//   - korabban tarolt dontes (sajat tarolo mh_cc / Wix consent-policy suti, elutasitas vagy reszleges tiltas) FELULIRJA az alaperteket, a GTM betoltese ELOTT;
//   - "reszleges" bejegyzes (csak a funkcionalis volt engedve) a statisztikarol / marketingrol nem dont: alapertek; a terkep-engedelyezes nem vonja vissza a granted-et;
//   - lablec "Suti beallitasok" link: megnyitja a beallitast (a bepipalas a hatalyos allapot), mentes utan a Consent Mode frissul, az allapot megmarad (ujratoltes utan is);
//   - visszavonas (statisztika / marketing ki) utan ertesites az ujratoltesrol; elfogadas utan nincs ertesites;
//   - a consent-mod es a forrasa kiolvashato (mhSuti.mod(), dataLayer: mh_consent_init / mh_consent_valtozas);
//   - VEDETT: a Meta-pixel logika (PIXEL_OLDALAK) valtozatlan: az index pixelje betolt, a listan kivuli oldal nem kap pixelt.
// Az eles domain (www.mosaicheadspa.hu) oldalait a helyi dist/-bol szolgaljuk ki (route), HOGY a suti.js "eles" agai (GTM, GA4, Meta) is lefussanak;
// MINDEN mas kulso host tiltva (a kerest megprobalja, de a Playwright megszakitja) - semmi nem jut el semmilyen hirdetesi / mero rendszerhez. Az /api/* 204-et kap.
// Futtatas:  node tools/meres-proba/suti-alapertek-bongeszo.mjs [--dist dist] [--ki meres-naplo/<fajl>.json]
// Kornyezet: PLAYWRIGHT_UTVONAL (a playwright-core szulomappaja), CHROME_UTVONAL.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const arg = (nev, alap) => { const i = process.argv.indexOf('--' + nev); return i >= 0 ? process.argv[i + 1] : alap; };
const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.resolve(GYOKER, arg('dist', 'dist'));
const KI = arg('ki', null);
const PW = process.env.PLAYWRIGHT_UTVONAL || '/opt/node22/lib/node_modules/playwright/node_modules';
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const { chromium } = createRequire(path.join(PW, 'x.js'))('playwright-core');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const ELES = 'https://www.mosaicheadspa.hu';
const GTM_ID = 'GTM-PST2HB22';
const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789';

const eredmenyek = [];
const ell = (nev, ok, adat) => { eredmenyek.push({ nev, ok: !!ok, adat: adat === undefined ? null : adat }); };
const megfigyeles = [];
const megf = (nev, adat) => { megfigyeles.push({ nev, adat }); };

// a dist fajlja az utvonalhoz (asztali: _a, mobil: _m az oldalakhoz; a statikus fajlok a gyokerbol)
function fajl(p, mobil) {
  const oldalak = mobil ? ['/_m'] : ['/_a'];
  const jeloltek = [p, ...oldalak.flatMap((o) => [o + (p === '/' ? '/fooldal' : p) + '.html'])]; // a fooldal a dist-ben "fooldal.html" (netlify/lib/utvonal.js)
  for (const j of jeloltek) {
    const f = path.join(DIST, j);
    if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

async function ujLap(bongeszo, { mobil = false, init = null, suti = null } = {}) {
  const ctx = await bongeszo.newContext(mobil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' } : { viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  ctx.setDefaultTimeout(6000);
  if (suti) await ctx.addCookies(suti);
  if (init) await ctx.addInitScript(init);
  const lap = await ctx.newPage();
  const hibak = [], kulso = [];
  lap.on('pageerror', (e) => hibak.push(String(e.message || e).slice(0, 160)));
  await lap.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    // a keret-tesztekhez (11): egy idegen eredetu szulo-oldal, amely az eles oldalt keretben tolti be (az osszehasonlito eszkoz helyzete)
    if (u.origin === 'https://keret.example') return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><iframe src="${ELES}/aszf" width="600" height="400"></iframe>` });
    if (u.origin === ELES) {
      if (u.pathname.startsWith('/api/')) return r.fulfill({ status: 204, body: '' });
      // a sajat merokeretunk (MERO_KERET): azonos eredetu szulo, a keret data-ah-regi-konverzio attributumot visel (assets/js/ajandek.js, regiKonverzio)
      if (u.pathname === '/__merokeret') return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><iframe data-ah-regi-konverzio src="/aszf" width="600" height="400"></iframe>' });
      const f = fajl(decodeURIComponent(u.pathname), mobil);
      if (!f) return r.fulfill({ status: 404, contentType: 'text/plain', body: 'nincs' });
      return r.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', headers: { 'cache-control': 'no-store' }, body: fs.readFileSync(f) });
    }
    kulso.push(u.hostname + u.pathname + (u.hostname.includes('googletagmanager') ? u.search.slice(0, 60) : ''));
    return r.abort('blockedbyclient'); // SEMMI nem megy ki
  });
  return { ctx, lap, hibak, kulso };
}
// a dataLayer olvashato alakban: gtag-hivasok { gtag: [...] }, esemenyek { event, ... }
const dl = (lap) => lap.evaluate(() => window.dataLayer.map((e) => ((e && typeof e.length === 'number' && typeof e[0] === 'string')
  ? { gtag: Array.from(e).map((x) => (x instanceof Date ? 'date' : (x && typeof x === 'object' ? { ...x } : x))) }
  : { ...e })));
const consentSorok = (adat, tipus) => adat.filter((e) => e.gtag && e.gtag[0] === 'consent' && e.gtag[1] === tipus).map((e) => e.gtag[2]);
const gtmIndex = (adat) => adat.findIndex((e) => e.event === 'gtm.js');
const defaultIndex = (adat) => adat.findIndex((e) => e.gtag && e.gtag[0] === 'consent' && e.gtag[1] === 'default');
const GRANTED = { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' };
const DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };
const reszhalmaz = (o, k) => Object.keys(k).every((x) => o && o[x] === k[x]);
const tarolt = (lap) => lap.evaluate(() => ({ mhCc: localStorage.getItem('mh_cc'), mhAttr: localStorage.getItem('mh_attr'), suti: /(?:^|;\s*)consent-policy=/.test(document.cookie) }));
const var_ = (lap) => lap.waitForFunction(() => window.mhSuti && document.readyState !== 'loading', null, { timeout: 8000 }).then(() => lap.waitForTimeout(350)).catch(() => {});
// a mod() hianya (a regi suti.js) ne dobjon kivetelt: igy a negativ kontrollnal a consent-ellenorzesek HIBA-t jeleznek, nem omlik ossze a futas
const mod = (lap) => lap.evaluate(() => (window.mhSuti && typeof window.mhSuti.mod === 'function' ? window.mhSuti.mod() : {}));
// a localStorage-bejegyzes beallitasa EGYSZER (a sessionStorage-jelzovel, hogy az ujratoltes ne irja felul)
const MH_CC = (o) => `try { if (!sessionStorage.getItem('__be')) { localStorage.setItem('mh_cc', ${JSON.stringify(JSON.stringify({ v: 1, t: Date.now(), ...o }))}); sessionStorage.setItem('__be', '1'); } } catch (e) {}`;

const bongeszo = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  for (const mobil of [false, true]) {
    const E = mobil ? 'mobil 390px' : 'asztali 1280px';

    // 1) UJ LATOGATO: nincs sav; alapertek granted (a GTM ELOTT); fun denied; nincs tarolt dontes / suti; a consent-mod kiolvashato; a GTM betolt
    try { const { ctx, lap, hibak, kulso } = await ujLap(bongeszo, { mobil });
      await lap.goto(ELES + '/?gclid=' + GCLID, { waitUntil: 'load' }); await var_(lap);
      const adat = await dl(lap), m = await mod(lap), t = await tarolt(lap), def = consentSorok(adat, 'default');
      ell(`1) [${E}] uj latogato: a sav / doboz NEM latszik (a betoltes utan azonnal)`, (await lap.locator('#mh-cc').isVisible()) === false);
      await lap.waitForTimeout(1200);
      ell(`1) [${E}] ...1,2 mp mulva sem latszik (a SAV_AUTO = false miatt magatol soha nem jelenik meg)`, (await lap.locator('#mh-cc').isVisible()) === false && (await lap.locator('#mh-cc-reopen').isVisible()) === false);
      ell(`1) [${E}] Consent Mode default: analytics / ad_storage / ad_user_data / ad_personalization = granted`, def.length === 1 && reszhalmaz(def[0], GRANTED), def[0]);
      ell(`1) [${E}] ...functionality_storage denied (a terkep / velemenyek tovabbra is kifejezett engedellyel)`, def[0] && def[0].functionality_storage === 'denied', def[0]);
      ell(`1) [${E}] ...nincs wait_for_update (nincs mire varni)`, def[0] && def[0].wait_for_update === undefined, def[0]);
      ell(`1) [${E}] a default a GTM (gtm.js) ELOTT kerul a dataLayerbe`, defaultIndex(adat) >= 0 && gtmIndex(adat) > defaultIndex(adat), { default: defaultIndex(adat), gtm: gtmIndex(adat) });
      ell(`1) [${E}] a GTM betolt (a kerest megprobalta - a Playwright megszakitotta) es a GA4 gtag.js is`, kulso.some((h) => h.includes('googletagmanager.com/gtm.js?id=' + GTM_ID)) && kulso.some((h) => h.includes('googletagmanager.com/gtag/js')), kulso.filter((h) => h.includes('googletagmanager')));
      ell(`1) [${E}] mhSuti.mod(): alapertek_granted_v1 / uj_alapertek / ana + adv igen, fun nem`, m.mod === 'alapertek_granted_v1' && m.forras === 'uj_alapertek' && m.ana === true && m.adv === true && m.fun === false, m);
      const init = adat.find((e) => e.event === 'mh_consent_init');
      ell(`1) [${E}] dataLayer: mh_consent_init (mod + forras + 0/1 jelzok, szemelyes adat nelkul)`, !!init && init.mh_consent_mod === 'alapertek_granted_v1' && init.mh_consent_forras === 'uj_alapertek' && init.mh_consent_ana === 1 && init.mh_consent_adv === 1 && init.mh_consent_fun === 0 && Object.keys(init).length === 6, init);
      ell(`1) [${E}] nincs tarolt dontes (mh_cc), nincs Wix consent-policy suti (nem irunk hozzajarulast a latogato helyett)`, t.mhCc === null && t.suti === false, t);
      ell(`1) [${E}] engedely(): ana + adv igen, fun nem`, await lap.evaluate(() => [window.mhSuti.engedely('ana'), window.mhSuti.engedely('adv'), window.mhSuti.engedely('fun')].join()) === 'true,true,false');
      ell(`1) [${E}] attribucio.js a hatalyos (alapertek) hozzajarulast latja: a kattintas-azonosito eltarolodik (mh_attr)`, !!t.mhAttr && JSON.parse(t.mhAttr).google.gclid.ertek === GCLID, t.mhAttr && Object.keys(JSON.parse(t.mhAttr)));
      megf(`[${E}] uj latogato: a foglalaskor a szervernek kuldott hozz (attribucio.js hozzajarulas())`, await lap.evaluate(() => JSON.stringify(window.mhAttribucio.hozzajarulas())));
      ell(`1) [${E}] nincs kezeletlen JS-hiba`, hibak.length === 0, hibak);
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

    // 2) KORABBI ELUTASITAS (mh_cc): minden denied a GTM ELOTT; nincs sav; forras = korabbi_dontes; az attribucio nem ir
    try { const { ctx, lap, hibak } = await ujLap(bongeszo, { mobil, init: MH_CC({ fun: false, ana: false, adv: false }) });
      await lap.goto(ELES + '/?gclid=' + GCLID, { waitUntil: 'load' }); await var_(lap);
      const adat = await dl(lap), m = await mod(lap), t = await tarolt(lap), def = consentSorok(adat, 'default');
      ell(`2) [${E}] korabbi elutasitas: a default MINDEN denied, a GTM elott`, def.length === 1 && reszhalmaz(def[0], DENIED) && def[0].functionality_storage === 'denied' && gtmIndex(adat) > defaultIndex(adat), def[0]);
      ell(`2) [${E}] nincs sav; forras = korabbi_dontes; engedely hamis`, (await lap.locator('#mh-cc').isVisible()) === false && m.forras === 'korabbi_dontes' && !m.ana && !m.adv && !m.fun, m);
      ell(`2) [${E}] az attribucio.js nem ir (nincs marketing-hozzajarulas)`, t.mhAttr === null, t);
      ell(`2) [${E}] nincs kezeletlen JS-hiba`, hibak.length === 0, hibak);
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

    // 3) KORABBI RESZLEGES TILTAS (mh_cc: statisztika igen, marketing nem): ana granted, ad_* denied
    try { const { ctx, lap } = await ujLap(bongeszo, { mobil, init: MH_CC({ fun: true, ana: true, adv: false }) });
      await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
      const adat = await dl(lap), m = await mod(lap), def = consentSorok(adat, 'default');
      ell(`3) [${E}] reszleges tiltas: analytics granted, ad_storage / ad_user_data / ad_personalization denied, functionality granted`, def.length === 1 && def[0].analytics_storage === 'granted' && def[0].ad_storage === 'denied' && def[0].ad_user_data === 'denied' && def[0].ad_personalization === 'denied' && def[0].functionality_storage === 'granted', def[0]);
      ell(`3) [${E}] forras = korabbi_dontes; nincs sav`, m.forras === 'korabbi_dontes' && m.ana === true && m.adv === false && (await lap.locator('#mh-cc').isVisible()) === false, m);
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

    // 4) WIX consent-policy SUTI (korabbi Wix-dontes: mind elutasitva): denied; atkerul a sajat taroloba; forras = korabbi_dontes
    try { const ts = Math.floor(Date.now() / 6e4);
      const { ctx, lap } = await ujLap(bongeszo, { mobil, suti: [{ name: 'consent-policy', value: encodeURIComponent(JSON.stringify({ ess: 1, func: 0, anl: 0, adv: 0, dt3: 0, ts })), domain: 'www.mosaicheadspa.hu', path: '/', secure: true }] });
      await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
      const adat = await dl(lap), m = await mod(lap), t = await tarolt(lap), def = consentSorok(adat, 'default');
      ell(`4) [${E}] Wix-suti (elutasitva): default MINDEN denied a GTM elott; forras = korabbi_dontes; nincs sav`, def.length === 1 && reszhalmaz(def[0], DENIED) && gtmIndex(adat) > defaultIndex(adat) && m.forras === 'korabbi_dontes' && (await lap.locator('#mh-cc').isVisible()) === false, { def: def[0], m });
      ell(`4) [${E}] a Wix-dontes atkerult a sajat taroloba (mh_cc)`, !!t.mhCc && JSON.parse(t.mhCc).adv === false && JSON.parse(t.mhCc).wix === true, t.mhCc);
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

    // 5) "RESZLEGES" BEJEGYZES (csak a funkcionalis volt engedve): ana / adv = alapertek (granted), fun = igen
    try { const { ctx, lap } = await ujLap(bongeszo, { mobil, init: MH_CC({ fun: true, ana: false, adv: false, reszleges: true }) });
      await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
      const adat = await dl(lap), m = await mod(lap), def = consentSorok(adat, 'default');
      ell(`5) [${E}] reszleges bejegyzes: statisztika + marketing = alapertek (granted), funkcionalis = igen`, def.length === 1 && reszhalmaz(def[0], GRANTED) && def[0].functionality_storage === 'granted' && m.forras === 'uj_alapertek', { def: def[0], m });
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

    // 6) TERKEP-ENGEDELYEZES uj latogatonal (mhSuti.enged('fun')): a statisztika / marketing NEM vonodik vissza; a tarolt bejegyzesben ana / adv false marad (visszaallitas-biztos)
    try { const { ctx, lap } = await ujLap(bongeszo, { mobil });
      await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
      await lap.evaluate(() => window.mhSuti.enged('fun')); await lap.waitForTimeout(200);
      const adat = await dl(lap), m = await mod(lap), t = await tarolt(lap), upd = consentSorok(adat, 'update');
      const c = t.mhCc ? JSON.parse(t.mhCc) : null;
      ell(`6) [${E}] enged('fun'): a hatalyos ana + adv marad granted, fun granted`, m.ana === true && m.adv === true && m.fun === true, m);
      ell(`6) [${E}] ...a Consent Mode update: analytics / ad_* granted, functionality granted (nem vonodik vissza)`, upd.length === 1 && reszhalmaz(upd[0], GRANTED) && upd[0].functionality_storage === 'granted', upd[0]);
      ell(`6) [${E}] ...a tarolt bejegyzes reszleges, ana / adv false (egy visszaallitas utan sem szamit kifejezett engedelynek)`, !!c && c.reszleges === true && c.fun === true && c.ana === false && c.adv === false, c);
      ell(`6) [${E}] ...Wix-suti nem keletkezik (reszleges)`, t.suti === false, t);
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

    // 7) LABLEC-LINK -> beallitasok (a bepipalas a hatalyos allapot) -> MINDET ELUTASITOM: update denied, ertesites, tarolt dontes, Wix-suti; UJRATOLTES: denied a GTM elott
    try { const { ctx, lap, hibak } = await ujLap(bongeszo, { mobil });
      await lap.goto(ELES + '/?gclid=' + GCLID, { waitUntil: 'load' }); await var_(lap);
      ell(`7) [${E}] a lablec "Suti beallitasok" link megvan`, (await lap.locator('#mh-cc-lablec').count()) === 1);
      const attrElotte = (await tarolt(lap)).mhAttr; // a visszavonas elott az attribucio.js mh_attr-ja LETEZIK (a torles ellenorzesenek elofeltetele)
      await lap.locator('#mh-cc-lablec').click(); await lap.waitForTimeout(250);
      ell(`7) [${E}] a link megnyitja a beallitast; statisztika + marketing be van pipalva, funkcionalis nincs`, (await lap.locator('#mh-cc-settings').isVisible()) && (await lap.locator('#mh-cc-ana').isChecked()) && (await lap.locator('#mh-cc-adv').isChecked()) && !(await lap.locator('#mh-cc-fun').isChecked()));
      ell(`7) [${E}] a beallitasban jelzi, hogy a statisztikai / marketing sutik alapbol be vannak kapcsolva`, /alapértelmezetten be vannak kapcsolva/.test(await lap.locator('#mh-cc .mh-bev').innerText({ timeout: 2000 }).catch(() => '')));
      await lap.locator('#mh-cc [data-mh="reject"]').click(); await lap.waitForTimeout(250);
      const adat = await dl(lap), upd = consentSorok(adat, 'update'), t = await tarolt(lap), c = t.mhCc ? JSON.parse(t.mhCc) : null;
      ell(`7) [${E}] "Mindet elutasitom": Consent Mode update = minden denied`, upd.length === 1 && reszhalmaz(upd[0], DENIED), upd[0]);
      ell(`7) [${E}] ...mh_cc: ana / adv / fun false; Wix consent-policy suti is megirodik`, !!c && c.ana === false && c.adv === false && c.fun === false && !c.reszleges && t.suti === true, { c, suti: t.suti });
      const valt = adat.find((e) => e.event === 'mh_consent_valtozas');
      ell(`7) [${E}] dataLayer: mh_consent_valtozas, forras = modositott`, !!valt && valt.mh_consent_forras === 'modositott' && valt.mh_consent_ana === 0 && valt.mh_consent_adv === 0, valt);
      ell(`7) [${E}] visszavonas utan az ertesites latszik: ujratoltes szukseges`, (await lap.locator('#mh-cc-ertesites').isVisible()) && /töltse újra/.test(await lap.locator('#mh-cc-ertesites').innerText()) && !(await lap.locator('#mh-cc-settings').isVisible()));
      ell(`7) [${E}] az attribucio.js a visszavonaskor torli a tarolt adatot (a visszavonas ELOTT letezett, utana nincs mh_attr)`, !!attrElotte && t.mhAttr === null, { elotte: !!attrElotte, utana: t.mhAttr });
      ell(`7) [${E}] az ertesites az Ujratoltes gombra viszi a fokuszt (billentyuzettel elerheto), role = status`, (await lap.evaluate(() => (document.activeElement && document.activeElement.getAttribute('data-mh')) || '')) === 'reload' && (await lap.locator('#mh-cc-ertesites').getAttribute('role')) === 'status');
      if (!mobil) { await lap.waitForTimeout(21000); ell(`7) [${E}] az ertesites 21 mp mulva is latszik (nem tunik el magatol)`, await lap.locator('#mh-cc-ertesites').isVisible()); }
      try { await Promise.all([lap.waitForEvent('load', { timeout: 5000 }), lap.locator('#mh-cc-ertesites [data-mh="reload"]').click({ timeout: 5000 })]); } catch (e) { await lap.reload({ waitUntil: 'load' }); } await var_(lap); // (a regi kodban nincs ertesites: a teszt ekkor is vegigfut, a HIBA-sorok megjelennek)
      const adat2 = await dl(lap), m2 = await mod(lap), def2 = consentSorok(adat2, 'default');
      ell(`7) [${E}] ujratoltes utan: default MINDEN denied a GTM elott, forras = korabbi_dontes, nincs sav`, def2.length === 1 && reszhalmaz(def2[0], DENIED) && gtmIndex(adat2) > defaultIndex(adat2) && m2.forras === 'korabbi_dontes' && (await lap.locator('#mh-cc').isVisible()) === false, { def: def2[0], m2 });
      ell(`7) [${E}] nincs kezeletlen JS-hiba`, hibak.length === 0, hibak);
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

    // 8) KIVALASZTOTTAK MENTESE: csak a statisztika marad -> ad_* denied, analytics granted, ertesites (a marketing visszavonva)
    try { const { ctx, lap } = await ujLap(bongeszo, { mobil });
      await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
      await lap.evaluate(() => window.mhSuti.beallitasok()); await lap.waitForTimeout(200);
      await lap.locator('#mh-cc-adv').uncheck(); await lap.locator('#mh-cc [data-mh="save"]').click(); await lap.waitForTimeout(250);
      const adat = await dl(lap), upd = consentSorok(adat, 'update'), m = await mod(lap);
      ell(`8) [${E}] mentes (marketing ki): analytics granted, ad_storage / ad_user_data / ad_personalization denied`, upd.length === 1 && upd[0].analytics_storage === 'granted' && upd[0].ad_storage === 'denied' && upd[0].ad_user_data === 'denied' && upd[0].ad_personalization === 'denied', upd[0]);
      ell(`8) [${E}] ...ertesites latszik (marketing visszavonva); forras = modositott`, (await lap.locator('#mh-cc-ertesites').isVisible()) && m.forras === 'modositott' && m.ana === true && m.adv === false, m);
      await lap.locator('#mh-cc-ertesites [data-mh="close"]').click(); await lap.waitForTimeout(150);
      ell(`8) [${E}] a "Bezar" elrejti a dobozt`, (await lap.locator('#mh-cc').isVisible()) === false);
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

    // 9) MINDET ELFOGADOM a beallitasokbol: nincs visszavonas -> nincs ertesites, a doboz elrejtodik; minden granted (fun is)
    try { const { ctx, lap } = await ujLap(bongeszo, { mobil });
      await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
      await lap.evaluate(() => window.mhSuti.beallitasok()); await lap.waitForTimeout(200);
      await lap.locator('#mh-cc-settings [data-mh="accept"]').click(); await lap.waitForTimeout(250);
      const adat = await dl(lap), upd = consentSorok(adat, 'update'), c = JSON.parse((await tarolt(lap)).mhCc);
      ell(`9) [${E}] "Mindet elfogadom": update minden granted; nincs ertesites; a doboz elrejtodik`, upd.length === 1 && reszhalmaz(upd[0], GRANTED) && upd[0].functionality_storage === 'granted' && (await lap.locator('#mh-cc').isVisible()) === false && c.fun && c.ana && c.adv, { upd: upd[0], c });
      await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
  }

  // 10) VEDETT: a Meta-pixel logika valtozatlan (PIXEL_OLDALAK) - az index pixelje betolt (hozzajarulastol fuggetlenul), a listan kivuli oldal nem kap pixelt
  try { const { ctx, lap, kulso } = await ujLap(bongeszo);
    await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
    const q = await lap.evaluate(() => (window.fbq && window.fbq.queue ? window.fbq.queue.map((x) => Array.from(x).slice(0, 2)) : null));
    ell('10) index: a Meta-pixel (3473839859576758) init + PageView, a fbevents.js kerese megprobalva', !!q && q.some((x) => x[0] === 'init' && x[1] === '3473839859576758') && q.some((x) => x[0] === 'track' && x[1] === 'PageView') && kulso.some((h) => h.startsWith('connect.facebook.net/en_US/fbevents.js')), q);
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
  try { const { ctx, lap } = await ujLap(bongeszo, { init: MH_CC({ fun: false, ana: false, adv: false }) });
    await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
    const q = await lap.evaluate(() => (window.fbq && window.fbq.queue ? window.fbq.queue.map((x) => Array.from(x).slice(0, 2)) : null));
    ell('10) elutasitott latogato: a Meta-pixel logika valtozatlan (mint eddig: hozzajarulastol fuggetlenul betolt)', !!q && q.some((x) => x[0] === 'init' && x[1] === '3473839859576758'), q);
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
  try { const { ctx, lap } = await ujLap(bongeszo);
    const r = await lap.goto(ELES + '/aszf', { waitUntil: 'load' }); await var_(lap);
    const van = await lap.evaluate(() => typeof window.fbq !== 'undefined');
    ell('10) /aszf (a pixel-listan kivul): nincs Meta-pixel; a Consent Mode default itt is granted', r.status() === 200 && van === false && reszhalmaz(consentSorok(await dl(lap), 'default')[0], GRANTED));
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

  // 11) IDEGEN SZULOBE AGYAZOTT keret (az osszehasonlito eszkoz): valtozatlan viselkedes - nincs sav, nincs merokod (GTM nem toltodik), nincs JS-hiba
  try { const { ctx, lap, hibak, kulso } = await ujLap(bongeszo);
    await lap.goto('https://keret.example/', { waitUntil: 'load' }); await lap.waitForTimeout(1500);
    const keret = lap.frames().find((f) => f.url().includes('/aszf'));
    const adat = keret ? await keret.evaluate(() => ({ mhSuti: typeof window.mhSuti, sav: !!document.getElementById('mh-cc'), dl: window.dataLayer.filter((e) => e && e.event === 'gtm.js').length })) : null;
    ell('11) idegen szuloben levo keret: a suti.js betolt, DE nincs sav / doboz, nincs GTM-betoltes (gtm.js), nincs JS-hiba', !!keret && adat.mhSuti === 'object' && adat.sav === false && adat.dl === 0 && !kulso.some((h) => h.includes('gtm.js')) && hibak.length === 0, { adat, kulso: kulso.filter((h) => h.includes('googletagmanager')), hibak });
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
  // 12) A SAJAT MEROKERETUNK (MERO_KERET: azonos eredetu szulo, data-ah-regi-konverzio): a merokodok futnak (GTM betolt), a consent default granted, sav nincs
  try { const { ctx, lap, hibak, kulso } = await ujLap(bongeszo);
    await lap.goto(ELES + '/__merokeret', { waitUntil: 'load' }); await lap.waitForTimeout(1500);
    const keret = lap.frames().find((f) => f.url().includes('/aszf'));
    const adat = keret ? await keret.evaluate(() => ({ mod: window.mhSuti && window.mhSuti.mod ? window.mhSuti.mod() : null, sav: !!document.getElementById('mh-cc'), dl: window.dataLayer.map((e) => ((e && typeof e.length === 'number' && typeof e[0] === 'string') ? { gtag: Array.from(e).map((x) => (x && typeof x === 'object' && !(x instanceof Date) ? { ...x } : (x instanceof Date ? 'date' : x))) } : { ...e })) })) : null;
    const def = adat ? consentSorok(adat.dl, 'default') : [];
    ell('12) MERO_KERET: a consent default a GTM betoltese ELOTT megy, granted (uj latogato), nincs sav, nincs JS-hiba', !!keret && def.length === 1 && reszhalmaz(def[0], GRANTED) && defaultIndex(adat.dl) >= 0 && gtmIndex(adat.dl) > defaultIndex(adat.dl) && adat.sav === false && adat.mod && adat.mod.forras === 'uj_alapertek' && kulso.some((h) => h.includes('gtm.js?id=' + GTM_ID)) && hibak.length === 0, { def: def[0], gtm: adat && gtmIndex(adat.dl), kulso: kulso.filter((h) => h.includes('googletagmanager')), hibak });
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }

  // 13) LEJART (400 napos) tarolt ELUTASITAS: tovabbra is denied (egy regi elutasitasbol nem lesz csendben granted); forras = korabbi_dontes; nincs sav
  try { const { ctx, lap, hibak } = await ujLap(bongeszo, { init: MH_CC({ t: Date.now() - 400 * 864e5, fun: false, ana: false, adv: false }) });
    await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
    const adat = await dl(lap), m = await mod(lap), def = consentSorok(adat, 'default');
    ell('13) lejart elutasitas: a default MINDEN denied a GTM elott, forras = korabbi_dontes, nincs sav', def.length === 1 && reszhalmaz(def[0], DENIED) && gtmIndex(adat) > defaultIndex(adat) && m.forras === 'korabbi_dontes' && (await lap.locator('#mh-cc').isVisible()) === false && hibak.length === 0, { def: def[0], m, hibak });
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
  // 14) LEJART tarolt ENGEDELY (statisztika + marketing + funkcionalis): ana / adv granted marad, a funkcionalis lejart engedelye nem szamit (denied)
  try { const { ctx, lap } = await ujLap(bongeszo, { init: MH_CC({ t: Date.now() - 400 * 864e5, fun: true, ana: true, adv: true }) });
    await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
    const def = consentSorok(await dl(lap), 'default');
    ell('14) lejart engedely: analytics / ad_* granted, functionality denied (a funkcionalis lejart engedelye nem szamit)', def.length === 1 && reszhalmaz(def[0], GRANTED) && def[0].functionality_storage === 'denied' && (await mod(lap)).forras === 'korabbi_dontes', def[0]);
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
  // 15) RESZLEGES Wix-suti (statisztika igen, marketing nem): analytics granted, ad_* denied
  try { const ts = Math.floor(Date.now() / 6e4);
    const { ctx, lap } = await ujLap(bongeszo, { suti: [{ name: 'consent-policy', value: encodeURIComponent(JSON.stringify({ ess: 1, func: 0, anl: 1, adv: 0, dt3: 0, ts })), domain: 'www.mosaicheadspa.hu', path: '/', secure: true }] });
    await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
    const def = consentSorok(await dl(lap), 'default');
    ell('15) reszleges Wix-suti (anl:1, adv:0): analytics granted, ad_storage / ad_user_data / ad_personalization denied', def.length === 1 && def[0].analytics_storage === 'granted' && def[0].ad_storage === 'denied' && def[0].ad_user_data === 'denied' && def[0].ad_personalization === 'denied', def[0]);
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
  // 16) TILTOTT localStorage (privat mod / tiltott tarolo): nincs JS-hiba, a default granted, a beallitasok mukodnek (a localStorage nem elerheto; a Wix-suti iras / visszaolvasas kulon agon megy, ezt a teszt nem ellenorzi)
  try { const { ctx, lap, hibak } = await ujLap(bongeszo, { init: "try { Object.defineProperty(window, 'localStorage', { get() { throw new Error('tiltott'); } }); } catch (e) {}" });
    await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
    const def = consentSorok(await dl(lap), 'default');
    await lap.evaluate(() => window.mhSuti.beallitasok()); await lap.waitForTimeout(200);
    await lap.locator('#mh-cc [data-mh="reject"]').click(); await lap.waitForTimeout(250);
    const upd = consentSorok(await dl(lap), 'update');
    ell('16) tiltott localStorage: nincs JS-hiba, a default granted, a "Mindet elutasitom" az oldalon belul denied-et kuld', hibak.length === 0 && def.length === 1 && reszhalmaz(def[0], GRANTED) && upd.length === 1 && reszhalmaz(upd[0], DENIED), { hibak, def: def[0], upd: upd[0] });
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
  // 17) enged('fun') TAROLT ELUTASITAS mellett (terkep): a statisztika / marketing denied marad, a funkcionalis granted; a forras NEM lesz "modositott" (nem a beallitasokban tortent)
  try { const { ctx, lap } = await ujLap(bongeszo, { init: MH_CC({ fun: false, ana: false, adv: false }) });
    await lap.goto(ELES + '/', { waitUntil: 'load' }); await var_(lap);
    // a figyel() argumentuma a HATALYOS dontes: fun / ana / adv logikai ertekek
    await lap.evaluate(() => { window.__figyel = []; window.mhSuti.figyel((d) => window.__figyel.push(d)); });
    await lap.evaluate(() => window.mhSuti.enged('fun')); await lap.waitForTimeout(200);
    const m = await mod(lap), upd = consentSorok(await dl(lap), 'update'), arg = await lap.evaluate(() => window.__figyel);
    ell('17) enged(fun) tarolt elutasitas mellett: ana / adv denied marad, fun granted, forras = korabbi_dontes (nem modositott)', m.ana === false && m.adv === false && m.fun === true && m.forras === 'korabbi_dontes' && upd.length === 1 && upd[0].analytics_storage === 'denied' && upd[0].ad_storage === 'denied' && upd[0].functionality_storage === 'granted', { m, upd: upd[0] });
    ell('17) a figyel() egyszer fut, az argumentum { fun: true, ana: false, adv: false } logikai ertekekkel', arg.length === 1 && arg[0].fun === true && arg[0].ana === false && arg[0].adv === false && typeof arg[0].fun === 'boolean', arg);
    await ctx.close(); } catch (e) { ell('HIBA a teszt futasa kozben (kivetel): ' + String((e && e.message) || e).split('\n')[0].slice(0, 160), false); }
} finally { await bongeszo.close(); }

const naplo = { futtatva: new Date().toISOString(), leiras: 'suti-sav levetele (DECISION #170): valodi suti.js, valodi Chromium, helyi dist, minden kulso host tiltva', eredmeny: eredmenyek.every((x) => x.ok) ? 'PASS' : 'FAIL', db: eredmenyek.length, ellenorzesek: eredmenyek, megfigyelesek: megfigyeles };
if (KI) { fs.mkdirSync(path.dirname(path.resolve(GYOKER, KI)), { recursive: true }); fs.writeFileSync(path.resolve(GYOKER, KI), JSON.stringify(naplo, null, 1) + '\n'); }
for (const e of eredmenyek) console.log(`${e.ok ? 'OK  ' : 'HIBA'} ${e.nev}${e.ok ? '' : '  ' + JSON.stringify(e.adat)}`);
for (const m of megfigyeles) console.log(`MEGF ${m.nev}: ${m.adat}`);
console.log(naplo.eredmeny, `(${eredmenyek.filter((x) => x.ok).length}/${eredmenyek.length})`);
process.exit(naplo.eredmeny === 'PASS' ? 0 : 1);
