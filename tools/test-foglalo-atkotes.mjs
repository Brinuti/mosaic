// A Salonic-linkek atkotese a kozos foglalora (tools/foglalo-atkotes.mjs): szabalyok, kapcsolok, kihagyasok, a build bekotese.
//   node tools/test-foglalo-atkotes.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { atkot, atkotBelso, atkotSzoveg, belsoCel, beolvasKonfig, celra, kapcsolokBuildhez, kihagyottOldal, KAPCSOLOK, oldalUzletag, SZABALYOK, UZLETAGAK, uresOldal, URES_OLDALAK } from './foglalo-atkotes.mjs';
import { utvonal } from '../netlify/lib/utvonal.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const MIND = new Set(UZLETAGAK);
const cel = (url) => celra(url)?.cel ?? null;

test('szabalyok: a mostani Salonic-linkek mindegyike a megfelelo foglalo-URL-re kepezodik', () => {
  // HeadSpa
  assert.equal(cel('https://mosaicheadspa.salonic.hu/selectSpecialization/?placeId=10427'), '/foglalo-motor?business=headspa');
  assert.equal(cel('https://mosaicheadspa.salonic.hu/employees/23532/?placeId=10427'), '/foglalo-motor?business=headspa');
  assert.equal(cel('https://mosaicheadspa.salonic.hu/showServices/?placeId=10427&specId=39592'), '/foglalo-motor?business=headspa');
  assert.equal(cel('https://mosaicheadspa.salonic.hu/showServices/?placeId=10427&specId=41471'), '/foglalo-motor?business=headspa&voucher=1');
  assert.equal(cel('https://mosaicheadspa.salonic.hu/selectDate/?employeeId=24354&placeId=10427&serviceId=239336&startDate=1741089600&back=%2FselectEmployee%2F'), '/foglalo-motor?business=headspa&service=paros');
  // Oxigen
  assert.equal(cel('https://mosaic-oxigen.salonic.hu/selectEmployee/?placeId=14409&serviceId=466110'), '/foglalo-motor?business=oxygen&service=466110');
  assert.equal(cel('https://mosaic-oxigen.salonic.hu/selectEmployee/?placeId=14409&serviceId=466158'), '/foglalo-motor?business=oxygen&service=466158');
  assert.equal(cel('https://mosaic-oxigen.salonic.hu/selectEmployee/?placeId=14409&serviceId=466147'), '/foglalo-motor?business=oxygen&service=466147');
  // Fodraszat
  assert.equal(cel('https://mosaic-hair.salonic.hu/selectSpecialization/?placeId=10823'), '/foglalo-motor?business=hair');
  assert.equal(cel('https://mosaic-hair.salonic.hu/showServices/?employeeId=23694&placeId=10823&serviceId=0'), '/foglalo-motor?business=hair');
  // Lezer: a Hair-fiok konzultacioja (444584) es az Elysion-fiok konzultacioja (476477) egyarant a lezeres konzultaciora; 66404 / 66405 a belepesre
  assert.equal(cel('https://mosaic-hair.salonic.hu/selectDate/?employeeId=30114&placeId=10823&serviceId=444584&startDate=1776684600&back=%2FselectEmployee%2F%3FplaceId%3D10823'), '/foglalo-motor?business=laser&service=konzult');
  assert.equal(cel('https://mosaic-hair.salonic.hu/selectEmployee/?placeId=10823&serviceId=444584'), '/foglalo-motor?business=laser&service=konzult');
  assert.equal(cel('https://mosaic-elysion.salonic.hu/selectDate/?employeeId=32417&placeId=14586&serviceId=476477&startDate=1788775200'), '/foglalo-motor?business=laser&service=konzult');
  assert.equal(cel('https://mosaic-elysion.salonic.hu/showServices/?placeId=14586&specId=66404'), '/foglalo-motor?business=laser&intent=first');
  assert.equal(cel('https://mosaic-elysion.salonic.hu/showServices/?placeId=14586&specId=66405'), '/foglalo-motor?business=laser&intent=returning');
  // &amp; formaban is
  assert.equal(cel('https://mosaicheadspa.salonic.hu/showServices/?placeId=10427&amp;specId=41471'), '/foglalo-motor?business=headspa&voucher=1');
});

test('szabalyok: ami NEM megy at: PMU, ajandekkartya-vasarlas, fooldalak, naptar-API, ismeretlen szolgaltatas', () => {
  for (const u of [
    'https://mosaic-pmu.salonic.hu/employees/32428/?placeId=14585',
    'https://mosaic-pmu.salonic.hu/selectDate/?startDate=1790408258&placeId=14585&employeeId=32428&serviceId=471160',
    'https://mosaic-pmu.salonic.hu',
    'https://mosaicheadspa.salonic.hu/giftcards',
    'https://mosaicheadspa.salonic.hu/giftcards/buy/1-oras-mosaic-headspa-kezeles-2544',
    'https://mosaicheadspa.salonic.hu',
    'https://api.salonic.hu/calendar/getAvailableTimes',
    'https://mosaic-oxigen.salonic.hu/selectEmployee/?placeId=14409&serviceId=999999', // ismeretlen oxigen-szolgaltatas
    'https://mosaic-hair.salonic.hu/selectDate/?employeeId=1&placeId=10823&serviceId=12345', // nem a lezeres konzultacio
    'https://mosaicheadspa.salonic.hu/showServices/?placeId=10427&specId=1', // ismeretlen kategoria
    'https://nem-salonic.hu/selectSpecialization/', 'nem url',
  ]) assert.equal(celra(u), null, u);
});

test('szabalyok: minden szabaly egyertelmu (nincs ket szabaly ugyanarra, a kapcsolo ervenyes uzletag)', () => {
  for (const r of SZABALYOK) assert.ok(UZLETAGAK.includes(r.kapcsolo), r.kapcsolo);
  const kulcs = SZABALYOK.map((r) => [r.host, r.utvonal, JSON.stringify(r.parameter || {})].join('|'));
  assert.equal(new Set(kulcs).size, kulcs.length);
  // a HeadSpa-ag ket szabalya (39592, 41471) kulonbozo celra mutat
  assert.notEqual(cel('https://mosaicheadspa.salonic.hu/showServices/?specId=39592'), cel('https://mosaicheadspa.salonic.hu/showServices/?specId=41471'));
});

const MINTA = '<a data-testid="linkElement" href="https://mosaicheadspa.salonic.hu/showServices/?placeId=10427&amp;specId=39592" target="_blank" rel="noopener"><span>NORMÁL</span></a>'
  + '<a href="https://mosaic-oxigen.salonic.hu/selectEmployee/?placeId=14409&serviceId=466110" target="_blank">OX</a>'
  + '<a href="https://mosaic-hair.salonic.hu/showServices/?employeeId=23694&placeId=10823&serviceId=0">HAIR</a>'
  + '<a href="https://mosaic-elysion.salonic.hu/showServices/?placeId=14586&specId=66404">LASER</a>'
  + '<a href="https://mosaic-pmu.salonic.hu/employees/32428/?placeId=14585">PMU</a>'
  + '<a href="https://mosaicheadspa.salonic.hu/giftcards">AJANDEK</a>'
  + '<a href="/foglalas">sajat</a>';

test('atkot: kikapcsolva a szoveg bajtra azonos', () => {
  for (const ki of [new Set(), {}, { headspa: false, oxigen: false, fodraszat: false, lezer: false }, undefined]) {
    const r = atkot(MINTA, ki);
    assert.equal(r.html, MINTA);
    assert.deepEqual(Object.values(r.db), [0, 0, 0, 0]);
  }
});

test('atkot: uzletagankent kapcsolhato; a tobbi attributum (target, rel) es a PMU / ajandekkartya valtozatlan', () => {
  const h = atkot(MINTA, { headspa: true }).html;
  assert.match(h, /<a data-testid="linkElement" href="\/foglalo-motor\?business=headspa" target="_blank" rel="noopener"><span>NORMÁL<\/span><\/a>/);
  assert.match(h, /href="https:\/\/mosaic-oxigen\.salonic\.hu\/selectEmployee\/\?placeId=14409&serviceId=466110"/, 'az oxigen kapcsolo ki van');
  assert.match(h, /href="https:\/\/mosaic-hair\.salonic\.hu/);
  const mind = atkot(MINTA, MIND);
  assert.deepEqual(mind.db, { headspa: 1, oxigen: 1, fodraszat: 1, lezer: 1 });
  assert.match(mind.html, /href="\/foglalo-motor\?business=oxygen&amp;service=466110" target="_blank"/, 'a HTML-ben az & &amp;');
  assert.match(mind.html, /href="\/foglalo-motor\?business=laser&amp;intent=first"/);
  assert.match(mind.html, /href="https:\/\/mosaic-pmu\.salonic\.hu\/employees\/32428\/\?placeId=14585"/, 'PMU marad');
  assert.match(mind.html, /href="https:\/\/mosaicheadspa\.salonic\.hu\/giftcards"/, 'ajandekkartya-vasarlas marad');
  assert.match(mind.html, /<a href="\/foglalas">sajat<\/a>/);
  // csak a lezer
  const lez = atkot(MINTA, new Set(['lezer'])).html;
  assert.match(lez, /href="\/foglalo-motor\?business=laser&amp;intent=first"/);
  assert.match(lez, /href="https:\/\/mosaicheadspa\.salonic\.hu\/showServices/);
});

test('atkotSzoveg: szkript-karakterlanc (gyik.js): a backslash-es idezojelek megmaradnak, a link cserelodik', () => {
  const js = 'x=[["Q","<p><a href=\\"https://mosaicheadspa.salonic.hu/showServices/?placeId=10427&specId=39592\\" target=\\"_blank\\">Ide</a></p>"]]';
  assert.equal(atkotSzoveg(js, new Set()).szoveg, js);
  const r = atkotSzoveg(js, new Set(['headspa']));
  assert.equal(r.szoveg, 'x=[["Q","<p><a href=\\"/foglalo-motor?business=headspa\\" target=\\"_blank\\">Ide</a></p>"]]');
  assert.equal(r.db.headspa, 1);
});

test('kihagyottOldal: a koszonooldalakhoz nem nyulunk', () => {
  for (const f of ['success-foglalas.html', 'success-ajandekkartya-stripe.html', 'fodrasz-ok.html', 'elysion-ok.html', 'oxigenterapia-ok.html', 'pmu-ok', 'foglalas-ok.html', 'oxigenterapia-masodik.html', 'pmu-vh']) assert.ok(kihagyottOldal(f), f);
  for (const f of ['idpontfoglalas.html', 'headspa-budapest.html', 'lezeres-szortelenites-budapest.html', 'okos-oldal.html']) assert.ok(!kihagyottOldal(f), f);
});

test('kapcsolokBuildhez: eles = a konfig; elonezet = minden be; a FOGLALO_ATKOTES felulir', () => {
  const konfig = { kapcsolok: { headspa: true, oxigen: false, fodraszat: false, lezer: true }, elonezetBe: true };
  assert.deepEqual([...kapcsolokBuildhez({ eles: true, env: {}, konfig })].sort(), ['headspa', 'lezer']);
  assert.deepEqual([...kapcsolokBuildhez({ eles: false, env: {}, konfig })].sort(), [...KAPCSOLOK].sort());
  assert.equal(kapcsolokBuildhez({ eles: false, env: {}, konfig: { ...konfig, elonezetBe: false } }).size, 2);
  assert.equal(kapcsolokBuildhez({ eles: true, env: { FOGLALO_ATKOTES: 'none' }, konfig }).size, 0);
  assert.equal(kapcsolokBuildhez({ eles: true, env: { FOGLALO_ATKOTES: 'all' }, konfig }).size, 7);
  assert.deepEqual([...kapcsolokBuildhez({ eles: true, env: { FOGLALO_ATKOTES: 'oxigen, fodraszat, ismeretlen' }, konfig })].sort(), ['fodraszat', 'oxigen']);
  assert.deepEqual([...kapcsolokBuildhez({ eles: true, env: { FOGLALO_ATKOTES: 'pmu, fejlec' }, konfig })].sort(), ['fejlec', 'pmu']);
});

test('konfig: minden kapcsolo szerepel; az eles allapot: MIND BE (a tulajdonos jovahagyta, 2026-10-04: "csinald az elesitest"); az elonezet be', () => {
  const k = beolvasKonfig();
  assert.deepEqual(Object.keys(k.kapcsolok).sort(), [...KAPCSOLOK].sort());
  assert.ok(Object.values(k.kapcsolok).every((v) => v === true), 'a kapcsolok eles allapota: bekapcsolva (visszaallitas: false, uj deploy)');
  assert.equal(k.elonezetBe, true);
});

test('az oldalak: minden foglalasi link atkothető, ami marad, az PMU / ajandekkartya / koszonooldal', () => {
  const marad = [];
  let atkotheto = 0;
  for (const mappa of ['klon', 'klon/m']) {
    for (const f of fs.readdirSync(path.join(ROOT, mappa)).filter((x) => x.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(ROOT, mappa, f), 'utf8');
      const ki = atkot(html, MIND);
      atkotheto += Object.values(ki.db).reduce((a, b) => a + b, 0);
      // kikapcsolt kapcsolonal a fajl valtozatlan
      assert.equal(atkot(html, new Set()).html, html, f);
      if (kihagyottOldal(f)) continue;
      for (const m of ki.html.matchAll(/href="(https?:\/\/[a-z0-9.-]*salonic\.hu[^"]*)"/gi)) {
        if (!/mosaic-pmu\.salonic\.hu|\/giftcards/.test(m[1])) marad.push(`${mappa}/${f}: ${m[1]}`);
      }
      // az atirt oldalon nincs visszamaradt, atkotheto Salonic-link
      for (const m of ki.html.matchAll(/href="(https?:\/\/[a-z0-9.-]*salonic\.hu[^"]*)"/gi)) assert.equal(celra(m[1]), null, `${mappa}/${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(marad, [], 'nem PMU / ajandekkartya Salonic-link maradt');
  assert.ok(atkotheto > 200, `varhatoan 230 koruli atkotheto link (${atkotheto})`);
  // a PMU oldal es a PMU foglalo valtozatlan marad
  for (const f of ['klon/pmu-foglalas.html', 'klon/sminktetovalas-budapest-rovid.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.equal(atkot(html, MIND).html, html, f + ': PMU-oldal nem valtozik');
  }
});

// --- a sajat foglalo-oldalakra mutato linkek (fomenu + oldalgombok) ---------------------------------------------------------------------------
test('oldalUzletag: a fajlnev alapjan', () => {
  const v = { 'headspa-budapest.html': 'headspa', 'home.html': 'headspa', 'index.html': 'headspa', 'paros-headspa-budapest': 'headspa', '4-kezes-headspa-ajandekkartya': 'headspa', 'ajandekkartya-szulinapra': 'headspa',
    'noi-fodraszat-budapest': 'fodraszat', 'balayage-haj-festes-budapest': 'fodraszat', '30szazalek': 'fodraszat', 'noi-hajfestes-budapest': 'fodraszat',
    'oxigenterapia-budapest': 'oxigen', 'oxigenterapia-ferfiaknak': 'oxigen',
    'lezeres-szortelenites-budapest': 'lezer', 'szortelenites-zsofi-rovid': 'lezer', 'szőrtelenítés-zsófi-3': 'lezer', 'vegleges-szortelenites-ferfiaknak': 'lezer',
    'sminktetovalas-budapest': 'pmu', 'sminktetovalas-regi': 'pmu', 'blog': null, 'aszf': null };
  for (const [f, e] of Object.entries(v)) assert.equal(oldalUzletag(f), e, f);
});

test('belsoCel: fomenu FOGLALAS = altalanos; a gombok az oldal uzletagara; onhivatkozas nem; ismeretlen link nem', () => {
  const c = (href, fajl, szoveg) => belsoCel(href, fajl, szoveg)?.cel ?? null;
  const k = (href, fajl, szoveg) => belsoCel(href, fajl, szoveg)?.kapcsolo ?? null;
  // fomenu (asztali "FOGLALAS", mobil "Foglalas"): barhol, minden oldalon
  for (const fajl of ['headspa-budapest', 'oxigenterapia-budapest', 'lezeres-szortelenites-budapest', 'noi-fodraszat-budapest', 'blog', 'idpontfoglalas']) {
    assert.equal(c('/idpontfoglalas', fajl, 'FOGLALÁS'), '/foglalo-motor', fajl);
    assert.equal(k('/idpontfoglalas', fajl, 'Foglalás'), 'fejlec', fajl);
  }
  // HeadSpa-gombok
  assert.equal(c('/idpontfoglalas', 'headspa-budapest', 'IDŐPONTFOGLALÁS'), '/foglalo-motor?business=headspa');
  assert.equal(c('/idpontfoglalas', 'headspa-budapest', 'FOGLALOK!'), '/foglalo-motor?business=headspa');
  assert.equal(c('/idpontfoglalas', 'home', 'PÁROS HEAD SPA IDŐPONTOK'), '/foglalo-motor?business=headspa&service=paros');
  assert.equal(c('/idpontfoglalas', '4-kezes-headspa-ajandekkartya', 'Inkább időpontot foglalok >>'), '/foglalo-motor?business=headspa');
  assert.equal(k('/idpontfoglalas', 'headspa-budapest', 'SZABAD IDŐPONTOK'), 'headspa');
  // fodraszat / oxigen
  assert.equal(c('/mosaic-hair-idopontfoglalas', 'noi-fodraszat-budapest', 'SZABAD IDŐPONTOK'), '/foglalo-motor?business=hair');
  assert.equal(c('/mosaic-hair-idopontfoglalas', 'noi-fodraszat-budapest', 'INGYENES KONTULTÁCIÓ'), '/foglalo-motor?business=hair&service=konzult');
  assert.equal(c('/mosaic-hair-idopontfoglalas', 'balayage-haj-festes-budapest', 'ÁRLISTA + SZABAD IDŐPONTOK'), '/foglalo-motor?business=hair&service_category=balayage');
  assert.equal(c('/mosaic-hair-idopontfoglalas', 'noi-hajfestes-budapest', 'FOGLALOK!'), '/foglalo-motor?business=hair&service_category=color');
  assert.equal(c('/mosaic-hair-idopontfoglalas', 'oxigenterapia-budapest', 'BEJELENTKEZEK!'), '/foglalo-motor?business=oxygen');
  assert.equal(k('/mosaic-hair-idopontfoglalas', 'oxigenterapia-ferfiaknak', 'FOGLALOK!'), 'oxigen');
  assert.equal(k('/mosaic-hair-idopontfoglalas', '30szazalek', 'FOGLALOK!'), 'fodraszat');
  // lezer / pmu
  assert.equal(c('/szortelenites-foglalas', 'lezeres-szortelenites-budapest', 'IDŐPONTFOGLALÁS!'), '/foglalo-motor?business=laser');
  assert.equal(c('/szortelenites-foglalas', 'vegleges-szortelenites-ferfiaknak', 'IDŐPONTOK >>'), '/foglalo-motor?business=laser');
  assert.equal(c('/pmu-foglalas', 'sminktetovalas-regi', 'IDŐPONTOT SZERETNÉK!'), '/foglalo-motor?business=pmu');
  assert.equal(k('/pmu-foglalas', 'idpontfoglalas', 'SMINKTETOVÁLÁS'), 'pmu');
  // teljes URL is jo
  assert.equal(c('https://www.mosaicheadspa.hu/idpontfoglalas', 'headspa-budapest', 'FOGLALOK!'), '/foglalo-motor?business=headspa');
  // onhivatkozas (a foglalo-oldal fulei) nem a foglalo gombja; a menu mindig igen
  assert.equal(c('/idpontfoglalas', 'idpontfoglalas', 'HEADSPA'), null);
  assert.equal(c('/szortelenites-foglalas', 'szortelenites-foglalas', 'IDŐPONTFOGLALÁS'), null);
  assert.equal(c('/pmu-foglalas', 'pmu-foglalas', 'VISSZAHÍVÁST KÉREK'), null);
  // nem foglalo-link
  for (const h of ['/aszf', '/foglalas', '/fodraszat-foglalas', '/smink-foglalas', 'tel:+36202474444', 'https://example.com/idpontfoglalas', '/success-foglalas']) assert.equal(c(h, 'headspa-budapest', 'FOGLALOK!'), null, h);
});

const OLDAL = '<a data-testid="linkElement" href="/idpontfoglalas" target="_self" class="m"><div><span class="l">FOGLALÁS</span></div></a>'
  + '<a href="/idpontfoglalas" class="g"><span><span>IDŐPONTFOGLALÁS</span></span></a>'
  + '<a href="/idpontfoglalas?x=1#y" class="g"><span>P&Aacute;ROS HEAD SPA ID&Odblac;PONTOK</span></a>'
  + '<a href="/mosaic-hair-idopontfoglalas"><span>FOGLALOK!</span></a>'
  + '<a href="/pmu-foglalas"><span>IDŐPONTOT SZERETNÉK</span></a>'
  + '<a href="tel:+36202474444"><span>HÍVJ</span></a>'
  + '<a href="/aszf"><span>ÁSZF</span></a>';

test('atkotBelso: kikapcsolva / launcher nelkul a szoveg bajtra azonos; bekapcsolva csak a href valtozik', () => {
  for (const ki of [new Set(), {}, { headspa: false, fejlec: false }, undefined]) assert.equal(atkotBelso(OLDAL, 'headspa-budapest.html', ki).html, OLDAL);
  assert.equal(atkotBelso(OLDAL, 'headspa-budapest.html', new Set(KAPCSOLOK), { launcher: false }).html, OLDAL, 'launcher nelkul nem nyul hozza');
  const r = atkotBelso(OLDAL, 'headspa-budapest.html', new Set(KAPCSOLOK));
  assert.match(r.html, /<a data-testid="linkElement" href="\/foglalo-motor" target="_self" class="m"><div><span class="l">FOGLALÁS<\/span><\/div><\/a>/, 'a fomenu: az altalanos kezdoallapot, a tobbi attributum es a belso valtozatlan');
  assert.match(r.html, /<a href="\/foglalo-motor\?business=headspa" class="g"><span><span>IDŐPONTFOGLALÁS<\/span><\/span><\/a>/);
  assert.match(r.html, /href="\/foglalo-motor\?business=headspa&amp;service=paros" class="g"/, 'a HTML-ben az & &amp;; a felirat entitasos betukkel is felismerheto');
  assert.match(r.html, /<a href="\/foglalo-motor\?business=hair"><span>FOGLALOK!<\/span><\/a>/);
  assert.match(r.html, /<a href="\/foglalo-motor\?business=pmu"><span>IDŐPONTOT SZERETNÉK<\/span><\/a>/);
  assert.match(r.html, /<a href="tel:\+36202474444">/); assert.match(r.html, /<a href="\/aszf">/);
  assert.deepEqual(r.db, { headspa: 2, oxigen: 0, fodraszat: 1, lezer: 0, pmu: 1, fejlec: 1, regi: 0 });
  // a levonas (a kapcsolo kikapcsolasa) is mukodik: csak a menu
  const csakMenu = atkotBelso(OLDAL, 'headspa-budapest.html', new Set(['fejlec'])).html;
  assert.match(csakMenu, /href="\/foglalo-motor"/); assert.match(csakMenu, /<a href="\/idpontfoglalas" class="g">/);
  const nincsMenu = atkotBelso(OLDAL, 'headspa-budapest.html', new Set(['headspa', 'fodraszat', 'pmu'])).html;
  assert.match(nincsMenu, /href="\/idpontfoglalas" target="_self" class="m"/, 'a fejlec-kapcsolo nelkul a menu marad');
});

test('az oldalak (asztali + mobil): a fomenu minden (nem kihagyott) oldalon a foglalora kotodik, a regi foglalo-oldalakra mutato gomb nem marad (kihagyva: koszonooldalak)', () => {
  let menu = 0; let gomb = 0;
  for (const mappa of ['klon', 'klon/m']) {
    for (const f of fs.readdirSync(path.join(ROOT, mappa)).filter((x) => x.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(ROOT, mappa, f), 'utf8');
      assert.equal(atkotBelso(html, f, new Set()).html, html, f + ': kikapcsolva valtozatlan');
      const ki = atkotBelso(html, f, new Set(KAPCSOLOK));
      menu += ki.db.fejlec; gomb += KAPCSOLOK.filter((k) => k !== 'fejlec').reduce((a, k) => a + ki.db[k], 0);
      if (kihagyottOldal(f)) continue;
      // a fomenu-gomb atkotodott (kiveve ahol nincs ilyen)
      for (const m of ki.html.matchAll(/<a\b[^>]*href="(\/idpontfoglalas|\/mosaic-hair-idopontfoglalas|\/szortelenites-foglalas|\/pmu-foglalas)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const sz = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        assert.ok(!/^foglalás$/i.test(sz), mappa + '/' + f + ': a fomenu-gomb nem kotodott at');
        const onhivatkozas = m[1] === '/' + f.replace(/\.html$/, '');
        assert.ok(onhivatkozas, mappa + '/' + f + ': visszamaradt regi foglalo-oldalra mutato gomb: ' + m[1] + ' [' + sz.slice(0, 40) + ']');
      }
    }
  }
  assert.ok(menu >= 150, 'a fomenu gombja ~90 asztali + ~90 mobil oldalon (' + menu + ')');
  assert.ok(gomb > 200, 'az oldalgombok (' + gomb + ')');
});

// --- a regi foglalo-oldalak: ures oldal + bezarhatatlan felugro; a megszunt kuponos oldalak 301 a fooldalra -----------------------------------------
const OLDAL_HTML = '<html><head><title>Időpontfoglalás</title></head><body><div id="SITE_CONTAINER"><a href="/x">tartalom</a></div><script type="module" src="/assets/js/booking-launcher.js?v=abc"></script></body></html>';

test('uresOldal: kikapcsolva / nem regi oldal / launcher nelkul valtozatlan; bekapcsolva elrejti a tartalmat, megnyitja a foglalot bezarhatatlanul', () => {
  for (const ki of [new Set(), {}, new Set(['fejlec', 'headspa'])]) assert.equal(uresOldal(OLDAL_HTML, 'idpontfoglalas.html', ki).html, OLDAL_HTML);
  assert.equal(uresOldal(OLDAL_HTML, 'headspa-budapest.html', new Set(KAPCSOLOK)).html, OLDAL_HTML, 'nem regi foglalo-oldal');
  assert.equal(uresOldal(OLDAL_HTML.replace('booking-launcher.js', 'masik.js'), 'idpontfoglalas.html', new Set(KAPCSOLOK)).html, OLDAL_HTML.replace('booking-launcher.js', 'masik.js'), 'launcher nelkul nem nyulunk hozza');
  const r = uresOldal(OLDAL_HTML, 'mosaic-hair-idopontfoglalas.html', new Set(['regi']));
  assert.equal(r.db.regi, 1);
  assert.match(r.html, /<style id="mh-ures">#SITE_CONTAINER\{display:none!important\}/, 'a tartalom el van rejtve');
  assert.match(r.html, /#mh-cc,#mh-cc-reopen\{z-index:2147483001!important\}/, 'a suti-sav a foglalo folott marad');
  assert.match(r.html, /<script type="module">window\.openBooking\(\{"business":"oxygen"\},\{zarhatatlan:true\}\);<\/script><\/body>/);
  assert.ok(r.html.indexOf('booking-launcher.js') < r.html.indexOf('window.openBooking'), 'a launcher elobb fut, mint a nyito');
  assert.match(r.html, /<noscript>[\s\S]*href="\/foglalas"[\s\S]*tel:\+36202474444[\s\S]*<\/noscript>/, 'JS nelkul: /foglalas + telefon');
  assert.ok(r.html.includes('<div id="SITE_CONTAINER"><a href="/x">tartalom</a></div>'), 'a tartalom a forrasban megmarad (csak rejtett), a mero kod is');
  assert.match(uresOldal(OLDAL_HTML, 'idpontfoglalas.html', new Set(['regi'])).html, /openBooking\(\{\},\{zarhatatlan:true\}\)/, 'az altalanos kezdoallapot');
});

test('URES_OLDALAK: a hat regi foglalo-oldal es a kontextusuk; a megszunt kuponos oldalak nincsenek benne', () => {
  assert.deepEqual(URES_OLDALAK, { idpontfoglalas: {}, 'mosaic-hair-idopontfoglalas': { business: 'oxygen' }, 'szortelenites-foglalas': { business: 'laser' }, 'pmu-foglalas': { business: 'pmu' }, 'smink-foglalas': { business: 'pmu' }, naptar: {} });
  for (const n of Object.keys(URES_OLDALAK)) assert.ok(fs.existsSync(path.join(ROOT, 'klon', n + '.html')) && fs.existsSync(path.join(ROOT, 'klon/m', n + '.html')), n + ': van asztali es mobil oldal');
});

test('utvonal: a megszunt kuponos oldalak (/fodraszat-foglalas, /kupon-utan-foglalas) 301 a fooldalra; a regi foglalo-oldalak, a tobbi oldal valtozatlan', () => {
  for (const ut of ['/fodraszat-foglalas', '/kupon-utan-foglalas', '/kupon-utan-foglalas/', '/fodraszat-foglalas.html']) assert.deepEqual(utvonal(ut, 'Mozilla/5.0'), { atiranyit: '/' }, ut);
  for (const ut of ['/idpontfoglalas', '/mosaic-hair-idopontfoglalas', '/szortelenites-foglalas', '/pmu-foglalas', '/smink-foglalas', '/naptar', '/headspa-budapest']) assert.ok(utvonal(ut, 'Mozilla/5.0').atir, ut + ': tovabbra is kiszolgalt oldal');
});
