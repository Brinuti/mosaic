# Költözés a Netlifyről a Cloudflare Pages-re

**Miért:** a Netlify kreditalapú. Minden deploy, minden letöltött GB és minden kérés kreditbe kerül,
és ha a keret elfogy, az éles oldal leáll (2026-10-03-án megtörtént). A Cloudflare Pages ingyenes,
és a forgalomért nem számol fel semmit. A lapcímekre futó függvényből napi 100 ezer hívás ingyenes;
a kb. 1 400 napi oldalmegtekintésnek ez bőven elég, mert a képek, stílusok és szkriptek függvény
nélkül jönnek (`dist/_routes.json`).

## Ami a repóban már kész (2026-10-03)

| | Netlify (most) | Cloudflare Pages |
|---|---|---|
| build | `node tools/netlify-build.mjs` → `dist/` | ugyanaz (`wrangler.toml`); a `main` ág buildje az éles |
| Wix-címek, asztali/mobil | `netlify/edge-functions/oldal.js` | `functions/[[path]].js` – ugyanaz a `netlify/lib/utvonal.js` |
| próbacímek noindexe | edge-függvény | `functions/[[path]].js` (`*.pages.dev`) |
| gyökér → `www` 301 | Netlify-beállítás | `functions/[[path]].js` |
| űrlapok | Netlify Forms + `netlify/functions/submission-created.mjs` | `functions/[[path]].js` (POST `/`), a feltöltött fájlok mellékletként |
| levelek szövege | `netlify/lib/levelek.js` | ugyanaz |
| levélküldés | nodemailer, Gmail SMTP | worker-mailer, Gmail SMTP (ugyanazok a beállítások) |
| fejlécek | `dist/_headers` | ugyanaz a fájl |
| 404 | a Netlify sajátja | `dist/404.html` |
| fájlméret | – | max. 25 MB/fájl: a 4 nagyobb videó újratömörítve (24–25 MB) |

Helyben kipróbálva a Cloudflare saját futtatókörnyezetével (`wrangler pages dev dist`): az útvonalak,
a 301-ek, a 404, a robots.txt, az űrlap → e-mail (vevő- és szalonlevél, válaszcím, melléklet) és a
robotcsapda is működik.

Helyi próba: `npx wrangler pages dev dist` (az SMTP-beállítások a `.dev.vars` fájlban, ami nincs a repóban).

## A költözés lépései

1. **Cloudflare-projekt** (egyszeri, a felhasználó fiókjában):
   *Workers & Pages → Create → Pages → Connect to Git* → `Brinuti/mosaic`
   - Production branch: `main`
   - Build command: `node tools/netlify-build.mjs`
   - Build output directory: `dist`
   - *Settings → Variables and Secrets* (Production és Preview): `SMTP_HOST` = `smtp.gmail.com`,
     `SMTP_PORT` = `465`, `SMTP_USER` = `mosaicheadspa@gmail.com`, `SMTP_PASS` = a Gmail
     alkalmazásjelszó (Secret típussal; ugyanaz, ami a Netlifyn van).
2. **Próba a `mosaicheadspa.pages.dev` címen.** Ez noindexes, a mérőkódok nem futnak rajta. Itt kell
   kipróbálni egy valódi űrlap-beküldést.
3. **DNS: a zóna átköltöztetése a Cloudflare-re** (ajánlott, ingyenes). *Add a site* →
   `mosaicheadspa.hu` → Free. A Cloudflare beolvassa a meglévő rekordokat; ellenőrizni kell,
   hogy megvannak-e: `MX` (5 db, Google), `TXT` (SPF, google-site-verification), `CNAME stape` →
   `euj.stape.io`, `CNAME capi-pmu` → `capig.stape.cloud`. Ezek maradjanak **DNS only** (szürke
   felhő) módban. Utána a Websupportnál a névszervereket a Cloudflare által megadott kettőre kell
   cserélni.
4. **Domain a Pages-projekthez:** *Custom domains* → `www.mosaicheadspa.hu` és `mosaicheadspa.hu`.
   A gyökércímet a függvény 301-gyel a `www`-re küldi, mint eddig.
5. **Ellenőrzés:** lapok mobilon és asztalin, egy űrlap-beküldés, GA4 és Meta valós idejű nézet.
6. **Netlify:** a `mosaicheadspa` projektet le lehet állítani, az előfizetést vissza lehet
   mondani. A `mosaic-pmu-sms` projekt is a Netlifyn van – előbb azt is át kell nézni.

## Titkok és kapcsolók a költözés után

- Salonic-naptár jelölése („Ott leszek”): lásd [docs/SALONIC_JELOLES.md](docs/SALONIC_JELOLES.md) –
  `SALONIC_PMU_JELSZO` (Secret). Jelszó nélkül a funkció nem csinál semmit.
