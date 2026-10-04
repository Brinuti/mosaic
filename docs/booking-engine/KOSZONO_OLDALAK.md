# Köszönő oldalak leltára (2026-10-04)

Minden oldal elérhető az előnézeten (`https://claude-booking-design-1.mosaic-d77.pages.dev<útvonal>`) és élesen (`https://www.mosaicheadspa.hu<útvonal>`); a meglévő (Wix-klón) oldalak az előnézeten bájtra azonosak az élővel, a mérés (suti.js) csak az éles tartományon fut. Ellenőrzés (helyi build, asztali + mobil): mind a 23 betölt, nincs törött kép, nincs JS-hiba, nincs vízszintes túlcsordulás.

## Foglalás utáni köszönő oldalak (a Salonic ide irányít sikeres foglalás után; itt fut a konverziós mérés)

| Útvonal | Mi ez | Tartalom |
|---|---|---|
| `/success-foglalas` | HeadSpa (általános) | „KÖSZÖNJÜK. Foglalásod megérkezett.” + tudnivalók videó |
| `/success-foglalas-egyeni`, `/success-foglalas-egyeni-vip` | HeadSpa Egyéni (normál / VIP) | ugyanez, a kezeléshez igazítva |
| `/success-foglalas-paros`, `/success-foglalas-paros-vip` | HeadSpa Páros (normál / VIP) | ugyanez |
| `/success-foglalas-4kezes` | HeadSpa Négykezes | ugyanez |
| `/foglalas-ok` | HeadSpa (Bécsi út 13) | megközelítés, parkolás, szalon-bejárat fotókkal |
| `/ajikartya-ok` | Ajándékkártyás (kuponos) foglalás | megközelítés, parkolás (Bécsi út 11) |
| `/fodrasz-ok` | Fodrászat | megközelítés, parkolás (Bécsi út 11), MOSAIC Hair |
| `/oxigenterapia-ok` | Oxigénterápia | megközelítés + „Fontos információ: kezelés előtt” |
| `/elysion-ok` | Lézeres szőrtelenítés (Elysion-fiók: kezelés és ingyenes konzultáció; a motor ide adja át a lézeres foglalást) | megközelítés + kezelés előtti tudnivalók |
| `/szortelenites-ok`, `/szor-konzi-ok` | Lézeres szőrtelenítés (régebbi oldalak: kezelés / konzultáció) | kezelés előtti tudnivalók / megközelítés, parkolás |
| `/eltavolitas-ok`, `/korrekcio-ok` | Sminktetoválás: eltávolítás, korrekció | megközelítés + kezelés előtti tudnivalók |
| `/pmu-ok` | Sminktetoválás (sikeres foglalás / személyes konzultáció) | az új PMU-foglaló „Sikeres foglalás!” képernyője (naptárba, „Ott leszek”, „Mi történik most?”) |

## Visszahívást kérő köszönő oldalak

| Útvonal | Mi ez |
|---|---|
| `/pmu-vh` | Sminktetoválás: „Telefonos konzultációt kértél!” (10 perces visszahívás; a PMU-foglaló képernyője) |
| `/pmu-lead-ok` | Sminktetoválás: fotó / visszahívás-kérés után („Rögzítettem a visszahívás kérésedet!”) |

## Egyéb köszönő oldalak

`/success-ajandekkartya` (utalásos ajándékkártya-vásárlás), `/success-ajandekkartya-stripe` (kártyás vásárlás), `/success-elofizetes` (bérlet / előfizetés), `/allashirdetes-ok`, `/fodrasz-allas-ok` (jelentkezés elküldve).

## A motor saját végképernyői (mintanézet, foglalás nélkül; élesen a motor a fenti meglévő oldalakra ad át)

- `/foglalo-motor?minta=siker` (Sikeres foglalás!; üzletáganként: `&business=hair`, `&business=oxygen`, `&business=laser`; a kezelő fotóval / névvel, „Ott leszek”, „Mi történik most?”), `?minta=elkelt` (az időpont közben elkelt), `?minta=hiba`, `?minta=ellenorizetlen`
- visszahívás: `?minta=nincs-idopont` (visszahívás-kérő űrlap), `?minta=visszahivas-kesz` (Visszahívást kértél!)
- PMU: `/foglalo-pmu?minta=kezeles#koszonjuk`, `/foglalo-pmu?minta=konz#koszonjuk-konzultacio`, `/foglalo-pmu?minta=visszahivas`, `/foglalo-pmu?minta=foto` (Megkaptam a fotódat!)

## Megfigyelések (1. kör)

- A meglévő oldalak a sötétzöld Wix-stílusban vannak, a motor és a PMU-képernyők krémszínűek: a két világ kinézete eltér.
- Minden foglalás utáni oldalon ott van a „Októberi akció! – 20% kedvezmény minden headspa foglalásra + ajándékkártyára” sáv és a teljes főmenü (a lézeres / fodrász / oxigén foglalás után is a HeadSpa-akció látszik).
- Az oldalak tartalma üzletáganként más-más struktúra (videó / megközelítés / kezelés előtti tudnivalók); a PMU-oldalaknál van „Mi történik most?” lista, a többinél nincs.
- Mobilon a cím (KÖSZÖNJÜK…) a betöltés után kb. egy másodperccel jelenik meg (Wix-animáció), addig üres sáv látszik.
- A motor végképernyőin a lépésjelző a kész visszahívás-képernyőn feleslegesen látszott (javítva: A1_SENT nincs lépésjelző).
- Mérés: az átalakítás előtt a konverziós mérés (Meta, GA4, Google Ads, TikTok) ezeken az oldalakon fut; a design-módosítás nem érintheti.
