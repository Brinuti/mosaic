# Sutisav-statisztika - tesztnaplo (2026-10-13)

Forras: a meresi oldal SPEC-je (#167 125. komment, GPT atnezte). Doksi: `docs/booking-engine/SUTI_STATISZTIKA.md`. **Meresi hatas:** a sav megjeleneset / dontesét szamolja nevtelenul; Meta-pixelhez, GTM-hez, Consent Mode jelekhez, a sav szovegehez / kinezetehez, a vedett koszonooldalakhoz nem nyul.

## Helyi futtatas (node --test, a friss origin/main fole)
| fajl | pass | fail |
|---|---|---|
| test-suti-stat (uj: S1-S8 szerver, K1-K7 kliens) | 15 | 0 |
| test-meres | 48 | 0 |
| test-fuggetlenseg | 7 | 0 |
| test-salonic-direct | 71 | 0 |
| test-salonic-adapter / -flow / -id / -layer / -kulcs / tobbi | zold | 0 |
| test-foglalo-atkotes | 18 | **1** (korabbi, ettol fuggetlen: oxigen-uj.js:134, 19. eset) |

Mutacio-ellenorzes (a kliens tesztek elesek): a `megjelent` hivas kikapcsolasa -> K1, K2, K5 pirosra valt; a `statDontes()` a `rogzit()` ele helyezve -> K1 piros; a Fodrasz pixel lista modositasa (`fodrasz-ok` -> `fodrasz-ok2`) -> K6 piros. Visszaallitas utan 15/15 zold. K7: csak az eles domainen (ELES_DOMAINEK) kuld; localhost / pages.dev / hasonlo nevu idegen domain nem.

## Valodi bongeszo (Chromium, `tools/meres-proba/suti-stat-bongeszo.mjs`, napló: `suti-stat-bongeszo-2026-10-13.txt`)
- A) 6 oldal x mobil/desktop (a `www.mosaicheadspa.hu` a helyi szerverre van kepezve, igy a suti.js az `eles` agon fut; a nem helyi kulso keresek elutasitva, a paritas-osszevetesben szerepelnek): `megjelent` pontosan 1 db, helyes `oldaltipus` / `eszkoz`, `text/plain` POST; dontesek (elfogad_minden 1,1,1; elutasit 0,0,0; reszleges 1,0,1; minden pipa = elfogad_minden); visszatero latogato: nincs sav, nincs esemeny.
- B) paritas az `origin/main` suti.js-szel (accept / reject / reszleges x mobil / desktop): a sav DOM-ja bajtazonos, szamitott stilus + meret azonos, **a sav kepe pixelre azonos**, ugyanaz a localStorage (`mh_cc`) / sessionStorage / suti (`consent-policy`); az egyetlen uj halozati keres a `/api/suti-stat` (2 beacon / futas).
- C) fail-open: a vegpont 500 / halozati hiba / lefagy -> a dontes 26-39 ms alatt (a kattintastol) rogzul, a sav eltunik, `mhSuti.engedely` valtozatlan, nincs kezeletlen hiba.
- Eredmeny: minden ellenorzes rendben.
