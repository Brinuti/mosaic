# Medical Piercing – az őszi akció oldala „hidegeknek” (/3-piercing-2-araert, 2. kör) – teszt-napló (2026-10-17)

## A tulajdonos kérése (röviden)
Cím: „Megéri kettő vagy három közérzetjavító piercinget szúratni”, alcím: „Nem csak azért, mert kedvezményesebb árúak, hanem … együtt jobban kifejtik egymás hatását”,
előszöveg az akcióról; a kép: videó / kollázs / tiszta kép fülről több (három) piercinggel; a „Több piercing = Erősebb hatás” mellett a galéria marad, a szöveg helyén szakmai
blokk: melyiket kérik párban, három hármas csomag (Migrén + Shenmen + Klimax, Migrén + Shenmen + Máj, Klimax + Shenmen + Slim), ChatGPT-vel, képekkel, hogyan erősítik egymást,
kik szúratják; a „Tudtad, hogy” ebbe olvad; a 9 ok és a 93% marad; a piercing-rácsból a divat fülpiercing ki, a képen jelölés (pár / hármas); a vélemények: Trustindex
„2-3 piercing” címke, új cím és alcím; a csapat lapozó; a vendégvideók közül, akik 2-3 piercinget szúrattak, a vélemények alá.

## Mi változott
- Hős: a kért cím / alcím, előszöveg az akcióról (a meglévő árak), „Melyiket válasszam?” gomb a csomagokhoz; a kép három valódi fülfotó a Drive-ról (képtár-címkék alapján,
  három különböző vendég, mindegyiken három közérzetjavító piercing), lassan váltakozva. Tiszta, közérzetjavító piercinges videó nincs a Drive-on (a talált videókon a fülcimpában
  divat-lyukak vagy szilikon műfül látszik).
- „Több piercing = Erősebb hatás”: szakmai bevezető, árak, a galéria marad; alatta „Ezeket a piercingeket kérik leggyakrabban együtt”: a két pár (a „Tudtad, hogy” párjai) + három
  hármas csomag (kép: a fül a három ponttal, a csomag pontjai, „Hogyan erősítik egymást?”, „Kik választják?”, „Ezt a hármast kérem” → a foglaló a 3 piercinges csomaggal);
  a szöveg a ChatGPT (gpt-5.5) javaslata a szalon saját leírásaiból.
- A „Tudtad, hogy...?” szakasz megszűnt (a tartalma a csomagoknál).
- Piercing-rács: 9 kártya (a divat fülpiercing ki), a képen alul: „Párban + Shenmen” / „Hármasban + Migrén + Shenmen” stb.
- Vélemények: új cím és alcím; alattuk „Akik 2-3 piercinget szúrattak”: 9 vendégvideó (a 37 leirat átnézésével: 1 vendég három, 8 két piercingről mesél).
- Csapat: lapozó (asztalon 4, tableten 2, mobilon 1 + a következő széle).

## Trustindex
Belépve (a tulajdonos engedélyével) csak olvastam: az oldalon a „SHENMEN – 2026” widget fut (a Shenmen címkére szűr), a „2-3 Piercing” címke létezik (755 vélemény), de egyik
widget sem szűr rá (33 widget átnézve). Új widget (a SHENMEN – 2026 klónja, 2-3 Piercing szűrővel) létrehozását a munkamenet biztonsági ellenőrzése megállította – a tulajdonos
külön engedélye kell; addig a mostani widget marad.

## Mérés
Nem érinti (a mérőkód fájljai nem változtak; a csomag-gomb a meglévő `data-csomag` előválasztás, a foglalási út és a mérés ugyanaz).

## Tesztek
- `uj-oldalak-teszt`: 174 oldal, 5769 ellenőrzés, 0 hiba – benne a `-regi` cím összevetése a Wix-es eredetivel (a 2. kör szándékosan átírt sorai a `SZANDEKOS_LAP` sorban)
- `uj-b-teszt`: 19 B-oldal, 1042 ellenőrzés, rendben; `uj-fooldal-teszt` rendben; `csuszas-teszt` (206 + 206 lap): nincs csúszás; `meres-teszt` rendben
- a csomag-gomb („Ezt a hármast kérem”) megnyitja a foglalót a 3 piercinges csomaggal (a helyszín-lépéstől, mint a meglévő csomag-gomboknál)
- a hős képváltása: 0,5 mp – 1. fotó, 6 mp – 2., 10,5 mp – 3.; szemrevételezés 1440 px és iPhone 13 teljes oldal; vízszintes túlcsordulás nincs

## 3. kör (a tulajdonos kérései, 2026-10-17, az élesítés után)
- alcím: „…mert együtt, egymást erősítve jobban kifejtik hatásukat.” (az „egymás hatását” magyartalan); „Vendégeink nagy többsége” a „81%-a” helyett
- az akció kiemelése: a hősben keretes előszöveg „Őszi akció · visszavonásig” jellel; a „Több piercing” dobozban az 1 / 2 / 3 piercing ára kiemelt csempéken
  („Akció · visszavonásig tart”, a 3 piercing „Legjobban megéri”); asztalon a galéria pontosan a szöveghasáb magasságában (500 px széles)
- a két páros csempe (Migrén + Shenmen, Klimax + Slim) kimaradt; a csomag-kártyákon az ár középen (asztalon és mobilon)
- a piercing-rács címe: „Ezeket a piercingeket érdemes párban vagy hármasban választani 👇” (a kérés szövege megszakadt, a képek jelöléseihez igazítva)
- a videós blokk címe: „Videóban mesélnek a vendégeink, akik több piercinget szúrattak”
- a „9 ok” lapozó kártyái mobilon is egyforma méretűek (a mobil saját magasság visszavonva)
- **véleményszám mindenhol a mostani** (5 033, a lap betöltéskor frissíti): az új lapokon minden régi szám („Több mint 3.400 értékelés”, „1.745 értékelés”,
  „2.436 vélemény”, „4 900+ Google-vélemény”, „4.600+ vendégünk leírta” …) a Google mostani száma; a nem /regi/ alatti Wix-lapokon (pl. egy blogcikk) a build írja át
  (5.033); a /regi/ archívum változatlan. Ellenőrzés: az összes új lap látható szövegében csak 5033 / 5.033 maradt.
