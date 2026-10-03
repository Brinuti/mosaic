# Élesítési terv – a közös foglaló bevezetése (HeadSpa, Oxigén, Fodrászat, Lézer)

Állapot: 2026-10-03. A foglaló ma a rejtett `/foglalo-motor` oldalon van, **élesben semmi nem változott**. Ez a terv azt írja le, hogyan kerül élesbe úgy, hogy **a hirdetési mérés nem romlik**, és **bármikor visszaállítható**.

## 1. Alapelvek

1. **A mérést nem írjuk át.** A mostani konverziók (Google Ads, Meta, TikTok, GA4, Stape, Zapier) a Salonic köszönőoldalainak URL-paramétereire épülnek. A motor ezeket a köszönőoldalakat használja tovább, ugyanúgy, ahogy a PMU foglaló ma is.
2. **Üzletáganként, fokozatosan**, a legkisebb forgalmúval kezdve.
3. **Egy kapcsolóval visszaállítható** minden lépés.
4. A **PMU foglaló nem változik** (külön, már éles motor).

## 2. A mostani helyzet (tények)

- 89 oldal, de **csak 19 különböző Salonic-link** van rajtuk: az átkötés kicsi és központi.
- A mérés a köszönőoldalakra épül (`/success-foglalas*`, `/foglalas-ok`, `/fodrasz-ok`, `/oxigenterapia-ok`, `/elysion-ok`, `/pmu-ok`): a GTM az útvonal és az URL-paraméterek (`first_booking`, `price`, `employee`, `bookingUrl`, `g`) alapján számol konverziót.
- Forgalom (28 nap, Salonic-oldalak munkamenetei): HeadSpa 8 103 · Fodrászat 4 069 · Oxigén 967 · Lézer 636.
- **Ma meglévő hibák, amelyeket az átkötés megold:**
  - A `headspa-budapest-hungary`, a `noi-fodraszat-hullam` és a `noi-fodraszat-szoke` oldal gombjai olyan Salonic-linkre mutatnak (`employees/23532`, `serviceId=239336`), amely már nem él: a Salonic főoldalára dobnak.
  - A **lézeres oldalak (8 db)** a **Hair** Salonic-fiók „Ingyenes konzultáció zsófihoz!” szolgáltatására (`444584`, rejtett, csak közvetlen linkkel él) mutatnak, miközben az Elysion-fiókban is van ugyanilyen nevű konzultáció (`476477`). Két párhuzamos naptár: eldöntendő, melyik az éles (lásd 7. pont).

## 3. Hogyan marad meg a mérés

Sikeres foglalás után a Salonic a mi köszönőoldalunkra irányít (az űrlap a mi oldalunkba ágyazva fut, ezért a keretbe). Ma a keretben betöltődő köszönőoldal a `suti.js` védelme miatt **nem mér**, és értesíti a szülő oldalt.

**Terv (átadás a meglévő köszönőoldalnak):** a motor az átirányítás ellenőrzése után (ár, időpont, szolgáltatás egyezik) a **teljes ablakban megnyitja ugyanazt a köszönőoldalt, ugyanazokkal a paraméterekkel**. A mérés így pontosan úgy fut, mint ma: egyszer, a fő ablakban, a GTM és a pixelek változatlan beállításával. A vendég a mostani köszönőoldalt látja. (A PMU foglaló ugyanígy működik.)

A motor saját sikeroldala (naptárba tétel, útvonaltervezés) a **második ütemben** jöhet: ott a köszönőoldal tartalma cserélődik, mint a PMU `/pmu-ok` oldalán, a mérés változatlanul.

**Nem nyúlunk** a GTM-konténerhez, a Meta-, TikTok- és Google-fiókokhoz. Az új funnel-lépések mérése (a motor `dataLayer` eseményei) külön, jóváhagyással jöhet később.

## 4. A gombok átkötése

Egy központi térkép (build-időben, üzletáganként egy kapcsolóval) a 19 Salonic-linket a motorra köti:

| Salonic-link (ma) | Új cél |
|---|---|
| HeadSpa: időpont foglalás (`showServices … specId=39592`, `selectSpecialization`, `employees/…`, régi `selectDate`) | `/foglalo-motor?business=headspa` |
| HeadSpa: kuponos beváltás (`specId=41471`) | `/foglalo-motor?business=headspa&voucher=1` |
| HeadSpa ajándékkártya-vásárlás (`/giftcards…`) | **marad** (nem foglalás; az új ajándék-oldal készül) |
| Fodrászat (`selectSpecialization`, `showServices …employeeId=23694`) | `/foglalo-motor?business=hair` |
| Oxigén (`selectEmployee … 466110` / `466158`) | `/foglalo-motor?business=oxygen&service=466110` / `…=466158` |
| Lézer (`specId=66404` / `66405`, konzultáció) | `/foglalo-motor?business=laser` (konzultációnál `&service=konzult`) |
| PMU | **marad** (külön, már éles motor) |

A régi linkeket a kapcsoló visszakapcsolásával azonnal visszakapjuk.

## 5. Sorrend és mérőszámok

1. **Oxigén** (a legegyszerűbb folyamat, 967 munkamenet) →
2. **Lézer** (636) →
3. **Fodrászat** (4 069) →
4. **HeadSpa** (8 103, utoljára: a legnagyobb forgalom, kupon- és ajándékkártya-ágakkal).

Üzletáganként: ① egy valódi próbafoglalás (lásd 6.), ② átkötés, ③ **3–7 nap figyelés**: a Salonic foglalásszáma, a GA4 konverziók és a hirdetési konverziók egybevetése az előző időszakkal; ④ ha eltérés van (pl. a foglalások száma esik, vagy a konverzió nem érkezik), azonnali visszaállítás.

## 6. Előfeltételek (üzletáganként)

- [ ] A Salonic-fiókban beállítva az „Egyedi CSS URL” (`https://www.mosaicheadspa.hu/salonic/mosaic.css`), hogy az űrlap egy képernyős legyen.
- [ ] **Egy valódi próbafoglalás** a motorral, a szalon utána lemondja. Ellenőrizni: a foglalás megjelenik a Salonicban és a visszaigazoló e-mail megérkezik; a köszönőoldal megnyílik a mérésre alkalmas paraméterekkel; a konverzió **pontosan egyszer** érkezik (GA4 DebugView / GTM előnézet). Ez **1 valódi konverziót jelent** üzletáganként a hirdetési fiókokban: ennek elfogadása a tulajdonos döntése.
- [ ] A motor tartalék-linkje: ha a Salonic nem tölt be, a vendég a Salonic eredeti foglalójára kerüljön (kis kódmódosítás, a terv része).
- [ ] A kapcsoló és a visszaállás kipróbálva.

## 7. Kockázatok és kezelésük

| Kockázat | Kezelés |
|---|---|
| A mérés eltér (hiányzó vagy dupla konverzió) | Az átadás a meglévő köszönőoldalnak: a mérés kódja nem változik. Próbafoglalás + 3–7 napos figyelés üzletáganként. |
| A Salonic 5 percig tartja az időpontot; ha lejár vagy más is megnyitja, a saját főoldalára dob | Friss ellenőrzés az űrlap előtt, saját 4:50-es időzítő, „Másik időpontot választok” gomb. Teljesen nem kiküszöbölhető (a Salonic nem szerződéses felület). |
| A Salonic módosít a saját oldalain | A motor adapterteszttel ellenőrizhető (`LIVE=1`); hiba esetén tartalék-link a Salonicra. |
| Az ár nem egyezik (pl. Noel 20% kedvezménye) | Kezelve: a szakemberi kedvezmény az árban és az ellenőrzésben; ami eltér, azt „feldolgoztuk, de nem tudtuk ellenőrizni” oldal jelzi, nem hamis siker. |
| Két párhuzamos lézer-naptár | Döntés kell (lásd lent); a motor az Elysion-fiókra épül. |
| A Salonic-űrlap GA4-eseményei (`view_item`, `begin_checkout`) iframe-ben másként viselkedhetnek | A próbafoglalásnál és a figyelési időszakban ellenőrizni; a konverziót ez nem érinti (a köszönőoldal méri). |

## 8. Visszaállítás

- **Gyors:** az üzletág kapcsolójának kikapcsolása a térképben, új deploy (néhány perc): a gombok újra a Salonic-linkekre mutatnak.
- **Azonnali:** a Cloudflare Pages az előző deploymentre egy kattintással visszaállítható.
- A Salonic-fiókban az „Egyedi CSS URL” mező kiürítése visszaadja az eredeti űrlap-kinézetet.

## 9. Mit kérek a tulajdonostól

1. A **sorrend** jóváhagyása (Oxigén → Lézer → Fodrászat → HeadSpa).
2. **Elfogadod-e a próbafoglalások 1–1 konverzióját** üzletáganként (a szalon lemondja, de a hirdetési fiókokban megjelenik)?
3. **Melyik a helyes lézeres konzultáció-naptár:** a Hair-fiókban lévő régi (`444584`, ezt használja ma a 8 lézeres oldal) vagy az Elysion-fiókbeli (`476477`, ezt használja a motor)?
4. A **köszönőoldal**: az első ütemben a mostani, a motor saját sikeroldala később (jóváhagyás szerint).
5. A Salonic-fiókokban az „Egyedi CSS URL” beállítása (a te teendőd).
