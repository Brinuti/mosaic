# A76 UJ-93 – tag 95 („Second appointment", Meta SubmitApplication) módosítás-leírása

**Csak leírás (07-WEBOLDAL, 2026-10-30). Semmi nincs módosítva és publikálva.** Kérés: #167 6518608014 (3. pont). A GTM-szerkesztés és a **publikálás külső fiók → DECISION / 01-MERES**; GTM-et a fejlesztő nem publikál.

## 1. Kiinduló állapot (Stape GTM API, csak olvasás, 2026-10-30)
Forrás: A76 web konténer `www.a76.hu` (GTM-M34XP4W, 99992064), **élő v45** (v44: „tag95 reload-blokkoló (120) + tag72 szüneteltetve", v45: „árnyék GA4 a76_foglalas_arnyek").

| elem | érték |
|---|---|
| tag **95** | `cvt_KFNBV` Meta-címke, `eventNameStandard=SubmitApplication`, `eventId={{Unique event ID}}`, `pixelIds={{Meta Pixel}}`, `value={{price}}` (URL `price`), `content_type=lead`, `currency=HUF`, consent `ad_storage` kell, `oncePerEvent`; tüzel: trigger **90**, **103**; blokkol: trigger **120** |
| trigger **90** (Móricz) | pageview; feltétel 1: `{{first_booking}}` **nem** tartalmazza a „true"-t (negált `contains`); feltétel 2: `{{Page Path}}` tartalmazza `/foglalas-moricz` |
| trigger **103** (Oktogon) | ugyanaz, `/foglalas-ok` |
| trigger **120** | pageview; `{{JS – Navigation type}}` ≠ `navigate` (blokkoló: újratöltés / vissza) |
| változó **88** `first_booking` | URL-változó, `QUERY`, kulcs `first_booking` |
| változó **116** `JS – Meta Schedule jogosult` | `okPath` (`/foglalas-ok` vagy `/foglalas-moricz`) **és** `first_booking=(true|1)` (regex) **és** navigáció = `navigate` |

(A 90 / 103 trigger a *Default Workspace*-ből olvasva, ujjlenyomat 2025-12-08; a v44 / v45 nem módosította őket. A *Default Workspace (29)* különben elmarad az élő v45-től: a 95-ös benne még blokkoló trigger nélküli – **ebből nem szabad publikálni**.)

## 2. Mi a hiba (kódból, nem mérésből)
1. **A „Second" negatív feltétel:** a 95 akkor tüzel, ha az URL-ben *nincs* `first_booking=true` – tehát hiányzó paraméter, `false`, `0`, `1`, bármi más is „Second".
2. **Szabály-eltérés:** a Schedule (116) a `true` és az `1` értéket is „első"-nek veszi → `first_booking=1` esetén **Schedule is, SubmitApplication is** tüzel ugyanarra a foglalásra.
3. **Az eseményazonosító nem a foglalási kulcs:** `{{Unique event ID}}` (egyedi sablon-változó); a szerveres dedup / párosítás így nem tud foglalási kulcsra támaszkodni. (A Schedule-nál ez rendben van: web 94 és Data Tag 124 ugyanazt a `{{JS – Schedule event ID (oldalszintű)}}` változót használja.)

## 2/b. 0. lépés – megfigyelő diagnosztikai mező `first_booking_raw` (előmérés, ~3 nap)
Kérés: 01-MERES 6523418697 (feri_dontes 18: **végrehajtás csak Feri „mehet"-je után**). Miért kell: a `first_booking` értéke a meglévő adatból nem kinyerhető – az `a76_schedule_log` `page_location` mezője csak útvonal (query levágva) és csak a Schedule-eseményeket tartalmazza; a GA4 árnyék (158) csak `booking_id`-t visz; a Meta dataset `url` bontása csak a főoldalt mutatja.

| lépés | hol | mi |
|---|---|---|
| a) új web-változó | A76 web (GTM-M34XP4W), új munkaterület az élő v45-ből | `JS – first_booking_raw`: a `first_booking` URL-paraméter értékét **zárt tokenre** képezi: `hianyzik` (nincs paraméter) · `ures` (üres érték) · `true` · `false` · `1` · `0` · `egyeb` (bármi más; a nyers érték nem kerül ki) · `hiba` (kivétel) |
| b) a foglalási eseményt szállító web Data Tag | ugyanott | `custom_data` +1 elem: `first_booking_raw = {{JS – first_booking_raw}}`. **A pontos címke azonosítandó a workspace-ben** (a 158-as címke jegyzete „Stape Data Tag 35"-öt említ; a 124-es a Schedule-é, a 137-es az érintésnapló) – olyan Data Tag kell, amelynek eseménye a szerveren a 57-es triggert indítja (`/foglalas-` oldal, nem `a76_schedule` / `a76_touch`) |
| c) szerver esemény-adat változó | A76 szerver (GTM-WZDSDB3K), új munkaterület az élő v37-ből | `ED – first_booking_raw` (eseményadat-kulcs `first_booking_raw`) |
| d) Store-címke | szerver | a 56-os „Stape Store – foglalás forrása" (gyűjtemény `a76_foglalas_forras`, trigger 57) `customDataList` +1 mező: `first_booking_raw = {{ED – first_booking_raw}}` |
| e) olvasás | repó | a meglévő `A76 Stape Store számláló` workflow bővítése (külön PR, csak darabszám): `first_booking_raw` szerinti napi bontás (true / false / 1 / 0 / üres / egyéb), vendégadat és azonosító nélkül |

- Platformra (Meta / Google / TikTok) **nem küld**, személyes adat nincs (zárt tokenkészlet, a nyers érték sosem kerül ki).
- **Rollback:** a `custom_data` elem és a Store-mező elhagyása (a két munkaterület előző verziója: web v45, szerver v37).
- **Teszt (Preview, publikálás nélkül):** `?first_booking=true|false|1|0|` és hiányzó paraméter → a Store-sor `first_booking_raw` mezője a várt érték; a Schedule / SubmitApplication viselkedése **változatlan** (ez a lépés nem érinti a 90 / 103 / 116 szabályt).
- **Ütemezés (01-MERES javaslata):** élesítés Feri „mehet"-je után → 3 nap adat → értékelés (legkorábban 11-03) → UJ-93 publikálás.


### 2/c. ÁLLAPOT – ÉLESÍTVE 2026-10-30 14:23Z (15:23 Budapest), Feri „mehet"-je (DECISION #263, feri_dontes 18)
- **Szerver (GTM-WZDSDB3K): v38** publikálva (munkaterület 39, az élő v37-ből): új `ED – first_booking_raw` (id 88) + a **56-os** Stape Store-címke (`a76_foglalas_forras`) +1 `customDataList` mező. 15 címke / 12 trigger / 43 változó, fordítási hiba nincs. Rollback: **v37**.
- **Web (GTM-M34XP4W): v46** publikálva (munkaterület 48, az élő v45-ből): új `JS – first_booking_raw` (id 160) + **Data Tag 35** (trigger 89 / 90 / 103 / 105) `custom_data` +1 elem. 50 címke / 36 trigger / 53 változó, fordítási hiba nincs; a tag 95 blokkoló triggere (120) és minden más címke változatlan. Rollback: **v45**.
- **Nem változott:** tag 95 / 94 / 90 / 103 / 116, a Schedule és a SubmitApplication szabály, a hirdetési platformok, a foglalási folyamat. Platformra a mező nem megy.
- **Olvasás:** `A76 Stape Store számláló` workflow, új `kategoria=1` mód (zárt halmaz, esemény szerinti napi bontás, nyers érték nem kerül a naplóba) – `claude/a76-store-filter` (#501).

## 3. Javasolt módosítás (új munkaterületen, az ÉLŐ v45-ből indítva)
**0. lépés:** új munkaterület az élő v45-ből (vagy a Default Workspace szinkronja a v45-tel), ne a 29-es állapotából.

**A) Közös, normalizált jel – új változó** `JS – first_booking (normalizált)`:
```js
function() {
  var m = location.search.match(/[?&]first_booking=([^&#]*)/i);
  var v = m ? decodeURIComponent(m[1]).toLowerCase() : '';
  if (v === 'true') return 'true';
  if (v === 'false') return 'false';
  return '';
}
```
- **Trigger 90 és 103** feltétele: `{{JS – first_booking (normalizált)}}` **egyenlő** `false` (a negált `contains true` helyett) + az oldal-útvonal feltétel változatlan.
- **Változó 116** (Schedule-jogosult): `first = ({{JS – first_booking (normalizált)}} === 'true')` a regex helyett.
- Következmény: `true` → csak Schedule; `false` → csak Second; hiányzó / `1` / más → **egyik sem** (ilyenkor a mérés *nem* ad hamis Second-et; az ilyen foglalások száma a Stape Store `a76_schedule_log`-ban és a Salonic-értesítőkben követhető).
- ⚠ **Hatás:** a Schedule az `1`-et eddig elsőnek vette; az új szabály szerint az `1` nem kap Schedule-t sem. Ha a Salonic / motor valaha `1`-et ad, azt előbb meg kell nézni (D1 / Salonic-értesítő URL-ek) – a kódban sehol nem találtam `first_booking=1` küldést, ez **HIPOTÉZIS-szintű kockázat**, mérés kell hozzá.

**B) Eseményazonosító = foglalási kulcs (Feri 10-24 MEHET):** a tag 95-ön `eventId` → a köszönőoldalon elérhető foglalási kulcs. **Nincs igazolva**, hogy a pageview-triggereken (90 / 103) a `booking_id` már elérhető; a `DLV – booking_id (a76_booking_booked)` változó az `a76_booking_booked` dataLayer-eseményen él (158-as GA4 árnyék-címke). Két út:
- **B1:** a booking_id kiolvasása az URL-ből / a köszönőoldal kódjából (ha ott van) – ellenőrzés előnézetben.
- **B2:** a 95 triggerét az `a76_booking_booked` egyedi eseményre kötni (`first_booking=false` szűrővel, a normalizált változóval) – ekkor az `eventId = {{DLV – booking_id (a76_booking_booked)}}`; a reload-blokk (120) marad. **B2 a megbízhatóbb**, de a dataLayer-esemény időzítése (a pageview-hoz képest) előnézetben ellenőrzendő.
- Amíg B nincs igazolva, **A önmagában is érvényes javítás** (kettős tüzelés és hamis Second kizárása).

## 4. Tesztterv (GTM Preview, nincs publikálás; éles Meta-fiók nem módosul)
URL-ek a köszönőoldalon (`/foglalas-ok`, `/foglalas-moricz`), friss `navigate` navigációval:
| `first_booking` | elvárt Schedule (94) | elvárt SubmitApplication (95) |
|---|---|---|
| `true` | tüzel | **nem** |
| `false` | **nem** | tüzel |
| `1` | **nem** (új szabály) | **nem** |
| hiányzik | **nem** | **nem** |
| `false`, majd oldal-újratöltés | – | **nem** (120 blokkol) |
Ellenőrzés még: a `value` / `price` változatlan; az `eventId` (B) egyezik a foglalási kulccsal; a szerveres Data Tag 124 / 63 útvonala (Schedule) érintetlen.

## 5. Rollback
Az élő v45 (a módosítás előtti állapot); a módosítás egy új verzió, visszavétel = v45 újrapublikálása. A védett / külső elemek (Meta-pixel, szerver-konténer v37) nem változnak.

## 6. Ki mit csinál
- **07-WEBOLDAL:** ez a leírás; kérésre a változó- és trigger-konfig JSON-ja (ugyanaz, mint fent) és a tesztterv futtatása előnézetben, ha 01-MERES a GTM-szerkesztést jóváhagyja.
- **01-MERES / DECISION:** a GTM-szerkesztés, az előnézeti teszt jóváhagyása és a **publikálás**.
- **Nyitott mérés:** Salonic `first_booking=false` napi darabszám (10-23..29: új vendég 31, visszatérő 440 – 01-MERES 6518608014) és a Meta `SubmitApplication` (15) / `Schedule` (47) összevetése a javítás előtt/után.
