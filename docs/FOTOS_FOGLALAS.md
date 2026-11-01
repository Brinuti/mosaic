# Fotós előszűrés + foglalás (Feri, 2026-11-01) – a foglaló új működése és a mérési szabály

Fájlok: `assets/js/foglalo-pmu.js` (a PMU-foglaló, védett fájl), `foglalas/foglalo-pmu.html`, az új `foglalas/pmu-foto-ok.html` (szimbolikus link a `foglalo-pmu.html`-re),
teszt: `tools/eltavolitas-teszt/foto-foglalas.test.mjs`. Érvényes **minden** PMU-foglaló belépési pontra (`/sminktetovalas-budapest`, `/szajtetovalas-budapest`, `/szemoldok-tetovalas-budapest`,
`/sminktetovalas-eltavolitas-budapest`, `/foglalo-pmu`, a foglaló-réteg `business=pmu`): a változás a foglalóban van, nem az oldalakon.

## 1. Hogyan működik a foglalás (Feri döntése: „legyen oké, élesen kapcsold be”)
A foglaló **minden szolgáltatásnál** (ingyenes konzultáció, szemöldök, ajak, szemhéj, eltávolítás …) elsőként a kezelést kérdezi, majd **az időpont előtt** feltesz egy kérdést:

| Lépés | Ha a vendég azt mondja: **„Nem, ez lesz az első”** | Ha azt: **„Igen, már van sminktetoválásom”** |
|---|---|---|
| 1. Kezelés | kiválasztja | kiválasztja |
| 2. Kérdés | „Volt már sminktetoválásod (ezen a területen)?” (az eltávolításnál: „Van sminktetoválásod, amelyet eltávolíttatnál?”) | ugyanaz |
| 3. Fotó | – | **kötelező**: legalább 1, legfeljebb 5 fotó; fotó nélkül nem lehet tovább |
| 4. Időpont | a Salonic szabad időpontjai (a 491949 „Tetoválás eltávolítás” szolgáltatásnál 2026-11-09-től, ez a régi szabály marad) | a Salonic szabad időpontjai, **minden szolgáltatásra csak 2026-11-09 00:00-tól** (Europe/Budapest), a naptár felett: „A legkorábbi időpont: november 9.” |
| 5. Elérhetőség | – | név, telefon, (e-mail nem kötelező), adatkezelési hozzájárulás → a fotók + a kezelés + a kiválasztott időpont a meglévő `pmu-proba-foto` levélben megy Melittának |
| 6. Foglalás | a Salonic beágyazott adatlapja → sikeres foglalás → `/pmu-ok` | a Salonic beágyazott adatlapja → sikeres foglalás → **`/pmu-foto-ok`** (nem a `/pmu-ok`) |

- A kérdés szolgáltatásonként újra feltevődik (kezelésváltáskor a válasz törlődik). A haladás-sáv fotós úton: **Kezelés · Fotó · Időpont · Adatok**; egyébként: **Kezelés · Kérdés · Időpont · Adatok**.
- Vissza-gomb: a Salonic-adatlapról az időpontra, onnan a kérdésre (az elküldött fotó nem kerül újra elküldésre; a „Fotó” lépés a kérdésre vezet, ha a fotó már elment).
- A **telefonos visszahívás** ág változatlan: ott a „van” válasz továbbra is csak fotót küld (nincs foglalás, nincs időpont).
- A fotós vendégnek nincs „Nyisd meg itt” tartalék-link (az a Saloniccal a teljes ablakban a `/pmu-ok`-ra irányítana); helyette a telefonszám látszik.
- A vendég hamisan is mondhatja, hogy nincs régi tetoválása: ezt nem ellenőrizzük (Melitta a konzultáción szűr, a Salonicban lemondhat). A Salonic saját foglalási oldalát (közvetlen link) ez nem korlátozza.
- A régi `?kerdes=kihagy` paraméter megszűnt (az eltávolítás-landing sem használja).

## 2. A levél és a Zapier-lánc (nem módosítottam)
A fotós foglalás levele a **meglévő** `pmu-proba-foto` űrlap (tárgy: „Sminktetoválás – fotó érkezett”, ezért a `weboldal-pmu-visszahivas-to-sheet-oktober` Gmail-trigger változatlanul illeszkedik: Google-tábla „Melitta – PMU – Ajánlatkérések” / „Október”, Drive „Mosaic PMU – weboldali vendégfotók”, majd a `melitta-pmu-oktober-sms` automatikus SMS: „Szia! Láttam a jelentkezésed, hamarosan hívlak …”).
A fotós foglalásnál a mezők így térnek el (a Zap a meglévő mezőneveket olvassa, új mező nincs):
- **Ág**: `B – régi PMU van · FOGLALÁSSAL (fotós előszűrés, időpont nov. 9-től)`
- **Kezelés / terület**: `<szolgáltatás neve> · FOGLALÁSSAL` (ez kerül a táblázat „Üzenet” oszlopába)
- **Választott időpont**: `<nap, óra> (a vendég ezt most foglalja a Salonicban: a végleges foglalás ott látszik)`
Az SMS szövege („hamarosan hívlak”) a fotós foglalásnál is igaz (Melitta a fotó alapján felhívja a vendéget, hogy elmondja a reális eredményt), ezért a Zap módosítására nem volt szükség.

## 3. MÉRÉS: aki fotóval foglal, azt NEM mérjük konverziónak (Feri szabálya: „hiába foglal, nem konverzió, és ezt jelölni kell”)
### 3.1 Ami megvalósult (a weboldal / böngésző oldala)
| Jelölés | Hol | Mit jelent |
|---|---|---|
| Köszönőoldal: **`/pmu-foto-ok?g=<Salonic vendégazonosító>`** a `/pmu-ok?first_booking=…&bookingUrl=…` helyett | a sikeres Salonic-foglalás után a böngésző | a konverziós szabályok (Meta „PMU_Foglalas”/`Schedule` URL-szabály, Google Ads `/pmu-ok`, TikTok, GA4 `first_booking`) a dokumentált szabályok (WIX-MERES.md 4.7, 6.; a GTM / Meta / Ads / TikTok fiókot nem néztem meg: külső fiók) mind a `/pmu-ok` útvonalra szólnak; a `/pmu-foto-ok` ezekre nem illeszkedik (nem tartalmazza a „pmu-ok” szövegrészt) |
| Nincs pixel a `/pmu-foto-ok`-n | `assets/js/suti.js` `PIXEL_OLDALAK` | az oldal neve nincs a listában → nincs Meta/PMU-pixel |
| Nincs kulcs-író | `tools/netlify-build.mjs` `FOGLALAS_KOSZONO` | a `/pmu-foto-ok` nincs a listában → nem íródik `foglalas-kulcs` bejegyzés (a motoros `mb_` párosítás nem indul) |
| Nincs click-id az URL-ben | `fotosKoszono` | nincs gclid/gbraid/wbraid/fbclid/ttclid, nincs `first_booking`, `price`, `bookingUrl`, `mh_proba`; csak a `g` |
| `submit` / `success` lépés-mérés nem megy | `pmuLepes` | a fotós úton a `booking_submit` / `booking_success` dataLayer-esemény nincs; a belső, névtelen számláló (`/api/foglalo-szamlalo`) a fotós út lépéseit nem számolja (csak a kérdés előtti `service`-t) |
| `foto_ut: 1` | a `booking_slots_loaded`, `booking_slot`, `booking_form_start`, `booking_error` dataLayer-eseményeken | szűrhető jelölés (a `booking_service` a kérdés előtt megy, azon nincs) |
| `foglalassal: 1` | a `pmu_foto_lead` eseményen (`idopont_kert: 1` mellett) | a lead utána foglal is; **a `pmu_foto_lead` másodlagos lead, nem konverzió**, mint eddig; PII nincs benne |
| `FOGLALÁSSAL` | a `pmu-proba-foto` levélben / a táblázat „Üzenet” oszlopában | Melitta és a mérési oldal látja, hogy ez a fotós vendég foglalt is |

**A nem fotós út bit-azonos a korábbival**: `/pmu-ok?…&mh_proba=pmu` + click-id-k (az R3 blokk a `foglalo-pmu.js`-ben **nem változott**, a teszt-csomagok – `test-gclid-r1r3`, `test-lpt-forras`, `test-pmu-lead` – zöldek).

### 3.2 Ami NEM a weboldalon dől el: a szerveroldali (Salonic-értesítős) út – a mérési oldalnak kell kezelnie
A fotós vendég foglalása **a Salonicban létrejön**, és a Salonic szalon-értesítőből a szerveroldali lánc (Zap → `/api/foglalas-egyeztetes`) **a böngészőtől függetlenül** is dolgozhat. 2026-11-01-én olvasással ellenőriztem (D1 `mosaic-foglalas-kulcs` / `meres_kapcsolo`, `wrangler.toml`, `docs/booking-engine/META_ELO.md`):
- `salonic_direct:pmu` = **BE** (be = 1, „go-live smoke, DECISION #163”),
- `META_ELO_BE = "headspa,pmu"` az éles `[vars]`-ban: a PMU-pixelre élő, szerveres `Schedule` megy, **a „C” szabály szerint** az új vendég ingyenes konzultációjára és első fizetős szolgáltatására, **az `sd_` (Salonic-direct) úton is** (böngésző-munkamenet nélkül, hash-elt azonosítókkal).
- A fotós foglalásnál a böngészős `mb_` párosítás nem indul (nincs köszönőoldali kulcs-írás) → a foglalás a kódleírás szerint `parositatlan` lesz, és **az sd-tartalék dönt**. Ha ott nincs kizárás, a fotós vendég foglalása a szerveres úton **konverzióként kimehet** (Meta `Schedule`, és ahol az sd él, a többi platform is).
**Ezt a weboldal nem tudja megakadályozni, mert a Salonic-értesítőben nincs olyan mező, amit a foglaló tölthetne.** Teendő (mérési oldal): a fotós foglalást az sd-átvételnél ki kell zárni („nem konverzió”) – amíg ez nincs meg, a szerveres út a fotós foglalást is számolhatja.
Javasolt összekötő kulcs: a fotós vendég levele (táblázat) és a Salonic-foglalás ugyanazt a vendéget és időpontot hordozza – **telefonszám (normalizált) + a foglalás kezdete (a levél „Választott időpont” = a Salonic-adatlap `startDate`) + szolgáltatás**; a levél a foglalás előtt percekkel érkezik. Ha ennél tisztább megoldás kell (pl. szerveroldali, PII-mentes jelzés a foglalóból: `service_id` + `slot_unix` + `mb_` azonosító egy mérési végpontra a levél küldésekor), azt a mérési oldal döntése után megépítem; most nem építettem, mert a védett mérési fájlokhoz (`elosztas`, `salonic-direct`, `platformok`) nem nyúlok.

### 3.3 Mi marad a régi
- Aki **fotó nélkül** foglal („nincs régi tetoválásom”): ugyanúgy konverzió, mint eddig (nincs jelölés).
- Aki fotót küld, de **nem fejezi be** a foglalást: lead (`pmu_foto_lead`, másodlagos), mint eddig; nincs foglalás.
- A telefonos visszahívás, a `/pmu-vh`: változatlan.

## 4. Védett fájl, hash, rollback
- `assets/js/foglalo-pmu.js` blob-hash: **77eb8a6dad3f6bbb489803eed02848305c179abd** (a main a #587 után) → **{{UJ_HASH}}** (ez a PR).
- Módosított: a `kerdes=kihagy` kivétele; a kérdés + a fotó az időpont elé; `FOTOS_LEGKORABBI`; `fotosUt()` / `fotoKell()`; lépés-jelző (3 változat); `ELOZO`; `BELEPES.foto` / `foto-adatok` / `kerdes` / `ido`; a fotós levél jelölése; `pmuLepes` (`foto_ut`, nincs submit/success fotós úton); `pmuLead` (`foglalassal`); a köszönő-oldal (`/pmu-foto-ok`) és a burkoló (`keretbenOldalEredeti`) az R3 blokk **után**.
- `tools/test-pmu-lead.mjs`: a `pmu_foto_lead` zárt mezőlistája `foglalassal`-sal bővült (alapérték 0).
- `tools/netlify-build.mjs`: csak a `GV_KIHAGY` mintája (a `/pmu-foto-ok` ne kapjon Google-értékelés számot).
- **Rollback**: a PR visszavonása (`git revert <merge>`), vagy csak a motor: `git checkout 77eb8a6d -- assets/js/foglalo-pmu.js foglalas/foglalo-pmu.html`; a `/pmu-foto-ok` ekkor 404 lesz (a szimbolikus link törlése). Vendégadat a tesztekben nem szerepelt (mockolt Salonic, kitalált név).

## 5. Tesztek (2026-11-01)
`tools/eltavolitas-teszt/foto-foglalas.test.mjs` 8/8 (mockolt Salonic, rögzített óra 2026-11-01): nem fotós út (kérdés az időpont előtt, nincs szűrő, nincs levél, a belső számláló lépései), fotós út (fotó kötelező, 22:59:59Z kimarad / 23:00:00Z bent, levél mezői, `foto_ut`, `foglalassal`, nincs submit/success, vissza-lépések), `/pmu-foto-ok` átirányítás (csak a `g` marad) és a nem fotós `/pmu-ok`, kezelésváltás, telefonos ág változatlan, eltávolítás (491949) szabálya. Védett csomagok: `test-pmu-lead` 9/9, `test-gclid-r1r3` 14/14, `test-lpt-forras` 59/59, `test-foglalo-atkotes` 20/20, `test-foglalas-kulcs` 46/46.
