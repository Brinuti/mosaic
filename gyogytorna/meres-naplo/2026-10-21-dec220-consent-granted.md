# DECISION #220: a GYT szerveres Google-feltöltés consent = GRANTED (kapcsoló mögött)

Feri kérése (Azonnali élesítés, közvetlenül a munkamenetben, 2026-10-21): „a consent alapból elfogadva, ezt mindenhol küldjük, a kockázatát vállalom.” Drive DECISION-LOG #220 és #167 6322569279 egyezik.

## Változás (gyogytorna/lib/gfeltoltes.js)
- `gfeltoltesPayload(..., consent)`: csak `consent=true` esetén kerül a `consent: { adUserData: 'GRANTED', adPersonalization: 'GRANTED' }` a click-konverzióba; **user_identifiers soha**, nev/e-mail/telefon/panasz nincs.
- **Kapcsoló: `GY_GADS_CONSENT=granted`** (alapból KI → a feltöltés bájtra a mostani). Oka: a GYT feltöltő Zap (`gy-google-ads-szerveres-feltoltes`) védőhálója a nem engedett mezőt tartalmazó kérést elutasítja (`vedohalo-elutasitotta`), tehát a Worker csak a Zap frissítése UTÁN küldhet consent-et.
- Új `gy_feltoltes` sorok `consent` oszlopa: `megadott` (kapcsoló be, a látogató nem utasította el), `elutasitott` (kapcsoló be, `gy_foglalas.hozzajarulas = 'nem'`: a látogató kifejezett elutasítása elsőbbséget élvez, nincs consent mező), `nem_ismert` (kapcsoló ki; a meglévő sorok is ezek).
- `vedohalo`: `consent` csak a pontos `{ adUserData: GRANTED, adPersonalization: GRANTED }` pár; minden más alak (hiányos, DENIED, extra kulcs, nem objektum) `consent` hibakód; `userIdentifiers` továbbra is `ismeretlen_mezo`.
- A lekérdezések (`kuldhetoSorok` + `SOR_OSZLOP`) a `g.consent` oszlopot is hozzák, így a kérés a soron tárolt consent-ből épül.

## Zap (Zapier-draft, külön lépés)
Workflow `01a15e4d-0f05-7813-a364-22c23d792466`, draft `01a15f9e-74fa-79f1-85a0-b897abe08351`: `ENGEDETT` + `consent`, a `jo()` ellenőrzi a pontos GRANTED/GRANTED párt. Az eredeti élő verzió (rollback-alap): `01a15e4e-9865-7e88-bd40-2aaead257684`. A draft `jo()`-ját a Worker valódi kimenetével kereszt-teszteltem (consent nélküli, GRANTED/GRANTED, eles törzs OK; DENIED, csak adUserData, extra kulcs, userIdentifiers, nem objektum, null elutasítva).

## Sorrend az élesítéshez
1. Ez a PR merge (kapcsoló KI: nincs élő hatás).
2. A Zap draft publikálása (visszafelé kompatibilis: a consent nélküli kérést is elfogadja).
3. `GY_GADS_CONSENT = "granted"` a `wrangler.toml`-ban (külön kis PR) → új sorok consent-tel.
4. Ellenőrzés a következő gclid-es állapotfelmérésnél: `gy_feltoltes.consent = 'megadott'`, a Google nem utasítja el.
**Rollback:** `GY_GADS_CONSENT` törlése (Worker), a Zap előző verziója (`01a15e4e-…`), vagy a PR revertje.

## Tesztek
`npm run teszt` (gyogytorna): 71/71 (új: a kapcsoló nélkül változatlan; kapcsolóval megadott + a kérés + vedohalo; elutasítás elsőbbsége; csak a „granted” érték kapcsol; `nincs_dontes` is megadott; a védőháló consent-esetei).
