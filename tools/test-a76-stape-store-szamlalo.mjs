import test from 'node:test';
import assert from 'node:assert/strict';
import { futtat, osszesit, biztonsagosToken, idoMasodperc, budapestiNap, JELOLTEK } from './a76-stape-store-szamlalo.mjs';

const MA = Date.parse('2026-10-23T10:00:00Z');
const s = (iso) => Math.floor(Date.parse(iso) / 1000);
const DOCS = [
  { id: 'x1', data: { timestamp: s('2026-10-23T08:00:00Z'), event_name: 'schedule_view', consent_state: 'granted', a76_src: 'google', client_id: '1234567890.1234567890', page_location: 'https://a76.hu/?email=teszt@pelda.hu', a76_sched_ok: 'true' } },
  { id: 'x2', data: { timestamp: s('2026-10-23T09:00:00Z'), event_name: 'schedule_view', consent_state: 'denied', client_id: '9999999999.1111111111', a76_nav: 'tel:+36301234567' } },
  { id: 'x3', data: { timestamp: s('2026-10-22T09:00:00Z') * 1000, event_name: 'foglalas', consent_state: 'granted', a76_src: '' } },
  { id: 'x4', data: { timestamp: s('2026-09-01T09:00:00Z'), event_name: 'regi' } },
  { id: 'x5', data: { event_name: 'idotlen' } },
];

function szerver(hibasUt) {
  const kerelmek = [];
  const f = async (u, o) => {
    kerelmek.push({ u, m: o.method });
    const ok = !hibasUt && o.method === 'POST' && /\/documents\/filter$/.test(new URL(u).pathname);
    if (!ok) return { status: 404, json: async () => ({ success: false }) };
    const b = JSON.parse(o.body);
    const cursor = b.cursor;
    if (!cursor) return { status: 200, json: async () => ({ success: true, data: { documents: DOCS.slice(0, 2), pagination: { next_cursor: 'c2' } } }) };
    return { status: 200, json: async () => ({ success: true, data: { documents: DOCS.slice(2), pagination: {} } }) };
  };
  return { f, kerelmek };
}

test('osszesites: napi db, zart bontas, nincs vendegadat', () => {
  const o = osszesit(DOCS, s('2026-10-16T10:00:00Z'));
  assert.equal(o.idoNelkul, 1);
  assert.equal(o.nap['2026-10-23'].db, 2);
  assert.equal(o.nap['2026-10-22'].db, 1);
  assert.equal(o.nap['2026-09-01'], undefined);
  assert.deepEqual(o.nap['2026-10-23'].bontas.consent_state, { granted: 1, denied: 1 });
  assert.deepEqual(o.nap['2026-10-23'].a76_src, { van: 1, nincs: 1 });
  const ki = JSON.stringify(o);
  for (const tilos of ['1234567890', '9999999999', 'teszt@pelda.hu', '+36301234567', 'https://', 'x1']) assert.ok(!ki.includes(tilos), tilos);
  assert.equal(o.nap['2026-10-23'].bontas.a76_nav['(egyeb)'], 1);
});

test('token: szamjegy-gazdag vagy hosszu ertek nem megy ki', () => {
  assert.equal(biztonsagosToken('granted'), 'granted');
  assert.equal(biztonsagosToken('a76_12345'), '(egyeb)');
  assert.equal(biztonsagosToken('x@y.hu'), '(egyeb)');
  assert.equal(biztonsagosToken(''), '(nincs)');
  assert.equal(biztonsagosToken(undefined), '(nincs)');
});

test('ido: masodperc, ezredmasodperc, ISO; budapesti nap', () => {
  assert.equal(idoMasodperc({ timestamp: 1700000000000 }), 1700000000);
  assert.equal(idoMasodperc({ data: { timestamp: '2026-10-22T22:30:00Z' } }), s('2026-10-22T22:30:00Z'));
  assert.equal(budapestiNap(s('2026-10-22T22:30:00Z')), '2026-10-23');
  assert.equal(idoMasodperc({}), null);
});

test('futtatas: megtalalja a vegpontot, lapoz, a kulcs nem kerul a kimenetre', async () => {
  const { f, kerelmek } = szerver(false);
  const kulcs = 'TITKOSKULCS-ABC123';
  const sorok = [];
  const k = await futtat({ f, domain: 'https://stape.a76.hu', kulcs, nap: 7, ma: MA, log: (x) => sorok.push(x), gyujtemenyek: ['a76_schedule_log'] });
  const g = k.gyujtemenyek.a76_schedule_log;
  assert.equal(g.vegpont, 'POST /collections/{c}/documents/filter');
  assert.equal(g.beolvasott_dokumentum, 5);
  assert.equal(g.napok['2026-10-23'].db, 2);
  assert.ok(kerelmek.every((r) => r.u.startsWith(`https://stape.a76.hu/stape-api/${kulcs}/v2/store/`)));
  assert.ok(!sorok.join('\n').includes(kulcs));
});

test('probe: csak statuszok, mezonevek es tipusok, ertek nincs', async () => {
  const { f } = szerver(false);
  const sorok = [];
  const k = await futtat({ f, domain: 'https://stape.a76.hu', kulcs: 'K', probe: true, ma: MA, log: (x) => sorok.push(x), gyujtemenyek: ['a76_foglalas_forras'] });
  const g = k.gyujtemenyek.a76_foglalas_forras;
  assert.equal(g.proba.length, JELOLTEK.length);
  assert.equal(g.mezok.client_id, 'string');
  const ki = sorok.join('\n');
  assert.ok(!ki.includes('1234567890') && !ki.includes('teszt@pelda.hu'));
});

test('nincs mukodo vegpont: ertelmes hiba, nincs kivetel', async () => {
  const { f } = szerver(true);
  const k = await futtat({ f, domain: 'https://stape.a76.hu', kulcs: 'K', ma: MA, log: () => {}, gyujtemenyek: ['a76_schedule_log'] });
  assert.equal(k.gyujtemenyek.a76_schedule_log.hiba, 'nincs mukodo lista-vegpont');
});

test('hianyzo kulcs: hiba', async () => {
  await assert.rejects(() => futtat({ f: async () => ({}), domain: 'https://x', kulcs: '' }), /STAPE_A76_CONTAINER_KEY/);
});
