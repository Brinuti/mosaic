# OX-1: Oxigén Meta-mérés pontosítása csere nélkül – terv (2026-10-27)

**Állapot: TERV (nincs új kód a PR-ban); MÉRÉST ÉRINTŐ; élesítés nincs.** Kérés: #167 6446366863 (01-MERES, 16:40) – az OX-1 terv a 18:00-s csomagba, benne: miért nem sül el az `oxigenterapia-ok` a visszajárók többségénél. Feri 10-25: **az egyéni konverziók maradnak, nincs csere** (újratanulás ellen).

## 1. Tények (01-MERES, 7 nap, 10-20..27, Hair-pixel `1361403694872594`)
- Meta `SubmitApplication ← az URL tartalmazza oxigenterapia-ok` (URL-szabály, „Manual Event Setup Tool", 2025-07): **13 esemény / 11 óra**, web/szerver 1:1.
- Motor: **13 érkezés** (első 6, visszajáró 5, konzultáció 1, jelleg nélkül 1). **Első foglalás lefedettség 6/6.** Többlet: 1 konzultáció, 1 visszajáró, 1 jelleg nélküli, **4 motor nélküli** esemény (10-23 15Z, 10-24 18Z, 10-26 11Z ×2). Pontosság ≈ 6/13. Ugyanerre az URL-re épül az élő egyéni konverzió („Oxigénterápia foglalás", `981471570594428` = PageView + URL `oxigenterapia-ok`).

## 2. Miért nem sül el a visszajárók többségénél (TÉNY a repóból)
A Salonic 2. alkalomtól szolgáltatása („Haj Oxigénterápia – 2. alkalomtól") **más köszönőoldalra** visz: **`/oxigenterapia-masodik`**, nem `/oxigenterapia-ok`-ra (`WIX-MERES.md` 338/362/429. sor: „Oxigén visszatérő"; `assets/js/attribucio.js` `KOSZONO_UT`; `meres-naplo/2026-10-26-uj68-jelleg-koszonooldal.md`: `/oxigenterapia-masodik` → mindig `visszajaro`, 9 érkezés rendben). Az `oxigenterapia-ok` URL-szabály ezért csak az `/oxigenterapia-ok` megnyitásra fut: első foglalás + konzultáció, és az a **kevés visszajáró**, aki az „első alkalom" szolgáltatáson/oldalon foglal (a 10-26-i jelleg-vizsgálat: `/oxigenterapia-ok` oldalon visszajáró 3 = hibás besorolás-gyanú, UJ-68). A motor minden érkezést rögzít (a `-masodik` oldalét is), a Meta-szabály csak az `-ok`-ot: ezért „1 visszajáró sült el, 4 nem". **Ez nem hiba, hanem a szabály definíciója.**

## 3. Mi okozza a pontatlanságot (a 13 vs 6)
1. **Oldal-újratöltés / könyvjelző / közvetlen megnyitás / bot** – az URL-szabálynak nincs `eventID`-ja, minden megnyitás új esemény (4 „motor nélküli" + a többlet). Bizonyíték a PMU-nál: 1 foglalás ≈ 3 esemény (újratöltés-gyanú).
2. **Jelleg-eltérés** (konzultáció, visszajáró az `-ok` oldalon): ezek az oldalon vannak, de nem „első foglalás".

## 4. Javaslat (csere NÉLKÜL, két lépés)
**A) Már kész, kapcsoló mögött (UJ-74, [PR #508](https://github.com/Brinuti/mosaic/pull/508), `c6955ebe`):** szerveres `PageView` a Hair-pixelre **a böngészős PageView-val közös `event_id`-val** (a `bongeszoMetaKulcs` kulcsa), csak új vendég + konzultáció, kulcs nélkül nem küld. Az egyéni konverzió/cél (PageView + URL) változatlan marad, tehát nincs újratanulás; az EMQ nő (hash-elt e-mail/telefon/név, `fbc`, IP/UA).
**B) A böngészős PageView `eventID` (külső fiók, mérési oldal, GTM-workspace, publikálás nélkül):** az `oxigenterapia-ok` (és `fodrasz-ok`) oldalon a PageView kapja a foglaláshoz kötött, **determinisztikus** azonosítót. Várt hatás (**HIPOTÉZIS, Test Events-ben igazolandó**): a Meta ugyanazon `event_id`-jú ismételt (újratöltött) PageView-t deduplikálja, így az URL-alapú cél foglalásonként 1-szer számol; ha nem deduplikál böngésző–böngésző párra, a hatás csak a szerveres/böngészős pár dedupja (EMQ) – ezt a 3 próba dönti el.

## 5. Mi marad nyitva / döntés
- A visszajárók (`/oxigenterapia-masodik`) **nincsenek** az `oxigenterapia-ok` célban és nem is lesznek; ha a visszajárót is optimalizálni akarjuk, az **új cél / csere**, külön Feri-döntés (nem része a tervnek).
- A `-ok` oldalon megjelenő visszajárók (UJ-68 besorolás) ellenőrzése: a jelleg a köszönőoldalból (#496, mergelve) jön.
- A teljes Salonic-párosítás (motor nélküli események) a mérési oldal Salonic-levélszámával: 10-28 07:22.

## 6. Lépések, felelős, rollback
| # | lépés | ki | rollback |
|---|---|---|---|
| 1 | **előfeltétel:** #508 (`c6955ebe`) független review + merge (kapcsoló KI); a terv B) lépései nélküle nem indíthatók | review: mérési oldal; DECISION kell | revert |
| 2 | `META_PV_TOKEN` Secret (Production + Preview) | Feri | – |
| 3 | böngészős `eventID` GTM-workspace-ben, publikálás nélkül — **külső fiók: Feri kifejezett kérése / DECISION kell** (a workspace létrehozása is) | mérési oldal | workspace törlése |
| 4 | előnézeti Test Events, 3 minta (dedup, EMQ) | mérési oldal + fejlesztő | `META_PV_BE` törlése |
| 5 | éles `META_PV_BE="oxigen"` + GTM publikálás — **besorolás: külön Feri-mondat** (nem 4/a: a cél forrás-eseményét érinti, nem „csak több adat ugyanarra az egyéni konverzióra") | Feri „mehet" + DECISION | `META_PV_BE` törlése, GTM előző verzió |

## 7. Döntési kritérium a B) dedup-hipotézishez (rögzítve a próba előtt)
Előnézeti Test Events, **3 valós minta**, mindegyiken ugyanazon foglaláshoz kötött `eventID`-val: (a) a böngészős + szerveres PageView egy eseménnyé olvad-e, (b) az **oldal újratöltése** után a Meta nem számol-e új eseményt.
- **3/3 dedup** (az újratöltés sem ad új eseményt): a B) lépés **igazolt**, mehet a 4–5. lépés (Feri külön mondatával).
- **A pár dedupja megy, de az újratöltés-dedup nem (< 3/3):** a B) mint **újratöltés-szűrő elvetve**; csak az A) marad (EMQ-nyereség, pontosság-javulás nem ígérve).
- **A pár dedupja sem megy (< 3/3):** az egész terv leáll, nincs élesítés; a #508 kapcsolója KI marad.
