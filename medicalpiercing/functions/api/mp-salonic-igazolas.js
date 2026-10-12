// POST /api/mp-salonic-igazolas: a Salonic "Uj online foglalas erkezett" levele (Zapier Gmail-trigger) -> foglalas-igazolas.
// A Google Ads-feltoltes csak igazolt foglalasbol indul (lib/meres/lanc.js). Titkos fejlec: x-mp-igazolas = MP_IGAZOLAS_TITOK.
import { igazolasErkezes } from '../../lib/meres/lanc.js';

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') return new Response(JSON.stringify({ ok: false }), { status: 405, headers: { 'content-type': 'application/json; charset=utf-8' } });
  try {
    return await igazolasErkezes({ request, env: context.env, waitUntil: context.waitUntil && context.waitUntil.bind(context) });
  } catch (e) {
    console.error('mp-salonic-igazolas: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
