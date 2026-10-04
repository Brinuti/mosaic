# Lézeres szőrtelenítés landing (`/lezeres-szortelenites-budapest-uj`)

Az új oldal a megadott terv alapján készült, a `/sminktetovalas-budapest` landing stílusában (Playfair Display + Jost, arany
foglalás-gomb, sötétzöld foglaló-szekció). **Külön címen él** (`/lezeres-szortelenites-budapest-uj`, `noindex`, sehonnan nincs rá link, nem szerepel a sitemapben): a mostani, éles
`/lezeres-szortelenites-budapest` oldalt (Wixes klón) NEM cseréli le. A tulajdonos döntése (2026-10-04): amíg nem jelzi, nem váltunk át.
**Átváltás:** a fájl átnevezése `foglalas/lezeres-szortelenites-budapest.html`-re, a `noindex` meta törlése, a canonical / og:url javítása, a tesztek `OLDAL`
útvonalának átírása és egy deploy (a mérés útvonal szerint működik: a `suti.js` pixel-listáján a `lezeres-szortelenites-budapest` szerepel; az `-uj`
címen nincs mérőkód-pixel, és ezt nem is írtuk át). Visszaállítás átváltás után: a fájl törlése, a klón változatlanul megvan.

| Fájl | Szerepe |
|---|---|
| `foglalas/lezeres-szortelenites-budapest.html` | az oldal (fejléc/lábléc a build-ből, `<!--mh-fejlec-->`) |
| `assets/css/lezer-landing.css` | önálló stíluslap (a PMU stílusát nem érinti) |
| `assets/js/lezer-landing.js` | időpont-választó, kalkulátor, apróbb segédek |
| `tools/lezer-teszt/lezer.test.mjs` | böngészős tesztek (65 db) |
| `tools/netlify-build.mjs` | `<!--mh-menu-aktiv:/útvonal-->` jelölő: a „Szőrtelenítés” menüpont legyen kijelölve (jelölő nélkül a fejléc változatlan) |

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

**Hetedik kör (2026-10-04):** a „Mennyibe kerül?” kártyákon „/ alkalom” (nem „/ fizetős alkalom”); az Áll sornak nincs alcíme az árlistában; a mobil sticky sáv csak akkor jön be, ha a hero gombjai már felgörögtek a képernyő tetején (kis kijelzőn a gombok az első képernyő alatt vannak, ott a sáv betöltéskor nem látszik); mobilon a hero kicsit feljebb és kisebb leírással; asztalon a Zsófi-szekcióban a cím a videó tetejével, a galéria a videó aljával egy vonalban kezdődik/végződik, a gomb körül hellyel; a „Neked is jó választás?” első kártyája (Valószínűleg igen) új szöveggel (borotva, begyulladt szőrtüszők); a „Neked is jó választás?” szekció alatt a Meta-hirdetés videója („Zsófi szőrbenövés”, 39 mp, `assets/video/lezer-szorbenoves.mp4`, poszter: `assets/img/lezer-szorbenoves.jpg`; kattintásra tölt be, mint a Zsófi-videó).

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
ha az API nem válaszol, a Salonic foglaló linkjét kapja a látogató. Egy időpontra kattintva a Salonic `/guestData/` adatlapja nyílik ugyanabban a lapon (nincs felugró), az időponttal
együtt (ugyanezt a címet nyitja a foglaló-motor is). A statikus linkek (ingyenes konzultáció) a build link-átkötésén mennek át (`tools/foglalo-atkotes.mjs`):
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
