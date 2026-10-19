# Hozzajarulas: MINDEN platformra elfogadott hozzajarulas (DECISION #202 javitas) - meresi naplo, 2026-10-19

Vendegadat, kulcs, gclid nincs benne.

## 1. Mi ez (forras)
- Feri (2026-10-18): **nincs sutisav**, minden platform elfogadott hozzajarulassal kapja az adatot (#167 6273378563, DECISION #202; Feri 2026-10-19 kozvetlen jovahagyasa a munkamenetben).
- TENY (a meresi oldal Google Ads API-bol, #167 6273378563): a fix `DENIED` (ad_user_data) miatt a sikeres HeadSpa Google-feltoltesekbol 0 konverzio lett.
- Kerese: ez menjen ki a `google_proba` futas ELOTT, hogy a proba is `GRANTED`-del menjen.

## 2. Valtozas
- `netlify/lib/meres/hozzajarulas.js`: `platformSzabaly(platform, hozz, env)`: Meta, TikTok, Google, GA4 mind `felhasznaloi_adat: true`, `ad_user_data = ad_personalization = GRANTED`, a rogzitett dontestol fuggetlenul (dontes nelkul / elutasitva is). A regi szabaly `valosSzabaly()`-kent megmarad; **visszagorgetes kodvaltoztatas nelkul**: `MERES_HOZZAJARULAS_VALOS=1`. A naploban (`meres_kuldes.hozzajarulas`) a ROGZITETT allapot (`allapot`) es az alkalmazott szabaly (`szabaly`) is latszik.
- `netlify/lib/meres/elosztas.js`: a szabaly kapja az `env`-et.
- `netlify/lib/meres/platformok.js`: a Google-torzs + `ad_personalization` (a Zapier-webhook ignoralja, amig a Zap nem hasznalja); GA4 `consent` mindig `GRANTED` / `GRANTED` (a meglevo logika a szabalybol veszi).
- `netlify/lib/meres/google-proba.js` (VEDETT, valtozik, dokumentalt): a proba torzse `ad_user_data` + `ad_personalization` = `GRANTED` (korabban `DENIED`); a fail-closed `probaEllenorzes` ezt kovetel (DENIED = tiltva); a zart mezolista + `ad_personalization` (8 mezo); a terv + a naplozott hozzajarulas JSON is GRANTED. Vendegadat / hash-elt azonosito a probaban tovabbra sincs (zart lista).
- Tesztek: `test-google-proba` (25), `test-meres` (48; uj: hozzajarulas-szabaly + MERES_HOZZAJARULAS_VALOS regresszio), `test-adatminimalizalas` (8), `test-qa-nap` (43), `test-salonic-direct` (75, GOLDEN friss), `test-sd-194` (18), `test-sd-headspa` (12), `test-sd-smoke` (14): mind zold.

## 3. Golden fixture (`tools/fixtures/golden-motor-kerelem.json`) - SZANDEKOS ujrairas, diff-bizonyitek
`node tools/meres-proba/golden-motor.mjs --ir`; a regi es az uj kep osszevetese (300 kerelem, 6 elosztas-eset, ugyanannyi):
- Google-torzs: **+ `ad_personalization: "GRANTED"`** (20 kerelem: 10 `teljes` + 10 `hozzajarulasNelkul`; 4 elosztas-hivas).
- Google-torzs, `hozzajarulasNelkul` valtozat: `ad_user_data` `DENIED` -> `GRANTED` (10).
- GA4-torzs, `hozzajarulasNelkul` valtozat: `consent.ad_user_data` es `consent.ad_personalization` `DENIED` -> `GRANTED` (15 + 15).
- D1 naplo: a `meres_kuldes.hozzajarulas` oszlop `szabaly` resze (megjegyzes / jel szoveg) es a Google-sor `kerelem` oszlopa (ad_personalization) valtozik; a regi oszlopok tobbi mezeje (esemeny, platform, ertek, allapot, http_status stb.) es a Meta / TikTok torzsek BAJTRA azonosak.
- Egyeb mezo, URL, esemeny, ertek, order_id, azonosito nem valtozott.

## 4. Vedett elemek (blob-hash), main -> PR
- `netlify/lib/meres/qa-nap.js` 2334390be3 -> 2334390be3 (valtozatlan)
- `netlify/lib/meres/esemeny-modell.js` 4342e6f09b -> 4342e6f09b (valtozatlan)
- `netlify/lib/foglalas-kulcs.js` e1448b4d13 -> e1448b4d13 (valtozatlan)
- `netlify/lib/meres/vegpontok.js` b5e3881fc7 -> b5e3881fc7 (valtozatlan; a #418 modositja, kulon PR)
- `netlify/lib/meres/google-proba.js` f6e5bf9d13 -> e483652644 (**VALTOZIK**: a proba jele GRANTED; dokumentalt, ez a PR targya)
- `netlify/lib/meres/hozzajarulas.js` beb2b760ea -> 95a7fadadd; `platformok.js` 8f2a229d83 -> d38fa8e012; `elosztas.js` ae57d630a9 -> 7ef66e862b; `tools/fixtures/golden-motor-kerelem.json` 563a14cf9c -> 8866296343 (szandekos, lasd 3.)

## 5. Rollback
- Azonnali, deploy nelkul nem lehetseges (a `wrangler.toml` valtozo deployt kivan); a koddal: a merge-commit revertje. Env-visszagorgetes: `MERES_HOZZAJARULAS_VALOS=1` a Production `[vars]`-ban + deploy (a valos-jel szabaly visszaall; a google_proba tovabbra is GRANTED).
- Kimeno kuldes kikapcsolasa a szokott veszkapcsolokkal (`iras` be:false / `platform:google` / `mind`).

## 6. Hatas / kockazat
- Csak ARNYEK-celpontokra megy (a platformok.js vedelmei valtozatlanok: elo ID tiltva). Elo konverzio, foglalasi folyamat, futo hirdetes nem valtozik.
- A Google ARNYEK akciokban (masodlagos, licitet nem vezet) az eddig DENIED-del erkezo feltoltesek ezentul GRANTED-del mennek: ez a Feri-dontes (#202) celja.
