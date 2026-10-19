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
  assert.equal(arnyekJogosult({ ...sor, meta_fbc: null, meta_fbp: null }, UA).miert, 'nincs_meta_azonosito');
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
