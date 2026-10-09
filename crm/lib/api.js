// CRM HTTP API router: (request, env, ctx) -> Response. Szerzodes: docs/oxigen-crm/API.md.
//
//  env: CRM_DB (D1) - kotelezo; CRM_TAROLO (fajltarolo, alap: d1Tarolo(CRM_DB)); ASSETS (betutipusok a PDF-hez); CRM_KULDO (injektalt kuldo fuggveny
//  {to, targy, html, szoveg}); CRM_ADMIN_EMAILS; CRM_DEMO ('1'); CRM_KULCS_HASH; CRM_TITOK (leiratkozasi link alairasa); CRM_KULDES (dry|eles); CRM_SO
//  (hash-so); CRM_IDO (teszt: () => epoch masodperc); CRM_DEV ('1': localhoston Secure nelkuli suti); CRM_FONTOK (teszt: betutipus-bajtok).
//
// Rendszer: minden vegpont a belso `utak` tablakbol jon (api-*.js reszmodulok). A jogosultsagot MINDEN vegponton a backend ellenorzi
// (rbac.megkoveteli), a hibak az API.md szerinti formaban mennek ki, a PII nem kerul naploba (csak ID-k).
import { CrmHiba, sha256 } from './db.js';
import { d1Tarolo } from './tarolo.js';
import { naplo } from './audit.js';
import { szerepek as szerepekBetolt, megkoveteli, lehet } from './rbac.js';
import { kuldokKeszit } from '../../netlify/lib/lifecycle/kuldok.js';
import * as auth from './auth.js';
import {
  ApiHiba, json, hibaValasz, fejlecRa, jsonTorzs, uuidE, cookieOlvas, cookieIr, ujCookieFejlec, SESSION_COOKIE, ipHashEnv, hosztok, elesHosztE, azonosEredet, IRO_METODUSOK,
  egyenlo, limitVagyHiba, csrfTokenSessionbol,
} from './http.js';
import { utak as vendegUtak } from './api-vendeg.js';
import { utak as klinikaiUtak } from './api-klinikai.js';
import { utak as adminUtak } from './api-admin.js';
import { utak as publikusUtak } from './api-public.js';

const ELOTAG = '/api/crm';

import { opcionalisModul, modulFuggveny } from './api-modulok.js';
export { opcionalisModul, modulFuggveny };

// ---- kuldo ---------------------------------------------------------------------------------------------------------------------------------
/** a munkatarsaknak szolo (belepesi kod) es a vendegnek szolo (ellenorzo link) kuldo; null = DRY (nincs kuldes) */
export function kuldokEnvbol(env) {
  if (typeof env.CRM_KULDO === 'function') return { munkatars: env.CRM_KULDO, vendeg: env.CRM_KULDO };
  if (!env.SMTP_PASS) return { munkatars: null, vendeg: null };
  const smtp = async (uzenet) => {
    const k = kuldokKeszit(env);
    try { await k.email({ to: uzenet.to, targy: uzenet.targy, html: uzenet.html, szoveg: uzenet.szoveg, felado: 'MOSAIC' }); } finally { await k.lezar(); }
  };
  return { munkatars: smtp, vendeg: env.CRM_KULDES === 'eles' ? smtp : null };   // vendegnek valodi level csak a tulajdonos GO-ja utan
}
export const demoMod = (env, request) => env.CRM_DEMO === '1' && !elesHosztE(request);

// ---- utvonal-minta -> regex ---------------------------------------------------------------------------------------------------------------
function fordit(metodus, minta, kezelo, opciok = {}) {
  const kulcsok = [];
  const re = new RegExp(`^${minta.replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === ':' ? m : `\\${m}`)).replace(/:([a-z_]+)/gi, (_, k) => { kulcsok.push(k); return '([^/]+)'; })}$`);
  return { metodus, re, kulcsok, kezelo, auth: opciok.auth || 'session', minta };
}

const authUtak = [
  ['POST', '/auth/kod-keres', async (c) => {
    const t = await c.torzs();
    const email = typeof t.email === 'string' ? t.email : '';
    const demo = demoMod(c.env, c.request);
    const kuldo = c.kuldok.munkatars;
    const e = await auth.kodKer(c.db, { email, ipHash: c.ipHash, env: c.env, kuldo, demo, now: c.now });
    if (e.kuldes) { if (typeof c.ctx.waitUntil === 'function') c.ctx.waitUntil(e.kuldes); else await e.kuldes; }
    return json(e.demoKod ? { ...e.valasz, demo_kod: e.demoKod } : e.valasz);
  }, { auth: 'belepes' }],
  ['POST', '/auth/kod-ellenoriz', async (c) => {
    const t = await c.torzs();
    const s = await auth.kodEllenoriz(c.db, { email: t.email, kod: t.kod, ipHash: c.ipHash, env: c.env, now: c.now });
    return belepVisszajelzes(c, s);
  }, { auth: 'belepes' }],
  ['POST', '/auth/demo', async (c) => {
    if (!demoMod(c.env, c.request)) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen elem.', 404);
    const t = await c.torzs();
    if (typeof t.szerep !== 'string') throw new ApiHiba('HIANYZO_MEZO', 'A szerep mező kötelező.', 422);
    await demoAdatBetolt(c);
    const s = await auth.demoBelep(c.db, { szerep: t.szerep, ipHash: c.ipHash, now: c.now });
    return belepVisszajelzes(c, s);
  }, { auth: 'belepes' }],
  ['GET', '/auth/en', async (c) => {
    if (!c.munkamenet) throw new ApiHiba('NINCS_BELEPVE', 'Nem vagy bejelentkezve.', 401);
    return json({ felhasznalo: await auth.felhasznalo(c.db, c.staffId), csrf: c.munkamenet.csrf });
  }, { auth: 'belepes' }],
  ['POST', '/auth/kilep', async (c) => {
    if (c.munkamenet) {
      if (!egyenlo(c.request.headers.get('x-crm-csrf'), c.munkamenet.csrf)) throw new ApiHiba('CSRF', 'Hiányzó vagy érvénytelen CSRF-token.', 403);
      await auth.kilep(c.db, c.sutiToken, { now: c.now, ipHash: c.ipHash });
    }
    const v = json({ ok: true });
    return ujCookieFejlec(v, cookieIr(SESSION_COOKIE, '', { maxAge: 0, biztonsagos: c.cookieBiztonsagos }));
  }, { auth: 'belepes' }],
];

function belepVisszajelzes(c, s) {
  const v = json({ csrf: s.csrf, felhasznalo: s.felhasznalo });
  return ujCookieFejlec(v, cookieIr(SESSION_COOKIE, s.token, { maxAge: auth.SESSION_ABS, biztonsagos: c.cookieBiztonsagos }));
}

/** a demo-adat egyszeri betoltese (demo.js, ha mar megvan). Visszaad: igaz, ha most toltodott be. */
export async function demoAdatBetoltDb(db, { now, env = {} }) {
  const jel = await db.prepare('SELECT 1 AS x FROM beallitasok WHERE kulcs = \'demo_betoltve\'').first();
  if (jel) return false;
  const m = await opcionalisModul('demo');
  const f = m && [m.demoAdatBetolt, m.demoBetolt, m.betolt].find((x) => typeof x === 'function');
  if (!f) return false;
  try { await f(db, { most: now }); } catch (e) {
    if (e instanceof CrmHiba && e.kod === 'NEM_URES_ADATBAZIS') return false;   // valodi adat mellett nincs demo-adat; a belepes igy is mukodik
    throw e;
  }
  await db.prepare('INSERT OR REPLACE INTO beallitasok (kulcs, ertek, frissitve, frissitette) VALUES (\'demo_betoltve\', \'1\', ?1, \'system\')').bind(now).run();
  return true;
}
const demoAdatBetolt = (c) => demoAdatBetoltDb(c.db, { now: c.now, env: c.env });

const UTAK = [
  ...authUtak.map(([m, p, k, o]) => fordit(m, p, k, o)),
  ...vendegUtak.map(([m, p, k, o]) => fordit(m, p, k, o)),
  ...klinikaiUtak.map(([m, p, k, o]) => fordit(m, p, k, o)),
  ...adminUtak.map(([m, p, k, o]) => fordit(m, p, k, o)),
  ...publikusUtak.map(([m, p, k, o]) => fordit(m, p, k, { auth: 'nyilvanos', ...(o || {}) })),
];
/** az utvonal-tabla (teszt: minden vegpont szerepkor-matrixa) */
export const VEGPONTOK = Object.freeze(UTAK.map((u) => ({ metodus: u.metodus, minta: u.minta, auth: u.auth })));

// ---- kerelem-kontextus ---------------------------------------------------------------------------------------------------------------------
async function kontextus(request, env, ctx, url) {
  const db = env.CRM_DB;
  const now = typeof env.CRM_IDO === 'function' ? env.CRM_IDO() : Math.floor(Date.now() / 1000);
  const host = hosztok(request);
  const helyi = host.length > 0 && host.every((h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1');
  const c = {
    request, env, ctx: ctx || {}, db, url, now, q: url.searchParams, params: {},
    tarolo: env.CRM_TAROLO || d1Tarolo(db, { most: () => now }),
    kuldok: kuldokEnvbol(env),
    ipHash: await ipHashEnv(request, env),
    cookieBiztonsagos: !(env.CRM_DEV === '1' && helyi),
    munkamenet: null, staffId: null, szerepek: [], sutiToken: cookieOlvas(request, SESSION_COOKIE), _torzs: undefined,
  };
  c.torzs = async () => { if (c._torzs === undefined) c._torzs = await jsonTorzs(request); return c._torzs; };
  c.uuid = (nev) => { const v = c.params[nev]; if (!uuidE(v)) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen elem.', 404); return v.toLowerCase(); };
  c.kot = async (muvelet, eroforras, extra = {}) => { c.szerepek = await megkoveteli(db, c.staffId, muvelet, eroforras, { ipHash: c.ipHash, now, ...extra }); return c.szerepek; };
  c.lehet = (muvelet, eroforras) => lehet(c.szerepek, muvelet, eroforras);
  c.audit = (adat) => naplo(db, { staffId: c.staffId, ipHash: c.ipHash, now, ...adat });
  return c;
}

async function munkamenetBetolt(c) {
  if (!c.sutiToken) return;
  const m = await auth.munkamenet(c.db, c.sutiToken, { now: c.now });
  if (!m) return;
  // a demo-munkatars eles hoszton / demo nelkul semmire nem jo (vedelmi vonal)
  if (auth.demoMunkatarsE(m) && !demoMod(c.env, c.request)) return;
  c.munkamenet = m; c.staffId = m.staffId;
  c.szerepek = await szerepekBetolt(c.db, m.staffId);
}

/** gepi vegpontok (ingest / tick): X-CRM-KULCS, a kulcs SHA-256-ja a CRM_KULCS_HASH-ben */
async function kulcsEllenoriz(c) {
  const hash = String(c.env.CRM_KULCS_HASH || '').trim().toLowerCase();
  const kulcs = c.request.headers.get('x-crm-kulcs');
  await limitVagyHiba(c.db, `kulcs:${c.ipHash || 'noip'}`, { ablak: 60, max: 120 }, c.now);
  if (!hash || !kulcs || !egyenlo(await sha256(kulcs), hash)) {
    await naplo(c.db, { action: 'machine.key_rejected', resource: 'api', result: 'denied', ipHash: c.ipHash, now: c.now });
    throw new ApiHiba('NINCS_BELEPVE', 'Érvénytelen gépi kulcs.', 401);
  }
}

// ---- belepesi pont ---------------------------------------------------------------------------------------------------------------------------
export async function api(request, env = {}, ctx = {}) {
  let url;
  try { url = new URL(request.url); } catch { return json({ hiba: { kod: 'ROSSZ_KERES', uzenet: 'Érvénytelen kérés.' } }, 400); }
  let c = null;
  try {
    if (!env.CRM_DB) throw new ApiHiba('NINCS_ADATBAZIS', 'A CRM adatbázis nincs beállítva (CRM_DB hiányzik).', 503);
    let ut = url.pathname;
    if (ut === ELOTAG || ut.startsWith(`${ELOTAG}/`)) ut = ut.slice(ELOTAG.length) || '/'; else throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen végpont.', 404);
    if (ut.length > 1) ut = ut.replace(/\/+$/, '');
    const metodus = request.method === 'HEAD' ? 'GET' : request.method;

    // utvonal keresese; ha az utvonal letezik, de a metodus nem: 405
    let talalt = null, volt = false;
    for (const u of UTAK) {
      const m = u.re.exec(ut);
      if (!m) continue;
      volt = true;
      if (u.metodus !== metodus) continue;
      talalt = { u, m };
      break;
    }
    if (!talalt) throw new ApiHiba(volt ? 'METODUS_NEM_ENGEDELYEZETT' : 'NINCS_TALALAT', volt ? 'Ez a művelet itt nem engedélyezett.' : 'Nincs ilyen végpont.', volt ? 405 : 404);

    c = await kontextus(request, env, ctx, url);
    talalt.u.kulcsok.forEach((k, i) => {
      let v;
      try { v = decodeURIComponent(talalt.m[i + 1]); } catch { throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen elem.', 404); }
      if (v.length > 300 || v.includes('/') || v.includes('\\') || v.includes('\0')) throw new ApiHiba('NINCS_TALALAT', 'Nincs ilyen elem.', 404);
      c.params[k] = v;
    });

    const iro = IRO_METODUSOK.has(metodus);
    if (iro && !azonosEredet(request)) throw new ApiHiba('EREDET', 'A kérés eredete nem engedélyezett.', 403);

    if (talalt.u.auth === 'kulcs') {
      await kulcsEllenoriz(c);
    } else {
      await munkamenetBetolt(c);
      if (talalt.u.auth === 'session') {
        if (!c.munkamenet) throw new ApiHiba('NINCS_BELEPVE', 'Nem vagy bejelentkezve.', 401);
        if (iro && !egyenlo(request.headers.get('x-crm-csrf'), c.munkamenet.csrf)) {
          await c.audit({ action: 'csrf.rejected', resource: 'api', result: 'denied' });
          throw new ApiHiba('CSRF', 'Hiányzó vagy érvénytelen CSRF-token.', 403);
        }
      }
    }
    const eredmeny = await talalt.u.kezelo(c);
    let valasz = eredmeny instanceof Response ? eredmeny : json(eredmeny ?? { ok: true });
    valasz = fejlecRa(valasz);
    if (request.method === 'HEAD') valasz = new Response(null, { status: valasz.status, headers: valasz.headers });
    return valasz;
  } catch (e) {
    if (!(e instanceof CrmHiba)) console.error('crm api hiba:', e?.name, String(e?.message || '').slice(0, 300));
    // csak az elonezeten (CRM_DEMO=1) adunk reszletet a belso hibarol, eleshez soha
    if (!(e instanceof CrmHiba) && env && env.CRM_DEMO === '1') return fejlecRa(json({ hiba: { kod: 'BELSO_HIBA', uzenet: 'Belső hiba történt.', reszlet: String(e?.stack || e?.message || e).slice(0, 800) } }, 500));
    return hibaValasz(e);
  }
}

export default api;
export { csrfTokenSessionbol };
