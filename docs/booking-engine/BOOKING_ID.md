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

## Párosítás a Salonic e-mailhez: kulcs-tábla (QA-1 folytatás, 2026-10-06)

Tény: az értesítő e-mailben **nincs** `placeId` / `serviceId` / `employeeId` és nincs `mb_…`; csak a feladónév, a szolgáltatás neve, a munkatárs neve, az időpont szövege (év és időzóna nélkül) és a Salonic-UUID (a „Foglalás részletek” / lemondó linkben, a JSON-LD `reservationNumber`-ében). A köszönőoldal viszont tudja a `booking_id`-t és a teljes `bookingUrl`-t. Az összekötő: egy **kulcs**, amit mindkét oldal ugyanúgy képez.

### 1. lépés – ad-e azonosítót a „Foglalás megtekintése” oldal? (döntés)

| Oldal | Mi van rajta |
|---|---|
| `/booking/bookingDetails/<UUID>` („Foglalás megtekintése”) | **csak a `startDate`** (a „Foglalás módosítása” link: `/selectDate/?startDate=<unix>&bookingId=<UUID>`); `serviceId` / `employeeId` / `placeId` **nincs** |
| `/selectDate/?startDate=…&bookingId=<UUID>` (egy lépéssel tovább) | a naptár JS-beállításában `placeId`, `employeeId`, `serviceId` |
| az e-mail JSON-LD-je | `startDate` időzóna-eltolással (pl. `2026-10-31T15:30:00+01:00`) |

Döntés: az **e-mailes oldal a Salonic-oldalakból képez kulcsot** (1. ág: UUID → két GET, csak olvasás): ez adja a valódi `employeeId`-t és `startDate`-et, így nincs szükség név-fordításra. A **névfordító tábla a tartalék** (2. ág), és a diagnosztikai futásban mindig kiszámoljuk mindkettőt, hogy lássuk, egyeznek-e.

### Kulcs és kulcs-tábla

- **Kanonikus kulcs:** `placeId|employeeId|startUnix` (`startUnix` = Europe/Budapest → UTC Unix másodperc), pl. `10823|25095|1792512000`. A `serviceId` csak **ellenőrző mező** (eltérés = `ellentmondas`, nem küldünk). A „bármelyik szakember” (`employeeId=-1`) esetben a Salonic a kanonikus címre irányít a **kiosztott** `employeeId`-vel, a kulcs ezt használja – mindkét oldalon ugyanaz.
- **Köszönőoldal (saját kód, nem GTM):** `assets/js/foglalas-kulcs.js` (a `tools/netlify-build.mjs` illeszti be a köszönőoldalakba) a `bookingUrl`-ből (`back=<booking_id>`; tartalékban a `mhBookingCtx` kontextusból, ha a szolgáltatás és az időpont egyezik) → `POST /api/foglalas-kulcs`. Az írás: **egy kulcshoz egy `booking_id`**, felülírás nélkül, idempotens (ugyanaz újra = nincs hatás; más `booking_id` = ütközés, naplózva, nem ír felül), megőrzés **180 nap**. Tábla: D1 `foglalas_kulcs`, ütközések: `foglalas_kulcs_utkozes`.
- **E-mail oldal:** `POST /api/foglalas-egyeztetes` (olvasó kulcs a `x-egyeztetes-kulcs` fejlécben; a kulcs SHA-256-ja az `EGYEZTETES_KULCS_HASH` változóban, kulcs nélkül 404). Bemenet: a levél HTML-je (`email_html`) vagy a kinyert mezők + a levél dátuma. A év a **levél dátuma alapján, előrefelé** (a hétnap neve validál; magyar és angol hónap-/hétnapnevek).
- **Újrapróbálás:** 1, 3, 10 perc (a korai kérést nem számoljuk); a **4. (utolsó) sikertelen keresés után automatikusan `parositatlan`** állapot + **egyszeri látható riasztás**: `GET /api/foglalas-egyeztetes?riasztas=1` (JSON) vagy `…&formatum=html` (piros szalag). (DÖNTÉS #108, 2026-10-07: a `fuggoben` nem lehet végállapot. A hívó Zap legfeljebb 4 próbát tesz – 0, ~1, ~4, ~14,5 perc –, ezért az utolsó próbánál zár a végpont; korábban az 5. próbát várta, ami sosem jött, és a sor `fuggoben` maradt.) **A `parositatlan` lezárt:** a későbbi próba sem párosít, sem küld (0 küldés), és nem riaszt újra – a későn érkező köszönőoldali írás sem támasztja fel. Egy „lusta” lezárás (`veglegesLejart`) minden kulcsos kérésnél a lejárt `fuggoben` sorokat is lezárja (a várt következő próba + 5 perc után; a próba nélküli sort 1 óra után).
- **Jelöltek és ütközés (újrateszt kiegészítés, lásd lent):** minden köszönőoldali írás **jelöltként** is tárolódik (`foglalas_kulcs_irasok`); ha a kulcs birtokosa már kiment egy másik Salonic-UUID-ra, a birtokos Salonic-oldala **élőben** ellenőrződik, a levelek sorrendjétől függetlenül; a **lemondási értesítő** (nincs benne UUID) is feldolgozható (`{"tipus":"lemondas", …}` vagy `email_html`).
- **Egy foglalásból egy esemény:** az esemény-azonosító = a `booking_id`; `kuldheto=true` csak az első sikeres párosításnál (a Salonic-UUID-ra és – részleges egyedi indexszel – a `booking_id`-ra is egyszer), minden további keresés `duplikalt=true`, akkor is, ha a keresés később többször sikerül.

### Próbák az előnézeten („TESZT – Claude”, azonnal lemondva; élesre semmi, élő pixelre semmi)

Nyers nyomok (booking_id, teljes `bookingUrl`, abból képzett kulcs, kulcs-tábla-rekord, az e-mail releváns mezői, az e-mailből képzett kulcs mindkét ágon, a keresés eredménye, a kapott esemény-azonosító, a második keresés): `meres-naplo/qa1-nyom-*.json`.

| Eset | booking_id | Kulcs (a `bookingUrl`-ből) | E-mail-oldali kulcs (1. ág / 2. ág) | Eredmény | Nyom |
|---|---|---|---|---|---|
| a) „bármelyik szakember” (hair, ingyenes konzultáció, 232804) | `mb_0muwqohjz6g47mfu3pibpj0` | `10823\|25095\|1792512000` | azonos / azonos (JSON-LD) | `parositott`, esemény-azonosító = booking_id; a 2. keresés `duplikalt` | `qa1-nyom-a-barmelyik-szakember.json` |
| b) konkrét szakember (Betti), eltérő szolgáltatás (női hajvágás, 231538), hair | `mb_0muwqsub5wg61rqiuebgskn` | `10823\|23694\|1792512000` | azonos / azonos (a levél *szövegéből*, JSON-LD nélkül) | `parositott`; ugyanaz az időpont, mint (a)-nál, de **más `employeeId` → más kulcs, nincs ütközés** | `qa1-nyom-b-konkret-szakember-mas-szolgaltatas.json` |
| b0) kiegészítő: oxigén, fizetős szolgáltatás (466147), a Salonic osztotta a szakembert | `mb_0muwqq2tg3m5t6esi1uyzo4` | `14409\|32009\|1793374200` | azonos / azonos (szövegből) | `parositott` | `qa1-nyom-b0-oxigen-konkret-szakember.json` |
| c) **páros HeadSpa** (302999) | `mb_0muwquipszezqbdrx782d6m` | `10427\|24354\|1793457000` | azonos / azonos (JSON-LD) | `parositott` | `qa1-nyom-c-paros-headspa.json` |

A (b) esetben a Salonic nem irányít át (konkrét `employeeId`): a `bookingUrl` változatlan sorrendű, `anyone=true` nélkül, és a `back` ott is megmaradt. A (b) és (b0) e-mail oldali futása JSON-LD nélkül ment (csak a levél szövege), így a szöveg + előrefelé következtetett év útvonal (`idopontForras: szoveg`) is ki lett próbálva; az (a) és (c) a JSON-LD-t használta.

### (c) Páros HeadSpa – ütközik-e a kulcs? (külön jelentés)

**Nem ütközik.** A Salonic a páros kezelést **egyetlen virtuális munkatársként** („Páros kezelés”, `employeeId=24354`) kezeli, nem két emberként, ezért a foglalásból **egy** kulcs lesz (`10427|24354|1793457000`): a köszönőoldali írás `irva:true, utkozes:false`, az e-mail oldal egyetlen jelöltet talál, a két ág egyezik, esemény-azonosító = `mb_0muwquipszezqbdrx782d6m`, egy esemény. Fontos mellékfelfedezés: a **HeadSpa-fiók (c) e-mailje angol volt** („Appointment created”, „Employees”, „October 31. (Saturday) 15:30 - 16:50”, a fejlécben logó van, nem a szalon neve) – ezt a magyar-sablonos elemző eredetileg nem érte volna el; javítva (a szalon neve a JSON-LD `location.name`-ből, angol hónap- és hétnapnevek), valódi levél-fixture-rel és teszttel. A lemondás is angol oldalon történt („Your booking has been cancelled!”; a részletek oldalon „Appointment deleted!”), a `lemond.mjs` ezt most kezeli.

**Nem próbált:** hogy a Salonic enged-e két párost ugyanarra a páros-időpontra egyszerre (ehhez két valódi foglalás kellene). Ha enged, a két foglalás kulcsa megegyezne – ez az alábbi ütközés-eset, nem maradna észrevétlen.

### Ütközés (ugyanaz a kulcs, két foglalás) – szintetikus bemutató az előnézeti API-n, valódi foglalás nélkül

Nyers: `meres-naplo/qa1-nyom-szintetikus-utkozes.json` (szintetikus időpont: 2027-03-17 10:30, kulcs `10427|24354|1805275800`; a booking_id-k `mb_szintetikus…` előtaggal).

| Lépés | Eredmény |
|---|---|
| köszönőoldal ír | `irva:true` |
| ugyanaz újra | `idempotens:true` |
| **más** booking_id ugyanarra a kulcsra | `utkozes:true`, a meglévő nem íródik felül, a `foglalas_kulcs_utkozes`-be naplózva |
| e-mail #1 (angol HeadSpa-levél HTML-je, a szalon neve a JSON-LD-ből) | `parositott`, `kuldheto:true`, esemény-azonosító = az első booking_id, forrás `nevtabla` |
| ugyanaz az e-mail újra | `duplikalt:true`, `kuldheto:false` |
| e-mail #2 (**más** UUID, ugyanaz a kulcs = újrafoglalt időpont) | **`ellentmondas`, `kuldheto:false`, `riasztas:true`** – nem küld, de nem is nyeli el csendben; megjelenik a riasztás-listán és a piros szalagos HTML-en |
| e-mail #3, olyan kulcs, amit a köszönőoldal nem írt | `fuggoben`, újrapróbálás 60 mp múlva; azonnali ismétlés `korai`, nem számít próbálkozásnak |

(Az 1, 3, 10 perces újrapróbálást, a 4. keresés utáni automatikus `parositatlan` állapotot, a lezártságot és a lusta lezárást a `tools/test-foglalas-kulcs.mjs` állított órával bizonyítja; az előnézeten az R7 eset (`qa3-futtat.mjs --eset fuggoben-lezaras`) a valódi Zap-próbákkal.)

### Kulcs-ütközés kezelése – élő ellenőrzés, a levelek sorrendjétől függetlenül (QA-1 újrateszt, 2026-10-06 14:41–14:58 UTC)

A kulcs-tábla alapszabálya érvényben marad (egy kulcs = egy `booking_id`, felülírás nélkül); a **birtok csak ellenőrzött felszabadulás után kerül át**, nem a levelek sorrendje dönt:

1. **B levele a kulcsot foglaltnak találja** (a birtokos A már kiment egy másik Salonic-UUID-ra): az **A foglalás Salonic-oldala élőben** ellenőrződik (`GET /booking/bookingDetails/<A UUID>`; törölve: „Időpont törölve!” / „Appointment deleted!”; él: a módosítás-link, „Visszaigazolt” / „Confirmed”). **Törölve → B kapja a kulcsot** (a birtok átkerül, naplózva: `foglalas_kulcs_atadas`), B a saját `booking_id`-jával párosul. **Él → `ellentmondas` + riasztás**, nem küld, a kulcs A-nál marad. **Nem ellenőrizhető** (hiba) → függőben, újrapróbálás (nem dönt).
2. **Több szabad jelölt** (A még nincs kiküldve, pl. a létrehozási levele nem volt feldolgozva): a levél dátuma és a köszönőoldali írás ideje dönt – egyértelműen a legközelebbi, legfeljebb 5 percre; különben `ellentmondas` + riasztás. Egyetlen jelölt sem párosul, ha a levélnél 2 óránál régebbi (nem fog napokkal korábbi foglalást egy új levélhez kötni).
3. **Lemondási értesítő** (nincs benne UUID, link, JSON-LD – csak a szalon neve a záró sorban, a szolgáltatás, a munkatárs, az időpont szövege): a kulcs a **névtáblából** képződik; a kulcs birtokosát élőben ellenőrizzük: törölve → felszabadul (az egyetlen szabad jelölt kapja, vagy a kulcs szabad lesz); él → nem változik (az értesítő korábbi foglalásra vonatkozik, a kulcsot már az új foglalás birtokolja); a birtokos UUID-ja ismeretlen (a létrehozási levele nincs feldolgozva) → nem ellenőrizhető, nem változik.

**Valódi próbák az előnézeten** (HeadSpa páros, **angol** levelek; `TESZT – Claude`, mind azonnal lemondva és ellenőrizve; nyers nyomok lépésenként: `meres-naplo/qa1-nyom-lanc-headspa-sorrendek.json`, `qa1-nyom-lanc-hair-tartalek.json`; a D1 napló: `foglalas_kulcs_atadas`, `foglalas_lemondas`). Mindegyik valódi foglalásból **pontosan egy esemény** ment, a saját `booking_id`-jával (9 valódi: a, b0, b, c, H1–H5).

| Próba | Mi történt | Eredmény |
|---|---|---|
| **Tartalék ág, HeadSpa angol levél** (H1, `mb_0muwsdxoovp3rbsnmni2v54`, kulcs `10427\|24354\|1792497600`) | a foglalás a levele feldolgozása **előtt** lemondva → 1. ág: „a foglalas torolve” | a **névtábla** döntött (`kulcs_forras: nevtabla`), esemény-azonosító = a böngésző `booking_id`-ja; az angol lemondási értesítő: a kulcs felszabadult |
| **SORREND A: B levele az A lemondási értesítője ELŐTT** (A = a (c) foglalás, törölve; B = H2 `mb_0muwsjdj4li1goksjq4s898`, kulcs `10427\|24354\|1793457000`) | H2 köszönőoldala **valódi ütközést** jelzett (`utkozes:true`, a meglévő = (c)) | a levélnél a birtokos (c) élő ellenőrzése: `torolve` → átadás, H2 a saját id-jával párosult; az (c) lemondási értesítője **B után** ért ide: a birtokos H2 `aktiv` → **nem szabadult fel** |
| **SORREND B: az A lemondási értesítője B levele ELŐTT** (A = H2; B = H3 `mb_0muwsq9w44g65t4prwo21m2`) | H3 köszönőoldala `utkozes:true` (a meglévő = H2) | az értesítő: H2 `torolve` → a kulcs az egyetlen szabad jelölthöz (H3) került; H3 levele: egyenes párosítás, nincs további átadás |
| **Az A értesítője a B foglalás ELŐTT** (A = H3; B = H4 `mb_0muwsxcwo4g8rv24oo137ih`) | az értesítő: H3 `torolve` → a kulcs szabad | H4 köszönőoldala `irva:true, utkozes:false`; H4 levele rendesen párosult |
| **NEGATÍV: két élő foglalás azonos kulccsal** (A = H4, valódi és él; B'' = szintetikus `mb_szintetikusnegativ0001` + szintetikus UUID) | a kulcs birtokosa H4 | élő ellenőrzés: H4 `aktiv` → **`ellentmondas` + riasztás**, nincs esemény, a kulcs H4-nél maradt |
| H4 lemondási értesítője | H4 `torolve` | a kulcs az egyetlen szabad jelölthöz (a szintetikus B'') került; a szintetikus kulcs-sorokat ezután töröltem |
| **Tartalék ág, Hair magyar levél** (H5, `mb_0muwsrowg490clturxk7vtw`, kulcs `10823\|25095\|1792512000`) | a kulcs birtokosa az (a) foglalás (törölve); H5 azonnal lemondva, levele csak ezután feldolgozva | 1. ág: törölve; **névtábla** döntött; a birtokos (a) élő ellenőrzése `torolve` → átadás, H5 a saját id-jával párosult; a magyar lemondási értesítő: felszabadult |
| **Elysion** (valódi 2026-10-05 levél mezői) | a kiegészített névtábla képezi a kulcsot | `14586\|32417\|1793467800`, serviceId `476477` (kulcs-tábla rekord nincs → nincs párosítás; csak a kulcsképzés bizonyítéka) |

**Megfigyelés a Salonicról:** egy lemondott időpont a naptár-API szabad-listájában kb. **4 perc** múlva jelenik meg újra (14:46:37-es lemondás → 14:50:45-re szabad; közvetlen utána a foglaló a „nem szabad” időpontot nem kínálta) – a valódi ütközés ezért legkorábban ~4 perccel a lemondás után lehetséges.

### Névtábla – kiegészítve a HeadSpa- és az Elysion-fiókra (2026-10-06)

- **Azonosítók:** a Salonic szolgáltatás-listájának **minden** munkatárs-azonosítója (a lista teljes). **Nevek:** a `/employees/` oldal linkjei (Hair, Oxigén, PMU); a név nélküli azonosítókra a nyilvános `/employees/<id>` oldal címe (`<fiók neve> - <munkatárs neve>`) – ez a **HeadSpa és Elysion** fióknál is megvan, a szabad időpont nélküli munkatársnál is (a naptár-API csak a szabad időpontú munkatársak nevét adja); a naptár-API neve kiegészítő név (alias).
- **Eredmény** (`meres-naplo/qa1-nevtabla-2026-10-06.json`, a valódi fiókokon futtatva, név nélküli azonosító nincs): HeadSpa 5 (Mirage Egyéni kezelő, Sole Egyéni kezelő, **Mirage Egyéni kezelő - Május** – ez korábban hiányzott –, Négykezes Head spa, Páros kezelés), Elysion 1 (Elysion Pro Szőrtelenítés), Hair 3, Oxigén 3, PMU 1; összesen 13 munkatárs, 107 szolgáltatás.
- **Frissítés:** fiókonként (a Pages-függvény alkalekérés-korlátja miatt): a levélhez tartozó fiók táblája 24 óránál régebbi → újraépül; **ismeretlen munkatárs- vagy szalonnév** esetén célzott újraépítés (legfeljebb 10 percenként), majd a keresés egyszer megismétlődik; kényszerítve: `POST {"nevtabla":"frissit","uzletag":"headspa"}` (a válaszban `nev_nelkuli_azonositok`).

### Megállapítások és korlátok

1. **Újrafoglalt időpont (lemondás után ugyanaz a kulcs): megoldva** (élő ellenőrzés + lemondási értesítő, lásd fent; valódi próbákkal mindkét levélsorrendben). Maradék: ha a birtokos létrehozási levele soha nem lett feldolgozva (nincs UUID-ja), az értesítő nem ellenőrizhet – ilyenkor a levelek ideje dönt (5 perces egyértelműségi küszöb), különben riasztás.
2. **Lemondott foglalásnál az 1. ág nem működik** (a részletek oldal „törölve”); ilyenkor csak a névfordító tábla (2. ág) marad.
3. **A névfordító tábla** most teljes mind az 5 fióknál (lásd fent). Korlát: olyan munkatárs, akinek nincs nyilvános `/employees/<id>` oldala és nincs szabad időpontja, névtelen maradna (`nev_nelkuli_azonositok` jelzi); az 1. ág (Salonic-oldalak) ettől független, és elsődleges.
4. **A Salonic-oldalakra támaszkodó 1. ág** két olvasó GET-et csinál a Salonic-hostra; ha a Salonic az oldalak szerkezetét megváltoztatja, az elemzők (fixture-ökkel tesztelve) elbuknak, és a 2. ág veszi át – a diagnosztikai mód (`diagnosztika:true`) a két ágat együtt számolja, így az eltérés látható.
5. **Személyes adat:** a kulcs-tábla csak a kulcsot, a `booking_id`-t, a `serviceId`-t és időbélyegeket tárolja; név, e-mail, telefon nincs benne. A nyers nyomokban sincs.
6. **Az előnézeti adatbázisban** (nem az éles) a szintetikus bemutatók `foglalas_egyeztetes` sorai benne maradtak (kb. 12 sor, köztük 4 `ellentmondas` riasztás: UUID-előtagok `075d79dc`, `eed25ef2`, `a7b6d991`, `a236611b`): a szélesebb törlésüket az automata jogosultság-ellenőrzés megtagadta, ezért nem erőltettem (a saját szintetikus kulcs- és jelölt-sorokat törölni tudtam). Az előnézeti riasztás-oldal emiatt 4 szintetikus riasztást mutat; az éles adatbázisra ez nem hat.
7. **Nem próbált:** két páros ugyanarra a páros-időpontra egyszerre (a Salonic ~4 perc késleltetéssel adja vissza a lemondott időpontot, és két élő azonos kulcsú foglalást nem láttunk; ha lenne, `ellentmondas` + riasztás – a negatív esetet szintetikus B''-vel, valódi élő A-val próbáltam); a lemondási értesítő feldolgozása éles Zapier-hívóból (az e-mail oldali hívó nincs bekötve).

### Élesítés előtt (nincs production-kötés, a végpontok éles oldalon 503 / 404-et adnak)

1. D1 adatbázis létrehozása `mosaic-foglalas-kulcs` néven, kötés `KULCS_DB` néven a `wrangler.toml` `[[d1_databases]]` blokkjában (az előnézetnek már van: `mosaic-foglalas-kulcs-elonezet`).
2. `EGYEZTETES_KULCS_HASH` a `[vars]`-ban (az olvasó kulcs SHA-256-ja; a kulcs maga Secret/jelszókezelőben, nem a repóban).
3. A köszönőoldali szkript csak a `FOGLALAS_KOSZONO` listában szereplő oldalakra kerül (`tools/netlify-build.mjs`); a PMU / lézer közvetlen Salonic-linkjeire nem terjed ki.
4. Az e-mail oldali hívó (pl. a Salonic-levélből induló Zapier-folyamat) hívja a `/api/foglalas-egyeztetes`-t **a létrehozási és a lemondási értesítőkkel is** (a lemondási értesítő a kulcsok felszabadulásához kell; sorrendjük nem számít) – ez külső fiókot érintő beállítás, **nem készült el** (kifejezett kérés nélkül nem nyúlok Zapier / Meta / GTM / GA / Ads / TikTok fiókokhoz).

## Ami még hátravan

1. **Éles hatás előtt** (a PR draft, nincs mergelve, élesre semmi nem ment):
   - **Ellenőrizve:** a GTM éles v52 mind a 64 változója (olvasás): a `bookingUrl`-t feldolgozó négy változó (175, 182, 193, 208) `new URL(bookingUrl).searchParams.get('serviceId' / 'startDate')`-tel olvas, `back`-et nem vizsgál és reguláris kifejezést nem használ a címre; a 175-ös és 182-es a valódi címen futtatva is ugyanazt adja (lásd fent).
   - **Nem ellenőrzött:** a 61 címke és 72 trigger feltételei (URL-szűrők), a Stape szerver-konténer, a köszönőoldalról a Zapier felé menő hívások (WIX-MERES.md 4.8).
2. **Mit lehet erre építeni:**
   - A köszönőoldal a `bookingUrl`-ből (`back`) vagy a `mhBookingCtx` kontextusból (ugyanaz a lapfül, azonos eredet) olvashatja a saját azonosítót; a köszönőoldali (böngészős) mérés így megkapja.
   - **Szerver-oldalon az e-mailből induló Zapier-folyamatok az azonosítót nem kapják meg** (az e-mailben nincs) – erre készült a fenti „Párosítás” (kulcs-tábla + `/api/foglalas-egyeztetes`), amit az e-mail oldali hívónak kell meghívnia. Szerver-oldali párosításhoz egy további Salonic-oldali lehetőség (nem próbáltam, külső fiókot nem módosítottam): a Salonic adatlapján a fiók saját GTM-je fut (`GTM-PST2HB22`), és a foglalás végén `dataLayer.push({event:'purchase', ecommerce:{transaction_id: <Salonic foglalás-UUID>}})` történik; az adatlap címében ott a `back=<azonosító>`, így a GTM-ből a kettő összekapcsolható (azonosító ↔ Salonic UUID, pl. egy saját végpontra küldve) – ez GTM-módosítás, kifejezett kérés nélkül nem nyúlok hozzá.
3. A PMU-foglaló (`foglalo-pmu.js`) és a lézer-landing közvetlen Salonic-linkjei (`lezer-landing.js`) nem a motoron mennek, ezekre az azonosító nem terjed ki.

## Kikapcsolás

Az átadás egy sor: `engine.js` C4, a `beginBooking(... bookingId)` hívásból a `bookingId` elhagyása (a cím ilyenkor bájtra a régi). A generálás és a kontextus ettől függetlenül nem árt.

## Próbák

- `node --test tools/test-booking-id.mjs tools/test-salonic-adapter.mjs`
- `node tools/meres-proba/booking-id-proba.mjs --overlay dist [--bazis https://<ág>.mosaic-d77.pages.dev]` – mockolt Salonic, tiltott kimenő mérés
- `node tools/meres-proba/booking-id-valodi.mjs --bazis https://<ág>.mosaic-d77.pages.dev [--szaraz 1]` – a valódi Salonic-adatlapig (`--szaraz 1`: foglalás nélkül, az időpontot ~5 percre tartja), nélküle: valódi, lemondandó próbafoglalás (egyszer lefuttatva, lásd fent)
