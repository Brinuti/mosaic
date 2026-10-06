// QA-2 AJANDEKKARTYA-ESET (HeadSpa-kartya) a PR-ELONEZETEN: arkezesi adatok -> VALODI Stripe TESZT-modu vasarlas (4242 kartya) az /ajandek oldalon -> a bongeszo a PI letrehozasakor kuldi az erkezesi adatot
// (pi_ azonosito) -> nyers BONGESZOS naplo. A szerveres lepest (esemenyek, platformvalasz) a qa2-ajandek-szerver.mjs inditja (a webhook ujrajatszasa: ezen az elonezeten a Stripe nem eri el a webhookot).
//   node tools/meres-proba/qa2-ajandek.mjs --bazis https://<ag>.mosaic-d77.pages.dev [--profil teljes|nincs|ana|dontes_nelkul] [--out naplo.json]
// Csak elonezeten (Stripe TESZT-mod: pk_test / sk_test) fut; a kimeno MERES (GA4, Meta, TikTok, Google Ads, Stape, Zapier) tiltott; a Stripe sajat hostjai engedettek (a fizetes maga).
// SZINTETIKUS adatok (TESZT-jelolesu kattintasazonositok, a _fbp / _ttp / _ga sutiket a teszt allitja be). A vevo: "TESZT - Claude", deakfi@grantis.hu (a Zapier-oldali probavedelem is ezt ismeri).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { UA, platformOf, engedett, dnsArg, ures } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis', ''), PROFIL = arg('profil', 'teljes'), OUT = arg('out', '');
if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS)) throw new Error('csak PR-elonezeten fut');
const PROFILOK = { teljes: { ana: true, adv: true, fun: true }, nincs: { ana: false, adv: false, fun: false }, ana: { ana: true, adv: false, fun: true }, dontes_nelkul: null };
const HOZZ = PROFILOK[PROFIL];
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const T0 = Date.now(); const mp = () => Date.now() - T0;
const idovonal = [], tiltott = [], sajat = [], hibak = [];
const lepes = (e, x = {}) => { idovonal.push({ t: mp(), esemeny: e, ...x }); console.log(`[${String(mp()).padStart(6)}ms] ${e}`, Object.keys(x).length ? JSON.stringify(x).slice(0, 260) : ''); };
const S = `TESZT_AJANDEK_${Date.now().toString(36)}`.toUpperCase();
const ELSO = { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'qa2_ajandek_elso', gclid: `Cj0KCQjw_${S}_GCLID` };
const UTOLSO = { utm_source: 'facebook', utm_medium: 'paid', utm_campaign: 'qa2_ajandek_utolso', fbclid: `IwAR_${S}_FBCLID`, ttclid: `E.C.P.${S}_TTCLID`, wbraid: `CoMKCQ_${S}_WBRAID` };
const ts = Math.floor(Date.now() / 1000);
const SUTIK = { _fbp: `fb.1.${ts * 1000 - 5000000}.${Math.floor(Math.random() * 9e9 + 1e9)}`, _ttp: `${S}_ttp_${Math.random().toString(36).slice(2, 12)}`, _ga: `GA1.1.${Math.floor(Math.random() * 9e8 + 1e8)}.${ts - 86400}`, _ga_H4206SQ0Q7: `GS2.1.s${ts - 1200}$o1$g1$t${ts - 600}$j0$l0$h0` };
const STRIPE = /^(.+\.)?(stripe\.com|stripe\.network|hcaptcha\.com)$/;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 1000 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
const host = new URL(BAZIS).hostname;
await ctx.addCookies(Object.entries(SUTIK).map(([name, value]) => ({ name, value, domain: host, path: '/' })));
await ctx.addInitScript(([h, hozz]) => { try { if (location.hostname === h && hozz && !localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), ...hozz })); } catch (e) { /* nem baj */ } }, [host, HOZZ]);
await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  if (STRIPE.test(u.hostname)) return route.continue();
  const plat = platformOf(url) || (engedett(url, req.method()) ? null : 'tiltott');
  if (plat) { tiltott.push({ t: mp(), plat, metodus: req.method(), host: u.host, ut: u.pathname.slice(0, 60) }); return route.fulfill(ures(req)); }
  return route.continue();
});
const page = await ctx.newPage();
page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
page.on('request', (r) => { if (/\/api\/(meres-erkezes|ajandek\/(fizetes|atutalas))/.test(r.url())) { let t = null; try { t = r.postData() ? JSON.parse(r.postData()) : null; } catch (e) { t = '<nem JSON>'; } if (t && t.nev) t = { ...t, nev: '<maszkolva>', email: '<maszkolva>', telefon: t.telefon ? '<maszkolva>' : undefined, cim: '<maszkolva>', ajandekozott: '<maszkolva>' }; sajat.push({ t: mp(), irany: 'keres', metodus: r.method(), url: r.url(), torzs: t }); } });
page.on('response', async (r) => { if (/\/api\/(meres-erkezes|ajandek\/(fizetes|atutalas))/.test(r.url())) { let j = await r.json().catch(() => null); if (j && j.client_secret) j = { ...j, client_secret: '<kihagyva>' }; sajat.push({ t: mp(), irany: 'valasz', status: r.status(), url: r.url(), torzs: j }); } });
const qs = (p) => '?' + new URLSearchParams(p).toString();
const o = { bazis: BAZIS, eset: 'headspa-kartya', hozzajarulas_profil: PROFIL, hozzajarulas: HOZZ, szintetikus_adatok: { megjegyzes: 'a kattintasazonositok es a sutik SZINTETIKUSAK; a Stripe-fizetes VALODI teszt-modu (4242 kartya, nincs valodi penzmozgas)', elso_latogatas: ELSO, utolso_latogatas: UTOLSO, sutik: SUTIK } };
try {
  await page.goto(BAZIS + '/ajandek' + qs(ELSO), { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.mhAttribucio, null, { timeout: 15000 }); await page.waitForTimeout(2200);
  lepes('1. latogatas (Google-hirdetes)');
  await page.goto(BAZIS + '/ajandek' + qs(UTOLSO), { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.mhAttribucio, null, { timeout: 15000 });
  o.pillanatkep_a_vasarlas_elott = await page.evaluate(() => JSON.parse(JSON.stringify(window.mhAttribucio.pillanatkep()))); lepes('2. latogatas (Meta / TikTok / wbraid)');
  await page.waitForTimeout(3000);
  await page.locator('#ah-tovabb-gomb').click(); lepes('tovabb a szemelyre szabashoz');
  await page.locator('#ah-tervezo-tovabb').waitFor({ state: 'visible', timeout: 20000 }); await page.locator('#ah-tervezo-tovabb').click(); lepes('tovabb a fizeteshez');
  await page.locator('#ah-nev').waitFor({ state: 'visible', timeout: 20000 });
  const tolt = async (id, v) => { const l = page.locator('#' + id); await l.click(); await l.fill(v); };
  await tolt('ah-ajandekozott', 'Teszt Fogado'); await tolt('ah-nev', 'TESZT – Claude'); await tolt('ah-email', 'deakfi@grantis.hu'); await tolt('ah-iranyitoszam', '1023'); await tolt('ah-varos', 'Budapest'); await tolt('ah-cim', 'Teszt utca 1.');
  lepes('szamlazasi adatok kitoltve');
  // Stripe Payment Element: a kartya-mezok iframe-ben
  await page.waitForSelector('#ah-fizetesi-elem iframe', { timeout: 30000 }); await page.waitForTimeout(3500);
  const kereten = page.frameLocator('#ah-fizetesi-elem iframe').first();
  const kartyaFul = kereten.locator('[data-testid="card"], button:has-text("Kártya"), button:has-text("Card")').first();
  if (await kartyaFul.count().catch(() => 0)) await kartyaFul.click().catch(() => {});
  await kereten.locator('input[name="number"], input[autocomplete="cc-number"]').first().fill('4242424242424242');
  await kereten.locator('input[name="expiry"], input[autocomplete="cc-exp"]').first().fill('1230');
  await kereten.locator('input[name="cvc"], input[autocomplete="cc-csc"]').first().fill('123');
  const iranyito = kereten.locator('input[name="postalCode"], input[autocomplete="postal-code"]'); if (await iranyito.count().catch(() => 0)) await iranyito.first().fill('1023').catch(() => {});
  lepes('Stripe teszt-kartya kitoltve (4242)');
  await page.locator('#ah-fizet-gomb').click(); lepes('fizetes elinditva', { ido: new Date().toISOString() });
  await page.waitForFunction(() => /payment_intent=|\/ajandek.*redirect_status|kesz|Köszön|Sikeres/i.test(location.href + document.body.innerText.slice(0, 2000)), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const pi = (sajat.find((x) => x.irany === 'valasz' && /ajandek\/fizetes/.test(x.url) && x.torzs && x.torzs.pi) || {}).torzs; o.pi = pi && pi.pi;
  o.mhAttribucioEredmeny = await page.evaluate(() => window.mhAttribucioEredmeny || null);
  o.vegallapot_url = page.url().replace(/(client_secret=)[^&]+/, '$1<kihagyva>'); o.oldal_szoveg = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
  lepes('vasarlas vege', { pi: o.pi, attribucio: o.mhAttribucioEredmeny && o.mhAttribucioEredmeny.allapot, url: o.vegallapot_url.slice(0, 120) });
} catch (e) { lepes('HIBA', { uzenet: String(e.message || e).slice(0, 300) }); o.hiba = String(e.message || e).slice(0, 300); try { await page.screenshot({ path: '/tmp/claude-0/-home-user-mosaic/eb02b696-4f37-57c9-9eac-cb42a49f6597/scratchpad/ajandek-hiba.png' }); } catch (x) { /* nem baj */ } }
const keresek = {}; for (const n of tiltott) { const k = `${n.plat} ${n.host}${n.ut}`; keresek[k] = (keresek[k] || 0) + 1; }
console.log('Tiltott kimeno meres:', JSON.stringify(keresek).slice(0, 400)); console.log('JS-hibak:', hibak.length ? hibak.join(' | ') : 'nincs');
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ ...o, idovonal, sajat_keresek_nyers: sajat, tiltott_kimeno_keresek: keresek, js_hibak: hibak }, null, 1));
await browser.close();
