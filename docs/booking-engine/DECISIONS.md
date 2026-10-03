# Booking Engine V1 – jóváhagyott döntések

Minden döntés a tulajdonostól jött, 2026-10-03-án, a [PMU live audit és a Salonic readback](PMU_LIVE_ADAPTER_FINDINGS.md) után.

| # | Kérdés | Döntés | Következmény |
|---|---|---|---|
| 1 | A 100 perces VIP Head Spa (53 800 Ft) online foglalható legyen? | **Már nincs VIP.** | A motorban nincs VIP. A Salonicban sincs. A weboldalon még szerepelhet: külön takarítás kell (lásd lent). |
| 2 | Az Oxigén „Konzultáció + hajkamerás vizsgálat” (4 990 Ft) online foglalható legyen? | **Igen, a tulajdonos szerint már fel van véve a Salonicban.** | **Nyitott:** a readback ezt (2026-10-03, a döntés után is) nem találja: az Oxigén fiókban 3, a Hair fiókban 41 szolgáltatás van, egyik sem 4 990 Ft. A weboldal „FOGLALOK!” gombja a Hair foglalóra mutat, ott csak az 1. és a 2. alkalomtól oxigénterápia linkelt. Kell a pontos Salonic-név vagy a közvetlen foglalási link. |
| 3 | PMU eltávolítás online foglalható legyen? | **Nem, csak fotó alapján.** | Nincs Salonic-szolgáltatás. Az `removal` és a `photo_review_lead` nem foglalás, soha nem lehet `booking_completed`. |
| 4 | A foglalások besorolása a hirdetési méréshez | **Jóváhagyva** (lásd lent). | `assets/js/booking-engine/business-config.js` |

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
