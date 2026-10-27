// Cloudflare Pages-fuggveny: UJ-82 elonezeti ujrajatszo ut (lasd netlify/lib/meres/elo-ujrajatszas.js). POST {uzletag:'headspa'|'pmu', db:1..3}; kulcsos (x-egyeztetes-kulcs).
// ELESBEN NEM ELERHETO: ELO_CSAK_TESZT != "1" -> 404 (az eles [vars]-ban nincs ilyen valtozo, es KULCS_DB_OLV kotes sincs).
import { kulcsEllenorzes, valasz } from '../../netlify/lib/foglalas-kulcs.js';
import { eloUjrajatszas } from '../../netlify/lib/meres/elo-ujrajatszas.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env || String(env.ELO_CSAK_TESZT || '') !== '1' || request.method !== 'POST') return valasz(404, { ok: false });
  if (!request.headers.get('x-egyeztetes-kulcs') || !(await kulcsEllenorzes(request, env))) return valasz(404, { ok: false }); // a kulcs CSAK fejlecben (a ?kulcs= naplokba kerulhet)
  let torzs = null; try { torzs = await request.json(); } catch (e) { return valasz(400, { ok: false, miert: 'JSON kell' }); }
  const r = await eloUjrajatszas(env, { uzletag: torzs && torzs.uzletag, db: torzs && torzs.db });
  return valasz(r.hiba ? 400 : 200, r.hiba ? { ok: false, miert: r.hiba } : r);
}
