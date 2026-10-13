// MOSAIC NEVTELEN SUTISAV-STATISZTIKA - VALODI BONGESZOS BIZONYITEK (a meresi oldal SPEC-je, #167 125. komment)
//   node tools/meres-proba/suti-stat-bongeszo.mjs [--alap <suti.js>] [--naplo <fajl>]
// Valodi Chromium (Playwright), helyi szerver: a MOSTANI assets/js/suti.js-t es az ALAP (origin/main) valtozatot ugyanazzal az oldallal futtatja. Kulso hivas nincs (minden nem helyi keres elutasitva).
// Bizonyitja: (A) a megjelenes es a dontesek esemenyei oldaltipus x eszkoz szerint, text/plain beacon; (B) a sav kinezete / szovege / tarolasa az alap valtozattal AZONOS (DOM + pixel + suti + storage),
// az egyetlen uj halozati keres a /api/suti-stat POST; (C) FAIL-OPEN: 500 / halozati hiba / lefagyott vegpont mellett a dontes azonnal rogzul, a sav eltunik, nincs kezeletlen hiba.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, '..', '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const UJ = fs.readFileSync(path.join(repo, 'assets', 'js', 'suti.js'), 'utf8');
const ALAP = arg('alap', '') ? fs.readFileSync(arg('alap'), 'utf8') : execFileSync('git', ['show', 'origin/main:assets/js/suti.js'], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 24 });
const NAPLO = arg('naplo', '');
const sorok = []; let hibak = 0;
const naplo = (s) => { sorok.push(s); console.log(s); };
const ok = (cimke, rendben, reszlet = '') => { if (!rendben) hibak++; naplo(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);

const OLDAL = '<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>proba</title></head><body><main><h1>Proba oldal</h1><p>Szoveg.</p></main><footer><a href="/impresszum">Impresszum</a></footer><script src="/assets/js/suti.js"></script></body></html>';
function szerver(js) {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      if (q.url.split('?')[0] === '/assets/js/suti.js') { r.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); return r.end(js); }
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); r.end(OLDAL);
    }).listen(0, '127.0.0.1', () => res({ s, port: s.address().port }));
  });
}
const ujSzerver = await szerver(UJ), alapSzerver = await szerver(ALAP);
const ELES = 'www.mosaicheadspa.hu';
const bongeszo = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', `--host-resolver-rules=MAP ${ELES} 127.0.0.1`] });

/** Egy friss bongeszo-kontextus: nem helyi keres ELUTASITVA; a /api/suti-stat POST-okat gyujti. mod: 'ok' | '500' | 'abort' | 'lefagy' */
async function kontextus(port, { mobil = false, mod = 'ok', host = ELES } = {}) {
  const ctx = await bongeszo.newContext({ viewport: mobil ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest' });
  const posts = [], kereskek = [], hibak2 = [];
  await ctx.route('**/*', async (route) => {
    const q = route.request(), u = new URL(q.url());
    if (u.hostname !== ELES && u.hostname !== '127.0.0.1') { kereskek.push(`KULSO-ELUTASITVA ${u.hostname}`); return route.abort(); } // pl. GTM / Meta / TikTok a meroKodok() agrol: a paritas-osszevetesben is szerepel
    kereskek.push(`${q.method()} ${u.pathname}`);
    if (u.pathname === '/api/suti-stat') {
      posts.push({ metodus: q.method(), tipus: q.headers()['content-type'] || '', torzs: q.postData() || '', fejlec: Object.keys(q.headers()) });
      if (mod === '500') return route.fulfill({ status: 500, body: '' });
      if (mod === 'abort') return route.abort('failed');
      if (mod === 'lefagy') return; // sosem valaszol
      return route.fulfill({ status: 204, body: '' });
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => hibak2.push(String(e && e.message || e)));
  const meg = async (ut) => { await page.goto(`http://${host}:${port}${ut}`, { waitUntil: 'load' }); await page.waitForSelector('#mh-cc', { state: 'visible', timeout: 5000 }); await page.waitForTimeout(150); };
  return { ctx, page, posts, kereskek, hibak: hibak2, meg, lezar: () => ctx.close() };
}
const j = (p) => p.posts.map((x) => JSON.parse(x.torzs));
const allapot = async (page) => page.evaluate(() => {
  const mh = JSON.parse(localStorage.getItem('mh_cc') || 'null'); if (mh) delete mh.t; // az idobelyeg a SAJAT dontes-tarolo resze (nem a statisztike), kulon nem hasonlitjuk
  return { ls: mh, lsKulcsok: Object.keys(localStorage).sort(), ssKulcsok: Object.keys(sessionStorage).sort(), cookie: document.cookie.split('; ').map((c) => c.split('=')[0]).filter(Boolean).sort() };
});

naplo(`# suti-stat bongeszos bizonyitek | ${new Date().toISOString()} | uj suti.js ${sha(UJ)} (${UJ.length} B) | alap suti.js ${sha(ALAP)} (${ALAP.length} B)`);

// ---- A) esemenyek: oldaltipus x eszkoz ------------------------------------------------------------------------------------------------------
const OLDALAK = [['/', 'fooldal'], ['/lezeres-szortelenites-budapest', 'landing'], ['/foglalo-motor', 'foglalo'], ['/fodrasz-ok', 'koszono'], ['/oxigenterapia-ok', 'koszono'], ['/aszf', 'egyeb']];
for (const mobil of [false, true]) for (const [ut, tipus] of OLDALAK) {
  const k = await kontextus(ujSzerver.port, { mobil });
  await k.meg(ut);
  await k.page.waitForTimeout(100);
  const e = j(k);
  ok(`A megjelenes ${mobil ? 'mobil' : 'desktop'} ${ut}`, e.length === 1 && JSON.stringify(e[0]) === JSON.stringify({ esemeny: 'megjelent', oldaltipus: tipus, eszkoz: mobil ? 'mobil' : 'desktop' }) && /^text\/plain/.test(k.posts[0].tipus) && k.posts[0].metodus === 'POST', JSON.stringify(e));
  ok(`A nincs kezeletlen hiba ${ut}`, k.hibak.length === 0, k.hibak.join(';'));
  await k.lezar();
}
{
  const k = await kontextus(ujSzerver.port); await k.meg('/lezeres-szortelenites-budapest');
  await k.page.click('#mh-cc [data-mh="accept"]'); await k.page.waitForTimeout(150);
  ok('A "Mindet elfogadom" -> elfogad_minden 1,1,1', JSON.stringify(j(k)[1]) === JSON.stringify({ esemeny: 'elfogad_minden', oldaltipus: 'landing', eszkoz: 'desktop', fun: 1, ana: 1, adv: 1 }), JSON.stringify(j(k)[1]));
  ok('A a sav eltunt, a dontes rogzult', !(await k.page.isVisible('#mh-cc')) && (await allapot(k.page)).ls.adv === true);
  await k.lezar();
  const r = await kontextus(ujSzerver.port, { mobil: true }); await r.meg('/fodrasz-ok');
  await r.page.click('#mh-cc [data-mh="settings"]'); await r.page.click('#mh-cc [data-mh="reject"]'); await r.page.waitForTimeout(150);
  ok('A "Mindet elutasitom" (beallitasokbol) -> elutasit 0,0,0', JSON.stringify(j(r)[1]) === JSON.stringify({ esemeny: 'elutasit', oldaltipus: 'koszono', eszkoz: 'mobil', fun: 0, ana: 0, adv: 0 }), JSON.stringify(j(r)[1]));
  await r.lezar();
  const p = await kontextus(ujSzerver.port); await p.meg('/');
  await p.page.click('#mh-cc [data-mh="settings"]'); await p.page.check('#mh-cc-fun'); await p.page.check('#mh-cc-adv'); await p.page.click('#mh-cc [data-mh="save"]'); await p.page.waitForTimeout(150);
  ok('A kivalasztottak mentese (fun+adv) -> reszleges 1,0,1', JSON.stringify(j(p)[1]) === JSON.stringify({ esemeny: 'reszleges', oldaltipus: 'fooldal', eszkoz: 'desktop', fun: 1, ana: 0, adv: 1 }), JSON.stringify(j(p)[1]));
  await p.lezar();
  const m = await kontextus(ujSzerver.port); await m.meg('/');
  await m.page.click('#mh-cc [data-mh="settings"]'); for (const id of ['fun', 'ana', 'adv']) await m.page.check('#mh-cc-' + id); await m.page.click('#mh-cc [data-mh="save"]'); await m.page.waitForTimeout(150);
  ok('A minden pipa mentese -> elfogad_minden', j(m)[1] && j(m)[1].esemeny === 'elfogad_minden', JSON.stringify(j(m)[1]));
  await m.lezar();
  // visszatero latogato: van dontes -> a sav nem jelenik meg, semmi nem megy
  const v = await kontextus(ujSzerver.port); await v.meg('/'); await v.page.click('#mh-cc [data-mh="accept"]'); await v.page.waitForTimeout(100);
  const elotte = v.posts.length; await v.page.reload({ waitUntil: 'load' }); await v.page.waitForTimeout(300);
  ok('A visszatero latogato: nincs sav, nincs uj esemeny', !(await v.page.isVisible('#mh-cc')) && v.posts.length === elotte, `${elotte} -> ${v.posts.length}`);
  await v.lezar();
}

// nem eles domain (localhost / pages.dev): a sav mukodik, de a statisztika NEM kuld (mint a tobbi mero-kod: csak az eles domainen)
{
  const k = await kontextus(ujSzerver.port, { host: '127.0.0.1' }); await k.meg('/');
  await k.page.click('#mh-cc [data-mh="accept"]'); await k.page.waitForTimeout(200);
  ok('A nem eles domainen (127.0.0.1) a sav mukodik, de nincs beacon', k.posts.length === 0 && (await allapot(k.page)).ls.adv === true, `${k.posts.length} beacon`);
  await k.lezar();
}

// ---- B) paritas az alap (origin/main) valtozattal ------------------------------------------------------------------------------------------------
for (const akcio of ['accept', 'reject', 'reszleges']) for (const mobil of [false, true]) {
  const eredm = {};
  for (const [nev, port] of [['alap', alapSzerver.port], ['uj', ujSzerver.port]]) {
    const k = await kontextus(port, { mobil }); await k.meg('/lezeres-szortelenites-budapest');
    const sav = await k.page.$('#mh-cc');
    const doboz = await sav.boundingBox();
    const html = await sav.evaluate((e) => e.outerHTML);
    const stilus = await sav.evaluate((e) => { const c = getComputedStyle(e); return ['position', 'left', 'right', 'bottom', 'width', 'height', 'background-color', 'color', 'font-size', 'z-index', 'box-shadow'].map((p) => c[p]).join('|'); });
    const kep = await k.page.screenshot({ clip: doboz });
    if (akcio === 'accept') await k.page.click('#mh-cc [data-mh="accept"]');
    else if (akcio === 'reject') { await k.page.click('#mh-cc [data-mh="settings"]'); await k.page.click('#mh-cc [data-mh="reject"]'); } // az elutasitas a beallitasok nezeten van
    else { await k.page.click('#mh-cc [data-mh="settings"]'); await k.page.check('#mh-cc-ana'); await k.page.click('#mh-cc [data-mh="save"]'); }
    await k.page.waitForTimeout(200);
    eredm[nev] = { html, stilus, kepSha: sha(kep), doboz: JSON.stringify(doboz), allapot: await allapot(k.page), kereskek: k.kereskek.filter((x) => !x.includes('/api/suti-stat')), staticPosts: k.posts.length, hibak: k.hibak };
    await k.lezar();
  }
  const a = eredm.alap, u = eredm.uj, cim = `${akcio} ${mobil ? 'mobil' : 'desktop'}`;
  ok(`B ${cim}: a sav DOM-ja (szoveg + gombok) bajtazonos`, a.html === u.html, `${sha(a.html)} = ${sha(u.html)}`);
  ok(`B ${cim}: szamitott stilus + meret azonos`, a.stilus === u.stilus && a.doboz === u.doboz);
  ok(`B ${cim}: a sav kepe (pixel) azonos`, a.kepSha === u.kepSha, `${a.kepSha} = ${u.kepSha}`);
  ok(`B ${cim}: dontes-tarolas azonos (mh_cc mezok), ugyanazok a localStorage / sessionStorage kulcsok, ugyanazok a sutik`, JSON.stringify(a.allapot) === JSON.stringify(u.allapot), JSON.stringify(u.allapot));
  ok(`B ${cim}: az egyetlen uj halozati keres a /api/suti-stat (a tobbi keres azonos); az alap valtozat semmit nem kuld`, JSON.stringify(a.kereskek) === JSON.stringify(u.kereskek) && a.staticPosts === 0 && u.staticPosts === 2, `alap ${a.kereskek.length} keres, uj ${u.kereskek.length} + ${u.staticPosts} beacon`);
  ok(`B ${cim}: nincs kezeletlen hiba`, a.hibak.length === 0 && u.hibak.length === 0);
}

// ---- C) fail-open ----------------------------------------------------------------------------------------------------------------------------------
for (const mod of ['500', 'abort', 'lefagy']) {
  const k = await kontextus(ujSzerver.port, { mod }); await k.meg('/foglalo-motor');
  const t0 = Date.now();
  await k.page.click('#mh-cc [data-mh="accept"]');
  const azonnal = await k.page.evaluate(() => ({ elrejtve: document.getElementById('mh-cc').style.display === 'none', ls: JSON.parse(localStorage.getItem('mh_cc')), api: window.mhSuti.engedely('adv') }));
  const ms = Date.now() - t0;
  ok(`C ${mod}: a dontes AZONNAL rogzul, a sav eltunik, a mhSuti.engedely valtozatlanul mukodik`, azonnal.elrejtve && azonnal.ls.adv === true && azonnal.api === true, `${ms} ms a kattintastol (a vegpont ${mod})`);
  await k.page.waitForTimeout(300);
  ok(`C ${mod}: nincs kezeletlen hiba`, k.hibak.length === 0, k.hibak.join(';'));
  ok(`C ${mod}: a beacon elment (2 db: megjelent + dontes)`, k.posts.length === 2, String(k.posts.length));
  await k.lezar();
}

await bongeszo.close(); ujSzerver.s.close(); alapSzerver.s.close();
naplo(hibak ? `# EREDMENY: ${hibak} HIBA` : '# EREDMENY: minden ellenorzes rendben');
if (NAPLO) fs.writeFileSync(NAPLO, sorok.join('\n') + '\n', 'utf8');
process.exit(hibak ? 1 : 0);
