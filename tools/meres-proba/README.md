# Mérés-ellenőrző: foglaló → köszönőoldal, kimenő kérések nélkül

Automatizált Chrome (Playwright), amely a foglaló és a köszönőoldal teljes láncát végigjárja, **minden keretben naplózza a kimenő mérési kéréseket** (Google Ads, GA4, stape, Meta, TikTok, Zapier: melyik címke, milyen esemény, érték, azonosító), és **le is tiltja őket**, így a hirdetési fiókokba semmi nem jut el.

**Alapból tiltó:** a saját oldalon, a Salonic-oldalakon, a reCAPTCHA-n és néhány statikus könyvtár-CDN-en kívül minden harmadik fél felé csak a (GET) szkript- és betűtöltés engedett; minden más (bármilyen POST, ismeretlen host, a stape végpontjai) naplózva és tiltva. Emellett a csak mérésre szolgáló hostok (`capig.stape.*`, `analytics-ipv6.tiktokw.us`, `hooks.zapier.com`, `region1.analytics.google.com`, a Google Ads-végpontok) DNS-szinten sem feloldhatók, ez a második védvonal.

## Telepítés

```bash
npm install --no-save playwright-core
```

A gépen lévő Chrome-ot használja (`CHROME_UTVONAL` környezeti változóval felülírható).

## Futtatás

```bash
node tools/meres-proba/meres-proba.mjs --szenario hair|oxigen2|lezer|headspa --mod szim|nativ|valodi --out naplo.json [--clickids 1] [--landing 1] [--overlay dist]
node tools/meres-proba/elemzes.mjs naplo.json [--reszletes 1]
node tools/meres-proba/osszevet.mjs "cimke=naplo1.json" "cimke=naplo2.json"
```

- `--mod szim`: a Salonic adatlap (iframe) helyett csak a Salonic átirányítása fut a köszönőoldalra, **foglalás nem jön létre**.
- `--mod nativ`: alapvonal, a mostani Salonic-saját útvonal (köszönőoldal közvetlenül, Salonic-referrerrel).
- `--mod valodi`: **valódi foglalás** a Salonic-űrlappal (név „TESZT – Claude”, a feltétel bepipálva, hírlevél nem). A lemondás külön: `lemond.mjs <lemondó-link>` (a visszaigazoló e-mail „Lemondom” linkje). reCAPTCHA-kihívás esetén megáll.
- `--clickids 1`: hirdetési kattintást utánzó paraméterek (`gclid=TESZT123&fbclid=TESZT456&ttclid=TESZT789&utm_source=teszt&utm_medium=cpc`).
- `--landing 1`: „hirdetés → landing → motor” út (a landing a kattintás-azonosítókkal, majd a rajta lévő gombbal a motorra).
- `--popup 1`: az **élesített út**: tartalmi oldal (kattintás-azonosítókkal) → a rajta lévő gomb a felugró foglalót nyitja → Salonic → köszönőoldal. Szenáriók: `headspa`, `hair` (ingyenes konzultáció), `hairvagas` (fizetős hajvágás), `oxigen1` (hajkamerás konzultáció, 466147), `oxigen0` (első kezelés, 466110, a régi hirdetés-címről), `oxigen2` (2. alkalomtól), `oxigenreklam`, `lezer`.
- `--sutik elutasit`: a látogató a süti-sáv „Elutasítom” gombját nyomta (alapból elfogadja): megmutatja, mit küld az oldal a sütit elutasító vendégtől (Meta-pixel igen, Google/GA4 csak sütimentes jelzés, TikTok semmi).
- `--overlay dist`: az éles tartomány oldalait a helyi `dist/`-ből szolgálja ki (még nem deployolt változat kipróbálása; a `dist/`-et `ELES=1 FOGLALO_ATKOTES=all node tools/netlify-build.mjs` készíti).
- `salonic-lepesek.mjs`: a Salonic **natív** útján (főoldal → szolgáltatás → munkatárs → időpont → adatlap) végigkattintva kiírja a `view_item` / `select_employee` (GA4) és a `ViewContent` / `InitiateCheckout` (TikTok) események tartalmát; foglalás nem jön létre. Eredmény: [MERES_FOGLALASI_LEPESEK.md](../../docs/booking-engine/MERES_FOGLALASI_LEPESEK.md).
- `landing-sonda.mjs <útvonalak…>`: mely landingeken fut a Google-címke, a Meta-pixel és a TikTok-pixel, és kapják-e el a kattintás-azonosítót.

A valódi foglalás próbaszáma alapból a **tulajdonos saját száma** (+36 70 942 0090; `MERES_TELEFON`-nal felülírható, a +36 utáni résszel). 2026-10-04 óta nem a szalon száma: az egy valódi vendég (Koncz-Szabó Tünde) kartonjához tartozik a Salonicban, a próbafoglalás arra párosulna.

A teszt a süti-hozzájárulást elfogadottnak tekinti (a saját tárolóba írja, mint a süti-sáv gombja), így a mérés teljes üzemben fut.

**Foglalási jegyzettömb** (`/api/foglalas-esemeny`): a szkriptek soha nem írhatnak a valódi jegyzettömbbe (a próbafoglalás ne kerüljön az „N perce foglaltak utoljára” sorba): az írás (POST) a `tilt.mjs` `esemenyIras` szabálya szerint tiltott, a szkriptek helyben megválaszolják; a `reteg-proba.mjs` a végpontot teljesen mockolja (olvasás és írás a naplóba). Szándékos vizsgálathoz (előnézeti KV-névtér): `MERES_ESEMENY_IRAS=1`.

## Meta-pixel oldalankénti ellenőrzése: `pixel-proba.mjs`

Minden oldalon `?fbclid=TESZTPIXEL` paraméterrel betölti az oldalt, és oldalanként megmondja: melyik pixel-azonosító indult (és hányszor: `fbq.getState().pixels`),
hány `PageView` ment, létrejött-e a `_fbc` süti (benne a `TESZTPIXEL`) és a `_fbp`, volt-e „Duplicate Pixel ID” figyelmeztetés, és a `buy.stripe.com` gombok
linkjében **kattintás után** ott van-e az fbc (a GTM 177-es címke kattintáskor írja a `client_reference_id`-be; hozzájárulás kell hozzá).
A kimenő mérési kérések (a `capig.stape.do` is) alapból tiltva és naplózva vannak (`tilt.mjs`, mint a többi mérőszkriptnél).

```
node tools/meres-proba/pixel-proba.mjs --oldalak mind|/utvonal,/masik --out pixel.json [--koszonok 1] [--overlay dist] [--mobil 1] [--hozzajarulas 0]
node tools/meres-proba/pixel-proba.mjs --osszevet elozo.json uj.json
```

- `--oldalak mind`: a `klon/` minden oldala; `--oldalak nincs --koszonok 1`: csak a köszönőoldalak.
- `--koszonok 1`: hat köszönőoldal a Salonic valódi átirányításának paramétereivel (`first_booking` + `bookingUrl`), hogy a GTM 213-as címkéje is lefusson (kimenő kérés nélkül) – itt látszik, ha a címke kétszer inicializálná a pixelt.
- `--overlay dist`: a még nem deployolt változat a helyi `dist/`-ből (a `pmu-ok` / `pmu-vh` a gitben szimbolikus link, ami Windowson szövegfájl: az eszköz a célfájlt szolgálja ki).
- `--hozzajarulas 0`: friss látogató süti-hozzájárulás nélkül (a pixel ettől függetlenül fut, mint a Wixen; a Stripe-link fbc-je viszont hozzájárulást kér).
- `--osszevet`: két futás összevetése oldalanként (pixelek, PageView, CAPI, események, Google/TikTok) – a „mely oldalak változtak” kérdésre.
- Az elvárt pixel a helyi `assets/js/suti.js` `PIXEL_OLDALAK` listájából jön; a listán kívüli oldalra „nincs elvárt pixel”.
## Az ajándékkártya-motor régi konverziója: `ajandek-konverzio.mjs`

A vásárlás utáni rejtett keret (a régi köszönő-oldal) élő próbája, alapból tiltó kimenő kérésekkel (`capig.stape.*` is). Platformonként megmondja, hány konverzió megy ki, melyik ablakból (fő ablak / rejtett keret), milyen értékkel és `pi_…` azonosítóval, és hogy a gclid / fbc / ttclid benne van-e.

```
node tools/meres-proba/ajandek-konverzio.mjs [--mod motor|regi] [--landing /headspa-ajandekkartya] [--termek egyeni] [--ertek 26900] [--out konverzio.json]
```

- `--mod motor` (alap): hirdetési kattintás (`gclid`, `fbclid`, `ttclid`, `utm_*`), majd a motor Stripe-átirányításos visszatérési útja; a szerver „fizetve” válaszát (`/api/ajandek/rendeles`) a próba utánozza, minden más a valódi kód. **A kártyás fizetés nem történik meg** (kártyaadatot nem adunk meg, a Stripe.js tiltott).
- `--mod regi`: a régi köszönő-oldal a fő ablakban – összehasonlítási alap (ugyanazokat a konverziókat kell adnia, csak a fő ablakból).

## A helyben nyíló foglaló-réteg: `reteg-proba.mjs`

```
node tools/meres-proba/reteg-proba.mjs [--overlay dist] [--bazis https://…] [--mobil 1] [--kepek mappa] [--oldal /booking-test]
```

Foglalás nélkül végigjárja a réteget: minden belépési pont (HeadSpa, Fodrászat, Oxigén, Lézer, PMU, szolgáltatás-első kezdőállapot) jó állapotból indul-e, nem navigál-e az oldal, frissül-e az URL, bezárás / Esc / vissza gomb, újratöltés-visszaállítás (UTM és click ID megmarad), fókusz-csapda, valamint a valódi landing-oldalak foglaló-gombjai. `--bazis https://<ág>.mosaic-d77.pages.dev` egy PR-előnézetet vizsgál; leírás: [BOOKING_LAYER.md](../../docs/booking-engine/BOOKING_LAYER.md).

A próba a design-ellenőrzéseket is tartalmazza (2026-10-04): képek a választók mellett, minden üzletág időpont-választója a havi naptár (PMU-naptár), nincs összegző képernyő, 3 lépéses lépésjelző, az Oxigén árai és szakember-választója, a választott fodrász időpontjai. **`oldal-proba.mjs`**: ugyanez a motor a saját oldalán (`/foglalas`, `/foglalo-motor`; lépések az URL-ben, vissza gomb). **`design-kepek.mjs`**: pillanatképek a kulcs-nézetekről (`--ki mappa`, `--mobil 1`; `--stilus 1`: az adatlap a közös Salonic-CSS-sel, vagyis ahogy az „Egyedi CSS URL” beállítása után fog kinézni).

**`reteg-foglalas.mjs`**: VALÓDI foglalás a rétegen át (`--utvonal h0-headspa|hair-konzult|oxigen-2|lezer-konzult`, `--bazis https://www.mosaicheadspa.hu` vagy egy előnézet): az utolsó szabad nap utolsó időpontja, „TESZT – Claude” név, a telefonszám `MERES_TELEFON` (alap: a szalon száma). A lemondás külön: `lemond.mjs`. Előnézeten a Salonic az ÉLES köszönőoldalra irányít a keretbe, ami idegen szülő alatt mérés nélkül fut (a `suti.js` keretben nem mér), és a motort nem értesíti: a vége ott a keret tartalma, nem a motor sikerképernyője; az éles tartományon a meglévő köszönőoldal nyílik meg a teljes ablakban.

**`booking-id-valodi.mjs`** (QA-1): valódi próbafoglalás az ELŐNÉZETEN a foglaló saját `booking_id`-jával (`--bazis https://<ág>.mosaic-d77.pages.dev`; forgatókönyvek: `hair-konzult`, `hair-vagas-szakember`, `headspa-paros`, `lezer-konzult`; `--szaraz 1`: foglalás nélkül; `--koszono 1`: az ELŐNÉZETI köszönőoldalt tölti be a valódi átirányítási paraméterekkel, így a kulcs-tábla írása is kipróbálható; `--out <fájl>`: a nyers nyom; `--start <unix>`: pontosan ez az időpont – a kulcs-láncos próbákhoz). Kimenő mérés tiltva, az éles köszönőoldalt nem tölti be. A lemondás: `lemond.mjs` (magyar és angol Salonic-oldalon is; Linuxon a Playwright-Chromiumot használja, felülírható: `CHROME_UTVONAL`).

**`qa1-egyeztet.mjs`** (QA-1): az e-mail oldal kliense – a Salonic értesítő e-mail mezőit elküldi az előnézeti `/api/foglalas-egyeztetes` végpontnak (`EGYEZTETES_KULCS` környezeti változó), és kiírja a teljes nyers nyomot (booking_id, `bookingUrl`, kulcs, kulcs-tábla-rekord, az e-mailből képzett kulcs mindkét ágon, keresés eredménye, esemény-azonosító). `--mod lemondas`: a Salonic LEMONDÁSI értesítőjének mezőit küldi (nincs UUID; a kulcsot a névtáblából képezi a végpont). Foglalást nem hoz létre. Részletek: `docs/booking-engine/BOOKING_ID.md`.
