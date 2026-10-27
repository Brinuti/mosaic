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
- Az összes többi fiók (A76, Gyógytornászom, Medical Piercing, a többi Mosaic-üzletág) rácsainak auditja: `tools/salonic-egyezes/audit.mjs`; az eredmény ide kerül.
- Döntés Feritől: egységesítsük-e a rácsokat (pl. mindenhol „Rendszer alapértelmezés” = 30 perc, „Laza” optimalizálással). A Salonic-beállításokat csak Feri kérésére módosítjuk.
