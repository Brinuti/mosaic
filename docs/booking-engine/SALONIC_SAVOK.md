# Hogyan ajánl a Salonic időpontokat (kezdési rács), és hogyan tükrözi a motor

Mérve és a Salonic admin felületéről kiolvasva: **2026-10-27**, Mosaic Hair fiók (`mosaic-hair`, Betti = 23694). Vendégadat nincs benne.

## 1. A rács forrása: a szolgáltatás saját mezője
A kínált kezdési időpontokat (08:00-tól induló rács) **szolgáltatásonként** állítható mező szabja meg, nem csak a fiók:

| Mező (Salonic) | Hol | Mit csinál |
|---|---|---|
| `Service[bookingMinutesInterval]` „Online bejelentkezés időintervallumok” | Beállítások → Szolgáltatások listája → Szerkesztés → Alapadatok, Haladó beállítások | a szolgáltatás kezdési időpontjainak lépésköze; „Rendszer alapértelmezés” = a fiók értéke |
| `OnlineBookingSettings[calendarMinutesInterval]` „Bejelentkezési időintervallumok” | Beállítások → Online bejelentkezés → Beállítások | a fiók alapértéke (Mosaic Hair: 30 perc) |
| `OnlineBookingSettings[optimizeFreeBlocks]` „Foglalható időpontok optimalizálása” | ugyanott | Nincs optimalizálás / Laza / Szigorú (lásd 3.) |
| `Service[advancedBookingTime]` „Egyedi online bejelentkezési idősávok” | szolgáltatás → Online bejelentkezés fül | egyedi napok/sávok; a Mosaic Hair szolgáltatásainál ki van kapcsolva |
| `Service[breakAfter]` „Szünet a szolgáltatás után” | szolgáltatás | a Mosaic Hair szolgáltatásainál „Nincs szünet” |

**Fontos:** a rács a szolgáltatásnál el is térhet a fiókétól és a szolgáltatás hosszától. A Mosaic Hair „Teljes festés” családjában négy szolgáltatás négy különböző rácsot ad.

Mért kezdési lépések (Betti, a nyilvános foglalón, szabad napon) és a szolgáltatás mezője (egyezik mind a 7-nél):

| Szolgáltatás | Hossz | Lépés | Mező |
|---|---|---|---|
| Teljes festés közepes (395337) | 150 | 210 | 3,5 óránként |
| Teljes festés rövid (395330) | 120 | 150 | 2,5 óránként |
| Teljes festés hosszú (395338) | 180 | 30 | Rendszer alapértelmezés |
| Teljes festés extra hosszú (470827) | 210 | 180 | 3 óránként |
| Teljes melír rövid (231546) | 150 | 120 | 2 óránként |
| Teljes melír közepes (231547) | 210 | 150 | 2,5 óránként |
| Tőfestés + vágás + szárítás közepes (231544) | 150 | 150 | 2,5 óránként |

A 43 Betti-szolgáltatásból 16 félórás rácsú, 21-nél a lépés a szolgáltatás hossza, 5-nél egyedi (a fenti 395337, 395330, 470827, 231546, 231547).

**Következmény (a foglalhatóságra, a töltöttségre):** a 3,5 órás lépésű, 2,5 órás szolgáltatás egy 11:30–20:00 szabad sávban csak 11:30-at és 15:00-t kínál; a 17:30-at nem, pedig az még belefér (17:30–20:00). A 2 órás lépésű melír 12:00-t kínál ott, ahol a festés nem. Így lett az okt. 29. 12:00 a melírnál foglalható, a közepes festésnél nem, holott Betti szabad.

## 2. A foglalómotor tükrözi a Salonicot
Betti 43 szolgáltatására a motor (fodrászválasztás: Betti) és a Salonic saját foglalója (az „Összes időpont” nézet, vendégként) ugyanazt a kínálatot adja. A motor a `getAvailableTimes` „bárki” (`employeeId=-1`) válaszát kapja, és a szakemberre kliensoldalon szűr; ez egyezett a Salonic Betti-nézetével. Egyetlen eltérés volt: a motor `dayTimes()` szabálya a :15 / :45 kezdést elrejtette, ha mellette volt :00 / :30 (PMU-szabály, `flow.js`), pl. nov. 24. 17:15. **Ez a foglalás utáni szoros kezdést rejti el** (a „Laza” pont ezt ajánlja, pl. 16:15 a 16:30 mellett), ezért 2026-10-27-től a motor minden Salonic által kínált kezdést mutat (PR: `dayTimes` egyszerűsítése, előnézeten tesztelve; élesítés Feri „Mehet” szavára).
- A **Fodrász konzultáció**nál a motor NEM kérdez fodrászt (egyenesen a naptárra visz, „bárki” módban): ott nincs szakember-szűrés.
- A Salonic **adatlapja (`/guestData/`) bármilyen időponttal megnyílik** (még vasárnap hajnali 3:00-val is), és csak a végső „Foglalás” gombnál érvényesít. Kívülről nem derül ki, hogy egy időpont foglalható-e; ehhez próbafoglalás vagy a belső naptár kell.
- A naptár-API nincs gyorsítótárazva (nincs `cache-control`, Cloudflare `DYNAMIC`).

## 3. Az „Optimalizálás” (Salonic súgó, `/helper/bookingOptimize`)
- **Nincs optimalizálás:** minden szabad időpontot kiajánl.
- **Laza:** üres napon minden szabad időpontot; ha már van bent időpont vagy szünet, akkor mellé, valamint a nap elejéről és végéről.
- **Szigorú:** ha már van bent időpont vagy szünet, csakis mellé.

Mérés (2026-10-27, a Salonic admin és a nyilvános foglaló egymás mellett, mindkét állapotban): a „Nincs optimalizálás” → „Laza” váltás **azonnal csökkenti a kínálatot a foglalásos napokon**, üres napon nincs különbség. Példák (Betti, nov. 9., amikor már van foglalás):

| Szolgáltatás | Nincs optimalizálás | Laza |
|---|---|---|
| 395337 Teljes festés közepes (rács 210) | 09:00, 11:30, 16:15 | 09:00, 16:15 |
| 395338 Teljes festés hosszú (félórás rács) | 09:00–12:30 félóránként, 16:15, 16:30, 17:00 | 09:00, 12:30, 16:15, 17:00 |
| 231546 Teljes melír rövid (rács 120) | 09:00, 10:00, 12:00, 16:15 | 09:00, 16:15 |

Vagyis a „Laza” a szabad sáv **elejére és végére** (a következő foglalás elé) igazítja a kínált kezdéseket; kevesebb választék, szorosabb pakolás. Az okt. 29. 12:00 a 395337-nél mindkét állapotban hiányzik: azt az időköz okozza.
*(Az első, „nem változott” megállapításom téves volt: az „előtte” mérésem hibás gyűjtésből jött.)*

## 4a. Foglaltság (Salonic „Munkaidő kimutatás: Vendégóra / Munkaóra”, 2026. aug. 31 – okt. 25, 8 hét; összesített, vendégadat nélkül)
| | Lefoglalt / elérhető perc | Foglaltság |
|---|---|---|
| Betti | 13 825 / 24 135 | 57,3% |
| Evelin | 6 990 / 13 215 | 52,9% |
| Noel | 5 170 / 13 305 | 38,9% |
Az elérhető perc a blokkokkal (szabi, szünet) csökkentett nettó munkaidő, a mostani beállításból számolva. Az elmúlt 8 hétben a 7 vizsgált szolgáltatásra összesen 17 foglalás volt a 225-ből.

## 4b. Eredeti beállítások (visszaállításhoz; 2026-10-27 reggel, a mérés előtt)
Optimalizálás: **Laza** (a mai teszt alatt átmenetileg „Nincs optimalizálás”, 22:16-kor visszaállítva Lazára); fiók szintű intervallum: 30 perc; szolgáltatás-intervallumok: 395337 = 210, 395330 = 150, 395338 = alapértelmezés, 470827 = 180, 231546 = 120, 231547 = 150, 231544 = 150 perc. Megjegyzés: az Optimalizálás legördülője a módosításkor magától ment; a szolgáltatás mentéséhez a fejlesztői ablak jóváhagyó felülete külön engedélyt kér.

## 4. Mérési módszer és buktatók
Eszközök: `tools/salonic-egyezes/`. A Salonic oldalait a `?mh_nincs_atiranyitas=1` kerüli ki (különben a `salonic/atiranyitas.js` a főoldalra irányít). Buktatók, amelyek hamis eltérést adtak:
1. egy nap időpontjai ~1,5 mp késéssel töltődnek be; addig az előző nap listája látszik, ezért a napot a gombok dátumához kell kötni;
2. a túl gyorsan jövő kattintást a Salonic elnyeli: újrapróbálás kell;
3. a szomszéd hónap „kilógó” napja ugyanazt a címkét viseli: csak az aktív hónap saját napjára szabad kattintani;
4. a hónapváltás után a szabad napok késve kapcsolódnak be: több körben kell olvasni;
5. a konzultációnál a motor nem kérdez fodrászt (lásd fent).
Mérésnél a hirdetési mérők tiltva (GTM, Meta, TikTok, Google); a motor a robotot (Playwright, `navigator.webdriver`) nem számolja a belső tölcsérbe, valódi Chrome-mal járt lépések viszont beszámolódnak.

## 4c. Beállítás-változások naplója (Mosaic Hair, Salonic admin; a változtatás a LOCAL + BROWSER ablakban, Feri kérésére)
| Idő (Europe/Budapest, 2026-10-27) | Mi | Régi → új |
|---|---|---|
| 22:16 | Optimalizálás | Nincs optimalizálás (Feri tesztje) → **Laza** (az eredeti) |
| 22:27–22:30 | 395337 időköz (teszt) | 3,5 óra → alapértelmezés → **vissza 3,5 óra** |
| 22:41 | 395337, 395330, 470827 időköz | 3,5 / 2,5 / 3 óra → **Rendszer alapértelmezés (30 perc)**, MARAD |
| 22:42 | 231546, 231547 időköz | 2 / 2,5 óra → **Rendszer alapértelmezés (30 perc)**, MARAD |
Mérés utána (Betti, nyilvános foglaló): okt. 29-én a 395337, 395330, 231546 kínál 12:00-t; dec. 1-jén félóránként 08:00-tól a szabad sáv végéig; nov. 9-én a foglalás előtti/utáni szoros kezdések (pl. 13:00, 16:15, 17:30). A 231544 (2,5 órás lépés) és a 21, a hosszával egyező lépésű szolgáltatás nem változott.
Visszaállítás: a régi értékek a fenti táblázatban és a 4b. részben vannak.
**Kiértékelés 2026-11-24 körül (4 hét):** a Salonic „Munkaidő kimutatás: Vendégóra / Munkaóra” jelentés (Betti / Evelin / Noel, heti bontás) a 4a. alapszámokhoz képest (Betti 57%, Evelin 53%, Noel 39%), plusz a motor tölcsére (időpont-megtekintés → adatlap → foglalás). Egyszerre csak ezt a változást mérjük; az Optimalizálás (Laza) marad.

## 5. Nyitott
- (Elvégezve, lásd 6.) Az összes többi fiók rácsainak auditja és a motorok egyezés-mérése.
- Döntés Feritől: egységesítsük-e a rácsokat (pl. mindenhol „Rendszer alapértelmezés” = 30 perc, „Laza” optimalizálással). A Salonic-beállításokat csak Feri kérésére módosítjuk.

## 6. Minden motor mérése a Salonic foglalójával (2026-10-28)
Módszer: a Salonic nyilvános foglalója (vendégként, böngészőből) és a motor UGYANABBAN az időben, ugyanarra a szolgáltatásra; a közös időszak a két oldal legkorábbi „utolsó napja". Eltérésnek csak az számít, ami három mérésben is megvan (egyszerre, újra egyszerre, egymás után terhelésmentesen). Eszközök: `tools/salonic-egyezes/` (`uzletag.mjs`, `mp.mjs`, `gy-a76.mjs`, `pmu.mjs`). Foglalás nem indult, mérőkódok tiltva.

| Motor | Mért | Egyezik | Megjegyzés |
|---|---|---|---|
| Mosaic Lézer | 47 szolgáltatás | 47 | |
| Medical Piercing | 15 helyszín × 5 szolgáltatás (75) | 75 | mintavétel: a hosszúságonként első szolgáltatások |
| A76 (Oktogon, Móricz) | 44 szolgáltatás–helyszín | 44 | az egyszakemberes (Gyantázás) szolgáltatásnál nincs „Bárki" gomb, a szakember kártyáját kell választani |
| Mosaic Fodrászat | 44 szolgáltatás „bárki" + 14 szolgáltatás–dolgozó | 44 + 11 | Evelinnél 3 hosszú Balayage-nál a motor 1–2 időpontot többet kínál (okt. 30. 16:30; nov. 11. 14:00), a Salonic Evelin-nézetében ezek nincsenek (mindhárom mérésben); Betti 5/5, Noel 4/4 |
| Mosaic HeadSpa | 4 normál szolgáltatás | 4 | a 4 kuponos (ajándékkártyás) előbb kuponkódot kér, azt nem hasonlítottuk |
| Mosaic Oxigén | 3 szolgáltatás „bárki" + dolgozónként | 10 / 12 | az „Akciós hajkamerás vizsgálat"-nál a motor nem kínál dolgozó-választást (bárki), a Salonic igen |
| Gyógytornászom | 18 szolgáltatás–helyszín | 16 | 2 eltérés a Nyugati téren (lásd 6.2) |
| **Mosaic PMU** | 7 szolgáltatás | **0** | **javítva 2026-10-29: a :15 / :45 kezdések is látszanak, lásd 6.1** (korábban a Salonic időpontjainak kb. 48%-a nem látszott) |

### 6.1 PMU: a negyedórás kezdések rejtve voltak (javítva 2026-10-29)
**Javítás:** Feri 2026-10-29-i döntése szerint („amit a Salonic kínál, pontosan azt lássuk”) a `foglalo-pmu.js` minden Salonic-kínált kezdést mutat, a :15 / :45-et is. Az alábbi a javítás előtti állapot leírása.

A `assets/js/foglalo-pmu.js` 491–494. sora a negyedórás kezdést csak akkor mutatja, ha mellette nincs egész vagy fél óra (a motor a PMU-nál szándékosan ritkít). Mind a 7 szolgáltatásnál a Salonic-only időpontok 100%-a :15 / :45 kezdés (szolgáltatásonként 337–425 db a közös időszakban). Ez ugyanaz a ritkítás, amit a Mosaic motor `flow.js` `dayTimes()`-ából a #520 kivett; a PMU saját oldala külön fájl, ott nem változott. **Döntés Feritől kell** (a foglalási folyamatot érinti): ugyanazt akarjuk-e itt is, mint a többi motornál (minden Salonic-kínált kezdés látszik).

### 6.2 Gyógytornászom: a Salonic naptár-API nagy ablakoknál hiányos listát adhat
A `gyogytornaszomhu` fiókon (a Nyugati téren a legjobban) a Salonic naptár-API a motor lekérési mintájára (7 napos, majd 24 napos ablakok, párhuzamosan) időnként hiányos listát ad. A Salonic saját foglalója napi (1 napos) kéréseket küld, ott minden látszik. Mérés (90 nap, a napi lekérés az igazság):

| Helyszín / szolgáltatás | Motor-terv párhuzamosan | Motor-terv egymás után | 7 nap egymás után | 7 nap párhuzamosan | 3 nap párhuzamosan |
|---|---|---|---|---|---|
| 2581 Nyugati / 24666 | 183 hiányzik / 1005 | 150 | 0 | 192 | 0 |
| 418 / 24667 | 391 / 1457 | 0 | 0 | 0 | 82 |
| 8439 / 24666 | 0 / 1032 | 0 | 2 | 2 | 0 |

A mérés egyik napról a másikra ingadozik, és csak ezen a fiókon jelentkezik: az A76 (mindkét helyszín), a Medical Piercing (Budapest), a Mosaic Hair és a Lézer mind az öt lekérési mintával 0 hiányzó időpontot adott. A fiókon a legbiztonságosabb a lekérések egymás utáni (nem párhuzamos) küldése 7 napos ablakokban; ezt a motorba beépíteni külön fejlesztés és Feri döntése.

### 6.3 Mérési tanulságok
- A két oldalt AZONOS időben és azonos beállításnál kell gyűjteni; beállítás-váltás közben készült gyűjtések hamis eltérést adtak.
- Egyszerre futó kérések ritkíthatják a Salonic naptár-API válaszát (főleg a `gyogytornaszomhu` fiókon): a harmadik, egymás utáni mérés dönt.
- Az A76 motor a nagy 3. naptár-darabot később tölti be, és nincs „további napok" jelzője: a mérőnek várnia kell (`EXTRA_WAIT_MS`).
- A „nincs időpont" napokat a Salonic kiírja: a mérő ilyenkor nem próbálkozik újra.

### 6.4 Adatszintű mérés (2026-10-28, délután): a Salonic „bárki” (`employeeId=-1`) lekérése időnként hiányos
Módszer: az ÉLES motor-adapter listája (böngészőből, a motor lekérési tervével) vs. a Salonic szakemberenkénti (`employeeId=<szakember>`) naptár-adata, ami a Salonic saját foglalójának napi nézetével egyezik (Nagy Kinga: 166/166; Nóra, Dorina, Bianka: eltérés 0). Hiányzó = a motor nem kínál egy Salonic-időpontot. Eszközök: `tools/salonic-egyezes/adatszint-{gy,mp,mosaic,a76}.mjs`.

**Ok (Gyógytornászom, Nyugati tér, Nagy Kinga hiányzó időpontjai):** a „bárki” lekérés a sok szakemberes fiókokon (Nyugati: 11 szakember) ugyanarra a kérésre időnként hiányos választ ad (egyszer 70 KB, máskor 43–52 KB; egész napok hiányoznak); a szakemberenkénti lekérés mindig teljes. A gyógytornás motor a „bárki” listából kliensoldalon szűrt szakemberre, ezért Nagy Kingától 166-ból 127–149 időpontot kínált. **Javítva (#524):** a „bárki” módot a szolgáltatás szakembereinek (`data-employees`) külön lekérésével és egyesítésével adja az adapter; hibás szakember-lekérésnél a `-1` is lefut. Utómérés (éles): minden gyógytornás szakember × szolgáltatás (66 kombináció, 21 041 időpont) 0 hiány; Nagy Kinga 166/166 háromszor egymás után.

| Motor | Vizsgált kombináció | Időpont | Hiányzó a motorból | Megjegyzés |
|---|---|---|---|---|
| Gyógytornászom (a javítás után) | 66 szakember × szolgáltatás | 21 041 | 0 | #524 |
| Medical Piercing | 352 hely × szolgáltatás × szakember (15 helyszín) | 317 750 | 0 | |
| Mosaic (HeadSpa, Hair, Oxigén, Lézer, PMU – 5 fiók) | 210 üzletág × szolgáltatás × dolgozó | 104 390 / 104 720 (két mérés) | 0 / 0 | az adapter-réteg; a PMU saját oldalának :15/:45 ritkítása (6.1) külön ügy |
| **A76 (Oktogon, Móricz)** | 132 szolgáltatás × mérés | 143 058 | **időnként hiányzik** (lásd lent) | saját WordPress-bővítmény (`a76-foglalomotor`), forrása nem ebben a repóban van |

**A76:** az A76 motor „bárki” módban `employeeId=-1` lekéréseket küld (7 nap, majd 14 és 59 napos darab párhuzamosan), és a szakember-szűrés is használhatja a gyorsítótárazott `-1` darabokat. Az A76 saját lekérési mintájával 3 mérésben a szolgáltatás × mérés sorok ~8%-ában hiányos a „bárki” lista (a mérések különböző sorokat érintenek, tehát nem fix hiba, hanem a Salonic ingadozása): egy-egy szolgáltatásnál a különböző időpontok 2–13%-a (pl. Oktogon 4223 Hajvágás + szakálligazítás: 151 / 1166; Móricz 48782: 55 / 1373), a szakemberre szűrt listában ennél több. Összesítve: 502 hiányzó különböző időpont 143 058-ból (0,35%), 1909 hiányzó szakember-időpont. A hibát a másik ablak UI-szintű mérése nem látta (egyetlen sporadikus hiány az UI-n nem reprodukálódik). **Javítás (az A76-bővítmény forrásában, `getAvailability`):** „bárki” módban a szolgáltatás szakembereit (`service.staffIds`) külön kérni és egyesíteni (a Gyógytornászom #524 módosítása `public/assets/js/motor/salonic-adapter.js`, `getAvailability`); a szakember-szűrésnél ne a gyorsítótárazott `-1` darabokat, hanem a szakemberre szóló lekérést használni.
