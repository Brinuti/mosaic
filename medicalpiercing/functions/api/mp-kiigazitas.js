// GET/POST /api/mp-kiigazitas: Google Ads konverzio-kiigazitas (RETRACT) a Salonic-igazolas alapjan (lib/meres/kiigazitas.js).
// Hivo: utemezett Zapier durable workflow. Titkos fejlec: x-mp-kiigazitas.
import { kiigazitasVegpont } from '../../lib/meres/kiigazitas.js';

export async function onRequest(context) {
  try {
    return await kiigazitasVegpont({ request: context.request, env: context.env });
  } catch (e) {
    console.error('mp-kiigazitas: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
