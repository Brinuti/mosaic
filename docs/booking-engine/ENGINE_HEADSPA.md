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
| `source_page`, `utm_*`, `gclid`, `fbclid`, `ttclid` | mérési kontextus, a követés a `dataLayer`-be írja |
| `minta=siker\|elkelt\|hiba\|ellenorizetlen\|nincs-idopont\|visszahivas-kesz` | mintanézet foglalás nélkül |

## Folyamat (a wireframe szerint)

`HS1` (intent) → `HS2` (élmény) / `HS3` (ajándékkártya) → `C1` (legközelebbi időpontok, max. 5) → `C2` (naptár: nap, napszak; HeadSpa-n nincs szakember-választó) → `C3` (összegzés) → `C4` (a Salonic beágyazott adatlapja) → `C5` (ellenőrzés) → `C6` (siker). Mellékágak: `A1` nincs időpont (visszahívás-űrlap), `A2` elkelt vagy lejárt időpont, `A3` technikai hiba, `A3U` a foglalás feldolgozva, de nem ellenőrizhető. Az ajándékkártya-vásárlás kilép a `/headspa-ajandekkartya` oldalra.

## Oxigén (`business=oxygen`)

`OX1` → `C1`: három belépési út (hajkamerás vizsgálat 4 990 Ft, első kezelés, már jártam nálatok). A szolgáltatást a besorolás (`bookingType`) választja, nem azonosító-lista, ezért az új Salonic-szolgáltatás magától megjelenik. Ha egy szándékhoz több Salonic-változat tartozik (az első kezelésnél: 80 és 120 perces, azonos áron), a motor rövid választást kínál (`OX2`), nem dönt a vendég helyett. A szakember nem kötelező: a naptárban (`C2`) választható, és a választott szakember végigmegy az összegzésen és a Salonic-űrlapon.

## Fodrászat (`business=hair`)

`HA1` (Mit szeretnél?) → `HA2` (kezelés) → `HA2B` (hajhossz) → `HA3` (Van választott fodrászod?) → `HA3B` (fodrász) → `C1`. A 41 Salonic-szolgáltatás 5 szándékba rendezve (lásd DECISIONS.md 17–19.), a Balayage / szőkítés alatt 14 szolgáltatás helyett 4 kezelés látszik. Az ingyenes konzultáció egyenesen az időpontokra visz. A szakember nem kötelező: alapból „nincs”, ha a szolgáltatáshoz csak egy fodrász tartozik, a kérdés ki is marad. Noel „20% kedvezmény” feliratos, nála az ár a kedvezménnyel jelenik meg, és ezt az ellenőrzés is elfogadja.

Belépések: `?business=hair` (generic → HA1), `&service=<azonosító vagy kulcsszó>` (konkrét szolgáltatás → HA3; konzultáció → C1), `&category=<balayage|color|cut|other>` (kategória-landing → HA2).

## Lézer (`business=laser`)

`LA1` (Melyik út illik rád?) → ingyenes konzultáció: egyenesen `C1` · „Már tudom, mit szeretnék” → `LA2` (terület) → `LA2B` (kezelés) → `C1` · „Már járok kezelésre” → `LA3` (terület) → `LA2B` (kezelés, 2. alkalomtól árakkal) → `C1`. Egy kezelő van, ezért nincs szakember-választó. A 47 szolgáltatás 7 területbe rendezve (DECISIONS.md 20–22.). Az egyedi csomag ára „Egyedi ár”. Belépések: `?business=laser`, `&service=<azonosító vagy kulcsszó>` (konkrét kezelés vagy konzultáció → `C1`), `&category=<arc|honalj|kar|intim|lab|torzs|tobb>` (terület-landing → `LA2B`).

## Közös Salonic-CSS (minden üzletág egyformán)

Az adatlap megjelenését a Salonic-fiók „Egyedi CSS URL” beállítása adja (a PMU-nál ma `salonic/pmu.css`). Az általánosított `salonic/mosaic.css` minden `customer-mosaic…` fiókra érvényes. Hatása (élő HeadSpa- és Oxigén-oldalon, a PMU stíluslappal kipróbálva): az adatlap egy képernyőre összeugrik (812 px), a lábléc, a Facebook-belépés és a megjegyzés mező el van rejtve, MOSAIC betűtípus és arany gomb, a kuponkód mező megmarad.

Bekapcsolás fiókonként (a tulajdonos teendője, a `salonic/mosaic.css` éles megjelenése után): Salonic > Beállítások > Online bejelentkezés megjelenés > „Egyedi CSS URL” = `https://www.mosaicheadspa.hu/salonic/mosaic.css`. A motor a Salonic oldalából felismeri, hogy a fiók betölti-e (`adapter.getPresentation`), és ehhez méretezi a keretet (78 px levágás, 735 px látszó magasság); nélküle az alap méretezés él (100 px levágás, fiókonként 1545 / 1653 px).

## Mi van letesztelve

- 44 automatikus teszt (`node --test tools/test-*.mjs`): adapter, besorolás, folyamat-logika (a wireframe routing táblája szó szerint).
- Böngészőben, élő Salonic-adatokkal, mobil és desktop nézetben: HS1 → HS2 → C1 → C2 (napszak-szűrő) → C3 → C4 (az űrlap betöltődik, levágott Salonic-fejléccel), konkrét szolgáltatásos belépés, mind a mintanézet.
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
