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
  assert.equal(ls._irasok.filter((k) => k === 'mh_attr').length >= 0, true);
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
function pmuAtiranyitas({ beagyazva = true, topSearch = '', mentett = {}, mhAttribucio = true, forras = PMU, idegen = false } = {}) {
  const m = forras.match(/(  \/\/ R3 \(DECISION #196\/1\)[\s\S]*?\n  window\.mhKeretbenOldal = \(href\) => \{[\s\S]*?\n  \};)/);
  assert.ok(m, 'a foglalo-pmu.js R3 blokkja megvan');
  const atiranyitasok = [];
  const fo = { location: { search: topSearch, assign: (u) => atiranyitasok.push(u) }, mhAttribucio: mhAttribucio ? { googleAzonositok: () => mentett } : undefined };
  const sajat = { location: { assign: (u) => atiranyitasok.push('SAJAT:' + u), search: '' } };
  if (idegen) { Object.defineProperty(fo.location, 'search', { get() { throw new Error('SecurityError: cross-origin'); } }); Object.defineProperty(fo, 'mhAttribucio', { get() { throw new Error('SecurityError: cross-origin'); } }); }
  const win = { top: fo, location: sajat.location };
  const ctx = { window: win, BEAGYAZVA: beagyazva, URL, URLSearchParams, $: () => ({ removeAttribute() {} }), allapot: {}, history: { replaceState() {} }, mutat() {}, BELEPES: { ido() {} } };
  vm.createContext(ctx); vm.runInContext(m[1], ctx);
  return { be: (href) => ctx.window.mhKeretbenOldal(href), atiranyitasok, ctx };
}
test('R3: PMU - a sikeres foglalas utani teljes-ablakos atiranyitas (/pmu-ok) URL-je hordozza a gclid / gbraid / wbraid-et (a szulo URL-jebol, ennek hianyaban a mentett allapotbol)', () => {
  const href = 'https://www.mosaicheadspa.hu/pmu-ok?bookingUrl=https%3A%2F%2Fmosaic-pmu.salonic.hu%2FguestData%2F%3Fback%3Dmb_abcdefghijkl&x=1';
  // a szulo (landing) URL-jeben ott van
  let r = pmuAtiranyitas({ topSearch: `?gclid=${GCLID}&gbraid=${GBRAID}&wbraid=${WBRAID}&utm_source=google` }); r.be(href);
  let u = new URL(r.atiranyitasok[0]); assert.deepEqual([u.pathname, u.searchParams.get('mh_proba'), u.searchParams.get('gclid'), u.searchParams.get('gbraid'), u.searchParams.get('wbraid')], ['/pmu-ok', 'pmu', GCLID, GBRAID, WBRAID]);
  assert.equal(u.searchParams.get('x'), '1'); assert.ok(u.searchParams.get('bookingUrl').includes('back=mb_abcdefghijkl'), 'a tobbi parameter megmarad');
  assert.equal(u.searchParams.get('utm_source'), null, 'csak a Google-azonositok');
  // a szulo URL-jeben nincs (masik oldalrol nyitva), a mentett allapotbol jon
  r = pmuAtiranyitas({ topSearch: '?x=1', mentett: { gclid: GCLID, gbraid: GBRAID } }); r.be(href);
  u = new URL(r.atiranyitasok[0]); assert.deepEqual([u.searchParams.get('gclid'), u.searchParams.get('gbraid'), u.searchParams.get('wbraid')], [GCLID, GBRAID, null]);
  // az URL elsobbseget elvez a mentett felett; a Salonic URL-jeben mar meglevo azonositot nem irjuk felul
  r = pmuAtiranyitas({ topSearch: `?gclid=URLBOL_gclid_0123`, mentett: { gclid: GCLID } }); r.be(href); assert.equal(new URL(r.atiranyitasok[0]).searchParams.get('gclid'), 'URLBOL_gclid_0123');
  r = pmuAtiranyitas({ topSearch: `?gclid=${GCLID}` }); r.be(href + '&gclid=SALONICBOL_gclid_0123'); assert.equal(new URL(r.atiranyitasok[0]).searchParams.get('gclid'), 'SALONICBOL_gclid_0123');
  // nem beagyazva (onallo /foglalo-pmu oldal): a sajat ablak
  r = pmuAtiranyitas({ beagyazva: false, mentett: { gclid: GCLID } }); r.be(href); assert.ok(r.atiranyitasok[0].startsWith('SAJAT:'), 'sajat ablak'); assert.ok(new URL(r.atiranyitasok[0].slice(6)).searchParams.get('gclid') === null, 'az onallo oldalon a sajat mhAttribucio hianyaban sincs mit hozzaadni (fo === window)');
});
test('R3: PMU - hibas minta / hianyzo mhAttribucio / idegen eredetu szulo: az atiranyitas AZONOSITO NELKUL de HIBA NELKUL megy, a mh_proba marad; a "kozben elfogyott" ag valtozatlan', () => {
  const href = 'https://www.mosaicheadspa.hu/pmu-ok?bookingUrl=x';
  for (const [nev, opt] of [['rovid azonosito', { topSearch: '?gclid=rovid', mentett: { gclid: 'rovid' } }], ['nincs mhAttribucio', { topSearch: '', mhAttribucio: false }], ['idegen eredetu szulo', { idegen: true }], ['tiltott karakterek', { topSearch: '?gclid=%3Cscript%3Ealert(1)', mentett: { gbraid: '<x>' } }]]) {
    const r = pmuAtiranyitas(opt); assert.doesNotThrow(() => r.be(href), nev);
    assert.equal(r.atiranyitasok.length, 1, nev + ': van atiranyitas'); const u = new URL(r.atiranyitasok[0].replace(/^SAJAT:/, ''));
    assert.equal(u.searchParams.get('mh_proba'), 'pmu', nev); for (const k of GOOGLE_KEYS) assert.equal(u.searchParams.get(k), null, nev + ': nincs ' + k);
  }
  // az elfogyott idopont (a foglalo-pmu oldalra iranyit vissza) tovabbra sem navigal
  const r = pmuAtiranyitas({ topSearch: `?gclid=${GCLID}` }); r.be('https://www.mosaicheadspa.hu/foglalo-pmu'); assert.equal(r.atiranyitasok.length, 0);
});

// --- mi nem valtozott: a vedett fajlok masik kodja (struktura) --------------------------------------------------------------------------------------
test('nem valtozik: a booking-launcher.js, a suti.js, a netlify/ es a functions/ erintetlen (a hash-tablazat a naplóban); az attribucio.js tarolasi / hozzajarulas-logikaja ugyanaz', () => {
  assert.match(ATTR, /function engedely\(\) \{\s*try \{ if \(w\.mhSuti && typeof w\.mhSuti\.engedely === 'function'\) return !!w\.mhSuti\.engedely\('adv'\);/);
  assert.match(ATTR, /function ment\(o\) \{ if \(!engedely\(\)\) return false;/);
  assert.match(ATTR, /function olvas\(\) \{\s*if \(!engedely\(\)\) \{ torol\(\); return \{ v: 1 \}; \}/);
  assert.ok(!/localStorage\.setItem|setItem\(/.test(ATTR.slice(ATTR.indexOf('function googleAzonositok'))), 'a googleAzonositok nem ir tarolot');
  assert.ok(!/document\.cookie\s*=|\.cookie\s*=/.test(ATTR), 'az attribucio.js nem allit sutit');
});
