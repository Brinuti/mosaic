// Kepcimkezo tesztek: hamis Drive / OpenAI / Sheet kornyezettel (nincs halozat, nincs Apps Script).
// Futtatas: node --test tools/kepcimkezo/test/kepcimkezo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadKC, FOLDER, file, folder, sampleTree as sampleTreeFor, makeHttp, makeDriveList } from './fakes.mjs';

const KC = loadKC(false);
const CFG0 = structuredClone(KC.CFG);

// ---------- hamis kornyezet ----------

export function makeEnv(tree, opts = {}) {
  const clock = { t: Date.UTC(2026, 9, 12, 1, 0, 0) };   // 2026-10-12 01:00 UTC
  const sheetRows = [KC.COLS.slice()];                   // 1. sor = fejlec
  const settings = Object.assign({ ELESITVE: 'igen', IDOKERET_PERC: '20' }, opts.settings || {});
  const props = Object.assign({}, opts.props || {});
  const calls = { drive: 0, thumbs: 0, openai: 0, openaiImages: 0, armed: [], cleared: 0 };
  const fakeFetch = makeHttp(tree, opts, calls, clock);
  const fakeDrive = makeDriveList(tree, opts, calls);
  const logs = [];
  const logRows = [];
  return {
    calls, logs, logRows, sheetRows, propsData: props, clock,
    now: () => clock.t,
    nowText: () => '2026-10-12 03:00',
    sleep: (ms) => { clock.t += ms; },
    log: (m) => logs.push(m),
    hasKey: () => opts.hasKey !== false,
    driveList(params) {
      const h = opts.driveHook && opts.driveHook(calls.drive + 1, params);
      if (h) { calls.drive++; return h; }
      return { code: 200, data: fakeDrive(params) };
    },
    ...(opts.parallelList ? {
      driveListMany(list) {
        calls.batches = (calls.batches || 0) + 1;
        return list.map((p, i) => (opts.batchFail && opts.batchFail(calls.batches, i) ? { code: 429, text: 'Rate Limit' } : { code: 200, data: fakeDrive(p) }));
      }
    } : {}),
    fetchAll(reqs) {
      clock.t += opts.msPerFetch || 0;
      return reqs.map((r) => fakeFetch(r));
    },
    sheet: {
      settings: () => settings,
      readAll: () => sheetRows.map((r) => r.slice()),
      append: (rows) => { rows.forEach((r) => sheetRows.push(r.slice())); },
      update: (rowIndex, row) => { sheetRows[rowIndex - 1] = row.slice(); },
      setRange: (row, col0, block) => {
        block.forEach((vals, k) => vals.forEach((v, j) => { sheetRows[row - 1 + k][col0 + j] = v; }));
      },
      log: (row) => logRows.push(row)
    },
    props: {
      getNumber: (k) => Number(props[k] || 0),
      addNumber: (k, d) => { props[k] = Number(props[k] || 0) + d; }
    },
    triggers: {
      clearContinuation: () => { calls.cleared++; },
      armContinuation: (m) => { calls.armed.push(m); }
    }
  };
}

const sampleTree = () => sampleTreeFor(KC);
const rowsOf = (env) => env.sheetRows.slice(1).map((r) => Object.fromEntries(KC.COLS.map((c, i) => [c, r[i]])));

// ---------- tiszta fuggvenyek ----------

test('a kizart mappak: jelszavak es influencer szerzodes, de NEM az "Influencer videok"', () => {
  assert.equal(KC.isExcludedFolder('Jelszavak'), true);
  assert.equal(KC.isExcludedFolder('JELSZAVAK 2024'), true);
  assert.equal(KC.isExcludedFolder('Influencer szerződés'), true);
  assert.equal(KC.isExcludedFolder('influencer szerzodesek'), true);
  assert.equal(KC.isExcludedFolder('2025.02.13 Influencer videók'), false);
  assert.equal(KC.isExcludedFolder('Social content'), false);
});

test('a Drive-lista parameterei: szulok, mime-szuro, megosztott elemek, lapozo', () => {
  const p = KC.listParams(['aaa', 'bbb'], 'TOKEN');
  assert.match(p.q, /^trashed=false and \('aaa' in parents or 'bbb' in parents\) and \(mimeType='application\/vnd\.google-apps\.folder'/);
  assert.match(p.q, /mimeType contains 'image\/'/);
  assert.match(p.q, /mimeType contains 'video\/'/);
  assert.equal(p.pageSize, 1000);
  assert.equal(p.supportsAllDrives, true);
  assert.equal(p.includeItemsFromAllDrives, true);
  assert.equal(p.pageToken, 'TOKEN');
  assert.match(p.fields, /thumbnailLink/);
  assert.match(p.fields, /md5Checksum/);
  assert.equal(KC.listParams(['a']).pageToken, undefined);
});

test('thumbUrl: a =s220 veget =s384-re cseréli', () => {
  assert.equal(KC.thumbUrl('https://lh3.googleusercontent.com/drive-storage/AB=s220', 384), 'https://lh3.googleusercontent.com/drive-storage/AB=s384');
  assert.equal(KC.thumbUrl('https://x/y', 384), 'https://x/y=s384');
});

test('matchItems: sorszam szerint, hianyzo = null, sorszam nelkul sorrend szerint', () => {
  const m = KC.matchItems(3, [{ i: 2, x: 'c' }, { i: 0, x: 'a' }]);
  assert.deepEqual(m.map((x) => x && x.x), ['a', null, 'c']);
  const m2 = KC.matchItems(2, [{ x: 'a' }, { x: 'b' }]);
  assert.deepEqual(m2.map((x) => x.x), ['a', 'b']);
  const m3 = KC.matchItems(2, [{ i: '1', x: 'b' }, { i: 7, x: 'zaj' }]);
  assert.deepEqual(m3.map((x) => x && x.x), [null, 'b']);
});

test('a prompt es a sema a VEGLEGES (2026-10-11), a keres formaja', () => {
  assert.equal(KC.PROMPT.length, 870);
  assert.ok(KC.PROMPT.startsWith('Szalon (Mosaic: headspa'));
  assert.ok(KC.PROMPT.includes('szoveg: a ráírt szöveg röviden (max 10 szó), üres string, ha nincs.'));
  assert.ok(KC.PROMPT.endsWith('A mappanév csak segítség, a képet nézd.'));
  assert.deepEqual(KC.SCHEMA.required, ['items']);
  const item = KC.SCHEMA.properties.items.items;
  assert.deepEqual(item.required, ['i', 'uzletag', 'tema', 'felirat', 'szoveg', 'nyersitheto', 'arc', 'minoseg', 'leiras']);
  assert.equal(item.additionalProperties, false);
  assert.equal(item.properties.szoveg.type, 'string');
  assert.ok(item.properties.tema.enum.includes('terem_enterior'));
  assert.ok(!item.properties.tema.enum.includes('terem_enteriőr'));
  assert.deepEqual(item.properties.minoseg.enum, [1, 2, 3]);
  // minden kulcs, amit a sema ad, van tablazat-oszlop
  Object.keys(item.properties).filter((k) => k !== 'i').forEach((k) => assert.ok(KC.TAG_KEYS[k], 'nincs oszlop: ' + k));
  const body = KC.buildOpenAIBody(
    [{ path: 'A/MOSAIC Head spa/x', mime: 'image/jpeg' }, { path: 'A/Medical Piercing/y', mime: 'video/mp4' }],
    [{ mime: 'image/jpeg', b64: 'AAA' }, { mime: 'image/png', b64: 'BBB' }]);
  assert.equal(body.model, 'gpt-5.4-mini');
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.strict, true);
  const c = body.input[0].content;
  assert.equal(c[0].text, KC.PROMPT);
  assert.equal(c[1].text, '#0 mappa: A/MOSAIC Head spa/x');
  assert.equal(c[2].detail, 'low');
  assert.equal(c[2].image_url, 'data:image/jpeg;base64,AAA');
  assert.equal(c[3].text, '#1 mappa: A/Medical Piercing/y (VIDEÓ előnézeti kocka)');
  assert.equal(c[4].image_url, 'data:image/png;base64,BBB');
});

test('koltseg: 1856 bemeneti + 538 kimeneti token ~ 0,0038 USD (az elemzo 8 kepes probaja)', () => {
  const c = KC.costUsd({ input_tokens: 1856, output_tokens: 538 });
  assert.ok(Math.abs(c - 0.003813) < 0.0001, String(c));
});

// ---------- teljes futas ----------

test('elso futas: hatokor, kizarasok, fiok, duplikatum, sorok', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree());
  const s = KC.run(env, 'napi');
  const rows = rowsOf(env);
  const ids = rows.map((r) => r.file_id).sort();
  // benne: m1 m2 v1 i1 (influencer VIDEOK mappa!) p1 b2 c1 ; kint: pw1 (Jelszavak) g1 (Gyogytornaszom) root1 (gyoker) c2 c3 b1 (masolat)
  assert.deepEqual(ids, ['b2', 'c1', 'i1', 'm1', 'm2', 'p1', 'v1']);
  const by = Object.fromEntries(rows.map((r) => [r.file_id, r]));
  assert.equal(by.m1['mappa_útvonal'], 'A/MOSAIC Head spa');
  assert.equal(by.m1['fiók'], 'Mosaic');
  assert.equal(by.p1['mappa_útvonal'], 'A/Medical Piercing');
  assert.equal(by.p1['fiók'], 'MP');
  assert.equal(by.v1['mappa_útvonal'], 'A/MOSAIC Head spa/Kész videók');
  assert.equal(by.v1['szélesség'], 720);
  assert.equal(by.v1['magasság'], 1280);
  assert.equal(by.v1['videó_hossz_mp'], 16);
  assert.equal(by.c1['mappa_útvonal'], 'C/Social content');
  assert.equal(by.c1['fiók'], 'MP');
  assert.equal(by.b2['mappa_útvonal'], 'B');
  assert.equal(by.m1['másolatok'], 1);              // a B-beli masolat
  assert.equal(by.m2['másolatok'], 0);
  assert.equal(by.m1['állapot'], 'kész');
  assert.equal(by.m1['üzletág'], 'headspa');
  assert.equal(by.p1['üzletág'], 'piercing');
  assert.equal(by.m1['minőség'], 3);
  assert.equal(by.m1['szoveg'], '=SUM(1,1)');                 // a tablazatban szoveg-formatumu oszlop: nem kepletkent ertelmezodik
  assert.equal(KC.COLS[KC.COL['szoveg'] - 1], 'felirat');     // a "szoveg" a "felirat" utan van
  assert.equal(by.m1['címkézés_dátuma'], '2026-10-12 03:00');
  assert.equal(by.m1['md5'], 'md5-m1');
  assert.equal(s.labeled, 7);
  assert.equal(s.stop, 'kesz');
  assert.ok(s.cost > 0 && s.cost < 0.05);
  assert.equal(env.propsData[KC.monthKey(new Date(env.clock.t))], s.cost);
  assert.equal(env.calls.openaiImages, 7);
  assert.equal(env.logRows.length, 1);
});

test('masodik futas: nincs ujra-cimkezes, nincs OpenAI-hivas (idempotens)', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree());
  KC.run(env, 'napi');
  const openaiBefore = env.calls.openai;
  const snapshot = JSON.stringify(env.sheetRows);
  const s2 = KC.run(env, 'napi');
  assert.equal(env.calls.openai, openaiBefore);
  assert.equal(s2.labeled, 0);
  assert.equal(JSON.stringify(env.sheetRows), snapshot);
});

test('valtozas: ujabb md5 -> helyben ujracimkezes; atnevezett mappa -> utvonal frissul; uj fajl -> uj sor', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const tree = sampleTree();
  const env = makeEnv(tree);
  KC.run(env, 'napi');
  const rowCount = env.sheetRows.length;
  tree.find((f) => f.id === 'm2').md5Checksum = 'md5-m2-v2';
  tree.find((f) => f.id === 'fSub').name = 'Kész videók 2';
  tree.push(file('m9', 'uj.jpg', ['fMosaic']));
  const s = KC.run(env, 'napi');
  assert.equal(s.labeled, 2);                          // m2 ujra + m9 uj
  assert.equal(env.sheetRows.length, rowCount + 1);
  const by = Object.fromEntries(rowsOf(env).map((r) => [r.file_id, r]));
  assert.equal(by.m2['md5'], 'md5-m2-v2');
  assert.equal(by.v1['mappa_útvonal'], 'A/MOSAIC Head spa/Kész videók 2');
  assert.equal(by.m9['állapot'], 'kész');
});

test('lapozas: a Drive-lista tobb oldalon is minden fajlt megtalal', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { pageSize: 2 });
  KC.run(env, 'napi');
  assert.equal(rowsOf(env).length, 7);
});

test('proba(): csak a kert minta fut, egyenletesen szort', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  KC.CFG.PROBA_DB = 3;
  const env = makeEnv(sampleTree(), { settings: { ELESITVE: 'nem' } });
  const s = KC.run(env, 'proba');
  assert.equal(s.labeled, 3);
  assert.equal(s.stop, 'proba_kesz');
  assert.equal(rowsOf(env).length, 3);
});

test('napi futas elesites nelkul nem csinal semmit', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { settings: { ELESITVE: 'nem' } });
  const s = KC.run(env, 'napi');
  assert.equal(s.stop, 'nincs_elesitve');
  assert.equal(env.calls.drive, 0);
  assert.equal(env.calls.openai, 0);
});

test('LEALLITAS = igen es hianyzo kulcs: azonnali kilepes', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  let env = makeEnv(sampleTree(), { settings: { LEALLITAS: 'igen' } });
  assert.equal(KC.run(env, 'napi').stop, 'leallitas');
  env = makeEnv(sampleTree(), { hasKey: false });
  assert.equal(KC.run(env, 'napi').stop, 'nincs_kulcs');
  assert.equal(env.calls.drive, 0);
});

test('429 es 500 ujraprobalva sikerul; a kosztot egyszer szamolja', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  let n = 0;
  const env = makeEnv(sampleTree(), { openai: () => (++n === 1 ? { code: 429, text: 'rate' } : (n === 2 ? { code: 500, text: 'x' } : null)) });
  const s = KC.run(env, 'napi');
  assert.equal(s.labeled, 7);
  assert.equal(s.errors, 0);
});

test('egy rossz kep: a kotegek felezodnek, csak az a kep lesz "hiba", a tobbi kesz', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const tree = sampleTree();
  const env = makeEnv(tree, {
    openai: (_n, body) => {
      const texts = body.input[0].content.filter((c) => c.type === 'input_text').slice(1).map((c) => c.text).join('|');
      return /A\/Medical Piercing/.test(texts) ? { code: 400, text: '{"error":"invalid image"}' } : null;
    }
  });
  const s = KC.run(env, 'napi');
  const by = Object.fromEntries(rowsOf(env).map((r) => [r.file_id, r]));
  assert.equal(by.p1['állapot'], 'hiba');
  assert.equal(by.p1['próbálkozás'], 1);
  assert.equal(by.m1['állapot'], 'kész');
  assert.equal(s.errors, 1);
  assert.equal(s.labeled, 6);
});

test('elonezet nelkuli fajl: nincs_elonezet, nem megy OpenAI-ra; 20 ora mulva ujraprobalja, 3 probalkozas utan megall', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { noThumb: ['m2'] });
  const s = KC.run(env, 'napi');
  assert.equal(s.noThumb, 1);
  assert.equal(s.labeled, 6);
  assert.equal(env.calls.openaiImages, 6);
  let r = rowsOf(env).find((x) => x.file_id === 'm2');
  assert.equal(r['állapot'], 'nincs_előnézet');
  assert.equal(r['próbálkozás'], 1);
  // rogton utana: meg nem probalja ujra
  assert.equal(KC.run(env, 'napi').noThumb, 0);
  // 21 ora mulva: ujra (a nowText fix, ezert a bélyeg 2026-10-12 03:00 marad; az ido lepjen elore)
  env.clock.t += 21 * 3600 * 1000;
  assert.equal(KC.run(env, 'napi').noThumb, 1);
  env.clock.t += 21 * 3600 * 1000;
  assert.equal(KC.run(env, 'napi').noThumb, 1);   // 3. probalkozas
  r = rowsOf(env).find((x) => x.file_id === 'm2');
  assert.equal(r['próbálkozás'], 3);
  env.clock.t += 21 * 3600 * 1000;
  assert.equal(KC.run(env, 'napi').noThumb, 0);   // tobbet nem
});

test('az elonezet hitelesites nelkul is lekerheto, ha a hitelesitett keres elutasitott', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { thumbNeedsNoAuth: true });
  const s = KC.run(env, 'napi');
  assert.equal(s.labeled, 7);
});

test('havi keret: 90%-nal megall, nem hiv OpenAI-t', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const key = KC.monthKey(new Date(Date.UTC(2026, 9, 12, 1, 0, 0)));
  const env = makeEnv(sampleTree(), { props: { [key]: 27.5 } });
  const s = KC.run(env, 'napi');
  assert.equal(s.stop, 'koltseg');
  assert.equal(env.calls.openai, 0);
});

test('idokeret: a hatar kozeleben megall, es folytatast utemez', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  KC.CFG.BATCH = 2; KC.CFG.PARALLEL = 1;                     // csoport = 2 fajl
  const tree = sampleTree();
  const env = makeEnv(tree, { settings: { IDOKERET_PERC: '10' }, msPerOpenai: 200 * 1000 });   // minden OpenAI-hivas 200 mp
  const s = KC.run(env, 'napi');
  assert.equal(s.stop, 'ido');
  assert.ok(s.labeled > 0 && s.labeled < 7, 'cimkezett: ' + s.labeled);
  assert.ok(s.remaining > 0);
  assert.deepEqual(env.calls.armed.at(-1), KC.CFG.CONTINUE_AFTER_MIN);
});

test('veglegesen elutasitott kulcs (401): megall, nem probalkozik vegtelenul', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { openai: () => ({ code: 401, text: '{"error":{"message":"Incorrect API key"}}' }) });
  const s = KC.run(env, 'napi');
  assert.equal(s.stop, 'openai_http_401');
  assert.ok(env.calls.openai <= KC.CFG.PARALLEL);
});

test('MAX_FAJL: legfeljebb ennyi uj fajlt cimkez egy futas', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { settings: { MAX_FAJL: '3' } });
  const s = KC.run(env, 'napi');
  assert.equal(s.labeled, 3);
  assert.equal(s.stop, 'limit');
});

test('Drive-lista: atmeneti hiba (sebessegkorlat) ujraprobalva sikerul', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { driveHook: (n) => (n === 1 || n === 2 ? { code: 429, text: 'Rate Limit Exceeded' } : null) });
  const s = KC.run(env, 'napi');
  assert.equal(s.labeled, 7);
});

test('Drive-lista: tartos hiba -> "lista_hiba", a hiba szovege a naploban, nincs OpenAI-hivas', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { driveHook: () => ({ code: 403, text: 'Drive API has not been used in project 123' }) });
  const s = KC.run(env, 'napi');
  assert.equal(s.stop, 'lista_hiba');
  assert.match(s.note, /lista_403: Drive API has not been used/);
  assert.equal(env.calls.openai, 0);
  assert.equal(env.sheetRows.length, 1);
});

test('parhuzamos mappa-lista: egyszerre tobb mappa, az atmeneti hibas egyesevel ujraprobalva sikerul', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { parallelList: true, batchFail: (b, i) => b === 2 && i === 0 });
  const s = KC.run(env, 'napi');
  assert.equal(s.labeled, 7);
  assert.ok(env.calls.batches >= 2);
  assert.equal(rowsOf(env).length, 7);
});

test('a bejaras idokorlatja: ha nem er veget, megszakad es nem cimkez', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { settings: { IDOKERET_PERC: '10' }, driveHook: () => null });
  const orig = env.driveList;
  env.driveList = (p) => { env.clock.t += 5 * 60 * 1000; return orig(p); };   // minden mappa-lista 5 perc
  const s = KC.run(env, 'napi');
  assert.equal(s.stop, 'scan_ido');
  assert.equal(env.calls.openai, 0);
});

test('PROBA_ID_LISTA: a proba() pontosan a megadott fajlokat cimkezi', () => {
  Object.assign(KC.CFG, structuredClone(CFG0));
  const env = makeEnv(sampleTree(), { settings: { ELESITVE: 'nem', PROBA_ID_LISTA: 'p1, m2;b2 nincs-ilyen' } });
  const s = KC.run(env, 'proba');
  assert.equal(s.labeled, 3);
  assert.deepEqual(rowsOf(env).map((r) => r.file_id).sort(), ['b2', 'm2', 'p1']);
  assert.ok(s.note.includes('proba: 3 / 4 megadott fajl'), s.note);
});
