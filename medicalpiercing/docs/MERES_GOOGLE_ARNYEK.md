# Medical Piercing – szerveres Google Ads foglalásfeltöltés (ÁRNYÉK)

Állapot (2026-10-11): **élesítés folyamatban, `MP_GADS_MOD=dryrun`** – Feri jóváhagyta („mehet a Google-feltöltés élesítése”, 10:11),
a ChatGPT 10:10-es felülvizsgálata feltétellel engedte (lásd 6. pont). Szállító: Zapier-webhook (külön MP-s Zap).
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
2. **Zapier-webhook** (a Mosaic #89-es mintája) – **ez fut**: `MP_GOOGLE_ARNYEK_WEBHOOK_URL` (Secret, Production + Preview).
   Külön MP-s Zap: **„MP ARNYEK - szerver → Google Ads árnyékkonverzió (2626380837)”**, ID `01a12a08-5df1-7363-bc01-de984b594c09`
   (Zapier durable workflow, webhook-trigger, Google Ads kapcsolat: `google_ads_mp`, akció: `send_offline_conversion_v2`).
   A Mosaic Zapje (`01a1122c-…`, csak a Mosaic 10 ÁRNYÉK akciója) érintetlen. A Zap saját védőhálója: csak `customer_id=2626380837`
   és csak a 3 ÁRNYÉK akció; `ad_user_data` ≠ `GRANTED` → kihagyva; rossz formátumú kattintásazonosító → kihagyva;
   érték opcionális (ha van, HUF); `dryrun: true` → semmit nem küld, a kész kérést adja vissza kitakart kattintásazonosítóval.
   Mezők: `customer_id`, `conversion_action_id`, `gclid|gbraid|wbraid`, `conversion_date_time`, `order_id`, `ad_user_data`, `value`, `currency`, `dryrun`.

Titok nélkül a rekord elkészül, a feltöltés `nincs_hitelesites` (kimenő hívás nincs), és később újrapróbálható.

## 4. Kapcsolók és admin

| változó | hatás |
| --- | --- |
| `MP_GADS_MOD="dryrun"` (vagy üres / bármi más) | próbaüzem: API → `validateOnly`, Zapier → `dryrun: true` (a Zap nem tölt fel) |
| `MP_GADS_MOD="eles"` | **éles feltöltés** (`validateOnly: false` / nincs `dryrun`) – csak a `www.medicalpiercing.hu` hoston, előnézeten soha |
| `MP_GADS_MOD="off"` | vészkapcsoló a feltöltésre: **semmilyen** kimenő hívás (Google / Zapier); a D1-rekord megmarad, a feltöltés `kikapcsolva`, később újrapróbálható |
| `MP_MERES_KI="1"` | vészkapcsoló: a végpont 503, semmit nem ír |
| `MP_MERES_ADMIN_KULCS` | (Secret) az admin végpont kulcsa (`x-mp-kulcs` fejléc); nélküle az admin 404 |

- `GET /api/mp-foglalas?riport=1&nap=7[&kornyezet=elonezet]` – napi összesítés (foglalás, új / visszatérő, értékkel,
  hirdetési hozzájárulás, Google-kattintással, motorból) és feltöltések akciónként / állapotonként.
- `GET /api/mp-foglalas?kulcs=<kulcs>` – egy foglalás rekordja és feltöltései (maszkolt kattintásazonosítóval).
- `POST /api/mp-foglalas {"muvelet":"ujra"}` – a `hiba` / `nincs_hitelesites` / `kikapcsolva` feltöltések újrapróbálása (max 50, 90 napon belül).
  Éles módban a már `elkuldve` akció nem megy újra.

Feltöltési állapotok (`mp_feltoltes.allapot`): `kikapcsolva` (`MP_GADS_MOD=off`), `elfogadva` (validate / dryrun rendben), `elkuldve` (élesben feltöltve),
`hiba`, `nincs_hitelesites`, `kihagyva` (nincs hozzájárulás / kattintásazonosító), `tiltva` (védőháló).

## 5. Adatbázis

D1 `mp-meres` (`68a1b80e-ab8e-48ac-9ef7-5fc02c07326e`, kötés: `MP_MERES_DB`, `wrangler.toml`). A fiók D1-kerete (10)
betelt, ezért az előnézet is ezt használja; a sorok `kornyezet` oszlopa (`eles` / `elonezet`) választja szét, a riport
alapból csak az éleset mutatja. Séma: `lib/meres/lanc.js` `SEMA` (a függvény első híváskor létrehozza, már létre is van hozva).

## 6. Élesítés (jóváhagyva 2026-10-11) – feltételek, napló, vészvisszaállítás

**Jóváhagyás:** Feri 10:11: „mehet a Google-feltöltés élesítése”. ChatGPT 10:10: engedélyezve, feltételekkel:
(1) gclid hozzájárulás szerint, dokumentáltan; (2) ütközésvizsgálat a motor-fejlesztővel; (3) `dryrun`, amíg legalább 3 valódi
sor helyes nem lesz; (4) minden lépés dokumentálva; (5) vészvisszaállítás (`MP_GADS_MOD=dryrun` vagy `off`).

### 6.1 Hozzájárulás-kezelés (gclid / gbraid / wbraid)

1. Böngésző (`assets/js/mp-meres.js`): az URL-ből érkező kattintásazonosítót **csak** CookieYes hirdetési hozzájárulás
   (`advertisement:yes`) után teszi a `localStorage`-ba (`mp_gk`, 90 nap); döntés nélkül max. 4 mp-et vár, utána semmit nem tárol.
2. Szerver (`lib/meres/google-ads.js` `hozzajarulas()`): a hozzájárulást **maga olvassa** a `cookieyes-consent` sütiből
   (a böngésző állítását nem fogadja el). Hozzájárulás nélkül a kattintásazonosító **nem kerül** a D1-rekordba, és
   nincs Google / Zapier hívás (`kihagyva: nincs hirdetesi hozzajarulas`).
3. Hozzájárulással: a Google felé `consent.adUserData = GRANTED` (Zapier: `ad_user_data: "GRANTED"`); a Zap minden mást elutasít.
4. Napló / riport / Zap-dryrun-válasz: nyers azonosító sehol, csak `h:` + SHA-256 első 8 hex, illetve `[kattintas-id]`.
5. Megőrzés: kattintásazonosító 90 nap, rekord és napló 120 nap.

### 6.2 Napló (Europe/Budapest)

| idő | lépés |
| --- | --- |
| 10-11 10:12 | Ütközésvizsgálat: a motor-fejlesztő ágai (`claude/medicalpiercing-cloudflare-pages-005tr7` – #243 már a main-en; `claude/mp-motor-qa` – csak `medicalpiercing/qa/`, nyitott PR nélkül) nem írják a mérés fájljait (`lib/meres/`, `functions/api/mp-foglalas.js`, `assets/js/mp-meres.js`). A QA-5 kifejezetten várja a #242-t a main-en. A `tools/build.mjs` automatikusan, ütközés nélkül egyesült (az ő változata maradt, a mérés-beszúrás hozzáillesztve). |
| 10-11 10:13 | GAQL (2626380837): a 3 akció `ENABLED`, `UPLOAD_CLICKS`, `primary_for_goal = false` – nem módosítva. |
| 10-11 10:15–10:17 | Zap létrehozva, 2 draft-próba valódi konverzió nélkül: MP-akció `dryrun` → kész kérés (kitakart gclid); Mosaic fiók / akció → `skipped: nem-mp-fiok`. Publikálva, bekapcsolva. |
| 10-11 10:16 | Kód: `MP_GADS_MOD=off` vészkapcsoló, `kikapcsolva` állapot újrapróbálható; Zapier-úti egységtesztek (27/27 zöld), dist build rendben. |
| 10-11 10:18 | Cloudflare `medicalpiercing` Pages, Production + Preview, Secret: `MP_GOOGLE_ARNYEK_WEBHOOK_URL`, `MP_MERES_ADMIN_KULCS`, `MP_GADS_MOD=dryrun`. |

(A további lépések – előnézeti teszt, merge, éles dryrun-ellenőrzés, átkapcsolás – a PR #242 leírásában / ebben a táblázatban folytatódnak.)

### 6.3 Átkapcsolás élesre (csak ≥ 3 helyes valódi éles sor után)

Ellenőrzés (`GET /api/mp-foglalas?riport=1` és D1 `mp-meres`): a sorok `kornyezet = eles`, a kulcs `placeId|employeeId|startUnix`
formájú és egyezik a Salonic-foglalással, nincs duplikáció (kulcsonként 1 sor), a rekordban nincs név / e-mail / telefon /
szolgáltatásnév, hozzájárulás nélkül nincs kattintásazonosító, a hozzájárulásos sorok feltöltése `elfogadva` / `dryrun`.

1. Cloudflare API (`cloudflare_mcp`, fiók `560b06e0a3fe45c72f7e9c4421841659`): `PATCH /accounts/{fiók}/pages/projects/medicalpiercing`
   `{"deployment_configs":{"production":{"env_vars":{"MP_GADS_MOD":{"type":"secret_text","value":"eles"}}}}}`
   (csak Production; a Preview marad `dryrun`).
2. A változó csak új telepítéssel él: a legutóbbi éles telepítés újrafuttatása
   (`POST …/pages/projects/medicalpiercing/deployments/{id}/retry`) – nem fogyaszt plusz merge-et.
3. Ellenőrzés: a következő hozzájárulásos foglalásnál `mp_feltoltes.mod = eles`, `allapot = elkuldve`; a Zap futása `sent: true`;
   GAQL a 3 akcióra (`metrics.all_conversions`, `segments.conversion_action`) 24–48 órán belül.

### 6.4 Vészvisszaállítás

- **Feltöltés azonnali leállítása:** `MP_GADS_MOD` → `off` (semmi nem megy ki) vagy `dryrun` (a Zap nem tölt fel), a fenti PATCH + retry.
- **Gyorsabb, telepítés nélkül:** a Zap kikapcsolása (Zapier, `01a12a08-5df1-7363-bc01-de984b594c09` → disable): a webhook-hívás
  ekkor hibát kap, a sorok `hiba` állapotban maradnak és később újrapróbálhatók.
- **Teljes lánc:** `MP_MERES_KI=1` (a végpont 503, semmit nem ír).
- A már feltöltött konverziók a 3 **másodlagos** ÁRNYÉK akcióban vannak, licitet nem vezetnek; szükség esetén GAQL-lel azonosíthatók (`order_id`).

## 7. Tesztek

- `node --test tools/test-mp-meres.mjs tools/test-mp-feltoltes.mjs` – egységtesztek (D1: `node:sqlite`, Google: mock fetch).
- `node tools/mp-meres-pw.mjs` – Playwright, helyben (mockolt végpont), vagy `BASE=https://<ág>.medicalpiercing.pages.dev`
  a PR-előnézeten (valódi függvény + D1, Google-hívás nélkül).
