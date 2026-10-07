// Az Egyeni Head Spa landing (/egyeni-headspa-budapest-uj) bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver
// (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt (fejlec / lablec), minden kulso keres tiltott, a Salonic-API es a Trustindex valasza hamisitott.
//
//   node --test tools/egyeni-teszt/egyeni.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL (alapbol a Windowsos Chrome), PLAYWRIGHT_UTVONAL (a playwright-core node_modules mappaja).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic', 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const { chromium } = playwright();

const OLDAL = 'egyeni-headspa-budapest-uj';
const MOTOR = '/foglalo-motor?business=headspa&service=egyeni';
let szerver, bazis, port, bongeszo;
before(async () => {
  ({ szerver, bazis } = await szerverInditas());
  port = new URL(bazis).port;
  bongeszo = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--host-resolver-rules=MAP www.mosaicheadspa.hu 127.0.0.1', '--autoplay-policy=no-user-gesture-required'] });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

/** letezik-e a repoban (a sparse worktree-ben a nem kicsekkolt fajlok a git indexeben vannak) */
function letezik(rel) {
  const r = rel.replace(/^\//, '');
  if (fs.existsSync(path.join(GYOKER, r))) return true;
  try { return execFileSync('git', ['ls-files', '--', r], { cwd: GYOKER, encoding: 'utf8' }).trim() === r; } catch { return false; }
}

/** hamis Salonic-naptar: n nap, naponta a megadott orakban (UTC), a mai naptol szamitva */
function hamisNaptar(napok, orak) {
  const slots = {};
  let i = 0;
  const ma = new Date();
  for (const n of napok) for (const h of orak) slots['s' + i++] = { timestamp: Math.floor(Date.UTC(ma.getUTCFullYear(), ma.getUTCMonth(), ma.getUTCDate() + n, h) / 1000) };
  return { status: 'success', data: { blocks: { 24065: { k1: { slots } } } } };
}
// a ket valtozat ("Relax" 302342, "Hair" 302499) kulonbozo orakat ad: az unio napi 7 idopont
const ALAP_API = { 302342: hamisNaptar([1, 2, 3, 5, 6, 8, 9], [8, 9, 10, 12, 14]), 302499: hamisNaptar([1, 2, 3, 5, 6, 8, 9], [10, 12, 15, 16]) };
const TI_HTML = '<html><body><div class="ti-header"><div class="ti-rating-text"><a href="#">1 300 vélemény</a></div></div></body></html>';

/** Oldal megnyitasa: kulso forgalom tiltva (naplozva), a Salonic-API / Trustindex hamisitva. api: false = az API hibaval er veget; objektum: szolgaltatas-azonosito -> valasz (false = hiba) */
async function nyit({ szeles = 1440, api = ALAP_API, host = 'localhost', gorgetve = true, mozgasCsokkentve = false } = {}) {
  const mobil = szeles < 700;
  const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}), ...(mozgasCsokkentve ? { reducedMotion: 'reduce' } : {}) });
  const p = await ctx.newPage();
  const hibak = [], kulso = [], nincs = [], apiKeresek = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch|API:/.test(m.text()) && !/leker|szabadKezdesek|idopontokBetolt|TypeError: Failed/.test(m.text())) hibak.push('console: ' + m.text()); });
  p.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(`http://${host}:${port}`)) nincs.push(r.status() + ' ' + r.url().replace(`http://${host}:${port}`, '')); });
  await p.route(/^(?!http:\/\/(localhost|www\.mosaicheadspa\.hu))/, (r) => {
    const u = r.request().url();
    const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (u.startsWith('https://api.salonic.hu/calendar/getAvailableTimes')) {
      const q = new URL(u).searchParams;
      apiKeresek.push(q);
      const valasz = api === false ? false : api[q.get('serviceId')];
      return valasz ? r.fulfill({ status: 200, headers: cors, body: JSON.stringify(valasz) }) : r.abort();
    }
    if (u.startsWith('https://cdn.trustindex.io/widgets/')) return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/html' }, body: TI_HTML });
    kulso.push(u); return r.abort();
  });
  await p.goto(`http://${host}:${port}/${OLDAL}`, { waitUntil: 'domcontentloaded' });
  if (gorgetve) {
    await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await p.waitForLoadState('networkidle').catch(() => {});
  }
  return { p, ctx, hibak, kulso, nincs, apiKeresek };
}
const szoveg = async (p) => (await p.evaluate(() => document.querySelector('main').innerText)).replace(/\s+/g, ' ');

describe('/egyeni-headspa-budapest-uj', () => {
  test('betoltodik hibak nelkul: cim, egyetlen H1, noindex + sajat canonical, nincs torott kep / 404 / konzol-hiba', async () => {
    const { p, ctx, hibak, nincs } = await nyit();
    assert.match(await p.title(), /^Egyéni Head Spa Budapesten, Kolosy tér – 26 900 Ft \| MOSAIC$/);
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.equal((await p.textContent('h1')).trim(), '80 perc, amikor végre semmi dolgod nincs.');
    assert.equal(await p.getAttribute('meta[name=robots]', 'content'), 'noindex, nofollow');
    assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://www.mosaicheadspa.hu/egyeni-headspa-budapest-uj');
    const torott = await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
    assert.deepEqual(torott, [], 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    assert.equal(await p.locator('#SITE_HEADER, header, [id^="comp-"]').count() > 0, true, 'a MOSAIC fejlec megvan');
    await ctx.close();
  });

  test('a terv szekcioi sorban (asztalon): hero, erzes, mutat, lepesek, velemenyek, idopontok, ajandek, miert, meg-sosem, ketten, gyik, zaro; nincs felcim', async () => {
    const { p, ctx } = await nyit();
    const sorrend = await p.$$eval('main > section', (l) => l.map((s) => s.id));
    assert.deepEqual(sorrend, ['hero', 'erzes', 'mutat', 'lepesek', 'velemenyek', 'idopontok', 'ajandek', 'miert', 'meg-sosem', 'ketten', 'gyik', 'zaro']);
    const h2 = await p.$$eval('main h2', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
    for (const k of ['Milyen érzés?', 'Nehéz elmagyarázni. Könnyebb megmutatni.', 'Mi történik a 80 percben?', 'Nem nekünk kell elmondanunk, milyen.', 'Válaszd ki az időpontodat', 'Nem magadnak keresed?',
      'Mitől más nálunk a Head Spa?', 'Még sosem voltál Head Spán? Tökéletes.', 'Inkább ketten élnétek át?', 'Gyakran ismételt kérdések', 'Adj magadnak 80 percet.']) assert.ok(h2.includes(k), 'hianyzo cim: ' + k);
    assert.equal(await p.$$eval('.hero-szoveg > *:first-child', (l) => l[0].tagName), 'H1', 'a fo cim elott nincs felcim');
    await ctx.close();
  });

  test('tartalom: ar (26 900 Ft), idotartam, a tartalmazza-lista a szalon sajat szovege, GYIK (8 kerdes), helyszin + nyitvatartas; nincs kitalalt vendegidezet', async () => {
    const { p, ctx } = await nyit();
    await p.click('.tartalmazza summary'); // a lista alapbol csukva: az innerText csak a nyitott tartalmat adja
    const t = await szoveg(p);
    for (const k of ['26 900 Ft', '50+30 perc', 'profi hajszárítás', 'személyre szabott kezelés', 'Prémium Head Spa élmény Budapesten: 50 perc teljes kikapcsolódás, majd 30 perc profi hajszárítás.', '1023 Budapest, Bécsi út 2. (Kolosy tér)',
      'Lelassulsz.', 'Kienged a feszültség.', 'Úgy állsz fel, hogy jól is nézel ki.', 'Megérkezel', 'Elkezdődik a Head Spa', 'Jön a rész, amiért mindenki beleszeret', 'Arc, nyak, váll', 'Nem vizes hajjal mész haza',
      'Mire helyezzük inkább a hangsúlyt?', 'Inkább relaxálni szeretnék', 'Inkább a hajam / fejbőröm a fókusz', 'Mit tartalmaz pontosan?', 'Mélytisztító hajmosás', 'Körvízsugaras terápia', 'OXYGENI hajpakolás',
      'Hajkamerás diagnosztika és konzultáció, igény szerint', '+ 30 perc kímélő hajszárítás', 'Digitálisan is megkapod', 'Fizikai kártyaként is kérheted', 'Az időpontot az ajándékozott választja ki',
      'Gyógymasszőrök kezelnek', 'Privát, csendes kezelők', 'Prémium, vegán OXYGENI termékek', 'Két barátnővel', 'Anya-lánya', 'Páróddal', 'H–P 8:00–20:00, Szo 9:00–18:00 (vasárnap zárva)', 'Adj magadnak 80 percet.',
      'Foglalok · 26 900 Ft']) assert.ok(t.includes(k), 'hianyzik: ' + k);
    assert.equal(await p.locator('.harmonika-racs details').count(), 8, '8 GYIK-kerdes');
    assert.equal(await p.$$eval('.harmonika-racs details > p', (l) => l.filter((x) => x.textContent.trim().length < 30).length), 0, 'nincs ures valasz');
    // a mockup kitalalt idezetei / adatai nem szerepelnek
    for (const k of ['Nem tudtam, mire számítsak', '[LIVE_REVIEW_COUNT]', 'ötcsillagos értékelés']) assert.ok(!t.includes(k), 'kitalalt adat: ' + k);
    // a Bécsi út 11 parkoló (a cikk valódi tanácsa) a GYIK-ban
    assert.match(await p.$eval('.harmonika-racs', (e) => e.textContent), /Bécsi út 11/);
    await ctx.close();
  });

  test('foglalas-linkek: a hero-gomb gorgeti az idopontokhoz (nincs #hash az URL-ben), a tovabbi idopontok az Egyeni szolgaltatas foglalojara mutat, az ajandekkartya / paros / ajandekkartyas foglalo linkek letezo oldalra', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.getAttribute('#tovabbi-idopontok', 'href'), MOTOR);
    const gombok = await p.$$eval('a[data-gorgetes]', (l) => l.map((a) => [a.dataset.gorgetes, a.getAttribute('href')]));
    assert.ok(gombok.length >= 7);
    for (const [cel, href] of gombok) { assert.equal(href, '#' + cel); assert.ok(await p.locator('#' + cel).count(), 'nincs ilyen szekcio: ' + cel); }
    const ajandek = await p.$$eval('main a[href*="ajandekkartya"]', (l) => [...new Set(l.map((a) => a.getAttribute('href')))]);
    assert.deepEqual(ajandek, ['/headspa-ajandekkartya']);
    assert.ok(fs.existsSync(path.join(GYOKER, 'klon', 'headspa-ajandekkartya.html')), 'az ajandekkartya oldal letezik');
    assert.equal(await p.getAttribute('a[data-cta="ketten-paros"]', 'href'), '/paros-headspa-budapest');
    assert.ok(fs.existsSync(path.join(GYOKER, 'klon', 'paros-headspa-budapest.html')), 'a paros oldal letezik');
    assert.equal(await p.getAttribute('a[data-cta="gyik-ajandekkartya-foglalas"]', 'href'), '/foglalo-motor?business=headspa&voucher=1');
    // a hero-gomb: gorgetes az idopontokhoz, az URL valtozatlan (GTM History Change)
    const elotte = p.url();
    await p.click('.hero a[data-gorgetes="idopontok"]');
    await p.waitForFunction(() => Math.abs(document.getElementById('idopontok').getBoundingClientRect().top) < 120, null, { timeout: 5000 }).catch(() => {});
    assert.equal(p.url(), elotte, 'nincs #hash');
    const top = await p.$eval('#idopontok', (e) => Math.round(e.getBoundingClientRect().top));
    assert.ok(Math.abs(top) < 120, 'az idopontok szekcio a kepernyo tetejen van: ' + top);
    await ctx.close();
  });

  test('szabad idopontok (Salonic-API): az Egyeni ket valtozata (302342 Relax, 302499 Hair; hely 10427) idopontjainak unioja napi oszlopokban, a kattinthato idopont a motorra visz &start=<unix>-szal; "+N" kinyitja a nap osszes idopontjat', async () => {
    const { p, ctx, apiKeresek } = await nyit();
    await p.waitForSelector('.nap-oszlop');
    assert.deepEqual(apiKeresek.map((q) => q.get('serviceId')).sort(), ['302342', '302499']);
    for (const q of apiKeresek) {
      assert.equal(q.get('placeId'), '10427');
      assert.equal(q.get('employeeId'), '-1');
      assert.equal(q.get('calendarId'), 'ebf1c485-e15e-d57f-de78-284a6591ece4');
    }
    const oszlopok = await p.$$eval('.nap-oszlop', (l) => l.map((o) => ({ nap: o.dataset.nap, fej: o.querySelector('.nap-fej').innerText.replace(/\s+/g, ' ').trim(), idok: [...o.querySelectorAll('a.ido')].length, tobb: (o.querySelector('button.link-gomb') || {}).textContent || '' })));
    assert.equal(oszlopok.length, 7, '7 nap');
    for (const o of oszlopok) assert.equal(o.idok, 4, 'oszloponkent 4 idopont latszik elsore');
    assert.match(oszlopok[0].tobb, /^\+3 időpont$/); // az unio napi 7 idopont (8, 9, 10, 12, 14, 15, 16 UTC) - 4
    assert.match(oszlopok[0].fej, /^(H|K|Sze|Cs|P|Szo|V) .*\d+$/);
    // nem minta: nincs "MINTA" felirat
    assert.equal(await p.$eval('#slot-uzenet', (e) => e.hidden), true);
    // az idopont linkje: motor + start (egyezik a data-ido-val)
    const l = await p.$$eval('.nap-oszlop:first-child a.ido', (a) => a.map((x) => [x.getAttribute('href'), x.dataset.ido, x.textContent]));
    for (const [href, ido] of l) assert.equal(href, `${MOTOR}&start=${ido}`);
    // a kinyitas: minden idopont latszik (a ket valtozat unioja)
    await p.click('.nap-oszlop:first-child button.link-gomb');
    assert.equal(await p.locator('.nap-oszlop:first-child a.ido').count(), 7);
    // a ora Budapest-idoben: a hamis API 8 es 16 (UTC) kozotti orakat ad, a kiirt ora 9-17 (nyaron 10-18) kozotti
    const orak = await p.$$eval('.nap-oszlop:first-child a.ido', (a) => a.map((x) => +x.textContent.slice(0, 2)));
    assert.ok(orak.every((o) => o >= 9 && o <= 18), 'orak: ' + orak);
    await ctx.close();
  });

  test('ha az egyik valtozat naptara nem valaszol, a masik idopontjai latszanak (nincs hiba, nincs minta)', async () => {
    const { p, ctx } = await nyit({ api: { 302342: ALAP_API[302342], 302499: false }, host: 'www.mosaicheadspa.hu' });
    await p.waitForSelector('.nap-oszlop');
    assert.equal(await p.locator('.nap-oszlop').count(), 7);
    assert.equal(await p.locator('a.ido[data-minta]').count(), 0, 'nincs minta');
    await p.click('.nap-oszlop:first-child button.link-gomb');
    assert.equal(await p.locator('.nap-oszlop:first-child a.ido').count(), 5, 'csak a Relax valtozat 5 idopontja');
    await ctx.close();
  });

  test('a nyil (kovetkezo napok) gorget, a vegen visszaugrik az elejere; asztalon es telefonon 3 oszlop latszik egyszerre', async () => {
    const tizenket = hamisNaptar([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [9, 12, 15]);
    const { p, ctx } = await nyit({ api: { 302342: tizenket, 302499: tizenket } });
    await p.waitForSelector('.nap-oszlop');
    const lathato = () => p.$$eval('.nap-oszlop', (l) => { const k = document.getElementById('napok').getBoundingClientRect(); return l.filter((o) => { const r = o.getBoundingClientRect(); return r.left >= k.left - 2 && r.right <= k.right + 2; }).length; });
    await p.evaluate(() => document.getElementById('idopontok').scrollIntoView());
    assert.equal(await lathato(), 3);
    assert.equal(await p.locator('#napok-kov').isVisible(), true);
    await p.click('#napok-kov');
    await p.waitForTimeout(900);
    assert.ok(await p.$eval('#napok', (e) => e.scrollLeft) > 100, 'gorgetett');
    for (let i = 0; i < 12 && !(await p.$eval('#napok-kov', (e) => e.classList.contains('vissza'))); i++) { await p.click('#napok-kov'); await p.waitForTimeout(800); }
    assert.equal(await p.$eval('#napok-kov', (e) => e.classList.contains('vissza')), true, 'a vegen a nyil visszafordul');
    await p.click('#napok-kov');
    await p.waitForTimeout(900);
    assert.equal(await p.$eval('#napok', (e) => e.scrollLeft), 0, 'a vegen visszaugrik');
    await ctx.close();
    const m = await nyit({ szeles: 390, api: { 302342: tizenket, 302499: tizenket } });
    await m.p.waitForSelector('.nap-oszlop');
    const mobilLat = await m.p.$$eval('.nap-oszlop', (l) => { const k = document.getElementById('napok').getBoundingClientRect(); return l.filter((o) => { const r = o.getBoundingClientRect(); return r.left >= k.left - 2 && r.right <= k.right + 2; }).length; });
    assert.equal(mobilLat, 3);
    await m.ctx.close();
  });

  test('nincs szabad ido / az API hibaval er veget: elonezeten MINTA idopontok (jelolve), az eles domainen (www.mosaicheadspa.hu) nincs kitalalt idopont, csak hibauzenet + a foglalo linkje', async () => {
    const e = await nyit({ api: false });
    await e.p.waitForSelector('.nap-oszlop');
    assert.match(await e.p.textContent('#slot-uzenet'), /^MINTA időpontok/);
    assert.ok(await e.p.locator('a.ido[data-minta]').count() > 0);
    await e.ctx.close();
    const el = await nyit({ api: false, host: 'www.mosaicheadspa.hu' });
    await el.p.waitForSelector('#slot-uzenet:not([hidden])');
    assert.equal(await el.p.locator('.nap-oszlop').count(), 0, 'eles domainen nincs kitalalt idopont');
    assert.match(await el.p.textContent('#slot-uzenet'), /Most nem sikerült lekérni a szabad időpontokat/);
    assert.equal(await el.p.getAttribute('#slot-uzenet a', 'href'), MOTOR);
    await el.ctx.close();
    const uresBlokk = { status: 'success', data: { blocks: {} } };
    const ures = await nyit({ api: { 302342: uresBlokk, 302499: uresBlokk }, host: 'www.mosaicheadspa.hu' });
    await ures.p.waitForSelector('#slot-uzenet:not([hidden])');
    assert.match(await ures.p.textContent('#slot-uzenet'), /nincs szabad időpont/);
    await ures.ctx.close();
  });

  test('hangos vendegvideok: poszter + lejatszas gomb, kattintasra felugro ablakban (dialog) nyilik a sajat tarhelyes videofajl vezerlokkel, bezaras gombbal / Esc-vel; a Trustindex-velemenyek MINDIG azonnal toltodnek', async () => {
    const { p, ctx } = await nyit();
    const videok = await p.$$eval('[data-video]', (l) => l.map((b) => b.dataset.video));
    assert.deepEqual(videok, ['/assets/video/c2eb0f_c68f720ea07c4cc6b19dd56b1ab51f35.mp4', '/assets/video/ajandek-vendeg-zsoka.mp4', '/assets/video/ajandek-vendeg-zita.mp4', '/assets/video/ajandek-vendeg-kinga.mp4', '/assets/video/ajandek-vendeg-dori.mp4', '/assets/video/ajandek-vendeg-szandi.mp4']);
    for (const v of videok) assert.ok(letezik(v), 'nincs a repoban: ' + v);
    assert.equal(await p.$eval('#lb', (d) => d.open), false);
    await p.click('.video-kartya[data-video*="zita"]');
    await p.waitForSelector('#lb[open] video');
    const vid = await p.$('#lb video');
    assert.equal(await vid.getAttribute('controls'), '');
    assert.equal(await vid.$eval('source', (s) => s.getAttribute('src')), '/assets/video/ajandek-vendeg-zita.mp4');
    await p.click('#lb-be');
    assert.equal(await p.$eval('#lb', (d) => d.open), false, 'bezaras gombbal');
    assert.equal(await p.locator('#lb video').count(), 0, 'a video eltunik (nem szol tovabb)');
    // a hero-gomb a hangos erzes-videot nyitja; Esc zar
    await p.click('.hero-lejatszas');
    await p.waitForSelector('#lb[open] video');
    assert.equal(await p.$eval('#lb source', (s) => s.getAttribute('src')), '/assets/video/c2eb0f_c68f720ea07c4cc6b19dd56b1ab51f35.mp4');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.getElementById('lb').open);
    // Trustindex: iframe, hozzajarulas nelkul
    const keret = await p.$('#trustindex iframe.ti-keret');
    assert.ok(keret, 'a velemenyek azonnal betoltodnek');
    assert.equal(await keret.getAttribute('src'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    assert.equal(await keret.getAttribute('loading'), 'eager');
    await ctx.close();
  });

  test('mozgokepek: hang nelkuli, ismetlodo klipek; csak akkor toltodnek be es jatszanak, amikor a kepernyon vannak; a hero-video az oldal betoltese utan indul es be-uszik; minden fajl letezik', async () => {
    const { p, ctx } = await nyit({ gorgetve: false });
    const adatok = await p.$$eval('video[data-klip]', (l) => l.map((v) => ({ src: v.dataset.klip, muted: v.muted, loop: v.loop, plays: v.hasAttribute('playsinline'), poster: v.getAttribute('poster'), hero: 'hero' in v.dataset, aria: v.getAttribute('aria-hidden') })));
    assert.equal(adatok.length, 17, 'klipek');
    for (const a of adatok) {
      assert.equal(a.muted && a.loop && a.plays, true, 'muted + loop + playsinline: ' + a.src);
      assert.equal(a.aria, 'true', 'dekoracios: ' + a.src);
      assert.ok(letezik(a.src), 'nincs a repoban: ' + a.src);
      if (!a.hero) { assert.ok(a.poster, 'nyitokep kell: ' + a.src); assert.ok(letezik(a.poster), 'nincs a repoban: ' + a.poster); }
    }
    // a hero-klip elindul, a lathatoak jatszanak; a messzi (kepernyon kivuli) klipnek meg nincs src-je
    await p.waitForSelector('.hero-video.lejatszik', { timeout: 15000 });
    assert.equal(await p.$eval('.hero-video', (v) => v.paused), false);
    assert.equal(await p.$eval('.hero-video', (v) => v.getAttribute('src')), '/assets/video/egyeni-hero.mp4');
    assert.equal(await p.$eval('#zaro video', (v) => v.getAttribute('src')), null, 'a lap vegen levo klip meg nem toltodott');
    // gorgetes a zaro szekciohoz: ott elindul, a hero megall
    await p.evaluate(() => document.documentElement.style.scrollBehavior = 'auto');
    await p.evaluate(() => document.getElementById('zaro').scrollIntoView({ block: 'center' }));
    await p.waitForFunction(() => { const v = document.querySelector('#zaro video'); return v && v.getAttribute('src') && !v.paused; }, null, { timeout: 15000 });
    await p.waitForFunction(() => document.querySelector('.hero-video').paused, null, { timeout: 5000 });
    await ctx.close();
  });

  test('csokkentett mozgas (prefers-reduced-motion): a klipek nem toltodnek be, csak a nyitokepek latszanak; a hero kepe marad', async () => {
    const { p, ctx } = await nyit({ gorgetve: false, mozgasCsokkentve: true });
    await p.waitForTimeout(1500);
    assert.equal(await p.$$eval('video[data-klip]', (l) => l.filter((v) => v.getAttribute('src')).length), 0, 'egy klip sem toltodik');
    assert.equal(await p.locator('.hero-video.lejatszik').count(), 0);
    assert.ok(await p.$eval('.hero-hatter', (i) => i.complete && i.naturalWidth > 0), 'a hero kepe latszik');
    await ctx.close();
  });

  test('ertekelesek szama: a hero / velemenyek / zaro szama a Trustindex aktualis adatabol frissul (tartalek: 1 257), a "+" jel marad', async () => {
    const { p, ctx } = await nyit();
    await p.waitForFunction(() => document.querySelector('[data-ertekeles-db]').textContent === '1 300');
    assert.deepEqual(await p.$$eval('[data-ertekeles-db]', (l) => l.map((e) => e.textContent)), ['1 300', '1 300', '1 300']);
    assert.match(await p.getAttribute('.google-nagy', 'aria-label'), /1300 Google-vélemény/);
    assert.match(await p.textContent('.google-nagy'), /4,9 \/ 5 Google\s*·\s*1 300\+ vendégvélemény/);
    assert.match(await p.textContent('.vel-szam'), /^1 300\+$/);
    await ctx.close();
  });

  test('GYIK: a harmonika kinyilik; az ajandekkartyas valasz a foglalo ajandekkartyas belepojere mutat', async () => {
    const { p, ctx } = await nyit();
    await p.click('#gyik-ajandek summary');
    assert.equal(await p.$eval('#gyik-ajandek', (d) => d.open), true);
    assert.equal(await p.isVisible('#gyik-ajandek a'), true);
    await ctx.close();
  });

  test('"Mit tartalmaz pontosan?": alapbol csukva (a kartya magassaga a tobbi kartyahoz igazodik), kattintasra kinyilik, a szalon sajat listaja (10 sor)', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.$eval('.tartalmazza', (d) => d.open), false);
    await p.click('.tartalmazza summary');
    assert.equal(await p.$eval('.tartalmazza', (d) => d.open), true);
    assert.equal(await p.locator('.tartalmazza li').count(), 10);
    await ctx.close();
  });

  for (const [nev, szeles] of [['telefon', 390], ['tablet', 768], ['asztal', 1440]]) {
    test(`nincs vizszintes gorgetes (${nev}, ${szeles} px); az oldal tartalma nem lóg ki`, async () => {
      const { p, ctx } = await nyit({ szeles });
      const m = await p.evaluate(() => {
        const kliens = document.documentElement.clientWidth;
        // a vizszintesen gorgetheto sorokon (napok, videok, lepesek) beluli elemek es a levagott (overflow:hidden) savok hatterei nem szamitanak; a tobbi nem lóghat ki
        const ki = [...document.querySelectorAll('main *')].filter((e) => !e.closest('.napok, .videok, .lepes-sor') && !e.matches('.sav-video, .hero-video, .hero-hatter') && e.getBoundingClientRect().right > kliens + 1).map((e) => e.tagName + '.' + e.className);
        return { kliens, teljes: document.documentElement.scrollWidth, ki };
      });
      assert.deepEqual(m.ki, [], 'a tartalom kilog');
      // 768 px-en a (Wix) asztali fejlec sajat, rogzitett szelessege (~875 px) vizszintes tobbletet ad minden oldalon (a regi Wixes oldalakon is): ott csak a tartalmat merjuk
      if (szeles !== 768) assert.ok(m.teljes <= m.kliens, `vizszintes tulcsordulas: ${m.teljes} > ${m.kliens}`);
      await ctx.close();
    });
  }

  test('telefonon: a sorrend hero -> szabad idopontok -> milyen erzes -> nehez elmagyarazni -> ...; a sticky sav telefonon van, asztalon nincs', async () => {
    const { p, ctx } = await nyit({ szeles: 390 });
    const sorrend = await p.$$eval('main > section', (l) => l.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((s) => s.id));
    assert.deepEqual(sorrend.slice(0, 5), ['hero', 'idopontok', 'erzes', 'mutat', 'lepesek']);
    assert.equal(await p.$eval('#sticky-cta', (e) => getComputedStyle(e).display), 'block');
    // a szabad idopontok kartya az ajanlat elott van (telefonon a foglalas elol)
    const ido = await p.$eval('#szabad-idopontok', (e) => Math.round(e.getBoundingClientRect().top));
    const ajanlat = await p.$eval('.ajanlat-kartya', (e) => Math.round(e.getBoundingClientRect().top));
    assert.ok(ido < ajanlat, 'telefonon az idopontok kartya elol');
    await ctx.close();
    const a = await nyit({ szeles: 1440 });
    assert.equal(await a.p.$eval('#sticky-cta', (e) => getComputedStyle(e).display), 'none');
    await a.ctx.close();
  });

  test('mobil sticky CTA: nem latszik a hero gombjanal es amig az idopont-szekcio a kepernyon van, utana megjelenik (gorgetes-figyelo), a gombja az idopontokhoz gorget', async () => {
    const { p, ctx } = await nyit({ szeles: 390 });
    const lat = () => p.$eval('#sticky-cta', (e) => e.classList.contains('lathato'));
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(200);
    assert.equal(await lat(), false, 'oldal tetejen nem latszik');
    assert.equal(await p.getAttribute('#sticky-cta', 'aria-hidden'), 'true');
    await p.evaluate(() => document.getElementById('idopontok').scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(300);
    assert.equal(await lat(), false, 'az idopont-szekcio kozben nem latszik');
    await p.evaluate(() => document.getElementById('miert').scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(300);
    assert.equal(await lat(), true, 'a szekcio utan latszik');
    assert.equal(await p.getAttribute('#sticky-cta', 'aria-hidden'), 'false');
    await p.click('#sticky-cta a');
    await p.waitForFunction(() => Math.abs(document.getElementById('idopontok').getBoundingClientRect().top) < 120, null, { timeout: 5000 }).catch(() => {});
    assert.ok(Math.abs(await p.$eval('#idopontok', (e) => Math.round(e.getBoundingClientRect().top))) < 120, 'az idopontokhoz gorget');
    await ctx.close();
  });

  test('a lepesek (5) es a vendegvideok (4) telefonon oldalra gorgetheto sor, pontok jelzik a helyzetet', async () => {
    const { p, ctx } = await nyit({ szeles: 390 });
    assert.equal(await p.locator('#lepes-pontok span').count(), 5);
    assert.equal(await p.locator('#lepes-pontok span.aktiv').count(), 1);
    assert.equal(await p.$eval('#lepes-sor', (e) => e.scrollWidth > e.clientWidth + 100), true, 'oldalra gorgetheto');
    await p.evaluate(() => { const s = document.getElementById('lepes-sor'); s.scrollTo({ left: s.scrollWidth, behavior: 'auto' }); });
    await p.waitForTimeout(400);
    assert.equal(await p.$eval('#lepes-pontok span:last-child', (e) => e.classList.contains('aktiv')), true);
    assert.equal(await p.locator('#videok-pontok span').count(), 4);
    assert.equal(await p.$eval('.videok', (e) => e.scrollWidth > e.clientWidth + 100), true, 'a videok sora gorgetheto');
    await ctx.close();
  });

  test('a CTA-k merese: a data-cta-s kattintas egyeni_landing_cta esemenyt kuld a dataLayerbe, a videomegnyitas egyeni_landing_video-t; a fejlec akcios savja nem latszik ezen az oldalon', async () => {
    const { p, ctx } = await nyit();
    await p.evaluate(() => { window.dataLayer = []; });
    await p.click('a[data-cta="mutat-idopontok"]');
    await p.click('.video-kartya[data-video*="kinga"]');
    const dl = await p.evaluate(() => window.dataLayer.filter((x) => /^egyeni_landing_/.test(x.event)));
    assert.deepEqual(dl.map((x) => x.event + ':' + (x.cta || x.video)), ['egyeni_landing_cta:mutat-idopontok', 'egyeni_landing_video:/assets/video/ajandek-vendeg-kinga.mp4']);
    const sav = await p.evaluate(() => { const s = document.getElementById('comp-mpv0ganp'); return s ? getComputedStyle(s).display : 'nincs'; });
    assert.ok(['none', 'nincs'].includes(sav), 'akcios sav: ' + sav);
    await ctx.close();
  });

  test('csak a sajat kereteink: nincs kulso keres a Salonic-API-n es a Trustindexen kivul (a kepek, videok, fontok a sajat tarhelyrol)', async () => {
    const { ctx, kulso } = await nyit();
    const idegen = kulso.filter((u) => !/cdn.trustindex.io|googletagmanager|google-analytics|facebook|tiktok|clarity|stape|doubleclick|googleapis|gstatic/.test(u));
    assert.deepEqual(idegen, []);
    await ctx.close();
  });
});
