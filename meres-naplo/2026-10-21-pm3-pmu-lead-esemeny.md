# 2026-10-21 - PM-3: /foglalo-pmu masodlagos lead-esemenyek (dataLayer)

**MERES ERINTO (csak a bongeszoi dataLayer; kuldest, elo konverziot, futo hirdetest, foglalasi folyamatot, GTM-et / kulso fiokot NEM erint).**

## Engedely
A meresi oldal kerese es jovahagyasa: #167 6309629120 (7. pont: "Mehet kulon draft PR-ben ... merge nincs, az a DECISION utan jon"). A javaslat: #167 6309387295, 5. pont.
**Merge nincs, amig DECISION nem ad szamot; a platform-lekepezes (GTM-cimke, Meta / TikTok / Google) kulon DECISION.**

## Valtozas
- `assets/js/foglalo-pmu.js`: `pmuLead` segedfuggveny (PM3-BEGIN / PM3-END jelolesek) + 2 hivas:
  - `pmu_foto_lead`: a `pmu-proba-foto` urlap SIKERES elkuldese utan (a `foto-kesz` nezet es a fotok torlese elott); mezok: `event`, `business: 'pmu'`, `lead_type: 'foto'`, `source_page: '/foglalo-pmu'`, `event_id` (veletlen, beadasonkent), `ag` (B | D), `foto_db` (1..5), `idopont_kert` (0 | 1).
  - `pmu_visszahivas_lead`: a `pmu-proba-visszahivas` urlap SIKERES elkuldese utan, az atiranyitas (`/pmu-vh`) ELOTT; mezok: `event`, `business`, `lead_type: 'visszahivas'`, `source_page`, `event_id`, `mikor_napszak` (delelott | kora_delutan | delutan | barmikor).
  - Csak `mhSuti.engedely('ana')` mellett; `mhProba` jelu bongeszoben nincs; nincs halozati keres, suti vagy tarolo-iras. A `/pmu-vh` koszonooldal marad a visszahivas elsodleges lead-hordozoja (az uj esemeny masodlagos, kulon nevvel).
  - Nincs nev, e-mail, telefon, foto, kezeles- vagy idopont-szoveg, URL.
- `tools/test-pmu-lead.mjs` (9 teszt).

## Tesztek
`node --test tools/test-pmu-lead.mjs` 9/9 (hozzajarulassal pontosan 1 esemeny; hozzajarulas nelkul / proba / ismeretlen tipus: 0; azonos azonositoval masodszor nem; tiltott localStorage nem dob; a hivasok helye a forrasban; nincs fetch / sendBeacon / suti / tarolo-iras). `test-meres` 51/51, `test-lpt-forras` 58/58, `node tools/netlify-build.mjs` rendben.
**Nem futott:** bongeszos (Playwright) vegigjatszas a fotos / visszahivas agon - ebben a kornyezetben nincs `playwright-core` / node_modules; a merge elott a sajat kornyezetben lefuttatando (a `tools/koszono-tisztitas-pw.mjs` mintajara: pontosan 1 bejegyzes beadasonkent, hozzajarulas nelkul 0, F5 / vissza utan nincs uj).

## Rollback
A PR revertje (a `pmuLead` ket hivasa es a segedfuggveny torlese); mas allapot nem valtozik. Mivel az esemenyre nincs GTM-cimke, a revert nelkul sem megy ki semmi platformra.
