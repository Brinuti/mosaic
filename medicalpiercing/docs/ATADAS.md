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
- **Süti-sáv munkamenet:** PR #246 (`claude/mp-sutisav`): saját süti-sáv a CookieYes helyett, Consent Mode v2. Nyitott (09:41). A `suti.js`-hez nyúl. Ha a #247 előbb megy be, a #246-nál kell feloldani a kis ütközést (csak a `/fulbevalo-ok` minta két sora), és fordítva.

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
  - CookieYes: a szkriptje 403-at ad (a Wixen is), a PR #246 cseréli saját sávra.

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

**Állapot (2026-10-11 délben):**
- **Élesben, a kapcsoló 0%-on** (PR #245, 8ad2848). A látogatók a régi Salonic-utat kapják; a tesztelő `?motor=1`-gyel kapja meg, `?motor=0` visszaveszi.
- **PR #247:** a mobil adatlap egy képernyőn, a `/fulbevalo-ok` átvétele, a 15 helyszín tesztje. A merge és az éles ellenőrzés után a Drive-fájlban és alább jelölve.
- **Feri döntése (10:06, „EZ ÉRVÉNYES”):** 100% MA, ha a QA-1…QA-6 mind PASS. A 0%-os kapcsoló vészvisszaállításként kötelező, A/B teszt nincs.
- **A 100% feltételei:**
  1. a mérési Claude QA PASS-a a `MP-FOGLALOMOTOR-FELADAT.md`-ben;
  2. a PR #247 élesben;
  3. ideálisan a Salonic „Egyedi CSS URL” beállítva (lásd lent). Nélküle is működik, de mobilon görgetni kell.

  A 100%: `medicalpiercing/motor-kapcsolo.json` → `{ "arany": 100 }`, PR, merge, éles ellenőrzés. Vissza: `0`, vagy azonnal a Cloudflare Pages előző kiadása.

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
- `tools/motor-proba/`: `motor-fust.mjs` (előnézet/éles füstpróba), `adatlap-meres.mjs`, `proba-futtat.sh` (valódi próbafoglalás + azonnali lemondás; `PROBA_EMAIL=<olvasható cím>`).
- A weboldal tesztjei: `funkcio-teszt`, `meres-teszt`, `elteres` (Wix-összevetés), `mp-meres-pw`, `test-mp-meres`, `test-mp-feltoltes`.

**Valódi próbafoglalások (QA-2), mind lemondva:**
- 7 darab: Budapest ×3, Szeged, Debrecen, Pécs, Sopron; asztali és mobil.
- A vendég neve „TESZT – Claude”; e-mail: a tulajdonos Gmail-fiókja (a Gmail-összekötő ezt éri el); telefon: az MP szalon száma.
- Mind létrejött és párosítható. Az 5 végigfutott átadásból 4-nél a köszönőoldal a fő ablakban nyílt, a `booking_id` = `back`, és 1 `/api/mp-foglalas` ment. Az 5. a divat fülpiercing volt: ott derült ki a `/fulbevalo-ok` lelet, amit a PR #247 javít.
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

1. **PR #247:** a zöld előnézet, a merge és az éles ellenőrzés kész-e? Ha nincs kész: előnézet → merge → éles füstpróba (`motor-fust.mjs`, `adatlap-meres.mjs`).
2. **A tulajdonos egy lépése:** a Salonic „Egyedi CSS URL” beállítása (4. pont). Utána mérd élesben: `BASE=https://www.medicalpiercing.hu node tools/motor-proba/adatlap-meres.mjs --eszkoz "iPhone 12"`. A `--stilus` itt már nem kell: a fiók maga tölti be a stíluslapot.
3. **A mérési Claude QA-eredménye** a `MP-FOGLALOMOTOR-FELADAT.md`-ben. Ha PASS: kapcsoló 100% (`motor-kapcsolo.json`), PR, merge, éles ellenőrzés (`motor-helyszin-teszt.mjs` `BASE=https://www.medicalpiercing.hu`-val, és egy valódi próbafoglalás `?motor=1` NÉLKÜL, azonnali lemondással).
4. **PR #246 (süti-sáv):** ha bemegy, a `suti.js`-ütközést (a `/fulbevalo-ok` minta két sora) fel kell oldani, és a `motor-teszt`, `meres-teszt` újrafuttatandó.
5. **Döntésre vár (mérés):** a #242 `mp-meres.js` a divat fülpiercing (`/fulbevalo-ok*`) foglalásait nem küldi. Ha kell, a mérési munkamenet bővítse.
6. **A tulajdonos teendői (nem a Claude-éi):**
   - a CookieYes-fiók (ha a #246 nem megy be);
   - a Wix-előfizetés lemondása néhány nap hibátlan működés után.

## 7. PR-történet (Brinuti/mosaic)

- **#235** klón (medicalpiercing/ mappa);
- **#238** menü, köszönőoldalak, mérőkódok, foglalási linkek, kitelepülések;
- **#239** Wix-összevetés: videók, űrlapok, országkód-választó, városlapozó, betűk;
- **#240** rejtett Wix-oldalak, átirányítások, TikTok foglalásindítás;
- **#241** élesítés dokumentálva;
- **#242** szerveres Google Ads ÁRNYÉK (mérési munkamenet);
- **#243** gyorsítás;
- **#245** foglalómotor, 0%;
- **#246** saját süti-sáv (más munkamenet, nyitott);
- **#247** mobil adatlap egy képernyőn, `/fulbevalo-ok`, 15 helyszín tesztje.
