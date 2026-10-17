# /hajvizsgalat-budapest – hajkamerás hajvizsgálat (Google Ads OX-2), ÚJ oldal

**Állapot (2026-10-18): EGYELŐRE NEM ÉLES.** Feri utasítása: új oldalakat építünk, a régieken nem változtatunk, holnap átbeszéljük. Az oldal `noindex, nofollow`, nincs a sitemapben, nincs rá link sehonnan.
Szövegterv: Drive `MOSAIC-GOOGLE-4UZLETAG-LANDING-BRIEF-WEBES-ABLAKNAK-2026-10-17.md`, 2. szakasz.

## Fájlok (mind új)
| Fájl | Szerepe |
|---|---|
| `foglalas/hajvizsgalat-budapest.html` | az oldal (egy fájl asztalira és mobilra) |
| `assets/css/oxigen-hajvizsgalat.css` | csak ennek az oldalnak a kiegészítő stílusa (az `oxigen-landing.css` / `oxigen-landing.js` VÁLTOZATLAN, a mintaoldal is) |
| `tools/ujrastilus-teszt/oxigen-hajvizsgalat.test.mjs` | tesztek (statikus + böngészős + dist) |

## Felépítés (a brief A–G szakaszai)
hős (H1 · alcím · 4 990 Ft · EGY fő gomb · hely + Térkép-link · 4,9 – 1 266 Google-értékelés) → **A)** „Mikor érdemes?” (`.jelek` komponens, ikonos kártyák) → **B)** „Mit kapsz 4 990 Ft-ért?” (sötét `.allapot`) →
**C)** kötelező figyelmeztető doboz (szó szerint) → **D)** „Ha kezelést választasz” (29 900 / 26 000 / 5 alkalmas bérlet) → **E)** „Ki vizsgál?” (Tündi, Vivien, Móni) → **G)** bizalom (Google-értékelés + Glamour-említés) → **F)** GYIK → hely → záró sáv.
Mobilon ragadós alsó sáv: az egyetlen fő gomb (az `oxigen-landing.js` a „Mikor érdemes?” szekció elgörgetése után mutatja, a záró sávnál eltűnik).

## Foglalás
- Fő gomb (az oldal EGYETLEN fő gombja, szövege mindenhol azonos): „Hajvizsgálatot foglalok – 4 990 Ft” → `/foglalo-motor?business=oxygen&service=466147` (Salonic: „AKCIÓS Hajkamerás vizsgálat és konzultáció”, 30 perc, 4 990 Ft).
- Másodlagos (csak lent, kisebb link): „Első kezelés hajkamerás vizsgálattal – 29 900 Ft” → `…&service=466110` (80 perc, 29 900 Ft).
- Fejléc FOGLALÁS gomb, Infó-ablak, lábléc: `<!--mh-foglalas:business=oxygen&service=466147-->` (az oldal fő konverziója a hajvizsgálat; ha Feri a nyitottabb `business=oxygen`-t kéri, a jelölő egy sora). Nyitvatartás: `<!--mh-nyitvatartas:hetkoznap-->` (csak H–P).
- Nincs `data-cta`, nincs mérőkód az oldalban; az `oxigen-landing.js` `data-cta`-s kattintás-eseménye így nem aktív.

## Ami NEM kerülhetett ki (megerősítésre vár / tiltott)
- A vizsgálat időtartama ([MEGERŐSÍTENDŐ] a briefben; a Salonic 30 percet ír: Feri megerősítheti).
- Szombati nyitvatartás (csak H–P szerepel az oldalon, a láblécben és az Infó-ablakban).
- Tiltott: gyógyulás- / eredményígéret, „trichológus”, „orvos” mint szolgáltató, „95% hatékonyság”; a Glamour-cikknél az eredményre utaló idézet kimaradt (csak az említés + link).
- A kezelők bemutatkozó mondatai kimaradtak (a fő oldalon „validálásra várnak”); csak név + szerep.

## Élesítés (ha Feri jóváhagyja)
1. `foglalas/hajvizsgalat-budapest.html`: a `<meta name="robots" content="noindex, nofollow">` sor (és az előtte lévő megjegyzés) ki.
2. Sitemap: `tools/wix-sitemap/pages-sitemap.xml` – új `<url><loc>https://www.mosaicheadspa.hu/hajvizsgalat-budapest</loc>…</url>` (mint a többi sor); a `tools/netlify-build.mjs` a Wix-sitemapet szó szerint adja ki.
3. Meta-pixel: az `assets/js/suti.js` `PIXEL_OLDALAK` listáján az oldal ma NINCS (az `oxigenterapia-budapest` / `oxigenterapia-ferfiaknak` a `PIXEL_FODRASZ` csoportban van): élesítéskor a `hajvizsgalat-budapest` kerüljön oda (védett mérési fájl: a mérési oldallal).
4. A teszt `noindex` és „nincs a sitemapben” ellenőrzése ekkor igazodik (élesítő PR).

## Mérés-lefedettség (helyi dist az éles hostnév alatt, kimenő mérés tiltva; `?gclid=TESZTGCLID1234567890&gbraid=…&wbraid=…&fbclid=…&ttclid=…`)
- Google-címke (GTM-PST2HB22 a `suti.js`-ből, minden élő oldalon): **fut**; a `_gcl_aw` süti létrejön a teszt-gclid-del (`GCL.<idő>.TESZTGCLID1234567890`); a Google-kérések viszik a gclid-et.
- `mh_attr` (localStorage, a `attribucio.js`): gclid / gbraid / wbraid mentve (alapértelmezett hozzájárulással); **figyelem: a `gclid` 10 karakternél rövidebb teszt-értéke (pl. `TESZT123`) a mintán nem megy át, ezért a teszt-gclid legyen ≥ 10 karakter.**
- TikTok-pixel: fut (4 kérés). **Meta-pixel: NEM fut** (az oldal nincs a `PIXEL_OLDALAK` listán).
- A fő gomb a foglaló-réteget nyitja (`#mosaic-booking-layer`), az oldal URL-je (és benne a kattintás-azonosítók) megmarad, a motor ezt a `location.search`-ből olvassa.
