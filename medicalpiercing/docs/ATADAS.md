# Medical Piercing – átadás egy új munkamenetnek (2026-10-11)

Ez a fájl mindent tartalmaz, ami a Medical Piercing (MP) új weboldalának és foglalómotorjának továbbviteléhez kell:
- mi van kész és hol;
- hogyan dolgoztunk, milyen szabályok szerint;
- mi a nyitott teendő.

Párja a Drive MP-mappájában van („MP-ATADAS-2026-10-11.md”), ugyanezzel a tartalommal. A részletes műszaki leírás a [README.md](../README.md)-ben van.

## 1. Hol van minden

| Mi | Hol |
|---|---|
| Kód | GitHub `Brinuti/mosaic`, a **`medicalpiercing/`** mappa (a MOSAIC-oldal kódja mellette, ahhoz NEM nyúlunk) |
| Fejlesztői ág (eddig) | `claude/medicalpiercing-cloudflare-pages-005tr7` (minden PR innen ment a `main`-re) |
| Tárhely | **Cloudflare Pages**, `medicalpiercing` projekt (Root directory: `medicalpiercing`, build: `node tools/build.mjs`, kimenet `dist`) |
| Éles cím | https://www.medicalpiercing.hu (2026-10-11 08:03 óta, a DNS a Cloudflare-en) |
| PR-előnézet | `https://<ág-név, max 28 karakter>.medicalpiercing.pages.dev`, pl. `https://claude-medicalpiercing-cloud.medicalpiercing.pages.dev` (noindex, mérőkód nem fut) |
| Szerveres mérés adatbázisa | Cloudflare D1 `mp-meres` (kötés: `MP_MERES_DB`, `wrangler.toml`) |
| Salonic | `medicalpiercing.salonic.hu`, 15 helyszín (placeId-k: `assets/js/motor/salonic-adapter.js` `HELYSZINEK`) |
| Drive | „MP” mappa (id `1eh5fJsX8dSJVBF9e78r3GxvB1z3z2gH3`), lásd lent |

**Drive-fájlok (MP-mappa):**
- `MP-FOGLALOMOTOR-FELADAT.md`: a foglalómotor feladata, Feri döntései, QA-lista. A fejlesztő és a mérési Claude közös státuszfájlja; a legújabb bejegyzés FELÜL.
- `MP-FOGLALOMOTOR-PROBAFOGLALASOK.md`: a 7 valódi próbafoglalás táblázata.
- `MP-WEBOLDAL-ELLENORZES.md`: a weboldal H-1…H-7 ellenőrzési pontjai.
- `MP-VALTOZASNAPLO.md`, `MP-DECISION-LOG.md`, `MP-MERES-TERV.md`, `MP-FEJLESZTOI-FELADAT.md`, `MP-ATALLAS-ELLENORZO-WIX-CLOUDFLARE.md`, `MP-FOLYAMAT-NAPLO.md`: a korábbi napok tervei és naplói.
- A Drive-ra így írunk: új fájl ugyanazzal a névvel (a régi tartalom ALÁ kerül az új blokk FELÜLRE), majd a régi a kukába. Előtte mindig ellenőrizzük, nincs-e közben újabb változat (a mérési Claude is írja).

**Párhuzamos munkamenetek (más Claude-ok):**
- **Mérési Claude:**
  - független QA a foglalómotorra (ág `claude/mp-motor-qa`, `medicalpiercing/qa/`);
  - a Google Ads szerveres „ÁRNYÉK” feltöltése (PR #242, `docs/MERES_GOOGLE_ARNYEK.md`, `MP_GADS_MOD=dryrun`);
  - figyelés élesítés után.
- **Süti-sáv munkamenet:** PR #246 (`claude/mp-sutisav`): saját süti-sáv a CookieYes helyett, Consent Mode v2. **Élesben** (merge 2026-10-11 13:01 UTC; leírás: `docs/SUTISAV.md`). Az ütközést a #247-tel az a munkamenet oldotta fel.

## 2. Munkaszabályok (a repó `CLAUDE.md` és `medicalpiercing/CLAUDE.md` fájljai, röviden)

- **Kommunikáció:** mindig magyarul. MINDENT a Claude csinál, a tulajdonost (Feri) csak arra kérjük, amit technikailag csak ő tehet meg (egy kattintás, egy beállítás a saját fiókjában), a legrövidebb úttal.
- **Munkamenet minden változtatás után:**
  1. teszt: `node tools/build.mjs`, `node tools/serve.mjs`, a tesztek (lent);
  2. commit (magyarul, ékezet nélkül);
  3. push a fejlesztői ágra;
  4. PR a `main`-re;
  5. zöld Cloudflare-előnézet;
  6. merge a teljes 40 karakteres SHA-val (`merge_pull_request`, `expectedHeadSha`);
  7. éles ellenőrzés.
- **Mergelés:** a tulajdonos kérését azonnal élesítjük (külön jóváhagyás nélkül). Visszafordíthatatlan vagy külső hatású lépéshez kifejezett kérés kell.
- **Cloudflare-buildek:** a havi keret 500, ezért takarékosan; a munkát egy PR-be gyűjtjük.
- **Külső fiókok:** a Wix, Google (Ads, GA, GTM), Meta, TikTok, CookieYes, Cloudflare DNS és Salonic beállításaihoz a tulajdonos kifejezett kérése nélkül NEM nyúlunk. A Meta Schedule-integrációhoz és a Salonic-beállításokhoz nem nyúlunk.
- **Mérőkódok:** csak a `www.medicalpiercing.hu`-n futhatnak (`assets/js/suti.js`, `ELES_DOMAINEK`). Mosaic-azonosító nem kerülhet az MP-oldalra, és fordítva.
- **Salonic felé:** csak olvasó GET (a nyilvános oldalak és a naptár-API) és a beágyazott adatlap. Foglalást csak a Salonic saját adatlapja hoz létre.
- **Érzékeny adatok:** hirdetési platform felé nem megy egészségügyi adat, név, telefon, e-mail (csak rövid típuskód).
- **Titkok:** soha nem kerülnek a repóba vagy a Drive-ra.
  - A Cloudflare titkai (pl. `SMTP_PASS`) a Cloudflare felületén vannak (Secret, Production és Preview).
  - A Cloudflare API-tokent a tulajdonos adta ennek a munkamenetnek; a munkamenet ideiglenes tárolójában volt, NINCS átadva.
  - Új munkamenetben csak DNS- vagy Pages-beállításhoz kell, a napi munkához (PR → előnézet → merge) nem.
- **Tesztelés:** a Wix-oldalt csak mérőkód-tiltással szabad megnyitni; teszt közben mérési adat nem mehet ki. A Playwright-tesztek a kimenő mérőkéréseket eldobják.

## 3. Az új MP-weboldal (Wix-klón) – állapot

- **Mi ez:** a Wix-oldal pixelpontos, Wix nélküli mása (sima HTML + CSS + JS), Cloudflare Pages-en.
  - Asztali és mobil változat (`_a`/`_m`, a böngésző szerint).
  - 178 oldal × 2 nézet = 358 lap, a Wix-szel azonos címek.
  - Az elkészítés lánca, a funkciók és az ellenőrzés: README 1–3. pont.
- **Élesítés:** 2026-10-11 08:03.
  - A DNS a Cloudflare-en van (névszerverek a Websupportnál cserélve).
  - Visszaállás a Wixre: a `www` CNAME → `cdn3.wixdns.net` (README 4. pont).
  - A Wix-előfizetés még megvan (visszaállási lehetőség).
- **Mérés (`suti.js`):**
  - GTM-T9GR4JCK (benne a GA4 G-SJT2RN62H8 és a TikTok-pixel);
  - Google Ads AW-11097894040;
  - Convertize 11722;
  - Meta-pixel 2177829632420786, a `/foglalas-ok*` oldalakon nem;
  - TikTok InitiateCheckout és GA4 `foglalas_inditasa` minden Salonic-foglalási kattintáskor;
  - Süti-sáv: saját (PR #246, élesben), Consent Mode v2, `docs/SUTISAV.md`. A CookieYes szkript (403-at adott) eltávolítva.

  Próba: `tools/meres-teszt.mjs`.
- **Saját szerveres foglalásmérés (PR #242):** a `assets/js/mp-meres.js` a `/foglalas-ok*` oldalakról küld a `/api/mp-foglalas` felé. Útja: D1 → Google Ads ÁRNYÉK-feltöltés (dryrun). Leírás: `docs/MERES_GOOGLE_ARNYEK.md`.
- **Gyorsítás (PR #243, élesben):**
  - lusta képek és beágyazások;
  - WebP;
  - betűk előtöltése;
  - a menü és a felugrók animáció nélkül.

  Mobil főoldal betöltése 42,7 s → 10,5 s, asztali CLS 0. README „Sebesség”.
- **SEO-ellenőrzés (2026-10-11):**
  - A build és a forrás 358/358 lapon azonos: title, description, canonical, robots, OG, hreflang, a címsorok és a linkek.
  - A 75 lementett Wix-oldallal is azonos (csak többlet van).
  - Az élő Wix-oldalt és a Web Archive-ot ebből a környezetből nem értük el.
  - Eszköz: `tools/seo-osszevetes.mjs`.
- **Kitelepülések:** a „MP - KITELEPÜLÉSEK” Google-táblázatból (README „Kitelepülések”).
- **Űrlapok:** állás, kontroll/garancia, blog-hozzászólás → `POST /api/urlap` → e-mail a `medicalpiercing.hu@gmail.com`-ra (SMTP, a `SMTP_PASS` Cloudflare-titok).
- **Ismert nyitott pontok:** README 5. pont, plusz:
  - a Cloudflare e-mail-elrejtése a `mailto:` linkeket `/cdn-cgi/l/email-protection`-re írja (Cloudflare-beállítás; ha zavar, a zónában kikapcsolható);
  - a nagy beágyazásos oldalak (pl. `/migren-piercing`) asztalon ~7 MB a lap tetején lévő YouTube/RTL-keretek miatt. A „kattintásra töltődő videó” (facade) a GTM videómérését érintené, ezért nem csináltuk meg.

## 4. A foglalómotor – állapot és működés

**Állapot (2026-10-11 este):**
- **Élesben, a kapcsoló 100%-on** (PR #248, merge 0207734, 2026-10-11 13:22 UTC). Minden látogató a motort kapja; `?motor=0` a régi Salonic-utat adja (próbához), `?motor=1` kikényszeríti a motort.
  - A mérési Claude QA PASS-t adott (QA-2…6: a fejlesztő 9 próbafoglalása és tesztjei; QA-1: a `?motor=0` élesben ellenőrizve).
  - ChatGPT-felülvizsgálat: FELTÉTELLEL (24 órás figyelés, 0%-os vészvisszaállítás).
  - 24 órás figyelés (mérési Claude): Salonic-foglalások napi száma az előző hetek azonos napjához képest; Meta Schedule vs Salonic-levél (normál: napi |eltérés| ≤ 1); D1 `/api/mp-foglalas` sorok és duplikáció; JS-hiba és GA4 `motor_hiba`.
  - **Vészvisszaállítás:** `medicalpiercing/motor-kapcsolo.json` → `{ "arany": 0 }`, PR, merge; vagy azonnal a Cloudflare Pages előző kiadása.
- (Előzmény) A motor a PR #245-tel (8ad2848) ment élesbe 0%-on.
- **PR #247 élesben (10:06, fe543e7):** a mobil adatlap egy képernyőn, a `/fulbevalo-ok` átvétele, a 15 helyszín tesztje.
  - Az éles ellenőrzés kész: füstpróba asztalon és mobilon; `motor-helyszin-teszt` 15×2 zöld.
  - Valódi próbafoglalás a divat fülpiercingre (Sopron, mobil): `/fulbevalo-ok` a fő ablakban, `booking_id` = `back`. Lemondva.
- **Feri döntése (10:06, „EZ ÉRVÉNYES”):** 100% MA, ha a QA-1…QA-6 mind PASS. A 0%-os kapcsoló vészvisszaállításként kötelező, A/B teszt nincs. (Teljesült, lásd fent.)
- **Salonic „Egyedi CSS URL”: BEÁLLÍTVA.** A mérési Claude 13:29 UTC-s bejegyzése még „NINCS beállítva”-t írt; legkésőbb ~14:20 UTC-re beállították a medicalpiercing fiókban (ki tette, nem tudjuk; a fejlesztő nem). Igazolva: a `medicalpiercing.salonic.hu` oldalak HTML-je hivatkozik az `https://www.medicalpiercing.hu/assets/salonic/mp.css`-re, és a stíluslap-kapcsoló nélküli éles mérés (`adatlap-meres.mjs --eszkoz "iPhone 12"`) szerint a „Foglalás elküldése” gomb alja 563 px a 664 px-es képernyőn, görgetés nélkül.
  - Következmény: az `mp.css` mobilon elrejti a nem kötelező megjegyzés mezőt. A `probafoglalas.mjs` ezt kezeli (csak akkor tölti, ha látszik).
  - Az A76-fiókról (téves beállítás, azonnal visszaállítva) a mérési Claude jelezte, hogy ellenőrizte, nem tölti be; ezt mi nem mértük újra.
- **Éles ellenőrzés a 100%-ra (2026-10-11, ~14:20–14:30 UTC):** `BASE=https://www.medicalpiercing.hu node tools/motor-helyszin-teszt.mjs`: 15 helyszín × asztali és mobil, 270 OK, 0 HIBA; és a 10. próbafoglalás (lásd lent).

**A felület (2026-10-11 este, Feri kérésére; a mobil az első):**
- 1. lépés: mind a 15 helyszín egy képernyőn (mobilon 2 oszlop, asztalon 3), „Kitelepülés” / „Állandó rendelő” felirat nélkül.
- „Kezelés” helyett mindenhol „Szolgáltatás” (lépésjelző, listák, üzenetek).
- 2. lépés: tömör kártyák (név balra, ár és időtartam jobbra); asztalon 2 oszlop, így mind a 18 szolgáltatás elfér egy képernyőn (1440×900 és 1920×1080 igazolva); mobilon egy oszlop, görgetéssel.
- 3. lépés: az összegző dobozban a helyszín és az ár egy sorban, alatta a szolgáltatás neve egy sorban (a betűméret a képernyő szélességéhez igazodik; mind a 18 név ellenőrizve 320 px-es szélességtől).
- Fejléc: az „Időpontfoglalás” cím középen; a „Vissza” és a bezárás gomb 44 px-es; a lépésjelző sávjai is legalább 44 px magasak, a teljes területükkel kattinthatók.
- **Hibajavítás:** a „Vissza” gomb a szolgáltatás-lépésről a helyszínekhez nem jutott el (a megmaradt helyszín miatt a motor azonnal visszaugrott a szolgáltatásokhoz); most ugyanúgy működik, mint a lépésjelző (a további választásokat eldobja).
- Az adatlap-lépés (a beágyazott Salonic-űrlap) változatlan.
- **Süti-sáv mobilon (`assets/js/suti.js`, `helyez()`):** a sáv mindig az alsó szélen áll. Korábban a Wix kerek gyorsmenü-gombja (`#QUICK_ACTION_BAR`, jobbra lent, görgetésig nem látszik) fölé emelték 66 px-szel, ezért a tartalom közepén lebegett (valódi telefonon is, nem csak emulációban). Most a gyorsmenü-gomb csúszik a sáv fölé, amíg a vékony sáv látszik; elrejtéskor / a beállítások nézetben visszaáll.
- **Típus-első belépés és beépített űrlap (Feri kérésére):** a motor fő oldala a „Mire szeretnél időpontot foglalni?” (4 kártya: Új piercing / Kontroll / Ékszercsere / Garancia; a régi köztes `/idopontfoglalas` oldal kártyái).
  - **Új piercing** → a naptáras út: Szolgáltatás → Helyszín → Piercing (a 18 Salonic-szolgáltatás) → Időpont → Adatok (a beágyazott Salonic-űrlap).
  - **Kontroll / Ékszercsere / Garancia** → NEM naptáras: a beépített visszahívás-kérő űrlap (2 lépés: Szolgáltatás → Adatok). Ugyanaz az űrlap és végpont, mint a régi `/kontroll` oldalon: `POST /api/urlap`, `form-name` = `kontroll-visszahivas`, ugyanazok a mezőnevek és sorrend (a szalon e-mailje változatlan; `lib/levelek.js`). Sikeres küldés után `/kontroll-ok` → 301 → `/kontroll-xyz` (a konverzió-mérés ott fut).
  - **Figyelmeztető sáv az űrlap fölött** (Feri kérése, 2026-10-21): a Kontroll és a Garancia űrlapján legfelül két sor: „Kontroll és garancia csak hétfőtől csütörtökig, 8:00–14:00 között.” és „Csak időpont-egyeztetéssel. …” (`urlap-figy`, `motor.js` `urlapLepes`). Az Ékszercserénél nincs (arra Feri nem kérte). Teszt: `motor-tipus-teszt.mjs` F.
  - „Mire kérsz időpontot?” (a régi 6 lehetőség típusonként): Kontroll (Kontroll – meglévő vendégeknek – 0 Ft; Konzultáció – új vendégeknek – 5.000 Ft; Sebkezelés / Tisztítás – 2.000 Ft), Ékszercsere (nálunk vásárolt ékszerrel 5.000 Ft; hozott ékszerrel 2.000 Ft), Garancia (Garanciális szúrás – 5.000 Ft).
  - Telefonszám: országkód-választó (238 ország, alap +36). Országkód nélkül gépelt hazai szám: a „06” / „0” elöl és a „36” (ha a szám így is hosszú: Eger körzetszáma is 36) elhagyva → „+36 701234567”.
  - **Belépési pontok** (`assets/js/motor-indito.js`; a köztes oldalak MEGSZŰNTEK, Feri döntése 2026-10-11): minden foglalási link (Salonic-link, `/idopontfoglalas`, `/kontroll`) a motort nyitja, lapbetöltés nélkül; **a link szövege dönt**: ha kontrollt, ékszercserét vagy garanciát említ („Kontroll időpontok”, „Garancia / Kontroll időpontfoglalás >>”, „Időpontfoglalás Garanciális konzultációra”, „Időpont foglalás ékszer cserére!”, „Budapest – Garancia időpontok >>”), egyből az űrlap nyílik (`ékszer cser` → Ékszercsere; `garanci` kontroll nélkül → Garancia; `kontrol` vagy `/kontroll` → Kontroll); minden más foglalási gomb ugyanazt kapja: a típus-választót (Új piercing / Kontroll / Ékszercsere / Garancia), akárhonnan kattint (nincs oldalfüggő ajánlás; a link helyszíne / szolgáltatása / szakembere megmarad az „Új piercing” után). Kivétel: a „módosít” / „lemond” szövegű Salonic-link a Salonicra megy (ott a vendég-fiókban történik). **A `/idopontfoglalas` és a `/kontroll` cím a FŐOLDAL tartalmát adja** (`tools/build.mjs`: a főoldal másolata; kanonikus cím: a főoldal, a sitemapből kikerültek), a motor betöltéskor ráugrik (`/idopontfoglalas`: típus-választó, `/kontroll`: kontroll-űrlap); bezárva a főoldal marad, a cím `/` lesz. Az eredeti két oldal csak a vészvisszaállítás tartaléka: `/regi-idopontfoglalas`, `/regi-kontroll` (noindex); ide visz, ha a kapcsoló 0%, `?motor=0`, vagy a motor nem tölt be.
  - **Mérés:** a foglalásindítás (GA4 `foglalas_inditasa`, TikTok InitiateCheckout) Salonic-linkre kattintáskor a `suti.js`-ben fut, mint eddig. Ha a motor belső linkről vagy betöltéskor nyílt, az „Új piercing” választásakor a `window.mpSuti.foglalasInditas()` küldi ugyanazt az eseményt (egyszer, nincs dupla). A kontroll / ékszercsere / garancia nem küld foglalásindítás-eseményt (a régi úton sem küldött).
  - Teszt: `node tools/motor-tipus-teszt.mjs [--mobil]` (a `/api/urlap` kérést elfogja, e-mail nem megy a szalonnak).
- **Tömör piercing-lista, áthúzott ár, szakember-fejképek (Feri kérésére):**
  - A „Piercing” lépés (18 sor) mobilon egysoros, ~28 px magas sorokból áll (a név és az ár egy sorban, az időtartam az összegzésben látszik), az összegző sáv is tömörebb; asztalon 2 oszlop (ár + időtartam jobbra), egy képernyőre fér (1366×768-tól). Mobilon Pixel 5 méretén (393×727) elfér, kisebb kijelzőn (iPhone 12/SE, Galaxy S9+) 2–3 sornyit kell görgetni (a böngésző saját sávja miatt a valódi telefonon is kell egy kevés). Az űrlap 320 px szélességen is egy képernyőre fér (`motor-tipus-teszt.mjs` K / K2).
  - **Áthúzott („mennyi helyett mennyi”) ár:** a Salonic csak az aktuális árat adja (`data-price`), ezért a listaárakat a weboldal árlistája adja (a főoldal / árlista oldalak „X Ft helyett Y Ft” jelzései): `assets/js/motor/motor.js` → `EREDETI_AR`. 1 db piercing 27.900 → 24.900; 2 db (2 PIERCING A 2. FÉLÁRON) 55.800 → 39.900; 3 db 83.700 → 44.900; „2 személynek” 2/4/6 db: 55.800 → 49.800, 111.600 → 79.800, 167.400 → 89.800. Nincs áthúzott ára: 1+1 allergia (34.900) és a fülbevaló / divat fülpiercing (12.000 / 20.000 / 30.000), mert a weboldal nem hirdet listaárat hozzájuk. Csak a weboldal által is hirdetett listaár kerülhet ide (fogyasztóvédelem). Az akciós csomagok (3 PIERCING, 2 PIERCING, „2 személynek”) enyhe kiemelést is kapnak. Ha a Salonic-szolgáltatás nevében „X Ft helyett” áll, azt a motor magától felveszi (`listPrice`).
  - **Szakember-csempék fejképpel:** az időpont-lépésben kis kerek fejkép (28 px, mobilon 24 px) a névsor mellett: Viki, Gabi, Fanni, Ricsi (és Brigi): `assets/img/csapat/*.webp` (96×96, a főoldal csapatfotóiból). Akinek nincs fotója (Henrietta, Nikoletta, Kornélia, Nóra), annak a keresztnevének monogramja látszik; fotó érkezésekor a `CSAPAT` listába (motor.js) egy sor + egy kép kell. Ha egy helyszínen csak egy szakember van, nem választatjuk, de ugyanígy, kijelölve, fejképpel látszik (a foglalás továbbra is „bárki”-ként megy, ami ilyenkor ugyanő).
- **Szűrős piercing-lépés (Feri mockupja szerint, 2026-10-11):** a „Piercing” lépés két kérdéssel szűr, a lehető legsűrűbben (mobilon minden telefonméreten egy képernyőre fér, 320 px-en is): **1. Kinek szeretnél időpontot?** (Magamnak / Két személynek), **2. Milyen piercing érdekel?** (1 piercing / Több piercing / Fülbevaló), alatta **3. Választható piercingek** – N lehetőség (a három cím számozott, kör alakú sorszámmal; a szekciók között szellős távolság, a gombok mobilon 38 px, asztalon 46 px magasak, árnyékkal és kerettel, hogy egyértelműen választhatók legyenek; asztalon még nagyobb a sortávolság (22 px a kérdések között, 12 px-es gombrés, 20 px-es sorszámkör), és 1366×768-on is marad ~88 px az utolsó sor alatt; a legkisebb telefonon is marad ≥ 8 px). Alapérték: Magamnak + Több piercing. Az „1 piercing” 9 sor: fejfájás/migrén, Shenmen, klimax, slim, máj, vastagbél, lép, allergia, pajzsmirigy. Több piercing = 3 PIERCING, 2 PIERCING, 1+1 allergia, a gombon „legjobban megéri” jelzéssel (ez váltotta az „Ajánlott” csoportot); Fülbevaló = 1/2/3 db; Két személynek: „2 személynek – 2 db” = 1 piercing fejenként, 4 és 6 db = több piercing (a Fülbevaló ilyenkor nem választható). Ha egy kombináció üres (Sopron / Szombathely: nincs „2 személynek – 2 db” a Salonicban), a gomb tiltott, és az első létező lehetőség lép a helyére. A kategória a Salonic-szolgáltatás nevéből jön (`kategoria()` a `motor.js`-ben). A sorokban rövid név (`rovidNev()`: „Fejfájás / Migrén”, „2 személynek – 4 db”, „Fülbevaló / divat fül – 2 db”; a pontos Salonic-név a sor `title`-jében, az összegzésben és az adatlapon), a piercing neve terrakotta színű, az ár sötét; kis ikon + áthúzott ár. Nincs „Időpontot választok” alsó sáv: a sorra kattintás azonnal tovább visz (egy koppintással kevesebb); ha Feri a mockup szerinti alsó sávot is kéri, az külön kör.
- **Mobil: nagy, olvasható elemek, görgetés elfogadott (Feri, 2026-10-13):** mobilon (≤ 700 px) a helyszínek egy oszlopban, 58 px magas cellákban (18 px betű, nagyobb mini térkép); a piercing-lépésben a sorok ≥ 60 px magasak (16,5 px-es név, ami két sorba is törhet, 16 px-es ár, az áthúzott ár fölötte, 30 px-es ikon), a szűrőgombok 50 px magasak (15 px betű; a 3 gombos „Milyen piercing” sorban a „Több piercing” kap több helyet), a sorszámos címek és az összegző sáv is nagyobbak; ha kell, a lista görgethető. Minden kattintható kártyán (típus-választó, helyszín, piercing) erősebb, 1,5–2 px-es keret + árnyék; a típus-kártyák 2 px-es, sötétebb rózsaszín kerettel. Az egy képernyős, tömör elrendezés csak asztalon maradt (1366×768-on is elfér). Tesztek: `motor-tipus-teszt` (K2/O: mobilon sorméret és betűméret küszöb, egy oszlop), `motor-formazas-teszt` (mobilon az utolsó helyszín görgetéssel elérhető).
- **Helyszín-rács:** kisebb cellák (a mini térkép + név), `minmax(0, 1fr)` oszlopok, keskeny kijelzőn (≤380 px / ≤340 px) kisebb betű és ikon: oldalra nem lóg ki, a név nem vágódik le semelyik szélességen (320–1440 px, `motor-tipus-teszt` O).
- **Gyorsítás és a naptár teljessége (Feri kérésére):**
  - **Ok:** a naptár minden kattintásnál (hónapváltás, nap, szakember) újraszámolta az összes szabad időpont budapesti dátumát, minden hívásnál új `Intl.DateTimeFormat`-tal; Budapesten ~8000 időpont van, így egy hónapváltás ~1,5 s volt (lassú telefonon, 4× CPU-lassítással ~10 s), és a háttérben érkező második adag is ugyanígy lefagyasztotta a felületet. Javítás: a `bp()` számolt (EU nyári időszámítás-szabály), az időpontok napja/ideje egyszer számolódik (`sb()`). Mért: hónapváltás 1528 → 5 ms (4×-es lassításnál 9518 → 26 ms), visszatérés a naptárba 964 → 4 ms. Az új `bp()` az Intl-lel 872 928 időponton egyezik (2025–2031, a nyári/téli átállás körül percenként is; `tools/motor-bp-teszt.mjs`).
  - **Kevesebb várakozás:** ugyanahhoz a helyszínhez + piercinghez 90 mp-en belül már betöltött időpontokat visszalépéskor nem tölti újra (nincs „betöltés” villanás, a kiválasztott nap megmarad); a piercing-lista a kategória-felderítéssel egyszerre kéri a listát (korábban két egymás utáni lekérés); ugyanarra egyszerre csak egy lekérés fut; az első 21 nap után a maradék egy kérésben jön (korábban 31 napos darabok). A hátralévő napok betöltését egy kis „További napok betöltése…” jelzés mutatja.
  - **Debrecen decembere:** az időpont-ablak 62 nap volt, a Salonic viszont helyszíntől függően 65–80 napra előre ad időpontot (2026-10-11: legtávolabbi 80 nap, december 30.). Most 100 nap (`NAPOK`). Teszt: `node tools/motor-naptar-teszt.mjs [--csak 11424] [--mobil]`: mind a 15 helyszínen a motor naptárát (az összes hónap napjai + a legtávolabbi nap időpontjai) a Salonic naptár-API-jával veti össze (csak olvasó GET).
- **Ikoncsomag:** a piercing-sorok előtt kis ikon (`assets/img/ikon/<kód>.webp`, 96×96, átlátszó háttér, 1–3 KB), a helyszín-kártyákon mini térkép (`assets/img/helyszin/<place_id>.svg`, a város pontos koordinátával jelölve; `tools/helyszin-ikonok.mjs` generálja, nincs hálózati függőség). A szolgáltatás-ikonok az OpenAI képgenerálásával készültek (a lista képernyőképéből, 6 ikonos lapokban: „vastag, tömör sziluett, 24 px-en is olvasható” stílus-kéréssel), a lapokat `tools/ikon-vagas.py` vágja szét és egységesíti a színeket (sötétkék #454659, kiemelés #ab6354). Kódok: mi (migrén), sh (Shenmen), kl (klimax), sl (slim), al (allergia), mj (máj), vb (vastagbél), lp (lép), pm (pajzsmirigy), divat (fülbevaló), akcio (3 / 2 piercing akció), ketto („2 személynek”). A Salonic-név emojijai (🔥, 👭) a motorban nem látszanak (az ikon váltja). Az OpenAI-kulcs nem kerül a repóba / Drive-ra: a generálás egyszeri volt, a kulcsot cserélni kell.

**Folyamat és fájlok:**
- `assets/js/motor-indito.js`: minden lapon, kicsi. A `medicalpiercing.salonic.hu` foglalási linkekre kattintva dönt (kapcsoló / `?motor=`), és ekkor tölti be a motort.
- `assets/js/motor/motor.js`: a felület (Shadow DOM, mobilon teljes képernyő). Lépések: helyszín → kezelés (a típusoldalról érkezőnek az ajánlott elöl) → nap, idő, szakember → a Salonic adatlapja keretben (`/guestData/?…&back=mb_…`, a gclid/fbclid/ttclid/utm_* továbbvitelével).
- `assets/js/motor/salonic-adapter.js`: 15 helyszín; a szolgáltatások, munkatársak és időpontok csak olvasó GET-tel (CORS engedett); a stíluslap felismerése.
- `assets/js/motor/booking-id.js`: `mb_` azonosító. `tipus.js`: piercing-típuskódok.
- **Köszönőoldal:** a Salonic a keretben a köszönőoldalra irányít:
  - a gyógypiercingeknél `/foglalas-ok*`, a divat fülpiercingnél `/fulbevalo-ok*`;
  - a csupasz `medicalpiercing.hu`-ra, 301 → www.

  Az átadás:
  - A keretben futó `suti.js` jelez, a motor visszaigazol.
  - A motor ugyanazt az URL-t `booking_id`-vel a fő ablakban nyitja meg.
  - A keretben nincs mérés.
  - Egy foglalás köszönőoldala egy böngészőben csak egyszer mér.
  - A régi, közvetlen Salonic-beágyazások (`/migren-piercing-uj` stb.) változatlanul mérnek.
- **Mérés:** a foglalásindítás a `suti.js`-ben, a motor döntése előtt (TikTok InitiateCheckout + GA4 `foglalas_inditasa`). A motor hibája: GA4 `motor_hiba`, és a vendég a régi utat kapja.

**Mobil: az adatlap egy képernyőn (a tulajdonos kérése, „a legfontosabb”):**
1. **Nézetszélesség:** a mobil lapok (Wix-minta) 320 px-es nézetszélességűek. Nyitott motornál `width=device-width`, bezáráskor vissza.
2. **Adatlap lépés mobilon:** lépésjelző és összegző nélkül, a fejléc „<helyszín> · Adatok”, a keret a képernyő aljáig.
3. **A Salonic-oldal tömör megjelenése:** `assets/salonic/mp.css`, a Mozaik `salonic/mosaic.css` MP-változata, csak az adatlapra.
   - **Gyógytorna-mintájú adatlap (Feri kérése, 2026-10-14):** az `mp.css` végén ugyanaz az elrendezés, mint a Gyógytornaszom foglalójának `gyogytorna/public/salonic/gy.css`-ében (a színek MP-sek): a Salonic saját süti-sávja nem látszik (`.cc-window`); a „Kód ellenőrzése” gomb a kuponmező függőleges közepén; a „*-gal jelölt mezők kitöltése kötelező!” mondat és a lemondási határidő sora rejtve (a határidő a visszaigazoló e-mailben benne van); rövid hozzájárulási szöveg („Megismertem és elfogadom az adatvédelmi tájékoztatót és a foglalási szabályzatot. *”; a „…és kifejezetten hozzájárulásomat adom…” rész nem látszik, a Salonic-DOM-ban megvan), a jelölőnégyzetek a mezők bal szélén (a hírlevél-jelölő szövege megmarad); rövid reCAPTCHA-sor; szellősebb mezők. Mobilon (320 px-ig) továbbra is egy képernyőn marad az adatlap a gombbal (`tools/motor-proba/adatlap-meres.mjs --stilus`). Az `mp.css` gyorsítótára 4 óra (`max-age=14400`), így a változás legfeljebb ennyi idő alatt ér mindenkihez.
   - **Az `mp.css` gyorsítótára (Feri kérése, 2026-10-14):** a Salonic-fiók az éles URL-ről, verziójel nélkül tölti be a stíluslapot, ezért a módosítás látszata a böngésző gyorsítótárán múlt. Ok: a `_headers` `max-age=600`-at ír, de a **Cloudflare-zóna „Browser Cache TTL” beállítása 4 órára (14400) emelte** a statikus fájl tárolási idejét (a `pages.dev` címen 600, az éles domainen 14400 volt), így egy eszköz a régi `mp.css`-t legfeljebb 4 óráig használta. Két lépés: (1) **a zóna-beállítás átállítva** `Respect Existing Headers`-re (`browser_cache_ttl = 0`; a zóna: `medicalpiercing.hu`, 2026-10-14 06:29 UTC, Feri „Mehet mindkettő”; **korábbi érték: 14400**, visszaállítás: Cloudflare → Caching → Configuration → Browser Cache TTL → 4 hours, vagy az API `PATCH /zones/<zone_id>/settings/browser_cache_ttl {"value": 14400}`); (2) az `/assets/salonic/*` a Pages-függvényen át megy (`lib/salonic-css.js`, `functions/[[path]].js`), `Cache-Control: no-cache` fejléccel (a böngésző mindig ellenőrzi, ETag/304), a `dist/_routes.json`-ból ezért az `/assets/salonic/` ki van véve a kizárásokból (a `tools/build.mjs` az `/assets/` többi almappáját kizárja). A már letöltött régi másolatok a saját lejáratukig (legfeljebb 4 óra) élnek. Teszt: `node tools/salonic-css-teszt.mjs`.
   - **Visszahívás-kérő űrlap és süti-sáv (Feri kérése, 2026-10-14):** (1) Mobilon (iPhone) a „Mikor voltál nálunk?” dátummező a saját oszlopa fölé nyúlt, és összeakadt a „Melyik városban voltál?” mezővel (a `width: 100%` mellé a belső margó is hozzáadódott, és magasabb volt a többi mezőnél). Javítás a `motor.js`-ben: `minmax(0, 1fr)` oszlopok, a dátummezőre `appearance: none`, `box-sizing: border-box`, `min-width: 0`, fix 37 px magasság (≤ 700 px). Az iOS-hibát Chromiumban nem lehet reprodukálni (nincs WebKit a gépen), ezért a teszt (`motor-tipus-teszt` Q) a dobozmodellt, az oszlophatárt és a magasságot ellenőrzi 360–480 px között; az iPhone-os végső ellenőrzés Ferié. (2) A süti-sáv leveszik az űrlapról: a `/kontroll` (az űrlapot nyitja meg) kikerült a sáv-teszt oldalai közül (a `suti.js` `TESZT_OLDAL` csak az utógondozási cikk), és amíg a foglaló ablak nyitva van, a sáv rejtett (`html[data-mp-motor-nyitva]`, a motor állítja; bezárás után döntés nélkül újra látszik). Teszt: `motor-tipus-teszt` R. **MÉRÉST ÉRINTŐ** (a sáv-teszt oldalai).
   - **Adatlap: egy jelölőnégyzet, szakember-sáv (Feri kérése, 2026-10-14):** a Salonic hírlevél-feliratkozás jelölőnégyzete az `mp.css`-ben rejtve van (`.newsletter-container`), így az adatlapon csak a hozzájárulás jelölőnégyzete marad; a feliratkozás ilyenkor „nem”. Az adatlap tetején (a motor saját sávja, a Salonic iframe fölött; `adatlapSzakember()` a `motor.js`-ben) látszik, melyik szakemberhez szól a foglalás: a kiválasztott szakember (fejkép / monogram + becenév, ugyanaz a csempe, mint az időpont-lépésben), a helyszín egyetlen szakembere, vagy „Bárki” (ilyenkor a Salonic osztja ki, a Salonic adatlapja a szakembert nem mutatja). Tesztek: `motor-tipus-teszt` (P), `motor-helyszin-teszt` (mind a 15 helyszínen).
   - **Ehhez a tulajdonos egy lépése kell:** app.salonic.hu (a medicalpiercing fiók) > Beállítások > Online bejelentkezés megjelenés > „Egyedi CSS URL” = `https://www.medicalpiercing.hu/assets/salonic/mp.css`, mentés.
   - Visszavonás: a mező kiürítése.
   - A motor magától felismeri.
   - Mérve a stíluslappal (`tools/motor-proba/adatlap-meres.mjs --stilus`): Pixel 5, iPhone 12, iPhone SE 3, Galaxy S9+ és asztali gép is, a „Foglalás elküldése” gomb görgetés nélkül látszik.
   - Nélküle a Salonic alapkinézete marad, a keretben görgetéssel (gomb ~1550 px).

**Salonic-sajátosságok (fontos a teszteléshez):**
- **Az adatlap (guestData) megnyitása 5 percre lefoglalja az időpontot.** Távoli próbánál mindig a legtávolabbi nap legkésőbbi időpontját válaszd; a helyi tesztek az adatlap kérését eldobják.
- A beküldés válasza JSON. A `redirect.url` a köszönőoldal (benne a `bookingUrl` a `back=mb_…`-vel), a `redirect.url_back` a `bookingId` UUID, a `booking.id` a foglalás száma.
- Lemondás: `https://medicalpiercing.salonic.hu/booking/cancelBooking/<uuid>`, „Lemondom”, ok, „Igen, lemondom”.
- A telefonmezőt (országkódos) gépelni kell, nem `fill`-lel kitölteni.
- reCAPTCHA-kihívás a próbáknál nem jött.
- A `/selectSpecialization/` egy kategóriánál 301-gyel a `/showServices/`-ra visz, és elhagyja a `lang=hu`-t: az adapter magyarul újrakéri.
- Leképezés (`tools/mp-salonic-lekepezes.json`, 2026-10-11 délben frissítve): mind a 15 helyszínen van szabad időpont (Miskolc délelőtt még nem, azóta megnyitották). Sopron és Szombathely kínálatából hiányzik a „👭 2 személynek – 2 db piercing” (189187); lehet szándékos.

**Próbák (mind zöld, 2026-10-11):**
- `node tools/motor-teszt.mjs [--mobil]`: helyben, foglalás nélkül. Ellenőrzi:
  - kapcsoló, 15 helyszín, naptár, adatlapcím;
  - átadás (`/foglalas-ok*` és `/fulbevalo-ok`), a keretben nincs mérés, egyszeri mérés;
  - `?motor=0`, a régi beágyazás;
  - mobil elrendezés, nézetszélesség.
- `node tools/motor-helyszin-teszt.mjs`: 15 helyszín × asztali és mobil. Ellenőrzi a kezeléseket és árakat a leképezéshez képest, az időpontot, a szakembert, az adatlapcímet és az elrendezést. `BASE=`-szel élesben vagy előnézeten is fut.
- `node tools/linkek-ellenorzes.mjs [--reszletes]`: a weboldal MINDEN foglalási linkjét (Salonic-link, `/idopontfoglalas`, `/kontroll`; asztali + mobil lapok) átnézi a `motor-indito.js` saját osztályozásával, és kiírja, melyik mit nyit (típus-választó / űrlap: Kontroll, Ékszercsere, Garancia / a Salonicra megy), a gyanús eseteket külön. 2026-10-11: 4660 link: 3652 típus-választó, 980 kontroll-űrlap, 22 garancia-űrlap, 4 ékszercsere-űrlap, 2 módosítás-link a Salonicra.
- `tools/motor-teszt-segedek.mjs`: a tesztek közös kódrészletei a szűrős piercing-lépéshez (az összes szolgáltatás összegyűjtése / egy szolgáltatás megkeresése és kattintás a két szűrő kombinációiban).
- `node tools/motor-naptar-teszt.mjs [--csak id,id] [--mobil]`: a motor naptára vs. a Salonic naptár-API-ja, mind a 15 helyszínen (napok az összes hónapban, a legtávolabbi nap időpontjai); `node tools/motor-bp-teszt.mjs`: a budapesti idő számítása vs. Intl.
- `node tools/motor-tipus-teszt.mjs [--mobil]`: a típus-első belépés és a beépített visszahívás-kérő űrlap (belépési pontok, mérés egyszer, a 4 kártya, az űrlap szabályai, a beküldött mezőnevek a régi `/kontroll` űrlapéval azonosak, hibaág, `?motor=0`). `BASE=`-szel előnézeten és élesben is fut (a küldést mindig elfogja).
- `node tools/motor-formazas-teszt.mjs [--kep <mappa>]`: a motor formázása 6 eszközön (4 telefon, 2 asztali): egy képernyőn a helyszínek, nincs felirat, a cím középen, „Szolgáltatás”, a szolgáltatásnevek egy sorban, a „Vissza” gomb és a lépésjelző működik, a gombok legalább 44 px-esek. `BASE=`-szel előnézeten és élesben is fut.
- A `motor-teszt` és a `motor-fust` a kapcsoló (`motor-kapcsolo.json`) szerint ellenőriz (0 = régi út, 100 = a motor nyílik; `motor-fust`: `ARANY=` felülírja). A `motor-teszt` elfogadott süti-sávval fut (nélküle a GA4 `foglalas_inditasa` a Consent Mode miatt nem indul). A `sav-teszt` a foglalási kattintás után bezárja a megnyílt motort, a `meres-teszt` `?motor=0`-val a régi úton méri a kattintást (100%-os kapcsolónál a link a motort nyitná, és eltakarná a további kattintásokat). A `sav-teszt --mobil` azt is ellenőrzi, hogy a sáv az alsó szélen áll.
- `tools/motor-proba/`: `motor-fust.mjs` (előnézet/éles füstpróba), `adatlap-meres.mjs`, `proba-futtat.sh` (valódi próbafoglalás + azonnali lemondás; `PROBA_EMAIL=<olvasható cím> PROBA_TELEFON=<Feri tesztszáma>`).
- A weboldal tesztjei: `funkcio-teszt`, `meres-teszt`, `elteres` (Wix-összevetés), `mp-meres-pw`, `test-mp-meres`, `test-mp-feltoltes`.

**Valódi próbafoglalások (QA-2), mind lemondva:**
- 10 darab: Budapest ×4, Szeged, Debrecen, Pécs, Sopron ×3; asztali és mobil.
- A **10.** (2026-10-11 14:26–14:29 UTC) a 100%-os kapcsoló éles ellenőrzése, **`?motor=1` nélkül** (`--parameter-nelkul`): Budapest, mobil (Pixel 5), a `/migren-piercing` oldalról.
  - A motor magától nyílt; 2026-12-12 18:30, Salonic foglalás-ID 47222481, 24 900 Ft, `booking_id` = `back` (`mb_0mv3x4cx8k3pbbbfk3zp70h`); a `/foglalas-ok-mi` köszönőoldal a fő ablakban nyílt; 1 `/api/mp-foglalas` (a szkript elfogta, nincs D1-sor); GA4 `foglalas_inditasa` 1×; JS-hiba 0. Azonnal lemondva.
  - Ezt a foglalást is le kell vonni a figyelésnél (Meta Schedule).
- A vendég neve „TESZT – Claude”. **Mostantól a próbák telefonszáma Feri saját tesztszáma, az e-mail `<tulajdonos e-mail>`** (a Gmail-összekötő ezt éri el; a Salonic-levél megjön). A számot a repó nem tartalmazza: a Drive `MP-FOGLALOMOTOR-FELADAT.md`-ben van, és a `probafoglalas.mjs` `PROBA_TELEFON`-ként kéri (nincs alapérték).
- **Lelet (a 10. próbából) és teendő:** a Salonic-levél köszöntése „Kedves **<vendeg neve>**!” volt (a mellékletek neve is `<vendeg-neve>`). Az 1–10. próbák a szalon számát használták, és a Salonic erre egy meglévő vendégprofilt illesztett, tehát a próbafoglalások (a lemondásokkal együtt) ahhoz kapcsolódnak. **Feri kérése: ezeket törölni kell a Salonicból.** A Salonic-fiókhoz a Claude nem nyúl; a törléshez Salonic-admin belépés kell (Feri vagy a közös belépéssel a mérési Claude). A 10 próbafoglalás Salonic-azonosítója: 47216592, 47216705, 47216757, 47216779, 47216792, 47216800, 47216926, 47218535, 47218562, 47222481. A vendégprofilt magát ne töröld, az valódi személyé lehet; érdemes megnézni, hogy az e-mail-címe nem íródott-e át `<tulajdonos e-mail>`-ra.
- Mind létrejött és párosítható. Az 5 végigfutott átadásból 4-nél a köszönőoldal a fő ablakban nyílt, a `booking_id` = `back`, és 1 `/api/mp-foglalas` ment. Az 5. a divat fülpiercing volt: ott derült ki a `/fulbevalo-ok` lelet. A PR #247 után élesben újra próbáltuk (9.), és rendben van.
- A böngészős mérés tiltva volt; a Salonic szerveres Meta Schedule-ja elmehetett (a figyelésnél levonandó).
- Táblázat: `MP-FOGLALOMOTOR-PROBAFOGLALASOK.md`.

## 5. Hogyan dolgoztam (módszer)

1. **Helyi építés és kiszolgálás:** `node tools/build.mjs` → `dist/`, majd `node tools/serve.mjs` (4290-es port; `PORT`/`DIST` változók).
2. **Playwright (Chromium előtelepítve):** a tesztek a helyi kiszolgálót `www.medicalpiercing.hu` néven nyitják meg (`--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1`), így az éles mérőlogika fut. Minden kimenő mérőkérést elkapnak és eldobnak.
3. **Commit, push, PR, előnézet:** a `Cloudflare Pages: medicalpiercing` ellenőrzés zöld. Utána füstpróba az előnézeten (`tools/motor-proba/motor-fust.mjs`, `BASE=…`).
4. **Merge, éles ellenőrzés:** merge a teljes SHA-val; az éles kiadást az új fájl megjelenéséig figyeljük; majd éles füstpróba, mérőkérés-tiltással.
5. **Valódi próbafoglalás:** csak élesben lehet, mert a Salonic az éles köszönőoldalra irányít. `?motor=1`-gyel, a legtávolabbi időpontra, utána azonnal lemondva.
6. **Drive:** a státusz a `MP-FOGLALOMOTOR-FELADAT.md` tetejére kerül (új fájl + a régi a kukába); a mérési Claude ugyanezt a fájlt figyeli.
7. **Óvatosság:**
   - a Salonic felé csak GET (és a beágyazott adatlap);
   - a `pkill -f` a saját shellt is megölheti: a kiszolgálót a `/proc/<pid>/environ` `PORT` értéke alapján állítsd le;
   - a hálózati korlátozást (egress, proxy) nem kerüljük meg.

## 6. Nyitott teendők, sorrendben

1. ~~PR #247, #246, #248~~ kész, élesben (a motor 100%-on, saját süti-sáv).
2. ~~A Salonic „Egyedi CSS URL” beállítása~~ kész (lásd a 4. pontot), igazolva. Visszavonás: a mező kiürítése (app.salonic.hu, medicalpiercing fiók, Beállítások > Online bejelentkezés megjelenés). Ugyanitt vigyázz a fiókra: a közös Salonic-belépés más fiókon állhat (2026-10-11-én az A76-on ez egyszer tévesen beállt).
   - **Függőben (Salonic-admin kell):** az 1–10. próbafoglalás törlése a Salonicból (a „<vendeg neve>” vendégprofilról, azonosítók a 4. pontban). Feri kérte; a Claude-nak nincs Salonic-belépése, és a Salonic-fiókhoz nem nyúl.
   - Új próbafoglalás NEM kell: a 100%-os motor élesben igazolt (270/270 teszt, valódi próba). A jövőbeli próbák telefonszáma Feri tesztszáma.
3. **Salonic-kínálat (Feri kérte):** Sopronban (9067) és Szombathelyen (14229) hiányzik a „👭 2 személynek – 2 db piercing” (189187). Ugyanaz a fiókváltási kérdés, mint a 2. pontnál.
4. **A 24 órás figyelés** a mérési Claude-é (lásd a 4. pont). Bármelyik eltérésnél azonnal 0%-ra.
5. ~~**Döntésre vár (mérés):** a #242 `mp-meres.js` a divat fülpiercing (`/fulbevalo-ok*`) foglalásait nem küldi.~~ **Kész (2026-10-13, `claude/mp-fulbevalo-meres`):** a `/fulbevalo-ok*` foglalások ugyanúgy mennek a D1-be (forrás v2, `tipus = 'ful'`), a Salonic-párosításba, az ÁRNYÉK-feltöltésbe és a TikTok-naplóba; kifelé semleges marad. Részletek: `docs/MERES_GOOGLE_ARNYEK.md` „Divat fülpiercing”. Nyitva (külső fiók / döntés): a GTM Ads-konverziók triggere (`/foglalas-ok`) a `/fulbevalo-ok`-ra nem fut; a Meta PageView a `/fulbevalo-ok`-on fut.
6. **A tulajdonos teendői (nem a Claude-éi):**
   - a Wix-előfizetés lemondása néhány nap hibátlan működés után.

7. **Ikonok: kész** (lásd az „Ikoncsomag” pontot a 4. részben). Hátra: a Henrietta / Nikoletta / Kornélia / Nóra fotója (most monogram látszik; `CSAPAT` a motor.js-ben + egy kép az `assets/img/csapat/` alatt); az OpenAI-kulcs cseréje (Feri a chatben adta meg; a repóban / Drive-on nincs). Az 1+1 allergia és a fülbevaló áthúzott ára: csak ha a szalon listaárat hirdet hozzájuk.

## 7. PR-történet (Brinuti/mosaic)

- **#235** klón (medicalpiercing/ mappa);
- **#238** menü, köszönőoldalak, mérőkódok, foglalási linkek, kitelepülések;
- **#239** Wix-összevetés: videók, űrlapok, országkód-választó, városlapozó, betűk;
- **#240** rejtett Wix-oldalak, átirányítások, TikTok foglalásindítás;
- **#241** élesítés dokumentálva;
- **#242** szerveres Google Ads ÁRNYÉK (mérési munkamenet);
- **#243** gyorsítás;
- **#245** foglalómotor, 0%;
- **#246** saját süti-sáv (más munkamenet, élesben 13:01 UTC);
- **#247** mobil adatlap egy képernyőn, `/fulbevalo-ok`, 15 helyszín tesztje;
- **#248** a foglalómotor kapcsolója 100% (mérési Claude, 13:22 UTC).
