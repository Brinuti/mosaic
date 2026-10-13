# Medical Piercing – szerveres Google Ads foglalásfeltöltés (ÁRNYÉK)

Állapot (2026-10-11): **élesítés folyamatban, `MP_GADS_MOD=dryrun`** – Feri jóváhagyta („mehet a Google-feltöltés élesítése”, 10:11),
a ChatGPT 10:10-es felülvizsgálata feltétellel engedte (lásd 6. pont). Szállító: Zapier-webhook (külön MP-s Zap).
A Mosaic azonos láncának (docs/booking-engine/QA2_ARNYEK.md, QA4_ELESITES.md, BOOKING_ID.md) MP-s megfelelője, de **külön kód,
külön adatbázis, külön titkok**: a Mosaic kódjából semmit nem importál (teszt is ellenőrzi).

## 1. A lánc

```
vendég hirdetésből érkezik (?gclid / gbraid / wbraid)
  └─ assets/js/mp-meres.js: marketing-hozzájárulással (saját süti-sáv, "mp_suti") localStorage "mp_gk" (90 nap); nélküle semmi
Salonic (medicalpiercing.salonic.hu)  vagy  később a beágyazott motor
  └─ átirányítás: /foglalas-ok[-tipus] (gyógypiercing) vagy /fulbevalo-ok[2|3] (divat fülpiercing)
       ?bookingUrl=…&price=…&first_booking=…[&booking_id=…]
       └─ mp-meres.js: POST /api/mp-foglalas  { ut, p: {bookingUrl, price, first_booking, booking_id, placeId, employeeId, startDate, serviceId}, kattintas }
            └─ functions/api/mp-foglalas.js → lib/meres/lanc.js
                 ├─ koszonoOldal() (lib/meres/meres.js) → kulcs = placeId|employeeId|startUnix
                 ├─ hozzájárulás az "mp_suti" sütiből (saját süti-sáv) (a szerver maga olvassa, nem a böngésző állítása)
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
- A rekordban nincs egészségügyi piercing-típus, szolgáltatásszöveg, személyes adat; a helyszín semleges városkód.
  Egyetlen kivétel a `tipus = 'ful'` (divat fülpiercing, nem egészségügyi adat; lásd lent); kifelé ez sem megy.
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
  hirdetési hozzájárulás, Google-kattintással, motorból, `fulbevalo` = divat fülpiercing) és feltöltések akciónként / állapotonként.
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

1. Böngésző (`assets/js/mp-meres.js`): az URL-ből érkező kattintásazonosítót **csak** marketing-hozzájárulás
   (saját süti-sáv, `mp_suti=v1-s?-m1-t…`, lásd `docs/SUTISAV.md`) után teszi a `localStorage`-ba (`mp_gk`, 90 nap); döntés nélkül max. 4 mp-et vár, utána semmit nem tárol.
2. Szerver (`lib/meres/google-ads.js` `hozzajarulas()`): a hozzájárulást **maga olvassa** az `mp_suti` sütiből
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

## Divat fülpiercing (`/fulbevalo-ok*`, 2026-10-13)

A divat fülpiercing (fülbevaló) foglalásai a `/fulbevalo-ok`, `-ok2`, `-ok3` köszönőoldalra érkeznek (1 / 2 / 3 db; a motor
is így nyitja a fő ablakban, PR #247). A #242 óta az `mp-meres.js` csak a `/foglalas-ok*`-ról küldött, így ezek a foglalások
kimaradtak a D1-ből, a forrás-lefedettségből, a Salonic-párosításból és a szerveres Google-feltöltésből (a „06 - Általános
fülpiercing” kampány foglalásai). Javítva (PR `claude/mp-fulbevalo-meres`): **a lánc mindkét köszönőoldalon azonos.**

- **Böngésző** (`assets/js/mp-meres.js`, `KOSZONO_UT`): a `/fulbevalo-ok*` ugyanúgy küld (egyszer, a keretben nem, ha a motor
  átvette; a `suti.js` tisztítása után). Az `ut` a semleges `/fulbevalo-ok` (a `-ok2/-ok3` darabszám sem megy).
- **Szerver** (`lib/meres/lanc.js` `bemenet`): a `/fulbevalo-ok*` → `/fulbevalo-ok`; `koszonoOldal` → `tipus = 'ful'`
  (az útvonalból, vagy a fülbevaló Salonic-szolgáltatás-azonosítójából: 395895 / 402057 / 402059, `meres.js FUL_SZOLGALTATASOK`).
- **D1:** új oszlop `mp_foglalas.tipus` (`BOVITES`): `'ful'` vagy NULL. Csak a `'ful'` tárolható (`meres.js tarolhatoTipus`);
  egészségügyi típus soha. Kifelé (Google, TikTok, GA4, Meta) nem megy: a feltöltés / TikTok-törzs nem olvassa, a semleges
  URL marad `https://www.medicalpiercing.hu/foglalas-ok`.
- **Helyszín / munkatárs:** a leképezés (`tools/mp-salonic-lekepezes.json`, 2026-10-11) szerint a fülbevaló mind a 15
  helyszínen ugyanabban a Salonic-fiókban van, és minden munkatársa (13509, 17769, 19566, 25773, 27569, 27571, 27572, 27575,
  30145, 32224, 20562) szerepel az `igazolas.js MUNKATARSAK`-ban → a `HELYSZINEK` szűrőn átmegy, és a Salonic-levél párosítható
  (igazolt → ÁRNYÉK-feltöltés, TikTok-napló, ugyanazokkal a feltételekkel). Új helyszín / munkatárs nem kellett.
- **Riport:** `?riport=1` → `fulbevalo`; a napi riport (`riport.js`) → `d1_ful`, `d1_ful_igazolt`, `ful_cimke_<címke>` (a fő
  számokban is benne van, ez csak bontás).
- **Tesztek:** `test-mp-meres` (típus, kifelé semleges), `test-mp-feltoltes` (teljes lánc: D1, igazolás, Google, TikTok, riport),
  `test-mp-forras-v2` (riport-bontás), `koszono-tisztitas-pw` / `forras-pw` (10.) / `mp-meres-pw` (1 POST, D1-sor címkével,
  F5 nem küld újra, semleges cím).
- Nem változott: a GTM-es Ads-konverziók triggere („Page Path tartalmazza /foglalas-ok”) a `/fulbevalo-ok`-ra nem fut, és a
  Meta-pixel PageView a `/fulbevalo-ok`-on fut (a `suti.js` `KOSZONO` csak a `/foglalas-ok*`). Ezek külső fiók / tulajdonosi döntés.

## Salonic-igazolás (2026-10-12, átmeneti megoldás a Salonic API-ig)

Feri döntése: a Google Ads felé **csak a Salonic által igazolt foglalás** mehet, nem pusztán a köszönőoldal megnyitása.
Hivatalos Salonic API / webhook még nincs, ezért a forrás a Salonic automatikus „Új online foglalás érkezett” levele
(feladó: `app@salonic.hu`, fiók: „Medical Piercing”, címzett: salonicfoglalas@gmail.com).

- **Lánc:** Zapier Gmail-trigger (szűrt keresés) → `POST /api/mp-salonic-igazolas` (fejléc: `x-mp-igazolas` = `MP_IGAZOLAS_TITOK`,
  törzs: `{ from, subject, body, date }`) → `lib/meres/igazolas.js` értelmezi → D1 `mp_salonic_igazolas`.
- **Tárolt adat:** Salonic foglalási azonosító, munkatárs-azonosító(k), kezdés, „Új páciens” jelzés, a levél ideje. Vendégnév,
  telefon, e-mail, szolgáltatás **nem**.
- **Párosítás:** a D1-sor kulcsa (`placeId|employeeId|startUnix`) ↔ a levél munkatársa (név → azonosító, `MUNKATARSAK`) és a
  percre pontos kezdés. Ismeretlen munkatársnévnél csak egyértelmű egyezés párosítható.
- **Állapotok (`mp_foglalas.igazolas`):** `NULL` = rögzített, még nem igazolt · `igazolt` · `nem_igazolt` (48 órán belül nem jött levél).
- **Feltöltés:** csak `igazolt` sorból; konverziós idő = a Salonic-levél ideje (a foglalás ideje), nem a köszönőoldal megnyitása.
- **Új vendég:** csak ha a levél „Új páciens - Még nem volt foglalása” (aki még sosem foglalt, nem járt teljesült kezelésen);
  minden más **ismeretlen** → csak az általános „Foglalás” akció. A „visszatérő” akció így nem kap adatot, a `first_booking`
  paramétert nem tekintjük bizonyítottnak (Feri, 2026-10-11).
- **Fail-closed:** formátumváltás, késés vagy hiányzó levél esetén kevesebb konverzió megy, hamis nem.
- **Élesítéshez kell (Feri „mehet”-je):** a PR mergelése, a titok beállítása, és a Zapier-Zap létrehozása.
- **A titok helye:** vagy a Cloudflare `MP_IGAZOLAS_TITOK` titka (Production), vagy – ha az nincs – a D1 `mp_beallitas`
  táblájában az `igazolas_titok_sha256` sor (a titok SHA-256 lenyomata, maga a titok nincs tárolva). A D1-lenyomat
  csak az éles hoszton (`www.medicalpiercing.hu`) érvényes, előnézeten nem. Titok nélkül a végpont 404.
  A titok nélkül a végpont 404-et ad, a feltöltés pedig — igazolás híján — nem indul.
- **Tesztek:** `node --test tools/test-mp-igazolas.mjs` (a 2026-10-11-i 27 valódi foglalás anonim adataival, fantom / késői
  újranyitás, késő és duplikált igazolás, 4 vitatott új/visszatérő eset, gclid/hozzájárulás/idő megőrzése) és
  `node --test tools/test-mp-feltoltes.mjs`.
- **Ismert korlátok (ChatGPT-review, 2026-10-12):** (1) időpont-módosítás („Foglalás módosítva” levél) és lemondás nem
  vonja vissza a már igazolt/feltöltött konverziót — ugyanúgy, mint a mai böngészős címkék; (2) ismeretlen munkatársnév esetén
  csak egyértelmű egyezés párosul, a válasz `ismeretlen_munkatars: true`, és a naplóban figyelmeztetés jelzi, hogy a
  `MUNKATARSAK` térkép frissítendő; (3) a feladó-ellenőrzés a Gmail-fiókba érkezett levélre épül (a Zapier csak a
  salonicfoglalas@gmail.com postafiókot olvassa), és párosítani csak létező, azonos munkatársú és percű D1-sorral lehet,
  ami egy hamisított levél hatását erősen korlátozza; (4) idempotencia: `mp_feltoltes` elsődleges kulcs (kulcs, akció, mód) +
  éles módban a már elküldött akció ellenőrzése.

## Platform szerinti forrás és „Honnan hallottál rólunk?” (2026-10-13)

Cél: a **Salonic által igazolt** foglalások megszámlálása hirdetési platformonként (google / meta / tiktok / egyeb) a
foglalások szinte teljes körére. **Ebben a lépésben semmi új nem megy egyetlen hirdetési platformnak sem.**

1. **Forrás-címke, hozzájárulástól függetlenül** – Feri kifejezett kérése (2026-10-13 07:36): „Kifejezetten azt kérem,
   hogy hozzájárulás nélkül is menjen el.” A jogi kockázatot a tulajdonos vállalja. Az `assets/js/mp-meres.js` az érkező
   cím alapján **csak egy durva csatornanevet** tesz a `sessionStorage`-ba (`mp_forras` = `{p, t}`: csatorna + első észlelés
   ideje), azonosító nélkül: `gclid`/`gbraid`/`wbraid` → `google`; `fbclid` vagy `utm_source` = facebook / fb / instagram /
   ig / meta → `meta`; `ttclid` vagy `utm_source` = tiktok → `tiktok`; más `utm_source` → `egyeb`; semmi → nincs címke
   (D1: `NULL` = közvetlen / ismeretlen). ~~Első érintés a munkamenetben, felülírás nincs~~ – **a „Forrás v2” szakasz
   (utolsó fizetett kattintás) váltotta.** A köszönőoldali
   jelzés `forras_platform` mezőben küldi; a szerver (`lib/meres/forras.js`) fehér listával ellenőrzi → `mp_foglalas.forras_platform`.
   A motor a köszönőoldalt ugyanabban a lapban, a fő ablakban nyitja (`location.assign`), a régi beágyazott naptárak
   keretben (azonos eredet) – mindkettő ugyanazt a munkamenet-tárolót látja (`tools/forras-pw.mjs` 1., 5. eset).
   Korlát: ha a vendég a Salonic-oldalt **új lapon** nyitja és ott foglal, a köszönőoldal új munkamenetben nyílik → `NULL`.
2. **Meta / TikTok kattintásazonosító csak hozzájárulással** (ugyanaz a szabály, mint a Google-é): `fbclid`, `ttclid` az
   `mp_gk`-ba (90 nap), a szerver ezekből és a saját tartomány `_fbc` / `_fbp` / `_ttp` sütijéből tölti a `meta_fbc`,
   `meta_fbp`, `meta_kattintas_ido`, `tiktok_ttclid`, `tiktok_ttp`, `tiktok_kattintas_ido` oszlopot (formátum-ellenőrzéssel;
   az `fbc` a frissebb a `_fbc` süti és az `fb.1.<ms>.<fbclid>` közül). Hozzájárulás nélkül `NULL`. **Sehova nem küldjük**;
   az admin-válaszban maszkolva (`h:…`), 90 nap után törlődnek. A késői hozzájárulás pótlása (`potlas`) ezeket is kitölti,
   ugyanazokkal a feltételekkel (2 órán belül, azonos `booking_id` és környezet, csak ha még üresek).
3. **Séma:** `sema(db)` a `PRAGMA table_info(mp_foglalas)` alapján csak a hiányzó oszlopot adja hozzá (`BOVITES`); a
   meglévő sorok változatlanok.
4. **„Honnan hallottál rólunk?”** – 2026-10-13-án Feri döntésére KIKERÜLT (várható kitöltés max. ~20%, nem ér semmit). A végpont
   törölve; az `onbevallas` oszlop és a riportmezők üresen maradnak.
5. **Riport** (`lib/meres/riport.js`, napi sorok, a régi mezők változatlanok): `forras_<google|meta|tiktok|egyeb|ismeretlen>`
   és ebből Salonic-igazolt (`igazolas = 'igazolt'`): `forras_<…>_igazolt`; `onbevallas_<tiktok|meta|google|ismeros|egyeb|nincs>`.

Tesztek: `node --test tools/test-mp-forras.mjs`, `node tools/forras-pw.mjs` (valódi szerverkód + `node:sqlite` D1).

## Forrás v2 – utolsó fizetett kattintás, bizonyíték, végső címke (2026-10-13)

Közös szabály (mind a 4 projekt): **FORRASMERES-KOZOS-SZABALY-4-PROJEKT-2026-10-13.md** (Drive; Feri döntése 2026-10-13,
ChatGPT-vel átnézve): havonta platformonként a valós (Salonic-igazolt) foglalások száma; platformok közötti **LAST PAID
CLICK**, 1 foglalás = 1 címke; a forrást a foglaláshoz ugyanabban a látogatásban **hozzájárulás nélkül is** hozzá kell kötni
(Feri kifejezett kérése, **a jogi kockázatot vállalja**; platformkockázat nincs, mert semmi nem megy hirdetési platformnak);
extra űrlapmező nincs. Cél: az ÚJ vendégek foglalásainak ≥ 90%-a pontosan egy címkét kapjon, tárolt bizonyítékkal, a
lefedettség hozzájárulással / nélküle bontva. Ez az előző szakasz 1. pontját (első érintés, csak csatornanév) váltja.

1. **Böngésző (`assets/js/mp-meres.js`, `sessionStorage.mp_forras`, a lap bezárásáig):**
   - *fizetett érkezés*: `gclid`/`gbraid`/`wbraid`/`fbclid`/`ttclid` VAGY `utm_medium` ∈ cpc / ppc / paid / paid_social /
     paidsocial / paid_search / cpm → **mindig felülírja** a tárolt érintést (ugyanannak az érintésnek az újratöltése az időt nem írja át);
   - *nem fizetett érkezés* fizetettet **soha** nem ír felül; nem fizetettet csak akkor, ha van jele (utm vagy kereső /
     social / egyéb hivatkozó) – a direkt (jel nélküli) érkezés nem ír felül (last non-direct);
   - *belső hivatkozó* (saját tartomány, `*.salonic.hu`) nem változtat (a `klon.js` a paramétereket a belső linkeken
     továbbviszi); ha még nincs tárolt érintés, csak jellel tárol;
   - tárolt mezők: `v:'mp_v2'`, `p` (google/meta/tiktok/egyeb/null – a régi `forras_platform`), `t`, `us/um/uc/ut/uco`
     (utm_*, trim, ≤ 100 karakter, `[A-Za-z0-9._~:+-]`, különben eldobva), `kp` (a kattintási paraméter **típusa** – az
     **értéke soha**), `rk` (`search`/`social`/`egyeb`/`nincs` a `document.referrer` **tartományából**; URL nem kerül tárolásra).
   - A köszönőoldali jelzés ezt `forras` objektumként küldi (+ `forras_v`, keretből `keret: true`), mellette a régi
     `forras_platform`-ot is. A régi (v1) `{p,t}` alakot a szkript továbbra is olvassa.
2. **Szerver (`lib/meres/cimke.js`, `lanc.js`):** újratisztítja a bizonyítékot és új oszlopokba írja (`BOVITES`, idempotens):
   `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `kattintas_param`, `referrer_kat`, `forras_ido`,
   `forras_verzio` (= `mp_v2`), `forras_keret`, `bizonyitek_forras` (`munkamenet` / `latogatas` / `suti`), és a **szerveren számolt**
   `forras_cimke`, `ismeretlen_ok`, `cimke_megjegyzes`. A `forras_platform` továbbra is kitöltődik (google/meta/tiktok/egyeb).
   Kattintásazonosító-**érték** továbbra is csak hirdetési hozzájárulással (`mp_gk`, `kattintas_ertek`, `meta_*`, `tiktok_*`).
3. **Címke – `cimkez(sor, markasLista)`** (tiszta, determinisztikus függvény; a beszúrás ÉS a riport is ezt használja, így a
   márkás lista változásakor a címke utólag újraszámolható):
   - `meta` / `tiktok` / `google_markas` / `google_nem_markas` (fizetett érintés; előbb a kattintási paraméter, utána az `utm_source`);
     Google márkás = az `utm_campaign` (kampány-ID) szerepel a D1 `mp_beallitas.google_markas_kampanyok` vesszős listájában;
     lista nélkül `google_nem_markas` + `cimke_megjegyzes = markas_lista_hianyzik`; kampány-ID nélkül `nincs_kampany_id`;
     `fbclid` fizetett `utm_medium` nélkül: `meta` + `fbclid_utm_nelkul` (a Facebook az organikus linkekre is teszi);
   - `organikus_direkt` + `cimke_megjegyzes`: `organikus_kereso` / `organikus_social` / `hivatkozo` / `organikus_utm` / `direkt`;
   - `ismeretlen` + `ismeretlen_ok`: `nincs_jel` (a munkamenetben nincs érintés), `iframe_munkamenet` (keretből jött jelzés
     érintés nélkül), `hianyos_utm` (fizetett medium ismeretlen forrással, vagy platformnév medium nélkül), `regi_kliens`.
   - Márkás lista beállítása (Google Ads kampány-ID-k): `INSERT OR REPLACE INTO mp_beallitas (kulcs, ertek) VALUES ('google_markas_kampanyok', '123,456')`.
4. **30 napos süti CSAK hirdetési hozzájárulással** (`mp_lpt`): a böngésző fizetett érkezéskor (és a hozzájárulás megadása
   után, ha a munkamenetben fizetett érintés van) `POST /api/mp-forras`-t hív (`functions/api/mp-forras.js`); a szerver a
   süti alapján újra ellenőrzi a hozzájárulást, és csak fizetett érintésre ír `Set-Cookie: mp_lpt=<base64url JSON>; Max-Age=2592000;
   Path=/; HttpOnly; Secure; SameSite=Lax` sütit (ugyanazok a tisztított mezők, kattintásazonosító-érték nélkül).
   Hozzájárulás nélkül süti nincs; visszavonáskor a végpont törli. A köszönőoldali jelzéskor a szerver – csak hozzájárulással
   – akkor használja, ha a munkamenetben **nincs fizetett** érintés (last paid click a munkamenetek között is):
   `bizonyitek_forras = 'suti'`.
5. **Riport** (`riport.js`, napi sorok; a régi mezők változatlanok; csak `kornyezet = 'eles'`): `cimke_<c>`,
   `cimke_<c>_igazolt`, új vendégre `uj_cimke_<c>`, `uj_cimke_<c>_igazolt` (új vendég = `uj_vendeg_igazolt = 1` VAGY
   `uj_vendeg = 1`), `lefedettseg_osszes`, `lefedettseg_uj`, `lefedettseg_[uj_]hozzajarulassal`,
   `lefedettseg_[uj_]hozzajarulas_nelkul` (%, címkézett = nem `ismeretlen`), `ismeretlen_okok`, `google_markas_lista`
   (a lista hossza, `null` = nincs beállítva). A címke az **aktuális** márkás listával újraszámolva.
6. **Havi pillanatkép:** `GET /api/mp-kiigazitas?riport=havi&ho=YYYY-MM` (fejléc: `x-mp-kiigazitas`) → személyes adat nélküli
   CSV: `ho, forras_cimke, foglalas, igazolt, uj_vendeg, uj_vendeg_igazolt (új ÉS Salonic-igazolt), hozzajarulassal, verzio,
   pillanatkep`; hónaphatár Europe/Budapest szerint, csak éles sorok. Az ütemezett Drive-mentés külön készül.
7. **Korlátok:** új lapon nyitott Salonic-foglalás → új munkamenet → hozzájárulás nélkül `nincs_jel` (2026-10-13 óta 2 órán
   belül a látogatás-tároló pótolja, lásd lent); az `fbclid` organikus
   Facebook-megosztásból is jöhet (jelölve); a UTM-ek a hirdetésekbe később kerülnek – addig a Google-kampány-ID hiányzik
   (`nincs_kampany_id`), a Meta / TikTok a kattintási paraméterből címkézhető.

Tesztek: `node --test tools/test-mp-forras-v2.mjs` (böngésző-logika `vm`-ben, tisztítás, hivatkozó-kategóriák, címke, süti,
riport, havi CSV), `node tools/forras-pw.mjs` (3., 5–9. eset: fizetett → organikus nem ír felül, meta → tiktok felülír,
hozzájárulás nélkül nincs süti, hozzájárulással HttpOnly süti és új munkamenetben tartalék, keretes foglalás címkéje).

### Forrás v2 – látogatás-tároló és `nincs_jel`-diagnosztika (2026-10-13)

Háttér: a forrás v2 élesítése (09:15) után 9 motoros foglalásból 4 `ismeretlen` / `nincs_jel` lett (a munkamenetben semmilyen
érintés), Google 0 – miközben a Google napi ~370 kattintást hoz. A `gclid`/`fbclid` érkezés helyesen tárol, és a motor a
köszönőoldalt ugyanabban a lapban nyitja (`location.assign`). Valószínű ok: a munkamenet első oldala belső hivatkozós, jel
nélküli (új lap `noopener`-rel → a `sessionStorage` nem másolódik; iOS-lapeldobás / újratöltés; az érkezés másik lapon volt),
és a v2 szabálya („belső hivatkozó + üres tároló → nincs tárolás”) ilyenkor semmit nem tárol.

**Tulajdonosi döntés (Feri, 2026-10-13, kifejezett; a jogi kockázatot vállalja; ChatGPT jóváhagyta):** a forrást a foglaláshoz
ugyanabban a látogatásban hozzájárulás nélkül is hozzá kell kötni. Ezért:

1. **Látogatás-tároló** (`assets/js/mp-meres.js`, 6. pont): az érintés minden írásakor ugyanaz a tisztított objektum
   (azonosító-érték, URL nélkül; ugyanazok a mezők, mint az `mp_forras`-ban) a `localStorage.mp_forras_l`-be is kerül
   `{ e: <érintés>, lej: <unix> }` alakban, `lej` = az utolsó írás + **2 óra**. Minden oldalmegtekintés, amíg van hatályos
   érintés, megújítja. Lejárt / hibás tartalmat a szkript töröl. Minden tárolóhozzáférés `try/catch`-ben.
2. **Olvasási sorrend:** `sessionStorage.mp_forras` → ha üres, az érvényes `mp_forras_l` (visszaírva a `sessionStorage`-ba
   `b: 'l'` jelzéssel). **Last paid click mindkét tárolón:** ha a látogatás-tárolóban **újabb fizetett** érintés van (másik
   lapon érkezett), az nyer; nem fizetett érintés fizetettet sosem ír felül (a látogatás-tároló sem); az érkezéskori
   felülírási szabály a két tároló hatályos érintéséhez mér.
3. **Szerver:** a köszönőoldali jelzés `forras_tarolo: 'latogatas' | 'munkamenet'` mezőt küld; a D1 `bizonyitek_forras`
   értéke `latogatas`, ha a munkamenet-érintés a látogatás-tárolóból jött (`cimke.js bizonyitekForrasTarolo`); a `munkamenet`
   és a hozzájárulásos `suti` (`mp_lpt`) változatlan.
4. **Diagnosztika** (szám / típus / kategória; személyes adat és URL nincs; a szerver fehérlistán ellenőrzi, minden más
   eldobva – `cimke.js diagBemenet`; idempotens `ADD COLUMN`):
   - `diag_oldalak`: a lapon (munkamenetben) látott saját oldalak száma a köszönőoldallal együtt (`sessionStorage.mp_oldalak`,
     minden oldalbetöltéskor +1, csak a fő ablakban; 1–999);
   - `diag_nav`: a köszönőoldal **előtti** oldal navigációs típusa (`navigate` / `reload` / `back_forward` / `prerender`),
     ha nincs előző, a köszönőoldalé (`sessionStorage.mp_nav_elozo`);
   - `diag_opener`: 0/1 – a munkamenet első oldalán volt-e `window.opener` (`sessionStorage.mp_elso`);
   - `diag_elso_ref`: a munkamenet első oldalának hivatkozó-**kategóriája**: `belso` / `kereso` / `social` / `egyeb` / `nincs`.
5. **Riport** (`riport.js`, napi sorok, a régi mezők változatlanok): `bizonyitek_forrasok` (`munkamenet` / `latogatas` /
   `suti` / `nincs` szerinti darabszám), a `nincs_jel` sorokra `nincs_jel_elso_ref` (kategóriánként + `ismeretlen`) és
   `nincs_jel_oldalak` (`1` / `2-3` / `4+` / `ismeretlen`).
6. **Korlát:** 2 óránál hosszabb szünet utáni, jel nélküli új lapos foglalás továbbra is `nincs_jel`; másik böngészőben /
   eszközön indult látogatás nem köthető össze.

Tesztek: `node --test tools/test-mp-forras-v2.mjs` (olvasási sorrend, lejárat, last paid a két tárolón, hibás tartalom /
tiltott tároló, diagnosztika, szerveroldali fehérlista, riport-bontások); `node tools/forras-pw.mjs` 11. eset (A lapon `gclid`,
B lap `noopener`-rel belső oldallal → foglalás: `google_nem_markas`, `bizonyitek_forras = 'latogatas'`, diag kitöltve;
3 órával később (eltolt `Date.now`) új lapon → `nincs_jel`).

## TikTok Events API „Schedule” (2026-10-13, csak napló)

Az igazolt foglalásoknál a Google-feltöltéssel egy időben, attól függetlenül fut; alapértelmezésben semmit nem küld,
csak naplóz (`mp_tiktok_feltoltes`). Részletek és élesítés: [MERES_TIKTOK.md](MERES_TIKTOK.md).
