# QA-3 – a mi oldali számláló (nyers számok, értelmezés és PASS / FAIL ítélet nélkül)

Lekérdezés ideje: **2026-10-07 ~18:10 UTC (20:10 Budapest)**, a #128 előnézet D1-ből (`628113fe-9793-450d-baad-fc77814995eb`), **csak olvasás**, vendégadat nélkül.
**Ablak:** 2026-10-06 18:00 UTC → 2026-10-07 18:00 UTC (= 10-06 20:00 → 10-07 20:00 Budapest); az idő a `foglalas_egyeztetes.letrehozva` (a levél beérkezésének ideje a végponton), nem a foglalás ideje.
**TESZT-szűrés:** a saját futtatásaim UUID-listája (`qa3-teszt-uuid-lista-2026-10-07.txt`, 62 UUID: a `meres-naplo/*.json` `salonic_uuid` / `uuid` mezői + a `QA3_KONTROLLALT_TESZTEK.md` „Ismert zaj” listája), **nem** a postafiók-mappa alapján. Kivéve a listából: `f6e5962c-…` (valódi, a 2026-10-06 20:43-as fodrász-foglalás) és `f9f10dc7-…` (a dokumentum szerint nem az én futtatásom, eredete nem ismert).

## 1. Összesítő (`foglalas_egyeztetes`, az ablakban: 49 sor)
| csoport | állapot | párosított | riasztás | sor | `meres_kuldes` sor | első → utolsó beérkezés (UTC) |
|---|---|---|---|---|---|---|
| NEM_TESZT (nem az én futtatásom) | `fuggoben` | 0 | 0 | **23** | 0 | 10-07 04:12:30 → 17:21:53 |
| NEM_TESZT | `parositatlan` | 0 | 1 | **1** | 0 | 10-06 18:43:56 |
| TESZT (saját futtatás) | `fuggoben` | 0 | 0 | 10 | 0 | 10-06 18:38:20 → 10-07 06:44:05 |
| TESZT | `parositott` | 1 | 0 | 15 | 160 | 10-07 08:02:11 → 08:18:15 |

Összesen NEM_TESZT: **24** sor; **0 párosított, 0 küldési sor**. Összesen TESZT: 25 sor.

## 2. A NEM_TESZT sorok (UUID, vendégadat nélkül)
`uuid · állapot · próbálkozás · riasztás · beérkezett (UTC) · kulcs_forrás` (mind: nem párosított, 0 küldési sor)

| uuid | állapot | próba | riasztás | beérkezett | kulcs_forrás |
|---|---|---|---|---|---|
| f6e5962c-ebc8-a129-0a75-7cc985f63ee0 | parositatlan | 5 | 1 | 10-06 18:43:56 | salonic-oldal |
| dc88568d-21f4-d0e9-14c5-e143ecfc2416 | fuggoben | 4 | 0 | 10-07 04:12:30 | salonic-oldal |
| f9f10dc7-f652-dea6-d267-91de4f1b446e | fuggoben | 4 | 0 | 10-07 06:18:09 | salonic-oldal |
| 791f8da0-b108-82e1-13fc-99a2ef6e1776 | fuggoben | 4 | 0 | 10-07 07:22:24 | salonic-oldal |
| 7e5747ff-4fd0-343c-419a-751eead9b850 | fuggoben | 4 | 0 | 10-07 07:42:55 | salonic-oldal |
| f297a5df-3a12-0e04-081e-ff911a321d1b | fuggoben | 4 | 0 | 10-07 08:02:54 | salonic-oldal |
| e7a3ddd2-fd63-f11e-3aea-87f2ed0c3289 | fuggoben | 4 | 0 | 10-07 12:16:12 | salonic-oldal |
| 200d6dd2-d98c-3c6e-5eb7-2c000844b4f8 | fuggoben | 4 | 0 | 10-07 13:54:59 | salonic-oldal |
| a424f19e-0295-7da9-8031-f29d1326ca70 | fuggoben | 4 | 0 | 10-07 14:09:22 | salonic-oldal |
| ce48ae2c-95f6-039f-335a-c35e226657c4 | fuggoben | 4 | 0 | 10-07 14:11:09 | salonic-oldal |
| fce72167-cdbf-9def-bbac-107b2aba76ef | fuggoben | 4 | 0 | 10-07 14:13:21 | salonic-oldal |
| 8d939bdb-9e8a-362f-1fe0-e7b299970ecd | fuggoben | 4 | 0 | 10-07 14:15:20 | salonic-oldal |
| de5f99a0-055a-15dc-24f7-94c16b3191af | fuggoben | 4 | 0 | 10-07 14:16:04 | salonic-oldal |
| bb041f31-9be2-fb93-5f67-e44e6c908bef | fuggoben | 4 | 0 | 10-07 14:17:04 | nevtabla |
| f8980edf-7b35-abec-7be0-925d6a5cd37b | fuggoben | 4 | 0 | 10-07 14:50:36 | nevtabla |
| 7ca4ac9d-cae9-70c7-c886-ab832f000679 | fuggoben | 4 | 0 | 10-07 14:52:47 | nevtabla |
| ddc833b4-21a0-355b-6ae8-73dcfef531d7 | fuggoben | 4 | 0 | 10-07 15:02:48 | salonic-oldal |
| c6df078a-57b1-b087-dc9d-16c004d1e3d5 | fuggoben | 4 | 0 | 10-07 15:05:05 | salonic-oldal |
| 8659064f-521f-8742-e023-adf9b2855c91 | fuggoben | 4 | 0 | 10-07 15:37:38 | nevtabla |
| ffce57f3-4c86-e3c9-e393-b302a6c91012 | fuggoben | 4 | 0 | 10-07 15:37:39 | salonic-oldal |
| d9c97468-5e56-c260-8ffe-a036302065de | fuggoben | 4 | 0 | 10-07 16:17:56 | salonic-oldal |
| 00eba879-dfac-1c02-ed1e-5c5bc9524d96 | fuggoben | 4 | 0 | 10-07 16:32:09 | salonic-oldal |
| 47349ed3-2eb7-c5c9-2402-aa0196af9869 | fuggoben | 4 | 0 | 10-07 16:45:57 | salonic-oldal |
| 2c37acd6-f0da-f7db-af97-656bff5c1527 | fuggoben | 4 | 0 | 10-07 17:21:53 | salonic-oldal |

## 3. A lemondásnál felszabadult kulcsok (KÜLÖN sor; tájékoztató darabszám, nem téves párosítás)
`foglalas_lemondas`, ugyanebben az ablakban (`ido`):

| eredmény | tulajdonos-UUID a saját TESZT-listámban | db | első → utolsó (UTC) |
|---|---|---|---|
| `felszabadult` | igen | **20** | 10-06 18:38:21 → 10-07 14:31:40 |
| `felszabadult` | nem | **1** | 10-07 15:46:03 |
| `nincs bejegyzes` | – | 17 | 10-06 19:02:34 → 10-07 15:50:01 |
| `nem ellenorizheto: nincs UUID` | – | 1 | 10-07 08:05:05 |

## 4. Megfigyelések (nyers, ítélet nélkül)
- A 24 NEM_TESZT sor közül **23 `fuggoben`, 4 próbálkozással, riasztás nélkül**; az egyetlen `parositatlan` + riasztás sor az, amelyet 2026-10-07 reggel én dolgoztam fel újra a meglévő végponton (ezért 5 a próbálkozásszáma). A dokumentált várt végállapot (`QA3_KONTROLLALT_TESZTEK.md`) `parositatlan` + riasztás; a mért végállapot a 23 sornál `fuggoben` (a próbálkozások időrendje: a 4. kb. 14,5 perccel a beérkezés után).
- A NEM_TESZT sorok közül nem azonosítottak: mind a 24 (a Salonic aktív + törölt export és a Gmail UUID-lista a mérési munkamenet csomagjából jön; az összevetés közös). Tájékoztatásul: 10-07 14:09–15:37 UTC között 12 sor érkezett, köztük 4 `nevtabla` forrású; a 08:02:54-es sor (`f297a5df-…`) a QA-3 futtatásaim idején érkezett, de nincs a UUID-listámban.
- Küldés a NEM_TESZT sorokra: **0**; élő küldés: 0 (a küldési sorok csak a 15 párosított TESZT-sorhoz tartoznak: 160 sor).
- A mérés az ablak lezárta utáni ~10 perccel készült; a `letrehozva` a levél beérkezése, így a 18:00 UTC előtt beérkezett, de később feldolgozott levelek is bekerültek volna (az utolsó sor 17:21:53).
