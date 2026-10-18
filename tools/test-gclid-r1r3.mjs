// DECISION #196 / 1. (Feri "mehet"): az R1-R3 gclid-rések javítása - offline tesztek (a bongeszos bizonyitek: tools/meres-proba/gclid-atadas-proba.mjs, meres-naplo/2026-10-18-gclid-r1r3.md).
//   R1: azonosito NELKULI oldalrol nyitott foglalo kontextusa + a koszonooldalra fuzott kereses megkapja a mentett (mh_attr / _gcl_aw) Google-azonositokat - csak marketing-hozzajarulassal
//   R2: a gbraid / wbraid a tracker-esemenyekbe is megy (parseContext)
//   R3: a PMU beagyazott ut sikere utani teljes-ablakos atiranyitas (/pmu-ok) URL-je is hordozza az azonositokat
//   node --test tools/test-gclid-r1r3.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseContext, fillGoogleIds, handoffSearch, withAttribution, GOOGLE_KEYS } from '../assets/js/booking-engine/flow.js';
import { engineSearch } from '../assets/js/booking-engine/beagyazott.js';
import { createTracker } from '../assets/js/booking-engine/tracking.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const olvas = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const ATTR = olvas('assets/js/attribucio.js');
const ENGINE = olvas('assets/js/booking-engine/engine.js');
const PMU = olvas('assets/js/foglalo-pmu.js');

const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789', GBRAID = '0AAAAAB_TESZT_gbraid_01234567', WBRAID = 'CoMKCQ_TESZT_wbraid_0123456789';
const SALONIC = 'https://www.mosaicheadspa.hu/lezer-ok?first_booking=true&service=Teszt&price=0&g=g:1&bookingUrl=https%3A%2F%2Fmosaic.salonic.hu%2FguestData%2F%3Fback%3Dmb_abc';

// --- vm-harness az attribucio.js-hez (mint tools/test-meres.mjs) -------------------------------------------------------------------------------
const tarolo = (kezdo = {}) => { const m = new Map(Object.entries(kezdo)); const irasok = []; return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { irasok.push(k); m.set(k, String(v)); }, removeItem: (k) => m.delete(k), _m: m, _irasok: irasok }; };
const CC = (o) => JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: true, ...o });
const ATTR_ALL = (google) => JSON.stringify({ v: 1, google });
const ts = () => Math.floor(Date.now() / 1000) - 1000;
function hamisSuti(kezdo) { const dontes = { ...kezdo }; return { engedely: (k) => !!dontes[k], figyel: () => {} }; }
function bongeszo({ search = '', cookie = '', ls = tarolo(), suti, forras = ATTR } = {}) {
  const win = { top: null };
  const ctx = { document: { get cookie() { return cookie; } }, localStorage: ls, sessionStorage: tarolo(), location: { hostname: 'www.mosaicheadspa.hu', search, origin: 'https://www.mosaicheadspa.hu', pathname: '/x' }, URLSearchParams, Date, JSON, Math, Promise, String, Object, encodeURIComponent, decodeURIComponent, RegExp, fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }) };
  win.top = win; win.self = win; Object.assign(win, ctx); win.window = win; if (suti) win.mhSuti = suti;
  vm.createContext(win); vm.runInContext(forras, win);
  return { win, ls, g: () => JSON.parse(JSON.stringify(win.mhAttribucio.googleAzonositok())) };
}

// --- R2: parseContext + tracker -------------------------------------------------------------------------------------------------------------------
test('R2: a gbraid / wbraid a kontextus attribution-jeben es minden tracker-esemenyen ott van (a gclid mellett)', () => {
  const c = parseContext(`?business=laser&gclid=${GCLID}&gbraid=${GBRAID}&wbraid=${WBRAID}&utm_source=google&fbclid=F1`);
  assert.deepEqual(c.attribution, { utm_source: 'google', gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID, fbclid: 'F1' });
  const dl = [];
  const t = createTracker({ ctx: c, dataLayer: dl, doc: { cookie: '' } });
  const e = t.track('booking_service_selected', { service_id: '1' });
  assert.equal(e.gbraid, GBRAID); assert.equal(e.wbraid, WBRAID); assert.equal(e.gclid, GCLID);
  assert.deepEqual(GOOGLE_KEYS, ['gclid', 'gbraid', 'wbraid']);
  // csak gbraid (iOS): a tobbi nincs
  const g = parseContext(`?gbraid=${GBRAID}`).attribution; assert.deepEqual(g, { gbraid: GBRAID });
});

// --- R1: tiszta fuggvenyek ---------------------------------------------------------------------------------------------------------------------------
test('R1: fillGoogleIds - csak a HIANYZO kulcsokat potolja, az URL-bol jovo erteket nem irja felul, a 10-200 karakteres mintat betartja', () => {
  assert.deepEqual(fillGoogleIds({}, { gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID }), { gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID });
  assert.deepEqual(fillGoogleIds({ gclid: 'URLBOL_gclid_0123' }, { gclid: GCLID, wbraid: WBRAID }), { gclid: 'URLBOL_gclid_0123', wbraid: WBRAID }, 'az URL-ben levo gclid elsobbseget elvez');
  assert.deepEqual(fillGoogleIds({ utm_source: 'x' }, {}), { utm_source: 'x' });
  assert.deepEqual(fillGoogleIds({}, { gclid: 'rovid', gbraid: 'x'.repeat(201), wbraid: 'ros sz!' }), {}, 'rovid / hosszu / ervenytelen karakterek: eldobva');
  assert.deepEqual(fillGoogleIds({}, { gclid: 123, fbclid: 'IwAR_fbclid_TESZT_01', utm_source: 'zzz' }), {}, 'csak a Google-kulcsok, csak szoveg');
  assert.equal(fillGoogleIds(undefined, { gclid: GCLID }), undefined); assert.deepEqual(fillGoogleIds({}, null), {}); assert.deepEqual(fillGoogleIds({}, 'x'), {});
});
test('R1: handoffSearch + withAttribution - a koszonooldal URL-je megkapja a kontextus azonositoit, ha a motor URL-jeben nincsenek; egyebkent valtozatlan', () => {
  // azonosito nelkuli motor-URL, a kontextusban van gclid + gbraid + wbraid -> a koszonooldal URL-jenek vegere kerulnek
  const ki = withAttribution(SALONIC, handoffSearch('?business=laser&service=konzult', { gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID }));
  assert.ok(ki.startsWith(SALONIC), 'a Salonic URL elotagja bajtra valtozatlan');
  assert.equal(ki.slice(SALONIC.length), `&gclid=${GCLID}&gbraid=${GBRAID}&wbraid=${WBRAID}`);
  // van azonosito az URL-ben: a keres valtozatlan (ugyanaz a string), a kontextus nem irja felul
  const mar = '?business=laser&gclid=URLBOL_gclid_0123&utm_source=google';
  assert.equal(handoffSearch(mar, { gclid: GCLID, gbraid: GBRAID }), '?business=laser&gclid=URLBOL_gclid_0123&utm_source=google&gbraid=' + GBRAID, 'csak a hianyzo gbraid kerul hozza');
  assert.equal(handoffSearch(mar, { gclid: GCLID }), mar, 'nincs mit hozzaadni: a bemenet valtozatlan');
  assert.equal(handoffSearch('', {}), ''); assert.equal(handoffSearch('?a=1', undefined), '?a=1');
  assert.equal(handoffSearch('?a=1', { gclid: 'rovid' }), '?a=1', 'ervenytelen minta: nem kerul hozza');
  // az utm_* a motor URL-jebol (withAttribution) tovabbra is megy
  assert.equal(withAttribution('https://x.hu/ok', handoffSearch('?utm_source=google', { gclid: GCLID })), `https://x.hu/ok?gclid=${GCLID}&utm_source=google`);
});

// --- R1: attribucio.js googleAzonositok() ---------------------------------------------------------------------------------------------------
test('R1: attribucio.googleAzonositok - marketing-hozzajarulassal a mentett mh_attr-bol adja vissza az azonositokat, azonosito NELKULI oldalon is', () => {
  const ls = tarolo({ mh_cc: CC(), mh_attr: ATTR_ALL({ gclid: { ertek: GCLID, ts: ts() }, gbraid: { ertek: GBRAID, ts: ts() }, wbraid: { ertek: WBRAID, ts: ts() } }) });
  const b = bongeszo({ ls, search: '?business=laser' });
  assert.deepEqual(b.g(), { gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID });
  // a googleAzonositok() csak olvas: a betoltes utani hivasok nem irnak se localStorage-ot, se sutit
  const irasokElotte = ls._irasok.length; b.g(); b.g();
  assert.equal(ls._irasok.length, irasokElotte, 'a googleAzonositok() hivasa 0 localStorage-iras');
  assert.equal(b.win.document.cookie, '', 'es nem allit sutit');
  // az aktualis URL azonositoja is beleszamit (memoria)
  assert.equal(bongeszo({ ls: tarolo({ mh_cc: CC() }), search: `?gclid=${GCLID}` }).g().gclid, GCLID);
  // a regi (>90 nap) azonosito nem jon vissza
  const regi = tarolo({ mh_cc: CC(), mh_attr: ATTR_ALL({ gclid: { ertek: GCLID, ts: Math.floor(Date.now() / 1000) - 91 * 86400 } }) });
  assert.deepEqual(bongeszo({ ls: regi }).g(), {});
});
test('R1: attribucio.googleAzonositok - a Google-cimke sajat sutije (_gcl_aw: gclid, _gcl_gb: gbraid) a tartalek; a mh_attr az elsobbseg; hibas suti-alakok eldobva', () => {
  const cookie = `_gcl_aw=GCL.1759759200.${GCLID}; _gcl_gb=GCL.1759759200.${GBRAID}; _ga=GA1.1.1.1`;
  assert.deepEqual(bongeszo({ ls: tarolo({ mh_cc: CC() }), cookie }).g(), { gclid: GCLID, gbraid: GBRAID });
  // dontes nelkul az alapertek (#170) a suti.js-ben granted: itt a hamis suti.js "adv: true"
  assert.deepEqual(bongeszo({ suti: hamisSuti({ adv: true }), cookie }).g(), { gclid: GCLID, gbraid: GBRAID });
  // mh_attr elsobbseg a suti felett
  const ls = tarolo({ mh_cc: CC(), mh_attr: ATTR_ALL({ gclid: { ertek: 'MhAttrbol_gclid_0123456789', ts: ts() } }) });
  assert.equal(bongeszo({ ls, cookie }).g().gclid, 'MhAttrbol_gclid_0123456789');
  for (const rossz of ['_gcl_aw=GCL.1759759200.rovid', '_gcl_aw=XXX.1759759200.' + GCLID, '_gcl_aw=GCL.17.' + GCLID, '_gcl_aw=GCL.1759759200.' + GCLID + '.extra', '_gcl_aw=GCL.1759759200.<script>', '_gcl_gb=1.2.3', '_gcl_aw=']) {
    assert.deepEqual(bongeszo({ ls: tarolo({ mh_cc: CC() }), cookie: rossz }).g(), {}, rossz);
  }
  assert.equal(bongeszo({ ls: tarolo({ mh_cc: CC() }), cookie: `_gcl_gb=GCL.1759759200.${WBRAID}` }).g().wbraid, undefined, 'wbraid-et a _gcl_gb-bol nem olvasunk');
});
test('R1 HOZZAJARULAS: marketing-hozzajarulas nelkul / elutasitva UTAN uresen ter vissza (mh_attr es _gcl_aw ellenere), es nem ir localStorage-ot / nem allit sutit', () => {
  const MH_ATTR = ATTR_ALL({ gclid: { ertek: GCLID, ts: ts() }, gbraid: { ertek: GBRAID, ts: ts() } });
  const cookie = `_gcl_aw=GCL.1759759200.${GCLID}; _gcl_gb=GCL.1759759200.${GBRAID}`;
  for (const [nev, opt] of [
    ['elutasitva (adv:false)', { ls: tarolo({ mh_cc: CC({ adv: false }), mh_attr: MH_ATTR }), cookie }],
    ['csak statisztika', { ls: tarolo({ mh_cc: CC({ adv: false, fun: false }), mh_attr: MH_ATTR }), cookie }],
    ['dontes nelkul, suti.js nelkul', { ls: tarolo({ mh_attr: MH_ATTR }), cookie }],
    ['suti.js: adv tiltva', { ls: tarolo({ mh_attr: MH_ATTR }), cookie, suti: hamisSuti({ adv: false, ana: true }) }],
  ]) {
    const b = bongeszo(opt);
    assert.deepEqual(b.g(), {}, nev + ': ures');
    assert.equal(opt.ls._irasok.filter((k) => k === 'mh_attr').length, 0, nev + ': 0 mh_attr iras');
  }
  // a hozzajarulas visszavonasa a mentett allapotot torli (attribucio.js meglevo viselkedese), a googleAzonositok ures marad
  const ls = tarolo({ mh_cc: CC(), mh_attr: MH_ATTR }); const suti = { adv: true, engedely: (k) => k !== 'adv' || suti.adv, figyel: () => {} };
  const b = bongeszo({ ls, suti }); assert.equal(b.g().gclid, GCLID); suti.adv = false; assert.deepEqual(b.g(), {}, 'visszavonas utan ures');
  // az ures hozzajarulas-objektum nem dob hibat
  assert.doesNotThrow(() => bongeszo({}).win.mhAttribucio.googleAzonositok());
});
test('R1: az attribucio.js exportja bovult, a tobbi (pillanatkep / hozzajarulas / kuld) valtozatlan', () => {
  const b = bongeszo({ ls: tarolo({ mh_cc: CC() }), search: `?gclid=${GCLID}` });
  assert.deepEqual(Object.keys(b.win.mhAttribucio).sort(), ['googleAzonositok', 'hozzajarulas', 'kuld', 'pillanatkep']);
  assert.equal(JSON.parse(JSON.stringify(b.win.mhAttribucio.pillanatkep())).google.gclid.ertek, GCLID);
});

// --- az engine.js bekotese (struktura; a bongeszos bizonyitek a gclid-atadas-proba futas) -------------------------------------------------------
test('R1: engine.js - a parseContext UTAN, a tracker ELOTT potol a mentett allapotbol; a koszonooldal-atadas a kontextus azonositoit hasznalja', () => {
  const i = ENGINE.indexOf('F.parseContext('), j = ENGINE.indexOf('F.fillGoogleIds(ctx.attribution'), k = ENGINE.indexOf('createTracker({ ctx');
  assert.ok(i > 0 && j > i && k > j, 'sorrend: parseContext -> fillGoogleIds -> createTracker');
  assert.match(ENGINE, /win\.mhAttribucio\.googleAzonositok\(\)/);
  assert.match(ENGINE, /win\.location\.assign\(F\.withAttribution\(href, F\.handoffSearch\(win\.location\.search, ctx\.attribution\)\)\)/);
  assert.ok(!/F\.withAttribution\(href, win\.location\.search\)/.test(ENGINE), 'nincs tobb "csak az URL" atadas');
});

// --- R3: foglalo-pmu.js mhKeretbenOldal ---------------------------------------------------------------------------------------------------------------
// A PMU-kod a VALODI attribucio.js-sel fut egyutt (a szulo ablak = a vm-harness valodi mhAttribucio-val, hozzajarulas-kapuval): a hozzajarulasi kapu megkerulese itt buknia kell.
const PMU_BLOKK = (forras) => { const m = forras.match(/(  \/\/ R3 \(DECISION #196\/1\)[\s\S]*?\n  window\.mhKeretbenOldal = \(href\) => \{[\s\S]*?\n  \};)/); assert.ok(m, 'a foglalo-pmu.js R3 blokkja megvan'); return m[1]; };
function pmuAtiranyitas({ beagyazva = true, szulo = {}, mhAttribucio = true, idegen = false, stub = null, forras = PMU } = {}) {
  const blokk = PMU_BLOKK(forras);
  const atiranyitasok = [];
  const b = bongeszo(szulo); // a szulo (landing) ablaka: valodi attribucio.js, a megadott URL-lel / tarolt allapottal / sutikkel / hozzajarulassal
  const fo = b.win; fo.location.assign = (u) => atiranyitasok.push(u);
  if (!mhAttribucio) delete fo.mhAttribucio;
  if (stub) fo.mhAttribucio = { googleAzonositok: () => stub }; // csak a PMU sajat mintaellenorzesehez (melysegi vedelem): a valodi googleAzonositok() mar szuri a hibas alakot
  if (idegen) Object.defineProperty(fo, 'mhAttribucio', { configurable: true, get() { throw new Error('SecurityError: cross-origin'); } });
  const sajat = { location: { assign: (u) => atiranyitasok.push('SAJAT:' + u), search: '' } };
  const win = { top: fo, location: sajat.location };
  const ctx = { window: win, BEAGYAZVA: beagyazva, URL, URLSearchParams, $: () => ({ removeAttribute() {} }), allapot: {}, history: { replaceState() {} }, mutat() {}, BELEPES: { ido() {} } };
  vm.createContext(ctx); vm.runInContext(blokk, ctx);
  return { be: (href) => ctx.window.mhKeretbenOldal(href), atiranyitasok, b };
}
const PMU_HREF = 'https://www.mosaicheadspa.hu/pmu-ok?bookingUrl=https%3A%2F%2Fmosaic-pmu.salonic.hu%2FguestData%2F%3Fback%3Dmb_abcdefghijkl&x=1';
const KERES_MIND = `?gclid=${GCLID}&gbraid=${GBRAID}&wbraid=${WBRAID}&utm_source=google`;
const TAROLT = { gclid: 'Tarolt_gclid_0123456789', gbraid: 'Tarolt_gbraid_0123456789', wbraid: 'Tarolt_wbraid_0123456789' };
const MH_ATTR_TAROLT = () => ATTR_ALL({ gclid: { ertek: TAROLT.gclid, ts: ts() }, gbraid: { ertek: TAROLT.gbraid, ts: ts() }, wbraid: { ertek: TAROLT.wbraid, ts: ts() } });
const SUTIK_TAROLT = `_gcl_aw=GCL.1759759200.Suti_gclid_0123456789; _gcl_gb=GCL.1759759200.Suti_gbraid_0123456789`;
const azonositok = (u) => Object.fromEntries(GOOGLE_KEYS.map((k) => [k, new URL(u).searchParams.get(k)]));
const main = (href) => { const u = new URL(href); u.searchParams.set('mh_proba', 'pmu'); return u.href; }; // a main-beli (R3 elotti) viselkedes: csak a mh_proba

test('R3: PMU - hozzajarulassal a sikeres foglalas utani teljes-ablakos atiranyitas (/pmu-ok) URL-je hordozza a gclid / gbraid / wbraid-et (a szulo aktualis URL-jebol, tarolt allapotabol, tartalekban a Google-cimke sutijebol)', () => {
  // a szulo (landing) URL-jeben ott van (a hamis suti.js: dontes nelkul granted, #170)
  let r = pmuAtiranyitas({ szulo: { ls: tarolo({ mh_cc: CC() }), search: KERES_MIND } }); r.be(PMU_HREF);
  let u = new URL(r.atiranyitasok[0]); assert.deepEqual([u.pathname, u.searchParams.get('mh_proba')], ['/pmu-ok', 'pmu']);
  assert.deepEqual(azonositok(u.href), { gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID });
  assert.equal(u.searchParams.get('x'), '1'); assert.ok(u.searchParams.get('bookingUrl').includes('back=mb_abcdefghijkl'), 'a tobbi parameter megmarad');
  assert.equal(u.searchParams.get('utm_source'), null, 'csak a Google-azonositok');
  // a szulo URL-jeben nincs (masik oldalrol nyitva): a hozzajarulassal tarolt mh_attr-bol jon
  r = pmuAtiranyitas({ szulo: { ls: tarolo({ mh_cc: CC(), mh_attr: MH_ATTR_TAROLT() }), search: '?x=1' } }); r.be(PMU_HREF);
  assert.deepEqual(azonositok(r.atiranyitasok[0]), TAROLT);
  // tartalek: a Google-cimke sutije (gclid, gbraid; wbraid sutibol nem)
  r = pmuAtiranyitas({ szulo: { ls: tarolo({ mh_cc: CC() }), cookie: SUTIK_TAROLT } }); r.be(PMU_HREF);
  assert.deepEqual(azonositok(r.atiranyitasok[0]), { gclid: 'Suti_gclid_0123456789', gbraid: 'Suti_gbraid_0123456789', wbraid: null });
  // suti.js "adv: true" is eleg
  r = pmuAtiranyitas({ szulo: { suti: hamisSuti({ adv: true }), search: KERES_MIND } }); r.be(PMU_HREF); assert.deepEqual(azonositok(r.atiranyitasok[0]), { gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID });
  // az aktualis URL elsobbseget elvez a tarolt felett; a Salonic URL-jeben mar meglevo azonositot nem irjuk felul
  r = pmuAtiranyitas({ szulo: { ls: tarolo({ mh_cc: CC(), mh_attr: MH_ATTR_TAROLT() }), search: `?gclid=URLBOL_gclid_0123` } }); r.be(PMU_HREF);
  assert.deepEqual(azonositok(r.atiranyitasok[0]), { gclid: 'URLBOL_gclid_0123', gbraid: TAROLT.gbraid, wbraid: TAROLT.wbraid });
  r = pmuAtiranyitas({ szulo: { ls: tarolo({ mh_cc: CC() }), search: `?gclid=${GCLID}` } }); r.be(PMU_HREF + '&gclid=SALONICBOL_gclid_0123'); assert.equal(azonositok(r.atiranyitasok[0]).gclid, 'SALONICBOL_gclid_0123');
  // nem beagyazva (onallo /foglalo-pmu oldal): a sajat ablak, ott nincs mhAttribucio -> nincs mit hozzaadni (a main-nel azonos)
  r = pmuAtiranyitas({ beagyazva: false, szulo: { ls: tarolo({ mh_cc: CC() }), search: KERES_MIND } }); r.be(PMU_HREF); assert.ok(r.atiranyitasok[0].startsWith('SAJAT:'), 'sajat ablak'); assert.equal(r.atiranyitasok[0].slice(6), main(PMU_HREF));
});
test('R3 HOZZAJARULAS (N1): kifejezett elutasitas / statisztika-csak / dontes es suti.js nelkul / suti.js adv tiltva / visszavonas UTAN a /pmu-ok URL-je azonosito NELKUL marad - akkor is, ha a szulo URL-jeben, a tarolt mh_attr-ban vagy a sutikben van - es a main-nel azonos', () => {
  const tiltott = [
    ['adv:false', { ls: tarolo({ mh_cc: CC({ adv: false }), mh_attr: MH_ATTR_TAROLT() }) }],
    ['csak statisztika', { ls: tarolo({ mh_cc: CC({ adv: false, fun: false }), mh_attr: MH_ATTR_TAROLT() }) }],
    ['dontes nelkul, suti.js nelkul', { ls: tarolo({ mh_attr: MH_ATTR_TAROLT() }) }],
    ['suti.js: adv tiltva', { ls: tarolo({ mh_attr: MH_ATTR_TAROLT() }), suti: hamisSuti({ adv: false, ana: true }) }],
  ];
  for (const [nev, opt] of tiltott) {
    // E1/E2: URL-ben azonosito (hirdetesbol erkezo landing) + tarolt allapot + Google-cimke sutik, MIND egyszerre
    for (const [leiras, szulo] of [['URL + tarolt + suti', { ...opt, search: KERES_MIND, cookie: SUTIK_TAROLT }], ['csak URL', { ...opt, search: KERES_MIND }], ['csak tarolt + suti', { ...opt, search: '?x=1', cookie: SUTIK_TAROLT }]]) {
      const r = pmuAtiranyitas({ szulo: { ...szulo, ls: tarolo({ ...Object.fromEntries(opt.ls._m) }) } }); r.be(PMU_HREF);
      assert.equal(r.atiranyitasok.length, 1, `${nev} / ${leiras}: van atiranyitas`);
      assert.deepEqual(azonositok(r.atiranyitasok[0]), { gclid: null, gbraid: null, wbraid: null }, `${nev} / ${leiras}: nincs azonosito`);
      assert.equal(r.atiranyitasok[0], main(PMU_HREF), `${nev} / ${leiras}: bajtra azonos a main-beli atiranyitassal`);
    }
  }
  // visszavonas az oldal betoltese UTAN (a suti.js valtozasa): a PMU is ures
  const suti = { adv: true, engedely: (k) => k !== 'adv' || suti.adv, figyel: () => {} };
  const r = pmuAtiranyitas({ szulo: { ls: tarolo({ mh_attr: MH_ATTR_TAROLT() }), suti, search: KERES_MIND } });
  suti.adv = false; r.be(PMU_HREF); assert.equal(r.atiranyitasok[0], main(PMU_HREF), 'visszavonas utan a main-nel azonos');
  // kontroll: UGYANAZ a bemenet hozzajarulassal (adv:true) mindharom azonositot hordozza (az elutasitott eset nem a harness hibaja)
  const k = pmuAtiranyitas({ szulo: { ls: tarolo({ mh_cc: CC({ adv: true }), mh_attr: MH_ATTR_TAROLT() }), search: KERES_MIND, cookie: SUTIK_TAROLT } }); k.be(PMU_HREF);
  assert.deepEqual(azonositok(k.atiranyitasok[0]), { gclid: GCLID, gbraid: GBRAID, wbraid: WBRAID }, 'kontroll: adv:true -> mindharom');
});
test('R3: PMU - a kod a szulo URL-jet / a nyers allapotot / a sutit KOZVETLENUL nem olvassa (csak a hozzajarulasi kapus googleAzonositok()-ot)', () => {
  const blokk = PMU_BLOKK(PMU).slice(PMU_BLOKK(PMU).indexOf('function googleAzonositokHozzaad'));
  assert.match(blokk, /\.mhAttribucio\.googleAzonositok\(\)/);
  for (const tilos of [/\.location\.search/, /URLSearchParams\(fo\./, /pillanatkep\s*\(/, /document\.cookie/, /localStorage/, /mh_attr/, /_gcl_/]) assert.ok(!tilos.test(blokk), 'tiltott kapu-megkerules: ' + tilos);
});
test('R3: PMU - hibas minta / hianyzo mhAttribucio / idegen eredetu szulo: az atiranyitas AZONOSITO NELKUL de HIBA NELKUL megy, a mh_proba marad; a "kozben elfogyott" ag valtozatlan', () => {
  for (const [nev, opt] of [['rovid / hibas azonosito az URL-ben', { szulo: { ls: tarolo({ mh_cc: CC() }), search: '?gclid=rovid&gbraid=%3Cx%3E' } }], ['nincs mhAttribucio', { mhAttribucio: false, szulo: { ls: tarolo({ mh_cc: CC() }), search: KERES_MIND } }], ['idegen eredetu szulo', { idegen: true, szulo: { ls: tarolo({ mh_cc: CC() }), search: KERES_MIND } }]]) {
    const r = pmuAtiranyitas(opt); assert.doesNotThrow(() => r.be(PMU_HREF), nev);
    assert.equal(r.atiranyitasok.length, 1, nev + ': van atiranyitas');
    assert.equal(r.atiranyitasok[0], main(PMU_HREF), nev + ': a main-nel azonos');
  }
  // melysegi vedelem: ha a szulo googleAzonositok()-ja (barmi okbol) hibas alakot adna, a PMU sajat mintaellenorzese is eldobja
  const s = pmuAtiranyitas({ stub: { gclid: '<script>alert(1)', gbraid: 'rovid', wbraid: 'x'.repeat(201) } }); s.be(PMU_HREF); assert.equal(s.atiranyitasok[0], main(PMU_HREF), 'hibas alaku stub-ertekek: eldobva');
  // az elfogyott idopont (a foglalo-pmu oldalra iranyit vissza) tovabbra sem navigal
  const r = pmuAtiranyitas({ szulo: { ls: tarolo({ mh_cc: CC() }), search: `?gclid=${GCLID}` } }); r.be('https://www.mosaicheadspa.hu/foglalo-pmu'); assert.equal(r.atiranyitasok.length, 0);
});

// --- a fo foglalo koszonooldal-atadasa elutasitas mellett a main-nel azonos (N1 kiegeszites) ---------------------------------------------------------------------
test('R1: a fo foglalo koszonooldal-atadasa kifejezett elutasitas mellett BAJTRA azonos a main-beli withAttribution(href, win.location.search)-csel; hozzajarulassal a tarolt allapot is hozzakerul', () => {
  const atadas = (b) => { // a motor: a lap URL-jebol epitett kontextus + R1 potlas a kapus googleAzonositok()-bol + a koszonooldal-atadas
    const win = { location: { search: b.win.location.search, pathname: '/lezeres-szortelenites-budapest' } };
    const c = parseContext(engineSearch({ business: 'laser', service: 'konzult' }, win));
    fillGoogleIds(c.attribution, b.win.mhAttribucio.googleAzonositok());
    return withAttribution(SALONIC, handoffSearch(win.location.search, c.attribution));
  };
  const mainAtadas = (b) => withAttribution(SALONIC, b.win.location.search);
  for (const [nev, opt] of [
    ['adv:false', { ls: tarolo({ mh_cc: CC({ adv: false }), mh_attr: MH_ATTR_TAROLT() }) }],
    ['dontes nelkul, suti.js nelkul', { ls: tarolo({ mh_attr: MH_ATTR_TAROLT() }) }],
    ['suti.js: adv tiltva', { ls: tarolo({ mh_attr: MH_ATTR_TAROLT() }), suti: hamisSuti({ adv: false }) }],
  ]) {
    for (const search of [KERES_MIND, '?x=1&utm_source=google', `?gclid=${GCLID}`]) {
      const b = bongeszo({ ...opt, ls: tarolo(Object.fromEntries(opt.ls._m)), search, cookie: SUTIK_TAROLT });
      assert.equal(atadas(b), mainAtadas(b), `${nev} / ${search}: a koszonooldal URL-je a main-nel azonos`);
    }
  }
  // kontroll: hozzajarulassal, azonosito nelkuli oldalrol a tarolt allapot hozzakerul (R1); az URL-beli azonosito a main-nel azonos modon megy
  const b = bongeszo({ ls: tarolo({ mh_cc: CC(), mh_attr: MH_ATTR_TAROLT() }), search: '?x=1' });
  assert.equal(atadas(b), SALONIC + `&gclid=${TAROLT.gclid}&gbraid=${TAROLT.gbraid}&wbraid=${TAROLT.wbraid}`);
  const c = bongeszo({ ls: tarolo({ mh_cc: CC() }), search: KERES_MIND }); assert.equal(atadas(c), mainAtadas(c), 'URL-beli azonositonal hozzajarulassal is a main-nel azonos');
});

// --- mi nem valtozott: a vedett fajlok masik kodja (struktura) --------------------------------------------------------------------------------------
test('nem valtozik: a booking-launcher.js, a suti.js, a netlify/ es a functions/ erintetlen (a hash-tablazat a naplóban); az attribucio.js tarolasi / hozzajarulas-logikaja ugyanaz', () => {
  assert.match(ATTR, /function engedely\(\) \{\s*try \{ if \(w\.mhSuti && typeof w\.mhSuti\.engedely === 'function'\) return !!w\.mhSuti\.engedely\('adv'\);/);
  assert.match(ATTR, /function ment\(o\) \{ if \(!engedely\(\)\) return false;/);
  assert.match(ATTR, /function olvas\(\) \{\s*if \(!engedely\(\)\) \{ torol\(\); return \{ v: 1 \}; \}/);
  assert.ok(!/localStorage\.setItem|setItem\(/.test(ATTR.slice(ATTR.indexOf('function googleAzonositok'))), 'a googleAzonositok nem ir tarolot');
  assert.ok(!/document\.cookie\s*=|\.cookie\s*=/.test(ATTR), 'az attribucio.js nem allit sutit');
});
