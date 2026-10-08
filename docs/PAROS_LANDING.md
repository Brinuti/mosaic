# Páros Head Spa landing (`/paros-headspa-budapest-uj`)

A tulajdonos képterve alapján újraépített páros Head Spa oldal, a lézeres / oxigén / sminktetováló landingek szerkezetében, betűivel és színeivel (Playfair Display + Jost, arany gombok,
sötétzöld hangsúly, krém háttér). **Ideiglenes címen él**: `/paros-headspa-budapest-uj` (`noindex, nofollow`, saját canonical, sehonnan nincs rá link, nincs a sitemapben). A régi, Wixes
`/paros-headspa-budapest` oldal (`klon/paros-headspa-budapest.html`) változatlanul él; a csere az eredeti címre csak kifejezett kérésre történik (lásd lent).

| Fájl | Szerepe |
|---|---|
| `foglalas/paros-headspa-budapest-uj.html` | az oldal (fejléc / lábléc a build-ből: `<!--mh-fejlec-->`, `<!--mh-lablec-->`, `<!--mh-menu-aktiv:/paros-headspa-budapest-->`) |
| `assets/css/paros-landing.css` | önálló stíluslap (a többi landing stílusát nem érinti) |
| `assets/js/paros-landing.js` | hero-videó, szabad időpontok (Salonic-API), páros Google-vélemények, vendégvideók, Trustindex, mobil sticky CTA, képsor-pontok |
| `assets/img/paros/`, `assets/video/paros-hero-barat.mp4` | a szalon valódi páros felvételeiből vágott képek és a hero mozgó videója (lásd lent) |
| `tools/paros-teszt/paros.test.mjs` | böngészős tesztek (21 db, nincs `dist/`, nincs külső hálózat): `node --test tools/paros-teszt/paros.test.mjs` |

## Szekciók (asztalon, a terv sorrendjében)

Oldal-menü (a terv felső sávja: „Páros HeadSpa” · Az élmény · Vélemények · Mit tartalmaz? · GYIK · Ajándékkártya · Szabad időpontok gomb; a fejléc alatt ragad, telefonon rejtett) →
Hero (**mozgó videó** a páros kezelőből, H1, ár 53 800 Ft / 2 fő, „Megnézem a szabad időpontokat”, ajándékkártya-link, Google-értékelés sor, 3 jelvény) → **Kivel jönnél?** (4 kártya valódi fotóval) →
**Ők már kipróbálták ketten.** (3 valódi páros Google-vélemény idézve + a vendégvideók + a Trustindex-vélemények) → **Így telik a közös HeadSpa élmény** (5 lépés, számozott fotókkal) →
fotóhátteres sötét sáv („Nem két külön kezelés… Egy közös élmény.”) → **Ajánlat** (53 800 Ft, „Tartalmazza” lista, fotó) → **Legközelebbi szabad Páros HeadSpa időpontok** → **Miért jönnek…** (6 csempe) →
**Valódi pillanatok** (3 kártya) → **GYIK** (12 kérdés).
**Telefonon** (a terv szerint): hero → szabad időpontok → Kivel jönnél? → … (a `main` flex-oszlop, `order`), a GYIK után csak mobilon látszik az ajándékkártya-doboz és a záró felhívás
(„Kivel kapcsolnál ki egy kicsit?”); alul sticky „Szabad időpontok” sáv (a hero gombjának elgörgetése után jön be, amíg az időpont-szekció a képernyőn van, nem látszik).

A fejlécet / láblécet a közös build adja (nem a terv saját, egyszerűsített fejléce): minden oldal fejléce egy helyről jön. A fejléc rózsaszín akciós sávja ezen az oldalon rejtett (mint a lézeres / oxigén landingen).
Nincs felcím (arany cím a főcím felett) sehol (a tulajdonos korábbi kérése).

## Hero-videó és képek (a szalon valódi felvételei, 2026-10-07)

A tulajdonos kérésére (az első változat „puritán” volt) a Drive-ból és a közösségi oldalakról a legjobb valódi páros felvételek kerültek az oldalra (a Drive kapcsolat a deakfi@grantis.hu fiókot éri el):
- **Hero (mozgó videó, 2026-10-08 óta mint a főoldalon):** a páros ajándékkártya mozgó videója (két vendeg pohárral koccint, `paros-hero-barat.mp4`, 720×540, **yuv420p**, ~370 KB, hang nélküli, ismétlődő), asztalon a hero jobb oldalán (a szöveg felé halványodó éllel), telefonon **felül**, a cím alatta teljes szélességben. Poszter: `assets/img/paros/hero-barat.jpg` (azonnal látszik; a videó a betöltés után indul). A régi széles / álló montázs (`paros-hero-asztal.mp4`, `paros-hero-mobil.mp4`) kikerült (az `og:image` a `hero-asztal.jpg` maradt). **Fontos:** a videó pixelformátuma yuv420p legyen; a yuv444p-t a telefonok nem játsszák le (ez volt az oka, hogy telefonon nem indult). Nem töltődik csökkentett mozgásnál, adatspóroló módban és 2G-n; ha a hero kikerül a képernyőről, megáll. Színek: a zöldes MOSAIC-tónus (`#f3f4ef`), H1 47 px / 1,06 (mint a sminktetoválás / főoldal).
- **Kivel jönnél? / Valódi pillanatok:** barátnők (a „Páros csajos érzelmes / márciusi páros” videó képkockái), anya-lánya (az „Anya-lánya” videó), pár (a „Páros kezelés” videó vendégpárja a váróban). Az ajándékkártya-kártya az ajándékkártya-oldal fotója.
- **Lépések, ajánlat, időpont-kártya:** a páros kezelő nyers felvételeiből kimetszett képek (`lepes-egyszerre`, `lepes-50perc`, `ajanlat-kep`, `ido-kep`); az 1. és 2. lépés (váró, fejbőrkamera) a meglévő szalonfotók.
- - A Trustindex-vélemény szövegéből a JS kiveszi a csatolt képet és a "+0" képszámlálót (hiba volt: "+0Isteni élmény…"; teszt védi).
- Az Instagram (@mosaicheadspa) bejelentkezés nélkül nem nézhető; a Facebook-oldal (Mosaic Headspa and Hair) fotói nagyrészt grafikák / kezelő-portrék, páros kezelés nincs közöttük: a Drive felvételei jobbak voltak.
- Az éles `.mp4` fájlok forrása a Drive (nyers felvételek); újravágás: ffmpeg (`crop` + `scale` + `xfade`), a lépések a PR-leírásban.

## Szabad időpontok (`#idopontok`)

A Salonic nyilvános naptár-API-ja (`https://api.salonic.hu/calendar/getAvailableTimes`), ugyanaz a forrás, mint a lézeres / PMU landingen:
`placeId=10427` (MOSAIC Head Spa), `serviceId=302999` („PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)”: 53 800 Ft, 80 perc; `docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json`),
`employeeId=-1`, `calendarId=ebf1c485-…` (ha megváltozik, a kód újra kiolvassa a Salonic oldaláról). A legközelebbi szabad napok oszlopokban (asztalon 5, telefonon 3 látszik, a nyíl lapoz),
naponta 4 időpont (a nap folyamán szétosztva), a „+N időpont” kinyitja a nap összes időpontját. Egy időpontra kattintva a helyben nyíló foglaló-motor nyílik a Páros szolgáltatással és az
időbélyeggel: `/foglalo-motor?business=headspa&service=paros&start=<unix>` (a motor kihagyja a naptárat, rögtön a foglalási űrlapot mutatja; részletek: `docs/booking-engine/BOOKING_LAYER.md`).
A „További foglalható időpontok” a `/foglalo-motor?business=headspa&service=paros` címre visz.

**Időpontot nem találunk ki.** Ha az API nem válaszol, az éles domainen hibaüzenet + a foglaló linkje látszik. **Csak az előnézeten** (`*.pages.dev`, `localhost`), ahol a Salonic CORS-a miatt a valódi időpontok nem töltődnek be,
jelennek meg **MINTA időpontok**, „MINTA időpontok” felirattal (hogy a kinézet megítélhető legyen); az éles `www.mosaicheadspa.hu` domainen ez soha nem fut le (teszt védi).

## Ami a mockuphoz képest szándékosan más (nincs kitalált adat)

- **Képek / videó:** a szalon valódi felvételei (lásd fent), nem a mockup MI-generált képei.
- **„Ők már kipróbálták ketten.”:** a mockup három párjának videója és idézete („Dóra és Fanni”, „Kata és Lili”, „Anna és Péter”) nem létezik. Helyette **három valódi, a páros kezelésről szóló Google-vélemény** áll szó szerint idézve (a névvel és a dátummal;
  az éles oldalon a JS a Trustindex-widget aktuális adataiból a legújabb három, magyar nyelvű, 5 csillagos, „páros / párban” szót tartalmazó véleményre frissíti, a HTML-ben a 2026.09.-i három a tartalék), alatta a szalon valódi vendégvideói
  (`ajandek-vendeg-zsoka/zita/kinga/dori.mp4`, keresztnévvel; ugyanazok, mint az ajándékkártya-oldalon, nem állítják, hogy párok). Utána a Trustindex-vélemények (azonnal, hozzájárulás nélkül, a tulajdonos 2026-10-07-i kérése szerint).
- **Értékelés:** „4,9 Google · N+ vendégvélemény”: az N a Trustindex-widget aktuális adata (tartalék érték: 1 257), a „4,9” a tulajdonos megadott értéke (mint a lézeres oldalon).
- **Ár:** 53 800 Ft / 2 fő, 26 900 Ft / fő (a Salonic szerinti ár; az októberi 20%-os kedvezmény listaára 65 900 Ft, ezt a terv nem mutatja, nem is tüntettem fel). Ha az akció véget ér, a Salonic-ár változik: az oldalon az ár a HTML-ben van (hero, ajánlat, időpont-oldalkártya, záró felhívás).
- **GYIK-válaszok:** a meglévő tartalomra épülnek (a régi páros oldal, a Head Spa cikk, az ajándékkártya GYIK), de **a tulajdonosnak ellenőrizni kell** (különösen: „Kell frissen mosott hajjal érkezni?”, „Beszélgethetünk kezelés közben?”,
  „Lehet sminkben érkezni?”, „Mi történik, ha módosítanánk az időpontot?”): ezek a mockup kérdései, a régi oldalon nincs rájuk kimondott válasz.
- **Tartalmazza-lista:** a régi páros oldal és a Salonic-szolgáltatás leírásából (mélytisztító hajmosás, körvízsugaras terápia, OXYGENI hajpakolás, arctisztítás, radírozás, tonizálás, méregtelenítő arcpakolás, masszázsok, gőzterápia, pezsgő, 30 perc hajszárítás).
- Az ajándékkártya-linkek a `/headspa-ajandekkartya?variant=friend` oldalra mutatnak (a „friend” változatban a Páros termék áll elöl).

## Mérés

Az oldal `data-cta` nevei: `paros_landing_cta` esemény a `dataLayer`-be (mint az oxigén oldalon: `oxigen_landing_cta`), `paros_landing_video` a videókra. A GTM-ben ezekhez még nincs trigger, így hatásuk nincs. A `suti.js` pixel-listája
útvonal-alapú: a `-uj` címen az oldal nem kap mérőkódot, az eredeti címen (csere után) a `paros-headspa-budapest` útvonalra érvényes lista dolgozik (nem módosítottam). A foglalás mérése a foglaló-motoré (`booking_*` események).

## Csere az eredeti címre (csak kifejezett kérésre)

Mint a lézeres / oxigén oldalnál (`docs/LEZERES_LANDING.md`, `docs/HEADSPA_OLDALAK.md`):
1. `git mv foglalas/paros-headspa-budapest-uj.html foglalas/paros-headspa-budapest.html` (a `foglalas/*.html` felülírja a `klon/paros-headspa-budapest.html` fájlt); a `canonical` és `og:url` az eredeti címre; a `noindex, nofollow` kivétele.
2. A régi Wixes változat rejtett címre: `klon/paros-headspa-budapest.html` + `klon/m/paros-headspa-budapest.html` → `…-regi.html` (noindex, saját canonical); az `-uj` cím 301-gyel az eredetire (`netlify/lib/utvonal.js`, `ATIRANYITASOK`).
3. `tools/lcp-elofeltoltes.json`: az oldal régi LCP-sorainak kivétele (mobil + asztali), ha van.
4. A teszt (`tools/paros-teszt/paros.test.mjs`) `OLDAL` állandója, a cím-/canonical-/noindex-ellenőrzés igazítandó.
5. A régi oldal GTM-triggereit (Wix-azonosítós gombok) csere előtt az elemzővel ellenőrizni.
