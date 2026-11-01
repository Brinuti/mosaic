// A foglalo (assets/js/foglalo-pmu.js) fotos eloszuro folyamata (Feri, 2026-11-01): minden szolgaltatasnal elobb a "Volt mar sminktetovalasod?" kerdes; akinek van, elobb fotot tolt fel,
// csak utana kap idopontot (minden szolgaltatasra csak 2026-11-09-tol), az elerhetoseget + fotot a pmu-proba-foto level viszi, majd a Salonic adatlap; a fotos foglalas NEM konverzio.
//   PLAYWRIGHT_UTVONAL=/opt/node-tools/node_modules CHROME_UTVONAL=/opt/pw-browsers/chromium node --test tools/eltavolitas-teszt/foto-foglalas.test.mjs
// Mockolt Salonic (szolgaltatas-lista, szabad idopontok, adatlap), rogzitett ora (2026-11-01), a / -ra erkezo POST-ot a teszt fogja el; semmi nem megy ki.
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium';
const MOTOR = fs.readFileSync(path.join(GYOKER, 'assets/js/foglalo-pmu.js'), 'utf8');

describe('statikus: a fotos foglalas nem konverzio (bongeszos ut)', () => {
  test('a /pmu-foto-ok a foglalo oldala (szimbolikus link), noindex, es NINCS a konverzios / kulcs-iro / pixel listakban', () => {
    const l = path.join(GYOKER, 'foglalas', 'pmu-foto-ok.html');
    assert.ok(fs.lstatSync(l).isSymbolicLink());
    assert.equal(fs.readlinkSync(l), 'foglalo-pmu.html');
    assert.match(fs.readFileSync(l, 'utf8'), /<meta name="robots" content="noindex, nofollow">/);
    const suti = fs.readFileSync(path.join(GYOKER, 'assets/js/suti.js'), 'utf8');
    assert.ok(!/pmu-foto-ok/.test(suti), 'a suti.js PIXEL_OLDALAK-ban nem szerepelhet (nincs pixel)');
    assert.ok(!/pmu-foto-ok/.test(fs.readFileSync(path.join(GYOKER, 'assets/js/attribucio.js'), 'utf8')), 'az attribucio.js koszono-listajaban nem szerepelhet');
    const build = fs.readFileSync(path.join(GYOKER, 'tools/netlify-build.mjs'), 'utf8');
    const koszono = build.match(/const FOGLALAS_KOSZONO = new Set\(\[([\s\S]*?)\]\.map/)[1];
    assert.ok(!/pmu-foto-ok/.test(koszono), 'a kulcs-iro (FOGLALAS_KOSZONO) listaban nem szerepelhet');
    assert.ok(/'pmu-ok'/.test(koszono), 'a /pmu-ok marad a kulcs-iro listaban');
  });
  test('a motor: a fotos legkorabbi idopont 2026-11-09 00:00 Europe/Budapest; a 491949 szabaly marad; nincs success a fotos uton', () => {
    assert.match(MOTOR, /const FOTOS_LEGKORABBI = Date\.UTC\(2026, 10, 8, 23, 0, 0\) \/ 1000;/);
    assert.match(MOTOR, /const LEGKORABBI = \{ '491949': Date\.UTC\(2026, 10, 8, 23, 0, 0\) \/ 1000 \};/);
    assert.match(MOTOR, /if \(fotos && \(lepes === 'success' \|\| lepes === 'submit'\)\) return;/);
    assert.match(MOTOR, /if \(ut !== '' && ut !== '\/foglalo-pmu'\) \{ fotosKoszono\(\); return; \}/);
    assert.match(MOTOR, /const keretbenOldalEredeti = window\.mhKeretbenOldal;/, 'az R3 atiranyitas valtozatlan, a fotos agat egy burkolo kezeli');
    assert.match(MOTOR, /new URL\('\/pmu-foto-ok', location\.origin\)/);
  });
});

describe('bongeszos: a motor viselkedese (mockolt Salonic)', () => {
  let chromium, szerver, bazis, bongeszo;
  before(async () => {
    const require = createRequire((process.env.PLAYWRIGHT_UTVONAL || '/opt/node-tools/node_modules') + '/');
    ({ chromium } = require('playwright'));
    const { szerverInditas } = await import(pathToFileURL(path.join(GYOKER, 'tools/headspa-teszt/szerver.mjs')).href);
    ({ szerver, bazis } = await szerverInditas());
    bongeszo = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  });
  after(async () => { await bongeszo?.close(); szerver?.close(); });

  const SZOLG_HTML = '<div>' + [
    ['471160', 'Ingyenes konzultáció', '', 30], ['471153', 'Szemöldök tetoválás - Hibrid - 99.000 Ft helyett most', '79000', 90], ['491949', 'Tetoválás eltávolítás', '20000', 30],
  ].map(([id, nev, ar, perc]) => `<input data-id="${id}" data-name="${nev}" data-price="${ar}" data-duration="${perc}">`).join('') + '</div>';
  const idopont = (iso) => Date.parse(iso) / 1000;
  const SLOTOK = { status: 'success', data: { blocks: { 0: { a: { slots: {
    elott: { timestamp: idopont('2026-11-08T22:59:59Z') }, hatar: { timestamp: idopont('2026-11-08T23:00:00Z') }, kesobb: { timestamp: idopont('2026-11-10T09:00:00Z') },
  } } } } } };
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  const fo = async (url) => {
    const ctx = await bongeszo.newContext({ viewport: { width: 900, height: 1100 } });
    const lap = await ctx.newPage();
    const hibak = [];
    lap.on('pageerror', (e) => hibak.push(e.message));
    await lap.clock.setFixedTime(new Date('2026-11-01T12:00:00Z'));
    // hozzajarulas + a belso szamlalo robot-kiszurese ki: a dataLayer-lepeseket vizsgaljuk
    await lap.addInitScript(() => { window.mhSuti = { engedely: () => true }; window.__MH_SZAMLALO_PROBA = true; });
    const posztok = [];   // a /-ra erkezo urlap-POST-ok (foto-level)
    const jelek = [];     // a belso, nevtelen lepes-szamlalo (/api/foglalo-szamlalo) jelzesei
    const sz = { adatlap: [] };
    await lap.route('**/*', (r) => {
      const k = r.request(); const u = k.url(); const cors = { 'access-control-allow-origin': '*' };
      if (u.startsWith('https://mosaic-pmu.salonic.hu/employees/')) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/html' }, body: SZOLG_HTML });
      if (u.startsWith('https://api.salonic.hu/calendar/getAvailableTimes')) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(SLOTOK) });
      if (u.startsWith('https://mosaic-pmu.salonic.hu/guestData/')) { sz.adatlap.push(u); return r.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<p>salonic adatlap</p>' }); }
      if (!u.startsWith(bazis)) return r.abort();
      if (k.method() === 'POST') {
        if (new URL(u).pathname === '/api/foglalo-szamlalo') { try { jelek.push(JSON.parse(k.postData()).lepes); } catch (x) { jelek.push('?'); } } else posztok.push(k);
        return r.fulfill({ status: 200, body: 'ok' });
      }
      return r.continue();
    });
    await lap.goto(bazis + url, { waitUntil: 'load' });
    const nezet = () => lap.evaluate(() => [...document.querySelectorAll('[data-nezet]')].filter((e) => !e.hidden && getComputedStyle(e).display !== 'none').map((e) => e.dataset.nezet));
    const var_ = async (n) => { await lap.waitForFunction((x) => { const e = document.querySelector('[data-nezet="' + x + '"]'); return e && !e.hidden; }, n, { timeout: 15000 }); await lap.waitForTimeout(150); };
    const lepesek = () => lap.evaluate(() => [...document.querySelectorAll('#lepesjelzo li')].map((l) => l.textContent.replace(/^[✓\d]+/, '').trim()));
    const aktualisLepes = () => lap.evaluate(() => (document.querySelector('#lepesjelzo li[aria-current=step] span') || {}).textContent);
    const napok = () => lap.evaluate(() => [...document.querySelectorAll('.nnap:not([disabled]):not(.ures)')].map((x) => parseInt(x.textContent, 10)));
    const slot = async () => { await lap.getByRole('button', { name: /^\d\d:\d\d$/ }).first().click(); await lap.waitForTimeout(400); };
    const valasz = async (v) => { await lap.locator('input[name=elozmeny][value=' + v + ']').check({ force: true }); await lap.click('#kerdes-tovabb'); await lap.waitForTimeout(300); };
    const esemenyek = () => lap.evaluate(() => (window.dataLayer || []).map((x) => ({ ...x })));
    const vissza = async () => { await lap.click('#vissza'); await lap.waitForTimeout(400); };
    const lead = (k) => k.postDataBuffer().toString('utf8');
    return { ctx, lap, hibak, posztok, jelek, sz, nezet, var_, lepesek, aktualisLepes, napok, slot, valasz, esemenyek, vissza, lead };
  };
  const fotoFel = async (e) => { await e.lap.setInputFiles('#foto-input', { name: 'regi.png', mimeType: 'image/png', buffer: PNG }); await e.lap.waitForFunction(() => !document.getElementById('foto-tovabb').disabled); };
  const adatok = async (e) => {
    await e.lap.fill('[data-nezet="foto-adatok"] [data-mezo=nev] input', 'Teszt Elek');
    await e.lap.fill('[data-nezet="foto-adatok"] [data-mezo=telefon] input', '+36 30 123 4567');
    await e.lap.check('#foto-hozzajarul');
  };

  test('nincs regi sminktetovalas: kerdes az idopont ELOTT, utana a naptar (nincs szuro), majd a Salonic adatlap; nincs level', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=konzultacio');
    await e.var_('kerdes');
    assert.deepEqual(await e.lepesek(), ['Kezelés', 'Kérdés', 'Időpont', 'Adatok']);
    assert.equal(await e.aktualisLepes(), 'Kérdés');
    assert.equal(await e.lap.isDisabled('#kerdes-tovabb'), true, 'valasz nelkul nem lehet tovabb');
    await e.valasz('elso');
    await e.var_('ido');
    assert.deepEqual(await e.napok(), [8, 9, 10], 'a nem fotos vendegnek nincs nov. 9-i szuro');
    assert.ok(!(await e.lap.locator('#ido-kezeles').innerText()).includes('november 9'));
    await e.slot();
    assert.deepEqual(await e.nezet(), ['adatok']);
    const src = await e.lap.getAttribute('#salonic', 'src');
    assert.match(src, /^https:\/\/mosaic-pmu\.salonic\.hu\/guestData\/\?.*serviceId=471160.*back=mb_[a-z0-9]+/);
    assert.ok(JSON.parse(await e.lap.evaluate(() => sessionStorage.getItem('mhBookingCtx'))).id.startsWith('mb_'), 'a nem fotos utnak van mhBookingCtx-e (valtozatlan)');
    assert.equal(e.posztok.length, 0, 'nincs foto-level');
    assert.deepEqual([...new Set(e.jelek)].sort(), ['form_start', 'service', 'slot', 'slots_loaded'], 'a nem fotos ut lepesei a belso szamlaloba mennek, mint eddig');
    assert.equal(await e.lap.evaluate(() => document.getElementById('salonic-nyisd').hidden), false, 'a tartalek-link megvan a nem fotos vendegnek');
    assert.deepEqual(e.hibak, []);
    await e.ctx.close();
  });

  test('van regi sminktetovalas: foto KOTELEZO az idopont elott, az idopontok csak 2026-11-09-tol (22:59:59Z kimarad, 23:00:00Z bent), a level a kezelest es az idopontot is viszi, majd Salonic', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=konzultacio');
    await e.var_('kerdes');
    await e.valasz('van');
    await e.var_('foto');
    assert.deepEqual(await e.lepesek(), ['Kezelés', 'Fotó', 'Időpont', 'Adatok']);
    assert.equal(await e.aktualisLepes(), 'Fotó');
    assert.equal(await e.lap.isDisabled('#foto-tovabb'), true, 'foto nelkul nem lehet tovabb');
    assert.match(await e.lap.locator('#foto-szoveg').innerText(), /november 9/);
    await fotoFel(e);
    assert.match(await e.lap.locator('#foto-tovabb').innerText(), /Tovább az időpontokhoz/i);
    await e.lap.click('#foto-tovabb');
    await e.var_('ido');
    assert.deepEqual(await e.napok(), [9, 10], 'minden szolgaltatasra (a konzultaciora is) csak nov. 9-tol');
    assert.match(await e.lap.locator('#ido-kezeles').innerText(), /legkorábbi időpont: november 9/i);
    assert.equal(await e.aktualisLepes(), 'Időpont');
    await e.slot();
    assert.deepEqual(await e.nezet(), ['foto-adatok']);
    assert.equal(await e.aktualisLepes(), 'Adatok');
    assert.match(await e.lap.locator('#foto-kuld').innerText(), /Fotó elküldése és tovább/i);
    // hozzajarulas nelkul nem megy
    await e.lap.fill('[data-nezet="foto-adatok"] [data-mezo=nev] input', 'Teszt Elek');
    await e.lap.fill('[data-nezet="foto-adatok"] [data-mezo=telefon] input', '+36 30 123 4567');
    await e.lap.click('#foto-kuld');
    await e.lap.waitForTimeout(300);
    assert.equal(e.posztok.length, 0);
    assert.deepEqual(await e.nezet(), ['foto-adatok']);
    await e.lap.check('#foto-hozzajarul');
    await e.lap.click('#foto-kuld');
    await e.var_('adatok');
    assert.equal(e.posztok.length, 1, 'egyetlen level');
    const t = e.lead(e.posztok[0]);
    assert.match(t, /name="form-name"\r\n\r\npmu-proba-foto/);
    assert.match(t, /name="ag"\r\n\r\nB – régi PMU van · FOGLALÁSSAL/);
    assert.match(t, /name="kezeles"\r\n\r\nSzemélyes konzultáció · FOGLALÁSSAL/);
    assert.match(t, /name="idopont"\r\n\r\n[^\r]*2026\. november 9[^\r]*a Salonicban/);
    assert.match(t, /name="foto1"; filename="foto1\.jpg"/);
    assert.deepEqual(await e.nezet(), ['adatok']);
    const fSrc = await e.lap.getAttribute('#salonic', 'src');
    assert.match(fSrc, /guestData\/\?.*serviceId=471160.*startDate=\d+/);
    assert.ok(!/back=/.test(fSrc), 'fotos uton nincs mb_ azonosito a Salonic-cimben (a keretbeli /pmu-ok kulcs-iroja ne irjon kulcsot)');
    assert.equal(await e.lap.evaluate(() => sessionStorage.getItem('mhBookingCtx')), null, 'fotos uton nincs mhBookingCtx (kulcs-iro tartalek)');
    assert.equal(await e.lap.evaluate(() => document.getElementById('salonic-nyisd').hidden), true, 'fotos vendegnek nincs "nyisd meg" tartalek-link (a /pmu-ok konverzio lenne)');
    assert.equal(await e.lap.evaluate(() => document.getElementById('salonic-hivj').hidden), false);
    // meres: a lepesek foto_ut jelolest kapnak, a lead foglalassal=1, SEHOL nincs submit / success
    const ev = await e.esemenyek();
    const lead = ev.find((x) => x.event === 'pmu_foto_lead');
    assert.ok(lead && lead.foglalassal === 1 && lead.idopont_kert === 1 && lead.business === 'pmu', JSON.stringify(lead));
    assert.ok(!('nev' in lead) && !('telefon' in lead) && !('email' in lead), 'nincs szemelyes adat a lead-esemenyben');
    const lepesek = ev.filter((x) => /^booking_(slot|slots_loaded|form_start)$/.test(x.event));
    assert.deepEqual([...new Set(lepesek.map((x) => x.event))].sort(), ['booking_form_start', 'booking_slot', 'booking_slots_loaded']);
    assert.ok(lepesek.every((x) => x.foto_ut === 1), 'a fotos lepesek foto_ut=1 jelolest kapnak');
    assert.ok(!ev.some((x) => /^booking_(submit|success)$/.test(x.event)), 'nincs submit / success');
    assert.deepEqual([...new Set(e.jelek)], ['service'], 'a fotos ut a belso szamlalot csak a kerdes elotti kezeles-valasztasig terheli');
    // vissza: a Salonic adatlaprol az idopontra (a mar elkuldott foto ujra nem kell), onnan a kerdesre
    await e.vissza();
    assert.deepEqual(await e.nezet(), ['ido']);
    await e.vissza();
    assert.deepEqual(await e.nezet(), ['kerdes']);
    assert.deepEqual(e.hibak, []);
    await e.ctx.close();
  });

  test('fotos foglalas utan a Salonic-atiranyitas a /pmu-foto-ok-ra viszi (nem a /pmu-ok-ra): parameter nelkul, nincs click-id; a koszono nem kuld sikert; a nem fotos a /pmu-ok-ra megy', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=471153');
    await e.var_('kerdes');
    await e.valasz('van');
    await fotoFel(e);
    await e.lap.click('#foto-tovabb');
    await e.var_('ido');
    assert.deepEqual(await e.napok(), [9, 10]);
    await e.slot();
    await adatok(e);
    await e.lap.click('#foto-kuld');
    await e.var_('adatok');
    const salonicUt = 'https://mosaic-pmu.salonic.hu/guestData/?placeId=14585&serviceId=471153&startDate=1&back=mb_x';
    await e.lap.evaluate((u) => window.mhKeretbenOldal(location.origin + '/pmu-ok?first_booking=true&price=79000&g=abc123&gclid=ZZZZZZZZZZZZ&bookingUrl=' + encodeURIComponent(u)), salonicUt);
    await e.lap.waitForURL('**/pmu-foto-ok**');
    const u = new URL(e.lap.url());
    assert.equal(u.pathname, '/pmu-foto-ok');
    assert.equal(u.search, '', 'az URL parameter nelkuli (nincs g / first_booking / price / bookingUrl / gclid)');
    await e.var_('koszonjuk');
    assert.equal(await e.lap.locator('#kosz-cim').innerText(), 'Sikeres foglalás!');
    assert.match(await e.lap.locator('#kosz-lepesek').innerText(), /fotódat/);
    await e.lap.waitForTimeout(500);
    const ev = await e.esemenyek();
    assert.ok(!ev.some((x) => /^booking_/.test(x.event) || /^pmu_/.test(x.event)), 'a fotos koszonooldalon nincs foglalas-esemeny: ' + JSON.stringify(ev.map((x) => x.event)));
    assert.deepEqual(e.hibak, []);
    await e.ctx.close();
    // nem fotos: a regi ut (/pmu-ok + mh_proba)
    const n = await fo('/foglalo-pmu?beagyazva=1&kezeles=471153');
    await n.var_('kerdes');
    await n.valasz('elso');
    await n.var_('ido');
    await n.slot();
    await n.lap.evaluate(() => window.mhKeretbenOldal(location.origin + '/pmu-ok?first_booking=true&g=abc123'));
    await n.lap.waitForURL('**/pmu-ok**');
    const v = new URL(n.lap.url());
    assert.equal(v.pathname, '/pmu-ok');
    assert.equal(v.searchParams.get('mh_proba'), 'pmu');
    assert.equal(v.searchParams.get('first_booking'), 'true');
    await n.ctx.close();
  });

  test('masik kezelesnel a kerdes ujra feltevodik; a fotos ut a szolgaltatas-valtas utan is fotot kovetel (ha meg nem ment el)', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=konzultacio');
    await e.var_('kerdes');
    await e.valasz('van');
    await e.var_('foto');
    await fotoFel(e);
    await e.vissza();            // foto -> kerdes
    assert.deepEqual(await e.nezet(), ['kerdes']);
    await e.vissza();            // kerdes -> szolg
    assert.deepEqual(await e.nezet(), ['szolg']);
    await e.lap.getByRole('button', { name: /Szemöldök/ }).first().click();
    await e.var_('kerdes');
    assert.equal(await e.lap.locator('input[name=elozmeny]:checked').count(), 0, 'az uj kezelesnel ures a valasz');
    assert.equal(await e.lap.isDisabled('#kerdes-tovabb'), true);
    assert.match(await e.lap.locator('#kerdes-cim').innerText(), /ezen a területen/);
    await e.ctx.close();
  });

  test('a telefonos visszahivas ag valtozatlan: foto -> elerhetoseg -> kesz, nincs idopont, nincs FOGLALASSAL jeloles', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&lepes=visszahivas');
    await e.var_('c-info');
    await e.lap.click('#c-info-tovabb');
    await e.var_('kerdes');
    assert.deepEqual(await e.lepesek(), ['Telefon', 'Kérdés', 'Időpont', 'Elérhetőség']);
    await e.valasz('van');
    await e.var_('foto');
    assert.deepEqual(await e.lepesek(), ['Fotó', 'Elérhetőség', 'Kész']);
    await fotoFel(e);
    await e.lap.click('#foto-tovabb');
    await e.var_('foto-adatok');
    assert.match(await e.lap.locator('#foto-kuld').innerText(), /^Fotó elküldése\s*→/i);
    await adatok(e);
    await e.lap.click('#foto-kuld');
    await e.var_('foto-kesz');
    assert.equal(e.posztok.length, 1);
    const t = e.lead(e.posztok[0]);
    assert.ok(!/FOGLALÁSSAL/.test(t), 'a telefonos agon nincs foglalas');
    assert.match(t, /name="ag"\r\n\r\nB – régi PMU van\r\n/);
    const ev = await e.esemenyek();
    const lead = ev.find((x) => x.event === 'pmu_foto_lead');
    assert.ok(lead && lead.foglalassal === 0, JSON.stringify(lead));
    assert.deepEqual(e.hibak, []);
    await e.ctx.close();
  });

  test('MERES: a keretben betoltodo /pmu-ok kulcs-iroja (foglalas-kulcs.js) a fotos foglalasnal NEM ir kulcsot, a nem fotosnal igen', async () => {
    const kulcsIro = fs.readFileSync(path.join(GYOKER, 'assets/js/foglalas-kulcs.js'), 'utf8');
    for (const fotos of [true, false]) {
      const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=471153');
      await e.var_('kerdes');
      await e.valasz(fotos ? 'van' : 'elso');
      if (fotos) { await fotoFel(e); await e.lap.click('#foto-tovabb'); }
      await e.var_('ido');
      await e.slot();
      if (fotos) { await adatok(e); await e.lap.click('#foto-kuld'); }
      await e.var_('adatok');
      const src = await e.lap.getAttribute('#salonic', 'src');
      // a Salonic a sajat cimet adja vissza a bookingUrl-ben; a koszonooldalon (keretben) lefut a kulcs-iro ugyanabban a sessionStorage-ban
      const kulcsPost = [];
      await e.lap.route('**/api/foglalas-kulcs', (r) => { kulcsPost.push(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
      await e.lap.goto(bazis + '/kapcsolat?bookingUrl=' + encodeURIComponent(src), { waitUntil: 'load' });
      await e.lap.addScriptTag({ content: kulcsIro });
      await e.lap.waitForTimeout(500);
      assert.equal(kulcsPost.length, fotos ? 0 : 1, fotos ? 'fotos: nincs kulcs-iras' : 'nem fotos: a kulcs-iras valtozatlan');
      if (!fotos) assert.match(JSON.parse(kulcsPost[0]).booking_id, /^mb_[a-z0-9]+$/);
      await e.ctx.close();
    }
  });

  test('valasz-csere / kezelesvaltas a foto elkuldese utan: a munkamenet fotos MARAD (nov. 9., /pmu-foto-ok), nem lehet konverzios utra valtani', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=471153');
    await e.var_('kerdes');
    await e.valasz('van');
    await fotoFel(e);
    await e.lap.click('#foto-tovabb');
    await e.var_('ido');
    await e.slot();
    await adatok(e);
    await e.lap.click('#foto-kuld');
    await e.var_('adatok');
    assert.equal(e.posztok.length, 1);
    // vissza: adatok -> idopont -> kerdes; atvaltas "Nem, ez lesz az elso"-re
    await e.vissza(); await e.vissza();
    assert.deepEqual(await e.nezet(), ['kerdes']);
    await e.valasz('elso');
    await e.var_('ido');
    assert.deepEqual(await e.napok(), [9, 10], 'a valasz atvaltasa utan is csak nov. 9-tol (a mar fotot kuldott vendeg)');
    await e.slot();
    assert.deepEqual(await e.nezet(), ['adatok'], 'a foto mar elment: nem kell ujra, nincs masodik level');
    assert.equal(e.posztok.length, 1);
    await e.lap.evaluate(() => window.mhKeretbenOldal(location.origin + '/pmu-ok?first_booking=true&bookingUrl=x'));
    await e.lap.waitForURL('**/pmu-foto-ok**');
    assert.equal(new URL(e.lap.url()).pathname, '/pmu-foto-ok');
    await e.ctx.close();
    // kezelesvaltas: ugyanez
    const f = await fo('/foglalo-pmu?beagyazva=1&kezeles=471153');
    await f.var_('kerdes'); await f.valasz('van'); await fotoFel(f); await f.lap.click('#foto-tovabb'); await f.var_('ido'); await f.slot(); await adatok(f); await f.lap.click('#foto-kuld'); await f.var_('adatok');
    await f.vissza(); await f.vissza(); await f.vissza();
    assert.deepEqual(await f.nezet(), ['szolg']);
    await f.lap.getByRole('button', { name: /konzult/i }).first().click();
    await f.var_('kerdes');
    await f.valasz('elso');
    await f.var_('ido');
    assert.deepEqual(await f.napok(), [9, 10]);
    await f.ctx.close();
  });

  test('a bongeszo vissza gombja a Salonic-adatlaprol az idopontra (nem a mar elkuldott foto-adatokra) lep, nincs vissza-hurok', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=471153');
    await e.var_('kerdes'); await e.valasz('van'); await fotoFel(e); await e.lap.click('#foto-tovabb'); await e.var_('ido'); await e.slot(); await adatok(e); await e.lap.click('#foto-kuld'); await e.var_('adatok');
    await e.lap.goBack(); await e.lap.waitForTimeout(500);
    assert.deepEqual(await e.nezet(), ['ido']);
    await e.lap.goBack(); await e.lap.waitForTimeout(500);
    assert.deepEqual(await e.nezet(), ['foto'], 'tovabb: a foto-nezet (mar elkuldott foto)');
    assert.match(await e.lap.locator('#foto-szoveg').innerText(), /már elküldted/);
    assert.equal(await e.lap.isDisabled('#foto-tovabb'), false, 'a mar elkuldott fotonal a Tovabb elerheto');
    assert.equal(e.posztok.length, 1);
    await e.ctx.close();
  });

  test('B7 tartalek: ha a fotos vendeg a FO ABLAKBAN mégis a /pmu-ok-ra kerul (egyezo idopont), a mero-szkript (suti.js) elott a /pmu-foto-ok-ra iranyit; mas idopontnal / nem fotosnal nem', async () => {
    for (const [fotos, ts, vart] of [[true, 1790000000, '/pmu-foto-ok'], [true, 1790000999, '/pmu-ok'], [false, 1790000000, '/pmu-ok']]) {
      const ctx = await bongeszo.newContext({ viewport: { width: 900, height: 900 } });
      const lap = await ctx.newPage();
      await lap.route('**/*', (r) => (r.request().url().startsWith(bazis) ? r.continue() : r.abort()));
      await lap.addInitScript((t) => { if (!sessionStorage.getItem('mh_pmu_foglalas')) sessionStorage.setItem('mh_pmu_foglalas', JSON.stringify({ ts: 1790000000, perc: 30, nev: 'x', ar: 'Ingyenes', tipus: 'konz', fotos: t })); }, fotos);
      await lap.goto(bazis + '/pmu-ok?bookingUrl=' + encodeURIComponent('https://mosaic-pmu.salonic.hu/guestData/?placeId=14585&serviceId=471160&startDate=' + ts), { waitUntil: 'load' });
      await lap.waitForTimeout(600);
      assert.equal(new URL(lap.url()).pathname, vart, JSON.stringify([fotos, ts]));
      const suti = await lap.evaluate(() => [...document.scripts].some((s) => /suti\.js/.test(s.src)));
      assert.equal(suti, vart === '/pmu-ok', 'a /pmu-foto-ok-n nincs suti.js (meres), a /pmu-ok-n a szokasos modon van');
      await ctx.close();
    }
  });

  test('a fotos vendegnek nov. 9. elotti idopont akkor sem kinalhato / valaszthato, ha a kezdesek lista elavult (megjelenitesi szuro + hatar)', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=471160');
    await e.var_('kerdes'); await e.valasz('elso'); await e.var_('ido');
    assert.deepEqual(await e.napok(), [8, 9, 10]);
    // a vendeg visszalep, atvalt "van"-ra: a gyorsitotarazott (nem fotos) lista nem szivarog at
    await e.vissza();
    await e.lap.locator('input[name=elozmeny][value=van]').check({ force: true }); await e.lap.click('#kerdes-tovabb');
    await e.var_('foto'); await fotoFel(e); await e.lap.click('#foto-tovabb'); await e.var_('ido');
    assert.deepEqual(await e.napok(), [9, 10]);
    await e.ctx.close();
  });

  test('a Tetoválás eltávolítás (491949) a nem fotos vendegnek is csak nov. 9-tol (a regi biztonsagi szabaly marad); fotosnak is', async () => {
    const e = await fo('/foglalo-pmu?beagyazva=1&kezeles=491949');
    await e.var_('kerdes');
    assert.equal(await e.lap.locator('#kerdes-cim').innerText(), 'Van sminktetoválásod, amelyet eltávolíttatnál?', 'az eltavolitasnal sajat megfogalmazas');
    assert.equal(await e.lap.locator('input[name=elozmeny][value=van] + span').innerText(), 'Igen, van – fotót töltök fel róla');
    await e.valasz('elso');
    await e.var_('ido');
    assert.deepEqual(await e.napok(), [9, 10]);
    await e.ctx.close();
  });
});
