// Az uj, rejtett tukor-oldalak (/uj/..., /uj-oldalak) ellenorzese a helyi kiszolgalon (tools/serve.mjs) vagy elonezeten, Playwrighttal.
//
//   node tools/build.mjs && node tools/serve.mjs &     majd:     node tools/uj-oldalak-teszt.mjs [--gyors] [--oldal=/rolunk[,/blog]] [--forras]
//   BASE=https://<ag>.medicalpiercing.pages.dev node tools/uj-oldalak-teszt.mjs
//
// Nem helyi cimen minden merokeres es minden Salonic-hivas blokkolva van (tools/meres-tiltas.mjs): a teszt nem szennyezi a statisztikat, nem indit foglalast,
// az urlap-beküldéseket (/api/urlap) elkapja (nem megy e-mail).
//
// Ellenorzi minden tukor-oldalra, asztalin es mobilon:
//  - forras: rejtett (noindex, nincs canonical), pontosan egy h1, kepek alt-ja, belso linkek celjai (letezo /uj/... oldal vagy foglalasi cim), horgonyok
//  - tartalom: az eredeti oldal minden szovege (a cim, bekezdesek, listak, gombok) megvan az uj oldalon (szoveg-lefedettseg)
//  - futas: nincs JS-hiba, nincs vizszintes gorgetes 360-1920 px kozott, minden kep betolt, nem logo elem
//  - kategoria-oldalak (migren, shenmen ...): a fooldal-meretu hos, a fooldal dobozai (ekszer, akcio, ar, helyszin, media, csapat), a Facebook-kommentek kartyai
//  - funkciok: MINDEN foglalasi gomb megnyitja a foglalomotort, a fejlec-menu (asztali lenyilok, mobil teljes menu), galeria + nagyito, videoablak,
//    urlapok (allasjelentkezes, hozzaszolas), kedveles, blog-kereso, helyszin-lapozo, link-index
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';
import { oldalak } from './oldalak.mjs';
import { meresTiltas } from './meres-tiltas.mjs';
import { kulcsbol, fajlnev } from '../lib/utvonal.js';
import { UJ_ELES, REGI_ELO } from '../lib/uj-eles.js';
import { UJ_FOOLDAL_UT } from './uj-fooldal.mjs';
// elesitve (lib/uj-eles.js) az uj oldal az eredeti cimen, a regi (Wix-klon) a /regi/... cimen; kulonben az uj a /uj/... cimen, a regi az eredetin
const UJ = UJ_ELES ? '' : '/uj';
const REGI = UJ_ELES ? REGI_ELO : '';
import { KATEGORIA_UTAK, KATEGORIA_B_UTAK, B_ALAP, kategoriaCserelt, hosGaleriaKepek } from './uj-oldalak/kategoria.mjs';
import { KIZART_UTAK, piercingCserelt, piercingRacs, piercingCim } from './uj-oldalak/sablon.mjs';
// a tulajdonos kereseire (2026-10-16) atirt / lecserelt szovegek: az eredeti oldalon megvannak, az uj oldalon szandekosan nem
// (a 4.100+ helyett a Google mostani szama; arany / 14 karatos bevonat helyett G23 titanium; a regi akcio-link helyett az oszi akcio; az ertekeles-sor a Trustindexbol)
const SZANDEKOS = /4\.100|arany|arannyal|karát|antiallergén orvosi fém piercingek|Több tízezer szúrás tapasztalata után csak a legnépszerűbb|3 piercing 2 áráért! - AKCIÓ!|vélemény alapján >>|^Az anyaga alapján tehát választhatsz|^·\s*(nemesfémet|ezüstöt|titániumot)/i;
// a kezzel irt (uj-oldalak/sajat/) es az ujraszerkesztett oldalak (blog, Gabi tortenete, Rolunk, oszi akcio) szovege szandekosan mas: a lefedettseget nem merjuk
const sajatOldal = (ut) => fs.existsSync(path.join(ROOT, 'uj-oldalak/sajat', ut.replace(/^\//, '') + '.html'));
const ujraszerkesztett = (ut) => sajatOldal(ut) || ut === '/blog' || B_ALAP.get(ut) === ut;

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = (process.env.BASE || 'http://localhost:4290').replace(/\/$/, '');
const HELYI = /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(BASE);
const arg = (n) => process.argv.find((a) => a.startsWith('--' + n + '='))?.split('=')[1];
const GYORS = process.argv.includes('--gyors');
const CSAK_FORRAS = process.argv.includes('--forras');
const PARHUZAM = +process.env.PARHUZAM || 4;
const KIHAGY = new Set(['/', '/idopontfoglalas', '/kontroll']);
const MOBIL_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const FOGLALAS = /^\/(idopontfoglalas|kontroll)(?:[/?#]|$)|^https?:\/\/medicalpiercing\.salonic\.hu(?:[/?#]|$)/i;
const KULSO_BLOKK = /googletagmanager|google-analytics|doubleclick|stape|googlesyndication|cdn\.trustindex|youtube|ytimg|maps\.google|google\.com\/maps|gstatic|googleusercontent|facebook\.com|embed\.rtl|medicalpiercing\.salonic\.hu|api\.salonic\.hu/;

let hiba = 0, db = 0;
const hibak = [];
const ok = (nev, felt, info = '') => {
  db++;
  if (!felt) { hiba++; hibak.push(`${nev}${info ? '  ' + info : ''}`); console.log(`HIBA ${nev}${info ? '  ' + String(info).slice(0, 300) : ''}`); }
};

const lista = oldalak().filter((o) => !KIHAGY.has(o.ut) && !KIZART_UTAK.has(o.ut));
let kijelolt = lista;
if (arg('oldal')) kijelolt = lista.filter((o) => arg('oldal').split(',').includes(o.ut));
else if (GYORS) {
  const mintak = ['/rolunk', '/blog', '/migren-piercing', '/shenmen-piercing', '/klimax-piercing', '/slim-etvagycsokkento-piercing', '/maj-piercing', '/allasajanlat', '/a-migren-piercing-mukodese', '/migren-piercing-arak', '/piercer-kovacs-gabriella', '/migren-es-shenmen-piercing-garancia', '/adatkezeles', '/allas-ok', '/elerhetosegek', '/home', '/search', '/fejfajas'];
  kijelolt = lista.filter((o) => mintak.includes(o.ut) || /^\/varosok\//.test(o.ut) && o.ut.includes('szombathely'));
}
// ---------- 1. forras (dist): rejtett, h1, alt, belso linkek ----------
const distFajl = (ut) => path.join(ROOT, 'dist/_a', fajlnev(kulcsbol(UJ + ut)) + '.html');

const mirrorUtak = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'uj-oldalak/jegyzek.json'), 'utf8')).map((o) => o.ut).filter((ut) => !KIZART_UTAK.has(ut)));
// a kezzel irt oldalak kozul azok, amelyeknek nincs tukor-parjuk (Csapatunk, Kapcsolat, Ekszereink): ezek is a link-indexben vannak
const sajatUj = fs.readdirSync(path.join(ROOT, 'uj-oldalak/sajat')).filter((x) => x.endsWith('.html')).map((x) => '/' + x.slice(0, -5)).filter((ut) => !mirrorUtak.has(ut));
const tartalomFajl = (o) => path.join(ROOT, 'uj-oldalak/tartalom', o.kulcs.replace(/\//g, '__') + '.json');
ok('jegyzek: minden tukrozott oldalnak van tartalom-fajlja', [...mirrorUtak].every((ut) => lista.some((o) => o.ut === ut && fs.existsSync(tartalomFajl(o)))));
ok('jegyzek: nincs benne a kezdolap / foglalasi cim', ![...KIHAGY].some((k) => mirrorUtak.has(k)));

// ket "Tovább az összes véleményhez" link, koztuk csak cimkek (a tulajdonos jelezte, 2026-10-16: a piercing-oldalakon duplan volt)
const DUPLA_VELEMENYLINK = /Tovább az összes véleményhez[^<]*<\/a>(?:\s*<\/?(?:p|div|section)\b[^>]*>)*\s*<a\b[^>]*>Tovább az összes véleményhez/;
const forrasFajlok = new Map();
for (const o of kijelolt) {
  const f = distFajl(o.ut);
  if (!fs.existsSync(f)) { ok(`${o.ut}: a build elkeszitette (${path.relative(ROOT, f)})`, false); continue; }
  const h = fs.readFileSync(f, 'utf8');
  forrasFajlok.set(o.ut, h);
  const main = h.slice(h.indexOf('<main id="fo">'), h.indexOf('</main>'));
  const fejresz = h.slice(0, h.indexOf('</head>'));
  if (UJ_ELES) {
    // elesitve a regi oldal SEO-fejlece: canonical (vagy, ahol a regi oldal is az volt, noindex); a rejtett probaoldal megjegyzese nincs
    ok(`${o.ut}: elesitve canonical vagy a regi oldal noindex-e`, /rel="canonical"/i.test(fejresz) || /<meta name="robots" content="[^"]*noindex/i.test(fejresz));
    ok(`${o.ut}: nincs benne a rejtett probaoldal megjegyzese`, !/Rejtett próbaoldal/.test(fejresz));
  } else {
    ok(`${o.ut}: noindex meta`, /<meta name="robots" content="[^"]*noindex[^"]*"/i.test(h));
    ok(`${o.ut}: nincs canonical`, !/rel="canonical"/i.test(h));
  }
  ok(`${o.ut}: pontosan egy h1`, (main.match(/<h1[\s>]/g) || []).length === 1, String((main.match(/<h1[\s>]/g) || []).length));
  ok(`${o.ut}: minden kepnek van alt attributuma`, ![...h.matchAll(/<img\b[^>]*>/g)].some((m) => !/\salt="/.test(m[0])));
  // belso linkek: tukrozott oldal, foglalasi cim, fajl vagy horgony
  const rossz = [];
  for (const m of h.matchAll(/<a\b[^>]*?\shref="([^"]+)"/g)) {
    const href = m[1].replace(/&amp;/g, '&');
    if (!href.startsWith('/') || href.startsWith('/assets/')) continue;
    if (FOGLALAS.test(href)) continue;
    let ut;
    try { ut = decodeURIComponent(href.replace(/[?#].*$/, '')).replace(/\/+$/, '') || '/'; } catch { rossz.push(href); continue; }
    if (UJ_ELES) {
      // elesitve minden belso link az eredeti cimre mutat: /uj/..., /uj-fooldal, /regi/... nem maradhat
      if (/^\/(uj(\/|$)|uj-fooldal|regi(\/|$))/.test(ut)) rossz.push(href);
      continue;
    }
    if (ut === '/uj-fooldal' || ut === '/uj-oldalak') continue;
    const m2 = ut.match(/^\/uj(\/.*)$/);
    if (!m2) { if (lista.some((x) => x.ut === ut)) rossz.push(href + ' (nem /uj/)'); continue; }   // a nem letezo (Wix-sablon) oldalakra mutato linkek valtozatlanok
    if (!mirrorUtak.has(m2[1]) && !sajatOldal(m2[1]) && lista.some((x) => x.ut === m2[1])) rossz.push(href);
  }
  ok(`${o.ut}: minden belso link tukrozott oldalra / foglalasra mutat`, rossz.length === 0, [...new Set(rossz)].slice(0, 5).join(' '));
  const idk = new Set([...h.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]));
  const horg = [...new Set([...h.matchAll(/<a\b[^>]*?\shref="#([^"]+)"/g)].map((x) => x[1]))];
  ok(`${o.ut}: a lapon belüli horgonyok celja letezik`, horg.every((x) => idk.has(x)), horg.filter((x) => !idk.has(x)).join(' '));
  ok(`${o.ut}: nincs egymas utan ketszer "Tovább az összes véleményhez" link`, !DUPLA_VELEMENYLINK.test(main));
}
// a fooldal is (a kihagyott cimek kozott van)
{
  const f = distFajl(UJ_ELES ? '/' : '/uj-fooldal');
  const h = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : fs.readFileSync(path.join(ROOT, 'dist/_a/uj-fooldal.html'), 'utf8');
  ok('fooldal: nincs egymas utan ketszer "Tovább az összes véleményhez" link', !DUPLA_VELEMENYLINK.test(h));
}
// a link-index: minden oldal ott van, a linkek a letezo uj oldalakra mutatnak
const indexF = path.join(ROOT, 'dist/_a/uj-oldalak.html');
if (fs.existsSync(indexF)) {
  const h = fs.readFileSync(indexF, 'utf8');
  const uj = [...h.matchAll(/class="idx-uj" href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  ok(`link-index: mind a ${mirrorUtak.size} tukor-oldal + ${sajatUj.length} kezzel irt + az uj fooldal linkelve`, uj.length === mirrorUtak.size + sajatUj.length + 1, String(uj.length));
  const hianyzo = uj.filter((u) => u !== UJ_FOOLDAL_UT && !fs.existsSync(path.join(ROOT, 'dist/_a', fajlnev(kulcsbol(decodeURIComponent(u))) + '.html')));
  ok('link-index: minden link letezo oldalra mutat', hianyzo.length === 0, hianyzo.slice(0, 5).join(' '));
  ok('link-index: noindex', /noindex/.test(h) && !/rel="canonical"/.test(h));
} else ok('link-index: dist/_a/uj-oldalak.html', false);

if (CSAK_FORRAS) { console.log(`\n${db} ellenorzes, hiba: ${hiba}`); process.exit(hiba ? 1 : 0); }

// ---------- 2. bongeszo ----------
const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const b = await chromium.launch();
const SZELESSEGEK = [360, 390, 768, 1280, 1440, 1920];
let kovetkezo = 0;
const linkCache = new Map();

async function ctxKesz(nezet) {
  const ctx = await b.newContext(nezet === 'mobil' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, userAgent: MOBIL_UA, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  if (!HELYI) await meresTiltas(ctx);
  await ctx.route(KULSO_BLOKK, (r) => r.abort());
  await ctx.route('**/api/urlap', async (r) => { const pd = r.request().postData() || ''; ctx.__urlap = (ctx.__urlap || []).concat([pd]); await r.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }); });
  return ctx;
}

// a kategoria-sablon segedei a teszthez (a sablon sajatjai a sablon.mjs-ben vannak)
const TESZT_T = {
  szovegTiszta: (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim(),
  csakLink: (h) => { const m = String(h).trim().match(/^<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>$/); return m && !/<a /.test(m[3]) ? { href: m[1] } : null; },
  piercingRacs, piercingCim,
};
// a fooldal (/uj-fooldal) merei: a kategoria-oldal hosenek ugyanakkorank kell lennie (asztali / mobil)
const fooldalMeret = {};
async function kategoriaTeszt(o, nezet, p, cim) {
  if (!fooldalMeret[nezet]) {
    const q = await p.context().newPage();
    await q.goto(BASE + UJ_FOOLDAL_UT + '?motor=0', { waitUntil: 'load', timeout: 60000 });
    fooldalMeret[nezet] = await q.evaluate(() => ({ h1: parseFloat(getComputedStyle(document.querySelector('.hos h1')).fontSize), kep: Math.round(document.querySelector('.hos-kep img').getBoundingClientRect().width) }));
    await q.close();
  }
  const ref = fooldalMeret[nezet];
  const m = await p.evaluate(() => {
    const kep = document.querySelector('.kat-hos .hos-kep img') || document.querySelector('.kat-hos .hos-kep');
    const r = (s) => document.querySelector(s);
    const dia = [...document.querySelectorAll('.kat-fb .kar-dia')].map((d) => Math.round(d.getBoundingClientRect().width));
    return {
      h1: parseFloat(getComputedStyle(document.querySelector('.kat-hos h1')).fontSize), kep: kep ? Math.round(kep.getBoundingClientRect().width) : 0,
      hosGomb: !!document.querySelector('.kat-hos .gomb-tomor[href="/idopontfoglalas"]'), bizalom: document.querySelectorAll('.kat-hos .bizalom li').length,
      promoSav: !!r('.promo-sav'), tarto: Math.round(r('main .tarto').getBoundingClientRect().width), vp: document.documentElement.clientWidth,
      ekszer: !!r('#ekszerek .galeria'), akcio: !!r('.akcio-sor .akcio'), ar: document.querySelectorAll('#arak .ar-kartya').length, helyszin: document.querySelectorAll('#helyszinek .helyek li').length,
      media: !!r('#media .videok'), csapat: !!r('#csapat'), velemeny: !!r('.velemeny-doboz'), nagyito: !!r('#nagyito'), dia, fbKep: [...document.querySelectorAll('.kat-fb .kar-dia img')].every((i) => i.naturalWidth > 0),
      doboz: [...document.querySelectorAll('.kat-doboz')].filter((d) => d.scrollWidth > d.clientWidth + 1).length,
    };
  });
  // a B oldal (a galeriaval): asztalin ugyanakkora, mint a fooldalon; mobilon az egy kepernyore illesztett hos kisebb cimet (1,42 rem) es 300 px-es galeriat hasznal
  // (2026-10-16: mind a 9 piercing-oldalon galerias hos, a B oldalakeval azonos meretekkel)
  const b = B_ALAP.has(o.ut) || !!hosGaleriaKepek(ROOT, o.ut);
  ok(`${cim}: a hos ${b && nezet === 'mobil' ? 'az egy kepernyore illesztett merettel' : 'ugyanakkora, mint a fooldalon'} (h1 ${m.h1}px, kep ${m.kep}px)`,
    b && nezet === 'mobil' ? m.h1 >= 20 && m.kep >= 280 && m.kep <= ref.kep : m.h1 === ref.h1 && Math.abs(m.kep - ref.kep) <= 24, `fooldal: h1 ${ref.h1}px, kep ${ref.kep}px`);
  ok(`${cim}: a hos a fooldal elemeivel (foglalo gomb, bizalmi sor), a promo-sav nincs`, m.hosGomb && m.bizalom === 4 && !m.promoSav, JSON.stringify(m));
  ok(`${cim}: a tartalom a fooldal szelessegu (${m.tarto}px)`, nezet === 'mobil' ? m.tarto >= m.vp - 34 : m.tarto >= Math.min(1240, m.vp - 48) - 2, `${m.tarto}/${m.vp}`);
  ok(`${cim}: a fooldal dobozai: ekszer-galeria, akcio, ${m.ar} ar-kartya, ${m.helyszin} helyszin, media, csapat, velemeny`, m.ekszer && m.akcio && m.ar === 4 && m.helyszin === 15 && m.media && m.csapat && m.velemeny && m.nagyito, JSON.stringify(m));
  ok(`${cim}: nincs kicsorduló doboz`, m.doboz === 0, String(m.doboz));
  if (m.dia.length) {
    ok(`${cim}: a Facebook-kommentek kartyai nagyok es olvashatok (${m.dia.join('/')} px) es betoltenek`, m.dia.every((w) => w >= (nezet === 'mobil' ? 250 : 300)) && m.fbKep, JSON.stringify(m.dia));
  }
  // az ekszer-galeria lapoz, a kep kattintasra nagyban nyilik (a fooldal viselkedese)
  const gal = await p.$('#ekszerek .galeria');
  await gal.scrollIntoViewIfNeeded();
  const elo = await p.$eval('#ekszerek [data-aktualis]', (e) => e.textContent);
  await p.click('#ekszerek .galeria-kov'); await p.waitForTimeout(700);
  const utana = await p.$eval('#ekszerek [data-aktualis]', (e) => e.textContent);
  ok(`${cim}: az ekszer-galeria nyila lapoz (${elo} -> ${utana})`, +utana === +elo + 1);
  await p.click('#ekszerek .dia-nagyit >> nth=1');
  const nagy = await p.evaluate(() => { const d = document.querySelector('#nagyito'); return d.open && !!d.querySelector('.nagyito-kep').getAttribute('src'); });
  ok(`${cim}: az ekszer kattintasra nagyban nyilik`, nagy);
  await p.keyboard.press('Escape');
  // a fejlec "Arak" linkje az oldalon belul az arakhoz visz (nem a fooldalra)
  // (2026-10-16: az "Arak" a menuben lenyilo; az arlista oldalra visz)
  const arHref = await p.$eval('#alm-arak a[href*="arlista"]', (a) => a.getAttribute('href')).catch(() => '');
  ok(`${cim}: a fejlec "Arak" lenyiloja az arlistara visz`, new RegExp('^' + UJ + '/arlista-garancia').test(arHref), arHref);
}

async function lapTeszt(o, nezet, ctx) {
  const cim = `${o.ut} [${nezet}]`;
  const p = await ctx.newPage();
  const jsHibak = [];
  p.on('pageerror', (e) => jsHibak.push(e.message));
  const url = BASE + UJ + new URL(o.url).pathname;
  const v = await p.goto(url, { waitUntil: 'load', timeout: 60000 }).catch((e) => ({ status: () => 0, hiba: e.message }));
  ok(`${cim}: 200-as valasz`, v.status() === 200, String(v.status()));
  if (v.status() !== 200) { await p.close(); return; }
  if (!HELYI && !UJ_ELES) ok(`${cim}: X-Robots-Tag noindex`, /noindex/.test(v.headers()['x-robots-tag'] || ''));
  // lusta kepek / galeriak
  await p.evaluate(async () => {
    document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo(0, 0);
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 5000); }))));
  });
  await p.evaluate(() => document.querySelectorAll('#mp-cc').forEach((e) => e.remove()));   // a suti-sav a lap aljat takarja: a vendeg elfogadja / elutasitja
  // tartalom-lefedettseg
  // (a csukott harmonika tartalma nem latszik az innerText-ben: a lefedettseghez kinyitjuk, utana becsukjuk)
  const tartalom = await p.evaluate(() => { const d = [...document.querySelectorAll('main#fo details')]; d.forEach((x) => { x.open = true; }); const t = document.querySelector('main#fo')?.innerText || ''; d.forEach((x) => { x.open = false; }); return t; });
  // a migren / shenmen / klimax / slim oldal alapja a "B" valtozat: az eredeti -b oldal tartalmahoz (JSON es az eredeti oldal szovege) hasonlitunk
  // (elesitve a -b cimeken is a B-dizajnu uj oldal van, ugyanabbol a tartalombol: az eredeti -b oldalhoz hasonlitjuk)
  const bUt = B_ALAP.get(o.ut) || (UJ_ELES && KATEGORIA_B_UTAK.has(o.ut) ? o.ut : null);
  const ered = JSON.parse(fs.readFileSync(tartalomFajl(bUt ? { kulcs: bUt.slice(1) } : o), 'utf8'));
  // az eredeti oldal szovege: a kinyert JSON szovegei + az eredeti oldal (Wix-klon) lathato szovege
  if (nezet === 'asztali' && !ujraszerkesztett(o.ut)) {
    const eredeti = await p.context().newPage();
    await eredeti.goto(BASE + REGI + (bUt || new URL(o.url).pathname) + '?motor=0', { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    const sorok = await eredeti.evaluate(() => (document.querySelector('main#PAGES_CONTAINER')?.innerText || '').split('\n').map((s) => s.trim()).filter((s) => s.length >= 12));
    await eredeti.close();
    const t = norm(tartalom);
    // (a kitelepulesek datum-sorai naponta valtoznak: a mentett tartalomban a regi datumok vannak, az oldal betoltes utan a tablazatbol frissul - ezeket nem hasonlitjuk)
    // (a kategoria-oldalakon a hos ertekeles-sora a Trustindex adataibol frissul, a "Piercinget csak eu szakembertol!" felirat a hosbol kikerult: tulajdonosi dontes, 2026-10-13)
    // a kategoria-oldalakon a fooldal dobozai (ekszer, akcio / arlista, media, csapat, helyszin) valtottak fel az eredeti blokkokat: azok szovege nem kell
    // a lecserelt blokkok (fooldali dobozok, a piercing-racs mindenhol) szovege
    const cserelt = norm([...(KATEGORIA_UTAK.has(o.ut) || bUt ? kategoriaCserelt(ered, TESZT_T, !!bUt) || [] : []), ...piercingCserelt(ered)].join(' '));
    const hianyzo = [...new Set(sorok)].filter((s) => !t.includes(norm(s)) && !(cserelt && cserelt.includes(norm(s))) && !SZANDEKOS.test(s) && !/^(január|február|március|április|május|június|július|augusztus|szeptember|október|november|december)\s*\d/i.test(s) && !((KATEGORIA_UTAK.has(o.ut) || bUt) && /^(Kiváló\s*[-–|]|Piercinget csak eü szakembertől)/i.test(s)) && !(bUt && /vélemény alapján|vendégünk leírta|^Így néz ki egy klimax piercing behelyezés$/i.test(s)) && !/^(hozzászólások|hozzászólás írása|rendezés erre|legújabb|még nincsenek értékelések|megosztás|friss bejegyzések|az összes megtekintése)/i.test(s) && !/^\d+\s*(megtekint|kedvel|hozzászólás)/i.test(s) && !/^(\d+ perc olvasás|id|Search this site)$/i.test(s) && !/csillagot kapott|nincs kedvelve|Értékelés hozzáadása|^\d+ kedvelés|^Like post|\d+ megtekintés|\d+ hozzászólás$/i.test(s));
    const lefedett = sorok.length ? 1 - hianyzo.length / new Set(sorok).size : 1;
    ok(`${cim}: az eredeti oldal szovege megvan (${(lefedett * 100).toFixed(1)}%)`, hianyzo.length === 0, hianyzo.slice(0, 4).map((s) => `«${s.slice(0, 70)}»`).join(' '));
  }
  // kepek
  const rosszKep = await p.evaluate(() => [...document.images].filter((i) => !/ytimg|googleusercontent/.test(i.src) && i.getAttribute('src') && i.getBoundingClientRect().width > 0 && !i.closest('dialog') && (!i.complete || !i.naturalWidth)).map((i) => i.getAttribute('src').slice(-60)));
  ok(`${cim}: minden kep betolt`, rosszKep.length === 0, rosszKep.slice(0, 3).join(' '));
  // vizszintes gorgetes
  const szel = nezet === 'mobil' ? [360, 390, 430, 768] : SZELESSEGEK.filter((x) => x >= 768);
  for (const w of szel) {
    await p.setViewportSize({ width: w, height: 900 });
    const m = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth, [...document.querySelectorAll('main *')].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1 && !e.closest('.kar-sav,.sr,.horgony')).slice(0, 3).map((e) => e.tagName + '.' + String(e.className).slice(0, 30))]);
    ok(`${cim}: nincs vizszintes gorgetes ${w}px-en`, m[0] <= m[1] + 1, `${m[0]}/${m[1]} ${m[2].join(' ')}`);
  }
  await p.setViewportSize(nezet === 'mobil' ? { width: 390, height: 844 } : { width: 1440, height: 900 });
  // alap-szerkezet
  const szerk = await p.evaluate(() => ({ h1: document.querySelectorAll('main h1').length, fejlec: !!document.querySelector('#fejlec'), lablec: !!document.querySelector('.lablec'), tobbH1: document.querySelectorAll('h1').length }));
  ok(`${cim}: fejlec + lablec + egy h1`, szerk.fejlec && szerk.lablec && szerk.tobbH1 === 1, JSON.stringify(szerk));
  // foglalasi gombok: mind megnyitja a motort (asztalon mindet, mobilon az elsot es az utolsot)
  // pontosan azok a linkek, amiket a foglalomotor (motor-indito.js) kezel: a /idopontfoglalas, /kontroll, es a Salonic foglalo-linkek
  // (a vendeg-fiok / ajandekkartya / jogi linkek es az idopont modositasa / lemondasa valoban a Salonicra mennek)
  const GOMB_SEL = 'main a[href], .promo-sav, #fejlec a[href], .lablec a[href]';
  const gombok = await p.evaluate((sel) => [...document.querySelectorAll(sel)].map((a, i) => {
    const h = a.getAttribute('href') || '';
    const t = ((a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' + (a.getAttribute('title') || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let jo = /^\/(idopontfoglalas|kontroll)\/?(?:[?#]|$)/i.test(h);
    if (!jo) { try { const u = new URL(a.href); jo = u.hostname === 'medicalpiercing.salonic.hu' && !/giftcard|user|contact|policy|privacy|fizetesi|language/i.test(u.pathname) && !/modosit|lemond/.test(t); } catch (e) { /* */ } }
    return { i, href: h, jo };
  }).filter((x) => x.jo), GOMB_SEL);
  let kijel = gombok;
  if (nezet === 'mobil' && gombok.length > 2) kijel = [gombok[0], gombok[gombok.length - 1]];
  let motorHiba = [];
  // a koszonooldalakon (/foglalas-ok*, /fulbevalo-ok*) a motor szandekosan nem tolt be (motor-indito.js; a regi oldalon is igy):
  // a foglalasi gomb a foglalo oldalra visz, ott nyilik a motor - elesitve az uj koszonooldal az eredeti cimen van, ezert itt nem a motort varjuk
  const koszono = /^\/(foglalas-ok|fulbevalo-ok)/i.test(new URL(p.url()).pathname);
  if (koszono) kijel = [];
  for (const g of kijel.slice(0, 40)) {
    const url0 = p.url();
    const nyit = await p.evaluate(([sel, i]) => { const a = [...document.querySelectorAll(sel)][i]; if (!a) return null; a.scrollIntoView({ block: 'center' }); const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; }, [GOMB_SEL, g.i]);
    if (!nyit) continue;   // rejtett elem (pl. mobilon a fejlec-gomb)
    await p.evaluate(([sel, i]) => [...document.querySelectorAll(sel)][i].click(), [GOMB_SEL, g.i]);
    const van = await p.waitForSelector('[data-mp-motor]', { state: 'attached', timeout: 8000 }).then(() => true).catch(() => false);
    if (!van || p.url() !== url0) { motorHiba.push(`${g.href}${van ? ' (elnavigalt: ' + p.url() + ')' : ''}`); if (p.url() !== url0) break; }
    // bezaras, mint a vendeg: Esc (a motor visszaallitja a lap allapotat)
    await p.keyboard.press('Escape');
    await p.waitForSelector('[data-mp-motor]', { state: 'detached', timeout: 5000 }).catch(() => p.evaluate(() => document.querySelectorAll('[data-mp-motor]').forEach((e) => e.remove())));
  }
  if (koszono) ok(`${cim}: koszonooldal: ${gombok.length} foglalasi link, a motor nem tolt be (szandekos)`, gombok.length > 0 && !(await p.evaluate(() => !!document.querySelector('script[src*="/motor/motor.js"]'))));
  else ok(`${cim}: mind a ${kijel.length} foglalasi gomb megnyitja a foglalomotort`, motorHiba.length === 0, motorHiba.slice(0, 3).join(' '));
  // fejlec-menu
  if (nezet === 'mobil') {
    await p.evaluate(() => scrollTo(0, 0));
    await p.click('#menu-nyito');
    const m = await p.evaluate(() => { const m = document.querySelector('#menu'); const r = m.getBoundingClientRect(); const linkek = [...m.querySelectorAll('a.menu-link')]; return { h: Math.round(r.height), vis: getComputedStyle(m).visibility, linkekLatszanak: linkek.length > 0 && linkek.every((a) => { const q = a.getBoundingClientRect(); return q.height > 0 && q.bottom <= innerHeight + 1; }), nyitva: document.querySelector('#menu-nyito').getAttribute('aria-expanded') }; });
    ok(`${cim}: a mobilmenu megnyilik, teljes magassagu, a linkek latszanak`, m.h > 300 && m.vis === 'visible' && m.linkekLatszanak && m.nyitva === 'true', JSON.stringify(m));
    await p.keyboard.press('Escape');
  } else {
    await p.hover('.lenyilo >> nth=0');
    const m = await p.evaluate(() => { const l = document.querySelector('.lenyilo .almenu'); const q = l.getBoundingClientRect(); return { h: Math.round(q.height), links: l.querySelectorAll('a').length }; });
    ok(`${cim}: a Piercingek lenyilo menu megnyilik`, m.h > 100 && m.links >= 8, JSON.stringify(m));
  }
  // galeria + nagyito
  const kar = await p.$('.kar');
  if (kar) {
    await kar.scrollIntoViewIfNeeded();
    const elotte = await p.evaluate(() => document.querySelector('.kar-sav').scrollLeft);
    const kov = await p.$('.kar-kov');
    if (kov && await kov.isEnabled()) {
      await kov.click(); await p.waitForTimeout(700);
      const utana = await p.evaluate(() => document.querySelector('.kar-sav').scrollLeft);
      ok(`${cim}: a galeria nyila lapoz`, utana > elotte, `${elotte} -> ${utana}`);
    }
    const kep = await p.$('.kar img[data-nagyit]');
    await kep.scrollIntoViewIfNeeded();
    await kep.click();
    const nyitva = await p.evaluate(() => { const d = document.querySelector('#kepnezo'); return d.open && !!d.querySelector('.nagyito-kep').getAttribute('src'); });
    ok(`${cim}: a galeria kepe kattintasra nagyban nyilik`, nyitva);
    await p.keyboard.press('Escape');
  }
  // kategoria-oldalak: a fooldal-meretu hos, a fooldal dobozai, a Facebook-kommentek kartyai
  if (KATEGORIA_UTAK.has(o.ut)) await kategoriaTeszt(o, nezet, p, cim);
  // videoablak
  const vid = await p.$('a.video[data-embed]');
  if (vid && nezet === 'asztali') {
    await vid.scrollIntoViewIfNeeded();
    await vid.click();
    const v2 = await p.evaluate(() => { const d = document.querySelector('#videoablak'); return d.open && !!d.querySelector('iframe'); });
    ok(`${cim}: a videó kattintasra ablakban nyilik`, v2);
    await p.keyboard.press('Escape');
  }
  // blog: hozzaszolas, kedveles, megosztas
  const cikk = await p.$('article[data-cikk]');
  if (cikk) {
    const k = await p.$('.kedvel');
    const e0 = await p.$eval('[data-kedvel-db]', (x) => x.textContent);
    await k.scrollIntoViewIfNeeded(); await k.click();
    const e1 = await p.$eval('[data-kedvel-db]', (x) => x.textContent);
    ok(`${cim}: a kedveles gomb szamlalot valtoztat`, +e1 === +e0 + 1, `${e0} -> ${e1}`);
    await k.click();
    ok(`${cim}: a megosztas-gombok megvannak (Facebook, X, LinkedIn, link, nyomtatas)`, (await p.$$('.megoszt')).length === 5);
    await p.click('.hsz-uj summary');
    ctx.__urlap = [];
    await p.fill('#hsz-nev', 'Próba'); await p.fill('#hsz-email', 'proba@example.com'); await p.fill('#hsz-szoveg', 'Próba hozzászólás');
    await Promise.all([p.waitForRequest('**/api/urlap', { timeout: 8000 }).catch(() => null), p.click('.hsz-urlap button[type="submit"]')]);
    await p.waitForTimeout(300);
    const adat = (ctx.__urlap || [])[0] || '';
    ok(`${cim}: a hozzaszolas elmegy az /api/urlap-ra (blog-hozzaszolas)`, /blog-hozzaszolas/.test(adat) && /Hozzászólás/.test(adat), adat.slice(0, 120));
  }
  // blog lista: kepes kartyak, 12-esevel lapozva (2026-10-16: felul nincs kereso, csak a kartyak)
  if (ered.tipus === 'blog' && o.ut === '/blog') {
    const lathato = () => p.$$eval('.blog-kartya:not([hidden])', (l) => l.map((x) => x.querySelector('b').textContent));
    const elso = await lathato();
    const osszes = await p.$$eval('.blog-kartya', (l) => l.length);
    const kepes = await p.$$eval('.blog-kartya .blog-kep img', (l) => l.length);
    ok(`${cim}: a blog 12 kartyat mutat oldalanként, mindnek van kepe (${elso.length}/${osszes}, ${kepes} kep)`, elso.length === 12 && kepes === osszes);
    await p.click('.blog-lap >> text="2"');
    const masodik = await lathato();
    ok(`${cim}: a blog-lapozo a 2. oldalra lapoz (#oldal-2)`, masodik.length === 12 && masodik[0] !== elso[0] && (await p.evaluate(() => location.hash)) === '#oldal-2');
  }
  // helyszin-lapozo (varosoldalak)
  if (/^\/varosok\//.test(o.ut)) {
    const l = await p.$$eval('.lapozo a', (a) => a.map((x) => x.getAttribute('href')));
    ok(`${cim}: helyszin-lapozo vagy nincs szomszed`, true, l.join(' '));
    for (const href of l) { const r = await p.request.get(BASE + href); ok(`${cim}: a lapozo ${href.slice(0, 50)} letezik`, r.status() === 200, String(r.status())); }
  }
  // urlap (allasjelentkezes)
  const allas = await p.$('form[data-urlap="allasjelentkezes"]');
  if (allas) {
    await allas.scrollIntoViewIfNeeded();
    ctx.__urlap = [];
    await p.click('form[data-urlap="allasjelentkezes"] button[type="submit"]');
    ok(`${cim}: az ures urlap nem megy el (kotelezo mezok)`, (ctx.__urlap || []).length === 0);
    const mezok = await p.$$eval('form[data-urlap="allasjelentkezes"] input:not([type=file]):not([name="bot-field"])', (l) => l.map((i) => ({ id: i.id, t: i.type, n: i.name })));
    for (const m of mezok) {
      const v2 = m.t === 'email' ? 'proba@example.com' : m.t === 'tel' ? '+36301234567' : m.t === 'number' ? '5' : m.t === 'date' ? '1990-01-02' : 'Próba';
      await p.fill('#' + m.id, v2);
    }
    await Promise.all([p.waitForRequest('**/api/urlap', { timeout: 8000 }).catch(() => null), p.click('form[data-urlap="allasjelentkezes"] button[type="submit"]')]);
    await p.waitForTimeout(400);
    const adat = (ctx.__urlap || [])[0] || '';
    ok(`${cim}: a kitoltott allasjelentkezes elmegy az /api/urlap-ra (form-name, mezok)`, /form-name/.test(adat) && /allasjelentkezes/.test(adat) && /Vezet/.test(adat), adat.slice(0, 120));
    // siker utan, mint az eredeti oldalon, a koszonooldalra visz (itt: a tukor koszonooldalara)
    const atment = await p.waitForURL(UJ_ELES ? /\/allas-ok$/ : /\/uj\/allas-ok$/, { timeout: 10000 }).then(() => true).catch(() => false);
    ok(`${cim}: a sikeres jelentkezes utan a koszonooldalra (${UJ}/allas-ok) visz`, atment, p.url());
  }
  ok(`${cim}: nincs JS-hiba`, jsHibak.length === 0, jsHibak.slice(0, 2).join(' | '));
  await p.close();
}

// egyszeru, egymas utani futas oldalankent, de tobb munkas parhuzamosan (minden munkas sajat bongeszo-kontextust kap)
async function futtat() {
  const sor = kijelolt.flatMap((o) => [[o, 'asztali'], [o, 'mobil']]);
  let n = 0;
  await Promise.all(Array.from({ length: PARHUZAM }, async () => {
    const ctxok = { asztali: await ctxKesz('asztali'), mobil: await ctxKesz('mobil') };
    while (n < sor.length) {
      const [o, nezet] = sor[n++];
      try { await lapTeszt(o, nezet, ctxok[nezet]); } catch (e) { ok(`${o.ut} [${nezet}]: lefutott`, false, e.message.split('\n')[0]); }
    }
    await ctxok.asztali.close(); await ctxok.mobil.close();
  }));
}
await futtat();
await b.close();
console.log(`\n${kijelolt.length} oldal, ${db} ellenorzes, hiba: ${hiba}`);
if (process.env.JELENTES) fs.writeFileSync(process.env.JELENTES, hibak.join('\n'));
process.exit(hiba ? 1 : 0);
