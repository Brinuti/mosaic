# Medical Piercing – 5. kör (élesítés után): vendégvideó-borítók, Facebook-videók borítója, fülikonok, dupla véleménylink – teszt-napló (2026-10-16)

Helyben, a végleges buildre (`node tools/build.mjs`, `node tools/serve.mjs`). A Salonic felé csak olvasó GET megy, foglalás nem indult.

## A tulajdonos kérései
1. A 09-es próba-borító mintájára mind a 37 vendégvideó borítót kap; alul ne „Vendégünk videós beszámolója” álljon, hanem közvetlenebb szöveg a vendég nevével
   („Katinak így segített a migrén piercing”).
2. Az árlista-doboz fülikonjai (1 / 2 / 3 / 2×2) kapjanak szebb, GPT-vel rajzolt ikont.
3. „Valahova kétszer raktad be a Tovább az összes véleményhez”-t – fuss egy kört.
4. Az álló videókhoz (pl. „Ricsi elmondja, hogyan érsz el minket”) is legyen borító.

## Mérés
**Nem érint mérést.** A mérőkód fájljai (`suti.js`, `mp-meres.js`, `motor-indito.js`) nem változtak. A Facebook-videók borítója miatt a lap betöltésekor a
`facebook.com` egyáltalán nem töltődik be (a lejátszó csak a borítóra kattintva) – ez kevesebb külső kérés, a Meta-pixelhez nincs köze.

## Vendégadat
A borítókon a tulajdonos kérésére a vendég keresztneve látszik (a videóban ő maga mondja). A fájlnevekben nincs név, a név–sorszám összerendelés és az idézetek
adatfájlja a repóba nem került (csak a munkamenet ideiglenes mappájában volt). A mondatok a videók leiratából valóban elhangzott mondatok (a beszédfelismerés hibáit
javítva); a vendégek arcát nem módosítottuk, a kockák felirat nélküli valódi képkockák (a beégetett feliratos és a teljes névvel feliratozott kockák kizárva).

## Eredmények
| Teszt | Eredmény |
|---|---|
| `tools/uj-oldalak-teszt.mjs --forras` (új ellenőrzés: nincs egymás után kétszer „Tovább az összes véleményhez”) | a javítás előtt 14 oldalon hibát jelzett (a piercing-oldalakon és a `/fooldal-b`-n az eredeti oldal saját linkje után a mienk is); javítva: 1224 ellenőrzés, 0 hiba |
| `tools/uj-oldalak-teszt.mjs` (mind) | EREDMENY_UO |
| `tools/uj-fooldal-teszt.mjs` | minden rendben |
| Facebook-borító (Playwright, asztali + iPhone 13, `/kapcsolat`, `/a-szuras-folyamata`) | betöltéskor 0 Facebook-kérés; kattintásra ugyanakkora iframe (`autoplay=true`) a borító helyén |
| Árlista-doboz (asztali 1440, iPhone 13) | az ikonok a körben, a jelvény nem takarja a fület; az akciós kártyán világos kör |
| 37 vendégvideó-borító, 7 Facebook-borító | áttekintő lapon szemmel ellenőrizve: nincs beégetett felirat, névsáv, TikTok-jel a fotón; a szöveg sehol nem lóg rá a névsorra (a sablon hibát jelez, ha nem fér el) |
