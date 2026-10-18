# Google E2E-kapu futtatokonyve (DECISION #196; hetfo 2026-10-19 12:00 Budapest)

**Kinek:** a meresi oldalnak (o futtatja; a kulcs az o kezeben van, NEM a repoban). **Cel:** igazolni, hogy a Google ARNYEK-fiok (6088874770) mind a 10 akciojan
(HeadSpa 2 mar EXCELLENT; a tobbi 8) a feltoltes ELFOGADODIK, es hogy a foglalastol az ARNYEK-feltoltesig a lanc uzletagankent vegigmegy.
**Ket kulon kerdes, ket kulon eszkoz** (ne keveredjen):

| Kerdes | Eszkoz | gclid |
|---|---|---|
| A lanc vegigmegy-e (landing → foglalo → Salonic → koszono/level → erkezes → D1 → elosztas → ARNYEK-sor)? | **A. bongeszos E2E** (`meres-proba.mjs` / `uj-utak-proba.mjs`, `--mod valodi`) | szintetikus (`MERES_GCLID`, >= 10 karakter) |
| Elfogadja-e a Google a feltoltest a 8 nem-EXCELLENT akcion? | **B. backend proba-feltoltes** (`google_proba` admin-muvelet) | VALODI HeadSpa gclid a D1-bol (szerveroldalon valasztva, nem latszik) |

Amit ez a csomag NEM tesz: nem ker captcha-kivetelt (a reCAPTCHA a Salonic sajat urlapjaban van, nem a Mosaicban; a `--mod valodi` kihivasnal MEGALL → ember kell);
nem kapcsol be elo konverziot; nem valtoztat a foglalasi folyamaton; nem nyul futo hirdeteshez; vendegadatot sehova nem ir; a suti-elutasitas felulirasahoz nem nyul.

## 0. Elofeltetelek (mindegyik kulon pipa; ami hianyzik, azt jelezd a #167-ben)
1. A **R1–R3 gclid-javitas** (claude/meres-gclid-r1r3) mergelve ES deployolva, KULONBEN a gclid a foglaloban elveszhet (a #403 proba R1–R3 reseit mutatta) – az A. resz hamis negativot adhat.
   Ellenorzes: `node tools/meres-proba/...` #403 proba ujrafuttatva, vagy a deploy check-run (`Cloudflare Pages: mosaic`) zold a merge-SHA-n.
2. Ez a PR (claude/meres-google-proba) mergelve + deployolva (a `google_proba` muvelet csak ezutan letezik; elotte 400 „ismeretlen muvelet”).
3. Kornyezet (Cloudflare Pages `mosaic`, Production): `MERES_ELOSZTO=1` (mar elo), `GOOGLE_ARNYEK_WEBHOOK_URL` (a relay-Zap; a szaraz valasz `kuldes_feltetelei.webhook_beallitva` mutatja igen/nem),
   a visszavonashoz `GOOGLE_KORREKCIO_WEBHOOK_URL` (a korrekcio-Zap a meresi oldal dolga; az `claude/mosaic-meres-eletut` ag `googleKorrekcioKerelem`-je meg nincs mergelve).
4. `EGYEZTETES_KULCS` (a meresi oldale): **CSAK** az `x-egyeztetes-kulcs` fejlecben. A `?kulcs=` query-kulcs a ket uj muvelet-nel NEM fogadhato el (404; a query a naplokba / elozmenyekbe kerulhet; a `qa=nap` is igy van). A kulcsot sehova ne irjad ki (a parancsok `$KULCS` kornyezeti valtozot hasznalnak).
5. Az iras-veszkapcsolo be van kapcsolva (`GET /api/meres-admin?kapcsolok=1`: nincs `iras` ki-sor); kulonben a kuldes 503.

## A. Bongeszos E2E, 4 uzletag (tesztfoglalas + lemondas)
Uzletagankent 1 valodi tesztfoglalas (Feri jovahagyta, #167; a lemondas utana kotelezo). Vendegadat: a `MERES_TELEFON` / `MERES_EMAIL` a tulajdonos probaszama / probacime
(**nem a repoban**, kornyezeti valtozo); a nev „TESZT – Claude”; a Salonic-felteteleket bepipalja, hirlevelet NEM.
Szintetikus gclid: uzletagankent KULON, `MERES_GCLID=E2E<uzletag><datum><veletlen>` (pl. `E2Efodrasz1019a7k3x9`; >= 10 karakter, [A-Za-z0-9_-]; kulonben az `attribucio.js` nem menti az `mh_attr`-ba → hamis negativ).

| Uzletag | Parancs (PR-elonezeten vagy az elo domainen; `--out` a naploba) |
|---|---|
| Fodrasz | `MERES_GCLID=… node tools/meres-proba/meres-proba.mjs --szenario hair --mod valodi --clickids 1 --landing 1 --popup 1 --out hair.json` |
| Oxigen | `… --szenario oxigen2 …` (466147 elso: `--szenario oxigen1`) |
| Szor (lezer) | `… --szenario lezer …` |
| PMU | `MERES_GCLID=… node tools/meres-proba/uj-utak-proba.mjs --ut pmu --mod valodi --out pmu.json` |

- Ha a Salonic **reCAPTCHA-kihivast** ad, az eszkoz megall (nem tori meg): ember oldja meg, vagy a futas kimarad (jelezd a #167-ben). Az eddigi automatizalt valodi futasoknal nem jott kihivas.
- **Lemondas** (azonnal, a visszaigazolo e-mail „Lemondom” linkjevel; NEM torles): `LEMONDAS_OK="Probafoglalas (TESZT), lemondva" node tools/meres-proba/lemond.mjs <cancelBooking-URL>`.
- A `proba` jelolo: a futas kimenetebol a foglalas `source_id`-je / UUID-ja → a napi QA-hoz `&proba=<uuid-elotag>` (a T2-bol KI), lasd `QA_NAP.md`.

**Ellenorzes uzletagankent (a meresi oldal, kulcsos GET, csak olvas):**
1. `GET /api/meres-admin?source_id=<mb_… | sd_…>` → `erkezes.attr.gclid` = a szintetikus gclid (R1–R3 utan MINDEN utnal); `kuldesek[]` platform=google sor a megfelelo ARNYEK-akciora.
2. `GET /api/meres-admin?egyeztetes=1&tol=<epoch>&ig=<epoch>&uzletag=<u>` → a sor a vart allapotban.
3. `GET /api/meres-admin?qa=nap&datum=YYYY-MM-DD&proba=<uuid8>` → a proba-foglalas a T2-ben „proba” (nem szamit a napi arnyek/valos egyezesbe).
4. **Fontos – varhato Google-hiba:** a szintetikus gclid-del a lanc a (nem EXCELLENT) ARNYEK-akciora is elkuldheti a feltoltest; a Google a nem letezo kattintas-azonositot varhatoan **elutasitja** (soronkenti hiba). Ez a **lanc** tesztje, nem a Google-elfogadase – az elfogadast a B. resz igazolja.
   Hogy az elutasitas ne zavarja a fiok feltoltesi osszegzojet, a javasolt sorrend: elobb az A., utana a B. (a legutolso feltoltes akciokent a B. valodi gclid-es proba legyen).

## B. Backend proba-feltoltes (`google_proba`), valodi gclid-del, 8 ARNYEK-akcio
Vedelmek (kodban, fail-closed): csak a 6088874770 fiok es a 8 felsorolt akcio (HeadSpa 7825199989/7825199992 es minden elo akcio kizarva); a torzs zart lista (7 mezo, nincs vendegadat / hash);
`ad_user_data` mindig `DENIED`; a gclid csak a kuldott torzsben van (valasz, D1, naplo: `gclid#1` + `gclid_hash8`); `order_id` = `Proba:<futas>:<akcio>` (egyedi); a Zap NYERS valasz-torzse SOHA nem tarolodik / nem kerul a valaszba (a gclid modositott / csonkolt / kisbetus / base64 visszhangja ellen is): csak a http-status + a Zap `status` / `id` mezoje (biztonsagos karakterek, legfeljebb 64 hossz, a gclid-visszhangot kiszurve), pl. `{"http":200,"status":"success","id":"…"}`.
Plafon: legfeljebb 40 KIMENO kiserlet-sor (elkuldve / hiba / folyamatban) 24 oran belul; a `kihagyva` sorok (dry-run, veszkapcsolo) nem szamitanak, az idempotens ujrafuttatas es az ujraprobalas nem uj sor (nem 429-ezik); max. 3 probalkozas soronkent; a 120 s-nel frissebb `folyamatban` sor nem megy ujra; egyideju azonos `futas_id`-s hivasok nem duplazhatnak (INSERT-verseny + compare-and-swap).

```
BASE=https://www.mosaicheadspa.hu/api/meres-admin     # vagy a PR-elonezet
# 1) SZARAZ (alap): terv, halozat es D1-iras nelkul
curl -sS -X POST "$BASE" -H "x-egyeztetes-kulcs: $KULCS" -H 'content-type: application/json' -d '{"muvelet":"google_proba"}'
# 2) KULDES (8 POST a relay-Zapra): ugyanazzal a futas_id-vel, + megerosites
curl -sS -X POST "$BASE" -H "x-egyeztetes-kulcs: $KULCS" -H 'content-type: application/json' \
  -d '{"muvelet":"google_proba","futas_id":"<a szaraz valaszbol>","kuld":true,"megerosit":"ARNYEK-6088874770-PROBA"}'
```

Mezok (`google_proba`): `futas_id` (8 kisbetus hexa; elhagyva veletlen), `akciok` (a 8 ARNYEK-akcio ID-jabol 1–8 elemu lista; elhagyva mind a 8), `gclid_sorszam` (a valodi HeadSpa Google-feltoltesek sorrendje: ELOBB az osszes `FoglalasElso` gclid-je, ujabb → regebbi (1., 2., …), UTANA az osszes `Ajandekkartya` (ujabb → regebbi); az n-edik elem; alap 1 = a legfrissebb FoglalasElso; a valaszban `gclid_forras.esemeny` / `kor_nap` mutatja, melyik), `kuld` (csak `true` kuld), `megerosit`.
Valasz (200): `ok`, `futas_id`, `source_id` (`gp_<futas>`), `ugyfel`, `gclid:"gclid#1"`, `gclid_hash8`, `gclid_hossz`, `gclid_forras{meres_kuldes_id,esemeny,kor_nap}`, `kuldes_feltetelei{meres_elosztas_be,webhook_beallitva}`, `terv[8]` (akcio, `order_id`, `conversion_date_time`, `value`, `currency`, `ad_user_data`, `body_mezok`),
`mod` (`szaraz`|`kuldes`), kuldeskor `eredmenyek[8]` (`allapot` elkuldve/hiba/kihagyva/tiltva, `http_status`, `valasz_roviden` = a fenti kompakt JSON) es `kuldve`.
Hibak: 400 (rossz mezo / akcio / `megerosit`), 409 (nincs valodi HeadSpa gclid 80 napon belul; vagy a `GOOGLE_ARNYEK_WEBHOOK_URL` hianyzik), 429 (24 oras plafon), 503 (iras-veszkapcsolo), 404 (rossz kulcs).
Ujrafuttatas ugyanazzal a `futas_id`-vel nem duplaz (az elkuldott sor nem megy ketszer; a hibas max. 3-szor). `futas_id` nelkul minden hivas KULONBOZO, veletlen azonositot kap.

**Ellenorzes (a meresi oldal):**
1. `GET /api/meres-admin?source_id=gp_<futas>` → 8 sor `forras=google_proba`, `allapot=elkuldve`, `http_status` 2xx (a Zap valasza).
2. Google Ads API: `offline_conversion_upload_conversion_action_summary` az ARNYEK-fiokra (6088874770): a 8 akcion az allapot nem `NEEDS_ATTENTION` (cel: `EXCELLENT` / `GOOD`; az eddigi mert allapot: 6 akcio `NEEDS_ATTENTION` / `UNPARSEABLE_WBRAID`, 2 meg sosem kapott feltoltest), nincs `UNPARSEABLE_*` / `INVALID_*` hibakod a legutolso job-ban. **A Google feldolgozasa kesleltetett (orak) – a hetfo 12:00-s kapu miatt a probat minel korabban (vasarnap este / hetfo reggel) futtasd.**
3. `?qa=nap&datum=…` → `proba_sor_kizarva` szamolja a proba-sorokat; az arnyek/valos T2-szamlalokban NEM szerepelnek; a biztonsagi ellenorzesek (elo ID, dupla, nem-ARNYEK cel) rajuk is futnak.

## C. Visszavonas (RETRACTION) – a proba feltoltesek torlese az ARNYEK-fiokbol
**A korrekcio-Zap mukodese ismeretlen** (a QA2 naplo szerint a relay-Zap egyszer az URL-lekerdezes `dryrun` jelzojet elesnek ertelmezte), ezert a kod a korrekcio-Zapra **kizarolag** `eles:true` ES `GOOGLE_KORREKCIO_ELES=1` ES `megerosit` mellett POST-ol. Minden mas eset csak terv / D1-sor, hivas NELKUL.
**Az ELSO eles visszavonas elott kotelezo ellenorizni a korrekcio-Zapot:** letezik-e (`GOOGLE_KORREKCIO_WEBHOOK_URL` beallitva), mit csinal a `dryRun` mezovel, es validateOnly-val kiprobalta-e a meresi oldal. Ha nincs ilyen Zap, a visszavonas a Google Ads API-n at (`uploadConversionAdjustments`: `RETRACTION`, `orderId`, `conversionAction`, `adjustmentDateTime`) a meresi oldalon vegrehajthato – a terv ehhez keszen van.
```
# 1) SZARAZ terv: halozat es D1-iras nelkul
curl -sS -X POST "$BASE" -H "x-egyeztetes-kulcs: $KULCS" -H 'content-type: application/json' -d '{"muvelet":"google_proba_visszavon","futas_id":"<futas>"}'
# 2) kuld:true + megerosit, DE eles nelkul (vagy GOOGLE_KORREKCIO_ELES nelkul): 0 POST, csak a dry-run SOR kerul a D1-be (allapot "kihagyva", indok "dry_run: ..."), mod: "dry_run_sor"
… -d '{"muvelet":"google_proba_visszavon","futas_id":"<futas>","kuld":true,"megerosit":"ARNYEK-6088874770-PROBA"}'
# 3) ELES visszavonas (POST a korrekcio-Zapra, dryRun:false): ket kulon feltetel egyutt – GOOGLE_KORREKCIO_ELES=1 a kornyezetben ES eles:true a kerelemben (+ megerosit + GOOGLE_KORREKCIO_WEBHOOK_URL)
… -d '{"muvelet":"google_proba_visszavon","futas_id":"<futas>","kuld":true,"megerosit":"ARNYEK-6088874770-PROBA","eles":true}'
```
A terv az **elkuldott** proba-feltoltesek tukorkepe (ugyanazok az `order_id`-k es akciok; a visszavonas ideje nem a jovoben). Csak a `Proba:<futas>:<akcio>` order_id-k vonhatok vissza; elo akcio / idegen order_id → 409. A valasz `posztolt_db` mezoje megmutatja, hany keres ment a Zapra (dry-run: 0).
Az adjustment a feltoltes utan LEHET, hogy csak a Google feldolgozasa utan fogadhato el (a RETRACTION-hoz a konverzionak mar be kell fogadva lennie). A dry-run sor utan az eles kor ugyanazokat a sorokat veszi at; az elkuldott visszavonas ketszer nem megy.

## D. Leallitas / visszaallitas (rollback)
- Egy platform leallitasa: `POST … {"muvelet":"kapcsolo","platform":"google","be":false}`; egy uzletag: `{"muvelet":"kapcsolo","uzletag":"pmu","platform":"google","be":false}` (a `google_proba` ezt tiszteletben tartja: a cella „kihagyva”).
- Minden uj iras leallitasa: `{"muvelet":"iras","be":false,"ok":"…"}`. A relay megszakitasa: a `GOOGLE_ARNYEK_WEBHOOK_URL` torlese (a kuldes 409).
- Kod-visszaallitas: a PR revertje (a `google_proba` muvelet eltunik; a `meres_kuldes` sorok `forras='google_proba'` megmaradnak). **Figyelem:** revert UTAN a regi QA-kod mar nem zarja ki ezeket: az adott napok Google `elkuldve` es forras-bontas szamlaloiban megjelennek – a listazo SELECT a naplo `meres-naplo/2026-10-18-google-proba.md` F. szakaszaban van (torles NEM javasolt).
- A proba D1-sorai (`forras='google_proba'`) auditnyomok, nem torlendok; a T2-bol kizartak.

## Nyitott kerdesek a meresi oldalnak
1. A B. resz **valodi vendeg-kattintasu gclid-et** hasznal (a D1-bol, szerveroldalon valasztva; a hivon kivul sehol nem latszik, `ad_user_data=DENIED`). Elfogadhato-e a „vendegadat sehova nem kerul” feltetel szerint (a gclid nem szemelyes azonosito, de a valodi kattintashoz kotheto)? Ha nem, a hetfoi kapuhoz Feri egy valodi, sajat kattintasu gclid-je kell.
2. A korrekcio-Zap (`GOOGLE_KORREKCIO_WEBHOOK_URL`) letezik-e? Nelkule a C. resz csak a tervig megy; a visszavonas a Google Ads API-n at a meresi oldalon is vegrehajthato.
3. Az `claude/mosaic-meres-eletut` ag nincs mergelve: a `googleKorrekcioKerelem` formajat itt tukrozzuk (nem importaljuk).
4. Napi 1 merge a `main`-re: ez a PR + az R1–R3 PR ugyanarra a napra eshet – a sorrendet a fo munkamenet dönti el (Feri kerese az R1–R3, a DECISION a proba).
