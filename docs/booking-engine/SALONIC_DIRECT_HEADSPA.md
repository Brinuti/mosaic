# Salonic-direct (sd) – HeadSpa előkészítés (DECISION #191)

Forrás: #167, mérési oldal 6235475561 (2. pont): „HeadSpa `salonic_direct` – kérjük az előkészítést: HeadSpa-szolgáltatásnevek (EGYÉNI / PÁROS, „KUPONKÓDDAL –”) kanonikus egyezése + szárazmód-próba + független review. Bekapcsolás (`salonic_direct:headspa=1`) csak a review PASS után, és csak árnyék-célra küld; a foglalási folyamat nem változik.”

**Állapot (2026-10-17): ELŐKÉSZÍTÉS. A `salonic_direct:headspa` kapcsolósor NINCS, a HeadSpa sd-je KI; ez a változás nem kapcsol be semmit, és éles kódot nem módosít** (csak teszt, ellenőrző eszköz és dokumentáció). A bekapcsolás külön döntés (lásd 6.). A B) opció (a `/success-ajandekkartya-stripe` közvetlen Salonic-linkjének átirányítása a motorra) foglalási belépő-változtatás: Feri külön mondata kell, **ebben a változásban nincs**.

## 1. Miért kell (TÉNY)

- 10-15-én két kuponos HeadSpa foglalás („KUPONKÓDDAL – EGYÉNI 50 perces”, a Salonic-levelek 06:56:34Z és 07:44:04Z) **motoron kívül** ment: a D1-ben `foglalas_egyeztetes` `parositatlan` sorok (`471c1076`, `e7d10c1a`), nincs `foglalas_kulcs` (köszönőoldali `back=mb_…` kulcs) és nincs `meres_erkezes` nyomuk, az sd pedig nem vette át őket (`sd_allapot` üres), mert a `salonic_direct:headspa` sor nincs (hiányzó sor = KI).
- A HeadSpa belépő oldalak az élőn a motorra (`/foglalo-motor`) mutatnak; közvetlen Salonic-foglalási link csak a `/success-ajandekkartya-stripe` oldalon van (`showServices&specId=41471`, a kuponos kategória). A tényleges forrást a Salonic admin tudná megmondani (külső fiók, innen nem érhető el); ez csak összefüggés, nem bizonyíték.
- Ezért az sd (biztonsági háló) értelmes a HeadSpára: a motoron kívüli foglalás eseménye az ÁRNYÉK-célokra így is kimenne, a motorral egyszer, dupla nélkül (a motoros párosítás nyer, ha sikerül).

## 2. Mi igazolt a kódból és az offline próbából (`node --test tools/test-sd-headspa.mjs`, 11 teszt)

Az sd kód üzletág-független (`SALONIC_UZLETAG` / `HOSTOK` tartalmazza a HeadSpát, a kapu `salonic_direct:<üzletág>`). A tesztek a **valós** 8 HeadSpa-szolgáltatásnévvel (a Salonic-fiók névtáblája, `salonic_nevtabla`, `place_id 10427`) futnak a meglévő sd-teszt-keretben (valódi SQLite, hamis hálózat, hamis óra).

| teszt | mit bizonyít |
|---|---|
| HS-01 | az üzletág / host / placeId ismert; a 8 név **4 kanonikus kulcsra** esik (Relax, Hair, Páros, Négykezes), a „KUPONKÓDDAL –” változat **ugyanarra a kulcsra**, mint a normál; a D1-ben látott 2 valós `szolg_kulcs` megvan |
| HS-02 | **ismert korlát:** a Zap kuponos levélnél „ (kupon)” utótagot fűz a névhez → más kanonikus kulcs (lásd 4. F2) |
| HS-03 | 4 normál szolgáltatás, új vendég: `HeadSpa_FoglalasElso` + `Schedule` (Meta, TikTok), érték = lista-ár (`exact`), Google / GA4 `jogos_0`, forrás `salonic_direct`, azonosító = a UUID-ból képzett `sd_…` |
| HS-04 | 4 kuponos szolgáltatás, új vendég: csak `FoglalasElso` (nincs `Schedule`), **érték nélkül** (`unknown_discount`) |
| HS-05 | visszatérő vendég: csak `Visszajaro`, nincs `Schedule` |
| HS-06 | a Zap kuponos levelének valós alakja (e-mail mező nem egyetlen e-mail token): az sd lefut, `em` nélkül megy ki, nincs vendég-index sor, az `external_id` a teljes szövegből képzett hash (lásd 4. F1) |
| HS-07 | a `salonic_direct:pmu=1` **nem** kapcsolja be a HeadSpát; `…:headspa=1` be, `=0` ki (visszagörgetés: 0 új küldés, a kész sor változatlan); a PMU független |
| HS-08 | SZÁRAZ terv: a D1 nem változik, nem küld; az éles futás utána ugyanazt adja |
| HS-09 | ha a motor már küldött (kulcs + párosítás): `motor_kuldte`, 0 új küldés, nincs átvétel (a mai HeadSpa-foglalások többsége ez) |
| HS-10 | ugyanarra a UUID-ra érkező második levél (páros, eltérő „új vendég” jelzés): idempotens, egy alapesemény-típus, 0 dupla |
| HS-11 | csak ÁRNYÉK-cél; nyers e-mail / telefon / név / kuponkód / szolgáltatásnév nincs a kérelmekben és a D1-ben |

## 3. Ellenőrző eszköz: az sd smoke kiterjesztve a HeadSpára (`tools/sd-smoke-ellenorzes.mjs`)

Az eszköz eddig csak `pmu` / `oxigen` foglalásra futhatott (HeadSpa-átvételre C1 `FAIL`-t adott). A bekapcsolás előtt kiegészítettem (**csak ellenőrző eszköz, csak SELECT**): `10427 → headspa`; a `kapcsolok` lekérdezés a `salonic_direct:headspa` sort is nézi; a `jeloltek` lekérdezés a HeadSpa-nál **csak a motoron kívüli** sorokat adja (sd-átvett, `parositatlan`, `ellentmondas`, vagy `salonic_direct` HeadSpa-cellával rendelkező), hogy a motoros HeadSpa-foglalások tömege ne zavarja. Tesztek: `tools/test-sd-smoke.mjs` SM12–SM14 (14/14).

## 4. Megállapítások (a bekapcsolás előtt eldöntendők; egyik sem blokkolja a küldés biztonságát, de a minőséget igen)

**F1 – a kuponos levelek e-mailje nem hashelhető (TÉNY + HIPOTÉZIS az okra).** A HeadSpa Meta-árnyék `FoglalasElso` eseményei (`forras = motor`, `elkuldve`, D1, 10-17) közül a kuponosaknál (`meres_jelleg.kupon = 1`) 15/18-ban **nincs `em`** (e-mail-hash), a normáloknál 20/21-ben van. A vendég-index indulása (10-13 11:52Z) óta a normál HeadSpa-levelekhez **13/13**, a kuponosakhoz csak **1/13** `foglalas_vendeg` index-sor van (D1, 10-17). A tünet pontosan az, amit a HS-06 reprodukál, ha az „E-mail cím:” mező **nem egyetlen e-mail token** (a `emailNormal` a szóközt tartalmazó szöveget elutasítja → nincs `em` és nincs index; az `external_id` viszont a teljes szövegből képződik, ezért a vendég a kuponos és a normál foglalása között nem azonosítható). **HIPOTÉZIS:** a Zap `E-mail cím:\s*(.+?)\s*(?:Időpont adatok|$)` kinyerése a kuponos levélben a kuponkód sorát is magával viszi. Ezt a kuponos levél szövegének ismeretében lehet igazolni (a levelekhez a mérési oldal fér hozzá). Hatás: Meta-párosítási minőség, a csere-felismerés (index nélkül vak), az `external_id` következetlensége, az sd-nél is. Javítási lehetőségek (külön döntés, nem része ennek a változásnak): **(a)** Zap: az első e-mail-szerű token (`/E-mail cím:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/`; Zapier-draft + publikálás, külső fiók); **(b)** szerver: `emailNormal` / `vendegHash` az első e-mail-szerű tokent vegye ki a szövegből (kis kódváltoztatás a `netlify/lib/meres/hash.js`-ben + teszt; az érvényes, egyetlen tokenes e-mailekre azonos).

**F2 – „ (kupon)” utótag és a kanonikus kulcs (TÉNY a Zap forrásából, a levél tárgyát nem látom).** A Zap `kupon = /KUPONKÓD/i.test(subject)` esetén `szolgaltatas0 + " (kupon)"`-t küld. A `szolgKanon` a „KUPONKÓDDAL –” előtagot és az „… Ft” zárójeles árat leveszi, a „(kupon)”-t **nem** → a kuponos levél kulcsa más, mint a normál szolgáltatásé. Hatás: csak a reschedule-felismerés **kupon ↔ normál** foglalások között (kupon ↔ kupon azonos kulcsot ad); az esemény-besorolás (`kupon`), az érték (`unknown_discount`) és a küldés nem függ tőle (HS-04, HS-06). Lehetséges javítás: a `szolgKanon` vágja le a záró „(kupon)”-t (kis változtatás + teszt).

**F3 – a Zap nem szűr üzletágra (TÉNY a Zap forrásából).** Az 5. lépés minden létrehozó levélre meghívja az `sd_atvetel`-t, a kaput a szerver zárja (`salonic_direct:<üzletág>`). A HeadSpa bekapcsolásához **nem kell Zap-változtatás**. (A trigger keresése: `from:app@salonic.hu` + `to:salonicfoglalas@gmail.com` VAGY `from:(Mosaic Oxigén)` / `from:(Mosaic PMU)`; a HeadSpa-levelek a D1 szerint megérkeznek.)

**F4 – a smoke-eszköz a HeadSpára nem futott (JAVÍTVA ebben a változásban, lásd 3.).**

**Várható forgalom:** 10-15-én a 8 HeadSpa-foglalásból 2 (25%) ment motoron kívül; a motoros foglalásoknál az sd `motor_kuldte`-t ad (HS-09), tehát csak a motoron kívülieket fogná be, a megvárt ≥ 20 perc után.

## 5. Amit ez a változás NEM csinál

Nem kapcsolja be a `salonic_direct:headspa`-t; nem módosít éles szerver- vagy böngészőkódot (`netlify/`, `functions/`, `assets/` változatlan); nem nyúl a foglalási folyamathoz, a Zaphoz, külső fiókhoz, hirdetéshez, élő konverzióhoz; nem küld semmit (az offline tesztek hamis hálózaton futnak).

## 6. Bekapcsolási terv (NEM most; külön, kifejezett jelzésre)

Előfeltételek: (1) ez a változás mergelve (a smoke-eszköz a `main`-en legyen); (2) független review PASS; (3) a mérési oldal + ChatGPT bekapcsolási DECISION-je a #167-ben ÉS a Drive-os DECISION-LOG-ban; (4) az F1 eldöntve (javasolt a bekapcsolás előtt: különben a kuponos HeadSpa-események `em` nélkül és index nélkül mennek); (5) rollback-terv ismert (lent).

1. Kapcsoló: `POST /api/meres-admin {muvelet:"sd_kapcsolo", uzletag:"headspa", be:true}` (a meglévő admin végpont; vagy a Zapier-draft `qa4-admin-hivo` új módja – ez Zapier-draft, a (E) felhatalmazás szerint engedett). A `mind` kapcsoló, `MERES_SALONIC_DIRECT`, `MERES_ELOSZTO` és a két titok már be van állítva.
2. Az első motoron kívüli HeadSpa-foglalásra: `node tools/sd-smoke-ellenorzes.mjs jeloltek` → `sql <u8>` (D1, csak olvasás) → `ertekel <u8> <fájl>`; PASS = 12/12 (C4: a levél kora ≥ 1140 mp, ideiglenes szabály, DECISION #183).
3. Figyelés: `sd_sor` növekedése, `elkuldve` sorok csak ÁRNYÉK-cél, élő-ID 0, dupla 0, a HeadSpa tölcsér változatlan.
4. **Visszagörgetés (azonnali):** `POST /api/meres-admin {muvelet:"sd_kapcsolo", uzletag:"headspa", be:false}` (a `0` és a hiányzó sor is KI; HS-07). A már kiment ÁRNYÉK-események nem vonhatók vissza; a D1-sorok megmaradnak (naplózás), a HeadSpa a motoros úton megy tovább, a foglalás sehol sem függ az sd-től.

## 7. Védett elemek

Nem változik: `assets/js/booking-engine/*` (a teljes fa), `assets/js/suti.js`, `klon/*` oldalak, `wrangler.toml`, `netlify/*`, `functions/*`. Változik: `tools/sd-smoke-ellenorzes.mjs`, `tools/test-sd-smoke.mjs`, új `tools/test-sd-headspa.mjs`, új ez a fájl, új `meres-naplo/2026-10-17-sd-headspa-felkeszules.md`. Részletes hash-táblázat: lásd a naplót.
