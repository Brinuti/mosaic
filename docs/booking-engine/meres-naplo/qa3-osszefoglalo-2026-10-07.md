# QA-3 kontrollált tesztek (2026-10-07)

**Célok** (csak árnyék): Meta dataset 28616665324611098 (`test_event_code` TEST83939) · TikTok ARNYEK pixel DB2GTTJC77UE4D1NE4MG (`test_event_code` TEST83543) · GA4 teszt-property G-M5MLRLNQBP · Google Ads ARNYEK másodlagos akciók (Zapier-webhookon át). Minden foglalás „TESZT – Claude” néven (a valódi 24 órás listából kiszűrhető). A vizsgált előnézet kódja és ága nem változott.

| eset | booking_id / PI | eredmény |
|---|---|---|
| 1. A köszönőoldal újratöltése (F5) és a vissza gomb | `mb_0muxtjtr3gin6qhbck3u8xp` | **PASS** |
| 2. Ugyanaz a Salonic-levél kétszer a /api/foglalas-egyeztetes végpontra | `mb_0muxtlj14dwacw6r436go5h` | **PASS** |
| 3a. Lemondás a levél feldolgozása ELŐTT | `mb_0muxtofbcegaa8wjnnyl927` | **PASS** |
| 3b. Lemondás a konverzió kiküldése UTÁN + lemondási értesítő | `mb_0muxtpjt2rxfh24ke4gbynb` | **PASS** |
| 4. Visszajáró vendég | `mb_0muxtqkzr34g2ixhsuk1jyg` | **PASS** |
| 5. Kuponos foglalás | `mb_0muxtrm0s7td3j77go0c4rf` | **PASS** |
| 6a. Konzultáció – szőr | `mb_0muxtsit3pb08talbn8h8ae` | **PASS** |
| 6b. Konzultáció – fodrász | `mb_0muxttgwl1ignomdxhj0i6o` | **PASS** |
| 6c. Konzultáció – PMU | `mb_0muxtun72j77mxuk4bi8hwp` | **PASS** |
| 6d. Konzultáció – oxigén (akciós hajkamerás vizsgálat) | `mb_0muxtvn3luqgmv56cgmp1tb` | **PASS** |
| 7. Süti-elutasítás: Meta + TikTok küld, Google + GA4 elutasított jelzést kap | `mb_0muxtwmijefj7p5375tte69` | **PASS** |
| 8a. Kattintás TikTokról, foglalás Metáról | `mb_0muxtxqrcy4tbrtjzt9ji46` | **PASS** |
| 8b. Kattintás Metáról, foglalás Google-ről | `mb_0muxtyqvuxakvxfevv5rh9t` | **PASS** |
| 9. Ajándékkártya-visszatérítés: semmilyen hamis esemény nem megy ki | `pi_3UNpzOFv8vc2ArnL1ex8M5fO` | **PASS** |
| X1. EXTRA (nem a 9 eset): két levél ugyanarra a foglalásra, ELTÉRŐ „új vendég” jelzéssel | `mb_0muxu4sx86up4ponq8zi9bn` | **FAIL (3 / 5)** |

**Összesítés (a 9 eset, 14 futás):** 14 / 14 PASS. Az EXTRA (X1) eset külön, nem számít bele.

## 1. A köszönőoldal újratöltése (F5) és a vissza gomb

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtjtr3gin6qhbck3u8xp`; Salonic-foglalás: `b5e746b0-08cd-8981-7890-ab87c14aa83e`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muxtjtr3gin6qhbck3u8xp` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muxtjtr3gin6qhbck3u8xp` | Schedule | 53 800 |
| tiktok | `FoglalasElso:mb_0muxtjtr3gin6qhbck3u8xp` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muxtjtr3gin6qhbck3u8xp` | CompletePayment | 53 800 |
| ga4 | `FoglalasElso:mb_0muxtjtr3gin6qhbck3u8xp` | foglalas_elso | 53 800 |
| google | `FoglalasElso:mb_0muxtjtr3gin6qhbck3u8xp` | ARNYEK-7825199989 | 53 800 |

Nem ment ki: google `Schedule:mb_0muxtjtr3gin6qhb` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxtjtr3gin6qhb` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| az erkezesi adat mar a level elott tarolva van (a koszonooldal irta) | true | true | PASS |
| esemeny-sorok a level utan (4 alap + 4 ernyo) | 8 | 8 | PASS |
| esemeny-sorok a level UTANI F5 / vissza gomb utan (valtozatlan) | 8 | 8 | PASS |
| az erkezesi adat a level utani F5 utan valtozatlan (kiment esemeny utan nem modosul) | {"google":{"gclid":{"ertek":"Cj0KCQjw_TESZT_HEADSPA_MUXTJOMX_GCLID","ts":1791360095},"wbraid":{"ertek":"CoMKCQ | {"google":{"gclid":{"ertek":"Cj0KCQjw_TESZT_HEADSPA_MUXTJOMX_GCLID","ts":1791360095},"wbraid":{"ertek":"CoMKCQ | PASS |
| 2. level (ismetles): nincs uj kuldes | mar_kuldve | mar_kuldve | PASS |
| esemeny-sorok az ismetelt level utan | 8 | 8 | PASS |
| nincs dupla (esemeny_id, platform) | true | true | PASS |
| a bongeszoben mind a 7 lepes lefutott (betoltes, F5 x2, vissza, elore, F5 + vissza a level utan) | true | true | PASS |
| a vissza gomb a foglalo-oldalra visz, az elore gomb vissza a koszonooldalra | [true,true] | [true,true] | PASS |
| (informacio) az erkezesi / kulcs-iras POST-ja ujratolteskor nem ismetlodik a bongeszobol | 2 | 2 | PASS |

## 2. Ugyanaz a Salonic-levél kétszer a /api/foglalas-egyeztetes végpontra

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtlj14dwacw6r436go5h`; Salonic-foglalás: `05bbaed6-c370-e5a8-14d4-9254cef0463c`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muxtlj14dwacw6r436go5h` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muxtlj14dwacw6r436go5h` | Schedule | 53 800 |
| tiktok | `FoglalasElso:mb_0muxtlj14dwacw6r436go5h` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muxtlj14dwacw6r436go5h` | CompletePayment | 53 800 |
| ga4 | `FoglalasElso:mb_0muxtlj14dwacw6r436go5h` | foglalas_elso | 53 800 |
| google | `FoglalasElso:mb_0muxtlj14dwacw6r436go5h` | ARNYEK-7825199989 | 53 800 |

Nem ment ki: google `Schedule:mb_0muxtlj14dwacw6r` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxtlj14dwacw6r` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| 2. hivas (ugyanaz a level): mar_kuldve | mar_kuldve | mar_kuldve | PASS |
| 2. hivas: duplikalt jelzes | true | true | PASS |
| esemeny-sorok szama | 8 | 8 | PASS |
| nincs dupla (esemeny_id, platform) | true | true | PASS |

## 3a. Lemondás a levél feldolgozása ELŐTT

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtofbcegaa8wjnnyl927`; Salonic-foglalás: `cfc95e2c-f58c-f067-5cb0-8d14f5d88243`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| – | (nem ment ki semmi) | | |

Nem ment ki: meta `Konzultacio:mb_0muxtofbcegaa` (kihagyva: a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes); tiktok `Konzultacio:mb_0muxtofbcegaa` (kihagyva: a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes); google `Konzultacio:mb_0muxtofbcegaa` (kihagyva: a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes); ga4 `Konzultacio:mb_0muxtofbcegaa` (kihagyva: a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes); meta `Fodrasz_AkviziciosFoglalas:m` (kihagyva: a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes); tiktok `Fodrasz_AkviziciosFoglalas:m` (kihagyva: a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes); google `Fodrasz_AkviziciosFoglalas:m` (kihagyva: a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes); ga4 `Fodrasz_AkviziciosFoglalas:m` (kihagyva: a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes)

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| Salonic-allapot a lemondas utan | LEMONDVA | LEMONDVA | PASS |
| kiment esemenyek (Meta / TikTok / GA4 / Google) | [0,0,0,0] | [0,0,0,0] | PASS |
| minden cella "kihagyva" a lemondas miatt | true | true | PASS |

## 3b. Lemondás a konverzió kiküldése UTÁN + lemondási értesítő

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtpjt2rxfh24ke4gbynb`; Salonic-foglalás: `b2cd14a0-ddce-9895-970b-d7b38de81efe`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muxtpjt2rxfh24ke4gbynb` | PMU_FoglalasElso | 99 000 |
| meta | `Schedule:mb_0muxtpjt2rxfh24ke4gbynb` | Schedule | 99 000 |
| tiktok | `FoglalasElso:mb_0muxtpjt2rxfh24ke4gbynb` | PMU_FoglalasElso | 99 000 |
| tiktok | `Schedule:mb_0muxtpjt2rxfh24ke4gbynb` | Schedule | 99 000 |
| ga4 | `FoglalasElso:mb_0muxtpjt2rxfh24ke4gbynb` | foglalas_elso | 99 000 |
| google | `FoglalasElso:mb_0muxtpjt2rxfh24ke4gbynb` | ARNYEK-7825200913 | 99 000 |

Nem ment ki: google `Schedule:mb_0muxtpjt2rxfh24k` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxtpjt2rxfh24k` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| a lemondas ELOTT kimentek az esemenyek (PMU: Meta 2 + TikTok 2 + Google 1 + GA4 1) | [2,2,1,1] | [2,2,1,1] | PASS |
| Salonic-allapot a lemondas utan | LEMONDVA | LEMONDVA | PASS |
| a lemondasi ertesito felismerte a lemondast | lemondas | lemondas | PASS |
| a level ismetlese a lemondas utan: nincs uj kuldes | mar_kuldve | mar_kuldve | PASS |
| esemeny-sorok a lemondas es az ertesito utan valtozatlanok (nincs hamis / uj esemeny) | 8 | 8 | PASS |
| #128-on nincs Google-visszavonas (az eletut-esemenyek az #138-ban): nincs "Visszavonas" / "eletut" sor | false | false | PASS |

## 4. Visszajáró vendég

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtqkzr34g2ixhsuk1jyg`; Salonic-foglalás: `743c50fa-721a-342d-c0d2-1286a87886d5`
- **szimulált elem:** "uj vendeg: nem" jelzes a levelben (a TESZT-vendeg a Salonicban valoban nem uj; a jelzest a hivo adja)

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `Visszajaro:mb_0muxtqkzr34g2ixhsuk1jyg` | HeadSpa_Visszajaro | 53 800 |
| tiktok | `Visszajaro:mb_0muxtqkzr34g2ixhsuk1jyg` | HeadSpa_Visszajaro | 53 800 |
| ga4 | `Visszajaro:mb_0muxtqkzr34g2ixhsuk1jyg` | visszajaro | 53 800 |

Nem ment ki: google `Visszajaro:mb_0muxtqkzr34g2i` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| jelleg | visszajaro | visszajaro | PASS |
| csak alapesemeny (Visszajaro), ernyo nincs | ["Visszajaro"] | ["Visszajaro"] | PASS |
| Meta / TikTok / GA4: kiment; Google: nem | [1,1,1,0] | [1,1,1,0] | PASS |
| Meta-nev | ["HeadSpa_Visszajaro"] | ["HeadSpa_Visszajaro"] | PASS |

## 5. Kuponos foglalás

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtrm0s7td3j77go0c4rf`; Salonic-foglalás: `a80eb74b-8218-eccc-3bc5-ddf3ec9f80a0`
- **szimulált elem:** a level szolgaltatas-neve szimulalva: "KUPONKÓDDAL - PÁROS MOSAIC Head Spa kezelés" es ar: 0 Ft (valodi kuponkodos foglalashoz ervenyes Salonic-kuponkod kell; a foglalas maga normal HeadSpa foglalas)

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muxtrm0s7td3j77go0c4rf` | HeadSpa_FoglalasElso | 0 |
| tiktok | `FoglalasElso:mb_0muxtrm0s7td3j77go0c4rf` | HeadSpa_FoglalasElso | 0 |
| ga4 | `FoglalasElso:mb_0muxtrm0s7td3j77go0c4rf` | foglalas_elso | 0 |
| google | `FoglalasElso:mb_0muxtrm0s7td3j77go0c4rf` | ARNYEK-7825199989 | 0 |

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| ernyoesemeny nincs (egyetlen "ernyo" sor sem) | 0 | 0 | PASS |
| alapesemeny kiment (FoglalasElso) | true | true | PASS |
| kuldott ertek = a levelbeli ar (0 Ft) | 0 | 0 | PASS |

## 6a. Konzultáció – szőr

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtsit3pb08talbn8h8ae`; Salonic-foglalás: `e2b69ce9-7e7c-a0ae-d114-d2f973e80d35`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `Konzultacio:mb_0muxtsit3pb08talbn8h8ae` | Szor_Konzultacio | 27 000 |
| meta | `Schedule:mb_0muxtsit3pb08talbn8h8ae` | Schedule | 27 000 |
| tiktok | `Konzultacio:mb_0muxtsit3pb08talbn8h8ae` | Szor_Konzultacio | 27 000 |
| tiktok | `Schedule:mb_0muxtsit3pb08talbn8h8ae` | Schedule | 27 000 |
| ga4 | `Konzultacio:mb_0muxtsit3pb08talbn8h8ae` | konzultacio | 27 000 |
| google | `Konzultacio:mb_0muxtsit3pb08talbn8h8ae` | ARNYEK-7825200910 | 27 000 |

Nem ment ki: google `Schedule:mb_0muxtsit3pb08tal` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxtsit3pb08tal` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| kuldott ertek (a szor konzultacio-ertek, HUF) | 27000 | 27000 | PASS |
| az ernyo ugyanazzal az ertekkel | 27000 | 27000 | PASS |
| Meta + TikTok: alap + ernyo; Google + GA4: csak az alap | [2,2,1,1] | [2,2,1,1] | PASS |
| esemeny-nevek (Meta) | ["Schedule","Szor_Konzultacio"] | ["Schedule","Szor_Konzultacio"] | PASS |

## 6b. Konzultáció – fodrász

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxttgwl1ignomdxhj0i6o`; Salonic-foglalás: `a232a61f-0c0a-5aff-aba1-d6cf38ba0b80`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `Konzultacio:mb_0muxttgwl1ignomdxhj0i6o` | Fodrasz_Konzultacio | 13 000 |
| meta | `Fodrasz_AkviziciosFoglalas:mb_0muxttgwl1ignomdxhj0i6o` | Fodrasz_AkviziciosFoglalas | 13 000 |
| tiktok | `Konzultacio:mb_0muxttgwl1ignomdxhj0i6o` | Fodrasz_Konzultacio | 13 000 |
| tiktok | `Fodrasz_AkviziciosFoglalas:mb_0muxttgwl1ignomdxhj0i6o` | Schedule | 13 000 |
| ga4 | `Konzultacio:mb_0muxttgwl1ignomdxhj0i6o` | konzultacio | 13 000 |
| google | `Konzultacio:mb_0muxttgwl1ignomdxhj0i6o` | ARNYEK-7825200898 | 13 000 |

Nem ment ki: google `Fodrasz_AkviziciosFoglalas:m` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Fodrasz_AkviziciosFoglalas:m` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| kuldott ertek (a fodrasz konzultacio-ertek, HUF) | 13000 | 13000 | PASS |
| az ernyo ugyanazzal az ertekkel | 13000 | 13000 | PASS |
| Meta + TikTok: alap + ernyo; Google + GA4: csak az alap | [2,2,1,1] | [2,2,1,1] | PASS |
| esemeny-nevek (Meta) | ["Fodrasz_AkviziciosFoglalas","Fodrasz_Konzultacio"] | ["Fodrasz_AkviziciosFoglalas","Fodrasz_Konzultacio"] | PASS |

## 6c. Konzultáció – PMU

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtun72j77mxuk4bi8hwp`; Salonic-foglalás: `26a22a06-5dde-3110-6483-d5f0b8e53516`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `Konzultacio:mb_0muxtun72j77mxuk4bi8hwp` | PMU_Konzultacio | 13 800 |
| meta | `Schedule:mb_0muxtun72j77mxuk4bi8hwp` | Schedule | 13 800 |
| tiktok | `Konzultacio:mb_0muxtun72j77mxuk4bi8hwp` | PMU_Konzultacio | 13 800 |
| tiktok | `Schedule:mb_0muxtun72j77mxuk4bi8hwp` | Schedule | 13 800 |
| ga4 | `Konzultacio:mb_0muxtun72j77mxuk4bi8hwp` | konzultacio | 13 800 |
| google | `Konzultacio:mb_0muxtun72j77mxuk4bi8hwp` | ARNYEK-7825200916 | 13 800 |

Nem ment ki: google `Schedule:mb_0muxtun72j77mxuk` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxtun72j77mxuk` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| kuldott ertek (a pmu konzultacio-ertek, HUF) | 13800 | 13800 | PASS |
| az ernyo ugyanazzal az ertekkel | 13800 | 13800 | PASS |
| Meta + TikTok: alap + ernyo; Google + GA4: csak az alap | [2,2,1,1] | [2,2,1,1] | PASS |
| esemeny-nevek (Meta) | ["PMU_Konzultacio","Schedule"] | ["PMU_Konzultacio","Schedule"] | PASS |

## 6d. Konzultáció – oxigén (akciós hajkamerás vizsgálat)

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtvn3luqgmv56cgmp1tb`; Salonic-foglalás: `d7d8cba7-a17d-8406-3643-9a95c93719ac`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `Konzultacio:mb_0muxtvn3luqgmv56cgmp1tb` | Oxigen_Konzultacio | 8900 |
| meta | `Oxigen_AkviziciosFoglalas:mb_0muxtvn3luqgmv56cgmp1tb` | Oxigen_AkviziciosFoglalas | 8900 |
| tiktok | `Konzultacio:mb_0muxtvn3luqgmv56cgmp1tb` | Oxigen_Konzultacio | 8900 |
| tiktok | `Oxigen_AkviziciosFoglalas:mb_0muxtvn3luqgmv56cgmp1tb` | Schedule | 8900 |
| ga4 | `Konzultacio:mb_0muxtvn3luqgmv56cgmp1tb` | konzultacio | 8900 |
| google | `Konzultacio:mb_0muxtvn3luqgmv56cgmp1tb` | ARNYEK-7825200904 | 8900 |

Nem ment ki: google `Oxigen_AkviziciosFoglalas:mb` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Oxigen_AkviziciosFoglalas:mb` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| kuldott ertek (a oxigen konzultacio-ertek, HUF) | 8900 | 8900 | PASS |
| az ernyo ugyanazzal az ertekkel | 8900 | 8900 | PASS |
| Meta + TikTok: alap + ernyo; Google + GA4: csak az alap | [2,2,1,1] | [2,2,1,1] | PASS |
| esemeny-nevek (Meta) | ["Oxigen_AkviziciosFoglalas","Oxigen_Konzultacio"] | ["Oxigen_AkviziciosFoglalas","Oxigen_Konzultacio"] | PASS |

## 7. Süti-elutasítás: Meta + TikTok küld, Google + GA4 elutasított jelzést kap

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtwmijefj7p5375tte69`; Salonic-foglalás: `3f27111c-8228-480a-539e-ecb2966c1108`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muxtwmijefj7p5375tte69` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muxtwmijefj7p5375tte69` | Schedule | 53 800 |
| tiktok | `FoglalasElso:mb_0muxtwmijefj7p5375tte69` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muxtwmijefj7p5375tte69` | CompletePayment | 53 800 |
| ga4 | `FoglalasElso:mb_0muxtwmijefj7p5375tte69` | foglalas_elso | 53 800 |
| google | `FoglalasElso:mb_0muxtwmijefj7p5375tte69` | ARNYEK-7825199989 | 53 800 |

Nem ment ki: google `Schedule:mb_0muxtwmijefj7p53` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxtwmijefj7p53` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| hozzajarulas a naploban: statisztika nem, marketing nem | [false,false] | [false,false] | PASS |
| Meta kuldott (hash-elt e-mail + telefon) | [true,true,"elkuldve"] | [true,true,"elkuldve"] | PASS |
| TikTok kuldott (hash-elt e-mail + telefon) | [true,true,"elkuldve"] | [true,true,"elkuldve"] | PASS |
| Google: kuldes ELUTASITOTT jelzessel | ["elkuldve","DENIED"] | ["elkuldve","DENIED"] | PASS |
| GA4: kuldes ELUTASITOTT jelzessel | ["elkuldve","DENIED","DENIED"] | ["elkuldve","DENIED","DENIED"] | PASS |
| Google / GA4: hash-elt azonosito nem megy | false | false | PASS |

## 8a. Kattintás TikTokról, foglalás Metáról

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtxqrcy4tbrtjzt9ji46`; Salonic-foglalás: `417dacf8-a03b-a8ae-7c45-e71b9ea41d43`
- kattintás: 1. látogatás tiktok, 2. látogatás meta

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muxtxqrcy4tbrtjzt9ji46` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muxtxqrcy4tbrtjzt9ji46` | Schedule | 53 800 |
| tiktok | `FoglalasElso:mb_0muxtxqrcy4tbrtjzt9ji46` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muxtxqrcy4tbrtjzt9ji46` | CompletePayment | 53 800 |
| ga4 | `FoglalasElso:mb_0muxtxqrcy4tbrtjzt9ji46` | foglalas_elso | 53 800 |

Nem ment ki: google `FoglalasElso:mb_0muxtxqrcy4t` (kihagyva: nincs Google-kattintasazonosito (gclid / gbraid / wbraid): a feltoltes); google `Schedule:mb_0muxtxqrcy4tbrtj` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxtxqrcy4tbrtj` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| Meta fbc (fbclid): csak ha volt Meta-kattintas | true | true | PASS |
| TikTok ttclid: csak ha volt TikTok-kattintas | true | true | PASS |
| Google: elkuldve, ha volt Google-kattintas (gclid); egyebkent kihagyva (nincs kattintasazonosito) | kihagyva | kihagyva | PASS |
| Google "kihagyva" indoka: nincs Google-kattintasazonosito | true | true | PASS |
| a Meta-kerelem nem tartalmaz masik platform kattintasazonositot (gclid / wbraid / ttclid) | false | false | PASS |
| a TikTok-kerelem nem tartalmaz masik platform kattintasazonositot (gclid / wbraid / fbclid / fbc) | false | false | PASS |
| GA4 elkuldve (client_id az _ga sutibol) | elkuldve | elkuldve | PASS |

## 8b. Kattintás Metáról, foglalás Google-ről

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxtyqvuxakvxfevv5rh9t`; Salonic-foglalás: `758a285e-1748-9a0f-006a-486d051244a7`
- kattintás: 1. látogatás meta, 2. látogatás google

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muxtyqvuxakvxfevv5rh9t` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muxtyqvuxakvxfevv5rh9t` | Schedule | 53 800 |
| tiktok | `FoglalasElso:mb_0muxtyqvuxakvxfevv5rh9t` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muxtyqvuxakvxfevv5rh9t` | CompletePayment | 53 800 |
| ga4 | `FoglalasElso:mb_0muxtyqvuxakvxfevv5rh9t` | foglalas_elso | 53 800 |
| google | `FoglalasElso:mb_0muxtyqvuxakvxfevv5rh9t` | ARNYEK-7825199989 | 53 800 |

Nem ment ki: google `Schedule:mb_0muxtyqvuxakvxfe` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxtyqvuxakvxfe` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| Meta fbc (fbclid): csak ha volt Meta-kattintas | true | true | PASS |
| TikTok ttclid: csak ha volt TikTok-kattintas | false | false | PASS |
| Google: elkuldve, ha volt Google-kattintas (gclid); egyebkent kihagyva (nincs kattintasazonosito) | elkuldve | elkuldve | PASS |
| a Meta-kerelem nem tartalmaz masik platform kattintasazonositot (gclid / wbraid / ttclid) | false | false | PASS |
| a TikTok-kerelem nem tartalmaz masik platform kattintasazonositot (gclid / wbraid / fbclid / fbc) | false | false | PASS |
| GA4 elkuldve (client_id az _ga sutibol) | elkuldve | elkuldve | PASS |

## 9. Ajándékkártya-visszatérítés: semmilyen hamis esemény nem megy ki

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `pi_3UNpzOFv8vc2ArnL1ex8M5fO`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `Ajandekkartya:pi_3UNpzOFv8vc2ArnL1ex8M5fO` | HeadSpa_Ajandekkartya | 26 900 |
| meta | `Schedule:pi_3UNpzOFv8vc2ArnL1ex8M5fO` | Schedule | 26 900 |
| tiktok | `Ajandekkartya:pi_3UNpzOFv8vc2ArnL1ex8M5fO` | HeadSpa_Ajandekkartya | 26 900 |
| tiktok | `Schedule:pi_3UNpzOFv8vc2ArnL1ex8M5fO` | CompletePayment | 26 900 |
| ga4 | `Ajandekkartya:pi_3UNpzOFv8vc2ArnL1ex8M5fO` | purchase | 26 900 |
| google | `Ajandekkartya:pi_3UNpzOFv8vc2ArnL1ex8M5fO` | ARNYEK-7825199992 | 26 900 |

Nem ment ki: google `Schedule:pi_3UNpzOFv8vc2ArnL` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:pi_3UNpzOFv8vc2ArnL` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| a vasarlas esemenyei kimentek (Meta / TikTok alap, Google, GA4) | [1,1,1,1] | [1,1,1,1] | PASS |
| mindket Stripe teszt-visszaterites letrejott | [true,true] | [true,true] | PASS |
| esemeny-sorok a reszleges visszaterites utan (valtozatlan) | 8 | 8 | PASS |
| esemeny-sorok a teljes visszaterites utan (valtozatlan) | 8 | 8 | PASS |
| nincs Visszavonas / Korrekcio / Visszaterites / eletut sor: SEMMILYEN hamis esemeny nem ment ki | false | false | PASS |
| az ujrajatszas a visszaterites utan: nincs uj kuldes | mar_kuldve | mar_kuldve | PASS |
| nincs dupla (esemeny_id, platform) | true | true | PASS |

## X1. EXTRA (nem a 9 eset): két levél ugyanarra a foglalásra, ELTÉRŐ „új vendég” jelzéssel

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muxu4sx86up4ponq8zi9bn`; Salonic-foglalás: `5d263a44-53bb-f333-f3d6-c6914c1ba093`
- **szimulált elem:** az 1. level "uj vendeg: igen", a 2. level "uj vendeg: nem" (a Zap sajat levele a TESZT-vendegre ezt adja); a 2. level az 1. utan masodpercekkel megy, a Zap levele ekkor meg nem erkezett meg

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muxu4sx86up4ponq8zi9bn` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muxu4sx86up4ponq8zi9bn` | Schedule | 53 800 |
| meta | `Visszajaro:mb_0muxu4sx86up4ponq8zi9bn` | HeadSpa_Visszajaro | 53 800 |
| tiktok | `FoglalasElso:mb_0muxu4sx86up4ponq8zi9bn` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muxu4sx86up4ponq8zi9bn` | CompletePayment | 53 800 |
| tiktok | `Visszajaro:mb_0muxu4sx86up4ponq8zi9bn` | HeadSpa_Visszajaro | 53 800 |
| ga4 | `FoglalasElso:mb_0muxu4sx86up4ponq8zi9bn` | foglalas_elso | 53 800 |
| ga4 | `Visszajaro:mb_0muxu4sx86up4ponq8zi9bn` | visszajaro | 53 800 |
| google | `FoglalasElso:mb_0muxu4sx86up4ponq8zi9bn` | ARNYEK-7825199989 | 53 800 |

Nem ment ki: google `Schedule:mb_0muxu4sx86up4pon` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muxu4sx86up4pon` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem)); google `Visszajaro:mb_0muxu4sx86up4p` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| 1. level utan kiment (Meta, TikTok, Google, GA4): alap + ernyo | [2,2,1,1] | [2,2,1,1] | PASS |
| 2. level (eltero jelzes): a valasz szerint nincs uj kuldes | mar_kuldve | kesz | **FAIL** |
| egy foglalasbol EGY alapesemeny: a naploban csak FoglalasElso alap-esemeny van (nincs Visszajaro) | ["FoglalasElso"] | ["FoglalasElso","Visszajaro"] | **FAIL** |
| a 2. level utan a kiment esemenyek szama valtozatlan | 6 | 9 | **FAIL** |
