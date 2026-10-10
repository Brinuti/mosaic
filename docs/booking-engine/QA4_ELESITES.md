# QA-4: a párosítás és az árnyék-mérés bekapcsolása az éles oldalon

DECISION-LOG #120 (2026-10-10). Tartalom: a valódi foglalásoknál a köszönőoldal írja a párosító kulcsot (`booking_id` ↔ Salonic-foglalás), a levélpárosítás (Zap `01a1125b`) az éles végpontra mutat, és **minden platform kizárólag árnyék-célra kap eseményt**. Élő pixelhez, elsődleges konverzióhoz és licitáláshoz nem nyúlunk (a célok kódban rögzítettek: `netlify/lib/meres/platformok.js`; az éles GA4-azonosító tiltott).

## 1. Függetlenség a lifecycle-tól (a 48 órás holdouttal párhuzamos futás feltétele)

Nincs közös írható állapot és nincs közös logika. Gépi bizonyíték: `node --test tools/test-fuggetlenseg.mjs` (7/7), statikusan végigolvassa mindkét oldal kódját.

| | lifecycle | mérés (QA-4) |
|---|---|---|
| D1 | `LIFECYCLE_DB` (`mosaic-lifecycle`) | `KULCS_DB` (`mosaic-foglalas-kulcs`) |
| táblák | `beallitasok`, `esemenyek`, `foglalasok`, `kuldesek` | `foglalas_egyeztetes`, `foglalas_kulcs`, `foglalas_kulcs_atadas`, `foglalas_kulcs_irasok`, `foglalas_kulcs_utkozes`, `foglalas_lemondas`, `meres_erkezes`, `meres_jelleg`, `meres_kapcsolo`, `meres_kuldes`, `salonic_nevtabla` |
| kód | `netlify/lib/lifecycle/**`, `functions/api/lifecycle/**` | `netlify/lib/meres/**`, `netlify/lib/foglalas-kulcs.js`, `functions/api/{foglalas-kulcs,foglalas-egyeztetes,meres-erkezes,meres-admin}.js`, `assets/js/{attribucio,foglalas-kulcs}.js` |
| kulcs / hash | `LIFECYCLE_KULCS_HASH` (Storage: `lifecycle_kulcs`) | `EGYEZTETES_KULCS_HASH` (Storage: `egyeztetes_kulcs`) |
| vészkapcsoló | `LIFECYCLE_MOD` | `meres_kapcsolo` (`iras`, `mind`, …), `MERES_IRAS_KI` |

A hat ellenőrzés: nincs közös logika (egyik oldal sem importál a másikból, közvetetten sem), nincs közös D1-kötés / adatbázis-azonosító, nincs közös tábla (a séma és az SQL is különálló), az olvasott környezeti változók diszjunktak, nincs közös KV / R2 / Durable Object kötés, a végpontok és a kulcsok külön vannak. A lifecycle holdout ezért a QA-4 bekapcsolásától, kikapcsolásától és hibájától független.

## 2. Smoke test (kötelező, DECISION #120)

Naplók: `docs/booking-engine/meres-naplo/qa4-smoke-*.json`. Futtatás: `node --test tools/test-qa4-smoke.mjs` (szerver-oldal, 7/7), `node tools/meres-proba/qa4-smoke-bongeszo.mjs` (helyi `dist`, Playwright), `… --elo https://<ág>.mosaic-d77.pages.dev` (valódi előnézeti végpontok).

**(a) Nem lassítja, nem blokkolja a foglalást.** A köszönőoldali írás `fetch(..., { keepalive: true })`, nem várja meg senki; a két szkript `defer` és kb. 3 + 1,7 KB gzip (egy évre cache-elhető, `?v=hash`). Helyi, determinisztikus futás (5 + 5 betöltés, mobil viewport): betöltés median 121 ms (kontroll, szkriptek tiltva) vs. 123 ms (írókkal); első kattintás 63 vs. 61 ms; a 8 másodperces és a soha nem válaszoló végpont sem késlelteti az oldalt vagy a kattintást. Élő előnézet (8 + 8 futás): 0 JS-hiba, főszál és kattintás azonos (61 vs. 70 ms), az írások 200-at adnak. Az élő futás betöltési ideje a tesztkörnyezet kimenő proxyja miatt 10–15 s és zajos (ugyanazt a fájlt `curl` 0,13–0,32 s alatt tölti le); a mérés szerint a DOMContentLoaded egybeesik a két `defer` szkript letöltésével, az írások (POST) **mindig a DCL után** indulnak (`qa4-smoke-szkript-idozites-2026-10-10.json`), tehát nincsenek a kritikus úton.

**(b) Fail-open.** Szerver-oldalon minden D1-hiba JSON-választ ad (`kezelErkezes` 500 `adatbazis-hiba`, `kezelEgyeztetes` burkoló 500 `belso hiba`), a hívó Zap újrapróbál. Böngészőben a 503, 500 (HTML), hálózati hiba, érvénytelen JSON, üres válasz, soha nem érkező válasz és tiltott tárhely esetén: 0 kezeletlen JS-hiba, a vendég folyamata és az első kattintás zavartalan. A smoke tesztek egy valódi hibát is találtak (a `kezelErkezes` D1-hibánál dobott), ez javítva.

**(c) Kill switch.** Új, külön írás-vészkapcsoló: `meres_kapcsolo` `iras` kulcs (`POST /api/meres-admin {"muvelet":"iras","be":false,"ok":"…"}`) vagy `MERES_IRAS_KI=1`. Kikapcsolva a köszönőoldali kulcsírás, az érkezési adat és a levél-oldali párosítás is 503 `{ok:false, ki:true}`-t ad, és **nem ír egyetlen sort sem**. Az olvasási hiba fail-open (nem állítja le véletlenül az írást). Élő előnézeten igazolva (2026-10-10 06:13:43–06:14:14 UTC): kikapcsolva 3× `/api/foglalas-kulcs`, `/api/meres-erkezes` és a levél-oldali párosítás mind 503, 0 új D1-sor; visszakapcsolva 06:14:20-kor az írás 200. A küldésre a meglévő vészkapcsolók (`mind`, `platform:*`, `uzletag:*`, `cella:*`) érvényesek.

## 3. Bekapcsolás

Kód (ez a PR): éles `KULCS_DB` kötés a `wrangler.toml`-ban (`mosaic-foglalas-kulcs`, `ea7b0edd-c89b-4515-a4b1-50ea25bb50cc`), éles változók (`EGYEZTETES_KULCS_HASH`, `MERES_ELOSZTO`, `META_TESZT_KOD`, `TIKTOK_TESZT_KOD`, `GA4_TESZT_MEASUREMENT_ID`), és `assets/js/attribucio.js` `ELES_ENGEDELYEZVE = true`.

**Tényleges időpontok (UTC):** T0 = 2026-10-10 ~07:14 (PR #222 élesedése; éles kanári-írás 07:15:41, utána törölve); **T1 = 2026-10-10 08:36:45** (`meres_kapcsolo` `mind`: ki → be; a Production titkok beállítva, a Zap `01a1125b` az éles végpontra mutat). **A QA-5 ablak T1-től számít.** A T1 előtt keletkezett két valódi tétel (HeadSpa ajándékkártya `pi_3UOv36…`, fodrász foglalás `mb_0mv24h6pc956l82du9ejweq`) `kihagyva: veszkapcsolo` állapotban maradt, nincs a mintában.

Két időpont, külön jelölve:

- **T0 – párosító írás él:** a PR merge-deploy-ja után a valódi köszönőoldalak írják a kulcsot (`/api/foglalas-kulcs`) és az érkezési adatot (`/api/meres-erkezes`). A küldés ekkor még **kikapcsolva** van: az éles D1-ben `meres_kapcsolo` `mind` = ki (`ok`: „QA-4 indítás…”), így semmi nem megy ki platformra, és a kimaradt események újrapróbálhatók (`veszkapcsolo` miatti kihagyás).
- **T1 – teljes lánc él:** (1) a Production titkok megvannak, (2) a Zap `01a1125b` az éles `POST https://www.mosaicheadspa.hu/api/foglalas-egyeztetes` címre mutat, (3) a `mind` kapcsoló bekapcsolva. **A QA-5 ablak T1-től számítandó**, mert csak ekkortól van minden foglalásnál párosítás és platform-kézbesítés.

Production titkok (Cloudflare → Pages → `mosaic` → Settings → Variables and Secrets → Production, Secret típus; értékük megegyezik a Preview-éval): `META_CAPI_TOKEN`, `TIKTOK_EVENTS_TOKEN`, `GA4_TESZT_API_SECRET`, `GOOGLE_ARNYEK_WEBHOOK_URL`. Titok nélkül a kérés elkészül és naplózódik (`nincs_hitelesites`), kimenő hívás nincs.

Gyors leállítás: írás: `iras` kapcsoló (fent); küldés: `mind` kapcsoló; teljes visszavonás: a `wrangler.toml` `[[d1_databases]] KULCS_DB` blokkjának törlése (az éles végpontok újra 503-at adnak, a köszönőoldali írás ezt elnyeli).

## 4. QA-5 foglalásonkénti egyeztető sor

`GET /api/meres-admin?kulcs=…&egyeztetes=1&tol=<unix>&ig=<unix>[&uzletag=..][&formatum=csv][&limit=..][&utan=<booking_id>][&ga4_csere=<unix|ISO>]` (csak olvas, kulcsos). Kód: `netlify/lib/meres/egyeztetes-sor.js`, teszt: `node --test tools/test-egyeztetes-sor.mjs`.

Egy sor = egy foglalás (CSV-ben foglalás × esemény): `booking_id`, `kulcs` (`placeId|employeeId|startUnix`: ezzel kapcsolódik a Salonic-oldal), `uzletag`, `esemenytipus`, `uj_visszatero` (`uj`, `uj_konzultacio`, `visszatero`), `ertek`, `penznem`, a párosítás állapota és forrása, `esemeny_id`, platformonként (`meta`, `tiktok`, `google`, `ga4`) a kézbesítések száma és osztálya:

- `ok`: pontosan 1 kézbesítés (`elkuldve`);
- `jogos_0`: 0, de jogosan (modell / hozzájárulás / lemondás miatt kihagyva; vagy a GA4-hez nincs `client_id`, mert nincs `_ga` süti, azaz a látogató adata hiányzik). Az okokat az összegzés `jogos_0_okok` blokkja adja platformonként, így a QA-oldal el tudja dönteni, mi számít bele a lefedettségbe;
- `hiany`: minden más (nincs_hitelesites, hiba, tiltva, halasztva, nyitott, vészkapcsoló miatt kihagyva, vagy nincs sor).

Foglalás-szintű jelzések: `tobb_alap_esemeny:…` (rossz típus / duplikáció gyanú), `platform_hiany:<platform>:<esemény>:<ok>`, `parositatlan`, `egyeztetes_<állapot>` (pl. `fuggoben`: friss soroknál az újrapróbálás miatt még nem hiba), `nincs_esemeny`.

**GA4 titokcsere jelölése (`ga4_csere`):** az összegzés `ga4_csere` blokkja megadja a csere előtti **utolsó** és az utáni **első** sikeres (`elkuldve`) GA4 árnyék-eseményt (`esemeny_id`, `source_id`, `kuldve_utc`, `http_status`), külön a foglalásokra (`foglalas_utolso_sikeres_elotte`, `foglalas_elso_sikeres_utana`) és bármely eseményre (ajándékkártyát is beleértve), valamint a csere utáni, az első sikeresig keletkezett sikertelen GA4 cellák számát. A jelölt esemény GA4 cellája a sorokban `csere_jelolo` mezőt kap (CSV: `ga4_csere_jelolo` oszlop). A küldés ideje a `meres_kuldes.frissitve`; a csere idejét a QA-oldal rögzíti és paraméterként adja.

Határ: a láncból **ez a sor az „új mérés” és a „platform árnyék-kézbesítés” oldalt adja**. A **Salonic**-oldalt (tény: foglalás, ár, új/visszatérő, törlés) és a **régi mérés** oldalt a mérési oldal adja; a két táblát a `kulcs` / `booking_id` köti össze. A platformok saját felületén látható attribúciót nem hasonlítjuk.

QA-5 küszöbök (DECISION #120): lefedettség ≥ 98% összesen és egyetlen megfelelő mintájú üzletág sem < 95%; a régi mérés < 97% esetén +3 pp, ≥ 97% esetén új ≥ 98% és legfeljebb −1 pp; 0% értékhiba (HUF pontos, ±1 Ft kerekítés); 0 duplikáció, 0 rossz eseménytípus, 0 rossz foglaláshoz rendelt esemény, 0 ismert hibás új/visszatérő besorolás. Ablak: legalább 7 teljes naptári nap **és** legalább 200 valódi, értékelhető foglalás; legfeljebb 14 nap.

## 5. Ismert, nyitott

- **Hozzájárulás-függő tárolás (GPT-döntés, 2026-10-10, QA-5 előtti higiénia):** az `attribucio.js` a kattintásazonosítókat (gclid / gbraid / wbraid, fbclid, ttclid) és az UTM-et csak a **marketing-hozzájárulás** (`mh_cc.adv`, a `suti.js` döntése) után írja a `localStorage` `mh_attr` kulcsába. Hozzájárulás előtt / nélkül az adat csak memóriában van (az aktuális oldal URL-jéből), és ez megy a foglaláskor a szervernek (az SZ-38 szerinti feldolgozás változatlan); a hozzájárulás pillanatában a memóriabeli pillanatkép kiíródik, visszavonáskor / elutasításkor a tárolt `mh_attr` törlődik, az engedély előtt (korábbi verzióval) tárolt adat is. Ellenőrzés: `node --test tools/test-meres.mjs` (consent=false → 0 attribúciós írás; consent=true → írás; későbbi megadás; visszavonás) és `node tools/meres-proba/attribucio-hozzajarulas-bongeszo.mjs` (valódi Chromium + valódi süti-sáv; napló: `meres-naplo/attribucio-hozzajarulas-2026-10-10.json`). Következmény: hozzájárulás nélküli látogatónál a kattintásazonosító csak akkor jut el a szerverhez, ha a foglalás azonosítóját küldő oldalon (köszönőoldal) is az URL-ben van; ez a platformok egyezési minőségét (match quality) érinti, a QA-5 lefedettséget nem (az esemény az azonosító nélkül is kimegy).
- A munkatárs által Salonicban rögzített lemondásról nem jön Salonic-levél (DECISION #120 carry-forward): az e-mail-alapú párosítás ezt nem látja; megoldás vagy bizonyított tartalék kell a platformátállás előtt.
- A kimaradt (`veszkapcsolo`) események a `mind` bekapcsolása után újrapróbálhatók (nem automatikusan: a levél ismétlése vagy az `ajandek_ujra` admin-művelet indítja újra); az ajándékkártya árnyék-hook (`MERES_ELOSZTO=1`) az éles vásárlásokra is ugyanezt a kapcsolót és ugyanezeket az árnyék-célokat használja.
