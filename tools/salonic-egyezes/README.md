# Salonic-felület és foglalómotor összevetése (2026-10-27)

Eszközök annak ellenőrzésére, hogy a foglalómotor ugyanazokat az időpontokat kínálja-e, mint a **Salonic saját nyilvános foglalója** (böngészőből, vendégként; a Salonic naptár-API-ját nem hívjuk közvetlenül, mert az nem az igazság-forrás). Háttér és eredmények: `docs/booking-engine/SALONIC_SAVOK.md`.

Foglalást SOHA nem indítanak (az adatlapot nem töltik ki), mérőkódokat (GTM, Meta, TikTok, Google) blokkolnak. A motor a robotot (`navigator.webdriver`) nem számolja a belső tölcsérbe.

- `ui-lib.mjs`: a közös segédek. `salonicIdopontok()` a Salonic dátumválasztóját járja végig (minden szabad napra rákattint, az adatlap-linkekből olvassa az időpontokat), `motorIdopontok()` a mosaicheadspa.hu foglalómotorját (alapból az éles; `MOTOR_URL=...` előnézetre vagy helyi szerverre).
- `szolg.mjs <könyvtár>`: a Mosaic Hair szolgáltatásainak listája (`hair-szolg.json`).
- `mind.mjs <könyvtár> <kimenet.json> [párhuzam]`: Betti minden szolgáltatására Salonic-felület vs. motor.
- `audit.mjs <könyvtár> <salonic-fiók> [max]`: minden helyszín / szolgáltatás kezdési rácsa (hány percenként ajánl kezdést). Fiókok: `mosaicheadspa`, `mosaic-hair`, `mosaic-oxigen`, `mosaic-elysion`, `mosaic-pmu`, `a76`, `gyogytornaszomhu`, `medicalpiercing`.

Futtatás: `node tools/salonic-egyezes/audit.mjs /tmp/ki mosaic-hair`. A Salonic-oldalra kerülő átirányítást a `?mh_nincs_atiranyitas=1` kikerüli (a `salonic/atiranyitas.js` figyeli).

Ismert buktatók (mind előfordult, lásd a doksit): a Salonic egy nap időpontjait ~1,5 mp késéssel tölti be; a túl gyors kattintást elnyeli (újrapróbálás kell); a szomszéd hónap „kilógó” napja ugyanazt a címkét viseli; a motor a konzultációnál nem kérdez fodrászt.
