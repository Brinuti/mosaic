# A foglaló saját foglalás-azonosítója (booking_id) – QA-1

Állapot (2026-10-06): **megépítve és előnézeten tesztelve; a Salonic-visszhang (visszajön-e a köszönőoldalon / az e-mailben) még NEM mért**, mert ahhoz egy valódi, lemondandó próbafoglalás kell (lásd „Ami még hátravan”).
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
| A Salonic a sikeres foglalás utáni átirányításban (`bookingUrl`) **visszaadja** | **NEM mért** – hipotézis: a `bookingUrl` a kérés címe, a mostani valódi `bookingUrl` is a kanonikus adatlap-cím `…&back=` végződéssel, ezért a `back=<azonosító>` benne lesz; az is lehet, hogy a Salonic a `back` értékét átirányítási célnak használja (ez rontaná a foglalást) |
| *Indirekt jel (nem bizonyíték)* | a korábbi valódi próbafoglalások naplóiban az átirányítás `bookingUrl`-je a **kanonikus (a Salonic által normalizált) adatlap-cím `…&back=` véggel** (pl. `anyone=true&employeeId=…&placeId=…&serviceId=…&startDate=…&back=`). Ez egyaránt megfelel annak, hogy a Salonic a kérés címét adja vissza (akkor a `back=<azonosító>` benne lesz), és annak is, hogy fix sablonból építi (akkor üres marad): eldönteni csak egy valódi foglalás tudja |
| Az értesítő e-mailben visszajön | **NEM mért**; az URL-ből a megjegyzés-mező nem tölthető elő, ezért az e-mail szövegében valószínűleg nincs benne (az e-mailben a lemondó-link UUID-ja van) |

## Ami még hátravan (döntést / engedélyt igényel)

1. **Egyetlen valódi, azonnal lemondott próbafoglalás az előnézeten** (`node tools/meres-proba/booking-id-valodi.mjs --bazis https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`, majd `lemond.mjs`): ez mondja meg, hogy a `redirect.url` / `bookingUrl` tartalmazza-e az azonosítót, és nem rontja-e el a `back` az átirányítást. A szkript csak előnézeten fut, a kimenő mérés tiltott, az éles köszönőoldalt nem tölti be, a Zapier próbavédelme háromszorosan fogja (név „TESZT –”, a tulajdonos telefonszáma, teszt e-mail). A futtatás ebben a munkamenetben a rendszer engedélyező szűrője által **kétszer megtagadva** (valódi foglalás a Salonicban; a felhasználó chatbeli jóváhagyása a szűrőt nem oldotta fel), ezért nem futott le; megkerülni nem lehet és nem szabad.
2. **Éles hatás előtt** (a PR nem mergelve, élesre semmi nem ment): elbírja-e a mostani éles mérés, hogy a `bookingUrl` vége `&back=` helyett `&back=mb_…`.
   - **Ellenőrizve (olvasás, GTM éles v52, mind a 64 változó):** a `bookingUrl`-t feldolgozó négy változó (175 `JS - foglalas tranzakcio ID`, 182 `… (uzletag)`, 193 `JS - TikTok event id (foglalas)`, 208 `JS - koszonooldal ujratoltes`) mind `new URL(bookingUrl).searchParams.get('serviceId' / 'startDate')`-tel olvas, `back`-et nem vizsgál és reguláris kifejezést nem használ a címre: a `&back=mb_…` vég ezeket **nem érinti**. A `first_booking`, `price`, `employee`, `location` változók URL-lekérdezés-változók (a köszönőoldal saját paraméterei).
   - **Nem ellenőrzött:** a 61 címke és 72 trigger feltételei (URL-szűrők), a Stape szerver-konténer, a köszönőoldalról a Zapier felé menő hívások (WIX-MERES.md 4.8) és a Salonic-levélből induló Zapier-folyamatok (a levélben nincs `back`, ezért valószínűleg nem érintettek).
3. Ha a visszhang nincs meg (a Salonic nem adja vissza): a köszönőoldal a `mhBookingCtx` kontextusból (ugyanaz a lapfül, azonos eredet) olvashatja az azonosítót, és a `startDate` + `serviceId` + üzletág alapján párosíthatja; ez a böngésző-oldali út nem igényel Salonic-beállítást, de szerver-oldalon (e-mail alapú Zapier-folyamat) nem látszik.
4. Szerver-oldali párosításhoz egy további, Salonic-oldali lehetőség (nem próbáltam, külső fiókot nem módosítottam): a Salonic adatlapján a fiók saját GTM-je fut (`GTM-PST2HB22`), és a foglalás végén `dataLayer.push({event:'purchase', ecommerce:{transaction_id: <Salonic foglalás-UUID>}})` történik; az adatlap címében ott van a `back=<azonosító>`, így a GTM-ből a kettő összekapcsolható (azonosító ↔ Salonic UUID) – ez GTM-módosítás, kifejezett kérés nélkül nem nyúlok hozzá.

## Kikapcsolás

Az átadás egy sor: `engine.js` C4, a `beginBooking(... bookingId)` hívásból a `bookingId` elhagyása (a cím ilyenkor bájtra a régi). A generálás és a kontextus ettől függetlenül nem árt.

## Próbák

- `node --test tools/test-booking-id.mjs tools/test-salonic-adapter.mjs`
- `node tools/meres-proba/booking-id-proba.mjs --overlay dist [--bazis https://<ág>.mosaic-d77.pages.dev]` – mockolt Salonic, tiltott kimenő mérés
- `node tools/meres-proba/booking-id-valodi.mjs --bazis https://<ág>.mosaic-d77.pages.dev [--szaraz 1]` – a valódi Salonic-adatlapig (`--szaraz 1`: foglalás nélkül, az időpontot ~5 percre tartja), nélküle: valódi, lemondandó próbafoglalás (lásd fent, engedély kell)
