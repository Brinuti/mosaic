# 2026-11-01 – fotós előszűrés + foglalás (foglaló-átalakítás), menü, /pmu-foto-ok – teszt-napló

**Mérést érint: IGEN** (a foglaló-motor `assets/js/foglalo-pmu.js` védett fájl; új köszönőoldal `/pmu-foto-ok`; a `booking_*` dataLayer-lépések új `foto_ut` jelölése; a `pmu_foto_lead` új `foglalassal`-mezője). Új konverzió-bekapcsolás: **nincs**; a cél éppen az, hogy a fotós foglalás NE legyen konverzió. Részletek, hash, rollback: `docs/FOTOS_FOGLALAS.md`.

## Tesztek (helyi könnyű szerver, mockolt Salonic, rögzített óra 2026-11-01; vendégadat: kitalált „Teszt Elek”, nem megy ki semmi)
- `tools/eltavolitas-teszt/foto-foglalas.test.mjs` **8/8**: kérdés az időpont előtt; nem fotós út (nincs szűrő, nincs levél, belső számláló: service/slots_loaded/slot/form_start); fotós út (fotó kötelező; napok [9, 10]; 22:59:59Z kimarad, 23:00:00Z bent; hozzájárulás nélkül nem megy; a levél: Ág/Kezelés `FOGLALÁSSAL`, Választott időpont, `foto1`; `pmu_foto_lead.foglalassal = 1`; a lépések `foto_ut = 1`; nincs submit/success; a belső számláló csak a `service`-t kapja; vissza: adatlap → időpont → kérdés); `/pmu-foto-ok` átirányítás (`?g=` marad, nincs first_booking/price/bookingUrl/gclid; a köszönőn nincs `booking_*` / `pmu_*` esemény) és a nem fotós `/pmu-ok?…mh_proba=pmu`; kezelésváltáskor a kérdés újra; a telefonos visszahívás ág változatlan (nincs `FOGLALÁSSAL`, `foglalassal = 0`); a 491949 csak nov. 9-től.
- `tools/eltavolitas-teszt/eltavolitas.test.mjs` **19/19** (a landing: 3 lépéses „Hogyan zajlik?”, `-v2` képnevek, nincs `kerdes=kihagy`).
- Védett csomagok: `test-pmu-lead` 9/9 (a zárt mezőlista `foglalassal`-sal bővítve), `test-gclid-r1r3` 14/14, `test-lpt-forras` 59/59, `test-foglalo-atkotes` 20/20, `test-foglalas-kulcs` 46/46, `test-foglalas-cel` 13/13.
- Fejléc: `tools/headspa-teszt/fejlec.test.mjs` 42/44, `tools/ajandek-teszt/menu.test.mjs` 19/20, `tools/headspa-teszt/angol.test.mjs` 12/15 – **a baseline (origin/main) azonos** (a hibák a hónapváltás szövegeihez / külső kérésekhez kötődnek, nem ehhez a változáshoz); az új menüsorrend (Árlista · GYIK · Kapcsolat · FOGLALÁS) a fejléc-teszt 11 pontos sorában ellenőrzött.
- Képernyőképek: asztali + mobil menü (legördülő, FOGLALÁS jobb szélen), a foglaló 5 lépése mobilon.

## Olvasásos ellenőrzés (külső rendszerek, módosítás nélkül)
- D1 `mosaic-foglalas-kulcs` / `meres_kapcsolo`: `salonic_direct:pmu` = BE (lásd FOTOS_FOGLALAS.md 3.2: a szerveroldali út a mérési oldal dolga).
- A Zapier-lánc nem módosult (a levél tárgya és mezőnevei változatlanok).
