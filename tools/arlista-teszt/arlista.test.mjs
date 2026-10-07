// Az /arlista oldal tesztjei (2026-10-07). Nincs dist/ es nincs kulso halozat: a konnyu helyi szerver (tools/headspa-teszt/szerver.mjs) allitja ossze az oldalt.
//
//   node --test tools/arlista-teszt/arlista.test.mjs
//
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (lasd tools/headspa-teszt/headspa.test.mjs).
// Ket resz: (1) forras-ellenorzesek bongeszo nelkul: az oldal egyezik a generator kimenetevel, minden ar visszavezetheto a forrasra, a forrasok egymassal
// (es a Salonic-pillanatkepevel) is egyeznek; (2) bongeszos: szuro, kereso, hash, Noel-kapcsolo, tulcsordulas, ar-oszlopok, ertintes-cel.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const olvas = (...r) => fs.readFileSync(path.join(GYOKER, ...r), 'utf8').replace(/\r\n/g, '\n');
const gen = await import(pathToFileURL(path.join(GYOKER, 'tools', 'arlista-oldal.mjs')).href);
const { osszegyujt, oldal, EGYEDI, szam, lapos } = gen;
const adat = await osszegyujt();
const U = Object.fromEntries(adat.map((u) => [u.id, u]));
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// ---- segedek az arak kiolvasasahoz ----
const FT_RE = /(\d{1,3}(?:(?:[.\s\u00a0]|&nbsp;)\d{3})*)(?:\s|\u00a0|&nbsp;)*Ft/g;
const arSzamok = (txt) => new Set([...txt.matchAll(FT_RE)].map((m) => +m[1].replace(/\D/g, '')));
const sorok = (u) => u.csoportok.flatMap((c) => c.sorok);
const szekcioSzoveg = (html, id) => {
  const i = html.indexOf(`<section class="arl-szekcio" id="${id}"`);
  return html.slice(i, html.indexOf('</section>', i)).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
};
const SALONIC = JSON.parse(olvas('docs', 'booking-engine', 'SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json'));
const salonic = (id) => SALONIC.services.find((s) => s.salonic_service_id === String(id));
const hairJson = JSON.parse(olvas('tools', 'hair-oldalak', 'salonic-hair.json'));

describe('forras / szinkron (bongeszo nelkul)', () => {
  test('az oldal szinkronban van a forrasokkal (ha ez elbukik: node tools/arlista-oldal.mjs)', () => {
    assert.equal(olvas('foglalas', 'arlista.html'), oldal(adat));
  });

  test('a hat uzletag megvan, a vart sorszammal (az arak oldalan / adatban valtozhat: ilyenkor a szamot es a forrast is nezd meg)', () => {
    assert.deepEqual(adat.map((u) => u.id), ['headspa', 'szortelenites', 'fodraszat', 'oxigenterapia', 'sminktetovalas', 'ajandekkartya']);
    assert.deepEqual(adat.map((u) => sorok(u).length), [3, 22, 14, 5, 7, 13]);
  });

  test('MINDEN ar, ami az oldalon szerepel, visszavezetheto egy forrasra (nincs kitalalt / elavult ar)', () => {
    const forrasok = ['foglalas/headspa-arak-budapest.html', 'foglalas/lezeres-szortelenites-budapest.html', 'foglalas/oxigenterapia-budapest.html', 'foglalas/sminktetovalas-budapest.html',
      'foglalas/paros-headspa-budapest-uj.html', 'foglalas/noi-fodraszat-budapest-uj.html', 'assets/js/ajandek-adat.js', 'assets/js/ajandek-adat-lezer.js', 'assets/js/ajandek-adat-oxigen.js',
      'assets/js/klon.js', 'docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json'];
    const ismert = new Set();
    for (const f of forrasok) for (const n of arSzamok(olvas(...f.split('/')))) ismert.add(n);
    // a gift-motor termekeinek szam-mezoi (ar_ft: "26900" alakban, Ft nelkul)
    for (const t of Object.values(adat.find((u) => u.id === 'ajandekkartya')._termekek).flat()) ismert.add(t.ar);
    // a Salonic-pillanatkep (fodraszat): lista-ar, regi ar; Noel a Salonic-felirat szerinti 20%-kal
    const noel = hairJson.fodraszok.find((f) => f.kulcs === 'noel').kedvezmeny;
    for (const s of hairJson.szolgaltatasok) { ismert.add(s.ar); if (s.regiAr) ismert.add(s.regiAr); ismert.add(Math.round((s.ar * (100 - noel)) / 100)); }
    const html = olvas('foglalas', 'arlista.html');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>')).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&');
    const oldalon = [...main.matchAll(FT_RE)].map((m) => +m[1].replace(/\D/g, ''));
    assert.ok(oldalon.length > 150, 'sok ar van az oldalon: ' + oldalon.length);
    const nincs = [...new Set(oldalon.filter((n) => !ismert.has(n)))];
    assert.deepEqual(nincs, [], 'nem vezetheto vissza forrasra');
  });

  test('az EGYEDI blokkok szovege szerepel a megnevezett forrasfajlban', () => {
    assert.ok(olvas('assets', 'js', 'ajandek-adat.js').includes(EGYEDI.headspaEgyeniNev.szoveg), 'Egyeni Head Spa nev');
    assert.ok(lapos(olvas('foglalas', 'paros-headspa-budapest-uj.html').replace(/&nbsp;/g, ' ')).includes(EGYEDI.headspaParosFo.szoveg), 'paros: 53 800 Ft / 2 fo');
    const sz = EGYEDI.pmuSzempilla;
    assert.ok(olvas('assets', 'js', 'klon.js').includes(sz.arSzoveg), 'szempilla-suritas: a regi PMU-urlap ugyanezt az arat hasznalja');
    assert.ok(olvas('assets', 'js', 'foglalo-pmu.js').includes(sz.leiras), 'szempilla-suritas leirasa');
    assert.equal(salonic(481061).active_price, sz.ar, 'szempilla-suritas a Salonicban');
    assert.equal(salonic(481061).duration_min, 60);
  });

  test('Head Spa: a harom ar es a regi ar az arak-oldal szerint; ugyanaz az ar a Salonicban es az ajandekkartyakon', () => {
    const ar = Object.fromEntries(sorok(U.headspa).map((s) => [s.nev.replace(/^Egyéni.*/, 'egyeni').replace(/^„4.*/, '4kezes').replace(/^Páros.*/, 'paros'), s]));
    assert.deepEqual([ar.egyeni.ar, ar['4kezes'].ar, ar.paros.ar], [26900, 39900, 53800]);
    assert.deepEqual([ar.egyeni.regi, ar['4kezes'].regi, ar.paros.regi], [32900, 49900, 65900]);
    const forras = olvas('foglalas', 'headspa-arak-budapest.html');
    for (const n of ['26.900 Ft', '39.900 Ft', '53.800 Ft', '32.900 Ft', '49.900 Ft', '65.900 Ft']) assert.ok(forras.includes(n), n);
    assert.deepEqual([salonic(302342).active_price, salonic(431713).active_price, salonic(302999).active_price], [26900, 39900, 53800], 'Salonic');
    const gift = Object.fromEntries(adat.find((u) => u.id === 'ajandekkartya')._termekek.hs.map((t) => [t.id, t.ar]));
    assert.deepEqual([gift.egyeni, gift['4kezes'], gift.paros], [26900, 39900, 53800], 'ajandekkartya = az akcios ar; az akcio vegen az ajandek-adat.js-t is at kell irni');
    assert.ok(!sorok(U.headspa).some((s) => (s.reszlet || []).some((p) => /Csak ajándékkártya/.test(p))), 'az elavult "Csak ajandekkartya keszult" pont nincs kint');
  });

  test('Szortelenites: minden sor az #arlista tablazatbol; 8 alkalmas program = 6 x ar; a Salonic alkalmankenti ara es az elso kezeles (-20%) egyezik', () => {
    const SALONIC_ID = { bajusz: 476511, all: 476512, arc: 476517, honalj: 476521, alkar: 476522, felkar: 476523, kar: 476524, bikini: 476525, intim: 476526, szar: 476527, comb: 476528, lab: 476529,
      hat: 476530, mellkas: 476531, has: 476532, kis: 476533, kozepes: 476535, basic: 476506, medium: 476507, summer: 476508, total: 476509, mantotal: 476510 };
    const forras = olvas('foglalas', 'lezeres-szortelenites-budapest.html');
    const rs = sorok(U.szortelenites);
    assert.equal(rs.length, 22);
    for (const r of rs) {
      assert.equal(r.prog, 6 * r.ar, r.nev + ': 8 alkalmas program');
      assert.ok(forras.includes(`data-kulcs="${r.kulcs}"`) && forras.includes(`data-ar="${r.ar}"`), r.nev + ': a forrasban');
      assert.equal(salonic(SALONIC_ID[r.kulcs]).active_price, r.ar, r.nev + ': Salonic alkalmankenti ar');
      assert.equal(salonic(r.elso).active_price, Math.round(r.ar * 0.8), r.nev + ': Salonic elso kezeles = -20%');
    }
    assert.deepEqual(rs.filter((r) => r.csomag).map((r) => r.regi), [55000, 90000, 114000, 156000, 119000], 'a kesz csomagok "kulon-kulon" ara');
  });

  test('Szortelenites ajandekkartya = a tablazat ara x 0,8 (az elso kezeles ara): a hat kartya', () => {
    const rs = Object.fromEntries(sorok(U.szortelenites).map((r) => [r.kulcs, r.ar]));
    const kartya = Object.fromEntries(adat.find((u) => u.id === 'ajandekkartya')._termekek.lz.map((t) => [t.id, t.ar]));
    for (const [k, v] of Object.entries({ honalj: rs.honalj, basic: rs.basic, lab: rs.lab, summer: rs.summer, total: rs.total, mantotal: rs.mantotal })) assert.equal(kartya[k], Math.round(v * 0.8), k);
  });

  test('Fodraszat: minden ar a Salonic-pillanatkepbol (a mapping-fajllal is egyezik), Noel = -20%', () => {
    const h = U.fodraszat;
    const lista = h.csoportok.filter((c) => c.tipus === 'hossz').flatMap((c) => c.sorok);
    assert.equal(lista.length, 11);
    const idk = new Map(hairJson.szolgaltatasok.map((s) => [s.id, s]));
    let db = 0;
    for (const r of lista) for (const c of Object.values(r.cellak)) {
      if (!c) continue;
      const s = idk.get(c.id); assert.ok(s, 'id a pillanatkepben: ' + c.id);
      assert.equal(c.ar, s.ar);
      if (c.noel !== null) assert.equal(c.noel, Math.round(s.ar * 0.8), r.nev + ' Noel');
      assert.equal(salonic(c.id).active_price, s.ar, r.nev + ': a Salonic-mapping ugyanazt az arat mutatja (' + c.id + ')');
      db++;
    }
    assert.equal(db, 38, 'cellak szama');
    assert.equal(hairJson.fodraszok.find((f) => f.kulcs === 'noel').kedvezmeny, 20);
    // ki mit vallal: a jelentett eltero esetek a pillanatkepbol szarmaznak
    assert.ok(h.kiMit.some((t) => /Férfi hajvágás: csak Betti és Evelin/.test(t)), h.kiMit.join(' | '));
  });

  test('Oxigenterapia: az oldal arai = a Salonic (4 990 / 29 900 / 26 000) = az ajandekkartya; 5 x / 10 x 26 000', () => {
    const rs = sorok(U.oxigenterapia);
    assert.deepEqual(rs.map((r) => r.ar), [4990, 29900, 26000, 130000, 260000]);
    assert.deepEqual([salonic(466147).active_price, salonic(466110).active_price, salonic(466158).active_price], [4990, 29900, 26000]);
    assert.equal(5 * 26000, 130000); assert.equal(10 * 26000, 260000);
    const gift = Object.fromEntries(adat.find((u) => u.id === 'ajandekkartya')._termekek.ox.map((t) => [t.id, t.ar]));
    assert.deepEqual([gift.kamera, gift.elso, gift.ot, gift.tiz], [4990, 29900, 130000, 260000]);
  });

  test('Sminktetovalas: az ot ar-kartya + a szempilla; a Salonic ugyanazt mutatja', () => {
    const rs = Object.fromEntries(sorok(U.sminktetovalas).map((r) => [r.kulcs, r.ar]));
    assert.deepEqual(rs, { konzultacio: 0, 'szemoldok-powder': 79000, 'szemoldok-hibrid': 79000, 'ajak-aquarell': 99000, 'ajak-ruzs': 110000, szemhej: 63000, szempilla: 47000 });
    assert.deepEqual([471154, 471153, 471034, 471152, 481062, 481061].map((id) => salonic(id).active_price), [79000, 79000, 99000, 110000, 63000, 47000]);
  });

  test('nincs elavult ar / nyitvatartas az oldalon', () => {
    const html = olvas('foglalas', 'arlista.html');
    assert.ok(!/29[. \u00a0]900/.test(szekcioSzoveg(html, 'headspa')), 'a Head Spa a regi 29 900 Ft-ot nem mutatja');
    assert.ok(!/9:00\s*[-–]\s*18:00/.test(html), 'nincs regi nyitvatartas');
    assert.ok(!/Csak ajándékkártya készült/.test(html));
  });

  test('a fejlec / lablec jelolok, a fo szkriptek es az indexelhetoseg', () => {
    const html = olvas('foglalas', 'arlista.html');
    assert.ok(html.includes('<!--mh-fejlec-->') && html.includes('<!--mh-menu-aktiv:/arlista-->') && html.includes('<!--mh-lablec-->'));
    assert.ok(html.includes('/assets/css/arlista.css') && html.includes('/assets/js/arlista.js') && html.includes('/assets/js/klon.js'));
    assert.ok(!/name="robots"/.test(html), 'indexelheto');
    assert.ok(!/gtag|fbq\(|dataLayer|data-cta/.test(html + olvas('assets', 'js', 'arlista.js')), 'nincs meres-kod / mero-attributum');
    assert.ok(!/pushState|replaceState|location\.hash\s*=/.test(olvas('assets', 'js', 'arlista.js').replace(/\/\/.*$/gm, '')), 'az URL-t nem irjuk (GTM History Change)');
  });
});

describe('bongeszoben (konnyu helyi szerver)', () => {
  let bongeszo, szerver, bazis;
  before(async () => {
    const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic-engine', 'node_modules')].filter(Boolean);
    let pw; for (const k of keres) { try { pw = createRequire(path.join(k, 'x.js'))('playwright-core'); break; } catch { /* kovetkezo */ } }
    if (!pw) throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
    ({ szerver, bazis } = await szerverInditas());
    bongeszo = await pw.chromium.launch({ executablePath: process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  });
  after(async () => { await bongeszo.close(); szerver.close(); });

  async function nyit(ut = '/arlista', szeles = 1440, { gorget = true, js = true } = {}) {
    const mobil = szeles < 700;
    const ctx = await bongeszo.newContext({ viewport: { width: szeles, height: mobil ? 844 : 900 }, javaScriptEnabled: js, ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
    const p = await ctx.newPage();
    const hibak = [], kulso = [];
    const KULSO_OK = /^https:\/\/cdn\.trustindex\.io\/assets\/js\/richsnippet\.js/;   // a Trustindex rich-snippet minden oldalon betoltodik (suti.js)
    p.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) hibak.push('console: ' + m.text()); });
    await p.route(/^(?!http:\/\/localhost)/, (r) => { if (!KULSO_OK.test(r.request().url())) kulso.push(r.request().url()); r.abort(); });
    await p.goto(bazis + ut, { waitUntil: 'domcontentloaded' });
    await p.waitForLoadState('networkidle').catch(() => {});
    if (gorget && js) await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 20)); } window.scrollTo(0, 0); });
    return { p, ctx, hibak, kulso };
  }
  const lathato = (p) => p.evaluate(() => [...document.querySelectorAll('[data-arl-szekcio]')].filter((s) => !s.hidden).map((s) => s.id));
  const aktivChip = (p) => p.evaluate(() => [...document.querySelectorAll('.arl-chip[aria-current="true"]')].map((c) => c.dataset.szuro));
  const szov = async (p, sel) => lapos(await p.locator(sel).first().innerText());
  const MIND = ['headspa', 'szortelenites', 'fodraszat', 'oxigenterapia', 'sminktetovalas', 'ajandekkartya'];

  describe('tartalom', () => {
    test('betoltodik hiba nelkul, kulso keres nelkul; 1 H1 (Arlista); cim, canonical; mind a hat uzletag; mindegyiknek foglalo-gombja es reszlet-linkje van', async () => {
      const { p, ctx, hibak, kulso } = await nyit();
      assert.deepEqual(hibak, []);
      assert.deepEqual(kulso, []);
      assert.equal(await p.locator('h1').count(), 1);
      assert.equal(await p.locator('h1').innerText(), 'Árlista');
      assert.match(await p.title(), /^Árlista/);
      assert.equal(await p.getAttribute('link[rel=canonical]', 'href'), 'https://www.mosaicheadspa.hu/arlista');
      assert.equal(await p.locator('meta[name=robots]').count(), 0);
      assert.deepEqual(await lathato(p), MIND);
      assert.deepEqual(await aktivChip(p), ['mind']);
      assert.deepEqual(await p.$$eval('.arl-chip', (l) => l.map((c) => c.textContent.trim())), ['Mind', 'Head Spa', 'Szőrtelenítés', 'Fodrászat', 'Oxigénterápia', 'Sminktetoválás', 'Ajándékkártya']);
      for (const id of MIND) {
        assert.equal(await p.locator(`#${id} h2`).count(), 1, id);
        assert.ok(await p.locator(`#${id} .arl-lab a.gomb-arany`).count() === 1, 'foglalas: ' + id);
        assert.equal(await p.locator(`#${id} .arl-tovabb`).count(), 1, 'reszlet: ' + id);
        assert.equal(await p.locator(`.arl-chip[href="#${id}"]`).count(), 1, 'chip: ' + id);
      }
      await ctx.close();
    });

    test('a foglalo- es reszlet-linkek a vart cimre mutatnak', async () => {
      const { p, ctx } = await nyit();
      const f = await p.$$eval('[data-arl-szekcio]', (l) => l.map((s) => ({ id: s.id, gomb: [...s.querySelectorAll('.arl-lab a.gomb')].map((a) => a.getAttribute('href')), tovabb: s.querySelector('.arl-tovabb').getAttribute('href'), csop: [...s.querySelectorAll('.arl-csoport-link')].map((a) => a.getAttribute('href')), kalk: [...s.querySelectorAll('.arl-kalk a')].map((a) => a.getAttribute('href')) })));
      const by = Object.fromEntries(f.map((x) => [x.id, x]));
      assert.deepEqual(by.headspa.gomb, ['/foglalo-motor?business=headspa', '/foglalo-motor?business=headspa&service=paros']);
      assert.deepEqual(by.szortelenites.gomb, ['/foglalo-motor?business=laser']);
      assert.deepEqual(by.fodraszat.gomb, ['/foglalo-motor?business=hair', '/foglalo-motor?business=hair&service=konzultacio']);
      assert.deepEqual(by.oxigenterapia.gomb, ['/foglalo-motor?business=oxygen']);
      assert.deepEqual(by.sminktetovalas.gomb, ['/sminktetovalas-budapest#foglalas']);
      assert.deepEqual(by.ajandekkartya.gomb, ['/ajandekkartya']);
      assert.deepEqual([by.headspa.tovabb, by.szortelenites.tovabb, by.fodraszat.tovabb, by.oxigenterapia.tovabb, by.sminktetovalas.tovabb, by.ajandekkartya.tovabb],
        ['/', '/lezeres-szortelenites-budapest', '/noi-fodraszat-budapest', '/oxigenterapia-budapest', '/sminktetovalas-budapest', '/ajandekkartya']);
      assert.deepEqual(by.ajandekkartya.csop, ['/headspa-ajandekkartya', '/lezeres-ajandekkartya', '/oxigen-ajandekkartya']);
      assert.deepEqual(by.szortelenites.kalk, ['/lezeres-szortelenites-budapest#szamolo']);
      const tel = await p.$$eval('.arl-vege a', (l) => l.map((a) => a.getAttribute('href')));   // a /kapcsolat es a /gyik oldal a #173-mal kerult a main-be
      assert.deepEqual(tel, ['tel:+36202474444', '/kapcsolat', '/gyik']);
      await ctx.close();
    });

    test('a kulcs-arak lathatok: Head Spa (regi ar athuzva), szortelenites (alkalom + 8 alkalmas program, kesz csomag "kulon-kulon" ara), fodraszat, oxigen, PMU, ajandekkartya', async () => {
      const { p, ctx } = await nyit();
      const hs = await szov(p, '#headspa');
      for (const r of ['Egyéni Head Spa kezelés', '26 900 Ft', '32 900 Ft', '„4 Kezes” Head Spa kezelés', '39 900 Ft', '49 900 Ft', 'Páros Head Spa kezelés', '53 800 Ft', '65 900 Ft', '2 fő', 'Októberben 20% kedvezménnyel']) assert.ok(hs.includes(r), 'Head Spa: ' + r);
      assert.equal(await p.locator('#headspa s.arl-regi').count(), 3, 'a regi ar athuzva');
      assert.equal(await p.locator('#headspa details.arl-reszlet').count(), 3);
      const sz = await szov(p, '#szortelenites');
      for (const r of ['Hónalj', '19 000 Ft', '114 000 Ft', 'Teljes láb', '59 000 Ft', '354 000 Ft', 'Basic csomag', '45 500 Ft', '55 000 Ft', 'Man Total csomag', '68 000 Ft', '408 000 Ft', 'Az első kezelés 20% kedvezménnyel', 'ezért csak 6 alkalmat fizetsz']) assert.ok(sz.includes(r), 'Szortelenites: ' + r);
      assert.equal(await p.locator('#szortelenites .arl-sor').count(), 22);
      assert.equal(await p.locator('#szortelenites s.arl-regi').count(), 5);
      const fr = await szov(p, '#fodraszat');
      for (const r of ['Balayage / ombre / babylight', '42 950 Ft', '54 950 Ft', 'Tőfestés', '23 950 Ft', 'Női hajvágás', '11 950 Ft', 'Férfi hajvágás', '7 450 Ft', 'Joico', '19 950 Ft', 'Ingyenes fodrász-konzultáció', '9 900 Ft', 'Póthaj felrakás', '350 Ft', 'Noelnél jelenleg 20% kedvezmény']) assert.ok(fr.includes(r), 'Fodraszat: ' + r);
      const ox = await szov(p, '#oxigenterapia');
      for (const r of ['4 990 Ft', '29 900 Ft', '26 000 Ft', '130 000 Ft', '260 000 Ft', '47 800 Ft', 'Nincs kötelező bérlet']) assert.ok(ox.includes(r), 'Oxigen: ' + r);
      const pm = await szov(p, '#sminktetovalas');
      for (const r of ['79 000 Ft', '99 000 Ft', '110 000 Ft', '63 000 Ft', '47 000 Ft', 'Személyes konzultáció', 'Ingyenes', 'korrekció az árban van']) assert.ok(pm.includes(r), 'PMU: ' + r);
      const aj = await szov(p, '#ajandekkartya');
      for (const r of ['26 900 Ft', '39 900 Ft', '53 800 Ft', '15 200 Ft', '36 400 Ft', '47 200 Ft', '66 800 Ft', '86 000 Ft', '54 400 Ft', '4 990 Ft', '29 900 Ft', '130 000 Ft', '260 000 Ft', '6 hónapig']) assert.ok(aj.includes(r), 'Ajandekkartya: ' + r);
      assert.ok(!(await szov(p, 'main')).match(/9:00\s*[-–]\s*18:00/));
      await ctx.close();
    });
  });

  describe('szuro es kereso', () => {
    test('a chipek uzletagra szurnek oldalfrissites nelkul; a Mind visszahoz mindent; az URL nem valtozik', async () => {
      const { p, ctx } = await nyit();
      const url0 = p.url();
      for (const id of MIND) {
        await p.locator(`.arl-chip[data-szuro="${id}"]`).click();
        assert.deepEqual(await lathato(p), [id], id);
        assert.deepEqual(await aktivChip(p), [id]);
      }
      await p.locator('.arl-chip[data-szuro="mind"]').click();
      assert.deepEqual(await lathato(p), MIND);
      assert.deepEqual(await aktivChip(p), ['mind']);
      assert.equal(p.url(), url0, 'az URL nem valtozik (nincs hash-valtas / History Change)');
      await ctx.close();
    });

    test('bejovo #hash: /arlista#szortelenites az uzletagat valasztja; #paros a Head Spa-t es a paros sort; #arak mindent; ismeretlen hash mindent hagy', async () => {
      for (const [hash, vart, aktiv] of [['#szortelenites', ['szortelenites'], 'szortelenites'], ['#fodraszat', ['fodraszat'], 'fodraszat'], ['#ajandekkartya', ['ajandekkartya'], 'ajandekkartya'], ['#arak', MIND, 'mind'], ['#valami-masik', MIND, 'mind']]) {
        const { p, ctx } = await nyit('/arlista' + hash, 1440, { gorget: false });
        await p.waitForTimeout(150);
        assert.deepEqual(await lathato(p), vart, hash);
        assert.deepEqual(await aktivChip(p), [aktiv], hash);
        await ctx.close();
      }
      const { p, ctx } = await nyit('/arlista#paros', 1440, { gorget: false });
      await p.waitForTimeout(250);
      assert.deepEqual(await lathato(p), ['headspa']);
      assert.ok(await p.locator('#paros').isVisible());
      const r = await p.evaluate(() => document.getElementById('paros').getBoundingClientRect());
      assert.ok(r.top >= 0 && r.top < 400, 'a paros sor a kepernyo tetejen: ' + r.top);
      await ctx.close();
    });

    test('hashchange (pl. a bongeszo elore / vissza gombja, vagy egy masik link): az uzletag valtozik', async () => {
      const { p, ctx } = await nyit('/arlista', 1440, { gorget: false });
      await p.evaluate(() => { location.hash = '#oxigenterapia'; });
      await p.waitForTimeout(250);
      assert.deepEqual(await lathato(p), ['oxigenterapia']);
      await ctx.close();
    });

    test('a kereso minden uzletagban keres (ekezet nelkul is), elrejti az ures csoportokat es szekciokat, jelzi a talalatok szamat; torles utan minden vissza', async () => {
      const { p, ctx } = await nyit();
      await p.locator('#arl-q').fill('honalj');
      await p.waitForTimeout(250);
      assert.ok((await lathato(p)).includes('szortelenites'));
      assert.ok(!(await lathato(p)).includes('oxigenterapia'));
      const db = await p.evaluate(() => [...document.querySelectorAll('.arl-sor')].filter((s) => !s.hidden && s.offsetParent !== null).map((s) => s.querySelector('.arl-nev').textContent));
      assert.ok(db.includes('Hónalj'), db.join('|'));
      assert.ok(db.length >= 6 && db.length <= 20, 'szuk talalat (kezelesek + csomagok + ajandekkartyak): ' + db.length);
      assert.match(await p.locator('#arl-talalat').innerText(), /találat/);
      assert.deepEqual(await aktivChip(p), ['mind'], 'kereses kozben a Mind aktiv');
      // masik uzletag szava
      await p.locator('#arl-q').fill('balayage');
      await p.waitForTimeout(250);
      assert.deepEqual(await lathato(p), ['fodraszat']);
      await p.locator('#arl-q').fill('26 900');
      await p.waitForTimeout(250);
      assert.ok((await lathato(p)).includes('headspa') && (await lathato(p)).includes('ajandekkartya'));
      await p.locator('#arl-q').fill('paros');
      await p.waitForTimeout(250);
      assert.ok((await lathato(p)).includes('headspa'));
      await p.locator('#arl-q').fill('xqzvwy');
      await p.waitForTimeout(250);
      assert.deepEqual(await lathato(p), []);
      assert.equal(await p.locator('#arl-nincs.latszik').count(), 1, 'nincs talalat uzenet');
      assert.match(await p.locator('#arl-talalat').innerText(), /Nincs találat/);
      await p.locator('#arl-q').fill('');
      await p.waitForTimeout(250);
      assert.deepEqual(await lathato(p), MIND);
      assert.equal(await p.locator('.arl-sor[hidden], .arl-csoport[hidden]').count(), 0);
      assert.equal(await p.locator('#arl-nincs.latszik').count(), 0);
      await ctx.close();
    });

    test('kereses utan egy chip kivalasztasa torli a keresest es az uzletagra szur', async () => {
      const { p, ctx } = await nyit();
      await p.locator('#arl-q').fill('balayage');
      await p.waitForTimeout(250);
      await p.locator('.arl-chip[data-szuro="oxigenterapia"]').click();
      assert.equal(await p.locator('#arl-q').inputValue(), '');
      assert.deepEqual(await lathato(p), ['oxigenterapia']);
      assert.equal(await p.locator('#oxigenterapia .arl-sor:not([hidden])').count(), 5);
      await ctx.close();
    });
  });

  describe('fodraszat: Noel kedvezmenye', () => {
    test('a kapcsolo alapbol a listaarakat mutatja; Noelre kapcsolva a -20%-os arak (az eredeti athuzva), a Noel altal nem vallalt sor eltunik; vissza', async () => {
      const { p, ctx } = await nyit();
      assert.equal(await p.locator('[data-arl-noel]').isVisible(), true, 'a kapcsolo JS-sel latszik');
      assert.equal(await p.locator('[data-arl-noel-szoveg]').isVisible(), false, 'a JS nelkuli szoveg elrejtve');
      assert.ok((await szov(p, '#fodraszat .arl-hossz-sor >> nth=0')).includes('42 950 Ft'));
      assert.ok(!(await szov(p, '#fodraszat .arl-hossz-sor >> nth=0')).includes('34 360 Ft'));
      assert.equal(await p.locator('#fodraszat [data-noel-nincs]').first().isVisible(), true, 'a ferfi hajvagas listaaron latszik');
      await p.locator('.arl-kapcs[data-noel="1"]').click();
      const t = await szov(p, '#fodraszat .arl-hossz-sor >> nth=0');
      assert.ok(t.includes('34 360 Ft') && t.includes('42 950 Ft'), 'Noel-ar + athuzott eredeti: ' + t);
      assert.equal(await p.locator('#fodraszat .arl-hossz-sor >> nth=0 >> s.arl-regi:visible').count(), 3, 'a harom cella eredeti ara athuzva');
      assert.equal(await p.locator('.arl-kapcs[data-noel="1"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await p.locator('#fodraszat [data-noel-nincs]').first().isVisible(), false, 'Noel nem vallal ferfi hajvagast');
      assert.ok(!(await szov(p, '#fodraszat')).includes('Férfi hajvágás'), 'Noelnel nincs ferfi hajvagas sor');
      await p.locator('.arl-kapcs[data-noel="0"]').click();
      assert.ok((await szov(p, '#fodraszat')).includes('Férfi hajvágás'));
      assert.ok(!(await szov(p, '#fodraszat .arl-hossz-sor >> nth=0')).includes('34 360 Ft'));
      await ctx.close();
    });

    test('a "Ki mit vallal?" lista a pillanatkep szerinti eltereseket irja (ferfi hajvagas, poethaj, szokites, teljes festes)', async () => {
      const { p, ctx } = await nyit();
      const t = (await p.locator('#fodraszat .arl-kimit').textContent()).replace(/\s+/g, ' ');
      for (const r of ['Férfi hajvágás: csak Betti és Evelin', 'Teljes szőkítés / korrekció', 'csak Noel és Evelin', 'Teljes festés / korrekció (hosszú haj): csak Noel és Evelin']) assert.ok(t.includes(r), r + ' | ' + t);
      await ctx.close();
    });
  });

  describe('JS nelkul', () => {
    test('minden uzletag latszik, a chipek az uzletag-szekciokra ugro horgonyok, a Noel-kapcsolo rejtve, a statikus Noel-szoveg latszik', async () => {
      const { p, ctx } = await nyit('/arlista', 1440, { gorget: false, js: false });
      assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('[data-arl-szekcio]')].map((s) => s.id + ':' + (s.hidden ? 'rejtett' : 'latszik'))), MIND.map((i) => i + ':latszik'));
      assert.deepEqual(await p.$$eval('.arl-chip', (l) => l.map((c) => c.getAttribute('href'))), ['#arak', ...MIND.map((i) => '#' + i)]);
      assert.equal(await p.locator('[data-arl-noel]').isVisible(), false);
      assert.equal(await p.locator('[data-arl-noel-szoveg]').isVisible(), true);
      await ctx.close();
    });
  });

  for (const szeles of [1440, 390, 360]) {
    describe(`${szeles} px`, () => {
      test('nincs vizszintes gorgetes; semmi sem lóg ki a kepernyorol; minden szekcio es sor latszik', async () => {
        const { p, ctx } = await nyit('/arlista', szeles);
        const r = await p.evaluate(() => ({ vizsz: document.documentElement.scrollWidth - innerWidth,
          ki: [...document.querySelectorAll('main a, main p, main h1, main h2, main h3, main span, main b, main li, main input, main button, main summary')].filter((e) => e.offsetParent !== null && !e.closest('.arl-szuro-sav')).filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 1 || b.left < -1); }).map((e) => e.tagName + ':' + (e.textContent || '').trim().slice(0, 30)) }));
        assert.equal(r.vizsz, 0);
        assert.deepEqual(r.ki, []);
        await ctx.close();
      });

      test('az arak nem torodnek sorra (egy sorban allnak), a hajhossz-cellak ara a cellan belul marad', async () => {
        const { p, ctx } = await nyit('/arlista', szeles);
        const rossz = await p.evaluate(() => [...document.querySelectorAll('.arl-uj, .arl-regi, .arl-prog, .arl-egyseg')].filter((e) => e.offsetParent !== null).filter((e) => {
          const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          return e.getBoundingClientRect().height > lh * 1.35 || e.scrollWidth > e.clientWidth + 1;
        }).map((e) => e.textContent.trim()));
        assert.deepEqual(rossz, []);
        const cella = await p.evaluate(() => [...document.querySelectorAll('.arl-cella')].filter((c) => c.offsetParent !== null).filter((c) => [...c.querySelectorAll('.arl-uj, .arl-regi')].some((e) => e.offsetParent !== null && e.getBoundingClientRect().right > c.getBoundingClientRect().right + 0.5)).length);
        assert.equal(cella, 0, 'cellabol kilogo ar');
        // Noel-modban is (az athuzott + az uj ar egy cellaban)
        await p.locator('.arl-kapcs[data-noel="1"]').click();
        const rosszNoel = await p.evaluate(() => [...document.querySelectorAll('#fodraszat .arl-cella .arl-uj, #fodraszat .arl-cella .arl-regi')].filter((e) => e.offsetParent !== null).filter((e) => {
          const c = e.closest('.arl-cella'); const lh = parseFloat(getComputedStyle(e).lineHeight) || 16;
          return e.getBoundingClientRect().height > lh * 1.35 || e.getBoundingClientRect().right > c.getBoundingClientRect().right + 0.5;
        }).length);
        assert.equal(rosszNoel, 0);
        await ctx.close();
      });

      test('az ar-oszlop egy vonalban van: egy csoport soraiban az arak jobb szele azonos', async () => {
        const { p, ctx } = await nyit('/arlista', szeles);
        const r = await p.evaluate(() => [...document.querySelectorAll('.arl-csoport:not(.arl-hossz)')].map((cs) => {
          const jobbak = [...cs.querySelectorAll(':scope > .arl-lista > .arl-sor > .arl-ar')].map((a) => Math.round(a.getBoundingClientRect().right));
          return { db: jobbak.length, kulonbozo: new Set(jobbak).size };
        }));
        assert.ok(r.length >= 12);
        assert.deepEqual(r.filter((x) => x.kulonbozo > 1), []);
        await ctx.close();
      });

      test('letapado szuro-sav: gorgetes utan a fejlec alatt marad (latszik), a Mind / chip kattinthato', async () => {
        const { p, ctx } = await nyit('/arlista', szeles);
        await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 2600); });
        await p.waitForTimeout(250);
        const r = await p.evaluate(() => { const h = document.getElementById('SITE_HEADER').getBoundingClientRect(); const s = document.getElementById('arl-szuro').getBoundingClientRect(); return { fejAlja: Math.round(h.bottom), savTeteje: Math.round(s.top), savAlja: Math.round(s.bottom), magas: innerHeight }; });
        assert.ok(Math.abs(r.savTeteje - r.fejAlja) <= 2, `a sav a fejlec alatt: ${r.savTeteje} vs ${r.fejAlja}`);
        assert.ok(r.savAlja < r.magas / 3, 'a letapado fejlec + sav a kepernyo harmadanal kisebb: ' + r.savAlja);
        await p.locator('.arl-chip[data-szuro="fodraszat"]').click();
        await p.waitForTimeout(500);
        assert.deepEqual(await lathato(p), ['fodraszat']);
        // a kivalasztas utan a lista teteje a sav alatt latszik (nem maradunk a lap aljan)
        const top = await p.evaluate(() => { const h = document.querySelector('#fodraszat .arl-fej').getBoundingClientRect(); return { h: Math.round(h.top), sav: Math.round(document.getElementById('arl-szuro').getBoundingClientRect().bottom) }; });
        assert.ok(top.h >= top.sav - 4 && top.h < 700, 'a fodraszat cime a sav alatt: ' + JSON.stringify(top));
        await ctx.close();
      });
    });
  }

  describe('telefon (390 px)', () => {
    test('ertintes-cel >= 44 px: chipek, gombok, linkek, kapcsolo, lenyilok', async () => {
      const { p, ctx } = await nyit('/arlista', 390);
      const kicsi = await p.evaluate(() => {
        const sel = '.arl-chip, .arl-lab a, .arl-vege a, .arl-csoport-link, .arl-kalk a, .arl-kapcs, .arl-kimit summary, .arl-reszlet summary, #arl-q';
        return [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).filter((e) => e.getBoundingClientRect().height < 43.5).map((e) => e.className + ':' + e.textContent.trim().slice(0, 24) + ':' + Math.round(e.getBoundingClientRect().height));
      });
      assert.deepEqual(kicsi, []);
      await ctx.close();
    });

    test('a chip-sor vizszintesen gorgetheto, a lap nem; a kivalasztott chip a lathato resz kozepe fele gorgetodik', async () => {
      const { p, ctx } = await nyit('/arlista', 390);
      const m = await p.evaluate(() => { const s = document.getElementById('arl-szuro-sav'); return { scroll: s.scrollWidth, kliens: s.clientWidth, lap: document.documentElement.scrollWidth - innerWidth, tobb: document.getElementById('arl-szuro').classList.contains('tobb') }; });
      assert.ok(m.scroll > m.kliens + 40, 'a sor szelesebb, mint a kepernyo: ' + JSON.stringify(m));
      assert.equal(m.lap, 0);
      assert.equal(m.tobb, true, 'a jobb szelen a "van tovabb" jelzes');
      const { p: p2, ctx: c2 } = await nyit('/arlista#ajandekkartya', 390, { gorget: false });
      await p2.waitForTimeout(900);
      const be = await p2.evaluate(() => { const s = document.getElementById('arl-szuro-sav').getBoundingClientRect(); const c = document.querySelector('.arl-chip[data-szuro="ajandekkartya"]').getBoundingClientRect(); return c.left >= s.left - 1 && c.right <= s.right + 1; });
      assert.equal(be, true, 'az Ajandekkartya chip belatszik');
      await ctx.close(); await c2.close();
    });

    test('a hajhossz-cellak 4 egyenlo oszlopban, felirattal (rovid / kozepes / hosszu / extra)', async () => {
      const { p, ctx } = await nyit('/arlista', 390);
      const r = await p.evaluate(() => { const sor = [...document.querySelectorAll('#fodraszat .arl-hossz-sor:not(.arl-egyseges)')][2]; const cs = [...sor.querySelectorAll('.arl-cella')]; return { n: cs.length, szel: cs.map((c) => Math.round(c.getBoundingClientRect().width)), cimke: cs.map((c) => c.querySelector('.hk').getBoundingClientRect().height > 5), oszlopfej: getComputedStyle(document.querySelector('.arl-oszlopok')).display }; });
      assert.equal(r.n, 4);
      assert.ok(Math.max(...r.szel) - Math.min(...r.szel) <= 1, r.szel.join(','));
      assert.deepEqual(r.cimke, [true, true, true, true]);
      assert.equal(r.oszlopfej, 'none');
      await ctx.close();
    });
  });

  describe('asztal (1440 px)', () => {
    test('a hajhossz-oszlopok fejlece latszik, a cellak felirata csak kepernyo-olvasonak van; a fejlec es a lablec megvan', async () => {
      const { p, ctx } = await nyit('/arlista', 1440);
      assert.equal(await p.locator('.arl-oszlopok').first().isVisible(), true);
      assert.deepEqual(await p.$$eval('#fodraszat .arl-oszlopok > span', (l) => l.slice(0, 5).map((e) => e.textContent.trim())), ['A haj hossza', 'Rövid', 'Közepes', 'Hosszú', 'Extra hosszú']);
      assert.ok((await p.locator('#SITE_HEADER').count()) === 1 && (await p.locator('#SITE_FOOTER').count()) === 1);
      const hk = await p.evaluate(() => document.querySelector('#fodraszat .arl-cella .hk').getBoundingClientRect().width);
      assert.ok(hk <= 2, 'a cella-felirat asztalon nem latszik: ' + hk);
      await ctx.close();
    });
  });
});
