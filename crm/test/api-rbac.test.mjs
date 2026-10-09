// RBAC-matrix vegpontonkent: MINDEN session-es vegponthoz van egy tiltott szerepkor (403 + audit 'denied'), belepes nelkul 401, CSRF nelkul 403.
// A tabla teljessegét a teszt maga ellenorzi: egy uj vegpont tiltott-szerepkor bejegyzes nelkul megbuktatja a tesztet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ujApi, auditSor, NULLA_ID } from './api-kozos.test.mjs';
import { VEGPONTOK } from '../lib/api.js';

// "<metodus> <minta>": a tiltott szerepkor (fixtures.staff kulcsa) - a szerepkorok a crm/lib/rbac.js MATRIX-bol kovetkeznek
const TILTOTT = {
  'GET /dashboard': 'marketing',
  'GET /vendegek': 'marketing',
  'GET /vendegek/:id': 'marketing',
  'POST /vendegek/:id/email': 'vezeto',
  'GET /osszevonas': 'recepcio',
  'POST /osszevonas/:id/jovahagy': 'recepcio',
  'POST /osszevonas/:id/elutasit': 'recepcio',
  'POST /osszevonas-audit/:id/visszafordit': 'recepcio',
  'GET /munkalista': 'marketing',
  'POST /foglalasok/:id/completed': 'recepcio',
  'POST /foglalasok/:id/no-show': 'recepcio',
  'GET /vendegek/:id/berletek': 'marketing',
  'POST /berletek': 'terapeuta',
  'POST /berletek/:id/hosszabbit': 'recepcio',
  'POST /berletek/:id/refund': 'recepcio',
  'POST /berletek/:id/korrekcio': 'recepcio',
  'POST /ajandekok/:id/atad': 'terapeuta',
  'POST /ajandekok/:id/visszavesz': 'terapeuta',
  'GET /vendegek/:id/credit': 'marketing',
  'POST /credit/:id/levonas': 'vezeto',
  'GET /vendegek/:id/hozzajarulasok': 'vezeto',
  'POST /vendegek/:id/hozzajarulasok': 'terapeuta',
  'GET /panaszok': 'recepcio',
  'POST /vendegek/:id/panaszok': 'recepcio',
  'POST /panaszok/:id/probalkozas': 'recepcio',
  'POST /panaszok/:id/lezar': 'recepcio',
  'POST /panaszok/:id/felelos': 'terapeuta',
  'POST /panaszok/:id/kompenzacio': 'recepcio',
  'POST /kompenzaciok/:id/dontes': 'terapeuta',
  'GET /elegedettseg': 'recepcio',
  'GET /felmero/verziok': 'terapeuta',
  'POST /felmero/verziok': 'terapeuta',
  'POST /felmero/verziok/:id/jovahagy': 'terapeuta',
  'POST /foglalasok/:id/felmero-kiad': 'recepcio',
  'GET /foglalasok/:id/felmero': 'recepcio',
  'POST /felmero/:id/attekint': 'recepcio',
  'GET /kezelesek/:sessionId/terv': 'recepcio',
  'PUT /kezelesek/:sessionId/terv': 'recepcio',
  'POST /tervek/:id/veglegesit': 'recepcio',
  'GET /tervek/:id/a5.pdf': 'recepcio',
  'POST /tervek/:id/kuld': 'recepcio',
  'POST /kurak/:id/kurazaro': 'recepcio',
  'GET /dokumentumok/hianyzo': 'recepcio',
  'POST /kezelesek/:sessionId/kepek': 'recepcio',
  'GET /kepek/:id': 'recepcio',
  'POST /osszehasonlitas': 'recepcio',
  'POST /osszehasonlitas/:id/veglegesit': 'recepcio',
  'POST /osszehasonlitas/:id/link': 'recepcio',
  'GET /uzenetek/sablonok': 'vezeto',
  'POST /uzenetek/elonezet': 'vezeto',
  'GET /uzenetek/jobok': 'vezeto',
  'POST /uzenetek/jobok/:id/ujra': 'terapeuta',
  'POST /uzenetek/sandbox-proba': 'terapeuta',
  'GET /uzenetek/uzemmod': 'vezeto',
  'GET /merok': 'recepcio',
  'GET /beallitasok': 'terapeuta',
  'PUT /beallitasok/:kulcs': 'terapeuta',
  'GET /munkatarsak': 'vezeto',
  'POST /munkatarsak': 'vezeto',
  'PATCH /munkatarsak/:id': 'vezeto',
  'GET /audit': 'terapeuta',
  'GET /audit/export.csv': 'vezeto',
  'GET /salonic-allapot': 'recepcio',
};
const sessionVegpontok = VEGPONTOK.filter((v) => v.auth === 'session');
const utvonal = (minta) => minta.replace(/:kulcs/g, 'valami').replace(/:[a-zA-Z_]+/g, NULLA_ID);
const kulcs = (v) => `${v.metodus} ${v.minta}`;

test('RBAC a tiltott-szerepkor tabla teljes: minden session-vegponthoz van bejegyzes, es nincs arva bejegyzes', () => {
  const vegpontok = new Set(sessionVegpontok.map(kulcs));
  assert.deepEqual([...vegpontok].filter((k) => !(k in TILTOTT)), [], 'ezekhez a vegpontokhoz nincs tiltott szerepkor a matrixban');
  assert.deepEqual(Object.keys(TILTOTT).filter((k) => !vegpontok.has(k)), [], 'ezek a bejegyzesek nem letezo vegpontra mutatnak');
  assert.ok(sessionVegpontok.length >= 60);
  // a nyilvanos / gepi / belepesi vegpontok nincsenek a session-listan
  assert.ok(VEGPONTOK.filter((v) => v.auth !== 'session').every((v) => /^\/(auth|public|ingest|tick)/.test(v.minta)));
});

test('RBAC minden session-vegpont: belepes nelkul 401, tiltott szerepkorrel 403 + denied audit (a jogosultsag az azonosito letezese ELOTT dol el)', async () => {
  const x = await ujApi();
  for (const v of sessionVegpontok) {
    const ut = utvonal(v.minta);
    const iro = v.metodus !== 'GET';
    // 1) belepes nelkul
    const nincsBelepve = await x.hivas(v.metodus, ut, { body: iro ? {} : undefined });
    assert.equal(nincsBelepve.status, 401, `${kulcs(v)} belepes nelkul`);
    // 2) tiltott szerepkor (letezo session, helyes CSRF)
    const szerep = TILTOTT[kulcs(v)];
    const elotte = (await auditSor(x.db, "result = 'denied' AND staff_id = ?1", x.staff[szerep])).length;
    const tiltott = await x.hivas(v.metodus, ut, { m: x.session[szerep], body: iro ? {} : undefined });
    assert.equal(tiltott.status, 403, `${kulcs(v)} a(z) ${szerep} szerepkorrel: ${tiltott.text.slice(0, 120)}`);
    assert.equal(tiltott.json.hiba.kod, 'TILTOTT');
    const utana = (await auditSor(x.db, "result = 'denied' AND staff_id = ?1", x.staff[szerep])).length;
    assert.ok(utana > elotte, `${kulcs(v)} elutasitasa naplozatlan`);
    // a 403 nem arul el a vegpont belsejerol (nincs azonosito / tabla / SQL a hibaszovegben)
    assert.ok(!/SELECT|INSERT|sqlite|camera_image|storage/i.test(tiltott.text), kulcs(v));
  }
});

test('RBAC minden irasi vegpont CSRF-token nelkul / hamis tokennel 403 (jogosult szerepkorral is)', async () => {
  const x = await ujApi();
  // a jogosult szerep: az, amelyik NEM a tiltott; a legtobbhoz az admin/terapeuta kombinacio, itt az egyszeruseg kedveert minden szerepkorrel probalunk
  const szerepek = ['terapeuta', 'janka', 'recepcio', 'vezeto', 'admin', 'marketing'];
  for (const v of sessionVegpontok.filter((s) => s.metodus !== 'GET')) {
    const ut = utvonal(v.minta);
    const jogosult = szerepek.find((s) => s !== TILTOTT[kulcs(v)]);
    for (const csrf of [false, 'hamis-token', 'a'.repeat(64)]) {
      const r = await x.hivas(v.metodus, ut, { m: x.session[jogosult], body: {}, csrf });
      assert.equal(r.status, 403, `${kulcs(v)} csrf=${csrf}`);
      assert.equal(r.json.hiba.kod, 'CSRF', `${kulcs(v)} csrf=${csrf}`);
    }
  }
});

test('RBAC a jogosult szerepkorok nem kapnak 403-at (a matrix pozitiv oldala): minden vegponthoz van legalabb egy szerepkor, amely tovabbjut a jogosultsagon', async () => {
  const x = await ujApi();
  const szerepek = ['terapeuta', 'janka', 'recepcio', 'vezeto', 'admin', 'marketing'];
  for (const v of sessionVegpontok) {
    const ut = utvonal(v.minta);
    const iro = v.metodus !== 'GET';
    const engedett = [];
    for (const sz of szerepek) {
      const r = await x.hivas(v.metodus, ut, { m: x.session[sz], body: iro ? {} : undefined });
      if (r.status !== 403) engedett.push(sz);
    }
    assert.ok(engedett.length >= 1, `${kulcs(v)}: senki sem hasznalhatja`);
    assert.ok(!engedett.includes(TILTOTT[kulcs(v)]), `${kulcs(v)}`);
  }
});
