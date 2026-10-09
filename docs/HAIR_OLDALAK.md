# Fodrászat-oldalak (központi + Betti + Noel + Evelin)

A **MOSAIC_Hair_implementation_v2** csomag (prototípus + hat látványterv-kép) alapján újratervezett fodrász-oldalak.
**2026-10-09 óta ÉLESEK az eredeti címeken** (a tulajdonos kifejezett kérése: „a fodrász oldalakat élesítheted”), indexelhetők, a sitemapben (a régi Wixes oldalak helyén) és a
`suti.js` pixel-listáján (`PIXEL_FODRASZ`) az eredeti címek szerepelnek. A régi (Wixes) oldalak rejtett `-regi` címen megvannak (`noindex`, saját canonical, nincs rájuk link, nincsenek a sitemapben),
az ideiglenes `-uj` címek 301-gyel az eredeti címre irányítanak (`netlify/lib/utvonal.js`). **Visszaállítás:** a `foglalas/<cím>.html` törlése (akkor a `klon/` alatti régi Wixes oldal áll vissza ugyanazon a címen;
a generátor `LAPOK`-ját és a tesztet is igazítani kell).

| Oldal | Eredeti (éles) cím | Régi Wixes oldal (rejtett) | Régi ideiglenes cím (301) | Fájl |
|---|---|---|---|---|
| Központi női fodrászat | `/noi-fodraszat-budapest` | `/noi-fodraszat-budapest-regi` | `/noi-fodraszat-budapest-uj` | `foglalas/noi-fodraszat-budapest.html` |
| Betti | `/noi-fodrasz-budapest-balayage-hajfestes` | `/noi-fodrasz-budapest-balayage-hajfestes-regi` | `/noi-fodrasz-budapest-balayage-hajfestes-uj` | `foglalas/noi-fodrasz-budapest-balayage-hajfestes.html` |
| Noel | `/balayage-haj-festes-budapest` | `/balayage-haj-festes-budapest-regi` | `/balayage-haj-festes-budapest-uj` | `foglalas/balayage-haj-festes-budapest.html` |
| Evelin | `/noi-hajfestes-budapest` | `/noi-hajfestes-budapest-regi` | `/noi-hajfestes-budapest-uj` | `foglalas/noi-hajfestes-budapest.html` |

**Csere-lépések (2026-10-09):** `foglalas/*-uj.html` → generátor az eredeti címre ír (noindex nélkül, canonical / og:url az eredeti cím); `klon/<cím>-regi.html` és `klon/m/<cím>-regi.html` a régi oldalakból
(noindex + saját canonical / og:url); `-uj` → 301 (`utvonal.js`); `tools/lcp-elofeltoltes.json`: a 4 cím régi LCP-előtöltése kikerült (az új oldalak maguk előtöltik a hero-képet); `tools/gyik-oldal.mjs` és
`tools/arlista-teszt` az új fájlnevekre mutat. **Mérés:** a régi Wixes oldalak GTM-triggerei (gombkattintások Wix-azonosítóval) az új oldalakon nem léteznek; az új oldalak `dataLayer`-eseményeket küldenek
(lásd „Mérés”) – a GTM-trigger bekötése az elemző dolga.

## Felépítés (egy adatforrás, egy komponens-rendszer)

Az oldalak **generáltak** – kézzel ne szerkeszd őket (a teszt ellenőrzi, hogy a fájl egyezik a generátor kimenetével):

| Fájl | Szerepe |
|---|---|
| `tools/hair-oldalak.mjs` | a generátor: `node tools/hair-oldalak.mjs` (írja a 4 oldalt), `--ellenoriz` (csak összevet) |
| `tools/hair-oldalak/adat.mjs` | a közös adatmodell: fodrászok (szövegek, specializációk), szolgáltatás-csoportok, árlista, **valódi fotók** (a régi oldalak képei, blokk-sorszám szerint), formázás |
| `tools/hair-oldalak/sablon.mjs` | a szekciók HTML-sablonjai (központi oldal, fodrász-oldal) |
| `tools/hair-oldalak/salonic-hair.json` | **a Salonic pillanatképe**: szolgáltatások, hajhosszak, időtartamok, árak, ki mit vállal, a fodrászok és kedvezményeik |
| `tools/hair-oldalak/salonic-pillanatkep.mjs` | a pillanatkép frissítése (csak olvas): `node tools/hair-oldalak/salonic-pillanatkep.mjs`; `--ellenoriz`: összeveti a Salonic mostani adataival |
| `assets/css/hair-landing.css` | a közös stíluslap (2026-10-09 óta a MOSAIC zöldes színvilága és a többi landing gombjai: krém `#f3f4ef`, sötétzöld `#0f3a3c`, arany átmenetes pill-gomb; Playfair Display + Jost, saját tárhelyről) |
| `assets/js/hair-landing.js` | galéria + nagyító, lapozható hero-képgaléria (központi oldal), árlista-fülek, mobil sticky sáv, Google-értékelés, vélemények, térkép, legközelebbi szabad konzultáció, mérés (dataLayer; a videók indításáról `video_play`) |
| `tools/hair-teszt/hair.test.mjs` | 52 teszt (statikus + böngészős, build nélkül): `PLAYWRIGHT_UTVONAL=<node_modules mappa> CHROME_UTVONAL=<chrome> node --test tools/hair-teszt/hair.test.mjs` |

**Árváltozásnál:** `node tools/hair-oldalak/salonic-pillanatkep.mjs`, majd `node tools/hair-oldalak.mjs`, commit. A teszt figyelmeztet, ha a pillanatkép 30 napnál régebbi.

### Mit mutat az oldal, honnan jön

- **Árak, időtartamok, hajhosszak:** kizárólag a Salonic pillanatképből (ugyanaz, amit a foglaló mutat). Noel árai a Salonic-felirat szerinti **20% kedvezménnyel** (áthúzott listaár mellett).
- **Fotók:** csak a meglévő, valódi MOSAIC-fotók (`tools/content/<régi oldal>.json` blokk-sorszám szerint); generált / stock kép nincs. A mintaképeken látható arcok, vélemények, árak **nem** kerültek át (a csomag maga is jelzi, hogy a kép-helyek csak helykitöltők).
- **Vélemények:** a Google-értékelés (csillagok + darabszám) és a vélemény-csúszka a **Trustindex-widget aktuális adata** (az egész MOSAIC értékelése, nem csak a fodrászaté; kitalált szám nincs, hiba esetén a sáv rejtve marad). Betti oldalán a mostani oldalán lévő 4 valódi Google-vélemény képernyőmentés is szerepel.
- **Foglalás:** minden gomb a kész foglaló-motor linkje (`/foglalo-motor?business=hair[&staff=betti][&category=balayage][&service=konzultacio]`); a launcher a rétegben nyitja, JS nélkül a motor-oldalra visz. A fodrászt / kezelést a motor nem kérdezi újra (munkatárs-link, kategória-link).
- **Legközelebbi szabad konzultáció:** a Salonic naptár-API-jából (csak az éles tartományon kap választ: a Salonic CORS-a `www.mosaicheadspa.hu`-ra szól); a link `&start=<unix>`-szel a foglaló adatlapjára visz. Nincs adat → a sor rejtve marad.
- **Mérés:** a doc „Analytics contract”-ja szerinti `dataLayer`-események (`landing_view`, `service_selected`, `staff_selected`, `consultation_cta_click`, `gallery_interaction`, `price_view`; közös paraméterek: `landing_id`, `entry_intent`, `service`, `staff`, `source`, `medium`, `campaign`, `creative`, `cta_position`). A foglalási lépés-eseményeket (`booking_*`) a motor küldi, itt nem duplázzuk. A `suti.js` Meta-pixel listáján (`PIXEL_FODRASZ`) az eredeti címek szerepelnek, így az élesített oldalakon fut a pixel; GTM-trigger nincs bekötve az új eseményekhez – ez az elemző dolga.

## A tulajdonos észrevételei szerinti változtatások (2026-10-09, a 4 `-uj` oldal élesítése előtt)

- **Központi oldal, asztal:** a fodrász-kártyákon a név alatti szöveg egy soros (`kartyaSzoveg` az `adat.mjs`-ben), Noel kártyáján nincs „Jelenleg 20% kedvezménnyel” felirat (az árlista és az árlista fölötti Noel-megjegyzés változatlan); a „Haj / biztonság” felirat a kör közepén áll (ikon nélkül).
- **Szolgáltatások:** nincs hajvágás sehol a kártyákon / hero-ban / GYIK-ben / meta-szövegekben (az **árlista változatlan**, benne a hajvágás-fül is). A négy központi kártya: Balayage, Hajfestés (teljes festés ára), **Tőfestés** (új, a foglalóban a Hajfestés kategóriát nyitja), Ingyenes konzultáció. A fodrász-oldalakon: Balayage, Hajfestés, Tőfestés, Joico (Evelinnél póthaj marad).
- **Hero (központ):** három badge (Bécsi út 2. · Kolosy tér / Organikus hajfesték / Ingyenes konzultáció), másodlagos gomb „Ingyenes konzultáció”; lapozható képgaléria (5 valódi vendégmunka; asztalon nyilak + pontok, telefonon ujjal húzható).
- **Gombok és színek:** pontosan a többi landing gombjai (arany átmenetes elsődleges fehér szöveggel, hover zöld; körvonalas másodlagos sötétzölddel, pill alak); a krémes / barnás színek helyett a zöldes MOSAIC-árnyalatok mindenhol.
- **Mobil (900 px alatt) hero:** főcím → képek → alcím sorrend (a `.hero-szoveg` `display: contents`, a sorrendet CSS `order` adja), nincs eyebrow-felirat, a hero (az első gombbal együtt) elfér egy 390×844 (és 360×740) képernyőn. A fodrász-oldalakon: eredeti főcím, „Festés, balayage” (fodrászonként `alcim`), idézet, két blokk (`blokkok`), „Legközelebbi szabad konzultáció” sor, gombok.
- **Fodrász-oldalak:** H1 = a régi (Wixes) oldal eredeti címe (`h1` az `adat.mjs`-ben; Betti: „Tökéletes festés és vágás 18 év tapasztalattal.”, Noel: „Természetes hatású festés és vágás 3 év tapasztalattal.”, Evelin: „Végre olyan frizurád lesz, amilyet megálmodtál!”) – a tulajdonos kérésére, ezek az egyetlen helyek, ahol tapasztalati év szerepel; nincs „női fodrász Budapesten” alcím; nincs „Ismerd meg a többieket” doboz; nincs Noel „Munka közben” képsora.
- **Konzultációs videók** (a régi oldalakon is ott voltak, a „Fodrászt váltani nagy döntés. Ingyenes konzultációval várlak!” rész mellett): fodrász-oldalon a bemutatkozás mellett (Betti, Noel, Evelin saját videója), a központi oldalon a „Nem kell tudnod…” szakaszban (Betti + Evelin). Natív vezérlők, poszterkép, `preload="none"` (kattintásra indul, hanggal).
- **Térkép alatti képek:** a fodrászat saját helyisége (tükrös fodrászhelyek, Betti régi oldalának 80–82. blokkja); a Head Spa-s váró / recepció képei nem kerülnek ide. Több fotó: a Drive „Fodrászat” mappáiban vannak telefonos HEIC-képek, de szalon-belső nincs külön jelölve; ha a tulajdonos küld / jelöl ki, a `KEPEK.szalon` listába kerülnek.

## 2. kör (2026-10-09 délután, a tulajdonos újabb észrevételei)

- **Mobil hero:** a kép **négyzetes** (a fejek ne lógjanak ki; a galéria fejtető-közeli kivágással), a hero-ban a fold csak az első gombig (Mutasd a szabad időpontokat / <név> időpontjai) tart – ami alatta van, az lejjebb is lehet. A központi oldalon a 4 elemű bizalmi rács (Google-vélemények, Bécsi út 2., Valódi munkák, Ingyenes konzultáció) mobilon **nincs**.
- **Fodrász-oldalak, mobil:** főcím = „Festés, balayage, tőfestés a te stílusodban” (Noel: „Balayage, festés, tőfestés a te stílusodban”, Evelin: „Festés, balayage, tőfestés és hajhosszabbítás a te stílusodban”) – az **asztali főcím az eredeti oldal címe marad** (egyetlen `<h1>`, két `<span>`: `csak-asztali` / `csak-mobil`); a hero képén nincs felirat (a név az idézet alatt áll); a blokkok „Személyre szabott frizurák” (nem „női”) és „Részletes konzultáció”, mindkettő elején kis pipa-ikon, **nem csempe / gomb** (nincs háttér, keret).
- **Központi oldal, asztal:** a hero-ból kikerült a „Női fodrászat Budán · Bécsi út 2.” felirat; a konzultáció-szakaszban **mindhárom fodrász videója** (Betti, Noel, Evelin; mobilon vízszintesen lapozható sor); a szakasz címe „Fodrászt választani nehéz, és bizalmi kérdés”, alcíme „Pontosan ezért találtuk ki az ingyenes konzultációt: hogy megismerjük egymást, felmérjük az igényeidet, és pontosan olyan frizura készüljön, ami minden elvárásodnak megfelel.”; a „Nem ígérünk olyat, amit a hajad nem bír el” (realitás) blokk és a „Haj biztonság” kör **törölve**.
- **„Itt találsz meg” (mind a 4 oldal):** a bal hasáb (szöveg + gombok + térkép) és a jobb hasáb (a fodrászat képei, **lapozható galéria**, ugyanaz a komponens, mint a központi hero-é: `lapozGaleria()` a `sablon.mjs`-ben, `[data-hero-galeria]` a `hair-landing.js`-ben) asztalon pontosan egyforma magas (a galéria kitölti a sort); mobilon szöveg, térkép, galéria egymás alatt.
- **Betti oldal:** a 4 Google-vélemény képernyőmentés sora kikerült (nem kell két értékelés-rész), a Trustindex-sáv marad (minden fodrász-oldalon).

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

A mostani Wixes oldalakon szerepel, **ide nem vettem át** (a fodrász-oldalak H1-e kivételével, lásd fent; a tulajdonos döntheti el, hogy visszakerüljenek-e): Betti „18 év tapasztalat”, „több ezer festés”, „vendégeim 98%-a visszajár”; Noel „3 év”, „95%”; Evelin „4 év”, „90%”; a központi oldal „31 tapasztalati év”, „5,0 – Kiváló”, Noel „5,0 – 1.145 vélemény”; a lejárt „Szeptemberi akció”.

## Nyitott / ellenőrizendő

1. **A Salonic és a régi árlista eltér** (`assets/js/arlistak.js`, a Betti-tábla szolgálja ki a központi, a Betti és az Evelin oldalt): a „Teljes festés / korrekció” és a „Teljes melír / airtouch” sora **fel van cserélve** (a Salonic: teljes festés 32 950 / 39 950 / 44 950 / 48 950 Ft; teljes melír 39 950 / 47 950 / 60 950 / 64 950 Ft), a „Teljes szőkítés” a régi táblában 1000 Ft-tal olcsóbb volt. **Javítva (2026-10-07, a tulajdonos kérésére):** az `arlistak.js` Betti- és Noel-táblájának árait a `tools/commonninja.mjs` a Salonic-pillanatképből írja fel (`tools/hair-oldalak/regi-arlista.mjs`; sorcímkék és sorrend a régiek), és a régi oldalak szöveges „Ár: …-tól” értékei is a Salonic legolcsóbb árai (a tőfestés ára nem ígér vágást; Noelnél a kedvezménnyel). A teszt (`hair.test.mjs`) őrzi, hogy a régi tábla és a szövegek egyezzenek a pillanatképpel. Árváltozásnál: `node tools/hair-oldalak/salonic-pillanatkep.mjs`, `node tools/commonninja.mjs --helyi` (utána a `git checkout assets/js/gyik.js`, ha a GYIK-fájl kézi módosításai eltérnek), `node tools/hair-oldalak.mjs`.
2. **Salonic-beállítások, amik furcsák:** Betti a „Teljes szőkítés”-t csak extra hosszú hajra, a „Teljes festés”-t hosszú hajra nem vállalja (a Salonicban nincs hozzárendelve); Noel nem vállal férfi hajvágást. Ha ez hiba, a Salonicban kell javítani, az oldal követi (pillanatkép-frissítés).
3. **Noel 20%-a** a Salonic-feliratból jön („Noel - 20% kedvezmény!”); ha megszűnik, a Salonicban a felirat változik, és a pillanatkép-frissítés kiveszi az oldalról.
4. **Mit mutassunk a Google-sávon?** Most a MOSAIC egészének értékelése (Head Spa-vendégek is benne vannak). Ha lesz hajas-specifikus Trustindex-widget, a `hair-landing.js` `TI` állandóját és a `data-forras` címet kell cserélni.
5. **Nincs 5. oldal a „balayage” belépéshez** (a csomag `#/balayage` állapota): a mostani `/balayage-haj-festes-budapest` Noel oldala; külön balayage-landing külön kérésre.
6. **A fejléc/lábléc** a MOSAIC közös (Wixes) fejléce/lábléce; a minták egyszerűbb, fehér fejléce nincs átvéve (a menü egységes az egész oldalon).
7. A csere megtörtént (2026-10-09, lásd az elejét); nyitott: a GTM-triggerek egyeztetése az elemzővel.
