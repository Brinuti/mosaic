# Lézeres szőrtelenítés landing (`/lezeres-szortelenites-budapest`)

Az oldal a megadott terv alapján készült, a `/sminktetovalas-budapest` landing stílusában (Playfair Display + Jost, arany
foglalás-gomb, sötétzöld foglaló-szekció). **Élesben van az eredeti címen** (`/lezeres-szortelenites-budapest`, indexelhető, a sitemapben szerepel; a tulajdonos kifejezett
kérésére, 2026-10-04): a korábbi Wixes klón helyét vette át (a `foglalas/*.html` felülírja a `klon/*.html` azonos nevű fájlját).
- A **régi (Wixes) változat** rejtett címen megmaradt: `/lezeres-szortelenites-budapest-regi` (`klon/lezeres-szortelenites-budapest-regi.html` + `klon/m/…`; `noindex`, saját canonical, nincs rá link, nincs a sitemapben) – összehasonlításhoz és visszaálláshoz.
- Az ideiglenes **`/lezeres-szortelenites-budapest-uj`** cím 301-gyel az eredeti címre irányít (`netlify/lib/utvonal.js`, `ATIRANYITASOK`).
- **Visszaállítás a régi oldalra:** a `foglalas/lezeres-szortelenites-budapest.html` törlése (a klón `klon/lezeres-szortelenites-budapest.html` változatlanul megvan) + deploy; az `-uj` átirányítást is érdemes kivenni.
- Mérés: a `suti.js` pixel-listáján a `lezeres-szortelenites-budapest` szerepel, ezért az oldal útvonal alapján megkapja a mérőkódokat (hozzájárulás után); kattintás-szintű események (pl. Salonic-átkattintás) ehhez az oldalhoz külön nincsenek.

| Fájl | Szerepe |
|---|---|
| `foglalas/lezeres-szortelenites-budapest.html` | az oldal (fejléc/lábléc a build-ből, `<!--mh-fejlec-->`) |
| `assets/css/lezer-landing.css` | önálló stíluslap (a PMU stílusát nem érinti) |
| `assets/js/lezer-landing.js` | időpont-választó, kalkulátor, apróbb segédek |
| `tools/lezer-teszt/lezer.test.mjs` | böngészős tesztek (84 db) |
| `tools/netlify-build.mjs` | `<!--mh-menu-aktiv:/útvonal-->` jelölő: a „Szőrtelenítés” menüpont legyen kijelölve (jelölő nélkül a fejléc változatlan) |

## A férfi oldal (`/vegleges-szortelenites-ferfiaknak`) ugyanezt a stílust használja (2026-10-17)

A régi férfi oldal (Feri kérése: „még a régi rendszer szerint készült el, nem szép”) a landing **komponenseivel** készült újra: `assets/css/lezer-landing.css` (hero, kártyák, arany gombok, harmonika-GYIK, helyszín, Trustindex-doboz) + a csak a férfi oldalra való
`assets/css/lezer-ferfi-landing.css`. A **tartalom szó szerint a régi férfi oldalé** (nem a női landingé: a női képek / árak / ikonok nincsenek rajta), a foglaló-gombok a régi `/foglalo-motor?business=laser` linkek.
A női landing `lezer-landing.js`-e (árlista-tábla, kalkulátor, naptár) itt **nincs** használatban (a női árakra / Salonic-szolgáltatásokra épül); a Trustindex-keretet / térképet a `headspa-oldal.js` kezeli. Részletek: `tools/lezer-variansok/README.md`.
A `lezer-landing.css` módosítása a férfi oldalt is érinti (a közös komponensek), ezért a CSS-változtatás után a férfi oldalt is nézd meg (`tools/ujrastilus-teszt/lezer-ferfi.test.mjs` a stílus-azonosságot is ellenőrzi).

### 2026-10-20 Feri visszajelzés (a férfi oldal átalakítása)

Feri (hangalapú diktálás, a tulajdonos) kérése: „mind javíts”, mobilon „össze-vissza szétesik”, rövidebb legyen, az egymás melletti kép + szöveg hasábok azonos magasságúak. Ami készült
(`foglalas/vegleges-szortelenites-ferfiaknak.html`, `assets/css/lezer-ferfi-landing.css`, új `assets/js/lezer-ferfi.js`, `tools/ujrastilus-teszt/lezer-ferfi.test.mjs`; közös fájlhoz nem nyúltunk):

- **Tartalom:** „20% májusi kedvezménnyel” → „20% **októberi** kedvezménnyel” mind a 13 helyen; a „nyári ajánlat” **karácsonyi** („Ha most belevágsz, karácsonyra elfelejtheted a gyantát és a borotvát!”, a nyárra utaló mondatok karácsonyra / ünnepekre írva);
  „1 év garancia” → „12 hónap garancia”; az évben megadott tapasztalat („4 év”, „több mint 3 év”) helyett **8000+ óra** (a fő oldalon is ez áll; az évek száma megerősítésre vár); a meta description is ezt követi;
  árak a fő oldal árlistájához (`data-ar`): Hónalj 8 alkalom 114.000 Ft (volt 96.000), Man Total „külön” 119.000 Ft (váll nélkül) / csomagkedvezmény 51.000 Ft (volt 99.000 / 32.000; a Salonic-felirat 32.000-et ír: `docs/ARLISTA.md` 4–5. pont, ezzel az 4. pont a férfi oldalra lezárva);
  elírások javítva (kattintva, kell, vessző / szóköz, „végzi”, „valósítja meg”); „8 alkalmas bérletben” → „programban” (nincs bérlet). Nyitvatartás: csak „Hétfő - Péntek” (a szombat megerősítésre vár), a fejléc / lábléc / Info-ablak a `<!--mh-foglalas:business=laser-->` és `<!--mh-nyitvatartas:hetkoznap-->` jelölővel.
- **Hero:** mobilon CÍM → KÉP → alcím → 3 jelvény (egymás mellett, középen: 3 egyenlő oszlop) → gombok → kedvezmény-pill → értékelés → hely; asztalon a 3 jelvény egy sorban. Új fő gomb: „Ingyenes konzultáció” (`/foglalo-motor?business=laser&service=konzult`),
  mellette az „Időpontfoglalás” (kontúr). A Google-értékelés sor, a „Mutasd az árakat! >>” és a hely-sor **nem visz ki / nem #hash-link**: `<button data-gorget="velemenyek | csomagarak | terkep">`, a görgetést az `assets/js/lezer-ferfi.js` végzi
  (nincs pushState / hash, a cél H2-re kerül a fókusz; a GTM „History Change” miatt, lásd fent a `data-szamolo`-t). A Trustindex betöltő-tartaléka és a térkép-blokk „Útvonaltervezés” gombja az egyetlen Google Térkép-link.
- **Konzultáció blokk:** a Zsófi-fotó helyett a fő oldal **Zsófi konzultációs videója** (`assets/video/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0.mp4`, 9 MB: csak kattintásra tölt, a `headspa-oldal.js` `[data-video]` felugró lejátszójában; poszter: `…f000.jpg`); mobilon a kis videó a 3 jelvény mellett (kompakt).
- **Rögzített ár / garancia és bérlet-szakasz:** a nagy pecsétkép és a két infografika helyett a fő oldal egyszerű, ikonos ábrái: 3 ikonos garancia-kártya, 3 ikonos kedvezmény-kártya (20% / 50% / 4. + 8.) és a 8 alkalmas idővonal (4. és 8. ajándék, `.alkalmak`). A kis pecsétsor mobilon középen, egymás mellett.
- **Hasábok:** minden egymás melletti kép + szöveg (és kártya-pár) asztalon azonos magasságú (`align-items: stretch`, a kép `position: absolute; inset: 0; object-fit: cover`): a konzultáció (videó), „Felejtsd el…”, Zsófi, első alkalom, 3 kérdés, kontroll, előtte / utána, **karácsonyi blokk (kép-kártya = szöveg-kártya)**, SZÉP kártya, csomag- és testrész-kártyák.
- **Szalon-képek:** lapozható galéria (`.fl-galeria[data-galeria]`: CSS scroll-snap, asztalon nyilak + pöttyök + ←/→/Home/End, mobilon érintésre húzható, `aria-roledescription`, lusta betöltés, fix 3:2 képarány, nincs ugrálás).
- **Rövidebb mobil oldal formázással (szöveg nélkül kivétel):** kompakt kártyák, ikon a kártya-cím mellett, kis képsávok, csomag-kártyán kis kép a cím mellett, sorrend-átrendezés (`display: contents`). A teljes oldal 390 px-en ~23 670 → ~16 900 px.
- **Sortörés (Feri alapszabály):** `text-wrap: balance` a címekre / jelvényekre / gombokra, mobilon a legfeljebb 6 soros lista-sorokra és kártya-szövegekre is (asztalon `pretty`). Az árva-sor ellenőrzés (`tools/ujrastilus-teszt/lezer-ferfi.test.mjs`, 360 / 390 / 412 px) 0 találatot vár.
- **Mobil sticky CTA:** „Ingyenes konzultáció” + kis „Időpont-foglalás” link (a `headspa-oldal.js` kezeli: a hero elgörgetése után jön be, a helyszínnél eltűnik).
- **Teszt:** `PLAYWRIGHT_UTVONAL=<node_modules> CHROME_UTVONAL=<chrome> node --test tools/ujrastilus-teszt/lezer-ferfi.test.mjs` (33 db; a dist-es rész a `CF_PAGES=1 CF_PAGES_BRANCH=<ág> node tools/netlify-build.mjs` után fut). A régi oldal szöveg- / kép- / link-hűségét a `CSERE` / `ELTAVOLITVA` tábla szerint ellenőrzi: csak a fenti, Feri kérte változtatások az engedett eltérések.

## Ajándékkártya (2026-10-07, a tulajdonos kérése)

A hero gombsorában a „Szabad kezelési időpontok” gomb mellett egy **„Ajándékkártya”** gomb áll, utána (2026-10-07, a tulajdonos kérése) az „Ingyenes konzultáció” már csak egyszerű, aláhúzott szöveges link (`.cta-link`, nem gomb; mobilon középre kerül). Az Ajándékkártya gomb közvetlen oldal-link a `/lezeres-ajandekkartya` oldalra (nem hash, nem Salonic, ugyanabban az ablakban). A garancia után, Zsófi előtt külön szekció (`#ajandek`, `.ajk`): „Személyre szabott ajándékkártya!”, a lézeres mockup-kép (`assets/img/ajandek/atadas-szemelyre-lezer.jpg`), három pont (PDF, személyre szabható, 6 hónap) és az „Ajándékkártyát választok” gomb. A kártya-oldal és a vásárlás leírása: `AJANDEK.md` („Lézeres szőrtelenítés ajándékkártya”). Teszt: `node --test tools/lezer-teszt/ajandek-link.test.mjs` (statikus, build nélkül).

## Szekciók sorrendje

Hero (cím: „Lézeres szőrtelenítés Budapesten garanciával”, kis, kattintható **4,9/5 + pontos Google-értékelésszám**, ami a véleményekhez görget) →
Mennyibe kerül? (testtáj-**ábrákkal**) → Már tudod, mit szeretnél? → Eredmények → 8 kezelés, csak 6-ot fizetsz → garancia + fenntartó (örökre féláron) →
Neked is jó választás? → **Zsófival fogsz találkozni (lejátszható konzultációs videó + képgaléria)** → **Vendégeink értékelései (az eredeti Trustindex-embed)** →
A kezeléssel kapcsolatban érdekelhet → Részletes árlista (ikonokkal) → **Több területet szeretnél? (ikonos árkalkulátor)** → Gyakori kérdések →
Időpontfoglalás online (**kompakt, naptáras**) → Helyszín (**Google térkép**).

Nincs „felcím” (arany cím a főcím felett) sehol. Az első kezelés 20% kedvezménye több helyen szerepel (hero, árkártyák, program, árlista, kalkulátor, GYIK).
A négy szekció (érdekelhet, árlista, több terület, GYIK) külön, teljes szélességű szekció. Az intim területhez nincs testfotó: a „Mennyibe kerül?”
kártyák semleges alakos ábrák (kiemelt testtájjal), az SVG-k a HTML elején vannak (`#abra-alak`, `#abra-honalj`, `#abra-intim`, `#abra-lab`).

**Értékelések:** a hero-ban kis `4,9/5` gomb a pontos darabszámmal (`data-ertekeles-db`, tartalék érték: 1 257, a Trustindex-widget aktuális adatából frissül a
„funkcionális” sütik elfogadása után), ami a `#velemenyek` szekcióhoz görget. A szekció az **eredeti Trustindex-embed** (`/assets/embed/c2eb0f_95e68e628e4b9b61aaf664bfad20b4f6.html`, ugyanaz,
mint a főoldalon és az ajándékkártya-oldalon), iframe-ben; a sütik elfogadásáig (vagy a „Vélemények megjelenítése” gombig) helykitöltő áll a helyén. A „4,9” a tulajdonos megadott értéke.

**Ikonok / illusztrációk:** a tulajdonos által feltöltött látványtervekből (`intim.jpg` = „Mennyibe kerül?” kártyák, `testtajak.jpg` = árlista) kivágott képek az `assets/img/lezer-ikon/` mappában:
`kartya-*.jpg` (a 4 „Mennyibe kerül?” kártya képe), `sor-<kulcs>.jpg` (az árlista soronkénti kerek ikonja, a `data-kulcs`-hoz igazítva), `cs-*.jpg` (az árlista csoportjelvényei).
**Ne rajzolj helyettük sajátot.** A kalkulátor gombjai, csoportcímei és eredménysorai az árlista ikonjait másolják (egyetlen forrás: az `#arlista` HTML-je). A korábbi motor-ikonok (`la-/lp-/rz-`) már nincsenek használatban.

**Zsófi:** a konzultációs videó (a régi oldal 44 mp-es videója, `assets/video/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0.mp4`) kattintásra tölt be (9 MB), mellette 4 képből álló, nagyítható galéria.

**Mobil sticky sáv:** az `/oxigenterapia-budapest` oldal mintájára telefonon (≤ 700 px) alul rögzített sáv: arany „Szabad időpontok” gomb (a foglalóra ugrik) + kis „Ingyenes konzultáció” link. A hero gombjainak elgörgetése után jelenik meg, a foglaló szekciónál és az után nem látszik (`#sticky-cta`, `lezer-landing.js`).

**Hatodik kör (2026-10-04):** GYIK-ban két új kérdés („Mit jelent az, hogy végleges?”, „Biztos, hogy elég a 8 alkalom?”; a válaszok az oldal meglévő állításaira épülnek: 12 hónapos garancia, fenntartó kezelések, fix ár);
a kész csomagoknál a testrészek külön-külön vett összára áthúzva, pirossal (`data-reszek` + `.regi-ar`; a Man Totalnál a váll nélkül, mert annak nincs külön ára);
a kalkulátorban több területnél az eredeti összeg áthúzva, egy területnél semmi (a `null` felirat hibája: a `replaceChildren` a `null`-t szövegként illeszti be, ezért kiszűrjük);
a foglaló naptárában kör alakú szabad napok (mint a foglaló-motorban), a „Már jártál nálunk?” sor törölve; mobilon: a hero sorrendje cím → kép → többi szöveg (a cím 2 sorban), a hero és a Zsófi-szekció ikonjai 3 oszlopban, középre igazítva, rövidebb kalkulátor-lábjegyzet egy sorban, lefelé mutató nyíl, több hely az árlista csoportcímei alatt.

**Hetedik kör (2026-10-04):** a „Mennyibe kerül?” kártyákon „/ alkalom” (nem „/ fizetős alkalom”); az Áll sornak nincs alcíme az árlistában; a mobil sticky sáv csak akkor jön be, ha a hero gombjai már felgörögtek a képernyő tetején (kis kijelzőn a gombok az első képernyő alatt vannak, ott a sáv betöltéskor nem látszik); mobilon a hero kicsit feljebb és kisebb leírással; asztalon a Zsófi-szekcióban a cím a videó tetejével, a galéria a videó aljával egy vonalban kezdődik/végződik, a gomb körül hellyel; a „Neked is jó választás?” első kártyája (Valószínűleg igen) új szöveggel: „Ha egy életre elfelejtenéd a borotvát és a begyulladt szőrtüszőket, akkor igen.” (más mondat nincs mellette); a „Neked is jó választás?” szekció alatt a Meta-hirdetés videója („Zsófi+orvos reels”: Zsófi és Dr. Máté Kinga, a videóban „orvos - sebész szakorvosjelölt” felirattal; 66 mp, `assets/video/lezer-orvos.mp4`, poszter: `assets/img/lezer-orvos.jpg`; kattintásra tölt be, mint a Zsófi-videó), krémszínű dobozban, arany gombbal; a szöveg Dr. Máté Kinga orvost nevezi meg („orvos, sebész szakorvosjelölt is a lézeres szőrtelenítést és Zsófit ajánlja”), a doboz tetején, a szövegoszlop (cím, szöveg, gomb) vízszintes közepén pipás „Orvosi ajánlással” jelvény (asztalon a video melletti oszlop közepén, telefonon a doboz közepén); a szövegoszlop (cím, szöveg, arany gomb) középre igazított. A videó saját feliratát követjük („orvos - sebész szakorvosjelölt”): nem „bőrgyógyász”, és nem „szakorvos”.

**Kilencedik kör (2026-10-04, a tulajdonos kérése az Oxigén-munkameneten át):** új szekciósorrend: hero → Mennyibe kerül? → Eredmények → 8 kezelés → Már tudod, mit szeretnél? → Garancia → Zsófi → Neked is jó választás? → Vélemények → Érdekelhet → Árlista → Kalkulátor → GYIK → Foglaló → Helyszín.
Az egyedi csomagot („nagyon sokan szeretik”) említő sorok a hero-ban, a Mennyibe kerül?, a 8 kezelés és az árlista szekcióban a kalkulátorra linkelnek (`[data-szamolo]`: JS-gördítés, **nem** `#hash`, hogy a GTM „History Change” esemény ne induljon).
Minden gomb (`.gomb`) ugyanazt a betűt használja: Jost, 15 px, normál írásmód (nincs csupa nagybetűs gomb, nincs betűköz); a gombok mérete csak a belső margóban tér el.

**Fejléc:** a fejléc felső, rózsaszín akciós sávját (`section#comp-mpv0ganp`, Wix-fejléc) ezen az oldalon elrejtjük (a `lezer-landing.css`-ben, ezért csak itt hat; a tulajdonos kérése, hogy helyet nyerjünk). A fejléc így 77 → 46 px (asztal) és 94 → 63 px (mobil); a görgetési eltolások (`scroll-padding-top`, `scroll-margin-top`) 84 px-esek.

**Google-értékelés jelvény (hero):** a három jelvény (garancia / 20% kedvezmény / Kolosy tér) alatt, a gombok felett áll; kerek, krémes szélű jelvény (G-logó, 4,9/5, csillagok, „1 257 Google-vélemény”), az érték és a vélemények száma egyforma kicsi betűvel, lefelé mutató nyíl nélkül; továbbra is a `#velemenyek` szekcióra mutat.

**Tizenharmadik kör (2026-10-04, mobil finomítások):** a fő cím „Lézeres szőrtelenítés 12 hónap garanciával”; a három jelvény (garancia / 20% / Kolosy tér) a bal és a jobb margóig ér; a Google-értékelés sor nem kártya (nem néz ki gombnak); a hero kalkulátor-sora: „Több területet szeretnél? Számold ki az árát →”; a „Mennyibe kerül?” alcíme „Bérlet helyett alkalmanként fizetsz.”, a 20%-os sáv „Az első kezelés 20% kedvezménnyel” (egy sor), ott nincs kalkulátoros sor; a 8 kezelés szekcióban nincs 20%-os mondat; az árlista bevezetője rövid, **az árlistában nincs „Időpont” gomb** (és nincs gomb-oszlop); mobilon az árlista ugyanolyan széles (16 px-es margók), mint a kalkulátor és az akkordionok; az „Orvosi ajánlással” jelvény mobilon középen, a videó fölött; a vélemény-widget iframe magassága folyamatosan követi a tartalmat (csak nő), hogy a lapozó hosszabb kártyái ne vágódjanak le.

**Tizennegyedik kör (2026-10-06):** az árlistában és a kalkulátorban csak a fő testtájak (csoportok) kapnak képet (`cs-*.jpg`), a soronkénti / gombonkénti ikonok kikerültek (a `sor-*.jpg` fájlok törölve); a Zsófi-szekció első jelvénye „8000+ óra tapasztalat”; a Trustindex-keret `loading="eager"` (a lézeres, az Oxigén és az ajándékkártya oldalon is), vagyis hozzájárulás után azonnal töltődik, nem csak odagörgetéskor (hozzájárulás előtt továbbra is gombos helykitöltő áll: harmadik fél, funkcionális süti); a helyszín-szekció képe fix 190 px magas (iOS Safari-n a rács-elem képén a `height: 100%` nem oldódott fel, és a kép a láblécbe lógott).

**Mobil sticky sáv + eredmény-link (2026-10-06, a tulajdonos kérése az Oxigén-munkameneten át):** a sticky sáv nem rögtön jelenik meg: csak az első, 4 képes szekció (Mennyibe kerül?) elgörgetése után (IntersectionObserver a `#mennyibe` szekción: `!isIntersecting && bottom <= 0`), a foglalónál eltűnik. A hero értékelés-sorában („4,9/5 … Google-vélemény”) mellette „Mutasd az eredményeket →” link áll (`data-gorgetes="eredmenyek"`: JS-gördítés az Eredmények szekcióhoz, nem `#hash`, a GTM History Change miatt).

**Foglaló-szekció időpontjai → foglaló-motor (2026-10-06, a tulajdonos kérése):** a naptár időpontjai már nem a Salonic oldalára visznek, hanem a helyben nyíló foglaló-motorba (réteg): `/foglalo-motor?business=laser&service=<Salonic-azonosító | konzult>` (a launcher, `assets/js/booking-launcher.js`, elfogja a kattintást; ugyanúgy működik, mint a fejléc „Ingyenes konzultáció” gombja; JS nélkül a `/foglalo-motor` oldalra visz). A kiválasztott időpont időbélyegét a link a `&start=<unix>` paraméterben viszi (`a.ido[data-ido]` ugyanez): a motor **kihagyja a naptárat, és rögtön a foglalási űrlapot (Salonic-adatlap) mutatja arra az időpontra** (2026-10-06, a tulajdonos kérése; részletek: `docs/booking-engine/BOOKING_LAYER.md`). Vissza gombbal a naptár nyílik a kiválasztott napon / időponton; ha az időpont közben elkelt, a naptár a „közben elkelt” figyelmeztetéssel. A tesztek az időpontokat 9:00 UTC-re igazítják, így nem lógnak át éjfélen.

## Árforrás

**Az egyetlen árforrás a „Részletes árlista” táblázat** (`#arlista`, soronként `data-kulcs`, `data-ar`, `data-elso`, `data-tartalmaz`).
A kalkulátor, a területválasztó és a legördülő ebből olvas. Árváltozásnál a táblázat sorát kell átírni (az alkalmankénti ár, a
8 alkalmas program = 6 × ár; a teszt ellenőrzi az összefüggést). A „Mennyibe kerül?” négy kártyájának ára külön, kézzel van beírva (a teszt
összeveti a táblázattal).

Az árak a Salonic Elysion-fiókjának alkalmankénti („2. alkalomtól”, `specId=66405`) listájából valók (2026-10); a `data-elso` az adott
terület első alkalmas szolgáltatásának Salonic-azonosítója (`specId=66404`, 60 perces, állapotfelméréssel), ennek szabad időpontjait kérdezi le a választó.
Az ingyenes konzultáció azonosítója `476477`, az egyedi csomagé `476478`. Naptár-azonosító: `02742cf7-…` (ha megváltozik, a kód
a Salonic oldaláról újra kiolvassa).

## Kalkulátor

Alapból három terület ki van jelölve (láb + hónalj + intim), hogy látszódjon, hogy kalkulátor; kézírásos felirat + nyíl hívja fel rá a figyelmet. A kiválasztott területek közül a legdrágább teljes áron, minden további **50%-on** számít (akkor is, ha nagy terület). Ellenőrizve az
eredeti oldal példáival: láb + kar + hónalj + arc = 104 500 Ft, láb + intim = 77 000 Ft, kar + hónalj = 51 500 Ft, arc + kar = 57 000 Ft,
hónalj + intim = 45 500 Ft (a Basic csomag ára). Ha egy „teljes” terület ki van jelölve (teljes láb / kar / arc / intim), az őt alkotó
részek le vannak tiltva (nincs dupla számolás). A program: 6 fizetős alkalom (a 4. és a 8. ajándék). Az első kezelés 20% kedvezménnyel (alkalmankénti ár × 0,8, a Salonic első-alkalmas árai is így vannak). Nincs „tájékoztató számítás” felirat: ez végleges ár (az ár a program végéig fix).

## Időpont-választó (naptár)

Kompakt kártya: bal oldalt kezelés/konzultáció váltó és a terület legördülője (csempék nélkül), mellette a havi naptár (négyzet alapú napok, keskeny naptár) és a nap időpontjai; a kártya a szekció jobb oldalán áll, bal oldalt a cím és a felsorolás. A szabad napok kattinthatók, az első szabad nap alapból ki van jelölve, alatta a nap időpontjai. A szabad időpontokat a Salonic nyilvános
naptár-API-ja adja (`api.salonic.hu/calendar/getAvailableTimes`, ugyanaz, mint a PMU landingen), amikor a szekció a képernyő közelébe ér. Időpontot nem találunk ki:
ha az API nem válaszol (vagy nincs szabad nap), a foglaló-motor linkjét kapja a látogató (`/foglalo-motor?business=laser&service=konzult` / `&intent=first`; közvetlen Salonic-link nincs: 2026-10-05, lásd `docs/booking-engine/meres-naplo/oxigen-es-fodrasz-ellenorzes-2026-10-05.txt`). Egy időpontra kattintva a Salonic `/guestData/` adatlapja nyílik ugyanabban a lapon (nincs felugró), az időponttal
együtt (ugyanezt a címet nyitja a foglaló-motor is; a Salonic ezután a mi `/elysion-ok` köszönőoldalunkra irányít, a mérés ott fut: valódi próbával ellenőrizve 2026-10-05). A statikus linkek (ingyenes konzultáció) a build link-átkötésén mennek át (`tools/foglalo-atkotes.mjs`):
kikapcsolt átkötésnél (éles) Salonic-link, előnézeten a foglaló-réteg nyílik.

**Helyszín:** Google térkép (iframe) a „funkcionális” sütik elfogadása után magától, egyébként a „Google térkép megjelenítése” gombra kattintva tölt be (a nagy statikus
térképkép kikerült).

## Nyitott pontok (a tulajdonos döntése / adata kell)

- **Eredmények (előtte/utána):** három valódi vendégfotó-kártya: hónalj (a régi oldalról), lábszár és arc (a tulajdonostól, 2026-10-04; `assets/img/lezer-eredmeny/`). Minden kép egy kompozit (balra előtte, jobbra utána, kb. 1,45:1), a „Előtte/Utána” címkét a CSS rakja rá (`.cimke`). Új kártya: új `<article class="eredmeny-kartya">` valódi fotóval és területtel; adatot (kezelésszám, időtáv) nem találunk ki. Telefonon oldalra görgethető sor.
- A „4,9” és a Zsófi-szekció „4 év tapasztalat” a megadott tervből és a régi oldalról való.
- A hero alcíme (**„a világ egyik legerősebb diódalézerével, az Elysion Pro-val”**): a régi oldal ezzel egyező állítása; ha a „világ első” volt a szándék, a szöveg a `.hero-al` sorban módosítható.

## Tesztelés

```bash
node tools/netlify-build.mjs
node --test tools/lezer-teszt/lezer.test.mjs
```

A teszt a helyi `dist/` ellen fut Playwrighttal (a Salonic-API hamisítva, külső forgalom tiltva); `CHROME_UTVONAL` és `PLAYWRIGHT_UTVONAL` környezeti
változóval állítható a Chrome és a `playwright-core` helye.

## 2026-10-20 (késő délelőtt): kezelő-fotók – a HeadSpa kezelőhelyiség ki, a lézeres kezelő be
Feri: a szőrtelenítés nem a HeadSpa kezelőben van, ezért a „A kezelőhelyiség növényekkel” / „…esti fényekben” fotók (`c2eb0f_0afd6583…`, `c2eb0f_7b41e9e5…`, a mosófejes HeadSpa kezelő) lekerültek a `/vegleges-szortelenites-ferfiaknak` szalon-galériájáról és az intim oldalról (a HeadSpa / oxigén oldalakon maradnak). Helyettük a lézeres kezelő 3 fotója (Feri küldte): `assets/img/lezer-kezelo/kezelo-nagy.jpg`, `kezelo-agy.jpg`, `kezelo-sarok.jpg` (3:2-re vágva, 1200×800). A férfi oldali galéria 10 képes (a váró / bejárat / folyosó közös terek maradtak); az intim oldal két képsávja a `kezelo-nagy` + `kezelo-agy`. Teszt: `KEZELO-KEPEK` (nincs HeadSpa kezelő-kép, megvan a 3 új fájl).

## Brigi oldala és az angol / ukrán változat (2026-10-30, a tulajdonos kérése)

- **`/vegleges-szortelenites-budapest`** (`foglalas/vegleges-szortelenites-budapest.html`): a fenti landing másolata az új kezelőnek, Szabó Brigittának (Brigi). **Nincs bekötve** a menübe / sitemapbe / mérőkód-listára, `noindex`. A Zsófi-specifikus elemek (8000+ óra, Dr. Máté Kinga ajánlója) kimaradtak; a kép / videó a Drive „Evi videók 2026.10.27." mappájából való (hero: kezelés közben, az OpenAI képszerkesztéssel minőség- és színjavítva, az arc változatlan: `assets/img/lezer-brigi/`). A hero gombjai: „Szabad kezelési időpontok" + „Ingyenes konzultáció" (nincs ajándékkártya-gomb); a térkép hozzájárulás nélkül is betölt (az oldal végén egy kis inline script kattint a gombra). A régi `/lezeres-szortelenites-brigi` cím 301-gyel ide irányít (`netlify/lib/utvonal.js`). A Salonicban Brigi még nincs felvéve: a foglaló-gombok az általános lézeres foglalóra mutatnak (nem Zsófi `employeeId`-jára).
- **Angol: `/permanent-hair-removal-budapest`, ukrán: `/ostatochne-vydalennya-volossya-budapesht`**: a fenti oldal fordításai, **csak hirdetésekhez** (`noindex`, nincs hreflang, nincs a menüben). **Ne kézzel szerkeszd**: `node tools/lezer-nyelvi/gen.mjs` állítja elő a magyar oldalból a fordító-táblák (`tools/lezer-nyelvi/en.json`, `uk.json`: magyar szöveg → fordítás) szerint; ha a magyar oldalon új / megváltozott szöveg van, ami nincs a táblában, a generátor hibával leáll. Az árak formázása automatikus (en: `19,000 HUF`, uk: `19 000 HUF`).
  A számológép / naptár / videó feliratai: `assets/js/lezer-szoveg-en.js` / `lezer-szoveg-uk.js` (a `lezer-landing.js` ELŐTT töltődnek; a magyar oldal alapértelmezett szövegei a `lezer-landing.js` elején, a `SZ` szótárban vannak, ezen a magyar oldalon semmi nem változik).
  Fejléc / lábléc: az angolon a közös angol változat (`<!--mh-nyelv:en-->`), az ukránon a közös (magyar) – az ukrán fejléc / lábléc szándékosan még nincs (a tulajdonos kérése). A foglaló-motor felülete magyar marad (nincs nyelvi támogatása).
  Teszt: `node --test tools/lezer-nyelvi/nyelv.test.mjs` (statikus), a számológép / naptár böngészős tesztje: `tools/lezer-teszt/lezer.test.mjs` (a magyar oldalra).
