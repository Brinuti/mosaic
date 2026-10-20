# A foglaló lépés-mérése (DECISION-LOG #88)

A foglaló minden lépéséről két csatornán megy jelzés. A célja: lássuk, hol esnek ki a vendégek, melyik üzletágnál, mennyi ideig töltődnek az időpontok, és milyen hibák fordulnak elő, **személyes adat nélkül**.

## 1. Az események

| Esemény | Mikor megy | Plusz paraméter |
|---|---|---|
| `booking_open` | megnyílt a foglaló (ülésenként egyszer) | – |
| `booking_business` | eldőlt az üzletág: a kezdőképernyőn választott, vagy a link már megmondta | – |
| `booking_service` | a vendég szolgáltatást választott (vagy a link konkrét szolgáltatásra mutat) | – |
| `booking_slots_loaded` | megérkeztek a szabad időpontok | `load_ms` (a betöltés ideje, ms) |
| `booking_slot` | a vendég időpontot választott | – |
| `booking_form_start` | megjelent az adatlap (a Salonic űrlapja) | – |
| `booking_submit` | a vendég beadta az adatlapot (lásd lent, a korlátoknál) | – |
| `booking_success` | ellenőrzött, sikeres foglalás | – |
| `booking_close` | bezárta a foglalót | `step` = a nézet kódja, ahol bezárta (`H0` kezdőképernyő, `HS1`…, `C1` naptár, `C4` adatlap, `C6` siker, `A1` visszahívás, `A3` hibaképernyő …) |
| `booking_error` | hiba | `error_type`: `salonic_api`, `no_slots`, `timeout`, `validation`, `slot_lost`, `hold_expired`, `verify_failed`, `unknown_redirect`, `callback_failed`, `client_error` |

**Minden eseményen ott van:** `business` (`headspa` / `hair` / `oxygen` / `laser` / `pmu` / `gift`; `none`, amíg még nincs választva), `service_id` (a Salonic szolgáltatás-azonosítója; `none`, amíg nincs szolgáltatás) és `source_page` (melyik oldalról nyílt a foglaló: csak az útvonal, pl. `/lezeres-szortelenites-budapest`; lekérdezés, `@` és furcsa karakter nélkül, különben `(direct)`).

Hogyan számolunk: az esemény a vendég **saját lépésén** születik (kattintás, betöltés), nem az újrarajzoláson, és minden „ülésenkénti” lépés (open, business, slots_loaded, form_start, submit, success, close, error) egyszer számít. Új választás (másik szolgáltatás, másik időpont) új esemény.

Az `error_type` jelentése: `salonic_api` = a Salonic nem válaszolt jól; `timeout` = a Salonic 15 mp alatt sem válaszolt; `no_slots` = nincs szabad időpont; `slot_lost` = közben elkelt az időpont; `hold_expired` = lejárt a Salonic 5 perces foglalási ideje; `validation` = a visszahívás-űrlapon hibás adatot adtak meg (a hiba típusa megy, az adat soha); `callback_failed` = a visszahívás-kérést nem sikerült elküldeni; `verify_failed` / `unknown_redirect` = a Salonic után a foglalást nem tudtuk ellenőrizni; `client_error` = váratlan hiba a böngészőben.

## 2. A két csatorna

**GA4 (`dataLayer`)** – **csak akkor**, ha a látogató elfogadta a statisztikai (analitikai) sütiket (`mhSuti.engedely('ana')`). A hozzájárulást eseményenként kérdezzük: amit az elfogadás előtt csinált, az nem kerül a `dataLayer`-be. A GTM-ben a [„2026-10-05 foglalo lepes-meres GA4 (#88)”](https://tagmanager.google.com/#/container/accounts/6261444190/containers/202031443/workspaces/61) munkaterület tartalmazza a triggert (`CE - foglalo lepes (booking_*)`), a GA4 esemény-taget és a 6 DataLayer-változót. **Elő van készítve, nincs publikálva**; amíg nincs, a `dataLayer`-be kerülő események sehova nem mennek el.

**Fontos a GTM adatréteg-modellje miatt:** a GTM az adatrétegbe tett értékeket megőrzi a következő eseményekre is. Ezért a foglaló minden eseménynél mindhárom változó-kulcsot (`load_ms`, `step`, `error_type`) felülírja, és ahol az adott eseményen nem értelmezett, `undefined`-ot tesz (a GTM ezt törli a modellből, és a GA4-tag a paramétert nem küldi). `null`-lal ez nem működött: a GA4-hit üres értékű paramétert vitt volna (`ep.step=`). Így a `booking_slot` nem örökli a korábbi `load_ms`-t, a `booking_close` a korábbi `error_type`-ot. (Az első, 2026-10-05 08:51–08:59 UTC-s közzététel előtt/alatt ezt éles próba mutatta ki: a GTM-et visszaállítottam a 51-es változatra, a javítás után tettem közzé újra.)

**Névtelen belső számláló** – **minden látogatóra**, hozzájárulástól függetlenül, mert ez technikai üzemi napló: nincs süti, nincs azonosító (munkamenet, eszköz, felhasználó), nincs IP-cím, nincs személyes adat, nincs oldal-URL, nincs időbélyeg (csak a nap). A böngésző egy kicsi `POST /api/foglalo-szamlalo` kérést küld (`sendBeacon`, a sütik nélkül), a szerver pedig csak **összesített napi darabszámot** növel (Cloudflare D1, `functions/api/foglalo-szamlalo.js`, `netlify/lib/foglalo-szamlalo.js`):

- lépésenkénti darabszám naponta és üzletáganként,
- hibák típusonként, bezárások lépésenként,
- az időpontok betöltési ideje: eloszlás (`<500 ms`, `<1 s`, `<2 s`, `<5 s`, `≥5 s`), átlag, maximum.

Védelem: csak azonos eredetű kérés fogadható el; a mezők zárt listából valók (bármi más = elutasítás); egy kulcs napi darabszáma legfeljebb 100 000; a robot (WebDriver) forgalom nem számolódik (hogy egy bejárás ne torzítsa a számokat). Az élő és az előnézeti oldal külön adatbázist használ.

## 3. A számláló kiolvasása (naponta)

Egy link, kulccsal (a kulcsot a tulajdonos kapta meg; a kódban csak a SHA-256-ja van, a `wrangler.toml` `SZAMLALO_OLVASO_HASH` sorában):

- **Táblázat, emberi nézet:** `https://www.mosaicheadspa.hu/api/foglalo-szamlalo?kulcs=<kulcs>&formatum=html`
- **JSON:** `…?kulcs=<kulcs>&nap=2026-10-05` (egy nap) vagy `&tol=2026-10-01&ig=2026-10-05` (legfeljebb 93 nap); alapból az utolsó 7 nap
- **CSV:** `…&formatum=csv` (`nap;uzletag;lepes;tipus;darab`; a betöltési időnél `slots_loaded_ms` sorok: a vödrök, az `atlag` és a `max`)

Kulcs nélkül / rossz kulccsal 404. Új kulcs: `node -e "const c=require('crypto');const t=c.randomBytes(24).toString('base64url');console.log(t, c.createHash('sha256').update(t).digest('hex'))"`, majd a hash a `wrangler.toml`-ba (`[vars]` és `[env.preview.vars]`), új deploy.

## 4. Próbák (élesítés előtt, tiltott kimenő méréssel)

- `node --test tools/test-lepes-meres.mjs` – a kliens-modul (egyszer-egyszer, hozzájárulás, robot, személyes adat nélküliség, a régi `booking_open` / `booking_error` kikapcsolása) és a szerver (érvényesítés, atomikus számlálás valódi SQLite-on, budapesti nap, védelem, olvasás JSON/CSV/HTML).
- `node tools/meres-proba/lepes-proba.mjs --overlay dist [--mobil 1]` – böngészőben (Playwright), a kimenő mérés (GA4, Meta, TikTok, Google Ads, Stape, Zapier) tiltva, a Salonic naptár és az átirányítás mockolva: a teljes siker-út mind a 9 lépése pontosan egyszer jön, a `booking_close.step` jó (`C6`, `HS1`, `H0`, `A1`, `A3`, `C4`), hozzájárulás nélkül a `dataLayer` üres, de a számláló mindent kap, a robot nem számolódik, és a lépések nem indítanak konverziót / marketing-eseményt. A számláló-kérést a próba elfogja (a valódi végpontra soha nem megy).
- `… lepes-proba.mjs --overlay dist --ga4 1 --gtm-kornyezet 2:<kod>` – ugyanez a **GTM-ben létrehozott, de még nem publikált** változattal (a beépített „Latest” környezet = a legutóbb létrehozott verzió; a kód a GTM Admin → Environments oldalon / az API-ban látszik): a GA4-hitek (elfogva, a Google-hoz nem jutnak el) mind a 9 eseményre pontosan egyszer mennek, a paramétereik jók (`business`, `service_id`, `source_page`; a `load_ms` csak a `slots_loaded`-en, a `step` csak a `close`-on, `error_type` csak a hibán), nincs értékörökítés. Publikálás után az éles oldalon ugyanez: `--bazis https://www.mosaicheadspa.hu --ga4 1` (overlay nélkül).

## 5. Korlátok, megjegyzések

- **`booking_submit`:** az „Időpont lefoglalása” gomb a Salonic beágyazott adatlapján van (idegen eredet), a kattintás nem megfigyelhető. A beadást onnan látjuk, hogy a Salonic a **saját oldalunkra** irányít vissza (sikeres foglalás vagy elkelt időpont): ez a megfigyelhető „elküldte” jel. Az adatlapon belüli hibás kitöltést (Salonic-validáció) nem látjuk.
- **`booking_close`** csak a rétegben van (az önálló `/foglalo-motor` oldalon nincs bezárás), és nem megy, ha a sikeres foglalás után az éles oldalon átadjuk a vendéget a köszönőoldalnak (az oldal elnavigál).
- A régi `tracking.js`-szerződés (`booking_service_selected`, `booking_slot_selected`, `booking_completed` stb.) változatlan és továbbra sem kapcsolódik semmilyen fiókhoz; a `booking_open` és a `booking_error` nevet viszont már **csak** a lépés-mérés adja a `dataLayer`-be (egy lépésről egy esemény).
- A `gift` üzletág a számlálóban és a spec szerinti listában szerepel (a jövőbeli ajándékkártya-lépésekhez); a foglaló jelenleg nem használja, az ajándékkártyás beváltás HeadSpa-foglalásként `headspa`.
- GA4: a paraméterek riportálásához a GA4-ben (Admin → Egyedi definíciók) a `business`, `service_id`, `source_page`, `step`, `error_type` esemény-szintű egyedi dimenzió, a `load_ms` egyedi mutató legyen (a GTM publikálása után; ezt a GA4 felületén kell egyszer beállítani).

## 5b. Hiba-részlet (2026-10-15, DECISION #188, #178) – MÉRÉS ÉRINTŐ

A `salonic_api` hibatípus eddig nem árulta el, **melyik nézetben** és **milyen hibakóddal / HTTP-státusszal** keletkezett (a régi `tracking.js` `booking_error` `step` / `reason` mezője a dataLayer-be nem kerül, a belső számláló csak a típust tárolta). A kiegészítés a **belső számlálóba** (D1 `lepes_szamlalo`) ír egy további, csak darabszámot hordozó sort:

- `lepes = error_reszlet`, `tipus = <hibatípus>.<nézet-kód>.<hibakód>.<http>`, pl. `salonic_api.C1.HTTP.503`.
  - `<nézet-kód>`: a foglaló nézetének kódja (C1, HS1, A3_SENT, … : nagybetű + nagybetű/szám/aláhúzás, legfeljebb 12 karakter), egyébként `ismeretlen`.
  - `<hibakód>` és `<hibatípus>` zárt párok: `timeout` → `TIMEOUT`; `client_error` → `NONE` (nincs adapter-hibakód); `salonic_api` → az adapter hibakódja (`HTTP`, `PARSE`, `API_STATUS`, `SERVICE_NOT_FOUND`, `NO_CALENDAR`, `UNKNOWN_BUSINESS`, `NOT_SUPPORTED`; ismeretlen kód: `OTHER`; a `PARSE` további bontása `PARSE_EMPTY` / `PARSE_NOTHTML` / `PARSE_SHORT` / `PARSE_NOLIST` / `PARSE_JSON` – lásd 5c). A többi hibatípus (`no_slots`, `slot_lost`, …) nem hordoz részletet.
  - `<http>`: kanonikusan `0` vagy `100`–`599` (nincs `00` / `000` / vezető nulla), és csak `HTTP` vagy `API_STATUS` kód mellett lehet nem nulla. **A `0` azt jelenti: nincs HTTP-státusz** (pl. a kérés nem jutott el a Salonic-hoz: hálózati hiba, CORS, megszakítás; vagy a hibakód nem HTTP-eredetű). Ha a Salonic API `status` mezője szám, az `API_STATUS.<szám>` alakban jelenik meg: ez az API saját státusza, **nem** HTTP-státusz; a szöveges API-státusz `API_STATUS.0`.
- **Nincs benne** URL, hibaüzenet, azonosító, süti, időbélyeg, személyes adat; a szerver zárt alakot fogad el (`ervenyesit`), minden más `400`; a kliens kimenete a szerver által elfogadott halmaz része (teszt: kliens ⊆ szerver).
- **Mikor megy:** csak a nézet-betöltési hibánál (`engine.js` `catch`), a hibatípus egyszer-kapuján belül (ugyanaz a (típus, nézet, szolgáltatás) hármas legfeljebb egyszer: egy második, más kódú hiba ugyanarra a hármasra nem kerül be), próbából és robotból nem. A kliens a hiba-részletet saját `try`-blokkban küldi, hibája sosem akadályozza a foglalást.
- **Kulcsszám-plafon:** (nap, üzletág) szerint legfeljebb `RESZLET_KULCS_PLAFON` = 100 **különböző** részlet-kulcs kerül be (egyetlen atomikus `INSERT … SELECT` feltétellel); a meglévő kulcs tovább nő (kulcsonként a `DB_PLAFON`). A valódi forgalom naponta néhány tucat kulcsot ad. Ez véd a D1-sorok felfúvódása ellen, ha valaki a végpontot közvetlenül hívja.
- **Nem változik:** a `LEPESEK` lista és a GA4-esemény lista (a részlet **nem** megy GA4-be és a dataLayer-be sem), a tölcsér-számok, az `error` sor, a foglalási logika, a Salonic-hívások, a konverziók és a kiküldés. A `GET /api/foglalo-szamlalo` JSON kimenetében egy **további** `hiba_reszlet` kulcs jelenik meg üzletágankénti (napi és összesített) bontásban, csak ha van adat; a CSV-ben `error_reszlet` sorok; a HTML-ben a hibák cellában kis betűvel.
- **D1-séma:** nincs változás (a meglévő `lepes_szamlalo` oszlopai elegendők).
- **Visszagörgetés:** a kód revertje után a már beírt `error_reszlet` sorokat a **régi** kód a `lepesek.error_reszlet` kulcsban és a CSV-ben mutatná (a tölcsér 10 lépésének száma nem torzul, de a `lepesek` objektum 11. kulcsot kap). Ezért a revert után: `DELETE FROM lepes_szamlalo WHERE lepes = 'error_reszlet';` az éles (`mosaic-foglalo-szamlalo`) és az előnézeti (`mosaic-foglalo-szamlalo-elonezet`) D1-en is.
- Teszt: `node --test tools/test-lepes-meres.mjs` (29/29; 9 új eset), `node tools/meres-proba/lepes-proba.mjs --overlay dist` (asztali és mobil: 25/25, a 4b eset a valódi böngészőben ellenőrzi az `error_reszlet` beaconját), napló: `meres-naplo/2026-10-15-hiba-reszlet-teszt.md`.

## 5c. PARSE-bontás (2026-10-17, #178, a #334 első adata) – MÉRÉS ÉRINTŐ

A #334 első valós adata (10-16 oxigén 3× `salonic_api.OX1.PARSE.0`, 10-17 lézer 1× `salonic_api.LA1.PARSE.0`) azt mutatta, hogy az `OX1` / `LA1` nézet betöltésénél a **szolgáltatáslista** (`servicesRaw`) üres: a Salonic **2xx** választ adott (minden nem-2xx `HTTP.<státusz>`, az időtúllépés `TIMEOUT`, a hálózati / CORS-hiba `HTTP.0`), de a törzsben nem volt kategória-link / szolgáltatás-sor. A tartalom-típust és a hosszt az adapter nem nézte, ezért az üres törzs, a nem-Salonic oldal, a karbantartási sablon és a szabályos üres lista ugyanaz a `PARSE.0` volt.

A kiegészítés a `PARSE` kódot **zárt, PII-mentes** részletekre bontja (ugyanabban az `error_reszlet` sorban, a hibakód helyén):

| kód | jelentés |
|---|---|
| `PARSE_EMPTY` | üres (vagy csak szóközt tartalmazó) törzs |
| `PARSE_NOTHTML` | a `content-type` nem `html` (pl. `text/plain`, `application/json`) |
| `PARSE_SHORT` | html, de a vágott törzs < 5000 karakter (tipikus hiba- / karbantartási sablon) |
| `PARSE_NOLIST` | normál méretű (≥ 5000) html, de nincs benne elem (szabályos üres lista vagy jelölésváltozás) |
| `PARSE_JSON` | a naptár-API (`getAvailableTimes`) válasza nem JSON |
| `PARSE` | bármi más (pl. argumentum-ellenőrzés; vagy nincs metaadat) |

**Diagnosztikai korlátok:** üres vagy hiányzó `content-type` mellett egy < 5000 karakteres válasz is `PARSE_SHORT` (a „html, de” itt a fejléc hiányában nem bizonyított); a `PARSE_NOLIST` három esetet von össze (0 kategória a `selectSpecialization` oldalon, kategóriák szolgáltatás nélkül, teljes layoutú hibaoldal), ezeket a tartalom nélkül nem lehet szétválasztani – ez szándékos adatvédelmi / adatminimalizálási korlát. A küszöb (5000) a valós Salonic-oldalak mérete (kb. 20–112 KB) alapján konzervatív, de a hibaoldalak valós mérete nem mérhető előre: az első valós `PARSE_*` adatok után felülvizsgálandó.

- **Mit jegyez fel az adapter:** a `getText` a `content-type` fejléc első 80 karakterét és a **vágott törzs hosszát** írja a **hívó saját, lokális objektumába** (a `servicesRaw` `page()` hívásának `lekert` listájába; nincs közös, URL-kulcsú állapot, ezért párhuzamos lekérések sem keverhetik). A törzs nem tárolódik, az URL nem kerül a metaadatba, és a lekérés végeztével az egész eldobódik; **kimenetbe (hibakivétel, beacon, napló) csak a zárt `kind` érték kerül**. A kérés, az újrapróbálás, az elemzés és a visszatérési érték **változatlan**; a jegyzés saját `try`-ban fut, hibája nem akadályozza a lekérést. A `servicesRaw` az üres (`found`) ágon osztályoz (`parseKind`: ha több oldalt töltött le, a legerősebb jel dönt: üres > nem html > rövid > nincs elem); a `kind`-ot a már dobott `SalonicError`-ra teszi.
- **Mi változik még:** `lepes-meres.js` (`HIBA_KODOK` + `hibaReszlet`: `PARSE` + ismert `kind` → `PARSE_<KIND>`, ismeretlen kind marad `PARSE`), `engine.js` (egy sor: a `kind`-ot átadja), `netlify/lib/foglalo-szamlalo.js` (a zárt hibakód-lista és a `salonic_api` megengedett kódjai). A `PARSE_*` kód csak `salonic_api` mellett és HTTP-státusz nélkül (`.0`) fogadható el.
- **Nem változik:** a GA4 / dataLayer (a `booking_error` `reason` továbbra is `PARSE`), a `LEPESEK`, a tölcsér-számok, az `error` sor, a D1-séma, a foglalási logika, a Salonic-hívások, a konverziók, a kiküldés.
- **Teszt:** `tools/test-salonic-adapter.mjs` (6 új eset, köztük a párhuzamos lekérések függetlensége), `tools/test-lepes-meres.mjs` (5 új eset, köztük a rollback-SQL, köztük a „kliens ⊆ szerver” tulajdonság a PARSE-kindekre), `node tools/meres-proba/lepes-proba.mjs --overlay dist` (asztali és mobil: 33/33; a 4c eset a valódi böngészőben, mockolt Salonic-oldallal ellenőrzi a négy `OX1.PARSE_*.0` beaconját). Napló: `meres-naplo/2026-10-17-parse-bontas-teszt.md`.
- **Visszagörgetés:** a kód revertje (egy commit) elég. A revert után a **régi** szerver az *újonnan érkező* `PARSE_*` beaconöket `400`-zal utasítja el (a kliens ezt lenyeli, a foglalást nem érinti), a már beírt `PARSE_*` sorok viszont a D1-ben megmaradnak, és a GET kimenetében `hiba_reszlet` alatt látszanának: ha zavar, `DELETE FROM lepes_szamlalo WHERE lepes = 'error_reszlet' AND tipus GLOB '*.*.PARSE_*';` az éles (`mosaic-foglalo-szamlalo`) és az előnézeti (`mosaic-foglalo-szamlalo-elonezet`) D1-en. (A `GLOB` literális `_`-t használ, nincs shell-escape; a sima `…PARSE.0` sort nem érinti. Tesztelve: `tools/test-lepes-meres.mjs`, a parancsot a teszt ebből a dokumentumból olvassa ki.)

## 6. Kikapcsolás

- Számláló: a `wrangler.toml`-ból a `[[d1_databases]]` kötés törlése → a végpont `204`-et ad és semmit nem tárol (a foglaló ettől nem akad el).
- GA4: a GTM munkaterület nem publikálása / a trigger szüneteltetése.
- Az egész lépés-mérés: a `lepes-meres.js` `createStepMeter` hívásainak eltávolítása az `engine.js`-ből (a modul minden hibát elnyel, soha nem akadályozza a foglalást).
