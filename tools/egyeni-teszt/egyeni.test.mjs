// A Head Spa akcio oldal = az Egyeni Head Spa landing (/head-spa-kedvezmeny) bongeszos tesztjei (Playwright). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver
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

const OLDAL = 'head-spa-kedvezmeny';
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

describe('/head-spa-kedvezmeny (egyeni + paros)', () => {
  test('betoltodik hibak nelkul: cim, egyetlen H1, noindex + sajat canonical, nincs torott kep / 404 / konzol-hiba', async () => {
    const { p, ctx, hibak, nincs } = await nyit();
    assert.match(await p.title(), /^Head Spa akció Budapesten: 20% kedvezmény egyéni és páros kezelésre \| MOSAIC$/);
    assert.equal(await p.locator('h1').count(), 1, 'egyetlen H1');
    assert.equal((await p.textContent('h1')).trim(), '80 perc, amikor végre semmi dolgod nincs.');
    assert.equal(await p.getAttribute('meta[name=robots]', 'content'), 'noindex'); // mint a regi akcio oldal
    assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://www.mosaicheadspa.hu/head-spa-kedvezmeny');
    const torott = await p.$$eval('img', (l) => l.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
    assert.deepEqual(torott, [], 'torott kepek');
    assert.equal(await p.$$eval('img:not([alt])', (l) => l.length), 0, 'minden kepnek van alt attributuma');
    assert.deepEqual(nincs, [], '404-es helyi kereseik');
    assert.deepEqual(hibak, []);
    assert.equal(await p.locator('#SITE_HEADER, header, [id^="comp-"]').count() > 0, true, 'a MOSAIC fejlec megvan');
    await ctx.close();
  });

  test('a terv szekcioi sorban (asztalon): hero, akcio, erzes, mutat, lepesek, velemenyek, idopontok, ajandek, miert, meg-sosem, ketten, gyik, zaro; nincs felcim', async () => {
    const { p, ctx } = await nyit();
    const sorrend = await p.$$eval('main > section', (l) => l.map((s) => s.id));
    assert.deepEqual(sorrend, ['hero', 'akcio', 'erzes', 'mutat', 'lepesek', 'velemenyek', 'idopontok', 'ajandek', 'miert', 'meg-sosem', 'ketten', 'gyik', 'zaro']);
    const h2 = await p.$$eval('main h2', (l) => l.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
    for (const k of ['20% kedvezmény minden Head Spa szeánszra!', 'Milyen érzés?', 'Nehéz elmagyarázni. Könnyebb megmutatni.', 'Mi történik a 80 percben?', 'Nem nekünk kell elmondanunk, milyen.', 'Válaszd ki az időpontodat', 'Nem magadnak keresed?',
      'Mitől más nálunk a Head Spa?', 'Még sosem voltál Head Spán? Tökéletes.', 'Inkább ketten élnétek át?', 'Gyakran ismételt kérdések', 'Adj magadnak 80 percet.']) assert.ok(h2.includes(k), 'hianyzo cim: ' + k);
    assert.equal(await p.$$eval('.vh-szoveg > *:first-child', (l) => l[0].tagName), 'H1', 'a fo cim elott nincs felcim');
    await ctx.close();
  });

  test('tartalom: ar (26 900 Ft), idotartam, a tartalmazza-lista a szalon sajat szovege, GYIK (8 kerdes), helyszin + nyitvatartas; nincs kitalalt vendegidezet', async () => {
    const { p, ctx } = await nyit();
    await p.click('.tartalmazza summary'); // a lista alapbol csukva: az innerText csak a nyitott tartalmat adja
    const t = await szoveg(p);
    for (const k of ['26 900 Ft', '50+30 perc', 'Profi hajszárítás', 'Személyre szabott kezelés', 'Prémium Head Spa élmény Budapesten: 50 perc teljes kikapcsolódás, majd 30 perc profi hajszárítás.', '1023 Budapest, Bécsi út 2. (Kolosy tér)',
      'Lelassulsz.', 'Kienged a feszültség.', 'Úgy állsz fel, hogy jól is nézel ki.', 'Megérkezel', 'Elkezdődik a Head Spa', 'Jön a rész, amiért mindenki beleszeret', 'Arc, nyak, váll', 'Nem vizes hajjal mész haza',
      'Egyéni Head Spa', 'Páros Head Spa', 'Mit tartalmaz pontosan?', 'Mélytisztító hajmosás', 'Körvízsugaras terápia', 'OXYGENI hajpakolás',
      'Hajkamerás diagnosztika és konzultáció, igény szerint', '+ 30 perc kímélő hajszárítás', 'Digitálisan is megkapod', 'Fizikai kártyaként is kérheted', 'Az időpontot az ajándékozott választja ki',
      'Gyógymasszőrök kezelnek', 'Privát, csendes kezelők', 'Prémium, vegán OXYGENI termékek', 'Két barátnővel', 'Anya-lánya', 'Pároddal', 'H–Szo 8:00–20:00 (vasárnap zárva)', 'Adj magadnak 80 percet.',
      'Foglalok · 26 900 Ft']) assert.ok(t.includes(k), 'hianyzik: ' + k);
    assert.equal(await p.locator('.harmonika-racs details').count(), 8, '8 GYIK-kerdes');
    assert.equal(await p.$$eval('.harmonika-racs details > p', (l) => l.filter((x) => x.textContent.trim().length < 30).length), 0, 'nincs ures valasz');
    // a mockup kitalalt idezetei / adatai nem szerepelnek
    for (const k of ['Nem tudtam, mire számítsak', '[LIVE_REVIEW_COUNT]', 'ötcsillagos értékelés']) assert.ok(!t.includes(k), 'kitalalt adat: ' + k);
    // a Bécsi út 11 parkoló (a cikk valódi tanácsa) a GYIK-ban
    assert.match(await p.$eval('.harmonika-racs', (e) => e.textContent), /Bécsi út 11/);
    await ctx.close();
  });

  test('akcio: a hero az athuzott listaarat + "Októberben 20% kedvezménnyel" sort mutatja; az #akcio blokk a regi akcio oldal szovege (20%, az akcio reszletei, arak), gombjai az idopontokhoz / ajandekkartyahoz visznek', async () => {
    const { p, ctx } = await nyit();
    const hero = (await p.evaluate(() => document.querySelector('#hero').innerText)).replace(/\s+/g, ' ');
    for (const k of ['26 900 Ft', '32 900 Ft', 'Októberben 20% kedvezménnyel']) assert.ok(hero.includes(k), 'hero: ' + k);
    assert.equal(await p.locator('#hero .vh-ar s').count(), 1);
    const t = (await p.evaluate(() => document.querySelector('#akcio').textContent)).replace(/\s+/g, ' ');
    for (const k of ['Októberi akció', '20% kedvezmény minden Head Spa szeánszra!', 'Jelentkezz be Head Spa kezelésre, vagy vásárolj ajándékkártyát 20% kedvezménnyel!', 'Egyéni Head Spa', '32 900 Ft', '26 900 Ft', 'Páros Head Spa', '65 900 Ft', '53 800 Ft',
      'Az akció részletei', 'Minden 2026 októberben leadott, de akár novemberi Head Spa foglalásra (és 2026 októberben vásárolt ajándékkártyára) 20% kedvezmény érvényes! Az akció visszavonásig tart.']) assert.ok(t.includes(k), 'akcio: ' + k);
    assert.equal(await p.getAttribute('#akcio a[data-cta="akcio-idopontok"]', 'href'), '#idopontok');
    assert.equal(await p.getAttribute('#akcio a[data-cta="akcio-ajandekkartya"]', 'href'), '/headspa-ajandekkartya');
    await ctx.close();
  });

  test('egyeni / paros valaszto: ket kartya mozgo videoval, alapbol az egyeni; a valasztas atvaltja az ajanlat-panelt, a szabad idopontokat (paros: 302999) es a foglalo-linkeket; a hibajavitas: "Pároddal"', async () => {
    const parosNaptar = hamisNaptar([2, 4, 7], [9, 11, 13]);
    const { p, ctx, apiKeresek } = await nyit({ api: { ...ALAP_API, 302999: parosNaptar } });
    assert.equal(await p.locator('#valtozat input[type=radio]').count(), 2);
    assert.equal(await p.locator('#valtozat input:checked').getAttribute('value'), 'egyeni');
    assert.deepEqual(await p.$$eval('#valtozat video[data-klip]', (l) => l.map((v) => v.dataset.klip)), ['/assets/video/ajandek-kezeles-egyeni.mp4', '/assets/video/paros-hero-barat.mp4']);
    for (const f of ['assets/video/ajandek-kezeles-egyeni.mp4', 'assets/video/paros-hero-barat.mp4', 'assets/img/paros/hero-barat.jpg', 'assets/img/ajandek/kezeles-egyeni.jpg']) assert.ok(letezik(f), f);
    assert.ok(!(await szoveg(p)).includes('Páróddal') && (await szoveg(p)).includes('Pároddal'), 'az elírás javítva');
    // alapbol az egyeni: ajanlat-panel, cim, link, idopontok
    assert.equal(await p.locator('.ajanlat-panel[data-panel="egyeni"]').isVisible(), true);
    assert.equal(await p.locator('.ajanlat-panel[data-panel="paros"]').isVisible(), false);
    await p.waitForSelector('#napok a.ido');
    assert.equal(await p.textContent('#ido-cim-valtozo'), 'A következő szabad egyéni időpontok');
    assert.equal(await p.getAttribute('#tovabbi-idopontok', 'href'), '/foglalo-motor?business=headspa&service=egyeni');
    const egyeniHref = await p.$$eval('#napok a.ido', (l) => l.map((a) => a.getAttribute('href')));
    for (const h of egyeniHref) assert.match(h, /^\/foglalo-motor\?business=headspa&service=egyeni&start=\d+$/);
    // paros valasztasa
    await p.locator('#valtozat label:has(input[value="paros"])').click();
    await p.waitForFunction(() => document.querySelector('#napok a.ido')?.getAttribute('href')?.includes('service=paros'), null, { timeout: 8000 });
    assert.equal(await p.locator('#valtozat input:checked').getAttribute('value'), 'paros');
    assert.equal(await p.locator('.ajanlat-panel[data-panel="paros"]').isVisible(), true);
    assert.equal(await p.locator('.ajanlat-panel[data-panel="egyeni"]').isVisible(), false);
    assert.match(await p.textContent('.ajanlat-panel[data-panel="paros"] .ajanlat-ar'), /53\s*800\s*Ft/);
    assert.equal(await p.textContent('#ido-cim-valtozo'), 'A következő szabad páros időpontok');
    assert.equal(await p.getAttribute('#tovabbi-idopontok', 'href'), '/foglalo-motor?business=headspa&service=paros');
    const parosHref = await p.$$eval('#napok a.ido', (l) => l.map((a) => a.getAttribute('href')));
    assert.ok(parosHref.length >= 3);
    for (const h of parosHref) assert.match(h, /^\/foglalo-motor\?business=headspa&service=paros&start=\d+$/);
    assert.ok(apiKeresek.some((q) => q.get('serviceId') === '302999'), 'a paros szolgaltatas (302999) idopontjait kerjuk le');
    assert.equal(await p.locator('#slot-uzenet').isVisible(), false);
    // vissza az egyenire: a korabban betoltott idopontok jelennek meg (nincs ujabb lekeres)
    const elotte = apiKeresek.length;
    await p.locator('#valtozat label:has(input[value="egyeni"])').click();
    await p.waitForFunction(() => document.querySelector('#napok a.ido')?.getAttribute('href')?.includes('service=egyeni'));
    assert.equal(apiKeresek.length, elotte, 'a valtozat idopontjai gyorsitotarbol');
    // ?tipus=paros: a paros valtozat az elejen
    await ctx.close();
    const t2 = await nyit({ api: { ...ALAP_API, 302999: parosNaptar }, gorgetve: false });
    await t2.p.goto(`http://localhost:${port}/${OLDAL}?tipus=paros`, { waitUntil: 'domcontentloaded' });
    await t2.p.evaluate(() => document.getElementById('idopontok').scrollIntoView());
    await t2.p.waitForSelector('#napok a.ido');
    assert.equal(await t2.p.locator('#valtozat input:checked').getAttribute('value'), 'paros');
    await t2.ctx.close();
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
    await p.click('.vh-hero a[data-gorgetes="idopontok"]');
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

  test('elore / vissza nyil (asztalon es telefonon is): a visszanyil az elejen letiltva (halvany), a lapozas utan aktiv; a vegen az elorenyil letiltva; asztalon 4, telefonon 3 oszlop latszik egyszerre', async () => {
    const tizenket = hamisNaptar([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [9, 12, 15]);
    for (const [szeles, oszlop] of [[1440, 4], [390, 3]]) {
      const { p, ctx } = await nyit({ szeles, api: { 302342: tizenket, 302499: tizenket } });
      await p.waitForSelector('.nap-oszlop');
      const lathato = () => p.$$eval('.nap-oszlop', (l) => { const k = document.getElementById('napok').getBoundingClientRect(); return l.filter((o) => { const r = o.getBoundingClientRect(); return r.left >= k.left - 2 && r.right <= k.right + 2; }).length; });
      await p.evaluate(() => document.getElementById('idopontok').scrollIntoView());
      assert.equal(await lathato(), oszlop, szeles + ' px: ennyi oszlop latszik');
      assert.equal(await p.locator('#napok-kov').isVisible(), true, 'elore nyil latszik');
      assert.equal(await p.locator('#napok-elozo').isVisible(), true, szeles + ' px: a visszafele nyil is latszik');
      assert.equal(await p.locator('#napok-elozo').isDisabled(), true, 'az elejen a visszanyil letiltva');
      assert.ok(Number(await p.$eval('#napok-elozo', (e) => getComputedStyle(e).opacity)) < 0.6, 'a letiltott visszanyil halvany');
      assert.equal(await p.locator('#napok-kov').isDisabled(), false);
      await p.click('#napok-kov');
      await p.waitForFunction(() => document.getElementById('napok').scrollLeft > 100);
      assert.equal(await p.locator('#napok-elozo').isDisabled(), false, 'lapozas utan a visszanyil aktiv');
      // vissza az elejere a visszanyillal
      await p.click('#napok-elozo');
      await p.waitForFunction(() => document.getElementById('napok').scrollLeft < 4, null, { timeout: 5000 });
      assert.equal(await p.locator('#napok-elozo').isDisabled(), true, 'ujra az elejen: letiltva');
      // a vegen az elorenyil tiltott
      await p.evaluate(() => { const n = document.getElementById('napok'); n.scrollTo({ left: n.scrollWidth, behavior: 'auto' }); });
      await p.waitForFunction(() => document.getElementById('napok-kov').disabled, null, { timeout: 5000 });
      assert.equal(await p.locator('#napok-elozo').isDisabled(), false);
      await ctx.close();
    }
  });

  test('az idopont-szekcio kompakt: nincs "valos idoben a MOSAIC naptarabol" lab-szoveg (p.ido-lab), a "Meg tobb idopont" link megvan; telefonon 3 idopont latszik naponta (+N)', async () => {
    const { p, ctx } = await nyit();
    assert.equal(await p.locator('.ido-lab').count(), 0);
    assert.ok(!(await p.textContent('#idopontok')).includes('valós időben'), 'a lab-szoveg ki');
    assert.equal(await p.locator('#tovabbi-idopontok').count(), 1);
    await ctx.close();
    const m = await nyit({ szeles: 390 });
    await m.p.waitForSelector('.nap-oszlop');
    assert.deepEqual(await m.p.$$eval('.nap-oszlop', (l) => [...new Set(l.map((o) => o.querySelectorAll('a.ido').length))]), [3], 'telefonon naponta 3 idopont');
    const mag = await m.p.$eval('#idopontok', (e) => Math.round(e.getBoundingClientRect().height));
    assert.ok(mag < 1000, 'az idopont-szekcio telefonon kompakt: ' + mag + ' px');
    await m.ctx.close();
  });

  test('a kozos videos hero (assets/css/video-hero.css): asztalon a video a hero TELJES HATTERE; telefonon felul a video (300 px), alatta a szoveg; ar 42 px asztalon (telefonon az akcioval egy sorban, ahhoz igazodo meret); play gomb 62 / 52 px; a harom jelveny telefonon egy sorban', async () => {
    const { p, ctx } = await nyit({ gorgetve: false });
    const d = await p.evaluate(() => {
      const h = document.querySelector('#hero').getBoundingClientRect(), v = document.querySelector('.vh-hatter').getBoundingClientRect();
      const ar = getComputedStyle(document.querySelector('.vh-ar b')).fontSize, play = document.querySelector('.vh-play').getBoundingClientRect();
      return { hh: Math.round(h.height), vh: Math.round(v.height), vw: Math.round(v.width), hw: Math.round(h.width), ar, play: Math.round(play.width) };
    });
    assert.equal(d.vh, d.hh, 'asztalon a hatter a teljes hero magassaga');
    assert.equal(d.vw, d.hw);
    assert.equal(d.ar, '42px');
    assert.equal(d.play, 62);
    assert.equal(await p.locator('#hero a.vh-gomb-arany[data-cta="hero-idopontok"]').count(), 1);
    await ctx.close();
    for (const szeles of [390, 360]) {
      const m = await nyit({ szeles, gorgetve: false });
      const t = await m.p.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const li = [...document.querySelectorAll('.vh-jelvenyek li')].map((e) => Math.round(e.getBoundingClientRect().top));
        const jelv = r('.vh-jelvenyek'), kep = r('.vh-hatter'), h1 = r('#hero h1');
        return { kepMag: Math.round(kep.height), kepTop: Math.round(kep.top - r('#hero').top), h1Top: Math.round(h1.top - r('#hero').top), li, jelvBal: jelv.left, jelvJobb: jelv.right, ablak: innerWidth,
          ar: getComputedStyle(document.querySelector('.vh-ar b')).fontSize, play: Math.round(r('.vh-play').width), playAlatt: r('.vh-lejatszas').top >= r('.vh-hely').bottom - 2, szoveg: document.querySelector('.vh-jelvenyek').innerText.replace(/\s+/g, ' ').trim(),
          google: Math.round(r('.vh-google').height), vizsz: document.documentElement.scrollWidth <= document.documentElement.clientWidth };
      });
      assert.equal(t.kepMag, 300, szeles + ' px: a video 300 px magas');
      assert.equal(t.kepTop, 0);
      assert.ok(t.h1Top >= 200 && t.h1Top < 300, 'a cim a video aljan kezdodik: ' + t.h1Top);
      assert.equal(new Set(t.li).size, 1, szeles + ' px: a harom jelveny egy sorban: ' + t.li);
      assert.ok(t.jelvBal >= 0 && t.jelvJobb <= t.ablak, 'a jelvenyek belefernek');
      assert.equal(t.szoveg, '50+30 perc Profi hajszárítás Személyre szabott', 'telefonon rovid cimkek');
      assert.ok(parseFloat(t.ar) >= 18 && parseFloat(t.ar) <= 26, 'telefonon az ar es az akcio egy sorban van, az ar betumerete ehhez igazodik (2026-10-09): ' + t.ar);
      assert.equal(t.play, 52);
      assert.equal(t.playAlatt, true, 'a play gomb a szoveg alatt');
      assert.ok(t.google < 40, szeles + ' px: a Google-sor egy sorban: ' + t.google);
      assert.equal(t.vizsz, true, 'nincs vizszintes gorgetes');
      await m.ctx.close();
    }
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
    assert.match(await ures.p.textContent('#slot-uzenet'), /nincs szabad (egyéni )?időpont/);
    await ures.ctx.close();
  });

  test('hangos vendegvideok: poszter + lejatszas gomb, kattintasra felugro ablakban (dialog) nyilik a sajat tarhelyes videofajl vezerlokkel, bezaras gombbal / Esc-vel; a Trustindex-velemenyek MINDIG azonnal toltodnek', async () => {
    const { p, ctx } = await nyit();
    const videok = await p.$$eval('[data-nagyvideo]', (l) => l.map((b) => b.dataset.nagyvideo));
    assert.deepEqual(videok, ['/assets/video/c2eb0f_c68f720ea07c4cc6b19dd56b1ab51f35.mp4', '/assets/video/ajandek-vendeg-zsoka.mp4', '/assets/video/ajandek-vendeg-zita.mp4', '/assets/video/ajandek-vendeg-kinga.mp4', '/assets/video/ajandek-vendeg-dori.mp4', '/assets/video/ajandek-vendeg-szandi.mp4']);
    for (const v of videok) assert.ok(letezik(v), 'nincs a repoban: ' + v);
    assert.equal(await p.locator('dialog.vh-lb').count(), 0, 'a nagy lejatszo-ablak csak az elso kattintaskor jon letre');
    await p.click('.video-kartya[data-nagyvideo*="zita"]');
    await p.waitForSelector('dialog.vh-lb[open] video');
    const vid = await p.$('.vh-lb video');
    assert.equal(await vid.getAttribute('controls'), '');
    assert.equal(await vid.$eval('source', (s) => s.getAttribute('src')), '/assets/video/ajandek-vendeg-zita.mp4');
    await p.click('.vh-lb-be');
    assert.equal(await p.$eval('.vh-lb', (d) => d.open), false, 'bezaras gombbal');
    assert.equal(await p.locator('.vh-lb video').count(), 0, 'a video eltunik (nem szol tovabb)');
    // a hero-gomb a hangos erzes-videot nyitja; Esc zar
    await p.click('.vh-lejatszas');
    await p.waitForSelector('.vh-lb[open] video');
    assert.equal(await p.$eval('.vh-lb source', (s) => s.getAttribute('src')), '/assets/video/c2eb0f_c68f720ea07c4cc6b19dd56b1ab51f35.mp4');
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => !document.querySelector('.vh-lb').open);
    // Trustindex: iframe, hozzajarulas nelkul
    const keret = await p.$('#trustindex iframe.ti-keret');
    assert.ok(keret, 'a velemenyek azonnal betoltodnek');
    assert.equal(await keret.getAttribute('src'), '/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html');
    assert.equal(await keret.getAttribute('loading'), 'eager');
    await ctx.close();
  });

  test('mozgokepek: hang nelkuli, ismetlodo klipek; csak akkor toltodnek be es jatszanak, amikor a kepernyon vannak; a hero-video az oldal betoltese utan indul es be-uszik; minden fajl letezik', async () => {
    const { p, ctx } = await nyit({ gorgetve: false });
    const adatok = await p.$$eval('video[data-klip]', (l) => l.map((v) => ({ src: v.dataset.klip, muted: v.muted, loop: v.loop, plays: v.hasAttribute('playsinline'), poster: v.getAttribute('poster'), hero: v.classList.contains('vh-video'), aria: v.getAttribute('aria-hidden') })));
    assert.equal(adatok.length, 17, 'klipek');
    for (const a of adatok) {
      assert.equal(a.muted && a.loop && a.plays, true, 'muted + loop + playsinline: ' + a.src);
      assert.equal(a.aria, 'true', 'dekoracios: ' + a.src);
      assert.ok(letezik(a.src), 'nincs a repoban: ' + a.src);
      if (!a.hero) { assert.ok(a.poster, 'nyitokep kell: ' + a.src); assert.ok(letezik(a.poster), 'nincs a repoban: ' + a.poster); }
    }
    // a hero-klip elindul, a lathatoak jatszanak; a messzi (kepernyon kivuli) klipnek meg nincs src-je
    // a Playwright-Chromium nem tud H.264-et lejatszani: ott a klip betoltese (src) az ellenorizheto, a tenyleges lejatszas (playing / lejatszik) csak valodi Chrome-ban
    const h264 = await p.evaluate(() => !!document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'));
    if (h264) {
      await p.waitForSelector('.vh-video.lejatszik', { timeout: 15000 });
      assert.equal(await p.$eval('.vh-video', (v) => v.paused), false);
    } else await p.waitForFunction(() => document.querySelector('.vh-video').getAttribute('src'), null, { timeout: 15000 });
    assert.equal(await p.$eval('.vh-video', (v) => v.getAttribute('src')), '/assets/video/egyeni-hero.mp4');
    assert.equal(await p.$eval('#zaro video', (v) => v.getAttribute('src')), null, 'a lap vegen levo klip meg nem toltodott');
    // gorgetes a zaro szekciohoz: ott elindul, a hero megall
    await p.evaluate(() => document.documentElement.style.scrollBehavior = 'auto');
    await p.evaluate(() => document.getElementById('zaro').scrollIntoView({ block: 'center' }));
    await p.waitForFunction((h) => { const v = document.querySelector('#zaro video'); return v && v.getAttribute('src') && (!h || !v.paused); }, h264, { timeout: 15000 });
    await p.waitForFunction(() => document.querySelector('.vh-video').paused, null, { timeout: 5000 });
    await ctx.close();
  });

  test('csokkentett mozgas (prefers-reduced-motion): a klipek nem toltodnek be, csak a nyitokepek latszanak; a hero kepe marad', async () => {
    const { p, ctx } = await nyit({ gorgetve: false, mozgasCsokkentve: true });
    await p.waitForTimeout(1500);
    assert.equal(await p.$$eval('video[data-klip]', (l) => l.filter((v) => v.getAttribute('src')).length), 0, 'egy klip sem toltodik');
    assert.equal(await p.locator('.vh-video.lejatszik').count(), 0);
    assert.ok(await p.$eval('.vh-hatter', (i) => i.complete && i.naturalWidth > 0), 'a hero kepe latszik');
    await ctx.close();
  });

  test('ertekelesek szama: a hero / velemenyek / zaro szama a Trustindex aktualis adatabol frissul (tartalek: 1 257), a "+" jel marad', async () => {
    const { p, ctx } = await nyit();
    await p.waitForFunction(() => document.querySelector('[data-ertekeles-db]').textContent === '1 300');
    assert.deepEqual(await p.$$eval('[data-ertekeles-db]', (l) => l.map((e) => e.textContent)), ['1 300', '1 300', '1 300']);
    assert.match(await p.getAttribute('.vh-google', 'aria-label'), /1300 Google-vélemény/);
    assert.match(await p.textContent('.vh-google'), /4,9 \/ 5 Google\s*·\s*1 300\+ vendégvélemény/);
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
    assert.equal(await p.locator('.ajanlat-panel[data-panel="egyeni"] .tartalmazza li').count(), 10);
    await ctx.close();
  });

  for (const [nev, szeles] of [['telefon', 390], ['tablet', 768], ['asztal', 1440]]) {
    test(`nincs vizszintes gorgetes (${nev}, ${szeles} px); az oldal tartalma nem lóg ki`, async () => {
      const { p, ctx } = await nyit({ szeles });
      const m = await p.evaluate(() => {
        const kliens = document.documentElement.clientWidth;
        // a vizszintesen gorgetheto sorokon (napok, videok, lepesek) beluli elemek es a levagott (overflow:hidden) savok hatterei nem szamitanak; a tobbi nem lóghat ki
        const ki = [...document.querySelectorAll('main *')].filter((e) => !e.closest('.napok, .videok, .lepes-sor') && !e.matches('.sav-video, .vh-video, .vh-hatter') && e.getBoundingClientRect().right > kliens + 1).map((e) => e.tagName + '.' + e.className);
        return { kliens, teljes: document.documentElement.scrollWidth, ki };
      });
      assert.deepEqual(m.ki, [], 'a tartalom kilog');
      // 768 px-en a (Wix) asztali fejlec sajat, rogzitett szelessege (~875 px) vizszintes tobbletet ad minden oldalon (a regi Wixes oldalakon is): ott csak a tartalmat merjuk
      if (szeles !== 768) assert.ok(m.teljes <= m.kliens, `vizszintes tulcsordulas: ${m.teljes} > ${m.kliens}`);
      await ctx.close();
    });
  }

  test('telefonon: a sorrend hero -> szabad idopontok -> akcio -> milyen erzes -> nehez elmagyarazni -> ...; a sticky sav telefonon van, asztalon nincs', async () => {
    const { p, ctx } = await nyit({ szeles: 390 });
    const sorrend = await p.$$eval('main > section', (l) => l.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((s) => s.id));
    assert.deepEqual(sorrend.slice(0, 6), ['hero', 'idopontok', 'akcio', 'erzes', 'mutat', 'lepesek']);
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
    await p.click('.video-kartya[data-nagyvideo*="kinga"]');
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
