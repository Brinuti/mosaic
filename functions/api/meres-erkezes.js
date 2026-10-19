// Cloudflare Pages-fuggveny: QA-2 erkezesi adatok (kattintasazonositok, UTM, sutik, hozzajarulas) - a bongeszo (assets/js/attribucio.js) irja, lasd netlify/lib/meres/vegpontok.js.
// A VALTOZATLAN kezelErkezes kore epitett burok (netlify/lib/meres/forras-lpt.js): a 7 napos utolso fizetett kattintas forras-cimkeje (meres_forras) + a shadow-lanc kattintasazonosito-potlasa a sutibol.
// A burok hibaja SOSEM torheti el a meres_erkezes mentest; MOSAIC_LPT_KI=1 eseten a burok teljesen kimarad (a valasz bajtra a regi).
import { kezelErkezes } from '../../netlify/lib/meres/vegpontok.js';
import { erkezesForrassal } from '../../netlify/lib/meres/forras-lpt.js';
export const onRequest = (context) => erkezesForrassal(context.request, context.env, kezelErkezes);
