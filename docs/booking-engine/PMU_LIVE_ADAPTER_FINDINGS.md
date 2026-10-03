# PMU live adapter findings – 2026-10-03

Státusz: **LIVE_CODE_VERIFIED** (a PMU motor), **PARTIAL_READBACK** (a Salonic-mapping, lásd a JSON-t).
Forrás: az éles oldal (https://www.mosaicheadspa.hu) és a repó `main` ága (`790f625`). Csak olvasás történt, foglalás nem jött létre.

## 1. Döntéshez szükséges összkép

1. **Az éles PMU motor bájtra azonos a repó `main` ágával.** A `foglalo-pmu.js`, a `pmu-landing.js` és a `foglalo.js` az éles oldalról letöltve és a helyi buildből (`node tools/netlify-build.mjs`) is azonos (SHA-256 `5ac2e6cf…` a `foglalo-pmu.js`-re). Az audit „webes ellentmondása” (régi, közvetlen Salonic-linkes oldal a keresőindexben) így elavult index volt: az éles `/sminktetovalas-budapest` a `/foglalo-pmu?beagyazva=1` keretet tölti be, és nincs benne közvetlen `salonic.hu` link.
2. **A foglalást nem a mi kódunk hozza létre.** Az időpontokat a böngésző kérdezi le a Salonic nyilvános naptár-API-jából, a foglalást viszont a Salonic saját `/guestData/` oldala rögzíti, beágyazva (iframe, láthatatlan reCAPTCHA). Saját backend vagy proxy a Salonic felé nincs. Ugyanez a minta él a HeadSpa foglalóban (`foglalo.js`) is.
3. **Következmény a Booking Engine V1-re:** a `createBooking(payload)`, a `getBooking(id)` és az `updateBooking(id, patch)` a jelenlegi nyilvános Salonic-felületen **nem valósítható meg**. Nyilvános foglalás- vagy partner-API-t a Salonic dokumentációjában nem találtam (lásd 6. pont). A „Booking success contract” szigorú formája (`booking_id` létezik, a tárolt ár szerver-oldalról visszaolvasva egyezik a `final_price`-szal) ezért nem teljesíthető. **Gyengébb, de használható ellenőrzés van:** a Salonic a sikeres foglalás után a mi köszönőoldalunkra irányít, és átadja a szolgáltatást, az időpontot, a munkatársat, az árat és az új/visszatérő jelzést (lásd 2.D és 6. pont). A `same_day_pricing` kapcsolónak OFF-nak kell maradnia.
4. **Adapter-döntés (a PMU audit 6. pontja szerint):** a slotlekérés újrahasznosítható (CASE A: kiemelhető), a foglalás-létrehozásra nincs stabil szerződés (CASE C). A PMU állapotgépe és a YES/NO routing változatlan marad.

## 2. Checklist

### A. Entry / state
- URL: `/foglalo-pmu` (`foglalas/foglalo-pmu.html`, `noindex, nofollow`), beágyazva a `/sminktetovalas-budapest` landingen (`<iframe id="foglalo" src="/foglalo-pmu?beagyazva=1">`). A régi, külön oldal `/pmu-foglalas` még él, és közvetlenül a Salonic `/employees/32428/` oldalára mutat.
- Paraméterek: `?beagyazva=1`, `?kezeles=<Salonic-ID vagy kulcsszavak>` (kihagyja az 1. lépést), `?nap=YYYY-MM-DD`, `?lepes=foto|visszahivas|szolg`, `?minta=kezeles|konz|visszahivas` (mintanézet foglalás nélkül).
- State: memóriabeli `allapot` objektum + `sessionStorage` (`mh_pmu_foglalas`, `mh_pmu_visszahivas`) + URL-hash nézetek (`#szolg`, `#ido`, `#kerdes`, `#adatok`, `#koszonjuk`…).
- Ágak: fő ág (nyitó → kezelés → naptár → gyors kérdés → Salonic-adatlap → köszönő), B (régi PMU, fotó kötelező), C (10 perces visszahívás), D („nem vagyok biztos”, fotóellenőrzés).

### B. Slot fetch
- Kezelések: `GET https://mosaic-pmu.salonic.hu/employees/32428/?placeId=14585` (HTML-t parse-ol: `input[data-id][data-duration]`, `data-name`, `data-price`). A `/korrekci/i` nevű kezelést kiszűri.
- Szabad időpontok: `GET https://api.salonic.hu/calendar/getAvailableTimes` paraméterek: `startDate` (most − 3 óra, unix mp), `offset=0`, `days=92`, `placeId=14585`, `serviceId`, `employeeId=-1`, `calendarId=76a8541e-bb52-22ab-f8c0-531b86f55abb`, `pref=''`, `apiVersion=1`, `language=hu`, `excludeNonAcceptingEmployees=0`. `credentials: omit`, 15 mp időkorlát, **nincs újrapróbálás**.
- Válasz: `status: "success"`, `data.blocks[<nap>][<employeeId>] = { employeeName, slots: { k: { timestamp, formatted, formattedFull } } }`, plusz `data.placeName`, `placeAddress`, `placePhone`. A kód az összes `timestamp`-et összegyűjti, a 30 percen belüli kezdéseket eldobja.
- Időzóna: a `timestamp` unix mp, a megjelenítés `Europe/Budapest`. A negyedórás slotokból csak az egész és fél órákat mutatja (a negyedet csak akkor, ha nincs mellette ilyen).
- Frissítés: slot-vesztéskor újratölti (`kezdesekBetolt(friss=true)`), egyébként kezelésenként gyorsítótáraz.
- Munkatárs: mindig `employeeId=-1` (bárki); az egyetlen PMU-munkatárs a 32428 (Melitta).

### C. Booking create
- **Nincs create-végpont a mi kódunkban.** A „Adatok” lépés egy iframe: `https://mosaic-pmu.salonic.hu/guestData/?placeId=14585&serviceId=<id>&employeeId=-1&startDate=<unix>`. A vendég adatait és a foglalás elküldését a Salonic oldala végzi.
- Saját payload, ár- vagy megjegyzésmező, értesítés-vezérlés: **nem létezik** a mi oldalunkon. A kódunk csak a `sessionStorage`-ba ment egy összefoglalót a köszönőoldalhoz.

### D. Response
- Közvetlen API-válasz nincs: `booking_id`, tárolt ár, státusz **az adatlap (iframe) válaszából nem érhető el**. A Salonic viszont sikeres foglalás után a köszönőoldalunkra irányít ezekkel a paraméterekkel (a repó `WIX-MERES.md` 10. fejezete szerint, élő méréssel ellenőrizve): `first_booking=true|false`, `price=<Ft>`, `employee=<név>`, `location=<hely>`, `service=<szolgáltatás>`, `g=<vendég-ID>`, `bookingUrl=<Salonic URL serviceId- és startDate-tel>`. **Különálló `booking_id` paraméter nincs**: a mérés ma a `g`, a `serviceId` és a `startDate` összefűzésével képez azonosítót (`<útvonal>-<g>-<serviceId>-<startDate>`).
- Siker-felismerés: ha a Salonic az iframe-et a mi oldalunk valamelyik útvonalára irányítja, a `window.mhKeretbenOldal` a teljes ablakban megnyitja (`?mh_proba=pmu`), a `/pmu-ok` pedig lefuttatja a mérést. **Figyelem:** a kód minden olyan átirányítást sikernek tekint, ahol az útvonal nem `''` és nem `/foglalo-pmu` (`foglalo-pmu.js:416–429`). Szűkebb ellenőrzés (pl. csak `/pmu-ok`) nincs.
- Slot-lost: ha az iframe a főoldalra vagy a `/foglalo-pmu` címre kerül vissza, „Ez az időpont közben elfogyott”, és a naptár újratölt.
- Technikai hiba az iframe-ben: **nincs észlelés**. Csak a lekérdezések hibáit kezeli (üzenet + telefonszám), és 8 mp után megjelenik a „Nem jelenik meg az űrlap? Nyisd meg itt” tartalék-link.
- Köszönőoldalak: `/pmu-ok` (minden Salonic-foglalás, a konzultáció is), `/pmu-vh` (telefonos visszahívás, ez nem Salonic).

### E. Tracking
- A `foglalo-pmu.js` és az `assets/js` többi fájlja **nem kezel** `utm_*`, `gclid`, `fbclid`/`fbc`/`fbp` vagy `ttclid` értéket (a kódban nincs ilyen). Ezeket vagy a GTM-konténer (GTM-PST2HB22) / Stape kezeli, vagy nincsenek átadva. A GTM-konténert nem vizsgáltam.
- A mérés **oldalalapú**: a `/pmu-ok` és `/pmu-vh` betöltésekor a `suti.js` a PMU Meta-pixelt (1019878750660854), a GA4-et és a GTM-et futtatja. A GTM a Salonic-átirányítás URL-paramétereiből (`price`, `first_booking`, `employee`, `bookingUrl`, `g`) építi a konverzióértéket, az új/visszatérő megkülönböztetést és a deduplikációs azonosítót (`WIX-MERES.md` 4.1, 4.4). Egyes konzultációk konverzióértéke fix (Hair 13 000, Lézer 27 000). A `foglalo-pmu.js` ezeket a paramétereket nem olvassa, az összefoglaló a `sessionStorage`-ból jön.
- A fotós és a visszahívós ág Netlify-űrlap (`pmu-proba-foto`, `pmu-proba-visszahivas`), az „Ott leszek” gomb a `pmu-megerosites` űrlapot küldi; ez nem foglalás, és nem `booking_completed`.

### F. Ár
- Create közbeni felülírás: **nem lehetséges** (a Salonic hozza létre a foglalást).
- Létrehozás utáni módosítás: **nem lehetséges** a mi oldalunkról (nincs hitelesített Salonic-API).
- Szerver-oldali readback: **nem lehetséges** ugyanezért. Gyenge, átirányítás-alapú ellenőrzés viszont van: a `price` paraméter a Salonic által jelentett ár. Ez az URL-ben utazik, tehát kliensoldali és hamisítható (bárki megnyithat `/pmu-ok?price=…` címet); hitelesítést nem ad, csak azt, hogy a böngésző a Salonictól jövő paraméterekkel érkezett vissza.
- Az ár a megjelenítésben a Salonic `data-price` értéke; a „X Ft helyett most” a névből jön (listaár), az ár mező az akciós ár.

## 3. Megfigyelések, amelyeket a handoff még nem tartalmaz

- A Hair munkatársa, Noel (25095) Salonic-címkéje „Noel – 20% kedvezmény!”. A nyilvános ársáv alsó vége a `data-price` 80%-a (34 360 = 0,8 × 42 950). A végső ár tehát munkatársfüggő, és a `data-price` önmagában nem a végső ár.
- A Lézer szolgáltatások `data-price` értéke már az akciós ár (pl. BASIC 36 400, „−20% kedvezménnyel”); listaár nem olvasható. Három szolgáltatás ára 0.
- A Lézer `selectSpecialization` oldala egy egymunkatársas oldalra irányít át (`employeeId=32417`); a kategóriák (`66404`, `66405`) a site kódjából jönnek.
- A HeadSpa munkatársak: 24065 Mirage Egyéni kezelő, 24989 Sole Egyéni kezelő, 27076 Mirage Egyéni kezelő – Május, 29415 Négykezes Head spa, 24354 Páros kezelés (a „munkatárs” itt részben erőforrás).

## 4. Nyitott döntések / DATA_REQUEST

1. **Foglalás-létrehozás és -ellenőrzés:** a nyilvános dokumentáció nem említ foglalás-API-t (lásd 6. pont). Ha a Salonic ügyfélszolgálata sem ad (kulcs, webhook, `booking_id` az átirányításban), a `booking_completed` az átirányítás alapján mondható sikernek, szerver-oldali ellenőrzés nélkül. A 6. pont végén kérdéslista van az ügyfélszolgálatnak.
2. **`booking_type`, `success_route`, `is_acquisition_conversion`** minden szolgáltatásra: ezek nem olvashatók a Salonicból, jóváhagyott üzleti szabály kell hozzájuk. A JSON-ban `null`.
3. **Hiányzó szolgáltatások a Salonicban:** HeadSpa VIP (100 perc), Oxigén hajkamerás vizsgálat (4 990 Ft), PMU eltávolítás. Vagy nem foglalhatók online, vagy másik helyen vannak.
4. **Siker-felismerés szűkítése** a PMU motorban (csak `/pmu-ok`): ez PMU-logikát nem érint, de változtatás, ezért jóváhagyás kell.
5. **UTM/click-azonosítók:** a GTM-konténer ellenőrzése, hogy a jelenlegi mérés ténylegesen átviszi-e őket a `/pmu-ok` oldalig.

## 5. Következő lépés

A két audit (ez és a `SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json`) lezárva. A `SalonicAdapter` a most ismert, valós szerződésre épül: olvasás a nyilvános oldalakból és a naptár-API-ból, foglalás a Salonic beágyazott adatlapján, ellenőrzés az átirányítás paramétereiből. Lásd `assets/js/booking-engine/salonic-adapter.js` és `docs/booking-engine/SALONIC_ADAPTER_CONTRACT.md`.

## 6. Salonic API-kutatás (2026-10-03, csak nyilvános források)

**Mit találtam:**
- A Salonic nyilvános oldalai és tudástára **foglalás-létrehozó vagy foglalás-lekérdező API-t nem dokumentálnak.** Fejlesztői dokumentációs portált nem találtam.
- Amit dokumentálnak: beágyazás (iframe, „Foglalj most” gomb), egyedi CSS, Google Analytics, Facebook-pixel és **Facebook Conversion API** (szerver-szerver; beállítható „minden foglalás” vagy „csak új vendég”), fizetők (Teya, MyPOS, SimplePay, Stripe, Novopayment), számlázók (Számlázz.hu, Billingo), Mailchimp, Invee. A tudástárban szerepel „API-kulcs”, de ezek a Salonic kifelé irányuló integrációihoz valók (pl. vendég felvétele listára), nem foglalás-vezérléshez.
- A Salonic saját, nem dokumentált végpontjait használjuk (naptár-API, kezelés- és munkatársoldalak). Ezek nem szerződésben rögzített felületek, a Salonic bármikor módosíthatja őket. A foglalóban ezért kell egy olyan tartalék, amely a Salonic eredeti oldalára dob (a PMU motor ma is ezt teszi 8 mp után).

**Amit nem tudok kiolvasni nyilvános forrásból:** hogy a Salonic nyújt-e partner- vagy API-hozzáférést megkeresésre, és hogy az átirányítás kiegészíthető-e `booking_id`-val.

**Kérdéslista a Salonic ügyfélszolgálatának** (nem küldtem el):
1. Van-e partner- vagy fejlesztői API foglalások létrehozására, lekérdezésére és módosítására? Milyen csomagban, milyen feltétellel?
2. Kiegészíthető-e a sikeres foglalás utáni átirányítás `booking_id` (foglalás-azonosító) paraméterrel?
3. Van-e webhook foglalás-létrehozásra és -lemondásra?
4. Felülírható-e egy foglalás ára létrehozáskor vagy utólag (akciós, aznapi árazáshoz)? Kikapcsolható-e az értesítő e-mail egy adott foglalásnál?
5. A Facebook Conversion API beállítás a Salonic fiókokban (mosaic-pmu, mosaic-hair, mosaic-oxigen, mosaic-elysion, mosaicheadspa) ki van-e kapcsolva? (Ha be van kapcsolva, a Stape/GTM-es CAPI mellett duplán mérhet.)
6. Garantált-e a naptár-API (`api.salonic.hu/calendar/getAvailableTimes`) és a kezelésoldalak szerkezetének stabilitása?

**Egyéb megfigyelés (a repóból, nem Salonic):** a `WIX-MERES.md` 4.8 fejezete egy Zapier „catch hook” URL-t tartalmaz, a repó pedig publikus. Aki ismeri az URL-t, hamis foglalási adatot küldhet a Zapier-folyamatba (offline konverzió-feltöltés / CRM). Érdemes az URL-t cserélni és a dokumentumból kivenni; ezt nem végeztem el.
