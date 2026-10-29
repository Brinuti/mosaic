// Cloudflare Pages-fuggveny: a Google ARNYEK feltoltes valasz-naploja (UJ-11). A Zap a Google Ads lepes utan visszahivja (kulcsos: x-meres-google-kulcs); lasd netlify/lib/meres/google-valasz.js.
import { kezelGoogleValasz } from '../../netlify/lib/meres/google-valasz.js';
export const onRequest = (context) => kezelGoogleValasz(context.request, context.env);
