# crm/lib - uzleti logika (modul -> publikus API)

Tiszta, platformfuggetlen ES modulok. DB: Cloudflare D1 felulet (`prepare/bind/run/all/first/batch`), teszthez `testdb.js` (`ujAdatbazis()`).
Konvenciok: ido = epoch masodperc, penz = egesz Ft, ID = UUID (kivetel: `salonic_account.id` = fiok-slug, `service_catalog.code`, `role.id`).
Minden fuggveny `(db, {parameterek})` alaku; az `now` opcionalis (alap: `most()`); `staffId` = `staff_user.id`. Hiba: `CrmHiba {kod, status, reszlet}`
(pl. `TILTOTT` 403). Iras = `db.batch` (D1: atomikus) + feltetelek (`WHERE`/`EXISTS`) + UNIQUE; minden iras audit. A `tarolo` (kepek/PDF) parameterkent jon:
`{put(kulcs, bajtok, {mime, meret}), get(kulcs) -> {bajtok, mime}|null, del(kulcs)}`.

Egyetlen Salonic-fiok: `mosaic-oxigen` (`FIOK_ALAP`); tobb fiok a `salonic_account` tablaba vehet fel (teszt: `teszt-masodik-fiok`).

## Migracio
`crm/migrations/0001_init.sql` - a spec 3.3 teljes tablakeszlete + `login_otp`, `session`, `beallitasok`, `rate_limit`, `share_verification`.
Ujrafuttathato. Audit-naplok append-only (trigger). Masolhato magadatok: role, salonic_account, service_catalog.

## Modulok
| modul | fo fuggvenyek |
|---|---|
| `constants.js` | `BERLET`, `CREDIT`, `SZOLGALTATAS_ADAT`, `KAMERA_KOTELEZO_ALKALMAK`, `FOGLALAS_ATMENET`, `DOKUMENTUM_ALKALMANKENT`, hataridok/ablakok, `REQUIRES_VERIFICATION` lista |
| `db.js` | `CrmHiba`, `uuid`, `most`, `elso/mind/futtat/keszit`, `tranzakcio(db, [stmt])`, `beszurHa`, `sha256`, `ujToken`, `normEmail/normTelefon`, `naptariNapHozzaad/naptariNapVege/honapHozzaad/helyiNap` (budapesti naptar) |
| `audit.js` | `auditStmt/naplo({staffId, action, resource, resourceId, guestId, result, detail, ipHash})`, `bookingEventStmt`, `mergeAuditStmt`, `auditLista(filter)` |
| `outbox.js` | `outboxStmt`, `fuggoEsemenyek`, `claim(id)`, `kesz(id)`, `hibas(id)`; esemenytipusok es payload-ok a fajl fejleceben |
| `rbac.js` | `lehet(szerep|[szerepek], muvelet, eroforras)`, `szerepek(db, staffId)`, `megkoveteli(db, staffId, muvelet, eroforras, ctx)` (tiltaskor audit + `TILTOTT`), `MATRIX` |
| `guest.js` | `vendegAzonosit({account, externalGuestId, nev, email, telefon})` -> `{guestId, identityId, eredmeny: meglevo_identity|auto_osszefuzes|uj_vendeg, mergeRequestIds}`, `vendeg`, `vegleges(guestId)`, `kereses`, `emailValtoztat`, `elerhetosegEllenorzott` |
| `merge.js` | `fuggoKeresek`, `fuggoDarab`, `jovahagy({requestId, staffId})`, `elutasit`, `visszafordit({mergeAuditId, staffId})`, `automatikusOsszevon`, `MERGE_TABLAK` |
| `booking.js` | `ingestBookingEvent({account, externalId, service, start, end, status: booked|rescheduled|cancelled|no_show, guest:{externalId,nev,email,telefon}, therapist:{staffId|nev}, eventAt, eventId, bookedAt})` -> `{valtozas: uj|athelyezve|lemondva|no_show|duplikalt|elavult|kihagyva, bookingId, guestId}`; `igazolCompleted({bookingId, staffId})` (az EGYETLEN ut a completed-hez); `foglalas`, `esemenyek`, `szolgaltatasKod` |
| `course.js` | `kuraAllapot(guestId)`, `kuraBiztosit`, `kovetkezoIndex`, `kameraKotelezo(index)`, `szuneteltet/folytat/egyeniLezaras/kuraKorrekcio`, `kezelesek(courseId)` |
| `package.js` | `vasarol({guestId, tipus: package_5|package_10, staffId, fizetesIdeje, idempotencyKey, ajandekAtadva})`, `szabadAlkalmak(purchase|id)`, `foglal/felszabadit`, `autoFoglal(bookingId)`, `athelyezesEngedett`, `hosszabbit`, `korrekcio`, `refund({mod: teljes|egyedi, ajandekAllapot})`, `ajandekAtad/ajandekVisszavesz`, `lejaratFigyelo({napElore: 30|7})`, `vendegBerletei`, `allapotFrissit` |
| `credit.js` | `ellenoriz(guestId)` (jelzes), `jelolLevonas({creditId, bookingId, staffId})` (4 990 Ft, egyszer, DB-szinten), `ujraKapcsol(guestId)` |
| `assessment.js` | `ALAP_KERDOIV` (REQUIRES_VERIFICATION), `letrehozVerzio`, `jovahagyVerzio` (clinical_lead), `kiadhato()`, `kiad({guestId, bookingId})` -> token, `bead({token, valaszok})`, `attekint({submissionId, eredmeny: cleared|consult|postponed|contraindicated})`, `tudomasulVesz`, `stopFeloldas`, `kuraAjanlhato`, `kerdoivAllapot` |
| `plan.js` | `ment`, `veglegesit`, `a5Adat(planId)`, `pdfRogzit({planId, bajtok, tarolo})`, `pdfOlvas`, `kuldhetoE(planId, {cimzett})` -> `{ok, hianyok[]}`, `elkuldve`, `hianyzoDokumentumok`, `dokumentumRiasztasok` (DOC24/DOC48), `kurazaro({courseId})`, `jegyzet`, `mezoHibak`, `mondatSzam` |
| `images.js` | `kepFeltolt({sessionId, bajtok, mime, capturePoint, tarolo})`, `kepOlvas` (munkatars), `osszehasonlit`, `osszehasonlitVeglegesit`, `linkKiad({comparisonId})` -> `{token, to, expiresAt}`, `hozzaferes({token, comparisonId|imageId, tarolo})` -> `{ok, status 200|404|410, fejlecek}`, `ujLinkKeres({token, email, ipHash})` -> `{valasz (publikus, mindig azonos), belso}`, `ujLinkEllenoriz`, `visszavon`, `jogosultsagUjraellenorzes`, `FEJLECEK` |
| `consent.js` | `rogzit({guestId, csatorna: email_marketing|sms_marketing|image_marketing|privacy, szovegVerzio})`, `visszavon`, `leiratkozas`, `lehetMarketing(guestId, csatorna)` (teljes kapu), `marketingAllapot` (ok_kod), `hozzajarulas`, `lehetKepMarketing`, `allapot` |
| `complaint.js` | `surveyKiad({bookingId})` -> token, `surveyBead({token, pont, komment})`, `negativSzoveg`, `kezeloRiport`, `panaszNyit`, `probalkozas`, `lezar`, `felelosCsere`, `keso`, `kompenzacioKeres/kompenzacioDont/kompenzacioKiadhato`, `nyitottPanasz` |

## Kapcsolat az uzenet-motorral (outbox + friss allapot)
Az uzleti irasok `outbox_event`-et kuldenek (tipusok: `outbox.js` fejlec). A motor kuldeskor olvassa ujra: `consent.marketingAllapot`, `package.szabadAlkalmak`,
`plan.kuldhetoE`, `course.kuraAllapot`, `complaint.nyitottPanasz`, `assessment.kuraAjanlhato`, `booking.foglalas`.
`message_template/job/ledger` tablak a migracioban vannak (a motor tulajdona).

## Dontesek / feltevesek (ellenorizendo)
- A `completed` csak `igazolCompleted`-bol johet; a Salonic "attended" jelzes csak `salonic_attended_hint` naplo-sor.
- Bérletalkalom automatikusan foglalodik a folytato (followup_hair) foglalashoz (legkorabban lejaro, szabad berlet; a foglalas a lejarat elott jott letre).
  A felszabaditas `package.felszabadit`. A Salonic-athelyezes nem blokkolhato: szabalysertes = `policy_violation` + `package.policy_violation` outbox.
- Credit-ablak: a felmeres IDOPONTJATOL +30 naptari nap vege (budapesti); a first foglalas `booked_at` ideje szamit. Lemondas utan az ablakban uj foglalas ujra jogosit
  (`CREDIT.UJRA_JOGOSULT_LEMONDAS_UTAN`, kikapcsolhato).
- Az allapotfelmero kerdesei a protokoll nelkul `REQUIRES_VERIFICATION` vazak; jovahagyatlan verzio vendegnek nem adhato ki.
- Negativ szoveg-felismeres: konzervativ kulcsszavas heurisztika (`negativSzoveg`), `surveyBead({negativ})`-val felulirhato.
- Teszt: a `testdb.js` batch-e egy kapcsolaton fut; parhuzamos batch-hez a `crm/test/fixtures.js` sorba allitja (a D1 sorosan futtatja).

## API / auth (`api.js`, `auth.js`, `http.js`, `api-*.js`, `public-oldalak.js`)
Szerzodes: `docs/oxigen-crm/API.md`. Belepesi pont: `api(request, env, ctx) -> Response` (`functions/api/crm/[[ut]].js` csak tovabbitja; `CRM_DB` nelkul 503).
Helyi fejlesztes: `node tools/crm-dev.mjs` -> `http://localhost:4210/crm` (API: `/api/crm`, memoria-SQLite, `demo.js` adat, `POST /api/crm/auth/demo {"szerep":"therapist"}`).
Tesztek: `node --test crm/test/api*.test.mjs crm/test/auth.test.mjs crm/test/security.test.mjs`.

| fajl | tartalom |
|---|---|
| `http.js` | egyseges JSON / HTML / fajl valasz + biztonsagi fejlecek (`no-store`, `no-referrer`, `nosniff`, `X-Frame-Options: DENY`, HSTS, CSP: `CSP_CRM` a /crm oldalra, `CSP_PUBLIKUS`: script nincs), `ApiHiba`, hibaformatum, korlatos torzs-olvasas, validacio-segedek, cookie, azonos-eredet, rate limit (`rate_limit` tabla), CSV-/HTML-escape |
| `auth.js` | e-mailes 6 jegyu kod (hash, 10 perc, egyszer, 5 proba / kod, rate limit e-mail + IP), session (`crm_sess`, hash, idle 30 perc, abszolut 12 ora), `CRM_ADMIN_EMAILS`-bootstrap, demo-belepes |
| `api.js` | router, kontextus (`c.kot` = `rbac.megkoveteli`, `c.audit`, `c.now`), munkamenet + CSRF + Origin-ellenorzes, gepi kulcs (`X-CRM-KULCS`), opcionalis modulok (`api-modulok.js`: hianyuk 501) |
| `api-vendeg.js` | dashboard, kereso, profil, osszevonas, munkalista, igazolas / no-show, berlet, credit, hozzajarulas, panasz, elegedettseg |
| `api-klinikai.js` | allapotfelmero (munkatars-oldal), kuraterv + A5 PDF (`api-dokumentum.js`), kepek (feltoltes: 6 MB, MIME + magic byte), osszehasonlitas, link |
| `api-admin.js` | uzenetek (sablonok, jobok, uzemmod; motor-kapcsolat), merok, beallitasok, munkatarsak, audit (+CSV), Salonic-allapot, `/ingest`, `/tick` |
| `api-public.js`, `public-oldalak.js` | `/public/*`: tokenes vendeg-oldalak (felmero, kepek, uj link, elegedettseg, leiratkozas), landing-hozzajarulas |
| `api-token.js` | szinkron HMAC-SHA256: alairt leiratkozasi token (`leiratkozasLinkSync`; a motor `konfig.linkek.leiratkozas`-a szinkron) |

**Kornyezet (`env`):** `CRM_DB` (D1, kotelezo), `ASSETS` (betutipusok a PDF-hez: `/assets/fonts/pdf/*.ttf`), `CRM_ADMIN_EMAILS` (vesszovel; az elso belepeskor admin + salon_manager),
`CRM_KULCS_HASH` (SHA-256 hex az `/ingest` es `/tick` `X-CRM-KULCS` fejlecehez), `CRM_TITOK` (>= 16 karakter, leiratkozasi linkek alairasa), `CRM_KULDES` (`dry` alap | `eles`),
`SMTP_*` (belepesi kodok a munkatarsaknak; vendegnek csak `CRM_KULDES=eles` mellett), `CRM_DEMO=1` (CSAK elonezeten), opcionalis: `CRM_TAROLO` (fajltarolo, alap `d1Tarolo(CRM_DB)`),
`CRM_KULDO` (injektalt kuldo `{to, targy, html, szoveg}`), `CRM_SO` (hash-so), `CRM_IDO` (teszt-ora), `CRM_DEV=1` (localhoston Secure nelkuli suti), `CRM_FONTOK` (teszt).

**Auth-folyamat:** `POST /auth/kod-keres {email}` (valasz MINDIG azonos) -> `POST /auth/kod-ellenoriz {email, kod}` -> `{csrf, felhasznalo}` + `crm_sess` suti (HttpOnly, Secure, SameSite=Strict, `Path=/api/crm`).
Minden iro keres: `X-CRM-CSRF: <csrf>` (a session-tokenbol szarmazik, SHA-256) + azonos `Origin`. `GET /auth/en` -> `{felhasznalo, csrf}` (oldalfrissites utan ujra lekerheto).
`POST /auth/demo` -> 404, ha `CRM_DEMO !== '1'` VAGY a host `*.mosaicheadspa.hu`; a demo-munkamenet eles hoszton akkor sem mukodik, ha a suti megmaradt.
Hibak: `{hiba:{kod, uzenet, reszletek?}}`: 401 nincs belepve, 403 tiltott / CSRF / eredet, 404, 405, 409, 413 (tul nagy), 415, 422 (validacio; a lib 400-asait is 422-re kepezi), 429, 501 (hianyzo modul), 503.
Az azonosito-formaju path-parameter nem UUID -> 404. A jogosultsag az azonosito letezese ELOTT dol el (nemletezo / letezo azonosito: azonos 403).

**Vegpont-valaszok (UI-nak):** `GET /vendegek?q=` -> `{vendegek:[{id, nev, email_maszkolt, telefon_maszkolt, utolso_foglalas, kura_allapot}]}`; `GET /vendegek/:id` -> `{vendeg, azonositok, foglalasok, kura, berletek, credit, hozzajarulasok,
uzenetek, dokumentumok, panaszok, kepek, klinikai_stop}` (a szerepkornek nem jaro szakasz `null`); `POST /foglalasok/:id/completed` -> `{mar, kezeles_sorszam, kamera_kotelezo, kezeles_id, dokumentum}`;
`POST /kezelesek/:sessionId/kepek?pont=<alkalom>&rogzitesi_pont=fo` (nyers bajtok, `Content-Type: image/*`) -> `{id, alkalom}`; `GET /tervek/:id/a5.pdf` (vazlatbol is: "VAZLAT" cimkevel, nem tarolodik);
`POST /osszehasonlitas/:id/link` -> `{grant_id, lejar, link}` (a plaintext token csak itt van); `POST /foglalasok/:id/felmero-kiad` -> `{beadas_id, token, link}`; kiegeszito vegpontok: `POST /vendegek/:id/panaszok`, `POST /ajandekok/:id/atad|visszavesz`.

**Publikus oldalak:** `/api/crm/public/felmero/:token`, `/kep/:token[/:imageId]`, `/uj-link` (POST `{token, email}` - a lejart link tokenje is kell), `/uj-link/:verifikacios_token`, `/elegedettseg/:token`,
`/leiratkozas/:token` (alairt, nem jar le; egykattintasos POST torzs nelkul = e-mail marketing), `POST /public/hozzajarulas` (a `pending_consent:*` kulcsok a `beallitasok`-ban, hash-elt e-mail / telefon, 7 nap;
a foglalas beerkezese utan az `/ingest` es a `/tick` kapcsolja a vendeghez: `fuggoHozzajarulasSweep`).

## Motor / ingest / merok (uzenet-motor, adat-feldolgozas, mutatok, dashboard, demo)
Platformfuggetlen, `node --test`-tel tesztelheto (`crm/test/motor*.test.mjs`, `ingest`, `merok`, `dashboard`, `demo`). **Valodi kuldes SOHA nem indul**: az alap `DRY_RUN`, a valodi kuldes CSAK `konfig.kuldes === 'eles'` (env: `CRM_KULDES=eles`) eseten lehetseges - a tesztek ezt soha nem allitjak be.

| modul | publikus API |
|---|---|
| `motor.js` | `outboxFeldolgoz(db, {katalogus, most, limit})` -> pending `outbox_event` atomikus claim (`pending -> processing`), `messages/utemezo.js` szerinti `message_job` sorok (UNIQUE `idempotency_key`; a `torol` = fuggo job `cancelled`, a `cancelled` job athelyezes-visszaallaskor ujraelesztheto), belso ertesitesek (`alert.doc24/doc48/negative_survey`, `complaint.opened` -> `DOC24` / `DOC48` / `NEG` / `COMPLAINT`, cimzett a payloadban: `staff_id`); `karbantartas(db, {most, konfig})` (elakadt claim vissza, `plan.dokumentumRiasztasok`, B30/B7 a jelenlegi lejarathoz, E8 esedekes kontroll); `tick(db, {most\|now, kuldo, tarolo, konfig, env, szemelyesAdatOlvaso})` -> karbantartas + outbox + az esedekes jobok atomikus claim-je es kuldese; `ujrafuttat(db, jobId\|{jobId, staffId, now, env})`; `elonezet(db, {templateKey, guestId, bookingId, staffId, now})`; `sandboxProba(db, {templateKey, guestId, staffId})` (mindig DRY, a munkatars sajat cimere); `vendegAllapot(db, {job, tpl, most})` (a kuldes pillanataban a DB-bol: `guest_key, booking_status, service_type, course_status, package_owned, next_active_booking, complaint_open, clinical_stop, consent_*, *_unsubscribe/optout, content_ready, recipient_verified` + `assessment_credit_window_ok, unused_appointments, dokumentacio_hianyzik, ma_kuldott, complaint_resolved_at, sandbox`); `motorKonfigEnvbol(env)`; `jobLista`, `uzemmod`; `alapSzemelyesAdatOlvaso` (a sablon-valtozok forrasa: kuraterv, jegyzet, osszehasonlitas, tokenes linkek), `KONFIG_ALAP`, `MAX_KESES_MP` |
| `ingest.js` | `ingestLifecycleEsemeny(db, esemeny, {most\|now, noShowAuto})` (alias: `ingest`) - a `netlify/lib/lifecycle/parser.js` elemzett esemenye -> `booking.ingestBookingEvent`; `szolgaltatasTerkepFeltolt(db)` (`service_catalog.salonic_service_ids`: 466110 first_hair, 466158 followup_hair, 466147 camera_assessment), `SALONIC_SZOLGALTATAS_ALAP` |
| `lifecycle-kapocs.js` | `kapocs(env, esemeny, {idokorlatMs})` -> a meglevo `functions/api/lifecycle/bejovo` kesobbi kapcsa: SOHA nem dob, idokorlattal (alap 2,5 mp), `env.CRM_DB` nelkul / `CRM_KAPOCS=ki` eseten semmit nem csinal; `ctx.waitUntil(kapocs(env, esemeny))` vagy `await` |
| `merok.js` | `merok(db, {tol, ig, kezeloId, most\|now})` - `BOOK_FIRST, SHOW1, SHOW_RATE, R2, R5, R10, R11, NEXT_BOOKED_ON_SITE, PACKAGE_RATE_5/10, ASSESS_TO_FIRST, CREDIT_REDEEM, CONSENT_EMAIL/SMS, MESSAGE_DELIVERY, COMPLAINT_RESOLUTION_24H, DOC_COMPLETION_24H, SALONIC_SYNC_LATENCY, MERGE_REVIEW_PENDING` + `kezelo_bontas`, `kampany_bontas` (nincs forras-adat); `ERES` (kohorsz-eres) |
| `dashboard.js` | `dashboard(db, {nezet: 'kezelo'\|'menedzsment', staffId, most\|now})` - kezelo: a sajat vendegek (clinical_lead: osszes), `assessment.read` jog; menedzsment: CSAK aggregalt szamok, `stats_aggregate.read` jog |
| `demo.js` | `demoAdatBetolt(db, {most, engedelyezNemUres})` (alias: `demoBetolt(db, {now})`) - 15 kitalalt vendeg (`Demo ...`, `@example.invalid`, `06 1 555 xxxx`), 19 munkatars (szerepkoronkent 3-4; az ELSO: `demo-<szerep>@demo.invalid` = a `POST /auth/demo` belepese), jovahagyott kerdoiv-verzio `DEMO - nem szakmai` MARKER-rel, kepek tarolo-bejegyzes nelkul; idempotens (`beallitasok.demo_betoltve`); valodi vendeg- / kerdoiv-adat mellett `NEM_URES_ADATBAZIS` |

**Folyamat:** domain-iras (`booking.js`, `course.js`, `plan.js`, ...) -> `outbox_event` -> `outboxFeldolgoz` -> `message_job` (`pending`, `run_at` = a kuldesi ablakhoz igazitott esedekesseg) -> `tick`: claim (`claimed`) -> **friss allapot** (`vendegAllapot`) -> `kapuErtekel` -> `renderel` -> `kuldo.kuld` -> `message_ledger` (append-only) + job-allapot.
Job-allapotok: `pending | claimed | sent | dry_run | skipped | blocked | failed | dead | cancelled`; `stop_reason` = `<EREDMENY>:<kod>` (`SKIPPED_CONSENT_OR_STATE:no_marketing_consent_email`, `BLOCKED_MISSING_DATA:content_not_ready`, `SANDBOX_ONLY:sandbox_data`, `REQUIRES_VERIFICATION:NINCS_SZOVEG`, `WINDOW_DEFERRED:outside_send_window`, `FAILED:dead_letter`).
- `WINDOW_DEFERRED`: a job `pending` marad, `run_at` = a kovetkezo ablak-nyitas (SMS 8:00-20:30, e-mail 7:00-21:00 Budapest; T0 / C0 azonnali). `BLOCKED_MISSING_DATA` (pl. `content_ready`): `pending` + `hianyzoAdatUjraMp` (1 ora), `hianyzoAdatMaxProba` (72) utan veglegesen `blocked`; `plan.final` esemeny azonnal ujraprobaltatja a tartalomra varo jobokat.
- Szolgaltatoi hiba (`FAILED`): backoff (`backoffMp`: 5 p, 15 p, 1 ora, 3 ora, 12 ora), `maxProba` (5) utan `dead` (dead-letter), `vegleges: true` azonnal `dead`; `ujrafuttat` csak `dead | failed | blocked` jobot indit ujra (`skipped` = jogi / allapot-dontes, nem).
- Regi uzenetet nem potlunk: `MAX_KESES_MP` (pl. T-72 12 ora, T-24 6 ora, R1/R2 2 nap) - az ennel kesobb esedekes job `SKIPPED ...:overdue`; a lefutott idopontra szolo T0 / T-72 / T-24 `...:appointment_passed`; panasz-lezaras elotti marketing `no_retroactive_backfill`.
- Specialis esemenyek: **S0** (elso completed +3h, `complaint.surveyKiad` token a linkben), **G0** (+24h, minden vendegnek, ponttol / consenttol fuggetlenul, `review_request.status = sent`), **E6/E7/E10** (`images.linkKiad` 30 napos link; `content_ready` = `plan.kuldhetoE`), **P0/E10** (a szemelyes dokumentum valodi kuldes utan `plan.elkuldve`; DRY_RUN nem jeloli), **B30/B7** (`package.szabadAlkalmak > 0`; lejarat-valtozasnal a regi job `cancelled`), **T0-F/T0-C/T-72/T-24** (a felmero-token `assessment.kiad`, CSAK jovahagyott kerdoiv-verzioval; kulonben a levél a link-mondat nelkul megy es a `payload.jelzes` jelzi: `felmero_link_nelkul:*`), **DOC24/DOC48** (`plan.dokumentumRiasztasok` -> belso job a sajat kezelonek / a clinical_lead-eknek), **NEG** (clinical_lead-ek) / **COMPLAINT** (a vendeg SAJAT kezeloje), **E8/E9** (karbantartas: a terv szerinti kontroll elmult + nincs foglalas; E9 az E8 elkuldese utan +7 nap, egyszeri).
- Teszt-cimzett szabaly: `konfig.csakTesztCimzettek` (env: `CRM_TESZT_CIMZETTEK`, vesszovel) eseten mas cimzett `SANDBOX_ONLY`; `.invalid` cim es `demo-` azonositoju vendeg mindig sandbox.
- Konfig (`KONFIG_ALAP`; env: `CRM_KULDES`, `CRM_TESZT_CIMZETTEK`, `CRM_PUBLIKUS_URL`, `CRM_TITOK` -> `linkek.leiratkozas`): `linkek: {a5Pdf(ctx), a5Zaras(ctx), ertekeles(ctx), leiratkozas(ctx)}`, `belsoSzovegek: {NEG, COMPLAINT, ...}`, `maxKesesMp`, `tickOutbox`.
- **REQUIRES_VERIFICATION (a motor nem talal ki szoveget / linket):** NEG / COMPLAINT belso szoveg (`konfig.belsoSzovegek` adja, nelkule a job `blocked REQUIRES_VERIFICATION`); vendeg-oldali A5 PDF-link (P0 / E10: `konfig.linkek.a5Pdf` / `a5Zaras`; nelkule `BLOCKED_MISSING_DATA:hianyzo:biztonsagos_a5_pdf_link`); A1 `biztonsagos_ertekeles_link` (nincs forras-adat); E7/E10 `vendeg_visszajelzes` (a kezeloi urlap opcionalis mezoje); kontraindikacio-riasztas (`alert.contraindication`): nincs katalogus-sablon, az esemeny feldolgozott, a kezelo a felulet riasztas-listajan latja; `MAX_KESES_MP` es `ERES.szorzo` (merok) uzleti erteke.
- Az `ingest` az utolagos torlest (az idopont elmult) / "nem jelent meg" jelzest NEM kezeli lemondaskent es nem no_show-ként (lifecycle DECISION #117) - `noShowAuto: true`-val kapcsolhato.
- Mutatok: az R2/R5/R10/R11 csak az ERETT vendegeket szamolja (`ERES`: (n-1) * 14 nap * 1,5); ha egyik sem ert meg: `ertek: null`, `ok: 'kohorsz_nem_ert_meg'` (nincs becsult retencio).
