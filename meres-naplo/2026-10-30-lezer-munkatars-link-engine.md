# 2026-10-30 - Lezer munkatars-link (?staff=brigi): a booking-engine fa dokumentalt valtozasa

Kerte: Feri (a tulajdonos), a Claude-chatben, 2026-10-30: "be kell kotni a foglalomotorba" (Brigi, lezeres szortelenites), majd "Igen, mehet" (merge, ha a review PASS es a vedett hash-ek rendben).
PR: Brinuti/mosaic#545. MERES ERINTO: a `booking_filter_used` (`filter: staff_link`) esemeny a lezerre is lefuthat, es a `meter.c1` a szakemberre szurt listat kapja (csak ha a link kulcsa feloldodik).

## Blob-hash valtozas (a #353 / #355 tabla "tovabb figyelt" sorai)

| Fajl | main | PR |
|---|---|---|
| assets/js/booking-engine/engine.js | `ef41b61e51dea6f3dbe3d41062673dfb3fa0e798` | `a4c5721281c37b55b20d018cb900dba72f081288` |
| assets/js/booking-engine/flows/laser.js | `f8a75d64d2280616db15f850fdca3781f92edafc` | `b83630856ceec3c84ef9c616fcf1973fd5ab8889` |

Valtozatlan vedett elemek a PR agan: `assets/js/booking-engine/koszono.js` = `547d0e05fcb396972de9225085330f389e66f89d`, `assets/js/suti.js` = `f29dc769dd72e1a6c5186dbc020876ddddc4ef4d`; a PR nem erinti a `klon/`, `wrangler.toml`, `functions/` fakat.

## Mi valtozik (szandekosan: a lezeres foglalas kulcsa)
- `flows/laser.js`: `staffLink: true` (a `showStaffFilter` marad `false`).
- `engine.js`: a naptar (C1) a `?staff=` kulcsot a `findStaff` / `staffChoices` utjan oldja fel a `flow.staffLink` flow-ban; a kozvetlen szolgaltatas-belepo (`service=`) is; a "Barmely szakember" gomb torli a kulcsot (csak `staffLink` flow-ban); stale-guard az uj `await` utan.
- Mas uzletag (headspa, oxygen, hair) viselkedese valtozatlan (nincs `staffLink`; a teszt ellenorzi).

## Amig Brigi naptara nem aktiv
A kulcs nem talalhato (nincs szabad ideje) -> az altalanos lezeres foglalo, hibauzenet nelkul: a vendeg altal latott foglalas nem valtozik.

## Aktivalas elott kell (nem ennek a PR-nek a resze)
- Koszono: a C6 (`koszono.js`, vedett) es a statikus `-ok` oldal Zsofit mutat - Brigi foglalasnal Brigi-nevu valtozat kell (kulon jovahagyas).
- C5 ellenorzes (`beginBooking` `staffName`) Brigi nevevel kiprobalni a lezeres Salonic-fiokban (nem foglalni: csak az ellenorzes).
- `node tools/meres-proba/munkatars-proba.mjs` + kezi naptar-nezes a `?business=laser&staff=brigi` linken.

## Rollback
A PR visszavonasa (revert), vagy a `staffLink: true` sor torlese a `laser.js`-bol (a link ekkor ujra az altalanos foglalot adja).