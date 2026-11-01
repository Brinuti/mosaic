// /api/modell/*: a modellkereso napok (ingyenes piercing, oktatasi gyakorlonap) foglalo-API-ja. A logika: lib/modell/vegpont.js.
import { api } from '../../../lib/modell/vegpont.js';

export async function onRequest(context) {
  try {
    return await api(context.request, context.env, { waitUntil: context.waitUntil && context.waitUntil.bind(context) });
  } catch (e) {
    console.error('modell api: belso hiba', String((e && e.message) || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
}
