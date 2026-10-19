# Maximalis hash-elt adatatadas minden platformra (DECISION #202, PR-B) - meresi naplo, 2026-10-19

Vendegadat, kulcs, gclid, hash-ertek nincs benne.

## 1. Mi ez (forras)
- DECISION #202 (Feri 2026-10-19 18:57, a #167 6272605231 es a Drive DECISION-LOG #202 bejegyzes; Feri implementacios szabalyai: #167 6273378563): a hash-elt vendegadat (e-mail, telefon, vezetek- es keresztnev, orszag, external_id, fbc / fbclid, ttclid, gclid / gbraid / wbraid, IP, user agent, ertek, booking-azonosito) menjen a Meta, TikTok, Google es GA4 **arnyek-lancaba**. Elo azonositora tovabbra sem megy semmi (a platformok.js vedelmei valtozatlanok). Nyers vendegadat sehova (D1-naplo, GitHub, Drive): csak hash a kimeno kerelemben.
- Ez a PR a **PR-A (#428, hozzajarulas-jel)** tetejere epul; a PR-A merge-e utan megy.

## 2. Mezok platformonkent (csak GRANTED-es szabalynal es csak hash-elve; rogzitett elutasito donteshez Google / GA4 felé nincs, Meta / TikTok valtozatlan)
- **Meta CAPI** `user_data`: `fn` / `ln` (csak ha van hasznalhato nev), `country` (hash-elt `hu`, ha van mas azonosito), `ct` / `zp` (CSAK ajandekkartyanal: a Stripe PI metadata `varos` / `iranyitoszam`), `fbc` potlasa az `fbclid`-bol az esemeny idejevel (ha nincs kattintas-idobelyeg); a korabbi mezok (em, ph, external_id, IP, UA, fbc, fbp) valtozatlanok.
- **TikTok Events API** `user`: a hivatalos kulcsok valtozatlanok (email, phone, external_id, ttclid, ttp, ip, user_agent); `first_name` / `last_name` **csak `TIKTOK_NEV_MEZOK=1` opt-in mellett** (a hivatalos user-kulcsok kozott nem szerepel); `ct` / `zp` nincs forras, kimarad.
- **Google (ARNYEK, Zapier-webhook)**: `hashed_email` (Ads-normalizalt SHA-256: gmail pontok es "+" utotag nelkul), `hashed_phone_number` (E.164 SHA-256), `user_identifiers` (`[{hashed_email}, {hashed_phone_number}]`), `user_ip_address` / `user_agent` (amit a motor rogzitett; sd agon nincs); nev / cim nem megy; egy kattintasazonosito (a legfrissebb gclid / gbraid / wbraid; a Google ClickConversion csak egyet fogad).
- **GA4 Measurement Protocol**: `user_id` (HMAC-SHA-256 a `GUEST_HMAC_KEY_V1`-gyel, 32 hex, nem visszafejtheto; kulcs nelkul nincs) + `user_data.sha256_email_address` / `sha256_phone_number`; nev / cim nincs (a GA4 cim-mezoi nyers varost / iranyitoszamot kernenek: az nem megy).
- **Nev-forras**: a Zap `nev` mezoje (felso szint, az sd-szerzodes szerint; `vendeg.nev` is), tartalekban az `email_html` "Nev:" sora / "Kedves X!" / "Dear X!" koszonese (uj modul: `netlify/lib/meres/vendeg-nev.js`); az ajandekkartya a PI metadata `nev` mezojet hasznalja. Hianyzo / null / ures / ertelmezhetetlen nev: NINCS nev-hash, a tobbi mezo megy. Normalizalas: kisbetu, irasjel nelkul, ekezetes betuk UTF-8-ban maradnak, magyar sorrend (vezeteknev keresztnev; `MERES_NEV_SORREND=keresztnev_elol` megfordit), titulus (dr, prof, id, ifj, ozv) es koztes nevek kimaradnak.
- **Tartalek-ujrakuldes** (`platformok.js` `kuldes()`): ha a Meta / TikTok / GA4 a kibovitett torzset KIFEJEZETTEN elutasitja (4xx, 200 + hibakod, GA4 validacios uzenet), a szallito EGYSZER ujraprobal a regi (bovites nelkuli) torzzsel (az event_id azonos, a platform dedup-ja vedi); halozati hiba / idotullepes / 5xx: nincs ujraprobalas (az esemeny feldolgozodhatott). A hiba szovege a `platform_valasz`-ban marad. A tartalek-torzs nem felsorolhato (non-enumerable): nem kerul a naploba, a golden-kepbe.

## 3. Naplo / adatvedelem
- `elosztas.js` `maszkolt()`: a naplozott kerelemben a hash-ertekek `[hash]`, a nyers IP (`client_ip_address`, `ip`, `ip_address`, `user_ip_address`) maszkolt - a mezo megleten latszik, mi ment ki, az ertek nem. (A `MERES_NAPLO_TELJES=1` CSAK az elonezeten, sajat teszt-IP-vel, a teljes payloadot mutatja; az elesben nincs beallitva.) A gclid / fbc / fbp / ttclid / ttp technikai azonosito: valtozatlanul a naploban (a `google_proba` ebbol valaszt gclid-et).
- A nyers nev csak a memoriaban el (`fk.vendeg.nev` -> `felhasznalo-hash.js` SHA-256); nem tarolodik, nem naplozodik, nem megy ki. A teszt (`test-meres.mjs` vegponttol vegpontig, `test-adatgazdagitas.mjs`) a kimeno hivasokban es a TELJES D1-ben (minden tabla) kereszt-ellenorzi: sem a nyers nev / e-mail / telefon, sem a nev / e-mail / telefon hash-e nincs a D1-ben.

## 4. Golden fixture (`tools/fixtures/golden-motor-kerelem.json`) - SZANDEKOS ujrairas, diff-bizonyitek (a PR-A fixture-jehez kepest)
`node tools/meres-proba/golden-motor.mjs --ir` (a `golden-motor.mjs` ctx-e mar a `felhasznaloHash`-t hasznalja, mint az elosztas()); 300 kerelem, 6 elosztas-eset, ugyanannyi:
- Meta-torzs: **+ `user_data.country`** (25 `teljes` + 25 `hozzajarulasNelkul` + 25 `ures` kerelem; 6 elosztas-esetben 12 hivas).
- Google-torzs, `teljes` valtozat (10 kerelem) + 4 elosztas-hivas: **+ `hashed_email`, `hashed_phone_number`, `user_identifiers`, `user_ip_address`, `user_agent`**.
- GA4-torzs, `teljes` valtozat (15 kerelem): **+ `user_id`, `user_data`**; az elosztas-hivasokban (5) csak `user_data` (a golden env-ben nincs `GUEST_HMAC_KEY_V1`).
- Valtozatlan: a `hozzajarulasNelkul` (rogzitett elutasitas) Google / GA4 torzsek (nincs hash / IP / UA / user_id), a TikTok-torzsek (a fixture-vendegnek nincs nev, az opt-in ki), minden esemeny, ertek, order_id, `ad_user_data`, `consent`, URL.
- D1 naplo (`sorok/*/kerelem`): a hash-ertekek `"[hash]"` (korabban a hex-ertek latszott), az uj mezok megjelennek; a regi oszlopok tobbi mezeje bajtra azonos.

## 5. Vedett elemek (blob-hash), PR-A -> PR-B (a main-hez kepest a PR-A naplo 4. pontja)
- `netlify/lib/meres/qa-nap.js` 2334390be3 (valtozatlan), `esemeny-modell.js` 4342e6f09b (valtozatlan), `netlify/lib/foglalas-kulcs.js` e1448b4d13 (valtozatlan), `netlify/lib/meres/vegpontok.js` b5e3881fc7 (valtozatlan; a #418 modositja, kulon PR), `netlify/lib/meres/google-proba.js` f1bb0095f8 (valtozatlan a PR-A-hoz kepest).
- Valtozik: `platformok.js` d38fa8e012 -> 0031c21981; `elosztas.js` 7ef66e862b -> 3820bb47c0; `erkezes.js` 7adace93a0 -> 496c3840ec (`metaFbc` opcionalis `tartalekMs`); `hash.js` 41cfe4f599 -> 19b6f27a19; `foglalas-esemeny.js` 3bc92b6a38 -> 1d8b43fa44; `salonic-direct.js` 885d5d777b -> 49680441c4; `ajandek-esemeny.js` fda79a3d16 -> 894e6ffd0f; `hozzajarulas.js` fbca9adeb9 -> 59633701a6 (csak komment); uj: `felhasznalo-hash.js` 28c3ba0a2d, `vendeg-nev.js` 1271503a9d; `tools/fixtures/golden-motor-kerelem.json` f01a959807 -> b489d8af0f (szandekos, lasd 4.).

## 6. Tesztek
`test-adatgazdagitas` (13, uj: fuggetlen SHA-256 / HMAC orakulum node:crypto-val), `test-meres` (51, uj: vegponttol vegpontig a motoros ag `nev`-vel, tartalek-ujrakuldes), `test-google-proba` (26), `test-adatminimalizalas` (8), `test-qa-nap` (43), `test-salonic-direct` (75, GOLDEN friss), `test-sd-194` (18), `test-sd-headspa` (12), `test-sd-smoke` (14), `test-validation-replay`, `test-hash-email`, `test-egyeztetes-sor`: mind zold.

## 7. Rollback
- A merge-commit revertje. Reszleges visszagorgetes env-bol (deploy kell): `MERES_HOZZAJARULAS_VALOS=1` (a Google / GA4 hash-t a regi szabaly tiltja: valos jel; Meta / TikTok a bovitett mezokkel tovabb megy); a tartalek-ujrakuldes egy platform-hibat onmagaban lekezel (a regi torzs megy). Kimeno kuldes kikapcsolasa a szokott veszkapcsolokkal (`iras` be:false / `platform:<p>` / `mind`).
- Az uj mezok a platformon csak ARNYEK-celpontokra (Meta teszt-dataset + test_event_code, TikTok arnyek-pixel, GA4 teszt-property, Google ARNYEK akciok) mennek; elo konverzio, foglalasi folyamat, futo hirdetes nem valtozik.

## 8. A mérési oldal teendoi (a PR-B eles utan)
- `nev` mezo MINDKET Zap POST-lepesbe (motoros parositas + `sd_atvetel`); az ARNYEK Google-Zap kepezze le: `hashed_email`, `hashed_phone_number` (vagy `user_identifiers`), `user_ip_address`, `user_agent`, `ad_personalization`. A Meta EMQ >= 9 es a Google "EXCELLENT" mereset a mérési oldal vegzi.
