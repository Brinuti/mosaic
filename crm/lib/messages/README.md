# Oxygeni CRM – üzenetmodul (`crm/lib/messages/`)

A mesteranyag `06 / KÜLDÉSI KATALÓGUS` fejezetének (vendégszövegek) és a 3.8 szabálytáblának gépi átvitele + tiszta függvények a
rendereléshez, kapukhoz, ütemezéshez és küldéshez. **Nincs DB, nincs hálózat, nincs `env` beégetve** – a motor/outbox (DB-réteg, claim, retry)
külön fejlesztő dolga; ez a modul a tiszta felületet adja hozzá. Futtatás: `node --test crm/test/uzenetek.test.mjs`.

Újrahasznosított (nem módosított) lifecycle-kód: `netlify/lib/lifecycle/render.js` (`levelKirajzol`: logó, blokkok, lábléc), `ido.js` (Europe/Budapest dátum/idő),
`nevek.js` (keresztnév), `telefon.js`, `kuldok.js` (SMTP / SimpleSMS).

## Folyamat a motor oldaláról

```
domain-esemény ──► jobokAzEsemenybol(esemeny)        ──► message_job sorok (utemez / torol), idempotency_key UNIQUE
küldéskor (claim) ► friss vendégállapot olvasása
                  ► kapuErtekel(uzenet, allapot, {most, esedekes, booking_start})
                       mehet      ► renderel(uzenet, valtozokEpit({...}), {allapot}) ► kuldo.kuld({...})
                       kesleltet  ► újra az eredmeny.legkorabban időpontban
                       kihagy     ► SKIPPED_CONSENT_OR_STATE / SANDBOX_ONLY: VÉGLEGES (terminalis: true), nincs pótlás
                                    BLOCKED_MISSING_DATA: ujraprobalhato: true (pl. content_ready még nincs)
```

## `katalog.js`

`export default [...]` – 29 üzenet (azonosítók: `T0-F T0-C T-72 T-24 S0 G0 P0 R1 R2 A1 A2 C0 C1 C2 N0 E2 E3 E5 E6 E7 E8 E9 E10 B30 B7 DOC24 DOC48 NEG COMPLAINT`). Mezők:

| mező | jelentés |
|---|---|
| `id`, `forras_kod`, `nev`, `verzio` | azonosító (a forrás T0-H → `T0-F`; D24/D48 → `DOC24`/`DOC48`), cím, sablon-verzió (`1`) |
| `csoport` | `transactional` \| `care` \| `marketing` \| `internal` |
| `csatorna` | `email` \| `sms` \| `internal` |
| `trigger` | `{ esemeny (string/tömb), feltetel, ref, keses_mp (előjeles mp), szabaly (szöveg), torli }` – az ütemező ebből dolgozik |
| `gate` | a kötelező kapuk (lásd `ISMERT_GATEK`), `stop`: a STOP-okok leírása |
| `targy`, `elotag`, `torzs` | e-mail: tárgy, preheader (a forrásban nincs → `null`), blokkok (bekezdés, `{ha}`, `{ha_nincs}`, `{feltetel}`, + SEMA blokkok) |
| `szoveg` | SMS-szöveg |
| `valtozok`, `valtozok_opcionalis` | a `{{helyorzo}}`-k (a teszt ellenőrzi, hogy egyeznek a szöveggel) |
| `qa`, `megjegyzesek` | a forrás „Stop és QA” sora; eltérések / `REQUIRES_VERIFICATION` |
| `szovegHianyzik` | `NEG`, `COMPLAINT`: a forrás csak szabályt ad, szöveget nem → `renderel` → `REQUIRES_VERIFICATION` |

## `valtozok.js`

`feloldas(szoveg, ertekek, {opcionalis}) -> {szoveg, hianyzo[]}` · `helyorzokKigyujt(szoveg)` · `valtozokEpit({keresztnev|nev, booking_start, regi_start, lejarat, ...szabad kulcsok})`
(→ `datum` „október 20. (kedd)”, `datum_ragos` „október 20-án”, `ido` „16:00”, `regi_datum`, `regi_ido`, `lejarat_datum`, `lejarat_datum_ragos`; `kerdoiv_link` ⇄ `allapotfelmero_link` alias) ·
`penz(29900)` → „29 900 Ft” (U+00A0) · `nemTorhetoSzokoz(szoveg)` · `keresztnevbol(nev)` (a lifecycle névlistája; bizonytalan → `null` → „Szia!”) · `BLOCKED_MISSING_DATA`.
Hiányzó kötelező helyorzó → `hianyzo` nem üres → a renderer `BLOCKED_MISSING_DATA`-t ad, **nem küld**. Az érték nem hozhat létre új helyorzót (`{{`/`}}` kiszűrve).

## `render.js`

`renderel(uzenet, ertekek, {allapot?, base?, leiratkozas_link?, max_szegmens?}) -> {allapot: 'OK'|'BLOCKED_MISSING_DATA'|'REQUIRES_VERIFICATION', id, csatorna, hianyzo[], targy, html, szoveg, sms, figyelmeztetesek[]}`
· `smsStatisztika(szoveg) -> {karakter, kodolas: 'GSM-7'|'UCS-2', egysegek, szegmens, szegmens_szolgaltato, szegmens_biztonsagos}` (GSM-7 160/153, UCS-2 70/67; a magyar á í ó ő ú ű → UCS-2).
Figyelmeztetések: `TUL_HOSSZU` (>480 karakter vagy > `max_szegmens`, alap 3), `TOBB_SZEGMENS`, `SZEGMENS_ELTERES`. A `{feltetel}` blokkok (E2 termék-bekezdés, E3 foglalási CTA) az `allapot`-ból döntenek; állapot nélkül kimaradnak.
E-mailben a „29 900 Ft” és a telefonszám nem törhető szóközzel; az URL-ek kattinthatók.

## `kapuk.js`

`kapuErtekel(uzenet, vendegAllapot, {most, esedekes, booking_start}) -> {dontes: 'mehet'|'kihagy'|'kesleltet', eredmeny, ok, kodok[], terminalis, ujraprobalhato, legkorabban?}`
Eredmények: `SENT-ready` · `SKIPPED_CONSENT_OR_STATE` · `BLOCKED_MISSING_DATA` · `SANDBOX_ONLY` (+ `WINDOW_DEFERRED`, nem végleges, ablakon kívül).
Sorrend: sandbox → marketing hard szabályok (csatorna-consent, leiratkozás, nyitott panasz, panasz-lezárás előtti esedékesség = nincs visszamenőleges pótlás) → katalógus-kapuk → küldési ablak.
A SKIPPED mindig megelőzi a BLOCKED-et. Consent nélküli marketing **soha** nem megy. Nyitott panasz: marketing/rebook STOP, tranzakciós marad (és G0).
`booking_status` az **adott job foglalásának** állapota; `next_active_booking` a vendég *másik* aktív jövőbeli foglalása (`null` = nincs; `undefined` = ismeretlen → BLOCKED).
Küldési ablak: SMS 8:00–20:30, e-mail 7:00–21:00 (Europe/Budapest); `T0-F`/`T0-C`/`C0` azonnali; belső üzenetre nincs ablak. Kiegészítők: `kovetkezoAblak(csatorna, epoch)`, `ablakban(...)`, `FELTETELEK`, `KAPUK`, `ISMERT_GATEK`.
Opcionális állapot-mezők a spec 3.8 listán túl: `booking_start`, `assessment_credit_window_ok`, `unused_appointments`, `dokumentacio_hianyzik`, `ma_kuldott`, `complaint_resolved_at`, `sandbox`.

## `utemezo.js`

`jobokAzEsemenybol(esemeny) -> [{muvelet: 'utemez'|'torol', template_key, template_version, esedekes, legkorabbi_kuldes, context_id, idempotency_key, csatorna, csoport}]`
Események: `booking_confirmed`, `booking_rescheduled` (`eredeti_start` + `uj_start`), `booking_cancelled`, `booking_no_show`, `booking_completed`, `documentation_final`, `survey_submitted`, `complaint_created`,
`complaint_resolved` (→ üres, nincs pótlás), `control_due_passed`, `message_sent` (E8 → E9), `package_activated`, `package_expiry_changed`. Az esemény mezőit lásd a fájl fejlécében.
- A szabályokat a katalógus `trigger`-jei adják (egy helyen). Az idő előjeles `keses_mp` a `ref` ponthoz (`esemeny_ido` | `booking_start` | `lejarat` | `kontroll_datum`).
- Átütemezés: az eredeti T-72/T-24 `torol` + új `utemez` az új időpontra (a `context_id` tartalmazza az időpontot: `<booking_uuid>:<epoch>`); a T0 nem ismétlődik. Lemondás: T-72/T-24 `torol`, C0 azonnal.
- Már elmúlt T-72/T-24 (kései foglalás) nem ütemeződik. **Marketing job csak akkor jön létre**, ha az esemény `allapot` pillanatképe szerint van csatorna-consent, nincs leiratkozás, nyitott panasz és (R/C/N/A-nál) másik foglalás.
  A küldéskori kapu mindent újraellenőriz; a később beadott consent *nem* hoz létre visszamenőleg jobot.
- `idempotency_key = guest_key|template_key|context_id|v<template_version>` (`idempotencyKulcs`). A foglalási „új foglalás → STOP” a küldéskori kapun (`no_next_booking`) valósul meg, nem aktív törléssel.
- Az `E5/E6/E7/E10` mind `booking_completed`-re, mind `documentation_final`-re kiadja a jobot ugyanazzal a kulccsal (az outbox UNIQUE-ja dedupolja); a `content_ready` kapu addig `BLOCKED_MISSING_DATA` (újrapróbálható).
- Fix másodpercekkel számol (`-72*3600`); az őszi óraátállítás napján a helyi idő 1 órát eltérhet.

## `kuldo.js`

`kuldoKeszit({env, konfig, kuldokGyar, naplo}) -> adapter` · `adapter.kuld({csatorna, cimzett, targy, html, szoveg}) -> {allapot: 'DRY_RUN'|'SENT'|'FAILED', szolgaltato_id, ...}` · `adapter.lezar()`.
`cimzett`: string vagy `{email, telefon, teszt_only}`. **Alapértelmezett: `dryRunAdapter`** (naplózza, nem küld). `elesAdapterKeszit` csak akkor küld valódit, ha `konfig.kuldes === 'eles'` **és** `cimzett.teszt_only !== true`;
egyébként DRY_RUN (`ok`: `config_not_eles` / `teszt_only`). `konfigEnvbol(env)`: `CRM_KULDES=eles` → `eles`, minden más `dry`. A tényleges küldést a lifecycle `kuldokKeszit(env)` végzi (cserélhető `kuldokGyar`-ral).
Szolgáltatói hiba → `FAILED` (nem dob), `vegleges` jelzéssel.

## REQUIRES_VERIFICATION (összefoglaló; részletek az üzenetek `megjegyzesek`-ében)

- `NEG`, `COMPLAINT`: a forrás csak szabályt ad, szöveget nem. `E5`: a „semleges általános e-mail” változat szövege nincs a forrásban. Minden `elotag` (preheader) `null`.
- `G0`: a „jogalap ellenőrizve” jogi döntés. `B30`/`B7`: opt-in vs. jogalap (addig marketing). `E2`: melyik bekezdés a „marketing elem” (most a termékvásárlásra ösztönző mondat, e-mail consenttel).
- `T-72`/`T-24` a `camera_assessment`/`followup_hair`/`legacy_combo` foglalásokra; `T-24` a kitöltött kérdőívre nem szűr (a szöveg feltételes). `N0` „másnap” napszaka. `E8` kontroll-dátum forrása.
- Marketing-levél leiratkozási szövege/linkje (`leiratkozas_link` opció) nincs a forrásban. Az SMS figyelmeztetési szegmens-küszöb (alap 3) üzleti döntés.
