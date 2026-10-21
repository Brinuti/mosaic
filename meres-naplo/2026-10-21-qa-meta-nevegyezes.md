# QA-nap: "Meta névegyezés" sor (UJ-12) + `arnyek_eles` jelző a T2-rögzítőben (draft)

Kérés: #167 6321101806 (01-MERES + ChatGPT), 1. pont. **A #459-re épül** (alap ág: `claude/meta-arnyek-pmu-nev`, az pedig a #458-ra). Csak olvasó riportmező; küldést, lámpát, kapcsolót nem érint. Merge a #458 → #459 után, DECISION kell (a QA-sor önmagában kockázatmentes, de a hash-változás miatt dokumentált).

## Mit ad
`GET /api/meres-admin?qa=nap&datum=…` válaszában új mező: `meta_nevegyezes`:
`{ osszes, egyezik, pmu_lekepezes, besorolasi_elteres, kupon_utvonal, nincs_bongeszos_esemeny, nincs_erkezes }` (csak darabszám, PII nélkül; `null`: hiányzó séma / szekció-hiba).
A nap (Budapest) ablakában létrehozott, ELKÜLDÖTT, `mb_` Meta alapesemények szerveres neve vs a böngészős tag 213 (GTM web, élő v54, 2026-10-21 kiolvasva) neve:
- `egyezik`: azonos Meta-eseménynév;
- `pmu_lekepezes`: a szerver `PMU_FoglalasElso` / `PMU_Konzultacio`, a böngésző `PMU_Foglalas` (a #459 kapcsoló mögötti leképezése ezt szünteti meg; az osztály a kapcsolótól FÜGGETLENÜL az alapnevekkel számol);
- `besorolasi_elteres`: más név – a Salonic „új vendég” jelzése vs az URL `first_booking` / ár (a szerver marad a Salonic jelzésénél, mérési oldal + ChatGPT döntése);
- `kupon_utvonal`: `/ajikartya-ok` (a 212-es trigger nem illeszkedik, a böngésző nem küld; 10-18 óta 0);
- `nincs_bongeszos_esemeny` (más útvonal / kapu), `nincs_erkezes` (nincs érkezési sor): kiegészítő osztályok.
A böngészős névszabály pontos mása: `netlify/lib/meres/meta-bongeszo-nev.js` (új, nem védett). Ha a GTM 213-as tag szabálya változik, ezt a fájlt kell követni (a teszt a 10-21-i táblát rögzíti).

## Mellékesen (a korábban jelzett, következő qa-nap.js PR-be szánt tétel)
`t2Start().arnyekcelok.tiktok.arnyek_eles` = `TIKTOK_ARNYEK_ELES === '1'` (a #453 jelzője a T2-rögzítőben látszik). Csak riportmező.

## Védett fájl, hash
`netlify/lib/meres/qa-nap.js`: `de6205f0eb` (main, #451 óta) → `533adf86c6`. A többi védett fájl nem módosul ebben a PR-ben.

## Tesztek
`tools/test-meta-nevegyezes.mjs` (6 teszt: a 213 névszabálya 22 esetre, kapuk, osztályozás, qaNap-integráció valódi SQLite-on – ablak, csak elküldött `mb_` alapesemények, hiányzó tábla → `null`; `arnyek_eles`). Zöld a régi csomag: test-qa-nap 45, test-meres 51, test-adatgazdagitas 21 (golden érintetlen), test-meta-pmu-nev 7, test-meta-bongeszo-kulcs 22, test-booking-flow 41, test-lepes-meres 29, test-gclid-r1r3 14, test-lpt-forras 58.

## Rollback
A PR visszavonása; a mező eltűnik, más hatás nincs.
