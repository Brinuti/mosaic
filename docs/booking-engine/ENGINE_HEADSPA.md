# Booking Engine V1 – HeadSpa foglaló (rejtett próbaoldal)

Oldal: `/foglalo-motor?business=headspa` (`noindex`, nincs rá link, nem része az éles oldalnak, amíg külön nem döntünk).
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
- **A „Hair” Egyéni változat** ebből a foglalóból nem foglalható (jóváhagyott döntés).
- **Mérés:** a próbaoldalon a `suti.js`/GTM nem fut, az események csak a `dataLayer`-be kerülnek. A `booking_submit` nem megfigyelhető (a gomb a Salonic űrlapján van).

## Go-live előtt (külön jóváhagyás)

1. A mostani HeadSpa konverziós mérés (`/success-foglalas*` köszönőoldalak URL-paraméterei) és az új motor összekötése: a próbaoldal a sikert maga mutatja, és nem nyitja meg a köszönőoldalt.
2. A HeadSpa-oldalak gombjainak átkötése `/foglalo-motor`-ra, A/B vagy fokozatos átállás, visszaállítási pont a jelenlegi folyamat.
3. A VIP említésének takarítása a weboldalon.
