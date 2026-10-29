// POST /api/mp-potlas: egyszeri, kulcs-listas potlas az elo All akcion (DECISION #253; lib/meres/potlas.js). Titkos fejlec: x-mp-kiigazitas.
import { potlasVegpont } from '../../lib/meres/potlas.js';

export async function onRequest(context) {
  try {
    return await potlasVegpont({ request: context.request, env: context.env });
  } catch (e) {
    console.error('mp-potlas: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
