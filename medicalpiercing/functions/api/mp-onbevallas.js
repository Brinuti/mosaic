// POST /api/mp-onbevallas: a koszonooldali "Honnan hallottal rolunk?" kartya valasza -> a foglalas D1-soranak onbevallas
// oszlopa (lib/meres/lanc.js onbevallasErkezes). Kulso hivas nincs. Leiras: docs/MERES_GOOGLE_ARNYEK.md.
import { onbevallasErkezes } from '../../lib/meres/lanc.js';

const json = (o, status) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') return json({ ok: false }, 405);
  try {
    return await onbevallasErkezes({ request, env: context.env });
  } catch (e) {
    console.error('mp-onbevallas: belso hiba', String(e && e.message || e).slice(0, 200));
    return json({ ok: false, hiba: 'belso_hiba' }, 500);
  }
}
