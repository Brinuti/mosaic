# Medical Piercing – 9. kör: TikTok-landoló (orvosi szavak nélkül), akció-oldal (csomag-gombok, az oldal stílusa) – teszt-napló (2026-10-16)

Helyben, a végleges buildre (`node tools/build.mjs`, `node tools/serve.mjs`). A Salonic felé csak olvasó GET megy, foglalás nem indult. A mérési próba (`tools/meres-teszt.mjs`)
minden adatküldő kérést elkap és eldob: egyik platformhoz sem jutott el semmi.

## A tulajdonos kérései
1. TikTok-landoló: „a szöveget … egy-egybe az eredetiről vedd át”, de „nem lehet sehol sem, se migrén, se klímax, semmi ilyesmi, nem lehet a thumbnail-es videók thumbnail-en se
   … semmi olyasmi kifejezés, ami orvosi” („nagyon vigyázni kell az ilyen panaszszavakkal, mert letiltják”).
2. Akció-oldal: a 2 / 3 piercinges doboz „Ezt foglalom” gombja „vigyen arra”; a foglalóban „a kártyák ugyanúgy legyenek csukva”; a vendégvideók nagyobbak, lapozhatók;
   az összes helyszín kinyitva; az asztali szakaszok az oldal mostani kinézetéhez igazodjanak (alapszabály: PDF-terv alapján is az oldal stílusa).
3. Foglaló: alapból a 2–3 piercing legyen kiválasztva – ez élesben már így van (friss böngészővel ellenőrizve); a régi alapérték egy korábban megnyitott, nem frissített lapon látszott.

## Mérés – MÉRÉST ÉRINT
A mérőkód fájljai (`suti.js`, `mp-meres.js`, `motor-indito.js`, `salonic-adapter.js`, `booking-id.js`) nem változtak. Az akció-oldal csomag-gombjairól nyitott foglalóban
a típusválasztó („Új piercing”) kimarad, ezért a foglalásindítás mérése (`meres()` → GA4 `foglalas_inditasa`, TikTok InitiateCheckout stb.) a helyszín-lépés megnyílásakor fut –
nyitásonként pontosan egyszer (a próba a `mpSuti.foglalasInditas` hívásait számolja: 1). A többi foglalási út változatlan. A TikTok-landoló foglalási gombjai a meglévő
`/idopontfoglalas` és Salonic-helyszín linkek (a motor fogja el őket), a landolón a mérőkód ugyanaz, mint eddig.

## Vendégadat
Nem került új vendégadat a repóba. A landolóról a Google-véleménydoboz és a vendégvideók lekerültek; a csapat-kártyák fotói az eredeti landoló saját fotói.

## Eredmények
| Teszt | Eredmény |
|---|---|
| `tools/uj-oldalak-teszt.mjs` (mind) | 174 oldal, 5729 ellenőrzés, 0 hiba (a landolón új ellenőrzés: rövid fejléc – logó, Vélemények, Időpontfoglalás, menü nincs – és tiltott szavak, asztali és mobil) |
| `tools/uj-oldalak-teszt.mjs --forras` | 1224 ellenőrzés, 0 hiba |
| `tools/uj-fooldal-teszt.mjs` | minden rendben (102 ellenőrzés) |
| `tools/motor-tipus-teszt.mjs` / `--mobil` | minden rendben (120 / 124 ellenőrzés) |
| `tools/motor-teszt.mjs` / `--mobil`, `tools/motor-formazas-teszt.mjs` | minden rendben (26 / 26 / 90 ellenőrzés) |
| Csomag-gombok (Playwright, asztali + iPhone 13; 1 / 2 / 3 piercing és a ragadós sáv) | minden rendben (12 ellenőrzés): a típusválasztó kimarad, a helyszín jön, a csomag elöl, csukva; a foglalásindítás mérése pontosan 1-szer fut; szűrőváltás után a szokásos rend |
| `tools/meres-teszt.mjs` (éles domainnév, adatküldés nélkül) | minden rendben (85 ellenőrzés), a TikTok-landoló utáni foglalási út is |
| Tiltott szavak a TikTok-landolón (látható és rejtett szöveg, alt / title / aria / meta, komment; asztali + mobil) | 0 találat; a linkek közül csak a Vélemények oldal címe (`/migren-shenmen-piercing-velemenyek`) tartalmazza – az eredeti landoló is ide linkelt |
| Szemrevételezés (1440 / 390 px) | landoló: hős, akció + ékszer-lapozó, értékelés, 15 helyszín, árlista, páros akció, kontroll, csapat, lábléc; akció-oldal: szakaszok az oldal stílusában |
