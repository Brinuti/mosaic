# Lézeres szőrtelenítés landing (`/lezeres-szortelenites-budapest`)

Az új oldal a megadott terv alapján készült, a `/sminktetovalas-budapest` landing stílusában (Playfair Display + Jost, arany
foglalás-gomb, sötétzöld foglaló-szekció). Ugyanazon a címen él, mint a régi (Wixes klón) oldal: a `foglalas/` mappába tett saját oldal a
build-ben felülírja a `klon/lezeres-szortelenites-budapest.html`-t (ahogy a PMU landing is). **Visszaállítás:** a
`foglalas/lezeres-szortelenites-budapest.html` törlése és új deploy, a klón változatlanul megvan.

| Fájl | Szerepe |
|---|---|
| `foglalas/lezeres-szortelenites-budapest.html` | az oldal (fejléc/lábléc a build-ből, `<!--mh-fejlec-->`) |
| `assets/css/lezer-landing.css` | önálló stíluslap (a PMU stílusát nem érinti) |
| `assets/js/lezer-landing.js` | időpont-választó, kalkulátor, apróbb segédek |
| `tools/lezer-teszt/lezer.test.mjs` | böngészős tesztek (27 db) |
| `tools/netlify-build.mjs` | `<!--mh-menu-aktiv:/útvonal-->` jelölő: a „Szőrtelenítés” menüpont legyen kijelölve (jelölő nélkül a fejléc változatlan) |

## Szekciók sorrendje

Hero → Mennyibe kerül? → Már tudod, mit szeretnél? → Eredmények → 8 kezelés, csak 6-ot fizetsz → garancia + fenntartó →
Neked is jó választás? → Zsófi → A kezeléssel kapcsolatban érdekelhet → Részletes árlista → **Több területet szeretnél? (kalkulátor)** →
Gyakori kérdések → Időpontfoglalás online → Helyszín.

A mintában egymás mellett álló négy szekció (érdekelhet, árlista, több terület, GYIK) külön, teljes szélességű szekció.
Az intim területhez nincs testfotó: a „Teljes intim” és a „Hónalj + intim” kártyán a kezelőszoba és a gép fotója áll.

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

A kiválasztott területek közül a legdrágább teljes áron, minden további **50%-on** számít (akkor is, ha nagy terület). Ellenőrizve az
eredeti oldal példáival: láb + kar + hónalj + arc = 104 500 Ft, láb + intim = 77 000 Ft, kar + hónalj = 51 500 Ft, arc + kar = 57 000 Ft,
hónalj + intim = 45 500 Ft (a Basic csomag ára). Ha egy „teljes” terület ki van jelölve (teljes láb / kar / arc / intim), az őt alkotó
részek le vannak tiltva (nincs dupla számolás). A program: 6 fizetős alkalom (a 4. és a 8. ajándék).

## Időpont-választó

A legközelebbi szabad időpontokat a Salonic nyilvános naptár-API-ja adja (`api.salonic.hu/calendar/getAvailableTimes`, ugyanaz, mint a PMU landingen),
az oldal alján, amikor a szekció a képernyő közelébe ér. Időpontot nem találunk ki: ha az API nem válaszol, a Salonic foglaló linkjét kapja a látogató.
Az időpont-gombok a Salonic `selectDate` oldalára visznek (új lapon). A statikus linkek (ingyenes konzultáció, „Más időpontok”) a build
link-átkötésén mennek át (`tools/foglalo-atkotes.mjs`): kikapcsolt átkötésnél (éles) Salonic-link, előnézeten a foglaló-réteg nyílik.

## Nyitott pontok (a tulajdonos döntése / adata kell)

- **Eredmények (előtte/utána):** jelenleg egy valódi vendégfotó van (hónalj, a régi oldalról), a rács egy kártyás (`class="eredmeny-racs egy"`). További kártya: új `<article class="eredmeny-kartya">` valódi fotóval és adatokkal (terület, kezelések száma, időtáv), majd az `egy` osztály törlése. Adatot nem találunk ki.
- A hero „4,9/5 Google vendégértékelés” és a Zsófi-szekció „4 év tapasztalat” a megadott tervből és a régi oldalról való; az élesítés előtt egyeztetendő.

## Tesztelés

```bash
node tools/netlify-build.mjs
node --test tools/lezer-teszt/lezer.test.mjs
```

A teszt a helyi `dist/` ellen fut Playwrighttal (a Salonic-API hamisítva, külső forgalom tiltva); `CHROME_UTVONAL` és `PLAYWRIGHT_UTVONAL` környezeti
változóval állítható a Chrome és a `playwright-core` helye.
