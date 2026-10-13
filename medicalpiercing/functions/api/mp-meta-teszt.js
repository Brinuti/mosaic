// POST /api/mp-meta-teszt: Meta CAPI tesztesemeny (csak test_event_code-dal), lib/meres/meta.js. Fejlec: x-mp-meta-teszt.
import { metaTesztVegpont } from '../../lib/meres/meta.js';

export async function onRequest(context) {
  try {
    return await metaTesztVegpont({ request: context.request, env: context.env });
  } catch (e) {
    console.error('mp-meta-teszt: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
