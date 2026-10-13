# Napi T2 QA-vegpont – teszt-naplo (2026-10-13)

MERESEKET ERINTO valtozas: **csak olvaso** admin-vegpont (`GET /api/meres-admin?qa=nap&datum=YYYY-MM-DD`); mérőkódot, pixelt, GTM-et, esemenykuldest, konverziot **nem** erint, kulso fiokhoz nem nyul, nem ir D1-be. Spec: #167 131. komment (6150412185).

Alap: `origin/main` bd0fd45. Valtozott fajlok: `netlify/lib/meres/qa-nap.js` (uj), `netlify/lib/meres/vegpontok.js` (+1 import, +1 sor a `kezelAdmin` elejen), `tools/test-qa-nap.mjs` (uj), `docs/booking-engine/QA_NAP.md` (uj), ez a naplo. A vedett elemekhez (`assets/js/suti.js`, `booking-engine/`, `klon/*-ok.html`, `_redirects`, `_headers`) nem nyul.

## 1. Egyseg- es integracios tesztek
`node --test tools/test-qa-nap.mjs` → **26 / 26 PASS** (N1–N23 + N7b + N24 + N24b; valodi SQLite a D1 helyett, hamis ora, halozat nelkul).

| # | Mit bizonyit |
|---|---|
| N1 | Budapest-nap → UTC: nyar `22:00Z`, tel `23:00Z`, oszi atallas (25 oras nap), tavaszi atallas (23 oras nap); 11 ervenytelen datum (nem letezo nap, regi, tul jovobeli, SQL-injekcios szoveg, ISO-idobelyeg) = elutasitva |
| N2 | 401 (nincs kulcs), 403 (rossz kulcs), URL-ben kapott kulcs = 401, POST / PUT / DELETE / PATCH = 405, `Cache-Control: no-store`, hash nelkuli kornyezet = 403, nincs DB = 503 |
| N3 | rate-limit: 30/perc/IP, a 31. = 429, masik IP nem erintett, 1 perc mulva ujra nyitva; rossz kulcs 5/perc utan 429 |
| N4 | hibas `datum` / `proba` = 400; a `kapcsolok` / `fuggo` / `source_id` ag valtozatlan (kulcs nelkul tovabbra is 404) |
| N5 | `valos`: [from, to) hatarok (ejfel bent, a kovetkezo napi ejfel kint), uzletagonkent, parositott / parositatlan / egyeb, lemondas-osztalyok (a `foglalas-kulcs.js` valos eredmeny-szovegeinek elotagja szerint), kulcs nelkuli sor = `ismeretlen` |
| N6 | proba-szabaly: alapbol minden valos; `&proba=<uuid8>` kizarja, a `proba_kizarva` / `proba_megadva` mutatja |
| N7–N8 | arnyek platform × allapot × forras; alap-esemeny szamlalo (ernyo, ajandekkartya nem); lampa: 0,9 × valos.parositott hatar (pontosan 0,9 = zold), parositott=0 → `n/a`, GA4 / Google tajekoztato; `arany` |
| N7b | a lampa alapja a `valos.parositott` (a parositatlan level nem tesz sargava); `arany` (valos-hoz) es `arany_parositott` |
| N9–N11 | biztonsag: **minden** elo ID (Meta 5, TikTok, GA4, Google 9) → piros, szohatar-vedelem (nagyobb szam resze nem talalat); dupla (a unique index nelkul is kimutatja); nem-ARNYEK cel; `arnyekCel` tabla (Meta dataset + tesztkod, TikTok pixel + tesztkod, GA4 nem elo, Google ARNYEK akciok, olvashatatlan = nem) |
| N12 | sd: `sd_allapot` es `foglalas_reschedule.allapot` darabszamok, a nap szerint |
| N13–N14 | `pre288`: talalat / hash-index van / mas uzletag / ±60 perc folott / a #288 utani regi / sd-foglalas mellett / proba-kizaras; minta ≤ 20, `db` a teljes |
| N15 | `foglalas_vendeg` forras szerint |
| N16 | PII: seedelt nev/tel/e-mail hash-ek, e-mail cim, teljes UUID-k, `user_data` – **egyik sincs** a valaszban; nincs UUID-alak, nincs 32+ hexa, nincs `@`, nincs kulcs |
| N17–N18 | CSAK OLVAS: a tablak tartalma valtozatlan tobb hivas utan; ures adatbazison nem hoz letre tablat; minden kiadott SQL `SELECT` |
| N19 | hianyzo tablak / regi sema = 200; egy szekcio hibaja nem viszi el a tobbit, `szekcio_hibak`, a lampa sarga, a hibauzenet nem kerul ki; teljes D1-hiba = sarga (nem zold) |
| N20 | 23:59:59 / 00:00:00 Budapest hatar |
| N21 | lemondas-osztaly elotag |
| N22 | kiment, de hibazott kerelem celpontja is csak ARNYEK lehet (hiba + elo dataset = piros) |
| N24 / N24b | `post288_missing_hmac_index` (jovahagyva, #167 137.): #288 utani PARositott level `foglalas_vendeg` sor nelkul; a #288 elotti, az indexelt, a parositatlan (kulon `parositatlan_db`) es a proba nem; a hatar pontos (PRE288_EPOCH-1 kint, PRE288_EPOCH bent); minta <= 20; csak olvas |
| N23 | "ismeretlen" uzletag csak ha van oda eso adat; nincs rajta sarga lampa; a biztonsag piros lehet |

## 2. Teljes tesztcsomag (ugyanazon az agon)
`for f in tools/test-*.mjs; do node --test "$f"; done` – minden fajl PASS, **egyetlen** kivetellel: `test-foglalo-atkotes.mjs` 19. eset (korabbi, ettol a valtoztatastol fuggetlen hiba, `oxigen-uj.js:134`, Task #67). Osszesites: booking-flow 40, booking-id 11, booking-layer 10, business-config 10, egyeztetes-sor 8, elo-foglaltsag 7, foglalas-esemeny 15, foglalas-kulcs 42, fuggetlenseg 7, gorgeteszar 3, halott-gombok 4, koszono 5, lepes-meres 20, meres 48, qa-nap 26, qa4-smoke 7, salonic-adapter 34, salonic-direct 71, validation-replay 2; foglalo-atkotes 18 pass / 1 fail (korabbi).

## 3. SQL-ek az ELES D1-en (csak olvasas, `mosaic-foglalas-kulcs`)
A modul mind a 7 lekerdezese szo szerint lefutott az eles adatbazison a 2026-10-13 (Budapest) napra (`from=1791842400`, `to=1791928800`), hiba nelkul: `foglalas_egyeztetes` napi sorok (14 db: headspa 10, fodrasz 3, szor 1; 3 parositatlan), `meres_kuldes` (a `kerelem` helyett csak a hosszat kerdeztem le), `foglalas_vendeg` csoportositas (fodrasz 2 + headspa 6, mind `level`), `foglalas_reschedule` (0), sd-allapot (0), a `pre288` JOIN (0 sor), es `pragma_table_info('foglalas_egyeztetes')` (az `sd_id` / `sd_allapot` / `sd_ido` oszlopok megvannak). A valos `kerelem` cel-alakja (Meta: `{dataset, nev, test_event_code}` + url `/…/events`; TikTok: `{pixel_code, nev, test_event_code}`; GA4: `{measurement_id}`; Google: `{customer_id, conversion_action_id, athidalas}`) megegyezik a modul `arnyekCel` feltetelevel.

Varhato jelentes erre a napra (kezi szamolas az eles sorokbol; a vegpont eles kimenetet nem kertem le, mert az eles kulcs nem nalam van): headspa valos 10 (8 parositott, 2 parositatlan), Meta/TikTok alap 8 → `arany` 0,80, `arany_parositott` 1,00 → **zold**; fodrasz valos 3 (2 parositott, 1 parositatlan), alap 2 → `arany_parositott` 1,00 → **zold**; szor valos 1, alap 1 → **zold**; `biztonsag` 0 / 0 / 0.

## 4. A meresi oldal / GPT donteseje (#167 134. komment)
1. **Proba:** elfogadva — alapbol minden letrehozo level valos, opcionalisan `&proba=uuid8,...` (max. 100); a valaszban `proba_kizarva` es `proba_megadva`.
2. **Lampa-alap:** csak a foglalasonkenti alap-esemenyek (erno es ajandekkartya nelkul); a viszonyitasi alap `valos.parositott`; a `valos` es az `arany` tajekoztato. → atvezetve (N7b).
3. **JSON-kulcs:** `uzletagak`.
4. **Push:** a futtatokornyezet a felhasznalo kozvetlen engedelyet keri; addig helyben marad.

## 5. post288_missing_hmac_index az ELES D1-en (csak olvasas)
A szamlalo SQL-je a 2026-10-13-i napra az eles D1-en: 2 sor – `9a03d9f7` (headspa, 15:49:06Z, parositott) es `dca36449` (headspa, 18:32:19Z, parositott); pontosan az a ket level, amelyet a 136. komment jelzett. A jelentes `uzletagak.headspa.post288_missing_hmac_index.db = 2`, `osszes.post288_missing_hmac_index = 2`.
