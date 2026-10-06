# A foglaló saját foglalás-azonosítója (booking_id) – QA-1

Állapot (2026-10-06): **megépítve, előnézeten tesztelve, és a valódi próbafoglalás is lefutott (13:15 UTC): a Salonic a sikeres foglalás utáni átirányítás `bookingUrl` paraméterében VISSZAADJA a `back=<azonosító>` értéket; az értesítő e-mailben NINCS benne** (lásd „A valódi próbafoglalás eredménye”). Élesre semmi nem ment, a PR draft.
Háttér: DECISION-LOG #97 (saját foglalásazonosító, correlation_id, blokkoló feltétel a szerveres mérésnél). Kód: `assets/js/booking-engine/booking-id.js`, `salonic-adapter.js`, `engine.js`, `tracking.js`.

## Mit csinál a foglaló

1. **A folyamat elején** (`startEngine`, vagyis a foglaló megnyitásakor) generál egy azonosítót: `mb_` + 9 jegyű base36 időbélyeg + 14 véletlen karakter, pl. `mb_0muwowb7c2grmyxin1a864a` (csak `[a-z0-9_]`, kb. 26 karakter, személyes adat nincs benne).
2. **Elmenti a böngésző mérési kontextusába**: `sessionStorage['mhBookingCtx']` (JSON): `id, created, seen, business, source_page, service_id, slot_unix, staff_id (-1 = bármelyik), carrier ('back'), sent_at, returned {returned, where}, completed_at`. Személyes adat és a Salonic vendég-azonosítója (`g`) nincs benne.
   - Bezárás–újranyitás: ugyanazt a (lezáratlan, 30 percnél nem régebbi) foglalást folytatja.
   - Sikeres foglalás után a kontextus lezárul (`completed_at`), a következő foglaló új azonosítót kap; a köszönőoldal (ugyanabban a lapfülben, azonos eredeten) a lezárt kontextust még 30 percig olvashatja.
   - Mintanézetben (`?minta=…`) nincs tárolás.
3. **Minden `booking_*` eseményen** (a régi `tracking.js`-szerződés: `booking_service_selected`, `_slot_viewed`, `_slot_selected`, `_details_started`, `_completed`) rajta van a `booking_id`. A `booking_completed` új paraméterei: `booking_ref` (a korábbi szintetikus `g-serviceId-startDate`, ami eddig a `booking_id` helyén ment) és `booking_id_echo` (`bookingUrl:back` / `param:<név>` / `none`). Ezek a események továbbra sem kapcsolódnak semmilyen hirdetési fiókhoz.
   - A **lépés-mérés** (`lepes-meres.js`, GA4 `booking_open`, `booking_business`, … és a névtelen számláló) **változatlan**, nincs rajta `booking_id`: a GA4-be vitelhez a GTM-ben külön döntés és egyedi dimenzió kell.
4. **Átadás a Salonicnak** (C4, az adatlap betöltésekor): az azonosító a `/guestData/` cím **`back`** paramétereként megy:
   `https://mosaic-hair.salonic.hu/guestData/?placeId=10823&serviceId=232804&employeeId=-1&startDate=1792512000&back=mb_0muwowb7c2grmyxin1a864a`

## Miért a `back` paraméter (mérés, 2026-10-06, csak olvasás: GET, foglalás nélkül)

A Salonic adatlap címére tett ismeretlen paraméter sorsa:

| eset | eredmény |
|---|---|
| `employeeId=-1` (bármelyik szakember) + **ismeretlen** paraméter (`mosaic_booking_id`, `comment`, `utm_source`, `x`) | a Salonic a **kanonikus címre irányít** (`anyone=true&employeeId=<kiosztott>&placeId&serviceId&startDate&back=`), az ismeretlen paramétert **eldobja** |
| `employeeId=-1` + `back=<érték>` | a `back` **megmarad** a kanonikus címben |
| konkrét `employeeId` (a Salonic nem irányít át) + `back=<érték>` | megmarad |
| kanonikus cím + ismeretlen paraméter | megmarad (ide is oda is) |

A `back` az adatlapon **három helyen** szerepel: a betöltött oldal címében, az űrlap `action`-jében és a foglalás-küldés (AJAX POST) címében. Négy Salonic-fiókon mértem (HeadSpa, Oxigén, Lézer, Fodrászat), „bármelyik” és konkrét szakembernél is: mindenhol ugyanígy. A PMU-fiókot nem mértem (a PMU-foglaló külön oldal: `foglalo-pmu.js`, a motor nem érinti).

Az adatlap mezői (`GuestDataForm[guestComment]` stb.) URL-ből **nem előtölthetők** (a `comment`, `guestComment`, `GuestDataForm[guestComment]` kipróbálva): a vendég megjegyzés-mezőjébe, és így az értesítő e-mail szövegébe, URL-lel nem lehet azonosítót vinni.

**A foglalás-azonosító a Salonic oldalán:** a Salonic saját azonosítója (UUID, pl. `85ebd7de-61c6-79fa-d1c5-c9303082fb23`) a `handleSuccess` válaszában (`response.booking.id`) van, és a lemondó link is ezt használja (`/booking/cancelBooking/<uuid>`). A köszönőoldalra irányító `redirect.url`-ben ezt eddig nem láttuk.

## Hogyan olvassuk vissza

`verifyConfirmation(href, expected)` új mezője: `bookingId: { sent, returned, where }` – a Salonic átirányításának saját paraméterei és a `bookingUrl` paraméterei között keresi a **pontosan egyező** azonosítót (`where`: `bookingUrl:back` / `param:<név>`). **Nem szab ki hibát**: a hiányzó visszhang nem teszi hamissá a foglalást (a siker továbbra is a Salonic átirányításán múlik).

## Mit bizonyít a mostani teszt, és mit nem

| | Állapot |
|---|---|
| Az azonosító a folyamat elején születik, a kontextusba kerül, minden `booking_*` eseményen rajta van | **igazolt** (`node tools/meres-proba/booking-id-proba.mjs --overlay dist`: 17/17; egységtesztek: `tools/test-booking-id.mjs`, `tools/test-salonic-adapter.mjs`) |
| A Salonic **valódi** adatlapja megkapja és megőrzi a `back` paramétert (cím, `action`, AJAX-cím) | **igazolt** az előnézeten: `claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`, száraz futás a valódi adatlapig (`booking-id-valodi.mjs --szaraz 1`, foglalás nélkül), [meres-naplo/booking-id-qa1-2026-10-06.txt](meres-naplo/booking-id-qa1-2026-10-06.txt) |
| A Salonic a sikeres foglalás utáni átirányításban (`bookingUrl`) **visszaadja** | **igazolt** valódi próbafoglalással (2026-10-06 13:15 UTC, előnézet, ingyenes fodrász-konzultáció, azonnal lemondva): a köszönőoldal-cím `bookingUrl=https://mosaic-hair.salonic.hu/guestData/?anyone=true&employeeId=25095&placeId=10823&serviceId=232804&startDate=1792512000&back=mb_0muwpbdf5il7bwt0ll9wjmd`; az átirányítás útvonala (`/fodrasz-ok`) és a többi paraméter nem változott, a foglalás sikeres volt (a `back` nem átirányítási cél) |
| A visszhang a motor ellenőrzőjén | **igazolt** (a rögzített valódi cím visszajátszása): `verifyConfirmation.ok = true`, `bookingId = {sent, returned: true, where: 'bookingUrl:back'}`, `bookingRef` változatlan (`g:3385039-232804-1792512000`) |
| A GTM éles v52 `bookingUrl`-feldolgozói (175, 182) a `back=mb_…` véggel | **igazolt** (a változók kódja a rögzített valódi címen futtatva): ugyanazt adják, mint az azonosító nélküli címen (`hs-3385039-232804-1792512000`, `fodraszok-3385039-232804-1792512000`) |
| Az értesítő e-mailben visszajön | **NEM jön vissza**: a Salonic visszaigazoló e-mailjében (és így a belőle induló Zapier-folyamatok bemenetében) nincs `mb_…`; csak a Salonic saját UUID-ja van a „Foglalás részletek” / „Lemondom” linkekben és a `reservationNumber`-ben |
| Szerver-oldali (Zapier) kimenet a próbafoglalásra | a Meta CAPI folyamat futása: `reason: "teszt-foglalas", skipped: true` (érték olvasva); a Google Ads – Fodrászat és a PII-dúsítás futása ugyanilyen kimenet-alakú (`reason` 14 karakter, `skipped`), az értéket nem olvastam: semmi nem ment ki |

## A valódi próbafoglalás eredménye (2026-10-06 13:15 UTC)

Egy foglalás, az előnézeten (`claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`), `booking-id-valodi.mjs`: ingyenes fodrász-konzultáció, 2026-10-20 (kedd) 18:00–18:30 (a Salonic Noelhez osztotta), „TESZT – Claude”, a tulajdonos telefonszáma, hírlevél nem. A kimenő mérés tiltva volt, az éles köszönőoldalt a szkript **nem töltötte be** (a keret navigálását elfogta, csak a címet naplózta). Azonnal lemondva (`lemond.mjs`: „Az időpont lemondása sikeres volt!”; a foglalás-részletek oldalon „Időpont törölve!”). Nyers napló: [meres-naplo/booking-id-qa1-2026-10-06.txt](meres-naplo/booking-id-qa1-2026-10-06.txt).

- Azonosító: `mb_0muwpbdf5il7bwt0ll9wjmd`. Az adatlap címében, az űrlap `action`-jében és (a Salonic oldalán) a foglalás-küldő címben is ott volt.
- A köszönőoldal-cím: `/fodrasz-ok?first_booking=true&service=…&price=0&location=Mosaic+Hair&employee=Noel+-+20%25+kedvezmény!&g=g:3385039&bookingUrl=<kanonikus adatlap-cím>&back=mb_0muwpbdf5il7bwt0ll9wjmd` – az azonosító **csak a `bookingUrl` belsejében** jött vissza (a köszönőoldalnak nincs saját `back` paramétere).
- A Salonic saját foglalás-UUID-ját (`86fd2256-…`) a szkript az AJAX-válaszból nem tudta kiolvasni (a keret a válasz után azonnal navigál), ezért a lemondó linket a visszaigazoló e-mailből vettem. Egy következő futás előtt a szkriptet erre érdemes javítani (a POST elfogása `route.fetch`-csel).
- Az éles oldalon (`HANDOFF`) a köszönőoldal a fő ablakban nyílik ugyanezzel a címmel, ezért a `bookingUrl`-ben ott lesz az azonosító; a motor a `bookingId.returned`-et a `booking_completed.booking_id_echo`-ba írja, a kontextus lezárul.

## Ami még hátravan

1. **Éles hatás előtt** (a PR draft, nincs mergelve, élesre semmi nem ment):
   - **Ellenőrizve:** a GTM éles v52 mind a 64 változója (olvasás): a `bookingUrl`-t feldolgozó négy változó (175, 182, 193, 208) `new URL(bookingUrl).searchParams.get('serviceId' / 'startDate')`-tel olvas, `back`-et nem vizsgál és reguláris kifejezést nem használ a címre; a 175-ös és 182-es a valódi címen futtatva is ugyanazt adja (lásd fent).
   - **Nem ellenőrzött:** a 61 címke és 72 trigger feltételei (URL-szűrők), a Stape szerver-konténer, a köszönőoldalról a Zapier felé menő hívások (WIX-MERES.md 4.8).
2. **Mit lehet erre építeni:**
   - A köszönőoldal a `bookingUrl`-ből (`back`) vagy a `mhBookingCtx` kontextusból (ugyanaz a lapfül, azonos eredet) olvashatja a saját azonosítót; a köszönőoldali (böngészős) mérés így megkapja.
   - **Szerver-oldalon az e-mailből induló Zapier-folyamatok az azonosítót nem kapják meg** (az e-mailben nincs). Szerver-oldali párosításhoz egy további Salonic-oldali lehetőség (nem próbáltam, külső fiókot nem módosítottam): a Salonic adatlapján a fiók saját GTM-je fut (`GTM-PST2HB22`), és a foglalás végén `dataLayer.push({event:'purchase', ecommerce:{transaction_id: <Salonic foglalás-UUID>}})` történik; az adatlap címében ott a `back=<azonosító>`, így a GTM-ből a kettő összekapcsolható (azonosító ↔ Salonic UUID, pl. egy saját végpontra küldve) – ez GTM-módosítás, kifejezett kérés nélkül nem nyúlok hozzá.
3. A PMU-foglaló (`foglalo-pmu.js`) és a lézer-landing közvetlen Salonic-linkjei (`lezer-landing.js`) nem a motoron mennek, ezekre az azonosító nem terjed ki.

## Kikapcsolás

Az átadás egy sor: `engine.js` C4, a `beginBooking(... bookingId)` hívásból a `bookingId` elhagyása (a cím ilyenkor bájtra a régi). A generálás és a kontextus ettől függetlenül nem árt.

## Próbák

- `node --test tools/test-booking-id.mjs tools/test-salonic-adapter.mjs`
- `node tools/meres-proba/booking-id-proba.mjs --overlay dist [--bazis https://<ág>.mosaic-d77.pages.dev]` – mockolt Salonic, tiltott kimenő mérés
- `node tools/meres-proba/booking-id-valodi.mjs --bazis https://<ág>.mosaic-d77.pages.dev [--szaraz 1]` – a valódi Salonic-adatlapig (`--szaraz 1`: foglalás nélkül, az időpontot ~5 percre tartja), nélküle: valódi, lemondandó próbafoglalás (egyszer lefuttatva, lásd fent)
