# Medical Piercing – 8. kör: az őszi akció oldalának újratervezése, foglaló-finomítás – teszt-napló (2026-10-16)

Helyben, a végleges buildre (`node tools/build.mjs`, `node tools/serve.mjs`). A Salonic felé csak olvasó GET megy, foglalás nem indult.

## A tulajdonos kérései
1. Az akció-oldal (`/3-piercing-2-araert-regi`, menü: „Akció”) újratervezése a „Konverzió-újratervezés – képernyőtervek (mobil)” PDF 03-as terve szerint, az oldal stílusában
   („az összes szekció ugyanarról szól, csak az árat boncolgatjuk négyszer”). A PDF többi terve most nem.
2. Foglaló: a két sorba törő szűrősornál is a „Magamnak / 2 személynek” feljebb, a „Legjobban megéri” középen, nyíllal; a „Hogy néz ki egy szúrás?” sima link legyen.

## Mérés
**Mérőkódot nem érint.** A `suti.js`, `mp-meres.js`, `motor-indito.js`, `salonic-adapter.js`, `booking-id.js` nem változott. Az akció-oldal új gombjai ugyanazokat a foglalási
linkeket használják (`/idopontfoglalas`, Salonic helyszín-linkek), a motor-indító fogja el őket, a foglalásindítás mérése a típusválasztóban („Új piercing”) változatlanul fut.
Az „Ezt foglalom” csak a Piercing-lépés kezdő állapotát állítja be (`data-csomag` → `window.__mpCsomag` → `motor.js`). A hirdetési fiókokban semmi nem változott.
A PDF mérési pontjai (C0: booking_start, cta_click stb.) ebben a körben nem készültek el – a kérés az oldal újratervezése volt.

## Vendégadat
A 3 videós beszámoló a meglévő vendégvideók (borító a keresztnévvel, a tulajdonos korábbi döntése szerint). Új vendégadat nem került sehova.

## Eredmények
