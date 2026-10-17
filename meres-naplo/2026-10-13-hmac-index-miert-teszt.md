# Vendeg-hash index "miert" kod – teszt-naplo (2026-10-13)

**MERESEKET ERINTO** valtoztatas (a Salonic-direct safety net hash-index horga): a `/api/foglalas-egyeztetes` valasza uj, additiv kulcsot kap (`vendeg_index`); a parositas, az esemenykuldes, az index-iras viselkedese NEM valtozik (fail-open). Kulso fiokhoz nem nyul, a platformokra nem kuld. A mérési oldal kerese: #167 137. komment (6153451489); az ok-elemzes: 138. komment (6153599631). **NE MERGELD a befagyasztas felodasaig.**

Alap: `origin/main` 70a480b. Valtozott: `netlify/lib/meres/salonic-direct.js` (`mezoAllapot`, `vendegMezoAllapot`, `vendegIndexSor` + `kod` + `mezok`), `netlify/lib/foglalas-kulcs.js` (`vendegIndexJelentes`, `hibaKod`; a horog az eredmenyt a valaszba teszi), `tools/test-vendeg-index-miert.mjs` (uj), `docs/booking-engine/SALONIC_DIRECT.md`, ez a naplo. A vedett elemekhez (`assets/js/suti.js`, `booking-engine/`, `klon/*-ok.html`, `_redirects`, `_headers`) nem nyul.

## Az eredeti hiba (D1, csak olvasas, PII nelkul)
A #288 (1791885187) utan letrehozott 12 `foglalas_egyeztetes` sorbol 2-hez nincs `foglalas_vendeg` sor (`9a03d9f7` headspa 15:49Z, `dca36449` headspa 18:32Z; mindketto parositott, `kulcs_forras='salonic-oldal'`). A `meres_kuldes.kerelem` jelenlet-bitjei (`"em"` / `"ph"` kulcs, ertek nelkul): a 10 indexelt levelnel a Meta-keresben `em` ES `ph`, a 2 hianyzonal CSAK `ph` → a levelhez nem tartozott ervenyes e-mail. A `vendegIndexSor` ilyenkor `{ok:false, miert:'nincs ervenyes e-mail'}`-t adott, a horog viszont eldobta a visszateresi erteket, igy semmi nem latszott.

## Tesztek
`node --test tools/test-vendeg-index-miert.mjs` → **9 / 9 PASS** (M1–M9): enum-only mezo-allapot (hianyzik / ervenytelen_formatum / ervenyes, ertek soha); `ok_uj` → `ok_meglevo`; **a 2026-10-13-i eset** (telefon van, e-mail nincs → `kihagyva` / `nincs_ervenyes_email`, nincs sor, a parositas allapota ugyanaz); ervenytelen e-mail formatumok (4 alak) kulon jelolve; `nincs_vendeg_mezo` / `vendeg_nem_objektum`; `nincs_guest_hmac_kulcs`, `ismeretlen_host`; kapu zarva = nincs `vendeg_index` kulcs; kivetel = `hiba` / `kivetel`, a hibauzenet PII-mentesitve (e-mail → `<email>`, 6+ jegyu szamsor → `<szam>`, <= 120 karakter), a parositas nem akad meg; `vendegIndexSor` backfill/szaraz alakja visszafele kompatibilis (a regi `miert` szoveg valtozatlan). A valaszokban nincs e-mail, telefon, nev (minden esetben ellenorizve). Mutacio: az eredeti kodon a tesztfajl nem fut le (az uj exportok hianyoznak).

## Meglevo tesztek ugyanezen az agon
salonic-direct **71**, foglalas-kulcs **42**, meres **48**, fuggetlenseg **7**, foglalas-esemeny **15**, egyeztetes-sor **8** – mind zold (a teljes csomag eredmenye lent).

## Teljes csomag (`for f in tools/test-*.mjs; do node --test "$f"; done`)
booking-flow 41, booking-id 11, booking-layer 10, business-config 10, egyeztetes-sor 8, elo-foglaltsag 7, foglalas-esemeny 15, foglalas-kulcs 42, fuggetlenseg 7, gorgeteszar 3, halott-gombok 4, koszono 5, lepes-meres 20, meres 48, qa4-smoke 7, salonic-adapter 34, salonic-direct 71, validation-replay 2, **vendeg-index-miert 9** – mind PASS; kivetel egyedul a korabbi, ettol fuggetlen `test-foglalo-atkotes` 19. eset (Task #67, a `main`-en is bukik).
