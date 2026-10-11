// Az Apps Script-illesztes (90_gas.js) fustproba: az Apps Script szolgaltatasokat memoriabeli hamis valtozatok adjak.
// Futtatas: node --test tools/kepcimkezo/test/gas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKC, sampleTree, makeHttp, makeDriveList } from './fakes.mjs';

const KC = loadKC(true);   // a 90_gas.js is
const CFG0 = structuredClone(KC.CFG);

// ---- memoriabeli tablazat ----
function makeSheet(name) {
  const data = [];
  const sh = {
    name, maxRows: 1000, frozen: 0, formats: [],
    getName: () => sh.name, setName: (n) => { sh.name = n; },
    getLastRow() { let n = 0; data.forEach((r, i) => { if (r && r.some((v) => v !== '' && v != null)) n = i + 1; }); return n; },
    getMaxRows: () => sh.maxRows,
    insertRowsAfter: (after, n) => { sh.maxRows += n; },
    setFrozenRows: (n) => { sh.frozen = n; },
    setColumnWidth() {},
    appendRow(row) { data[sh.getLastRow()] = row.slice(); },
    getRange(row, col, nr = 1, nc = 1) {
      const rg = {
        getValue: () => (data[row - 1] && data[row - 1][col - 1] != null ? data[row - 1][col - 1] : ''),
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (data[row - 1 + i] && data[row - 1 + i][col - 1 + j] != null ? data[row - 1 + i][col - 1 + j] : ''))),
        setValues(vals) {
          assert.equal(vals.length, nr, 'setValues sorok');
          assert.ok(row - 1 + nr <= sh.maxRows, 'a lap nincs eleg nagyra: ' + (row - 1 + nr));
          vals.forEach((vr, i) => { assert.equal(vr.length, nc, 'setValues oszlopok'); data[row - 1 + i] = data[row - 1 + i] || []; vr.forEach((v, j) => { data[row - 1 + i][col - 1 + j] = v; }); });
          return rg;
        },
        setFontWeight: () => rg, setBackground: () => rg, setFontColor: () => rg,
        setNumberFormat: (f) => { sh.formats.push({ col, f }); return rg; }
      };
      return rg;
    },
    _data: data
  };
  return sh;
}

function installGas({ tree, opts = {}, key = 'sk-test-key' }) {
  const calls = { drive: 0, thumbs: 0, openai: 0, openaiImages: 0 };
  const clock = { t: Date.UTC(2026, 9, 12, 1, 0, 0) };
  const fake = makeHttp(tree, opts, calls, clock);
  const fakeDrive = makeDriveList(tree, opts, calls);
  const sheets = [makeSheet('Munkalap1')];
  const props = key ? { OPENAI_API_KEY: key } : {};
  const triggers = [];
  const g = globalThis;
  g.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) };
  g.SpreadsheetApp = {
    openById: () => ({
      getSheetByName: (n) => sheets.find((s) => s.name === n) || null,
      getSheets: () => sheets,
      insertSheet: (n) => { const s = makeSheet(n); sheets.push(s); return s; },
      getSpreadsheetTimeZone: () => 'Etc/GMT'
    })
  };
  g.Drive = { Files: { list: (params) => { if (opts.driveError) throw new Error(opts.driveError); return fakeDrive(params); } } };
  g.Session = { getScriptTimeZone: () => 'Europe/Budapest' };
  g.Utilities = {
    sleep: () => {},
    base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
    formatDate: () => '2026-10-12 03:00'
  };
  g.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
  g.ScriptApp = {
    getOAuthToken: () => 'GOOGLE_TOKEN',
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger: (t) => { triggers.splice(triggers.indexOf(t), 1); },
    newTrigger: (fn) => {
      const t = { fn, getHandlerFunction: () => fn };
      const b = { timeBased: () => b, everyDays: (n) => { t.everyDays = n; return b; }, atHour: (h) => { t.atHour = h; return b; }, after: (ms) => { t.after = ms; return b; }, create: () => { triggers.push(t); return t; } };
      return b;
    }
  };
  const mkResp = (res) => ({
    getResponseCode: () => res.code,
    getContentText: () => res.text || '',
    getContent: () => Buffer.from(res.b64 || '', 'base64'),
    getHeaders: () => ({ 'Content-Type': res.mime || 'application/json; charset=UTF-8' })
  });
  const toReq = (o) => ({
    url: o.url, body: o.payload,
    auth: o.headers.Authorization === 'Bearer GOOGLE_TOKEN' ? 'google' : (o.headers.Authorization === 'Bearer ' + key ? 'openai' : null),
    binary: /googleusercontent/.test(o.url)
  });
  const rest = { calls: 0, mode: opts.rest || 'ok' };
  g.UrlFetchApp = {
    fetchAll: (list) => list.map((o) => {
      if (o.url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
        rest.calls++;
        if (rest.mode === 'disabled') return mkResp({ code: 403, text: 'Google Drive API has not been used in project 123 before or it is disabled.' });
        const u = new URL(o.url);
        return mkResp({ code: 200, text: JSON.stringify(fakeDrive({ q: u.searchParams.get('q'), pageToken: u.searchParams.get('pageToken') })) });
      }
      return mkResp(fake(toReq(o)));
    }),
    fetch: (url, o) => mkResp(fake(toReq(Object.assign({ url }, o))))
  };
  return { calls, sheets, props, triggers, clock, rest };
}

const byName = (sheets, n) => sheets.find((s) => s.name === n);

test('setup(): lapok, fejlec, napi idozito, kulcs-ellenorzes, proba', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC) });
  const res = globalThis.setup();
  assert.equal(res.stop, 'proba_kesz');
  const main = byName(gas.sheets, 'képek');
  assert.ok(main, 'a Munkalap1 atnevezve');
  assert.deepEqual(main._data[0], KC.COLS);
  assert.equal(main._data.length, 8);                                     // fejlec + 7 fajl
  assert.equal(main._data[1][0], 'm1');                                   // az utvonal szerint elso fajl
  const daily = gas.triggers.filter((t) => t.fn === 'napiFutas');
  assert.equal(daily.length, 1);
  assert.equal(daily[0].everyDays, 1);
  assert.equal(daily[0].atHour, KC.CFG.DAILY_HOUR);
  const settings = byName(gas.sheets, 'beállítások');
  assert.equal(settings._data[1][0], 'ELESITVE');
  assert.equal(settings._data[1][1], 'nem');
  const log = byName(gas.sheets, 'napló');
  assert.deepEqual(log._data[0], KC.LOG_HEADER);
  assert.equal(log._data[1][1], 'proba');
  assert.equal(gas.calls.openaiImages, 7);
  assert.ok(Number(gas.props[KC.monthKey(new Date(gas.clock.t))]) > 0, 'a koltseg szamlalo nott');
});

test('setup() ujrafuttatva nem duplikalja az idozitot', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC) });
  globalThis.setup();
  globalThis.setup();
  assert.equal(gas.triggers.filter((t) => t.fn === 'napiFutas').length, 1);
});

test('setup() kulcs nelkul: figyelmeztet, nem hiv semmit', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC), key: '' });
  assert.equal(globalThis.setup(), 'nincs_kulcs');
  assert.equal(gas.calls.drive, 0);
  assert.equal(gas.calls.openai, 0);
  assert.equal(byName(gas.sheets, 'napló')._data[1][9], 'nincs_kulcs');
});

test('setup() ervenytelen kulccsal: kulcs_hiba, nincs cimkezes', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC), opts: { modelsCode: 401 } });
  assert.equal(globalThis.setup(), 'kulcs_hiba');
  assert.equal(gas.calls.openai, 0);
});

test('napiFutas(): elesites nelkul kilep; a "beallitasok" lapon igen-re allitva dolgozik', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC) });
  globalThis.setup();                         // proba: 7 fajl
  const before = gas.calls.openaiImages;
  let s = globalThis.napiFutas();
  assert.equal(s.stop, 'nincs_elesitve');
  byName(gas.sheets, 'beállítások')._data[1][1] = 'igen';
  s = globalThis.napiFutas();
  assert.equal(s.stop, 'kesz');
  assert.equal(gas.calls.openaiImages, before);   // nincs uj fajl
});

test('allapot() osszesit', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC) });
  globalThis.setup();
  const cnt = globalThis.allapot();
  assert.equal(cnt.osszes, 7);
  assert.equal(cnt['állapot:kész'], 7);
});

test('leallitas() torli az osszes idozitot', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC) });
  globalThis.setup();
  globalThis.leallitas();
  assert.equal(gas.triggers.length, 0);
});

test('nagy tablazat: a lap automatikusan nagyobbra nő (1000 sor folott is ir)', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const tree = sampleTree(KC);
  const F = KC.CFG.ROOTS[1].id;
  for (let i = 0; i < 1100; i++) tree.push({ id: 'x' + i, name: 'k' + i + '.jpg', parents: [F], mimeType: 'image/jpeg', md5Checksum: 'mx' + i, thumbnailLink: 'https://lh3.googleusercontent.com/x' + i + '=s220' });
  const gas = installGas({ tree });
  globalThis.setup();
  byName(gas.sheets, 'beállítások')._data[1][1] = 'igen';
  const s = globalThis.napiFutas();
  assert.equal(s.stop, 'kesz');
  assert.ok(byName(gas.sheets, 'képek')._data.length > 1100);
});

test('a Drive-szolgaltatas kivetele hibakodda alakul (403 -> lista_hiba, a szoveg a naploban)', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC), opts: { rest: 'disabled', driveError: 'API call to drive.files.list failed with error: Insufficient Permission' } });
  const s = globalThis.setup();
  assert.equal(s.stop, 'lista_hiba');
  const note = byName(gas.sheets, 'napló')._data[1][12];
  assert.match(note, /lista_403: .*Insufficient Permission/);
});

test('a Drive REST elerheto: parhuzamos lista (UrlFetchApp), a beepitett szolgaltatas nem kell', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC), opts: { rest: 'ok' } });
  const s = globalThis.setup();
  assert.equal(s.stop, 'proba_kesz');
  assert.equal(s.labeled, 7);
  assert.ok(gas.rest.calls > 0, 'a REST ut hasznalva');
});

test('a Drive REST le van tiltva a projektben: egyszer megprobalja, megjegyzi, es sorban a beepitett szolgaltatassal megy', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC), opts: { rest: 'disabled' } });
  const s = globalThis.setup();
  assert.equal(s.labeled, 7);
  assert.equal(gas.props.DRIVE_REST, 'off');
  const restCallsAfterFirst = gas.rest.calls;
  globalThis.proba();
  assert.equal(gas.rest.calls, restCallsAfterFirst, 'a masodik futas mar nem probalkozik REST-tel');
});

test('szoveg-formatum: a szabad szoveges oszlopok (szoveg, leiras, nev, utvonal) es az azonositok "@" (szoveg) formatumuak', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC) });
  globalThis.setup();
  const main = byName(gas.sheets, 'képek');
  const textCols = new Set(main.formats.filter((x) => x.f === '@').map((x) => x.col));
  ['file_id', 'név', 'mappa_útvonal', 'szoveg', 'leírás', 'md5'].forEach((n) => assert.ok(textCols.has(KC.COL[n] + 1), 'nem szoveg-formatum: ' + n));
});

test('regi fejlec + adatsorok: nem ir felul, ertheto hibaval megall; ures lapon atirja a fejlecet', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC) });
  const main = gas.sheets[0];
  main.name = 'képek';
  main._data[0] = KC.COLS.filter((c) => c !== 'szoveg');       // a regi (21 oszlopos) fejlec
  main._data[1] = ['x1'];
  assert.throws(() => globalThis.setup(), /fejlece eltér a vártól/);
  assert.equal(gas.calls.openai, 0);
  main._data.length = 0;                                       // kiuritve: a fejlec ujraiodik
  globalThis.setup();
  assert.deepEqual(main._data[0], KC.COLS);
});

test('a hianyzo alapbeallitas (PROBA_ID_LISTA) potlodik, a meglevo ertekek maradnak', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const gas = installGas({ tree: sampleTree(KC) });
  globalThis.setup();
  const se = byName(gas.sheets, 'beállítások');
  se._data[1][1] = 'igen';                                     // ELESITVE
  const idx = se._data.findIndex((r) => r && r[0] === 'PROBA_ID_LISTA');
  se._data.splice(idx, 1);                                     // regi beallitas-lap: nincs ilyen sor
  globalThis.setup();
  assert.equal(se._data[1][1], 'igen');
  assert.ok(se._data.some((r) => r && r[0] === 'PROBA_ID_LISTA'));
});
