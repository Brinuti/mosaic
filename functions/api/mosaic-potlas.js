// POST /api/mosaic-potlas: kezi, kulcs-listas potlas a Mosaic HeadSpa elo Google-akciojara (VAZLAT, alapbol KI; lasd netlify/lib/meres/google-potlas.js).
import { potlasVegpont } from '../../netlify/lib/meres/google-potlas.js';

export async function onRequest(context) {
  try {
    return await potlasVegpont({ request: context.request, env: context.env });
  } catch (e) {
    console.error('mosaic-potlas: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
