// Cloudflare Pages-fuggveny: Mosaic NEVTELEN sutisav-statisztika (a bongeszo, assets/js/suti.js, sendBeacon-nel kuldi; lasd netlify/lib/meres/suti-stat.js). Olvasas: GET /api/meres-admin?suti_stat=1 (kulcsos).
import { kezelSutiStat } from '../../netlify/lib/meres/suti-stat.js';
export const onRequest = (context) => kezelSutiStat(context.request, context.env);
