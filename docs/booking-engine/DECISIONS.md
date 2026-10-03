# Booking Engine V1 – jóváhagyott döntések

Minden döntés a tulajdonostól jött, 2026-10-03-án, a [PMU live audit és a Salonic readback](PMU_LIVE_ADAPTER_FINDINGS.md) után.

| # | Kérdés | Döntés | Következmény |
|---|---|---|---|
| 1 | A 100 perces VIP Head Spa (53 800 Ft) online foglalható legyen? | **Már nincs VIP.** | A motorban nincs VIP. A Salonicban sincs. A weboldalon még szerepelhet: külön takarítás kell (lásd lent). |
| 2 | Az Oxigén „Konzultáció + hajkamerás vizsgálat” (4 990 Ft) online foglalható legyen? | **Igen, és felkerült a Salonicba** (2026-10-03). | **Megoldva:** `466147` „AKCIÓS Hajkamerás vizsgálat és konzultáció”, 30 perc, 4 990 Ft, az Oxigén fiók „1. alkalom” kategóriájában. A besorolása automatikusan konzultáció. |
| 3 | PMU eltávolítás online foglalható legyen? | **Nem, csak fotó alapján.** | Nincs Salonic-szolgáltatás. Az `removal` és a `photo_review_lead` nem foglalás, soha nem lehet `booking_completed`. |
| 4 | A foglalások besorolása a hirdetési méréshez | **Jóváhagyva** (lásd lent). | `assets/js/booking-engine/business-config.js` |

## Felület-döntések (2026-10-03, a UI építése előtt)

| # | Kérdés | Döntés |
|---|---|---|
| 5 | Az adatok megadása (C4) és a foglalás létrehozása (C5) | **A Salonic beágyazott adatlapja** (mint a PMU-nál): saját űrlap nem lehetséges (reCAPTCHA, nincs foglalás-API). A foglaló az oldalunkon marad, az utolsó lépésben a Salonic űrlapja látszik benne. |
| 6 | Melyik üzletággal kezdünk | **HeadSpa** |
| 7 | „Értesítsetek, ha felszabadul hely” | **Az első verzióban kimarad**, csak a „Hívjatok vissza” marad. |
| 8 | HeadSpa Egyéni: Relax vagy Hair | **Csak a Relax**, nincs választás. A „Hair” változat (és a kuponos párja) ebből a foglalóból nem foglalható. |
| 9 | „Hívjatok vissza” | **Visszahívás-kérő űrlap**, a szalon e-mailt kap (új űrlap-típus: `motor-visszahivas`). |
| 10 | „Időpont módosítása” a siker-oldalon | **Szöveg:** a módosító link a visszaigazoló e-mailben van. |
| 11 | Szakember-választó a HeadSpa naptárában | **Nincs**, bárki megfelelő (a HeadSpa „munkatársai” kezelő-helyek). A Hair és az Oxigén alatt marad. |
| 12 | A kész foglaló helye | **Rejtett próbaoldal** (`/foglalo-motor`, `noindex`, nincs rá link). Éles oldalba csak külön jóváhagyással kerül. |
| 13 | „Ajándékkártyát vásárolok” gomb (HeadSpa) | **Az új ajándék-oldalra, ha kész** (a másik ablak építi). Addig a mostani `/headspa-ajandekkartya` oldalra mutat; az átkötés egy sor a `flows/headspa.js`-ben (`giftCardUrl`). |
| 14 | A beágyazott Salonic-adatlap megjelenése | **Közös CSS minden üzletágra** (a tulajdonos javaslata): a PMU-nál már használt `salonic/pmu.css` általánosítása, `salonic/mosaic.css`. Fiókonként a Salonic „Egyedi CSS URL” beállítása kell hozzá; a motor ezt magától felismeri és ehhez igazítja a keretet. |
| 15 | Oxigén belépés | Egy kérdés (OX1): Hajkamerás vizsgálat / Első oxigénterápiás kezelés / Már jártam nálatok. Szakember nem kötelező: alapból „bármely megfelelő”, a naptárban választható. |

**A tesztelés korlátja:** a Salonicnak nincs próbakörnyezete, ezért éles foglalást a próba során nem adunk le. A foglalás-utáni ágakat (siker, elkelt időpont, hiba) mintanézettel és egységtesztekkel ellenőrizzük.

**Go-live előtt eldöntendő:** a mai HeadSpa konverziós mérés a `/success-foglalas*` köszönőoldalak URL-paramétereire épül. A próbaoldalon a motor maga mutatja a sikert, és nem nyitja meg a köszönőoldalt, ezért mérés nem fut. Élesítéskor el kell dönteni, hogyan marad meg a jelenlegi mérés.

## Jóváhagyott besorolás

- Ingyenes konzultáció → `consultation`.
- Első fizetős alkalom → `first_treatment`.
- „2. alkalomtól” vagy visszatérő foglalás → `returning_treatment`.
- Kuponnal vagy ajándékkártyával jött foglalás → `voucher_redemption`: **nem számít új vendégnek**.
- Ellenőrzésnek a Salonic saját új/visszatérő jelzése (`first_booking`) szolgál.

A Salonic nem minden helyen bontja az első és a következő alkalmat külön kategóriára (HeadSpa normál foglalás, Hair, PMU). Ott a szolgáltatás `first_treatment`, és ha a Salonic a foglalás után `first_booking=false`-t jelez, a foglalás **visszatérőnek** számít.

## Takarítási teendők (nem a motor feladata, külön jóváhagyás kell)

- A VIP említése a weboldalon (HeadSpa oldalak, árlista, ajándékkártya).
- A PMU eltávolítás: a `/eltavolitas-ok` köszönőoldal és a hozzá tartozó mérés használatban marad-e.
