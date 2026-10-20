// node --test tools/test-mp-meta-arnyek.mjs  -  Meta arnyekmeres (lib/meres/meta.js): jogosultsag, torzs, UA nem tarolodik
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { arnyekJogosult, arnyekTorzs, metaArnyekLepes, ARNYEK_DATASET } from '../lib/meres/meta.js';

const UA = 'Mozilla/5.0 (iPhone) TesztUA';
const sor = { kulcs: '6029|111|1792000000', kornyezet: 'eles', hozzajarulas_hirdetes: 1, meta_fbc: 'fb.1.1792000000000.AbC', meta_fbp: 'fb.1.1791000000000.123', letrehozva: 1792000100, ertek: 24900 };

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE mp_beallitas (kulcs TEXT PRIMARY KEY, ertek TEXT)");
  const prep = (sql) => {
    let args = [];
    const o = { bind: (...a) => { args = a; return o; }, run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
      first: async () => db.prepare(sql).get(...args) ?? null, all: async () => ({ results: db.prepare(sql).all(...args) }) };
    return o;
  };
  return { prepare: prep, raw: db };
}

test('jogosultsag', () => {
  assert.deepEqual(arnyekJogosult(sor, UA), { ok: true });
  assert.equal(arnyekJogosult({ ...sor, kornyezet: 'elonezet' }, UA).miert, 'nem_eles');
  assert.equal(arnyekJogosult({ ...sor, hozzajarulas_hirdetes: 0 }, UA).miert, 'nincs_hozzajarulas');
  assert.equal(arnyekJogosult({ ...sor, meta_fbc: null, meta_fbp: null }, UA).miert, 'nincs_azonosito');
  // 2026-10-20: fbc/fbp nelkul is jogosult, ha van ervenyes IP (+ UA) vagy external_id
  assert.deepEqual(arnyekJogosult({ ...sor, meta_fbc: null, meta_fbp: null }, UA, '84.1.2.3'), { ok: true });
  assert.deepEqual(arnyekJogosult({ ...sor, meta_fbc: null, meta_fbp: null }, UA, null, 'a'.repeat(64)), { ok: true });
  assert.equal(arnyekJogosult({ ...sor, meta_fbc: null, meta_fbp: null }, UA, 'nem-ip', 'rossz').miert, 'nincs_azonosito');
  assert.equal(arnyekJogosult(sor, '').miert, 'nincs_ua');
});

test('torzs: Schedule, Salonic-forras, csak fbc/fbp/UA', () => {
  const t = arnyekTorzs(sor, UA).data[0];
  assert.equal(t.event_name, 'Schedule');
  assert.equal(t.event_source_url, 'https://medicalpiercing.salonic.hu/');
  assert.equal(t.action_source, 'website');
  assert.deepEqual(Object.keys(t.user_data).sort(), ['client_user_agent', 'fbc', 'fbp']);
  assert.equal(t.custom_data.value, 24900);
});

test('naplo mod: nincs halozati hivas, a UA nem kerul a naploba', async () => {
  const db = d1();
  let hivas = 0;
  const r = await metaArnyekLepes(db, sor, UA, { META_CAPI_TOKEN: 'x' }, 'www.medicalpiercing.hu', { fetchImpl: async () => { hivas++; }, most: 1792000200 });
  assert.equal(r.mod, 'naplo');
  assert.equal(hivas, 0);
  const sorok = db.raw.prepare('SELECT * FROM mp_meta_arnyek').all();
  assert.equal(sorok.length, 1);
  assert.ok(!JSON.stringify(sorok).includes('TesztUA'));
});

test('eles mod: az arnyek adathalmazba kuld, egyszer; a valaszban a UA/fbc kitakarva', async () => {
  const db = d1();
  db.raw.exec("INSERT INTO mp_beallitas VALUES ('meta_arnyek_mod','eles')");
  const urlek = [];
  const fetchImpl = async (u, o) => { urlek.push(u); return { ok: true, status: 200, text: async () => JSON.stringify({ events_received: 1, echo: o.body }) }; };
  const env = { META_CAPI_TOKEN: 'tok123' };
  const r1 = await metaArnyekLepes(db, sor, UA, env, 'www.medicalpiercing.hu', { fetchImpl, most: 1792000200 });
  const r2 = await metaArnyekLepes(db, sor, UA, env, 'www.medicalpiercing.hu', { fetchImpl, most: 1792000201 });
  assert.equal(r1.allapot, 'elkuldve');
  assert.equal(r2.kihagyva, 'mar_rogzitve');
  assert.equal(urlek.length, 1);
  assert.ok(urlek[0].includes(`/${ARNYEK_DATASET}/events`));
  assert.ok(!urlek[0].includes('2177829632420786'));
  const naplo = JSON.stringify(db.raw.prepare('SELECT * FROM mp_meta_arnyek').all());
  assert.ok(!naplo.includes('TesztUA') && !naplo.includes('AbC') && !naplo.includes('tok123'));
});

test('elonezet hoszton eles beallitas mellett sem kuld', async () => {
  const db = d1();
  db.raw.exec("INSERT INTO mp_beallitas VALUES ('meta_arnyek_mod','eles')");
  let hivas = 0;
  const r = await metaArnyekLepes(db, sor, UA, { META_CAPI_TOKEN: 't' }, 'valami.pages.dev', { fetchImpl: async () => { hivas++; } });
  assert.equal(r.mod, 'naplo');
  assert.equal(hivas, 0);
});

// Feri 2026-10-19: IP az ARNYEK-esemenyben; hibas IP nem megy at; egeszsegugyi / szemelyes adat nincs
{
  const { arnyekTorzs } = await import('../lib/meres/meta.js');
  const sor = { kulcs: '1|2|3', letrehozva: 1792300000, ertek: 24900, meta_fbc: 'fb.1.1.IwAR', meta_fbp: 'fb.1.1.2' };
  const a = arnyekTorzs(sor, 'Mozilla/5.0', '84.1.2.3');
  assert.deepEqual(Object.keys(a.data[0].user_data).sort(), ['client_ip_address', 'client_user_agent', 'fbc', 'fbp']);
  assert.equal(arnyekTorzs(sor, 'Mozilla/5.0', '2a02:ab88::1').data[0].user_data.client_ip_address, '2a02:ab88::1');
  assert.ok(!('client_ip_address' in arnyekTorzs(sor, 'Mozilla/5.0', 'rossz').data[0].user_data));
  assert.ok(!/"em"|"ph"|"fn"|"ln"/.test(JSON.stringify(a)));
  console.log('OK ip az arnyek-esemenyben');
}

// Feri 2026-10-19: external_id = a veletlen latogato-azonosito SHA-256-ja; mas formatum nem megy at
{
  const { arnyekTorzs } = await import('../lib/meres/meta.js');
  const sor = { kulcs: '1|2|3', letrehozva: 1792300000, ertek: 24900, meta_fbc: 'fb.1.1.IwAR', meta_fbp: 'fb.1.1.2' };
  const h = 'a'.repeat(64);
  assert.equal(arnyekTorzs(sor, 'UA', '84.1.2.3', h).data[0].user_data.external_id, h);
  assert.ok(!('external_id' in arnyekTorzs(sor, 'UA', '84.1.2.3', 'vendeg@pelda.hu').data[0].user_data));
  console.log('OK external_id');
}

// 2026-10-20: fbc/fbp nelkuli kuldes IP + UA alapjan, kihagyas-naplo, PII-tilalom
{
  const SOR0 = { ...sor, kulcs: '6029|222|1792000500', meta_fbc: null, meta_fbp: null };
  const ELES = async () => { const db = d1(); db.raw.exec("INSERT INTO mp_beallitas VALUES ('meta_arnyek_mod','eles')"); return db; };
  const jo = (testek) => async (u, o) => { testek.push({ u, torzs: JSON.parse(o.body) }); return { ok: true, status: 200, text: async () => JSON.stringify({ events_received: 1 }) }; };

  test('fbc/fbp nelkul IP + UA-val -> elkuldve az ARNYEK adathalmazba; nincs em/ph/fn/ln', async () => {
    const db = await ELES();
    const hivasok = [];
    const r = await metaArnyekLepes(db, { ...SOR0, email: 'v@x.hu', telefon: '06301234567', nev: 'Teszt Elek' }, UA, { META_CAPI_TOKEN: 'tok' }, 'www.medicalpiercing.hu', { fetchImpl: jo(hivasok), most: 1792000600, ip: '84.1.2.3' });
    assert.equal(r.allapot, 'elkuldve');
    assert.equal(hivasok.length, 1);
    assert.ok(hivasok[0].u.includes(`/${ARNYEK_DATASET}/events`) && !hivasok[0].u.includes('2177829632420786'));
    const u = hivasok[0].torzs.data[0].user_data;
    assert.deepEqual(Object.keys(u).sort(), ['client_ip_address', 'client_user_agent']);
    const s = JSON.stringify(hivasok[0].torzs);
    for (const k of ['"em"', '"ph"', '"fn"', '"ln"', 'v@x.hu', '0630', 'Teszt Elek']) assert.ok(!s.includes(k), k);
    const n = db.raw.prepare('SELECT * FROM mp_meta_arnyek').all();
    assert.equal(n.length, 1); assert.equal(n[0].allapot, 'elkuldve'); assert.equal(n[0].van_fbc, 0);
    assert.ok(!JSON.stringify(n).includes('84.1.2.3') && !JSON.stringify(n).includes('TesztUA'));
  });

  test('csak external_id-val is elkuldve', async () => {
    const db = await ELES();
    const hivasok = [];
    const r = await metaArnyekLepes(db, SOR0, UA, { META_CAPI_TOKEN: 'tok' }, 'www.medicalpiercing.hu', { fetchImpl: jo(hivasok), most: 1792000600, ext: 'b'.repeat(64) });
    assert.equal(r.allapot, 'elkuldve');
    assert.deepEqual(Object.keys(hivasok[0].torzs.data[0].user_data).sort(), ['client_user_agent', 'external_id']);
  });

  test('azonosito nelkul -> kihagyva:nincs_azonosito naplozva (payload nelkul), kesobbi sikeres kuldes felulirja', async () => {
    const db = await ELES();
    const hivasok = [];
    const r1 = await metaArnyekLepes(db, SOR0, UA, { META_CAPI_TOKEN: 'tok' }, 'www.medicalpiercing.hu', { fetchImpl: jo(hivasok), most: 1792000600 });
    assert.equal(r1.kihagyva, 'nincs_azonosito');
    assert.equal(hivasok.length, 0);
    let n = db.raw.prepare('SELECT * FROM mp_meta_arnyek').all();
    assert.equal(n.length, 1); assert.equal(n[0].allapot, 'kihagyva:nincs_azonosito'); assert.equal(n[0].valasz, null); assert.equal(n[0].mod, 'eles');
    // ujabb kihagyas mas okkal: az ok frissul
    await metaArnyekLepes(db, SOR0, '', { META_CAPI_TOKEN: 'tok' }, 'www.medicalpiercing.hu', { fetchImpl: jo(hivasok), most: 1792000650 });
    assert.equal(db.raw.prepare('SELECT allapot FROM mp_meta_arnyek').get().allapot, 'kihagyva:nincs_ua');
    // ugyanaz a kulcs kesobb IP-vel: kimegy, a kihagyva-sor felulirodik
    const r2 = await metaArnyekLepes(db, SOR0, UA, { META_CAPI_TOKEN: 'tok' }, 'www.medicalpiercing.hu', { fetchImpl: jo(hivasok), most: 1792000700, ip: '84.1.2.3' });
    assert.equal(r2.allapot, 'elkuldve');
    n = db.raw.prepare('SELECT * FROM mp_meta_arnyek').all();
    assert.equal(n.length, 1); assert.equal(n[0].allapot, 'elkuldve'); assert.equal(n[0].ido, 1792000700);
    // elkuldott sort a kihagyas mar nem irja felul, es ujra sem kuld
    const r3 = await metaArnyekLepes(db, SOR0, '', { META_CAPI_TOKEN: 'tok' }, 'www.medicalpiercing.hu', { fetchImpl: jo(hivasok), most: 1792000800 });
    assert.equal(r3.kihagyva, 'mar_rogzitve');
    assert.equal(db.raw.prepare('SELECT allapot FROM mp_meta_arnyek').get().allapot, 'elkuldve');
    assert.equal(hivasok.length, 1);
  });

  test('hozzajarulas nelkul: nem kuld, kihagyva:nincs_hozzajarulas; elonezet / ki mod: nincs naplosor', async () => {
    const db = await ELES();
    let hivas = 0;
    const r = await metaArnyekLepes(db, { ...sor, hozzajarulas_hirdetes: 0 }, UA, { META_CAPI_TOKEN: 'tok' }, 'www.medicalpiercing.hu', { fetchImpl: async () => { hivas++; }, most: 1792000600, ip: '84.1.2.3' });
    assert.equal(r.kihagyva, 'nincs_hozzajarulas'); assert.equal(hivas, 0);
    assert.equal(db.raw.prepare('SELECT allapot FROM mp_meta_arnyek').get().allapot, 'kihagyva:nincs_hozzajarulas');
    const db2 = d1();
    assert.equal((await metaArnyekLepes(db2, { ...sor, kornyezet: 'elonezet' }, UA, {}, '', { ip: '84.1.2.3' })).kihagyva, 'nem_eles');
    const db3 = d1(); db3.raw.exec("INSERT INTO mp_beallitas VALUES ('meta_arnyek_mod','ki')");
    assert.equal((await metaArnyekLepes(db3, SOR0, UA, {}, '', {})).kihagyva, 'ki');
    assert.equal(db3.raw.prepare('SELECT count(*) n FROM mp_meta_arnyek').get().n, 0);
  });
}
