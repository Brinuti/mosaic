// A Salonic-linkek atkotese a kozos foglalora (tools/foglalo-atkotes.mjs): szabalyok, kapcsolok, kihagyasok, a build bekotese.
//   node tools/test-foglalo-atkotes.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { atkot, atkotSzoveg, beolvasKonfig, celra, kapcsolokBuildhez, kihagyottOldal, SZABALYOK, UZLETAGAK } from './foglalo-atkotes.mjs';

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
  for (const f of ['success-foglalas.html', 'success-ajandekkartya-stripe.html', 'fodrasz-ok.html', 'elysion-ok.html', 'oxigenterapia-ok.html', 'pmu-ok', 'foglalas-ok.html']) assert.ok(kihagyottOldal(f), f);
  for (const f of ['idpontfoglalas.html', 'headspa-budapest.html', 'lezeres-szortelenites-budapest.html', 'okos-oldal.html']) assert.ok(!kihagyottOldal(f), f);
});

test('kapcsolokBuildhez: eles = a konfig; elonezet = minden be; a FOGLALO_ATKOTES felulir', () => {
  const konfig = { kapcsolok: { headspa: true, oxigen: false, fodraszat: false, lezer: true }, elonezetBe: true };
  assert.deepEqual([...kapcsolokBuildhez({ eles: true, env: {}, konfig })].sort(), ['headspa', 'lezer']);
  assert.deepEqual([...kapcsolokBuildhez({ eles: false, env: {}, konfig })].sort(), [...UZLETAGAK].sort());
  assert.equal(kapcsolokBuildhez({ eles: false, env: {}, konfig: { ...konfig, elonezetBe: false } }).size, 2);
  assert.equal(kapcsolokBuildhez({ eles: true, env: { FOGLALO_ATKOTES: 'none' }, konfig }).size, 0);
  assert.equal(kapcsolokBuildhez({ eles: true, env: { FOGLALO_ATKOTES: 'all' }, konfig }).size, 4);
  assert.deepEqual([...kapcsolokBuildhez({ eles: true, env: { FOGLALO_ATKOTES: 'oxigen, fodraszat, ismeretlen' }, konfig })].sort(), ['fodraszat', 'oxigen']);
});

test('konfig: az eles kapcsolok MIND ki vannak kapcsolva (az atkapcsolas kulon dontes), az elonezet be', () => {
  const k = beolvasKonfig();
  assert.deepEqual(Object.keys(k.kapcsolok).sort(), [...UZLETAGAK].sort());
  assert.ok(Object.values(k.kapcsolok).every((v) => v === false), 'a kapcsolok eles allapota: kikapcsolva');
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
