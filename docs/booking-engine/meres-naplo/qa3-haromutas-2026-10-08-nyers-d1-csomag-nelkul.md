# QA-3 háromutas egyeztetés és besorolás (2026-10-08-nyers-d1-csomag-nelkul)

Ablak: 2026-10-07T20:20:00Z → 2026-10-08T20:20:00Z (UTC). Bemenet: #128 sor 19, Gmail UUID 0, Salonic UUID 0; CONTROLLED_TEST lista 76, OTHER_TEST lista 10, Feri-féle próbasáv 0.
Vendégadat nincs a kimenetben. A besorolás szabálya: `QA3_KONTROLLALT_TESZTEK.md` „A tesztszűrés pontos szabálya”. **Nyers számok, ítélet nélkül.**

## Osztályonként (a REAL szám csak a REAL sor; az OTHER_TEST külön sor, nem része a REAL-nek)

| osztály | UUID | ebből mindhárom helyen |
|---|---|---|
| `CONTROLLED_TEST` | 0 | 0 |
| `OTHER_TEST` (külön sor) | 0 | 0 |
| `REAL` | 0 | 0 |
| `UNKNOWN` | 19 | 0 |
| **összesen** | 19 | 0 |
| felszabadult kulcsok (`foglalas_lemondas`, külön sor, tájékoztató) | 0 | |

OTHER_TEST bontásban: –.

## Háromutas mátrix (osztályonként; S = Salonic, G = Gmail, D = #128 sor)

| osztály | SGD | SG | SD | GD | S | G | D |
|---|---|---|---|---|---|---|---|
| `CONTROLLED_TEST` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `OTHER_TEST` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `REAL` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `UNKNOWN` | 0 | 0 | 0 | 0 | 0 | 0 | 19 |

SGD: mindhárom helyen · SG: Salonic + Gmail megvan, #128 sor hiányzik · SD: Salonic + #128 megvan, Gmail hiányzik · GD: Gmail + #128 megvan, Salonic hiányzik · S: csak Salonic · G: csak Gmail · D: csak #128

## REAL – Salonic állapot szerint

aktív 0 · törölt 0 · nincs a Salonic-exportban 0

## Hiányzó lábak (19 UUID)

| uuid | osztály | lábak | okkód |
|---|---|---|---|
| 07bd87a8-c92b-13b1-3c19-f5cb25052851 | UNKNOWN | D | nincs-gmail-adat |
| 107cd5e7-6220-74d7-137f-7ce974e37fa9 | UNKNOWN | D | nincs-gmail-adat |
| 1df8f5f0-2e45-d696-bcbd-b5b62be48ddc | UNKNOWN | D | nincs-gmail-adat |
| 2d9ae986-f259-4353-9e72-1ec358b6b695 | UNKNOWN | D | nincs-gmail-adat |
| 3fe2929f-b782-82ad-34ca-9d6b37892659 | UNKNOWN | D | nincs-gmail-adat |
| 4314829e-3742-9dd1-02b0-5aab5d97cdca | UNKNOWN | D | nincs-gmail-adat |
| 7966da9b-fed8-1ba3-7fe5-d46a2dc740d5 | UNKNOWN | D | nincs-gmail-adat |
| 7d997f42-3644-c9d9-513a-edc79d8f7224 | UNKNOWN | D | nincs-gmail-adat |
| 99edec7b-4230-b808-1382-cf42ba202b53 | UNKNOWN | D | nincs-gmail-adat |
| 9a464b7f-3651-d270-52fe-4d4e705e818c | UNKNOWN | D | nincs-gmail-adat |
| b4fd7c36-c8e6-f219-d1fb-6fa1e6982de7 | UNKNOWN | D | nincs-gmail-adat |
| c7957610-af8e-2e70-cf08-7eb664dd4e46 | UNKNOWN | D | nincs-gmail-adat |
| cb431d26-bd99-94e6-f611-f9e550f66180 | UNKNOWN | D | nincs-gmail-adat |
| d2759497-31bd-9ef8-4f9a-5ae4c1ab0a14 | UNKNOWN | D | nincs-gmail-adat |
| df378437-eb11-eca6-d6ca-84b96173f833 | UNKNOWN | D | nincs-gmail-adat |
| e07b1265-490f-1aca-106b-ec6f20c04e99 | UNKNOWN | D | nincs-gmail-adat |
| e3073484-70f2-db67-825c-1d0c0afdc3dc | UNKNOWN | D | nincs-gmail-adat |
| f84cabb7-f862-bf3a-a0f7-063ebe0d512d | UNKNOWN | D | nincs-gmail-adat |
| fdf76f46-f4b6-17b3-476f-8020ab9760c9 | UNKNOWN | D | nincs-gmail-adat |

## UNKNOWN (19) – nem találgatjuk, a csomagban külön sor

| uuid | lábak | okkód |
|---|---|---|
| 07bd87a8-c92b-13b1-3c19-f5cb25052851 | D | nincs-gmail-adat |
| 107cd5e7-6220-74d7-137f-7ce974e37fa9 | D | nincs-gmail-adat |
| 1df8f5f0-2e45-d696-bcbd-b5b62be48ddc | D | nincs-gmail-adat |
| 2d9ae986-f259-4353-9e72-1ec358b6b695 | D | nincs-gmail-adat |
| 3fe2929f-b782-82ad-34ca-9d6b37892659 | D | nincs-gmail-adat |
| 4314829e-3742-9dd1-02b0-5aab5d97cdca | D | nincs-gmail-adat |
| 7966da9b-fed8-1ba3-7fe5-d46a2dc740d5 | D | nincs-gmail-adat |
| 7d997f42-3644-c9d9-513a-edc79d8f7224 | D | nincs-gmail-adat |
| 99edec7b-4230-b808-1382-cf42ba202b53 | D | nincs-gmail-adat |
| 9a464b7f-3651-d270-52fe-4d4e705e818c | D | nincs-gmail-adat |
| b4fd7c36-c8e6-f219-d1fb-6fa1e6982de7 | D | nincs-gmail-adat |
| c7957610-af8e-2e70-cf08-7eb664dd4e46 | D | nincs-gmail-adat |
| cb431d26-bd99-94e6-f611-f9e550f66180 | D | nincs-gmail-adat |
| d2759497-31bd-9ef8-4f9a-5ae4c1ab0a14 | D | nincs-gmail-adat |
| df378437-eb11-eca6-d6ca-84b96173f833 | D | nincs-gmail-adat |
| e07b1265-490f-1aca-106b-ec6f20c04e99 | D | nincs-gmail-adat |
| e3073484-70f2-db67-825c-1d0c0afdc3dc | D | nincs-gmail-adat |
| f84cabb7-f862-bf3a-a0f7-063ebe0d512d | D | nincs-gmail-adat |
| fdf76f46-f4b6-17b3-476f-8020ab9760c9 | D | nincs-gmail-adat |

## Listán szereplő, de egyik forrásban sem lévő UUID: 86 (CONTROLLED_TEST 76, OTHER_TEST 10) – nem számít sornak
