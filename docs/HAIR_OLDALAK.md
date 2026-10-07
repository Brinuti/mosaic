# Fodrászat-oldalak (központi + Betti + Noel + Evelin)

A **MOSAIC_Hair_implementation_v2** csomag (prototípus + hat látványterv-kép) alapján újratervezett fodrász-oldalak. **Ideiglenes (`-uj`) címeken,
`noindex`-szel állnak**, rájuk nem mutat link, nincsenek a sitemapben; a csere az eredeti címre (a mostani Wixes oldalak helyére) **csak külön kérésre** történik
(lásd `docs` / memória: új oldal élesítése külön címen).

| Oldal | Ideiglenes cím | Eredeti (mostani, Wixes) cím | Fájl |
|---|---|---|---|
| Központi női fodrászat | `/noi-fodraszat-budapest-uj` | `/noi-fodraszat-budapest` | `foglalas/noi-fodraszat-budapest-uj.html` |
| Betti | `/noi-fodrasz-budapest-balayage-hajfestes-uj` | `/noi-fodrasz-budapest-balayage-hajfestes` | `foglalas/noi-fodrasz-budapest-balayage-hajfestes-uj.html` |
| Noel | `/balayage-haj-festes-budapest-uj` | `/balayage-haj-festes-budapest` | `foglalas/balayage-haj-festes-budapest-uj.html` |
| Evelin | `/noi-hajfestes-budapest-uj` | `/noi-hajfestes-budapest` | `foglalas/noi-hajfestes-budapest-uj.html` |

## Felépítés (egy adatforrás, egy komponens-rendszer)

Az oldalak **generáltak** – kézzel ne szerkeszd őket (a teszt ellenőrzi, hogy a fájl egyezik a generátor kimenetével):

| Fájl | Szerepe |
|---|---|
| `tools/hair-oldalak.mjs` | a generátor: `node tools/hair-oldalak.mjs` (írja a 4 oldalt), `--ellenoriz` (csak összevet) |
| `tools/hair-oldalak/adat.mjs` | a közös adatmodell: fodrászok (szövegek, specializációk), szolgáltatás-csoportok, árlista, **valódi fotók** (a régi oldalak képei, blokk-sorszám szerint), formázás |
| `tools/hair-oldalak/sablon.mjs` | a szekciók HTML-sablonjai (központi oldal, fodrász-oldal) |
| `tools/hair-oldalak/salonic-hair.json` | **a Salonic pillanatképe**: szolgáltatások, hajhosszak, időtartamok, árak, ki mit vállal, a fodrászok és kedvezményeik |
| `tools/hair-oldalak/salonic-pillanatkep.mjs` | a pillanatkép frissítése (csak olvas): `node tools/hair-oldalak/salonic-pillanatkep.mjs`; `--ellenoriz`: összeveti a Salonic mostani adataival |
| `assets/css/hair-landing.css` | a közös stíluslap (a csomag színvilága: elefántcsont / homok / bronz / eszpresszó; Playfair Display + Jost, saját tárhelyről) |
| `assets/js/hair-landing.js` | galéria + nagyító, árlista-fülek, mobil sticky sáv, Google-értékelés, vélemények, térkép, legközelebbi szabad konzultáció, mérés (dataLayer) |
| `tools/hair-teszt/hair.test.mjs` | 32 teszt (statikus + böngészős, build nélkül): `PLAYWRIGHT_UTVONAL=<node_modules mappa> node --test tools/hair-teszt/hair.test.mjs` |

**Árváltozásnál:** `node tools/hair-oldalak/salonic-pillanatkep.mjs`, majd `node tools/hair-oldalak.mjs`, commit. A teszt figyelmeztet, ha a pillanatkép 30 napnál régebbi.

### Mit mutat az oldal, honnan jön

- **Árak, időtartamok, hajhosszak:** kizárólag a Salonic pillanatképből (ugyanaz, amit a foglaló mutat). Noel árai a Salonic-felirat szerinti **20% kedvezménnyel** (áthúzott listaár mellett).
- **Fotók:** csak a meglévő, valódi MOSAIC-fotók (`tools/content/<régi oldal>.json` blokk-sorszám szerint); generált / stock kép nincs. A mintaképeken látható arcok, vélemények, árak **nem** kerültek át (a csomag maga is jelzi, hogy a kép-helyek csak helykitöltők).
- **Vélemények:** a Google-értékelés (csillagok + darabszám) és a vélemény-csúszka a **Trustindex-widget aktuális adata** (az egész MOSAIC értékelése, nem csak a fodrászaté; kitalált szám nincs, hiba esetén a sáv rejtve marad). Betti oldalán a mostani oldalán lévő 4 valódi Google-vélemény képernyőmentés is szerepel.
- **Foglalás:** minden gomb a kész foglaló-motor linkje (`/foglalo-motor?business=hair[&staff=betti][&category=balayage][&service=konzultacio]`); a launcher a rétegben nyitja, JS nélkül a motor-oldalra visz. A fodrászt / kezelést a motor nem kérdezi újra (munkatárs-link, kategória-link).
- **Legközelebbi szabad konzultáció:** a Salonic naptár-API-jából (csak az éles tartományon kap választ: a Salonic CORS-a `www.mosaicheadspa.hu`-ra szól); a link `&start=<unix>`-szel a foglaló adatlapjára visz. Nincs adat → a sor rejtve marad.
- **Mérés:** a doc „Analytics contract”-ja szerinti `dataLayer`-események (`landing_view`, `service_selected`, `staff_selected`, `consultation_cta_click`, `gallery_interaction`, `price_view`; közös paraméterek: `landing_id`, `entry_intent`, `service`, `staff`, `source`, `medium`, `campaign`, `creative`, `cta_position`). A foglalási lépés-eseményeket (`booking_*`) a motor küldi, itt nem duplázzuk. Az `-uj` címek **nincsenek** a `suti.js` Meta-pixel listáján (nincs pixel); GTM-trigger nincs bekötve – ez az elemző dolga a csere előtt.

## Eltérések a csomagtól (szándékosak)

| Csomag / terv | Itt | Miért |
|---|---|---|
| 15 perces ingyenes konzultáció | **30 perces** | a Salonic szolgáltatása 30 perc („9.900 Ft helyett most 0 Ft”) |
| „4,9 ★ / 320+ vélemény” (minta) | élő Trustindex-adat | a doc QA: nincs kitalált értékelés |
| 4. fodrász (Dóri) a mintán | nincs | a Salonicban 3 fodrász foglalható (a doc is jelzi: „belső spec 4 fővel számol, a publikus oldal 3 nevet mutat”) |
| mintaárak (39 990 Ft stb.) | Salonic-árak | egységes árforrás |
| Noel „férfi hajvágás” a mintán / a régi táblában | nincs a Noel-oldalon | a Salonic szerint Noel nem vállalja (csak Betti és Evelin) |
| ELŐTTE/UTÁNA képpárok | nincsenek | nincs valódi előtte–utána pár a meglévő képek között; hamisat nem teszünk ki |

## Kihagyott állítások (a doc QA-szabálya: nincs 90/95/98%-os claim, nincs tapasztalati év, nincs kitalált értékelés)

A mostani Wixes oldalakon szerepel, **ide nem vettem át** (a tulajdonos döntheti el, hogy visszakerüljenek-e): Betti „18 év tapasztalat”, „több ezer festés”, „vendégeim 98%-a visszajár”; Noel „3 év”, „95%”; Evelin „4 év”, „90%”; a központi oldal „31 tapasztalati év”, „5,0 – Kiváló”, Noel „5,0 – 1.145 vélemény”; a lejárt „Szeptemberi akció”.

## Nyitott / ellenőrizendő

1. **A Salonic és a régi árlista eltér** (`assets/js/arlistak.js`, a Betti-tábla szolgálja ki a központi, a Betti és az Evelin oldalt): a „Teljes festés / korrekció” és a „Teljes melír / airtouch” sora **fel van cserélve** (a Salonic: teljes festés 32 950 / 39 950 / 44 950 / 48 950 Ft; teljes melír 39 950 / 47 950 / 60 950 / 64 950 Ft), a „Teljes szőkítés” a régi táblában 1000 Ft-tal olcsóbb. Az új oldalak a Salonic-árat mutatják. A régi tábla javítása nem része ennek a PR-nak.
2. **Salonic-beállítások, amik furcsák:** Betti a „Teljes szőkítés”-t csak extra hosszú hajra, a „Teljes festés”-t hosszú hajra nem vállalja (a Salonicban nincs hozzárendelve); Noel nem vállal férfi hajvágást. Ha ez hiba, a Salonicban kell javítani, az oldal követi (pillanatkép-frissítés).
3. **Noel 20%-a** a Salonic-feliratból jön („Noel - 20% kedvezmény!”); ha megszűnik, a Salonicban a felirat változik, és a pillanatkép-frissítés kiveszi az oldalról.
4. **Mit mutassunk a Google-sávon?** Most a MOSAIC egészének értékelése (Head Spa-vendégek is benne vannak). Ha lesz hajas-specifikus Trustindex-widget, a `hair-landing.js` `TI` állandóját és a `data-forras` címet kell cserélni.
5. **Nincs 5. oldal a „balayage” belépéshez** (a csomag `#/balayage` állapota): a mostani `/balayage-haj-festes-budapest` Noel oldala; külön balayage-landing külön kérésre.
6. **A fejléc/lábléc** a MOSAIC közös (Wixes) fejléce/lábléce; a minták egyszerűbb, fehér fejléce nincs átvéve (a menü egységes az egész oldalon).
7. A csere (átnevezés az eredeti címre, régi oldalak `-regi`-ként, `-uj` 301, `tools/lcp-elofeltoltes.json`, a `suti.js` pixel-lista és a GTM-triggerek egyeztetése az elemzővel) külön lépés.
