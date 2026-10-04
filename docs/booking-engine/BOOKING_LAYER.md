# Helyben nyíló Booking Engine (réteg)

**Irány (tulajdonos, 2026-10-03):** a foglaló nem külön foglalási oldal, hanem közös komponens, ami **a szolgáltatás-oldalon helyben nyílik meg**. A CTA nem visz át másik oldalra; mivel tudjuk, honnan jött a vendég, a motor nem kérdezi meg újra az üzletágat és azt, amit az oldal már tud.

```
Szolgáltatás landing ── CTA ──> Booking Engine helyben megnyílik
                                  ├─ business már ismert
                                  ├─ service / kategória már ismert, ha tudjuk
                                  └─ UTM / click ID / forrás-oldal megmarad
                                  ──> Gyors időpontok ──> Foglalás ──> Sikeres foglalás
```

- **Mobilon** teljes képernyős réteg („mini app”), **asztalon** középre nyíló panel. Bezáráskor ugyanoda tér vissza az oldalon, ahol volt (az oldal nem navigál).
- **Böngésző vissza gomb, URL:** a réteg lépései **URL-változás nélküli** előzmény-bejegyzések (`history.pushState` cím nélkül): a vissza gomb lépésenként visszalép, az első lépésnél bezárja a réteget, az oldal címe végig változatlan. **Ez szándékos mérés-védelem:** a GTM-konténer **History Change** triggerei minden URL-változásnál (pushState, replaceState, hash, vissza) oldalmegtekintés-eseményeket indítanak: hash-változásnál Meta `PageView` + CAPI; query- vagy útvonal-változásnál ezen felül GA4 `page_view` + `visit` és Google Ads `page_view` is (kísérletileg mérve a GTM-es landing-oldalon, 2026-10-04). Egy végigvitt foglalás így tucatnyi felesleges oldalmegtekintést adna. A beérkező `?booking=1&business=…` linket a launcher továbbra is megnyitja (megosztott / kézzel készített link), de a réteg ezt az URL-t nem írja át. URL-frissítés (újratöltés-visszaállítás, linkelhető állapot) csak akkor kapcsolható be (`openBooking(opts, { urlAllapot: true })`), ha a GTM-ben a History Change triggerek kizárják a `booking=1` URL-eket: ez GTM-módosítás, tulajdonosi jóváhagyás kell hozzá.
- **`/foglalas`** csak általános / direkt belépő (főmenü, kereső, beírt cím): **szolgáltatás-első kezdőoldal (H0)**: öt szolgáltatás-család (Head Spa, Fodrászat, Oxigénterápia, Lézeres szőrtelenítés, Sminktetoválás), ott választ először, utána megy tovább az adott ágon. Ugyanaz a motor, külön oldalon.
- **PMU:** a saját, kész PMU-folyamat (`/foglalo-pmu`) nyílik, a rétegben beágyazva (`?beagyazva=1`), a vége a teljes ablakban nyíló köszönőoldal.
- Sikeres foglalás után az élő tartományon a meglévő köszönőoldal nyílik (a mérés változatlan, a hand-off a motor korábbi logikája).

## Belépés: `openBooking({...})`

```js
openBooking({ business: 'hair', service_category: 'balayage' })   // csak a kategória ismert: rövid pontosítás
openBooking({ business: 'headspa', service: 'paros' })            // rögtön a Páros HeadSpa szabad időpontjai
openBooking({ business: 'oxygen', service: '466158' })            // Salonic-azonosító vagy kulcsszó
openBooking({ business: 'laser', intent: 'first' })               // területválasztó
openBooking({ business: 'headspa', voucher: true })               // ajándékkártya-beváltás
openBooking({ business: 'pmu' })                                  // a saját PMU-folyamat
openBooking({})                                                   // nincs kontextus: szolgáltatás-első kezdőoldal (H0)
```

HTML-ből: `<button data-booking='{"business":"hair","service_category":"balayage"}'>` (vagy `data-booking="business=hair&category=balayage"`), illetve a linktérképen át kerülő `<a href="/foglalo-motor?business=…">` hivatkozások a **rétegben** nyílnak (JS nélkül a `/foglalo-motor` oldalra visznek: fallback). Új/Ctrl-kattintás a böngészőre marad.

Elnevezések: `service_id` = `service`, `service_category` = `category` (a régi nevek elsőbbséget élveznek).

## Fájlok

| Fájl | Szerep |
|---|---|
| `assets/js/booking-launcher.js` | apró indító: figyeli a CTA-kat, `window.openBooking / closeBooking`, `?booking=1` visszaállítás; a foglaló kódját az első megnyitáskor tölti |
| `assets/js/booking-engine/layer.js` | a réteg: Shadow DOM, fókusz-csapda (az Esc és a háttérre kattintás NEM zár, csak az X), inert háttér, görgetés-zár, URL-állapot (history) |
| `assets/js/booking-engine/salonic-adapter.js` | a Salonic nyilvános oldalai + naptár-API; gyors lekérés (párhuzamos részek, progresszív betöltés, gyorsítótárak, `warmUp`) |
| `assets/js/booking-engine/engine.js` | a motor komponensként (`mode: 'page' \| 'layer'`): saját fejléc / lépésjelző, cserélhető üzletág, H0 és PMU nézet, `destroy()` |
| `assets/js/booking-engine/families.js` | a szolgáltatás-első kezdőállapot (H0) családjai (szövegek: javaslat) |
| `assets/css/booking-engine.css`, `booking-fonts.css` | a stílus (a `@font-face` a dokumentumban kell legyen, a Shadow DOM-ban nem működik) |
| `foglalas/foglalas.html` | `/foglalas`: H0, külön oldalon (fallback) |
| `foglalas/booking-test.html` | `/booking-test`: rejtett tesztút, üzletáganként gombok |
| `foglalas/foglalo-motor.html` | a régi rejtett oldal (a motor most maga építi a fejlécet); a no-JS fallback célja |

A build (`tools/netlify-build.mjs`): a launcher verziójelei (`__MOTOR_VERZIO__`, `__CSS_VERZIO__`) tartalom-hash-re cserélődnek (a `/assets/js/*` egy évig tárolható); a launcher csak ott kerül az oldalra, ahol az átkötés be van kapcsolva (előnézet / helyi build), vagy a `/booking-test` oldalon. **Az éles, kikapcsolt build minden meglévő oldalon bájtra azonos a mostanival** (174 oldal asztali + mobil, ellenőrizve az élővel). Új a `robots.txt`-ben: `Disallow: /foglalas$`, `/foglalas?`, `/booking-test` (amíg rejtettek).

## Design (2026-10-04, 1. kör; csak előnézeten, DECISIONS.md „Design-döntések”)

- **Képek** minden szolgáltatás-választónál (`assets/img/booking/*.jpg`, kulcsok a `families.js`-ben és a `flows/*.js`-ben: `kep`); a fodrászok fotója: `flows/hair.js` `staffPhotos`.
- **HeadSpa:** az első kérdés az ajándékkártya (`HS1`: kuponkóddal / kuponkód nélkül), utána `HS2` / `HS3` (kép, időtartam, ár; kuponkódosnál „Kuponkóddal”).
- **Kép-gyorsítótár:** a `/assets/img/*` egy évig tárolható, ezért a kártya-képek URL-je tartalom-hash-t (`?v=`) kap (a build `__KEP_VERZIO__`-ja); egy kicserélt kép így új URL-t kap.
- **Fodrászat:** a belépő a fodrász-választó (`HA0`, fotókkal), csak utána a szolgáltatás; **Oxigén:** a szakember-választó (`OXS`) az időpont előtt, kártyákon, nem legördülőben. Az ikonok (`assets/js/booking-engine/ikonok.js`): hajhosszak, fodrászati kezelések, lézer-testrészek, ajándék, naptár.
- **Időpont-választás (minden üzletág):** `C1` = a PMU-foglaló havi naptára (`flow.js`: `monthList`, `monthGrid`, `dayTimes`) → rögtön a Salonic adatlapja. Nincs összegző képernyő (`C3` megszűnt), nincs gyors-időpontos nézet és naptár-sáv (`C2` megszűnt), a lépésjelző 3 lépés. Szakember-választó csak az Oxigénnél van a naptár fölött.
- **Adatlap:** teljes szélességű keret (nem csúszik ki), a választott időpont összegzése fölötte (asztalon). A PMU-val azonos kinézethez a Salonic-fiókban be kell állítani az „Egyedi CSS URL”-t (lásd ENGINE_HEADSPA.md, „Közös Salonic-CSS”).
- Pillanatképek a nézetekről: `node tools/meres-proba/design-kepek.mjs --overlay dist --ki mappa [--mobil 1] [--stilus 1]`.

## Élő foglaltság (2026-10-04, 7. kör)

Az időpont-naptár alatt egy sáv mutatja a szolgáltatás valódi szabad időpontjainak számát a következő 7 napra (`elo-foglaltsag.js`); percenként frissül, csak valódi változásra mozdul; a heti foglaltság % csak kiszámítható kapacitásból jelenik meg (ma nem), az „N perce foglaltak utoljára” sor csak a szerver-oldali foglalási jegyzettömb valódi bejegyzéséből (`jegyzettomb.js`, `functions/api/foglalas-esemeny.js`; az éles írás ki van kapcsolva a tulajdonos jóváhagyásáig, ezért ma nem látszik). Részletek: DECISIONS.md („Foglalási jegyzettömb”).

## Viselkedés (2026-10-04, 4. kör)

- **Csak az X zár** (Esc / háttér nem); a böngésző vissza gombja lépésenként visszalép.
- **Folytatás:** újranyitáskor (ugyanabból a belépésből, 30 percig) ott folytatja, ahol tartott, az előzményekkel együtt (`sessionStorage`: `mhFoglaloAllapot`; `engine.js`: `saveSnapshot` / `peekSnapshot` / `restoreSnapshot`).
- **Lépésjelző:** a kész lépések gombok (`gotoStep`), a vissza gombbal egyenértékű (`history.go`).
- **Gyors időpont-választás:** a launcher a CTA fölé vitt egérre / érintésre előmelegít (`layer.js` `warm` → `engine.js` `warmUp`: preconnect + szolgáltatás-lista + a szolgáltatás első 14 napja), a motor modulját üresjáratban tölti; a naptár váza azonnal látszik, az első 14 nap hamar jön, a többi a háttérben.

- **Bezárás:** a réteg azonnal rejtetté válik, a motor nem rajzol újra (`state.closing`), majd a böngésző-előzmény visszaáll (`history.go`); a sminktetováló-keret lépései a réteg előzményeiben vannak (`?reteg=1`), így a lépésszám pontos.
- **Nyitás:** a réteg a stílus megérkezéséig rejtett (nincs stílus nélküli villanás).
- **Sminktetováló a rétegben:** kattintható lépésjelző, vissza / előre, folytatás (lásd DECISIONS.md „5. kör”).

## Ellenőrzés

- `node --test tools/test-booking-layer.mjs tools/test-booking-flow.mjs …` (egységtesztek).
- `node tools/meres-proba/reteg-proba.mjs --overlay dist [--mobil 1]`: böngészős próba (Playwright): 16 belépési pont (jó kezdőállapot, az URL nem változik, nincs oldalváltás, bezárás az X-szel), az Esc és a háttérre kattintás nem zár, vissza gomb, kattintható lépésjelző, folytatás újranyitás után (HeadSpa naptár + nap, fodrászat több lépcsős útvonal, lejárt mentés, másik belépés), sebesség-mérés (hideg gyorsítótár, négy üzletág), H0 végigjárás, fókusz-csapda, inert háttér, beérkező `?booking=1` link (UTM / click ID megmarad), a valódi landing-oldalak CTA-i, **mérés-védelem** (a GTM-es landing-oldalon a réteg teljes használata nem indít mérési kérést a fő ablakból), a PMU-landing és a köszönőoldalak launcher nélkül. Eredmény (2026-10-04, helyi build): asztali 176/176, mobil 178/178 (a 4. körtől: villanás-védelem, PMU-lépegetés és -folytatás, lézer-illusztrációk, csomaglista egy képernyőn). A kimenő mérés alapból tiltva.
- Tesztlista a `/booking-test` oldalon (10 pont). A végigvitt foglalás valódi: „TESZT” név, a szalon telefonszáma, lemondás a „Lemondom” linkkel.

## Még nincs kész (következő körök)

1. **CTA-leltár és -csere:** a landing-oldalak foglaló-gombjai oldalanként a megfelelő `openBooking({...})` kontextussal (ma a linktérkép csak a Salonic-linkeket köti át; a belső `/idpontfoglalas`, `/fodraszat-foglalas`, `/szortelenites-foglalas` stb. gombok és a fejléc „Időpontfoglalás” külön döntést kérnek).
2. **A meglévő foglaló oldal (`/idpontfoglalas`) megszűnése:** átirányítás `/foglalas`-ra (a query megmarad), a pixel-lista (`suti.js`) bővítése `foglalas`-sal, ha ott hirdetés landol.
3. **GTM / mérés:** a motor `dataLayer`-be ír (`booking_*`), a réteg pedig most már GTM-es oldalon fut: át kell nézni, hogy semmilyen GTM-trigger nem reagál ezekre (olvasás), a konverziók továbbra is a köszönőoldalon futnak. A köztes lépés-események (GA4 `view_item`, `select_employee`, TikTok `ViewContent`) nem pótolódnak (tulajdonosi döntés).
4. **Design:** a réteg és a H0 vizuális finomítása a végleges terv szerint (szövegek, ikonok, animáció).
5. **Mobil kézi próba valódi telefonon** (iOS Safari: billentyűzet, görgetés az iframe-ben, `100dvh`).

## Élesítés (2026-10-04, 9. kör)

Az oldalakon a főmenü „FOGLALÁS” gombja és a foglalás-gombok (valamint a Salonic-linkek) a `/foglalo-motor?…` címre mutatnak, amit a launcher a helyi, felugró rétegben nyit meg (mobilon és asztalon is). A kapcsolók: `tools/foglalo-atkotes.json`. Részletek: DECISIONS.md „Élesítés”.
