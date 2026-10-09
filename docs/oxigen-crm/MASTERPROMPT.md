# MOSAIC HEADSPA × OXYGENI — CLAUDE FEJLESZTÉSI MASTERPROMPT

**EGYETLEN ÖNÁLLÓ ÁTADÓFÁJL • WEBOLDAL + MINI CRM • v1.0 • 2026. október 9.**

> **Ezt a teljes fájlt Claude Code / Claude Work számára add meg projektutasításként.** A fájl ELEJE a megvalósítási specifikáció, a végén a 121 tulajdonosi döntés és a végleges, 46 oldalas mesteranyag szövege található. A kettő együtt a kötelező forrás. **Az itt készülő fájl fejlesztési utasítás, önmagában nem jelenti azt, hogy a Salonic, e-mail, SMS vagy éles weboldal integrációja már elkészült.**

## 0. Azonnal végrehajtandó feladat Claude-nak

Ön egy senior full-stack fejlesztőből, UX/UI tervezőből, CRM-automatizációs mérnökből, biztonsági/adatvédelmi tervezőből és QA szakértőből álló megvalósítási csapatként dolgozik. **Két szorosan integrált rendszert építsen EGY projektben**:

1. **MOSAIC Oxygeni konverziós landing:** prémium, reszponzív, valós MOSAIC-arculatú, működő frontend az eredeti `https://www.mosaicheadspa.hu/oxigenterapia-budapest` oldalhoz; a már létező saját 4 lépéses booking-folyamat és az élő Salonic-naptár integrációjával.
2. **MOSAIC Oxygeni mini CRM:** a két Salonic-fiókból érkező foglalások összefűzése, vendég/kezelési előzmények, digitális előzetes állapotfelmérés, kezelői kúraterv, hajkamerás képek, bérletkezelés, személyes A5 PDF, automatikus e-mail/SMS-sorozatok, panasz-/hozzájárulás-/státusz- és méréskezelés.

**Nem csak tervdokumentumot kérek.** A feladatot a rendelkezésre bocsátott projektfájlokhoz, kódrepohoz, CMS-hez és hitelesített integrációkhoz igazodva végezze el, lehetőség szerint működő, tesztelt kóddal, saját fejlesztői környezetben futtatható demóval és átadással. Ami valós hozzáféréstől függ, azt működő tesztadapterrel és látható `INTEGRATION_BLOCKED` állapottal adja át; **soha ne állítsa, hogy élő Salonic/e-mail/SMS-küldés működik, ha nem igazolta**.

**Ne kérdezze végig újra a tulajdonost** a 121 lezárt üzleti döntésről. Ne készítsen újabb 30–60 oldalas stratégiai tanulmányt. Valósítson meg; technikailag ellenőrizendő tényekből képezzen pontos, tesztelhető függőségi listát. Az éles üzembe helyezéshez tulajdonosi jóváhagyás kell.

### 0.1. Kötelező forráshierarchia és változtatási fegyelem

1. **Elsődleges:** e fájl `# 121 jóváhagyott döntés` függeléke (későbbi döntés felülírja az azt megelőző ellentmondó választ).
2. **Másodlagos:** e fájl `# Forráshű mesteranyag` függeléke, benne a pontos landing copy, CRM/üzenetek/QA és terv.
3. **Harmadlagos:** a projektben elérhető létező MOSAIC weboldal, meglévő 4 lépéses foglaló kódja, arculat, assetek, Salonic-szolgáltatásazonosítók és saját integrációs dokumentációk, amennyiben nem ütköznek az új üzleti döntésekkel.
4. **Külső, ellenőrzött tény:** Salonic dokumentált integrációs módja, e-mail/SMS szolgáltató, CMS/hosting, adatkezelési/ÁSZF előírások. Semmit ne találjon ki API-ként vagy saját gyártói adatként.

A **verbatim vendégszövegeket** a mesteranyagból emelje át. Csak megjelölt szükséges javítást/technikai változót használjon, üzleti tartalmat és árszabályt ne írjon át önkényesen. Ha valódi forrás és a követelmény ellentmond: a 121 tulajdonosi döntés a célállapot; az aktuális éles rendszer eltérését migrációs feladatként kell kezelni, nem automatikusan átírni a tulajdonosi döntést. ÁSZF/GDPR esetén jogszabályi megfelelést nem írhat felül üzleti döntés.

### 0.2. TILOS

- **Tilos** megváltoztatni a 11 alkalmas teljes kúra definícióját, a bérletek árát/tartalmát, a 4 990 Ft beszámításának manuális jellegét vagy a 48 órás lemondási szabályt.
- **Tilos** visszatenni a megszüntetett kombinált arc+haj kezelést az új landingre, vagy új foglalásra kínálni (korábbi visszaigazolt foglalásokat teljesíteni kell).
- **Tilos** nyolcoldalas általános prospektust, vendégportált, online bérletvásárlást vagy kötelező online előrefizetést bevezetni.
- **Tilos** az ügyfelek valódi fejbőrállapotáról szóló AI-generált előtte/utána képet, kitalált véleményt, kitalált szakembert, hamis `-X%` bérletkedvezményt, csúsztatott `95%` orvosi garanciát használni.
- **Tilos** kihagyott/lemondott kezelést automatikusan `completed`-nek tekinteni, vagy csak a naptáridő letelte miatt e-mail-utókövetést indítani.
- **Tilos** marketing-hozzájárulás nélkül, vagy nyitott panasz ellenére bérletajánló/visszafoglaló üzeneteket kiküldeni.
- **Tilos** érzékeny képeket vagy állapotfelmérőket publikus linkkel, nyílt Google Drive mappából vagy ellenőrizetlen címzettnek megosztani.
- **Tilos** a működő foglalás helyett pusztán klikkelhető UI-prototípust `kész` státusszal átadni.
- **Tilos** az oldal élesítésekor a régi landingre visszaállítani: a tulajdonosi döntés kizárja a rollback-ágat. Kritikus hibát az új rendszeren kell kijavítani, de a GO előtti teszteket emiatt szigorítani kell.

## 1. Kimeneti szerződés és megvalósítási folyamat

### 1.1. Először technikai felmérés — NE találj ki infrastruktúrát

1. Azonosítsd a jelenlegi site CMS/framework/hosting rendszerét, a valós oldal-/komponensszerkezetet, a mérési tageket, a SEO/DSA céloldalakat, a nyitott 4 lépéses foglaló tényleges lépéseit és a Salonic-kapcsolatot. **A mesteranyag nem tartalmazza a korábbi 4 lépés pontos belső képernyősorrendjét**: ezt a meglévő UI/kódból vedd át, ne nevezd általad kitalált sorrendet jóváhagyottnak.
2. Azonosítsd a **két** Salonic-fiók azonosítóit, hitelesítési/integrációs korlátait, a valós `attended/completed` megállapíthatóságát, a kezelői megerősítés módját, az időpontválasztó integrálhatóságát; előbb dokumentáció és hozzáférés vizsgálata, aztán adapter-implementáció.
3. Ellenőrizd, milyen e-mail- és SMS-küldő rendszer van már használatban, illetve mely jogalap/hozzájárulási mezők léteznek. Tesztkörnyezetben csak tesztcímzettekre küldj; éles címzettre nulla automatikus küldés a tulajdonosi GO-ig.
4. Tekintsd át a már használatos MOSAIC arculati elemeket, logót, színeket, betűtípusokat, hiteles fotókat és a két mellékelt gyártási forrást. A külön vizuális assetcsomag később érkezik; ehhez lásd az `ASSET CONTRACT` szakaszt.
5. Add vissza a `known / verified / requires access` listát. Ha nincs hozzáférés, **azonnal építs helyben futtatható demót tesztadapterekkel**, ne állj meg általános tanácsadásnál.

### 1.2. Építés és átadás, kívánt kimenet

- `site/`: a meglévő oldalszerkezethez illesztett vagy izolált, majd integrálható reszponzív frontend; a teljes landing szekciókkal és négylépéses booking-felülettel.
- `crm/`: hitelesített szerepkörös kezelői és recepciós felület, backend, migrációk, adatmodell, eseményfeldolgozás, scheduler/queue, e-mail/SMS-adapterek, privát fájlhozzáférés.
- `shared/`: típusok, ár- és szabálykonstansok, normalizáló és validáló logika, i18n/hu-HU, integrációs interfészek.
- `tests/`: automatizált unit, integration, E2E, security és shadow-mode QA; a kötelező negatív esetekkel.
- `docs/`: telepítés, környezeti változók, adatkezelési változók, Salonic adatmap, események, monitoring, felhasználói kézikönyv, átvételi checklist, üzleti döntésnyomkövetés.
- `.env.example` kizárólag dummy változónevekkel, semmilyen élő kulccsal vagy személyes adattal.
- Saját gépen indítható, tesztadatokkal feltöltött, működő `demo` útvonal; a hiányzó valós integrációk jelzése a UI-ban.

Éles környezet felülírását, valódi kiküldéseket, DNS-módosítást, bérlettranzakciót, tömeges importot vagy visszavonhatatlan műveletet **csak külön explicit tulajdonosi jóváhagyással** végezz. Az itt szereplő üzleti GO-jogosultság nem jelent automatikus felhatalmazást valós élesítési akcióra.

**Definition of Done:** kattintható, reszponzív, valós business copyt használó landing + élesre előkészített CRM-logika + átfutó tesztek + hozzáférésfüggőségek + nulla hamis „integrálva” állítás. A többi feladat státusza legyen `DONE / TESTED_WITH_MOCK / BLOCKED_BY_EXTERNAL / REQUIRES_GO`.

## 2. WEBOLDAL – implementációs specifikáció

### 2.1. Arculat és tartalmi karakter

- MARADJON a meglévő MOSAIC vizuális karakter: prémium **sötétzöld–krém–arany**, elegáns tipográfia, levegős editorial split layoutok, nagy valódi szalonfotók, lágy finom mozgások, kiváló olvashatóság.
- Ne találj ki színkódot vagy betűcsaládot úgy, mintha brand-guide adat lenne: a jelenlegi CSS/logó/arculat alapján állapítsd meg. Ha nincs hozzáférés, CSS design tokenekkel és egyértelműen `provisional` jelöléssel építs tesztnézetet.
- Nem klinikai landing, de szakmailag fegyelmezett: természetes, emberi, meggyőző szöveg, alaptalan orvosi vagy haj-növekedési garancia nélkül.
- A hero legyen ad → landing **message matching** képes: a meglévő hirdetésváltozat tényleges headline/assetjét konzisztensen tegye a hozzá tartozó oldalvariánsba **csak ha hiteles forrás és kampányparaméter van**; ne próbáljon kitalált hirdetésadatból személyre szabni.

### 2.2. Alapszabályok — nem módosíthatók

| Paraméter | Végleges |
|---|---|
| URL | `https://www.mosaicheadspa.hu/oxigenterapia-budapest` (útvonal megtartandó) |
| H1 | `Hullik, ritkul vagy gyorsan zsírosodik a hajad?` |
| Hero CTA 1 | `Első kezelést foglalok – 29 900 Ft` |
| Hero CTA 2 | `Hajkamerás állapotfelmérést foglalok – 4 990 Ft` |
| Első kezelés | 80 perc, 29 900 Ft, fizetés helyben kezelés után |
| Külön hajkamera | 30 perc, 4 990 Ft, fizetés helyben |
| További kezelés | 26 000 Ft, fizetés helyben kezelés után |
| Teljes kúra | 11 kezelés = első 29 900 + 10 további kezelésből álló 260 000 Ft bérlet; együtt 289 900 Ft |
| 5-ös bérlet | ELSŐN FELÜLI öt alkalom, 130 000 Ft; 1 liter sampon ajándék; nem teljes kúra |
| 10-es bérlet | ELSŐN FELÜLI tíz alkalom, 260 000 Ft; 1 l sampon + 1 l balzsam ajándék |
| Kedvezmény | Bérletárra nincs fiktív százalékos árkedvezmény, ár/alkalom 26 000 |
| Átadás | Bérletet csak személyesen vásárolnak, teljes díj előre |
| Hajkamerás kontroll | 1., 3., 5., 10. kezelés; 11. zárás a korábbi képek alapján |
| Érkezés | kezelés előtt 24 órával ne mosson hajat; utána nincs általános hajmosási tilalom |
| Hajfestés | egyénileg kezelő által meghatározott |
| Elsődleges kúra-ritmus | kéthetente, szakmai indokból változhat |
| Kombinált arc+haj kezelés | új oldalon nulla megjelenés; új értékesítés 0 |
| Foglaló | meglévő négylépéses UI a landingben, negyedik lépés élő Salonic-naptár |
| Fizetés | online fizetés és checkout nem eleme a felületnek |

**4 990 Ft beszámítás:** felmérés után 30 naptári napon belüli első kezelés-foglalás jogosít a 4 990 Ft manuális levonására; a kezelés lehet későbbi, áthelyezésnél jog marad, teljes lemondáskor megszűnik. A foglalásért és az időpontért a kezelő/recepció a belső CRM-ben manuálisan rögzíti az egyszeri jóváírást. A 24 910 Ft fennmaradó összeg csak a jogosult, ellenőrzött vendégre igaz, **nem általános promóciós ár**.

### 2.3. Szekciólista és vizuális viselkedés

1. **Hero:** valós MOSAIC helyszín- és kezelési fotó/videó; H1; emberi leírás; 80/30 perc; két jól elkülönülő CTA; 11 alkalmas program átlátható, de ne legyen fenyegető; hiteles partner/képzés megjelenítés.
2. **Négy problémakártya:** hajhullás/ritkulás; gyors zsírosodás; korpás/érzékeny fejbőr; vékony/erőtlen haj. Több válasz lehetséges, nem diagnózis; választott panasz a CRM-előkészítésbe kerüljön, ha van jogszerű cél/jogalap.
3. **Problémák és állapotfelmérés:** mit tud/mit nem tud a hajkamera, valódi mikrokamerás kép, nem orvosi diagnózis; mikor szükséges szakemberhez irányítás.
4. **Így zajlik az első 80 perc:** állapotfelmérő és biztonság; kiinduló kamera; Oxygeni fejbőrápolás; személyes A5 terv és következő időpont; lehetőleg saját 30–45 s videó.
5. **Szakemberek + MOSAIC hitelesség:** valós Oxygeni-képzett kezelők, hivatalos partnerszalon, helyszín Kolosy tér/Bécsi út 2. Csak ellenőrzött véleményszám/review, ne találj ki neveket/fotókat.
6. **11 alkalmas kúra és kameramérföldkövek:** két hetes ütemezési mintával; kamera az 1., 3., 5., 10.; 5–6. köztes szakmai értékelés; 11. személyes lezárás; elvárások, nincs eredményígéret.
7. **Ár- és bérletblokk:** 29 900 / 4 990 / 26 000 / 130 000 / 260 000 / 289 900, bérlethez kapcsolódó termékajándék; első előtt/aznap vásárolt csomaghoz készletfüggő kis termék, nincs hamis kedvezmény; bérlet személyesen.
8. **Személyes kúraterv és otthoni rutin:** digitális kezelői űrlap → nyomtatható A5 + e-mail; termékápolás erősen ajánlott, nem kötelező, termékek csak személyesen megvásárolhatók.
9. **Valódi vendégtapasztalatok:** csak felhasználási jogosultsággal; a 2 millió kezelés / 95% kizárólag a tényleges gyártói definíció és hivatkozás birtokában, gyártói attribúcióval; nem egyéni garancia.
10. **GYIK:** a függelékben szereplő jóváhagyott teljes szövegekkel (ár, időtartam, kúra, termék, kamera, 48h lemondás, hajmosás, bérlet stb.).
11. **Helyszín és praktikus információk:** ellenőrzött pontos MOSAIC cím, nyitvatartás csak valós forrásból, kapcsolat, akadálymentes mobil olvashatóság.
12. **Final close + beágyazott booking-blokk:** két CTA; görgetés és fókuszkezelés ugyanazon az oldalon; szolgáltatás előtöltve, nem újra választandó; élő naptár a negyedik lépésben.

A végleges mesteranyag 6 × 2 = **12 desktop/mobil wireframe-ját** tekintsd kötelező vizuális ellenőrzésnek, nem teljes 12 külön oldalas weboldalnak. Egyetlen folytonos desktop/mobile landinget hozz létre.

### 2.4. Négylépéses foglaló — integrációs szerződés

- Meglévő MOSAIC 4 lépéses komponens újrafelhasználása, UI/szövegek illesztése Oxygenire. Ha nincs hozzáférés, készíts 4-stage adapter-shellt, de **a belső 1–3. lépést ne nevezd véglegesnek**, amíg a jelenlegi folyamatot nem láttad.
- `selected_service`: `first_hair` vagy `camera_assessment`, a CTA azonnal prefill; másik szolgáltatás választása lehetséges a kezelő által jóváhagyott UX-ben, de nem kötelező újraválasztani.
- Kezelők alapértelmezetten `any`; összes tényleges szabad slot megjelenik; opcionálisan szűrhető; visszatérő vendégnél korábbi kezelő javasolt, de változtatható.
- 4. lépés: tényleges **élő Salonic-naptár** és idősáv, forrásfiókkal/kezelővel; foglalási konfliktus/slot-race esetén atomikus végleges ellenőrzés; megismételt kattintás nem hoz létre dupla foglalást.
- A foglalás csak akkor `booking_confirmed`, ha a Salonic valóban visszaadja a foglalási azonosítót. SikerUI, sikeremail, hirdetési konverzió addig **nem** mehet.
- Mindkét CTA az oldalon belüli booking blokkhoz görget (`scrollIntoView` + fókusz), mobilon billentyűzettel is használható. Nincs popup, külső checkout vagy külön landing.
- A foglalási UI-ban **külön, opcionális, előre nem kipipált** marketinghozzájárulás a visszafoglalási/bérletajánló e-mail és SMS üzenetekhez, csatornánként adatbázisban külön értékkel. A felméréshez szükséges adatkezelés nem marketing checkbox.
- Booking UI a tényleges Salonic-ütközés esetén jelölje a slotot foglaltnak és kérjen új választást; élesítés előtt működő foglalást kell bizonyítani, külön vészhelyzeti csatornát a tulajdonos nem kért.

### 2.5. Frontend minőség, SEO/DSA, mérés

- Mobil 390 × 844, 375 × 812, tablet és desktop 1440 px; valódi tap, fókusz, tab-order, kontraszt, videó felirat, kép alt, `prefers-reduced-motion`, magyar diakritika és pénzformátum.
- CWV és hozzáférhetőség célok mérve: LCP/INP/CLS, képoptimalizálás, lazyload, első látható CTA késleltetés nélkül. Az oldalspecifikus célértéket baseline alapján jelentsd, ne találj ki „előtte” eredményt.
- Meglévő URL, H1/H2 hierarchia, canonical, robots, sitemap, belső linkek, schema.org csak valós adatok, keresőindexelési státusz; DSA céloldal és konverzióvédő audit élesítés előtt.
- Mérési eseménykontraktus: `view_oxyg_landing`, `select_problem`, `click_hero_first`, `click_hero_camera`, `booking_start`, `booking_step_completed`, `booking_slot_selected`, `booking_confirmed_salonic`, `form_assessment_submitted`, `treatment_attended_verified`, `package_purchased`, `next_booking_on_site`, `camera_review_ready`, `plan_sent`, `crm_message_sent`. A web és CRM eseményekben stabil belső `event_id`, `booking_uuid`, `service_type`; PII és egészségi adat soha ne kerüljön pixel-adatba.
- GA4 / Google Ads / Meta / TikTok: a valós foglalás és az igazolt megjelenés külön esemény legyen; **0 duplikált és 0 hamis konverzió**. A korábbi QA-3 shadow-mode elv: teszt-eset valós adatlekötés, éles pixel/email/SMS nélkül a tesztkörben.

## 3. MINI CRM – működő termék, nem „email plugin”

### 3.1. Architektúra-alapelv

- Egy **külön, biztonságos belső vendégnyilvántartás** áll a két Salonic-fiók fölött. A Salonic marad a foglalások és az időpontok rendszerének hiteles forrása; CRM-ben a vendégszintű összefűzés, kúra, képek, terv, bérlet, kommunikáció és audit a közös logika.
- Az éles hosting stack kiválasztása a meglévő szerveren, üzemeltetőn és támogatott integrációkon alapul. Ha nincs repo/hosting hozzáférés, önálló TypeScript/full-stack POC készíthető (pl. Next.js + Postgres + background worker + objektumtároló), de **csak demonstrációs architektúraként**. Ne kényszeríts önkényes CMS- vagy Wix→Next.js migrációt.
- Backend kontrollálja a business rule engine-t és az írásokat, nem a böngésző vagy egy LLM. Frontenden nincs közvetlen fájl- és egészségi adat hozzáférés.
- Idempotens webhooks/polling, outbox queue, háttérütemezés, retry/backoff, dead-letter és kézi újrafuttatás. `booking_uuid + status + updated_at` alapján sorrendiség/duplikáció kezelése; soha nem dupláz automatikus üzenetet.
- Külön teszt és éles környezet; tesztben minden SMS/e-mail sandboxban, `DRY_RUN` alapértelmezés; `PRODUCTION_SEND_ENABLED` külön jogosított config és tulajdonosi jóváhagyás.

### 3.2. Belső UI — kötelező képernyők

1. **Dashboard:** ma/holnap foglalások, új első kezelések, hajkamerás felmérések, valóban teljesített alkalmak, készülő A5, lejáró bérletek, STOP státusz, küldési hibák; külön kezelői és menedzsment nézet.
2. **Vendégkereső/profil:** egy közös `guest_key`, két Salonic forrás ID, kapcsolat/jogosultság, foglalástörténet, panasz, kúra, bérlet, consent, üzenetek, dokumentumok.
3. **Napi kezelői munkalista:** mai időpontok, előre kitöltött questionnaire státusz, kontraindikáció-jelzés, megjelenés, kezelés leigazolása, következő időpont.
4. **Digitális Oxygeni állapotfelmérő:** gyártói protokoll alapján MOSAIC-ra szabott, biztonsági kérdések kezelői átnézése; a pontos kérdéslistát az eredeti gyártói anyagból validálni kell, ne készíts „végleges szakmai” klinikai kérdéseket találomra.
5. **Kezelői kúraterv-szerkesztő:** előzmény/panasz, kamera megfigyelés, cél, javasolt kezelés/ritmus, következő foglalás, otthoni Oxygeni-rutin, személyes üzenet, kezelő, mentés/jóváhagyás, A5 PDF preview/nyomtatás, e-mail kiküldés status.
6. **Kameraképek:** 1/3/5/10 ellenőrző sorozat, ugyanazon rögzítési pont, két kép összehasonlítás, kezelő 2–3 mondatos komment, privát hozzáférés, vendégnek 30 napos link, új link kérése e-mail hitelesítéssel, nem portal.
7. **Bérletek és ajándékok:** 5/10 bérlet vásárlás, lejárat, felhasználás és fenntartott/lefoglalt alkalmak, ajándék SKU-kategória és átadás, kifizetés helyszínen, kivételes hosszabbítás/refund, minden művelet audit.
8. **Hajkamerás beszámítás:** `credit_eligible`, határidő és first-booking proof, manuális 4 990 Ft levonás és egyszer felhasználható `consumed_at` + `booking_uuid`.
9. **Küldési vezérlő:** sablonok, előnézet, aktuális guest state, késleltetett jobs, skip/STOP okok, retry/idempotencia, kézi sandbox próba; nem enged LLM-nek spontán e-mailt küldeni.
10. **Hozzájárulások:** csatornánkénti opt-in/out, külön képmarketing consent, változattörténet, adatkezelési események.
11. **Elégedettség és panasz:** 1–5 pontos survey, opcionális komment, Janka-alert; saját kezelő 24h kapcsolat, 2 hívás + 1 e-mail, ügyállapot, kompenzáció-approval.
12. **Kúrazáró dokumentum:** 11. completed alapján A5 zárás az 1/3/5/10 összehasonlításokkal, egyéni fenntartási javaslat, automatikus kiküldés kész adat után.
13. **Vendégprofil-összevonási sor:** automatikus safe match vs kézi kezelői jóváhagyás, bizonytalanság, audit és visszafordítható hibakezelés.
14. **Operatív/marketing dashboard:** SHOW1, R2/R5/R10/R11, foglalás- és megjelenés-cohort, bérletkonverzió, 30 napos felmérés→first, kampány és kezelő bontás, consent arány, kézbesítési státusz.
15. **Hozzáférés és beállítások:** szerepkörök, 2 Salonic-fiók státusz, szolgáltatásmap, szakembermap, beszámítás, adatmegőrzés, e-mail/SMS templating, marketing jogi szövegverzió, audit export.

### 3.3. Forrásból igazolt adatmodell — javasolt normalizált táblák

A táblák fizikai elnevezése adaptálható, de az adatszintű követelmények kötelezők. Futtatható migráció és egyértelmű FK/index/unique constraint készüljön.

| Tábla | Kötelező tartalom / fő invariáns |
|---|---|
| `staff_user`, `role`, `staff_role` | egyéni hitelesített kezelő, szakmai vezető, recepció, szalonvezető, marketing/admin; szerepkör és hozzáférés naplózott |
| `guest` | `guest_key` (belső UUID), név és ellenőrzött elérhetőségek, aktív státusz |
| `salonic_account`, `salonic_guest_identity` | mindkét fiók saját külső azonosítói és mappingje; nincs csak név szerinti merge |
| `identity_merge_request`, `merge_audit` | automatikus e-mail ÉS telefon ellenőrzés; bizonytalan eset érintett kezelő approval; eredeti ID-k megtartása |
| `service_catalog` | `first_hair`, `followup_hair`, `camera_assessment`, `legacy_combo_only`; meglevő Salonic szolgáltatásazonosítók, read-only kontroll |
| `booking`, `booking_event` | booking UUID; account, provider, service, idő, változás, státusz; event idempotency; megőrzött reschedule/cancel history |
| `treatment_session`, `course` | csak kezelő által igazolt `completed` növeli az adott kúra 1–11. kezelés sorszámát; kamera nem kúraalkalom |
| `package_purchase`, `package_redemption`, `package_adjustment` | 5/10, kötelező upfront fizetés, vásárlási és lejárati idő, csak folytatásokra; 1. kezelés nem fogyaszt bérletet |
| `package_gift` | 5-ös = 1 l sampon, 10-es = 1 l sampon + 1 l balzsam, 1. előtt/aznap plusz kis termék, kifizetéskor átadva; 2×5 = 2 sampon |
| `assessment`, `assessment_submission`, `contraindication_alert` | digitális question version, biztonsági flag, kezelő review, szükség esetén `clinical_stop` |
| `assessment_credit` | kifizetett 4 990 Ft, 30 napos first-booking window, manual validation, immutable `used_at`, `used_booking_uuid`, single-use constraint |
| `treatment_plan`, `treatment_note` | személyes A5 tartalom + review, kezelő, approval, időbélyeg, generált PDF-id, nyomtatási / e-mail státusz |
| `camera_image`, `image_comparison`, `share_grant` | alkalom 1/3/5/10; privát storage, összehasonlítás, 2–3 mondat; 30 napos bearer token hash, e-mail-ellenőrzött megújítás |
| `consent_event`, `unsubscribe` | e-mail/SMS marketing külön, önkéntes opt-in, withdrawal és adatkezelési/checkbox szöveg verziója, időpont |
| `survey_response`, `review_request` | első completed+3h survey, +24h Google-kérés pontszámtól független; kezelő attribúció |
| `complaint`, `complaint_contact_attempt`, `compensation_approval` | open/resolved, Janka alert, saját kezelő 24h, 2 call + e-mail, szalonvezetői kompenzáció-approval |
| `message_template`, `message_job`, `message_ledger`, `outbox_event` | trigger, channel, sablonverzió, consent, stop reason, event_id/idempotency_key, retry/skip log |
| `retention_purge_job`, `security_audit` | utolsó kezelés +36 hónap tervezett retention, törlési kérelmek és jogszabályi eltérések; hozzáférés- és exportnapló |

**Technikai követelmények:** kapcsolt képek ACL mellett privát objektumtárolóba; adatbázis referenciát tárol; tartalom biztonságos csatornán, HTTPS-en; titkosítás tárolás közben és továbbításkor; tulajdonos/kezelő admin eszközben export; backup/restore teszt és törlési kérések. Egészségi vonatkozású adat kezelésére alkalmas GDPR-konform szolgáltatási konstrukciót, adatfeldolgozói szerződéseket és szükség szerinti hatásvizsgálatot ellenőrizni kell, ez jogi QA-feladat, nem találgatás.

### 3.4. Kritikus állapotok és gépek

```text
booking.status: booked → rescheduled | cancelled | no_show | completed
  completed: csak jogosult kezelő igazolása után, Salonic-alapú, naplózva
  rescheduled: nem cancelled; eredeti T-72/T-24 job törölve, új dátumon újraütemezve
  no_show: csak hiteles státusz; nem completed, nem automatikus bérletlevonás

course: not_started → active → completed_11 | paused_clinical | closed_individual
  treatment_index++ csak verifikált, egyszeri completed esemény után
  camera_assessment ≠ treatment_session
  first_hair = index 1; followup_hair = index 2..11
  index 3/5/10 = comparison + therapist review
  index 11 = A5 closing summary, NINCS új kötelező kamerakép

package: paid_active → exhausted | expired | extended_by_manager | refunded
  5 ≡ 5 followup units, 10 ≡ 10 followup units
  expiry: 5-ös vásárlás+6 hó, 10-es vásárlás+12 hó
  expiry ELŐTT booked alkalom expiry UTÁN is teljesíthető
  expiry UTÁN egyszer reschedule, max eredeti slot+30 nap
  expiry UTÁNI teljes cancellation: az alkalom jogosultsága megszűnik
  late cancel/no_show: önmagában NINCS pénzügyi büntetés, ne keverd a lejárt bérlethez kapcsolódó 'teljes lemondással'

complaint: open → resolved (kezelő dokumentálja, vendég már nem elégedetlen)
  open = marketing/rebook STOP
  Janka értesül 1-3 score vagy negatív szöveg esetén; kezelő intéz 24h-on belül
  pénzügyi kompenzációhoz manager approval
  resolved után ne pótolj régi üzenetet; friss guest state alapján újraértékelj

document: missing → draft → therapist_final → generated_pdf → sent
  személyes doki küldése csak therapist_final + megfelelő képek + címzettellenőrzés
  +24h hiány: kezelő alert, +48h hiány: Janka alert
```

**Konkurencia és race:** `booking.completed` duplázódás elleni tranzakció/unique key; merge-elt vendég ugyanazon bookingja 2 fiókban sem duplikálható; seat/slot verseny mindig Salonic server-side check; email/SMS küldés csak transactional outbox claim atomikus állapottal.

### 3.5. Személyes képek és linkek — portál nélkül

- Kötelező hajkamerás felvétel **1., 3., 5., 10. alkalom**. A képek kezelői megfigyeléssel és 2–3 mondatos személyes értékeléssel együtt jelennek meg; automatizmus **nem értékel** fejbőrbetegséget és nem ír kitalált megfigyelést.
- A 3/5/10. alkalom után **automatikus e-mail** privát összehasonlító nézettel és biztonságos, 30 napig érvényes, véletlen tokenes URL-lel; 11. záráskor korábbi képek felhasználhatók. Az 1. alkalom képe a kiindulópont.
- Vendégportál/fiók/jelszó **nincs**. Lejárt link megnyitásakor `Kérek új linket` → a már regisztrált email ellenőrzése (egyszer használható email-verifikációs link/OTP), csak utána új 30 napos hozzáférés. Nem szivároghat ki, hogy létezik-e adott email a rendszerben.
- Az összes link token hash-el tárolódik, rövid életű regisztrációs ellenőrzéssel, rate limit, no-referrer, cache-control no-store, access log, vendégszintű ACL, megszakításkor revoke.
- Megőrzési cél utolsó kezelés +36 hónap, jogalap, törlés, pontos adatfajták/adatfeldolgozó ellenőrzésével. Marketing-felhasználás **külön kifejezett consent**.
- A képlink **NEM** mehet más vendégnek, merge és emailváltoztatás után permission újraellenőrzés kötelező.

### 3.6. Digitális kérdőív, kezelői dokumentáció, A5 PDF

- Booking T0 visszaigazolás tartalmazza a biztonságos állapotfelmérő linket; ha T-24 még nincs kész, a SMS emlékeztető tartalmazhat kitöltési hivatkozást; szükség esetén helyben kitölthető.
- A kérdőív az Oxygeni hivatalos szakmai protokolljára épül, MOSAIC kiegészítéssel. Ellenjavallat gyanú esetén a kezelő azonnali alertet kap, kezelés csak szakmai ellenőrzés után indul; szükség szerint halasztás és egészségügyi szakemberhez irányítás.
- Digitális kúratervmezők: név/azonosító, dátum/kezelő, fő panasz, kamerás megfigyelés, cél, **11 alkalmas teljes program** ajánlása vagy szakmailag eltérő egyéni terv, kéthetes alapütem, következő időpont, otthoni Oxygeni rutin (ajánlott, nem kötelező), kezelés-specifikus megjegyzések, fotókontroll, napló.
- Ugyanabból az egy kezelői űrlapból generálódjon **A5 méretű nyomtatható PDF és biztonságos e-mailes megosztás**, *nem* nyolcoldalas általános prospektus. Az első alkalomkor ezt a vendég a szalonban nyomtatva megkapja; digitális másolat a véglegesítés után küldhető.
- 11. alkalom végén ugyanezen motor külön záródokumentumot készít a kiinduló és a ténylegesen dokumentált változásokkal, 1/3/5/10 képekre hivatkozva, személyre szabott fenntartás/javaslat mezővel.
- Az összes kötelező dokumentációnak a kezelés után **24 órán belül** el kell készülnie; +24h kezelő alert, +48h Janka eszkaláció. Általános utóemail időben kiküldhető, de személyes PDF vagy kamera-komment nem küldhető hiányosan.
- PDF legyen `A5 148×210 mm`, nyomtatásra alkalmas és magyar ékezetekkel hibátlan, név/kezelés változókkal; valódi nyomtatóteszt. A vizuális A5 sablon külön ChatGPT assetcsomagból fog érkezni; addig működő, de cserélhető HTML→PDF sablon.

### 3.7. Bérlet, fizetés, ajándék és felmérés-credit üzleti motor

- A bérleteket csak **személyesen** lehet vásárolni, akár az első kezelés és az állapotfelmérés előtt; teljes összeget előre megfizetik. Az ajánlás a kezelőé, a fizetés, nyilvántartás és ajándékátadás a recepcióé.
- `package_5`: 130 000 Ft / 5 **további** alkalom, ajándék 1 l sampon, 6 hónap; `package_10`: 260 000 Ft / 10 **további** alkalom, ajándék 1 l sampon + 1 l balzsam, 12 hónap.
- Első kezelés **előtt VAGY annak napján** történő vásárláskor mindkettőhöz extra, kis kiszerelésű készletfüggő Oxygeni termék; ne ígérj konkrét készletazonosítót vagy hamis piaci értéket. Ajándékok átadása a teljes vételár kifizetésekor azonnal.
- Két külön 5-ös vásárlás = kétszer 130 000 Ft és kétszer 1 l sampon, külön upgrade/átváltás nincs.
- Bérlet nem átruházható, főszabály szerint nem váltható vissza; manager egyedi hosszabbítást engedélyezhet, szakmai okú megszakítás refundját manager egyedileg bírálja el. Ha a kúra egyáltalán nem kezdhető meg ellenjavallat miatt és 0 bérletalkalom használt: teljes refund, bontatlan ajándék visszakérve, felbontott ajándékot nem vonják le. Ezek az üzleti szabályok a kötelező fogyasztóvédelmi jogokat nem korlátozzák.
- 4 990 Ft felmérés: 30 perces külön szolgáltatás, helyben fizetendő. Az első 29 900 Ft-os kezelésbe az összeg **egyszer, manuálisan** levonható, ha a felmérést követő 30 napon belül FIRST treatment booking keletkezik. Áthelyezés jogosultságot megtart, teljes cancellation megszünteti. CRM csak **figyelmeztet/jogosultságot ellenőriz**, helyszíni kezelő/recepció jelöli a tényleges levonást (`used_at`, `booking_uuid`, `staff_id`). Azonos credit kétszer soha.
- Bérlet lejárat előtt -30 nap e-mail, -7 nap SMS, csak ha **ténylegesen szabadon foglalható** használható alkalom maradt. Lejárat előtt booked → utána teljesíthető. Lejárat után csak 1 áthelyezés, max eredeti appointment +30 nap; teljes cancellation esetén az adott lejárt alkalom elveszik.
- Egyedi kezelések és felmérés nem online fizetendő: 29 900 első, 26 000 további, 4 990 kamera helyben. **A rendszer nem támaszkodhat fizetésre az attendance bizonyításához.**

### 3.8. Automatikus e-mail/SMS — egyetlen időzítési szabálytábla

**Három csoport:** `transactional`, `care/personal_document`, `marketing`. A tartalom valós felhasználása és a vonatkozó jogszabály szerint kell besorolni; a marketing jellegű ajánlat/CTA kizárólag megfelelő csatorna-consent mellett küldhető. A pontos vendégszövegeket a forráshű mesteranyag `06 / KÜLDÉSI KATALÓGUS` fejezetéből használd.

| Azonosító | Trigger és időzítés | Csatorna | Kötelező gate / stop |
|---|---|---|---|
| `T0-F` | első kezelési booking valóban confirmed; azonnal | e-mail | booking active + helyes first_service, 80 perc, 29 900, link kérdőív |
| `T0-C` | 4 990 Ft-os önálló camera booked; azonnal | e-mail | 30 perc, 4 990; nincs first treatment állítás |
| `T-72` | aktuális booked előtt 72h | e-mail | latest booking date/service, cancel/reschedule STOP |
| `T-24` | aktuális booked előtt 24h | SMS | latest booking, még hiányzó kérdőív link; eredeti 48h lemondási ablakot ne ígérd újra |
| `S0` | **első** verified completed +3h | e-mail | belső 1–5 survey, kezelő attribution, 1–3 / negatív szöveg Janka alert |
| `G0` | első verified completed +24h | e-mail | Google értékeléskérés minden első vendégnek **pontszámtól függetlenül**, nincs review gating; jogalap ellenőrizve |
| `P0` | első completed + dokumentáció final | e-mail + A5 PDF | csak teljes helyes kezelői űrlap és címzett; 24h céldátum |
| `R1` | MINDEN verified completed +48h, ha nincs next booked | e-mail | marketing e-mail opt-in; complaint/clinical_stop/course_closed/booking STOP |
| `R2` | completed +5 nap, ha továbbra sincs next | SMS | marketing SMS opt-in, ugyanazok a stopok |
| `A1` | külön completed camera assessment +48h, ha nincs first booking | e-mail | marketing opt-in, 30d credit window helyes, személyes értékelés |
| `A2` | külön camera assessment +5 nap, ha nincs first booking | SMS | marketing SMS opt-in, nincs booking |
| `C0` | confirmed cancelled azonnal | e-mail | helyes régi booking, marketingtől független tranzakciós |
| `C1` | cancelled +24h, nincs új booking | e-mail | marketing opt-in, nincs panasz |
| `C2` | cancelled +3 nap, nincs új booking | SMS | marketing SMS opt-in, nincs új booking |
| `N0` | true no_show utáni napon | SMS | marketing SMS opt-in, nincs új booking; nincs büntetés |
| `E2` | 1. completed +3 nap | e-mail | szakmai rutin személyre szabva; ha termékvásárlásra ösztönző, marketing consent |
| `E3` | 1. completed +7 nap | e-mail | reális eredményvárakozás; booking CTA csak megfelelő opt-in/no_booking mellett |
| `E5` | **2.** completed után | e-mail | nincs új kamera és nincs camera-link, lehet biztonságos általános update |
| `E6` | **3.** completed + fotó & értékelés kész | e-mail | 1. vs 3. kép, személyes 2–3 mondat, 30 napos link |
| `E7` | **5.** completed + fotó & értékelés kész | e-mail | 1/3/5 kép, köztes értékelés, nem teljes kúra |
| `E8` | terv szerinti kontroll elmúlt, nincs next booking | e-mail | marketing opt-in, ne duplikáld R1/R2-t ugyanazon a napon |
| `E9` | E8 után +7 nap, még nincs booking | e-mail | marketing opt-in; egyszeri utolsó finom emlékeztetés |
| `E10` | **11.** verified completed + záródoki kész | e-mail + A5 | 1/3/5/10 képek, fenntartási ajánlás egyénileg; kúra lezárása |
| `B30` | bérlet lejárta előtt 30 nap | e-mail | marad nem lefoglalt alkalom, opt-in/jogalap vizsgálat |
| `B7` | bérlet lejárta előtt 7 nap | SMS | marad nem lefoglalt alkalom, opt-in/jogalap vizsgálat |
| `DOC24` | completed +24h, de kötelező doki hiányzik | belső notification | saját kezelőnek figyelmeztetés |
| `DOC48` | completed +48h, doki hiányzik | belső notification | Jankának szakmai vezetői figyelmeztetés |
| `NEG` | 1–3 pont vagy negatív szöveges survey | belső notification | Janka értesül; a **saját kezelő** a panaszkezelés felelőse |
| `COMPLAINT` | panasz létrejön | belső task | kezelő 24h kontakt, kétszeri telefonpróba + e-mail, minden sales/rebook STOP |

**Minden job a küldés pillanatában újból olvassa a vendég aktuális állapotát**, ne csak enqueue-kor: `guest_key`, `booking_status`, `service_type`, `course_status`, `package_owned`, `next_active_booking`, `complaint_open`, `clinical_stop`, `consent_email`, `consent_sms`, `email_unsubscribe`, `sms_optout`, `content_ready`, `recipient_verified`. Nincs duplikáció több trigger/Salonic account/cron futás között. Eseményazonosító: `guest_key + template_key + context_id + template_version`, nem a név.

**Nincs állapotgép „vakon küldött” e-mailre.** Címzett/egyéni mező hiányánál `BLOCKED_MISSING_DATA`, harmadik fél belső QA adatai esetén `SANDBOX_ONLY`, jogosulatlan kérésnél `SKIPPED_CONSENT_OR_STATE`. Tranzakciós és marketing üzenet külön trigger/jogalap, külön stop.

### 3.9. Panasz, elégedettség, szakmai STOP

- Minden **első completed +3h** után rövid 1–5 pontos belső kérdőív, opcionális szöveg, kezelőnkénti riport; +24h **Google-értékeléskérés minden vendégnek**, nem csak elégedetteknek, nem ajándékkal/kedvezménnyel.
- 1–3 pont VAGY negatív komment → Janka kap értesítést. **Nem Janka intézi a panaszt**: az adott vendég kezelője 24h-n belül, lehetőleg telefonon; összesen két híváskísérlet, majd személyes e-mail, minden érintkezés naplózott.
- Kompenzáció (pénzvissza, ingyen pótló, kedvezmény) csak szalonvezetői jóváhagyással, külön approval loggal.
- Panasz akkor resolved, ha kezelő dokumentálja a megoldást és a vendég már nem elégedetlen; egyébként open. Nyitott panasz alatt minden sales/rebooking marketing STOP; szükséges booking/tranzakciós tájékoztatás és minden vendégnek pártatlan Google request a jogalap szerint marad. Resolved után **nem küldjük visszamenőleg** a kimaradtakat, csak aktuálisan relevánsat.
- Kontraindikáció vagy szokatlan reakció esetén a szakmai biztonsági szabályok élveznek elsőbbséget; kötelező kezelői felülvizsgálat; nem kerülhet erőltetett bérletajánlat a vendég elé.

### 3.10. Szerepkörök és adatvédelem

- Minden jogosult Oxygeni-kezelő minden Oxygeni-vendég szükséges kezelési dokumentációját láthatja, mert kezelőváltás engedélyezett; **egyéni belépés és naplózás** kötelező. A recepció az adminisztrációhoz, bérlethez, időponthoz, ajándékhoz és credithez szükséges minimális kereskedelmi adatot lássa; egészségi képekhez csak igazolt feladat esetén férhet hozzá.
- Szalonvezető pénzügyi jóváhagyás; Janka szakmai vezetői értesítések; marketinges aggregált statisztikák, nem nyers egészségi adatok.
- Admin endpoint RBAC **backend-en is**, IDOR, CSRF, XSS, SQL injection, file MIME/type/content validation, path traversal, rate limiting, session timeout, audit tampering tesztekkel.
- Magyar nyelvű adatkezelési tájékoztatóhoz belső mezőtérkép és jogalap review; egészségi vonatkozású különleges adatok miatt megfelelő GDPR feltételek, feldolgozó szerződések, retention +36 hó **cél** és jogi QA. Nem kérhetsz általános marketing-hozzájárulást kötelező felmérőfeltételként.
- Visszavonható marketing e-mail és SMS külön checkbox/consent; marketinges képfelhasználás külön és kifejezett; consent szövegverzió, timestamp, visszavonás. Gyártói kezelési „95%” pontos forrását claims QA-n igazolni kell.

### 3.11. Mérőszámok — definíció, nem mutatószám

**Elsődleges business metric:** minőségi első foglalás → ténylegesen megjelent első vendég → 2., 5., 10., 11. ténylegesen teljesített alkalom; bérletvásárlás, nettó bevétel és egyéni fenntartás. Az 5-ös csomag nem teljes kúra.

- `BOOK_FIRST`: a Salonicban valóban véglegesített első `first_hair` bookingok, service/source duplikációmentesen.
- `SHOW1`: első **verified completed**, nem booked, nem no-show, nem automata naptáridő-vége.
- `SHOW_RATE`: SHOW1 / első, időablakban esedékes booking cohort; az elmozdított/cancelled kezelések denominátora auditált.
- `R2`, `R5`, `R10`, `R11`: az adott alkalmat valóban teljesítők aránya egy megfelelően kiérlelt SHOW1 kohorszban; az időbeli késleltetést és kéthetes ritmust figyelembe kell venni, nem korai számlálás.
- `NEXT_BOOKED_ON_SITE`: a kezelő által a kezelés végén ténylegesen rögzített, élő Salonic ID-val rendelkező következő foglalás.
- `PACKAGE_RATE_10`, `PACKAGE_RATE_5`: igazolt, helyszínen rögzített bérletvásárlók / ténylegesen kezelt jogosult kohorsz; világosan különítsd el előre vásárlást.
- `ASSESS_TO_FIRST`: külön 4 990 Ft-os felmérésen megjelent + 30 napig foglalt első kezelés; későbbi show külön.
- `CREDIT_REDEEM`: manuell validation és egyszeri levonás, nem a jogosultság létezése.
- `CONSENT_EMAIL`, `CONSENT_SMS`, `MESSAGE_DELIVERY`, `COMPLAINT_RESOLUTION_24H`, `DOC_COMPLETION_24H`, `SALONIC_SYNC_LATENCY`, `MERGE_REVIEW_PENDING`.
- Mérés GA4/Ads/Meta/TikTok szerinti attribúcióval **csak hozzáférhető és bizonyítható** forrásadatokból; webshop-funnel vagy kattintás nem helyettesíti a megjelent és visszatérő vendéget.

## 4. ASSET CONTRACT — a képeket külön gyártjuk

A vizuális képek és a végleges nyomdai grafikai sablon **külön ChatGPT munkacsomagból** érkeznek. Claude **ne kezdjen másik, egymással versengő AI-képkészítést**, és ne rajzoljon kamu fejbőr-előtte/utána eredményeket. A frontend készüljön úgy, hogy asset ID-konfigurációból később cserélhetőek legyenek a képek.

Javasolt stabil manifest-azonosítók: `hero_real_treatment`, `video_real_30s`, `problem_hair_loss`, `problem_oily`, `problem_dandruff`, `problem_thin_hair`, `camera_device_real`, `treatment_step_1`, `treatment_step_2`, `treatment_step_3`, `treatment_step_4`, `therapist_photo_[id]`, `salon_interior_real`, `course_timeline_1_3_5_10_11`, `gift_shampoo_1l_real`, `gift_conditioner_1l_real`, `a5_plan_template`, `a5_closing_template`. Ezek **munkabeli asset ID-k, nem már létező kész fájlok**.

Minden placeholderre legyen képarány (`hero_desktop_16x9`, `hero_mobile_4x5`, `card_1x1`, `portrait_3x4`), alt-követelmény, valódi/illusztratív flag, nyomdai font/asset licenc ellenőrzés. Ha generált, illusztratív fejbőrkép kerül valamelyik blokkon, egyértelműen **illusztráció** legyen, és soha ne valós vendégeredményként kommunikáljuk.

## 5. KÖTELEZŐ QA — teszt előbb, GO utána

**Kötelező minimum 45, automatikusan is ellenőrzendő eset** (a mesteranyag 36 eredeti QA-esetét is be kell építeni):

| ID | Teszt | PASS-kritérium |
|---|---|---|
| B01 | Hero First CTA | a landing booking-blokkhoz görget; `first_hair` prefill, 29 900/80 perc |
| B02 | Hero Camera CTA | a landing booking-blokkhoz görget; `camera_assessment` prefill, 4 990/30 perc |
| B03 | Négy lépés megtartása | létező 4-step folyamat, 4. live calendar; belső lépések auditáltak |
| B04 | Minden kezelő | `any` az alapbeállítás, összes valóban szabad idősáv látszik |
| B05 | Konkrét kezelő | szűrés működik, visszatérő kezelő ajánlott, de nem kényszerített |
| B06 | Slot race | párhuzamos foglalásból nem lesz dupla Salonic-booking |
| B07 | Double submit | dupla kattintásból egy confirmed és egy notification |
| B08 | T0 confirmed gating | Salonic booking ID hiányában nincs siker UI vagy konverzió |
| B09 | Cancel vs reschedule | új időpontra új T-72/T-24; töröltnél nincs emlékeztető |
| B10 | Consent off | booking működik, de 0 marketing email/SMS |
| B11 | Two account identity | e-mail ÉS telefon ellenőrzött => safe link; nincs képtévesztés |
| B12 | Ambiguous merge | csak kezelő által naplózott approval után merge |
| C01 | First completed | kezelő megerősíti; treatment_index=1, kúranyitás egyszer |
| C02 | Camera completed | nem növeli a treatment_indexet |
| C03 | No-show/cancel | nem completed, nem kúraalkalom, nem bérletlevonás |
| C04 | 1/3/5/10 images | csak ezeken kötelező kamera |
| C05 | 2. treatment | NINCS kötelező új kamerakép és camera e-mail |
| C06 | 11. treatment | záró A5, 1/3/5/10 képek, új képet nem követel |
| C07 | Missing note | általános email mehet, személyes A5/kép NEM |
| C08 | 24/48 docs | kezelő alert +24h, Janka +48h, nincs hiányos küldés |
| C09 | Contraindication | kezelő értesítés, szakmai felülvizsgálat, no unsafe session |
| C10 | Image cross-tenant | A vendég tokenjével B vendég képére 403/404, logolás |
| C11 | Link expiration | +30 nap után nincs hozzáférés, új link e-mail verify |
| C12 | No portal | nincs vendégfiók/regisztráció-kényszer |
| P01 | 5 package | pontosan 5 followup, 130 000 Ft, 1l sampon, 6 hó |
| P02 | 10 package | pontosan 10 followup, 260 000 Ft, 1l sampon+1l balzsam, 12 hó |
| P03 | First excluded from pass | 1. kezelés nem használ fel bérletalkalmat |
| P04 | Two packages five | 2×5 = 10 extra, két sampon, nincs upgrade kedvezmény |
| P05 | Early extra gift | az első előtti vagy annak napján bérlet → kis ajándék |
| P06 | Manual credit | 4 990 Ft egyetlen staff jóváírás, audit és booking UUID |
| P07 | Credit 30d booking | határidőn belül booking elég, service lehet később |
| P08 | Reschedule credit | credit marad, teljes cancel -> megszűnik |
| P09 | Pass expiry reserved | expiry előtti booking teljesíthető expiry után |
| P10 | Pass expiry reschedule | max 1 × és eredeti slot +30 nap |
| P11 | Pass expiry cancelled | expiry után teljes cancellation jogosultság vége |
| P12 | No penalty | late cancel/no-show miatt nincs automatikus díj/levonás |
| P13 | Medical contraindication refund | 0 session + végleges tiltás = teljes refund; bontatlan gift return |
| M01 | T-72/T-24 | csak aktuális booked státusz, jó időpont, 0 duplikát |
| M02 | R1/R2 | +48h email, +5d SMS, csak marketing consent + no next booking |
| M03 | Assessment A1/A2 | +48h/+5d, camera-vendég, nem E-sorozat |
| M04 | Cancel C1/C2 | +24h/+3d, csak cancelled, van booking => STOP |
| M05 | No-show N0 | következő nap, csak igazi no_show és opt-in |
| M06 | Survey + Google | +3h survey, +24h Google, bármely pontnál azonos review access |
| M07 | Complaint stop | open panaszra marketing/rebooking 0, tranzakciós marad |
| M08 | Complaint resume | resolved után elavult jobs 0, friss state szerint újraindul |
| M09 | Review by staff | 1-3/negatív => Janka alert; saját kezelő intéz, 24h, 2 call+email |
| M10 | Pass expiry mail/SMS | csak ténylegesen még szabad, felhasználható alkalomra |
| S01 | Unauthorized staff | recepció érzékeny kép letöltés blocked, audit |
| S02 | Consent withdrawn | azonnal nincs új marketing, opt-out log |
| S03 | Security controls | HTTPS, ACL, private storage, token hashed/rate-limited |
| A01 | CMS/SEO/DSA | ugyanaz az URL, canonical, baseline, DSA konverzió audit |
| A02 | GA4/Ads/Meta/TikTok | test shadow-mode; 0 éles teszt pixel, 0 dupla, pontos valós event |
| A03 | Mobile/browser | 390×844, tablet, 1440, billentyűzet, video felirat, WCAG alap |
| A04 | Release gate | fejlesztő teljes QA PASS, csak utána tulajdonosi GO |
| A05 | Post-release 72h | fejlesztő tech, marketing bookings/measurement, incident notify |
| A06 | No legacy rollback | nincs régire visszaállítás vagy új alternatív foglaló kitalálása |

Minden QA-hoz legalább **Given/When/Then**, fixture, adatforrás, log állapot és várható side effect. A tesztelési e-mail/SMS/payments helyettesítendők dry-run adapterrel; valós vendégnek 0 próbaküldés. Belső mock-teszt nem igazolja az éles Salonic-integrációt: az utóbbi külön, jogosított E2E tesztet igényel.

## 6. Fázisok és átvételi checkpointok

**Fázis 0 – Audit és architektúra:** valós site/Salonic/API/ESP/SMS hozzáférési tények; hiányok; meglevő 4-step foglalás; biztonsági terv; érzékeny adat mapping; adatmodell. `READY_FOR_IMPLEMENTATION` vagy pontos blocker lista.

**Fázis 1 – Weboldal:** design tokens, valódi copy, 6 pár wireframe alapján minden reszponzív szekció, 2 CTA, saját booking shell, szolgáltatásmap, sandbox végleges booking response; UX E2E.

**Fázis 2 – CRM mag:** auth/RBAC, 2 fiók adapter, guest merge, kérdőív és kontraindikáció, treating therapist completed, bérlet/credit, privát képek/dokik, audit; sandbox fixture és tesztek.

**Fázis 3 – Automatizáció:** teljes `T/C/N/R/A/E/B/S/G/P` üzenetmotor idempotens háttérqueue-val, hozzájárulásokkal, STOP-ágakkal, előnézettel, dry-run és napi küldési audit.

**Fázis 4 – Komplett integráció és QA:** első valódi foglalás→completed→A5→következő foglalás→bérlet→kontroll→zárás E2E; marketing/paid/SEO kontroll, sebezhetőség- és jogosultságtesztek.

**Fázis 5 – GO/élesítés:** **egy lépésben ugyanazon URL-en**, teljes QA PASS után a tulajdonos engedélyezi. Nincs regresszió miatt automatikus régi landing rollback. Utána 72h fejlesztői + marketing felügyelet, kritikus hibánál azonnali értesítés és javítás.

### 6.1. Első végrehajtási válasz Claude-tól

Az első körben ne felhős ígéreteket vagy 1000 sor véletlen kódot gyárts: készíts `repo/infra audit`, 20–30 konkrét függőségi ellenőrzés, UI screen map, entitáskapcsolati modell, állapotdiagramok, implementációs tasklista és rögtön az **első futtatható landing prototípus**. Ezután **folyamatosan építsd tovább** a mini CRM-et. Kérdés csak akkor szükséges, ha egy külső rendszer hitelesítését vagy tulajdonosi GO-t tényleg igényel; a már jóváhagyott üzleti döntéseket ne kérdezd újra.

### 6.2. Forrásfüggő tények, amiket NEM szabad kitalálni

- Salonic valós API endpointok, authentication, webhook/polling, rate limits, két account tényleges mappingje.
- MOSAIC site technikai stack, tényleges CSS tokenek és font/licenc, már meglevő négy booking step részletes belső logikája.
- Email/SMS provider, domain/SPF/DKIM/DMARC, link-megosztás gateway és GDPR feldolgozói garanciák.
- Google review-k URL-je, tényleges vendégértékelések, Bécsi út 2. publikus telefon valós aktuális adata (a mesteranyagban szerepel, de élesítéskor visszaellenőrzendő).
- Gyártói 2 millió és 95% pontos mérőszámdefiníciója, forráslinkje; kezelői szakmai kontraindikáció lista, személyes kép marketinghozzájárulások.
- SEO/DSA hirdetési forgalom, valós baseline, kampányparaméterek, visszafoglalási mutatók.

**Ha nincs bizonyíték:** `REQUIRES_VERIFICATION` a fejlesztői checklistben; az UI-ban ne tegyél hamis tényállítást. Ezek nem új üzleti eldöntendő kérdések.

---

# 121 JÓVÁHAGYOTT TULAJDONOSI DÖNTÉS — VÁLTOZTATHATATLAN ÜZLETI SZABÁLYOK

> A döntésnapló számozása és tartalma a véglegesített 46 oldalas forrásból származik. A 19. döntés 5–10-es korai logikáját későbbi 26–27 felülírja; a 91. panaszfelelősét a 92–93. pontosítja.

001. Az első hajoxigénterápiás kezelés állapotfelméréssel együtt 80 perc.
002. Az első kezelés 29 900 Ft; a másodiktól az egyedi kezelés 26 000 Ft.
003. Az 5/10 alkalmas bérlet az első kezelésen FELÜLI 5/10 kezelésre szól.
004. Első napi bérletvásárláskor külön extra termékajándék jár.
005. Mindkét bérletnél a plusz ajándék egy kis kiszerelésű Oxygeni termék; konkrét SKU nem kötött.
006. A 4 990 Ft-os hajkamerás felmérés teljes díja beszámít az első kezelésbe.
007. A MOSAIC hivatalos Oxygeni partnerszalon.
008. Minden oxigénterápiás kezelő elvégezte az Oxygeni szakmai képzését.
009. A kezelés ELŐTT 24 órával nem javasolt hajat mosni; vendégutasításként szerepel.
010. A kezelés UTÁN nincs általános hajmosási korlátozás.
011. Hajfestés/szőkítés esetén a kezelő egyéni útmutatása az irányadó.
012. Készül hajkamerás kép, de jelenleg nincs egységes tárolás; ez változik.
013. Egységes, vendégenként visszakereshető képtárolás lesz, csak kijelölt kontrollokon.
014. Kontroll után automatikus biztonságos linkkel jut el az összehasonlítás a vendéghez.
015. Hajkamerás fotó az 1., 3., 5. és 10. kezelésen készül.
016. A képek mellé 2–3 mondatos személyes kezelői értékelés jár.
017. Az értékelést a kezelő írja, a rendszer kész dokumentáció után automatikusan kiküldi.
018. A kezelési ritmus alapértelmezetten kéthetente egyszer, egyéni eltérés lehetséges.
019. Korai ajánlás 5–10 alkalom; a későbbi 26–27. döntés felülírja: teljes kúra 11.
020. Az első alkalom végén kötelező felajánlani a második időpont lefoglalását.
021. A kezelő ajánlja fel és a Salonicban maga foglalja a következő időpontot.
022. Ha nincs következő foglalás: +48 óra e-mail, +5 nap SMS; foglaláskor STOP.
023. A személyes kúraterv nyomtatott A5-ben és e-mailben is jár.
024. A kezelő egyszer digitális űrlapot tölt ki; ebből A5 PDF és e-mail készül.
025. A kúraterv részletes: panasz, képmegfigyelés, cél, alkalmak, ritmus, következő időpont, otthoni rutin, ajánlás, kezelő.
026. Mindig a 10 alkalmas bérlet az elsődleges ajánlat; az 5-ös tesztelési/belépő opció.
027. A teljes kúra: az első kezelés és a 10 alkalmas bérlet, összesen 11 kezelés.
028. Nincs külön bérletbővítési konstrukció: két 5-ös bérlet ára ugyanannyi, mint egy 10-esé.
029. Két külön 5-ös bérlet esetén mindkettőhöz 1-1 liter sampon jár.
030. Időpont a kezelés előtt legkésőbb 48 órával mondható le/módosítható.
031. Késő lemondás/no-show esetén nincs pénzügyi szankció, nincs bérletlevonás.
032. Aktív foglalásra 72 órával e-mail és 24 órával SMS emlékeztető jár.
033. Igazolt no-show esetén másnap kedves SMS megy, ha nincs új foglalás.
034. Lemondás után +24 óra e-mail, +3 nap SMS, ha nincs új foglalás.
035. Minden kezelés végén a kezelő felajánlja és lehetőleg lefoglalja a következőt.
036. Teljes kúra után a fenntartást a kezelő egyedileg határozza meg.
037. 11. kezelésnél részletes kúrazáró összehasonlítás, értékelés, fenntartási terv A5 PDF-ben és e-mailben.
038. A 2 millió kezelés/95%-os hatásosság hivatalos gyártói forrásból származik; csak pontosan attribuálva használható.
039. Egyes vendégek 1–2 alkalom után érezhetnek változást; érdemi értékelés 5–6 körül; teljes kúra 11.
040. Személyre szabott otthoni Oxygeni ápolást erősen ajánljuk, de nem kötelező.
041. Az otthoni Oxygeni termékek kizárólag személyesen, a szalonban vásárolhatók.
042. Első kezeléskor termékajánlás; felülvizsgálat a 3., 5. és 10. alkalmon.
043. Nem készül külön 8 oldalas A5 füzet; a személyes A5 kúraterv elegendő.
044. 5-ös bérlet 6 hónapig, 10-es bérlet 12 hónapig érvényes vásárlástól.
045. Indokolt esetben a szalonvezető egyedileg hosszabbíthat; nem automatikus.
046. A bérlet személyhez kötött, nem átruházható.
047. A bérlet főszabály szerint nem váltható vissza, törvényes jogok fenntartásával.
048. Szakmai okból megszakított kúra visszatérítését szalonvezető egyedileg bírálja el.
049. Minden új vendég digitális állapotfelmérőt tölt ki; kezelő ellenőrzi, később változásokra rákérdez.
050. Kérdőív a foglalással azonnal; hiánynál T-24 emlékeztető; szükség esetén helyben kitölthető.
051. Az állapotfelmérő az Oxygeni szakmai protokolljára épülő, MOSAIC-ra szabott digitális kérdőív.
052. Ellenjavallati jelzésről a kezelő automatikus értesítést kap és előzetesen egyeztethet.
053. Salonic-foglalásokkal összekapcsolt, külön biztonságos közös vendégnyilvántartás lesz.
054. Minden jogosult oxigénterápiás kezelő hozzáférhet minden Oxygeni vendég kezelési dokumentációjához.
055. Hajkamerás képek marketingfelhasználása csak külön, kifejezett hozzájárulással.
056. Célzott adatmegőrzés: utolsó kezelés +36 hónap, a jogi megőrzési szabályokkal összhangban.
057. Nem épül vendégportál a hajkamerás képekhez.
058. A vendég képlinkje 30 napig él; ezután új link kérhető.
059. Új 30 napos link automatán kérhető az e-mail-cím biztonságos ellenőrzésével.
060. Utókezelési automatizmus csak valóban megtörtént, Salonicban igazolt kezelés alapján indul.
061. A kezelő minden kezelés végén igazolja a teljesítést.
062. A két Salonic-fiók egyetlen közös vendégelőzményhez és kommunikációs folyamathoz kapcsolódik.
063. Ellenőrzött e-mail ÉS telefonszám egyezésnél auto-összevonás; bizonytalan eset kézi jóváhagyás.
064. Bizonytalan vendégprofil-egyezést az érintett kezelő ellenőrzi és hagyja jóvá, naplózva.
065. Általános üzenet időben kimehet; személyes kúraterv/kép csak teljes dokumentációval; kezelő figyelmeztetése.
066. Kötelező dokumentáció legfeljebb 24 órán belül elkészül.
067. Hiányzó dokumentációnál +24h kezelői figyelmeztetés, +48h szakmai vezető értesítés.
068. Csak 4 990 Ft-os kamera-vendégnek külön értékelés, +48h e-mail és +5d SMS, ha nincs első kezelés.
069. A 4 990 Ft díjbeszámítási jogosultság 30 napig szerezhető meg.
070. Elég 30 napon belül FOGLALNI az első kezelést, annak időpontja később lehet.
071. Az első kezelés időpont-áthelyezésekor beszámítás marad; teljes lemondásnál megszűnik.
072. A 4 990 Ft beszámítása manuális recepciós/kezelői ellenőrzéssel és levonással történik.
073. A felhasználást közös vendégnyilvántartásban, dátummal és foglalásazonosítóval rögzítik.
074. 5-ös/10-es bérlet teljes árát egy összegben előre kell fizetni.
075. Ajándékok a teljes bérletár kifizetésekor azonnal átadandók.
076. Bérlet kizárólag személyesen a MOSAIC szalonban vásárolható.
077. A weboldalon teljes kúra, mindkét bérlet és áruk szerepel; első CTA a 29 900 Ft-os kezelés.
078. Hero másodlagos CTA a 4 990 Ft-os hajkamerás felmérésre már első képernyőn.
079. A foglalás a landing oldalon, előtöltött szolgáltatással, saját négylépéses útvonalon élő Salonic-naptárral történik.
080. Hero CTA oldalon belüli foglalóblokkhoz görget, nincs popup/külön oldal.
081. Alapértelmezetten minden kezelő időpontja látható; konkrét kezelőre lehet szűrni.
082. Visszatérő vendégnél alapból korábbi kezelő ajánlott; szabad kezelőváltás lehetséges.
083. A kombinált arc+haj kezelés nem szerepel az új Oxygeni hajlandingen.
084. A kombinált arc+haj kezelés értékesítése teljesen megszűnik.
085. A kombinált kezelés új foglalásainak fogadása azonnal leállítandó.
086. A már visszaigazolt kombinált foglalásokat eredeti feltételekkel teljesítjük.
087. Az első igazoltan teljesített kezelés +24h Google-értékeléskérés, minden vendégnek.
088. Belső 1–5 pontos elégedettségmérés, opcionális komment, kezelőnkénti riport.
089. Belső elégedettség e-mail +3h; Google-kérés külön +24h az első kezelés után.
090. 1–3 pont vagy negatív szöveg esetén Janka értesítést kap.
091. Panaszos vendég megkeresése 24 órán belül; a későbbi 92–93. döntés alapján az érintett kezelő végzi.
092. Nem Janka, hanem az adott kezelő felel a panaszkezelésért.
093. Pénzügyi kompenzációhoz mindig szalonvezetői jóváhagyás kell.
094. Két telefonhívás, majd személyes e-mail; minden próbálkozás dokumentált.
095. Nyitott panasz alatt értékesítési és visszafoglalási üzenetek STOP; tranzakciós időpontinfó marad.
096. A kezelő dokumentálja a megoldást; fennálló elégedetlenségnél a panasz nyitva marad.
097. Panasz lezárása után csak aktuális, releváns üzenetek mennek; kimaradtak nem pótlandók.
098. Bérletvásárlást munkatárs rögzíti; Salonic-CRM kapcsolat automatikusan követi a megtörtént és fennmaradó alkalmakat.
099. Bérlet lejárata előtt T-30 nap e-mail és T-7 nap SMS, ha maradt alkalom.
100. A bérlet lejárata előtt elég időpontot foglalni; a kezelés a lejárat után is lehet.
101. Lejárat utáni áthelyezésnél a foglalt alkalom marad, teljes lemondásnál elvész.
102. Lejárt bérlethez kapcsolódó foglalás legfeljebb egyszer módosítható.
103. Az egyszeri lejárat utáni módosítás az eredeti időponthoz képest legfeljebb +30 nap.
104. Külön hajkamerás állapotfelmérés 30 perc.
105. A 4 990 Ft-os felmérést a szalonban, helyben fizetik.
106. A 29 900 Ft-os első kezelést a szalonban, a kezelés után fizetik.
107. A 26 000 Ft-os további egyedi alkalmakat a kezelés után helyben fizetik.
108. A kezelő ajánlja a bérletet; a recepció intézi fizetést, nyilvántartást és ajándékátadást.
109. 10 alkalmas bérlet ajándéka 1 liter Oxygeni sampon és 1 liter balzsam.
110. Bérlet az első kezelés és a hajkamerás állapotfelmérés előtt is vásárolható személyesen.
111. Ha semmilyen kezelés nem történt és ellenjavallat miatt a kúra nem kezdhető meg, teljes bérletár visszajár.
112. Teljes refund esetén bontatlan ajándékot visszakérünk; felbontott ajándék értékével a refundot nem csökkentjük.
113. Extra kis kiszerelésű ajándék jár az első kezelés előtt VAGY az első kezelés napján bérletet vásárlóknak.
114. A már megtervezett MOSAIC négylépéses foglalási rendszert használjuk Oxygenire szabva; nem tervezünk új lépéseket.
115. A teljes új landing egyetlen élesítéssel kerül a jelenlegi URL-re.
116. Élesítés előtt teljes QA: desktop/mobil, valós Salonic-foglalás, GA4/Google Ads/Meta/TikTok, SEO/DSA.
117. Fejlesztő igazolja a QA-t; tulajdonos adja meg az élesítési engedélyt.
118. Első 72 órában fejlesztő technikai, marketing foglalási/mérési felügyelet; azonnali incidensjelzés.
119. A régi landinget nem állítjuk vissza, hibánál az új verziót javítjuk.
120. A foglalónak működőképesen kell élesednie; nem tervezünk külön vészhelyzeti foglalási útvonalat.
121. Foglaláskor külön, opcionális marketinghozzájárulás a visszafoglaló/bérletajánló üzenetekhez.

---

# FORRÁSHŰ MESTERANYAG – A TELJES VÉGLEGES 46 OLDALAS PDF TARTALMA

> A következő rész az eredeti jóváhagyott, 2026-10-09 dátumú HTML/PDF mesteranyag szöveges átírása, táblázatokkal, landingszövegekkel, sablonokkal, wireframe-követelményekkel és QA-val. **Hivatkozási forrás és tartalom, nem második külön fejlesztési brief.** Ha különbség lenne, a 121 döntés és e fájl előző műszaki specifikációja vezérel.

MOSAIC HEADSPA × OXYGENI

PLAN-D · EGYSÉGESÍTETT, JÓVÁHAGYOTT VÉGLEGES MESTERANYAG

# A jó első foglalástól a teljes, 11 kezeléses kúráig

Landing · négylépéses foglalás · személyes A5 kúraterv · Salonic/CRM · e-mail/SMS · panaszkezelés · mérés és QA

**121**rögzített döntés

**11**kezeléses teljes kúra

**80′**első kezelés

2026. október 9. • A 64 oldalas PLAN-D egyesített mesteranyag felülírt, a tulajdonosi döntésekhez igazított kivitelezési változata.

00 / VEZETŐI KIVONAT

# Végleges működési modell

A 121 döntés a korábbi, egymásnak ellentmondó javaslatok helyébe lép.

| Üzleti komponens | Végleges szabály |
| --- | --- |
| Első hajoxigénterápia | **29 900 Ft · 80 perc** · helyszíni fizetés a kezelés után. |
| Második és további alkalmankénti kezelés | **26 000 Ft** · helyszíni fizetés a kezelés után. |
| Önálló hajkamerás állapotfelmérés | **4 990 Ft · 30 perc** · helyszíni fizetés. Teljes összeg beszámítható az első kezelésbe, ha a vendég 30 napon belül foglal. |
| Teljes kúra | **11 kezelés = 1 első alkalom + 10 további**; alapból kétheti ritmus, egyéni eltérés lehetséges. |
| Elsődleges bérlet | **10 további alkalom / 260 000 Ft**, ajándék 1 l sampon + 1 l balzsam. |
| Bizonytalan vendég opció | **5 további alkalom / 130 000 Ft**, ajándék 1 l sampon. Nem teljes kúra. |
| Teljes ár bérlettel | **289 900 Ft** első kezelés + 10 alkalmas bérlet; nincs bérletár-kedvezmény a 26 000 Ft-os alkalmi árhoz képest. |
| Foglalás | A meglévő saját **4 lépéses folyamat** a landingben; utolsó lépés élő Salonic-naptár. |
| Dokumentum | **Egyetlen személyes A5 kúraterv** nyomtatva és e-mailben; nem készül 8 oldalas általános füzet. |
| Kamerakontroll | **1., 3., 5., 10.** alkalom; kezelői szöveg; e-mailben 30 napos védett link. |
| Nem kínált szolgáltatás | A **kombinált arc+haj** szolgáltatás kivezetése azonnal; a meglévő foglalásokat teljesítjük. |
| Élesítés | Egyszeri teljes landingcsere a meglévő URL-en, teljes QA után, tulajdonosi GO-val. |

**Az elsődleges üzleti fókusz:** minőségi első foglalás → tényleges megjelenés → kezelő által helyben felajánlott következő időpont → 11 kezeléses teljes kúra felé haladás, valós állapotkövetéssel. Az 5-ös bérlet belépő, bizonytalanságot csökkentő opció; az 5–6. kezelés az első érdemi értékelés pontja. Nem ígérünk garantált hajnövekedést.

01 / FORRÁS ÉS PLAN-D AUDIT

# A korábbi két anyagból mit tartunk meg?

Az eredeti 64 oldal Claude v3 és ChatGPT PLAN-D összevetésére épült. A vizsgálati eredményeket megtartjuk; az üzleti szabályokat a 121 döntés felülírja.

| Megtartandó alapelv | Végleges alkalmazás |
| --- | --- |
| A kúra-elvárás korai tisztázása | A hero és az árblokk kimondja, hogy a teljes program 11 kezelés. A belépő első kezelés 29 900 Ft. |
| Valódi szakmai alkalmasság | Digitális Oxygeni-alapú állapotfelmérő; szűrés, kontraindikáció esetén kezelői értesítés, szükség esetén halasztás/orvoshoz irányítás. |
| Tényleges megjelenésen alapuló CRM | Csak kezelő által igazolt, Salonicban teljesített alkalom lépteti a kúrát. |
| A kezelő személyes szerepe | Minden kezelés végén következő időpont ajánlása és lehetőleg helyszíni foglalása; részletes A5 terv. |
| Összehasonlítható saját képek | 1/3/5/10 kontroll, kezelői komment, privát tárolás, 30 napos link, kérésre frissítés. |
| Átlátható, pontos kereskedelmi ajánlat | 5 és 10 alkalmas bérlet az elsőn felül; valós ajándék, valós ár, nincs fiktív kedvezmény. |
| Kockázatmentes SEO/DSA váltás | Egyszeri csere előtt DSA/SEO baseline-ellenőrzés, teljes QA; nincs visszaállítási ág a tervben. |

### Kifejezetten elvetett korábbi javaslatok

- Nem állítjuk, hogy az 5. kezelésre biztosan megáll a hajhullás, vagy hogy a 10.-re garantáltan új haj nő.
- Nem mondjuk minden vendégnek, hogy mellékhatásmentes vagy kockázat nélküli, és nem állítunk ok nélküli hajbeültetési fölényt.
- Nem kötjük a kúra sikerét kötelező termékcseréhez; a személyes Oxygeni otthoni rutin ajánlott, nem feltétel.
- A korábbi általános „5–10 kezeléses kúra” kerete helyett a **teljes MOSAIC kúra 11 kezelés**; az 5-ös csomag részprogram.
- Nem készül 8 oldalas nyomtatott füzet; nincs arc+haj upsell vagy arc+haj foglalási ág.
- Nincs kötelező portál, nincs automatikus kedvezménylevonás, nincs előrefizetés az egyedi kezelésekre.
- Nem küldünk e-mailt csak az időpont vége alapján, nem kérünk értékelést csak elégedett vendégektől.

### Állítások és forrásfegyelem

A MOSAIC **hivatalos Oxygeni partnerszalon**; a kezelők elvégezték az Oxygeni szakmai képzését. A gyártó által kommunikált **több mint 2 millió kezelés és 95%-os hatásosság** kizárólag gyártói eredetű adatként, a gyártó pontos definíciójával/forráshivatkozásával együtt jelenhet meg. A tulajdonos igazoltnak tekinti a gyártói forrást; ez nem egyéni eredménygarancia, és nem független klinikai hatásvizsgálat. A mikrokamera megfigyelési eszköz, nem diagnosztika.

02 / AZ ÁR ÉS A BÉRLET

# A 11 kezeléses ajánlat pontos matematikája

Közvetlenül a weboldalra, a pénztárba, a kúratervbe és a kezelői scriptbe átvezetendő.

| Szolgáltatás / konstrukció | Mit tartalmaz? | Fizetendő |
| --- | --- | --- |
| Önálló kamera | 30 perces hajkamerás állapotfelmérés | 4 990 Ft |
| Első hajkezelés | 80 perc, állapotfelméréssel | 29 900 Ft |
| Első kezelés beszámítással | Ha a 4 990 Ft-os felmérésből 30 napon belül lefoglalták | 24 910 Ft fennmaradó összeg |
| További hajkezelés | Egy alkalom bérlet nélkül | 26 000 Ft |
| 5-ös bérlet | 5 **további** alkalom; ajándék 1 liter sampon | 130 000 Ft |
| 10-es bérlet | 10 **további** alkalom; ajándék 1 l sampon + 1 l balzsam | 260 000 Ft |
| Teljes 11 kezeléses kúra | Első kezelés + 10-es bérlet, 11 tényleges kezelés | 289 900 Ft |
| Első kezelés + 5-ös bérlet | Összesen 6 kezelés | 159 900 Ft |
| Két külön 5-ös bérlet | 10 további kezelés; ajándék 2 × 1 l sampon | 260 000 Ft bérletdíj |

A bérletek kezelési díja **nem jelent árengedményt**: 5 × 26 000 = 130 000 Ft és 10 × 26 000 = 260 000 Ft. A többletértéket a termékajándék és az előre megtervezett kúra jelenti. Bérletek csak személyesen, egy összegben előre fizethetők; az egyedi kezelés és a kamera a helyszínen, a szolgáltatáskor/után fizetendő.

### Ajándéklogika és feltételek

- 5 további alkalom / 130 000 Ft: **1 liter Oxygeni sampon** ajándék.
- 10 további alkalom / 260 000 Ft: **1 liter Oxygeni sampon és 1 liter balzsam** ajándék.
- Ha a vendég az első kezelés előtt vagy az első kezelés napján személyesen bérletet vásárol: **egy további kis kiszerelésű Oxygeni termék** jár, mindkét konstrukcióhoz.
- A plusz kis kiszerelésű termék konkrét fajtája készletfüggő; nem kommunikálunk előre konkrét márkanéven túli termékazonosítót, mennyiséget vagy értéket.
- Ajándékok a teljes bérletár megfizetésekor azonnal átadandók, a recepció rögzíti az átadást.
- Két külön 5-ös vásárlásakor mindkettőhöz saját 1 literes sampon jár; külön feláras bővítési termék nincs.

### Bérlet-ÁSZF üzleti alapjai

- Az 5-ös bérlet a vásárlástól 6 hónapig, a 10-es 12 hónapig érvényes. Személyhez kötöttek, nem átruházhatók; főszabály szerint nem válthatók vissza.
- A szalonvezető indokolt esetben egyedileg hosszabbíthat. Szakmai okból megkezdett kúra megszakításánál a visszatérítést egyedileg bírálja el.
- Ha egyáltalán nem kezdhető meg a kúra szakmai kontraindikáció miatt, és egyetlen bérletalkalom sem fogyott, **teljes bérletár-visszatérítés** jár; bontatlan ajándékot visszakérünk, felbontottat nem vonunk le.
- Ha a vendég lejárat előtt időpontot foglal, az alkalom lejárat után is felhasználható; lejárat után egyszer, az eredeti időponthoz képest maximum +30 nappal áthelyezhető. Teljes lemondáskor a lejárt jogosultság megszűnik.
- Minden foglalást legkésőbb 48 órával előtte lehet módosítani/lemondani a közzétett feltételek szerint; késői lemondásért vagy no-show-ért nincs automatikus pénzügyi büntetés és bérletalkalom-levonás.
- A tényleges fogyasztóvédelmi, kötelmi és adatkezelési jogokat az ÁSZF nem korlátozhatja; a végleges ÁSZF jogi ellenőrzése az élesítési QA feladata.

### Felmérési díj 4 990 Ft: jogosultság és nyilvántartás

A 4 990 Ft-os önálló felmérés díja teljes egészében beszámítható a 29 900 Ft-os első kezelésbe, ha a vendég a felméréstől számított **30 napon belül lefoglalja** az első kezelést. A kezelés időpontja lehet későbbi. Áthelyezésnél a jogosultság megmarad; teljes lemondásnál megszűnik. A levonást a kezelő vagy recepció **manuálisan** érvényesíti, a közös CRM-ben dátummal és Salonic booking ID-val „felhasználva” státuszban rögzíti. Csak egyszer használható fel.

03 / KÉSZ LANDING COPY

# Oxigénterápia Budapest – végleges oldalszöveg

A MOSAIC prémium sötétzöld–krém–arany arculatához, a jelenlegi /oxigenterapia-budapest URL-en. A fő ajánlat hajra és fejbőrre szól; nincs arc+haj szolgáltatás.

### Hero – az első képernyő

MOSAIC HEADSPA · HIVATALOS OXYGENI PARTNERSZALON · BUDAPEST

## Hullik, ritkul vagy gyorsan zsírosodik a hajad?

Ismerd meg a fejbőröd látható állapotát, és kezdj el egy személyre szabott Oxygeni fejbőrápolási folyamatot nálunk, a Kolosy térnél. Képzett szakembereink hajkamerás megfigyeléssel, egyéni kezelési tervvel és követhető kontrollokkal segítenek eligazodni.

**Első kezelés állapotfelméréssel: 80 perc · 29 900 Ft.**
**Csak hajkamerás felmérés: 30 perc · 4 990 Ft.**

Az ajánlott teljes program 11 kezelésből állhat, alapértelmezetten kéthetente; az alkalmasságot és a folytatást a kezelő értékeli. Nincs garantált eredmény.

ELSŐ KEZELÉST FOGLALOK – 29 900 FT

HAJKAMERÁS ÁLLAPOTFELMÉRÉST FOGLALOK – 4 990 FT

Mindkét gomb a lapon belüli négylépéses foglalóhoz görget, előre kiválasztott szolgáltatással.

### Problémakártyák – válaszd ki, mi zavar

| Panasz | Szöveg |
| --- | --- |
| Hajhullás és ritkulás | „Több hajszálat találsz a fésűben, vagy ritkábbnak látod a hajad? Megbeszéljük a tüneteket és a látható fejbőrállapotot.” |
| Gyors zsírosodás | „Úgy érzed, túl hamar zsírosodik a fejbőröd? Áttekintjük az ápolási rutinodat és a látható eltéréseket.” |
| Korpás vagy érzékeny fejbőr | „Viszketés, hámlás, feszülés? A kezelő segít eldönteni, milyen fejbőrápolás jöhet szóba, és mikor indokolt orvoshoz fordulni.” |
| Vékony, erőtlen haj | „Ha a hajad állagán vagy megjelenésén szeretnél javítani, személyes célokat és követési pontokat határozunk meg.” |

**Interakció:** a kártya nem diagnosztizál, de rögzíti a választott panasz-szegmenst a foglalásban és a kezelői előkészítésben. Több panasz is választható.

### Nem minden hajhullás egyforma

Lehet, hogy hónapok óta keresed a megoldást. Van, aki egyre több hajat lát a fésűben, más inkább állandó zsírosodással, korpával vagy viszketéssel küzd. A panaszok mögött többféle tényező állhat, ezért először figyelmesen meghallgatunk, és megnézzük a fejbőröd látható állapotát.

Az első alkalmon átbeszéljük, mióta jelentkeznek a panaszaid, volt-e változás és milyen az otthoni hajápolási rutinod. Mikrokamerával nagyított képen dokumentálhatjuk a fejbőr és a hajszálak megfigyelhető állapotát. Ezeket későbbi kontrollokon összehasonlíthatjuk – a kamera azonban nem laborvizsgálat és nem helyettesít orvosi diagnózist.

### Így zajlik nálunk az első 80 perc

| Lépés | Mit történik? |
| --- | --- |
| 01 / Beszélgetés és biztonság | Átnézzük az előre kitöltött digitális állapotfelmérőt, a panaszokat, az érzékenységeket és a célokat. |
| 02 / Hajkamerás kiinduló felvétel | Nagyított képet készítünk a fejbőr látható állapotáról; a későbbi összehasonlíthatóság miatt egységes fotózási pontokkal. |
| 03 / Oxygeni ápolás | Az Oxygeni-képzett kezelő az állapothoz és a foglalt kezeléshez illő fejbőrápolási lépéseket végzi el. |
| 04 / Személyes terv és következő időpont | A kezelő összefoglalja a tapasztalatokat, személyre szabott A5 kúratervet készít, és felajánlja a következő időpontot. |

Csendes, prémium környezetben, a Kolosy térnél várunk. A kezelés tű nélküli; a fejbőr érzékenységét és az esetleges ellenjavallatokat minden esetben ellenőrizzük. A kezelést valódi MOSAIC-fotók és rövid, saját kezelésvideó mutassák be.

### Miért 11 alkalom egy teljes kúra?

A haj növekedése ciklusokban történik, ezért az állapotát nem lehet egyetlen alkalom alapján megítélni. A MOSAIC ajánlott teljes Oxygeni-kúrája **egy első kezelésből és tíz további kezelésből, összesen 11 alkalomból** áll. A jellemző ütemezés kéthetente egy alkalom, ettől a kezelőd szakmai indokkal eltérhet.

Egyes vendégek már az első 1–2 kezelés után érezhetnek változást, de az eredményeket érdemben általában az 5–6. alkalom környékén tekintjük át. A teljes kúra végén személyes záróértékelés készül. A megfigyelések és a várható változások személyenként eltérhetnek, ezért konkrét hajnövekedési eredményt nem garantálunk.

| Alkalom | Mit követünk? |
| --- | --- |
| 1. / kiindulás | Hajkamera, panaszok, célok, részletes személyes A5 kúraterv, kétheti követési ajánlás. |
| 3. / első képes kontroll | Új hajkamerás felvétel + összehasonlító képek és 2–3 mondatos kezelői értékelés. |
| 5. / köztes kontroll | Új felvétel, otthoni rutin felülvizsgálata, a tapasztalatok őszinte átbeszélése. |
| 10. / végső kontrollpont | Összehasonlító felvétel és a kúra zárását előkészítő megfigyelések. |
| 11. / kúrazárás | Részletes személyes összefoglaló, az 1/3/5/10 képek összevetése és egyéni fenntartási javaslat. |

### Mennyibe kerül? A teljes ráfordítás előre látható

**Első 80 perces kezelés – 29 900 Ft.** Ha először csak hajkamerás felmérésre jössz (4 990 Ft), annak teljes díját levonjuk, ha 30 napon belül lefoglalod az első kezelést.

**Második alkalomtól – 26 000 Ft / kezelés.** Alkalmanként is fizethetsz, a szalonban.

**Az ajánlott teljes, 11 kezeléses program ára – 289 900 Ft.** Ez az első kezelés 29 900 Ft-os díja és a 10 további alkalomra szóló, 260 000 Ft-os bérlet összege. A bérlethez 1 liter sampon és 1 liter balzsam jár ajándékba.

**Ha még bizonytalan vagy:** választhatod az 5 további kezelésre szóló, 130 000 Ft-os bérletet is, 1 liter Oxygeni sampon ajándékkal. Ez egy kezdő szakasz, nem a teljes kúra.

**Első kezelés előtti vagy aznapi bérletvásárláskor** a bérlet alapajándékán felül egy kis kiszerelésű Oxygeni terméket is adunk. Bérletet csak személyesen, a szalonban lehet vásárolni.

A bérletek kezelési ára azonos az egyes alkalmak 26 000 Ft-os árával; a bérlet előnye a termékajándék. A 5-ös bérlet 6 hónapig, a 10-es 12 hónapig érvényes.

### Miért a MOSAIC?

- Hivatalos Oxygeni partnerszalon Budapesten, minden oxigénterápiás kezelő Oxygeni-képzéssel.
- Valódi, személyes fejbőrállapot-követés: nem csak kezelés, hanem saját képek és kezelői összefoglaló.
- Nyomtatott és digitális A5 személyes kúraterv, közvetlenül a vendég nevére és helyzetére szabva.
- Szabad kezelőválasztás, alapértelmezetten ugyanannál a szakembernél való folytatási lehetőséggel.
- Átlátható költségek, helyszíni fizetés az egyedi kezeléseknél és külön opcionális bérlet.
- A gyártó közlése szerint több mint 2 millió Oxygeni kezelés és 95%-os hatásosság; a pontos mérési jelentést a gyártói forráshoz kötve tüntetjük fel, nem személyes garanciaként.

### GYIK – közvetlenül élesíthető szövegek

**Hány kezelésből áll a teljes kúra?**

A MOSAIC ajánlott teljes kúrája az első alkalomból és tíz további hajkezelésből áll, tehát összesen 11 kezelés. Az alkalmasságot és a szükséges folytatást minden vendégnél a kezelő értékeli.

**Mennyi időnként érdemes jönni?**

Alapértelmezetten kéthetente egyszer javasoljuk a kezelést, de az egyéni állapot és tapasztalatok alapján ettől eltérhetünk.

**Mikor láthatok változást?**

Egyes vendégek 1–2 alkalom után tapasztalhatnak változást. Érdemi köztes értékelést általában 5–6 alkalom után végzünk. Garantált hajnövekedést vagy hajhulláscsökkenést nem ígérünk.

**Kell bérletet vásárolnom?**

Nem. Az első hajkezelés 29 900 Ft, a továbbiak 26 000 Ft/alkalom. Az 5 és 10 további kezelésre szóló bérletek személyesen megvásárolhatók.

**Mi jár a bérlethez?**

Az 5-ös bérlethez 1 liter Oxygeni sampon, a 10-eshez 1 liter sampon és 1 liter balzsam. Az első kezelés előtt vagy napján bérletet vásárlóknak további kis kiszerelésű Oxygeni termék jár.

**Mikor fizetek?**

Az egyedi kezelést és az önálló felmérést a szalonban fizeted, a kezeléskor/után. A bérletet előre, egy összegben, személyesen fizetheted.

**Beszámítható a 4 990 Ft-os felmérés?**

Igen, a teljes 4 990 Ft, ha a felméréstől számított 30 napon belül lefoglalod az első kezelést. Maga a kezelés később is lehet. Áthelyezésnél a beszámítás megmarad, teljes lemondásnál megszűnik.

**Mennyi ideig tart a két szolgáltatás?**

Az első hajoxigénterápia állapotfelméréssel 80 perc. Az önálló hajkamerás állapotfelmérés 30 perc.

**Hogyan készüljek?**

A kezelés előtti 24 órában kérjük, ne moss hajat. Az állapotfelmérőt töltsd ki a biztonságos linken. Hajfestés vagy szőkítés után a kezelő egyéni útmutatása az irányadó.

**Moshatok hajat a kezelés után?**

Igen. Nincs általános, kezelés utáni hajmosási korlátozás. Egyéni szakmai utasítást az állapotod alapján kaphatsz.

**Mire jó a hajkamera?**

Segít dokumentálni a fejbőr és a hajszálak látható állapotát és összehasonlítani a későbbi ellenőrző alkalmakon. Nem helyettesít bőrgyógyászati vagy orvosi diagnózist.

**Biztonságos mindenkinek?**

Nem minden helyzetben megfelelő. A foglalás után digitális állapotfelmérőt küldünk; az esetleges érzékenységet vagy ellenjavallatot a kezelő ellenőrzi, szükség esetén előzetesen egyeztetünk vagy szakemberhez irányítunk.

**Visszakapom a képeimet?**

Igen. Az 1., 3., 5. és 10. kezelésen készítünk felvételeket. Az ellenőrző alkalmak képeit és személyes értékelését biztonságos, 30 napig érvényes linken küldjük. Új link kérhető.

**Meddig érvényes a bérletem?**

Az 5 alkalmas bérlet 6 hónapig, a 10 alkalmas 12 hónapig érvényes. Elég a lejárat előtt időpontot foglalni; a kezelés későbbre is eshet. Részletes feltételeket a szalonban ismertetünk.

**Lemondhatom az időpontomat?**

Legkésőbb 48 órával előtte módosíthatod vagy lemondhatod. Késedelmes lemondásért és meg nem jelenésért nem számítunk fel külön pénzügyi szankciót.

**Hol talállak titeket?**

MOSAIC HeadSpa, 1023 Budapest, Bécsi út 2., Kolosy tér. Telefon: 06 20 247 4444.

### Végső foglalási blokk

## A saját fejbőröd állapotából indulunk ki.

Ha szeretnéd megismerni a lehetőségeidet, válassz időpontot az első, 80 perces hajkezelésre – vagy kezdj a 30 perces önálló hajkamerás állapotfelméréssel. A 4 990 Ft-os felmérést az első kezelés árába beszámítjuk a megadott feltételekkel.

ELSŐ KEZELÉST FOGLALOK – 29 900 FT

HAJKAMERÁS ÁLLAPOTFELMÉRÉST FOGLALOK – 4 990 FT

Foglalási blokk: a korábban jóváhagyott MOSAIC 4 lépéses felület, előtöltött szolgáltatás, élő Salonic-naptár az utolsó lépésben. Kezelőválasztás: mindenki alapértelmezetten, opcionális szűrés.

04 / WIREFRAME

# 12 célzott desktop és mobil képernyőterv

A korábbi 6 × 2 wireframe struktúra megmarad. A szövegek és foglalási viselkedés a végleges tulajdonosi szabályokat követik.

### 01. Hero és első döntés · Desktop 1440

MOSAIC · OXYGENI

H1: „Hullik, ritkul vagy gyorsan zsírosodik a hajad?”

Valódi MOSAIC kezelésfotó

Első 80 perc: 29 900 Ft
Fő és kamera másodlagos CTA

ELSŐ KEZELÉST FOGLALOK

**Fejlesztői megjegyzés:** Hero CTA → oldalon belüli 4 lépéses foglalás

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 01. Hero és első döntés · Mobil 390×844

MOSAIC · OXYGENI

H1: „Hullik, ritkul vagy gyorsan zsírosodik a hajad?”

Valódi MOSAIC kezelésfotó

Első 80 perc: 29 900 Ft
Fő és kamera másodlagos CTA

ELSŐ KEZELÉST FOGLALOK

**Fejlesztői megjegyzés:** Hero CTA → oldalon belüli 4 lépéses foglalás

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 02. Panaszválasztás · Desktop 1440

MOSAIC · OXYGENI

Négy probléma: hajhullás, zsírosodás, korpa/érzékenység, erőtlen haj

4 natív problémakártya

Állapotfelmérés és alkalmasság
Szakmai biztonság disclaimer

ELSŐ IDŐPONTOT FOGLALOK

**Fejlesztői megjegyzés:** Kártyaválasztás → szegmentált tartalom; nem diagnózis

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 02. Panaszválasztás · Mobil 390×844

MOSAIC · OXYGENI

Négy probléma: hajhullás, zsírosodás, korpa/érzékenység, erőtlen haj

4 natív problémakártya

Állapotfelmérés és alkalmasság
Szakmai biztonság disclaimer

ELSŐ IDŐPONTOT FOGLALOK

**Fejlesztői megjegyzés:** Kártyaválasztás → szegmentált tartalom; nem diagnózis

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 03. Valódi kezelés és szakember · Desktop 1440

MOSAIC · OXYGENI

Valódi 30–45 mp kezelési videó

80 perces négy lépés

MOSAIC kezelőfotó / Oxygeni-képzés
Kamera és A5 személyes terv

ELSŐ IDŐPONTOT FOGLALOK

**Fejlesztői megjegyzés:** Nincs stock/AI eredménykép; alt és videó felirat

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 03. Valódi kezelés és szakember · Mobil 390×844

MOSAIC · OXYGENI

Valódi 30–45 mp kezelési videó

80 perces négy lépés

MOSAIC kezelőfotó / Oxygeni-képzés
Kamera és A5 személyes terv

ELSŐ IDŐPONTOT FOGLALOK

**Fejlesztői megjegyzés:** Nincs stock/AI eredménykép; alt és videó felirat

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 04. Kúra és átlátható ár · Desktop 1440

MOSAIC · OXYGENI

11 kezeléses teljes kúra, 2 hetes kiinduló ritmus

Kontrollok: 1/3/5/10 + zárás 11

5 további / 130 000 Ft
10 további / 260 000 Ft, teljes költség 289 900 Ft

IDŐPONTOT FOGLALOK

**Fejlesztői megjegyzés:** Nincs fiktív árkedvezmény; ajándékok őszintén feltüntetve

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 04. Kúra és átlátható ár · Mobil 390×844

MOSAIC · OXYGENI

11 kezeléses teljes kúra, 2 hetes kiinduló ritmus

Kontrollok: 1/3/5/10 + zárás 11

5 további / 130 000 Ft
10 további / 260 000 Ft, teljes költség 289 900 Ft

IDŐPONTOT FOGLALOK

**Fejlesztői megjegyzés:** Nincs fiktív árkedvezmény; ajándékok őszintén feltüntetve

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 05. Referenciák, kezelők, helyszín · Desktop 1440

MOSAIC · OXYGENI

Valódi, consenttel ellátott MOSAIC vendégtapasztalat

Hivatalos Oxygeni partner, képzett kezelők

Helyszín Bécsi út 2., Kolosy tér
2 millió/95% gyártói attribúció, nem garancia

ELSŐ IDŐPONTOT FOGLALOK

**Fejlesztői megjegyzés:** Ne használjunk nem ellenőrzött 5 csillagos review-számot

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 05. Referenciák, kezelők, helyszín · Mobil 390×844

MOSAIC · OXYGENI

Valódi, consenttel ellátott MOSAIC vendégtapasztalat

Hivatalos Oxygeni partner, képzett kezelők

Helyszín Bécsi út 2., Kolosy tér
2 millió/95% gyártói attribúció, nem garancia

ELSŐ IDŐPONTOT FOGLALOK

**Fejlesztői megjegyzés:** Ne használjunk nem ellenőrzött 5 csillagos review-számot

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 06. GYIK, foglalás és final close · Desktop 1440

MOSAIC · OXYGENI

GYIK 16 kérdéssel, CTA

Első kezelés 29 900 Ft / 80 perc

Kamera 4 990 Ft / 30 perc
Meglévő 4 lépéses booking, 4.: Salonic élő naptár

FOGLALÁS INDÍTÁSA

**Fejlesztői megjegyzés:** Kombinált arc+haj szolgáltatás egyáltalán ne szerepeljen

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### 06. GYIK, foglalás és final close · Mobil 390×844

MOSAIC · OXYGENI

GYIK 16 kérdéssel, CTA

Első kezelés 29 900 Ft / 80 perc

Kamera 4 990 Ft / 30 perc
Meglévő 4 lépéses booking, 4.: Salonic élő naptár

FOGLALÁS INDÍTÁSA

**Fejlesztői megjegyzés:** Kombinált arc+haj szolgáltatás egyáltalán ne szerepeljen

**Mérés:** képernyő-megjelenés, CTA-kattintás, booking\_start és tényleges, igazolt Salonic-foglalás. **QA:** desktop és 390×844 mobil, törés és duplázódás nélkül.

### Éles kreatív assetlista

| Asset | Felhasználás | Átvételi ellenőrzés |
| --- | --- | --- |
| Valódi MOSAIC hero fotó | Hero + hirdetés message match | Helyszín, szakember, felhasználási jog. |
| 30–45 mp saját kezelésvideó | Hero / „Így zajlik” | Felirat, álló és fekvő vágat, időtartam. |
| Valódi kezelőportré | Szakemberblokk | Név és képzés ténye egyezik. |
| Hajkamera-folyamatfotó | Állapotkövetés magyarázata | Valódi felvétel, nincs személyes adat a demo képen. |
| Vendég-összehasonlítások | Esettörténetek | A marketinghasználatra külön hozzájárulás; pontos dátumok, azonos beállítás. |
| A5 személyes kúraterv design | Kezelés utáni dokumentáció | A5 nyomtatható PDF, azonos tartalom e-mailben; nincs 8 oldalas füzet. |
| Vízszintes/vertikális edukációs videó | E2/E3 email | Oxygeni szakmai jóváhagyás, nincs abszolút eredményígéret. |

05 / SALONIC + CRM

# Közös vendégállapot és automatizáció

A két Salonic-fiók feletti vendégnyilvántartás a személyes kezelési dokumentumok forrása; nem tervezünk külön vendégportált.

### Folyamat: foglalástól a 11. kezelésig

| Esemény | Kötelező teendő | Rendszerreakció |
| --- | --- | --- |
| Foglalás / T0 | Szolgáltatás, időpont, kezelő, ügyféladat rögzítése; opcionális marketing-hozzájárulás. | Tranzakciós visszaigazolás + biztonságos digitális állapotfelmérő link. |
| Állapotfelmérő kész | Érzékenységek és szakmai kockázatok ellenőrzése. | Lehetséges ellenjavallatnál kezelői riasztás, előzetes egyeztetés. |
| T–72 / T–24 | Aktív foglalás ellenőrzése, duplák kizárása. | E-mail 72 órával, SMS 24 órával előtte; hiányzó kérdőívnél célzott emlékeztető. |
| Megjelent + kezelve | Kezelő Salonicban completed/attended státuszt erősít meg. | Kezelés sorszámának emelése, általános utóüzenetek aktiválása. |
| Első kezelés | Hajkamera, személyes kúraterv, 10-es bérlet elsődleges ajánlása és következő foglalás felajánlása. | E-mail A5 kúraterv a kész dokumentáció után, elégedettség +3h, Google +24h. |
| 3., 5., 10. kezelés | Új kamerakép + 2–3 mondatos értékelés, otthoni rutin kontroll. | 30 napos védett összehasonlító link, e-mail küldés kész dokumentáció után. |
| 11. kezelés | Kúrazáró értékelés és egyénileg indokolt fenntartási ajánlás. | A5 záródokumentum és email; kúra státusz closed. |
| Nincs következő foglalás | Kezelő kínált foglalást, vendég nem élt vele. | Marketingjogalappal +48h e-mail, +5 nap SMS; bármely új foglalás → STOP. |
| Panasz / kontraindikáció | Kezelő szakmai megoldás; nyitott panasz kezelői 24h kapcsolatfelvétel. | Minden sales/rebooking üzenet STOP; megfelelő tranzakciós értesítések maradnak. |
| Bérlet lejárat | Maradék alkalom és érvényesség ellenőrzése. | T–30 e-mail, T–7 SMS, csak akkor, ha maradt alkalom. |

### Vendégazonosítás és jogosultság

- Közös vendégkulcs: `guest_key`, hozzá két Salonic-azonosító és booking UUID-k. Azonos, ellenőrzött e-mail ÉS telefonszám mellett automatikus egyeztetés; bizonytalan eset manuális, kezelő által jóváhagyott összevonás.
- Minden Oxygeni-kezelő megtekintheti a szükséges Oxygeni szakmai dokumentációkat; egyéni, naplózott hozzáféréssel, a recepció pedig csak a feladatához szükséges kereskedelmi és foglalási adatokat láthatja.
- A kezelői teljesítés a kizárólagos kezelés-utáni trigger. Salonic start+80 perc, időpont vége, automatikus kifizetés vagy a vendég foglalása NEM helyettesíti a kezelés teljesítését.
- Küldési egyediség: `guest_key + template_id + occasion_id`; azonos eseményhez a teljes öt-hat automatizmus sem küldhet duplikált üzenetet.
- Minden küldés előtt friss státuszlekérdezés: aktív foglalás, panasz, marketing-opt-in, bérletvásárlás, végleges lezárás és a kiválasztott szolgáltatás ellenőrzése.
- A bérletvásárlást a recepció rögzíti, a fennmaradó kezelésszámot a valóban teljesített alkalmak csökkentik; külön kézi korrekció naplózott admin-esemény.

### Adatmodell – minimálisan szükséges mezők

| Mező | Feladat / ellenőrzés |
| --- | --- |
| `guest_key` | Stabil belső vendég-azonosító, verziózott összevonási történet |
| `salonic_ids` | Két fiókban tárolt eredeti ügyfélazonosítók |
| `booking_uuid` | Időpont egyedi azonosítója, eredeti és új dátum |
| `service_type` | first\_hair / followup\_hair / camera\_assessment / legacy\_combo |
| `booking_status` | booked / rescheduled / cancelled / no\_show / completed |
| `treatment_index` | 1…11; csak completed után növekedhet |
| `treating_therapist` | Az aktuális kezelő és a megjelenéskor megerősített kezelő |
| `assessment_completed_at` | Kérdőív kitöltése, biztonsági kockázati jelző |
| `consent_marketing_email` | Külön, önkéntes hozzájárulás timestamp + szövegverzió |
| `consent_marketing_sms` | Külön csatorna hozzájárulás timestamp + szövegverzió |
| `consent_images_marketing` | Külön, kifejezett képfelhasználási hozzájárulás |
| `plan_doc_id` | Kitöltött, kezelői terv dokumentumazonosítója, jóváhagyási dátum |
| `scalp_images` | 1/3/5/10 kameraképek, privát fájlazonosítók, összehasonlíthatóság |
| `review_notes` | Kezelő 2–3 mondatos megfigyelése |
| `image_share_token` | 30 napra korlátozott, e-mail-ellenőrzéssel újítható hozzáférés |
| `package_type` | 5/10, vásárlási idő, lejárat, kapott ajándék, elhasznált alkalmak |
| `assessment_credit` | 4 990 Ft jogosultság, 30 napos foglalási ablak, manual\_used\_at, booking\_id |
| `complaint_state` | open / resolved, score, kezelő, próbálkozások, lezárás |
| `clinical_stop` | contraindication / adverse reaction / medical\_referral |
| `next_appointment` | Valós, jövőbeli foglalás + ajánlott intervallum |
| `message_ledger` | Sablon, csatorna, alkalom, küldési timestamp, stop ok |
| `course_closed_at` | 11. kezelés vagy szakmai lezárás és egyéni fenntartási állapot |

### Kötelező STOP-logika

| Kommunikációs ág | Feltétel / stop |
| --- | --- |
| T0/T–72/T–24, foglalási | Csak aktuális booked státuszra, helyes időpontra; módosításkor az eredeti ütemezés törlendő. |
| Edukációs, kezelési dokumentum | Csak completed + kezelői tartalom készen; személyes dokumentum csak akkor, ha kötelező mezői nem üresek. |
| Marketing / bérlet / rebooking | Külön, érvényes csatorna-opt-in; nyitott panasz, stop, course\_closed, már létező foglalás vagy releváns bérletvásárlás esetén nem megy. |
| No-show | Csak valóban no\_show státusz; cancelled és completed nem aktiválhatja. |
| Lemondás | Csak valós cancelled státusz; rescheduled nem tekinthető lemondásnak. |
| Google-értékelés | Első completed után +24h, minden vendégnek egységesen, az 1–5 belső pontszámtól függetlenül. |
| Belső elégedettség | Első completed +3h; negatív pont/komment → Janka értesítés és kezelői panaszworkflow. |
| Panasz lezárása utáni újraindítás | Elmaradt marketingüzenetek nem torlódnak; a rendszer csak az aktuális vendégstátuszhoz illő további üzenetet küldi. |
| Foto megosztás | Csak a jóváhagyott vendég saját fájljaihoz; nincs publikusan elérhető Drive-URL, nincs véletlen vendégcsere. |

### Fotók és adatvédelem

A digitális állapotfelmérőben tárolt információk és egyes fejbőrképek egészségi adatnak minősülhetnek. A MOSAIC célja az utolsó kezeléstől számított **36 hónapos** megőrzés, de ezt adattípusonként jogalap- és megőrzési vizsgálattal kell alátámasztani. A képekhez nem építünk vendégportált; a vendég automatikus e-mailt kap **30 napig érvényes, hitelesített linken**, amely a regisztrált e-mail-cím ellenőrzésével kérésre megújítható. A marketinghasználathoz minden esetben önálló, kifejezett hozzájárulás kell; opt-out nem érintheti a kezelést.

### Dokumentáció határidő és riasztás

A kezelőnek a befejezést követő **24 órán belül** el kell készítenie a személyes tervet és az adott ellenőrző alkalom értékelését. A teljesítéskor az általános, személyes adatot nem igénylő utóüzenetek indulhatnak. A dokumentáció hiánya +24 óránál kezelői figyelmeztetést, +48 óránál Janka szakmai vezetőnek értesítést eredményez. Személyes terv/kép csak az adott dokumentáció lezárásakor és a helyes vendég-azonosítás után küldhető.

### Digitális állapotfelmérés – kötelező kérdéscsoportok

- Foglalási UUID, kezelő, vendég elérhetősége; az adatkezelési tájékoztató elfogadása külön a marketinghozzájárulástól.
- Panasztípus: hajhullás, ritkulás, zsírosodás, hámlás/érzékenység, vékony haj; tünetek kezdete, változása, vendég célja.
- Korábbi bőr- és fejbőrreakciók, ismert termékallergiák, aktuális fejbőrtünetek, kezelés szempontjából releváns szakmai előzmények – kizárólag az Oxygeni tényleges szakmai protokollja szerint.
- Otthoni rutin, aktuális termékhasználat, hajfestés/szőkítés; várható kezelés előtti 24 órás hajmosási szünet ismertetése.
- Ellenjavallat/súlyosbodó tünet flag: a kezelő értesül, és az időpont előtt egyeztethet; kockázat tisztázása nélkül kezelés nem indul.
- T-24 hiányzó kitöltésről emlékeztető; helyszíni pótlás lehetősége. A Salonic „completed” csak kezelői tényleges teljesítést követhet.

### Személyes A5 kúraterv – digitális űrlap szerkezete

| Csoport | Mezők |
| --- | --- |
| Vendég és alkalom | Név, dátum, kezelés sorszáma, kezelő neve, Salonic booking ID. |
| Kiinduló állapot | Fő panasz, a vendég saját beszámolója, látható fejbőrmegfigyelések, fotóazonosító. |
| Személyes cél | Mi változzon, mit követünk, milyen egyéni korlátai vannak a megfigyelésnek. |
| Ajánlott terv | A teljes kúra 11, személyre szabott szakmai eltérés megengedett; javasolt következő dátum és kétheti kiinduló gyakoriság. |
| Otthoni hajápolás | A kezelő által kiválasztott Oxygeni termék neve/használat, opcionális jelleg, csak szalonos vásárlás. |
| Kezelői javaslat | 2–3 konkrét, nem diagnosztikus mondat: mi látható, mi nem, mit figyelünk, mikor jelezzen problémát. |
| Következő időpont | Salonicból ténylegesen lefoglalt időpont / ha nincs, javasolt intervallum és választási link. |
| Kúrazáró dokumentum | 11. alkalomkor 1/3/5/10 fotók összehasonlítása, eredmények, fenntartási javaslat, kezelő. |

06 / KÜLDÉSI KATALÓGUS

# Az összes e-mail és SMS – pontos szabályok

Az időpont-visszaigazolás tranzakciós kommunikáció. A visszafoglalásra és bérletvásárlásra ösztönző üzenetekhez külön, opcionális és dokumentált marketing-hozzájárulás szükséges.

| Kód | Esemény / időzítés | Csatorna / jogi minőség |
| --- | --- | --- |
| T0 | Foglalás megerősítése, azonnal | E-mail, tranzakciós |
| Q0 | Digitális állapotfelmérő link T0-ban | E-mail, szolgáltatáshoz szükséges |
| T–72 | Aktív foglalás mínusz 72 óra | E-mail, időponthoz kötött |
| T–24 | Aktív foglalás mínusz 24 óra | SMS + nem kész kérdőív emlékeztető |
| S0 | Első completed után +3 óra | E-mail, belső elégedettség |
| G0 | Első completed után +24 óra | E-mail, Google-értékeléskérés |
| P0 | Dokumentáció elkészült, legkésőbb +24h cél | E-mail, személyes A5 kúraterv |
| N0 | Igazolt no-show után következő nap | SMS, újrafoglalási cél opt-innel |
| C1/C2 | Lemondás után +24h e-mail, +3d SMS | Marketing opt-in, booking STOP |
| R1/R2 | Kezelés után nincs új időpont: +48h e-mail, +5d SMS | Marketing opt-in, booking STOP |
| A1/A2 | Önálló kamera után nincs első kezelés: +48h e-mail, +5d SMS | Marketing opt-in, booking STOP |
| E2 | Első completed után +3 nap | Edukáció + az ajánlat részének leválasztása |
| E3 | Első completed után +7 nap | Reális elvárás; rebooking csak opt-innel |
| E5 | Második completed után | Dokumentált kontroll a 2. alkalom képe nélkül |
| E6 | Harmadik completed után, képek készen | Kamerás összehasonlítás + kezelői leírás |
| E7 | Ötödik completed után | 5–6. értékelés, képes kontroll |
| E8/E9 | Esedékes kontroll elmúlt, nincs booking | Egyszeri, szelíd reaktiváció, csak opt-in |
| E10 | 11. completed, záró értékelés elkészült | A5 kúrazárás és egyéni fenntartás |
| B30/B7 | Bérletlejárat mínusz 30/7 nap, maradék alkalom > 0 | E-mail, majd SMS; megfelelő jogi minőség szerint |
| D24/D48 | Hiányzó dokumentáció 24/48 óránál | Belső kezelői, majd vezetői riasztás |

T0-H**Első kezelés foglalási visszaigazolása**

INDÍTÁS: Aktív első kezelés foglalása azonnal

**Tárgy:** Megvan az Oxygeni időpontod – ezt érdemes tudnod

Szia {keresztnév}!

Örülünk, hogy a MOSAIC-ban kezded meg az Oxygeni fejbőrápolást. Az időpontod: {dátum}, {idő}. Kezelőd: {kezelő}. Helyszín: 1023 Budapest, Bécsi út 2., a Kolosy térnél.

Az első kezelés állapotfelméréssel együtt 80 perc, díja 29 900 Ft, amelyet a kezelés után a szalonban fizetsz. Ha korábban a 4 990 Ft-os önálló hajkamerás felmérésen már részt vettél, a beszámítás jogosultságát a helyszínen ellenőrizzük.

Mielőtt jössz, kérjük, töltsd ki a biztonságos állapotfelmérődet: {allapotfelmero\_link}. A kezelés előtti 24 órában kérjük, ne moss hajat. Ha érzékenységed vagy korábbi rossz reakciód van, azt mindenképp jelezd.

Az időpont legkésőbb 48 órával előtte módosítható vagy lemondható: {idopont\_link}.

Várunk szeretettel!
{kezelő} és a MOSAIC csapata

**Stop és QA:** Csak booked; nincs külön fizetés vagy 120 perces ígéret. A kérdőív jogalapja külön kezelendő a marketing-opt-intől.

T0-C**Csak hajkamerás felmérés visszaigazolása**

INDÍTÁS: Aktív assessment booking azonnal

**Tárgy:** Hajkamerás állapotfelmérésed – időpont és tudnivalók

Szia {keresztnév}!

Várunk a 30 perces hajkamerás fejbőrállapot-felméréseden: {dátum}, {idő}, 1023 Budapest, Bécsi út 2. Díja 4 990 Ft, amelyet helyben fizetsz.

Mielőtt találkozunk, töltsd ki a biztonságos állapotfelmérőt: {allapotfelmero\_link}. Ez a találkozás önálló felmérés, nem tartalmaz 80 perces oxigénterápiás kezelést.

A 4 990 Ft teljes összege beszámítható a 29 900 Ft-os első kezelés díjába, ha a felmérést követő 30 napon belül lefoglalod a kezelést. A tényleges kezelés dátuma későbbi is lehet.

Időpontod módosítása / lemondása: {idopont\_link}. Telefon: 06 20 247 4444.

Találkozunk hamarosan!
MOSAIC

**Stop és QA:** Csak camera\_assessment; nehogy a 80 perces first-treatment confirmation menjen.

T–72**Felkészülési e-mail**

INDÍTÁS: Aktív foglalás előtt 72 órával

**Tárgy:** Három nap múlva találkozunk a MOSAIC-ban

Szia {keresztnév}!

{dátum}-án {idő}-kor várunk a MOSAIC-ban, a Bécsi út 2. alatt. Szolgáltatásod: {szolgaltatas}.

Kérjük, gondold át, mióta tapasztalod a hajaddal vagy fejbőröddel kapcsolatos tüneteket, milyen termékeket használsz, és jelezd ismert érzékenységeidet. Ha még nem töltötted ki, itt találod az állapotfelmérőt: {allapotfelmero\_link}.

A kezelés előtti 24 órában kérjük, ne moss hajat. Hajfestés vagy szőkítés után az egyéni kezelői útmutatás érvényes. A kezelés UTÁN nincs általános hajmosási tilalom.

Ha közbejött valami, legkésőbb 48 órával az időpont előtt tudod módosítani: {idopont\_link}.

Várunk szeretettel!
MOSAIC

**Stop és QA:** Aktív dátum+szolgáltatás valós; foglalásmódosításnál új T–72 ütem.

T–24**Időpont-emlékeztető SMS**

INDÍTÁS: Aktív foglalás előtt 24 órával

**Tárgy:** SMS

Szia {keresztnév}! Holnap {idő}-kor várunk {szolgaltatas} alkalomra a MOSAIC-ban (1023 Budapest, Bécsi út 2.). Ha még nem töltötted ki az állapotfelmérőt: {kerdoiv\_link}. Időpontod: {foglalas\_link}. MOSAIC

**Stop és QA:** Egy SMS / foglalási alkalom; a kezelés előtt 24 órával ne legyen új 48 órás lemondási ígéret.

S0**Belső elégedettség**

INDÍTÁS: Első completed +3 óra

**Tárgy:** Milyen volt az első találkozásunk?

Szia {keresztnév}!

Köszönjük, hogy ma nálunk jártál. Szeretnénk tudni, milyen volt számodra a szalonélmény és a kezelői figyelem.

Egy rövid kérdés: hány pontot adnál az első alkalomnak 1-től 5-ig? Ha szeretnéd, néhány mondatban azt is leírhatod, mit csináltunk jól, vagy min változtatnál: {rovid\_kerdoiv\_link}.

Köszönjük a segítséget!
MOSAIC

**Stop és QA:** Minden első completed vendég, a score kezelőhöz kapcsolódik; 1–3 pont/negatív szöveg → Janka értesítés és saját kezelő panaszügye.

G0**Google-értékeléskérés**

INDÍTÁS: Első completed +24 óra

**Tárgy:** Elmondod, milyen volt a MOSAIC-ban?

Szia {keresztnév}!

Köszönjük, hogy a MOSAIC-ot választottad. Ha van két perced, örülünk, ha őszinte Google-értékelést írsz a nálunk szerzett élményedről: {google\_ertekeles\_link}.

Minden visszajelzés fontos nekünk – legyen pozitív vagy kritikus.

Köszönjük!
MOSAIC

**Stop és QA:** Minden első completed vendégnek, belső elégedettségi ponttól függetlenül; nincs ajándék/kedvezmény.

P0**Személyes A5 kúraterv és állapot**

INDÍTÁS: Első completed + kezelői dokumentáció készen

**Tárgy:** A te fejbőröd. A te személyes terved.

Szia {keresztnév}!

Összefoglaltam az első alkalom tapasztalatait a személyes kúratervedben.

A fő panaszod: {jo\_hagyott\_panasz}.
Amit a fejbőröd látható állapotáról rögzítettünk: {kezelo\_megfigyelese}.
A közösen megbeszélt cél: {szemelyes\_cel}.
Javasolt ütemezés: {egyeni\_ritmus}; a MOSAIC teljes kúrája 11 kezelést jelent, amelyből a folytatást szakmailag értékeljük.

Az A5 kúratervedet itt találod: {biztonsagos\_a5\_pdf\_link}. A hajkamerás kiinduló képed a későbbi kontrollok összehasonlításához szolgál. A 3., 5. és 10. alkalom után új képet és rövid személyes értékelést is kapsz.

{ha\_kovetkezo\_idopont: A következő időpontod: {kov\_datum\_ido}.}
{ha\_nincs\_kovetkezo: A következő kezelés javasolt időszaka: {javasolt\_idoszak}.}

Ha kérdésed van, válaszolj bátran erre a levélre.
{kezelo} · MOSAIC

**Stop és QA:** Nem küldhető üres vagy más vendéghez tartozó mezőkkel; első személyes dokumentáció +24h céldátum.

R1**Nincs következő foglalás – e-mail**

INDÍTÁS: Minden completed kezelés után +48h, ha nincs aktív next booking

**Tárgy:** Egyeztessük a következő alkalmat?

Szia {keresztnév}!

A legutóbbi Oxygeni kezeléseden megbeszéltük a következő lépést, de egyelőre nem látok új időpontot a neveden.

Ha szeretnéd folytatni az egyéni tervedet, itt megnézheted a szabad időpontokat: {foglalas\_link}. Alapértelmezetten körülbelül két hét elteltével szoktunk találkozni, de ezt személyesen egyeztettük.

Ha inkább kérdésed van, írj nyugodtan.
{kezelo} · MOSAIC

**Stop és QA:** Marketing e-mail opt-in, aktív kúra, nincs panasz/booking; ne ismételjünk több ágon egy napon.

R2**Nincs következő foglalás – SMS**

INDÍTÁS: Minden completed kezelés után +5 nap, ha továbbra sincs next booking

**Tárgy:** SMS

Szia {keresztnév}! {kezelo} vagyok a MOSAIC-ból. Ha szeretnéd folytatni a személyes Oxygeni tervedet, itt könnyen választhatsz következő időpontot: {foglalas\_link}. Kérdés esetén írj vagy hívj minket. MOSAIC

**Stop és QA:** Marketing SMS opt-in; booking exists vagy nyitott panasz esetén STOP.

A1**Kamera-vendég utókövetése – e-mail**

INDÍTÁS: Önálló, igazoltan befejezett felmérés után +48h, nincs első treatment booking

**Tárgy:** A fejbőrállapotod alapján: itt az első lépés

Szia {keresztnév}!

Köszönjük, hogy részt vettél a hajkamerás állapotfelmérésen. A személyes értékelésedet és a kezelő javaslatát itt találod: {biztonsagos\_ertekeles\_link}.

Ha úgy döntesz, hogy belevágsz az első 80 perces Oxygeni kezelésbe, a korábban kifizetett 4 990 Ft teljes díját levonjuk a 29 900 Ft-os első kezelés árából. Ehhez elég, ha az állapotfelmérés után 30 napon belül lefoglalod a kezelést; maga az időpont lehet később is.

Első kezelés foglalása: {foglalas\_link}.

Kérdéseddel keress bátran!
MOSAIC

**Stop és QA:** Marketing opt-in, nincs első kezelés booking; felmérés 30 napos window pontos.

A2**Kamera-vendég utókövetése – SMS**

INDÍTÁS: Önálló assessment után +5 nap, ha még nincs első kezelés

**Tárgy:** SMS

Szia {keresztnév}! Ha szeretnéd folytatni a hajkamerás állapotfelmérésen megbeszélt tervedet, itt foglalhatod az első Oxygeni kezelést: {foglalas\_link}. A 4 990 Ft felmérési díjat a 30 napon belüli foglalásnál beszámítjuk. MOSAIC

**Stop és QA:** Marketing SMS opt-in; ne küldjük, ha közben foglalt vagy teljesen lemondta a beszámítási jogosultságot.

C0**Lemondás visszaigazolása**

INDÍTÁS: Igazolt cancelled, azonnal

**Tárgy:** Lemondásodat rögzítettük – MOSAIC

Szia {keresztnév}!

A {regi\_datum} {regi\_ido} időpontra szóló Oxygeni foglalásodat lemondtuk. Erre az időpontra már nem küldünk emlékeztetőt.

Ha később új időpontot szeretnél, a foglalónkban találsz szabad alkalmakat: {foglalas\_link}.

Üdvözlettel: MOSAIC

**Stop és QA:** Tranzakciós visszaigazolás; a marketingutókövetés ettől külön.

C1**Lemondás után újrafoglalás – e-mail**

INDÍTÁS: Lemondás után +24 óra, nincs új booking

**Tárgy:** Ha szeretnéd, segítünk új időpontot találni

Szia {keresztnév}!

Láttuk, hogy a korábbi időpontod elmarad. Ha továbbra is szeretnéd folytatni vagy elkezdeni az Oxygeni kezelést, itt könnyen választhatsz új időpontot: {foglalas\_link}.

Ha kérdésed van, nyugodtan írj nekünk.
MOSAIC

**Stop és QA:** Csak marketing e-mail opt-in, no booking, no panasz.

C2**Lemondás után újrafoglalás – SMS**

INDÍTÁS: Lemondás után +3 nap, nincs új booking

**Tárgy:** SMS

Szia {keresztnév}! Ha továbbra is szeretnél Oxygeni kezelésre jönni, itt tudsz új időpontot választani: {foglalas\_link}. Ha segítség kell az egyeztetéshez, szívesen segítünk. MOSAIC

**Stop és QA:** Csak marketing SMS opt-in, no booking.

N0**No-show – SMS**

INDÍTÁS: Igazolt no-show után másnap, nincs új booking

**Tárgy:** SMS

Szia {keresztnév}! Tegnap nem találkoztunk a MOSAIC-ban. Reméljük, minden rendben. Ha szeretnél új Oxygeni időpontot egyeztetni, itt találsz szabad helyeket: {foglalas\_link}. Kérdés esetén hívhatsz minket. MOSAIC

**Stop és QA:** Csak hiteles no-show, és megfelelő marketing SMS jogosultság; nincs fenyegetés és nincs pénzügyi szankció.

E2**Otthoni Oxygeni hajápolás**

INDÍTÁS: Első completed +3 nap, szakmai edukáció; marketing elem csak hozzájárulással

**Tárgy:** Így ápold otthon a fejbőrödet

Szia {keresztnév}!

A következő találkozásig az otthoni rutin is fontos része a személyes tervednek. Nem kell mindent lecserélned vagy egyszerre több terméket használnod.

A kezelésed alapján ezt ajánlottam: {kezelo\_otthoni\_rutin}. Használd a kezelő által megbeszélt módon; ha irritációt tapasztalsz, jelezd.

Az Oxygeni otthoni ápolást erősen ajánljuk, de nem feltétele a kezeléseknek. Az ajánlott termékeket személyesen a MOSAIC szalonban tudod megvásárolni.

Ha kérdésed van, válaszolj erre a levélre.
{kezelo}

**Stop és QA:** Ha a levél termékvásárlásra ösztönöz, marketing opt-in kell; a kizárólag szakmai, személyes rutin külön ág.

E3**Reális elvárás az első hét után**

INDÍTÁS: Első completed +7 nap

**Tárgy:** Az első hét után ezt érdemes figyelni

Szia {keresztnév}!

Egy hete voltál az első Oxygeni kezeléseden. Előfordul, hogy valaki már 1–2 alkalom után érez változást a fejbőre komfortjában, de az érdemi köztes értékelést általában az 5–6. kezelés környékén végezzük.

Figyeld, hogyan érzed a fejbőrödet, hogyan működik az otthoni rutinod, és ha van kérdésed vagy szokatlan tüneted, jelezd a kezelődnek.

A teljes ajánlott kúra 11 alkalom, de nincs előre garantált eredmény. A személyes állapotkövetés segít a folytatásról felelősen dönteni.

{ha\_nincs\_foglalas\_es\_marketing\_optin: Ha még nem foglaltad a következő alkalmat, itt megteheted: {foglalas\_link}.}

{kezelo} · MOSAIC

**Stop és QA:** Foglalás CTA csak marketing opt-innel és no booking; panasz/stop ellenőrzés.

E5**Második kezelés után**

INDÍTÁS: Második completed után; nem készül új hajkamerás kép

**Tárgy:** A második alkalom után: mit figyelj?

Szia {keresztnév}!

A második találkozásunk után érdemes összegezni, hogyan érzed most a fejbőrödet, és mit tapasztaltál az otthoni ápolás során.

Amit ma megbeszéltünk: {kezelo\_megjegyzes}.

A második alkalmon nem készítünk kötelező hajkamerás felvételt. A következő, 3. kezelésen új képet készítünk, és az első alkalom kiinduló állapotához hasonlítjuk.

Következő időpontod: {kov\_datum\_vagy\_javasolt\_idoszak}.

Üdv: {kezelo}

**Stop és QA:** Ha nincs jóváhagyott megjegyzés, csak semleges általános email; fotólink nem generálható a 2. alkalomra.

E6**Harmadik kezelés – kamerás kontroll**

INDÍTÁS: Harmadik completed + értékelés és fotók készen

**Tárgy:** Három alkalom után: a te kontrollképeid

Szia {keresztnév}!

A harmadik kezelésen elkészítettük az első összehasonlító hajkamerás felvételeidet. Itt biztonságosan megnézheted az első és a harmadik alkalom képeit: {30\_napos\_biztonsagos\_link}.

A kezelőd értékelése: {szemelyes\_2\_3\_mondat}.

Még a folyamat elején tartunk. Egyes változások már ilyenkor érezhetők lehetnek, de nem várunk kötelezően látható eredményt. A következő érdemi értékelési pont az 5–6. alkalom.

Az otthoni rutinod szükség szerinti módosítása: {otthoni\_rutin}.

{kezelo} · MOSAIC

**Stop és QA:** Fotó 1+3, konkrét személyes 2–3 mondat; csak kész dokumentáció és saját képek.

E7**Ötödik kezelés – köztes értékelés**

INDÍTÁS: Ötödik completed + értékelés és fotók készen

**Tárgy:** Öt alkalom után: hol tartunk?

Szia {keresztnév}!

Elérkeztünk az ötödik kezeléshez. Ez egy fontos köztes értékelési pont: összevetjük a kiinduló állapotot és az eddigi tapasztalataidat, de a MOSAIC ajánlott teljes kúrája 11 alkalom.

Kiinduló panaszod: {eredeti\_panasz}.
Amit most te tapasztalsz: {vendeg\_visszajelzes}.
A kezelő megfigyelése: {szemelyes\_2\_3\_mondat}.
Saját 1., 3. és 5. alkalmas képeid: {30\_napos\_biztonsagos\_link}.

A kezelővel átbeszéljük, mi indokolja a folytatást, és hogy szükséges-e módosítani a rutint. A teljes 11 kezeléses terv cél, nem eredménygarancia; szokatlan tünetnél más szakmai következő lépés is indokolt lehet.

{kezelo} · MOSAIC

**Stop és QA:** Ne állítsuk, hogy 5 alkalom egy teljes kúra. A fotók, a személyes értékelés és a kezelés sorszáma kötelező.

E8**Esedékes kontroll elmaradt**

INDÍTÁS: Személyes terv szerint esedékes kontroll elmúlt, nincs booking

**Tárgy:** Hogy vagy a legutóbbi kezelés óta?

Szia {keresztnév}!

A legutóbbi alkalmon megbeszéltük, hogy {javasolt\_ablak} körül érdemes újra találkoznunk, de még nem látok időpontot a neveden.

Lehet, hogy most nincs rá időd, vagy vannak kérdéseid a folytatásról. Ha szeretnéd egyeztetni a személyes tervedet, válaszolj erre a levélre; ha szeretnél időpontot választani, itt megteheted: {foglalas\_link}.

Üdv: {kezelo}

**Stop és QA:** Marketing opt-in; ne küldjünk az R1/R2 sorozattal ugyanazon a napon párhuzamosan.

E9**Utolsó finom visszahozás**

INDÍTÁS: E8 után +7 nap, ha még nincs booking

**Tárgy:** Egy rövid kérdés a folytatásról

Szia {keresztnév}!

Röviden jelentkezem még egyszer: hogy érzed most a fejbőrödet, és van-e kérdésed a korábban megbeszélt kezeléshez?

Ha folytatnád, itt választhatsz időpontot: {foglalas\_link}. Ha most nem szeretnéd, ezt természetesen tiszteletben tartjuk.

Köszönöm a bizalmadat!
{kezelo} · MOSAIC

**Stop és QA:** E9 után a visszahozó ág lezárul; panasz, opt-out, next\_booking → STOP.

E10**Teljes kúra személyes lezárása**

INDÍTÁS: 11. completed + kúrazáró dokumentáció kész

**Tárgy:** A te Oxygeni kúrád: személyes záróértékelés

Szia {keresztnév}!

Köszönöm, hogy velünk tartottál a teljes Oxygeni kúrán. A 11. kezelés után elkészítettem a személyes záróértékelésedet.

Kiinduló célod: {cel}.
Amit te tapasztaltál: {vendeg\_visszajelzes}.
A kezelő által dokumentált változások: {kezelo\_vegso\_ertekeles}.
Az 1., 3., 5. és 10. kezelés hajkamerás összehasonlításai: {30\_napos\_biztonsagos\_link}.
Nyomtatható A5 kúrazáró dokumentumod: {biztonsagos\_a5\_zaras\_link}.

A további otthoni rutin: {egyeni\_otthoni\_rutin}. Ha fenntartó kezelés indokolt, annak javasolt időpontja: {egyeni\_fenntartas}; ha nem indokolt, nincs automatikus új kúraértékesítés.

Ha romló vagy szokatlan tüneted jelentkezik, kérj megfelelő szakmai/orvosi segítséget.

Üdvözlettel: {kezelo} · MOSAIC

**Stop és QA:** A teljes 11 kezelés sorszám igazolt; kép 11-en nem szükséges, a korábbi 1/3/5/10 képeket összevetjük.

B30**Bérletlejárat – e-mail**

INDÍTÁS: Lejárat előtt 30 nappal, unused\_appointments > 0

**Tárgy:** Még van felhasználható Oxygeni alkalmod

Szia {keresztnév}!

A {tipus} Oxygeni bérleted {lejarat\_datum}-án lejár, és jelenleg {maradek\_alkalom} felhasználható alkalom van rajta.

Ha szeretnéd felhasználni, itt tudsz megfelelő időpontot foglalni: {foglalas\_link}. Elég a lejárat előtt lefoglalni a kezelést, a kezelés időpontja később is lehet.

Kérdés esetén segítünk!
MOSAIC

**Stop és QA:** Ne menjen, ha a hátralévő alkalmak mind már lefoglaltak vagy nincsenek; csak érvényes adatok.

B7**Bérletlejárat – SMS**

INDÍTÁS: Lejárat előtt 7 nappal, még marad fel nem használt alkalom

**Tárgy:** SMS

Szia {keresztnév}! Oxygeni bérleted {lejarat\_datum}-án lejár, {maradek\_alkalom} alkalom maradt rajta. A lejárat előtt lefoglalt kezelés később is lehet: {foglalas\_link}. MOSAIC

**Stop és QA:** Csak akkor, ha releváns; nem emlegetünk jogvesztést már lefoglalt alkalmaknál.

### Panaszkezelési automatizmus – kezelői és vezetői feladat

- Belső elégedettség **1–3 pont** vagy negatív szöveges komment → **Janka értesítést kap**, de nem ő végzi a megkeresést.
- Az érintett kezelő 24 órán belül, lehetőleg telefonon megkeresi a vendéget. Két telefonhívás után személyes e-mailt küld; minden próbálkozás naplózott.
- A kezelő kezeli és dokumentálja a panaszt; bármilyen pénzügyi kompenzációhoz szalonvezetői jóváhagyás szükséges.
- Ha a vendég továbbra is elégedetlen, a panasz nyitva marad. A lezárás csak a rendezés dokumentálása után engedélyezhető.
- Nyitott panasz alatt a bérletértékesítés, rebooking és egyéb marketingüzenet szünetel. A valóban szükséges időpont- és biztonsági tájékoztatás marad.
- A Google-értékeléskérés mindenkinek, elégedettségi ponttól függetlenül megmarad; nincs review-gating.
- Lezárás után a hiányzó üzeneteket nem torlasztjuk fel, hanem az aktuális vendégállapot alapján kezdjük újra a megfelelő marketingágat.

### Belső operatív riasztások

D24**Hiányzó kezelői dokumentáció**

INDÍTÁS: Completed +24h, nincs végleges A5 terv / kötelező kontrollmező

**Tárgy:** Hiányzó Oxygeni dokumentáció – {guest\_id}

Szia {kezelo}!

A {datum}-i, {guest\_id} azonosítójú Oxygeni kezelés dokumentációja még nem teljes. Kérjük, fejezd be a digitális űrlapot és a szükséges személyes értékelést.

A vendégnek a személyes dokumentumot csak a hiányzó mezők pótlása után küldjük ki.

MOSAIC belső rendszer

**Stop és QA:** Belső címzett, csak szükséges vendégazonosító; ne legyen érzékeny képadat az e-mailben.

D48**Hiányzó dokumentáció – szakmai vezetőnek**

INDÍTÁS: Completed +48h, még mindig hiányzik

**Tárgy:** Eskaláció: 48 órája hiányzik Oxygeni dokumentáció

Szia Janka!

Egy Oxygeni kezelés dokumentációja 48 órával a kezelés teljesítése után sem készült el: {kezelo}, {datum}, {booking\_id}.

Kérjük, ellenőrizd az ügyet a belső rendszerben, és gondoskodj a dokumentáció lezárásáról.

MOSAIC belső rendszer

**Stop és QA:** Janka szakmai vezető belső szerepkör; email ne tartalmazzon kezelési tünetet.

07 / SZALONPROTOKOLL

# Kezelő + recepció, konkrét lépésről lépésre

A személyes meggyőzés a dokumentált megfigyelésből indul ki. A vendég szabadon dönt a foglalásról és bérletvásárlásról.

### Kezelő SOP – az első alkalom menete

| Mikor | Kezelő feladata | Eredmény a rendszerben |
| --- | --- | --- |
| Érkezés előtt | Digitális állapotfelmérő, kontraindikáció, előzetes egyeztetés. | assessment reviewed; biztonsági stop szükség esetén. |
| Első 80 perc | Beszélgetés, kiinduló hajkamera, személyre szabott Oxygeni kezelés. | Tényleges completion csak a kezelés végén. |
| Kezelés lezárása | Hajkamera-megfigyelések, cél, otthoni rutin, javasolt 11 kezeléses program, 2 hetes kiinduló ritmus. | Digitális A5 terv kitöltése max. 24h; személyes dokumentum email. |
| Következő időpont | A kezelő ajánlja fel és maga foglalja a Salonicban. | next booking ID vagy „nem foglalt” + pontos ok. |
| Bérletajánlat | A 10-es bérlet elsődleges; 5-ös kezdő opció bizonytalanoknak. Nincs eredményígéret. | Ajánlat rögzítése; vásárlás után recepció átveszi. |
| Recepciós lezárás | 29 900 Ft első kezelés beszedése; esetleges 4 990 Ft beszámítás kézi ellenőrzése. | Bevétel, felhasznált credit, bérlet és ajándék naplózva. |
| Bérlet adása | Recepció megkapja a kezelő ajánlását, egy összegben fizettet és átadja a termékeket. | A 10-es/5-ös bérlet érvényessége és fennmaradó alkalmai követhetők. |

### 3 perces kezelői script – szó szerint

| Idő | Mit mondjon a kezelő? |
| --- | --- |
| 0:00–0:30 | „Most megmutatom, mit láttunk a fejbőrödről az első hajkamerás képen. Ezt rögzítjük, hogy később legyen mihez viszonyítanunk.” |
| 0:30–1:00 | „A teljes Oxygeni-kúra nálunk 11 kezelésből áll, általában kéthetente szoktunk találkozni. Nem ígérek előre konkrét hajnövekedést: 5–6 alkalom után már érdemben át tudjuk nézni a változásokat.” |
| 1:00–1:30 | „A személyes A5 kúratervedbe leírom, milyen panasszal érkeztél, mit figyelünk, és milyen otthoni ápolást ajánlok. Ugyanezt e-mailben is megkapod.” |
| 1:30–2:15 | „A következő alkalmat nagyjából két hét múlva javaslom. Megnézzük, melyik időpont lenne megfelelő? Itt a Salonicban rögtön le tudom foglalni neked.” |
| 2:15–3:00 | „A teljes folytatáshoz a 10 alkalmas bérletet szoktuk ajánlani: 260 000 Ft, 1 liter samponnal és 1 liter balzsammal. Ha még bizonytalan vagy, az 5 alkalmas kezdő csomag 130 000 Ft, 1 liter samponnal. Ma vagy az első kezelés előtt vásárolva plusz kis kiszerelésű Oxygeni termék jár. Bérletet nem kötelező venni, a további kezelések alkalmanként 26 000 Ft-ba kerülnek.” |

**Ha nem akar következő időpontot:** „Rendben. Akkor jelöljük, körülbelül mikor lenne indokolt találkoznunk. Ha szeretnéd, és hozzájárulsz, e-mailben vagy SMS-ben segítünk időpontot választani.” Nem szabad foglalásra kényszeríteni.

**Ha panaszt vagy szokatlan reakciót jelez:** a kezelő ellenőrzi, szükséges-e a kezelés felfüggesztése/orvosi továbbirányítás. Nyitott panasz esetén az értékesítési és visszafoglalási üzeneteket letiltja; a szalonvezető dönt a pénzügyi jóvátételről.

### A5 kúraterv – nyomtatandó lap tartalmi specifikáció

**Az általános 8 oldalas brosúra megszűnt.** Egy személyre szabott, A5 álló formátumú kezelési lap készül a digitális űrlapból. A nyomtatott és digitális változat tartalma megegyezik; a kezelő neve és a valódi következő időpont kiemelt mező. A zárókezelésnél külön A5 záróösszefoglaló készül.

| Rész | A5 kötelező adat és elrendezés |
| --- | --- |
| Fejléc | MOSAIC + Oxygeni; „A TE SZEMÉLYES KÚRATERVED”; vendég neve, kezelő neve, első kezelés dátuma. |
| Kiinduló állapot | Fő panasz és 2–3 szakmai megfigyelés; ha van képrészlet, az A5-ben csak biztonságosan kezelt, privát kiadvány része. |
| Kezelési cél | Személyes cél; ajánlott teljes 11 alkalmas keret és a kezelő által módosítható, kétheti ritmus. |
| Állapotkövetés | 1/3/5/10: hajkamera; 5–6: köztes értékelés; 11: záróösszefoglaló. |
| Otthoni rutin | Kezelő konkrét termék/használati javaslata; erős ajánlás, nem kötelező termékvásárlás. |
| Következő időpont | Dátum, idő, kezelő; ha nincs foglalás, a javasolt időszak és a foglalási lehetőség. |
| Kapcsolat | 1023 Budapest, Bécsi út 2. / 06 20 247 4444. |
| Nyomdai paraméterek | A5 álló 148×210 mm, 3 mm kifutó, legalább 5 mm belső biztonsági zóna; jól olvasható méret, nyomtatott PDF/A5. |

### Kúrazáró A5 – a 11. kezelés után

- A 11. kezelés igazolt teljesítése, dátum, kezelő neve.
- Kiinduló panasz, személyes cél, eredeti állapot és a vendég szubjektív tapasztalata.
- Az 1., 3., 5. és 10. kezelés összehasonlítható hajkamerás felvételei privát linken (a nyomtatott összefoglaló ezekre hivatkozhat).
- Kezelői, tényszerű záróértékelés: mi figyelhető meg és mi nem; nem diagnózis, nem garantált javulás.
- Személyre szabott további otthoni rutin; fenntartó kezelés csak akkor, ha a kezelő külön indokolja.
- A5 PDF és e-mail a vendégnek, a dokumentáció határidő- és jogosultsági szabályainak megfelelően.

08 / MÉRÉS

# KPI-definíciók, dashboard és döntési küszöbök

A valós cél a bevételt termelő, megjelenő és visszatérő vendég, nem a CTA-kattintások mennyisége.

| Mutató | Pontos számítás / értelmezés |
| --- | --- |
| Booking1 | Első hajkezelést lefoglaló egyedi vendég; külön camera-only foglaló. |
| SHOW1 | Ténylegesen teljesített első kezelés / első kezelésre esedékes egyedi foglalók. Lemondás/no-show külön. |
| R2 | Az adott első kezelési kohorsz vendégei közül legalább két tényleges kezelésre megjelentek aránya, érett megfigyelési ablakban. |
| R3 / R5 / R10 / R11 | A teljesített kezelésszámra eljutó kohorsz-vendégek aránya. A részprogram és a szakmai okból zárt esetek külön jelölendők. |
| A5 terv elkészülési idő | Első completed vagy kontroll completed után 24 órán belüli lezárás aránya; +24/48 riasztás gyakorisága. |
| Azonnali következő foglalás | Minden completed kezelés után az elvégző kezelő által még a helyszínen létrehozott aktív következő booking / érintett completed alkalmak. |
| Bérletkonverzió | Első completed vendégek közül 10-es és 5-ös bérletvásárlók külön; egyszerre csak személyesen. |
| Bérletbevétel / termék-ajándék költség | Bruttó pénzbevétel és ajándéktermék tényleges önköltsége külön; a bérlet nem kezelésenként olcsóbb. |
| Avg sessions / guest | Összes tényleges, fizetett vagy bérlettel fedezett completed hajkezelés / egyedi first-show vendég. |
| CAC / SHOW1; CAC / R5 | Csatornából attribuált marketingköltés / valódi, megfelelő kohorszból számított eredmény. |
| Panasz, képsérülés és téves üzenet | Biztonsági KPI: negatív reakciók, hibás képkiküldés, hamis completed, opt-out sértés, bérletfogyás hiba. |
| SEO/DSA guardrail | Organikus releváns kattintás/URL, DSA-ról érkező foglalás/konverzió, kampányminőség az élesítés előtt és után. |

### Baseline értelmezés

A korábbi PLAN-D alapján 2026 szeptemberében 16 új foglalás és körülbelül 11 358 Ft attribuált CPA, az előző 12 hónapban 223 booking és körülbelül 9 093 Ft CPA szerepelt. Ezek **booking adatok**, nem valós SHOW1, R2/R5 vagy 11 kezeléses megtartási értékek. A két Salonic-fiók közös, megjelent vendégek szerinti exportja és a cancellation/no-show export összevetése szükséges a mérési baseline előállításához. Nem becsülünk nem létező retenciót.

### Dashboard elvárt szűrői

- Dátum: első completed szerinti kohorsz, ne csak foglalás létrehozási ideje.
- Szolgáltatás: első haj / további haj / csak kamera; legacy kombinált kezelés külön, a kivezetés lezárásáig.
- Szegmens: hajhullás, gyors zsírosodás, korpás/érzékeny fejbőr, vékony haj, vegyes.
- Kezelő: első és jelenlegi kezelő; szabad kezelőváltás miatt a szerepek külön jelenjenek meg.
- Bérlet: 5-ös / 10-es / csak alkalmankénti fizetés; ajándékátadás és lejárat.
- Forrás: Google Ads / Meta / TikTok / organikus / direkt / egyéb; bizonytalan attribúció külön.
- Funnel: booking\_start → valid booking → completed → R2 → R5 → R10 → R11 → kúrazárás.
- Panasz, önkéntes leiratkozás, biztonsági leállás és adatkezelési kérelmek önálló kontrollpanel.

09 / QA ÉS ÉLESÍTÉS

# A fejlesztő ellenőrzőlistája

Az oldal a jelenlegi URL-en egyszerre élesedik, csak sikeres teljes körű QA és tulajdonosi GO után; nincs tervbe vett régi verziós visszaállítás.

| # | QA eset | Elvárt eredmény |
| --- | --- | --- |
| 1 | First-treatment foglalás | 29 900 Ft, 80 perc, korrekt kezelő, helyes Salonic booking UUID. |
| 2 | Kamera-only foglalás | 4 990 Ft, 30 perc, 80 perces kezelés-szöveg és eredmény nélkül. |
| 3 | Két CTA | Hero fő és másodlagos gomb pontosan az oldalon belüli bookinghoz görget, előtöltött szolgáltatással. |
| 4 | Négylépéses foglalás | A már meglévő MOSAIC négy lépés marad; negyedikben élő, valódi Salonic időpontok. |
| 5 | Kezelő-szűrő | Minden kezelő időpontja alapból látszik; kedvenc/konkrét szakemberre szűrés működik. |
| 6 | Helyszíni fizetés | Egyedi first/next/camera online előrefizetést nem kér; a Salonicban helyes összeg. |
| 7 | T0 és 72/24 emlékeztető | Aktív státusz, időzóna és valós booking; reschedule után régi időpontra 0 üzenet. |
| 8 | Állapotfelmérő | T0 biztonságos link, T–24 hiánynál emlékeztető; ellenjavallat kezelői alert. |
| 9 | Completed igazolás | Nem indul utóüzenet csupán a naptári időpont lejártától. |
| 10 | Első és 2. kezelés képlogika | 1. készít, 2. nem készít kötelező kameraképet; nincs hamis képpár. |
| 11 | 3/5/10 kamerakontroll | Az adott vendég 1/3/5/10 képei és jóváhagyott kezelői megjegyzése helyes. |
| 12 | 11. kúrazárás | A5 összefoglaló és fenntartási ajánlás; nem állít új 11. kamerafelvételt. |
| 13 | Fotó és token | Más vendég képe nem kérhető le; link +30 napon túl lejár; új link csak e-mail-ellenőrzéssel. |
| 14 | Két Salonic-fiók | Stabil guest\_key, ellenőrzött e-mail+telefon, bizonytalan eset kezelői manuális merge; nincs vendégösszecsúszás. |
| 15 | Bérlet admin | 10-es 260 000 + ajándék 1l+1l; 5-ös 130 000 + 1l; két 5-ös = két sampon. |
| 16 | Bérlet leírás | 11 kezelés = 1+10, 5-ös nem teljes kúra, 289 900 Ft teljes ár; nulla fiktív kedvezmény. |
| 17 | Első napi extra ajándék | Első kezelés ELŐTT vagy aznap vásárolt bérletnél készletfüggő kiszerelésű plusz ajándék. |
| 18 | Kamera díj beszámítása | 30 napon belüli first booking; áthelyezés megőrzi, teljes lemondás megszünteti; kézi + booking ID naplózás. |
| 19 | 48 órás lemondás | Késő lemondás és no-show után nincs büntetődíj, nincs levont bérletalkalom. |
| 20 | No-show és lemondás ág | No-show +1 nap SMS, cancelled +24h email/+3 nap SMS, feltételek és marketing-opt-in. |
| 21 | Következő foglalás hiánya | Completed után +48h email/+5 nap SMS; új booking azonnal stop. |
| 22 | Belső elégedettség és Google | Első completed +3h survey / +24h Google; 1–3 negatív panasz Janka értesítés, nincs review gating. |
| 23 | Panasz és opt-out | Nyitott panasz minden sales/rebook ágban STOP, tranzakciós üzenet marad; később nincs üzenettorlódás. |
| 24 | Dokumentáció 24/48 | A5 és megjegyzés csak kész állapotban; +24h kezelő, +48h Janka. |
| 25 | Lejáró bérlet | 5-ös 6m, 10-es 12m; +30d email és +7d SMS a lejárat előtt, ha maradt nem lefoglalt alkalom. |
| 26 | Lejárat utáni módosítás | Lejárat előtt booked → későbbi kezelés oké; lejárat után legfeljebb 1 módosítás és az eredetitől +30 nap. |
| 27 | Kombinált arc+haj kivezetése | Új booking 0, új landing 0; korábbi aktív foglalások teljesíthetők. |
| 28 | Szöveges claims | Nincs kockázatmentes, garantált babyhair, kitalált százalék, hamis gyártói ígéret; 2m/95% attribuálva. |
| 29 | SEO/DSA baseline | A régi oldal SEO és DSA által generált forgalma és konverziói dokumentálva a váltás előtt. |
| 30 | Mérési rendszerek | GA4 / Google Ads / Meta / TikTok test booking, cancel, duplication és 0 téves konverzió. |
| 31 | Mobil / desktop / böngészők | 390×844, tablet, 1440, valódi mobil görgetés és megfelelő CTA viselkedés. |
| 32 | Hozzájárulás | Marketingopt-in nem előre bepipált, önkéntes, csatornánként és timestamp alapján visszavonható. |
| 33 | Képmarketing consent | Kezelői/kameraképek marketingcélra külön kifejezett consent nélkül nem jelennek meg. |
| 34 | Visszatérő kezelő preferencia | Előző kezelő javasolt, de minden szakemberre lehet váltani. |
| 35 | Élesítési döntés | Fejlesztő QA PASS, tulajdonos GO, egyszeri csere az eredeti URL-en. |
| 36 | Élesítés utáni 72h | Fejlesztő technika, marketing foglalás+mérés, kritikus hiba azonnali jelzés és az új oldal javítása. |

### Kötelező 72 órás megfigyelés élesítés után

A fejlesztő ellenőrzi az API- és foglalási hibákat, a token-hozzáférést, az űrlapokat és a kliensoldali működést. A marketingfelelős ellenőrzi a tényleges Salonic-foglalásokat, a konverziós eseményeket, a csatornaattribúciót, a DSA/SEO organikus és fizetett útvonalakat. Kritikus hiba esetén az új oldalon kell javítani; a tulajdonos döntése szerint a régi landinget nem állítjuk vissza. A foglalónak a teljes QA keretében már élesítés előtt működnie kell.

### Fejlesztési sorrend – megvalósítható munkacsomagok

| Ütem | Feladat és felelős | Átvételi kritérium |
| --- | --- | --- |
| 0–15 nap | Fejlesztő + marketing: a régi URL mérése, DSA, Salonic 2 fiók exportjai; új oldal és 4 lépéses booking ellenőrzése. | Baseline riport; a tervezett 36 QA-eset összeállítva. |
| 0–15 nap | Kezelő + recepció: 3 perces script, 10-es fő ajánlat, kézi első időpont/credit, bérletajándék rögzítése. | Első 10 éles kezelési próba dokumentáltan. |
| 15–30 nap | Fejlesztő: digitális felmérő, kontraindikáció alert, közös CRM, completed trigger, T0/T72/T24. | Tényleges booking + completed 1:1 és 0 dupla. |
| 30–45 nap | Fejlesztő + grafikus: A5 személyes lap generálás, e-mail, kamera 1/3/5/10 + 30 napos link. | Tesztvendégnél valós, védett dokumentum, no leakage. |
| 30–60 nap | Marketing: R/C/N/A utókövetés, E2–E10, survey és Google, bérlet stop ágak. | Opt-in/logikai és QA negatív esetek mind PASS. |
| 60–90 nap | Tulajdonos + marketing: induló kohorsz SHOW1/R2/R5/R10/R11 és CAC elemzés, landing teljes QA után egyidejű élesítés. | Sikeres QA, tulajdonosi jóváhagyás, 72h monitoring. |

10 / DÖNTÉSNAPLÓ

# A 121 jóváhagyott üzleti döntés

A sorrend megfelel a felhasználó által a beszélgetésben egyenként jóváhagyott 1–121. döntésnek. Későbbi válasz felülírja a korábbi, vele ellentétes előzetes opciót.

### 001–020. döntés

| # | Végleges szabály |
| --- | --- |
| 1 | Az első hajoxigénterápiás kezelés állapotfelméréssel együtt 80 perc. |
| 2 | Az első kezelés 29 900 Ft; a másodiktól az egyedi kezelés 26 000 Ft. |
| 3 | Az 5/10 alkalmas bérlet az első kezelésen FELÜLI 5/10 kezelésre szól. |
| 4 | Első napi bérletvásárláskor külön extra termékajándék jár. |
| 5 | Mindkét bérletnél a plusz ajándék egy kis kiszerelésű Oxygeni termék; konkrét SKU nem kötött. |
| 6 | A 4 990 Ft-os hajkamerás felmérés teljes díja beszámít az első kezelésbe. |
| 7 | A MOSAIC hivatalos Oxygeni partnerszalon. |
| 8 | Minden oxigénterápiás kezelő elvégezte az Oxygeni szakmai képzését. |
| 9 | A kezelés ELŐTT 24 órával nem javasolt hajat mosni; vendégutasításként szerepel. |
| 10 | A kezelés UTÁN nincs általános hajmosási korlátozás. |
| 11 | Hajfestés/szőkítés esetén a kezelő egyéni útmutatása az irányadó. |
| 12 | Készül hajkamerás kép, de jelenleg nincs egységes tárolás; ez változik. |
| 13 | Egységes, vendégenként visszakereshető képtárolás lesz, csak kijelölt kontrollokon. |
| 14 | Kontroll után automatikus biztonságos linkkel jut el az összehasonlítás a vendéghez. |
| 15 | Hajkamerás fotó az 1., 3., 5. és 10. kezelésen készül. |
| 16 | A képek mellé 2–3 mondatos személyes kezelői értékelés jár. |
| 17 | Az értékelést a kezelő írja, a rendszer kész dokumentáció után automatikusan kiküldi. |
| 18 | A kezelési ritmus alapértelmezetten kéthetente egyszer, egyéni eltérés lehetséges. |
| 19 | Korai ajánlás 5–10 alkalom; a későbbi 26–27. döntés felülírja: teljes kúra 11. |
| 20 | Az első alkalom végén kötelező felajánlani a második időpont lefoglalását. |

### 021–040. döntés

| # | Végleges szabály |
| --- | --- |
| 21 | A kezelő ajánlja fel és a Salonicban maga foglalja a következő időpontot. |
| 22 | Ha nincs következő foglalás: +48 óra e-mail, +5 nap SMS; foglaláskor STOP. |
| 23 | A személyes kúraterv nyomtatott A5-ben és e-mailben is jár. |
| 24 | A kezelő egyszer digitális űrlapot tölt ki; ebből A5 PDF és e-mail készül. |
| 25 | A kúraterv részletes: panasz, képmegfigyelés, cél, alkalmak, ritmus, következő időpont, otthoni rutin, ajánlás, kezelő. |
| 26 | Mindig a 10 alkalmas bérlet az elsődleges ajánlat; az 5-ös tesztelési/belépő opció. |
| 27 | A teljes kúra: az első kezelés és a 10 alkalmas bérlet, összesen 11 kezelés. |
| 28 | Nincs külön bérletbővítési konstrukció: két 5-ös bérlet ára ugyanannyi, mint egy 10-esé. |
| 29 | Két külön 5-ös bérlet esetén mindkettőhöz 1-1 liter sampon jár. |
| 30 | Időpont a kezelés előtt legkésőbb 48 órával mondható le/módosítható. |
| 31 | Késő lemondás/no-show esetén nincs pénzügyi szankció, nincs bérletlevonás. |
| 32 | Aktív foglalásra 72 órával e-mail és 24 órával SMS emlékeztető jár. |
| 33 | Igazolt no-show esetén másnap kedves SMS megy, ha nincs új foglalás. |
| 34 | Lemondás után +24 óra e-mail, +3 nap SMS, ha nincs új foglalás. |
| 35 | Minden kezelés végén a kezelő felajánlja és lehetőleg lefoglalja a következőt. |
| 36 | Teljes kúra után a fenntartást a kezelő egyedileg határozza meg. |
| 37 | 11. kezelésnél részletes kúrazáró összehasonlítás, értékelés, fenntartási terv A5 PDF-ben és e-mailben. |
| 38 | A 2 millió kezelés/95%-os hatásosság hivatalos gyártói forrásból származik; csak pontosan attribuálva használható. |
| 39 | Egyes vendégek 1–2 alkalom után érezhetnek változást; érdemi értékelés 5–6 körül; teljes kúra 11. |
| 40 | Személyre szabott otthoni Oxygeni ápolást erősen ajánljuk, de nem kötelező. |

### 041–060. döntés

| # | Végleges szabály |
| --- | --- |
| 41 | Az otthoni Oxygeni termékek kizárólag személyesen, a szalonban vásárolhatók. |
| 42 | Első kezeléskor termékajánlás; felülvizsgálat a 3., 5. és 10. alkalmon. |
| 43 | Nem készül külön 8 oldalas A5 füzet; a személyes A5 kúraterv elegendő. |
| 44 | 5-ös bérlet 6 hónapig, 10-es bérlet 12 hónapig érvényes vásárlástól. |
| 45 | Indokolt esetben a szalonvezető egyedileg hosszabbíthat; nem automatikus. |
| 46 | A bérlet személyhez kötött, nem átruházható. |
| 47 | A bérlet főszabály szerint nem váltható vissza, törvényes jogok fenntartásával. |
| 48 | Szakmai okból megszakított kúra visszatérítését szalonvezető egyedileg bírálja el. |
| 49 | Minden új vendég digitális állapotfelmérőt tölt ki; kezelő ellenőrzi, később változásokra rákérdez. |
| 50 | Kérdőív a foglalással azonnal; hiánynál T-24 emlékeztető; szükség esetén helyben kitölthető. |
| 51 | Az állapotfelmérő az Oxygeni szakmai protokolljára épülő, MOSAIC-ra szabott digitális kérdőív. |
| 52 | Ellenjavallati jelzésről a kezelő automatikus értesítést kap és előzetesen egyeztethet. |
| 53 | Salonic-foglalásokkal összekapcsolt, külön biztonságos közös vendégnyilvántartás lesz. |
| 54 | Minden jogosult oxigénterápiás kezelő hozzáférhet minden Oxygeni vendég kezelési dokumentációjához. |
| 55 | Hajkamerás képek marketingfelhasználása csak külön, kifejezett hozzájárulással. |
| 56 | Célzott adatmegőrzés: utolsó kezelés +36 hónap, a jogi megőrzési szabályokkal összhangban. |
| 57 | Nem épül vendégportál a hajkamerás képekhez. |
| 58 | A vendég képlinkje 30 napig él; ezután új link kérhető. |
| 59 | Új 30 napos link automatán kérhető az e-mail-cím biztonságos ellenőrzésével. |
| 60 | Utókezelési automatizmus csak valóban megtörtént, Salonicban igazolt kezelés alapján indul. |

### 061–080. döntés

| # | Végleges szabály |
| --- | --- |
| 61 | A kezelő minden kezelés végén igazolja a teljesítést. |
| 62 | A két Salonic-fiók egyetlen közös vendégelőzményhez és kommunikációs folyamathoz kapcsolódik. |
| 63 | Ellenőrzött e-mail ÉS telefonszám egyezésnél auto-összevonás; bizonytalan eset kézi jóváhagyás. |
| 64 | Bizonytalan vendégprofil-egyezést az érintett kezelő ellenőrzi és hagyja jóvá, naplózva. |
| 65 | Általános üzenet időben kimehet; személyes kúraterv/kép csak teljes dokumentációval; kezelő figyelmeztetése. |
| 66 | Kötelező dokumentáció legfeljebb 24 órán belül elkészül. |
| 67 | Hiányzó dokumentációnál +24h kezelői figyelmeztetés, +48h szakmai vezető értesítés. |
| 68 | Csak 4 990 Ft-os kamera-vendégnek külön értékelés, +48h e-mail és +5d SMS, ha nincs első kezelés. |
| 69 | A 4 990 Ft díjbeszámítási jogosultság 30 napig szerezhető meg. |
| 70 | Elég 30 napon belül FOGLALNI az első kezelést, annak időpontja később lehet. |
| 71 | Az első kezelés időpont-áthelyezésekor beszámítás marad; teljes lemondásnál megszűnik. |
| 72 | A 4 990 Ft beszámítása manuális recepciós/kezelői ellenőrzéssel és levonással történik. |
| 73 | A felhasználást közös vendégnyilvántartásban, dátummal és foglalásazonosítóval rögzítik. |
| 74 | 5-ös/10-es bérlet teljes árát egy összegben előre kell fizetni. |
| 75 | Ajándékok a teljes bérletár kifizetésekor azonnal átadandók. |
| 76 | Bérlet kizárólag személyesen a MOSAIC szalonban vásárolható. |
| 77 | A weboldalon teljes kúra, mindkét bérlet és áruk szerepel; első CTA a 29 900 Ft-os kezelés. |
| 78 | Hero másodlagos CTA a 4 990 Ft-os hajkamerás felmérésre már első képernyőn. |
| 79 | A foglalás a landing oldalon, előtöltött szolgáltatással, saját négylépéses útvonalon élő Salonic-naptárral történik. |
| 80 | Hero CTA oldalon belüli foglalóblokkhoz görget, nincs popup/külön oldal. |

### 081–100. döntés

| # | Végleges szabály |
| --- | --- |
| 81 | Alapértelmezetten minden kezelő időpontja látható; konkrét kezelőre lehet szűrni. |
| 82 | Visszatérő vendégnél alapból korábbi kezelő ajánlott; szabad kezelőváltás lehetséges. |
| 83 | A kombinált arc+haj kezelés nem szerepel az új Oxygeni hajlandingen. |
| 84 | A kombinált arc+haj kezelés értékesítése teljesen megszűnik. |
| 85 | A kombinált kezelés új foglalásainak fogadása azonnal leállítandó. |
| 86 | A már visszaigazolt kombinált foglalásokat eredeti feltételekkel teljesítjük. |
| 87 | Az első igazoltan teljesített kezelés +24h Google-értékeléskérés, minden vendégnek. |
| 88 | Belső 1–5 pontos elégedettségmérés, opcionális komment, kezelőnkénti riport. |
| 89 | Belső elégedettség e-mail +3h; Google-kérés külön +24h az első kezelés után. |
| 90 | 1–3 pont vagy negatív szöveg esetén Janka értesítést kap. |
| 91 | Panaszos vendég megkeresése 24 órán belül; a későbbi 92–93. döntés alapján az érintett kezelő végzi. |
| 92 | Nem Janka, hanem az adott kezelő felel a panaszkezelésért. |
| 93 | Pénzügyi kompenzációhoz mindig szalonvezetői jóváhagyás kell. |
| 94 | Két telefonhívás, majd személyes e-mail; minden próbálkozás dokumentált. |
| 95 | Nyitott panasz alatt értékesítési és visszafoglalási üzenetek STOP; tranzakciós időpontinfó marad. |
| 96 | A kezelő dokumentálja a megoldást; fennálló elégedetlenségnél a panasz nyitva marad. |
| 97 | Panasz lezárása után csak aktuális, releváns üzenetek mennek; kimaradtak nem pótlandók. |
| 98 | Bérletvásárlást munkatárs rögzíti; Salonic-CRM kapcsolat automatikusan követi a megtörtént és fennmaradó alkalmakat. |
| 99 | Bérlet lejárata előtt T-30 nap e-mail és T-7 nap SMS, ha maradt alkalom. |
| 100 | A bérlet lejárata előtt elég időpontot foglalni; a kezelés a lejárat után is lehet. |

### 101–120. döntés

| # | Végleges szabály |
| --- | --- |
| 101 | Lejárat utáni áthelyezésnél a foglalt alkalom marad, teljes lemondásnál elvész. |
| 102 | Lejárt bérlethez kapcsolódó foglalás legfeljebb egyszer módosítható. |
| 103 | Az egyszeri lejárat utáni módosítás az eredeti időponthoz képest legfeljebb +30 nap. |
| 104 | Külön hajkamerás állapotfelmérés 30 perc. |
| 105 | A 4 990 Ft-os felmérést a szalonban, helyben fizetik. |
| 106 | A 29 900 Ft-os első kezelést a szalonban, a kezelés után fizetik. |
| 107 | A 26 000 Ft-os további egyedi alkalmakat a kezelés után helyben fizetik. |
| 108 | A kezelő ajánlja a bérletet; a recepció intézi fizetést, nyilvántartást és ajándékátadást. |
| 109 | 10 alkalmas bérlet ajándéka 1 liter Oxygeni sampon és 1 liter balzsam. |
| 110 | Bérlet az első kezelés és a hajkamerás állapotfelmérés előtt is vásárolható személyesen. |
| 111 | Ha semmilyen kezelés nem történt és ellenjavallat miatt a kúra nem kezdhető meg, teljes bérletár visszajár. |
| 112 | Teljes refund esetén bontatlan ajándékot visszakérünk; felbontott ajándék értékével a refundot nem csökkentjük. |
| 113 | Extra kis kiszerelésű ajándék jár az első kezelés előtt VAGY az első kezelés napján bérletet vásárlóknak. |
| 114 | A már megtervezett MOSAIC négylépéses foglalási rendszert használjuk Oxygenire szabva; nem tervezünk új lépéseket. |
| 115 | A teljes új landing egyetlen élesítéssel kerül a jelenlegi URL-re. |
| 116 | Élesítés előtt teljes QA: desktop/mobil, valós Salonic-foglalás, GA4/Google Ads/Meta/TikTok, SEO/DSA. |
| 117 | Fejlesztő igazolja a QA-t; tulajdonos adja meg az élesítési engedélyt. |
| 118 | Első 72 órában fejlesztő technikai, marketing foglalási/mérési felügyelet; azonnali incidensjelzés. |
| 119 | A régi landinget nem állítjuk vissza, hibánál az új verziót javítjuk. |
| 120 | A foglalónak működőképesen kell élesednie; nem tervezünk külön vészhelyzeti foglalási útvonalat. |

### 121–121. döntés

| # | Végleges szabály |
| --- | --- |
| 121 | Foglaláskor külön, opcionális marketinghozzájárulás a visszafoglaló/bérletajánló üzenetekhez. |

**Üzleti döntések lezárva:** a 121 döntési pont közül nincs feloldatlan. Ami az élesítéskor még tényszerű ellenőrzést igényel (például a gyártói 95% pontos definíciója, az adatok jogszerű megőrzése, a Salonic API valós lehetőségei, a marketinghozzájárulások jogi szövege, a tényleges SEO/DSA baseline), az **implementációs vagy jogi QA**, nem újabb tulajdonosi választási kérdés.

11 / FORRÁSOK ÉS KONTROLL

# A kész dokumentum forrásai és alkalmazási szabályai

A végleges üzleti szabályokat a 121 tulajdonosi válasz alapján rögzítettük. A külső források állításait ettől elkülönítve kezeljük.

- **Elsődleges vállalkozói forrás:** a jelen beszélgetésben 1–121. sorszámmal adott döntések (2026. október 9.).
- **Alapdokumentum:** MOSAIC\_Oxigen\_PlanD\_EGYESITETT\_MESTERANYAG.pdf, 64 oldal, 2026.10.09.
- **Összehasonlított anyag:** Mosaic\_Oxigenterapia\_kura-rendszer\_v3.pdf, 32 oldal; MOSAIC\_Oxigenterapia\_PlanD\_60\_oldalas\_kezikonyv.pdf, 60 oldal.
- **Élő szolgáltatási oldalak a forrásanyagban:** https://www.mosaicheadspa.hu/oxigenterapia-budapest és https://www.mosaicheadspa.hu/arlista.
- **Oxygeni partneranyag:** a projekthez korábban megadott gyártói oktatási összefoglaló, alapítói podcast/beszélgetés és PLAN-D playbook.
- **Forráskorlát:** a gyártói 2 millió / 95% marketingadat pontos definícióját az eredeti gyártói forrásban kell az élesítés előtti claims-QA során dokumentálni. Orvosi eredményként nem állítható automatikusan.
- **Megvalósítási kontroll:** a jelen dokumentum nem üzemeltető jogi tanács; a GDPR, egészségi adatok kezelése, ÁSZF fogyasztóvédelem, esetleges kommunikációs hozzájárulások és Szalon/Salonic integráció jogi-technikai ellenőrzése kötelező az élesítés részeként.

## Végső, egységes MOSAIC működés

Egy teljes, 11 alkalmas Oxygeni-program; valós első foglalás és megjelenés; az első napon személyes kúraterv, következő időpont és transzparens bérletajánlat; a 3., 5. és 10. alkalom képileg is dokumentált követése; a 11. alkalom záróértékelése; kezelői felelősségre és pontos consent-szabályokra épülő automatizáció.

**Nem maradt nyitott üzleti döntési pont.** Az élesítési QA a jóváhagyott rendszer tényleges, jogszerű működését vizsgálja.

---

**A fájl vége. Claude munkamegbízás:** építsd meg a weboldal + mini CRM rendszert a 0–6. fejezet szerint, és töltsd fel a pontos szövegeket/szabályokat a függelékből. **Ne állj meg tervdokumentumnál.**
