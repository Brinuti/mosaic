# Egyéni Head Spa landing = a Head Spa AKCIÓ oldal (`/head-spa-kedvezmeny`)

**2026-10-09 óta ez az oldal az akció oldal** (a tulajdonos döntése: a régi, gyenge akció oldal helyére került; `noindex`, mint a régi akció oldal). Eredetileg `/egyeni-headspa-budapest-uj` néven készült (301 átirányít ide),
a tulajdonos képterve alapján, a páros / lézeres / oxigén landingek szerkezetében, betűivel és színeivel (Playfair Display + Jost, arany gombok, sötétzöld hangsúly),
**minden képhelyen mozgóképpel** a szalon valódi felvételeiből. A régi (Wixes) akció oldal rejtett címen: `/head-spa-kedvezmeny-regi` (noindex); az előző, újrastílusú akció oldal a git előzményeiben van.

**Közös videós hero (2026-10-09):** a hero szabályai és a hero-JS (háttér-klip lusta indulása, play gomb + nagy lejátszó-ablak, csökkentett mozgás / lassú kapcsolat) a **közös** `assets/css/video-hero.css` / `assets/js/video-hero.js` fájlokba költöztek (a főoldal és a páros oldal is ezt használja): `docs/VIDEOS_HERO.md`. Az oldal saját CSS-ében / JS-ében hero-szabály már nincs; a hangos videók gombjai `data-nagyvideo` attribútumot kapnak (a felugró ablakot a közös JS hozza létre, a HTML-ben nincs `<dialog>`).
Finomítások: a hero ára kisebb (48 → 42 px asztalon, 36 → 32 px telefonon); telefonon a három jelvény egy sorban („50+30 perc”, „Profi hajszárítás”, „Személyre szabott”; ikon felül); a play gomb kisebb (78 → 62 px asztalon, 54 → 52 px telefonon); az időpont-szekcióból a „valós időben a MOSAIC naptárából jönnek…” sor kikerült, telefonon kompaktabb (3 időpont naponta + „+N”, kisebb választó-kártyák); **előre / vissza nyíl** (`#napok-elozo` / `#napok-kov`) asztalon és telefonon is: az elején a visszanyíl letiltva (halvány), a végén az előrenyíl.

**Az akcióhoz tett változtatások (2026-10-09):**
- **Akciós blokk** (`#akcio`, a hero alatt; telefonon az időpont-szekció után): „Októberi akció – 20% kedvezmény minden Head Spa szeánszra!”, a régi akció oldal szövege („Az akció részletei”, „visszavonásig tart”), áthúzott listaárak (egyéni 32 900 → 26 900 Ft, páros 65 900 → 53 800 Ft). A hero is mutatja az áthúzott árat és „Októberben 20% kedvezménnyel”.
- **Egyéni / Páros választó** (`#valtozat`, a „Mire helyezzük inkább a hangsúlyt?” csempék helyén; a Relax / Hair csomag megszűnt): két kártya mozgó videóval (`ajandek-kezeles-egyeni.mp4`, `paros-hero-barat.mp4`), alatta rádiógomb. A választás átváltja az ajánlat-panelt (egyéni / páros ár és „Mit tartalmaz”), a szabad időpontokat (**páros: Salonic `302999`**, egyéni: `302342` + `302499` uniója) és a foglaló-linkeket (`service=egyeni` / `service=paros`). A lekért időpontok változatonként gyorsítótárban vannak. `?tipus=paros` a páros változatot választja alapból (hirdetéshez). Mérés: `egyeni_landing_cta` esemény `cta: valtozat-egyeni|paros`.
- Elírás javítva: „Páróddal” → „Pároddal”.
- **Az akció lejártakor** igazítandó: az `#akcio` blokk, a hero „20% októberi kedvezménnyel” sora és áthúzott ára, a választó kártyáinak áthúzott árai, az ajánlat-panelek „Októberben 20% kedvezménnyel” sora, a `<title>` / meta leírás.
- Mérés / csere: az útvonal ugyanaz, mint a régi akció oldalé (`/head-spa-kedvezmeny`), ezért a `suti.js` pixel-listája (`PIXEL_HEADSPA`) érvényes rá; a régi oldal Wix-azonosítós GTM-triggerei (gombkattintások) az új oldalon nem léteznek – az elemzővel egyeztetendő. LCP-előtöltés: `/assets/img/ajandek/hero.jpg` (`tools/lcp-elofeltoltes.json`).

| Fájl | Szerepe |
|---|---|
| `foglalas/head-spa-kedvezmeny.html` | az oldal (fejléc / lábléc a build-ből: `<!--mh-fejlec-->`, `<!--mh-lablec-->`, `<!--mh-menu-aktiv:/head-spa-kedvezmeny-->`) |
| `assets/css/egyeni-landing.css` | önálló stíluslap (a többi landing stílusát nem érinti); a hero szabályai a közös `video-hero.css`-ben |
| `assets/css/video-hero.css`, `assets/js/video-hero.js` | a KÖZÖS videós hero (a főoldallal és a páros oldallal közös): `docs/VIDEOS_HERO.md` |
| `assets/js/egyeni-landing.js` | szabad időpontok (Salonic-API, előre / vissza nyíl), Trustindex, mobil sticky CTA, pontok, mérés (a mozgóképek és a hangos videók ablaka a közös `video-hero.js`-ben) |
| `assets/video/egyeni-*.mp4`, `assets/img/egyeni/*.jpg` | a kivágott, hang nélküli ismétlő-klipek (7 db, ~1 MB) és a klipek nyitóképei |
| `tools/egyeni-videok.mjs` | a klipek / nyitóképek újragyártása a meglévő felvételekből (`FFMPEG=<ffmpeg> node tools/egyeni-videok.mjs`; a build nem használja) |
| `tools/egyeni-teszt/egyeni.test.mjs` | böngészős tesztek (22 db, nincs `dist/`, nincs külső hálózat): `node --test tools/egyeni-teszt/egyeni.test.mjs` |

## Szekciók (asztalon, a terv sorrendjében)

Hero („80 perc, amikor végre semmi dolgod nincs.”, 26 900 Ft, jelvények, „Foglalok magamnak”, ajándékkártya-link, Google-sor, cím, **„Nézd meg, milyen érzés (0:38)”** hangos videó) → **Milyen érzés?** (3 mozgóképes kártya) →
sötét sáv **Nehéz elmagyarázni. Könnyebb megmutatni.** (Zsóka vendégvideója, eredeti hanggal) → **Mi történik a 80 percben?** (5 lépés) → sötét sáv **Nem nekünk kell elmondanunk, milyen.** (élő Trustindex-vélemények + 4 vendégvideó) →
**Válaszd ki az időpontodat** (ajánlat + „Mire helyezzük a hangsúlyt?” + szabad időpontok) → sötét sáv **Nem magadnak keresed?** (ajándékkártya) → **Mitől más nálunk a Head Spa?** (4 kártya) → sötét sáv **Még sosem voltál Head Spán? Tökéletes.** →
**Inkább ketten élnétek át?** (a páros oldalra visz) → **GYIK** (8 kérdés) + helyszín-kártya → záró sáv **Adj magadnak 80 percet.**
**Telefonon**: hero (felül a kép / mozgókép, alatta a szöveg) → szabad időpontok → Milyen érzés? → … (a páros landing mintájára; a `main` flex-oszlop, `order`), alul sticky „Szabad időpontok” sáv (a hero gombjának elgörgetése után jön be, amíg az időpont-szekció a képernyőn van, nem látszik).
A fejlécet / láblécet a közös build adja (nem a terv saját, egyszerűsített fejléce). A fejléc rózsaszín akciós sávja ezen az oldalon rejtett. Nincs felcím (arany cím a főcím felett) sehol.

## Mozgóképek

A felvételek a szalon meglévő videóiból valók (az `assets/video` mappa 72 videóját végignéztem; a hirdetési reelek feliratosak / záróképesek, ezeket nem használtam). Két fajta van:

- **Hang nélküli ismétlő-klipek** (`video[data-klip]`, `muted loop playsinline`): a hero, a „Milyen érzés?” kártyák, a lépések, a sávok háttere stb. Csak akkor töltődnek be és játszanak, amikor a képernyőn vannak (IntersectionObserver); a nyitókép (`poster`) addig látszik.
  A hero-klip az oldal betöltése (`load`) után indul és beúszik a statikus hero-kép (az LCP-kép) fölé. **Csökkentett mozgás** (`prefers-reduced-motion`) vagy **adattakarékos / lassú kapcsolat** esetén egy klip sem töltődik be, csak a nyitóképek látszanak (teszt védi).
  A 7 új klip (`egyeni-*.mp4`, 0,8-1,2 MB) a meglévő felvételekből vágott, hang nélküli szakasz; a többi klip az eredeti fájl (0,5-2,5 MB).
- **Hangos vendégvideók** (`[data-video]`): gombra, felugró ablakban (`<dialog>`) nyílnak, vezérlőkkel; a fájl csak ekkor töltődik be. A hero „Nézd meg, milyen érzés” gombja a szalon 38 mp-es hangulatvideóját nyitja, Zsóka / Zita / Kinga / Dóri / Szandi a valódi vendégvideók (keresztnévvel, ugyanazok, mint az ajándékkártya-oldalon).

## Szabad időpontok (`#szabad-idopontok`)

A Salonic nyilvános naptár-API-ja (`https://api.salonic.hu/calendar/getAvailableTimes`), ugyanaz a forrás, mint a páros / lézeres / PMU landingen: `placeId=10427` (MOSAIC Head Spa), `employeeId=-1`, `calendarId=ebf1c485-…` (ha megváltozik, a kód újra kiolvassa a Salonic oldaláról).
Az Egyéni kezelésnek két Salonic-változata van (`302342` „Relax”, `302499` „Hair”; azonos kezelők, azonos ár: 26 900 Ft, 80 perc), a foglaló-motor a kettő időpontjainak **unióját** mutatja, az oldal is: két lekérdezés, az egyesített lista;
ha csak az egyik válaszol, annak az időpontjai látszanak. A legközelebbi szabad napok oszlopokban (asztalon és telefonon is 3 látszik, a nyíl lapoz), naponta 4 időpont (a nap folyamán szétosztva), a „+N időpont” kinyitja a nap összes időpontját.
Egy időpontra kattintva a helyben nyíló foglaló-motor nyílik az Egyéni szolgáltatással és az időbélyeggel: `/foglalo-motor?business=headspa&service=egyeni&start=<unix>` (rögtön a foglalási űrlapot mutatja; részletek: `docs/booking-engine/BOOKING_LAYER.md`).
A „Még több időpont” a `/foglalo-motor?business=headspa&service=egyeni` címre visz.

**Időpontot nem találunk ki.** Ha az API nem válaszol, az éles domainen hibaüzenet + a foglaló linkje látszik. **Csak az előnézeten** (`*.pages.dev`, `localhost`) jelennek meg **MINTA időpontok**, „MINTA időpontok” felirattal; az éles `www.mosaicheadspa.hu` domainen ez soha nem fut le (teszt védi).

## Ami a mockuphoz képest szándékosan más (nincs kitalált adat)

- **Képek / videók:** a szalon valódi felvételei, nem a mockup MI-generált képei.
- **Vélemények:** a mockup három kitalált idézete („Kata”, „Eszter”, „Dóri”) helyett az élő Trustindex-vélemények (azonnal, hozzájárulás nélkül, a tulajdonos 2026-10-07-i kérése szerint), mellette a valódi vendégvideók. A „ötcsillagos értékelés” szöveg is kimaradt (az átlag 4,9, nem minden vélemény öt csillagos): „valódi vendégvélemény”.
  A szám az élő Trustindex-adat (tartalék érték: 1 257), a „4,9” a tulajdonos megadott értéke.
- **„Mire helyezzük inkább a hangsúlyt?”:** két tájékoztató csempe (nem választó): a foglalás ettől nem változik (a motor az Egyéni „Relax” és „Hair” változatát egy szolgáltatásként kezeli, ugyanaz az ár, ugyanazok a kezelők), a szalon árlistája szerint a hajkamerás diagnosztika és konzultáció „igény szerint” jár a kezeléshez.
- **Nyitvatartás:** a mockup „H–Szo 9:00–20:00” helyett a szalon valódi nyitvatartása (H–Szo 8:00–20:00, vasárnap zárva (a szombat 2026-10-07 óta 8–20, a tulajdonos kérésére)).
- **Cím:** „1023 Budapest, Bécsi út 2. (Kolosy tér)”, a mockup „II. kerület” szövege nélkül (a régi oldalak „3rd district” és „II. kerület” között ellentmondanak; a tulajdonos döntse el, ha kell).
- **Ár:** 26 900 Ft (a Salonic szerinti ár: a listaár 32 900 Ft, az októberi 20%-os kedvezménnyel 26 900 Ft). Az oldal a listaárat és az „októberi” szót nem tünteti fel (mint a mockup), hogy az akció végén ne maradjon elavult szöveg; az ár a HTML-ben van (hero, ajánlat, záró gomb).
- **„Mit tartalmaz pontosan?”:** a szalon árlista-oldalának szó szerinti listája (`foglalas/headspa-arak-budapest.html`).
- **GYIK-válaszok:** a meglévő tartalomra épülnek (a Head Spa cikk, az árlista, a páros oldal GYIK-ja), de **a tulajdonosnak ellenőrizni kell** (különösen: „Festett hajjal is jöhetek?”, „Hosszú hajjal is működik?”, „Kell közben beszélgetni?”,
  „Mi történik, ha érzékeny a fejbőröm?”: ezek a mockup kérdései, a régi oldalon nincs rájuk kimondott válasz; a fejbőr-válasz a régi angol oldal trichológus-tanácsára épül).
- A „Inkább ketten élnétek át?” a meglévő, élő `/paros-headspa-budapest` oldalra visz (nem az `-uj` változatra).
- Az ajándékkártya-linkek a `/headspa-ajandekkartya` oldalra mutatnak; az ajándékkártyás foglalás a `/foglalo-motor?business=headspa&voucher=1` belépő.

## Mérés

Az oldal `data-cta` nevei: `egyeni_landing_cta` esemény a `dataLayer`-be (mint a páros oldalon: `paros_landing_cta`), `egyeni_landing_video` a hangos videókra. A GTM-ben ezekhez még nincs trigger, így hatásuk nincs. A `suti.js` pixel-listája útvonal-alapú: a `-uj` címen az oldal nem kap mérőkódot,
az eredeti címen (csere után) az ottani útvonalra érvényes lista dolgozik (nem módosítottam). A foglalás mérése a foglaló-motoré (`booking_*` események).

## Csere az eredeti címre (csak kifejezett kérésre)

Mint a páros / lézeres / oxigén oldalnál (`docs/PAROS_LANDING.md`, `docs/LEZERES_LANDING.md`, `docs/HEADSPA_OLDALAK.md`):
1. Eldönteni, melyik régi oldal helyére kerül (pl. a Wixes `/headspa-10szazalek-kedvezmennyel`); `git mv foglalas/egyeni-headspa-budapest-uj.html foglalas/<eredeti-nev>.html` (a `foglalas/*.html` felülírja a `klon/<eredeti-nev>.html` fájlt); a `canonical` és `og:url` az eredeti címre, a `<!--mh-menu-aktiv:…-->` az eredeti menüpontra; a `noindex, nofollow` kivétele.
2. A régi Wixes változat rejtett címre: `klon/<eredeti-nev>.html` + `klon/m/<eredeti-nev>.html` → `…-regi.html` (noindex, saját canonical); az `-uj` cím 301-gyel az eredetire (`netlify/lib/utvonal.js`, `ATIRANYITASOK`).
3. `tools/lcp-elofeltoltes.json`: az oldal régi LCP-soraiból az új hero-kép (`/assets/img/ajandek/hero.jpg`) beírása (mobil + asztali), a régi sor cseréje.
4. A teszt (`tools/egyeni-teszt/egyeni.test.mjs`) `OLDAL` állandója, a cím- / canonical- / noindex-ellenőrzés igazítandó.
5. A régi oldal GTM-triggereit (Wix-azonosítós gombok) csere előtt az elemzővel ellenőrizni.
