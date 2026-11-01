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
| 6. Foglalás | a Salonic beágyazott adatlapja → sikeres foglalás → `/pmu-ok` | a Salonic beágyazott adatlapja (a Salonic-cím **`back` (mb_ azonosító) nélkül** megy, és a böngésző `mhBookingCtx`-e törölve) → sikeres foglalás → **`/pmu-foto-ok`** (nem a `/pmu-ok`) |

- A kérdés szolgáltatásonként újra feltevődik (kezelésváltáskor a válasz törlődik). A haladás-sáv fotós úton: **Kezelés · Fotó · Időpont · Adatok**; egyébként: **Kezelés · Kérdés · Időpont · Adatok**.
- Vissza-lépések: a fejléc vissza-gombja és a lépésjelző a Salonic-adatlapról az időpontra, onnan a kérdésre visz; a böngésző vissza-gombja az adatlapról az időpontra, onnan a „Fotó” nézetre (ha a fotó már elment: „A fotódat már elküldted”, a Tovább elérhető). Az elküldött fotó nem kerül újra elküldésre; a fotó-elküldés után az adatlap a `foto-adatok` bejegyzést **cseréli** (nincs böngésző-vissza hurok; foglaló-réteg módban a réteg előzmény-bejegyzést nem cserél, ott előre lépve rövid `foto-adatok` villanás után újra az adatlap jön – hurok nincs).
- **A fotós munkamenet fotós marad**: a fotó elküldése után (a „foglalással” és a fotót csak elküldő ágakon is) a böngésző-munkamenetben (`sessionStorage` `mh_pmu_fotos`) megjegyezzük, hogy a vendég fotót küldött. Ha utána átvált „Nem, ez lesz az első”-re, másik kezelést vagy másik árkártyát választ, újratölt, vagy új keret nyílik ugyanabban a lapban, akkor is csak nov. 9-től kap időpontot, nincs újabb fotó-kérés, és a foglalás a `/pmu-foto-ok`-ra megy (nem lehet konverziós útra váltani). Új lap / privát ablak új munkamenet (tesztelésnél ezt használd). A telefonos visszahívás ág állapota ezt nem érinti (a „c-ido” ág nem fotós; a nézetváltáskor a főági nézetek visszaállítják a fotós állapotot).
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
| Köszönőoldal: **`/pmu-foto-ok`** (paraméter nélkül) a `/pmu-ok?first_booking=…&bookingUrl=…` helyett | a sikeres Salonic-foglalás után a böngésző (a keretben betöltődő `/pmu-ok` a szülő `mhKeretbenOldal`-ját hívja; fotós vendégnél egy burkoló a `/pmu-foto-ok`-ra visz) | a konverziós szabályok (Meta „PMU_Foglalas”/`Schedule` URL-szabály, Google Ads `/pmu-ok`, TikTok, GA4 `first_booking`) a dokumentált szabályok (WIX-MERES.md 4.7, 6.; a GTM / Meta / Ads / TikTok fiókot nem néztem meg: külső fiók) mind a `/pmu-ok` útvonalra szólnak; a `/pmu-foto-ok` ezekre nem illeszkedik (nem tartalmazza a „pmu-ok” szövegrészt) |
| Nincs pixel / mérőszkript a `/pmu-foto-ok`-n | `foglalo-pmu.html` fejléce | a `suti.js`-t csak a `/pmu-ok` és a `/pmu-vh` kapja (`document.write`), a `/pmu-foto-ok` nem → nincs mérőkód; a `PIXEL_OLDALAK`-ban sincs |
| **Nincs kulcs-írás** (`/api/foglalas-kulcs`) | (1) `tools/netlify-build.mjs` `FOGLALAS_KOSZONO`: a `/pmu-foto-ok` nincs a listában; (2) **a Salonic-cím fotós úton `back` nélkül megy és az `mhBookingCtx` törölve van** | a keretben betöltődő `/pmu-ok` kulcs-írója (`assets/js/foglalas-kulcs.js`, nem ellenőrzi, hogy keretben fut-e) mb_ azonosító nélkül nem ír → nincs motoros `mb_` párosítás (teszt: a kulcs-író a fotós foglalásnál 0 POST-ot küld, a nem fotósnál 1-et) |
| Tartalék: fő ablakban a `/pmu-ok`-ra érkező fotós vendég | `foglalo-pmu.html` fejléce | ha a böngésző fő ablaka a `/pmu-ok?bookingUrl=…`-ra érkezik, és a mentett fotós jelzés `ts`-e egyezik a `startDate`-tel, a `suti.js` betöltése ELŐTT `/pmu-foto-ok`-ra irányít (keretben nem) |
| Nincs click-id az URL-ben | `fotosKoszono` | nincs gclid/gbraid/wbraid/fbclid/ttclid, nincs `first_booking`, `price`, `bookingUrl`, `mh_proba`, `g`: az URL paraméter nélküli |
| `submit` / `success` lépés-mérés nem megy | `pmuLepes` + a fotós úton nincs `mb_` azonosító | a `booking_submit` / `booking_success` csak a `/pmu-ok` oldalon hívódik (a fotós vendég oda nem jut, és `back` híján a hívás sem indulna); a belső, névtelen számláló (`/api/foglalo-szamlalo`) a fotós út lépéseit a kérdés után nem számolja → **a `service → slots_loaded` arány a fotós vendégek miatt mesterségesen esik** (a mérési oldalnak tudnia kell) |
| `foto_ut: 1` | a `booking_slots_loaded`, `booking_slot`, `booking_form_start`, `booking_error` dataLayer-eseményeken | szűrhető jelölés (a `booking_service` a kérdés előtt megy, azon nincs). **FIGYELEM: ez csak ott érvényesül, ahol a foglaló ablakában van `window.mhSuti`; a `/foglalo-pmu` oldal ma nem tölti a `suti.js`-t (csak a `/pmu-ok`, `/pmu-vh`), ezért a foglaló dataLayer-lépései (és a `pmu_foto_lead`) a mai élő felállásban nem jutnak a GTM-be: a hatékony jelölés az URL, a levél és a számláló.** |
| `foglalassal: 1` | a `pmu_foto_lead` eseményen (`idopont_kert: 1` mellett; ugyanaz a megjegyzés) | a lead utána foglal is; **a `pmu_foto_lead` másodlagos lead, nem konverzió**, mint eddig; PII nincs benne |
| `FOGLALÁSSAL` | a `pmu-proba-foto` levélben / a táblázat „Üzenet” oszlopában | Melitta és a mérési oldal látja, hogy ez a fotós vendég foglalt is |

**A nem fotós út bit-azonos a korábbival**: `/pmu-ok?…&mh_proba=pmu` + click-id-k (az R3 blokk a `foglalo-pmu.js`-ben **nem változott**, a teszt-csomagok – `test-gclid-r1r3`, `test-lpt-forras`, `test-pmu-lead` – zöldek).

### 3.2 Ami NEM a weboldalon dől el: a szerveroldali (Salonic-értesítős) út – a mérési oldalnak kell kezelnie
A fotós vendég foglalása **a Salonicban létrejön**, és a Salonic szalon-értesítőből a szerveroldali lánc (Zap → `/api/foglalas-egyeztetes`) **a böngészőtől függetlenül** is dolgozhat. 2026-11-01-én olvasással ellenőriztem (D1 `mosaic-foglalas-kulcs` / `meres_kapcsolo`, `wrangler.toml`, `docs/booking-engine/META_ELO.md`):
- `salonic_direct:pmu` = **BE** (be = 1, „go-live smoke, DECISION #163”),
- `META_ELO_BE = "headspa,pmu"` az éles `[vars]`-ban: a PMU-pixelre élő, szerveres `Schedule` megy, **a „C” szabály szerint** az új vendég ingyenes konzultációjára és első fizetős szolgáltatására, **az `sd_` (Salonic-direct) úton is** (böngésző-munkamenet nélkül, hash-elt azonosítókkal).
- A fotós foglalásnál a böngészős `mb_` párosítás nem indul (a Salonic-cím `back` nélkül megy, nincs `mhBookingCtx`, a kulcs-író nem ír: tesztelve) → a foglalás a kódleírás szerint `parositatlan` lesz, és **az sd-tartalék dönt**. (A független review is kimutatta, hogy a kulcs-író a keretben betöltődő `/pmu-ok`-on mb_ azonosító birtokában írna; ezért a fotós úton nincs mb_ azonosító.) Ha ott nincs kizárás, a fotós vendég foglalása a szerveres úton **konverzióként kimehet** (Meta `Schedule`, és ahol az sd él, a többi platform is).
**Ezt a weboldal nem tudja megakadályozni, mert a Salonic-értesítőben nincs olyan mező, amit a foglaló tölthetne.** Teendő (mérési oldal): a fotós foglalást az sd-átvételnél ki kell zárni („nem konverzió”) – amíg ez nincs meg, a szerveres út a fotós foglalást is számolhatja.
Javasolt összekötő kulcs: a fotós vendég levele (táblázat) és a Salonic-foglalás ugyanazt a vendéget hordozza – **telefonszám (normalizált) + időablak** (a levél a foglalás előtt percekkel – legfeljebb a munkamenet hosszáig – érkezik). **Korlát:** a levél időpontja és kezelése a *levél küldésekor* érvényes; ha a vendég utána másik időpontot vagy másik kezelést választ (és második levél nem megy, mert a fotó már elment), a Salonic-foglalás `startDate`-je / szolgáltatása eltérhet a levélben szereplőtől. Ezért a telefonszám + időablak az egyetlen megbízható kulcs; a kezdés + szolgáltatás egyezésére nem szabad építeni. (Egy második `pmu-proba-foto` levél nem megoldás: a Zap újabb SMS-t küldene a vendégnek.) Ha ennél tisztább megoldás kell (pl. szerveroldali, PII-mentes jelzés a foglalóból: `service_id` + `slot_unix` + `mb_` azonosító egy mérési végpontra a levél küldésekor), azt a mérési oldal döntése után megépítem; most nem építettem, mert a védett mérési fájlokhoz (`elosztas`, `salonic-direct`, `platformok`) nem nyúlok.

### 3.3 Mi marad a régi
- Aki **fotó nélkül** foglal („nincs régi tetoválásom”): ugyanúgy konverzió, mint eddig (nincs jelölés).
- Aki fotót küld, de **nem fejezi be** a foglalást: lead (`pmu_foto_lead`, másodlagos), mint eddig; nincs foglalás.
- A telefonos visszahívás, a `/pmu-vh`: változatlan.

## 4. Védett fájl, hash, rollback
- `assets/js/foglalo-pmu.js` blob-hash: **77eb8a6dad3f6bbb489803eed02848305c179abd** (a main a #587 után) → **a19d71d05130e988ab5aa58489359365350988b2** (ez a PR).
- Módosított: a `kerdes=kihagy` kivétele; a kérdés + a fotó az időpont elé; `FOTOS_LEGKORABBI`; `fotosUt()` / `fotoKell()`; lépés-jelző (3 változat); `ELOZO`; `BELEPES.foto` / `foto-adatok` / `kerdes` / `ido`; a fotós levél jelölése; `pmuLepes` (`foto_ut`, nincs submit/success fotós úton); `pmuLead` (`foglalassal`); a köszönő-oldal (`/pmu-foto-ok`) és a burkoló (`keretbenOldalEredeti`) az R3 blokk **után**.
- `tools/test-pmu-lead.mjs`: a `pmu_foto_lead` zárt mezőlistája `foglalassal`-sal bővült (alapérték 0).
- `tools/netlify-build.mjs`: csak a `GV_KIHAGY` mintája (a `/pmu-foto-ok` ne kapjon Google-értékelés számot).
- **Rollback**: a **teljes PR visszavonása** (`git revert -m 1 <merge-commit>`) – ez az ajánlott (a motor + az eltávolítás-landing + a menü + a tesztek összetartoznak). Részleges (csak a motor) visszaállítás **nem ajánlott**; ha mégis: `git checkout fe4a6c39ef0c4b06cb900c06c6f03a00189d56b0 -- assets/js/foglalo-pmu.js foglalas/foglalo-pmu.html assets/js/eltavolitas-landing.js foglalas/sminktetovalas-eltavolitas-budapest.html assets/img/eltavolitas tools/test-pmu-lead.mjs tools/szaj-teszt/szaj.test.mjs tools/eltavolitas-teszt/eltavolitas.test.mjs tools/google-szam-teszt/google-szam.test.mjs tools/netlify-build.mjs && git rm -f foglalas/pmu-foto-ok.html tools/eltavolitas-teszt/foto-foglalas.test.mjs` (a `fe4a6c39…` a main a #587 után; az eltávolítás-oldal `-v2` képnevei maradhatnak). Vendégadat a tesztekben nem szerepelt (mockolt Salonic, kitalált név).

## 4/b. Mit kell tudnia a mérési és a hirdetési oldalnak (összegzés)
1. **Az eltávolítás-landingről érkezők gyakorlatilag mind „van régi sminktetoválásom” választ adnak → fotós út → nem konverzió.** Az oldal a mérésben ma nem termel konverziót (csak a „nincs régi tetoválásom” választ adó, fotó nélküli foglalás számít). Ezt a hirdetések optimalizálásánál figyelembe kell venni.
2. A **fotós foglalás szerveroldali kizárása** (3.2) nincs kész: a mérési oldal feladata.
3. A foglaló **belépési sorrendje változott** (kérdés → időpont): a `tools/meres-proba/uj-utak-proba.mjs` (177–181. sor) és a `tools/meres-proba/qa2-eset.mjs` (98–100. sor) még előbb választ időpontot, csak utána felel a kérdésre: ezek a próbák a PMU-ágon elbuknak, amíg át nem írják őket (a mérési oldal próbaszkriptjei, nem módosítottam).
4. Új / bővült mezők: `foto_ut` (a `booking_*` lépéseken), `foglalassal` (a `pmu_foto_lead`-en; a `tools/test-pmu-lead.mjs` zárt mezőlistája ennek megfelelően bővült); mindkettő additív.
5. **Dátumfüggő szövegek**: „A legkorábbi időpont: november 9.” a foglalóban csak 2026-11-09 előtt látszik; az eltávolítás-oldal szövegei („Időpontok november 9-től”, „a fotóval jelentkezőknek az első időpont november 9.”) statikusak: nov. 9. után át kell írni. A `FOTOS_LEGKORABBI` szűrő és a 491949-es szabály nov. 9. után is hat, ezeket Feri döntésére lehet kivenni.

## 5. Tesztek (2026-11-01)
`tools/eltavolitas-teszt/foto-foglalas.test.mjs` 21/21 (mockolt Salonic, rögzített óra 2026-11-01): nem fotós út (kérdés az időpont előtt, nincs szűrő, nincs levél, a belső számláló lépései), fotós út (fotó kötelező, 22:59:59Z kimarad / 23:00:00Z bent, levél mezői, `foto_ut`, `foglalassal`, nincs submit/success, vissza-lépések), `/pmu-foto-ok` átirányítás (az URL paraméter nélküli) és a nem fotós `/pmu-ok`, kezelésváltás, telefonos ág változatlan, eltávolítás (491949) szabálya. Védett csomagok: `test-pmu-lead` 9/9, `test-gclid-r1r3` 14/14, `test-lpt-forras` 59/59, `test-foglalo-atkotes` 20/20, `test-foglalas-kulcs` 46/46.
