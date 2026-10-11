# Salonic-direct safety net (DECISION #127 (b), #130, #131)

**Állapot: kód + offline tesztek kész, NINCS élesítve.** Alapból **minden KI**: a környezeti kapu az élesben nincs beállítva, a D1-kapcsoló hiányzó sora = KI, a két titok nincs beállítva. Élesítés, Zap-módosítás, kapcsoló-váltás és a QA-5 T2 indítása **külön GPT + tulajdonos jóváhagyás** után (a QA-5 T2 feltétele: go-live + smoke PASS; az (a) hirdetés-útvonal **nem** feltétel, DECISION #128).

## 1. Cél

Ha egy Salonic-foglalásra a motoros (saját `booking_id`-s) párosítás **nem hoz eseményt** (a párosítás lezárt `parositatlan`, vagy a köszönőoldali kulcs-írás sosem érkezett), az esemény a **Salonic szalon-értesítőből** akkor is kimegy az ÁRNYÉK-célpontokra, **de soha nem kétszer**, és egy **csere** (időpontcsere: új Salonic-foglalás a régi helyett) nem számít új konverziónak.

## 2. Kapuk (mind kell, alapból mind KI)

| kapu | hol | alap |
|---|---|---|
| `MERES_SALONIC_DIRECT = "1"` | környezet (`wrangler.toml`: **csak** `[env.preview.vars]`; az éles `[vars]` nem kapja meg a go-live-ig; teszt őrzi: `S0-33`) | nincs |
| D1-kapcsoló `meres_kapcsolo`: `salonic_direct` (összes) / `salonic_direct:<üzletág>` (az üzletág-sor felülírja az összesítőt) | `POST /api/meres-admin {muvelet:"sd_kapcsolo", uzletag?, be:true}` — **a meglévő vészkapcsolókkal ellentétben a hiányzó sor = KI** | nincs sor = KI |
| `MERES_ELOSZTO = "1"` | az átvétel a motoros párosítást **lezárja**, ezért küldés nélkül nem veszünk át | éles + előnézet: be |
| titkok: `SD_HMAC_KEY_V1`, `GUEST_HMAC_KEY_V1` (Secret, nem a repóban) | Cloudflare felület | **nincsenek beállítva** → az sd inert |
| `MERES_SD_NS` | az sd azonosító névtere (`prod` alap, előnézet: `smoke`) | `prod` |
| `MERES_SD_INDEX = "1"` | csak a vendég-hash index írása / `index_backfill` (küldés nélkül), a teljes kapu nélkül is | nincs |

A meglévő vészkapcsolók (`mind`, `uzletag:*`, `platform:*`, `iras`, `MERES_IRAS_KI`) az sd-re is érvényesek (a cellák `kihagyva: veszkapcsolo …`).

## 3. Folyamat (a Zap 5. lépése, a létrehozó levél érkezése után ≥ 20 perccel)

`POST /api/foglalas-egyeztetes` (kulcsos), `muvelet: "sd_atvetel"`; mezők: `uuid, host, vendeg{email,telefon}, nev, uj_vendeg, szolgaltatas, felado, idopont_szoveg, munkatarsak, level_datuma (T0), megjegyzes, ar?, szaraz?`. **Új a Zap meglévő 1–4. lépéséhez képest: `nev` és `megjegyzes` (a Salonic „Megjegyzés” mezője)** — a Zap módosítása külön jóváhagyás.

1. kapuk → 2. kor (T0 = a létrehozó levél érkezése): `< 20 perc`: `koran`; `> 48 óra`: `lejart` (napló + riasztás, **0 automatikus küldés**) → 3. a motor megelőzte (`kuldve`): `motor_kuldte`; `ellentmondas`: `motor_ellentmondas` (ember dönt) → 4. **végső párosítás** (a #108 szűk, jóváhagyott kivétele: a motoros identity az sd atomi átvételéig még nyerhet; ha sikerül: `motor_nyert`, `late_pairing`) → 5. **atomi átvétel** (egyetlen UPSERT a `foglalas_egyeztetes` soron; versenyben a motoros párosítás és az sd közül pontosan egy nyer) → 6. csere-döntés → 7. küldés.

**`megjegyzes` (DECISION #132 2. pont):** a *létező, de üres* mező (`""`) **normális**: nincs csere-gyanú, a normál sd út fut (nem HOLD). A *hiányzó payload-kulcs* (elfelejtett Zap-leképezés) `hianyzo_mezo`: a csere-felismerés vak lenne, ezért **HOLD** (az események `halasztva` cellái, **0 automatikus küldés**) **+ riasztás** (`hianyzo_mezo`); ha a Zap később már küldi a kulcsot (akár üresen), az újrapróbált `sd_atvetel` a döntést **automatikusan újraértékeli** (ember nem kell). Így egy csere nem számolódik csendben kétszer, és a hiányzó leképezés sem marad észrevétlen.

`szaraz: true`: **írásmentes terv** (a D1 nem változik, nem küld, a végső próbát sem futtatja).

## 4. Identitás

`sd_<24 hex>` = `HMAC-SHA256(SD_HMAC_KEY_V1, "v1|<névtér>|<uuid kisbetűvel>")` első 24 hexája. Determinisztikus (újrafeldolgozás ugyanazt adja), a nyers UUID nem jelenik meg a platformkérésekben. Az események azonosítója `<EseményNév>:<sd_id>` (mint a motornál `<EseményNév>:<mb_…>`). A böngésző `sd_` azonosítót **nem** írhat (az érkezési végpont továbbra is csak a `mb_` / `pi_` / `ATU-` mintát fogadja).

## 5. Állapotok (`foglalas_egyeztetes.sd_allapot`)

`atveve` (feldolgozás alatt; 300 s után újra átvehető) · `kesz` · `tartva` (az élő állapot nem ellenőrizhető → `halasztva` cellák, újrapróbálható) · `halasztva` (reschedule_suspected HOLD) · `reschedule_confirmed` · `lejart` · `feloldva_uj` · `feloldva_confirmed`. Ismételt hívás ugyanarra az UUID-ra: **0 extra** küldés.

## 6. Dedup (három réteg)

1. atomi UUID-átvétel (a motoros `UPDATE … sd_id IS NULL`, az sd `UPSERT … kuldve IS NULL`),
2. egyedi index `(salonic_uuid, esemeny_nev, platform)` — az `mb_` és az `sd_` identitás között is,
3. a meglévő `(esemeny_id, platform)` egyedi index + a platform saját `event_id` dedupja.

**Késői motoros kulcs az sd UTÁN:** csak alias (`foglalas_alias`, `late_motor_key = 1`): nincs új esemény, nincs identity-csere / újraküldés (`kulcsIras` végén, hiba esetén is fail-open).

## 7. Csere (reschedule) — DECISION #131

* **`reschedule_confirmed`**, ha: azonos vendég-hash (e-mail-hash **ÉS** (telefon-hash **VAGY** név-hash)) + azonos üzletág + azonos **kanonikus** szolgáltatás + a megjegyzésben szereplő korábbi időpont (pl. „16 órás”, „okt. 16. 16:00”) **pontosan EGY** létező, az indexben szereplő foglalásra mutat. → **0 új esemény** minden platformon; `reschedule_from/to` tárolva; ha a régi foglalás **még él** (élő Salonic-ellenőrzés): `old_booking_still_active = true` + riasztás (az élő újraellenőrzés a riasztás-olvasáskor megszünteti, ha a régi törölve lett).
* **`reschedule_suspected`** (csere-gyanú a megjegyzésben, de nem igazolható: eltérő hash, 0 vagy ≥ 2 jelölt, nincs azonosítható időpont, nincs kulcs): **HOLD** — a cellák `halasztva`, **0 automatikus küldés** + riasztás.
* **`sd_feloldas`** (ember): `{muvelet:"sd_feloldas", …a hívás mezői…, dontes:"confirmed"|"uj_konverzio", ok:"<kötelező indok>"}` — csak `halasztva` sorra; `uj_konverzio`: az események egyszer kimennek; `confirmed`: a cellák `kihagyva (reschedule_confirmed, feloldva)`.
* Csere-gyanú (regex, ékezet-független, **KIZÁRÓLAG a Megjegyzés mezőn**; a szolgáltatás / munkatárs-címke nevén sosem fut — ott a „helyett” is szerepelhet, pl. csomagnevekben, és ez nem csere): `cser…`, `áthelyez…`, `átfoglal…`, `átütemez…`, `módosít…`, `elhalaszt…`, `korábbi/régi/előző foglalás|időpont`, `helyett`, `lemond…` stb. Megjegyzés csere-gyanú **nélkül** (vagy létező, üres megjegyzés): normál sd út. Hiányzó megjegyzés-kulcs: lásd a 3. pontot (`hianyzo_mezo` HOLD).

## 8. Érték és platformszabályok

* **Érték (D5):** a Salonic szalon-értesítő **nem** tartalmaz árat. Sorrend: Zap `ar` (ha van, `exact`) → a nevtábla szolgáltatás-listájának ára (`exact`, forrás `szolgaltatas_lista`; a nevtábla `ar` sorai a következő nevtábla-frissítéskor jönnek létre) → ismeretlen. **Kedvezmény-gyanú** (munkatárs-címkében „kedvezm…”, kupon a szolgáltatás nevében) → `unknown_discount` (a lista-ár nem tényleges ár), nincs ár → `unknown_price`. Nem `exact` esetén az esemény **érték nélkül** megy (Meta `value/currency/salonic_ar` nincs, TikTok `properties` érték nélkül, GA4 érték nélkül), az **értékhordozó TikTok `CompletePayment` visszatartva** (`kihagyva: ertek_ismeretlen`). A konzultáció a rögzített tábla-értéket kapja (`exact`).
* **Meta (D2):** `action_source = other`, **nincs** kitalált `event_source_url`, user agent, IP, fbp/fbc; hash-elt e-mail/telefon/external_id megy; `custom_data.forras/attr_minoseg/ertek_minoseg`.
* **TikTok:** hash-elt azonosítók, nincs ip/ua/ttclid/ttp, nincs kitalált oldal-URL.
* **GA4 (D3):** client_id nélkül **`jogos_0`** (szintetikus / újrahasznosított client_id tilos) — a cella `kihagyva: salonic_direct: nincs GA4 client_id …`.
* **Google:** kattintásazonosító nélkül nincs feltöltés (`kihagyva`, `jogos_0`); a visszatérő és az ernyő eleve nem megy.
* **D4:** nincs új jogi kapu (SZ-38 érvényes).

## 9. Vendég-hash index (reschedule-felismeréshez)

`foglalas_vendeg`: **csak HMAC-hash** (`GUEST_HMAC_KEY_V1`; e-mail / telefon / név, 32 hex), `uzletag`, kanonikus szolgáltatás-kulcs, kezdés, állapot, `lejar = ido + 180 nap`. Minden létrehozó levélnél a meglévő párosító kérésből íródik (fail-open, `ON CONFLICT DO NOTHING`; a nyers adat sosem kerül a D1-be). **`index_backfill`** (küldésmentes HMAC-index; **nem** `event_backfill`): `{muvelet:"index_backfill", elemek:[{uuid, host, szolgaltatas, idopont_szoveg, ld?, level_datuma, vendeg{email,telefon}, nev?, allapot?}] (max. 50), szaraz?}` — **küldés nélkül**, idempotens; a jövőbeli aktív foglalások ne essenek ki csak azért, mert régebben jöttek létre (történeti lookup 180 nap).

**Két külön művelet, két külön név (DECISION #132 4. pont):**

| név | mit csinál | állapot |
|---|---|---|
| `index_backfill` | csak a HMAC-index (`foglalas_vendeg`) feltöltése a reschedule-felismeréshez; **0 platformhívás, 0 esemény**, idempotens | engedett (jóváhagyás után fut, a `MERES_SD_INDEX` vagy a teljes kapu mögött) |
| `event_backfill` | régi (> 48 óra) foglalások eseményeinek **utólagos küldése** | **TILOS**: a végpont `403 {allapot:"tilos"}`-et ad, nem ír, nem küld (a kapuktól függetlenül); az sd a 48 órán túli foglalásra sem küld (`lejart`) |

## 10. QA-5 riport (D6, rétegezett)

`GET /api/meres-admin?egyeztetes=1&tol=..&ig=..[&forras=motor|salonic_direct]`: soronként `forras`, `attr_minoseg` (`A_teljes` / `B_motor_reszleges` / `C_salonic_direct`; **külön mező a `forras`-tól** — a `forras` azt mondja meg, melyik út küldött, az `attr_minoseg` az attribúciós adatok minőségét; a riport mindkettő szerint külön szűrhető / bontható: `forras` szűrő, `attr_minoseg_szerint`. Jelenlegi leképezés: a motoros sor **származtatott** az érkezési pillanatképből — A = van pillanatkép + IP + UA + GA4 client_id + legalább egy kattintás- / fbp- / ttp-jel, minden más (köztük a pillanatkép hiánya) B; a safety net sora mindig C, mert nincs böngészős pillanatképe), `ertek_minoseg`, `qa_kategoria` (`motor` / `post_t2_booking_object` / `reschedule_confirmed` / `reschedule_suspected_hold` / `sd_tartva` / `sd_lejart`), `no_new_conversion_expected`, `csere` blokk (`pre_t2_original_conversion`: `measured_new` | `not_observed`). Összegzés: `retegek.{motor, salonic_direct, osszes}`, `attr_minoseg_szerint`, `salonic_direct.{arany, allapotok, qa_kategoriak, reschedule}`. **Az sd benne marad az összesített lefedettségi nevezőben**; a `reschedule_confirmed` saját soron látszik, de cellái `jogos_0` (az „eligible” nevezőn kívül); a HOLD cella `hiany` marad. CSV: az új oszlopok a sor végén.

## 11. Riasztások

`GET /api/foglalas-egyeztetes?kulcs=..&sd_riasztas=1`: `reschedule_suspected`, `elo_allapot_nem_ellenorizheto`, `lejart_48_ora`, `atvetel_megszakadt`, `old_booking_still_active` (élő újraellenőrzéssel), `sd_hianyzik` (a motor lezárta a párosítást, de a Zap 5. lépése nem jött; csak bekapcsolt kapunál). A `riasztas = 1` sorok a meglévő `?riasztas=1` oldalon is látszanak (`sd_id`, `sd_allapot`).

## 12. Séma (mind additív, IF NOT EXISTS / `ALTER … ADD COLUMN`, idempotens)

`meres_kuldes` + `forras` (alap `motor`), `attr_minoseg`, `attr_jelek`, `salonic_uuid`, `ertek_minoseg` + részleges egyedi index; `foglalas_egyeztetes` + `sd_id`, `sd_allapot`, `sd_ido` + részleges egyedi index; új táblák: `foglalas_vendeg`, `foglalas_alias`, `foglalas_reschedule`; `salonic_nevtabla` új `ar` sorok. A meglévő sorok és a motoros út nem változik.

## 13. Tesztek

`node --test tools/test-salonic-direct.mjs` — **39 offline teszt** (valódi SQLite, mentett Salonic-oldalak, hamis platformhálózat, hamis óra, nincs titok): S0-01..S0-23 = a jóváhagyott 23 eset (1 PMU visszatérő · 2 új PMU · 3 konzultáció · 4 kedvezmény/unknown_discount · 5 törölt · 6 ismeretlen→halasztva→újrapróbálható · 7 5 párhuzamos átvétel · 8 elakadt átvétel · 9 korai motoros kulcs → motor nyer · 10 párosított UUID elutasítva · 11 kapcsoló ki · 12 két levél eltérő „új vendég” jelzéssel · 13 **GOLDEN** · 14 0 élő azonosító · 15 nincs nyers adat · 16 HMAC stabil · 17 99ffaec4-negatív · 18 hash eltér · 19 két jelölt · 20 jelölt nincs az indexben · 21 régi lemondott · 22 csere-gyanú nélkül · 23 `sd_feloldas`); S0-24.. = parser, index/`index_backfill`, száraz terv, alias, kor/lejárat, dedup 2. réteg, vészkapcsolók, riasztások, QA riport, konfig-őr; S0-34 Megjegyzés-szabályok (#132: létező üres = normális, hiányzó kulcs = `hianyzo_mezo` HOLD + riasztás + automatikus pótlás, csere-gyanú csak a Megjegyzésen); S0-35 `index_backfill` (küldésmentes) vs `event_backfill` (403 tilos); S0-36 hair / oxygen / laser üzletág (a HOST `placeId`-jából: ár-keresés, élő újraellenőrzés); S0-37 `sd_feloldas` + nem ellenőrizhető élő állapot (`tartva` + riasztás); S0-38 a végső párosítás átmeneti hibája (a motor nyer, az sd vár); S0-39 a motor már küldött, de egy cella `halasztva` maradt (idempotens pótlás a motoros identitással).
**Golden paritás:** `tools/meres-proba/golden-motor.mjs` a módosítás **előtti** kódból generált fixture-t (`tools/fixtures/golden-motor-kerelem.json`: 468 platformkérés-törzs + 6 teljes elosztás a napló régi oszlopaival: 3 `fk.uuid` nélkül + 3 a **valódi motoros úttal** (`foglalas-esemeny.js` átadja a Salonic-UUID-t, a napló `salonic_uuid` oszlopa ettől sem érinti a régi oszlopokat) — a fixture mindkét fele a **módosítatlan** (`main` `eec5645`) kódból készült) **bájtra** egyezőnek követeli; a motoros kérés-törzsek nem változtak. Újragenerálás (`--ir`) csak szándékos, jóváhagyott változásnál.

## 14. Élesítési sorrend (EGYIK SEM kezdhető jóváhagyás nélkül)

S1 előnézeti smoke → go-live döntés → S2 éles száraz próba → T2.
1. PR + előnézet; titkok (`SD_HMAC_KEY_V1`, `GUEST_HMAC_KEY_V1`) beállítása az előnézeten; nevtábla-frissítés (ár sorok); hash-index backfill.
2. Smoke PASS (GPT): 1 pozitív, kontrollált direct-Salonic TESZT foglalás (nem a 99ffaec4) → stabil sd identity → helyes eseménytípus → árnyék platformok → pontosan egyszer; ugyanazon UUID újrafeldolgozása 0 extra; 1 `csere_gyanu` negatív (99ffaec4-típus) 0 téves új esemény; motoros golden/regresszió; 0 küldés élő célra.
3. Zap 5. lépés (késleltetés ≥ 20 perc) + `nev`, `megjegyzes` mezők; D1-kapcsoló `be:true` (üzletáganként).

## 15. Megfigyelések (nem ennek a változtatásnak a tárgya)

* **Vészkapcsoló-cella (DECISION #121, szándékos működés — NEM javítjuk):** a vészkapcsoló miatt `kihagyva` cella a kapcsoló visszakapcsolása után **nem küldődik újra** (a motoros és az sd úton egyformán). Ez a #121 szerinti, jóváhagyott viselkedés; a kód nem módosul, az `elosztas.js` meglévő `naploz()` szemantikáját (a golden paritás is ezt rögzíti) érintetlenül hagytam.
* Egy `sd_atvetel` ≈ 46 D1-lekérdezés (a motoros „párosítás + küldés” kérés is 46); az isolate első kérésén + ~6 séma-bootstrap lekérdezés.
* A csere-felismerés **csak az sd úton** fut (DECISION #131 tárgya); ha az **új** foglalás a motoros úton párosul (van `mb_` kulcs), a motor a megjegyzést nem vizsgálja (a vendég-hash index viszont a régi foglalásokat mindkét útról tartalmazza, így a későbbi sd-csere felismeri).
* A TikTok `event_source: web` + pixel marad (árnyék), böngésző nélkül is; ha a TikTok ezt elutasítja, a smoke jelzi.
* **Pre-existing hiba (nem ennek a változtatásnak a hibája):** `tools/test-foglalo-atkotes.mjs` **19. tesztje** a `main`-en (`eec5645`) is bukik, és a diff a tesztelt fájlokat nem érinti (ellenőrzés: a módosítások `git stash`-elése után, tiszta `main`-en ugyanúgy bukik). Külön, a safety nettől független feladat.
