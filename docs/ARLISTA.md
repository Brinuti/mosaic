# Árlista oldal (`/arlista`, 2026-10-07)

Minden üzletág **aktuális ára egy helyen**: Head Spa (+ páros), szőrtelenítés, fodrászat, oxigénterápia, sminktetoválás és az ajándékkártyák. A tulajdonos kérése: „legyen az árlista olyan oldal, mint a GYIK és a Kapcsolat, mert már öt üzletágunk van; kerüljön a menübe, minden üzletág ára legyen rajta, egyszerűen szűrhető, és telefonon is jól olvasható”.

**A menüpontot (fejléc, lábléc) külön kell felvenni** (`tools/fejlec-menu.mjs`); az oldal addig is él a `/arlista` címen, a `<!--mh-menu-aktiv:/arlista-->` jelölővel (a menüpont kijelölődik, ha lesz). Az oldal indexelhető, **a sitemapben még nincs** (a sitemap a Wix fájljait követi: `tools/wix-sitemap/`).

## Fájlok

| Fájl | Szerepe |
|---|---|
| `foglalas/arlista.html` | az oldal – **GENERÁLT**, kézzel ne szerkeszd |
| `tools/arlista-oldal.mjs` | a generátor: `node tools/arlista-oldal.mjs` (kiolvassa az árakat a forrásokból, kiírja az oldalt) |
| `assets/css/arlista.css` | az oldal stílusa (minden saját osztály `arl-` előtagú; a `headspa-oldal.css` komponenseire épül) |
| `assets/js/arlista.js` | szűrő, kereső, Noel-kapcsoló, letapadó sáv |
| `tools/arlista-teszt/arlista.test.mjs` | 39 teszt (12 forrás-ellenőrzés + 27 böngészős), build nélkül |

## Honnan jönnek az árak (egyetlen forrás üzletáganként)

Az árakat **nem írjuk be az oldalra**: a generátor az alábbi fájlokból olvassa ki őket, így az újrafuttatás szinkronba hozza az oldalt. Ami nem olvasható ki az oldalakból, az a generátor `EGYEDI` blokkjában van, a forrás fájl nevével (a teszt ellenőrzi, hogy a szöveg / ár a forrásban szerepel).

| Üzletág | Forrás | Mit veszünk ki |
|---|---|---|
| Head Spa | `foglalas/headspa-arak-budapest.html` (a 3 `.csomag` kártya) | ár, áthúzott eredeti ár, időtartam, „mit tartalmaz” lista, az „Októberben 20% kedvezménnyel” sáv |
| Szőrtelenítés | `foglalas/lezeres-szortelenites-budapest.html` (`#arlista` táblázat) | 7 csoport, 22 sor: alkalmankénti ár, 8 alkalmas program (= 6 × ár), a kész csomagok „külön-külön” ára, az árlista bevezetője |
| Fodrászat | `tools/hair-oldalak/salonic-hair.json` + `tools/hair-oldalak/adat.mjs` (`arlista()`) | a Salonic pillanatképe: ár hajhossz szerint, időtartam, ki mit vállal; Noel −20%-a a Salonic-felirat szerint |
| Oxigénterápia | `foglalas/oxigenterapia-budapest.html` (`.ar-kartya`, `.berlet-doboz`) | hajkamera 4 990, első kezelés 29 900, 2. alkalomtól 26 000, 5× / 10× bérlet + termékajándék |
| Sminktetoválás | `foglalas/sminktetovalas-budapest.html` (`.ar-kartya[data-salonic]`) + `EGYEDI.pmuSzempilla` | 5 kezelés + ingyenes konzultáció; a szempilla-sűrítés a Salonic szerint (lásd lent) |
| Ajándékkártya | `assets/js/ajandek-adat.js`, `ajandek-adat-lezer.js`, `ajandek-adat-oxigen.js` (`ar_ft`) | a három kártya-család (3 + 6 + 4 kártya); a hajkamera / kezelés időtartama is innen |

A booking-motor élő árait a Salonic adja (`docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json`, 2026-10-03-i pillanatkép). A teszt **összeveti** vele az oldal árait (Head Spa: 302342 / 431713 / 302999; szőrtelenítés: mind a 22 sor alkalmankénti ára és az első kezelés = ár × 0,8; fodrászat: mind a 38 ár; oxigén: 466147 / 466110 / 466158; PMU: a 6 kezelés). Ha a teszt itt elbukik, vagy az ár változott (frissítsd a forrást és a pillanatképet), vagy az oldal tér el a Salonictól: ezt kell eldönteni, ne „igazítsd” a tesztet.

Plusz teszt: **minden ár, ami az oldalon szerepel, visszavezethető** a fenti forrásfájlok valamelyikére (nincs kitalált ár), és az oldalon nincs elavult ár (pl. a Head Spa a régi 29 900 Ft-ot), nincs régi nyitvatartás.

## Árváltozás után

1. A forrásban javítsd az árat (arak-oldal / szőrtelenítés árlista / oxigén-oldal / PMU-oldal / `node tools/hair-oldalak/salonic-pillanatkep.mjs` / `ajandek-adat*.js`).
2. `node tools/arlista-oldal.mjs`
3. `node --test tools/arlista-teszt/arlista.test.mjs` (a `PLAYWRIGHT_UTVONAL` a `playwright-core`-t tartalmazó `node_modules` mappa)

**Az októberi 20% vége**: a Head Spa csomagoknál az arak-oldal árai változnak (a generátor követi), és az `ajandek-adat.js` ajándékkártya-árai is (a teszt jelzi, ha a kettő eltér).

## Szűrő, kereső, hash

- **Chipek** (Mind, Head Spa, Szőrtelenítés, Fodrászat, Oxigénterápia, Sminktetoválás, Ajándékkártya): oldalfrissítés nélkül szűrnek. A sáv a fejléc alatt **letapad** (a fejléc magasságát méri), telefonon vízszintesen görgethető, a kiválasztott chip a látható rész közepére gördül.
- **Bejövő hash**: `/arlista#szortelenites`, `#fodraszat`, `#oxigenterapia`, `#sminktetovalas`, `#ajandekkartya`, `#headspa` az üzletágat választja ki; `#paros` a Head Spa-t és a páros sort; `#arak` mindent. Ismeretlen hash: minden látszik.
- **Az oldal nem írja az URL-t** (nincs `pushState` / `replaceState` / hash-váltás chip-kattintásra), hogy a GTM „History Change” triggerei ne induljanak el. A chipek valódi linkek (`href="#id"`), ezért új lapon nyitva ugyanaz a nézet jön elő. JS nélkül minden üzletág látszik, a chipek a szekciókra ugranak.
- **Kereső**: minden üzletágban keres (ékezet- és kisbetű-független, több szó = mind szerepeljen), elrejti az üres csoportokat és szekciókat, jelzi a találatok számát. Kereséskor a „Mind” aktív; egy chip kiválasztása törli a keresést.
- **Fodrászat – Noel**: a „Betti és Evelin / Noel (−20%)” kapcsoló átkapcsol a Noel kedvezményes áraira (az eredeti áthúzva; a Noel által nem vállalt férfi hajvágás eltűnik). Az árak a HTML-ben vannak, a JS csak átkapcsolja őket; JS nélkül a listaárak és egy mondat a Noel-kedvezményről látszik. A „Ki mit vállal?” lista a Salonic-pillanatképből generált (csak az eltérő esetek).

## Telefonon

Kompakt sorok (név + rövid leírás balra, ár jobbra, egy vonalban), az ár soha nem tör sorra (teszt: 1440 / 390 / 360 px), nincs vízszintes görgetés, minden érintési cél ≥ 44 px, a hajhossz-oszlopok a név alatt 4 egyenlő cellában, felirattal. A foglalás gombok a szokásos `/foglalo-motor?business=…` linkek (Páros: `&service=paros`; fodrász konzultáció: `&service=konzultacio`; PMU: `/sminktetovalas-budapest#foglalas`; ajándékkártya: `/ajandekkartya`).

## Szándékos döntések és eltérések a forrásoktól

- **Kihagyott pont**: a „4 Kezes” csomag „Csak ajándékkártya készült” pontja nem kerül ki. A foglaló-motor (`business=headspa`, `service=4kezes`), a Salonic (431713, 39 900 Ft) és az új főoldal szerint a négykezes kezelés ma foglalható; az arak-oldal / az októberi-kedvezmény oldal ezen pontja elavultnak látszik (a forrásoldalt nem módosítottam).
- **Szempilla-sűrítés** (47 000 Ft, 60 perc): a Salonic PMU-szolgáltatása (481061; „59.000 Ft helyett most”) és a PMU-foglaló (`foglalo-pmu.js`) kezeli, de a sminktetoválás-oldal árkártyái között nincs. Az árlistán szerepel; ha nem kell, az `EGYEDI.pmuSzempilla` sorát és a `sminktetovalas()` függvényben a hozzáadását kell kivenni.
- **PMU áthúzott árak nincsenek**: a Salonic „X Ft helyett most” árait (124 900 / 134 900 / 99 000 / 99 000 / 79 000 / 59 000) egyetlen oldal sem mutatja, ezért az árlista sem (lásd az „Eltérések” 6. pontját).
- **Páros**: 53 800 Ft / 2 fő (a páros-oldal szerint 26 900 Ft / fő).
- **Póthaj felrakás**: a fodrász-oldal „350 Ft / tincs” árát mutatjuk; a Salonic foglalási ára 35 000 Ft (a szöveg ezt is kiírja).
- **Ajándékkártya – szőrtelenítés**: a hat kártya ára az első kezelés ára (táblázat × 0,8); a teszt ezt ellenőrzi.
- **Head Spa bérlet / előfizetés** (`/headspa-elofizetes`): nem szerepel, mert ma nem ellenőrizhető, hogy értékesítik-e (Wix-előfizetés).
- Tracking: nincs `data-cta`, nincs GTM / pixel változtatás; a `suti.js` útvonal-listája változatlan (az oldal nem kap Meta-pixelt).

## Tesztek

`PLAYWRIGHT_UTVONAL=<node_modules mappa> node --test tools/arlista-teszt/arlista.test.mjs` – 39 teszt: szinkron a generátorral, minden ár visszavezethető, Salonic-egyezés, nincs elavult ár, betöltés hiba / külső kérés nélkül, 1 H1, mind a hat üzletág, foglaló- és részlet-linkek, szűrő (chip, hash, hashchange, kereső, törlés), Noel-kapcsoló, JS nélkül, túlcsordulás + ár-sortörés + ár-oszlop + letapadó sáv 1440 / 390 / 360 px-en, érintési cél, vízszintesen görgethető chip-sor.

## Eltérések a forrás-oldalak között (a tulajdonos döntse el; az árlista nem választ csendben)

Az árlista a fenti forrásokat követi; az alábbi helyeken a forrásoldalak **egymással** vagy a Salonic-pillanatképpel (2026-10-03) nem egyeznek. A forrásoldalakat nem módosítottam.

1. **Elavult Head Spa ár (29 900 Ft)**: `foglalas/headspa-budapest.html` (élő `/headspa-budapest`, árkártya: „50 perces MOSAIC Head Spa kezelés 29.900 Ft”; most 26 900, lista 32 900). Ugyanez a régi ár: `/headspa-ferfiaknak` („32.900 Ft helyett 29.900 Ft”), `/headspa-10szazalek-kedvezmennyel`, az ÁSZF ajándékkártya-értéke (`klon/aszf.html`), az `assets/js/gyik.js` ajándékkártya-kérdései („29.900 / 59.800 forint” utalás).
2. **„Csak ajándékkártya készült”** a 4 Kezes csomagnál (`headspa-arak-budapest`, `head-spa-kedvezmeny`) – de a foglaló-motorban és a Salonicban (431713, 39 900 Ft) a 4 Kezes ma foglalható.
3. **Oxigénterápia – Arc / Arc + Haj ár** (`/oxigenterapia-ferfiaknak`, `/30szazalek`, `gyik.js`): „Arc 29.900 Ft (33.900 helyett), Arc + Haj 39.900 Ft (43.900 helyett), 2. alkalomtól 26.000 / 34.900 Ft”. A Salonicban és a fő oxigén-oldalon csak a haj-kezelések szerepelnek (29 900 / 26 000), ezért az árlistán az Arc-termékek nincsenek.
4. **Szőrtelenítés, régi férfi-oldal** (`/vegleges-szortelenites-ferfiaknak`, indexelt): „Hónalj 8 alkalom: 96.000 Ft” (most 114 000 = 6 × 19 000); a Man Total „külön 99.000 Ft, csomagkedvezmény 32.000 Ft, ár 68.000 Ft” (a csomagár egyezik, a „külön” összeg nem: most 119 000). A `/szortelenites-5-dolog` és a `/szőrtelenítés-zsófi-csomagok` (nincsenek a sitemapben, de elérhetők) régi csomag-összeállításokat mutat („Láb + intim 95.000 helyett 77.000 Ft”, „Láb + kar + hónalj + arc 150.000 helyett 104.500 Ft”), amelyek nem egyeznek a mostani kész csomagokkal.
5. **Man Total csomag felirata a Salonicban**: „… 32.000 FT KEDVEZMÉNNYEL” (a többi csomagnál a felirat kedvezménye = a „külön-külön” összeg − a csomag ára: Basic 55 000 − 9 500, Medium 90 000 − 27 000, Summer 114 000 − 30 500, Total 156 000 − 48 500). A Man Totalnál a lista „külön-külön 119 000 Ft” (hát + mellkas + has + hónalj) és a 68 000 Ft csomagár 51 000 Ft különbséget ad, a felirat 32 000-et (vagyis 100 000 Ft alapot, hónalj nélkül). Az árlista a szőrtelenítés-oldal szerinti 119 000-et mutatja.
6. **PMU – a Salonic árai mind akciósak** („124.900 Ft helyett most” = 99 000; 134.900 → 110 000; 99.000 → 79 000 ×2; 79.000 → 63 000; 59.000 → 47 000, mind −20%), a `/pmu-melitta` szerint „csak októberben”. A sminktetoválás-oldal és az árlista egyszerűen a mostani árat mutatja, az akció végét és az eredeti árat nem. Kérdés: tartós-e a 79 000 / 99 000 / 110 000 / 63 000 / 47 000?
7. **PMU – szempilla-sűrítés** (47 000 Ft) a Salonicban és a PMU-foglalóban van, a sminktetoválás-oldalon nincs; az eltávolítás (18 000 Ft) csak a régi PMU-visszahívás űrlap (`klon.js`) opciója, a döntés szerint az eltávolítás csak fotó alapján megy, ezért nincs az árlistán.
8. **Fodrászat**: a konzultáció „9 900 Ft helyett 0 Ft” csak a Salonic feliratában van, a fodrász-oldalak nem írják ki (az árlista áthúzva mutatja); a póthaj felrakás a Salonicban 35 000 Ft, a fodrász-oldal szerint 350 Ft / tincs; Noel kedvezményes árát a Salonic-felirat („Noel - 20% kedvezmény!”) szerint számoljuk (a mapping fájl szerint a végső munkatársankénti ár nincs kiolvasva). Betti nem vállalja a „Teljes szőkítés”-t (rövid–hosszú haj) és a „Teljes festés”-t (hosszú haj), Noel nem vállal férfi hajvágást, a póthaj felrakását csak Evelin (Salonic-beállítás; ha hiba, ott kell javítani).
9. **Ajándékkártya-árak** a mostani akcióval egyeznek (Head Spa: az `ajandek-adat.js` megjegyzése szerint listaár 32 900 / 49 900 / 65 900; szőrtelenítés: az első kezelés −20%-os ára); az akció végén az árlista és az `ajandek-adat*.js` együtt változik, a teszt jelzi, ha eltérnek.
10. **Head Spa bérlet / előfizetés** (`/headspa-elofizetes`, a sitemapben szerepel; „havi 26 900 Ft”, „5 alkalmas bérlet 134 500 Ft”): régi Wix-előfizetés (a 29 900-ból számolt −10%); nem ellenőrizhető, hogy ma értékesítik-e, ezért kimaradt az árlistáról.
11. **Foglaló-link az oxigén-oldalon**: az `/oxigenterapia-budapest` gombjai közvetlenül a Salonicra (`mosaic-oxigen.salonic.hu`) visznek, az árlista (a kérés szerint) a `/foglalo-motor?business=oxygen` linket használja.
