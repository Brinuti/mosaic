# Medical Piercing – szerveres Google Ads foglalásfeltöltés (ÁRNYÉK)

Állapot: **megépítve, próbaüzemben** (Google felé csak `validate_only` / `dryrun`). Élesítés Feri jóváhagyása után (lásd 6. pont).
A Mosaic azonos láncának (docs/booking-engine/QA2_ARNYEK.md, QA4_ELESITES.md, BOOKING_ID.md) MP-s megfelelője, de **külön kód,
külön adatbázis, külön titkok**: a Mosaic kódjából semmit nem importál (teszt is ellenőrzi).

## 1. A lánc

```
vendég hirdetésből érkezik (?gclid / gbraid / wbraid)
  └─ assets/js/mp-meres.js: CookieYes hirdetési hozzájárulással localStorage "mp_gk" (90 nap); nélküle semmi
Salonic (medicalpiercing.salonic.hu)  vagy  később a beágyazott motor
  └─ átirányítás: /foglalas-ok[-tipus]?bookingUrl=…&price=…&first_booking=…[&booking_id=…]
       └─ mp-meres.js: POST /api/mp-foglalas  { ut, p: {bookingUrl, price, first_booking, booking_id, placeId, employeeId, startDate, serviceId}, kattintas }
            └─ functions/api/mp-foglalas.js → lib/meres/lanc.js
                 ├─ koszonoOldal() (lib/meres/meres.js) → kulcs = placeId|employeeId|startUnix
                 ├─ hozzájárulás a "cookieyes-consent" sütiből (a szerver maga olvassa, nem a böngésző állítása)
                 ├─ D1 "mp-meres" (MP_MERES_DB): INSERT OR IGNORE mp_foglalas → deduplikáció a kulcson
                 └─ csak új foglalásnál: lib/meres/google-ads.js → Google Ads, eredmény: mp_feltoltes
```

- **Akciók** (MP fiók 2626380837, kódban rögzítve, más fiókra / akcióra a kérés nem állítható össze):
  mindig `ARNYEK - MP - Foglalas` (7834926162), plusz `… - uj vendeg` (7834926165), ha `first_booking=true`,
  vagy `… - visszatero` (7834926168), ha `false`. Ismeretlen esetben csak a Foglalás.
- **order_id = a foglalási kulcs** (`placeId|employeeId|startUnix`) – mindkét úton ugyanaz, így a Google is deduplikál.
- **Időpont:** a köszönőoldalra érkezés ideje (Europe/Budapest), nem a kezelés időpontja.
- **Érték:** a köszönőoldali `price` (MP-4); ha nincs, érték nélkül megy (az akció alapértéke 0) – nem átlagár.
- **Két foglalási út:** a Salonic-út és a későbbi motor ugyanazt a köszönőoldalt és definíciót használja. A motor
  `booking_id`-t is ad (a rekord `forras = motor`, `salonic_id` = ez); `bookingUrl` helyett `placeId`/`employeeId`/`startDate`
  is elfogadott. Ha ugyanaz a foglalás mindkét úton jelez, a kulcs miatt egyszer számít.

## 2. Adatvédelem (MP-16)

- A böngésző **csak** a fenti mezőket küldi; a szolgáltatás neve, kategória, vendég-azonosító (`g`), név / e-mail / telefon
  nem hagyja el a böngészőt. A szerver a többi mezőt eldobja, a `bookingUrl` csak a Salonic MP-aldomainje lehet.
- A rekordban nincs piercing-típus, szolgáltatásszöveg, személyes adat; a helyszín semleges városkód.
- **gclid / gbraid / wbraid csak hirdetési hozzájárulással** kerül a rekordba és a Google-hoz (`consent.adUserData = GRANTED`).
  Hozzájárulás nélkül a rekord megvan (statisztika), a feltöltés `kihagyva: nincs hirdetesi hozzajarulas`.
- **Napló / riport:** nyers kattintásazonosító sehol; helyette `h:` + SHA-256 első 8 hex. A Google válaszából is kitakarva.
  A titkok (token, refresh token, webhook-cím) nem kerülnek naplóba.
- Megőrzés: a kattintásazonosító 90 nap után törlődik, a rekord és a napló 120 nap után.
- Salonic felé a lánc **semmilyen kérést nem küld**.

## 3. Google-szállító (titkok – Cloudflare → Pages → `medicalpiercing` → Settings → Variables and Secrets, Secret típus)

Kettő közül az első, amelyiknek a titkai megvannak:

1. **Közvetlen Google Ads API** (`uploadClickConversions`, alapból `validateOnly: true`, `partialFailure: true`).
   Hívásonként friss access tokent kér a refresh tokennel, így a Mosaicnál leírt „1 óra után lejár” gond nem áll fenn.
   - `GOOGLE_ADS_DEVELOPER_TOKEN` – a Google Ads API fejlesztői token (MCC → API Center; legalább „Basic access”)
   - `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` – OAuth-kliens (Google Cloud, „Desktop/Web app”)
   - `GOOGLE_ADS_REFRESH_TOKEN` – a 2626380837 fiókhoz hozzáférő felhasználó refresh tokenje (`adwords` scope)
   - `GOOGLE_ADS_LOGIN_CUSTOMER_ID` – csak ha a hozzáférés MCC-n keresztül van (az MCC azonosítója)
   - opcionális: `MP_GADS_API_VERZIO` (alap: `v23`)
2. **Zapier-webhook** (a Mosaic #89-es mintája): `MP_GOOGLE_ARNYEK_WEBHOOK_URL`. Ehhez **külön MP-s Zap** kell
   (a Mosaic Zapje csak a Mosaic 10 ÁRNYÉK akcióját fogadja). Mezők: `customer_id`, `conversion_action_id`,
   `gclid|gbraid|wbraid`, `conversion_date_time`, `order_id`, `ad_user_data`, `value`, `currency`, próbaüzemben `dryrun: true`.

Titok nélkül a rekord elkészül, a feltöltés `nincs_hitelesites` (kimenő hívás nincs), és később újrapróbálható.

## 4. Kapcsolók és admin

| változó | hatás |
| --- | --- |
| `MP_GADS_MOD="eles"` | **éles feltöltés** (`validateOnly: false` / nincs `dryrun`) – csak a `www.medicalpiercing.hu` hoston, előnézeten soha |
| `MP_MERES_KI="1"` | vészkapcsoló: a végpont 503, semmit nem ír |
| `MP_MERES_ADMIN_KULCS` | (Secret) az admin végpont kulcsa (`x-mp-kulcs` fejléc); nélküle az admin 404 |

- `GET /api/mp-foglalas?riport=1&nap=7[&kornyezet=elonezet]` – napi összesítés (foglalás, új / visszatérő, értékkel,
  hirdetési hozzájárulás, Google-kattintással, motorból) és feltöltések akciónként / állapotonként.
- `GET /api/mp-foglalas?kulcs=<kulcs>` – egy foglalás rekordja és feltöltései (maszkolt kattintásazonosítóval).
- `POST /api/mp-foglalas {"muvelet":"ujra"}` – a `hiba` / `nincs_hitelesites` feltöltések újrapróbálása (max 50, 90 napon belül).
  Éles módban a már `elkuldve` akció nem megy újra.

Feltöltési állapotok (`mp_feltoltes.allapot`): `elfogadva` (validate / dryrun rendben), `elkuldve` (élesben feltöltve),
`hiba`, `nincs_hitelesites`, `kihagyva` (nincs hozzájárulás / kattintásazonosító), `tiltva` (védőháló).

## 5. Adatbázis

D1 `mp-meres` (`68a1b80e-ab8e-48ac-9ef7-5fc02c07326e`, kötés: `MP_MERES_DB`, `wrangler.toml`). A fiók D1-kerete (10)
betelt, ezért az előnézet is ezt használja; a sorok `kornyezet` oszlopa (`eles` / `elonezet`) választja szét, a riport
alapból csak az éleset mutatja. Séma: `lib/meres/lanc.js` `SEMA` (a függvény első híváskor létrehozza, már létre is van hozva).

## 6. Élesítés (Feri jóváhagyása után)

1. PR merge → a köszönőoldalak írni kezdenek; titok nélkül még semmi nem megy ki Google-ba.
2. Titkok a Production környezetbe (3. pont, 1. vagy 2. szállító) + `MP_MERES_ADMIN_KULCS`.
3. Pár valódi foglalás után: `?riport=1` – `elfogadva` sorok (validate_only, a Google szintaktikailag elfogadta).
4. `MP_GADS_MOD = eles` (Production, sima változó) → valódi feltöltés a három másodlagos ÁRNYÉK akcióba.
5. Ellenőrzés a Google Ads-ben (Konverziók → diagnosztika) 24–48 óra múlva.

## 7. Tesztek

- `node --test tools/test-mp-meres.mjs tools/test-mp-feltoltes.mjs` – egységtesztek (D1: `node:sqlite`, Google: mock fetch).
- `node tools/mp-meres-pw.mjs` – Playwright, helyben (mockolt végpont), vagy `BASE=https://<ág>.medicalpiercing.pages.dev`
  a PR-előnézeten (valódi függvény + D1, Google-hívás nélkül).
