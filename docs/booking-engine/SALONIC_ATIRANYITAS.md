# Régi Salonic-linkek átirányítása a főoldalra

Feri kérése (2026-10-24, a `https://mosaicheadspa.salonic.hu/selectSpecialization/?placeId=10427` linkkel): aki **teljes ablakban** (legfelső ablak) egy régi Salonic foglalóoldalt nyit meg,
az kerüljön a főoldalra (`https://www.mosaicheadspa.hu/`) – ugyanúgy, ahogy a Medical Piercingnél megoldottuk (`medicalpiercing/docs/SALONIC_ATIRANYITAS.md`, 2026-10-17; az A76 változata a Drive-on:
`a76-salonic-atiranyitas.html`). Ennek az értelme: a Salonicon közvetlenül végigvitt foglalás a Salonic saját köszönőoldalán ér véget, a mi köszönőoldalunk és a mérésünk nélkül; a főoldalról indított
foglalás a saját motoron megy, ott a mérés (booking_id, párosítás, platform-események) működik.

**Állapot: a repo-oldal kész (kód, GTM-címke szövege, teszt, leírás). A GTM-címke közzététele hátravan: amíg nincs közzétéve, a szkript sehol nem fut, semmi nem változik a Salonicon.**

## Hogyan működik

1. A Salonic-fiókok (`mosaicheadspa`, `mosaic-hair`, `mosaic-oxigen`, `mosaic-elysion`) mindegyike betölti a `GTM-PST2HB22` konténert (ellenőrizve 2026-10-24: az oldalak HTML-jében a `gtm.js?id=GTM-PST2HB22`).
   A `mosaic-pmu` fiókban **nincs GTM** (ott az átirányítás nem fut; lásd lent).
2. A GTM-ben egy **Egyéni HTML címke** ([gtm-salonic-atiranyitas.html](gtm-salonic-atiranyitas.html)) betölti a `https://www.mosaicheadspa.hu/salonic/atiranyitas.js` fájlt – **csak a legfelső ablakban** és csak `*.salonic.hu`-n.
3. A fájl (`salonic/atiranyitas.js`; a `/salonic/*` útvonalat a Cloudflare mindig ellenőrizve adja: `no-cache`) eldönti, hogy átirányít-e, és `location.replace`-szel a főoldalra visz
   (a Vissza gomb nem megy vissza a Salonicra). A főoldalra csak a kattintás-azonosítók (`fbclid`, `gclid`, `gbraid`, `wbraid`, `ttclid`, `msclkid`, `utm_*`) és az `mh_honnan=salonic` jelölő kerül; helyszínt / kezelést /
   szakembert nem viszünk át (a Salonic-címből ez bizonytalan), a foglaló nem nyílik meg magától.

**Átirányít** (a `mosaicheadspa`, `mosaic-hair`, `mosaic-oxigen`, `mosaic-elysion`, `mosaic-pmu` `.salonic.hu` tartományon): `/`, `/selectLocation`, `/selectSpecialization/`, `/showServices/`, `/employees/<id>/`, `/selectEmployee/`, `/selectDate/`.

**NEM irányít át:**
- keretben (a saját foglalónk iframe-je, az régi beágyazott foglalók is) – ott a fájl le sem töltődik;
- az adatlap (`/guestData/`), „A foglalásod” / lemondás (`/booking/*`, ide mutatnak az e-mail- és SMS-linkjeink), a köszönőoldal (`/success/*`), `/user/*`, ajándékkártya, jogi oldalak, nyelvváltás;
- ismeretlen paraméteres cím (pl. egy link azonosítója, tokenje);
- ha a címben vagy ebben a lapban korábban ott volt a `?mh_nincs_atiranyitas=1`;
- ha a hivatkozó a saját oldalunk (`*.mosaicheadspa.hu`: a vendég szándékosan ment a Salonicra), és az adott lapban azután sem;
- ha 30 mp-en belül ugyanoda másodszor kellene (hurok-védelem);
- más Salonic-fiók (pl. Medical Piercing) – a fájl a hostname-et is ellenőrzi.

A fájl semmit nem küld ki (nincs fetch / XHR / beacon / dataLayer / localStorage), a címet cseréli.

## Teszt

`node --test tools/test-salonic-atiranyitas.mjs` (36/36, helyben, Salonic-kapcsolat és külső hálózat nélkül: a Salonic-oldalakat és a főoldalt a böngésző helyben szolgálja ki, a GTM-címke kódja minden Salonic-dokumentumban lefut):
a szabálytábla (a user linkje is), mind az 5 fiók, a paraméterek megmaradása, a Vissza gomb, keret, a saját oldalról jövő vendég, hurok-védelem, kikapcsolt állapot, más Salonic-fiók.

## Élesítés (külső fiók: GTM – a mérési oldal / Feri végzi; Feri 2026-10-24-i kérése az engedély)

1. **GTM** (account `6261444190`, konténer `202031443` = `GTM-PST2HB22`): új munkaterület, benne
   - **címke**: „Salonic foglalóoldalak – átirányítás a főoldalra”, típus Egyéni HTML, tartalom: a [gtm-salonic-atiranyitas.html](gtm-salonic-atiranyitas.html) `<script>` blokkja (a megjegyzés nélkül is jó);
   - **trigger**: Inicializálás – minden oldal (vagy Oldalmegtekintés), feltétel: **Page Hostname végződik** `.salonic.hu` (a konténer a `www.mosaicheadspa.hu`-n is fut: ott a címke nem futhat);
   - tűzés: egyszer oldalanként; hozzájárulás: nincs további követelmény (funkcionális, nem mérés – mint a kupon-kitöltő címkénél).
   Előbb a GTM „Latest” (még nem közzétett) környezetével kipróbálható a valódi Salonic-oldalon (mint a `kupon-salonic-proba.mjs`), utána közzététel. Verziójegyzet: „Salonic átirányítás”.
2. Közzététel után: a `https://mosaicheadspa.salonic.hu/selectSpecialization/?placeId=10427` linket teljes ablakban megnyitva a főoldalra kell érkezni (`?mh_honnan=salonic`); a motor keretében a foglalás változatlanul megy
   (próba: egy `/foglalo-motor` foglalás az adatlapig, valódi foglalás nélkül). Mind a 4 fiókban érdemes egyet megnyitni (`mosaic-hair`, `mosaic-oxigen`, `mosaic-elysion`).
3. 24–72 óra: a Salonicon közvetlenül végigvitt foglalások aránya csökken, az átirányított érkezések a GA4-ben az `mh_honnan=salonic` jelölővel (page_location) láthatók; a QA-5 egyeztetőben a „Salonic → új mérés” párosítatlan foglalások száma nem nőhet.

**Visszaállítás** (azonnali): a GTM-címke szüneteltetése / törlése a konténerben (a kód ekkor meg sem töltődik), vagy a repóban a `salonic/atiranyitas.js`-ben `BE = 0` és merge (a fájl `no-cache`, a deploy után azonnal hat).

## Nyitott pont: `mosaic-pmu` fiók

A PMU Salonic-fiókban (`mosaic-pmu.salonic.hu`) nincs GTM, ezért ott az átirányítás nem fut. A kód erre is kész (a hostname-listában benne van). Ha a PMU-fiók régi linkjeit is át kell dobni, a Salonic-fiók
beállításaiban (app.salonic.hu → a PMU-fiók) a GTM-azonosító mezőbe a `GTM-PST2HB22` kellene – de ez a konténer **minden** többi címkéjét is betöltené a PMU-fiók oldalain (mérést érintő változás, a konténer
szabályait előbb át kell nézni), ezért külön döntés kell (Feri kifejezett kérése + a mérési oldal jóváhagyása); addig a PMU-fiók marad, ahogy van.
