# SalonicAdapter – szerződés (V1)

Kód: `assets/js/booking-engine/salonic-adapter.js` · Teszt: `node --test tools/test-salonic-adapter.mjs` (élő, csak olvasó próba: `LIVE=1`).
Alapja: [PMU_LIVE_ADAPTER_FINDINGS.md](PMU_LIVE_ADAPTER_FINDINGS.md) és [SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json](SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json).

## Mit tud, és mit nem

| Művelet | Állapot | Hogyan |
|---|---|---|
| `getServices(business)` | működik | a Salonic nyilvános kezelés-oldalai (`/employees/<id>/`, `/showServices/`, `/selectSpecialization/`) |
| `getStaff(business, serviceId)` | működik | az azonosító a szolgáltatáslistából (`data-employees`), a név a naptár-API-ból; ha a munkatársnak nincs szabad ideje a keretben, a név `null` |
| `getAvailability(business, serviceId, {staffId, from, days, minLeadMinutes})` | működik | `api.salonic.hu/calendar/getAvailableTimes`; a slot a MASTER SPEC 6. pontja szerinti objektum |
| `beginBooking({business, serviceId, startUnix, staffId})` | működik | a Salonic `/guestData/` adatlap címét adja vissza (iframe vagy tartalék-link) és a várt értékeket az ellenőrzéshez; ismeretlen szolgáltatásra hibát dob, nem talál ki ID-t |
| `verifyConfirmation(redirectUrl, expected)` | működik, **kliensoldali** | a Salonic sikeres foglalás utáni átirányításának paramétereit veti össze a várttal |
| `createBooking`, `getBooking`, `updateBooking` | **nem támogatott** (`SalonicError NOT_SUPPORTED`) | a Salonicnak nincs nyilvános foglalás-API-ja (lásd a leleteket, 6. pont) |

`adapter.capabilities` ezt géppel olvashatóan mondja: `bookingId: 'synthetic'`, `priceReadback: 'redirect-attested'`.

## `verifyConfirmation` – mit bizonyít

Bemenet: a köszönőoldal címe (vagy csak a query string) és `expected = { business, serviceId, startUnix, staffId (-1 = bárki), staffName?, activePrice }` (utóbbi a `beginBooking().expected`).
A Salonic ezeket adja át: `first_booking`, `price`, `employee`, `location`, `service`, `g` (vendég-ID), `bookingUrl` (serviceId-vel és startDate-tel).

Ellenőrzések (`pass` / `fail` / `skipped`): `params` (kötelező paraméterek megvannak), `place` (a `bookingUrl` a várt Salonic-fiókra és `placeId`-ra mutat), `service`, `slot` (`startDate`), `staff` (csak ha konkrét munkatársat választottunk és ismerjük a nevét), `price`.
`ok` akkor igaz, ha nincs `fail`. Visszaad még: `bookingRef` (**szintetikus**: `g-serviceId-startDate`, mert a Salonic nem ad `booking_id`-t), `firstBooking` (a Salonic új/visszatérő jelzése, az acquisition guardrail alapja), `reported` (amit a Salonic jelentett), `attestation`.

**Korlát:** ez az URL-ből dolgozik, tehát hamisítható és nem szerver-oldali. A „booking_completed” a jelenlegi Salonic-felületen legfeljebb ennyire bizonyított. Szerver-oldali ellenőrzéshez a Salonicnak kellene `booking_id`-t vagy API-t adnia (kérdéslista: a leletek 6. pontja).

## Szabályok

- Szolgáltatás-ID, ár, időtartam, munkatárs **nincs beleégetve**, minden a Salonicból jön. A `BUSINESSES` csak a technikai fiókot (host, `placeId`) és ott a kategória-/munkatárs-azonosítót tartalmazza, ahol a Salonic oldala nem listáz (Lézer: `specIds`, PMU: `employeeId`).
- Az adapter **csak GET-et küld**, időkorláttal (15 mp) és egy újrapróbálással hálózati/5xx hibára. Foglalást nem hoz létre, adatot nem ír.
- `final_price` = a Salonic aktuális ára (`data-price`). Munkatársi akció (pl. Noel „−20%”) és aznapi ár **nincs benne**: ezt a Salonic az adatlapon alkalmazza. `list_price` csak ott van, ahol a név tartalmazza („X Ft helyett most”), egyébként `null`.
- A Salonic oldalai és a naptár-API nem szerződéses felület. A UI-nak legyen tartaléka: hiba esetén a Salonic eredeti oldalára dobjon (`/selectSpecialization/?placeId=…` vagy `beginBooking().guestDataUrl`).
- A PMU szakmai routingja (YES/NO ág, fotó/konzultáció) nem az adapter dolga, és változatlan marad.

## Nincs még meg

- `booking_type`, `success_route`, `is_acquisition_conversion` szolgáltatásonként: jóváhagyott üzleti szabály kell, a Salonicból nem olvasható. A JSON-ban `null`.
- Egyes szolgáltatások nem szerepelnek a Salonicban (HeadSpa VIP, Oxigén hajkamerás vizsgálat, PMU eltávolítás): `DATA_REQUEST`, lásd a mapping `open_items`.
