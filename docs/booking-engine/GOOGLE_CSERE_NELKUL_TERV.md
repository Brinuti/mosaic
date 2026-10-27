# Csere nélküli Google-javítás az élő akciókon (UJ-63 + UJ-72) – terv és első vázlat

**Állapot: TERV (kód még nincs), MÉRÉST ÉRINTŐ; élesítés nincs.** Kérés: #167 6394447316 (UJ-63, MP), 6394677817 (UJ-63 kiterjesztése: Mosaic HeadSpa + 4 üzletág), 6395410560 (UJ-72, GYT, Feri DECISION #234), 6434558379 / 6435507939 (UJ-82: „terv és első PR-vázlat”). Feri elve: **„a lehető legkevesebb helyen cserélünk, mert a kampányok újratanulnak”** → az élő akció marad, nincs csere; a hiányzó / kihagyott foglalások ugyanabba az élő akcióba kerülnek vissza, ugyanazzal az `order_id`-val (nincs dupla), lemondás miatt **nem** csökken a darabszám (nincs RETRACT, Feri szabálya).

## 1. Cél (egy mondatban)
Minden élő Google-akció konverziója kapjon **foglalás-azonosítót** (`order_id`) a böngészős címkében, és a szerver a **hiányzó** foglalásokat (adblock, süti-elutasítás, későn betöltődő címke, Safari) **ugyanerre az akcióra**, **azonos `order_id`-vel** töltse fel → a Google az azonos akció + azonos `order_id` párt egy konverziónak számolja.

## 2. Célakciók és hordozó-kulcsok
| projekt | élő akció | `order_id` (böngésző = szerver) | szerveres feltöltő ma | rögzített védőháló (védett fájl) |
|---|---|---|---|---|
| Mosaic HeadSpa | 7030256606 | a Mosaic foglalási kulcs (a böngészős `bongeszoMetaKulcs()` kulcs: köszönőoldal + `g` + `serviceId` + `startDate`) – *egyeztetendő a GTM-címkével* | Zapier-webhook (`GOOGLE_ARNYEK_WEBHOOK_URL`), csak a 10 ÁRNYÉK akcióra | `platformok.js` `ELO_CELOK.google_primary` tiltja |
| Mosaic Szőr / Oxigén / Fodrász / PMU | az élő elsődleges akciók (`ELO_CELOK.google_primary`: 7497019094, 7497204933, 7497204930, 7821698547, 7801471836, 7801343216, 7803645055, 7803499839) | ugyanaz a kulcs | ugyanaz | ugyanaz |
| Medical Piercing | 7468541217 („All – Időpontfoglalás”) | `placeId\|employeeId\|startUnix` (a `7839410357` már így viszi) | közvetlen Google Ads API (OAuth) vagy Zap, ÁRNYÉK akciókra | `google-ads.js` `ENGEDETT_AKCIOK` (csak a 3 MP ÁRNYÉK akció) |
| Gyógytornászom | 7362127659 („Állapot-ok”) | `tranzakcioId(uuid, GY_HMAC_KULCS)` (HMAC) | Worker `GOOGLE_ADS_*` titkok, csak a 7858300772 ÁRNYÉK akció | `gfeltoltes.js` `GFELT.akcio` + a kimenő kérés védőhálója |

## 3. Felépítés (mindhárom projektre ugyanaz a minta, projektenként saját kód – nincs közös import)
1. **Böngészős oldal (külső fiók, DECISION/Feri kell):** a mérési oldal a web-GTM-ben az élő akció címkéjének `transaction_id` / `order_id` mezőjét kitölti a fenti kulccsal (workspace, publikálás nélkül; előbb Tag Assistant / Preview). Nálunk kód nem kell hozzá, a kulcs a köszönőoldal adataiból már képezhető (MP: `mp_foglalas_igazolhato` dataLayer-esemény már viszi `mp_foglalas_kulcs`-ot).
2. **Szerveres pótlás – új, KAPCSOLÓ MÖGÖTTI, alapból KI útvonal** (`*_GADS_ELO = ki | dry | eles`): ugyanaz a kérés-építő, de az élő akciót célozza, az `order_id` a böngészővel közös. `dry` = `validateOnly` / napló, `eles` csak külön DECISION után. Eligibility: csak **a címke élesítése UTÁNI** foglalások (`ELO_CIMKE_TOL` unix-idő: korábbiakhoz nincs `order_id`-s böngészős konverzió, a feltöltés dupla lenne), csak igazolt (Salonic-párosított) foglalás, csak Google-kattintás (gclid / gbraid / wbraid), hirdetési hozzájárulás szerint.
3. **Dupla-mentesség bizonyítása (merge és élesítés előtt):** (a) `validateOnly` + a Google válaszkódjai (`DUPLICATE_ORDER_ID` / `ORDER_ID_ALREADY_IN_USE` = „már bent van” → sikernek vesszük, ahogy a GYT feltöltő is); (b) 3 valós minta: címke-konverzió + pótló feltöltés **azonos `order_id`-vel** egy konverzióként jelenik meg a Google-ban (GAQL, konverziónap, darab); (c) ha az élő akció típusa nem fogad kattintás-feltöltést, ez azonnal kiderül `validateOnly`-ból, és akkor a terv B ága jön (lásd 6.).
4. **Nincs RETRACT.** Lemondott foglalás sem kerül levonásra (Feri 10-25: „minden létrejött online állapotfelmérés egyszer, akkor is, ha a feltöltés előtt lemondják”). Az MP `kiigazitas.js` és a GYT `GY_GADS_KIIGAZITAS` marad KI.
5. **Védett fájlok:** a védőhálók módosítása védett fájlt érint (`platformok.js`, `google-ads.js`, `gfeltoltes.js`) → *külön, dokumentált blob-hash-változás*, független review a végső SHA-ra. Ezért a pótlás **nem** a meglévő ÁRNYÉK-kérésépítőbe kerül, hanem **új, külön modulba** (`google-elo.js` projektenként), a védett fájlok csak importálva / érintetlenül; a védőhálók kivétele (az élő akció a tiltólistán marad az ÁRNYÉK-láncban) így nem szükséges.

## 4. Sorrend (mit vállalok, melyik órától)
1. **MP** (a legkidolgozottabb: közvetlen API, `kiigazitas.js` mintája, az `orderId` már egyezik): `medicalpiercing/lib/meres/google-elo.js` + `MP_GADS_ELO`, `ELO_CIMKE_TOL`, tesztek (fake-fetch, dry), napló az `mp-meres` D1-ben.
2. **GYT:** `gyogytorna/lib/google-elo.js` + `GY_GADS_ELO`; order_id = a meglévő HMAC-alapú; a „lemondás előtt is egyszer” szabály tesztje.
3. **Mosaic HeadSpa + 4 üzletág:** a Zap nem engedi az élő akciót (a Zapot nem módosítjuk); a Mosaic-nak a közvetlen API kell (`GOOGLE_ADS_*` titkok a Mosaic Workerben) → *Feri / mérési oldal döntése: közvetlen Google Ads API a Mosaicra* (UJ-18 backlog).

## 5. Nyitott pontok / kitől mi kell (nem blokkolja a vázlatot)
- **Mérési oldal:** az élő akciók típusa (WEBPAGE vs. UPLOAD_CLICKS) és hogy fogadnak-e kattintás-feltöltést azonos `order_id`-vel (Google Ads felület / GAQL, csak olvasás); a böngészős címke pontos `order_id` mezője.
- **Feri:** (a) a web-GTM címke-módosítás „mehet”-je (külső fiók); (b) Mosaic: közvetlen Google Ads API titkok; (c) az `eles` kapcsoló külön mondata.
- **Hipotézis (nincs bizonyítva):** hogy az azonos akció + azonos `order_id` kattintás-feltöltés a tag-konverzióval deduplikálódik. A 3.(b) minta dönt.

## 6. B ág (ha az élő akció nem fogad kattintás-feltöltést)
Enhanced Conversions for Web / Leads (hash-elt e-mail / telefon a címkében) – a 6395410560 szerint ez külön döntés; a vázlat ekkor megáll, az adatot a mérési oldal kapja meg.

## 7. Rollback
Mindhárom: `*_GADS_ELO = ki` (kód nélkül); a böngészős `order_id` visszavétele a GTM-ben a mérési oldal lépése.
