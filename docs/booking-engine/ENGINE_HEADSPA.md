# Booking Engine V1 – HeadSpa, Oxigén, Fodrászat és Lézer foglaló (rejtett próbaoldal)

Oldal: `/foglalo-motor?business=headspa`, `?business=oxygen`, `?business=hair` vagy `?business=laser` (`noindex`, nincs rá link, nem része az éles oldalnak, amíg külön nem döntünk).
Kód: `assets/js/booking-engine/` (`engine.js` felület, `flow.js` logika, `flows/headspa.js` HeadSpa-beállítás, `tracking.js`, `salonic-adapter.js`, `business-config.js`), `assets/css/booking-engine.css`, `foglalas/foglalo-motor.html`.
Döntések: [DECISIONS.md](DECISIONS.md). Adapter: [SALONIC_ADAPTER_CONTRACT.md](SALONIC_ADAPTER_CONTRACT.md).

## Megnyitás és paraméterek

| Paraméter | Jelentés |
|---|---|
| `business=headspa` | üzletág (most csak ez kész) |
| `service=<azonosító vagy kulcsszavak>` | konkrét szolgáltatás (pl. `paros`, `egyeni`, `4kezes`): a landingről egyből az időpontokra visz (C1) |
| `voucher=1` | ajándékkártyás belépés (HS3) |
| `intent=first\|returning` | csak a lézernél: a régi „Első időpontok” / „Kezelés időpontok” gombok; egyenesen a területválasztóra (LA2 / LA3), a konzultáció-kérdés (LA1) kihagyásával; `service` / `category` elsőbbséget élvez |
| `source_page`, `utm_*`, `gclid`, `fbclid`, `ttclid` | mérési kontextus, a követés a `dataLayer`-be írja |
| `minta=siker\|elkelt\|hiba\|ellenorizetlen\|nincs-idopont\|visszahivas-kesz` | mintanézet foglalás nélkül |

## Folyamat (a wireframe szerint)

**HeadSpa (2026-10-04, design):** `HS1` („Ajándékkártyával vagy anélkül foglalsz?”: kuponkóddal → `HS3`, kuponkód nélkül → `HS2`) → `HS2` / `HS3` (élmény: kép, időtartam, ár jobbra; kuponkódosnál az ár helyén „Kuponkóddal”) → `C1` (**az időpont-választás minden üzletágnál a PMU-foglaló havi naptára**: szabad napok, az első szabad nap előre kijelölve, a nap időpontjai gombokban, egy érintés az időponton = tovább) → `C4` (a Salonic beágyazott adatlapja, a cím középre rendezve) → `C5` (ellenőrzés) → `C6` (siker). **Nincs összegző képernyő**, és megszűnt a „legközelebbi időpontok” / naptár-sáv / napszak-szűrő (`C2`); a lépésjelző 3 lépés (Szolgáltatás, Időpont, Adatok). A HeadSpa-kezelések időtartama a Salonic ideje (1 óra 20 perc; a tulajdonos megerősítette). Az ajándékkártya-vásárlás nem része a foglalónak (külön oldal).

## Oxigén (`business=oxygen`)

`OX1` → (`OX2`) → `OXS` → `C1`: három belépési út (hajkamerás vizsgálat 4 990 Ft, első kezelés, már jártam nálatok), mindegyik egyforma magas kártya, képpel és árral; a hajkamera sorának szövege: „Megnézzük a fejbőröd állapotát + átbeszéljük milyen eredményt várhatsz”. A szolgáltatást a besorolás (`bookingType`) választja, nem azonosító-lista, ezért az új Salonic-szolgáltatás magától megjelenik. Ha egy szándékhoz több Salonic-változat tartozik (az első kezelésnél: 80 és 120 perces, azonos áron), a motor rövid választást kínál (`OX2`), nem dönt a vendég helyett. **Szakember-választó az időpont előtt (`OXS`)**: képes (ma monogramos) kártyák és „Mindegy – a legkorábbi időpont érdekel”, nem legördülő; a választott szakember időpontjai látszanak a naptárban, és végigmegy a Salonic-űrlapon. A szakemberek fotója a Salonic-fiók szakember-oldaláról való (`tools/booking-kepek-forras/`, 160×160; a `flows/oxygen.js` `staffPhotos` listája köti a névhez); új szakember fotó nélkül monogramot kap.

## Fodrászat (`business=hair`)

`HA0` (**Melyik fodrászt választod?** képes kártyák + „Mindegy”: ez a belépő pont) → `HA1` (Mit szeretnél? Balayage / szőkítés, Hajfestés, Hajvágás, Női szárítás, Hajszerkezet újraépítés, Póthaj, Nem tudom pontosan: sűrű kártyák, mobilon görgetés nélkül; ahol egyetlen kezelés / hajhossz-csoport van, rögtön tovább) → `HA2` (kezelés: ikon, cím, „X Ft-tól”, időtartam) → `HA2B` (hajhossz: hajhossz-ikon, ár) → `C1`. A 41 Salonic-szolgáltatás 5 szándékba rendezve (lásd DECISIONS.md 17–19.), a Balayage / szőkítés alatt 14 szolgáltatás helyett 4 kezelés látszik. A választott fodrász kezeléseit mutatjuk (a szolgáltatások szakember-azonosítói alapján); Noel „20% kedvezmény” feliratos, nála az árak a kedvezménnyel jelennek meg, és ezt az ellenőrzés is elfogadja. Az ingyenes konzultáció („Nem tudom pontosan”) egyenesen az időpontokra visz. Ha a fodrászt egyetlen szakember adja, a kérdés ki is marad.

Belépések: `?business=hair` (generic → HA0), `&service=<azonosító vagy kulcsszó>` (konkrét szolgáltatás → HA0, csak a szolgáltatás fodrászai, utána C1; konzultáció → C1), `&category=<balayage|color|cut|other>` (kategória-landing → HA0, utána HA2).

## Lézer (`business=laser`)

`LA1` (Melyik út illik rád?) → ingyenes konzultáció: egyenesen `C1` · „Már tudom, mit szeretnék” → `LA2` (terület) → `LA2B` (kezelés) → `C1` · „Már járok kezelésre” → `LA3` (terület) → `LA2B` (kezelés, 2. alkalomtól árakkal) → `C1`. Egy kezelő van, ezért nincs szakember-választó. A kártyák egyformák; a területek **szövegmentes** képek (a site képeinek a felirat fölötti vágata; a Törzs a site tiszta férfi-törzs képe), a **„Csomagok” elöl áll** és 4 terület egy mozaikképe. A 47 szolgáltatás 7 területbe rendezve (DECISIONS.md 20–22.). A kezelés-kártyákon az „állapotfelmérés / kedvezmény” felirat helyett a **csomagok testrészei kis ikonokkal** (a site csomag-leírása szerint: BASIC = hónalj + teljes intim; MEDIUM = lábszár + hónalj + intim; SUMMER = teljes láb + hónalj + intim; TOTAL = teljes láb + kar + hónalj + intim; MAN TOTAL = hát, váll, mellkas, has, hónalj; EGYEDI = a vendég válogatja; `flows/laser.js` `PACKAGES`). Az egyedi csomag ára „Egyedi ár”. Belépések: `?business=laser`, `&service=<azonosító vagy kulcsszó>` (konkrét kezelés vagy konzultáció → `C1`), `&category=<arc|honalj|kar|intim|lab|torzs|tobb>` (terület-landing → `LA2B`).

## Közös Salonic-CSS (minden üzletág egyformán)

Az adatlap megjelenését a Salonic-fiók „Egyedi CSS URL” beállítása adja (a PMU-nál ma `salonic/pmu.css`). Az általánosított `salonic/mosaic.css` minden `customer-mosaic…` fiókra érvényes. Hatása (élő HeadSpa- és Oxigén-oldalon, a PMU stíluslappal kipróbálva): az adatlap egy képernyőre összeugrik (812 px), a lábléc, a Facebook-belépés és a megjegyzés mező el van rejtve, MOSAIC betűtípus és arany gomb, a kuponkód mező megmarad.

Bekapcsolás fiókonként (a tulajdonos teendője, a `salonic/mosaic.css` éles megjelenése után): Salonic > Beállítások > Online bejelentkezés megjelenés > „Egyedi CSS URL” = `https://www.mosaicheadspa.hu/salonic/mosaic.css`. A motor a Salonic oldalából felismeri, hogy a fiók betölti-e (`adapter.getPresentation`), és ehhez méretezi a keretet (78 px levágás, 735 px látszó magasság); nélküle az alap méretezés él (100 px levágás, fiókonként 1545 / 1653 px).

## Mi van letesztelve

- 44 automatikus teszt (`node --test tools/test-*.mjs`): adapter, besorolás, folyamat-logika (a wireframe routing táblája szó szerint).
- Böngészőben, élő Salonic-adatokkal, mobil és desktop nézetben: HS2 → C1 (havi naptár, minden üzletágnál) → C4 (az űrlap betöltődik, levágott Salonic-fejléccel), konkrét szolgáltatásos belépés, mind a mintanézet.
- Foglalás utáni ágak a Salonic átirányításának szimulálásával (`window.mhKeretbenOldal`): siker (C6, `booking_completed` a szintetikus azonosítóval), eltérő ár (A3U, `verify_failed`), elkelt időpont (A2).
- Visszahívás-űrlap: helyi szerverre, a mezők és a validáció rendben.

## Ami NINCS letesztelve, és miért

- **Éles foglalás beküldése:** a Salonicnak nincs próbakörnyezete, és a foglalás éles naptárat és konverziókat érint. A beküldést nem próbáltam.
- **A `motor-visszahivas` űrlap éles levélküldése:** a levélsablon (`netlify/lib/levelek.js`) és a Cloudflare/Netlify kezelés a meglévő mechanizmuson fut, de éles beküldéssel nem próbáltam (a szalon e-mailt kapna).
- A Cloudflare Pages előnézeten (`https://claude-booking-engine-ui.mosaic-d77.pages.dev/foglalo-motor?business=headspa`) ellenőrizve: az oldal és a motor kiszolgálódik, `noindex` fejléccel és metával, tiltó `robots.txt`-vel; HS1 → HS2 → C1 az élő Salonic-adatokkal, konzolhiba nélkül. A Netlify-s útvonal nem lett külön próbálva (az éles tárhely Cloudflare Pages).

## Ismert korlátok (a Salonic oldalai nem szerződéses felület)

- **Foglalási zár:** a Salonic az adatlap megnyitásától 5 percig tartja az időpontot (látszik az űrlapon). Ha közben más munkamenet is megnyitja ugyanazt az időpontot, vagy lejár az idő, a Salonic a **saját főoldalára** dob, és ezt a motor nem látja (a `back` paramétert figyelmen kívül hagyja). Védelem: friss ellenőrzés az űrlap előtt (csak a tényleg elkelt időpontot szűri), a motor saját 4:50-es időzítője (lejáratkor A2), és egy segítő sor az űrlap alatt ("Másik időpontot választok").
- **Salonic fejléc levágva** (100 px, `--crop` a CSS-ben): ha a Salonic a fejlécét módosítja, az érték igazítandó. Szebb megoldás: a HeadSpa Salonic-fiókban egyedi CSS (mint a PMU-nál az `salonic/pmu.css`): ez a fiók beállítása, nem nyúltam hozzá.
- **A HeadSpa „Hair” Egyéni változata** ebből a foglalóból nem foglalható (jóváhagyott döntés).
- **Az alap (közös CSS nélküli) Salonic-nézet gyenge:** magas (1400–2000 px), a lábléc és a Facebook-belépés látszik, a Salonic süti-sávja az alján van, és egyes fiókoknál (pl. Hair) az oldal szélesebb a keretnél, így a jobb szél levágódik. A közös CSS (`salonic/mosaic.css`) ezt mind megoldja, ezért az élesítése az első teendő.
- **Mérés:** a próbaoldalon a `suti.js`/GTM nem fut, az események csak a `dataLayer`-be kerülnek. A `booking_submit` nem megfigyelhető (a gomb a Salonic űrlapján van).

## Go-live előtt (külön jóváhagyás)

1. A mostani HeadSpa konverziós mérés (`/success-foglalas*` köszönőoldalak URL-paraméterei) és az új motor összekötése: a próbaoldal a sikert maga mutatja, és nem nyitja meg a köszönőoldalt.
2. A HeadSpa-oldalak gombjainak átkötése `/foglalo-motor`-ra, A/B vagy fokozatos átállás, visszaállítási pont a jelenlegi folyamat.
3. A VIP említésének takarítása a weboldalon.
