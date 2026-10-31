// A Google Ads celoldal-terv (2026-10-31, Feri jovahagyta) atvetele: 5 uj oldal + 7 meglevo oldal szovegkiegeszitese.
// Forras: „MOSAIC Google Ads – céloldal-terv (Feri + fejlesztő) 2026-10-31” (Google-dokumentum), 3. es 4. pont.
//
//   node tools/netlify-build.mjs && node --test tools/google-celoldalak-teszt/celoldalak.test.mjs
//
// Statikus resz: a terv „ezt kell beírni” szovegei BETU SZERINT a foglalas/*.html fajlokban (title, meta, H1, alcimek, mondatok), a generalt masolatok frissek,
// indexelhetok, sajat canonical, sitemap, a mero-kod (Meta-pixel) es a foglalo-uzletag ugyanaz, mint a forrasoldalon.
// Bongeszos resz (a dist/ build, helyi szerver, csak helyi forgalom): 200, nincs atiranyitas, a szovegek LATHATOK (nincs rejtett szoveg) asztali (1366 px) es
// telefon (390 px, mobil UA) nezetben, nincs vizszintes kilogas, nincs JS-hiba; kepernyokep: KEPERNYOKEP_MAPPA (ha meg van adva).
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (mint a tobbi tesztnel).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const ORIGIN = 'https://www.mosaicheadspa.hu';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const KEPMAPPA = process.env.KEPERNYOKEP_MAPPA || '';
const { oldalUzletag } = await import(pathToFileURL(path.join(GYOKER, 'tools/foglalo-atkotes.mjs')).href);

// ---- a terv szovegei (betu szerint) ------------------------------------------------------------------------------------------------------------------
const UJ = {
  'fodrasz-obuda': {
    forras: 'noi-fodraszat-budapest',
    title: 'Fodrász Óbuda – fodrászat a Kolosy térnél – MOSAIC Hair',
    leiras: 'Fodrászat Óbudán, a Kolosy térnél (Bécsi út 2.), a 2. és 3. kerület határán: hajfestés, tőfestés, balayage, ingyenes 30 perces konzultáció, online foglalás.',
    h1: 'Fodrász Óbudán, a Kolosy térnél',
    h2: ['Fodrászat a 3. kerület közelében', 'Fodrász a 2. kerület határán', 'Női fodrász Budán'],
    szoveg: [
      'Fodrászat Óbuda szívében, a Kolosy tér mellett, a Bécsi út 2. alatt – a 2. és a 3. kerület határán. Hajfestés, tőfestés, őszfedés és balayage Bettinél, Noelnél és Evelinnél, előtte ingyenes 30 perces konzultációval.',
      'Ha fodrászt keresel a 3. kerületben, a Kolosy térnél, Óbuda kapujában találsz minket.',
      'A 2. kerületből pár perc: a Bécsi út 2. a Margit híd budai hídfőjétől is gyorsan elérhető.',
      'Női fodrász Buda és Óbuda határán: hajfestés 32 950 Ft-tól, tőfestés 23 950 Ft-tól, balayage 42 950 Ft-tól.',
    ],
  },
  'balayage-budapest': {
    forras: 'balayage-haj-festes-budapest',
    title: 'Balayage Budapest – balayage festés és árak Óbudán – MOSAIC Hair',
    leiras: 'Balayage festés Budapesten, a Kolosy térnél: balayage, babylights, airtouch, melír és ombre Noelnél. Az ár vágással és szárítással együtt értendő, előtte ingyenes 30 perces konzultáció.',
    h1: 'Balayage festés Budapesten',
    h2: ['Balayage árak', 'Babylights festés', 'Airtouch hajfestés', 'Melír és ombre', 'Balayage fodrász: Noel'],
    szoveg: [
      'Balayage Budapesten, a Kolosy térnél (Bécsi út 2.): természetes hatású balayage hajfestés Noelnél. A balayage ár vágással és szárítással együtt értendő; a 30 perces ingyenes konzultáción átbeszéljük a várható árat.',
      'A babylights finom, vékony tincsekkel ad természetes, napszítta hatást.',
      'Airtouch technikával a világosítás átmenete még lágyabb.',
      'Melír és ombre festés is kérhető, a konzultáción választjuk ki, melyik illik a hajadhoz.',
      'Miért válaszd Noelt?',
    ],
  },
  'hajfestes-budapest': {
    forras: 'noi-hajfestes-budapest',
    title: 'Hajfestés Budapest – tőfestés, őszfedés, szőkítés – MOSAIC Hair',
    leiras: 'Női hajfestés Budapesten, Óbudán, a Kolosy térnél: hajfestés, tőfestés 23 950 Ft-tól, őszfedés, szőkítés és hajszín korrekció Evelinnél, ingyenes konzultációval.',
    h1: 'Női hajfestés Budapesten',
    h2: ['Tőfestés', 'Őszfedés', 'Szőkítés', 'Hajszín korrekció'],
    szoveg: [
      'Hajfestés Budapesten, Óbudán, a Kolosy tér mellett (Bécsi út 2.). Tőfestés, őszfedés, szőkítés és hajszín korrekció Evelinnél – a 2. és 3. kerület határán, előtte ingyenes konzultációval.',
      'Tőfestés 23 950 Ft-tól, festékkel és szárítással.',
      'Egyenletes őszfedés, a saját színedhez igazítva.',
      'Szőkítés és világosítás a hajad állapotához igazítva, előzetes konzultációval.',
      'Ha nem lett jó a szín, előbb felmérjük, aztán javítjuk.',
    ],
    nincs: ['Hajhosszabbítás', 'Póthaj', 'póthaj'],
  },
  'szemoldok-tetovalas-budapest': {
    forras: 'sminktetovalas-budapest',
    title: 'Szemöldök tetoválás Budapest – púderes és hibrid szemöldök – Töreki Melitta, MOSAIC',
    leiras: 'Szemöldök tetoválás Budapesten, a Kolosy térnél: púderes (powder brows) és hibrid szemöldök Töreki Melittánál. 79 000 Ft, a 4–7 hét utáni korrekció az árban, nincs előleg.',
    h1: 'Természetes szemöldök tetoválás Budapesten',
    h2: ['Szemöldök tetoválás árak', 'Púderes szemöldök tetoválás (powder brows)', 'Hibrid szemöldök tetoválás'],
    szoveg: [
      'Szemöldök tetoválás Budapesten Töreki Melittánál, a Kolosy térnél (Bécsi út 2.). Púderes vagy hibrid szemöldök – a szemöldök tetoválás ára 79 000 Ft, a korrekció az árban van. Szombaton is van időpont.',
      'Szemöldök tetoválás: 79 000 Ft, a 4–7 hét utáni korrekcióval együtt, előleg nélkül.',
      'A púderes szemöldök puha, sminkszerű árnyékolás.',
      'A hibrid szemöldök az árnyékolást finom szálas rajzolattal kombinálja.',
      'Szemöldöktetoválás Budapesten', // egybeirva is (a szovegben egyszer)
    ],
    nincs: ['Ajaktetoválás érdekel', 'data-szuro="ajak"', 'data-kategoria="ajak"', 'data-salonic="ajak-', 'data-salonic="szemhej"', 'Szemhéj – füstös'],
  },
  'hajhullas-kezeles-budapest': {
    forras: 'oxigenterapia-budapest',
    title: 'Hajhullás kezelés Budapest – hajkamerás vizsgálat és oxigénes hajkezelés – MOSAIC',
    h1: 'Hajhullás kezelés Budapesten',
    h2: ['Hajhullás vizsgálat Budapest', 'Erős hajhullás kezelése', 'Női hajhullás kezelése', 'Hajritkulás kezelés'],
    szoveg: [
      'Hajhullás kezelés Budapesten, a Kolosy térnél (Bécsi út 2.): hajkamerás vizsgálattal kezdünk (4 990 Ft), utána 80 perces oxigénes hajkezelés (első kezelés felméréssel 29 900 Ft, 2. alkalomtól 26 000 Ft). Kötelező bérlet nincs.',
      'Hajkamerával közelről megnézzük a fejbőr és a hajszálak állapotát.',
      'Erős hajhullásnál is a felméréssel kezdünk, és ez alapján javasolunk kezelést.',
      'Női vendégeinknél is ugyanígy: felmérés, majd személyre szabott kezelési terv.',
      'Ritkuló hajnál a fejbőr állapotát nézzük meg először.',
    ],
  },
};
const MEGLEVO = {
  'sminktetovalas-budapest': {
    h1: 'Természetes sminktetoválás Budapesten',
    h2: ['Sminktetoválás árak', 'Szemöldök- és ajaktetoválás'],
    szoveg: ['Szemöldök tetoválás 79 000 Ft, ajaktetoválás 99 000 Ft-tól, a korrekció mindkettőben benne van.', 'Sminktetováló Budapesten, a Kolosy térnél: Töreki Melitta.', '…ami illik az arcformádhoz.'],
  },
  'szajtetovalas-budapest': {
    title: 'Szájtetoválás és ajaktetoválás Budapest – aquarell ajak – Töreki Melitta, MOSAIC',
    h1: 'Természetes szájtetoválás és ajaktetoválás Budapesten',
    h2: ['Ajaktetoválás árak', 'Aquarell ajaktetoválás'],
    szoveg: ['Ajaktetoválás 99 000 Ft-tól, a 4–7 hét utáni korrekcióval együtt, előleg nélkül.', 'Az aquarell ajak kontúr nélküli, áttetsző színfrissítés.', 'Ajak sminktetoválás'],
  },
  'oxigenterapia-budapest': {
    title: 'Oxigénes hajkezelés Budapesten – oxigénterápia hajra – MOSAIC',
    h1: 'Működő oxigénterápia hajhullás és gyulladás ellen',
    h2: ['Oxigénes hajkezelés Budapesten', 'Oxigén hajterápia', 'Oxigénterápia hajra – árak'],
    szoveg: ['80 perces oxigén hajterápia headspa ágyban, külön kezelőszobában.', 'Hajkamerás felmérés 4 990 Ft, első kezelés 29 900 Ft, 2. alkalomtól 26 000 Ft.', 'Oxigénterápia Budapest', 'oxigénterápiás hajkezelés'],
  },
  'hajvizsgalat-budapest': {
    title: 'Hajvizsgálat Budapest – hajkamerás fejbőr vizsgálat 4 990 Ft – MOSAIC',
    h1: 'Hajvizsgálat Budapest – hajkamerás haj- és fejbőr vizsgálat 4 990 Ft-ért',
    h2: ['Fejbőr vizsgálat Budapest', 'Hajdiagnosztika'],
    szoveg: ['A fejbőr vizsgálat során hajkamerával, nagyítva nézzük meg a fejbőr állapotát.', 'A hajdiagnosztika után személyre szabott fejbőrápolási javaslatot kapsz.'],
  },
  'lezeres-szortelenites-budapest': {
    title: 'Lézeres szőrtelenítés Budapest – végleges szőrtelenítés garanciával – MOSAIC',
    h1: 'Végleges lézeres szőrtelenítés Budapesten, 12 hónap garanciával',
    h2: ['Lézeres szőrtelenítés árak', 'Dióda lézeres szőrtelenítés', 'Lézeres szőrtelenítés Óbuda és Buda közelében'],
    szoveg: ['Mennyibe kerül?', 'Elysion Pro diódalézer, Crystal Freeze hűtéssel.', 'A Kolosy térnél, a Bécsi út 2. alatt, a 2. és a 3. kerület határán.', 'hónalj', 'teljes láb'],
  },
  'intim-lezeres-szortelenites-budapest': {
    h2: ['Bikini vonal lézeres szőrtelenítés'],
    szoveg: ['Bikini vonal 19 000 Ft, teljes intim 36 000 Ft alkalmanként.', 'Intim szőrtelenítés Budapest', 'lézeres intim szőrtelenítés'],
  },
  'vegleges-szortelenites-ferfiaknak': {
    h2: ['Hát lézeres szőrtelenítés férfiaknak', 'Mellkas lézeres szőrtelenítés férfiaknak', 'Férfi intim lézeres szőrtelenítés'],
    szoveg: ['Hát szőrtelenítés Elysion Pro diódalézerrel, első alkalom 20% kedvezménnyel.', 'A mellkas és a has egy kezelésen belül is kérhető.'],
  },
};

const olvas = (...p) => fs.readFileSync(path.join(GYOKER, ...p), 'utf8').replace(/\r\n/g, '\n');
const norm = (s) => String(s).replace(/&nbsp;|\u00a0/g, ' ').replace(/&shy;|\u00ad/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const lapSzoveg = (html) => norm(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' '));
const cimek = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g'))].map((m) => norm(m[1].replace(/<[^>]+>/g, '')));
const pixelek = () => {
  const s = olvas('assets/js/suti.js');
  const tabla = {};
  for (const m of s.matchAll(/\[(PIXEL_[A-Z]+), '([^']+)'\]/g)) for (const o of m[2].split(' ')) tabla[o] = m[1];
  return tabla;
};

// ======================= statikus ellenorzesek =======================
describe('a terv szovegei a forrasfajlokban (betu szerint)', () => {
  for (const [fajl, t] of Object.entries({ ...UJ, ...MEGLEVO })) {
    test(fajl, () => {
      const h = olvas('foglalas', fajl + '.html');
      if (t.title) assert.equal(norm((h.match(/<title>([^<]*)<\/title>/) || [])[1]), t.title, 'title');
      if (t.title) assert.equal(norm((h.match(/<meta property="og:title" content="([^"]*)">/) || [])[1]), t.title, 'og:title');
      if (t.leiras) {
        assert.equal(norm((h.match(/<meta name="description" content="([^"]*)">/) || [])[1]), t.leiras, 'meta leiras');
        assert.equal(norm((h.match(/<meta property="og:description" content="([^"]*)">/) || [])[1]), t.leiras, 'og:description');
      }
      if (t.h1) assert.deepEqual(cimek(h, 'h1'), [t.h1], 'egyetlen H1, a terv szovege');
      const h2k = cimek(h, 'h2');
      for (const c of t.h2) assert.ok(h2k.includes(c), `hianyzik a H2: ${c}`);
      const sz = lapSzoveg(h);
      for (const m of t.szoveg) assert.ok(sz.includes(m), `hianyzik a szoveg: ${m}`);
      for (const n of t.nincs || []) assert.ok(!h.includes(n), `nem maradhat a masolatban: ${n}`);
    });
  }
});

describe('az uj oldalak: masolat, indexelheto, sajat canonical, sitemap, meres, foglalo', () => {
  const sitemap = olvas('tools/wix-sitemap/pages-sitemap.xml');
  const pix = pixelek();
  for (const [fajl, t] of Object.entries(UJ)) {
    test(fajl, () => {
      const h = olvas('foglalas', fajl + '.html');
      assert.ok(!/<meta name="robots"/.test(h), 'nincs robots meta (indexelheto)');
      assert.ok(h.includes(`<link rel="canonical" href="${ORIGIN}/${fajl}">`), 'canonical: onmaga');
      assert.ok(h.includes(`<meta property="og:url" content="${ORIGIN}/${fajl}">`), 'og:url: onmaga');
      assert.ok(h.includes('<!--mh-fejlec-->') && h.includes('<!--mh-lablec-->'), 'a MOSAIC fejlece es lablece');
      assert.ok(sitemap.includes(`<loc>${ORIGIN}/${fajl}</loc>`), 'a sitemapben');
      assert.equal(pix[fajl], pix[t.forras], 'ugyanaz a Meta-pixel, mint a forrasoldalon');
      assert.ok(pix[fajl], 'van Meta-pixel');
      assert.equal(oldalUzletag(fajl + '.html'), oldalUzletag(t.forras + '.html'), 'ugyanaz a foglalo-uzletag, mint a forrasoldalon');
      const forras = olvas('foglalas', t.forras + '.html');
      for (const jel of ['<!--mh-foglalas:', '<!--mh-menu-aktiv:', '<!--mh-nyitvatartas:', '/assets/js/suti.js']) assert.equal(h.includes(jel), forras.includes(jel), `${jel}: mint a forrasoldalon`);
      // a regi oldal valtozatlan helyen marad: nincs atiranyitas az uj cimre (es fordítva sem)
      const ut = olvas('netlify/lib/utvonal.js');
      assert.ok(!ut.includes(`'/${fajl}'`) && !ut.includes(`'/${t.forras}': '`), 'nincs atiranyitas');
    });
  }
  test('a generalt masolatok frissek (node tools/hair-oldalak.mjs, node tools/google-celoldalak.mjs)', async () => {
    const hair = await import(pathToFileURL(path.join(GYOKER, 'tools/hair-oldalak.mjs')).href);
    for (const k of hair.OSSZES_KULCS) {
      const nev = (await import(pathToFileURL(path.join(GYOKER, 'tools/hair-oldalak/google-oldalak.mjs')).href)).GOOGLE_LAPOK[k]?.fajl;
      if (nev) assert.equal(olvas('foglalas', nev + '.html'), hair.oldal(k), `${nev}.html elavult: node tools/hair-oldalak.mjs`);
    }
    const g = await import(pathToFileURL(path.join(GYOKER, 'tools/google-celoldalak.mjs')).href);
    for (const f of Object.keys(g.CELOLDALAK)) assert.equal(olvas('foglalas', f + '.html'), g.masolat(f), `${f}.html elavult: node tools/google-celoldalak.mjs`);
  });
  test('a szemoldok-celoldal a beagyazott PMU-foglalot tolti (nem kap launchert), mint a forrasa', () => {
    assert.match(olvas('tools/netlify-build.mjs'), /FOGLALO_OLDALAK = new Set\(\[[^\]]*'szemoldok-tetovalas-budapest\.html'/);
  });
});

// ======================= bongeszos ellenorzes (dist/) =======================
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}
const DIST = path.join(GYOKER, 'dist');
let szerver, bazis, bongeszo;
before(async () => {
  if (!fs.existsSync(path.join(DIST, '_a', 'fodrasz-obuda.html'))) throw new Error('nincs friss dist/: futtasd elobb: node tools/netlify-build.mjs');
  const { fajlUtvonal } = await import(pathToFileURL(path.join(GYOKER, 'tools/serve-dist.mjs')).href);
  szerver = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (req.method === 'POST') { res.writeHead(200); return res.end('{}'); }
    const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers['user-agent']);
    if (e.atiranyit) { res.writeHead(301, { location: encodeURI(e.atiranyit) + u.search }); return res.end(); }
    fs.readFile(e.fajl, (hiba, adat) => {
      if (hiba) { res.writeHead(404); return res.end('nincs'); }
      const tipus = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' }[path.extname(e.fajl)];
      res.writeHead(200, tipus ? { 'content-type': tipus } : {}); res.end(adat);
    });
  });
  await new Promise((ok) => szerver.listen(0, ok));
  bazis = `http://localhost:${szerver.address().port}`;
  bongeszo = await playwright().chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await bongeszo?.close(); szerver?.close(); });

async function vizsgal(fajl, t, mobil) {
  const ctx = await bongeszo.newContext({ viewport: { width: mobil ? 390 : 1366, height: mobil ? 844 : 900 }, reducedMotion: 'reduce', ...(mobil ? { userAgent: UA_MOBIL, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const hibak = [];
  p.on('pageerror', (e) => hibak.push(String(e)));
  await p.route((u) => !/^http:\/\/localhost/.test(u.href), (r) => r.abort());
  const valasz = await p.goto(`${bazis}/${fajl}`, { waitUntil: 'load' });
  assert.equal(valasz.status(), 200, 'HTTP 200');
  assert.equal(new URL(p.url()).pathname, `/${fajl}`, 'nincs atiranyitas');
  await p.waitForTimeout(400);
  const eredmeny = await p.evaluate(({ h2, szoveg, h1 }) => {
    const n = (s) => String(s).replace(/\u00a0/g, ' ').replace(/\u00ad/g, '').replace(/\s+/g, ' ').trim();
    const lathato = (el) => {
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const cs = getComputedStyle(el);
      return parseFloat(cs.fontSize) >= 10 && cs.color !== 'rgba(0, 0, 0, 0)';
    };
    const hianyzo = [];
    const h1k = [...document.querySelectorAll('main h1, body h1')].filter((e) => !e.closest('template'));
    if (h1 && !(h1k.length === 1 && n(h1k[0].textContent) === h1 && lathato(h1k[0]))) hianyzo.push('H1: ' + h1 + ' (talalt: ' + h1k.map((e) => n(e.textContent)).join(' | ') + ')');
    const h2k = [...document.querySelectorAll('h2')];
    for (const c of h2) { const e = h2k.find((x) => n(x.textContent) === c); if (!e || !lathato(e)) hianyzo.push('H2: ' + c); }
    const elemek = [...document.querySelectorAll('main p, main li, main h2, main h3, main span, main small, main td, main summary')];
    for (const s of szoveg) {
      const e = elemek.find((x) => n(x.textContent).includes(s) && lathato(x));
      if (!e) hianyzo.push('szoveg: ' + s);
    }
    return { hianyzo, kilog: document.documentElement.scrollWidth - innerWidth, cim: document.title };
  }, { h2: t.h2, szoveg: t.szoveg, h1: t.h1 || null });
  if (KEPMAPPA) { fs.mkdirSync(KEPMAPPA, { recursive: true }); await p.screenshot({ path: path.join(KEPMAPPA, `${fajl}-${mobil ? 'mobil' : 'asztali'}.png`), fullPage: true }); }
  await ctx.close();
  return { ...eredmeny, hibak };
}

describe('bongeszoben: a szovegek lathatok, nincs kilogas, nincs JS-hiba (asztali 1366 px + telefon 390 px)', () => {
  for (const [fajl, t] of Object.entries({ ...UJ, ...MEGLEVO })) {
    for (const mobil of [false, true]) {
      test(`${fajl} – ${mobil ? 'telefon' : 'asztali'}`, async () => {
        const e = await vizsgal(fajl, t, mobil);
        assert.deepEqual(e.hianyzo, [], 'minden terv-szoveg lathato');
        if (t.title) assert.equal(norm(e.cim), t.title, 'document.title');
        assert.ok(e.kilog <= 1, `vizszintes kilogas: ${e.kilog} px`);
        assert.deepEqual(e.hibak, [], 'nincs JS-hiba');
      });
    }
  }
});
