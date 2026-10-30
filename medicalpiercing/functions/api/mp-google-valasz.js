// POST /api/mp-google-valasz: a Google ARNYEK feltoltest vegzo Zapier-workflow visszahivasa (requestId, partialFailure kod) -> mp_google_valasz (UJ-61, lib/meres/google-valasz.js).
// GET ?riport=1 (admin, x-mp-kulcs): darabszamok. Titkos fejlec a Zap-hivasnal: x-mp-google-kulcs (SHA-256-ja = MP_GOOGLE_VALASZ_KULCS_HASH).
import { googleValaszVegpont } from '../../lib/meres/google-valasz.js';

export async function onRequest(context) {
  try {
    return await googleValaszVegpont({ request: context.request, env: context.env });
  } catch (e) {
    console.error('mp-google-valasz: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
