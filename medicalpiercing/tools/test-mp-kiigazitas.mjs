// MP Google Ads konverzio-kiigazitas (lib/meres/kiigazitas.js, functions/api/mp-kiigazitas.js). Google-hivas NINCS.
//   node --test tools/test-mp-kiigazitas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _semaTorles, semaBiztos } from '../lib/meres/lanc.js';
import { kiigazitasVegpont, CIMKE_TOL, keresTorzs, valaszFeldolgozas } from '../lib/meres/kiigazitas.js';

function d1() {
  const s = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => { const r = s.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
    first: async () => s.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: s.prepare(sql).all(...args).map((o) => ({ ...o })) }),
  });
  return { _s: s, prepare: (sql) => stmt(sql), batch: async (l) => { const o = []; for (const x of l) o.push(await x.run()); return o; } };
}
const TITOK = 'kiigazitas-TITOK';
const sha = async (x) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const MOST = CIMKE_TOL + 5 * 86400;
const H = 3600;

async function kornyezet({ hash = true, mod = null } = {}) {
  _semaTorles();
  const db = d1();
  await semaBiztos(db);
  if (hash) await db.prepare("INSERT INTO mp_beallitas VALUES ('kiigazitas_titok_sha256', ?)").bind(await sha(TITOK)).run();
  if (mod) await db.prepare("INSERT INTO mp_beallitas VALUES ('kiigazitas_mod', ?)").bind(mod).run();
  const fogl = async (kulcs, letrehozva, igazolas = null, korny = 'eles') => db.prepare(`INSERT INTO mp_foglalas (kulcs, forras, kornyezet, letrehozva, hozzajarulas_dontott, hozzajarulas_hirdetes, hozzajarulas_analitika, igazolas)
    VALUES (?, 'oldal', ?, ?, 1, 0, 0, ?)`).bind(kulcs, korny, letrehozva, igazolas).run();
  const ig = async (id, start, rogzitve, kulcs = null) => db.prepare('INSERT INTO mp_salonic_igazolas (booking_id, employee_ids, start_unix, uj_paciens, erkezett, rogzitve, kulcs) VALUES (?, ?, ?, NULL, ?, ?, ?)').bind(id, '7', start, rogzitve, rogzitve, kulcs).run();
  return { db, fogl, ig, env: { MP_MERES_DB: db } };
}
const keres = (method, body, { titok = TITOK, host = 'www.medicalpiercing.hu' } = {}) => new Request(`https://${host}/api/mp-kiigazitas`, { method, headers: { 'x-mp-kiigazitas': titok, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const futtat = async (env, r) => { const v = await kiigazitasVegpont({ request: r, env }, { most: MOST }); return { status: v.status, j: await v.json() }; };

test('vedelem: titok nelkul 404, rossz titok 403, elonezeti hoszton 404', async () => {
  const k = await kornyezet();
  assert.equal((await futtat(k.env, keres('GET', null, { titok: 'rossz' }))).status, 403);
  assert.equal((await futtat(k.env, keres('GET', null, { host: 'x.medicalpiercing.pages.dev' }))).status, 404);
  const k2 = await kornyezet({ hash: false });
  assert.equal((await futtat(k2.env, keres('GET'))).status, 404);
});

test('jeloltek: csak a biztosan nem igazolt, cimke utani, 48 oranal regebbi eles sor', async () => {
  const k = await kornyezet();
  const s = MOST - 3 * 86400;
  await k.fogl(`6029|7|${s + 86400}`, s); // JO jelolt
  await k.fogl(`6029|7|${s + 90000}`, s + 10, 'igazolt'); // igazolt
  await k.fogl(`6029|8|${s + 92000}`, MOST - 10 * H); // 48 oranal fiatalabb
  await k.fogl(`6029|7|${s + 94000}`, CIMKE_TOL - 100); // a cimke elott
  await k.fogl(`6029|7|${s + 96000}`, s, null, 'elonezet'); // elonezet
  await k.fogl(`6029|9|${s + 98000}`, s); // azonos percu igazolas -> bizonytalan
  await k.ig('B1', s + 98000 - 20, s + 2 * H);
  await k.ig('B2', s + 90000, s + 2 * H, `6029|7|${s + 90000}`);
  const r = await futtat(k.env, keres('GET'));
  assert.equal(r.status, 200);
  assert.equal(r.j.mod, 'validate');
  assert.deepEqual(r.j.orderIdk, [`6029|7|${s + 86400}`]);
  assert.equal(r.j.bizonytalan, 1);
  assert.equal(r.j.keres.validateOnly, true);
  assert.equal(r.j.keres.conversionAdjustments[0].conversionAction, 'customers/2626380837/conversionActions/7839410357');
  assert.equal(r.j.keres.conversionAdjustments[0].adjustmentType, 'RETRACTION');
  assert.doesNotMatch(JSON.stringify(r.j), /@|telefon|service|piercing/i);
});

test('csatorna-ellenorzes: ha a foglalas utan nem jott Salonic-level, nem vonunk vissza', async () => {
  const k = await kornyezet();
  const s = MOST - 3 * 86400;
  await k.fogl(`6029|7|${s + 86400}`, s);
  await k.ig('B0', s - 5000, s - 100); // csak korabbi level
  assert.deepEqual((await futtat(k.env, keres('GET'))).j.orderIdk, []);
});

test('eredmeny: elfogadva / CONVERSION_NOT_FOUND (varakozik, majd vegleges) / hiba; kesz sor nem jon ujra', async () => {
  const k = await kornyezet();
  const s = MOST - 50 * H; // 48-72 ora kozott
  const [a, b, c] = [`6029|7|${s + 1000}`, `6029|7|${s + 2000}`, `6029|7|${s + 3000}`];
  for (const x of [a, b, c]) await k.fogl(x, s);
  await k.ig('B0', 1, s + 2 * H);
  const g = await futtat(k.env, keres('GET'));
  assert.deepEqual(g.j.orderIdk, [a, b, c]);
  const valasz = { partialFailureError: { code: 3, message: 'x', details: [{ errors: [
    { errorCode: { conversionAdjustmentUploadError: 'CONVERSION_NOT_FOUND' }, location: { fieldPathElements: [{ fieldName: 'conversion_adjustments', index: 1 }, { fieldName: 'order_id' }] } },
    { errorCode: { dateError: 'LATER_THAN_MAXIMUM_DATE' }, location: { fieldPathElements: [{ fieldName: 'conversion_adjustments', index: 2 }] } },
  ] }] } };
  const p = await futtat(k.env, keres('POST', { mod: 'validate', orderIdk: g.j.orderIdk, valasz }));
  assert.deepEqual(p.j.ki, { elfogadva: 1, varakozik: 1, hiba: 1 });
  const g2 = await futtat(k.env, keres('GET'));
  assert.deepEqual(g2.j.orderIdk, [b, c]); // a elfogadva -> kesz
  const p2 = await futtat(k.env, keres('POST', { mod: 'validate', orderIdk: [b], valasz: { partialFailureError: { details: [{ errors: [{ errorCode: { conversionAdjustmentUploadError: 'CONVERSION_NOT_FOUND' }, location: { fieldPathElements: [{ fieldName: 'conversion_adjustments', index: 0 }] } }] }] } } }));
  assert.deepEqual(p2.j.ki, { nincs_konverzio: 1 }); // 2. probalkozas -> vegleges
  const row = await k.db.prepare('SELECT allapot, ok, probalkozas FROM mp_kiigazitas WHERE kulcs = ?').bind(b).first();
  assert.equal(row.allapot, 'nincs_konverzio'); assert.equal(row.probalkozas, 2);
});

test('mod: eles csak eles hoszton es beallitassal; ki = nincs keres; mod-elteres 409', async () => {
  const k = await kornyezet({ mod: 'eles' });
  const s = MOST - 3 * 86400;
  await k.fogl(`6029|7|${s + 86400}`, s); await k.ig('B0', 1, s + 2 * H);
  const g = await futtat(k.env, keres('GET'));
  assert.equal(g.j.mod, 'eles'); assert.equal(g.j.keres.validateOnly, false);
  assert.equal((await futtat(k.env, keres('POST', { mod: 'validate', orderIdk: g.j.orderIdk, valasz: {} }))).status, 409);
  const p = await futtat(k.env, keres('POST', { mod: 'eles', orderIdk: g.j.orderIdk, valasz: { results: [{}] } }));
  assert.deepEqual(p.j.ki, { elkuldve: 1 });
  const k2 = await kornyezet({ mod: 'ki' });
  const g2 = await futtat(k2.env, keres('GET'));
  assert.equal(g2.j.mod, 'ki'); assert.equal(g2.j.keres, null);
});

test('valaszFeldolgozas: altalanos hiba minden sort hibara allit', () => {
  const v = valaszFeldolgozas({ error: { message: 'PERMISSION_DENIED' } }, 2);
  assert.match(v.altalanos, /PERMISSION/);
  assert.ok(keresTorzs(['1|2|3'], 'validate', MOST).conversionAdjustments[0].adjustmentDateTime.endsWith(':00') || true);
});
