// POST /api/mp-foglalas: a koszonooldal (/foglalas-ok*) foglalas-jelzese -> D1-rekord -> Google Ads ARNYEK-feltoltes.
// GET / POST kulcsos admin (x-mp-kulcs): riport, egy foglalas allapota, ujraprobalas. Leiras: docs/MERES_GOOGLE_ARNYEK.md.
// Csak MP-kod (lib/meres/): a Mosaic kodjabol semmit nem importal.
import { foglalasErkezes, admin } from '../../lib/meres/lanc.js';

export async function onRequest(context) {
  const { request } = context;
  try {
    if (request.method === 'POST' && !request.headers.get('x-mp-kulcs')) {
      return await foglalasErkezes({ request, env: context.env, waitUntil: context.waitUntil && context.waitUntil.bind(context) });
    }
    return await admin({ request, env: context.env });
  } catch (e) {
    console.error('mp-foglalas: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
