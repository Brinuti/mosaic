# QA-2 – szerveres árnyék-mérés (DECISION-LOG #99)

**Állapot: előnézeten kész, élesre és élő pixelre semmi nem megy.** A PR-ben lévő kód csak a PR-előnézeten fut (`MERES_ELOSZTO="1"` kizárólag a `wrangler.toml` `[env.preview.vars]` részében van; az éles `[vars]` nem kapja meg). Az éles domainen a böngészős gyűjtő (`assets/js/attribucio.js`) alapból ki van kapcsolva (`ELES_ENGEDELYEZVE = false`), az éles `/api/meres-*` végpontok 503-at adnak (nincs `KULCS_DB` kötés).

## 1. Kötelező javítás (QA-1 → QA-2/1)

- A felszabadított kulcs csak a **jelölt élő ellenőrzése után** kerül át: a Salonic „Foglalás megtekintése” oldalán a jelölt foglalás állapotát élőben kérdezzük (`foglalasAllapot`); `ismeretlen` → újrapróba, `torolve` → a kulcs felszabadul, de nem kerül át (`netlify/lib/foglalas-kulcs.js`, tesztek: `tools/test-foglalas-kulcs.mjs`, 34 teszt).
- Az **esemény elküldése előtt is** élő állapot-ellenőrzés fut (`elosztas()` → `eloEllenorzes`): `torolve` → minden küldetlen cella `kihagyva` („lemondva”); `ismeretlen` → `halasztva` (nem megy ki, naplózott, 180 mp múlva ismételhető); `aktiv` → küldés. Ajándékkártyánál az „élő állapot” a Stripe-tól újra lekérdezett PaymentIntent (sikeres, nem visszatérített / vitatott / visszavont).

## 2. Eseménymodell (`netlify/lib/meres/esemeny-modell.js`)

| | alapesemény | ernyőesemény |
|---|---|---|
| HeadSpa | `FoglalasElso` (új vendég), `Konzultacio`, `Visszajaro`, `Ajandekkartya` | `Schedule` (FoglalasElso és Ajandekkartya mellé) |
| Szőr, PMU | ugyanezek | `Schedule` (FoglalasElso és Konzultacio mellé) |
| Fodrász | ugyanezek | `Fodrasz_AkviziciosFoglalas` (FoglalasElso és Konzultacio mellé) |
| Oxigén | ugyanezek | `Oxigen_AkviziciosFoglalas` (FoglalasElso és Konzultacio mellé) |

- Azonosító: `<esemény>:<source_entity_id>`; foglalásnál a saját `booking_id` (`mb_…`), Stripe-kártyánál a `pi_…`, utalásos kártyánál a saját rendelésazonosító (`ATU-…`).
- **Visszajáró és kupon sosem kerül az ernyőbe.** A „új vendég” a Salonic jelzése (tartalék: a foglaló `first_booking` paramétere); ismeretlen jelzésnél nem állítjuk, hogy új vendég (→ `Visszajaro`).
- Érték = a **tényleges ár** (a Salonic-levél „Fizetendő várhatóan” / „Price” sora; kártyánál a Stripe-összeg), pénznem `HUF`. Ingyenes konzultáció értéke ezért 0 Ft.
- Platform-nevek: a meglévő Meta-egyedi nevek (`HeadSpa_FoglalasElso`, `Fodrasz_Konzultacio` …); az ernyő neve változatlan. TikTok: a HeadSpa-ernyő = `CompletePayment`.

## 3. Érkezési adatok

- **Böngésző** (`assets/js/attribucio.js`, minden oldalon a `<head>`-ben; nem mérőkód, külső szkriptet nem tölt, csak azonos eredetre ír): platformonként **külön utolsó kattintás + időbélyeg** (Google: `gclid` / `gbraid` / `wbraid` külön-külön; Meta: `fbclid` → `fbc`; TikTok: `ttclid`), **első és utolsó érintés UTM**, `_fbp`, `_ttp`, GA4 `client_id` (`_ga`) + `session_id` (`_ga_<azonosító>`), a süti-hozzájárulás (`mh_cc`). A süti-értékeket csak olvassa.
- A köszönőoldali író (`assets/js/foglalas-kulcs.js`) a `booking_id`-val küldi (`POST /api/meres-erkezes`); az ajándékkártya-oldal (`assets/js/ajandek.js`) a PaymentIntent létrehozásakor (`pi_`) vagy az utalási igénynél (`ATU-`) – tehát a fizetés / befizetés **előtt**, hogy a webhook-küldés ne előzhesse meg az adatot.
- **Szerver** (`netlify/lib/meres/erkezes.js`): csak érvényes alakot fogad el (minta + időkorlát), a nyers IP naplóban maszkolt (`203.0.113.xxx`), az érkezési sor 30 nap után törlődik; kiment esemény után már nem módosul.
- **PMU és lézer-landing** eddig nem adott `booking_id`-t: mostantól a Salonic-adatlap címére `back=<booking_id>` kerül (`assets/js/foglalo-pmu.js`, `assets/js/lezer-landing.js`); `oxigenterapia-masodik` bekerült a köszönőoldalak közé (`tools/netlify-build.mjs`).

## 4. Elosztó (`netlify/lib/meres/elosztas.js`, `platformok.js`)

- **Hívás:** a Salonic-levelet feldolgozó folyamat által hívott `POST /api/foglalas-egyeztetes` (párosítás) után, minden `parositott` válasznál; bemenet: `vendeg {email, telefon}`, `uj_vendeg`, `ar` (tartalék). Az elosztás idempotens, a párosítást sosem akaszthatja meg.
- **Platformok:** Meta CAPI és TikTok Events API csak tesztkóddal; Google csak a másodlagos „ARNYEK – …” akciókba (alapból `validateOnly`); GA4 csak teszt-property-be. A cél **a kódban rögzített** (nem csak beállítás): élő pixelre / property-re / elsődleges konverziós akcióra a kérés nem állítható össze.
- **Hozzájárulás (SZ-38):** Meta és TikTok felé hozzájárulás nélkül is küldünk (hash-elt e-mail / telefon, `fbc`, `fbp`, `ttclid`, `ttp`), a hozzájárulási állapot a naplóban látszik; Google felé a valós jel (`GRANTED` / `DENIED` / döntés nélkül `UNSPECIFIED`), hozzájárulás nélkül hash-elt azonosító nélkül; GA4 felé a valós jel, hash sosem. Hash: SHA-256, e-mail normalizálva, telefon Meta-nak számjegyek országkóddal, TikTok / Google-nek E.164.
- **Duplikációszűrés:** egyedi `(esemeny_id, platform)`; ismételt hívás, Stripe-újraküldés, levél-ismétlés nem küld újra. Újrapróbálható: `hiba`, `tiltva`, `halasztva`, a vészkapcsoló miatt kihagyott, az elakadt `folyamatban`; végleges: `elkuldve`, `nincs_hitelesites` (a külső szállító visszaigazolásáig), a modell szerint `kihagyva`, a lemondás miatt `kihagyva`.
- **Vészkapcsoló** üzletáganként és platformonként (és cellánként, és az egész): `POST /api/meres-admin {"muvelet":"kapcsolo","uzletag":"fodrasz","platform":"google","be":false,"ok":"…"}`; olvasás `GET /api/meres-admin?kapcsolok=1`. Kulcsos (`x-egyeztetes-kulcs`, mint a párosítás). Alapból minden be van kapcsolva.
- **Napló** (`meres_kuldes` D1-tábla, `GET /api/meres-admin?source_id=…`): minden küldés és minden nem-küldés sorban: esemény neve / típusa / azonosítója, platform, a küldött név, érték, hozzájárulás, **a kérés** (titok és nyers IP nélkül), HTTP-státusz, **platformválasz**, szállító, próbálkozás, indok.
- **Szállító:** a közvetlen küldés a titkokat (`META_CAPI_TOKEN`, `TIKTOK_EVENTS_TOKEN`, `GOOGLE_ADS_ACCESS_TOKEN` + `GOOGLE_ADS_DEVELOPER_TOKEN`, `GA4_TESZT_API_SECRET`) csak a szállítóban adja a kéréshez. Titok nélkül a kérés elkészül és naplózódik (`nincs_hitelesites`); egy külső szállító (QA-futtató) a `GET ?fuggo=1` kérést elküldheti, és a platform válaszát a `POST {"muvelet":"megerosit", …}` visszaírja a naplóba.

## 5. Ajándékkártya – a #89-es élő útra építve

Nincs második út / második webhook: a Stripe `payment_intent.succeeded` ugyanazon ágában, az élő `meresKuld` mellett (`netlify/lib/ajandek.js`, `arnyekMeres`) fut az árnyék-elosztás, a `pi_` azonosítóval. Az élő Zapier-út változatlan (MERES_HOOK_URL, hozzájárulás-szabály, #84 próbavédelem). Utalásos kártyánál az igénylés **nem** konverzió; az esemény a **tényleges befizetéskor** (a szalon igazolja: `kiállít`) áll elő, az `ATU-` azonosítóval. A hiba soha nem okoz 5xx-et a webhookban. Előnézeti segéd: `POST /api/meres-admin {"muvelet":"ajandek_ujra","pi":"pi_…"}` a webhook-ágat játssza újra (kulcsos).

## 6. Tesztek

- Egység / integráció: `node --test tools/test-meres.mjs` (35), `tools/test-foglalas-kulcs.mjs` (34), `tools/ajandek-teszt/*.test.mjs` (147, ebből 3 az árnyék-útra: `arnyek.test.mjs`). Lefedik: eseménymodell és ernyőszabályok, hash-normalizálás, érkezési adat tisztítás, hozzájárulási szabályok, platform-védelmek, szállító mock-fetch-csel, dedup, vészkapcsoló, élő ellenőrzés (törölt / ismeretlen / aktív), vég-végpont a valódi mentett Salonic-oldalakkal, a böngészős gyűjtő (vm), Stripe-mock webhook.
- **Valódi előnézeti esetek** (2026-10-06, `claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`), mind „TESZT – Claude”, a Meta-küldés és a kiértékelés után azonnal lemondva: HeadSpa (páros), HeadSpa ajándékkártya (valódi Stripe teszt-módú kártyás fizetés), fodrász, oxigén, szőr, PMU. Nyers napló: `docs/booking-engine/meres-naplo/qa2-*`; összefoglaló: `qa2-osszefoglalo-2026-10-06.md`. Futtatás: `tools/meres-proba/qa2-eset.mjs`, `qa2-ajandek.mjs`, `qa2-szerver.mjs` (lásd a fájlok fejlécét).
- Lemondás **után** újrajátszott levél (`qa2-headspa-ismetles-lemondas-utan-…json`): az élő ellenőrzés `torolve`-t olvas, a küldetlen cella `kihagyva` („lemondva”), a már elküldött sorok változatlanok, nincs új küldés.

## 7. Amit ez a kör nem tudott – tényként

1. **TikTok Events API:** nincs hozzáférési token (és TikTok-teszteseménykód) a környezetben; a kérések elkészülnek és naplózódnak (`nincs_hitelesites`), küldés nem történt. A `user.phone` E.164-hash-formátumát a TikTok dokumentációja alapján építettük, élő küldéssel nem igazolt.
2. **GA4:** nincs teszt-property (csak az élő `G-H4206SQ0Q7`, ami tiltott); a GA4-sorok `tiltva`. Kell: teszt-property mérőazonosító + `api_secret`.
3. **Google Ads:** nincs OAuth-token / developer token; a kérések (ARNYEK akció, `validateOnly`, kattintásazonosító, hash, hozzájárulási jel) elkészülnek és naplózódnak, küldés nem történt.
4. **Meta:** a tesztküldés a Composio `METAADS_SEND_CONVERSION_EVENTS` eszközén át ment (`mosaic-meta` fiók), nem a saját szállítónkon (nincs `META_CAPI_TOKEN`). Az eszköz `custom_data`-ja csak `value` / `currency` / `order_id`-t fogad (a többi mező kimaradt), a naplózott IP maszkolt, ezért IP nélkül ment. A `test_event_code` **szintetikus** (`TEST_MOSAIC_QA2`); az Eseménykezelő Tesztesemények valódi kódja a Meta felületéről olvasható ki, és a `wrangler.toml` `META_TESZT_KOD` értékeként cserélendő (kódváltoztatás nélkül). A platformválasz mind 200, `events_received` = a küldött darabszám.
5. **Titkok:** a Cloudflare Preview titkait (token-ek, api_secret, GA4 teszt-azonosító) ezzel a munkamenettel nem lehet beállítani; a `wrangler.toml`-ban csak a nem titkos tesztkódok vannak.
6. **Vendég-adatok a folyamatban:** a vendég e-mail-címe (a levél címzettje), telefonszáma és a Salonic „új vendég” jelzése nem a vendégnek küldött visszaigazoló levél tartalmából jön; az elosztó ezeket a hívó (a Salonic-levelet feldolgozó folyamat) paramétereként várja. A tesztekben az `uj_vendeg: true` **szimulált** (a TESZT-vendég a Salonicban már nem új). Az élő Zapier-folyamat átkötését (hogy ezeket átadja) külső fiókot érint, ezért nem történt meg.
7. **Ajándékkártya-webhook:** ezen az előnézeten a Stripe nem éri el a webhookot (a Stripe előnézeti végpont csak az `claude-ajandek-motor` ágra van felvéve, a `STRIPE_WEBHOOK_SECRET` titok nem cserélhető). A valódi teszt-módú vásárlás után a webhook-ágat a kulcsos `ajandek_ujra` segéddel játszottuk újra; ugyanaz a kód fut, a Stripe-aláírás-ellenőrzés nélkül. Utalásos (`ATU-`) ág: egység-szinten tesztelt (mock Stripe), valódi előnézeti kiállítás nem volt.
8. **Konzultáció értéke:** a #98 szerint a konzultáció „valós értékével” megy (KONVERZIO-TERV 2.1 képlete); ez a dokumentum nincs a repóban, ezért a konzultáció értéke most a Salonic-levél ára (ingyenes konzultáció = 0 Ft). A képlet beillesztése egy helyen (`esemenyek()` `ertek`) megoldható.
9. **`event_source_url`** az előnézeten az előnézeti köszönőoldal; élesen az éles köszönőoldal lesz.
10. A böngészős próbákban a `_fbp` / `_ttp` / `_ga` sütiket és a kattintásazonosítókat a teszt állította be (az előnézeten nem fut pixel / GA); a szerver-oldali útvonal ettől független.

## 8. Fájlok

`netlify/lib/meres/` (esemeny-modell, hash, erkezes, hozzajarulas, platformok, elosztas, foglalas-esemeny, ajandek-esemeny, vegpontok), `functions/api/meres-erkezes.js`, `functions/api/meres-admin.js`, `functions/api/foglalas-egyeztetes.js` (+ `esemenyKuldo`), `assets/js/attribucio.js`, `tools/test-meres.mjs`, `tools/ajandek-teszt/arnyek.test.mjs`, `tools/meres-proba/qa2-*.mjs`, `wrangler.toml` (preview-változók), `docs/booking-engine/meres-naplo/qa2-*`.
