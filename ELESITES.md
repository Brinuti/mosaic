# Élesítési ellenőrzőlista

Cél: az új oldal a mostani Wix-oldal pontos másolata legyen a méréssel együtt. Ugyanazok az
URL-ek, a pixelek, a CAPI, a GA4 és a konverziós események maradnak, így az átállás nem töri meg
az adatsort.

## Ellenőrizve (2026-09-30)

| Terület | Állapot |
|---|---|
| Oldalak | 88 Wix-oldal, asztali + mobil változat |
| URL-ek | Wix-szel azonos, kiterjesztés nélküli címek (`/headspa-budapest`); a mobil ugyanazon a címen (edge-függvény, user agent szerint); 301 a per jeles és a régi `.html`/`/m/` címekről; `/post/suti-tajekoztato` és `/pricing-plans/list` is él |
| SEO | title, description, canonical, robots, nyelv, H1, alt, og/twitter, JSON-LD: 88/88 egyezik (a képek a saját domainről jönnek, a Wix CDN helyett) |
| sitemap, robots | élesben a Wix fájljai szó szerint (`tools/wix-sitemap/`), a sitemap minden címe 200 |
| GTM | GTM-PST2HB22, ugyanaz a konténer (69 tag): Google Ads, GA4-események, TikTok, Stape (CAPI), Zapier |
| GA4 | G-H4206SQ0Q7, mint a Wixen: automatikus oldalmegtekintés ki, `page_view` + `visit` esemény, `action_source=website` |
| Meta-pixelek | oldalanként, a Wix beállítása szerint: Headspa 3473839859576758 (25 oldal), Fodrász 1361403694872594 (12), Szőr 643342342027957 (5), PMU 1019878750660854 (4); hozzájárulástól függetlenül, mint a Wixen |
| dataLayer | `Pageview`, `page_view` (url, title, page_type), űrlapnál `generate_lead` + `user_data` a Wix-mezőkulcsokkal |
| Mérés-összevetés | élő Wix vs. klón, mobil, 8 oldal (köztük köszönő- és konverziós oldalak): minden GA4-, Meta-, TikTok-, Ads- és Stape-hívás egyezik |
| Űrlapok | 4 űrlap (ajándékkártya 10 oldalon, PMU, PPC, fodrász) + e-mailek a Wix-levelek szerint |

## Élesítéskor

1. **DNS**: a névszerverek most a Wixnél vannak (`ns2/ns3.wixdns.net`), a domain a Websupportnál
   van regisztrálva. Az új DNS-zónába **ezeket kötelező átvinni**, különben leáll az e-mail vagy a CAPI:
   - `MX`: `aspmx.l.google.com` (10), `alt1` (20), `alt2` (30), `alt3` (40), `alt4.aspmx.l.google.com` (50) – Google Workspace e-mail
   - `TXT`: `v=spf1 include:_spf.google.com ~all`
   - `TXT`: `google-site-verification=IteLJpEtWAiDMbUgFBetFV4EdKeAcH-qQ76LmLv3LCc`
   - `CNAME stape` → `euj.stape.io` (szerveroldali mérés, Meta CAPI)
   - `www` és a gyökérdomain az új tárhelyre; **a gyökér 301-gyel a `www`-re** (mint most)
2. **Tárhely**: `ELES=1` környezeti változó (indexelhető, a Wix-féle robots.txt és sitemap).
3. **Cloudflare-re költözéskor**: a `netlify/edge-functions/utvonal.js` logikáját egy Pages Functionbe
   kell tenni; az űrlapokat és a levélküldést át kell írni; 3 videó 25 MB fölött van.
4. **Az átállás után**: GA4-összevetés az utolsó 28 napos alappal (page_view 38 664, visit 36 970,
   session_start 19 088), Meta Events Manager és Google Ads konverziók ellenőrzése.
5. **Netlify-előfizetés lemondása** a Cloudflare-re költözés után.

## Tudnivaló

- A Meta-pixelek a Wixen „szükséges” kategóriában voltak, ezért hozzájárulás nélkül is futnak. A
  klón ezt pontosan másolja az adatsor miatt, de GDPR szempontból kockázatos, ezért érdemes külön
  lépésben rendezni.
- Mérés helyben: `node tools/serve-dist.mjs` (a Netlify edge-függvényével azonos útválasztás).
