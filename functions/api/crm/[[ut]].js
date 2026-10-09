// Cloudflare Pages-fuggveny: az Oxigen mini CRM API-ja (/api/crm/...). Vekony burok: minden logika a crm/lib/api.js-ben van (docs/oxigen-crm/API.md).
// A specifikusabb utvonal (functions/api/crm/) elobb illik, mint a functions/[[path]].js; a dist/_routes.json include "/*" miatt a Function megkapja.
// Beallitas: CRM_DB (D1, wrangler.toml), ASSETS (a betutipusokhoz), CRM_ADMIN_EMAILS, CRM_KULCS_HASH, CRM_TITOK, CRM_KULDES, SMTP_* (lasd crm/lib/README.md).
import { api } from '../../../crm/lib/api.js';

export const onRequest = (context) => {
  if (!context.env.CRM_DB) {
    return new Response(JSON.stringify({ hiba: { kod: 'NINCS_ADATBAZIS', uzenet: 'A CRM adatbázis nincs beállítva (CRM_DB hiányzik).' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
    });
  }
  return api(context.request, context.env, context);
};
