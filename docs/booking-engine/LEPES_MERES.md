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

## 5. Korlátok, megjegyzések

- **`booking_submit`:** az „Időpont lefoglalása” gomb a Salonic beágyazott adatlapján van (idegen eredet), a kattintás nem megfigyelhető. A beadást onnan látjuk, hogy a Salonic a **saját oldalunkra** irányít vissza (sikeres foglalás vagy elkelt időpont): ez a megfigyelhető „elküldte” jel. Az adatlapon belüli hibás kitöltést (Salonic-validáció) nem látjuk.
- **`booking_close`** csak a rétegben van (az önálló `/foglalo-motor` oldalon nincs bezárás), és nem megy, ha a sikeres foglalás után az éles oldalon átadjuk a vendéget a köszönőoldalnak (az oldal elnavigál).
- A régi `tracking.js`-szerződés (`booking_service_selected`, `booking_slot_selected`, `booking_completed` stb.) változatlan és továbbra sem kapcsolódik semmilyen fiókhoz; a `booking_open` és a `booking_error` nevet viszont már **csak** a lépés-mérés adja a `dataLayer`-be (egy lépésről egy esemény).
- A `gift` üzletág a számlálóban és a spec szerinti listában szerepel (a jövőbeli ajándékkártya-lépésekhez); a foglaló jelenleg nem használja, az ajándékkártyás beváltás HeadSpa-foglalásként `headspa`.
- GA4: a paraméterek riportálásához a GA4-ben (Admin → Egyedi definíciók) a `business`, `service_id`, `source_page`, `step`, `error_type` esemény-szintű egyedi dimenzió, a `load_ms` egyedi mutató legyen (a GTM publikálása után; ezt a GA4 felületén kell egyszer beállítani).

## 6. Kikapcsolás

- Számláló: a `wrangler.toml`-ból a `[[d1_databases]]` kötés törlése → a végpont `204`-et ad és semmit nem tárol (a foglaló ettől nem akad el).
- GA4: a GTM munkaterület nem publikálása / a trigger szüneteltetése.
- Az egész lépés-mérés: a `lepes-meres.js` `createStepMeter` hívásainak eltávolítása az `engine.js`-ből (a modul minden hibát elnyel, soha nem akadályozza a foglalást).
