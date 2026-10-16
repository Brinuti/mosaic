# Medical Piercing – rejtett B-változatok a konverziós képernyőtervek szerint – teszt-napló (2026-10-16)

Helyben, a végleges buildre (`node tools/uj-b-oldalak.mjs`, `node tools/build.mjs`, `node tools/serve.mjs`). A Salonic felé csak olvasó GET megy, foglalás nem indult,
űrlap nem ment el (a `/api/urlap` kérést a tesztek elkapják). A mérési próba (`tools/meres-teszt.mjs`) minden adatküldő kérést elkap és eldob: egyik platformhoz sem jutott el semmi.

## A tulajdonos kérése
„most éjjel az összes oldalból építs egy B verziót … kirakhatod élesbe, de nem fog rá link mutatni, szóval rejtett lesz. És mindenkit valósíts meg úgy, ahogy a PDF-ben van,
de utána menj rajta végig, és ellenőrizd, és ugyanígy formázd meg mint az akció oldalt … nem lehet teljesen üres ez a box … akkor egyszerűen csökkentsd le a képméretét.
És csökkentsd a box méretét.” (PDF: „MP_kepernyotervek_mobil_v2”.)

## Mi készült
19 rejtett oldal a `/b/` alatt: főoldal, a 9 piercing-típus, TikTok-landoló, páros akció, árlista + garancia, vélemények, garancia, fülpiercing (divat), elérhetőségek,
kontroll, a szúrás folyamata. Rejtett: noindex (meta és `X-Robots-Tag`), nincs canonical, nincs a sitemapben, semmi nem linkel rájuk. Az A-oldalak nem változtak.

## Mérés – MÉRÉST ÉRINT
A mérőkód fájljai (`suti.js`, `mp-meres.js`, `motor-indito.js`, `salonic-adapter.js`, `booking-id.js`) nem változtak. A B-oldalakon ugyanaz a mérőkód fut, mint az A-oldalakon
(a `suti.js` csak a www.medicalpiercing.hu-n tölti be). Két új foglaló-előválasztás (`motor.js` `nyit`, `uj-fooldal.js`): a páros gomb (`data-csomag="ketto"`) a „2 személynek”
csomagokkal, a vélemények-oldal típus-gombjai (`data-tipus`) a gomb saját típusával nyitják a foglalót. A foglalásindítás mérése ugyanazon az úton fut: csomag-gombnál
a helyszín-lépés megnyílásakor, csomag nélkül az „Új piercing” választásakor, nyitásonként pontosan egyszer (a próba a `mpSuti.foglalasInditas` hívásait számolja: 1);
a kontroll- és garancia-űrlap nyitása nem foglalásindítás (0). A Salonic-linkes gombok mérése a kattintáskor a `suti.js`-ben, változatlanul. Új konverzió, új esemény,
külső fiók módosítása nincs. A/B-szétosztás (forgalom-felosztás) nem készült: ehhez a tulajdonos külön döntése és a mérési oldal egyeztetése kell.

## Vendégadat
Nem került vendégadat a repóba. A slim-videók új, semleges borítóin csak a vendég keresztneve áll (mint eddig), idézet nélkül; a fájlnevekben nincs név.

## Eredmények
| Teszt | Eredmény |
|---|---|
| `tools/uj-b-teszt.mjs` (új; 19 B-oldal, asztali + iPhone 13) | 1042 ellenőrzés, 0 hiba: rejtettség (noindex, nincs canonical, nincs a sitemapben), egy h1, alt, horgonyok, minden kép betölt, nincs vízszintes görgetés 360–1920 px között, nincs üres doboz (asztalon), a mobil hős sorrendje, a ragadós sáv felirata egy-egy sorban, a belső linkek élnek, minden foglaló-gomb megnyitja a foglalót, az előválasztás a gomb szerint (1 / 2 / 3 piercing, 2 személynek, a gomb típusa), a foglalásindítás mérése pontosan 1-szer, a kontroll- / garancia-űrlap nyitása 0-szor; a TikTok-B-n nincs tiltott szó |
| `tools/uj-oldalak-teszt.mjs` (mind) | 174 oldal, 5729 ellenőrzés, 0 hiba (az A-oldalak változatlanok) |
| `tools/uj-oldalak-teszt.mjs --forras` | 1224 ellenőrzés, 0 hiba |
| `tools/uj-fooldal-teszt.mjs` | minden rendben (102 ellenőrzés) |
| `tools/motor-tipus-teszt.mjs` / `--mobil` | minden rendben (120 / 124 ellenőrzés) |
| `tools/motor-teszt.mjs` / `--mobil`, `tools/motor-formazas-teszt.mjs` | minden rendben (26 / 26 / 90 ellenőrzés) |
| Akció-oldal csomag-gombjai (Playwright, asztali + iPhone 13) | minden rendben (12 ellenőrzés) |
| `tools/meres-teszt.mjs` (éles domainnév, adatküldés nélkül) | az első futáson 1 hiba: a GTM-T9GR4JCK szkript letöltését a próba nem pontosan egyszer látta (külső letöltés a proxyn át); az újrafuttatás: minden rendben (85 ellenőrzés). A mérőkód nem változott. |

A képernyőképeket (1440 px és 390 px, minden B-oldal) szakaszonként átnéztem; javítva: üres dobozok (allergia-videó kompakt dobozban, „Hova szúrjuk?” lista, „Kinek jó?”),
a főoldal „Hogy zajlik?” képe (a levágott fali logó helyett munka közbeni fotó), a ragadós sáv sortörései, ismétlődő szavak (Csomagárak, „nem orvosi kezelés”).
