// Kozos teszt-segedek a Salonic-direct (DECISION #127 (b)) tesztjeihez: valodi SQLite (node:sqlite) D1-hejjal, a Salonic mentett oldalaival es hamis platform-halozattal.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { kezelEgyeztetes } from '../netlify/lib/foglalas-kulcs.js';
import { foglalasEsemenyKuldes } from '../netlify/lib/meres/foglalas-esemeny.js';
import { sdKezel, vendegIndexIr, sdRiasztasok, sdKapcsoloBeallit } from '../netlify/lib/meres/salonic-direct.js';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const fx = (f) => fs.readFileSync(path.join(here, 'fixtures', 'salonic', f), 'utf8');
export const KULCS_SZOVEG = 'teszt-olvaso-kulcs';
export const FIX_UUID = '3f10fabc-4f7d-9257-2088-cfe7b5b24a2e'; // a mentett oldalak UUID-ja (hair)
export const T0 = Date.UTC(2026, 9, 6, 13, 36, 32); // a letrehozo level erkezese (2026-10-06 13:36:32Z)
export const VENDEG = Object.freeze({ email: 'teszt.claude@example.com', telefon: '+36 30 000 0001' });
export const NEV = 'Teszt Claude';
export const SIKER = { meta: { events_received: 1, fbtrace_id: 'x' }, tiktok: { code: 0, message: 'OK' }, google: { results: [{}] }, ga4: {} };

export function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
export const ENV_ALAP = Object.freeze({ META_TESZT_KOD: 'TEST12345', TIKTOK_TESZT_KOD: 'TEST67890', GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001', MERES_ELOSZTO: '1', META_CAPI_TOKEN: 't', TIKTOK_EVENTS_TOKEN: 't', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/teszt/', GA4_TESZT_API_SECRET: 't' });
export const SD_ENV = Object.freeze({ MERES_SALONIC_DIRECT: '1', MERES_SD_NS: 'smoke', SD_HMAC_KEY_V1: 'sd-teszt-kulcs-0123456789abcdef', GUEST_HMAC_KEY_V1: 'guest-teszt-kulcs-0123456789ab' });

/** A Salonic (mentett valodi oldalak, az UUID-t cserelve) es a platformok egy hamis halozaton. allapot: uuid -> 'aktiv' (alap) | 'torolve' | 'hiba' | [az egymas utani lekeresek allapota]. */
export function halozat() {
  const allapot = new Map(); const hivasok = []; const salonic = [];
  const f = async (url, o = {}) => {
    const u = String(url); let m;
    if (u.includes('/debug/mp/collect')) return { status: 200, text: async () => JSON.stringify({ validationMessages: [] }) };
    if ((m = u.match(/\/booking\/bookingDetails\/([0-9a-f-]{36})/))) {
      salonic.push(m[1]);
      const a0 = allapot.get(m[1]); const a = Array.isArray(a0) ? (a0.length > 1 ? a0.shift() : a0[0]) : (a0 || 'aktiv'); // tomb: az n-edik lekeres allapota (az utolso ismetlodik)
      if (a === 'hiba') return { ok: false, status: 500, url: u, text: async () => '' };
      const szoveg = a === 'torolve' ? fx('kulcs-torolve-hu.html') : fx('kulcs-bookingDetails-hair.html').replaceAll(FIX_UUID, m[1]);
      return { ok: true, status: 200, url: u, text: async () => szoveg };
    }
    if (u.includes('/selectDate/') && (m = u.match(/bookingId=([0-9a-f-]{36})/))) return { ok: true, status: 200, url: u, text: async () => fx('kulcs-selectDate-modositas-hair.html').replaceAll(FIX_UUID, m[1]) };
    const kulcs = ['meta', 'tiktok', 'google', 'ga4'][['graph.facebook.com', 'business-api.tiktok.com', 'hooks.zapier.com', 'google-analytics.com'].findIndex((h) => u.includes(h))];
    if (!kulcs) return { ok: false, status: 404, url: u, text: async () => '' };
    hivasok.push({ kulcs, url: u, body: JSON.parse(o.body) });
    return { status: 200, text: async () => JSON.stringify(SIKER[kulcs]) };
  };
  return { f, hivasok, allapot, salonic };
}
export const ora = (t0 = T0 + 5000) => { let t = t0; const f = () => t; f.set = (ms) => { t = ms; }; f.tick = (mp) => { t += mp * 1000; }; return f; };
let szamlalo = 0;
export const ujUuid = () => `aaaaaaaa-0000-4000-8000-${String(++szamlalo).padStart(12, '0')}`;

/** Egy teszt-vilag: SQLite, kornyezet, halozat, ora, kerelem-segedek. */
export function vilag({ env = {}, sd = true, kapcsolo = 'mind' } = {}) {
  const D = d1(); const net = halozat(); const t = ora();
  const e = { KULCS_DB: { prepare: D.prepare, batch: D.batch }, EGYEZTETES_KULCS_HASH: crypto.createHash('sha256').update(KULCS_SZOVEG).digest('hex'), ...ENV_ALAP, ...(sd ? SD_ENV : {}), ...env };
  const deps = (x = {}) => ({ fetchImpl: net.f, now: t, esemenyKuldo: foglalasEsemenyKuldes, sdKezelo: sdKezel, vendegIndexIr, sdRiasztasok, ...x });
  const ker = (body) => new Request('https://x.pages.dev/api/foglalas-egyeztetes', { method: 'POST', headers: { 'x-egyeztetes-kulcs': KULCS_SZOVEG }, body: JSON.stringify(body) });
  const post = async (body, x) => (await kezelEgyeztetes(ker(body), e, deps(x))).json();
  const get = async (q, x) => (await kezelEgyeztetes(new Request('https://x.pages.dev/api/foglalas-egyeztetes?kulcs=' + KULCS_SZOVEG + '&' + q), e, deps(x))).json();
  const v = { D, e, net, t, post, get, deps, ker,
    kapcsol: (uzletag = null, be = true) => sdKapcsoloBeallit(e.KULCS_DB, { uzletag, be, ok: 'teszt' }, t()),
    sd: (body) => post({ ...body, muvelet: 'sd_atvetel' }),
    sql: (q, ...a) => D.db.prepare(q).all(...a).map((r) => ({ ...r })),
    db: e.KULCS_DB };
  v.kesz = kapcsolo ? v.kapcsol(kapcsolo === 'mind' ? null : kapcsolo, true) : Promise.resolve();
  return v;
}
export const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
/** A Salonic szalon-ertesito (letrehozo level) a Zap-lepes szerinti mezoivel. */
export const level = (uuid, o = {}) => ({ uuid, host: 'mosaic-pmu.salonic.hu', felado: 'Mosaic PMU', szolgaltatas: 'Soft powder', idopont_szoveg: 'Október 20. (kedd) 16:00 - 17:00', munkatarsak: ['Teszt Mester'], ld: { startDate: '2026-10-20T16:00:00+02:00' }, level_datuma: iso(T0), vendeg: { ...VENDEG }, nev: NEV, uj_vendeg: false, megjegyzes: '', ...o });
/** A motoros parositas 4 probaja (0, +61, +181, +601 mp): a vegen "parositatlan" (nincs kulcs-iras); az ora a 4. proba idejen all. */
export async function lezar(v, body) {
  const ered = [];
  ered.push(await v.post(body));
  for (const mp of [61, 181, 601]) { v.t.tick(mp); ered.push(await v.post(body)); }
  return ered;
}
export const kuldesek = (v, uuid) => v.sql("SELECT esemeny_id, esemeny_nev, esemeny_tipus, platform, allapot, indok, ertek, penznem, forras, attr_minoseg, ertek_minoseg, salonic_uuid FROM meres_kuldes WHERE salonic_uuid = ?1 OR source_id LIKE 'sd\\_%' ESCAPE '\\' ORDER BY id".replace('?1', '?1'), String(uuid || '').toLowerCase());
