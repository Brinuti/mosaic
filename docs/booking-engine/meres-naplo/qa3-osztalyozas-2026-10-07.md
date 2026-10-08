# QA-3 – a 49 sor osztályozása (DÖNTÉS #108 / 3.): CONTROLLED_TEST · OTHER_TEST · REAL · UNKNOWN

Ablak: **2026-10-06 20:00 → 2026-10-07 20:00 (Budapest)** = 2026-10-06 18:00 → 2026-10-07 18:00 UTC; #128 `foglalas_egyeztetes`, a levél beérkezése szerint. **Az állapotok a lusta lezárás (R7-javítás, élesedés 2026-10-07 18:45:53 UTC) ELŐTTI pillanatképből valók** (`qa3-szamlalo-2026-10-07.md`, lekérdezés ~18:10 UTC).
Forrás: a besorolást a mérési munkamenet adta Gmail-levelek alapján (a tesztnevű levelek közül a futtatói UUID-listámon lévők `CONTROLLED_TEST`, a többi `OTHER_TEST`); **az én 49 soromra ellenőriztem: a három lista uniója pontosan a 49 sor, 0 átfedés, a tesztnevű 32 közül 25 a futtatói listámon van, 7 nincs; a 24 nem-futtatói soromat pontosan REAL 14 + Feri 3 + tesztnevű 7 adja.**

## Összesítő
| osztály | sor | ebből állapot (a pillanatképben) |
|---|---|---|
| `CONTROLLED_TEST` (a futtatói UUID-lista) | **25** | 15 `parositott` (160 küldési sor), 10 `fuggoben` |
| `OTHER_TEST` (korábbi QA-UUID vagy tesztnév) | **10** | 10 `fuggoben` – ebből Feri 3 saját nevű próbája + a „mai 7 eltérő UUID” (tesztnevű, nem a futtatói listán) |
| `REAL` | **14** | 13 `fuggoben`, 1 `parositatlan` + riasztás (`f6e5962c-…`, 5 próba: ezt én dolgoztam fel újra) |
| `UNKNOWN` | **0** | – |
| összesen | **49** | egyezik a 49 sorral |

Küldési sor: csak a `CONTROLLED_TEST` 15 párosított sorához van (160); az `OTHER_TEST`, `REAL` sorokra 0.

## `REAL` (14)
| uuid | állapot | próba |
|---|---|---|
| 00eba879-dfac-1c02-ed1e-5c5bc9524d96 | fuggoben | 4 |
| 2c37acd6-f0da-f7db-af97-656bff5c1527 | fuggoben | 4 |
| 47349ed3-2eb7-c5c9-2402-aa0196af9869 | fuggoben | 4 |
| 791f8da0-b108-82e1-13fc-99a2ef6e1776 | fuggoben | 4 |
| 7e5747ff-4fd0-343c-419a-751eead9b850 | fuggoben | 4 |
| a424f19e-0295-7da9-8031-f29d1326ca70 | fuggoben | 4 |
| ce48ae2c-95f6-039f-335a-c35e226657c4 | fuggoben | 4 |
| d9c97468-5e56-c260-8ffe-a036302065de | fuggoben | 4 |
| dc88568d-21f4-d0e9-14c5-e143ecfc2416 | fuggoben | 4 |
| e7a3ddd2-fd63-f11e-3aea-87f2ed0c3289 | fuggoben | 4 |
| f297a5df-3a12-0e04-081e-ff911a321d1b | fuggoben | 4 |
| f6e5962c-ebc8-a129-0a75-7cc985f63ee0 | parositatlan | 5 |
| f9f10dc7-f652-dea6-d267-91de4f1b446e | fuggoben | 4 |
| fce72167-cdbf-9def-bbac-107b2aba76ef | fuggoben | 4 |

## `OTHER_TEST` – Feri saját nevű próbái (3)
| uuid | állapot | próba |
|---|---|---|
| 200d6dd2-d98c-3c6e-5eb7-2c000844b4f8 | fuggoben | 4 |
| c6df078a-57b1-b087-dc9d-16c004d1e3d5 | fuggoben | 4 |
| ffce57f3-4c86-e3c9-e393-b302a6c91012 | fuggoben | 4 |

## `OTHER_TEST` – tesztnevű, nem a futtatói listán („a mai 7 eltérő UUID”) (7)
| uuid | állapot | próba |
|---|---|---|
| 7ca4ac9d-cae9-70c7-c886-ab832f000679 | fuggoben | 4 |
| 8659064f-521f-8742-e023-adf9b2855c91 | fuggoben | 4 |
| 8d939bdb-9e8a-362f-1fe0-e7b299970ecd | fuggoben | 4 |
| bb041f31-9be2-fb93-5f67-e44e6c908bef | fuggoben | 4 |
| ddc833b4-21a0-355b-6ae8-73dcfef531d7 | fuggoben | 4 |
| de5f99a0-055a-15dc-24f7-94c16b3191af | fuggoben | 4 |
| f8980edf-7b35-abec-7be0-925d6a5cd37b | fuggoben | 4 |

## `CONTROLLED_TEST` (25)
A futtatói UUID-lista: `qa3-teszt-uuid-lista-2026-10-07.txt` (62 UUID; ebből 25 esik az ablakba: 15 párosított a 08:02–08:18 UTC QA-3 futtatásokból, 10 `fuggoben` a 10-06 esti életút-E2E és a 10-07 reggeli diagnosztikai reprodukciók levelei). Az `OTHER_TEST` lista (10 UUID): `qa3-other-test-uuid-lista-2026-10-07.txt`.

## Megjegyzés (tény, ítélet nélkül)
A korábbi számlálóm („NEM_TESZT 24”) most pontosan két osztályra bomlik: `REAL` 14 + `OTHER_TEST` 10. A `f9f10dc7-…` és a `f297a5df-…` sort, amelyet nem azonosítottam, a mérési munkamenet `REAL`-nak sorolta.
