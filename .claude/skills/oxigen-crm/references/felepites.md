# Felépítés, fájltérkép, azonosítók

## Futtatási környezet
- Cloudflare Pages (`mosaic` projekt) + Pages Functions (`functions/`) + D1. Az `main` ág automatikusan publikál: https://www.mosaicheadspa.hu/ . Ág-előnézet: `https://<ág-első-~25-karaktere>.mosaic-d77.pages.dev` (pl. `claude-mosaic-repo-review-h5.mosaic-d77.pages.dev`).
- D1 éles: `mosaic-crm` (id `c831eeb0-5582-4a3f-b022-2bb2ec64d577`); előnézet: `mosaic-crm-elonezet` (id `3622700b-409e-4742-9b22-1c418d76da62`). Lekérdezés: Cloudflare MCP `d1_database_query`.
- R2 nincs bekapcsolva → a fájlok (képek, PDF) a D1 `crm_fajl` táblában, base64 darabokban (`tarolo` interfész).
- `wrangler.toml` változók: `CRM_KULDES="dry"`, `CRM_ADMIN_EMAILS="ferraj@gmail.com"`, csak előnézeten `CRM_DEMO="1"`. Titkok (SMTP_PASS stb.) a Cloudflare felületén.
- Migrációk: `crm/migrations/0001_init`, `0002_fajl_tarolo`, `0003_kep_beerkezo`; a futtató `crm/lib/migracio.js`, generált `crm/lib/migraciok.generalt.js` (`node tools/crm-migraciok.mjs` újragenerálja); a Pages Function lustán futtatja (`biztosit()`).

## Kódtérkép
- `functions/api/crm/[[ut]].js` – burkoló (503 CRM_DB nélkül), `functions/[[path]].js` + `tools/netlify-build.mjs` – /crm fejlécek (no-store, noindex, CSP), `pwa-crm/*` a dist gyökerébe.
- `crm/lib/` – platformfüggetlen ES modulok: `api.js` (útválasztó), `api-klinikai.js` (kezelés, képek, kép-beérkező), `api-public.js` (nyilvános hozzájárulás), `images.js`, `beerkezo.js` (6 óra, max 40 kép), `lifecycle-kapocs.js`, `constants.js` (`MARKETING`), `pdf.js` (pdf-lib + fontkit, `assets/fonts/pdf/`), `messages/` (katalog 29 sablon, utemezo, kapuk), `testdb.js`.
- UI: `foglalas/crm.html`, `assets/js/crm-app.js` (menü, router, SW), `crm-nezet-*.js` (kezeles, vendeg, kepek, kepkuldo), `crm-megosztas.js`, `assets/css/crm.css`; PWA: `pwa-crm/crm.webmanifest` (share_target `/crm-megosztas`), `pwa-crm/crm-sw.js`.
- Landing: `foglalas/oxigenterapia-budapest-uj.html`, `assets/js/oxigen-uj.js`, `assets/css/oxigen-uj.css`.
- Doksi: `docs/oxigen-crm/*` (lásd SKILL.md).

## Auth
E-mailes 6 jegyű kód (csak személyzet / `CRM_ADMIN_EMAILS`), süti `crm_sess`, CSRF fejléc `X-CRM-CSRF`. Szerepkörök: therapist, clinical_lead, reception, salon_manager, marketing, admin. Demó belépés csak ha `CRM_DEMO=1` ÉS nem éles host.

## Adatáramlás
Salonic foglalás → Salonic értesítő e-mail (mosaicheadspa@gmail.com) → Zapier `lifecycle-bejovo` (01a1168a-afbf-7ee9-94c3-6e5be524b6be) → `/api/lifecycle/bejovo` → régi lifecycle + `lifecycle-kapocs.js` → CRM. Az értesítő csak név/telefon/e-mail/szolgáltatás/kezelő/időpont; hozzájárulási adat NINCS benne. A Zapier `lifecycle-tick` (01a1169c-…, óránként) csak a RÉGI lifecycle-t hajtja; CRM `/api/crm/tick` ütemező még nincs.
Salonic lemondó oldal: `https://mosaic-oxigen.salonic.hu/booking/cancelBooking/<bookingId>`.

## Tesztek
- `node --test crm/test/*.test.mjs` (NEM a könyvtár-forma Node 22-n) – 290
- `node --test tools/crm-ui-teszt/crm-ui.test.mjs` – 26 (Playwright; ne glob-olj `*.mjs`-t, a teszt-szerver beragad)
- `node tools/netlify-build.mjs && node --test tools/oxigen-uj-teszt/oxigen-uj.test.mjs` – 23
- `node --test tools/lifecycle-teszt/*.test.mjs` – 69
