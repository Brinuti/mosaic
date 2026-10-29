# Google ARNYEK feltöltés válasz-napló (UJ-11, draft)

Kérés és specifikáció: #167 6321101806 (01-MERES + ChatGPT), 4. pont. **2026-10-28: újraépítve a `main`-re** (a korábbi #461 a #460 → #459 → #458 láncra épült; a #459 / #460 lezárva – 01-MERES 6462419230 –, a #458 a `main`-ben van). A tartalom a három eredeti commit cherry-pickje a `main`-re; az egyetlen kézi lépés a `qa-nap.js` ütközésének feloldása (a #460 `meta_nevegyezes` szekciója NEM került át). **Merge és élesítés csak DECISION után** (D1-sémabővítés + új végpont + Zapier-lépés). A Zap-módosítás KIZÁRÓLAG Zapier-draftként készül, élő Zaphoz nem nyúlunk.

## Mi ez
A Google-feltöltést egy Zapier-webhook végzi (`GOOGLE_ARNYEK_WEBHOOK_URL`); a motor a Google válaszát nem látja. Ez a változtatás naplózza a feltöltés kimenetelét, hogy az M0-5 kapu „0 elveszett feltöltés” bizonyítható legyen.

## Változások
1. **D1-séma (additív, `meres_kuldes`)**: `ad_user_data TEXT` (a KÜLDÉSKORI érték: `GRANTED` / `DENIED` / NULL) és `google_reszleges_hiba TEXT` (NULL = nincs visszajelzés, `''` = a Google elfogadta, `KOD` = részleges hiba / `ZAP_HIBA`). `elosztas.js` `KULDES_BOVITES`: az első `meresSema` hívás hozza létre (ALTER TABLE ADD COLUMN, a meglévő sorok NULL-ok). Nincs külön tábla.
2. **Küldéskor** (`elosztas.js`): a google sor `ad_user_data`-ja a kérés `ad_user_data` mezőjéből (try/catch-ben: a naplókiegészítés hibája nem akaszthatja meg a küldést).
3. **Új végpont** `POST /api/meres-google-valasz` (`functions/api/meres-google-valasz.js`, `netlify/lib/meres/google-valasz.js`): saját, szűk kulccsal (`x-meres-google-kulcs` fejléc; a kulcs SHA-256-ja a `MERES_GOOGLE_VALASZ_KULCS_HASH` env-ben; fejléc nélkül / rossz kulccsal / beállítás nélkül 404, query-kulcs nem fogadható el). Törzs: `{ esemeny_id (= a Zap order_id-ja) | id, kod, uzenet?, elfogadva?, elutasitva? }`. Csak a meglévő `platform='google'` sort egészíti ki (`google_reszleges_hiba` + a `platform_valasz` végére maszkolt üzenet); új sort nem hoz létre; az ELSŐ visszajelzés marad. Az üzenetből kikerül a gclid/gbraid/wbraid érték, az e-mail, a 32+ karakteres hex (hash); max 300 karakter. A fő admin-kulcsot a Zapnek NEM adjuk.
4. **qa-nap** `google_valasz`: üzletáganként és összesen: `elkuldve`, `google_elfogadta`, `denied`, `reszleges_hiba`, `nincs_visszajelzes` (csak darabszám; `{ sema_hianyzik: true }` az új oszlopok nélkül; a lámpát nem érinti).

## Védett fájlok, hash
`netlify/lib/meres/elosztas.js`: `f8a78f8430` (#458) → `8b15e0d11f`; `netlify/lib/meres/qa-nap.js`: `de6205f0eb` (`main`) → `4651faf49d` (a korábbi `079f69ded0` a #460 `meta_nevegyezes` szekciójával együtt számolt). A többi védett fájl változatlan: platformok 67911aace4, esemeny-modell 4342e6f09b, meta-bongeszo-kulcs 62143dda2b, vegpontok 085bed6aad. A T2-rögzítő `sema_ujjlenyomat`-a a két új oszlop miatt szándékosan változik a deploy után (új T2-kiinduló rögzítés kell, ha a mérési oldal így akarja).

## Zapier-draft (KÉSZ, nem publikált)
A Zap egy durable workflow (kód); a módosítás a `docs/booking-engine/zapier/` mappában (eredeti = rollback-másolat, módosított, README). Zapier-draft ID `01a15f66-ef0c-7fa3-8246-4ef15e3eaa10` (az élő verzió `01a1122d-fc48-75d7-b7cf-69f4bf070aeb` változatlan). A Zapier Google Ads action a Google `partialFailure`-t nem adja vissza: a `""` kód = „a Zapier action nem dobott hibát”.

## Mit kell hozzá beállítani (élesítéskor, DECISION után)
- Cloudflare Pages (Production, Secret): `MERES_GOOGLE_VALASZ_KULCS_HASH` = a Zapnek adott kulcs SHA-256-ja. A kulcs a Zapier Webhooks-lépés fejlécében él (a repóba/commitba/chatbe nem kerül).
- Zapier Storage: `mosaic_google_valasz_kulcs` (≥ 32 karakteres kulcs; SHA-256-ja az env-be). A Zap a Google Ads lépés után visszahív: `esemeny_id` = `order_id`, `kod` (`""` / `ZAP_HIBA` / `ZAP_KIHAGYVA`), `uzenet`, `elfogadva`/`elutasitva` – lásd a README-t.

## Tesztek
`tools/test-google-valasz.mjs` (5 teszt, valódi SQLite): séma, küldéskori GRANTED/DENIED, rögzítés (OK / részleges hiba / első marad / maszkolás: click ID, e-mail, hash nem kerül a naplóba / hibás kód / ismeretlen sor / nem google sor), végpont (kulcs csak fejlécben, 404/405/400/413/503, siker), qa-nap sor + régi séma. A régi csomag zöld: test-qa-nap 45, test-meres 51, test-adatgazdagitas 21 (golden érintetlen), test-google-proba 26, test-meta-nevegyezes 6, test-meta-pmu-nev 7, test-meta-bongeszo-kulcs 22, test-booking-flow 41, test-lepes-meres 29, test-gclid-r1r3 14, test-lpt-forras 58.

## Rollback
A PR visszavonása (a két oszlop az adatbázisban maradhat, nem zavar: NULL-ok), a végpont kulcs nélkül 404. A Zap draft elvetése.

## Mérést érint
Igen (Google ARNYEK válasz-napló, QA-riport, D1-séma).

## 2026-10-28 review-javitas (01-MERES 6463412395)
Az `uzenetTisztit` a click ID / e-mail / hash mellett mostantol a telefonszamot (>= 9 szamjegy, +36 / 06 / szokozos / kotojeles; `[tel]`) es a kulcs-ertek alaku nevet (name / first_name / last_name / full_name / nev / keresztnev / vezeteknev; `[nev]`) is maszkolja. Szabad szovegben a nev mintaval nem ismerheto fel; a Zap-visszahivas torzsebe nevmezo nem kerul (dokumentalt kikotes). Teszt: `test-google-valasz` 8/8. Vedett hash valtozatlan (elosztas.js 8b15e0d11f, qa-nap.js 4651faf49d).
