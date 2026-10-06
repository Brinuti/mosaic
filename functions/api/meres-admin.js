// Cloudflare Pages-fuggveny: QA-2 arnyek-meres naplo / vészkapcsolo / kulso szallito visszaigazolasa (kulcsos: x-egyeztetes-kulcs, mint a /api/foglalas-egyeztetes).
import { kezelAdmin } from '../../netlify/lib/meres/vegpontok.js';
export const onRequest = (context) => kezelAdmin(context.request, context.env);
