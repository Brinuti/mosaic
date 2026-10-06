// Cloudflare Pages-fuggveny: QA-2 erkezesi adatok (kattintasazonositok, UTM, sutik, hozzajarulas) - a bongeszo (assets/js/attribucio.js) irja, lasd netlify/lib/meres/vegpontok.js.
import { kezelErkezes } from '../../netlify/lib/meres/vegpontok.js';
export const onRequest = (context) => kezelErkezes(context.request, context.env);
