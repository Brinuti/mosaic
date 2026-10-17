# Medical Piercing – „9 ok” lapozó valódi fotókkal (/3-piercing-2-araert) – teszt-napló (2026-10-17)

## A tulajdonos kérése
„Ez így nem lesz jó, ugyanolyan csúnya … tegyél bele fotókat … ne kamufotót tegyél bele, hanem olyan fotót, amit találsz a Drive-on, medical piercinges, és megy a
mondanivalójához … fel van címkézve” (a képtár-címkék táblázata, `tools/kepcimkezo/README.md`).

## Mi változott
- A 9 kártya felül egy-egy valódi fotót kapott a Drive-ról (a címkéző táblázatból: MP-fiók, kész, 3-as minőség, felirat nélkül; ~190 jelölt szemrevételezve),
  3:2-re kivágva (`assets/img/uj-ok-1…9.webp`, 1200 × 800, + a válaszadó változatok), a fotó sarkában rózsás körben a sorszám, alatta a cím és az eredeti szöveg (változatlan).
  1. szakterület – a szúrás helyének kijelölése steril kesztyűben; 2. tapasztalat – Brigi és Gabi; 3. „működnek” – gépi pontbemérés; 4. sterilitás – autoklávban,
  egyenként csomagolt ékszerek; 5. több piercing – fül több piercinggel; 6. garancia – Ricsi a vendéggel átbeszéli a kezelést; 7. ékszerek – mintatábla;
  8. „szeretnek minket” – mosolygó vendég Ricsinél; 9. „melletted leszünk” – Gabi a vendéggel.
- Csak a mostani csapat szerepel (Ricsi, Gabi, Brigi); a volt kolléganő (a tulajdonos 2026-10-16-i jelzése) egyik képen sincs.
- A lapozó nyilai a fotók közepének magasságában; az ikonos körök és a halvány nagy sorszám helyett a fotó.

## Mérés
Nem érinti (a mérőkód fájljai nem változtak, csak a lap tartalma és stílusa).

## Tesztek
- `uj-oldalak-teszt`: 174 oldal, 5769 ellenőrzés, 0 hiba (a `-regi` cím összevetése a Wix-es eredeti szövegével is)
- `csuszas-teszt` (206 + 206 lap, késleltetett képekkel): nincs csúszás; `meres-teszt`, `uj-fooldal-teszt`: rendben
- szemrevételezés: 1440 px (3 kártya, lapozás), 820 px (2 kártya), iPhone 13 (1 kártya + a következő széle, ujjal húzás); vízszintes túlcsordulás nincs;
  a kártyák egyforma magasak, a fotó minden szélességen 3:2, nem vágódik tovább
