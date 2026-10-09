// Kozos segedek az API-tesztekhez (a fajl neve .test.mjs, hogy a megengedett utvonal-mintaba essen; a node --test egy trivialis tesztet futtat benne).
// Valodi levelkuldes SOHA: a kuldo (env.CRM_KULDO) injektalt, a levelek a `kuldott` tombbe kerulnek. Kulso halozat nincs.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ujTeszt, BASE } from './fixtures.js';
import { api } from '../lib/api.js';
import { sha256 } from '../lib/db.js';
import { csrfTokenSessionbol } from '../lib/http.js';
import { fontokNodeBol } from '../lib/pdf.js';

export const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const HOST = 'https://crm.preview.test';
export const NULLA_ID = '00000000-0000-4000-8000-000000000001';
let fontok = null;

/** teljes API-kornyezet: DB + munkatarsak (fixtures) + env + hivo fuggvenyek */
export async function ujApi({ env: extraEnv = {}, host = HOST } = {}) {
  const t = await ujTeszt();
  t.ido = BASE + 3600;
  const kuldott = [];
  fontok ||= await fontokNodeBol(GYOKER);
  const env = {
    CRM_DB: t.db, CRM_TAROLO: t.tarolo, CRM_FONTOK: fontok, CRM_IDO: () => t.ido, CRM_KULDO: async (u) => { kuldott.push(u); }, CRM_TITOK: 'teszt-titok-teszt-titok-1234',
    CRM_KULCS_HASH: await sha256('gepi-kulcs'), CRM_SO: 'teszt', ...extraEnv,
  };
  const x = { t, db: t.db, staff: t.staff, env, kuldott, host, ido: (mp) => { t.ido += mp; return t.ido; } };

  /** munkamenet kozvetlenul a DB-be (a belepes-folyamatot az auth.test.mjs vizsgalja) */
  x.munkamenet = async (staffId) => {
    const token = `teszt-token-${Math.random().toString(36).slice(2)}-${staffId}`.slice(0, 80);
    await t.db.prepare('INSERT INTO session (id, token_hash, staff_id, created_at, expires_at, last_seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?4)').bind(crypto.randomUUID(), await sha256(token), staffId, t.ido, t.ido + 12 * 3600).run();
    return { token, csrf: await csrfTokenSessionbol(token) };
  };

  /** API-hivas. opciok: { m: munkamenet, body (objektum -> JSON), nyers (bajtok), tipus, fejlecek, csrf: false (nincs CSRF), ip, host, ctx } */
  x.hivas = async (metodus, ut, o = {}) => {
    const fejlecek = new Headers({ 'cf-connecting-ip': o.ip || '203.0.113.7', ...(o.fejlecek || {}) });
    if (o.m) {
      fejlecek.set('cookie', `crm_sess=${o.m.token}`);
      if (o.csrf !== false && !['GET', 'HEAD'].includes(metodus)) fejlecek.set('x-crm-csrf', typeof o.csrf === 'string' ? o.csrf : o.m.csrf);
    }
    let body;
    if (o.nyers !== undefined) { body = o.nyers; fejlecek.set('content-type', o.tipus || 'application/octet-stream'); }
    else if (o.urlap) { body = new URLSearchParams(o.urlap).toString(); fejlecek.set('content-type', 'application/x-www-form-urlencoded'); }
    else if (o.body !== undefined) { body = typeof o.body === 'string' ? o.body : JSON.stringify(o.body); fejlecek.set('content-type', o.tipus || 'application/json'); }
    const keres = new Request(`${o.host || host}${ut.startsWith('/api/') ? ut : `/api/crm${ut}`}`, { method: metodus, headers: fejlecek, body });
    const v = await api(keres, o.env || env, o.ctx || {});
    const bajtok = new Uint8Array(await v.arrayBuffer());
    return {
      status: v.status, headers: v.headers, bajtok, get text() { return new TextDecoder().decode(bajtok); }, get json() { return JSON.parse(new TextDecoder().decode(bajtok)); },
      sutik: v.headers.getSetCookie?.() || [],
    };
  };
  x.get = (ut, m, o = {}) => x.hivas('GET', ut, { m, ...o });
  x.post = (ut, m, body, o = {}) => x.hivas('POST', ut, { m, body, ...o });
  x.session = {};
  for (const [nev, id] of Object.entries(t.staff)) x.session[nev] = await x.munkamenet(id);
  return x;
}

export const auditSor = async (db, felt, ...p) => (await db.prepare(`SELECT * FROM security_audit WHERE ${felt} ORDER BY at, rowid`).bind(...p).all()).results;

test('api-kozos: a segedek mukodnek (401 belepes nelkul, 200 a /auth/en belepve)', async () => {
  const x = await ujApi();
  assert.equal((await x.get('/auth/en')).status, 401);
  const v = await x.get('/auth/en', x.session.terapeuta);
  assert.equal(v.status, 200);
  assert.deepEqual(v.json.felhasznalo.szerepek, ['therapist']);
  assert.equal(v.json.csrf, x.session.terapeuta.csrf);
});
