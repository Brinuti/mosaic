// Cloudflare Pages-fuggveny: ELETUT-esemenyek (DECISION-LOG #102): a foglalas letrehozasa utani allapotok (lemondva / nem_jelent_meg / megjelent) -> Google RETRACTION (Zapier, dryRun alapbol),
// Meta / TikTok diagnosztikai esemeny (nem konverzio). Lasd netlify/lib/meres/eletut.js, docs/booking-engine/ELETUT.md. Kulcsos (x-egyeztetes-kulcs), mint a /api/foglalas-egyeztetes.
//   POST {"uuid"|"booking_id","allapot":"lemondva"|"nem_jelent_meg"|"megjelent","ido":"ISO-8601","forras":"..","vendeg":{"email","telefon"}} | {"muvelet":"fuggo"};  GET ?source_id=mb_.. | ?riasztas=1
import { kezelEletut } from '../../netlify/lib/meres/vegpontok.js';
export const onRequest = (context) => kezelEletut(context.request, context.env);
