// POST /api/mp-salonic-igazolas: a Salonic "Uj online foglalas erkezett" levele (Zapier Gmail-trigger) -> foglalas-igazolas.
// A Google Ads-feltoltes csak igazolt foglalasbol indul (lib/meres/lanc.js). Titkos fejlec: x-mp-igazolas = MP_IGAZOLAS_TITOK.
import { igazolasErkezes } from '../../lib/meres/lanc.js';
import { eloPotlas } from '../../lib/meres/google-elo.js'; // UJ-63: csere nelkuli potlas az elo akcion (alapbol KI: MP_GADS_ELO)

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') return new Response(JSON.stringify({ ok: false }), { status: 405, headers: { 'content-type': 'application/json; charset=utf-8' } });
  try {
    const valasz = await igazolasErkezes({ request, env: context.env, waitUntil: context.waitUntil && context.waitUntil.bind(context) });
    if (context.waitUntil && context.env && context.env.MP_MERES_DB) context.waitUntil(eloPotlas({ db: context.env.MP_MERES_DB, env: context.env, host: new URL(request.url).hostname }));
    return valasz;
  } catch (e) {
    console.error('mp-salonic-igazolas: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
