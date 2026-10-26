// Cloudflare Pages-fuggveny: ERINTESNAPLO havi riport (#495, UJ-80) - CSAK OLVASHATO a dashboardnak (a fuggo utvonalakat lezarja, mas nem ir). Kulcsos: x-egyeztetes-kulcs FEJLEC (a ?kulcs= query-kulcs nem
// fogadhato el: a naplokba / elozmenyekbe kerulne); a kulcs SHA-256-ja az EGYEZTETES_KULCS_HASH valtozoban van (mint a /api/foglalas-kulcs). Kulcs nelkul / rossz kulccsal 404.
//   GET ?honap=EEEE-HH (alap: az aktualis Budapest szerinti honap)  ->  { ok, honap, idozona, konverziok, hirdetes: [...], kampany: [...], utvonalak: [... top 20], napok: {...} }
// A logika: netlify/lib/meres/erintesnaplo.js; leiras: docs/booking-engine/ERINTESNAPLO.md.
import { kulcsEllenorzes } from '../../netlify/lib/foglalas-kulcs.js';
import { riportOlvas } from '../../netlify/lib/meres/erintesnaplo.js';

const fej = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: fej });

export async function erintesRiport(request, env, { most = Math.floor(Date.now() / 1000) } = {}) {
  if (request.method !== 'GET') return json({ ok: false }, 405);
  if (!request.headers.get('x-egyeztetes-kulcs') || !(await kulcsEllenorzes(request, env))) return json({ ok: false }, 404);
  if (!env || !env.KULCS_DB) return json({ ok: false, miert: 'nincs adatbazis-kotes' }, 503);
  const honap = new URL(request.url).searchParams.get('honap') || undefined;
  const r = await riportOlvas(env.KULCS_DB, { honap, most });
  return json(r, r.ok ? 200 : 400);
}

export async function onRequest(context) {
  try {
    return await erintesRiport(context.request, context.env);
  } catch (e) {
    console.error('mosaic-erintes-riport: belso hiba', String(e && e.message || e).slice(0, 200));
    return json({ ok: false, hiba: 'belso_hiba' }, 500);
  }
}
