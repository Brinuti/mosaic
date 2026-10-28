# Salonic-felület és foglalómotor összevetése (2026-10-27)

Eszközök annak ellenőrzésére, hogy a foglalómotor ugyanazokat az időpontokat kínálja-e, mint a **Salonic saját nyilvános foglalója** (böngészőből, vendégként; a Salonic naptár-API-ját nem hívjuk közvetlenül, mert az nem az igazság-forrás). Háttér és eredmények: `docs/booking-engine/SALONIC_SAVOK.md`.

Foglalást SOHA nem indítanak (az adatlapot nem töltik ki), mérőkódokat (GTM, Meta, TikTok, Google) blokkolnak. A motor a robotot (`navigator.webdriver`) nem számolja a belső tölcsérbe.

- `ui-lib.mjs`: a közös segédek. `salonicIdopontok()` a Salonic dátumválasztóját járja végig (minden szabad napra rákattint, az adatlap-linkekből olvassa az időpontokat), `motorIdopontok()` a mosaicheadspa.hu foglalómotorját (alapból az éles; `MOTOR_URL=...` előnézetre vagy helyi szerverre).
- `szolg.mjs <könyvtár>`: a Mosaic Hair szolgáltatásainak listája (`hair-szolg.json`).
- `mind.mjs <könyvtár> <kimenet.json> [párhuzam]`: Betti minden szolgáltatására Salonic-felület vs. motor.
- `audit.mjs <könyvtár> <salonic-fiók> [max]`: minden helyszín / szolgáltatás kezdési rácsa (hány percenként ajánl kezdést). Fiókok: `mosaicheadspa`, `mosaic-hair`, `mosaic-oxigen`, `mosaic-elysion`, `mosaic-pmu`, `a76`, `gyogytornaszomhu`, `medicalpiercing`.

Futtatás: `node tools/salonic-egyezes/audit.mjs /tmp/ki mosaic-hair`. A Salonic-oldalra kerülő átirányítást a `?mh_nincs_atiranyitas=1` kikerüli (a `salonic/atiranyitas.js` figyeli).

Ismert buktatók (mind előfordult, lásd a doksit): a Salonic egy nap időpontjait ~1,5 mp késéssel tölti be; a túl gyors kattintást elnyeli (újrapróbálás kell); a szomszéd hónap „kilógó” napja ugyanazt a címkét viseli; a motor a konzultációnál nem kérdez fodrászt.

## Minden motor ellenőrzése (2026-10-28)
Ugyanaz a módszer minden motorra: a Salonic nyilvános foglalója (vendégként, böngészőből) és a motor UGYANABBAN az időben, ugyanarra a szolgáltatásra. Eltérésnek csak az számít, ami három mérésben is megvan (1. egyszerre, 2. újra egyszerre, 3. egymás után, terhelésmentesen). A közös időszak a két oldal legkorábbi „utolsó napja".

- `uzletag.mjs <audit.json> <uzletag> <salonic-host> <placeId> <kimenet.json> [any|staff|all] [minta]`: Mosaic HeadSpa / Oxigén / Lézer / Fodrászat (`/foglalo-motor?business=...`). `any` = „bárki / mindegy" (Salonic `employeeId=-1`), `staff` = szakemberenként (a nevet a Salonic szakember-választójából veszi), `all` = mindkettő; a minta a szakemberenként vizsgált szolgáltatások száma. Az audit.json az `audit.mjs` kimenete.
- `mp.mjs <audit.json> <kimenet.json> [db/helyszín] [helyszínek]`: Medical Piercing (15 helyszín; a motor Shadow DOM-os).
- `gy-a76.mjs <audit.json> <kimenet.json>`: Gyógytornászom (`www.gyogytornaszom.hu/?motor=1`) és A76 (`GY_MOTOR=https://www.a76.hu SZAK_ATTR=szakember`). A motort egy beszúrt Salonic-linkre kattintva nyitja meg (a launcher így indítja). Környezeti változók: `PAR` (párhuzamos feladatok), `SEKV_CSAK=1` (mindig egymás után mér), `EXTRA_WAIT_MS` (A76: a nagy 3. naptár-darab később töltődik, és nincs „további napok" jelzője), `MAXJOBS`.
- `pmu.mjs <kimenet.json>`: Mosaic PMU (a `foglalo-pmu.js` saját elemeivel: `.nnap`, `.idogomb`; a motor-oldali dátumokban 3-4%-nyi jelölési hiba van, a Salonic-only oldal megbízható).

Buktatók (új):
- A két oldalt AZONOS időben, azonos beállításnál kell gyűjteni (beállítás-váltás közben készült gyűjtések hamis eltérést adnak).
- Egyszerre futó mérések ritkítják a Salonic naptár-API válaszát (főleg a gyogytornaszomhu fiókon): a harmadik, egymás utáni mérés dönt.
- A motor a konzultációnál és a kuponos (ajándékkártyás) szolgáltatásoknál nem ugyanazt a folyamatot adja (nincs szakember-választó / előbb kuponkód kell): ezeket külön kell kezelni.
- Egyetlen szakemberes szolgáltatásnál (pl. A76 Gyantázás) nincs „Bárki" gomb: a szakember kártyáját kell választani.
