# QA-3 kontrollált tesztek (2026-10-07-r7-utan)

**Célok** (csak árnyék): Meta dataset 28616665324611098 (`test_event_code` TEST83939) · TikTok ARNYEK pixel DB2GTTJC77UE4D1NE4MG (`test_event_code` TEST83543) · GA4 teszt-property G-M5MLRLNQBP · Google Ads ARNYEK másodlagos akciók (Zapier-webhookon át). Minden foglalás „TESZT – Claude” néven (a valódi 24 órás listából kiszűrhető). A vizsgált előnézet kódja és ága nem változott.

| eset | booking_id / PI | eredmény |
|---|---|---|
| R1a. X1: két levél, ELTÉRŐ „új vendég” jelzéssel (új → nem új) | `mb_0muyjg8cxm5jhu0se5dt3bc` | **PASS** |
| R1b. X1 fordított sorrendben (nem új → új) | `mb_0muyjh8mtg7mp4jlzzwhpge` | **PASS** |
| R2. Páros HeadSpa – a valódi minta: két levél, azonos booking_id és azonos jelzés, a 2. levél semmit nem küld | `mb_0muyji8447cpxnjj2gtmbqk` | **PASS** |
| R3. Normál (fizetős) első foglalás – oxigénterápiás első kezelés | `mb_0muyjj838g82bj12rmyeq98` | **PASS** |
| R4. VALÓDI visszajáró: nincs szimulált levél, a Zap valódi Salonic-levele | `mb_0muyjk7f4pp91jaz21pxc2m` | **PASS** |
| R5. Ugyanaz a levél kétszer (páros HeadSpa) | `mb_0muyjoz9mtufugd58fwq41a` | **PASS** |
| R6. Platformonkénti darabszám és esemény_id duplázás-ellenőrzés (R1–R5 együtt) | `–` | **PASS** |
| R7. A `fuggoben` nem végállapot: automatikus `parositatlan` + egyszeri riasztás + 0 küldés; a későbbi próba sem küld (DÖNTÉS #108) | `mb_0muyivlh3cdjvdf0e8tk2te` | **PASS** |

**Újrateszt (R1–R7): 7 / 7 eset PASS** (R1 csak akkor PASS, ha mindkét sorrend PASS: R1a PASS, R1b PASS; R2 PASS, R3 PASS, R4 PASS, R5 PASS, R6 PASS, R7 PASS). Az új, tiszta 24 órás QA-3 ablak feltétele (DÖNTÉS #108): R1–R7 mind PASS – teljesül.

## R1a. X1: két levél, ELTÉRŐ „új vendég” jelzéssel (új → nem új)

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muyjg8cxm5jhu0se5dt3bc`; Salonic-foglalás: `5ba42ba7-a77e-5e85-78c8-eb049c91330a`
- **szimulált elem:** az 1. level "uj vendeg: igen", a 2. level "uj vendeg: nem" (a Zap sajat levele a TESZT-vendegre ezt adja); a 2. level az 1. utan masodpercekkel megy, a Zap levele ekkor meg nem erkezett meg

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muyjg8cxm5jhu0se5dt3bc` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muyjg8cxm5jhu0se5dt3bc` | Schedule | 53 800 |
| tiktok | `FoglalasElso:mb_0muyjg8cxm5jhu0se5dt3bc` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muyjg8cxm5jhu0se5dt3bc` | CompletePayment | 53 800 |
| ga4 | `FoglalasElso:mb_0muyjg8cxm5jhu0se5dt3bc` | foglalas_elso | 53 800 |
| google | `FoglalasElso:mb_0muyjg8cxm5jhu0se5dt3bc` | ARNYEK-7825199989 | 53 800 |

Nem ment ki: google `Schedule:mb_0muyjg8cxm5jhu0s` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muyjg8cxm5jhu0s` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| 1. level utan kiment (Meta, TikTok, Google, GA4): alap + ernyo | [2,2,1,1] | [2,2,1,1] | PASS |
| 2. level (eltero jelzes): a valasz szerint nincs uj kuldes | mar_kuldve | mar_kuldve | PASS |
| javitott kod: a 2. level eltero jelzese latszik (jelleg_rogzites.eltero), de a rogzitett jelleg az 1. levele marad | ["elso",true,"visszajaro"] | ["elso",true,"visszajaro"] | PASS |
| egy foglalasbol EGY alapesemeny: a naploban csak FoglalasElso alap-esemeny van (nincs Visszajaro) | ["FoglalasElso"] | ["FoglalasElso"] | PASS |
| a 2. level utan a kiment esemenyek szama valtozatlan | 6 | 6 | PASS |

## R1b. X1 fordított sorrendben (nem új → új)

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muyjh8mtg7mp4jlzzwhpge`; Salonic-foglalás: `4ddfdc09-a826-ef9d-69cb-5562c32443fa`
- **szimulált elem:** az 1. level "uj vendeg: nem", a 2. level "uj vendeg: igen"; mindket level a SAJAT szallitobol (a Zap sajat levele ettol fuggetlenul erkezhet)

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `Visszajaro:mb_0muyjh8mtg7mp4jlzzwhpge` | HeadSpa_Visszajaro | 53 800 |
| tiktok | `Visszajaro:mb_0muyjh8mtg7mp4jlzzwhpge` | HeadSpa_Visszajaro | 53 800 |
| ga4 | `Visszajaro:mb_0muyjh8mtg7mp4jlzzwhpge` | visszajaro | 53 800 |

Nem ment ki: google `Visszajaro:mb_0muyjh8mtg7mp4` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| 1. level utan kiment (Meta, TikTok, Google, GA4): csak a Visszajaro alapesemeny (Google-akcio nincs, ernyo nincs) | [1,1,0,1] | [1,1,0,1] | PASS |
| 2. level (eltero jelzes): a valasz szerint nincs uj kuldes | mar_kuldve | mar_kuldve | PASS |
| javitott kod: a 2. level eltero jelzese latszik (jelleg_rogzites.eltero), de a rogzitett jelleg az 1. levele marad | ["visszajaro",true,"elso"] | ["visszajaro",true,"elso"] | PASS |
| egy foglalasbol EGY alapesemeny: a naploban csak Visszajaro alap-esemeny van (nincs FoglalasElso, nincs ernyo) | [["Visszajaro"],0] | [["Visszajaro"],0] | PASS |
| a 2. level utan a kiment esemenyek szama valtozatlan | 3 | 3 | PASS |

## R2. Páros HeadSpa – a valódi minta: két levél, azonos booking_id és azonos jelzés, a 2. levél semmit nem küld

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muyji8447cpxnjj2gtmbqk`; Salonic-foglalás: `bc587fd2-5e25-d90f-5b69-0f3d45a44ba3`
- **szimulált elem:** a 2. level a valodi mintaban csak a mosaicheadspa@ cimre megy; a /api/foglalas-egyeztetes bemenetben NINCS cimzett-mezo, ezert a futtato ezt nem tudja kifejezni: a szerver szamara a 2. level azonos uuid-ju (booking_id) es azonos jelzesu level (a mai 10 levelpar alapjan; TENY, ket par megnezve: a ket valodi level torzse karakterre azonos - 19 493 es 19 634 karakter, 0 elteres - csak a cimzett mas, hianyzo mezo nincs, ezert a szimulacio pontos)

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muyji8447cpxnjj2gtmbqk` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muyji8447cpxnjj2gtmbqk` | Schedule | 53 800 |
| tiktok | `FoglalasElso:mb_0muyji8447cpxnjj2gtmbqk` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muyji8447cpxnjj2gtmbqk` | CompletePayment | 53 800 |
| ga4 | `FoglalasElso:mb_0muyji8447cpxnjj2gtmbqk` | foglalas_elso | 53 800 |
| google | `FoglalasElso:mb_0muyji8447cpxnjj2gtmbqk` | ARNYEK-7825199989 | 53 800 |

Nem ment ki: google `Schedule:mb_0muyji8447cpxnjj` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muyji8447cpxnjj` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| javitott kod fut: a valasz tartalmazza a jelleg_rogzites mezot, az 1. level nem elter | [true,false] | [true,false] | PASS |
| az 1. level utan Meta + TikTok: alap + ernyo; Google + GA4: csak az alap | [2,2,1,1] | [2,2,1,1] | PASS |
| esemeny-nevek (Meta) | ["HeadSpa_FoglalasElso","Schedule"] | ["HeadSpa_FoglalasElso","Schedule"] | PASS |
| esemeny-nevek (TikTok) | ["CompletePayment","HeadSpa_FoglalasElso"] | ["CompletePayment","HeadSpa_FoglalasElso"] | PASS |
| 2. level (azonos booking_id, azonos jelzes): a valasz mar_kuldve, az eltero-jelzes NEM aktiv | ["mar_kuldve",false] | ["mar_kuldve",false] | PASS |
| a 2. level semmit nem kuldott: a kiment esemenyek es a sorok szama valtozatlan | [8,6] | [8,6] | PASS |
| egy alapesemeny-tipus (FoglalasElso) | ["FoglalasElso"] | ["FoglalasElso"] | PASS |
| kuldott ertek = a tenyleges ar (> 0), Meta alap = TikTok alap | true | true | PASS |
| nincs dupla (esemeny_id, platform) | true | true | PASS |

## R3. Normál (fizetős) első foglalás – oxigénterápiás első kezelés

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muyjj838g82bj12rmyeq98`; Salonic-foglalás: `8a43e95a-c9cb-54ff-43e8-2f05c6e78694`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muyjj838g82bj12rmyeq98` | Oxigen_FoglalasElso | 29 900 |
| meta | `Oxigen_AkviziciosFoglalas:mb_0muyjj838g82bj12rmyeq98` | Oxigen_AkviziciosFoglalas | 29 900 |
| tiktok | `FoglalasElso:mb_0muyjj838g82bj12rmyeq98` | Oxigen_FoglalasElso | 29 900 |
| tiktok | `Oxigen_AkviziciosFoglalas:mb_0muyjj838g82bj12rmyeq98` | Schedule | 29 900 |
| ga4 | `FoglalasElso:mb_0muyjj838g82bj12rmyeq98` | foglalas_elso | 29 900 |
| google | `FoglalasElso:mb_0muyjj838g82bj12rmyeq98` | ARNYEK-7825200901 | 29 900 |

Nem ment ki: google `Oxigen_AkviziciosFoglalas:mb` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Oxigen_AkviziciosFoglalas:mb` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| javitott kod fut: a valasz tartalmazza a jelleg_rogzites mezot, az 1. level nem elter | [true,false] | [true,false] | PASS |
| Meta + TikTok: alap + ernyo; Google + GA4: csak az alap | [2,2,1,1] | [2,2,1,1] | PASS |
| esemeny-nevek (Meta) | ["Oxigen_AkviziciosFoglalas","Oxigen_FoglalasElso"] | ["Oxigen_AkviziciosFoglalas","Oxigen_FoglalasElso"] | PASS |
| esemeny-nevek (TikTok) | ["Oxigen_FoglalasElso","Schedule"] | ["Oxigen_FoglalasElso","Schedule"] | PASS |
| egy alapesemeny-tipus (FoglalasElso), NEM konzultacio | ["FoglalasElso"] | ["FoglalasElso"] | PASS |
| kuldott ertek = a tenyleges ar (> 0, nem a konzultacio-ertek) | true | true | PASS |
| nincs dupla (esemeny_id, platform) | true | true | PASS |

## R4. VALÓDI visszajáró: nincs szimulált levél, a Zap valódi Salonic-levele

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muyjk7f4pp91jaz21pxc2m`; Salonic-foglalás: `f06b1498-f36b-407f-1826-dcc06ff74250`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `Visszajaro:mb_0muyjk7f4pp91jaz21pxc2m` | HeadSpa_Visszajaro | 53 800 |
| tiktok | `Visszajaro:mb_0muyjk7f4pp91jaz21pxc2m` | HeadSpa_Visszajaro | 53 800 |
| ga4 | `Visszajaro:mb_0muyjk7f4pp91jaz21pxc2m` | visszajaro | 53 800 |

Nem ment ki: google `Visszajaro:mb_0muyjk7f4pp91j` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| a Zap levele megerkezett es feldolgozodott (van alapesemeny sor) | true | true | PASS |
| alapesemeny: csak Visszajaro (a valodi Salonic-jelzes szerint nem uj vendeg), ernyo nincs | [["Visszajaro"],0] | [["Visszajaro"],0] | PASS |
| Meta / TikTok / GA4: kiment; Google: nem | [1,1,1,0] | [1,1,1,0] | PASS |
| Meta-nev | ["HeadSpa_Visszajaro"] | ["HeadSpa_Visszajaro"] | PASS |
| nincs dupla (esemeny_id, platform) | true | true | PASS |

## R5. Ugyanaz a levél kétszer (páros HeadSpa)

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muyjoz9mtufugd58fwq41a`; Salonic-foglalás: `fc70da25-448d-ddfb-c7f3-9ef917d73f59`

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| meta | `FoglalasElso:mb_0muyjoz9mtufugd58fwq41a` | HeadSpa_FoglalasElso | 53 800 |
| meta | `Schedule:mb_0muyjoz9mtufugd58fwq41a` | Schedule | 53 800 |
| tiktok | `FoglalasElso:mb_0muyjoz9mtufugd58fwq41a` | HeadSpa_FoglalasElso | 53 800 |
| tiktok | `Schedule:mb_0muyjoz9mtufugd58fwq41a` | CompletePayment | 53 800 |
| ga4 | `FoglalasElso:mb_0muyjoz9mtufugd58fwq41a` | foglalas_elso | 53 800 |
| google | `FoglalasElso:mb_0muyjoz9mtufugd58fwq41a` | ARNYEK-7825199989 | 53 800 |

Nem ment ki: google `Schedule:mb_0muyjoz9mtufugd5` (kihagyva: a Google-be csak alapesemeny megy (a visszajaro es az ernyo nem)); ga4 `Schedule:mb_0muyjoz9mtufugd5` (kihagyva: a GA4-be csak alapesemeny megy (az ernyo nem))

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| 1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve) | parositott + kesz / mar_kuldve | parositott + kesz | PASS |
| 2. hivas (ugyanaz a level): mar_kuldve | mar_kuldve | mar_kuldve | PASS |
| 2. hivas: duplikalt jelzes | true | true | PASS |
| esemeny-sorok szama | 8 | 8 | PASS |
| nincs dupla (esemeny_id, platform) | true | true | PASS |

## R6. Platformonkénti darabszám és esemény_id duplázás-ellenőrzés (R1–R5 együtt)

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `–`

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| dupla-level-eltero-jelzes (mb_0muyjg8cxm5jhu0se5dt3bc): kiment darabszam (Meta, TikTok, GA4, Google) | [2,2,1,1] | [2,2,1,1] | PASS |
| dupla-level-eltero-jelzes: egy alapesemeny-tipus; minden esemeny_id a sajat booking_id-jat hordozza | [1,true] | [1,true] | PASS |
| dupla-level-eltero-jelzes-forditva (mb_0muyjh8mtg7mp4jlzzwhpge): kiment darabszam (Meta, TikTok, GA4, Google) | [1,1,1,0] | [1,1,1,0] | PASS |
| dupla-level-eltero-jelzes-forditva: egy alapesemeny-tipus; minden esemeny_id a sajat booking_id-jat hordozza | [1,true] | [1,true] | PASS |
| paros-headspa (mb_0muyji8447cpxnjj2gtmbqk): kiment darabszam (Meta, TikTok, GA4, Google) | [2,2,1,1] | [2,2,1,1] | PASS |
| paros-headspa: egy alapesemeny-tipus; minden esemeny_id a sajat booking_id-jat hordozza | [1,true] | [1,true] | PASS |
| elso-foglalas (mb_0muyjj838g82bj12rmyeq98): kiment darabszam (Meta, TikTok, GA4, Google) | [2,2,1,1] | [2,2,1,1] | PASS |
| elso-foglalas: egy alapesemeny-tipus; minden esemeny_id a sajat booking_id-jat hordozza | [1,true] | [1,true] | PASS |
| valodi-visszajaro (mb_0muyjk7f4pp91jaz21pxc2m): kiment darabszam (Meta, TikTok, GA4, Google) | [1,1,1,0] | [1,1,1,0] | PASS |
| valodi-visszajaro: egy alapesemeny-tipus; minden esemeny_id a sajat booking_id-jat hordozza | [1,true] | [1,true] | PASS |
| dupla-level (mb_0muyjoz9mtufugd58fwq41a): kiment darabszam (Meta, TikTok, GA4, Google) | [2,2,1,1] | [2,2,1,1] | PASS |
| dupla-level: egy alapesemeny-tipus; minden esemeny_id a sajat booking_id-jat hordozza | [1,true] | [1,true] | PASS |
| platformonkenti OSSZES kiment darabszam (Meta, TikTok, GA4, Google) | [10,10,6,4] | [10,10,6,4] | PASS |
| esemeny_id duplazas: egyetlen (esemeny_id, platform) sem fordul elo ketszer az osszes kor-foglalas soraban | true | true | PASS |

## R7. A `fuggoben` nem végállapot: automatikus `parositatlan` + egyszeri riasztás + 0 küldés; a későbbi próba sem küld (DÖNTÉS #108)

- előnézet: `https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`; azonosító: `mb_0muyivlh3cdjvdf0e8tk2te`; Salonic-foglalás: `ab2e46ff-4039-4d0e-b570-bc97bd56348e`
- **szimulált elem:** a koszonooldali kulcs-iras (POST /api/foglalas-kulcs) a bongeszoben blokkolva (503): a foglalas igy sosem parosithato - ez az eles oldal helyzete; a levelek / probak a VALODI, elo Zaptol jonnek (0, ~1, ~4, ~14,5 perc), a vegen egyetlen szimulalt kesobbi level

**Kiment események (esemény_id platformonként):**

| platform | esemény_id | küldött név | érték |
|---|---|---|---|
| – | (nem ment ki semmi) | | |

| ellenőrzés | elvárt | tényleges | |
|---|---|---|---|
| a Zap valodi levele megerkezett (a sor letrejott) | true | true | PASS |
| AUTOMATIKUS lezaras: a vegallapot parositatlan (a fuggoben nem vegallapot) | parositatlan | parositatlan | PASS |
| egyszeri riasztas: riasztas = 1, a riasztas-listaban pontosan egyszer | [1,1] | [1,1] | PASS |
| 0 kuldes: nincs meres_kuldes sor, nincs booking_id parositas, nincs kuldve jelzes | [0,null,null] | [0,null,null] | PASS |
| (informacio) a lezaras a 4. (utolso) probanal tortent (probalkozas = 4); kevesebb = a lusta lezaras zarta le | 4 | 4 | PASS |
| kesobbi (szimulalt) level: a valasz parositatlan, kuldheto: false, lezart: true, nincs uj riasztas | ["parositatlan",false,true,false] | ["parositatlan",false,true,false] | PASS |
| a kesobbi level utan: az allapot / probalkozas / riasztas valtozatlan, 0 kuldes | ["parositatlan",4,1,0] | ["parositatlan",4,1,0] | PASS |
