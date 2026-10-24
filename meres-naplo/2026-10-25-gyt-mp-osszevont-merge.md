# Összevont merge: GYT RETRACTION (#476) + MP `kihagyva:nem_igazolt` napló (#477) – DECISION #227

**MÉRÉST ÉRINT.** DECISION #227 (2026-10-24 09:40, mérési oldal + ChatGPT; #167 6381430377 és Drive DECISION-LOG #227): mehet **10-25-én, egyetlen merge-ben**, összevont ágon; `GY_GADS_KIIGAZITAS = ki` marad (éles és előnézet), a `dry` NEM része, az `eles` nem javasolt. Merge-feltétel: független review PASS az **összevont végső SHA-ra**, védett hash-ek, rollback, vendégadat nincs.

## Összetétel
- ág `claude/gyt-mp-merge` = `claude/gyt-retraction` (`7297718f`, #476) + `claude/mp-nem-igazolt-naplo` (`e6401c48`, #477) tiszta merge (a két PR különböző mappákat érint: `gyogytorna/` ill. `medicalpiercing/`) + a #227 3. pontja szerinti GYT-ablak: a `nincs_konverzio` határa = min(kiigazítási sor felvétele + 72 óra, feltöltés + 120 óra); `dry`-ben a csendes `nincs_konverzio`-kockázatú sorok (feltöltés újrapróbával elfogadva) `hiba = 'kockazat_ujraproba'`, a riport számolja. Csak a `gyogytorna/lib/gkiigazitas.js` (+ teszt + doksi) változott a két fejhez képest.
- Tesztek: `npm run teszt` (gyogytorna) **78/78**; MP: `test-mp-tiktok` 21/21 + a többi `test-mp-*` zöld (lásd a két külön naplót).

## Rollback
A merge-commit revertje; vagy `GY_GADS_KIIGAZITAS = "ki"` (alapérték, ez van); a `gy_kiigazitas` tábla benne maradhat; az MP-naplósorok ártalmatlanok (120 nap).
