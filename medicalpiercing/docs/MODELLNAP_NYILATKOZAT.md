# Modellnap: a nyilatkozat (Salonic „Kezelési űrlap”, a modellnapra igazítva)

**Állapot: jóváhagyásra vár (2026-11-01).** A szöveg a tulajdonos által beillesztett Salonic-„Kezelési űrlap”, a modellnapra igazítva. Élesre (a vendégeknek menő levélbe) csak a tulajdonos jóváhagyása után kerül.

## Hogyan működik
- A **visszaigazoló levélben** (t0) benne van a teljes nyilatkozat és a „Nyilatkozat elfogadása” gomb; ugyanabban a levélben, nem külön.
- A gomb az „A foglalásod” oldalra visz (`/mf/<kód>?nyil=1#nyilatkozat`): ott a szöveg nyitva van, a vendég bepipálja, hogy elolvasta és elfogadja, és rákattint az elfogadásra. Aláírás nincs.
- Az elfogadás **eltárolódik** (`modell_nyilatkozat`: foglalás, időpont, szöveg-verzió `VERZIO`, IP-lenyomat); ugyanaz a vendég kétszer nem írja felül az elsőt. A nap után 30 nappal a többi adattal együtt törlődik.
- A **48 és 24 órás emlékeztetők** gombot tesznek a levélbe, ha a nyilatkozat még nincs elfogadva; elfogadás után nem.
- Az admin összesítés (`GET /api/modell/admin`, kulccsal, személyes adat nélkül) mutatja: hány aktív foglalásból hány elfogadott nyilatkozat van.
- A szöveg egy helyen van: `lib/modell/nyilatkozat.js`. Szövegváltoztatáskor a `VERZIO` is változzon.

## Mit változtattam a Salonic-szövegen
| Hely | Salonic | Modellnap |
|---|---|---|
| Cím | Kezelési űrlap – Migrén / ShenMen / Slim / Klimax piercing elkészítéséhez | Kezelési űrlap – Szemöldök, orr, ajak, köldök és rook piercing elkészítéséhez (oktatási gyakorlónap) |
| 1. bekezdés | „migrén- és vagy Shenmen / Slim / Klimax piercing elkészítése, és a fülbe helyezése” | „a szemöldök-, orr-, ajak-, köldök- és rook piercing elkészítése, és a testbe helyezése” |
| Új bekezdés (új cím: „Oktatási gyakorlónap, fotó- és videófelvétel”) | – | „A Vendég tudomásul veszi, hogy a piercinget a Szolgáltató vidéki piercerei végzik gyakorlásként, Kovács Richárd felügyelete mellett, valamint hogy a szúrásról fotó- és videófelvétel készül, amelyeket a Szolgáltató a weboldalán és a közösségi média felületein felhasználhat.” |
| Záró mondat | „…jelen okirat aláírásával kifejezetten tudomásul veszi és elfogadja.” | „…jelen nyilatkozat elfogadásával kifejezetten tudomásul veszi és elfogadja.” |
| Többi bekezdés | – | szó szerint a Salonic szövege |

## Kérdések a tulajdonosnak (jóváhagyás előtt)
1. A Salonic-szöveg a **migrén / Shenmen / Slim / Klimax** piercingekre készült. Három mondata a modellnapra nem illik pontosan: a „kívánt hatás elmaradása / eredménygarancia”, a „pénzvisszatérítés” (a modellnapon ingyenes), és a „garanciális feltételek, ékszercsere a honlapon” (a divat-piercingekre nem biztos, hogy van garancia). Ezeket szó szerint meghagytam; töröljem / írjam át?
2. A **fotó- és videófelvétel** felhasználása (weboldal, közösségi média) a nyilatkozat része, egyetlen elfogadással. A GDPR szerint a közzétételhez a vendég külön, önkéntes hozzájárulása a biztosabb. Kérsz külön pipát?
3. Van-e a Salonicban a **beleegyező nyilatkozat** (a „lemondó” mellett) külön dokumentumként is? Ha igen, kérem a szövegét.
4. A nyilatkozat elfogadása **nem feltétele** a foglalásnak vagy a megjelenésnek (csak látszik, kinek van meg). Legyen feltétel (pl. a nap előtt 24 órával nem elfogadott foglalás figyelmeztetést kap), vagy a helyszínen ellenőrzitek?

## A Salonic eredeti szövege (a tulajdonos beillesztése, 2026-11-01)
> **Kezelési űrlap – Migrén piercing / ShenMen piercing / Slim piercing / Klimax piercing – elkészítéséhez**
>
> A Medical Piercing tájékoztatja a szolgáltatás igénybe vevőjét, arról, hogy migrén- és vagy Shenmen/ Slim / Klimax piercing elkészítése, és a fülbe helyezése nem minősül orvosi tevékenységnek. Orvosi tevékenységi körbe tartozó tevékenységet a Medical Piercing egyik alkalmazottja sem végez.
> **Tájékoztatás és tudomásulvétel a piercing viselésével járó kockázatokról** – A Vendég tudomásul veszi, hogy a piercing típusa, mérete és elhelyezkedése függvényében … (a további bekezdések a `lib/modell/nyilatkozat.js`-ben szó szerint).
> Fentiek tudomásul vételét szolgáltatás igénybe vevő jelen okirat aláírásával kifejezetten tudomásul veszi és elfogadja.
