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
- (2026-10-19, DECISION #205) további, csak a belső számlálónak szóló lépések: nem igazolt siker és a bukó ellenőrzések kódjai, az űrlaptól a kimenetig eltelt idő, az A2 minden előfordulása és a helyreállás, forrás / eszköz / idő szerinti bontás, a C1 szabad időpontjai: lásd az 5c szakaszt (a GA4 ezekből semmit nem kap).

Védelem: csak azonos eredetű kérés fogadható el; a mezők zárt listából valók (bármi más = elutasítás); egy kulcs napi darabszáma legfeljebb 100 000; a robot (WebDriver) forgalom nem számolódik (hogy egy bejárás ne torzítsa a számokat). Az élő és az előnézeti oldal külön adatbázist használ.

## 3. A számláló kiolvasása (naponta)

Egy link, kulccsal (a kulcsot a tulajdonos kapta meg; a kódban csak a SHA-256-ja van, a `wrangler.toml` `SZAMLALO_OLVASO_HASH` sorában):

- **Táblázat, emberi nézet:** `https://www.mosaicheadspa.hu/api/foglalo-szamlalo?kulcs=<kulcs>&formatum=html`
- **JSON:** `…?kulcs=<kulcs>&nap=2026-10-05` (egy nap) vagy `&tol=2026-10-01&ig=2026-10-05` (legfeljebb 93 nap); alapból az utolsó 7 nap
- **CSV:** `…&formatum=csv` (`nap;uzletag;lepes;tipus;darab`; a betöltési időnél `slots_loaded_ms` sorok: a vödrök, az `atlag` és a `max`)

Kulcs nélkül / rossz kulccsal 404. Új kulcs: `node -e "const c=require('crypto');const t=c.randomBytes(24).toString('base64url');console.log(t, c.createHash('sha256').update(t).digest('hex'))"`, majd a hash a `wrangler.toml`-ba (`[vars]` és `[env.preview.vars]`), új deploy.

## 4. Próbák (élesítés előtt, tiltott kimenő méréssel)

- `node --test tools/test-lepes-meres.mjs` – a kliens-modul (egyszer-egyszer, hozzájárulás, robot, személyes adat nélküliség, a régi `booking_open` / `booking_error` kikapcsolása) és a szerver (érvényesítés, atomikus számlálás valódi SQLite-on, budapesti nap, védelem, olvasás JSON/CSV/HTML).
- `node tools/meres-proba/engine-meter-diff.mjs [<git-ref>]` – statikus ellenőrzés (DECISION #205): az `engine.js` forrásából az összes `meter.*(…)` hívás és a megjegyzések kitörlése után a mostani fájl **betűre egyezik** a kiindulással (alapból `origin/main`): a **nem-meter szöveg azonos**. Szigorú alak-ellenőrzés is fut: minden új `meter.*` hívás csak utasítás-határ után állhat (`;` `{` `}`: nem lehet `if` / `else` törzs vagy kifejezés része), az argumentuma szűk nyelvtanú (azonosító / tagolvasás / literál / összehasonlítás / `nowUnix()`; nincs értékadás, függvényhívás, `await`, `new`, `++`). **Amit NEM bizonyít** (kézi + differenciális jsdom-ellenőrzés kell hozzá): hogy egy tagolvasás nem dob (pl. hiányzó mező), és hogy a hívás sorrendje a nem-meter utasításokhoz képest jó. Kilépési kód 0 = azonos és a hívások alakja rendben (önellenőrzés: `tools/test-engine-meter-diff.mjs`).
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
  - `<hibakód>` és `<hibatípus>` zárt párok: `timeout` → `TIMEOUT`; `client_error` → `NONE` (nincs adapter-hibakód); `salonic_api` → az adapter hibakódja (`HTTP`, `PARSE`, `API_STATUS`, `SERVICE_NOT_FOUND`, `NO_CALENDAR`, `UNKNOWN_BUSINESS`, `NOT_SUPPORTED`; ismeretlen kód: `OTHER`). A többi hibatípus (`no_slots`, `slot_lost`, …) nem hordoz részletet.
  - `<http>`: kanonikusan `0` vagy `100`–`599` (nincs `00` / `000` / vezető nulla), és csak `HTTP` vagy `API_STATUS` kód mellett lehet nem nulla. **A `0` azt jelenti: nincs HTTP-státusz** (pl. a kérés nem jutott el a Salonic-hoz: hálózati hiba, CORS, megszakítás; vagy a hibakód nem HTTP-eredetű). Ha a Salonic API `status` mezője szám, az `API_STATUS.<szám>` alakban jelenik meg: ez az API saját státusza, **nem** HTTP-státusz; a szöveges API-státusz `API_STATUS.0`.
- **Nincs benne** URL, hibaüzenet, azonosító, süti, időbélyeg, személyes adat; a szerver zárt alakot fogad el (`ervenyesit`), minden más `400`; a kliens kimenete a szerver által elfogadott halmaz része (teszt: kliens ⊆ szerver).
- **Mikor megy:** csak a nézet-betöltési hibánál (`engine.js` `catch`), a hibatípus egyszer-kapuján belül (ugyanaz a (típus, nézet, szolgáltatás) hármas legfeljebb egyszer: egy második, más kódú hiba ugyanarra a hármasra nem kerül be), próbából és robotból nem. A kliens a hiba-részletet saját `try`-blokkban küldi, hibája sosem akadályozza a foglalást.
- **Kulcsszám-plafon:** (nap, üzletág) szerint legfeljebb `RESZLET_KULCS_PLAFON` = 100 **különböző** részlet-kulcs kerül be (egyetlen atomikus `INSERT … SELECT` feltétellel); a meglévő kulcs tovább nő (kulcsonként a `DB_PLAFON`). A valódi forgalom naponta néhány tucat kulcsot ad. Ez véd a D1-sorok felfúvódása ellen, ha valaki a végpontot közvetlenül hívja.
- **Nem változik:** a `LEPESEK` lista és a GA4-esemény lista (a részlet **nem** megy GA4-be és a dataLayer-be sem), a tölcsér-számok, az `error` sor, a foglalási logika, a Salonic-hívások, a konverziók és a kiküldés. A `GET /api/foglalo-szamlalo` JSON kimenetében egy **további** `hiba_reszlet` kulcs jelenik meg üzletágankénti (napi és összesített) bontásban, csak ha van adat; a CSV-ben `error_reszlet` sorok; a HTML-ben a hibák cellában kis betűvel.
- **D1-séma:** nincs változás (a meglévő `lepes_szamlalo` oszlopai elegendők).
- **Visszagörgetés:** a kód revertje után a már beírt `error_reszlet` sorokat a **régi** kód a `lepesek.error_reszlet` kulcsban és a CSV-ben mutatná (a tölcsér 10 lépésének száma nem torzul, de a `lepesek` objektum 11. kulcsot kap). Ezért a revert után: `DELETE FROM lepes_szamlalo WHERE lepes = 'error_reszlet';` az éles (`mosaic-foglalo-szamlalo`) és az előnézeti (`mosaic-foglalo-szamlalo-elonezet`) D1-en is.
- Teszt: `node --test tools/test-lepes-meres.mjs` (29/29; 9 új eset), `node tools/meres-proba/lepes-proba.mjs --overlay dist` (asztali és mobil: 25/25, a 4b eset a valódi böngészőben ellenőrzi az `error_reszlet` beaconját), napló: `meres-naplo/2026-10-15-hiba-reszlet-teszt.md`.

## 5c. Csak-mérés bővítés (2026-10-19, DECISION #205) – MÉRÉS ÉRINTŐ, a foglalási folyamatot NEM érinti

Jóváhagyott szöveg (Drive DECISION-LOG #205): *(a) bukó ellenőrzés kódjainak belső számlálása; (b) `success_unverified` lépés, riport: foglalás = success + success_unverified; (c) form_start → kimenet időeltolódás-vödrök; (d) A2 utáni „recovered" jelző, a2Reason nullázása, egyszer-kapu szétszedése; (e) zárt listás forrás- / eszköz- / időtartam-vödrök a lépésekhez, a C1-nél a 7 napos szabad időpontszám és a legkorábbi szabad nap. Feltétel: személyes adat nincs, whitelistelt mezők, tesztek + független review.*

**Elv:** minden új lépés **csak a belső számlálónak** megy (a GA4 / `dataLayer` ezekből semmit nem kap: nincs új esemény, nincs új paraméter), a `LEPESEK` (tölcsér) és az `ESEMENYEK` (GA4) lista **változatlan**. A mérés hibája sosem akadályozhatja a foglalást (minden új kód `try / catch`-ben, a `meter` biztonságos burkában fut). Az `engine.js` diffje csak `meter.*` hívás (5 sor, lásd lent; a `tools/meres-proba/engine-meter-diff.mjs` bizonyítja). A próbafoglalás (`?proba=1`), a robot (`navigator.webdriver`) és a hozzájárulás-mentes ág viselkedése ugyanaz, mint a többi lépésé.

### Az új belső lépések (mind a `lepes_szamlalo` táblába, `lepes` = a lépés neve, `tipus` = zárt listák pontokkal)

| Lépés | Típus (zárt) | Mit számol |
|---|---|---|
| `verify_check` | `params`, `place`, `service`, `slot`, `staff`, `price`, `no_expectation` | **(a)** a Salonic-átirányítás ellenőrzésének minden **bukó** ellenőrzése külön darab (egy verify-bukásnál több is lehet); `no_expectation` = nem volt mit ellenőrizni (`S.expected` hiánya). Csak a kód megy, a vártat / kapott értéket soha. |
| `success_unverified` | – (nincs típus) | **(b)** a Salonic átirányított a köszönőoldalra, de az ellenőrzés nem igazolta: a motor ilyenkor is a köszönőoldalra (éles) / `A3U`-ra (előnézet) irányít, a foglalás a gyakorlatban létrejön. **Foglalás = `success` + `success_unverified`.** Egyszer foglalásonként (szolgáltatás + időpont). |
| `kimenet_ido` | `<kimenet>.<vödör>` | **(c)** az utolsó adatlap-megjelenéstől (`form_start`) a kimenetig eltelt idő vödre. Kimenet: `success`, `success_unverified`, `verify_failed`, `slot_lost`, `hold_expired`, `c4_close` (a `C4`-ben zárta be). Csak ha volt `form_start`. |
| `recovered` | `<A2 oka>.<kimenet>` (`slot_lost` / `hold_expired` × `success` / `success_unverified`) | **(d)** a vendég egy A2 (elkelt időpont / lejárt foglalási idő) **után** sikeres foglalásig jutott; ülésenként egyszer; az ok az utolsó A2-é. |
| `a2_elofordulas` | `<A2 oka>.<sorszám>` (`1`, `2`, `3`, `4`, `ge5`) | **(d)** a belső számláló **minden** A2-nyitást számol az ülésben (a sorszám az A2 előfordulásáé az ülésben); kivétel a gyors dupla értesítés: ugyanaz az ok, 2 mp-en belül, új adatlap-megjelenés (`form_start`) nélkül nem új előfordulás. Az `n`. sorszámú darabszám = azon ülések száma, ahol legalább `n` A2 volt; az összes előfordulás = a sorszámok összege. |
| `lepes_bontas` | `<lépés>.<forrás>.<eszköz>` | **(e)** a tölcsér-lépések (`open`, `business`, `service`, `slots_loaded`, `slot`, `form_start`, `submit`, `success`, `success_unverified`) forrás × eszköz szerinti darabszáma. |
| `lepes_ido` | `<lépés>.<vödör>` | **(e)** a megnyitástól az adott lépésig eltelt idő vödre (az `open` kivételével). |
| `c1_szabad` | `0`, `1-3`, `4-10`, `11-30`, `31+` | **(e)** a C1 (szabad időpontok) megjelenésekor a következő 7 nap szabad (különböző kezdésű) időpontjainak száma. |
| `c1_elso_nap` | `ma`, `1-2`, `3-7`, `8-14`, `15+`, `nincs` | **(e)** a legkorábbi szabad nap (budapesti naptári nap; hány nap múlva). A C1-nél egyszer (szolgáltatás, szakember) szerint; a már betöltött listából számolva, **új hálózati hívás nincs**. |

Zárt listák (a kliens és a szerver ugyanazt ismeri, teszt: egyezés; a szerver minden mást `400`-zal elutasít):
- **vödör (idő):** `lt5s` (<5 s), `lt30s`, `lt60s`, `lt120s`, `lt300s`, `ge300s` (≥5 perc).
- **forrás:** `google`, `meta`, `tiktok`, `egyeb`. **eszköz:** `mobil` (ablakszélesség < 700 px), `tablet` (< 1100 px), `asztali` (egyébként / ismeretlen). Csak szélesség-küszöb: nincs user-agent, nincs ujjlenyomat.
- **Forrás-osztályozás** (a motor megnyitásakor, egyszer; nincs tárolás, nincs süti): 1. a motor kontextusában az `fbclid` **kulcs léte** → `meta`, a `ttclid` → `tiktok`; 2. az `utm_source` zárt listás értéke (`google`, `googleads`, `google-ads`, `adwords` → google; `facebook`, `fb`, `ig`, `instagram`, `meta` → meta; `tiktok`); 3. a `gclid` / `gbraid` / `wbraid` kulcs léte → `google` (ebben a sorrendben: a motor a megnyitás előtt a MENTETT, 90 napos Google-azonosítókkal is pótolja a kontextust, ezért a friss URL-jelek – `fbclid`, `ttclid`, `utm_source` – előrébb vannak; így egy Meta-hirdetésről érkező, korábban Google-ra kattintott látogató `meta`, de egy Facebook-referrerrel, azonosító és utm nélkül érkező, korábban Google-ra kattintott `google`); 4. a `document.referrer` gazdagépe (`google.*` → google; `facebook.com`, `fb.com`, `fb.me`, `instagram.com`, `messenger.com` → meta; `tiktok.com` → tiktok); különben `egyeb`. **Az azonosító értéke, az utm, a referrer-URL soha nem megy sehova**, csak a 4 kategória neve. A „google" kategória a Google-hirdetést, a mentett (hozzájárulással tárolt, 90 napos) Google-kattintást és a Google-keresési referrert együtt jelenti (nem választható szét); hozzájárulás nélkül a mentett azonosító nincs, így az osztályozás hozzájárulás-függő.
- **Kulcsszám:** a leghosszabb zárt tér a `lepes_bontas` (9 × 4 × 3 = 108); `kimenet_ido` 36, `lepes_ido` 48, `a2_elofordulas` 10, `recovered` 4, `verify_check` 7, `c1_szabad` 5, `c1_elso_nap` 6. **Plafon:** (nap, üzletág, lépés) szerint legfeljebb `BELSO_KULCS_PLAFON` = 150 **különböző** kulcs (mint a `RESZLET_KULCS_PLAFON`: egyetlen atomikus `INSERT … SELECT`; a meglévő kulcs tovább nő, kulcsonként a `DB_PLAFON`); a zárt listák mellett ez csak tartalék-védelem (törvényes forgalmat sosem vág).

### A2 és az `a2Reason` (d) – mit találtunk, mit csináltunk

- A motor `S.a2Reason` értéke (`taken` / `expired`) **sehol nem nullázódik**: a Salonic elkelt-jelzése (átirányítás a főoldalra) is a `S.a2Reason`-t olvassa, így egy korábbi lejárat (`expired`) után az elkelt időpont **tévesen `hold_expired`-ként** számolódik (és az A2 cím is „A foglalási idő lejárt." lesz). Emellett a `meter.error` egyszer-kapuja (`error:<típus>:<lépés>:<szolgáltatás>`) miatt ugyanabban az ülésben az ismételt elvesztés csak egyszer számolódik.
- **Nem az `S.a2Reason`-t nullázzuk a motorban**, mert az az A2 nézet szövegét és a GA4 hibatípusát is változtatná (az A2 újrarajzolásakor, pl. a böngésző vissza gombjával, a nullázott ok `slot_lost`-ot adna egy `hold_expired` után, ami új GA4-eseményt és más szöveget jelent): ez a foglalási folyamat viselkedése, nem mérés. Helyette **a mérés nullázza a saját okát**: a motor közvetlenül az A2 megnyitása előtt jelzi az okot (`meter.a2Ok('taken' | 'expired' | 'redirect')`, 3 hívás a három A2-belépő helyen), a következő `meter.error('slot_lost' | 'hold_expired')` **egyszer használja fel és nullázza**. Csak jelzett nyitás számít új előfordulásnak (az A2 újrarajzolása nem); az ok nem öröklődik. A belső `a2_elofordulas` / `kimenet_ido` / `recovered` ezért pontos; a **GA4 és a régi belső `error` lépés változatlan** (egyszer-kapu, a motor `S.a2Reason`-je szerinti típus): az említett ritka esetben (`expired` után elkelt időpont) a régi `error.hold_expired` és az új `a2_elofordulas.slot_lost.n` eltér, az utóbbi a helyes.
- **Hatókör:** az „ülés" = egy motor-példány (`createStepMeter`): a foglaló bezárása és új megnyitása új ülés (a `recovered` csak ugyanazon a megnyitáson belül számít). A mintanézet (`?minta=elkelt`) nem jelez okot, ezért az új A2-számlálókat nem növeli (a régi `error` lépést a mintanézet is növeli: korábbi viselkedés, változatlan).

### Mi jön a motorból (az `engine.js` teljes diffje: +5 / −2 sor, csak `meter.*`)

`meter.a2Ok('taken')` (a végső ellenőrzés szerint elkelt), `meter.a2Ok('expired')` (lejárt a 4:50), `meter.a2Ok(kind === 'slot_lost' ? 'redirect' : null)` (a Salonic elkelt-jelzése), `meter.unverified(v, S.slot && S.slot.slot_id)` (a nem igazolt átirányítás; igazolt `v.ok` esetén nem csinál semmit), `meter.c1(S.slots, S.staff, nowUnix())` (a C1 betöltött listájából). A `meter.formStart`, `meter.success`, `meter.close`, `meter.error` hívások változatlanok; a `lepes-meres.js` belül bővült. A `meter.error('verify_failed', 'C5')` és a `verify_failed` hiba-számlálás **marad** (történeti összevethetőség); a `success_unverified` **mellette**, külön lépésként megy (a `verify_failed` típus/lépés/szolgáltatás szerint egyszer számolódik, a `success_unverified` foglalásonként).

### A riport (GET) – additív kulcsok, a meglévő kimenet nem változik

- **JSON** (naponta és összesen, üzletáganként; mind csak akkor van ott, ha van adat): `foglalas_osszes` (= `lepesek.success` + `success_unverified`), `success_unverified` (szám), `verify_check`, `kimenet_ido`, `recovered`, `a2_elofordulas`, `lepes_bontas`, `lepes_ido`, `c1_szabad`, `c1_elso_nap` (mind `{ "<típus>": darab }`). Az új lépések **nem** kerülnek a `lepesek` objektumba (a tölcsér-szerkezet változatlan).
- **CSV:** a tárolt sorok (`nap;üzletág;<lépés>;<típus>;darab`) + egy `foglalas_osszes` sor; a meglévő sorok után.
- **HTML:** a meglévő táblázat után, naponta egy „Bővített mérés (DECISION #205)" táblázat (csak ha van adat).
- Értelmezés: `kimenet_ido`-ban a `verify_failed` és a `success_unverified` **ugyanannak az eseménynek** két nézete (ne add össze őket); a darabszámok ülés-szintűek, nincs mögöttük azonosító vagy időbélyeg (csak a nap).

### Forgalom (kérések) és D1-írás

Minden új lépés külön `POST` (a szerver szerződése: egy kérés = egy kulcs), így a tölcsér-lépésenként 1 helyett 3 kérés megy (lépés + `lepes_bontas` + `lepes_ido`), a teljes sikeres út 9 helyett 27 kérés (a böngészős próbában mérve: 18 új beacon = 8 `lepes_bontas`, 7 `lepes_ido`, 2 C1, 1 `kimenet_ido`). Ez a Cloudflare Pages Functions napi kérés-keretéből és a D1 napi írás-keretéből (ingyenes csomag: 100 000 kérés / 100 000 sor-írás naponta) látogatónként kb. háromszoros fogyasztást jelent; a valódi forgalomnál (naponta néhány száz foglaló-megnyitás) ez a keret töredéke, de **a bevezetés utáni napokon érdemes figyelni** (ha szükséges: kötegelt kérés a szerveren és a kliensben, külön döntéssel). A D1-olvasás (riport) napi legfeljebb ~230 kulcs × üzletág × nap sor.

### Visszagörgetés

A PR revertje (egy commit) elég a kódhoz; a szerver bővített whitelistje **a régi klienst is elfogadja** (a régi kliens csak a régi lépéseket küldi), és fordítva: új kliens + régi szerver esetén az új lépések `400`-at kapnak, a foglalás nem érintett. **A revert után a beírt új sorokat törölni kell** (különben a régi kód a `lepesek` objektumban és a CSV-ben megjelenítené őket; a tölcsér 10 lépésének száma nem torzul), az éles (`mosaic-foglalo-szamlalo`) és az előnézeti (`mosaic-foglalo-szamlalo-elonezet`) D1-en is:
`DELETE FROM lepes_szamlalo WHERE lepes IN ('verify_check','success_unverified','kimenet_ido','recovered','a2_elofordulas','lepes_bontas','lepes_ido','c1_szabad','c1_elso_nap');`

**D1-séma:** nincs változás (a `lepes_szamlalo(nap, uzletag, lepes, tipus, db)` meglévő oszlopai elegendők; a #188 `error_reszlet` lépés ugyanígy új `lepes`-érték volt séma-bővítés nélkül). A séma a repóban nincs (kézzel készült a D1-en); 2026-10-19-én **csak olvasó** lekérdezéssel (`SELECT sql FROM sqlite_master`) ellenőriztem az éles és az előnézeti D1-et is: `CREATE TABLE lepes_szamlalo (nap TEXT NOT NULL, uzletag TEXT NOT NULL, lepes TEXT NOT NULL, tipus TEXT NOT NULL DEFAULT '', db INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (nap, uzletag, lepes, tipus)) WITHOUT ROWID` – **nincs CHECK-megszorítás**, a tesztekben használt séma azonos vele.

Teszt: `node --test tools/test-lepes-meres.mjs` (a #205 esetek a „#205" előtagúak), `node tools/meres-proba/lepes-proba.mjs --overlay dist` (asztali és mobil; a 1., 3., 4. eset bővítve, új 6. = A2 kétszer + siker, 7. = nem igazolt siker), `node tools/meres-proba/engine-meter-diff.mjs`. Napló: `meres-naplo/2026-10-19-205-motor-meres.md`.

## 5d. HS-2: `price_irany` (2026-10-23, Feri: „ok”) – MÉRÉS ÉRINTŐ, a foglalási folyamatot NEM érinti

A `verify_check.price` bukásánál (a Salonic átirányításában jelentett ár nincs a motor által várt árak között) a belső számláló egy **névtelen irány-kulcsot** is kap, hogy a következő eltérésnél látszódjon, melyik oldal ára volt magasabb.

| Lépés | Típus (zárt) | Mit számol |
|---|---|---|
| `price_irany` | `lt` · `gt` · `eq` · `unknown` | a **jelentett** ár (Salonic átirányítás) a motor **várt** (`activePrice` + `acceptablePrices`) árához képest: `lt` = az összes elfogadott ár alatt, `gt` = felette, `eq` = valamelyikkel egyezik (a bukott ellenőrzésnél nem fordulhat elő, csak védelem), `unknown` = nem állapítható meg (hiányzó / nem szám, két elfogadott ár között). Csak akkor megy, ha a `checks.price.status === 'fail'`; foglalásonként egyszer (a `success_unverified` kapuja alatt) |

Az **összeg, a szolgáltatás, a név, az e-mail, a telefon, a foglalás-azonosító NEM kerül** a kérésbe; a GA4 / `dataLayer` semmit nem kap. A kliens (`priceIrany()` a `lepes-meres.js`-ben) és a szerver (`IRANYOK`, `BELSO_205.price_irany` a `netlify/lib/foglalo-szamlalo.js`-ben) ugyanazt a zárt listát ismeri (teszt: egyezés). Kulcsszám: 4 (a belső kulcs-plafon 150 alatt). A GET riport additív `price_irany` kulcsot kap; a HTML-táblában egy új oszlop.

Kikapcsolás / rollback: a `lepes-meres.js` `unverified()` egy sora (`belso(IRANY_LEPES, …)`) törlése megszünteti; az adatbázisban a sorok maradhatnak (`DELETE FROM lepes_szamlalo WHERE lepes = 'price_irany'` mindkét D1-en).

## 6. Kikapcsolás

- Számláló: a `wrangler.toml`-ból a `[[d1_databases]]` kötés törlése → a végpont `204`-et ad és semmit nem tárol (a foglaló ettől nem akad el).
- GA4: a GTM munkaterület nem publikálása / a trigger szüneteltetése.
- Az egész lépés-mérés: a `lepes-meres.js` `createStepMeter` hívásainak eltávolítása az `engine.js`-ből (a modul minden hibát elnyel, soha nem akadályozza a foglalást).
- A #205 bővítés külön: az `engine.js` 5 új `meter.*` sorának (`a2Ok` ×3, `unverified`, `c1`) eltávolítása kikapcsolja az A2 / nem igazolt / C1 lépéseket; a `lepes_bontas`, `lepes_ido`, `kimenet_ido` a `lepes-meres.js`-ben van (a PR revertje; a visszagörgetés után a beírt sorok törlése: lásd 5c).
