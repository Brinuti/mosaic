# Hozzajarulas: elfogadott hozzajarulas (GRANTED), ha nincs rogzitett elutasitas (DECISION #202 javitas) - meresi naplo, 2026-10-19

Vendegadat, kulcs, gclid nincs benne.

## 1. Mi ez (forras)
- Feri (2026-10-18): **nincs sutisav**, minden platform elfogadott hozzajarulassal kapja az adatot (#167 6273378563, DECISION #202; Feri 2026-10-19 kozvetlen jovahagyasa a munkamenetben): "Google es GA4 fele is mindig ad_user_data = GRANTED es ad_personalization = GRANTED, ... akkor is, ha nincs rogzitett dontes".
- TENY (a meresi oldal Google Ads API-bol, #167 6273378563): a fix `DENIED` (ad_user_data) miatt a sikeres HeadSpa Google-feltoltesekbol 0 konverzio lett.
- Kerese: ez menjen ki a `google_proba` futas ELOTT, hogy a proba is `GRANTED`-del menjen.
- A DECISION #202 eredeti szovege (2. pont) a Google-nek "a valos hozzajarulas szerint (nem fixen DENIED)" ker; Feri a donteshez az "akkor is, ha nincs rogzitett dontes" esetet fuzte hozza. A **rogzitett, kifejezett elutasitas** felulirasat a szoveg nem mondja ki, ezert (a fuggetlen review feltetele + CLAUDE.md "a felhatalmazas a dontes tartalmara szol, nem tobbre") az a vendeg Google / GA4 fele `DENIED` marad. Egy Feri-mondattal "mindig GRANTED"-re allithato (a `platformSzabaly` egyetlen feltetele).

## 2. Valtozas
- `netlify/lib/meres/hozzajarulas.js`: `platformSzabaly(platform, hozz, env)`: Meta, TikTok, Google, GA4 mind `felhasznaloi_adat: true`, `ad_user_data = ad_personalization = GRANTED`, **ha nincs rogzitett dontes vagy a dontes elfogado (`adv` igen)**. KIVETEL: rogzitett dontes, amely a hirdetesi hozzajarulast nem adja meg (`adv != true`: elutasitas / visszavonas / reszleges) -> minden platformra a regi, valos-jel szabaly (Google / GA4: `DENIED`, hash-elt azonosito nelkul). Meta / TikTok torzse valtozatlan (SZ-38: hozzajarulas nelkul is kapnak azonositot), a naploban a valos szabaly latszik. A regi szabaly `valosSzabaly()`-kent megmarad; **visszagorgetes kodvaltoztatas nelkul**: `MERES_HOZZAJARULAS_VALOS=1`. A naploban (`meres_kuldes.hozzajarulas`) a ROGZITETT allapot (`allapot`) es az alkalmazott szabaly (`szabaly`) is latszik.
- `netlify/lib/meres/elosztas.js`: a szabaly kapja az `env`-et.
- `netlify/lib/meres/platformok.js`: a Google-torzs + `ad_personalization` (a Zapier-webhook ignoralja, amig a Zap nem hasznalja); GA4 `consent` a szabalybol (dontes nelkul / elfogadva GRANTED, rogzitett elutasitas DENIED).
- `netlify/lib/meres/google-proba.js` (VEDETT, valtozik, dokumentalt): a proba torzse `ad_user_data` + `ad_personalization` = `GRANTED` (korabban `DENIED`); a fail-closed `probaEllenorzes` ezt kovetel (DENIED = tiltva); a zart mezolista + `ad_personalization` (8 mezo); a terv + a naplozott hozzajarulas JSON is GRANTED. Vendegadat / hash-elt azonosito a probaban tovabbra sincs (zart lista). **Uj (review javaslat):** a `probaGclid` kihagyja azt a sort, amelynek rogzitett donteset (`hozzajarulas.allapot`, az `ana` / `adv` ertekekbol `hozzajarulasTisztit`-tel ujraszamolva: dontes van es `adv != true`) a hirdetesi hozzajarulast nem adja meg, es azt is, amelynek hozzajarulas-JSON-ja nem ures, de olvashatatlan (fail-closed) - a GRANTED jelu proba nem egy elutasito vendeg gclid-jevel megy.
- `wrangler.toml`: csak kommentezett `# MERES_HOZZAJARULAS_VALOS = "1"` sor a `[vars]` es a `[env.preview.vars]` szekcioban (a visszagorgeteshez MINDKETTOBE kell); nincs viselkedesvaltozas.
- Tesztek: `test-google-proba` (26; uj A3b: elutasito sor gclid-je nem valaszthato), `test-meres` (49; hozzajarulas-szabaly 4 platform x allapot, GA4 consent dontes nelkul / elutasitva / VALOS, elosztas elutasitott es dontes nelkuli ut + naplo), `test-adatminimalizalas` (8), `test-qa-nap` (43), `test-salonic-direct` (75, GOLDEN friss), `test-sd-194` (18), `test-sd-headspa` (12), `test-sd-smoke` (14): mind zold.

## 3. Golden fixture (`tools/fixtures/golden-motor-kerelem.json`) - SZANDEKOS ujrairas, diff-bizonyitek (a main fixture-jehez kepest)
`node tools/meres-proba/golden-motor.mjs --ir`; 300 kerelem, 6 elosztas-eset, 30 hivas, 40 naplosor - ugyanannyi, mint a mainben:
- Google-torzs: **+ `ad_personalization`** (20 kerelem: 10 `teljes` valtozat = `GRANTED`, 10 `hozzajarulasNelkul` valtozat (rogzitett elutasitas: `ana:false, adv:false`) = `DENIED`; plusz a 4 elosztas-hivas torzse = `GRANTED`).
- **Egyetlen mas torzs-mezo sem valtozik:** a rogzitett elutasitasos valtozatban az `ad_user_data` es a GA4 `consent` a mainnel azonos (`DENIED`); a Meta / TikTok / GA4 torzsek BAJTRA azonosak.
- D1 naplo: a `meres_kuldes.hozzajarulas` oszlop `szabaly.megjegyzes` szovege (a 40 naplosor mindegyiken) es a Google-sor `kerelem` oszlopa (`ad_personalization`) valtozik; a regi oszlopok tobbi mezeje (esemeny, platform, ertek, allapot, http_status stb.) BAJTRA azonos.
- Egyeb mezo, URL, esemeny, ertek, order_id, azonosito nem valtozott.
- (A `ures` valtozatban - nincs erkezesi adat - nincs client_id / kattintasazonosito, ezert a Google / GA4 ag kimarad; a "dontes nelkul = GRANTED" utat a `test-meres` ket uj esete es az elosztas-teszt fedi.)

## 4. Vedett elemek (blob-hash), main -> PR
- `netlify/lib/meres/qa-nap.js` 2334390be3 -> 2334390be3 (valtozatlan)
- `netlify/lib/meres/esemeny-modell.js` 4342e6f09b -> 4342e6f09b (valtozatlan)
- `netlify/lib/foglalas-kulcs.js` e1448b4d13 -> e1448b4d13 (valtozatlan)
- `netlify/lib/meres/vegpontok.js` 085bed6aad -> 085bed6aad (valtozatlan; a #418 proba-kulcs belepesi aga, b5e3881fc7 -> 085bed6aad, 10-20 00:05 Budapest-kor mar a mainben van; ez a PR hozza nem nyul)
- `netlify/lib/meres/google-proba.js` f6e5bf9d13 -> f1bb0095f8 (**VALTOZIK**: a proba jele GRANTED, a gclid-valasztas kihagyja a rogzitett elutasitast / olvashatatlan hozzajarulas-JSON-t; dokumentalt, ez a PR targya)
- `netlify/lib/meres/hozzajarulas.js` beb2b760ea -> fbca9adeb9; `platformok.js` 8f2a229d83 -> d38fa8e012; `elosztas.js` ae57d630a9 -> 7ef66e862b; `tools/fixtures/golden-motor-kerelem.json` 563a14cf9c -> f01a959807 (szandekos, lasd 3.)

## 5. Rollback
- Azonnali, deploy nelkul nem lehetseges (a `wrangler.toml` valtozo deployt kivan); a koddal: a merge-commit revertje. Env-visszagorgetes: `MERES_HOZZAJARULAS_VALOS=1` a Production `[vars]`-ban **es** a `[env.preview.vars]`-ban (a kommentezett sor mindkettonel ott van) + deploy (a valos-jel szabaly visszaall minden esetre; a google_proba jele tovabbra is GRANTED). Megjegyzes: `MERES_HOZZAJARULAS_VALOS=1` mellett is megjelenik a Google-torzsben az `ad_personalization` mezo (dontes nelkul `DENIED`) - szabalyszintu, nem bajtszintu visszaallas; a Zap a mezot ignoralja.
- Kimeno kuldes kikapcsolasa a szokott veszkapcsolokkal (`iras` be:false / `platform:google` / `mind`).

## 5b. Ismert eltérés (a mérési oldal / Feri döntése, külön PR, nem a delta hozta)
- A böngészőben a csak „térkép” (funkcionális) engedélyes bejegyzés nem ana / adv döntés (`suti.js`), de az `attribucio.js` `{ana:false, adv:false, fun:true}`-ként küldi - a szerver ezt **rögzített elutasításnak** veszi: Google / GA4 felé `DENIED` megy, és a `probaGclid` is kihagyja. Ez a konzervatív irány, de eltér a „nincs rögzített döntés = GRANTED” szándéktól; javítás: `reszleges` jelző az `attribucio.js`-ben (mérést érint).

## 6. Hatas / kockazat
- Csak ARNYEK-celpontokra megy (a platformok.js vedelmei valtozatlanok: elo ID tiltva). Elo konverzio, foglalasi folyamat, futo hirdetes nem valtozik.
- A Google ARNYEK akciokban (masodlagos, licitet nem vezet) az eddig DENIED-del erkezo, **dontes nelkuli** feltoltesek ezentul GRANTED-del mennek: ez a Feri-dontes (#202) celja. A rogzitett elutasitas tovabbra is DENIED.
- A GA4 `felhasznaloi_adat` jelzo a szabalyban (a hash-es PR-B-hez): a jelzo CSAK az olyan vendegre igaz, akire a Google / GA4 szabaly GRANTED - a rogzitett elutasito vendegre `false`, igy a PR-B sem kuld hash-t / `user_data`-t neki.
