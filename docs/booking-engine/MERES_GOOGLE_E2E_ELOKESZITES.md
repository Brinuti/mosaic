# Google E2E-teszt előkészítése: leképezés, 5. és 7. pont igazolása, Zap-ellenőrzés, (c) kódterv

Készült: 2026-10-18 (Budapest), a `main` `ede8ea36` állapotán. Forrás: a #167 mérési oldali kérései (6240109548 (a, c), 6240242371, 6240456665 (a, c)); határidő: hétfő 2026-10-19 12:00.
**Csak olvasás + új eszköz/dokumentum.** Élesben semmi nem változott, D1-be nem írtam, a Zapierben semmit nem módosítottam / futtattam / publikáltam (csak olvasó hívások), külső fiókhoz (Meta, TikTok, GA, Google Ads) nem nyúltam, vendégadat nincs a dokumentumban.

Tartalom: **A** leképezés (eszköz + főbb megállapítások) · **B** az 5. és 7. pont kódbeli igazolása · **C** a feltöltő Zap(ok) ellenőrzése · **D** (c) kódterv (csak terv) · **E** a teszt-menet és a hiányzó elemek.

---

## A. A leképezés kódból exportálva

- Eszköz: `node tools/meres-lekepezes-export.mjs --md --ki docs/booking-engine/MERES_LEKEPEZES.md` (`--json` is van). **Nem kézzel másolt tábla:** az éles döntő függvényeket (`esemenyek()`, `foglalasJelleg()`, `KEREM_EPITO.*`, `platformSzabaly()`, `ajandekForras()`) hívja szintetikus bemenettel, I/O és hálózat nélkül; a forrás-hely (`fájl:sor`) a forrásfájlból keresett horgonyból jön (ha a horgony eltűnik, az eszköz hibával áll le).
- Kimenet: [MERES_LEKEPEZES.md](MERES_LEKEPEZES.md): 5 üzletág × 2 forrás-ág (motor, salonic_direct) × 6 szcenárió (új/kezelés, új/konzultáció, visszatérő, ismeretlen vendég, kuponos új, kuponos visszatérő) × 4 platform (Meta, TikTok, GA4, Google), a feltétel-változatokkal (hozzájárulás nélkül, click ID nélkül, GA4 client_id nélkül, ismeretlen ár), az ajándékkártya-ágak, a 10 Google ARNYEK-akció (belépő-példával a Salonic-pillanatképből) és a **szintetikus Google-feltöltési törzsek** (2b szakasz: a relay-Zapnak szánt kérés akciónként, a #193 szintetikus feltöltési napló alapja).
- Teszt: `node --test tools/test-meres-lekepezes.mjs` (12 eset, mind zöld): horgonyok, minden üzletág × alapesemény egyezik az `esemenyek()` közvetlen hívásával, a 10 akció egyezik a `platformok.js`-sel és nincs élő azonosító köztük, a szintetikus törzsek a relay-Zap mezőit adják, sd-ág Google/GA4-be nem küld, ajándékkártya-ágak, kimeneti formátumok, és **5 mutációs ellenpróba** (másolaton megváltoztatott szabály megjelenik a kimenetben; eltűnt horgony → hiba).

**Főbb megállapítások (a táblából, részletek a MERES_LEKEPEZES.md-ben):**

| # | Megállapítás | Hely |
|---|---|---|
| 1 | **Kuponos foglalásra a kód ma is küld eseményt** (`FoglalasElso` / `Visszajaro`, mind az 5 üzletágra), és a motor-ágon ez **Google-be is megy**, ha van click ID. Ernyő-esemény kuponosra nincs. (A #194 elvárása: kuponos foglalás nem konverzió; a #194 / 2–3 PR ezt javítja.) A D1-ben ennek valószínű nyoma: 5 HeadSpa `FoglalasElso` Google-feltöltés van, ebből a legutóbbi (2026-10-17 20:14Z) **0 Ft** értékű (kuponos vagy ár nélküli levél; a D1 nem tárolja, melyik). A kuponos foglalás más üzletágakban sem zárható ki a kódból. | `esemeny-modell.js:62`, `platformok.js:110` |
| 2 | A `salonic_direct`-ág Google-be és GA4-be soha nem küld (nincs böngészős click ID / client_id), csak Meta + TikTok. | `platformok.js:129` |
| 3 | A Google-be csak **alapesemény** megy (`FoglalasElso`, `Konzultacio`, `Ajandekkartya`), a `Visszajaro` és az ernyő-esemény nem; 10 ARNYEK-akció, 0 élő azonosító. | `platformok.js:111`, `:16` |
| 4 | `FoglalasElso` **és** `Konzultacio` is csak **új vendégnél** keletkezik (Salonic: „Még nem volt foglalása”); ismeretlen jelzés → `Visszajaro`. A Google-konverziókhoz tehát minden teszthez **új vendég-identitás** kell (lásd E). | `esemeny-modell.js:39` |
| 5 | Konzultáció-érték (rögzített tábla): szőr 27 000, fodrász 13 000, oxigén 8 900, PMU 13 800 Ft; HeadSpa-nak nincs konzultáció-ága. A többi esemény értéke a tényleges ár (Salonic-levél / Stripe); ismeretlen ár az sd-ágon érték nélkül megy (D5). | `esemeny-modell.js:26`, `elosztas.js:115` |
| 6 | **Az ad_user_data a Google-feltöltésben mindig `GRANTED` vagy `DENIED`** (az `UNSPECIFIED` is `DENIED`-re vált): a D1 szerint mind a 11 eddigi valódi Google-feltöltésnél a böngészős hozzájárulás-állapot üres (`ana/adv: null`, `dontes: false`), tehát mind `DENIED`-del ment (az ok kivizsgálandó: a #170 sütisáv-levétel óta nincs döntés-rögzítés, de a 2026-10-10-i sorokban is üres). A Google ezt hogyan számolja el, a mérési oldal ellenőrizze (lásd E). | `platformok.js:120`, `hozzajarulas.js:11` |

---

## B. Az 5. és 7. pont kódbeli igazolása (nem javítottam semmit)

### 5. pont: oxigén konzultáció: „most 8 900 Ft megy” vs „4 990 Ft-os hajkamerás vizsgálat”

**Tény (kód + D1 + DECISION-LOG):**

1. **A szolgáltatás:** az oxigén konzultáció a `466147` „AKCIÓS Hajkamerás vizsgálat és konzultáció” (4 990 Ft). A `KONZULTACIO = /konzult|hajkamer/i` szabály (`esemeny-modell.js:15`) konzultációnak sorolja be, új vendégnél → `Konzultacio` alapesemény + `Oxigen_AkviziciosFoglalas` ernyő. Vagyis amit Feri 10-17-én mondott („oxigén konzultáció = 4 990 Ft-os hajkamerás vizsgálat”), a kód **szolgáltatásként ma is így kezeli**.
2. **Az érték:** `KONZULTACIO_ERTEK.oxigen = 8900` (`esemeny-modell.js:26`; felülírható a `MERES_KONZULTACIO_ERTEK` környezeti változóval, kódváltoztatás nélkül). Ez **a DECISION-LOG #101-ből** (2026-10-06 19:28, „Feri jóváhagyta”) jön: „az AKCIÓS Hajkamerás vizsgálat és konzultáció (4 990 Ft) értéke ~8 900 Ft = 0,57 megjelenés × 4 990 Ft saját díj + 0,57 × 0,38 továbblépés × 27 802 Ft átlagos első kezelés” (újraszámolva: 2 844 + 6 022 = 8 866 ≈ 8 900). Ez a #98 „a konzultáció a valós értékével megy (KONVERZIO-TERV 2.1 képlet)” szabályának alkalmazása; a **4 990 Ft a díj, a 8 900 Ft az érték**, a kód a #101-et követi.
3. **Élő D1-bizonyíték** (`meres_kuldes`, csak számok): 1 oxigén `Konzultacio` esemény (2026-10-17 07:02Z), mind a 4 platformra `ertek=8900`; Google-ra `kihagyva` (nincs click ID). Az `Oxigen_AkviziciosFoglalas` ernyő konzultációs ága ugyanígy 8 900, a kezelés (`FoglalasElso`) 29 900 (tényleges ár, egyezik a #98-cal).
4. **Megjegyzés a régi GTM-hez:** a Wix-kori GTM-dokumentáció (`WIX-MERES.md:337`) szerint az oxigén konzultáció konverzió értéke a `price` (= 4 990), a fodrász 13 000 és a szőr 27 000 fix. Ha az élő GTM v54 ma is így van, az oxigén konzultáció **élő** értéke (4 990) és az **árnyék** értéke (8 900) szándékosan eltér; a T2-összevetésnél ezt tudni kell.

**Következtetés / döntés a mérési oldalra:** a kód a Feri által jóváhagyott #101-et követi, hibát nem találtam. Ha a 6240456665 5. sora azt jelenti, hogy az **érték** legyen 4 990, ahhoz új DECISION kell (#101 felülírása); a változtatás egy sor (`esemeny-modell.js:26`) vagy a `MERES_KONZULTACIO_ERTEK={"oxigen":4990}` környezeti változó. Ha csak az azonosítást kérte (melyik szolgáltatás a konzultáció), az egyezik.

### 7. pont: utalásos ajándékkártya: „konverzió a befizetéskor, az igénylés külön esemény”

**Az ÁRNYÉK-lánc megfelel a #98-nak (kódból igazolva):**

| Lépés | Mi történik | Hely |
|---|---|---|
| Igénylés (böngésző) | `POST …/atutalas` → a szerver **Stripe PaymentIntentet** hoz létre „nyilvántartási rekordként” (`payment_method_types: ['card']`, nem fizethető, nem véglegesíthető), metadata: `fizetesi_mod: 'atutalas'`, `atu_ref: 'ATU-…'`. Ehhez **soha nem érkezik `payment_intent.succeeded`**. | `netlify/lib/ajandek.js:1740` |
| Igénylés (mérés) | A böngésző az érkezési adatot az `ATU-` azonosítóval elmenti (`attribucioKuld`), és egy **nem konverziós** `bank_transfer_request` dataLayer-eseményt küld. Az árnyék-lánc ezt nem küldi. | `assets/js/ajandek.js:1589`, `:1612` |
| Webhook-ág | `ajandekForras(pi, 'kartya')` utalásos rendelésre **kihagyva**: „a konverzió a tényleges befizetésnél (kiállít) van”. | `netlify/lib/meres/ajandek-esemeny.js:13` |
| Befizetés | A szalon a kiállító oldalon igazolja a befizetést → `atutalas_beerkezett='1'`, `atutalas_ekkor` → `arnyekMeres(…, 'atutalas', …)` → `Ajandekkartya:ATU-…` + HeadSpa ernyő (Schedule / CompletePayment). Idő = a befizetés igazolása, érték = a rendelés összege. Ismétlésre a dedup nem küld újra. | `netlify/lib/ajandek.js:1294`; `ajandek-esemeny.js:14` |
| Nem érkezett be | Ha az utalás nincs igazolva: kihagyva („az utalás még nem érkezett be”). | `ajandek-esemeny.js:14` |

A MERES_LEKEPEZES.md 4. szakasza ezt mind a négy esetre (kártya, igénylés a webhooknál, befizetve, nem érkezett be) a kód kimenetéből mutatja.

Megjegyzés a D1-hez: a 2026-10-10-i, `pi_` azonosítójú ajándékkártya-sorok `forras=motor` címkével vannak (a tesztkör elejéről); a mai kód az ajándékkártya-ágat `kartya` (Stripe-kártya) vagy `atutalas` (utalás) forrással írja (`ajandek-esemeny.js:22`). Ez csak a régi sorok címkéje, a T2-összevetésnél tudni kell.

**ELTÉRÉS, amit a kód mutat (nem az árnyék-láncban, az ÉLŐ oldalon):** az `atutalasKesz()` az igénylés pillanatában a **régi Wix-os `generate_lead` eseményt is elküldi** (`regiUtalasLead`, `assets/js/ajandek.js:1613` hívja, `:1622` definiálja; kikapcsolja az `A.MERES_REGI === false`, ez a HeadSpa-adatban nincs kikapcsolva). A kódkommentje szerint a GTM erre építi a „mostani utalásos konverziót” (GA4 `ajandekkartya_utalas`, Google Ads utalásos konverzió, TikTok). Vagyis **az élő mérés az utalásos igénylést ma konverzióként számolhatja**, ami a #98 elvével („az igénylés külön esemény, nem konverzió”) ellentétes. A GTM-oldali leképezést a kódból nem látni (a GTM v54-ben kell megnézni, a Wix-kori jegyzet: `WIX-MERES.md:330`, „Ajándékkártya, átutalás (Wix-űrlap)”). **Élő konverzió változtatása Feri külön mondatát igényli**, ezért nem nyúltam hozzá; a mérési oldal döntse el, kell-e külön DECISION.
Külön megjegyzés: az élő szerveroldali vásárlásmérés (`meresKuld`, `ajandek.js:1368`) csak `succeeded` PaymentIntentre fut, utalásos kiállításnál nem hívódik; az utalásos befizetést tehát élő szerveroldali konverzió nem fedi, csak az árnyék-lánc.

---

## C. A feltöltő Zap(ok) ellenőrzése (csak olvasás)

**Nincs külön FOD / SZŐR / OXI / PMU feltöltő Zap:** mind a 8 üzletági akció és a 2 HeadSpa-akció **egyetlen közös relay-Zapon** megy; a 45 workflow között nincs másik Google-Ads-feltöltő (az `mp-*` Zapek a Medical Piercing, külön fiók). A „4 Zap” ellenőrzése tehát a relay + az őt tápláló levél-Zap.

| Zap | Azonosító | Állapot | Mit nézek |
|---|---|---|---|
| **Mosaic ARNYEK: szerver → Google Ads árnyékkonverzió** (relay) | `01a1122c-b894-771a-a5e1-c06e6bf9fe54` | enabled, utolsó verzió 2026-10-06 | A forrásban az engedélyezett akció-lista **pontosan a kód 10 ARNYEK-azonosítója** (7825199989 / …92 HeadSpa; …95 / 7825200898 Fodrász; …901 / …904 Oxigén; …907 / …910 Szőr; …913 / …916 PMU), minden más akciót elutasít (`nem-arnyek-akcio`). Ügyfél: `6088874770` (egyezik a `platformok.js`-sel). Kötelező mezők: `order_id`, `value ≥ 0`, `currency = HUF`, click ID (gclid > wbraid > gbraid), `ad_user_data` (GRANTED/DENIED/UNSPECIFIED); a `dryrun` mező (`true`) semmit nem küld, visszaadja a kész Google Ads kérést (`keres`). A kód törzse (`googleKerelem`, `platformok.js:118`) **pontosan ezeket a mezőket** adja (a teszt ellenőrzi). |
| **Mosaic ÁRNYÉK: Salonic-levél → /api/foglalas-egyeztetes** | `01a1125b-414d-718d-bd70-2c633319f117` | enabled, utolsó verzió 2026-10-13 | Gmail-keresés: `from:app@salonic.hu` + tárgy „Új online foglalás érkezett” / „Foglalás lemondás”, és címzett = a szalon Salonic-értesítő postafiókja, VAGY feladó-név „Mosaic Oxigén”, VAGY „Mosaic PMU” (a cím nincs ide írva). Az **éles** `https://www.mosaicheadspa.hu/api/foglalas-egyeztetes` végpontra hív, legfeljebb 4 próbával. Hogy melyik szalon levele melyik feltételen fut be, a Gmail-ből nem néztem (vendégadat); a D1 szerint az elmúlt 10 napban mind az 5 üzletágra érkezett levél (Google-sor mind az 5-re van). **Nincs teszt-szűrő** (nincs név- / e-mail-alapú `teszt` kizárás): a teszt nevű foglalás is végigmegy. A fő hívás törzse **nem tartalmazza a vendég nevét**, csak e-mailt és telefont (a név csak a 21 perc utáni `sd_atvetel` hívásban van). |
| Régi B-teszt Zap | `01a0e752…` | (a régi lánc része, csak a szabályért olvastam) | A `tesztFoglalas` szabály (név „teszt” szót tartalmaz VAGY az e-mail a teszt-listán van) a régi láncban dől el; az új levél-Zapban nincs megfelelője. |

**Futási előzmények (relay, utolsó 15 futás):** mind `finished`, hibás nincs. A valódi gclid-es futások mind HeadSpa (7825199989 / 7825199992), mind `ad_user_data: DENIED`. Példa (2026-10-17 22:14 Budapest, akció 7825199989): `sent: true`, a Google Ads API válasza `requestId`-t, `conversionName`-et és a kért akciót adja vissza; ez azt jelenti, hogy a Google API a kérést átvette. A **feldolgozási állapot („Elfogadva”)** a Google Ads felületen látszik, ahhoz nincs hozzáférésem.

**Következmény a PMU-ra, szőrre, fodrászra, oxigénre:** az út (kód → relay → Google API) mind a 8 akcióra kész és a törzsmezők rendben vannak, de **eddig 0 valódi feltöltés** ment (a D1 szerint mind `kihagyva: nincs click ID`). Az „Elfogadva” bizonyításhoz **valódi, a 6088874770 fiókhoz tartozó gclid** kell; szintetikus gclid-et a Google nem fogad el érvényes kattintásként. (Hiányzó elemek: E.)

---

## D. (c) kódterv: `teszt` jelölésű foglalás: kimarad a T2-ből, de a Google ARNYEK-akcióba kimegy (CSAK TERV)

### Kiinduló állapot (kódból)

- A D1 `foglalas_egyeztetes` sorának **nincs próba-jelölője** (`foglalas-kulcs.js:256`), és a név sem kerül oda; a levél-Zap fő hívása csak e-mailt és telefont küld.
- A T2 (`qa-nap.js`) a próbát csak a hívó által megadott `?proba=<uuid 8 karakteres előtagok>` paraméterrel zárja ki (`qa-nap.js:112`, `:124`; `PROBA_SZABALY`, `:337`).
- A küldés (`elosztas()`) **nem függ attól, hogy a foglalás próba-e**: a teszt foglalás ma is végigmegy minden árnyék-célra (Meta / TikTok teszt-kód, GA4 teszt-property, Google ARNYEK), ha van click ID. Tehát a „Google ARNYEK-ba kimegy” rész **ma is teljesül**, a hiányzó rész az, hogy a T2 automatikusan kizárja.

### Opció A: kód nélkül (ma elérhető)

A tesztfoglalás után a `valos`-ból kizáráshoz a napi QA hívásban a teszt `foglalas_egyeztetes.uuid` első 8 karaktere kerül a `?proba=` paraméterbe (a D1-ben a tesztfoglalás `booking_id`-je alapján kikereshető, vagy a Salonic-levél foglalás-linkjéből olvasható). Hátrány: kézi lépés minden teszt után; a lemondás (a teszt utólagos törlése) és az `elvart` (független Salonic-darabszám) nevezőjét is külön kell korrigálni.

### Opció B: automatikus jelölés (kód + additív D1-séma)

1. **Jelölő oszlop:** `foglalas_egyeztetes.proba TEXT` (NULL = valós, `'azonosito'` = próba). Additív séma-bővítés a meglévő `sema-seged.js` mintájával (`foglalas-kulcs.js:256` a `CREATE TABLE`, ide ugyanúgy védett `ALTER`); régi sorok NULL = valós.
2. **A jelölés forrása:** egy titokként kezelt próba-identitás lista (`MERES_PROBA_VENDEG`, Cloudflare Secret, a repóban nincs; normalizált e-mailek / telefonszámok, `+alias` kezeléssel). A `foglalas-esemeny.js:25` már megkapja a `bejovo.vendeg { email, telefon }` mezőt; ott (a jelleg-rögzítés mintájára, **az első levélnél rögzítve**, `jelleg-rogzites.js`) kell összehasonlítani a listával **memóriában**, és csak a jelölést (`proba=1`) tárolni: vendégadat nem kerül sehová. Név-alapú „teszt” szó csak akkor lehetne, ha a levél-Zap a fő hívásban is átadná a nevet (Zap-módosítás + a névből azonnali hash/jelölés); az e-mail/telefon-alapú lista ehhez nem kér Zap-módosítást.
3. **T2-kizárás (`qa-nap.js`):** a `valos` ciklus (`:118-125`) a `?proba=` mellett a `proba IS NOT NULL` sorokat is `proba_kizarva`-ba számolja; ugyanígy a lefedettség / jogosultság cellái (`:137-165`) és a lemondás (`:128-131`: a próba-booking `kulcs`-ához tartozó `foglalas_lemondas` sorok is kimaradnak). A `?proba=` paraméter megmarad (kézi felülírás).
4. **Google-küldés változatlan:** `elosztas()` és `googleKerelem()` nem változik; a jelölt foglalás az eddig megszokott módon megy a 10 ARNYEK-akció megfelelőjére. (Választható szigorítás: `MERES_PROBA_PLATFORMOK=google` esetén a jelölt foglalás csak Google-be menjen; az ajánlás: ne szűkítsük, mert a Meta / TikTok / GA4 is csak teszt-célpont.)
5. **Tesztek:** `tools/test-qa-nap.mjs` kiegészítése (jelölt sor kizárva a `valos`-ból, a lefedettségből, a jogosultságból, a lemondásból; jelöletlen sor nem), új egység a jelölésre (e-mail / telefon / `+alias`, első levélnél rögzül, később nem fordul vissza), golden-paritás a motoros kérés-törzsekre (a Google-törzs bájtra azonos a jelölt és jelöletlen foglalásnál).
6. **Feltételek (állandó felhatalmazás, 3. pont):** független review PASS a végső SHA-ra; a védett elemek (`netlify/**`, `functions/**`) blob-hash-e **változik**, ezért a változást dokumentálni kell; rollback: a PR revert-je (a séma-bővítés additív, visszafordítás nélkül is ártalmatlan); vendégadat nem kerül a repóba / D1-be (csak a jelölés). A DECISION-azonosítónak mind a #167-ben, mind a Drive DECISION-LOG-ban szerepelnie kell.

**Ajánlás:** a hétfői tesztekhez az **Opció A** elég (nincs kódváltoztatás, nincs kockázat); az Opció B akkor éri meg, ha a tesztfoglalások tartósan ismétlődnek (heti regresszió-próba).

---

## E. Teszt-menet és hiányzó elemek

| Akció | Teszt-szcenárió (új vendég, kupon nélkül) | Várt Google-törzs (a 2b táblából) |
|---|---|---|
| 7825199989 HeadSpa Elso | HeadSpa kezelés, pl. `/foglalo-motor?business=headspa&service=302342` | `value` = tényleges ár (26 900) |
| 7825199992 HeadSpa Ajándékkártya | Stripe-ajándékkártya vásárlás (valódi fizetés: külön döntés) | `value` = rendelés összege |
| 7825199995 Fodrász Elso | `business=hair&service=231534` | tényleges ár |
| 7825200898 Fodrász Konzultáció | `business=hair&service=232804` | 13 000 |
| 7825200901 Oxigén Elso | `business=oxygen&service=466110` | 29 900 |
| 7825200904 Oxigén Konzultáció | `business=oxygen&service=466147` | 8 900 (lásd B/5) |
| 7825200907 Szőr Elso | `business=laser&service=476486` | tényleges ár |
| 7825200910 Szőr Konzultáció | `business=laser&service=476477` | 27 000 |
| 7825200913 PMU Foglalás | `business=pmu&service=481061` | tényleges ár |
| 7825200916 PMU Konzultáció | `business=pmu&service=471160` | 13 800 |

(A belépők a 2026-10-03-i Salonic-pillanatképből valók, élőben ellenőrizendők; a teljes tábla a MERES_LEKEPEZES.md 2. szakasza.)

**Hiányzik / döntés kell (nem tudtam megoldani, a mérési oldal vagy Feri tudja):**

1. **Valódi gclid** a `6088874770` fiókból (szintetikus nem fogadható el). A gclid fiókhoz kötött, nem akcióhoz kötött; egyetlen valódi, Feri saját kattintásából származó gclid (egy hirdetés-kattintás, pl. a futó HeadSpa-hirdetésen) a teszt-URL-hez fűzve (`?gclid=…`) mind a 8–10 akció próbájához használható. Idegen vendég kattintásának gclid-jét **nem** szabad felhasználni. (A „fiókhoz kötött” állítást a mérési oldal erősítse meg.)
2. **Új vendég-identitás minden teszthez:** a `FoglalasElso` és a `Konzultacio` is csak „Még nem volt foglalása” vendégnél keletkezik, egy foglalás után ugyanaz az e-mail már nem új. Üzletáganként 2 teszt = 2 különböző e-mail (a `+alias` jó lehet, ha a Salonic e-mail alapján azonosít, ez az első teszten kiderül), vagy a Salonic-ban a vendég törlése (külső fiók, Ferié).
3. **Feri captchája** minden tesztfoglaláshoz, és a próba e-mail / telefon (a repóban és a környezetben nincs, csak Ferinél van).
4. **`ad_user_data = DENIED`** (A/6): az eddigi mind a 11 valódi Google-feltöltés `DENIED`-del ment. Hogy a Google a `DENIED` konverziót megjeleníti-e az „Elfogadva” státusszal / számolja-e a konverziós oszlopba, azt a mérési oldal ellenőrizze a Google Ads felületén; ha a teszt `GRANTED`-et vár, a böngészőnek hozzájárulás-állapotot kell rögzítenie (a jelenlegi oldalon a D1 szerint nem rögzül), ami már kódkérdés.
5. **Az 5. pont döntése** (B/5) és a **7. pont élő `generate_lead`-je** (B/7) mérési-oldali döntés.
6. **(c) Opció A vagy B** döntése.
7. **A szintetikus feltöltési napló** (#193): a relay-Zap `dryrun: true` hívását a mérési oldal/Feri indíthatja (a webhook-cím titok, a repóban nincs); a hívandó törzsek a MERES_LEKEPEZES.md 2b táblájában vannak, akciónként.
