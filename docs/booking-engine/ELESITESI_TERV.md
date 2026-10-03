# Élesítési terv – a közös foglaló bevezetése (HeadSpa, Oxigén, Fodrászat, Lézer)

Állapot: 2026-10-03. A foglaló ma a rejtett `/foglalo-motor` oldalon van, **élesben semmi nem változott, a vendégek nem látják**. Ez a terv azt írja le, hogyan kerül élesbe úgy, hogy **a hirdetési mérés nem romlik**, és **bármikor visszaállítható**.

## 1. Alapelvek és jóváhagyott döntések

1. **A mérést nem írjuk át.** A mostani konverziók (Google Ads, Meta, TikTok, GA4, Stape, Zapier) a Salonic köszönőoldalainak URL-paramétereire épülnek. A motor ezeket a köszönőoldalakat használja tovább (a PMU foglaló is így működik). **Az első ütemben a mostani köszönőoldal marad** (jóváhagyva).
2. **Előbb mindent kipróbálunk, utána egyszerre kapcsolunk át** (jóváhagyva): nem üzletáganként élesítünk. A kipróbálás valódi próbafoglalásokkal történik (lásd 5. pont), a vendégek számára láthatatlan, rejtett oldalról.
3. **A lézeres konzultáció az Elysion-fiókból megy** (`476477`, jóváhagyva).
4. **Egy kapcsolóval visszaállítható** (8. pont). A **PMU foglaló nem változik**.

## 2. A mostani helyzet (tények)

- 89 oldal, de **csak 19 különböző Salonic-link** van rajtuk: az átkötés kicsi és központi.
- A mérés a köszönőoldalakra épül (`/success-foglalas*`, `/foglalas-ok`, `/fodrasz-ok`, `/oxigenterapia-ok`, `/elysion-ok`, `/pmu-ok`): a GTM az útvonal és az URL-paraméterek (`first_booking`, `price`, `employee`, `bookingUrl`, `g`) alapján számol konverziót.
- Forgalom (28 nap, Salonic-oldalak munkamenetei): HeadSpa 8 103 · Fodrászat 4 069 · Oxigén 967 · Lézer 636.
- **Ma meglévő hibák, amelyeket az átkötés megold:**
  - A `headspa-budapest-hungary`, a `noi-fodraszat-hullam` és a `noi-fodraszat-szoke` oldal gombjai olyan Salonic-linkre mutatnak (`employees/23532`, `serviceId=239336`), amely már nem él: a Salonic főoldalára dobnak.
  - A **lézeres oldalak (8 db)** a **Hair** fiók rejtett „Ingyenes konzultáció zsófihoz!” szolgáltatására (`444584`) mutatnak, miközben az Elysion-fiókban is van ugyanilyen (`476477`). Az átkötés után minden az Elysion-fiókba megy; a Hair-fiókbeli régi konzultációt utána érdemes megszüntetni.

## 3. Hogyan marad meg a mérés

Sikeres foglalás után a Salonic a mi köszönőoldalunkra irányít (az űrlap a mi oldalunkba ágyazva fut, ezért a keretbe). A keretben betöltődő köszönőoldal a `suti.js` védelme miatt **nem mér**, hanem értesíti a szülő oldalt.

**Átadás a meglévő köszönőoldalnak (megépítve):** a motor, miután a Salonic visszairányított, a **teljes ablakban megnyitja ugyanazt a köszönőoldalt, ugyanazokkal a paraméterekkel**. A mérés így pontosan úgy fut, mint ma: egyszer, a fő ablakban, a GTM és a pixelek változatlan beállításával. A vendég a mostani köszönőoldalt látja. Ez csak az éles tartományon (`www.mosaicheadspa.hu`) kapcsol be; előnézeten és helyben a motor maga mutatja a sikert (`?atadas=0|1` felülírja).

**Műszaki következmény:** a Salonic mindig az éles `www.mosaicheadspa.hu` köszönőoldalára irányít vissza (a fiók beállítása). Ezért a **valódi próbához a motornak ugyanezen a tartományon kell futnia**, rejtett oldalként (`/foglalo-motor`, `noindex`, sehonnan nincs rá link). Előnézeti címről a végigpróbálás nem lehetséges.

A motor saját sikeroldala (naptárba tétel, útvonaltervezés) a **második ütemben** jöhet.

**Nem nyúlunk** a GTM-konténerhez, a Meta-, TikTok- és Google-fiókokhoz.

## 4. A gombok átkötése (a próbák után, egyszerre)

Egy központi térkép (build-időben, üzletáganként egy kapcsolóval) a 19 Salonic-linket a motorra köti:

| Salonic-link (ma) | Új cél |
|---|---|
| HeadSpa: időpont foglalás (`showServices … specId=39592`, `selectSpecialization`, `employees/…`, régi `selectDate`) | `/foglalo-motor?business=headspa` |
| HeadSpa: kuponos beváltás (`specId=41471`) | `/foglalo-motor?business=headspa&voucher=1` |
| HeadSpa ajándékkártya-vásárlás (`/giftcards…`) | **marad** (nem foglalás; az új ajándék-oldal készül) |
| Fodrászat (`selectSpecialization`, `showServices …employeeId=23694`) | `/foglalo-motor?business=hair` |
| Oxigén (`selectEmployee … 466110` / `466158`) | `/foglalo-motor?business=oxygen&service=466110` / `…=466158` |
| Lézer (`specId=66404` / `66405`, konzultáció `444584`) | `/foglalo-motor?business=laser` (konzultációnál `&service=konzult`) |
| PMU | **marad** (külön, már éles motor) |

## 5. A kipróbálás (valódi próbafoglalások, jóváhagyott feltételekkel)

Üzletáganként (Oxigén, Lézer, Fodrászat, HeadSpa) **egy valódi próbafoglalás** a motorral az éles tartományon lévő rejtett oldalról:

- **Név:** „TESZT – Claude”, **fix e-mail-címmel és telefonszámmal** (a tulajdonos adja meg).
- **Lista a végén:** üzletág, pontos időpont (percre), foglalás- vagy tranzakció-azonosító, ha van.
- **Minden próbánál ellenőrizni:** a konverzió **platformonként (Google, Meta, TikTok) pontosan egyszer** fut le, az **e-mail megérkezik**, a **köszönőoldal betölt**.
- A **szalon a próbafoglalást lemondja**, a vendéget **nem törli**.
- A próbák **távoli időpontra** (több hétre előre) kerülnek, hogy ne zavarják a valódi vendégeket.
- A kuponos HeadSpa-ág kuponkód nélkül nem próbálható; ezt a kód megadása után külön ellenőrizzük.

Ez **üzletáganként 1 valódi konverziót** jelent a hirdetési fiókokban (jóváhagyva).

## 6. Előfeltételek

- [x] Közös Salonic-CSS élesben (`salonic/mosaic.css`).
- [x] Átadás a meglévő köszönőoldalnak, tartalék-link a Salonicra (megépítve).
- [ ] Az „Egyedi CSS URL” beállítása a Salonic-fiókokban (a tulajdonos teendője).
- [ ] A `/foglalo-motor` rejtett élesítése a próbákhoz (a #65 PR mergelése: új, linkelés nélküli oldal, a meglévő oldalak nem változnak).
- [ ] A próbák lefutása és az eredmények átnézése.
- [ ] A központi link-térkép és a kapcsolók elkészítése, kipróbálása.

## 7. Kockázatok és kezelésük

| Kockázat | Kezelés |
|---|---|
| A mérés eltér (hiányzó vagy dupla konverzió) | Az átadás a meglévő köszönőoldalnak: a mérés kódja nem változik. Valódi próba mind a négy üzletágon, platformonkénti ellenőrzéssel. |
| A Salonic 5 percig tartja az időpontot; ha lejár vagy más is megnyitja, a saját főoldalára dob | Friss ellenőrzés az űrlap előtt, saját 4:50-es időzítő, „Másik időpontot választok” gomb. Teljesen nem kiküszöbölhető (a Salonic nem szerződéses felület). |
| A Salonic módosít a saját oldalain | A motor adapterteszttel ellenőrizhető (`LIVE=1`); hiba esetén tartalék-link a Salonicra. |
| Az ár nem egyezik (pl. Noel 20% kedvezménye) | Kezelve: a szakemberi kedvezmény az árban és az ellenőrzésben; a köszönőoldalra az ellenőrzéstől függetlenül átadunk. |
| A Salonic-űrlap GA4-eseményei (`view_item`, `begin_checkout`) iframe-ben másként viselkedhetnek | A próbánál ellenőrizni; a konverziót ez nem érinti (a köszönőoldal méri). |
| Cookie-hozzájárulás a próbában | A mérés ellenőrzéséhez a próba böngészőjében a süti-sávon el kell fogadni a hozzájárulást: ehhez a tulajdonos külön jóváhagyása kell. |

## 8. Visszaállítás

- **Gyors:** a térképben az üzletág kapcsolójának kikapcsolása, új deploy (néhány perc): a gombok újra a Salonic-linkekre mutatnak.
- **Azonnali:** a Cloudflare Pages az előző deploymentre egy kattintással visszaállítható.
- A Salonic-fiókban az „Egyedi CSS URL” mező kiürítése visszaadja az eredeti űrlap-kinézetet.
