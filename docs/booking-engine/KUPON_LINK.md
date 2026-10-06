# Kuponkód a foglaló linkjében (`?kupon=`)

**Mit tud:** ha a foglaló linkjében (vagy az oldal címében) ott van egy kuponkód, a vendég az **adatlapon (Salonic)** a „Kupon / Ajándékutalvány kód" mezőben **már kitöltve találja**, és a Salonic le is ellenőrzi („Kód ellenőrzése" – mintha begépelte volna). Mindegy, honnan érkezik: bármelyik oldal, bármelyik „Időpontfoglalás" gomb, az önálló `/foglalo-motor` oldal. (Feri kérése, 2026-10-06.)

```
https://www.mosaicheadspa.hu/foglalo-motor?business=headspa&kupon=NYAR20          (a foglaló oldala)
https://www.mosaicheadspa.hu/headspa-budapest?kupon=NYAR20                         (bármelyik oldal: a kód megmarad, amíg a vendég ott van az oldalon)
<button data-booking="business=hair&kupon=NYAR20">                                 (gomb)
openBooking({ business: 'oxygen', kupon: 'NYAR20' })                               (kód)
```

Más névvel is megy: `kuponkod=`, `coupon=`. Érvényes kód: betű, szám, kötőjel, alsóvonal; 3–40 karakter (minden más figyelmen kívül marad, nincs hibaüzenet).

## Hogyan működik (két rész)

A Salonic **nem** fogadja el a kódot az adatlap címéből (11 elnevezést kipróbáltunk: a mező üres marad), és az adatlap másik tartományon (`*.salonic.hu`) fut, ezért a mi oldalunk nem írhat bele közvetlenül. Ezért:

1. **A foglaló (ez a repo)** megjegyzi a kódot, és az adatlap keretének **nevébe** teszi (`<iframe name="mhk:NYAR20">`). Nem kerül az adatlap címébe, így nem jut el a Google Analyticsbe, a Metához, a referrerbe, a naplókba.
   - forrás a linkből / a gombból / az oldal címéből (`?kupon=`); az oldalra érkezéskor a `booking-launcher.js` a munkamenet végéig megjegyzi (`sessionStorage: mh_kupon`), így akkor is működik, ha a vendég először egy kuponos linken érkezik, aztán másik oldalra lép, és ott nyit foglalót. Sikeres foglalás után törlődik.
2. **Egy kis szkript a Google Tag Managerben** (cimke: „Salonic adatlap - kuponkod kitoltese", trigger: „Salonic adatlap (guestData) - oldalbetoltes"; forrás: [gtm-kupon-kitolto.html](gtm-kupon-kitolto.html)) – ez már amúgy is fut a Salonic adatlapokon (mind a négy fiókban betölti a `GTM-PST2HB22` konténert). A keret nevéből kiolvassa a kódot, beírja a mezőbe, lefuttatja a Salonic saját ellenőrzését (`keyup`), törli a nevet, és visszaszól a foglalónak (`postMessage`).

A foglaló az adatlap fölött egy kis sort ír ki: **„Kuponkód: NYAR20 · beírtuk az űrlapba ✓"**. Ha 4 másodperccel az adatlap betöltése után nincs visszajelzés (pl. a hirdetés-blokkoló letiltotta a szkriptet), a sor ezt írja: **„ha nem látod az űrlapban, másold be a Kupon mezőbe: [Másolás]"** – a gomb a vágólapra teszi a kódot.

## Mit nem csinál
- A lézeres szőrtelenítés Salonic-adatlapján **nincs** kupon mező (ellenőrizve 2026-10-06), ott a `?kupon=` nem tesz semmit (`flows/laser.js: acceptsCoupon: false`).
- Ha a vendég már beírt valamit a mezőbe, nem írjuk felül.
- A kódot semmilyen mérési esemény, számláló, dataLayer, localStorage vagy URL-állapot nem tartalmazza. A Salonic a saját ellenőrző hívásában kapja meg (ez a vendég saját begépelésével azonos).
- A kupon **nem választ** kezelést / nem lépteti át a „kuponos" (voucher) szolgáltatás-ágat: az adatlapra való beírást végzi. (A kuponos kezelések kiválasztása a foglaló jelenlegi folyamata szerint történik.)
- A kuponkód érvényességét a Salonic dönti el; hibás / lejárt kódra a Salonic a saját üzenetét mutatja („A megadott kód sajnos nem használható!").

## Biztonsági megjegyzés
A kód a linkben van, tehát aki a linket látja, látja a kódot. Marketing-kuponra (NYAR20) ez rendben van; **egyszer használatos, személyes ajándékkártya-kódot ne tegyünk nyilvános linkbe.**

## Tesztek
- `node --test tools/test-booking-flow.mjs tools/test-booking-layer.mjs` (a kód-szabály, a kontextus-átadás, az URL-állapotba nem kerül, a launcher szabálya egyezik).
- `node tools/meres-proba/kupon-proba.mjs --overlay dist [--mobil 1]`: böngészőben, szimulált adatlappal (a valódi GTM-szkripttel): CTA / oldal-cím / másik oldal (munkamenet) / érvénytelen kód / előre kitöltött mező / hiányzó szkript (kézi tartalék, vágólap) / elrendezés; a kód nincs a kimenő kérésekben, a dataLayerben, a Salonic-címben. 23 ellenőrzés asztali, 24 mobil, 0 hiba.
- `node tools/meres-proba/kupon-salonic-proba.mjs --overlay dist --gtm-kornyezet 2:<kod>`: **a valódi Salonic adatlapon**, a GTM **még nem publikált** verziójával (beépített „Latest" környezet): a mező kitöltődik, a Salonic ellenőrzése lefut. Nélküle (`--gtm-kornyezet` nélkül) az éles GTM-mel fut: kontroll – amíg a cimke nincs közzétéve, a mező üres marad, a foglaló a kézi tartalékot mutatja.

## GTM
- Account `6261444190`, konténer `202031443` (`GTM-PST2HB22`). Munkaterület: **62**; új trigger **234**, új cimke **235**; létrehozott verzió: **53** (= az élő 52 + ez a cimke). Visszaállítás, ha gond lenne: az 52-es verzió közzététele.
- **Élesben:** a repo-változtatás (PR #137) és a GTM 53-as verziója **2026-10-06-tól él** (a tulajdonos jóváhagyásával). Élesen ellenőrizve a valódi Salonic adatlapokon (`kupon-salonic-proba.mjs`, `--uzletag hair|oxygen|headspa`, hamis kóddal; mind 8/8, a hair mobilon is).
- A cimke addig sem csinál semmit, amíg a foglaló nem ad át kódot: ablak-név nélkül azonnal kilép.
