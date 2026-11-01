# Modellkereső landing (ingyenes piercing, 2026. nov. 25. és 30.) – TERVEZET v1

Készült: 2026-11-01. A wireframe-eket és a szöveges tervet a ChatGPT (OpenAI-kapcsolat: `gpt-5.5` + `gpt-image-2`) készítette a tulajdonosi brief alapján; ezt itt a Claude átnézte, a hibásan kitalált adatokat külön jelöli.
Képek: `wireframe-desktop.png`, `wireframe-mobil.png`. **Nem élő oldal, nincs foglaló: csak terv.**

## 1. Az ajánlat egy mondatban
Szerda nov. 25. és hétfő nov. 30.: vidéki piercereink szakmai vizsgát tesznek a budapesti szalonban; modellként a szúrás és az ékszer is **0 Ft**, az ékszert megtartod. Öt típus: szemöldök, orr, ajak, köldök, rook.

## 2. Oldalszerkezet (mobil-first, rövid)
1. Fejléc: logó, telefon, „Ingyenes időpont” gomb (nincs menü, ami elvinne az oldalról).
2. Hős: dátum-pill, cím („Ingyen piercing, az ékszerrel együtt – modelleket keresünk!”), 2 sor szöveg, elsődleges gomb, 4 bizalmi chip (0 Ft, steril, ingyenes kontroll, 4,8★ Google), csapatfotó + „25 modellhely”.
3. Három lépés (válassz → gyere el → hazaviszed az ékszert).
4. Az öt piercing (kártyák, fotóval).
5. „Miért ingyenes?”: kollégáink vizsgáznak, te vagy a modell + sötét kiemelés: „Nem kísérletezünk rajtad” + „Így vigyázunk rád” lista.
6. Foglaló: 1) piercing, 2) nap + időpont, 3) adatok + hozzájárulások (18+, adatkezelés, tudomásul vétel).
7. A nap menete (5 lépés).
8. GYIK (6–8 rövid kérdés).
9. Helyszín + térkép.
10. Záró CTA sáv („Csak két nap”), lábléc. Mobilon alul fix gomb.

## 3. Időbeosztás (minta: 10:00 kezdés, a tényleges idősáv megerősítendő)
Egy piercer 120 perc alatt 5 szúrást végez, mindegyik 24 perc, mind az öt típusból egyet. A piercerek eltolva (forgatva) kezdenek, hogy ugyanabban az időben ne ugyanazt a típust szúrják.
Minden 24 perces szúráshoz két foglalás tartozik: elsődleges (:00) és tartalék (+12 perc). Így nov. 25-én 20, nov. 30-án 30 foglalás adható ki, a valós igény 10, illetve 15.

**Nov. 25. (2 piercer)**
- P1: 10:00 Szemöldök · 10:24 Orr · 10:48 Ajak · 11:12 Köldök · 11:36 Rook
- P2: 10:00 Orr · 10:24 Ajak · 10:48 Köldök · 11:12 Rook · 11:36 Szemöldök
- Időpontok típusonként (elsődleges / tartalék): Szemöldök 10:00/10:12 · 11:36/11:48 — Orr 10:00/10:12 · 10:24/10:36 — Ajak 10:24/10:36 · 10:48/11:00 — Köldök 10:48/11:00 · 11:12/11:24 — Rook 11:12/11:24 · 11:36/11:48

**Nov. 30. (3 piercer)**: ugyanez, a P3 két típussal eltolva (Ajak, Köldök, Rook, Szemöldök, Orr). Típusonként 3 elsődleges + 3 tartalék időpont.

## 4. A ChatGPT fő megállapításai
- Őszinte kerete: „Nem próba, hanem vizsgahelyzet” – de **ne állítsunk olyat, ami nem igaz** (pl. „tapasztalt oktató felügyelete mellett”, ha ez nem így van).
- A dupla foglalást a vendég felé ne „tartalék”-nak hívjuk, hanem „érkezési idősáv”, és kötelező tudomásulvétel kell a várakozásról. Kockázat: ha mindenki eljön, csúszás, rossz vélemény („ingyenes volt, de órákat vártam”).
- **Jobb / kiegészítő megoldás:** 48 és 24 órával előtte megerősítő SMS/e-mail („Igen, megyek / Lemondom”); a meg nem erősített foglalás felszabadul; típusonkénti várólista. Ez csökkenti a lemorzsolódást a túlfoglalás nélkül is.
- Foglalás közben egészségügyi előszűrő kérdések (terhesség, vérhígító, fémallergia, gyulladás stb.); kockázatos válasznál nincs automatikus ígéret, a munkatárs ellenőrzi.
- Kötelező: 18+, helyszíni beleegyező nyilatkozat, a kockázatok megemlítése, GDPR; a fotó/videó hozzájárulás külön, önkéntes, nem előre bepipált.
- Nem állítható: „kockázatmentes”, „fájdalommentes”, „garantált”, „azonnal sorra kerülsz”.

## 5. A wireframe-ek hibás / kitalált részletei (NEM használhatók)
- Cím: „1135 Budapest, Lehel utca 15.” és „Király utca 12.” – a valódi: **1137 Budapest, Újpesti rakpart 7. (5. em. 25.)**.
- „Jászai Mari tér (M2, 4-6 villamos) – 3 perc séta”, „Deák Ferenc tér”: kitalált tájékoztatás; helyesen a Jászai Mari tér villamosmegálló.
- Nyitvatartás „H–P 10:00–19:00”: a valódi H–P 9:00–19:00; „© 2025”, „piercingstudio.hu”, „+36 30 123 4567”: helykitöltők.
- Mobilon „Kedd – nov. 25.”, „Vasárnap – nov. 30.”: a helyes **szerda** és **hétfő**.
- „Képzett szakembereink”, „Vizsgáztatott szakemberek felügyelete”, „Tapasztalt oktató felügyelete mellett”: a felügyelet módja **nincs megerősítve**.
- Az időpont-chipek (10:00, 11:00 …) csak minták.

## 6. Nyitott kérdések (válasz kell az építés előtt)
1. Hánykor kezdődik a 120 perces ablak nov. 25-én és nov. 30-án?
2. Ki felügyeli a vizsgát, és mit mondhatunk róla pontosan?
3. A dupla foglalás marad, vagy 48/24 órás megerősítés + várólista? (vagy a kettő együtt)
4. Hol lesznek a piercerek: mindkét nap a budapesti szalonban?
5. Pontosan milyen ajak- és orrpiercing (labret? orrcimpa?), és melyik fülön a rook?
6. Milyen ékszer jár (G23 titán), és kapnak-e utóápoló terméket?
7. Mikor és hogyan történik az ingyenes kontroll?
8. Fotó/videó kell-e a modellekről (vizsgához, marketinghez)? Ha igen, külön önkéntes hozzájárulással.
9. Késési szabály (pl. 10 perc után elveszhet a hely?), és hány várakozó fér el kényelmesen a szalonban.
10. Kell-e külön részvételi feltétel (ÁSZF/akció) oldal?
11. Valódi fotók az öt piercingtípusról (ez a konverzió egyik fő eleme).

## 7. Amit a következő körben építünk (jóváhagyás után)
Saját, egyszerű foglaló (nem Salonic): szabad helyek típus × nap × időpont szerint, atomikus kapacitásellenőrzés, visszaigazoló e-mail + SMS, lemondó link, megerősítő és emlékeztető üzenetek (a meglévő levélmotorral), egészségügyi előszűrő. Mérés (Meta-pixel/konverzió) csak a kifejezett jóváhagyásod után.
