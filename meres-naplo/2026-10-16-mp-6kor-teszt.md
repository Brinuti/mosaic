# Medical Piercing – 6. kör: vágás nélküli videó-indexképek, Vélemények hőskép, álló videók lejátszás-gombja – teszt-napló (2026-10-16)

Helyben, a végleges buildre (a main #356-os változásaival összefésülve). Foglalás nem indult, a mérőkód nem változott.

## A tulajdonos kérései
1. A Vélemények oldal hősképének tetején és alján fehér csík van; a kép bárhol kattintható legyen, és a migrénes videókhoz vigyen.
2. A generált indexképek minden nézetben látszódjanak – „egy csomó nézetben le vannak vágva” (pl. a migrén-oldal Gabi-videója).
3. Az álló videónál („Általában…”) a lejátszás-gomb és egy világos sáv a videó mellé lóg.

## Okok és javítások
- **Csík:** a hőskép 1200×800-as, a kerete 1200/823 arányú volt, „ne vágd” módban → fent-lent pár px üres. Most a kép saját arányában (3:2) van, és link a `#videok-migren`
  videósávhoz (minden videósáv horgonya `videok-<kulcs>`).
- **Vágott indexképek:** a kéthasábos dobozok hasábjai egyforma magasak (korábbi kérés), ezért a videó doboza nem 16:9-es → a borító két széle vagy alja-teteje levágódott
  (1440 px-en 10–28%, 1100 px-en 22–40%). Most a tervezett képek (`YT_KEP`, a lapba közvetlenül írtak is) egészben látszanak, a doboz maradékát a kép saját széle
  tölti ki (a legfelső / legalsó sorai kinyújtva).
- **Lejátszás-gomb:** a hős álló videóját `left:50%` + `translateX(-50%)` teszi középre; a gomb helyét az `offsetLeft`-ből számoltuk, ami ezt nem látja → a gomb és az áttetsző
  rétege a videó felével jobbra csúszott. Most a látható helyből (`getBoundingClientRect`) számolódik, és a szülő méretváltozására is újraigazodik.

## Eredmények
| Teszt | Eredmény |
|---|---|
| Borító-láthatóság (minden új oldal, 1440 / 1100 / 820 / 390 px; eseti Playwright-szkript) | előtte 24 vágott eset (10–40%); utána 0 – a maradék 4 jelzés a lapozható sávok képernyőn kívüli kártyája (begörgetve teljesen látszanak) |
| Lejátszás-gomb helye (minden saját álló videó, 4 szélesség) | előtte a Mester Brigitta-oldal hősében 124 px eltolás (1100 px); utána mindenhol a videón |
| Vélemények hőskép (asztali, iPhone) | csík nélkül; kattintásra `#videok-migren`, a sáv a képernyő tetején |
| `tools/uj-oldalak-teszt.mjs` (mind, a javítás előtti állapoton) / `--gyors` (a javítás után) | 174 oldal, 5727 ellenőrzés, 0 hiba / 19 oldal, 686 ellenőrzés, 0 hiba |
| `tools/uj-oldalak-teszt.mjs --forras` | 1224 ellenőrzés, 0 hiba |
| `tools/uj-fooldal-teszt.mjs` | minden rendben |
