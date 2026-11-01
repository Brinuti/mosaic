# /sminktetovalas-eltavolitas-budapest – sminktetoválás-eltávolítás (lézer), fotós előszűréssel

Első verzió: 2026-11-01 (Feri kérése: „mehet kiélesre, és nézzük át”). Fájlok: `foglalas/sminktetovalas-eltavolitas-budapest.html`,
`assets/css/eltavolitas-landing.css`, `assets/js/eltavolitas-landing.js`, `assets/img/eltavolitas/`, `assets/video/eltavolitas-kezeles.mp4`,
teszt: `tools/eltavolitas-teszt/eltavolitas.test.mjs`.

## Alapelvek
- **Nem foglalható online** (`docs/booking-engine/DECISIONS.md` 3.): csak fotó alapján indul. Nincs Salonic-szolgáltatás, a foglaló nem érintett.
- **A foglalási folyamathoz, a `foglalo-pmu.js`-hez, a `suti.js`-hez, a GTM-hez nem nyúl** (csak új fájlok; semelyik meglévő fájl nem változott).
- **Eredményígéret nincs** (nincs „teljes eltűnés”, „hegmentes”, „nyom nélkül”, „garantált”); a teszt tiltott kifejezés-listával őrzi.
- **Nem került ki** (nem vállalt / nem igazolt): haladás-kontroll, bérletvédelem, 90 napos ártartás, a lézer típusa, képesítések, eltávolítási esetszám, a szalon Google-értékelése.
- A képek: lézervédő szemüveges vendégek (a hozzájárulást Feri megerősítette, 2026-11-01), EXIF nélkül. A „közvetlenül utána” kép NEM végeredmény, az oldal így is címkézi.

## A fotós lead
Az oldal saját kis űrlapja (név, telefon, e-mail, terület, 1–5 fotó, hozzájárulás) a MEGLÉVŐ `pmu-proba-foto` űrlap-levélre megy (`POST /`, `netlify/lib/levelek.js`),
ugyanúgy, ahogy a `/foglalo-pmu` fotóküldése. A levélben az „Ág”, a „Kezelés / terület” és a „Beküldve innen” mező **eltávolítás-jelölést** kap
(`Eltávolítás – lézeres, fotó alapján`, `Sminktetoválás eltávolítás – <terület> (fotó alapján)`, `sminktetovalas-eltavolitas-budapest`), így Melitta a levélből látja, mi ez.
A fotókat a böngésző 1600 px-re kicsinyíti. Az űrlap `method="post"` (JS nélkül sem kerül személyes adat az URL-be / a GA4 `page_location`-be).

**Mi indul el a levélből (meglévő Zapier-lánc, ezt a PR nem módosítja; csak olvasva ellenőriztem, 2026-11-01):**
`weboldal-pmu-visszahivas-to-sheet-oktober` (Gmail-trigger: `from:mosaicheadspa@gmail.com subject:Sminktetoválás (visszahívást OR fotó)`) →
sor a „Melitta - PMU - Ajánlatkérések” táblázat „Október” munkalapján (Szolgáltatás: „PMU – weboldal, fotót küldött”; az Üzenet oszlopban a „Kezelés: Sminktetoválás eltávolítás – <terület> (fotó alapján)” és az „Oldal: sminktetovalas-eltavolitas-budapest”),
a fotók a Drive „Mosaic PMU – weboldali vendégfotók” mappa vendégenkénti almappájába, majd `melitta-pmu-oktober-sms` → **automatikus SMS a vendég telefonszámára**:
„Szia! Lattam a jelentkezesed, hamarosan hivlak. Mentsd el a szamom, hogy tudd, en kereslek: 06707753965 - Melitta”.
Ez eltávolítás-leadnél is megy (a szöveg általános, nem sminktetoválás-specifikus); az űrlap a telefonmezőnél jelzi: „rövid, automatikus visszaigazoló SMS is érkezhet”.
A Zap `Ág`-értéket nem dolgoz fel, minden általunk küldött mező (Név, Telefonszám, Kezelés / terület, E-mail, Fotó n, Beküldve innen) a meglévő mezőnevekkel megy.

## Mérés (a mérési oldal dolga; ez a PR nem kapcsol be konverziót)
- Az oldal nem tölt mérőkódot, nincs `data-cta`. A `suti.js` PIXEL-listái nem változtak.
- Egyetlen **új, semmihez nem kötött** dataLayer-esemény: `eltavolitas_foto_lead` (sikeres fotóküldés után; csak `ana` hozzájárulással, próbajeles böngészőben nem;
  mezők: `business=pmu`, `lead_type=removal_photo`, `source_page`, `event_id`, `foto_db`, `terulet`; név / e-mail / telefon / fotó / URL nincs benne).
  GTM-címke és platform-leképezés **nincs** rá: ez külön mérési DECISION és külső fiók-változtatás (Feri külön kérése).

## Indexelés
Az első verzió `noindex, nofollow`, nincs sitemap-bejegyzés, nincs rá link az oldalról (hirdetésből / közvetlenül linkelhető).
Indexelhetővé tétel: a `<meta name="robots">` sor törlése + bejegyzés a `tools/wix-sitemap/pages-sitemap.xml`-be + (Feri döntésével) belső link a `/sminktetovalas-budapest` oldalról.

## Feri által megerősítendő (az oldalon most a javasolt érték áll)
1. Árak: fotós előszűrés díjmentes; teljes szemöldök 20 000 Ft/alkalom; részleges / korrekció 15 000 Ft-tól; ajak, szájkontúr 20 000 Ft-tól.
2. „1 munkanapon belül válaszolok”: tartható-e, és ki válaszol (a levelet a szokásos `pmu-proba-foto` címzett kapja).
3. Hétfő–péntek nyitvatartás (a szombat megerősítésig nincs kiírva: `<!--mh-nyitvatartas:hetkoznap-->`).
4. A kép-párosítás: a „előtte / közvetlenül utána” pár a két legutóbbi (kék-szürke → halványabb) szemöldökkép; a másik két kép csak „az első alkalom során” címkét kapja.
5. A „garancia” szó nincs használva; a három vállalás (előszűrés, átlátható ár, szakmai stop) jogi átnézése javasolt, mielőtt hirdetés indul.
6. A „Mikor nem vállalom?” lista (ellenjavallatok) és a GYIK szakmai tartalmát Melittának jóvá kell hagynia; az adatkezelési hozzájárulás egészségi állapotra utaló adatról szól, és (a meglévő mintát követve) az ÁSZF-re hivatkozik – külön adatkezelési tájékoztató / jogi átnézés javasolt. Az is ellenőrizendő, ki végezhet Magyarországon lézeres tetoválás-eltávolítást.
7. A fejléc „Foglalás” gombja a PMU-foglalóra visz (új sminktetoválás), nem eltávolításra – az eltávolítás online nem foglalható.
8. A meglévő Zapier-lánc az „Október” munkalapra ír (a munkalap neve a hónapváltás után maradt): ezt Feri / a mérési oldal tudja, a PR nem nyúl hozzá.
9. A `suti.js`-ben az `ana` hozzájárulás alapból engedélyezett (DECISION #170), ezért az `eltavolitas_foto_lead` alapértelmezetten bekerül a dataLayerbe; érdemes megnézni, hogy a GTM-ben nincs-e „minden esemény” trigger. (A GTM és a GA4 a `suti.js`-en át ezen az oldalon is betöltődik, mint minden oldalon; Meta-pixel nincs.)

## Visszavonás
Az oldal csak új fájlokból áll: a PR visszavonása (revert) vagy a `foglalas/sminktetovalas-eltavolitas-budapest.html` törlése mindent visszaállít, más oldalt nem érint.
