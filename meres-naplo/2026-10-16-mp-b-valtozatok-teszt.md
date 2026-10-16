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
EREDMENYEK
