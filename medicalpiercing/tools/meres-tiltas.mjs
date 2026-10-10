// Az eles Wix-oldalt megnyito eszkozok (elo-mentes, elteres, osszevet) alatt egyetlen
// merokeres sem mehet ki: GTM, GA4, Google Ads, Meta, TikTok, stape, Convertize, CookieYes.
// A koszonooldalak (/foglalas-ok*) megnyitasa kulonben hamis foglalast / konverziot
// kuldene, a tobbi oldal pedig hamis latogatast.
//
//   import { meresTiltas } from './meres-tiltas.mjs';
//   await meresTiltas(ctx);   // a bongeszo-kornyezet (BrowserContext) letrehozasa utan
export const MERES = /googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|google\.[a-z.]+\/(ccm|rmkt|pagead)\/|connect\.facebook\.net|facebook\.com\/tr|analytics\.tiktok\.com|stape\.medicalpiercing\.hu|convertize\.(io|com)|cookieyes\.com|clarity\.ms/;
export const meresTiltas = (ctx) => ctx.route(MERES, (r) => r.abort());
