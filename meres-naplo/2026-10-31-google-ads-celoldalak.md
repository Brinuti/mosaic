# 2026-10-31 – Google Ads céloldal-terv: 5 új oldal + 7 meglévő oldal szövegkiegészítése

**MÉRÉST ÉRINT (csak a Meta-pixel oldallistája bővül):** az 5 új oldal ugyanazt a Meta-pixelt kapja, mint a forrásoldala
(`assets/js/suti.js`, `PIXEL_OLDALAK`). Új pixel, új esemény, új konverzió nincs; a GTM, a GA4, a Google Ads és a Meta fiókjához nem nyúltunk.
A foglalási folyamat nem változik (ugyanaz a foglaló, ugyanazok a linkek és `business=` paraméterek, mint a forrásoldalon).

**Engedély:** Feri jóváhagyta (Google-dokumentum: „MOSAIC Google Ads – céloldal-terv (Feri + fejlesztő) 2026-10-31”, 1H3kE5yuuHrXS_f4smUkVcFNTL9-BSy4DaWTKVi4eQ2E,
„Feri jóváhagyta: 2026-10-31 11:01”); Feri a dokumentumot a fejlesztői ablakba küldte („Azonnali élesítés” szabály).

## Mi változott

| # | Oldal | Típus | Forrás / generátor |
|---|---|---|---|
| 1 | `/fodrasz-obuda` | ÚJ (a `/noi-fodraszat-budapest` másolata) | `tools/hair-oldalak.mjs` + `tools/hair-oldalak/google-oldalak.mjs` |
| 2 | `/balayage-budapest` | ÚJ (a `/balayage-haj-festes-budapest` másolata) | ugyanaz |
| 3 | `/hajfestes-budapest` | ÚJ (a `/noi-hajfestes-budapest` másolata, hajhosszabbítás nélkül) | ugyanaz |
| 4 | `/szemoldok-tetovalas-budapest` | ÚJ (a `/sminktetovalas-budapest` másolata, ajak/szemhéj nélkül) | `tools/google-celoldalak.mjs` |
| 5 | `/hajhullas-kezeles-budapest` | ÚJ (az `/oxigenterapia-budapest` másolata) | `tools/google-celoldalak.mjs` |
| 6–12 | `/sminktetovalas-budapest`, `/szajtetovalas-budapest`, `/oxigenterapia-budapest`, `/hajvizsgalat-budapest`, `/lezeres-szortelenites-budapest`, `/intim-lezeres-szortelenites-budapest`, `/vegleges-szortelenites-ferfiaknak` | MARAD + SZÖVEG | kézzel (`foglalas/*.html`) |

- Az új oldalak: indexelhetők, saját canonical, `tools/wix-sitemap/pages-sitemap.xml`; menüben nincsenek; a régi oldalról nincs átirányítás.
- A szövegek a terv „ezt kell beírni” oszlopa szerint, betű szerint; látható, normál szöveg (nincs rejtett blokk).
- Bekötés: `suti.js` pixel-lista, `tools/foglalo-atkotes.mjs` `oldalUzletag` (szemoldok-tetovalas → pmu, hajhullas-kezeles → oxigen, hajfestes- → fodraszat / color),
  `tools/netlify-build.mjs` `FOGLALO_OLDALAK` (+ szemoldok-tetovalas-budapest: a beágyazott PMU-foglalót tölti, mint a forrása).

## Védett blob-hash-ek (`git hash-object`, 10 karakter; kiindulás: `origin/main` `652e8eb5`)

| fájl | kiindulás | most |
|---|---|---|
| `assets/js/suti.js` | `19bbbc3c38` | **változik** (szándékos: 5 oldalnév a `PIXEL_PMU` / `PIXEL_FODRASZ` listában + 2 sor megjegyzés) |
| `netlify/lib/foglalo-szamlalo.js` | `be58d8e2b8` | változatlan |
| `assets/js/booking-engine/koszono.js` | `547d0e05fc` | változatlan |
| `assets/js/booking-engine/engine.js` | `a4c5721281` | változatlan |
| `assets/js/booking-engine/lepes-meres.js` | `1ab0b6abe3` | változatlan |
| `assets/js/booking-engine/salonic-adapter.js` | `51fcefc0bc` | változatlan |
| `assets/js/attribucio.js` | `76e4845a78` | változatlan |
| `assets/js/foglalas-kulcs.js` | `787c66bd58` | változatlan |
| `wrangler.toml` | `14391dfbc0` | változatlan |
| fa `netlify`, `functions`, `klon`, `assets/js/booking-engine` | – | változatlan (`git diff --stat origin/main` ezekre üres) |

## Rollback-terv

1. Gyors: a PR merge-commitjának visszavonása (`git revert <merge-SHA>`), egy build: minden oldal a mostani állapotára áll vissza.
2. Részleges: egy új oldal levétele = a `foglalas/<cím>.html` törlése + a generátor sora (`GOOGLE_LAPOK` / `CELOLDALAK`) + a sitemap-sor;
   a régi oldal közben végig változatlanul él (a Meta-hirdetések arra visznek), a Google Ads csak az átvétel után kerül át az új linkre.
3. A `suti.js` visszaállítása: a 2 lista-bővítés + megjegyzés törlése (a többi oldal mérése nem függ tőle).

## Független review (1. kör: FAIL → javítva)

A review (külön ügynök, csak olvasott) a következőket jelezte; mind javítva vagy megindokolva:
1. `oldalUzletag` `fodrasz-` előtag más oldalakat is megfog – **nem ez a PR vezette be** (az `origin/main` 124. sorában már benne van); a saját bővítések pontos névre szűkítve
   (`hajfestes-budapest$`, `szemoldok-tetovalas-budapest$`, `hajhullas-kezeles-budapest$`), új teszt (`test-foglalo-atkotes.mjs`).
2. A `.ar-racs.ketto` szabály a `/szajtetovalas-budapest` árkártyáit is átrendezte volna (a `szajtetovalas-landing.css` 38. sorában le nem zárt `@media` miatt az oldal
   saját szabályai sosem érvényesültek – régi hiba, ebben a PR-ben nem javítjuk) → saját osztály: `ketto-szemoldok`. Mérve: a szájoldal árrácsa 1366 / 900 / 320 px-en azonos a `main`-nel.
3. Mobilon a `main h2 {…!important}` (2026-10-04) felülírta az új alcímek méretét → `!important`-tal javítva (mérve 320 px-en: 12,5 px, nincs kilógás).
4. A kulcsszó-szekciók `aria-label`-je (nem látható szöveg) törölve.
5. A hajfestés-oldalon a kivett hajhosszabbítás-kártyát nem pótoljuk más szöveggel (a terv szerint csak kimarad).
6. A „november 30-ig” mondat a terv szövege; 12-01-re emlékeztető (Noel kedvezményének és a Salonic-pillanatképnek az ellenőrzése).
7. A céloldal-teszt statikus része a böngésző nélkül is fut (a böngésző-hook a böngészős `describe`-ban).

## Független review (2. kör, `e4328a77`): PASS with notes

A hat javítás a fájlokban ellenőrizve; a 7 meglévő oldalon nincs terven kívüli változás, a foglalást nem érinti, nincs rejtett szöveg, a `suti.js` változása indokolt és minimális.
Megjegyzés (nem blokkoló, régi hiba): a `szajtetovalas-landing.css` 38. sorában le nem zárt `@media` – külön feladat; a `pmu-landing.css` megjegyzése ennek megfelelően pontosítva (csak megjegyzés-változás).

## Bizonyíték (2026-10-31)

- `node tools/hair-oldalak.mjs --ellenoriz`: 7 oldal egyezik (a meglévő 4 fodrász-oldal bájtra változatlan).
- `node tools/google-celoldalak.mjs --ellenoriz`: 2 céloldal egyezik.
- Új teszt: `tools/google-celoldalak-teszt/celoldalak.test.mjs` (statikus + böngészős, 1366 px és 390 px): **44 / 44 zöld**; ellenpróba: a kulcsszó-blokkot
  `display:none`-ra állítva a teszt piros (a rejtett szöveget kiszúrja).
- Meglévő tesztek: `tools/hair-teszt/hair.test.mjs` 55/55, `tools/oxigen-teszt/oxigen.test.mjs` 12/12, `tools/arlista-teszt/arlista.test.mjs` 39/39,
  `tools/test-foglalo-atkotes.mjs` 20/20, `tools/ujrastilus-teszt/oxigen-hajvizsgalat.test.mjs` 29/29, `tools/lezer-teszt/tartalom.test.mjs` 6/6, `tools/lezer-teszt/lezer.test.mjs` 86/87 (az 1 FAIL – Trustindex „Failed to fetch” konzolhiba – a `main`-en is ugyanígy bukik), `tools/test-sminktetovalas-oldal.mjs` 2/2, `tools/szaj-teszt/szaj.test.mjs` 22/22
  (a terv szerinti új cím / H1 / H2 / „ajak sminktetoválás” miatt frissítve; a videós részteszt 4 futásból egyszer időzítés miatt elbukott, egyedül futtatva zöld).
- Build (`node tools/netlify-build.mjs`): az 5 új oldal foglaló-linkjei asztalon és mobilon is azonosak a forrásoldaléval (a `/hajfestes-budapest`-ről csak a kivett póthaj-gomb hiányzik).
