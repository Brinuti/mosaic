# Google kattintás-azonosítók átadása: próbaeszköz (`gclid-atadas-proba`)

A Google Ads indulás előtti E2E-teszt egyik előfeltétele (mérési oldal, #167 6240109548 (b) pont): **a `gclid` / `gbraid` / `wbraid` végigér-e a hirdetési céloldaltól a foglalón át a köszönőoldalig**, mind a 4 üzletágon. Az eszköz **csak ellenőriz**: a kódhoz (`booking-launcher.js`, `booking-engine/**`, `attribucio.js`, `suti.js`) nem nyúl, **foglalást nem ad le**, a kimenő mérést (Google Ads, GA4, stape, Meta, TikTok, Zapier) és **minden POST-ot letilt és naplóz** (`tools/meres-proba/tilt.mjs`). A Salonic adatlapja (`guestData`) sosem töltődik be (nincs időpont-tartás): helyette a Salonic **átirányítása** fut a köszönőoldalra (a `meres-proba.mjs --mod szim` mintájára); a naptár-API-ra csak olvasó GET megy.

## Futtatás

```bash
export CHROME_UTVONAL=/opt/pw-browsers/chromium-1194/chrome-linux/chrome   # Linux; a Playwright-Chromium
node tools/meres-proba/gclid-atadas-proba.mjs --forgatokonyv mind --out naplo.json --md eredmeny.md
```

| Kapcsoló | Jelentés |
|---|---|
| `--forgatokonyv` | `mind` (az első 7) vagy vesszővel: `lezer`, `oxigen1` (466147), `oxigen0` (466110), `fodrasz-konzult`, `fodrasz-festes`, `pmu-smink`, `pmu-szaj`; új, még nem élő oldalak: `intim`, `hajvizsgalat`, `evelin-uj` |
| `--oldal /utvonal` | a forgatókönyv landing-címének felülírása |
| `--dist <abszolút mappa>` | a helyi `dist/` az **éles hostnév alatt** (meg nem deployolt oldalak; `ELES=1`-es build kell). Dist nélkül az éles oldal (csak olvasás). PR-előnézeten (`--bazis https://<ág>.mosaic-d77.pages.dev`) a `suti.js` **nem tölt mérőkódot**, ezért a Google-címke / `_gcl_aw` lépések ott `n/a` |
| `--mobil 1` | mobil UA + 390 px |
| `--lepesek` | `a,b,c,d,e,f,g,h` (alap: mind), lásd lent |
| `--sutik` | `nincs-dontes` (**alap**: friss hirdetési látogató; az alapérték marketing = granted), `elfogad`, `elutasit` |

A teszt-azonosítók **legalább 10 karakteresek** és forgatókönyvenként eltérők (`TESZTGCLID<forgatókönyv><idő>`): az `attribucio.js` mintája `^[A-Za-z0-9_-]{10,200}$`, a rövidebbet (pl. `TESZT123`) **eldobja**. Kilépési kód: 1, ha van `HIBA`; az `ISMERT_RES` (dokumentált rés) nem bukik el, hogy a mérési oldal lássa.

## Lépések

| Lépés | Mit csinál | Mit ellenőriz |
|---|---|---|
| **a** | landing `?gclid=&gbraid=&wbraid=&utm_*` | `mh_attr` (localStorage, 90 nap), `mhAttribucio.pillanatkep().google`, `_gcl_aw` süti (Google-címke), a Google-címke fut |
| **b** | CTA-kattintás a landingen | van-e a brief szerinti paraméterű CTA; a foglaló-réteg megnyílik; a réteg URL-je és a tracker-események (`booking_service_selected`, `booking_slot_viewed` …) hordozzák a `gclid`-et; a lépés-mérés eseményei; a stape-kérések |
| **c** | közvetlen `/foglalo-motor?…&gclid=…` (a hirdetés közvetlenül a foglalóra mutat) | az URL és a tracker-események megtartják az azonosítókat; mi van a `mh_attr` / `_gcl_aw`-ben |
| **d** | gclid-es landing, majd **azonosítók nélküli** oldalbetöltés, onnan CTA | mi marad meg (`mh_attr`, `_gcl_aw`) és mi nem (URL, motor-kontextus) |
| **e** | a teljes út landingről a szimulált köszönőoldalig | köszönőoldal URL (`withAttribution`), Google Ads konverziós kérések (címkék, `ref`, azonosítók), `/api/meres-erkezes` POST törzse (`attr.google.*`), `mh_attr`, `_gcl_aw` |
| **g** | ugyanez az azonosítók nélküli oldalról nyitva | ua. (itt az URL-ből hiányzó azonosító a mai rés) |
| **h** | közvetlen `/foglalo-motor` belépés a köszönőoldalig | ua.; a Google-címke az URL-ből állít-e `_gcl_aw`-t |
| **f** | átirányítások (`/idpontfoglalas`, `-uj` címek, `/contact`, záró `/`, `.html`) | a `Location` megtartja-e a lekérdezést (élő hoston `GET`, `redirect: manual`) |
| PMU | a beágyazott PMU-foglaló (`/foglalo-pmu`, a launcher nem fogja) | a keret `src`-je; a siker utáni top-navigáció (`mhKeretbenOldal` → a Salonic URL-je + `mh_proba=pmu`) szimulációja |

Besorolás: `OK` (✔) · `ISMERT_RES` (rés) · `MEGFIGYELES` (ℹ, információ) · `HIBA` (✘, váratlan eltérés) · `N/A`.

## Mai eredmény (élő oldal, asztali, kimenő mérés letiltva)

Futtatva: 2026-10-18, a `main` `97999a17` állapotán (élő oldal); az **új oldalak** (`intim`, `hajvizsgalat`, `evelin-uj`) a PR-ágaikból épített helyi dist-tel, az éles hostnév alatt (`--dist`): a #398 / #399 / #400 draft PR-ok. Összesen **442 ellenőrzés: 314 ✔ · 38 rés · 90 ℹ · 0 ✘**. A teljes sor-lista: [meres-naplo/2026-10-18-gclid-atadas-proba.md](../../meres-naplo/2026-10-18-gclid-atadas-proba.md).

| Forgatókönyv | a landing | b CTA→réteg | c közvetlen | d másik oldal | e köszönő (landingről) | g köszönő (másik oldalról) | h köszönő (közvetlen) |
|---|---|---|---|---|---|---|---|
| lezer | ✔ | rés | ✔ | rés | ✔ | rés | ✔ |
| oxigen1 | ✔ | rés | ✔ | rés | ✔ | rés | ✔ |
| oxigen0 | ✔ | rés | ✔ | rés | ✔ | rés | ✔ |
| fodrasz-konzult | ✔ | rés | ✔ | rés | ✔ | rés | ✔ |
| fodrasz-festes | ✔ | rés | ✔ | rés | ✔ | rés | ✔ |
| pmu-smink | ✔ | rés | – | – | rés | – | – |
| pmu-szaj | ✔ | rés | – | – | rés | – | – |
| intim | ✔ | rés | ✔ | rés | ✔ | rés | ✔ |
| hajvizsgalat | ✔ | rés | ✔ | rés | ✔ | rés | ✔ |
| evelin-uj | ✔ | rés | ✔ | rés | ✔ | rés | ✔ |
| lezer (mobil) | ✔ | rés | – | – | ✔ | – | – |
| oxigen1 (mobil) | ✔ | rés | – | – | ✔ | – | – |


Átirányítások:

| Útvonal | Állapot | Bizonyíték |
|---|---|---|
| /idpontfoglalas | ℹ | allapot: 200 |
| /mosaic-hair-idopontfoglalas | ℹ | allapot: 200 |
| /noi-hajfestes-budapest-uj | ✔ | /noi-hajfestes-budapest?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&ut |
| /lezeres-szortelenites-budapest-uj | ✔ | /lezeres-szortelenites-budapest?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVC |
| /contact | ✔ | /?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_source=google&utm_me |
| /headspa-budapest/ | ✔ | /headspa-budapest?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_sour |
| /lezeres-szortelenites-budapest.html | ✔ | /lezeres-szortelenites-budapest?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVC |
| /fodraszat-foglalas | ✔ | /?gclid=TESZTGCLIDREDIRMVCX67XN&gbraid=TESZTGBRAIDREDIRMVCX67XN&wbraid=TESZTWBRAIDREDIRMVCX67XN&utm_source=google&utm_me |

**Az oszlopok „rés” jelei** (mind a fenti R-listából; hibát / váratlan eltérést nem találtunk): *b* = **R2** (a `gbraid` / `wbraid` nincs a tracker-eseményeken; a `gclid` igen; a PMU-soroknál **R3**: a beágyazott foglaló keretének `src`-jében nincs azonosító) · *d* és *g* = **R1** (azonosítók nélküli oldalról nyitva az URL-ből / a köszönőoldal URL-jéből hiányzik; a `mh_attr` és a `_gcl_aw` megvan) · *e* PMU-nál = **R3** (a PMU-út köszönőoldalának URL-jében nincs azonosító). A *c* oszlop ✔-je mellett a **R4** megfigyelés (közvetlen `/foglalo-motor` belépés) szerepel a naplóban.

Ami minden forgatókönyvben, minden lépésen **✔** (és ezért a Google E2E-próba szempontjából a lényeg): a `gclid` / `gbraid` / `wbraid` elmentődik az első betöltéskor (`mh_attr` 90 nap + a Google-címke `_gcl_aw` sütije), oldalak között és a köszönőoldalon is megmarad; a foglaló-réteg ugyanazon az URL-en nyílik, a tracker-események hordozzák a `gclid`-et; a **köszönőoldal URL-jében a `gclid` + `gbraid` + `wbraid` ott van** (`withAttribution`, a landingről és közvetlen belépéssel nyitva); a köszönőoldalon a Google Ads konverziós kérések (`pagead/conversion` + `ccm/conversion`) elsülnek, a `ref` a gclid-es landing; az `/api/meres-erkezes` törzsében az `attr.google.{gclid,gbraid,wbraid}` egyezik a beadottal. Mobil (390 px, iPhone UA): ugyanez (lézer, oxigén).

**Átirányítások** (`f`, élő hoston `GET`): minden megtartja a lekérdezést (`-uj` címek, `/contact`, záró `/`, `.html`, megszűnt `/fodraszat-foglalas`). A `/idpontfoglalas` és a `/mosaic-hair-idopontfoglalas` **saját oldal** (200, nem átirányítás).

**Új oldalak** (#398 intim, #399 hajvizsgalat, #400 evelin-uj): az átadás-lépések ugyanúgy ✔ (a CTA-paraméterek a brief szerintiek). **Mérőkód-lefedettség a landingen** (`a` lépés, kimenő kérések): a Google-címke, a GA4 / stape és a TikTok-pixel az új oldalakon is fut; a **Meta-pixel NEM** (a megfelelő élő oldalakon 1 Meta-kérés van, az újakon 0): a `suti.js` `PIXEL_*` oldal-listáin az új címek hiányoznak (a `suti.js` védett; élesítéskor a mérési oldal / a fő munkamenet dönt).



## Ismert rések (a mai viselkedés; NINCS implementálva, a mérési oldal és Feri döntése)

A **mérési szempontból lényeges** tény: a Google-címke a `gclid`-et a `_gcl_aw` sütiből is olvassa, és az `attribucio.js` a `mh_attr`-ot (90 nap) a szervernek is elküldi a foglaláskor (`/api/meres-erkezes`): ezek **minden lépésen megvannak**, ahol az oldalon fut a `suti.js`. A rések az **URL-alapú** átadást érintik (a motor kontextusa, a köszönőoldal URL-je).

| # | Rés | Hol | Hatás | Javítási javaslat (nem implementálva) |
|---|---|---|---|---|
| **R1** | Ha a foglalót **azonosítók nélküli oldalról** nyitják (a látogató a gclid-es landing után másik oldalra lép / visszatölt), a réteg URL-je és a motor `ctx.attribution`-je nem tartalmazza a gclid-et; a `withAttribution` az engine `win.location.search`-ét fűzi, így a **köszönőoldal URL-jéből hiányzik** | `flow.js` `parseContext` / `withAttribution`, `engine.js` (HANDOFF) | a `_gcl_aw` süti és a `mh_attr` megvan, a Google-konverzió attribúciója ezekből is működik; az URL-paraméter csak „övé-és-hevederre” | a motor induláskor ha az URL-ben nincs azonosító, vegye át a `window.mhAttribucio.pillanatkep().google` értékeit (`ctx.attribution` + a `withAttribution` keresési sztringje) |
| **R2** | A `gbraid` / `wbraid` **nem kerül a tracker-eseményekbe** (`parseContext` csak `utm_*`, `gclid`, `fbclid`, `ttclid`) | `flow.js` | iOS / webes kampányoknál a tracker-események nem hordoznak azonosítót; a köszönőoldal URL-jébe a `withAttribution` fűzi (ha az engine URL-jén megvolt) | `parseContext` bővítése `gbraid` / `wbraid`-dal |
| **R3** | **PMU beágyazott út** (`/sminktetovalas-budapest`, `/szajtetovalas-budapest`): a keret `src`-jében nincs azonosító, az `attribucio.js` keretben nem gyűjt; sikeres foglalás után a `foglalo-pmu.js` a **top ablakot** a Salonic URL-jére navigálja (`+mh_proba=pmu`), nincs `withAttribution` → a `/pmu-ok` URL-jében nincs azonosító | `assets/js/foglalo-pmu.js` | a szülő oldalon a `mh_attr` / `_gcl_aw` megvan (a localStorage / süti közös), a konverziós kérés `ref`-je a gclid-es landing | a `mhKeretbenOldal` fűzze az azonosítókat a szülő `mhAttribucio`-jából a navigáció előtt |
| **R4** | **Közvetlen `/foglalo-motor?…&gclid=…` belépés**: az oldalon csak az `attribucio.js` tölt (nincs `suti.js`, nincs Google-címke) → nincs `_gcl_aw`, és hozzájárulás-döntés nélkül a `mh_attr`-ot sem írja (memóriabeli pillanatkép marad) | `foglalo-motor.html` | az azonosító az URL-ben utazik, a `withAttribution` a köszönőoldal URL-jébe fűzi (**h** lépés), ott a Google-címke az URL-ből állít `_gcl_aw`-t | nem szükséges; csak tudni kell |

A **launcher / motor módosítása** (R1–R3) a mérési oldal és Feri külön döntése; ez az eszköz csak a mai állapotot méri és a javítás után újrafuttatható (a kimenetnek a `rés` sorokból `✔`-nek kell válnia).

## Új oldalak és még nem élő változatok

A `suti.js` csak a `mosaicheadspa.hu`-n tölt mérőkódot, ezért új oldalt **helyi dist + `--dist`** módon lehet vizsgálni (az éles hostnév alatt szolgálja ki a helyi `dist/`-et):

```bash
ELES=1 node tools/netlify-build.mjs
node tools/meres-proba/gclid-atadas-proba.mjs --forgatokonyv intim --dist "$PWD/dist"
```

Az új oldal is csak akkor kap Google-címkét / pixelt, ha szerepel a `suti.js` oldal-listáin (pl. `PIXEL_OLDALAK`); az eszköz az `a` lépésben kimondja, ha a Google-címke nem fut (`HIBA`).

## Korlátok

- A Salonic adatlap és a tényleges foglalás **szimulált**: a „sikeres foglalásnál elsül a konverzió” végső igazolása valódi tesztfoglalás (`reteg-foglalas.mjs`, `lemond.mjs`) a mérési oldal által jóváhagyott módon.
- A Google Ads konverziós kérésekben a `gclid` közvetlenül nem látszik (a címke a `_gcl_aw` sütiből és a `ref`-ből dolgozik); az eszköz a sütit, a `ref`-et és a kimenő kérések tartalmát mutatja.
- Az `/api/meres-erkezes` POST törzse csak a köszönőoldalon, a `foglalas-kulcs.js` futása után látszik; az eszköz elfogja (nem engedi ki), és ellenőrzi az `attr.google.{gclid,gbraid,wbraid}` mezőket.
