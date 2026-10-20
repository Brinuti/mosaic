# Áthelyezett foglalás: a régi kulcs felszabadítása (DECISION #199 / #200) – mérési napló, 2026-10-19

Vendégadat nincs benne (csak üzletág, UUID-előtag, időbélyegek).

## 1. Az ok (TÉNY, a Salonicból, csak olvasás)
- HeadSpa `c1df8cd3` (a `b39d2de4` kulcsának régi birtokosa): a kulcs `10427|24989|1795019400` = 2026-11-18 16:30:00Z (17:30 Budapest). A foglalás megtekintés-oldala „Visszaigazolt”, de **nincs** `startDate` / „Foglalás módosítása” link (a parser `startUnix: null`), a látható dátum november 19. (csütörtök) 17:30.
- A Salonic naptár-exportja (`/booking/addToCalendar/<uuid>/ios`) az **aktuális** kezdetet adja: `DTSTART:20261119T163000Z` = 2026-11-19 16:30Z = 17:30 Budapest. A kulcs egy nappal korábbi: a vendég a foglalást áthelyezte, a kulcstábla a régi kezdetet őrzi.
- A korábbi kódban a `foglalasAllapot` ezt `aktiv`-nak látta, az erre a régi időpontra érkező új foglalás ezért „két élő foglalás azonos kulccsal” `ellentmondas` + riasztás lett (HeadSpa `8accdc58`, `b39d2de4`; nincs esemény).

## 2. Az UTC-feltevés igazolása (13 nem áthelyezett foglalás, mind az 5 Salonic-fiók)
A naptár-export `DTSTART` (UTC, mp) összevetve a D1-ben tárolt kezdettel / a kulcs 3. szegmensével: **13/13 másodpercre egyezik**, mindegyik export 1 db `DTSTART`, HTTP 200, a `lekerSzoveg` fejléceivel (`accept: text/html`).
fodrász ×3 (`ff130617`, `60e751f6`, `8c93723e`), HeadSpa ×3 (`07917640`, `ded99d6d`, `c54ef786`), oxigén ×3 (`912c74ad`, `3927a9c0`, `7764a6a7`), szőr ×2 (`c346cfc3`, `000ca37f`), PMU ×2 (`8e3e76cf`, `5cc62a01`); a kezdetek 2026-10-20 és 2026-11-30 között (nyári és téli időszámítás is). Eltérés 0, hiba 0.

## 3. A javítás (netlify/lib/foglalas-kulcs.js)
Ha a kulcs birtokosa `aktiv`, az aktuális kezdet: 1. a megtekintés-oldal linkjének kezdete; 2. ha nincs link: a naptár-export (pontosan egy UTC `DTSTART`, érvényes dátum, tartomány). Ha eltér a kulcs kezdetétől: a kulcs felszabadul, az új foglalás kapja (átadás oka: „áthelyezve”, a forrással). Ha egyezik, vagy az export nem olvasható / érvénytelen: `ellentmondas` (fail-closed); átmeneti exporthiba (hálózat, 5xx): függőben, újrapróbálás.

## 4. Tesztek
`node --test tools/test-foglalas-kulcs.mjs`: 46/46 (a delta-review nit-jei után is; új: `foglalasKezdet` egységtesztek – TZID-s, Z nélküli, több, érvénytelen, tartományon kívüli DTSTART, http-hiba, hálózati hiba, idegen host, rossz uuid; áthelyezett birtokos naptár-exporttal; áthelyezett birtokos, ha az oldal linkje más kezdetet mutat; azonos kezdet / nem olvasható export → `ellentmondas`; átmeneti exporthiba → függőben).
Kapcsolódó csomagok zölden: `test-meres`, `test-qa-nap`, `test-google-proba`, `test-salonic-direct`, `test-sd-194`, `test-sd-headspa`, `test-qa4-smoke`. (`test-fuggetlenseg` 3. esete a main-en is bukik, nem ez a PR.)

## 5. Védett elemek (blob-hash, main -> PR)
- `netlify/lib/meres/google-proba.js` f1bb0095f8 -> f1bb0095f8 (változatlan; a main a8bb89ca-n)
- `netlify/lib/meres/vegpontok.js` 085bed6aad -> 085bed6aad (változatlan; a main a8bb89ca-n)
- `netlify/lib/meres/qa-nap.js` 2334390be3 -> 2334390be3 (változatlan)
- `netlify/lib/meres/esemeny-modell.js` 4342e6f09b -> 4342e6f09b (változatlan); a `netlify/lib/meres` fa 776c1e6ddb -> 776c1e6ddb (változatlan)
- `netlify/lib/foglalas-kulcs.js` e1448b4d13 -> 574f59b000 (VÁLTOZIK: ez a PR tárgya, dokumentált); ezzel a `netlify` fa ed2e028751 -> 79c649b20d (a main a8bb89ca-n)

## 6. Nyitott / korlát
A két kiesett sor (`8accdc58`, `b39d2de4`) `ellentmondas` állapotban marad, amíg a párosítást (az eredeti e-mail-adatokkal) újra nem futtatják; az `egyeztet` az `ellentmondas` sort újrafuttatja (nem lezárt állapot). Ha A-t ugyanarra az időre, de másik munkatárshoz helyezik át, a kezdet egyezik: a (régi) hamis ellentmondás marad.
