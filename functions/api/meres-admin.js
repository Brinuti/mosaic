// Cloudflare Pages-fuggveny: QA-2 arnyek-meres naplo / vészkapcsolo / kulso szallito visszaigazolasa (kulcsos: x-egyeztetes-kulcs, mint a /api/foglalas-egyeztetes).
//   GET ?source_id=.. | ?fuggo=1 | ?kapcsolok=1;  POST {muvelet:'kapcsolo'|'megerosit'|'ajandek_ujra'|'ajandek_visszaterites_ujra'|'ajandek_teszt_visszateritese', ...}  (lasd netlify/lib/meres/vegpontok.js)
import { kezelAdmin } from '../../netlify/lib/meres/vegpontok.js';
import { ajandekTesztVisszateritese, arnyekMeresUjra, arnyekVisszateresUjra } from '../../netlify/lib/ajandek.js';
export const onRequest = (context) => kezelAdmin(context.request, context.env, { ajandekUjra: arnyekMeresUjra, ajandekVisszateritesUjra: arnyekVisszateresUjra, ajandekTesztVisszateritese });
